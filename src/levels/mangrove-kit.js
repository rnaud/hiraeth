import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import { FORM } from '../materials.js';
import { keepForm } from '../form.js';
import { taper } from './wood-kit.js';
import { leafCrown } from './garden-kit.js';

// ---------------------------------------------------------------------------
// The White Mangrove's shapes, shared by the world (mangrove.js) and its reference views
// (reference-mangrove.js), after the sheets (references/The White Mangrove/reference-1 … 4):
//   whiteTree   a great bone-white tree: a trunk on a crown of smooth arching prop roots that stand in
//               the water, its limbs sweeping out and up; the forks where a house can sit
//   rootArch    a smooth root arching from one foot to another over the water (the trees' interlocking)
//   podHouse    a small rounded house on a wooden deck: round windows, a lit door, a railing, struts
//   walkway     a plank walk along points (on stilts, railed, lanterns on posts); bridges sag between two
//   stairs      steps from one point to another, with rails
//   punt        a long flat boat
//   glowSpots   the lake's luminous creatures: flat blue and pink spots on the black water
//   farTree     the wood behind: a tall thin grey trunk with a few bare limbs
// Each returns plain geometries in the caller's frame (no materials, no placing in a scene). `detail`
// (1 the views, under 1 the world) thins the segments.
// ---------------------------------------------------------------------------

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/**
 * A tapered tube whose shade strokes wrap round it along its own course (form 'wrap', src/form.js): each ring
 * of vertices carries the curve's point there and its tangent as the axis.
 */
export function limb(pts, r, end = 0.4, tubular = 20, radial = 8) {
  const g = taper(pts, r, end, tubular, radial), curve = new THREE.CatmullRomCurve3(pts);
  const n = g.attributes.position.count, C = new Float32Array(n * 4), A = new Float32Array(n * 3), k = FORM.kinds.wrap;
  const P = g.attributes.position, N = g.attributes.normal, d = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const p = curve.getPointAt(i / tubular), t = curve.getTangentAt(i / tubular);
    for (let j = 0; j <= radial; j++) {
      const v = i * (radial + 1) + j;
      C.set([p.x, p.y, p.z, k], v * 4); A.set([t.x, t.y, t.z], v * 3);
      // (the normal straight out from the course: the seam's two copies of a vertex agree, so no crease is inked along it)
      d.set(P.getX(v) - p.x, P.getY(v) - p.y, P.getZ(v) - p.z).normalize();
      N.setXYZ(v, d.x, d.y, d.z);
    }
  }
  g.setAttribute('aFormC', new THREE.BufferAttribute(C, 4));
  g.setAttribute('aFormA', new THREE.BufferAttribute(A, 3));
  return keepForm(g);
}

/**
 * A great white tree, its foot at the origin (the water at y = 0). h: the fork's height; r: the trunk's radius
 * there; roots: how many great prop roots spring from its crown (crown: their height) and arch out `reach`
 * into the water, smaller ones between; limbs: [{ az, len, rise, r }] (rad, m, m, × r) sweeping out of the fork
 * (default: three, and the trunk going on up). canopy: puffs of pale leaves at the limbs' ends.
 * { trunk: [geo], roots: [geo], limbs: [geo], canopy: [geo], forks: [{ x, y, z, r }] } (forks: where a house sits).
 */
