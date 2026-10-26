import { relevantUnityInput } from '../scripts/unity-release-plan.mjs';
// Issue #493: the v2 traveller (the Blender rebuild, data/characters/traveller-v2/) in the engines. The page dresses him
// behind its switch (src/characters/traveller-v2.js); the engines' host (engine/game.js) does the same when asked
// (createGame({ traveller }): the Unity bridge's -traveller v2 -outfit <id>) or when the device keeps the switch on
// (travellerSetting, whose default stays B3 here). Unity reads his atlases encoded (engine/boot.js ENCODED_PICTURES), the
// shirt's thigh-lift keys as blend shapes and their weights each frame (the mirror's keyWeights, op 19), and a player
// carries the files (BridgeBuild.TravellerV2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './register-gadgets.js';
import { bundle } from '../engine/game-test-runtime.mjs';
import { loadBundle } from '../engine/game-test-runtime.mjs';
import { tempPath } from '../scripts/temp-dirs.mjs';
import { morphKeys, morphKeyDeltas } from '../engine/unity/backend.js';
import { holdGait, releaseGait } from '../engine/gait-hold.js';
import { travellerSetting } from '../src/characters/traveller-v2.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'noticed', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
/** A backend that keeps what the mirror tells it about drawables, geometries and shape-key weights. */
function recorder() {
  const R = { geos: new Map(), nodes: new Map(), weights: new Map() };
  R.backend = new Proxy({}, {
    get: (t, k) => {
      if (UNSET.has(k)) return undefined;
      if (k === 'geometry') return (gid, g, geo) => R.geos.set(gid, geo);
      if (k === 'create') return (id, d, o) => R.nodes.set(id, { ...d, o });
      if (k === 'keyWeights') return (id, w) => R.weights.set(id, Array.from(w));
      return () => {};
    },
  });
  return R;
}

