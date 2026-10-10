// A body's repeated parts in one draw (src/part-batch.js, docs/systems/performance.md "A foe's repeated parts in one
// draw"): parts of one shape and material drawn as instances of one mesh, each instance the part's own matrix (so the
// surface shader sees what it saw), only the parts shown drawn, parts taken out of the body drawing themselves again;
// every archetype of the roster batched, with about half the draws.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchParts, sameShape, batchable, PartBatch } from '../src/part-batch.js';
import { makeMaterial } from '../src/materials.js';
import { ShadowCuller } from '../src/shadows.js';
import { installMatrixCache } from '../src/matrix-cache.js';
import { Foes } from '../src/foes.js';
import { ARCHETYPES } from '../src/enemies/archetypes.js';
import { GameState } from '../src/game-state.js';
import { clearTargets } from '../src/targets.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const near = (a, b, eps = 1e-5) => a.every((x, i) => Math.abs(x - b[i]) < eps);

/** A body: a root, four legs on pivots (the same cylinder, one material), a head, a glowing eye, a see-through veil. */
function body() {
  const root = new THREE.Group(), ink = makeMaterial({ color: '#443322', key: 'test.batch.ink' });
  const glow = makeMaterial({ color: '#ffeeaa', flat: true, glow: 0.9, key: 'test.batch.glow' });
  const glass = makeMaterial({ color: '#ffffff', key: 'test.batch.glass' }); glass.transparent = true;
  const legs = [0, 1, 2, 3].map((i) => {
    const p = new THREE.Group(); p.position.set(i - 1.5, 1, 0); root.add(p);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1, 6).translate(0, -0.5, 0), ink); p.add(m); return { p, m };
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), ink); head.position.set(0, 1.4, 0.5); root.add(head);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), glow); head.add(eye);
  const veil = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 4), glass); root.add(veil);
  return { root, legs, head, eye, veil };
}
const matrixOf = (b, i) => { const m = new THREE.Matrix4(); b.getMatrixAt(i, m); return m; };

test('sameShape compares the arrays, not the objects', () => {
  const a = new THREE.CylinderGeometry(0.1, 0.2, 1, 6), b = new THREE.CylinderGeometry(0.1, 0.2, 1, 6), c = new THREE.CylinderGeometry(0.1, 0.21, 1, 6);
  assert.ok(sameShape(a, b));
  assert.ok(!sameShape(a, c));
  assert.ok(!sameShape(a, new THREE.CylinderGeometry(0.1, 0.2, 1, 6).translate(0, 0.01, 0)));
  assert.ok(!sameShape(a, new THREE.CylinderGeometry(0.1, 0.2, 1, 7)));
});

test('the legs become one batch, the head one of its own; the glowing and the see-through parts stay as they are', () => {
  const B = body();
  const made = batchParts(B.root);
  assert.equal(made.length, 2);
  const legs = made.find((b) => b.count === 4), head = made.find((b) => b.count === 1);
  assert.ok(legs && head, 'four legs in one, the head alone');
  assert.ok(made.every((b) => b instanceof PartBatch && b.parent === B.root && b.userData.batch && b.userData.noHurt));
  for (const { m } of B.legs) assert.equal(m.layers.mask, 0, 'a batched part no longer draws itself');
  assert.ok(!batchable(B.eye) && B.eye.layers.mask !== 0, 'self-lit: out of the shadow passes by its own rule');
  assert.ok(!batchable(B.veil) && B.veil.layers.mask !== 0, 'see-through: its order of drawing kept');
  assert.equal(B.root.children.at(-1), made.at(-1), 'the batches come last, after the parts they read');
});

test('each instance is its part\'s own matrix, this frame: moved, hidden, and taken out', () => {
  const B = body();
  B.root.position.set(10, 0, -4); B.root.rotation.y = 0.7;
  const [legs] = batchParts(B.root).filter((b) => b.count === 4);
  // the kit moves the legs; the scene's update reads them
  B.legs[1].p.rotation.x = 0.9; B.legs[2].p.position.y = 1.3;
  B.root.updateMatrixWorld(true);
  B.legs.forEach(({ m }, i) => {
    const world = new THREE.Matrix4().multiplyMatrices(legs.matrixWorld, matrixOf(legs, i));
    assert.ok(near(world.elements, m.matrixWorld.elements), `leg ${i}: modelMatrix × instanceMatrix is its matrixWorld`);
  });
  // the bounds hold every leg
  const s = legs.boundingSphere.clone().applyMatrix4(legs.matrixWorld), box = new THREE.Box3();
  for (const { m } of B.legs) { box.setFromObject(m); assert.ok(s.distanceToPoint(box.getCenter(v())) <= 1e-6, 'inside the bounds'); }
  // a leg hidden (or its pivot): not drawn; the shown ones first
  B.legs[0].m.visible = false; B.legs[3].p.visible = false;
  B.root.updateMatrixWorld(true);
  assert.equal(legs.count, 2);
  [1, 2].forEach((leg, i) => assert.ok(near(new THREE.Matrix4().multiplyMatrices(legs.matrixWorld, matrixOf(legs, i)).elements, B.legs[leg].m.matrixWorld.elements), `instance ${i} is leg ${leg}`));
  // a leg taken out of the body (a machine's pieces flying apart) draws itself again
  const flying = B.legs[2].m; new THREE.Group().attach(flying);
  B.root.updateMatrixWorld(true);
  assert.notEqual(flying.layers.mask, 0);
  assert.equal(legs.count, 1);
  // none shown: the batch is hidden, as its parts were
  B.legs[1].m.visible = false;
  B.root.updateMatrixWorld(true);
  assert.equal(legs.count, 0); assert.equal(legs.visible, false);
  B.legs[1].m.visible = true;
  B.root.updateMatrixWorld(true);
  assert.equal(legs.visible, true);
  legs.undo();
  for (const { m } of B.legs) assert.notEqual(m.layers.mask, 0, 'undone: every part draws itself again');
});

