import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { LightShaft } from '../veil.js';
import { registerTarget } from '../targets.js';
import { registerHazard, HAZARD_DPS } from '../hazards.js';
import { screened } from '../wind-screens.js';
import { registerWorking } from '../workings.js';
import { Flames } from '../story/flames.js';
import { glyphGeometry } from '../story/sign-text.js';
import { T, box, lathe, prep, annulus, sector } from './kit.js';
import { sparing, heartsOf, DAMAGE } from '../resources.js';
import { rideColumn } from '../updraft.js';
import { stopOf } from './logic.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { buildBox } from '../boxes/model.js';
import { ChestLight, chestLamp, MOUTHS } from '../boxes/light.js';
import { Prop, stepProp } from '../gadgets/world.js';
import { registerCarryable, registerSnap, IN_HANDS } from '../carry.js';
import { registerLight, registerDrinker, CARRY } from '../carried-light.js';
import { registerIron } from '../gadgets/metal.js';
import { lensSees } from '../gadgets/hidden.js';
import { stripTone } from '../story/tone.js';
import { markShape } from '../makers-mark/shape.js';
import { beamStop } from '../beam-stop.js';

// The temple's moving and answering parts. Each piece is built by the
// runtime (runtime.js) from a temple's layout, in the temple's local frame,
// and stands for one element of its logic (logic.js) when it has an id:
//
//   Door     a slab that sinks into the floor when its condition holds (lamps on the lintel show
//            how much of it is met); solid while shut. bell: true makes it a bell-tuned door (the
//            bell-note whistle, sounded near it, opens it).
//   Plate    a disc in the floor that a weight holds down (you, or a stone ball on it)
//   Ball     a stone ball in a groove (a "drum"): the fluid push rolls it along; at rest on its
//            plate it holds the plate down, and where it stopped is saved (a tar ball burns a while: `tar`;
//            `shove`: walked into, it rolls at your pace; `blade`: a cut sends it rolling far)
//   Brazier  a cold bowl: an ember glob lights it for good (it answers 'fire' only); hooded, only a burning ball
//   Flame    the Givers' pilot flame in the floor: a tar ball rolled through it catches
//   Bramble  dry thorns across a doorway: an ember glob burns them away for good (cut: the sword cuts them too)
//   Switch   a carved eye on a wall: a splash of fluid wakes it for good (blade: struck with the sword, only that)
//   Bank     eyes that wake only together, inside a breath: more than a tank of shots, so the house's gadget helps
//            (a bomb's blast among them, the boomerang's locks: issue #377)
//   LightEar a lamp that wakes when you stand by it with the lantern charm
//   Jaw      a gate of snapping jaws: a stilling glob stills them, and they rest open for good (in turn, `after`,
//            or a while only: their element's `hold`, the frost thaws and they snap shut again)
//   Swing    a crystal pendulum over a bridge: it knocks you off; a stilling glob stops it a while
//   Updraft  a column of rising wind: it lifts the fluid wings, round and up, and lets you go at its top
//   Gust     gusts down a hall that shove you back unless you wait them out behind a screen
//   Sentry   the Givers' watcher: a bronze eye that fires a telegraphed bolt; taken on the guard it flies back and breaks it
//   Vane     a vane of the makers' bellows: it drives its machine only while it turns (a splash, or the bellows' wash)
//   Iris     an iris in a ceiling: blades round a hole that slide back into the ceiling when it opens
//   Hammer   a piston-hammer of the engine slamming down on a walkway; a ball jammed in its crank stops it
//   Seed     a husk in a stone ring that only a bloom glob wakes: it sprouts (a vine, a planter's flowers)
//   Bud      a flower-door: a great bud over a doorway that a bloom glob opens, petals folded back
//   Glass    a greenhouse pane too smooth to climb, until a vine has grown up it
//   Sunbeam  a louvre in the roof and the sunbeam through it, falling on whichever spot its condition picks
//   EchoStone a singing stone: splash it and it sings its note (the echo shell catches it)
//   EchoEar  a horn that listens for its note played back close by (the echo shell), or sung (hears: 'note')
//   Dish     a pair of receiving dishes: a note sung into the near one's mouth comes out of the far one's
//   HookBell a brass pull-ring under a founders' bell: the grappling hook's bite rings the bell (issue #377)
//   Platform a disc that rides between points (you ride along on it)
//   Bridge   stones that rise out of a chasm when their condition holds
//   Key      a key of the makers' brass over a plinth, caged until its element's `when` holds: walk up and it is yours
//            (a small key turns one lock; the great key, `big`, the guardian's door). A Door with `lock` takes them
//   MapChest a little makers' chest like a key's, the house's map in it (issue #405): opened, the Start menu's House map
//            shows every room (src/house-map.js); its element { type: 'map', room }, nothing waits on it
//   Coffer   a little brass-bound coffer in an optional room: open it (interact) for a purse of chimes
//   Mark     a glyph stone: walk past it and it is where you come back to (a checkpoint)
//   Pit      a volume below a chasm: fall in and you are back at the room's mark
//   Weight   a block of the house's stone small enough to carry (src/carry.js): set on a plate, it holds it down
//
// Any of Door, Switch and Bridge can be `hidden`: only the seeing lens shows it (src/gadgets/lens.js, issue #377; the glyph
// lens, carried, until then): a hidden door is plain wall until the lens has looked at it, a hidden eye and a hidden bridge
// are not there at all (revealed: once seen, for good).
// (`hidden: 'lantern'`: only the lantern charm's light shows it.)
//
// A piece: { id?, update(dt, t), init(physics)?, setOpen(open, instant)?, solid?, dispose() }.
//
// Swing, Updraft and Gust are also workings (src/workings.js): they register their volume as they are built and
// let go in dispose(), so a foe knocked into one, or flying through one, feels it as you do (src/foes.js
// Foe.feelWorld: docs/systems/foes.md, "Foes in the world's workings").

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
// (the moving parts are dynamic too: never tiled, merged or culled as static props, src/perf.js)
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); return o; };
const ease = (k) => k * k * (3 - 2 * k);
/** A piece's `unmet` words: a string, or a function that says which wait it is now (issue #414). */
const unmetOf = (o) => (typeof o.unmet === 'function' ? o.unmet() : o.unmet);
// (a shut door, a bramble, a gate: never taken hold of to climb, as the house's walls are not: issue #115)
const NO_CLIMB = { noClimb: true };
const _dl = new THREE.Vector3(), _dn = new THREE.Vector3(), _mk = new THREE.Vector3(), _mk2 = new THREE.Vector3();
// (a hidden piece named by an item, hidden: 'lantern', shows while that is carried; `hidden: true` is the seeing lens's)
/** (issue #377) The seeing lens raised now (src/gadgets/hidden.js LENS_VIEW), and `at` in its view (any at: null). */
export const lensUp = (rt, at = null) => rt.logic.has('monocle') && lensSees(at ?? rt.player?.pos ?? null, at ? {} : { range: Infinity, cone: Math.PI });
/**
 * A hidden piece (hidden: true) the seeing lens reveals: once seen through it, in its view, it is there for good (saved:
 * the temple's flag seen.<id>; issue #377: the Footprint's glyph lens showed them while carried, before).
 */
export function revealed(rt, id, at) {
  const L = rt.logic;
  if (L.store.get(`seen.${id}`)) return true;
  if (!lensUp(rt, at)) return false;
  L.store.set(`seen.${id}`, true);
  rt.sound?.chime?.();
  rt.notice?.('Through the lens it is there, and it stays.', 'lens.seen');
  return true;
}
/** Is a piece with `hidden` shown now (for the eye and the hand)? */
const shown = (rt, o, at) => !o.hidden || (o.hidden === true ? revealed(rt, o.id, at) : rt.logic.has(o.hidden));
let uid = 0;
/** A material of its own (uniforms it can change without touching other pieces). */
const own = (o) => makeMaterial({ ...o, key: `temple.${uid++}` });

function mesh(geos, mat) {
  const g = mergeGeometries([geos].flat().map(prep));
  const m = new THREE.Mesh(g, mat);
  return m;
}

// ---------------------------------------------------------------------------------------- doors
export class Door {
  /**
   * @param rt   the runtime (kit, root, logic, M)
   * @param o    { id, at: [x, y, z] the doorway's foot, yaw (0: the slab faces ±z), w, h, t, lamps: [condition], bell,
   *             locked (a great lock's line, walked up to without its key: where the way back is, the Aerie's) }
   * A door whose element has `lock` ('small' | 'big', `keys` keyholes) wears a brass lock plate on both faces, a keyhole
   * for each key; walk up to it with a key of its kind and the key goes in (Zelda's way: no button), one per keyhole.
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const { w = 4.4, h = 6, t = 0.9 } = o;
    this.w = w; this.h = h;
    const K = rt.kit, M = rt.M;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.slab = new THREE.Group();
    this.group.add(this.slab);
    this.slab.add(mesh([box(w, h, t, 0, h / 2, 0)], M.wallGlyph));
    this.slab.add(mesh([box(w + 0.02, 0.3, t + 0.12, 0, 0.6, 0), box(w + 0.02, 0.3, t + 0.12, 0, h - 0.6, 0)], M.trimMat));
    // the medallion: the glyph in a ring, glowing more as the door wakes
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.25, flat: true });
    const gl = [];
    for (const s of [1, -1]) {
      gl.push(T(glyphGeometry(Math.min(w, h) * 0.5, 0.1), [0, h * 0.58, s * (t / 2 + 0.04)], [0, s > 0 ? 0 : Math.PI, 0]));
      for (const y of [0.95, h - 0.95]) gl.push(T(new THREE.BoxGeometry(w * 0.7, 0.09, 0.06), [0, y, s * (t / 2 + 0.03)]));
    }
    this.glowMesh = mesh(gl, this.glow);
    this.slab.add(this.glowMesh);
    if (o.bell) {
      // a bell-tuned door: a bell's outline over the glyph
      const bell = lathe([[0.02, 0], [0.5, 0.05], [0.55, 0.35], [0.38, 0.9], [0.3, 1.25], [0.02, 1.35]], 14);
      this.slab.add(mesh([T(bell.clone(), [0, h * 0.82, t / 2 + 0.1], [Math.PI / 2, 0, 0], 0.8), T(bell, [0, h * 0.82, -t / 2 - 0.1], [-Math.PI / 2, 0, 0], 0.8)], this.glow));
    }
    // a lock: a brass plate on both faces, a keyhole for each key it takes (each lights as its key goes in)
    const lockEl = rt.logic?.el(o.id);
    if (lockEl?.lock) {
      const n = lockEl.keys ?? 1, big = lockEl.lock === 'big', pw = big ? 1.5 : 0.9 + 0.55 * (n - 1);
      const plate = [];
      for (const sd of [1, -1]) {
        plate.push(T(new THREE.BoxGeometry(pw, big ? 1.5 : 1.0, 0.12), [0, h * 0.3, sd * (t / 2 + 0.06)]));
        if (big) plate.push(T(new THREE.TorusGeometry(0.95, 0.09, 6, 24), [0, h * 0.3, sd * (t / 2 + 0.1)]));
      }
      this.slab.add(mesh(plate, M.trimMat));
      this.keyholes = [];
      for (let i = 0; i < n; i++) {
        const m = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.04, flat: true });
        const x = (i - (n - 1) / 2) * 0.55, g = [];
        for (const sd of [1, -1]) g.push(T(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), [x, h * 0.3 + 0.12, sd * (t / 2 + 0.14)], [Math.PI / 2, 0, 0]), T(new THREE.BoxGeometry(0.09, 0.3, 0.06), [x, h * 0.3 - 0.08, sd * (t / 2 + 0.14)]));
        this.slab.add(mesh(g, m));
        this.keyholes.push(m);
      }
      this.lock = lockEl.lock;
    }
    // the lamps on the lintel above the doorway: one per condition (both faces)
    this.lamps = (o.lamps ?? []).map((cond, i, all) => {
      const m = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.05, flat: true });
      const x = (i - (all.length - 1) / 2) * 0.9;
      const g = [T(new THREE.SphereGeometry(0.22, 10, 8), [x, h + 0.55, t / 2 + 0.35]), T(new THREE.SphereGeometry(0.22, 10, 8), [x, h + 0.55, -t / 2 - 0.35])];
      const lm = mesh(g, m);
      this.group.add(lm);
      return { cond, m, on: false, mesh: lm };
    });
    noCollide(this.group);
    // (issue #356) a frame, where the doorway it stands in is wider or taller than the slab (an antechamber's open end):
    // stone `side` m wide either side of it and `top` m over it, drawn and solid, so there is no way round it shut
    if (o.frame) {
      const { side = 0, top = 0 } = o.frame, yaw = o.yaw ?? 0, c = Math.cos(yaw), sn = Math.sin(yaw), [ax, ay, az] = o.at;
      const at = (dx, dy) => [ax + c * dx, ay + dy, az - sn * dx];
      const parts = [];
      if (side > 0) for (const s of [-1, 1]) parts.push(T(new THREE.BoxGeometry(side, h + top + 0.05, t), at(s * (w / 2 + side / 2), (h + top) / 2 - 0.05), [0, yaw, 0]));
      if (top > 0) parts.push(T(new THREE.BoxGeometry(w, top, t), at(0, h + top / 2), [0, yaw, 0]));
      for (const g of parts) K.both(M.wall, g);
    }
    // solid while shut: an invisible block filling the doorway (added to the physics in init)
    this.block = new THREE.Mesh(box(w, h, t + 0.2, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.k = rt.logic?.isOpen(o.id) ? 1 : 0;
    this.open = this.k > 0.5;
    this.apply();
  }
  init(physics) { this.physics = physics; if (!this.open) this.handle = physics.addCollider?.(this.block, NO_CLIMB) ?? null; }
  /** Someone stands in the doorway (a held door waits for them to step through before it shuts). */
  inDoorway(p = this.rt.player, depth = 1.4) {
    if (!p?.pos) return false;
    const l = this.group.worldToLocal(_dl.copy(p.pos));
    return Math.abs(l.x) < this.w / 2 + 0.6 && Math.abs(l.z) < depth && l.y > -1 && l.y < this.h;
  }
  setOpen(open, instant = false) {
    this.wantShut = false;
    if (open === this.open) return;
    if (!open && !instant && this.inDoorway()) { this.wantShut = true; return; }
    this.open = open;
    if (open && this.handle) { this.physics?.removeCollider?.(this.handle); this.handle = null; }
    if (!open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block, NO_CLIMB) ?? null;
    if (instant) { this.k = open ? 1 : 0; this.apply(); }
    else { const S = this.rt.sound; if (S?.doorOpen) S.doorOpen(); else S?.whoosh?.(); this.rt.rumble?.(open ? 1.6 : 0.8, 0.35); }   // (the bolt's clunk at once, then the rush: issue #379)
  }
  apply() {
    this.slab.position.y = -ease(this.k) * (this.h + 0.3);
    this.slab.visible = this.k < 0.999;
  }
  update(dt, t) {
    if (this.wantShut && !this.inDoorway()) this.setOpen(false);
    const want = this.open ? 1 : 0;
    if (this.k !== want) { this.k = THREE.MathUtils.clamp(this.k + (want ? dt / 1.8 : -dt / 0.9), 0, 1); this.apply(); }
    // a shut door is not a wall to climb (up it and over the lintel is out of the temple's rooms): you slip off
    const P = this.rt.player;
    if (!this.open && P?.climbing) {
      const l = this.group.worldToLocal(_dl.copy(P.pos));
      if (Math.abs(l.x) < this.w / 2 + 1.2 && Math.abs(l.z) < 1.6 && l.y > -1 && l.y < this.h + 3) {
        P.climbing = false;
        P.vel.copy(_dn.set(0, 0, Math.sign(l.z) || 1).transformDirection(this.group.matrixWorld).multiplyScalar(2.5)).setY(-1);
        P._climbCooldown = 1.2;
      }
    }
    if (this.lock) this.updateLock(dt);
    // hidden: plain wall, no glyph, until the lens shows it
    if (this.o.hidden) { const seen = shown(this.rt, this.o, this.slab.getWorldPosition(_mk)); this.glowMesh.visible = seen; for (const l of this.lamps) l.mesh.visible = seen; if (!seen) return; }
    let met = 0;
    for (const l of this.lamps) {
      const on = this.open || !!this.rt.logic?.check(l.cond);
      if (on) met++;
      l.m.uniforms.uGlow.value += ((on ? 1 : 0.05) - l.m.uniforms.uGlow.value) * Math.min(1, dt * 6);
    }
    const wake = this.open ? 1 : this.lamps.length ? met / this.lamps.length : 0.2;
    this.glow.uniforms.uGlow.value = 0.2 + 0.7 * wake * (0.8 + 0.2 * Math.sin(t * 3));
  }
}

/** A locked door: a key of its kind, walked up to, goes in (one a keyhole); without one it says what it wants, once. */
Door.prototype.updateLock = function (dt) {
  const L = this.rt.logic, P = this.rt.player, id = this.id;
  if (P?.pos && !this.open && !L.unlocked(id) && this.inDoorway(P, 2.6)) {
    if (L.canUnlock(id)) {
      this.keyWait = (this.keyWait ?? 0) + dt;
      if (this.keyWait > 0.35) {
        this.keyWait = 0;
        L.unlock(id);
        const left = L.keyholes(id) - L.keysIn(id);
        // (a soft click as it turns, where a clank was: issue #274; the lock letting go chimes)
        this.rt.sound?.keyTurn?.(); if (left <= 0) this.rt.sound?.chime?.();
        this.rt.notice(left > 0 ? `The key turns. ${left === 1 ? 'One keyhole' : `${left} keyholes`} still empty.` : this.lock === 'big' ? 'The great key turns, and the lock lets go.' : 'The small key turns, and the lock lets go.', left > 0 ? null : `lock.${id}`);
        this.rt.onUnlock?.(id);
      }
    } else if (this.lock === 'big') this.rt.notice(this.o.locked ?? 'A great lock. It wants the house’s great key.', `locked.${id}`);
    else this.rt.notice(L.keysIn(id) ? 'One more small key would turn it.' : 'Locked. A small key would turn it.', `locked.${id}.${L.keysIn(id)}`);
  } else this.keyWait = 0;
  const n = L.keysIn(id);
  this.keyholes.forEach((m, i) => { m.uniforms.uGlow.value += ((i < n || this.open ? 0.9 : 0.04) - m.uniforms.uGlow.value) * Math.min(1, dt * 6); });
};

// ---------------------------------------------------------------------------------------- plates
const PLATE_TOP = 0.17;   // m: a plate's disc top over the floor, up

/**
 * The walker's print (the Footprint): a heel and `toes` toes, flat, `s` m long, pointing +z, lying in the xz plane at
 * y 0. The temple's own print has three; the lens shows which marks are the walker's.
 */
export function printGeometry(toes = 3, s = 1) {
  const parts = [new THREE.CircleGeometry(0.32 * s, 14).scale(1, 1.3, 1).rotateX(-Math.PI / 2).translate(0, 0, -0.15 * s)];
  for (let i = 0; i < toes; i++) {
    const a = toes > 1 ? (i / (toes - 1) - 0.5) * 1.1 : 0;
    parts.push(new THREE.CircleGeometry(0.13 * s, 10).scale(1, 2.1, 1).rotateZ(-a).rotateX(-Math.PI / 2).translate(Math.sin(a) * 0.42 * s, 0, 0.18 * s + Math.cos(a) * 0.28 * s));
  }
  return mergeGeometries(parts.map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
}

export class Plate {
  /** o: { id, at, r, print: toes (a print pressed in it instead of the glyph), hidden (only the lens shows it) } */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.r = o.r ?? 1.3; this.o = o;
    const K = rt.kit, M = rt.M;
    this.pos = K.world(...o.at);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.group.add(mesh([T(new THREE.CylinderGeometry(this.r + 0.35, this.r + 0.45, 0.12, 24), [0, 0.04, 0])], M.trimMat));
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.1, flat: true });
    const mark = o.print ? T(printGeometry(o.print, this.r * 1.5), [0, 0.18, 0]) : T(glyphGeometry(this.r * 1.2, 0.04).rotateX(-Math.PI / 2), [0, 0.18, 0]);
    this.disc = mesh([T(new THREE.CylinderGeometry(this.r, this.r, 0.14, 24), [0, 0.1, 0]), mark], this.glow);
    this.group.add(this.disc);
    noCollide(this.group);
    this.k = 0;
    // stood on, not stood in: its disc's top is a floor for the feet (a moving solid, level.dynamic), as it sinks
    this.solid = { pos: this.pos, r: this.r, top: this.pos.y + PLATE_TOP, bottom: this.pos.y - 0.2, vel: V(), flat: true };
  }
  weighed(p) { return !!p && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < this.r + 0.2 && Math.abs(p.pos.y - this.pos.y) < 0.6 && (p.onGround || p.down); }
  update(dt) {
    const L = this.rt.logic, on = this.weighed(this.rt.player);
    if (on) { if (L.press(this.id, 'player')) this.rt.sound?.chime?.(); } else L.release(this.id, 'player');
    const down = L.pressed(this.id);
    this.k += ((down ? 1 : 0) - this.k) * Math.min(1, dt * 8);
    this.disc.position.y = -0.07 * this.k;
    this.solid.top = this.pos.y + PLATE_TOP + this.disc.position.y;
    this.glow.uniforms.uGlow.value = 0.1 + 0.85 * this.k;
    // (a hidden print, a clue: shown while the lens looks at it)
    if (this.o.hidden) this.group.visible = this.o.hidden === true ? lensUp(this.rt, this.pos) : L.has(this.o.hidden);
  }
}

/**
 * A weight: a block of the house's stone, small enough to carry in both hands (src/carry.js, issue #337: "grab a box from
 * afar with the grappling hook, then put it down on a switch so I can go through a door"). Set on one of its plates (put
 * down near it, or thrown and come to rest on its disc), it holds that plate down while it sits there; picked up, the
 * plate lets go. Its element { type: 'weight', room, plate } keeps the plate it sits on (saved); put down elsewhere, where
 * it lies is saved too (`weight.<id>.at`, the kit's frame). Fallen into a pit, below `fall` m under where it lay, or come
 * to rest outside its `zone` (the kit's frame: its room), it is back where it lay at first. The grappling hook drags it
 * into your hands unless `hookable: false` (src/gadgets/hook.js).
 * o: { id, at (its foot, local), yaw, size, plates (its element's `plate` first), zone: { min, max }, name, hookable,
 *      hint (said once when you step off its plate with the weight elsewhere), back (said when it comes back) }
 */
export const WEIGHT = { size: 0.72, fall: 3, settle: 0.25 };
export class Weight {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, s = (this.size = o.size ?? WEIGHT.size), h = s / 2;
    this.home = K.world(...o.at).addScaledVector(UP, h);
    this.homeYaw = K.heading(o.yaw ?? 0);
    this.object = new THREE.Group();
    this.object.name = `Weight ${o.id}`;
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.25, flat: true });
    // a block of the house's stone, banded in its trim, the makers' glyph on its top and on two sides
    this.object.add(mesh([box(s, s, s)], M.stoneMat));
    this.object.add(mesh([box(s + 0.05, 0.09, s + 0.05, 0, -h + 0.16, 0), box(s + 0.05, 0.09, s + 0.05, 0, h - 0.16, 0)], M.trimMat));
    this.object.add(mesh([
      T(glyphGeometry(s * 0.62, 0.03).rotateX(-Math.PI / 2), [0, h + 0.012, 0]),
      T(glyphGeometry(s * 0.5, 0.03), [0, 0, h + 0.012]), T(glyphGeometry(s * 0.5, 0.03).rotateY(Math.PI), [0, 0, -h - 0.012]),
    ], this.glow));
    noCollide(this.object);
    rt.root.add(this.object);
    this.prop = new Prop({ object: this.object, r: h, h, mass: 1, kind: 'weight', name: o.name ?? 'weight' });
    Object.assign(this.prop, { id: `temple.${rt.id}.${o.id}`, weightOf: this, hookable: o.hookable !== false });
    this.prop.onPick = () => this.lifted();
    this.prop.onPut = () => { this.still = 0; this.settled = false; };
    this.plates = o.plates ?? [rt.logic.el(o.id)?.plate].filter(Boolean);
    this.still = 0; this.settled = true;
    this.place();
  }
  /** Its middle (the marker points at it: index.js nextSpot). */
  get center() { return this.prop.pos; }
  /** Where the save left it: on its plate, where it was put down, or where it lay at first. */
  place() {
    const L = this.rt.logic, on = L.weightOn(this.id), at = L.store.get(`weight.${this.id}.at`);
    const P = this.prop;
    P.vel.set(0, 0, 0); P.held = null;
    const plate = on ? this.rt.piece(on) : null;
    if (plate?.pos) { P.pos.copy(plate.pos).addScaledVector(UP, PLATE_TOP + this.size / 2); this.object.rotation.set(0, this.homeYaw, 0); }
    else if (Array.isArray(at) && at.length === 3) { P.pos.copy(this.rt.kit.world(...at)); this.object.rotation.set(0, this.homeYaw, 0); }
    else { P.pos.copy(this.home); this.object.rotation.set(0, this.homeYaw, 0); }
    P.resting = true;
    this.object.updateMatrixWorld(true);
  }
  init(physics) {
    this.physics = physics;
    this.object.updateMatrixWorld(true);
    this.prop.collider = physics?.addMover?.(this.object, { all: true }) ?? null;
    this.offs = [registerCarryable(this.prop)];
    // (a loose thing the grappling hook's aim finds: src/gadgets/hook.js; nothing else moves it)
    if (this.prop.hookable) this.offs.push(registerTarget({ kind: 'prop', prop: this.prop, radius: this.size * 0.9, position: () => this.prop.pos, enabled: () => this.object.visible && !this.prop.held, onHit: () => false }));
    // (put down by one of its plates: set on the disc's middle)
    for (const id of this.plates) {
      const pl = this.rt.piece(id);
      if (pl?.pos) this.offs.push(registerSnap({ pos: pl.pos.clone().addScaledVector(UP, PLATE_TOP), r: pl.r, name: 'plate', yaw: this.homeYaw, accepts: (t) => t === this.prop, taken: () => this.rt.logic.ofType('weight').some((w) => w !== this.id && this.rt.logic.weightOn(w) === id) }));
    }
  }
  /** Picked up: off its plate (the plate lets go at once). */
  lifted() {
    const L = this.rt.logic;
    if (L.placeWeight(this.id, null)) { this.rt.sound?.critter?.('clack', 0.5); this.rt.applyDoors?.(); }
    this.settled = false; this.still = 0;
  }
  /** The plate whose disc it sits on now (within its rim, its foot at the disc), or null. */
  plateUnder() {
    const P = this.prop;
    for (const id of this.plates) {
      const pl = this.rt.piece(id);
      if (!pl?.pos) continue;
      if (Math.hypot(P.pos.x - pl.pos.x, P.pos.z - pl.pos.z) > pl.r) continue;
      const foot = P.pos.y - this.size / 2, top = pl.pos.y + PLATE_TOP + (pl.disc?.position.y ?? 0);
      if (foot > top - 0.35 && foot < top + 0.5) return pl;
    }
    return null;
  }
  /** Out of its room, in a pit or fallen far: back where it lay at first. */
  lost() {
    const P = this.prop, o = this.o;
    if (P.pos.y < this.home.y - (o.fall ?? WEIGHT.fall)) return true;
    if (this.rt.pits?.some((pit) => pit.contains(P.pos))) return true;
    if (o.zone) {
      const l = this.rt.kit.local(P.pos);
      if (l.x < o.zone.min[0] || l.x > o.zone.max[0] || l.y < o.zone.min[1] || l.y > o.zone.max[1] || l.z < o.zone.min[2] || l.z > o.zone.max[2]) return true;
    }
    return false;
  }
  goHome() {
    const L = this.rt.logic;
    L.placeWeight(this.id, null);
    L.store.set(`weight.${this.id}.at`, null);
    this.prop.held = null;
    this.prop.pos.copy(this.home); this.prop.vel.set(0, 0, 0); this.prop.resting = true;
    this.object.rotation.set(0, this.homeYaw, 0);
    this.object.updateMatrixWorld(true);
    this.settled = true;
    this.rt.notice(this.o.back ?? 'The weight is back where it lay.', `weight.${this.id}.back`);
  }
  update(dt) {
    const P = this.prop, L = this.rt.logic;
    // (stood on its plate and stepped off, the weight elsewhere: the plate wants a weight)
    const stood = !!L.weights?.get(this.plates[0])?.has('player');
    if (this._stood && !stood && L.weightOn(this.id) !== this.plates[0] && this.o.hint) this.rt.notice(this.o.hint, `weight.${this.id}.hint`);
    this._stood = stood;
    this.glow.uniforms.uGlow.value += ((L.weightOn(this.id) ? 0.85 : 0.25) - this.glow.uniforms.uGlow.value) * Math.min(1, dt * 6);
    if (P.held === IN_HANDS) return;
    if (!P.resting || P.held) {
      // its own step, its own collider set aside (the hook's drag moves it too: held, no gravity)
      const ex = this.physics?.extras, i = ex && P.collider ? ex.indexOf(P.collider) : -1;
      if (i >= 0) ex.splice(i, 1);
      try { if (this.physics) stepProp(P, dt, this.physics, UP); } finally { if (i >= 0) ex.splice(i, 0, P.collider); }
    }
    // on a plate's disc: it sits on its top (the disc sinks a little under it)
    const pl = this.plateUnder();
    if (pl && !P.held) {
      const top = pl.pos.y + PLATE_TOP + (pl.disc?.position.y ?? 0) + this.size / 2;
      if (P.pos.y < top) { P.pos.y = top; if (P.vel.y < 0) P.vel.y = 0; P.vel.x *= 0.8; P.vel.z *= 0.8; }
      if (P.vel.lengthSq() < 0.04) { P.vel.set(0, 0, 0); P.resting = true; }
      if (P.resting) P.pos.y = top;
    }
    this.object.updateMatrixWorld();
    if (P.held) { this.settled = false; return; }
    // come to rest: where it sits is the logic's (and the save's)
    const slow = P.resting || P.vel.lengthSq() < 0.04;
    this.still = slow ? this.still + dt : 0;
    if (!this.settled && this.still > WEIGHT.settle) {
      this.settled = true;
      if (this.lost()) { this.goHome(); return; }
      const on = pl?.id ?? null;
      if (on) P.pos.x += (pl.pos.x - P.pos.x) * 0.5, P.pos.z += (pl.pos.z - P.pos.z) * 0.5;
      if (L.placeWeight(this.id, on)) { this.rt.sound?.chime?.(); this.rt.applyDoors?.(); }
      L.store.set(`weight.${this.id}.at`, on ? null : this.rt.kit.local(P.pos).toArray().map((v) => +v.toFixed(2)));
    } else if (!this.settled && this.lost() && P.pos.y < this.home.y - (this.o.fall ?? WEIGHT.fall) - 6) this.goHome();
  }
  dispose() { for (const f of this.offs ?? []) f(); if (this.prop.collider) this.physics?.removeCollider?.(this.prop.collider); }
}

/**
 * A field of stepping stones over a chasm that only the lens shows (the Footprint's Hall of the Unseen): each stone
 * carries a print; the walker's (three toes, `real`) hold, the rest crumble a moment after you step on one and you
 * fall (back to the mark), and rise again a while later. Without the lens none is there at all.
 * o: { id, cells: [{ x, z, toes, real }] (local, their tops at y), y, size, a, b (the field's ends, for the audit),
 *      crumble: s, back: s, said }
 */
