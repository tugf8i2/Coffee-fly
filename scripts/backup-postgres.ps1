param(
    [string]$OutputDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'outputs\backups')
)

$ErrorActionPreference = 'Stop'

function Invoke-Docker {
    param([string[]]$Arguments)
    $result = & docker @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed ($LASTEXITCODE): docker $($Arguments -join ' ')`n$($result -join "`n")"
    }
    return $result
}

$containerId = ((Invoke-Docker -Arguments @('compose', 'ps', '-q', 'db')) -join '').Trim()
if (-not $containerId) {
    throw 'No running Compose database service was found. Start the local database with docker compose up -d db.'
}

$database = ((Invoke-Docker -Arguments @('compose', 'exec', '-T', 'db', 'sh', '-c', 'printf %s "$POSTGRES_DB"')) -join '').Trim()
$dbUser = ((Invoke-Docker -Arguments @('compose', 'exec', '-T', 'db', 'sh', '-c', 'printf %s "$POSTGRES_USER"')) -join '').Trim()
if (-not $database -or -not $dbUser) { throw 'Could not read the database name and role from the running container.' }

$safeDatabase = $database -replace '[^A-Za-z0-9_-]', '_'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$fileName = "coffee-fly-$safeDatabase-$stamp.dump"
$containerPath = "/tmp/$fileName"
$resolvedDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedDirectory -Force | Out-Null
$partialPath = Join-Path $resolvedDirectory "$fileName.partial"
$finalPath = Join-Path $resolvedDirectory $fileName

try {
    $dumpCommand = "pg_dump -Fc -U `"$dbUser`" -d `"$database`" -f $containerPath"
    Invoke-Docker -Arguments @('compose', 'exec', '-T', 'db', 'sh', '-c', $dumpCommand) | Out-Null
    Invoke-Docker -Arguments @('cp', "${containerId}:$containerPath", $partialPath) | Out-Null

    $stream = [IO.File]::OpenRead($partialPath)
    try {
        $magic = New-Object byte[] 5
        if ($stream.Read($magic, 0, 5) -ne 5 -or [Text.Encoding]::ASCII.GetString($magic) -ne 'PGDMP') {
            throw 'The generated file does not have the PostgreSQL custom-dump signature (PGDMP).'
        }
    } finally { $stream.Dispose() }

    Move-Item -LiteralPath $partialPath -Destination $finalPath
    $hash = (Get-FileHash -LiteralPath $finalPath -Algorithm SHA256).Hash
    $manifest = @(
        "created_utc=$([DateTime]::UtcNow.ToString('o'))"
        "database=$database"
        'format=postgresql-custom'
        "file=$fileName"
        "sha256=$hash"
    ) -join "`n"
    [IO.File]::WriteAllText("$finalPath.sha256.txt", $manifest + "`n", [Text.UTF8Encoding]::new($false))
    Write-Output "Backup created: $finalPath"
    Write-Output "SHA256: $hash"
} finally {
    if (Test-Path -LiteralPath $partialPath) { Remove-Item -LiteralPath $partialPath -Force }
    & docker compose exec -T db rm -f $containerPath 2>$null | Out-Null
}
