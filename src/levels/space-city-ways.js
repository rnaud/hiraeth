import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { island, quarter, bridge, lantern, laundry, crownTree, pipeStack, spaceMats, resident, house, HANG_PX } from './space-city-kit.js';
import { helix, ribbon, bar } from '../lorn-kit.js';
import { thinBar } from '../thin.js';
import { RoomKit } from './lab-kit.js';

// ---------------------------------------------------------------------------
// The City Floating in Space: one way through its three explorations (issue #194, the author's picks of #170:
// references/levels/The City Floating in Space/environment/explorations/; docs/design/level-explorations-2-prompts.md).
// Built last in src/levels/space-city.js, with dice of its own, so the city's islands keep their houses.
//
//   under the islands   the moorers' stair winds down off the Towers' north edge to a catwalk hung under the deck, among
//                       the machinery: the anchor, where the great cable leaves its bronze clamp (the main quest's hand on
//                       the cables, `ANCHOR`), workshops with lit round windows, gardens hung upside down, lamps pointing
//                       at the stars below. From the anchor a walkway runs out along the cable over the void to the stack.
//   the stacked quarters  the stack (`STACK`, `TIERS`): seven small islands one over another between the Towers and the
//                       Moorings, 8 m under the Towers' deck to 80 m over it, houses round each; a stair winds round the
//                       outside of the stack from each to the next (`STAIRS`, ~25°). The way to the Moorings goes up it
//                       (the underhouses, the lower stack, the capstan quarter); its top is the city's other high place.
//                       The way home is down its other side (`h21`) and over the stack bridge to the Towers.
//   the drifting bridges  from the capstan quarter a broken bridge crosses to the Moorings: its middle span, a little
//                       island of its own (`DRIFT`), has drifted out of line, and the moorers' capstan reels it home
//                       (src/story/spacecity.js: A / × at the capstan). The stack bridge from the Towers is stretched and
//                       patched; past the capstan quarter an old bridge hangs in two halves.
// Solid as drawn where walked: decks, parapets, stairs, catwalks, the walkway, their rails, the houses, the capstan.
// Drawn only: the machinery and gardens under the islands, the cables, hangers and lamps.
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SOLID = { solid: true, shadow: true }, NC = { solid: false, shadow: false };

/** The stack's middle (every tier round it), its stairs' pitch (rad) and half-width (m). */
export const STACK = { x: 84, z: -128, slope: 0.44, hw: 1.5 };   // (hw: the stairs' half-width)
/** The tiers, bottom to top: deck height, radius (each a round island), its houses. */
export const TIERS = {
  s0: { y: -8, r: 9.5, name: 'the underhouses', houses: 7, tall: [3, 3.6] },
  s1: { y: 4, r: 12, name: 'the lower stack', houses: 14, tall: [3.2, 4] },
  s2: { y: 18, r: 11, name: 'the capstan quarter', houses: 11, tall: [3.4, 4.6] },
  s3: { y: 34, r: 10, name: 'the roof street', houses: 11, tall: [3.4, 4.8] },
  s4: { y: 50, r: 9, name: 'the high lanes', houses: 9, tall: [3.4, 4.6] },
  s5: { y: 66, r: 8, name: 'the washing tier', houses: 7, tall: [3.2, 4.2] },
  s6: { y: 80, r: 6, name: 'the stack’s top', houses: 0, tall: [3, 3] },
};
/** The stairs round the stack: from tier `lo` at angle a0 (rad; 0 east, π/2 south) the way round `dir`, up to tier `hi`. */
export const STAIRS = [
  { id: 'h01', lo: 's0', hi: 's1', a0: 2.2, dir: 1 },
  { id: 'h12', lo: 's1', hi: 's2', a0: 4.6, dir: 1 },
  { id: 'h21', lo: 's1', hi: 's2', a0: 2.9, dir: -1, home: true },   // (the other side: the way home)
  { id: 'h23', lo: 's2', hi: 's3', a0: 3.2, dir: 1 },
  { id: 'h34', lo: 's3', hi: 's4', a0: 6.0, dir: 1 },
  { id: 'h45', lo: 's4', hi: 's5', a0: 2.7, dir: 1 },
  { id: 'h56', lo: 's5', hi: 's6', a0: 5.9, dir: 1 },
];
/** A stair's own numbers: its radius (outside both tiers), the turn it makes, where it ends. */
export function stairOf(S) {
  const lo = TIERS[S.lo], hi = TIERS[S.hi], R = Math.max(lo.r, hi.r) + 3, rise = hi.y - lo.y;
  const A = rise / (R * Math.tan(STACK.slope)), land = 2.4 / R, a1 = S.a0 + S.dir * A;
  // (a flat landing 2.4 m long past each end, its pad in from its middle: p0 at the foot, p1 at the top)
  return { ...S, R, rise, A, a1, y0: lo.y, y1: hi.y, land, p0: S.a0 - S.dir * land / 2, p1: a1 + S.dir * land / 2 };
}
/** A point on a tier's ring: angle a, d m from the stack's middle, at the tier's deck. */
export const ringAt = (tier, a, d) => V(STACK.x + Math.cos(a) * d, TIERS[tier].y, STACK.z + Math.sin(a) * d);

/** The Towers' stair down (its middle north of the edge, out over the void), the anchor's catwalk under the deck. */
export const UNDER = {
  deck: 6, y: -2.2,   // (the Towers' deck; the catwalk's, under the deck's machinery and over the void)
  stair: { x: 101, z: -110.9, ri: 2.4, ro: 4.8 },
  platform: { x0: 96, x1: 106.5, z: -100.8, w: 2.6 },
  // the walkway out along the great cable to the stack's foot (the underhouses' port at `port`)
  port: 0.9,
};
/** The moorers' stair-lamp: the stair's iron mast carried on up over the Towers' deck, its lamp this high (v1.60, #233). */
export const STAIR_LAMP = { x: UNDER.stair.x, y: UNDER.deck + 32, z: UNDER.stair.z };
/** Where you lay a hand on the great cable (the main quest's `towerCables`): on the catwalk under its clamp, where the
 *  walkway leaves along it for the stack. */
export const ANCHOR = { x: UNDER.platform.x0 + 2.4, y: UNDER.y, z: UNDER.platform.z };
/** The broken bridge from the capstan quarter to the Moorings: its ends (decks, 1.5 m in), its middle span's drift. */
export const DRIFT = { a: null, b: [96, 14, -155.5], span: [7, 13.5], mid: 16.4, out: 7.5, sink: 2, secs: 6 };
{
  const dx = DRIFT.b[0] - STACK.x, dz = DRIFT.b[2] - STACK.z, a = Math.atan2(dz, dx), r = TIERS.s2.r - 1.5;
  DRIFT.angle = a;
  DRIFT.a = [STACK.x + Math.cos(a) * r, TIERS.s2.y, STACK.z + Math.sin(a) * r];
}
/** The capstan on the capstan quarter, beside the broken bridge's mouth. */
export const CAPSTAN = (() => { const a = DRIFT.angle + 0.55, d = 6.6; return { x: STACK.x + Math.cos(a) * d, y: TIERS.s2.y, z: STACK.z + Math.sin(a) * d }; })();
/** The old bridge that parted, off the capstan quarter's west side: its angle, how far its half reaches, the gap, the drifted islet. */
export const PARTED = { angle: 2.5, reach: 18.5, gap: 6.5, far: 40 };
/** The stack bridge: from the Towers' north edge (where the Moorings bridge left from) to the lower stack. */
export const STACK_BRIDGE = (() => {
  const a = [94.5, 6, -103.5], dx = a[0] - STACK.x, dz = a[2] - STACK.z, ang = Math.atan2(dz, dx), r = TIERS.s1.r - 1.5;
  return { name: 'the stack bridge', a, b: [STACK.x + Math.cos(ang) * r, TIERS.s1.y, STACK.z + Math.sin(ang) * r], w: 4.2, hump: 0.3, end: 3, mid: 1, angle: ang, patched: true };
})();
/** Where the islands' parapets are open besides the bridges' ends: the Towers' stair, the Moorings' end of the broken bridge (local [x, z, r]). */
export const OPENINGS = {
  towers: [[UNDER.stair.x - 98, -20.6, 1.9]],
  moorings: [[DRIFT.b[0] - 96, DRIFT.b[2] + 176, 3.7]],
};

