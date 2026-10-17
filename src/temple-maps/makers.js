// The temple maps (issue #396; docs/systems/dev-tools.md "The temple maps"): a makers' temple as a map the author can
// review, everything read from the temple's own data and solver, nothing laid by hand:
//
//   the plan      the kit's plan per floor (record.js: halls, round halls, corridors, walls with their doorways, slabs,
//                 stairs, ramps, bridges, shafts), the rooms where their marks and pieces stand (the design audit's
//                 puzzleGraph, scripts/temple-design/lib.mjs), the doors, the lifts and winds (the riding discs, the
//                 updrafts)
//   the graph     rooms and the links between them: open ways, doors (and what opens them), locks (small and great
//                 keys), bridges, the ways only an item makes (a glide, the jets), one-way drops, the guardian's doors;
//                 each lock with its keys and clues and where they sit (the audit's locks: rooms away, metres, in sight)
//   the solution  src/temples/logic.js solve(), the state machine the tests solve every temple with, as a numbered
//                 list of steps, each with the walk to it through the doors open then, what it opens, its verbs, and
//                 whether anything waits on it (solved again without it: optional)
//   the numbers   rooms, floors, keys and locks, steps, metres walked, the furthest clue from its lock, backtracks,
//                 the verbs
//
//   makersMap(id, { built })   → the map (shape: the head of src/temple-maps/fights.js; both kinds alike for the page)
//   carriedInto(id)            what the traveller carries in by then (the route's gadgets before it)
//   roomName(id)               a room's id in plain words

import * as THREE from 'three';
import { TEMPLES, templesIn } from '../temples/index.js';
import { solve, TempleLogic } from '../temples/logic.js';
import { ORDER } from '../levels/names.js';
import { ITEMS } from '../items.js';
import { puzzleGraph, mechanicOf, piecePos, GADGET_VERB, dist } from '../../scripts/temple-design/lib.mjs';
import { buildTemple } from './record.js';
import { floorsOf, floorAt, roomPlaces, onFloors, boundsOf } from '../temples/house-plan.js';

// ------------------------------------------------------------------ the route
/** The makers' temples in the order the route reaches them (a merged world's own first, then its part's). */
export const ROUTE_TEMPLES = ORDER.flatMap((w) => templesIn(w).sort((a, b) => (b === w) - (a === w)));
/** Every makers' temple: the route's first, then any other. */
export const MAKERS = [...ROUTE_TEMPLES, ...Object.keys(TEMPLES).filter((id) => !ROUTE_TEMPLES.includes(id))];
const gadgetsOf = (id) => Object.values(TEMPLES[id]?.def.logic.elements ?? {}).filter((e) => (e.type === 'gadget' || e.type === 'find') && e.item).map((e) => e.item);
/**
 * What the traveller carries into a temple (as the design audit has it, scripts/temple-design/audit.mjs): the backpack,
 * the double jump, the gun (not into the Rose House: the Hearth's), and every gadget of the temples before it.
 */
export function carriedInto(id) {
  const k = ROUTE_TEMPLES.indexOf(id);
  return ['backpack', 'doublejump', ...(id === 'desert' ? [] : ['gun']), ...(k < 0 ? [] : ROUTE_TEMPLES.slice(0, k).flatMap(gadgetsOf))];
}

// ------------------------------------------------------------------ plain words
const SHORT = { esc: 'escapement', gov: 'governor', pend: 'pendulum', ante: 'antechamber', out: 'way out', threshold: 'entrance', stage: 'entrance stage', storeW: 'west store', storeE: 'east store' };
/** A room's id in plain words: "furnaceFar" → "furnace, far side". */
export function roomName(id) {
  if (SHORT[id]) return SHORT[id];
  const m = /^(.*?)(Far|Key|Way|Top|Ledge)$/.exec(id);
  if (m && m[1]) return `${roomName(m[1])}, ${{ Far: 'far side', Key: 'key ledge', Way: 'way down', Top: 'top', Ledge: 'ledge' }[m[2]]}`;
  return id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}