export class LensStones {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, s = o.size ?? 3, y = o.y ?? 0;
    this.ghost = own({ color: rt.P.glow ?? '#a8e6ee', glow: 0.4, flat: true });
    this.mark = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.7, flat: true });
    this.root = new THREE.Group();
    rt.root.add(this.root);
    this.cells = o.cells.map((c) => {
      const g = new THREE.Group();
      g.position.copy(K.world(c.x, y, c.z));
      g.rotation.y = K.heading(0);
      g.add(mesh([box(s, 0.5, s, 0, -0.25, 0)], this.ghost));
      g.add(mesh([T(printGeometry(c.toes, s * 0.7), [0, 0.015, 0])], this.mark));
      this.root.add(g);
      const block = new THREE.Mesh(box(s, 0.5, s, 0, -0.25, 0), new THREE.MeshBasicMaterial());
      block.position.copy(g.position); block.rotation.copy(g.rotation);
      return { ...c, g, y0: g.position.y, block, handle: null, on: 0, down: 0 };
    });
    noCollide(this.root);
    this.s = s;
  }
  init(physics) { this.physics = physics; }
  seen() { return revealed(this.rt, this.id, this.mid ??= this.rt.kit.world(...[0, 1, 2].map((i) => (this.o.a[i] + this.o.b[i]) / 2))); }
  /** Is p standing on cell c? */
  on(c, p) {
    if (!p?.pos) return false;
    const l = this.rt.kit.local(p.pos), cl = this.rt.kit.local(c.g.position);
    return Math.abs(l.x - cl.x) < this.s / 2 + 0.1 && Math.abs(l.z - cl.z) < this.s / 2 + 0.1 && l.y > cl.y - 0.3 && l.y < cl.y + 0.6 && (p.onGround ?? true);
  }
  update(dt) {
    const seen = this.seen(), P = this.rt.player, o = this.o;
    this.root.visible = seen;
    for (const c of this.cells) {
      // a false stone stood on crumbles after a moment, drops, and rises again later
      if (!c.real && c.down <= 0 && seen && this.on(c, P)) { c.on += dt; if (c.on > (o.crumble ?? 0.35)) { c.down = o.back ?? 4; c.on = 0; this.rt.sound?.critter?.('clack', 0.7); this.rt.notice?.(o.said ?? 'The stone crumbles under you: its print is not the walker’s.', `${this.id}.false`); } }
      else if (!this.on(c, P)) c.on = 0;
      if (c.down > 0) c.down = Math.max(0, c.down - dt);
      const solid = seen && c.down <= 0;
      if (solid && !c.handle && this.physics) c.handle = this.physics.addCollider?.(c.block, NO_CLIMB) ?? null;
      if (!solid && c.handle) { this.physics?.removeCollider?.(c.handle); c.handle = null; }
      const drop = c.down > 0 ? Math.min(1, ((o.back ?? 4) - c.down) / 0.8) : 0;
      c.g.position.y = c.y0 - drop * 12;
      c.g.visible = drop < 0.99;
    }
  }
}

// ---------------------------------------------------------------------------------------- balls
/** m/s: a ball walked into rolls ahead at your pace, at most SHOVE (Ball `shove`); a cut of the sword sends it at BALL_CUT. */
export const SHOVE = 2.6;
export const BALL_CUT = 7.5;
/**
 * m/s a push of the fluid gun sends a ball along its groove: base + per × its strength (1 at the hand, 0 at its 6 m reach).
 * (4.2 + 4.5 until issue #522, "the push gun should be stronger so I don't have to push balls so many times": a push
 * from close behind rolls it about 1.7 times as far, and a long roll takes about 0.6 times the pushes; one from the far
 * end of the reach about as far as before, so a ball can still be eased onto a plate mid-groove. tests/ball-push.test.js)
 */
export const BALL_PUSH = { base: 4.5, per: 12 };
/** m/s at most a ball comes back off its groove's end (a quarter of its speed). */
export const END_BOUNCE = 2.2;
/** m/s a tether's pull draws a ball back along its groove, toward whoever pulled it: as the push was before #522. */
export const BALL_TETHER = { base: 4.2, per: 4.5 };
/** m/s at most an iron moon rolls in the magnet glove's field (held toward its point; a tap 1.2 times it: issue #377). */
export const MAGNET_ROLL = 6;
/** (issue #401) The farthest a ball with a hole at its groove's end is saved along it while it stays up there: t 1 is fallen through. */
export const HOLE_REST = 0.93;
export class Ball {
  /**
   * o: { id, a, b: [x, y, z] the groove's ends (where the ball touches the floor), r, friction (1/s: 1.6, less
   * rolls farther), gap: { bridge, from, to, lip } (the groove crosses a bridge between those t: the ball only
   * passes while it stands, and drops if it goes from under it; lip: said when it stops at the near lip), lock (at rest on its plate it stays there),
   * lamp: { id, reach, pool, hold, lasts, caught, dark, woke } (a pool-orb: stand by it at rest with the lantern `hold` s, or let it rest by a lit pool (pool: { id, at, reach }) as long,
   * and it glows for `lasts` s; at rest on its plate while it glows it wakes element `id`, a 'switch' that
   * needs the lantern; dark, it wakes nothing), sings: 'low' | 'mid' | 'high' (a singing ball: a splash makes it
   * sing that note, game event 'note', as a singing stone does), seed: { id, shade, grew } (a seed-ball, Viridel's
   * Greenhouse: a bloom glob makes it grow, lighting element `id`, a 'switch' that needs the bloom mode, whose `when`
   * says where it must lie (in a sunbeam: on its plate); bloomed elsewhere it sprouts pale and folds back (`shade`).
   * Grown, it roots where it lies and rolls no more),
   * tar: { burns, caught, out, back } (a tar ball, the Rose House: an ember glob sets it alight, and so does rolling
   * it through a fire beside its groove (a Flame, a lit Brazier: their `fire`); it burns `burns` s, then goes out.
   * Burning, it lights the hooded bowl it comes to rest in (Brazier `hood`) and burns the thorns on its groove; cold,
   * the bowl tips it back out (`back` m/s); short: { unless, said }: going out while condition `unless` fails, it says
   * `said` instead of `out`, the fire that would carry it on: the Hall of Channels' lidded relay),
   * thorns: { id, at } (dry thorns across the groove at t = at, a Bramble: the ball stops against them while they
   * stand; burning, it burns them as it reaches them and rolls on),
   * jaws: { id, at, back, spat } (a mouth of jaws across the groove at t = at, a Jaw: shut, they spit the ball back at
   * `back` m/s; stilled, it rolls through),
   * current: { pull, still, stirs, stilled } (a sphere floating in a pool that stirs, the Footprint's: the water draws it
   * back toward the groove's start at `pull` m/s² unless condition `still` holds (a plate stood on stills the pool);
   * at rest on its plate (a berth) it stays),
   * strike: { at, reach } (a clapper, the Founders' Belfry: rolled to rest on its plate in a bell's mouth it strikes the
   * bell at `at`, a game 'bell' event there; and a splash on it as it lies there rocks it and strikes again),
   * heavy: item (an iron moon of the Moon Foundry's Casting-House: only a push, or a tether, made while carrying that
   * item (the founders' tongs) rolls it; anything else rocks it where it lies; heavyLine: what it says then),
   * iron: true (drawn as cast iron, dark with a rust ring),
   * shove: true (the Rose House, v1.44: walked into along its groove, it rolls ahead of you at your pace, `shove` m/s
   * at most when a number: hands, no gadget), blade: true (a cut of the sword sends it rolling, BALL_CUT m/s: far
   * faster than a shove),
   * hole: { gate, to, stand, fell } (issue #401, the Footprint's Sounding Toe: its groove ends over a hole in the floor
   * under a hatch, the door element `gate` (none: an open hole, the Rose House's balcony, issue #406); come to its end while the hatch is open, it drops through and comes to rest
   * at `to` (its foot, the plate on the floor below, its element's `plate`), for good: t 1 is "fallen"; on its groove it
   * is never saved past HOLE_REST. `stand`: the plate the hatch wants you on, pushed from (the play-through's) }
   * A tether (the City Floating in Space's gun mode, 'tether') rolls any ball toward whoever pulled it: the cone hands
   * it the way back to the hand as its `dir`.
   * Its element (logic.js) may have `stops`: several plates along the groove, and it settles into whichever it slows by.
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o; this.r = o.r ?? 1.1;
    const K = rt.kit, M = rt.M;
    this.a = K.world(...o.a); this.b = K.world(...o.b);
    this.len = this.a.distanceTo(this.b);
    this.dir = this.b.clone().sub(this.a).normalize();
    this.axis = new THREE.Vector3().crossVectors(UP, this.dir).normalize();
    this.t = rt.logic.drumT(o.id);
    this.v = 0;   // m/s along the groove
    this.group = new THREE.Group();
    rt.root.add(this.group);
    this.spin = new THREE.Group();
    this.group.add(this.spin);
    if (o.lamp) {
      this.orb = own({ color: rt.P.glow ?? '#8fe0d0', glow: 0.08, flat: true }); this.charge = 0; this.near = 0;
      // (issue #377, the Lamp-House: `carried`, a glowing bubble's light, src/carried-light.js, burst on it lights it, not
      // the lantern charm stood by it; and glowing, it is a light a bubble may take)
      if (o.lamp.carried) {
        this.offs = [rt.game?.on?.('bubble:light', ({ pos } = {}) => {
          // (what its lamp needs carried, the wand: a bubble's light; a wet bubble no one blew is not)
          if (!pos || pos.distanceTo(this.center) > this.r + CARRY.reach || !(rt.logic.el(o.lamp.id)?.needs ?? []).every((n) => rt.logic.has(n))) return;
          if (this.charge <= 0) { rt.sound?.chime?.(); rt.notice?.(o.lamp.caught ?? 'The bubble bursts on the orb, and it drinks the light: it glows, for a while.', `${this.id}.caught`); }
          this.charge = o.lamp.lasts ?? 25;
        }), registerLight({ position: () => this.center, enabled: () => this.charge > 0 }),
        registerDrinker({ position: () => this.center, radius: this.r + 0.4, enabled: () => this.charge <= 0 })].filter(Boolean);
      }
    }
    if (o.seed) this.husk = own({ color: '#a07a4e', flat: true });
    if (o.tar) { this.tarM = own({ color: '#4a3a33', flat: true }); this.burn = 0; }
    if (o.heavy || o.iron) this.ironM = own({ color: '#3d3a40', flat: true, metal: 'iron' });
    // (heavy: 'magnet', issue #377: an iron moon the magnet glove takes hold of, src/gadgets/metal.js registerIron; held it
    // rolls along its groove toward where the glove holds it, tapped it is thrown along it. No push moves it)
    if (o.heavy === 'magnet') this.offIron = registerIron({ pos: () => this.center, r: this.r, enabled: () => !this.drop && rt.logic.has('magnet'), follow: (goal, dt) => this.magnetTo(goal, dt), shove: (dir) => this.magnetShove(dir) });
    this.spin.add(mesh([new THREE.SphereGeometry(this.r, 18, 12)], this.orb ?? this.husk ?? (o.iron ? this.ironM : null) ?? this.tarM ?? this.ironM ?? M.stoneMat));   // (an iron moon that heats, the Casting-House's: drawn iron)
    this.glow = own({ color: o.sings ? NOTES[o.sings]?.color ?? '#62c3c9' : o.seed ? '#7fcf72' : o.tar ? '#e0844a' : rt.P.glow ?? '#70e7df', glow: 0.35, flat: true });
    this.spin.add(mesh([T(new THREE.TorusGeometry(this.r * 1.005, 0.06, 4, 36), [0, 0, 0], [0, 0, 0]), T(new THREE.TorusGeometry(this.r * 1.005, 0.06, 4, 36), [0, 0, 0], [0, Math.PI / 2, 0])], this.glow));
    if (o.seed) {
      // what a seed-ball grows when it is bloomed in the sun: a crown of leaves and a stem out of its top (it stays upright)
      this.sprout = new THREE.Group();
      const leafM = own({ color: '#7fcf72', flat: true }), stemM = own({ color: '#4f8a5a', flat: true }), petal = own({ color: '#f2a7b8', glow: 0.25, flat: true });
      const lv = [];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; lv.push(T(new THREE.SphereGeometry(1, 8, 5).scale(0.7, 0.12, 0.32).translate(0.6, 0, 0), [0, this.r * 1.9, 0], [0, a, 0.5])); }
      this.sprout.add(mesh([T(new THREE.CylinderGeometry(0.1, 0.16, 1.6, 6), [0, this.r * 1.8 + 0.4, 0])], stemM), mesh(lv, leafM), mesh([T(new THREE.SphereGeometry(0.3, 8, 6), [0, this.r * 1.8 + 1.25, 0])], petal));
      this.sprout.visible = false;
      this.group.add(this.sprout);
      this.grown = rt.logic.isLit(o.seed.id) ? 1 : 0;
    }
    noCollide(this.group);
    this.center = V();
    // (round, src/carriers.js: its top a dome, where a disc at its crest had you stand on air at its sides)
    this.solid = {
      pos: V(), r: this.r, top: 0, bottom: 0, vel: V(),
      // (its two glowing bands stand 0.06 m proud of the stone: the dome a little over the stone, between them)
      // (out to 0.92 of its radius: past that it is too steep to stand on, and its faceted side parts from a true sphere)
      topAt: (x, z) => { const R = this.r + 0.03, d2 = (x - this.center.x) ** 2 + (z - this.center.z) ** 2; return d2 < (0.92 * R) ** 2 ? this.center.y + Math.sqrt(R * R - d2) : -Infinity; },
      pushOut: (p, rc) => {
        const dx = p.x - this.center.x, dz = p.z - this.center.z, d = Math.hypot(dx, dz), R = this.r + rc;
        // (beside it, below its crest by more than a step: out round it; higher up you stand on it)
        if (d >= R || d < 1e-4 || p.y > this.center.y + Math.sqrt(Math.max(0, this.r * this.r - Math.min(d, this.r) ** 2)) - 0.5) return false;
        p.x = this.center.x + (dx / d) * R; p.z = this.center.z + (dz / d) * R;
        return true;
      },
    };
    // (a ball dropped through its hole, issue #401: where it came to rest, below; at 1 when saved fallen)
    if (o.hole) { this.below = K.world(...o.hole.to); this.fell = this.t >= 1 - 1e-3; }
    this.place();
    this.off = registerTarget({
      kind: 'ball', radius: this.r + 0.15, position: () => this.center, accepts: [...(o.seed ? ['bloom', 'tether'] : ['tether']), ...(o.blade ? ['blade'] : [])],
      onHit: (mode, point, dir, info) => this.hit(mode, dir, info),
    });
    this.rest = true;
  }
  place() {
    if (this.fell) this.group.position.copy(this.below);
    else this.group.position.copy(this.a).lerp(this.b, this.t);
    if (this.falling2) this.group.position.y = this.falling2.y;
    this.center.copy(this.group.position).addScaledVector(UP, this.r);
    this.spin.position.y = this.r;
    this.solid.pos.copy(this.group.position);
    this.solid.bottom = this.group.position.y; this.solid.top = this.group.position.y + this.r * 2;
  }
  hit(mode, dir, info = {}) {
    if (this.o.seed) {
      if (this.rt.logic.isLit(this.o.seed.id)) { this.wobble = 0.3; return true; }   // (grown: rooted where it lies)
      if (mode === 'bloom') {
        if (this.rest && this.rt.logic.light(this.o.seed.id)) { this.v = 0; this.rt.sound?.chime?.(); this.rt.sound?.whoosh?.(); this.rt.onLit?.(this.o.seed.id); this.rt.notice?.(this.o.seed.grew ?? 'The seed splits in the sun, and roots, and grows.', `${this.id}.grew`); }
        else { const w = this.o.seed.why?.() ?? 'shade'; this.pale = 1.2; this.rt.notice?.(this.o.seed[w] ?? this.o.seed.shade ?? 'The seed sprouts, pale, reaching for light that isn’t there, and folds back into its husk. Nothing grows in the shade.', `${this.id}.${w}`); }   // (why: what it lacks, the sun or, issue #411, the water)
        return true;
      }
    }
    if (this.o.tar && mode === 'fire') { this.ignite(); return true; }   // (a tar ball catches: it doesn't roll for it)
    if (!dir) return false;
    // a clapper lying in its bell's mouth: a splash rocks it, and it strikes the bell again
    if (this.o.strike && this.rest && this.rt.logic.drumOn(this.id, this.rt.logic.el(this.id)?.plate)) { this.wobble = 0.4; this.strike(); return true; }
    if (this.o.lock && this.rest && this.rt.logic.drumOn(this.id, this.rt.logic.el(this.id)?.plate) && (!this.o.lamp || this.rt.logic.isLit(this.o.lamp.id))) { this.wobble = 0.4; return true; }   // (settled in its socket)
    if (this.drop) return true;
    if (this.fell || this.falling2) { this.wobble = 0.3; return true; }   // (dropped through its hole: it lies below, for good)
    if (mode === 'blade') {
      if (!this.o.blade) return false;
      // a cut: the flat of the blade sends it rolling, hard, the way the cut went (along its groove)
      const along = dir.x * this.dir.x + dir.z * this.dir.z;
      if (Math.abs(along) < 0.2) { this.wobble = 0.4; this.rt.sound?.critter?.('clack', 0.6); return true; }
      this.v = Math.sign(along) * BALL_CUT; this.rest = false;
      this.rt.sound?.critter?.('clack', 0.9);
      return true;
    }
    const cone = mode === 'push' || mode === 'tether';
    // an iron moon: only a push (or a tether) made with the founders' tongs takes hold of it; since issue #377 (heavy:
    // 'magnet') only the magnet glove does (magnetTo, magnetShove), no push at all
    if (this.o.heavy && (this.o.heavy === 'magnet' || !(cone && this.rt.logic.has(this.o.heavy)))) {
      this.wobble = 0.25; this.rt.sound?.critter?.('clank', 0.6);
      this.rt.notice?.(this.o.heavyLine ?? 'It rocks on its rail and settles back. Cast iron: far too heavy for a plain push.', `${this.id}.heavy`);
      return true;
    }
    if (this.o.sings && !cone) this.sing();   // (a singing ball: a splash makes it sing, and nudges it)
    const along = dir.x * this.dir.x + dir.z * this.dir.z;
    const K = mode === 'tether' ? BALL_TETHER : BALL_PUSH;
    const k = cone ? K.base + K.per * (info.strength ?? 1) : 1.2;   // m/s: a push (or a tether's pull) rolls it some metres, a splash nudges it
    if (Math.abs(along) < 0.25) { this.wobble = 0.4; return true; }
    this.v += Math.sign(along) * k * Math.min(1, Math.abs(along) + 0.3);
    this.rest = false;
    this.rt.sound?.critter?.('creak', 0.7);
    return true;
  }
  /** Held in the magnet glove's field (heavy: 'magnet'): it rolls along its groove toward the point the glove holds. */
  magnetTo(goal, dt) {
    if (this.lockedHome?.()) return;
    const tGoal = THREE.MathUtils.clamp(_dl.copy(goal).sub(this.a).dot(this.dir) / this.len, 0, 1);
    const want = THREE.MathUtils.clamp((tGoal - this.t) * this.len * 3, -MAGNET_ROLL, MAGNET_ROLL);
    this.v += (want - this.v) * Math.min(1, dt * 8);
    this.rest = false;
  }
  /** A tap of the glove (heavy: 'magnet'): thrown along its groove the way the tap goes. */
  magnetShove(dir) {
    if (this.lockedHome?.()) return;
    const along = dir.x * this.dir.x + dir.z * this.dir.z;
    if (Math.abs(along) < 0.2) { this.wobble = 0.4; this.rt.sound?.critter?.('clank', 0.6); return; }
    this.v += Math.sign(along) * MAGNET_ROLL * 1.2;
    this.rest = false;
    this.rt.sound?.critter?.('creak', 0.7);
  }
  /** Settled in its socket for good (o.lock), its plate held. */
  lockedHome() { const L = this.rt.logic; return !!this.o.lock && this.rest && L.drumOn(this.id, L.el(this.id)?.plate); }
  /** A clapper (o.strike): it strikes its bell, a game 'bell' event at the bell (heard by its BellEar). */
  strike() {
    this.strikeAt ??= this.rt.kit.world(...this.o.strike.at);
    this.rt.sound?.critter?.('clack', 0.8);
    this.rt.game?.emit?.('bell', { pos: this.strikeAt.clone(), reach: this.o.strike.reach ?? 12, struck: true });
    return true;
  }
  /** A singing ball (o.sings: a note of NOTES): it sings like a singing stone, from where it lies. */
  sing() {
    const N = NOTES[this.o.sings] ?? NOTES.mid;
    this.flash = 1.6;
    this.rt.sound?.orbNote?.(N.degree, this.center, { size: 0.8 });
    this.rt.game?.emit?.('note', { pos: this.center.clone(), note: this.o.sings, degree: N.degree, color: N.color, label: `the singing ball’s ${N.name} note` });
    return true;
  }
  update(dt, time = 0) {
    if (this.wobble) { this.wobble = Math.max(0, this.wobble - dt); this.spin.rotation.z = Math.sin(this.wobble * 30) * this.wobble * 0.1; }
    if (this.o.lamp) this.lamp(dt);
    if (this.o.tar) this.tarTick(dt, time);
    if (this.o.seed) {
      const lit = this.rt.logic.isLit(this.o.seed.id);
      if (lit && this.grown < 1) this.grown = Math.min(1, this.grown + dt / 1.4);
      this.pale = Math.max(0, (this.pale ?? 0) - dt);
      // grown: the leaves; bloomed in the shade: a pale shoot that comes and folds back
      const k = lit ? this.grown : Math.sin(Math.min(1, this.pale / 1.2) * Math.PI) * 0.45;
      this.sprout.visible = k > 0.01;
      this.sprout.position.copy(this.spin.position).setY(0);
      this.sprout.scale.setScalar(Math.max(0.01, k));
      if (lit) { this.solid.vel.set(0, 0, 0); this.v = 0; this.rest = true; return; }
    }
    if (this.o.sings) { this.flash = Math.max(0, (this.flash ?? 0) - dt); this.glow.uniforms.uGlow.value = 0.35 + 0.6 * (this.flash / 1.6); }
    if (this.drop) { this.falling(dt); return; }
    if (this.fell) { this.solid.vel.set(0, 0, 0); this.v = 0; this.rest = true; return; }
    if (this.falling2) { this.throughHole(dt); return; }
    const G = this.o.gap;
    if (G && this.t > G.from + 1e-3 && this.t < G.to - 1e-3 && !this.rt.logic.isOpen(G.bridge)) { this.startDrop(); return; }
    const Cu = this.o.current;
    this.pulled = false;
    if (Cu) {
      // the pool stirs: it draws the sphere back toward the start, unless something stills it or it lies in its berth
      const Lg = this.rt.logic, berth = Lg.drumOn(this.id, Lg.el(this.id)?.plate) && this.rest;
      const still = Lg.check(Cu.still);
      if (!still && !berth && this.t > 0.004) { this.v -= (Cu.pull ?? 0.7) * dt; this.rest = false; this.pulled = true; if (Cu.stirs && this.v < -0.5) this.rt.notice?.(Cu.stirs, `${this.id}.stirs`); }
      if (still !== this.wasStill) { if (still && Cu.stilled) this.rt.notice?.(Cu.stilled, `${this.id}.stilled`); this.wasStill = still; }
    }
    if (this.o.shove) this.shoved(dt);
    if (this.rest) { this.solid.vel.set(0, 0, 0); return; }
    // rolling friction, and a gentle settle into the plate's dip when it is slow and close
    const L = this.rt.logic, e = L.el(this.id);
    // (several stops: the one it is nearest)
    const at = e?.stops ? Object.values(e.stops).reduce((b, x) => (Math.abs(x - this.t) < Math.abs(b - this.t) ? x : b)) : e?.plateAt ?? 1;
    const near = Math.abs(this.t - at) * this.len;
    if (Math.abs(this.v) < 1.2 && near < 1.6) this.v += Math.sign(at - this.t) * 3.5 * dt * Math.min(1, near);
    this.v *= Math.exp(-(near < 1.6 ? 1.6 : this.o.friction ?? 1.6) * dt);   // (the plate's dip holds it, whatever the groove)
    let t = this.t + (this.v * dt) / this.len;
    // (its groove's end over an open hatch: it drops through, issue #401)
    if (this.o.hole && t >= 1 && (!this.o.hole.gate || L.isOpen(this.o.hole.gate))) { this.t = 1; this.place(); this.startHole(); return; }
    // (the groove's end throws it back a quarter of its speed, never faster than the hardest push did before issue #522
    // (8.7 m/s): a plate by the end still catches a ball sent hard at it)
    if (t <= 0 || t >= 1) { t = THREE.MathUtils.clamp(t, 0, 1); this.v = -Math.sign(this.v) * Math.min(Math.abs(this.v) * 0.25, END_BOUNCE); this.rt.sound?.critter?.('clack', 0.5); }
    // thorns across the groove: it stops against them, or, burning, burns them and rolls on
    const Th = this.o.thorns;
    if (Th && t > this.t && this.t <= Th.at + 1e-4 && t >= Th.at - 1e-4) {
      const br = this.rt.piece(Th.id);
      if (br && !br.burnt) {
        L.moveDrum(this.id, Th.at);   // (it stands at the thorns: a bramble that takes `when` the ball is there)
        if (this.burn > 0) br.hit('fire');
        if (!br.burnt) { t = Th.at; this.v = 0; this.rt.sound?.critter?.('creak', 0.5); if (this.o.thorns.stopped) this.rt.notice?.(this.o.thorns.stopped, `${this.id}.thorns`); }
      }
    }
    // a mouth of jaws across the groove (a Jaw): shut, they snap at the ball as it comes and spit it back the way it
    // came; stilled, it rolls through between them (the Hush-House's balcony, v1.52)
    const Jw = this.o.jaws;
    if (Jw && t > this.t && this.t <= Jw.at + 1e-4 && t >= Jw.at - 1e-4) {
      const j = this.rt.piece(Jw.id);
      if (j && !j.open) { t = Jw.at - 1e-3; this.v = -Math.max(Jw.back ?? 3.2, Math.abs(this.v) * 0.6); j.angry = 0.8; this.rt.sound?.critter?.('snap', 0.8); if (Jw.spat) this.rt.notice?.(Jw.spat, `${this.id}.spat`); }
    }
    // a groove over a bridge: the stones are up, so the ball stops at the lip; or they went from under it
    if (G && !L.isOpen(G.bridge)) {
      if (this.t <= G.from + 1e-3 && t > G.from) { t = G.from; this.v = -Math.abs(this.v) * 0.25; this.rt.sound?.critter?.('clack', 0.5); if (G.lip) this.rt.notice?.(G.lip, `${this.id}.lip`); }
      else if (this.t >= G.to - 1e-3 && t < G.to) { t = G.to; this.v = Math.abs(this.v) * 0.25; this.rt.sound?.critter?.('clack', 0.5); }
    }
    const moved = (t - this.t) * this.len;
    this.t = t;
    this.spin.rotateOnWorldAxis(this.axis, moved / this.r);
    this.place();
    this.solid.vel.copy(this.dir).multiplyScalar(this.v);
    if (Math.abs(this.v) < 0.05 && (near < 0.05 || near > 1.6) && !(this.pulled && this.t > 0.004)) {
      this.v = 0; this.rest = true;
      if (L.moveDrum(this.id, this.o.hole ? Math.min(this.t, HOLE_REST) : this.t) && [e?.plate, ...Object.keys(e?.stops ?? {})].some((p) => p && L.drumOn(this.id, p))) { this.rt.sound?.chime?.(); if (this.o.strike && L.drumOn(this.id, e.plate)) this.strike(); }
    }
  }
  /**
   * Hands on it (o.shove): you walk into it along its groove, and it rolls ahead of you at your pace (at most `shove`
   * m/s, SHOVE by default); stop, and it slows and stops.
   */
  shoved() {
    const P = this.rt.player;
    if (!P?.pos || P.dead || !P.onGround || P.ride || P.climbing) return;
    const dx = this.center.x - P.pos.x, dz = this.center.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > this.r + 0.85 || d < 1e-3 || Math.abs(P.pos.y - this.group.position.y) > 0.8) return;
    const vx = P.vel?.x ?? 0, vz = P.vel?.z ?? 0, sp = Math.hypot(vx, vz);
    if (sp < 0.8 || (vx * dx + vz * dz) / (sp * d) < 0.55) return;   // (walking into it, not past it)
    const along = (vx * this.dir.x + vz * this.dir.z) / sp, max = typeof this.o.shove === 'number' ? this.o.shove : SHOVE;
    if (Math.abs(along) < 0.5) return;
    const want = Math.sign(along) * Math.min(max, sp * Math.abs(along));
    if (Math.abs(this.v) < Math.abs(want) || Math.sign(this.v) !== Math.sign(want)) { this.v = want; this.rest = false; }
    this.rt.notice?.(this.o.shoveLine ?? 'You lean on the ball, and it rolls ahead of you along its groove.', `${this.id}.shove`);
  }
  /** A pool-orb: it catches the lantern's light, glows a while, and on its plate, glowing, wakes its lamp. */
  lamp(dt) {
    const o = this.o.lamp, L = this.rt.logic, P = this.rt.player;
    // (at rest: a quick push doesn't light it) by your lantern, or at rest by a lit pool (o.pool: { id, at, reach })
    const pool = o.pool && this.rest && L.isLit(o.pool.id) && this.center.distanceTo(this.poolAt ??= this.rt.kit.world(...o.pool.at)) < (o.pool.reach ?? 4);
    const by = pool || (!o.carried && !!P && this.rest && L.has('lantern') && P.pos.distanceTo(this.center) < (o.reach ?? 2.8));
    this.near = by ? this.near + dt : 0;
    if (this.near > (o.hold ?? 2) && this.charge < (o.lasts ?? 25) - 0.5) {
      if (this.charge <= 0) { this.rt.sound?.chime?.(); this.rt.notice?.(o.caught ?? 'The orb drinks your lantern’s light and glows, for a while.', `${this.id}.caught`); }
      this.charge = o.lasts ?? 25;
    }
    this.charge = Math.max(0, this.charge - dt);
    const home = this.rest && L.drumOn(this.id, L.el(this.id)?.plate);
    if (home && !L.isLit(o.id)) {
      if (this.charge > 0) { if (L.light(o.id)) { this.rt.sound?.chime?.(); this.rt.onLit?.(o.id); this.rt.notice?.(o.woke ?? 'The glowing orb settles under the lamp, and the lamp catches.', `${o.id}.woke`); } }
      else {
        // dark: it wakes nothing, and the niche tips it back out the way it came
        if (!this.toldDark) { this.toldDark = true; this.back = 1.6; this.rt.notice?.(o.dark ?? 'The orb settles under the lamp, dark, and the niche tips it back out. The lamp wants light.', `${this.id}.dark`); }
        this.back -= dt;
        if (this.back <= 0) { this.v = -this.len * 1.6 * 0.85; this.rest = false; this.rt.sound?.critter?.('creak', 0.6); }
      }
    }
    if (!home) this.toldDark = false;
    // (a lamp held only while its orb glows, `hold` on its element: the Lamp-House's Wick Room) out with the orb's glow
    if (L.isLit(o.id) && L.el(o.id)?.hold && (this.charge <= 0 || !home)) { L.quiet(o.id); if (this.charge <= 0) this.rt.notice?.(o.faded ?? 'The orb’s glow has gone out, and its lamp with it.', `${o.id}.faded`); }
    const lit = L.isLit(o.id), k = lit ? 1 : Math.min(1, this.charge / 4) * (0.85 + 0.15 * Math.sin(this.rt.time * 4));
    this.orb.uniforms.uGlow.value = 0.08 + 0.85 * k + (by ? 0.25 * Math.min(1, this.near / (o.hold ?? 2)) : 0);
  }
  /** A tar ball catches (an ember glob, or rolled through a fire): it burns `tar.burns` s from now. */
  ignite() {
    const o = this.o.tar;
    if (!o || this.drop) return false;
    const was = this.burn > 0;
    this.burn = o.burns ?? 12;
    if (!this.flames) {
      this.flames = new Flames(this.group, [{ at: V(0, this.r * 1.75, 0), h: 1.3, r: 0.42 }, { at: V(0.2, this.r * 1.6, 0.1), h: 0.9, r: 0.28, phase: 2 }, { at: V(-0.18, this.r * 1.65, -0.12), h: 1.0, r: 0.26, phase: 4 }], { seed: this.id?.length ?? 3 });
      this.flames.mesh.userData.dynamic = true;
      this.light = new THREE.Vector4(0, -1e5, 0, 0);
      this.rt.lights.push(this.light);
    }
    this.flames.mesh.visible = true;
    if (!was) { this.rt.sound?.whoosh?.(); this.rt.notice?.(o.caught ?? 'The tar ball catches, and burns.', `${this.id}.caught`); }
    return true;
  }
  /** Burning: it burns down, and goes out; rolled past a fire (a Flame, a lit Brazier), it catches again. */
  tarTick(dt, time) {
    const o = this.o.tar;
    // a fire beside the groove: within its reach, level with it
    for (const p of this.rt.pieces) {
      const f = p !== this && p.fire;
      if (f && Math.hypot(f.x - this.center.x, f.z - this.center.z) < (p.fireReach ?? 1.7) && Math.abs(f.y - this.center.y) < 3) { if (this.burn < (o.burns ?? 12) - 0.25) this.ignite(); break; }
    }
    if (this.burn > 0) {
      this.burn = Math.max(0, this.burn - dt);
      if (this.burn === 0) {
        this.flames.mesh.visible = false; this.light.set(0, -1e5, 0, 0);
        // (gone out on the way while the fire that would carry it on is still shut away: `short` says where it is, issue #311)
        const S = o.short && !this.rt.logic?.check?.(o.short.unless) ? o.short : null;
        this.rt.notice?.(S?.said ?? o.out ?? 'The tar ball’s flame gutters, and goes out.', S ? `${this.id}.short` : `${this.id}.out`);
      }
    }
    if (this.burn > 0) {
      // (it burns down: smaller toward the end)
      this.flames.intensity = 0.45 + 0.75 * Math.min(1, this.burn / ((o.burns ?? 12) * 0.5));
      this.flames.update(dt, time);
      this.light.set(this.center.x, this.center.y + this.r + 0.6, this.center.z, 7 + 5 * this.flames.intensity);
    }
    this.glow.uniforms.uGlow.value = this.burn > 0 ? 0.9 : 0.35;
  }
  /** A hooded bowl tips a cold ball back out the way it came. */
  tipBack() { this.v = -(this.o.tar?.back ?? 6); this.rest = false; this.rt.sound?.critter?.('creak', 0.6); }
  /** Over its hole with the hatch open (o.hole, issue #401): it drops through the floor. */
  startHole() {
    this.v = 0; this.rest = false;
    this.falling2 = { y: this.group.position.y, v: 0 };
    this.solid.bottom = this.solid.top = -1e6;   // (gone from under your feet)
    this.rt.sound?.critter?.('clack', 0.8);
  }
  throughHole(dt) {
    const F = this.falling2;
    F.v += 18 * dt; F.y -= F.v * dt;
    this.spin.rotateOnWorldAxis(this.axis, F.v * dt / this.r * 0.3);
    if (F.y <= this.below.y) {
      this.falling2 = null; this.fell = true; this.rest = true;
      this.place();
      this.rt.logic.moveDrum(this.id, 1);
      this.rt.sound?.critter?.('clack', 1); this.rt.sound?.chime?.(); this.rt.rumble?.(1.2, 0.35);
      this.rt.notice?.(this.o.hole.fell ?? 'The sphere drops through the floor. Far below, something settles.', `${this.id}.fell`);
      return;
    }
    this.place();
    this.solid.bottom = this.solid.top = -1e6;
  }
  /** The stones went from under it: it falls into the chasm, and a new one rolls out where the groove starts. */
  startDrop() {
    this.drop = { y: 0, v: 0, back: 0 };
    this.v = 0; this.solid.vel.set(0, 0, 0);
    this.rt.sound?.critter?.('clack', 0.7);
    this.rt.notice?.(this.o.dropped ?? 'The ball drops into the chasm. Another rolls out of the wall where the groove begins.', `${this.id}.dropped`);
  }
  falling(dt) {
    const D = this.drop;
    if (D.back > 0) {
      // the new ball, rolling out of its niche
      D.back = Math.max(0, D.back - dt);
      this.spin.scale.setScalar(1 - D.back / 1.2 * 0.9);
      if (D.back === 0) { this.drop = null; this.spin.scale.setScalar(1); this.rest = true; }
      return;
    }
    D.v += 18 * dt; D.y += D.v * dt;
    this.group.position.y -= D.v * dt;
    this.solid.bottom = this.solid.top = -1e6;   // (gone: nothing to stand on)
    if (D.y > 14) { this.t = 0; this.rt.logic.moveDrum(this.id, 0); this.place(); D.back = 1.2; this.spin.scale.setScalar(0.1); }
  }
  dispose() { this.off?.(); this.offIron?.(); for (const f of this.offs ?? []) f?.(); }
}

