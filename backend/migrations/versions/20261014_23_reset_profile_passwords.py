"""Restablece una sola vez la clave de los perfiles existentes.

Revision ID: 20261014_23
Revises: 20260926_22

El cambio de claves no se puede revertir: los hashes anteriores no se conservan.
Las cuentas retiradas quedan intactas y las deshabilitadas siguen deshabilitadas.
"""

from alembic import op
import sqlalchemy as sa


revision = "20261014_23"
down_revision = "20260926_22"
branch_labels = None
depends_on = None

# Hash Argon2id de la clave temporal solicitada por el propietario: Admin123.
# No guardar la clave en texto plano en la base de datos.
_RESET_HASH = "$argon2id$v=19$m=65536,t=3,p=4$ZT0qtdZxejyggFsCTRHrcA$Iq7qjPi/ofxG4y+uRmk2lqIvOH2oBky3qVVbbrvSrOI"


def reset_existing_profiles(connection):
    # Invalidar sesiones antiguas para que cada perfil vuelva a autenticarse.
    connection.execute(sa.text(
        "DELETE FROM auth_session WHERE user_id IN "
        "(SELECT id_usuario FROM usuario WHERE eliminado_en IS NULL)"
    ))
    result = connection.execute(sa.text(
        "UPDATE usuario SET contrasena = :password_hash, "
        "intentos_fallidos = 0, bloqueado_hasta = NULL "
        "WHERE eliminado_en IS NULL"
    ), {"password_hash": _RESET_HASH})
    return result.rowcount


def upgrade():
    count = reset_existing_profiles(op.get_bind())
    print(f"Claves de {count} perfiles activos restablecidas; sesiones revocadas.")


def downgrade():
    # Los hashes previos no son recuperables. La revisión no altera el esquema.
    pass
