# OSRM Colombia

Este despliegue usa OSRM, software BSD-2-Clause, y el extracto nacional de
OpenStreetMap publicado por Geofabrik. Los datos están sujetos a ODbL 1.0 y la
aplicación debe mostrar `Datos de rutas © OpenStreetMap contributors, ODbL`.

## Requisitos

- Docker Desktop con al menos 8 GB de memoria disponibles durante la preparación.
- Entre 5 y 10 GB de disco libre para el PBF y los archivos procesados.
- PowerShell 5.1 o posterior.

## Preparación reproducible

El script descarga `colombia-260901.osm.pbf`, verifica su MD5 y ejecuta el
pipeline MLD completo con OSRM 26.9.0:

```powershell
.\scripts\prepare-osrm-colombia.ps1
```

La preparación puede tardar varios minutos. El volumen se conserva como
`coffee-fly_osrm_data`. El script rechaza un volumen existente para no mezclar
archivos de distintas versiones.

## Inicio

```powershell
docker compose -f docker-compose.yml -f docker-compose.osrm.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.osrm.yml ps
```

El servicio queda disponible localmente en `http://127.0.0.1:5000` y el frontend
web lo consume mediante `/osrm`. Para Expo o un APK en la red local configura:

```text
EXPO_PUBLIC_OSRM_URL=http://IP_DEL_EQUIPO:8080/osrm
```

El teléfono usa así el proxy Nginx del frontend; el puerto 5000 permanece ligado
a localhost. En producción debe quedar detrás de HTTPS y límites de solicitudes.

## Actualización de datos

OSRM no actualiza el grafo en vivo. Una actualización exige preparar un volumen
nuevo con otro PBF, probarlo y después cambiar el servicio. No reconstruyas el
volumen activo mientras atiende viajes.

El conjunto cubre las vías presentes en OpenStreetMap para Colombia. No incluye
tráfico en vivo y puede contener caminos rurales incompletos o desactualizados.
