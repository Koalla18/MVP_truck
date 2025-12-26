from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Float, Integer, String, func

from app.db.base import Base


class TelemetryApiKey(Base):
    __tablename__ = "telemetry_api_keys"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    key_hash = Column(String, nullable=False, unique=True, index=True)

    is_active = Column(Boolean, nullable=False, default=True)
    rate_limit_per_min = Column(Integer, nullable=False, default=120)

    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class VehiclePosition(Base):
    __tablename__ = "vehicle_positions"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_id = Column(String, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)

    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    speed_kph = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)

    recorded_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