const itemName = (it) => (it === 'magic:4' ? 'a fourth unit of fluid' : ITEMS[it]?.name ?? it);
/** What an element is, in a word or two (from its type and the piece the layout placed for it). */
export function nounOf(id, e, piece) {
  const cls = piece?.cls;
  if (!e) return id;
  switch (e.type) {
    case 'drum': return e.verb === 'sluice' ? 'sluice' : e.needs?.includes('magnet') ? 'iron ball' : 'ball';
    case 'plate': return 'floor plate';
    case 'switch': return cls === 'Bank' ? 'bank of eyes' : cls === 'Bud' ? 'flower-door' : cls === 'Seed' ? 'seed' : cls === 'EchoEar' ? 'brass horn' : cls === 'Jaw' ? 'gate of jaws' : piece?.o?.crystal ? 'singing crystal' : 'eye';
    case 'brazier': return 'brazier';
    case 'bramble': return 'thorns';
    case 'bell': return cls === 'HookBell' ? 'pull-ring bell' : 'bell';
    case 'vane': return 'vane';
    case 'key': return e.kind === 'big' ? 'great key' : 'small key';
    case 'gadget': return 'chest';
    case 'find': return 'chest';
    case 'cache': return 'coffer';
    case 'map': return 'map chest';
    case 'weight': return 'stone block';
    case 'arena': return 'foes';
    case 'door': return e.lock === 'big' ? 'great lock' : e.lock ? 'locked door' : 'door';
    case 'bridge': return 'bridge';
    case 'boss': return 'guardian';
    default: return e.type;
  }
}
/** The verbs a step asks for, in plain words (the design audit's mechanics). */
export const VERB_WORDS = {
  push: 'roll a ball', weight: 'stand on a plate', shot: 'shoot', ember: 'set alight', bell: 'ring a bell', sluice: 'set the water', sequence: 'in order',
  volley: 'in one breath', timed: 'against the clock', reveal: 'see the hidden', key: 'carry a key', fight: 'fight', carry: 'carry a block',
  take: 'open a chest', unlock: 'unlock', guardian: 'face the guardian', dodge: 'dodge the hazard', gorged: 'a gorged one', tough: 'the tough ones',
};
export const verbWord = (m) => (m.startsWith('gadget:') ? GADGET_VERB[m.slice(7)] ?? itemName(m.slice(7)) : VERB_WORDS[m] ?? m);

// ------------------------------------------------------------------ floors (shared with the house's map in the game)
export { floorsOf, floorAt };

// ------------------------------------------------------------------ the walk
/** The cheapest way between rooms through the links open now: Dijkstra over waypoints (room → doorway → room). */
function route(from, to, links, at, open) {
  if (from === to) return [from];
  const D = new Map([[from, 0]]), prev = new Map(), todo = new Set([from]);
  while (todo.size) {
    let r = null;
    for (const x of todo) if (r === null || D.get(x) < D.get(r)) r = x;
    todo.delete(r);
    if (r === to) break;
    for (const [i, l] of links.entries()) {
      if (!open(i)) continue;
      const o = l.a === r ? l.b : l.b === r && !l.oneWay ? l.a : null;
      if (!o || !at[o] || !at[r]) continue;
      const w = l.way ?? null, c = D.get(r) + (w ? dist(at[r], w) + dist(w, at[o]) : dist(at[r], at[o]));
      if (!D.has(o) || c < D.get(o)) { D.set(o, c); prev.set(o, { r, i }); todo.add(o); }
    }
  }
  if (!prev.has(to)) return null;
  const out = [to];
  for (let x = to; x !== from;) { const p = prev.get(x); out.unshift({ link: p.i }, p.r); x = p.r; }
  return out;
}

const round1 = (v) => Math.round(v * 10) / 10;
const r3 = (p) => (p ? p.map(round1) : null);
const isGate = (e) => e?.type === 'door' || e?.type === 'bridge';

/**
 * A makers' temple's map. `built`: a build already made (record.js buildTemple), kept by the page for its 3D view;
 * else one is made and disposed of. `los(a, b, link, key)`: line of sight for the clues (the page and the test pass the
 * one built from the temple's walls, sightOf); left out, everything counts as seen.
 */
