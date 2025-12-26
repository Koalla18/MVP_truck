import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_permissions
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserRoleUpdate
from app.services.audit import write_audit

router = APIRouter()


@router.get("", response_model=list[UserOut], dependencies=[Depends(require_permissions("users.read"))])
def list_users(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return db.query(User).filter(User.company_id == actor.company_id).order_by(User.created_at.desc()).all()


@router.post("", response_model=UserOut, dependencies=[Depends(require_permissions("users.write"))])
def create_user(payload: UserCreate, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    from app.models.enums import UserRole

    try:
        role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}")

    u = User(
        id=str(uuid.uuid4()),
        company_id=actor.company_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
        is_active=True,
    )
    db.add(u)
    write_audit(db, company_id=actor.company_id, entity_type="user", entity_id=u.id, action="create", actor_user_id=actor.id, payload={"email": payload.email, "role": role.value})
    db.commit()
    db.refresh(u)
    return u


@router.patch("/{user_id}", response_model=UserOut, dependencies=[Depends(require_permissions("users.write"))])
def update_user(user_id: str, payload: UserRoleUpdate, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.company_id != actor.company_id:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {[r.value for r in UserRole]}")

    u.role = role
    if payload.is_active is not None:
        u.is_active = payload.is_active

    write_audit(db, company_id=actor.company_id, entity_type="user", entity_id=u.id, action="update", actor_user_id=actor.id, payload=payload.model_dump())
    db.commit()
    db.refresh(u)
    return u
