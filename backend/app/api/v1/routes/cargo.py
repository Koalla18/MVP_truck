"""Cargo Plans API routes."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.cargo import CargoPlan
from app.models.user import User
from app.schemas.cargo import CargoPlanCreate, CargoPlanList, CargoPlanResponse, CargoPlanUpdate
from app.services.audit import record_event

router = APIRouter()


# Constants for validation
CARGO_GRID_COLS = 8
CARGO_GRID_ROWS = 3
CARGO_TOTAL_CELLS = CARGO_GRID_COLS * CARGO_GRID_ROWS
CARGO_MAX_WEIGHT_KG = 24000


def validate_cargo_plan(grid: list, merged_cells: dict, total_weight: float) -> tuple[bool, list, list]:
    """Validate cargo plan and return (is_valid, errors, warnings)."""
    errors = []
    warnings = []
    
    # Weight validation
    if total_weight > CARGO_MAX_WEIGHT_KG:
        errors.append(f"Превышен лимит веса: {total_weight:.0f} кг / {CARGO_MAX_WEIGHT_KG} кг")
    elif total_weight > CARGO_MAX_WEIGHT_KG * 0.9:
        warnings.append(f"Близко к лимиту веса: {total_weight:.0f} кг ({int(total_weight / CARGO_MAX_WEIGHT_KG * 100)}%)")
    
    # Count types
    type_counts = {}
    for cell in grid:
        if cell:
            cell_type = cell if isinstance(cell, str) else cell.get('type') if isinstance(cell, dict) else None
            if cell_type:
                type_counts[cell_type] = type_counts.get(cell_type, 0) + 1
    
    # Temperature conflict
    if type_counts.get('cold', 0) > 0 and type_counts.get('hot', 0) > 0:
        errors.append("Конфликт температур: холодный и горячий груз в одном прицепе")
    
    # Hazmat warning
    if type_counts.get('hazmat', 0) > 0 and len(type_counts) > 1:
        warnings.append("Опасный груз смешан с другими типами")
    
    return len(errors) == 0, errors, warnings


@router.post("", response_model=CargoPlanResponse, status_code=status.HTTP_201_CREATED)
def create_cargo_plan(
    payload: CargoPlanCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new cargo plan."""
    
    # Validate
    cells_used = len([c for c in payload.grid if c is not None])
    load_percent = (cells_used / CARGO_TOTAL_CELLS) * 100 if CARGO_TOTAL_CELLS > 0 else 0
    
    is_valid, errors, warnings = validate_cargo_plan(
        payload.grid, 
        payload.merged_cells, 
        payload.total_weight
    )
    
    plan = CargoPlan(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        vehicle_id=payload.vehicle_id,
        created_by_user_id=user.id,
        name=payload.name,
        grid=payload.grid,
        merged_cells=payload.merged_cells,
        total_weight=payload.total_weight,
        load_percent=load_percent,
        is_valid=is_valid,
        validation_errors=errors if errors else None,
        validation_warnings=warnings if warnings else None
    )
    
    db.add(plan)
    db.commit()
    db.refresh(plan)
    
    record_event(db, "cargo_plan", plan.id, "created", {
        "vehicle_id": payload.vehicle_id,
        "total_weight": payload.total_weight
    }, user.id)
    
    return plan


@router.get("", response_model=CargoPlanList)
def list_cargo_plans(
    vehicle_id: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List cargo plans for the company."""
    
    query = db.query(CargoPlan).filter(CargoPlan.company_id == user.company_id)
    
    if vehicle_id:
        query = query.filter(CargoPlan.vehicle_id == vehicle_id)
    
    total = query.count()
    items = query.order_by(CargoPlan.created_at.desc()).offset(offset).limit(limit).all()
    
    return CargoPlanList(items=items, total=total)


@router.get("/{plan_id}", response_model=CargoPlanResponse)
def get_cargo_plan(
    plan_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific cargo plan."""
    
    plan = db.query(CargoPlan).filter(
        CargoPlan.id == plan_id,
        CargoPlan.company_id == user.company_id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Cargo plan not found")
    
    return plan


@router.put("/{plan_id}", response_model=CargoPlanResponse)
def update_cargo_plan(
    plan_id: str,
    payload: CargoPlanUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a cargo plan."""
    
    plan = db.query(CargoPlan).filter(
        CargoPlan.id == plan_id,
        CargoPlan.company_id == user.company_id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Cargo plan not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # Re-validate if grid changed
    if 'grid' in update_data or 'total_weight' in update_data:
        grid = update_data.get('grid', plan.grid)
        merged = update_data.get('merged_cells', plan.merged_cells)
        weight = update_data.get('total_weight', plan.total_weight)
        
        cells_used = len([c for c in grid if c is not None])
        update_data['load_percent'] = (cells_used / CARGO_TOTAL_CELLS) * 100
        
        is_valid, errors, warnings = validate_cargo_plan(grid, merged, weight)
        update_data['is_valid'] = is_valid
        update_data['validation_errors'] = errors if errors else None
        update_data['validation_warnings'] = warnings if warnings else None
    
    for key, value in update_data.items():
        setattr(plan, key, value)
    
    db.commit()
    db.refresh(plan)
    
    record_event(db, "cargo_plan", plan.id, "updated", update_data, user.id)
    
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cargo_plan(
    plan_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a cargo plan."""
    
    plan = db.query(CargoPlan).filter(
        CargoPlan.id == plan_id,
        CargoPlan.company_id == user.company_id
    ).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Cargo plan not found")
    
    db.delete(plan)
    db.commit()
    
    record_event(db, "cargo_plan", plan_id, "deleted", {}, user.id)
