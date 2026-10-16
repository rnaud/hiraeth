// A fight temple drawn anew for each run (issue #386; docs/design/fight-temples.md "Each run its own"): a world's table
// is its theme — its rooms (the pieces), its foes, its hazard, its look — and a seed draws a run from it: the middle
// rooms shuffled (the entrance first, the room with the altar and the tough ones last) and laid out afresh, door to door
// off each room's far sides; each room mirrored or not (its springs, pillars, hazard lanes, signs and lamps with it) and
// a spring or two left out; each wave drawn from the world's pool of foes within the budget its place in the run had in
// the table (the difficulty curve kept), the gorged ones where the table had them, the tough ones last. The result is a
// table of the same form (rooms.js, session.js and the tests read it as they read a hand-laid one), its `seed` with it.
//
//   drawRun(def, seed)   → a table: the run's rooms, doors, waves, spawn; `seed`, `order` (the theme's room ids)
//   seedOf(search)        the run's seed: ?seed=<n> in the page's address, else a fresh one
//   foePool(def)          the theme's foes as the draw reads them: { light: { kind: weight }, gorged: [kinds], tough }
//   waveCost(wave)        what a wave spends: a foe's heads × its cuts (rules.js headOf, LIGHT_HP), a gorged one 4

import { headOf, lightHp, roomWaves, doorGap as doorGapOf } from './rules.js';
import { FOES } from '../foes.js';

/** A small seeded random (mulberry32): the same seed, the same run. */
export function rngOf(seed) {
  // (the seed stirred first: seeds next to one another start far apart)
  let a = Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) >>> 0;
  a = (a ^ (a >>> 13)) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** The run's seed: ?seed=<n> (a replay), else a fresh one, 1 … 999 999. */
export function seedOf(search = globalThis.location?.search ?? '') {
  const s = Number(new URLSearchParams(search).get('seed'));
  return Number.isFinite(s) && s > 0 ? Math.floor(s) : 1 + Math.floor(Math.random() * 999999);
}

const hpOf = (k) => FOES[k]?.hp ?? 2;
/** One foe's cost: its heads × its cuts (a light one); a gorged one `GEN.gorged`; a tough one its kind's health. */
export const GEN = { gorged: 4, gap: 2, overlap: 6, tries: 400, dropSpring: 0.5, reach: 74 };
// (reach: how far from the middle a room may stand: the hall's ground is 170 m across, rooms.js)
export const foeCost = (q) => (q.tough ? hpOf(q.kind) : q.gorged ? GEN.gorged : headOf(q.kind) * lightHp(q.kind, hpOf(q.kind)));
export const waveCost = (wave) => wave.reduce((a, q) => a + foeCost(q), 0);

/** The theme's foes: the light kinds by how many the table brings, the kinds it gorges, its tough ones (the last wave's). */
export function foePool(def) {
  const light = {}, gorged = new Set(), tough = [];
  def.rooms.forEach((r, i) => (r.waves ?? []).forEach((w, wi) => w.forEach(([kind, n, o = {}]) => {
    if (o.tough) { if (i === def.rooms.length - 1 && wi === r.waves.length - 1) tough.push([kind, n, o]); return; }
    if (o.gorged) { gorged.add(kind); return; }
    light[kind] = (light[kind] ?? 0) + n;
  })));
  return { light, gorged: [...gorged], tough, ...(def.pool ?? {}) };
}

