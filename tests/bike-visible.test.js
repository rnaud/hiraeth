import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMatrixCache } from '../src/matrix-cache.js';
import { Physics } from '../src/physics.js';
import { Hoverbike } from '../src/bike.js';

// Issue #184: "The hover bike is invisible when I'm riding it." The game's matrix walk (src/matrix-cache.js, the web
// game's and the Unity bridge's) forces a child only when its parent's world matrix changed in that walk; the tank's
// socket on the bike was read while ridden (src/fluid-tool.js updateDock: sock.updateWorldMatrix(true, false), three's
// own then), which moved the bike's body world matrix without a word to its meshes, so the walk left every mesh where
// the bike was boarded, behind the rider. Ridden over a frame loop as the game runs it, each of the bike's meshes must
// be drawn where the bike is, and shown.

installMatrixCache();

function world() {
  const scene = new THREE.Scene();
  const m = new THREE.Mesh(new THREE.BoxGeometry(800, 1, 800)); m.position.set(0, -0.5, 0); scene.add(m);
  return { scene, physics: new Physics(scene) };
}

test('ridden, the hoverbike’s meshes go with it and are shown (issue #184)', () => {
  const { scene, physics } = world();
  const bike = new Hoverbike(physics, { floor: 0 });   // (the slab, as the floor: its first ground is looked for from far above)
  scene.add(bike.object);
  const meshes = [];
  bike.object.traverse((o) => { if (o.isMesh) meshes.push(o); });
  assert.ok(meshes.length > 3, 'the bike has meshes');
  // a tank in its socket, as the fluid tool puts it there while ridden
  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.2));
  bike.socket.add(tank);
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const dt = 1 / 60, input = { KeyW: true };
  scene.updateMatrixWorld();
  for (let f = 0; f < 60 * 4; f++) {
    bike.update(dt, f % 90 < 60 ? input : { KeyW: true, KeyD: true });
    // the tool's dock, each frame before the frame's walk (src/fluid-tool.js updateDock)
    bike.socket.updateWorldMatrix(true, false);
    bike.socket.getWorldScale(new THREE.Vector3());
    scene.updateMatrixWorld();   // (main.js renderFrame: the frame's one walk)
  }
  assert.ok(bike.pos.length() > 40, `it rode off (${bike.pos.length().toFixed(0)} m)`);
  for (const m of [...meshes, tank]) {
    assert.ok(shown(m), 'every mesh of the bike is shown');
    const walked = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
    assert.ok(walked.distanceTo(bike.pos) < 3, `a mesh drawn ${walked.distanceTo(bike.pos).toFixed(1)} m from the bike`);
  }
});

test('three’s updateWorldMatrix through the cache: the siblings of what it makes follow on the next walk', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), body = new THREE.Group(), mesh = new THREE.Mesh(), seat = new THREE.Object3D();
  scene.add(root); root.add(body); body.add(mesh, seat);
  scene.updateMatrixWorld();
  root.position.set(10, 0, 0);
  seat.getWorldPosition(new THREE.Vector3());   // updateWorldMatrix(true, false): the root and the body made, the seat too
  scene.updateMatrixWorld();
  assert.equal(mesh.matrixWorld.elements[12], 10, 'the mesh beside the seat moved with its parent');
  // and updateChildren walks them as three does
  root.position.set(-4, 0, 0);
  root.updateWorldMatrix(false, true);
  assert.equal(mesh.matrixWorld.elements[12], -4);
});
