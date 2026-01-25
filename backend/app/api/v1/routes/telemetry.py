from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.telemetry import TelemetryApiKey, VehiclePosition
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.geozone import Geozone, GeozoneEvent, VehicleGeozoneState
from app.models.enums import GeozoneEventType, GeozoneType
from app.schemas.telemetry import (
    TelemetryApiKeyCreateRequest,
    TelemetryApiKeyCreated,
    TelemetryApiKeyOut,
    TelemetryIngestRequest,
)
from app.services.audit import write_audit
from app.services.events import publish_event
from app.services.redis_client import get_redis
from app.services.geo import haversine_m, point_in_polygon


router = APIRouter()


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ============================================================================
# ETA CALCULATION
# ============================================================================

def calculate_eta(distance_remaining_km: float, avg_speed_kph: float) -> Optional[datetime]:
    """Calculate ETA based on remaining distance and average speed."""
    if avg_speed_kph <= 0 or distance_remaining_km <= 0:
        return None
    
    hours = distance_remaining_km / avg_speed_kph
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def estimate_remaining_distance(current_lat: float, current_lon: float, dest_lat: float, dest_lon: float) -> float:
    """Estimate remaining distance in km (direct line * road factor)."""
    direct_distance_m = haversine_m(current_lat, current_lon, dest_lat, dest_lon)
    # Road factor: actual road distance is typically 1.3-1.5x direct distance
    return (direct_distance_m / 1000) * 1.35


# ============================================================================
# POSITIONS & TRACKING
# ============================================================================

