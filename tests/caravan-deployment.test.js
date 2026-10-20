import test from 'node:test';
import assert from 'node:assert/strict';
import { CaravanDeployment } from '../src/ship/caravan-deployment.js';
const create = () => new CaravanDeployment({ applyCamp() {} });

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