// ---------------------------------------------------------------------------------------- fire
export class Brazier {
  /**
   * o: { id, at, scale, tripod (a tall bronze stand of three legs round its stem), hood: { ball, yaw, said, cold }
   * (a hooded bowl, the Rose House: a stone hood over it with a low mouth on its groove, facing `yaw`; no ember
   * glob reaches the coals, only the tar ball `ball` rolled burning into its mouth (at rest on its plate) lights it;
   * cold, the mouth tips the ball back out) }. Lit, it is a `fire` a tar ball rolled past it catches from.
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, s = o.scale ?? 1;
    this.pos = K.world(...o.at);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.group.rotation.y = K.heading(o.hood?.yaw ?? 0);
    rt.root.add(this.group);
    // (a house in a skin may draw its own brazier over the same fire and logic: src/temples/skins/)
    const skinned = !!rt.skin?.brazier?.(this, s);
    const bowl = lathe([[0.25, 0], [0.5, 0.15], [0.9, 0.55], [1.1, 0.95], [1.0, 1.0], [0.75, 0.62], [0.2, 0.55]].map(([r, y]) => [r * s, y * s + 1.1 * s]), 18);
    if (!skinned) this.group.add(mesh([lathe([[0.7, 0], [0.7, 0.2], [0.35, 0.4], [0.3, 1.15], [0.5, 1.2]].map(([r, y]) => [r * s, y * s]), 14), bowl], M.trimMat));
    if (o.tripod && !skinned) {
      // three bronze legs splayed round the stem, a ring binding them under the bowl (the cistern's, as drawn)
      const bronze = own({ color: '#b08a4a', flat: true }), legs = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2, foot = V(Math.sin(a) * 0.95 * s, 0, Math.cos(a) * 0.95 * s), top = V(Math.sin(a) * 0.45 * s, 1.15 * s, Math.cos(a) * 0.45 * s);
        legs.push(new THREE.TubeGeometry(new THREE.LineCurve3(foot, top), 1, 0.07 * s, 5));
      }
      legs.push(T(new THREE.TorusGeometry(0.55 * s, 0.05 * s, 4, 16), [0, 0.75 * s, 0], [Math.PI / 2, 0, 0]));
      this.group.add(mesh(legs, bronze));
    }
    if (o.hood && !skinned) {
      // the hood: a stone cap over the bowl, open only on its mouth side (+z), where the groove comes in low
      this.group.add(mesh([T(new THREE.SphereGeometry(1.25 * s, 16, 8, Math.PI * 0.75, Math.PI * 1.5, 0.45, Math.PI / 2 - 0.45), [0, 1.62 * s, 0]),
        T(new THREE.CylinderGeometry(1.3 * s, 1.3 * s, 0.25, 16, 1, false, Math.PI * 0.25, Math.PI * 1.5), [0, 1.62 * s, 0])], M.stoneMat));
      this.group.add(mesh([T(glyphGeometry(0.8 * s, 0.05), [0, 2.35 * s, -0.95 * s], [0, Math.PI, 0])], M.trimMat));
    }
    this.coals = own({ color: '#5a4a40', glow: 0, flat: true });
    this.group.add(mesh([T(new THREE.CylinderGeometry(0.75 * s, 0.6 * s, 0.12, 14), [0, 1.62 * s, 0])], this.coals));
    noCollide(this.group);
    this.top = 1.66 * s;
    this.center = this.pos.clone().addScaledVector(UP, 1.6 * s);
    this.off = registerTarget({
      kind: 'flammable', flammable: 'brazier', radius: 1.0 * s, accepts: ['fire'], position: () => this.center,
      onHit: (mode) => this.hit(mode),
    });
    this.wait = 0;
    this.fireReach = o.fireReach ?? 2.0;   // (m, level: how near a tar ball rolls past its flame to catch)
    if (rt.logic.isLit(o.id)) this.ignite(true);
  }
  /** Lit: where its flame is, for a tar ball rolled past it (pieces.js Ball `tar`). */
  get fire() { return this.flames ? this.center : null; }
  hit(mode) {
    const L = this.rt.logic;
    if (L.isLit(this.id)) return true;
    if (this.o.hood) { if (mode === 'fire') this.rt.notice?.(this.o.hood.said ?? 'The ember spatters on the stone hood. Its mouth opens low, on the groove: only something burning rolled into it would reach the coals.', `hood.${this.id}`); return true; }
    if (mode !== 'fire') { this.rt.notice?.('The bowl is cold, and dry. It wants fire.', `cold.${this.id}`); return true; }
    if (L.light(this.id)) { this.ignite(false); this.rt.onLit?.(this.id); }
    return true;
  }
  /** A hooded bowl: is its tar ball at rest in its mouth? Burning, it lights the bowl; cold, it is tipped back out. */
  hooded(dt) {
    const L = this.rt.logic, H = this.o.hood, b = this.rt.piece(H.ball);
    if (!b || L.isLit(this.id)) return;
    const plate = H.plate ?? L.el(b.id)?.plate, stop = stopOf(L.el(b.id), plate);
    // (burning, it lights the coals as it rolls in slow, where it is now, not where it last lay; cold, it is tipped back
    // once it lies there)
    if (!b.drop && b.burn > 0 && Math.abs(b.v) < 0.8 && stop != null && Math.abs(b.t - stop) <= (L.el(b.id)?.tolerance ?? 0.06)) {
      L.moveDrum(b.id, b.t);
      if (L.light(this.id)) { this.ignite(false); this.rt.onLit?.(this.id); }
      return;
    }
    const home = b.rest && !b.drop && L.drumOn(b.id, plate);
    if (!home) { this.wait = 0; return; }
    if (b.burn > 0) {
      if (L.light(this.id)) { this.ignite(false); this.rt.onLit?.(this.id); }
      return;
    }
    if ((this.wait += dt) > 1.2) {
      this.wait = 0;
      this.rt.notice?.(H.cold ?? 'The ball rolls into the bowl’s mouth cold, and the mouth tips it back out. It wants fire.', `hoodcold.${this.id}`);
      b.tipBack();
    }
  }
  ignite(instant) {
    if (this.flames) return;
    this.flames = new Flames(this.group, [{ at: V(0, this.top, 0), h: 1.6, r: 0.45 }, { at: V(0.25, this.top, 0.1), h: 1.1, r: 0.3, phase: 2 }, { at: V(-0.2, this.top, -0.15), h: 1.25, r: 0.3, phase: 4 }, { at: V(0, this.top, 0), h: 0.8, r: 0.2, core: 1, phase: 1 }], { seed: this.id.length * 3 });
    this.flames.mesh.userData.dynamic = true;   // (moved every frame: no levels of detail, src/lod.js)
    this.coals.uniforms.uColor.value.set('#e0644a'); this.coals.uniforms.uGlow.value = 0.8;
    this.rt.skin?.lit?.(this);
    this.light = new THREE.Vector4(this.pos.x, this.pos.y + this.top + 0.8, this.pos.z, 14);
    this.rt.lights.push(this.light);
    if (!instant) { this.rt.sound?.whoosh?.(); this.rt.sound?.chime?.(); }
  }
  update(dt, t) { if (this.o.hood) this.hooded(dt); this.flames?.update(dt, t); }
  dispose() { this.off?.(); }
}

/**
 * The Givers' pilot flame: a fire that never went out, in a stone ring sunk in the floor; a tar ball rolled through it
 * catches. o: { at, r, when (a condition: it burns only while that holds, under a stone lid till then), lid (draw the lid) }
 */
export class Flame {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    this.when = o.when ?? null;
    const K = rt.kit, M = rt.M, r = o.r ?? 0.9;
    this.pos = K.world(...o.at);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    rt.root.add(this.group);
    this.group.add(mesh([T(annulus(r, r + 0.35, 0.16, 20), [0, 0.02, 0])], M.trimMat));
    const coals = own({ color: '#e0644a', glow: 0.8, flat: true });
    this.group.add(mesh([T(new THREE.CircleGeometry(r, 16).rotateX(-Math.PI / 2), [0, 0.06, 0])], coals));
    noCollide(this.group);
    this.flames = new Flames(this.group, [{ at: V(0, 0.05, 0), h: 1.7, r: 0.5 }, { at: V(0.3, 0.05, 0.15), h: 1.1, r: 0.3, phase: 2 }, { at: V(-0.28, 0.05, -0.2), h: 1.25, r: 0.3, phase: 4 }, { at: V(0, 0.05, 0), h: 0.9, r: 0.22, core: 1, phase: 1 }], { seed: 17 });
    this.flames.mesh.userData.dynamic = true;
    this.center = this.pos.clone().addScaledVector(UP, 0.9);
    this.fireReach = r + 0.9;
    this.light = new THREE.Vector4(this.pos.x, this.pos.y + 1.6, this.pos.z, 12);
    rt.lights.push(this.light);
    if (o.lid) {
      // a stone lid over the ring (the Hall of Winds' relay): it slides off when `when` holds
      this.lid = new THREE.Group();
      this.lid.add(mesh([T(new THREE.CylinderGeometry(r + 0.3, r + 0.35, 0.22, 16), [0, 0.13, 0])], M.stoneMat));
      this.group.add(this.lid);
      noCollide(this.lid);
    }
    this.k = this.burning ? 1 : 0;
    this.show();
  }
  /** It burns now (always, or while its `when` holds). */
  get burning() { return !this.when || !!this.rt.logic?.check(this.when); }
  /** Lit: where its flame is, for a tar ball rolled past it (Ball `tar`). */
  get fire() { return this.burning ? this.center : null; }
  show() {
    this.flames.mesh.visible = this.k > 0.5;
    this.light.w = this.k > 0.5 ? 12 : 0;
    if (this.lid) { this.lid.position.set(Math.min(1, this.k) * ((this.o.r ?? 0.9) * 2.4), 0, 0); this.lid.rotation.z = -0.12 * this.k; }
  }
  update(dt, t) {
    const want = this.burning ? 1 : 0;
    if (this.k !== want) { this.k = THREE.MathUtils.clamp(this.k + (want ? dt / 0.9 : -dt), 0, 1); this.show(); if (want && this.k >= 1) this.rt.sound?.whoosh?.(); }
    if (this.k > 0.5) this.flames.update(dt, t);
  }
}

export class Bramble {
  /** o: { id, at: [x, y, z] the opening's foot, yaw, w, h } */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id;
    const K = rt.kit, w = o.w ?? 4, h = o.h ?? 4;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    let s = (o.seed ?? 7) * 9301 + 49297;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const parts = [];
    for (let i = 0; i < 26; i++) {
      const pts = [];
      let x = (rnd() - 0.5) * w, y = rnd() * 0.4, z = (rnd() - 0.5) * 0.8;
      for (let j = 0; j < 6; j++) { pts.push(V(x, y, z)); x = THREE.MathUtils.clamp(x + (rnd() - 0.5) * 1.6, -w / 2, w / 2); y = Math.min(h, y + 0.3 + rnd() * 0.8); z = THREE.MathUtils.clamp(z + (rnd() - 0.5) * 0.7, -0.6, 0.6); }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.05 + rnd() * 0.04, 4));
    }
    this.mat = own({ color: '#9a7448', flat: true });
    this.tangle = mesh(parts, this.mat);
    this.group.add(this.tangle);
    noCollide(this.group);
    this.block = new THREE.Mesh(box(w, h, 1.2, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.center = this.group.position.clone().addScaledVector(UP, h * 0.45);
    this.burnt = rt.logic.isLit(o.id);
    this.k = this.burnt ? 1 : 0;
    this.tangle.visible = !this.burnt;
    // (burning: the world's chemistry, src/chemistry.js, lets its fire reach the next bramble in the room)
    this.cut = !!o.cut;
    this.off = registerTarget({ kind: 'flammable', flammable: 'bramble', radius: Math.max(w, h) * 0.45, accepts: o.cut ? ['fire', 'blade'] : ['fire'], position: () => this.center, enabled: () => !this.burnt, burning: () => !!this.flames && this.burning < 2.2, onHit: (mode) => this.hit(mode) });
    this.h = h; this.w = w;
    // thorns prick: push into them and they push you back off (you can't climb a tangle of wire)
    const inv = this.group.matrixWorld.clone(), _l = V();
    this.group.updateMatrixWorld(true); inv.copy(this.group.matrixWorld).invert();
    const back = V(0, 0, -1).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
    this.offHazard = registerHazard({
      kind: 'spikes', dps: HAZARD_DPS.spikeRow,
      test: (p) => { if (this.burnt) return false; _l.copy(p).applyMatrix4(inv); return Math.abs(_l.x) < w / 2 + 0.2 && _l.y > -1.6 && _l.y < h && Math.abs(_l.z) < 1.4; },
      push: (p, out) => out.copy(back),
    });
  }
  init(physics) { this.physics = physics; if (!this.burnt) this.handle = physics.addCollider?.(this.block, NO_CLIMB) ?? null; }
  hit(mode) {
    if (this.burnt) return false;
    if (mode === 'blade' && this.cut) {
      // cut: the tangle falls apart where it stood, no fire (the element's `needs`: the sword)
      if (!this.rt.logic.light(this.id)) return true;
      this.rt.onLit?.(this.id);
      this.burnt = true; this.burning = 0; this.felled = true;
      this.rt.sound?.critter?.('creak', 0.9); this.rt.sound?.whoosh?.();
      if (this.handle) { this.physics?.removeCollider?.(this.handle); this.handle = null; }
      return true;
    }
    if (mode !== 'fire') { this.rt.notice?.(this.cut ? 'Dry thorns, as hard as wire. A blade would go through them.' : 'Dry thorns, as hard as wire. Fluid only beads on them.', 'thorns'); return true; }
    if (!this.rt.logic.light(this.id)) return true;
    this.rt.onLit?.(this.id);
    this.burnt = true; this.burning = 0;
    this.flames = new Flames(this.group, [-1, -0.3, 0.4, 1].map((f, i) => ({ at: V(f * this.w * 0.35, 0, 0), h: this.h * 0.8, r: 0.6, phase: i * 1.3 })), { seed: 11 });
    this.flames.mesh.userData.dynamic = true;
    this.rt.sound?.whoosh?.();
    if (this.handle) { this.physics?.removeCollider?.(this.handle); this.handle = null; }
    return true;
  }
  update(dt, t) {
    if (this.felled && this.tangle.visible) {
      // (cut: it slumps and goes in a second, no flames)
      this.burning += dt;
      const k = Math.min(1, this.burning / 0.9);
      this.tangle.scale.set(1 + 0.15 * k, Math.max(0.02, 1 - k), 1);
      if (k >= 1) this.tangle.visible = false;
      return;
    }
    if (this.burning === undefined || !this.flames) return;
    this.burning += dt;
    this.flames.update(dt, t);
    this.flames.intensity = Math.max(0.2, 1.6 - this.burning * 0.6);
    const k = Math.min(1, this.burning / 2.2);
    this.tangle.scale.set(1, 1 - 0.9 * k, 1);
    this.mat.uniforms.uColor.value.set('#9a7448').lerp(new THREE.Color('#2f2830'), k);
    if (this.burning > 2.6) { this.flames.mesh.removeFromParent(); this.flames = null; this.tangle.visible = false; }
  }
  dispose() { this.off?.(); this.offHazard?.(); }
}

// ---------------------------------------------------------------------------------------- switches
export class Switch {
  /**
   * o: { id, at, yaw (the way it faces), size, crystal?: height, wrong?: text }: a carved eye that a splash of
   * fluid wakes. crystal: a singing crystal standing on the floor instead (its foot at `at`, this tall).
   * wrong: said when a splash does not wake it (it comes `after` another: logic.js). lids: stone lids over the eye,
   * shut while its element's `when` fails (it can't wake now). blade: a struck eye (the Rose House): only a cut of the
   * sword wakes it (its element `needs: ['sword']`). pull: a moorers' ring (the City Floating in Space's
   * Mooring-House) instead of an eye: a brass ring on a post that only a tether wakes (its element `needs: ['tether']`);
   * a splash or a push only rings it (o.wrong or its own line).
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, s = o.size ?? 1.4;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.08, flat: true });
    if (o.crystal) {
      // a crystal of the swamp's groves on a ring of stone: it rings when it wakes
      const h = o.crystal;
      this.group.add(mesh([lathe([[s * 1.3, 0], [s * 1.3, 0.35], [s * 1.0, 0.5], [0.01, 0.5]], 12)], M.trimMat));
      this.group.add(mesh([T(new THREE.OctahedronGeometry(1, 0), [0, 0.5 + h / 2, 0], [0, 0.4, 0], [s * 0.7, h / 2, s * 0.7]), T(new THREE.OctahedronGeometry(1, 0), [s * 0.55, 0.5 + h * 0.25, 0.1], [0, 0, -0.35], [s * 0.35, h * 0.24, s * 0.35])], this.glow));
      this.center = this.group.position.clone().add(V(0, 0.5 + h / 2, 0));
    } else if (o.pull) {
      // a moorers' ring: a heavy brass ring standing out from a plate on the wall, its eye glowing in the middle
      this.group.add(mesh([T(new THREE.CylinderGeometry(s * 0.7, s * 0.7, 0.3, 20), [0, 0, 0], [Math.PI / 2, 0, 0]), T(new THREE.BoxGeometry(0.3, 0.3, s * 0.7), [0, 0, s * 0.35])], M.trimMat));
      this.group.add(mesh([T(new THREE.TorusGeometry(s * 0.75, s * 0.14, 8, 28), [0, 0, s * 0.75])], own({ color: '#d8a24a', flat: true, metal: 'brass' })));
      this.group.add(mesh([T(new THREE.SphereGeometry(s * 0.3, 12, 8).scale(1, 1, 0.5), [0, 0, 0.2])], this.glow));
      this.center = this.group.position.clone().add(new THREE.Vector3(0, 0, s * 0.6).applyQuaternion(this.group.quaternion));
    } else {
      this.group.add(mesh([T(new THREE.CylinderGeometry(s, s, 0.4, 24), [0, 0, 0], [Math.PI / 2, 0, 0])], M.trimMat));
      this.group.add(mesh([T(new THREE.SphereGeometry(s * 0.55, 16, 10).scale(1, 0.6, 0.35), [0, 0, 0.2]), T(glyphGeometry(s * 1.3, 0.06), [0, 0, 0.24])], this.glow));
      this.center = this.group.position.clone();
      if (o.lids) {
        // lids of stone over the eye (the Warden's Well): shut while its element's `when` fails, so you can see from
        // across the room whether it can wake now
        this.lids = [-1, 1].map((sd) => {
          const g = new THREE.Group();
          g.add(mesh([T(new THREE.CylinderGeometry(s * 0.9, s * 0.9, 0.12, 20, 1, false, sd > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI), [0, 0, 0.36], [Math.PI / 2, 0, 0])], M.trimMat));
          this.group.add(g);
          return { g, sd };
        });
        this.lidK = this.lidsOpen() ? 1 : 0;
      }
    }
    noCollide(this.group);
    this.on = rt.logic.isLit(o.id);
    this.hidden = !!o.hidden;
    const seen = () => shown(rt, o, this.center);
    this.off = registerTarget({ kind: 'switch', radius: o.crystal ? Math.max(s, o.crystal * 0.45) : s, position: () => this.center, enabled: seen, accepts: o.pull ? ['tether'] : o.blade ? ['blade'] : undefined, onHit: (mode) => this.hit(mode) });
    // (o.light: a pool-lamp, the Lamp-House's: lit, a light a bubble may take, src/carried-light.js, issue #377)
    if (o.light) this.offLight = registerLight({ position: () => this.center, radius: o.light === true ? CARRY.radius : o.light, enabled: () => this.on });
    this.seen = seen;
    this.flash = 0;
  }
  /** A splash (any mode: it is fluid) wakes it; a moorers' ring (o.pull) only a tether's pull. */
  hit(mode) {
    // a struck eye (o.blade, the Rose House): only the sword's cut wakes it; a splash only wets the stone
    if (this.o.blade && mode !== 'blade') {
      if (!this.on) { this.flash = 0.4; this.rt.notice?.(this.o.wrong ?? 'The eye is cut in hard stone, and rings when you knock on it. It wants striking.', `wrong.${this.id}`); }
      return true;
    }
    if (this.o.pull && mode !== 'tether') {
      if (!this.on) { this.flash = 0.6; this.rt.sound?.critter?.('clank', 0.5); this.rt.notice?.(this.o.wrong ?? 'The ring clanks on its post and hangs still. It wants pulling, not wetting.', `wrong.${this.id}`); }
      return true;
    }
    if (this.rt.logic.light(this.id)) { this.on = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
    // (its `when` fails: what it waits on, `unmet`, the Clock-House's Cupboard, its clock stopped till the mainspring runs;
    // a function says which of its waits it is, each once: the Cupboard's, the mainspring or the hour, issue #414)
    else if (!this.on && this.o.unmet && !this.rt.logic.check(this.rt.logic.el(this.id)?.when)) { this.flash = 0.6; const u = unmetOf(this.o); this.rt.notice?.(u, typeof this.o.unmet === 'function' ? `unmet.${this.id}.${u}` : `unmet.${this.id}`); }
    else if (!this.on && this.o.wrong) { this.flash = 0.6; this.rt.sound?.critter?.('blip', 0.5); this.rt.notice?.(this.o.wrong, `wrong.${this.id}`); }
    return true;
  }
  /** Its lids are up: it is awake, or its `when` holds (it could wake now). */
  lidsOpen() { const L = this.rt.logic; return L.isLit(this.id) || L.check(L.el(this.id)?.when); }
  update(dt, t) {
    this.on ||= this.rt.logic.isLit(this.id);
    this.group.visible = this.seen();
    if (this.lids) {
      this.lidK = THREE.MathUtils.clamp(this.lidK + (this.lidsOpen() ? dt / 0.5 : -dt / 0.7), 0, 1);
      for (const l of this.lids) l.g.position.y = l.sd * ease(this.lidK) * (this.o.size ?? 1.4) * 1.05;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.glow.uniforms.uGlow.value = this.on ? 0.8 + 0.2 * Math.sin(t * 2.5) : 0.08 + 0.05 * Math.sin(t * 1.3) + this.flash * 0.6;
  }
  dispose() { this.off?.(); this.offLight?.(); }
}

/**
 * A bank of eyes (o.eyes: [{ at, yaw }]) that wake only together: splash every one inside `window` seconds
 * of the first and the element `id` is lit for good; too slow, and they all go dark again. Four eyes and a
 * window shorter than the tank's refill: it wants the fourth chamber (src/items.js 'cell'). Six eyes and a
 * window a little longer than one refill: it wants the quick coil ('coil': two tanks in one breath).
 * o.full: said when every eye woke but the element's item is missing; o.fade: said once when some woke and
 * all went dark again before the rest. o.order: the eyes' indices in the order they must wake (the First
 * Garage's clock, counted round from the hour it stopped): an eye out of turn puts them all out (o.wrong).
 */
export class Bank {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o; this.window = o.window ?? 2.6;
    const K = rt.kit, M = rt.M, s = o.size ?? 0.9;
    this.eyes = o.eyes.map((e, i) => {
      const g = new THREE.Group();
      g.position.copy(K.world(...e.at));
      g.rotation.y = K.heading(e.yaw ?? 0);
      rt.root.add(g);
      g.add(mesh([T(new THREE.CylinderGeometry(s, s, 0.4, 20), [0, 0, 0], [Math.PI / 2, 0, 0])], M.trimMat));
      const glow = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.06, flat: true });
      g.add(mesh([T(new THREE.SphereGeometry(s * 0.55, 14, 8).scale(1, 1, 0.35), [0, 0, 0.2])], glow));
      noCollide(g);
      const eye = { g, glow, at: -1e9, center: g.position.clone(), base: g.position.clone(), piston: e.piston ?? null, k: 1 };
      if (e.piston) {
        // a piston under the eye (the Engine-House's furnace): it rises over the parapet in its turn of the stroke
        const rod = e.piston.rod ?? 6;
        g.add(mesh([T(new THREE.CylinderGeometry(0.62, 0.62, rod, 14), [0, -rod / 2 - s * 0.6, -0.25]), T(new THREE.CylinderGeometry(s + 0.15, s + 0.15, 0.5, 18), [0, -s - 0.1, -0.25])], M.stoneMat));
        eye.k = 0;
      }
      eye.off = registerTarget({ kind: 'switch', radius: s, position: () => eye.center, enabled: () => eye.k > 0.85, onHit: () => this.hit(i) });
      return eye;
    });
    this.done = rt.logic.isLit(o.id);
    this.time = 0;
  }
  /** An eye on a piston is up (in its turn of the stroke, or held up by its jam), so it can be hit. */
  isUp(i) { return this.eyes[i].k > 0.85; }
  hit(i) {
    if (this.done) return true;
    const e = this.eyes[i];
    if (!this.isUp(i)) return true;   // (sunk behind the parapet)
    if (this.o.order) {
      // in turn (o.order: the eyes' indices in the order they must wake; or a function that says it now, the Clock-House's
      // gallery counted from the house's hour, issue #414): out of turn, every eye goes dark
      if (this.time - e.at <= this.window) return true;   // (awake already: a second splash changes nothing)
      const order = typeof this.o.order === 'function' ? this.o.order() : this.o.order;
      if (i !== order[this.seq ?? 0]) {
        for (const x of this.eyes) x.at = -1e9;
        this.seq = 0;
        this.rt.sound?.critter?.('clack', 0.8);
        this.rt.notice?.(this.o.wrong ?? 'The eyes ring out of step, and all go dark.', `bank.wrong.${this.id}`);
        return true;
      }
      if (!this.seq) this.first = this.time;
      this.seq = (this.seq ?? 0) + 1;
    }
    e.at = this.time;
    this.rt.sound?.critter?.('blip', 0.8);
    if (this.eyes.every((x) => this.time - x.at <= this.window)) {
      const L = this.rt.logic;
      if (L.light(this.id)) { this.done = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); if (this.o.woke) this.rt.notice?.(this.o.woke, `bank.woke.${this.id}`); }
      else if (this.o.unmet && !L.check(L.el(this.id)?.when)) { const u = unmetOf(this.o); this.rt.notice?.(u, typeof this.o.unmet === 'function' ? `bank.unmet.${this.id}.${u}` : `bank.unmet.${this.id}`); }
      else this.rt.notice?.(this.o.full ?? 'All four woke, and went dark again: the bank wants more than this tank can hold in one breath.', `bank.${this.id}`);
    }
    return true;
  }
  /** How many eyes are awake now (inside the window). */
  awake() { return this.eyes.filter((x) => this.time - x.at <= this.window).length; }
  update(dt, t) {
    this.time += dt;
    this.done ||= this.rt.logic.isLit(this.id);
    // some woke, and all went dark again before the rest: say why, once
    const n = this.done ? 0 : this.awake();
    if (this.seq && this.time - this.first > this.window) { this.seq = 0; for (const x of this.eyes) x.at = -1e9; }   // (in turn: the first faded, start again)
    if (this.o.fade && this.was >= 2 && n === 0) this.rt.notice?.(this.o.fade, `bank.fade.${this.id}`);
    this.was = n;
    // eyes on pistons: each up in its turn of the stroke (o.stroke: { period, up }; its piston's phase), or held up
    // by its jam (a condition: a ball in its crank), and all up once the bank has woken
    // (o.drive: a condition the stroke needs, the shaft that drives them turning: the Engine-House's power, issue #415;
    // undriven, they rest down, but for a jam that holds them)
    const St = this.o.stroke, driven = !this.o.drive || this.rt.logic.check(this.o.drive);
    for (const e of this.eyes) {
      if (!e.piston) continue;
      const turn = St ? driven && ((((this.time / St.period - (e.piston.phase ?? 0)) % 1) + 1) % 1) * St.period < St.up : true;
      const want = this.done || turn || (!!e.piston.jam && this.rt.logic.check(e.piston.jam)) ? 1 : 0;
      e.k += (want - e.k) * Math.min(1, dt * 9);
      e.g.position.copy(e.base).addScaledVector(UP, -(1 - e.k) * (e.piston.drop ?? 3));
      e.center.copy(e.g.position);
    }
    for (const e of this.eyes) {
      const lit = this.done || this.time - e.at <= this.window;
      e.glow.uniforms.uGlow.value = lit ? (this.done ? 0.85 : 0.55 + 0.4 * Math.max(0, 1 - (this.time - e.at) / this.window)) : 0.06 + 0.04 * Math.sin(t * 1.5);
    }
  }
  dispose() { for (const e of this.eyes) e.off?.(); }
}

