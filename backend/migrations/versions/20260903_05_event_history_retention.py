"""Estructura y retención del historial de eventos.

Revision ID: 20260903_05
Revises: 20260902_04
"""

from alembic import op


revision = "20260903_05"
down_revision = "20260902_04"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE public.historial_de_eventos
            ADD COLUMN IF NOT EXISTS entrega_id uuid REFERENCES public.entrega(id_entrega),
            ADD COLUMN IF NOT EXISTS tipo_evento character varying(30),
            ADD COLUMN IF NOT EXISTS expira_en timestamp;

        ALTER TABLE public.historial_de_eventos
            ALTER COLUMN descripcion_evento TYPE character varying(300);

        UPDATE public.historial_de_eventos evento
        SET entrega_id = entrega.id_entrega
        FROM public.solicitud solicitud
        JOIN public.entrega entrega ON entrega.solicitud_id = solicitud.id_solicitud
        WHERE solicitud.carga_id = evento.carga_id AND evento.entrega_id IS NULL;

        UPDATE public.historial_de_eventos
        SET tipo_evento = CASE
            WHEN lower(descripcion_evento) LIKE 'inicio del viaje%' THEN 'inicio del viaje'
            WHEN lower(descripcion_evento) LIKE 'retraso%' THEN 'retraso'
            WHEN lower(descripcion_evento) LIKE 'llegada%' THEN 'llegada'
            WHEN lower(descripcion_evento) LIKE 'entrega realizada%' THEN 'entrega realizada'
            WHEN lower(descripcion_evento) LIKE 'daño vehicular%' THEN 'daño vehicular'
            WHEN lower(descripcion_evento) LIKE 'parada para ir al baño%' THEN 'parada baño'
            WHEN lower(descripcion_evento) LIKE 'nuevo imprevisto%' THEN 'imprevisto nuevo'
            ELSE 'inconveniente'
        END
        WHERE tipo_evento IS NULL;

        UPDATE public.historial_de_eventos
        SET expira_en = fecha_hora_evento + interval '30 days'
        WHERE expira_en IS NULL;

        ALTER TABLE public.historial_de_eventos ALTER COLUMN tipo_evento SET NOT NULL;
        ALTER TABLE public.historial_de_eventos ALTER COLUMN expira_en SET NOT NULL;

        CREATE INDEX IF NOT EXISTS ix_historial_eventos_entrega_fecha
            ON public.historial_de_eventos(entrega_id, fecha_hora_evento);
        CREATE INDEX IF NOT EXISTS ix_historial_eventos_tipo
            ON public.historial_de_eventos(tipo_evento);
        CREATE INDEX IF NOT EXISTS ix_historial_eventos_expira
            ON public.historial_de_eventos(expira_en);
    """)


def downgrade():
    op.execute("""
        DROP INDEX IF EXISTS public.ix_historial_eventos_expira;
        DROP INDEX IF EXISTS public.ix_historial_eventos_tipo;
        DROP INDEX IF EXISTS public.ix_historial_eventos_entrega_fecha;
        ALTER TABLE public.historial_de_eventos DROP COLUMN IF EXISTS expira_en;
        ALTER TABLE public.historial_de_eventos DROP COLUMN IF EXISTS tipo_evento;
        ALTER TABLE public.historial_de_eventos DROP COLUMN IF EXISTS entrega_id;
        ALTER TABLE public.historial_de_eventos
            ALTER COLUMN descripcion_evento TYPE character varying(100);
    """)
