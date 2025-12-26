from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent


def _stable_json(payload: dict[str, Any] | None) -> str:
    return json.dumps(payload or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def compute_audit_hash(
    *,
    company_id: str,
    seq: int,
    entity_type: str,
    entity_id: str,
    action: str,
    actor_user_id: str | None,
    created_at: datetime,
    payload: dict[str, Any] | None,
    prev_hash: str | None,
) -> str:
    base = "|".join(
        [
            company_id,
            str(seq),
            entity_type,
            entity_id,
            action,
            actor_user_id or "",
            created_at.astimezone(timezone.utc).isoformat(),
            _stable_json(payload),
            prev_hash or "",
        ]
    )
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def append_audit_event(
    db: Session,
    *,
    company_id: str,
    entity_type: str,
    entity_id: str,
    action: str,
    actor_user_id: str | None,
    payload: dict[str, Any] | None,
) -> AuditEvent:
    last = (
        db.query(AuditEvent)
        .filter(AuditEvent.company_id == company_id)
        .order_by(desc(AuditEvent.seq))
        .limit(1)
        .one_or_none()
    )
    seq = (last.seq + 1) if last else 1
    prev_hash = last.hash if last else None
    created_at = datetime.now(timezone.utc)
    h = compute_audit_hash(
        company_id=company_id,
        seq=seq,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_user_id=actor_user_id,
        created_at=created_at,
        payload=payload,
        prev_hash=prev_hash,
    )
    evt = AuditEvent(
        id=str(uuid.uuid4()),
        company_id=company_id,
        seq=seq,
        prev_hash=prev_hash,
        hash=h,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_user_id=actor_user_id,
        payload=payload or {},
        created_at=created_at,
    )
    db.add(evt)
    return evt


def verify_audit_chain(db: Session, *, company_id: str, limit: int = 2000) -> dict[str, Any]:
    rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.company_id == company_id)
        .order_by(AuditEvent.seq.asc())
        .limit(limit)
        .all()
    )
    prev = None
    for r in rows:
        expected = compute_audit_hash(
            company_id=company_id,
            seq=r.seq,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            action=r.action,
            actor_user_id=r.actor_user_id,
            created_at=r.created_at,
            payload=r.payload,
            prev_hash=prev,
        )
        if r.prev_hash != prev or r.hash != expected:
            return {
                "ok": False,
                "broken_at_seq": r.seq,
                "event_id": r.id,
                "expected_hash": expected,
                "actual_hash": r.hash,
                "expected_prev_hash": prev,
                "actual_prev_hash": r.prev_hash,
            }
        prev = r.hash
    return {"ok": True, "checked": len(rows), "last_hash": prev}
