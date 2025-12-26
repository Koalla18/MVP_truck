from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.enums import Permission
from app.models.permission import RolePermission, UserPermissionOverride
from app.models.user import User
from app.schemas.permission import SetRolePermissionsRequest, SetUserOverridesRequest
from app.services.audit import write_audit


router = APIRouter()


@router.get("/available", dependencies=[Depends(require_permissions("permissions.manage"))])
def available_permissions():
    return [p.value for p in Permission]


@router.get("/roles", dependencies=[Depends(require_permissions("permissions.manage"))])
def list_role_permissions(db: Session = Depends(get_db)):
    rows = db.query(RolePermission).all()
    out: dict[str, list[str]] = {}
    for r in rows:
        out.setdefault(r.role, []).append(r.permission)
    return out


@router.post("/roles", dependencies=[Depends(require_permissions("permissions.manage"))])
def set_role_permissions(payload: SetRolePermissionsRequest, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    # Replace role permissions completely.
    db.query(RolePermission).filter(RolePermission.role == payload.role).delete(synchronize_session=False)
    for p in payload.permissions:
        db.add(RolePermission(role=payload.role, permission=p))
    write_audit(db, company_id=actor.company_id, entity_type="permission", entity_id=payload.role, action="role_permissions_set", actor_user_id=actor.id, payload={"permissions": payload.permissions})
    db.commit()
    return {"status": "ok", "role": payload.role, "count": len(payload.permissions)}


@router.get("/users/{user_id}", dependencies=[Depends(require_permissions("permissions.manage"))])
def list_user_overrides(user_id: str, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    u = db.get(User, user_id)
    if not u or u.company_id != actor.company_id:
        raise HTTPException(status_code=404, detail="User not found")
    rows = db.query(UserPermissionOverride).filter(UserPermissionOverride.user_id == user_id).all()
    return [{"permission": r.permission, "allowed": r.allowed} for r in rows]


@router.post("/users", dependencies=[Depends(require_permissions("permissions.manage"))])
def set_user_overrides(payload: SetUserOverridesRequest, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    u = db.get(User, payload.user_id)
    if not u or u.company_id != actor.company_id:
        raise HTTPException(status_code=404, detail="User not found")

    db.query(UserPermissionOverride).filter(UserPermissionOverride.user_id == payload.user_id).delete(synchronize_session=False)
    for o in payload.overrides:
        db.add(UserPermissionOverride(user_id=payload.user_id, permission=o.permission, allowed=o.allowed))

    write_audit(db, company_id=actor.company_id, entity_type="permission", entity_id=payload.user_id, action="user_overrides_set", actor_user_id=actor.id, payload={"overrides": [o.model_dump() for o in payload.overrides]})
    db.commit()
    return {"status": "ok", "user_id": payload.user_id, "count": len(payload.overrides)}