@router.get("/positions")
def get_positions(
    vehicle_id: Optional[str] = Query(None),
    since: Optional[datetime] = Query(None, description="Get positions since this timestamp"),
    limit: int = Query(100, le=1000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get latest vehicle positions for real-time tracking."""
    
    query = db.query(VehiclePosition).filter(
        VehiclePosition.company_id == user.company_id
    )
    
    if vehicle_id:
        query = query.filter(VehiclePosition.vehicle_id == vehicle_id)
    
    if since:
        query = query.filter(VehiclePosition.recorded_at >= since)
    
    positions = query.order_by(desc(VehiclePosition.recorded_at)).limit(limit).all()
    
    return {
        "positions": [
            {
                "id": p.id,
                "vehicle_id": p.vehicle_id,
                "lat": p.lat,
                "lon": p.lon,
                "speed_kph": p.speed_kph,
                "heading": p.heading,
                "recorded_at": p.recorded_at.isoformat() if p.recorded_at else None
            }
            for p in positions
        ]
    }


@router.get("/positions/latest")
def get_latest_positions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the most recent position for each vehicle (for map display)."""
    
    from sqlalchemy import func
    
    # Subquery to get the latest position for each vehicle
    subq = (
        db.query(
            VehiclePosition.vehicle_id,
            func.max(VehiclePosition.recorded_at).label("max_recorded")
        )
        .filter(VehiclePosition.company_id == user.company_id)
        .group_by(VehiclePosition.vehicle_id)
        .subquery()
    )
    
    positions = (
        db.query(VehiclePosition)
        .join(
            subq,
            (VehiclePosition.vehicle_id == subq.c.vehicle_id) &
            (VehiclePosition.recorded_at == subq.c.max_recorded)
        )
        .all()
    )
    
    # Get vehicle info for ETA calculation
    vehicles_dict = {}
    vehicle_ids = [p.vehicle_id for p in positions]
    if vehicle_ids:
        vehicles = db.query(Vehicle).filter(Vehicle.id.in_(vehicle_ids)).all()
        vehicles_dict = {v.id: v for v in vehicles}
    
    result = []
    for p in positions:
        vehicle = vehicles_dict.get(p.vehicle_id)
        eta = None
        remaining_km = None
        
        if vehicle and vehicle.distance_total_km and vehicle.distance_done_km:
            remaining_km = vehicle.distance_total_km - vehicle.distance_done_km
            if vehicle.avg_speed and vehicle.avg_speed > 0:
                eta = calculate_eta(remaining_km, vehicle.avg_speed)
        
        result.append({
            "vehicle_id": p.vehicle_id,
            "vehicle_name": vehicle.name if vehicle else None,
            "lat": p.lat,
            "lon": p.lon,
            "speed_kph": p.speed_kph,
            "heading": p.heading,
            "recorded_at": p.recorded_at.isoformat() if p.recorded_at else None,
            "eta": eta.isoformat() if eta else None,
            "remaining_km": round(remaining_km, 1) if remaining_km else None,
            "status": vehicle.status_main if vehicle else None
        })
    
    return {"positions": result, "count": len(result)}


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@router.post("/api-keys", response_model=TelemetryApiKeyCreated, dependencies=[Depends(require_permissions("vehicles.write"))])
def create_api_key(payload: TelemetryApiKeyCreateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    raw = secrets.token_urlsafe(48)
    key_hash = _hash_key(raw)
    row = TelemetryApiKey(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        name=payload.name,
        key_hash=key_hash,
        is_active=True,
        rate_limit_per_min=payload.rate_limit_per_min,
    )
    db.add(row)
    write_audit(db, company_id=user.company_id, entity_type="telemetry_api_key", entity_id=row.id, action="create", actor_user_id=user.id, payload={"name": payload.name, "rate_limit_per_min": payload.rate_limit_per_min})
    db.commit()
    return TelemetryApiKeyCreated(id=row.id, name=row.name, api_key=raw)


@router.get("/api-keys", response_model=list[TelemetryApiKeyOut], dependencies=[Depends(require_permissions("vehicles.read"))])
def list_api_keys(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(TelemetryApiKey).filter(TelemetryApiKey.company_id == user.company_id).order_by(TelemetryApiKey.created_at.desc()).all()


@router.post("/ingest")
def ingest(payload: TelemetryIngestRequest, db: Session = Depends(get_db), x_api_key: str | None = Header(default=None, alias="X-API-Key")):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    key_hash = _hash_key(x_api_key)
    api_key = db.query(TelemetryApiKey).filter(TelemetryApiKey.key_hash == key_hash, TelemetryApiKey.is_active.is_(True)).first()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Rate limit via Redis token bucket per minute
    r = get_redis()
    minute = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    rl_key = f"rl:telemetry:{key_hash}:{minute}"
    current = r.incr(rl_key)
    if current == 1:
        r.expire(rl_key, 70)
    if current > int(api_key.rate_limit_per_min):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    now = datetime.now(timezone.utc)
    api_key.last_used_at = now

    zones = db.query(Geozone).filter(Geozone.company_id == api_key.company_id, Geozone.is_active.is_(True)).all()

    updated = 0
    positions = 0
    zone_events = 0
    for u in payload.updates:
        v = db.get(Vehicle, u.vehicle_id)
        if not v or v.company_id != api_key.company_id:
            continue

        # Telemetry fields
        if u.load_pct is not None:
            v.load_pct = u.load_pct
        if u.fuel_pct is not None:
            v.fuel_pct = u.fuel_pct
        if u.avg_speed is not None:
            v.avg_speed = u.avg_speed
        if u.health_pct is not None:
            v.health_pct = u.health_pct
        v.telemetry_updated_at = now
        updated += 1

        # Position
        if u.lat is not None and u.lon is not None:
            recorded_at = u.recorded_at or now
            pos = VehiclePosition(
                id=str(uuid.uuid4()),
                company_id=api_key.company_id,
                vehicle_id=v.id,
                lat=float(u.lat),
                lon=float(u.lon),
                speed_kph=u.speed_kph,
                heading=u.heading,
                recorded_at=recorded_at,
            )
            db.add(pos)
            positions += 1

            # Evaluate geozones and create enter/exit events
            lat = float(u.lat)
            lon = float(u.lon)
            for z in zones:
                if z.zone_type == GeozoneType.circle:
                    if z.center_lat is None or z.center_lon is None or z.radius_m is None:
                        continue
                    inside = haversine_m(lat, lon, z.center_lat, z.center_lon) <= float(z.radius_m)
                else:
                    if not z.polygon:
                        continue
                    inside = point_in_polygon(lat, lon, z.polygon)

                state = (
                    db.query(VehicleGeozoneState)
                    .filter(VehicleGeozoneState.vehicle_id == v.id, VehicleGeozoneState.geozone_id == z.id)
                    .one_or_none()
                )
                if not state:
                    db.add(VehicleGeozoneState(vehicle_id=v.id, geozone_id=z.id, is_inside=inside, last_changed_at=recorded_at))
                    continue
                if state.is_inside != inside:
                    state.is_inside = inside
                    state.last_changed_at = recorded_at
                    evt = GeozoneEvent(
                        id=str(uuid.uuid4()),
                        company_id=api_key.company_id,
                        vehicle_id=v.id,
                        geozone_id=z.id,
                        event_type=GeozoneEventType.enter if inside else GeozoneEventType.exit,
                        lat=lat,
                        lon=lon,
                        occurred_at=recorded_at,
                    )
                    db.add(evt)
                    zone_events += 1

    db.commit()

    publish_event(
        api_key.company_id,
        {"type": "telemetry.ingested", "updated": updated, "positions": positions, "geozone_events": zone_events, "at": now.isoformat()},
    )
    if zone_events:
        publish_event(api_key.company_id, {"type": "geozone.events", "count": zone_events, "at": now.isoformat()})
    return {"status": "ok", "updated": updated, "positions": positions, "geozone_events": zone_events}
