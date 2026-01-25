from __future__ import annotations

from sqlalchemy import JSON, Boolean, Column, DateTime, Enum, ForeignKey, Float, String, func

try:
    from sqlalchemy.dialects.postgresql import JSONB  # type: ignore
except Exception:  # pragma: no cover
    JSONB = None

from app.core.settings import settings
from app.db.base import Base
from app.models.enums import GeozoneEventType, GeozoneType


_JSON_TYPE = JSONB if (JSONB is not None and settings.database_url.startswith("postgres")) else JSON


class Geozone(Base):
    __tablename__ = "geozones"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    zone_type = Column(Enum(GeozoneType, name="geozone_type"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    center_lat = Column(Float, nullable=True)
    center_lon = Column(Float, nullable=True)
    radius_m = Column(Float, nullable=True)

    polygon = Column(_JSON_TYPE, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class VehicleGeozoneState(Base):
    __tablename__ = "vehicle_geozone_states"

    vehicle_id = Column(String, ForeignKey("vehicles.id", ondelete="CASCADE"), primary_key=True)
    geozone_id = Column(String, ForeignKey("geozones.id", ondelete="CASCADE"), primary_key=True)
    is_inside = Column(Boolean, nullable=False)
    last_changed_at = Column(DateTime(timezone=True), nullable=False)


class GeozoneEvent(Base):
    __tablename__ = "geozone_events"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)

    vehicle_id = Column(String, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    geozone_id = Column(String, ForeignKey("geozones.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(Enum(GeozoneEventType, name="geozone_event_type"), nullable=False, index=True)

    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
