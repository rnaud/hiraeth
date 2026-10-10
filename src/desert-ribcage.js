import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// The giant ribcage in the dunes (references/levels/The Desert/places/ribcage/sheet-1.jpg): a fallen giant lying on
// its side. A long spine of vertebrae half buried along the sand, its spines standing up; nine flat ribs rising off it
// in tall arches like a ruined hall and coming down into the sand on the other side, one broken, their bone pierced
// with holes; the skull at the head end, half sunk, with two horns curving up and two tusks reaching forward. The old
// ribcage south of the start (src/world.js, ribcage(150, -210, 1, 0.5)) also has a scrap of cloth by Teo's drum and a
// faint track of footprints to it (`story`).
//
// Local frame: x along the spine (+x the head), z toward the ribs' feet, y absolute (every part is set on the sand
// where it lies: terrain.heightAt). One mesh, coloured per vertex (bone, its holes, cloth, footprints): one draw.
// It collides as drawn. Teo's drum (src/story/desert-errands.js) stands against the inside of the middle rib's foot,
// at local (-5, 23.75) for s = 1.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BONE = '#f2ead6', BONE2 = '#e9dec4', HOLE = '#7a6857', CLOTH = '#b8394a', STEP = '#dca35c';
let MAT = null;
/** The ribcages' material: bone coloured per vertex (shared by every ribcage). */
export const ribcageMaterial = () => (MAT ??= makeMaterial({ color: '#ffffff', vertexColors: true }));

/** The middle rib (the drum's): its foot, ribcage-local, for a skeleton of size s. */
export const RIB_FOOT = { x: -5, z: 23.75 };

