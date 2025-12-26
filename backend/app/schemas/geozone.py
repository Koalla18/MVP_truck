from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class GeozoneCreate(BaseModel):
    name: str
    zone_type: str
    is_active: bool = True

    center_lat: float | None = None
    center_lon: float | None = None
    radius_m: float | None = None
    polygon: dict | None = None


class GeozoneUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    center_lat: float | None = None
    center_lon: float | None = None
    radius_m: float | None = None
    polygon: dict | None = None


class GeozoneOut(BaseModel):
    id: str
    name: str
    zone_type: str
    is_active: bool
    center_lat: float | None = None
    center_lon: float | None = None
    radius_m: float | None = None
    polygon: dict | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class GeozoneEventOut(BaseModel):
    id: str
    vehicle_id: str
    geozone_id: str
    event_type: str
    lat: float
    lon: float
    occurred_at: datetime

    class Config:
        from_attributes = True
