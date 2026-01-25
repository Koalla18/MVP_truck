import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token_v2, 
    create_refresh_token,
    verify_refresh_token,
    create_password_reset_token,
    verify_password_reset_token,
    hash_password, 
    verify_password
)
from app.core.utils import slugify
from app.core.settings import settings
from app.db.session import get_db
from app.models.company import Company
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    LoginRequest, 
    RegisterRequest, 
    MeResponse, 
    TokenResponse,
    RefreshTokenRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    PasswordResetResponse,
    PasswordChangeRequest
)
from app.api.v1.deps import get_current_user
from app.services.audit import record_event

router = APIRouter()


# ============================================================================
# RATE LIMITING (простая in-memory реализация)
# ============================================================================

_rate_limit_store: dict[str, list[float]] = {}

def check_rate_limit(request: Request, limit: int = 10, window: int = 60):
    """Простой rate limiter по IP"""
    client_ip = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc).timestamp()
    
    # Очистка старых записей
    if client_ip in _rate_limit_store:
        _rate_limit_store[client_ip] = [
            ts for ts in _rate_limit_store[client_ip] 
            if now - ts < window
        ]
    else:
        _rate_limit_store[client_ip] = []
    
    # Проверка лимита
    if len(_rate_limit_store[client_ip]) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много запросов. Попробуйте позже."
        )
    
    _rate_limit_store[client_ip].append(now)


# ============================================================================
# REGISTRATION
# ============================================================================

@router.post("/register", response_model=MeResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Self-serve регистрация: создаёт компанию + первого owner."""
    
    # Проверка существующего пользователя
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, 
            detail="Пользователь с таким email уже существует"
        )

    company_name = (payload.company_name or "RoutoX Company").strip()
    company_slug = slugify(payload.company_slug or company_name)
    exists_company = db.query(Company).filter(Company.slug == company_slug).first()
    if exists_company:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, 
            detail="Компания с таким slug уже существует"
        )

    c = Company(id=str(uuid.uuid4()), name=company_name, slug=company_slug)
    db.add(c)

    # Первый пользователь в компании всегда owner
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
    
    # Аудит
    record_event(db, "user", user.id, "registered", {"email": user.email, "role": "owner"}, user.id)
    
    return MeResponse(id=user.id, email=user.email, role=user.role.value, company_id=user.company_id)


# ============================================================================
# LOGIN
# ============================================================================

@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Авторизация с выдачей access + refresh токенов"""
    
    # Rate limiting для защиты от брутфорса
    check_rate_limit(request, limit=10, window=60)
    
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Неверный email или пароль"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован"
        )
    
    access_token = create_access_token_v2(
        subject=user.id, 
        role=user.role.value, 
        company_id=user.company_id
    )
    refresh_token = create_refresh_token(
        subject=user.id,
        company_id=user.company_id
    )
    
    # Аудит входа
    record_event(
        db, "user", user.id, "login", 
        {"ip": request.client.host if request.client else "unknown"},
        user.id
    )
    
    return TokenResponse(
        access_token=access_token, 
        refresh_token=refresh_token,
        expires_in=settings.jwt_expires_min * 60
    )


# ============================================================================
# REFRESH TOKEN
# ============================================================================

