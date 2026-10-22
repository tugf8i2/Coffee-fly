import asyncio
import json
import os
import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import jwt
from sqlalchemy.orm import Session

from app.core.auth import get_user_from_token, require_roles
from app.core.call_connections import call_connections
from app.core.database import SessionLocal, get_db
from app.models.usuario_models import Usuario
from app.services.llamada_services import authorized_call_peer, call_contacts, call_role


router = APIRouter(prefix="/llamadas", tags=["Llamadas de ruta"])
SIGNAL_TYPES = {"invitar", "aceptar", "rechazar", "oferta", "respuesta", "candidato", "video_apagado", "finalizar"}


class LiveKitCallRequest(BaseModel):
    viaje_id: UUID
    llamada_id: UUID


def _livekit_settings() -> tuple[str, str, str] | None:
    url = os.getenv("LIVEKIT_URL", "").strip()
    key = os.getenv("LIVEKIT_API_KEY", "").strip()
    secret = os.getenv("LIVEKIT_API_SECRET", "").strip()
    if url.startswith("wss://") and key and secret:
        return url, key, secret
    return None


@router.get("/medio")
def call_media_mode(
    _user: Usuario = Depends(require_roles("coordinador", "conductor")),
):
    return {"medio": "livekit" if _livekit_settings() else "webrtc"}


@router.post("/livekit-token")
def livekit_call_token(
    request: LiveKitCallRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_roles("coordinador", "conductor")),
):
    settings = _livekit_settings()
    if settings is None:
        raise HTTPException(status_code=503, detail="LiveKit no está configurado")
    authorized_call_peer(db, user, request.viaje_id)
    url, key, secret = settings
    now = int(time.time())
    room = f"coffee-fly-{request.viaje_id}-{request.llamada_id}"
    token = jwt.encode({
        "iss": key,
        "sub": str(user.id_usuario),
        "name": f"{user.nombre_usuario} {user.apellido}".strip(),
        "iat": now,
        "nbf": now,
        "exp": now + 1800,
        "video": {
            "room": room,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": False,
        },
    }, secret, algorithm="HS256")
    return {"server_url": url, "participant_token": token}


def _authenticated_user(token: str) -> int:
    with SessionLocal() as db:
        user = get_user_from_token(token, db)
        if call_role(user) not in {"coordinador", "conductor"}:
            raise HTTPException(status_code=403, detail="No tienes acceso a llamadas de ruta")
        return user.id_usuario


def _caller_name(token: str) -> str:
    with SessionLocal() as db:
        user = get_user_from_token(token, db)
        return f"{user.nombre_usuario} {user.apellido}".strip()


def _authorized_peer(token: str, trip_id: UUID, expected_user_id: int) -> int:
    with SessionLocal() as db:
        user = get_user_from_token(token, db)
        if user.id_usuario != expected_user_id:
            raise HTTPException(status_code=401, detail="La sesión cambió")
        return authorized_call_peer(db, user, trip_id)


@router.get("/contactos")
def listar_contactos(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_roles("coordinador", "conductor")),
):
    return call_contacts(db, user)


@router.websocket("/ws")
async def call_signaling(socket: WebSocket):
    await socket.accept()
    user_id = None
    try:
        authentication = await asyncio.wait_for(socket.receive_json(), timeout=10)
        token = str(authentication.get("token") or "")
        user_id = await asyncio.to_thread(_authenticated_user, token)
        caller_name = await asyncio.to_thread(_caller_name, token)
        await call_connections.connect(user_id, socket)
        await socket.send_json({"tipo": "listo"})
        while True:
            try:
                raw = await asyncio.wait_for(socket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await asyncio.to_thread(_authenticated_user, token)
                await socket.send_json({"tipo": "ping"})
                continue
            if len(raw) > 120000:
                await socket.send_json({"tipo": "error", "detalle": "Señal demasiado grande"})
                continue
            message = json.loads(raw)
            if not isinstance(message, dict):
                continue
            if message.get("tipo") == "ping":
                await socket.send_json({"tipo": "pong"})
                continue
            if message.get("tipo") not in SIGNAL_TYPES:
                continue
            trip_id = UUID(str(message.get("viaje_id") or ""))
            call_id = UUID(str(message.get("llamada_id") or ""))
            peer_id = await asyncio.to_thread(_authorized_peer, token, trip_id, user_id)
            content = message.get("contenido")
            if not isinstance(content, dict):
                content = {}
            if message["tipo"] == "candidato" and len(json.dumps(content)) > 12000:
                continue
            delivered = await call_connections.send(peer_id, {
                "tipo": message["tipo"],
                "viaje_id": str(trip_id),
                "llamada_id": str(call_id),
                "de_usuario_id": user_id,
                "de_nombre": caller_name,
                "contenido": content,
            })
            if not delivered and message["tipo"] == "invitar":
                await socket.send_json({"tipo": "no_disponible", "viaje_id": str(trip_id), "llamada_id": str(call_id)})
    except WebSocketDisconnect:
        pass
    except (ValueError, TypeError, json.JSONDecodeError):
        await socket.close(code=4400, reason="Señal de llamada inválida")
    except HTTPException as error:
        await socket.close(code=4401 if error.status_code == 401 else 4403, reason=str(error.detail))
    except asyncio.TimeoutError:
        await socket.close(code=4408, reason="Tiempo de autenticación agotado")
    finally:
        await call_connections.disconnect(user_id, socket)
