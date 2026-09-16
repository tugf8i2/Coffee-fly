# Vehículos, pesos y licencias en Coffee Fly

## Migración y datos existentes

La migración `20260916_17_vehicle_licensing` extiende las tablas existentes de vehículo y conductor, crea un catálogo de configuraciones y una tabla de auditoría. No borra registros ni intenta inferir tara, PBV o vencimientos a partir de la capacidad antigua. Los vehículos y conductores anteriores conservan su historial y deben completar esos datos antes de recibir nuevas asignaciones.

Para aplicar la migración: `cd backend` y `alembic upgrade head` con la `DATABASE_URL` del entorno. El contenedor backend la aplica al iniciar. En Registrador → Vehículos, editar los vehículos anteriores; en Registrador → Conductores, completar número, foto, categoría y vencimiento de licencia.

## Reglas

- Capacidad útil en kg = `min(PBV homologado, PBV máximo legal si aplica) - tara`. El backend la recalcula al crear o editar; no acepta una capacidad enviada por el navegador.
- El catálogo inicial incluye LIVIANO (sin límite universal inventado), C2, C3, 2S1, 2S2, 2S3, 3S1, 3S2 y 3S3. Los límites y licencias de las configuraciones se pueden modificar mediante `PUT /vehiculos/catalogo/{codigo}` con rol registrador; cada cambio queda auditado.
- Antes de asignar, el backend vuelve a verificar peso total positivo, capacidad, SOAT, técnico-mecánica, seguro, categoría y vencimiento de licencia, estado y cooperativa. Antes de iniciar, vuelve a verificar peso, documentos y licencia.
- Una asignación acepta varias cargas. También se conserva la cola de varios viajes para un mismo vehículo. Cada viaje se valida por su propio peso total; una carga concreta no puede asignarse dos veces. El vehículo, las cargas y el conductor se bloquean transaccionalmente durante la asignación.
- No se desactiva ni cambia la ficha técnica de un vehículo con viajes reservados. La desactivación es lógica para conservar el historial.
- El GPS, las geocercas, la confirmación de cada carga y el cierre del viaje mantienen su flujo existente.

## API y comprobación

`GET /vehiculos/catalogo`, `GET /vehiculos/compatibilidad?peso_kg=8500`, `GET /vehiculos/{id}/conductores-compatibles`, `POST /viajes/`, `POST /viajes/{id}/iniciar` y `POST /viajes/{id}/completar` son las rutas principales. La ruta antigua de asignación de una entrega delega en el mismo servicio validado.

En `backend`: `python -m unittest discover -s tests -p 'test_*.py' -q`. Con PostgreSQL local y la API corriendo: `python tests/integration_full_flow_live.py` (definir `DATABASE_URL` y `PYTHONPATH=.`). La integración crea sus propios datos de prueba y los elimina al finalizar. En `frontend`: `npm test -- --runInBand` y `npx expo export --platform web --output-dir dist-check`.

La tabla legal del PBV pesado proviene del [Ministerio de Transporte](https://mintransporte.gov.co/info/mintransporte/media/anexos/e4SoyADr.pdf). Las [categorías de licencia](https://mintransporte.gov.co/publicaciones/2764/mintransporte-presenta-nueva-licencia-de-conduccion/) y su [equivalencia C/B](https://mintransporte.gov.co/info/mintransporte/media/anexos/UKVFcrgU.pdf) deben revisarse al actualizar el catálogo. El rango SICE-TAC para livianos no se usa como una capacidad universal.
