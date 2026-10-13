// The Unity build on the Xbox (docs/systems/xbox.md, "The Unity build on the Xbox"): the workflow's key lines, the
// package's own identity, Puerts' QuickJS chosen where there is no V8, and the numbers written to LocalState.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UNITY_RELEASES, unityNotes } from '../scripts/release-info.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const workflow = read('.github/workflows/unity-xbox.yml');
const build = read('unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs');

test('the workflow builds the UWP solution with GameCI on Windows, then packages and signs it', () => {
  assert.match(workflow, /runs-on: windows-2022/);
  assert.match(workflow, /^ {2}workflow_dispatch:/m);
  assert.match(workflow, /- '\.github\/workflows\/unity-xbox\.yml'/);
  assert.match(workflow, /UNITY_VERSION: 6000\.6\.4f1/);
  const version = /m_EditorVersion: (\S+)/.exec(read('unity/Hiraeth/ProjectSettings/ProjectVersion.txt'))[1];
  assert.ok(workflow.includes(`UNITY_VERSION: ${version}`));
  const steps = workflow.split('uses: game-ci/unity-builder@v6').slice(1);
  assert.equal(steps.length, 4);   // (the glue and the solution, each retried once)
  for (const s of steps) {
    assert.match(s, /targetPlatform: WSAPlayer/);
    assert.match(s, /UNITY_EMAIL: \$\{\{ secrets\.UNITY_EMAIL \}\}/);
    assert.match(s, /allowDirtyBuild: true/);
  }
  assert.match(workflow, /buildMethod: Hiraeth\.EditorTools\.BridgeBuild\.Il2cpp/);
  assert.match(workflow, /buildMethod: Hiraeth\.EditorTools\.BridgeBuild\.Xbox/);
  // V8 (relinked for UWP) and QuickJS (the fallback), their UWP natives from Puerts' source and prebuilt V8
  assert.match(workflow, /PUERTS_BACKENDS='Quickjs V8' scripts\/unity-js-setup\.sh/);
  assert.match(workflow, /\.\/scripts\/unity-uwp-natives\.ps1/);
  assert.match(workflow, /\.\/scripts\/unity-uwp-v8\.ps1/);
  assert.match(workflow, /'PuertsCore\.dll', 'PapiV8\.dll'/, 'the package checked for its V8');
  // msbuild Master x64, unsigned, then signtool with the WebView2 app's certificate
  assert.match(workflow, /-p:Configuration=\$env:MSCONFIG -p:Platform=x64/);
  assert.match(workflow, /MSCONFIG: \$\{\{ inputs\.development && 'Release' \|\| 'Master' \}\}/, 'Master unless a development player is asked for');
  assert.match(workflow, /-p:AppxPackageSigningEnabled=false/);
  assert.match(workflow, /XBOX_PFX_BASE64: \$\{\{ secrets\.XBOX_PFX_BASE64 \}\}/);
  assert.match(workflow, /signtool/);
  assert.match(workflow, /Name="rnaud\.HiraethUnity"/);
  assert.match(workflow, /scripts\/unity-publish\.sh xbox out\/hiraeth-unity-xbox\.zip/);
  assert.match(workflow, /key: unity-library-xbox-/);
  assert.match(workflow, /scripts\/unity-ci-cache-prune\.sh unity-library-xbox- "\$KEY"/);
  for (const k of workflow.match(/^\s*key: .*$/gm)) assert.doesNotMatch(k, /github\.run_(id|number)|github\.sha/, 'no cache key that changes every run');
});

