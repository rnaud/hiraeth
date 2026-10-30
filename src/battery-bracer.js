import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The makers' bracer (issue #799; references/characters/battery/bracer/, the author's pick: "I like the battery embedded
// into the glove, that makes sense and it's easy to do"): a brown leather bracer round his right forearm, the gloved
// one, from just under his shirt's rolled sleeve down to his wrist, and set lengthwise along its back the makers'
// battery, a slim glass cell (fluid-tool.js buildFlask, TANK), held by two brass brackets, two darker straps with brass
// buckles round it. It replaced the battery on his left hip (issues #728, #745: hung from his belt, it swung, slid and
// tucked out of his arm's and his thigh's way). Everything here is rigid on the forearm's bone (lowerarm_r), so it goes
// wherever his forearm goes, in every clip, and shows in every pose, with nothing to dodge.
//
// Fitted to the forearm it is worn on (fitBracer): the bind pose's skin and sleeves carried by the forearm's bone, in
// the bone's frame (y down the forearm from the elbow, the wrist at 0.259 m on the traveller; x and z across it), taken
// at `rows` stations along it and `seg` angles round it: the furthest of him from the bone at each, plus `margin`,
// is the leather's inside there. So it fits B3 and v2 alike, and whatever sleeve an outfit wears there (FluidTool fits
// it again when the drawn meshes change). The forearm rolls with the bone (Humanoid.shareWristRoll gives it half the
// wrist's roll), so its skin stays inside the leather in every clip, and the bracer ends a hand's width above the wrist
// so the hand bends free of it (tests/battery-bracer.test.js measures both on v2 and B3 through every clip he plays).
//
//   BRACER                  the bracer's tuning (where along the forearm, the leather, the cell's place round it)
//   fitBracer(meshes, base) a fit: the tuning and the inside's radii (Float32Array rows × seg), from the meshes
//   radiusAt(fit, y, a)     the leather's inside at y down the forearm, `a` round it (rad, atan2(z, x))
//   bracerInside(fit, p)    how far a point of the bone's frame is inside the leather's inside (m; radially)
//   bracerGap(fit, p)       how far a point is outside the leather itself (m; in it: < 0)
//   cellFrame(fit, cell)    { position, quaternion, up, out } of the cell's frame (buildFlask's: y up the glass from
//                           its wrist end, +z into his arm) in the bone's frame
//   buildBracer(fit, cell, mat)   the leather, its straps and buckles, the cell's bed and brackets (a Group)

export const BRACER = {
  bone: 'lowerarm_r',
  carry: /^lowerarm(_twist_\d+)?_r$/,   // the bones whose skin it fits round
  y: [0.09, 0.19],                // m down the forearm from the elbow: under the rolled sleeve's hem (0.07) to a hand's width above the wrist (0.259)
  rows: 9, seg: 24,              // the fit's stations along it and angles round it
  margin: 0.0022,                // between his skin and the leather
  flare: [0.165, 0.0028],        // from here down to the wrist end, up to this much more (the wrist's skin turns with the hand)
  floor: 0.018,                  // the least inside radius (a station with nothing of him in it)
  thick: 0.0028,                 // the leather
  lip: 0.0012,                   // its rolled edges, proud of it
  roll: -0.4,                    // the cell's place round the forearm (rad, atan2(z, x)): the back of the forearm, out from him as it hangs
  sink: 0.004,                   // how far the cell lies sunk in its bed
  open: { at: -1.75, half: 0.5 },   // the slit it is laced over, on the little finger's side (rad round, half its width): the hilt
                                    // lies back along the forearm there as he cocks his wrist for the first cut
  notch: null,                   // (its wrist end cut back somewhere: { at, half, cut })
  straps: [0.09, 0.91],          // two darker straps round it near its ends (shares of its length there), each with a brass buckle
  strap: { w: 0.01, t: 0.0016 },
  fallback: [0.034, 0.026],      // a body with nothing to fit to (a test's bare rig): an ellipse this wide (x, z)
};

// (its straps and its brass are kit-colours.js PACK_BASE's leather and brass: a fight temple's palette paints them)
const LEATHER = '#6a3d22', LEATHER_DARK = '#5a4030', BRASS = '#c8903f';
const TAU = Math.PI * 2;
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();

/** The skinned meshes drawn under `root` that carry the forearm's bone (`skip`: meshes left out, the glove's). */
export function forearmMeshes(root, { bone = BRACER.bone, skip = null } = {}) {
  const out = [];
  root?.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry?.attributes?.skinIndex || skip?.has(o)) return;
    for (let w = o; w; w = w.parent) if (w.visible === false) return;
    if (o.skeleton.bones.some((b) => b.name === bone)) out.push(o);
  });
  return out;
}

