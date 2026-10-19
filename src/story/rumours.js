// Rumours (issue #340, the author: "Non quest characters in the world should often offer you a hint or a rumor about
// where to find fragments of light, where to find a mini game, where to find a point of interest on the map. We can add
// these to the map when that happens as an area marker (not a perfect marker)."). docs/systems/story.md "Rumours".
//
// The people outside the quests (the bystanders and the crowd, who only talk: src/story/dialogue.js pickListen; the
// shops' keepers, between their hello and their wares) often, not always, say one line about something near them you
// have not found: a fragment of the singing light (its place in their words, src/story/rumour-places.js), a game's host
// you have not met (src/story/hosts-data.js), or a place to stop for (the level's sights). The line is in their world's
// voice (src/story/rumours-data.js); the Map gets a soft circle round where it is, never centred on it, named with the
// rumour's short name, until the thing is found (the fragment taken, the host met or passed, the place reached). A rumour
// is told once; a world has at most RUMOUR.active of them open at a time. The save keeps them (flags, below).
//
//   const r = new Rumours({ world, game, level, rng })   one a world (src/story/index.js)
//   r.addHost({ id, name, title, object, at, lacks?, fight? })    a game's host as the story places them (lacks(): what its run
//                                                         wants that he hasn't got; never told of till it is '')
//   r.offer(person, at) → '~tone~ line' | null            a line for this talk (and the rumour told), or none
//   r.update(dt, pos)                                     places and hosts walked by count as found
//   r.marks() → [{ id, key, kind: 'rumour', x, z, r, label, by, target }]   the Map's circles (engine-neutral: main.js, engine/game.js)
//   r.closed() → label | null                             the rumour told in the talk that just closed (the toast)
//
// Pure helpers (tests/rumours.test.js): rumourTargets, rumourArea, rumourLine, fragmentWhere.
//
// The save: `rumours.<world>.<key>` the speaker's name, once told; `rumours.<world>.seen.<key>` a place or a host reached.
// Keys: `frag.<i>` (src/fragments-data.js), `host.<id>`, `sight.<name>`.

import { FRAGMENTS } from '../fragments-data.js';
import { compass } from '../world-map.js';
import { parseLine } from './tone.js';
import { RUMOUR_LINES, RUMOUR_OBJECT_LINES, RUMOUR_FIGHT_LINES, RUMOUR_FRAGMENT_LABEL } from './rumours-data.js';
import { RUMOUR_PLACES, RUMOUR_KINDS } from './rumour-places.js';

export const RUMOUR = {
  chance: 0.45,        // a talk that could tell one does, this often ("often, not always")
  active: 3,           // rumours open at once in a world, at most
  near: 450,           // m: what the speaker would know of (nearer first; past it only when nothing is nearer)
  here: 30,            // m: nothing this close to the speaker (you can see it)
  radius: [30, 60],    // m: the circle on the map
  offset: [0.3, 0.7],  // its middle this far from the thing, of its radius: inside it, never on it
  seen: 16,            // m: a place or a host this near is found (and its height within `rise`)
  rise: 14,
  every: 0.5,          // s between the checks of what you have walked by
  maxLength: 120,      // characters a line, at most
  weights: { fragment: 0.5, host: 0.25, sight: 0.25 },
  landmark: 25,        // m: a fragment this near its landmark is "by" it, else "north of" it
};

