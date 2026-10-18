import asyncio
from collections import defaultdict

from fastapi import WebSocket


class CallConnectionManager:
    """Canal efímero de señalización entre usuarios autenticados."""

    def __init__(self):
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, socket: WebSocket):
        async with self._lock:
            self._connections[user_id].add(socket)

    async def disconnect(self, user_id: int | None, socket: WebSocket):
        if user_id is None:
            return
        async with self._lock:
            sockets = self._connections.get(user_id)
            if sockets is None:
                return
            sockets.discard(socket)
            if not sockets:
                self._connections.pop(user_id, None)

    async def send(self, user_id: int, message: dict) -> bool:
        async with self._lock:
            sockets = list(self._connections.get(user_id, ()))
        delivered = False
        for socket in sockets:
            try:
                await socket.send_json(message)
                delivered = True
            except Exception:
                await self.disconnect(user_id, socket)
        return delivered


call_connections = CallConnectionManager()
