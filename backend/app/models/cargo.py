"""Cargo Plan model for storing trailer load configurations."""

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, String, func

from app.db.base import Base


class CargoPlan(Base):
    __tablename__ = "cargo_plans"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_id = Column(String, ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    name = Column(String, nullable=True)  # Optional plan name
    
    # Grid data stored as JSON
    grid = Column(JSON, nullable=False, default=list)
    merged_cells = Column(JSON, nullable=False, default=dict)
    
    # Computed stats
    total_weight = Column(Float, nullable=False, default=0.0)
    load_percent = Column(Float, nullable=False, default=0.0)
    is_valid = Column(Boolean, nullable=False, default=True)
    
    # Validation results
    validation_errors = Column(JSON, nullable=True)
    validation_warnings = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
