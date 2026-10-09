import * as THREE from 'three';
import { skullPoint } from '../costumes.js';

// The family's own pieces (src/characters/family.js FAMILY_LOOKS[id].kit), for humanoid.js costumeGeometry
// through quest-pieces.js questPieces: the father's rust vest, shirt, roll-neck and coat lapels; the mother's
// wound teal scarf and her recorder; Lou's striped collar and patch pockets; Ilen's shirt, coral lapels and tool belt; Tove's
// shawl, apron bib and tunic. Their coats, tunics, linings and the apron's skirt are the robe's
// (humanoid.js robeGeometry options); their boots are costumes.js SHINS.
//
// The pieces on the body are laid on its own surface (`Surface`: the trunk's vertices binned by height and
// angle, on this body as built: its build, its age, a child's morph) a few millimetres out, and each vertex
// takes the skin weights of the trunk's vertex nearest it, so they bend with the spine exactly as the body
// under them does instead of riding one bone (no gap at the waist when they lean, nothing through the belly).
// What is held (the father's cap, Lou's drawing) is in the hand frame, as quest-pieces.js toolKit's tools.
//
//   familyPieces(design, look, h) → { chest, head, back, hand, skinned } additions (h: the Humanoid; null: none on the body)

const TRUNK = /spine|pelvis|neck/i;   // (not the clavicles: the shoulders stand out past the chest, and a piece on the trunk stays off them)
const ROWS = 48, SECTORS = 48;
const _v = new THREE.Vector3();

/**
 * The trunk's surface on a body, from its belt (t 0) to the base of its neck (t 1), below and above too
 * (t -0.6 .. 1.3): its radius by height and angle (a: 0 at the front, + toward +x, as the robe's), found by
 * casting a ray out from the trunk's axis at each height and angle to the farthest of the trunk's triangles
 * (the bodies are low in vertices: their faces, not their points, are the surface); and the trunk's vertices,
 * to take weights from.
 */
