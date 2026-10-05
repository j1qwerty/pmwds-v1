<#
.SYNOPSIS
    Builds and deploys PMWDS to the Contabo VPS.

.DESCRIPTION
    Interactive deploy. Choose to ship the API, the web client, or both.
    Packages with tar (never Compress-Archive - see PRODUCTION.md 2.1), uploads
    over scp, extracts on the server, fixes ownership, restarts the service and
    verifies the result against both public hosts.

.PARAMETER Target
    api | web | both. Prompted for when omitted.

.PARAMETER Variant
    sqlite | mssql. Prompted for when omitted, defaulting to whichever one the current
    branch owns. The two variants are separate deployments on separate branches and must
    never be pointed at each other's paths, service or database.

.PARAMETER SkipConfirm
    Deploy without the interactive y/N confirmation.

.PARAMETER SkipVerify
    Deploy without the post-deploy verification pass.

.PARAMETER Host_
    SSH host alias. Defaults to "contabo".

.EXAMPLE
    .\deploy.ps1
    .\deploy.ps1 -Target both
    .\deploy.ps1 -Variant mssql -Target both
    .\deploy.ps1 -Variant sqlite -Target web -SkipConfirm
#>
[CmdletBinding()]
param(
    [ValidateSet('api', 'web', 'both')]
    [string] $Target,

    [ValidateSet('sqlite', 'mssql')]
    [string] $Variant,

    [switch] $SkipConfirm,
    [switch] $SkipVerify,
    [string] $Host_ = 'contabo'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ── Paths ───────────────────────────────────────────────────────────────
$RepoRoot    = $PSScriptRoot
$PublishDir  = Join-Path $RepoRoot 'pmwds-pub'
$DistDir     = Join-Path $RepoRoot 'Client\dist'
$ApiArchive  = Join-Path $RepoRoot 'pmwds-api.tar.gz'
$WebArchive  = Join-Path $RepoRoot 'pmwds-web.tar.gz'

$WebUser     = 'www-data'

# ── Variant resolution ──────────────────────────────────────────────────
# Two independent deployments live on the same VPS. They must never share a service, a
# directory, a database or a port, because deploying one must not be able to disturb the
# other.
#
#   sqlite  branch prod-sqlite  -> bare IP, HTTP only (a bare IP cannot get a TLS cert,
#                                  so the login password and JWT travel in clear text)
#   mssql   branch prod-mssql   -> the subdomain over HTTPS, which is the only host where
#                                  sending credentials in clear text is acceptable
#
# The bare IP is therefore the SQLite variant and the subdomain is the MSSQL variant, which
# is the opposite of the previous single-app layout and is what PRODUCTION.md now documents.
$VariantTable = @{
    sqlite = @{
        Label       = 'sqlite (bare IP)'
        RemoteApp   = '/var/www/pmwds-sqlite/app'
        RemoteWeb   = '/var/www/pmwds-sqlite/html'
        ServiceName = 'pmwds-sqlite'
        EnvFile     = '/etc/pmwds/pmwds-sqlite.env'
        DataDir     = '/var/lib/pmwds-sqlite'
        ApiPort     = 5001
        PublicHost  = 'http://147.93.155.185'
        HostLabel   = 'IP       '
        Branch      = 'prod-sqlite'
        Tls         = $false
    }
    mssql = @{
        Label       = 'mssql (subdomain, HTTPS)'
        RemoteApp   = '/var/www/pmwds-mssql/app'
        RemoteWeb   = '/var/www/pmwds-mssql/html'
        ServiceName = 'pmwds-mssql'
        EnvFile     = '/etc/pmwds/pmwds-mssql.env'
        DataDir     = '/var/lib/pmwds-mssql'
        ApiPort     = 5002
        PublicHost  = 'https://pmwds.dharmaatribe.app'
        HostLabel   = 'subdomain'
        Branch      = 'prod-mssql'
        Tls         = $true
    }
}

# ── Output helpers ──────────────────────────────────────────────────────

# ── Output helpers ──────────────────────────────────────────────────────
$script:StepNo = 0
$script:Start  = Get-Date

function Write-Banner {
    Write-Host ''
    Write-Host '  PMWDS deploy' -ForegroundColor Cyan
    Write-Host '  ------------' -ForegroundColor DarkCyan
}

function Write-Step {
    param([string] $Text)
    $script:StepNo++
    $elapsed = ((Get-Date) - $script:Start).TotalSeconds
    $stamp = '{0,6:N1}s' -f $elapsed
    Write-Host ''
    Write-Host ("  [{0,2}] " -f $script:StepNo) -ForegroundColor DarkGray -NoNewline
    Write-Host $Text -ForegroundColor Cyan -NoNewline
    Write-Host "  ($stamp)" -ForegroundColor DarkGray
}

function Write-Running {
    param([string]$m)
    $elapsed = ((Get-Date) - $script:Start).TotalSeconds
    $stamp = '{0,6:N1}s' -f $elapsed
    Write-Host "       RUN  $m  ($stamp)" -ForegroundColor Yellow
}
function Write-Ok    { param([string]$m = 'done') Write-Host "       OK   $m" -ForegroundColor Green }
function Write-Warn2 { param([string]$m)        Write-Host "  WARN  $m" -ForegroundColor Yellow }
function Write-Err   { param([string]$m)        Write-Host "  FAIL  $m" -ForegroundColor Red }
function Write-Info  { param([string]$m)        Write-Host "       INFO $m" -ForegroundColor Gray }
function Write-Detail{ param([string]$m)        Write-Host "       $m" -ForegroundColor DarkGray }

function Fail {
    param([string] $Message, [int] $Code = 1)
    Write-Err $Message
    exit $Code
}

# Runs a command, streams output while it is running, and throws with its output on failure.
function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string]   $FilePath,
        [Parameter(Mandatory)] [string[]] $Arguments,
        [string] $What = 'command',
        [string[]] $OnSuccessPatterns = @(),
        [string] $WorkingDirectory,
        [switch] $StreamOutput,
        [string] $OutputLabel = 'output'
    )

    # Native tools routinely write progress and warnings to stderr (pnpm/vite do, for
    # the chunk-size notice). With $ErrorActionPreference = 'Stop' those become
    # terminating errors and kill an otherwise successful build, so relax it here and
    # rely on the real exit code instead.
    $lines = [System.Collections.Generic.List[string]]::new()
    $code = 0
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
        $run = {
            & $FilePath @Arguments 2>&1 | ForEach-Object {
                $line = $_.ToString()
                [void]$lines.Add($line)

                if ($StreamOutput -and $line.Trim()) {
                    Write-Host "       $OutputLabel $line" -ForegroundColor DarkGray
                }
            }
            $script:__InvokeCheckedExitCode = $LASTEXITCODE
        }

        if ($WorkingDirectory) {
            Push-Location $WorkingDirectory
            try {
                & $run
            } finally {
                Pop-Location
            }
        } else {
            & $run
        }

        $code = $script:__InvokeCheckedExitCode
    } finally {
        $ErrorActionPreference = $previousEap
    }

    $text = ($lines | Out-String).Trim()

    if ($code -ne 0) {
        if ($text) {
            Write-Host $text -ForegroundColor DarkRed
        }
        Fail "$What failed (exit $code)"
    }

    if ($OnSuccessPatterns.Count) {
        foreach ($p in $OnSuccessPatterns) {
            if ($text -notmatch $p) {
                if ($text) {
                    Write-Host $text -ForegroundColor DarkRed
                }
                Fail "$What did not produce expected output: $p"
            }
        }
    }

    return $text
}

