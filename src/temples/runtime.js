import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items as sharedItems } from '../items.js';
import { Resources, sparing, heartsOf, DAMAGE } from '../resources.js';
import { addIndoors } from '../shelter.js';
import { rumble } from '../ship/sfx.js';
import { TempleKit, templeMaterials } from './kit.js';
import { houseSkin } from './skins/index.js';
import { TempleLogic, flagStore } from './logic.js';
import { Guardian, guardianBar } from './boss.js';
import { Mark, Pit, Platform, Updraft, MapChest } from './pieces.js';
import { housePlan, roomAt } from './house-plan.js';
import { Veils } from '../veil.js';
import { FINALE } from './finale.js';
import { pitVoid, PIT_VOID } from '../pit-void.js';

// One temple, alive: its rooms (built by the world's layout with the kit and
// the pieces), its logic (saved in the save slot's flags), its marks
// (checkpoints) and pits, its way in and out, its guardian, and the change
// it makes to the world once the guardian is resolved.
//
//   const rt = new TempleRuntime({ scene, level, def });   (index.js attachTemple, at level build)
//   rt.init(physics)          doors, brambles and bridges become solid
//   rt.connect(ctx)           the story hook (index.js setupTempleStory): player, sound, toast, quests
//   rt.update(dt, t)          per frame (from the story runtime)
//   rt.solids()               moving floors, balls and the guardian, for the player (level.dynamic)
//   rt.portals                the doorway in from the world and the ways back out
//   rt.gadgetSite             where the chest stands (src/boxes/placements.js reads it)
//
// Flags (src/game-state.js, per save slot): temple.<id>.entered (you went in), .checkpoint (the room
// of the last mark), .gadget (the chest here was opened), .boss = 'done' (the guardian resolved),
// .done (the world has changed), .been.<room> (stood in: the house's map, src/house-map.js), and the logic's own:
// .open.<door>, .lit.<id>, .drum.<id>, .found.<id> (a key, a coffer, the map's chest).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// (the pieces the house's map reads by kind, by their names: a built game's classes have other names)
const CLASS = new Map([[Mark, 'Mark'], [Platform, 'Platform'], [Updraft, 'Updraft']]);
/** The foes of a room still standing (src/foes.js placeMachinesIn: rt.machines, each with its room). */
export const arenaFoes = (rt, room) => (rt.machines ?? []).filter((f) => f.room === room && f.alive && f.dead === undefined);

/** What a condition (a door's `opens`, a switch's `when`) names: the elements, and the items ({ item }). */
function named(c, els = new Set(), its = new Set()) {
  if (c == null || typeof c !== 'object') return { els, its };
  if (Array.isArray(c)) { for (const x of c) named(x, els, its); return { els, its }; }
  for (const [k, v] of Object.entries(c)) {
    if (k === 'all' || k === 'any' || k === 'not') named(v, els, its);
    else if (k === 'item') its.add(v);
    else if (k === 'gadget' || k === 'resolved') continue;
    else for (const x of [v].flat()) if (typeof x === 'string') els.add(x);
  }
  return { els, its };
}
/** Does element `id` (a door, a switch, a drum…) want, or wait on something that wants, one of the items `lack`? */
export function wants(def, id, lack, seen = new Set()) {
  if (seen.has(id)) return false;
  seen.add(id);
  const e = def.elements[id];
  if (!e) return false;
  if ((e.needs ?? []).some((it) => lack(it))) return true;
  for (const c of [e.opens, e.when, e.after ? { lit: e.after } : null]) {
    const { els, its } = named(c);
    if ([...its].some((it) => lack(it)) || [...els].some((x) => wants(def, x, lack, seen))) return true;
  }
  return false;
}

/**
 * The rooms walked to from the entrance (issue #375's gadget gates), both ways: through a link whose `needs` `pass` lets
 * by, and whose door is open now (`isOpen`) or opens without anything the save lacks (a door held by a bell the hook
 * rings is a wall to a save without the hook). Everything else is taken as doable: keys, balls, plates, fights.
 */
