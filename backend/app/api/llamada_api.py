import asyncio
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.auth import get_user_from_token, require_roles
from app.core.call_connections import call_connections
from app.core.database import SessionLocal, get_db
from app.models.usuario_models import Usuario
from app.services.llamada_services import authorized_call_peer, call_contacts, call_role


router = APIRouter(prefix="/llamadas", tags=["Llamadas de ruta"])
SIGNAL_TYPES = {"invitar", "aceptar", "rechazar", "oferta", "respuesta", "candidato", "finalizar"}


def _authenticated_user(token: str) -> int:
    with SessionLocal() as db:
        user = get_user_from_token(token, db)
        if call_role(user) not in {"coordinador", "conductor"}:
            raise HTTPException(status_code=403, detail="No tienes acceso a llamadas de ruta")
        return user.id_usuario


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
