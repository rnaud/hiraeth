// The Sky Stones' kit (src/levels/sky-stones-kit.js): the stalactites hung under a mushroom's cap are
// rooted in the underside as it is drawn (its outline drawing in, its ribs), never hanging under it by a gap;
// a leaning table tips about its neck.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { table } from '../src/levels/sky-stones-kit.js';

// (Vael II's own: the great table, a hoodoo out of the cloud, a rose cliff, the start plateau)
const TABLES = [
  { x: -30, z: -450, R: 60, top: 70, stalk: 17, capT: 7, under: 20, seed: 2.2, rib: 2.4, ribK: 36, seg: 160, colSeg: 26, outline: 0.1, flute: 0.12, fluteK: 13, foot: 1.5, neckR: 1.25, waist: 0.22, drips: { n: 40, len: [0.0434, 0.1102], r: 0.0272, band: [0.35, 0.95] } },
  { x: -120, z: -330, R: 26, top: 30, dome: 1.8, stalk: 8.5, capT: 3.2, under: 8, seed: 0.4, rib: 1, ribK: 30, seg: 112, colSeg: 18, flute: 0.1, fluteK: 9, foot: 1.6, neckR: 1.3, waist: 0.24, off: [2, -1.5], drips: { n: 9, len: [0.0372, 0.0928], r: 0.0306, band: [0.45, 0.92] } },
  { x: -480, z: -320, R: 44, top: 96, dome: 0.8, stalk: 36, capT: 8.8, under: 8.8, seed: 50, rib: 0.8, ribK: 30, seg: 96, colSeg: 18, flute: 0.1, fluteK: 14, foot: 0.9, neckR: 0.95, waist: 0.04, outline: 0.18, drips: { n: 20, len: [0.031, 0.0812], r: 0.0272, band: [0.55, 0.97] } },
  { x: 0, z: 0, R: 86, top: 40, stalk: 70, capT: 6, under: 11, seed: 1.3, rib: 1.3, ribK: 44, seg: 176, colSeg: 24, outline: 0.15, foot: 0.92, neckR: 0.97, waist: 0.03, ledges: 0.05, flute: 0.1, fluteK: 23, drips: { n: 44, len: [0.031, 0.087], r: 0.0238, band: [0.5, 0.97] } },
];

test('a cap\'s stalactites are rooted in its underside as drawn: none hangs under it by a gap', () => {
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0);
  let n = 0;
  for (const o of TABLES) {
    const t = table(o), mesh = new THREE.Mesh(t.vis, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    t.vis.computeVertexNormals();
    assert.equal(t.dripAt.length, o.drips.n);
    const r = o.R * o.drips.r;
    for (const [x, y, z] of t.dripAt) {
      ray.set(new THREE.Vector3(x, y - 1e-3, z), up);
      const hit = ray.intersectObject(mesh, false)[0];
      assert.ok(hit, `(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}): rock over it`);
      // the first face met going up: the cap's top seen from inside the rock (the root is in it), or the
      // underside seen from below, which may only be a sliver away (well under the root's own depth)
      const n0 = hit.face.normal.clone().transformDirection(mesh.matrixWorld);
      const gap = n0.y < 0 ? hit.distance : 0;
      assert.ok(gap < r * 0.3, `R ${o.R}: a drip ${gap.toFixed(2)} m under its cap (root depth ${(r * 2.6).toFixed(2)} m)`);
      n++;
    }
  }
  assert.ok(n > 100, `drips checked: ${n}`);
});

test('a leaning table tips about its neck: the cap stays where it was asked, its plane off the level', () => {
  const o = { x: 10, z: -20, R: 20, top: 30, stalk: 6, capT: 3, under: 6, seed: 3, seg: 64, colSeg: 12 };
  const flat = table(o), lean = table({ ...o, lean: [0.12, -0.08] });
  const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };
  const a = box(flat.vis), b = box(lean.vis);
  assert.ok(Math.abs(b.max.y - a.max.y) > 1, `the rim tipped up on one side: ${a.max.y.toFixed(2)} -> ${b.max.y.toFixed(2)}`);
  const neckY = o.top - o.capT - o.under;
  // (about the neck: the cap's centre moves far less than the stalk's foot does)
  const capC = (g) => { const p = g.attributes.position, v = new THREE.Vector3(), s = new THREE.Vector3(); let k = 0;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y > neckY) { s.add(v); k++; } } return s.divideScalar(k); };
  assert.ok(capC(lean.vis).distanceTo(capC(flat.vis)) < 2.5, 'the cap where it was asked');
  const footC = (g) => { const p = g.attributes.position, v = new THREE.Vector3(), s = new THREE.Vector3(); let k = 0;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y < a.min.y + 5) { s.add(v); k++; } } return s.divideScalar(k); };
  assert.ok(footC(lean.vis).distanceTo(footC(flat.vis)) > 10, 'the stalk slants under it');
});

test('a needle and a cap table are shaded by their round form, not their flutes: one clean terminator', async () => {
  const { needle: nd, table: tb } = await import('../src/levels/sky-stones-kit.js');
  const n = nd({ x: 0, y: 0, z: 0, H: 60, R: 5, seed: 3, seg: 18, rings: 28 }).vis;
  assert.ok(n.attributes.normal, 'its own shading normals');
  // across one ring's faces at mid height, the normals turn smoothly round the stalk: no flute faces turned away
  // across the faces at mid height, the shading normals turn round the stalk far more evenly than the faces do
  const P = n.attributes.position, N = n.attributes.normal, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let face = 0, shade = 0;
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1); c.fromBufferAttribute(P, i + 2);
    const cy = (a.y + b.y + c.y) / 3; if (cy < 20 || cy > 40) continue;
    const out = new THREE.Vector3((a.x + b.x + c.x) / 3, 0, (a.z + b.z + c.z) / 3).normalize();
    const fn = b.clone().sub(a).cross(c.clone().sub(a)).setY(0).normalize();
    const sn = new THREE.Vector3(N.getX(i) + N.getX(i + 1) + N.getX(i + 2), 0, N.getZ(i) + N.getZ(i + 1) + N.getZ(i + 2)).normalize();
    face = Math.max(face, Math.acos(Math.min(1, fn.dot(out)))); shade = Math.max(shade, Math.acos(Math.min(1, sn.dot(out))));
  }
  assert.ok(shade < face * 0.75, `the shading normal turns away from the stalk by ${shade.toFixed(2)} rad at worst, its facets by ${face.toFixed(2)}`);
  assert.ok(tb({ x: 0, z: 0, R: 20, stalk: 4, top: 30, flute: 0.14, fluteK: 7, rib: 0.4 }).vis.attributes.normal);
});