export function roomsPast(def, pass, isOpen = () => false) {
  const lack = (it) => !pass(it);
  const seen = new Set([def.entry]), todo = [def.entry];
  while (todo.length) {
    const r = todo.pop();
    for (const l of def.links) {
      // (a one-way link, a drop, is walked only the way it goes: issue #408, the Founders' Belfry's drop off its key's ledge)
      const other = l.a === r ? l.b : l.b === r && !l.oneWay ? l.a : null;
      if (!other || seen.has(other) || !(l.needs ?? []).every((it) => pass(it))) continue;
      if (l.door && !isOpen(l.door) && wants(def, l.door, lack)) continue;
      seen.add(other); todo.push(other);
    }
  }
  return seen;
}

/** The house's gadget gates (issue #375): each item it gives (its chest's, a find's) that a link or an element wants. */
export function gateItems(def) {
  const own = new Map();   // item -> how a save shows it passed the place it is earned: { chest } or { find: element id, box }
  if (def.gadget) own.set(def.gadget, { chest: true });
  for (const [id, e] of Object.entries(def.logic.elements)) if (e.type === 'find' && e.item) own.set(e.item, { find: id, box: e.box });
  const wanted = new Set([...def.logic.links.flatMap((l) => l.needs ?? []), ...Object.values(def.logic.elements).flatMap((e) => [...(e.needs ?? []), ...named(e.opens).its])]);
  return [...own].filter(([it]) => wanted.has(it));
}

export class TempleRuntime {
  constructor({ scene, level, def, game = sharedGame, items = sharedItems }) {
    this.def = def; this.level = level; this.scene = scene; this.game = game; this.items = items;
    this.id = def.id;
    this.P = def.palette;
    this.M = templeMaterials(def.palette);
    this.root = new THREE.Group();
    this.root.name = `Temple: ${def.name}`;
    scene.add(this.root);
    this.lights = level.lights ?? (level.lights = []);
    const res = new Resources(game, items);
    this.logic = new TempleLogic(def.logic, { store: flagStore(game, def.id), has: (it) => res.meets(it) });   // ('magic:4': a bar of four units, src/resources.js)
    this.kit = new TempleKit(this.root, def.name, V(...def.origin), def.yaw ?? 0, this.M);
    this.kit.noClimb = true;   // (no wall inside is climbed but the climbs its layout marks: K.climbable, issue #115)
    this.pieces = []; this.byId = new Map(); this.marks = []; this.pits = []; this.portals = [];
    this.placed = [];   // ({ cls, o }: every piece as its layout placed it, the house's map reads them: house-plan.js)
    this.checkpoint = null;
    this.told = new Set();
    this.time = 0;
    // the rooms (in the house's skin, if it wears one: its surfaces, its dressing, src/temples/skins/; issue #342)
    const skin = houseSkin(this);
    const L = def.layout(this);
    // the little chest with the house's map in it (issue #405): where its element says (logic type 'map', `at` local)
    for (const [id, e] of Object.entries(def.logic.elements)) if (e.type === 'map' && e.at) this.add(MapChest, { id, at: e.at, yaw: e.yaw ?? 0 });
    skin?.dress?.();
    this.kit.flush();
    skin?.done?.();
    this.arrival = L.arrival;           // { pos, heading } (world) where you come in
    this.bounds = L.bounds;             // Box3 in the kit's local frame: inside the temple
    this.gadgetSite = L.gadget ?? null; // { at: [x, y, z] world, face }
    this.findSites = L.finds ?? {};     // { [find element]: { at, face } }: its second chests (src/boxes/placements.js)
    // (its own lights, kept apart too: the house's air breathes or flickers them while you are inside, src/temples/air.js)
    this.ownLights = [];
    for (const l of L.lights ?? []) { const p = this.kit.world(l[0], l[1], l[2]), v = new THREE.Vector4(p.x, p.y, p.z, l[3]); this.lights.push(v); this.ownLights.push(v); }
    // the outside: the building in the world and its door
    this.outside = def.exterior?.(scene, level, this) ?? null;
    if (this.outside?.door) {
      const D = this.outside.door, f = V(Math.sin(D.heading), 0, Math.cos(D.heading));
      this.doorOut = D.at.clone().addScaledVector(f, 3);
      this.portals.push({ at: D.at.clone().addScaledVector(f, -0.3), r: 1.6, to: this.arrival.pos.clone(), heading: this.arrival.heading, label: def.doorLabel ?? `door of ${def.name}`, temple: def.id, door: { at: D.at.clone(), yaw: D.heading, side: 1, ...(D.w ? { w: D.w } : {}), ...(D.h ? { h: D.h } : {}), ...(D.top ? { top: D.top } : {}) } });   // (top: its shape across, src/temples/portal.js)
      // (toUp: the ways out land in the world, not in a room off the map: main.js only counts portals without it)
      for (const ex of L.exits ?? []) this.portals.push({ at: ex.at, r: ex.r ?? 1.5, to: (ex.to ?? this.doorOut).clone(), heading: ex.heading ?? D.heading, label: 'way out', temple: def.id, door: ex.door ?? { yaw: this.kit.heading(0) }, toUp: V(0, 1, 0) });
    }
    // the guardian
    if (L.guardian) {
      this.guardian = new Guardian(this, L.guardian);
      this.root.add(L.guardian.model.group);
    }
    // the change in the world once it is resolved
    this.change = def.change?.(scene, level, this) ?? null;
    this.change?.set(!!game.flag(`temple.${def.id}.done`), { instant: true });
    this.offs = [game.on(`flag:temple.${def.id}.done`, (v) => this.change?.set(!!v, { instant: false }))];
    // weather stays outside
    this.offs.push(addIndoors((p) => this.inside(p)) ?? (() => {}));
    this.logic.update();
    for (const p of this.pieces) if (p.id && p.setOpen) p.setOpen(this.logic.isOpen(p.id), true);
    // every pit fills with the dark from below, so a deadly drop reads as one from its lip (issue #312: src/pit-void.js)
    const deep = '#' + new THREE.Color(PIT_VOID.color).lerp(new THREE.Color(this.P.dark ?? PIT_VOID.color), 0.25).getHexString();
    for (const pit of this.pits) if (!pit.own) pit.look = pitVoid(this.veils, { min: pit.box.min, max: pit.box.max, frame: this.kit.frame, color: deep, ring: this.P.glow ?? PIT_VOID.glow, of: this.root, name: `${def.name}: the ${pit.room} pit's dark` });
  }

