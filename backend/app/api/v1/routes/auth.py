import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token_v2, hash_password, verify_password
from app.core.utils import slugify
from app.db.session import get_db
from app.models.company import Company
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, MeResponse, TokenResponse
from app.api.v1.deps import get_current_user

router = APIRouter()


@router.post("/register", response_model=MeResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Self-serve регистрация: создаёт компанию + первого owner.

    Для production обычно закрывают за invite/checkout, но для MVP это удобный вход.
    """
    # Пользователь по email должен быть уникальным.
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this email already exists")

    company_name = (payload.company_name or "RoutoX Company").strip()
    company_slug = slugify(payload.company_slug or company_name)
    exists_company = db.query(Company).filter(Company.slug == company_slug).first()
    if exists_company:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Company slug already exists")

    c = Company(id=str(uuid.uuid4()), name=company_name, slug=company_slug)
    db.add(c)

    # Первый пользователь в компании всегда owner.
    user = User(
        id=str(uuid.uuid4()),
        company_id=c.id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.owner,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return MeResponse(id=user.id, email=user.email, role=user.role.value, company_id=user.company_id)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad credentials")
    token = create_access_token_v2(subject=user.id, role=user.role.value, company_id=user.company_id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    return MeResponse(id=user.id, email=user.email, role=user.role.value, company_id=user.company_id)


@router.post("/bootstrap-owner", response_model=MeResponse)
def bootstrap_owner(email: str, password: str, db: Session = Depends(get_db)):
    """Прототип: создаёт первого owner, если users пустая.

    В проде удалить/закрыть.
    """
    exists = db.query(User).limit(1).first()
    if exists:
        raise HTTPException(status_code=400, detail="Already initialized")

    c = Company(id=str(uuid.uuid4()), name="Default Company", slug="default")
    db.add(c)

    user = User(id=str(uuid.uuid4()), company_id=c.id, email=email, password_hash=hash_password(password), role=UserRole.owner, is_active=True)
    db.add(user)
    db.commit()
    return MeResponse(id=user.id, email=user.email, role=user.role.value, company_id=user.company_id)
