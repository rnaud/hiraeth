// The light presets' levers for a CPU-bound main thread (issue #111, docs/systems/performance.md "The Steam Deck,
// round 11"): people out of view and past 30 m moved a quarter of the frames (npc.js offView), the scene's matrices
// stepping over hidden subtrees (engine/scene-matrices.js skipHidden, its catch-up tested in scene-matrices.test.js),
// and the near shadow map's refresh rule (shadows.js nearDue / farDue).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { QUALITY_PRESETS } = await import('../src/perf.js');
const { nearDue, farDue } = await import('../src/shadows.js');

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function person() {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2)));
  const npc = new NPC(scene, new Physics(scene), { route: [V(0, 0, 0), V(0, 0, 40)], lines: ['~neutral~ …'], world: 'desert' });
  const player = { pos: V(0, 0, -20), vel: V(), riding: false, ride: null, wind: V() };
  const camera = new THREE.PerspectiveCamera();
  return { npc, player, camera };
}

/** How many of n frames of dt moved the person's clock on. */
function frames(p, n, dt = 1 / 60) {
  let moved = 0;
  for (let f = 0; f < n; f++) { const t0 = p.npc.time; p.npc.update(dt, p.player, p.camera); if (p.npc.time !== t0) moved++; }
  return moved;
}

test('a person out of view past 30 m is moved a quarter of the frames, and takes the time missed at once back in view', () => {
  const p = person();
  p.camera.position.set(0, 2, -40);   // (40 m off)
  frames(p, 8);
  p.npc.offView = true;
  const t0 = p.npc.time;
  assert.equal(frames(p, 40), 10, 'a quarter of the frames');
  assert.ok(Math.abs(p.npc.time - t0 - 40 / 60) < 1e-9, 'with the time of the frames it missed');
  // in view again: every frame, and what it had not taken yet taken the first frame
  frames(p, 3);
  p.npc.offView = false;
  const t1 = p.npc.time, skipped = p.npc._acc;
  assert.ok(skipped > 0, 'some time not taken yet');
  assert.equal(frames(p, 8), 8, 'every frame in view');
  assert.ok(Math.abs(p.npc.time - t1 - 8 / 60 - skipped) < 1e-9, 'the missed time taken back');
});

test('out of view but within 30 m, or with no game loop setting offView (unset), a person moves every frame', () => {
  const p = person();
  p.camera.position.set(0, 2, -15);
  p.npc.offView = true;
  assert.equal(frames(p, 20), 20, 'near: every frame, seen or not (their shadow, a turn of the camera)');
  const q = person();
  q.camera.position.set(0, 2, -40);
  assert.equal(frames(q, 20), 20, 'offView unset: every frame');
});

test('the Steam Deck preset takes the levers; main.js sets offView from the preset and the view, and skips hidden matrices by it', () => {
  const D = QUALITY_PRESETS.deck;
  assert.equal(D.peopleLod, true);
  assert.equal(D.skipHidden, true);
  for (const k of ['high', 'medium', 'auto']) {
    assert.ok(!QUALITY_PRESETS[k].peopleLod && !QUALITY_PRESETS[k].skipHidden, `${k}: every person every frame, every matrix`);
  }
  // (the Handheld too, the people's alone: issue #450)
  assert.equal(QUALITY_PRESETS.handheld.peopleLod, true, 'handheld: people out of view past 30 m at a quarter of the frames');
  assert.ok(!QUALITY_PRESETS.handheld.skipHidden, 'handheld: every matrix');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /n\.offView = peopleLod \? !inViewNow\(peopleView, n\.pos, /);
  assert.match(main, /const peopleView = peopleLod \? viewNow\(camera\) : null;/);
  assert.match(main, /updateSceneMatrices\(scene, !!preset\.skipHidden\)/);
  // (the catch-up after everything that shows things before the draws, and before the still batches copy matrices)
  const at = (s) => main.indexOf(s);
  assert.ok(at('catchUpShown(scene);') > at('skinnedLods.update(camera'), 'after the bodies\' levels of detail');
  assert.ok(at('catchUpShown(scene);') > at('emptyInstances.hide(frameHidden);'), 'after the cullers');
  assert.ok(at('statics?.update(renderer);') > at('catchUpShown(scene);'), 'before the still batches read the matrices');
  assert.ok(at('catchUpShown(scene);') < at('if (heroOn) heroPass();'), 'before the first pass');
});

test('the near shadow map: every n-th frame, at once on a turn of the sun or out of the kept view; the far map never on its frame', () => {
  const never = () => { throw new Error('asked when not needed'); };
  for (const every of [1, 2, 3, 4]) {
    for (let f = 0; f < 48; f++) assert.equal(nearDue(f, every, false, () => false), f % every === 0, `every ${every}, frame ${f}`);
    assert.equal(nearDue(1, every, true, never), true, 'the sun turned: drawn');
  }
  assert.equal(nearDue(1, 3, false, () => true), true, 'the camera left the view the map was culled for: drawn');
  assert.equal(nearDue(1, 1, false, never), true, 'not kept: drawn every frame, the view never asked');
  assert.equal(nearDue(0, 4, false, never), true, 'its frame: not asked');
  // a kept near map (nearEvery > 1, none of the presets since issue #492): the far map's frame never the near map's
  for (const P of [{ nearEvery: 2, farEvery: 4 }, { nearEvery: 4, farEvery: 8 }]) {
    const both = [];
    for (let f = 0; f < 240; f++) if (nearDue(f, P.nearEvery) && farDue(f, P.nearEvery, P.farEvery)) both.push(f);
    assert.deepEqual(both, [], `near every ${P.nearEvery}, far every ${P.farEvery}`);
  }
});

test('the near map every frame on every preset, in a fight or not: the foes\' shadows keep to their feet (issue #492)', () => {
  for (const [k, P] of Object.entries(QUALITY_PRESETS)) {
    for (let f = 0; f < 64; f++) assert.equal(nearDue(f, P.nearEvery, false, () => false), true, `${k}, frame ${f}`);
    // (the far map still comes round: every farEvery-th frame)
    let far = 0;
    for (let f = 0; f < 240; f++) if (farDue(f, P.nearEvery, P.farEvery, false, () => false)) far++;
    assert.equal(far, 240 / P.farEvery, k);
  }
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const nearEvery = preset\.nearEvery;/);
  assert.doesNotMatch(main, /nearFight|nearEveryNow/);
  // (and Unity's presets, the same schedule: unity/.../Quality.cs)
  const unity = readFileSync(new URL('../unity/Hiraeth/Assets/Hiraeth/Runtime/Quality.cs', import.meta.url), 'utf8');
  const counts = [...unity.matchAll(/nearEvery = (\d+);/g)].map((m) => +m[1]);
  assert.ok(counts.length >= 4, 'every Unity preset sets its count');
  assert.deepEqual([...new Set(counts)], [1], 'Unity: the near map every frame on every preset');
});
