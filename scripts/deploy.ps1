[CmdletBinding()]
param([string]$PublicUrl = 'http://127.0.0.1:8080')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$preflight = Join-Path $PSScriptRoot 'preflight.ps1'

Push-Location $projectRoot
try {
    & $preflight -SkipRunningServices
    if ($LASTEXITCODE -ne 0) { throw 'Corrige los errores del diagnóstico antes de continuar.' }

    docker compose up -d --build --remove-orphans
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose no pudo construir o iniciar Coffee Fly.' }

    $ready = $false
    foreach ($attempt in 1..36) {
        try {
            $health = Invoke-RestMethod -Uri "$($PublicUrl.TrimEnd('/'))/health" -TimeoutSec 5
            if ($health.status -eq 'ready') { $ready = $true; break }
        } catch {}
        Start-Sleep -Seconds 5
    }
    if (-not $ready) {
        docker compose ps
        docker compose logs --tail 80 backend frontend
        throw 'Coffee Fly no quedó listo en tres minutos. Los últimos logs aparecen arriba.'
    }

    & $preflight -PublicUrl $PublicUrl
    if ($LASTEXITCODE -ne 0) { throw 'El diagnóstico final encontró un problema.' }
    Write-Host "Coffee Fly está listo en $PublicUrl" -ForegroundColor Green
} finally {
    Pop-Location
}
