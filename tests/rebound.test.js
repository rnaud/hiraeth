// The rebound off a raised guard (issue #774, the author: "If I hit an enemy with their guard up I should recoil. Research
// how botw does it and fix"; src/fluid-blade.js REBOUND, docs/systems/foes.md "The rebound off a raised guard"): a cut a
// foe's guard turns throws the blade back. The swing stops, the combo's chain and presses go, he is carried back a step,
// the arm plays its swing back toward the wind-up without a jump, and for a moment no cut, then no guard or evade, begins;
// the guarding foe answers it at once with its counter.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REBOUND, reboundLocks, reboundPose } from '../src/fluid-blade.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { Foes, FOES } from '../src/foes.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';
import { snapshot } from './rollback.js';
// (the fights' picks seeded: unseeded, a rare draw failed a test as the bodies changed, #800)
const seeded = (s = 7) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;

test('the rebound\'s shape: short, the guard and the evade back before the next cut, the arm played back then let go', () => {
  assert.ok(REBOUND.time >= 0.35 && REBOUND.time <= 0.7, `about half a second, as Link's (${REBOUND.time} s)`);
  assert.ok(REBOUND.lock < REBOUND.time, 'the guard and the evade come back before the next cut');
  assert.ok(reboundLocks(0) && reboundLocks(REBOUND.lock - 0.01) && !reboundLocks(REBOUND.lock));
  const a = reboundPose(0, 0.6, 0.12), b = reboundPose(REBOUND.back, 0.6, 0.12), c = reboundPose(REBOUND.time, 0.6, 0.12);
  assert.equal(a.t, 0.6, 'it starts where the cut met the guard');
  assert.ok(b.t < a.t && b.t > 0.12, `played back toward the wind-up (${b.t.toFixed(2)})`);
  assert.equal(a.w, 1); assert.equal(b.w, 1); assert.equal(c.w, 0, 'let go by the end');
});

let built = null;
async function armed() {
  if (!built) {
    items.grant('backpack');
    const scene = course({ ramp: false, stairs: false });
    const p = await traveller(scene, v(0, 0, -60), { moves: true, body: 'b3' });
    const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 2, -65); camera.lookAt(0, 1, -55); camera.updateMatrixWorld();
    const tool = new FluidTool({ scene, player: p, physics: p.physics, camera, rig: { aimK: 0 }, state: new GameState(null) });
    const tick = (input = {}) => { p.update(dt, input, CAM_PLUS_Z); tool.update(dt, input); };
    built = { it: { p, tool, tick }, rewind: snapshot({ p, tool, camera, scene }, items) };
  } else built.rewind.restore();
  return built.it;
}

/** A guarding foe 1.8 m before him: every cut it takes it turns (as Foes.guarded marks it: dull, rebound). */
function guardingFoe(p) {
  const at = v(p.pos.x + Math.sin(p.heading) * 1.8, 0.8, p.pos.z + Math.cos(p.heading) * 1.8), hits = [];
  registerTarget({ kind: 'foe', lock: true, accepts: ['blade'], radius: 0.7, position: () => at,
    onHit: (mode, point, dir, info) => { hits.push(info); info.dull = true; info.rebound = true; return true; } });
  return hits;
}

