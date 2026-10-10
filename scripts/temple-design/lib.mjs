// The temple design audit's pure logic (.claude/skills/temple-design-qc/SKILL.md): a temple's puzzle graph
// from its logic (src/temples/<world>.js LOGIC, the shape src/temples/logic.js reads) and the pieces its
// layout placed (recorded by scripts/temple-design/audit.mjs), measured and scored. No three.js, no game
// state: plain objects in, plain objects out (tests/temple-design.test.js shows each function the case
// it is for).
//
//   const g = puzzleGraph(logic, pieces, { los, order })   rooms, locks with their keys, mechanics, distances
//   const m = templeMetrics(g, { guardian })               structure, teach/test/twist, combos, obviousness…
//   const s = scoreTemple(m)                              the rubric's nine criteria, 1-5 each
//   skeleton(g) / similarity(a, b)                        the temple's shape as a string, and how alike two are
//   planSvg(g, m)                                         a top-down plan: rooms, pieces, each lock's line to its keys
//
// pieces: [{ cls: 'Door' | 'Plate' | 'Ball' | 'Switch' | …, o: the options the layout gave (local metres) }]
// los(a, b) -> true when b can be seen from a (local [x, y, z]); left out, everything counts as seen.

/** A piece's position (local [x, y, z]) from whatever its options name. */
export function piecePos(o = {}) {
  if (Array.isArray(o.at)) return o.at.slice(0, 3);
  if (Array.isArray(o.path) && o.path.length) return mid(o.path[0], o.path[o.path.length - 1]);
  if (Array.isArray(o.a) && Array.isArray(o.b)) return mid(o.a, o.b);
  if (Array.isArray(o.eyes) && o.eyes.length) return centroid(o.eyes.map((e) => e.at));
  if (Array.isArray(o.min) && Array.isArray(o.max)) return mid(o.min, o.max);
  if (Array.isArray(o.from)) return o.from.slice(0, 3);
  return null;
}
export const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
export function centroid(ps) {
  const q = ps.filter(Boolean);
  if (!q.length) return null;
  const s = q.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
  return s.map((v) => v / q.length);
}
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The elements a door's condition names: [{ id, how: 'pressed' | 'lit' | 'drumOn' | 'item' | 'resolved' | 'open' }]. */
export function conditionKeys(c, out = []) {
  if (c == null) return out;
  if (Array.isArray(c)) { for (const x of c) conditionKeys(x, out); return out; }
  for (const k of ['all', 'any']) if (c[k]) conditionKeys(c[k], out);
  if (c.not) conditionKeys(c.not, out);
  if (c.pressed) out.push({ id: c.pressed, how: 'pressed' });
  if (c.lit) out.push({ id: c.lit, how: 'lit' });
  if (c.drumOn) out.push({ id: c.drumOn[0], how: 'drumOn' }, { id: c.drumOn[1], how: 'pressed' });
  if (c.item) out.push({ id: c.item, how: 'item' });
  if (c.open) out.push({ id: c.open, how: 'open' });
  if (c.resolved) out.push({ id: 'boss', how: 'resolved' });
  if (c.gadget) out.push({ id: 'gadget', how: 'gadget' });
  return out;
}
/** Does a drum rest on this plate (its own, or one of its `stops`: one ball, several places)? */
export const drumFor = (e, plate) => e?.type === 'drum' && (e.plate === plate || (e.stops && e.stops[plate] != null));

/** A condition that can go false again once met (a plate stood on, not a ball resting on it; a held bell; an `any`, a `not`). */
export function reversible(c, el = {}) {
  if (c == null) return false;
  if (Array.isArray(c)) return c.some((x) => reversible(x, el));
  if (c.not || c.any) return true;
  if (c.all) return c.all.some((x) => reversible(x, el));
  if (c.pressed) return !Object.values(el).some((e) => drumFor(e, c.pressed));
  if (c.lit) return !!el[c.lit]?.hold || el[c.lit]?.type === 'vane';   // (a bell that rings a while, then falls quiet: logic.js `hold`; a vane, lit only while it turns)
  return false;
}

/** The traversal a piece asks for (it stands in a room and you must get past it): null for the puzzle's own parts. */
export const TRAVERSAL = { Platform: 'ride', Updraft: 'updraft', Gust: 'gust', Swing: 'swing', Pit: 'pit', Glass: 'glass', JetGuide: 'jets' };
/** Tags that qualify a verb rather than add one: a reveal (lens, lantern), a volley (eyes inside one breath), a
 * timed hold (a held bell: what it opens stays only while it rings). */
export const MODIFIERS = ['reveal', 'volley', 'timed'];
const baseOf = (mechs) => mechs.filter((m) => !MODIFIERS.includes(m));
/** A gadget item's verb, for the reports. */
export const GADGET_VERB = { fire: 'ember', jetpack: 'jets', glider: 'wings', bell: 'bell', cell: 'fourth unit (volley)', 'magic:4': 'fourth unit (volley)', lens: 'lens (reveal)', lantern: 'lantern (reveal)', stun: 'stilling', coil: 'quick coil (volley)', bloom: 'bloom', echo: 'echo shell' };
const itemOf = (needs = []) => needs.find((n) => n !== 'backpack') ?? null;

