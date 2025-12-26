from datetime import datetime

from pydantic import BaseModel


class OrderCreate(BaseModel):
    title: str
    cargo_desc: str | None = None
    origin: str | None = None
    destination: str | None = None
    planned_depart_at: datetime | None = None
    planned_arrive_at: datetime | None = None
    vehicle_id: str | None = None
    assigned_driver_user_id: str | None = None


class OrderAssign(BaseModel):
    vehicle_id: str | None = None
    assigned_driver_user_id: str | None = None


class OrderTransition(BaseModel):
    reason: str | None = None


class OrderOut(BaseModel):
    id: str
    title: str
    cargo_desc: str | None = None
    origin: str | None = None
    destination: str | None = None
    planned_depart_at: datetime | None = None
    planned_arrive_at: datetime | None = None
    status: str
    vehicle_id: str | None = None
    created_by_user_id: str | None = None
    assigned_driver_user_id: str | None = None
    accepted_by_user_id: str | None = None
    accepted_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True
