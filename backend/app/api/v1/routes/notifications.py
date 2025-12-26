from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationMarkReadRequest, NotificationOut


router = APIRouter()


@router.get("", response_model=list[NotificationOut], dependencies=[Depends(require_permissions("notifications.read"))])
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user), limit: int = 200):
    return (
        db.query(Notification)
        .filter(Notification.company_id == user.company_id, Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/read", dependencies=[Depends(require_permissions("notifications.read"))])
def mark_read(payload: NotificationMarkReadRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    q = (
        db.query(Notification)
        .filter(Notification.company_id == user.company_id, Notification.user_id == user.id)
        .filter(Notification.id.in_(payload.ids))
    )
    count = 0
    for n in q.all():
        if n.read_at is None:
            n.read_at = now
            count += 1
    db.commit()
    return {"status": "ok", "updated": count}
