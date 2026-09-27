[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\infra\tiles\data'),
    [ValidateRange(2, 12)]
    [int]$MemoryGb = 5,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$image = 'openmaptiles/planetiler-openmaptiles:3.16'
$filename = 'coffee-fly-colombia.mbtiles'
$output = [System.IO.Path]::GetFullPath($OutputDirectory)

if (-not (Test-Path -LiteralPath $output)) {
    New-Item -ItemType Directory -Path $output -Force | Out-Null
}

$target = Join-Path $output $filename
if ((Test-Path -LiteralPath $target) -and -not $Force) {
    throw "Ya existe $target. Usa -Force solo si deseas regenerarlo."
}

$sourcesDirectory = Join-Path $output 'sources'
$osmPath = Join-Path $sourcesDirectory 'colombia.osm.pbf'
if (-not (Test-Path -LiteralPath $sourcesDirectory)) {
    New-Item -ItemType Directory -Path $sourcesDirectory -Force | Out-Null
}
if (-not (Test-Path -LiteralPath $osmPath) -or (Get-Item -LiteralPath $osmPath).Length -lt 100MB) {
    Write-Host 'Descargando el extracto oficial de Colombia (la descarga se puede reanudar).'
    & curl.exe -L --fail --retry 8 --retry-all-errors --continue-at - `
        --output $osmPath 'https://download.geofabrik.de/south-america/colombia-latest.osm.pbf'
    if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar el extracto de Colombia (codigo $LASTEXITCODE)." }
}
if ((Get-Item -LiteralPath $osmPath).Length -lt 100MB) {
    throw "El extracto de Colombia parece incompleto: $osmPath"
}

$driveName = [System.IO.Path]::GetPathRoot($output).TrimEnd('\').TrimEnd(':')
$drive = Get-PSDrive -Name $driveName -PSProvider FileSystem
$minimumFreeBytes = 12GB
if ($drive.Free -lt $minimumFreeBytes) {
    throw "La unidad $driveName necesita al menos 12 GB libres para fuentes, temporales y MBTiles."
}

docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker no esta disponible. Inicia o repara Docker Desktop antes de generar las teselas.'
}

$arguments = @(
    'run', '--rm',
    '-e', "JAVA_TOOL_OPTIONS=-Xmx${MemoryGb}g",
    '-v', "${output}:/data",
    $image,
    '--download',
    '--area=colombia',
    # Usa el extracto descargado en el host para que una interrupción de red no
    # obligue a repetir los 330 MB dentro del contenedor.
    '--osm_path=/data/sources/colombia.osm.pbf',
    '--download_dir=/data/sources',
    '--tmpdir=/data/tmp',
    '--http_timeout=120s',
    '--http_retries=10',
    "--output=/data/$filename",
    '--storage=mmap',
    '--building-merge-z13=false',
    '--mbtiles-name=Coffee Fly Colombia',
    '--mbtiles-description=Cartografia OSM para navegacion rural de Coffee Fly',
    '--mbtiles-attribution=© OpenMapTiles © OpenStreetMap contributors'
)
if ($Force) { $arguments += '--force' }

Write-Host "Generando $target con $image."
Write-Host 'La primera ejecucion descarga el extracto de Colombia y fuentes cartograficas auxiliares.'
& docker @arguments
if ($LASTEXITCODE -ne 0) { throw "Planetiler termino con codigo $LASTEXITCODE." }
if (-not (Test-Path -LiteralPath $target)) { throw 'Planetiler termino sin crear el MBTiles esperado.' }

$result = Get-Item -LiteralPath $target
Write-Host ("MBTiles listo: {0} ({1:N2} GB)" -f $result.FullName, ($result.Length / 1GB))
