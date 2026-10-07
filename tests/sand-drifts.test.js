import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SandDrifts, DRIFT, hull2, footprintsOf, polyDistance, driftMaterial } from '../src/sand-drifts.js';
import { makeMaterial, MODE_TERRAIN } from '../src/materials.js';

// Sand banked against things (docs/systems/worlds.md): footprints cut at a solid's foot, a fillet of sand round
// each, higher facing the wind, the skirts drawn in the ground's own material and flagged for post.js.

const flat = () => 0;

test('a footprint is the solid cut at its foot: one for a wall, two for an arch (none across its passage)', () => {
  const wall = new THREE.BoxGeometry(6, 4, 2).translate(0, 2, 0).toNonIndexed();
  const fw = footprintsOf(wall, flat);
  assert.equal(fw.length, 1);
  const xs = fw[0].map((p) => p[0]), zs = fw[0].map((p) => p[1]);
  assert.ok(Math.abs(Math.min(...xs) + 3) < 1e-6 && Math.abs(Math.max(...zs) - 1) < 1e-6, 'its outline');
  // an arch: two legs joined overhead
  const legs = [new THREE.BoxGeometry(1.6, 5, 1.6).translate(-4, 2.5, 0), new THREE.BoxGeometry(1.6, 5, 1.6).translate(4, 2.5, 0), new THREE.BoxGeometry(9.6, 1, 1.6).translate(0, 5.5, 0)];
  const arch = new THREE.BufferGeometry();
  const pos = legs.flatMap((g) => [...g.toNonIndexed().attributes.position.array]);
  arch.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  assert.equal(footprintsOf(arch, flat).length, 2, 'each leg its own footprint');
  // up in the air, or too small, or too low: none
  assert.equal(footprintsOf(new THREE.BoxGeometry(4, 2, 4).translate(0, 6, 0).toNonIndexed(), flat).length, 0, 'not on the ground');
  assert.equal(footprintsOf(new THREE.CylinderGeometry(0.2, 0.2, 8, 6).translate(0, 4, 0).toNonIndexed(), flat).length, 0, 'a post');
  assert.equal(footprintsOf(new THREE.BoxGeometry(4, 0.3, 4).translate(0, 0.15, 0).toNonIndexed(), flat).length, 0, 'a slab');
});

test('the hull and the distance to it: counter-clockwise, outward normals, negative inside', () => {
  const sq = hull2([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]);
  assert.equal(sq.length, 4);
  const out = polyDistance(sq, 0.5, -2);
  assert.ok(Math.abs(out.d - 2) < 1e-9 && out.nz < -0.99, 'outside: distance and the face it faces');
  assert.ok(polyDistance(sq, 0.5, 0.4).d < 0, 'inside');
});

test('the drift: highest at the wall and facing the wind, nothing past its reach, a fillet that never steepens into rock', () => {
  const d = new SandDrifts({ heightAt: flat, wind: [1, 0], seed: 2, opts: { corner: 0 } });
  d.addFootprint([[-3, -3], [3, -3], [3, 3], [-3, 3]]);
  const windward = d.fieldAt(-3.05, 0), lee = d.fieldAt(3.05, 0);
  assert.ok(windward > lee * 1.3, `windward ${windward.toFixed(2)} > lee ${lee.toFixed(2)}`);
  assert.ok(windward <= DRIFT.rise[1] * 1.31 && lee >= DRIFT.rise[0] * 0.69, 'within its rises');
  assert.equal(d.fieldAt(-3 - DRIFT.rise[1] * 1.3 * DRIFT.reach - 0.5, 0), 0, 'nothing past its reach');
  // the profile falls off along (1 - u)²: tangent to the ground at the rim
  const r = d.fieldAt(-3.001, 0), reach = r * DRIFT.reach;
  assert.ok(d.fieldAt(-3 - reach * 0.9, 0) < r * 0.02, 'nearly nothing near the rim');
  assert.ok(2 / DRIFT.reach < 0.6, 'the steepest slope (at the wall) stays under the rock slope');
});

