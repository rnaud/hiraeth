import { meetsWith } from '../resources.js';
// A temple's puzzle state, without any three.js: which plates are held,
// which braziers burn, where the drums stand, which doors are open, whether
// the gadget has been taken and the guardian resolved. The runtime
// (runtime.js) feeds it what happens in the world and reads the doors back;
// the tests drive it directly and solve every temple with `solve()`.
//
//   const L = new TempleLogic(def, { store, has });
//     store: { get(key), set(key, value) }   (the game's flags under temple.<id>.*: one per save slot)
//     has(item) -> bool                     (the traveller's items, src/items.js)
//   L.press(plate, by) / L.release(plate, by)  a weight on a plate (by: 'player' or a drum id)
//   L.moveDrum(drum, t)                     a drum rolled along its rail (0..1); it holds its plate at plateAt
//   L.light(id)                             a brazier lit, brambles burnt, a switch splashed, a bell door rung
//   L.takeGadget()                          the chest in the middle of the temple was opened
//   L.find(id)                              a second chest (a `find`) was opened: its item is the traveller's
//   L.resolve()                             the guardian at the end is calmed (or the sentinel stopped)
//   L.update() -> [{ id, open }]            doors and bridges that changed
//   L.isOpen(id) / L.reachable() / L.next() the state, the rooms you can walk to, the next thing to do
//
// The definition (src/temples/<world>.js, `logic`):
//   { id, entry: 'room', gadget: 'fire',
//     rooms: { id: { checkpoint?: true, boss?: true } },
//     links: [{ a, b, door?: id, needs?: ['jetpack'] }],        rooms you walk between (both ways)
//     elements: { id: { type, room, needs?: [items], ... } } }
//   types: plate · drum { plate, plateAt?, stops?, needs? (an iron moon: the tongs; a ball only a tether reaches), roll? (rolls) } · brazier · bramble · switch · bell · gadget { item } · boss
//          · find { item, box } (a second chest, the Rose House's guard: its item a key of the rooms after it; the
//           gadget stays the temple's own, the dungeon item) · map (the little chest with the house's map in it: nothing
//          waits on it, the scout never points at it; issue #405, src/house-map.js)
//          (a drum with `stops: { plate: t }` rests on any of several plates along its groove: one ball, two
//           places, the Builders' Greenhouse's louvres and the Aerie's vents; `rooms: [...]` (issue #408): set from any
//           of those rooms too, a house-wide state with a lever by every hub, the Founders' Belfry's bell rung or still;
//           an entry { room, needs } is set from there only with those items: the hook at a bell's ring)
//          (a latched element may come `after` another: it only takes once that one is lit; or `when` a
//           condition holds: an eye that wakes only in the sun a ball's louvre lets in)
//          (a bell with `hold: s` is not latched: it rings for s seconds, then falls quiet. The piece keeps
//           the time and calls quiet(id); nothing is saved. The Founders' Belfry's held doors and stones.)
//          vane   (the makers' bellows, the Warden's Well: held like a bell, lit only while it turns. A splash spins
//           a small one a while; a great one only turns under the jets' wash. Its piece calls light / quiet.)
//          door / bridge { opens: condition, latch? }   (latch: once open, open for good, saved)
//          (a door with `lock: 'small' | 'big'` is locked as well: it opens only once unlocked with a key, and its `opens`
//           (if any) holds. `keys: n` keyholes (a small lock: n keys, put in one at a time). A small key is any small key:
//           the ones found less the ones put in a lock, as in Zelda)
//          key { kind: 'small' | 'big', when? }   a key on a plinth, taken when you reach it (once its `when` holds)
//          weight { plate, needs?, optional? }   a block of the house's stone carried in both hands (src/carry.js) and set
//           on a plate: it holds the plate down while it sits there (saved: weight.<id> is the plate it sits on). It stays in
//           its room (`room`). needs: what brings it within reach (the hook, off a ledge nobody stands on); optional: for
//           a reward (a coffer), not on the way (the marker leaves it alone; issue #337)
//          arena { }   a room that shuts behind you until its foes are beaten (the runtime's `arenas`): lit once won
//          cache { when? }   a coffer of chimes in an optional room (a reward, nothing waits on it)
//   conditions: { all: [] } · { any: [] } · { pressed: plate } · { lit: id } · { item: id }
//               · { drumOn: [drum, plate] } · { open: door } · { gadget: true } · { resolved: true } · { weightOn: [weight, plate] }

