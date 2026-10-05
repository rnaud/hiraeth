import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { simplify, pack, cluster, pickLevel, LodManager, farLevel, farSide, sphereError, triCount } from '../src/lod.js';
import { tileScene, QUALITY_PRESETS } from '../src/perf.js';
import { Physics } from '../src/physics.js';
import { createBazaar } from '../src/levels/bazaar.js';
import { figureGeometry } from '../src/crowd.js';
import { Puffs } from '../src/ship/fx.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

/** A merged block of houses with domes and thin poles, like the kits build (flat, non-indexed). */
function town(n = 120, seed = 7, spread = 120) {
  const parts = [];
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const x = (r() - 0.5) * spread, z = (r() - 0.5) * spread, w = 3 + r() * 6, h = 3 + r() * 10;
    parts.push(new THREE.BoxGeometry(w, h, w).translate(x, h / 2, z));
    parts.push(new THREE.SphereGeometry(w * 0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h, z));
    parts.push(new THREE.CylinderGeometry(0.1, 0.1, 3, 6).translate(x + w / 2, h + 1.5, z));
  }
  return mergeGeometries(parts.map((g) => { g = g.toNonIndexed(); g.deleteAttribute('uv'); return g; }));
}

const box3 = (g) => { g.computeBoundingBox(); return g.boundingBox; };
/** Bounds of the positions themselves (simplify copies the source's bounds onto its result). */
function posBounds(g) { const b = new THREE.Box3(); return b.setFromBufferAttribute(g.attributes.position); }

/** Share of rays (a grid over the bounds, from six sides) that hit one mesh and not the other. */
function silhouetteMismatch(a, b, step) {
  const ma = new THREE.Mesh(a, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), mb = new THREE.Mesh(b, ma.material);
  for (const m of [ma, mb]) { m.geometry = m.geometry.clone(); m.geometry.boundsTree = new MeshBVH(m.geometry); m.raycast = acceleratedRaycast; }
  const ray = new THREE.Raycaster(), bb = box3(a.clone()), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  let total = 0, off = 0;
  for (const axis of [0, 1, 2]) for (const sign of [1, -1]) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3, dir = new THREE.Vector3().setComponent(axis, -sign);
    for (let i = 0; i <= size.getComponent(u) / step; i++) for (let j = 0; j <= size.getComponent(v) / step; j++) {
      const o = c.clone().setComponent(axis, c.getComponent(axis) + sign * (size.getComponent(axis) / 2 + 5));
      o.setComponent(u, bb.min.getComponent(u) + i * step).setComponent(v, bb.min.getComponent(v) + j * step);
      ray.set(o, dir);
      const ha = ray.intersectObject(ma).length > 0, hb = ray.intersectObject(mb).length > 0;
      total++; if (ha !== hb) off++;
    }
  }
  return off / total;
}

test('simplify: fewer triangles, the same bounds, the outline within a cell', () => {
  const g = town(24, 7, 50);
  const full = triCount(g);
  let prev = full;
  for (const cell of [0.5, 1, 2]) {
    const s = simplify(g, cell);
    assert.ok(s, `a level at ${cell} m`);
    const n = triCount(s);
    assert.ok(n < prev, `coarser cells keep fewer triangles (${cell} m: ${n} of ${full})`);
    prev = n;
    // positions never leave the original's bounds (each cell's point stays among its own vertices)
    const pb = posBounds(s), ob = posBounds(g);
    assert.ok(ob.clone().expandByScalar(1e-4).containsBox(pb), 'inside the original bounds');
    assert.ok(pb.clone().expandByScalar(cell * 1.75).containsBox(ob), 'and filling them to within a cell');
    // the shapes seen from six sides, sampled at a cell: at most a few rays in a hundred change
    const miss = silhouetteMismatch(g, s, Math.max(cell, 1));
    assert.ok(miss < 0.06, `${cell} m: ${(miss * 100).toFixed(1)} % of the outline rays differ`);
    // culling sees the same object
    assert.deepEqual(s.boundingSphere.center.toArray(), g.boundingSphere?.center.toArray() ?? s.boundingSphere.center.toArray());
    assert.equal(s.userData.lodSource, g);
  }
  assert.ok(prev < full * 0.3, 'two-metre cells keep under a third of a town');
});

