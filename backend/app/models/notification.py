from __future__ import annotations

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text, func

from app.db.base import Base
from app.models.enums import NotificationLevel


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    level = Column(Enum(NotificationLevel, name="notification_level"), nullable=False, default=NotificationLevel.info)
    title = Column(String, nullable=False)
    detail = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
