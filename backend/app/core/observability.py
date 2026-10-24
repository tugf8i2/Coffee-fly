import json
import logging
import time
from collections import Counter, defaultdict, deque
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

from fastapi import HTTPException, Request, WebSocket
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import (
    API_RATE_LIMIT_PER_MINUTE,
    IS_PRODUCTION,
    TRUST_PROXY_HEADERS,
    WEBSOCKET_CONNECTIONS_PER_CLIENT,
    WEBSOCKET_CONNECTIONS_PER_MINUTE,
)


class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for name in (
            "request_id", "method", "path", "status_code", "duration_ms",
            "delivery_id", "client_point_id", "reason",
        ):
            value = getattr(record, name, None)
            if value is not None:
                payload[name] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str = "INFO"):
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("coffee_fly")
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.setLevel(level.upper())
    logger.propagate = False
    return logger


logger = configure_logging()


class OperationalMetrics:
    def __init__(self):
        self._started_at = datetime.now(timezone.utc)
        self._counters = Counter()
        self._observations = defaultdict(lambda: {"count": 0, "sum": 0.0, "max": 0.0})
        self._lock = Lock()

    def increment(self, name: str, amount: int = 1) -> None:
        with self._lock:
            self._counters[name] += amount

    def observe(self, name: str, value: float) -> None:
        number = float(value)
        with self._lock:
            observation = self._observations[name]
            observation["count"] += 1
            observation["sum"] += number
            observation["max"] = max(observation["max"], number)

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "desde": self._started_at,
                "contadores": dict(self._counters),
                "observaciones": {
                    name: {
                        "count": value["count"],
                        "average": value["sum"] / value["count"] if value["count"] else 0,
                        "max": value["max"],
                    }
                    for name, value in self._observations.items()
                },
            }


process_metrics = OperationalMetrics()


class SlidingWindowRateLimiter:
    def __init__(self, limit: int, window_seconds: int, max_keys: int = 5000):
        self.limit = limit
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self._events = defaultdict(deque)
        self._lock = Lock()
        self._last_cleanup = None

    def _cleanup(self, current: float) -> None:
        if self._last_cleanup is not None and current - self._last_cleanup < self.window_seconds:
            return
        for key, events in list(self._events.items()):
            while events and current - events[0] >= self.window_seconds:
                events.popleft()
            if not events:
                self._events.pop(key, None)
        self._last_cleanup = current

    def check(self, key: str, now: float | None = None) -> tuple[bool, int]:
        current = time.monotonic() if now is None else now
        with self._lock:
            self._cleanup(current)
            if key not in self._events and len(self._events) >= self.max_keys:
                return False, self.window_seconds
            events = self._events[key]
            while events and current - events[0] >= self.window_seconds:
                events.popleft()
            if len(events) >= self.limit:
                retry_after = max(1, int(self.window_seconds - (current - events[0])) + 1)
                return False, retry_after
            events.append(current)
            return True, 0

    @property
    def tracked_keys(self) -> int:
        with self._lock:
            return len(self._events)


login_rate_limiter = SlidingWindowRateLimiter(limit=10, window_seconds=60)
api_rate_limiter = SlidingWindowRateLimiter(limit=API_RATE_LIMIT_PER_MINUTE, window_seconds=60)
websocket_rate_limiter = SlidingWindowRateLimiter(
    limit=WEBSOCKET_CONNECTIONS_PER_MINUTE,
    window_seconds=60,
)


class ConnectionLimiter:
    """Limita sockets simultáneos por cliente dentro de una instancia."""

    def __init__(self, limit: int):
        self.limit = limit
        self._connections = Counter()
        self._lock = Lock()

    def acquire(self, key: str) -> bool:
        with self._lock:
            if self._connections[key] >= self.limit:
                return False
            self._connections[key] += 1
            return True

    def release(self, key: str | None) -> None:
        if not key:
            return
        with self._lock:
            if self._connections[key] <= 1:
                self._connections.pop(key, None)
            else:
                self._connections[key] -= 1


websocket_connection_limiter = ConnectionLimiter(WEBSOCKET_CONNECTIONS_PER_CLIENT)


def client_identity(connection: Request | WebSocket) -> str:
    """Obtiene una identidad de cliente sin aceptar X-Forwarded-For falsificado.

    Solo se confía en ese encabezado cuando el proxy administrado fue declarado
    explícitamente en el entorno. De lo contrario se usa la dirección directa.
    """
    if TRUST_PROXY_HEADERS:
        forwarded = connection.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()[:64] or "unknown"
    client = connection.client
    return (client.host if client else "unknown")[:64]


