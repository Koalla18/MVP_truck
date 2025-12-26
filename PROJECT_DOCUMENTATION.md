# RoutoX - Документация проекта

## 🎯 Обзор проекта

**RoutoX** — система управления транспортной логистикой для коммерческих перевозок. Представляет собой прототип комплексной платформы для мониторинга флота, управления заказами, контроля водителей и аудита операций.

### Назначение
Централизованная система для:
- Владельцев транспортных компаний (управление всей инфраструктурой)
- Логистов/администраторов (оперативное управление рейсами и флотом)
- Водителей (мобильный доступ к назначенным заданиям)

### Основные возможности
- ✅ Управление флотом транспортных средств в реальном времени
- ✅ Система заказов и маршрутизация
- ✅ Многоролевой доступ с разграничением прав
- ✅ Система оповещений и тревог для водителей
- ✅ Полный аудит всех операций (неизменяемый журнал событий)
- ✅ Мониторинг телеметрии (топливо, загрузка, местоположение, техническое состояние)
- 🔄 Управление инвентарем/складом (в разработке)
- 🔄 Интеграция с телематикой/GPS (заглушка)
- 🔄 Видеонаблюдение транспорта (концептуально)

---

## 🏗️ Архитектура

### Технологический стек

#### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL 15+
- **ORM**: SQLAlchemy 2.0
- **Migrations**: Alembic
- **Auth**: JWT токены
- **Validation**: Pydantic V2
- **API**: RESTful + OpenAPI/Swagger

#### Frontend
- **Type**: Single Page Application (статический прототип)
- **Stack**: Vanilla JavaScript (ES6+)
- **Styles**: Custom CSS
- **Architecture**: Component-based модули

#### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: (планируется Nginx/Traefik)
- **CI/CD**: (to be implemented)

### Структура проекта

```
RoutoX/
├── backend/                 # Backend FastAPI приложение
│   ├── app/
│   │   ├── api/v1/          # API endpoints (версионирование)
│   │   │   ├── routes/      # Модульные роуты по доменам
│   │   │   ├── deps.py      # Dependency injection (auth, db)
│   │   │   └── router.py    # Главный роутер API
│   │   ├── core/            # Ядро приложения
│   │   │   ├── security.py  # JWT, хеширование паролей
│   │   │   └── settings.py  # Конфигурация через Pydantic Settings
│   │   ├── db/              # Database layer
│   │   │   ├── base.py      # Declarative Base
│   │   │   └── session.py   # SQLAlchemy session management
│   │   ├── models/          # SQLAlchemy модели (ORM)
│   │   ├── schemas/         # Pydantic схемы (DTO)
│   │   ├── services/        # Бизнес-логика (Service layer)
│   │   ├── alembic/         # Database migrations
│   │   └── scripts/         # Утилиты (импорт данных, seed)
│   ├── docs/                # Дополнительная документация
│   ├── Dockerfile           # Backend контейнер
│   └── docker-compose.yml   # Оркестрация сервисов
│
└── frontend/                # Frontend (статический прототип)
    ├── *.html               # Страницы интерфейса
    └── assets/
        ├── css/             # Стили
        ├── js/              # JavaScript модули
        ├── data/            # Моковые данные для разработки
        └── images/          # Статические ресурсы
```

---

## 📊 Доменная модель

### Основные сущности

#### 1. User (Пользователь)
**Назначение**: Аутентификация и авторизация пользователей системы

```python
- id: UUID (PK)
- email: String (unique, indexed)
- password_hash: String (bcrypt)
- role: Enum [owner, admin, driver]
- is_active: Boolean
- created_at: DateTime (UTC+0)
```

**Роли и права**:
- `owner` — владелец компании (полный доступ ко всем данным и операциям)
- `admin` — логист/администратор (управление флотом, заказами, водителями)
- `driver` — водитель (доступ только к назначенным транспортным средствам и заданиям)

