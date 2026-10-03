import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Trail } from '../src/trail.js';
import { Physics } from '../src/physics.js';

// lowest point of the visible tube relative to the ground, over every live vertex
function worstDepth(trail, heightAt) {
  let worst = Infinity;
  const p = trail.pos;
  for (let j = 0; j < p.length; j += 3) {
    if (p[j + 1] < -1000) continue;                // unused rings are parked far below
    worst = Math.min(worst, p[j + 1] - heightAt(p[j], p[j + 2]));
  }
  return worst;
}

test('the hover trail stays above rolling ground, over crests and when the vehicle drops', () => {
  // dunes with sharp crests, a jet skimming low and sometimes dipping under them
  const H = (x, z) => 1.5 * Math.abs(Math.sin(x * 0.12)) + 0.3 * Math.sin(z * 0.4);
  const trail = new Trail(new THREE.Scene(), { ground: (x, _y, z) => H(x, z) });
  let worst = Infinity;
  for (let i = 0; i < 400; i++) {
    const x = i * 0.6, z = Math.sin(i * 0.05) * 4;
    const drop = i % 90 > 60 ? -0.3 : 0.35;           // a hard landing pushes the jets into the sand
    trail.update(1 / 60, new THREE.Vector3(x, H(x, z) + drop, z));
    if (i > 5) worst = Math.min(worst, worstDepth(trail, H));
  }
  assert.ok(trail.mesh.visible);
  assert.ok(worst >= 0, `the tube dips ${(-worst).toFixed(3)} m into the ground`);
});

test('the hover trail rests on a roof it skims instead of sinking through it', () => {
  const scene = new THREE.Scene();
  const roof = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40)); roof.position.set(0, 9.5, 0); scene.add(roof);
  const physics = new Physics(scene);
  const H = (x, z) => (Math.abs(x) < 20 && Math.abs(z) < 20 ? 10 : -Infinity);
  const trail = new Trail(new THREE.Scene(), { ground: (x, y, z) => physics.groundAt(x, y, z) });
  for (let i = 0; i < 60; i++) trail.update(1 / 60, new THREE.Vector3(-15 + i * 0.5, 10.1, 0));
  const depth = worstDepth(trail, H);
  assert.ok(depth >= 0, `through the roof by ${(-depth).toFixed(3)} m`);
  // and without a ground query it is the plain tube, as before
  const plain = new Trail(new THREE.Scene());
  for (let i = 0; i < 60; i++) plain.update(1 / 60, new THREE.Vector3(-15 + i * 0.5, 10.1, 0));
  assert.ok(worstDepth(plain, H) < 0);
});
