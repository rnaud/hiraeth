import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DeferredWork, DEFER, dropInstance, INSTANCE_COPIES } from '../src/deferred.js';
import { Physics, dropBuriedFloraSteps, dropBuriedInstancesSteps } from '../src/physics.js';
import { runSteps } from '../src/load-steps.js';
import { tileScene } from '../src/perf.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A clock that moves only when a job runs (each job takes `cost` ms). */
function clocked(cost = 1) {
  let t = 0;
  return { now: () => t, tick: () => { t += cost; } };
}

test('the nearest jobs to the traveller go first, within the frame budget', () => {
  const c = clocked(1), order = [];
  const q = new DeferredWork({ budget: 3, guard: 0, now: c.now });
  for (const x of [50, 10, 300, 20, 200]) q.add(x, 0, 0, () => { order.push(x); c.tick(); });
  assert.equal(q.pending, 5);
  assert.equal(q.run(V(0, 0, 0)), 3, 'three 1 ms jobs in a 3 ms budget');
  assert.deepEqual([...order.slice(0, 2)].sort((a, b) => a - b), [10, 20], 'the nearest cell first (in it, any order)');
  assert.equal(order[2], 50);
  q.run(V(0, 0, 0));
  assert.deepEqual(order.slice(3), [200, 300]);
  assert.equal(q.pending, 0);
  assert.equal(q.run(V(0, 0, 0)), 0, 'nothing left: nothing done');
});

test('a traveller who moves (a teleport, a fast ride) is followed: the nearest round where he is now', () => {
  const c = clocked(1), order = [];
  const q = new DeferredWork({ budget: 1, guard: 0, now: c.now });
  for (const x of [0, 100, 1000, 1100]) q.add(x, 0, 0, () => { order.push(x); c.tick(); });
  q.run(V(0, 0, 0));
  q.run(V(1050, 0, 0));
  assert.deepEqual(order, [0, 1000]);
  q.run(V(1050, 0, 0));
  assert.deepEqual(order, [0, 1000, 1100]);
  q.add(1060, 0, 0, () => { order.push(1060); c.tick(); });   // (new work near him: found before the far rings)
  q.run(V(1050, 0, 0));
  assert.deepEqual(order, [0, 1000, 1100, 1060]);
});

test('what is within the guard is done in the frame it comes within, whatever the budget', () => {
  const c = clocked(5), done = [];
  const q = new DeferredWork({ budget: 1, guard: 30, now: c.now });
  for (const x of [5, 10, 25, 40, 400]) q.add(x, 0, 0, () => { done.push(x); c.tick(); });
  q.run(V(0, 0, 0));
  assert.deepEqual(done.slice(0, 3).sort((a, b) => a - b), [5, 10, 25], 'all three inside 30 m, though each costs the whole budget');
  assert.ok(!done.includes(400));
});

test('need() and needSteps() finish a place before it is shown; cancel and flush', () => {
  const done = [];
  const q = new DeferredWork({ guard: 0 });
  for (const x of [0, 5, 500, 505, 2000]) q.add(x, 0, 0, () => done.push(x), x >= 2000 ? 'far' : '');
  assert.equal(q.need(V(500, 0, 0), 10), 2);
  assert.deepEqual(done, [500, 505]);
  let yields = 0;
  const g = q.needSteps([V(0, 0, 0)], 10, 1);
  for (let r = g.next(); !r.done; r = g.next()) yields++;
  assert.deepEqual(done.sort((a, b) => a - b), [0, 5, 500, 505]);
  assert.ok(yields >= 1, 'it gives the load its slices');
  assert.equal(q.cancel('far'), 1);
  assert.equal(q.pending, 0);
  q.add(1, 0, 0, () => done.push(1));
  assert.equal(q.flush(), 1);
  assert.ok(done.includes(1));
});

test('a job that throws does not stop the queue', () => {
  const q = new DeferredWork({ guard: 0 }), done = [];
  const warn = console.warn; console.warn = () => {};
  try {
    q.add(0, 0, 0, () => { throw new Error('boom'); });
    q.add(1, 0, 0, () => done.push(1));
    q.flush();
  } finally { console.warn = warn; }
  assert.deepEqual(done, [1]);
});

