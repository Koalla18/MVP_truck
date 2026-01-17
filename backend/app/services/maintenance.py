"""Predictive Maintenance Service.

Analyzes telemetry data and creates maintenance alerts based on:
- Threshold rules (e.g., oil temp > 120°C)
- Trend analysis (e.g., fuel efficiency dropping)
- Scheduled maintenance intervals
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.vehicle import Vehicle
from app.models.alert import Alert
from app.models.telemetry import VehiclePosition
from app.models.enums import AlertStatus
from app.services.events import publish_event


# Maintenance thresholds
MAINTENANCE_RULES = {
    'health_critical': {
        'field': 'health_pct',
        'operator': 'lt',
        'value': 50,
        'alert_type': 'maintenance_critical',
        'message': 'Критическое состояние транспорта: требуется срочное ТО'
    },
    'health_warning': {
        'field': 'health_pct',
        'operator': 'lt',
        'value': 70,
        'alert_type': 'maintenance_warning',
        'message': 'Состояние транспорта ухудшается: рекомендуется ТО'
    },
    'fuel_low': {
        'field': 'fuel_pct',
        'operator': 'lt',
        'value': 15,
        'alert_type': 'fuel_low',
        'message': 'Низкий уровень топлива'
    },
    'overloaded': {
        'field': 'load_pct',
        'operator': 'gt',
        'value': 100,
        'alert_type': 'overload',
        'message': 'Перегрузка транспорта'
    }
}

# Maintenance intervals (in km)
MAINTENANCE_INTERVALS = {
    'oil_change': 15000,
    'brake_inspection': 30000,
    'tire_rotation': 10000,
    'full_service': 50000
}


def check_threshold(value: float, operator: str, threshold: float) -> bool:
    """Check if value triggers threshold."""
    if operator == 'lt':
        return value < threshold
    elif operator == 'gt':
        return value > threshold
    elif operator == 'le':
        return value <= threshold
    elif operator == 'ge':
        return value >= threshold
    elif operator == 'eq':
        return value == threshold
    return False


def evaluate_maintenance_rules(vehicle: Vehicle, db: Session) -> list[dict]:
    """Evaluate all maintenance rules for a vehicle."""
    alerts_to_create = []
    
    for rule_id, rule in MAINTENANCE_RULES.items():
        field_value = getattr(vehicle, rule['field'], None)
        if field_value is None:
            continue
        
        if check_threshold(field_value, rule['operator'], rule['value']):
            # Check if similar alert already exists (not acknowledged)
            existing = db.query(Alert).filter(
                Alert.vehicle_id == vehicle.id,
                Alert.alert_type == rule['alert_type'],
                Alert.status.in_([AlertStatus.created, AlertStatus.delivered])
            ).first()
            
            if not existing:
                alerts_to_create.append({
                    'rule_id': rule_id,
                    'alert_type': rule['alert_type'],
                    'message': f"{rule['message']} ({vehicle.name}): {rule['field']}={field_value}%",
                    'vehicle_id': vehicle.id,
                    'company_id': vehicle.company_id
                })
    
    return alerts_to_create


def check_maintenance_schedule(vehicle: Vehicle, db: Session) -> list[dict]:
    """Check if vehicle is due for scheduled maintenance."""
    alerts = []
    
    # Use distance_done_km as proxy for total mileage
    total_km = vehicle.distance_done_km or 0
    
    for maintenance_type, interval_km in MAINTENANCE_INTERVALS.items():
        # Calculate km until next maintenance
        km_since_last = total_km % interval_km
        km_until_next = interval_km - km_since_last
        
        # Alert if within 500km of maintenance
        if km_until_next <= 500:
            existing = db.query(Alert).filter(
                Alert.vehicle_id == vehicle.id,
                Alert.alert_type == f'scheduled_{maintenance_type}',
                Alert.status.in_([AlertStatus.created, AlertStatus.delivered])
            ).first()
            
            if not existing:
                alerts.append({
                    'alert_type': f'scheduled_{maintenance_type}',
                    'message': f"Плановое ТО ({maintenance_type.replace('_', ' ')}) через {km_until_next:.0f} км ({vehicle.name})",
                    'vehicle_id': vehicle.id,
                    'company_id': vehicle.company_id
                })
    
    return alerts


def analyze_trends(vehicle: Vehicle, db: Session, lookback_hours: int = 24) -> list[dict]:
    """Analyze telemetry trends for anomalies."""
    alerts = []
    
    # Get position/speed data for trend analysis
    since = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    positions = db.query(VehiclePosition).filter(
        VehiclePosition.vehicle_id == vehicle.id,
        VehiclePosition.recorded_at >= since
    ).order_by(VehiclePosition.recorded_at).all()
    
    if len(positions) < 10:
        return alerts  # Not enough data
    
    # Analyze speed patterns
    speeds = [p.speed_kph for p in positions if p.speed_kph is not None]
    if speeds:
        avg_speed = sum(speeds) / len(speeds)
        max_speed = max(speeds)
        
        # Alert on excessive speeding
        if max_speed > 120:
            alerts.append({
                'alert_type': 'speeding',
                'message': f"Превышение скорости зафиксировано: {max_speed:.0f} км/ч ({vehicle.name})",
                'vehicle_id': vehicle.id,
                'company_id': vehicle.company_id
            })
        
        # Alert on unusual patterns (very low average with high max suggests erratic driving)
        if avg_speed < 30 and max_speed > 80:
            alerts.append({
                'alert_type': 'driving_pattern',
                'message': f"Нестабильный стиль вождения ({vehicle.name}): средн. {avg_speed:.0f}, макс. {max_speed:.0f} км/ч",
                'vehicle_id': vehicle.id,
                'company_id': vehicle.company_id
            })
    
    return alerts


def create_alert(db: Session, alert_data: dict, user_id: Optional[str] = None) -> Alert:
    """Create an alert in the database."""
    alert = Alert(
        id=str(uuid.uuid4()),
        company_id=alert_data['company_id'],
        vehicle_id=alert_data['vehicle_id'],
        created_by_user_id=user_id,
        alert_type=alert_data['alert_type'],
        message=alert_data['message'],
        status=AlertStatus.created
    )
    db.add(alert)
    return alert


def run_maintenance_check(db: Session, company_id: Optional[str] = None) -> dict:
    """Run maintenance check for all vehicles or a specific company."""
    
    query = db.query(Vehicle)
    if company_id:
        query = query.filter(Vehicle.company_id == company_id)
    
    vehicles = query.all()
    
    total_alerts = 0
    results = {
        'vehicles_checked': len(vehicles),
        'alerts_created': 0,
        'by_type': {}
    }
    
    for vehicle in vehicles:
        # Evaluate rules
        rule_alerts = evaluate_maintenance_rules(vehicle, db)
        schedule_alerts = check_maintenance_schedule(vehicle, db)
        trend_alerts = analyze_trends(vehicle, db)
        
        all_alerts = rule_alerts + schedule_alerts + trend_alerts
        
        for alert_data in all_alerts:
            alert = create_alert(db, alert_data)
            total_alerts += 1
            
            alert_type = alert_data['alert_type']
            results['by_type'][alert_type] = results['by_type'].get(alert_type, 0) + 1
            
            # Publish event
            publish_event(vehicle.company_id, {
                'type': 'alert.created',
                'alert_id': alert.id,
                'alert_type': alert_type,
                'vehicle_id': vehicle.id,
                'message': alert_data['message']
            })
    
    db.commit()
    results['alerts_created'] = total_alerts
    
    return results


def get_maintenance_forecast(vehicle: Vehicle) -> list[dict]:
    """Get maintenance forecast for a vehicle."""
    total_km = vehicle.distance_done_km or 0
    forecast = []
    
    for maintenance_type, interval_km in MAINTENANCE_INTERVALS.items():
        km_since_last = total_km % interval_km
        km_until_next = interval_km - km_since_last
        
        # Estimate days based on average speed and typical daily driving
        avg_daily_km = 400  # Typical truck daily distance
        days_until = km_until_next / avg_daily_km
        
        due_date = datetime.now(timezone.utc) + timedelta(days=days_until)
        
        forecast.append({
            'type': maintenance_type,
            'display_name': maintenance_type.replace('_', ' ').title(),
            'km_until': round(km_until_next),
            'estimated_date': due_date.date().isoformat(),
            'days_until': round(days_until),
            'urgency': 'high' if km_until_next < 500 else 'medium' if km_until_next < 2000 else 'low'
        })
    
    return sorted(forecast, key=lambda x: x['km_until'])
