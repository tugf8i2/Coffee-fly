"""Varios grupos de bultos por solicitud.

Revision ID: 20260907_07
Revises: 20260907_06
"""

from alembic import op

revision = "20260907_07"
down_revision = "20260907_06"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE public.carga ADD COLUMN IF NOT EXISTS grupos_bultos jsonb")


def downgrade():
    op.execute("ALTER TABLE public.carga DROP COLUMN IF EXISTS grupos_bultos")
