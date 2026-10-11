import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
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
//   Bank     four eyes that wake only together, inside a breath: it wants the fourth chamber
//   LightEar a lamp that wakes when you stand by it with the lantern charm
//   Jaw      a gate of snapping jaws: a stilling glob stills them, and they rest open for good
//   Swing    a crystal pendulum over a bridge: it knocks you off; a stilling glob stops it a while
//   Updraft  a column of rising wind: it lifts the fluid wings, round and up, and lets you go at its top
//   Gust     gusts down a hall that shove you back unless you wait them out behind a screen
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
//   Platform a disc that rides between points (you ride along on it)
//   Bridge   stones that rise out of a chasm when their condition holds
//   Mark     a glyph stone: walk past it and it is where you come back to (a checkpoint)
//   Pit      a volume below a chasm: fall in and you are back at the room's mark
//
// Any of Door, Switch and Bridge can be `hidden`: only the glyph lens shows it (src/items.js 'lens'): a hidden
// door is plain wall until you carry the lens, a hidden eye and a hidden bridge are not there at all.
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
const _dl = new THREE.Vector3(), _dn = new THREE.Vector3();
/** What shows a hidden piece: the glyph lens (hidden: true), or the item named. */
const shownBy = (h) => (h === true ? 'lens' : h);
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
   * @param o    { id, at: [x, y, z] the doorway's foot, yaw (0: the slab faces ±z), w, h, t, lamps: [condition], bell }
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
    // solid while shut: an invisible block filling the doorway (added to the physics in init)
    this.block = new THREE.Mesh(box(w, h, t + 0.2, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.k = rt.logic?.isOpen(o.id) ? 1 : 0;
    this.open = this.k > 0.5;
    this.apply();
  }
  init(physics) { this.physics = physics; if (!this.open) this.handle = physics.addCollider?.(this.block) ?? null; }
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
    if (!open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block) ?? null;
    if (instant) { this.k = open ? 1 : 0; this.apply(); }
    else { this.rt.sound?.whoosh?.(); this.rt.rumble?.(open ? 1.6 : 0.8, 0.35); }
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
    // hidden: plain wall, no glyph, until the lens shows it
    if (this.o.hidden) { const seen = this.rt.logic.has(shownBy(this.o.hidden)); this.glowMesh.visible = seen; for (const l of this.lamps) l.mesh.visible = seen; if (!seen) return; }
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
    if (this.o.hidden) this.group.visible = L.has(shownBy(this.o.hidden));
  }
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
  seen() { return this.rt.logic.has(shownBy(true)); }
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
      if (solid && !c.handle && this.physics) c.handle = this.physics.addCollider?.(c.block) ?? null;
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
   * tar: { burns, caught, out, back } (a tar ball, the Givers' House: an ember glob sets it alight, and so does rolling
   * it through a fire beside its groove (a Flame, a lit Brazier: their `fire`); it burns `burns` s, then goes out.
   * Burning, it lights the hooded bowl it comes to rest in (Brazier `hood`) and burns the thorns on its groove; cold,
   * the bowl tips it back out (`back` m/s)),
   * thorns: { id, at } (dry thorns across the groove at t = at, a Bramble: the ball stops against them while they
   * stand; burning, it burns them as it reaches them and rolls on),
   * current: { pull, still, stirs, stilled } (a sphere floating in a pool that stirs, the Footprint's: the water draws it
   * back toward the groove's start at `pull` m/s² unless condition `still` holds (a plate stood on stills the pool);
   * at rest on its plate (a berth) it stays),
   * strike: { at, reach } (a clapper, the Founders' Belfry: rolled to rest on its plate in a bell's mouth it strikes the
   * bell at `at`, a game 'bell' event there; and a splash on it as it lies there rocks it and strikes again),
   * heavy: item (an iron moon of the Moon Foundry's Casting-House: only a push, or a tether, made while carrying that
   * item (the founders' tongs) rolls it; anything else rocks it where it lies; heavyLine: what it says then),
   * iron: true (drawn as cast iron, dark with a rust ring),
   * shove: true (the Givers' House, v1.44: walked into along its groove, it rolls ahead of you at your pace, `shove` m/s
   * at most when a number: hands, no gadget), blade: true (a cut of the sword sends it rolling, BALL_CUT m/s: far
   * faster than a shove) }
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
    if (o.lamp) { this.orb = own({ color: rt.P.glow ?? '#8fe0d0', glow: 0.08, flat: true }); this.charge = 0; this.near = 0; }
    if (o.seed) this.husk = own({ color: '#a07a4e', flat: true });
    if (o.tar) { this.tarM = own({ color: '#4a3a33', flat: true }); this.burn = 0; }
    if (o.heavy || o.iron) this.ironM = own({ color: '#3d3a40', flat: true, metal: 'iron' });
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
    this.place();
    this.off = registerTarget({
      kind: 'ball', radius: this.r + 0.15, position: () => this.center, accepts: [...(o.seed ? ['bloom', 'tether'] : ['tether']), ...(o.blade ? ['blade'] : [])],
      onHit: (mode, point, dir, info) => this.hit(mode, dir, info),
    });
    this.rest = true;
  }
  place() {
    this.group.position.copy(this.a).lerp(this.b, this.t);
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
        else { this.pale = 1.2; this.rt.notice?.(this.o.seed.shade ?? 'The seed sprouts, pale, reaching for light that isn’t there, and folds back into its husk. Nothing grows in the shade.', `${this.id}.shade`); }
        return true;
      }
    }
    if (this.o.tar && mode === 'fire') { this.ignite(); return true; }   // (a tar ball catches: it doesn't roll for it)
    if (!dir) return false;
    // a clapper lying in its bell's mouth: a splash rocks it, and it strikes the bell again
    if (this.o.strike && this.rest && this.rt.logic.drumOn(this.id, this.rt.logic.el(this.id)?.plate)) { this.wobble = 0.4; this.strike(); return true; }
    if (this.o.lock && this.rest && this.rt.logic.drumOn(this.id, this.rt.logic.el(this.id)?.plate) && (!this.o.lamp || this.rt.logic.isLit(this.o.lamp.id))) { this.wobble = 0.4; return true; }   // (settled in its socket)
    if (this.drop) return true;
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
    // an iron moon: only a push (or a tether) made with the founders' tongs takes hold of it
    if (this.o.heavy && !(cone && this.rt.logic.has(this.o.heavy))) {
      this.wobble = 0.25; this.rt.sound?.critter?.('clank', 0.6);
      this.rt.notice?.(this.o.heavyLine ?? 'It rocks on its rail and settles back. Cast iron: far too heavy for a plain push.', `${this.id}.heavy`);
      return true;
    }
    if (this.o.sings && !cone) this.sing();   // (a singing ball: a splash makes it sing, and nudges it)
    const along = dir.x * this.dir.x + dir.z * this.dir.z;
    const k = cone ? 4.2 + 4.5 * (info.strength ?? 1) : 1.2;   // m/s: a push (or a tether's pull) rolls it a few metres, a splash nudges it
    if (Math.abs(along) < 0.25) { this.wobble = 0.4; return true; }
    this.v += Math.sign(along) * k * Math.min(1, Math.abs(along) + 0.3);
    this.rest = false;
    this.rt.sound?.critter?.('creak', 0.7);
    return true;
  }
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
    if (t <= 0 || t >= 1) { t = THREE.MathUtils.clamp(t, 0, 1); this.v = -this.v * 0.25; this.rt.sound?.critter?.('clack', 0.5); }
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
      if (L.moveDrum(this.id, this.t) && [e?.plate, ...Object.keys(e?.stops ?? {})].some((p) => p && L.drumOn(this.id, p))) { this.rt.sound?.chime?.(); if (this.o.strike && L.drumOn(this.id, e.plate)) this.strike(); }
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
    const by = pool || (!!P && this.rest && L.has('lantern') && P.pos.distanceTo(this.center) < (o.reach ?? 2.8));
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
      if (this.burn === 0) { this.flames.mesh.visible = false; this.light.set(0, -1e5, 0, 0); this.rt.notice?.(o.out ?? 'The tar ball’s flame gutters, and goes out.', `${this.id}.out`); }
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
  dispose() { this.off?.(); }
}

