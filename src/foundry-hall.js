import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './noise.js';
import { bar } from './levels/antennas-kit.js';

// The Moon Foundry closed in (issue #731, the author: "The moon foundry should be closed up. Not in an open world. With more
// mood and steam."; docs/systems/worlds.md "The Moon Foundry, closed in"). The great hall keeps its floor, its moons, its
// people and its ways; round it now:
//
//   the walls        riveted iron from the floor to the roof on every side (HALL_WALLS), ribbed every roof bay, banded,
//                    their high vent grilles dull with the furnaces' heat, a gallery hung along them 30 m up
//   the front wall   where the open mouth was: shut but for the great gate (GATES.main) over the aisle and the floor's
//                    rails, and the rail gate (GATES.rail) the casting rails and the long runnel go out by
//   the dock         where the ship lands (DOCK): the old apron walled in and roofed, deep in the crater, open to the sky
//                    only by its roof hatch (HATCH) over the ship, which comes down and goes up through it
//                    (src/ship/cinematics.js: a site with `shaft`); its walls of iron ribs and pipes
//   the casting bay  the Casting-House's end of the hall under a raised roof of its own (BAY), its clerestory glowing
//   the furnaces     eight wall furnaces (FURNACES) with the last furnace light the hall: a glowing mouth under an iron
//                    hood, a flue up the wall, a pool of light before each and smoke rolling off its hood
//   the chains       hanging from the roof between the moons, hooks on their ends
//   the steam        vents at the walls' feet, valves that hiss, the furnaces' smoke: src/foundry-steam.js (VENTS here)
//
// Solid: the walls (never climbed: noClimb), the gates' jambs, the dock's walls, the furnaces' hoods. Drawn only: the
// galleries, the chains, the raised roof, the grilles. Pure data first (the tests read it), the builder last.

/** The hall's inside (m): the slabs' floor, the walls' inner faces 2 m out from its edge; the roof's height. */
export const HALL = { x0: -170, x1: 170, z0: -292, z1: 46, roof: 88 };
/** The walls' inner faces and thickness (m). */
export const WALL = { x0: -172, x1: 172, z0: -294, z1: 45, t: 3 };
/** The raised roof over the Casting-House's bay (its old open casting bay), and its clerestory's band. */
export const BAY = { x0: 85, x1: 172, z0: -294, z1: -38.5, roof: 104 };
/** The front wall's openings ([x0, x1] and height, m): the great gate over the aisle, the rail gate in the east bay. */
export const GATES = { main: { x0: -34, x1: 42, h: 34 }, rail: { x0: 108, x1: 136, h: 22 } };
/** The landing dock: the walled crater the ship lands in ([x0, x1] × [z0, z1], its corners cut `cut` m), its walls' height. */
export const DOCK = { x0: -122, x1: 144, z0: 48, z1: 184, cut: 26, h: 60, rim: 104 };
/** The dock's roof hatch, open over the ship ([x0, x1] × [z0, z1]): the ship comes down through it and goes up through it. */
export const HATCH = { x0: -46, x1: 46, z0: 86, z1: 156 };
/**
 * The wall furnaces: [x, z] at the foot of the wall, `face` the way its mouth looks (rad, 0 = +z). Placed clear of the
 * encounter sites, the quarter, the runnels and the casting rails.
 */
export const FURNACES = [
  { name: 'the west furnace', x: WALL.x0, z: -40, face: Math.PI / 2 },
  { name: 'the north-west furnace', x: WALL.x0, z: -200, face: Math.PI / 2 },
  { name: 'the north furnace', x: -40, z: WALL.z0, face: 0 },
  { name: 'the north-east furnace', x: 40, z: WALL.z0, face: 0 },
  { name: 'the east furnace', x: WALL.x1, z: -14, face: -Math.PI / 2 },
  { name: 'the bay furnace', x: WALL.x1, z: -236, face: -Math.PI / 2 },
  { name: 'the gate’s west furnace', x: -96, z: WALL.z1, face: Math.PI },
  { name: 'the gate’s east furnace', x: 78, z: WALL.z1, face: Math.PI },
];
/** Steam grates in the floor ([x, z]): off the aisle, the runnels, the rails and the pillars, a column of steam out of each. */
export const GRATES = [[-22, 8], [26, -34], [-26, -80], [40, -62], [-42, -140], [92, -20], [-62, 20], [140, -118], [-92, -262], [22, -252], [-130, -152], [150, -60], [-150, -230], [-110, 30]];
/** A furnace's hood: w across the wall, d out from it, h tall; its mouth (w, h) at its foot. */
export const HOOD = { w: 10, d: 6, h: 11, mouth: [4.8, 4.0], light: 24 };

