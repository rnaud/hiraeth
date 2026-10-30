// A struck-down foe's body stands in the traveller's way while it lies there (issue #797, the author: "after an enemy
// gets defeated I can clip through him? that's not good"; src/enemies/defeat.js lyingBody, src/foes.js
// Foes.keepOffBodies): a ragdoll's and a slumped beast's, walked into and rolled into, never through; jumped over, gone
// up in its smoke, a blot's puddle, a skitter's: no block. Its target stays off (the blade and the lock pass over it).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Foes, BODY_BLOCK } from '../src/foes.js';
import { lyingBody, nearestOnBody, leavesBody, LYING } from '../src/enemies/defeat.js';
import { J as RJ } from '../src/ragdoll.js';
import { GameState } from '../src/game-state.js';
import { clearTargets, allTargets } from '../src/targets.js';
import { resetFeel } from '../src/feel.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), DT = 1 / 60;
const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function world() {
  clearTargets(); resetFeel();
  const P = { pos: v(0, 0, -30), vel: v(), heading: 0, onGround: true, health: 1, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null }, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded(5), tool: { drops: { add() {} } } });
  foes.setPractice('');
  return { P, foes, done: () => { foes.dispose(); clearTargets(); } };
}
const kill = (foes, f, dir = v(0, 0, 1)) => { f.hp = 0.1; f.state = 'recover'; f.timer = 0.5; return foes.hurt(f, 'blade', dir, { damage: 9, combo: 2 }, f.chest.clone()); };
const scratch = () => ({ pts: [v(), v(), v()], n: 0, r: 0, lo: 0, hi: 0 });

test('which bodies stand in the way: beasts, machines, flyers and humanoids do; a spirit, a burrower, a light one do not', () => {
  for (const a of ['grunt', 'crab', 'brute', 'tripod', 'drone', 'centipede']) assert.ok(leavesBody(a, {}), a);
  for (const a of ['blot', 'shade', 'mummer', 'worm']) assert.equal(leavesBody(a, {}), false, a);
  assert.equal(leavesBody('crab', { light: true }), false, 'a light one gave way alive too');
  assert.equal(leavesBody('crab', { noBlock: true }), false);
});

test('the nearest point on a body’s chain', () => {
  const B = { pts: [v(0, 0, 0), v(2, 0, 0), v(2, 0, 2)], n: 3 }, at = {};
  assert.ok(Math.abs(nearestOnBody(B, 1, 1, at) - 1) < 1e-9);
  assert.ok(Math.abs(at.x - 1) < 1e-9 || Math.abs(at.z - 1) < 1e-9);
  assert.ok(Math.abs(nearestOnBody(B, -1, 0, at) - 1) < 1e-9 && at.x === 0);
});

for (const kind of ['grunt', 'crab', 'brute']) {
  test(`a struck-down ${kind}: walked into and rolled into while it lies, never through; jumped over; gone in its smoke, no block`, () => {
    const { P, foes, done } = world();
    const f = foes.add(kind, v(0, 0, 0)); f.heading = Math.PI;
    for (let i = 0; i < 10; i++) foes.update(DT);
    kill(foes, f, v(0, 0, 1));
    assert.ok(f.dying, 'going down');
    // let it come down and lie (its ragdoll asleep, or its recipe done: then it lies SMOKE.linger)
    for (let t = 0; t < 1.6 && f.dead === undefined; t += DT) foes.update(DT);
    const L = lyingBody(f, RJ, scratch());
    assert.ok(L, 'it lies in the way');
    assert.ok(L.hi - L.lo >= LYING.min - 1e-9 && L.hi - L.lo < (f.def.height ?? 1) * (f.model.size ?? 1) + 0.6, `as high as it lies (${(L.hi - L.lo).toFixed(2)} m)`);
    // the middle of what lies there: walk at it from the far side, then roll at it at 16 m/s
    const mid = v(), at = {};
    for (let i = 0; i < L.n; i++) mid.add(v(L.pts[i].x, 0, L.pts[i].z)); mid.multiplyScalar(1 / L.n);
    for (const speed of [4, 16]) {
      foes._offFrom = null; P.pos.set(mid.x + 0.001, 0, mid.z - 3); P.onGround = true;
      if (speed > 4) P.combatMotion = { evade: 0.5, roll: 0.1, dir: v(0, 0, 1), speed };
      let inside = false;
      for (let i = 0; i < 40 && f.dying && !f.puffed; i++) {
        P.vel.set(0, 0, speed); P.pos.z += speed * DT;
        foes.keepOff();
        const B = lyingBody(f, RJ, scratch());
        if (B && nearestOnBody(B, P.pos.x, P.pos.z, at) < B.r + BODY_BLOCK.player - 1e-6) inside = true;
      }
      P.combatMotion = null;
      assert.ok(!inside, `${kind} at ${speed} m/s: never inside its body`);
      assert.ok(P.pos.z < mid.z + 0.2 || Math.abs(P.pos.x - mid.x) > 0.3, `${kind} at ${speed} m/s: stopped at it or slid round it, not through (${P.pos.x.toFixed(2)}, ${P.pos.z.toFixed(2)})`);
    }
    // jumped over it: no push
    foes._offFrom = null; P.onGround = false; P.pos.set(mid.x, L.hi + 0.3, mid.z); const was = P.pos.clone();
    foes.keepOff();
    assert.ok(P.pos.distanceTo(was) < 1e-9, 'over it in a jump');
    P.onGround = true;
    // the blade and the lock pass over it: its target is off
    assert.ok(!allTargets().some((t) => t.foe === f && t.enabled()), 'no target on the body');
    // gone up in its smoke: walked through what is left of the cloud
    for (let t = 0; t < 4 && foes.list.includes(f) && !f.puffed; t += DT) foes.update(DT);
    if (foes.list.includes(f)) {
      foes._offFrom = null; P.pos.set(mid.x, 0, mid.z); const here = P.pos.clone(); foes.keepOff();
      assert.ok(P.pos.distanceTo(here) < 1e-9, 'in its puff: no longer in the way');
    }
    done();
  });
}

test('a blot struck down leaves a puddle, walked over', () => {
  const { P, foes, done } = world();
  const f = foes.add('blot', v(0, 0, 0));
  for (let i = 0; i < 10; i++) foes.update(DT);
  kill(foes, f, v(0, 0, 1));
  for (let t = 0; t < 0.5; t += DT) foes.update(DT);
  P.pos.set(0.05, 0, 0); foes._offFrom = null; const here = P.pos.clone(); foes.keepOff();
  assert.ok(P.pos.distanceTo(here) < 1e-9);
  done();
});