export function makersMap(id, { built = null, sight = true } = {}) {
  const T = TEMPLES[id];
  if (!T) throw new Error(`no makers' temple ${id}`);
  const def = T.def, logic = def.logic;
  const B = built ?? buildTemple(def);
  const { rt, pieces, plan } = B;
  const items = carriedInto(id);
  const S = solve(logic, { items });
  const los = sight ? sightOf(B, logic, S.order) : null;
  const g = puzzleGraph(logic, pieces, { los, order: S.order });
  const E = logic.elements;

  // ---- where things are (the kit's local metres)
  const byId = new Map();
  for (const p of pieces) { const pos = piecePos(p.o); for (const k of [p.o?.id, p.o?.bloom, p.o?.still]) if (k && pos && !byId.has(k)) byId.set(k, { ...p, pos }); }
  // (the guardian's hall at its arena's middle)
  const arena = rt.guardian?.arena?.center ? rt.kit.local(rt.guardian.arena.center.clone()).toArray() : null;
  const bossRoom = Object.entries(logic.rooms).find(([, r]) => r.boss)?.[0];
  const at = roomPlaces(logic, pieces, { arena });

  // ---- floors: the rooms' floors, and the plan's walkable parts on the nearest
  const floors = floorsOf(Object.values(at).map((p) => p[1]));
  const shapes = onFloors(plan, floors, pieces);

  // ---- the rooms
  const rooms = g.rooms.map((r) => ({ id: r, name: roomName(r), pos: r3(at[r]), floor: floorAt(floors, at[r][1]), kind: logic.rooms[r].kind ?? null, boss: !!logic.rooms[r].boss, checkpoint: !!logic.rooms[r].checkpoint, entry: r === logic.entry }));

  // ---- the links and their locks
  const lockOf = new Map(g.locks.map((l) => [l.id, l]));
  // the doorways the plan has (a wall's holes from the floor, a round hall's gaps): where a link with no piece of its own
  // goes through, the one on the shortest way between its rooms' middles
  const doorways = [];
  for (const s of plan) {
    if (s.kind === 'wall') for (const h of s.holes ?? []) if (h.y0 < 2.5) { const u = (h.x0 + h.x1) / 2; doorways.push([s.a[0] + s.dir[0] * u, s.y0 + h.y0, s.a[1] + s.dir[1] * u]); }
    if (s.kind === 'round') for (const q of s.gaps ?? []) if ((q.y0 ?? 0) < 2.5) { const R = s.r + (s.t ?? 1.4) / 2; doorways.push([s.x + Math.sin(q.a) * R, s.y + (q.y0 ?? 0), s.z + Math.cos(q.a) * R]); }
  }
  const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  const doorwayFor = (A, B) => {
    let best = null, bd = Infinity;
    for (const c of doorways) {
      if (Math.abs(c[1] - A[1]) > 3 && Math.abs(c[1] - B[1]) > 3) continue;
      const d = flat(A, c) + flat(c, B);
      if (d < bd) { bd = d; best = c; }
    }
    return best && bd < flat(A, B) * 1.5 + 8 ? best : null;
  };
  const links = logic.links.map((l, i) => {
    const e = l.door ? E[l.door] : null;
    const way = byId.get(l.door)?.pos ?? (at[l.a] && at[l.b] ? doorwayFor(at[l.a], at[l.b]) ?? at[l.a].map((v, k) => (v + at[l.b][k]) / 2) : null);
    const lock = lockOf.get(l.door ?? `${l.a}>${l.b}`);
    let type = 'open';
    if (l.oneWay) type = 'oneway';
    else if (l.needs?.some((n) => n !== 'backpack')) type = 'needs';
    if (e?.lock) type = e.lock === 'big' ? 'great' : 'locked';
    else if (e && isGate(e) && e.opens && conditionHas(e.opens, 'resolved')) type = 'boss';
    else if (e && isGate(e) && e.opens === null) type = 'arena';
    else if (e?.type === 'bridge') type = 'bridge';
    else if (e && isGate(e)) type = type === 'open' ? 'door' : type;
    else if (e) type = type === 'open' ? 'held' : type;   // (a link held by an element itself: thorns over a doorway)
    const needs = (l.needs ?? []).filter((n) => n !== 'backpack');
    return {
      id: `L${i}`, a: l.a, b: l.b, door: l.door ?? null, type, oneWay: !!l.oneWay, needs, way: r3(way),
      floor: floorAt(floors, way?.[1] ?? at[l.a][1]),
      label: linkLabel(l, e, type, needs, byId.get(l.door)),
      keys: (lock?.keys ?? []).map((k) => keyOf(k, at)),
      latch: !!e?.latch,
    };
  });
  // the cages of keys and coffers (what earns them, in their own room)
  const cages = g.locks.filter((l) => l.type === 'cage').map((l) => ({ id: l.id, room: l.a, element: l.id.slice(5), keys: l.keys.map((k) => keyOf(k, at)) }));

  // ---- the elements (everything you work), each with its verbs
  const elements = Object.entries(E).filter(([, e]) => !isGate(e)).map(([k, e]) => {
    const piece = byId.get(k) ?? null;
    const pos = piece?.pos ?? (e.room ? at[e.room] : null);
    const verbs = e.type === 'boss' ? ['guardian', ...(e.needs ?? []).filter((n) => n !== 'backpack').map((n) => `gadget:${n}`)] : e.type === 'gadget' || e.type === 'find' || e.type === 'cache' || e.type === 'map' ? ['take'] : e.type === 'weight' ? ['carry'] : mechanicOf(k, e, { elements: E, piece });
    return { id: k, type: e.type, room: e.room ?? null, noun: nounOf(k, e, piece), pos: r3(pos), floor: e.room && at[e.room] ? floorAt(floors, at[e.room][1]) : pos ? floorAt(floors, pos[1]) : null, verbs: [...new Set(verbs)], item: e.item ?? null, hidden: !!piece?.o?.hidden };
  });
  const elOf = new Map(elements.map((e) => [e.id, e]));

  // ---- the solution: solve() step by step, the house as it stood before each step for the walk to it
  // What nothing waits on (a test scale, a coffer, a wing that is only a shortcut, what is worked during the guardian's
  // fight): the house solved again without it (and without the extras found before it) still ends with the guardian
  // resolved. The solution is solved without them all, and they are listed apart, as extras.
  const first = solve(logic, { items });
  const optional = [];
  const resolvedAt = first.log.findIndex((x) => x.startsWith('resolve '));
  for (const [n, line] of first.log.entries()) {
    const s = parseStep(line), e = E[s.id];
    if (!e || optional.includes(s.id) || !['take', 'light', 'roll', 'carry', 'open'].includes(s.verb) || e.type === 'gadget' || e.type === 'boss') continue;
    // (one worked after the fight that was worked before it too is no extra: the Builders' Greenhouse's bridge ball, issue #411)
    const before = resolvedAt >= 0 && first.log.slice(0, resolvedAt).some((x) => parseStep(x).id === s.id);
    if ((resolvedAt >= 0 && n > resolvedAt && !before) || solve(logic, { items, forbid: [...optional, s.id] }).done) optional.push(s.id);
  }
  const snapsFor = (o) => {
    const snaps = [];
    const snap = (L) => ({ open: logic.links.map((l) => L.linkOpen(l)), gates: new Set(Object.keys(E).filter((k) => isGate(E[k]) && L.isOpen(k))), reach: new Set(L.reachable()) });
    const L0 = new TempleLogic(logic, { has: (it) => items.includes(it) });
    L0.update();
    snaps.push(snap(L0));
    const R = solve(logic, { items, ...o, each: (L) => snaps.push(snap(L)) });
    return { R, snaps };
  };
  let { R, snaps } = snapsFor({ forbid: optional });
  if (!R.done) ({ R, snaps } = snapsFor({}));
  const W = logic.links.map((l, i) => ({ ...l, way: links[i].way }));
  const guardian = rt.guardian?.def ?? null;
  const steps = [];
  let here = logic.entry, herePos = (rt.arrival?.pos ? rt.kit.local(rt.arrival.pos.clone()).toArray() : at[logic.entry]);
  const visited = [logic.entry];
  let walked = 0, backtracks = 0;
  const placeOf = (s, before) => {
    // where it is done: the element's room and place (a lock: the side of its doorway you can reach)
    if (s.verb === 'unlock') {
      const l = logic.links.find((x) => x.door === s.id && (before.reach.has(x.a) || before.reach.has(x.b)));
      const room = l ? (before.reach.has(l.a) ? l.a : l.b) : here;
      return { room, pos: byId.get(s.id)?.pos ?? at[room] };
    }
    const e = E[s.id], room = e?.room ?? here;
    let pos = (s.verb === 'roll' || s.verb === 'carry') && s.onto ? byId.get(s.onto)?.pos ?? byId.get(s.id)?.pos : byId.get(s.id)?.pos;
    if (e?.type === 'boss' && arena) pos = arena;
    return { room, pos: pos ?? at[room] };
  };
  // the locks a step's element is a key of (a plate it rolls a ball onto counts), its own distance to each and whether in sight
  const servesOf = (s) => [...links, ...cages].flatMap((l) => l.keys.filter((k) => k.how !== 'key' && (k.id === s.id || (s.onto && k.plate === s.onto) || k.plate === s.id)).map((k) => ({ lock: l.door ?? l.element, link: l.id, metres: k.metres, rooms: k.rooms, visible: k.visible })))
    .filter((x, i, a) => a.findIndex((q) => q.lock === x.lock) === i);
  // the clues a lock needs read elsewhere (the Footprint's mural): shown on the step that opens it
  const cluesOf = (opened) => [...links, ...cages].filter((l) => opened.includes(l.door ?? l.element)).flatMap((l) => l.keys.filter((k) => k.how === 'clue').map((k) => ({ lock: l.door ?? l.element, id: k.id, room: k.room, metres: k.metres, rooms: k.rooms, visible: k.visible })));
  // (the solution ends with the guardian resolved: what the solver does after it is no step of it)
  const end = R.log.findIndex((x) => x.startsWith('resolve '));
  for (const [n, line] of R.log.slice(0, end < 0 ? undefined : end + 1).entries()) {
    const s = parseStep(line);
    const before = snaps[n], after = snaps[n + 1];
    const { room, pos } = placeOf(s, before);
    const path = route(here, room, W, at, (i) => before.open[i]) ?? [here, room];
    const pts = [herePos];
    const through = [];
    for (const x of path) {
      if (typeof x === 'object') { const w = links[x.link].way; if (w) pts.push(w); through.push(links[x.link].id); continue; }
      if (x !== here && x !== room) pts.push(at[x]);
      if (x !== path[0]) { if (visited.includes(x) && visited.at(-1) !== x) backtracks++; if (visited.at(-1) !== x) visited.push(x); }
    }
    pts.push(pos);
    const metres = pts.slice(1).reduce((a, p, k) => a + dist(pts[k], p), 0);
    walked += metres;
    here = room; herePos = pos;
    const opened = [...after.gates].filter((x) => !before.gates.has(x));
    const el = elOf.get(s.id);
    const verbs = s.verb === 'unlock' ? ['unlock', 'key'] : s.verb === 'stand' ? ['weight'] : s.verb === 'carry' ? ['carry'] : el?.verbs ?? [];
    steps.push({
      id: `${id}-${n + 1}`, n: n + 1, verb: s.verb, element: s.id, onto: s.onto ?? null, room, roomName: roomName(room), floor: floorAt(floors, (at[room] ?? pos)[1]), pos: r3(pos),
      text: stepText(s, { E, el, room, guardian, links, logic, nth: R.log.slice(0, n).filter((x) => x === line).length }),
      opens: opened, rooms: [...after.reach].filter((x) => !before.reach.has(x)), through, path: pts.map(r3), metres: round1(metres),
      verbs, optional: false, serves: servesOf(s), clue: cluesOf(opened),
    });
  }
  // each room's stage: how many steps that opened new rooms came before it could be reached (the flow graph's rows)
  const stage = {};
  for (const r of snaps[0].reach) stage[r] = 0;
  let opened = 0;
  for (const s of steps) if (s.rooms.length) { opened++; for (const r of s.rooms) stage[r] ??= opened; }
  for (const r of rooms) r.stage = stage[r.id] ?? opened + 1;
  // the extras, apart: what nothing waits on, where it is and what it would open
  const extras = optional.map((k, i) => {
    const e = E[k], el = elOf.get(k), line = first.log.find((x) => parseStep(x).id === k);
    const s = parseStep(line ?? `${e.type} ${k}`);
    const opens = Object.entries(E).filter(([d, g]) => isGate(g) && JSON.stringify(g.opens ?? null).includes(`"${k}"`)).map(([d]) => d);
    return { id: `${id}-x${i + 1}`, n: `x${i + 1}`, verb: s.verb, element: k, room: e.room ?? null, roomName: roomName(e.room ?? ''), floor: el?.floor ?? 'f0', pos: el?.pos ?? null,
      text: stepText(s, { E, el, room: e.room, guardian, links, logic }), opens, verbs: el?.verbs ?? [], optional: true, serves: servesOf(s), clue: [],
      // (what it is for, when the house says so, issue #411: the house's map, a try of the gadget, a shortcut kept for good)
      why: e.type === 'map' ? 'the house’s map: nothing waits on it' : e.try ? 'a try: the gadget shown where nothing waits on it' : e.shortcut ? 'a shortcut: the house solves without it, quicker with it'
        : resolvedAt >= 0 && first.log.indexOf(line) > resolvedAt ? 'worked during or after the guardian’s fight' : 'the house solves without it' };
  });

  // ---- the numbers
  const keyLocks = links.filter((l) => l.type === 'locked' || l.type === 'great');
  const puzzleLinks = links.filter((l) => l.keys.length && l.type !== 'arena' && l.type !== 'boss');
  const clueDists = [...links, ...cages].flatMap((l) => l.keys.filter((k) => isClue(k) && Number.isFinite(k.metres)).map((k) => ({ metres: k.metres, key: k.id, lock: l.door ?? l.element ?? l.id, rooms: k.rooms })));
  const furthest = clueDists.reduce((b, c) => (!b || c.metres > b.metres ? c : b), null);
  const verbCount = {};
  for (const st of steps) for (const v of st.verbs) verbCount[v] = (verbCount[v] ?? 0) + 1;
  const metrics = {
    rooms: rooms.length,
    floors: floors.length,
    keys: elements.filter((e) => e.type === 'key').length,
    locks: keyLocks.length,
    puzzles: puzzleLinks.length + cages.length,
    steps: steps.length,
    optional: extras.length,
    walked: Math.round(walked),
    furthestClue: furthest ? { ...furthest, metres: round1(furthest.metres) } : null,
    backtracks,
    verbs: verbCount,
    solved: R.done,
  };
  if (!built) rt.dispose?.();
  return {
    kind: 'makers', id, name: def.name, world: TEMPLES[id] ? id : null,
    carried: items, gadget: logic.gadget ? { item: logic.gadget, name: itemName(logic.gadget), verb: GADGET_VERB[logic.gadget] ?? null, room: g.chestRoom } : null,
    guardian: guardian ? { name: guardian.name, kind: guardian.kind ?? null, room: bossRoom } : null,
    floors, plan: { shapes, bounds: boundsOf(shapes, rooms) }, rooms, links, cages, elements, steps, extras, metrics,
  };
}

