param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$BackupFile,

    [switch]$RunRestoreTest
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

$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$stream = [IO.File]::OpenRead($resolvedBackup)
try {
    $magic = New-Object byte[] 5
    if ($stream.Read($magic, 0, 5) -ne 5 -or [Text.Encoding]::ASCII.GetString($magic) -ne 'PGDMP') {
        throw 'The file is not a PostgreSQL custom-format dump (PGDMP).'
    }
} finally { $stream.Dispose() }

$sidecar = "$resolvedBackup.sha256.txt"
if (Test-Path -LiteralPath $sidecar) {
    $expected = (Select-String -LiteralPath $sidecar -Pattern '^sha256=([A-Fa-f0-9]{64})$').Matches.Groups[1].Value
    if (-not $expected) { throw 'The checksum manifest does not contain a valid SHA-256 value.' }
    $actual = (Get-FileHash -LiteralPath $resolvedBackup -Algorithm SHA256).Hash
    if ($actual -ne $expected) { throw 'SHA-256 mismatch: the backup file may be incomplete or altered.' }
    Write-Output 'SHA-256: valid'
} else {
    Write-Warning 'No SHA-256 sidecar found; structural verification will continue.'
}

$containerId = ((Invoke-Docker -Arguments @('compose', 'ps', '-q', 'db')) -join '').Trim()
if (-not $containerId) { throw 'No running Compose database service was found.' }
$containerPath = '/tmp/coffee-fly-verify-' + [Guid]::NewGuid().ToString('N') + '.dump'
$dbUser = ((Invoke-Docker -Arguments @('compose', 'exec', '-T', 'db', 'sh', '-c', 'printf %s "$POSTGRES_USER"')) -join '').Trim()
if (-not $dbUser) { throw 'Could not read POSTGRES_USER from the running container.' }

$tempDatabase = $null
try {
    Invoke-Docker -Arguments @('cp', $resolvedBackup, "${containerId}:$containerPath") | Out-Null
    # Listing the archive directory detects truncation and malformed dump files without restoring data.
    Invoke-Docker -Arguments @('compose', 'exec', '-T', 'db', 'pg_restore', '--list', $containerPath) | Out-Null
    Write-Output 'Archive structure: valid'

    if ($RunRestoreTest) {
        $tempDatabase = 'coffee_fly_verify_' + (Get-Date -Format 'yyyyMMddHHmmss') + '_' + (Get-Random -Minimum 1000 -Maximum 9999)
        Invoke-Docker -Arguments @('compose', 'exec', '-T', 'db', 'createdb', '-U', $dbUser, $tempDatabase) | Out-Null
        Invoke-Docker -Arguments @('compose', 'exec', '-T', 'db', 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges', '-U', $dbUser, '-d', $tempDatabase, $containerPath) | Out-Null
        $query = "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        $tableCount = ((Invoke-Docker -Arguments @('compose', 'exec', '-T', 'db', 'psql', '-At', '-U', $dbUser, '-d', $tempDatabase, '-c', $query)) -join '').Trim()
        if ($tableCount -notmatch '^\d+$' -or [int]$tableCount -lt 1) { throw 'Restore completed but no public tables were found in the temporary database.' }
        Write-Output "Isolated restore: valid ($tableCount public tables restored to $tempDatabase)"
    }
} finally {
    if ($tempDatabase) {
        & docker compose exec -T db dropdb -U $dbUser --if-exists $tempDatabase 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Warning "Could not remove temporary verification database $tempDatabase." }
    }
    & docker compose exec -T db rm -f $containerPath 2>$null | Out-Null
}
