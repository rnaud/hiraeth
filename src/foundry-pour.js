import * as THREE from 'three';
import { makeMaterial, sharedUniforms } from './materials.js';
import { registerHazard, HAZARD_DPS } from './hazards.js';
import { smoothstep } from './noise.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// The Moon Foundry's night pour (issue #193, the author's pick of the level explorations, the Moon Foundry's
// night-pour sheets in references/levels/; docs/systems/worlds.md "The Moon Foundry: inside the moons, the cranes
// and the night pour"). The Casting-House pours by itself at night, and the floor shows it: runnels cut along the
// slabs' joints, dry by day (sunken lanes 1 m down you can walk in, steps down into them here and there), and after dark
// filled with molten metal, printed bands of three hot tones marching out from the house to the moulds, lighting the
// floor round them. They all run back to the Casting-House's door: a leading line nobody set. By night you cross them by
// the iron footbridges and the plates over the aisle; step down into one and it burns and throws you out.
//
//   the furnace runnel   from the house up the east bay and round to Bertil's last furnace (its own runnel)
//   the long runnel      from the house down the east bay and across the forecourt to Hedda's mould on the apron
//   the west runnel      across the floor under the gantry to the cracked mould by the bowl garden
//
//   runnelAt(x, z)            the runnel a point is in (its index) or -1
//   floorHeight(base)         the ground with the runnels cut in it: (x, z) => height (the slabs 0, a runnel's bed -depth)
//   slabRects(x0, x1, z0, z1) the floor slab's rectangles there, the runnels left out
//   buildNightPour(ctx)       → { update(t, player), night(), molten, bridges, steps, lights, lines }
//
// Solid as drawn: the runnels' walls, their steps, the bridges, the spout and the cracked mould. Drawn only: the molten
// metal (lit by night only, the hazard holds it).
// ---------------------------------------------------------------------------

/** A runnel's width and depth (m); the molten metal's top under the floor by night (brimming); the slabs' paved area. */
export const RUNNEL = { w: 3, depth: 1, molten: 0.12 };
export const SLAB = { x0: -170, x1: 170, z0: -292, z1: 82 };
/** How far in from the slabs' edge (m) the drawn ground is sunk under them (a terrain cell and a little: no dip shows). */
export const SUNK = { depth: 1.6, margin: 8.6 };
/**
 * The runnels: [x, z] corners from the Casting-House out to their moulds, each leg along the slabs' grid (x or z).
 * (Kept clear of the gantry's legs, the cradles' drums, the pillars, the casting rails and the Casting-House's yard.)
 */
export const RUNNELS = [
  { name: 'the furnace runnel', to: 'the last furnace', pts: [[108, -148], [108, -117], [90, -117], [90, -45], [58, -45], [58, -22]] },
  { name: 'the long runnel', to: 'Hedda’s mould', pts: [[108, -140], [117, -140], [117, 54], [-15, 54], [-15, 62]] },
  { name: 'the west runnel', to: 'the cracked mould', pts: [[90, -108], [-66, -108]] },
];
/** Where the runnels are crossed: flush iron plates over the aisle, arched footbridges elsewhere ([x, z], across x or z). */
export const BRIDGES = [
  { at: [0, 54], across: 'z', kind: 'plate', w: 22 },
  { at: [0, -108], across: 'z', kind: 'plate', w: 22 },
  { at: [60, 54], across: 'z', kind: 'arch' },
  { at: [117, -20], across: 'x', kind: 'arch' },
  { at: [-40, -108], across: 'z', kind: 'arch' },
  { at: [42, -108], across: 'z', kind: 'arch' },
  { at: [58, -34], across: 'x', kind: 'arch' },
  { at: [90, -80], across: 'x', kind: 'arch' },
];
/** Steps down into a runnel, along one wall ([x, z] the foot of the flight, the side it stands against). */
export const STEPS = [
  { at: [40, 54], side: -1 }, { at: [117, -64], side: 1 }, { at: [-20, -108], side: 1 }, { at: [90, -60], side: -1 }, { at: [-50, -108], side: -1 },
];
/** The cracked mould at the west runnel's end, and Hedda's mould the long runnel spouts into (src/levels/moon-foundry.js APRON). */
export const CRACKED = { x: -71.4, z: -108, r: 3.4, h: 2.6 };

const hw = RUNNEL.w / 2;
/** Each leg of a runnel as an axis-aligned rectangle: { x0, x1, z0, z1, runnel, leg, along: 'x'|'z', a, b, s0 } (s0: m from the house). */
export const RECTS = (() => {
  const out = [];
  RUNNELS.forEach((r, k) => {
    let s = 0;
    for (let i = 1; i < r.pts.length; i++) {
      const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i], along = ax === bx ? 'z' : 'x';
      out.push({ x0: Math.min(ax, bx) - hw, x1: Math.max(ax, bx) + hw, z0: Math.min(az, bz) - hw, z1: Math.max(az, bz) + hw, runnel: k, leg: i - 1, along, a: [ax, az], b: [bx, bz], s0: s });
      s += Math.abs(bx - ax) + Math.abs(bz - az);
    }
  });
  return out;
})();
/** The runnel (its index in RUNNELS) a point is in, or -1. */
export function runnelAt(x, z) {
  for (const R of RECTS) if (x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1) return R.runnel;
  return -1;
}
/** Inside the slabs' paved area. */
export const onSlabs = (x, z) => x >= SLAB.x0 && x <= SLAB.x1 && z >= SLAB.z0 && z <= SLAB.z1;
/** The drawn ground sunk under the slabs, well in from their edge (the terrain's vertices; the slabs hide it). */
export const sunkUnder = (x, z) => x > SLAB.x0 + SUNK.margin && x < SLAB.x1 - SUNK.margin && z > SLAB.z0 + SUNK.margin && z < SLAB.z1 - SUNK.margin;
/** The ground walked on: the slabs level at 0 with the runnels cut 1 m into them; outside them the terrain (base). */
export function floorHeight(base) {
  return (x, z) => (onSlabs(x, z) ? (runnelAt(x, z) >= 0 && !onPlate(x, z) ? -RUNNEL.depth : 0) : base(x, z));
}
/** Over one of the flush plates (the aisle's crossings): floor, not runnel. */
export const onPlate = (x, z) => BRIDGES.some((B) => B.kind === 'plate' && (B.across === 'z' ? Math.abs(x - B.at[0]) < B.w / 2 && Math.abs(z - B.at[1]) < hw + 0.6 : Math.abs(z - B.at[1]) < B.w / 2 && Math.abs(x - B.at[0]) < hw + 0.6));
/**
 * A runnel's way from its mould back to the Casting-House: its corners reversed, and on along the runnel it joins (a
 * runnel that starts on another's leg) to that one's start by the house. [[x, z]…]
 */
