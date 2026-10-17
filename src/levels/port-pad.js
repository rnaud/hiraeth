import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintMaterial } from '../vehicle-kit.js';
import { makeMaterial } from '../materials.js';
import { cabModel } from '../taxi.js';
import { padForm } from '../form.js';
import { padThin } from '../thin.js';
import { mergeable } from './lab-kit.js';
import { CRAFT, KINDS, Parts, partsOf } from './port-craft.js';

// ---------------------------------------------------------------------------
// The space ports' shared kit (issue #441, after the #397 stand-in; docs/systems/worlds.md "Space ports"; the plan:
// docs/design/space-ports.md). Every city's port is data (src/levels/ports.js), built round the ship's present site
// from one kit: the pad's paint and slabs, docking frames and cranes, towers and kiosks, cargo, parked craft
// (port-craft.js) and craft in flight. Its own look is in the data: each piece's colours, its shapes' sizes.
//
// Placed in the hull's frame: `at: [u, v]`, u metres out of the hatch (the ramp's way), v along the hull toward its
// stern (hull.js: the hull spans v -21.6 .. 30.4 and u ±8.4); `yaw` turns a piece from facing out of the hatch. Or
// `xz: [x, z]` in the world. Heights from the ground (`groundAt`, else the site's own height) plus `dy`.
//
// The cost: everything is painted (one flat colour a part, vehicle-kit.js), so a port is a handful of merged meshes
// (paint, lamps, ground marks, cables; the paint solid and not), parked craft baked in, and each craft in flight one.
// What is solid: a piece's `solid` (towers, kiosks, cargo on the ground); the paint, the craft and what hangs over a
// void never are. The ship lands where it always did: nothing stands on its plan or its ramp (tests/ports.test.js).
//
//   buildPort(port, { groundAt }) → { group, craft: [Object3D], update(dt), sights, lights: [Vector4], noShadow }
// ---------------------------------------------------------------------------

/** The pad's paint stands this far over the deck and as far into it (no face in the paving's plane: tests/zfight.test.js). */
export const PAD_LIFT = 0.05;
const TAU = Math.PI * 2;

/** The hull's frame at a site { x, y, z, h }: (u, v) to the world, a yaw from the hatch's way. */
export function hullFrame(site) {
  const { x, z, h } = site, o = [Math.sin(h), Math.cos(h)], a = [Math.cos(h), -Math.sin(h)];
  return {
    site,
    at: (u, v) => [x + o[0] * u + a[0] * v, z + o[1] * u + a[1] * v],
    yaw: (r = 0) => h + r,
    /** (u, v) of a world point. */
    uv: (px, pz) => [(px - x) * o[0] + (pz - z) * o[1], (px - x) * a[0] + (pz - z) * a[1]],
  };
}

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1);
const place = (x, y, z, yaw, s = 1) => M4.compose(new THREE.Vector3(x, y, z), Q.setFromEuler(E.set(0, yaw, 0)), typeof s === 'number' ? S1.clone().setScalar(s) : new THREE.Vector3(...s)).clone();
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const flatRing = (r0, r1, a0 = 0, a1 = TAU, seg = 64) => new THREE.RingGeometry(r0, r1, Math.max(6, Math.round(seg * (a1 - a0) / TAU)), 1, a0, a1 - a0).rotateX(-Math.PI / 2);

/** A craft's parts by its model: one of CRAFT, or the City-Shaft's cab (taxi.js). */
export function craftParts(spec) {
  if (spec.model === 'cab') return partsOf(cabModel(spec.colors?.hull ?? spec.color ?? '#e8a088', 1, { fares: false }));
  return CRAFT[spec.model](spec.colors ?? {});
}

// ------------------------------------------------------------------ the pad: paint and slabs round the site
/** A piece in local frame (x across, z out along its yaw) to the world: P(local parts) → into. */
function put(into, local, x, y, z, yaw, s = 1) { local.apply(place(x, y, z, yaw, s), into); }

