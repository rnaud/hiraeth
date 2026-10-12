import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player, MANTLE, mantleTime } from '../src/player.js';
import { Physics } from '../src/physics.js';

// The ledge mantle in two (#215): hands on the lip and hauled up, a knee onto the ledge, then up standing. It used to
// rise straight to its feet in the air over the lip and step in standing.
const U = new THREE.Vector3(0, 1, 0), into = new THREE.Vector3(0, 0, 1);
/** A block `h` m tall whose face is 0.4 m in front of the traveller (who hangs on it there). */
function ledge(h) {
  const scene = new THREE.Scene(), block = new THREE.Mesh(new THREE.BoxGeometry(6, h, 4));
  block.position.set(0, h / 2, 0.4 + 2);
  scene.add(block);
  const p = new Player(new Physics(scene));
  p.pos.set(0, 0, 0); p.heading = 0; p.wallN = new THREE.Vector3(0, 0, -1);
  return p;
}

for (const h of [1, 1.9, 2.6]) {
  test(`mantle (#215): a ${h} m ledge, hauled up, a knee on the top, then standing, briskly`, () => {
    const p = ledge(h);
    assert.ok(p.tryMantle(U, into), 'takes the ledge');
    const M = p.mantle;
    assert.ok(Math.abs(M.lip - 0.4) < 0.02, `finds the lip (${M.lip.toFixed(2)} m in)`);
    let t = 0, onKnee = 0, overLip = Infinity, kneeMax = 0;
    while (p.mantle && t < 3) {
      p.updateMantle(1 / 120); t += 1 / 120;
      const k = p.mantle?.t ?? 1, y = p.pos.y;
      kneeMax = Math.max(kneeMax, p.mantleKneel);
      if (k < MANTLE.pull - 0.01) assert.ok(p.pos.z < 0.01, 'hauled up the wall first, not over the lip');
      if (k > MANTLE.knee + 0.01 && k < MANTLE.hold) {
        onKnee++;
        assert.ok(Math.abs(y - h) < 0.02, `on the ledge's height while on the knee (${y.toFixed(2)})`);
        overLip = Math.min(overLip, p.pos.z - 0.4);
        assert.ok(p.mantleKneel > 0.95, `down on the knee (${p.mantleKneel.toFixed(2)})`);
      }
      // never in the air over the top: up to its height plus the little bump, no more
      assert.ok(y < h + MANTLE.bump + 0.01, `not risen standing over the lip (${(y - h).toFixed(2)} m over it)`);
    }
    assert.equal(p.mantle, null, 'done');
    assert.ok(onKnee > 3 && overLip > 0.15, `a moment on the knee, past the lip (${overLip.toFixed(2)} m in)`);
    assert.ok(Math.abs(t - mantleTime(h)) < 0.02 && t < 1.3, `brisk (${t.toFixed(2)} s)`);
    assert.ok(p.onGround && Math.abs(p.pos.y - h) < 0.02 && p.pos.z - 0.4 > 0.4, `standing on the top a step in (${(p.pos.z - 0.4).toFixed(2)} m)`);
  });
}

test('mantle (#215): pushing on while getting up off the knee is up sooner', () => {
  const run = (keys) => {
    const p = ledge(1.9);
    p.onGround = false;
    p.tryMantle(U, into);
    let n = 0;
    while (p.mantle && n < 600) { p.update(1 / 60, keys, 0); n++; }
    return n;
  };
  const still = run({}), pushing = run({ KeyW: true });
  assert.ok(pushing < still - 3, `pushing on: ${pushing} frames, else ${still}`);
});