/** A floor, a house at the origin, trees in it, outside it and far away (instanced, walk-through). */
function town() {
  const scene = new THREE.Scene();
  const box = (x, y, z, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); scene.add(m); };
  box(0, -0.5, 0, 2000, 1, 2000);
  box(0, 4, 0, 8, 8, 8);         // a house by the spawn
  box(600, 4, 0, 8, 8, 8);       // a house far away
  const at = [V(0, 0, 0), V(10, 0, 0), V(600, 0, 0), V(610, 0, 0)];
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 6, 6).translate(0, 3, 0), new THREE.MeshBasicMaterial(), at.length);
  trees.userData.noCollide = true;
  at.forEach((p, i) => trees.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  scene.add(trees);
  return { scene, trees, physics: new Physics(scene) };
}
const scales = (mesh) => Array.from({ length: mesh.instanceMatrix.count }, (_, i) => { const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m); return +V().setFromMatrixScale(m).y.toFixed(3); });

test('the buried trees deferred: the near ones checked first, the far ones later, the same ones dropped', () => {
  const now = town();
  assert.equal(runSteps(dropBuriedFloraSteps(now.scene, now.physics)), 2, 'both trees inside a house');
  const later = town(), q = new DeferredWork({ guard: 0 });
  assert.equal(runSteps(dropBuriedFloraSteps(later.scene, later.physics, { defer: q })), 4, 'every tree queued');
  assert.deepEqual(scales(later.trees), [1, 1, 1, 1], 'nothing dropped yet');
  runSteps(q.needSteps([V(0, 0, 0)], DEFER.near));
  assert.deepEqual(scales(later.trees), [0, 1, 1, 1], 'the one near the spawn, before the first frame');
  q.flush();
  assert.deepEqual(scales(later.trees), scales(now.trees), 'in the end the same as checking all at once');
  assert.deepEqual(scales(later.trees), [0, 1, 0, 1]);
});

test('a tree dropped after the scene was tiled is dropped in its tile too', () => {
  const { scene, physics } = town();
  // (a big spread-out set, as tileSceneSteps cuts: 400 trees in a line, two of them in the far house)
  const n = 400, trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 6, 6).translate(0, 3, 0), new THREE.MeshBasicMaterial(), n);
  trees.userData.noCollide = true;
  for (let i = 0; i < n; i++) trees.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i === 7 ? 600 : 20 + i * 2.5, 0, i === 7 ? 0 : 30));
  scene.add(trees);
  const q = new DeferredWork({ guard: 0 });
  runSteps(dropBuriedInstancesSteps(trees, physics, [1, 3.5], { defer: q }));
  tileScene(scene);
  assert.equal(trees.count, 0, 'tiled: the source draws nothing');
  const copy = INSTANCE_COPIES.get(trees)?.[7];
  assert.ok(copy, 'its copy is known');
  q.flush();
  const m = new THREE.Matrix4();
  copy[0].getMatrixAt(copy[1], m);
  assert.equal(V().setFromMatrixScale(m).y, 0, 'gone from its tile');
  trees.getMatrixAt(8, m);
  assert.equal(V().setFromMatrixScale(m).y, 1, 'its neighbour stays');
});

test('dropInstance sends only the instance it changed', () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 10);
  for (let i = 0; i < 10; i++) mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i, 0, 0));
  mesh.instanceMatrix.clearUpdateRanges();
  dropInstance(mesh, 4);
  assert.deepEqual(mesh.instanceMatrix.updateRanges, [{ start: 64, count: 16 }]);
  const m = new THREE.Matrix4(); mesh.getMatrixAt(4, m);
  assert.equal(V().setFromMatrixPosition(m).x, 4, 'scaled to nothing where it stood');
  assert.equal(V().setFromMatrixScale(m).x, 0);
});

test('a job with a reach is near when its edge is; a forced job knows it is forced', () => {
  const q = new DeferredWork({ budget: 5, guard: 30 }), seen = [];
  q.add(100, 0, 0, () => seen.push(['wide', q.urgent]), '', 75);   // (its middle 100 m off, its edge 25 m)
  q.add(60, 0, 0, () => seen.push(['narrow', q.urgent]));
  q.add(500, 0, 0, () => seen.push(['far', q.urgent]));
  assert.equal(q.need(V(0, 0, 0), 30), 1, 'only the wide one, by its edge');
  assert.deepEqual(seen, [['wide', true]]);
  q.run(V(0, 0, 0));
  assert.deepEqual(seen.slice(1), [['narrow', false], ['far', false]], 'the budget\'s jobs are not urgent');
  assert.equal(q.urgent, false);
});
