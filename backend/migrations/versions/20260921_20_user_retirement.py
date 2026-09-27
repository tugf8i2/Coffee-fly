"""Conserva referencias históricas al retirar perfiles de usuario.

Revision ID: 20260921_20
Revises: 20260921_19
"""
from alembic import op
import sqlalchemy as sa


revision = "20260921_20"
down_revision = "20260921_19"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("usuario", sa.Column("eliminado_en", sa.DateTime(), nullable=True))
    op.create_index("ix_usuario_eliminado_en", "usuario", ["eliminado_en"])


def downgrade():
    op.drop_index("ix_usuario_eliminado_en", table_name="usuario")
    op.drop_column("usuario", "eliminado_en")
