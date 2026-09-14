"""Congela el destino de cooperativa de cada viaje.

Revision ID: 20260914_14
Revises: 20260914_13
"""

from alembic import op


revision = "20260914_14"
down_revision = "20260914_13"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE public.viaje
            ADD COLUMN IF NOT EXISTS cooperativa_latitud_snapshot double precision,
            ADD COLUMN IF NOT EXISTS cooperativa_longitud_snapshot double precision,
            ADD COLUMN IF NOT EXISTS cooperativa_direccion_snapshot character varying(500);

        UPDATE public.viaje AS v
        SET cooperativa_latitud_snapshot = COALESCE(v.cooperativa_latitud_snapshot, u.y),
            cooperativa_longitud_snapshot = COALESCE(v.cooperativa_longitud_snapshot, u.x),
            cooperativa_direccion_snapshot = COALESCE(
                v.cooperativa_direccion_snapshot,
                NULLIF(CONCAT_WS(', ', c.nombre, u.direccion, u.ciudad, u.departamento), '')
            )
        FROM public.cooperativa AS c
        JOIN public.ubicacion AS u ON u.id_ubicacion = c.ubicacion_id
        WHERE c.id_cooperativa = v.cooperativa_id
          AND (v.cooperativa_latitud_snapshot IS NULL
               OR v.cooperativa_longitud_snapshot IS NULL
               OR v.cooperativa_direccion_snapshot IS NULL);

        UPDATE public.viaje
        SET cooperativa_latitud_snapshot = NULL,
            cooperativa_longitud_snapshot = NULL
        WHERE (cooperativa_latitud_snapshot IS NULL) <> (cooperativa_longitud_snapshot IS NULL)
           OR cooperativa_latitud_snapshot NOT BETWEEN -90 AND 90
           OR cooperativa_longitud_snapshot NOT BETWEEN -180 AND 180;

        ALTER TABLE public.viaje
            ADD CONSTRAINT chk_viaje_snapshot_cooperativa CHECK (
                (cooperativa_latitud_snapshot IS NULL AND cooperativa_longitud_snapshot IS NULL)
                OR (cooperativa_latitud_snapshot BETWEEN -90 AND 90
                    AND cooperativa_longitud_snapshot BETWEEN -180 AND 180)
            );
    """)


def downgrade():
    op.execute("""
        ALTER TABLE public.viaje DROP CONSTRAINT IF EXISTS chk_viaje_snapshot_cooperativa;
        ALTER TABLE public.viaje
            DROP COLUMN IF EXISTS cooperativa_direccion_snapshot,
            DROP COLUMN IF EXISTS cooperativa_longitud_snapshot,
            DROP COLUMN IF EXISTS cooperativa_latitud_snapshot;
    """)
