// src/levels/underwater-kit.js glassColumns (issue #457): the bubbles laid out later, only the columns the frame's camera
// sees, draw what laying out every column each frame draws. Two sets of the same columns, one laid out every frame (as
// before), one with `later` and draw(camera), side by side over a walk that turns the camera, cuts it, goes past `near`
// and back, holds the clock: every bubble in the camera's frustum has the same matrix, bit for bit, every frame; and the
// columns past `near` (seen from afar) the same as well.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { glassColumns } from '../src/levels/underwater-kit.js';
import { mulberry32 } from '../src/noise.js';

const COLS = [
  { x: 0, z: 0, r: 4.2, y0: -0.2, y1: 40 },
  { x: -30, z: 72, r: 1.3, y0: -2, y1: 60 },
  { x: 30, z: -40, r: 1.5, y0: -1, y1: 60 },
  { x: 80, z: -150, r: 1.3, y0: -3, y1: 60 },
  { x: -80, z: -130, r: 1.2, y0: -2, y1: 60 },
];
const fakeKit = () => ({ group: new THREE.Group(), noShadow: [], add() {}, mover() {} });
const M = { column: null, frame: null, bubble: new THREE.MeshBasicMaterial() };

function run({ blind = false } = {}) {
  const A = glassColumns(fakeKit(), M, COLS, { mover: false, near: 90 });
  const B = glassColumns(fakeKit(), M, COLS, { mover: false, near: 90 });
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 2000);
  const rng = mulberry32(457);
  const at = new THREE.Vector3(), f = new THREE.Frustum(), pm = new THREE.Matrix4(), ma = new THREE.Matrix4(), mb = new THREE.Matrix4();
  const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), sph = new THREE.Sphere();
  let t = 0, yaw = 0, seen = 0, far = 0, bad = 0;
  for (let frame = 0; frame < 900; frame++) {
    // (a walk out past near of the plaza and back, the camera turning at up to 400°/s, a cut now and then, the clock held a while)
    const phase = frame / 900 * Math.PI * 2;
    at.set(Math.sin(phase) * 110, 0, -40 + Math.cos(phase * 2) * 110);
    if (frame % 97 === 0) yaw = rng() * Math.PI * 2; else yaw += (rng() - 0.5) * 0.23;
    if (!(frame > 300 && frame < 340)) t += 1 / 60;
    camera.position.set(at.x - Math.sin(yaw) * 6, 3 + rng() * 30, at.z - Math.cos(yaw) * 6);
    const aim = COLS[Math.floor(frame / 97) % COLS.length];
    if (frame % 3) camera.lookAt(aim.x + Math.sin(yaw) * 20, 2 + rng() * 25, aim.z + Math.cos(yaw) * 20);
    else camera.lookAt(at.x + Math.sin(yaw) * 20, 2 + rng() * 25, at.z + Math.cos(yaw) * 20);
    A.update(t, at);
    B.update(t, at, true);
    camera.updateMatrixWorld();
    if (!blind) B.draw(camera);
    if (frame % 13 === 5 && !blind) B.draw(camera);   // (drawn twice in a frame: a capture)
    f.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    assert.equal(B.mesh.count, A.mesh.count);
    for (let i = 0; i < A.mesh.count; i++) {
      A.mesh.getMatrixAt(i, ma);
      ma.decompose(p, q, s);
      const c = COLS.find((c, k) => i < COLS.slice(0, k + 1).reduce((n, c) => n + Math.round((c.y1 - c.y0) * c.r * 2.6), 0));
      const isFar = Math.hypot(at.x - c.x, at.z - c.z) > 90;
      if (!f.intersectsSphere(sph.set(p, Math.max(s.x, 1e-3))) && !isFar) continue;
      B.mesh.getMatrixAt(i, mb);
      if (isFar) far++; else seen++;
      if (!ma.elements.every((v, k) => Object.is(v, mb.elements[k]))) bad++;
    }
  }
  return { seen, far, bad };
}

test('the bubbles in view, and those past near, are laid out as every frame would lay them out', () => {
  const r = run();
  assert.ok(r.seen > 30000 && r.far > 30000, JSON.stringify(r));
  assert.equal(r.bad, 0, JSON.stringify(r));
});

test('the check sees a set never drawn (draw skipped): its bubbles in view stand still', () => {
  const r = run({ blind: true });
  assert.ok(r.bad > 1000, JSON.stringify(r));
});

test('a bubble laid out is the matrix three composes for it, to the bit', () => {
  const G = glassColumns(fakeKit(), M, COLS, { mover: false });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), got = new THREE.Matrix4();
  const want = new Float32Array(16);
  let n = 0;
  for (const t of [0, 0.37, 12.5, 1234.567, -3.2]) {
    G.update(t);
    G.bubbles.forEach((b, k) => {
      const c = b.c;
      const L = c.y1 - c.y0 - 0.8, yy = c.y0 + 0.4 + ((b.y + t * b.v) % L + L) % L;
      const a = b.a + Math.sin(t * 0.8 + b.wob) * 0.12;
      p.set(c.x + Math.cos(a) * c.r * 1.01, yy, c.z + Math.sin(a) * c.r * 1.01);
      q.setFromEuler(e.set(0, Math.PI / 2 - a, 0));
      const sc = b.s * Math.min(1, (yy - c.y0) / 1.5, (c.y1 - yy) / 1.5);
      m.compose(p, q, s.set(sc, sc, sc)).toArray(want);
      const arr = G.mesh.instanceMatrix.array;
      for (let i = 0; i < 16; i++) { assert.ok(Object.is(arr[k * 16 + i], want[i]), `bubble ${k} at ${t}, element ${i}`); n++; }
    });
  }
  assert.ok(n > 50000);
});
