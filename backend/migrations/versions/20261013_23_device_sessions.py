"""Registra instalaciones y permite revocar sesiones por dispositivo.

Revision ID: 20261013_23
Revises: 20260926_22
"""
from alembic import op
import sqlalchemy as sa

revision = "20261013_23"
down_revision = "20260926_22"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("auth_session", sa.Column("device_id", sa.String(80), nullable=True))
    op.add_column("auth_session", sa.Column("device_name", sa.String(120), nullable=True))
    op.add_column("auth_session", sa.Column("platform", sa.String(30), nullable=True))
    op.add_column("auth_session", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("auth_session", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("auth_session", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_auth_session_device_id", "auth_session", ["device_id"])


def downgrade():
    op.drop_index("ix_auth_session_device_id", table_name="auth_session")
    for name in ("revoked_at", "last_seen_at", "started_at", "platform", "device_name", "device_id"):
        op.drop_column("auth_session", name)
