from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.services.audit_chain import append_audit_event


def write_audit(
    db: Session,
    *,
    company_id: str,
    entity_type: str,
    entity_id: str,
    action: str,
    actor_user_id: str | None,
    payload: dict[str, Any],
):
    append_audit_event(
        db,
        company_id=company_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_user_id=actor_user_id,
        payload=payload or {},
    )


def record_event(
    db: Session,
    entity_type: str,
    entity_id: str,
    action: str,
    payload: dict[str, Any] = None,
    actor_user_id: str = None,
    company_id: str = "default",
):
    """Convenience wrapper for audit logging"""
    write_audit(
        db,
        company_id=company_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_user_id=actor_user_id,
        payload=payload or {},
    )
