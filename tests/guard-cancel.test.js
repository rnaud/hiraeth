// The guard at any moment (src/fluid-blade.js GUARD.cancel, guardCancels; issue #757, the author: "I should be able to
// shield/parry at any time even in the middle of an attack animation"): a fresh press of the guard stops any swing in its
// wind-up, its cut or its follow-through, the charge, the dash cut and the running cut, and the air cuts; the guard
// comes up blended from the pose on screen (no bone jumps in a frame) and parries exactly as a fresh guard does.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SWINGS, DASH, RUN_CUT, GUARD, AIR_COMBO, guardCancels } from '../src/fluid-blade.js';
import { FluidTool } from '../src/fluid-tool.js';
import { GameState } from '../src/game-state.js';
import { items } from '../src/items.js';
import { clearTargets, registerTarget } from '../src/targets.js';
import { traveller, course, CAM_PLUS_Z } from './gait-sim.js';
import { snapshot } from './rollback.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), dt = 1 / 60;
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

test('the gate: a fresh guard press stops a swing; nothing to stop, or the guard only held, nothing changes', () => {
  assert.equal(guardCancels({ press: true, swinging: true }), true);
  assert.equal(guardCancels({ press: false, swinging: true }), false, 'held from before: the riposte may still begin under it');
  assert.equal(guardCancels({ press: true, swinging: false }), false);
  assert.equal(guardCancels({ press: true, swinging: true, ok: false }), false);
  assert.ok(GUARD.cancel > 0 && GUARD.cancel <= 0.15, 'a short blend');
});

/** The guard pressed `at` s into what `start` began; the swing stops that frame, the guard rises, and parries in its window. */
async function cancelAt(start, at, label) {
  clearTargets();
  const { p, tool, tick } = await armed();
  const blade = tool.blade, A = p.animator;
  registerTarget({ kind: 'foe', lock: true, accepts: ['blade'], radius: 0.7, position: () => v(0, 0.8, -57.6) });
  for (let i = 0; i < 40; i++) tick({});
  const spec = start(tick, blade, p);
  assert.ok(blade.swinging || blade.charging, `${label}: swinging`);
  for (let t = 0; t < at - 1e-6; t += dt) tick({ ...spec.hold });
  const phase = blade.phase;
  assert.ok(blade.swinging, `${label}: still swinging at ${at} s (${phase})`);
  // the press: the swing stops at once
  let prev = [A.bone('upperarm_r').quaternion.clone(), A.bone('hand_r').quaternion.clone(), A.bone('upperarm_l').quaternion.clone()], worst = 0, r = false, i = 0;
  tick({ ...spec.hold, KeyZ: true });
  assert.ok(!blade.swinging && !blade.charging, `${label} (${phase}): the swing stopped the frame the guard was pressed`);
  assert.ok(blade.guardWant, `${label}: the guard wanted`);
  const foeAt = v(p.pos.x + Math.sin(p.heading) * 1.5, 0, p.pos.z + Math.cos(p.heading) * 1.5);
  for (; i < 30; i++) {
    tick({ KeyZ: true });
    const q = [A.bone('upperarm_r').quaternion.clone(), A.bone('hand_r').quaternion.clone(), A.bone('upperarm_l').quaternion.clone()];
    worst = Math.max(worst, ...q.map((x, k) => x.angleTo(prev[k]))); prev = q;
    if (!r && blade.parryLive) r = blade.block(foeAt);
  }
  assert.equal(r, 'perfect', `${label} (${phase}): parried, inside a fresh guard's window`);
  assert.ok(worst < 0.8, `${label} (${phase}): blended from the pose on screen (largest turn in a frame ${worst.toFixed(2)} rad)`);
  return phase;
}

const press = (tick) => { tick({ KeyF: true }); tick({}); return { hold: {} }; };
const chain = (n) => (tick, blade) => {
  tick({ KeyF: true }); tick({});
  for (let k = 0; k < n; k++) { let g = 0; while (!(blade.n === k && blade.phase === 'recover') && g++ < 120) tick({}); tick({ KeyF: true }); g = 0; while (blade.n !== k + 1 && g++ < 60) tick({}); }
  return { hold: {} };
};

test('the guard cancels each of the combo\'s three swings in its wind-up, its cut and its follow-through (#757)', async () => {
  const seen = new Set();
  for (const n of [0, 1, 2]) {
    const S = SWINGS[n];
    for (const [ph, at] of [['wind', S.wind * 0.5], ['strike', S.wind + S.active * 0.5], ['recover', S.wind + S.active + S.recover * 0.4]]) {
      seen.add(`${n}${await cancelAt(n ? chain(n) : press, n ? at - dt : at, `swing ${n + 1} ${ph}`)}`);
    }
  }
  for (const n of [0, 1, 2]) for (const ph of ['wind', 'strike', 'recover']) assert.ok(seen.has(`${n}${ph}`), `swing ${n + 1}: cancelled in its ${ph}`);
  clearTargets();
});

test('the guard cancels the charge, the dash cut and the running cut (#757)', async () => {
  // the charge held
  await cancelAt((tick, blade) => { for (let i = 0; i < 40; i++) { tick({ KeyF: true }); if (blade.charging) break; } assert.ok(blade.charging, 'charging'); return { hold: { KeyF: true } }; }, 0.2, 'the charge');
  // the dash cut, out of an evade
  await cancelAt((tick, blade) => { tick({ AltLeft: true }); tick({}); let n = 0; while (blade.evadeT > 0 && n++ < 30) tick(n === 3 ? { KeyF: true } : {}); assert.equal(blade.special, DASH); return { hold: {} }; }, DASH.wind + DASH.active * 0.5, 'the dash cut');
  // the running cut, from a sprint
  await cancelAt((tick, blade) => { for (let i = 0; i < 70; i++) tick({ KeyW: true, ShiftLeft: true }); tick({ KeyW: true, ShiftLeft: true, KeyF: true }); assert.equal(blade.special, RUN_CUT); return { hold: { KeyW: true, ShiftLeft: true } }; }, RUN_CUT.wind * 0.6, 'the running cut');
  clearTargets();
});

test('in the air, the guard cancels the air combo\'s swing too (#757)', async () => {
  clearTargets();
  const { p, tool, tick } = await armed();
  const blade = tool.blade;
  for (let i = 0; i < 40; i++) tick({});
  tick({ Space: true }); for (let i = 0; i < 6; i++) tick({ Space: true });
  tick({ KeyF: true }); tick({});
  assert.ok(!p.onGround && blade.swinging && blade.special === AIR_COMBO.swings[0], 'an air swing');
  tick({ KeyZ: true });
  assert.ok(!blade.swinging, 'stopped');
  assert.ok(blade.guardWant, 'the guard up in the air');
  tool.dispose(); clearTargets();
});