/** The catwalks' and the stairs' room, kept clear of what hangs under the islands: [a, b, half-width] at their deck heights. */
export function corridors() {
  const out = [];
  const st = UNDER.stair, P = UNDER.platform;
  // the Towers' stair (a ring round its middle) and the catwalk from its foot to the platform, the platform, the walkway
  out.push({ ring: [st.x, st.z, st.ro + 0.4], y0: UNDER.y, y1: UNDER.deck + 2.4 });
  const foot = stairFoot();
  out.push({ seg: [[foot.x, foot.z], [P.x1 - 2.4, P.z - 0.4]], hw: 1.6, y0: UNDER.y, y1: UNDER.y + 2.4 });
  out.push({ seg: [[P.x0, P.z], [P.x1, P.z]], hw: P.w / 2 + 0.6, y0: UNDER.y, y1: UNDER.y + 2.4 });
  const W = walkway();
  out.push({ seg: [[W[0].x, W[0].z], [W[1].x, W[1].z]], hw: 1.6, y0: W[1].y, y1: W[0].y + 3 });
  // round the stack: every stair's ring
  for (const S of STAIRS.map(stairOf)) out.push({ ring: [STACK.x, STACK.z, S.R + STACK.hw + 0.5], inner: S.R - STACK.hw - 0.5, y0: S.y0, y1: S.y1 + 2.4 });
  return out;
}
/** Is a hanging thing at (x, z), r round, from y0 to y1, in a corridor's room? (island()'s `clear`) */
export function inCorridor(list, x, y0, y1, z, r = 0) {
  for (const c of list) {
    if (y1 < c.y0 - 0.3 || y0 > c.y1) continue;
    if (c.ring) { const d = Math.hypot(x - c.ring[0], z - c.ring[1]); if (d < c.ring[2] + r && d > (c.inner ?? -1) - r) return true; continue; }
    const [[ax, az], [bx, bz]] = c.seg, dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < c.hw + r) return true;
  }
  return false;
}
/** The Towers' stair: { geo, at, a0, a1 … } (top at the deck's edge, its foot on the catwalk). */
export function towersStair() {
  const st = UNDER.stair, rm = (st.ri + st.ro) / 2, A = (UNDER.deck - UNDER.y) / (rm * Math.tan(STACK.slope));
  return helix({ cx: st.x, cz: st.z, ri: st.ri, ro: st.ro, y0: UNDER.y, y1: UNDER.deck, a0: Math.PI / 2 + A, dir: -1, slope: STACK.slope });
}
const stairFoot = () => towersStair().at(towersStair().a0);
/** The walkway out along the great cable: from the platform's west end down to the underhouses' port (Vector3s, its deck). */
export function walkway() {
  const P = UNDER.platform, end = ringAt('s0', UNDER.port, TIERS.s0.r - 1.0);
  return [V(P.x0 + 0.6, UNDER.y, P.z), end];
}

