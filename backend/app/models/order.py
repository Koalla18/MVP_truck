from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text, func

from app.db.base import Base
from app.models.enums import OrderStatus


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String, nullable=False)
    cargo_desc = Column(Text, nullable=True)

    origin = Column(String, nullable=True)
    destination = Column(String, nullable=True)

    planned_depart_at = Column(DateTime(timezone=True), nullable=True)
    planned_arrive_at = Column(DateTime(timezone=True), nullable=True)

    status = Column(Enum(OrderStatus, name="order_status"), nullable=False, default=OrderStatus.new, index=True)

    vehicle_id = Column(String, ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    assigned_driver_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    accepted_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