/**
 * Fit the bracer to the forearm of these meshes (their bind pose; `base` the tuning): the furthest of their vertices
 * carried by the forearm (half their weight or more) from its bone at each station and angle, gaps filled from their
 * neighbours, widened by a bin each way and smoothed along it, plus the margin. `sig` names the meshes it was fitted to.
 */
export function fitBracer(meshes, base = BRACER) {
  const { rows: K, seg: N, y: [y0, y1] } = base, step = (y1 - y0) / (K - 1), r = new Float32Array(K * N);
  for (const m of meshes ?? []) {
    const bones = m.skeleton.bones, bi = bones.findIndex((b) => b.name === base.bone);
    if (bi < 0) continue;
    const carry = bones.map((b) => base.carry.test(b.name));
    _m.multiplyMatrices(m.skeleton.boneInverses[bi], m.bindMatrix);
    const P = m.geometry.attributes.position, J = m.geometry.attributes.skinIndex, W = m.geometry.attributes.skinWeight;
    for (let i = 0; i < P.count; i++) {
      let w = 0;
      for (let c = 0; c < 4; c++) if (carry[J.getComponent(i, c)]) w += W.getComponent(i, c);
      if (w < 0.5) continue;
      _v.fromBufferAttribute(P, i).applyMatrix4(_m);
      const k = Math.round((_v.y - y0) / step);
      if (k < 0 || k >= K || Math.abs(_v.y - (y0 + k * step)) > step / 2 + 0.004) continue;
      const a = Math.round(((Math.atan2(_v.z, _v.x) + TAU) % TAU) / TAU * N) % N, d = Math.hypot(_v.x, _v.z);
      if (d > r[k * N + a]) r[k * N + a] = d;
    }
  }
  const any = r.some((x) => x > 0);
  for (let k = 0; k < K; k++) {
    const row = r.subarray(k * N, (k + 1) * N);
    if (!any) { for (let a = 0; a < N; a++) { const t = (a / N) * TAU; row[a] = 1 / Math.hypot(Math.cos(t) / base.fallback[0], Math.sin(t) / base.fallback[1]) - base.margin; } continue; }
    // (an angle with nothing of him in it: from its nearest neighbours each way)
    for (let a = 0; a < N; a++) {
      if (row[a] > 0) continue;
      let l = 1, h = 1;
      while (l < N && !(row[(a - l + N) % N] > 0)) l++;
      while (h < N && !(row[(a + h) % N] > 0)) h++;
      const lo = row[(a - l + N) % N], hi = row[(a + h) % N];
      row[a] = lo > 0 && hi > 0 ? lo + (hi - lo) * l / (l + h) : Math.max(lo, hi, base.floor);
    }
    // (a bin either way: the vertices lie a bin apart round the thinner forearm)
    const wide = Float32Array.from(row, (_, a) => Math.max(row[(a + N - 1) % N], row[a], row[(a + 1) % N]));
    row.set(wide.map((x, a) => Math.max(row[a], (wide[(a + N - 1) % N] + 2 * x + wide[(a + 1) % N]) / 4)));
  }
  // along it: each station no thinner than the mean of its neighbours (no waist between two rows), then the margin
  const out = new Float32Array(K * N);
  for (let k = 0; k < K; k++) for (let a = 0; a < N; a++) {
    const here = r[k * N + a], up = r[Math.max(0, k - 1) * N + a], dn = r[Math.min(K - 1, k + 1) * N + a];
    const y = y0 + k * step, flare = base.flare ? base.flare[1] * THREE.MathUtils.clamp((y - base.flare[0]) / (y1 - base.flare[0]), 0, 1) : 0;
    out[k * N + a] = Math.max(here, (up + dn) / 2, base.floor) + base.margin + flare;
  }
  return { ...base, r: out, sig: (meshes ?? []).map((m) => `${m.id}:${m.geometry.id}`).join(',') };
}