/** Bell-tuned: a bell's note within reach rings element `id` (a 'bell' element: needs what rings it).
 * o: { id, at, reach, heard (what it says when it answers), heardKey (say it once), fading (said as a held note fades),
 *      struck (true: only a bell struck, a clapper's blow or a HookBell tugged by the grappling hook, not the bell-note
 *      whistle: the Founders' Belfry since issue #377) }
 * A held bell (its element has `hold: s`, logic.js) rings for s seconds and falls quiet: what it holds lets go
 * (a held door shuts, held stones rise). Sounded again while it rings, the note starts over. */
export class BellEar {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o; this.at = rt.kit.world(...o.at); this.reach = o.reach ?? 40;
    this.hold = rt.logic.el?.(o.id)?.hold ?? 0;
    this.left = 0;
    this.off = rt.game?.on?.('bell', ({ pos, soft, struck } = {}) => {
      if (!pos || soft || pos.distanceTo(this.at) > this.reach) return;   // (soft: the listening shell's hum, not a bell)
      if (o.struck && !struck) return;   // (the whistle: a charm that finds chests, not a founders' bell)
      if (this.hold && rt.logic.isLit(this.id)) { this.left = this.hold; this.warned = false; return; }   // (rung again: the note starts over)
      if (rt.logic.light(this.id)) {
        if (this.hold) { this.left = this.hold; this.warned = false; }
        rt.sound?.chime?.(); rt.notice?.(o.heard ?? 'The door answers the bell’s note.', o.heardKey ?? null); rt.onLit?.(this.id);
      }
    });
  }
  /** Seconds left of a held note (0: quiet). */
  get ringing() { return this.left; }
  update(dt) {
    if (!this.hold || this.left <= 0) return;
    this.left -= dt;
    if (this.left < 2.5 && !this.warned) { this.warned = true; this.rt.rumble?.(0.8, 0.2); if (this.o.fading) this.rt.notice?.(this.o.fading, `${this.o.heardKey ?? this.id}.fading`); }
    if (this.left <= 0) { this.left = 0; this.rt.logic.quiet(this.id); }
  }
  dispose() { this.off?.(); }
}

/**
 * A founders' bell's pull ring (the Founders' Belfry, issue #377: the grappling hook rings the bells). A heavy brass ring
 * on a short chain under a bell's lip (or on its crown), drawn as the Gadget Yard draws the hook's rings (a brass ring
 * round a red heart), so it reads as something to hook. The hook's bite tugs it (src/gadgets/hook.js: a target's onHit
 * with mode 'hook'): the bell swings and booms, a game 'bell' event at the ring marked `struck`, which the house's
 * BellEars and its guardian hear. Nothing else rings it: a splash or a push only rocks it a little.
 * o: { id, at (the ring's middle, local), chain (m of chain over it: 0 none), yaw (the way the ring faces, local),
 *      size (the ring's radius, m; 0.5) }
 */
export class HookBell {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, r = o.size ?? 0.5, chain = o.chain ?? 0.8;
    this.at = K.world(...o.at);
    this.center = this.at;
    this.group = new THREE.Group();
    this.group.position.copy(this.at);
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    const brass = own({ color: '#d6a94a', flat: true, metal: 'brass', refl: 0.4 });
    const red = own({ color: '#c8483a', flat: true, glow: 0.12 });
    // (the ring swings from the top of its chain: the pivot r + chain over its middle)
    this.loop = new THREE.Group();
    this.loop.position.y = r + chain;
    this.loop.add(mesh([T(new THREE.TorusGeometry(r, r * 0.17, 8, 24), [0, -r - chain, 0])], brass));
    this.loop.add(mesh([T(new THREE.CircleGeometry(r * 0.45, 14), [0, -r - chain, 0.02]), T(new THREE.CircleGeometry(r * 0.45, 14), [0, -r - chain, -0.02], [0, Math.PI, 0])], red));
    if (chain > 0) this.loop.add(mesh([T(new THREE.CylinderGeometry(0.06, 0.06, chain, 6), [0, -chain / 2, 0])], M.trimMat));
    this.group.add(this.loop);
    noCollide(this.group);
    this.swing = 0; this.wob = 0; this.time = 0;
    this.off = registerTarget({ kind: 'bell', radius: Math.max(0.8, r * 1.6), position: () => this.at, enabled: () => this.group.visible, onHit: (mode, point, dir, info) => this.hit(mode, info) });
  }
  hit(mode, info = {}) {
    if (info?.mode !== 'hook') { this.wob = Math.max(this.wob, 0.25); return true; }   // (a splash rocks it; only a tug rings the bell)
    this.ring();
    return true;
  }
  /** Tugged: the bell swings and booms (a 'bell' event at the ring, struck). */
  ring() {
    this.swing = 1;
    this.rt.sound?.chime?.();
    this.rt.rumble?.(0.35, 0.15);
    this.rt.game?.emit?.('bell', { pos: this.at.clone(), struck: true, by: this.id });
  }
  update(dt) {
    this.time += dt;
    this.swing = Math.max(0, this.swing - dt * 0.45);
    this.wob = Math.max(0, this.wob - dt * 0.8);
    this.loop.rotation.z = Math.sin(this.time * 7) * (this.swing * 0.35 + this.wob * 0.15);
  }
  dispose() { this.off?.(); }
}

/**
 * A makers' hook ring (issue #432): in a house the grappling hook takes no bare stone, only what the house set there for it,
 * and this is the one that reels you. A brass ring round a red heart on a short stub, drawn as the Gadget Yard draws the
 * hook's rings, facing the way you would hook it from; it joins the house's anchors (`rt.hookAnchors`, which the hook's
 * aim finds: src/gadgets/hook.js houseAnchors), and tests/hook-reach.test.js checks that none of them crosses a lock.
 * o: { id, at (the ring's middle, local), yaw (the way it faces, local), tilt (radians up), room }
 */
export class HookRing {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, yaw = o.yaw ?? 0, tilt = o.tilt ?? 0;
    this.at = K.world(...o.at);
    const ahead = K.world(o.at[0] + Math.sin(yaw) * Math.cos(tilt), o.at[1] + Math.sin(tilt), o.at[2] + Math.cos(yaw) * Math.cos(tilt));
    this.group = new THREE.Group();
    this.group.position.copy(this.at);
    this.group.rotation.set(-tilt, K.heading(yaw), 0, 'YXZ');
    const brass = own({ color: '#d6a94a', flat: true, metal: 'brass', refl: 0.4 });
    const red = own({ color: '#c8483a', flat: true, glow: 0.12 });
    this.group.add(mesh([T(new THREE.TorusGeometry(0.36, 0.075, 8, 22))], brass));
    this.group.add(mesh([T(new THREE.CircleGeometry(0.2, 14), [0, 0, 0.01])], red));
    this.group.add(mesh([T(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 8), [0, 0, -0.16], [Math.PI / 2, 0, 0])], M.trimMat));
    noCollide(this.group);
    rt.root.add(this.group);
    this.anchor = { pos: this.at, normal: ahead.sub(this.at).normalize(), radius: 0.4, room: o.room ?? null, id: o.id, enabled: () => this.group.visible };
    (rt.hookAnchors ??= []).push(this.anchor);
  }
  dispose() { const a = this.rt.hookAnchors, i = a?.indexOf(this.anchor) ?? -1; if (i >= 0) a.splice(i, 1); }
}

/**
 * A lamp's glass: it wakes to the lantern charm's light: stand by it (within `reach`) with the lantern a moment (`hold` s), and
 * element `id` (a 'switch' that needs the lantern) is lit for good. o: { id, at, reach, hold, carried, hang, heard }. reach 0: only
 * something else wakes it (a Ball's `lamp`, the pool-orb); it glows once its element is lit. `carried` (issue #377, the
 * Lamp-House: its tool is the bubble wand): no lantern wakes it, a glowing bubble burst within CARRY.reach of its glass does
 * (src/carried-light.js), and lit it is a light a bubble may take. `hang`: its glass hangs on a chain `hang` m long (over a
 * chasm), not over a post.
 */
export class LightEar {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o; this.at = rt.kit.world(...o.at); this.reach = o.reach ?? 3.5; this.hold = o.hold ?? 1.5;
    this.t = 0;
    this.glow = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.05, flat: true });
    const m = mesh([T(new THREE.SphereGeometry(0.5, 14, 10), [0, 0, 0])], this.glow);
    m.position.copy(this.at).add(V(0, 2.8, 0));
    this.glass = m.position;
    noCollide(m);
    rt.root.add(m);
    if (o.hang) { const c = mesh([T(new THREE.CylinderGeometry(0.05, 0.05, o.hang, 6), [0, 0.5 + o.hang / 2, 0])], rt.M.trimMat); c.position.copy(m.position); noCollide(c); rt.root.add(c); }
    this.lit = rt.logic.isLit(o.id);
    if (o.carried) {
      this.offs = [rt.game?.on?.('bubble:light', ({ pos } = {}) => {
        if (this.lit || !pos || pos.distanceTo(this.glass) > (o.carried === true ? CARRY.reach : o.carried)) return;
        if (rt.logic.light(this.id)) { this.lit = true; rt.sound?.chime?.(); rt.onLit?.(this.id); rt.notice?.(o.heard ?? 'The bubble bursts on the lamp’s glass, and the lamp catches its light.', `${this.id}.lit`); }
      }), registerLight({ position: () => this.glass, enabled: () => this.lit }),
      registerDrinker({ position: () => this.glass, radius: 1.0, enabled: () => !this.lit })].filter(Boolean);
    }
  }
  dispose() { for (const f of this.offs ?? []) f?.(); }
  update(dt, t) {
    this.lit ||= this.rt.logic.isLit(this.id);   // (woken some other way: a glowing pool-orb, reach 0)
    if (this.o.carried && !this.lit) { this.glow.uniforms.uGlow.value = 0.05 + 0.03 * Math.sin(t * 1.2); return; }
    const P = this.rt.player, has = !this.o.carried && this.rt.logic.has('lantern');
    const near = P && has && P.pos.distanceTo(this.at) < this.reach;
    this.t = near ? this.t + dt : 0;
    if (!this.lit && this.t > this.hold && this.rt.logic.light(this.id)) { this.lit = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
    this.glow.uniforms.uGlow.value = this.lit ? 0.9 : near ? 0.2 + 0.7 * Math.min(1, this.t / this.hold) : 0.05 + 0.03 * Math.sin(t * 1.2);
  }
}

/**
 * A fount of the makers' lamp-water (the Lamp-House's Lantern Chamber, issue #377): a low stone basin whose water never
 * goes dark, a light a bubble blown over it takes (src/carried-light.js). o: { at (the basin's foot, local), r }
 */
export class LightFount {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit, M = rt.M, r = o.r ?? 1.3, [x, y, z] = o.at;
    K.both(M.trim, T(annulus(r, r + 0.5, 0.6, 32), [x, y + 0.6, z]));
    this.glow = own({ color: rt.P.lamp ?? '#ffd6a0', glow: 0.85, flat: true });
    const m = mesh([T(new THREE.CylinderGeometry(r, r, 0.08, 28), [0, 0, 0])], this.glow);
    m.position.copy(K.world(x, y + 0.5, z));
    noCollide(m);
    rt.root.add(m);
    this.center = m.position.clone().add(V(0, 0.6, 0));
    this.offLight = registerLight({ position: () => this.center, radius: o.light ?? r + 1.6 });
    this.lamp = new THREE.Vector4(0, -1e5, 0, 0);
    rt.lights?.push(this.lamp);
    this.lamp.set(this.center.x, this.center.y + 1, this.center.z, 7);
  }
  update(dt, t) { this.glow.uniforms.uGlow.value = 0.78 + 0.12 * Math.sin(t * 2.2); }
  dispose() { this.offLight?.(); }
}

// ---------------------------------------------------------------------------------------- living gates
const _frost = new THREE.Color('#d6f0fa');

/** A jaw's slabs (m), for a gate w wide and h tall: their number and pitch, depth, bevel, how far past the middle every
 * other one reaches, their point, the gap left between the two leaves' points, the lit seam's width. */
export function jawSlabs(w, h) {
  const rows = Math.max(4, Math.round(h / 0.9)), s = h / rows;
  return { rows, s, t: 0.8, bevel: Math.min(0.08, s * 0.1), reach: Math.min(0.35, 0.08 * w), point: Math.min(0.45, 0.3 * s, 0.12 * w), gap: 0.04, seam: 0.07 };
}
/** A pointed slab's outline in x (along the leaf, from its hinge) and y: from x0 to its point at x1, half-height hy. */
function pointed(x0, x1, hy, p) {
  const sh = new THREE.Shape();
  sh.moveTo(x0, -hy); sh.lineTo(x1 - p, -hy); sh.lineTo(x1, 0); sh.lineTo(x1 - p, hy); sh.lineTo(x0, hy); sh.closePath();
  return sh;
}

/**
 * A gate of jaws (Lorn's Hush): two great leaves of shutters, hinged at a doorway's jambs, that snap shut and half
 * open, shut and half open, never wide enough to pass, and bite whoever tries. A stilling glob (the 'stun' mode)
 * stills them: element `still` (a 'switch' that needs the stilling mode) is lit, and the door `id` (which opens on it)
 * eases them wide, for good. Solid while shut.
 * o: { id (the door), still, at: the doorway's foot, yaw, w, h, seed }
 * Each leaf as the Hush-House's pick draws them (references/temples/future/hush-house/sheet-1.jpg, v1.78): a stack of
 * square slabs, each pointed toward the meeting, every other one reaching past the middle so the two leaves' slabs
 * interlock, a lit seam on every point, a stile at the hinge. Its children: [slabs, stile, seams] (a skin dresses
 * them: skins/hush-house.js shutters()). What is drawn is what collides (solidify: the leaves are the colliders).
 */
export class Jaw {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.still = o.still; this.o = o;
    const K = rt.kit, w = o.w ?? 5, h = o.h ?? 6.2;
    this.w = w; this.h = h;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.skin = own({ color: '#c94f6a', flat: true });
    const lip = own({ color: '#ee93a2', flat: true }), throat = own({ color: '#93304a', flat: true });
    const J = this.slabs = jawSlabs(w, h), core = J.t - 2 * J.bevel;
    this.halves = [-1, 1].map((side) => {
      const g = new THREE.Group();
      g.position.set(side * w / 2, 0, 0);
      const slabs = [], seams = [];
      for (let i = 0; i < J.rows; i++) {
        // (the left leaf's even slabs reach past the middle, the right's odd ones: they interlock, never meeting)
        const long = (i + (side > 0 ? 1 : 0)) % 2 === 0, y = (i + 0.5) * J.s;
        const L = w / 2 + (long ? J.reach : -J.reach) - J.gap;
        const slab = new THREE.ExtrudeGeometry(pointed(0.15, L - J.seam, J.s / 2, J.point), { depth: core, bevelEnabled: true, bevelThickness: J.bevel, bevelSize: J.bevel, bevelOffset: -J.bevel, bevelSegments: 1, curveSegments: 1 });
        slabs.push(slab.translate(0, y, -core / 2));
        // its seam: the same point a little further on, thinner (inside the slab's faces), lit where the leaves meet
        const hy = J.s / 2 - J.bevel - 0.03, p = J.point * hy / (J.s / 2);
        const seam = new THREE.ExtrudeGeometry(pointed(L - J.seam - J.point - 0.12, L, hy, p), { depth: core - 0.04, bevelEnabled: false, curveSegments: 1 });
        seams.push(seam.translate(0, y, -(core - 0.04) / 2));
      }
      const stile = box(0.4, h, J.t + 0.12, 0.15, h / 2, 0);
      // (the right leaf turned about its hinge: it reaches the other way)
      const [a, b, c] = [slabs, [stile], seams].map((list) => list.map((geo) => (side > 0 ? geo.rotateY(Math.PI) : geo)));
      g.add(mesh(a, this.skin), mesh(b, throat), mesh(c, lip));
      this.group.add(g);
      return { g, side };
    });
    noCollide(this.group);
    // Collision while shut: each half as drawn, a moving collider that snaps with it (physics.addMover; synced
    // each frame), and a thin still slot down the middle, inside the slabs when they meet, that keeps the way
    // when they gape (never wide enough to pass), floor to lintel: the points leave chinks at every joint. (A box
    // the size of the doorway once stood in for both.) Open (stilled), they are walk-through as before: laid
    // back against the jambs they would narrow the way on and stand over the next room's mark.
    this.block = new THREE.Mesh(box(w * 0.42, h, 0.12, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.center = this.group.position.clone().addScaledVector(UP, h * 0.5);
    this.open = rt.logic.isOpen(o.id);
    this.k = this.open ? 1 : 0;   // 0 snapping, 1 wide open
    this.frost = 0; this.snapT = (o.seed ?? 0) * 0.37; this.ang = 0; this.angry = 0; this.left = 0;
    this.off = registerTarget({ kind: 'jaws', radius: Math.max(w, h) * 0.45, accepts: ['stun'], position: () => this.center, enabled: () => !this.open, onHit: (mode) => this.hit(mode) });
    this.group.updateMatrixWorld(true);
    const inv = this.group.matrixWorld.clone().invert(), _l = V(), _o = V();
    this.offHazard = registerHazard({
      kind: 'spikes', dps: HAZARD_DPS.spikeRow,
      test: (p) => { if (this.open) return false; _l.copy(p).applyMatrix4(inv); return Math.abs(_l.x) < w / 2 && _l.y > -1.6 && _l.y < h && Math.abs(_l.z) < 1.5; },
      push: (p, out) => { _l.copy(p).applyMatrix4(inv); return out.copy(_o.set(0, 0, Math.sign(_l.z) || -1).transformDirection(this.group.matrixWorld)); },
    });
  }
  init(physics) { this.physics = physics; if (!this.open) this.solidify(); }
  /** The halves (as they stand: shut, until the frame syncs them) and the slot, as colliders. */
  solidify() {
    const P = this.physics;
    if (!this.open) for (const { g, side } of this.halves) g.rotation.y = side * 0.12;   // (shut: where a snap starts)
    this.movers = P.addMover ? this.halves.map(({ g }) => P.addMover(g, { all: true })).filter(Boolean) : [];
    this.handle = P.addCollider?.(this.block, NO_CLIMB) ?? null;
  }
  hit(mode) {
    if (this.open) return false;
    if (mode === 'stun') {
      const L = this.rt.logic, e = L.el?.(this.still);
      if (L.light(this.still)) {
        this.frost = 1; this.rt.sound?.chime?.(); this.rt.onLit?.(this.still);
        // (held: the frost thaws after `hold` s and they snap shut again, the Hush-House's balcony, v1.52)
        if (e?.hold) { this.left = e.hold; this.warned = false; }
        this.rt.notice?.(this.o.stilled ?? 'The jaws stop dead, frosted, and ease open. They forget to close.', `stilled.${this.id}`);
      } else if (e?.after && !L.isLit(e.after)) {
        // (out of turn: its crown's crystal rings flat and the jaws snap on, the Snapping Passage's three, v1.52)
        this.angry = 0.8; this.rt.sound?.critter?.('blip', 0.5);
        this.rt.notice?.(this.o.wrong ?? 'The cold rings flat on them, and they snap on.', `${this.id}.wrong`);
      }
      return true;
    }
    if (mode === 'push') { this.angry = 0.6; return true; }
    this.angry = 1.2;
    this.rt.sound?.critter?.('snap', 0.8);
    this.rt.notice?.(this.o.snaps ?? 'The jaws snap at the splash, and snap, and snap. Something colder might still them.', 'jaws.snap');
    return true;
  }
  setOpen(open, instant = false) {
    if (open === this.open) return;
    this.open = open;
    if (open && this.handle) {
      this.physics?.removeCollider?.(this.handle); this.handle = null;
      for (const m of this.movers ?? []) this.physics?.removeCollider?.(m);
      this.movers = [];
    }
    if (!open && this.physics && !this.handle) this.solidify();
    if (instant) this.k = open ? 1 : 0;
    else this.rt.rumble?.(1.2, 0.3);
  }
  update(dt) {
    this.angry = Math.max(0, this.angry - dt);
    this.frost = Math.max(0, this.frost - dt * 0.25);
    if (this.left > 0) {
      // held open a while: the frost thaws, they say so, and they snap shut again (logic.quiet: its door shuts)
      this.left -= dt; this.frost = Math.max(this.frost, 0.6);
      if (this.left < 2.5 && !this.warned) { this.warned = true; this.rt.rumble?.(0.6, 0.2); if (this.o.thawing) this.rt.notice?.(this.o.thawing, `${this.id}.thawing`); }
      if (this.left <= 0) { this.left = 0; this.rt.logic.quiet(this.still); this.rt.sound?.critter?.('snap', 0.8); }
    }
    if (this.open) this.k = Math.min(1, this.k + dt / 2.4);
    else this.k = Math.max(0, this.k - dt * 3);   // (shut again: they close fast)
    // shut and half open, shut and half open (quicker when splashed): the opening slow, the snap fast
    this.snapT += dt * (this.angry ? 1.8 : 0.85);
    const ph = this.snapT % 1, snap = ph < 0.75 ? ease(ph / 0.75) : 1 - (ph - 0.75) / 0.25;
    const half = 0.12 + 0.38 * snap, k = ease(this.k);
    this.ang = half * (1 - k) + 1.45 * k;
    for (const { g, side } of this.halves) g.rotation.y = side * this.ang;
    this.skin.uniforms.uColor.value.set('#c94f6a').lerp(_frost, Math.min(1, this.frost * 1.4));
  }
  dispose() { this.off?.(); this.offHazard?.(); for (const m of this.movers ?? []) this.physics?.removeCollider?.(m); }
}

/**
 * A pendulum of crystal (Lorn's Hush): it hangs from a pivot high over a bridge and swings across it
 * (along the local x), and knocks whoever it meets off into the chasm. A stilling glob stops it dead
 * for `stillFor` seconds. o: { at: the pivot, len, amp (rad), period (s), phase (0..1), yaw, size (its
 * crystal's scale), id (an element a stilling wakes for good: a 'switch' that needs the stilling mode, which
 * may come `after` another: still them in turn), heard / wrong (what it says when it takes / rings flat),
 * onStill(swing) (instead of an element: something else hears its note; `taken` makes it glow on),
 * bob: 'disc' (a clock's brass bob instead of the crystal: the Clock-House's gallery, v1.74), gentle (it knocks you
 * back, `knock` m/s, and does not hurt), rings (said when a splash only rings it) }
 */
export class Swing {
  constructor(rt, o) {
    this.rt = rt; this.o = o; this.id = o.id;
    const K = rt.kit, len = this.len = o.len ?? 10;
    this.amp = o.amp ?? 0.9; this.period = o.period ?? 2.8; this.s = (o.phase ?? 0) * this.period; this.stillFor = o.stillFor ?? 6;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.arm = new THREE.Group();
    this.group.add(this.arm);
    // (it swings near walls: a mover, so the spot blacks see past it and draw no halo on the wall behind it, as for
    // a foe: src/materials.js MOVER, visual audit v1.21)
    this.arm.add(mesh([box(0.18, len - 1.6, 0.18, 0, -(len - 1.6) / 2, 0), new THREE.TorusGeometry(0.45, 0.12, 5, 14)], own({ color: rt.P.trim ?? '#fffdf4', flat: true, mover: true })));
    this.mat = own({ color: rt.P.glow ?? '#a8e6ee', glow: 0.3, flat: true, mover: true });
    const z = o.size ?? 1;
    if (o.bob === 'disc') {
      // a clock pendulum's bob: a great disc of brass, its face across the swing, a ring of the house's light round it
      this.arm.add(mesh([T(new THREE.CylinderGeometry(1.5 * z, 1.5 * z, 0.4 * z, 32), [0, -len, 0], [Math.PI / 2, 0, 0]), T(new THREE.CylinderGeometry(0.5 * z, 0.5 * z, 0.6 * z, 16), [0, -len, 0], [Math.PI / 2, 0, 0])], own({ color: rt.P.trim ?? '#d2a648', flat: true, metal: 'brass', mover: true })));
      this.arm.add(mesh([T(new THREE.TorusGeometry(1.5 * z, 0.09 * z, 5, 36), [0, -len, 0])], this.mat));
    } else this.arm.add(mesh([T(new THREE.OctahedronGeometry(1, 0), [0, -len, 0], [0, 0.6, 0], [1.5 * z, 2.1 * z, 1.5 * z]), T(new THREE.OctahedronGeometry(1, 0), [0.9 * z, -len + 0.6 * z, 0.3 * z], [0, 0, 0.5], [0.6 * z, 1.0 * z, 0.6 * z])], this.mat));
    noCollide(this.group);
    this.center = V(); this.still = 0; this.cool = 0; this.theta = 0; this.way = 1;
    this.place();
    this.off = registerTarget({ kind: 'swing', radius: 1.9, accepts: ['stun'], position: () => this.center, onHit: (mode, point, dir, info) => this.hit(mode, info) });
    // a working (src/workings.js): what it meets, a foe too, it knocks away the way it swings
    this.working = { kind: 'swing', center: this.center, radius: 1.9,
      contains: (p) => (p.x - this.center.x) ** 2 + (p.z - this.center.z) ** 2 < 1.9 * 1.9 && Math.abs(p.y + 0.9 - this.center.y) < 2.6,
      moving: () => this.still <= 0,
      push: (p, out) => out.set(this.way, 0, 0).transformDirection(this.group.matrixWorld) };
    this.offWorking = registerWorking(this.working);
  }
  hit(mode, info = null) {
    if (mode === 'stun') {
      // (its note heard by something else, the Mother Snapper's crystals: that says how it rings, true or flat, and
      // whether the glob took (false: the tool's splash as on a wall, src/targets.js hitTarget; issue #373)
      if (this.o.onStill) { this.still = this.stillFor; if (this.o.onStill(this) === false && info) info.dull = true; return true; }
      if (!this.still) this.rt.sound?.chime?.();
      this.still = this.stillFor;
      this.rt.notice?.(this.o.stilled ?? 'The crystal stops dead mid-swing, frosted over, and hangs there humming.', 'swing.still');
      // its note: it takes in turn (the element lit for good), or out of turn it rings flat
      if (this.id) {
        if (this.rt.logic.light(this.id)) { this.rt.onLit?.(this.id); if (this.o.heard) this.rt.notice?.(this.o.heard, `swing.${this.id}`); }
        else if (!this.rt.logic.isLit(this.id) && this.o.wrong) { this.flat = 0.8; this.rt.sound?.critter?.('blip', 0.5); this.rt.notice?.(this.o.wrong, `wrong.${this.id}`); }
      }
      return true;
    }
    this.rt.notice?.(this.o.rings ?? 'The crystal rings under the splash, and swings on.', 'swing.ring');
    return true;
  }
  place() {
    this.arm.rotation.z = this.theta;
    this.group.updateMatrixWorld(true);
    this.center.set(0, -this.len, 0).applyMatrix4(this.arm.matrixWorld);
  }
  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    const was = this.theta;
    if (this.still > 0) this.still = Math.max(0, this.still - dt);
    else this.s += dt;
    this.theta = this.amp * Math.sin((this.s / this.period) * Math.PI * 2);
    if (this.theta !== was) this.way = Math.sign(this.theta - was);   // (the way it swings: the way it knocks)
    this.place();
    const k = this.still > 0 ? Math.min(1, this.still) : 0;
    this.flat = Math.max(0, (this.flat ?? 0) - dt);
    this.mat.uniforms.uColor.value.set(this.rt.P.glow ?? '#a8e6ee').lerp(_frost, k);
    this.mat.uniforms.uGlow.value = 0.3 + 0.5 * k + ((this.id && this.rt.logic.isLit(this.id)) || this.taken ? 0.3 : 0) - this.flat * 0.25;   // (its note taken: it glows on)
    // it meets you: off the bridge, the way it was swinging
    const P = this.rt.player;
    if (!P || P.dead || P.down || this.still > 0 || this.cool > 0) return;
    const dx = P.pos.x - this.center.x, dy = P.pos.y + 0.9 - this.center.y, dz = P.pos.z - this.center.z;
    if (dx * dx + dz * dz < 1.9 * 1.9 && Math.abs(dy) < 2.6) {
      this.cool = 1.5;
      const out = V(this.way, 0, 0).transformDirection(this.group.matrixWorld).multiplyScalar(this.o.knock ?? 9).addScaledVector(UP, 4);
      P.knockDown?.(out, { why: 'guardian' });
      if (!this.o.gentle) P.hurt?.(sparing(heartsOf(P), DAMAGE.blow), 'guardian');
      this.rt.rumble?.(0.4, 0.4);
    }
  }
  dispose() { this.off?.(); this.offWorking?.(); }
}