test('a cut into a raised guard: the swing stops, the chain and the presses go, he is carried back, the arm without a jump (#774)', async () => {
  clearTargets();
  const { p, tool, tick } = await armed();
  const blade = tool.blade, A = p.animator;
  for (let i = 0; i < 40; i++) tick({});
  const hits = guardingFoe(p);
  const start = p.pos.clone(), toward = v(Math.sin(p.heading), 0, Math.cos(p.heading));
  tick({ KeyF: true }); tick({});
  let n = 0;
  while (!blade.reboundT && n++ < 60) tick(n % 4 === 0 ? { KeyF: true } : {});   // (mashing on through the swing)
  assert.equal(hits.length, 1, 'the cut met the guard');
  assert.ok(blade.reboundT > 0, 'it rebounded');
  assert.ok(!blade.swinging && blade.chainT === 0 && !blade.queued && blade.buffered === 0, 'the swing stopped, nothing chained or kept');
  const at = p.pos.clone();
  let worst = 0, prev = [A.bone('upperarm_r').quaternion.clone(), A.bone('hand_r').quaternion.clone()], posed = 0;
  // mashing the blade, the guard and the evade through the lock: none of them
  for (let i = 0; blade.reboundAge < REBOUND.lock - 1.5 * dt; i++) {
    tick(i % 2 ? { KeyZ: true, AltLeft: true } : { KeyF: true });
    assert.ok(!blade.swinging, 'no cut while it rebounds');
    assert.ok(!blade.evadeT, 'no evade while it locks');
    assert.ok(!blade.guarding, 'no guard while it locks');
    if (p.swingMove?.id === 'rebound') posed++;
    const q = [A.bone('upperarm_r').quaternion.clone(), A.bone('hand_r').quaternion.clone()];
    worst = Math.max(worst, ...q.map((x, k) => x.angleTo(prev[k]))); prev = q;
  }
  assert.ok(posed > 3, `the arm played back along its swing (${posed} frames)`);
  assert.ok(worst < 0.8, `no jump in the arm (largest turn in a frame ${worst.toFixed(2)} rad)`);
  const back = start.clone().sub(p.pos).dot(toward), fromHit = at.clone().sub(p.pos).dot(toward);
  assert.ok(fromHit > 0.1, `carried back from where it met the guard (${fromHit.toFixed(2)} m)`);
  // the lock lifts: the guard rises (a fresh press), and after the rebound a fresh cut swings
  for (let i = 0; i < 4; i++) tick({});
  for (let i = 0; i < 20; i++) tick({ KeyZ: true });
  assert.ok(blade.guarding, 'the guard rises once the lock lifts');
  for (let i = 0; i < 10; i++) tick({});
  assert.equal(blade.reboundT, 0, 'over');
  tick({ KeyF: true }); tick({});
  assert.ok(blade.swinging, 'a fresh cut swings after it');
  if (process.env.SHOW) console.log({ back, fromHit, worst, posed });
  clearTargets();
});

test('a cut that lands (no guard) does not rebound', async () => {
  clearTargets();
  const { p, tool, tick } = await armed();
  const blade = tool.blade;
  for (let i = 0; i < 40; i++) tick({});
  const at = v(p.pos.x + Math.sin(p.heading) * 1.8, 0.8, p.pos.z + Math.cos(p.heading) * 1.8), hits = [];
  registerTarget({ kind: 'foe', lock: true, accepts: ['blade'], radius: 0.7, position: () => at, onHit: (m, pt, d, info) => { hits.push(info); return true; } });
  tick({ KeyF: true }); tick({});
  for (let i = 0; i < 40; i++) tick({});
  assert.equal(hits.length, 1);
  assert.equal(blade.reboundT, 0);
  clearTargets();
});

// the foe's side, headless (as tests/foe-guard.test.js): each guarded kind answers a rebound at once
const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
function arena(kind, at) {
  clearTargets();
  const P = { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, hurt() {}, knockDown() { return true; }, stagger() {}, flinch() {} };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), rng: seeded() });
  const f = foes.add(kind, v(0, 0, at)); f.heading = Math.PI;
  for (let i = 0; i < 100 && f.guardK < 1; i++) { f.cool = Math.max(f.cool, 3); foes.update(dt); }
  return { foes, f };
}

test('the guarding foe punishes the rebound: one cut turned and it answers at once with its counter (#774)', () => {
  for (const [kind, at] of [['brute', 2.8], ['crab', 2.2], ['shade', 2.2], ['fencer', 2.4], ['sentinel', 2.4]]) {
    const { foes, f } = arena(kind, at);
    assert.equal(f.guardK, 1, `${kind}: its guard up`);
    const info = { damage: 1, combo: 0 }, hp = f.hp;
    foes.hurt(f, 'blade', v(0, 0, 1), info);
    assert.equal(f.hp, hp, `${kind}: no harm through it`);
    assert.ok(info.rebound && info.dull, `${kind}: the blade told to rebound`);
    foes.update(dt);
    assert.equal(f.state, 'wind', `${kind}: it answers at once`);
    assert.equal(f.atk.id, FOES[kind].guard.counter, `${kind}: with its counter`);
    const lands = (f.windFor?.(f.atk) ?? f.atk.wind) + (f.atk.strike ?? 0) * (f.atk.contact ?? 0.5);
    assert.ok(lands > REBOUND.lock + 0.15, `${kind}: its blow lands ${lands.toFixed(2)} s after the rebound: time to guard or roll once the lock lifts`);
    foes.dispose();
  }
  // a bomb it turns, or a shot off a shield, rebounds nobody
  const { foes, f } = arena('fencer', 2.4);
  const bomb = { damage: 2, source: 'bomb' };
  foes.hurt(f, 'shoot', v(0, 0, 1), bomb);
  assert.ok(!bomb.rebound && !f.rebounded, 'a shot off its shield: no rebound');
  foes.dispose(); clearTargets();
});
