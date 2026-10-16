"""Associate revocable sessions with company devices.

Revision ID: 20261015_24
Revises: 20261014_23
"""

from alembic import op
import sqlalchemy as sa


revision = "20261015_24"
down_revision = "20261014_23"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("auth_session", sa.Column("device_id", sa.String(80), nullable=True))
    op.add_column("auth_session", sa.Column("device_name", sa.String(120), nullable=True))
    op.add_column("auth_session", sa.Column("device_platform", sa.String(40), nullable=True))
    op.add_column("auth_session", sa.Column("user_agent", sa.String(300), nullable=True))
    # Sesiones previas no tienen hora de inicio verificable; se deja sin valor.
    op.add_column("auth_session", sa.Column("signed_in_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("auth_session", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_auth_session_device_id", "auth_session", ["device_id"])


def downgrade():
    op.drop_index("ix_auth_session_device_id", table_name="auth_session")
    for name in ("last_seen_at", "signed_in_at", "user_agent", "device_platform", "device_name", "device_id"):
        op.drop_column("auth_session", name)
