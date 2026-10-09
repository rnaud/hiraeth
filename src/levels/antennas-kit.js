import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { formAxis } from '../form.js';
import { taper as taperTube } from './wood-kit.js';
import { thinBar, thinTube, thinRing, thinPole } from '../thin.js';

// ---------------------------------------------------------------------------
// The Forest of Antennas' shapes, shared by the world (antennas.js) and its reference views
// (reference-antennas.js), after the sheets (references/levels/The Forest of Antennas/environment/reference-1 … 4):
//   latticeTower  a tall tapering lattice mast: three or four legs, X-braced bays, vines climbing
//                 it, leaf clumps on them and strands hanging from the struts
//   dish          a parabolic dish (its axis +y, its vertex at the origin): the bowl, the rim, the feed
//                 on its tripod, the ribs on its back
//   saucer        the flat nest dish on top of a mast: a shallow bowl on a conical underside
//   aimAt         turns a dish's parts to face a direction about a pivot
//   column        a lathed column (a receiver's pedestal, a stalk)
//   dome          a rounded repair workshop: round lit windows in dark frames, an arched lit door
//   egg           the great bulbous workshop under the receiver
//   vineCable     a sagging cable grown over with vine: lumpy, leaf clumps along it, strands hanging
//   cable         a plain sagging wire
//   trussStair    a steep metal stair on its truss, railed, from one point to another
//   deck          a square platform of planks with a railing (gaps where a stair or bridge meets it)
//   bird          a small perched bird, a few dozen faces (instanced on the dishes' rims)
// Each returns plain geometries by role in the caller's frame (no materials, no placing in a scene):
//   iron (the lattice, the rust-dark metal), vine, leaf, dish, under (a dish's underside), frame (thin dark
//   metal: feeds, ribs, rails), shell (the workshops), trim (window frames), glow (lit windows), plank.
// `detail` (1 the views' near shapes, under 1 the world's and the far ones) thins the segments and bracing.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const UP = V(0, 1, 0);
const _q = new THREE.Quaternion();
/** A tapering tube along points (wood-kit's), each vertex carrying its axis point: kept a least width far off (src/thin.js). */
const taper = (pts, r, end, tub, rad) => thinTube(taperTube(pts, r, end, tub, rad), new THREE.CatmullRomCurve3(pts), tub, rad);
/** A torus round the y axis at height y (a rim), R round, kept a least width far off. */
const rim = (R, tube, radial, seg, y = 0) => thinRing(new THREE.TorusGeometry(R, tube, radial, seg), R, seg, radial).rotateX(Math.PI / 2).translate(0, y, 0);
const roles = () => ({ iron: [], vine: [], leaf: [], dish: [], under: [], frame: [], shell: [], trim: [], glow: [], plank: [] });
/** Every role of b appended to a's (a builder's parts gathered into a scene's). */
export function gather(a, b) { for (const [k, v] of Object.entries(b)) if (Array.isArray(v) && v[0]?.isBufferGeometry) (a[k] ??= []).push(...v); return a; }
/** Each geometry of every role moved by f(g) (in place), the parts returned. */
export function moveParts(parts, f) { for (const v of Object.values(parts)) if (Array.isArray(v)) for (const g of v) if (g?.isBufferGeometry) f(g); return parts; }

/** A straight round bar from a to b, radius r at a and r1 at b, `radial` sides (open-ended unless caps). */
export function bar(a, b, r, r1 = r, radial = 5, caps = false) {
  const d = b.clone().sub(a), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r, L, radial, 1, !caps);
  g.deleteAttribute('uv');
  g.translate(0, L / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(UP, d.normalize()));
  return thinBar(g.translate(a.x, a.y, a.z), a, b);   // (kept a least width far off: src/thin.js)
}
/** A lathe of [r, y] points (r kept off the axis), `seg` round. */
export const lathe = (pts, seg = 24) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg); g.deleteAttribute('uv'); return g; };
/** Points from a to b sagging by `sag` in the middle (a hanging cable). */
export const sagPts = (a, b, sag, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return a.clone().lerp(b, t).add(V(0, -sag * Math.sin(Math.PI * t), 0)); });
/** A lumpy clump of leaves, r round (an icosahedron pushed about a little). */
function clump(rng, r, x, y, z, detail = 0) {
  const g = new THREE.IcosahedronGeometry(r, detail), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const k = 0.75 + rng() * 0.5; P.setXYZ(i, P.getX(i) * k, P.getY(i) * k * 0.8, P.getZ(i) * k); }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g.translate(x, y, z);
}
/** A strand of vine hanging from p, len long, curling a little. */
function strand(rng, p, len, r = 0.035) {
  const a = rng() * TAU, c = 0.15 + rng() * 0.3;
  return taper([p.clone(), p.clone().add(V(Math.cos(a) * c * 0.5, -len * 0.5, Math.sin(a) * c * 0.5)), p.clone().add(V(Math.cos(a) * c, -len, Math.sin(a) * c))], r, 0.3, 3, 3);
}