export function whiteTree({ seed = 1, h = 28, r = 2, crown = r * 2.4, roots = 12, reach = r * 4.5, small = roots, limbs, lean = [0, 0], canopy = false, detail = 1, fingers = 2, top = 1.4, upperRoots = true, canopyDetail = detail } = {}) {
  const rng = mulberry32(Math.floor(seed * 6151) + 3), out = { trunk: [], roots: [], limbs: [], canopy: [], forks: [] };
  const rad = Math.max(5, Math.round(10 * detail)), tub = (n) => Math.max(5, Math.round(n * detail));
  const fork = V(lean[0], h, lean[1]);
  // the trunk: rising from inside the root crown, swelling a little at its foot, a gentle S
  const mid = V(lean[0] * 0.35 + (rng() - 0.5) * r * 0.6, h * 0.55, lean[1] * 0.35 + (rng() - 0.5) * r * 0.6);
  out.trunk.push(limb([V(0, crown * 0.2, 0), V(0, crown * 1.3, 0), mid, fork], r * 1.35, 0.74, tub(16), rad + 2));
  // the knot at the fork: the trunk's open end closed where the limbs leave it
  out.trunk.push(new THREE.SphereGeometry(r * 1.02, rad + 2, Math.max(4, Math.round(rad / 2) + 2)).translate(fork.x, fork.y, fork.z));
  // the bell where the roots spring: a flared skirt round the trunk's foot, closed underneath (a dark hollow over the
  // water under it, between the roots that carry it)
  const bell = [[0.01, crown * 0.2], [r * 1.5, crown * 0.32], [r * 2.5, crown * 0.46], [r * 2.25, crown * 0.6], [r * 1.75, crown * 0.8], [r * 1.42, crown * 1.0], [r * 1.3, crown * 1.25]];
  const bellR = (y) => { for (let i = 1; i < bell.length; i++) if (y <= bell[i][1]) { const [r0, y0] = bell[i - 1], [r1, y1] = bell[i]; return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); } return r * 1.3; };
  const lg = new THREE.LatheGeometry(bell.map(([a, b]) => new THREE.Vector2(a, b)), rad + 6);
  lg.deleteAttribute('uv');
  const C = new Float32Array(lg.attributes.position.count * 4), A = new Float32Array(lg.attributes.position.count * 3);
  for (let i = 0; i < lg.attributes.position.count; i++) { C.set([0, 0, 0, FORM.kinds.wrap], i * 4); A.set([0, 1, 0], i * 3); }
  lg.setAttribute('aFormC', new THREE.BufferAttribute(C, 4)); lg.setAttribute('aFormA', new THREE.BufferAttribute(A, 3));
  out.trunk.push(keepForm(lg));
  // the great prop roots: out of the skirt, a shallow rise, then a long arch down into the water; the upper ones
  // spring from the trunk over the skirt and fall steeply over it (the sheets' layered tent of roots)
  const phase = rng() * TAU;
  for (let k = 0; k < roots; k++) {
    const az = phase + (k / roots) * TAU + (rng() - 0.5) * 0.45, c = Math.cos(az), s = Math.sin(az), upper = upperRoots && k % 3 === 2;
    const ys = upper ? crown * (0.85 + rng() * 0.3) : crown * (0.42 + rng() * 0.2), r0 = bellR(ys) * 0.8;
    const d = reach * (upper ? 0.55 + rng() * 0.3 : 0.75 + rng() * 0.45), rr = r * (upper ? 0.22 + rng() * 0.08 : 0.26 + rng() * 0.12);
    const P = (t, y) => V(c * (r0 + (d - r0) * t), y, s * (r0 + (d - r0) * t));
    // (its first point inside the trunk, so it grows out of it: no cut end shows)
    const pts = [V(c * r * 0.5, ys + crown * 0.3, s * r * 0.5), P(0.25, ys + crown * (upper ? 0.04 : 0.12)), P(0.58, ys * 0.8), P(0.86, ys * 0.32), P(1, -1.2)];
    out.roots.push(limb(pts, rr, 0.55, tub(18), rad));
    // its foot splits into fingers that grip the bed
    for (let f = 0; f < fingers; f++) {
      const fa = az + (rng() - 0.5) * 1.6, fd = rr * (2 + rng() * 2), F = P(0.84 + rng() * 0.08, ys * 0.36);
      out.roots.push(limb([F, F.clone().add(V(Math.cos(fa) * fd * 0.5, -ys * 0.12, Math.sin(fa) * fd * 0.5)), F.clone().add(V(Math.cos(fa) * fd, -ys * 0.4 - 1, Math.sin(fa) * fd))], rr * 0.5, 0.45, tub(8), Math.max(5, rad - 3)));
    }
  }
  // smaller roots between them, steeper, closer in: the sheets' colonnade of thin feet under the skirt
  for (let k = 0; k < small; k++) {
    const az = phase + ((k + 0.5) / small) * TAU + (rng() - 0.5) * 0.4, c = Math.cos(az), s = Math.sin(az);
    const ys = crown * (0.35 + rng() * 0.15), r0 = bellR(ys) * 0.85, d = r0 + reach * (0.12 + rng() * 0.25), rr = r * (0.1 + rng() * 0.07);
    const P = (t, y) => V(c * (r0 + (d - r0) * t), y, s * (r0 + (d - r0) * t));
    out.roots.push(limb([V(c * r0 * 0.7, ys + crown * 0.1, s * r0 * 0.7), P(0.35, ys * 0.85), P(0.8, ys * 0.35), P(1, -1)], rr, 0.6, tub(10), Math.max(5, rad - 2)));
  }
  // the limbs: out of the fork, sweeping out and up, a branch or two off each
  const L = limbs ?? [
    { az: phase + 0.4, len: h * 0.7, rise: h * 0.35, r: 0.62 },
    { az: phase + 2.6, len: h * 0.55, rise: h * 0.45, r: 0.55 },
    { az: phase + 4.4, len: h * 0.35, rise: h * 0.6, r: 0.6 },
  ];
  for (const [i, l] of L.entries()) {
    const c = Math.cos(l.az), s = Math.sin(l.az), dir = V(c, 0, s);
    const p0 = fork.clone().add(V(0, -r * 0.6, 0)), p1 = fork.clone().addScaledVector(dir, l.len * 0.3).add(V(0, l.rise * 0.32, 0));
    const p2 = fork.clone().addScaledVector(dir, l.len * 0.7).add(V(0, l.rise * 0.72, 0)), p3 = fork.clone().addScaledVector(dir, l.len).add(V(0, l.rise, 0));
    const lr = r * (l.r ?? 0.6);
    out.limbs.push(limb([p0, p1, p2, p3], lr, 0.18, tub(18), rad));
    out.forks.push({ x: p1.x, y: p1.y + lr * 0.6, z: p1.z, r: lr, az: l.az, end: p3 });
    // a branch off its middle, turning upward
    const bt = new THREE.CatmullRomCurve3([p0, p1, p2, p3]), b0 = bt.getPointAt(0.55), ba = l.az + (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 0.5);
    const bd = V(Math.cos(ba), 0, Math.sin(ba)), bl = l.len * (0.35 + rng() * 0.2);
    const b1 = b0.clone().addScaledVector(bd, bl * 0.5).add(V(0, bl * 0.45, 0)), b2 = b0.clone().addScaledVector(bd, bl).add(V(0, bl * (0.7 + rng() * 0.5), 0));
    out.limbs.push(limb([b0, b1, b2], lr * 0.5, 0.2, tub(10), Math.max(5, rad - 2)));
    if (canopy) for (const e of [p3, b2]) out.canopy.push(puff(seed * 13 + i * 7 + (e === b2 ? 3 : 0), lr * (e === b2 ? 3.5 : 4.5), canopyDetail).translate(e.x, e.y + lr, e.z));
  }
  // the trunk goes on up past the fork, out of the frame
  if (top) out.limbs.push(limb([fork.clone().add(V(0, -r, 0)), fork.clone().add(V(r * 0.3, h * 0.25 * top, 0)), fork.clone().add(V(-r * 0.2, h * 0.5 * top, r * 0.3))], r * 0.8, 0.22, tub(10), rad));
  return out;
}

