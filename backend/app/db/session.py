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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