export function toHouse(r) {
  const out = [...r.pts].reverse(), [jx, jz] = r.pts[0];
  for (const q of RUNNELS) {
    if (q === r) continue;
    for (let i = 1; i < q.pts.length; i++) {
      const [ax, az] = q.pts[i - 1], [bx, bz] = q.pts[i];
      const on = ax === bx ? jx === ax && jz >= Math.min(az, bz) && jz <= Math.max(az, bz) : jz === az && jx >= Math.min(ax, bx) && jx <= Math.max(ax, bx);
      if (on && !(jx === q.pts[0][0] && jz === q.pts[0][1])) return [...out, ...q.pts.slice(0, i).reverse()];
    }
  }
  return out;
}
/** A rectangle minus others (axis-aligned): the pieces left. */
function subtract([x0, x1, z0, z1], holes) {
  let parts = [[x0, x1, z0, z1]];
  for (const h of holes) {
    const next = [];
    for (const [a0, a1, b0, b1] of parts) {
      if (h.x1 <= a0 || h.x0 >= a1 || h.z1 <= b0 || h.z0 >= b1) { next.push([a0, a1, b0, b1]); continue; }
      const cx0 = Math.max(a0, h.x0), cx1 = Math.min(a1, h.x1);
      if (h.x0 > a0) next.push([a0, h.x0, b0, b1]);
      if (h.x1 < a1) next.push([h.x1, a1, b0, b1]);
      if (h.z0 > b0) next.push([cx0, cx1, b0, h.z0]);
      if (h.z1 < b1) next.push([cx0, cx1, h.z1, b1]);
    }
    parts = next;
  }
  return parts.filter(([a0, a1, b0, b1]) => a1 - a0 > 0.01 && b1 - b0 > 0.01);
}
/** The floor's slabs over [x0, x1] × [z0, z1] with the runnels left out: [[x0, x1, z0, z1]…]. */
export const slabRects = (x0, x1, z0, z1) => subtract([x0, x1, z0, z1], RECTS);
/** The runnels' walls: for each rectangle's side, the stretches no other rectangle covers: [{ x0, x1, z0, z1 } (a line), n: [nx, nz] (into the runnel)]. */
export function wallLines() {
  const out = [];
  for (const R of RECTS) {
    for (const [fixed, v, lo, hi, n] of [['x', R.x0, R.z0, R.z1, [1, 0]], ['x', R.x1, R.z0, R.z1, [-1, 0]], ['z', R.z0, R.x0, R.x1, [0, 1]], ['z', R.z1, R.x0, R.x1, [0, -1]]]) {
      let spans = [[lo, hi]];
      for (const Q of RECTS) {
        if (Q === R) continue;
        const [q0, q1, p0, p1] = fixed === 'x' ? [Q.x0, Q.x1, Q.z0, Q.z1] : [Q.z0, Q.z1, Q.x0, Q.x1];
        if (!(v > q0 + 1e-6 && v < q1 - 1e-6)) continue;   // (the side runs inside the other one: no wall there)
        const next = [];
        for (const [s0, s1] of spans) {
          if (p1 <= s0 || p0 >= s1) { next.push([s0, s1]); continue; }
          if (p0 > s0) next.push([s0, p0]);
          if (p1 < s1) next.push([p1, s1]);
        }
        spans = next;
      }
      for (const [s0, s1] of spans) if (s1 - s0 > 0.05) out.push(fixed === 'x' ? { x0: v, x1: v, z0: s0, z1: s1, n } : { x0: s0, x1: s1, z0: v, z1: v, n });
    }
  }
  return out;
}
/** How far along its runnel (m from the house) a point in a rectangle is. */
const along = (R, x, z) => R.s0 + (R.along === 'x' ? Math.abs(x - R.a[0]) : Math.abs(z - R.a[1]));
/** The pour's night: 0 by day, 1 once the sun is well down (the sky's own night, src/timeofday.js uNight). */
export const pourK = (uNight) => smoothstep(0.25, 0.75, uNight);

