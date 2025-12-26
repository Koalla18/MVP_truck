from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.audit import AuditEvent
from app.models.user import User
from app.services.audit_chain import verify_audit_chain

router = APIRouter()


@router.get("", dependencies=[Depends(require_permissions("audit.read"))])
def list_audit(db: Session = Depends(get_db), limit: int = 200, user: User = Depends(get_current_user)):
    rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.company_id == user.company_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "company_id": r.company_id,
            "seq": r.seq,
            "hash": r.hash,
            "prev_hash": r.prev_hash,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "action": r.action,
            "actor_user_id": r.actor_user_id,
            "payload": r.payload,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/verify", dependencies=[Depends(require_permissions("audit.read"))])
def verify(db: Session = Depends(get_db), limit: int = 2000, user: User = Depends(get_current_user)):
    return verify_audit_chain(db, company_id=user.company_id, limit=limit)