// ------------------------------------------------------------------ helpers
function conditionHas(c, k) {
  if (!c) return false;
  if (Array.isArray(c)) return c.some((x) => conditionHas(x, k));
  return !!c[k] || conditionHas(c.all, k) || conditionHas(c.any, k) || conditionHas(c.not, k);
}
/** A lock's key or clue, for the page: its element, room, how far from the lock (metres, rooms) and whether it is in sight. */
function keyOf(k, at) {
  return { id: k.id, how: k.how, room: k.room ?? null, plate: k.plate ?? null, metres: Number.isFinite(k.metres) ? round1(k.metres) : null, rooms: k.rooms ?? 0, visible: k.visible !== false, pos: r3(k.clue ?? k.pos ?? (k.room ? at[k.room] : null)), clueAt: r3(k.clue ?? null) };
}
/** A key that is a clue to find (a plate, an eye, a ball, a mural): not a key carried, an item, nor the guardian. */
const isClue = (k) => !['key', 'needs', 'item', 'resolved', 'gadget', 'open'].includes(k.how);
/** One line of solve()'s log as { verb, id, onto }. */
export function parseStep(line) {
  let m;
  if ((m = /^take (\S+) \((.+)\)$/.exec(line))) return { verb: 'take', id: m[1], item: m[2] };
  if ((m = /^find (\S+)(?: \((.+)\))?$/.exec(line))) return { verb: 'take', id: m[1], item: m[2] ?? null };
  if ((m = /^take (\S+)$/.exec(line))) return { verb: 'take', id: m[1] };
  if ((m = /^open (\S+)$/.exec(line))) return { verb: 'open', id: m[1] };
  if ((m = /^roll (\S+) onto (\S+)$/.exec(line))) return { verb: 'roll', id: m[1], onto: m[2] };
  if ((m = /^carry (\S+) onto (\S+)$/.exec(line))) return { verb: 'carry', id: m[1], onto: m[2] };
  if ((m = /^stand on (\S+)$/.exec(line))) return { verb: 'stand', id: m[1] };
  if ((m = /^unlock (\S+)$/.exec(line))) return { verb: 'unlock', id: m[1] };
  if ((m = /^resolve (\S+)$/.exec(line))) return { verb: 'resolve', id: m[1] };
  if ((m = /^(brazier|bramble|switch|bell|vane|arena) (\S+)$/.exec(line))) return { verb: 'light', id: m[2], type: m[1] };
  return { verb: 'other', id: line.split(' ')[1] ?? line };
}
const LIGHT = { brazier: 'Light the brazier', bramble: 'Burn the thorns', bell: 'Ring the bell', vane: 'Turn the vane', arena: 'Beat the foes' };
function stepText(s, { E, el, room, guardian, links, nth = 0 }) {
  const where = ` in “${roomName(room)}”`;
  const tag = ` (${s.id})`;
  const e = E[s.id];
  const needs = (e?.needs ?? []).filter((n) => n !== 'backpack' && n !== 'gun');
  const using = needs.length ? `, with the ${needs.map(itemName).join(' and ')}` : '';
  switch (s.verb) {
    case 'take':
      if (e?.type === 'gadget') return `Open the chest${where}: the ${itemName(e.item)}${tag}`;
      if (e?.type === 'find') return `Open the chest${where}: the ${itemName(e.item)}${tag}`;
      if (e?.type === 'map') return `Open the little chest${where}: the house’s map${tag}`;
      return `Take the ${el?.noun ?? 'key'}${where}${tag}`;
    case 'open': return `Open the coffer${where}${tag}`;
    // (a house-wide state, issue #408: the Founders' Belfry's bell, rung or stilled at a lever or a bell's ring)
    case 'roll': return e?.verb === 'bell' ? `${(e.stops?.[s.onto] ?? 1) > 0 ? 'Ring' : 'Still'} the house’s bell, at a lever or a bell’s ring${tag} → ${s.onto}`
      // (issue #411: the Builders' Greenhouse's water, sent up or let down at a sluice wheel)
      : e?.verb === 'sluice' ? `${(e.stops?.[s.onto] ?? 1) > 0 ? 'Send the house’s water up' : 'Let the house’s water down'}, at a sluice wheel${tag} → ${s.onto}`
      : `Roll the ${el?.noun ?? 'ball'} onto its plate${where}${using}${tag} → ${s.onto}`;
    case 'carry': return `Carry the stone block onto its plate${where}${using}${tag} → ${s.onto}`;
    case 'stand': return `Stand on the floor plate${where}${tag}`;
    case 'unlock': {
      const l = links.find((x) => x.door === s.id);
      const holes = E[s.id]?.keys ?? 1;
      const kind = E[s.id]?.lock === 'big' ? 'the great key' : `a small key${holes > 1 ? ` (keyhole ${nth + 1} of ${holes})` : ''}`;
      return `Put ${kind} in the door ${l ? `between “${roomName(l.a)}” and “${roomName(l.b)}”` : ''}${tag}`;
    }
    case 'resolve': return `${guardian?.kind === 'robot' ? 'Stop' : 'Calm'} ${guardian?.name ?? 'the guardian'}${where}${tag}`;
    case 'light': {
      if (s.type === 'switch') {
        const n = el?.noun ?? 'eye';
        const verb = n === 'flower-door' || n === 'seed' ? 'Bloom' : n === 'brass horn' ? 'Play the note back into' : n === 'gate of jaws' ? 'Still' : n === 'bank of eyes' ? 'Wake every eye of' : 'Wake';
        return `${verb} the ${n}${where}${using}${tag}`;
      }
      return `${LIGHT[s.type] ?? 'Work'}${where}${using}${tag}`;
    }
    default: return `${s.verb} ${s.id}${where}`;
  }
}
function linkLabel(l, e, type, needs, piece) {
  const via = needs.length ? `needs the ${needs.map(itemName).join(' and ')}` : '';
  const what = { open: 'open way', oneway: 'one-way drop', needs: 'a way only an item makes', locked: 'locked door', great: 'great lock', boss: 'opens once the guardian is resolved', arena: 'shuts behind you while its fight lasts', bridge: 'bridge', door: 'door', held: 'blocked' }[type];
  const cls = piece?.cls && !['Door', 'Bridge'].includes(piece.cls) ? ` (${piece.cls.toLowerCase()})` : '';
  return [what + cls, via, l.oneWay && type !== 'oneway' ? 'one way' : ''].filter(Boolean).join(' · ');
}
/**
 * Line of sight in the temple's own frame (as the design audit has it): its walls, floors and pieces, the doors shut as at
 * the start, but those you came through to reach a lock's room open by then; the key looked at never hides itself.
 */