function Test-CommandExists { param([string]$Name) return [bool](Get-Command $Name -ErrorAction SilentlyContinue) }

# ── Preflight ───────────────────────────────────────────────────────────
Write-Banner
Write-Step 'Preflight'
Write-Running 'checking local tools, repository state, and SSH connectivity'

foreach ($cmd in @('git', 'dotnet', 'node', 'pnpm', 'tar', 'ssh', 'scp')) {
    if (-not (Test-CommandExists $cmd)) { Fail "Required tool not on PATH: $cmd" }
}
Write-Ok 'git, dotnet, node, pnpm, tar, ssh, scp all present'

if (-not (Test-Path (Join-Path $RepoRoot 'PMWDS.slnx'))) { Fail "Run this from the repo root (PMWDS.slnx not found in $RepoRoot)" }

$branch = (Invoke-Checked git @('rev-parse','--abbrev-ref','HEAD') -What 'git branch').Trim()
$head   = (Invoke-Checked git @('rev-parse','--short','HEAD')            -What 'git rev-parse').Trim()
$dirty  = (Invoke-Checked git @('status','--porcelain')                  -What 'git status').Trim()
Write-Info "branch $branch @ $head"
if ($dirty) {
    Write-Warn2 'working tree has uncommitted changes (they WILL be deployed)'
    ($dirty -split "`n" | Select-Object -First 8) | ForEach-Object { Write-Detail "  $($_)" }
} else {
    Write-Info 'working tree clean'
}

