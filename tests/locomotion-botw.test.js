import test from 'node:test';
import assert from 'node:assert/strict';
import { braking, stopSetting, STOP_FEEL } from '../src/loco-moves.js';
import { Locomotion, LOCO } from '../src/locomotion.js';
import { feel } from '../scripts/motion-qc/feel.mjs';

// Issue #699, the Breath of the Wild study (docs/design/locomotion-botw-study.md): the carried stop from a run (a switch, off by
// default: the snap stop is exactly as before), the chest's lean setting off into a run and its carriage at a run (the hips' share
// as before), the bank at a sprint; measured on the node traveller (scripts/motion-qc/feel.mjs).

const stopFrom = (feel, v0, dt = 1 / 60) => {
  let v = v0, d = 0, t = 0;
  const o = {};
  while (v > 0.05 && t < 5) { braking(feel, v0, v, dt, o); v -= v * o.k; d += v * dt; t += dt; }
  return { t, d };
};

test('the snap stop is the controller’s old braking, frame for frame', () => {
  for (const dt of [1 / 60, 1 / 30, 0.0137]) for (const v of [0.4, 3.8, 8.2]) {
    const o = braking('snap', v, v, dt);
    assert.equal(o.k, 1 - Math.exp(-16 * dt));
    assert.equal(o.rate, STOP_FEEL.snap);
  }
  // (and the carried one below its threshold: a tap of the stick, a pivot, a walk)
  assert.equal(braking('carry', 2.7, 2.7, 1 / 60).k, 1 - Math.exp(-16 / 60));
});

test('the carried stop slows at a steady rate and ends crisply: about 2 m and 0.6 s from a sprint', () => {
  const sprint = stopFrom('carry', 8.2), jog = stopFrom('carry', 3.8), snap = stopFrom('snap', 8.2);
  assert.ok(sprint.d > 1.6 && sprint.d < 2.4, `from a sprint ${sprint.d.toFixed(2)} m`);
  assert.ok(sprint.t > 0.5 && sprint.t < 0.8, `from a sprint ${sprint.t.toFixed(2)} s`);
  assert.ok(jog.d > 0.3 && jog.d < 0.7, `from a jog ${jog.d.toFixed(2)} m`);
  assert.ok(snap.d < 0.6 && snap.t < 0.45, `the snap from a sprint ${snap.d.toFixed(2)} m, ${snap.t.toFixed(2)} s`);
  // (the stop's captured move is played by the distance left: v / rate is that distance, v² / 2D at the steady rate)
  const o = braking('carry', 8.2, 6, 1 / 60);
  assert.ok(Math.abs(6 / o.rate - 36 / (2 * STOP_FEEL.decel)) < 1e-9);
});

test('the stop feel is snap unless asked for', () => {
  assert.equal(stopSetting.get(), 'snap');
});

test('setting off into a run the chest leans further, the hips as before; walking nothing changes', () => {
  const run = new Locomotion(), walk = new Locomotion();
  let heading = 0;
  for (let i = 0; i < 20; i++) {
    const v = Math.min(8.2, i * 0.6);
    run.update(1 / 60, { vf: v, speed: v, heading, ground: true });
    walk.update(1 / 60, { vf: Math.min(1.5, i * 0.4), speed: Math.min(1.5, i * 0.4), heading, ground: true });
  }
  assert.ok(run.lean > LOCO.leanMax, `the chest past the old limit setting off at a run (${run.lean.toFixed(3)})`);
  assert.ok(run.leanHips <= LOCO.leanMax + 1e-9, `the hips within it (${run.leanHips.toFixed(3)})`);
  assert.ok(walk.lean <= LOCO.leanMax + 1e-9 && Math.abs(walk.lean - walk.leanHips) < 1e-9, 'walking, the lean is the old one');
  // a steady sprint: the chest carried forward, nothing on the hips
  const s = new Locomotion();
  for (let i = 0; i < 120; i++) s.update(1 / 60, { vf: 8.2, speed: 8.2, heading, ground: true });
  assert.ok(Math.abs(s.lean - LOCO.leanCarry[2]) < 0.005 && Math.abs(s.leanHips) < 0.005, `carried ${s.lean.toFixed(3)}, hips ${s.leanHips.toFixed(3)}`);
});

test('the bank into a curve grows from a jog to a sprint, and is as before at a walk', () => {
  const bankAt = (speed, turn = 1.5) => {
    const L = new Locomotion();
    let h = 0;
    for (let i = 0; i < 120; i++) { h += turn / 60; L.update(1 / 60, { vf: speed, speed, heading: h, ground: true }); }
    return Math.abs(L.bank);
  };
  const walkOld = Math.min(1.5 * LOCO.bankPerTurn * Math.min(2 / 3.8, 1.6), LOCO.bankMax);
  assert.ok(Math.abs(bankAt(2) - walkOld) < 0.01, `a walk ${bankAt(2).toFixed(3)} against ${walkOld.toFixed(3)}`);
  assert.ok(bankAt(8.2) > 1.5 * LOCO.bankPerTurn * 1.6 + 0.01, `a sprint banks more than the old rule (${bankAt(8.2).toFixed(3)})`);
});

test('in the game’s player: the snap stop as before, the carried one longer; setting off as fast either way', async () => {
  const snap = await feel({ stop: 'snap' }), carry = await feel({ stop: 'carry' });
  assert.ok(snap.sprint.stopDist < 0.5 && snap.sprint.stopTime < 0.45, `snap ${snap.sprint.stopDist.toFixed(2)} m ${snap.sprint.stopTime.toFixed(2)} s`);
  assert.ok(carry.sprint.stopDist > 1.5 && carry.sprint.stopTime < 0.8, `carry ${carry.sprint.stopDist.toFixed(2)} m ${carry.sprint.stopTime.toFixed(2)} s`);
  for (const f of [snap, carry]) assert.ok(f.sprint.to90 < 0.32 && f.jog.to90 < 0.32, 'setting off: 90 % of the speed within 0.3 s, as before');
  assert.ok(Math.abs(snap.reverse.faced - carry.reverse.faced) < 0.02, 'turning round at a sprint is the same either way');
});
