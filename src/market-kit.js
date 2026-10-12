import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A small kit for the Signal Market's explorations (issue #191: src/market-air.js, src/market-old.js,
// src/market-lanes.js): pieces pushed by material, solid (collided as drawn) or drawn only, merged into one mesh a
// material and kind when the piece is done, all named after the piece (the tests find them by name).
//
//   const K = kit('The old market');
//   K.box(x, y, z, w, h, d, mat, solid?, yaw?)  K.add(geo, mat, solid?)  K.done(scene) → THREE.Group

const keep = (g, colors) => {
  g = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(colors && k === 'color')) g.deleteAttribute(k);
  return g;
};

/** Paint a geometry one colour (a vertex colour attribute), for a material with vertexColors. */
export function tint(g, hex) {
  g = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

export function kit(name) {
  const buckets = new Map();
  // solid: collided as drawn; false: drawn only; 'floats': drawn only and overhead on purpose (cables, aerials: the
  // contact audit leaves them out of what is stood on, src/contact-audit.js)
  const add = (geo, mat, solid = true) => {
    const key = `${mat.uuid}:${solid}`;
    if (!buckets.has(key)) buckets.set(key, { mat, solid, geos: [] });
    buckets.get(key).geos.push(keep(geo, mat.vertexColors));
    return geo;
  };
  const box = (x, y, z, w, h, d, mat, solid = true, yaw = 0) => add(new THREE.BoxGeometry(w, h, d).rotateY(yaw).translate(x, y, z), mat, solid);
  /** A box between two heights (y0 below, y1 above). */
  const slab = (x0, x1, y0, y1, z0, z1, mat, solid = true) => box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0), mat, solid);
  /** A beam from a to b ([x, y, z]), w across and h high. */
  const beam = (a, b, w, h, mat, solid = true) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
    const g = new THREE.BoxGeometry(w, h, L);
    const m = new THREE.Matrix4().lookAt(B, A, new THREE.Vector3(0, 1, 0)).setPosition(A.clone().add(B).multiplyScalar(0.5));
    return add(g.applyMatrix4(m), mat, solid);
  };
  const tube = (pts, r, mat, solid = 'floats') => {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return add(new THREE.TubeGeometry(c, Math.max(4, pts.length * 4), r, 5, false), mat, solid);
  };
  const done = (scene) => {
    const g = new THREE.Group();
    g.name = name;
    for (const { mat, solid, geos } of buckets.values()) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.name = name;
      m.userData.noCollide = solid !== true;
      if (solid === 'floats') m.userData.floats = true;
      m.userData.tiled = true;
      m.geometry.computeBoundingSphere();
      geos.forEach((q) => q.dispose());
      g.add(m);
    }
    scene.add(g);
    return g;
  };
  return { add, box, slab, beam, tube, done };
}

/** A walk's points along a polyline of [x, z] at height y, every `step` m: for the crowd and the tests. */
export function along(points, step = 2) {
  const out = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let k = i ? 1 : 0; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

/**
 * A rectangle less the holes in it, as rectangles ([x0, x1, z0, z1]): the cells of the grid the holes' edges make,
 * the cells outside every hole, merged along their rows.
 */
export function rectMinus([X0, X1, Z0, Z1], holes) {
  const xs = [...new Set([X0, X1, ...holes.flatMap((h) => [h[0], h[1]]).filter((x) => x > X0 && x < X1)])].sort((a, b) => a - b);
  const zs = [...new Set([Z0, Z1, ...holes.flatMap((h) => [h[2], h[3]]).filter((z) => z > Z0 && z < Z1)])].sort((a, b) => a - b);
  const inHole = (x, z) => holes.some((h) => x > h[0] && x < h[1] && z > h[2] && z < h[3]);
  const out = [];
  for (let j = 0; j + 1 < zs.length; j++) {
    let run = null;
    for (let i = 0; i + 1 < xs.length; i++) {
      const open = !inHole((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2);
      if (open && run) run[1] = xs[i + 1];
      else if (open) run = [xs[i], xs[i + 1], zs[j], zs[j + 1]];
      else if (run) { out.push(run); run = null; }
    }
    if (run) out.push(run);
  }
  return out;
}
