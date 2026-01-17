"""Seed demo data for RoutoX."""
import uuid
from app.db.session import SessionLocal
from app.models.user import User
from app.models.company import Company
from app.models.vehicle import Vehicle
from app.models.driver import DriverProfile
from app.models.enums import UserRole
from app.core.security import hash_password


# Demo driver profiles data
DEMO_DRIVERS = [
    {'name': 'Артем Филатов', 'phone': '+7 (917) 555-44-33', 'home_base': 'Казань', 'license_class': 'CE', 'rating': '98%'},
    {'name': 'Антон Нечаев', 'phone': '+7 (926) 330-22-11', 'home_base': 'Москва', 'license_class': 'CE', 'rating': '96%'},
    {'name': 'Никита Крылов', 'phone': '+7 (910) 115-44-20', 'home_base': 'Н. Новгород', 'license_class': 'CE', 'rating': '94%'},
    {'name': 'Иван Гордеев', 'phone': '+7 (917) 332-18-77', 'home_base': 'Казань', 'license_class': 'CE', 'rating': '95%'},
    {'name': 'Павел Рогов', 'phone': '+7 (928) 554-77-19', 'home_base': 'Ростов', 'license_class': 'CE', 'rating': '93%'},
    {'name': 'Даниил Сорокин', 'phone': '+375 (29) 744-88-12', 'home_base': 'Минск', 'license_class': 'CE', 'rating': '92%'},
    {'name': 'Сергей Баранов', 'phone': '+7 (927) 555-14-71', 'home_base': 'Самара', 'license_class': 'CE', 'rating': '97%'},
    {'name': 'Владимир Ломакин', 'phone': '+7 (912) 330-09-20', 'home_base': 'Пермь', 'license_class': 'CE', 'rating': '95%'},
]


