"""Agrega identidad, propietario e inspecciones preoperacionales.

Revision ID: 20260926_22
Revises: 20260926_21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260926_22"
down_revision = "20260926_21"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("usuario", sa.Column("tipo_documento", sa.String(20), nullable=True))
    op.add_column("usuario", sa.Column("numero_documento", sa.String(30), nullable=True))
    op.add_column("vehiculo", sa.Column("propietario_nombre", sa.String(120), nullable=True))
    op.add_column("vehiculo", sa.Column("propietario_documento", sa.String(30), nullable=True))
    op.add_column("vehiculo", sa.Column("foto_vehiculo", sa.Text(), nullable=True))
    op.create_table(
        "inspeccion_vehiculo",
        sa.Column("id_inspeccion", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_inspection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vehiculo_id", sa.Integer(), nullable=False),
        sa.Column("conductor_id", sa.Integer(), nullable=False),
        sa.Column("viaje_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("estado_general", sa.String(20), nullable=False),
        sa.Column("items", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("capturada_en", sa.DateTime(), nullable=False),
        sa.Column("sincronizada_en", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["conductor_id"], ["conductor.id_conductor"]),
        sa.ForeignKeyConstraint(["vehiculo_id"], ["vehiculo.id_vehiculo"]),
        sa.ForeignKeyConstraint(["viaje_id"], ["viaje.id_viaje"]),
        sa.PrimaryKeyConstraint("id_inspeccion"),
        sa.UniqueConstraint("client_inspection_id"),
    )
    op.create_index("ix_inspeccion_vehiculo_client_inspection_id", "inspeccion_vehiculo", ["client_inspection_id"], unique=True)
    op.create_index("ix_inspeccion_vehiculo_fecha", "inspeccion_vehiculo", ["vehiculo_id", "capturada_en"])
    op.create_index("ix_inspeccion_conductor_fecha", "inspeccion_vehiculo", ["conductor_id", "capturada_en"])
    op.create_index("ix_inspeccion_vehiculo_vehiculo_id", "inspeccion_vehiculo", ["vehiculo_id"])
    op.create_index("ix_inspeccion_vehiculo_conductor_id", "inspeccion_vehiculo", ["conductor_id"])
    op.create_index("ix_inspeccion_vehiculo_viaje_id", "inspeccion_vehiculo", ["viaje_id"])


def downgrade():
    op.drop_table("inspeccion_vehiculo")
    op.drop_column("vehiculo", "foto_vehiculo")
    op.drop_column("vehiculo", "propietario_documento")
    op.drop_column("vehiculo", "propietario_nombre")
    op.drop_column("usuario", "numero_documento")
    op.drop_column("usuario", "tipo_documento")