export const DONE = 'done';

/** An in-memory store (tests, and the logic before a save is attached). */
export function memoryStore(init = {}) {
  const data = { ...init };
  return { data, get: (k) => data[k], set: (k, v) => { data[k] = v; } };
}

/** The game's flags as a temple's store: keys under temple.<id>.* (src/game-state.js). */
export function flagStore(game, id) {
  return { get: (k) => game.flag(`temple.${id}.${k}`), set: (k, v) => game.set(`temple.${id}.${k}`, v) };
}

const LATCHED = new Set(['brazier', 'bramble', 'switch', 'bell', 'vane', 'arena']);
/** What is found and kept (a second chest, a key, a coffer, the house's map): `find(id)`. */
const FINDS = new Set(['find', 'key', 'cache', 'map']);
/** Held, not latched: lit only while it rings or turns (a held bell, a vane). */
export const held = (e) => !!e && (e.type === 'vane' || !!e.hold);

export class TempleLogic {
  constructor(def, { store = memoryStore(), has = () => false } = {}) {
    this.def = def;
    this.store = store;
    this.has = has;
    this.weights = new Map();   // plate -> Set of what stands on it (transient)
    this.openNow = new Map();   // door -> open (as last computed)
    this.forced = new Map();    // door -> open, overriding its condition (cleared with force(id, null))
    this.ringing = new Set();   // held bells ringing now (transient: a bell with `hold`)
    for (const [id, e] of Object.entries(def.elements)) if (isGate(e)) this.openNow.set(id, this.computeOpen(id));
  }

  el(id) { return this.def.elements[id]; }
  ofType(type) { return Object.entries(this.def.elements).filter(([, e]) => e.type === type).map(([id]) => id); }

