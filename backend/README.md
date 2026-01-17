# RoutoX Backend (prototype)

Это каркас бекэнда для системы логиста (администратора транспортной компании).

- Стек: **FastAPI + PostgreSQL**
- Роли: **owner**, **admin (логист)**, **driver**
- Требования прототипа:
  - Серверная история/аудит событий (изменения статусов, тревоги, инвентарь, телеметрия)
  - Интеграции планируются (телематика/GPS, уведомления), но на прототипе можно держать заглушки
  - Камеры в будущем: хранение потоков/снимков должно быть централизовано (водитель/логист не может «удалить доказательства»)

## Быстрый запуск (без Docker)

```bash
cd backend
python -m venv .venv
..venv\Scripts\activate   # Windows
source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
python run_local.py --seed
```

API будет доступен на `http://localhost:8000`.

### Демо-аккаунты

```
owner@example.com / owner123
admin@example.com / admin123
driver@example.com / driver123
```

## Быстрый запуск (Docker)

1) Создать `.env` на основе `.env.example`
2) Запустить:

```bash
docker compose up --build
```

API будет доступен на `http://localhost:8000`.

## Документация

- OpenAPI: `GET /docs` и `GET /openapi.json`
- Спецификация прототипа (как ТЗ): [docs/spec.md](docs/spec.md)
 - Метрики: `GET /metrics`

## Важно

Фронтенд находится в папке `frontend/` (статический прототип). Бекэнд в этой папке — отдельный сервис.
