from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.settings import settings

# Handle different database types
db_url = settings.database_url
engine_kwargs = {}

if db_url.startswith("sqlite"):
    # SQLite doesn't support pool_pre_ping and needs check_same_thread=False
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL and others support pool_pre_ping
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(db_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Initialize database schema for dev.

    Alembic migrations in this repo target PostgreSQL. To make local development
    possible without Docker/Postgres, we auto-create tables when using SQLite.

    For PostgreSQL, prefer running Alembic migrations; auto-creation can be
    enabled explicitly via settings.auto_create_schema.
    """

    should_create = db_url.startswith("sqlite") or settings.auto_create_schema
    if not should_create:
        return

    from app.db.base import Base

    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