  // ---------------------------------------------------------------- what happened
  press(plate, by = 'player') {
    if (this.el(plate)?.type !== 'plate') return false;
    let s = this.weights.get(plate);
    if (!s) this.weights.set(plate, (s = new Set()));
    if (s.has(by)) return false;
    s.add(by);
    return true;
  }
  release(plate, by = 'player') {
    const s = this.weights.get(plate);
    return !!s?.delete(by);
  }
  pressed(plate) {
    if ((this.weights.get(plate)?.size ?? 0) > 0) return true;
    // a drum resting on it holds it down (and is saved: it is still there after a reload)
    for (const d of this.ofType('drum')) if (this.drumOn(d, plate)) return true;
    // and so does a weight set on it (saved too)
    for (const w of this.ofType('weight')) if (this.weightOn(w) === plate) return true;
    return false;
  }
  /** The plate a carried weight sits on now, or null (picked up, or put down elsewhere). */
  weightOn(id) { return this.el(id)?.type === 'weight' ? this.store.get(`weight.${id}`) || null : null; }
  /** A weight set on a plate (or taken off it: null). Returns true if that changed. Call update() after. */
  placeWeight(id, plate = null) {
    if (this.el(id)?.type !== 'weight') return false;
    if (plate && this.el(plate)?.type !== 'plate') return false;
    if ((this.weightOn(id) ?? null) === (plate ?? null)) return false;
    this.store.set(`weight.${id}`, plate ?? '');
    return true;
  }
  drumT(drum) { return this.trial?.drum === drum ? this.trial.t : this.store.get(`drum.${drum}`) ?? this.el(drum)?.start ?? 0; }
  moveDrum(drum, t) {
    const e = this.el(drum);
    if (e?.type !== 'drum') return false;
    t = Math.min(1, Math.max(0, t));
    if (Math.abs(t - this.drumT(drum)) < 1e-4) return false;
    this.store.set(`drum.${drum}`, Math.round(t * 1000) / 1000);
    return true;
  }
  drumOn(drum, plate) {
    const e = this.el(drum);
    if (e?.type !== 'drum') return false;
    const at = stopOf(e, plate);
    if (at == null) return false;
    return Math.abs(this.drumT(drum) - at) <= (e.tolerance ?? 0.06);
  }
  /** Light a brazier, burn brambles, splash a switch, ring a bell door. Needs: the element's items (fire, bell…). */
  light(id) {
    const e = this.el(id);
    if (!e || !LATCHED.has(e.type)) return false;
    if (!this.canUse(id)) return false;
    if (held(e)) { if (this.ringing.has(id)) return false; this.ringing.add(id); return true; }
    if (this.store.get(`lit.${id}`)) return false;
    this.store.set(`lit.${id}`, true);
    return true;
  }
  /** A held bell's note has faded (its piece kept the time). */
  quiet(id) { return this.ringing.delete(id); }
  isLit(id) { return held(this.el(id)) ? this.ringing.has(id) : !!this.store.get(`lit.${id}`); }
  /** Its items are carried, the one it comes `after` (a sequence: crystals sung low to high) is lit, and its `when` holds. */
  canUse(id) { const e = this.el(id); return (e?.needs ?? []).every((it) => this.has(it)) && (!e?.after || this.isLit(e.after)) && (!e?.when || this.check(e.when)); }
  takeGadget() {
    if (this.store.get('gadget')) return false;
    this.store.set('gadget', true);
    return true;
  }
  /** A second chest (a `find`) opened, a key taken, a coffer opened (once its `when` holds); or its item carried in already. */
  find(id) {
    const e = this.el(id);
    if (!FINDS.has(e?.type) || this.store.get(`found.${id}`) || (e.when && !this.check(e.when))) return false;
    this.store.set(`found.${id}`, true);
    return true;
  }
  // ---------------------------------------------------------------- keys and locks
  /** Keys of a kind in hand: those taken, less those put in a lock of that kind. */
  keys(kind = 'small') {
    let n = 0;
    for (const [id, e] of Object.entries(this.def.elements)) {
      if (e.type === 'key' && (e.kind ?? 'small') === kind && this.store.get(`found.${id}`)) n++;
      if (isGate(e) && e.lock === kind) n -= this.keysIn(id);
    }
    return n;
  }
  /** How many keys are in a lock now (saved), and how many it takes. */
  keysIn(id) { return this.store.get(`unlocked.${id}`) ?? 0; }
  keyholes(id) { return this.el(id)?.lock ? this.el(id).keys ?? 1 : 0; }
  unlocked(id) { const e = this.el(id); return !e?.lock || this.keysIn(id) >= this.keyholes(id); }
  /** A key could go into this lock now: a keyhole free and a key of its kind in hand. */
  canUnlock(id) { const e = this.el(id); return !!e?.lock && !this.unlocked(id) && this.keys(e.lock) > 0; }
  /** Put one key in (a lock of several keyholes takes them one at a time). Call update() after. */
  unlock(id) {
    if (!this.canUnlock(id)) return false;
    this.store.set(`unlocked.${id}`, this.keysIn(id) + 1);
    return true;
  }
  isFound(id) { const e = this.el(id); return !!this.store.get(`found.${id}`) || (!!e?.item && this.has(e.item)); }
  /** The gadget is yours: the chest opened here, or you carried it in already (an old save, another way). */
  get gadget() { return !!this.store.get('gadget') || (!!this.def.gadget && this.has(this.def.gadget)); }
  resolve() {
    if (this.resolved) return false;
    this.store.set('boss', DONE);
    return true;
  }
  get resolved() { return this.store.get('boss') === DONE; }

