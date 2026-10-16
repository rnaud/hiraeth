// A makers' house's plan, read from what its layout built (issue #405; docs/systems/temples.md "The house's map"): the
// kit's chart (src/temples/kit.js TempleKit.chart: halls, round halls, corridors, walls with their doorways, slabs,
// stairs, ramps, bridges, shafts), the pieces it placed (src/temples/runtime.js rt.placed: { cls, o }) and the house's
// logic (its rooms and links). Nothing drawn by hand: a house remade (#401's Footprint, #383's ways in) maps as it is.
// Shared by the house's map in the game (src/house-map.js) and the Temple maps page (src/temple-maps/makers.js).
//
//   chartPlan(chart)                      the chart as the page lists it: walls and rooms first, then the floors
//   floorsOf(ys, gap) / floorAt(fs, y)    heights grouped into floors, and the floor a height is on
//   roomPlaces(logic, pieces, o)          { room: [x, y, z] } where each room is (its marks and its elements' pieces)
//   onFloors(plan, floors)                the plan's shapes, each with its floor (and `to`: the floor a way up reaches)
//   boundsOf(shapes, rooms)               [x0, z0, x1, z1] round them all
//   housePlan({ logic, chart, pieces, arena })  → the map's plan: floors, rooms, shapes (each with its room), doors
//   roomAt(plan, [x, y, z])               the room a point stands in (the traveller's, for the rooms seen)
//
// All in the kit's local metres (rt.kit.local / rt.kit.world).

import { piecePos, centroid } from '../../scripts/temple-design/lib.mjs';

/** The kinds of the chart the kit records for a skin's plan too (walls and rooms); the rest are its floors and ways up. */
const ROOMS = new Set(['wall', 'hall', 'round', 'corridor']);
/** The chart in the page's order: the walls and rooms first, then the floors (as the page recorded them, #396). */
export const chartPlan = (chart = []) => [...chart.filter((e) => ROOMS.has(e.kind)), ...chart.filter((e) => !ROOMS.has(e.kind))];

// ------------------------------------------------------------------ floors
/** Heights grouped into floors: a new floor wherever the next height is more than `gap` m over the last. */
export function floorsOf(ys, gap = 4.5) {
  const s = [...new Set(ys.filter(Number.isFinite).map((y) => Math.round(y * 10) / 10))].sort((a, b) => a - b);
  const out = [];
  for (const y of s) { const f = out.at(-1); if (f && y - f.top <= gap) { f.top = y; f.ys.push(y); } else out.push({ y, top: y, ys: [y] }); }
  // (each floor at its most common height: the floor you stand on, its ledges a little over it)
  const ground = out.reduce((b, f) => (Math.abs(f.y) < Math.abs(b.y) ? f : b), out[0] ?? { y: 0 });
  return out.map((f, i) => ({ id: `f${i}`, y: f.y, top: f.top, name: f === ground ? 'ground floor' : f.y > ground.y ? `up ${Math.round(f.y - ground.y)} m` : `down ${Math.round(ground.y - f.y)} m` }));
}
export const floorAt = (floors, y) => floors.reduce((b, f) => (Math.abs(y - (f.y + f.top) / 2) - (f.top - f.y) / 2 < Math.abs(y - (b.y + b.top) / 2) - (b.top - b.y) / 2 ? f : b), floors[0])?.id ?? 'f0';

// ------------------------------------------------------------------ the rooms
/**
 * Where each room is: the middle of its marks and its elements' pieces (as the design audit's puzzleGraph has it), at
 * its mark's height (else its lowest piece's); the guardian's hall at its arena's middle (`arena`: local [x, y, z]); a
 * room with nothing of its own placed halfway along its links.
 */
