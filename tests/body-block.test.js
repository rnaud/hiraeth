// You can't walk through a foe (src/foes.js BODY_BLOCK, Foes.keepOff; v1.41, the author: "the player can't walk through
// enemies"): pushed out of its body, your speed into it taken away; a light one gives way. Since v2.35 (issue #751, "I
// shouldn't be able to clip through enemies") an evade, a roll, a dash cut and a hop are held off it too, a fast step
// can't cross it in a frame, a wall at your back never lets you or the foe through, and slopes and big foes hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, BODY_BLOCK, blockPush, blockSweep } from '../src/foes.js';
import { clearTargets } from '../src/targets.js';
import { GameState } from '../src/game-state.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
const player = (at) => ({ pos: at, vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, flinch() {} });
const world = (P) => new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });

test('the push: none outside the ring, the overlap inside it', () => {
  assert.equal(blockPush(2, 1.2), 0); assert.ok(Math.abs(blockPush(0.7, 1.2) - 0.5) < 1e-9);
});

test('walking into a crab you stop at its shell; the crab stays put (heavy)', () => {
  clearTargets();
  const P = player(v(0, 0, -4)), foes = world(P), c = foes.add('crab', v(0, 0, 0));
  c.state = 'idle';
  const ring = c.def.radius * BODY_BLOCK.k + BODY_BLOCK.player, at = c.pos.clone();
  for (let i = 0; i < 120; i++) { P.vel.set(0, 0, 4); P.pos.z += 4 / 60; foes.keepOff(); }
  assert.ok(P.pos.distanceTo(c.pos) >= ring - 1e-6, `held at ${P.pos.distanceTo(c.pos).toFixed(2)} m (ring ${ring.toFixed(2)})`);
  assert.ok(P.vel.z <= 1e-6, 'the speed into it taken away');
  assert.ok(c.pos.distanceTo(at) < 1e-6, 'a heavy foe does not give way');
  // an evade no longer slips through (#751)
  P.combatMotion = { evade: 0.5, dir: v(0, 0, 1), speed: 7 };
  foes._offFrom = null; P.pos.set(0, 0, -0.3); foes.keepOff();
  assert.ok(P.pos.distanceTo(c.pos) >= ring - 1e-6, 'evading: held off it too');
  P.combatMotion = null;
  // jumped over it: no push
  P.onGround = false; foes._offFrom = null;
  P.pos.set(0, c.def.height + 0.2, -0.3); foes.keepOff();
  P.onGround = true;
  assert.equal(P.pos.z, -0.3, 'over it');
  clearTargets();
});

test('a light foe gives way: pushed aside more than you are', () => {
  clearTargets();
  const P = player(v(0, 0, -0.2)), foes = world(P), s = foes.add('skitter', v(0, 0, 0));
  s.state = 'idle';
  const before = P.pos.clone();
  foes.keepOff();
  const mine = P.pos.distanceTo(before), its = s.pos.length();
  assert.ok(its > mine, `it moved ${its.toFixed(2)} m, you ${mine.toFixed(2)} m`);
  clearTargets();
});

const ringOf = (f) => f.def.radius * BODY_BLOCK.k + BODY_BLOCK.player;

test('the sweep: a step that crosses a ring in one frame stops where it met it and slides on round it (#751)', () => {
  const pos = v(0, 0, 3);
  assert.ok(blockSweep(v(0, 0, -3), pos, v(0, 0, 0), 1));
  assert.ok(Math.abs(pos.z + 1) < 1e-9 && Math.abs(pos.x) < 1e-9, `stopped at its edge (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`);
  const glance = v(0.6, 0, 3);
  blockSweep(v(0.6, 0, -3), glance, v(0, 0, 0), 1);
  assert.ok(Math.hypot(glance.x, glance.z) >= 1 - 1e-9 && glance.z > -0.8, `a glancing step slides on round it (${glance.x.toFixed(2)}, ${glance.z.toFixed(2)})`);
  assert.equal(blockSweep(v(2, 0, -3), v(2, 0, 3), v(0, 0, 0), 1), false, 'a step past it is left alone');
});

