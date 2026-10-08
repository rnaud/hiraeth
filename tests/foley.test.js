import test from 'node:test';
import assert from 'node:assert/strict';
import { BodyFoley, FOLEY } from '../src/foley.js';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const body = (o = {}) => ({ onGround: true, vel: v(), pos: v(), frame: { up: v(0, 1, 0) }, stamina: 1, ...o });
const recorder = () => { const heard = []; const s = new Proxy({}, { get: (_, k) => (arg) => heard.push([k, arg]) }); return { s, heard }; };
const run = (f, p, frames, dt = 1 / 60) => { for (let i = 0; i < frames; i++) f.update(p, dt); };

test('a jump and its landing, scaled by the fall', () => {
  const { s, heard } = recorder();
  const f = new BodyFoley(s, { rand: () => 0.99 });
  const p = body();
  run(f, p, 2);
  Object.assign(p, { onGround: false, vel: v(0, 9, 0) }); run(f, p, 1);
  assert.equal(heard[0][0], 'jump');
  assert.equal(heard[0][1].breath, false, 'no breath on this one');
  p.vel = v(0, -12, 0); run(f, p, 30);
  Object.assign(p, { onGround: true, vel: v() }); run(f, p, 1);
  assert.equal(heard[1][0], 'land');
  assert.ok(Math.abs(heard[1][1].speed - 12) < 1e-9);
});

test('a step down a kerb is not a landing; a mantle\'s end is not one either', () => {
  const { s, heard } = recorder();
  const f = new BodyFoley(s);
  const p = body();
  run(f, p, 2);
  Object.assign(p, { onGround: false, vel: v(0, -1, 0) }); run(f, p, 3);
  Object.assign(p, { onGround: true, vel: v() }); run(f, p, 1);
  assert.deepEqual(heard, []);
  Object.assign(p, { onGround: false, mantle: {}, vel: v(0, -5, 0) }); run(f, p, 30);
  Object.assign(p, { onGround: true, mantle: null }); run(f, p, 1);
  assert.deepEqual(heard.map((h) => h[0]), ['mantle']);
});

test('breaths are occasional: never two within the gap, more likely winded', () => {
  const f = new BodyFoley(null, { rand: () => 0 });
  assert.equal(f.breathe(0.1), true);
  assert.equal(f.breathe(1), false, 'too soon');
  f.t += FOLEY.breathGap + 0.1;
  assert.equal(f.breathe(1), true);
  const g = new BodyFoley(null, { rand: () => 0.5 });
  assert.equal(g.breathe(0.2, 1), false, 'rested: a fifth of the time');
  assert.equal(g.breathe(0.2, 0), true, 'winded: more often');
});

test('the climb, the wings, the jets, the roll, a knockdown and getting up', () => {
  const { s, heard } = recorder();
  const f = new BodyFoley(s, { rand: () => 0 });
  const p = body();
  run(f, p, 2);
  p.climbing = true; run(f, p, 1);
  p.climbing = false; p.mantle = {}; run(f, p, 1);
  p.mantle = null; p.onGround = false; p.gliding = true; run(f, p, 1);
  p.gliding = false; run(f, p, 1);   // (too soon after opening: not heard)
  run(f, p, 30); p.gliding = true; run(f, p, 1);
  p.thrusting = true; run(f, p, 1);
  p.thrusting = false; p.gliding = false; p.onGround = true; run(f, p, 30);
  p.combatMotion = { evade: 0.1 }; run(f, p, 1);
  p.combatMotion = null; p.down = { phase: 'fall' }; run(f, p, 1);
  p.down.phase = 'rise'; run(f, p, 1);
  const names = heard.map((h) => h[0]);
  assert.deepEqual(names.filter((n) => n !== 'land' && n !== 'wings'), ['grab', 'mantle', 'jets', 'evade', 'knockdown', 'getUp']);
  // (a fold straight after opening is not heard: the wings never flap faster than FOLEY.flapGap)
  assert.deepEqual(heard.filter((h) => h[0] === 'wings').map((h) => h[1].open), [true, true]);
  assert.ok(heard.find((h) => h[0] === 'getUp')[1].sigh);
});

test('riding, swimming or lying down: no jump or landing sounds', () => {
  const { s, heard } = recorder();
  const f = new BodyFoley(s);
  const p = body({ ride: {} });
  run(f, p, 2);
  Object.assign(p, { onGround: false, vel: v(0, 8, 0) }); run(f, p, 20);
  Object.assign(p, { onGround: true, vel: v() }); run(f, p, 1);
  p.ride = null; p.swim = {};
  Object.assign(p, { onGround: false, vel: v(0, 8, 0) }); run(f, p, 20);
  Object.assign(p, { onGround: true, vel: v(0, -9, 0) }); run(f, p, 1);
  assert.deepEqual(heard, []);
});
