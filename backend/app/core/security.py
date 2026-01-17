from datetime import datetime, timedelta, timezone
import secrets

import bcrypt
from jose import jwt, JWTError

from app.core.settings import settings


def hash_password(password: str) -> str:
    # Bcrypt has a 72-byte limit, so we need to truncate if necessary
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    # Bcrypt has a 72-byte limit, so we need to truncate if necessary
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    hash_bytes = password_hash.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hash_bytes)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_min)
    payload = {
        "sub": subject,
        "role": role,
        "company_id": None,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def create_access_token_v2(*, subject: str, role: str, company_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_min)
    payload = {
        "sub": subject,
        "role": role,
        "company_id": company_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def create_refresh_token(subject: str, company_id: str) -> str:
    """Создание refresh токена (долгоживущий)"""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_expires_days)
    payload = {
        "sub": subject,
        "company_id": company_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": secrets.token_hex(16),  # Уникальный ID для отзыва
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def verify_refresh_token(token: str) -> dict | None:
    """Верификация refresh токена"""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def create_password_reset_token(user_id: str, email: str) -> str:
    """Создание токена для сброса пароля"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_expires_min)
    secret = settings.password_reset_secret or settings.jwt_secret
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "password_reset",
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, secret, algorithm=settings.jwt_alg)


def verify_password_reset_token(token: str) -> dict | None:
    """Верификация токена сброса пароля"""
    try:
        secret = settings.password_reset_secret or settings.jwt_secret
        payload = jwt.decode(token, secret, algorithms=[settings.jwt_alg])
        if payload.get("type") != "password_reset":
            return None
        return payload
    except JWTError:
        return None


def decode_token(token: str) -> dict | None:
    """Декодирование любого токена"""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except JWTError:
        return None