/**
 * A lattice mast, its foot at the origin: `legs` legs from w0 (their distance from the axis at the foot) to w1 at
 * the top `h` up, bays about `bay` high X-braced on every face (one diagonal under detail 0.6), a ring at the top;
 * vines (0..1) climb the legs, leaf clumps on them and strands (hang 0..1) hanging from the struts. r, s: the legs'
 * and the struts' radii; open: the bottom bay that high left unbraced (walked in under). { iron, vine, leaf, top: { y, w }, feet: [[x, z]] }.
 */
export function latticeTower({ h = 30, w0 = 2.2, w1 = 0.5, legs = 3, bay = 2.8, r = 0.16, s = 0.07, seed = 1, rot = 0, vines = 0.5, hang = 0.5, detail = 1, foot = 0.8, leaves = 1, open = 0 } = {}) {
  const rng = mulberry32(Math.floor(seed * 7307) + 11), out = roles();
  const P = (k, y) => { const a = rot + (k / legs) * TAU, w = w0 + (w1 - w0) * (y / h); return V(Math.cos(a) * w, y, Math.sin(a) * w); };
  const rad = detail < 0.6 ? 3 : 4;
  for (let k = 0; k < legs; k++) out.iron.push(bar(P(k, -foot), P(k, h), r, r * 0.65, detail < 0.6 ? 4 : 6, true));
  // (open: the bottom bay that high left unbraced, a ring over it: you walk in under the mast between its legs)
  const nb = Math.max(2, Math.round((h - open) / bay)), Y = (i) => open + ((h - open) * i) / nb;
  const mids = [];
  for (let i = 0; i < nb; i++) {
    const y0 = Y(i), y1 = Y(i + 1);
    for (let k = 0; k < legs; k++) {
      const k1 = (k + 1) % legs;
      if (i > 0 || open) { out.iron.push(bar(P(k, y0), P(k1, y0), s, s, rad)); mids.push(P(k, y0).lerp(P(k1, y0), 0.3 + rng() * 0.4)); }
      out.iron.push(bar(P(k, y0), P(k1, y1), s * 0.85, s * 0.85, rad));
      if (detail >= 0.6) out.iron.push(bar(P(k1, y0), P(k, y1), s * 0.85, s * 0.85, rad));
    }
  }
  for (let k = 0; k < legs; k++) out.iron.push(bar(P(k, h), P((k + 1) % legs, h), s * 1.3, s * 1.3, rad));
  // the vines: up the legs, round and round them, thinning as they climb; leaves bunched on them
  if (vines > 0) for (let k = 0; k < legs; k++) {
    if (rng() > 0.35 + vines * 0.65) continue;
    const top = h * Math.min(1, (0.25 + rng() * 0.75) * (0.4 + vines * 0.8)), n = Math.max(3, Math.round(top / 1.6)), pts = [];
    const a0 = P(k, 0), a1 = P(k, h), d = a1.clone().sub(a0).normalize(), u = V(-d.z, 0, d.x).normalize(), w = d.clone().cross(u), ph = rng() * TAU, turns = 0.35 + rng() * 0.4;
    for (let i = 0; i <= n; i++) {
      const y = -0.3 + (top * i) / n, p = P(k, y), a = ph + y * turns, o = r + 0.12 + rng() * 0.12;
      pts.push(p.add(u.clone().multiplyScalar(Math.cos(a) * o)).add(w.clone().multiplyScalar(Math.sin(a) * o)));
    }
    out.vine.push(taper(pts, 0.1 + vines * 0.1, 0.35, Math.max(4, Math.round(n * 2 * detail)), detail < 0.6 ? 3 : 5));
    if (leaves) for (let i = 1; i < pts.length; i++) if (rng() < 0.75 * leaves) {
      const p = pts[i], c = 0.3 + rng() * 0.45 * (1 - i / pts.length) + vines * 0.25;
      out.leaf.push(clump(rng, c, p.x + (rng() - 0.5) * 0.3, p.y, p.z + (rng() - 0.5) * 0.3));
    }
  }
  // strands hanging from the struts
  if (hang > 0) for (const p of mids) if (rng() < hang * 0.45) out.vine.push(strand(rng, p, 0.6 + rng() * 2.6 * hang, 0.03 + rng() * 0.02));
  return { ...out, top: { y: h, w: w1 }, feet: Array.from({ length: legs }, (_, k) => { const p = P(k, 0); return [p.x, p.z]; }) };
}