test('the Xbox build\'s caches: the glue on what it is made from, IL2CPP\'s objects for msbuild, the image pulled early', () => {
  // the glue: keyed on Puerts' configuration, GenerateGlue and the packages (scripts/unity-glue-key.mjs), not every .cs
  assert.match(workflow, /"hash=\$\(node scripts\/unity-glue-key\.mjs\)" >> \$env:GITHUB_OUTPUT/);
  assert.match(workflow, /key: puerts-glue-xbox-3\.0\.3-v8-\$\{\{ env\.UNITY_VERSION \}\}-\$\{\{ steps\.gluekey\.outputs\.hash \}\}\n/);
  assert.match(workflow, /id: gluebuild\n {8}if: steps\.glue\.outputs\.cache-hit != 'true'/);
  // IL2CPP's objects and bee's state: restored from the newest for this Unity and configuration, the unchanged
  // sources' times put back before msbuild, recorded after it, saved when the C++ moved, the older deleted
  assert.match(workflow, /path: \$\{\{ env\.PROJECT \}\}\/Builds\/unity-xbox\/build\/obj\n {10}key: il2cpp-obj-xbox-\$\{\{ env\.UNITY_VERSION \}\}-\$\{\{ env\.MSCONFIG \}\}-\$\{\{ hashFiles\('unity\/Hiraeth\/Builds\/unity-xbox\/Il2CppOutputProject\/Source\/\*\*'/);
  assert.match(workflow, /restore-keys: \|\n {12}il2cpp-obj-xbox-\$\{\{ env\.UNITY_VERSION \}\}-\$\{\{ env\.MSCONFIG \}\}-\n/);
  const at = (s) => { const i = workflow.indexOf(s); assert.ok(i > 0, s); return i; };
  assert.ok(at('unity-uwp-obj-times.ps1 restore') < at('& $env:MSBUILD') && at('& $env:MSBUILD') < at('unity-uwp-obj-times.ps1 record'));
  assert.ok(at('id: solutionagain') < at('id: objcache'), 'restored after Unity wrote the solution');
  assert.match(workflow, /run: scripts\/unity-ci-cache-prune\.sh "il2cpp-obj-xbox-\$UNITY_VERSION-\$MSCONFIG-" "\$KEY"/);
  const times = read('scripts/unity-uwp-obj-times.ps1');
  assert.match(times, /Get-FileHash -Algorithm MD5/);
  assert.match(times, /\$f\.LastWriteTimeUtc = \[DateTime\]::new\(\[long\]\$p\[3\]/);
  // the editor image pulled in the background from the start (Docker's engine waited for), waited for before the first editor run
  assert.ok(at('unity-uwp-docker.ps1 start "unityci/editor:windows-$env:UNITY_VERSION-universal-windows-platform-3"') < at('uses: actions/setup-node@v5'));
  assert.ok(at('unity-uwp-docker.ps1 wait') < at('uses: game-ci/unity-builder@v6'));
  const docker = read('scripts/unity-uwp-docker.ps1');
  assert.match(docker, /Start-Service docker/);
  assert.match(docker, /Start-Process pwsh [^\n]*-EncodedCommand/);
  // a run by hand never waits behind (nor is replaced by) a push; only main's builds are published
  assert.match(workflow, /group: unity-xbox-\$\{\{ github\.event_name == 'workflow_dispatch' && format\('dispatch-\{0\}', github\.run_id\) \|\| 'push' \}\}/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main' && env\.GFX == 'Direct3D12' && env\.DEV == ''\n[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n {8}run: scripts\/unity-publish\.sh xbox/);
  // Direct3D12 is the Xbox's (65 fps at 1440p against 51): a push builds and publishes it, Direct3D11 is the A/B
  assert.match(workflow, /GFX: \$\{\{ inputs\.graphics_api \|\| 'Direct3D12' \}\}/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs'), /Arg\("-graphicsApi"\) == "Direct3D11" \? GraphicsDeviceType\.Direct3D11 : GraphicsDeviceType\.Direct3D12/);
  // the prune keeps to the run's branch and to the entries older than the one it keeps
  const prune = read('scripts/unity-ci-cache-prune.sh');
  assert.match(prune, /\$\{GITHUB_REF:\+--ref "\$GITHUB_REF"\}/);
  assert.match(prune, /\$2 < t/);
});

test('the glue\'s key moves with Puerts\' configuration and GenerateGlue, not with the rest of the C#', async () => {
  const { glueKey } = await import('../scripts/unity-glue-key.mjs');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tempDir } = await import('../scripts/temp-dirs.mjs');
  const dir = tempDir('glue-key-');
  mkdirSync(join(dir, 'Assets', 'HiraethJS', 'Editor'), { recursive: true });
  mkdirSync(join(dir, 'Assets', 'Gen'), { recursive: true });
  mkdirSync(join(dir, 'Packages'));
  writeFileSync(join(dir, 'Packages', 'manifest.json'), '{}');
  const bb = (patch) => `class B {\n        static bool GenerateGlue()\n        {\n            ${patch}\n        }\n\n        static void Il2Cpp() { }\n}\n`;
  writeFileSync(join(dir, 'Assets', 'HiraethJS', 'Editor', 'BridgeBuild.cs'), bb('Unbox();'));
  writeFileSync(join(dir, 'Assets', 'Runner.cs'), 'class R { void Update() { a(); } }\n');
  const k0 = glueKey(dir, 'self');
  writeFileSync(join(dir, 'Assets', 'Runner.cs'), 'class R { void Update() { a(); b(); } }\n');
  writeFileSync(join(dir, 'Assets', 'Gen', 'Glue.cs'), '[Configure] class G {}\n');
  writeFileSync(join(dir, 'Assets', 'HiraethJS', 'Editor', 'BridgeBuild.cs'), bb('Unbox();') + 'class C { void X() {} }\n');
  assert.equal(glueKey(dir, 'self'), k0, 'a C# edit elsewhere, Assets/Gen itself');
  writeFileSync(join(dir, 'Assets', 'Runner.cs'), 'class R { void Update() { env.UsingAction<int>(); } }\n');
  const k1 = glueKey(dir, 'self');
  assert.notEqual(k1, k0, 'a UsingAction');
  writeFileSync(join(dir, 'Assets', 'Cfg.cs'), '[Puerts.Configure] public class Cfg { [Binding] static IEnumerable<Type> B => null; }\n');
  const k2 = glueKey(dir, 'self');
  assert.notEqual(k2, k1, 'a [Configure] class');
  writeFileSync(join(dir, 'Assets', 'HiraethJS', 'Editor', 'BridgeBuild.cs'), bb('GetRawData();'));
  assert.notEqual(glueKey(dir, 'self'), k2, 'GenerateGlue');
  assert.notEqual(glueKey(dir, 'self2'), glueKey(dir, 'self'), 'the key script itself');
});

test('the package installs next to the WebView2 app, never over it, to a prerelease of its own', () => {
  assert.equal(/const string XboxPackage = "([^"]+)"/.exec(build)[1], 'rnaud.HiraethUnity');
  assert.equal(UNITY_RELEASES.xbox.package, 'rnaud.HiraethUnity');
  assert.match(read('xbox/Hiraeth/Package.appxmanifest'), /Name="rnaud\.Hiraeth"/);
  assert.equal(UNITY_RELEASES.xbox.tag, 'unity-xbox');
  const notes = unityNotes({ platform: 'xbox', sha: 'abcdef0123456789', version: '1.39', build: 1700 });
  assert.match(notes, /hiraeth-unity-xbox\.zip/);
  assert.match(notes, /rnaud\.Hiraeth`/);
  assert.match(notes, /unity\.log/);
  const xbox = build.slice(build.indexOf('public static void Xbox()'));
  assert.match(xbox, /BuildTarget\.WSAPlayer/);
  assert.match(xbox, /ScriptingImplementation\.IL2CPP/);
  assert.match(xbox, /GraphicsDeviceType\.Direct3D11/);
  assert.match(xbox, /Wsa\("wsaArchitecture", "x64"\)/);
});

test('Puerts runs QuickJS where its V8 package is missing, and the setup can install QuickJS', () => {
  const js = read('unity/Hiraeth/Assets/HiraethJS/Runtime/JsRuntime.cs');
  assert.match(js, /Puerts\.BackendQuickJS, com\.tencent\.puerts\.quickjs/);
  assert.match(js, /Enum\.Parse\(kind, "QuickJS"\)/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/link.xml'), /com\.tencent\.puerts\.quickjs/);
  const setup = read('scripts/unity-js-setup.sh');
  assert.match(setup, /BACKENDS=\$\{PUERTS_BACKENDS:-V8\}/);
  const natives = read('scripts/unity-uwp-natives.ps1');
  assert.match(natives, /'-DCMAKE_SYSTEM_NAME=WindowsStore' '-DCMAKE_SYSTEM_VERSION=10\.0'/);
  assert.match(natives, /--branch "Unity_v\$Version"/);
  assert.match(natives, /Windows Store Apps: WindowsStoreApps/);
});

test('Puerts\' V8 relinked for UWP: OneCore\'s import libraries, no inspector, the desktop-only imports stubbed, a WSA meta', () => {
  const v8 = read('scripts/unity-uwp-v8.ps1');
  assert.match(v8, /V8_13\.6\.233\.17/, 'the V8 Puerts 3.0.3 expects');
  assert.match(v8, /WITHOUT_INSPECTOR/);
  assert.match(v8, /CoreLibraryDependencies=onecoreuap\.lib/);
  assert.match(v8, /CMAKE_CXX_STANDARD_LIBRARIES=onecoreuap\.lib/);
  assert.match(v8, /Plugins\/WSA\/x64|'WSA\/x64'/);
  assert.match(v8, /Windows Store Apps: WindowsStoreApps/);
  assert.match(v8, /TrimEnd\(\) \+ "`n"/, 'the meta ends with a newline (Unity ignores the DLL otherwise)');
  assert.match(v8, /dbghelp\|winmm\|ws2_32\|mswsock/, 'and checks they are gone');
  const stubs = read('scripts/unity-uwp-v8-stubs.cpp');
  for (const f of ['SymInitialize', 'StackWalk64', 'timeGetTime']) assert.match(stubs, new RegExp(`STUB\\([^,]+, ${f},`), f);
  // (Tick and the sound's own engine with V8; QuickJS keeps its workarounds; LocalState\args.txt for a player's flags)
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /tickJs => JsRuntime\.Backend != "QuickJS" && !BridgeArgs\.Flag\("-no-tick"\)/);
  assert.match(runner, /oneEngine = JsRuntime\.Backend == "QuickJS"/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeArgs.cs'), /UNITY_WSA && !UNITY_EDITOR[\s\S]*args\.txt/);
});

test('the numbers go to LocalState\\unity.log, the native side apart from the script', () => {
  const m = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMetrics.cs');
  assert.match(m, /Application\.persistentDataPath/);
  assert.match(m, /"unity\.log"/);
  assert.match(m, /#if UNITY_WSA && !UNITY_EDITOR\n\s*return true;/);
  for (const s of ['first node', 'world settled', 'first frames', 'gpu', 'script', 'wait']) assert.ok(m.includes(s), s);
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /if \(BridgeMetrics\.Wanted\(\)\) gameObject\.AddComponent<BridgeMetrics>\(\)\.runner = this;/);
  assert.match(runner, /scriptMsTotal \+=/);
});

test('the Xbox\'s experiments from LocalState\\args.txt: -idle (the spawn measured), -no-grd, -ops-cap; the frame\'s phases logged', () => {
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /Flag\("-no-grd"\)\) urp\.gpuResidentDrawerMode = GPUResidentDrawerMode\.Disabled/);
  assert.match(runner, /!BridgeArgs\.Flag\("-grd"\)\) urp\.gpuResidentDrawerMode = GPUResidentDrawerMode\.Disabled/, 'off on the Xbox');
  assert.match(runner, /Arg\("-ops-cap"\)/);
  const host = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs');
  assert.match(host, /\(opsCap > 0 \? asks : ops\)\.Add\(ask\)/, 'a question is never held back by the cap');
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeArgs.cs'), /args\["idle"\]/);
  const game = read('engine/unity/game.js');
  assert.match(game, /kind: 'measure', view: \{ name: 'spawn' \}, secs: args\.idle \}, \{ kind: 'hold' \}/);
  const metrics = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMetrics.cs');
  assert.match(metrics, /phases scripts/);
  assert.match(metrics, /cpuMainThreadPresentWaitTime/);
  assert.match(metrics, /StartsWith\("\[bench\]"\)/, 'the bench\'s results reach unity.log');
});

test('the PlayerLoop timed step by step, a slow frame named by its steps; -no-hud and -queued as experiments', () => {
  const timer = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeLoopTimer.cs');
  assert.match(timer, /PlayerLoop\.SetPlayerLoop\(root\)/);
  assert.match(timer, /outList\.Add\(Mark\(-1\)\)/, 'a mark at each phase\'s end');
  const metrics = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMetrics.cs');
  assert.match(metrics, /BridgeLoopTimer\.Install\(\)/);
  assert.match(metrics, /slow frame \{dt:0\} ms, its steps/);
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /Flag\("-no-hud"\)/);
  assert.match(runner, /QualitySettings\.maxQueuedFrames = nq/);
  assert.match(runner, /Flag\("-no-shadows"\)\) HiraethShadows\.On = false/);
  assert.match(runner, /Arg\("-shadow-near-every"\)/);
  assert.match(runner, /UNITY_WSA && !UNITY_EDITOR\s*\n\s*if \(!BridgeArgs\.Flag\("-shadows-high"\)\) HiraethShadows\.minCasterTexels = 2;/, 'the Xbox\'s own shadow settings');
  assert.match(runner, /HiraethShadows\.MainCamera = cam/, 'the bridge\'s camera keeps the cascades\' schedule');
  assert.match(runner, /uniformLayout = !BridgeArgs\.Flag\("-no-uniform-layout"\)/, 'uniform vertex layouts on the Xbox');
  assert.match(runner, /if \(!booted && !bootBlocking\)/, 'Unity draws on while the script builds the world');
  assert.match(read('engine/unity/game.js'), /if \(args\.tour\)/);
  assert.match(runner, /Arg\("-shadow-min"\)/);
  assert.match(runner, /Flag\("-warm"\)[\s\S]*Shader\.WarmupAllShaders\(\)/);
  assert.match(metrics, /frames ≤17\.5 ms/, 'the frames against the refresh');
});