Invoke-Checked ssh @('-o','BatchMode=yes','-o','ConnectTimeout=10',$Host_,'echo ok') `
             -What "ssh $Host_" -OnSuccessPatterns @('ok') | Out-Null
Write-Ok "ssh $Host_ reachable"

# ── Choose variant and target ───────────────────────────────────────────
Write-Step 'Select variant and target'
Write-Running 'selecting which deployment, and whether to ship the API, the client, or both'

# Which deployment does this branch own? Each branch is one variant's source of truth, so
# defaulting to it means the common case needs no argument at all. An explicit -Variant on
# the "wrong" branch is allowed but loudly flagged, because that is how the wrong
# deployment gets overwritten.
$branchVariant = if ($branch -like 'prod-sqlite*') { 'sqlite' } else { 'mssql' }

if (-not $Variant) {
    Write-Host ''
    Write-Host '       Which deployment?' -ForegroundColor White
    Write-Host "         [1] sqlite - bare IP  http://147.93.155.185            (branch $branch owns this)" -ForegroundColor Gray
    Write-Host "         [2] mssql  - subdomain https://pmwds.dharmaatribe.app" -ForegroundColor Gray
    Write-Host ''
    $vchoice = Read-Host "       Choice [$branchVariant]"
    switch ($vchoice.Trim()) {
        '1'        { $Variant = 'sqlite' }
        '2'        { $Variant = 'mssql'  }
        ''         { $Variant = $branchVariant }
        default    { Fail "unrecognised choice '$vchoice'" }
    }
}

$V = $VariantTable[$Variant]

if ($branch -ne $V.Branch) {
    Write-Warn2 "branch '$branch' does not own the '$Variant' variant (expected '$($V.Branch)')"
    Write-Detail '  you are deploying to the OTHER deployment. This is only correct if you'
    Write-Detail "  intend to update $Variant from this checkout. Nothing is inferred from the branch."
}

$RemoteApp   = $V.RemoteApp
$RemoteWeb   = $V.RemoteWeb
$ServiceName = $V.ServiceName
$DataDir     = $V.DataDir

$PublicHosts = @(
    @{ Label = $V.HostLabel; Url = $V.PublicHost; Insecure = $false }
)

if (-not $Target) {
    Write-Host ''
    Write-Host '       What should be deployed?' -ForegroundColor White
    Write-Host '         [1] both  - API + web client' -ForegroundColor Gray
    Write-Host '         [2] api   - API only (leaves the current client build in place)' -ForegroundColor Gray
    Write-Host '         [3] web   - web client only (no service restart)' -ForegroundColor Gray
    Write-Host ''
    $choice = Read-Host '       Choice [1]'
    switch ($choice.Trim()) {
        '2'     { $Target = 'api'  }
        '3'     { $Target = 'web'  }
        default { $Target = 'both' }
    }
}

$doApi = $Target -in @('api', 'both')
$doWeb = $Target -in @('web', 'both')
Write-Info "variant: $Variant  ->  $($V.Label)"
Write-Info "target:  $Target"

# ── Build ───────────────────────────────────────────────────────────────
$apiAssets = @()
$webAssets = @()

if ($doApi) {
    Write-Step 'Build API (dotnet publish -c Release)'
    Write-Running 'dotnet publish is running. Build output will appear live below.'
    if (Test-Path $PublishDir) { Remove-Item -Recurse -Force $PublishDir }
    Invoke-Checked dotnet @('publish','PMWDS.API','-c','Release','-o',$PublishDir) `
        -What 'dotnet publish' -OnSuccessPatterns @('PMWDS.API ->') `
        -StreamOutput -OutputLabel 'build' | Out-Null
    if (-not (Test-Path (Join-Path $PublishDir 'PMWDS.API.dll'))) { Fail 'PMWDS.API.dll missing from publish output' }
    $apiAssets = @(Get-ChildItem $PublishDir -File -Recurse)
    Write-Ok ("{0} files, {1:N1} MB" -f $apiAssets.Count, (($apiAssets | Measure-Object Length -Sum).Sum / 1MB))
}

if ($doWeb) {
    Write-Step 'Build web client (pnpm build)'
    Write-Running 'pnpm build is running. Vite output will appear live below.'

    # Relative base so ONE bundle serves both the subdomain and the bare IP.
    $prevBase = $env:VITE_API_BASE_URL
    $env:VITE_API_BASE_URL = '/api/v1'
    try {
        Invoke-Checked pnpm @('build') -What 'pnpm build' `
            -WorkingDirectory (Join-Path $RepoRoot 'Client') `
            -OnSuccessPatterns @('built in') `
            -StreamOutput -OutputLabel 'build' | Out-Null
    } finally {
        $env:VITE_API_BASE_URL = $prevBase
    }

    $indexPath = Join-Path $DistDir 'index.html'
    if (-not (Test-Path $indexPath)) { Fail 'dist/index.html missing - build did not produce output' }

    # Read the real hashed filenames out of index.html. Never assume them.
    $html = Get-Content $indexPath -Raw
    $webAssets = @([regex]::Matches($html, '/assets/[^"'']+') | ForEach-Object { $_.Value } | Sort-Object -Unique)
    if (-not $webAssets.Count) { Fail 'could not find any /assets/ references in dist/index.html' }

    Write-Ok ("{0} asset(s) referenced:" -f $webAssets.Count)
    $webAssets | ForEach-Object { Write-Detail "  $_" }
}