  // ---------------------------------------------------------------- doors
  check(c) {
    if (c == null) return true;
    if (Array.isArray(c)) return c.every((x) => this.check(x));
    if (c.all) return c.all.every((x) => this.check(x));
    if (c.any) return c.any.some((x) => this.check(x));
    if (c.not) return !this.check(c.not);
    if (c.pressed) return this.pressed(c.pressed);
    if (c.lit) return this.isLit(c.lit);
    if (c.item) return this.has(c.item);
    if (c.drumOn) return this.drumOn(c.drumOn[0], c.drumOn[1]);
    if (c.weightOn) return this.weightOn(c.weightOn[0]) === c.weightOn[1];
    if (c.open) return this.isOpen(c.open);
    if (c.gadget) return this.gadget;
    if (c.resolved) return this.resolved;
    return true;
  }
  computeOpen(id) {
    const e = this.el(id);
    if (!isGate(e)) return true;
    // held shut (the arena's door while the guardian is awake: the runtime decides)
    if (this.forced.has(id)) return this.forced.get(id);
    if (e.lock && !this.unlocked(id)) return false;   // (locked: whatever else it waits for)
    if (e.lock && e.opens === undefined) return true;
    if (e.latch && this.store.get(`open.${id}`)) return true;
    return this.check(e.opens);
  }
  isOpen(id) { return this.openNow.get(id) ?? this.computeOpen(id); }
  /** Recompute every door and bridge; latch the latching ones. Returns what changed. */
  update() {
    const changed = [];
    // (twice: a door that opens on another door's opening)
    for (let pass = 0; pass < 3; pass++) {
      let any = false;
      for (const [id, e] of Object.entries(this.def.elements)) {
        if (!isGate(e)) continue;
        const open = this.computeOpen(id);
        if (open && e.latch && !this.store.get(`open.${id}`)) this.store.set(`open.${id}`, true);
        if (this.openNow.get(id) !== open) { this.openNow.set(id, open); changed.push({ id, open }); any = true; }
      }
      if (!any) break;
    }
    return changed;
  }

  /** Hold a door open or shut whatever its condition (null: let it be). Call update() after. */
  force(id, open = null) { if (open === null) this.forced.delete(id); else this.forced.set(id, !!open); }

