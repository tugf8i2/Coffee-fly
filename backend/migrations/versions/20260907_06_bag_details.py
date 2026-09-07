"""Detalle de bultos en cargas de solicitudes.

Revision ID: 20260907_06
Revises: 20260903_05
"""

from alembic import op

revision = "20260907_06"
down_revision = "20260903_05"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE public.carga
            ADD COLUMN IF NOT EXISTS peso_bulto_kg numeric(8,2),
            ADD COLUMN IF NOT EXISTS cantidad_bultos integer,
            ADD COLUMN IF NOT EXISTS peso_extra_kg numeric(8,2) DEFAULT 0;
        ALTER TABLE public.carga
            DROP CONSTRAINT IF EXISTS chk_carga_detalle_bultos;
        ALTER TABLE public.carga
            ADD CONSTRAINT chk_carga_detalle_bultos CHECK (
                (peso_bulto_kg IS NULL AND cantidad_bultos IS NULL)
                OR (peso_bulto_kg > 0 AND cantidad_bultos > 0 AND COALESCE(peso_extra_kg, 0) >= 0)
            );
    """)


def downgrade():
    op.execute("""
        ALTER TABLE public.carga DROP CONSTRAINT IF EXISTS chk_carga_detalle_bultos;
        ALTER TABLE public.carga DROP COLUMN IF EXISTS peso_extra_kg;
        ALTER TABLE public.carga DROP COLUMN IF EXISTS cantidad_bultos;
        ALTER TABLE public.carga DROP COLUMN IF EXISTS peso_bulto_kg;
    """)