# ── Package ─────────────────────────────────────────────────────────────
# tar, NOT Compress-Archive. Compress-Archive writes backslash path separators;
# Linux treats those as literal filename characters, producing files named
# "assets\index-HASH.js" instead of an assets directory. nginx then 404s every
# asset while `find` still appears to list them, and the site serves a blank page.
$uploads = @()

if ($doApi) {
    Write-Step 'Package API (tar)'
    Write-Running "creating $([IO.Path]::GetFileName($ApiArchive))"
    if (Test-Path $ApiArchive) { Remove-Item $ApiArchive -Force }
    Invoke-Checked tar @('-czf', $ApiArchive, '-C', $PublishDir, '.') -What 'tar api' | Out-Null
    $sz = (Get-Item $ApiArchive).Length / 1MB
    Write-Ok ("{0:N1} MB" -f $sz)
    $uploads += @{ Local = $ApiArchive; Remote = '/tmp/pmwds-api.tar.gz' }
}

if ($doWeb) {
    Write-Step 'Package web (tar)'
    Write-Running "creating $([IO.Path]::GetFileName($WebArchive))"
    if (Test-Path $WebArchive) { Remove-Item $WebArchive -Force }
    Invoke-Checked tar @('-czf', $WebArchive, '-C', $DistDir, '.') -What 'tar web' | Out-Null

    $entries = (Invoke-Checked tar @('-tzf', $WebArchive) -What 'tar list web') -split "`r?`n" | Where-Object { $_ }
    $bad = @($entries | Where-Object { $_ -match '\\' })
    if ($bad.Count) {
        $bad | ForEach-Object { Write-Host "       $_" -ForegroundColor DarkRed }
        Fail 'archive contains backslash path separators - this is the Compress-Archive bug, refusing to deploy'
    }
    Write-Ok ("{0:N2} MB, {1} entries, no backslashes" -f ((Get-Item $WebArchive).Length / 1MB), $entries.Count)
    $uploads += @{ Local = $WebArchive; Remote = '/tmp/pmwds-web.tar.gz' }
}

# ── Confirm ─────────────────────────────────────────────────────────────
Write-Step 'Confirm'
Write-Running 'waiting for deployment confirmation'

