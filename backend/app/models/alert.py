from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text, func

from app.db.base import Base
from app.models.enums import AlertStatus


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_id = Column(String, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    alert_type = Column(String, nullable=True)
    message = Column(Text, nullable=False)

    status = Column(Enum(AlertStatus, name="alert_status"), nullable=False, default=AlertStatus.created)

    delivered_to_driver_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
