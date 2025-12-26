"""multitenant + ops domains

Revision ID: 0003_multitenant_ops
Revises: 0002_orders
Create Date: 2025-12-21

"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0003_multitenant_ops"
down_revision = "0002_orders"
branch_labels = None
depends_on = None


DEFAULT_COMPANY_ID = "00000000-0000-0000-0000-000000000000"


def _stable_json(payload) -> str:
    return json.dumps(payload or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def _audit_hash(*, company_id: str, seq: int, entity_type: str, entity_id: str, action: str, actor_user_id: str | None, created_at: datetime, payload, prev_hash: str | None) -> str:
    base = "|".join(
        [
            company_id,
            str(seq),
            entity_type,
            entity_id,
            action,
            actor_user_id or "",
            created_at.astimezone(timezone.utc).isoformat(),
            _stable_json(payload),
            prev_hash or "",
        ]
    )
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def upgrade() -> None:
    # 1) Companies
    op.create_table(
        "companies",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_companies_slug", "companies", ["slug"], unique=True)

    # Create default company for existing single-tenant installs.
    op.execute(
        sa.text(
            "INSERT INTO companies (id, name, slug) VALUES (:id, :name, :slug) ON CONFLICT (id) DO NOTHING"
        ).bindparams(id=DEFAULT_COMPANY_ID, name="Default Company", slug="default")
    )

    # 2) Extend core tables with company_id (add nullable -> backfill -> set NOT NULL)
    op.add_column("users", sa.Column("company_id", sa.String(), nullable=True))
    op.create_index("ix_users_company_id", "users", ["company_id"], unique=False)
    op.execute(sa.text("UPDATE users SET company_id = :cid WHERE company_id IS NULL").bindparams(cid=DEFAULT_COMPANY_ID))
    op.alter_column("users", "company_id", nullable=False)

    op.add_column("driver_profiles", sa.Column("company_id", sa.String(), nullable=True))
    op.create_index("ix_driver_profiles_company_id", "driver_profiles", ["company_id"], unique=False)
    op.execute(sa.text("UPDATE driver_profiles SET company_id = :cid WHERE company_id IS NULL").bindparams(cid=DEFAULT_COMPANY_ID))
    op.alter_column("driver_profiles", "company_id", nullable=False)

    op.add_column("vehicles", sa.Column("company_id", sa.String(), nullable=True))
    op.create_index("ix_vehicles_company_id", "vehicles", ["company_id"], unique=False)
    op.execute(sa.text("UPDATE vehicles SET company_id = :cid WHERE company_id IS NULL").bindparams(cid=DEFAULT_COMPANY_ID))
    op.alter_column("vehicles", "company_id", nullable=False)

    op.add_column("orders", sa.Column("company_id", sa.String(), nullable=True))
    op.create_index("ix_orders_company_id", "orders", ["company_id"], unique=False)
    op.execute(sa.text("UPDATE orders SET company_id = :cid WHERE company_id IS NULL").bindparams(cid=DEFAULT_COMPANY_ID))
    op.alter_column("orders", "company_id", nullable=False)

    op.add_column("alerts", sa.Column("company_id", sa.String(), nullable=True))
    op.create_index("ix_alerts_company_id", "alerts", ["company_id"], unique=False)
    op.execute(sa.text("UPDATE alerts SET company_id = :cid WHERE company_id IS NULL").bindparams(cid=DEFAULT_COMPANY_ID))
    op.alter_column("alerts", "company_id", nullable=False)

    # 3) Fix uniqueness to be per-company for fleet identifiers.
    op.drop_index("ix_vehicles_plate", table_name="vehicles")
    op.drop_index("ix_vehicles_vin", table_name="vehicles")
    op.create_index("ux_vehicles_company_plate", "vehicles", ["company_id", "plate"], unique=True)
    op.create_index("ux_vehicles_company_vin", "vehicles", ["company_id", "vin"], unique=True)

    # 4) Audit hash chain + company
    op.add_column("audit_events", sa.Column("company_id", sa.String(), nullable=True))
    op.create_index("ix_audit_company_id", "audit_events", ["company_id"], unique=False)
    op.execute(sa.text("UPDATE audit_events SET company_id = :cid WHERE company_id IS NULL").bindparams(cid=DEFAULT_COMPANY_ID))
    op.alter_column("audit_events", "company_id", nullable=False)

    op.add_column("audit_events", sa.Column("seq", sa.Integer(), nullable=True))
    op.add_column("audit_events", sa.Column("prev_hash", sa.String(), nullable=True))
    op.add_column("audit_events", sa.Column("hash", sa.String(), nullable=True))
    op.create_index("ix_audit_seq", "audit_events", ["seq"], unique=False)
    op.create_index("ix_audit_hash", "audit_events", ["hash"], unique=True)

    # Backfill seq/hash chain for existing data (single default company).
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, entity_type, entity_id, action, actor_user_id, payload, created_at "
            "FROM audit_events WHERE company_id = :cid ORDER BY created_at ASC, id ASC"
        ).bindparams(cid=DEFAULT_COMPANY_ID)
    ).mappings().all()

    prev = None
    seq = 0
    for r in rows:
        seq += 1
        created_at = r["created_at"]
        if created_at is None:
            created_at = datetime.now(timezone.utc)
        elif created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        h = _audit_hash(
            company_id=DEFAULT_COMPANY_ID,
            seq=seq,
            entity_type=r["entity_type"],
            entity_id=r["entity_id"],
            action=r["action"],
            actor_user_id=r["actor_user_id"],
            created_at=created_at,
            payload=r["payload"],
            prev_hash=prev,
        )
        conn.execute(
            sa.text("UPDATE audit_events SET seq=:seq, prev_hash=:prev, hash=:hash WHERE id=:id")
            .bindparams(seq=seq, prev=prev, hash=h, id=r["id"])
        )
        prev = h

    # Make columns not-null
    op.alter_column("audit_events", "seq", nullable=False)
    op.alter_column("audit_events", "hash", nullable=False)

    # 5) Permissions tables
    op.create_table(
        "role_permissions",
        sa.Column("role", sa.String(), primary_key=True),
        sa.Column("permission", sa.String(), primary_key=True),
    )

    op.create_table(
        "user_permission_overrides",
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission", sa.String(), primary_key=True),
        sa.Column("allowed", sa.Boolean(), nullable=False),
    )

    # 6) Telemetry
    op.create_table(
        "telemetry_api_keys",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.String(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("key_hash", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("rate_limit_per_min", sa.Integer(), nullable=False, server_default=sa.text("120")),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_telemetry_api_keys_company_id", "telemetry_api_keys", ["company_id"], unique=False)
    op.create_index("ix_telemetry_api_keys_key_hash", "telemetry_api_keys", ["key_hash"], unique=True)

    op.create_table(
        "vehicle_positions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.String(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("speed_kph", sa.Float(), nullable=True),
        sa.Column("heading", sa.Float(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_vehicle_positions_company_id", "vehicle_positions", ["company_id"], unique=False)
    op.create_index("ix_vehicle_positions_vehicle_id", "vehicle_positions", ["vehicle_id"], unique=False)

    # 7) Geozones
    op.create_table(
        "geozones",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.String(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("zone_type", postgresql.ENUM("circle", "polygon", name="geozone_type"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("center_lat", sa.Float(), nullable=True),
        sa.Column("center_lon", sa.Float(), nullable=True),
        sa.Column("radius_m", sa.Float(), nullable=True),
        sa.Column("polygon", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_geozones_company_id", "geozones", ["company_id"], unique=False)

    op.create_table(
        "vehicle_geozone_states",
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("geozone_id", sa.String(), sa.ForeignKey("geozones.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("is_inside", sa.Boolean(), nullable=False),
        sa.Column("last_changed_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "geozone_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.String(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("geozone_id", sa.String(), sa.ForeignKey("geozones.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", postgresql.ENUM("enter", "exit", name="geozone_event_type"), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_geozone_events_company_id", "geozone_events", ["company_id"], unique=False)
    op.create_index("ix_geozone_events_vehicle_id", "geozone_events", ["vehicle_id"], unique=False)
    op.create_index("ix_geozone_events_geozone_id", "geozone_events", ["geozone_id"], unique=False)
    op.create_index("ix_geozone_events_event_type", "geozone_events", ["event_type"], unique=False)

    # 8) Notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.String(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("level", postgresql.ENUM("info", "warning", "critical", name="notification_level"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_company_id", "notifications", ["company_id"], unique=False)
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"], unique=False)

    # 9) Incidents
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("company_id", sa.String(), sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", postgresql.ENUM("low", "medium", "high", "critical", name="incident_severity"), nullable=False),
        sa.Column("status", postgresql.ENUM("open", "acknowledged", "in_progress", "resolved", "closed", name="incident_status"), nullable=False),
        sa.Column("related_entity_type", sa.String(), nullable=True),
        sa.Column("related_entity_id", sa.String(), nullable=True),
        sa.Column("created_by_user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_to_user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sla_due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_incidents_company_id", "incidents", ["company_id"], unique=False)
    op.create_index("ix_incidents_status", "incidents", ["status"], unique=False)
    op.create_index("ix_incidents_severity", "incidents", ["severity"], unique=False)
    op.create_index("ix_incidents_sla_due_at", "incidents", ["sla_due_at"], unique=False)

    # 10) FKs for company_id columns
    op.create_foreign_key("fk_users_company", "users", "companies", ["company_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_driver_profiles_company", "driver_profiles", "companies", ["company_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_vehicles_company", "vehicles", "companies", ["company_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_orders_company", "orders", "companies", ["company_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_alerts_company", "alerts", "companies", ["company_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_audit_events_company", "audit_events", "companies", ["company_id"], ["id"], ondelete="CASCADE")


def downgrade() -> None:
    # Drop FKs
    op.drop_constraint("fk_audit_events_company", "audit_events", type_="foreignkey")
    op.drop_constraint("fk_alerts_company", "alerts", type_="foreignkey")
    op.drop_constraint("fk_orders_company", "orders", type_="foreignkey")
    op.drop_constraint("fk_vehicles_company", "vehicles", type_="foreignkey")
    op.drop_constraint("fk_driver_profiles_company", "driver_profiles", type_="foreignkey")
    op.drop_constraint("fk_users_company", "users", type_="foreignkey")

    # Drop ops tables
    op.drop_table("incidents")
    op.execute("DROP TYPE IF EXISTS incident_status")
    op.execute("DROP TYPE IF EXISTS incident_severity")

    op.drop_table("notifications")
    op.execute("DROP TYPE IF EXISTS notification_level")

    op.drop_index("ix_geozone_events_event_type", table_name="geozone_events")
    op.drop_index("ix_geozone_events_geozone_id", table_name="geozone_events")
    op.drop_index("ix_geozone_events_vehicle_id", table_name="geozone_events")
    op.drop_index("ix_geozone_events_company_id", table_name="geozone_events")
    op.drop_table("geozone_events")
    op.drop_table("vehicle_geozone_states")
    op.drop_index("ix_geozones_company_id", table_name="geozones")
    op.drop_table("geozones")
    op.execute("DROP TYPE IF EXISTS geozone_event_type")
    op.execute("DROP TYPE IF EXISTS geozone_type")

    op.drop_index("ix_vehicle_positions_vehicle_id", table_name="vehicle_positions")
    op.drop_index("ix_vehicle_positions_company_id", table_name="vehicle_positions")
    op.drop_table("vehicle_positions")
    op.drop_index("ix_telemetry_api_keys_key_hash", table_name="telemetry_api_keys")
    op.drop_index("ix_telemetry_api_keys_company_id", table_name="telemetry_api_keys")
    op.drop_table("telemetry_api_keys")

    op.drop_table("user_permission_overrides")
    op.drop_table("role_permissions")

    # Audit columns
    op.drop_index("ix_audit_hash", table_name="audit_events")
    op.drop_index("ix_audit_seq", table_name="audit_events")
    op.drop_index("ix_audit_company_id", table_name="audit_events")
    op.drop_column("audit_events", "hash")
    op.drop_column("audit_events", "prev_hash")
    op.drop_column("audit_events", "seq")
    op.drop_column("audit_events", "company_id")

    # Restore uniqueness for vehicles
    op.drop_index("ux_vehicles_company_vin", table_name="vehicles")
    op.drop_index("ux_vehicles_company_plate", table_name="vehicles")
    op.create_index("ix_vehicles_plate", "vehicles", ["plate"], unique=True)
    op.create_index("ix_vehicles_vin", "vehicles", ["vin"], unique=True)
    op.drop_index("ix_vehicles_company_id", table_name="vehicles")
    op.drop_column("vehicles", "company_id")

    op.drop_index("ix_alerts_company_id", table_name="alerts")
    op.drop_column("alerts", "company_id")

    op.drop_index("ix_orders_company_id", table_name="orders")
    op.drop_column("orders", "company_id")

    op.drop_index("ix_driver_profiles_company_id", table_name="driver_profiles")
    op.drop_column("driver_profiles", "company_id")

    op.drop_index("ix_users_company_id", table_name="users")
    op.drop_column("users", "company_id")

    # Companies
    op.drop_index("ix_companies_slug", table_name="companies")
    op.drop_table("companies")
