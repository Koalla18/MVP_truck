"""Camera clips API routes."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.camera import CameraClip
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.audit import record_event

router = APIRouter()


class ClipCreate(BaseModel):
    vehicle_id: str
    camera_type: str = "front"
    duration_seconds: Optional[int] = None
    description: Optional[str] = None
    tags: Optional[str] = None
    incident_id: Optional[str] = None
    recorded_at: Optional[datetime] = None
    lat: Optional[str] = None
    lon: Optional[str] = None


class ClipResponse(BaseModel):
    id: str
    company_id: str
    vehicle_id: str
    camera_type: str
    duration_seconds: Optional[int]
    storage_path: Optional[str]
    thumbnail_path: Optional[str]
    description: Optional[str]
    tags: Optional[str]
    incident_id: Optional[str]
    recorded_at: datetime
    created_at: datetime
    lat: Optional[str]
    lon: Optional[str]

    class Config:
        from_attributes = True


@router.post("", response_model=ClipResponse)
def create_clip(
    payload: ClipCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new camera clip record (metadata only, file stored separately)."""
    
    # Verify vehicle belongs to company
    vehicle = db.query(Vehicle).filter(
        Vehicle.id == payload.vehicle_id,
        Vehicle.company_id == user.company_id
    ).first()
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    clip = CameraClip(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        vehicle_id=payload.vehicle_id,
        incident_id=payload.incident_id,
        camera_type=payload.camera_type,
        duration_seconds=payload.duration_seconds,
        description=payload.description,
        tags=payload.tags,
        recorded_at=payload.recorded_at or datetime.now(timezone.utc),
        lat=payload.lat,
        lon=payload.lon,
        storage_type="demo",  # In demo mode, no actual file
        storage_path=f"/demo/clips/{uuid.uuid4()}.mp4"
    )
    
    db.add(clip)
    db.commit()
    db.refresh(clip)
    
    record_event(db, "camera_clip", clip.id, "created", {
        "vehicle_id": payload.vehicle_id,
        "camera_type": payload.camera_type
    }, user.id)
    
    return clip


@router.get("", response_model=list[ClipResponse])
def list_clips(
    vehicle_id: Optional[str] = Query(None),
    camera_type: Optional[str] = Query(None),
    incident_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List camera clips with optional filters."""
    
    query = db.query(CameraClip).filter(CameraClip.company_id == user.company_id)
    
    if vehicle_id:
        query = query.filter(CameraClip.vehicle_id == vehicle_id)
    if camera_type:
        query = query.filter(CameraClip.camera_type == camera_type)
    if incident_id:
        query = query.filter(CameraClip.incident_id == incident_id)
    
    clips = query.order_by(desc(CameraClip.recorded_at)).offset(offset).limit(limit).all()
    
    return clips


@router.get("/{clip_id}", response_model=ClipResponse)
def get_clip(
    clip_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific clip."""
    
    clip = db.query(CameraClip).filter(
        CameraClip.id == clip_id,
        CameraClip.company_id == user.company_id
    ).first()
    
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    
    return clip


@router.delete("/{clip_id}")
def delete_clip(
    clip_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a clip."""
    
    clip = db.query(CameraClip).filter(
        CameraClip.id == clip_id,
        CameraClip.company_id == user.company_id
    ).first()
    
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    
    db.delete(clip)
    db.commit()
    
    record_event(db, "camera_clip", clip_id, "deleted", {}, user.id)
    
    return {"status": "deleted"}


@router.post("/{clip_id}/link-incident")
def link_clip_to_incident(
    clip_id: str,
    incident_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Link a clip to an incident for evidence."""
    
    clip = db.query(CameraClip).filter(
        CameraClip.id == clip_id,
        CameraClip.company_id == user.company_id
    ).first()
    
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    
    clip.incident_id = incident_id
    db.commit()
    
    record_event(db, "camera_clip", clip_id, "linked_to_incident", {
        "incident_id": incident_id
    }, user.id)
    
    return {"status": "linked", "incident_id": incident_id}
