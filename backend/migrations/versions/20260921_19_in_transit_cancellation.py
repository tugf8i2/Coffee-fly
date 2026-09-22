"""Registra cancelaciones justificadas de cargas pendientes o en camino.

Revision ID: 20260921_19
Revises: 20260917_18
"""
from alembic import op
import sqlalchemy as sa


revision = "20260921_19"
down_revision = "20260917_18"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entrega", sa.Column("motivo_cancelacion", sa.String(500), nullable=True))
    op.add_column("entrega", sa.Column("cancelada_en", sa.DateTime(), nullable=True))
    op.add_column("entrega", sa.Column("cancelada_por", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_entrega_cancelada_por_usuario", "entrega", "usuario",
        ["cancelada_por"], ["id_usuario"],
    )


def downgrade():
    op.drop_constraint("fk_entrega_cancelada_por_usuario", "entrega", type_="foreignkey")
    op.drop_column("entrega", "cancelada_por")
    op.drop_column("entrega", "cancelada_en")
    op.drop_column("entrega", "motivo_cancelacion")
