// Moving colliders (physics.addMover: the Buried Machine's great wheel; docs/systems/movement.md, "Contact"):
// the shape collides where its object stands at the last syncMovers(), rays and capsules alike, and says how
// fast its surface moves; what you stand on carries you (src/carriers.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Physics, moverVelocity } from '../src/physics.js';
import { moverCarrier } from '../src/carriers.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function world() {
  const scene = new THREE.Scene();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(100, 1, 100), new THREE.MeshBasicMaterial());
  floor.position.y = -0.5;
  scene.add(floor);
  // a plank 10 m long turning about a horizontal axle (z) 5 m up: a paddle of a wheel
  const hub = new THREE.Group();
  hub.position.set(0, 5, 0);
  hub.userData.noCollide = true;   // (left out of the still bake: it moves)
  const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 2).translate(5, 0, 0), new THREE.MeshBasicMaterial());
  hub.add(plank);
  scene.add(hub);
  const physics = new Physics(scene);
  const mover = physics.addMover(hub);
  return { scene, physics, hub, mover };
}

test('a moving collider is met where it stands now, by rays and capsules, and not where it stood', () => {
  const { physics, hub, mover } = world();
  assert.ok(mover.moving && mover.triangles === 12);
  assert.ok(Math.abs(physics.groundAt(6, 20, 0) - 5.25) < 1e-4, 'level: its top');
  assert.equal(physics.groundMover, mover, 'and the ground is the mover');
  assert.ok(Math.abs(physics.groundAt(-6, 20, 0)) < 1e-4, 'beside it: the floor');
  assert.equal(physics.groundMover, null);
  hub.rotation.z = Math.PI / 2;   // the plank stands straight up
  assert.ok(Math.abs(physics.groundAt(6, 20, 0) - 5.25) < 1e-4, '(not until it is synced)');
  physics.syncMovers(1 / 60);
  assert.ok(Math.abs(physics.groundAt(6, 20, 0)) < 1e-4, 'turned away: the floor');
  assert.ok(Math.abs(physics.groundAt(0.1, 20, 0) - 15) < 1e-3, 'its end, 10 m over the axle');
  const n = physics.rayHit(V(-5, 10, 0), V(1, 0, 0), 10);
  assert.ok(n && Math.abs(n.point.x + 0.25) < 1e-3 && n.normal.x < -0.99 && n.mover === mover, 'a wall now, its face turned with it');
  const p = V(0.3, 8, 0);
  assert.ok(physics.pushCapsule(p, 0.4, 0, 1.8), 'a capsule through it is pushed out');
  assert.ok(Math.abs(Math.abs(p.x) - 0.65) < 0.02, `to its side (${p.x.toFixed(3)})`);
  assert.equal(physics.pushCapsule(V(6, 1, 0), 0.4, 0.6, 1.8), null, 'and where it was is free');
  assert.ok(physics.embedded(V(0, 8, 0)), 'inside it is inside');
});

test('a moving collider says how fast its surface moves, and what stands on it is carried at that speed', () => {
  const { physics, hub, mover } = world();
  const w = 0.5, dt = 1 / 60;
  hub.rotation.z = w * dt;
  physics.syncMovers(dt);
  const v = moverVelocity(mover, V(8, 5, 0));
  // ω × r: about the z axle, 8 m out along x, it rises at 4 m/s
  assert.ok(Math.abs(v.y - w * 8) < 0.01 && Math.abs(v.x) < 0.05 && Math.abs(v.z) < 1e-6, v.toArray().join(', '));
  assert.ok(moverVelocity(mover, V(0, 5, 0)).length() < 1e-6, 'still on the axle');
  const c = moverCarrier(mover, V(8, 5, 0));
  assert.ok(c.vel.distanceTo(v) < 1e-9);
  assert.equal(moverCarrier(null, V()), null);
  physics.syncMovers(dt);   // (it did not move since)
  assert.ok(moverVelocity(mover, V(8, 5, 0)).length() < 1e-6);
  physics.removeCollider(mover);
  assert.ok(Math.abs(physics.groundAt(0.1, 20, 0)) < 1e-4, 'removed: gone');
});
