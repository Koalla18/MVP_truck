from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    level: str
    title: str
    detail: str | None = None
    created_at: datetime | None = None
    read_at: datetime | None = None

    class Config:
        from_attributes = True


class NotificationMarkReadRequest(BaseModel):
    ids: list[str]