const FNV = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
/** A number in [0, 1) from a string and a salt (the same every time). */
export const hash01 = (s, salt = '') => FNV(`${s}|${salt}`) / 4294967296;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const lower = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const list = (v) => (typeof v === 'function' ? v() : v) ?? [];
/** A point as { x, y, z } from a Vector3, { x, z }, or [x, y, z]. */
export const ptOf = (p) => (p == null ? null : Array.isArray(p) ? { x: +p[0], y: +(p.length > 2 ? p[1] : 0) || 0, z: +p[p.length > 2 ? 2 : 1] } : Number.isFinite(p.x) ? { x: p.x, y: Number.isFinite(p.y) ? p.y : 0, z: p.z } : null);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** A sight's name as said: its number, its note in brackets and what follows a comma left off ("a sandfall off the mesa (1)", "the north camp, under the breaking wave"). */
export const sayName = (name) => String(name ?? '').replace(/\s*\([^)]*\)\s*$/, '').replace(/,.*$/, '').trim();
const slug = (s) => sayName(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The flags a world's rumours keep. */
export const toldKey = (world, key) => `rumours.${world}.${key}`;
export const seenKey = (world, key) => `rumours.${world}.seen.${key}`;

/**
 * The circle on the map round a rumour's thing at `at`: { x, z, r }, r between RUMOUR.radius, its middle
 * RUMOUR.offset of r away from the thing, the way picked by the key (the same circle every time it is drawn).
 */
export function rumourArea(key, at, R = RUMOUR) {
  const r = R.radius[0] + (R.radius[1] - R.radius[0]) * hash01(key, 'r');
  const d = r * (R.offset[0] + (R.offset[1] - R.offset[0]) * hash01(key, 'd')), a = 2 * Math.PI * hash01(key, 'a');
  return { x: at.x + d * Math.cos(a), z: at.z + d * Math.sin(a), r };
}

/** The level's places to stop for, one each (a numbered row of them is one): [{ name, at }]. */
export function levelSights(level) {
  const out = [], seen = new Set();
  for (const s of list(level?.sights)) {
    const name = sayName(s.name), at = ptOf(s.at);
    if (!name || !at || seen.has(name)) continue;
    seen.add(name); out.push({ name, at });
  }
  return out;
}

/** What a fragment's place is told by: the sights, the beacons (at their foot), the temples' doors, your ship. */
export function levelLandmarks(level) {
  const out = levelSights(level);
  for (const b of list(level?.beacons)) { const at = ptOf(b.top); if (at && b.name) out.push({ name: sayName(b.name), at }); }
  for (const t of level?.temples ?? []) { const at = ptOf(t.outside?.door?.at); if (at && t.def?.name) out.push({ name: lower(t.def.name.replace(/^The /, 'the ')), at }); }
  const ship = ptOf(level?.ship?.pos);
  if (ship) out.push({ name: 'your ship', at: ship });
  return out;
}

/**
 * Everything a rumour could point at in `world`: [{ key, kind, at, label, i? (a fragment's slot), host?, found }].
 * `flags` the save's; `sights` levelSights; `hosts` [{ id, name, title, object, at }].
 */
export function rumourTargets({ world, flags = {}, sights = [], hosts = [] }) {
  const out = [];
  (FRAGMENTS[world] ?? []).forEach((p, i) => {
    out.push({ key: `frag.${i}`, kind: 'fragment', i, at: { x: p[0], y: p[1], z: p[2] }, label: RUMOUR_FRAGMENT_LABEL, found: !!flags[`frag.${world}.${i}`] });
  });
  for (const h of hosts) {
    const key = `host.${h.id}`, at = ptOf(h.at);
    if (!at) continue;
    // (waiting: the run wants what he hasn't got, its host's lacks(): not told of till it can be had, issue #480)
    out.push({ key, kind: 'host', at, host: h, label: h.object ? cap(h.name) : h.fight ?? `${h.name}’s game`, found: !!(flags[`met.${h.id}`] || flags[seenKey(world, key)]), waiting: !!h.lacks?.() });
  }
  for (const s of sights) {
    const key = `sight.${slug(s.name)}`;
    out.push({ key, kind: 'sight', at: s.at, place: s.name, label: cap(s.name), found: !!flags[seenKey(world, key)] });
  }
  return out;
}

/** "north-west of here", or "close by". */
const dirOf = (from, to) => (flat(from, to) < 40 ? 'close by' : `${compass(to.x - from.x, to.z - from.z)} of here`);
const wayOf = (from, to) => compass(to.x - from.x, to.z - from.z) || 'ahead';

/**
 * A fragment's place in the people's words, most told first: its own place (src/story/rumour-places.js), then, where it
 * wants one, which way it lies from the nearest landmark ("on a ledge with a long drop, north of the salt pan"), else from
 * the speaker ("…, west of here"). [phrase, …] longest first (rumourLine takes the first that fits).
 */
export function fragmentWhere(world, i, at, { landmarks = [], from = null } = {}) {
  const entry = RUMOUR_PLACES[world]?.[i] ?? '=near';
  const generic = entry.startsWith('='), more = generic || entry.endsWith('+');
  const kind = generic ? entry.slice(1) : null;
  const base = generic ? RUMOUR_KINDS[kind] ?? RUMOUR_KINDS.near : more ? entry.slice(0, -1) : entry;
  if (!more) return [base];
  const out = [];
  let best = null, bd = Infinity;
  for (const l of landmarks) { const d = flat(l.at, at); if (d < bd) { bd = d; best = l; } }
  const sep = kind && kind !== 'near' ? ', ' : ' ';
  if (best && bd < 600) out.push(bd < RUMOUR.landmark ? `${base}${sep}by ${best.name}` : `${base}${sep}${compass(at.x - best.at.x, at.z - best.at.z)} of ${best.name}`);
  if (from) out.push(flat(from, at) < 40 ? `${base}${sep}close by` : `${base}${sep}${compass(at.x - from.x, at.z - from.z)} of here`);
  out.push(kind === 'near' ? 'somewhere out there' : base);
  return out;
}

/**
 * The line a person of `world` says of `target` (rumourTargets'), from where they stand (`from`): a template of the
 * world's (src/story/rumours-data.js) picked by `seed`, filled in; the first that fits RUMOUR.maxLength (the tag aside),
 * else the shortest. '~tone~ text', or null where the world has no lines.
 */
export function rumourLine(world, target, { from = null, landmarks = [], seed = 0 } = {}) {
  const L = RUMOUR_LINES[world];
  if (!L || !target) return null;
  const at = target.at, here = from ?? at;
  const object = target.kind === 'host' && target.host?.object;
  // (a spring-house's host, h.fight: not a game, the ink that comes up there, issue #483)
  const fight = target.kind === 'host' && !object && target.host?.fight ? RUMOUR_FIGHT_LINES[world] ?? RUMOUR_FIGHT_LINES.any : null;
  const templates = target.kind === 'fragment' ? L.fragment : target.kind === 'host' ? (object ? RUMOUR_OBJECT_LINES : fight ?? L.host) : L.sight;
  if (!templates?.length) return null;
  // (what fills {where} or {who}: the fullest first)
  const fills = target.kind === 'fragment' ? fragmentWhere(world, target.i, at, { landmarks, from })
    : target.kind === 'host' ? (object ? [lower(target.host.name)] : [target.host.title ? `${target.host.name}, ${target.host.title},` : target.host.name, target.host.name])
      : [target.place];
  const dir = dirOf(here, at), way = wayOf(here, at);
  const fill = (tpl, f) => tpl
    .replaceAll('{where}', f).replaceAll('{who}', f).replaceAll('{Who}', cap(f)).replaceAll('{host}', f)
    .replaceAll('{place}', f).replaceAll('{Place}', cap(f)).replaceAll('{dir}', dir).replaceAll('{Dir}', cap(dir)).replaceAll('{way}', way)
    // ("…, who fishes the basin, north of here." but never ",." or ",!" or ", ,")
    .replace(/,([.!?)])/g, '$1').replace(/,\s*,/g, ',');
  const n = templates.length, start = Math.abs(Math.floor(seed)) % n;
  let shortest = null;
  for (const f of fills) for (let k = 0; k < n; k++) {
    const s = fill(templates[(start + k) % n], f), len = parseLine(s).text.length;
    if (len <= RUMOUR.maxLength) return s;
    if (!shortest || len < shortest.len) shortest = { s, len };
  }
  return shortest?.s ?? null;
}