// ---------------------------------------------------------------------------------------- wind
/**
 * A column of rising wind (Vael's Aerie): pale rings drift up it. It catches the fluid wings: gliding in it
 * you go straight up its middle (src/updraft.js) and hang near its top until you steer off (the stick drifts you; the
 * glide takes up again out of it). Without the wings it only ruffles you. o: { at: its foot (the floor's middle), r, h, lift, when (a
 * condition: it rises only while that holds, the Aerie's vents: a stone in another mouth), heights ([[condition, h]]:
 * the first that holds sets how high it rises), still (said when you open your wings over it while it is still), low (said
 * when it lets you go at its top short of its highest: the Aerie's well while its floor's second vent breathes) }
 */
export class Updraft {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit;
    this.r = o.r ?? 4.5; this.h0 = o.h ?? 22; this.lift = o.lift ?? 7;
    // (`heights`: [[condition, h], …], the first that holds sets how high it rises now: the Warden's Well's draught
    // rises higher as each iris over it opens)
    this.hMax = Math.max(this.h0, ...(o.heights ?? []).map(([, h]) => h));
    this.foot = K.world(...o.at);
    this.root = new THREE.Group();
    rt.root.add(this.root);
    this.mat = own({ color: '#f4f8f6', glow: 0.35, flat: true });
    this.rings = [];
    const N = Math.max(6, Math.round(this.hMax / 2.4));
    const g = new THREE.TorusGeometry(this.r * 0.75, 0.07, 4, 32).rotateX(Math.PI / 2);
    for (let i = 0; i < N; i++) { const m = new THREE.Mesh(g, this.mat); this.root.add(m); this.rings.push({ m, s: i / N, w: 0.6 + (i % 3) * 0.2 }); }
    const stone = mesh([T(annulus(this.r - 0.3, this.r + 0.4, 0.05, 36), [0, 0.04, 0])], rt.M.trimMat);
    stone.position.copy(this.foot);
    this.root.add(stone);
    noCollide(this.root);
    this.rideT = 0;
    // a working (src/workings.js): it throws a foe up out of it, or tumbles a flying one
    const self = this;
    this.offWorking = registerWorking({ kind: 'updraft', contains: (p) => this.contains(p), foot: this.foot, r: this.r, get top() { return self.foot.y + self.h; }, lift: this.lift });
  }
  /** How high it rises now (m over its foot). */
  get h() { return this.o.heights?.find(([c]) => this.rt.logic?.check(c))?.[1] ?? this.h0; }
  dispose() { this.offWorking?.(); }
  /** Does it blow now (its `when` holds)? */
  get on() { return !this.o.when || !!this.rt.logic?.check(this.o.when); }
  /** Is p (feet) in the column (and is it rising)? */
  contains(p) { return this.on && this.inside(p); }
  inside(p) { return Math.hypot(p.x - this.foot.x, p.z - this.foot.z) < this.r && p.y > this.foot.y - 1 && p.y < this.foot.y + this.h; }
  update(dt, t) {
    // (still: the rings settle and fade; rising again, they come back from the floor)
    this.k = THREE.MathUtils.clamp((this.k ?? (this.on ? 1 : 0)) + (this.on ? dt / 1.2 : -dt / 0.8), 0, 1);
    this.root.visible = this.k > 0.01 || !!this.o.when;
    const h = this.h;
    for (const r of this.rings) {
      r.s = (r.s + dt * 0.09 * (this.hMax / Math.max(h, 1))) % 1;
      r.m.position.set(this.foot.x, this.foot.y + 0.5 + r.s * h, this.foot.z);
      const fade = Math.min(1, r.s * 8, (1 - r.s) * 6) * this.k;
      r.m.scale.setScalar(Math.max(0.01, fade * (r.w + 0.08 * Math.sin(t * 2 + r.s * 20))));
      r.m.visible = fade > 0.02;
      r.m.rotation.y = t * 0.4 + r.s * 3;
    }
    this.mat.uniforms.uGlow.value = 0.3 + 0.1 * Math.sin(t * 1.7);
    const P = this.rt.player;
    // (still: what it says, or [[condition, what it says]…], the first whose condition holds: why it is still)
    const still = Array.isArray(this.o.still) ? (this.o.still.find(([c]) => this.rt.logic?.check(c)) ?? this.o.still[this.o.still.length - 1])[1] : this.o.still;
    if (P && !this.on && still && P.gliding && this.inside(P.pos)) this.rt.notice?.(still, `updraft.still.${this.o.id ?? ''}.${still.length}`);
    // (rising air spills a stride round its column: open wings there are held up already, so a makers' house's steeper glide,
    // player.js HOUSE_GLIDE, doesn't drop him short of it, issue #436)
    if (P && this.on && !P.onGround && Math.hypot(P.pos.x - this.foot.x, P.pos.z - this.foot.z) < this.r + AIR_LEAD && P.pos.y > this.foot.y - 1 && P.pos.y < this.foot.y + h) P.windAt = P.time ?? 0;
    if (!P || P.dead || P.down || !this.contains(P.pos)) { this.rideT = 0; return; }
    if (!P.gliding) {
      if (!P.onGround && P.vel.y < 0) this.rt.notice?.(this.o.hint ?? 'The wind rushes up past you. Open your wings in it.', 'updraft.hint');
      return;
    }
    // the wings catch it: straight up, settling onto its middle (src/updraft.js); at its top it eases and holds you
    // there until you steer off it
    rideColumn(P, dt, { x: this.foot.x, z: this.foot.z, top: this.foot.y + this.h, lift: this.lift, r: this.r });
    if (this.o.low && h < this.hMax && P.pos.y > this.foot.y + h - 1.2) this.rt.notice?.(this.o.low, `updraft.low.${this.o.id ?? ''}`);
    if ((this.rideT += dt) > 0.4) this.rt.notice?.(this.o.ride ?? 'The wind fills your wings and lifts you, round and up.', 'updraft.ride');
  }
}

/**
 * The makers' breath in a hall built for wings (issue #436, the Aerie's Wind Well): air too soft to lift anyone, enough to
 * hold open wings up. Inside its box (local) while its `when` holds, the house's steeper glide (src/player.js HOUSE_GLIDE)
 * gives way to the open world's, as in a column or a carrying gust (P.windAt). Nothing drawn: the hall's own columns and
 * feathers say what it is. o: { min, max, when }
 */
export class WingAir {
  constructor(rt, o) { this.rt = rt; this.o = o; this.box = new THREE.Box3(V(...o.min), V(...o.max)); }
  get on() { return !this.o.when || !!this.rt.logic?.check(this.o.when); }
  update() {
    const P = this.rt.player;
    if (P && !P.dead && this.on && this.box.containsPoint(this.rt.kit.local(P.pos))) P.windAt = P.time ?? 0;   // (marked before the wings open: they open into it)
  }
}

/**
 * Gusts down a hall (Vael's Aerie): calm a while, then a warning (pale streaks start), then the wind blows
 * along `dir` (local) and shoves whoever stands in the open back along it. Behind a screen (a `shelter`
 * box) it can't reach you. o: { min, max: the hall (local), dir: [x, 0, z], shelters: [[min, max]], calm, blow, push,
 * when (a condition: it blows only while that holds, the Aerie's vents), carry (m/s: with the wings open it carries you
 * along `dir` instead of shoving you back, a tailwind: push by default), carried (said the first time it does), guard
 * (the Rose House: the shield raised into the wind breaks it, and you walk on into it at `guardPace` m/s), guarded
 * (said the first time), streaks (how many: 36), lee (m: anything solid this close upwind of you, at your chest, keeps the wind off: a wall, a
 * screen, the stone; and the streaks stop in its lee, so you can see where it does. Issue #216, the Aerie's hall: the
 * shelter boxes were narrower and shallower than the screens' shadow, and behind the far wall there were none) }
 */
const _gl = new THREE.Vector3(), _gd = new THREE.Vector3();
/** Gust.lee: the height (m) of a body's chest over its feet, for the ray upwind. */
export const LEE = { chest: 1.1 };
/** How far short of rising air or a carrying gust (m: round a column, upwind of a gust's box) open wings are already held up by it (issue #436). */
export const AIR_LEAD = 4;
export class Gust {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit;
    this.box = new THREE.Box3(V(...o.min), V(...o.max));
    this.shelters = (o.shelters ?? []).map(([a, b]) => new THREE.Box3(V(...a), V(...b)));
    this.dirL = V(...(o.dir ?? [0, 0, -1])).normalize();
    this.dirW = this.dirL.clone().applyAxisAngle(UP, K.yaw);
    this.calm = o.calm ?? 2.6; this.blow = o.blow ?? 2.4; this.warn = o.warn ?? 0.7; this.push = o.push ?? 7.5;
    this.t = o.phase ?? 0;
    // the streaks: thin pale bars that race down the hall while it blows
    this.mat = own({ color: '#fbf7ee', glow: 0.4, flat: true });
    this.streaks = [];
    const size = this.box.getSize(V());
    const g = new THREE.BoxGeometry(0.06, 0.06, 3.2);
    let s = 77;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.root = new THREE.Group();
    this.root.position.copy(K.world(0, 0, 0)); this.root.rotation.y = K.yaw;
    rt.root.add(this.root);
    for (let i = 0; i < (o.streaks ?? 36); i++) {
      const m = new THREE.Mesh(g, this.mat);
      this.root.add(m);
      // (with a lee, half of them low, at a body's height over the floor, where the lee is read)
      const y = o.lee && i % 2 ? (o.floor ?? 0) + 0.3 + rnd() * 1.9 : this.box.min.y + 0.4 + rnd() * Math.min(size.y, 8);
      this.streaks.push({ m, x: this.box.min.x + rnd() * size.x, y, u: rnd(), v: 0.8 + rnd() * 0.6 });
    }
    noCollide(this.root);
    this.size = size;
    // a working (src/workings.js): while it blows it shoves any foe in the open down the hall
    this.working = { kind: 'gust', dir: this.dirW, push: this.push,
      contains: (p) => this.box.containsPoint(rt.kit.local(p)),
      blowing: () => this.state === 1,
      sheltered: (p) => this.sheltered(rt.kit.local(p)) || screened(p, this.dirW) || this.lee(p) };
    this.offWorking = registerWorking(this.working);
  }
  /** Is something solid within o.lee m upwind of a body standing at p (world), at its chest? (false without a lee) */
  lee(p, chest = LEE.chest) {
    const ph = this.rt.physics, reach = this.o.lee;
    if (!reach || !ph?.rayDistance) return false;
    return ph.rayDistance(_gl.copy(p).addScaledVector(UP, chest), _gd.copy(this.dirW).negate(), reach) < reach;
  }
  /**
   * The streaks' lee, once (the walls are still): for each streak's lane, which stretches of it lie in the lee (at its own
   * height), sampled every `step` m along the hall; a streak there is not drawn, so the lee shows. Null without a lee.
   */
  leeLanes(step = 0.5) {
    if (this._lanes !== undefined) return this._lanes;
    if (!this.o.lee || !this.rt.physics?.rayDistance) return null;
    const alongX = Math.abs(this.dirL.x) > Math.abs(this.dirL.z), lo = alongX ? this.box.min.x : this.box.min.z, hi = alongX ? this.box.max.x : this.box.max.z;
    const K = this.rt.kit, n = Math.max(1, Math.ceil((hi - lo) / step));
    this._lanes = this.streaks.map((s) => {
      const across = alongX ? this.box.min.z + ((s.x - this.box.min.x) / Math.max(1e-3, this.size.x)) * this.size.z : s.x;
      const lane = new Uint8Array(n + 1);
      for (let i = 0; i <= n; i++) {
        const w = lo + (i / n) * (hi - lo);
        lane[i] = this.lee(alongX ? K.world(w, s.y, across) : K.world(across, s.y, w), 0) ? 1 : 0;
      }
      return { lane, lo, hi, n };
    });
    return this._lanes;
  }
  dispose() { this.offWorking?.(); }
  /** Does it blow at all now (its `when` holds)? */
  get on() { return !this.o.when || !!this.rt.logic?.check(this.o.when); }
  /** 0 calm, a warning ramp, 1 blowing. */
  get state() {
    if (!this.on) return 0;
    const c = this.t % (this.calm + this.blow);
    if (c < this.calm - this.warn) return 0;
    if (c < this.calm) return 0.5;
    return 1;
  }
  sheltered(l) { return this.shelters.some((b) => b.containsPoint(l)); }
  /** A guard turned this way (world) faces into the wind. */
  facing(g) { return !g || g.x * -this.dirW.x + g.z * -this.dirW.z > 0.35; }
  update(dt) {
    this.t += dt;
    const st = this.state;
    // the streaks: along the hall, from its far end to its near (a hall along x: across it, its width in z)
    const alongX = Math.abs(this.dirL.x) > Math.abs(this.dirL.z), len = alongX ? this.size.x : this.size.z;
    const d = alongX ? this.dirL.x : this.dirL.z, lo = alongX ? this.box.min.x : this.box.min.z, hi = alongX ? this.box.max.x : this.box.max.z;
    const P = this.rt.player, lanes = st > 0 && P && this.box.containsPoint(this.rt.kit.local(P.pos)) ? this.leeLanes() : this._lanes;
    this.streaks.forEach((s, i) => {
      s.u = (s.u + dt * (st === 1 ? 0.9 : 0.3) * s.v) % 1;
      const w = d < 0 ? hi - s.u * len : lo + s.u * len;
      if (alongX) { s.m.position.set(w, s.y, this.box.min.z + ((s.x - this.box.min.x) / Math.max(1e-3, this.size.x)) * this.size.z); s.m.rotation.y = Math.PI / 2; }
      else s.m.position.set(s.x, s.y, w);
      // (in a wall's lee it stops: the streak's leading end there)
      const L = lanes?.[i], calm = L ? L.lane[Math.round(((w + d * 1.6 - L.lo) / (L.hi - L.lo)) * L.n)] === 1 : false;
      s.m.visible = st > 0 && !(st === 0.5 && s.v > 1.1) && !calm;
    });
    this.mat.uniforms.uGlow.value = st === 1 ? 0.6 : 0.35;
    if (!P || P.dead || st < 1) return;
    const l = this.rt.kit.local(P.pos);
    // (wings opened in a carrying gust or a stride short of it: it holds them up already, so the house's steeper glide, player.js
    // HOUSE_GLIDE, doesn't drop him before it takes him: the Aerie's gulf, leapt into from its lip)
    if (this.o.carry && !P.onGround && this.box.containsPoint(_gl.copy(l).addScaledVector(this.dirL, AIR_LEAD))) P.windAt = P.time ?? 0;
    if (!this.box.containsPoint(l) || this.sheltered(l) || screened(P.pos, this.dirW) || this.lee(P.pos)) return;   // (or behind a wall drawn in ink: src/wind-screens.js; or in a wall's lee)
    // the shield raised into it (o.guard, the Rose House): it breaks the wind, and you walk on into it, slowly
    if (this.o.guard && P.guarding?.() && this.facing(P.guardDir?.())) {
      const into = P.vel.x * -this.dirW.x + P.vel.z * -this.dirW.z, pace = this.o.guardPace ?? 2.2;
      if (into > pace) { const k = pace / into; P.vel.x *= k; P.vel.z *= k; }
      this.rt.notice?.(this.o.guarded ?? 'The gust breaks on your guard, and you lean on into it.', 'gust.guarded');
      return;
    }
    if (P.gliding) {
      // the wings open: it carries you along with it (the glide keeps its own way and sink; the wind adds its own)
      const c = (this.o.carry ?? this.push) * dt;
      P.pos.x += this.dirW.x * c; P.pos.z += this.dirW.z * c;
      P.windAt = P.time ?? 0;   // (and holds the wings up: no steeper glide in a house while it carries them, player.js HOUSE_GLIDE)
      this.rt.notice?.(this.o.carried ?? 'The gust fills your wings and carries you with it.', 'gust.carried');
      return;
    }
    // shoved back down the hall (your own legs win a little of it back)
    P.vel.x = this.dirW.x * this.push; P.vel.z = this.dirW.z * this.push;
    if (P.climbing) P.climbing = false;
    this.rt.notice?.(this.o.notice ?? 'The gust shoves you back down the hall. Wait it out behind a screen.', 'gust');
  }
}

// ---------------------------------------------------------------------------------------- the watcher (a sentry)
/**
 * The Givers' watcher (the Rose House's far landing, issue #245): a squat bronze sentry on a stone foot, one glass eye
 * under a hood. Asleep until its element can be used (its `needs`: the guard in hand), then it turns its head to you and
 * fires, again and again: its eye brightens and a beam holds on you and narrows (`aim` s; it follows you `track` of that
 * time, then locks), and a bolt flies down it (`speed` m/s). Taken on the guard (any block: P.guard, src/fluid-blade.js),
 * the bolt flies back into its eye and it is broken: its element (a latched 'switch', logic.js) is lit, for good, and the
 * door it held opens. Not blocked, it hurts (DAMAGE.blow, spared) and knocks you back; dodged, it bursts on whatever is
 * behind you. It fires only while you stand in its `zone` (local min, max).
 * o: { id, at (its foot), yaw (the way it faces), zone: { min, max }, rest, aim, track, speed, back (the bolt's speed
 *      back), range, woke (said once, the first time it wakes), reflected (said once, the first bolt sent back),
 *      broken (said when it breaks), hit (said the first time a bolt gets through), shrug (said the first time it is cut or
 *      splashed: only its own bolt breaks it) }. Awake, it is a target the guard turns to (lock: src/fluid-blade.js).
 */
export const SENTRY = { rest: 1.5, aim: 1.3, track: 0.7, speed: 12, back: 20, range: 26, eye: 1.75, hitR: 0.95, damage: DAMAGE.blow, knock: 7 };
const _se = new THREE.Vector3(), _st = new THREE.Vector3(), _sd = new THREE.Vector3(), _sb = new THREE.Vector3();
/** m its beam runs on past where it aims, when nothing stops it (a sidestep: it reads as a line past you). */
export const SENTRY_BEAM_PAST = 2;
export class Sentry {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M;
    this.cfg = { ...SENTRY, ...o };
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    const bronze = own({ color: '#a8854e', flat: true, metal: 'brass' });
    const dark = own({ color: rt.P.dark ?? '#5a3640', flat: true });
    this.eyeMat = own({ color: '#ffb36a', glow: 0.1, flat: true });
    this.boltMat = own({ color: '#ffd28a', glow: 1, flat: true });
    // its foot: a round of the house's stone, a bronze collar
    this.group.add(mesh([lathe([[0.95, 0], [0.95, 0.25], [0.78, 0.35], [0.7, 0.7], [0.01, 0.7]], 16)], M.trimMat));
    this.group.add(mesh([T(new THREE.TorusGeometry(0.66, 0.06, 4, 20), [0, 0.72, 0], [Math.PI / 2, 0, 0])], bronze));
    // its head turns on the foot: a bronze bell, a hood over the eye, three vanes down its back
    this.head = new THREE.Group();
    this.head.position.set(0, 0.75, 0);
    this.group.add(this.head);
    const E = this.cfg.eye - 0.75;
    this.head.add(mesh([lathe([[0.62, 0], [0.66, 0.35], [0.58, 0.8], [0.42, 1.15], [0.18, 1.32], [0.01, 1.36]], 16)], bronze));
    this.head.add(mesh([T(new THREE.CylinderGeometry(0.42, 0.46, 0.24, 14, 1, true, -Math.PI * 0.55, Math.PI * 1.1), [0, E + 0.18, 0.18], [0.35, 0, 0])], bronze));
    for (const a of [-0.5, 0, 0.5]) this.head.add(mesh([T(new THREE.BoxGeometry(0.05, 0.7, 0.34), [Math.sin(Math.PI + a) * 0.55, 0.7, Math.cos(Math.PI + a) * 0.55], [0, a, 0])], dark));
    this.head.add(mesh([T(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 16), [0, E, 0.52], [Math.PI / 2, 0, 0])], dark));
    this.eye = mesh([T(new THREE.SphereGeometry(0.27, 14, 8).scale(1, 1, 0.55), [0, E, 0.6])], this.eyeMat);
    this.head.add(this.eye);
    this.eyeAt = V(0, E, 0.66);
    // the beam it aims down (narrowing as it locks), and its bolt
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), this.eyeMat);
    this.beam.visible = false;
    this.bolt = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 6), this.boltMat);
    this.tail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 5).scale(1, 1, 4).translate(0, 0, -0.5), this.boltMat);
    this.bolt.add(this.tail);
    this.bolt.visible = false;
    rt.root.add(this.beam, this.bolt);
    noCollide(this.group); noCollide(this.beam); noCollide(this.bolt);
    this.zone = o.zone ? new THREE.Box3(V(...o.zone.min), V(...o.zone.max)) : null;
    this.state = 'sleep'; this.t = 0; this.yawK = 0; this.droop = 0; this.flash = 0;
    this.aimAt = V(); this.vel = V(); this.flight = null;
    this.broken = rt.logic.isLit(o.id);
    if (this.broken) { this.state = 'broken'; this.droop = 1; }
    this.place();
    // a target (src/targets.js): awake, the guard turns to it as to a foe (`lock`: src/fluid-blade.js lockTarget), and a
    // cut or a splash only rings its bronze (o.shrug, said once)
    this.off = registerTarget({ kind: 'sentry', radius: 0.8, lock: true, lockRange: this.cfg.range, position: () => this.eyeWorld(this._eye ??= V()),
      enabled: () => !this.broken && this.state !== 'sleep',
      onHit: () => { this.flash = 0.3; rt.sound?.critter?.('clank', 0.5); if (this.o.shrug) rt.notice?.(this.o.shrug, `shrug.${this.id}`); return true; } });
  }
  /** Its eye in the world now. */
  eyeWorld(out = V()) { this.head.updateWorldMatrix(true, false); return out.copy(this.eyeAt).applyMatrix4(this.head.matrixWorld); }
  /** You stand where it watches (its zone), up and about. */
  sees(P) { return !!P && !P.dead && !P.down && (!this.zone || this.zone.containsPoint(this.rt.kit.local(P.pos))); }
  chest(P, out = _st) { return out.copy(P.pos).addScaledVector(UP, 1.15); }
  place() {
    this.head.rotation.set(this.droop * 0.55, this.yawK, this.droop * 0.25);
    this.head.position.y = 0.75 - this.droop * 0.12;
  }
  /** Turn its head toward a world point, at most `rate` rad a second. */
  turnTo(p, dt, rate = 3) {
    this.group.updateWorldMatrix(true, false);
    const l = this.group.worldToLocal(_sd.copy(p));
    let d = Math.atan2(l.x, l.z) - this.yawK;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yawK += THREE.MathUtils.clamp(d, -rate * dt, rate * dt);
  }
  fire() {
    const from = this.eyeWorld(V());
    this.vel.copy(this.aimAt).sub(from).normalize().multiplyScalar(this.cfg.speed);
    this.flight = { pos: from, back: false, life: this.cfg.range / this.cfg.speed + 0.5 };
    this.bolt.position.copy(from); this.bolt.visible = true;
    this.rt.sound?.critter?.('flash', 0.6);
  }
  burst() { this.flight = null; this.bolt.visible = false; this.rt.sound?.critter?.('clack', 0.4); }
  /** Its own bolt back in its eye: broken, for good. */
  breakNow() {
    this.flight = null; this.bolt.visible = false; this.beam.visible = false;
    if (this.rt.logic.light(this.id)) { this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
    this.broken = true; this.state = 'broken'; this.flash = 1;
    this.rt.sound?.critter?.('clank', 0.8);
    this.rt.rumble?.(0.3, 0.3);
    if (this.o.broken) this.rt.notice?.(this.o.broken, `broken.${this.id}`);
  }
  update(dt, t) {
    const P = this.rt.player, L = this.rt.logic, c = this.cfg;
    this.broken ||= L.isLit(this.id);
    this.flash = Math.max(0, this.flash - dt);
    if (this.broken) {
      this.state = 'broken'; this.beam.visible = false;
      if (this.flight) this.burst();
      this.droop = Math.min(1, this.droop + dt * 1.5);
      this.place();
      this.eyeMat.uniforms.uGlow.value = this.flash * 0.8;
      this.eyeMat.uniforms.uColor.value.set(this.flash > 0 ? '#ffb36a' : '#6a5a52');
      return;
    }
    // asleep until the guard is in hand (its element's needs) and you stand where it watches
    if (this.state === 'sleep') {
      this.eyeMat.uniforms.uGlow.value = 0.05;
      if (!L.canUse(this.id) || !this.sees(P)) return;
      this.state = 'rest'; this.t = 0;
      this.rt.sound?.critter?.('whirr', 0.5);
      if (this.o.woke) this.rt.notice?.(this.o.woke, `woke.${this.id}`);
    }
    this.updateBolt(dt, P);
    if (this.broken) return;
    const seen = this.sees(P);
    if (seen) this.turnTo(P.pos, dt, this.state === 'aim' && this.t > c.aim * c.track ? 0 : 3);
    this.place();
    this.t += dt;
    if (this.state === 'rest') {
      this.beam.visible = false;
      this.eyeMat.uniforms.uGlow.value = 0.25 + 0.05 * Math.sin(t * 3);
      if (seen && !this.flight && this.t > c.rest) { this.state = 'aim'; this.t = 0; this.rt.sound?.critter?.('blip', 0.4); }
    } else if (this.state === 'aim') {
      const k = Math.min(1, this.t / c.aim);
      if (!seen) { this.state = 'rest'; this.t = 0; this.beam.visible = false; return; }
      if (k < c.track) this.chest(P, this.aimAt);
      // the beam: from its eye to where it aims, narrowing as it locks; the eye brightening. It runs on past where it
      // aims (BEAM_PAST) but stops on the first thing it meets: your raised shield, your body, a wall (issue #485: it
      // ran 2 m through you, the shield up or not)
      const from = this.eyeWorld(_se);
      this.beam.visible = true;
      this.beam.position.copy(from); this.beam.lookAt(this.aimAt);
      const r = THREE.MathUtils.lerp(0.14, 0.025, k) * (k > c.track ? 0.8 + 0.2 * Math.sin(t * 40) : 1);
      this.beam.scale.set(r, r, Math.max(0.05, this.beamLength(from)));
      this.eyeMat.uniforms.uGlow.value = 0.3 + 0.7 * k;
      if (k >= 1) { this.beam.visible = false; this.fire(); this.state = 'rest'; this.t = 0; }
    }
  }
  /** How long its beam from `from` (its eye) is drawn toward where it aims: on past it, stopped by you or a wall (src/beam-stop.js). */
  beamLength(from) {
    const dir = _sb.subVectors(this.aimAt, from), len = dir.length() + SENTRY_BEAM_PAST;
    dir.divideScalar(Math.max(len - SENTRY_BEAM_PAST, 1e-6));
    let L = beamStop(from, dir, len, this.rt.player);
    const wall = this.rt.physics?.rayDistance?.(from, dir, L);
    if (Number.isFinite(wall) && wall < L) L = wall;
    return L;
  }
  updateBolt(dt, P) {
    const F = this.flight, c = this.cfg;
    if (!F) return;
    F.life -= dt;
    F.pos.addScaledVector(this.vel, dt);
    this.bolt.position.copy(F.pos);
    this.bolt.lookAt(_se.copy(F.pos).add(this.vel));
    this.boltMat.uniforms.uGlow.value = 0.9 + 0.1 * Math.sin(F.life * 50);
    if (F.back) {
      // back down its own beam, into its eye
      const eye = this.eyeWorld(_se);
      this.vel.copy(eye).sub(F.pos);
      if (this.vel.length() < 0.45 || F.life < 0) { this.breakNow(); return; }
      this.vel.normalize().multiplyScalar(c.back);
      return;
    }
    if (F.life < 0) { this.burst(); return; }
    if (P && !P.dead && this.chest(P).distanceTo(F.pos) < c.hitR) {
      // taken on the guard: it flies back (any block, perfect or not)
      if (P.guard?.(F.pos)) {
        F.back = true; F.life = 3;
        if (this.o.reflected) this.rt.notice?.(this.o.reflected, `reflected.${this.id}`);
        return;
      }
      const push = _sd.copy(this.vel).setY(0).normalize().multiplyScalar(c.knock);
      P.vel.x += push.x; P.vel.z += push.z;
      P.hurt?.(sparing(heartsOf(P), c.damage), 'foe');
      this.rt.rumble?.(0.4, 0.3);
      if (this.o.hit) this.rt.notice?.(this.o.hit, `hit.${this.id}`);
      this.burst();
      return;
    }
    // past you: it bursts on whatever it meets
    const ph = this.rt.physics, sp = this.vel.length() * dt;
    if (ph?.rayDistance && ph.rayDistance(F.pos, _sd.copy(this.vel).normalize(), sp + 0.1) < sp + 0.1) this.burst();
  }
  dispose() { this.off?.(); this.beam.removeFromParent(); this.bolt.removeFromParent(); }
}

// ---------------------------------------------------------------------------------------- the bellows (the City-Shaft)
/**
 * A vane of the makers' bellows (the Warden's Well: the tower was built to keep the shaft breathing, and its vanes
 * turned its machines on that breath until the warden stopped it). Element `id` (a 'vane', logic.js: held) is lit
 * only while it turns, and what it drives (a riding disc, a bridge of stones, an eye's lids) works only as long.
 * A splash of fluid (any mode) spins a small vane for `coast` seconds, slowing as it goes; a great one (`great`) is
 * too heavy for a splash (it rocks and stops: `heavy` says so) and turns only under a steady wash: open wings with the
 * Warden's bellows (v1.42; the rising air over a great vane holds you there) or the debug jets burning, within `reach`
 * metres over it, and `linger` seconds after. Any vane turns under such a wash. Set in a floor it faces up; `wall` sets
 * it on a wall, facing `yaw`.
 * o: { id, at (its centre), wall, yaw, r, coast, great, reach, linger, heavy, turning (said the first time it turns),
 *      washed (said the first time a wash turns it), fading (said as a splashed one slows) }
 */