/** Inside the hall's walls (x, z)? */
export const inHall = (x, z, m = 0) => x > WALL.x0 + m && x < WALL.x1 - m && z > WALL.z0 + m && z < WALL.z1 - m;
/** How far (m) a point is inside the dock's walls (negative: outside them; the corners cut). */
export function dockDepth(x, z) {
  const D = DOCK, cx = (D.x0 + D.x1) / 2, cz = (D.z0 + D.z1) / 2, hx = (D.x1 - D.x0) / 2, hz = (D.z1 - D.z0) / 2;
  const ax = Math.abs(x - cx), az = Math.abs(z - cz);
  // (a rectangle with its corners cut at 45°: the least of its four sides and the cut's line)
  return Math.min(hx - ax, hz - az, (hx + hz - D.cut - ax - az) / Math.SQRT2);
}
/** In the dock, or in the gate's passage between it and the hall? */
export const inDock = (x, z, m = 0) => dockDepth(x, z) > m && z > WALL.z1 - 1;
/** Inside the foundry at all: the hall or the dock (the gates join them). */
export const enclosed = (x, z, m = 0) => inHall(x, z, m) || inDock(x, z, m) || inGate(x, z);
/** In a gate's opening through the front wall. */
export function inGate(x, z) {
  if (z < WALL.z1 - 1 || z > WALL.z1 + WALL.t + 1) return false;
  return Object.values(GATES).some((g) => x > g.x0 + 0.5 && x < g.x1 - 0.5);
}
/**
 * How far outside the foundry (m) a point is: 0 inside the hall's walls or the dock's (the ground there is the floor),
 * more out past them (the crater's rock rises there).
 */
export function outside(x, z) {
  const hx = Math.max(WALL.x0 - x, x - WALL.x1, 0), hz = Math.max(WALL.z0 - z, z - WALL.z1, 0);
  const hall = Math.hypot(hx, hz);
  const dock = Math.max(0, -dockDepth(x, z));
  return Math.min(hall, z < WALL.z1 ? Infinity : dock);
}

/** The steam's vents (src/foundry-steam.js): at the walls' feet, on the furnaces' hoods, valves on the dock's walls. */
export function steamVents({ furnace = null, moulds = [], pillars = [], grates = GRATES } = {}) {
  const out = [], rng = mulberry32(73101);
  for (const [x, z] of grates) out.push({ x, y: 0.3, z, kind: 'vent', size: 2.2, k: 1.6 });
  const along = (x0, z0, x1, z1, every, inward, y = 1.2, kind = 'vent') => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / every);
    for (let i = 1; i < n; i++) {
      const t = (i + (rng() - 0.5) * 0.4) / n, x = x0 + (x1 - x0) * t + inward[0] * 0.8, z = z0 + (z1 - z0) * t + inward[1] * 0.8;
      if (inGate(x, z - 1) || inGate(x, z + 1)) continue;
      if (FURNACES.some((f) => Math.hypot(f.x - x, f.z - z) < HOOD.w)) continue;
      out.push({ x, y, z, kind: i % 3 === 1 ? 'hiss' : kind, dir: [inward[0] * 0.5, 1, inward[1] * 0.5] });
    }
  };
  // the hall's walls, a vent every ~46 m at their feet
  along(WALL.x0, WALL.z0, WALL.x0, WALL.z1, 46, [1, 0]);
  along(WALL.x1, WALL.z0, WALL.x1, WALL.z1, 46, [-1, 0]);
  along(WALL.x0, WALL.z0, WALL.x1, WALL.z0, 46, [0, 1]);
  along(WALL.x0, WALL.z1, WALL.x1, WALL.z1, 40, [0, -1]);
  // the dock's walls, valves that hiss and vents that breathe
  along(DOCK.x0, DOCK.z0 + 6, DOCK.x0, DOCK.z1 - DOCK.cut, 30, [1, 0], 2.4);
  along(DOCK.x1, DOCK.z0 + 6, DOCK.x1, DOCK.z1 - DOCK.cut, 30, [-1, 0], 2.4);
  along(DOCK.x0 + DOCK.cut, DOCK.z1, DOCK.x1 - DOCK.cut, DOCK.z1, 34, [0, -1], 2.4);
  // the furnaces: smoke off each hood's lip
  for (const f of FURNACES) {
    const fx = Math.sin(f.face), fz = Math.cos(f.face);
    out.push({ x: f.x + fx * (HOOD.d + 0.4), y: HOOD.h - 1.5, z: f.z + fz * (HOOD.d + 0.4), kind: 'smoke', dir: [fx * 0.6, 1, fz * 0.6] });
  }
  if (furnace) out.push({ x: furnace.x - furnace.r - 0.6, y: 4, z: furnace.z, kind: 'smoke', dir: [-0.5, 1, 0], size: 0.8 });
  for (const [x, y, z] of moulds) out.push({ x, y, z, kind: 'mould' });
  // a valve on every third pillar, hissing now and then
  pillars.forEach(([x, z], i) => { if (i % 3 === 1) out.push({ x: x + 2.9, y: 3.2, z, kind: 'hiss', dir: [1, 0.3, 0] }); });
  return out;
}

