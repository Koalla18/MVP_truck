from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    company_name: str | None = None
    company_slug: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int = 86400  # секунды (24 часа)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id: str
    email: EmailStr
    role: str
    company_id: str


# Password Reset
class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class PasswordResetResponse(BaseModel):
    message: str
    success: bool = True


# Password Change (для авторизованного пользователя)
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
