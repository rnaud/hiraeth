// Issue #795 (a gap left by #752: "at 2 m the furnace brute, bell and heron, and the warlord's glaive tip, can clip the
// top of the frame; rooms keep the close camera"). Locked on close to a tall foe fighting (its wind-ups raise its arms and
// its weapon), the camera keeps its whole body in the frame in the open, a raised weapon too, without pops or jumps; in a
// room it keeps the close camera but tips the view up and widens the lens, so the foe's head is in the frame where the
// room has height (src/lock-frame.js foeBox, LOCK_FRAME_FOE.room; CameraRig.fitFrame, roomTilt;
// scripts/camera-qc/sim-close.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LOCK_FRAME_FOE, foeBox, framePoints } from '../src/lock-frame.js';
import { closeLock } from '../scripts/camera-qc/sim-close.mjs';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pct = (x) => `${(x * 100).toFixed(1)} %`;

test('a foe\'s box: winding up, its top raised before the swing is; its last swing\'s reach let go over seconds, not at once', () => {
  let top = 2;
  const span = () => ({ _box: new THREE.Box3(V(-0.5, 0, -0.5), V(0.5, top, 0.5)) });
  const f = { pos: V(), chest: V(0, 1.4, 0), def: { radius: 0.6 }, model: { group: new THREE.Group() }, state: 'chase' };
  const out = { min: V(), max: V() };
  assert.equal(foeBox(f, f.pos, out, 0, span).max.y, 2);
  // (its wind-up starts, its arm not yet up: the box already stands `wind` of its height over it)
  f.state = 'wind';
  assert.ok(Math.abs(foeBox(f, f.pos, out, 0.1, span).max.y - 2 * (1 + LOCK_FRAME_FOE.wind)) < 1e-9);
  // (the club up over its head, higher than that: grown at once)
  top = 4;
  assert.equal(foeBox(f, f.pos, out, 0.2, span).max.y, 4);
  // (the blow done: shrunk by time, `hold` /s, still well over its rest 1 s on; back near it after 10 s)
  f.state = 'chase'; top = 2;
  let t = 0.2;
  for (; t < 1.2; t += 0.05) foeBox(f, f.pos, out, t, span);
  assert.ok(out.max.y > 3.2, `1 s on: ${out.max.y.toFixed(2)}`);
  for (; t < 11.2; t += 0.05) foeBox(f, f.pos, out, t, span);
  assert.ok(out.max.y < 2.2, `10 s on: ${out.max.y.toFixed(2)}`);
});

test('a room\'s tuning frames his chest and head, not his feet nor the floor', () => {
  const box = { min: V(-1, 0, -4), max: V(1, 5, -3), ground: 0 };
  const open = framePoints(V(), box, [], LOCK_FRAME_FOE), room = framePoints(V(), box, [], LOCK_FRAME_FOE.room);
  assert.equal(open.length, 17); assert.equal(room.length, 16);
  assert.ok(Math.min(...room.slice(0, 8).map((p) => p.y)) === LOCK_FRAME_FOE.room.from);
});

test('in the open, 1.5–3 m off a fighting brute, bell, heron and warlord: the whole of it in the frame, the camera smooth', () => {
  for (const kind of ['brute', 'bell', 'heron', 'warlord']) for (const d of [1.5, 2, 3]) {
    const c = closeLock(kind, d);
    // (before #795: 0.6–9.1 % of its bounds off the screen on average, 7–58 % of the frames cut, its top 1–45 %)
    assert.ok(c.off < 0.01, `${kind} ${d} m: ${pct(c.off)} of it off the screen`);
    assert.ok(c.cut < 0.06, `${kind} ${d} m: cut in ${pct(c.cut)} of the frames`);
    assert.ok(c.heads < 0.01, `${kind} ${d} m: its top off in ${pct(c.heads)} of the frames`);
    assert.ok(c.green, `${kind} ${d} m: ${c.fails.join('; ')}`);
    const m = c.measures;
    assert.equal(m.pops + m.jumps + m.lookJumps + m.spins, 0, `${kind} ${d} m: pops ${m.pops} jumps ${m.jumps} look ${m.lookJumps} spins ${m.spins}`);
    assert.ok(c.fovStep < 0.5 && c.fovMax <= LOCK_FRAME_FOE.fov + 1e-6, `${kind} ${d} m: the lens ${c.fovMax.toFixed(1)}°, ${c.fovStep.toFixed(2)}° a frame at most`);
  }
});

test('in a room (the Undertower\'s antechamber, 8.5 m high), 2 m off a fighting warlord and hulk: its head in the frame most of the time, he kept in it', () => {
  for (const [kind, heads] of [['warlord', 0.3], ['hulk', 0.1]]) {
    const c = closeLock(kind, 2, { where: 'room' });
    // (before: its top off in 78 % and 36 % of the frames)
    assert.ok(c.heads < heads, `${kind}: its top off in ${pct(c.heads)} of the frames`);
    assert.ok(c.measures.out < 0.035, `${kind}: he out of the frame ${pct(c.measures.out)}`);
    assert.ok(c.fovMax <= LOCK_FRAME_FOE.fov + 1e-6);
  }
});