  /** The level's washes over the finished picture (src/veil.js: the shafts of light, issue #116), made if it has none. */
  get veils() { return (this.level.veils ??= new Veils()); }

  /** Add a piece (a Door, a Plate…: pieces.js) built for this temple. */
  add(Piece, o) {
    this.placed.push({ cls: CLASS.get(Piece) ?? Piece.name, o });
    const p = new Piece(this, o);
    this.pieces.push(p);
    // (a second piece of the same id, a door's twin: the Engine-House's two shutters, one element; it opens with the first)
    if (o.id && this.byId.has(o.id)) (this.twins ??= new Map()).set(o.id, [...(this.twins.get(o.id) ?? []), p]);
    else if (o.id) this.byId.set(o.id, p);
    if (p instanceof Mark) this.marks.push(p);
    if (p instanceof Pit) { this.pits.push(p); this.pieces.pop(); }
    return p;
  }
  piece(id) { return this.byId.get(id); }

  init(physics) {
    this.physics = physics;
    for (const p of this.pieces) p.init?.(physics);
    this.change?.init?.(physics);
  }

  /** The story hook: who plays, what they hear, where the words go. */
  connect({ player, sound = null, toast = () => {}, quests = null, fade = null, isNight = null }) {
    this.player = player; this.sound = sound; this.toast = toast; this.quests = quests;
    this.isNight = isNight ?? (() => false);   // (a world change that keeps the night: the Signal Market's tower)
    this.fadeFn = fade;
    if (typeof window !== 'undefined') (window.temples ??= {})[this.id] = this;
    // no whistling the mount into the temple: it would come to the same x, z on the ground far below
    if (player?.opts) { const can = player.opts.canSummon; player.opts.canSummon = () => !this.inside(player.pos) && (can ? can() : true); }
    // the chest in the temple: opening it is taking the gadget
    this.offs.push(this.game.on('box:opened', ({ id } = {}) => {
      if (id === this.def.gadgetBox) { this.logic.takeGadget(); this.game.emit('temple:gadget', { id: this.id }); }
      // a second chest (a `find`: the Givers' guard)
      for (const [el, e] of Object.entries(this.def.logic.elements)) if (e.type === 'find' && e.box === id && this.logic.find(el)) this.game.emit('temple:find', { id: this.id, el });
    }));
    const cp = this.game.flag(`temple.${this.id}.checkpoint`);
    if (cp) this.checkpoint = this.marks.find((m) => m.room === cp) ?? null;
    this.def.onConnect?.(this);
  }

