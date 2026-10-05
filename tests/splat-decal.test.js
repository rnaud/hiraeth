import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { decalBasis, clipTriangle, projectSplat, gatherTriangles, heightfieldTriangles, flatSplat, splatMaterial, splatShape, splatGrowth, SPLAT_REACH } from '../src/splat-decal.js';
import { Physics } from '../src/physics.js';
import { Terrain } from '../src/world.js';
import { Splats } from '../src/fluid-tool.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** A geometry's triangles in world space, flat (as gatherTriangles gives them). */
function trisOf(geo, matrix = new THREE.Matrix4()) {
  const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
  return new Float32Array(g.attributes.position.array);
}
/** The smallest distance from p to any of the triangles. */
function distToTris(p, tris) {
  let best = Infinity;
  const T = new THREE.Triangle(), q = v();
  for (let i = 0; i < tris.length; i += 9) {
    T.set(v(tris[i], tris[i + 1], tris[i + 2]), v(tris[i + 3], tris[i + 4], tris[i + 5]), v(tris[i + 6], tris[i + 7], tris[i + 8]));
    best = Math.min(best, T.closestPointToPoint(p, q).distanceTo(p));
  }
  return best;
}
const corners = (piece) => Array.from({ length: piece.count }, (_, i) => v(piece.positions[i * 3], piece.positions[i * 3 + 1], piece.positions[i * 3 + 2]));
/** A ray test over flat triangles (for the occlusion callback). */
const rayTris = (tris) => (o, dir, far) => {
  const r = new THREE.Ray(o, dir), q = v();
  for (let i = 0; i < tris.length; i += 9) {
    const hit = r.intersectTriangle(v(tris[i], tris[i + 1], tris[i + 2]), v(tris[i + 3], tris[i + 4], tris[i + 5]), v(tris[i + 6], tris[i + 7], tris[i + 8]), false, q);
    if (hit && hit.distanceTo(o) <= far) return true;
  }
  return false;
};

test('decalBasis: a right-handed orthonormal frame round the normal, for any normal and turn', () => {
  for (const n of [v(0, 1, 0), v(0, -1, 0), v(1, 0, 0), v(0, 0, -1), v(0.3, 0.8, -0.52).normalize(), v(-0.7, 0.01, 0.71).normalize()]) {
    for (const a of [0, 1.1, Math.PI, 5.9]) {
      const { u, v: w } = decalBasis(n, a);
      assert.ok(Math.abs(u.length() - 1) < 1e-9 && Math.abs(w.length() - 1) < 1e-9);
      assert.ok(Math.abs(u.dot(n)) < 1e-9 && Math.abs(w.dot(n)) < 1e-9 && Math.abs(u.dot(w)) < 1e-9);
      assert.ok(u.clone().cross(w).distanceTo(n) < 1e-9, 'u × v = n');
    }
    // the turn turns it
    const a0 = decalBasis(n, 0).u.clone(), a1 = decalBasis(n, Math.PI / 2).u.clone();
    assert.ok(Math.abs(a0.dot(a1)) < 1e-9);
  }
});

test('clipTriangle: a triangle clipped to the box keeps only what lies inside, exactly', () => {
  const p = clipTriangle([-5, -5, 0], [5, -5, 0], [0, 5, 0], 1, 1, 1, 1);
  assert.ok(p.length >= 12, 'a polygon');
  for (let i = 0; i < p.length; i += 3) { assert.ok(Math.abs(p[i]) <= 1 + 1e-9 && Math.abs(p[i + 1]) <= 1 + 1e-9); assert.equal(p[i + 2], 0); }
  assert.deepEqual(clipTriangle([3, 3, 0], [4, 3, 0], [3, 4, 0], 1, 1, 1, 1), [], 'outside: nothing');
  assert.deepEqual(clipTriangle([0, 0, 2], [1, 0, 2], [0, 1, 2], 1, 1, 1, 1), [], 'in front of the box: nothing');
});

