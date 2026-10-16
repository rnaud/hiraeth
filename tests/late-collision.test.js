import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SandDrifts, DRIFT_FITS } from '../src/sand-drifts.js';
import { Physics } from '../src/physics.js';
import { DeferredWork } from '../src/deferred.js';
import { LateCollision, queueLateCollision } from '../src/late-collision.js';

// The drifts' collision made after the first frame (src/late-collision.js, docs/systems/performance.md "Distant
// detail after the first frame"): the same triangles in the end, and every query answered as if baked at load.

/** A floor that turns up into slopes (where a skirt's chords stand over the height), blocks spread over 300 m. */
function sandWorld(later, most = Infinity) {
  const ground = { heightAt: (x, z) => Math.max(0, Math.sin(x * 0.05) * 6 + Math.cos(z * 0.04) * 4) };
  const scene = new THREE.Scene();
  for (let i = 0; i < 24; i++) {
    const x = ((i * 37) % 300) - 150, z = ((i * 71) % 300) - 150;
    const m = new THREE.Mesh(new THREE.BoxGeometry(4 + (i % 3) * 2, 6, 3 + (i % 4)), new THREE.MeshBasicMaterial());
    m.position.set(x, ground.heightAt(x, z) + 2, z); m.rotation.y = i * 0.7;
    scene.add(m);
  }
  const d = new SandDrifts({ heightAt: (x, z) => ground.heightAt(x, z), seed: 5 }).addScene(scene);
  scene.add(d.build(new THREE.MeshBasicMaterial()));
  DRIFT_FITS.later = later; DRIFT_FITS.most = most;
  try { d.raise(ground); } finally { DRIFT_FITS.later = false; DRIFT_FITS.most = Infinity; }
  const pieces = DRIFT_FITS.pending.splice(0);
  return { scene, ground, d, pieces, physics: new Physics(scene, ground) };
}
const triKey = (a, i) => Array.from(a.subarray(i, i + 9), (v) => v.toFixed(4)).join(',');
const trisOf = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 9) out.push(triKey(arr, i)); return out.sort(); };

const now = sandWorld(false);
const fitMesh = now.d.group.children.find((m) => !m.userData.drifts);

test('the pieces make between them the triangles the load made, each once', () => {
  assert.ok(fitMesh, 'baked at load: a hidden collision mesh');
  const later = sandWorld(true);
  assert.ok(later.pieces.length > 20, `cut into pieces (${later.pieces.length})`);
  assert.ok(!later.d.group.children.some((m) => !m.userData.drifts), 'nothing baked at load');
  const made = later.pieces.map((p) => p.make()).filter(Boolean);
  const all = new Float32Array(made.reduce((s, a) => s + a.length, 0));
  let o = 0; for (const a of made) { all.set(a, o); o += a.length; }
  assert.deepEqual(trisOf(all), trisOf(fitMesh.geometry.attributes.position.array));
  assert.equal(later.d.group.userData.fitTriangles, now.d.group.userData.fitTriangles);
});

test('a query before its piece is made answers as the load would have: rays, footing, capsules', () => {
  const later = sandWorld(true), q = new DeferredWork({ guard: 0 });
  queueLateCollision(later.physics, q, later.pieces);
  const late = later.physics.late;
  assert.ok(late instanceof LateCollision && late.pending === later.pieces.length);
  let rand = 1; const R = () => ((rand = (rand * 16807) % 2147483647) / 2147483647);
  const V = new THREE.Vector3(), D = new THREE.Vector3();
  for (let n = 0; n < 400; n++) {
    const x = R() * 320 - 160, z = R() * 320 - 160, y = now.ground.heightAt(x, z);
    assert.equal(later.physics.groundAt(x, y + 3, z), now.physics.groundAt(x, y + 3, z), `footing at ${x}, ${z}`);
    V.set(x, y + 0.5 + R() * 2, z); D.set(R() - 0.5, (R() - 0.5) * 0.3, R() - 0.5).normalize();
    const far = n < 40 ? 4 + R() * 10 : R() < 0.2 ? Infinity : 5 + R() * 300;   // (short ones first: a person's footing, the camera)
    assert.equal(later.physics.rayDistance(V, D, far), now.physics.rayDistance(V, D, far), 'a ray');
    const a = V.clone(), b = V.clone();
    const pa = later.physics.pushCapsule(a, 0.4, 0, 1.6), pb = now.physics.pushCapsule(b, 0.4, 0, 1.6);
    assert.equal(!!pa, !!pb); assert.ok(a.distanceTo(b) < 1e-9, 'a capsule pushed the same');
    if (n === 39) assert.ok(late.pending > 0 && late.made > 0, `only what was asked about was made (${late.made} of ${later.pieces.length})`);
  }
  q.flush();
  assert.equal(late.pending, 0);
  assert.equal(late.parts.length, 1, 'once all made, one collider');
  assert.equal(late.triangles, fitMesh.geometry.attributes.position.count / 3);
  assert.equal(late.extras.length, 1);
  assert.ok(!later.physics.extras.some((e) => e.late), 'its own list: the colliders added stay as they were');
});