/** A pale puff of leaves (the canopy of IMG reference-2): a flattened cluster of soft masses, S across. */
export function puff(seed, S, detail = 1) {
  const g = leafCrown(seed, { lobes: detail >= 1 ? 9 : 5, detail: detail >= 1 ? 1 : 0, core: 0.7, flat: 0.55, size: [0.32, 0.5] });
  return g.scale(S, S, S);
}

/** A smooth root arching from A to B (points [x, y, z]) over the water, `h` over the higher foot, r thick, fingers at its feet. */
export function rootArch(A, B, { h = 8, r = 1, seed = 1, detail = 1, lean = 0 } = {}) {
  const rng = mulberry32(Math.floor(seed * 2333) + 1), a = V(...A), b = V(...B), top = Math.max(a.y, b.y) + h;
  const m = a.clone().lerp(b, 0.5).setY(top), side = V(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(lean);
  const pts = [a.clone().setY(a.y - 1), a.clone().lerp(m, 0.35).setY(a.y + h * 0.78), m.clone().add(side), b.clone().lerp(m, 0.35).setY(b.y + h * 0.78), b.clone().setY(b.y - 1)];
  const out = [limb(pts, r, 0.95, Math.max(8, Math.round(26 * detail)), Math.max(5, Math.round(9 * detail)))];
  for (const [F, s] of [[a, 1], [b, -1]]) for (let k = 0; k < 2; k++) {
    const d = V((rng() - 0.5) * 2, 0, (rng() - 0.5) * 2).normalize().multiplyScalar(r * (2 + rng() * 2));
    const p = F.clone().lerp(m, 0.12).setY(F.y + h * 0.25);
    out.push(limb([p, p.clone().add(d.clone().multiplyScalar(0.5)).add(V(0, -h * 0.1, 0)), F.clone().add(d).setY(-1.2)], r * 0.45, 0.5, Math.max(6, Math.round(10 * detail)), Math.max(5, Math.round(7 * detail))));
    void s;
  }
  return out;
}

/**
 * A small rounded house on a wooden deck, the deck's top at y = 0, the door facing +z (turned by yaw after).
 * R the shell's radius; tall: how egg-like (1 a dome, 1.5 an egg); windows: round ones round it.
 * { shell: [geo], wood: [geo], dark: [geo], glow: [geo], lamps: [[x, y, z]] }.
 */
export function podHouse({ R = 3, tall = 1.1, seed = 1, windows = 5, lit = 0.5, deck = 1.5, rail = true, struts = 5, fringe = 18, finial = true, twin = false, detail = 1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 911) + 9), out = { shell: [], wood: [], dark: [], glow: [], lamps: [] };
  const seg = Math.max(10, Math.round(22 * detail));
  const prof = [[R * 0.9, -0.05], [R, R * 0.28 * tall], [R * 0.96, R * 0.55 * tall], [R * 0.8, R * 0.85 * tall], [R * 0.52, R * 1.06 * tall], [R * 0.2, R * 1.16 * tall], [0.001, R * 1.18 * tall]];
  const shell = (s, x, z) => { const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a * s, b * s)), seg); g.deleteAttribute('uv'); return g.translate(x, 0, z); };
  out.shell.push(shell(1, 0, 0));
  if (twin) out.shell.push(shell(0.62, R * 0.95, -R * 0.35));
  if (finial) {
    out.shell.push(new THREE.SphereGeometry(R * 0.12, 8, 6).translate(0, R * 1.2 * tall, 0));
    out.wood.push(new THREE.CylinderGeometry(R * 0.015, R * 0.03, R * 0.6, 4).translate(0, R * 1.5 * tall, 0));
  }
  // round windows: dark or lit, a little proud of the shell, with a rim
  const wy = R * 0.5 * tall, wr = R * 0.1, rimR = R * 0.97;
  for (let i = 0; i < windows; i++) {
    const az = 0.9 + (i / windows) * (TAU - 1.8) + (rng() - 0.5) * 0.3, y = wy + (rng() - 0.5) * R * 0.35 * tall;
    const rr = rimR * (1 - 0.18 * Math.max(0, (y - R * 0.55 * tall) / (R * 0.5 * tall))) + 0.02;
    const g = new THREE.CircleGeometry(wr * (0.8 + rng() * 0.4), 12).translate(0, 0, rr).rotateY(az).translate(0, y, 0);
    (rng() < lit ? out.glow : out.dark).push(g);
  }
  // the door: an arch, lit, toward +z
  const door = new THREE.Shape();
  const dw = R * 0.19, dh = R * 0.5;
  door.moveTo(-dw, 0); door.lineTo(-dw, dh - dw); door.absarc(0, dh - dw, dw, Math.PI, 0, true); door.lineTo(dw, 0); door.lineTo(-dw, 0);
  out.glow.push(new THREE.ShapeGeometry(door, 6).translate(0, 0.02, R * 0.93 + 0.04));
  // the deck, its railing, the struts under it and the fringe of sticks hanging from its rim
  const D = R * deck;
  out.wood.push(new THREE.CylinderGeometry(D, D * 0.94, 0.32, Math.max(10, Math.round(18 * detail))).translate(0, -0.16, 0));
  if (rail) {
    const n = Math.max(8, Math.round(D * 2.2));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue;   // (the gap at the door's side, +z)
      out.wood.push(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 4).translate(Math.cos(a) * D * 0.96, 0.47, Math.sin(a) * D * 0.96));
    }
    out.wood.push(new THREE.TorusGeometry(D * 0.96, 0.04, 4, Math.max(16, Math.round(32 * detail)), TAU - 0.6).rotateX(Math.PI / 2).rotateY(-Math.PI / 2 - 0.3).translate(0, 0.95, 0));
  }
  for (let i = 0; i < struts; i++) {
    const a = (i / struts) * TAU + rng() * 0.4;
    out.wood.push(stick(V(Math.cos(a) * D * 0.85, -0.2, Math.sin(a) * D * 0.85), V(Math.cos(a) * R * 0.15, -R * 1.1, Math.sin(a) * R * 0.15), 0.05));
  }
  for (let i = 0; i < fringe; i++) {
    const a = rng() * TAU, l = 0.4 + rng() * 1.4;
    out.wood.push(new THREE.CylinderGeometry(0.03, 0.03, l, 3).translate(Math.cos(a) * D * (0.7 + rng() * 0.28), -0.3 - l / 2, Math.sin(a) * D * (0.7 + rng() * 0.28)));
  }
  // a lantern by the door
  out.lamps.push([D * 0.55, 1.4, D * 0.7]);
  return out;
}