@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Обновление access токена по refresh токену"""
    
    token_data = verify_refresh_token(payload.refresh_token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный refresh токен"
        )
    
    user = db.query(User).filter(User.id == token_data["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или деактивирован"
        )
    
    # Создаём новую пару токенов
    new_access_token = create_access_token_v2(
        subject=user.id,
        role=user.role.value,
        company_id=user.company_id
    )
    new_refresh_token = create_refresh_token(
        subject=user.id,
        company_id=user.company_id
    )
    
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.jwt_expires_min * 60
    )


# ============================================================================
# CURRENT USER
# ============================================================================

@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)):
    """Получение данных текущего пользователя"""
    return MeResponse(
        id=user.id, 
        email=user.email, 
        role=user.role.value, 
        company_id=user.company_id
    )


# ============================================================================
# PASSWORD RESET
# ============================================================================

@router.post("/password-reset/request", response_model=PasswordResetResponse)
def request_password_reset(
    payload: PasswordResetRequest, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Запрос на сброс пароля (отправляет email)"""
    
    # Rate limiting
    check_rate_limit(request, limit=5, window=300)  # 5 запросов за 5 минут
    
    user = db.query(User).filter(User.email == payload.email).first()
    
    # Всегда возвращаем успех, чтобы не раскрывать существование email
    if not user:
        return PasswordResetResponse(
            message="Если email существует, инструкции отправлены на почту"
        )
    
    # Создание токена
    reset_token = create_password_reset_token(user.id, user.email)
    
    # TODO: Отправка email
    # В dev режиме просто логируем
    if settings.debug:
        print(f"[DEBUG] Password reset token for {user.email}: {reset_token}")
    
    # В продакшене здесь будет отправка email через SMTP
    # send_password_reset_email(user.email, reset_token)
    
    # Аудит
    record_event(
        db, "user", user.id, "password_reset_requested",
        {"ip": request.client.host if request.client else "unknown"},
        None
    )
    
    return PasswordResetResponse(
        message="Если email существует, инструкции отправлены на почту"
    )


@router.post("/password-reset/confirm", response_model=PasswordResetResponse)
def confirm_password_reset(
    payload: PasswordResetConfirm,
    request: Request,
    db: Session = Depends(get_db)
):
    """Подтверждение сброса пароля"""
    
    # Rate limiting
    check_rate_limit(request, limit=5, window=300)
    
    token_data = verify_password_reset_token(payload.token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недействительный или просроченный токен"
        )
    
    user = db.query(User).filter(User.id == token_data["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь не найден"
        )
    
    # Обновление пароля
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    
    # Аудит
    record_event(db, "user", user.id, "password_reset_completed", {}, user.id)
    
    return PasswordResetResponse(
        message="Пароль успешно изменён",
        success=True
    )


# ============================================================================
# PASSWORD CHANGE (для авторизованного пользователя)
# ============================================================================

@router.post("/password-change", response_model=PasswordResetResponse)
def change_password(
    payload: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Смена пароля авторизованным пользователем"""
    
    # Проверка текущего пароля
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль"
        )
    
    # Проверка что новый пароль отличается
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен отличаться от текущего"
        )
    
    # Обновление пароля
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    
    # Аудит
    record_event(db, "user", user.id, "password_changed", {}, user.id)
    
    return PasswordResetResponse(
        message="Пароль успешно изменён",
        success=True
    )


# ============================================================================
# LOGOUT
# ============================================================================

@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Выход из системы (для аудита)"""
    
    record_event(db, "user", user.id, "logout", {}, user.id)
    
    return {"message": "Успешный выход"}


# ============================================================================
# BOOTSTRAP (только для dev)
# ============================================================================

@router.post("/bootstrap-owner", response_model=MeResponse)
def bootstrap_owner(email: str, password: str, db: Session = Depends(get_db)):
    """Прототип: создаёт первого owner, если users пустая.
    В проде удалить/закрыть.
    """
    if not settings.debug:
        raise HTTPException(status_code=403, detail="Disabled in production")
    
    exists = db.query(User).limit(1).first()
    if exists:
        raise HTTPException(status_code=400, detail="Already initialized")

    c = Company(id=str(uuid.uuid4()), name="Default Company", slug="default")
    db.add(c)

    user = User(
        id=str(uuid.uuid4()), 
        company_id=c.id, 
        email=email, 
        password_hash=hash_password(password), 
        role=UserRole.owner, 
        is_active=True
    )
    db.add(user)
    db.commit()
    
    return MeResponse(id=user.id, email=user.email, role=user.role.value, company_id=user.company_id)
