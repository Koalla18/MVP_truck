import enum


class UserRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    dispatcher = "dispatcher"
    logist = "logist"


class GeozoneType(str, enum.Enum):
    circle = "circle"
    polygon = "polygon"


class GeozoneEventType(str, enum.Enum):
    enter = "enter"
    exit = "exit"


class AlertStatus(str, enum.Enum):
    created = "created"
    delivered = "delivered"
    acknowledged = "acknowledged"
    closed = "closed"


class OrderStatus(str, enum.Enum):
    new = "new"
    assigned = "assigned"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class NotificationLevel(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class IncidentSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentStatus(str, enum.Enum):
    open = "open"
    acknowledged = "acknowledged"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class Permission(str, enum.Enum):
    # Admin console / security
    permissions_manage = "permissions.manage"
    users_read = "users.read"
    users_write = "users.write"

    # Core domains
    vehicles_read = "vehicles.read"
    vehicles_write = "vehicles.write"
    orders_read = "orders.read"
    orders_write = "orders.write"
    orders_assign = "orders.assign"
    orders_transition = "orders.transition"

    alerts_read = "alerts.read"
    alerts_write = "alerts.write"
    alerts_ack = "alerts.ack"

    audit_read = "audit.read"

    # Ops domains
    geozones_read = "geozones.read"
    geozones_write = "geozones.write"

    notifications_read = "notifications.read"
    notifications_write = "notifications.write"

    incidents_read = "incidents.read"
    incidents_write = "incidents.write"
    incidents_escalate = "incidents.escalate"