function finish(g, color) {
  if (!g.attributes.normal) g.computeVertexNormals();
  const geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/** A closed tube tapering from r0 to r1 along the points (horns, tusks, the snout). */
function tube(points, r0, r1, seg = 14, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points), frames = curve.computeFrenetFrames(seg, false), pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, c = curve.getPointAt(u), r = THREE.MathUtils.lerp(r0, r1, u), N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j % radial) / radial * Math.PI * 2;
      pos.push(c.x + (Math.cos(a) * N.x + Math.sin(a) * B.x) * r, c.y + (Math.cos(a) * N.y + Math.sin(a) * B.y) * r, c.z + (Math.cos(a) * N.z + Math.sin(a) * B.z) * r);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  for (const [i, r, sgn] of [[0, r0, -1], [seg, r1, 1]]) {
    const c = curve.getPointAt(i / seg).addScaledVector(frames.tangents[i], sgn * r * 0.5), k = pos.length / 3, ring = i * (radial + 1);
    pos.push(c.x, c.y, c.z);
    for (let j = 0; j < radial; j++) idx.push(...(sgn > 0 ? [k, ring + j, ring + j + 1] : [k, ring + j + 1, ring + j]));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A flat band along a curve (a rib): `w` across (along `axis`), `t` thick within the arch's plane. */
function band(curve, w, t, seg, axis, radial = 8) {
  const pos = [], idx = [], T0 = V(0, 0, 0), N = V(0, 0, 0);
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, c = curve.getPointAt(u);
    curve.getTangentAt(u, T0);
    N.crossVectors(T0, axis).normalize();
    for (let j = 0; j <= radial; j++) {
      const a = (j % radial) / radial * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // (a rounded-off rectangle: flat faces, soft edges)
      const fx = Math.sign(ca) * Math.abs(ca) ** 0.6, fy = Math.sign(sa) * Math.abs(sa) ** 0.6;
      pos.push(c.x + axis.x * w * fx + N.x * t * fy, c.y + axis.y * w * fx + N.y * t * fy, c.z + axis.z * w * fx + N.z * t * fy);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A giant skeleton lying in the sand.
 * @param kit { terrain, add(mesh, x, z, r), mark(x, z, r) } (src/world.js's prop kit)
 * @param story { drum: { x, z } } the old ribcage's extras: a scrap of cloth by the drum, footprints leading to it
 */
export function desertRibcage({ terrain, add, mark = () => {} }, x, z, s, rot, { story = null } = {}) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  const world = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  const ground = (lx, lz) => { const [wx, wz] = world(lx, lz); return terrain.heightAt(wx, wz); };
  const geos = [];
  const put = (g, color) => geos.push(finish(g, color));
  let seed = Math.abs(Math.round(x * 13 + z * 7)) % 997 + 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---- the spine: vertebrae from the tail (-x) to the neck, half sunk in the sand
  const X0 = -50 * s, X1 = 40 * s, STEP_X = 3.2 * s;
  const size = (lx) => lx < -28 * s ? THREE.MathUtils.lerp(0.45, 1, (lx - X0) / (-28 * s - X0)) : lx > 26 * s ? THREE.MathUtils.lerp(1, 0.78, (lx - 26 * s) / (X1 - 26 * s)) : 1;
  const spineY = (lx) => ground(lx, 0) + 0.2 * 1.5 * s * size(lx);
  for (let lx = X0; lx <= X1 + 0.01; lx += STEP_X) {
    const f = size(lx), rb = 1.5 * s * f, L = 2.85 * s * f, y = spineY(lx), tone = rnd() < 0.5 ? BONE : BONE2;
    // the body: a spool along x
    put(new THREE.LatheGeometry([[0, -L / 2], [rb * 0.92, -L / 2], [rb, -L / 2 + 0.18 * f], [rb * 0.8, 0], [rb, L / 2 - 0.18 * f], [rb * 0.92, L / 2], [0, L / 2]].map(([r, h]) => new THREE.Vector2(Math.max(r, 0.001), h)), 8)
      .rotateZ(Math.PI / 2).translate(lx, y, 0), tone);
    // its spine: a blade standing up, leaning toward the tail, a knob on top
    const hp = 3.2 * s * f * (0.85 + 0.3 * rnd()), lean = 0.32;
    put(new THREE.CylinderGeometry(0.3 * s * f, 0.75 * s * f, hp, 6).scale(1, 1, 0.5).translate(0, hp / 2, 0).rotateZ(lean).translate(lx, y + rb * 0.7, 0), tone);
    put(new THREE.SphereGeometry(0.45 * s * f, 6, 4).translate(lx - Math.sin(lean) * hp, y + rb * 0.7 + Math.cos(lean) * hp, 0), tone);
    // the wings either side (the far one mostly under the sand)
    for (const side of [-1, 1]) put(new THREE.CylinderGeometry(0.28 * s * f, 0.5 * s * f, 1.5 * rb, 5).translate(0, 0.85 * rb, 0).rotateX(side * (Math.PI / 2 + 0.25)).translate(lx, y + 0.1 * rb, side * 0.6 * rb), tone);
  }

  // ---- the ribs: nine arches off the spine, down into the sand on the +z side
  const RIBS = 9;
  for (let i = 0; i < RIBS; i++) {
    const xs = -26 * s + 6.5 * s * i, k = 1 - 0.42 * ((i - 4) / 4) ** 2;
    const fx = xs + RIB_FOOT.x * s * k, fz = RIB_FOOT.z * s * k, H = 22 * s * k;
    const S0 = V(xs, spineY(xs) + 1.1 * s, 1.0 * s), F = V(fx, ground(fx, fz) - 0.9 * s, fz);
    const broken = i === 1, J = 14, last = broken ? 8 : J;
    const pts = [];
    for (let j = 0; j <= last; j++) {
      const th = (j / J) * Math.PI, m = (1 - Math.cos(th)) / 2;
      pts.push(V(THREE.MathUtils.lerp(S0.x, F.x, m), THREE.MathUtils.lerp(S0.y, F.y, m) + H * Math.sin(th) ** 0.8, THREE.MathUtils.lerp(S0.z, F.z, m)));
    }
    const apex = V(THREE.MathUtils.lerp(S0.x, F.x, 0.5), 0, THREE.MathUtils.lerp(S0.z, F.z, 0.5)).setY(S0.y + H);
    const axis = new THREE.Vector3().crossVectors(apex.clone().sub(S0), F.clone().sub(S0)).normalize();
    if (axis.x < 0) axis.negate();
    const curve = new THREE.CatmullRomCurve3(pts), w = 1.05 * s * (0.85 + 0.15 * k), t = 0.5 * s;
    put(band(curve, w, t, broken ? 14 : 26, axis), BONE);
    put(new THREE.SphereGeometry(1.05 * s, 8, 5).scale(1, 0.8, 1).translate(S0.x, S0.y, S0.z), BONE);   // its head on the spine
    if (broken) {
      // snapped off high on the arch: a knobbed end, and the rest of it lying in the sand by its foot
      const e = pts[pts.length - 1];
      put(new THREE.SphereGeometry(0.62 * s, 8, 6).scale(1.1, 0.8, 1).translate(e.x, e.y, e.z), BONE);
      const a = V(fx + 1.5 * s, 0, fz * 0.7), b = V(fx + 2.6 * s, 0, fz * 0.86), d = V(fx + 3.1 * s, 0, fz * 1.02);
      for (const p of [a, b, d]) p.y = ground(p.x, p.z) + 0.18 * s;
      b.y += 0.35 * s;
      put(band(new THREE.CatmullRomCurve3([a, b, d]), w, t, 8, V(0, 1, 0).cross(d.clone().sub(a)).normalize()), BONE2);
    }
    // holes through the bone, on both faces
    if (!broken && i % 4 !== 0) {
      const T0 = V(0, 0, 0), N = V(0, 0, 0), m = new THREE.Matrix4();
      for (const u of [0.3 + 0.08 * (i % 3), 0.62 + 0.05 * (i % 2)]) {
        const p = curve.getPointAt(u); curve.getTangentAt(u, T0); N.crossVectors(T0, axis).normalize();
        for (const sgn of [-1, 1]) {
          const n = N.clone().multiplyScalar(sgn);
          m.makeBasis(axis.clone().multiplyScalar(w * 0.5), T0.clone().multiplyScalar(0.8 * s * (0.8 + 0.4 * rnd())), n.clone().multiplyScalar(0.08 * s)).setPosition(p.clone().addScaledVector(n, t * 0.9));
          put(new THREE.SphereGeometry(1, 8, 4).applyMatrix4(m), HOLE);
        }
      }
    }
  }

  // ---- the skull at the head end, half sunk: two horns curving up, two tusks reaching forward
  {
    const Z = 1.45, hx = X1 + 9 * s, g = ground(hx, -0.5 * s), C = V(hx, g + 2.2 * s, -0.5 * s), R = V(7 * s * Z, 4.3 * s * Z, 4.8 * s * Z);
    const cr = new THREE.SphereGeometry(1, 16, 11).scale(R.x, R.y, R.z).rotateZ(-0.18).translate(C.x, C.y, C.z);
    put(cr, BONE);
    // a point on the cranium (dir in its own frame), and the surface's normal there
    const onSkull = (d) => {
      const u = d.clone().normalize(), p = V(u.x * R.x, u.y * R.y, u.z * R.z).applyAxisAngle(V(0, 0, 1), -0.18).add(C);
      const n = V(u.x / R.x, u.y / R.y, u.z / R.z).normalize().applyAxisAngle(V(0, 0, 1), -0.18);
      return [p, n];
    };
    const m = new THREE.Matrix4();
    for (const [d, r] of [[V(0.55, 0.45, 0.72), 1.5], [V(0.6, 0.62, -0.5), 1.35], [V(-0.25, 0.75, 0.62), 0.7]]) {
      const [p, n] = onSkull(d), a = V(0, 1, 0).cross(n).normalize(), b = n.clone().cross(a).normalize();
      m.makeBasis(a.multiplyScalar(r * s * Z), b.multiplyScalar(r * 0.75 * s * Z), n.clone().multiplyScalar(0.3 * s)).setPosition(p.addScaledVector(n, -0.06 * s));
      put(new THREE.SphereGeometry(1, 10, 6).applyMatrix4(m), HOLE);   // the sockets (and a hole in the crown)
    }
    // the snout, sloping down into the sand
    const sn0 = V(hx + 6.5 * s, g + 2.8 * s, -0.4 * s), sn1 = V(hx + 13 * s, g + 2.0 * s, -0.3 * s), sn2 = V(hx + 18 * s, ground(hx + 18 * s, 0) + 0.8 * s, -0.2 * s);
    put(tube([sn0, sn1, sn2], 4.2 * s, 2.1 * s, 10, 9), BONE2);
    for (const side of [-1, 1]) {
      const b = (lx, dy, lz) => V(hx + lx * s * Z, g + dy * s * Z, side * lz * s * Z - 0.4 * s);
      put(tube([b(6.5, 2.6, 1.8), b(7.8, 8, 2.6), b(6.4, 14.5, 3.2), b(2.6, 18.5, 3.4)], 1.3 * s, 0.16 * s, 16, 7), BONE);   // a horn
      put(tube([b(9.5, 1.3, 2.0), b(15, 0.9, 3.6), b(20.5, 2.6, 4.4), b(23, 6.5, 4.0)], 1.1 * s, 0.16 * s, 16, 7), BONE);    // a tusk
    }
  }

  // ---- the old ribcage's extras: a scrap of cloth by Teo's drum, and footprints leading to it
  if (story?.drum) {
    const lx0 = story.drum.x - x, lz0 = story.drum.z - z, dl = V(lx0 * c - lz0 * sn, 0, lx0 * sn + lz0 * c);   // the drum, ribcage-local
    const onSand = (g, lift) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)) + lift + p.getY(i)); g.computeVertexNormals(); return g; };
    const cloth = new THREE.PlaneGeometry(1.5, 1.0, 5, 4).rotateX(-Math.PI / 2);
    { const p = cloth.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, 0.05 * Math.sin(p.getX(i) * 5.1) * Math.cos(p.getZ(i) * 4.3) + 0.03); }
    put(onSand(cloth.rotateY(0.5).translate(dl.x + 1.1, 0, dl.z - 0.95), 0), CLOTH);
    const track = new THREE.CatmullRomCurve3([V(9, 0, 9), V(4, 0, 14), V(0, 0, 18.5), V(dl.x + 1.2, 0, dl.z - 1.5)]);
    const n = Math.floor(track.getLength() / 0.72), T0 = V(0, 0, 0);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, p = track.getPointAt(u); track.getTangentAt(u, T0);
      const side = i % 2 ? 1 : -1, h = Math.atan2(T0.x, T0.z);
      const foot = new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2).scale(0.085, 1, 0.17).rotateY(h).translate(p.x + Math.cos(h) * side * 0.15, 0, p.z - Math.sin(h) * side * 0.15);
      put(onSand(foot, 0.035), STEP);
    }
  }

  const mesh = new THREE.Mesh(mergeGeometries(geos), ribcageMaterial());
  mesh.name = 'Ribcage';
  mesh.userData.ribcage = true;
  mesh.position.set(x, 0, z);
  mesh.rotation.y = rot;
  add(mesh, x, z, 70 * s);
  // the props' footprints: where the old ribs' feet stood (unchanged, so the rest of the desert is placed as it was)
  const len = 120 * s, ribs = 11;
  for (let i = 0; i < ribs; i++) {
    const t = 0.12 + (i / (ribs - 1)) * 0.76, k = Math.sin(Math.PI * t) * 0.8 + 0.2, lx = (t - 0.5) * len - 5 * s;
    for (const side of [-1, 1]) { const lz = side * 24 * s * k; mark(x + lx * c + lz * sn, z - lx * sn + lz * c, 2 * s); }
  }
  return mesh;
}
