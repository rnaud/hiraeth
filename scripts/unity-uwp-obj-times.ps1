# GitHub Actions only (.github/workflows/unity-xbox.yml; docs/systems/xbox.md, "The workflow's caches"): msbuild
# made incremental across runs. The solution Unity writes is new each run (every file of it, IL2CPP's C++ too, with
# this run's time), while the build's objects (build\obj: IL2CPP's bee state and objects, the app's) come back from
# the cache with theirs, so to bee and msbuild every source would look newer than its object. This puts back, on each
# file whose content is what it was when the cached objects were built, the time it had then:
#   ./scripts/unity-uwp-obj-times.ps1 restore <solution dir>    (before msbuild: from build\obj\sources.tsv)
#   ./scripts/unity-uwp-obj-times.ps1 record <solution dir>     (after it: every file's size, hash and time, into the cache)
# A file that changed keeps its new time and is compiled again; the others are not. Not build\ (the objects
# themselves) nor AppPackages.
param([Parameter(Mandatory)][ValidateSet('restore', 'record')][string]$Mode, [Parameter(Mandatory)][string]$Dir)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path $Dir).Path.TrimEnd('\', '/')
$list = Join-Path $root 'build\obj\sources.tsv'
$t0 = Get-Date

function Sources {
  Get-ChildItem $root -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($root.Length + 1)
    -not ($rel -match '^(build|AppPackages)[\\/]' -or $rel -match '[\\/](bin|obj|AppPackages)[\\/]')
  }
}

if ($Mode -eq 'record') {
  $lines = foreach ($f in Sources) {
    $rel = $f.FullName.Substring($root.Length + 1)
    $h = (Get-FileHash -Algorithm MD5 -LiteralPath $f.FullName).Hash
    "$rel`t$($f.Length)`t$h`t$($f.LastWriteTimeUtc.Ticks)"
  }
  New-Item -ItemType Directory -Force (Split-Path $list) | Out-Null
  [IO.File]::WriteAllLines($list, [string[]]$lines)
  Write-Host ("recorded {0} files in {1:N0} s" -f $lines.Count, ((Get-Date) - $t0).TotalSeconds)
  exit 0
}

if (-not (Test-Path $list)) { Write-Host 'no sources.tsv (no cached objects): everything is compiled'; exit 0 }
$was = @{}
foreach ($l in [IO.File]::ReadAllLines($list)) { $p = $l -split "`t"; if ($p.Count -eq 4) { $was[$p[0]] = $p } }
$same = 0; $changed = 0; $new = 0
foreach ($f in Sources) {
  $rel = $f.FullName.Substring($root.Length + 1)
  $p = $was[$rel]
  if (-not $p) { $new++; continue }
  if ([long]$p[1] -eq $f.Length -and (Get-FileHash -Algorithm MD5 -LiteralPath $f.FullName).Hash -eq $p[2]) {
    $f.LastWriteTimeUtc = [DateTime]::new([long]$p[3], [DateTimeKind]::Utc); $same++
  } else { $changed++ }
}
Write-Host ("{0} files as they were (their old time back), {1} changed, {2} new, in {3:N0} s" -f $same, $changed, $new, ((Get-Date) - $t0).TotalSeconds)
