from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt

from app.core.settings import settings
from app.services.events import event_bus


router = APIRouter()


def _extract_token(ws: WebSocket) -> str | None:
    # Prefer query param for simplicity in browser WS.
    token = ws.query_params.get("token")
    if token:
        return token
    auth = ws.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1]
    return None


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    token = _extract_token(ws)
    if not token:
        await ws.close(code=4401)
        return

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except Exception:
        await ws.close(code=4401)
        return

    company_id = payload.get("company_id")
    user_id = payload.get("sub")
    if not company_id or not user_id:
        await ws.close(code=4401)
        return

    await ws.accept()
    q = event_bus.subscribe(company_id)
    try:
        await ws.send_json({"type": "connected", "company_id": company_id, "user_id": user_id})
        while True:
            event = await q.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        event_bus.unsubscribe(company_id, q)
    except Exception:
        event_bus.unsubscribe(company_id, q)
        await ws.close(code=1011)