export class Surface {
  constructor(h) {
    const g = h.fullBody?.() ?? h.body.geometry, P = g.attributes.position, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
    const bones = h.body.skeleton.bones;
    this.belt = h.outfitRest[1];
    this.neck = h.outfitRest[2] + 0.03;
    this.span = this.neck - this.belt;
    const T0 = -0.6, T1 = 1.3;
    this.T0 = T0; this.T1 = T1;
    // each vertex by the bone that carries it most: the trunk's (2), the hips' and thighs' (1), the rest (0:
    // the arms, which hang beside the trunk, the head, the shins and feet)
    const kindOf = bones.map((b) => (TRUNK.test(b.name) ? 2 : /thigh/i.test(b.name) ? 1 : 0));
    const part = new Uint8Array(P.count), idx = [];
    for (let i = 0; i < P.count; i++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = W.getComponent(i, k); if (w > bw) { bw = w; best = J.getComponent(i, k); } }
      part[i] = kindOf[best];
      if (part[i] === 2) idx.push(i);
    }
    this.idx = idx; this.P = P; this.J = J; this.W = W;
    // the trunk's triangles (a corner on the trunk, none on an arm, the head or a shin), as flat arrays: the
    // bodies are light, the trunk's faces long, many reaching to the shoulders' and the hips' vertices
    const index = g.index ? g.index.array : Array.from({ length: P.count }, (_, i) => i);
    const tris = [];
    for (let f = 0; f + 2 < index.length; f += 3) {
      const a = index[f], b = index[f + 1], c = index[f + 2];
      if (!part[a] || !part[b] || !part[c] || (part[a] < 2 && part[b] < 2 && part[c] < 2)) continue;
      tris.push(P.getX(a), P.getY(a), P.getZ(a), P.getX(b), P.getY(b), P.getZ(b), P.getX(c), P.getY(c), P.getZ(c));
    }
    const tri = new Float32Array(tris);
    // each row's axis: the middle of where the trunk's faces cross its height
    const yOf = (k) => this.belt + (T0 + (k + 0.5) / ROWS * (T1 - T0)) * this.span;
    const rows = [];
    for (let k = 0; k < ROWS; k++) {
      const y = yOf(k);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, n = 0;
      for (let q = 0; q < tri.length; q += 9) for (let e = 0; e < 3; e++) {
        const i = q + e * 3, j = q + ((e + 1) % 3) * 3, ya = tri[i + 1], yb = tri[j + 1];
        if ((ya - y) * (yb - y) > 0 || ya === yb) continue;
        const u = (y - ya) / (yb - ya), x = tri[i] + (tri[j] - tri[i]) * u, z = tri[i + 2] + (tri[j + 2] - tri[i + 2]) * u;
        n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
      rows.push({ y, n, x: n ? (x0 + x1) / 2 : 0, z: n ? (z0 + z1) / 2 : 0, r: new Float32Array(SECTORS) });
    }
    // rows with no trunk near them: the axis of the nearest row that has one
    for (let k = 0; k < ROWS; k++) if (!rows[k].n) {
      let j = 1; while (j < ROWS && !(rows[k - j]?.n || rows[k + j]?.n)) j++;
      const R = rows[k - j]?.n ? rows[k - j] : rows[k + j];
      if (R) { rows[k].x = R.x; rows[k].z = R.z; }
    }
    // a ray out from the axis at each height and angle: the farthest trunk triangle it meets
    for (const R of rows) for (let s = 0; s < SECTORS; s++) {
      const a = ((s + 0.5) / SECTORS) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      let far = 0;
      for (let q = 0; q < tri.length; q += 9) {
        const d = rayTri(R.x, R.y, R.z, dx, dz, tri, q);
        if (d > far) far = d;
      }
      R.r[s] = far;
    }
    // what no ray met (past the neck, under the hips, the armpits): from the sectors beside it, then the rows
    for (const R of rows) {
      if (!R.r.some((v) => v > 0)) continue;
      for (let pass = 0; pass < SECTORS && R.r.some((v) => !v); pass++) {
        const next = R.r.slice();
        for (let s = 0; s < SECTORS; s++) if (!R.r[s]) { const a = R.r[(s + SECTORS - 1) % SECTORS], b = R.r[(s + 1) % SECTORS]; if (a || b) next[s] = a && b ? (a + b) / 2 : a || b; }
        R.r = next;
      }
    }
    for (let k = 0; k < ROWS; k++) if (!rows[k].r.some((v) => v > 0)) {
      let j = 1; while (j < ROWS && !(rows[k - j]?.r.some((v) => v > 0) || rows[k + j]?.r.some((v) => v > 0))) j++;
      const R = rows[k - j]?.r.some((v) => v > 0) ? rows[k - j] : rows[k + j];
      if (R) rows[k].r = R.r.slice();
    }
    this.rows = rows;
  }

  /** The point on the surface at height t, angle a, `out` metres off it (bind space), into `out3`. */
  at(t, a, out = 0, out3 = new THREE.Vector3()) {
    const f = THREE.MathUtils.clamp((t - this.T0) / (this.T1 - this.T0) * ROWS - 0.5, 0, ROWS - 1.001);
    const k = Math.floor(f), u = f - k;
    const r = (R) => {
      const g = (((a / (Math.PI * 2)) * SECTORS - 0.5) % SECTORS + SECTORS) % SECTORS;
      const s = Math.floor(g), v = g - s;
      return R.r[s] * (1 - v) + R.r[(s + 1) % SECTORS] * v;
    };
    const A = this.rows[k], B = this.rows[Math.min(ROWS - 1, k + 1)];
    const x = A.x + (B.x - A.x) * u, z = A.z + (B.z - A.z) * u, rad = r(A) + (r(B) - r(A)) * u + out;
    return out3.set(x + Math.sin(a) * rad, this.belt + t * this.span, z + Math.cos(a) * rad);
  }