#### 2. DriverProfile (Профиль водителя)
**Назначение**: Расширенная информация о водителях

```python
- id: UUID (PK)
- user_id: FK -> User (nullable, опциональная связь с учетной записью)
- name: String (ФИО)
- phone: String
- home_base: String (базовое местоположение)
- license_class: String (категория прав)
- rating: String (рейтинг водителя)
- created_at: DateTime
```

**Особенности**:
- Профиль может существовать без привязки к User (для внешних водителей)
- Один User может иметь только один DriverProfile

#### 3. Vehicle (Транспортное средство)
**Назначение**: Ядро системы - информация о транспорте и его состоянии

```python
# Идентификация
- id: UUID (PK)
- name: String (пользовательское имя, например "Volvo #12")
- plate: String (unique, indexed, госномер)
- vin: String (unique, indexed, VIN-код)
- series: String (серия/модель)
- tag: String (метка для группировки)

# Статус и состояние
- status_main: String (основной статус: "В пути", "На стоянке", etc.)
- status_secondary: Array[String] (до 2 дополнительных статусов)

# Текущий маршрут
- cargo_desc: String (описание груза)
- route_code: String (код маршрута)
- origin: String (откуда)
- destination: String (куда)
- depart_at: String (время отправления)
- eta_at: String (ожидаемое время прибытия)

# Телеметрия
- load_pct: Float (загрузка %, 0-100)
- fuel_pct: Float (топливо %, 0-100)
- tank_l: Integer (объем бака, литры)
- pallets_capacity: Integer (вместимость паллет)
- distance_total_km: Float (общая дистанция маршрута)
- distance_done_km: Float (пройденная дистанция)
- avg_speed: Float (средняя скорость)
- health_pct: Float (техническое состояние %)

# Связи
- driver_profile_id: FK -> DriverProfile (nullable)
- image_url: String (фото транспорта)

# Метаданные
- telemetry_updated_at: DateTime (последнее обновление телеметрии)
- created_at: DateTime
```

**Ключевые особенности**:
- Телеметрия обновляется через отдельные endpoints (имитация GPS-трекеров)
- Система поддерживает множественные статусы для гибкости UI
- VIN и госномер уникальны на уровне БД

#### 4. Order (Заказ/Рейс)
**Назначение**: Управление логистическими заданиями

```python
- id: UUID (PK)
- title: String (название рейса)
- cargo_desc: Text (описание груза)
- origin: String (пункт отправления)
- destination: String (пункт назначения)
- planned_depart_at: DateTime (плановое отправление)
- planned_arrive_at: DateTime (плановое прибытие)
- status: Enum [new, assigned, in_progress, completed, cancelled]

# Связи с системой
- vehicle_id: FK -> Vehicle (nullable)
- created_by_user_id: FK -> User (кто создал)
- assigned_driver_user_id: FK -> User (назначенный водитель)
- accepted_by_user_id: FK -> User (кто принял)
- accepted_at: DateTime (время принятия)

- created_at: DateTime
```

**Workflow статусов**:
1. `new` → создан логистом
2. `assigned` → назначен водителю и транспорту
3. `in_progress` → рейс начат
4. `completed` → рейс завершен
5. `cancelled` → отменен

#### 5. Alert (Тревога/Оповещение)
**Назначение**: Критические оповещения для водителей

```python
- id: UUID (PK)
- vehicle_id: FK -> Vehicle (CASCADE on delete)
- created_by_user_id: FK -> User (кто создал тревогу)
- alert_type: String (тип: breakdown, cargo_issue, route_change)
- message: Text (текст сообщения)
- status: Enum [created, delivered, acknowledged, closed]

# Lifecycle tracking
- delivered_to_driver_at: DateTime (когда доставлено водителю)
- acknowledged_at: DateTime (когда водитель подтвердил)
- created_at: DateTime
```