test('the skirts: faces turned up, normals up, in the ground\'s material flagged as a drift, culled by chunk', () => {
  const d = new SandDrifts({ heightAt: (x, z) => 0.02 * x, seed: 1 });
  d.addCircle(0, 0, 3);
  d.addCircle(400, 0, 3);
  const mat = driftMaterial(makeMaterial, { color: '#f0c080', mode: MODE_TERRAIN, ripples: true });
  assert.equal(mat.uniforms.uDrift.value, 1);
  assert.ok(mat.polygonOffset, 'pulled in front of the ground it meets');
  const g = d.build(mat);
  assert.equal(g.children.length, 2, 'two chunks far apart');
  const m = g.children[0], p = m.geometry.attributes.position, n = m.geometry.attributes.normal, idx = m.geometry.index.array;
  for (let i = 0; i < n.count; i++) assert.ok(n.getY(i) > 0.8, 'normals up');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  // (outside the footprint: the band under the wall, round a corner's fan, folds over unseen)
  let up = 0, outside = 0;
  for (let t = 0; t < idx.length; t += 3) {
    a.fromBufferAttribute(p, idx[t]); b.fromBufferAttribute(p, idx[t + 1]); c.fromBufferAttribute(p, idx[t + 2]);
    if (Math.hypot((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3) < 3.05) continue;
    outside++;
    if (b.sub(a).cross(c.sub(a)).y > 0) up++;
  }
  assert.equal(up, outside, `faces turned up (${up} of ${outside})`);
});

test('the builders feed an open collector, and nothing when none is open', () => {
  const d = SandDrifts.open({ heightAt: flat });
  assert.equal(SandDrifts.current, d);
  SandDrifts.current.addGeometry(new THREE.BoxGeometry(4, 3, 4).translate(0, 1.5, 0).toNonIndexed());
  d.close();
  assert.equal(SandDrifts.current, null);
  assert.equal(d.sources.length, 1);
});

test('a world built its own way: every collided mesh in the scene, its hidden collider for its render copy', () => {
  const scene = new THREE.Scene();
  const hut = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4).translate(0, 1.5, 0));
  hut.position.set(20, 0, 0); scene.add(hut);
  const drawn = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4).translate(0, 1.5, 0)); drawn.userData.noCollide = true; scene.add(drawn);
  // two huts merged into one mesh: two footprints
  const merged = new THREE.BufferGeometry();
  const a = new THREE.BoxGeometry(3, 3, 3).translate(-30, 1.5, 0).toNonIndexed(), b = new THREE.BoxGeometry(3, 3, 3).translate(-40, 1.5, 0).toNonIndexed();
  merged.setAttribute('position', new THREE.Float32BufferAttribute([...a.attributes.position.array, ...b.attributes.position.array], 3));
  scene.add(new THREE.Mesh(merged));
  const d = new SandDrifts({ heightAt: flat }).addScene(scene);
  assert.equal(d.sources.length, 3, 'the hut, and the merged two; not the render copy');
  assert.ok(d.fieldAt(17.9, 0) > 0 && d.fieldAt(0, 0) === 0, 'at the hut where it stands');
});

test('the field\'s fast distance (polyEdges / edgeDistance) and corner test give what polyDistance and hypot gave', async () => {
  const { polyEdges, edgeDistance } = await import('../src/sand-drifts.js');
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const d = new SandDrifts({ heightAt: flat, wind: [0.8, 0.6], seed: 3, opts: { corner: 0.6 } });
  for (let k = 0; k < 12; k++) {
    const cx = (rnd() - 0.5) * 80, cz = (rnd() - 0.5) * 80, r = 1 + rnd() * 6;
    d.addFootprint(Array.from({ length: 3 + Math.floor(rnd() * 20) }, () => [cx + (rnd() - 0.5) * r * 2, cz + (rnd() - 0.5) * r * 2]), { rise: 0.6 + rnd() });
  }
  d.addCircle(5, -8, 7);
  // the field as it was worked out before (polyDistance, hypot per corner)
  const before = (s, x, z) => {
    if (Math.abs(x - s.cx) > s.R + s.reach || Math.abs(z - s.cz) > s.R + s.reach) return 0;
    const { d: dd, nx, nz } = polyDistance(s.poly, x, z);
    let rise = d.riseAt(nx, nz, x, z, s.k), boost = 1;
    const w = rise * d.o.reach * 1.4;
    for (const [px, pz] of s.corners) { const c = Math.hypot(x - px, z - pz); if (c < w * 1.6) boost = Math.max(boost, 1 + (d.o.big - 1) * Math.exp(-(c * c) / (w * w))); }
    rise *= boost;
    const reach = rise * d.o.reach;
    if (dd <= 0) return dd > -2 * d.o.inside ? rise : 0;
    if (dd >= reach) return 0;
    const u = 1 - dd / reach;
    return rise * u * u;
  };
  let some = 0;
  for (let i = 0; i < 4000; i++) {
    const x = (rnd() - 0.5) * 100, z = (rnd() - 0.5) * 100;
    for (const s of d.sources) {
      const a = polyDistance(s.poly, x, z), b = edgeDistance(s.edges ?? polyEdges(s.poly), x, z);
      assert.ok(Math.abs(a.d - b.d) < 1e-9 && Math.abs(a.nx - b.nx) < 1e-9 && Math.abs(a.nz - b.nz) < 1e-9, `distance at ${x}, ${z}`);
      const v0 = before(s, x, z), v1 = d.driftOf(s, x, z);
      assert.ok(Math.abs(v0 - v1) < 1e-9, `drift at ${x}, ${z}: ${v0} vs ${v1}`);
      if (v0 > 0) some++;
    }
  }
  assert.ok(some > 100, 'the points reach some drifts');
});

