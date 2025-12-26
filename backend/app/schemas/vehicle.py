from datetime import datetime

from pydantic import BaseModel


class VehicleCreate(BaseModel):
    name: str
    plate: str
    vin: str
    series: str | None = None
    tag: str | None = None
    cargo_desc: str | None = None
    route_code: str | None = None
    origin: str | None = None
    destination: str | None = None
    depart_at: str | None = None
    eta_at: str | None = None
    load_pct: float | None = None
    fuel_pct: float | None = None
    tank_l: int | None = None
    pallets_capacity: int | None = None
    distance_total_km: float | None = None
    distance_done_km: float | None = None
    avg_speed: float | None = None
    health_pct: float | None = None
    image_url: str | None = None
    driver_profile_id: str | None = None


class VehicleUpdate(BaseModel):
    name: str | None = None
    series: str | None = None
    tag: str | None = None
    status_main: str | None = None
    status_secondary: list[str] | None = None
    cargo_desc: str | None = None
    route_code: str | None = None
    origin: str | None = None
    destination: str | None = None
    depart_at: str | None = None
    eta_at: str | None = None
    load_pct: float | None = None
    fuel_pct: float | None = None
    tank_l: int | None = None
    pallets_capacity: int | None = None
    distance_total_km: float | None = None
    distance_done_km: float | None = None
    avg_speed: float | None = None
    health_pct: float | None = None
    image_url: str | None = None
    driver_profile_id: str | None = None


class VehicleOut(BaseModel):
    id: str
    name: str
    plate: str
    vin: str
    series: str | None = None
    tag: str | None = None
    status_main: str | None = None
    status_secondary: list[str] = []
    cargo_desc: str | None = None
    route_code: str | None = None
    origin: str | None = None
    destination: str | None = None
    depart_at: str | None = None
    eta_at: str | None = None
    load_pct: float | None = None
    fuel_pct: float | None = None
    tank_l: int | None = None
    pallets_capacity: int | None = None
    distance_total_km: float | None = None
    distance_done_km: float | None = None
    avg_speed: float | None = None
    health_pct: float | None = None
    image_url: str | None = None
    driver_profile_id: str | None = None
    telemetry_updated_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True
