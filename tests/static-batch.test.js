// The world's still meshes drawn by a few batches (src/static-batch.js, docs/systems/xbox.md "Towards 60 on the
// Xbox"): which meshes are taken, materials differing only in their colours (and band, grid, flat) sharing a view
// batch, the ids and textures the surface shader reads, each pass drawing what would have drawn itself (shown, in
// the frustum, in its current geometry), a moved mesh followed, a changed material's meshes drawing themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { StaticBatches, staticReason, restKey, attributeKey, batchCopy, numbersOf, shownUnder, VARIES, BATCH_ID } from '../src/static-batch.js';
import { makeMaterial, MODE_STRATA } from '../src/materials.js';

const box = () => new THREE.BoxGeometry(1, 1, 1);
function world() {
  const scene = new THREE.Scene();
  const a = makeMaterial({ color: '#aa3322', key: 'test.static.a' }), b = makeMaterial({ color: '#2233aa', key: 'test.static.b' });
  const odd = makeMaterial({ color: '#2233aa', weathered: 1, key: 'test.static.odd' });   // (other defines: another group)
  const meshes = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(box(), i % 2 ? b : a); m.position.set(i * 3, 0, -10); scene.add(m); meshes.push(m); }
  const lone = new THREE.Mesh(box(), odd); lone.position.set(0, 0, -20); scene.add(lone);
  const mover = new THREE.Group(); scene.add(mover);
  const carried = new THREE.Mesh(box(), a); mover.add(carried);
  return { scene, a, b, odd, meshes, lone, mover, carried };
}
const camera = () => { const c = new THREE.PerspectiveCamera(60, 1, 0.1, 500); c.updateMatrixWorld(); c.updateProjectionMatrix(); return c; };

test('which meshes a batch may take', () => {
  const m = makeMaterial({ color: '#ffffff', key: 'test.static.reason' });
  assert.equal(staticReason(new THREE.Mesh(box(), m)), '');
  assert.equal(staticReason(new THREE.InstancedMesh(box(), m, 2)), 'kind');
  assert.equal(staticReason(new THREE.Mesh(box(), new THREE.MeshBasicMaterial())), 'not surface');
  const glass = makeMaterial({ color: '#ffffff', key: 'test.static.glass' }).clone(); glass.transparent = true;
  assert.equal(staticReason(new THREE.Mesh(box(), glass)), 'material state');
  const sway = makeMaterial({ color: '#33aa33', sway: 1, key: 'test.static.sway' });
  assert.match(staticReason(new THREE.Mesh(box(), sway)), /^define /);
  const unculled = new THREE.Mesh(box(), m); unculled.frustumCulled = false;
  assert.equal(staticReason(unculled), 'unculled');
  const own = new THREE.Mesh(box(), m); own.onBeforeRender = () => {};
  assert.equal(staticReason(own), 'onBeforeRender');
  const flagged = new THREE.Mesh(box(), m); flagged.userData.dynamic = true;
  assert.equal(staticReason(flagged), 'flagged');
  const ranged = new THREE.Mesh(box(), m); ranged.geometry.setDrawRange(0, 6);
  assert.equal(staticReason(ranged), 'draw range');
});

test('materials that differ only in the values read per mesh share a key; any other difference splits them', () => {
  const a = makeMaterial({ color: '#aa3322', key: 'test.static.k1' }), b = makeMaterial({ color: '#2233aa', flat: true, key: 'test.static.k2' });
  assert.equal(restKey(a), restKey(b));
  const c = makeMaterial({ color: '#2233aa', glow: 0.3, key: 'test.static.k3' });
  assert.notEqual(restKey(a), restKey(c), 'a glow is not read per mesh');
  assert.ok(VARIES.includes('uColor') && VARIES.includes('uFlat'));
  // merged meshes (S_VMAT) carry their colours, band size and grid per vertex: two such materials share a batch when
  // the rest agrees (each merged group of the City-Shaft's towers was a draw of its own, issue #111)
  const v1 = makeMaterial({ color: '#f1e6cf', mode: MODE_STRATA, strataSize: 3, grid: 2, perVertex: true, key: 'test.static.v1' });
  const v2 = makeMaterial({ color: '#9fb2c6', mode: MODE_STRATA, strataSize: 5, grid: 4, perVertex: true, key: 'test.static.v2' });
  assert.equal(restKey(v1), restKey(v2));
  assert.notEqual(restKey(v1), restKey(makeMaterial({ color: '#9fb2c6', mode: MODE_STRATA, strataSize: 5, grid: 4, key: 'test.static.v3' })), 'and never with a plain one');
  assert.notEqual(attributeKey(new THREE.BoxGeometry()), attributeKey(new THREE.BoxGeometry().toNonIndexed()));
});