// ------------------------------------------------------------------ the builders
/** A rail along pts (Vector3s: the deck under it), h high: a top bar and a mid bar, posts every `post` m. Solid as drawn. */
function rail(kit, mat, pts, { h = 1.05, post = 1.7, r = 0.055 } = {}) {
  let run = post;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    kit.add(mat, bar(a.clone().setY(a.y + h), b.clone().setY(b.y + h), r, 5), SOLID);
    kit.add(mat, bar(a.clone().setY(a.y + h * 0.5), b.clone().setY(b.y + h * 0.5), r * 0.7, 4), NC);
    if (run >= post) { run = 0; kit.add(mat, new THREE.BoxGeometry(0.09, h, 0.09).translate(a.x, a.y + h / 2, a.z), SOLID); }
    run += Math.hypot(b.x - a.x, b.z - a.z);
  }
  const e = pts.at(-1);
  kit.add(mat, new THREE.BoxGeometry(0.09, h, 0.09).translate(e.x, e.y + h / 2, e.z), SOLID);
}
/** Both edges of a walkway along pts, w wide (the side offset level across). */
function edges(pts, w) {
  const L = [], R = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], s = V(b.z - a.z, 0, -(b.x - a.x)).normalize().multiplyScalar(w / 2);
    L.push(p.clone().add(s)); R.push(p.clone().sub(s));
  });
  return [L, R];
}
/** A sloped catwalk from a to b (Vector3s), w wide: a deck of planks on an iron frame, rails both sides. */
function catwalk(kit, M, pts, w = 1.9, { rails = [true, true], from = 0, to = 0 } = {}) {
  kit.add(M.wood, ribbon(pts, w, 0.2), SOLID);
  kit.add(M.iron, ribbon(pts.map((p) => p.clone().setY(p.y - 0.2)), w + 0.2, 0.18), SOLID);
  // (the rails from `from` m in to `to` m short of the end: where it opens onto a platform or a deck)
  const L0 = pts.reduce((s, p, i) => s + (i ? p.distanceTo(pts[i - 1]) : 0), 0), keep = [];
  let run = 0;
  pts.forEach((p, i) => { run += i ? p.distanceTo(pts[i - 1]) : 0; if (run >= from - 1e-6 && run <= L0 - to + 1e-6) keep.push(p); });
  if (keep.length < 2) return;
  const [L, R] = edges(keep, w - 0.15);
  if (rails[0]) rail(kit, M.rail, L);
  if (rails[1]) rail(kit, M.rail, R);
}
const lerpPts = (a, b, step = 1.2) => { const n = Math.max(1, Math.ceil(a.distanceTo(b) / step)); return Array.from({ length: n + 1 }, (_, i) => a.clone().lerp(b, i / n)); };
/** A lamp hung under a deck, pointing down at the stars: a shade, its bulb, its cord up to (x, top, z). */
function downLamp(kit, M, x, y, z, top) {
  if (top - y > 0.3) kit.add(M.cable, thinBar(bar(V(x, y + 0.3, z), V(x, top, z), 0.025, 3), V(x, y + 0.3, z), V(x, top, z)), NC);
  kit.add(M.iron, new THREE.ConeGeometry(0.36, 0.42, 8, 1, true).translate(x, y + 0.12, z), NC);
  kit.add(M.lamp, new THREE.SphereGeometry(0.17, 8, 6).translate(x, y - 0.05, z), NC);
  kit.light(x, y - 0.4, z, 8);
}
/** A garden hung upside down: a bowl of earth under a deck, flowers round its rim, vines trailing into the void. */
function hungGarden(kit, M, rng, x, top, z, { s = 1, vines = 7, cord = 1.4 } = {}) {
  const y = top - cord;
  for (const e of [-1, 1]) kit.add(M.cable, thinBar(bar(V(x + e * 0.7 * s, y + 0.4, z), V(x + e * 0.4 * s, top, z), 0.02, 3), V(x + e * 0.7 * s, y + 0.4, z), V(x + e * 0.4 * s, top, z)), NC);
  kit.add(M.pot, new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.05 * s, 0.9 * s, 1.05 * s).translate(x, y + 0.4, z), NC);
  kit.add(kit.pick(M.flower), new THREE.TorusGeometry(0.95 * s, 0.22 * s, 5, 12).rotateX(Math.PI / 2).translate(x, y + 0.45, z), NC);
  for (let i = 0; i < vines; i++) {
    const a = rng() * Math.PI * 2, d = (0.4 + rng() * 0.55) * s, L = 2 + rng() * 6 * s, vx = x + Math.cos(a) * d, vz = z + Math.sin(a) * d;
    const A = V(vx, y + 0.1, vz), B = V(vx + (rng() - 0.5) * 0.4, y - L, vz + (rng() - 0.5) * 0.4);
    kit.add(M.vine, thinBar(bar(A, B, 0.04, 3), A, B), NC);
    if (rng() < 0.6) kit.add(kit.pick(M.flower), new THREE.IcosahedronGeometry(0.16 + rng() * 0.12, 0).translate(B.x, B.y + 0.1, B.z), NC);
  }
}
/** A moorers' workshop hung under a deck: a drum, round lit windows, a door onto the catwalk. */
function workshop(kit, M, rng, x, y, z, { r = 1.8, h = 2.8, face = 0, top = null } = {}) {
  kit.add(kit.pick(M.lime), new THREE.CylinderGeometry(r, r * 0.92, h, 14).translate(x, y + h / 2, z), NC);
  kit.add(M.under2, new THREE.ConeGeometry(r * 0.95, 1.4, 14).rotateX(Math.PI).translate(x, y - 0.7, z), NC);
  kit.add(M.rail, new THREE.TorusGeometry(r * 1.02, 0.08, 4, 18).rotateX(Math.PI / 2).translate(x, y + h - 0.2, z), NC);
  for (let i = 0; i < 3; i++) {
    const a = face + (i - 1) * 0.9 + (rng() - 0.5) * 0.2, wx = x + Math.cos(a) * (r + 0.02), wz = z + Math.sin(a) * (r + 0.02);
    kit.add(M.lit, new THREE.CircleGeometry(0.34, 12).rotateY(Math.PI / 2 - a).translate(wx, y + h * 0.58, wz), NC);
    kit.add(M.iron, new THREE.TorusGeometry(0.36, 0.05, 4, 12).rotateY(Math.PI / 2 - a).translate(wx, y + h * 0.58, wz), NC);
  }
  if (top != null && top > y + h) kit.add(M.pipe, new THREE.CylinderGeometry(0.22, 0.22, top - y - h, 6).translate(x, (top + y + h) / 2, z), NC);
  kit.light(x + Math.cos(face) * (r + 0.6), y + h * 0.58, z + Math.sin(face) * (r + 0.6), 6);
}
/** The great cable (drawn): a heavy sagging rope a → b, its strands. */
function greatCable(kit, M, a, b, { sag = 0.8, r = 0.22 } = {}) {
  const pts = Array.from({ length: 13 }, (_, i) => { const t = i / 12; return a.clone().lerp(b, t).add(V(0, -Math.sin(Math.PI * t) * sag, 0)); });
  kit.add(M.cableFar, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6, false), NC);
  return pts;
}

/** The world's materials (spaceMats) and a few of the ways' own: bronze, vines, the capstan's wood. */
function waysMats(kit) {
  const M = spaceMats(kit);
  M.bronze = kit.mat({ color: '#c08a44', flat: true, metal: true, line: 0.6 });
  M.vine = kit.mat({ color: '#6e8a52', flat: true, thin: HANG_PX, line: 0.45 });
  M.plank = kit.mat({ color: '#9a6a4a', flat: true, grid: 0.9 });
  return M;
}

/**
 * Builds the three explorations into `root` (the city's group). `kitFor(name, seed)` makes a kit (as the city's), so they
 * finish and cull with the rest. Returns what the level and the story read: the ways' points, the drift, the sights.
 */
