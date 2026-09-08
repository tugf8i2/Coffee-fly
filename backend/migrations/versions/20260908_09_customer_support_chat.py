"""Agrega conversaciones de servicio al cliente por entrega.

Revision ID: 20260908_09
Revises: 20260907_08
"""

from alembic import op


revision = "20260908_09"
down_revision = "20260907_08"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS public.mensaje_soporte (
            id_mensaje uuid PRIMARY KEY,
            entrega_id uuid NOT NULL REFERENCES public.entrega(id_entrega),
            remitente_id integer REFERENCES public.usuario(id_usuario),
            mensaje varchar(800) NOT NULL,
            fecha_hora timestamp NOT NULL,
            leido_en timestamp NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_mensaje_soporte_entrega_fecha ON public.mensaje_soporte (entrega_id, fecha_hora)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS public.mensaje_soporte")
