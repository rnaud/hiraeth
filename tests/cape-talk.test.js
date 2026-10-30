import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// "When Noir talks to me her cape is in front of her" (issue #782: Nour, the eldest of Qanat). In a conversation the one
// speaking gestures (src/talk-gesture.js): the arms come up and out in front. The arms' rule (the cloth goes out over a
// forearm or a hand, never between it and the body: cape.js OVER) carried the cloak's sides forward over every raised arm,
// and it hung in front of her as she talked. An arm out in front of the chest (CAPE_FRONT) now comes out through the
// cloak's open front: the cloth goes round it, and the cloak stays behind her.
const el = () => ({ classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, dataset: {}, remove() {}, addEventListener() {}, querySelector: () => null, appendChild() {}, set textContent(v) {}, set innerHTML(v) {} });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { resetDrapes } = await import('../src/cape.js');
const { CAPE_FRONT, CAPE_OVER } = await import('../src/humanoid.js');
const { NPC } = await import('../src/npc.js');
const { Physics } = await import('../src/physics.js');
const { PEOPLE } = await import('../src/story/desert-data.js');
const { talkGestures } = await import('../src/talk-gesture.js');
const { loadAssets } = await import('./gait-sim.js');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** How far ahead of her chest (m, along the way she faces) the cloak's cloth between her hips and her chest reaches. */
function ahead(npc) {
  npc.object.updateMatrixWorld(true); npc.cape.mesh.updateMatrixWorld(true);
  const inv = npc.object.matrixWorld.clone().invert(), chest = npc.humanoid.b.spine_03.getWorldPosition(V()).applyMatrix4(inv), P = npc.cape.p;
  let most = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    const q = V(P[i], P[i + 1], P[i + 2]).applyMatrix4(npc.cape.mesh.matrixWorld).applyMatrix4(inv);
    if (q.y > 0.45 && q.y < 1.3) most = Math.max(most, q.z - chest.z);
  }
  return most;
}

// (the gestures that threw it furthest: talking, the nods, the sigh, the surprise)
const GESTURES = ['talking_1', 'talking_3', 'relieved_sigh', 'head_nod_yes', 'surprised', 'arm_gesture'];

test('Nour talking, standing: her cloak stays behind her through her gestures (#782)', async (t) => {
  // (the same every run: the people's own little randomness drawn from a fixed seed)
  let seed = 7;
  const random = Math.random;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  t.after(() => { Math.random = random; });
  const { lib, human } = await loadAssets();
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100).rotateX(-Math.PI / 2)));
  scene.updateMatrixWorld(true);
  const physics = new Physics(scene);
  const player = { pos: V(0, 0, 1.8), vel: V(), riding: false, ride: null, wind: V() }, camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 3);
  const def = PEOPLE.nour;
  const make = () => {
    resetDrapes();
    const npc = new NPC(scene, physics, { route: [V()], def, kind: def.kind, cape: def.cape, palette: def.palette, head: def.head, look: def.look, world: 'desert', lines: def.lines, lib, human: human[def.kind] });
    npc.heading = 0;
    for (let f = 0; f < 120; f++) npc.update(1 / 60, player, camera);
    npc.talkTo = { speaking: true };
    return npc;
  };
  const done = (npc) => { npc.cape.dispose(scene); scene.remove(npc.object); };
  // at rest, talking with no gesture: how far the cloak's edges come round her
  const still = make();
  let rest = -Infinity;
  for (let f = 0; f < 180; f++) { still.update(1 / 60, player, camera); rest = Math.max(rest, ahead(still)); }
  done(still);
  const out = { rest: +rest.toFixed(2) };
  let sum = 0, freed = 0;
  for (const g of GESTURES) {
    const npc = make();
    let most = -Infinity, played = 0;
    for (let f = 0; f < 240; f++) {
      talkGestures.drive(npc.animator, { speaking: true, tone: 'neutral', key: 'k', text: '' });
      const T = npc.animator.talkGesture;
      if (T && !T.layers.some((L) => L.id === g)) { T.layers.length = 0; T.start(g, npc.animator, 1, 0); T.key = 'k'; }
      npc.update(1 / 60, player, camera);
      played = Math.max(played, npc.animator.talkGesture?.layers.find((L) => L.id === g)?.w ?? 0);
      most = Math.max(most, ahead(npc));
      // (an arm out ahead of her chest is one the cloth goes round, not out over)
      if (f % 30 === 29) for (const k of npc.humanoid.capsules()) if (k.arm && !k.over) freed++;
    }
    assert.ok(played > 0.5, `${g}: played`);
    out[g] = +most.toFixed(2);
    sum += most;
    done(npc);
  }
  const mean = sum / GESTURES.length;
  console.log('  Nour’s cloak ahead of her chest (m):', JSON.stringify(out), 'mean', mean.toFixed(2));
  assert.ok(freed > 0, 'her arms out in front come out through the cloak');
  // (before: 0.44-0.56 under these, 0.10 over its rest on average; the cloth's own swing adds a few cm either way)
  assert.ok(mean < rest + 0.08, `through her gestures the cloak keeps to her sides and back: ${mean.toFixed(2)} m ahead on average, ${rest.toFixed(2)} at rest`);
});

test('the arms the cloth goes over: only those not out in front of the chest (#782)', () => {
  assert.ok(CAPE_FRONT.ahead > 0.1 && CAPE_FRONT.ahead < 0.25, 'past the chest’s own depth, short of an arm held out');
  assert.ok(CAPE_OVER.test('lowerarm_l') && CAPE_OVER.test('hand_r'));
});