  /** The trunk vertex nearest a point (bind space): its skin indices and weights. */
  weightsAt(p) {
    let best = -1, bd = Infinity;
    const P = this.P;
    for (const i of this.idx) {
      const dx = P.getX(i) - p.x, dy = P.getY(i) - p.y, dz = P.getZ(i) - p.z, d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return [[0, 1, 2, 3].map((k) => this.J.getComponent(best, k)), [0, 1, 2, 3].map((k) => this.W.getComponent(best, k))];
  }
}

/** A horizontal ray (from x, y, z along dx, 0, dz) against triangle q of a flat array: its distance, or 0 (missed). */
function rayTri(ox, oy, oz, dx, dz, t, q) {
  const ax = t[q], ay = t[q + 1], az = t[q + 2];
  const e1x = t[q + 3] - ax, e1y = t[q + 4] - ay, e1z = t[q + 5] - az, e2x = t[q + 6] - ax, e2y = t[q + 7] - ay, e2z = t[q + 8] - az;
  // p = d × e2 (d = (dx, 0, dz))
  const px = -dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-9) return 0;
  const inv = 1 / det, sx = ox - ax, sy = oy - ay, sz = oz - az;
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return 0;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (dx * qx + dz * qz) * inv;
  if (v < 0 || u + v > 1) return 0;
  const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return d > 0 ? d : 0;
}

/** A Surface for a Humanoid's body as it is now (kept with its geometry). */
export function surfaceOf(h) {
  const g = h.fullBody?.() ?? h.body.geometry;
  if (g.userData.familySurface?.belt !== h.outfitRest[1]) g.userData.familySurface = new Surface(h);
  return g.userData.familySurface;
}

const fn = (v) => (typeof v === 'function' ? v : () => v);

/**
 * A piece laid on the surface: rows from t0 to t1 (each a number, or a function of the angle: a point at the
 * front), columns from a0 to a1 (each a number, or a function of t: a V, a lapel widening at the top), `out` off it (or a function of t and the row's share u across: a roll's
 * bulge). Skinned with the nearest trunk vertex's weights. A closed ring when a1 - a0 is a full turn.
 */
export function surfacePatch(S, { role, t0, t1, a0 = -Math.PI, a1 = Math.PI, out = 0.006, rows = 1, cols = 1 }) {
  const A0 = fn(a0), A1 = fn(a1), B0 = fn(t0), B1 = fn(t1), O = typeof out === 'function' ? out : () => out;
  // at least as fine as the surface's own grid, so two pieces laid one over the other follow its folds alike
  // (a coarser one cuts across them and sinks into the finer one under it)
  const span = Math.abs(B1(0) - B0(0)), turn = Math.abs(A1(0.5) - A0(0.5)) / (Math.PI * 2);
  rows = Math.max(rows, Math.ceil(span * ROWS / (S.T1 - S.T0)));
  cols = Math.max(cols, Math.ceil(turn * SECTORS));
  const pos = [], idx = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      // (t0 and t1 may follow the angle round: a shawl's point low at the front)
      const am = A0(0.5) + (A1(0.5) - A0(0.5)) * (c / cols), b0 = B0(am), t = b0 + (B1(am) - b0) * (r / rows);
      const a = A0(t) + (A1(t) - A0(t)) * (c / cols);
      S.at(t, a, O(t, c / cols, r / rows), _v);
      pos.push(_v.x, _v.y, _v.z);
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1; idx.push(a, b, d, b, e, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return skinnedOn(S, geo, role);
}

/** A geometry (bind space) as a skinned piece on the trunk: each vertex with its nearest trunk vertex's weights. */
export function skinnedOn(S, geo, role) {
  const n = geo.attributes.position.count, J = new Uint16Array(n * 4), W = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const [j, w] = S.weightsAt(_v.fromBufferAttribute(geo.attributes.position, i));
    J.set(j, i * 4); W.set(w, i * 4);
  }
  const joints = (i) => [Array.from(J.subarray(i * 4, i * 4 + 4)), Array.from(W.subarray(i * 4, i * 4 + 4))];
  joints.arrays = () => ({ J: J.slice(), W: W.slice() });
  return { geo, role, joints };
}

/** A small solid placed on the surface at (t, a), `out` off it, turned to face out from it (an oval recorder, a pouch). */
function onSurface(S, geo, t, a, out, role) {
  const p = S.at(t, a, out, new THREE.Vector3()), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
  geo.applyQuaternion(q).translate(p.x, p.y, p.z);
  return skinnedOn(S, geo, role);
}

