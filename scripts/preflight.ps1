[CmdletBinding()]
param(
    [string]$PublicUrl = 'http://127.0.0.1:8080',
    [switch]$SkipRunningServices
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$composePath = Join-Path $projectRoot 'docker-compose.yml'
$envPath = Join-Path $projectRoot '.env'
$requiredFiles = @(
    'backend/Dockerfile',
    'backend/requirements.lock.txt',
    'frontend/Dockerfile',
    'frontend/package-lock.json',
    'frontend/nginx.conf'
)
$failures = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Add-CheckResult {
    param([bool]$Ok, [string]$Success, [string]$Failure)
    if ($Ok) { Write-Host "[OK] $Success" -ForegroundColor Green }
    else {
        Write-Host "[ERROR] $Failure" -ForegroundColor Red
        $script:failures.Add($Failure)
    }
}

Write-Host 'Diagnóstico de despliegue Coffee Fly' -ForegroundColor Cyan
Add-CheckResult (Test-Path -LiteralPath $composePath) 'docker-compose.yml encontrado.' 'Falta docker-compose.yml en la raíz del proyecto.'
foreach ($relativePath in $requiredFiles) {
    $requiredPath = Join-Path $projectRoot $relativePath
    Add-CheckResult (Test-Path -LiteralPath $requiredPath) "$relativePath encontrado." "Falta $relativePath; el despliegue no es reproducible."
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
Add-CheckResult ($null -ne $docker) 'Docker está instalado.' 'Docker no está instalado o no aparece en PATH.'
if ($null -eq $docker) { exit 1 }

try {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw 'El motor de Docker no respondió.' }
    Add-CheckResult $true 'El motor de Docker está activo.' ''
} catch {
    Add-CheckResult $false '' 'Docker está instalado, pero el motor no está activo. Abre Docker Desktop.'
}

try {
    docker compose version *> $null
    Add-CheckResult ($LASTEXITCODE -eq 0) 'Docker Compose v2 está disponible.' 'Docker Compose v2 no está disponible.'
} catch {
    Add-CheckResult $false '' 'Docker Compose v2 no está disponible. Actualiza Docker Desktop o instala el complemento compose.'
}

try {
    Push-Location $projectRoot
    docker compose config --quiet
    Add-CheckResult ($LASTEXITCODE -eq 0) 'La configuración de Docker Compose es válida.' 'docker compose config detectó un error.'
} catch {
    Add-CheckResult $false '' "No se pudo validar Docker Compose: $($_.Exception.Message)"
} finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $envPath)) {
    $warnings.Add('No existe .env; se usarán valores de desarrollo. Copia .env.example antes de un despliegue real.')
} else {
    $envText = Get-Content -LiteralPath $envPath -Raw
    if ($envText -match 'development-only|POSTGRES_PASSWORD=1234|BOOTSTRAP_REGISTRADOR_PASSWORD=Admin123') {
        $warnings.Add('El archivo .env conserva secretos de desarrollo. Cámbialos antes de exponer el sistema.')
    }
    if ($envText -match 'EXPO_PUBLIC_API_URL=http://localhost:8000') {
        $warnings.Add('EXPO_PUBLIC_API_URL apunta a localhost. Para Docker web usa EXPO_PUBLIC_API_URL=/api.')
    }
    if ($envText -match '(?m)^POSTGRES_PASSWORD=.*[@:/?#\[\]]') {
        $warnings.Add('POSTGRES_PASSWORD contiene caracteres reservados de URL. Usa una clave alfanumérica larga o codifica esos caracteres para DATABASE_URL.')
    }
}

if (-not $SkipRunningServices) {
    try {
        $healthUrl = "$($PublicUrl.TrimEnd('/'))/health"
        $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 8
        Add-CheckResult ($health.status -eq 'ready') "Frontend, proxy, API y base de datos responden en $healthUrl." "El servicio respondió, pero no está listo en $healthUrl."
    } catch {
        Add-CheckResult $false '' "No se pudo alcanzar $PublicUrl/health. Ejecuta docker compose up -d --build y revisa docker compose logs."
    }
}

foreach ($warning in $warnings) { Write-Host "[AVISO] $warning" -ForegroundColor Yellow }
if ($failures.Count -gt 0) {
    Write-Host "Diagnóstico terminado con $($failures.Count) error(es)." -ForegroundColor Red
    exit 1
}
Write-Host 'Diagnóstico terminado: el entorno está listo.' -ForegroundColor Green