test('the GPU driver\'s pipelines made early: the pairs the scene drew kept in LocalState, drawn at the next launch while the script builds the world', () => {
  const warm = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgePrewarm.cs');
  assert.match(warm, /prewarm\.txt/);
  assert.match(warm, /SetVertexBufferParams\(3, attrs\)/, 'each layout as the scene had it');
  assert.match(warm, /HiraethShadows\.Instanced\.Add\(caster\)/, 'the sun\'s cascades too');
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /BridgePrewarm\.Load\(scene\.MaterialFromSpec\)/);
  assert.match(runner, /BridgePrewarm\.Draw\(cam, !booted\)/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeMetrics.cs'), /BridgePrewarm\.Save\(\)/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs'), /BridgePrewarm\.Note\(/);
});

test('the Surface shader is the SRP Batcher\'s: every value a material sets in one UnityPerMaterial buffer, the globals outside', () => {
  const sh = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
  const i = sh.indexOf('CBUFFER_START(UnityPerMaterial)'), j = sh.indexOf('CBUFFER_END');
  assert.ok(i > 0 && j > i, 'one buffer');
  assert.equal(sh.split('CBUFFER_START(UnityPerMaterial)').length, 2, 'only one');
  const buf = sh.slice(i, j);
  for (const k of ['_Color', '_Palette', '_Outfit', '_Limbs', '_FluidTones', '_Weather', '_TfEye', '_CrowdTime', '_GrassView', '_FarDepth']) assert.match(buf, new RegExp(`\\b${k}\\b`), k);
  // the globals stay out: Shader.SetGlobal* would not reach a value in the material's buffer
  for (const k of ['_SkyTop', '_EnvGround', '_Halftone', '_SunDir', '_MShadowOn', '_Night']) assert.doesNotMatch(buf, new RegExp(`\\b${k}\\b`), k);
  assert.ok(sh.indexOf('#define HIRAETH_PER_MATERIAL') < sh.indexOf('#include "Figure.hlsl"'), 'the headers told before they are read');
  for (const f of ['Figure.hlsl', 'Marks.hlsl', 'Crowd.hlsl', 'TripoFace.hlsl']) assert.match(read(`unity/Hiraeth/Assets/Hiraeth/Shaders/${f}`), /#ifndef HIRAETH_PER_MATERIAL/, f);
});

test('every value of the Surface shader\'s UnityPerMaterial but its arrays is in its Properties block (0 unless a material sets it, each material its own)', () => {
  const sh = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
  const props = new Set([...sh.slice(0, sh.indexOf('SubShader')).matchAll(/^\s*(_\w+) \(/gm)].map((m) => m[1]));
  const buf = sh.slice(sh.indexOf('CBUFFER_START(UnityPerMaterial)'), sh.indexOf('CBUFFER_END')).replace(/\/\/.*$/gm, '');
  const names = [...buf.matchAll(/\bfloat[234]?\s+([^;]+);/g)].flatMap((m) => m[1].split(',').map((x) => x.trim())).filter((x) => !x.includes('['));
  assert.ok(names.length > 60, `${names.length} values`);
  for (const n of names) assert.ok(props.has(n), `${n} is not in Properties`);
});

test('the Xbox draws the Surface shader\'s lean variants (the full one leaves half the picture out there): the ground\'s and the water\'s own', () => {
  const sh = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
  assert.match(sh, /#pragma multi_compile_local _ HIRAETH_LEAN HIRAETH_LEAN_TERRAIN HIRAETH_LEAN_WATER/);
  assert.match(sh, /UNITY_BRANCH if \(TERRAINK && mode == MODE_TERRAIN[ )]/);   // (and the -surface-skip test's bit after it)
  assert.match(sh, /UNITY_BRANCH if \(WATERK && mode == MODE_WATER/);
  const r = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
  assert.match(r, /#if \(UNITY_STANDALONE_LINUX \|\| UNITY_WSA \|\| UNITY_ANDROID\) && !UNITY_EDITOR\s+true;/, 'the Deck, the Xbox and the Android handhelds (the Retroid: 35.9 -> 24.7 ms of GPU at the desert spawn)');
  assert.match(r, /mode == 1 \? "HIRAETH_LEAN_TERRAIN" : mode == 3 \? "HIRAETH_LEAN_WATER" : "HIRAETH_LEAN"/);
});

test('the shadow maps\' movers culled per cascade by the engine and drawn as renderer lists on the Xbox (the SRP Batcher\'s path)', () => {
  const sh = read('unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethShadows.cs');
  assert.match(sh, /public void CullFor\(ScriptableRenderContext ctx, Camera cam, WorldDetail detail\)/);
  assert.match(sh, /plan\.culled = ctx\.Cull\(ref p\)/);
  const feature = read('unity/Hiraeth/Assets/Hiraeth/Rendering/HiraethFeature.cs');
  assert.match(feature, /renderingLayerMask = HiraethShadows\.LayerOf\(plan\.cascade\)/);
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /UseRendererLists = !BridgeArgs\.Flag\("-shadow-draws"\)/);
  assert.match(runner, /beginCameraRendering \+= CullShadows/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs'), /HiraethShadows\.CasterLayer/);
});

test('the Unity players carry every character file the bundle reads (the traveller\'s head-v3 too), and the shadow lists keep each cascade\'s smallest caster', () => {
  const build = read('unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs');
  assert.match(build, /"characters\/traveller-v1\/head-v3", new\[\] \{ "model\.glb", "colors\.json", "hair-ink\.png" \}/);
  assert.match(read('unity/Hiraeth/Assets/Hiraeth/Rendering/HiraethFeature.cs'), /renderingLayerMask = HiraethShadows\.LayerOf\(plan\.cascade\)/);
  assert.match(read('unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethShadows.cs'), /CascadeLayer\[2\]/);
});

test('the Xbox at 1440p by default; the views and pictures of a plan in LocalState; -cull for the see-through test', () => {
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /else Screen\.SetResolution\(2560, 1440, FullScreenMode\.FullScreenWindow\)/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeArgs.cs'), /root \?\?= Application\.persistentDataPath/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs'), /cullTest == "off"/);
});

test('the Xbox\'s shadow maps draw only what each cascade holds, and V8 takes its flags (issue #113)', () => {
  const shadows = read('unity/Hiraeth/Assets/Hiraeth/Runtime/HiraethShadows.cs');
  const inst = read('unity/Hiraeth/Assets/Hiraeth/Runtime/Wildlife.cs');
  const pieces = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeShadowChunks.cs');
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  const renderer = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
  // the renderer lists culled by the view swept away from the sun too: ten planes at most, the far one at the cascade's reach
  assert.match(shadows, /if \(SweepCull\)/);
  assert.match(shadows, /q\.distance \+= Mathf\.Max\(0, -len \* Vector3\.Dot\(q\.normal, L\)\)/);
  assert.match(shadows, /plan\.reach\);/);
  assert.match(shadows, /p\.cullingMask = ~0u;/);
  assert.match(shadows, /InstMats\.CullAll\(c, IndexOf\(c\)\)/);
  // round the traveller (the brush's feet, mirrored back), as the web places them
  assert.match(runner, /GetGlobalVector\("_Brush"\); return b == Vector4\.zero \? \(Vector3\?\)null : new Vector3\(-b\.x, b\.y, b\.z\);/);
  // the instanced casters by instance, by their reach round their place; the whole set when the bounds are not known
  assert.match(inst, /rad\[i\] = meshR \* s \+ 0\.01f;/);
  assert.match(inst, /if \(!casts \|\| drawnAt != Time\.frameCount \|\| count <= 0 \|\| !boundsOk\) return;/);
  // the big meshes' pieces: their layout byte for byte, a layer the camera leaves out, every cascade; points moved: whole again
  assert.match(pieces, /m\.SetVertexBufferParams\(n, attrs\);/);
  assert.match(pieces, /public static float Cell = 128,/);
  assert.match(runner, /cam\.cullingMask &= ~\(1 << BridgeShadowChunks\.Layer\)/);
  assert.match(shadows, /if \(r\.gameObject\.layer == PieceLayer\) rad = float\.PositiveInfinity;/);
  assert.match(renderer, /if \(chunked\.Count > 0\) Unchunk\(md\);/);
  // V8's flags through the relinked DLL's own export, before the first engine
  assert.match(read('scripts/unity-uwp-v8-stubs.cpp'), /HiraethV8Flags\(const char\* flags\) \{ if \(flags\) v8::V8::SetFlagsFromString\(flags\); \}/);
  assert.match(runner, /void Boot\(byte\[\] code\)\s*\{\s*V8Flags\(\);/);
});