export function roomPlaces(logic, pieces = [], { arena = null } = {}) {
  const E = logic.elements ?? {}, rooms = Object.keys(logic.rooms ?? {}), links = logic.links ?? [];
  // (the pieces by the ids they answer to: the audit's (its last of an id), and the first one placed with a place)
  const last = new Map(), first = new Map();
  for (const p of pieces) {
    const pos = piecePos(p.o);
    for (const k of ['id', 'bloom', 'still']) if (p.o?.[k] && !last.has(p.o[k])) last.set(p.o[k], pos);
    if (p.o?.id) last.set(p.o.id, pos);
    for (const k of [p.o?.id, p.o?.bloom, p.o?.still]) if (k && pos && !first.has(k)) first.set(k, pos);
  }
  const marks = {}, pts = Object.fromEntries(rooms.map((r) => [r, []]));
  for (const p of pieces) if (p.cls === 'Mark' && p.o?.room) { const pos = piecePos(p.o); marks[p.o.room] = pos; pts[p.o.room]?.push(pos); }
  for (const [id, e] of Object.entries(E)) if (e.room && pts[e.room] && last.get(id)) pts[e.room].push(last.get(id));
  const mid = Object.fromEntries(rooms.map((r) => [r, centroid(pts[r])]));
  for (const r of rooms) if (!mid[r]) mid[r] = centroid(links.filter((l) => l.a === r || l.b === r).map((l) => mid[l.a === r ? l.b : l.a]).filter(Boolean));
  const at = {};
  for (const r of rooms) {
    const g = mid[r];
    if (!g) { at[r] = null; continue; }
    const ys = Object.entries(E).filter(([k, e]) => e.room === r && first.get(k)).map(([k]) => first.get(k)[1]);
    at[r] = [g[0], marks[r]?.[1] ?? Math.min(g[1], ...ys), g[2]];
  }
  const boss = Object.entries(logic.rooms ?? {}).find(([, r]) => r.boss)?.[0];
  if (arena && boss) at[boss] = [arena[0], at[boss]?.[1] ?? arena[1], arena[2]];
  for (let pass = 0; pass < 3; pass++) for (const r of rooms) if (!at[r]) { const n = links.filter((l) => l.a === r || l.b === r).map((l) => at[l.a === r ? l.b : l.a]).filter(Boolean); if (n.length) at[r] = n[0].map((_, k) => n.reduce((s, p) => s + p[k], 0) / n.length); }
  for (const r of rooms) at[r] ??= [0, 0, 0];
  return at;
}

// ------------------------------------------------------------------ the shapes
const yOf = (e) => (e.kind === 'wall' ? e.y0 : e.kind === 'stairs' || e.kind === 'ramp' || e.kind === 'bridge' ? Math.min(e.a[1], e.b[1]) : e.y ?? 0);
const WAYS = new Set(['stairs', 'ramp', 'bridge']);
/** The plan's shapes on their floors, and what carries you up read from the pieces (the riding discs, the updrafts). */
export function onFloors(plan, floors, pieces = []) {
  const shapes = plan.map((e) => ({ ...e, hasFloor: e.floor !== false, floor: floorAt(floors, yOf(e)), ...(WAYS.has(e.kind) ? { floor: floorAt(floors, Math.min(e.a[1], e.b[1])), to: floorAt(floors, Math.max(e.a[1], e.b[1])) } : {}),
    // (a lift the layout built itself, the Footprint's great lift: kit.js chartNote)
    ...(e.kind === 'lift' ? { floor: floorAt(floors, Math.min(...e.path.map((q) => q[1]))), to: floorAt(floors, Math.max(...e.path.map((q) => q[1]))) } : {}) }));
  for (const p of pieces) {
    const pos = piecePos(p.o);
    if (!pos) continue;
    if (p.cls === 'Platform') shapes.push({ kind: 'lift', path: (p.o.path ?? []).map((q) => [q[0], q[1], q[2]]), r: p.o.r ?? 2.2, floor: floorAt(floors, Math.min(...(p.o.path ?? [pos]).map((q) => q[1]))), to: floorAt(floors, Math.max(...(p.o.path ?? [pos]).map((q) => q[1]))), id: p.o.id ?? null });
    if (p.cls === 'Updraft') shapes.push({ kind: 'updraft', x: pos[0], z: pos[2], r: p.o.r ?? 4.5, y: pos[1], top: pos[1] + (p.o.h ?? 22), floor: floorAt(floors, pos[1]), to: floorAt(floors, pos[1] + (p.o.h ?? 22)), id: p.o.id ?? null });
  }
  return shapes;
}