/** How far `a` (rad round the forearm) is into the slit (rad; outside it: < 0). */
export function inSlit(fit, a) {
  const o = fit.open;
  if (!o) return -Infinity;
  return o.half - Math.abs(((a - o.at + Math.PI) % TAU + TAU) % TAU - Math.PI);
}
/** Where the leather ends at the wrist, `a` round the forearm (m down it): cut back by the notch. */
export function bracerEnd(fit, a) {
  const n = fit.notch;
  if (!n) return fit.y[1];
  const d = Math.abs(((a - n.at + Math.PI) % TAU + TAU) % TAU - Math.PI), k = THREE.MathUtils.clamp(1 - d / n.half, 0, 1);
  return fit.y[1] - n.cut * k * k * (3 - 2 * k);
}
/** The leather's inside at y down the forearm and `a` round it (rad, atan2(z, x)): the fit's radii, between stations. */
export function radiusAt(fit, y, a) {
  const { rows: K, seg: N, y: [y0, y1], r } = fit;
  const fy = THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1) * (K - 1), k0 = Math.min(K - 2, Math.floor(fy)), ty = fy - k0;
  const fa = (((a % TAU) + TAU) % TAU) / TAU * N, a0 = Math.floor(fa) % N, a1 = (a0 + 1) % N, ta = fa - Math.floor(fa);
  const at = (k) => r[k * N + a0] + (r[k * N + a1] - r[k * N + a0]) * ta;
  return at(k0) + (at(k0 + 1) - at(k0)) * ty;
}
/** How far a point (the bone's frame) is inside the leather's inside, radially (m; out past it: < 0; its ends not counted). */
export function bracerInside(fit, p) {
  return radiusAt(fit, p.y, Math.atan2(p.z, p.x)) - Math.hypot(p.x, p.z);
}
/** How thick the leather stands at y: its own, a strap's over it, a lip at its ends. */
function shellAt(fit, y, a) {
  let t = fit.thick;
  const end = bracerEnd(fit, a), at = (s) => fit.y[0] + s * (end - fit.y[0]);
  if (fit.straps.some((s) => Math.abs(y - at(s)) <= fit.strap.w / 2)) t += fit.strap.t;
  if (y - fit.y[0] < 0.004 || end - y < 0.004) t += fit.lip;
  return t;
}
/** How far a point (the bone's frame) is outside the leather itself (m; in it: < 0). */
export function bracerGap(fit, p) {
  const a = Math.atan2(p.z, p.x), y = THREE.MathUtils.clamp(p.y, fit.y[0], bracerEnd(fit, a)), r = Math.hypot(p.x, p.z), r0 = radiusAt(fit, y, a), r1 = r0 + shellAt(fit, y, a);
  const radial = Math.max(r0 - r, r - r1), along = Math.abs(p.y - y), slit = inSlit(fit, a) * r;   // (in the slit: m to its edge)
  const d = radial > 0 ? Math.hypot(radial, along) : along > 0 ? along : radial;
  return slit > 0 ? Math.max(d, slit) : d;
}

/** A point on the leather's outside (the bone's frame) at y and `a` round it, `out` m further out. */
function onLeather(fit, y, a, out = 0) {
  const R = radiusAt(fit, y, a) + fit.thick + out;
  return new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
}

/**
 * The cell's frame in the bone's (`cell`: { height, capR }, fluid-tool.js TANK): its foot at the wrist end, its glass
 * up the forearm toward the elbow, lying on the leather at `roll`, sunk `sink` into its bed (+z of its frame into his
 * arm, its rails across the forearm).
 */
export function cellFrame(fit, cell) {
  const mid = (fit.y[0] + fit.y[1]) / 2, ya = mid + cell.height / 2, yb = mid - cell.height / 2;
  // (the outermost of the leather under its glass, so it lies on it and never in it)
  const lift = (y) => Math.max(...[-1, 0, 1].map((s) => radiusAt(fit, y, fit.roll + s * 0.25) + fit.thick - radiusAt(fit, y, fit.roll) - fit.thick));
  const foot = onLeather(fit, ya, fit.roll, cell.capR - fit.sink + lift(ya)), head = onLeather(fit, yb, fit.roll, cell.capR - fit.sink + lift(yb));
  const up = head.clone().sub(foot).normalize();
  const out = new THREE.Vector3(Math.cos(fit.roll), 0, Math.sin(fit.roll));
  const inward = out.clone().negate().addScaledVector(up, out.dot(up)).normalize();
  const x = new THREE.Vector3().crossVectors(up, inward);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, inward));
  return { position: foot, quaternion, up, out };
}

