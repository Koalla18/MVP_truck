"""orders

Revision ID: 0002_orders
Revises: 0001_init
Create Date: 2025-12-13

"""

from alembic import op
import sqlalchemy as sa

revision = "0002_orders"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "orders",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("cargo_desc", sa.Text(), nullable=True),
        sa.Column("origin", sa.String(), nullable=True),
        sa.Column("destination", sa.String(), nullable=True),
        sa.Column("planned_depart_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planned_arrive_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.Enum("new", "assigned", "accepted", "completed", "cancelled", name="order_status"), nullable=False),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_driver_user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("accepted_by_user_id", sa.String(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("ix_orders_status", "orders", ["status"], unique=False)
    op.create_index("ix_orders_vehicle_id", "orders", ["vehicle_id"], unique=False)
    op.create_index("ix_orders_created_by_user_id", "orders", ["created_by_user_id"], unique=False)
    op.create_index("ix_orders_assigned_driver_user_id", "orders", ["assigned_driver_user_id"], unique=False)
    op.create_index("ix_orders_accepted_by_user_id", "orders", ["accepted_by_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_orders_accepted_by_user_id", table_name="orders")
    op.drop_index("ix_orders_assigned_driver_user_id", table_name="orders")
    op.drop_index("ix_orders_created_by_user_id", table_name="orders")
    op.drop_index("ix_orders_vehicle_id", table_name="orders")
    op.drop_index("ix_orders_status", table_name="orders")
    op.drop_table("orders")
    op.execute("DROP TYPE IF EXISTS order_status")