/**
 * A parabolic dish, its axis +y, its vertex at the origin, opening up: R its radius, depth its rim's height over
 * R. feed: 'tripod' | 'quad' (legs from the rim to the horn at the focus) | 'arm' (one boom, three stays) | null;
 * ribs on its back to a hub; seams (rings and spokes) on its face when `seams`; back: its outside a shell of its own
 * (under), to be coloured apart. { dish (the bowl), under, frame, focus }.
 */
export function dish({ R = 6, depth = 0.3, seg = 40, rings = 10, feed = 'tripod', ribs = 8, seams = 0, detail = 1, seed = 1, back = false } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 3137) + 7), D = depth * R, yAt = (r) => D * (r / R) ** 2;
  seg = Math.max(12, Math.round(seg * detail)); rings = Math.max(4, Math.round(rings * detail));
  const bowl = lathe(Array.from({ length: rings + 1 }, (_, i) => { const r = (i / rings) * R; return [r, yAt(r)]; }), seg);
  out.dish.push(formAxis(bowl, 'cap'));
  // (back: its outside a shell of its own a little behind the bowl, to be coloured apart: under)
  if (back) out.under.push(formAxis(lathe(Array.from({ length: rings + 1 }, (_, i) => { const r = (i / rings) * R * 1.005; return [r, yAt(r) - Math.max(0.012 * R, 0.04)]; }).reverse(), seg), 'cap'));
  out.frame.push(rim(R, Math.max(0.013 * R, 0.05), 4, seg, D));
  const F = R / (4 * depth), t = R * 0.012 + 0.03;
  if (feed === 'tripod' || feed === 'quad') {
    const n = feed === 'quad' ? 4 : 3, a0 = rng() * TAU;
    for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; out.frame.push(bar(V(Math.cos(a) * R * 0.93, yAt(R * 0.93) + 0.05, Math.sin(a) * R * 0.93), V(0, F * 0.97, 0), t, t * 0.8, 4)); }
    out.frame.push(bar(V(0, F * 0.9, 0), V(0, F * 1.12, 0), R * 0.06, R * 0.045, 8, true));
  } else if (feed === 'arm') {
    out.frame.push(bar(V(0, D * 0.2, 0), V(0, F * 1.05, 0), t * 1.6, t, 5));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.4; out.frame.push(bar(V(Math.cos(a) * R * 0.55, yAt(R * 0.55), Math.sin(a) * R * 0.55), V(0, F * 0.75, 0), t * 0.7, t * 0.6, 3)); }
    out.frame.push(bar(V(0, F, 0), V(0, F * 1.18, 0), R * 0.05, R * 0.035, 8, true));
  }
  // the back: a hub and ribs following the bowl's back out to the rim
  out.frame.push(bar(V(0, -R * 0.12, 0), V(0, 0.02, 0), R * 0.1, R * 0.08, 8, true));
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * TAU + 0.2, c = Math.cos(a), s = Math.sin(a), off = -Math.max(0.04 * R, 0.08);
    const pts = [0.08, 0.35, 0.65, 0.98].map((k) => V(c * R * k, yAt(R * k) + off * (1 - k * 0.6), s * R * k));
    for (let j = 1; j < pts.length; j++) out.frame.push(bar(pts[j - 1], pts[j], t * 0.9, t * 0.9, 3));
  }
  if (seams) {
    for (const k of [0.45, 0.75]) out.frame.push(rim(R * k, t * 0.6, 3, seg, yAt(R * k) + 0.02));
    for (let i = 0; i < seams; i++) { const a = (i / seams) * TAU, c = Math.cos(a), s = Math.sin(a); out.frame.push(bar(V(c * R * 0.1, yAt(R * 0.1) + 0.02, s * R * 0.1), V(c * R * 0.5, yAt(R * 0.5) + 0.02, s * R * 0.5), t * 0.5, t * 0.5, 3), bar(V(c * R * 0.5, yAt(R * 0.5) + 0.02, s * R * 0.5), V(c * R * 0.99, yAt(R * 0.99) + 0.02, s * R * 0.99), t * 0.5, t * 0.5, 3)); }
  }
  return { ...out, focus: F };
}