  // ---------------------------------------------------------------- the rooms
  linkOpen(l) {
    if (l.door && !this.isOpen(l.door)) return false;
    // (a link held by an element itself, thorns over a doorway: open once it is burnt)
    if (l.door && !isGate(this.el(l.door)) && LATCHED.has(this.el(l.door)?.type) && !this.isLit(l.door)) return false;
    return (l.needs ?? []).every((it) => this.has(it));
  }
  /** The rooms you can walk to from the entrance now. */
  reachable() {
    const seen = new Set([this.def.entry]), todo = [this.def.entry];
    while (todo.length) {
      const r = todo.pop();
      for (const l of this.def.links) {
        const other = l.a === r ? l.b : l.b === r && !l.oneWay ? l.a : null;
        if (!other || seen.has(other) || !this.linkOpen(l)) continue;
        seen.add(other); todo.push(other);
      }
    }
    return seen;
  }
  /**
   * The next thing to do, for the quest marker and the scout: the first
   * element (in the definition's order) in a reachable room that is not done
   * and can be done now; else the first closed door out of a reachable room.
   */
  next() {
    const reach = this.reachable();
    for (const [id, e] of Object.entries(this.def.elements)) {
      // (a lock a key can go in now, by a room you can reach: a door has no room of its own)
      if (isGate(e) && e.lock && this.canUnlock(id) && this.lockReachable(id, reach)) return id;
      if (!inReach(e, reach, (it) => this.has(it))) continue;
      if (e.type === 'gadget' && !this.gadget) return id;
      if (e.type === 'find' && !this.isFound(id)) return id;
      if (e.type === 'key' && !this.isFound(id) && this.check(e.when)) return id;
      if (LATCHED.has(e.type) && !this.isLit(id) && this.canUse(id) && (!held(e) || this.awaited(id))) return id;
      if (e.type === 'drum' && e.plate && !e.stops && !this.drumOn(id, e.plate) && rolls(e, (it) => this.has(it)) && (e.needs ?? []).every((it) => this.has(it))) return id;
      // (a ball with several stops: worth pushing when one it isn't on is awaited)
      // (or when the one it is on holds a door shut: the Aerie's gulf vent, its stone in the throat)
      // (a stop is worth it only for a door that leads somewhere not in reach now: the Aerie's one stone opens the vent's
      // shaft down into the Moult in one throat and the column to the great key in the other, and once the Moult's own door
      // is open the shaft is no way anywhere new: issue #23)
      // (and not a stop that only half-answers one door while it shuts another: the Footprint's great lift, issue #401, whose
      // sphere up holds F1's bridges and down is one of the far door's three lamps; down it goes once that door would open)
      if (e.type === 'drum' && e.stops && rolls(e, (it) => this.has(it)) && (e.needs ?? []).every((it) => this.has(it)) && Object.keys(e.stops).some((p) => (!this.drumOn(id, p) && this.awaitedStop(p, reach) && this.worthMove(id, p)) || (this.drumOn(id, p) && this.holdsShut(p)))) return id;
      // (a weight worth carrying onto its plate: one a shut door waits for; a reward's, `optional`, the marker leaves alone)
      if (e.type === 'weight' && !e.optional && e.plate && this.weightOn(id) !== e.plate && (e.needs ?? []).every((it) => this.has(it)) && this.awaited(e.plate)) return id;
      if (e.type === 'boss' && !this.resolved) return id;
    }
    // a plate still worth standing on: one a shut door is waiting for (not one a weight of its own is for: that is carried)
    for (const [id, e] of Object.entries(this.def.elements)) if (e.type === 'plate' && reach.has(e.room) && !this.pressed(id) && this.awaited(id) && !this.ofType('weight').some((w) => this.el(w).plate === id)) return id;
    return null;
  }
  /**
   * Is rolling `drum` onto `plate` worth it now: it opens a shut door or bridge, or it shuts none that stands open (a trial:
   * nothing saved, nothing latched)?
   */
  worthMove(drum, plate) {
    const at = stopOf(this.el(drum), plate);
    if (at == null) return false;
    const gates = Object.keys(this.def.elements).filter((d) => isGate(this.el(d)));
    // (or what it lets be done: an eye whose `when` it answers, a key or a coffer whose cage it sinks: the Engine-House's
    // Governor Room, its one ball moved off the hammer's crank to wake the pistons' eyes)
    const waits = Object.entries(this.def.elements).filter(([d, g]) => g.when && ((LATCHED.has(g.type) && !this.isLit(d)) || (FINDS.has(g.type) && !this.isFound(d)))).map(([d]) => d);
    const state = () => [...gates.map((d) => this.computeOpen(d)), ...waits.map((d) => this.check(this.el(d).when))];
    const before = state();
    this.trial = { drum, t: at };
    const after = state();
    this.trial = null;
    return after.some((v, i) => v && !before[i]) || !gates.some((_, i) => before[i] && !after[i]);
  }
  /** A shut door or bridge waits for this plate to be let go (its `opens` wants it `not` pressed: a stone out of a throat). */
  holdsShut(id) { return Object.entries(this.def.elements).some(([d, g]) => isGate(g) && !this.isOpen(d) && mentionsNot(g.opens, id)); }
  /** A side of the lock's doorway can be walked to. */
  lockReachable(id, reach = this.reachable()) { return this.def.links.some((l) => l.door === id && (reach.has(l.a) || (reach.has(l.b) && !l.oneWay))); }
  /** A shut door or bridge is waiting for this element (a plate, a held bell: worth going to), or an unlit eye's `when` is. */
  // (or a key still caged waits for it: the Belfry's great key, whose cage sinks only while the founders' bell rings)
  awaited(id) { return Object.entries(this.def.elements).some(([d, g]) => (isGate(g) && !this.isOpen(d) && mentions(g.opens, id)) || (LATCHED.has(g.type) && g.when && !this.isLit(d) && mentions(g.when, id)) || (FINDS.has(g.type) && g.when && !this.isFound(d) && mentions(g.when, id))); }
  /**
   * As awaited, for a ball's stop (`reach`: the rooms in reach now): a shut door waiting for it counts only if it leads to a
   * room out of reach, if no link goes through it, or if another shut door opens with it ({ open }).
   */
  awaitedStop(id, reach = this.reachable()) {
    const els = Object.entries(this.def.elements);
    return els.some(([d, g]) => {
      if (LATCHED.has(g.type) && g.when && !this.isLit(d) && mentions(g.when, id)) return true;
      if (!isGate(g) || this.isOpen(d) || !mentions(g.opens, id)) return false;
      const ls = this.def.links.filter((l) => l.door === d);
      return !ls.length || ls.some((l) => !reach.has(l.a) || !reach.has(l.b)) || els.some(([o, h]) => o !== d && isGate(h) && !this.isOpen(o) && opensWith(h.opens, d));
    });
  }
}

/**
 * The rooms you can get to now that you can't get back to the entrance from (issue #275: over the Aerie's gulf without
 * the great key, nothing took you back). From each room reachable from the entrance, the links walked the way they go
 * (a `oneWay` link only from a to b: a glide across, a drop, a wind that carries you), through the doors as they stand;
 * where that finds no way, the house is solved on from that room as it stands (a stone rolled there, a plate stood on,
 * what can be done from where you are) until the entrance comes in reach, or nothing more can be done: stranded. The
 * guardian's arena and the way out past it are left out: the arena's door shuts behind you by design, and its guardian
 * is the way on.
 */
