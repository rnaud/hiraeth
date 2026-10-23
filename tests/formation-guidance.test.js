import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoute, newFlight, newWings, slotAt, flightGuide } from '../src/minigames/formation.js';

test('Elder flight guidance points back toward the wake without moving or scoring', () => {
  const R = makeRoute(), F = newFlight(R), slot = slotAt(F, R), W = newWings(slot, F.her.yaw);
  const at = (delta, pattern) => {
    W.pos.copy(slot).add(delta); const before = JSON.stringify({ F, W });
    assert.match(flightGuide(F, R, W), pattern); assert.equal(JSON.stringify({ F, W }), before);
  };
  at(slot.clone().set(0, 0, 0), /courage recovers/);
  at(slot.clone().set(0, -8, 0), /Pull back to climb/);
  at(slot.clone().set(0, 8, 0), /Push forward to descend/);
  at(F.her.right.clone().multiplyScalar(-12), /Bank right/);
  at(F.her.right.clone().multiplyScalar(12), /Bank left/);
  at(F.her.fwd.clone().multiplyScalar(-12), /A \/ × to catch up/);
  at(F.her.fwd.clone().multiplyScalar(12), /LT \/ L2 to slow/);
});
