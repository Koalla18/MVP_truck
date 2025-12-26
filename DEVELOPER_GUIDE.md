# RoutoX - Developer Quick Start Guide

## 🚀 Быстрый старт для разработчиков

### Предварительные требования

**Установленное ПО**:
- Docker Desktop 20+ (для macOS/Windows) или Docker Engine + Docker Compose (для Linux)
- Git 2.30+
- IDE: VS Code (рекомендуется) / PyCharm / WebStorm
- Опционально: Postman / Insomnia (для тестирования API)

**Рекомендуемые расширения VS Code**:
- Python (Microsoft)
- Pylance
- Docker
- PostgreSQL (ckolkman)
- REST Client
- GitLens

---

## 📥 Установка проекта

### 1. Клонирование репозитория

```bash
# Клонировать проект
cd ~/Desktop
git clone <repository-url> s
cd s

# Проверить структуру
ls -la
# Должны быть: backend/, frontend/, README.md, ...
```

### 2. Настройка Backend

```bash
cd backend

# Создать файл окружения из примера
cp .env.example .env

# Отредактировать .env (можно использовать nano/vim/VS Code)
nano .env
```

**Минимальная конфигурация `.env`**:
```env
# Application
APP_NAME=RoutoX
APP_ENV=development
DEBUG=true

# Database
DATABASE_URL=postgresql://routox_user:routox_password@db:5432/routox_db

# Security
JWT_SECRET_KEY=your-super-secret-jwt-key-change-me-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080  # 7 дней

# CORS (для локальной разработки)
CORS_ORIGINS=["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:5500"]

# API
API_PREFIX=/api/v1
```

**🔐 ВАЖНО**: В production обязательно замените `JWT_SECRET_KEY` на криптостойкий ключ:
```bash
# Генерация безопасного ключа
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 3. Запуск проекта

```bash
# Находясь в папке backend/
docker compose up --build

# Или в фоновом режиме
docker compose up -d --build

# Проверка статуса
docker compose ps
```

**Ожидаемый вывод**:
```
NAME                COMMAND                  SERVICE   STATUS
backend-backend-1   "uvicorn app.main:ap…"   backend   Up
backend-db-1        "docker-entrypoint.s…"   db        Up
```

### 4. Применение миграций

```bash
# После запуска контейнеров
docker compose exec backend alembic upgrade head

# Проверка версии миграций
docker compose exec backend alembic current
```

### 5. Создание первого пользователя

```bash
# Вход в контейнер
docker compose exec backend bash

# Внутри контейнера
python

# Python shell:
>>> from app.db.session import SessionLocal
>>> from app.models.user import User
>>> from app.core.security import get_password_hash
>>> from app.models.enums import UserRole
>>> import uuid
>>> 
>>> db = SessionLocal()
>>> 
>>> # Создание owner
>>> owner = User(
...     id=str(uuid.uuid4()),
...     email="owner@routox.com",
...     password_hash=get_password_hash("owner123"),
...     role=UserRole.owner,
...     is_active=True
... )
>>> db.add(owner)
>>> db.commit()
>>> 
>>> # Создание admin
>>> admin = User(
...     id=str(uuid.uuid4()),
...     email="admin@routox.com",
...     password_hash=get_password_hash("admin123"),
...     role=UserRole.admin,
...     is_active=True
... )
>>> db.add(admin)
>>> db.commit()
>>> 
>>> print(f"Owner: {owner.email}")
>>> print(f"Admin: {admin.email}")
>>> exit()
```

### 6. Импорт тестовых данных (опционально)

```bash
# Импорт данных из frontend/assets/data/data.json
docker compose exec backend python -m app.scripts.import_frontend_data

# Скрипт создаст:
# - Транспортные средства
# - Водителей
# - Заказы (если есть в data.json)
```

---

## 🧪 Проверка работоспособности

### 1. Проверка API

```bash
# Health check
curl http://localhost:8000/health
# Ответ: {"status": "ok"}

