from __future__ import annotations

from sqlalchemy import Boolean, Column, ForeignKey, String

from app.db.base import Base


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role = Column(String, primary_key=True)
    permission = Column(String, primary_key=True)


class UserPermissionOverride(Base):
    __tablename__ = "user_permission_overrides"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    permission = Column(String, primary_key=True)
    allowed = Column(Boolean, nullable=False)
