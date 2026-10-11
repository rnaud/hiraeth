# Puerts' V8 for the Unity bridge's UWP build (the Xbox: docs/systems/xbox.md, "The Unity build on the Xbox").
# Puerts 3.0.3 ships no UWP PapiV8.dll; this builds one as rnaud/puerts-uwp does (proven there on the console: V8's
# JIT runs in a sideloaded UWP app, no codeGeneration capability needed; the desert's world build 6.0 s against
# QuickJS's 172 s):
#  - Puerts' own prebuilt V8 13.6.233.17 (puerts/backend-v8: wee8.lib, clang-cl, the static CRT; no V8 build here);
#  - Puerts' papi-v8 at the release's tag, linked against OneCore's import libraries only (onecoreuap.lib as MSBuild's
#    CoreLibraryDependencies and CMake's standard libraries: kernel32 and advapi32 as OneCore has them), the
#    inspector left out (WITHOUT_INSPECTOR: its websocket imported ws2_32 and mswsock), dbghelp and winmm's
#    timeGetTime stubbed (scripts/unity-uwp-v8-stubs.cpp); the static CRT, as Puerts' desktop DLL.
# Then into the embedded V8 package as Plugins/WSA/x64/PapiV8.dll, with a meta for Windows Store Apps x64 alone; the
# desktop PapiV8.dll (and libPapiV8.so) in Plugins/x86_64 deleted: their metas would put them in the UWP build.
# PuertsCore.dll stays scripts/unity-uwp-natives.ps1's (Windows Store; PapiV8 imports it by name).
#   PUERTS_BACKENDS="Quickjs V8" scripts/unity-js-setup.sh; pwsh scripts/unity-uwp-natives.ps1; pwsh scripts/unity-uwp-v8.ps1
#   [-Jitless]: Puerts' JITLESS (--jitless: no executable memory at all; 64 s for the desert instead of 6)
param(
  [string]$Version = '3.0.3',
  [string]$Cache = '',
  [switch]$Jitless,
  [string]$V8Url = 'https://github.com/puerts/backend-v8/releases/download/V8_13.6.233.17__260903/v8_bin_13.6.233.17.tar.gz'
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
if (-not $Cache) { $Cache = Join-Path $root ".local-tools/puerts-uwp-v8/$Version" }
$packages = Join-Path $root 'unity/Memento/Packages'
$v8pkg = Join-Path $packages 'com.tencent.puerts.v8'
if (-not (Test-Path $v8pkg)) { throw 'no com.tencent.puerts.v8 in unity/Memento/Packages: PUERTS_BACKENDS="Quickjs V8" scripts/unity-js-setup.sh first' }
$name = if ($Jitless) { 'PapiV8Jitless.dll' } else { 'PapiV8.dll' }
$dll = Join-Path $Cache $name

if (-not (Test-Path $dll)) {
  $tmp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
  $src = Join-Path $tmp "puerts-src-$Version"   # (unity-uwp-natives.ps1's clone, when it made one)
  if (-not (Test-Path $src)) {
    git clone --depth 1 --branch "Unity_v$Version" https://github.com/Tencent/puerts.git $src
    if ($LASTEXITCODE) { throw "git clone of Puerts Unity_v$Version failed" }
  }
  $native = Join-Path $src 'unity/native'
  # V8: the library and its headers where papi-v8's CMakeLists looks (.backends/<JS_ENGINE>)
  $backend = Join-Path $native 'papi-v8/.backends/papi-v8'
  if (-not (Test-Path (Join-Path $backend 'Lib/Win64/wee8.lib'))) {
    $tgz = Join-Path $tmp 'v8_bin_13.6.233.17.tar.gz'
    if (-not (Test-Path $tgz)) { curl.exe -sSfL -o $tgz $V8Url; if ($LASTEXITCODE) { throw 'the V8 download failed' } }
    $x = Join-Path $tmp 'v8x'
    New-Item -ItemType Directory -Force $x | Out-Null
    # (the Windows x64 library and the headers only: the archive holds every platform's)
    tar -xzf $tgz -C $x '*Lib/Win64/*' '*Inc/*'
    if ($LASTEXITCODE) { tar -xzf $tgz -C $x; if ($LASTEXITCODE) { throw 'the V8 unpack failed' } }
    $lib = Get-ChildItem $x -Recurse -Filter wee8.lib | Where-Object { $_.FullName -match 'Win64' } | Select-Object -First 1
    if (-not $lib) { throw 'no Lib/Win64/wee8.lib in the V8 archive' }
    New-Item -ItemType Directory -Force (Join-Path $backend 'Lib/Win64') | Out-Null
    Copy-Item $lib.FullName (Join-Path $backend 'Lib/Win64/wee8.lib')
    Copy-Item (Join-Path $lib.Directory.Parent.Parent.FullName 'Inc') (Join-Path $backend 'Inc') -Recurse
    Remove-Item -Recurse -Force $x, $tgz
  }
  # papi-v8's CMakeLists: winmm, dbghelp and shlwapi out, the stubs in
  $cml = Join-Path $native 'papi-v8/CMakeLists.txt'
  $text = Get-Content $cml -Raw
  if ($text -notmatch 'unity-uwp-v8-stubs') {
    $stubs = (Join-Path $PSScriptRoot 'unity-uwp-v8-stubs.cpp').Replace('\', '/')
    $new = $text -replace '(?s)target_link_libraries\(PapiV8\s+winmm\.lib\s+dbghelp\.lib\s+shlwapi\.lib\s+\)', "target_sources(PapiV8 PRIVATE `"$stubs`")"
    if ($new -eq $text) { throw 'papi-v8/CMakeLists.txt: the winmm/dbghelp/shlwapi line was not found (another Puerts?)' }
    [IO.File]::WriteAllText($cml, $new)
  }
  $defs = 'V8_94_OR_NEWER;V8_118_OR_NEWER;V8_129_OR_NEWER;V8_136_OR_NEWER;WITHOUT_INSPECTOR'
  if ($Jitless) { $defs += ';JITLESS' }
  $nodef = (('kernel32', 'advapi32', 'user32', 'winmm', 'dbghelp', 'shlwapi', 'ws2_32', 'mswsock', 'ole32', 'oleaut32', 'shell32', 'gdi32', 'winspool', 'comdlg32', 'uuid') | ForEach-Object { "/NODEFAULTLIB:$_.lib" }) -join ' '
  $b = Join-Path $native "papi-v8/build-uwp-$([IO.Path]::GetFileNameWithoutExtension($name))"
  cmake -S (Join-Path $native 'papi-v8') -B $b -G 'Visual Studio 17 2022' -A x64 -DJS_ENGINE=papi-v8 -DCMAKE_BUILD_TYPE=Release `
    "-DBACKEND_DEFINITIONS=$defs" '-DBACKEND_LIB_NAMES=/Lib/Win64/wee8.lib' '-DBACKEND_INC_NAMES=/Inc' -DWITH_WEBSOCKET=0 `
    '-DCMAKE_CXX_STANDARD_LIBRARIES=onecoreuap.lib' '-DCMAKE_C_STANDARD_LIBRARIES=onecoreuap.lib' "-DCMAKE_SHARED_LINKER_FLAGS=$nodef /OPT:REF /OPT:ICF"
  if ($LASTEXITCODE) { throw 'cmake (papi-v8 for UWP) failed' }
  cmake --build $b --config Release --parallel --target PapiV8 -- /v:m '/p:CoreLibraryDependencies=onecoreuap.lib'
  if ($LASTEXITCODE) { throw 'building PapiV8 for UWP failed' }
  $f = Get-ChildItem $b -Recurse -Filter PapiV8.dll | Where-Object { $_.FullName -match '\\Release\\' } | Select-Object -First 1
  New-Item -ItemType Directory -Force $Cache | Out-Null
  Copy-Item $f.FullName $dll
}

# what it imports: PuertsCore and OneCore's KERNEL32 / ADVAPI32 only (no dbghelp, winmm, ws2_32, mswsock)
$dumpbin = Get-ChildItem "${env:ProgramFiles}\Microsoft Visual Studio" -Recurse -Filter dumpbin.exe -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match 'Hostx64\\x64' } | Select-Object -First 1
Write-Host ("{0} ({1:N0} kB)" -f $dll, ((Get-Item $dll).Length / 1kB))
if ($dumpbin) {
  $deps = & $dumpbin.FullName /nologo /dependents $dll | Select-String '\.dll' | ForEach-Object { $_.Line.Trim() } | Where-Object { $_ -notmatch '^Dump of' }
  $deps | ForEach-Object { Write-Host "  $_" }
  $bad = $deps | Where-Object { $_ -match '^(dbghelp|winmm|ws2_32|mswsock|shlwapi)\.dll$' }
  if ($bad) { throw "PapiV8.dll still imports $($bad -join ', ')" }
}

$plugins = Join-Path $v8pkg 'Plugins'
# (the desktop DLL of the same name would go into the UWP build too: its meta enables Any platform)
Get-ChildItem (Join-Path $plugins 'x86_64') -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'PapiV8.*' -or $_.Name -like 'libPapiV8.*' } | Remove-Item -Force
$dir = Join-Path $plugins 'WSA/x64'
New-Item -ItemType Directory -Force $dir | Out-Null
Copy-Item $dll (Join-Path $dir 'PapiV8.dll') -Force
$meta = @'
fileFormatVersion: 2
guid: 7d2b8e4c1f3a4b5c9e0d1a2b3c4d5e6f
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
# (LF, no BOM, a newline at the end: unity-uwp-natives.ps1's note on Unity's YAML parser, which otherwise ignores the DLL)
$text = $meta.Replace("`r`n", "`n").TrimEnd() + "`n"
[IO.File]::WriteAllText((Join-Path $dir 'PapiV8.dll.meta'), $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Puerts $Version's V8 for UWP x64 ($name) in com.tencent.puerts.v8/Plugins/WSA/x64/PapiV8.dll"