const TURN = Math.PI * 2;
const smooth = THREE.MathUtils.smoothstep;
// a coat's front edge: from `a` at the belt, widening to `top` from t 0.6 (the lapel)
const lapel = (a, top) => (t) => a + (top - a) * smooth(t, 0.55, 1.0);

function trunkPieces(id, L, S) {
  const out = [];
  const patch = (o) => out.push(surfacePatch(S, o));
  switch (id) {
    case 'father':
      // the rust vest, its V at the throat, a cream shirt in the V, a navy roll-neck; the coat's darker front
      // edges and lapels either side, and its collar standing behind the neck
      patch({ role: L.vest, t0: -0.04, t1: 0.86, a0: lapel(-0.78, -0.38), a1: lapel(0.78, 0.38), out: 0.007, rows: 8, cols: 12 });
      patch({ role: L.shirt, t0: 0.6, t1: 0.98, a0: (t) => -0.42 * smooth(t, 0.6, 0.95), a1: (t) => 0.42 * smooth(t, 0.6, 0.95), out: 0.009, rows: 4, cols: 6 });
      patch({ role: L.collar, t0: 0.92, t1: 1.12, a0: -Math.PI, a1: Math.PI, out: (t, u, v) => 0.012 + 0.006 * Math.sin(v * Math.PI), rows: 3, cols: 24 });
      for (const s of [-1, 1]) patch({ role: L.accent, t0: -0.04, t1: 1.0, a0: (t) => (s < 0 ? -lapel(0.98, 0.95)(t) : lapel(0.74, 0.34)(t)), a1: (t) => (s < 0 ? -lapel(0.74, 0.34)(t) : lapel(0.98, 0.95)(t)), out: (t) => 0.011 + 0.006 * smooth(t, 0.6, 1), rows: 8, cols: 3 });
      patch({ role: L.cloth, t0: 0.95, t1: 1.1, a0: 0.75, a1: TURN - 0.75, out: (t, u, v) => 0.018 + 0.01 * v, rows: 2, cols: 16 });
      break;
    case 'mother': {
      // the scarf wound twice at her throat in a loose thick roll, then both ends down her front over the
      // tunic: the teal one on her left, its coral lining showing on the other; her recorder on its cord
      patch({ role: L.scarf, t0: 0.88, t1: 1.16, out: (t, u, v) => 0.03 + 0.03 * Math.sin(v * Math.PI), rows: 4, cols: 24 });
      patch({ role: L.scarf, t0: 0.8, t1: 0.97, a0: -1.25, a1: 1.25, out: (t, u, v) => 0.04 + 0.02 * Math.sin(v * Math.PI) + 0.008 * Math.sin(u * 9), rows: 3, cols: 14 });
      const hang = (t) => 0.028 + 0.34 * Math.max(0, -t) + 0.035 * Math.max(0, 0.3 - Math.abs(t - 0.45));
      patch({ role: L.scarf, t0: -0.16, t1: 0.8, a0: (t) => 0.08 + 0.05 * t, a1: (t) => 0.7 + 0.06 * t, out: hang, rows: 10, cols: 4 });
      patch({ role: L.lining, t0: -0.12, t1: 0.8, a0: (t) => -0.72 - 0.05 * t, a1: (t) => -0.12 - 0.05 * t, out: hang, rows: 10, cols: 4 });
      patch({ role: L.scarf, t0: -0.11, t1: 0.8, a0: (t) => -0.24 - 0.05 * t, a1: (t) => -0.1 - 0.05 * t, out: (t) => hang(t) + 0.005, rows: 10, cols: 1 });
      patch({ role: L.recorder, t0: -0.01, t1: 0.03, out: 0.009, rows: 1, cols: 24 });
      out.push(onSurface(S, new THREE.SphereGeometry(1, 12, 8).scale(0.034, 0.044, 0.012), -0.07, 0.95, 0.03, L.recorder));
      out.push(onSurface(S, new THREE.SphereGeometry(1, 10, 6).scale(0.016, 0.016, 0.006), -0.075, 0.95, 0.042, '#7a5b40'));
      break;
    }
    case 'lou':
      // the striped collar of her undershirt at the neck of the tunic
      patch({ role: L.collar, t0: 0.9, t1: 1.04, out: (t, u, v) => 0.006 + 0.004 * Math.sin(v * Math.PI), rows: 2, cols: 24 });
      patch({ role: '#d9dde2', t0: 0.95, t1: 0.99, out: 0.0115, rows: 1, cols: 24 });
      // two coral patch pockets on the front of the tunic, each with its flap
      for (const s of [-1, 1]) {
        patch({ role: L.pockets, t0: 0.06, t1: 0.4, a0: s < 0 ? -0.78 : 0.2, a1: s < 0 ? -0.2 : 0.78, out: 0.009 });
        patch({ role: '#c95a44', t0: 0.37, t1: 0.42, a0: s < 0 ? -0.8 : 0.18, a1: s < 0 ? -0.18 : 0.8, out: 0.012 });
      }
      break;
    case 'ilen':
      // the cream shirt open at the neck between the coat's coral-lined fronts, the coat's teal collar behind,
      // a narrow tool belt with two pouches and a trowel at her hip
      patch({ role: L.shirt, t0: -0.04, t1: 0.98, a0: lapel(-0.5, -0.3), a1: lapel(0.5, 0.3), out: 0.006, rows: 8, cols: 10 });
      patch({ role: L.skin, t0: 0.8, t1: 0.99, a0: (t) => -0.16 * smooth(t, 0.8, 0.98), a1: (t) => 0.16 * smooth(t, 0.8, 0.98), out: 0.0075, rows: 2, cols: 4 });
      for (const s of [-1, 1]) patch({ role: L.lapel, t0: -0.06, t1: 1.02, a0: (t) => (s < 0 ? -lapel(0.72, 0.62)(t) : lapel(0.5, 0.3)(t)), a1: (t) => (s < 0 ? -lapel(0.5, 0.3)(t) : lapel(0.72, 0.62)(t)), out: (t) => 0.011 + 0.007 * smooth(t, 0.6, 1), rows: 8, cols: 3 });
      patch({ role: L.cloth, t0: 0.94, t1: 1.1, a0: 0.62, a1: TURN - 0.62, out: (t, u, v) => 0.018 + 0.012 * v, rows: 2, cols: 16 });
      patch({ role: L.belt, t0: -0.02, t1: 0.05, a0: -0.62, a1: 0.62, out: 0.012, rows: 1, cols: 8 });
      out.push(onSurface(S, new THREE.BoxGeometry(0.07, 0.085, 0.035), -0.06, 0.45, 0.03, L.pouch));
      out.push(onSurface(S, new THREE.BoxGeometry(0.05, 0.07, 0.03), -0.05, -0.38, 0.028, L.pouch));
      out.push(onSurface(S, new THREE.CylinderGeometry(0.009, 0.011, 0.14, 6).translate(0, -0.04, 0), -0.02, 0.6, 0.034, '#7b5a3a'));
      break;
    case 'tove':
      // her dusty-blue tunic over the olive undersleeves; the pale apron's bib on it; the lavender shawl round
      // her shoulders and over the tops of her arms, its point low at the front, wrapped once at the throat
      patch({ role: L.cloak, t0: -0.04, t1: 0.94, out: 0.013, rows: 12, cols: 36 });
      patch({ role: L.apron, t0: -0.04, t1: 0.6, a0: -0.7, a1: 0.7, out: 0.022 });
      patch({ role: L.shawl, t0: (a) => 0.62 - 0.2 * Math.max(0, Math.cos(a)) ** 2, t1: 1.12, a0: -Math.PI, a1: Math.PI, rows: 7, cols: 32,
        out: (t, u, v) => { const a = (u - 0.5) * TURN, side = Math.abs(Math.sin(a)) ** 1.5; return 0.03 + side * (0.09 + 0.02 * v) + 0.012 * (1 - v) + 0.007 * Math.sin(u * TURN * 4); } });
      patch({ role: L.shawl, t0: 0.9, t1: 1.14, out: (t, u, v) => 0.05 + 0.025 * Math.sin(v * Math.PI), rows: 3, cols: 24 });
      break;
  }
  return out;
}