const PAD = {
  /** Dashes on a ring: { r, n, w, color, gaps: [[u, v, r]] }. */
  dashes(P, F, L, y) {
    const { r, n = 24, w = 1.1, color } = L;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, u = Math.cos(a) * r, v = Math.sin(a) * r;
      if ((L.gaps ?? []).some(([gu, gv, gr]) => Math.hypot(u - gu, v - gv) < gr)) continue;
      const [x, z] = F.at(u, v), len = (TAU * r / n) * 0.62;
      P.paint(box(len, 2 * PAD_LIFT, w).rotateY(F.yaw(a)).translate(x, y, z), color);   // (turned to angle a, its local z runs out from the middle)
    }
  },
  /** A painted arc: { r, w, from, to (rad, 0 out of the hatch, toward the stern at PI/2), color, at }. */
  arc(P, F, L, y) {
    const [cu, cv] = L.at ?? [0, 0], [x, z] = F.at(cu, cv);
    // (laid flat, RingGeometry's angle t points to (cos t, -sin t); turned by the hull's yaw, local z is u and x is v: the
    // frame's angle a is t = a - PI/2)
    const g = flatRing(L.r - L.w / 2, L.r + L.w / 2, (L.from ?? 0) - Math.PI / 2, (L.to ?? TAU) - Math.PI / 2);
    P.paint(g.rotateY(F.yaw(0)).translate(x, y + PAD_LIFT, z), L.color);
  },
  /** A raised slab: { r, h, color, edge (its rim's colour), line: { r, w, color } }; never solid. */
  disc(P, F, L, y) {
    const [cu, cv] = L.at ?? [0, 0], [x, z] = F.at(cu, cv), h = L.h ?? 0.15;
    P.add(cyl(L.r, L.r + h * 1.6, h + 0.3, 72).translate(x, y + h / 2 - 0.15, z), L.color);   // (its top h over the ground, its foot sunk 0.3)
    if (L.edge) P.add(cyl(L.r + h * 1.7, L.r + h * 2.2, h * 0.5, 72).translate(x, y + h * 0.25 - 0.02, z), L.edge);
    if (L.line) P.paint(flatRing(L.line.r - L.line.w / 2, L.line.r + L.line.w / 2).translate(x, y + h + PAD_LIFT * 0.5, z), L.line.color);
  },
  /** Steps up onto a slab: { at, yaw, w, h, n, color }. */
  steps(P, F, L, y) {
    const [x, z] = F.at(...L.at), n = L.n ?? 2, h = L.h ?? 0.3, d = 0.55;
    for (let i = 0; i < n; i++) P.add(box(L.w ?? 3, h * (n - i) / n, d).translate(0, h * (n - i) / n / 2, d * (i + 0.5)).rotateY(F.yaw(L.yaw ?? 0)).translate(x, y - 0.02, z), L.color);
  },
  /** A painted outline round a rectangle along the hull: { at, len (along v), wid (along u), w, color, corners }. */
  rect(P, F, L, y) {
    const [cu, cv] = L.at ?? [0, 0], { len, wid, w = 0.4 } = L;
    const bar = (u, v, du, dv) => { const [x, z] = F.at(cu + u, cv + v); P.paint(box(du, 2 * PAD_LIFT, dv).rotateY(F.yaw(0)).translate(x, y, z), L.color); };
    // (in the hull frame a box's local x runs along v and its z along u once turned to the hatch: rotateY(h) maps z to u)
    bar(wid / 2, 0, len + w, w); bar(-wid / 2, 0, len + w, w); bar(0, len / 2, w, wid); bar(0, -len / 2, w, wid);
  },
  /** A painted circle, a cross or chevrons in it: { at, r, w, color, mark: 'cross' | 'dot' }. */
  circle(P, F, L, y) {
    const [x, z] = F.at(...L.at);
    P.paint(flatRing(L.r - L.w, L.r, 0, TAU, 40).translate(x, y + PAD_LIFT, z), L.color);
    if (L.mark === 'cross') for (const r of [0, Math.PI / 2]) P.paint(box(L.r * 1.2, 2 * PAD_LIFT, L.w).rotateY(F.yaw(r)).translate(x, y, z), L.color);
    if (L.mark === 'dot') P.paint(new THREE.CircleGeometry(L.r * 0.22, 20).rotateX(-Math.PI / 2).translate(x, y + PAD_LIFT, z), L.color);
  },
  /** Lamps set in the ground round a ring: { r, n, color, at, gaps }. */
  studs(P, F, L, y) {
    const [cu, cv] = L.at ?? [0, 0];
    for (let i = 0; i < L.n; i++) {
      const a = (i / L.n) * TAU + (L.phase ?? 0), u = cu + Math.cos(a) * L.r, v = cv + Math.sin(a) * L.r;
      if ((L.gaps ?? []).some(([gu, gv, gr]) => Math.hypot(u - gu, v - gv) < gr)) continue;
      const [x, z] = F.at(u, v);
      P.add(cyl(0.34, 0.4, 0.1, 10).translate(x, y + 0.03, z), L.rim ?? '#8a7a5a');
      P.lit(cyl(0.22, 0.22, 0.12, 10).translate(x, y + 0.05, z), L.color);
      if (i % (L.lightEvery ?? 4) === 0) P.light(x, y + 0.6, z, 5);
    }
  },
  /** Four chevrons on the quarters pointing in: { r, color, len }. */
  chevrons(P, F, L, y) {
    for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2 + Math.PI / 4, [cx, cz] = F.at(Math.cos(a) * L.r, Math.sin(a) * L.r);
      if ((L.gaps ?? []).some(([gu, gv, gr]) => Math.hypot(Math.cos(a) * L.r - gu, Math.sin(a) * L.r - gv) < gr)) continue;
      // (two arms out from the tip, opening outward: the V points to the middle)
      for (const s of [-1, 1]) P.paint(box(0.6, 2 * PAD_LIFT, L.len ?? 2.4).translate(0, 0, (L.len ?? 2.4) / 2).rotateY(s * 0.6).rotateY(F.yaw(a)).translate(cx, y, cz), L.color);
    }
  },
  /** A flat ring of plates standing on the ground or floating: { r0, r1, h, color, rim, at, dy, posts: n }. */
  annulus(P, F, L, y) {
    const [cu, cv] = L.at ?? [0, 0], [x, z] = F.at(cu, cv), h = L.h ?? 0.6, Y = y + (L.dy ?? 0), h0 = F.yaw(0);
    // (open where `gap: [from, to]` says, angles in the hull's frame from its middle: 0 out of the hatch, the ramp's way)
    const [g0, g1] = L.gap ?? [0, 0], a0 = g1, span = TAU - (g1 - g0), open = (a) => { const t = ((a - g0) % TAU + TAU) % TAU; return t < g1 - g0; };
    const dir = (a, r) => [Math.sin(h0 + a) * r, Math.cos(h0 + a) * r];
    const N = 64, pts = [];
    for (let i = 0; i <= N; i++) { const [dx, dz] = dir(a0 + span * i / N, L.r1); pts.push(new THREE.Vector2(dx, -dz)); }
    for (let i = N; i >= 0; i--) { const [dx, dz] = dir(a0 + span * i / N, L.r0); pts.push(new THREE.Vector2(dx, -dz)); }
    const shape = L.gap ? new THREE.Shape(pts) : new THREE.Shape().absarc(0, 0, L.r1, 0, TAU, false);
    if (!L.gap) shape.holes.push(new THREE.Path().absarc(0, 0, L.r0, 0, TAU, true));
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2);
    P.plate(g.translate(x, Y, z), L.color);
    // (a torus's angle t lies at (cos t, sin t) in x, z once laid flat: the frame's angle a is t = PI/2 - (yaw + a))
    if (L.rim) for (const r of [L.r0, L.r1]) P.plate(new THREE.TorusGeometry(r, 0.18, 5, 64, span).rotateZ(Math.PI / 2 - (h0 + a0 + span)).rotateX(Math.PI / 2).translate(x, Y + h, z), L.rim);
    const at = (a, r) => { const [dx, dz] = dir(a, r); return [x + dx, z + dz]; };
    for (let i = 0; i < (L.seams ?? 0); i++) {
      const a = a0 + span * (i + 0.5) / L.seams, [sx, sz] = at(a, (L.r0 + L.r1) / 2);
      P.paint(box(0.12, 0.04, L.r1 - L.r0).rotateY(h0 + a).translate(sx, Y + h + 0.01, sz), L.rim ?? '#444');
    }
    for (let i = 0; i < (L.posts ?? 0); i++) {
      const a = a0 + span * (i + 0.5) / L.posts, [px, pz] = at(a, L.r1 - 0.8);
      if (!open(a)) P.plate(cyl(0.3, 0.38, 0.9, 8).translate(px, Y + h + 0.45, pz), L.rim ?? '#444');
    }
    // (legs down to what it stands over: `legs` of them, `drop` metres)
    for (let i = 0; i < (L.legs ?? 0); i++) {
      const a = a0 + span * (i + 0.5) / L.legs, d = L.drop ?? 4, [lx, lz] = at(a, (L.r0 + L.r1) / 2);
      P.plate(cyl(0.45, 0.6, d, 8).translate(lx, Y - d / 2, lz), L.rim ?? '#444');
    }
  },
  /** Stakes on a grid with ropes between them (Salt Harbour): { at, len, wid, nu, nv, color, rope }. */
  stakes(P, F, L, y) {
    const [cu, cv] = L.at ?? [0, 0], { len, wid, nu = 2, nv = 3 } = L;
    const pt = (i, j) => [cu - wid / 2 + (wid * i) / nu, cv - len / 2 + (len * j) / nv];
    const top = (i, j) => { const [u, v] = pt(i, j), [x, z] = F.at(u, v); return [x, y + 0.7, z]; };
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const [x, , z] = top(i, j);
      P.plate(cyl(0.22, 0.28, 1.0, 8).translate(x, y + 0.5, z), L.color);
      P.plate(cyl(0.3, 0.3, 0.12, 8).translate(x, y + 0.9, z), L.cap ?? L.color);
      if (i < nu && (j === 0 || j === nv)) P.rope(top(i, j), top(i + 1, j), L.rope, 0.05);
      if (j < nv && (i === 0 || i === nu)) P.rope(top(i, j), top(i, j + 1), L.rope, 0.05);
      // (and the ropes run off the corners, staked out on the salt)
    }
    for (const [i, j, du, dv] of [[0, 0, -1, -1], [nu, 0, 1, -1], [0, nv, -1, 1], [nu, nv, 1, 1]]) {
      const [u, v] = pt(i, j), [x, z] = F.at(u + du * 4, v + dv * 4);
      P.rope(top(i, j), [x, y + 0.05, z], L.rope, 0.04);
      P.plate(cyl(0.08, 0.1, 0.35, 5).translate(x, y + 0.12, z), L.color);
    }
  },
};