test('projectSplat: on a plane, the splat lies on it and covers the whole box, wherever it is tilted', () => {
  for (const n of [v(0, 1, 0), v(0, 0, 1), v(0.5, 0.7, -0.5).normalize()]) {
    const center = v(3, 2, -1);
    const { u, v: w } = decalBasis(n, 0.4);
    // one big quad through the centre on the plane
    const P = (x, y) => center.clone().addScaledVector(u, x).addScaledVector(w, y);
    const q = [P(-9, -9), P(9, -9), P(9, 9), P(-9, -9), P(9, 9), P(-9, 9)].flatMap((p) => p.toArray());
    const basis = decalBasis(n, 1.3);
    const piece = projectSplat(new Float32Array(q), { center, basis, sx: 0.7, sy: 0.9, front: 0.5, back: 0.5 });
    assert.ok(piece.count >= 3);
    let area = 0;
    for (let i = 0; i < piece.count; i += 3) {
      const [a, b, c] = corners(piece).slice(i, i + 3);
      for (const p of [a, b, c]) assert.ok(Math.abs(p.clone().sub(center).dot(n)) < 1e-5, 'on the plane: no lift, no gap');
      const tn = b.clone().sub(a).cross(c.clone().sub(a));
      area += tn.length() / 2;
      assert.ok(tn.normalize().dot(n) > 0.999, 'wound to face the shot');
    }
    assert.ok(Math.abs(area - 4 * 0.7 * 0.9 * SPLAT_REACH * SPLAT_REACH) < 1e-3, `covers the box (${area})`);
    for (let i = 0; i < piece.count; i++) {
      assert.ok(Math.abs(piece.coords[i * 2]) <= SPLAT_REACH + 1e-5 && Math.abs(piece.coords[i * 2 + 1]) <= SPLAT_REACH + 1e-5);
      assert.ok(Math.abs(piece.normals[i * 3] * n.x + piece.normals[i * 3 + 1] * n.y + piece.normals[i * 3 + 2] * n.z - 1) < 1e-5);
    }
  }
});

test('projectSplat: over a ball it follows the curve: every corner lies on the ball\'s own triangles', () => {
  const tris = trisOf(new THREE.SphereGeometry(1.2, 24, 16), new THREE.Matrix4().makeTranslation(0, 1.2, 0));
  const hit = v(0.3, 1.2 + Math.sqrt(1.44 - 0.09), 0), n = hit.clone().sub(v(0, 1.2, 0)).normalize();
  const piece = projectSplat(tris, { center: hit, basis: decalBasis(n, 0.2), sx: 0.4, sy: 0.4, front: 0.4, back: 0.6, occluded: rayTris(tris) });
  assert.ok(piece.count > 30, 'many facets');
  let below = 0;
  for (const p of corners(piece)) {
    assert.ok(distToTris(p, tris) < 1e-4, 'on the surface');
    below = Math.max(below, -p.clone().sub(hit).dot(n));
  }
  assert.ok(below > 0.05, `it wraps down the curve (${below.toFixed(3)} m below the hit plane)`);
});

test('projectSplat: the back of a thin wall and side-on faces stay clean', () => {
  // a wall 8 cm thick: front face z = 0, back face z = -0.08 (both in the collision, double-sided)
  const quad = (z) => [-3, -3, z, 3, -3, z, 3, 3, z, -3, -3, z, 3, 3, z, -3, 3, z];
  // and a fin sticking out of it, side-on to the shot
  const fin = [0.5, -3, 0, 0.5, 3, 0, 0.5, 3, 0.4, 0.5, -3, 0, 0.5, 3, 0.4, 0.5, -3, 0.4];
  const tris = new Float32Array([...quad(0), ...quad(-0.08), ...fin]);
  const piece = projectSplat(tris, { center: v(0, 0, 0), basis: decalBasis(v(0, 0, 1), 0), sx: 0.5, sy: 0.5, front: 0.5, back: 0.5, occluded: rayTris(tris) });
  assert.ok(piece.count > 0);
  for (const p of corners(piece)) {
    assert.ok(Math.abs(p.z) < 1e-6, `only the front face (z ${p.z})`);
  }
  // without the occlusion test the back face would be painted too: the test is what removes it
  const all = projectSplat(tris, { center: v(0, 0, 0), basis: decalBasis(v(0, 0, 1), 0), sx: 0.5, sy: 0.5, front: 0.5, back: 0.5, occlude: false });
  assert.ok(corners(all).some((p) => Math.abs(p.z + 0.08) < 1e-6));
  assert.ok(corners(all).every((p) => !(Math.abs(p.x - 0.5) < 1e-6 && p.z > 1e-3)), 'the side-on fin is left out');
  // drawn one-sided, the wall's back faces away by its winding: left out without any occlusion test
  const back = [3, -3, -0.08, -3, -3, -0.08, -3, 3, -0.08, 3, -3, -0.08, -3, 3, -0.08, 3, 3, -0.08];   // wound to face -z
  const drawnTris = new Float32Array([...quad(0), ...back]);
  const one = projectSplat(drawnTris, { center: v(0, 0, 0), basis: decalBasis(v(0, 0, 1), 0), sx: 0.5, sy: 0.5, front: 0.5, back: 0.5, occlude: false, oneSided: Uint8Array.of(1, 1, 1, 1) });
  assert.ok(one.count > 0 && corners(one).every((p) => Math.abs(p.z) < 1e-6), 'only the front');
});

