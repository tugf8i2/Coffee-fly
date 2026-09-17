"""Agrega la foto de perfil opcional para conductores.

Revision ID: 20260917_18
Revises: 20260916_17
"""

from alembic import op

revision = "20260917_18"
down_revision = "20260916_17"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS foto_perfil text")


def downgrade():
    op.execute("ALTER TABLE public.usuario DROP COLUMN IF EXISTS foto_perfil")
