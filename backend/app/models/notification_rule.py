"""Notification Rules model for alert routing."""

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func

from app.db.base import Base


class NotificationRule(Base):
    """Rule for routing notifications/alerts to specific channels."""
    __tablename__ = "notification_rules"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Trigger conditions (JSON)
    # Example: {"alert_types": ["maintenance_critical", "fuel_low"], "severity": ["high", "critical"]}
    conditions = Column(JSON, nullable=False, default=dict)
    
    # Channels to notify
    # Example: {"email": ["admin@example.com"], "sms": ["+79001234567"], "webhook": ["https://..."]}
    channels = Column(JSON, nullable=False, default=dict)
    
    # Escalation settings
    escalation_delay_minutes = Column(Integer, nullable=True)  # Escalate if not acknowledged within X minutes
    escalation_channels = Column(JSON, nullable=True)  # Channels for escalation
    
    # Stats
    triggered_count = Column(Integer, nullable=False, default=0)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class NotificationDelivery(Base):
    """Log of notification deliveries."""
    __tablename__ = "notification_deliveries"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    rule_id = Column(String, ForeignKey("notification_rules.id", ondelete="SET NULL"), nullable=True, index=True)
    alert_id = Column(String, ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True, index=True)
    
    channel = Column(String, nullable=False)  # email, sms, webhook, push
    recipient = Column(String, nullable=False)  # email address, phone, url
    
    status = Column(String, nullable=False, default="pending")  # pending, sent, failed, delivered
    error_message = Column(Text, nullable=True)
    
    # Response from provider
    provider_response = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