test('a batch copy carries the mesh id on every vertex, indexed if the batch is', () => {
  const g = new THREE.BoxGeometry().toNonIndexed();
  const c = batchCopy(g, 7, ['position'], true);
  assert.deepEqual(Object.keys(c.attributes).sort(), ['aBatchId', 'position']);
  assert.ok(c.index && c.index.count === g.attributes.position.count);
  assert.ok([...c.attributes[BATCH_ID].array].every((x) => x === 7));
});

test('the still meshes go into batches; their layers off; movers left alone; one shadow batch for all', () => {
  const W = world();
  const S = new StaticBatches(W.scene, { keep: [W.mover] });
  assert.equal(S.view.length, 1, 'one view batch for the two colours');
  assert.equal(S.view[0].items.length, 6);
  assert.equal(S.view[0].material.defines.S_BATCH, 1);
  assert.equal(S.why.get(W.carried), 'mover');
  assert.equal(S.why.get(W.lone), 'few');
  for (const m of W.meshes) assert.equal(m.layers.mask, 0);
  assert.notEqual(W.lone.layers.mask, 0, 'too few of its kind: it draws itself');
  assert.equal(S.shadow.items.length, 7, 'every still mesh casts through the shadow batch, the lone one too');
  // the shared textures: each mesh's matrix and its own material's colour at its id
  for (const e of S.entries) {
    const mat = S.tables.matrices.image.data.subarray(e.id * 16, e.id * 16 + 16);
    assert.deepEqual([...mat], e.o.matrixWorld.elements.map(Math.fround));
    const v = S.tables.values.image.data;
    assert.ok(Math.abs(v[e.id * 16] - e.mat.uniforms.uColor.value.r) < 1e-6);
  }
  assert.equal(S.view[0]._matricesTexture, S.shadow._matricesTexture, 'one matrices texture for every batch');
});

test('a pass draws what would have drawn itself: shown, in the frustum; in front-to-back order by material', () => {
  const W = world();
  const S = new StaticBatches(W.scene, { keep: [W.mover] });
  const b = S.view[0], cam = camera();
  W.scene.updateMatrixWorld(true);
  b.onBeforeRender(null, W.scene, cam);
  const inView = W.meshes.filter((m) => new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)).intersectsObject(m)).length;
  assert.equal(b.drawn, inView);
  W.meshes[0].visible = false;
  b.onBeforeRender(null, W.scene, cam);
  assert.equal(b.drawn, inView - 1, 'a hidden mesh is not drawn');
  const order = b.list.map((it) => it.e.mat.id);
  assert.deepEqual(order, [...order].sort((x, y) => x - y));
  // an override pass (the shadow maps): nothing from the view's batches
  W.scene.overrideMaterial = new THREE.MeshBasicMaterial();
  b.onBeforeRender(null, W.scene, cam);
  assert.equal(b._multiDrawCount, 0);
});

test('a level of detail swapped in is copied into the batch at the next frame\'s update, never during a pass (issue #111)', () => {
  const W = world();
  const S = new StaticBatches(W.scene, { keep: [W.mover] });
  const b = S.view[0], cam = camera();
  W.scene.updateMatrixWorld(true);
  b.onBeforeRender(null, W.scene, cam);
  const before = b._geometryInfo.length, drawn = b.drawn, geometry = b.geometry;
  const it = b.items.find((x) => x.e.o === W.meshes[0]), was = it.cur;
  W.meshes[0].geometry = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
  // (in the pass: three has taken the batch's geometry and uploaded it already; the mesh is drawn as it was)
  b.onBeforeRender(null, W.scene, cam);
  assert.equal(b._geometryInfo.length, before, 'nothing copied in during the pass');
  assert.equal(b.geometry, geometry, 'the batch\'s geometry the one three is drawing');
  assert.equal(b.drawn, drawn, 'the mesh still drawn, its old level one frame more');
  assert.equal(it.cur, was);
  S.update();
  assert.equal(b._geometryInfo.length, before + 1, 'copied in before the next frame\'s passes');
  b.onBeforeRender(null, W.scene, cam);
  assert.notEqual(it.cur, was, 'drawn in its new level');
  S.update();
  assert.equal(b._geometryInfo.length, before + 1, 'once');
});

