from __future__ import annotations

from functools import lru_cache
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.enums import Permission, UserRole
from app.models.permission import RolePermission, UserPermissionOverride
from app.models.user import User


@lru_cache(maxsize=32)
def default_role_permissions() -> dict[UserRole, set[str]]:
    all_perms = {p.value for p in Permission}
    return {
        UserRole.owner: set(all_perms),
        UserRole.admin: {
            Permission.users_read.value,
            Permission.vehicles_read.value,
            Permission.vehicles_write.value,
            Permission.orders_read.value,
            Permission.orders_write.value,
            Permission.orders_assign.value,
            Permission.orders_transition.value,
            Permission.alerts_read.value,
            Permission.alerts_write.value,
            Permission.audit_read.value,
            Permission.geozones_read.value,
            Permission.geozones_write.value,
            Permission.notifications_read.value,
            Permission.notifications_write.value,
            Permission.incidents_read.value,
            Permission.incidents_write.value,
            Permission.incidents_escalate.value,
        },
        UserRole.driver: {
            Permission.vehicles_read.value,
            Permission.orders_read.value,
            Permission.orders_transition.value,
            Permission.alerts_read.value,
            Permission.alerts_ack.value,
            Permission.notifications_read.value,
        },
    }


def get_effective_permissions(db: Session, user: User) -> set[str]:
    role = UserRole(user.role)
    perms = set(default_role_permissions().get(role, set()))

    # DB role permissions extend defaults (lets you change without redeploy)
    role_rows = db.query(RolePermission).filter(RolePermission.role == role.value).all()
    perms.update(r.permission for r in role_rows)

    # User overrides can explicitly allow/deny
    overrides = db.query(UserPermissionOverride).filter(UserPermissionOverride.user_id == user.id).all()
    for o in overrides:
        if o.allowed:
            perms.add(o.permission)
        else:
            perms.discard(o.permission)
    return perms


def require_all(required: Iterable[str], effective: set[str]) -> bool:
    return all(p in effective for p in required)