// ------------------------------------------------------------------ the pieces: frames, cranes, towers, cargo, craft
/** Where a piece stands: [x, y, z, yaw]. */
function spot(F, p, groundAt) {
  const [x, z] = p.xz ?? F.at(...p.at);
  const g = groundAt?.(x, z);
  return [x, (Number.isFinite(g) ? g : F.site.y) + (p.dy ?? 0), z, p.xz ? (p.yaw ?? 0) : F.yaw(p.yaw ?? 0)];
}

/** One cargo item at the local origin on the ground. */
function cargoItem(L, kind, c, i = 0) {
  switch (kind) {
    case 'crate': { const s = 1.0 + (i % 3) * 0.15; L.add(box(s, s, s).translate(0, s / 2, 0), c.crate ?? '#9a7a52'); L.add(box(s + 0.06, 0.1, s + 0.06).translate(0, s * 0.8, 0), c.band ?? '#5a4a3a'); return s; }
    case 'cask': L.add(cyl(0.45, 0.45, 1.1, 10).translate(0, 0.55, 0), c.cask ?? '#8a6a48'); for (const y of [0.25, 0.85]) L.plate(cyl(0.47, 0.47, 0.07, 10).translate(0, y, 0), c.band ?? '#4a4038'); return 1;
    case 'barrel': L.plate(cyl(0.4, 0.4, 1.2, 10).translate(0, 0.6, 0), c.barrel ?? '#3a3c40'); L.plate(cyl(0.42, 0.42, 0.06, 10).translate(0, 0.9, 0), c.band ?? '#6a6a6a'); return 0.9;
    case 'float': L.add(cyl(0.5, 0.6, 0.25, 8).translate(0, 0.12, 0), c.crate ?? '#8a6a48'); L.plate(new THREE.SphereGeometry(0.55, 12, 8).translate(0, 0.75, 0), c.float ?? '#3e8a68'); return 1.2;
    case 'basket': L.add(cyl(0.45, 0.35, 0.5, 9).translate(0, 0.25, 0), c.basket ?? '#b8925a'); L.add(new THREE.SphereGeometry(0.36, 8, 6).scale(1, 0.4, 1).translate(0, 0.5, 0), c.goods ?? '#d8a048'); return 1;
    case 'chest': L.add(box(1.2, 0.7, 0.75).translate(0, 0.35, 0), c.crate ?? '#5a7a9a'); L.add(new THREE.CylinderGeometry(0.375, 0.375, 1.2, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, 0.7, 0), c.lid ?? c.crate ?? '#5a7a9a'); return 1.3;
    case 'radio': L.plate(box(0.9, 0.7, 0.6).translate(0, 0.35, 0), c.radio ?? '#7a8088'); L.plate(cyl(0.02, 0.02, 1.2, 4).translate(0.3, 1.2, 0), '#2a2e32'); L.lit(cyl(0.1, 0.1, 0.05, 8).rotateX(Math.PI / 2).translate(-0.2, 0.45, 0.31), '#ffd070'); return 1;
    default: return 1;
  }
}