/**
 * The mechanic an element asks for. A plate with a ball meant for it is the ball's push; a plain plate
 * is standing on it; a switch is a shot (in turn: a sequence); anything that needs an item is that
 * item's use (`gadget:<item>`), and a volley of eyes inside a breath is `volley` as well.
 */
export function mechanicOf(id, el, { elements = {}, piece = null } = {}) {
  if (!el) return id === 'boss' ? 'boss' : 'unknown';
  const item = itemOf(el.needs);
  const tags = [];
  if (item) tags.push(`gadget:${item === 'magic:4' ? 'cell' : item}`);
  if (piece?.cls === 'Bank' || item === 'magic:4' || item === 'coil') tags.push('volley');
  if (el.type === 'drum') tags.push('push');
  else if (el.type === 'plate') tags.push(Object.values(elements).some((e) => drumFor(e, id)) ? 'push' : 'weight');
  else if (el.type === 'switch' && (el.after || el.order || Object.values(elements).some((e) => e.after === id))) tags.push('sequence');   // (in turn: with a gadget too, the gadget and the order; `order`: a bank's eyes in turn)
  else if (el.type === 'switch' && !item) tags.push('shot');
  else if (el.type === 'brazier' || el.type === 'bramble') { if (!item) tags.push('ember'); }
  else if (el.type === 'bell' && !item) tags.push('bell');
  else if (el.type === 'vane' && !item) tags.push('shot');   // (a splash spins a small vane; a great one wants the jets' wash: its item)
  if (piece?.o?.hidden) tags.push('reveal');
  if (el.hold || el.type === 'vane') tags.push('timed');
  // `when` a condition holds (an eye that wakes only in the sun a ball's louvre lets in): that condition's verbs too
  for (const k of conditionKeys(el.when)) {
    if (k.how === 'drumOn') tags.push('push');
    else if (k.how === 'pressed') tags.push(Object.values(elements).some((e) => drumFor(e, k.id)) ? 'push' : 'weight');
    else if (k.how === 'lit' && elements[k.id]) tags.push(...mechanicOf(k.id, elements[k.id], { elements }).filter((m) => m !== 'sequence'));
  }
  return [...new Set(tags)];
}

/**
 * The puzzle graph.
 * logic: { id, entry, gadget, rooms, links, elements }; pieces: [{ cls, o }]; order: rooms in the order
 * a player reaches them (logic.js solve().order; else the links' order from the entry).
 */
