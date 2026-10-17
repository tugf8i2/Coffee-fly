"""Store photographic evidence for driver route events.

Revision ID: 20261016_25
Revises: 20261015_24
"""

from alembic import op
import sqlalchemy as sa

revision = "20261016_25"
down_revision = "20261015_24"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("historial_de_eventos", sa.Column("fotos_evidencia", sa.JSON(), nullable=False, server_default="[]"))


def downgrade():
    op.drop_column("historial_de_eventos", "fotos_evidencia")
