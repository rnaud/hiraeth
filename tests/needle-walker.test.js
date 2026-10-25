import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Wildlife } from '../src/wildlife.js';
import { NEEDLE } from '../src/wildlife/species.js';
import { clearTargets } from '../src/targets.js';
import { Physics } from '../src/physics.js';
import { CONTENT } from '../src/levels/content.js';
import { createArzach } from '../src/levels/arzach.js';

// Vael's needle walker (#209): it used to rise into the air and turn upright there, its tail's tip off the ground.
// Now it walks a few steps on, plants itself with its tail's tip on the ground, and stands up on that tip.
const Y = new THREE.Vector3(0, 1, 0);
const scene = new THREE.Scene();
const level = createArzach(scene);
const physics = new Physics(scene, level.ground.heightAt ? level.ground : null);
level.init?.(physics);
const player = (pos) => ({ pos: pos.clone(), vel: new THREE.Vector3(), onGround: true, frame: { up: Y.clone() }, vehicles: [] });

/** The tail's tip and the body's middle (world) as the creature is posed now. */
function posed(w, c, t) {
  w.write(c, t, 1 / 60);
  const R = c.herd.pose.root;
  const m = new THREE.Matrix4().compose(c.pos, c.quat, new THREE.Vector3().setScalar(c.size))
    .multiply(new THREE.Matrix4().compose(R.p, new THREE.Quaternion().setFromEuler(R.r), R.s));
  return { tip: new THREE.Vector3(...NEEDLE.tip).applyMatrix4(m), mid: new THREE.Vector3(...NEEDLE.mid).applyMatrix4(m) };
}

test('needle walker (#209): it walks on, plants its tail\'s tip on the ground and stands up on it, on slopes too', () => {
  clearTargets();
  const w = new Wildlife(scene, level, physics, { content: CONTENT.arzach });
  const list = w.creatures.filter((c) => c.species.id === 'needleWalker');
  assert.ok(list.length >= 4, 'Vael has its needle walkers');
  let slopes = 0;
  for (const c of list) {
    const far = player(c.pos.clone().add(new THREE.Vector3(60, 0, 0))), cam = new THREE.PerspectiveCamera();
    const from = c.pos.clone();
    c.cool = 0;
    assert.ok(c.scare(c.pos.clone().addScaledVector(c.fwd, -3)), 'scared');
    let t = 100, worst = 0, stood = null;
    while (c.state === 'trick' && c.k < 0.99) {
      t += 1 / 60;
      w.update(1 / 60, t, far, cam);
      if (c.state !== 'trick') break;
      const { tip, mid } = posed(w, c, t);
      const g = physics.groundAt(tip.x, tip.y + 2, tip.z, 6);
      // planted and standing: the tip on the ground (a few cm into it at most), never in the air
      if (c.k > NEEDLE.plant[1] + 0.005 && c.k < NEEDLE.down[1]) worst = Math.max(worst, Math.abs(tip.y - g));
      if (c.k > 0.5 && c.k < 0.6 && !stood) stood = { up: mid.clone().sub(tip).normalize().y, tip: tip.clone() };
      if (stood && c.k < NEEDLE.down[0]) assert.ok(tip.distanceTo(stood.tip) < 0.05, 'the tip stays where it was set down');
    }
    const slope = Math.abs(physics.groundAt(from.x + 1, from.y + 3, from.z, 8) - physics.groundAt(from.x - 1, from.y + 3, from.z, 8)) / 2;
    if (slope > 0.1) slopes++;
    assert.ok(worst < 0.12, `the tip stays on the ground (${worst.toFixed(3)} m off at worst, slope ${slope.toFixed(2)})`);
    assert.ok(stood && stood.up > 0.95, `it stands upright (${stood?.up.toFixed(2)})`);
    assert.ok(c.pos.distanceTo(from) > 0.15, `it walked a few steps first (${c.pos.distanceTo(from).toFixed(2)} m)`);
  }
  assert.ok(slopes >= 1, 'some of them stood on a slope');
  w.dispose();
});
