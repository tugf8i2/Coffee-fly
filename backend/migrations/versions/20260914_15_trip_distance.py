"""Persiste la distancia efectiva completa de cada viaje.

Revision ID: 20260914_15
Revises: 20260914_14
"""

from alembic import op


revision = "20260914_15"
down_revision = "20260914_14"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE public.viaje
            ADD COLUMN IF NOT EXISTS distancia_recorrida_m double precision NOT NULL DEFAULT 0;

        WITH ordenados AS (
            SELECT viaje_id,
                   latitud::double precision AS latitud,
                   longitud::double precision AS longitud,
                   COALESCE(precision_m, 0) AS precision_m,
                   LAG(latitud::double precision) OVER ventana AS latitud_anterior,
                   LAG(longitud::double precision) OVER ventana AS longitud_anterior,
                   LAG(COALESCE(precision_m, 0)) OVER ventana AS precision_anterior
            FROM public.seguimiento_ubicacion
            WHERE viaje_id IS NOT NULL
            WINDOW ventana AS (
                PARTITION BY viaje_id ORDER BY registrada_en, id_ubicacion
            )
        ), segmentos AS (
            SELECT viaje_id,
                   GREATEST(
                       0,
                       2 * 6371000 * ASIN(SQRT(LEAST(1, GREATEST(0,
                           POWER(SIN(RADIANS(latitud - latitud_anterior) / 2), 2)
                           + COS(RADIANS(latitud_anterior)) * COS(RADIANS(latitud))
                           * POWER(SIN(RADIANS(longitud - longitud_anterior) / 2), 2)
                       )))) - SQRT(POWER(precision_m, 2) + POWER(precision_anterior, 2))
                   ) AS metros
            FROM ordenados
            WHERE latitud_anterior IS NOT NULL
        ), totales AS (
            SELECT viaje_id, COALESCE(SUM(metros), 0) AS metros
            FROM segmentos
            GROUP BY viaje_id
        )
        UPDATE public.viaje AS v
        SET distancia_recorrida_m = COALESCE(t.metros, 0)
        FROM (
            SELECT v2.id_viaje, COALESCE(totales.metros, 0) AS metros
            FROM public.viaje AS v2
            LEFT JOIN totales ON totales.viaje_id = v2.id_viaje
        ) AS t
        WHERE t.id_viaje = v.id_viaje;

        ALTER TABLE public.viaje
            ADD CONSTRAINT chk_viaje_distancia_recorrida
            CHECK (distancia_recorrida_m >= 0);
    """)


def downgrade():
    op.execute("""
        ALTER TABLE public.viaje DROP CONSTRAINT IF EXISTS chk_viaje_distancia_recorrida;
        ALTER TABLE public.viaje DROP COLUMN IF EXISTS distancia_recorrida_m;
    """)
