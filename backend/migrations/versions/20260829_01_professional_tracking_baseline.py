"""Professional tracking, offline sync and security baseline.

Revision ID: 20260829_01
Revises: None
Create Date: 2026-08-29
"""
from alembic import op

revision = "20260829_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE public.usuario
            ADD COLUMN IF NOT EXISTS departamento character varying(100),
            ADD COLUMN IF NOT EXISTS municipio character varying(100),
            ADD COLUMN IF NOT EXISTS vereda character varying(100),
            ADD COLUMN IF NOT EXISTS latitud_finca double precision,
            ADD COLUMN IF NOT EXISTS longitud_finca double precision,
            ADD COLUMN IF NOT EXISTS ubicacion_finca_actualizada_en timestamp,
            ADD COLUMN IF NOT EXISTS habilitado boolean NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS intentos_fallidos integer NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS bloqueado_hasta timestamp with time zone;

        ALTER TABLE public.conductor ADD COLUMN IF NOT EXISTS foto_licencia text;
        ALTER TABLE public.conductor DROP COLUMN IF EXISTS numero_licencia;
        ALTER TABLE public.vehiculo ADD COLUMN IF NOT EXISTS modelo character varying(50);
        ALTER TABLE public.carga
            ADD COLUMN IF NOT EXISTS caficultor_id integer REFERENCES public.usuario(id_usuario);
        ALTER TABLE public.solicitud ADD COLUMN IF NOT EXISTS client_request_id uuid;
        ALTER TABLE public.entrega ADD COLUMN IF NOT EXISTS actualizado_en timestamp;

        ALTER TABLE public.entrega DROP CONSTRAINT IF EXISTS entrega_estado_entrega_check;
        ALTER TABLE public.entrega DROP CONSTRAINT IF EXISTS chk_estados_entrega;
        ALTER TABLE public.entrega ADD CONSTRAINT chk_estados_entrega CHECK (
            estado_entrega IN ('pendiente', 'en camino', 'entregado', 'cancelado')
        );

        CREATE TABLE IF NOT EXISTS public.auth_session (
            token character varying(64) PRIMARY KEY,
            user_id integer NOT NULL REFERENCES public.usuario(id_usuario),
            expires_at timestamp with time zone NOT NULL
        );

        CREATE TABLE IF NOT EXISTS public.seguimiento_ubicacion (
            id_ubicacion uuid PRIMARY KEY,
            client_point_id uuid,
            entrega_id uuid NOT NULL REFERENCES public.entrega(id_entrega),
            vehiculo_id integer NOT NULL REFERENCES public.vehiculo(id_vehiculo),
            latitud numeric(9,6) NOT NULL,
            longitud numeric(9,6) NOT NULL,
            precision_m double precision,
            velocidad_m_s double precision,
            rumbo_grados double precision,
            registrada_en timestamp NOT NULL,
            recibida_en timestamp
        );
        ALTER TABLE public.seguimiento_ubicacion
            ADD COLUMN IF NOT EXISTS client_point_id uuid,
            ADD COLUMN IF NOT EXISTS precision_m double precision,
            ADD COLUMN IF NOT EXISTS velocidad_m_s double precision,
            ADD COLUMN IF NOT EXISTS rumbo_grados double precision,
            ADD COLUMN IF NOT EXISTS recibida_en timestamp;

        CREATE INDEX IF NOT EXISTS ix_auth_session_user_id ON public.auth_session(user_id);
        CREATE INDEX IF NOT EXISTS ix_carga_caficultor_id ON public.carga(caficultor_id);
        CREATE UNIQUE INDEX IF NOT EXISTS ux_solicitud_client_request_id
            ON public.solicitud(client_request_id) WHERE client_request_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_seguimiento_client_point_id
            ON public.seguimiento_ubicacion(client_point_id) WHERE client_point_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS ix_seguimiento_entrega_fecha
            ON public.seguimiento_ubicacion(entrega_id, registrada_en);
        CREATE INDEX IF NOT EXISTS ix_seguimiento_vehiculo_id
            ON public.seguimiento_ubicacion(vehiculo_id);
        CREATE INDEX IF NOT EXISTS ix_entrega_fecha_hora_entrega ON public.entrega(fecha_hora_entrega);
        CREATE INDEX IF NOT EXISTS ix_entrega_caficultor_id ON public.entrega(caficultor_id);
        CREATE INDEX IF NOT EXISTS ix_entrega_estado_entrega ON public.entrega(estado_entrega);
        CREATE INDEX IF NOT EXISTS ix_historial_estado_entrega_entrega_id
            ON public.historial_estado_entrega(entrega_id);
        CREATE INDEX IF NOT EXISTS ix_historial_estado_entrega_fecha_hora_cambio
            ON public.historial_estado_entrega(fecha_hora_cambio);
    """)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_seguimiento_coordenadas') THEN
                ALTER TABLE public.seguimiento_ubicacion ADD CONSTRAINT chk_seguimiento_coordenadas CHECK (
                    latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_seguimiento_precision') THEN
                ALTER TABLE public.seguimiento_ubicacion ADD CONSTRAINT chk_seguimiento_precision CHECK (
                    precision_m IS NULL OR precision_m >= 0
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_seguimiento_velocidad') THEN
                ALTER TABLE public.seguimiento_ubicacion ADD CONSTRAINT chk_seguimiento_velocidad CHECK (
                    velocidad_m_s IS NULL OR velocidad_m_s >= 0
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_seguimiento_rumbo') THEN
                ALTER TABLE public.seguimiento_ubicacion ADD CONSTRAINT chk_seguimiento_rumbo CHECK (
                    rumbo_grados IS NULL OR rumbo_grados BETWEEN 0 AND 360
                );
            END IF;
        END $$;
    """)


def downgrade():
    # Esta primera revisión adopta bases existentes y es intencionalmente
    # forward-only para no eliminar datos operativos al bajar de versión.
    pass