/** s a great vane turns for one gust of the fan (issue #377: the Warden's Well's tool; held, it gusts every 0.42 s). */
export const VANE_GUST = 5;
export class Vane {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, r = (this.r = o.r ?? 1.6);
    this.center = K.world(...o.at);
    const h = K.heading(o.yaw ?? 0);
    this.normal = o.wall ? V(Math.sin(h), 0, Math.cos(h)) : UP.clone();
    this.reach = o.reach ?? 9; this.linger = o.linger ?? 0.9; this.coast = o.coast ?? 10;
    this.group = new THREE.Group();
    this.group.position.copy(this.center);
    this.group.quaternion.setFromUnitVectors(UP, this.normal);
    rt.root.add(this.group);
    // (in a floor: everything within 5 cm of it, so a foot never meets an edge: the frame flush, the blades over a
    // shallow well of dark)
    const lift = o.wall ? 0.16 : 0;
    this.group.add(mesh([T(annulus(r + 0.02, r + 0.42, 0.05, 40), [0, lift + 0.03, 0])], M.trimMat));
    this.group.add(mesh([T(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.02, 36), [0, lift - 0.04, 0])], this.dark = own({ color: rt.P.dark ?? '#34405e', flat: true })));
    this.rotor = new THREE.Group();
    this.rotor.position.y = lift;
    const n = o.great ? 8 : 6, blades = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      blades.push(T(new THREE.BoxGeometry(r * 0.82, 0.035, r * (o.great ? 0.3 : 0.36)), [Math.cos(a) * r * 0.52, 0, -Math.sin(a) * r * 0.52], [o.wall ? 0.35 : 0, a, 0], 1, 'YXZ'));
    }
    blades.push(T(new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.04, 16), [0, 0.005, 0]));
    this.rotor.add(mesh(blades, M.trimMat));
    this.glow = own({ color: rt.P.glow ?? '#9fdcef', glow: 0.12, flat: true });
    this.rotor.add(mesh([T(new THREE.TorusGeometry(r * 0.2, 0.05, 4, 20), [0, 0.02, 0], [Math.PI / 2, 0, 0]), T(new THREE.TorusGeometry(r * 0.97, 0.03, 4, 40), [0, 0, 0], [Math.PI / 2, 0, 0])], this.glow));
    this.group.add(this.rotor);
    noCollide(this.group);
    this.left = 0; this.w = 0; this.rock = 0;
    // (accepts the gust fan's 'gust', issue #377: a gust turns a great vane as the bellows' wash did)
    this.off = registerTarget({ kind: 'vane', radius: r, accepts: ['gust'], position: () => this.center, onHit: (mode, point, dir, info) => this.hit(mode, info) });
  }
  /** Is it turning (its element lit)? */
  get turning() { return this.rt.logic.isLit(this.id); }
  /** A splash: a small vane spins a while; a great one only rocks. A gust of the fan turns either a while (VANE_GUST s). */
  hit(mode, info = {}) {
    if (mode === 'gust') { this.spin(this.o.great ? VANE_GUST : this.coast, true); return true; }
    if (this.o.great) {
      this.rock = 0.7;
      this.rt.sound?.critter?.('creak', 0.6);
      if (!this.turning) this.rt.notice?.(this.o.heavy ?? 'The splash rocks the great vane a hand’s breadth, and it stops. It is too heavy for a splash: it wants a steady wind under it.', `vane.heavy.${this.id}`);
      return true;
    }
    this.spin(this.coast, false);
    return true;
  }
  /** Set it turning for s seconds (or keep it turning: the longer of what is left and s). */
  spin(s, washed) {
    const L = this.rt.logic;
    if (!L.isLit(this.id)) {
      if (!L.light(this.id)) return false;
      this.rt.sound?.whoosh?.();
      this.rt.onLit?.(this.id);
      this.rt.notice?.(washed ? this.o.washed : this.o.turning, `vane.turn.${this.id}.${washed ? 'jets' : 'splash'}`);
    }
    if (s > this.left) { this.left = s; this.warned = false; }
    return true;
  }
  /** A steady wash over it: the bellows' off open wings (the Warden's bellows: a save that found them before issue #377), or the debug jets burning; within reach over its face and not far off its axis. */
  washedBy(P) {
    if (!P || P.dead) return false;
    if (!(P.gliding && P.has?.('wardenbellows')) && !(P.jetFlight && P.jetPower > 0)) return false;
    const d = _dl.copy(P.pos).sub(this.center), along = d.dot(this.normal);
    if (along < 0.3 || along > this.reach) return false;
    return d.addScaledVector(this.normal, -along).length() < this.r + 1.2;
  }
  update(dt, t) {
    const P = this.rt.player, L = this.rt.logic;
    if (this.washedBy(P)) this.spin(this.linger, true);
    if (this.left > 0) {
      this.left -= dt;
      if (!this.warned && this.left < 2.2 && this.left > this.linger + 0.05) { this.warned = true; this.rt.rumble?.(0.6, 0.15); if (this.o.fading) this.rt.notice?.(this.o.fading, `vane.fading.${this.id}`); }
      if (this.left <= 0) { this.left = 0; L.quiet(this.id); this.rt.sound?.critter?.('creak', 0.5); }
    }
    // the blades: up to speed in a moment, slowing as the splash's push runs out, still once quiet
    const want = this.left > 0 ? 9 * Math.min(1, 0.35 + this.left / 3) : 0;
    this.w += (want - this.w) * Math.min(1, dt * (want > this.w ? 3 : 1.4));
    this.rock = Math.max(0, this.rock - dt);
    this.rotor.rotation.y += this.w * dt + Math.sin(this.rock * 18) * this.rock * 0.02;
    this.glow.uniforms.uGlow.value = 0.12 + 0.7 * Math.min(1, this.w / 6) + 0.05 * Math.sin(t * 2);
  }
  dispose() { this.off?.(); }
}

/**
 * An iris in a ceiling (the Warden's Well's gallery): blades round a round hole that slide back into the ceiling
 * when its condition holds (the logic's door `id`); solid while shut (from below it is a roof, from above a floor).
 * o: { id, at: [x, y, z] (its centre, the ceiling's top), r, t (thickness), lamps: [condition] (round its rim, under it) }
 */
export class Iris {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, r = (this.r = o.r ?? 3), t = (this.t = o.t ?? 0.6);
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.yaw;
    rt.root.add(this.group);
    const n = 8;
    this.blades = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / n + 0.06;
      const b = new THREE.Group();
      b.add(mesh([T(sector(0.02, r + 0.05, a0, a1, t - 0.04), [0, -0.02, 0])], M.wallGlyph));
      b.add(mesh([T(sector(r * 0.55, r * 0.62, a0 + 0.05, a1 - 0.1, 0.03), [0, 0.012, 0]), T(sector(r * 0.55, r * 0.62, a0 + 0.05, a1 - 0.1, 0.03), [0, -t + 0.03, 0])], M.trimMat));
      this.group.add(b);
      const mid = (a0 + a1) / 2;
      this.blades.push({ g: b, dx: Math.cos(mid), dz: Math.sin(mid) });
    }
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.2, flat: true });
    this.group.add(mesh([T(new THREE.TorusGeometry(r + 0.2, 0.08, 4, 48), [0, -t - 0.02, 0], [Math.PI / 2, 0, 0]), T(new THREE.TorusGeometry(r + 0.2, 0.08, 4, 48), [0, 0.03, 0], [Math.PI / 2, 0, 0])], this.glow));
    this.lamps = (o.lamps ?? []).map((cond, i, all) => {
      const m = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.05, flat: true });
      const a = (i / all.length) * Math.PI * 2 + Math.PI / 2;
      const lm = mesh([T(new THREE.SphereGeometry(0.28, 10, 8), [Math.cos(a) * (r + 0.7), o.up ? 0.3 : -t - 0.2, Math.sin(a) * (r + 0.7)])], m);   // (`up`: an iris in a floor, its lamps on it: issue #401)
      this.group.add(lm);
      return { cond, m };
    });
    noCollide(this.group);
    this.block = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, t, 24).translate(0, -t / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position);
    this.center = this.group.position.clone().add(V(0, -t, 0));
    this.k = rt.logic?.isOpen(o.id) ? 1 : 0;
    this.open = this.k > 0.5;
    this.apply();
  }
  init(physics) { this.physics = physics; if (!this.open) this.handle = physics.addCollider?.(this.block, NO_CLIMB) ?? null; }
  setOpen(open, instant = false) {
    if (open === this.open) return;
    this.open = open;
    if (open && this.handle) { this.physics?.removeCollider?.(this.handle); this.handle = null; }
    if (!open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block, NO_CLIMB) ?? null;
    if (instant) { this.k = open ? 1 : 0; this.apply(); }
    else { const S = this.rt.sound; if (S?.doorOpen) S.doorOpen(); else S?.whoosh?.(); this.rt.rumble?.(open ? 1.6 : 0.8, 0.35); }   // (the bolt's clunk at once, then the rush: issue #379)
  }
  apply() {
    // the blades slide out into the ceiling
    const k = ease(this.k);
    for (const b of this.blades) { b.g.position.set(b.dx * this.r * 1.05 * k, 0, b.dz * this.r * 1.05 * k); b.g.visible = k < 0.999; }
  }
  update(dt, t) {
    const want = this.open ? 1 : 0;
    if (this.k !== want) { this.k = THREE.MathUtils.clamp(this.k + (want ? dt / 1.8 : -dt / 0.9), 0, 1); this.apply(); }
    let met = 0;
    for (const l of this.lamps) {
      const on = this.open || !!this.rt.logic?.check(l.cond);
      if (on) met++;
      l.m.uniforms.uGlow.value += ((on ? 1 : 0.05) - l.m.uniforms.uGlow.value) * Math.min(1, dt * 6);
    }
    const wake = this.open ? 1 : this.lamps.length ? met / this.lamps.length : 0.2;
    this.glow.uniforms.uGlow.value = 0.2 + 0.7 * wake * (0.8 + 0.2 * Math.sin(t * 3));
  }
}

// ---------------------------------------------------------------------------------------- the engine (the Buried Machine)
/**
 * A piston-hammer of the engine (the Engine-House: a ball in the teeth stops the engine there). An iron head on a
 * piston rod strokes down onto a walkway and up again, driven by a crank wheel beside the way, and knocks whoever is
 * under it off the walkway. It runs while its element (`id`, a door in the logic) is shut; open (a ball jammed in
 * its crank's teeth), the wheel stops and the head hangs up, still. o: { id, at: [x, y, z] (the walkway under it),
 * w (across, x), d (along, z), top (m: the head's underside, up), period (s), crank: [x, y, z] (the wheel's centre),
 * r (the wheel's radius), knock (m/s: off the walkway, toward +x or -x, whichever side you are on), yaw }
 */
export class Hammer {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M;
    this.w = o.w ?? 2.6; this.d = o.d ?? 2.2; this.top = o.top ?? 5; this.period = o.period ?? 2.6;
    this.foot = K.world(...o.at);
    this.group = new THREE.Group();
    this.group.position.copy(this.foot);
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    // the head: an iron block banded, its face scored; the rod up to the ceiling
    this.head = new THREE.Group();
    this.iron = own({ color: rt.P.wall2 ?? '#b04a33', flat: true });
    this.head.add(mesh([box(this.w + 0.3, 1.5, this.d + 0.3, 0, 0.75, 0)], this.iron));
    this.head.add(mesh([box(this.w + 0.42, 0.22, this.d + 0.42, 0, 0.3, 0), box(this.w + 0.42, 0.22, this.d + 0.42, 0, 1.2, 0), box(0.5, 9, 0.5, 0, 6, 0)], M.trimMat));
    this.group.add(this.head);
    // the crank wheel beside the way: spokes and teeth, a notch at its foot where a ball jams it
    this.wheel = new THREE.Group();
    const r = (this.r = o.r ?? 1.5);
    if (o.crank) {
      this.wheel.position.copy(K.world(...o.crank)).sub(this.foot).applyAxisAngle(UP, -K.heading(o.yaw ?? 0));
      const parts = [T(new THREE.TorusGeometry(r, 0.18, 6, 28), [0, 0, 0], [0, Math.PI / 2, 0]), T(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12), [0, 0, 0], [0, 0, Math.PI / 2])];
      for (let i = 0; i < 4; i++) parts.push(T(new THREE.BoxGeometry(0.14, r * 2, 0.14), [0, 0, 0], [(i / 4) * Math.PI, 0, 0]));
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; parts.push(T(new THREE.BoxGeometry(0.28, 0.32, 0.3), [0, Math.cos(a) * (r + 0.18), Math.sin(a) * (r + 0.18)], [a, 0, 0])); }
      this.wheel.add(mesh(parts, M.trimMat));
      this.group.add(this.wheel);
    }
    noCollide(this.group);
    this.phase = 0.9; this.cool = 0;
    this.open = !!rt.logic?.isOpen(o.id);
    this.k = this.open ? 1 : 0;
    this.place();
  }
  setOpen(open) {
    if (open === this.open) return;
    this.open = open;
    this.rt.sound?.critter?.('clack', 0.9);
    this.rt.rumble?.(0.6, 0.4);
  }
  /** How far down the head is (0 up, 1 on the walkway) at a phase of its stroke: a fast fall, a rest, a slow rise. */
  static stroke(p) { if (p < 0.12) return ease(p / 0.12); if (p < 0.3) return 1; if (p < 0.8) return 1 - ease((p - 0.3) / 0.5); return 0; }
  get down() { return Hammer.stroke(this.phase); }
  place() {
    this.head.position.y = this.top * (1 - this.down);
    this.wheel.rotation.x = this.phase * Math.PI * 2;
  }
  update(dt) {
    // jammed: it finishes its rise and stops at the top (the pawl holds it there), the wheel still
    if (!this.open) this.phase = (this.phase + dt / this.period) % 1;
    else if (this.phase > 0.12 && this.phase < 0.8) this.phase = Math.min(0.8, this.phase + dt / this.period);
    this.place();
    this.cool = Math.max(0, this.cool - dt);
    const P = this.rt.player;
    if (!P || P.dead || P.down || this.cool > 0 || this.head.position.y > 2.2) return;
    const l = this.group.worldToLocal(_dl.copy(P.pos));
    if (Math.abs(l.x) < this.w / 2 + 0.5 && Math.abs(l.z) < this.d / 2 + 0.5 && l.y > -0.6 && l.y < this.head.position.y + 0.4) {
      this.cool = 1.5;
      const out = _dn.set(Math.sign(l.x) || 1, 0, 0).transformDirection(this.group.matrixWorld).multiplyScalar(this.o.knock ?? 8).addScaledVector(UP, 3);
      P.knockDown?.(out.clone(), { why: 'guardian' });
      P.hurt?.(sparing(heartsOf(P), DAMAGE.blow), 'guardian');
      this.rt.rumble?.(0.5, 0.5);
      this.rt.notice?.(this.o.hit ?? 'The hammer comes down and throws you off the walkway.', `hammer.${this.id}`);
    }
  }
}

// ---------------------------------------------------------------------------------------- bloom (Viridel)
/**
 * A sunbeam through a louvre in the roof (Viridel's Greenhouse: nothing grows in the shade). The louvre's slats
 * turn, and the beam falls on the first of its spots whose condition holds (a spot with none is where it rests);
 * none: the slats shut and there is no beam. It swings from spot to spot, slowly, so you see where the light went.
 * The light itself is the logic's (an eye's or a seed's `when`); this is how it looks: a soft shaft from the
 * louvre to a pool of light, and the warmth of it on what it lands on.
 * o: { from: [x, y, z] (the louvre, in the roof), w (its width), spots: [{ at, r, normal: [x, y, z], when }], yaw,
 * pick() (instead of the spots' conditions: the index of the spot it falls on, the Glasshouse's footstones) }
 */
export class Sunbeam {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit, M = rt.M;
    this.from = K.world(...o.from);
    this.spots = o.spots.map((p) => ({ ...p, pos: K.world(...p.at), n: V(...(p.normal ?? [0, 1, 0])).applyAxisAngle(UP, K.yaw).normalize() }));
    this.group = new THREE.Group();
    rt.root.add(this.group);
    this.poolMat = own({ color: '#fff4cf', glow: 0.7, flat: true });
    // the louvre: a frame of trim round five slats that turn
    const w = o.w ?? 3.2;
    this.louvre = new THREE.Group();
    this.louvre.position.copy(this.from);
    this.louvre.rotation.y = K.heading(o.yaw ?? 0);
    this.louvre.add(mesh([box(w + 0.5, 0.25, 0.25, 0, 0, -w / 2 - 0.1), box(w + 0.5, 0.25, 0.25, 0, 0, w / 2 + 0.1), box(0.25, 0.25, w + 0.4, -w / 2 - 0.1, 0, 0), box(0.25, 0.25, w + 0.4, w / 2 + 0.1, 0, 0)], M.trimMat));
    this.slats = [];
    for (let i = 0; i < 5; i++) { const sl = mesh([box(w, 0.08, w / 5 + 0.05)], M.trimMat); sl.position.z = -w / 2 + (i + 0.5) * w / 5; this.louvre.add(sl); this.slats.push(sl); }
    this.group.add(this.louvre);
    // the light: a soft shaft from the louvre to the pool, washes over the finished picture (src/veil.js LightShaft,
    // the skull cave's way: issue #116; it was nine thin glowing bars, "weird 3d shapes")
    this.w = w;
    this.shaft = new LightShaft(rt.veils, this.group, { color: '#fff1c2', alpha: [0.18, 0.2], near: 2.5 });   // (brighter than the cave's: on white walls)
    this.pool = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.04, 28), this.poolMat);
    this.group.add(this.pool);
    noCollide(this.group);
    this.light = new THREE.Vector4(0, -1e5, 0, 0);
    rt.lights?.push(this.light);
    const s = this.want();
    this.at = (s?.pos ?? this.from).clone(); this.r = s?.r ?? 0.1; this.n = (s?.n ?? UP).clone();
    this.k = s ? 1 : 0;
    this._a = V(); this._b = V(); this._c = V();
  }
  /** The spot it falls on now (the first whose condition holds; o.pick() → its index, when the temple decides), or null. */
  want() { if (this.o.pick) return this.spots[this.o.pick()] ?? null; return this.spots.find((p) => !p.when || this.rt.logic.check(p.when)) ?? null; }
  /** Is a point (world) in its light now (in the pool, within r, settled there)? */
  lights(p, pad = 0) { return this.k > 0.9 && !this.moving && Math.hypot(p.x - this.at.x, p.z - this.at.z) < this.r + pad && Math.abs(p.y - this.at.y) < 3; }
  update(dt, t) {
    const s = this.want();
    this.k = THREE.MathUtils.clamp(this.k + (s ? dt / 0.8 : -dt / 0.8), 0, 1);
    if (s) {
      // it swings over to the new spot (1.5 s or so), its pool easing to the new size and the surface's way
      const d = this.at.distanceTo(s.pos);
      this.moving = d > 0.05;
      if (this.moving) this.at.lerp(s.pos, Math.min(1, dt * 2.6 + (d < 0.4 ? 0.2 : 0)));
      this.r += ((s.r ?? 2) - this.r) * Math.min(1, dt * 3);
      this.n.lerp(s.n, Math.min(1, dt * 3)).normalize();
    }
    const k = this.k;
    for (const sl of this.slats) sl.rotation.x = k * 1.15;   // (open: the slats turned edge-on to the sun)
    const show = k > 0.02;
    this.pool.visible = show;
    this.shaft.visible = show;
    if (!show) { this.light.set(0, -1e5, 0, 0); return; }
    // the pool, flush on what it lights (a floor, a wall)
    this.pool.position.copy(this.at).addScaledVector(this.n, 0.05);
    this.pool.quaternion.setFromUnitVectors(UP, this.n);
    this.pool.scale.set(this.r * k, 1, this.r * k);
    this.poolMat.uniforms.uGlow.value = 0.45 + 0.3 * k + 0.05 * Math.sin(t * 1.3);
    // the shaft: from the louvre's opening (level, in the roof) to the pool's rim (flat on what it lights)
    this.shaft.set(this.from, this.w * 0.45, this._c.copy(this.at).addScaledVector(this.n, 0.06), this.r * 0.95, { topN: UP, bottomN: this.n }).fade(k);
    this.light.set(this.at.x, this.at.y + 2, this.at.z, 7 * k);
  }
}

const BLOOMS = ['#f2a7b8', '#f6d36a', '#ffffff', '#b7a0cf', '#ef7e62'];

/**
 * A seed of the makers in a stone ring (Viridel's Greenhouse): a dry husk that only a bloom glob (the 'bloom'
 * mode) wakes. It sprouts and flowers, and element `id` (a 'switch' that needs the bloom mode) is lit for
 * good: what it grows (a vine bridge, a vine up a glass wall, a planter's flowers) is the logic's to show.
 * Plain fluid only soaks it. o: { id, at (its foot), yaw, size, seed, drink, burn }
 */
export class Seed {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, s = this.s = o.size ?? 1;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    // the ring of stone, the dark earth in it, the husk
    this.group.add(mesh([lathe([[1.3 * s, 0], [1.35 * s, 0.5 * s], [1.1 * s, 0.6 * s], [1.0 * s, 0.4 * s], [0.01, 0.4 * s]], 16)], M.trimMat));
    this.husk = own({ color: '#9a7448', flat: true });
    this.huskMesh = mesh([T(new THREE.SphereGeometry(0.45 * s, 10, 8).scale(1, 1.3, 1), [0, 0.75 * s, 0]), T(new THREE.ConeGeometry(0.12 * s, 0.6 * s, 6), [0, 1.35 * s, 0])], this.husk);
    this.group.add(this.huskMesh);
    // what grows: a stem, leaves, a head of flowers (scaled up from nothing)
    this.sprout = new THREE.Group();
    this.sprout.position.y = 0.45 * s;
    const stem = own({ color: '#4f8a5a', flat: true }), leaf = own({ color: '#7fcf72', flat: true }), petals = own({ color: BLOOMS[(o.seed ?? 0) % BLOOMS.length], glow: 0.2, flat: true });
    const lv = [];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; lv.push(T(new THREE.SphereGeometry(1, 8, 5).scale(0.55 * s, 0.1 * s, 0.25 * s).translate(0.55 * s, 0, 0), [0, (0.5 + i * 0.35) * s, 0], [0, a, 0.35])); }
    this.sprout.add(mesh([T(new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 2.2 * s, 6), [0, 1.1 * s, 0])], stem), mesh(lv, leaf));
    const ph = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ph.push(T(new THREE.SphereGeometry(1, 8, 5).scale(0.35 * s, 0.08 * s, 0.2 * s).translate(0.32 * s, 0, 0), [0, 2.25 * s, 0], [0, a, -0.4])); }
    ph.push(T(new THREE.SphereGeometry(0.16 * s, 8, 6), [0, 2.28 * s, 0]));
    this.sprout.add(mesh(ph, petals));
    this.group.add(this.sprout);
    noCollide(this.group);
    this.center = this.group.position.clone().addScaledVector(UP, 0.9 * s);
    this.on = rt.logic.isLit(o.id);
    this.k = this.on ? 1 : 0;
    this.apply();
    this.off = registerTarget({ kind: 'seed', radius: 1.1 * s, accepts: ['bloom', 'fire'], position: () => this.center, enabled: () => !this.on, onHit: (mode) => this.hit(mode) });
  }
  hit(mode) {
    if (this.on) return false;
    if (mode === 'bloom') {
      if (this.rt.logic.light(this.id)) { this.on = true; this.rt.sound?.chime?.(); this.rt.sound?.whoosh?.(); this.rt.onLit?.(this.id); }
      else if (this.rt.logic.el(this.id)?.when) { const w = this.o.why?.() ?? 'shade'; this.pale = 1.2; this.rt.notice?.(this.o[w] ?? this.o.shade ?? 'It sprouts, pale, reaching for light that isn’t there, and folds back into its husk. Nothing grows in the shade.', `${this.id}.${w}`); }   // (why: what it lacks, the sun or, issue #411, the water)
      return true;
    }
    if (mode === 'fire') { this.rt.notice?.(this.o.burn ?? 'The husk only blackens at the edges. A seed wants to grow, not to burn.', 'seed.burn'); return true; }
    this.wobble = 0.5;
    this.rt.notice?.(this.o.drink ?? 'The husk soaks up the water, and stays a seed. Something in it is waiting to be told to grow.', 'seed.drink');
    return true;
  }
  apply() {
    const k = ease(this.k);
    this.sprout.scale.setScalar(Math.max(0.001, k));
    this.sprout.visible = k > 0.002;
    this.huskMesh.scale.setScalar(1 - 0.6 * k);
  }
  update(dt, t) {
    this.on ||= this.rt.logic.isLit(this.id);
    if (this.on && this.k < 1) { this.k = Math.min(1, this.k + dt / 1.4); this.apply(); }
    // bloomed in the shade: a pale shoot comes up and folds back
    if (!this.on && this.pale > 0) { this.pale = Math.max(0, this.pale - dt); this.k = Math.sin(Math.min(1, this.pale / 1.2) * Math.PI) * 0.35; this.apply(); }
    if (this.wobble) { this.wobble = Math.max(0, this.wobble - dt); this.huskMesh.rotation.z = Math.sin(this.wobble * 28) * this.wobble * 0.3; }
    if (this.on) this.sprout.rotation.z = Math.sin(t * 1.3 + (this.o.seed ?? 0)) * 0.04;
  }
  dispose() { this.off?.(); }
}

/**
 * A flower-door (Viridel's Greenhouse): a doorway shut by a great bud, its petals hinged round the rim and
 * folded in over the opening. A bloom glob opens it: element `bloom` (a 'switch' that needs the bloom mode)
 * is lit, and the door `id` (which opens on it) folds its petals back against the wall, for good. Plain fluid
 * only beads on it, fire makes it curl tighter. Solid while shut. o: { id, bloom, at (the doorway's foot), yaw, w, h, color,
 * dry (bloom: null, a bud something else opens, the Greenhouse's vine into it: what a bloom glob says) }
 */
export class Bud {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.bloom = o.bloom; this.o = o;
    const K = rt.kit, w = o.w ?? 5, h = o.h ?? 6.4;
    this.w = w; this.h = h;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.skin = own({ color: o.color ?? '#f6c7d0', flat: true });
    const vein = own({ color: '#e58aa0', flat: true }), sepal = own({ color: '#5f9a52', flat: true });
    // seven petals on an oval rim round the doorway's middle, each pointing in at the middle
    const cy = h / 2, rx = w / 2 + 0.1, ry = h / 2 + 0.1;
    this.petals = [];
    const N = 7;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.PI / 2;
      const hinge = new THREE.Group();
      hinge.position.set(Math.cos(a) * rx, cy + Math.sin(a) * ry, 0);
      hinge.rotation.z = a - Math.PI / 2;   // its local -y points in at the middle
      const reach = Math.hypot(Math.cos(a) * rx, Math.sin(a) * ry) * 1.08;
      const p = new THREE.Group();
      hinge.add(p);
      p.add(mesh([new THREE.SphereGeometry(1, 12, 8).scale(Math.min(2.4, reach * 0.62), reach / 2, 0.32).translate(0, -reach / 2, (i % 2 ? 0.12 : -0.12))], this.skin));
      p.add(mesh([box(0.12, reach * 0.8, 0.7, 0, -reach * 0.45, 0)], vein));
      this.group.add(hinge);
      this.petals.push({ hinge, p, i });
    }
    // green sepals round the rim (they stay)
    const sp = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; sp.push(T(new THREE.ConeGeometry(0.35, 1.3, 5), [Math.cos(a) * (rx + 0.3), cy + Math.sin(a) * (ry + 0.3), 0], [0, 0, a - Math.PI / 2])); }
    this.group.add(mesh(sp, sepal));
    noCollide(this.group);
    this.block = new THREE.Mesh(box(w, h, 1.6, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.center = this.group.position.clone().addScaledVector(UP, h * 0.5);
    this.open = rt.logic.isOpen(o.id);
    this.k = this.open ? 1 : 0; this.curl = 0;
    this.off = registerTarget({ kind: 'bud', radius: Math.max(w, h) * 0.45, accepts: ['bloom', 'fire'], position: () => this.center, enabled: () => !this.open, onHit: (mode) => this.hit(mode) });
    this.apply(0);
  }
  init(physics) { this.physics = physics; if (!this.open) this.handle = physics.addCollider?.(this.block, NO_CLIMB) ?? null; }
  hit(mode) {
    if (this.open) return false;
    if (mode === 'bloom') {
      if (this.bloom && this.rt.logic.light(this.bloom)) { this.rt.sound?.chime?.(); this.rt.onLit?.(this.bloom); this.rt.notice?.(this.o.opened ?? 'The bud swells, and splits, and its petals fold back against the wall like a hand opening.', `bud.${this.id}`); }
      else if (!this.bloom && this.o.dry) { this.curl = 0.4; this.rt.notice?.(this.o.dry, `bud.dry.${this.id}`); }
      // (a bud whose bloom wants the sun, `when`: in the shade it stirs and stays shut, the Greenhouse's Bud Passage)
      else if (this.bloom && this.rt.logic.el(this.bloom)?.when && !this.rt.logic.check(this.rt.logic.el(this.bloom).when)) { const w = this.o.why?.() ?? 'shade'; this.curl = 0.4; this.rt.notice?.(this.o[w] ?? this.o.shade ?? 'The bud stirs, and stays shut. It is in the shade.', `bud.${w}.${this.id}`); }
      return true;
    }
    if (mode === 'fire') { this.curl = 1.5; this.rt.notice?.(this.o.burnt ?? 'The petals curl away from the ember and close tighter.', 'bud.fire'); return true; }
    this.curl = 0.4;
    this.rt.notice?.(this.o.wet ?? 'The water beads on the petals and runs off. The bud stays shut: it is waiting to be told to grow.', 'bud.wet');
    return true;
  }
  /** Someone stands in the doorway (a held door waits for them to step through before it shuts). */
  inDoorway(p = this.rt.player) {
    if (!p?.pos) return false;
    const l = this.group.worldToLocal(_dl.copy(p.pos));
    return Math.abs(l.x) < this.w / 2 + 0.6 && Math.abs(l.z) < 1.4 && l.y > -1 && l.y < this.h;
  }
  setOpen(open, instant = false) {
    this.wantShut = false;
    if (open === this.open) return;
    if (!open && !instant && this.inDoorway()) { this.wantShut = true; return; }
    this.open = open;
    if (open && this.handle) { this.physics?.removeCollider?.(this.handle); this.handle = null; }
    if (!open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block, NO_CLIMB) ?? null;
    if (instant) this.k = open ? 1 : 0;
    else this.rt.rumble?.(1.0, 0.25);
  }
  apply(t) {
    const k = ease(this.k), c = Math.min(1, this.curl);
    for (const { p, i } of this.petals) {
      // shut: folded in over the doorway (a little breathing); open: swung out and back against the wall
      p.rotation.x = (1 - k) * (0.05 * Math.sin(t * 1.2 + i) - c * 0.12) - k * 1.75 * (i % 2 ? 1 : -1);
      p.scale.setScalar(1 - 0.08 * c);
    }
  }
  update(dt, t) {
    this.curl = Math.max(0, this.curl - dt);
    if (this.open && this.k < 1) this.k = Math.min(1, this.k + dt / 2.2);
    if (!this.open && this.k > 0) this.k = Math.max(0, this.k - dt / 0.9);   // (held shut behind you: an arena's door)
    this.apply(t);
  }
  dispose() { this.off?.(); }
}

/**
 * A pane of greenhouse glass over a wall (Viridel): too smooth to climb (you slip off it) until a vine has
 * grown up it, which happens when `when` holds (a seed at its foot, bloomed). o: { at (the foot's middle,
 * local, on the wall's face), yaw (facing out of the wall), w, h, when: condition, slip: text, color }
 * rungs: true (the Underwater City's Whale-House): brass rungs slide out of the pane's frame instead of a vine
 * growing, and slide back in when `when` fails again (a held note: climbable only while it rings).
 */
