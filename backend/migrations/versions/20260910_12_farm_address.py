"""Guarda la dirección seleccionada de la finca.

Revision ID: 20260910_12
Revises: 20260910_11
"""

from alembic import op


revision = "20260910_12"
down_revision = "20260910_11"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE public.usuario
            ADD COLUMN IF NOT EXISTS direccion_finca character varying(300);
    """)


def downgrade():
    op.execute("""
        ALTER TABLE public.usuario DROP COLUMN IF EXISTS direccion_finca;
    """)