/**
 * The flat nest dish on top of a mast, its rim at y = 0: a shallow bowl `h` deep inside, a conical underside down
 * to a collar of radius `stem` at -under × R, vines hanging off the rim (hang 0..1). { dish (the top), under, frame, vine }.
 */
export function saucer({ R = 5, h = 0.5, under = 0.32, stem = 0.45, seg = 36, hang = 0.4, seed = 1, detail = 1 } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 5113) + 3);
  seg = Math.max(12, Math.round(seg * detail));
  out.dish.push(formAxis(lathe(Array.from({ length: 7 }, (_, i) => { const t = i / 6; return [t * R * 0.985, -h * (1 - t * t)]; }), seg), 'cap'));
  const U = under * R;
  out.under.push(formAxis(lathe([[R, -0.02], [R * 0.97, -R * 0.05], ...Array.from({ length: 5 }, (_, i) => { const t = (i + 1) / 5; return [R * 0.97 + (stem - R * 0.97) * t, -R * 0.05 - (U - R * 0.05) * Math.pow(t, 0.8)]; })].reverse(), seg), 'cap'));
  out.frame.push(rim(R, Math.max(0.02 * R, 0.05), 4, seg));
  out.frame.push(bar(V(0, -U - R * 0.06, 0), V(0, -U + 0.05, 0), stem * 1.25, stem * 1.1, 8, true));
  if (hang > 0) for (let i = 0, n = Math.round(seg * hang * 0.8); i < n; i++) {
    const a = rng() * TAU, p = V(Math.cos(a) * R * 0.99, -0.05, Math.sin(a) * R * 0.99);
    out.vine.push(strand(rng, p, 0.4 + rng() * (1.2 + R * 0.25) * hang, 0.04 + rng() * 0.03));
  }
  return out;
}

/** Every part of a dish (y its axis, its vertex at the origin) turned to face `dir` and moved to `at` (in place). */
export function aimAt(parts, dir, at, spin = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()), s = new THREE.Quaternion().setFromAxisAngle(UP, spin);
  q.multiply(s);
  return moveParts(parts, (g) => { g.applyQuaternion(q); g.translate(at.x, at.y, at.z); });
}
/** Every part tipped by `a` (rad) about the level axis across `az` (its +y leans toward az: 0 toward +z), in place, about the origin. */
export function tipToward(parts, az, a) { return moveParts(parts, (g) => { g.rotateY(-az); g.rotateX(a); g.rotateY(az); }); }
/** A direction from a yaw (rad: 0 toward +z, the camera's way in a view) and an elevation (rad, up from level). */
export const dirOf = (az, el) => V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));

/** A lathed column from r0 at the foot to r1 at h (a pedestal; bulge: how far its middle swells), its form wrapping. */
export function column({ h = 12, r0 = 1.6, r1 = 1, bulge = 0, seg = 18, collar = true } = {}) {
  const out = roles(), pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * t), h * t]); }
  out.iron.push(formAxis(lathe([[r0 * 1.15, -0.4], [r0 * 1.15, 0.3], ...pts], seg), 'wrap'));
  if (collar) out.frame.push(lathe([[r1 * 1.25, h - 0.2], [r1 * 1.35, h + 0.3], [r1 * 1.2, h + 0.7], [0.01, h + 0.72]], seg));
  return out;
}

/**
 * A rounded repair workshop, its floor at y = 0, its door toward +z: a dome R round and tall × R high on a low
 * ring, round windows (lit: the share lit) in dark frames, an arched door lit inside, a vent and a little mast
 * on top. { shell, trim, glow, frame, windows: [[x, y, z]] (the lit ones, for lights) }.
 */