test('simplify keeps closed shapes closed and its attributes (normals, colours) unblended', () => {
  const sphere = new THREE.SphereGeometry(10, 32, 16);
  const col = new Float32Array(sphere.attributes.position.count * 3);
  for (let i = 0; i < sphere.attributes.position.count; i++) col.set(sphere.attributes.position.getY(i) > 0 ? [1, 0, 0] : [0, 0, 1], i * 3);
  sphere.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const s = simplify(sphere, 2);
  assert.ok(triCount(s) < triCount(sphere) * 0.7);
  for (const k of ['position', 'normal', 'uv', 'color']) assert.ok(s.attributes[k], k);
  // every edge (by position) is shared by an even number of triangles: no holes opened
  const P = s.attributes.position, I = s.index.array, key = (i) => `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`;
  const edges = new Map();
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = key(I[t + k]), b = key(I[t + (k + 1) % 3]), e = a < b ? `${a}|${b}` : `${b}|${a}`;
    edges.set(e, (edges.get(e) ?? 0) + 1);
  }
  for (const [e, n] of edges) assert.equal(n % 2, 0, `edge ${e} is open`);
  // colours are copied, never averaged; normals stay unit length and point outward
  const C = s.attributes.color, N = s.attributes.normal;
  for (let i = 0; i < C.count; i++) {
    assert.ok([C.getX(i), C.getY(i), C.getZ(i)].every((v) => v === 0 || v === 1), 'an original colour');
    assert.ok(Math.abs(Math.hypot(N.getX(i), N.getY(i), N.getZ(i)) - 1) < 1e-4);
    assert.ok(N.getX(i) * P.getX(i) + N.getY(i) * P.getY(i) + N.getZ(i) * P.getZ(i) > 0, 'outward');
  }
  // corners stay sharp: a box simplified coarser than its faces keeps its eight corners
  const b = simplify(new THREE.BoxGeometry(4, 4, 4, 8, 8, 8), 1.5), bb = posBounds(b);
  assert.deepEqual(bb.min.toArray().map((v) => +v.toFixed(5)), [-2, -2, -2]);
  assert.deepEqual(bb.max.toArray().map((v) => +v.toFixed(5)), [2, 2, 2]);
});

test('thin rods (poles, cables, antennas) thin out along their length but never vanish', () => {
  const pole = new THREE.CylinderGeometry(0.1, 0.1, 6, 12, 24, true).rotateZ(0.6);
  const s = simplify(pole, 1);
  assert.ok(s, 'a level');
  assert.ok(triCount(s) < triCount(pole) / 3, `fewer rings along it (${triCount(s)} of ${triCount(pole)})`);
  const a = posBounds(pole), b = posBounds(s);
  assert.ok(b.getSize(new THREE.Vector3()).distanceTo(a.getSize(new THREE.Vector3())) < 0.05, 'the same length and lean');
  // seen across it, still as wide as it was (eight sides at least)
  const ray = new THREE.Raycaster(), mesh = new THREE.Mesh(s, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  let hits = 0;
  for (let t = -2; t <= 2; t += 0.25) {
    const c = new THREE.Vector3(0, t, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.6);
    ray.set(c.clone().add(new THREE.Vector3(0, 0, 5)), new THREE.Vector3(0, 0, -1));
    if (ray.intersectObject(mesh).length) hits++;
  }
  assert.equal(hits, 17, 'no gaps along it');
  // a cable (a tube along a curve) keeps its curve
  const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 10, 0), new THREE.Vector3(20, 6, 0), new THREE.Vector3(40, 10, 0)]), 64, 0.05, 5);
  const c = simplify(cable, 2);
  assert.ok(triCount(c) < triCount(cable) / 2);
  assert.ok(posBounds(c).min.y < 6.3, 'it still sags');
});

