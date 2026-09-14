"""Asocia GPS al viaje y congela la ubicación de recolección.

Revision ID: 20260914_13
Revises: 20260910_12
"""

from alembic import op


revision = "20260914_13"
down_revision = "20260910_12"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE public.entrega
            ADD COLUMN IF NOT EXISTS finca_latitud_snapshot double precision,
            ADD COLUMN IF NOT EXISTS finca_longitud_snapshot double precision,
            ADD COLUMN IF NOT EXISTS finca_direccion_snapshot character varying(500),
            ADD COLUMN IF NOT EXISTS finca_ubicacion_snapshot_en timestamp;

        UPDATE public.entrega AS e
        SET finca_latitud_snapshot = u.latitud_finca,
            finca_longitud_snapshot = u.longitud_finca,
            finca_direccion_snapshot = NULLIF(CONCAT_WS(', ', u.direccion_finca, u.vereda, u.municipio, u.departamento), ''),
            finca_ubicacion_snapshot_en = COALESCE(u.ubicacion_finca_actualizada_en, e.actualizado_en, CURRENT_TIMESTAMP)
        FROM public.usuario AS u
        WHERE u.id_usuario = e.caficultor_id
          AND e.finca_latitud_snapshot IS NULL
          AND e.finca_longitud_snapshot IS NULL;

        ALTER TABLE public.seguimiento_ubicacion
            ADD COLUMN IF NOT EXISTS viaje_id uuid REFERENCES public.viaje(id_viaje);
        UPDATE public.seguimiento_ubicacion AS s
        SET viaje_id = e.viaje_id
        FROM public.entrega AS e
        WHERE e.id_entrega = s.entrega_id AND s.viaje_id IS NULL;

        CREATE INDEX IF NOT EXISTS ix_seguimiento_viaje_fecha
            ON public.seguimiento_ubicacion(viaje_id, registrada_en);
        UPDATE public.seguimiento_ubicacion
        SET precision_m = NULL
        WHERE precision_m > 10000 OR precision_m = 'NaN'::double precision;
        ALTER TABLE public.seguimiento_ubicacion
            DROP CONSTRAINT IF EXISTS chk_seguimiento_precision_valida;
        ALTER TABLE public.seguimiento_ubicacion
            ADD CONSTRAINT chk_seguimiento_precision_valida
            CHECK (precision_m IS NULL OR (precision_m >= 0 AND precision_m <= 10000));
    """)


def downgrade():
    op.execute("""
        ALTER TABLE public.seguimiento_ubicacion DROP CONSTRAINT IF EXISTS chk_seguimiento_precision_valida;
        DROP INDEX IF EXISTS public.ix_seguimiento_viaje_fecha;
        ALTER TABLE public.seguimiento_ubicacion DROP COLUMN IF EXISTS viaje_id;
        ALTER TABLE public.entrega
            DROP COLUMN IF EXISTS finca_ubicacion_snapshot_en,
            DROP COLUMN IF EXISTS finca_direccion_snapshot,
            DROP COLUMN IF EXISTS finca_longitud_snapshot,
            DROP COLUMN IF EXISTS finca_latitud_snapshot;
    """)