**Важно**: 
- Alert нельзя удалить водителю (защита от удаления доказательств)
- Система отслеживает доставку и подтверждение
- Используется для emergency-коммуникаций

#### 6. AuditEvent (Аудит)
**Назначение**: Неизменяемый журнал всех действий в системе

```python
- id: UUID (PK)
- entity_type: String (indexed, тип сущности: vehicle, order, user, etc.)
- entity_id: String (indexed, ID затронутой сущности)
- action: String (indexed, действие: created, updated, deleted, status_changed)
- payload: JSONB (полные данные изменений)
- actor_user_id: FK -> User (кто совершил действие)
- created_at: DateTime (indexed)
```

**Аудируемые события**:
- Создание/изменение/удаление транспорта
- Смена статусов заказов
- Отправка тревог
- Изменения профилей водителей
- Операции с инвентарем
- Изменения телеметрии (опционально)

**Принципы**:
- Write-only (запись без обновлений)
- Полная трассировка для compliance
- Используется для расследований инцидентов

---

## 🔐 Система безопасности

### Аутентификация
- **Метод**: JWT (JSON Web Tokens)
- **Flow**: 
  1. `POST /api/v1/auth/login` → получение access token
  2. Токен передается в header: `Authorization: Bearer <token>`
  3. Срок жизни токена: 7 дней (настраивается)
- **Хранение паролей**: bcrypt (cost factor = 12)

### Авторизация
**Role-Based Access Control (RBAC)**:

| Операция | Owner | Admin | Driver |
|----------|-------|-------|--------|
| Создание пользователей | ✅ | ❌ | ❌ |
| Управление флотом | ✅ | ✅ | ❌ |
| Создание заказов | ✅ | ✅ | ❌ |
| Отправка тревог | ✅ | ✅ | ❌ |
| Просмотр своего транспорта | ✅ | ✅ | ✅ (только назначенного) |
| Подтверждение тревог | ✅ | ✅ | ✅ (только своих) |
| Просмотр аудита | ✅ | ✅ | ❌ |
| Удаление доказательств | ❌ | ❌ | ❌ |

### Защита данных
- **Driver isolation**: водитель видит только назначенные ему ресурсы
- **Audit immutability**: события аудита нельзя изменить/удалить
- **Camera footage**: планируется централизованное хранение (S3/MinIO)

---

## 🔌 API Reference

### Базовый URL
```
http://localhost:8000/api/v1
```

### Endpoints

#### Authentication (`/auth`)
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}

Response 200:
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer"
}

---

GET /auth/me
Authorization: Bearer <token>

Response 200:
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "admin",
  "is_active": true
}
```

#### Users (`/users`)
```http
GET /users
# Список пользователей (owner only)

POST /users
# Создание пользователя (owner only)
{
  "email": "newuser@example.com",
  "password": "secure_password",
  "role": "admin"
}
```

#### Vehicles (`/vehicles`)
```http
GET /vehicles
# Список всех транспортных средств
# Driver видит только свои

GET /vehicles/{id}
# Детали конкретного ТС

POST /vehicles
# Создание ТС (owner/admin)
{
  "name": "Volvo FH16",
  "plate": "А123БВ777",
  "vin": "YV2AG40B381234567",
  "series": "FH16",
  ...
}

PATCH /vehicles/{id}
# Обновление ТС (owner/admin)

DELETE /vehicles/{id}
# Удаление ТС (owner/admin)

POST /vehicles/{id}/status
# Изменение статуса (owner/admin)
{
  "status_main": "В пути",
  "status_secondary": ["Загружен", "В срок"]
}
```

#### Orders (`/orders`)
```http
GET /orders
# Список заказов

POST /orders
# Создание заказа (owner/admin)

GET /orders/{id}
# Детали заказа

PATCH /orders/{id}
# Обновление заказа

POST /orders/{id}/assign
# Назначение водителя и транспорта
{
  "vehicle_id": "uuid",
  "driver_user_id": "uuid"
}