  /** A short line on the screen (once per key, when a key is given). */
  notice(text, key = null) {
    if (!text) return;
    if (key) { if (this.told.has(key)) return; this.told.add(key); }
    this.toast?.(text);
  }
  rumble(dur = 1.5, vol = 0.4) { if (this.sound) rumble(this.sound, dur, vol); }
  fade(k, secs) { this.fadeFn?.(k, secs); }

  /**
   * The key counter's numbers (issue #274, src/hud.js keysHud): the small keys in hand (found less those in a lock), and
   * the great key in hand or not. A key still rising out of its chest (pieces.js Key `flying`) counts once it is in.
   */
  keyCount() {
    let small = this.logic.keys('small'), big = this.logic.keys('big');
    for (const p of this.pieces) if (p.flying) { if (p.o?.big) big--; else small--; }
    return { small: Math.max(0, small), big: big > 0 };
  }
  inside(p) { return !!this.bounds && this.bounds.containsPoint(this.kit.local(p)); }
  /** Under the temple's floor, in its shadow over the world (fallen out of it). */
  below(p) {
    if (!this.bounds) return false;
    const l = this.kit.local(p), B = this.bounds;
    return l.x > B.min.x - 30 && l.x < B.max.x + 30 && l.z > B.min.z - 30 && l.z < B.max.z + 30 && l.y < B.min.y && l.y > B.min.y - 400;
  }

  setCheckpoint(mark) {
    this.checkpoint = mark;
    this.game.set(`temple.${this.id}.checkpoint`, mark.room);
    this.sound?.chime?.();
  }
  /** Back at the last mark (a fall into a pit; waking after a knockout). */
  toCheckpoint({ hurt = 0 } = {}) {
    const P = this.player, m = this.checkpoint ?? this.marks[0];
    if (!P || !m) return;
    this.fade(1, 0.05);
    setTimeout(() => this.fade(0, 0.8), 160);
    P.teleport?.(m.spot.clone(), V(0, 1, 0), V(0, 0, 1));
    P.heading = m.heading;
    if (hurt) P.hurt?.(sparing(heartsOf(P), hurt), 'fall');   // (hearts; never the last quarter)
  }

  /** The house's plan for its map (src/temples/house-plan.js: read once from what its layout built, in local metres). */
  housePlan() {
    const arena = this.guardian?.arena?.center ? this.kit.local(this.guardian.arena.center.clone()).toArray() : null;
    return (this.mapPlan ??= housePlan({ logic: this.def.logic, chart: this.kit.chart, pieces: this.placed, arena }));
  }
  /** The rooms stood in, for the house's map (saved: temple.<id>.been.<room>), looked at a few times a second. */
  trackRooms(dt, pos) {
    this.roomClock = (this.roomClock ?? 0) - dt;
    if (this.roomClock > 0) return;
    this.roomClock = 0.25;
    const l = this.kit.local(pos), room = roomAt(this.housePlan(), [l.x, l.y, l.z]);
    this.room = room;
    if (room && !this.game.flag(`temple.${this.id}.been.${room}`)) this.game.set(`temple.${this.id}.been.${room}`, true);
  }

