"""init

Revision ID: 0001_init
Revises: 
Create Date: 2025-12-12

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.Enum("owner", "admin", "driver", name="user_role"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_role", "users", ["role"], unique=False)

    op.create_table(
        "driver_profiles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("home_base", sa.String(), nullable=True),
        sa.Column("license_class", sa.String(), nullable=True),
        sa.Column("rating", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_driver_profiles_user_id", "driver_profiles", ["user_id"], unique=False)

    op.create_table(
        "vehicles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("plate", sa.String(), nullable=False),
        sa.Column("vin", sa.String(), nullable=False),
        sa.Column("series", sa.String(), nullable=True),
        sa.Column("tag", sa.String(), nullable=True),
        sa.Column("status_main", sa.String(), nullable=True),
        sa.Column("status_secondary", postgresql.ARRAY(sa.String()), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("cargo_desc", sa.String(), nullable=True),
        sa.Column("route_code", sa.String(), nullable=True),
        sa.Column("origin", sa.String(), nullable=True),
        sa.Column("destination", sa.String(), nullable=True),
        sa.Column("depart_at", sa.String(), nullable=True),
        sa.Column("eta_at", sa.String(), nullable=True),
        sa.Column("load_pct", sa.Float(), nullable=True),
        sa.Column("fuel_pct", sa.Float(), nullable=True),
        sa.Column("tank_l", sa.Integer(), nullable=True),
        sa.Column("pallets_capacity", sa.Integer(), nullable=True),
        sa.Column("distance_total_km", sa.Float(), nullable=True),
        sa.Column("distance_done_km", sa.Float(), nullable=True),
        sa.Column("avg_speed", sa.Float(), nullable=True),
        sa.Column("health_pct", sa.Float(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("driver_profile_id", sa.String(), sa.ForeignKey("driver_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("telemetry_updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_vehicles_plate", "vehicles", ["plate"], unique=True)
    op.create_index("ix_vehicles_vin", "vehicles", ["vin"], unique=True)
    op.create_index("ix_vehicles_driver_profile_id", "vehicles", ["driver_profile_id"], unique=False)

    op.create_table(
        "alerts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("alert_type", sa.String(), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.Enum("created", "delivered", "acknowledged", "closed", name="alert_status"), nullable=False),
        sa.Column("delivered_to_driver_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_alerts_vehicle_id", "alerts", ["vehicle_id"], unique=False)
    op.create_index("ix_alerts_created_by_user_id", "alerts", ["created_by_user_id"], unique=False)

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("actor_user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_audit_entity_type", "audit_events", ["entity_type"], unique=False)
    op.create_index("ix_audit_entity_id", "audit_events", ["entity_id"], unique=False)
    op.create_index("ix_audit_action", "audit_events", ["action"], unique=False)
    op.create_index("ix_audit_actor_user_id", "audit_events", ["actor_user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("alerts")
    op.drop_table("vehicles")
    op.drop_table("driver_profiles")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS alert_status")
    op.execute("DROP TYPE IF EXISTS user_role")