Write-Host ''
Write-Host '       About to deploy to:' -ForegroundColor White
Write-Host "         variant    $($V.Label)" -ForegroundColor Gray
Write-Host "         target     $Target" -ForegroundColor Gray
Write-Host "         host       $Host_   ->  $($V.PublicHost)" -ForegroundColor Gray
Write-Host "         service    $ServiceName   (port $($V.ApiPort))" -ForegroundColor Gray
Write-Host "         api dir    $RemoteApp" -ForegroundColor Gray
Write-Host "         web dir    $RemoteWeb" -ForegroundColor Gray
Write-Host "         data dir   $DataDir  (never touched by this script)" -ForegroundColor Gray
if (-not $V.Tls) {
    Write-Host ''
    Write-Host '         NOTE: this variant is served over plain HTTP on a bare IP.' -ForegroundColor Yellow
    Write-Host '               Login passwords and JWTs travel in clear text.' -ForegroundColor Yellow
}
if ($doApi) { Write-Host '         restart    yes' -ForegroundColor Gray }
Write-Host ''

if (-not $SkipConfirm) {
    $answer = Read-Host '       Proceed? [y/N]'
    if ($answer.Trim() -notmatch '^(y|yes)$') {
        Write-Warn2 'aborted by user'
        exit 0
    }
}
Write-Ok 'confirmed'

# ── Upload ──────────────────────────────────────────────────────────────
$script:Start = Get-Date
Write-Step 'Upload (scp)'