/** A closed band between two rings of points (each [x, y, z][] of one length), facing out of the ring. */
function band(a, b, closed = true) {
  const pos = [], n = a.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const j = (i + 1) % n;
    pos.push(...a[i], ...a[j], ...b[i], ...a[j], ...b[j], ...b[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/**
 * The bracer's meshes (the bone's frame; `mat(color)` the house material maker): the leather (its outside, its
 * inside, its rolled edges), its two darker straps with brass buckles, the cell's darker bed and its two brass
 * brackets (bands over the glass's ends, pinned to the leather). Returns a Group named 'Makers bracer'.
 */
export function buildBracer(fit, cell, mat) {
  const g = new THREE.Group();
  g.name = 'Makers bracer';
  const N = fit.seg * 2, rows = (fit.rows - 1) * 2, leather = [], dark = [], brass = [], O = fit.open, closed = !O;
  // (round it from one edge of the slit to the other, or all round)
  const a0 = O ? O.at + O.half : 0, span = O ? TAU - 2 * O.half : TAU, n = closed ? N : N + 1;
  const angle = (i) => a0 + (i / N) * span;
  // (a ring at a share `s` of its length, `dy` m further down, `out` m out from its inside: its wrist end follows the notch)
  const point = (a, s, out, dy = 0) => { const y = fit.y[0] + s * (bracerEnd(fit, a) - fit.y[0]) + dy, R = radiusAt(fit, y, a) + out; return [Math.cos(a) * R, y, Math.sin(a) * R]; };
  const ring = (s, out, dy = 0) => Array.from({ length: n }, (_, i) => point(angle(i), s, out, dy));
  const B = (a, b) => band(a, b, closed);
  const ss = Array.from({ length: rows + 1 }, (_, i) => i / rows);
  // the shell: its outside and (turned) its inside
  for (let i = 0; i < rows; i++) {
    leather.push(B(ring(ss[i], fit.thick), ring(ss[i + 1], fit.thick)));
    leather.push(B(ring(ss[i + 1], 0), ring(ss[i], 0)));
  }
  // the slit's edges, rolled, with brass eyelets down them for its lacing
  if (O) for (const [a, d] of [[a0, 1], [a0 + span, -1]]) {
    const col = (out) => ss.map((s) => point(a, s, out));
    dark.push(d > 0 ? band(col(fit.thick + fit.lip), col(-0.0004), false) : band(col(-0.0004), col(fit.thick + fit.lip), false));
    for (let k = 1; k <= 4; k++) { const p = point(a + d * 0.06, k / 5, fit.thick + 0.0006); brass.push(new THREE.CylinderGeometry(0.0018, 0.0018, 0.0012, 8).rotateZ(Math.PI / 2).rotateY(-(a + d * 0.06)).translate(p[0], p[1], p[2])); }
  }
  // the rolled lips at its ends, closing it
  for (const [s, d] of [[0, 1], [1, -1]]) {
    const L = fit.lip, a = ring(s, -0.0004), b = ring(s, fit.thick + L), c = ring(s, fit.thick + L * 0.4, d * 0.004);
    dark.push(d > 0 ? B(b, a) : B(a, b), d > 0 ? B(c, b) : B(b, c));
  }
  // the straps: a darker band round it near each end, a brass buckle on it round from the cell
  const { w, t } = fit.strap, len = fit.y[1] - fit.y[0];
  for (const s of fit.straps) {
    const hw = w / 2 / len;
    dark.push(B(ring(s - hw, fit.thick + t), ring(s + hw, fit.thick + t)));
    dark.push(B(ring(s - hw, fit.thick), ring(s - hw, fit.thick + t)), B(ring(s + hw, fit.thick + t), ring(s + hw, fit.thick)));
    const a = fit.roll + 1.25, y = fit.y[0] + s * (bracerEnd(fit, a) - fit.y[0]), p = onLeather(fit, y, a, t + 0.0015);
    brass.push(new THREE.BoxGeometry(0.0035, w * 1.3, 0.011).rotateY(-a).translate(p.x, p.y, p.z));
  }
  // the cell's bed (a darker strip of leather it lies sunk in) and its brackets: brass bands over the glass's ends,
  // from the leather on one side over the cell to the other, a rivet at each foot
  const F = cellFrame(fit, cell), toBone = new THREE.Matrix4().compose(F.position, F.quaternion, new THREE.Vector3(1, 1, 1));
  dark.push(new THREE.BoxGeometry(cell.capR * 2 + 0.007, cell.height + 0.004, 0.005).translate(0, cell.height / 2, cell.capR - fit.sink + 0.0015).applyMatrix4(toBone));
  for (const y of cell.brackets) {
    const R = cell.railX + 0.0032;
    brass.push(new THREE.TorusGeometry(R, 0.0019, 5, 18, Math.PI).rotateX(-Math.PI / 2).translate(0, y, 0).applyMatrix4(toBone));
    for (const sx of [-1, 1]) brass.push(new THREE.CylinderGeometry(0.0019, 0.0019, cell.capR - fit.sink + 0.002, 6).rotateX(Math.PI / 2).translate(sx * R, y, (cell.capR - fit.sink + 0.002) / 2).applyMatrix4(toBone));
  }
  const strip = (list) => list.map((geo) => { const o = geo.index ? geo.toNonIndexed() : geo; for (const k of Object.keys(o.attributes)) if (k !== 'position') o.deleteAttribute(k); o.computeVertexNormals(); return o; });
  for (const [list, color, name] of [[leather, LEATHER, 'Bracer leather'], [dark, LEATHER_DARK, 'Bracer straps'], [brass, BRASS, 'Bracer brass']]) {
    const m = new THREE.Mesh(mergeGeometries(strip(list)), mat(color));
    m.name = name;
    g.add(m);
  }
  g.traverse((o) => { o.userData.noCollide = true; });
  return g;
}
