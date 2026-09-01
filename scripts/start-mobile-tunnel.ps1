[CmdletBinding()]
param(
    [ValidateSet('dev-client', 'go')]
    [string]$ExpoClient = 'go'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $projectRoot 'backend'
$frontendPath = Join-Path $projectRoot 'frontend'
$runtimePath = Join-Path $projectRoot '.runtime'
$cloudflaredPath = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$frontendEnvPath = Join-Path $frontendPath '.env'
$cloudflaredOut = Join-Path $runtimePath 'cloudflared-api.out.log'
$cloudflaredError = Join-Path $runtimePath 'cloudflared-api.error.log'
$startedBackend = $false
$backendProcess = $null
$tunnelProcess = $null

if (-not (Test-Path -LiteralPath $cloudflaredPath)) {
    throw "No se encontró cloudflared en $cloudflaredPath"
}

New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
Remove-Item -LiteralPath $cloudflaredOut -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $cloudflaredError -Force -ErrorAction SilentlyContinue

try {
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health/ready' -TimeoutSec 3
        if ($health.status -ne 'ready') { throw 'FastAPI no está listo' }
        Write-Host 'FastAPI ya estaba activo en el puerto 8000.' -ForegroundColor Green
    } catch {
        $backendProcess = Start-Process -FilePath 'python' `
            -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000' `
            -WorkingDirectory $backendPath -WindowStyle Hidden -PassThru
        $startedBackend = $true
        $ready = $false
        foreach ($attempt in 1..30) {
            Start-Sleep -Milliseconds 500
            try {
                $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health/ready' -TimeoutSec 2
                if ($health.status -eq 'ready') { $ready = $true; break }
            } catch {}
            if ($backendProcess.HasExited) { break }
        }
        if (-not $ready) { throw 'FastAPI no pudo iniciar. Revisa backend/.env y PostgreSQL.' }
        Write-Host 'FastAPI iniciado correctamente.' -ForegroundColor Green
    }

    $tunnelProcess = Start-Process -FilePath $cloudflaredPath `
        -ArgumentList 'tunnel', '--url', 'http://localhost:8000', '--no-autoupdate' `
        -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $cloudflaredOut -RedirectStandardError $cloudflaredError

    $apiUrl = $null
    foreach ($attempt in 1..60) {
        Start-Sleep -Milliseconds 500
        $logs = @()
        if (Test-Path -LiteralPath $cloudflaredOut) { $logs += Get-Content -LiteralPath $cloudflaredOut -Raw }
        if (Test-Path -LiteralPath $cloudflaredError) { $logs += Get-Content -LiteralPath $cloudflaredError -Raw }
        $match = [regex]::Match(($logs -join "`n"), 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($match.Success) { $apiUrl = $match.Value; break }
        if ($tunnelProcess.HasExited) { break }
    }
    if (-not $apiUrl) { throw 'Cloudflare no entregó una URL pública para FastAPI.' }

    Set-Content -LiteralPath $frontendEnvPath -Value "EXPO_PUBLIC_API_URL=$apiUrl" -Encoding utf8
    $publicReady = $false
    foreach ($attempt in 1..30) {
        try {
            $publicHealth = Invoke-RestMethod -Uri "$apiUrl/health/ready" -TimeoutSec 5
            if ($publicHealth.status -eq 'ready') {
                $publicReady = $true
                break
            }
        } catch {}
        if ($tunnelProcess.HasExited) { break }
        Start-Sleep -Seconds 1
    }
    if (-not $publicReady) { throw 'El túnel público no alcanza FastAPI después de 30 segundos.' }

    Write-Host "API pública lista: $apiUrl" -ForegroundColor Green
    $expoClientName = if ($ExpoClient -eq 'dev-client') { 'Coffee Fly Development Client' } else { 'Expo Go' }
    $expoClientFlag = "--$ExpoClient"
    Write-Host "Iniciando $expoClientName. Escanea el QR; Ctrl+C cierra los procesos creados por este script." -ForegroundColor Cyan
    Push-Location $frontendPath
    try {
        & npx.cmd expo start --tunnel $expoClientFlag --clear
        if ($LASTEXITCODE -ne 0) {
            Write-Warning 'El tunel de Expo/Ngrok fallo. Reintentando por la red Wi-Fi local...'
            & npx.cmd expo start --lan $expoClientFlag --clear
            if ($LASTEXITCODE -ne 0) {
                throw 'Expo no pudo iniciar por tunel ni por la red local.'
            }
        }
    } finally {
        Pop-Location
    }
} finally {
    if ($tunnelProcess -and -not $tunnelProcess.HasExited) {
        Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($startedBackend -and $backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