test('locked vertices keep their place: the seams between tiles of one mesh, the crowd\'s cape parameters', () => {
  // one mesh tiled in two (perf.js tileScene): both tiles simplified, their shared border stays put
  const scene = new THREE.Scene();
  const plane = new THREE.PlaneGeometry(400, 100, 200, 60).rotateX(-Math.PI / 2);
  const P = plane.attributes.position;
  for (let i = 0; i < P.count; i++) P.setY(i, Math.sin(P.getX(i) * 0.05) * 3 + Math.cos(P.getZ(i) * 0.07) * 2);
  const mesh = new THREE.Mesh(plane, new THREE.MeshBasicMaterial());
  scene.add(mesh);
  tileScene(scene, { tile: 200, propTile: 200 });
  const tiles = mesh.children;
  assert.ok(tiles.length >= 2, 'tiled');
  const lod = new LodManager(scene, { worker: false, minTris: 10 });
  lod.collect();
  const lock = lod.locks.get(P);
  assert.ok(lock && lock.some(Boolean), 'the seam vertices are found');
  const seam = new Map();
  for (let i = 0; i < P.count; i++) if (lock[i]) seam.set(`${P.getX(i).toFixed(3)},${P.getZ(i).toFixed(3)}`, P.getY(i));
  for (const t of tiles) {
    const s = simplify(t.geometry, 8, { lock });
    assert.ok(triCount(s) < triCount(t.geometry) * 0.5);
    const Q = s.attributes.position;
    let kept = 0;
    for (let i = 0; i < Q.count; i++) { const y = seam.get(`${Q.getX(i).toFixed(3)},${Q.getZ(i).toFixed(3)}`); if (y !== undefined && Math.abs(y - Q.getY(i)) < 1e-4) kept++; }
    assert.ok(kept >= 41, `the border's vertices are all still there (${kept})`);
  }
  // the crowd's far figure: its cape is parameters (round the body, collar to hem) that must not move
  const fig = figureGeometry('far'), rig = fig.attributes.aRig;
  const capeLock = Uint8Array.from({ length: rig.count }, (_, i) => (rig.getX(i) >= 9.5 ? 1 : 0));
  const dist = simplify(fig, 0.1, { lock: capeLock });
  assert.ok(triCount(dist) < triCount(fig), 'the distant figure is lighter');
  const capeIn = new Set(), capeOut = new Set(), key = (A, i) => `${A.getX(i).toFixed(5)},${A.getY(i).toFixed(5)},${A.getZ(i).toFixed(5)}`;
  for (let i = 0; i < rig.count; i++) if (capeLock[i]) capeIn.add(key(fig.attributes.position, i));
  for (let i = 0; i < dist.attributes.aRig.count; i++) if (dist.attributes.aRig.getX(i) >= 9.5) capeOut.add(key(dist.attributes.position, i));
  for (const k of capeOut) assert.ok(capeIn.has(k), 'cape vertices only where they were');
});