def protect_websocket_connection(websocket: WebSocket) -> tuple[bool, str, int]:
    key = client_identity(websocket)
    allowed, retry_after = websocket_rate_limiter.check(key)
    if not allowed:
        process_metrics.increment("websocket_rate_limited")
        return False, key, retry_after
    if not websocket_connection_limiter.acquire(key):
        process_metrics.increment("websocket_connection_limited")
        return False, key, 0
    return True, key, 0


def release_websocket_connection(key: str | None) -> None:
    websocket_connection_limiter.release(key)


def should_rate_limit(request: Request) -> bool:
    path = request.url.path
    if request.method == "OPTIONS" or path in {"/health/live", "/health/ready", "/api/health/live", "/api/health/ready"}:
        return False
    static_prefixes = ("/assets/", "/fonts/", "/data/", "/styles/")
    return not path.startswith(static_prefixes)


async def request_observability_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", "").strip()[:64] or str(uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    response = None
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > 6 * 1024 * 1024:
        response = JSONResponse(
            status_code=413,
            content={
                "detail": "La solicitud supera el límite permitido de 6 MB",
                "error": {"code": "PAYLOAD_TOO_LARGE", "request_id": request_id},
            },
        )
    else:
        client_ip = client_identity(request)
        if should_rate_limit(request):
            allowed, retry_after = api_rate_limiter.check(client_ip)
            if not allowed:
                process_metrics.increment("api_rate_limited")
                response = JSONResponse(
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                    content={
                        "detail": "Demasiadas solicitudes. Espera antes de reintentar.",
                        "error": {"code": "RATE_LIMITED", "request_id": request_id},
                    },
                )
        if response is None and request.method == "POST" and request.url.path in {"/login", "/api/login"}:
            allowed, retry_after = login_rate_limiter.check(client_ip)
            if not allowed:
                process_metrics.increment("login_rate_limited")
                response = JSONResponse(
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                    content={
                        "detail": "Demasiados intentos de inicio de sesión. Espera antes de reintentar.",
                        "error": {"code": "RATE_LIMITED", "request_id": request_id},
                    },
                )
    if response is None:
        response = await call_next(request)
    duration_ms = round((time.perf_counter() - started) * 1000, 2)
    process_metrics.increment("http_requests_total")
    if response.status_code >= 500:
        process_metrics.increment("http_responses_5xx")
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(self), microphone=(self), payment=()"
    if IS_PRODUCTION and request.headers.get("x-forwarded-proto", request.url.scheme) == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    logger.info(
        "request_completed",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response


async def http_error_handler(request: Request, error: HTTPException):
    return JSONResponse(
        status_code=error.status_code,
        headers=error.headers,
        content={
            "detail": error.detail,
            "error": {"code": f"HTTP_{error.status_code}", "request_id": getattr(request.state, "request_id", None)},
        },
    )


async def validation_error_handler(request: Request, error: RequestValidationError):
    if "/ubicacion" in request.url.path:
        process_metrics.increment("gps_validation_errors")
    errors = [
        {
            "field": ".".join(str(part) for part in item.get("loc", [])),
            "message": item.get("msg", "Dato inválido"),
            "type": item.get("type", "validation_error"),
        }
        for item in error.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "detail": "La solicitud contiene datos inválidos",
            "errors": errors,
            "error": {"code": "VALIDATION_ERROR", "request_id": getattr(request.state, "request_id", None)},
        },
    )


async def database_error_handler(request: Request, error: SQLAlchemyError):
    process_metrics.increment("database_errors")
    logger.exception(
        "database_error",
        extra={"request_id": getattr(request.state, "request_id", None), "path": request.url.path},
    )
    return JSONResponse(
        status_code=503,
        content={
            "detail": "El servicio de datos no está disponible temporalmente",
            "error": {"code": "DATABASE_UNAVAILABLE", "request_id": getattr(request.state, "request_id", None)},
        },
    )


async def unexpected_error_handler(request: Request, error: Exception):
    process_metrics.increment("unexpected_errors")
    logger.exception(
        "unhandled_error",
        extra={"request_id": getattr(request.state, "request_id", None), "path": request.url.path},
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Ocurrió un error interno. Intenta nuevamente.",
            "error": {"code": "INTERNAL_ERROR", "request_id": getattr(request.state, "request_id", None)},
        },
    )
