# ТЗ бекэнда RoutoX (прототип)

Контекст: система для логиста/администратора транспортной компании.

## 1) Роли и доступы

Роли:
- **owner** — владелец (полный доступ)
- **admin** — логист/администратор (операционная работа)
- **driver** — водитель (ограниченный доступ)

Базовые правила:
- `owner/admin` могут создавать/редактировать транспорт, рейсы, геозоны, инвентарь, подтверждать тревоги.
- `driver`:
  - может видеть *только* назначенный ему транспорт/рейс и связанные уведомления/задачи
  - не может удалять доказательства (камеры/снимки/события)
  - может подтверждать получение тревоги/сообщения

## 2) Сущности (минимум для прототипа)

### User
- id, email, password_hash, role (owner|admin|driver), is_active

### Driver profile
- user_id (опционально 1:1), name, phone, home_base, license_class, rating

### Vehicle
- id, name, plate (unique), vin (unique), series, tag
- status_main, status_secondary[] (макс 2)
- cargo_desc, route_code
- origin, destination, depart_at, eta_at
- load_pct, fuel_pct, tank_l, pallets_capacity
- distance_total_km, distance_done_km, avg_speed
- driver_id (FK)
- image_url

### Alert / "Тревога"
- id, vehicle_id, created_by (admin/owner), message, type
- status (created|delivered|acknowledged|closed)
- delivered_to_driver_at, acknowledged_at

**Назначение кнопки "Тревога"**: оповестить водителя, что произошло событие (поломка, проблема с грузом, др.).

### Notifications
- id, user_id, level, title, detail, created_at, read_at

### Inventory
- items: id, name, qty, unit, status, location
- events: id, item_id, delta_qty, reason, created_by, created_at

### Audit / History (обязательно)
Единый журнал событий:
- id, entity_type, entity_id, action, payload (jsonb), actor_user_id, created_at

События пишутся при:
- создании/редактировании/удалении транспорта
- смене статусов
- отправке тревоги
- изменениях профиля водителя
- операциях склада

## 3) Камеры (не реализуем функционал, но фиксируем контракт)

На прототипе: UI показывает картинки/гифки.

В полном проекте:
- хранение потоков/снимков **на стороне компании** (S3/MinIO/NVR), доступ по ролям
- водитель/логист **не может удалить** записи

Для будущего контракта:
- `GET /api/v1/vehicles/{id}/media` — список доступных камер/снимков
- `POST /api/v1/media/presign` — выдача подписанных URL для загрузки (только service аккаунт, не driver)

## 4) Интеграции (как будет "по-взрослому")

План:
- Телематика/GPS: отдельный ingest сервис/endpoint принимает телеметрию, пишет в БД, шлёт события в WS.
- Уведомления: адаптеры (SMS/Email/Push/Telegram/WhatsApp) через очередь.
- Карты: хранить координаты/трек в БД, а внешние карты — только отображение.

Даже в прототипе: интерфейсы/таблицы и заглушки должны быть заложены, чтобы не ломать контракт.

## 5) API (черновик)

### Auth
- `POST /api/v1/auth/login` → JWT
- `GET /api/v1/auth/me`

### Users
- `POST /api/v1/users` (owner)
- `GET /api/v1/users` (owner)

### Vehicles
- `GET /api/v1/vehicles`
- `POST /api/v1/vehicles` (owner/admin)
- `GET /api/v1/vehicles/{id}`
- `PATCH /api/v1/vehicles/{id}` (owner/admin)
- `DELETE /api/v1/vehicles/{id}` (owner/admin)
- `POST /api/v1/vehicles/{id}/status` (owner/admin)

### Alerts
- `POST /api/v1/vehicles/{id}/alerts` (owner/admin)
- `GET /api/v1/alerts` (owner/admin)
- `POST /api/v1/alerts/{id}/ack` (driver)

### Inventory
- `GET /api/v1/inventory/items`
- `POST /api/v1/inventory/items` (owner/admin)
- `DELETE /api/v1/inventory/items/{id}` (owner/admin)
- `GET /api/v1/inventory/events`

### Audit
- `GET /api/v1/audit` (owner/admin)

## 6) Non-functional
- Postgres 15+
- Alembic миграции
- Pydantic схемы
- CORS только для фронтенда
- Трассировка/логирование действий
