import * as THREE from 'three';
import { game as sharedGame } from '../game-state.js';
import { items as sharedItems } from '../items.js';
import { addIndoors } from '../shelter.js';
import { rumble } from '../ship/sfx.js';
import { TempleKit, templeMaterials } from './kit.js';
import { TempleLogic, flagStore } from './logic.js';
import { Guardian } from './boss.js';
import { Mark, Pit } from './pieces.js';

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
// .done (the world has changed), and the logic's own: .open.<door>, .lit.<id>, .drum.<id>.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

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
    this.logic = new TempleLogic(def.logic, { store: flagStore(game, def.id), has: (it) => items.has(it) });
    this.kit = new TempleKit(this.root, def.name, V(...def.origin), def.yaw ?? 0, this.M);
    this.pieces = []; this.byId = new Map(); this.marks = []; this.pits = []; this.portals = [];
    this.checkpoint = null;
    this.told = new Set();
    this.time = 0;
    // the rooms
    const L = def.layout(this);
    this.kit.flush();
    this.arrival = L.arrival;           // { pos, heading } (world) where you come in
    this.bounds = L.bounds;             // Box3 in the kit's local frame: inside the temple
    this.gadgetSite = L.gadget ?? null; // { at: [x, y, z] world, face }
    for (const l of L.lights ?? []) { const p = this.kit.world(l[0], l[1], l[2]); this.lights.push(new THREE.Vector4(p.x, p.y, p.z, l[3])); }
    // the outside: the building in the world and its door
    this.outside = def.exterior?.(scene, level, this) ?? null;
    if (this.outside?.door) {
      const D = this.outside.door, f = V(Math.sin(D.heading), 0, Math.cos(D.heading));
      this.doorOut = D.at.clone().addScaledVector(f, 3);
      this.portals.push({ at: D.at.clone().addScaledVector(f, -0.3), r: 1.6, to: this.arrival.pos.clone(), heading: this.arrival.heading, label: def.doorLabel ?? `door of ${def.name}`, temple: def.id });
      for (const ex of L.exits ?? []) this.portals.push({ at: ex.at, r: ex.r ?? 1.5, to: (ex.to ?? this.doorOut).clone(), heading: ex.heading ?? D.heading, label: 'way out', temple: def.id });
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
  }

  /** Add a piece (a Door, a Plate…: pieces.js) built for this temple. */
  add(Piece, o) {
    const p = new Piece(this, o);
    this.pieces.push(p);
    if (o.id) this.byId.set(o.id, p);
    if (p instanceof Mark) this.marks.push(p);
    if (p instanceof Pit) { this.pits.push(p); this.pieces.pop(); }
    return p;
  }
  piece(id) { return this.byId.get(id); }

  init(physics) {
    this.physics = physics;
    for (const p of this.pieces) p.init?.(physics);
  }

  /** The story hook: who plays, what they hear, where the words go. */
  connect({ player, sound = null, toast = () => {}, quests = null, fade = null }) {
    this.player = player; this.sound = sound; this.toast = toast; this.quests = quests;
    this.fadeFn = fade;
    if (typeof window !== 'undefined') (window.temples ??= {})[this.id] = this;
    // no whistling the mount into the temple: it would come to the same x, z on the ground far below
    if (player?.opts) { const can = player.opts.canSummon; player.opts.canSummon = () => !this.inside(player.pos) && (can ? can() : true); }
    // the chest in the temple: opening it is taking the gadget
    this.offs.push(this.game.on('box:opened', ({ id } = {}) => { if (id === this.def.gadgetBox) { this.logic.takeGadget(); this.game.emit('temple:gadget', { id: this.id }); } }));
    const cp = this.game.flag(`temple.${this.id}.checkpoint`);
    if (cp) this.checkpoint = this.marks.find((m) => m.room === cp) ?? null;
  }

  /** A short line on the screen (once per key, when a key is given). */
  notice(text, key = null) {
    if (!text) return;
    if (key) { if (this.told.has(key)) return; this.told.add(key); }
    this.toast?.(text);
  }
  rumble(dur = 1.5, vol = 0.4) { if (this.sound) rumble(this.sound, dur, vol); }
  fade(k, secs) { this.fadeFn?.(k, secs); }

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
    if (hurt) P.hurt?.(Math.min(hurt, Math.max(0, (P.health ?? 1) - 0.1)), 'fall');
  }

  solids() {
    const out = [];
    for (const p of this.pieces) if (p.solid) out.push(p);
    if (this.guardian) out.push(this.guardian);   // (resolved, it lies where it settled: still in the way)
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
    this.applyDoors();
    this.game.set(`temple.${this.id}.done`, true);
    this.game.emit('temple:resolved', { id: this.id });
    this.def.onResolved?.(this);
  }
  applyDoors() {
    for (const { id, open } of this.logic.update()) this.byId.get(id)?.setOpen?.(open, false);
  }

  update(dt, t) {
    this.time += dt;
    const P = this.player;
    const inside = P && this.inside(P.pos);
    if (inside && !this.game.flag(`temple.${this.id}.entered`)) { this.game.set(`temple.${this.id}.entered`, true); this.notice(this.def.enterLine); }
    if (inside || this.time < 0.5) for (const p of this.pieces) p.update(dt, t);
    else for (const p of this.pieces) if (p.solid || p.flames) p.update?.(dt, t);
    this.applyDoors();
    // the guardian
    if (this.guardian) {
      this.guardian.update(dt, t);
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
    if (P && !P.dead && !inside && this.below(P.pos)) { this.toCheckpoint({ hurt: 0.08 }); this.notice(this.def.pitLine ?? 'You climb back up to the last mark.', 'pit'); }
    // fell into a pit
    if (P && !P.dead && inside) for (const pit of this.pits) if (pit.contains(P.pos)) { this.toCheckpoint({ hurt: 0.08 }); this.notice(this.def.pitLine ?? 'You climb back up to the last mark.', 'pit'); break; }
    this.change?.update?.(dt, t);
  }

  dispose() {
    for (const f of this.offs) f?.();
    for (const p of this.pieces) p.dispose?.();
    this.guardian?.dispose();
    this.root.removeFromParent();
  }
}