/**
 * A ring of planks round a trunk at height y (its top), from `inner` to `outer` (m from the trunk's axis), a railing
 * round its outer edge but where `gaps` open it ([angle, width m]…: a stair's top, a bridge's end, a house's deck).
 * { planks: [geo], wood: [geo] }. Angles from +x toward +z.
 */
export function ringDeck({ inner, outer, y, gaps = [], plank = 0.5, rail = true, beams = 6 }) {
  const out = { planks: [], wood: [] }, mid = (inner + outer) / 2, n = Math.max(12, Math.round((TAU * mid) / plank));
  const open = (a, extra = 0) => gaps.some(([g, w]) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < (w / 2 + extra) / outer);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, w = (TAU * outer) / n;
    // a plank from the inner to the outer edge, as wide as the ring's outer step (it tapers in: the planks overlap there)
    out.planks.push(new THREE.BoxGeometry(outer - inner + 0.2, 0.14, w * 1.02).translate(mid, y - 0.07, 0).rotateY(-a));
  }
  for (let i = 0; i < beams; i++) {
    const a = (i / beams) * TAU + 0.3;
    out.wood.push(stick(V(Math.cos(a) * outer, y - 0.15, Math.sin(a) * outer), V(Math.cos(a) * inner * 0.9, y - 3, Math.sin(a) * inner * 0.9), 0.1));
  }
  if (rail) {
    const m = Math.max(16, Math.round((TAU * outer) / 1.6));
    let run = [];
    const flush = () => { if (run.length > 1) out.wood.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(run), run.length * 2, 0.045, 4, false)); run = []; };
    let first = null;
    for (let i = 0; i <= m; i++) {
      const a = (i / m) * TAU;
      if (open(a, 0.3)) { flush(); continue; }
      const p = V(Math.cos(a) * (outer - 0.1), y, Math.sin(a) * (outer - 0.1));
      if (i < m) out.wood.push(new THREE.CylinderGeometry(0.05, 0.05, 1, 4).translate(p.x, y + 0.5, p.z));
      run.push(p.clone().add(V(0, 1, 0)));
      if (i === 0) first = run;
    }
    flush();
    void first;
  }
  return out;
}

