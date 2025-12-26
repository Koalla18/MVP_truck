from __future__ import annotations

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, Text, func

from app.db.base import Base
from app.models.enums import IncidentSeverity, IncidentStatus


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(Enum(IncidentSeverity, name="incident_severity"), nullable=False, index=True)
    status = Column(Enum(IncidentStatus, name="incident_status"), nullable=False, index=True)

    related_entity_type = Column(String, nullable=True, index=True)
    related_entity_id = Column(String, nullable=True, index=True)

    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_to_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    sla_due_at = Column(DateTime(timezone=True), nullable=True, index=True)
    escalated_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
