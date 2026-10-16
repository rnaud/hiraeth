// The temple redesign's rules (issue #336, docs/design/temple-redesign.md): bigger rooms and doors, a puzzle centred in
// its room and never threaded through a door, every room about a puzzle or a fight but not both, the foes in the middle
// of their room, the gadget found inside and used in the rooms after it. Pure: plain objects in, a report out, as
// lib.mjs (scripts/temple-design/record.mjs builds a temple and records what it needs; tests/temple-rules.test.js).
//
//   const r = templeRules({ logic, pieces, spaces, order, guardian, encounter })
//   r.rooms: [{ id, kind, declared, space, short, area, ceiling }]   r.violations: [{ rule, room, what }]
//
// spaces: the kit's rooms as the layout built them (TempleKit hall / rotunda / vestibule / corridor):
//   { shape: 'box', x0, x1, z0, z1, y, top, passage? } | { shape: 'round', x, z, r, y, top }
// pieces: [{ cls, o }] as the audit records them (o in the kit's local metres).

import { piecePos, conditionKeys } from './lib.mjs';

/** The numbers (docs/design/temple-redesign.md, "The rules"). */
export const RULES = {
  /** a room about a puzzle, a fight or the guardian: its floor's short side, its area (m, m²), its ceiling over the floor you stand on */
  room: { short: 28, area: 900, ceiling: 16 },
  /** the chest's own room */
  chest: { short: 20, ceiling: 14 },
  /** a passage (the threshold, an antechamber, a corridor): its ceiling */
  passage: { ceiling: 8 },
  /** a door between two rooms: its width and its height (m) */
  door: { w: [6, 10], h: [8, 12] },
  /** the middle of a room: no closer to a wall than this share of its span (the middle 60 % each way; a round hall, 0.6 r) */
  inset: 0.2,
  round: 0.6,
  /** puzzle rooms after the chest that use the gadget, at the least */
  gadgetRooms: 2,
};
/** The rules, for the reports: id → what it asks. */
export const RULE_TEXT = {
  size: 'a puzzle, fight or guardian room at least 28 m on its short side and 900 m², a chest room 20 m',
  ceiling: 'ceilings 16 m over the floor (a chest room 14 m, a passage 8 m)',
  door: 'doors 6 to 10 m wide and 8 to 12 m high',
  centred: 'a puzzle’s pieces in the middle 60 % of its room',
  door_thread: 'nothing of a puzzle rolled, carried or played through a door',
  both: 'a room about a puzzle or a fight, not both',
  kind: 'every room tagged with its kind (puzzle, combat, chest, passage, guardian), and the tag true',
  foes: 'a fight’s foes in the middle of its room',
  gadget: 'the gadget found inside, mid-way, and used in every puzzle room after it',
  unmeasured: 'a room the rules can measure (built with the kit’s halls and round halls)',
};

/** Element types that are a puzzle's (anything a player works): not the chests, the keys, the gates or the guardian. */
const NOT_PUZZLE = new Set(['gadget', 'find', 'key', 'cache', 'door', 'bridge', 'boss', 'arena']);
export const isPuzzleElement = (e) => !!e && !NOT_PUZZLE.has(e.type);