export class Glass {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit, w = this.w = o.w ?? 8, h = this.h = o.h ?? 10;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    const pane = own({ color: o.color ?? '#cfe9e0', glow: 0.12, flat: true });
    this.group.add(mesh([box(w, h, 0.12, 0, h / 2, 0.08)], pane));
    // the mullions: a grid of thin white bars
    const bars = [], nx = Math.max(1, Math.round(w / 1.6)), ny = Math.max(1, Math.round(h / 2));
    for (let i = 0; i <= nx; i++) bars.push(box(0.12, h, 0.18, -w / 2 + (i / nx) * w, h / 2, 0.16));
    for (let j = 0; j <= ny; j++) bars.push(box(w, 0.12, 0.18, 0, (j / ny) * h, 0.16));
    this.group.add(mesh(bars, rt.M.trimMat));
    // the vine that grows up it: stems in a lazy zigzag, leaves all along, a few flowers (or the brass rungs: o.rungs)
    this.vine = new THREE.Group();
    const stems = [], leaves = [], flowers = [];
    if (o.rungs) {
      const rungs = [];
      for (let j = 1; j * 0.75 < h; j++) for (const x0 of [-w * 0.3, 0, w * 0.3]) rungs.push(box(1.1, 0.09, 0.3, x0, j * 0.75, 0.32));
      this.vine.add(mesh(rungs, own({ color: '#c9973f', flat: true })));
    } else for (const x0 of [-w * 0.22, w * 0.18]) {
      const pts = [];
      for (let j = 0; j <= 10; j++) pts.push(V(x0 + Math.sin(j * 1.3 + x0) * 0.9, (j / 10) * (h + 0.6), 0.45));
      stems.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.16, 5));
      for (let j = 0; j < 18; j++) { const p = pts[Math.floor(j / 18 * 10)]; leaves.push(T(new THREE.SphereGeometry(1, 7, 4).scale(0.5, 0.28, 0.1), [p.x + ((j % 2) * 2 - 1) * 0.45, p.y + (j % 3) * 0.3, 0.5], [0, 0, j * 0.9])); }
      for (let j = 2; j < 10; j += 3) flowers.push(T(new THREE.SphereGeometry(0.22, 8, 6), [pts[j].x + 0.4, pts[j].y, 0.6]));
    }
    if (!o.rungs) this.vine.add(mesh(stems, own({ color: '#4f8a5a', flat: true })), mesh(leaves, own({ color: '#7fcf72', flat: true })), mesh(flowers, own({ color: '#f2a7b8', glow: 0.25, flat: true })));
    // (down: it grows from the top of the pane down to its foot, a vine let down from a gallery: the Builders' Greenhouse's, issue #411)
    if (o.down) { this.vine.position.y = h + 0.6; for (const c of this.vine.children) c.position.y -= h + 0.6; }
    this.group.add(this.vine);
    noCollide(this.group);
    this.k = this.grown ? 1 : 0;
    this.apply();
  }
  get grown() { return !!this.o.when && this.rt.logic.check(this.o.when); }
  apply() { const k = ease(this.k); this.vine.scale.set(1, Math.max(0.001, k), 1); this.vine.visible = k > 0.002; }
  update(dt) {
    const g = this.grown;
    if (g && this.k < 1) { this.k = Math.min(1, this.k + dt / (this.o.rungs ? 0.8 : 2.4)); this.apply(); }
    if (g) return;
    if (this.o.rungs && this.k > 0) { this.k = Math.max(0, this.k - dt / 0.6); this.apply(); }   // (the rungs slide back in)
    // too smooth to hold: you slip off it
    const P = this.rt.player;
    if (!P?.climbing) return;
    const l = this.group.worldToLocal(_dl.copy(P.pos));
    if (Math.abs(l.x) < this.w / 2 + 0.6 && l.z > -0.5 && l.z < 1.8 && l.y > -1.5 && l.y < this.h + 0.5) {
      P.climbing = false;
      P.vel.copy(_dn.set(0, 0, 1).transformDirection(this.group.matrixWorld).multiplyScalar(2.2)).setY(-1);
      P._climbCooldown = 1.2;
      this.rt.notice?.(this.o.slip ?? 'The glass is too smooth to hold. Something would have to grow up it first.', 'glass.slip');
    }
  }
}

// ---------------------------------------------------------------------------------------- echoes (the Signal Market)
/** The notes the makers' stones sing: a scale degree (src/audio.js orbNote) and a colour each. */
export const NOTES = {
  low: { degree: 0, color: '#f2b14e', name: 'low' },
  mid: { degree: 2, color: '#62c3c9', name: 'middle' },
  high: { degree: 4, color: '#e58aa0', name: 'high' },
  // the whales' note (the Underwater City's Whale-House): the whale-horn sounds it (src/items.js 'horn', src/boxes/effects.js)
  deep: { degree: -3, color: '#6f8fd8', name: 'deep' },
  // (issue #418, the Undertower) a blast's boom: only an ink bomb sounds it (src/temples/bazaar.js hears 'gadget:blast'),
  // and the First Sign's one word as its cables say it while the house speaks
  boom: { degree: -5, color: '#5a4a7a', name: 'boom' },
  'sign.0': { degree: 1, color: '#fff0bd', name: 'word' },
};

/**
 * A singing stone of the makers (the Signal Market's Undertower): splash it and it sings one note, a ring of
 * light pulsing out; the echo shell (src/echo-shell.js), carried within earshot, catches it (game event
 * 'note' { pos, note, degree, color, label }). o: { note: 'low' | 'mid' | 'high', at (its foot), yaw, h, shape: 'egg' }
 */
export class EchoStone {
  constructor(rt, o) {
    this.rt = rt; this.o = o; this.note = o.note;
    const N = NOTES[o.note] ?? NOTES.mid;
    this.N = N;
    const K = rt.kit, M = rt.M, h = o.h ?? 3.2;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.glow = own({ color: N.color, glow: 0.15, flat: true });
    const bands = [];
    if (o.shape === 'egg') {
      // an egg of pale stone in a brass cup (the Undertower's gallery): its width a little over a third of its height
      const R = h * 0.36, prof = [];
      for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI, y = (1 - Math.cos(a)) / 2; prof.push([Math.max(0.01, Math.sin(a) * R * (1 - 0.18 * y)), 0.15 + y * (h - 0.15)]); }
      this.group.add(mesh([lathe(prof, 14)], M.stoneMat));
      this.group.add(mesh([lathe([[R * 0.8, 0], [R * 0.86, 0.12], [R * 0.7, 0.4], [R * 0.6, 0.42], [0.01, 0.42]], 14)], M.trimMat));
      for (const y of [0.3, 0.5]) bands.push(T(new THREE.TorusGeometry(R * (0.96 - Math.abs(y - 0.45) * 0.4), 0.05, 4, 24), [0, h * y, 0], [Math.PI / 2, 0, 0]));
      bands.push(T(glyphGeometry(R * 0.9, 0.05), [0, h * 0.62, R * 0.92]));
    } else {
      this.group.add(mesh([lathe([[0.9, 0], [0.95, 0.3], [0.7, 0.45], [0.62, h * 0.9], [0.4, h], [0.01, h + 0.1]], 8)], M.stoneMat));
      for (const y of [0.35, 0.55, 0.75]) bands.push(T(new THREE.TorusGeometry(0.66 - y * 0.12, 0.07, 4, 20), [0, h * y, 0], [Math.PI / 2, 0, 0]));
      bands.push(T(glyphGeometry(0.8, 0.06), [0, h * 0.62, 0.64]));
    }
    this.group.add(mesh(bands, this.glow));
    // the ring of light that pulses out when it sings
    this.ringM = own({ color: N.color, glow: 0.8, flat: true });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 4, 40).rotateX(Math.PI / 2), this.ringM);
    this.ring.position.y = h * 0.6;
    this.ring.visible = false;
    this.group.add(this.ring);
    noCollide(this.group);
    this.center = this.group.position.clone().addScaledVector(UP, h * 0.6);
    this.flash = 0;
    this.off = registerTarget({ kind: 'switch', radius: o.shape === 'egg' ? h * 0.36 : 1.1, position: () => this.center, onHit: () => this.sing() });
  }
  sing() {
    this.flash = 1.6;
    this.rt.sound?.orbNote?.(this.N.degree, this.center, { size: 0.8 });
    this.rt.game?.emit?.('note', { pos: this.center.clone(), note: this.note, degree: this.N.degree, color: this.N.color, label: `the ${this.N.name} stone’s note` });
    return true;
  }
  update(dt, t) {
    this.flash = Math.max(0, this.flash - dt);
    const k = this.flash / 1.6;
    this.glow.uniforms.uGlow.value = 0.15 + 0.05 * Math.sin(t * 1.4) + 0.8 * k;
    this.ring.visible = k > 0.01;
    if (this.ring.visible) { this.ring.scale.setScalar(1 + (1 - k) * 9); this.ringM.uniforms.uGlow.value = 0.9 * k; }
  }
  dispose() { this.off?.(); }
}

/**
 * Something that listens for a note played back close to it (the echo shell's game event 'echo' { pos, note }):
 * its own note, within `reach`, lights element `id` (a 'switch' that needs the shell); another note it only
 * shrugs off. A horn of brass on a post (or over a door's lintel: o.lintel), ringed in its note's colour.
 * o: { id, note, at, yaw, reach, lintel, hears, stand, size, body (its bell's colour), heard, wrong, fading }
 *   hears: 'echo' (the shell played back: the default), 'note' (a stone's own song, no shell needed) or 'both'
 *   stand: the post's height (2.4 m); size: the horn's scale (1)
 * An element with `hold: s` (logic.js) is not latched: the horn rings s seconds after it hears its note (heard
 * again, it starts over; 2.5 s before the end it says `fading`), then falls quiet (logic.quiet), like the
 * Founders' Belfry's held bells.
 */
export class EchoEar {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o; this.note = o.note;
    const N = NOTES[o.note] ?? NOTES.mid;
    const K = rt.kit, M = rt.M;
    this.reach = o.reach ?? 7;
    this.hold = rt.logic.el?.(o.id)?.hold ?? 0;
    this.left = 0;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    const stand = o.stand ?? 2.4, sz = o.size ?? 1;
    const y = o.lintel ? 0 : stand;
    if (!o.lintel) this.group.add(mesh([T(new THREE.CylinderGeometry(0.16 * Math.sqrt(sz), 0.22 * Math.sqrt(sz), stand, 8), [0, stand / 2, 0]), T(new THREE.CylinderGeometry(0.5 * sz, 0.6 * sz, 0.25, 12), [0, 0.12, 0])], M.trimMat));
    // the horn: a flared bell of brass facing out, its mouth ringed in the note's colour
    this.group.add(mesh([T(lathe([[0.12, 0], [0.18, 0.5], [0.35, 0.9], [0.75, 1.15], [0.8, 1.2]], 14).scale(sz, sz, sz), [0, y, -0.4 * sz], [Math.PI / 2, 0, 0])], own({ color: o.body ?? '#d8a24a', flat: true, side: THREE.DoubleSide })));   // (body: its bell's colour, brass but for the Undertower's black horn, issue #418)
    this.glow = own({ color: N.color, glow: 0.2, flat: true });
    this.group.add(mesh([T(new THREE.TorusGeometry(0.78 * sz, 0.07 * Math.sqrt(sz), 4, 24), [0, y, 0.82 * sz])], this.glow));
    noCollide(this.group);
    this.at = this.group.position.clone().addScaledVector(UP, y);
    this.lit = rt.logic.isLit(o.id);
    const hears = o.hears ?? 'echo';
    const listen = ({ pos, note } = {}) => {
      if (!pos || pos.distanceTo(this.at) > this.reach) return;
      if (this.hold && this.lit && note === this.note) { this.left = this.hold; this.warned = false; return; }   // (heard again: the note starts over)
      if (this.lit) return;
      if (note === this.note) {
        if (rt.logic.light(this.id)) {
          this.lit = true;
          if (this.hold) { this.left = this.hold; this.warned = false; }
          rt.sound?.chime?.(); rt.notice?.(o.heard ?? 'It hears its own note, played back close by, and answers.', o.heard && this.hold ? `ear.heard.${this.id}` : null); rt.onLit?.(this.id);
        } else if (rt.logic.el?.(this.id)?.when && !rt.logic.check(rt.logic.el(this.id).when)) { this.shrug = 0.8; rt.notice?.(o.deaf ?? 'It hears nothing: it is deaf.', `ear.deaf.${this.id}`); }   // (deaf until its `when` holds: the Undertower's passage horn, v1.49)
      } else if (typeof note === 'string' && !note.startsWith('sign.')) { this.shrug = 0.8; rt.notice?.(o.wrong ?? `It hears the note, and stays still: it listens for the ${N.name} one.`, `ear.wrong.${this.id}`); }
    };
    const offs = [];
    if (hears !== 'note') offs.push(rt.game?.on?.('echo', listen));
    if (hears !== 'echo') offs.push(rt.game?.on?.('note', listen));
    this.off = () => { for (const f of offs) f?.(); };
    this.shrug = 0;
  }
  /** Seconds left of a held note (0: quiet). */
  get ringing() { return this.left; }
  update(dt, t) {
    if (this.hold) {
      this.lit = this.rt.logic.isLit(this.id);
      if (this.left > 0) {
        this.left -= dt;
        if (this.left < 2.5 && !this.warned) { this.warned = true; this.rt.rumble?.(0.8, 0.2); if (this.o.fading) this.rt.notice?.(this.o.fading, `ear.fading.${this.id}`); }
        if (this.left <= 0) { this.left = 0; this.lit = false; this.rt.logic.quiet(this.id); }
      }
    } else this.lit ||= this.rt.logic.isLit(this.id);
    this.shrug = Math.max(0, this.shrug - dt);
    const fade = this.hold && this.left > 0 && this.left < 2.5 ? 0.6 + 0.4 * Math.sin(t * 12) : 1;
    this.glow.uniforms.uGlow.value = this.lit ? 0.9 * fade : 0.2 + 0.08 * Math.sin(t * 2) + this.shrug * 0.4;
  }
  dispose() { this.off?.(); }
}

/**
 * A pair of the makers' receiving dishes (the Signal Market's Undertower): a note sung or played into the near
 * dish's mouth comes out of the far one's a moment later, as if sung there (the same game event, 'note' or
 * 'echo', marked `relayed`: a dish never passes on what another dish said). It only carries while `when` holds
 * (a stone ball on its footstone: a logic.js condition); dark, it hears nothing.
 * o: { id?, at, yaw, tilt, r, reach (4.5 m round its mouth), when, to: { at, yaw, tilt, r }, delay (0.6 s), dark }
 */
export class Dish {
  constructor(rt, o) {
    this.rt = rt; this.o = o; this.id = o.id;
    this.reach = o.reach ?? 4.5; this.delay = o.delay ?? 0.6;
    this.glow = own({ color: '#fff0bd', glow: 0.08, flat: true });
    this.ends = [o, o.to].filter(Boolean).map((d) => this.build(d));
    this.queue = [];
    const offs = [];
    for (const type of ['note', 'echo']) offs.push(rt.game?.on?.(type, (e = {}) => this.hear(type, e)));
    this.off = () => { for (const f of offs) f?.(); };
  }
  build(d) {
    const K = this.rt.kit, M = this.rt.M, r = d.r ?? 2.6, fl = r * 0.7;
    const g = new THREE.Group();
    g.position.copy(K.world(...d.at));
    g.rotation.set(d.tilt ?? 0, K.heading(d.yaw ?? 0), 0, 'YXZ');
    this.rt.root.add(g);
    const prof = []; for (let i = 0; i <= 8; i++) { const q = (i / 8) * r; prof.push([Math.max(0.01, q), (q * q) / (4 * fl)]); }
    g.add(mesh([lathe(prof, 22).rotateX(Math.PI / 2)], this.cream ??= own({ color: '#f5dfab', flat: true, side: THREE.DoubleSide })));
    g.add(mesh([T(new THREE.TorusGeometry(r, 0.12, 4, 28), [0, 0, r * r / (4 * fl)]), T(new THREE.CylinderGeometry(0.18, 0.3, r * 0.9, 8), [0, -r * 0.5, -0.3])], M.trimMat));
    g.add(mesh([T(new THREE.ConeGeometry(0.25, 1.0, 8).rotateX(Math.PI / 2), [0, 0, r * 0.6]), T(new THREE.TorusGeometry(r * 0.35, 0.06, 4, 20), [0, 0, r * 0.09])], this.glow));
    // the ring of sound it sends out when it carries a note
    const ringM = own({ color: '#fff0bd', glow: 0.8, flat: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 4, 36), ringM);
    ring.position.z = r * 0.7; ring.visible = false;
    g.add(ring);
    noCollide(g);
    g.updateMatrixWorld(true);
    const mouth = new THREE.Vector3(0, 0, r * 0.7).applyMatrix4(g.matrixWorld);
    return { g, mouth, ring, ringM, r, k: 0 };
  }
  get awake() { return !this.o.when || !!this.rt.logic.check(this.o.when); }
  /** Something sang near its mouth: carried to the far dish, if it is awake. */
  hear(type, e) {
    if (e.relayed || !e.pos || this.ends.length < 2) return;
    const near = this.ends[0];
    if (e.pos.distanceTo(near.mouth) > this.reach) return;
    if (!this.awake) { this.rt.notice?.(this.o.dark ?? 'The dish is dark: it hears nothing.', `dish.dark.${this.id ?? 0}`); return; }
    near.k = 1;
    this.queue.push({ type, e, t: this.delay });
  }
  update(dt, t) {
    this.glow.uniforms.uGlow.value = this.awake ? 0.55 + 0.2 * Math.sin(t * 2.2) : 0.08;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.t -= dt;
      if (q.t > 0) continue;
      this.queue.splice(i, 1);
      const far = this.ends[1];
      far.k = 1;
      this.rt.sound?.orbNote?.(q.e.degree ?? 0, far.mouth, { size: 0.9 });
      this.rt.game?.emit?.(q.type, { ...q.e, pos: far.mouth.clone(), relayed: true, via: this.id });   // (via: which dish carried it)
    }
    for (const end of this.ends) {
      end.k = Math.max(0, end.k - dt / 1.2);
      end.ring.visible = end.k > 0.01;
      if (end.ring.visible) { end.ring.scale.setScalar(0.4 + (1 - end.k) * end.r * 1.6); end.ringM.uniforms.uGlow.value = 0.9 * end.k; }
    }
  }
  dispose() { this.off?.(); }
}

// ---------------------------------------------------------------------------------------- moving floors
export class Platform {
  /** o: { id?, path: [[x, y, z]...] (its top's centre), r, speed (m/s), pause (s at each end), when?: condition to move } */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M;
    this.path = o.path.map((p) => K.world(...p));
    this.r = o.r ?? 2.2;
    this.group = new THREE.Group();
    rt.root.add(this.group);
    const th = o.thick ?? 0.8;
    this.group.add(mesh([T(new THREE.CylinderGeometry(this.r, this.r * 0.85, th, 28), [0, -th / 2, 0])], M.floor));
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.5, flat: true });
    this.group.add(mesh([T(new THREE.TorusGeometry(this.r * 0.92, 0.07, 4, 40), [0, -th - 0.02, 0], [Math.PI / 2, 0, 0]), T(glyphGeometry(this.r * 0.9, 0.04).rotateX(-Math.PI / 2), [0, -th - 0.05, 0], [Math.PI, 0, 0])], this.glow));
    // the rim's band, flush with the top (a lip standing 14 cm proud of it swallowed the feet of whoever stood by the edge)
    this.group.add(mesh([T(new THREE.TorusGeometry(this.r - 0.1, 0.12, 5, 40), [0, -0.1, 0], [Math.PI / 2, 0, 0])], M.trimMat));
    noCollide(this.group);
    this.solid = { pos: V(), r: this.r, top: 0, bottom: 0, vel: V(), flat: true };   // (flat: a level disc to its rim, src/contact-audit.js)
    // a closed path as a ping-pong: lengths of its legs
    this.legs = [];
    for (let i = 0; i < this.path.length - 1; i++) this.legs.push(this.path[i].distanceTo(this.path[i + 1]));
    this.total = this.legs.reduce((a, b) => a + b, 0);
    this.s = (o.phase ?? 0) * this.total; this.dirn = 1; this.wait = o.pause ?? 1.2;   // (phase: where along its path it starts, 0..1)
    this.prev = V();
    this.at(0, this.group.position);
    this.thick = th;
    this.place(0);
  }
  at(s, out) {
    let d = s;
    for (let i = 0; i < this.legs.length; i++) {
      if (d <= this.legs[i] || i === this.legs.length - 1) return out.copy(this.path[i]).lerp(this.path[i + 1], Math.min(1, d / this.legs[i]));
      d -= this.legs[i];
    }
    return out.copy(this.path[0]);
  }
  place(dt) {
    this.prev.copy(this.group.position);
    this.at(this.s, this.group.position);
    this.solid.pos.copy(this.group.position);
    this.solid.top = this.group.position.y; this.solid.bottom = this.group.position.y - this.thick - 0.4;
    if (dt > 0) this.solid.vel.subVectors(this.group.position, this.prev).divideScalar(dt);
  }
  update(dt, t) {
    const moving = !this.o.when || this.rt.logic.check(this.o.when);
    this.glow.uniforms.uGlow.value = moving ? 0.55 + 0.25 * Math.sin(t * 2) : 0.1;
    if (!moving) { this.solid.vel.set(0, 0, 0); return; }
    if (this.wait > 0) { this.wait -= dt; this.solid.vel.set(0, 0, 0); return; }
    // eased near the ends
    const sp = (this.o.speed ?? 2.4) * (0.35 + 0.65 * Math.min(1, Math.min(this.s, this.total - this.s) / 2.5));
    this.s += this.dirn * sp * dt;
    if (this.s >= this.total) { this.s = this.total; this.dirn = -1; this.wait = this.o.pause ?? 1.2; }
    if (this.s <= 0) { this.s = 0; this.dirn = 1; this.wait = this.o.pause ?? 1.2; }
    this.place(dt);
    // going down with someone on it: they go down with it (the player only keeps to a floor that isn't falling away)
    const P = this.rt.player;
    if (P && this.solid.vel.y < 0 && !P.climbing && Math.hypot(P.pos.x - this.solid.pos.x, P.pos.z - this.solid.pos.z) < this.r && Math.abs(P.pos.y - this.solid.top) < 0.4 && P.vel.y <= 0.5) P.vel.y = Math.min(P.vel.y, this.solid.vel.y);
  }
}

export class Bridge {
  /**
   * o: { id, a, b: [x, y, z] the walkway's ends (its top), w, n: stones, from: 'below' | 'above' | 'grow', pillar: m }
   * pillar: each stone a tall pillar about that deep (the Undertower's). A bridge from below that shuts (a held
   * note fading) sinks back, the far stones first, but not while someone stands on it: it waits for them.
   * from 'above': the stones hang high over the gap (they fell up), bobbing, and come down into place.
   * from 'grow' (a vine bridge, Viridel's bloom): woven vine that grows out from `a`, a span at a time.
   * glow: { color, k } stones of glowing moss (the Lamp-House's, lit by the orb's lamp), drawn as a hidden bridge is.
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id;
    const K = rt.kit, M = rt.M, w = o.w ?? 3.6, n = o.n ?? 7;
    const a = V(...o.a), b = V(...o.b), L = a.distanceTo(b), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    this.stones = [];
    this.root = new THREE.Group();
    rt.root.add(this.root);
    this.from = o.from ?? 'below';
    const blocks = [];
    const vine = this.from === 'grow';
    if (vine) { this.vineM ??= own({ color: '#5f9a52', flat: true }); this.leafM ??= own({ color: '#8fcf72', flat: true }); this.bloomM ??= own({ color: '#f2a7b8', glow: 0.25, flat: true }); }
    for (let i = 0; i < n; i++) {
      const c = a.clone().lerp(b, (i + 0.5) / n);
      const g = new THREE.Group();
      g.position.copy(K.world(c.x, c.y, c.z));
      g.rotation.y = K.heading(yaw);
      if (vine) {
        // a span of woven vine: two thick stems along it, a mat between them, leaves and a flower or two
        const len = L / n + 0.1, parts = [box(w * 0.9, 0.35, len, 0, -0.18, 0)], leaves = [], flowers = [];
        for (const s of [-1, 1]) parts.push(T(new THREE.CylinderGeometry(0.28, 0.28, len, 8), [s * w * 0.45, -0.05, 0], [Math.PI / 2, 0, 0]));
        for (let k = 0; k < 4; k++) leaves.push(T(new THREE.SphereGeometry(1, 8, 5).scale(0.5, 0.12, 0.28), [((k % 2) * 2 - 1) * w * 0.5, 0.05, (k / 3 - 0.5) * len], [0, k * 1.3, 0.3]));
        if (i % 2) flowers.push(T(new THREE.SphereGeometry(0.22, 8, 6), [w * 0.5, 0.2, 0]), T(new THREE.SphereGeometry(0.18, 8, 6), [-w * 0.5, 0.18, len * 0.3]));
        g.add(mesh(parts, this.vineM));
        g.add(mesh(leaves, this.leafM));
        if (flowers.length) g.add(mesh(flowers, this.bloomM));
      } else {
        const deep = o.pillar ? o.pillar * (0.8 + 0.4 * ((i * 7) % 5) / 4) : 0;   // (pillars: each its own depth, as the Undertower's rise out of the dark)
        g.add(mesh([box(w, 1.0, L / n - 0.08, 0, -0.5, 0), deep ? box(w - 0.3, deep, L / n - 0.3, 0, -1 - deep / 2, 0) : box(w + 0.3, 0.25, L / n - 0.05, 0, -1.05, 0)], o.hidden || o.glow ? (this.ghost ??= own({ color: o.glow?.color ?? rt.P.glow ?? '#a8e6ee', glow: o.glow?.k ?? 0.45, flat: true })) : M.floor));
        g.add(mesh([T(glyphGeometry(w * 0.5, 0.04).rotateX(-Math.PI / 2), [0, 0.01, 0])], M.glyph));
      }
      this.root.add(g);
      this.stones.push({ g, y: g.position.y, delay: i * 0.18 });
      const bl = new THREE.Mesh(box(w, 1.0, L / n, 0, -0.5, 0), new THREE.MeshBasicMaterial());
      bl.position.copy(g.position); bl.rotation.copy(g.rotation);
      blocks.push(bl);
    }
    this.block = new THREE.Group(); for (const bl of blocks) this.block.add(bl);
    this.span = { a, b, w };
    noCollide(this.root);
    this.open = rt.logic.isOpen(o.id);
    this.k = this.open ? 1 : 0;
    this.time = this.open ? 99 : 0;
    this.apply();
  }
  init(physics) { this.physics = physics; if (this.open) this.handle = physics.addCollider?.(this.block, NO_CLIMB) ?? null; }
  /** Someone stands on it (stones from below wait for them to step off before they sink). */
  ridden(p = this.rt.player) {
    if (!p?.pos || !this.span) return false;
    const l = this.rt.kit.local(p.pos), { a, b, w } = this.span;
    const ab = _dl.copy(b).sub(a), t = THREE.MathUtils.clamp(_dn.copy(l).sub(a).dot(ab) / ab.lengthSq(), -0.05, 1.05);
    const q = a.clone().addScaledVector(ab, t);
    return Math.hypot(l.x - q.x, l.z - q.z) < w / 2 + 0.5 && l.y > q.y - 0.6 && l.y < q.y + 2.5 && t > -0.04 && t < 1.04;
  }
  setOpen(open, instant = false) {
    this.wantShut = false;
    if (open === this.open) return;
    if (!open && !instant && this.from === 'below' && this.ridden()) { this.wantShut = true; return; }
    // (stones that were down and rise again, held ones let go: they start from where they are)
    this.rise = !open && !instant && this.from === 'above' ? 0 : null;
    this.sink = !open && !instant && this.from === 'below' ? 0 : null;   // (stones from below sink back, the far ones first)
    this.open = open;
    this.time = instant ? 99 : 0;
    if (open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block, NO_CLIMB) ?? null;
    if (!open && this.handle) { this.physics.removeCollider?.(this.handle); this.handle = null; }
    if (!instant) this.rt.rumble?.(2.2, 0.4);
  }
  apply(t = 0) {
    const above = this.from === 'above';
    for (const [i, s] of this.stones.entries()) {
      const k = this.open ? ease(THREE.MathUtils.clamp((this.time - s.delay) / (above ? 2.2 : 1.1), 0, 1)) : 0;
      if (this.from === 'grow') {
        // grown out from the near end, a span at a time
        const g = ease(THREE.MathUtils.clamp((this.time - s.delay * 1.6) / 0.7, 0, 1));
        s.g.scale.set(Math.max(0.05, g), Math.max(0.05, g), Math.max(0.001, g));
        s.g.visible = this.open && g > 0.001;
      } else if (above) {
        // hanging up there, each at its own height, bobbing; then down into the walkway
        const hang = 9 + (i % 3) * 1.6 + Math.sin(t * 0.6 + i * 1.7) * 0.5;
        // let go: they fall up again, slowly, the far ones first
        const up = this.rise != null ? ease(THREE.MathUtils.clamp((this.rise - (this.stones.length - 1 - i) * 0.08) / 1.6, 0, 1)) : 1;
        const kk = this.open ? k : 1 - up;
        s.g.position.y = s.y + (1 - kk) * hang;
        s.g.rotation.z = (1 - kk) * Math.sin(i * 2.3) * 0.25;
        s.g.visible = true;
      } else {
        const kk = this.open ? k : this.sink != null ? 1 - ease(THREE.MathUtils.clamp((this.sink - (this.stones.length - 1 - i) * 0.1) / 1.0, 0, 1)) : 0;
        s.g.position.y = s.y - (1 - kk) * 14;
        s.g.visible = kk > 0.001;
      }
    }
  }
  update(dt, t) {
    if (this.wantShut && !this.ridden()) this.setOpen(false);
    if (this.open && this.time < 6) { this.time += dt; this.apply(t); }
    else if (!this.open && this.from === 'above') { if (this.rise != null) this.rise += dt; this.apply(t); }
    else if (!this.open && this.sink != null && this.sink < 4) { this.sink += dt; this.apply(t); }
  }
}

/**
 * The Undertower's listening pillars (issue #23, v1.74): a walkway of pillars down in a chasm's dark, each crowned on its
 * side with a little horn ringed in its note's colour. A pillar rises while its note, played back near it (the echo shell:
 * game event 'echo', not a stone's own song), still rings: `hold` s from the last time it heard it within `reach` (across
 * the floor) of its top; then it sinks again, but not while someone stands on it. So the way over is carried: play the
 * note at the edge, step out, play it again further on (the shell keeps it), and the pillars ahead rise as you go.
 * o: { a, b: [x, y, z] the walkway's ends (its top), w, n, pillar: m deep, note, reach (m), hold (s), heard, wrong,
 *      id, hidden (issue #418: there only through the seeing lens, as the Footprint's stones: risen but unseen, nothing to
 *      stand on; once seen through it, there for good: `revealed`), unseen (said when they rise unseen) }
 */