const PIECE = {
  /** Parked craft: { model, colors, scale }. */
  craft(P, p, [x, y, z, yaw]) { put(P, craftParts(p), x, y + (p.lift ?? 0), z, yaw, p.scale ?? 1); },

  /** A pile of cargo: { items: ['crate', ...], cols, gap, colors }: rows of `cols`, a crate now and then stacked. */
  cargo(P, p, [x, y, z, yaw]) {
    const cols = p.cols ?? 3, gap = p.gap ?? 1.25, c = p.colors ?? {}, all = new Parts();
    p.items.forEach((k, i) => {
      const one = new Parts(), top = cargoItem(one, k, c, i);
      if (p.stack && k === 'crate' && i % 3 === 0) { const up = new Parts(); cargoItem(up, 'crate', c, i + 1); up.apply(new THREE.Matrix4().makeTranslation(0.1, top, 0.05), one); }
      const cx = ((i % cols) - (cols - 1) / 2) * gap, cz = (Math.floor(i / cols) - (Math.ceil(p.items.length / cols) - 1) / 2) * gap;
      one.apply(new THREE.Matrix4().makeRotationY(((i * 0.37) % 1) * 0.4 - 0.2).setPosition(cx, 0, cz), all);
    });
    put(P, all, x, y, z, yaw);
  },

  /** A crane: a post (or a lattice tower), a boom out along its yaw (tilted up by `tilt`), a cable down to its load. */
  crane(P, p, [x, y, z, yaw]) {
    const L = new Parts(), h = p.h ?? 12, reach = p.reach ?? 10, tilt = p.tilt ?? 0, c = p.color ?? '#b06a3a', dk = p.dark ?? '#4a3a32';
    if (p.lattice) {
      const w = p.w ?? 1.6;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.plate(box(0.22, h, 0.22).translate(sx * w / 2, h / 2, sz * w / 2), c);
      for (let k = 1; k < h / 2; k++) for (const [rx, rz, ry] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]]) {
        L.plate(box(w, 0.12, 0.12).rotateZ(k % 2 ? 0.8 : -0.8).scale(1, 1, 1).rotateY(ry).translate(rx * w / 2, k * 2 - 1, rz * w / 2), c);
      }
      L.plate(box(w + 1.2, 0.4, w + 1.2).translate(0, 0.2, 0), dk);
    } else {
      L.plate(cyl(p.r ?? 0.45, (p.r ?? 0.45) * 1.25, h, 10).translate(0, h / 2, 0), c);
      L.plate(cyl((p.r ?? 0.45) * 2.4, (p.r ?? 0.45) * 2.8, 0.6, 10).translate(0, 0.3, 0), dk);
    }
    // the cab at the top, the boom, its counter-jib and weight
    L.plate(box(1.8, 1.6, 2.0).translate(0, h + 0.8, 0), p.cab ?? c);
    if (p.lamp) { L.lit(new THREE.SphereGeometry(0.25, 8, 6).translate(0, h + 1.9, 0), p.lamp); L.light(0, h + 2, 0, 9); }
    const tip = new THREE.Vector3(0, Math.sin(tilt) * reach, Math.cos(tilt) * reach);
    const bl = new Parts();
    bl.plate(box(0.7, 0.8, reach).translate(0, 0, reach / 2).rotateX(-tilt), c);
    bl.plate(box(0.6, 0.6, 4).translate(0, 0, -2).rotateX(0.05), c);
    bl.plate(box(1.4, 1.4, 1.4).translate(0, -0.3, -3.8), dk);
    bl.apply(new THREE.Matrix4().makeTranslation(0, h + 1.2, 0), L);
    // the cable and the load
    const tx = 0, ty = h + 1.2 + tip.y, tz = tip.z - 0.4, drop = p.drop ?? (h * 0.6);
    L.rope([tx, ty, tz], [tx, ty - drop, tz], p.rope ?? '#1e2226', 0.04);
    const load = new Parts();
    if (p.load === 'bucket') { load.plate(cyl(1.1, 0.7, 1.1, 4).rotateY(Math.PI / 4).translate(0, -0.55, 0), p.loadColor ?? '#a8682e'); load.add(cyl(0.15, 0.85, 0.5, 6).translate(0, 0.2, 0), '#2e2c2c'); }
    else if (p.load === 'crate') { load.add(box(1.4, 1.2, 1.4).translate(0, -0.6, 0), p.loadColor ?? '#9a7a52'); for (const s of [-1, 1]) load.rope([s * 0.6, -0.05, 0], [0, 0.6, 0], '#3a3028', 0.025); }
    else if (p.load === 'net') { load.add(new THREE.SphereGeometry(0.9, 10, 8).scale(1, 0.85, 1).translate(0, -0.8, 0), p.loadColor ?? '#b8a06a'); }
    load.apply(new THREE.Matrix4().makeTranslation(tx, ty - drop, tz), L);
    put(P, L, x, y, z, yaw);
  },

  /** A tall board of call-signs (the Signal Market): a slab, its boards lit one above another, one dark, antennas on top,
   *  a clerk's window at its foot facing out along its yaw. */
  signal(P, p, [x, y, z, yaw]) {
    const L = new Parts(), w = p.w ?? 5, d = p.d ?? 3, h = p.h ?? 22, c = p.color ?? '#7a8494';
    L.plate(box(w, h, d).translate(0, h / 2, 0), c);
    L.plate(box(w + 0.5, 0.6, d + 0.5).translate(0, h, 0), p.trim ?? '#5a6270');
    const n = p.boards ?? 9, bh = (h * 0.62) / n;
    for (let i = 0; i < n; i++) {
      const lit = !(p.dark ?? [n - 3]).includes(i), col = (p.colors ?? ['#f2c870', '#f2c870', '#9ad8d8'])[i % (p.colors?.length ?? 3)];
      const g = box(w * 0.66, bh * 0.78, 0.12).translate(0, h * 0.3 + i * bh + bh / 2, d / 2 + 0.04);
      if (lit) L.lit(g, col); else L.plate(g, '#2a2e36');
    }
    // the clerk's window
    L.plate(box(w * 0.5, 2.0, 0.3).translate(0, 2.4, d / 2 + 0.1), p.trim ?? '#5a6270');
    L.lit(box(w * 0.42, 1.5, 0.12).translate(0, 2.4, d / 2 + 0.22), '#ffe2a0');
    L.plate(box(w * 0.5, 0.12, 0.8).translate(0, 1.4, d / 2 + 0.45), p.trim ?? '#5a6270');
    L.light(0, 2.6, d / 2 + 1.5, 7);
    // the antennas
    const masts = p.antennas ?? [[-1.5, -0.6, 7], [0.4, 0.5, 10], [1.6, -0.4, 5.5], [-0.3, -0.9, 4]];
    for (const [ax, az, ah] of masts) {
      L.plate(cyl(0.07, 0.12, ah, 5).translate(ax, h + ah / 2, az), '#3a4048');
      for (let k = 1; k < 3; k++) L.plate(box(1.2 - k * 0.3, 0.06, 0.06).translate(ax, h + ah * (0.45 + k * 0.18), az), '#3a4048');
    }
    const [tx, tz, th] = masts.reduce((a, b) => (b[2] > a[2] ? b : a));
    L.lit(new THREE.SphereGeometry(0.22, 8, 6).translate(tx, h + th + 0.2, tz), '#ff6a4a');   // (the warning lamp on the tallest)
    put(P, L, x, y, z, yaw);
  },

  /** A lamp-mast: an iron post, a collar, arms with lamps, a flag-arm (the City in Space's harbour lamp). */
  mast(P, p, [x, y, z, yaw]) {
    const L = new Parts(), h = p.h ?? 11, c = p.color ?? '#3e6e7a';
    L.plate(cyl(0.28, 0.4, h, 8).translate(0, h / 2, 0), c);
    L.plate(cyl(0.8, 0.95, 0.9, 10).translate(0, 0.45, 0), c);
    L.plate(cyl(0.55, 0.55, 1.4, 10).translate(0, h * 0.62, 0), p.trim ?? '#c8a050');
    for (const s of [-1, 1]) {
      L.plate(box(2.6, 0.18, 0.18).translate(s * 1.3, h - 0.6, 0), c);
      L.lit(new THREE.SphereGeometry(0.32, 10, 6).translate(s * 2.5, h - 1.0, 0), p.lamp ?? '#ffd48c');
      L.light(s * 2.5, h - 1.0, 0, 9);
    }
    L.plate(cyl(0.05, 0.05, 2.4, 4).translate(0, h + 1.2, 0), c);
    put(P, L, x, y, z, yaw);
  },

  /** The mirror tower (the Eclipse city's signal): a pale column, a cage on top holding a round mirror. */
  mirror(P, p, [x, y, z, yaw]) {
    const L = new Parts(), h = p.h ?? 12, c = p.color ?? '#efe8dc', b = p.brass ?? '#b8924a';
    L.add(cyl(1.3, 1.8, h, 12).translate(0, h / 2, 0), c);
    L.add(cyl(2.3, 2.5, 1.2, 12).translate(0, 0.6, 0), c);
    L.plate(cyl(1.9, 1.7, 0.5, 12).translate(0, h + 0.25, 0), b);
    for (const s of [-1, 1]) L.plate(box(0.15, 4.2, 0.15).translate(s * 1.9, h + 2.3, 0), b);
    L.plate(new THREE.TorusGeometry(1.75, 0.14, 6, 28).translate(0, h + 2.6, 0), b);
    L.lit(new THREE.CircleGeometry(1.65, 28).translate(0, h + 2.6, 0.02), p.glass ?? '#fff4dc');
    L.plate(new THREE.CircleGeometry(1.65, 28).rotateY(Math.PI).translate(0, h + 2.6, -0.02), b);
    L.light(0, h + 2.6, 1.5, 12);
    put(P, L, x, y, z, yaw);
  },

  /** A pylon: a tapered limewashed post on a plinth, a lantern on top (the Eclipse city's rows of lamps). */
  pylon(P, p, [x, y, z, yaw]) {
    const L = new Parts(), h = p.h ?? 4.5, c = p.color ?? '#efe8dc', k = h / 4.5, b = p.brass ?? '#b8924a';
    L.add(cyl(0.3 * k, 0.85 * k, h, 4).rotateY(Math.PI / 4).translate(0, h / 2, 0), c);
    L.add(box(1.8 * k, 0.45 * k, 1.8 * k).translate(0, 0.22 * k, 0), c);
    L.plate(cyl(0.34 * k, 0.38 * k, 0.25 * k, 6).translate(0, h + 0.12 * k, 0), b);
    L.lit(cyl(0.24 * k, 0.3 * k, 0.6 * k, 6).translate(0, h + 0.55 * k, 0), p.lamp ?? '#ffd27a');
    L.plate(new THREE.ConeGeometry(0.36 * k, 0.4 * k, 6).translate(0, h + 1.05 * k, 0), b);
    if (p.light !== false) L.light(0, h + 0.55 * k, 0, 7);
    put(P, L, x, y, z, yaw);
  },

  /** A kiosk: a hut with a lit window facing out along its yaw, a roof (flat, pitched or round), an awning. */
  kiosk(P, p, [x, y, z, yaw]) {
    const L = new Parts(), w = p.w ?? 3.2, d = p.d ?? 2.6, h = p.h ?? 2.8, c = p.color ?? '#c8b8a0';
    L.add(box(w, h, d).translate(0, h / 2, 0), c);
    if (p.roof === 'round') L.plate(new THREE.CylinderGeometry(d / 2 + 0.2, d / 2 + 0.2, w + 0.4, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, h, 0).rotateY(Math.PI / 2), p.roofColor ?? '#c8604a');
    else L.plate(box(w + 0.5, 0.3, d + 0.5).translate(0, h + 0.15, 0), p.roofColor ?? '#c8604a');
    L.lit(box(w * 0.55, 1.0, 0.1).translate(0, h * 0.55, d / 2 + 0.03), p.window ?? '#ffd890');
    L.add(box(w * 0.65, 0.1, 0.6).translate(0, h * 0.55 - 0.55, d / 2 + 0.3), p.trim ?? '#6a5040');
    if (p.awning) L.add(box(w * 0.8, 0.06, 1.3).rotateX(0.35).translate(0, h * 0.55 + 0.85, d / 2 + 0.6), p.awning);
    L.light(0, h * 0.55, d / 2 + 1.2, 6);
    put(P, L, x, y, z, yaw);
  },

  /** A canvas over poles: { w, d, h, color, pole }; a rack of goods under it when `under`. */
  awning(P, p, [x, y, z, yaw]) {
    const L = new Parts(), w = p.w ?? 5, d = p.d ?? 4, h = p.h ?? 3.2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.add(cyl(0.06, 0.07, h + (sz > 0 ? 0.4 : 0), 5).translate(sx * w / 2, (h + (sz > 0 ? 0.4 : 0)) / 2, sz * d / 2), p.pole ?? '#6a5040');
    L.add(new THREE.PlaneGeometry(w + 0.6, d + 0.6, 2, 2).rotateX(-Math.PI / 2 + 0.1).translate(0, h + 0.2, 0), p.color ?? '#d89a48');
    L.add(new THREE.PlaneGeometry(w + 0.6, d + 0.6, 2, 2).rotateX(Math.PI / 2 + 0.1).translate(0, h + 0.19, 0), p.color ?? '#d89a48');
    for (const sx of [-1, 1]) L.rope([sx * w / 2, h + 0.4, d / 2], [sx * (w / 2 + 1.4), 0.05, d / 2 + 1.4], '#4a3a28', 0.02);
    put(P, L, x, y, z, yaw);
    if (p.under) PIECE.cargo(P, p.under, [x, y, z, yaw]);
  },

  /** A rack of glass floats on a trestle (the Glass Dunes): { n, color, float }. */
  rack(P, p, [x, y, z, yaw]) {
    const L = new Parts(), n = p.n ?? 4, wood = p.color ?? '#8a6a48';
    L.add(box(n * 1.25 + 0.4, 0.15, 1.3).translate(0, 1.0, 0), wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.add(box(0.12, 1.0, 0.12).translate(sx * (n * 0.62), 0.5, sz * 0.55), wood);
    for (let i = 0; i < n; i++) L.plate(new THREE.SphereGeometry(0.55, 12, 8).translate((i - (n - 1) / 2) * 1.25, 1.62, 0), p.float ?? '#3e8a68');
    put(P, L, x, y, z, yaw);
  },

  /** A chalk-board on an easel (the harbour's log). */
  board(P, p, [x, y, z, yaw]) {
    const L = new Parts();
    for (const s of [-1, 1]) L.add(box(0.1, 2.0, 0.1).rotateX(-0.15).translate(s * 0.7, 1.0, 0), p.wood ?? '#5a3a30');
    L.add(box(0.1, 1.8, 0.1).rotateX(0.35).translate(0, 0.9, -0.4), p.wood ?? '#5a3a30');
    L.add(box(1.5, 1.1, 0.08).rotateX(-0.15).translate(0, 1.45, 0.06), p.color ?? '#24302c');
    for (let i = 0; i < 4; i++) L.paint(box(0.4 + (i % 2) * 0.5, 0.05, 0.02).rotateX(-0.15).translate(-0.3 + (i % 2) * 0.2, 1.75 - i * 0.2, 0.13), '#e8e4d8');
    put(P, L, x, y, z, yaw);
  },

  /** The moorers' ring cradle (the City in Space): a C-shaped iron ring hung off the rim on brackets, a boat in it on a
   *  tray, a lamp on its arm; it stands out past the rim along its yaw, under the deck's level. */
  ring(P, p, [x, y, z, yaw]) {
    // the hoop stands across the yaw (along the rim), open at the top: its ends at angle PI/2 ± half the gap
    const R = p.r ?? 4.4, c = p.color ?? '#4a7a8c', t = p.trim ?? '#c8a050', out = p.out ?? R + 1.5, L = new Parts();
    const arc = Math.PI * 1.45, start = Math.PI / 2 + (TAU - arc) / 2, ex = Math.cos(start) * R, ey = Math.sin(start) * R;
    const cy = p.cy ?? -ey - 0.4;   // (its open ends just under the deck's edge)
    L.plate(new THREE.TorusGeometry(R, 0.42, 6, 30, arc).rotateZ(start).translate(0, cy, out), c);
    L.plate(new THREE.TorusGeometry(R, 0.14, 4, 30, arc).rotateZ(start).translate(0, cy, out + 0.45), t);
    L.plate(box(R * 1.6, 0.5, 3.0).translate(0, cy - R * 0.62, out), c);
    // the brackets back to the rim from the hoop's open ends, a cable or two down into the dark
    for (const s of [-1, 1]) {
      L.plate(box(0.7, 0.9, out + 1.6).translate(s * ex, cy + ey, out / 2 - 0.8), c);
      L.plate(box(0.8, 1.0, 0.8).translate(s * ex, cy + ey, out), t);
    }
    L.rope([R * 0.5, cy - R * 0.85, out], [R * 0.3, cy - R - 7, out + 1], '#1e2a30', 0.04);
    L.rope([-R * 0.5, cy - R * 0.85, out], [-R * 0.7, cy - R - 10, out - 0.5], '#1e2a30', 0.04);
    // the lamp on a crooked arm over the hoop
    L.plate(cyl(0.12, 0.12, 2.2, 6).translate(ex, cy + ey + 1.1, out), c);
    L.plate(box(0.2, 0.2, 1.6).translate(ex, cy + ey + 2.2, out + 0.8), c);
    L.lit(new THREE.SphereGeometry(0.3, 8, 6).translate(ex, cy + ey + 1.8, out + 1.6), p.lamp ?? '#ffd48c');
    L.light(ex, cy + ey + 1.8, out + 1.6, 8);
    if (p.craft) craftParts(p.craft).apply(new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(0, cy - R * 0.62 + 0.25, out), L);
    put(P, L, x, y, z, yaw);
  },

  /** A cradle over the rim (the City-Shaft): two long lacquered box girders cantilevered out past the rim along the yaw,
   *  brass caps, cross-ties, its root bolted to the rim; a craft held in it when `craft`. */
  cradle(P, p, [x, y, z, yaw]) {
    const L = new Parts(), len = p.len ?? 22, w = p.w ?? 7, c = p.color ?? '#d8a8c8', t = p.trim ?? '#c8a050', dk = p.dark ?? '#9aa4c0';
    for (const s of [-1, 1]) {
      L.plate(box(1.3, 2.4, len).translate(s * w / 2, -0.3, len / 2 - 3), c);
      L.plate(box(1.36, 0.5, len * 0.4).translate(s * w / 2, -0.3, len * 0.55), dk);
      L.plate(box(1.5, 2.6, 0.4).translate(s * w / 2, -0.3, len - 3), t);
      L.plate(box(1.4, 3.2, 3.0).translate(s * w / 2, 0.3, -2.2), c);
      L.plate(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 10).rotateZ(Math.PI / 2).translate(s * (w / 2 + 0.9), 0.6, -2.2), t);
    }
    for (let k = 2; k < len - 4; k += 5) L.plate(box(w, 0.4, 0.5).translate(0, -1.3, k), dk);
    // a cable from its tip to a post on the rim, a crate swinging under its end
    L.plate(cyl(0.3, 0.4, 7, 8).translate(0, 3.5, -4.2), c);
    L.rope([0, 7, -4.2], [w / 2, 0.8, len - 3], '#2a2a30', 0.05);
    L.rope([-w / 2, 0.8, len - 3], [0, 7, -4.2], '#2a2a30', 0.05);
    L.rope([w / 2 - 0.3, -1.5, len - 4], [w / 2 - 0.3, -16, len - 4], '#2a2a30', 0.04);
    L.add(box(1.3, 1.3, 1.3).translate(w / 2 - 0.3, -16.6, len - 4), '#9a7a52');
    if (p.craft) craftParts(p.craft).apply(new THREE.Matrix4().makeScale(p.craft.scale ?? 1, p.craft.scale ?? 1, p.craft.scale ?? 1).setPosition(0, -1.1, len * 0.55), L);
    put(P, L, x, y, z, yaw);
  },

  /** The stand-in's dock: an iron arm out over the edge, a post and jib with a lamp, a craft moored at its end. */
  arm(P, p, [x, y, z, yaw]) {
    const L = new Parts(), len = p.len ?? 10, c = p.color ?? '#24323a';
    for (const s of [-1.3, 1.3]) L.plate(box(0.35, 0.7, len).translate(s, -0.6, len / 2), c);
    for (let d = 1; d < len; d += 2) L.plate(box(2.9, 0.16, 0.2).translate(0, -0.3, d), c);
    const H = 7.5;
    L.plate(cyl(0.22, 0.3, H, 8).translate(2.2, H / 2, -0.6), c);
    L.plate(box(0.25, 0.3, len).translate(2.2, H - 0.4, len / 2 - 0.5), c);
    L.rope([2.2, H - 0.4, len - 1.6], [2.2, 2.2, len - 1.6]);
    L.lit(new THREE.SphereGeometry(0.22, 10, 6).translate(2.2, H - 0.1, len - 1.6), p.lamp ?? '#ffd48c');
    L.light(2.2, H, len - 1.6, 7);
    if (p.craft) craftParts(p.craft).apply(new THREE.Matrix4().setPosition(0, 0.2, len - 1.6), L);
    put(P, L, x, y, z, yaw);
  },
};