export function puzzleGraph(logic, pieces = [], { los = null, order = null } = {}) {
  const E = logic.elements ?? {};
  const rooms = Object.keys(logic.rooms ?? {});
  const links = logic.links ?? [];
  const roomOrder = order ?? bfsOrder(logic);
  // the pieces by the element ids they stand for (a Bud's bloom, a Jaw's still and a Bank's eyes answer to their switch)
  const byId = new Map();
  for (const p of pieces) {
    const pos = piecePos(p.o);
    const rec = { ...p, pos };
    for (const k of ['id', 'bloom', 'still']) if (p.o?.[k] && !byId.has(p.o[k])) byId.set(p.o[k], rec);
    if (p.o?.id) byId.set(p.o.id, rec);
  }
  // where the rooms are: their marks and their elements' pieces
  const roomPts = Object.fromEntries(rooms.map((r) => [r, []]));
  for (const p of pieces) if (p.cls === 'Mark' && p.o?.room && roomPts[p.o.room]) roomPts[p.o.room].push(piecePos(p.o));
  for (const [id, e] of Object.entries(E)) if (e.room && roomPts[e.room] && byId.get(id)?.pos) roomPts[e.room].push(byId.get(id).pos);
  const at = Object.fromEntries(rooms.map((r) => [r, centroid(roomPts[r])]));
  // a room with nothing of its own placed: halfway along its links
  for (const r of rooms) if (!at[r]) { const n = links.filter((l) => l.a === r || l.b === r).map((l) => at[l.a === r ? l.b : l.a]).filter(Boolean); at[r] = centroid(n); }
  // the pieces nobody names (traversal: discs, winds, gusts, swings, pits) go to the nearest room
  const near = (pos) => rooms.filter((r) => at[r]).reduce((best, r) => (!best || dist(at[r], pos) < dist(at[best], pos) ? r : best), null);
  const traversal = Object.fromEntries(rooms.map((r) => [r, []]));
  for (const p of pieces) {
    const t = TRAVERSAL[p.cls];
    const pos = piecePos(p.o);
    if (!t || !pos || p.o?.onStill) continue;   // (onStill: a guardian's, the Mother Snapper's crystals over her hall, no way across)
    const r = p.o?.room && traversal[p.o.room] ? p.o.room : near(pos);
    if (r && !traversal[r].includes(t)) traversal[r].push(t);
  }
  const hops = roomDistances(rooms, links);
  const seen = (a, b) => (los ? !!los(a, b) : true);

  // the locks: every door and bridge, and every link that asks for an item
  const locks = [];
  for (const l of links) {
    const lockEl = l.door ? E[l.door] : null;
    const id = l.door ?? `${l.a}>${l.b}`;
    const keys = [];
    const isGate = lockEl && (lockEl.type === 'door' || lockEl.type === 'bridge');
    // a link held by an element itself (thorns over a doorway: burn them): the element is its own key
    if (lockEl && !isGate) keys.push({ id: l.door, how: 'lit', room: lockEl.room ?? l.a, mech: mechanicOf(l.door, lockEl, { elements: E, piece: byId.get(l.door) }), hidden: !!byId.get(l.door)?.o?.hidden });
    if (isGate) for (const k of conditionKeys(lockEl.opens)) {
      if (k.how === 'resolved') keys.push({ id: 'boss', how: k.how, room: Object.entries(E).find(([, e]) => e.type === 'boss')?.[1]?.room ?? null, mech: ['boss'] });
      else if (k.how === 'item') keys.push({ id: k.id, how: 'item', room: E[logic.gadget ? Object.keys(E).find((x) => E[x].type === 'gadget') : '']?.room ?? null, mech: [`gadget:${k.id}`, 'reveal'] });
      else if (E[k.id]) keys.push({ id: k.id, how: k.how, room: E[k.id].room ?? null, mech: mechanicOf(k.id, E[k.id], { elements: E, piece: byId.get(k.id) }), hidden: !!byId.get(k.id)?.o?.hidden });
    }
    for (const n of l.needs ?? []) if (n !== 'backpack') keys.push({ id: n, how: 'needs', room: l.a, mech: [`gadget:${n === 'magic:4' ? 'cell' : n}`], traversal: true });
    // a key that takes only `when` something else holds (a ball on a louvre's plate): that is a key of the lock too
    for (const k of [...keys]) for (const w of conditionKeys(E[k.id]?.when)) if (E[w.id] && !keys.some((x) => x.id === w.id)) keys.push({ id: w.id, how: w.how, room: E[w.id].room ?? null, mech: mechanicOf(w.id, E[w.id], { elements: E, piece: byId.get(w.id) }), when: true });
    // a ball whose groove crosses a bridge (its `gap`: it only passes while the bridge stands): what holds that bridge
    // up is a key of the plate's lock too (the Warden's Well's slots, stood by a vane)
    for (const k of [...keys]) {
      const drum = k.how === 'pressed' ? Object.entries(E).find(([, e]) => drumFor(e, k.id) && e.gap) : null;
      if (drum) for (const w of conditionKeys(E[drum[1].gap]?.opens)) if (E[w.id] && !keys.some((x) => x.id === w.id)) keys.push({ id: w.id, how: w.how, room: E[w.id].room ?? null, mech: mechanicOf(w.id, E[w.id], { elements: E, piece: byId.get(w.id) }), gap: true });
    }
    // a plate a ball is meant for: the key is the ball's push (the plate is where it must go)
    const merged = [];
    for (const k of keys) {
      const drum = k.how === 'pressed' ? Object.entries(E).find(([, e]) => drumFor(e, k.id)) : null;
      const q = drum ? { id: drum[0], how: 'drumOn', room: drum[1].room ?? k.room, mech: ['push'], plate: k.id } : k;
      if (!merged.some((x) => x.id === q.id)) merged.push(q);
    }
    const arena = !!isGate && lockEl.opens == null;   // the arena's door: shut while the guardian fights (no puzzle)
    const isBossDoor = keys.some((k) => k.how === 'resolved');
    const lockPos = byId.get(l.door)?.pos ?? (at[l.a] && at[l.b] ? mid(at[l.a], at[l.b]) : null);
    // where you stand to face the lock: 4 m back toward the room you come from, eye height
    const stand = lockPos && at[l.a] ? standPoint(lockPos, at[l.a]) : lockPos;
    const ks = merged.map((k) => {
      const kp = (k.how === 'needs' || k.how === 'item') ? null : byId.get(k.plate ?? k.id)?.pos ?? byId.get(k.id)?.pos ?? (k.room ? at[k.room] : null);
      // the echo ears: the clue is the singing stone of the same note (it must be splashed first; a singing ball,
      // `sings`, is one too)
      const ear = byId.get(k.id);
      let clue = null;
      if (ear?.cls === 'EchoEar') {
        const stones = pieces.filter((p) => (p.cls === 'EchoStone' && p.o?.note === ear.o.note) || (p.cls === 'Ball' && p.o?.sings === ear.o.note)).map((p) => piecePos(p.o));
        if (stones.length && kp) clue = stones.reduce((b, s) => (!b || dist(s, kp) < dist(b, kp) ? s : b), null);
      }
      const where = clue ?? kp;
      return {
        ...k, pos: kp, clue,
        metres: where && lockPos ? +dist(where, lockPos).toFixed(1) : 0,
        rooms: k.how !== 'item' && k.how !== 'needs' && k.room && hops[l.a]?.[k.room] != null ? hops[l.a][k.room] : 0,
        visible: where && stand ? seen(stand, [where[0], where[1] + 0.8, where[2]]) : true,
        before: k.room && k.how !== 'item' && k.how !== 'needs' ? roomOrder.indexOf(k.room) < roomOrder.indexOf(l.a) : false,
      };
    });
    const mech = [...new Set(ks.flatMap((k) => k.mech))];
    locks.push({
      id, a: l.a, b: l.b, door: l.door ?? null, type: lockEl?.type ?? (l.needs ? 'traverse' : 'open'), pos: lockPos, stand,
      keys: ks, mechanics: mech, arena, bossDoor: isBossDoor, latch: !!lockEl?.latch, reversible: isGate && !lockEl.latch ? reversible(lockEl.opens, E) : false,
      sequence: ks.some((k) => E[k.id]?.after || E[k.id]?.order || Object.values(E).some((e) => e.after === k.id)),
      traversalHere: traversal[l.a] ?? [],
      index: roomOrder.indexOf(l.b),
    });
  }
  locks.sort((x, y) => x.index - y.index);
  const chestRoom = Object.values(E).find((e) => e.type === 'gadget')?.room ?? null;
  const boss = Object.entries(E).find(([, e]) => e.type === 'boss');
  return {
    id: logic.id, gadget: logic.gadget ?? null, entry: logic.entry, rooms, roomOrder, links, at, traversal, locks,
    chestRoom, boss: boss ? { id: boss[0], ...boss[1] } : null, elements: E, pieces: pieces.map((p) => ({ cls: p.cls, id: p.o?.id ?? null, answers: [p.o?.id, p.o?.bloom, p.o?.still].filter(Boolean), pos: piecePos(p.o), hidden: !!p.o?.hidden, room: p.o?.room ?? null })),
  };
}