/** A straight stick from a to b, r thick. */
export const stick = (a, b, r = 0.06, radial = 4) => new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, r, radial, false);

/** A lantern on a post: { wood, glow } geometries, its lamp at [x, y + h, z]. */
export function lantern(x, y, z, h = 1.6) {
  return {
    wood: [new THREE.CylinderGeometry(0.05, 0.06, h, 4).translate(x, y + h / 2, z), new THREE.ConeGeometry(0.2, 0.14, 6).translate(x, y + h + 0.24, z)],
    glow: [new THREE.SphereGeometry(0.15, 8, 6).scale(1, 1.25, 1).translate(x, y + h + 0.06, z)],
    at: [x, y + h + 0.05, z],
  };
}

/**
 * A plank walk along points ([x, y, z]…, its deck's top at their y), w wide: planks across, posts and a rail each
 * side, stilts down into the water every `stilt` m, a lantern every `lamp` m (0: none) on alternate sides.
 * { planks: [geo], wood: [geo], glow: [geo], lamps: [[x, y, z]] }. sag: the deck sags between its ends (a bridge).
 */
export function walkway(points, { w = 1.8, rail = true, stilt = 4, lamp = 8, sag = 0, seed = 1, bed = -2, plank = 0.5, detail = 1 } = {}) {
  const rng = mulberry32(Math.floor(seed * 4447) + 2), out = { planks: [], wood: [], glow: [], lamps: [] };
  const curve = new THREE.CatmullRomCurve3(points.map((p) => V(...p)), false, 'centripetal'), Ltot = curve.getLength();
  const n = Math.max(2, Math.round(Ltot / plank)), at = (u) => { const p = curve.getPointAt(u); p.y -= sag * Math.sin(Math.PI * u); return p; };
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, p = at(u), q = at(Math.min(1, u + 0.5 / n)), t = q.clone().sub(at(Math.max(0, u - 0.5 / n))).normalize();
    const len = w * (0.92 + rng() * 0.16), g = new THREE.BoxGeometry(len, 0.12, (Ltot / n) * 1.03);   // (a little overlap: no gap a ray or a foot could find)
    const m = new THREE.Matrix4().lookAt(V(0, 0, 0), t, V(0, 1, 0));
    out.planks.push(g.applyMatrix4(m).translate(p.x, p.y - 0.06 + (i % 2) * 0.006, p.z));   // (every other a hair higher: the overlaps never flicker)
  }
  const side = (u, e) => { const p = at(u), t = curve.getTangentAt(u); return p.add(V(-t.z, 0, t.x).normalize().multiplyScalar(e * w * 0.48)); };
  const posts = Math.max(2, Math.round(Ltot / 2));
  if (rail) for (const e of [-1, 1]) {
    const top = [];
    for (let i = 0; i <= posts; i++) {
      const p = side(i / posts, e);
      out.wood.push(new THREE.CylinderGeometry(0.05, 0.05, 1, 4).translate(p.x, p.y + 0.5, p.z));
      top.push(p.clone().add(V(0, 1, 0)));
    }
    out.wood.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top), Math.max(4, posts * 2), 0.045, 4, false));
  }
  if (stilt) {
    const k = Math.max(1, Math.round(Ltot / stilt));
    for (let i = 0; i <= k; i++) for (const e of [-1, 1]) {
      const p = side(i / k, e * 0.9), d = p.y - bed;
      if (d < 0.5) continue;
      out.wood.push(new THREE.CylinderGeometry(0.09, 0.11, d, 5).translate(p.x, bed + d / 2, p.z));
    }
  }
  if (lamp) {
    const k = Math.max(1, Math.round(Ltot / lamp));
    for (let i = 0; i <= k; i++) {
      const p = side(i / k, i % 2 ? 1 : -1), L = lantern(p.x, p.y + 1, p.z, 0.9);
      out.wood.push(...L.wood); out.glow.push(...L.glow); out.lamps.push(L.at);
    }
  }
  void detail;
  return out;
}

