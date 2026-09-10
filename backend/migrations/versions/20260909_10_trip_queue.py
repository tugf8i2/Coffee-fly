"""Agrupa cargas en viajes y programa una cola por vehículo.

Revision ID: 20260909_10
Revises: 20260908_09
"""

from alembic import op


revision = "20260909_10"
down_revision = "20260908_09"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.viaje (
            id_viaje uuid PRIMARY KEY DEFAULT public.uuid_generate_v4(),
            vehiculo_id integer NOT NULL REFERENCES public.vehiculo(id_vehiculo),
            conductor_id integer NOT NULL REFERENCES public.conductor(id_conductor),
            coordinador_id integer NOT NULL REFERENCES public.usuario(id_usuario),
            cooperativa_id integer NOT NULL REFERENCES public.cooperativa(id_cooperativa),
            estado_viaje character varying(20) NOT NULL,
            orden_cola integer NOT NULL,
            creado_en timestamp NOT NULL DEFAULT current_timestamp,
            iniciado_en timestamp,
            completado_en timestamp,
            CONSTRAINT uq_viaje_vehiculo_orden UNIQUE (vehiculo_id, orden_cola),
            CONSTRAINT chk_viaje_estado CHECK (estado_viaje IN ('asignado', 'en_cola', 'en_camino', 'completado', 'cancelado')),
            CONSTRAINT chk_viaje_orden CHECK (orden_cola > 0)
        );
        ALTER TABLE public.entrega
            ADD COLUMN IF NOT EXISTS viaje_id uuid REFERENCES public.viaje(id_viaje),
            ADD COLUMN IF NOT EXISTS orden_recoleccion integer;
        ALTER TABLE public.historial_asignacion
            ADD COLUMN IF NOT EXISTS viaje_id uuid REFERENCES public.viaje(id_viaje);
        CREATE INDEX IF NOT EXISTS ix_viaje_vehiculo_id ON public.viaje(vehiculo_id);
        CREATE INDEX IF NOT EXISTS ix_viaje_conductor_id ON public.viaje(conductor_id);
        CREATE INDEX IF NOT EXISTS ix_viaje_estado_viaje ON public.viaje(estado_viaje);
        CREATE INDEX IF NOT EXISTS ix_entrega_viaje_id ON public.entrega(viaje_id);
        CREATE UNIQUE INDEX IF NOT EXISTS ux_viaje_vehiculo_activo
            ON public.viaje(vehiculo_id) WHERE estado_viaje = 'en_camino';
        CREATE UNIQUE INDEX IF NOT EXISTS ux_viaje_conductor_activo
            ON public.viaje(conductor_id) WHERE estado_viaje = 'en_camino';
    """)


def downgrade():
    op.execute("""
        ALTER TABLE public.historial_asignacion DROP COLUMN IF EXISTS viaje_id;
        ALTER TABLE public.entrega DROP COLUMN IF EXISTS orden_recoleccion;
        ALTER TABLE public.entrega DROP COLUMN IF EXISTS viaje_id;
        DROP TABLE IF EXISTS public.viaje;
    """)
