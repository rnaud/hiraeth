# GitHub Actions only (.github/workflows/unity-xbox.yml; docs/systems/xbox.md, "The workflow's caches"): GameCI's
# Windows editor image (the UWP module, ~8 minutes to pull) pulled in the background while the job checks out,
# bundles, builds Puerts' natives and restores its caches, as scripts/unity-ci-docker.sh does on Linux.
#   ./scripts/unity-uwp-docker.ps1 start unityci/editor:windows-6000.6.4f1-universal-windows-platform-3
#   ./scripts/unity-uwp-docker.ps1 wait     (before the first GameCI step: the pull's end; pulled again if it failed)
# start first waits for Docker's engine: a runner once came up without it ("failed to connect to the docker API at
# npipe:////./pipe/docker_engine", run 38151566018, both editor runs gone in seconds), so the service is started and
# asked again (RETRY_DELAYS seconds apart, as scripts/retry.sh) before anything needs it.
param([Parameter(Mandatory)][ValidateSet('start', 'wait')][string]$Mode, [string]$Image)
$ErrorActionPreference = 'Continue'   # (docker's stderr is read, never a stop: the failures are thrown below)
$state = Join-Path ($env:RUNNER_TEMP ?? [IO.Path]::GetTempPath()) 'unity-image'
$delays = @(($env:RETRY_DELAYS ?? '10 20 30 60') -split ' ' | Where-Object { $_ } | ForEach-Object { [int]$_ })

function Engine {
  for ($i = 0; ; $i++) {
    $v = & docker version --format '{{.Server.Version}}' 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host "Docker $v"; return }
    if ($i -ge $delays.Count) { throw "Docker's engine is not running: $v" }
    Write-Host "Docker's engine not up (attempt $($i + 1)): $v; starting the service, again in $($delays[$i]) s"
    Start-Service docker -ErrorAction SilentlyContinue
    Start-Sleep -Seconds $delays[$i]
  }
}

function Pull([string]$img) {
  for ($i = 0; ; $i++) {
    & docker pull -q $img
    if ($LASTEXITCODE -eq 0) { return }
    if ($i -ge $delays.Count) { throw "docker pull $img failed ($LASTEXITCODE)" }
    Write-Host "docker pull failed (attempt $($i + 1)): again in $($delays[$i]) s"
    Start-Sleep -Seconds $delays[$i]
  }
}

if ($Mode -eq 'start') {
  if (-not $Image) { throw 'start: the image' }
  Engine
  New-Item -ItemType Directory -Force $state | Out-Null
  Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $state 'done')
  Set-Content (Join-Path $state 'image') $Image
  # (a process of its own: it outlives this step, and the runner ends it with the job)
  $cmd = "`$t = Get-Date; docker pull -q '$Image' *> '$state\log'; `$s = `$LASTEXITCODE; " +
    "Add-Content '$state\log' (""pull {0:N0} s"" -f ((Get-Date) - `$t).TotalSeconds); Set-Content '$state\done' `$s"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))   # (no quoting through Start-Process)
  Start-Process pwsh -ArgumentList '-NoProfile', '-NonInteractive', '-EncodedCommand', $encoded -WindowStyle Hidden | Out-Null
  Write-Host "pulling $Image in the background"
} else {
  $Image = Get-Content (Join-Path $state 'image') -ErrorAction SilentlyContinue
  if (-not $Image) { throw "wait: no pull was started (start first)" }
  $t = 0
  while (-not (Test-Path (Join-Path $state 'done')) -and $t -lt 2400) { Start-Sleep -Seconds 5; $t += 5 }
  Get-Content (Join-Path $state 'log') -ErrorAction SilentlyContinue
  Write-Host "the image after $t s more"
  $code = (Get-Content (Join-Path $state 'done') -ErrorAction SilentlyContinue) -join ''
  if ($code -ne '0') {
    Write-Host "::warning title=Editor image::the background pull of $Image did not finish ($code): pulled again"
    Engine
    Pull $Image
  }
}
