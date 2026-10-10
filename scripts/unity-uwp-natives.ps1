# Puerts' natives for UWP (the Unity bridge on the Xbox: docs/systems/xbox.md, "The Unity build on the Xbox").
# Puerts 3.0.3 ships no WSA/UWP libraries, and its desktop V8 (PapiV8.dll) needs dbghelp, winmm, mswsock and a JIT,
# none of them a UWP app's on the console. Its QuickJS backend (quickjs-ng, an interpreter) is plain C: built here
# from Puerts' own source at the release's tag as Windows Store x64 DLLs (CMake's WindowsStore system: AppContainer,
# the UWP C runtime), then put into the embedded packages in place of the desktop ones:
#   Packages/com.tencent.puerts.core/Plugins/WSA/x64/PuertsCore.dll
#   Packages/com.tencent.puerts.quickjs/Plugins/WSA/x64/PapiQuickjs.dll
# with metas for Windows Store Apps (x64) alone; the desktop DLLs of the same names are deleted (the project is built
# for UWP only in this checkout). scripts/unity-js-setup.sh (PUERTS_BACKENDS=Quickjs) first.
#   pwsh scripts/unity-uwp-natives.ps1 [-Version 3.0.3] [-Cache .local-tools/puerts-uwp]
param(
  [string]$Version = '3.0.3',
  [string]$Cache = ''
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
if (-not $Cache) { $Cache = Join-Path $root ".local-tools/puerts-uwp/$Version" }
$packages = Join-Path $root 'unity/Memento/Packages'
foreach ($p in 'com.tencent.puerts.core', 'com.tencent.puerts.quickjs') {
  if (-not (Test-Path (Join-Path $packages $p))) { throw "no $p in unity/Memento/Packages: PUERTS_BACKENDS=Quickjs scripts/unity-js-setup.sh first" }
}

$core = Join-Path $Cache 'PuertsCore.dll'
$qjs = Join-Path $Cache 'PapiQuickjs.dll'
if (-not ((Test-Path $core) -and (Test-Path $qjs))) {
  $src = Join-Path $env:RUNNER_TEMP "puerts-src-$Version"
  if (-not $env:RUNNER_TEMP) { $src = Join-Path ([IO.Path]::GetTempPath()) "puerts-src-$Version" }
  if (-not (Test-Path $src)) {
    git clone --depth 1 --branch "Unity_v$Version" https://github.com/Tencent/puerts.git $src
    if ($LASTEXITCODE) { throw "git clone of Puerts Unity_v$Version failed" }
  }
  $native = Join-Path $src 'unity/native/papi-quickjs'
  $build = Join-Path $native 'build-uwp'
  # (papi-quickjs takes ../puerts, PuertsCore, as a subdirectory: one configure builds both)
  cmake -S $native -B $build -G 'Visual Studio 17 2022' -A x64 '-DCMAKE_SYSTEM_NAME=WindowsStore' '-DCMAKE_SYSTEM_VERSION=10.0'   # (quoted: PowerShell splits 10.0 at the dot)
  if ($LASTEXITCODE) { throw "cmake (WindowsStore x64) failed: the runner needs Visual Studio's C++ UWP tools" }
  cmake --build $build --config Release --parallel
  if ($LASTEXITCODE) { throw 'building PuertsCore / PapiQuickjs for UWP failed' }
  New-Item -ItemType Directory -Force $Cache | Out-Null
  foreach ($n in 'PuertsCore.dll', 'PapiQuickjs.dll') {
    $f = Get-ChildItem $build -Recurse -Filter $n | Where-Object { $_.FullName -match '\\Release\\' } | Select-Object -First 1
    if (-not $f) { throw "no $n under $build" }
    Copy-Item $f.FullName (Join-Path $Cache $n)
  }
}

# the imports: the UWP runtime (VCRUNTIME140_APP), never the desktop one
$dumpbin = Get-ChildItem "${env:ProgramFiles}\Microsoft Visual Studio" -Recurse -Filter dumpbin.exe -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'Hostx64\\x64' } | Select-Object -First 1
foreach ($f in $core, $qjs) {
  Write-Host ("{0} ({1:N0} kB)" -f $f, ((Get-Item $f).Length / 1kB))
  if ($dumpbin) { & $dumpbin.FullName /nologo /dependents $f | Select-String '\.dll' | ForEach-Object { Write-Host "  $($_.Line.Trim())" } }
}

$meta = @'
fileFormatVersion: 2
guid: GUID
PluginImporter:
  externalObjects: {}
  serializedVersion: 2
  iconMap: {}
  executionOrder: {}
  defineConstraints: []
  isPreloaded: 0
  isOverridable: 1
  isExplicitlyReferenced: 0
  validateReferences: 1
  platformData:
  - first:
      Any:
    second:
      enabled: 0
      settings: {}
  - first:
      Editor: Editor
    second:
      enabled: 0
      settings:
        DefaultValueInitialized: true
  - first:
      Windows Store Apps: WindowsStoreApps
    second:
      enabled: 1
      settings:
        CPU: X64
  userData:
  assetBundleName:
  assetBundleVariant:
'@

function Place([string]$package, [string]$file, [string]$guid) {
  $plugins = Join-Path $packages "$package/Plugins"
  # (the desktop DLL of the same name would go into the UWP build too: its meta enables Any platform)
  Get-ChildItem $plugins -Recurse -File | Where-Object { $_.Name -like "$([IO.Path]::GetFileNameWithoutExtension($file)).*" -or $_.Name -like "lib$([IO.Path]::GetFileNameWithoutExtension($file)).*" } |
    Where-Object { $_.FullName -notmatch '\\WSA\\' -and $_.FullName -match '\\x86_64\\' } | Remove-Item -Force
  $dir = Join-Path $plugins 'WSA/x64'
  New-Item -ItemType Directory -Force $dir | Out-Null
  Copy-Item (Join-Path $Cache $file) (Join-Path $dir $file) -Force
  # (LF and no BOM, written as bytes: the first CI run's metas, through Set-Content, "could not be parsed" by Unity)
  $text = $meta.Replace("`r`n", "`n").Replace('GUID', $guid)
  [IO.File]::WriteAllText((Join-Path $dir "$file.meta"), $text, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "$package/Plugins/WSA/x64/$file.meta: $(($text -split "`n")[0..1] -join ' | ')"
}
Place 'com.tencent.puerts.core' 'PuertsCore.dll' '5b0f6c2a9d3e4f7a8c1b2d3e4f5a6b7c'
Place 'com.tencent.puerts.quickjs' 'PapiQuickjs.dll' '6c1a7d3b0e4f5a8b9d2c3e4f5a6b7c8d'
# (the websocket addon: desktop only, unused by the bridge)
Get-ChildItem (Join-Path $packages 'com.tencent.puerts.core/Plugins/x86_64') -Filter '*WSPPAddon*' -ErrorAction SilentlyContinue | Remove-Item -Force
Write-Host "Puerts $Version for UWP x64: PuertsCore.dll and PapiQuickjs.dll in Plugins/WSA/x64"
