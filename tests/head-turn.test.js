// The traveller's head on his neck through the standing idles. (The author: "an animation where his
// mouth opens wide and his neck moves strangely".) The looking-around idles turned his skull 105° on
// the neck, the jaw into the shoulder and the face stretched over it: the clip's head is read in the
// world, so it carried the chest's twist too, which our chest doesn't take (Animator HEAD_TURN).
// The limit on its own here; the traveller standing through the idles with it is checked in
// tests/idle-legs.test.js, on the one standing run its other checks share.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { HEAD_TURN, limitHeadTurn } from '../src/animator.js';

const deg = (r) => r * 180 / Math.PI;

test('limitHeadTurn: small turns as they are, big ones eased under the limits, the way kept', () => {
  const q = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z, 'YXZ'));
  const small = q(0.1, 0.2, 0), out = limitHeadTurn(small.clone());
  assert.ok(out.angleTo(small) < 0.02, 'a small turn barely changes');
  const yawOf = (r) => { const f = new T.Vector3(0, 0, 1).applyQuaternion(r); return Math.atan2(f.x, f.z); };
  const big = limitHeadTurn(q(0, 1.83, 0));   // 105°
  assert.ok(Math.abs(yawOf(big)) <= HEAD_TURN.yaw + 1e-6 && yawOf(big) > 0.9, `105° about the neck comes to ${deg(yawOf(big)).toFixed(0)}°, the same way`);
  const nod = limitHeadTurn(q(1.2, 0, 0));
  const tilt = 2 * Math.acos(Math.min(1, Math.abs(nod.w)));
  assert.ok(tilt <= HEAD_TURN.tilt + 1e-6 && nod.x > 0, `a 69° nod comes to ${deg(tilt).toFixed(0)}°, still down`);
  assert.ok(limitHeadTurn(new T.Quaternion()).angleTo(new T.Quaternion()) < 1e-9, 'none stays none');
});