// ---------------------------------------------------------------- geometry
const inBox = (s, p, pad = 0) => p[0] >= s.x0 - pad && p[0] <= s.x1 + pad && p[2] >= s.z0 - pad && p[2] <= s.z1 + pad;
const inRound = (s, p, pad = 0) => Math.hypot(p[0] - s.x, p[2] - s.z) <= s.r + pad;
export const contains = (s, p, pad = 0) => (s.shape === 'round' ? inRound(s, p, pad) : inBox(s, p, pad)) && p[1] >= s.y - 1.5 && p[1] <= s.top + 0.5;
export const spaceArea = (s) => (s.shape === 'round' ? Math.PI * s.r * s.r : (s.x1 - s.x0) * (s.z1 - s.z0));
export const spaceShort = (s) => (s.shape === 'round' ? 2 * s.r : Math.min(s.x1 - s.x0, s.z1 - s.z0));
/** Is p (local) in the middle of space s: RULES.inset of its span from each wall (a round hall: within RULES.round r)? */
export function inMiddle(s, p, rules = RULES) {
  if (s.shape === 'round') return Math.hypot(p[0] - s.x, p[2] - s.z) <= s.r * rules.round + 1e-6;
  const ix = (s.x1 - s.x0) * rules.inset, iz = (s.z1 - s.z0) * rules.inset;
  return p[0] >= s.x0 + ix - 1e-6 && p[0] <= s.x1 - ix + 1e-6 && p[2] >= s.z0 + iz - 1e-6 && p[2] <= s.z1 - iz + 1e-6;
}
/** The smallest space holding p (a room's mark), a passage only if nothing else does. */
export function spaceOf(spaces, p) {
  const hold = spaces.filter((s) => contains(s, p, 0.3));
  if (!hold.length) return null;
  return hold.sort((a, b) => (!!a.passage - !!b.passage) || spaceArea(a) - spaceArea(b))[0];
}
/** The points a piece covers (a ball's groove: both ends; a bank: each eye; else its place). */
export function piecePoints(p) {
  const o = p.o ?? {};
  if (Array.isArray(o.a) && Array.isArray(o.b)) return [o.a, o.b];
  if (Array.isArray(o.eyes) && o.eyes.length) return o.eyes.map((e) => e.at).filter(Array.isArray);
  const at = piecePos(o);
  return at ? [at] : [];
}
/** The shortest distance (in plan) from point q to segment ab. */
function segDist(a, b, q) {
  const dx = b[0] - a[0], dz = b[2] - a[2], L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / L)) : 0;
  return { d: Math.hypot(a[0] + dx * t - q[0], a[2] + dz * t - q[2]), t, y: a[1] + (b[1] - a[1]) * t };
}

// ---------------------------------------------------------------- the rooms' kinds
/**
 * What each room is, from what is in it: 'guardian' (its boss), 'combat' (an arena, the house's encounter, or a machine
 * by its mark: src/foes.js placeMachinesIn puts one by every mark past the first, away from the guardian, in a room not
 * tagged otherwise), 'puzzle' (it holds something to work), 'chest' (a chest and nothing to work), 'passage'.
 * { kinds: { room: kind }, puzzle: Set, combat: Map(room → why) }
 */
export function roomKinds(logic, pieces, { guardian = null, encounter = null } = {}) {
  const E = logic.elements ?? {}, R = logic.rooms ?? {};
  const puzzle = new Set(), combat = new Map(), chest = new Set();
  for (const [id, e] of Object.entries(E)) {
    if (!e.room) continue;
    if (isPuzzleElement(e)) puzzle.add(e.room);
    if (e.type === 'arena') combat.set(e.room, `an arena (${id})`);
    if (e.type === 'gadget' || e.type === 'find') chest.add(e.room);
  }
  if (encounter?.room) combat.set(encounter.room, 'the house’s encounter');
  // the machines by the marks (as foes.js places them): every mark past the first, 14 m or more from the guardian's arena
  const marks = pieces.filter((p) => p.cls === 'Mark');
  marks.forEach((m, i) => {
    if (i === 0 || combat.has(m.o.room)) return;
    const declared = R[m.o.room]?.kind;
    if (declared && declared !== 'combat') return;
    const at = m.o.foes ?? m.o.at;
    if (guardian?.center && Math.hypot(at[0] - guardian.center[0], at[1] - guardian.center[1], at[2] - guardian.center[2]) < 14) return;
    combat.set(m.o.room, 'a machine by its mark');
  });
  const kinds = {};
  for (const r of Object.keys(R)) {
    if (R[r].boss) kinds[r] = 'guardian';
    else if (puzzle.has(r) && combat.has(r)) kinds[r] = 'both';
    else if (combat.has(r)) kinds[r] = 'combat';
    else if (puzzle.has(r)) kinds[r] = 'puzzle';
    else if (chest.has(r)) kinds[r] = 'chest';
    else kinds[r] = 'passage';
  }
  return { kinds, puzzle, combat };
}

// ---------------------------------------------------------------- the rules
/**
 * Every rule, room by room. o: { logic, pieces, spaces, order (rooms in the order a player reaches them: logic.js
 * solve().order), guardian: { center: [x, y, z] local } | null, encounter: def.encounter | null, rules }.
 */