/**
 * The runnels, built into the foundry's cells. ctx: { put, scene, noShadow, lights, T, V }.
 * Returns { update(t, player), night, molten, lights, bridges, steps, lines, hazard }.
 */
export function buildNightPour({ put, scene, noShadow, lights, T, V }) {
  const D = RUNNEL.depth;
  // the beds: dark scorched iron 1 m down; the walls: the slabs' cut faces, solid (a step up out of a runnel is a wall,
  // not a slope). (Both in the foundry's metal, merged per cell with the machinery's: no draw of their own)
  for (const R of RECTS) {
    const w = R.x1 - R.x0, d = R.z1 - R.z0, cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    put(cx, cz, { gDark: [new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2).translate(cx, -D + 0.01, cz)] });
  }
  for (const L of wallLines()) {
    const t = 0.35, len = Math.max(L.x1 - L.x0, L.z1 - L.z0), cx = (L.x0 + L.x1) / 2 - L.n[0] * t / 2, cz = (L.z0 + L.z1) / 2 - L.n[1] * t / 2;
    const g = L.x0 === L.x1 ? new THREE.BoxGeometry(t, D, len) : new THREE.BoxGeometry(len, D, t);
    put(cx, cz, { wall2: [g.translate(cx, -D / 2, cz)] });
  }
  // steps down into them along a wall: four treads, 0.2 m each, the last a step over the bed
  const steps = [];
  for (const S of STEPS) {
    const R = RECTS.find((q) => S.at[0] >= q.x0 && S.at[0] <= q.x1 && S.at[1] >= q.z0 && S.at[1] <= q.z1);
    if (!R) continue;
    const wide = 1.1, tread = 0.6, parts = [];
    for (let i = 0; i < 4; i++) {
      const top = -0.2 * (i + 1), u = (i + 0.5) * tread;
      if (R.along === 'x') parts.push(new THREE.BoxGeometry(tread, top + D, wide).translate(S.at[0] + u, (top - D) / 2, (S.side < 0 ? R.z0 : R.z1) - S.side * wide / 2));
      else parts.push(new THREE.BoxGeometry(wide, top + D, tread).translate((S.side < 0 ? R.x0 : R.x1) - S.side * wide / 2, (top - D) / 2, S.at[1] + u));
    }
    put(S.at[0], S.at[1], { gDark: parts });
    steps.push({ at: V(S.at[0], 0, S.at[1]), runnel: R.runnel });
  }
  // the bridges: flush plates over the aisle (the crowd walks straight over), arched iron footbridges with handrails
  const bridges = [];
  for (const B of BRIDGES) {
    const [x, z] = B.at, acrossX = B.across === 'x';
    if (B.kind === 'plate') {
      const w = B.w, len = RUNNEL.w + 1.2, g = acrossX ? new THREE.BoxGeometry(len, 0.14, w) : new THREE.BoxGeometry(w, 0.14, len);
      put(x, z, { rust: [g.translate(x, 0.0, z)] }, { tones: { rust: 'roofing' } });
      // rivets along its edges (drawn), and a lamp post at each end over the aisle's lines
      bridges.push({ at: V(x, 0.07, z), kind: 'plate', across: B.across, w });
      continue;
    }
    // an arch: a deck of short planks over a curve 0.7 m high at its middle, 1.8 wide, stringers, a rail each side
    const span = RUNNEL.w + 3.2, rise = 0.7, n = 12, w = 1.8, deck = [], frame = [];
    const P = (u, e = 0) => { const s = (u - 0.5) * span, y = rise * (1 - (2 * u - 1) ** 2); return acrossX ? V(x + s, y, z + e) : V(x + e, y, z + s); };
    for (let i = 0; i < n; i++) {
      const a = P(i / n), b = P((i + 1) / n), dir = b.clone().sub(a), L = dir.length();
      const g = new THREE.BoxGeometry(acrossX ? L * 1.04 : w, 0.12, acrossX ? w : L * 1.04);
      const m = new THREE.Matrix4().makeRotationAxis(acrossX ? V(0, 0, 1) : V(1, 0, 0), acrossX ? Math.atan2(dir.y, dir.x) : -Math.atan2(dir.y, dir.z));
      deck.push(g.applyMatrix4(m).translate((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.06, (a.z + b.z) / 2));
    }
    for (const e of [-1, 1]) {
      // (the stringer and the handrail along the curve in four pieces, a post at each joint)
      for (let i = 0; i < 4; i++) {
        const a = P(i / 4, e * (w / 2 - 0.05)), b = P((i + 1) / 4, e * (w / 2 - 0.05));
        frame.push(bar(V, a.clone().add(V(0, -0.22, 0)), b.clone().add(V(0, -0.22, 0)), 0.09), bar(V, a.clone().add(V(0, 0.95, 0)), b.clone().add(V(0, 0.95, 0)), 0.04), bar(V, a, a.clone().add(V(0, 0.95, 0)), 0.035));
      }
      const last = P(1, e * (w / 2 - 0.05)); frame.push(bar(V, last, last.clone().add(V(0, 0.95, 0)), 0.035));
      // its feet on the slabs either side
      for (const u of [0.02, 0.98]) { const p = P(u, e * (w / 2 - 0.1)); frame.push(new THREE.BoxGeometry(0.3, 0.3, 0.3).translate(p.x, 0.12, p.z)); }
    }
    put(x, z, { plank: deck, gDark: frame });
    bridges.push({ at: P(0.5).add(V(0, 0.02, 0)), kind: 'arch', across: B.across, w, ends: [P(0), P(1)] });
  }
  // the spout into Hedda's mould (an iron trough from the long runnel's end up over the mould's rim), the cracked mould
  const spouts = [];
  {
    const end = RUNNELS[1].pts.at(-1), a = V(end[0], -0.4, end[1] + hw), b = V(end[0], 2.35, end[1] + hw + 4.6);
    const dir = b.clone().sub(a), L = dir.length(), m = new THREE.Matrix4().makeRotationAxis(V(1, 0, 0), -Math.atan2(dir.y, dir.z));
    const mid = a.clone().lerp(b, 0.5);
    put(end[0], end[1], { rust: [new THREE.BoxGeometry(1.6, 0.16, L).applyMatrix4(m).translate(mid.x, mid.y, mid.z), ...[-1, 1].map((e) => new THREE.BoxGeometry(0.14, 0.55, L).applyMatrix4(m).translate(mid.x + e * 0.75, mid.y + 0.25, mid.z))],
      dark: [new THREE.BoxGeometry(0.3, 1.6, 0.3).translate(end[0] - 0.6, 0.4, mid.z), new THREE.BoxGeometry(0.3, 1.6, 0.3).translate(end[0] + 0.6, 0.4, mid.z)] }, { tones: { rust: 'rust3' } });
    spouts.push({ a, b, m, L, mid });
  }
  {
    const { x, z, r, h } = CRACKED;
    // a thick ivory drum of a mould, split down one side, an iron band round its foot; its notch toward the runnel
    const shellA = new THREE.CylinderGeometry(r, r * 1.08, h, 16, 1, true, Math.PI / 2 + 0.35, Math.PI * 2 - 0.7).translate(x, h / 2, z);
    const inner = flip(new THREE.CylinderGeometry(r - 0.5, r - 0.45, h, 16, 1, true, Math.PI / 2 + 0.35, Math.PI * 2 - 0.7).translate(x, h / 2, z));
    const rim = new THREE.RingGeometry(r - 0.5, r, 16, 1, 0.35, Math.PI * 2 - 0.7).rotateX(-Math.PI / 2).translate(x, h, z);
    put(x, z, { shell: [shellA, rim, inner], rust2: [new THREE.CylinderGeometry(r * 1.12, r * 1.16, 0.5, 16).translate(x, 0.25, z), new THREE.CylinderGeometry(r * 1.1, r * 1.1, 0.25, 16).translate(x, h * 0.62, z)], dark: [new THREE.CylinderGeometry(r - 0.5, r - 0.5, 0.2, 16).translate(x, 0.55, z)] }, { tones: { shell: 'ivory2' } });
  }

  // the molten metal: one sheet over every runnel 0.5 m under the floor, coloured per vertex in three hot tones (the
  // last furnace's pour's: printed bands marching out from the house, not a light), drawn only by night
  const pos = [], idx = [], s = [];
  for (const R of RECTS) {
    const len = R.along === 'x' ? R.x1 - R.x0 : R.z1 - R.z0, n = Math.max(1, Math.round(len / 1.6)), base = pos.length / 3;
    for (let i = 0; i <= n; i++) for (const e of [0, 1]) {
      const u = i / n, px = R.along === 'x' ? R.x0 + (R.x1 - R.x0) * u : (e ? R.x1 : R.x0), pz = R.along === 'x' ? (e ? R.z1 : R.z0) : R.z0 + (R.z1 - R.z0) * u;
      pos.push(px, -RUNNEL.molten, pz);
      s.push(along(R, px, pz) + e * 0.7);
    }
    for (let i = 0; i < n; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const cols = new Float32Array(pos.length).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const molten = new THREE.Mesh(geo, makeMaterial({ color: '#ffffff', glow: 0.95, flat: true, vertexColors: true, spot: 0, side: THREE.DoubleSide }));
  molten.name = 'The night pour (the molten runnels)'; molten.userData.noCollide = true; molten.visible = false;
  scene.add(molten); noShadow.push(molten);
  // the metal in the spout and in the cracked mould's crack, by night
  const S0 = spouts[0], { x: cx, z: cz, r: cr, h: ch } = CRACKED;
  const hotBits = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(1.3, 0.05, S0.L).applyMatrix4(S0.m).translate(S0.mid.x, S0.mid.y + 0.1, S0.mid.z),
    new THREE.CircleGeometry(cr - 0.55, 20).rotateX(-Math.PI / 2).translate(cx, ch * 0.8, cz),
    new THREE.PlaneGeometry(0.7, ch * 0.9).rotateY(Math.PI / 2).translate(cx + cr + 0.02, ch * 0.45, cz),
  ].map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; })), makeMaterial({ color: T.molten, glow: 0.95, flat: true, side: THREE.DoubleSide }));
  hotBits.name = 'The night pour (the spout and the cracked mould)'; hotBits.userData.noCollide = true; hotBits.visible = false;
  scene.add(hotBits); noShadow.push(hotBits);
  // the floor round them lit by the pour: a light every 26 m along each runnel, out by day
  const own = [];
  for (const R of RECTS) {
    const len = R.along === 'x' ? R.x1 - R.x0 : R.z1 - R.z0;
    for (let u = 6; u < len - 2; u += 26) { const p = R.along === 'x' ? [R.x0 + u, (R.z0 + R.z1) / 2] : [(R.x0 + R.x1) / 2, R.z0 + u]; const l = new THREE.Vector4(p[0], 0.3, p[1], 0); own.push(l); lights.push(l); }
  }
  const tones = [T.molten3, T.molten, T.molten2].map((c) => new THREE.Color(c));
  let k = 0;
  const night = () => pourK(sharedUniforms.uNight?.value ?? 0);
  const recolour = (t) => {
    const band = 2.6;
    for (let i = 0; i < s.length; i++) { const c = tones[((Math.floor((s[i] - t * 1.6) / band) % 3) + 3) % 3]; cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    geo.attributes.color.needsUpdate = true;
  };
  // (in a runnel, under the floor, by night: it burns, and throws you up and out to its nearer wall)
  const hot = (p) => k > 0.5 && p.y < -0.2 && p.y > -D - 0.6 && runnelAt(p.x, p.z) >= 0 && !onPlate(p.x, p.z);
  const outward = (p, out) => {
    const R = RECTS.find((q) => p.x > q.x0 && p.x < q.x1 && p.z > q.z0 && p.z < q.z1);
    if (!R) return null;
    return R.along === 'x' ? out.set(0, 0, p.z < (R.z0 + R.z1) / 2 ? -1 : 1) : out.set(p.x < (R.x0 + R.x1) / 2 ? -1 : 1, 0, 0);
  };
  const hazard = { kind: 'fire', dps: HAZARD_DPS.fire, test: hot, push: outward };
  const offHazard = registerHazard(hazard);
  const _o = new THREE.Vector3();
  return {
    molten, hotBits, lights: own, bridges, steps, hazard, offHazard,
    /** How far the pour is on (0 by day, 1 by night). */
    get k() { return k; },
    /** (tests) the pour on or off whatever the hour */
    force: null,
    /** Once a frame: on with the night, its bands moving; a traveller in a burning runnel thrown out. */
    update(t, player) {
      k = this.force ?? night();
      const on = k > 0.02;
      molten.visible = on; hotBits.visible = on;
      for (const l of own) l.w = on ? 10 * k : 0;
      if (on) recolour(t);
      const p = player?.pos;
      if (p && hot(p) && player.onGround && outward(p, _o)) { player.vel.y = Math.max(player.vel.y, 9.5); player.vel.x = _o.x * 4; player.vel.z = _o.z * 4; }
    },
    /** The runnels as the level design audit's leading lines: each from its mould back to the Casting-House. */
    lines: RUNNELS.map((r) => ({ name: r.name, points: toHouse(r).map(([x, z]) => [x, 0, z]) })),
  };
}

/** The same faces wound the other way (seen from inside). */
function flip(g) {
  const I = g.index.array;
  for (let t = 0; t < I.length; t += 3) { const a = I[t]; I[t] = I[t + 2]; I[t + 2] = a; }
  g.computeVertexNormals();
  return g;
}
/** A thin box from a to b (r its half width). */
function bar(V, a, b, r) {
  const d = b.clone().sub(a), L = d.length(), g = new THREE.BoxGeometry(r * 2, r * 2, L);
  g.applyMatrix4(new THREE.Matrix4().lookAt(V(0, 0, 0), d.normalize(), Math.abs(d.y) > 0.98 ? V(1, 0, 0) : V(0, 1, 0)));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}
