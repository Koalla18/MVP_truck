from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True)

    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)

    seq = Column(Integer, nullable=False, index=True)
    prev_hash = Column(String, nullable=True)
    hash = Column(String, nullable=False, unique=True, index=True)

    entity_type = Column(String, nullable=False, index=True)
    entity_id = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False, index=True)

    payload = Column(JSONB, nullable=False, default=dict)

    actor_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
