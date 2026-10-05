import * as THREE from 'three';
import { MODE_STRATA } from '../materials.js';
import { createNoise2D, smoothstep } from '../noise.js';
import { put } from './lab-kit.js';

// ---------------------------------------------------------------------------
// The references' building blocks (src/levels/reference-views.js, reference-desert.js): shapes,
// ground functions and the things the desert sheets draw again and again (ribcages in the dunes,
// dishes on stems, gorge walls, bridges, domes, petals, buried machine heads, table cliffs).
// Every builder takes the view's RoomKit (lab-kit.js) and works in the view's own frame.
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const tube = (pts, r, seg = 16, radial = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, radial, false);
export const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg);
export const sagPts = (a, b, sag, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return a.clone().lerp(b, t).add(V(0, -sag * Math.sin(Math.PI * t), 0)); });
export const n1 = createNoise2D(37751), n2 = createNoise2D(37752), n3 = createNoise2D(37753);
/** Dunes with sharp crests (ridged noise): the crease between the two slopes is inked. */
export const ridged = (x, z, f, seed = 0) => 1 - Math.abs(n1(x * f + seed, z * f * 1.7 - seed));
export const gauss = (x, z, cx, cz, s) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));
export const r2 = (x, z) => Math.hypot(x, z);
export { smoothstep, put };
/** A dome: half a sphere, squashed. */
export const dome = (r, sy = 1, seg = 18) => new THREE.SphereGeometry(r, seg, Math.ceil(seg / 2), 0, TAU, 0, Math.PI / 2).scale(1, sy, 1);
/** The panels' small violet figures. */
export const PERSON = { cloak: '#b48ccf', lining: '#8d6aae', cloth: '#a688c4', legs: '#7e62a0', hat: '#b48ccf' };
/** The ink preset's touches every view shares: the panels' skies are clean, no cloud on them. */
export const CLEAN_SKY = { uCumulus: 0, uClouds: 0 };

/** A bat-wing sail: a membrane between fingers fanned from a base point, scalloped and billowed. */
export function sailGeo(B, fingers, bulge) {
  const pos = [], idx = [], n = 14, m = 10;
  for (let f = 0; f < fingers.length - 1; f++) {
    const A = fingers[f].clone().sub(B), C = fingers[f + 1].clone().sub(B), nrm = A.clone().cross(C).normalize();
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
      const u = i / n, t = j / m;
      const p = A.clone().lerp(C, t).multiplyScalar(u * (1 - 0.09 * Math.sin(Math.PI * t) * u ** 3)).add(B);
      p.addScaledVector(nrm, bulge * Math.sin(Math.PI * t) * Math.sin(Math.PI * 0.5 * u));
      pos.push(p.x, p.y, p.z);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = base + i * (m + 1) + j; idx.push(a, a + m + 1, a + 1, a + 1, a + m + 1, a + m + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A ribbon lying on the ground along a path (local x, z points), `w` wide: tracks, drawn as a tone. */
export function groundRibbon(H, pts, w, lift = 0.03) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0, z)));
  const n = Math.max(8, Math.round(curve.getLength() / 0.8)), pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n), t = curve.getTangent(i / n), sx = -t.z, sz = t.x;
    for (const e of [-1, 1]) { const x = p.x + sx * w * 0.5 * e, z = p.z + sz * w * 0.5 * e; pos.push(x, H(x, z) + lift, z); }
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A grid of ground-hugging triangles over local x0..x1 and a far edge zFar(x) to zNear: a patch of another tone. */
export function groundPatch(H, x0, x1, zNear, zFar, nx = 60, nz = 24, lift = 0.04) {
  const pos = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx, z = zNear + ((zFar(x) - zNear) * j) / nz;
    pos.push(x, H(x, z) + lift, z);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; idx.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** A dish on a yoke: paraboloid, rim, feed on four struts; `el` tilts its face up from the horizon, `az` turns it. */
export function radioDish(kit, mat, rope, x, y, z, R, el, az) {
  const depth = 0.34 * R, f = 0.62 * R;
  const orient = (g) => g.rotateX(Math.PI / 2 - el).rotateY(az).translate(x, y, z);
  kit.add(mat, orient(lathe(Array.from({ length: 14 }, (_, i) => { const r = (i / 13) * R; return [r, depth * (r / R) ** 2]; }), 56)));
  kit.add(rope, orient(new THREE.TorusGeometry(R, R * 0.018, 5, 56).rotateX(Math.PI / 2).translate(0, depth, 0)));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    kit.add(rope, orient(tube([V(Math.cos(a) * R * 0.92, depth * 0.85, Math.sin(a) * R * 0.92), V(0, f, 0)], R * 0.012, 1, 4)), { solid: false });
  }
  kit.add(mat, orient(new THREE.CylinderGeometry(R * 0.05, R * 0.08, R * 0.16, 10).translate(0, f, 0)));
  // the ribs on its back and a hub
  kit.add(rope, orient(new THREE.CylinderGeometry(R * 0.1, R * 0.12, R * 0.12, 10).translate(0, -R * 0.04, 0)));
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    kit.add(rope, orient(tube([V(0, -R * 0.02, 0), V(Math.cos(a) * R * 0.5, depth * 0.2, Math.sin(a) * R * 0.5), V(Math.cos(a) * R * 0.96, depth * 0.93, Math.sin(a) * R * 0.96)], R * 0.01, 6, 3)), { solid: false });
  }
}