// ------------------------------------------------------------------ craft in flight
/** A craft on a loop: an ellipse round `centre` at height h, its nose along the way, bobbing and banking. */
class Flyer {
  constructor(T, i, mats) {
    this.T = T; this.t = T.phase ?? i * 1.7;
    this.root = meshesOf(craftParts(T), mats, { shadow: false, one: true });
    this.root.scale.setScalar(T.scale ?? 1);
    this.root.name = `port traffic ${i}`;
    this.root.userData.floats = true;   // (in the air on purpose: src/clip-audit.js)
    this.place(0);
  }
  place(dt) {
    const T = this.T, w = (T.speed ?? 12) / Math.max(T.rx, T.rz) * (T.dir ?? 1);
    this.t += dt * w;
    const [cx, cy, cz] = T.centre, x = cx + Math.sin(this.t) * T.rx, z = cz + Math.cos(this.t) * T.rz;
    const dx = Math.cos(this.t) * T.rx * w, dz = -Math.sin(this.t) * T.rz * w;
    this.root.position.set(x, cy + T.h + Math.sin(this.t * 5.3) * 0.6, z);
    this.root.rotation.set(0, Math.atan2(dx, dz), 0);
    this.root.rotateZ(-0.18 * Math.sign(w));
  }
}

// ------------------------------------------------------------------ the meshes
let MATS = null;
/** The kit's materials, shared by every port: matte and metal paint, lamps, the ground's marks, cables. */
export function portMaterials() {
  return MATS ??= {
    matte: paintMaterial({}),
    metal: paintMaterial({ metal: 'painted' }),   // (a craft in flight: the cab's own paint)
    glow: paintMaterial({ glow: 1 }),
    mark: paintMaterial({}),
    cable: makeMaterial({ color: '#ffffff', vertexColors: true, flat: true, thin: 2.5, line: 0.7 }),
  };
}
const SHADOWLESS = new Set(['glow', 'mark', 'cable']);

