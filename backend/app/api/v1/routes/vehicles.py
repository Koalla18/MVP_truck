import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.driver import DriverProfile
from app.models.enums import UserRole
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleOut, VehicleUpdate
from app.services.audit import write_audit

router = APIRouter()


@router.get("", response_model=list[VehicleOut])
def list_vehicles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Vehicle).filter(Vehicle.company_id == user.company_id)
    if UserRole(user.role) == UserRole.driver:
        dp = db.query(DriverProfile).filter(DriverProfile.user_id == user.id, DriverProfile.company_id == user.company_id).first()
        if not dp:
            return []
        q = q.filter(Vehicle.driver_profile_id == dp.id)
    return q.order_by(Vehicle.created_at.desc()).all()


@router.post("", response_model=VehicleOut, dependencies=[Depends(require_permissions("vehicles.write"))])
def create_vehicle(payload: VehicleCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    exists = (
        db.query(Vehicle)
        .filter(Vehicle.company_id == user.company_id)
        .filter((Vehicle.plate == payload.plate) | (Vehicle.vin == payload.vin))
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Vehicle with same plate or vin exists")

    v = Vehicle(
        id=str(uuid.uuid4()),
        company_id=user.company_id,
        name=payload.name,
        plate=payload.plate,
        vin=payload.vin,
        series=payload.series,
        tag=payload.tag,
        cargo_desc=payload.cargo_desc,
        route_code=payload.route_code,
        origin=payload.origin,
        destination=payload.destination,
        depart_at=payload.depart_at,
        eta_at=payload.eta_at,
        load_pct=payload.load_pct,
        fuel_pct=payload.fuel_pct,
        tank_l=payload.tank_l,
        pallets_capacity=payload.pallets_capacity,
        distance_total_km=payload.distance_total_km,
        distance_done_km=payload.distance_done_km,
        avg_speed=payload.avg_speed,
        health_pct=payload.health_pct,
        image_url=payload.image_url,
        driver_profile_id=payload.driver_profile_id,
        status_main=None,
        status_secondary=[],
    )

    db.add(v)
    write_audit(
        db,
        company_id=user.company_id,
        entity_type="vehicle",
        entity_id=v.id,
        action="create",
        actor_user_id=user.id,
        payload=payload.model_dump(),
    )
    db.commit()
    db.refresh(v)
    return v


@router.patch("/{vehicle_id}", response_model=VehicleOut, dependencies=[Depends(require_permissions("vehicles.write"))])
def update_vehicle(vehicle_id: str, payload: VehicleUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    v = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Not found")
    if v.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Not found")

    data = payload.model_dump(exclude_unset=True)
    for k, val in data.items():
        setattr(v, k, val)

    write_audit(db, company_id=user.company_id, entity_type="vehicle", entity_id=v.id, action="update", actor_user_id=user.id, payload=data)
    db.commit()
    db.refresh(v)
    return v


@router.delete("/{vehicle_id}", dependencies=[Depends(require_permissions("vehicles.write"))])
def delete_vehicle(vehicle_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    v = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(status_code=404, detail="Not found")
    if v.company_id != user.company_id:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(v)
    write_audit(db, company_id=user.company_id, entity_type="vehicle", entity_id=vehicle_id, action="delete", actor_user_id=user.id, payload={})
    db.commit()
    return {"status": "deleted"}