// ---------------------------------------------------------------------------------------- fire
export class Brazier {
  /**
   * o: { id, at, scale, tripod (a tall bronze stand of three legs round its stem), hood: { ball, yaw, said, cold }
   * (a hooded bowl, the Givers' House: a stone hood over it with a low mouth on its groove, facing `yaw`; no ember
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
    const bowl = lathe([[0.25, 0], [0.5, 0.15], [0.9, 0.55], [1.1, 0.95], [1.0, 1.0], [0.75, 0.62], [0.2, 0.55]].map(([r, y]) => [r * s, y * s + 1.1 * s]), 18);
    this.group.add(mesh([lathe([[0.7, 0], [0.7, 0.2], [0.35, 0.4], [0.3, 1.15], [0.5, 1.2]].map(([r, y]) => [r * s, y * s]), 14), bowl], M.trimMat));
    if (o.tripod) {
      // three bronze legs splayed round the stem, a ring binding them under the bowl (the cistern's, as drawn)
      const bronze = own({ color: '#b08a4a', flat: true }), legs = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2, foot = V(Math.sin(a) * 0.95 * s, 0, Math.cos(a) * 0.95 * s), top = V(Math.sin(a) * 0.45 * s, 1.15 * s, Math.cos(a) * 0.45 * s);
        legs.push(new THREE.TubeGeometry(new THREE.LineCurve3(foot, top), 1, 0.07 * s, 5));
      }
      legs.push(T(new THREE.TorusGeometry(0.55 * s, 0.05 * s, 4, 16), [0, 0.75 * s, 0], [Math.PI / 2, 0, 0]));
      this.group.add(mesh(legs, bronze));
    }
    if (o.hood) {
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
  init(physics) { this.physics = physics; if (!this.burnt) this.handle = physics.addCollider?.(this.block) ?? null; }
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
   * shut while its element's `when` fails (it can't wake now). blade: a struck eye (the Givers' House): only a cut of the
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
    const seen = () => !this.hidden || rt.logic.has(shownBy(o.hidden));
    this.off = registerTarget({ kind: 'switch', radius: o.crystal ? Math.max(s, o.crystal * 0.45) : s, position: () => this.center, enabled: seen, accepts: o.pull ? ['tether'] : o.blade ? ['blade'] : undefined, onHit: (mode) => this.hit(mode) });
    this.seen = seen;
    this.flash = 0;
  }
  /** A splash (any mode: it is fluid) wakes it; a moorers' ring (o.pull) only a tether's pull. */
  hit(mode) {
    // a struck eye (o.blade, the Givers' House): only the sword's cut wakes it; a splash only wets the stone
    if (this.o.blade && mode !== 'blade') {
      if (!this.on) { this.flash = 0.4; this.rt.notice?.(this.o.wrong ?? 'The eye is cut in hard stone, and rings when you knock on it. It wants striking.', `wrong.${this.id}`); }
      return true;
    }
    if (this.o.pull && mode !== 'tether') {
      if (!this.on) { this.flash = 0.6; this.rt.sound?.critter?.('clank', 0.5); this.rt.notice?.(this.o.wrong ?? 'The ring clanks on its post and hangs still. It wants pulling, not wetting.', `wrong.${this.id}`); }
      return true;
    }
    if (this.rt.logic.light(this.id)) { this.on = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
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
  dispose() { this.off?.(); }
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
      // in turn (o.order: the eyes' indices in the order they must wake): out of turn, every eye goes dark
      if (this.time - e.at <= this.window) return true;   // (awake already: a second splash changes nothing)
      if (i !== this.o.order[this.seq ?? 0]) {
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
      if (L.light(this.id)) { this.done = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
      else if (this.o.unmet && !L.check(L.el(this.id)?.when)) this.rt.notice?.(this.o.unmet, `bank.unmet.${this.id}`);
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
    const St = this.o.stroke;
    for (const e of this.eyes) {
      if (!e.piston) continue;
      const turn = St ? ((((this.time / St.period - (e.piston.phase ?? 0)) % 1) + 1) % 1) * St.period < St.up : true;
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

/** Bell-tuned: the bell-note whistle sounded within reach rings element `id` (a 'bell' element: needs the bell).
 * o: { id, at, reach, heard (what it says when it answers), heardKey (say it once), fading (said as a held note fades) }
 * A held bell (its element has `hold: s`, logic.js) rings for s seconds and falls quiet: what it holds lets go
 * (a held door shuts, held stones rise). Sounded again while it rings, the note starts over. */
export class BellEar {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o; this.at = rt.kit.world(...o.at); this.reach = o.reach ?? 40;
    this.hold = rt.logic.el?.(o.id)?.hold ?? 0;
    this.left = 0;
    this.off = rt.game?.on?.('bell', ({ pos, soft } = {}) => {
      if (!pos || soft || pos.distanceTo(this.at) > this.reach) return;   // (soft: the listening shell's hum, not a bell)
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
 * Wakes to the lantern charm's light: stand by it (within `reach`) with the lantern a moment (`hold` s), and
 * element `id` (a 'switch' that needs the lantern) is lit for good. o: { id, at, reach, hold }. reach 0: only
 * something else wakes it (a Ball's `lamp`, the pool-orb); it glows once its element is lit.
 */
export class LightEar {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.at = rt.kit.world(...o.at); this.reach = o.reach ?? 3.5; this.hold = o.hold ?? 1.5;
    this.t = 0;
    this.glow = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.05, flat: true });
    const m = mesh([T(new THREE.SphereGeometry(0.5, 14, 10), [0, 0, 0])], this.glow);
    m.position.copy(this.at).add(V(0, 2.8, 0));
    noCollide(m);
    rt.root.add(m);
    this.lit = rt.logic.isLit(o.id);
  }
  update(dt, t) {
    this.lit ||= this.rt.logic.isLit(this.id);   // (woken some other way: a glowing pool-orb, reach 0)
    const P = this.rt.player, has = this.rt.logic.has('lantern');
    const near = P && has && P.pos.distanceTo(this.at) < this.reach;
    this.t = near ? this.t + dt : 0;
    if (!this.lit && this.t > this.hold && this.rt.logic.light(this.id)) { this.lit = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
    this.glow.uniforms.uGlow.value = this.lit ? 0.9 : near ? 0.2 + 0.7 * Math.min(1, this.t / this.hold) : 0.05 + 0.03 * Math.sin(t * 1.2);
  }
}

// ---------------------------------------------------------------------------------------- living gates
const _frost = new THREE.Color('#d6f0fa');

/**
 * A gate of jaws (Lorn's Hush): two great leaves with teeth, hinged at a doorway's jambs, that snap shut
 * and half open, shut and half open, never wide enough to pass, and bite whoever tries. A stilling glob
 * (the 'stun' mode) stills them: element `still` (a 'switch' that needs the stilling mode) is lit, and
 * the door `id` (which opens on it) eases them wide, for good. Solid while shut.
 * o: { id (the door), still, at: the doorway's foot, yaw, w, h, seed }
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
    const lip = own({ color: '#ee93a2', flat: true }), throat = own({ color: '#93304a', flat: true }), tooth = own({ color: '#f3ead8', flat: true });
    this.halves = [-1, 1].map((side) => {
      const g = new THREE.Group();
      g.position.set(side * w / 2, 0, 0);
      const cx = -side * w / 4;
      g.add(mesh([new THREE.SphereGeometry(1, 16, 10).scale(w / 4 + 0.15, h / 2, 0.75).translate(cx, h / 2, 0)], this.skin));
      // the inner edge (where the two meet): pale lips, dark gums, a row of teeth
      const edge = -side * (w / 2 - 0.1);
      g.add(mesh([new THREE.SphereGeometry(1, 12, 8).scale(0.7, h / 2 - 0.45, 0.82).translate(edge + side * 0.45, h / 2, 0)], throat));
      g.add(mesh([new THREE.SphereGeometry(1, 12, 8).scale(0.3, h / 2 - 0.2, 0.9).translate(edge + side * 0.1, h / 2, 0)], lip));
      const teeth = [];
      for (let i = 0; i < 9; i++) { const y = 0.7 + (i / 8) * (h - 1.4); teeth.push(T(new THREE.ConeGeometry(0.16, 0.7, 6), [edge, y, i % 2 ? 0.25 : -0.25], [0, 0, side * Math.PI / 2])); }
      g.add(mesh(teeth, tooth));
      this.group.add(g);
      return { g, side };
    });
    noCollide(this.group);
    // Collision while shut: each half as drawn, a moving collider that snaps with it (physics.addMover; synced
    // each frame), and a thin still slot down the middle, inside the lips when they meet, that keeps the way
    // when they gape (never wide enough to pass). A box the size of the doorway stood in for both: the
    // halves' round sides lay up to 0.75 m inside it. Open (stilled), they are walk-through as before: laid
    // back against the jambs they would narrow the way on and stand over the next room's mark.
    this.block = new THREE.Mesh(box(w * 0.42, h - 1, 0.12, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.center = this.group.position.clone().addScaledVector(UP, h * 0.5);
    this.open = rt.logic.isOpen(o.id);
    this.k = this.open ? 1 : 0;   // 0 snapping, 1 wide open
    this.frost = 0; this.snapT = (o.seed ?? 0) * 0.37; this.ang = 0; this.angry = 0;
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
    this.handle = P.addCollider?.(this.block) ?? null;
  }
  hit(mode) {
    if (this.open) return false;
    if (mode === 'stun') {
      if (this.rt.logic.light(this.still)) { this.frost = 1; this.rt.sound?.chime?.(); this.rt.onLit?.(this.still); this.rt.notice?.(this.o.stilled ?? 'The jaws stop dead, frosted, and ease open. They forget to close.', `stilled.${this.id}`); }
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
    if (this.open) this.k = Math.min(1, this.k + dt / 2.4);
    // shut and half open, shut and half open (quicker when splashed): the opening slow, the snap fast
    this.snapT += dt * (this.angry ? 1.8 : 0.85);
    const ph = this.snapT % 1, snap = ph < 0.75 ? ease(ph / 0.75) : 1 - (ph - 0.75) / 0.25;
    const half = 0.12 + 0.38 * snap, k = ease(this.k);
    this.ang = this.open ? half * (1 - k) + 1.45 * k : half;
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
 * onStill(swing) (instead of an element: something else hears its note; `taken` makes it glow on) }
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
    this.arm.add(mesh([T(new THREE.OctahedronGeometry(1, 0), [0, -len, 0], [0, 0.6, 0], [1.5 * z, 2.1 * z, 1.5 * z]), T(new THREE.OctahedronGeometry(1, 0), [0.9 * z, -len + 0.6 * z, 0.3 * z], [0, 0, 0.5], [0.6 * z, 1.0 * z, 0.6 * z])], this.mat));
    noCollide(this.group);
    this.center = V(); this.still = 0; this.cool = 0; this.theta = 0; this.way = 1;
    this.place();
    this.off = registerTarget({ kind: 'swing', radius: 1.9, accepts: ['stun'], position: () => this.center, onHit: (mode) => this.hit(mode) });
    // a working (src/workings.js): what it meets, a foe too, it knocks away the way it swings
    this.working = { kind: 'swing', center: this.center, radius: 1.9,
      contains: (p) => (p.x - this.center.x) ** 2 + (p.z - this.center.z) ** 2 < 1.9 * 1.9 && Math.abs(p.y + 0.9 - this.center.y) < 2.6,
      moving: () => this.still <= 0,
      push: (p, out) => out.set(this.way, 0, 0).transformDirection(this.group.matrixWorld) };
    this.offWorking = registerWorking(this.working);
  }
  hit(mode) {
    if (mode === 'stun') {
      if (!this.still) this.rt.sound?.chime?.();
      this.still = this.stillFor;
      if (this.o.onStill) { this.o.onStill(this); return true; }   // (its note heard by something else: the Mother Snapper's crystals)
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
      const out = V(this.way, 0, 0).transformDirection(this.group.matrixWorld).multiplyScalar(9).addScaledVector(UP, 4);
      P.knockDown?.(out, { why: 'guardian' });
      P.hurt?.(sparing(heartsOf(P), DAMAGE.blow), 'guardian');
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
 * the first that holds sets how high it rises), still (said when you open your wings over it while it is still) }
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
    if (P && !this.on && this.o.still && P.gliding && this.inside(P.pos)) this.rt.notice?.(this.o.still, `updraft.still.${this.o.id ?? ''}`);
    if (!P || P.dead || P.down || !this.contains(P.pos)) { this.rideT = 0; return; }
    if (!P.gliding) {
      if (!P.onGround && P.vel.y < 0) this.rt.notice?.(this.o.hint ?? 'The wind rushes up past you. Open your wings in it.', 'updraft.hint');
      return;
    }
    // the wings catch it: straight up, settling onto its middle (src/updraft.js); at its top it eases and holds you
    // there until you steer off it
    rideColumn(P, dt, { x: this.foot.x, z: this.foot.z, top: this.foot.y + this.h, lift: this.lift, r: this.r });
    if ((this.rideT += dt) > 0.4) this.rt.notice?.(this.o.ride ?? 'The wind fills your wings and lifts you, round and up.', 'updraft.ride');
  }
}

/**
 * Gusts down a hall (Vael's Aerie): calm a while, then a warning (pale streaks start), then the wind blows
 * along `dir` (local) and shoves whoever stands in the open back along it. Behind a screen (a `shelter`
 * box) it can't reach you. o: { min, max: the hall (local), dir: [x, 0, z], shelters: [[min, max]], calm, blow, push,
 * when (a condition: it blows only while that holds, the Aerie's vents), carry (m/s: with the wings open it carries you
 * along `dir` instead of shoving you back, a tailwind: push by default), carried (said the first time it does), guard
 * (the Givers' House: the shield raised into the wind breaks it, and you walk on into it at `guardPace` m/s), guarded
 * (said the first time) }
 */
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
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(g, this.mat);
      this.root.add(m);
      this.streaks.push({ m, x: this.box.min.x + rnd() * size.x, y: this.box.min.y + 0.4 + rnd() * Math.min(size.y, 8), u: rnd(), v: 0.8 + rnd() * 0.6 });
    }
    noCollide(this.root);
    this.size = size;
    // a working (src/workings.js): while it blows it shoves any foe in the open down the hall
    this.working = { kind: 'gust', dir: this.dirW, push: this.push,
      contains: (p) => this.box.containsPoint(rt.kit.local(p)),
      blowing: () => this.state === 1,
      sheltered: (p) => this.sheltered(rt.kit.local(p)) || screened(p, this.dirW) };
    this.offWorking = registerWorking(this.working);
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
    for (const s of this.streaks) {
      s.u = (s.u + dt * (st === 1 ? 0.9 : 0.3) * s.v) % 1;
      const w = d < 0 ? hi - s.u * len : lo + s.u * len;
      if (alongX) { s.m.position.set(w, s.y, this.box.min.z + ((s.x - this.box.min.x) / Math.max(1e-3, this.size.x)) * this.size.z); s.m.rotation.y = Math.PI / 2; }
      else s.m.position.set(s.x, s.y, w);
      s.m.visible = st > 0 && !(st === 0.5 && s.v > 1.1);
    }
    this.mat.uniforms.uGlow.value = st === 1 ? 0.6 : 0.35;
    const P = this.rt.player;
    if (!P || P.dead || st < 1) return;
    const l = this.rt.kit.local(P.pos);
    if (!this.box.containsPoint(l) || this.sheltered(l) || screened(P.pos, this.dirW)) return;   // (or behind a wall drawn in ink: src/wind-screens.js)
    // the shield raised into it (o.guard, the Givers' House): it breaks the wind, and you walk on into it, slowly
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
      this.rt.notice?.(this.o.carried ?? 'The gust fills your wings and carries you with it.', 'gust.carried');
      return;
    }
    // shoved back down the hall (your own legs win a little of it back)
    P.vel.x = this.dirW.x * this.push; P.vel.z = this.dirW.z * this.push;
    if (P.climbing) P.climbing = false;
    this.rt.notice?.(this.o.notice ?? 'The gust shoves you back down the hall. Wait it out behind a screen.', 'gust');
  }
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
    this.off = registerTarget({ kind: 'vane', radius: r, position: () => this.center, onHit: (mode) => this.hit(mode) });
  }
  /** Is it turning (its element lit)? */
  get turning() { return this.rt.logic.isLit(this.id); }
  /** A splash: a small vane spins a while; a great one only rocks. */
  hit() {
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
  /** A steady wash over it: the bellows' off open wings (the Warden's bellows), or the debug jets burning; within reach over its face and not far off its axis. */
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
      const lm = mesh([T(new THREE.SphereGeometry(0.28, 10, 8), [Math.cos(a) * (r + 0.7), -t - 0.2, Math.sin(a) * (r + 0.7)])], m);
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
  init(physics) { this.physics = physics; if (!this.open) this.handle = physics.addCollider?.(this.block) ?? null; }
  setOpen(open, instant = false) {
    if (open === this.open) return;
    this.open = open;
    if (open && this.handle) { this.physics?.removeCollider?.(this.handle); this.handle = null; }
    if (!open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block) ?? null;
    if (instant) { this.k = open ? 1 : 0; this.apply(); }
    else { this.rt.sound?.whoosh?.(); this.rt.rumble?.(open ? 1.6 : 0.8, 0.35); }
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
 * The light itself is the logic's (an eye's or a seed's `when`); this is how it looks: thin pale rays from the
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
    this.mat = own({ color: '#fff1c2', glow: 0.75, flat: true });
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
    // the rays: thin pale bars from the louvre's rim to the pool's rim
    this.rays = [];
    const g = new THREE.BoxGeometry(0.05, 0.05, 1).translate(0, 0, 0.5);
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(g, this.mat); this.group.add(m); this.rays.push({ m, a: (i / 9) * Math.PI * 2, top: i % 3 === 0 ? 0.2 : 0.75 }); }
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
    for (const r of this.rays) r.m.visible = show;
    if (!show) { this.light.set(0, -1e5, 0, 0); return; }
    // the pool, flush on what it lights (a floor, a wall)
    this.pool.position.copy(this.at).addScaledVector(this.n, 0.05);
    this.pool.quaternion.setFromUnitVectors(UP, this.n);
    this.pool.scale.set(this.r * k, 1, this.r * k);
    this.poolMat.uniforms.uGlow.value = 0.45 + 0.3 * k + 0.05 * Math.sin(t * 1.3);
    // the rays: from round the louvre to round the pool (a pool's rim: two axes across its normal)
    const u = this._a.set(1, 0, 0); if (Math.abs(this.n.x) > 0.9) u.set(0, 0, 1);
    const v = this._b.crossVectors(this.n, u).normalize(); u.crossVectors(v, this.n).normalize();
    for (const r of this.rays) {
      const top = this._c.set(Math.cos(r.a) * r.top, 0, Math.sin(r.a) * r.top).add(this.from);
      const bot = (this._d ??= V()).copy(this.at).addScaledVector(u, Math.cos(r.a) * this.r * 0.85).addScaledVector(v, Math.sin(r.a) * this.r * 0.85);
      r.m.position.copy(top);
      r.m.lookAt(bot);
      r.m.scale.set(1, 1, Math.max(0.01, top.distanceTo(bot) * k));
    }
    this.mat.uniforms.uGlow.value = 0.55 + 0.2 * k;
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
      else if (this.rt.logic.el(this.id)?.when) { this.pale = 1.2; this.rt.notice?.(this.o.shade ?? 'It sprouts, pale, reaching for light that isn’t there, and folds back into its husk. Nothing grows in the shade.', `${this.id}.shade`); }
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
  init(physics) { this.physics = physics; if (!this.open) this.handle = physics.addCollider?.(this.block) ?? null; }
  hit(mode) {
    if (this.open) return false;
    if (mode === 'bloom') {
      if (this.bloom && this.rt.logic.light(this.bloom)) { this.rt.sound?.chime?.(); this.rt.onLit?.(this.bloom); this.rt.notice?.(this.o.opened ?? 'The bud swells, and splits, and its petals fold back against the wall like a hand opening.', `bud.${this.id}`); }
      else if (!this.bloom && this.o.dry) { this.curl = 0.4; this.rt.notice?.(this.o.dry, `bud.dry.${this.id}`); }
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
    if (!open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block) ?? null;
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
 * o: { id, note, at, yaw, reach, lintel, hears, stand, size, heard, wrong, fading }
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
    this.group.add(mesh([T(lathe([[0.12, 0], [0.18, 0.5], [0.35, 0.9], [0.75, 1.15], [0.8, 1.2]], 14).scale(sz, sz, sz), [0, y, -0.4 * sz], [Math.PI / 2, 0, 0])], own({ color: '#d8a24a', flat: true, side: THREE.DoubleSide })));
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
        }
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
  init(physics) { this.physics = physics; if (this.open) this.handle = physics.addCollider?.(this.block) ?? null; }
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
    if (open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block) ?? null;
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

// ---------------------------------------------------------------------------------------- marks and pits
export class Mark {
  /** A checkpoint: a glyph stone. o: { room, at, yaw } */
  constructor(rt, o) {
    this.rt = rt; this.room = o.room;
    const K = rt.kit, M = rt.M;
    this.pos = K.world(...o.at);
    this.heading = K.heading(o.yaw ?? 0);
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
  update(dt, t) {
    const p = this.rt.player;
    if (p && p.onGround && p.pos.distanceTo(this.pos) < 4 && this.rt.checkpoint?.room !== this.room) this.rt.setCheckpoint(this);
    const on = this.rt.checkpoint === this;
    this.glow.uniforms.uGlow.value = on ? 0.75 + 0.2 * Math.sin(t * 2) : 0.12;
  }
}

/** Fall below a chasm's lip and you are back at the room's mark. o: { room, min: [x, y, z], max } (local) */
export class Pit {
  constructor(rt, o) {
    this.rt = rt; this.room = o.room;
    this.box = new THREE.Box3(V(...o.min), V(...o.max));
  }
  contains(p) { return this.box.containsPoint(this.rt.kit.local(p)); }
}