  /** The room the traveller stands in, as near as the house knows it: the nearest mark or piece of a room's. */
  roomNear(p) {
    let best = null, bd = Infinity;
    const els = this.def.logic.elements;
    const consider = (room, at) => { if (!room || !at?.isVector3) return; const d = at.distanceToSquared(p); if (d < bd) { bd = d; best = room; } };
    for (const m of this.marks) consider(m.room, m.spot);
    for (const q of this.pieces) if (q.id && els[q.id]?.room) consider(els[q.id].room, q.pos ?? q.center ?? q.at);
    return best;
  }
  /** (issue #375) Past a gadget gate the save cannot cross back: the gadget if it has earned it, else a mark it can reach. */
  unstrand() {
    const P = this.player, def = this.def.logic;
    const gates = gateItems(this.def).filter(([it]) => !this.items.has(it));
    if (!P || !gates.length) return null;
    const room = this.roomNear(P.pos);
    const ok = (set) => (it) => !set.some(([g]) => g === it) || this.items.has(it);
    const open = (d) => this.logic.computeOpen(d);   // (as the save stands now, not as last drawn)
    if (!room || roomsPast(def, ok(gates), open).has(room) || !roomsPast(def, () => true).has(room)) return null;
    // passed the place it is earned: it is the save's (the chest's gadget once the chest is taken, a find's once found)
    let granted = null;
    for (const [it, how] of gates) {
      const earned = how.chest ? (this.logic.gadget || !!this.game.flag(`box.${this.def.gadgetBox}`)) : (this.logic.isFound(how.find) || !!this.game.flag(`box.${how.box}`));
      if (earned) { this.items.grant(it); granted = it; }
    }
    const left = gates.filter(([it]) => !this.items.has(it));
    if (!left.length || roomsPast(def, ok(left), open).has(room)) return { granted };
    // else: the last mark if the way out is open from it, else the entrance's
    const reach = roomsPast(def, ok(left), open);
    const m = (this.checkpoint && reach.has(this.checkpoint.room) ? this.checkpoint : null) ?? this.marks.find((k) => k.room === def.entry) ?? this.marks.find((k) => reach.has(k.room));
    if (m) { this.setCheckpoint(m); P.teleport?.(m.spot.clone(), V(0, 1, 0), V(0, 0, 1)); P.heading = m.heading; }
    else if (this.arrival) { P.teleport?.(this.arrival.pos.clone(), V(0, 1, 0), V(0, 0, 1)); P.heading = this.arrival.heading; }
    return { granted, moved: m?.room ?? 'arrival' };
  }

  solids() {
    const out = [];
    for (const p of this.pieces) if (p.solid) out.push(p);
    if (this.guardian) out.push(this.guardian);   // (resolved, it lies where it settled: still in the way)
    if (this.change?.solids) out.push(...this.change.solids());   // (a world change may bring a moving floor of its own)
    return out;
  }

  onBossWake() {
    if (this.def.arenaDoor) { this.logic.force(this.def.arenaDoor, false); this.applyDoors(); }
    this.def.onWake?.(this);
  }
  /** Something latched: a brazier lit, thorns burnt, a switch woken, a bell door rung. */
  onLit(id) { this.def.onLit?.(this, id); this.game.emit('temple:lit', { id: this.id, el: id }); }
  onBossResolved() {
    if (this.def.arenaDoor) this.logic.force(this.def.arenaDoor, null);
    this.logic.resolve();
    // its ending, filmed (src/temples/finale.js, issue #366: the story's hook, index.js), before the way out opens: it
    // holds that door for its last panel
    try { this.onFinale?.(this); } catch (e) { console.warn(`temple ${this.id}: its ending could not play`, e); }
    this.applyDoors();
    this.game.set(`temple.${this.id}.done`, true);
    this.game.emit('temple:resolved', { id: this.id, pos: this.guardian?.model?.pos?.clone?.() ?? null });   // (pos: where it settled: its purse, src/chimes.js)
    this.def.onResolved?.(this);
  }
  applyDoors() {
    for (const { id, open } of this.logic.update()) for (const p of [this.byId.get(id), ...(this.twins?.get(id) ?? [])]) p?.setOpen?.(open, false);
  }

