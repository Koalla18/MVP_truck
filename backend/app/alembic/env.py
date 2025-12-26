from __future__ import annotations

import sys
from pathlib import Path
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Ensure the project root is on sys.path when Alembic changes the working dir
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.core.settings import settings
from app.db.base import Base

# Import models so metadata is populated
from app.models.user import User  # noqa: F401
from app.models.driver import DriverProfile  # noqa: F401
from app.models.vehicle import Vehicle  # noqa: F401
from app.models.alert import Alert  # noqa: F401
from app.models.audit import AuditEvent  # noqa: F401

from app.models.company import Company  # noqa: F401
from app.models.permission import RolePermission, UserPermissionOverride  # noqa: F401
from app.models.telemetry import TelemetryApiKey, VehiclePosition  # noqa: F401
from app.models.geozone import Geozone, VehicleGeozoneState, GeozoneEvent  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.incident import Incident  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section) or {},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        url=settings.database_url,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