export function buildCityWays(root, kitFor, { islands, physicsInit }) {
  const rng = mulberry32(72400);
  const out = { sights: [], lights: [], tiers: {}, stairs: {}, npcs: [] };

  // ---------------------------------------------------------- under the Towers: the stair, the catwalk, the anchor
  {
    const kit = kitFor('the anchor under the Towers', 72410), M = waysMats(kit), U = UNDER, P = U.platform;
    const st = towersStair();
    kit.add(M.bridge, st.geo, SOLID);
    // its rails: the outer edge, and the inner round the iron column it winds on
    // (the outer rail stops short of the top, where the pad leaves the stair outward for the deck)
    const ring = (r, cut = 0) => { const pts = [], a1 = st.a1 + (st.a0 > st.a1 ? cut : -cut); for (let k = 0; k <= 80; k++) { const a = st.a0 + (a1 - st.a0) * (k / 80), p = st.at(a); pts.push(V(st.cx + Math.cos(a) * r, p.y, st.cz + Math.sin(a) * r)); } return pts; };
    rail(kit, M.rail, ring(st.ro - 0.12, 1.6 / st.ro));
    rail(kit, M.rail, ring(st.ri + 0.12));
    // (the iron mast it winds round, its spokes out to the ramp's inner edge)
    kit.add(M.rail, new THREE.CylinderGeometry(0.45, 0.55, U.deck - U.y + 6, 10).translate(st.cx, (U.deck + U.y) / 2 - 1, st.cz), SOLID);
    // (v1.60, issue #233: and on up over the Towers' edge, the moorers' stair-lamp: a lit head to the way down, seen from
    // the Towers bridge and the Market as the Balcony's mast is; a yard across it with a lamp hung from each end)
    {
      const y0 = U.deck + 2, top = STAIR_LAMP.y, h = top - y0;
      kit.add(M.rail, new THREE.CylinderGeometry(0.3, 0.48, h, 8).translate(st.cx, y0 + h / 2, st.cz), SOLID);
      kit.add(M.iron, new THREE.BoxGeometry(4.2, 0.16, 0.16).translate(st.cx, top - 2.2, st.cz), NC);
      for (const e of [-1, 1]) { kit.add(M.hang, new THREE.CylinderGeometry(0.02, 0.02, 1.0, 3).translate(st.cx + e * 2, top - 2.7, st.cz), NC); lantern(kit, M, st.cx + e * 2, top - 3.6, st.cz, { kind: 'globe', s: 1.4, light: false }); }
      kit.add(M.iron, new THREE.CylinderGeometry(0.5, 0.5, 0.14, 10).translate(st.cx, top - 0.5, st.cz), NC);
      kit.add(M.lamp, new THREE.SphereGeometry(0.75, 12, 8).scale(1, 1.2, 1).translate(st.cx, top + 0.25, st.cz), NC);
      kit.add(M.iron, new THREE.ConeGeometry(0.6, 0.5, 8).translate(st.cx, top + 1.3, st.cz), NC);
      kit.light(st.cx, top + 0.25, st.cz, 16);
    }
    for (let k = 0; k <= 12; k++) { const a = st.a0 + (st.a1 - st.a0) * (k / 12), p = st.at(a), e = V(st.cx + Math.cos(a) * st.ri, p.y - 0.3, st.cz + Math.sin(a) * st.ri); kit.add(M.iron, bar(V(st.cx, p.y - 0.9, st.cz), e, 0.07, 4), NC); }
    // the pad from its top onto the deck, through the parapet's opening
    const top = st.at(st.a1), into = V(top.x, U.deck, -103.0);
    kit.add(M.bridge, ribbon([top.clone().setY(U.deck), into], 2.4, 0.4), SOLID);
    // the catwalk from its foot under the deck's edge to the platform, the platform along under the deck
    const foot = st.at(st.a0), toP = V(P.x1 - 2.4, U.y, P.z - 0.4);
    catwalk(kit, M, lerpPts(foot, toP), 2, { to: 1.6 });
    kit.add(M.wood, new THREE.BoxGeometry(P.x1 - P.x0, 0.2, P.w).translate((P.x0 + P.x1) / 2, U.y - 0.1, P.z), SOLID);
    kit.add(M.iron, new THREE.BoxGeometry(P.x1 - P.x0 + 0.2, 0.18, P.w + 0.2).translate((P.x0 + P.x1) / 2, U.y - 0.29, P.z), SOLID);
    rail(kit, M.rail, lerpPts(V(P.x0, U.y, P.z + P.w / 2 - 0.08), V(P.x1, U.y, P.z + P.w / 2 - 0.08)));
    rail(kit, M.rail, lerpPts(V(P.x1 - 0.08, U.y, P.z + P.w / 2), V(P.x1 - 0.08, U.y, P.z - P.w / 2)));
    rail(kit, M.rail, lerpPts(V(P.x0 + 2.4, U.y, P.z - P.w / 2 + 0.08), V(toP.x - 1.1, U.y, P.z - P.w / 2 + 0.08)));
    // hangers from the deck's machinery down to the catwalks
    for (let x = P.x0 + 0.6; x < P.x1; x += 2.6) for (const e of [-1, 1]) { const a = V(x, U.y + 1.05, P.z + e * (P.w / 2 - 0.1)), b = V(x, 0.4, P.z + e * (P.w / 2 - 0.1)); kit.add(M.hang, thinBar(bar(a, b, 0.05, 3), a, b), NC); }
    // the anchor: the great cable's bronze clamp, bolted under the deck's machinery over the walkway's mouth, a drum of
    // spare cable on the platform's rail beside it
    const A = ANCHOR, W = walkway(), mouth = W[0];
    kit.add(M.bronze, new THREE.BoxGeometry(1.7, 0.5, 2.0).translate(mouth.x, 0.15, mouth.z - 0.3), NC);
    kit.add(M.iron, new THREE.BoxGeometry(2.3, 0.2, 2.6).translate(mouth.x, 0.45, mouth.z - 0.3), NC);
    for (const e of [-1, 1]) kit.add(M.bronze, new THREE.CylinderGeometry(0.16, 0.16, 2.4, 8).rotateX(Math.PI / 2).translate(mouth.x + e * 0.62, -0.05, mouth.z - 0.3), NC);
    kit.add(M.bronze, new THREE.CylinderGeometry(0.55, 0.55, 1.1, 14).rotateZ(Math.PI / 2).translate(A.x + 1.4, UNDER.y + 0.75, P.z + P.w / 2 - 0.35), SOLID);
    // the great cable: out of the clamp, along over the walkway to the stack's foot (its mooring post there)
    const post = ringAt('s0', UNDER.port + 0.36, TIERS.s0.r - 0.9);
    // (over the walkway's middle all the way, then down to the post beside its landing)
    const over = W[1].clone().setY(W[1].y + 2.7);
    const cable = greatCable(kit, M, V(mouth.x, 0.15, mouth.z - 1.2), over, { sag: 0 });
    greatCable(kit, M, over, V(post.x, TIERS.s0.y + 3.2, post.z), { sag: 0.05 });
    // the walkway hung under the cable, out over the void to the underhouses' port
    const wpts = lerpPts(W[0], W[1], 1.4);
    catwalk(kit, M, wpts, 1.9, { from: 1.6, to: 1.2 });
    for (let i = 1; i < wpts.length - 1; i += 2) {
      const p = wpts[i], t = i / (wpts.length - 1), c = cable[Math.round(t * 12)];
      for (const s of edges([wpts[i - 1], p, wpts[i + 1]], 1.7).map((e) => e[1])) if (c.y - s.y > 3) kit.add(M.hang, thinBar(bar(s.clone().setY(s.y + 1.05), c, 0.03, 3), s.clone().setY(s.y + 1.05), c), NC);
    }
    // the moorer at the clamp, her lamp
    lantern(kit, M, A.x + 2.6, U.y, A.z + P.w / 2 - 0.4, { kind: 'globe', s: 1.2, r: 6 });
    // workshops hung on the machinery along the catwalk, lit round windows toward it
    workshop(kit, M, rng, 99.5, U.y - 0.6, P.z + 3.2, { r: 1.5, h: 2.6, face: -Math.PI / 2, top: 0.4 });
    workshop(kit, M, rng, 109.2, U.y - 1.4, -104.8, { r: 1.7, h: 3.2, face: Math.PI, top: 1.6 });
    // gardens hung upside down from the deck's rim, lamps pointing down at the stars
    for (const [x, z, s] of [[92.5, -104.2, 1], [110.5, -100, 0.9], [88, -101.5, 1.2]]) hungGarden(kit, M, rng, x, 2.6, z, { s, cord: 2 });
    for (const [x, z] of [[97.5, P.z - 1.6], [103, P.z + 1.7], [107.5, -106]]) downLamp(kit, M, x, U.y + 0.4, z, 0.4);
    out.under = { kit, stairTop: into.clone(), stairFoot: foot.clone(), platform: V((P.x0 + P.x1) / 2, U.y, P.z), walkway: W, cable };
    out.sights.push({ name: 'the anchor under the Towers', at: [A.x, A.y, A.z] });
  }

  // ---------------------------------------------------------- the stack: its tiers, their houses, the stairs between them
  const stairs = STAIRS.map(stairOf);
  const portsOf = (k) => {
    const p = [];
    for (const S of stairs) { if (S.lo === k) p.push({ a: S.p0, what: S.id }); if (S.hi === k) p.push({ a: S.p1, what: S.id }); }
    if (k === 's0') p.push({ a: UNDER.port, what: 'walkway' });
    if (k === 's1') p.push({ a: STACK_BRIDGE.angle, what: 'bridge' });
    if (k === 's2') p.push({ a: DRIFT.angle, what: 'drift' }, { a: PARTED.angle, what: 'parted' });
    return p;
  };
  const kitLow = kitFor('the stack (low)', 72420), kitHigh = kitFor('the stack (high)', 72430);
  const ML = waysMats(kitLow), MH = waysMats(kitHigh);
  const keys = Object.keys(TIERS);
  for (const [i, k] of keys.entries()) {
    const T = TIERS[k], kit = i <= 2 ? kitLow : kitHigh, M = i <= 2 ? ML : MH, trng = mulberry32(72500 + i * 37);
    const ports = portsOf(k);
    const below = keys[i - 1] ? TIERS[keys[i - 1]] : null;
    const room = corridors();
    // (each round, its machinery under it shallow, what hangs from it no deeper than the roofs of the tier below allow;
    // the underhouses, at the bottom, hang their roots far down into the void)
    const D = island(kit, M, trng, {
      x: STACK.x, y: T.y, z: STACK.z, w: T.r * 2, d: T.r * 2, cr: T.r, wob: 0.5, rim: 1.0, seed: 7300 + i * 11,
      gaps: ports.map((p) => [Math.cos(p.a) * T.r, Math.sin(p.a) * T.r, STACK.hw + 0.8]),
      deep: k === 's0' ? 24 : 10, tiers: k === 's0' ? 3 : k === 's1' ? 0 : 1, bulb: k === 's0', drop: k === 's0' ? Infinity : 3,
      cables: k === 's0' ? 8 : 0, lights: k === 's0' ? 5 : 2, detail: 0.75,
      clear: (x, y0, y1, z, r) => inCorridor(room, x, y0, y1, z, r),
    });
    // the lanes kept clear: from each port in to the middle (or along the rim to the next), a little square in the middle
    const C = V(STACK.x, T.y, STACK.z), lanes = [], pt = (a, d = T.r - 1.6) => V(STACK.x + Math.cos(a) * d, T.y, STACK.z + Math.sin(a) * d);
    ports.sort((p, q) => p.a - q.a);
    for (const p of ports) lanes.push([pt(p.a), C, 1.7]);
    for (let j = 0; j < ports.length; j++) { const p = ports[j], q = ports[(j + 1) % ports.length], da = ((q.a - p.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); if (da < 0.9) lanes.push([pt(p.a), pt(q.a), 1.6]); }
    const segD = (x, z, [a, b]) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - a.x - dx * t, z - a.z - dz * t); };
    const clearOf = (x, z, m) => lanes.every((l) => segD(x, z, l) > l[2] + m * 0.85) && Math.hypot(x - C.x, z - C.z) > 2.6 + m * 0.85 && (k !== 's2' || Math.hypot(x - CAPSTAN.x, z - CAPSTAN.z) > 3.4 + m * 0.85);
    if (T.houses) {
      quarter(kit, M, trng, {
        x0: STACK.x - T.r, x1: STACK.x + T.r, z0: STACK.z - T.r, z1: STACK.z + T.r, y: T.y, n: T.houses, gap: 0.1,
        size: [3, 5.2], tall: T.tall, stack: 0, stack2: 0, domes: 0.15, round: 0.3, towers: 0, trees: 0.4, antenna: 0, awnings: 0.25, wash: 0.45, lit: 0.65, detail: 0.75,
        inside: (x, z, m) => D.inside(x, z, m * 0.55 + 0.9) && clearOf(x, z, m),
        face: (x, z) => Math.atan2(C.x - x, C.z - z),
        light: false,
      });
    }
    // houses built down the tier's side, under its rim, between the stairs' pads: drawn only (nothing walks there)
    if (T.houses) {
      const hung = Math.max(2, Math.round(T.r * 0.55));
      for (let j = 0; j < hung; j++) {
        const a = (j / hung) * Math.PI * 2 + trng() * 0.4, w = 2.4 + trng() * 1.2, h = 2.4 + trng() * 1.6;
        if (ports.some((q) => Math.abs(Math.atan2(Math.sin(q.a - a), Math.cos(q.a - a))) * T.r < w / 2 + 2)) continue;
        const d = T.r - 0.6, x = STACK.x + Math.cos(a) * d, z = STACK.z + Math.sin(a) * d;
        house(kit, M, trng, { x, y: T.y - 3.3 - h, z, w, d: w * 0.9, h, yaw: Math.atan2(Math.cos(a), Math.sin(a)), kind: trng() < 0.4 ? 'drum' : 'block', roof: 'flat', doors: 0, windows: 2, lit: 0.7, flowers: 0.3, antenna: 0, detail: 0.6, solid: false, light: false });
        kit.add(M.under2, new THREE.ConeGeometry(w * 0.45, 1.2, 8).rotateX(Math.PI).translate(x, T.y - 3.9 - h, z), NC);
      }
    }
    // lamps by the lanes, washing across the tier, a potted tree or two
    for (const p of ports) {
      const a = p.a + 2.6 / T.r;
      if (ports.some((q) => Math.abs(Math.atan2(Math.sin(q.a - a), Math.cos(q.a - a))) * T.r < 2.6)) continue;
      const q = pt(a, T.r - 0.7); lantern(kit, M, q.x, T.y, q.z, { kind: 'post', h: 2.4, r: 8, light: true });
    }
    if (T.houses >= 5) {
      const a = trng() * 6.28, p = pt(a, T.r * 0.55), q = pt(a + 1.6, T.r * 0.55);
      laundry(kit, M, trng, [p.x, T.y + 3.6, p.z], [q.x, T.y + 3.8, q.z], { n: 5 });
    }
    // under it, a garden or two hung upside down and lamps pointing at the stars below
    const bottom = T.y - 3.2;
    for (let g = 0; g < (k === 's0' ? 3 : 2); g++) {
      const a = trng() * 6.28, d = T.r * (0.55 + trng() * 0.3), x = STACK.x + Math.cos(a) * d, z = STACK.z + Math.sin(a) * d;
      if (!inCorridor(room, x, bottom - 4, bottom, z, 1.2)) hungGarden(kit, M, trng, x, bottom, z, { s: k === 's0' ? 1.2 : 0.8, vines: k === 's0' ? 9 : 5, cord: 0.6 });
    }
    for (let l = 0; l < 2; l++) { const a = trng() * 6.28, d = T.r * 0.8, x = STACK.x + Math.cos(a) * d, z = STACK.z + Math.sin(a) * d; downLamp(kit, M, x, bottom - 1.2, z, bottom); }
    out.tiers[k] = { ...T, D, ports, kit, M };
  }
  // the underhouses' own: the moorers' workshops and the mooring post the great cable comes to
  {
    const T = TIERS.s0, M = ML, post = ringAt('s0', UNDER.port + 0.36, T.r - 0.9);
    kitLow.add(M.bronze, new THREE.CylinderGeometry(0.45, 0.6, 3.4, 10).translate(post.x, T.y + 1.7, post.z), SOLID);
    kitLow.add(M.iron, new THREE.CylinderGeometry(0.7, 0.7, 0.3, 10).translate(post.x, T.y + 3.2, post.z), SOLID);
    pipeStack(kitLow, M, rng, STACK.x - 1, T.y - 26, STACK.z + 1, 16, { R: 1.1, n: 5, solid: false });
    // the lamp chain: lamps hung one under another from the stack's roots far down into the void, the last a great one
    // pointing at the stars (seen from the catwalks under the Towers and the walkway out: the city's mark from below)
    const cx = STACK.x + 3, cz = STACK.z - 2.5, c0 = T.y - 14, c1 = T.y - 32;
    kitLow.add(M.cable, thinBar(bar(V(cx, c0, cz), V(cx, c1, cz), 0.05, 3), V(cx, c0, cz), V(cx, c1, cz)), NC);
    for (let y = c0 - 2.5; y > c1 + 1; y -= 3) downLamp(kitLow, M, cx, y, cz, y);
    kitLow.add(M.iron, new THREE.ConeGeometry(0.9, 1.0, 10, 1, true).translate(cx, c1 + 0.2, cz), NC);
    kitLow.add(M.lamp, new THREE.SphereGeometry(0.6, 12, 8).translate(cx, c1 - 0.3, cz), NC);
    kitLow.light(cx, c1 - 0.8, cz, 14);
    out.chain = V(cx, c1 - 0.3, cz);
    out.sights.push({ name: 'the underhouses', at: [STACK.x - T.r + 2.5, T.y, STACK.z] });
  }
  // the stairs round the stack: ramps of pale stone, rails both sides, hangers up to the tier above; pads onto each tier
  for (const S of stairs) {
    const kit = TIERS[S.lo].y < 18 ? kitLow : kitHigh, M = kit === kitLow ? ML : MH;
    const hw = STACK.hw, H = helix({ cx: STACK.x, cz: STACK.z, ri: S.R - hw, ro: S.R + hw, y0: S.y0, y1: S.y1, a0: S.a0, dir: S.dir, slope: STACK.slope });
    kit.add(M.bridge, H.geo, SOLID);
    for (const [a, b, y] of [[S.a0 - S.dir * S.land, S.a0, S.y0], [S.a1, S.a1 + S.dir * S.land, S.y1]]) kit.add(M.bridge, arcDeck(S.R - hw, S.R + hw, y, a, b), SOLID);
    // (the rails over the landings too: the outer all along, the inner but where the pads come in from the tiers)
    const yAt = (a) => { const k = (a - S.a0) * S.dir; return k <= 0 ? S.y0 : k >= S.A ? S.y1 : H.at(a).y; };
    const along = (r, from, to, n = Math.ceil(Math.abs(to - from) / 0.05)) => Array.from({ length: n + 1 }, (_, j) => { const a = from + (to - from) * (j / n); return V(STACK.x + Math.cos(a) * r, yAt(a), STACK.z + Math.sin(a) * r); });
    const e0 = S.a0 - S.dir * S.land, e1 = S.a1 + S.dir * S.land, cut = (hw + 0.2) / (S.R - 1);
    rail(kit, M.rail, along(S.R + hw - 0.12, e0, e1));
    rail(kit, M.rail, along(S.R - hw + 0.12, S.p0 + S.dir * cut, S.p1 - S.dir * cut));
    for (const [a, b] of [[e0, S.p0 - S.dir * cut], [S.p1 + S.dir * cut, e1]]) if (Math.abs(b - a) > 0.02) rail(kit, M.rail, along(S.R - hw + 0.12, a, b, 3));
    // hangers: from the inner rail up to the rim of the tier above (leaning in, away from the ramp)
    const hi = TIERS[S.hi];
    for (const p of along(S.R - hw + 0.12, S.a0, S.a1, Math.max(2, Math.round(S.A / 0.35)))) {
      const a = Math.atan2(p.z - STACK.z, p.x - STACK.x), top = V(STACK.x + Math.cos(a) * (hi.r - 0.6), hi.y - 3.3, STACK.z + Math.sin(a) * (hi.r - 0.6));
      if (top.y - p.y < 2.5) continue;
      const lo = p.clone().setY(p.y + 1.05);
      kit.add(M.hang, thinBar(bar(lo, top, 0.04, 3), lo, top), NC);
    }
    // the pads: from the stair's ends in through the parapets' openings
    for (const [a, tier] of [[S.p0, S.lo], [S.p1, S.hi]]) {
      const T = TIERS[tier], from = V(STACK.x + Math.cos(a) * (S.R - hw + 0.1), T.y, STACK.z + Math.sin(a) * (S.R - hw + 0.1)), to = V(STACK.x + Math.cos(a) * (T.r - 1.0), T.y, STACK.z + Math.sin(a) * (T.r - 1.0));
      kit.add(M.bridge, ribbon([from, to], 2 * hw, 0.35), SOLID);
      const [L, R] = edges([from, to.clone().lerp(from, Math.min(1, 1.4 / from.distanceTo(to)))], 2 * hw - 0.15);
      if (from.distanceTo(to) > 1.6) { rail(kit, M.rail, L); rail(kit, M.rail, R); }
    }
    out.stairs[S.id] = { ...S, H, foot: H.at(S.a0), top: H.at(S.a1) };
    function arcDeck(ri, ro, y, a, b) { const n = Math.max(2, Math.ceil(Math.abs(b - a) / 0.05)), rm = (ri + ro) / 2; return ribbon(Array.from({ length: n + 1 }, (_, j) => { const t = a + (b - a) * (j / n); return V(STACK.x + Math.cos(t) * rm, y, STACK.z + Math.sin(t) * rm); }), ro - ri, 0.35); }
  }

  // ---------------------------------------------------------- the stack bridge: stretched, patched with planks
  {
    const kit = kitLow, M = ML, B = STACK_BRIDGE, a = V(...B.a), b = V(...B.b);
    for (const [t, w] of [[0.38, 1.4], [0.52, 2.2], [0.64, 1.1]]) {
      const p = a.clone().lerp(b, t), y = p.y + B.hump * Math.sin(Math.PI * t), yaw = Math.atan2(b.x - a.x, b.z - a.z);
      for (let k = 0; k < 4; k++) kit.add(M.plank, new THREE.BoxGeometry(B.w - 0.9, 0.06, w / 4 - 0.06).rotateY(yaw).translate(p.x + Math.sin(yaw) * (k - 1.5) * (w / 4), y + 0.01, p.z + Math.cos(yaw) * (k - 1.5) * (w / 4)), SOLID);
    }
  }

  // ---------------------------------------------------------- the capstan quarter: the capstan, the broken bridge, its drifted span
  const drift = buildDrift(root, kitLow, ML, rng);
  out.drift = drift;
  out.sights.push({ name: 'the capstan on the stack', at: [CAPSTAN.x, CAPSTAN.y, CAPSTAN.z] });
  // an old bridge that parted: its half off the capstan quarter's west side, the other off an islet that drifted away
  {
    const kit = kitLow, M = ML, a = PARTED.angle, u = V(Math.cos(a), 0, Math.sin(a)), y = TIERS.s2.y;
    const from = ringAt('s2', a, TIERS.s2.r - 1.5), end = ringAt('s2', a, PARTED.reach).setY(y - 0.9);
    // (walked to its broken end, a rail across it)
    bridge(kit, M, [from.x, y, from.z], [end.x, end.y, end.z], { w: 3.4, hump: 0.2, end: 2.2, mid: 1, ext: 1.5 });
    const across = V(-u.z, 0, u.x).multiplyScalar(1.6), stop = end.clone().addScaledVector(u, -0.4);
    rail(kit, M.rail, lerpPts(stop.clone().sub(across), stop.clone().add(across), 0.8), { h: 1.0 });
    const far = ringAt('s2', a, PARTED.far).setY(15);
    const I = island(kit, M, mulberry32(72470), { x: far.x, y: far.y, z: far.z, w: 16, d: 14, cr: 6, deep: 14, cables: 5, lights: 2, detail: 0.6, seed: 7470, gaps: [[-u.x * 7.5, -u.z * 7.5, 2.4]] });
    quarter(kit, M, mulberry32(72471), { x0: far.x - 7, x1: far.x + 7, z0: far.z - 6, z1: far.z + 6, y: far.y, n: 4, size: [3.6, 5.4], tall: [3.4, 4.6], stack: 0.3, inside: (x, z, m) => I.inside(x, z, m * 0.55 + 0.6), face: (x, z) => Math.atan2(STACK.x - x, STACK.z - z), light: false, detail: 0.6 });
    const f0 = far.clone().addScaledVector(u, -6), f1 = far.clone().addScaledVector(u, -(PARTED.far - PARTED.reach - PARTED.gap)).setY(far.y - 1.4);
    bridge(kit, M, [f0.x, far.y, f0.z], [f1.x, f1.y, f1.z], { w: 3.4, hump: 0.2, end: 2.2, mid: 1, ext: 1.5 });
    out.sights.push({ name: 'the parted bridge', at: [stop.x - u.x * 1.2, end.y, stop.z - u.z * 1.2] });
  }

  // ---------------------------------------------------------- the stack's top: the lookout, its lamp-mast, a bench
  {
    const kit = kitHigh, M = MH, T = TIERS.s6;
    const at = V(STACK.x + 1.4, T.y, STACK.z + 1.2), h = 9;
    kit.add(M.iron, new THREE.CylinderGeometry(0.22, 0.3, h, 8).translate(at.x, T.y + h / 2, at.z), SOLID);
    kit.add(M.wood, new THREE.CylinderGeometry(0.9, 0.9, 0.2, 12).translate(at.x, T.y + h, at.z), NC);
    kit.add(M.lamp, new THREE.SphereGeometry(0.55, 12, 8).translate(at.x, T.y + h + 0.8, at.z), NC);
    kit.light(at.x, T.y + h + 0.8, at.z, 16);
    for (const e of [-1, 1]) kit.add(M.wood, new THREE.BoxGeometry(0.14, 0.46, 0.5).translate(STACK.x - 2 + e * 0.9, T.y + 0.23, STACK.z - 2.2), SOLID);
    kit.add(M.wood, new THREE.BoxGeometry(2.2, 0.12, 0.6).translate(STACK.x - 2, T.y + 0.48, STACK.z - 2.2), SOLID);
    crownTree(kit, M, rng, STACK.x - 3, T.y + 0.4, STACK.z + 2.6, 1, { detail: 0.75 });
    kit.add(M.pot, new THREE.CylinderGeometry(0.6, 0.45, 0.8, 10).translate(STACK.x - 3, T.y + 0.4, STACK.z + 2.6), SOLID);
    out.top = { lamp: V(at.x, T.y + h + 0.8, at.z), at: V(STACK.x, T.y, STACK.z) };
    out.sights.push({ name: 'the stack’s top', at: [STACK.x - 2, T.y, STACK.z - 1] });
    out.sights.push({ name: 'the roof street', at: [STACK.x - 4, TIERS.s3.y, STACK.z + 4] });
  }
  // the moorers on the ways: one at the clamp, one at the capstan, people on the stairs and the tiers (drawn)
  for (const [k, n] of [['s1', 3], ['s2', 2], ['s3', 2], ['s4', 1]]) {
    const T = TIERS[k], low = T.y <= TIERS.s2.y;
    for (let j = 0; j < n; j++) { const a = rng() * 6.28, d = 3.2 + rng() * 1.2; resident(low ? kitLow : kitHigh, low ? ML : MH, rng, STACK.x + Math.cos(a) * d, T.y, STACK.z + Math.sin(a) * d); }
  }
  physicsInit.push((physics) => drift.init(physics));
  return out;
}

