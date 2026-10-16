// The Unity build on the Retroid, round 4 (issue #262; docs/systems/performance.md, "Unity on the Retroid: what the
// web leaves out far away, and the shadows' draws"): the engines leave out the small props past the preset's propFar
// as main.js does (its cullFar on the level's small props and the flora's; the big instanced sets main.js cuts into
// tiles, instance by instance in Unity), the shadow maps' casters go as renderer lists on Android too, and the bench
// reads what Unity drew (SetPass calls, triangles, vertices).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { tilesInstances, tileScene, QUALITY_PRESETS } from '../src/perf.js';
import { bundle } from '../scripts/engine-bundle.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** n boxes in a line `step` m apart, one InstancedMesh. */
function line(n, step, { dynamic = false } = {}) {
  const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), n);
  for (let i = 0; i < n; i++) m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * step, 0, 0));
  if (dynamic) m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return m;
}

test('tilesInstances: the sets tileScene cuts into tiles, and only those', () => {
  assert.equal(tilesInstances(line(400, 1)), true, '400 spread over 400 m');
  assert.equal(tilesInstances(line(400, 0.1)), false, 'all within 40 m: no tiles');
  assert.equal(tilesInstances(line(40, 10)), false, 'too few');
  assert.equal(tilesInstances(line(400, 1, { dynamic: true })), false, 'refilled every frame');
  assert.equal(tilesInstances(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())), false, 'not instanced');
  // (the same rule tileScene follows: what tilesInstances takes is cut, what it does not is left whole)
  const scene = new THREE.Scene(), cut = line(400, 1), kept = line(400, 0.1);
  scene.add(cut, kept);
  tileScene(scene);
  assert.equal(cut.count, 0, 'its instances moved into tiles');
  assert.ok(cut.children.length > 1);
  assert.equal(kept.count, 400);
});

test('the engine marks main.js\'s tiled sets with their distance and culls the small props past propFar each frame', () => {
  const g = read('engine/game.js');
  assert.match(g, /const PROP_TILE_REACH = 110 \* Math\.SQRT1_2;/);
  assert.match(g, /const small = farOn \? \[\.\.\.\(level\.smallProps \?\? \[\]\), \.\.\.\(flora\?\.small \?\? \[\]\)\] : \[\];/);
  assert.match(g, /if \(farOn && Q\?\.propFar\) scene\.traverse\(\(o\) => \{ if \(tilesInstances\(o\)\) o\.userData\.instancesFar = \(o\.userData\.drawFar \?\? Q\.propFar\) \+ PROP_TILE_REACH; \}\);/);
  // (hidden for the mirror's sync, then shown again, with what the small-prop culler hid)
  const frame = g.slice(g.indexOf('const hidden = Q?.propPx'), g.indexOf('setView(camera);'));
  assert.match(frame, /if \(Q\?\.propFar && small\.length\) cullFar\(small, camera, Q\.propFar, hidden\);/);
  assert.ok(frame.indexOf('cullFar(') < frame.indexOf('mirror.sync('), 'before the sync');
  assert.match(frame, /const stats = mirror\.sync\(scene, camera\);\n\s+for \(const o of hidden\) o\.visible = true;/);
  // (-js-off far: as before, a before-and-after on one build)
  assert.match(read('engine/unity/game.js'), /far: !off\.has\('far'\)/);
});

test('the distance reaches Unity: the mirror\'s desc, InstMats.far in the view and the shadow maps', () => {
  assert.match(read('engine/unity/backend.js'), /if \(o\?\.isInstancedMesh && o\.userData\?\.instancesFar > 0\) desc\.far = o\.userData\.instancesFar;/);
  const br = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
  assert.match(br, /n\.im = new InstMats\(md\.mesh, imat, 64\) \{ far = d\.F\("far"\) \};/);
  assert.match(br, /InstMats\.ViewEye = cam\.transform\.position;/);
  const w = read('unity/Hiraeth/Assets/Hiraeth/Runtime/Wildlife.cs');
  assert.match(w, /float x = d\.r0\.w - e\.x, y = d\.r1\.w - e\.y, z = d\.r2\.w - e\.z, F = far \+ rad\[i\];\n\s+return x \* x \+ y \* y \+ z \* z <= F \* F;/);
  assert.equal(w.split('bool keep = !cut || Near(i, ').length - 1, 2, 'in the view and in each cascade');
  assert.equal(w.split('bounds.SqrDistance(ViewEye) > far * far').length - 1, 2, 'a whole set past it: nothing');
});

test('the shadow maps\' casters as renderer lists on Android as on the Xbox; the bench reads Unity\'s SetPass calls and triangles', () => {
  const runner = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs');
  assert.match(runner, /#if \(UNITY_WSA \|\| UNITY_ANDROID\) && !UNITY_EDITOR\n\s+HiraethShadows\.UseRendererLists = !BridgeArgs\.Flag\("-shadow-draws"\);/);
  assert.match(runner, /RenderStatNames = \{ "SetPass Calls Count", "Triangles Count", "Vertices Count" \}/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs'), /public static string RenderStats\(\) => Ask\(\(\) => Runner \? Runner\.RenderStats\(\) : "\{\}"\);/);
  assert.match(read('engine/unity/game.js'), /res\.rs = JSON\.parse\(host\.RenderStats\?\.\(\) \?\? '\{\}'\);/);
});

test('in the desert at Handheld, the engine gives its big instanced sets their distance and none without it', async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-engine-far-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const B = loadBundle(file, { pads: () => [] });
  const quiet = async (fn) => { const k = ['warn', 'info', 'log', 'error'].map((x) => [x, console[x]]); for (const [x] of k) console[x] = () => {}; try { return await fn(); } finally { for (const [x, f] of k) console[x] = f; } };
  const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
  const run = async (far) => {
    const fars = [];
    const backend = new Proxy({ create: (id, d, o) => { if (o?.isInstancedMesh) fars.push(o.userData.instancesFar ?? 0); } }, { get: (t, k) => (k in t ? t[k] : UNSET.has(k) ? undefined : () => {}) });
    const g = await quiet(() => B.exports.createGame({ levelId: 'desert', backend, quality: 'handheld', far }));
    await quiet(() => { for (let i = 0; i < 3; i++) g.frame(1 / 30); });
    return fars;
  };
  const on = await run(true), off = await run(false);
  const want = QUALITY_PRESETS.handheld.propFar + 110 * Math.SQRT1_2;
  assert.ok(on.some((f) => Math.abs(f - want) < 1e-6), `a set left out past ${want.toFixed(1)} m (${on.filter((f) => f > 0).length} of ${on.length})`);
  assert.ok(on.every((f) => f === 0 || f >= want - 1e-6), 'no set closer than the preset says (drawFar only widens it here)');
  assert.ok(off.every((f) => f === 0), 'with far: false, none');
});
