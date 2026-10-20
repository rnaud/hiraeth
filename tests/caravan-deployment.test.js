import test from 'node:test';
import assert from 'node:assert/strict';
import { CaravanDeployment, caravanStowPose } from '../src/ship/caravan-deployment.js';
const create = () => new CaravanDeployment({ applyCamp() {} });

test('stowed pose secures every mechanism and landed pose fully opens it', () => {
  for (const t of [-1, 0]) assert.ok(Object.values(caravanStowPose(t)).every((x) => x === 0));
  for (const t of [1, 2]) assert.ok(Object.values(caravanStowPose(t)).every((x) => x === 1));
  for (const t of [NaN, Infinity, -Infinity]) assert.throws(() => caravanStowPose(t));
});

test('deck opens before its ramp and rails; loose camp items retract before deck closure', () => {
  const openingDeck = caravanStowPose(.15);
  assert.ok(openingDeck.deck > 0 && openingDeck.deck < 1);
  assert.ok(Object.entries(openingDeck).every(([k, v]) => k === 'deck' || v === 0));
  for (let i = 0; i <= 1000; i++) {
    const p = caravanStowPose(i / 1000);
    if (p.supports > 0 || p.ramp > 0 || p.rails > 0) assert.equal(p.deck, 1);
    if (p.rails > 0) { assert.equal(p.ramp, 1); assert.equal(p.supports, 1); }
    if (p.canopy > 0 || p.props > 0) assert.equal(p.rails, 1);
    if (p.laundry > 0) { assert.equal(p.canopy, 1); assert.equal(p.props, 1); }
    if (i) for (const [key, value] of Object.entries(p)) {
      const previous = caravanStowPose((i - 1) / 1000)[key];
      assert.ok(value >= previous && value - previous < .016, `${key} moves continuously`);
    }
  }
});

test('all staged mechanisms stay secured throughout ascent and descent', () => {
  const d = create();
  d.depart();
  for (let i = 0; i < 150; i++) {
    d.update(.053);
    if (d.altitude > 0) assert.ok(Object.values(caravanStowPose(d.camp)).every((v) => v === 0));
  }
  assert.equal(d.phase, 'flight'); d.arrive();
  for (let i = 0; i < 150; i++) {
    d.update(.053);
    if (d.altitude > 0) assert.ok(Object.values(caravanStowPose(d.camp)).every((v) => v === 0));
  }
  assert.equal(d.phase, 'landed');
});

test('camp closes on the ground before lift-off and opens only after touchdown', () => {
  const d = create(); assert.equal(d.arrive(), false); assert.equal(d.depart(), true);
  for (let i = 0; i < 100; i++) { d.update(.1); if (d.camp > 0) assert.equal(d.altitude, 0); }
  assert.equal(d.phase, 'flight'); assert.equal(d.camp, 0); assert.equal(d.depart(), false);
  assert.equal(d.arrive(), true);
  for (let i = 0; i < 100; i++) { d.update(.1); if (d.altitude > 0) assert.equal(d.camp, 0); }
  assert.equal(d.phase, 'landed'); assert.equal(d.camp, 1);
});

test('large time steps and interrupted deployment obey the same ground contract', () => {
  const d = create(); d.depart(); d.update(100); assert.equal(d.phase, 'flight');
  d.arrive(); d.update(4); assert.equal(d.phase, 'deploying'); assert.ok(d.camp > 0 && d.camp < 1);
  d.depart(); d.update(.1); assert.equal(d.altitude, 0); d.update(100); assert.equal(d.phase, 'flight');
  d.landingComplete(); assert.equal(d.altitude, 0); d.update(100); assert.equal(d.phase, 'landed');
  assert.throws(() => d.update(NaN)); assert.throws(() => d.update(-1)); assert.throws(() => d.reset('unknown'));
});