function standPoint(lockPos, from) {
  const dx = from[0] - lockPos[0], dz = from[2] - lockPos[2], d = Math.hypot(dx, dz) || 1, k = Math.min(4, d * 0.8) / d;
  return [lockPos[0] + dx * k, lockPos[1] + 1.7, lockPos[2] + dz * k];
}
/** Rooms in the order of a walk from the entry along the links (breadth first). */
export function bfsOrder(logic) {
  const out = [logic.entry], todo = [logic.entry];
  while (todo.length) {
    const r = todo.shift();
    for (const l of logic.links ?? []) {
      const o = l.a === r ? l.b : l.b === r ? l.a : null;
      if (o && !out.includes(o)) { out.push(o); todo.push(o); }
    }
  }
  for (const r of Object.keys(logic.rooms ?? {})) if (!out.includes(r)) out.push(r);
  return out;
}
/** Hops between every two rooms (links both ways). */
export function roomDistances(rooms, links) {
  const D = {};
  for (const s of rooms) {
    D[s] = { [s]: 0 };
    const todo = [s];
    while (todo.length) {
      const r = todo.shift();
      for (const l of links) {
        const o = l.a === r ? l.b : l.b === r ? l.a : null;
        if (o && D[s][o] == null) { D[s][o] = D[s][r] + 1; todo.push(o); }
      }
    }
  }
  return D;
}

// ------------------------------------------------------------------ the measures

/**
 * How obvious a step is, 1 (obscure) to 5 (painfully obvious): its keys in the lock's own room, in plain
 * sight of it and close, one mechanic, no order, nothing hidden, nothing else in the room to try.
 */
export function obviousness(lock, { decoys = 0 } = {}) {
  let s = 5;
  const why = [];
  const far = Math.max(0, ...lock.keys.map((k) => k.rooms ?? 0));
  if (far) { s -= Math.min(2, far); why.push(`key ${far} room${far > 1 ? 's' : ''} away`); }
  if (lock.keys.some((k) => k.visible === false)) { s -= 1; why.push('key out of sight of the lock'); }
  if (Math.max(0, ...lock.keys.map((k) => k.metres ?? 0)) > 20) { s -= 0.5; why.push('key over 20 m from the lock'); }
  const base = baseOf(lock.mechanics);
  if (base.length >= 2) { s -= 1; why.push(`combines ${base.join(' + ')}`); }
  if (lock.sequence || lock.mechanics.includes('volley') || lock.mechanics.includes('timed')) { s -= 0.5; why.push(lock.sequence ? 'an order to find' : lock.mechanics.includes('volley') ? 'a timing (one breath)' : 'a timing (only while it rings)'); }
  if (lock.mechanics.includes('reveal') || lock.keys.some((k) => k.hidden)) { s -= 0.5; why.push('hidden until revealed'); }
  if (decoys > 0) { s -= 0.5; why.push(`${decoys} thing${decoys > 1 ? 's' : ''} in the room that are not its key`); }
  return { score: Math.max(1, Math.min(5, +s.toFixed(2))), why };
}