export function sightOf({ rt }, logic, order) {
  const solids = [];
  const isUnder = (o, root) => { for (let p = o; p; p = p.parent) if (p === root) return true; return false; };
  rt.root.updateMatrixWorld(true);
  rt.root.traverse((o) => { if (o.isMesh && o.geometry && !(rt.guardian && isUnder(o, rt.guardian.model?.group))) solids.push(o); });
  const at = (r) => { const i = order.indexOf(r); return i < 0 ? Infinity : i; };
  const meshesOf = (p) => { const out = new Set(); for (const v of Object.values(p)) if (v?.isObject3D) v.traverse((o) => { if (o.isMesh) out.add(o); }); return out; };
  const passed = new Map(), own = new Map();
  const openBy = (link) => {
    if (!link) return solids;
    if (!passed.has(link)) {
      const skip = new Set();
      for (const l of logic.links) if (l.door && l !== link && Math.max(at(l.a), at(l.b)) <= at(link.a)) for (const p of rt.pieces) if (p.id === l.door) for (const m of meshesOf(p)) skip.add(m);
      passed.set(link, solids.filter((m) => !skip.has(m)));
    }
    return passed.get(link);
  };
  const ownOf = (id) => { if (!own.has(id)) { const s = new Set(); for (const p of rt.pieces) if (p.id === id) for (const m of meshesOf(p)) s.add(m); own.set(id, s); } return own.get(id); };
  const ray = new THREE.Raycaster();
  return (a, b, link, key = null) => {
    const A = rt.kit.world(...a), B = rt.kit.world(...b), d = A.distanceTo(B);
    if (d < 0.5) return true;
    ray.set(A, B.clone().sub(A).normalize()); ray.far = d - 1.2;
    const skip = key ? ownOf(key) : null;
    return ray.intersectObjects(openBy(link), false).filter((h) => !skip?.has(h.object)).length === 0;
  };
}