# OpenAPI документация
open http://localhost:8000/docs
# Откроется Swagger UI
```

### 2. Тестовый запрос (логин)

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@routox.com",
    "password": "owner123"
  }'

# Ответ:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "token_type": "bearer"
# }
```

### 3. Проверка с токеном

```bash
# Сохранить токен в переменную
TOKEN="eyJhbGci..."

# Запрос с авторизацией
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Ответ:
# {
#   "id": "uuid",
#   "email": "owner@routox.com",
#   "role": "owner",
#   "is_active": true
# }
```

---

## 🎨 Запуск Frontend

### Вариант 1: Live Server (VS Code)

```bash
# 1. Установить расширение "Live Server" в VS Code
# 2. Открыть файл frontend/index.html
# 3. Правый клик → "Open with Live Server"
# 4. Откроется http://127.0.0.1:5500/frontend/index.html
```

### Вариант 2: Python HTTP Server

```bash
cd frontend

# Python 3
python -m http.server 8080

# Открыть в браузере
open http://localhost:8080/index.html
```

### Вариант 3: Статический Nginx (Docker)

```bash
# Создать docker-compose.frontend.yml
cat > docker-compose.frontend.yml <<EOF
version: "3.8"
services:
  frontend:
    image: nginx:alpine
    ports:
      - "3000:80"
    volumes:
      - ./frontend:/usr/share/nginx/html:ro
EOF

# Запустить
docker compose -f docker-compose.frontend.yml up

# Открыть
open http://localhost:3000
```

### Настройка API endpoint во Frontend

```javascript
// frontend/assets/js/app.js (строка ~2)
const API_BASE_URL = "http://localhost:8000/api/v1";

// Если backend на другом порту/хосте - изменить
```

---

## 🛠️ Разработка

### Backend Development

#### 1. Локальная разработка без Docker

```bash
cd backend

# Создать виртуальное окружение
python3.11 -m venv venv
source venv/bin/activate  # macOS/Linux
# или
venv\Scripts\activate  # Windows

# Установить зависимости
pip install -r requirements.txt

# Настроить .env (DATABASE_URL должен указывать на локальный PostgreSQL)
# DATABASE_URL=postgresql://user:pass@localhost:5432/routox_db

# Запустить PostgreSQL отдельно:
docker run -d \
  --name routox-postgres \
  -e POSTGRES_DB=routox_db \
  -e POSTGRES_USER=routox_user \
  -e POSTGRES_PASSWORD=routox_password \
  -p 5432:5432 \
  postgres:15

# Применить миграции
alembic upgrade head

# Запустить dev сервер
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Сервер перезагружается при изменении кода
```

#### 2. Создание новой миграции

```bash
# После изменения моделей в app/models/
alembic revision --autogenerate -m "Add new field to vehicle"

# Проверить сгенерированный файл в alembic/versions/
# Применить
alembic upgrade head

# Откат последней миграции
alembic downgrade -1
```

#### 3. Структура нового endpoint

```python
# app/api/v1/routes/my_feature.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.my_feature import MyFeatureCreate, MyFeatureResponse

router = APIRouter()

@router.get("/", response_model=list[MyFeatureResponse])
async def list_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Список элементов"""
    items = db.query(MyFeature).all()
    return items

@router.post("/", response_model=MyFeatureResponse)
async def create_item(
    data: MyFeatureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создание нового элемента"""
    item = MyFeature(**data.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
```

```python
# app/api/v1/router.py
from app.api.v1.routes import my_feature

api_router = APIRouter()
# ... existing routes
api_router.include_router(my_feature.router, prefix="/my-feature", tags=["My Feature"])
```

#### 4. Добавление новой модели

```python
# app/models/my_model.py
from sqlalchemy import Column, String, DateTime, func
from app.db.base import Base

class MyModel(Base):
    __tablename__ = "my_models"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

```python
# app/schemas/my_model.py
from pydantic import BaseModel
from datetime import datetime

