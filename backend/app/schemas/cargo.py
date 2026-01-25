"""Cargo Plan schemas."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class CargoPlanCreate(BaseModel):
    vehicle_id: Optional[str] = None
    name: Optional[str] = None
    grid: list[Any] = Field(default_factory=list)
    merged_cells: dict[str, Any] = Field(default_factory=dict)
    total_weight: float = 0.0
    is_valid: bool = True


class CargoPlanUpdate(BaseModel):
    name: Optional[str] = None
    grid: Optional[list[Any]] = None
    merged_cells: Optional[dict[str, Any]] = None
    total_weight: Optional[float] = None
    is_valid: Optional[bool] = None


class CargoPlanResponse(BaseModel):
    id: str
    company_id: str
    vehicle_id: Optional[str] = None
    name: Optional[str] = None
    grid: list[Any]
    merged_cells: dict[str, Any]
    total_weight: float
    load_percent: float
    is_valid: bool
    validation_errors: Optional[list[str]] = None
    validation_warnings: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CargoPlanList(BaseModel):
    items: list[CargoPlanResponse]
    total: int
