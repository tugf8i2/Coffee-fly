"""Completa las restricciones del módulo de cooperativas.

Revision ID: 20260902_04
Revises: 20260829_03
"""

from alembic import op


revision = "20260902_04"
down_revision = "20260829_03"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        UPDATE public.cooperativa
        SET nombre = 'Cooperativa ' || id_cooperativa
        WHERE nombre IS NULL OR btrim(nombre) = ''
    """)
    op.execute("ALTER TABLE public.cooperativa ALTER COLUMN nombre SET NOT NULL")


def downgrade():
    op.execute("ALTER TABLE public.cooperativa ALTER COLUMN nombre DROP NOT NULL")
