"""Renumber active vehicle queues independently from trip history.

Revision ID: 20260914_16
Revises: 20260914_15
"""

from alembic import op
import sqlalchemy as sa


revision = "20260914_16"
down_revision = "20260914_15"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("uq_viaje_vehiculo_orden", "viaje", type_="unique")
    op.execute("""
        WITH turnos AS (
            SELECT id_viaje,
                   ROW_NUMBER() OVER (
                       PARTITION BY vehiculo_id
                       ORDER BY orden_cola, creado_en, id_viaje
                   ) AS nuevo_turno
            FROM viaje
            WHERE estado_viaje IN ('asignado', 'en_cola', 'en_camino')
        )
        UPDATE viaje
        SET orden_cola = turnos.nuevo_turno
        FROM turnos
        WHERE viaje.id_viaje = turnos.id_viaje
    """)
    op.create_index(
        "uq_viaje_vehiculo_turno_activo",
        "viaje",
        ["vehiculo_id", "orden_cola"],
        unique=True,
        postgresql_where=sa.text("estado_viaje IN ('asignado', 'en_cola', 'en_camino')"),
    )


def downgrade():
    op.drop_index("uq_viaje_vehiculo_turno_activo", table_name="viaje")
    op.execute("""
        WITH turnos AS (
            SELECT id_viaje,
                   ROW_NUMBER() OVER (
                       PARTITION BY vehiculo_id
                       ORDER BY creado_en, id_viaje
                   ) AS nuevo_turno
            FROM viaje
        )
        UPDATE viaje
        SET orden_cola = turnos.nuevo_turno
        FROM turnos
        WHERE viaje.id_viaje = turnos.id_viaje
    """)
    op.create_unique_constraint(
        "uq_viaje_vehiculo_orden",
        "viaje",
        ["vehiculo_id", "orden_cola"],
    )