/**
 * A ribcage lying in the sand: a spine along local +x (turned by yaw about its middle), ribs arching
 * up over it and down either side, a skull at one end (skull: 1 the +x end, -1 the -x end, 0 none).
 * len: the spine's length; rise: the ribs' height; sink: how far it lies in the sand.
 */
export function ribcage(kit, { bone, shade, dark }, { x, z, yaw = 0, len = 20, rise = 4, ribs = 13, sink = 0.4, skull = -1, lean = 0.4 }) {
  const H = (px, pz) => kit.H(px, pz);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const W = (lx, ly, lz) => { const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c; return V(wx, H(wx, wz) + ly - sink, wz); };
  const spine = new THREE.CatmullRomCurve3(Array.from({ length: 7 }, (_, i) => { const t = i / 6; return W((t - 0.5) * len, rise * (0.55 + 0.25 * Math.sin(Math.PI * t)), 0); }));
  kit.add(bone, new THREE.TubeGeometry(spine, 40, Math.max(0.2, rise * 0.07), 7, false));
  for (let i = 0; i <= ribs; i++) {
    const t = 0.08 + (i / ribs) * 0.8, top = spine.getPoint(t), g = Math.sin(Math.PI * Math.min(1, (t + 0.04) / 0.92));
    const R = rise * (0.45 + 0.6 * g);
    for (const side of [1, -1]) {
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const a = (j / 8) * Math.PI * 0.95;
        const lx = (t - 0.5) * len - lean * Math.sin(a) * R * 0.4, lz = side * Math.sin(a) * R * 1.05;
        const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
        pts.push(V(wx, top.y - (1 - Math.cos(a)) * R * 0.85, wz));
      }
      kit.add(i % 3 === 1 ? shade : bone, tube(pts, Math.max(0.12, rise * (0.04 + 0.025 * g)), 14, 5));
    }
  }
  if (dark) kit.add(dark, put(new THREE.SphereGeometry(1, 16, 10), x, H(x, z) + rise * 0.45 - sink, z, yaw, [len * 0.3, rise * 0.45, rise * 0.55]), { solid: false });
  if (skull) {
    const e = skull * len * 0.5, k = rise * 0.42;
    const p = W(e + skull * k * 1.6, k * 1.1, 0);
    kit.add(bone, put(new THREE.SphereGeometry(1, 20, 14), p.x, p.y, p.z, yaw, [k * 2.1, k * 1.4, k * 1.5]));
    const q = W(e + skull * k * 4.0, k * 0.7, 0.2);
    kit.add(bone, put(new THREE.ConeGeometry(1, 1, 14, 1).rotateZ(skull > 0 ? -Math.PI / 2 : Math.PI / 2), q.x, q.y, q.z, yaw, [k * 3.2, k * 1.1, k * 1.1]));
    if (dark) { const o = W(e + skull * k * 1.9, k * 1.25, k * 1.25); kit.add(dark, put(new THREE.SphereGeometry(1, 10, 8), o.x, o.y, o.z, yaw, [k * 0.55, k * 0.4, k * 0.25]), { solid: false }); }
  }
}