test('pickLevel: the cell a distance allows, with a margin each way so nothing flickers on the edge', () => {
  const ppr = 640, px = 1;
  // at d metres a cell of d / 640 m is a pixel: 2^j units, scale 1
  assert.equal(pickLevel(-Infinity, 640, 1, ppr, px), 0);        // 1 m cells at 640 m
  assert.equal(pickLevel(-Infinity, 1280, 1, ppr, px), 1);
  assert.equal(pickLevel(-Infinity, 320, 1, ppr, px), -1);
  assert.equal(pickLevel(-Infinity, 0, 1, ppr, px), -Infinity, 'right here: full detail');
  assert.equal(pickLevel(-Infinity, 1280, 1, ppr, 0), -Infinity, 'lodPx 0: always full');
  assert.equal(pickLevel(-Infinity, 1280, 2, ppr, px), 0, 'a mesh scaled up needs finer cells');
  assert.equal(pickLevel(-Infinity, 640, 1, ppr, 2), 1, 'two pixels allowed: coarser');
  // just over the threshold and back: the level holds
  let j = pickLevel(-Infinity, 1300, 1, ppr, px);
  assert.equal(j, 1);
  for (const d of [1270, 1250, 1300, 1210, 1260, 2500, 2700]) { j = pickLevel(j, d, 1, ppr, px); assert.equal(j, 1, `held at ${d} m`); }
  assert.equal(pickLevel(1, 1150, 1, ppr, px), 0, 'well under: finer');
  assert.equal(pickLevel(1, 2950, 1, ppr, px), 2, 'well over: coarser');
  // never finer than min (it would save nothing): full detail instead
  assert.equal(pickLevel(-Infinity, 60, 1, ppr, px, { min: -3 }), -Infinity);
  assert.equal(pickLevel(-Infinity, 1e6, 1, ppr, px, { max: 3 }), 3, 'nor coarser than max');
  // a walk out and back passes each threshold once
  const seq = [];
  j = -Infinity;
  for (let d = 100; d < 5000; d *= 1.03) { const n = pickLevel(j, d, 1, ppr, px); if (n !== j) seq.push(n); j = n; }
  for (let d = 5000; d > 100; d /= 1.03) { const n = pickLevel(j, d, 1, ppr, px); if (n !== j) seq.push(n); j = n; }
  assert.deepEqual(seq, [-3, -2, -1, 0, 1, 2, 1, 0, -1, -2, -3]);
});

test('LodManager on a real world: distant meshes swap to their levels, near ones stay full, the collision is untouched', async () => {
  const scene = new THREE.Scene(), level = createBazaar(scene);
  const physics = new Physics(scene, level.ground);
  const before = physics.triangles, bakedPositions = physics.geometry.attributes.position.array.slice(0, 3000);
  tileScene(scene);
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh) meshes.push([o, o.geometry, o.geometry.attributes.position?.array.slice(0, 30)]); });
  const lod = new LodManager(scene, { worker: false, budget: 1e9 });
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.3, 5000);
  const at = (x, y, z) => { camera.position.set(x, y, z); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); scene.updateMatrixWorld(); };
  at(0, 900, 1600);   // far up and away: everything is small
  for (let i = 0; i < 3; i++) { lod.update(camera, 640, 2); await lod.flush(); }
  lod.update(camera, 640, 2);
  assert.ok(lod.stats.meshes > 20, `candidates (${lod.stats.meshes})`);
  assert.ok(lod.stats.coarse > 10 && lod.stats.saved > 10000, `distant meshes drawn coarser (${lod.stats.coarse}, ${lod.stats.saved} triangles saved)`);
  // every swapped geometry is a level of the mesh's own, with the same bounds
  for (const e of lod.entries) if (e.o.geometry !== e.full) {
    assert.equal(e.o.geometry.userData.lodSource, e.full);
    assert.ok(e.o.geometry.boundingSphere.equals(e.full.boundingSphere));
  }
  // the collision baked now (a level showing) is the same as at load: physics reads the levels' source
  const again = new Physics(scene, level.ground);
  assert.equal(again.triangles, before);
  assert.deepEqual(again.geometry.attributes.position.array.slice(0, 3000), bakedPositions);
  // the full meshes themselves were never changed
  for (const [, g, pos] of meshes) if (pos) assert.deepEqual(g.attributes.position.array.slice(0, 30), pos);
  // the shadow pass with km-wide texels goes coarser still, and comes back
  const viewGeos = lod.entries.map((e) => e.o.geometry);
  lod.shadowPass(8); await lod.flush(); lod.shadowPass(8);
  assert.ok(lod.entries.some((e, i) => e.o.geometry !== viewGeos[i]), 'coarser for the shadow');
  lod.viewPass();
  assert.deepEqual(lod.entries.map((e) => e.o.geometry), viewGeos);
  // walk right up to it: full detail where you stand
  at(0, 2, 30);
  lod.update(camera, 640, 2);
  const near = lod.entries.filter((e) => e.d < 5);
  assert.ok(near.length > 0 && near.every((e) => e.o.geometry === e.full), 'full detail up close');
  // lodPx 0 (or a preset without it) is full detail everywhere
  at(0, 900, 1600);
  lod.update(camera, 640, 0);
  assert.ok(lod.entries.every((e) => e.o.geometry === e.full));
  // a mesh whose geometry somebody else replaces is let go
  lod.update(camera, 640, 2);
  const e0 = lod.entries.find((e) => e.o.geometry !== e.full);
  const mine = new THREE.BoxGeometry();
  e0.o.geometry = mine;
  lod.update(camera, 640, 2);
  assert.equal(e0.o.geometry, mine);
  assert.ok(!lod.entries.includes(e0));
});