def seed_demo():
    db = SessionLocal()
    
    try:
        # Get or create demo company
        company = db.query(Company).filter(Company.slug == 'demo').first()
        if not company:
            company = Company(id=str(uuid.uuid4()), name='Demo Company', slug='demo')
            db.add(company)
            db.commit()
            db.refresh(company)
            print(f'Created company: {company.name}')
        else:
            print(f'Company exists: {company.name}')

        # Demo users
        demo_users = [
            ('owner@example.com', 'owner123', UserRole.owner),
            ('admin@example.com', 'admin123', UserRole.admin),
            ('driver@example.com', 'driver123', UserRole.driver),
        ]

        created_users = {}
        for email, password, role in demo_users:
            existing = db.query(User).filter(User.email == email).first()
            if not existing:
                user = User(
                    id=str(uuid.uuid4()),
                    company_id=company.id,
                    email=email,
                    password_hash=hash_password(password),
                    role=role,
                    is_active=True
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                created_users[role] = user
                print(f'Created user: {email} ({role.value})')
            else:
                created_users[role] = existing
                print(f'User exists: {email}')

        # Create driver profiles
        driver_profiles = []
        for i, drv_data in enumerate(DEMO_DRIVERS):
            existing = db.query(DriverProfile).filter(
                DriverProfile.company_id == company.id,
                DriverProfile.name == drv_data['name']
            ).first()
            
            if not existing:
                # Link first driver to the driver user
                user_id = created_users.get(UserRole.driver).id if i == 0 and UserRole.driver in created_users else None
                
                driver_profile = DriverProfile(
                    id=str(uuid.uuid4()),
                    company_id=company.id,
                    user_id=user_id,
                    name=drv_data['name'],
                    phone=drv_data['phone'],
                    home_base=drv_data['home_base'],
                    license_class=drv_data['license_class'],
                    rating=drv_data['rating']
                )
                db.add(driver_profile)
                db.commit()
                db.refresh(driver_profile)
                driver_profiles.append(driver_profile)
                print(f'Created driver profile: {driver_profile.name} - {driver_profile.phone}')
            else:
                driver_profiles.append(existing)
                print(f'Driver profile exists: {existing.name}')

        # Demo vehicles
        demo_vehicles = [
            {'name': 'Volvo FH16 #1', 'plate': 'А001АА77', 'vin': 'VIN00000000000001', 'origin': 'Москва', 'destination': 'Санкт-Петербург', 'load_pct': 85, 'fuel_pct': 70, 'status_main': 'В пути', 'driver_idx': 0},
            {'name': 'MAN TGX #2', 'plate': 'В002ВВ77', 'vin': 'VIN00000000000002', 'origin': 'Казань', 'destination': 'Нижний Новгород', 'load_pct': 60, 'fuel_pct': 45, 'status_main': 'В пути', 'driver_idx': 1},
            {'name': 'Scania R500 #3', 'plate': 'С003СС77', 'vin': 'VIN00000000000003', 'origin': 'Екатеринбург', 'destination': 'Челябинск', 'load_pct': 100, 'fuel_pct': 90, 'status_main': 'В пути', 'driver_idx': 2},
            {'name': 'Mercedes Actros #4', 'plate': 'Е004ЕЕ77', 'vin': 'VIN00000000000004', 'origin': 'Ростов-на-Дону', 'destination': 'Краснодар', 'load_pct': 75, 'fuel_pct': 55, 'status_main': 'В пути', 'driver_idx': 3},
            {'name': 'DAF XF #5', 'plate': 'К005КК77', 'vin': 'VIN00000000000005', 'origin': 'Самара', 'destination': 'Саратов', 'load_pct': 50, 'fuel_pct': 80, 'status_main': 'В пути', 'driver_idx': 4},
            {'name': 'Iveco Stralis #6', 'plate': 'М006ММ77', 'vin': 'VIN00000000000006', 'origin': None, 'destination': None, 'load_pct': 0, 'fuel_pct': 95, 'status_main': 'Свободен', 'driver_idx': 5},
            {'name': 'Renault T #7', 'plate': 'О007ОО77', 'vin': 'VIN00000000000007', 'origin': 'Воронеж', 'destination': 'Липецк', 'load_pct': 90, 'fuel_pct': 65, 'status_main': 'В пути', 'driver_idx': 6},
            {'name': 'КАМАЗ 5490 #8', 'plate': 'Р008РР77', 'vin': 'VIN00000000000008', 'origin': None, 'destination': None, 'load_pct': 0, 'fuel_pct': 100, 'status_main': 'Свободен', 'driver_idx': 7},
        ]

        for v_data in demo_vehicles:
            existing = db.query(Vehicle).filter(Vehicle.plate == v_data['plate']).first()
            driver_profile_id = driver_profiles[v_data['driver_idx']].id if v_data['driver_idx'] < len(driver_profiles) else None
            
            if not existing:
                vehicle = Vehicle(
                    id=str(uuid.uuid4()),
                    company_id=company.id,
                    name=v_data['name'],
                    plate=v_data['plate'],
                    vin=v_data['vin'],
                    origin=v_data['origin'],
                    destination=v_data['destination'],
                    load_pct=v_data['load_pct'],
                    fuel_pct=v_data['fuel_pct'],
                    status_main=v_data['status_main'],
                    health_pct=95.0,
                    avg_speed=75.0,
                    distance_total_km=500.0 if v_data['origin'] else 0,
                    distance_done_km=250.0 if v_data['origin'] else 0,
                    driver_profile_id=driver_profile_id,
                )
                db.add(vehicle)
                print(f'Created vehicle: {v_data["name"]} with driver {driver_profiles[v_data["driver_idx"]].name if driver_profile_id else "None"}')
            else:
                # Update driver assignment if needed
                if existing.driver_profile_id != driver_profile_id:
                    existing.driver_profile_id = driver_profile_id
                    print(f'Updated vehicle driver: {v_data["name"]}')
                else:
                    print(f'Vehicle exists: {v_data["name"]}')
        
        db.commit()
        print('Seed complete!')
        
    finally:
        db.close()


if __name__ == '__main__':
    seed_demo()
