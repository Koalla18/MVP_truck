"""Check driver data in database."""
from app.db.session import SessionLocal
from app.models.vehicle import Vehicle
from app.models.driver import DriverProfile

def check_drivers():
    db = SessionLocal()
    try:
        print("=== All Driver Profiles ===")
        drivers = db.query(DriverProfile).all()
        for d in drivers:
            print(f"  {d.name}: phone={d.phone}")
        
        print("\n=== Vehicles with Drivers ===")
        vehicles = db.query(Vehicle).all()
        for v in vehicles:
            print(f"Vehicle: {v.name}")
            if v.driver:
                print(f"  Driver: {v.driver.name}, Phone: {v.driver.phone}")
            else:
                print("  Driver: None")
    finally:
        db.close()

if __name__ == '__main__':
    check_drivers()
