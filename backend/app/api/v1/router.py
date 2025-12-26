from fastapi import APIRouter

from app.api.v1.routes import auth, vehicles, alerts, audit, orders, users
from app.api.v1.routes import permissions, telemetry, geozones, notifications, incidents, ws

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])
api_router.include_router(geozones.router, prefix="/geozones", tags=["geozones"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
api_router.include_router(ws.router, tags=["ws"])