/** Spearman's rank correlation of ys against their index (a curve that rises: > 0). */
export function rankTrend(ys) {
  const n = ys.length;
  if (n < 3) return 0;
  const rank = (a) => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); let i = 0; while (i < n) { let j = i; while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const rx = ys.map((_, i) => i), ry = rank(ys);
  const mx = (n - 1) / 2, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx && dy ? +(num / Math.sqrt(dx * dy)).toFixed(3) : 0;
}

/** Words in a guardian's lines that tell which verbs its fight asks for. */
const VERB_WORDS = {
  fire: /\bbrazier|ember|fire|light\b/i, jetpack: /\bjets?\b|fly|above it/i, glider: /\bwings?|wind|glide/i, bell: /\bbell|whistle|sound/i,
  cell: /\bfour vents|inside a breath|all four/i, lens: /\blens|unseen|glyph/i, lantern: /\blantern|light/i, stun: /\bstill/i,
  coil: /\bsix|inside a breath|numerals/i, bloom: /\bbloom|grow|beds?/i, echo: /\bplay (its|the) word|echo|back into/i,
  push: /\bpush|shove|roll/i, shot: /\bshoot|splash|water|fluid/i,
};

/** A temple's measures, from its graph (and its guardian's definition: phases, hints, attacks). */
export function templeMetrics(g, { guardian = null } = {}) {
  const puzzles = g.locks.filter((l) => !l.arena && !l.bossDoor && l.type !== 'open');
  const E = g.elements;
  // the steps a player solves, in order, with how obvious each is
  const steps = puzzles.map((l) => {
    const keyOf = (k) => [k.id, k.plate, ...(E[k.id]?.type === 'drum' ? [E[k.id].plate, ...Object.keys(E[k.id].stops ?? {})] : [])].filter(Boolean);   // (a ball's plates are part of its key)
    const keyIds = new Set(l.keys.flatMap(keyOf));
    const decoys = Object.entries(E).filter(([id, e]) => e.room === l.a && ['plate', 'switch', 'brazier', 'bramble', 'bell', 'drum'].includes(e.type) && !keyIds.has(id) && !puzzles.some((p) => p !== l && p.keys.some((k) => keyOf(k).includes(id)))).length;
    const o = obviousness(l, { decoys });
    const complexity = baseOf(l.mechanics).length + Math.max(0, l.keys.length - 1) * 0.5 + Math.max(0, ...l.keys.map((k) => k.rooms)) + (l.sequence ? 0.5 : 0) + (l.mechanics.includes('volley') || l.mechanics.includes('timed') ? 0.5 : 0) + (l.mechanics.includes('reveal') ? 0.5 : 0) + 0.25 * l.traversalHere.filter((t) => t !== 'pit').length;
    return { lock: l.id, from: l.a, to: l.b, mechanics: l.mechanics, keys: l.keys.map((k) => ({ id: k.id, metres: k.metres, rooms: k.rooms, visible: k.visible })), obvious: o.score, why: o.why, complexity: +complexity.toFixed(2), traversal: l.traversalHere, afterGadget: g.roomOrder.indexOf(l.a) >= g.roomOrder.indexOf(g.chestRoom) };
  });
  // teach, test, twist: every mechanic's first use, its second, and its first use in a combination (or in the fight)
  const mech = {};
  const use = (m, i, combo) => { const r = (mech[m] ??= { uses: [], teach: null, test: null, twist: null }); r.uses.push(i); if (r.teach == null) r.teach = i; else if (r.test == null) r.test = i; if (combo && r.twist == null && r.teach !== i) r.twist = i; else if (combo && r.twist == null) r.twistAtTeach = i; };
  steps.forEach((s, i) => { const base = baseOf(s.mechanics); for (const m of s.mechanics) use(m, i, base.length >= 2); for (const t of s.traversal) if (t !== 'pit') (mech[`traverse:${t}`] ??= { uses: [], teach: i, test: null, twist: null }).uses.push(i); });
  // the fight: which verbs it asks for
  const gadgetKey = g.gadget ? `gadget:${g.gadget}` : null;
  const text = guardian ? [guardian.wake, guardian.openHint, guardian.weary, ...(guardian.phases ?? []).map((p) => p.hint ?? '')].filter(Boolean).join(' ') : '';
  const fightVerbs = Object.entries(VERB_WORDS).filter(([, re]) => re.test(text)).map(([k]) => k);
  const bossNeeds = (g.boss?.needs ?? []).filter((n) => n !== 'backpack');
  const bossRequires = conditionKeys(g.boss?.requires).map((k) => k.id).filter((id) => E[id]);
  const usesGadget = !!g.gadget && (bossNeeds.includes(g.gadget) || (g.gadget === 'cell' && bossNeeds.includes('magic:4')) || fightVerbs.includes(g.gadget));
  const fightMechs = [...new Set([...(usesGadget ? [gadgetKey] : []), ...fightVerbs.filter((v) => v === 'push' || v === 'shot'), ...bossRequires.flatMap((id) => mechanicOf(id, E[id], { elements: E }))])];
  const attacks = Object.values(guardian?.attacks ?? {});
  const groundTelegraphs = attacks.filter((a) => ['ring', 'cone', 'lane'].includes(a.shape)).length;
  if (gadgetKey && mech[gadgetKey] && usesGadget) mech[gadgetKey].exam = true;
  // structure
  const rooms = g.rooms.length, links = g.links.length;
  const degree = Object.fromEntries(g.rooms.map((r) => [r, g.links.filter((l) => l.a === r || l.b === r).length]));
  const cycles = Math.max(0, links - rooms + 1);
  const branches = g.rooms.filter((r) => degree[r] >= 3).length;
  const backtracks = puzzles.filter((l) => l.keys.some((k) => k.before)).length;
  const stateChanges = puzzles.filter((l) => l.reversible).length;
  const gadgetSteps = steps.filter((s) => gadgetKey && s.mechanics.includes(gadgetKey));
  const gadgetIndex = steps.findIndex((s) => s.afterGadget);
  const gadgetAt = steps.length ? +((gadgetIndex < 0 ? steps.length : gadgetIndex) / steps.length).toFixed(2) : 0;
  const combos = steps.filter((s) => baseOf(s.mechanics).length >= 2);
  const gadgetWithOld = steps.filter((s) => gadgetKey && s.mechanics.includes(gadgetKey) && baseOf(s.mechanics).some((m) => m !== gadgetKey && !m.startsWith('gadget:')));
  const contexts = new Set();
  for (const s of gadgetSteps) for (const k of s.keys) { const p = g.pieces.find((q) => (q.answers ?? [q.id]).includes(k.id)); contexts.add(p?.cls ?? (E[k.id] ? E[k.id].type : 'traversal')); }
  if (usesGadget) contexts.add('guardian');
  const obv = steps.map((s) => s.obvious);
  const mean = obv.length ? +(obv.reduce((a, b) => a + b, 0) / obv.length).toFixed(2) : 0;
  const decoupled = steps.filter((s) => s.keys.some((k) => k.rooms > 0 || k.visible === false)).length;
  const curve = rankTrend(steps.map((s) => s.complexity));
  return {
    id: g.id, gadget: g.gadget, rooms, links, locks: puzzles.length, keys: puzzles.reduce((a, l) => a + l.keys.length, 0),
    structure: { cycles, branches, linear: cycles === 0 && branches === 0, backtracks, stateChanges, degree },
    steps, mechanics: mech,
    combos: combos.length, comboShare: steps.length ? +(combos.length / steps.length).toFixed(2) : 0,
    obviousness: { mean, max: Math.max(0, ...obv), min: obv.length ? Math.min(...obv) : 0, painfullyObvious: obv.filter((o) => o >= 4.5).length, obscure: obv.filter((o) => o <= 1.5).length },
    decoupled, decoupledShare: steps.length ? +(decoupled / steps.length).toFixed(2) : 0,
    gadget: { item: g.gadget, at: gadgetAt, uses: gadgetSteps.length, contexts: [...contexts], withOld: gadgetWithOld.length },
    guardian: { kind: guardian?.kind ?? null, final: guardian?.final ?? null, phases: (guardian?.phases ?? []).filter((p) => !p.weary).length, usesGadget, fightVerbs, fightMechs, requires: bossRequires, groundTelegraphs, attacks: attacks.length },
    curve: { trend: curve, first: thirds(steps.map((s) => s.complexity))[0], last: thirds(steps.map((s) => s.complexity))[2] },
  };
}
function thirds(ys) {
  if (!ys.length) return [0, 0, 0];
  const n = ys.length, cut = (a, b) => { const s = ys.slice(a, b); return s.length ? +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2) : 0; };
  return [cut(0, Math.max(1, Math.round(n / 3))), cut(Math.round(n / 3), Math.round(2 * n / 3)), cut(Math.round(2 * n / 3), n)];
}

