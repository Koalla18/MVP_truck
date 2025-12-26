import argparse
import json
import re
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.driver import DriverProfile
from app.models.vehicle import Vehicle


def _repo_root() -> Path:
    # .../s/backend/app/scripts/import_frontend_data.py -> parents[3] == .../s
    return Path(__file__).resolve().parents[3]


def _default_json_path() -> Path:
    return _repo_root() / "frontend" / "assets" / "data" / "data.json"


def _parse_percent(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"(\d+(?:\.\d+)?)", value)
        return float(match.group(1)) if match else None
    return None


def _driver_rating_from_status(status: str | None) -> str | None:
    if not status:
        return None
    # Examples: "На линии · рейтинг 98%"
    match = re.search(r"рейтинг\s*(\d+%?)", status, flags=re.IGNORECASE)
    return match.group(1) if match else status


def _upsert_driver(db: Session, payload: dict[str, Any]) -> DriverProfile:
    driver_id = str(payload.get("id")).strip()
    if not driver_id:
        raise ValueError("Driver is missing 'id'")

    driver = db.get(DriverProfile, driver_id)
    if driver is None:
        driver = DriverProfile(id=driver_id, name=str(payload.get("name") or "").strip())
        db.add(driver)

    driver.name = str(payload.get("name") or driver.name or "").strip() or driver.name
    driver.phone = (payload.get("phone") or None)
    driver.home_base = (payload.get("home") or None)
    driver.license_class = (payload.get("license") or None)
    driver.rating = _driver_rating_from_status(payload.get("status"))

    return driver


def _upsert_vehicle(db: Session, payload: dict[str, Any]) -> Vehicle:
    vin = str(payload.get("vin") or "").strip()
    if not vin:
        raise ValueError("Vehicle is missing 'vin'")

    vehicle = db.query(Vehicle).filter(Vehicle.vin == vin).one_or_none()
    if vehicle is None:
        vehicle = Vehicle(id=vin, vin=vin, plate=str(payload.get("plate") or "").strip(), name=str(payload.get("name") or "").strip())
        db.add(vehicle)

    vehicle.name = str(payload.get("name") or vehicle.name or "").strip() or vehicle.name
    vehicle.plate = str(payload.get("plate") or vehicle.plate or "").strip() or vehicle.plate

    vehicle.series = payload.get("series") or None
    vehicle.tag = payload.get("tag") or None

    vehicle.status_main = payload.get("status") or None
    secondary: list[str] = []
    for key in ("status2", "status3"):
        value = payload.get(key)
        if value:
            secondary.append(str(value))
    vehicle.status_secondary = secondary

    vehicle.cargo_desc = payload.get("cargo") or None
    vehicle.route_code = payload.get("route") or None

    vehicle.origin = payload.get("origin") or None
    vehicle.destination = payload.get("destination") or None

    vehicle.depart_at = payload.get("depart") or None
    vehicle.eta_at = payload.get("eta") or None

    vehicle.avg_speed = payload.get("avgSpeed")
    vehicle.load_pct = payload.get("load")

    vehicle.fuel_pct = payload.get("fuel")
    vehicle.tank_l = payload.get("tank")

    vehicle.pallets_capacity = payload.get("pallets")

    vehicle.health_pct = _parse_percent(payload.get("health"))

    vehicle.distance_total_km = payload.get("distanceTotal")
    vehicle.distance_done_km = payload.get("distanceDone")

    vehicle.image_url = payload.get("image") or None

    driver_profile_id = payload.get("driverId")
    vehicle.driver_profile_id = str(driver_profile_id) if driver_profile_id else None

    return vehicle


def import_data(json_path: Path) -> tuple[int, int]:
    with json_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    drivers = data.get("drivers") or []
    vehicles = data.get("vehicles") or []

    if not isinstance(drivers, list) or not isinstance(vehicles, list):
        raise ValueError("Expected 'drivers' and 'vehicles' to be lists")

    db = SessionLocal()
    try:
        driver_count = 0
        for d in drivers:
            if isinstance(d, dict):
                _upsert_driver(db, d)
                driver_count += 1

        vehicle_count = 0
        for v in vehicles:
            if isinstance(v, dict):
                _upsert_vehicle(db, v)
                vehicle_count += 1

        db.commit()
        return driver_count, vehicle_count
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import pseudo-data from frontend/assets/data/data.json")
    parser.add_argument("--path", type=str, default=str(_default_json_path()), help="Path to data.json")
    args = parser.parse_args()

    json_path = Path(args.path).expanduser().resolve()
    if not json_path.exists():
        raise SystemExit(f"data.json not found: {json_path}")

    driver_count, vehicle_count = import_data(json_path)
    print(f"Imported/updated: drivers={driver_count}, vehicles={vehicle_count}")


if __name__ == "__main__":
    main()
