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
//   L.resolve()                             the guardian at the end is calmed (or the sentinel stopped)
//   L.update() -> [{ id, open }]            doors and bridges that changed
//   L.isOpen(id) / L.reachable() / L.next() the state, the rooms you can walk to, the next thing to do
//
// The definition (src/temples/<world>.js, `logic`):
//   { id, entry: 'room', gadget: 'fire',
//     rooms: { id: { checkpoint?: true, boss?: true } },
//     links: [{ a, b, door?: id, needs?: ['jetpack'] }],        rooms you walk between (both ways)
//     elements: { id: { type, room, needs?: [items], ... } } }
//   types: plate · drum { plate, plateAt? } · brazier · bramble · switch · bell · gadget { item } · boss
//          (a latched element may come `after` another: it only takes once that one is lit)
//          door / bridge { opens: condition, latch? }   (latch: once open, open for good, saved)
//   conditions: { all: [] } · { any: [] } · { pressed: plate } · { lit: id } · { item: id }
//               · { drumOn: [drum, plate] } · { open: door } · { gadget: true } · { resolved: true }

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

const LATCHED = new Set(['brazier', 'bramble', 'switch', 'bell']);

export class TempleLogic {
  constructor(def, { store = memoryStore(), has = () => false } = {}) {
    this.def = def;
    this.store = store;
    this.has = has;
    this.weights = new Map();   // plate -> Set of what stands on it (transient)
    this.openNow = new Map();   // door -> open (as last computed)
    this.forced = new Map();    // door -> open, overriding its condition (cleared with force(id, null))
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
    return false;
  }
  drumT(drum) { return this.store.get(`drum.${drum}`) ?? this.el(drum)?.start ?? 0; }
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
    if (e?.type !== 'drum' || e.plate !== plate) return false;
    return Math.abs(this.drumT(drum) - (e.plateAt ?? 1)) <= (e.tolerance ?? 0.06);
  }
  /** Light a brazier, burn brambles, splash a switch, ring a bell door. Needs: the element's items (fire, bell…). */
  light(id) {
    const e = this.el(id);
    if (!e || !LATCHED.has(e.type)) return false;
    if (!this.canUse(id)) return false;
    if (this.store.get(`lit.${id}`)) return false;
    this.store.set(`lit.${id}`, true);
    return true;
  }
  isLit(id) { return !!this.store.get(`lit.${id}`); }
  /** Its items are carried, and the one it comes `after` (a sequence: crystals sung low to high) is lit. */
  canUse(id) { const e = this.el(id); return (e?.needs ?? []).every((it) => this.has(it)) && (!e?.after || this.isLit(e.after)); }
  takeGadget() {
    if (this.store.get('gadget')) return false;
    this.store.set('gadget', true);
    return true;
  }
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
      if (!reach.has(e.room)) continue;
      if (e.type === 'gadget' && !this.gadget) return id;
      if (LATCHED.has(e.type) && !this.isLit(id) && this.canUse(id)) return id;
      if (e.type === 'drum' && e.plate && !this.drumOn(id, e.plate) && this.has('backpack')) return id;
      if (e.type === 'boss' && !this.resolved) return id;
    }
    // a plate still worth standing on: one a shut door is waiting for
    const waiting = (p) => Object.entries(this.def.elements).some(([d, g]) => isGate(g) && !this.isOpen(d) && mentions(g.opens, p));
    for (const [id, e] of Object.entries(this.def.elements)) if (e.type === 'plate' && reach.has(e.room) && !this.pressed(id) && waiting(id)) return id;
    return null;
  }
}

const isGate = (e) => e?.type === 'door' || e?.type === 'bridge';
/** Does a condition name this element (a plate, a brazier…)? */
const mentions = (c, id) => !!c && (Array.isArray(c) ? c.some((x) => mentions(x, id)) : c.pressed === id || c.lit === id || c.drumOn?.includes(id) || mentions(c.all, id) || mentions(c.any, id) || mentions(c.not, id));

/**
 * Solve a temple through its state machine, as a player would: walk to every
 * room that is open, do everything that can be done there (take the gadget,
 * light what burns, roll the drums onto their plates, stand on each plate in
 * turn), until the guardian can be faced, then resolve it. `items` is what the
 * traveller carries in; `withhold` items never come (to prove a gadget is the
 * key). Returns { done, log, order (rooms in the order reached), gadgetAt
 * (index in log), stuck (rooms reached when it got stuck) }.
 */
export function solve(def, { items = ['backpack'], withhold = [], maxSteps = 400 } = {}) {
  const owned = new Set(items.filter((i) => !withhold.includes(i)));
  const has = (i) => meetsWith((x) => owned.has(x), i);   // ('magic:4': the bar the items make, src/resources.js)
  const L = new TempleLogic(def, { has });
  const log = [], order = [def.entry];
  let gadgetAt = -1;
  const note = (s) => { log.push(s); L.update(); for (const r of L.reachable()) if (!order.includes(r)) order.push(r); };
  for (let step = 0; step < maxSteps; step++) {
    const reach = L.reachable();
    let did = false;
    for (const [id, e] of Object.entries(def.elements)) {
      if (!reach.has(e.room)) continue;
      if (e.type === 'gadget' && !L.store.get('gadget')) {
        L.takeGadget();
        if (e.item && !withhold.includes(e.item)) owned.add(e.item);
        gadgetAt = log.length; note(`take ${id}${e.item ? ` (${e.item})` : ''}`); did = true; break;
      }
      if (LATCHED.has(e.type) && !L.isLit(id) && L.canUse(id)) { L.light(id); note(`${e.type} ${id}`); did = true; break; }
      if (e.type === 'drum' && e.plate && !L.drumOn(id, e.plate) && owned.has('backpack')) { L.moveDrum(id, e.plateAt ?? 1); note(`roll ${id} onto ${e.plate}`); did = true; break; }
      if (e.type === 'boss' && !L.resolved && (e.needs ?? []).every(has) && L.check(e.requires)) { L.resolve(); note(`resolve ${id}`); did = true; break; }
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
    if (!did) break;
  }
  return { done: L.resolved, log, order, gadgetAt, stuck: [...L.reachable()], logic: L };
}
