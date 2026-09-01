"""Alinea los modelos con PostgreSQL y elimina índices duplicados.

Revision ID: 20260829_03
Revises: 20260829_02
"""

from alembic import op


revision = "20260829_03"
down_revision = "20260829_02"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE public.carga ALTER COLUMN estado_sincronizacion SET NOT NULL")
    op.execute("ALTER TABLE public.conductor ALTER COLUMN foto_licencia SET NOT NULL")
    op.execute("ALTER TABLE public.conductor ALTER COLUMN usuario_id SET NOT NULL")
    op.execute("ALTER TABLE public.cooperativa ALTER COLUMN telefono SET NOT NULL")
    op.execute("ALTER TABLE public.cooperativa ALTER COLUMN correo SET NOT NULL")
    op.execute("ALTER TABLE public.cooperativa ALTER COLUMN ubicacion_id SET NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN carga_id SET NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN descripcion_evento SET NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN fecha_hora_evento SET NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN fecha_hora_sincronizacion SET NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN usuario_id_cambio SET NOT NULL")
    op.execute("ALTER TABLE public.rol ALTER COLUMN descripcion_rol SET NOT NULL")
    op.execute("ALTER TABLE public.usuario ALTER COLUMN contrasena SET NOT NULL")

    op.execute("DROP INDEX IF EXISTS public.ix_public_auth_session_user_id")
    op.execute("DROP INDEX IF EXISTS public.ix_public_seguimiento_ubicacion_client_point_id")
    op.execute("DROP INDEX IF EXISTS public.ix_public_seguimiento_ubicacion_entrega_id")
    op.execute("DROP INDEX IF EXISTS public.ix_public_seguimiento_ubicacion_recibida_en")
    op.execute("DROP INDEX IF EXISTS public.ix_public_seguimiento_ubicacion_registrada_en")
    op.execute("DROP INDEX IF EXISTS public.ix_public_seguimiento_ubicacion_vehiculo_id")

    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_entrega_solicitud_id'
            ) THEN
                ALTER TABLE public.entrega
                    ADD CONSTRAINT uq_entrega_solicitud_id UNIQUE (solicitud_id);
            END IF;
        END $$;
    """)


def downgrade():
    op.execute("ALTER TABLE public.entrega DROP CONSTRAINT IF EXISTS uq_entrega_solicitud_id")
    op.execute("ALTER TABLE public.usuario ALTER COLUMN contrasena DROP NOT NULL")
    op.execute("ALTER TABLE public.rol ALTER COLUMN descripcion_rol DROP NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN usuario_id_cambio DROP NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN fecha_hora_sincronizacion DROP NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN fecha_hora_evento DROP NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN descripcion_evento DROP NOT NULL")
    op.execute("ALTER TABLE public.historial_de_eventos ALTER COLUMN carga_id DROP NOT NULL")
    op.execute("ALTER TABLE public.cooperativa ALTER COLUMN ubicacion_id DROP NOT NULL")
    op.execute("ALTER TABLE public.cooperativa ALTER COLUMN correo DROP NOT NULL")
    op.execute("ALTER TABLE public.cooperativa ALTER COLUMN telefono DROP NOT NULL")
    op.execute("ALTER TABLE public.conductor ALTER COLUMN usuario_id DROP NOT NULL")
    op.execute("ALTER TABLE public.conductor ALTER COLUMN foto_licencia DROP NOT NULL")
    op.execute("ALTER TABLE public.carga ALTER COLUMN estado_sincronizacion DROP NOT NULL")
