// The Unity packages' size (issue #500, docs/systems/performance.md "What the Unity packages carry"): the project's
// shaders kept as preloaded assets rather than always included (always included, Unity wrote a dead copy of each into
// unity_builtin_extra: 19 MB of the APK), the Linux player packed without the build's leftovers, and the size tool's
// areas and rules (.claude/skills/perf-audit/unity-size.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { areaOf, summarise, problems, BUILTIN_EXTRA_MAX } from '../.claude/skills/perf-audit/unity-size.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SHADERS = 'unity/Hiraeth/Assets/Hiraeth/Shaders';

/** The project's shaders: name → guid (Shader "name" in the file, guid in its .meta). */
function projectShaders() {
  const out = new Map();
  for (const f of readdirSync(new URL(`../${SHADERS}`, import.meta.url)).filter((f) => f.endsWith('.shader'))) {
    const name = read(`${SHADERS}/${f}`).match(/^\s*Shader\s+"([^"]+)"/m)[1];
    const guid = read(`${SHADERS}/${f}.meta`).match(/^guid: ([0-9a-f]{32})$/m)[1];
    out.set(name, guid);
  }
  return out;
}
/** The guids of a YAML list of object references under `key:`. */
function refs(text, key) {
  const m = text.match(new RegExp(`^  ${key}:(?: \\[\\])?\\n((?:  - \\{[^\\n]*\\}\\n)*)`, 'm'));
  assert.ok(m, `${key} in the settings`);
  return [...m[1].matchAll(/guid: ([0-9a-f]{32}), type: (\d)/g)].map((r) => ({ guid: r[1], type: Number(r[2]) }));
}

test('none of the project\'s shaders is always included (Unity wrote a dead copy of each into unity_builtin_extra)', () => {
  const ours = new Set(projectShaders().values());
  const always = refs(read('unity/Hiraeth/ProjectSettings/GraphicsSettings.asset'), 'm_AlwaysIncludedShaders');
  assert.ok(always.length > 0, 'Unity\'s own stay');
  for (const r of always) assert.ok(!ours.has(r.guid) && r.type !== 3, `always included: ${r.guid}`);
});

test('every shader the game finds by name is preloaded, Unity\'s own (UI/Default) always included', () => {
  const shaders = projectShaders();
  const list = read('unity/Hiraeth/Assets/Hiraeth/Runtime/RuntimeShaders.cs').match(/Names = \{([^}]*)\}/)[1];
  const names = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const preloaded = new Set(refs(read('unity/Hiraeth/ProjectSettings/ProjectSettings.asset'), 'preloadedAssets').map((r) => r.guid));
  for (const n of names) {
    if (n === 'UI/Default') continue;
    assert.ok(shaders.has(n), `${n} is one of the project's shaders`);
    assert.ok(preloaded.has(shaders.get(n)), `${n} preloaded`);
  }
  // (and every Shader.Find of a project shader in the run-time code names one of them: a shader the build leaves out
  // draws nothing on a device)
  const runtime = ['unity/Hiraeth/Assets/Hiraeth/Runtime', 'unity/Hiraeth/Assets/Hiraeth/Rendering', 'unity/Hiraeth/Assets/HiraethJS/Runtime'];
  const found = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith('.cs')) for (const m of read(`${dir}/${e.name}`).matchAll(/Shader\.Find\("([^"]+)"\)/g)) found.add(m[1]);
    }
  };
  runtime.forEach(walk);
  assert.ok(found.size > 10);
  for (const n of found) if (shaders.has(n)) assert.ok(names.includes(n), `Shader.Find("${n}") is in RuntimeShaders.Names`);
});

test('the Linux player is packed without the build\'s leftovers (IL2CPP\'s C++ and symbols)', () => {
  const wf = read('.github/workflows/unity-android.yml');
  const linux = wf.slice(wf.indexOf('\n  linux:'));
  const step = linux.slice(linux.indexOf('- name: The Linux player packed'), linux.indexOf('- name: The unit suite passed'));
  assert.match(step, /--exclude=\*_BackUpThisFolder_ButDontShipItWithYourGame/);
  for (const line of step.split('\n').filter((l) => /tar .*-cf|tar czf/.test(l))) assert.match(line, /"\$\{skip\[@\]\}"/);
});

test('the size tool sorts a package into areas, and names what must not ship', () => {
  assert.equal(areaOf('assets/bin/Data/globalgamemanagers.assets.split12'), 'shaders and settings (globalgamemanagers.assets)');
  assert.equal(areaOf('bridge-linux/hiraeth-js_Data/Resources/unity_builtin_extra'), 'built-in resources (unity_builtin_extra)');
  assert.equal(areaOf('lib/arm64-v8a/libil2cpp.so'), 'game code (IL2CPP)');
  assert.equal(areaOf('bridge-linux/GameAssembly.so'), 'game code (IL2CPP)');
  assert.equal(areaOf('bridge-linux/hiraeth-js_BackUpThisFolder_ButDontShipItWithYourGame/GameAssembly.debug'), 'build leftovers (never to ship)');
  assert.equal(areaOf('assets/hiraeth-js/hiraeth.cjs'), 'JS bundle');
  assert.equal(areaOf('Data/StreamingAssets/hiraeth-js/public/music/title.mp3'), 'music');
  assert.equal(areaOf('assets/hiraeth-js/public/guardians/elder-v3/model.glb'), 'bodies, guardians and animations');
  assert.equal(areaOf('lib/arm64-v8a/libPapiV8.so'), 'V8 (Puerts)');
  assert.equal(areaOf('assets/hiraeth-pso/Vulkan.graphicsstate'), 'pipeline lists');

  const good = [
    { path: 'assets/bin/Data/Resources/unity_builtin_extra', bytes: 0.7 * 2 ** 20, packed: 0.3 * 2 ** 20 },
    { path: 'assets/hiraeth-js/hiraeth.cjs', bytes: 16 * 2 ** 20 },
  ];
  const s = summarise(good);
  assert.equal(s.files, 2);
  assert.equal(s.areas['JS bundle'].packed, 16 * 2 ** 20);
  assert.equal(s.packed, 16.3 * 2 ** 20);
  assert.deepEqual(problems(s, good), []);

  const bad = [
    { path: 'assets/bin/Data/Resources/unity_builtin_extra', bytes: BUILTIN_EXTRA_MAX + 1 },
    { path: 'bridge-linux/hiraeth-js_BackUpThisFolder_ButDontShipItWithYourGame/il2cppOutput/Il2CppInvokerTable.cpp', bytes: 2 ** 20 },
  ];
  const p = problems(summarise(bad), bad);
  assert.equal(p.length, 2);
  assert.match(p.join('\n'), /leftovers/);
  assert.match(p.join('\n'), /unity_builtin_extra/);
});