test('the queue makes what comes within the guard, a piece by its edge; the parts stay few as they come', () => {
  const later = sandWorld(true), q = new DeferredWork({ budget: 0, guard: 40 });
  queueLateCollision(later.physics, q, later.pieces);
  const late = later.physics.late, p = new THREE.Vector3(0, 0, 0);
  q.run(p);
  for (const piece of later.pieces) {
    const d = Math.hypot(piece.x - p.x, piece.y - p.y, piece.z - p.z) - piece.r;
    if (d <= 40) assert.ok(!late.cells.size || ![...late.cells.values()].some((c) => c.some((x) => x.make === piece.make)), 'a piece reaching within the guard is made');
  }
  let most = 0;
  while (q.pending) { q.run(p, 0.0001); q.need(new THREE.Vector3((most % 7) * 40 - 140, 0, 0), 30); most = Math.max(most, late.parts.length); if (q.pending) q.run(p, 1); }
  assert.ok(most <= 12, `never more than a dozen colliders (${most})`);
  assert.equal(late.parts.length, 1);
});

test('a hit on the late sand is the ground (footsteps): not something built', () => {
  const later = sandWorld(true), q = new DeferredWork({ guard: 0 });
  queueLateCollision(later.physics, q, later.pieces);
  q.flush();
  const T = fitMesh.geometry.attributes.position.array;
  const x = (T[0] + T[3] + T[6]) / 3, z = (T[2] + T[5] + T[8]) / 3, y = Math.max(T[1], T[4], T[7]) + 2;
  later.physics.groundAt(x, y, z); now.physics.groundAt(x, y, z);
  assert.equal(later.physics.groundKind, now.physics.groundKind);
});

test('with no worker to merge in (the engines), parts stop merging at mergeMax: the same answers from a few parts', () => {
  const total = fitMesh.geometry.attributes.position.count / 3, cap = Math.ceil(total / 6);
  const later = sandWorld(true), q = new DeferredWork({ guard: 0 });
  queueLateCollision(later.physics, q, later.pieces, { mergeMax: cap });
  const late = later.physics.late;
  q.flush();
  assert.equal(late.pending, 0);
  assert.equal(late.triangles, total);
  const biggest = Math.max(...later.pieces.map((p) => (p.make()?.length ?? 0) / 9));
  assert.ok(late.parts.length > 1 && late.parts.length <= 24, `a few parts (${late.parts.length})`);
  for (const p of late.parts) assert.ok(p.tris.length / 9 <= Math.max(cap, biggest), `no part merged past the cap (${p.tris.length / 9} > ${cap})`);
  assert.equal(late.extras.length, late.parts.length);
  let rand = 7; const R = () => ((rand = (rand * 16807) % 2147483647) / 2147483647);
  const V = new THREE.Vector3(), D = new THREE.Vector3();
  for (let n = 0; n < 300; n++) {
    const x = R() * 320 - 160, z = R() * 320 - 160, y = now.ground.heightAt(x, z);
    assert.equal(later.physics.groundAt(x, y + 3, z), now.physics.groundAt(x, y + 3, z), `footing at ${x}, ${z}`);
    V.set(x, y + 0.5 + R() * 2, z); D.set(R() - 0.5, (R() - 0.5) * 0.3, R() - 0.5).normalize();
    assert.equal(later.physics.rayDistance(V, D, 300), now.physics.rayDistance(V, D, 300), 'a ray');
  }
});

test('DRIFT_FITS.most (the engines): a dense square cut in parts, the same triangles between them', () => {
  const whole = sandWorld(true), cut = sandWorld(true, 20);
  assert.ok(cut.pieces.length > whole.pieces.length, `more pieces (${whole.pieces.length} → ${cut.pieces.length})`);
  const made = cut.pieces.map((p) => p.make()).filter(Boolean);
  const all = new Float32Array(made.reduce((s, a) => s + a.length, 0));
  let o = 0; for (const a of made) { assert.ok(a.length / 9 <= 20); all.set(a, o); o += a.length; }
  assert.deepEqual(trisOf(all), trisOf(fitMesh.geometry.attributes.position.array));
});
