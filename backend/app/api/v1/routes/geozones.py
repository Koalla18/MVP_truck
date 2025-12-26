from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.enums import GeozoneType
from app.models.geozone import Geozone, GeozoneEvent, VehicleGeozoneState
from app.models.user import User
from app.schemas.geozone import GeozoneCreate, GeozoneEventOut, GeozoneOut, GeozoneUpdate
from app.services.audit import write_audit
from app.services.events import publish_event
from app.services.geo import haversine_m, point_in_polygon


router = APIRouter()


def _is_inside(zone: Geozone, lat: float, lon: float) -> bool:
    if zone.zone_type == GeozoneType.circle:
        if zone.center_lat is None or zone.center_lon is None or zone.radius_m is None:
            return False
        return haversine_m(lat, lon, zone.center_lat, zone.center_lon) <= float(zone.radius_m)
    if zone.zone_type == GeozoneType.polygon:
        if not zone.polygon:
            return False
        return point_in_polygon(lat, lon, zone.polygon)
    return False


@router.get("", response_model=list[GeozoneOut], dependencies=[Depends(require_permissions("geozones.read"))])
def list_geozones(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Geozone).filter(Geozone.company_id == user.company_id).order_by(Geozone.created_at.desc()).all()


@router.post("", response_model=GeozoneOut, dependencies=[Depends(require_permissions("geozones.write"))])
def create_geozone(payload: GeozoneCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        zt = GeozoneType(payload.zone_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid zone_type")

    if zt == GeozoneType.circle and (payload.center_lat is None or payload.center_lon is None or payload.radius_m is None):
        raise HTTPException(status_code=400, detail="Circle requires center_lat/center_lon/radius_m")
    if zt == GeozoneType.polygon and not payload.polygon:
        raise HTTPException(status_code=400, detail="Polygon requires polygon")

    z = Geozone(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        name=payload.name,
        zone_type=zt,
        is_active=payload.is_active,
        center_lat=payload.center_lat,
        center_lon=payload.center_lon,
        radius_m=payload.radius_m,
        polygon=payload.polygon,
    )
    db.add(z)
    write_audit(db, company_id=user.company_id, entity_type="geozone", entity_id=z.id, action="create", actor_user_id=user.id, payload=payload.model_dump())
    db.commit()
    db.refresh(z)
    return z


@router.patch("/{geozone_id}", response_model=GeozoneOut, dependencies=[Depends(require_permissions("geozones.write"))])
def update_geozone(geozone_id: str, payload: GeozoneUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    z = db.get(Geozone, geozone_id)
    if not z or z.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(z, k, v)

    write_audit(db, company_id=user.company_id, entity_type="geozone", entity_id=z.id, action="update", actor_user_id=user.id, payload=data)
    db.commit()
    db.refresh(z)
    return z


@router.delete("/{geozone_id}", dependencies=[Depends(require_permissions("geozones.write"))])
def delete_geozone(geozone_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    z = db.get(Geozone, geozone_id)
    if not z or z.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(z)
    write_audit(db, company_id=user.company_id, entity_type="geozone", entity_id=geozone_id, action="delete", actor_user_id=user.id, payload={})
    db.commit()
    return {"status": "deleted"}


@router.get("/events", response_model=list[GeozoneEventOut], dependencies=[Depends(require_permissions("geozones.read"))])
def list_events(db: Session = Depends(get_db), user: User = Depends(get_current_user), limit: int = 200):
    return (
        db.query(GeozoneEvent)
        .filter(GeozoneEvent.company_id == user.company_id)
        .order_by(GeozoneEvent.occurred_at.desc())
        .limit(limit)
        .all()
    )


@router.post("/evaluate")
def evaluate_position(vehicle_id: str, lat: float, lon: float, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Admin utility endpoint: evaluate enter/exit for one vehicle position.
    # Real path runs in telemetry ingest (future: move there and remove this endpoint).
    zones = db.query(Geozone).filter(Geozone.company_id == user.company_id, Geozone.is_active.is_(True)).all()
    now = datetime.now(timezone.utc)
    events = 0
    for z in zones:
        inside = _is_inside(z, lat, lon)
        state = db.query(VehicleGeozoneState).filter(VehicleGeozoneState.vehicle_id == vehicle_id, VehicleGeozoneState.geozone_id == z.id).one_or_none()
        if not state:
            state = VehicleGeozoneState(vehicle_id=vehicle_id, geozone_id=z.id, is_inside=inside, last_changed_at=now)
            db.add(state)
            continue
        if state.is_inside != inside:
            state.is_inside = inside
            state.last_changed_at = now
            evt = GeozoneEvent(
                id=str(uuid.uuid4()),
                company_id=user.company_id,
                vehicle_id=vehicle_id,
                geozone_id=z.id,
                event_type="enter" if inside else "exit",
                lat=lat,
                lon=lon,
                occurred_at=now,
            )
            db.add(evt)
            events += 1
    db.commit()
    if events:
        publish_event(user.company_id, {"type": "geozone.events", "vehicle_id": vehicle_id, "count": events, "at": now.isoformat()})
    return {"status": "ok", "events": events}
