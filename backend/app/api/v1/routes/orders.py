import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.enums import OrderStatus, UserRole
from app.models.order import Order
from app.models.user import User
from app.schemas.order import OrderCreate, OrderOut, OrderAssign, OrderTransition
from app.services.audit import write_audit

router = APIRouter()


@router.get("", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Order).filter(Order.company_id == user.company_id)
    if UserRole(user.role) == UserRole.driver:
        q = q.filter((Order.assigned_driver_user_id == user.id) | (Order.accepted_by_user_id == user.id))
    return q.order_by(Order.created_at.desc()).all()


@router.post("", response_model=OrderOut, dependencies=[Depends(require_permissions("orders.write"))])
def create_order(payload: OrderCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    o = Order(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        title=payload.title,
        cargo_desc=payload.cargo_desc,
        origin=payload.origin,
        destination=payload.destination,
        planned_depart_at=payload.planned_depart_at,
        planned_arrive_at=payload.planned_arrive_at,
        vehicle_id=payload.vehicle_id,
        created_by_user_id=user.id,
        assigned_driver_user_id=payload.assigned_driver_user_id,
        status=OrderStatus.assigned if payload.assigned_driver_user_id else OrderStatus.new,
    )
    db.add(o)
    write_audit(db, company_id=user.company_id, entity_type="order", entity_id=o.id, action="create", actor_user_id=user.id, payload=payload.model_dump())
    db.commit()
    db.refresh(o)
    return o


@router.post("/{order_id}/assign", response_model=OrderOut, dependencies=[Depends(require_permissions("orders.assign"))])
def assign_order(order_id: str, payload: OrderAssign, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    o = db.get(Order, order_id)
    if not o or o.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.status in [OrderStatus.completed, OrderStatus.cancelled]:
        raise HTTPException(status_code=409, detail="Order cannot be assigned")

    o.vehicle_id = payload.vehicle_id
    o.assigned_driver_user_id = payload.assigned_driver_user_id
    o.status = OrderStatus.assigned

    write_audit(db, company_id=user.company_id, entity_type="order", entity_id=o.id, action="assign", actor_user_id=user.id, payload=payload.model_dump())
    db.commit()
    db.refresh(o)
    return o


@router.post("/{order_id}/accept", response_model=OrderOut, dependencies=[Depends(require_permissions("orders.transition"))])
def accept_order(order_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    o = db.get(Order, order_id)
    if not o or o.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Order not found")

    if o.status not in [OrderStatus.new, OrderStatus.assigned]:
        raise HTTPException(status_code=409, detail="Order cannot be accepted")

    if o.assigned_driver_user_id and o.assigned_driver_user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if o.accepted_by_user_id and o.accepted_by_user_id != user.id:
        raise HTTPException(status_code=409, detail="Order already accepted")

    o.accepted_by_user_id = user.id
    o.accepted_at = datetime.now(timezone.utc)
    o.status = OrderStatus.accepted

    write_audit(db, company_id=user.company_id, entity_type="order", entity_id=o.id, action="accept", actor_user_id=user.id, payload={})
    db.commit()
    db.refresh(o)
    return o


@router.post("/{order_id}/start", response_model=OrderOut, dependencies=[Depends(require_permissions("orders.transition"))])
def start_order(order_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    o = db.get(Order, order_id)
    if not o or o.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if UserRole(user.role) == UserRole.driver:
        if o.accepted_by_user_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
    if o.status != OrderStatus.accepted:
        raise HTTPException(status_code=409, detail="Order cannot be started")
    o.status = OrderStatus.in_progress
    write_audit(db, company_id=user.company_id, entity_type="order", entity_id=o.id, action="start", actor_user_id=user.id, payload={})
    db.commit()
    db.refresh(o)
    return o


@router.post("/{order_id}/complete", response_model=OrderOut, dependencies=[Depends(require_permissions("orders.transition"))])
def complete_order(order_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    o = db.get(Order, order_id)
    if not o or o.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if UserRole(user.role) == UserRole.driver:
        if o.accepted_by_user_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
    if o.status != OrderStatus.in_progress:
        raise HTTPException(status_code=409, detail="Order cannot be completed")
    o.status = OrderStatus.completed
    write_audit(db, company_id=user.company_id, entity_type="order", entity_id=o.id, action="complete", actor_user_id=user.id, payload={})
    db.commit()
    db.refresh(o)
    return o


@router.post("/{order_id}/cancel", response_model=OrderOut, dependencies=[Depends(require_permissions("orders.transition"))])
def cancel_order(order_id: str, payload: OrderTransition, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    o = db.get(Order, order_id)
    if not o or o.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if o.status in [OrderStatus.completed, OrderStatus.cancelled]:
        raise HTTPException(status_code=409, detail="Order cannot be cancelled")
    o.status = OrderStatus.cancelled
    write_audit(db, company_id=user.company_id, entity_type="order", entity_id=o.id, action="cancel", actor_user_id=user.id, payload=payload.model_dump())
    db.commit()
    db.refresh(o)
    return o