const plain = (g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
const box = (w, h, d, x, y, z) => plain(new THREE.BoxGeometry(w, h, d)).translate(x, y, z);

/**
 * Build the enclosure into the level. ctx: { scene, root, put (the level's: roles into its cells), kitAt, M (its
 * materials), lamp, noShadow, V, H (the floor's height) }. Returns { walls (meshes, solid, noClimb), vents, furnaces }.
 */
export function buildEnclosure({ root, M, lamp, noShadow, V, roof: roofParts, grates = GRATES }) {
  const rng = mulberry32(73100);
  const LOOSE = { solid: false, shadow: false };
  const walls = [];
  // (everything else it draws gathered by material and merged into one mesh each at the end, not one a cell: the walls
  //  run the length of the world, and a mesh a cell a material cost ~90 draw calls)
  const bag = new Map();
  const bagAdd = (m, g, { solid = false, shadow = false } = {}) => {
    const k = `${m.uuid}|${solid}|${shadow}`;
    if (!bag.has(k)) bag.set(k, { m, solid, shadow, list: [] });
    bag.get(k).list.push(plain(g.index ? g.toNonIndexed() : g));
  };
  const kitAt = () => ({ kit: { add: bagAdd } });
  const ROLE = { dark: M.dark, plank: M.plank, strut: M.strut, steel: M.steel, ceiling: M.ceiling, rust: M.metal.rust3 };
  const put = (x, z, parts, { solid = true, shadow = true } = {}) => {
    for (const [role, list] of Object.entries(parts)) if (ROLE[role] && Array.isArray(list)) for (const g of list) if (g?.isBufferGeometry) bagAdd(ROLE[role], g, { solid: solid && role !== 'strut' && role !== 'ceiling', shadow: role === 'ceiling' ? true : shadow && role !== 'strut' });
  };
  // ---- a wall: its plate, ribs every `bay` m, bands, its high grilles; solid, never climbed. One mesh a side.
  const wallMeshes = new Map();
  const addWall = (name, g, m) => { const k = `${name}|${m.uuid}`; if (!wallMeshes.has(k)) wallMeshes.set(k, { name, m, list: [] }); wallMeshes.get(k).list.push(g); };
  /**
   * A straight wall from (x0, z0) to (x1, z1), its inner face on that line, `in` the unit way into the room, from the floor
   * to `top` (a number, or top(t) along it), its openings [[s0, s1, h]] (m along it) left out up to h.
   */
  const wall = (name, x0, z0, x1, z1, inn, top, { gaps = [], bay = 21.25, grilles = true, t = WALL.t } = {}) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    const at = (s, o = 0) => [x0 + ux * s - inn[0] * o, z0 + uz * s - inn[1] * o];
    const topAt = (s) => (typeof top === 'function' ? top(s / L) : top);
    const piece = (s0, s1, y0, y1, depth, off, m) => {
      const [cx, cz] = at((s0 + s1) / 2, off), w = s1 - s0, h = y1 - y0;
      const g = Math.abs(ux) > 0.5 ? box(w, h, depth, cx, (y0 + y1) / 2, cz) : Math.abs(uz) > 0.5 ? box(depth, h, w, cx, (y0 + y1) / 2, cz)
        : plain(new THREE.BoxGeometry(w, h, depth)).rotateY(-Math.atan2(uz, ux)).translate(cx, (y0 + y1) / 2, cz);
      addWall(name, g, m);
    };
    // the plate, in runs between the openings (and over each opening, from its top up)
    const cuts = [0, ...gaps.flatMap(([a, b]) => [a, b]), L];
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i], b = cuts[i + 1];
      for (let s = a; s < b - 0.01; s += 40) { const e = Math.min(b, s + 40); piece(s, e, -2, Math.max(topAt(s), topAt(e)), t, t / 2, M.wallIron); }
    }
    for (const [a, b, h] of gaps) piece(a, b, h, Math.max(topAt(a), topAt(b)), t, t / 2, M.wallIron);
    const open = (s, r = 0) => gaps.some(([a, b]) => s > a - r && s < b + r);
    // ribs (the roof's bays), banded at their foot; the bands along it
    for (let s = bay; s < L - 1; s += bay) {
      if (open(s, 1.2)) continue;
      piece(s - 0.8, s + 0.8, -0.5, topAt(s), 1.6, -0.8, M.wallRib);
      piece(s - 1.2, s + 1.2, -0.5, 3.2, 2.4, -1.2, M.wallRib);
    }
    for (const y of [5.5, 30, 58]) {
      const segs = [];
      let a = 0;
      for (const [g0, g1, h] of [...gaps].sort((p, q) => p[0] - q[0])) { if (y < h) { segs.push([a, g0]); a = g1; } }
      segs.push([a, L]);
      for (const [p, q] of segs) for (let s = p; s < q - 0.01; s += 40) { const e = Math.min(q, s + 40); if (y < Math.min(topAt(s), topAt(e)) - 1) piece(s, e, y, y + 0.7, 0.5, -0.25, M.wallRib); }
    }
    // high grilles between the ribs: dull with the heat behind them (drawn only)
    if (grilles) for (let s = bay / 2; s < L - 1; s += bay) {
      if (open(s, 4) || rng() < 0.35) continue;
      const y = topAt(s) - 16, [cx, cz] = at(s, -0.06), k = kitAt(cx, cz).kit;
      const g = new THREE.PlaneGeometry(6, 7).rotateY(Math.atan2(inn[0], inn[1])).translate(cx, y, cz);
      k.add(M.grille, plain(g), LOOSE);
      for (let i = -2; i <= 2; i++) { const [bx, bz] = at(s + i * 1.2, -0.12); k.add(M.gDark, box(Math.abs(ux) > 0.5 ? 0.18 : 0.2, 7.2, Math.abs(ux) > 0.5 ? 0.2 : 0.18, bx, y, bz), LOOSE); }
    }
    return { L, ux, uz, at };
  };

  // ---- the hall's walls: west, north, east (stepped up round the raised bay), the front with its two gates
  const bayTop = (zz) => (zz < BAY.z1 ? BAY.roof : HALL.roof);
  wall('the west wall', WALL.x0, WALL.z1 + WALL.t, WALL.x0, WALL.z0 - WALL.t, [1, 0], HALL.roof + 1);
  wall('the north wall', WALL.x0 - WALL.t, WALL.z0, WALL.x1 + WALL.t, WALL.z0, [0, 1], (t) => (WALL.x0 + (WALL.x1 - WALL.x0) * t > BAY.x0 ? BAY.roof + 1 : HALL.roof + 1));
  wall('the east wall', WALL.x1, WALL.z0 - WALL.t, WALL.x1, WALL.z1 + WALL.t, [-1, 0], (t) => bayTop(WALL.z0 + (WALL.z1 - WALL.z0) * t) + 1);
  const fx0 = WALL.x0 - WALL.t, gap = (g) => [g.x0 - fx0, g.x1 - fx0, g.h];
  const front = wall('the front wall', fx0, WALL.z1, WALL.x1 + WALL.t, WALL.z1, [0, -1], HALL.roof + 1, { gaps: [gap(GATES.main), gap(GATES.rail)] });
  // the gates' jambs (towers either side, through the wall and out both faces) and their lintels
  for (const g of Object.values(GATES)) {
    for (const [x, s] of [[g.x0, -1], [g.x1, 1]]) {
      addWall('the gates', box(6, g.h + 8, WALL.t + 8, x + s * 3, (g.h + 8) / 2 - 1, WALL.z1 + WALL.t / 2), M.wallRib);
      addWall('the gates', box(7.2, 2.4, WALL.t + 9, x + s * 3, 1.2, WALL.z1 + WALL.t / 2), M.wallRib);
    }
    addWall('the gates', box(g.x1 - g.x0, 4, WALL.t + 6, (g.x0 + g.x1) / 2, g.h + 2, WALL.z1 + WALL.t / 2), M.wallRib);
    // the gate's leaves, rolled back into the jambs (a dark slab showing in each), and its lamps either side, both faces
    for (const [x, s] of [[g.x0, -1], [g.x1, 1]]) for (const zz of [WALL.z1 - 4.2, WALL.z1 + WALL.t + 4.2]) {
      kitAt(x, zz).kit.add(M.lamp, new THREE.SphereGeometry(0.45, 10, 8).translate(x - s * 0.8, g.h - 3, zz), LOOSE);
      lamp(x - s * 0.8, g.h - 4, zz, 16);
    }
  }
  void front;

  // ---- the raised roof over the Casting-House's bay and its clerestory: drawn, its ceiling shading the bay
  const clere = [];
  for (const [x0, z0, x1, z1] of [[BAY.x0, BAY.z1, BAY.x0, BAY.z0], [BAY.x0, BAY.z1, BAY.x1, BAY.z1]]) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    for (let s = 0; s < L - 0.01; s += 42.5) {
      const e = Math.min(L, s + 42.5), t0 = s / L, t1 = e / L, cx = x0 + (x1 - x0) * (t0 + t1) / 2, cz = z0 + (z1 - z0) * (t0 + t1) / 2;
      const g = x0 === x1 ? box(1.2, BAY.roof - HALL.roof + 2, e - s, cx, (BAY.roof + HALL.roof) / 2 - 1, cz) : box(e - s, BAY.roof - HALL.roof + 2, 1.2, cx, (BAY.roof + HALL.roof) / 2 - 1, cz);
      clere.push(g);
      // its slits, lit by the bay's heat
      for (let k = 0; k < 4; k++) {
        const u = (k + 0.5) / 4, px = x0 + (x1 - x0) * (t0 + (t1 - t0) * u), pz = z0 + (z1 - z0) * (t0 + (t1 - t0) * u);
        const slit = new THREE.PlaneGeometry(4.5, 6).rotateY(x0 === x1 ? -Math.PI / 2 : 0).translate(px + (x0 === x1 ? -0.65 : 0), (BAY.roof + HALL.roof) / 2, pz + (x0 === x1 ? 0 : 0.65));
        kitAt(px, pz).kit.add(M.grille, plain(slit), LOOSE);
      }
    }
  }
  for (const g of clere) bagAdd(M.wallIron, g, { solid: false, shadow: true });   // (drawn only, up among the girders)

  // ---- the dock: walls of iron ribs round the crater the ship lands in, the rock over them (the terrain)
  {
    const D = DOCK, c = D.cut;
    const ring = [[D.x0, D.z0 - 1], [D.x0, D.z1 - c], [D.x0 + c, D.z1], [D.x1 - c, D.z1], [D.x1, D.z1 - c], [D.x1, D.z0 - 1]];
    for (let i = 1; i < ring.length; i++) {
      const [ax, az] = ring[i - 1], [bx, bz] = ring[i], L = Math.hypot(bx - ax, bz - az), inn = [(az - bz) / L, (bx - ax) / L];
      // (the inward normal: the ring runs clockwise seen from above, +z down the page)
      const cx = (ax + bx) / 2, cz = (az + bz) / 2, s = inn[0] * ((D.x0 + D.x1) / 2 - cx) + inn[1] * ((D.z0 + D.z1) / 2 - cz) < 0 ? -1 : 1;
      // (solid to 4 m under the roof's girders, its last 4 m drawn only: nothing to stand on up among the girders)
      wall('the dock’s walls', ax, az, bx, bz, [inn[0] * s, inn[1] * s], D.h - 4, { bay: 14, grilles: false });
      const yaw = -Math.atan2(bz - az, bx - ax), o = WALL.t / 2;
      bagAdd(M.wallIron, plain(new THREE.BoxGeometry(L, 4.4, WALL.t)).rotateY(yaw).translate(cx - inn[0] * s * o, D.h - 2.2, cz - inn[1] * s * o), { solid: false, shadow: true });
      // a pipe run along it at 9 m and at 22 m, brackets every few metres (drawn)
      const pipes = [];
      for (const y of [9, 22]) {
        const o = 1.1;
        const p0 = V(ax + inn[0] * s * o, y, az + inn[1] * s * o), p1 = V(bx + inn[0] * s * o, y, bz + inn[1] * s * o);
        pipes.push(bar(p0, p1, 0.45, 0.45, 10));
      }
      for (const g of pipes) addWall('the dock’s pipes', g, M.dark);   // (with the walls: solid, never climbed)
      // lamps on brackets, a pool of light every 40 m round the dock's foot
      for (let u = 20; u < L - 10; u += 40) {
        const px = ax + (bx - ax) * (u / L) + inn[0] * s * 1.6, pz = az + (bz - az) * (u / L) + inn[1] * s * 1.6;
        kitAt(px, pz).kit.add(M.lamp, new THREE.SphereGeometry(0.35, 8, 6).translate(px, 7, pz), LOOSE);
        lamp(px, 7, pz, 14);
      }
    }
  }

  // ---- the dock's roof: girders and a dark ceiling round the open hatch, its coaming, lamps hung round it
  {
    const D = DOCK, H = HATCH, y = D.h;
    for (const [x0, x1, z0, z1] of [[D.x0, D.x1, D.z0, H.z0], [D.x0, D.x1, H.z1, D.z1], [D.x0, H.x0, H.z0, H.z1], [H.x1, D.x1, H.z0, H.z1]]) {
      const P = roofParts({ x0, x1, z0, z1, y });
      put((x0 + x1) / 2, (z0 + z1) / 2, { steel: P.steel, strut: P.strut }, { solid: false, shadow: false });
      // (its ceiling exact to the hatch's edge, casting the dock's shade)
      kitAt((x0 + x1) / 2, (z0 + z1) / 2).kit.add(M.ceiling, plain(new THREE.PlaneGeometry(x1 - x0, z1 - z0)).rotateX(Math.PI / 2).translate((x0 + x1) / 2, y + 0.6, (z0 + z1) / 2), { solid: false, shadow: true });
    }
    for (const [ax, az, bx, bz] of [[H.x0, H.z0, H.x1, H.z0], [H.x0, H.z1, H.x1, H.z1], [H.x0, H.z0, H.x0, H.z1], [H.x1, H.z0, H.x1, H.z1]]) {
      const L = Math.hypot(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
      addWall('the hatch', az === bz ? box(L + 3, 4, 1.5, cx, y - 1.4, cz) : box(1.5, 4, L + 3, cx, y - 1.4, cz), M.wallRib);
      for (let u = 8; u < L - 4; u += 16) {
        const px = ax + (bx - ax) * (u / L), pz = az + (bz - az) * (u / L);
        kitAt(px, pz).kit.add(M.strut, bar(V(px, y - 3.4, pz), V(px, y - 9, pz), 0.04, 0.04, 3), LOOSE);
        kitAt(px, pz).kit.add(M.lamp, new THREE.SphereGeometry(0.4, 8, 6).translate(px, y - 9.4, pz), LOOSE);
      }
    }
  }

  // ---- the furnaces in the walls: an iron hood over a glowing mouth, a flue up the wall, a pool of light before it
  const furnaces = [];
  for (const f of FURNACES) {
    const fx = Math.sin(f.face), fz = Math.cos(f.face), sx = Math.cos(f.face), sz = -Math.sin(f.face);
    const rot = (g) => g.rotateY(f.face).translate(f.x, 0, f.z);
    const hood = [plain(new THREE.BoxGeometry(HOOD.w, HOOD.h - 4.2, HOOD.d)).translate(0, 4.2 + (HOOD.h - 4.2) / 2, HOOD.d / 2),
      ...[-1, 1].map((e) => plain(new THREE.BoxGeometry(2.6, 4.4, HOOD.d)).translate(e * (HOOD.w / 2 - 1.3), 2.2, HOOD.d / 2))].map(rot);
    // (its back: the mouth's dark throat, the hood sloping in to the flue)
    const throat = rot(plain(new THREE.BoxGeometry(HOOD.w - 5.2, 4.2, 0.6)).translate(0, 2.1, 0.3));
    const slope = rot(plain(new THREE.CylinderGeometry(1.6, HOOD.w * 0.42, 4, 4, 1)).rotateY(Math.PI / 4).scale(1, 1, HOOD.d / HOOD.w).translate(0, HOOD.h + 2, HOOD.d / 2));
    const roofY = f.x > BAY.x0 && f.z < BAY.z1 ? BAY.roof : HALL.roof;
    const flue = rot(plain(new THREE.CylinderGeometry(1.4, 1.4, roofY - HOOD.h - 4, 12, 1, true)).translate(0, HOOD.h + 4 + (roofY - HOOD.h - 4) / 2, 1.6));
    // (dark iron, banded in rust over the mouth, fire bars across it: a furnace, not a house)
    const band = rot(plain(new THREE.BoxGeometry(HOOD.w + 0.3, 0.9, 0.5)).translate(0, 4.75, HOOD.d + 0.05));
    const fireBars = [-1.6, -0.8, 0, 0.8, 1.6].map((x) => rot(plain(new THREE.BoxGeometry(0.16, HOOD.mouth[1], 0.16)).translate(x, HOOD.mouth[1] / 2 + 0.2, 0.9)));
    put(f.x + fx * 3, f.z + fz * 3, { dark: [...hood, throat, slope, flue], rust: [band] });
    put(f.x + fx * 3, f.z + fz * 3, { dark: fireBars }, { solid: false });
    const k = kitAt(f.x + fx * 3, f.z + fz * 3).kit;
    // the mouth, glowing, and the hot floor before it (over the slabs: 0.05 m up, as the last furnace's)
    k.add(M.hot, rot(plain(new THREE.PlaneGeometry(HOOD.mouth[0], HOOD.mouth[1])).translate(0, HOOD.mouth[1] / 2 + 0.2, 0.62)), LOOSE);
    k.add(M.hot, rot(plain(new THREE.CircleGeometry(2.4, 20)).rotateX(-Math.PI / 2).scale(1, 1, 0.55).translate(0, 0.05, HOOD.d * 0.55)), LOOSE);
    lamp(f.x + fx * (HOOD.d + 1.5), 2.4, f.z + fz * (HOOD.d + 1.5), HOOD.light);
    furnaces.push({ ...f, at: V(f.x + fx * (HOOD.d + 2), 0, f.z + fz * (HOOD.d + 2)), side: [sx, sz] });
  }

  // ---- the floor's steam grates: an iron grid in a dark frame, proud of the slabs (src/foundry-steam.js breathes out of them)
  for (const [x, z] of grates) {
    const k = kitAt(x, z).kit, bars = [];
    for (let i = -2; i <= 2; i++) bars.push(box(2.6, 0.08, 0.16, x, 0.13, z + i * 0.5), box(0.16, 0.08, 2.61, x + i * 0.5, 0.135, z));
    k.add(M.gDark, mergeGeometries(bars), { solid: false, shadow: false });
    k.add(M.hot, plain(new THREE.PlaneGeometry(2.2, 2.2)).rotateX(-Math.PI / 2).translate(x, 0.06, z), LOOSE);
  }

  // ---- the galleries along the walls, 30 m up, hung from the roof (drawn only: nothing climbs to them)
  {
    const gal = [], rails = [];
    const run = (x0, z0, x1, z1, inn) => {
      const L = Math.hypot(x1 - x0, z1 - z0), y = 30.6;
      const a = V(x0 + inn[0] * 2.2, y, z0 + inn[1] * 2.2), b = V(x1 + inn[0] * 2.2, y, z1 + inn[1] * 2.2);
      for (let s = 0; s < L - 0.01; s += 42.5) {
        const p = a.clone().lerp(b, s / L), q = a.clone().lerp(b, Math.min(1, (s + 42.5) / L));
        const mid = p.clone().lerp(q, 0.5), len = p.distanceTo(q);
        gal.push(Math.abs(b.x - a.x) > 1 ? box(len, 0.35, 2.6, mid.x, y - 0.18, mid.z) : box(2.6, 0.35, len, mid.x, y - 0.18, mid.z));
        const o = V(inn[0] * 1.25, 0, inn[1] * 1.25);
        rails.push(bar(p.clone().add(o).add(V(0, 1.05, 0)), q.clone().add(o).add(V(0, 1.05, 0)), 0.05, 0.05, 4));
        for (let u = 0; u < len; u += 8.5) {
          const r = p.clone().lerp(q, u / len).add(o);
          rails.push(bar(r, r.clone().add(V(0, 1.05, 0)), 0.04, 0.04, 3), bar(r.clone().add(V(0, 1.05, 0)), V(r.x, HALL.roof - 3.6, r.z), 0.035, 0.035, 3));
        }
      }
    };
    run(WALL.x0, -280, WALL.x0, 30, [1, 0]);
    run(WALL.x0 + 14, WALL.z0, BAY.x0 - 4, WALL.z0, [0, 1]);
    run(WALL.x1, 30, WALL.x1, BAY.z1 + 4, [-1, 0]);
    for (const g of gal) { g.computeBoundingBox(); const c = g.boundingBox.getCenter(V()); put(c.x, c.z, { plank: [g] }, { solid: false, shadow: false }); }
    for (const r of rails) { r.computeBoundingBox(); const c = r.boundingBox.getCenter(V()); kitAt(c.x, c.z).kit.add(M.strut, r, LOOSE); }
  }

  return { walls, furnaces, add: bagAdd, put, finish() {
    // (the walls as meshes of their own: solid, never taken hold of to climb; one mesh a material)
    const byMat = new Map();
    for (const { m, list } of wallMeshes.values()) { if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push(...list.map((g) => (g.index ? g.toNonIndexed() : g))); }
    for (const [m, list] of byMat) {
      const mesh = new THREE.Mesh(mergeGeometries(list), m);
      mesh.name = 'the foundry’s walls'; mesh.userData.noClimb = true;
      root.add(mesh); walls.push(mesh);
    }
    for (const { m, solid, shadow, list } of bag.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(list), m);
      mesh.name = `the enclosure${solid ? ' (solid)' : ''}`;
      if (!solid) mesh.userData.noCollide = true;
      if (!shadow) noShadow.push(mesh);
      root.add(mesh);
    }
    return walls;
  } };
}

