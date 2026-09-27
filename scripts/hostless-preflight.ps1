[CmdletBinding()]
param(
    [string]$TokenPath = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex\hostless-token.txt'),
    [string]$ProjectId
)

$ErrorActionPreference = 'Stop'
$mcpUrl = 'https://mcp.hostless.app/mcp'

function Read-HostlessToken {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "No existe el archivo de credencial: $Path"
    }

    $token = (Get-Content -LiteralPath $Path -Raw).Trim()
    if (-not $token.StartsWith('hlk_') -or $token.Length -lt 20) {
        throw 'La credencial no parece una API key de Hostless (prefijo esperado: hlk_).'
    }

    return $token
}
function Invoke-HostlessMcp {
    param(
        [Parameter(Mandatory)][string]$Token,
        [Parameter(Mandatory)][string]$Method,
        [hashtable]$Params = @{},
        [int]$Id = 1
    )

    $headers = @{
        Authorization = $Token
        Accept = 'application/json, text/event-stream'
        'Content-Type' = 'application/json'
    }
    $payload = @{
        jsonrpc = '2.0'
        id = $Id
        method = $Method
        params = $Params
    } | ConvertTo-Json -Depth 20 -Compress

    $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $mcpUrl -Headers $headers -Body $payload
    $dataLine = $response.Content -split "`r?`n" |
        Where-Object { $_ -like 'data: *' } |
        Select-Object -Last 1
    if (-not $dataLine) {
        throw 'Hostless MCP no devolvio un evento JSON utilizable.'
    }

    $message = ($dataLine -replace '^data:\s*', '') | ConvertFrom-Json
    if ($message.error) {
        throw "Hostless MCP: $($message.error.message)"
    }
    return $message.result
}

function Invoke-HostlessTool {
    param(
        [Parameter(Mandatory)][string]$Token,
        [Parameter(Mandatory)][string]$Name,
        [hashtable]$Arguments = @{},
        [int]$Id = 10
    )

    $result = Invoke-HostlessMcp -Token $Token -Method 'tools/call' -Params @{
        name = $Name
        arguments = $Arguments
    } -Id $Id

    if ($result.isError) {
        $details = ($result.content | Where-Object type -eq 'text' | Select-Object -ExpandProperty text) -join "`n"
        throw "La operacion $Name fallo: $details"
    }

    $text = ($result.content | Where-Object type -eq 'text' | Select-Object -ExpandProperty text) -join "`n"
    if (-not $text) { return $result }
    try { return $text | ConvertFrom-Json } catch { return $text }
}

$token = Read-HostlessToken -Path $TokenPath
$null = Invoke-HostlessMcp -Token $token -Method 'initialize' -Params @{
    protocolVersion = '2025-06-18'
    capabilities = @{}
    clientInfo = @{ name = 'coffee-fly-deployer'; version = '1.0' }
}

$toolResult = Invoke-HostlessMcp -Token $token -Method 'tools/list' -Id 2
$toolNames = @($toolResult.tools | Select-Object -ExpandProperty name)
$requiredTools = @('projects_list', 'apps_list', 'databases_list')
$missingTools = @($requiredTools | Where-Object { $_ -notin $toolNames })
if ($missingTools.Count -gt 0) {
    throw "La API MCP no expuso las herramientas requeridas: $($missingTools -join ', ')"
}

$projects = Invoke-HostlessTool -Token $token -Name 'projects_list' -Id 11
Write-Host 'Conexion con Hostless verificada. La clave nunca se imprimio.' -ForegroundColor Green
Write-Host 'Proyectos visibles:' -ForegroundColor Cyan
$projects | ConvertTo-Json -Depth 12

if ($ProjectId) {
    Write-Host "Apps del proyecto $ProjectId`:" -ForegroundColor Cyan
    Invoke-HostlessTool -Token $token -Name 'apps_list' -Arguments @{ projectId = $ProjectId } -Id 12 |
        ConvertTo-Json -Depth 12
    Write-Host "Bases de datos del proyecto $ProjectId`:" -ForegroundColor Cyan
    Invoke-HostlessTool -Token $token -Name 'databases_list' -Arguments @{ projectId = $ProjectId } -Id 13 |
        ConvertTo-Json -Depth 12
}
