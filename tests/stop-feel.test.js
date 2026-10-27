// The carried stop from a run as the default (issue #702, after #699's switch; src/loco-moves.js STOP_FEEL, stopSetting;
// src/player.js carryClear, crispStop): let go at a run on open ground, he carries on over a couple of braking strides; he
// still stops crisply, as before, where a carry would be wrong: an edge he would be carried off, a step or a flight he would
// be carried onto, the game taking the controls (a conversation, a cinematic: the input's crispStop), a doorway's walk
// handing them back (src/door-walk.js). The switch's old stored value (key 'hiraeth.stopFeel') is not read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { Player } from '../src/player.js';
import { stopSetting, stopPath } from '../src/loco-moves.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RUN = { KeyW: true, ShiftLeft: true }, DT = 1 / 60;
const box = (w, h, d, x, y, z) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(x, y, z));

/** A traveller on `meshes` run at a sprint toward -z for 1.5 s from z = 0, then let go (`input` while he stops). */
function runAndStop(meshes, { input = {}, feel, before } = {}) {
  const scene = new THREE.Scene();
  for (const m of meshes) scene.add(m);
  const physics = new Physics(scene);
  const p = new Player(physics, { spawn: v(0, 0, 0), health: false });
  if (feel) p.stopFeel = feel;
  for (let i = 0; i < 30; i++) p.update(DT, {}, 0);
  for (let i = 0; i < 90; i++) p.update(DT, RUN, 0);
  const at = p.pos.clone(), speed = Math.hypot(p.vel.x, p.vel.z);
  before?.(p);
  let t = 0;
  while (Math.hypot(p.vel.x, p.vel.z) > 0.05 && t < 3) { p.update(DT, input, 0); t += DT; }
  return { p, at, speed, dist: Math.hypot(p.pos.x - at.x, p.pos.z - at.z), t, as: p._stopAs };
}
// (the run lets go at z = -11.34, at 8.2 m/s)
const floor = () => box(40, 1, 60, 0, -0.5, 10);   // (z from -20 to 40)

test('everyone stops as Link does now: carried from a run on open ground; the old crisp stop on the switch', () => {
  const r = runAndStop([floor()]);
  assert.ok(r.speed > 8, `at a sprint (${r.speed.toFixed(2)} m/s)`);
  assert.equal(r.p.stopFeel, 'carry', 'the player\'s own default');
  assert.equal(r.as, 'carry');
  assert.ok(r.dist > 1.6 && r.dist < 2.4, `carried ${r.dist.toFixed(2)} m`);
  const snap = runAndStop([floor()], { feel: 'snap' });
  assert.ok(snap.dist < 0.5, `the old crisp stop still there (${snap.dist.toFixed(2)} m)`);
  // (the stop's distance as stopPath says it, what carryClear looks along)
  assert.ok(Math.abs(stopPath('carry', 8.2).d - r.dist) < 0.25, `stopPath ${stopPath('carry', 8.2).d.toFixed(2)} m`);
});

test('a ledge ahead: he stops crisply short of it, not carried off', () => {
  for (const below of [null, -3]) {
    // (the floor ends 1.3 m ahead of where he lets go: inside a carried stop, outside the crisp one)
    const meshes = [box(40, 1, 52.4, 0, -0.5, 13.8)];
    if (below !== null) meshes.push(box(40, 1, 40, 0, below - 0.5, -32.6));
    const r = runAndStop(meshes);
    assert.equal(r.as, 'snap', `${below === null ? 'over nothing' : 'a 3 m drop'}: the crisp stop`);
    assert.ok(r.p.pos.z > -12.6 && r.p.onGround && r.p.pos.y > -0.1, `still on the ledge (z ${r.p.pos.z.toFixed(2)}, y ${r.p.pos.y.toFixed(2)})`);
  }
  // and a far edge (past the carry's end) leaves the carry alone
  const far = runAndStop([box(40, 1, 56, 0, -0.5, 12)]);   // (the floor ends at z = -16: 4.7 m ahead)
  assert.equal(far.as, 'carry', 'an edge beyond the stop: carried');
});

test('stairs or a kerb ahead: crisp (carried onto a flight, the calf popped); a ramp ahead: carried', () => {
  const steps = [floor()];
  for (let k = 0; k < 8; k++) steps.push(box(40, 0.18 * (k + 1), 0.3, 0, 0.09 * (k + 1), -12 - 0.3 * k - 0.15));
  const up = runAndStop(steps);
  assert.equal(up.as, 'snap', 'a flight up ahead');
  const kerb = runAndStop([floor(), box(40, 0.15, 10, 0, 0.075, -17.5)]);
  assert.equal(kerb.as, 'snap', 'a 15 cm kerb ahead');
  // a 12° ramp up from 0.6 m ahead (its foot sunk in the floor)
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 12).translate(0, -0.5, -6).applyMatrix4(new THREE.Matrix4().makeRotationX(12 * Math.PI / 180)).translate(0, 0, -11.94));
  const r = runAndStop([floor(), ramp]);
  assert.equal(r.as, 'carry', 'up a ramp');
});

test('the controls taken (a conversation, a cinematic), a doorway\'s walk ending or locked on: the stop is crisp', () => {
  const taken = runAndStop([floor()], { input: { jumpBlocked: true, crispStop: true } });
  assert.equal(taken.as, 'snap');
  assert.ok(taken.dist < 0.5, `not carried into whoever he talks to (${taken.dist.toFixed(2)} m)`);
  const door = runAndStop([floor()], { before: (p) => { p.crispStop = true; } });
  assert.equal(door.as, 'snap', 'asked once, the stop is crisp');
  assert.ok(door.dist < 0.5);
  assert.equal(door.p.crispStop, false, 'and the ask spent');
  // asked while still steering (the stick pushed on through the doorway's end): the next stop is his own
  const on = runAndStop([floor()], { before: (p) => { p.crispStop = true; p.update(DT, RUN, 0); } });
  assert.equal(on.as, 'carry');
  // locked on (a step at the lock's pace, its feet the strafe's): crisp
  const locked = runAndStop([floor()], { before: (p) => { p.lockOn = { dir: v(0, 0, -1), at: v(0, 0, -40) }; } });
  assert.equal(locked.as, 'snap', 'locked on');
  // the game's own no-input and the door's end ask for it
  for (const f of ['src/main.js', 'engine/game.js']) assert.match(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /noInput = \{ jumpBlocked: true, crispStop: true \}/, f);
  assert.match(readFileSync(new URL('../src/door-walk.js', import.meta.url), 'utf8'), /this\.player\.crispStop = true/);
});

test('the setting: carry unless snap is chosen; the switch\'s old stored value is not read', () => {
  const mem = new Map();
  const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => mem.get(k) ?? null, setItem: (k, x) => mem.set(k, String(x)) } });
  try {
    assert.equal(stopSetting.get(), 'carry', 'nothing stored');
    mem.set('hiraeth.stopFeel', 'snap');   // (a device from before #702: the old switch turned off)
    assert.equal(stopSetting.get(), 'carry', 'the old key\'s snap is not kept');
    stopSetting.set('snap');
    assert.equal(mem.get('hiraeth.stop'), 'snap');
    assert.equal(stopSetting.get(), 'snap', 'chosen again: kept');
    stopSetting.set('carry');
    assert.equal(stopSetting.get(), 'carry');
  } finally {
    if (had) Object.defineProperty(globalThis, 'localStorage', had); else delete globalThis.localStorage;
  }
});