/**
 * The temple's shape as a string, one letter a step: B a lock with only the base verbs (push, shot,
 * weight), C the chest's room, G a lock the gadget opens alone, X a lock that combines verbs, R a reveal,
 * T a traversal the gadget makes, K the guardian.
 */
export function skeleton(g) {
  let s = '';
  const gk = g.gadget ? `gadget:${g.gadget}` : null;
  for (const l of g.locks) {
    if (l.a === g.chestRoom && !s.includes('C')) s += 'C';
    if (l.arena || l.type === 'open') continue;
    if (l.a === g.chestRoom && !s.includes('C')) s += 'C';
    if (l.bossDoor) { s += 'K'; continue; }
    const base = baseOf(l.mechanics);
    if (l.type === 'traverse') s += 'T';
    else if (base.length >= 2) s += 'X';
    else if (l.mechanics.includes('reveal')) s += 'R';
    else if (gk && l.mechanics.includes(gk)) s += 'G';
    else s += 'B';
  }
  return s;
}
/** 1 - normalised edit distance of two skeletons: 1 = the same shape. */
export function similarity(a, b) {
  const m = a.length, n = b.length;
  if (!m && !n) return 1;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return +(1 - d[m][n] / Math.max(m, n)).toFixed(3);
}

// ------------------------------------------------------------------ the rubric