/** A dish on a fluted stem (the umbrella city, the blue saucers): a stem flaring into a shallow bowl, rim inked. */
export function stemDish(kit, { cap, stem, rim }, { x, z, h, R, r = R * 0.12, tilt = 0, az = 0, bowl = 0.22, under = true }) {
  const y = kit.base(x, z, r * 1.5) - 0.3;
  kit.add(stem, lathe([[r * 1.9, 0], [r * 1.2, h * 0.12], [r, h * 0.5], [r * 1.25, h * 0.82], [r * 2.4, h * 0.97], [r * 3.2, h]], 24).translate(x, y, z));
  const orient = (g) => g.rotateX(tilt).rotateY(az).translate(x, y + h, z);
  // the bowl: a shallow cup opening up, its underside a lathe too (one cap material, both faces)
  kit.add(cap, orient(lathe(Array.from({ length: 12 }, (_, i) => { const t = i / 11, rr = r * 3 + (R - r * 3) * t; return [rr, bowl * R * t * t]; }), 48)));
  if (under) kit.add(cap, orient(lathe([[R, bowl * R], [R * 0.7, -0.05 * R], [r * 3.1, -0.02 * R]], 48)));
  if (rim) kit.add(rim, orient(new THREE.TorusGeometry(R, R * 0.012, 4, 64).rotateX(Math.PI / 2).translate(0, bowl * R, 0)), { solid: false });
}

/**
 * A canyon wall: a ragged face (x = x0 + slope·(z0 - z)·side, wandering) extruded up in set-back tiers,
 * its back far behind (side -1: the left wall, facing +x; 1: the right wall).
 */
export function gorgeWall(kit, mat, { side, x0, slope = 0, z0, z1, top, tiers = [[0, 0.5, 0], [0.5, 1, 4]], seed = 1, rag = 2.6 }) {
  const nW = createNoise2D(3775 + seed);
  for (const [y0, y1, inset] of tiers.map(([a, b, c]) => [a * top, b * top, c])) {
    const sh = new THREE.Shape(), n = 48, pts = [];
    for (let i = 0; i <= n; i++) {
      const z = z0 + ((z1 - z0) * i) / n;
      pts.push([x0 + slope * (z0 - z) * side + side * (inset + rag * nW(z * 0.05 + seed, seed) + 1.4 * Math.sin(z * 0.21 + seed)), z]);
    }
    for (let i = n; i >= 0; i--) { const z = z0 + ((z1 - z0) * i) / n; pts.push([x0 + side * 160, z]); }
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
    kit.add(mat, new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2).translate(0, y0 - 2, 0));
  }
}

/** A rope bridge from A to B: two sagging cables, a deck on hangers. towers: posts at each end. */
export function bridge(kit, { rope, plank }, a, b, { sag = 6, deckSag = 8, width = 1.6, hang = 1.6, towers = 0 } = {}) {
  const A = V(...a), B = V(...b), across = B.clone().sub(A).setY(0).normalize(), side = V(-across.z, 0, across.x).multiplyScalar(width / 2);
  for (const e of [-1, 1]) {
    const off = side.clone().multiplyScalar(e);
    const cable = sagPts(A.clone().add(off).add(V(0, hang + towers, 0)), B.clone().add(off).add(V(0, hang + towers, 0)), sag, 30);
    const deck = sagPts(A.clone().add(off), B.clone().add(off), deckSag, 30);
    kit.add(rope, tube(cable, 0.07, 60, 3), { solid: false });
    kit.add(plank, tube(deck, 0.1, 60, 4), { solid: false });
    for (let i = 2; i < 30; i += 2) kit.add(rope, tube([cable[i], deck[i]], 0.03, 1, 3), { solid: false });
    if (towers) for (const P of [A, B]) kit.add(rope, tube([P.clone().add(off).add(V(0, -2, 0)), P.clone().add(off).add(V(0, hang + towers + 0.5, 0))], 0.18, 1, 5), { solid: false });
  }
}

