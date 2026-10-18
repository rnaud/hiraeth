// The lists of GPU pipelines (BridgePso): the Steam Deck's (docs/systems/performance.md "The Steam Deck, round 14",
// docs/steam-deck.md "The pipeline list") and Android's ("Unity on the Retroid, round 7"), the traced collections
// shipped with the Linux player and the APK, warmed on the job
// system's workers at the load. Unity finds each variant by its shader's name and asset GUID, its pass and its keyword
// names, so the list stays good from build to build until one of those changes: this checks they all still exist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const LIST = 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-pso/Vulkan.graphicsstate';
const ANDROID = 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-pso/Android/Vulkan.graphicsstate';
const XBOX = 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-pso/Direct3D12.graphicsstate';

/** every .shader under the project's Assets: its name, its .meta's GUID, the keywords its pragmas declare */
function projectShaders() {
  const out = new Map();
  const walk = (dir) => {
    for (const f of readdirSync(new URL(dir, ROOT))) {
      const p = `${dir}/${f}`;
      if (statSync(new URL(p, ROOT)).isDirectory()) { if (f !== 'StreamingAssets') walk(p); continue; }
      if (!f.endsWith('.shader')) continue;
      const src = read(p), name = src.match(/^\s*Shader\s+"([^"]+)"/m)?.[1];
      if (!name) continue;
      const guid = read(`${p}.meta`).match(/^guid: (\w+)/m)?.[1];
      const kws = new Set();
      for (const m of src.matchAll(/#pragma\s+(?:multi_compile|shader_feature)\w*\s+([^\n]+)/g)) for (const k of m[1].trim().split(/\s+/)) kws.add(k);
      out.set(name, { path: p, guid, kws });
    }
  };
  walk('unity/Hiraeth/Assets');
  return out;
}

test('the Deck\'s pipeline list is the Linux player\'s Vulkan collection, with the Surface shader\'s lean variants in it', () => {
  const c = JSON.parse(read(LIST));
  assert.equal(c.m_DeviceRenderer, 21, 'Vulkan (GfxDeviceRenderer 21)');
  assert.equal(c.m_RuntimePlatform, 13, 'RuntimePlatform.LinuxPlayer');
  const v = c.m_VariantInfoMap.map((x) => x.second);
  const states = v.reduce((n, x) => n + x.graphicsStateInfoSet.length, 0);
  assert.ok(states >= 100, `${states} states: every world's (round 14 traced 113+)`);
  const surface = v.filter((x) => x.shaderName === 'Hiraeth/Surface');
  for (const k of ['HIRAETH_LEAN', 'HIRAETH_LEAN_TERRAIN', 'HIRAETH_LEAN_WATER', 'HIRAETH_SKIN', 'HIRAETH_PREPASS'])
    assert.ok(surface.some((x) => x.keywordNames.split(' ').includes(k) && x.graphicsStateInfoSet.length), k);
});

test('Android\'s pipeline list is the APK\'s Vulkan collection, with the slim and plain lean variants it draws', () => {
  const c = JSON.parse(read(ANDROID));
  assert.equal(c.m_DeviceRenderer, 21, 'Vulkan (GfxDeviceRenderer 21)');
  assert.equal(c.m_RuntimePlatform, 11, 'RuntimePlatform.Android');
  const v = c.m_VariantInfoMap.map((x) => x.second);
  const states = v.reduce((n, x) => n + x.graphicsStateInfoSet.length, 0);
  assert.ok(states >= 100, `${states} states: every world's`);
  const surface = v.filter((x) => x.shaderName === 'Hiraeth/Surface');
  for (const k of ['HIRAETH_LEAN', 'HIRAETH_LEAN_SLIM', 'HIRAETH_LEAN_TERRAIN', 'HIRAETH_LEAN_WATER', 'HIRAETH_PLAIN', 'HIRAETH_SKIN', 'HIRAETH_PREPASS'])
    assert.ok(surface.some((x) => x.keywordNames.split(' ').includes(k) && x.graphicsStateInfoSet.length), k);
});

test('BridgePso finds Android\'s list in its own folder and reads it out of the APK first', () => {
  const pso = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgePso.cs');
  assert.match(pso, /Application\.platform == RuntimePlatform\.Android \? "Android" : ""/);
  assert.match(pso, /Application\.platform == RuntimePlatform\.Android && !BridgeArgs\.Flag\("-pso"\) && BridgeArgs\.Arg\("-pso-file"\) == null/,
    'warmed on Android only with -pso: a cold load froze in one 7.5-10 s frame for no stall removed (round 7)');
  assert.match(pso, /file\.Contains\(":\/\/"\)[\s\S]*UnityWebRequest\.Get\(file\)[\s\S]*File\.WriteAllBytes\(copy/, 'StreamingAssets is a jar: URL on Android, which File.Exists cannot see');
});

test('the slim lean variants are built into Android\'s players only, and given only where no interpolator they drop is read', () => {
  const strip = read('unity/Hiraeth/Assets/HiraethJS/Editor/BridgeShaderStrip.cs');
  assert.match(strip, /activeBuildTarget == BuildTarget\.Android/);
  assert.match(strip, /new ShaderKeyword\(shader, "HIRAETH_LEAN_SLIM"\)/);
  const r = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
  assert.match(r, /static bool Slim\(Material m, int mode\) => mode != 4 && mode != 6 && F\(m, "_Folds"\) <= 0 && F\(m, "_Creases"\) <= 0\s*&& F\(m, "_MapOn"\) <= 0\.5f && F\(m, "_FormOn"\) <= 0\.5f/);
  assert.match(r, /DisableKeyword\("HIRAETH_LEAN_SLIM"\)/, 'a crowd\'s copy leaves the slim variant: its trims read the bind');
  // (round 7 on the Retroid: slim on the instances' and the grass's copies faults the Adreno; slim with HIRAETH_PLAIN stalls ~330 ms again and again)
  assert.match(r, /var c = new Material\(m\); if \(slimNoCopies\) Unslim\(c\);/);
  assert.match(r, /slimNoCopies = true/);
  assert.match(r, /slim && \(!plainOk \|\| slimOnPlain\) && Slim\(m, mode\)/);
  const s = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
  // (every read and write of the three goes through the macros, which the slim variants point elsewhere)
  assert.doesNotMatch(s, /\b[io]\.(bind|fold|form)\b(?!\s*$)/m, 'o.bind / i.form…: through O_BIND / I_FORM…');
  for (const f of ['fold : TEXCOORD7', 'bind : TEXCOORD9', 'form : TEXCOORD12']) assert.match(s, new RegExp(`#if !defined\\(SLIMV\\)\\s*float\\d ${f}`));
});

for (const [who, file] of [['the Deck\'s', LIST], ['Android\'s', ANDROID], ['the Xbox\'s', XBOX]])
test(`every variant in ${who} list still names a shader, GUID and keywords the project has (else: trace it again)`, () => {
  const shaders = projectShaders();
  const c = JSON.parse(read(file));
  for (const { second: x } of c.m_VariantInfoMap) {
    const s = shaders.get(x.shaderName);
    if (!s) { assert.match(x.shaderName, /^(UI\/Default|Hidden\/Internal|Hidden\/TextCore\/|Hidden\/Universal\/)/, `${x.shaderName}: no such shader in the project (renamed? docs/steam-deck.md, "The pipeline list")`); continue; }
    assert.equal(x.shaderAssetGUID, s.guid, `${x.shaderName}: its GUID (${s.path}.meta) changed`);
    for (const k of x.keywordNames.split(' ').filter(Boolean)) assert.ok(s.kws.has(k), `${x.shaderName}: keyword ${k} is no longer declared`);
  }
});

test('BridgePso warms the shipped list on the workers, only on the platform and API it was traced on, once the script\'s engine is made', () => {
  const pso = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgePso.cs');
  assert.match(pso, /\.WarmUp\(default\(JobHandle\)\)/);
  assert.match(pso, /c\.graphicsDeviceType != SystemInfo\.graphicsDeviceType/);
  assert.match(pso, /c\.runtimePlatform != Application\.platform/, 'the APK (Vulkan too) leaves the Linux player\'s list');
  assert.match(pso, /if \(pending != null && engineMade\) Warm\(\)/, 'the main thread waits for the warm-up: the engine, made through it, first');
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs'), /BridgePso\.Tick\(thread == null \|\| scriptEnvMade\.IsSet\)/);
  assert.match(pso, /BridgeArgs\.Arg\("-pso-file"\) \?\? Shipped/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs'), /BridgePso\.Exit\(\);/, 'the trace saved at the exit');
});