/**
 * The broken bridge to the Moorings: its two halves (on the capstan quarter, on the Moorings) and the middle span, a
 * little island of its own hung on the capstan's cable, drifted out of line (`DRIFT.out` m to the side, `sink` down).
 * The capstan reels it home over DRIFT.secs. → { reel(), set(k), k, reeled, moving, update(dt), init(physics), … }
 */
function buildDrift(root, kit, M, rng) {
  const A = V(...DRIFT.a), B = V(...DRIFT.b), d = B.clone().sub(A), L = Math.hypot(d.x, d.z), dir = V(d.x / L, 0, d.z / L), side = V(-dir.z, 0, dir.x);
  // (the side it drifted to: away from the stack, east)
  if (side.x < 0) side.negate();
  const at = (u) => V(A.x + dir.x * u, 0, A.z + dir.z * u);
  const [u0, u1] = DRIFT.span, Y = DRIFT.mid;
  const halfA = bridge(kit, M, [A.x, A.y, A.z], [at(u0).x, Y, at(u0).z], { w: 3.6, hump: 0.15, end: 2.4, mid: 1.1, ext: 1.5 });
  const halfB = bridge(kit, M, [at(u1).x, Y, at(u1).z], [B.x, B.y, B.z], { w: 3.6, hump: 0.15, end: 2.4, mid: 1.1, ext: 1.5 });
  // the halves' broken ends: ragged stones hanging under them, lamps on posts
  for (const [u, s] of [[u0, -1], [u1, 1]]) {
    const p = at(u - s * 0.4);
    for (let k = 0; k < 4; k++) kit.add(M.masonry, new THREE.BoxGeometry(0.8 + rng() * 0.6, 0.6 + rng() * 1.6, 0.7).rotateY(Math.atan2(dir.x, dir.z)).translate(p.x + side.x * (k - 1.5) * 0.85, Y - 0.8 - rng() * 1.2, p.z + side.z * (k - 1.5) * 0.85), NC);
    for (const e of [-1, 1]) lantern(kit, M, p.x + side.x * e * 1.55, Y + 0.95, p.z + side.z * e * 1.55, { kind: 'post', h: 1.5, r: 7, light: e > 0 });
  }
  // the capstan: a drum of wood and bronze on a bronze foot, four long spokes, the cable wound on it
  const C = CAPSTAN, cap = new THREE.Group();
  cap.name = 'the capstan'; cap.position.set(C.x, C.y, C.z); root.add(cap);
  const cm = { wood: M.wood, bronze: M.bronze, iron: M.iron, cable: M.cableFar };
  kit.add(M.bronze, new THREE.CylinderGeometry(1.5, 1.7, 0.5, 18).translate(C.x, C.y + 0.25, C.z), SOLID);
  kit.add(M.bronze, new THREE.CylinderGeometry(0.75, 0.9, 1.4, 14).translate(C.x, C.y + 1.1, C.z), SOLID);
  const spin = new THREE.Group(); spin.position.y = 1.0; cap.add(spin);
  spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.9, 16), cm.cable).translateY(0.75));
  spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.16, 16), cm.bronze).translateY(1.25));
  spin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 0.5, 16), cm.bronze).translateY(1.55));
  for (let k = 0; k < 4; k++) { const g = new THREE.CylinderGeometry(0.07, 0.09, 4.4, 6).rotateZ(Math.PI / 2).rotateY((k * Math.PI) / 4); spin.add(new THREE.Mesh(g, cm.wood).translateY(1.1)); }
  cap.traverse((o) => { o.userData.noCollide = true; });

  // the middle span: a short deck on a rock of its own, in its own group so it can move (a mover: physics.addMover)
  const span = new THREE.Group(); span.name = 'the drifted span';
  root.add(span);
  const sk = new RoomKit({ group: span, centre: V(), seed: 72480 }), SM = spaceMats(sk);
  SM.bronze = M.bronze;
  const ul = u1 - u0, mid = at((u0 + u1) / 2), yaw = Math.atan2(dir.x, dir.z);
  // (local: along +z the bridge's way, x across; the deck's top at y 0)
  const g = (geo) => geo.rotateY(yaw);
  sk.add(SM.paving, g(new THREE.BoxGeometry(4.6, 0.5, ul + 0.6).translate(0, -0.25, 0)), SOLID);
  sk.add(SM.masonry, g(new THREE.CylinderGeometry(3.2, 1.2, 4.5, 9).translate(0, -2.75, 0)), SOLID);
  sk.add(SM.under2, g(new THREE.ConeGeometry(1.2, 3, 8).rotateX(Math.PI).translate(0, -6.5, 0)), NC);
  for (const e of [-1, 1]) sk.add(SM.stone, g(new THREE.BoxGeometry(0.42, 0.95, ul + 0.6).translate(e * 2.1, 0.47, 0)), SOLID);
  sk.add(SM.iron, g(new THREE.CylinderGeometry(0.32, 0.4, 0.9, 8).translate(1.5, 0.45, -ul / 2 + 0.8)), NC);
  sk.add(SM.lamp, g(new THREE.SphereGeometry(0.28, 8, 6).translate(-1.6, 1.9, ul / 2 - 0.6)), NC);
  sk.add(SM.iron, g(new THREE.CylinderGeometry(0.05, 0.06, 1.4, 5).translate(-1.6, 1.15, ul / 2 - 0.6)), NC);
  for (let k = 0; k < 4; k++) { const a = rng() * 6.28, r = 1 + rng() * 1.6; sk.add(SM.hang, g(new THREE.CylinderGeometry(0.06, 0.06, 4 + rng() * 6, 4).translate(Math.cos(a) * r, -5 - rng() * 2, Math.sin(a) * r)), NC); }
  sk.finish();
  for (const m of span.children) m.userData.noCollide = true;   // (out of the bake: it collides as a mover)
  const home = V(mid.x, Y, mid.z), away = home.clone().addScaledVector(side, DRIFT.out).add(V(0, -DRIFT.sink, 0));
  // the capstan's cable from its drum to the span's bollard, drawn new as the span comes in
  const bollard = V(1.5, 0.7, -ul / 2 + 0.8).applyAxisAngle(V(0, 1, 0), yaw);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5).translate(0, 0.5, 0).rotateX(Math.PI / 2), M.cableFar);
  line.name = 'the capstan’s cable'; line.userData.noCollide = true; root.add(line);
  const drum = V(C.x, C.y + 1.75, C.z);

  let k = 0, from = 0, t = 0, moving = false, done = null, collider = null;
  const ease = (x) => x * x * (3 - 2 * x);
  const place = () => {
    span.position.copy(away).lerp(home, ease(k));
    span.updateMatrixWorld(true);
    spin.rotation.y = -k * Math.PI * 6;
    const p = span.position.clone().add(bollard), v = p.clone().sub(drum);
    line.position.copy(drum); line.scale.set(1, 1, v.length()); line.lookAt(p); line.updateMatrixWorld(true);
  };
  place();
  const api = {
    span, home, away, side, halfA, halfB, capstan: cap, drum, mid: home, ends: [V(at(u0).x, Y, at(u0).z), V(at(u1).x, Y, at(u1).z)],
    get k() { return k; }, get reeled() { return k >= 1; }, get moving() { return moving; },
    /** Straight to k (0 drifted out, 1 home), the collider with it (a save that has reeled it). */
    set(v) { k = THREE.MathUtils.clamp(v, 0, 1); moving = false; place(); },
    /** Reel it home over DRIFT.secs; `then` once it is in. */
    reel(then = null) { if (k >= 1 || moving) return false; moving = true; from = k; t = 0; done = then; return true; },
    init(physics) { collider = physics.addMover?.(span, { all: true }) ?? null; physics.syncMovers?.(0); },
    get collider() { return collider; },
    update(dt) {
      if (!moving) return;
      t += dt;
      k = Math.min(1, from + t / DRIFT.secs);
      place();
      if (k >= 1) { moving = false; const f = done; done = null; f?.(); }
    },
  };
  return api;
}