/** Parts as a group of merged meshes, one a kind; `solid` meshes collide, the rest are walked through. */
function meshesOf(P, mats, { solid = false, shadow = true, group = new THREE.Group(), noShadow = [], one = false } = {}) {
  // (matte and metal paint share one mesh: the paint's colours say which is which, and a port is a call fewer; a craft
  // in flight is one mesh, its lamps painted in)
  const lists = one ? { matte: [...P.matte, ...P.metal, ...P.glow, ...P.mark, ...P.cable] } : { matte: [...P.matte, ...P.metal], glow: P.glow, mark: P.mark, cable: P.cable };
  for (const [k, parts] of Object.entries(lists)) {
    if (!parts.length) continue;
    const list = padThin(padForm(parts.map((g) => mergeable(g))));
    const m = new THREE.Mesh(mergeGeometries(list), one ? mats.metal : mats[k]);
    m.name = `port ${k}${solid ? ' solid' : ''}`;
    if (!solid) m.userData.noCollide = true;
    m.castShadow = shadow && !SHADOWLESS.has(k);
    m.receiveShadow = true;
    if (!m.castShadow) { m.userData.castShadow = false; noShadow.push(m); }   // (out of the shadow passes: shadows.js selfLitSkips)
    group.add(m);
  }
  return group;
}

