import asyncio
from uuid import UUID

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder

from app.core.auth import get_user_from_token
from app.core.database import SessionLocal
from app.core.realtime import tracking_connections
from app.services.entrega_services import EntregaService


router = APIRouter(tags=["Tiempo real"])


def authenticated_snapshot(token: str, delivery_id: UUID):
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        role = user.rol.descripcion_rol.lower() if user.rol else ""
        if role not in {"coordinador", "conductor", "caficultor"}:
            raise HTTPException(status_code=403, detail="No tienes acceso al seguimiento")
        return EntregaService(db).obtener_seguimiento(delivery_id, user)
    finally:
        db.close()


@router.websocket("/ws/seguimiento")
async def seguimiento_tiempo_real(websocket: WebSocket):
    await websocket.accept()
    delivery_id = None
    token = None
    try:
        authentication = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        token = str(authentication.get("token") or "")
        delivery_id = UUID(str(authentication.get("entrega_id") or ""))
        snapshot = await asyncio.to_thread(authenticated_snapshot, token, delivery_id)
        await tracking_connections.connect(delivery_id, websocket)
        await websocket.send_json(jsonable_encoder({"tipo": "snapshot", "seguimiento": snapshot}))

        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_json(), timeout=30)
                if message.get("tipo") == "ping":
                    await websocket.send_json({"tipo": "pong"})
            except asyncio.TimeoutError:
                # Revalida la sesión periódicamente y mantiene vivo el canal.
                await asyncio.to_thread(authenticated_snapshot, token, delivery_id)
                await websocket.send_json({"tipo": "ping"})
    except WebSocketDisconnect:
        pass
    except (ValueError, TypeError):
        await websocket.close(code=4400, reason="Solicitud de seguimiento inválida")
    except HTTPException as error:
        code = 4401 if error.status_code == 401 else 4403
        await websocket.close(code=code, reason=str(error.detail))
    except asyncio.TimeoutError:
        await websocket.close(code=4408, reason="Tiempo de autenticación agotado")
    finally:
        await tracking_connections.disconnect(delivery_id, websocket)