/** Steps from A to B ([x, y, z]: the foot's and the top's tread), w wide, with rails. { wood: [geo], planks: [geo] }. */
export function stairs(A, B, { w = 1.2, rise = 0.24, rail = true } = {}) {
  const a = V(...A), b = V(...B), n = Math.max(2, Math.ceil(Math.abs(b.y - a.y) / rise)), dir = b.clone().sub(a).setY(0), run = dir.length() / n;
  dir.normalize();
  const m = new THREE.Matrix4().lookAt(V(0, 0, 0), dir, V(0, 1, 0)), out = { wood: [], planks: [] };
  for (let i = 1; i <= n; i++) {
    const p = a.clone().lerp(b, i / n);
    out.planks.push(new THREE.BoxGeometry(w, 0.1, run * 1.15).applyMatrix4(m).translate(p.x, p.y - 0.05, p.z));
  }
  const s = V(-dir.z, 0, dir.x).multiplyScalar(w * 0.5);
  for (const e of [-1, 1]) {
    const o = s.clone().multiplyScalar(e);
    out.wood.push(new THREE.TubeGeometry(new THREE.LineCurve3(a.clone().add(o).add(V(0, -0.15, 0)), b.clone().add(o).add(V(0, -0.15, 0))), 2, 0.07, 4, false));
    if (rail) out.wood.push(new THREE.TubeGeometry(new THREE.LineCurve3(a.clone().add(o).add(V(0, 0.95, 0)), b.clone().add(o).add(V(0, 0.95, 0))), 2, 0.04, 4, false));
    if (rail) for (let i = 0; i <= n; i += 3) { const p = a.clone().lerp(b, i / n).add(o); out.wood.push(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 4).translate(p.x, p.y + 0.47, p.z)); }
  }
  return out;
}