test('gatherTriangles: the collision\'s triangles round the hit and the terrain\'s own grid triangles', () => {
  const scene = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  box.position.set(0, 1, 0); scene.add(box);
  const far = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  far.position.set(40, 1, 0); scene.add(far);
  const physics = new Physics(scene);
  const hit = v(0.2, 2, 0.3), basis = decalBasis(v(0, 1, 0), 0.5);
  const tris = gatherTriangles(physics, hit, basis, 1.5, 1.5, 0.5, 0.8);
  assert.ok(tris.length / 9 >= 2 && tris.length / 9 <= 12, `the near box only (${tris.length / 9})`);
  for (let i = 0; i < tris.length; i += 3) assert.ok(tris[i] < 5, 'nothing from the far box');
  const piece = projectSplat(tris, { center: hit, basis, sx: 0.5, sy: 0.5, front: 0.5, back: 0.8, occluded: (o, d, f) => physics.rayDistance(o, d, f) < f });
  assert.ok(piece.count > 0);
  for (const p of corners(piece)) assert.ok(Math.abs(p.y - 2) < 1e-5 || Math.abs(Math.abs(p.x) - 1) < 1e-5 || Math.abs(Math.abs(p.z) - 1) < 1e-5, 'on the box');
  // the terrain: the drawn mesh's triangles exactly (heightAt is exact on them)
  const terrain = new Terrain({ size: 200, seg: 50, height: (x, z) => Math.sin(x * 0.2) * 2 + Math.cos(z * 0.13) * 1.5, material: { color: '#fff' } });
  const out = [];
  heightfieldTriangles(terrain, new THREE.Box3(v(-3, -10, -3), v(3, 10, 3)), out);
  assert.ok(out.length / 9 >= 8);
  for (let i = 0; i < out.length; i += 3) assert.ok(Math.abs(out[i + 1] - terrain.heightAt(out[i], out[i + 2])) < 1e-4, 'grid corners on the ground');
  // and a splat on it lies on the ground everywhere
  const g = { base: terrain }, at = v(0.7, terrain.heightAt(0.7, -0.4), -0.4);
  const e = 0.3, nrm = v(terrain.heightAt(at.x - e, at.z) - terrain.heightAt(at.x + e, at.z), 2 * e, terrain.heightAt(at.x, at.z - e) - terrain.heightAt(at.x, at.z + e)).normalize();
  const b2 = decalBasis(nrm, 0);
  const onGround = projectSplat(gatherTriangles(g, at, b2, 1.4, 1.4, 0.6, 0.9), { center: at, basis: b2, sx: 0.6, sy: 0.6, front: 0.6, back: 0.9 });
  assert.ok(onGround.count > 0);
  for (const p of corners(onGround)) assert.ok(Math.abs(p.y - terrain.heightAt(p.x, p.z)) < 1e-3, 'on the drawn ground');
});

test('the splat\'s shape: grows with a pop, holds, shrinks away; the inner tone in the middle', () => {
  assert.equal(splatGrowth(0, 5), 0);
  assert.ok(splatGrowth(0.13, 5) > 1.05, 'overshoots');
  assert.ok(Math.abs(splatGrowth(1, 5) - 1) < 1e-9, 'holds');
  assert.equal(splatGrowth(5, 5), 0, 'gone at the end');
  assert.equal(splatShape(0, 0, 1, 1, 0.3), 2, 'inner tone at the middle');
  assert.equal(splatShape(0.8, 0, 1, 1, 0.3), 1, 'outer tone round it');
  assert.equal(splatShape(2.2, 2.2, 1, 1, 0.3), 0, 'nothing outside');
  assert.equal(splatShape(0.8, 0, 0.3, 0.3, 0.3), 0, 'shrunk: not there yet');
});

test('splatMaterial: the surface shader takes the shape (the patch still applies) and keeps the shared uniforms', () => {
  const m = splatMaterial();
  assert.ok(m.fragmentShader.includes('discard') && m.fragmentShader.includes('uniform float uSplatTime'));
  assert.ok(m.fragmentShader.includes('mix(vInstColor, vSplat2.yzw, splatInner)'));
  assert.ok(m.vertexShader.includes('vSplat = aSplat;'));
  assert.ok(m.polygonOffset && m.polygonOffsetFactor < 0, 'pulled in front in depth, not lifted');
  const flat = flatSplat({ center: v(), basis: decalBasis(v(0, 1, 0), 0), sx: 1, sy: 1 });
  assert.equal(flat.count, 6);
});