/** A machine head half buried: a great round shell with a visor ring, dark sockets, side pods. */
export function machineHead(kit, { shell, dark, trim }, { x, z, r, yaw = 0, sink = 0.35, tilt = 0.25 }) {
  const y = kit.base(x, z, r * 0.8) - r * sink;
  kit.add(shell, put(new THREE.SphereGeometry(1, 30, 20), x, y + r * 0.6, z, yaw, [r * 1.15, r, r], tilt, 0));
  // the face: a visor ring and two dark sockets, turned to +x of its own frame
  const c = Math.cos(yaw), s = Math.sin(yaw), F = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const [vx, vy, vz] = F(r * 0.95, r * 0.65, 0);
  kit.add(trim, put(new THREE.TorusGeometry(r * 0.5, r * 0.08, 6, 28).rotateY(Math.PI / 2), vx, vy, vz, yaw, 1, tilt * 0.5, 0));
  for (const e of [-1, 1]) { const [ex, ey, ez] = F(r * 1.0, r * 0.68, e * r * 0.24); kit.add(dark, put(new THREE.SphereGeometry(r * 0.17, 12, 8), ex, ey, ez, yaw, [0.5, 1, 1]), { solid: false }); }
  // pods and a fin on the back
  const [px, py, pz] = F(-r * 0.6, r * 0.3, r * 0.9);
  kit.add(shell, put(new THREE.SphereGeometry(1, 16, 10), px, py, pz, yaw, [r * 0.7, r * 0.45, r * 0.45]));
  const [qx, qy, qz] = F(-r * 1.3, r * 0.15, -r * 0.4);
  kit.add(shell, put(new THREE.CylinderGeometry(r * 0.28, r * 0.35, r * 1.4, 12).rotateZ(Math.PI / 2), qx, qy, qz, yaw + 0.3));
  kit.add(trim, put(new THREE.BoxGeometry(r * 1.2, r * 0.08, r * 0.5), x, y + r * 1.55, z, yaw, 1, 0, 0.2));
}

/** A table cliff along a curve: x(t) z(t) for t 0..1 from `face`, extruded in tiers (MODE_STRATA material). */
export function tableCliff(kit, mat, face, tiers = [[-4, 30, 0]], back = 400) {
  for (const [y0, y1, inset] of tiers) {
    const sh = new THREE.Shape(), n = 90, pts = [];
    for (let i = 0; i <= n; i++) pts.push(face(i / n, inset));
    const [xa] = pts[0], [xb] = pts[n];
    pts.push([xb, -back], [xa, -back]);
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
    kit.add(mat, new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2).translate(0, y0, 0));
  }
}

/**
 * Cupped petals splayed round a point (the petal station, the pod): n long shallow cups from the
 * centre outward, each tipped up by `lean` (rad over the horizontal), their bases `lift` high.
 */
export function petals(kit, mats, { x, z, n = 8, len = 9, w = 3.2, lean = 0.25, lift = 0.6, az = 0, cup = 0.22 }) {
  const y = kit.H(x, z);
  for (let i = 0; i < n; i++) {
    const a = az + (i / n) * TAU, m = mats[i % mats.length];
    // a cup: the lower half of a flattened ellipsoid, its long axis along +x from the base out
    const g = new THREE.SphereGeometry(1, 24, 10, 0, TAU, Math.PI * 0.5, Math.PI * 0.5).scale(len / 2, w * cup, w / 2).translate(len / 2, 0, 0);
    g.rotateZ(lean).rotateY(-a);
    kit.add(m, g.translate(x, y + lift, z), { solid: false });
  }
}

/** A glass cage dome: meridians and rings of thin tubes. */
export function cage(kit, rope, { x, y, z, r, h, meridians = 10, rings = 4 }) {
  for (let i = 0; i < meridians; i++) {
    const a = (i / meridians) * TAU, pts = [];
    for (let j = 0; j <= 10; j++) { const t = (j / 10) * Math.PI / 2; pts.push(V(x + Math.cos(a) * r * Math.cos(t), y + h * Math.sin(t), z + Math.sin(a) * r * Math.cos(t))); }
    kit.add(rope, tube(pts, 0.06, 12, 3), { solid: false });
  }
  for (let j = 1; j <= rings; j++) { const t = (j / (rings + 1)) * Math.PI / 2; kit.add(rope, new THREE.TorusGeometry(r * Math.cos(t), 0.05, 3, 32).rotateX(Math.PI / 2).translate(x, y + h * Math.sin(t), z), { solid: false }); }
  kit.add(rope, new THREE.SphereGeometry(0.35, 8, 6).translate(x, y + h + 0.2, z), { solid: false });
}

/** A strata material for a canyon or cliff (flat facets: its edges inked). */
export const strataMat = (kit, c1, c2, c3, size = 5) => kit.mat({ color: c1, color2: c2, color3: c3, mode: MODE_STRATA, strataSize: size, flat: true });