export function stranded(L) {
  const def = L.def, entry = def.entry;
  const boss = new Set(Object.entries(def.rooms).filter(([, r]) => r.boss).map(([id]) => id));
  const past = new Set(def.links.filter((l) => boss.has(l.a) && l.door && def.elements[l.door]?.opens?.resolved).map((l) => l.b));
  const back = (from) => {
    const seen = new Set([from]), todo = [from];
    while (todo.length) {
      const r = todo.pop();
      if (r === entry) return true;
      for (const l of def.links) {
        const other = l.a === r ? l.b : l.b === r && !l.oneWay ? l.a : null;
        if (!other || seen.has(other) || !L.linkOpen(l)) continue;
        seen.add(other); todo.push(other);
      }
    }
    return false;
  };
  // (solved on from room r, the house as it stands: does the entrance come in reach?)
  const solvedBack = (r) => {
    if (!L.store.data) return false;
    let home = false;
    const from = { data: L.store.data, has: (i) => L.has(i) };
    const R = solve({ ...def, entry: r }, { items: [], from, each: (L2) => { home ||= L2.reachable().has(entry); } });
    return home || R.logic.reachable().has(entry);
  };
  return [...L.reachable()].filter((r) => r !== entry && !boss.has(r) && !past.has(r) && !back(r) && !solvedBack(r));
}

/** Where along its groove a drum rests on `plate` (t), or null: its own plate, or one of its `stops`. */
export function stopOf(e, plate) {
  if (e?.stops && e.stops[plate] != null) return e.stops[plate];
  return e?.plate === plate ? e.plateAt ?? 1 : null;
}

const isGate = (e) => e?.type === 'door' || e?.type === 'bridge';
/**
 * An element is in reach when its room is, or (a house-wide state set from several places, issue #408: the Founders'
 * Belfry's bell, a lever by every hub, the hook at its bells' rings) any of its `rooms` is: a room's id, or { room, needs }
 * where it is set only with those items (has(item)).
 */
export const roomsOf = (e) => (e?.rooms ?? []).map((r) => (typeof r === 'string' ? { room: r, needs: [] } : { needs: [], ...r }));
export const inReach = (e, reach, has = () => true) => reach.has(e?.room) || roomsOf(e).some((r) => reach.has(r.room) && r.needs.every(has));
/**
 * What rolls a drum (its `roll`): 'hand' a shove (nothing carried, the Rose House's first ball), 'sword' a cut of the
 * blade (or a push of the gun); left out, the gun's push, as every temple's balls before v1.44.
 */
export function rolls(e, has) {
  if (e?.roll === 'hand') return true;
  if (e?.roll === 'sword') return has('sword') || has('gun');
  return has('gun');
}
/** Does a condition name this element inside a `not` (it wants it let go)? */
const mentionsNot = (c, id) => !!c && (Array.isArray(c) ? c.some((x) => mentionsNot(x, id)) : mentions(c.not, id) || mentionsNot(c.all, id) || mentionsNot(c.any, id));
/** Does a condition wait for this door to be open ({ open: door })? */
const opensWith = (c, id) => !!c && (Array.isArray(c) ? c.some((x) => opensWith(x, id)) : c.open === id || opensWith(c.all, id) || opensWith(c.any, id) || opensWith(c.not, id));
/** Does a condition name this element (a plate, a brazier…)? */
const mentions = (c, id) => !!c && (Array.isArray(c) ? c.some((x) => mentions(x, id)) : c.pressed === id || c.lit === id || c.drumOn?.includes(id) || c.weightOn?.includes(id) || mentions(c.all, id) || mentions(c.any, id) || mentions(c.not, id));