POST /orders/{id}/accept
# Принятие заказа водителем

POST /orders/{id}/start
# Начало выполнения

POST /orders/{id}/complete
# Завершение
```

#### Alerts (`/alerts`)
```http
GET /alerts
# Список тревог

POST /alerts
# Создание тревоги (owner/admin)
{
  "vehicle_id": "uuid",
  "alert_type": "breakdown",
  "message": "Требуется срочная проверка двигателя"
}

POST /alerts/{id}/acknowledge
# Подтверждение получения водителем

POST /alerts/{id}/close
# Закрытие тревоги (owner/admin)
```

#### Audit (`/audit`)
```http
GET /audit
Query params:
  - entity_type: фильтр по типу сущности
  - entity_id: фильтр по ID сущности
  - actor_user_id: фильтр по пользователю
  - action: фильтр по действию
  - from_date: с даты
  - to_date: до даты

Response 200:
[
  {
    "id": "uuid",
    "entity_type": "vehicle",
    "entity_id": "uuid",
    "action": "status_changed",
    "payload": { ... },
    "actor_user_id": "uuid",
    "created_at": "2025-12-21T10:30:00Z"
  }
]
```

### OpenAPI Documentation
- Swagger UI: `GET http://localhost:8000/docs`
- OpenAPI JSON: `GET http://localhost:8000/openapi.json`
- ReDoc: `GET http://localhost:8000/redoc`

---

## 🗄️ База данных

### Схема PostgreSQL
```sql
-- Enums
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'driver');
CREATE TYPE order_status AS ENUM ('new', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE alert_status AS ENUM ('created', 'delivered', 'acknowledged', 'closed');

-- Core tables
CREATE TABLE users (...);
CREATE TABLE driver_profiles (...);
CREATE TABLE vehicles (...);
CREATE TABLE orders (...);
CREATE TABLE alerts (...);
CREATE TABLE audit_events (...);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_vehicles_plate ON vehicles(plate);
CREATE INDEX idx_vehicles_driver ON vehicles(driver_profile_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_events(created_at);
```

### Миграции (Alembic)
```bash
# Создание миграции
alembic revision --autogenerate -m "description"

# Применение миграций
alembic upgrade head

# Откат
alembic downgrade -1
```

**История миграций**:
- `0001_init.py` — начальная схема (users, drivers, vehicles, alerts, audit)
- `0002_orders.py` — добавлена система заказов

---

## 🚀 Развертывание

### Development (Docker Compose)

1. **Клонирование репозитория**:
```bash
git clone <repo-url>
cd s
```

2. **Настройка окружения**:
```bash
# Backend
cd backend
cp .env.example .env
# Отредактировать .env (DB credentials, JWT secret, etc.)
```

3. **Запуск сервисов**:
```bash
docker compose up --build
```

Сервисы будут доступны:
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Frontend: откройте `frontend/index.html` в браузере

4. **Применение миграций**:
```bash
docker compose exec backend alembic upgrade head
```

5. **Создание тестовых данных** (опционально):
```bash
docker compose exec backend python -m app.scripts.import_frontend_data
```

### Production (рекомендации)