test('a level of detail that outgrows the batch\'s room grows it at the update, not in a pass (issue #111)', () => {
  const W = world();
  const S = new StaticBatches(W.scene, { keep: [W.mover] });
  const b = S.view[0], cam = camera();
  W.scene.updateMatrixWorld(true);
  b.onBeforeRender(null, W.scene, cam);
  const geometry = b.geometry;
  W.meshes[0].geometry = new THREE.SphereGeometry(1, 64, 48);   // (far more than the room left)
  b.onBeforeRender(null, W.scene, cam);
  assert.equal(b.geometry, geometry, 'no new geometry in the pass');
  S.update();
  assert.notEqual(b.geometry, geometry, 'grown before the passes');
  b.onBeforeRender(null, W.scene, cam);
  const it = b.items.find((x) => x.e.o === W.meshes[0]);
  assert.equal(it.cur, it.geo.get(W.meshes[0].geometry), 'drawn in the new level, copied into the grown batch');
  assert.ok(it.cur >= 0);
});

test('an indexed level of detail swapped into a batch with no index is unrolled into it, not sent back to drawing itself (issue #453)', () => {
  const scene = new THREE.Scene();
  const a = makeMaterial({ color: '#aa3322', key: 'test.static.unroll' });
  const meshes = [];
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(box().toNonIndexed(), a); m.position.set(i * 3, 0, -10); scene.add(m); meshes.push(m); }
  const S = new StaticBatches(scene);
  const b = S.view[0], cam = camera();
  assert.equal(b.geometry.index, null, 'a batch of meshes with no index has none');
  scene.updateMatrixWorld(true);
  b.onBeforeRender(null, scene, cam);
  const lod = new THREE.SphereGeometry(1, 8, 6);   // (lod.js's levels are indexed)
  meshes[0].geometry = lod;
  b.onBeforeRender(null, scene, cam);
  S.update();
  b.onBeforeRender(null, scene, cam);
  const e = S.entries.find((x) => x.o === meshes[0]), it = b.items.find((x) => x.e === e);
  assert.equal(e.out, false, 'still drawn by its batch');
  assert.equal(S.stats.released, 0);
  assert.equal(meshes[0].layers.mask, 0, 'its own draws still off');
  const gi = b._geometryInfo[it.cur];
  assert.equal(it.cur, it.geo.get(lod));
  assert.equal(gi.vertexCount, lod.index.count, 'one vertex per corner of each triangle');
  // (the triangles as the index drew them, in its order)
  const P = b.geometry.attributes.position.array, src = lod.attributes.position.array, I = lod.index.array;
  for (let k = 0; k < I.length; k++) for (let j = 0; j < 3; j++) assert.equal(P[(gi.vertexStart + k) * 3 + j], src[I[k] * 3 + j]);
});

test('a moved mesh is followed; a material changed beyond its colours sends its meshes back to drawing themselves', () => {
  const W = world();
  const S = new StaticBatches(W.scene, { keep: [W.mover] });
  const e = S.entries.find((x) => x.o === W.meshes[2]);
  W.meshes[2].position.x += 5; W.scene.updateMatrixWorld(true);
  S.update();
  assert.equal(S.tables.matrices.image.data[e.id * 16 + 12], Math.fround(W.meshes[2].matrixWorld.elements[12]));
  assert.ok(!e.out);
  // a colour change: written again
  W.a.uniforms.uColor.value.set('#00ff00');
  S.update();
  const ea = S.entries.find((x) => x.mat === W.a);
  assert.ok(Math.abs(S.tables.values.image.data[ea.id * 16 + 1] - 1) < 1e-6);
  assert.ok(!ea.out);
  // a glow: its meshes draw themselves again
  W.b.uniforms.uGlow.value = 0.5;
  S.update();
  const eb = S.entries.filter((x) => x.mat === W.b);
  assert.ok(eb.every((x) => x.out && x.o.layers.mask !== 0));
  W.b.uniforms.uGlow.value = 0;
});

test('off: every mesh draws itself again, and on again', () => {
  const W = world();
  const S = new StaticBatches(W.scene, { keep: [W.mover] });
  S.enabled = false;
  for (const m of W.meshes) assert.notEqual(m.layers.mask, 0);
  assert.ok(S.view.every((b) => !b.visible));
  S.enabled = true;
  for (const m of W.meshes) assert.equal(m.layers.mask, 0);
});

