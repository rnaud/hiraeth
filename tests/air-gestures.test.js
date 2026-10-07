// The captured jumps, drops, the wall kick, the stumble (src/air-moves.js) and the gestures (Player.gesture:
// kneeling for something low, petting the dog; src/interact.js gestureOf): when each comes, that the
// flight and the landing are the controller's as before, and that the kneel goes down and up again.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { course, traveller, drive } from './gait-sim.js';
import { AirMoves, AIR } from '../src/air-moves.js';
import { gestureOf, LOW } from '../src/interact.js';

const none = {};

/** What the air moves did over a script (each frame's kind), and the path. */
async function watch(script, { at = [0, 0, -60], moves = true, scene = course(), each = null } = {}) {
  const p = await traveller(scene, new THREE.Vector3(...at), { moves });
  const seen = [], up = p.update.bind(p);
  let t = 0;
  p.update = (dt, input, cam) => { each?.(p, t); up(dt, input, cam); t += dt; seen.push({ t, kind: p.airMoves?.state()?.kind ?? null, pos: p.pos.clone(), onGround: p.onGround }); };
  const r = drive(p, script);
  return { p, r, seen, kinds: [...new Set(seen.map((f) => f.kind).filter(Boolean))] };
}

test('a running jump flies the captured leap; a standing one lands as captured; the flight is the controller’s', async () => {
  const run = [[1, none], [1.2, { KeyW: true, ShiftLeft: true }], [0.05, { KeyW: true, ShiftLeft: true, Space: true }], [1.5, { KeyW: true, ShiftLeft: true }], [1, none]];
  const a = await watch(run), b = await watch(run, { moves: false });
  assert.deepEqual(a.kinds.filter((k) => k !== 'stumble'), ['run'], `the running jump (${a.kinds})`);
  assert.ok(a.seen.at(-1).pos.distanceTo(b.seen.at(-1).pos) < 1e-6, 'the same path as without');
  const still = await watch([[1, none], [0.05, { Space: true }], [2, none]]);
  assert.deepEqual(still.kinds, ['jump'], `standing: the captured landing (${still.kinds})`);
  const landT = still.seen.find((f, i) => i && f.onGround && !still.seen[i - 1].onGround)?.t;
  const first = still.seen.find((f) => f.kind === 'jump')?.t;
  assert.ok(Math.abs(first - landT) < 0.02, `it starts as he lands (${first?.toFixed(2)} s, landed ${landT?.toFixed(2)})`);
});

test('a drop off a ledge lands as captured; a hard landing at speed stumbles; kicking off a wall flies the captured kick', async () => {
  // a 3 m ledge: walk off it slowly
  const scene = course();
  const box = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6));
  box.position.set(0, 1.5, -60);
  scene.add(box); scene.updateMatrixWorld(true);
  const drop = await watch([[0.5, none], [2.5, { stick: { x: 0, y: 0.35 } }], [1.5, none]], { at: [0, 3, -58], scene });
  assert.ok(drop.kinds.includes('drop'), `walking off the ledge: the captured drop's landing (${drop.kinds})`);
  // a hard landing at speed (as off a roof at a run): dropped in at 20 m/s down while running
  const hard = await watch([[1, { KeyW: true, ShiftLeft: true }], [1.2, { KeyW: true, ShiftLeft: true }], [1, none]], {
    each: (p, t) => { if (Math.abs(t - 1) < 0.008) { p.pos.y += 6; p.vel.y = -20; p.onGround = false; } } });
  assert.ok(hard.kinds.includes('stumble'), `landing hard at a run: the stumble (${hard.kinds})`);
  // the wall kick, straight from the state the climb leaves
  const M = new AirMoves();
  M.update(1 / 60, { onGround: false, wallKick: true, free: true });
  assert.equal(M.cur?.kind, 'wall');
  for (let i = 0; i < 60; i++) M.update(1 / 60, { onGround: false, airT: i / 60, free: true });
  assert.ok(!M.cur || M.cur.t <= AIR.wall.to + 0.05, 'the kick plays out over its part of the clip');
});

test('off (the loops alone), or riding, gliding, swimming: none', async () => {
  const off = await watch([[1, none], [0.05, { Space: true }], [2, none]], { moves: false });
  assert.deepEqual(off.kinds, []);
  const M = new AirMoves();
  M.update(1 / 60, { onGround: false, jumped: true, speed: 5, free: false });
  assert.equal(M.cur, null);
});

test('what the body does as you use something: kneels for something low you pick up, pets the dog, nothing else', () => {
  const player = { pos: new THREE.Vector3(0, 0, 0), frame: { up: new THREE.Vector3(0, 1, 0) } };
  const at = (y) => () => new THREE.Vector3(1, y, 0);
  assert.equal(gestureOf({ prompt: 'pick up the feather', at: at(0.2) }, player), 'kneel');
  assert.equal(gestureOf({ prompt: () => 'pick a flower', at: at(1.0) }, player), 'kneel');
  assert.equal(gestureOf({ prompt: 'take Dun’s key off the hook', at: at(LOW + 0.6) }, player), null, 'high: no kneel');
  assert.equal(gestureOf({ prompt: 'pet Moustache', at: at(1.1) }, player), 'pet');
  assert.equal(gestureOf({ prompt: 'push the door open', at: at(0.5) }, player), null);
  assert.equal(gestureOf({ prompt: 'pick up the box', at: at(0.2), gesture: null }, player), null, 'an entry may say none');
});

test('the kneel goes down on one knee and up again; walking off ends it', async () => {
  const p = await traveller(course(), new THREE.Vector3(0, 0, -60), { moves: true });
  for (let i = 0; i < 60; i++) p.update(1 / 60, {}, Math.PI);
  const hip = () => p.humanoid.b.pelvis.getWorldPosition(new THREE.Vector3()).y;
  const stand = hip();
  assert.ok(p.gesture('kneel'), 'the clip is there');
  let low = stand;
  for (let i = 0; i < 100; i++) { p.update(1 / 60, {}, Math.PI); low = Math.min(low, hip()); }
  assert.ok(low < stand - 0.3, `down on one knee (the hips ${(stand - low).toFixed(2)} m lower)`);
  for (let i = 0; i < 60; i++) p.update(1 / 60, {}, Math.PI);
  assert.ok(!p._gesture && Math.abs(hip() - stand) < 0.06, `and up again (${hip().toFixed(2)} against ${stand.toFixed(2)})`);
  p.gesture('pet');
  for (let i = 0; i < 20; i++) p.update(1 / 60, {}, Math.PI);
  for (let i = 0; i < 40; i++) p.update(1 / 60, { KeyW: true }, Math.PI);
  assert.ok(!p._gesture, 'walking off: up and away');
});