class MyModelBase(BaseModel):
    name: str

class MyModelCreate(MyModelBase):
    pass

class MyModelResponse(MyModelBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True
```

### Frontend Development

#### 1. Добавление новой страницы

```html
<!-- frontend/new_page.html -->
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RoutoX - New Feature</title>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
    <!-- Navigation (скопировать из index.html) -->
    <nav class="sidebar">...</nav>
    
    <main class="content">
        <h1>New Feature</h1>
        <div id="feature-container"></div>
    </main>
    
    <script src="assets/js/app.js"></script>
    <script>
        // Инициализация страницы
        document.addEventListener('DOMContentLoaded', async () => {
            await loadFeatureData();
        });
        
        async function loadFeatureData() {
            const data = await apiRequest('/my-feature');
            renderFeatureList(data);
        }
        
        function renderFeatureList(items) {
            const container = document.getElementById('feature-container');
            container.innerHTML = items.map(item => `
                <div class="item-card">
                    <h3>${item.name}</h3>
                </div>
            `).join('');
        }
    </script>
</body>
</html>
```

#### 2. Переиспользуемые UI компоненты

```javascript
// frontend/assets/js/components.js

// Badge компонент
function badge(text, color = 'blue') {
    return `<span class="badge badge-${color}">${text}</span>`;
}

// Progress bar
function progressBar(value, max = 100, label = '') {
    const percent = Math.round((value / max) * 100);
    return `
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${percent}%"></div>
            ${label ? `<span class="progress-label">${label}</span>` : ''}
        </div>
    `;
}

// Card container
function card(title, content, actions = '') {
    return `
        <div class="card">
            <div class="card-header">
                <h3>${title}</h3>
            </div>
            <div class="card-body">
                ${content}
            </div>
            ${actions ? `<div class="card-actions">${actions}</div>` : ''}
        </div>
    `;
}
```

---

## 🐛 Debugging

### Backend Debugging

#### 1. Логи Docker контейнеров

```bash
# Все логи backend
docker compose logs backend

# Следить за логами в реальном времени
docker compose logs -f backend

# Последние 50 строк
docker compose logs --tail=50 backend
```

#### 2. Debugging в VS Code

```json
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python: FastAPI",
            "type": "python",
            "request": "launch",
            "module": "uvicorn",
            "args": [
                "app.main:app",
                "--reload",
                "--host", "0.0.0.0",
                "--port", "8000"
            ],
            "jinja": true,
            "justMyCode": true,
            "env": {
                "DATABASE_URL": "postgresql://routox_user:routox_password@localhost:5432/routox_db"
            }
        }
    ]
}
```

#### 3. Debugging SQL запросов

```python
# app/db/session.py
import logging

# Включить SQL логирование
logging.basicConfig()
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

# Теперь в консоли будут видны все SQL запросы:
# INFO:sqlalchemy.engine:SELECT users.id, users.email FROM users WHERE users.id = ?
```

#### 4. Interactive debugging

```python
# Добавить в код для breakpoint
import pdb; pdb.set_trace()

# Или (Python 3.7+)
breakpoint()

# Полезные команды в pdb:
# n - next line
# s - step into
# c - continue
# p variable - print variable
# l - list code
# q - quit
```

### Frontend Debugging

#### 1. Browser DevTools

```javascript
// Логирование API запросов
async function apiRequest(endpoint, options = {}) {
    console.log('API Request:', endpoint, options);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    console.log('API Response:', data);
    return data;
}

// Логирование ошибок
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});
```

#### 2. Network inspection

```
Chrome DevTools:
1. F12 → Network tab
2. Фильтр: Fetch/XHR
3. Проверить:
   - Request Headers (Authorization?)
   - Request Payload
   - Response Status
   - Response Data