test('Splats: one mesh for all, rewritten as they come and go, projected onto the collision', () => {
  const scene = new THREE.Scene();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial());
  ball.position.set(0, 1, 0); scene.add(ball);
  const physics = new Physics(scene);
  const S = new Splats(new THREE.Group(), physics);
  S.add(v(0, 2, 0), v(0, 1, 0), '#ff0000', '#00ff00', 0.6, 2);
  S.add(v(1, 1, 0), v(1, 0, 0), '#ff0000', '#00ff00', 0.6, 3);
  assert.equal(S.list.length, 2);
  assert.ok(S.list.every((s) => s.piece.count > 6), 'projected, not flat');
  assert.equal(S.mesh.geometry.drawRange.count, S.corners());
  assert.ok(S.mesh.visible && S.mesh.geometry.drawRange.count > 0);
  S.update(2.1);
  assert.equal(S.list.length, 1, 'the first one gone');
  assert.equal(S.mesh.geometry.drawRange.count, S.list[0].piece.count);
  S.update(1);
  assert.equal(S.list.length, 0); assert.equal(S.mesh.geometry.drawRange.count, 0, "nothing drawn"); assert.ok(S.mesh.visible, "still in the scene for the shader warm-up");
});

test('projectSplat: a rock on the ground hides only the ground under it', () => {
  const quad = (x0, y0, x1, y1, z) => [x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z];
  const ground = quad(-4, -4, 4, 4, 0);
  const rockTop = quad(0.4, -0.2, 0.8, 0.2, 0.4);
  const piece = projectSplat(new Float32Array([...ground, ...rockTop]), { center: v(0, 0, 0), basis: decalBasis(v(0, 0, 1), 0), sx: 0.6, sy: 0.6, front: 0.6, back: 0.6 });
  const pts = corners(piece);
  assert.ok(pts.some((p) => Math.abs(p.z - 0.4) < 1e-6), 'on the rock');
  assert.ok(pts.some((p) => p.z === 0 && p.x < -0.5), 'on the ground round it');
  // the ground under the rock is left out (to within a few centimetres of its edge) and the ground right by its foot is kept
  let byFoot = false;
  for (let i = 0; i < piece.count; i += 3) {
    const [a, b, c] = pts.slice(i, i + 3), m = a.clone().add(b).add(c).divideScalar(3);
    if (Math.abs(m.z) > 1e-6) continue;
    assert.ok(!(m.x > 0.46 && m.x < 0.74 && Math.abs(m.y) < 0.14), `ground under the rock at ${m.toArray().map((x) => x.toFixed(2))}`);
    if (m.x > 0.8 && m.x < 0.9 && Math.abs(m.y) < 0.2) byFoot = true;
  }
  assert.ok(byFoot, 'no gap round the rock\'s foot');
  assert.ok(piece.count < 600, `not cut finer than it needs (${piece.count} corners)`);
});

test('Splats: a splat sits on the drawn surface, not on a hidden stand-in collider; nothing that moves is painted', () => {
  const scene = new THREE.Scene();
  // drawn: a dome (no collision of its own); collision: a hidden box round it, a little bigger
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial());
  dome.userData.noCollide = true; scene.add(dome);
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.3, 4.2).translate(0, 1.15, 0), new THREE.MeshBasicMaterial());
  proxy.visible = false; scene.add(proxy);
  const physics = new Physics(scene);
  const fx = new THREE.Group(); scene.add(fx);
  const S = new Splats(fx, physics);
  const hit = physics.rayHit(v(0.3, 10, 0.2), v(0, -1, 0), 20);
  assert.ok(Math.abs(hit.point.y - 2.3) < 1e-4, 'the glob stops on the stand-in');
  S.add(hit.point, hit.normal, '#ff0000', '#00ff00', 0.5, 3);
  const pts = corners(S.list[0].piece);
  assert.ok(pts.length > 12);
  for (const p of pts) assert.ok(Math.abs(p.length() - 2) < 0.06, `on the dome (|p| = ${p.length().toFixed(3)})`);
  // something that moves (a person's gear, a vehicle) is not painted
  const cart = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  cart.position.set(8, 0.5, 0); scene.add(cart);
  S.add(v(8, 1, 0), v(0, 1, 0), '#ff0000', '#00ff00', 0.5, 3);
  const onTop = () => corners(S.list.at(-1).piece).every((p) => Math.abs(p.y - 1) < 1e-6);
  assert.ok(onTop(), 'standing still: painted on its top (its bottom, hidden under it, left out)');
  cart.position.x += 0.01; cart.updateMatrixWorld();
  S.add(v(8.01, 1, 0), v(0, 1, 0), '#ff0000', '#00ff00', 0.5, 3);
  assert.ok(!onTop(), 'it moved: a flat splat, not one painted on it');
});