/**
 * The ways as leading lines (the level design audit's `lines`, src/levels/space-city.js): `down` from the Towers' deck down
 * the moorers' stair to the anchor; `up` from the anchor out along the walkway, up the stack to the capstan quarter and
 * over the broken bridge to the Moorings; `home` back over it, down the stack's other side and over the stack bridge.
 * Points [x, y, z] on the decks.
 */
export function routeOf(ways) {
  const P = (v) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
  const st = towersStair(), down = [P(ways.under.stairTop)];
  for (let k = 0; k <= 8; k++) down.push(P(st.at(st.a1 + (st.a0 - st.a1) * (k / 8))));
  down.push(P(V(UNDER.platform.x1 - 2.4, UNDER.y, UNDER.platform.z - 0.4)));
  const helixPts = (id, back = false) => {
    const S = ways.stairs[id], n = Math.max(3, Math.round(S.A / 0.4)), pts = [];
    for (let k = 0; k <= n; k++) { const t = back ? 1 - k / n : k / n; pts.push(P(S.H.at(S.a0 + S.dir * S.A * t))); }
    return pts;
  };
  const port = (tier, a, d = TIERS[tier].r - 1.6) => P(ringAt(tier, a, d));
  const C = (tier) => P(ringAt(tier, 0, 0));
  const land = (id, end) => { const s = ways.stairs[id]; return P(ringAt(end ? s.hi : s.lo, end ? s.p1 : s.p0, s.R)); };
  const S = ways.stairs, W = walkway(), D = ways.drift;
  const up = [
    P(W[0]), P(W[1]), port('s0', UNDER.port), port('s0', S.h01.p0), land('h01', 0), ...helixPts('h01'), land('h01', 1), port('s1', S.h01.p1), port('s1', S.h12.p0), land('h12', 0), ...helixPts('h12'),
    land('h12', 1), port('s2', S.h12.p1), C('s2'), port('s2', DRIFT.angle), DRIFT.a, ...D.ends.map(P), DRIFT.b,
  ];
  const home = [
    DRIFT.b, ...D.ends.map(P).reverse(), DRIFT.a, C('s2'), port('s2', S.h21.p1), land('h21', 1), ...helixPts('h21', true), land('h21', 0), port('s1', S.h21.p0), C('s1'), STACK_BRIDGE.b, STACK_BRIDGE.a, [98, 6, -101], [98, 6, -96],
  ];
  return { down, up, home };
}
