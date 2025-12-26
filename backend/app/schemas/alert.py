from datetime import datetime

from pydantic import BaseModel


class AlertCreate(BaseModel):
    message: str
    alert_type: str | None = None


class AlertOut(BaseModel):
    id: str
    vehicle_id: str
    created_by_user_id: str | None = None
    alert_type: str | None = None
    message: str
    status: str
    delivered_to_driver_at: datetime | None = None
    acknowledged_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True