// The field's quick outs (each footprint's own box grown by its farthest reach, the distance against it, 8 m
// cells; docs/systems/performance.md): the same field as every footprint tried in full, as it was written.
test('the drift field with its quick outs is the field of every footprint tried in full', async () => {
  const { edgeDistance } = await import('../src/sand-drifts.js');
  let seed = 3; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const d = new SandDrifts({ heightAt: flat, wind: [0.8, 0.6], seed: 5, mask: (x, z) => (x > 40 ? 0.5 : 1) });
  for (let i = 0; i < 60; i++) {
    const cx = rand() * 120 - 60, cz = rand() * 120 - 60, w = 1 + rand() * 9, h = 1 + rand() * 4, a = rand() * 3;
    const c = Math.cos(a), s = Math.sin(a);
    d.addFootprint([[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]), { rise: 0.6 + rand() });
    if (i % 7 === 0) d.addCircle(cx + 12, cz, 1 + rand() * 4);
  }
  // driftOf as written before the quick outs
  const full = (s, x, z) => {
    if (Math.abs(x - s.cx) > s.R + s.reach || Math.abs(z - s.cz) > s.R + s.reach) return 0;
    const { d: dist, nx, nz } = edgeDistance(s.edges, x, z);
    let rise = d.riseAt(nx, nz, x, z, s.k), boost = 1;
    const w = rise * d.o.reach * 1.4, w2 = w * w, near2 = w2 * 2.56;
    for (const [px, pz] of s.corners) { const c2 = (x - px) * (x - px) + (z - pz) * (z - pz); if (c2 < near2) boost = Math.max(boost, 1 + (d.o.big - 1) * Math.exp(-c2 / w2)); }
    rise *= boost;
    const reach = rise * d.o.reach;
    if (dist <= 0) return dist > -2 * d.o.inside ? rise : 0;
    if (dist >= reach) return 0;
    const u = 1 - dist / reach;
    return rise * u * u;
  };
  let some = 0;
  for (let n = 0; n < 20000; n++) {
    const x = rand() * 160 - 80, z = rand() * 160 - 80;
    let h = 0; for (const s of d.sources) { const v = full(s, x, z); if (v > h) h = v; }
    if (h > 0) { h *= x > 40 ? 0.5 : 1; some++; }
    assert.equal(d.fieldAt(x, z), h, `at ${x}, ${z}`);
  }
  assert.ok(some > 1000, `many points had sand (${some})`);
});

test('where a skirt is drawn over the ground between its points (a chord over a bend), those triangles collide, and only those', async () => {
  const { Physics } = await import('../src/physics.js');
  // a flat floor turning up into a slope at x = 2 (a canyon's floor meeting its wall), a block standing on it
  const ground = { heightAt: (x, z) => Math.max(0, x - 2) * 0.9 + 0 * z };
  const d = new SandDrifts({ heightAt: (x, z) => ground.heightAt(x, z), seed: 3 });
  d.addFootprint([[-1.5, -6], [1.5, -6], [1.5, 6], [-1.5, 6]], { rise: 2 });
  const scene = new THREE.Scene();
  scene.add(d.build(new THREE.MeshBasicMaterial()));
  d.raise(ground);
  const fit = d.group.children.find((m) => !m.userData.drifts);
  assert.ok(fit && fit.visible === false, 'a hidden collision mesh beside the skirts');
  const n = fit.geometry.attributes.position.count / 3, all = d.group.userData.triangles;
  assert.ok(n > 0 && n < all * 0.4, `${n} of ${all} skirt triangles collide`);
  const physics = new Physics(scene, ground);
  // on every skirt triangle, the feet stand on the drawn sand (within the audit's 6 cm), never under it
  const m = d.group.children.find((c) => c.userData.drifts), P = m.geometry.attributes.position, I = m.geometry.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  let worst = 0, worstPlain = 0;
  for (let t = 0; t < I.count; t += 3) {
    a.fromBufferAttribute(P, I.getX(t)); b.fromBufferAttribute(P, I.getX(t + 1)); c.fromBufferAttribute(P, I.getX(t + 2));
    p.copy(a).add(b).add(c).divideScalar(3);
    if (Math.abs(p.x) < 1.6 && Math.abs(p.z) < 6.1) continue;   // (inside the block)
    worst = Math.max(worst, p.y - DRIFT.lift - physics.groundAt(p.x, p.y + 1, p.z, 3));
    worstPlain = Math.max(worstPlain, p.y - DRIFT.lift - ground.heightAt(p.x, p.z));
  }
  assert.ok(worstPlain > 0.1, `(the ground's height alone: the drawn sand up to ${worstPlain.toFixed(2)} m over it)`);
  assert.ok(worst < 0.065, `the feet up to ${worst.toFixed(3)} m under the drawn sand`);
});