/** A long flat boat along +z, L long, W wide, its gunwale at y = 0.35 over the water. { hull: [geo], floor: [geo] }. */
export function punt(L = 7, W = 1.4) {
  const lens = (l, w) => {
    const s = new THREE.Shape(), n = 12;
    for (let i = 0; i <= n; i++) { const t = i / n, z = (t - 0.5) * l, x = (w / 2) * Math.pow(Math.cos((t - 0.5) * Math.PI), 0.45); i ? s.lineTo(x, z) : s.moveTo(x, z); }
    for (let i = n; i >= 0; i--) { const t = i / n, z = (t - 0.5) * l, x = -(w / 2) * Math.pow(Math.cos((t - 0.5) * Math.PI), 0.45); s.lineTo(x, z); }
    return s;
  };
  const hull = new THREE.ExtrudeGeometry(lens(L, W), { depth: 0.55, bevelEnabled: false, curveSegments: 1 }).rotateX(Math.PI / 2).translate(0, 0.35, 0);
  const floor = new THREE.ShapeGeometry(lens(L * 0.9, W * 0.8)).rotateX(Math.PI / 2).scale(1, 1, 1).translate(0, 0.37, 0);
  floor.rotateY(0);
  return { hull: [hull], floor: [floor.scale(1, -1, 1).translate(0, 0.74, 0)] };
}

/**
 * The lake's luminous creatures: n flat spots on the water (y = lift), where `inside(x, z)` says, sizes s0..s1 (m),
 * stretched along the camera's view a little (petals seen low). Returns [[geo…] per tone] for `tones` tones.
 */
export function glowSpots(n, { x0, x1, z0, z1, inside = () => true, s0 = 0.2, s1 = 0.9, lift = 0.04, tones = 3, seed = 1, near = 1.6 }) {
  const rng = mulberry32(Math.floor(seed * 3203) + 7), out = Array.from({ length: tones }, () => []);
  for (let i = 0; i < n; i++) {
    const x = x0 + rng() * (x1 - x0), z = z0 + Math.pow(rng(), near) * (z1 - z0);
    if (!inside(x, z)) continue;
    const s = (s0 + Math.pow(rng(), 2) * (s1 - s0)) * (1 + Math.abs(z) / 45);   // (the far ones a little larger: a swarm seen low)
    out[Math.floor(rng() * tones)].push(new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2).scale(s * (0.8 + rng() * 0.8), 1, s * (0.6 + rng() * 0.5)).rotateY(rng() * TAU).translate(x, lift, z));
  }
  return out;
}

