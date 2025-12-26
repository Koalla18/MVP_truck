from sqlalchemy import Column, DateTime, ForeignKey, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import ARRAY

from app.db.base import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    plate = Column(String, unique=True, nullable=False, index=True)
    vin = Column(String, unique=True, nullable=False, index=True)

    series = Column(String, nullable=True)
    tag = Column(String, nullable=True)

    status_main = Column(String, nullable=True)
    status_secondary = Column(ARRAY(String), nullable=False, default=list)

    cargo_desc = Column(String, nullable=True)
    route_code = Column(String, nullable=True)

    origin = Column(String, nullable=True)
    destination = Column(String, nullable=True)

    depart_at = Column(String, nullable=True)
    eta_at = Column(String, nullable=True)

    load_pct = Column(Float, nullable=True)
    fuel_pct = Column(Float, nullable=True)
    tank_l = Column(Integer, nullable=True)

    pallets_capacity = Column(Integer, nullable=True)

    distance_total_km = Column(Float, nullable=True)
    distance_done_km = Column(Float, nullable=True)
    avg_speed = Column(Float, nullable=True)

    health_pct = Column(Float, nullable=True)

    image_url = Column(String, nullable=True)

    driver_profile_id = Column(String, ForeignKey("driver_profiles.id", ondelete="SET NULL"), nullable=True, index=True)

    telemetry_updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
