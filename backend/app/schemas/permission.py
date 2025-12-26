from __future__ import annotations

from pydantic import BaseModel


class RolePermissionRow(BaseModel):
    role: str
    permission: str


class UserPermissionOverrideRow(BaseModel):
    user_id: str
    permission: str
    allowed: bool


class SetRolePermissionsRequest(BaseModel):
    role: str
    permissions: list[str]


class SetUserOverridesRequest(BaseModel):
    user_id: str
    overrides: list[UserPermissionOverrideRow]