/** The port: its pad, its pieces and its traffic, from the city's data (src/levels/ports.js). */
export function buildPort(port, { groundAt = null } = {}) {
  const F = hullFrame(port.site), mats = portMaterials();
  const loose = new Parts(), solid = new Parts();
  const y0 = (() => { const g = groundAt?.(port.site.x, port.site.z); return Number.isFinite(g) ? g : port.site.y; })();
  for (const L of port.pad ?? []) PAD[L.kind](loose, F, L, y0 + (L.dy ?? 0));
  for (const p of port.pieces ?? []) {
    if (!PIECE[p.kind]) throw new Error(`port ${port.id}: no piece "${p.kind}"`);
    PIECE[p.kind](p.solid ? solid : loose, p, spot(F, p, groundAt));
  }
  for (const k of ['glow', 'mark', 'cable']) { loose[k].push(...solid[k]); solid[k] = []; }   // (lamps, paint and cables never stop you)
  const group = new THREE.Group(), noShadow = [];
  group.name = `${port.id} port`;
  meshesOf(loose, mats, { group, noShadow });
  meshesOf(solid, mats, { solid: true, group, noShadow });
  const flyers = (port.traffic ?? []).map((T, i) => new Flyer(T, i, mats));
  for (const f of flyers) { group.add(f.root); f.root.traverse((o) => o.isMesh && noShadow.push(o)); }
  const lights = [...loose.lights, ...solid.lights].map(([x, y, z, r]) => new THREE.Vector4(x, y, z, r));
  return {
    group, lights, noShadow,
    craft: flyers.map((f) => f.root),
    update(dt) { for (const f of flyers) f.place(dt); },
    sights: (port.sights ?? []).map((s) => ({ name: s.name, at: s.xz ? [s.xz[0], y0, s.xz[1]] : (([x, z]) => [x, y0, z])(F.at(...s.at)) })),
  };
}


/**
 * A level with its port: the port's meshes in the scene, its lamps among the level's lights, its craft moved by the
 * level's update, its sights with the level's (an array or a function of them). Returns the level.
 */
export function attachPort(level, scene, port, opts = {}) {
  const P = buildPort(port, opts);
  scene.add(P.group);
  if (Array.isArray(level.lights)) level.lights.push(...P.lights); else if (level.lights == null) level.lights = [...P.lights];
  if (Array.isArray(level.noShadow)) level.noShadow.push(...P.noShadow);
  const up = level.update;
  level.update = function (dt, ...rest) { const r = up?.call(this, dt, ...rest); P.update(dt); return r; };
  const vec = (s) => (Array.isArray(level.sights) && level.sights.some((x) => x.at?.isVector3) ? { ...s, at: new THREE.Vector3(...s.at) } : s);
  if (Array.isArray(level.sights)) level.sights.push(...P.sights.map(vec));
  else if (typeof level.sights === 'function') { const of = level.sights; level.sights = () => [...of(), ...P.sights]; }
  else if (level.sights == null) level.sights = [...P.sights];
  level.port = P;
  return level;
}
