$ErrorActionPreference = 'Stop'

$volume = 'coffee-fly_osrm_data'
$osrmImage = 'ghcr.io/project-osrm/osrm-backend:v26.9.0-debian@sha256:8a1b1bc938412f15f9b5b32d794c4ec6bf4a85dfbbabfa0a014b70b187edb53b'
$curlImage = 'curlimages/curl:8.16.0'
$pbfUrl = 'https://download.geofabrik.de/south-america/colombia-260901.osm.pbf'
$pbfMd5 = 'd737f89c48b56352a6d341d31bed25ec'

function Invoke-Docker {
  & docker @args
  if ($LASTEXITCODE -ne 0) { throw "Docker terminó con código $LASTEXITCODE." }
}

& docker volume inspect $volume *> $null
if ($LASTEXITCODE -eq 0) {
  throw "El volumen $volume ya existe. Elimínalo explícitamente para reconstruir los datos."
}

Invoke-Docker volume create $volume
Invoke-Docker run --rm --user 0:0 -v "${volume}:/data" $curlImage -fL --retry 5 --retry-all-errors -o /data/colombia.osm.pbf $pbfUrl
Invoke-Docker run --rm --user 0:0 --entrypoint /bin/sh -v "${volume}:/data" $curlImage -c "echo '$pbfMd5  /data/colombia.osm.pbf' | md5sum -c -"
Invoke-Docker run --rm -t -v "${volume}:/data" $osrmImage osrm-extract -p /opt/car.lua /data/colombia.osm.pbf
Invoke-Docker run --rm -t -v "${volume}:/data" $osrmImage osrm-partition /data/colombia.osrm
Invoke-Docker run --rm -t -v "${volume}:/data" $osrmImage osrm-customize /data/colombia.osrm

"OSRM Colombia quedó preparado en el volumen $volume."
