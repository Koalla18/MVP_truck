# RoutoX - Technical Architecture Overview

## 🎨 Архитектурные паттерны

### Backend Architecture

#### Layered Architecture (Clean Architecture inspired)

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (FastAPI)                  │
│  /api/v1/routes/* - HTTP endpoints, request validation  │
│  deps.py - Dependency injection (auth, db sessions)     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Service Layer                          │
│  Business logic, orchestration, domain rules            │
│  services/audit.py - Audit event creation               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Data Layer (ORM)                       │
│  models/* - SQLAlchemy models (DB schema)               │
│  schemas/* - Pydantic models (DTOs, validation)         │
│  db/session.py - Database sessions                      │
└─────────────────────────────────────────────────────────┘
```

**Принципы**:
- **Separation of Concerns**: каждый слой отвечает за свою задачу
- **Dependency Inversion**: верхние слои зависят от абстракций, а не конкретных реализаций
- **Single Responsibility**: один модуль = одна ответственность
- **DRY (Don't Repeat Yourself)**: переиспользование через service layer

#### Dependency Injection Pattern

`api/v1/deps.py`:
```python
# Injection для DB session
async def get_db() -> AsyncGenerator:
    async with SessionLocal() as session:
        yield session

# Injection для текущего пользователя
async def get_current_user(token: str, db: Session) -> User:
    # JWT validation + DB lookup
    return user

# Injection для проверки роли
def require_role(required_roles: list[UserRole]):
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(403)
        return current_user
    return checker
```

**Использование**:
```python
@router.post("/vehicles")
async def create_vehicle(
    data: VehicleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role([UserRole.owner, UserRole.admin]))
):
    # user уже аутентифицирован и авторизован
    vehicle = Vehicle(**data.dict(), created_by=user.id)
    db.add(vehicle)
    await audit_service.log_event("vehicle", vehicle.id, "created", user.id)
    return vehicle
```

#### Service Layer Pattern

Изоляция бизнес-логики от API и DB:

```python
# services/audit.py
class AuditService:
    def __init__(self, db: Session):
        self.db = db
    
    async def log_event(
        self, 
        entity_type: str,
        entity_id: str,
        action: str,
        payload: dict,
        actor_user_id: str
    ):
        event = AuditEvent(
            id=str(uuid4()),
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            payload=payload,
            actor_user_id=actor_user_id
        )
        self.db.add(event)
        await self.db.commit()
        return event
```

### Frontend Architecture

#### Module Pattern

```javascript
// app.js структура
const RoutoXApp = {
  // Configuration
  config: {
    apiBaseUrl: "http://localhost:8000/api/v1",
    refreshInterval: 30000 // 30 sec
  },
  
  // State management
  state: {
    vehicles: [],
    selectedVehicle: null,
    currentUser: null,
    filters: {}
  },
  
  // API client
  api: {
    async request(endpoint, options) { ... },
    async login(email, password) { ... },
    async getVehicles() { ... }
  },
  
  // UI rendering
  ui: {
    renderVehicleList(vehicles) { ... },
    renderVehicleDetail(vehicle) { ... },
    showNotification(message, type) { ... }
  },
  
  // Event handlers
  handlers: {
    onVehicleSelect(id) { ... },
    onFilterChange(filter) { ... }
  },
  
  // Initialization
  async init() {
    await this.api.loadCurrentUser();
    await this.loadVehicles();
    this.setupEventListeners();
    this.startPolling();
  }
};
```

#### Component-based UI

```javascript
// Переиспользуемые компоненты
function renderStatusBadge(status, type = "main") {
  const colors = {
    "В пути": "green",
    "На стоянке": "blue",
    "Техобслуживание": "orange",
    "Проблема": "red"
  };
  
  return `
    <span class="badge badge-${colors[status] || 'gray'}">
      ${status}
    </span>
  `;
}

function renderProgressBar(value, max = 100, label = "") {
  const percent = (value / max) * 100;
  return `
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${percent}%"></div>
      <span class="progress-label">${label}: ${value}/${max}</span>
    </div>
  `;
}
```

---

## 🔄 Data Flow

### Типичный запрос (создание тревоги)

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│ Frontend │      │   API    │      │ Service  │      │    DB    │
└─────┬────┘      └─────┬────┘      └─────┬────┘      └─────┬────┘
      │                 │                 │                 │
      │ POST /alerts    │                 │                 │
      │ + JWT token     │                 │                 │
      ├────────────────>│                 │                 │
      │                 │                 │                 │
      │                 │ Validate JWT    │                 │
      │                 │ Check role      │                 │
      │                 │ (owner/admin)   │                 │
      │                 │                 │                 │
      │                 │ Create alert    │                 │
      │                 ├────────────────>│                 │
      │                 │                 │                 │
      │                 │                 │ INSERT alert    │
      │                 │                 ├────────────────>│
      │                 │                 │<────────────────┤
      │                 │                 │                 │
      │                 │                 │ INSERT audit    │
      │                 │                 ├────────────────>│
      │                 │                 │<────────────────┤
      │                 │<────────────────┤                 │
      │<────────────────┤                 │                 │
      │ 201 Created     │                 │                 │
      │ { alert data }  │                 │                 │
      │                 │                 │                 │
```

### Audit Trail Example

Любое изменение данных:

```python
# 1. Выполнение основного действия
vehicle.status_main = "Техобслуживание"
db.commit()

# 2. Логирование в audit
audit_event = AuditEvent(
    entity_type="vehicle",
    entity_id=vehicle.id,
    action="status_changed",
    payload={
        "old_status": "В пути",
        "new_status": "Техобслуживание",
        "timestamp": datetime.utcnow().isoformat()
    },
    actor_user_id=current_user.id
)
db.add(audit_event)
db.commit()

# 3. Результат в БД:
# audit_events:
# id | entity_type | entity_id | action         | payload                | actor_user_id | created_at
# ---|-------------|-----------|----------------|------------------------|---------------|------------
# uuid| vehicle     | veh-123   | status_changed | {"old_status": "..."}  | user-456      | 2025-12-21...
```

---

## 🔐 Security Architecture

### Authentication Flow (JWT)

```
┌──────────┐                          ┌──────────┐
│  Client  │                          │  Server  │
└─────┬────┘                          └─────┬────┘
      │                                     │
      │ POST /auth/login                    │
      │ { email, password }                 │
      ├────────────────────────────────────>│
      │                                     │
      │                                     │ 1. Найти user по email
      │                                     │ 2. Сверить bcrypt hash
      │                                     │ 3. Создать JWT token:
      │                                     │    payload = {
      │                                     │      sub: user.id,
      │                                     │      role: user.role,
      │                                     │      exp: now + 7 days
      │                                     │    }
      │                                     │    token = sign(payload, SECRET)
      │<────────────────────────────────────┤
      │ { access_token: "eyJ...", ... }     │
      │                                     │
      │ Store token in localStorage         │
      │                                     │
      │ GET /api/v1/vehicles                │
      │ Authorization: Bearer eyJ...        │
      ├────────────────────────────────────>│
      │                                     │
      │                                     │ 1. Extract token
      │                                     │ 2. Verify signature
      │                                     │ 3. Check expiration
      │                                     │ 4. Load user from DB
      │                                     │ 5. Check permissions
      │<────────────────────────────────────┤
      │ { vehicles: [...] }                 │
      │                                     │
```

### RBAC Implementation

```python
# Декоратор для проверки прав
def require_role(*allowed_roles: UserRole):
    async def dependency(
        current_user: User = Depends(get_current_user)
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Required roles: {allowed_roles}"
            )
        return current_user
    return dependency

# Использование в routes
@router.post("/vehicles")
async def create_vehicle(
    data: VehicleCreate,
    current_user: User = Depends(require_role(UserRole.owner, UserRole.admin))
):
    # Только owner и admin могут создавать транспорт
    ...

# Row-level security для drivers
@router.get("/vehicles")
async def list_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Vehicle)
    
    # Driver видит только назначенные ему ТС
    if current_user.role == UserRole.driver:
        driver_profile = db.query(DriverProfile).filter(
            DriverProfile.user_id == current_user.id
        ).first()
        
        if driver_profile:
            query = query.filter(Vehicle.driver_profile_id == driver_profile.id)
        else:
            return []  # У водителя нет профиля - нет доступа
    
    # Owner и admin видят все
    return query.all()
```

### CORS Configuration

```python
# core/settings.py
class Settings(BaseSettings):
    cors_origins: list[str] = [
        "http://localhost:3000",  # Dev frontend
        "http://localhost:8080",  # Alternative dev port
        "https://routox.company.com"  # Production
    ]

# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 📊 Database Design Patterns

### Soft Delete Pattern (опционально)

Для важных данных (можно добавить):
```python
class Vehicle(Base):
    ...
    deleted_at = Column(DateTime, nullable=True, index=True)
    
    @property
    def is_deleted(self):
        return self.deleted_at is not None

# В queries:
query = query.filter(Vehicle.deleted_at.is_(None))
```

### Audit Pattern (уже реализован)

Каждое изменение → запись в audit_events:
- Неизменяемые записи (write-only)
- JSONB payload для гибкости
- Индексы на (entity_type, entity_id) для быстрого поиска истории

### Telemetry Pattern

Обновление телеметрии отдельно от основных данных:
```python
# Endpoint для GPS-трекеров (batch update)
@router.post("/telemetry/batch")
async def update_telemetry(
    updates: list[TelemetryUpdate],
    api_key: str = Depends(verify_telemetry_api_key)
):
    for update in updates:
        vehicle = db.get(Vehicle, update.vehicle_id)
        vehicle.fuel_pct = update.fuel_pct
        vehicle.load_pct = update.load_pct
        vehicle.avg_speed = update.avg_speed
        vehicle.telemetry_updated_at = datetime.utcnow()
    
    db.commit()
    # Опционально: не логировать каждое обновление в audit (слишком много данных)
```

---

## 🚀 Performance Considerations

### Database Indexing Strategy

```sql
-- Критичные для производительности индексы:

-- User lookups (аутентификация)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Vehicle queries (основная сущность)
CREATE INDEX idx_vehicles_plate ON vehicles(plate);
CREATE INDEX idx_vehicles_vin ON vehicles(vin);
CREATE INDEX idx_vehicles_driver ON vehicles(driver_profile_id);

-- Order filtering
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_vehicle ON orders(vehicle_id);

-- Audit queries
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_events(created_at DESC);
CREATE INDEX idx_audit_actor ON audit_events(actor_user_id);

-- Alert filtering
CREATE INDEX idx_alerts_vehicle ON alerts(vehicle_id);
CREATE INDEX idx_alerts_status ON alerts(status);
```

### Query Optimization

```python
# ❌ N+1 query problem
vehicles = db.query(Vehicle).all()
for vehicle in vehicles:
    driver = vehicle.driver_profile  # Отдельный запрос для каждого!

# ✅ Eager loading
from sqlalchemy.orm import joinedload

vehicles = db.query(Vehicle)\
    .options(joinedload(Vehicle.driver_profile))\
    .all()  # Один запрос с JOIN
```

### Caching Strategy (для будущего)

```python
# Redis для кэширования частых запросов
from redis import Redis
import json

redis = Redis(host='localhost', port=6379)

async def get_vehicles_cached():
    cache_key = "vehicles:all"
    cached = redis.get(cache_key)
    
    if cached:
        return json.loads(cached)
    
    vehicles = db.query(Vehicle).all()
    redis.setex(cache_key, 60, json.dumps(vehicles))  # TTL 60 sec
    return vehicles
```

### Frontend Optimization

```javascript
// Debounce для search inputs
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const searchVehicles = debounce(async (query) => {
  const results = await api.request(`/vehicles?search=${query}`);
  renderResults(results);
}, 300);

// Виртуализация для больших списков
// (для React/Vue можно использовать react-window/vue-virtual-scroller)

// Lazy loading изображений
<img src="placeholder.jpg" data-src="real-image.jpg" class="lazy">

const lazyImages = document.querySelectorAll('.lazy');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src;
      observer.unobserve(img);
    }
  });
});
lazyImages.forEach(img => observer.observe(img));
```

---

## 🧩 Integration Points (для будущего)

### GPS/Telemetry Integration

```python
# Webhook endpoint для GPS-трекеров
@router.post("/webhooks/telemetry/{provider}")
async def telemetry_webhook(
    provider: str,  # "wialon", "gps_tracker_x", etc.
    data: dict,
    signature: str = Header(...),
    db: Session = Depends(get_db)
):
    # 1. Verify webhook signature
    if not verify_signature(provider, data, signature):
        raise HTTPException(401, "Invalid signature")
    
    # 2. Parse provider-specific format
    parsed = TelemetryParser.parse(provider, data)
    
    # 3. Update vehicle telemetry
    vehicle = db.get(Vehicle, parsed.vehicle_id)
    vehicle.fuel_pct = parsed.fuel_pct
    vehicle.avg_speed = parsed.speed
    vehicle.telemetry_updated_at = datetime.utcnow()
    
    # 4. Optional: trigger alerts
    if parsed.fuel_pct < 10:
        create_alert(vehicle.id, "low_fuel", "Низкий уровень топлива")
    
    db.commit()
    return {"status": "ok"}
```

### Notification Service Architecture

```python
# Message Queue pattern (Celery/RQ)
from celery import Celery

celery_app = Celery('routox', broker='redis://localhost:6379')

@celery_app.task
def send_notification(
    user_id: str,
    channel: str,  # "email", "sms", "push", "telegram"
    message: str
):
    user = db.get(User, user_id)
    
    if channel == "email":
        EmailService.send(user.email, message)
    elif channel == "sms":
        SMSService.send(user.phone, message)
    elif channel == "telegram":
        TelegramBot.send(user.telegram_id, message)
    
    # Log notification in audit
    audit_service.log_event(
        "notification", user_id, "sent",
        {"channel": channel, "message": message}
    )

# Использование
@router.post("/alerts")
async def create_alert(...):
    alert = Alert(...)
    db.add(alert)
    db.commit()
    
    # Асинхронная отправка уведомления
    send_notification.delay(
        user_id=driver.user_id,
        channel="push",
        message=f"Новая тревога: {alert.message}"
    )
```

### External API Integration Example

```python
# Интеграция с картами (например, Yandex/Google)
class MapsService:
    @staticmethod
    async def geocode(address: str) -> dict:
        """Получить координаты по адресу"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://geocode-maps.yandex.ru/1.x/",
                params={
                    "apikey": settings.yandex_maps_api_key,
                    "geocode": address,
                    "format": "json"
                }
            )
            data = response.json()
            return {
                "lat": ...,
                "lon": ...
            }
    
    @staticmethod
    async def calculate_route(origin: str, destination: str) -> dict:
        """Рассчитать маршрут"""
        # Implementation...
        return {
            "distance_km": 150.5,
            "duration_minutes": 180,
            "route_points": [...]
        }
```

---

## 📈 Scalability & Growth

### Horizontal Scaling

```yaml
# docker-compose для масштабирования
services:
  backend:
    build: ./backend
    deploy:
      replicas: 3  # Несколько инстансов
    environment:
      - DATABASE_URL=postgresql://...
    depends_on:
      - db
      - redis
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - backend
    # Load balancer для backend инстансов
```

### Database Sharding Strategy (если понадобится)

```python
# Шардирование по company_id (для мультитенантности)
# Shard 1: companies 1-1000
# Shard 2: companies 1001-2000
# ...

def get_shard_for_company(company_id: int) -> str:
    shard_number = (company_id - 1) // 1000 + 1
    return f"shard_{shard_number}"

# Routing в приложении
class ShardedSession:
    def __init__(self, company_id: int):
        shard = get_shard_for_company(company_id)
        self.engine = create_engine(SHARD_URLS[shard])
        self.session = Session(self.engine)
```

### Microservices Migration Path

```
Текущий монолит:
┌─────────────────────────────────┐
│       RoutoX Backend API        │
│  (vehicles, orders, alerts, ..) │
└─────────────────────────────────┘

Будущая архитектура:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Vehicle    │  │    Order     │  │    Alert     │
│   Service    │  │   Service    │  │   Service    │
└───────┬──────┘  └───────┬──────┘  └───────┬──────┘
        │                 │                 │
        └─────────────────┴─────────────────┘
                         │
              ┌──────────▼──────────┐
              │    API Gateway      │
              │  (Kong/Traefik)     │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │      Frontend       │
              └─────────────────────┘
```

---

## 🔍 Monitoring & Observability

### Logging Strategy

```python
import logging
from pythonjsonlogger import jsonlogger

# Structured logging
logger = logging.getLogger("routox")
handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter(
    '%(asctime)s %(name)s %(levelname)s %(message)s'
)
handler.setFormatter(formatter)
logger.addHandler(handler)

# Использование
logger.info("Vehicle created", extra={
    "vehicle_id": vehicle.id,
    "created_by": user.id,
    "action": "create_vehicle"
})

# Output:
# {"asctime": "2025-12-21 10:30:00", "name": "routox", 
#  "levelname": "INFO", "message": "Vehicle created",
#  "vehicle_id": "uuid", "created_by": "uuid", ...}
```

### Metrics (Prometheus)

```python
from prometheus_client import Counter, Histogram, Gauge

# Метрики API
request_count = Counter('api_requests_total', 'Total API requests', ['method', 'endpoint'])
request_duration = Histogram('api_request_duration_seconds', 'API request duration')
active_users = Gauge('active_users', 'Number of active users')

@app.middleware("http")
async def monitor_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    
    request_count.labels(request.method, request.url.path).inc()
    request_duration.observe(duration)
    
    return response

# Endpoint для Prometheus scraping
@app.get("/metrics")
def metrics():
    return Response(
        content=generate_latest(),
        media_type="text/plain"
    )
```

### Health Checks

```python
@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    checks = {}
    
    # Database check
    try:
        db.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
    
    # Redis check (если используется)
    try:
        redis.ping()
        checks["redis"] = "ok"
    except:
        checks["redis"] = "error"
    
    overall_status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    
    return {
        "status": overall_status,
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat()
    }
```

---

## 🎓 Best Practices & Conventions

### Error Handling

```python
# Кастомные exceptions
class RoutoXException(Exception):
    """Base exception"""
    pass

class ResourceNotFound(RoutoXException):
    """Resource not found (404)"""
    pass

class PermissionDenied(RoutoXException):
    """Permission denied (403)"""
    pass

# Global exception handler
@app.exception_handler(RoutoXException)
async def routox_exception_handler(request: Request, exc: RoutoXException):
    status_codes = {
        ResourceNotFound: 404,
        PermissionDenied: 403
    }
    
    return JSONResponse(
        status_code=status_codes.get(type(exc), 500),
        content={"detail": str(exc)}
    )
```

### API Versioning

```python
# Поддержка нескольких версий API
app.include_router(api_v1_router, prefix="/api/v1")
app.include_router(api_v2_router, prefix="/api/v2")  # Будущее

# Deprecation warnings
@app.get("/api/v1/old-endpoint")
async def old_endpoint(response: Response):
    response.headers["X-Deprecation-Warning"] = \
        "This endpoint is deprecated. Use /api/v2/new-endpoint"
    return {"data": "..."}
```

### Testing Strategy

```python
# tests/conftest.py
@pytest.fixture
async def test_db():
    """Тестовая БД"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

# tests/test_vehicles.py
async def test_create_vehicle(test_db, test_client):
    response = await test_client.post(
        "/api/v1/vehicles",
        json={"name": "Test Vehicle", "plate": "TEST123", ...},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 201
    assert response.json()["name"] == "Test Vehicle"
    
    # Проверка audit
    audit_events = await test_db.query(AuditEvent).all()
    assert len(audit_events) == 1
    assert audit_events[0].action == "created"
```

---

**Документ актуален на**: 21 декабря 2025 г.  
**Ответственный за архитектуру**: Team Lead (Backend)
