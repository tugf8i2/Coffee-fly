"""Persist travelled distance per delivery.

Revision ID: 20260829_02
Revises: 20260829_01
Create Date: 2026-08-29
"""
from alembic import op

revision = "20260829_02"
down_revision = "20260829_01"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE public.entrega
            ADD COLUMN IF NOT EXISTS distancia_recorrida_m double precision NOT NULL DEFAULT 0;

        WITH ordenados AS (
            SELECT entrega_id,
                   latitud::double precision AS latitud,
                   longitud::double precision AS longitud,
                   lag(latitud::double precision) OVER (
                       PARTITION BY entrega_id ORDER BY registrada_en, id_ubicacion
                   ) AS latitud_anterior,
                   lag(longitud::double precision) OVER (
                       PARTITION BY entrega_id ORDER BY registrada_en, id_ubicacion
                   ) AS longitud_anterior
            FROM public.seguimiento_ubicacion
        ), segmentos AS (
            SELECT entrega_id,
                   2 * 6371000 * asin(sqrt(least(1.0,
                       power(sin(radians(latitud - latitud_anterior) / 2), 2)
                       + cos(radians(latitud_anterior)) * cos(radians(latitud))
                       * power(sin(radians(longitud - longitud_anterior) / 2), 2)
                   ))) AS metros
            FROM ordenados
            WHERE latitud_anterior IS NOT NULL
        ), totales AS (
            SELECT entrega_id, coalesce(sum(metros), 0) AS metros
            FROM segmentos GROUP BY entrega_id
        )
        UPDATE public.entrega AS entrega
        SET distancia_recorrida_m = totales.metros
        FROM totales
        WHERE entrega.id_entrega = totales.entrega_id;

        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_entrega_distancia_recorrida') THEN
                ALTER TABLE public.entrega ADD CONSTRAINT chk_entrega_distancia_recorrida
                    CHECK (distancia_recorrida_m >= 0);
            END IF;
        END $$;
    """)


def downgrade():
    op.execute("ALTER TABLE public.entrega DROP COLUMN IF EXISTS distancia_recorrida_m")