test('every archetype of the roster is batched: about half the draws, nothing drawn twice', () => {
  clearTargets();
  const P = { pos: v(), vel: v(), heading: 0, onGround: true, health: 1, down: null, dead: false, frame: { up: v(0, 1, 0) }, hurt() {}, knockDown() { return true; }, flinch() {} };
  const flat = { groundAt: () => 0, rayDistance: () => Infinity, rayHit: () => null };
  const foes = new Foes({ scene: new THREE.Scene(), level: { spawn: v(0, 0, -500), foes: { waves: true } }, levelId: 'arena', physics: flat, player: P, settings: { enemies: 'normal' }, game: new GameState(null), tool: { drops: { add() {} } } });
  foes.setPractice('');
  let parts = 0, draws = 0;
  for (const id of Object.keys(ARCHETYPES).filter((a) => ARCHETYPES[a].status === 'built')) {
    const f = foes.add(id, v(0, 0, 5));
    foes.look(f, 1 / 60);
    f.model.group.updateMatrixWorld(true);
    const batched = new Set(f.batches.flatMap((b) => b.parts));
    f.model.group.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.userData.batch) parts++;
      if (o.layers.mask !== 0) draws++;
      if (batched.has(o)) assert.equal(o.layers.mask, 0, `${id}: a batched part is not drawn itself`);
      else if (!o.userData.batch) assert.ok(o.isSkinnedMesh || !batchable(o) || o.layers.mask !== 0, `${id}: every part is drawn`);
    });
    foes.remove(f);
  }
  assert.ok(draws < parts * 0.6, `${draws} meshes drawn for ${parts} parts`);
});

test('a batch of small parts is as small as one part for a shadow map\'s texel (shadows.js ShadowCuller)', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const mat = makeMaterial({ color: '#443322', key: 'test.batch.beads' });
  // a row of beads 6 cm across, spread over 4 m: the batch's bounds are big, each bead is not
  for (let i = 0; i < 20; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), mat); m.position.set(i * 0.2 - 2, 1, -20); root.add(m); }
  const [beads] = batchParts(root);
  assert.ok(Math.abs(beads.partRadius - 0.03) < 1e-9, 'one bead\'s radius');
  scene.updateMatrixWorld();
  assert.ok(beads.boundingSphere.radius > 1.9, 'the bounds hold the row');
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 5000);
  camera.position.set(0, 2, 0); camera.lookAt(0, 2, -10); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const cull = new ShadowCuller(scene);
  cull.begin(camera, new THREE.Vector3(0.3, 1, 0.2).normalize());
  assert.ok(cull.hide(1000, 1.1, 1600).includes(beads), 'a km-wide map (1.1 m texels): left out, as each bead was');
  for (const o of cull.items.map((it) => it.o)) o.visible = true;
  assert.ok(!cull.hide(30, 0.012, 200).includes(beads), 'a fine map (1.2 cm texels): drawn');
});

test('with the matrix cache (src/matrix-cache.js): a batched part that moves is drawn where it moved, one that does not keeps its place', () => {
  const was = THREE.Object3D.prototype.updateMatrixWorld;
  installMatrixCache(THREE.Object3D.prototype);
  try {
    const B = body();
    const [legs] = batchParts(B.root).filter((b) => b.count === 4);
    B.root.updateMatrixWorld();
    B.legs[1].p.rotation.x = 0.8; B.legs[3].p.position.y = 2;   // (the kit moves two legs; the others stay)
    B.root.updateMatrixWorld();
    B.legs.forEach(({ m }, i) => {
      const world = new THREE.Matrix4().multiplyMatrices(legs.matrixWorld, matrixOf(legs, i));
      assert.ok(near(world.elements, m.matrixWorld.elements), `leg ${i} where it is`);
    });
  } finally { THREE.Object3D.prototype.updateMatrixWorld = was; }
});

test('a batch switched off gives the parts back their own draws, and on again takes them', () => {
  const B = body();
  const [legs] = batchParts(B.root).filter((b) => b.count === 4);
  legs.enabled = false;
  B.root.updateMatrixWorld(true);
  assert.equal(legs.visible, false);
  for (const { m } of B.legs) assert.notEqual(m.layers.mask, 0);
  B.legs[2].p.rotation.z = 0.5;
  legs.enabled = true;
  assert.equal(legs.visible, true); assert.equal(legs.count, 4);
  for (const { m } of B.legs) assert.equal(m.layers.mask, 0);
  const world = new THREE.Matrix4().multiplyMatrices(legs.matrixWorld, matrixOf(legs, 2));
  assert.ok(near(world.elements, B.legs[2].m.matrixWorld.elements), 'where it moved while off');
});
