"""Agrega la confirmación persistente de recogida de la carga.

Revision ID: 20260907_08
Revises: 20260907_07
"""

from alembic import op


revision = "20260907_08"
down_revision = "20260907_07"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE public.entrega ADD COLUMN IF NOT EXISTS carga_recogida_en timestamp")


def downgrade():
    op.execute("ALTER TABLE public.entrega DROP COLUMN IF EXISTS carga_recogida_en")