test('what the levels leave alone: moving, skinned, kept and tiny meshes', () => {
  const scene = new THREE.Scene(), mat = new THREE.MeshBasicMaterial();
  const big = () => new THREE.SphereGeometry(5, 32, 16);
  const plain = new THREE.Mesh(big(), mat), dyn = new THREE.Mesh(big(), mat), tiny = new THREE.Mesh(new THREE.BoxGeometry(), mat), kept = new THREE.Group();
  dyn.userData.dynamic = true;
  kept.add(new THREE.Mesh(big(), mat));
  const terrain = new THREE.Mesh(big(), mat);
  scene.add(plain, dyn, tiny, kept, terrain);
  const lod = new LodManager(scene, { worker: false, keep: [kept, terrain] });
  lod.collect();
  assert.deepEqual(lod.entries.map((e) => e.o), [plain]);
});

test('the far copies: flora\'s second mesh and the smoke column\'s puffs', () => {
  const plant = mergeGeometries([new THREE.CylinderGeometry(0.3, 0.4, 2, 8, 4), new THREE.IcosahedronGeometry(0.8, 2).translate(0, 1.6, 0)].map((g) => { g = g.toNonIndexed(); g.deleteAttribute('uv'); return g; }));
  const lv = farLevel(plant, { maxCell: 0.5 });
  assert.ok(lv && triCount(lv.geometry) <= triCount(plant) * 0.55 && lv.cell <= 0.5);
  assert.equal(farSide(false, 100, 100), false, 'not yet: 10 % past first');
  assert.equal(farSide(false, 111, 100), true);
  assert.equal(farSide(true, 95, 100), true, 'and back only 10 % inside');
  assert.equal(farSide(true, 90, 100), false);
  // an icosphere of detail 1 falls 6.6 % inside its sphere (detail 2: 2.8 %)
  assert.ok(Math.abs(sphereError(new THREE.IcosahedronGeometry(1, 1)) - 0.0658) < 0.002);
  assert.ok(Math.abs(sphereError(new THREE.IcosahedronGeometry(1, 2)) - 0.0284) < 0.002);
});

test('the ship\'s puffs draw nothing while none is alive', () => {
  const scene = new THREE.Scene(), puffs = new Puffs(scene, { count: 20 });
  assert.equal(puffs.mesh.visible, false, 'an idle pool is hidden (it was 490 balls of 180 triangles in every pass)');
  puffs.emit(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 1, 0.5, '#ffffff');
  assert.equal(puffs.mesh.visible, true);
  puffs.update(0.1);
  assert.equal(puffs.mesh.visible, true);
  for (let i = 0; i < 10; i++) puffs.update(0.1);
  assert.equal(puffs.mesh.visible, false, 'hidden again once it has faded');
});

test('levels of detail are a graphics setting: the handheld goes furthest', () => {
  const P = QUALITY_PRESETS;
  for (const [name, p] of Object.entries(P)) assert.ok(p.lodPx >= 1, `${name} has lodPx`);
  assert.ok(P.handheld.lodPx > P.low.lodPx && P.low.lodPx > P.medium.lodPx);
  assert.equal(P.high.lodPx, P.medium.lodPx);
});

test('pack and cluster run on plain arrays (what the worker gets) and agree with simplify', () => {
  const g = town(30);
  const a = simplify(g, 1), r = cluster(pack(g), 1);
  assert.equal(triCount(a), r.tris);
  assert.deepEqual(Array.from(a.attributes.position.array), Array.from(r.pos));
});
