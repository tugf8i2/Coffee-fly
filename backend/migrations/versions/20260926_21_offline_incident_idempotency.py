"""Permite sincronizar novedades del conductor sin duplicarlas.

Revision ID: 20260926_21
Revises: 20260921_20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260926_21"
down_revision = "20260921_20"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "historial_de_eventos",
        sa.Column("client_event_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_historial_de_eventos_client_event_id",
        "historial_de_eventos",
        ["client_event_id"],
        unique=True,
    )


def downgrade():
    op.drop_index(
        "ix_historial_de_eventos_client_event_id",
        table_name="historial_de_eventos",
    )
    op.drop_column("historial_de_eventos", "client_event_id")
