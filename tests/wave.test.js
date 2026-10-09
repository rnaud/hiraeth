// A person's wave (src/wave.js). (The author: "characters' waving looks wrong".) It set the arm's
// Euler angles outright: the arm went up past the head, the forearm bent about its own x, which with
// the arm raised swung the hand toward the face and back (a chop), and the arm snapped from the
// clip's pose at the first frame and back at the last.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const el = () => ({ classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null });
globalThis.document ??= { createElement: el, body: el(), getElementById: () => null, querySelector: () => null };
const { buildCharacter } = await import('../src/player.js');
const { WAVE, waveWeight, layWave } = await import('../src/wave.js');

/** A rig standing with its arms hanging as a clip leaves them (a little out), turned `heading`. */
function rig(heading = 0.7) {
  const c = buildCharacter();
  c.root.position.set(3, 0, -2);
  c.root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
  c.torso.rotation.set(0.05, 0.1, 0);
  for (let i = 0; i < 2; i++) { c.arms[i].rotation.set(0.1, 0, (i ? 1 : -1) * 0.12); c.elbows[i].rotation.set(-0.3, 0, 0); }
  c.root.updateMatrixWorld(true);
  return c;
}
const local = (c, o) => c.root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
const hand = (c, i = 1) => { c.root.updateMatrixWorld(true); return c.root.worldToLocal(c.elbows[i].localToWorld(new THREE.Vector3(0, -0.33, 0))); };

test('the wave eases in and out: nothing at its ends, all of it in the middle', () => {
  assert.equal(waveWeight(-0.1), 0);
  assert.equal(waveWeight(0), 0);
  assert.equal(waveWeight(WAVE.dur), 0);
  assert.equal(waveWeight(1.1), 1);
  assert.ok(waveWeight(0.05) < 0.1 && waveWeight(WAVE.dur - 0.05) < 0.1, 'it starts and ends near the clip’s pose');
  for (let t = 0; t < WAVE.dur; t += 0.01) assert.ok(Math.abs(waveWeight(t + 0.01) - waveWeight(t)) < 0.06, `no jump at ${t.toFixed(2)} s`);
});

test('no snap: in the first moment of the wave the arm is where the clip had it', () => {
  const c = rig(), before = c.arms[1].quaternion.clone(), hb = hand(c);
  layWave(c, c.root, 0.02);
  assert.ok(c.arms[1].quaternion.angleTo(before) < 0.05, `the arm turned ${c.arms[1].quaternion.angleTo(before).toFixed(3)} rad at once (it went straight to hanging)`);
  assert.ok(hand(c).distanceTo(hb) < 0.02, 'the hand stays put');
});

test('mid-wave: the hand up by the head, out to the side, swinging side to side, not toward the face', () => {
  const xs = [], zs = [];
  for (let t = 0.6; t < 1.6; t += 0.02) {
    const c = rig();
    layWave(c, c.root, t);
    const h = hand(c), sh = local(c, c.arms[1]), elbow = local(c, c.elbows[1]);
    assert.ok(h.y > sh.y + 0.2, `the hand ${(h.y - sh.y).toFixed(2)} m over the shoulder at ${t.toFixed(2)} s`);
    assert.ok(elbow.x > sh.x + 0.15, 'the elbow out to the side (the body’s left: +x)');
    assert.ok(elbow.y > sh.y - 0.05 && elbow.y < sh.y + 0.3, `the elbow about at the shoulder’s height (${(elbow.y - sh.y).toFixed(2)})`);
    assert.ok(h.z > sh.z - 0.05, 'the hand not behind the body');
    xs.push(h.x); zs.push(h.z);
  }
  const range = (a) => Math.max(...a) - Math.min(...a);
  assert.ok(range(xs) > 0.15, `the hand swings ${range(xs).toFixed(2)} m side to side`);
  assert.ok(range(zs) < range(xs) * 0.4, `and only ${range(zs).toFixed(2)} m to and from the face`);
});

test('the right arm waves on the right', () => {
  const c = rig();
  layWave(c, c.root, 1, 0);
  assert.ok(hand(c, 0).x < local(c, c.arms[0]).x - 0.1);
});