export function dome({ R = 4, tall = 0.85, windows = 4, lit = 0.7, door = true, seed = 1, seg = 22, detail = 1, mast = true, rot = 0 } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 2711) + 5), H = tall * R, wins = [];
  seg = Math.max(10, Math.round(seg * detail));
  const prof = [[R * 1.04, 0], [R * 1.04, 0.35]];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); prof.push([Math.cos(a) * R, 0.35 + Math.sin(a) * H]); }
  out.shell.push(formAxis(lathe(prof, seg), 'cap'));
  out.trim.push(new THREE.TorusGeometry(R * 1.045, 0.09, 3, seg).rotateX(Math.PI / 2).translate(0, 0.38, 0));
  // a point on the dome at angle a (0: +z), height share v (0 the ring, 1 the top), and its normal
  const on = (a, v) => { const t = v * (Math.PI / 2), n = V(Math.sin(a) * Math.cos(t) / R, Math.sin(t) / H, Math.cos(a) * Math.cos(t) / R).normalize(); return { p: V(Math.sin(a) * Math.cos(t) * R, 0.35 + Math.sin(t) * H, Math.cos(a) * Math.cos(t) * R), n }; };
  const place = (g, p, n, out2 = 0.04) => { g.applyQuaternion(_q.setFromUnitVectors(V(0, 0, 1), n)); return g.translate(p.x + n.x * out2, p.y + n.y * out2, p.z + n.z * out2); };
  for (let i = 0; i < windows; i++) {
    const a = rot + (door ? 0.9 : 0.3) + (i / windows) * (TAU - (door ? 1.8 : 0.6)) + (rng() - 0.5) * 0.25, v = 0.22 + rng() * 0.3, { p, n } = on(a, v), rw = R * (0.12 + rng() * 0.06);
    const isLit = rng() < lit;
    (isLit ? out.glow : out.trim).push(place(new THREE.CircleGeometry(rw, 12), p, n, 0.05));
    out.trim.push(place(new THREE.TorusGeometry(rw, rw * 0.16, 3, 12), p, n, 0.05));
    if (isLit) wins.push([p.x + n.x * 1.2, p.y, p.z + n.z * 1.2]);
  }
  if (door) {
    const w = Math.min(1.1, R * 0.24), hd = Math.min(2.3, H * 0.6), s = new THREE.Shape();
    s.moveTo(-w, 0); s.lineTo(-w, hd - w); s.absarc(0, hd - w, w, Math.PI, 0, true); s.lineTo(w, 0); s.lineTo(-w, 0);
    const z = R * 1.04 + 0.04, c = Math.cos(rot), sn = Math.sin(rot);
    const put = (g) => g.rotateY(rot).translate(sn * z, 0.02, c * z);
    out.glow.push(put(new THREE.ShapeGeometry(s, 8)));
    out.trim.push(put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-w, 0, 0), V(-w, hd - w, 0), V(-w * 0.7, hd - w * 0.3, 0), V(0, hd, 0), V(w * 0.7, hd - w * 0.3, 0), V(w, hd - w, 0), V(w, 0, 0)]), 12, 0.09, 3, false)));
    // the door's hood, a short arched porch out of the dome
    out.shell.push(put(new THREE.CylinderGeometry(w * 1.3, w * 1.3, 1.2, 10, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, hd - w, -0.4)));
    wins.push([sn * (z + 1.5), 1.4, c * (z + 1.5)]);
  }
  if (mast) {
    const top = V(0, 0.35 + H, 0);
    out.frame.push(bar(top.clone().add(V(R * 0.15, -0.3, 0)), top.clone().add(V(R * 0.15, R * 0.45 + 1, 0)), 0.05, 0.03, 4));
    out.frame.push(new THREE.CylinderGeometry(0.35, 0.05, 0.18, 8).rotateZ(0.5).translate(R * 0.15 + 0.12, R * 0.45 + 0.75 + 0.35 + H * 0, 0).translate(0, top.y - 0.35, 0));
    out.frame.push(bar(top.clone().add(V(-R * 0.2, -0.4, R * 0.1)), top.clone().add(V(-R * 0.2, 0.5, R * 0.1)), R * 0.06, R * 0.06, 8, true));
  }
  return { ...out, windows: wins };
}