export function templeRules({ logic, pieces = [], spaces = [], order = null, guardian = null, encounter = null, rules = RULES }) {
  const E = logic.elements ?? {}, R = logic.rooms ?? {};
  const v = [];
  const add = (rule, room, what) => v.push({ rule, room, what });
  const { kinds, combat } = roomKinds(logic, pieces, { guardian, encounter });
  const byId = new Map();
  for (const p of pieces) if (p.o?.id && !byId.has(p.o.id)) byId.set(p.o.id, p);
  // each room's anchor: its mark, else the middle of its elements' pieces
  const anchor = {};
  for (const p of pieces) if (p.cls === 'Mark' && p.o?.room && !anchor[p.o.room]) anchor[p.o.room] = p.o.at;
  for (const r of Object.keys(R)) {
    if (anchor[r]) continue;
    const pts = Object.entries(E).filter(([, e]) => e.room === r).map(([id]) => byId.get(id)).filter(Boolean).flatMap(piecePoints);
    if (pts.length) anchor[r] = pts.reduce((a, q) => [a[0] + q[0] / pts.length, a[1] + q[1] / pts.length, a[2] + q[2] / pts.length], [0, 0, 0]);
  }
  const rooms = [];
  const spaceFor = {};
  for (const r of Object.keys(R)) {
    const kind = kinds[r], declared = R[r].kind ?? null, at = anchor[r];
    const s = at ? spaceOf(spaces, at) : null;
    spaceFor[r] = s;
    const floor = at?.[1] ?? s?.y ?? 0;
    const row = { id: r, kind, declared, space: s ? (s.shape === 'round' ? `round r ${s.r.toFixed(1)}` : `${(s.x1 - s.x0).toFixed(1)} × ${(s.z1 - s.z0).toFixed(1)}`) : null, short: s ? +spaceShort(s).toFixed(1) : null, area: s ? Math.round(spaceArea(s)) : null, ceiling: s ? +(s.top - floor).toFixed(1) : null };
    rooms.push(row);
    // the kind: one of them, and as tagged
    if (kind === 'both') add('both', r, `a puzzle and ${combat.get(r)}`);
    const want = kind === 'both' ? 'puzzle' : kind;
    if (declared && declared !== want && !(declared === 'guardian' && R[r].boss)) add('kind', r, `tagged ${declared}, but it is ${kind === 'both' ? 'a puzzle and a fight' : `a ${kind} room`}`);
    // the size and the ceiling (a passage in another room's hall is that room's floor: its own size is not asked)
    if (!s) { if (kind !== 'passage') add('unmeasured', r, 'not inside any hall or round hall of the kit'); continue; }
    const big = kind === 'puzzle' || kind === 'combat' || kind === 'guardian' || kind === 'both';
    if (big && (spaceShort(s) < rules.room.short - 1e-6 || spaceArea(s) < rules.room.area - 1e-6)) add('size', r, `${row.space} m (${row.area} m²): wants ${rules.room.short} m and ${rules.room.area} m²`);
    if (kind === 'chest' && spaceShort(s) < rules.chest.short - 1e-6) add('size', r, `${row.space} m: a chest room wants ${rules.chest.short} m`);
    const ceil = big ? rules.room.ceiling : kind === 'chest' ? rules.chest.ceiling : rules.passage.ceiling;
    if (row.ceiling < ceil - 1e-6) add('ceiling', r, `${row.ceiling} m over its floor: wants ${ceil}`);
  }
  // the doors: every door of the links, its slab
  for (const l of logic.links ?? []) {
    if (!l.door || E[l.door]?.type !== 'door') continue;
    const p = byId.get(l.door);
    if (!p || p.cls !== 'Door') continue;
    const w = p.o.w ?? 4.4, h = p.o.h ?? 6;
    if (w < rules.door.w[0] - 1e-6 || w > rules.door.w[1] + 1e-6 || h < rules.door.h[0] - 1e-6 || h > rules.door.h[1] + 1e-6) add('door', l.a, `${l.door} (${l.a} → ${l.b}): ${w} × ${h} m, wants ${rules.door.w.join('-')} × ${rules.door.h.join('-')}`);
  }
  // the puzzle's pieces, in the middle of their room
  for (const [id, e] of Object.entries(E)) {
    if (!isPuzzleElement(e) || !e.room || kinds[e.room] === 'guardian') continue;
    const s = spaceFor[e.room], p = byId.get(id);
    if (!s || !p) continue;
    const out = piecePoints(p).filter((q) => !inMiddle(s, q, rules));
    if (out.length) add('centred', e.room, `${id} (${p.cls}) by the wall: ${out.map((q) => `[${q.map((x) => x.toFixed(1)).join(', ')}]`).join(' ')}`);
  }
  // nothing threaded through a door: a ball and its plate, a weight and its plate, in one room; no groove through a doorway
  const doors = (logic.links ?? []).filter((l) => l.door && byId.get(l.door)?.cls === 'Door').map((l) => ({ id: l.door, p: byId.get(l.door) }));
  for (const [id, e] of Object.entries(E)) {
    if (e.type !== 'drum' && e.type !== 'weight') continue;
    const plates = [e.plate, ...Object.keys(e.stops ?? {})].filter(Boolean);
    // (issue #401, the author's ruling: a ball dropped through a hole in the floor onto a plate in the room below, and a lift
    // carrying its sphere between the floors of one well, `through`, cross no door: their plates may be another room's)
    if (!e.through) for (const pl of new Set(plates)) if (E[pl]?.room && e.room && E[pl].room !== e.room) add('door_thread', e.room, `${id}: its plate ${pl} is in the ${E[pl].room}`);
    if (e.gap && E[e.gap]?.type === 'door') add('door_thread', e.room, `${id}: rolled through the door ${e.gap}`);
    const b = byId.get(id);
    if (b?.cls === 'Ball' && Array.isArray(b.o.a) && Array.isArray(b.o.b)) for (const d of doors) {
      const at = d.p.o.at, w = d.p.o.w ?? 4.4, q = segDist(b.o.a, b.o.b, at);
      if (q.d < w / 2 + 0.5 && Math.abs(q.y - at[1]) < 2 && q.t > 0.001 && q.t < 0.999) add('door_thread', e.room, `${id}: its groove runs through the door ${d.id}`);
    }
  }
  // a key element (an eye, a plate) a door or bridge of another room waits on, in its own room, is fine: that is a clue
  // elsewhere. A lock whose ball is carried in from the room before is caught above.
  // the foes in the middle of their room (the fights: an arena, the encounter, the machines' marks)
  for (const [r] of combat) {
    const s = spaceFor[r];
    const m = pieces.find((p) => p.cls === 'Mark' && p.o?.room === r);
    if (!s || !m) continue;
    const at = m.o.foes ?? m.o.at;
    if (!inMiddle(s, at, rules)) add('foes', r, `its foes stand by the wall (${m.o.foes ? 'its foes’ spot' : 'its mark'} at [${at.map((x) => x.toFixed(1)).join(', ')}])`);
  }
  // the gadget: found inside, mid-way, used in every puzzle room after it
  const gadgetEl = Object.values(E).find((e) => e.type === 'gadget');
  const items = new Set([gadgetEl?.item, ...Object.values(E).filter((e) => e.type === 'find').map((e) => e.item)].filter(Boolean));
  const ord = (order ?? Object.keys(R)).filter((r) => R[r]);
  if (!gadgetEl) add('gadget', null, 'no gadget found inside');
  else {
    const at = ord.indexOf(gadgetEl.room);
    const uses = (r) => Object.values(E).some((e) => e.room === r && (e.needs ?? []).some((n) => items.has(n) || (n === 'magic:4' && items.has('cell'))))
      || (logic.links ?? []).some((l) => (l.a === r || l.b === r) && (l.needs ?? []).some((n) => items.has(n)))
      || Object.entries(E).some(([, e]) => e.room === r && conditionKeys(e.opens).some((k) => k.how === 'item' && items.has(k.id)));
    const after = ord.slice(at + 1).filter((r) => kinds[r] === 'puzzle' || kinds[r] === 'both');
    if (at <= 0) add('gadget', gadgetEl.room, 'the gadget is in the first room');
    const unused = after.filter((r) => !uses(r));
    for (const r of unused) add('gadget', r, `a puzzle room after the chest that never asks for the ${[...items].join(' or ')}`);
    if (after.length - unused.length < rules.gadgetRooms) add('gadget', gadgetEl.room, `only ${after.length - unused.length} puzzle room(s) after the chest use the ${[...items].join(' or ')}: wants ${rules.gadgetRooms}`);
  }
  const by = {};
  for (const x of v) by[x.rule] = (by[x.rule] ?? 0) + 1;
  return { rooms, violations: v, count: v.length, by };
}

/** A temple's rules as a few lines of text (the audit's console, the test's report). */
export function rulesText(id, r) {
  const lines = [`${id}: ${r.count} against the rules (${Object.entries(r.by).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'})`];
  for (const x of r.violations) lines.push(`  ${x.rule.padEnd(11)} ${(x.room ?? '').padEnd(10)} ${x.what}`);
  return lines.join('\n');
}
