from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TelemetryUpdate(BaseModel):
    vehicle_id: str

    # Telemetry
    load_pct: float | None = None
    fuel_pct: float | None = None
    avg_speed: float | None = None
    health_pct: float | None = None

    # Position
    lat: float | None = None
    lon: float | None = None
    speed_kph: float | None = None
    heading: float | None = None
    recorded_at: datetime | None = None


class TelemetryIngestRequest(BaseModel):
    updates: list[TelemetryUpdate]


class TelemetryApiKeyCreateRequest(BaseModel):
    name: str
    rate_limit_per_min: int = 120


class TelemetryApiKeyOut(BaseModel):
    id: str
    name: str
    is_active: bool
    rate_limit_per_min: int
    created_at: datetime | None = None
    last_used_at: datetime | None = None

    class Config:
        from_attributes = True


class TelemetryApiKeyCreated(BaseModel):
    id: str
    name: str
    api_key: str
