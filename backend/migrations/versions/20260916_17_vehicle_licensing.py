"""Add audited vehicle specifications and driver license dates without altering legacy rows.

Revision ID: 20260916_17
Revises: 20260914_16
"""
from alembic import op
import sqlalchemy as sa


revision = "20260916_17"
down_revision = "20260914_16"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "configuracion_vehicular",
        sa.Column("codigo", sa.String(12), primary_key=True),
        sa.Column("descripcion", sa.String(120), nullable=False),
        sa.Column("clase_vehiculo", sa.String(40), nullable=False),
        sa.Column("numero_ejes", sa.Integer()),
        sa.Column("pbv_maximo_legal_kg", sa.Float()),
        sa.Column("licencia_particular", sa.String(2), nullable=False),
        sa.Column("licencia_publico", sa.String(2), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    catalog = sa.table("configuracion_vehicular",
        sa.column("codigo", sa.String), sa.column("descripcion", sa.String),
        sa.column("clase_vehiculo", sa.String), sa.column("numero_ejes", sa.Integer),
        sa.column("pbv_maximo_legal_kg", sa.Float),
        sa.column("licencia_particular", sa.String), sa.column("licencia_publico", sa.String),
    )
    op.bulk_insert(catalog, [
        {"codigo": "LIVIANO", "descripcion": "Camioneta o van", "clase_vehiculo": "liviano", "numero_ejes": None, "pbv_maximo_legal_kg": None, "licencia_particular": "B1", "licencia_publico": "C1"},
        {"codigo": "C2", "descripcion": "Camión rígido 2 ejes", "clase_vehiculo": "rigido", "numero_ejes": 2, "pbv_maximo_legal_kg": 17000, "licencia_particular": "B2", "licencia_publico": "C2"},
        {"codigo": "C3", "descripcion": "Camión rígido 3 ejes", "clase_vehiculo": "rigido", "numero_ejes": 3, "pbv_maximo_legal_kg": 28000, "licencia_particular": "B2", "licencia_publico": "C2"},
        *[{"codigo": code, "descripcion": f"Tractocamión {code[0]} ejes + semirremolque {code[-1]} ejes", "clase_vehiculo": "articulado", "numero_ejes": int(code[0]) + int(code[-1]), "pbv_maximo_legal_kg": maximum, "licencia_particular": "B3", "licencia_publico": "C3"} for code, maximum in (("2S1", 27000), ("2S2", 32000), ("2S3", 40500), ("3S1", 29000), ("3S2", 48000), ("3S3", 52000))],
    ])
    for name, typ in [
        ("marca", sa.String(60)), ("modelo_comercial", sa.String(60)), ("color", sa.String(40)),
        ("clase_vehiculo", sa.String(40)), ("tipo_servicio", sa.String(12)),
        ("configuracion", sa.String(12)), ("numero_ejes", sa.Integer()),
        ("tipo_carroceria", sa.String(60)), ("tara_kg", sa.Float()),
        ("pbv_homologado_kg", sa.Float()), ("soat_vencimiento", sa.Date()),
        ("tecnomecanica_vencimiento", sa.Date()), ("seguro_vencimiento", sa.Date()),
        ("cooperativa_id", sa.Integer()), ("creado_en", sa.DateTime()),
        ("actualizado_en", sa.DateTime()), ("creado_por", sa.Integer()),
        ("actualizado_por", sa.Integer()),
    ]:
        op.add_column("vehiculo", sa.Column(name, typ, nullable=True))
    op.create_foreign_key("fk_vehiculo_configuracion", "vehiculo", "configuracion_vehicular", ["configuracion"], ["codigo"])
    op.create_foreign_key("fk_vehiculo_cooperativa", "vehiculo", "cooperativa", ["cooperativa_id"], ["id_cooperativa"])
    op.create_foreign_key("fk_vehiculo_creado_por", "vehiculo", "usuario", ["creado_por"], ["id_usuario"])
    op.create_foreign_key("fk_vehiculo_actualizado_por", "vehiculo", "usuario", ["actualizado_por"], ["id_usuario"])
    for name, typ in [
        ("numero_licencia", sa.String(40)), ("fecha_expedicion_licencia", sa.Date()),
        ("fecha_vencimiento_licencia", sa.Date()), ("estado_conductor", sa.String(20)),
        ("cooperativa_id", sa.Integer()), ("actualizado_en", sa.DateTime()),
    ]:
        op.add_column("conductor", sa.Column(name, typ, nullable=True))
    op.create_foreign_key("fk_conductor_cooperativa", "conductor", "cooperativa", ["cooperativa_id"], ["id_cooperativa"])
    op.execute("UPDATE conductor SET estado_conductor = 'disponible' WHERE estado_conductor IS NULL")
    op.create_table("auditoria_operativa",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("entidad", sa.String(30), nullable=False),
        sa.Column("entidad_id", sa.String(50), nullable=False),
        sa.Column("accion", sa.String(30), nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuario.id_usuario"), nullable=True),
        sa.Column("antes", sa.JSON(), nullable=True),
        sa.Column("despues", sa.JSON(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), nullable=False),
    )


def downgrade():
    op.drop_table("auditoria_operativa")
    op.drop_constraint("fk_conductor_cooperativa", "conductor", type_="foreignkey")
    for name in ("numero_licencia", "fecha_expedicion_licencia", "fecha_vencimiento_licencia", "estado_conductor", "cooperativa_id", "actualizado_en"):
        op.drop_column("conductor", name)
    for constraint in ("fk_vehiculo_configuracion", "fk_vehiculo_cooperativa", "fk_vehiculo_creado_por", "fk_vehiculo_actualizado_por"):
        op.drop_constraint(constraint, "vehiculo", type_="foreignkey")
    for name in ("marca", "modelo_comercial", "color", "clase_vehiculo", "tipo_servicio", "configuracion", "numero_ejes", "tipo_carroceria", "tara_kg", "pbv_homologado_kg", "soat_vencimiento", "tecnomecanica_vencimiento", "seguro_vencimiento", "cooperativa_id", "creado_en", "actualizado_en", "creado_por", "actualizado_por"):
        op.drop_column("vehiculo", name)
    op.drop_table("configuracion_vehicular")