/** The great egg of a workshop (the sheets' tall bulb under the receiver): R round at its widest, H high, windows round it. */
export function egg({ R = 6, H = 14, windows = 6, lit = 0.8, seed = 1, seg = 26, detail = 1, bands = 2 } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 1931) + 17), wins = [];
  seg = Math.max(12, Math.round(seg * detail));
  const rAt = (t) => R * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.08))) * (t > 0.92 ? Math.sqrt(Math.max(0, 1 - (t - 0.92) / 0.08)) * 0.92 + 0.08 : 1);
  const prof = Array.from({ length: 15 }, (_, i) => { const t = i / 14; return [rAt(t), t * H]; });
  out.shell.push(formAxis(lathe(prof, seg), 'wrap'));
  for (let b = 1; b <= bands; b++) { const t = b / (bands + 1); out.trim.push(new THREE.TorusGeometry(rAt(t) * 1.01, 0.08, 3, seg).rotateX(Math.PI / 2).translate(0, t * H, 0)); }
  for (let i = 0; i < windows; i++) {
    const a = (i / windows) * TAU + rng() * 0.4, t = 0.35 + rng() * 0.4, r = rAt(t) + 0.04, p = V(Math.sin(a) * r, t * H, Math.cos(a) * r), n = V(Math.sin(a), 0, Math.cos(a));
    const w = R * 0.16, s = new THREE.Shape();
    s.moveTo(-w, 0); s.lineTo(-w, w * 0.9); s.absarc(0, w * 0.9, w, Math.PI, 0, true); s.lineTo(w, 0); s.lineTo(-w, 0);
    const g = new THREE.ShapeGeometry(s, 8).translate(0, -w, 0);
    g.applyQuaternion(_q.setFromUnitVectors(V(0, 0, 1), n)); g.translate(p.x, p.y, p.z);
    (rng() < lit ? out.glow : out.trim).push(g);
    out.trim.push(new THREE.BoxGeometry(w * 2.3, 0.12, 0.2).applyQuaternion(_q.setFromUnitVectors(V(0, 0, 1), n)).translate(p.x, p.y - w - 0.06, p.z));
    wins.push([p.x + n.x * 1.5, p.y, p.z + n.z * 1.5]);
  }
  return { ...out, windows: wins, rAt };
}

/** A sagging cable from a to b, grown over with vine: lumpy, leaf clumps along it (leaves 0..1), strands hanging (hang 0..1). */
export function vineCable(a, b, { sag = 3, r = 0.18, leaves = 0.6, hang = 0.6, seed = 1, detail = 1 } = {}) {
  const out = roles(), rng = mulberry32(Math.floor(seed * 9311) + 1), L = a.distanceTo(b), n = Math.max(6, Math.round((L / 2.5) * detail));
  const pts = sagPts(a, b, sag, n), curve = new THREE.CatmullRomCurve3(pts);
  const rad = detail < 0.6 ? 4 : 6, g = new THREE.TubeGeometry(curve, n * 2, r, rad, false), P = g.attributes.position;
  for (let i = 0; i < P.count; i++) { const k = 1 + (rng() - 0.5) * 0.5; const c = curve.getPointAt(Math.floor(i / (rad + 1)) / (n * 2)); P.setXYZ(i, c.x + (P.getX(i) - c.x) * k, c.y + (P.getY(i) - c.y) * k, c.z + (P.getZ(i) - c.z) * k); }
  g.deleteAttribute('uv'); g.computeVertexNormals();
  out.vine.push(thinTube(g, curve, n * 2, rad));
  for (let i = 0, m = Math.round(L * 0.5 * leaves); i < m; i++) { const p = curve.getPointAt(rng()); out.leaf.push(clump(rng, r * (1.5 + rng() * 2.2), p.x, p.y - r * 0.5, p.z)); }
  for (let i = 0, m = Math.round(L * 0.45 * hang); i < m; i++) { const p = curve.getPointAt(0.05 + rng() * 0.9); out.vine.push(strand(rng, p, 0.5 + rng() * 2.4, 0.03 + rng() * 0.03)); }
  return out;
}
/** A plain sagging wire from a to b. */
export const cable = (a, b, sag = 1, r = 0.04, n = 10) => { const c = new THREE.CatmullRomCurve3(sagPts(a, b, sag, n)), g = new THREE.TubeGeometry(c, n, r, 3, false); g.deleteAttribute('uv'); return thinTube(g, c, n, 3); };

/**
 * A steep metal stair from A to B ([x, y, z]: the foot's and the top's tread), w wide: treads, two stringers with a
 * zig-zag truss under them, rails. { plank (the treads), frame }.
 */