const clamp5 = (x) => Math.max(1, Math.min(5, Math.round(x)));
/** A score from thresholds: the first [limit, score] whose limit v reaches (ascending limits). */
export const band = (v, steps, last) => { for (const [lim, s] of steps) if (v <= lim) return s; return last; };

/**
 * The rubric (SKILL.md, "The rubric"), scored from the measures: 1-5 per criterion, with the measure
 * each came from. The skill's reader may move a score by one with a reason written beside it.
 */
export function scoreTemple(m, { maxSimilarity = 0 } = {}) {
  const S = {};
  const st = m.structure;
  S.structure = { score: clamp5(1 + Math.min(4, st.cycles * 1.5 + st.branches + st.stateChanges * 0.5 + st.backtracks * 0.5)), from: `${st.cycles} loops, ${st.branches} hubs, ${st.backtracks} backtracks, ${st.stateChanges} reversible states` };
  const gk = m.gadget.item ? `gadget:${m.gadget.item}` : null, gm = gk ? m.mechanics[gk] : null;
  const arc = gm ? 1 + (gm.test != null ? 1 : 0) + (gm.uses.length >= 3 ? 0.5 : 0) + (gm.twist != null ? 1.5 : 0) + (gm.exam ? 1 : 0) : 1;
  S.teachTestTwist = { score: gm?.twist == null ? Math.min(3, clamp5(arc)) : clamp5(arc),   // (never twisted: 3 at most)
    from: gm ? `gadget taught at step ${gm.teach + 1}, tested ${gm.test != null ? `at ${gm.test + 1}` : 'never'}, twisted ${gm.twist != null ? `at ${gm.twist + 1}` : 'never'}${gm.exam ? ', examined by the guardian' : ''}` : 'no gadget in the puzzles' };
  S.combination = { score: band(m.comboShare, [[0, 1], [0.15, 2], [0.3, 3], [0.5, 4]], 5), from: `${m.combos} of ${m.steps.length} steps combine two verbs` };
  S.nonObvious = { score: band(-m.obviousness.mean, [[-4.5, 1], [-4, 2], [-3.3, 3], [-2.5, 4]], 5), from: `mean obviousness ${m.obviousness.mean} (5 = painfully obvious), ${m.obviousness.painfullyObvious} steps at 4.5+` };
  if (m.obviousness.obscure > 1) S.nonObvious.score = Math.min(S.nonObvious.score, 3), S.nonObvious.from += `; ${m.obviousness.obscure} steps at 1.5 or less (obscure?)`;
  S.decoupling = { score: band(m.decoupledShare, [[0, 1], [0.15, 2], [0.3, 3], [0.5, 4]], 5), from: `${m.decoupled} of ${m.steps.length} keys out of the lock's room or sight` };
  const g = m.gadget;
  S.dungeonItem = { score: clamp5(1 + (g.at >= 0.3 && g.at <= 0.65 ? 1 : 0) + (g.uses >= 3 ? 1 : 0) + (g.contexts.length >= 3 ? 1 : 0) + (g.withOld > 0 ? 1 : 0)), from: `chest at ${Math.round(g.at * 100)} % of the steps, ${g.uses} gadget locks, contexts: ${g.contexts.join(', ') || 'none'}, ${g.withOld} with an older verb` };
  const G = m.guardian;
  S.guardianExam = { score: clamp5(1 + (G.usesGadget ? 1 : 0) + (G.fightMechs.length >= 2 ? 1 : 0) + (G.requires.length ? 0.5 : 0) + (G.phases >= 2 ? 0.5 : 0) + (gm?.twist != null && G.usesGadget ? 0.5 : 0) - (G.groundTelegraphs >= 3 ? 0.5 : 0)), from: `${G.usesGadget ? 'asks for the gadget' : 'does not ask for the gadget'}; fight verbs: ${G.fightMechs.join(', ') || 'none'}; ${G.phases} phases; ${G.groundTelegraphs} ground telegraphs` };
  S.identity = { score: clamp5(5 - 4 * maxSimilarity + (Object.keys(m.mechanics).filter((k) => k.startsWith('traverse:')).length >= 2 ? 0.5 : 0)), from: `skeleton ${Math.round(maxSimilarity * 100)} % like the most alike other temple` };
  S.curve = { score: clamp5(1 + (m.curve.trend > 0.2 ? 1 : 0) + (m.curve.trend > 0.5 ? 1 : 0) + (m.curve.last > m.curve.first ? 1 : 0) + (m.curve.last - m.curve.first >= 1 ? 1 : 0)), from: `complexity trend ${m.curve.trend}, first third ${m.curve.first} → last third ${m.curve.last}` };
  const vals = Object.values(S).map((s) => s.score);
  return { criteria: S, total: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) };
}