export const PILLARS = { reach: 6.5, hold: 6, rise: 0.9, sink: 1.0 };
export class Pillars {
  constructor(rt, o) {
    this.rt = rt; this.o = o; this.id = o.id; this.note = o.note ?? 'high';
    this.hidden = !!o.hidden;
    const N = NOTES[this.note] ?? NOTES.high;
    const K = rt.kit, M = rt.M, w = o.w ?? 4, n = o.n ?? 8;
    const a = V(...o.a), b = V(...o.b), L = a.distanceTo(b), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    this.reach = o.reach ?? PILLARS.reach; this.hold = o.hold ?? PILLARS.hold;
    this.root = new THREE.Group();
    rt.root.add(this.root);
    this.ringM = own({ color: N.color, glow: 0.2, flat: true });
    const horn = own({ color: '#d8a24a', flat: true, side: THREE.DoubleSide });
    this.stones = [];
    for (let i = 0; i < n; i++) {
      const c = a.clone().lerp(b, (i + 0.5) / n), len = L / n;
      const g = new THREE.Group();
      g.position.copy(K.world(c.x, c.y, c.z));
      g.rotation.y = K.heading(yaw);
      const deep = (o.pillar ?? 12) * (0.8 + 0.4 * ((i * 7) % 5) / 4);
      g.add(mesh([box(w, 1.0, len - 0.08, 0, -0.5, 0), box(w - 0.3, deep, len - 0.3, 0, -1 - deep / 2, 0)], this.hidden ? (this.ghost ??= own({ color: rt.P.glow ?? '#a8e6ee', glow: 0.45, flat: true })) : M.floor));
      g.add(mesh([T(glyphGeometry(w * 0.5, 0.04).rotateX(-Math.PI / 2), [0, 0.01, 0])], M.glyph));
      // its horn, on the pillar's side under the walkway's edge, turned up and out (by turns on either side)
      const sd = i % 2 ? 1 : -1;
      g.add(mesh([T(lathe([[0.08, 0], [0.12, 0.3], [0.24, 0.55], [0.5, 0.72], [0.54, 0.76]], 12), [sd * (w / 2 + 0.05), -0.9, 0], [0, 0, -sd * 1.2])], horn));
      g.add(mesh([T(new THREE.TorusGeometry(0.52, 0.06, 4, 20), [sd * (w / 2 + 0.68), -0.62, 0], [0, 0, -sd * 1.2 + Math.PI / 2])], this.ringM));
      noCollide(g);
      this.root.add(g);
      const bl = new THREE.Mesh(box(w, 1.0, len, 0, -0.5, 0), new THREE.MeshBasicMaterial());
      bl.position.copy(g.position); bl.rotation.copy(g.rotation); bl.updateMatrixWorld(true);
      // (where it is heard from: its top, in the temple's frame)
      this.stones.push({ g, y: g.position.y, block: bl, local: c, half: len / 2, left: 0, k: 0, handle: null });
    }
    this.span = { a, b, w, yaw };
    this.mid = K.world((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    this.wrongSaid = false;
    this.off = rt.game?.on?.('echo', (e = {}) => this.hear(e));
    this.apply();
  }
  init(physics) { this.physics = physics; }
  /** Shown (a hidden walkway: once seen through the seeing lens, for good: revealed). */
  seen() { return !this.hidden || revealed(this.rt, this.id, this.mid); }
  /** A note played back somewhere: the pillars within reach of it rise (their own note), or stay down (another). */
  hear({ pos, note } = {}) {
    if (!pos) return;
    const l = this.rt.kit.local(pos);
    const near = this.stones.filter((s) => Math.hypot(l.x - s.local.x, l.z - s.local.z) <= this.reach && Math.abs(l.y - s.local.y) < 8);
    if (!near.length) return;
    if (note !== this.note) {
      if (typeof note === 'string' && !note.startsWith('sign.')) this.rt.notice?.(this.o.wrong ?? `The pillars stay down in the dark: their horns listen for the ${NOTES[this.note]?.name ?? this.note} note, the colour of their rings.`, 'pillars.wrong');
      return;
    }
    let rose = false;
    for (const s of near) { if (s.left <= 0 && s.k < 0.5) rose = true; s.left = this.hold; }
    if (rose) {
      this.rt.rumble?.(1.2, 0.35); this.rt.sound?.chime?.();
      // (hidden and not seen yet: something rises, and nothing is there to see)
      if (!this.seen()) this.rt.notice?.(this.o.unseen ?? 'Something rises out of the dark, and nothing is there to see.', `pillars.unseen.${this.id ?? ''}`);
      else this.rt.notice?.(this.o.heard ?? 'The pillars nearest you hear the note and rise out of the dark. Further on, they wait to hear it too.', 'pillars.heard');
    }
  }
  /** Someone stands on stone s (it waits for them to step off before it sinks). */
  ridden(s, p = this.rt.player) {
    if (!p?.pos) return false;
    const l = this.rt.kit.local(p.pos), { w, yaw } = this.span;
    const dx = l.x - s.local.x, dz = l.z - s.local.z;
    const along = dx * Math.sin(yaw) + dz * Math.cos(yaw), across = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    return Math.abs(along) < s.half + 0.5 && Math.abs(across) < w / 2 + 0.5 && l.y > s.local.y - 0.6 && l.y < s.local.y + 2.5;
  }
  /** How many stand risen now (for the tests and the scout). */
  get up() { return this.stones.filter((s) => s.handle).length; }
  /** Stone i stands (solid). */
  standing(i) { return !!this.stones[i]?.handle; }
  apply(seen = true) {
    for (const s of this.stones) {
      s.g.position.y = s.y - (1 - ease(s.k)) * 14;
      s.g.visible = s.k > 0.001 && seen;
    }
  }
  update(dt, t) {
    let lit = 0;
    const seen = this.seen();
    for (const s of this.stones) {
      if (s.left > 0) s.left = Math.max(0, s.left - dt);
      const risen = s.left > 0 || (s.handle && this.ridden(s));
      const want = risen && seen;   // (a hidden walkway risen but unseen: nothing to stand on)
      if (want && !s.handle && this.physics) s.handle = this.physics.addCollider?.(s.block, NO_CLIMB) ?? null;
      if (!want && s.handle) { this.physics.removeCollider?.(s.handle); s.handle = null; }
      s.k = THREE.MathUtils.clamp(s.k + (risen ? dt / PILLARS.rise : -dt / PILLARS.sink), 0, 1);
      if (risen) lit++;
    }
    this.apply(seen);
    this.ringM.uniforms.uGlow.value = lit ? 0.85 + 0.15 * Math.sin(t * 6) : 0.2 + 0.08 * Math.sin(t * 2);
  }
  dispose() { this.off?.(); for (const s of this.stones) if (s.handle) this.physics?.removeCollider?.(s.handle); }
}

// ---------------------------------------------------------------------------------------- marks and pits
// ---------------------------------------------------------------------------------------- keys and coffers
/** A small key's shape (m, the bow up, along y, 0.85 m): a plain ring, a shaft and two bits. */
export function keyGeometry() {
  const L = 0.85, r = 0.2, g = [T(new THREE.TorusGeometry(r, r * 0.28, 6, 18), [0, L / 2 + r * 0.6, 0])];
  g.push(T(new THREE.CylinderGeometry(r * 0.16, r * 0.16, L, 8), [0, 0, 0]));
  for (const [y, w] of [[-L / 2 + 0.1, 0.28], [-L / 2 + 0.3, 0.2]]) g.push(T(new THREE.BoxGeometry(w, 0.12, 0.08), [w / 2, y, 0]));
  return g;
}

/**
 * The house's great key (issue #486, the author's pick: references/objects/great-key/sheet-1.jpg), m, the bow up, along
 * y, its foot at -0.8 and its bow's top at 1.32: a bow in the makers' open-corner mark
 * (the shared mark's own contours, src/makers-mark/shape.js: never redrawn), pale stone set in a brass rim; a brass
 * collar; a pale stone shaft with a channel of soft teal light along it, front and back (the sheet's); a ward of three steps like a
 * small staircase, the light along its edge; a brass foot. Three meshes: { brass, stone, light } (each a list of shapes).
 */
export const GREAT_KEY = {
  bow: 0.7, bowY: 0.97, depth: 0.13,   // the mark's height (m), its middle's height, its stone's thickness
  shaft: [-0.72, 0.3], r: 0.085,        // the shaft's foot and top, its radius
  steps: [0.36, 0.27, 0.18], step: 0.1, // the ward's steps, from its foot up (width out from the shaft's middle, height each)
  light: '#74dccb',                     // its light, the sheet's soft teal (self-lit, breathing: Key update)
};
export function greatKeyGeometry() {
  const G = GREAT_KEY, s = G.bow, brass = [], stone = [], light = [];
  // the bow: the mark, its stone proud of a brass rim a little larger all round (the same contours, bevelled out)
  const shapes = markShape().map((ps) => new THREE.Shape(ps.map(([x, y]) => new THREE.Vector2(x * s, y * s))));
  const extrude = (depth, bevel) => shapes.map((sh) => T(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: !!bevel, bevelSize: bevel, bevelThickness: bevel * 0.8, bevelSegments: 1, curveSegments: 1 }), [0, G.bowY, -depth / 2]));
  stone.push(...extrude(G.depth + 0.02, 0));
  brass.push(...extrude(G.depth - 0.05, 0.022));
  // the collar under the bow: brass rings, a band of the light between them
  const [y0, y1] = G.shaft, cyl = (r, h, y, seg = 10) => T(new THREE.CylinderGeometry(r, r, h, seg), [0, y, 0]);
  brass.push(cyl(0.13, 0.07, y1 + 0.035), cyl(0.105, 0.1, y1 + 0.12), cyl(0.13, 0.06, y1 + 0.2), cyl(0.11, 0.06, y1 + 0.26));
  light.push(cyl(0.112, 0.035, y1 + 0.12));
  brass.push(box(0.47, 0.045, G.depth, 0, y1 + 0.31, 0));   // (a brass sill the mark's two feet stand on)
  // the shaft, pale stone, eight-sided; the light in a channel down its front and back
  stone.push(cyl(G.r, y1 - y0, (y0 + y1) / 2, 8));
  light.push(box(0.032, y1 - y0 - 0.12, G.r * 2 + 0.024, 0, (y0 + y1) / 2 + 0.02, 0));
  // the ward: steps like a small staircase, widest at its foot; the light along the top of each
  G.steps.forEach((w, i) => {
    const y = y0 + 0.06 + G.step * (i + 0.5);
    stone.push(box(w, G.step, 0.11, w / 2, y, 0));
    light.push(box(0.05, 0.022, 0.118, w - 0.055, y + G.step / 2 - 0.02, 0));
  });
  brass.push(box(0.06, G.step * G.steps.length + 0.04, 0.125, G.r + 0.02, y0 + 0.06 + (G.step * G.steps.length) / 2, 0));
  // the foot: a brass cap and a blunt point
  brass.push(cyl(0.11, 0.06, y0 - 0.01), T(new THREE.CylinderGeometry(0.07, 0.035, 0.07, 10), [0, y0 - 0.075, 0]));
  return { brass, stone, light };
}

/**
 * A key's little chest (issue #274, the author: "When I get a key in a temple there should be a sound effect, it should
 * be in a little chest. And I should have a key counter on my screen. Like Zelda"): the makers' chest, the same model
 * and opening as every chest (src/boxes/model.js buildBox), set down at `KEY_CHEST.small` of its size (the great key's a
 * little larger), on the floor where the key's plinth stood. A cage of brass bars round it until its element's `when`
 * holds (then they sink into the floor). Opened (A / ×), a short opening, not a box's whole scene: the latch clicks, the
 * halves part with light out of it (src/boxes/light.js ChestLight, its column shorter), the key rises out of the light
 * turning, rings (Sound.keyGet), hangs a moment and is gone into the key counter (runtime.js keyCount: it counts once
 * the key has flown, `KEY_CHEST.counted`). Left open and quiet after, on a load too.
 */
export const KEY_CHEST = {
  small: 1.0, big: 1.3,           // its scale (the boxes' chests are BOX_SCALE, 1.9)
  latch: 0.25, open: 0.55,        // s: the latch's click, then the halves parting over `open`
  rise: [0.4, 1.25], hang: 1.75,  // s: the key rising out of the light, then held over it till `hang`
  counted: 1.9, done: 2.4,        // s: in the counter; the light gone
  height: 0.38,                   // its column's height and top, a share of a box's (light.js CHEST_LIGHT.height)
  key: { small: 0.7, big: 0.6 },  // the key's size over it (the plinth's key was 0.85 m long, the great one 1.5)
  lamp: 0.4,                      // its lamp's reach, a share of a box's (light.js LAMP)
};
const _km = new THREE.Vector3(), _ke = new THREE.Vector3();
export class Key {
  /**
   * o: { id, at: the chest's foot, yaw (its front), big, line }: a key in a little chest. Its element: { type: 'key',
   * kind: 'small' | 'big', room, when? }. The chest's interactable opens it (logic.find, at once: the key is yours).
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, big = !!o.big, S = (this.scale = big ? KEY_CHEST.big : KEY_CHEST.small);
    this.pos = K.world(...o.at);
    this.yaw = K.heading(o.yaw ?? 0);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    rt.root.add(this.group);
    // the chest: the makers' own, smaller (its one mesh closed; its halves only while it opens and after)
    this.chest = buildBox(`temple.${rt.id}.${o.id}`, { kind: 'makers', scale: S });
    this.chest.root.scale.setScalar(S);
    this.chest.root.name = `Key chest ${o.id}`;
    this.group.add(this.chest.root);
    this.A = this.chest.mats.body.uniforms.uBoxA.value;
    this.H = this.chest.size.h * S;
    // (it stands: you walk up to it, not through it; low enough to step onto)
    K.solid(new THREE.CylinderGeometry(0.34 * S, 0.34 * S, this.H * 0.9, 12).translate(o.at[0], o.at[1] + this.H * 0.45, o.at[2]));
    // the key, inside it until it rises
    this.glow = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.35, flat: true });
    this.key = new THREE.Group();
    if (o.map) this.key.add(mesh(scrollGeometry(), own({ color: rt.P.paper ?? '#efe0bd', flat: true })), mesh(scrollTies(), M.trimMat), mesh([new THREE.SphereGeometry(0.08, 8, 6).translate(0, 0.42, 0)], this.glow));
    else if (big) {
      // (the great key: the house's brass and pale stone, the sheet's teal light in them, the same in every house: issue #486)
      this.glow = own({ color: GREAT_KEY.light, glow: 0.7, flat: true });
      const K2 = greatKeyGeometry();
      this.key.add(mesh(K2.brass, M.trimMat), mesh(K2.stone, M.stoneMat), mesh(K2.light, this.glow));
    } else this.key.add(mesh(keyGeometry(), M.trimMat), mesh([new THREE.SphereGeometry(0.09, 8, 6).translate(0, 0.545, 0)], this.glow));
    this.key.visible = false;
    this.group.add(this.key);
    // the cage: bars round the chest, a ring over them; they sink into the floor once the key may be taken
    const bars = [], cr = (this.cageR = 0.58 * S), ch = (this.cageH = o.cageH ?? (big ? 1.5 : 1.15));   // (cageH: up to what runs on it, the Engine-House's hammer)
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; bars.push(T(new THREE.CylinderGeometry(0.035, 0.035, ch, 5), [Math.sin(a) * cr, ch / 2, Math.cos(a) * cr])); }
    bars.push(T(new THREE.TorusGeometry(cr, 0.05, 5, 24), [0, ch, 0], [Math.PI / 2, 0, 0]));
    this.cage = mesh(bars, M.trimMat);
    this.group.add(this.cage);
    noCollide(this.group);
    this.taken = rt.logic.isFound(o.id);
    this.opening = null;     // { t } while it opens
    this.lightK = 0;
    this.lamp = new THREE.Vector4(0, -1e5, 0, 0);
    rt.lights?.push(this.lamp);
    this.k = this.free() ? 1 : 0;
    this.chest.setOpen(this.taken ? 1 : 0);
    this.quiet();
    this.pose(0);
    const L = rt.logic, at = this.pos.clone().add(V(0, this.H + 0.6, 0));
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.6, prompt: 'open the chest', at: () => at,
      enabled: () => !this.taken && this.k > 0.9 && !L.isFound(o.id),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.5) * 4,
      use: () => this.openIt(),
    });
  }
  /** The key may be taken (its `when` holds), or is taken already. */
  free() { const L = this.rt.logic; return L.isFound(this.id) || L.check(L.el(this.id)?.when); }
  /** Not yet in the counter: still in its chest, or rising out of it. */
  get flying() { return !!this.opening && this.opening.t < KEY_CHEST.counted; }
  /** Its look at rest: shut and humming softly, or opened and spent (no ray, the marks dim). */
  quiet() { this.A.x = this.taken ? 0 : 0.5; this.A.y = this.taken ? 0.12 : 0.3; }
  /** The open chest's mouth (world): its middle at the height its halves part (light.js MOUTHS). */
  mouth(out) { return out.copy(this.pos).setY(this.pos.y + this.H * MOUTHS.makers.y); }
  /** Opened (A / ×): the key is yours at once; the rest is its short scene. */
  openIt() {
    if (this.taken || !this.rt.logic.find(this.id)) return false;
    this.taken = true;
    this.opening = { t: 0, rang: false };
    this.rt.sound?.boxLatch?.();
    if (!this.light && this.rt.veils) this.light = new ChestLight({ veils: this.rt.veils, parent: this.rt.root, kind: 'makers' });
    if (this.o.map) this.rt.game?.emit?.('temple:map', { id: this.rt.id, el: this.id });
    else this.rt.game?.emit?.('temple:key', { id: this.rt.id, el: this.id, kind: this.o.big ? 'big' : 'small' });
    return true;
  }
  /**
   * The find's card (the map's, the great key's): asked of whoever shows a makers' box's card (game event 'temple:found'
   * { id, el, kind, name, text, done }: src/boxes/index.js announce). True while it is up (`done` when it is put away).
   */
  announce(card) {
    const O = this.opening, ev = { id: this.rt.id, el: this.id, kind: this.o.map ? 'map' : 'big', name: card.name, text: card.found, shown: false, done: () => { O.held = false; } };
    this.rt.game?.emit?.('temple:found', ev);
    O.carded = !!ev.shown;
    return O.carded;
  }
  pose(t) {
    this.cage.position.y = -ease(this.k) * (this.cageH + 0.05);
    this.cage.visible = this.k < 0.999;
  }
  update(dt, t) {
    this.k = THREE.MathUtils.clamp(this.k + (this.free() ? dt / 1.2 : -dt), 0, 1);
    this.pose(t);
    if (!this.opening) {
      // (shut, the ray crosses it now and then and its marks breathe; nothing once spent)
      if (!this.taken) { this.A.w += dt / 3.4; this.A.y = 0.3 + 0.15 * Math.sin(t * 2.4) * this.k; }
      return;
    }
    const O = this.opening, C = KEY_CHEST, sm = (a, b, x) => ease(THREE.MathUtils.clamp((x - a) / (b - a), 0, 1));
    // (the map and the great key are announced as a makers' box's find is, its card, issue #486: up as the key comes
    // clear of the light, and the key hangs there over its chest till the card is put away)
    const card = this.o.map ? MAP_CHEST : this.o.big ? GREAT_KEY_CHEST : null;
    if (card && !O.told && O.t >= C.rise[1]) { O.told = true; O.held = this.announce(card); }
    O.t = O.held ? Math.min(O.t + dt, C.hang - 0.05) : O.t + dt;
    const T0 = O.t;
    // the latch clicks, it gives a little; then the halves part
    const open = sm(C.latch, C.latch + C.open, T0);
    if (T0 >= C.latch && !O.opened) { O.opened = true; this.rt.sound?.boxLatch?.(true); }
    this.chest.setOpen(open > 0 ? Math.max(1e-3, open) : 0);
    this.chest.root.rotation.z = T0 < C.latch ? Math.sin(T0 * 60) * 0.03 * (1 - T0 / C.latch) : 0;
    // the light out of it: swelling as it opens, settling while the key hangs, gone after
    const k = T0 < C.latch ? 0 : T0 < C.latch + C.open ? open : T0 < C.hang ? 1 - 0.4 * sm(C.latch + C.open, C.hang, T0) : 0.6 * (1 - sm(C.hang, C.done, T0));
    this.lightK = k;
    this.A.x = 0; this.A.y = k > 0 ? 1 + 0.75 * k : 0.12;   // (the linings glow with it: materials.js MAKERS_BOX)
    this.mouth(_km);
    const P = this.rt.player?.pos;
    if (P) _ke.set(P.x + (P.x - this.pos.x) * 1.5, P.y + 2.2, P.z + (P.z - this.pos.z) * 1.5);
    this.light?.update({ mouth: _km, yaw: this.yaw, k, time: t, eye: P ? _ke : null, scale: this.scale, reach: C.height * this.scale });
    if (k > 0) chestLamp(this.lamp, _km, 0, k).w *= C.lamp * this.scale; else this.lamp.set(0, -1e5, 0, 0);
    // the key: out of the light, turning, up over the chest; it rings as it comes clear; held; then into the counter
    const up = sm(C.rise[0], C.rise[1], T0), gone = sm(C.hang, C.counted, T0);
    this.key.visible = T0 > C.rise[0] && gone < 1;
    const ks = this.o.big ? C.key.big : C.key.small, half = (this.o.big ? 0.95 : 0.55) * ks;   // (its half length, the bow in)
    const lift = this.H * 0.4 + up * (this.H * 0.6 + half + 0.2) + gone * 0.6;
    this.key.position.set(0, lift, 0);
    this.key.rotation.y = t * 1.3 + (1 - up) * 6;
    this.key.scale.setScalar(Math.max(1e-3, ks * (0.4 + 0.6 * up) * (1 - gone)));
    const g = 0.6 + 0.4 * (1 - up) + 0.3 * Math.sin(t * 6);
    this.glow.uniforms.uGlow.value = this.o.big && !this.o.map ? 0.7 + 0.25 * Math.sin(t * 3) : g;   // (the great key's light breathes slowly, self-lit, never past 1)
    if (!O.rang && T0 >= C.rise[0] + 0.15) { O.rang = true; this.rt.sound?.keyGet?.(!!this.o.big); }
    if (!O.said && T0 >= C.counted) {
      O.said = true;
      const n = this.rt.logic.keys('small');
      // (the map and the great key said on their card already; where nothing shows one, a line on the screen)
      if (!card) this.rt.notice(this.o.line ?? `A small key${n > 1 ? `, ${n} in hand` : ''}. It turns one lock in this house.`);
      else if (!O.carded) this.rt.notice(stripTone(this.o.line ?? card.line));
    }
    if (T0 >= C.done) {
      this.opening = null; this.lightK = 0; this.key.visible = false;
      this.chest.setOpen(1); this.quiet(); this.lamp.set(0, -1e5, 0, 0);
      this.light?.dispose(); this.light = null;
    }
  }
  dispose() { this.off?.(); this.light?.dispose(); this.light = null; }
}

/** The house's map's chest (issue #405): what it says once opened (a tone, as every line: src/story/tone.js). */
export const MAP_CHEST = { line: '~happy~ The house’s map. Menu shows its rooms now.', name: 'The House’s Map', found: '~happy~ Menu shows its rooms now.' };
/** The great key's chest (issue #486): its card's name and line (a tone), and the line said where no card shows. */
export const GREAT_KEY_CHEST = { line: '~solemn~ The house’s great key. It opens the guardian’s door.', name: 'The Great Key', found: '~solemn~ It opens the guardian’s door.' };
export class MapChest extends Key {
  /** o: { id, at: the chest's foot, yaw (its front), line }: a little chest, the house's map rolled up in it. */
  constructor(rt, o) { super(rt, { ...o, map: true, big: false }); }
  /** (never counted with the keys) */
  get flying() { return false; }
}
/** A rolled map standing on end (its bottom at y 0, 0.85 m tall), as the key stands over its chest. */
function scrollGeometry() {
  return [T(new THREE.CylinderGeometry(0.1, 0.1, 0.7, 12), [0, 0, 0]), T(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), [0, 0, 0])];
}
function scrollTies() {
  return [-0.18, 0.18].map((y) => T(new THREE.TorusGeometry(0.105, 0.018, 5, 14), [0, y, 0], [Math.PI / 2, 0, 0]));
}

export class Coffer {
  /**
   * o: { id, at, yaw, line, cage }: a little coffer of the house's stone bound in brass, in an optional room; its element
   * { type: 'cache', room, when? }. Opened (interact), its lid swings back and a purse of chimes spills out (game
   * event 'temple:cache': src/chimes.js drops it, once per save). Nothing waits on it. `cage`: brass bars round it that
   * sink into the floor while its `when` holds and rise again when it doesn't (a weight on a plate, issue #337), until
   * it is opened.
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M;
    this.pos = K.world(...o.at);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.group.add(mesh([box(1.3, 0.7, 0.85, 0, 0.35, 0)], M.stoneMat), mesh([box(1.34, 0.12, 0.89, 0, 0.12, 0), box(0.14, 0.72, 0.89, -0.45, 0.36, 0), box(0.14, 0.72, 0.89, 0.45, 0.36, 0)], M.trimMat));
    this.lid = new THREE.Group();
    this.lid.position.set(0, 0.7, -0.42);
    this.lid.add(mesh([box(1.3, 0.22, 0.85, 0, 0.11, 0.42)], M.stoneMat), mesh([box(0.14, 0.24, 0.89, -0.45, 0.12, 0.42), box(0.14, 0.24, 0.89, 0.45, 0.12, 0.42)], M.trimMat));
    this.glow = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.1, flat: true });
    this.group.add(mesh([T(new THREE.SphereGeometry(0.1, 8, 6).scale(1, 1, 0.5), [0, 0.5, 0.44])], this.glow));
    this.group.add(this.lid);
    if (o.cage) {
      const bars = [], cw = 0.95, cd = 0.68, ch = (this.cageH = 1.25);
      for (let i = 0; i < 7; i++) for (const z of [-cd, cd]) bars.push(T(new THREE.CylinderGeometry(0.035, 0.035, ch, 5), [-cw + (i / 6) * 2 * cw, ch / 2, z]));
      for (let i = 1; i < 4; i++) for (const x of [-cw, cw]) bars.push(T(new THREE.CylinderGeometry(0.035, 0.035, ch, 5), [x, ch / 2, -cd + (i / 4) * 2 * cd]));
      for (const z of [-cd, cd]) bars.push(box(2 * cw + 0.08, 0.08, 0.08, 0, ch, z));
      for (const x of [-cw, cw]) bars.push(box(0.08, 0.08, 2 * cd + 0.08, x, ch, 0));
      this.cage = mesh(bars, M.trimMat);
      this.group.add(this.cage);
      this.cageK = this.free() ? 1 : 0;
      this.cage.position.y = -ease(this.cageK) * (this.cageH + 0.05);
      this.cage.visible = this.cageK < 0.999;
    }
    noCollide(this.group);
    this.k = rt.logic.isFound(o.id) ? 1 : 0;
    this.lid.rotation.x = -this.k * 1.9;
    const L = rt.logic, at = this.pos.clone().add(V(0, 1.1, 0));
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.6, prompt: 'open the coffer', at: () => at,
      enabled: () => !L.isFound(o.id) && L.check(L.el(o.id)?.when) && (!this.cage || this.cageK > 0.9),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.5) * 4,
      use: () => this.openIt(),
    });
  }
  /** Its cage may sink: its `when` holds, or it is open already. */
  free() { const L = this.rt.logic; return L.isFound(this.id) || L.check(L.el(this.id)?.when); }
  openIt() {
    if (!this.rt.logic.find(this.id)) return false;
    this.rt.sound?.critter?.('creak', 0.8); this.rt.sound?.chime?.();
    this.rt.game?.emit?.('temple:cache', { id: this.rt.id, el: this.id, pos: this.pos.clone().add(V(0, 0.9, 0)) });
    this.rt.notice(this.o.line ?? 'The coffer’s lid swings back. Chimes, left for whoever found it.', `cache.${this.id}`);
    return true;
  }
  update(dt, t) {
    if (this.cage) {
      const was = this.cageK;
      this.cageK = THREE.MathUtils.clamp(this.cageK + (this.free() ? dt / 0.9 : -dt / 0.7), 0, 1);
      if (was !== this.cageK) { this.cage.position.y = -ease(this.cageK) * (this.cageH + 0.05); this.cage.visible = this.cageK < 0.999; }
    }
    const want = this.rt.logic.isFound(this.id) ? 1 : 0;
    if (this.k !== want) { this.k = THREE.MathUtils.clamp(this.k + (want ? dt / 0.8 : -dt), 0, 1); this.lid.rotation.x = -ease(this.k) * 1.9; }
    this.glow.uniforms.uGlow.value = this.k > 0.5 ? 0.05 : 0.1 + 0.08 * Math.sin(t * 2.2);
  }
  dispose() { this.off?.(); }
}

/** A mark's waking: its glyph flares for `flare` s; the first mark of all says what it is (once a save: the `told` flag). */
export const MARK = { flare: 0.9, told: 'temple.markTold', line: 'The glyph stone wakes: it holds your place. Fall, and you come back to it.' };
export class Mark {
  /**
   * A checkpoint: a glyph stone. o: { room, at, yaw, foes } (foes: where its room's machines stand, local, the middle of
   * a fight's room, src/foes.js placeMachinesIn; left out, round the stone, as before: issue #336)
   */
  constructor(rt, o) {
    this.rt = rt; this.room = o.room;
    const K = rt.kit, M = rt.M;
    this.pos = K.world(...o.at);
    this.heading = K.heading(o.yaw ?? 0);
    this.foes = o.foes ? K.world(...o.foes) : null;
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    rt.root.add(this.group);
    this.group.add(mesh([lathe([[0.55, 0], [0.55, 0.15], [0.42, 0.3], [0.38, 1.2], [0.5, 1.35], [0.02, 1.5]], 10)], M.trimMat));
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.1, flat: true });
    this.group.add(mesh([T(glyphGeometry(0.62, 0.05), [0, 0.85, 0.4])], this.glow));
    noCollide(this.group);
    this.spot = this.pos.clone().add(V(Math.sin(this.heading) * 1.6, 0.05, Math.cos(this.heading) * 1.6));
  }
  /** Nothing between you and the stone (a shut door: a mark is never taken through one, v1.48: the great lock's). */
  inReach(p) {
    const ph = this.rt.physics;
    if (!ph?.rayDistance) return true;
    const from = _mk.copy(p.pos).addScaledVector(UP, 1.1), to = _mk2.copy(this.pos).addScaledVector(UP, 1.1);
    const d = from.distanceTo(to);
    return d < 0.3 || ph.rayDistance(from, to.sub(from).normalize(), d) >= d - 0.35;
  }
  update(dt, t) {
    const p = this.rt.player;
    if (p && p.onGround && p.pos.distanceTo(this.pos) < 4 && this.rt.checkpoint?.room !== this.room && this.inReach(p)) {
      this.rt.setCheckpoint(this);
      // (it wakes with a flare of its glyph, and the first one says what it is: issue #216, a stone nobody could read)
      this.flare = 1;
      const G = this.rt.game;
      if (G && !G.flag?.(MARK.told)) { G.set?.(MARK.told, true); this.rt.notice?.(MARK.line); }
    }
    this.flare = Math.max(0, (this.flare ?? 0) - dt / MARK.flare);
    const on = this.rt.checkpoint === this;
    this.glow.uniforms.uGlow.value = (on ? 0.75 + 0.2 * Math.sin(t * 2) : 0.12) + 1.2 * this.flare * this.flare;
  }
}

/**
 * Fall below a chasm's lip and you are back at the room's mark. o: { room, min: [x, y, z], max } (local); `own`: what
 * already says it is deadly (molten iron), so it takes no dark of its own (runtime.js: every other pit fills with the
 * dark from below, src/pit-void.js, issue #312).
 */
export class Pit {
  constructor(rt, o) {
    this.rt = rt; this.room = o.room; this.own = o.own ?? null;
    this.box = new THREE.Box3(V(...o.min), V(...o.max));
  }
  contains(p) { return this.box.containsPoint(this.rt.kit.local(p)); }
}