export function trussStair(A, B, { w = 1.2, rise = 0.22, rail = true } = {}) {
  const a = V(...A), b = V(...B), n = Math.max(2, Math.ceil(Math.abs(b.y - a.y) / rise)), dir = b.clone().sub(a).setY(0), run = dir.length() / n;
  dir.normalize();
  const m = new THREE.Matrix4().lookAt(V(0, 0, 0), dir, UP), out = roles(), s = V(-dir.z, 0, dir.x).multiplyScalar(w * 0.5);
  for (let i = 1; i <= n; i++) { const p = a.clone().lerp(b, i / n); out.plank.push(new THREE.BoxGeometry(w, 0.08, run * 1.15).applyMatrix4(m).translate(p.x, p.y - 0.04, p.z)); }
  const drop = V(0, -0.9, 0);
  for (const e of [-1, 1]) {
    const o = s.clone().multiplyScalar(e), lo = V(0, -0.12, 0);
    out.frame.push(bar(a.clone().add(o).add(lo), b.clone().add(o).add(lo), 0.07, 0.07, 4));
    out.frame.push(bar(a.clone().add(o).add(drop), b.clone().add(o).add(drop), 0.06, 0.06, 4));
    const k = Math.max(2, Math.round(a.distanceTo(b) / 1.4));
    for (let i = 0; i < k; i++) out.frame.push(bar(a.clone().lerp(b, i / k).add(o).add(i % 2 ? lo : drop), a.clone().lerp(b, (i + 1) / k).add(o).add(i % 2 ? drop : lo), 0.04, 0.04, 3));
    if (rail) {
      out.frame.push(bar(a.clone().add(o).add(V(0, 1, 0)), b.clone().add(o).add(V(0, 1, 0)), 0.035, 0.035, 4));
      for (let i = 0; i <= n; i += 3) { const p = a.clone().lerp(b, i / n).add(o); out.frame.push(bar(p, p.clone().add(V(0, 1, 0)), 0.03, 0.03, 3)); }
    }
  }
  return out;
}

/**
 * A square platform of planks, its top at y, w × d round (x, z), a railing round it with gaps ([[side, at, width]]:
 * side 0 +z, 1 +x, 2 -z, 3 -x; at along the side from its middle) where a stair or bridge meets it; beams under it.
 * { plank, frame }.
 */
export function deck(x, y, z, w, d, { gaps = [], rail = true, plank = 0.45, beams = true } = {}) {
  const out = roles(), n = Math.max(2, Math.round(d / plank));
  for (let i = 0; i < n; i++) out.plank.push(new THREE.BoxGeometry(w, 0.1, (d / n) * 1.03).translate(x, y - 0.05 + (i % 2) * 0.004, z - d / 2 + (i + 0.5) * (d / n)));
  if (beams) for (const e of [-1, 1]) out.frame.push(new THREE.BoxGeometry(0.18, 0.25, d).translate(x + e * (w / 2 - 0.15), y - 0.22, z), new THREE.BoxGeometry(w, 0.25, 0.18).translate(x, y - 0.22, z + e * (d / 2 - 0.15)));
  if (!rail) return out;
  const sides = [[V(x - w / 2, y, z + d / 2), V(x + w / 2, y, z + d / 2)], [V(x + w / 2, y, z + d / 2), V(x + w / 2, y, z - d / 2)], [V(x + w / 2, y, z - d / 2), V(x - w / 2, y, z - d / 2)], [V(x - w / 2, y, z - d / 2), V(x - w / 2, y, z + d / 2)]];
  for (const [k, [p, q]] of sides.entries()) {
    const L = p.distanceTo(q), cuts = gaps.filter((g) => g[0] === k).map(([, at, gw]) => [L / 2 + at - gw / 2, L / 2 + at + gw / 2]).sort((u, v) => u[0] - v[0]);
    const spans = [];
    let s0 = 0;
    for (const [c0, c1] of cuts) { if (c0 > s0 + 0.2) spans.push([s0, c0]); s0 = Math.max(s0, c1); }
    if (L > s0 + 0.2) spans.push([s0, L]);
    for (const [u0, u1] of spans) {
      const A = p.clone().lerp(q, u0 / L), B = p.clone().lerp(q, u1 / L);
      out.frame.push(bar(A.clone().add(V(0, 1, 0)), B.clone().add(V(0, 1, 0)), 0.035, 0.035, 4), bar(A.clone().add(V(0, 0.5, 0)), B.clone().add(V(0, 0.5, 0)), 0.025, 0.025, 3));
      const posts = Math.max(1, Math.round((u1 - u0) / 1.6));
      for (let i = 0; i <= posts; i++) { const P = A.clone().lerp(B, i / posts); out.frame.push(bar(P, P.clone().add(V(0, 1, 0)), 0.035, 0.035, 4)); }
    }
  }
  return out;
}

