"""Maintenance API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.api.v1.deps import get_current_user, require_permissions
from app.db.session import get_db
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.maintenance import (
    run_maintenance_check,
    get_maintenance_forecast,
    evaluate_maintenance_rules,
    check_maintenance_schedule
)

router = APIRouter()


@router.post("/check")
def trigger_maintenance_check(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger a maintenance check for all company vehicles."""
    results = run_maintenance_check(db, company_id=user.company_id)
    return results


@router.get("/forecast")
def get_fleet_maintenance_forecast(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get maintenance forecast for entire fleet."""
    vehicles = db.query(Vehicle).filter(Vehicle.company_id == user.company_id).all()
    
    fleet_forecast = []
    for vehicle in vehicles:
        forecast = get_maintenance_forecast(vehicle)
        fleet_forecast.append({
            'vehicle_id': vehicle.id,
            'vehicle_name': vehicle.name,
            'plate': vehicle.plate,
            'health_pct': vehicle.health_pct,
            'maintenance': forecast
        })
    
    # Sort by most urgent maintenance
    fleet_forecast.sort(key=lambda x: min(m['km_until'] for m in x['maintenance']) if x['maintenance'] else float('inf'))
    
    return {
        'fleet': fleet_forecast,
        'total_vehicles': len(vehicles),
        'urgent_count': sum(1 for v in fleet_forecast if any(m['urgency'] == 'high' for m in v['maintenance']))
    }


@router.get("/forecast/{vehicle_id}")
def get_vehicle_maintenance_forecast(
    vehicle_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get maintenance forecast for a specific vehicle."""
    vehicle = db.query(Vehicle).filter(
        Vehicle.id == vehicle_id,
        Vehicle.company_id == user.company_id
    ).first()
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    forecast = get_maintenance_forecast(vehicle)
    
    # Get current status
    rule_alerts = evaluate_maintenance_rules(vehicle, db)
    schedule_alerts = check_maintenance_schedule(vehicle, db)
    
    return {
        'vehicle_id': vehicle.id,
        'vehicle_name': vehicle.name,
        'plate': vehicle.plate,
        'health_pct': vehicle.health_pct,
        'fuel_pct': vehicle.fuel_pct,
        'distance_km': vehicle.distance_done_km,
        'maintenance_forecast': forecast,
        'current_issues': [
            {'type': a['alert_type'], 'message': a['message']} 
            for a in rule_alerts + schedule_alerts
        ]
    }