/**
 * The chains hung from the roof (pure placement: tests): [x, z, length] in the open bays, clear of the moons, the
 * cranes' runs, the gantry and the walls. `clear(x, z)`: the level's own say on where nothing hangs.
 */
export function chainSpots(clear = () => true, n = 46, seed = 73120) {
  const rng = mulberry32(seed), out = [];
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    const x = HALL.x0 + 8 + rng() * (HALL.x1 - HALL.x0 - 16), z = HALL.z0 + 8 + rng() * (HALL.z1 - HALL.z0 - 16);
    if (!clear(x, z) || out.some(([a, b]) => Math.hypot(a - x, b - z) < 9)) continue;
    out.push([x, z, 18 + rng() * rng() * 46]);
  }
  return out;
}

/** A chain's drawn pieces from (x, top, z) down `len` m: its links as a thin line, a few fat links at the foot, a hook. */
export function chainParts(x, top, z, len, V) {
  const strut = [bar(V(x, top, z), V(x, top - len + 1.4, z), 0.07, 0.07, 3)];
  const dark = [];
  for (let k = 0; k < 4; k++) dark.push(plain(new THREE.TorusGeometry(0.22, 0.06, 4, 8)).rotateY((k % 2) * Math.PI / 2).translate(x, top - len + 1.4 - k * 0.36, z));
  dark.push(plain(new THREE.TorusGeometry(0.42, 0.09, 4, 10, Math.PI * 1.4)).rotateZ(Math.PI * 0.8).translate(x + 0.1, top - len - 0.4, z));
  return { strut, dark };
}