/** A small perched bird (body along +z, its feet at the origin), s long. ~40 faces. */
export function bird(s = 0.35) {
  const body = new THREE.IcosahedronGeometry(0.5, 0).scale(0.55, 0.6, 1).translate(0, 0.42, 0);
  const head = new THREE.IcosahedronGeometry(0.24, 0).translate(0, 0.78, 0.38);
  const beak = new THREE.ConeGeometry(0.07, 0.22, 3).rotateX(Math.PI / 2).translate(0, 0.76, 0.66);
  const tail = new THREE.ConeGeometry(0.16, 0.5, 3).rotateX(-Math.PI / 2 - 0.5).translate(0, 0.3, -0.62);
  const g = mergeGeometries([body, head, beak, tail].map((x) => { x.deleteAttribute('uv'); return x.index ? x.toNonIndexed() : x; }));
  g.computeVertexNormals();
  return g.scale(s, s, s);
}

/** Points round a circle of radius R at height y (local), n of them, jittered (birds along a rim). */
export function rimSpots(R, y, n, seed = 1) {
  const rng = mulberry32(Math.floor(seed * 1777) + 3);
  return Array.from({ length: n }, () => { const a = rng() * TAU; return { x: Math.cos(a) * R * 0.98, y, z: Math.sin(a) * R * 0.98, yaw: a + Math.PI / 2 + (rng() - 0.5) * 1.6, s: 0.8 + rng() * 0.5 }; });
}

/** Far masts (instanced): a unit pole (radius 1, height 1, its foot at 0) and a unit cap for its top. */
export const unitPole = () => { const g = new THREE.CylinderGeometry(0.7, 1, 1, 5, 1, true).translate(0, 0.5, 0); g.deleteAttribute('uv'); return thinPole(g); };
/** A unit nest dish (R 1, its rim at y 0): the shape the far masts carry, one closed lathe. */
export const unitSaucer = (seg = 14) => lathe([[0.12, -0.42], [0.6, -0.2], [1, 0], [0.6, -0.06], [0.001, -0.08]], seg);
/** A unit dish turned up to its tilt (R 1, its vertex at the origin, its axis +y): a far dish, one lathe (two-sided). */
export const unitDish = (seg = 16, depth = 0.3, rings = 4) => lathe(Array.from({ length: rings + 1 }, (_, i) => { const r = i / rings; return [r, depth * r * r]; }), seg);

/** How thick a far mast must be drawn per metre of distance not to break into a crawl of pixels: ~1.5 px wide on the handheld's frame. */
export const FAR_MIN_R = 0.0016;
export const merged = (list) => (list.length ? mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))) : null);

// ------------------------------------------------------------------ the look
/** Haze by depth: the sheets' pale yellow-lavender bands, the far masts fading into them. */
// (colour pass, v0.95: the haze starts nearer and veils more, so the masts a few dozen metres off already pale into the
//  yellow air as the pictures' do, instead of standing dark to the middle distance)
export const ANTENNAS_HAZE = { uHazeLayers: [55, 1.55, 0.15, 8], uHazeTone: [0.97, 0.94, 0.78, 0.82] };
/** The print preset's touches: no clouds, the sky flat, thin lines, light hatching, cast shadows lifted on the grass. */
export const ANTENNAS_LOOK = { uClouds: 0, uCumulus: 0, uSkyDots: 0.2, uHatch: 0.4, uLineWidth: 0.75, uWobble: 0.22, uFogDensity: 0.0011, uCast: [0.75, 0.35], uSpotTone: [0.22, 0.17, 0.3, 0.45], ...ANTENNAS_HAZE };
/** The day's colours (sky top, horizon, shadow, light, sun): a pale yellow sky, lavender shade, warm light. */
export const ANTENNAS_DAY = ['#f1e6a2', '#f7f0c8', '#8c7cbc', '#fff6dc', '#fff2c4'];
/** The surfaces' tones. */
export const ANTENNAS_TONES = {
  grass: '#a88ac4', grass2: '#9c7eb8', grass3: '#8a6ea6', path: '#e8bc96', path2: '#dcae88',
  iron: '#665444', iron2: '#56463e', vine: '#3c4a2e', leaf: '#4a5a36', frame: '#3a3438',
  dish: '#b9aac8', dishPink: '#e9bab4', dishBlue: '#8ea2b0', dishNavy: '#33456a', dishRose: '#d8a6b4',
  under: '#9c8cb0', shell: '#d9a184', shell2: '#c9b0c4', shell3: '#c8907a', trim: '#3a2e34', window: '#ffcf72', plank: '#8a6c56',
  bush: '#24402f', bush2: '#203a30', far: '#c9b9d6', farDeep: '#e2d6cc', bird: '#2d2834',
};