  update(dt, t) {
    this.time += dt;
    for (const pit of this.pits) pit.look?.update(this.time);
    const P = this.player;
    const inside = P && this.inside(P.pos);
    if (P && this.def.dark) P.inDark = !!inside;   // (a dark temple: the lantern charm glows in it, day or night)
    if (inside && !this.game.flag(`temple.${this.id}.entered`)) { this.game.set(`temple.${this.id}.entered`, true); this.notice(this.def.enterLine); }
    if (inside || this.time < 0.5) for (const p of this.pieces) p.update(dt, t);
    else for (const p of this.pieces) if (p.solid || p.flames) p.update?.(dt, t);
    // a save from before its house was remade (issue #336), standing in the old rooms (src/temples/migrate.js sets
    // temple.<id>.relaid): its first frame here, the traveller is taken to the last mark, in the new rooms
    const relaid = `temple.${this.id}.relaid`;
    if (P?.pos && this.game.flag(relaid)) { this.game.set(relaid, null); if (inside || this.below(P.pos)) this.toCheckpoint(); }
    // a save loaded inside, past one of the house's gadget gates without its gadget (issue #375: the gadgets moved into the
    // temples, and a house's rooms changed under old saves): never stranded. Past the chest (or the find), the gadget is
    // the save's; else back to the last mark it can reach, or the entrance's
    // (main.js sets `loaded` when it puts the traveller where a save left him: only then, once)
    if (P?.pos && this.loaded) { this.loaded = false; if (inside) this.unstrand(); }
    if (inside) this.trackRooms(dt, P.pos);
    this.def.onUpdate?.(this, dt, t);
    this.updateArenas(dt);
    this.applyDoors();
    // the guardian
    if (this.guardian) {
      this.guardian.update(dt, t);
      this.meterHud();
      // knocked out in the arena: you wake at the mark outside it, and it is back where this phase began
      if (P?.dead && this.guardian.awake) { this.wasDown = true; }
      if (this.wasDown && P && !P.dead) {
        this.wasDown = false;
        this.guardian.reset();
        if (this.def.arenaDoor) { this.logic.force(this.def.arenaDoor, null); this.applyDoors(); }
      }
    }
    // knocked out anywhere inside: wake at the last mark (restart() goes back to lastSafe)
    if (P?.dead && inside) { const m = this.checkpoint ?? this.marks[0]; if (m) P.lastSafe.copy(m.spot); }
    // fell out of the temple altogether (it hangs far over the world): back to the last mark
    if (P && !P.dead && !inside && this.below(P.pos)) { this.toCheckpoint({ hurt: DAMAGE.graze }); this.notice(this.def.pitLine ?? 'You climb back up to the last mark.', 'pit'); }
    // fell into a pit
    if (P && !P.dead && inside) for (const pit of this.pits) if (pit.contains(P.pos)) { this.toCheckpoint({ hurt: DAMAGE.graze }); this.notice(this.def.pitLine ?? 'You climb back up to the last mark.', 'pit'); break; }
    this.change?.update?.(dt, t);
    this.glowUpdate(dt);
  }

  /** The house's glyphs brighten while its ending says so (rt.litWant 0..1: src/temples/finale.js), and ease back. */
  glowUpdate(dt) {
    const U = this.M.glyph?.uniforms?.uGlow;
    if (!U) return;
    const want = this.litWant ?? 0;
    if (!want && !this.litK) return;
    this.glyphGlow ??= U.value;
    const k0 = this.litK ?? 0, k = want > k0 ? Math.min(want, k0 + dt / 1.2) : Math.max(want, k0 - dt / 2.5);
    this.litK = k;
    U.value = this.glyphGlow + FINALE.glow * k * k * (3 - 2 * k);
  }