const round1 = (v) => Math.round(v * 10) / 10;
export function boundsOf(shapes, rooms) {
  const xs = [], zs = [];
  const add = (x, z) => { if (Number.isFinite(x) && Number.isFinite(z)) { xs.push(x); zs.push(z); } };
  for (const s of shapes) {
    if (s.kind === 'hall') { add(s.x - s.w / 2, s.z - s.d / 2); add(s.x + s.w / 2, s.z + s.d / 2); }
    else if (s.kind === 'ring') { add(s.x - s.r1, s.z - s.r1); add(s.x + s.r1, s.z + s.r1); }
    else if (s.kind === 'round' || s.kind === 'shaft' || s.kind === 'updraft') { add(s.x - s.r, s.z - s.r); add(s.x + s.r, s.z + s.r); }
    else if (s.kind === 'corridor' || s.kind === 'slab') { add(s.x0, s.z0); add(s.x1, s.z1); }
    else if (s.kind === 'wall') { add(s.a[0], s.a[1]); add(s.a[0] + s.dir[0] * s.L, s.a[1] + s.dir[1] * s.L); }
    else if (s.a) { add(s.a[0], s.a[2]); add(s.b[0], s.b[2]); }
    else if (s.path) for (const p of s.path) add(p[0], p[2]);
  }
  for (const r of rooms) add(r.pos[0], r.pos[2]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)].map(round1);
}