test('a roll, a dash cut, the running cut and a hop never take him through a foe, the hulk and the warlord too (#751)', () => {
  for (const kind of ['grunt', 'hulk', 'warlord', 'crab', 'blot']) for (const M of [{ evade: 0.5, roll: 0.1 }, { dash: true }, { hop: true }]) {
    clearTargets();
    const P = player(v(0, 0, -3)), foes = world(P), f = foes.add(kind, v(0, 0, 0));
    f.state = 'idle';
    const ring = ringOf(f);
    if (M.hop) { P._hop = { kind: 'side' }; P.onGround = false; } else P.combatMotion = { ...M, dir: v(0, 0, 1), speed: 16 };
    let through = false;
    for (let i = 0; i < 60; i++) {
      P.vel.set(0, 0, 16); P.pos.z += 16 / 60; P.pos.x += 0.0005;   // (16 m/s: the dash cut's fastest)
      foes.keepOff();
      if (Math.hypot(P.pos.x - f.pos.x, P.pos.z - f.pos.z) < ring - 1e-6) through = true;
    }
    assert.ok(!through, `${kind}, ${Object.keys(M)[0]}: never inside its ring`);
    assert.ok(P.pos.z < f.pos.z + ring || Math.abs(P.pos.x) >= ring - 1e-3, `${kind}, ${Object.keys(M)[0]}: round it, not through (${P.pos.x.toFixed(2)}, ${P.pos.z.toFixed(2)})`);
    clearTargets();
  }
});

test('the ring is the foe\'s whole radius: a grunt\'s body and his no longer overlap; a big one holds him further off (#751)', () => {
  assert.equal(BODY_BLOCK.k, 1);
  clearTargets();
  const P = player(v(0, 0, -3)), foes = world(P), g = foes.add('grunt', v(0, 0, 0)), h = foes.add('hulk', v(8, 0, 0));
  g.state = h.state = 'idle';
  assert.ok(ringOf(h) >= h.def.radius + BODY_BLOCK.player - 1e-9 && ringOf(h) > ringOf(g) + 0.4);
  clearTargets();
});

test('on a slope, one step uphill of a low foe he is still held off it (#751)', () => {
  clearTargets();
  const P = player(v(0, 0.5, -1.2)), foes = world(P), b = foes.add('blot', v(0, 0, 0));
  b.state = 'idle';
  for (let i = 0; i < 60; i++) { P.vel.set(0, 0, 4); P.pos.z += 4 / 60; foes.keepOff(); }
  assert.ok(Math.hypot(P.pos.x - b.pos.x, P.pos.z - b.pos.z) >= ringOf(b) - 1e-6, 'held off it, though his feet are over its top');
  clearTargets();
});

test('a wall at his back: the foe gives way instead, and never steps through a wall itself (#751)', () => {
  clearTargets();
  // a wall along z = -1 (nothing passes from z > -1 to z < -1)
  const walled = { groundAt: () => 0, rayHit: () => null, rayDistance: (o, d, far) => { if (d.z >= 0 || o.z < -1) return Infinity; const t = (o.z + 1) / -d.z; return t <= far ? t : Infinity; } };
  const P = player(v(0, 0, -0.6)), foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: walled, player: P, settings: { enemies: 'normal' }, game: new GameState(null) });
  const g = foes.add('grunt', v(0, 0, 0));
  g.state = 'idle';
  foes.keepOff();
  assert.ok(P.pos.z >= -0.6 - 1e-9, `he is not pushed into the wall (${P.pos.z.toFixed(2)})`);
  assert.ok(g.pos.z > 0, `the grunt gave way (${g.pos.z.toFixed(2)})`);
  // the foe pushed toward a wall: it stops at it
  const w = foes.add('blot', v(3, 0, -0.5)); w.state = 'idle';
  w.step(0, -2, foes.env);
  assert.ok(w.pos.z > -1, `the blot stopped short of the wall (${w.pos.z.toFixed(2)})`);
  clearTargets();
});