/** A weighted pick from { kind: weight }. */
function pick(w, rng) {
  const e = Object.entries(w).filter(([, v]) => v > 0);
  let x = rng() * e.reduce((a, [, v]) => a + v, 0);
  for (const [k, v] of e) if ((x -= v) <= 0) return k;
  return e.at(-1)[0];
}
/** Fisher–Yates with the run's random. */
function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * One wave drawn for a budget: the pool's light kinds by weight until the budget is spent (to within the cheapest),
 * `gorged` gorged ones of the kinds the theme gorges, `tough` (the last wave's) first. As table entries.
 */
export function drawWave(pool, budget, { gorged = 0, tough = [] } = {}, rng = Math.random) {
  const counts = new Map(), add = (kind, n = 1, o) => { const key = `${kind}|${o?.tough ? 't' : o?.gorged ? 'g' : ''}`; const c = counts.get(key); if (c) c[1] += n; else counts.set(key, [kind, n, ...(o ? [o] : [])]); };
  let spent = 0;
  for (const [kind, n, o] of tough) { add(kind, n, o); spent += n * foeCost({ kind, tough: true }); }
  for (let g = 0; g < gorged && pool.gorged.length; g++) { add(pool.gorged[Math.floor(rng() * pool.gorged.length)], 1, { gorged: true }); spent += GEN.gorged; }
  const cheapest = Math.min(...Object.keys(pool.light).map((k) => foeCost({ kind: k })));
  for (let guard = 0; spent < budget - cheapest * 0.5 && guard < 400; guard++) {
    const kind = pick(pool.light, rng), c = foeCost({ kind });
    if (spent + c > budget + cheapest * 0.5) { if (c <= cheapest + 1e-9) break; continue; }
    add(kind, 1); spent += c;
  }
  // (the light ones first in the table, the gorged and the tough after: the session sorts the tough last anyway)
  return [...counts.values()].sort((a, b) => (a[2] ? 1 : 0) - (b[2] ? 1 : 0));
}

// ------------------------------------------------------------------ the rooms: relative pieces, mirrored, laid out
/** A table's room as a piece: its size and everything in it relative to its middle. */
export function pieceOf(r) {
  const cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2, P = ([x, z]) => [x - cx, z - cz];
  const hz = r.hazard ? { ...r.hazard } : null;
  if (hz?.lanes) hz.lanes = hz.lanes.map((l) => (l.at == null ? { ...l } : { ...l, at: l.at - (l.along === 'x' ? cz : cx) }));
  if (hz?.signs) hz.signs = hz.signs.map(P);
  if (hz?.lamps) hz.lamps = hz.lamps.map(P);
  return { id: r.id, name: r.name, w: r.x[1] - r.x[0], d: r.z[1] - r.z[0], springs: (r.springs ?? []).map(P), pillars: (r.pillars ?? []).map(P),
    ...(r.altar ? { altar: P(r.altar) } : {}), ...(r.basin ? { basin: [...P(r.basin), r.basin[2]] } : {}), ...(hz ? { hazard: hz } : {}), ...(r.geysers ? { geysers: r.geysers } : {}) };
}
/** A piece mirrored across x (`mx`) and/or z (`mz`): everything in it flipped, the lanes' ways with it. */
export function mirrorPiece(p, mx, mz) {
  const F = ([x, z]) => [mx ? -x : x, mz ? -z : z];
  const out = { ...p, springs: p.springs.map(F), pillars: p.pillars.map(F), ...(p.altar ? { altar: F(p.altar) } : {}), ...(p.basin ? { basin: [...F(p.basin), p.basin[2]] } : {}) };
  if (p.hazard) {
    const h = out.hazard = { ...p.hazard };
    if (h.lanes) h.lanes = h.lanes.map((l) => {
      const flipAt = l.along === 'x' ? mz : mx, flipDir = l.along === 'x' ? mx : mz;
      return { ...l, ...(l.at == null ? {} : { at: flipAt ? -l.at : l.at }), dir: flipDir ? -l.dir : l.dir };
    });
    if (h.signs) h.signs = h.signs.map(F);
    if (h.lamps) h.lamps = h.lamps.map(F);
  }
  return out;
}
/** A piece set in the world, its middle at (cx, cz): a table room. */
export function placePiece(p, cx, cz, waves) {
  const A = ([x, z]) => [x + cx, z + cz];
  const hz = p.hazard ? { ...p.hazard } : null;
  if (hz?.lanes) hz.lanes = hz.lanes.map((l) => (l.at == null ? { ...l } : { ...l, at: l.at + (l.along === 'x' ? cz : cx) }));
  if (hz?.signs) hz.signs = hz.signs.map(A);
  if (hz?.lamps) hz.lamps = hz.lamps.map(A);
  return { id: p.id, name: p.name, x: [cx - p.w / 2, cx + p.w / 2], z: [cz - p.d / 2, cz + p.d / 2], springs: p.springs.map(A), pillars: p.pillars.map(A),
    ...(p.altar ? { altar: A(p.altar) } : {}), ...(p.basin ? { basin: [...A(p.basin), p.basin[2]] } : {}), ...(hz ? { hazard: hz } : {}), ...(p.geysers ? { geysers: p.geysers } : {}), waves };
}
const inReach = (r, G) => [r.x[0], r.x[1], r.z[0], r.z[1]].every((v) => Math.abs(v) <= G.reach);
/** How far apart two rooms are along an axis (negative: they overlap on it). */
const gapOf = (a, b, k) => Math.max(a[k][0] - b[k][1], b[k][0] - a[k][1]);
/** Do two rooms keep a wall between them (at least `gap` m apart one way or the other)? */
export const apart = (a, b, gap = GEN.gap) => gapOf(a, b, 'x') >= gap - 1e-9 || gapOf(a, b, 'z') >= gap - 1e-9;

/**
 * The rooms laid out, the first where the table has it, each next one off the last one's north or west side (the far
 * sides from the camera: its gate is seen), 2 m on (one wall between), slid along so their sides overlap by at least
 * `overlap` m and the door (4 m) sits in the overlap, never closer than a wall to any room before it. Whole metres.
 * Returns { rooms (x, z), doors } or null.
 */
export function layOut(pieces, first, rng, G = GEN) {
  const placed = [{ x: first.x.slice(), z: first.z.slice() }], doors = [];
  for (let i = 1; i < pieces.length; i++) {
    const p = pieces[i], prev = placed[i - 1];
    let ok = null;
    for (let t = 0; t < 40 && !ok; t++) {
      const side = (rng() < 0.5) ? 'n' : 'w';
      if (side === 'n') {
        const lo = prev.x[0] - p.w + G.overlap, hi = prev.x[1] - G.overlap;
        if (hi < lo) continue;
        const x0 = Math.round(lo + rng() * (hi - lo)), z1 = prev.z[0] - G.gap;
        const r = { x: [x0, x0 + p.w], z: [z1 - p.d, z1] };
        if (!inReach(r, G) || !placed.every((q, k) => k === i - 1 || apart(q, r))) continue;
        const ov = [Math.max(prev.x[0], r.x[0]), Math.min(prev.x[1], r.x[1])], mid = (ov[0] + ov[1]) / 2;
        ok = { r, door: { from: i - 1, to: i, side: 'n', at: Math.round(mid - (prev.x[0] + prev.x[1]) / 2), w: 4 } };
      } else {
        const lo = prev.z[0] - p.d + G.overlap, hi = prev.z[1] - G.overlap;
        if (hi < lo) continue;
        const z0 = Math.round(lo + rng() * (hi - lo)), x1 = prev.x[0] - G.gap;
        const r = { x: [x1 - p.w, x1], z: [z0, z0 + p.d] };
        if (!inReach(r, G) || !placed.every((q, k) => k === i - 1 || apart(q, r))) continue;
        const ov = [Math.max(prev.z[0], r.z[0]), Math.min(prev.z[1], r.z[1])], mid = (ov[0] + ov[1]) / 2;
        ok = { r, door: { from: i - 1, to: i, side: 'w', at: Math.round(mid - (prev.z[0] + prev.z[1]) / 2), w: 4 } };
      }
      // (the door's gap must miss the previous room's pillars and springs by a little: rooms.js cuts it through the wall)
    }
    if (!ok) return null;
    placed.push(ok.r); doors.push(ok.door);
  }
  return { rooms: placed, doors };
}

/**
 * The run: the theme's rooms in a drawn order, mirrored, laid out; each room's waves drawn for the budget of its place
 * (the table's room at that place: the curve kept). A draw that cannot be laid out is drawn again (a new random from the
 * same seed); the table as it is if none can (it never happened in the tests' thousands).
 */
export function drawRun(def, seed = seedOf()) {
  const rng = rngOf(seed);
  const pool = foePool(def), base = def.rooms, n = base.length;
  const budgets = base.map((r) => roomWaves(r, { hpOf }).map(waveCost));
  const gorgedAt = base.map((r) => (r.waves ?? []).map((w) => w.filter(([, , o]) => o?.gorged).reduce((a, [, k]) => a + k, 0)));
  for (let attempt = 0; attempt < GEN.tries; attempt++) {
    const middle = shuffle(base.slice(1, -1).map((r, i) => i + 1), rng);
    const order = [0, ...middle, n - 1];
    const pieces = order.map((k) => {
      let p = pieceOf(base[k]);
      const mx = rng() < 0.5, mz = k !== 0 && rng() < 0.5;   // (the entrance never turned round: its spawn stays where it was)
      p = mirrorPiece(p, mx, mz);
      p.mx = mx;
      // (a spring or two left out of the bigger rooms, at least three kept)
      if (p.springs.length > 3 && rng() < GEN.dropSpring) { const out = Math.floor(rng() * p.springs.length); p.springs = p.springs.filter((_, j) => j !== out); }
      return p;
    });
    const lay = layOut(pieces, base[0], rng);
    if (!lay) continue;
    const rooms = pieces.map((p, i) => {
      const r = lay.rooms[i], cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2;
      const last = i === n - 1;
      const waves = budgets[i].map((b, wi) => drawWave(pool, b, { gorged: gorgedAt[i][wi] ?? 0, tough: last && wi === budgets[i].length - 1 ? pool.tough : [] }, rng));
      return placePiece(p, cx, cz, waves);
    });
    // (a sign that the layout put in a doorway is taken down: rooms.js cuts the door through the wall it hung on)
    const gaps = lay.doors.map((d) => doorGapOf(rooms, d));
    for (const r of rooms) if (r.hazard?.signs) {
      const clear = ([x, z]) => !gaps.some((g) => x >= g.x[0] - 1.2 && x <= g.x[1] + 1.2 && z >= g.z[0] - 1.2 && z <= g.z[1] + 1.2);
      let keep = r.hazard.signs.filter(clear);
      // (none left: hung again round its walls where no door is, the far ones first)
      if (!keep.length) {
        const cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2, w = r.x[1] - r.x[0], d = r.z[1] - r.z[0];
        keep = [[Math.round(cx - w / 3), r.z[0]], [Math.round(cx + w / 3), r.z[0]], [r.x[0], Math.round(cz - d / 3)], [r.x[0], Math.round(cz + d / 3)], [Math.round(cx), r.z[1]], [r.x[1], Math.round(cz)]].filter(clear).slice(0, 2);
      }
      r.hazard = { ...r.hazard, signs: keep, n: Math.min(r.hazard.n ?? 1, Math.max(1, keep.length)) };
    }
    const cx0 = (base[0].x[0] + base[0].x[1]) / 2, spawn = def.spawn.slice();
    if (pieces[0].mx) spawn[0] = cx0 - (def.spawn[0] - cx0);   // (the entrance mirrored across x: its spawn with it)
    return { ...def, rooms, doors: lay.doors, spawn, seed, order: order.map((k) => base[k].id) };
  }
  return { ...def, seed, order: base.map((r) => r.id) };
}

// ------------------------------------------------------------------ a short theme: a new world's temple in a few lines
/**
 * A world's temple from a short theme (docs/design/fight-temples.md "A theme"): another temple's rooms for its pieces
 * (`rooms`: a table; their waves give the budget curve, not the foes), its own foes (`foes`: { light: { kind: weight },
 * gorged: [kinds], tough: [[kind, n, { tough: true }]] }), its hazard by kind (`hazard`: a hazards.js kind; its lanes,
 * signs or lamps laid in each room by the room's own shape, as often as the pieces' own hazards came), and its look,
 * host and door as any table. Returns a full table, drawn per run as any other.
 */
export function fromTheme(t) {
  const base = t.rooms, kind = t.hazard;
  const rooms = base.rooms.map((r, i) => {
    const { hazard: h0, geysers, ...rest } = r;
    if (i === 0) return { ...rest };
    const every = h0?.every ?? geysers?.every ?? 6, n = h0?.n ?? geysers?.n ?? 1;
    return { ...rest, hazard: { kind, every, n, ...hazardLayout(kind, r) } };
  });
  const { rooms: _r, hazard: _h, foes, ...look } = t;
  return { ...look, rooms, doors: base.doors, spawn: t.spawn ?? base.spawn, par: t.par ?? base.par, pool: foes };
}
/** A hazard's lanes, signs or lamps for a room, from its shape: clear of its pillars and its altar. */
export function hazardLayout(kind, r) {
  const cx = (r.x[0] + r.x[1]) / 2, cz = (r.z[0] + r.z[1]) / 2, w = r.x[1] - r.x[0], d = r.z[1] - r.z[0];
  const solid = [...(r.pillars ?? []), ...(r.altar ? [r.altar] : [])];
  if (kind === 'shade') return { lanes: [{ along: 'z', dir: 1 }, { along: 'x', dir: -1 }] };
  if (kind === 'dark') {
    // (four or five, apart, off what stands in the room: tried at the quarters, the thirds, the middle and the sides)
    const cand = [];
    for (const f of [0.25, 0.33, 0.18]) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cand.push([cx + sx * w * f, cz + sz * d * f]);
    cand.push([cx, cz], [cx, cz - d * 0.3], [cx, cz + d * 0.3], [cx - w * 0.3, cz], [cx + w * 0.3, cz]);
    const lamps = [];
    for (const [x, z] of cand.map(([x, z]) => [Math.round(x), Math.round(z)])) {
      if (lamps.length >= 5) break;
      if (solid.some(([a, b]) => Math.hypot(a - x, b - z) < 1.8) || lamps.some(([a, b]) => Math.hypot(a - x, b - z) < 4.2)) continue;
      lamps.push([x, z]);
    }
    return { lamps };
  }
  if (kind === 'toll') return { signs: [[Math.round(cx - w / 4), r.z[0]], [r.x[0], Math.round(cz - d / 4)], [Math.round(cx + w / 4), r.z[0]], [r.x[0], Math.round(cz + d / 4)]] };
  if (['drop', 'crack', 'spill'].includes(kind)) return {};
  // a lane kind: across the room a quarter in from each side, both ways, those that miss what stands in the room
  const W = kind === 'gust' ? 3.4 : kind === 'pour' || kind === 'cart' ? 2.4 : 2.8;
  const cand = [{ along: 'x', at: cz - d / 4, w: W, dir: 1 }, { along: 'x', at: cz + d / 4, w: W, dir: -1 }, { along: 'z', at: cx - w / 4, w: W, dir: 1 }, { along: 'z', at: cx + w / 4, w: W, dir: -1 }]
    .map((l) => ({ ...l, at: Math.round(l.at * 2) / 2 }));
  const clear = (l) => solid.every(([x, z]) => Math.abs((l.along === 'x' ? z : x) - l.at) > l.w / 2 + 1.3);
  const lanes = cand.filter(clear);
  return { lanes: lanes.length ? lanes : [cand[0]] };
}