/** The wood behind: a tall thin grey trunk with a few bare limbs, its foot at the origin. */
export function farTree(seed, h = 40, r = 0.8, detail = 0.6) {
  const rng = mulberry32(Math.floor(seed * 1721) + 5), out = [];
  const lean = V((rng() - 0.5) * h * 0.06, h, (rng() - 0.5) * h * 0.06);
  out.push(limb([V(0, -1, 0), V((rng() - 0.5) * r * 1.5, h * 0.5, 0), lean], r, 0.6, Math.max(5, Math.round(10 * detail)), 6));
  // two or three limbs, steep: the far wood reads as columns, not a tangle
  for (let i = 0; i < 2 + (rng() < 0.4 ? 1 : 0); i++) {
    const t = 0.55 + i * 0.15, p = V(lean.x * t, h * t, lean.z * t), a = rng() * TAU, l = h * (0.15 + rng() * 0.12);
    out.push(limb([p, p.clone().add(V(Math.cos(a) * l * 0.35, l * 0.6, Math.sin(a) * l * 0.35)), p.clone().add(V(Math.cos(a) * l * 0.55, l * 1.1, Math.sin(a) * l * 0.55))], r * 0.45, 0.4, 5, 4));
  }
  // its foot: a few roots splayed into the water
  for (let i = 0; i < 4; i++) { const a = rng() * TAU, d = r * 3; out.push(limb([V(0, r * 2.5, 0), V(Math.cos(a) * d * 0.6, r * 1.6, Math.sin(a) * d * 0.6), V(Math.cos(a) * d, -1, Math.sin(a) * d)], r * 0.4, 0.5, 5, 4)); }
  return out;
}

/** Merge a list of geometries (or null for none). */
export const merged = (list) => (list.length ? mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g))) : null);

// ---------------------------------------------------------------- the world's look (the views and the world)
/**
 * The mangrove's touches on the print preset: no clouds, the wood behind in stepped bands of a cool violet-blue
 * haze, a low mist over the black water, hardly a cast shadow in the twilight (post.js CAST), few spot blacks.
 */
export const MANGROVE_HAZE = { uHazeLayers: [70, 1.7, 0.16, 5], uHazeTone: [0.17, 0.23, 0.44, 0.85], uHeightFog: [1.2, 5, 0.004, 0.35], uHeightFogTone: [0.42, 0.44, 0.7, 0.5] };
// (colour pass, v0.94: the cast shade kept more (uCast), so the white trees split into a white-pink light and a
//  lavender-blue shade as the pictures' do, instead of one even pink)
export const MANGROVE_LOOK = { uClouds: 0, uCumulus: 0, uSkyDots: 0.4, uFogDensity: 0.0016, uCast: [0.6, 0.35], uHalftone: 0.12, uBounce: 0.2, uSpotTone: [0.13, 0.13, 0.24, 0.45], ...MANGROVE_HAZE };
/** The day's colours (sky top, horizon, shadow, light, sun): a violet twilight whatever the hour, the light pink. */
export const MANGROVE_DAY = ['#2c2a6a', '#7a5aa0', '#8c96d8', '#fff0f2', '#ffd0c8'];
/** The surfaces' tones. */
export const MANGROVE_TONES = {
  bark: '#f3f0fa', barkPale: '#dcdcf0', shell: '#f4eef4', wood: '#7a5a4e', plank: '#8a6a5a', plank2: '#7a5c50', stone: '#c9c6dc',
  lamp: '#ffd27a', window: '#ffc070', dark: '#1b2238', far: '#3a4478', farDeep: '#2c3462', leaves: '#efe0ee', bush: '#20384a', bush2: '#25424f',
  boat: '#7a5a4c', boatIn: '#4a3a3a', water: '#141a3a', shallow: '#1e2650',
  spots: ['#5c90ff', '#f07ad8', '#7adcff'],   // (saturated: the pictures' creatures glow electric blue and magenta, not pastel)
};
