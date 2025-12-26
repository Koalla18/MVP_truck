from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class IncidentCreate(BaseModel):
    title: str
    description: str | None = None
    severity: str
    related_entity_type: str | None = None
    related_entity_id: str | None = None
    assigned_to_user_id: str | None = None
    sla_due_at: datetime | None = None


class IncidentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    severity: str | None = None
    status: str | None = None
    assigned_to_user_id: str | None = None
    sla_due_at: datetime | None = None


class IncidentOut(BaseModel):
    id: str
    title: str
    description: str | None = None
    severity: str
    status: str
    related_entity_type: str | None = None
    related_entity_id: str | None = None
    created_by_user_id: str | None = None
    assigned_to_user_id: str | None = None
    sla_due_at: datetime | None = None
    escalated_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