// ------------------------------------------------------------------ the plan, as a picture

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const OBV = (o) => (o >= 4.5 ? '#d1495b' : o >= 3.5 ? '#edae49' : o >= 2.5 ? '#66a182' : '#2e4057');
/** A top-down plan of a temple (local x, z): rooms, pieces, links, each lock's line to its keys coloured by how obvious it is. */
export function planSvg(g, m, { size = 520, title = '' } = {}) {
  const pts = [...Object.values(g.at).filter(Boolean), ...g.pieces.map((p) => p.pos).filter(Boolean)];
  if (!pts.length) return '<svg xmlns="http://www.w3.org/2000/svg"/>';
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[2]);
  const x0 = Math.min(...xs) - 12, x1 = Math.max(...xs) + 12, z0 = Math.min(...zs) - 12, z1 = Math.max(...zs) + 12;
  const k = Math.min((size - 160) / (x1 - x0), (size * 1.6) / (z1 - z0));
  const W = Math.round((x1 - x0) * k) + 200, H = Math.round((z1 - z0) * k) + 60;
  const P = (p) => [+(((p[0] - x0) * k) + 10).toFixed(1), +(H - 30 - (p[2] - z0) * k).toFixed(1)];
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="sans-serif" font-size="10">`, `<rect width="${W}" height="${H}" fill="#fbf6ec"/>`];
  if (title) o.push(`<text x="8" y="16" font-size="13" font-weight="bold">${esc(title)}</text>`);
  for (const l of g.links) { const a = g.at[l.a], b = g.at[l.b]; if (!a || !b) continue; const [ax, ay] = P(a), [bx, by] = P(b); o.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#b9ad97" stroke-width="3"/>`); }
  for (const r of g.rooms) { const a = g.at[r]; if (!a) continue; const [x, y] = P(a); o.push(`<circle cx="${x}" cy="${y}" r="9" fill="${r === g.chestRoom ? '#f6c84e' : g.boss?.room === r ? '#c7a6f2' : '#efe3cc'}" stroke="#5a4a3a"/><text x="${x + 12}" y="${y + 3}">${esc(r)}</text>`); }
  const steps = new Map((m?.steps ?? []).map((s) => [s.lock, s]));
  for (const l of g.locks) {
    if (!l.pos) continue;
    const [lx, ly] = P(l.pos), s = steps.get(l.id);
    for (const kk of l.keys) { const kp = kk.clue ?? kk.pos; if (!kp) continue; const [kx, ky] = P(kp); o.push(`<line x1="${lx}" y1="${ly}" x2="${kx}" y2="${ky}" stroke="${s ? OBV(s.obvious) : '#999'}" stroke-width="1.6" stroke-dasharray="${kk.visible === false ? '3 2' : ''}"/>`); }
    o.push(`<rect x="${lx - 4}" y="${ly - 4}" width="8" height="8" fill="${s ? OBV(s.obvious) : '#777'}" stroke="#2b211f"/>`);
    if (s) o.push(`<text x="${lx - 30}" y="${ly - 6}" fill="#2b211f">${esc(l.id)} ${s.obvious}</text>`);
  }
  const GLYPH = { Platform: '◎', Updraft: '↑', Gust: '≋', Swing: '∿', Pit: '▫', Glass: '▥', Ball: '●', Plate: '○', Switch: '◉', Brazier: '♨', Bramble: '✶', EchoStone: '♪', EchoEar: '♫', BellEar: '🔔', LightEar: '☼', Seed: '✿', Bank: '⁘', Jaw: '⩚', Bud: '❀', Resonator: '♪', Vane: '✢', Iris: '⊛' };
  for (const p of g.pieces) { if (!p.pos || !GLYPH[p.cls]) continue; const [x, y] = P(p.pos); o.push(`<text x="${x - 4}" y="${y + 4}" fill="${p.hidden ? '#8a7a66' : '#2b211f'}" font-size="11">${GLYPH[p.cls]}</text>`); }
  o.push(`<g transform="translate(${W - 180},${H - 64})"><text y="0">lock → key lines, by obviousness:</text>${[[5, 'painfully obvious (4.5+)'], [4, 'obvious (3.5+)'], [3, 'fair (2.5+)'], [2, 'hidden (below)']].map(([v, t], i) => `<rect y="${6 + i * 12}" width="10" height="8" fill="${OBV(v)}"/><text x="14" y="${13 + i * 12}">${t}</text>`).join('')}</g>`);
  o.push('</svg>');
  return o.join('');
}