/**
 * Solve a temple through its state machine, as a player would: walk to every
 * room that is open, do everything that can be done there (take the gadget,
 * light what burns, roll the drums onto their plates, stand on each plate in
 * turn), until the guardian can be faced, then resolve it. `items` is what the
 * traveller carries in; `withhold` items never come (to prove a gadget is the
 * key). `reverse`: walk the rooms' elements and the locks the other way round (the wings of a hub, taken in the
 * other order: a temple whose keys could be wasted fails one way or the other); `forbid`: elements never done (a wing
 * left alone: the other still gives its key); `each(logic, step)`: called after every step, the house as it stands then
 * (the way-back check, tests/way-back.test.js); `from: { data, has }`: go on from a house as it stands (a memory store's
 * data, and what was carried). Returns { done, log, order (rooms
 * in the order reached), gadgetAt (index in log), stuck (rooms reached when it got stuck) }.
 */
export function solve(def, { items = ['backpack', 'gun'], withhold = [], maxSteps = 400, reverse = false, forbid = [], each = null, from = null } = {}) {
  const owned = new Set(items.filter((i) => !withhold.includes(i)));
  const has = (i) => meetsWith((x) => owned.has(x), i) || !!from?.has(i);   // ('magic:4': the bar the items make, src/resources.js)
  const L = new TempleLogic(def, { has, store: from ? memoryStore(from.data) : memoryStore() });
  const log = [], order = [def.entry];
  let gadgetAt = -1;
  const lockIds = Object.entries(def.elements).filter(([, e]) => isGate(e) && e.lock).map(([id]) => id);
  const note = (s) => { log.push(s); L.update(); for (const r of L.reachable()) if (!order.includes(r)) order.push(r); each?.(L, s); };
  for (let step = 0; step < maxSteps; step++) {
    const reach = L.reachable();
    let did = false;
    const els = Object.entries(def.elements);
    for (const [id, e] of reverse ? els.slice().reverse() : els) {
      if (!inReach(e, reach, has) || forbid.includes(id)) continue;
      if (e.type === 'gadget' && !L.store.get('gadget')) {
        L.takeGadget();
        if (e.item && !withhold.includes(e.item)) owned.add(e.item);
        gadgetAt = log.length; note(`take ${id}${e.item ? ` (${e.item})` : ''}`); did = true; break;
      }
      if (e.type === 'find' && !L.isFound(id)) {
        L.find(id);
        if (e.item && !withhold.includes(e.item)) owned.add(e.item);
        note(`find ${id}${e.item ? ` (${e.item})` : ''}`); did = true; break;
      }
      if ((e.type === 'key' || e.type === 'cache' || e.type === 'map') && !L.isFound(id) && L.find(id)) { note(`${e.type === 'cache' ? 'open' : 'take'} ${id}`); did = true; break; }
      if (LATCHED.has(e.type) && !L.isLit(id) && L.canUse(id)) { L.light(id); note(`${e.type} ${id}`); did = true; break; }
      if (e.type === 'drum' && e.plate && !e.stops && !L.drumOn(id, e.plate) && rolls(e, has) && (e.needs ?? []).every(has)) { L.moveDrum(id, e.plateAt ?? 1); note(`roll ${id} onto ${e.plate}`); did = true; break; }
      // (a weight carried onto its plate, in its room: issue #337)
      if (e.type === 'weight' && e.plate && L.weightOn(id) !== e.plate && (e.needs ?? []).every(has)) { L.placeWeight(id, e.plate); note(`carry ${id} onto ${e.plate}`); did = true; break; }
      if (e.type === 'boss' && !L.resolved && (e.needs ?? []).every(has) && L.check(e.requires)) { L.resolve(); note(`resolve ${id}`); did = true; break; }
    }
    if (did) continue;
    // a lock a key can go in now, beside a room you can reach (in the definition's order, or the other way round: `reverse`)
    for (const id of reverse ? lockIds.slice().reverse() : lockIds) if (L.canUnlock(id) && L.lockReachable(id, reach)) { L.unlock(id); note(`unlock ${id}`); did = true; break; }
    if (did) continue;
    // a ball with several stops: roll it to one that lets something new be done (an eye's `when`, a door, a room)
    // (tried without update(): a trial must not latch a door open)
    const score = () => {
      const rooms = new Set([def.entry]), todo = [def.entry];
      while (todo.length) {
        const r = todo.pop();
        for (const l of def.links) {
          const o = l.a === r ? l.b : l.b === r && !l.oneWay ? l.a : null;
          if (o && !rooms.has(o) && (!l.door || L.computeOpen(l.door)) && (l.needs ?? []).every(has)) { rooms.add(o); todo.push(o); }
        }
      }
      // (an eye that can be woken now first: it stays woken, and the ball can go on to its next place; then rooms, then doors)
      const usable = Object.entries(def.elements).filter(([x, g]) => LATCHED.has(g.type) && !L.isLit(x) && L.canUse(x)).length;
      // (and a lock a key in hand fits, brought within reach: the Mooring-House's great lock past the west door, v1.53)
      const fits = lockIds.filter((x) => L.canUnlock(x) && L.lockReachable(x, rooms)).length;
      // (a room never reached before counts more than one left behind: the Aerie's one stone, its vent's shaft down into the
      // Moult while it sits in one throat, the column up to the great key's perch in the other, issue #23)
      const fresh = [...rooms].filter((r) => !order.includes(r)).length;
      return usable * 1e6 + fits * 1e5 + fresh * 1e4 + rooms.size * 1000 + Object.entries(def.elements).filter(([x, g]) => isGate(g) && L.computeOpen(x)).length;
    };
    // (and with you standing on a plate there: a ball set down in one place while you stand in another, the Footprint's)
    const plates = L.ofType('plate').filter((p) => reach.has(def.elements[p].room) && !L.pressed(p));
    const scoreStood = () => { let best = score(); for (const p of plates) { L.press(p, 'player'); best = Math.max(best, score()); L.release(p, 'player'); } return best; };
    const stopBalls = Object.entries(def.elements).filter(([id, e]) => !forbid.includes(id) && e.type === 'drum' && e.stops && rolls(e, has) && inReach(e, reach, has) && (e.needs ?? []).every(has));
    for (const [id, e] of stopBalls) {
      const t0 = L.drumT(id), base = scoreStood();
      let best = null;
      for (const [plate, at] of Object.entries(e.stops)) {
        if (L.drumOn(id, plate)) continue;
        L.moveDrum(id, at);
        const s = scoreStood();
        if (s > base && (!best || s > best.s)) best = { plate, at, s };
        L.moveDrum(id, t0);
      }
      if (best) { L.moveDrum(id, best.at); note(`roll ${id} onto ${best.plate}`); did = true; break; }
    }
    if (did) continue;
    // stand on each reachable plate in turn: does a door open, and stay open once you step off?
    const openCount = () => Object.keys(def.elements).filter((id) => isGate(def.elements[id]) && L.isOpen(id)).length;
    for (const p of L.ofType('plate')) {
      if (!reach.has(def.elements[p].room) || L.pressed(p)) continue;
      const before = openCount();
      L.press(p, 'player'); L.update(); L.release(p, 'player'); L.update();
      if (openCount() > before) { note(`stand on ${p}`); did = true; break; }
    }
    if (did) continue;
    // (two balls at once, issue #401: a door that wants two of them, each on one of its stops, where neither alone opens
    // anything: the Footprint's far door, the great sphere down on F2 and the sphere on the walker's print. Tried only once
    // nothing else is left)
    let pair = null;
    const base2 = stopBalls.length > 1 ? scoreStood() : 0;
    for (let i = 0; i < stopBalls.length; i++) for (let j = i + 1; j < stopBalls.length; j++) {
      const [ia, ea] = stopBalls[i], [ib, eb] = stopBalls[j], ta = L.drumT(ia), tb = L.drumT(ib);
      for (const [pa, sa] of Object.entries(ea.stops)) for (const [pb, sb] of Object.entries(eb.stops)) {
        if (L.drumOn(ia, pa) || L.drumOn(ib, pb)) continue;
        L.moveDrum(ia, sa); L.moveDrum(ib, sb);
        const sc = scoreStood();
        if (sc > base2 && (!pair || sc > pair.s)) pair = { s: sc, moves: [[ia, pa, sa], [ib, pb, sb]] };
        L.moveDrum(ia, ta); L.moveDrum(ib, tb);
      }
    }
    if (pair) { for (const [d, p, t] of pair.moves) { L.moveDrum(d, t); note(`roll ${d} onto ${p}`); } did = true; }
    if (!did) break;
  }
  return { done: L.resolved, log, order, gadgetAt, stuck: [...L.reachable()], logic: L };
}