test('the shadow passes: the lone still mesh lends its shadow to the batch', () => {
  const W = world();
  const S = new StaticBatches(W.scene, { keep: [W.mover] });
  S.shadowsBegin();
  assert.equal(W.lone.layers.mask, 0);
  assert.ok(S.view.every((b) => !b.visible));
  S.shadowsEnd();
  assert.notEqual(W.lone.layers.mask, 0);
  assert.ok(S.view.every((b) => b.visible));
});

test('a mesh kept from the view\'s batches by its material alone casts through the shadow batch (issue #453)', () => {
  const W = world();
  const other = new THREE.Mesh(box(), new THREE.MeshBasicMaterial()); other.position.set(0, 0, -30); W.scene.add(other);
  const see = new THREE.Mesh(box(), new THREE.MeshBasicMaterial({ transparent: true })); W.scene.add(see);
  const held = new THREE.Mesh(box(), new THREE.MeshBasicMaterial()); W.mover.add(held);
  const S = new StaticBatches(W.scene, { keep: [W.mover] });
  assert.ok(S.entries.some((e) => e.o === other && !e.view), 'in the shadow batch, in no view batch');
  assert.ok(!S.entries.some((e) => e.o === see || e.o === held), 'not a see-through one, nor one a mover holds');
  assert.notEqual(other.layers.mask, 0, 'drawing itself in the view');
  S.shadowsBegin();
  assert.equal(other.layers.mask, 0, 'its own draw off in the shadow passes');
  const cam = new THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 100); cam.updateMatrixWorld();
  W.scene.updateMatrixWorld(true);
  S.shadow.onBeforeRender(null, W.scene, cam);
  assert.ok(S.shadow.list.some((it) => it.e.o === other), 'drawn by the shadow batch');
  S.shadowsEnd();
  assert.notEqual(other.layers.mask, 0);
  assert.equal(staticReason(other), 'not surface');
});

test('numbersOf reads every number of a uniform value', () => {
  assert.deepEqual(numbersOf(new THREE.Color(1, 0.5, 0), []), [1, 0.5, 0]);
  assert.deepEqual(numbersOf([new THREE.Vector2(1, 2), 3], []), [1, 2, 3]);
  assert.ok(shownUnder(new THREE.Object3D(), null) === false);
});

test('the surface shader reads a batched mesh by its id, its matrix as an instance\'s, its colours under S_BATCH', () => {
  const src = readFileSync(new URL('../src/materials.js', import.meta.url), 'utf8');
  assert.match(src, /#ifdef USE_BATCHING[\s\S]*in float aBatchId;/);
  assert.match(src, /mat4 instanceMatrix = batchMatrix\(aBatchId\);\s*#define USE_INSTANCING/);
  assert.match(src, /#if defined\(S_VMAT\) \|\| defined\(S_BATCH\)/);
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /statics\?\.drawShadows\(renderer, c\.cam\)/);
});

test('a subtree with only batched meshes is not walked by the passes; a mesh drawing itself again walks it again', () => {
  const W = world();
  const holder = new THREE.Group(); W.scene.add(holder);
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(box(), W.a); m.position.set(i, 1, -5); holder.add(m); }
  new StaticBatches(W.scene, { keep: [W.mover] });
  assert.equal(holder.renderSkip, true, 'every mesh under it batched');
  assert.ok(!W.scene.renderSkip && !W.mover.renderSkip);
  for (const m of W.meshes) assert.equal(m.renderSkip, true);
  assert.ok(!W.lone.renderSkip, 'a mesh drawing itself is walked');
  holder.add(new THREE.Mesh(box(), W.odd));
  assert.ok(!holder.renderSkip, 'something new under it: walked again');
  const S2 = new StaticBatches(world().scene);
  const e = S2.entries.find((x) => x.view);
  assert.equal(e.o.renderSkip, true);
  S2.release(e, 'test');
  assert.ok(!e.o.renderSkip, 'a released mesh: walked again');
  S2.enabled = false;
  assert.ok(S2.entries.every((x) => !x.o.renderSkip));
  assert.match(readFileSync(new URL('../scripts/three-program-keys.mjs', import.meta.url), 'utf8'), /object\.renderSkip === true/);
});
