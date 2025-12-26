import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.alert import Alert
from app.models.driver import DriverProfile
from app.models.enums import AlertStatus, NotificationLevel, UserRole
from app.models.notification import Notification
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.alert import AlertCreate, AlertOut
from app.services.audit import write_audit
from app.services.events import publish_event

router = APIRouter()


@router.post("/vehicle/{vehicle_id}", response_model=AlertOut, dependencies=[Depends(require_permissions("alerts.write"))])
def create_alert(vehicle_id: str, payload: AlertCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    v = db.get(Vehicle, vehicle_id)
    if not v or v.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    a = Alert(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        vehicle_id=vehicle_id,
        created_by_user_id=user.id,
        alert_type=payload.alert_type,
        message=payload.message,
        status=AlertStatus.created,
    )
    db.add(a)
    write_audit(db, company_id=user.company_id, entity_type="alert", entity_id=a.id, action="create", actor_user_id=user.id, payload=payload.model_dump() | {"vehicle_id": vehicle_id})
    db.commit()
    db.refresh(a)

    # Notify assigned driver (if any)
    if v.driver_profile_id:
        dp = db.get(DriverProfile, v.driver_profile_id)
        if dp and dp.company_id == user.company_id and dp.user_id:
            n = Notification(
                id=str(uuid.uuid4()),
                company_id=user.company_id,
                user_id=dp.user_id,
                level=NotificationLevel.critical,
                title=f"Тревога по ТС {v.plate}",
                detail=payload.message,
            )
            db.add(n)
            db.commit()
            publish_event(user.company_id, {"type": "notification.created", "user_id": dp.user_id, "level": n.level.value, "title": n.title})

    publish_event(user.company_id, {"type": "alert.created", "alert_id": a.id, "vehicle_id": a.vehicle_id})
    return a


@router.get("", response_model=list[AlertOut], dependencies=[Depends(require_permissions("alerts.read"))])
def list_alerts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Alert).filter(Alert.company_id == user.company_id)
    if UserRole(user.role) == UserRole.driver:
        dp = db.query(DriverProfile).filter(DriverProfile.user_id == user.id, DriverProfile.company_id == user.company_id).first()
        if not dp:
            return []
        vehicle_ids = [v.id for v in db.query(Vehicle.id).filter(Vehicle.company_id == user.company_id, Vehicle.driver_profile_id == dp.id).all()]
        if not vehicle_ids:
            return []
        q = q.filter(Alert.vehicle_id.in_(vehicle_ids))
    return q.order_by(Alert.created_at.desc()).all()


@router.get("/active", response_model=list[AlertOut], dependencies=[Depends(require_permissions("alerts.read"))])
def list_active_alerts_for_driver(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if UserRole(user.role) != UserRole.driver:
        raise HTTPException(status_code=403, detail="Only drivers can access this endpoint")
    dp = db.query(DriverProfile).filter(DriverProfile.user_id == user.id, DriverProfile.company_id == user.company_id).first()
    if not dp:
        return []
    vehicle_ids = [v.id for v in db.query(Vehicle.id).filter(Vehicle.company_id == user.company_id, Vehicle.driver_profile_id == dp.id).all()]
    if not vehicle_ids:
        return []
    return (
        db.query(Alert)
        .filter(Alert.company_id == user.company_id)
        .filter(Alert.vehicle_id.in_(vehicle_ids))
        .filter(Alert.status.in_([AlertStatus.created, AlertStatus.delivered]))
        .order_by(Alert.created_at.desc())
        .all()
    )


@router.post("/{alert_id}/ack", response_model=AlertOut, dependencies=[Depends(require_permissions("alerts.ack"))])
def ack_alert(alert_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(Alert, alert_id)
    if not a or a.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Прототип: подтверждение водителем, без сложной проверки назначения.
    a.status = AlertStatus.acknowledged
    a.acknowledged_at = datetime.now(timezone.utc)

    write_audit(db, company_id=user.company_id, entity_type="alert", entity_id=a.id, action="ack", actor_user_id=user.id, payload={})
    db.commit()
    db.refresh(a)
    publish_event(user.company_id, {"type": "alert.acknowledged", "alert_id": a.id, "vehicle_id": a.vehicle_id})
    return a
