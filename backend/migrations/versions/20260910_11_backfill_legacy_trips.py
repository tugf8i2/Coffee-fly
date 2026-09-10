"""Convierte asignaciones activas anteriores en viajes.

Revision ID: 20260910_11
Revises: 20260909_10
"""

from alembic import op


revision = "20260910_11"
down_revision = "20260909_10"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$
        DECLARE
            registro RECORD;
            nuevo_viaje uuid;
            nuevo_estado varchar(20);
            nueva_orden integer;
        BEGIN
            FOR registro IN
                SELECT e.id_entrega, e.estado_entrega, e.fecha_hora_entrega,
                       COALESCE(ha.vehiculo_id, c.vehiculo_id) AS vehiculo_id,
                       COALESCE(ha.conductor_id, v.conductor_id) AS conductor_id,
                       c.cooperativa_id, ha.coordinador_id,
                       COALESCE(ha.fecha_hora_asignacion, e.fecha_hora_entrega) AS creado_en,
                       v.estado_vehiculo
                FROM entrega e
                JOIN solicitud s ON s.id_solicitud = e.solicitud_id
                JOIN carga c ON c.id_carga = s.carga_id
                LEFT JOIN vehiculo v ON v.id_vehiculo = c.vehiculo_id
                LEFT JOIN LATERAL (
                    SELECT historial.* FROM historial_asignacion historial
                    WHERE historial.entrega_id = e.id_entrega
                    ORDER BY historial.fecha_hora_asignacion DESC LIMIT 1
                ) ha ON true
                WHERE e.viaje_id IS NULL
                  AND e.estado_entrega IN ('pendiente', 'en camino')
                  AND COALESCE(ha.vehiculo_id, c.vehiculo_id) IS NOT NULL
                  AND COALESCE(ha.conductor_id, v.conductor_id) IS NOT NULL
                  AND c.cooperativa_id IS NOT NULL
                  AND ha.coordinador_id IS NOT NULL
                ORDER BY COALESCE(ha.vehiculo_id, c.vehiculo_id),
                         CASE WHEN e.estado_entrega = 'en camino' THEN 0 ELSE 1 END,
                         e.fecha_hora_entrega
            LOOP
                SELECT COALESCE(MAX(orden_cola), 0) + 1 INTO nueva_orden
                FROM viaje WHERE vehiculo_id = registro.vehiculo_id;

                IF registro.estado_entrega = 'en camino'
                   AND NOT EXISTS (SELECT 1 FROM viaje WHERE vehiculo_id = registro.vehiculo_id AND estado_viaje = 'en_camino')
                   AND NOT EXISTS (SELECT 1 FROM viaje WHERE conductor_id = registro.conductor_id AND estado_viaje = 'en_camino') THEN
                    nuevo_estado := 'en_camino';
                ELSIF NOT EXISTS (SELECT 1 FROM viaje WHERE vehiculo_id = registro.vehiculo_id AND estado_viaje IN ('asignado', 'en_cola', 'en_camino')) THEN
                    nuevo_estado := 'asignado';
                ELSE
                    nuevo_estado := 'en_cola';
                END IF;

                INSERT INTO viaje (
                    id_viaje, vehiculo_id, conductor_id, cooperativa_id, coordinador_id,
                    estado_viaje, orden_cola, creado_en, iniciado_en
                ) VALUES (
                    uuid_generate_v4(), registro.vehiculo_id, registro.conductor_id,
                    registro.cooperativa_id, registro.coordinador_id, nuevo_estado,
                    nueva_orden, registro.creado_en,
                    CASE WHEN nuevo_estado = 'en_camino' THEN registro.creado_en ELSE NULL END
                ) RETURNING id_viaje INTO nuevo_viaje;

                UPDATE entrega SET
                    viaje_id = nuevo_viaje,
                    orden_recoleccion = 1,
                    estado_entrega = CASE
                        WHEN nuevo_estado = 'asignado' AND registro.estado_entrega = 'en camino' THEN 'pendiente'
                        ELSE estado_entrega
                    END
                WHERE id_entrega = registro.id_entrega;
                IF nuevo_estado = 'asignado' AND registro.estado_entrega = 'en camino' THEN
                    UPDATE solicitud SET estado_solicitud = 'pendiente'
                    WHERE id_solicitud = (SELECT solicitud_id FROM entrega WHERE id_entrega = registro.id_entrega);
                    UPDATE vehiculo SET estado_vehiculo = 'disponible', conductor_id = NULL
                    WHERE id_vehiculo = registro.vehiculo_id;
                END IF;
                UPDATE historial_asignacion SET viaje_id = nuevo_viaje
                WHERE entrega_id = registro.id_entrega;
            END LOOP;
        END $$;
    """)


def downgrade():
    pass