  /**
   * The arena rooms (def.arenas: [{ el, room, zone: { min, max } local, doors: [ids], extra, shut, won }]): step into
   * one whose element (logic type 'arena') is not lit yet and its doors hold shut behind you while its foes stand
   * (src/foes.js places them round its mark: rt.machines, by room); once none stands (or none came: the Enemies
   * setting off) the element is lit for good and the doors let go. Knocked out in it, you wake at its mark and the
   * fight goes on where it was (the broken stay broken).
   */
  updateArenas(dt) {
    const As = this.def.arenas;
    if (!As?.length) return;
    const P = this.player;
    for (const A of As) {
      const st = ((this.arenaState ??= {})[A.el] ??= { held: false, clear: 0 });
      const won = this.logic.isLit(A.el);
      const zone = (A.box ??= new THREE.Box3(V(...A.zone.min), V(...A.zone.max)));
      const inside = !won && !!P?.pos && !P.dead && zone.containsPoint(this.kit.local(P.pos));
      if (inside) {
        const standing = arenaFoes(this, A.room).length;
        st.clear = standing ? 0 : st.clear + dt;
        if (st.clear > (A.settle ?? 0.8) && this.logic.light(A.el)) {
          this.sound?.chime?.(); this.onLit(A.el);
          // (fought: held shut a moment ago; the doors let go the moment the last one fell, before it was won)
          if (st.held || st.fought) this.notice(A.won ?? 'The last of them falls still, and the doors sink open.', `arena.won.${A.el}`);
        }
      }
      const held = inside && !this.logic.isLit(A.el) && arenaFoes(this, A.room).length > 0;
      if (held !== st.held) {
        st.held = held;
        if (held) st.fought = true;
        for (const d of A.doors ?? []) this.logic.force(d, held ? false : null);
        this.applyDoors();
        if (held) this.notice(A.shut ?? 'The doors grind shut behind you. Something in the walls is waking.', `arena.shut.${A.el}`);
      }
    }
  }

  /**
   * The guardian's bar on the screen while it is awake: a printed bar at the bottom, its name and what
   * the bar is (a machine's health, a living guardian's unrest), in the health bar's style: full at
   * the start, going down as the fight goes your way (boss.js guardianBar).
   */
  meterHud() {
    const G = this.guardian;
    if (!G || typeof document === 'undefined' || !document.body?.appendChild) return;
    let el = this.meterEl;
    if (!el) {
      el = this.meterEl = document.createElement('div');
      el.className = 'temple-meter';
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(62px + var(--safe-bottom, 0px));transform:translateX(-50%);z-index:30;pointer-events:none;'
        + 'font:700 11px/1.2 var(--face);letter-spacing:.14em;color:#2b211f;text-transform:uppercase;text-align:center;opacity:0;transition:opacity .6s;';
      const bar0 = guardianBar(G.def, G.meter);
      const label = document.createElement('div');
      label.style.cssText = 'margin-bottom:4px;text-shadow:0 0 3px #f7ecd2';
      label.textContent = bar0.label;
      const bar = document.createElement('div');
      bar.style.cssText = 'width:260px;height:11px;border:2px solid #2b211f;background:#f7ecd2;box-shadow:2px 2px 0 #2b211f;border-radius:6px;overflow:hidden';
      const fill = document.createElement('i');
      fill.style.cssText = `display:block;height:100%;width:${(bar0.fill * 100).toFixed(1)}%;background:${bar0.color};border-right:2px solid #2b211f;transition:width .35s`;
      bar.appendChild(fill);
      el.appendChild(label); el.appendChild(bar);
      document.body.appendChild(el);
      this.meterFill = fill;
    }
    const on = G.awake && !this.player?.dead && !!this.player && this.inside(this.player.pos) && !document.body.classList?.contains?.('talking');
    el.style.opacity = on ? '1' : '0';
    if (on && this.meterFill?.style) this.meterFill.style.width = `${(guardianBar(G.def, G.meter).fill * 100).toFixed(1)}%`;
  }

  dispose() {
    this.meterEl?.remove?.();
    for (const f of this.offs) f?.();
    for (const p of this.pieces) p.dispose?.();
    for (const pit of this.pits) pit.look?.dispose();
    this.guardian?.dispose();
    this.guardian?.model.dispose?.();
    this.change?.dispose?.();
    this.root.removeFromParent();
  }
}
