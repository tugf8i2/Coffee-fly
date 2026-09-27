"""Inicializa de forma segura una base PostgreSQL completamente vacía.

Las instalaciones históricas ya tienen el esquema y continúan exclusivamente
por Alembic. En un servicio administrado nuevo (por ejemplo Hostless), se carga
la base heredada una única vez y luego Alembic aplica todas las revisiones.
"""
from pathlib import Path

from sqlalchemy import inspect, text

from app.core.database import engine


def main() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names(schema="public")
    if tables:
        print("Base existente detectada; se omite la inicialización base.")
        return

    sql_path = Path(__file__).resolve().parents[1] / "BaseDatos.sql"
    sql = sql_path.read_text(encoding="utf-8")
    with engine.begin() as connection:
        # La comprobación se repite dentro de la transacción para no tocar una
        # base que haya empezado a inicializarse en paralelo.
        existing = connection.execute(text(
            "SELECT tablename FROM pg_catalog.pg_tables "
            "WHERE schemaname = 'public' LIMIT 1"
        )).first()
        if existing:
            print("Otra instancia inicializó la base; se omite el script base.")
            return
        connection.exec_driver_sql(sql)
    print("Esquema base de Coffee Fly inicializado.")


if __name__ == "__main__":
    main()
