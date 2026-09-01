import asyncio
from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder


class TrackingConnectionManager:
    def __init__(self):
        self._connections: dict[UUID, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, delivery_id: UUID, websocket: WebSocket):
        async with self._lock:
            self._connections[delivery_id].add(websocket)

    async def disconnect(self, delivery_id: UUID | None, websocket: WebSocket):
        if delivery_id is None:
            return
        async with self._lock:
            sockets = self._connections.get(delivery_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(delivery_id, None)

    async def broadcast(self, delivery_id: UUID, message: dict):
        async with self._lock:
            sockets = list(self._connections.get(delivery_id, ()))
        disconnected = []
        encoded = jsonable_encoder(message)
        for websocket in sockets:
            try:
                await websocket.send_json(encoded)
            except Exception:
                disconnected.append(websocket)
        for websocket in disconnected:
            await self.disconnect(delivery_id, websocket)

    async def connection_count(self) -> int:
        async with self._lock:
            return sum(len(items) for items in self._connections.values())


tracking_connections = TrackingConnectionManager()