$totalUploadBytes = ($uploads | ForEach-Object {
    (Get-Item $_.Local).Length
} | Measure-Object -Sum).Sum
$totalUploadMb = $totalUploadBytes / 1MB
Write-Running ("{0} archive(s), {1:N1} MB total. Native scp transfer progress will stay visible below." -f `
    $uploads.Count, $totalUploadMb)

$uploadIndex = 0
foreach ($u in $uploads) {
    $uploadIndex++
    $fileName = Split-Path $u.Local -Leaf
    $fileSize = (Get-Item $u.Local).Length
    $fileMb = $fileSize / 1MB

    Write-Info ("upload {0}/{1}: {2} ({3:N1} MB) -> {4}:{5}" -f `
        $uploadIndex, $uploads.Count, $fileName, $fileMb, $Host_, $u.Remote)
    Write-Running "scp is transferring $fileName. The native scp percentage, speed, and ETA are shown live."

    $scpArgs = @(`
        '-o','BatchMode=yes',
        '-o','ConnectTimeout=10',
        $u.Local,
        "${Host_}:$($u.Remote)"
    )

    & scp @scpArgs
    $scpCode = $LASTEXITCODE
    if ($scpCode -ne 0) {
        Fail "scp $fileName failed (exit $scpCode)"
    }

    Write-Ok "$fileName -> $($u.Remote)"
}

# ── Remote deploy ───────────────────────────────────────────────────────
$script:Start = Get-Date
Write-Step 'Deploy on server'
Write-Running 'remote extraction, permissions, and service restart are running. Server output will appear live below.'

# Written to a script file rather than inlined: $ and quoting behave differently
# when a command crosses the Windows -> ssh boundary. The variant's paths and service name
# are passed as arguments rather than baked in, so one script body serves both deployments.
$remoteScript = @'
set -e
APP="$1"
WEB="$2"
SERVICE="$3"
DATA="$4"
TARGET="$5"

if [ -f /tmp/pmwds-api.tar.gz ]; then
  echo "extracting api -> $APP"
  mkdir -p "$APP" "$DATA"
  rm -rf /tmp/dep-api && mkdir -p /tmp/dep-api
  tar -xzf /tmp/pmwds-api.tar.gz -C /tmp/dep-api
  # Clear the previous build but keep the directory itself, so a bind mount or an open
  # handle on it cannot turn the restart into a "no such file" failure.
  find "$APP" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a /tmp/dep-api/. "$APP"/
  chown -R www-data:www-data "$APP" "$DATA"
  chmod -R 755 "$APP"
  rm -rf /tmp/dep-api
  echo "api: $(ls "$APP" | wc -l) entries"
fi

if [ -f /tmp/pmwds-web.tar.gz ]; then
  echo "extracting web -> $WEB"
  rm -rf /tmp/dep-web && mkdir -p /tmp/dep-web
  tar -xzf /tmp/pmwds-web.tar.gz -C /tmp/dep-web
  rm -rf "$WEB"
  mkdir -p "$WEB"
  cp -a /tmp/dep-web/. "$WEB"/
  chown -R www-data:www-data "$WEB"
  chmod -R 755 "$WEB"
  rm -rf /tmp/dep-web
  echo "web: $(ls "$WEB" | wc -l) entries"
fi

rm -f /tmp/pmwds-api.tar.gz /tmp/pmwds-web.tar.gz

if [ "$TARGET" = "api" ] || [ "$TARGET" = "both" ]; then
  echo "restarting $SERVICE"
  systemctl restart "$SERVICE"
  echo "service startup: waiting up to 50s for active state"
  for i in 1 2 3 4 5 6 7 8 9 10; do
    status=$(systemctl is-active "$SERVICE" 2>/dev/null || true)
    echo "service startup check $i/10: $status"
    if [ "$status" = "active" ]; then
      break
    fi
    sleep 5
  done
  echo "service: $(systemctl is-active "$SERVICE" 2>/dev/null || true)"
fi
'@

$tmpScript = Join-Path ([System.IO.Path]::GetTempPath()) ("pmwds-deploy-" + [guid]::NewGuid().ToString('N') + '.sh')
[System.IO.File]::WriteAllText($tmpScript, ($remoteScript -replace "`r`n", "`n"))
try {
    scp -o BatchMode=yes -o ConnectTimeout=10 $tmpScript "${Host_}:/tmp/pmwds-deploy.sh" | Out-Null

    $remoteArgs = "bash /tmp/pmwds-deploy.sh '$RemoteApp' '$RemoteWeb' '$ServiceName' '$DataDir' '$Target'"
    $out = Invoke-Checked ssh @('-o','BatchMode=yes', $Host_, $remoteArgs) `
        -What 'remote deploy' -StreamOutput -OutputLabel 'server'

    $out | Select-String -Pattern 'service: active' | Out-Null
    if (-not $?) { Fail "$ServiceName did not report active after restart" }
    Write-Ok 'remote deploy complete'
} finally {
    Remove-Item $tmpScript -Force -ErrorAction SilentlyContinue
    ssh -o BatchMode=yes $Host_ 'rm -f /tmp/pmwds-deploy.sh' 2>&1 | Out-Null
}

# ── Verify ──────────────────────────────────────────────────────────────
if ($SkipVerify) {
    Write-Step 'Verify'
    Write-Running 'verification was skipped by -SkipVerify'
    Write-Warn2 'skipped by -SkipVerify'
    Write-Banner; Write-Host '  Deploy finished (unverified).' -ForegroundColor Green; Write-Host ''
    exit 0
}

$script:Start = Get-Date
Write-Step 'Verify'
Write-Running 'post-deploy checks are running. Each result will appear as it completes.'

# Every referenced asset must return 200 with a real body size. GET / returning
# 200 proves nothing: index.html is static and served by try_files, so it succeeds
# even when every asset it references is missing. That is the blank-page failure.
$script:remoteCurl = @'
set -e
for url in "$@"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url")
  size=$(curl -s -o /dev/null -w '%{size_download}' "$url")
  echo "$code $size $url"
done
'@
$tmpCurl = Join-Path ([System.IO.Path]::GetTempPath()) ("pmwds-curl-" + [guid]::NewGuid().ToString('N') + '.sh')
[System.IO.File]::WriteAllText($tmpCurl, ($script:remoteCurl -replace "`r`n", "`n"))

$allOk = $true
try {
    scp -o BatchMode=yes $tmpCurl "${Host_}:/tmp/pmwds-curl.sh" | Out-Null

    if ($doWeb) {
        Write-Running 'checking every referenced web asset on both public hosts. Results will appear live below.'
        $urls = @()
        $labels = @{}
        foreach ($h in $PublicHosts) {
            foreach ($a in $webAssets) {
                $urls += ($h.Url + $a)
                $labels[($h.Url + $a)] = $h.Label
            }
        }
        $out = Invoke-Checked ssh @('-o','BatchMode=yes', $Host_, "bash /tmp/pmwds-curl.sh " + ($urls -join ' ')) `
            -What 'asset check' -StreamOutput -OutputLabel 'check'
        $lines = ($out -split "`r?`n") | Where-Object { $_ -match '^\d{3} \d+' }

        Write-Info 'assets referenced by dist/index.html, on every public host:'
        foreach ($line in $lines) {
            $p = $line -split ' ', 3
            $code = [int]$p[0]; $size = [long]$p[1]; $url = $p[2]
            $name = ($url -split '/')[-1]
            $label = if ($labels.ContainsKey($url)) { $labels[$url] } else { '' }
            if ($code -eq 200 -and $size -gt 1000) {
                Write-Ok ("{0} {1,-26} {2,10:N0} B" -f $label, $name, $size)
            } else {
                Write-Err ("{0} {1,-26} HTTP {2} ({3} B) - BLANK PAGE RISK" -f $label, $name, $code, $size)
                $allOk = $false
            }
        }
    }

    # Deep link proves the SPA fallback works on this variant's host.
    Write-Running 'checking SPA deep link /projects'
    $deepUrl = $V.PublicHost + '/projects'
    $out = Invoke-Checked ssh @('-o','BatchMode=yes', $Host_, "bash /tmp/pmwds-curl.sh $deepUrl") `
        -What 'deep link' -StreamOutput -OutputLabel 'check'
    $deep = ($out -split "`r?`n") | Where-Object { $_ -match '^\d{3} \d+' } | Select-Object -First 1
    if ($deep -match '^200 ') { Write-Ok "SPA deep link $deepUrl -> 200" }
    else { Write-Err "SPA deep link failed: $deep"; $allOk = $false }

    # The other variant shares this box. A deploy must not be able to take it down without
    # that being noticed, so assert it is still serving after we are done.
    $otherKey = if ($Variant -eq 'sqlite') { 'mssql' } else { 'sqlite' }
    $O = $VariantTable[$otherKey]
    if ($O.ServiceName) {
        Write-Running "checking the other variant ($otherKey) is untouched"
        $out = Invoke-Checked ssh @('-o','BatchMode=yes', $Host_,
            "systemctl is-active $($O.ServiceName) 2>/dev/null || echo not-installed") `
            -What 'other variant' -StreamOutput -OutputLabel 'check'
        $otherState = (($out -split "`r?`n") | Where-Object { $_ -match '\S' } | Select-Object -Last 1).Trim()
        if ($otherState -eq 'active') {
            Write-Ok "$($O.ServiceName) still active"
        } else {
            # Not installed is a legitimate state, especially on a fresh box. Only a
            # service that exists but is not active is a problem worth failing over.
            if ($otherState -eq 'not-installed') { Write-Warn2 "$($O.ServiceName) not installed yet" }
            else { Write-Err "$($O.ServiceName) is '$otherState'"; $allOk = $false }
        }
    }

    # The SignalR handshake must be checked explicitly. Every other check here can pass
    # while live updates are completely broken: GET / and the SPA deep link are served
    # from static files by try_files, so they return 200 regardless of whether /hubs/ is
    # proxied. The failure mode is silent - the client just quietly falls back to the
    # 60s poll - so it has to be asserted, not assumed.
    #
    # Checked for both web and api targets, because this is a web/nginx concern and a
    # web-only deploy is exactly when it would regress unnoticed.
    foreach ($h in $PublicHosts) {
        Write-Running "checking SignalR negotiate on $($h.Url)"
        $negotiateUrl = $h.Url + '/hubs/dashboard/negotiate?negotiateVersion=1'
        $out = Invoke-Checked ssh @('-o','BatchMode=yes', $Host_,
            "curl -s -X POST -o /tmp/pmwds-neg.json -w '%{http_code}' '$negotiateUrl'; echo; head -c 300 /tmp/pmwds-neg.json; rm -f /tmp/pmwds-neg.json") `
            -What 'negotiate check' -StreamOutput -OutputLabel 'check'

        $lines = ($out -split "`r?`n") | Where-Object { $_ -match '\S' }
        $code = ($lines | Select-Object -First 1).Trim()
        $body = ($lines | Select-Object -Skip 1) -join ' '

        # DashboardHub is [Authorize], so an unauthenticated negotiate is expected to be
        # rejected. What matters is WHICH component answered:
        #
        #   401                    the request reached the API and the hub refused it. Correct.
        #   200 + connectionToken  reached the API and negotiated. Correct.
        #   200 + HTML             nginx try_files served the SPA. /hubs/ is NOT proxied. Broken.
        #   404                    no hub route at all. Broken.
        #
        # Only the first two are healthy. Checking for 200 alone would pass the broken case,
        # and treating 401 as a failure would fail every healthy deploy - both mistakes were
        # made while writing this check.
        if ($code -eq '401') {
            Write-Ok "$($h.Label) negotiate -> 401 (hub requires auth) - /hubs/ is proxied"
        } elseif ($code -eq '200' -and $body -match '"connectionToken"' -and $body -match 'WebSockets') {
            Write-Ok "$($h.Label) negotiate -> 200, WebSockets advertised"
        } else {
            Write-Err "$($h.Label) negotiate -> HTTP $code (expected 401, or 200 with a connectionToken)"
            Write-Detail ("  body: " + $body.Trim())
            if ($code -eq '200') {
                Write-Detail '  200 with a non-negotiate body means nginx is serving the SPA'
                Write-Detail '  fallback for /hubs/. Add the location block from PRODUCTION.md 2b.'
            }
            $allOk = $false
        }
    }

    if ($doApi) {
        # grep -c exits 1 when the count is zero, which would fail the check even though
        # zero unhandled exceptions is the good outcome. Force the exit status to 0 and read
        # the printed count instead.
        Write-Running 'checking recent API journal for unhandled exceptions'
        $log = Invoke-Checked ssh @('-o','BatchMode=yes', $Host_,
            "journalctl -u $ServiceName --since '-3min' --no-pager | grep -c 'Unhandled exception'; exit 0") `
            -What 'log scan' -OnSuccessPatterns @('\d+') -StreamOutput -OutputLabel 'check'
        $logCount = ($log -split "`r?`n" | Where-Object { $_ -match '^\d+$' } | Select-Object -First 1)
        if ($logCount -eq '0') { Write-Ok 'no unhandled exceptions in the last 3 minutes' }
        else { Write-Err "$logCount unhandled exception(s) in journal"; $allOk = $false }

        # `systemctl is-active` returning active only means the process launched, not that
        # it is serving. On a cold start the app runs migrations first, which took 19s on
        # the MSSQL variant, so an immediate check reports a false failure. Poll instead.
        Write-Running 'waiting for the API to report "Now listening"'
        $listening = $false
        for ($i = 1; $i -le 12; $i++) {
            $probe = Invoke-Checked ssh @('-o','BatchMode=yes', $Host_,
                "journalctl -u $ServiceName --since '-10min' --no-pager | grep -c 'Now listening'; exit 0") `
                -What 'listen check' -OnSuccessPatterns @('\d+') 6>$null
            $n = ($probe -split "`r?`n" | Where-Object { $_ -match '^\d+$' } | Select-Object -First 1)
            if ($n -and [int]$n -ge 1) { $listening = $true; break }
            Write-Detail "  not listening yet ($i/12), waiting 5s"
            Start-Sleep -Seconds 5
        }
        if ($listening) {
            Write-Ok "API reports Now listening (expected http://127.0.0.1:$($V.ApiPort))"
            # Confirm it really is this variant's port and not a stale line from an earlier
            # boot of the same unit.
            $actual = Invoke-Checked ssh @('-o','BatchMode=yes', $Host_,
                "journalctl -u $ServiceName --since '-10min' --no-pager | grep 'Now listening' | tail -1") `
                -What 'port check' 6>$null
            if ($actual -match ":$($V.ApiPort)\b") {
                Write-Ok "listening on the expected port $($V.ApiPort)"
            } else {
                Write-Err "reported a port other than $($V.ApiPort): $($actual.Trim())"
                $allOk = $false
            }
        } else {
            Write-Err 'API did not report listening within 60s'
            $allOk = $false
        }
    }
} finally {
    Remove-Item $tmpCurl -Force -ErrorAction SilentlyContinue
    ssh -o BatchMode=yes $Host_ 'rm -f /tmp/pmwds-curl.sh' 2>&1 | Out-Null
}

Write-Banner
if ($allOk) {
    Write-Host '  Deploy succeeded.' -ForegroundColor Green
    Write-Host ''
    Write-Host "   Variant   $Variant  ($($V.Label))" -ForegroundColor Gray
    Write-Host "   Host      $($V.PublicHost)" -ForegroundColor Gray
    Write-Host "   Service   $ServiceName" -ForegroundColor Gray
    Write-Host "   API       $RemoteApp" -ForegroundColor Gray
    Write-Host "   Web       $RemoteWeb" -ForegroundColor Gray
    Write-Host ''
    exit 0
} else {
    Write-Host '  Deploy finished WITH PROBLEMS - see FAIL lines above.' -ForegroundColor Red
    Write-Host ''
    exit 1
}