// the hand frame (quest-pieces.js toolKit's): the hand at the origin, the arm up +y, the palm's front +z
function heldPieces(tool, L) {
  const a = [];
  if (tool === 'flightCap') {
    // his old soft flight cap, held by its brim at his side: a crumpled khaki bowl, its peak down, ear flaps
    const bowl = new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 0.75, 1.12);
    const p = bowl.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + 0.06 * Math.sin(i * 1.7)), p.getY(i), p.getZ(i));
    bowl.computeVertexNormals();
    a.push({ role: L.hat, geo: bowl.rotateX(Math.PI * 0.62).translate(0, -0.1, 0.07) });
    a.push({ role: '#5f5a4a', geo: new THREE.SphereGeometry(0.1, 12, 4, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.1).scale(1, 0.75, 1.12).rotateX(Math.PI * 0.62).translate(0, -0.1, 0.07) });
    a.push({ role: L.hat, geo: new THREE.SphereGeometry(0.06, 8, 4, 0, Math.PI, 0, Math.PI / 2).scale(1, 0.25, 1).rotateX(-0.4).translate(0, -0.02, 0.1) });
  } else if (tool === 'drawing') {
    // a folded drawing (a few sheets) held at her side, the fold up
    a.push({ role: L.paper, geo: new THREE.BoxGeometry(0.2, 0.15, 0.012).translate(0.0, -0.09, 0.06) });
    a.push({ role: '#e6d38e', geo: new THREE.BoxGeometry(0.19, 0.14, 0.006).translate(0.006, -0.095, 0.07) });
    a.push({ role: '#3f4140', geo: new THREE.BoxGeometry(0.2, 0.004, 0.014).translate(0, -0.015, 0.06) });
  }
  return a.length ? a : null;
}