/** Who never tells one: an alien (their own ways of saying), a game's host, a quest person, or one marked so. */
export const tellsRumours = (person) => !!person && !person.species && !person.host && !person.noRumours && (!!person.talk?.listen || !!person.rumourNode);

export class Rumours {
  constructor({ world, game, level = null, rng = Math.random, hosts = [] } = {}) {
    Object.assign(this, { world, game, level, rng });
    this.enabled = !!RUMOUR_LINES[world];
    this.sights = levelSights(level);
    this.landmarks = levelLandmarks(level);
    this.hosts = [...hosts];
    this.pending = null;
    this.t = 0;
  }
  get flags() { return this.game?.data?.flags ?? {}; }
  /** A game's host as the story stands them (src/story/index.js host): { id (their talk's), name, title, object, at, lacks? }. */
  addHost(h) { if (h?.id && !this.hosts.some((x) => x.id === h.id)) this.hosts.push(h); }
  targets() { return rumourTargets({ world: this.world, flags: this.flags, sights: this.sights, hosts: this.hosts }); }
  /** Told and not found yet. */
  active() { const f = this.flags; return this.targets().filter((t) => f[toldKey(this.world, t.key)] && !t.found); }
  /** Every rumour told in this world (found or not). */
  told() { const f = this.flags; return this.targets().filter((t) => f[toldKey(this.world, t.key)]); }
  /**
   * A rumour for this talk (`person` the one talking, `at` where they stand), or null: not every time (RUMOUR.chance),
   * never past RUMOUR.active open ones, never the same twice; the thing unfound, near them first. Told, it is saved.
   */
  offer(person, at = null) {
    if (!this.enabled || !tellsRumours(person)) return null;
    if (this.active().length >= RUMOUR.active) return null;
    if (this.rng() >= RUMOUR.chance) return null;
    const from = ptOf(at) ?? this.landmarks[0]?.at ?? { x: 0, y: 0, z: 0 }, f = this.flags;
    const open = this.targets().filter((t) => !t.found && !t.waiting && !f[toldKey(this.world, t.key)] && flat(t.at, from) > RUMOUR.here)
      .map((t) => ({ t, d: flat(t.at, from) })).sort((a, b) => a.d - b.d);
    if (!open.length) return null;
    // (what they would know of: near them; the nearest few when nothing is)
    const near = open.filter((o) => o.d <= RUMOUR.near);
    const pool = near.length ? near : open.slice(0, 4);
    // (a kind first, by its weight among those there are, then one of its three nearest)
    const kinds = [...new Set(pool.map((o) => o.t.kind))];
    const total = kinds.reduce((a, k) => a + (RUMOUR.weights[k] ?? 0.2), 0);
    let x = this.rng() * total, kind = kinds[kinds.length - 1];
    for (const k of kinds) { x -= RUMOUR.weights[k] ?? 0.2; if (x < 0) { kind = k; break; } }
    const some = pool.filter((o) => o.t.kind === kind).slice(0, 3);
    const pick = some[Math.min(some.length - 1, Math.floor(this.rng() * some.length))].t;
    const line = rumourLine(this.world, pick, { from, landmarks: this.landmarks, seed: FNV(`${person.heard ?? person.id}|${pick.key}`) });
    if (!line) return null;
    const by = person.name ?? 'someone';
    this.game?.set?.(toldKey(this.world, pick.key), by);
    this.pending = pick.label;
    this.game?.emit?.('rumour', { world: this.world, key: pick.key, kind: pick.kind, label: pick.label, by });
    return line;
  }
  /** The places and the hosts walked by count as found (a rumour of them clears; one of them is never told). */
  update(dt, pos) {
    if (!this.enabled || !pos || (this.t -= dt) > 0) return;
    this.t = RUMOUR.every;
    const f = this.flags;
    for (const t of this.targets()) {
      if (t.kind === 'fragment' || t.found) continue;
      if (flat(t.at, pos) < RUMOUR.seen && Math.abs((pos.y ?? 0) - (t.at.y ?? 0)) < RUMOUR.rise && !f[seenKey(this.world, t.key)]) this.game?.set?.(seenKey(this.world, t.key), true);
    }
  }
  /** The Map's circles: one each rumour told and not found (engine-neutral, src/world-map.js mapMarks `rumours`). */
  marks() {
    const f = this.flags;
    return this.active().map((t) => ({ id: `rumour.${t.key}`, key: t.key, kind: 'rumour', ...rumourArea(`${this.world}.${t.key}`, t.at), label: t.label, by: f[toldKey(this.world, t.key)], target: { x: t.at.x, z: t.at.z } }));
  }
  /** The rumour told in the talk just closed, once (its label), for the toast. */
  closed() { const p = this.pending; this.pending = null; return p; }
}