**Инфраструктура**:
- Backend: Kubernetes/Docker Swarm
- Database: Managed PostgreSQL (AWS RDS, Azure Database, etc.)
- Static files: CDN (CloudFlare, AWS CloudFront)
- Reverse proxy: Nginx/Traefik с SSL (Let's Encrypt)

**Конфигурация**:
```bash
# .env для production
APP_ENV=production
DEBUG=false
DATABASE_URL=postgresql://user:pass@prod-db:5432/routox
JWT_SECRET=<сгенерировать криптостойкий ключ>
CORS_ORIGINS=["https://routox.company.com"]
```

**Мониторинг**:
- Логирование: ELK Stack / Loki
- Метрики: Prometheus + Grafana
- Tracing: Jaeger / Tempo
- Uptime: Pingdom / UptimeRobot

---

## 🧪 Тестирование

### Backend (to be implemented)
```bash
# Unit tests
pytest tests/unit/

# Integration tests
pytest tests/integration/

# E2E tests
pytest tests/e2e/
```

### Frontend (to be implemented)
```bash
# Можно использовать:
# - Jest для unit-тестов
# - Playwright/Cypress для E2E
```

---

## 📱 Frontend Architecture

### Страницы (HTML)
- `index.html` — Dashboard (обзор флота)
- `fleet.html` — Управление транспортом
- `driver.html` — Список водителей
- `trips.html` — Управление рейсами/заказами
- `inventory.html` — Склад/инвентарь
- `geozones.html` — Геозоны (для будущей интеграции с картами)
- `analytics.html` — Аналитика и отчеты
- `login.html` — Страница входа

### JavaScript модули
- `app.js` — Основной модуль (API client, dashboard logic)
- `driver.js` — Управление водителями
- `owner.js` — Функции для владельца

### Архитектурные принципы
- **API-first**: весь UI работает через REST API
- **Component-based**: переиспользуемые UI-компоненты
- **State management**: локальное хранение (localStorage) + API sync
- **Responsive**: адаптивный дизайн для десктопа и планшета

---

## 🔮 Roadmap

### MVP (текущая версия - прототип)
- ✅ Базовая аутентификация
- ✅ CRUD для транспорта, водителей, заказов
- ✅ Система тревог
- ✅ Аудит событий
- ✅ Статический frontend

### Phase 1 (ближайшие планы)
- 🔄 Интеграция с GPS-трекерами (real-time телеметрия)
- 🔄 WebSocket для live-обновлений
- 🔄 Система уведомлений (Email/SMS/Push)
- 🔄 Управление инвентарем (полная реализация)
- 🔄 Карты с маршрутами (интеграция Google Maps/Yandex Maps)

### Phase 2 (будущее)
- 📋 Видеонаблюдение транспорта (камеры, DVR)
- 📋 Аналитика и отчеты (BI-дашборды)
- 📋 Мобильное приложение для водителей (React Native/Flutter)
- 📋 Интеграция с 1C/SAP
- 📋 Machine Learning для оптимизации маршрутов

### Phase 3 (масштабирование)
- 📋 Мультитенантность (поддержка нескольких компаний)
- 📋 Marketplace интеграций
- 📋 API для партнеров
- 📋 White-label решение

---

## 🤝 Разработка

### Соглашения о коде

**Python (Backend)**:
- Style guide: PEP 8
- Formatter: Black
- Linter: Ruff
- Type hints: обязательны (mypy)
- Docstrings: Google style

**JavaScript (Frontend)**:
- Style guide: Airbnb JavaScript Style Guide
- Formatter: Prettier
- Linter: ESLint
- Современный ES6+ синтаксис

### Git workflow
```
main (production-ready code)
  ↑
develop (integration branch)
  ↑
feature/TASK-123-description (feature branches)
```

### Commit messages
```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Example: feat(vehicles): add real-time telemetry endpoint
```

---

## 📞 Support & Contacts

### Документация
- API Docs: `/docs` endpoint
- Спецификация: `/backend/docs/spec.md`
- Этот документ: `/PROJECT_DOCUMENTATION.md`

### Проблемы и вопросы
- GitHub Issues (если репозиторий на GitHub)
- Внутренний issue tracker команды

### Team Leads
- Backend: [Team Lead Backend]
- Frontend: [Team Lead Frontend]
- DevOps: [Team Lead DevOps]

---

## 📝 Лицензия

[To be defined - MIT / Proprietary / etc.]

---

**Последнее обновление**: 21 декабря 2025 г.
**Версия документации**: 1.0.0
**Статус проекта**: Prototype / MVP Stage