// the head frame (costumes.js HEADS: the skull egg, skullPoint): Lou's two messy bunches, high on the sides of her
// head, tufts sticking out every way, tied with a coral band
function headPieces(L) {
  if (!L.bunches) return [];
  const a = [], kind = L.kind === 'f' ? 'f' : 'm';
  for (const s of [-1, 1]) {
    const c = new THREE.Vector3(...skullPoint(kind, s * 104, 16, 0.006)), outw = new THREE.Vector3(s, 0.3, -0.2).normalize();
    a.push({ role: 'hair', geo: new THREE.SphereGeometry(0.04, 10, 8).scale(1.1, 0.95, 1).translate(c.x + outw.x * 0.022, c.y + outw.y * 0.022, c.z + outw.z * 0.022) });
    a.push({ role: L.accent, geo: new THREE.TorusGeometry(0.022, 0.006, 4, 12).rotateY(Math.PI / 2).translate(c.x, c.y, c.z) });
    for (let i = 0; i < 6; i++) {
      const u = (i / 6) * Math.PI * 2 + s * 0.4, d = new THREE.Vector3(Math.cos(u) * 0.9, Math.sin(u) * 0.9, 0).add(outw.clone().multiplyScalar(1.2)).normalize();
      const g = new THREE.ConeGeometry(0.024, 0.06 + (i % 3) * 0.018, 5).scale(1, 1, 0.6).translate(0, 0.03, 0)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
      const at = c.clone().addScaledVector(outw, 0.034);
      a.push({ role: 'hair', geo: g.translate(at.x, at.y, at.z) });
    }
  }
  return a;
}

/** The family's pieces for a look (its design: FAMILY_LOOKS[id]) on a Humanoid. */
export function familyPieces(design, look, h) {
  const L = { ...look, ...design };
  const skinned = (h?.fullBody?.() ?? h?.body?.geometry)?.attributes.skinIndex ? trunkPieces(design.kit, L, surfaceOf(h)) : [];
  return { skinned, head: headPieces(L), hand: heldPieces(design.tool, L) };
}