// ------------------------------------------------------------------ where a point is
const segDist = (px, pz, a, b) => {
  const dx = b[0] - a[0], dz = b[2] - a[2], L2 = dx * dx + dz * dz || 1;
  const k = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[2]) * dz) / L2));
  return Math.hypot(px - (a[0] + dx * k), pz - (a[2] + dz * k));
};
/** Is (x, z) on a shape's floor (`m` m of slack round it)? */
export function covers(s, x, z, m = 0) {
  switch (s.kind) {
    case 'hall': return Math.abs(x - s.x) <= s.w / 2 + m && Math.abs(z - s.z) <= s.d / 2 + m;
    case 'round': return Math.hypot(x - s.x, z - s.z) <= s.r + m;
    case 'updraft': return Math.hypot(x - s.x, z - s.z) <= s.r + m;
    case 'corridor': case 'slab': return x >= s.x0 - m && x <= s.x1 + m && z >= s.z0 - m && z <= s.z1 + m;
    case 'stairs': case 'ramp': case 'bridge': return segDist(x, z, s.a, s.b) <= s.w / 2 + m;
    case 'lift': return s.path.some((p) => Math.hypot(x - p[0], z - p[2]) <= s.r + m);
    case 'ring': return onRing(s, x, z, m);
    default: return false;
  }
}
/** On a balcony's ring (between its radii, within its arc, not in one of its holes)? Angles: 0 toward +z, toward +x. */
export function onRing(s, x, z, m = 0) {
  const dx = x - s.x, dz = z - s.z, r = Math.hypot(dx, dz);
  if (r < s.r0 - m || r > s.r1 + m) return false;
  const TAU = Math.PI * 2, span = s.a1 - s.a0;
  if (span < TAU - 1e-3 && (((Math.atan2(dx, dz) - s.a0) % TAU) + TAU) % TAU > span + m / Math.max(r, 1)) return false;
  return !(s.holes ?? []).some((h) => Math.hypot(x - h.x, z - h.z) < h.r - m);
}
/** The floor kinds: what you stand on (a room's floor, a passage, a ledge, a balcony's ring, a way up). */
export const FLOORS = new Set(['hall', 'round', 'corridor', 'slab', 'ring', 'stairs', 'ramp', 'bridge', 'lift', 'updraft']);
const areaOf = (s) => (s.kind === 'ring' ? ((s.r1 ** 2 - s.r0 ** 2) * (s.a1 - s.a0)) / 2 : s.kind === 'hall' ? s.w * s.d : s.kind === 'round' || s.kind === 'updraft' ? Math.PI * s.r * s.r : s.kind === 'corridor' || s.kind === 'slab' ? (s.x1 - s.x0) * (s.z1 - s.z0) : WAYS.has(s.kind) ? Math.hypot(s.b[0] - s.a[0], s.b[2] - s.a[2]) * s.w : s.kind === 'lift' ? Math.PI * s.r * s.r : Infinity);
const heightsOf = (s) => (WAYS.has(s.kind) ? [Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])] : s.kind === 'lift' ? [Math.min(...s.path.map((p) => p[1])), Math.max(...s.path.map((p) => p[1]))] : s.kind === 'updraft' ? [s.y, s.top] : [s.y ?? 0, s.y ?? 0]);
const middleOf = (s) => (s.kind === 'ring' ? [s.x + Math.sin((s.a0 + s.a1) / 2) * (s.r0 + s.r1) / 2, s.z + Math.cos((s.a0 + s.a1) / 2) * (s.r0 + s.r1) / 2] : s.kind === 'hall' || s.kind === 'round' || s.kind === 'updraft' ? [s.x, s.z] : s.kind === 'corridor' || s.kind === 'slab' ? [(s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2] : WAYS.has(s.kind) ? [(s.a[0] + s.b[0]) / 2, (s.a[2] + s.b[2]) / 2] : s.kind === 'lift' ? [s.path[0][0], s.path[0][2]] : s.kind === 'wall' ? [s.a[0] + s.dir[0] * s.L / 2, s.a[1] + s.dir[1] * s.L / 2] : [s.x ?? 0, s.z ?? 0]);
/** How far a point is from a wall (across, in plan). */
const wallDist = (w, p) => { const u = Math.max(0, Math.min(w.L, (p[0] - w.a[0]) * w.dir[0] + (p[2] - w.a[1]) * w.dir[1])); return Math.hypot(p[0] - (w.a[0] + w.dir[0] * u), p[2] - (w.a[1] + w.dir[1] * u)); };
/** How far a room is from a place, its height counting thrice (a room over or under is far). */
const near = (r, x, y, z) => Math.hypot(r.pos[0] - x, r.pos[2] - z) + 3 * Math.abs(r.pos[1] - y);

// ------------------------------------------------------------------ the map's plan
/**
 * The house's plan for its map: its floors (from the rooms' heights), its rooms (where, on which floor, the guardian's,
 * the way in), its shapes each with the room it belongs to (a floor: the room standing on it, else the nearest on its
 * floor; a wall: the two nearest, `rooms`), and its doors (each link's door: where, the rooms either side, its lock).
 * `arena`: the guardian's arena's middle (local), the guardian's hall drawn there.
 */
export function housePlan({ logic, chart = [], pieces = [], arena = null }) {
  const at = roomPlaces(logic, pieces, { arena });
  const floors = floorsOf(Object.values(at).map((p) => p[1]));
  const rooms = Object.keys(logic.rooms ?? {}).map((id) => ({ id, pos: at[id].map(round1), floor: floorAt(floors, at[id][1]), boss: !!logic.rooms[id].boss, entry: id === logic.entry }));
  const plan = chartPlan(chart);
  const shapes = onFloors(plan, floors, pieces);
  const marks = pieces.filter((p) => p.cls === 'Mark' && p.o?.room && logic.rooms?.[p.o.room] && piecePos(p.o)).map((p) => ({ id: p.o.room, pos: piecePos(p.o) }));
  for (const s of shapes) {
    const [x, z] = middleOf(s), [y0] = s.kind === 'wall' ? [s.y0] : heightsOf(s);
    // a wall (a round hall's too) stands on every floor it rises past (a well's, a tall hall's), and belongs to the
    // rooms beside it at the heights it spans
    if (s.kind === 'wall' || s.kind === 'round') {
      const lo = s.kind === 'wall' ? s.y0 : s.y, hi = lo + (s.h ?? 0);
      s.floors = floors.filter((f) => f.id === s.floor || (f.top >= lo + 1 && f.y <= hi - 2)).map((f) => f.id);
      const by = rooms.filter((r) => r.pos[1] >= lo - 2 && r.pos[1] <= hi + 1).map((r) => [r.id, s.kind === 'wall' ? wallDist(s, r.pos) : Math.max(0, Math.hypot(r.pos[0] - s.x, r.pos[2] - s.z) - s.r)]).sort((a, b) => a[1] - b[1]);
      s.rooms = s.kind === 'round' ? by.filter(([, d]) => d < 1.5).map(([id]) => id) : by.slice(0, 2).filter(([, d], i) => i === 0 || d < by[0][1] * 1.6 + 4).map(([id]) => id);
      if (s.kind === 'wall') { if (!s.rooms.length) s.rooms = [rooms.reduce((b, r) => (!b || near(r, x, y0, z) < near(b, x, y0, z) ? r : b), null)?.id].filter(Boolean); s.room = s.rooms[0] ?? null; continue; }
    }
    // (a floor: the room whose mark stands on it, else whose middle does; or, none, the nearest room on its floor)
    const pick = (list) => list.reduce((b, r) => (!b || near(r, x, y0, z) < near(b, x, y0, z) ? r : b), null);
    const marked = marks.filter((r) => Math.abs(r.pos[1] - y0) < 4 && covers(s, r.pos[0], r.pos[2], 0.5));
    const on = rooms.filter((r) => Math.abs(r.pos[1] - y0) < 4 && covers(s, r.pos[0], r.pos[2], 1));
    s.room = (pick(marked) ?? pick(on) ?? pick(rooms))?.id ?? null;
    if (s.kind === 'round' && s.room && !s.rooms.includes(s.room)) s.rooms.unshift(s.room);
  }
  // the doors: each link's door where its piece stands (else the doorway nearest the way between its rooms)
  const E = logic.elements ?? {};
  const pos = new Map();
  for (const p of pieces) { const q = piecePos(p.o); if (p.o?.id && q && !pos.has(p.o.id)) pos.set(p.o.id, q); }
  const boss = rooms.find((r) => r.boss)?.id ?? null;
  const resolved = (c) => !!c && (Array.isArray(c) ? c.some(resolved) : !!c.resolved || resolved(c.all) || resolved(c.any));
  // (the guardian's door: the one into its hall, or into the open rooms before it: an antechamber with no door of its own)
  const zone = new Set(boss ? [boss] : []);
  for (let grew = true; grew;) {
    grew = false;
    for (const l of logic.links ?? []) if (!l.door && (zone.has(l.a) !== zone.has(l.b))) { zone.add(l.a); zone.add(l.b); grew = true; }
  }
  const doors = [];
  for (const l of logic.links ?? []) {
    const e = l.door ? E[l.door] : null;
    if (!e || (e.type !== 'door' && e.type !== 'bridge')) continue;
    if (doors.some((d) => d.id === l.door)) continue;
    const A = at[l.a], B = at[l.b], p = pos.get(l.door) ?? (A && B ? A.map((v, k) => (v + B[k]) / 2) : null);
    if (!p) continue;
    const toBoss = zone.has(l.a) !== zone.has(l.b) && !resolved(e.opens);
    doors.push({ id: l.door, a: l.a, b: l.b, pos: p.map(round1), floor: floorAt(floors, p[1]), bridge: e.type === 'bridge', lock: e.lock ?? null, guardian: toBoss, way: resolved(e.opens) });
  }
  return { floors, rooms, shapes, doors, bounds: boundsOf(shapes, rooms), boss, entry: logic.entry };
}

/**
 * The room a point (local [x, y, z]) stands in: the smallest floor under it (a ledge in a hall over the hall, a passage
 * over the rooms it joins), within a storey of its height; else the nearest room. Null with no rooms.
 */
export function roomAt(plan, [x, y, z]) {
  let best = null, area = Infinity;
  for (const s of plan.shapes) {
    if (!FLOORS.has(s.kind) || !s.room || (s.hasFloor === false && s.kind !== 'lift')) continue;
    const [lo, hi] = heightsOf(s);
    if (y < lo - 1.5 || y > hi + 5 || !covers(s, x, z, 0.3)) continue;
    const a = areaOf(s);
    if (a < area) { area = a; best = s.room; }
  }
  if (best) return best;
  return plan.rooms.reduce((b, r) => (!b || near(r, x, y, z) < near(b, x, y, z) ? r : b), null)?.id ?? null;
}