```

---

## 📊 Базовые операции с БД

### Подключение к PostgreSQL

```bash
# Через Docker
docker compose exec db psql -U routox_user -d routox_db

# Напрямую (если PostgreSQL локальный)
psql -h localhost -U routox_user -d routox_db
```

### Полезные SQL команды

```sql
-- Список таблиц
\dt

-- Структура таблицы
\d vehicles

-- Количество записей
SELECT COUNT(*) FROM vehicles;

-- Последние события аудита
SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 10;

-- Пользователи по ролям
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Транспорт с водителями
SELECT v.name, v.plate, dp.name as driver_name
FROM vehicles v
LEFT JOIN driver_profiles dp ON v.driver_profile_id = dp.id;

-- Очистка всех таблиц (ОСТОРОЖНО!)
TRUNCATE users, driver_profiles, vehicles, orders, alerts, audit_events CASCADE;
```

---

## 🧹 Очистка и перезапуск

### Полная очистка Docker

```bash
# Остановить все контейнеры
docker compose down

# Удалить volumes (БД будет очищена!)
docker compose down -v

# Удалить images
docker compose down --rmi all

# Полная пересборка
docker compose up --build --force-recreate
```

### Сброс миграций

```bash
# Откатить все миграции
docker compose exec backend alembic downgrade base

# Применить заново
docker compose exec backend alembic upgrade head
```

---

## 🎯 Чеклист перед коммитом

```bash
# 1. Проверить код-стайл (если настроен)
# Backend
cd backend
black app/
ruff app/

# 2. Запустить тесты (когда будут)
pytest

# 3. Проверить миграции
alembic check

# 4. Проверить .env не попал в коммит
git status
# .env должен быть в .gitignore

# 5. Коммит
git add .
git commit -m "feat(vehicles): add telemetry endpoint"
git push
```

---

## 📚 Полезные ссылки

### Документация технологий
- [FastAPI](https://fastapi.tiangolo.com/)
- [SQLAlchemy](https://docs.sqlalchemy.org/)
- [Pydantic](https://docs.pydantic.dev/)
- [Alembic](https://alembic.sqlalchemy.org/)
- [PostgreSQL](https://www.postgresql.org/docs/)

### Проектная документация
- [Основная документация](PROJECT_DOCUMENTATION.md)
- [Архитектура](ARCHITECTURE.md)
- [Спецификация прототипа](backend/docs/spec.md)

### Инструменты
- [Swagger Editor](https://editor.swagger.io/) - редактор OpenAPI
- [DB Diagram](https://dbdiagram.io/) - визуализация схемы БД
- [Postman](https://www.postman.com/) - тестирование API

---

## ❓ FAQ

**Q: Backend не запускается, ошибка подключения к БД**
```bash
# Проверить, что PostgreSQL контейнер запущен
docker compose ps db

# Проверить логи БД
docker compose logs db

# Пересоздать контейнеры
docker compose down -v
docker compose up --build
```

**Q: Миграции не применяются**
```bash
# Проверить текущую версию
docker compose exec backend alembic current

# Если нет версии - применить с самого начала
docker compose exec backend alembic upgrade head

# Если ошибки - откатить и применить заново
docker compose exec backend alembic downgrade base
docker compose exec backend alembic upgrade head
```

**Q: Frontend не видит Backend (CORS ошибки)**
```env
# Проверить .env в backend/
CORS_ORIGINS=["http://localhost:3000", "http://127.0.0.1:5500"]

# Добавить origin вашего frontend
# Перезапустить backend
docker compose restart backend
```

**Q: JWT токен истек**
```bash
# Получить новый токен
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "owner@routox.com", "password": "owner123"}'

# Или увеличить время жизни в .env
JWT_EXPIRE_MINUTES=43200  # 30 дней
```

---

**Документ актуален на**: 21 декабря 2025 г.  
**Для вопросов**: обращайтесь к Team Lead или создавайте Issue
