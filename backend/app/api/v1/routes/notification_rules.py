"""Notification Rules API routes."""

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.notification_rule import NotificationRule, NotificationDelivery
from app.models.user import User
from app.services.audit import record_event

router = APIRouter()


class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    conditions: dict[str, Any] = Field(default_factory=dict)
    channels: dict[str, list[str]] = Field(default_factory=dict)
    escalation_delay_minutes: Optional[int] = None
    escalation_channels: Optional[dict[str, list[str]]] = None


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    conditions: Optional[dict[str, Any]] = None
    channels: Optional[dict[str, list[str]]] = None
    escalation_delay_minutes: Optional[int] = None
    escalation_channels: Optional[dict[str, list[str]]] = None


class RuleResponse(BaseModel):
    id: str
    company_id: str
    name: str
    description: Optional[str]
    is_active: bool
    conditions: dict
    channels: dict
    escalation_delay_minutes: Optional[int]
    escalation_channels: Optional[dict]
    triggered_count: int
    last_triggered_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeliveryResponse(BaseModel):
    id: str
    rule_id: Optional[str]
    alert_id: Optional[str]
    channel: str
    recipient: str
    status: str
    error_message: Optional[str]
    created_at: datetime
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]

    class Config:
        from_attributes = True


class TestDeliveryRequest(BaseModel):
    channel: str
    recipient: str
    message: str = "Test notification from RoutoX"


@router.post("", response_model=RuleResponse)
def create_rule(
    payload: RuleCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new notification rule."""
    
    rule = NotificationRule(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        created_by_user_id=user.id,
        name=payload.name,
        description=payload.description,
        is_active=payload.is_active,
        conditions=payload.conditions,
        channels=payload.channels,
        escalation_delay_minutes=payload.escalation_delay_minutes,
        escalation_channels=payload.escalation_channels
    )
    
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    record_event(db, "notification_rule", rule.id, "created", {
        "name": payload.name,
        "channels": list(payload.channels.keys())
    }, user.id)
    
    return rule


@router.get("", response_model=list[RuleResponse])
def list_rules(
    is_active: Optional[bool] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all notification rules."""
    
    query = db.query(NotificationRule).filter(
        NotificationRule.company_id == user.company_id
    )
    
    if is_active is not None:
        query = query.filter(NotificationRule.is_active == is_active)
    
    rules = query.order_by(desc(NotificationRule.created_at)).all()
    return rules


@router.get("/{rule_id}", response_model=RuleResponse)
def get_rule(
    rule_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific rule."""
    
    rule = db.query(NotificationRule).filter(
        NotificationRule.id == rule_id,
        NotificationRule.company_id == user.company_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    return rule


@router.put("/{rule_id}", response_model=RuleResponse)
def update_rule(
    rule_id: str,
    payload: RuleUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a notification rule."""
    
    rule = db.query(NotificationRule).filter(
        NotificationRule.id == rule_id,
        NotificationRule.company_id == user.company_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    
    db.commit()
    db.refresh(rule)
    
    record_event(db, "notification_rule", rule.id, "updated", update_data, user.id)
    
    return rule


@router.delete("/{rule_id}")
def delete_rule(
    rule_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a notification rule."""
    
    rule = db.query(NotificationRule).filter(
        NotificationRule.id == rule_id,
        NotificationRule.company_id == user.company_id
    ).first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    db.delete(rule)
    db.commit()
    
    record_event(db, "notification_rule", rule_id, "deleted", {}, user.id)
    
    return {"status": "deleted"}


@router.get("/deliveries/log", response_model=list[DeliveryResponse])
def list_deliveries(
    rule_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List notification delivery logs."""
    
    query = db.query(NotificationDelivery).filter(
        NotificationDelivery.company_id == user.company_id
    )
    
    if rule_id:
        query = query.filter(NotificationDelivery.rule_id == rule_id)
    if status:
        query = query.filter(NotificationDelivery.status == status)
    
    deliveries = query.order_by(desc(NotificationDelivery.created_at)).limit(limit).all()
    return deliveries


@router.post("/test")
def test_delivery(
    payload: TestDeliveryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a test notification to verify channel configuration."""
    
    # Create delivery record
    delivery = NotificationDelivery(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        channel=payload.channel,
        recipient=payload.recipient,
        status="pending"
    )
    db.add(delivery)
    
    # Simulate sending based on channel
    now = datetime.now(timezone.utc)
    
    if payload.channel == "email":
        # In demo mode, just mark as sent
        delivery.status = "sent"
        delivery.sent_at = now
        delivery.provider_response = {"demo": True, "message": "Email simulated"}
    elif payload.channel == "sms":
        delivery.status = "sent"
        delivery.sent_at = now
        delivery.provider_response = {"demo": True, "message": "SMS simulated"}
    elif payload.channel == "webhook":
        # Could actually call the webhook in real implementation
        delivery.status = "sent"
        delivery.sent_at = now
        delivery.provider_response = {"demo": True, "message": "Webhook simulated"}
    elif payload.channel == "push":
        delivery.status = "sent"
        delivery.sent_at = now
        delivery.provider_response = {"demo": True, "message": "Push simulated"}
    else:
        delivery.status = "failed"
        delivery.error_message = f"Unknown channel: {payload.channel}"
    
    db.commit()
    
    return {
        "status": delivery.status,
        "delivery_id": delivery.id,
        "message": f"Test {payload.channel} notification {'sent' if delivery.status == 'sent' else 'failed'}"
    }
