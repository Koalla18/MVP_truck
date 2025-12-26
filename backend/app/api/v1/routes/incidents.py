from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.enums import IncidentSeverity, IncidentStatus
from app.models.incident import Incident
from app.models.user import User
from app.schemas.incident import IncidentCreate, IncidentOut, IncidentUpdate
from app.services.audit import write_audit
from app.services.events import publish_event


router = APIRouter()


@router.get("", response_model=list[IncidentOut], dependencies=[Depends(require_permissions("incidents.read"))])
def list_incidents(db: Session = Depends(get_db), user: User = Depends(get_current_user), limit: int = 200):
    return (
        db.query(Incident)
        .filter(Incident.company_id == user.company_id)
        .order_by(Incident.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("", response_model=IncidentOut, dependencies=[Depends(require_permissions("incidents.write"))])
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        severity = IncidentSeverity(payload.severity)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid severity")

    i = Incident(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        title=payload.title,
        description=payload.description,
        severity=severity,
        status=IncidentStatus.open,
        related_entity_type=payload.related_entity_type,
        related_entity_id=payload.related_entity_id,
        created_by_user_id=user.id,
        assigned_to_user_id=payload.assigned_to_user_id,
        sla_due_at=payload.sla_due_at,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(i)
    write_audit(db, company_id=user.company_id, entity_type="incident", entity_id=i.id, action="create", actor_user_id=user.id, payload=payload.model_dump())
    db.commit()
    db.refresh(i)
    publish_event(user.company_id, {"type": "incident.created", "incident_id": i.id, "severity": i.severity.value})
    return i


@router.patch("/{incident_id}", response_model=IncidentOut, dependencies=[Depends(require_permissions("incidents.write"))])
def update_incident(incident_id: str, payload: IncidentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    i = db.get(Incident, incident_id)
    if not i or i.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Not found")

    data = payload.model_dump(exclude_unset=True)
    if "severity" in data:
        try:
            data["severity"] = IncidentSeverity(data["severity"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid severity")
    if "status" in data:
        try:
            data["status"] = IncidentStatus(data["status"])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid status")

    for k, v in data.items():
        setattr(i, k, v)
    i.updated_at = datetime.now(timezone.utc)

    write_audit(db, company_id=user.company_id, entity_type="incident", entity_id=i.id, action="update", actor_user_id=user.id, payload=payload.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(i)
    publish_event(user.company_id, {"type": "incident.updated", "incident_id": i.id})
    return i


@router.post("/run-escalations", dependencies=[Depends(require_permissions("incidents.escalate"))])
def run_escalations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    q = (
        db.query(Incident)
        .filter(Incident.company_id == user.company_id)
        .filter(Incident.sla_due_at.isnot(None))
        .filter(Incident.escalated_at.is_(None))
        .filter(Incident.sla_due_at <= now)
        .filter(Incident.status.in_([IncidentStatus.open, IncidentStatus.acknowledged, IncidentStatus.in_progress]))
    )
    items = q.all()
    for i in items:
        i.escalated_at = now
        i.updated_at = now
        write_audit(db, company_id=user.company_id, entity_type="incident", entity_id=i.id, action="escalate", actor_user_id=user.id, payload={"sla_due_at": i.sla_due_at.isoformat() if i.sla_due_at else None})
    db.commit()
    if items:
        publish_event(user.company_id, {"type": "incident.escalated", "count": len(items), "at": now.isoformat()})
    return {"status": "ok", "escalated": len(items)}