let built = null;
const engine = () => (built ??= (async () => {
  const file = tempPath(join(tmpdir(), `hiraeth-traveller-v2-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  return loadBundle(file, { pads: () => [] }).exports;
})());
const FLAGS = { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 };

test('the engines follow the game\'s own switch when the host names none, and -traveller b3 / v2 when it does', async () => {
  const E = await engine();
  const host = read('engine/game.js');
  assert.match(host, /const ask = traveller \?\? travellerSetting\.get\(''\);/, 'the device\'s switch when the host names none');
  assert.match(host, /outfit: traveller\?\.outfit \?\? \(gameState\.flag\(OUTFIT_KEY\) \? chosenOutfit\(gameState\)/, 'the Wardrobe\'s outfit unless the host names one (main.js)');
  assert.match(host, /loadTraveller\('', \{ v2: v2Ask \}\)/);
  assert.match(host, /wireWardrobe\(\{ game: gameState, kit, tool, player, dress: \(\) => player\.character\?\.v2 \?\? null \}\)/, 'the Wardrobe dresses v2 in the engines');
  // (whatever the game's default is today: B3, or v2 once the switch is turned)
  const byDefault = travellerSetting.get('').on;
  const g = await quietly(() => E.createGame({ levelId: 'desert', backend: recorder().backend, people: false, flags: FLAGS }));
  assert.equal(!!g.player.character.v2, byDefault, `the default: ${byDefault ? 'v2' : 'B3'}`);
  const b3 = await quietly(() => E.createGame({ levelId: 'desert', backend: recorder().backend, people: false, flags: FLAGS, traveller: { on: false } }));
  assert.equal(b3.player.character.v2, undefined, 'asked for B3');
  assert.equal(b3.player.character.mesh.visible, true, 'his B3 body');
});

test('asked for v2: dressed on his skeleton, B3 away, the atlas kept encoded for Unity, its albedo turned to display values', async () => {
  const E = await engine(), R = recorder();
  const g = await quietly(() => E.createGame({ levelId: 'desert', backend: R.backend, people: false, flags: FLAGS, traveller: { on: true, outfit: 'default' } }));
  const ch = g.player.character, W = ch.v2?.wardrobe;
  assert.ok(W, 'the wardrobe on him');
  assert.equal(W.worn.id, 'default');
  assert.equal(ch.mesh.visible, false, 'B3\'s body put away');
  assert.equal(W.meshes.length, 2, 'two draws: the body with his skin, the clothes');
  for (const m of W.meshes) {
    assert.equal(m.skeleton, ch.humanoid.body.skeleton, `${m.name}: on his own skeleton`);
    assert.equal(m.material.userData.albedoLinear, true, `${m.name}: the ink's display values (port-format toDisplay)`);
    const map = m.material.uniforms.uMap.value;
    assert.ok(map?.userData?.encoded?.bytes?.length > 100000 && /jpe?g/.test(map.userData.encoded.mime), `${m.name}: the atlas kept encoded`);
  }
  assert.deepEqual(Object.keys(W.meshes[1].morphTargetDictionary), ['thighLift_l', 'thighLift_r']);
  // the pearl diver: an outfit's own GLB and atlas
  const P = await quietly(() => E.createGame({ levelId: 'desert', backend: recorder().backend, people: false, flags: FLAGS, traveller: { on: true, outfit: 'pearl-diver' } }));
  assert.equal(P.player.character.v2.wardrobe.worn.id, 'pearl-diver');
  for (const m of P.player.character.v2.wardrobe.meshes) assert.equal(m.material.userData.albedoLinear, true, `${m.name}: display values`);
  // the outfit chosen in the Wardrobe (issue #571), worn as the world loads, as on the page; the Wardrobe dresses him
  const M = await quietly(() => E.createGame({ levelId: 'desert', backend: recorder().backend, people: false, flags: { ...FLAGS, 'wardrobe.outfit': 'moss-gardener' }, traveller: { on: true } }));
  assert.equal(M.player.character.v2.wardrobe.worn.id, 'moss-gardener');
});

test('the thigh-lift keys reach Unity as blend shapes, their weights each frame from his thighs (op 19)', async () => {
  const E = await engine(), R = recorder();
  // (his own clothes named: the VM's save keeps the Wardrobe's choice from the test before)
  const g = await quietly(() => E.createGame({ levelId: 'desert', backend: R.backend, people: false, flags: FLAGS, traveller: { on: true, outfit: 'default' } }));
  assert.equal(g.player.character.v2.wardrobe.worn.id, 'default', 'a named outfit wins over the Wardrobe\'s');
  const p = g.player.pos.clone(), clothes = g.player.character.v2.wardrobe.meshes[1];
  // held at a jog with his left thigh swung well forward (engine/gait-hold.js), then standing
  g.pin({ eye: [p.x + 3, p.y + 1.4, p.z], target: [p.x, p.y + 1, p.z], player: p.toArray(), heading: g.player.heading, gait: { gait: 'jog', phase: 0.6 } });
  await quietly(() => { for (let i = 0; i < 6; i++) g.frame(1 / 30); });
  const id = [...R.nodes].find(([, d]) => d.o === clothes)?.[0];
  assert.ok(id !== undefined, 'the clothes a drawable of the mirror');
  const keys = morphKeyDeltas(morphKeys(R.geos.get(R.nodes.get(id).gid)), clothes.geometry.attributes.position.count);
  const u = new Uint32Array(keys);
  assert.equal(u[0] & 0x7fffffff, 2, 'two blend shapes');
  assert.ok(u[0] & 0x80000000, 'with their normals\' offsets (morphAttributes.normal), as the page bends the shading');
  assert.ok(u[2] > 500, `the left key moves ${u[2]} verts`);
  const jog = R.weights.get(id);
  assert.ok(jog && jog[0] > 0.3, `the left key on at the jog (${jog})`);
  g.pin({ eye: [p.x + 3, p.y + 1.4, p.z], target: [p.x, p.y + 1, p.z], player: p.toArray(), heading: g.player.heading, gait: { gait: 'idle', phase: 0 } });
  await quietly(() => { for (let i = 0; i < 6; i++) g.frame(1 / 30); });
  assert.deepEqual(R.weights.get(id), [0, 0], 'both off standing');
});

test('a held gait: the Animator kept in one loop at one phase, whatever time passes; released, its own again', () => {
  const calls = [];
  const a = { w: { idle: 1, walk: 0, jog: 0, sprint: 0, air: 0 }, phase: 0.9, lib: { native: { jog: 3.2 } }, clips: {}, actions: {}, update(dt, s) { calls.push([dt, s.speed]); } };
  const own = a.update, player = { animator: a };
  assert.equal(holdGait(player, { gait: 'jog', phase: 0.6 }), true);
  a.w.idle = 0.5; a.phase = 0.1;
  a.update(0.5, { speed: 0 });
  assert.deepEqual(a.w, { idle: 0, walk: 0, jog: 1, sprint: 0, air: 0 });
  assert.equal(a.phase, 0.6);
  assert.deepEqual(calls, [[0, 3.2]], 'no time, the jog\'s own speed');
  releaseGait(player);
  assert.equal(a.update, own);
  assert.equal(holdGait(player, { gait: 'swim' }), false);
});

test('Unity: the bridge carries the files, asks for v2 by -traveller, reads data/ beside public/, counts its draw calls', () => {
  const build = read('unity/Hiraeth/Assets/HiraethJS/Editor/BridgeBuild.cs');
  assert.match(build, /TravellerV2\(\);\s*Music\(\);/, 'said with every player');
  // (the bundle's step writes what the web build ships, at the paths the game fetches, into the players' StreamingAssets)
  const bundler = read('scripts/engine-bundle.mjs');
  assert.match(bundler, /const v = await unityTravellerV2\(\);/);
  assert.match(bundler, /shippedFiles\(ROOT\)/);
  assert.ok(relevantUnityInput('data/characters/traveller-v2/outfits.json'), 'daily Unity planner includes model changes');
  assert.match(read('.github/workflows/unity-android.yml'), /node scripts\/unity-release-plan\.mjs/, 'daily workflow uses the tested input planner');
  for (const w of ['unity-android', 'unity-xbox']) assert.match(read(`.github/workflows/${w}.yml`), /workflow_dispatch:/, `${w}: manual builds remain available`);
  const outfits = JSON.parse(read('data/characters/traveller-v2/outfits.json'));
  assert.equal(outfits.outfits.filter((o) => o.dir).length, 15, 'the fifteen outfits beside the base');
  const args = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeArgs.cs');
  assert.match(args, /args\["traveller"\] = Arg\("-traveller"\)/);
  assert.match(args, /args\["outfit"\] = Arg\("-outfit"\)/);
  assert.match(read('engine/unity/game.js'), /traveller: args\.traveller \? \{ on: args\.traveller === 'v2', outfit: args\.outfit \?\? null \} : null/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHost.cs'), /path\.StartsWith\("data\/"\)/);
  assert.match(read('engine/boot.js'), /ENCODED_PICTURES = \[[^\]]*'characters\/traveller-v2\/'/);
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRunner.cs'), /"Draw Calls Count"/);
  // (a model's decoded picture lets go of its CPU copy once uploaded: the atlas is 4096 × 2048)
  const R = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
  assert.match(R, /Texture\(tid, top, top\.Length, w, h, flags \| 16\);/);
  assert.match(R, /t\.Apply\(mips, once\);/);
});
