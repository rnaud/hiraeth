import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { registerTarget } from './targets.js';
import { screened } from './wind-screens.js';
import { hazardAt } from './hazards.js';
import { workingsAt } from './workings.js';
import { Telegraph, strikeDamage, inArea } from './temples/boss.js';
import { game as sharedGame } from './game-state.js';
import { gainInk, INK_OF } from './ink.js';
import { ShadeBody, ShadePools } from './shade.js';
import { KINDS, NOTES, kindModel } from './foe-kinds.js';
import { packOf, guardKinds, templeKind } from './foe-worlds.js';
import { hitStop, kick, slowMo } from './feel.js';
import { LockReticle } from './lock-reticle.js';

// Foes (docs/systems/foes.md): the first things in the game that fight back.
//
// - **Ink blots** gather in the wilds: loose ink and scribble that drift in from the margins of the
//   drawing, away from people, the ship and the cities. They compress, then lunge through a visible
//   strike and recover. The fluid blade cuts them back into ink; a shot or an ember
//   glob washes them too, stilling freezes them. Each one cut gives the tank a charge back.
// - **The makers' machines** stand in the temples' rooms: old constructs gone wrong, heavier, slower,
//   planting their feet and raising their arms before a committed slam. The blade breaks them (fluid and ember only stagger
//   them, stilling freezes them); broken, they stay broken (a flag per save).
//
// Nothing here can take a healthy bar to nothing in one blow (strikeDamage, as the guardians). The
// Enemies setting turns them all off; Home, the Lab, the References and the Atelier never have any.
//
//   const foes = new Foes({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, notice })
//   foes.update(dt, paused)            per frame
//   foes.list                          every foe alive in the world

/** Each kind's tuning. attack: its first strike (src/temples/boss.js inArea for the area); attacks: all it has
 *  (src/foe-kinds.js says what an attack may hold: a combo's `then`, a shockwave, a volley…). */
export const FOES = {
  blot: {
    name: 'ink blot', hp: 2, radius: 0.6, height: 0.55, speed: 3.4, sight: 17, giveUp: 40, reach: 2.1, flinchy: true,
    attacks: [
      { id: 'lunge', shape: 'ring', radius: 1.7, ahead: 1.1, damage: 0.15, wind: 0.65, strike: 0.24, contact: 0.55, lunge: 1.8, weight: 2 },
      // the lunge-combo: a longer coil, a lunge, and a second quick one straight after (unless the first was blocked)
      { id: 'combo', shape: 'ring', radius: 1.6, ahead: 1.0, damage: 0.12, wind: 0.8, strike: 0.22, contact: 0.55, lunge: 1.6, then: 'again', min: 0.8 },
      { id: 'again', chain: true, shape: 'ring', radius: 1.6, ahead: 1.0, damage: 0.12, wind: 0.32, strike: 0.22, contact: 0.55, lunge: 1.8 },
    ],
    recover: 1.0, cool: [1.1, 2.2], hit: 0.35,
  },
  machine: {
    name: 'makers’ machine', hp: 4, radius: 0.8, height: 1.0, speed: 2.1, sight: 13, giveUp: 14, reach: 2.6, heavy: true, metal: true, breaks: true,
    tone: '#e0703a', sound: 'machine', takes: { shoot: 0, fire: 0 },
    attacks: [
      { id: 'slam', shape: 'cone', range: 3.3, angle: 0.8, damage: 0.22, wind: 1.05, strike: 0.32, contact: 0.55, knock: 7, weight: 1.6 },
      // the ground slam: both arms high and a longer hold, then a ring of shock runs out over the floor (jump it)
      { id: 'quake', shape: 'ring', at: 'self', radius: 2.0, tele: true, damage: 0.18, wind: 1.35, strike: 0.3, contact: 0.6, knock: 6, wave: { speed: 7, reach: 8, damage: 0.12, width: 0.55 } },
    ],
    recover: 1.5, cool: [1.4, 2.4], hit: 0.5,
  },
  // keeps its distance (inside `keep` it backs off) and lobs a glob of ink: the ring is drawn where you stand
  spitter: {
    name: 'spitting blot', hp: 2, radius: 0.55, height: 0.6, speed: 2.6, sight: 20, giveUp: 40, reach: 11, keep: 6.5, tone: '#7f9a2e',
    attacks: [
      { id: 'lob', shape: 'ring', at: 'target', instant: true, radius: 1.6, damage: 0.14, wind: 1.25, weight: 2 },
      // the arc volley: three globs, three rings across your way (step between them, or out of the row)
      { id: 'volley', shape: 'ring', at: 'target', instant: true, spread: [-3, 0, 3], radius: 1.2, damage: 0.12, wind: 1.45, min: 4 },
    ],
    recover: 1.3, cool: [1.6, 2.6], hit: 0.35,
  },
  // tiny and quick, five or six at once: one cut, or a push, and each is gone
  swarm: {
    name: 'blot swarm', hp: 1, radius: 0.28, height: 0.28, speed: 5.2, sight: 16, giveUp: 40, reach: 1.3, light: true, takes: { shoot: 1, fire: 1, push: 1 },
    attack: { shape: 'ring', radius: 1.0, ahead: 0.6, damage: 0.05, wind: 0.5, strike: 0.24, contact: 0.55, lunge: 1.0 },
    recover: 0.7, cool: [0.6, 1.4], hit: 0.2,
  },
  // hovers out of the blade's reach and dives along a lane drawn on the ground; low after its dive, it can be cut
  flyer: {
    name: 'winged blot', hp: 2, radius: 0.6, height: 0.5, hover: 3.6, speed: 3.8, sight: 22, giveUp: 45, reach: 6,
    attack: { shape: 'lane', width: 1.7, range: 9, damage: 0.17, wind: 1.0, strike: 0.4, contact: 0.85, dive: true },
    recover: 1.7, cool: [1.8, 2.8], hit: 0.3,
  },
  // a person made of living shadow (src/shade.js): it walks up and cuts with a sword's swing, dripping as it goes
  shade: {
    name: 'shade', hp: 5, radius: 0.45, height: 1.15, speed: 3.0, sight: 18, giveUp: 40, reach: 2.3, tone: '#3b2a5c',
    attack: { shape: 'cone', range: 2.9, angle: 0.9, damage: 0.2, wind: 0.95, strike: 0.24, contact: 0.55 },
    recover: 1.1, cool: [1.2, 2.2], hit: 0.4,
  },
  ...KINDS,   // each world's own (src/foe-kinds.js)
};
for (const D of Object.values(FOES)) {
  D.attacks ??= [{ id: 'strike', ...D.attack }];
  D.attack ??= D.attacks[0];
  D.takes ??= { shoot: 1, fire: 1 };
  D.plural ??= `${D.name}s`;
}
/** A kind's attack by its id (a combo's next). */
export const attackOf = (kind, id) => FOES[kind]?.attacks.find((a) => a.id === id) ?? null;
/** Worlds with no foes at all. */
export const PEACEFUL = new Set(['home', 'lab', 'references', 'atelier', 'overnighttrain', 'lantern']);   // (the Arena has its own waves: level.foes; the Overnight Train has no wilds: off it is the running land)
/** Where the wilds start: this far from any person, and from where the ship lands. */
export const WILD = { people: 45, spawn: 55 };
/** The packs of ink blots: how many at once, how far out they come in, how long before the next. */
export const PACK = { size: [2, 3], first: 1, near: 18, far: 26, settle: 3, rest: [35, 55], drop: 85 };
/** Worlds of open sky, where winged blots fly. */
export const SKY_WORLDS = new Set(['arzach', 'arzach2', 'glassdunes', 'fallenring', 'underside', 'antennas']);
/** What a pack is: the world's roster (src/foe-worlds.js packOf): the first, its own kind alone; then a lead and its fillers. */
export function packKinds(n, levelId, rng = Math.random) { return packOf(n, levelId, rng); }
const STILL = 3.5;   // s a stilling glob holds a foe
const PARRY_STUN = 2;   // s a perfect parry leaves it stunned
/** The Arena's waves (level.foes.waves: src/levels/arena.js), round and round; they come in this far out, this long after the last. */
export const WAVES = [['blot'], ['blot', 'blot', 'blot'], ['spitter', 'blot'], Array(6).fill('swarm'), ['machine'], ['shade'], ['flyer', 'flyer'], ['spitter', 'spitter', 'machine'], ['shade', 'shade', 'blot'], ['machine', 'machine', 'blot', 'blot', 'flyer'],
  // then each world's own (src/foe-kinds.js)
  ['ray'], ['golem'], ['moth', 'moth', 'moth'], ['drone', 'drone'], ['stalker', 'blot'], ['crab', 'crab'], ['slag'], ['hound', 'hound'], ['golem', 'crab', 'drone', 'hound']];
export const WAVE = { near: 10, far: 14, rest: 3 };
/** How many foes may wind up a strike at once (the others circle, waiting a turn); how far apart they keep. */
export const TURNS = { strikers: 2, apart: 0.3 };
/** Relics out in the wilds are guarded (placed, not by chance): a few blots gather round as you come near; cut down, they are gone for good. */
export const GUARDS = { near: 32, size: 2, ring: 3.5 };
/** The lock-on (R3 / Tab): a foe within `reach` (the nearest in front first); lost past `lose` or when it falls. */
export const LOCK = { reach: 18, lose: 26 };
/**
 * Switching the lock with a flick (v0.97): while locked, the look's sideways motion (the right stick, the mouse, a
 * touch drag: px as rig.look gets them) gathers in a leaky sum (`decay` /s); past `px` the lock jumps to the nearest
 * foe on that side of the screen, then rests `rest` s. The stick's full tilt (~900 px/s) gets there in ~0.12 s; held
 * at half tilt or less it settles below (≤ 56), so leaning on the stick never switches.
 */
export const FLICK = { px: 70, decay: 8, rest: 0.35 };
/** A cut that lands and doesn't stop it (a heavy foe, a late wind-up, a strike): its armour's answer, a dull thunk and sparks. */
export const ARMOUR = { ring: 0.9 };
/** A hovering foe (`hover`) the blade cuts is knocked low this long (s), within the blade's reach. */
export const KNOCKED_LOW = 2.6;
/**
 * Pressure, not flight (docs/systems/foes.md, "Staying in the fight"): a foe that keeps its distance (`keep`) backs
 * off for at most `retreat` s, then stands its ground and fights until it has struck again; one led off past its
 * `giveUp` goes home only once you have left too (this far from its home past giveUp), never while you are still
 * fighting it there. While you are knocked down they hold round you at `hold` m past their reach, and come on as
 * you rise.
 */
export const PRESSURE = { retreat: 1.1, leave: 8, hold: 1.6 };
/**
 * The dune ray (`burrow`): up out of the sand it stays up `up` s (it fights surfaced: its glide, its tail), and only
 * then dives again; a cut at its fin flushes it out, dazed `flush` s (no harm: the sand takes the blow).
 * The shadow hound (`phase`) is only a shadow while running more than `near` m from you: closer, it is solid.
 */
export const BURROW = { up: 6, flush: 0.9 };
export const PHASE = { near: 3.2 };
/** Gentle: wind-ups this much slower, harm this much less, packs at most this big and this much rarer. */
export const GENTLE = { wind: 1.35, harm: 0.5, pack: 2, rest: 1.6 };
/**
 * Foes in the world's height and workings (v0.98, docs/systems/foes.md "Foes in the world's workings"):
 * - HOVER: a hovering kind keeps its `hover` over the higher of its footing and the traveller (`Foe.over`, the
 *   extra it holds: climbing `climb` m/s, sinking `sink`, never more than `max` over its footing), so over a
 *   drop it holds its altitude and on a ledge it rises to stay above you.
 * - COVER: between strikes (chasing, its `cool` at least `minCool`) it looks round itself (`dirs` ways, `near`
 *   and `far` m) for a spot the traveller can't see (a physics ray: env.seen) and drifts there; it comes out
 *   after `hold` s (Gentle `gentle`), or `stay` s once there, or when cut low, found or due to strike. Nothing
 *   to hide behind: it climbs `climb` m higher instead, for as long. Once between two strikes (`Foe.hid`).
 * - FALL: knocked off a ledge (`Foe.air`), a walker falls at `gravity`; a fall of more than `hard` m (or a
 *   throw by an updraft) lands hard: a cut (two past `harder`) and `stun` s. Past `lost` m, below the world's
 *   killY or into a temple's pit it is gone. A hovering foe stilled over a drop falls as far.
 * - WORLD_HARM: a hazard (src/hazards.js) a foe is knocked into cuts it (`spikes`, `fire`: damage) at most
 *   every `every` s, and throws it back out at `shove` m/s. It never walks into one (nor an updraft) itself.
 * - WORKS: the workings (src/workings.js): an updraft throws a walker up (`throw` m/s) to land hard, and tumbles
 *   a hovering one up out of control `tumble` s then stuns it `stun` s; a blowing gust shoves any foe (× by
 *   kind, a stilled one slides like a crate); a swinging pendulum knocks one away (`knock` m/s, `up`), cut and
 *   stunned. `cool`: s before the same working takes it again.
 */
export const HOVER = { max: 12, climb: 3, sink: 3 };
export const COVER = { near: 6, far: 10, dirs: 8, minCool: 0.8, hold: 2.6, gentle: 1.2, stay: 1.4, climb: 2.2, close: 3, out: 0.3 };
export const FALL = { gravity: 20, edge: 1.1, hard: 3.5, harder: 8, stun: 1.2, lost: 60 };
export const WORLD_HARM = { every: 0.6, spikes: 1, fire: 1, other: 1, shove: 5 };
export const WORKS = {
  updraft: { throw: 10, out: 3, tumble: 0.9, stun: 1.4, cool: 2 },
  gust: { heavy: 0.7, still: 1.1, hover: 1.2, light: 1.25 },
  swing: { knock: 9, up: 4, heavy: 0.75, stun: 1.2, cool: 1.5 },
};
const _hz = new THREE.Vector3(), _pb = new THREE.Vector3(), _fb = new THREE.Vector3(), _cs = new THREE.Vector3(), _cf = new THREE.Vector3();

/** A strike reaches the traveller only this close in height (m, its feet to the foe's): the hitbox overlay draws it (src/hitboxes.js). */
export const STRIKE_RISE = 1.6;
/** A foe's target sphere (shots, the cone, the lock): its body's radius and a margin. The blade adds its own (fluid-blade.js BLADE_TOUCH). */
export const hurtRadius = (def) => def.radius + 0.15;
/** How near a charge (attack.sweep) must run to you to hit: half its lane's width, so the lane drawn is the ground it covers. */
export const sweepRadius = (a, def) => (a.width ? a.width / 2 : def.radius + 0.75);

/**
 * One foe's mind: idle at home (a slow drift round it), chase once you come into sight, wind up its
 * strike in reach (the telegraph), strike, recover, and go home if you lead it too far. Pure logic over
 * plain vectors: env { ground(x, y, z) → y or null (no footing), seen(from, to) → true when clear }.
 * update() returns the events of the frame: 'notice', 'warn', 'strike' { hit }, 'home'.
 */
export class Foe {
  constructor(kind, at, { rng = Math.random, id = null } = {}) {
    this.kind = kind; this.def = FOES[kind]; this.id = id; this.rng = rng;
    this.home = at.clone(); this.pos = at.clone(); this.heading = rng() * Math.PI * 2;
    this.hp = this.def.hp; this.state = 'idle'; this.timer = 0; this.cool = 0.6; this.stunned = 0; this.flash = 0;
    this.attackAt = new THREE.Vector3(); this.attackH = 0; this.wander = rng() * 10; this.vel = new THREE.Vector3();
    this.recoil = 0; this.recoilDir = new THREE.Vector3(); this.heavyRecoil = false;
    this.k = 0;   // the wind-up's progress 0..1 (the telegraph's fill)
    this.alt = this.def.hover ?? 0;   // how high it flies over its footing (a flyer)
    this.atk = this.def.attack;   // the attack it winds up or strikes with (chooseAttack)
    this.attackPts = null;        // a volley's rings (attack.spread), else the one at attackAt
    this.buried = !!this.def.burrow;   // a dune ray under the sand
    this.upFor = 0;                    // s it stays surfaced before it may dive again (BURROW.up)
    this.retreat = PRESSURE.retreat;   // s of backing off left (a `keep` kind); refilled when it strikes
    this.dist = Infinity;              // m to the traveller (flat), last update
    this.shelled = !!this.def.shell;   // a salt crab's shell (a bomb cracks it)
    this.flipped = 0; this.lit = 0; this.crust = 0; this.sleep = 0;   // s: on its back; lit by an ember; doused cold; asleep in a bloom
    this.low = 0;   // s knocked low by a cut (a hovering foe: KNOCKED_LOW)
    // the world (v0.98): the height a hovering foe holds over its footing (HOVER), its hiding place (COVER),
    // a fall (FALL: { vy, top, base, hard }), a tumble up an updraft, and the hazards' and workings' rests
    this.over = 0; this.overV = 0; this.fallTop = null; this.youY = null;
    this.cover = null; this.hid = false;
    this.air = null; this.tumble = 0; this.tumbleTop = 0;
    this.hazCool = 0; this.workCool = { updraft: 0, swing: 0 };
  }
  get alive() { return this.state !== 'dead'; }
  get chest() { return (this._chest ??= new THREE.Vector3()).copy(this.pos).setY(this.pos.y + this.over + this.def.height + this.alt); }
  /** The level its strikes and its sight are measured from: a walker's feet; a hovering foe's footing and the height it holds over it. */
  get level() { return this.pos.y + this.over; }
  /** Where its body is (the hazards' and the workings' test point): its feet, or under a hovering body. */
  bodyAt(out = (this._body ??= new THREE.Vector3())) { return out.set(this.pos.x, this.pos.y + this.over + this.alt, this.pos.z); }
  /** Thrown or tumbled: whatever it was winding up is broken off, a hold let go. */
  calm() { if (this.state === 'wind' || this.state === 'strike') this.state = 'chase'; this.k = 0; this.letGo = true; this.cover = null; }
  /** A shadow hound running: only a shadow, the blade passes through (an ember lights it solid). */
  get phased() { return !!this.def.phase && this.lit <= 0 && this.stunned <= 0 && this.dist > PHASE.near && (this.state === 'idle' || this.state === 'chase' || this.state === 'home'); }

  /** The attacks it may begin at d metres: not a combo's follow-up, d within each one's [min, max]. */
  attacksAt(d) { const D = this.def; return D.attacks.filter((a) => !a.chain && d >= (a.min ?? 0) && d <= (a.max ?? D.reach) + 1e-6); }
  /** One of them, by weight (the one it just used less likely). */
  chooseAttack(d) {
    const can = this.attacksAt(d);
    if (can.length < 2) return can[0] ?? null;
    const w = can.map((a) => (a.weight ?? 1) * (a.id === this.lastAtk ? 0.4 : 1));
    let x = this.rng() * w.reduce((s, v) => s + v, 0);
    for (let i = 0; i < can.length; i++) if ((x -= w[i]) <= 0) return can[i];
    return can.at(-1);
  }
  /** Begin winding up attack a at the traveller: its direction and area lock here (or follow you a while: track). */
  beginWind(a, P) {
    if (a.chain) this.heading = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);   // (a follow-up turns to where you are now)
    this.state = 'wind'; this.timer = 0; this.k = 0; this.atk = a; this.lastAtk = a.id; this.contacted = false;
    this.cover = null; this.hid = false;   // (it may hide again after this strike)
    this.attackH = this.heading;
    if (this.buried && !a.surface) this.surfaced();   // (a ray comes up out of the sand to glide)
    if (this.def.keep) this.retreat = PRESSURE.retreat;   // (it struck: it may back off again after)
    this.placeArea(a, P);
  }
  /** Where attack a lands: a ring ahead (a lunge), round it, under you (lobbed), past you (a step through the shadow). */
  placeArea(a, P) {
    const fx = Math.sin(this.attackH), fz = Math.cos(this.attackH);
    if (a.at === 'target') this.attackAt.set(P.pos.x, P.pos.y, P.pos.z);   // (at your feet: on a slope, not at its own height)
    else if (a.at === 'behind') {
      const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1;
      this.attackAt.set(P.pos.x + (dx / d) * 1.8, P.pos.y, P.pos.z + (dz / d) * 1.8);
    } else if (a.shape === 'ring' && a.at !== 'self') this.attackAt.set(this.pos.x + fx * (a.ahead ?? 0), this.pos.y, this.pos.z + fz * (a.ahead ?? 0));
    else this.attackAt.copy(this.pos);
    // a volley: its rings in a row across the line to you
    this.attackPts = a.spread ? a.spread.map((o) => new THREE.Vector3(this.attackAt.x + fz * o, this.attackAt.y, this.attackAt.z - fx * o)) : null;
  }
  /** Up out of the sand (a dune ray): it stays up a while, to be fought. */
  surfaced() { this.buried = false; this.upFor = BURROW.up; }
  /** Done with attack a: its follow-up straight away (a combo), else recover. */
  next(a, P, ev) {
    const n = a.then ? attackOf(this.kind, a.then) : null;
    if (n && !P.dead && !P.down) { this.beginWind(n, P); ev.push('warn'); return; }
    this.state = 'recover'; this.timer = a.recover ?? this.def.recover; this.k = 0; this.reel = null;
  }
  /** An instant attack lands as its wind-up ends: a lob, a flash, a ray bursting up, a hound stepping out of the shadow. */
  resolve(a, P, playerOk, ev, env) {
    if (a.blink || a.surface) {
      const y = env.ground ? env.ground(this.attackAt.x, this.attackAt.y + 1.2, this.attackAt.z) : this.attackAt.y;
      if (y != null) this.pos.set(this.attackAt.x, y, this.attackAt.z);
      if (a.surface) this.surfaced();
      this.heading = this.attackH = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    }
    if (a.damage > 0) {
      const pts = this.attackPts ?? [this.attackAt];
      const seen = a.at === 'self' ? env.seen?.(this.chest, P.pos) ?? true : true;   // (a flash needs a clear line; a lob goes over)
      const hit = playerOk && seen && pts.some((p) => Math.abs(P.pos.y - (a.at === 'self' ? this.level : p.y)) < STRIKE_RISE && inArea(a, p, this.attackH, P.pos));
      ev.push({ type: 'strike', hit, atk: a });
    }
    this.next(a, P, ev);
  }
  /** Where its strike's area is centred when it lands: a lunge carries it with the body, else where the wind-up began. */
  attackOrigin() { return (this.atk ?? this.def.attack).lunge ? this.pos : this.attackAt; }
  /**
   * Its strike's phase (the hitbox overlay): 'telegraph' while it winds up, 'active' through the strike until the hit
   * is checked, 'spent' after; null otherwise. A lobbed strike (at: 'target') is checked as its wind-up ends.
   */
  get attackPhase() {
    if (this.state === 'wind') return 'telegraph';
    if (this.state === 'strike') return this.contacted ? 'spent' : 'active';
    return null;
  }

  update(dt, P, env = {}) {
    const D = this.def, ev = [];
    if (!this.alive) return ev;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.recoil = Math.max(0, this.recoil - dt * (this.heavyRecoil ? 2.5 : 5));
    this.cool = Math.max(0, this.cool - dt);
    if (!this.buried && this.upFor > 0) this.upFor = Math.max(0, this.upFor - dt);
    for (const k of ['flipped', 'lit', 'crust', 'sleep', 'low']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    // the world's hazards and workings it is in (v0.98: knocked into spines, a gust, an updraft, a pendulum)
    this.feelWorld(dt, env, ev);
    // a shove's slide eases out (a shove may carry it off a ledge, or into a hazard: step's `shoved`)
    if (this.vel.lengthSq() > 1e-4) {
      this.step(this.vel.x * dt, this.vel.z * dt, env, this.vel.lengthSq() > 1);
      this.vel.multiplyScalar(Math.exp(-(this.air ? 1 : 6) * dt));
    }
    // knocked off a ledge, thrown up: it falls, and its mind waits until it lands
    if (this.air) { this.fall(dt, env, ev); return ev; }
    // a flyer keeps to its height, low only while it recovers from a dive (and falls when stilled)
    // (knocked low by a cut, it drops fast and stays within the blade's reach a while)
    if (D.hover) {
      this.alt += ((this.stunned > 0 ? 0.3 : this.low > 0 || this.state === 'recover' ? 0.35 : D.hover) - this.alt) * (1 - Math.exp(-(this.low > 0 ? 6 : this.state === 'recover' ? 1.2 : 3) * dt));
      this.fly(dt, P, env, ev);
      if (!this.alive) return ev;
    }
    if (this.stunned > 0) { this.stunned -= dt; return ev; }
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    this.dist = d;
    const away = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    // lost: gone where it can't follow (riding, far above or below its level, fallen); down: knocked over, about to rise
    const lost = P.dead || !!P.ride || Math.abs(P.pos.y - this.level) >= 6, down = !lost && !!P.down;
    const playerOk = !lost && !down;
    // led too far from home: only once you have left as well (you still fighting it there, it stays)
    const youLeft = Math.hypot(P.pos.x - this.home.x, P.pos.z - this.home.z) > D.giveUp + PRESSURE.leave;
    switch (this.state) {
      case 'idle': {
        this.wander += dt * 0.4;
        const tx = this.home.x + Math.sin(this.wander) * 2.5, tz = this.home.z + Math.cos(this.wander * 0.7) * 2.5;
        this.walkTo(tx, tz, D.speed * 0.3, dt, env);
        if (playerOk && d < D.sight && (env.seen?.(this.chest, P.pos) ?? true)) { this.state = 'chase'; ev.push('notice'); }
        break;
      }
      case 'chase': {
        if (lost || (away > D.giveUp && youLeft) || d > D.sight * 2) { this.state = 'home'; ev.push('home'); break; }
        this.face(dx, dz, dt, 8);
        if (down) { this.circle(P, D.reach + PRESSURE.hold, dt, env); break; }   // (you are down: it waits round you, facing you, for you to rise)
        if (D.hover && this.hide(dt, P, d, env)) break;   // (between strikes, a hovering foe hides behind the world: COVER)
        if (D.keep && d < D.keep && this.retreat > 0) {
          // too close: it backs off a little, then stands its ground (PRESSURE.retreat), no endless chase
          this.retreat = Math.max(0, this.retreat - dt);
          this.step(-dx / d * D.speed * 0.7 * dt, -dz / d * D.speed * 0.7 * dt, env); this.face(dx, dz, dt, 8);
        }
        else if (d > D.reach) this.walkTo(P.pos.x, P.pos.z, D.speed, dt, env, D.reach * 0.8);
        else if (this.cool === 0 && !(env.mayStrike?.(this) ?? true)) {
          // another is striking: circle round at a step's distance, waiting a turn
          this.circle(P, D.reach + 1.4, dt, env);
        } else if (this.cool === 0) {
          // one of its attacks that fits the distance (none: it closes in)
          const a = this.chooseAttack(d);
          if (a) { this.beginWind(a, P); ev.push('warn'); }
          else this.walkTo(P.pos.x, P.pos.z, D.speed, dt, env, D.radius + 0.6);
        }
        break;
      }
      case 'wind': {
        const a = this.atk ?? D.attack;
        const wind = a.wind * (env.slow?.() ?? 1);
        this.timer += dt; this.k = Math.min(1, this.timer / wind);
        if (a.track && this.k < a.track && playerOk) this.placeArea(a, P);   // (the drawn area follows you, then holds)
        if (this.timer >= wind) {
          if (a.instant || a.at === 'target') this.resolve(a, P, playerOk, ev, env);
          else { this.state = 'strike'; this.timer = 0; this.k = 0; this.contacted = false; }
        }
        break;
      }
      case 'strike': {
        const a = this.atk ?? D.attack, before = this.k;
        this.timer += dt; this.k = Math.min(1, this.timer / (a.strike ?? 0.24));
        // Travel through the lunge over time; step() checks footing and walls.
        if (a.lunge || a.dive) {
          const ease = (x) => 1 - (1 - x) ** 2;
          const d = (a.lunge ?? a.range) * (ease(this.k) - ease(before));
          this.step(Math.sin(this.attackH) * d, Math.cos(this.attackH) * d, env);
        }
        if (a.dive) this.alt = THREE.MathUtils.lerp(D.hover, 0.35, this.k);
        if (a.sweep) {
          // a charge: whatever it runs into on the way is hit, once
          const near = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z) < sweepRadius(a, D);
          if (!this.contacted && this.k >= (a.contact ?? 0) && playerOk && near && Math.abs(P.pos.y - this.level) < STRIKE_RISE) { this.contacted = true; ev.push({ type: 'strike', hit: true, atk: a }); }
        } else if (!this.contacted && this.k >= (a.contact ?? 0.55)) {
          this.contacted = true;
          const hit = playerOk && Math.abs(P.pos.y - this.level) < STRIKE_RISE && inArea(a, this.attackOrigin(), this.attackH, P.pos)
            && (env.seen?.(this.chest, P.pos) ?? true);
          ev.push({ type: 'strike', hit, atk: a });
        }
        if (this.k >= 1 && this.state === 'strike') {
          if (a.sweep && !this.contacted) ev.push({ type: 'strike', hit: false, atk: a });
          this.next(a, P, ev);
        }
        break;
      }
      case 'recover': {
        this.timer -= dt;
        // (a ray dives again only once its time up is over: surfaced, it is there to be fought)
        if (this.timer <= 0) { this.state = 'chase'; this.cool = D.cool[0] + this.rng() * (D.cool[1] - D.cool[0]); if (D.burrow && this.upFor <= 0) this.buried = true; }
        break;
      }
      case 'home': {
        this.walkTo(this.home.x, this.home.z, D.speed * 0.8, dt, env, 0.5);
        this.hp = Math.min(D.hp, this.hp + dt * 0.5);
        if (away < 1) this.state = 'idle';
        else if (playerOk && d < D.sight * 0.6 && away < D.giveUp * 0.8) this.state = 'chase';
        break;
      }
    }
    return ev;
  }

  /** Round you at r m, a slow step to one side, facing you: waiting a turn, or for you to get up. */
  circle(P, r, dt, env) {
    const a = Math.atan2(this.pos.x - P.pos.x, this.pos.z - P.pos.z) + dt * 0.6 * (this.side ??= this.rng() < 0.5 ? -1 : 1);
    this.walkTo(P.pos.x + Math.sin(a) * r, P.pos.z + Math.cos(a) * r, this.def.speed * 0.5, dt, env);
    this.face(P.pos.x - this.pos.x, P.pos.z - this.pos.z, dt, 8);
  }

  /** Its strike was blocked: it reels back, open a moment longer than after a strike. */
  staggered(perfect = false) {
    if (!this.alive) return;
    this.state = 'recover'; this.timer = this.def.recover * (perfect ? 1.8 : 0.65); this.k = 0; this.flash = 0.8; this.reel = perfect ? 'parried' : 'blocked';   // (reel: why it recovers, for the hitbox overlay's label)
    this.recoil = 1; this.heavyRecoil = perfect; this.recoilDir.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.vel.set(-Math.sin(this.heading), 0, -Math.cos(this.heading)).multiplyScalar(this.def.heavy ? 2 : 5);
  }

  /** A blow travelling against its face (dir: the blow's way): what a shell turns. */
  frontal(dir) { return dir.x * Math.sin(this.heading) + dir.z * Math.cos(this.heading) < -0.3; }

  face(dx, dz, dt, rate = 6) {
    const want = Math.atan2(dx, dz), da = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += da * (1 - Math.exp(-rate * dt));
  }

  walkTo(x, z, speed, dt, env, stopAt = 0) {
    const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz);
    if (d <= stopAt + 1e-3) return;
    this.face(dx, dz, dt);
    const s = Math.min(speed * dt, d - stopAt);
    this.step(dx / d * s, dz / d * s, env);
  }

  /**
   * Move by (mx, mz) where there is footing no more than a step up (else stay: a wall, a drop). Never on its own
   * into a hazard or an updraft (`shoved`: a push, a gust, a blow carries it anywhere, and off a ledge: it falls).
   * A hovering foe flies on over a drop, holding its altitude (Foe.over), up to HOVER.max over the ground.
   */
  step(mx, mz, env, shoved = false) {
    const D = this.def, nx = this.pos.x + mx, nz = this.pos.z + mz;
    const from = D.hover || this.air ? this.bodyAt(_fb).setY(_fb.y - 0.5) : this.pos;   // (a flyer's way is clear at its own height)
    if (env.canStep && !env.canStep(from, nx, nz, D.radius)) return false;
    if (this.air) { this.pos.x = nx; this.pos.z = nz; return true; }   // (in the air: only walls stop it)
    if (D.hover) {
      const top = this.level;
      const y = env.ground ? env.ground(nx, top + 1.2, nz, HOVER.max + 3.2) : this.pos.y;
      if (y == null || y - top > 1.1 || (!shoved && top - y > HOVER.max + 1)) return false;
      if (!shoved && this.refuses(nx, Math.max(y, top), nz, env)) return false;
      this.over = Math.max(0, top - y);
      this.pos.set(nx, y, nz);
      return true;
    }
    const y = env.ground ? env.ground(nx, this.pos.y + 1.2, nz) : this.pos.y;
    if (shoved && (y == null || this.pos.y - y > FALL.edge)) {
      // knocked off the edge: over it goes, and falls (fall())
      this.pos.x = nx; this.pos.z = nz;
      this.air = { vy: 0, top: this.pos.y, base: y ?? this.pos.y, hard: false };
      this.calm();
      return true;
    }
    if (y == null || y - this.pos.y > 1.1 || this.pos.y - y > 3) return false;
    if (!shoved && this.refuses(nx, y, nz, env)) return false;
    this.pos.set(nx, y, nz);
    return true;
  }

  /** Would a step to (x, y, z) (its level there) take it into a hazard or an updraft it isn't in yet? */
  refuses(x, y, z, env) {
    if (!env.hazard && !env.workings) return false;
    const to = _pb.set(x, y + (this.def.hover ? this.alt : 0), z), here = this.bodyAt(_fb);
    if (env.hazard?.(to) && !env.hazard(here)) return true;
    if (env.workings && env.workings(to, 'updraft').length && !env.workings(here, 'updraft').length) return true;
    return false;
  }

  /**
   * The world on it (v0.98): a hazard it was knocked into cuts it and throws it back out ('hazard'); an updraft
   * throws a walker up ('thrown': it lands hard) or tumbles a hovering foe up out of control ('tumbled'); a
   * blowing gust shoves it (unless sheltered); a swinging pendulum knocks it away ('swung': a cut and a stun).
   */
  feelWorld(dt, env, ev) {
    if (this.buried || (!env.hazard && !env.workings)) return;
    const D = this.def, at = this.bodyAt(_cf);
    this.hazCool = Math.max(0, this.hazCool - dt);
    for (const k in this.workCool) this.workCool[k] = Math.max(0, this.workCool[k] - dt);
    const h = this.hazCool === 0 ? env.hazard?.(at) : null;
    if (h) {
      this.hazCool = WORLD_HARM.every;
      const out = h.push?.(at, _hz) ?? (h.x != null ? _hz.set(at.x - h.x, 0, at.z - h.z) : _hz.set(-this.vel.x, 0, -this.vel.z));
      out.setY(0);
      if (out.lengthSq() < 1e-6) out.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
      out.normalize();
      this.vel.copy(out).multiplyScalar(WORLD_HARM.shove * (D.heavy ? 0.6 : 1));
      ev.push({ type: 'hazard', kind: h.kind, dir: out.clone() });
    }
    if (!env.workings) return;
    for (const w of env.workings(at).slice()) {
      if (w.kind === 'updraft' && this.workCool.updraft === 0) {
        const U = WORKS.updraft;
        this.workCool.updraft = U.cool;
        this.calm();
        if (D.hover) {
          // tumbled up out of control, then it drops, stunned
          this.tumble = U.tumble; this.tumbleTop = w.top ?? this.level + 6;
          this.stunned = Math.max(this.stunned, U.tumble + U.stun);
          ev.push({ type: 'tumbled' });
        } else {
          // thrown up, out of the column a little, to land hard
          const foot = w.foot ?? this.pos, ox = this.pos.x - foot.x, oz = this.pos.z - foot.z, o = Math.hypot(ox, oz) || 1;
          this.vel.set(ox / o, 0, oz / o).multiplyScalar(U.out);
          this.air = { vy: U.throw * Math.min(1.4, Math.max(0.6, (w.lift ?? 7) / 7)), top: this.pos.y, base: this.pos.y, hard: true };
          ev.push({ type: 'thrown' });
        }
      } else if (w.kind === 'gust' && (w.blowing?.() ?? true) && !w.sheltered?.(at)) {
        const G = WORKS.gust, k = this.stunned > 0 ? G.still : D.heavy ? G.heavy : D.light ? G.light : D.hover ? G.hover : 1;
        this.vel.set(w.dir.x, 0, w.dir.z).multiplyScalar((w.push ?? 7.5) * k);
      } else if (w.kind === 'swing' && (w.moving?.() ?? true) && this.workCool.swing === 0) {
        const S = WORKS.swing;
        this.workCool.swing = S.cool;
        const dir = (w.push ? w.push(at, _hz) : _hz.subVectors(at, w.center)).setY(0);
        if (dir.lengthSq() < 1e-6) dir.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
        dir.normalize();
        this.calm();
        this.vel.copy(dir).multiplyScalar(S.knock * (D.heavy ? S.heavy : 1));
        if (!D.hover) this.air = { vy: S.up, top: this.pos.y, base: this.pos.y, hard: false };
        this.stunned = Math.max(this.stunned, S.stun);
        ev.push({ type: 'swung', dir: dir.clone() });
      }
    }
  }

  /** In the air (knocked off a ledge, thrown up): it falls; landed, a long fall is a hard one ('landed'); too far, gone ('fell'). */
  fall(dt, env, ev) {
    const A = this.air;
    A.vy -= FALL.gravity * dt;
    const ny = this.pos.y + A.vy * dt;
    if (A.vy <= 0) {
      const g = env.ground ? env.ground(this.pos.x, this.pos.y + 0.6, this.pos.z, this.pos.y - ny + 1.2) : A.base;
      if (g != null && ny <= g + 1e-6 && g <= this.pos.y + 0.6) {
        this.pos.y = g; this.air = null;
        this.vel.multiplyScalar(0.3);
        const h = A.top - g;
        if (A.hard || h > FALL.hard) { this.stunned = Math.max(this.stunned, FALL.stun); this.flash = 1; ev.push({ type: 'landed', h, hard: true }); }
        else ev.push({ type: 'landed', h, hard: false });
        return;
      }
    }
    this.pos.y = ny; A.top = Math.max(A.top, ny);
    if (A.top - ny > FALL.lost || ny < (env.killY?.() ?? -Infinity) || env.pit?.(this.pos)) this.gone(ev);
  }
  /** Fallen out of the world (a pit, below its floor): gone. */
  gone(ev) { this.air = null; this.hp = 0; this.state = 'dead'; this.k = 0; ev.push({ type: 'fell' }); }

  /**
   * A hovering foe's height over its footing (HOVER): over the higher of its footing and the traveller (where you
   * last stood), a little higher while it has nowhere to hide (COVER.climb); tumbling up an updraft; stilled, it
   * drops, and a long drop lands hard (or into a pit: gone).
   */
  fly(dt, P, env, ev) {
    if (this.tumble > 0) {
      this.tumble = Math.max(0, this.tumble - dt);
      this.over = Math.min(this.over + WORKS.updraft.throw * 0.7 * dt, Math.max(this.over, this.tumbleTop - this.pos.y), HOVER.max + 6);
      this.heading += dt * 9; this.overV = 0; this.fallTop = this.level;
      return;
    }
    if (this.stunned > 0) {
      // stilled (or stunned): it drops out of the air to its footing
      if (this.over > 0) {
        this.fallTop = Math.max(this.fallTop ?? this.level, this.level);
        this.overV -= FALL.gravity * dt;
        this.over = Math.max(0, this.over + this.overV * dt);
        if (this.over === 0) {
          const h = this.fallTop - this.pos.y;
          this.overV = 0; this.fallTop = null;
          if (h > FALL.hard && this.alt < 1) { this.stunned = Math.max(this.stunned, FALL.stun); this.flash = 1; ev.push({ type: 'landed', h, hard: true }); }
        } else if (env.pit?.(this.bodyAt(_cf))) this.gone(ev);
      }
      return;
    }
    this.overV = 0; this.fallTop = null;
    if (P && (P.onGround !== false || this.youY == null)) this.youY = P.pos.y;   // (where you stand: not every jump)
    const fighting = P && !P.dead && !P.ride && this.state !== 'idle' && this.state !== 'home';
    let want = fighting ? Math.max(0, (this.youY ?? P.pos.y) - this.pos.y) : 0;
    if (this.cover?.climb) want += COVER.climb;
    want = Math.min(want, HOVER.max);
    const dv = want - this.over;
    this.over += Math.sign(dv) * Math.min(Math.abs(dv), (dv > 0 ? HOVER.climb : HOVER.sink) * dt);
  }

  /**
   * Between strikes, a hovering foe hides (COVER): to a spot near it the traveller can't see, or higher when there
   * is none; out again after a while (COVER.hold, Gentle shorter), once there and waited, cut low or found.
   * Returns true while it is moving to (or waiting in) its hiding place (the chase's own steps wait).
   */
  hide(dt, P, d, env) {
    let C = this.cover;
    if (!C) {
      if (this.hid || this.low > 0 || this.cool < COVER.minCool || !env.seen || d < COVER.close) return false;
      this.hid = true;
      const at = this.coverSpot(P, env);
      C = this.cover = at ? { at, t: 0, stay: 0 } : { climb: true, t: 0, stay: 0 };
    }
    C.t += dt;
    const cap = env.gentle?.() ? COVER.gentle : COVER.hold;
    let done = this.low > 0 || C.t >= cap || C.stay >= COVER.stay;
    if (!done && C.at && Math.hypot(this.pos.x - C.at.x, this.pos.z - C.at.z) < 0.6) {
      C.stay += dt;
      this.face(P.pos.x - this.pos.x, P.pos.z - this.pos.z, dt, 6);
      if (env.seen(_cs.set(C.at.x, this.chest.y, C.at.z), P.pos)) done = true;   // (you came round it: found)
    }
    if (done) { this.cover = null; this.cool = Math.min(this.cool, COVER.out); return false; }
    this.cool = Math.max(this.cool, 0.2);   // (it never strikes from hiding: out first)
    if (C.climb) return false;
    if (C.stay === 0) this.walkTo(C.at.x, C.at.z, this.def.speed, dt, env, 0.3);
    return true;
  }

  /** A spot COVER.near–far m round it, at its height, that it can fly to straight and the traveller can't see; the nearest to you of them (not right on you), or null. */
  coverSpot(P, env) {
    const C = COVER, y = this.chest.y, from = this.chest.clone();
    let best = null, bd = Infinity;
    for (let i = 0; i < C.dirs; i++) for (const r of [C.near, C.far]) {
      const a = this.heading + (i / C.dirs) * Math.PI * 2, x = this.pos.x + Math.sin(a) * r, z = this.pos.z + Math.cos(a) * r;
      const dp = Math.hypot(x - P.pos.x, z - P.pos.z);
      if (dp < C.close || dp >= bd) continue;
      const g = env.ground ? env.ground(x, y + 0.5, z, HOVER.max + 3) : this.pos.y;
      if (g == null || g > y - 0.6 || y - g > HOVER.max + 3) continue;   // (in the rock, or over nothing)
      const spot = _cs.set(x, y, z);
      if (env.seen(spot, P.pos)) continue;   // (you would see it there)
      if (!env.seen(from, _pb.set(x, y - 1, z))) continue;   // (it can't fly there straight)
      best = new THREE.Vector3(x, y, z); bd = dp;
    }
    return best;
  }

  /**
   * What touched it (the fluid tool's modes): the blade cuts (info.damage); a fluid or ember glob
   * washes a blot (1) and only staggers a machine; stilling holds it; the push shoves it. Returns
   * 'burst' when that was the last of it, true when it felt it.
   */
  hit(mode, dir, info = {}) {
    if (!this.alive) return false;
    this.shrugged = false;
    const D = this.def, src = info.source;
    if (this.buried) {
      // under the sand a blast, a stomp or a gust throws a ray up, dazed; a cut at its fin flushes it out
      // (a shorter daze, no harm: the sand takes the blow); nothing else reaches it
      const flush = mode === 'blade' && src !== 'bomb' && src !== 'stomp' && src !== 'gust';
      if (!flush && src !== 'bomb' && src !== 'stomp' && src !== 'gust') return false;
      this.surfaced(); this.stunned = flush ? BURROW.flush : 1.6; this.flash = 1; this.k = 0; this.letGo = true;
      if (dir) this.recoilDir.copy(dir).setY(0).normalize(), this.recoil = 1;
      if (this.state === 'wind' || this.state === 'strike') this.state = 'chase';
      return flush ? 'flushed' : true;
    }
    if (this.phased && mode !== 'fire' && mode !== 'world') return false;   // (a hound running is only a shadow: the blade passes through)
    if (src === 'bomb' && this.shelled) { this.shelled = false; this.flash = 1; }   // (a bomb cracks a crab's shell for good)
    let dmg = 0;
    if (mode === 'blade') {
      if (this.shelled && !(this.flipped > 0) && dir && this.frontal(dir)) {
        // the shell turns the blade from the front: a glance, no harm
        this.flash = 0.5; this.recoil = 0.5; this.heavyRecoil = false; this.recoilDir.copy(dir).setY(0).normalize();
        return 'glance';
      }
      // (stilled, it shatters: double; seen through the lens, its weak point too: src/gadgets/lens.js; a doused slag walker's crust)
      dmg = (info.damage ?? 1) * (this.stunned > 0 || this.exposed > 0 || this.crust > 0 ? 2 : 1) * (D.weak?.[src] ?? 1);
      this.stunned = 0; this.sleep = 0;
    } else if (mode === 'shoot' || mode === 'fire') {
      dmg = D.takes[mode] ?? 0;
      if (mode === 'shoot' && D.douse) this.crust = D.douse;   // (water on slag: a cold crust)
      if (mode === 'fire' && D.phase) this.lit = 3;            // (an ember lights a hound solid)
    } else if (mode === 'push') dmg = D.takes.push ?? 0;       // (the push, a gust: a swarm, a moth, a splinter is blown apart)
    else if (mode === 'world') {
      // the world's harm (v0.98): spines, fire, a hard landing, a pendulum: info.damage, and a stun held a while
      dmg = (info.damage ?? 1) * (D.weak?.[src] ?? 1);
      if (info.stun) { this.stunned = Math.max(this.stunned, info.stun); this.k = 0; if (this.state === 'wind' || this.state === 'strike') this.state = 'chase'; }
    }
    else if (mode === 'stun') { this.stunned = STILL; this.state = ['wind', 'strike'].includes(this.state) ? 'chase' : this.state; this.k = 0; this.flash = 0.6; this.letGo = true; return true; }
    else if (mode === 'bloom') {
      if (D.takes.bloom === 'hold') { this.stunned = this.sleep = 3; this.state = ['wind', 'strike'].includes(this.state) ? 'chase' : this.state; this.k = 0; this.flash = 0.6; this.letGo = true; return true; }   // (roots asleep in flower)
      dmg = D.takes.shoot ?? 0;
    }
    if (mode === 'push' && dir) { this.vel.set(dir.x, 0, dir.z).multiplyScalar((info.shove ?? 2.4) * (D.heavy ? 1.2 : 3)); }
    if (dir && mode !== 'push' && mode !== 'world') this.vel.set(dir.x, 0, dir.z).multiplyScalar((D.heavy ? 1.5 : 4) * (info.combo === 2 ? 2.2 : 1));   // (the heavy third swing throws them)
    this.flash = 1;
    this.recoil = 1; this.heavyRecoil = (info.damage ?? 1) >= 2;
    if (dir) this.recoilDir.copy(dir).setY(0).normalize();
    if (mode === 'blade' || mode === 'fire' || mode === 'world') this.letGo = true;   // (a hold, a line, is broken)
    // Light cuts interrupt a blot (the flinchy ones), or the first two thirds of anyone's wind-up.
    const reels = (mode === 'world' && !info.stun) || (D.flinchy && mode === 'blade') || (this.state === 'wind' && this.k < 0.66) || (this.heavyRecoil && this.state !== 'strike');
    // a cut that doesn't stop it: a heavy foe, or one committed to its blow (late in its wind-up, striking); Foes.hurt answers with its armour's thunk
    this.shrugged = mode === 'blade' && !reels && (!!D.heavy || this.state === 'wind' || this.state === 'strike');
    if (mode === 'blade' && D.hover) this.low = KNOCKED_LOW;   // (cut, a hovering foe drops within reach)
    if (reels) { this.state = 'recover'; this.timer = this.heavyRecoil ? D.hit * 2 : D.hit; this.k = 0; this.reel = this.heavyRecoil ? 'staggered' : 'flinched'; }
    else if (this.state === 'idle' || this.state === 'home') this.state = 'chase';
    this.hp -= dmg;
    if (this.hp <= 0) { this.state = 'dead'; this.k = 0; return 'burst'; }
    return true;
  }
}

/** A wave said in words: "3 ink blots", "2 machines and 2 ink blots". */
export function waveWords(kinds) {
  const count = (k) => kinds.filter((x) => x === k).length, say = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
  const parts = [['machine', 'machine'], ['shade', 'shade'], ['spitter', 'spitting blot'], ['flyer', 'winged blot'],
    ...Object.keys(KINDS).map((k) => [k, FOES[k].name, FOES[k].plural]), ['blot', 'ink blot']].map(([k, w, many]) => count(k) && say(count(k), w, many));
  if (count('swarm')) parts.push('a swarm');
  const list = parts.filter(Boolean);
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0] ?? '';
}

/** Far enough from people and the ship for the wilds: p { x, z }; people: [{ x, z }]. */
export function inWilds(p, { people = [], spawn = null } = {}) {
  if (spawn && Math.hypot(p.x - spawn.x, p.z - spawn.z) < WILD.spawn) return false;
  for (const q of people) if (Math.hypot(p.x - q.x, p.z - q.z) < WILD.people) return false;
  return true;
}

// ------------------------------------------------------------------ how they look
const INK = '#1e1a26';
function blotModel(kind = 'blot') {
  const g = new THREE.Group();
  const ink = makeMaterial({ color: INK, flat: true, key: 'foe-ink' });
  const eye = makeMaterial({ color: '#f4efe0', flat: true, glow: 0.6, key: 'foe-eye' });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), ink);
  body.position.y = 0.55; g.add(body);
  // the scribble: drips and spikes of ink off the body, never the same twice
  const parts = [body];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5, len = 0.35 + Math.random() * 0.45;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.09 + Math.random() * 0.06, len, 5), ink);
    c.position.set(Math.sin(a) * 0.45, 0.35 + Math.random() * 0.45, Math.cos(a) * 0.45);
    c.lookAt(c.position.x * 3, c.position.y - 0.6 + Math.random(), c.position.z * 3); c.rotateX(Math.PI / 2);
    g.add(c); parts.push(c);
  }
  const eyes = [-1, 1].map((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), eye); e.position.set(s * 0.17, 0.7, 0.46); g.add(e); return e; });
  const M = { group: g, body, parts, eyes, eyeMat: eye, base: '#f4efe0', size: 1 };
  if (kind === 'spitter') {
    // a snout to lob from, and sickly yellow-green eyes
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 0.45, 8).rotateX(Math.PI / 2), ink);
    snout.position.set(0, 0.5, 0.55); g.add(snout);
    M.eyeMat = makeMaterial({ color: '#d9f05a', flat: true, glow: 0.6, key: 'foe-eye-spit' }); M.base = '#d9f05a';
    for (const e of eyes) e.material = M.eyeMat;
    M.glob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), ink); M.glob.visible = false;
  }
  if (kind === 'flyer') {
    // wings of ink, flapping
    M.wings = [-1, 1].map((s) => { const w = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 4).rotateZ(s * Math.PI / 2).scale(1, 1, 0.25), ink); w.position.set(s * 0.75, 0.6, -0.05); g.add(w); return w; });
  }
  if (kind === 'swarm') M.size = 0.45;
  g.scale.setScalar(M.size);
  return M;
}

function machineModel() {
  // a makers' construct gone wrong: a round brass shell on three spindly legs, two arms with claws, the
  // makers' glyph (three dots over an arc) glowing on its face, plates riveted round its belly
  const g = new THREE.Group();
  const brass = makeMaterial({ color: '#b08a4a', metal: 'brass', key: 'foe-brass' });
  const dark = makeMaterial({ color: '#3a3330', flat: true, key: 'foe-dark' });
  const plate = makeMaterial({ color: '#8f6f3e', metal: 'copper', key: 'foe-plate' });
  const core = makeMaterial({ color: '#70e7df', flat: true, glow: 0.9, key: 'foe-core' });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12).scale(1, 0.85, 0.95), brass); body.position.y = 1.35; g.add(body);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 6, 24).rotateX(Math.PI / 2), plate); belt.position.y = 1.22; g.add(belt);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), dark); cap.position.y = 1.82; g.add(cap);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), dark); mast.position.y = 2.1; g.add(mast);
  // the glyph for an eye: three dots over an upturned arc
  const heart = new THREE.Group(); heart.position.set(0, 1.42, 0.55); g.add(heart);
  heart.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 4, 16, Math.PI).rotateZ(0), core));
  for (const x of [-0.12, 0, 0.12]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), core); d.position.set(x, 0.22, 0); heart.add(d); }
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group(); a.position.set(s * 0.66, 1.45, 0); g.add(a);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.75, 6).translate(0, -0.37, 0), dark); a.add(up);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22).translate(0, -0.85, 0.04), brass); a.add(claw);
    return a;
  });
  const legs = [0, 1, 2].map((k) => {
    const ang = (k / 3) * Math.PI * 2 + Math.PI / 6, l = new THREE.Group();
    l.position.set(Math.sin(ang) * 0.32, 0.95, Math.cos(ang) * 0.32); l.rotation.y = ang; g.add(l);
    l.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 1.0, 5).translate(0, -0.5, 0).rotateX(-0.28), dark));
    return l;
  });
  return { group: g, body, head: cap, arms, legs, heart, eyeMat: core, parts: [body, belt, cap, mast, heart, ...arms, ...legs] };
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
/** The world's sounds on a foe (the game's synth, src/audio.js burst / sweep): spines, a flame's hiss, a hard landing. */
const sndAt = (s) => (s?.ctx && s.burst && s.sweep ? s.ctx.currentTime : null);
const worldSnd = {
  spines(s) { const t = sndAt(s); if (t == null) return; s.burst(t, { dur: 0.05, type: 'highpass', freq: 2600, q: 1.2, vol: 0.12 }); s.burst(t + 0.04, { dur: 0.05, type: 'bandpass', freq: 1500, q: 2, vol: 0.1 }); },
  hiss(s) { const t = sndAt(s); if (t == null) return; s.burst(t, { dur: 0.35, type: 'highpass', freq: 3200, q: 0.7, vol: 0.1 }); s.sweep(t, 300, 140, 0.2, 0.04, 'sawtooth'); },
  thud(s, k = 1) { const t = sndAt(s); if (t == null) return; s.burst(t, { dur: 0.18, type: 'lowpass', freq: 400, q: 0.8, vol: 0.12 + 0.18 * k }); s.sweep(t, 120, 50, 0.2, 0.08 * k); },
};
let _waveGeo, _waveMat, _waveInk, _patchGeo, _patchMat, _rimGeo, _patchRim;   // (shared by every shockwave and slag patch)
/** The drops a foe bursts into as it falls. */
const BURST_TONES = {
  machine: ['#a8824a', '#70e7df', '#3a3330'], golem: ['#7fd6a8', '#d7f3d9', '#2d4a3e'], splinter: ['#7fd6a8', '#bfe8c4', '#2d4a3e'],
  ray: ['#c98d4f', '#e8c58f', '#2b211f'], moth: ['#ff5fa2', '#5ff0e8', '#241a2e'], drone: ['#8a4b2e', '#ffb347', '#2e2a28'],
  stalker: ['#e8e2d0', '#9fe8d8', '#3a332c'], crab: ['#efe9dc', '#9a4f34', '#f2d34b'], slag: ['#ff7a2e', '#ffd36a', '#3b2a26'],
};

/** Every foe in a world: the packs of ink blots in the wilds, the machines in the temple, their looks and their targets. */
export class Foes {
  constructor({ scene, level, levelId, content = null, physics, player, tool = null, sound = null, npcs = [], settings = null, notice = null, camera = null, lib = null, humans = null, game = sharedGame, rng = Math.random }) {
    Object.assign(this, { scene, level, levelId, physics, player, tool, sound, npcs, settings, notice, camera, lib, humans, game, rng });   // (lib, humans: a shade's body, src/shade.js)
    this.list = []; this.group = new THREE.Group(); this.group.name = 'Foes';
    this.group.userData.noCollide = true;
    scene?.add(this.group);
    this.peaceful = PEACEFUL.has(levelId) || !!level?.peaceful;   // (a minigame's arena: no foes, src/minigames/kit/world.js)
    this.packRest = 8; this.wildFor = 0; this.packs = 0; this.wave = 0; this.waveRest = WAVE.rest;
    this.people = (content?.npcs ?? []).filter((n) => n.at).map((n) => ({ x: n.at[0], z: n.at[1] }));
    this.env = {
      ground: (x, y, z, range = 6) => { const g = physics?.groundAt?.(x, y, z, range); return g == null || !Number.isFinite(g) ? null : g; },
      slow: () => (this.difficulty === 'gentle' ? GENTLE.wind : 1),
      gentle: () => this.difficulty === 'gentle',   // (a hovering foe hides for less long: COVER.gentle)
      // the world's hazards and workings (src/hazards.js, src/workings.js), where it ends and its pits
      hazard: (p) => hazardAt(p),
      workings: (p, kind = null) => workingsAt(p, kind, this._ws ??= []),
      killY: () => this.level?.killY ?? -Infinity,
      pit: (p) => { const rt = this.level?.temple; return !!rt && (!!rt.pits?.some((x) => x.contains(p)) || (!!rt.below?.(p) && !rt.inside?.(p))); },
      canStep: (from, x, z, radius) => {
        if (!physics?.rayDistance) return true;
        _w.set(x - from.x, 0, z - from.z);
        const d = _w.length(); if (d < 1e-6) return true;
        _w.divideScalar(d); _v.copy(from).y += 0.5;
        return physics.rayDistance(_v, _w, d + radius) >= d + radius;
      },
      // the turns (TURNS.strikers at once); one off the screen waits while any other is striking, so a blow
      // from behind never comes on top of one you can see (it still warns at the screen's edge)
      mayStrike: (f) => {
        const busy = this.list.filter((x) => x !== f && x.alive && ['wind', 'strike'].includes(x.state)).length;
        return busy < this.strikers && (busy === 0 || this.onScreen(f));
      },
      seen: (from, to) => !physics?.rayDistance || physics.rayDistance(from, _w.subVectors(_v.copy(to).setY(to.y + 1), from).normalize(), from.distanceTo(_v)) >= from.distanceTo(_v) - 0.5,
    };
    if (!this.peaceful) this.placeMachines();
    // the relics' guards: a relic out in the wilds (src/levels/content.js relics.spots), once per save
    this.guards = this.peaceful || level?.foes?.waves || level?.foes?.own ? [] : (content?.relics?.spots ?? []).map((s, i) => {
      const a = Array.isArray(s) ? s : s.at, x = a[0], z = a.length === 2 ? a[1] : a[2];
      const y = a.length === 2 ? level?.ground?.heightAt?.(x, z) ?? 0 : a[1];
      return { i, pos: new THREE.Vector3(x, y, z), id: `foes.${levelId}.r${i}` };
    });
  }

  /** Is f on the screen (in front of the camera, inside its edges)? No camera (tests): yes. */
  onScreen(f) {
    const cam = this.camera;
    if (!cam?.projectionMatrix) return true;
    const p = _v.copy(f.chest).project(cam);
    return p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.95;
  }

  /** A foe alive within r metres (the controller: LB blocks rather than zooms). */
  near(r = 20) { const P = this.player; return !!P && this.on && this.list.some((f) => f.alive && f.pos.distanceTo(P.pos) < r); }

  /**
   * R3 / Tab: lock on to the nearest foe in reach (those in front of the camera first), then the next
   * one out from the traveller, then let go. Returns the foe locked (or null).
   */
  cycleLock() {
    const P = this.player, cam = this.camera;
    const fwd = cam ? cam.getWorldDirection(new THREE.Vector3()) : null;
    // those ahead of the camera first, nearest the middle of the view and nearest you (a buried ray too: the
    // reticle follows its fin, dimmed: src/lock-reticle.js)
    const cands = this.list.filter((f) => f.alive && f.dead === undefined && f.pos.distanceTo(P.pos) < LOCK.reach)
      .map((f) => {
        const d = f.pos.distanceTo(P.pos), dot = fwd ? _v.subVectors(f.pos, P.pos).setY(0).normalize().dot(_w.copy(fwd).setY(0).normalize()) : 1;
        return { f, d, ahead: dot > 0.2, score: d * (1.6 - dot) };
      })
      .sort((a, b) => (b.ahead - a.ahead) || a.score - b.score);
    if (!cands.length) { this.lock = null; return null; }
    if (!this.lock) { this.lock = cands[0].f; this.sound?.fluidMode?.('stun'); this.reticle?.acquire(); return this.lock; }
    const i = cands.findIndex((c) => c.f === this.lock);
    this.lock = i >= 0 && i < cands.length - 1 ? cands[i + 1].f : i === -1 ? cands[0].f : null;
    if (this.lock) this.reticle?.acquire();
    return this.lock;
  }

  /** The locked foe as a target the blade turns to (fluid-blade.js lockTarget), or null. */
  lockTarget() {
    if (!this.lock) return null;
    const T = (this._lockT ??= { position: () => this.lock?.chest ?? T.last, enabled: () => true, lock: true });
    T.last = this.lock.chest; T.radius = hurtRadius(this.lock.def);
    return T;
  }

  /**
   * The lock holds while the foe stands and stays near. Cut down, the lock moves on to the next foe in reach
   * (nearest you first), so a fight flows on; walked away from, it lets go. The reticle over it (#foe-lock,
   * src/lock-reticle.js).
   */
  updateLock(dt = 0) {
    const f = this.lock, P = this.player;
    if (f && (!f.alive || f.dead !== undefined)) this.lock = this.nextLock(f);
    else if (f && f.pos.distanceTo(P.pos) > LOCK.lose) this.lock = null;
    if (typeof document === 'undefined' || !this.camera) return;
    (this.reticle ??= new LockReticle()).update(this.lock, this.camera, dt);
  }
  /**
   * The look's sideways motion while locked (main.js wraps rig.look): px as the stick, the mouse or a drag gave
   * them, `now` in s. Past FLICK.px of quick motion the lock jumps that way (switchLock). Returns true: locked, the
   * look's sideways part is the lock's (the camera keeps the foe ahead).
   */
  flickLook(dx, now = performance.now() / 1000) {
    if (!this.lock) { this._flick = 0; return false; }
    const dt = Math.min(0.25, Math.max(0, now - (this._flickAt ?? now)));
    this._flickAt = now;
    this._flick = (this._flick ?? 0) * Math.exp(-FLICK.decay * dt) + dx;
    if (now < (this._flickRest ?? 0)) { this._flick = 0; return true; }
    if (Math.abs(this._flick) >= FLICK.px) {
      this.switchLock(Math.sign(this._flick));
      this._flick = 0; this._flickRest = now + FLICK.rest;
    }
    return true;
  }
  /**
   * The lock to the nearest foe on `side` (+1 right, −1 left) of the locked one, as seen on the screen (no camera:
   * round the traveller); none that way, it stays. Returns the foe locked.
   */
  switchLock(side) {
    const P = this.player, cur = this.lock, cam = this.camera;
    if (!cur) return null;
    const at = (f) => {
      if (cam?.projectionMatrix) { const p = _v.copy(f.chest).project(cam); return p.z < 1 ? { x: p.x, y: p.y } : null; }
      // (round the traveller: the bearing from the locked one's, right positive)
      const a0 = Math.atan2(cur.pos.x - P.pos.x, cur.pos.z - P.pos.z), a = Math.atan2(f.pos.x - P.pos.x, f.pos.z - P.pos.z);
      return { x: -Math.atan2(Math.sin(a - a0), Math.cos(a - a0)), y: 0 };
    };
    const c = at(cur) ?? { x: 0, y: 0 };
    let best = null, bd = Infinity;
    for (const f of this.list) {
      if (f === cur || !f.alive || f.dead !== undefined || f.pos.distanceTo(P.pos) > LOCK.reach) continue;
      const p = at(f);
      if (!p || Math.sign(p.x - c.x) !== side) continue;
      const d = Math.abs(p.x - c.x) + Math.abs(p.y - c.y) * 0.5;
      if (d < bd) { bd = d; best = f; }
    }
    if (best) { this.lock = best; this.reticle?.acquire(); this.sound?.fluidMode?.('stun'); }
    return this.lock;
  }

  /** The next foe for the lock after `gone` fell: the nearest standing in reach, or null. */
  nextLock(gone) {
    const P = this.player;
    let best = null, bd = LOCK.reach;
    for (const x of this.list) {
      if (x === gone || !x.alive || x.dead !== undefined) continue;
      const d = x.pos.distanceTo(P.pos);
      if (d < bd) { bd = d; best = x; }
    }
    if (best) this.reticle?.acquire();
    return best;
  }

  /** How many may strike at once. */
  get strikers() { return this.difficulty === 'gentle' ? 1 : TURNS.strikers; }

  /** The Enemies setting: 'normal', 'gentle' (half the harm, slower wind-ups, one striking at a time, smaller and rarer packs) or 'off'. */
  /** The Gentle setting (the evade's i-frames are a little longer). */
  get gentle() { return this.difficulty === 'gentle'; }
  get difficulty() { const e = this.settings?.enemies; return e === false || e === 'off' ? 'off' : e === 'gentle' ? 'gentle' : 'normal'; }
  /** On (the Enemies setting, not a peaceful world; the Arena's waves and a game's own foes always). */
  get on() { return this.waves || (!this.peaceful && this.difficulty !== 'off'); }
  /** The foes come in waves round you: the Arena's (round its list), or a game's own (level.foes.own: it adds them itself, src/minigames/waves.js). */
  get waves() { return !!this.level?.foes?.waves || this.own; }
  get own() { return !!this.level?.foes?.own; }

  /** Where people are now (the spawned ones move about), and where they were placed. */
  peopleNow() {
    const out = this.people.slice();
    for (const n of this.npcs ?? []) { const o = n.object?.position; if (o) out.push({ x: o.x, z: o.z }); }
    return out;
  }

  wild(p) {
    const L = this.level;
    if (L?.foes?.wild === false) return false;   // (a world with no wilds: the Gadget Yard)
    if (L?.temple?.inside?.(p)) return false;
    if (L?.unsafe?.(p)) return false;
    return inWilds(p, { people: this._people ?? this.peopleNow(), spawn: L?.spawn });
  }

  add(kind, at, o = {}) {
    const f = new Foe(kind, at, { rng: this.rng, ...o });
    f.model = kind === 'machine' ? machineModel() : kind === 'shade' && this.lib && this.humans?.[0] ? this.shadeModel() : kindModel(kind) ?? blotModel(kind);
    f.model.group.position.copy(at);
    if (!f.model.shade) this.group.add(f.model.group);
    if (f.model.glob) this.group.add(f.model.glob);
    f.tele = new Telegraph(this.group, f.def.tone ?? '#6d4fa8');
    f.target = registerTarget({ kind: 'foe', foe: f, lock: true, radius: hurtRadius(f.def), accepts: ['blade', 'stun', 'fire', 'bloom'],
      position: () => f.chest, enabled: () => f.alive && f.model.group.visible,
      onHit: (mode, point, dir, info) => this.hurt(f, mode, dir, info) });
    this.list.push(f);
    return f;
  }

  remove(f) {
    f.target?.(); f.tele?.dispose(); f.model.group.removeFromParent(); f.model.glob?.removeFromParent(); f.model.shade?.dispose();
    for (const t of f.teles ?? []) t.dispose();
    for (const g of f.globs ?? []) g.removeFromParent();
    if (this.hold?.f === f) this.hold = null;
    if (this.lock === f) this.lock = null;
    // (each foe's shapes and its warning's glow are its own: let go with it, or every wave of a fight leaves
    // its GPU buffers and materials behind)
    for (const o of [f.model.group, f.model.glob, ...(f.globs ?? [])]) o?.traverse((m) => m.geometry?.dispose());
    this.list.splice(this.list.indexOf(f), 1);
  }

  /** The machines: one by each of the temple's checkpoints past the first (the rooms), unless broken already. */
  placeMachines() {
    const rt = this.level?.temple, phys = this.physics;
    if (!rt?.marks?.length || !phys) return;
    const arena = rt.guardian?.arena?.center ?? rt.guardian?.model?.pos ?? null;
    rt.marks.forEach((m, i) => {
      if (i === 0) return;
      const id = `foes.${this.levelId}.m${i}`;
      if (this.game.flag(id)) return;
      if (arena && m.pos.distanceTo(arena) < 14) return;
      for (const a of [0.9, -0.9, 2.2, -2.2, Math.PI]) {
        const h = m.heading + a, x = m.pos.x + Math.sin(h) * 3.6, z = m.pos.z + Math.cos(h) * 3.6;
        const y = phys.groundAt(x, m.pos.y + 2, z, 5);
        if (!Number.isFinite(y) || Math.abs(y - m.pos.y) > 1.2) continue;
        const from = _v.copy(m.pos).setY(m.pos.y + 1), to = _w.set(x, y + 1, z);
        if (phys.rayDistance?.(from, to.clone().sub(from).normalize(), from.distanceTo(to)) < from.distanceTo(to) - 0.3) continue;
        this.add(templeKind(this.levelId, i), new THREE.Vector3(x, y, z), { id }).placed = true;   // (the world's own: src/foe-worlds.js)
        break;
      }
    });
  }

  /** A pack of ink blots comes in, out of sight round you, where there is footing and nothing between. */
  spawnPack() {
    const P = this.player, phys = this.physics, kinds = packKinds(this.packs, this.levelId, this.rng).slice(0, this.difficulty === 'gentle' ? GENTLE.pack : 99), n = kinds.length;
    const base = this.rng() * Math.PI * 2;
    let made = 0;
    for (let tries = 0; tries < 24 && made < n; tries++) {
      const a = base + (tries % 6) * 0.35 + (tries > 11 ? Math.PI : 0), r = PACK.near + this.rng() * (PACK.far - PACK.near);
      const x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r;
      const y = phys ? phys.groundAt(x, P.pos.y + 25, z, 60) : P.pos.y;
      if (!Number.isFinite(y) || Math.abs(y - P.pos.y) > 5) continue;
      const at = new THREE.Vector3(x, y, z);
      if (!this.wild(at)) continue;
      this.add(kinds[made], at);
      made++;
    }
    if (made) this.packs++;
    return made;
  }

  /** A guarded relic you come near (in the wilds, not yet cleared, its guards not out): they gather round it. */
  updateGuards() {
    const P = this.player;
    for (const g of this.guards) {
      if (this.game.flag(g.id) || P.pos.distanceTo(g.pos) > GUARDS.near) continue;
      if (this.list.some((f) => f.guard === g && f.alive)) continue;
      if (!this.wild(g.pos)) { g.tame = true; continue; }
      const kinds = guardKinds(this.levelId, GUARDS.size);   // (the world's own: src/foe-worlds.js)
      for (let k = 0; k < GUARDS.size; k++) {
        const a = (k / GUARDS.size) * Math.PI * 2 + 0.7, x = g.pos.x + Math.sin(a) * GUARDS.ring, z = g.pos.z + Math.cos(a) * GUARDS.ring;
        const y = this.physics ? this.physics.groundAt(x, g.pos.y + 4, z, 12) : g.pos.y;
        const f = this.add(kinds[k], new THREE.Vector3(x, Number.isFinite(y) ? y : g.pos.y, z));
        f.guard = g;
      }
    }
  }

  /** The Arena: once the last wave is down, a short rest, then the next round you (the list, round and round). */
  updateWaves(dt) {
    if (this.list.some((f) => f.alive)) { this.waveRest = WAVE.rest; return; }
    this.waveRest -= dt;
    if (this.waveRest > 0) return;
    const P = this.player, kinds = WAVES[this.wave % WAVES.length], base = this.rng() * Math.PI * 2;
    kinds.forEach((kind, i) => {
      const a = base + (i / kinds.length) * Math.PI * 2, r = WAVE.near + this.rng() * (WAVE.far - WAVE.near);
      const x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r;
      const y = this.physics ? this.physics.groundAt(x, P.pos.y + 20, z, 40) : P.pos.y;
      this.add(kind, new THREE.Vector3(x, Number.isFinite(y) ? y : P.pos.y, z));
    });
    this.wave++;
    this.waveRest = WAVE.rest;
    this.notice?.(`Wave ${this.wave}: ${waveWords(kinds)}.`);
  }

  /** A shade's body (src/shade.js): the game's skinned person in living shadow; the pools and drops shared by all. */
  shadeModel() {
    this.shadePools ??= new ShadePools(this.scene ?? this.group);
    const body = new ShadeBody(this.scene ?? this.group, { lib: this.lib, human: this.humans[0], pools: this.shadePools });
    return { group: body.group, shade: body, parts: [], eyeMat: null, size: 1 };
  }

  /** Where a blot (or a shade) is cut down, its ink stains the ground: a few dark pools that fade (ShadePools). */
  stain(f) {
    this.shadePools ??= new ShadePools(this.scene ?? this.group);
    const n = f.kind === 'swarm' ? 1 : f.kind === 'shade' ? 5 : 3;
    for (let i = 0; i < n; i++) this.shadePools.pools.add(new THREE.Vector3(f.pos.x + (this.rng() - 0.5) * 0.9, f.pos.y + 0.02, f.pos.z + (this.rng() - 0.5) * 0.9), this.rng() * Math.PI * 2, _up);
  }

  /** A shade's cut leaves a dark arc of shadow in the air, right to left in front of it. */
  slashTrail(f) {
    this.shadePools ??= new ShadePools(this.scene ?? this.group);
    for (let i = 0; i < 16; i++) {
      const a = f.heading + 1.1 - (i / 15) * 2.2, r = 1.3;
      const at = new THREE.Vector3(f.pos.x + Math.sin(a) * r, f.pos.y + 1.25 - i * 0.03, f.pos.z + Math.cos(a) * r);
      this.shadePools.drops.add({ pos: at, vel: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.6), drag: 4, grav: 2, size: 0.05 + (i % 3) * 0.01, stretch: 2, life: 0.35 + i * 0.01, color: i % 4 ? '#08070a' : '#1a1720' });   // (the shade's black, white-lined: src/shade.js)
    }
  }

  /**
   * The world's harm on a foe (Foe.feelWorld, fall, fly: v0.98), through hurt() as any blow, so armour, a burst, ink
   * and the tank's charge follow: a hazard's cut ('hazard'), a hard landing ('landed'), a pendulum's blow ('swung');
   * thrown up an updraft or tumbled, only the sound; fallen out of the world ('fell'), gone.
   */
  worldEvent(f, e) {
    const s = this.sound;
    if (e.type === 'fell') { this.burst(f); return; }
    if (e.type === 'thrown' || e.type === 'tumbled') { s?.whoosh?.(); return; }
    let info = null;
    if (e.type === 'hazard') { info = { damage: WORLD_HARM[e.kind] ?? WORLD_HARM.other, source: 'hazard', kind: e.kind }; worldSnd[e.kind === 'fire' ? 'hiss' : 'spines'](s); }
    else if (e.type === 'landed' && e.hard) { info = { damage: e.h > FALL.harder ? 2 : 1, stun: FALL.stun, source: 'fall' }; worldSnd.thud(s, Math.min(1, e.h / 6)); kick(0.2); }
    else if (e.type === 'swung') { info = { damage: 1, stun: WORKS.swing.stun, source: 'swing' }; worldSnd.thud(s, 0.8); hitStop(0.05); kick(0.3); }
    if (!info) return;
    this.hurt(f, 'world', e.dir ?? null, info);
    if (!this.game.flag('foes.world')) {
      this.game.set('foes.world', true);
      this.notice?.('The world hurts them too: knock a foe into spines or fire, off a ledge, into the wind or a swinging weight.');
    }
  }

  /**
   * In a temple, its kit on the foes: one standing on a plate presses it (any that weighs: not a swarm blot, not a
   * flyer in the air; stilled, it still weighs). The gusts, updrafts and pendulums are workings (src/workings.js:
   * Foe.feelWorld); a gust piece that is not one (made before v0.98, a test's) still shoves foes down its hall here.
   */
  templeKit() {
    const rt = this.level?.temple;
    if (!rt?.pieces) return;
    const foes = this.list.filter((f) => f.alive && f.dead === undefined);
    const weighs = (f) => !f.air && !f.buried && !f.def.light && f.def.radius >= 0.5 && f.over + (f.def.hover ? f.alt : 0) < 0.6;
    for (const p of rt.pieces) {
      if (p.dirW && p.box && p.state === 1 && !p.working) for (const f of foes) {
        const l = rt.kit.local(f.pos);
        if (p.box.containsPoint(l) && !p.sheltered?.(l) && !screened(f.pos, p.dirW)) f.vel.set(p.dirW.x, 0, p.dirW.z).multiplyScalar(p.push * (f.stunned > 0 ? WORKS.gust.still : f.def.heavy ? WORKS.gust.heavy : 1));
      }
      if (p.weighed && p.solid && p.id && rt.logic) {
        const on = foes.some((f) => weighs(f) && Math.hypot(f.pos.x - p.pos.x, f.pos.z - p.pos.z) < p.r + 0.3 && Math.abs(f.pos.y - p.pos.y) < 0.8);
        if (on) rt.logic.press(p.id, 'foe'); else rt.logic.release(p.id, 'foe');
      }
    }
  }

  /** A machine comes apart: its pieces fly off, bounce on the ground, settle and fade. */
  breakApart(f) {
    const floor = f.pos.y;
    for (const part of f.model.parts) {
      this.group.attach(part);
      (this.debris ??= []).push({ o: part, floor, t: 0, vel: new THREE.Vector3((this.rng() - 0.5) * 6, 3 + this.rng() * 4, (this.rng() - 0.5) * 6), spin: new THREE.Vector3(this.rng() * 8 - 4, this.rng() * 8 - 4, this.rng() * 8 - 4) });
    }
  }

  updateDebris(dt) {
    for (const d of this.debris ?? []) {
      d.t += dt;
      d.vel.y -= 9.8 * dt;
      d.o.position.addScaledVector(d.vel, dt);
      d.o.rotation.x += d.spin.x * dt; d.o.rotation.y += d.spin.y * dt; d.o.rotation.z += d.spin.z * dt;
      if (d.o.position.y < d.floor + 0.12) { d.o.position.y = d.floor + 0.12; d.vel.y *= -0.3; d.vel.x *= 0.6; d.vel.z *= 0.6; d.spin.multiplyScalar(0.5); }
      if (d.t > 2.4) d.o.scale.multiplyScalar(Math.max(0, 1 - dt * 3));
      if (d.t > 3.4) d.o.removeFromParent();
    }
    if (this.debris) this.debris = this.debris.filter((d) => d.t <= 3.4);
  }

  /** The fluid tool touched a foe (targets.js): its mind decides; the look, the sound and the reward follow. */
  hurt(f, mode, dir, info) {
    const r = f.hit(mode, dir, info);
    if (!r) return false;
    if (r === 'glance') { this.sound?.foeHurt?.('machine'); this.sparks(f, f.chest); return true; }   // (off a crab's shell)
    if (r === 'flushed') { this.sound?.foeHurt?.(f.def.sound ?? f.kind); this.burstUp(f, { surface: true }); return true; }   // (a cut at a ray's fin: sand flies, up it comes)
    if (r === 'burst') { if (mode === 'blade' || mode === 'shoot' || mode === 'fire' || mode === 'world') this.sound?.foeHurt?.(f.def.sound ?? f.kind); this.burst(f); return true; }
    if (f.shrugged) { this.armour(f, dir); return true; }
    if (mode === 'blade' || mode === 'shoot' || mode === 'fire' || mode === 'world') this.sound?.foeHurt?.(f.def.sound ?? f.kind);
    return true;
  }

  /** Done: a blot bursts back into ink, a machine comes apart; the tank gets a charge back. */
  burst(f) {
    this.sound?.foeBurst?.(f.def.sound ?? f.kind);
    // the blow that ends one lands harder (a longer freeze, a bigger kick); the last of a fight, a moment of
    // slow motion to mark it done (src/feel.js)
    const P = this.player, last = !this.list.some((x) => x !== f && x.alive && x.dead === undefined && x.state !== 'idle' && (!P || x.pos.distanceTo(P.pos) < 28));
    hitStop(last ? 0.12 : 0.09); kick(last ? 0.6 : 0.35);
    if (last) slowMo(0.45, 0.35);
    const T = this.tool, at = f.chest.clone();
    const tones = BURST_TONES[f.kind] ?? [INK, '#3b3350', '#6d4fa8'];
    for (let i = 0; i < 46; i++) T?.drops?.add({ pos: at, vel: _v.randomDirection().multiplyScalar(2 + Math.random() * 6).addScaledVector(_up, 3), drag: 2, grav: 9, size: 0.05 + Math.random() * 0.06, stretch: 2, life: 0.6 + Math.random() * 0.5, color: tones[i % 3] });
    if (T?.reserve) {
      T.reserve.level = Math.min(T.reserve.max, T.reserve.level + 1);
      T.flash = 1; T.wave = Math.max(T.wave ?? 0, 0.6);
      const tank = T.tank?.group ? T.tank.group.localToWorld(_w.set(0, 0.3, 0)) : null;
      if (tank) for (let i = 0; i < 10; i++) T.glow?.add({ pos: at, vel: _v.subVectors(tank, at).multiplyScalar(1.6).add(_w.clone().randomDirection()), drag: 1, size: 0.06, life: 0.6, color: T.modeTones?.[i % 2] ?? '#52c8cf', grow: true });
    }
    if (f.def.breaks) this.breakApart(f);   // (a machine, glass, a shell, a drone: its pieces fly)
    else this.stain(f);
    // a glass golem breaks into its splinters, and they come on
    if (f.def.splits) for (let i = 0; i < f.def.splits.n; i++) {
      const a = (i / f.def.splits.n) * Math.PI * 2 + this.rng(), s = this.add(f.def.splits.kind, new THREE.Vector3(f.pos.x + Math.sin(a) * 0.9, f.pos.y, f.pos.z + Math.cos(a) * 0.9));
      s.state = 'chase'; s.cool = 0.9 + i * 0.3; s.vel.set(Math.sin(a), 0, Math.cos(a)).multiplyScalar(5); s.guard = f.guard; s.placed = f.placed;
    }
    if (this.hold?.f === f) this.hold = null;
    if (f.id) this.game.set(f.id, true);
    if (f.guard && !this.list.some((x) => x !== f && x.guard === f.guard && x.alive)) this.game.set(f.guard.id, true);   // (the relic's guards are gone for good)
    if (!this.level?.foes?.noInk) gainInk(INK_OF[f.kind] ?? 1, { game: this.game, notice: this.notice });   // (src/ink.js: the blade grows with it; not from a game's endless waves)
    f.dead = 0.8;   // (the look fades out over this)
    this.game.emit?.('foe:burst', { kind: f.kind });
  }

  update(dt, paused = false) {
    const P = this.player;
    if (!P) return;
    if (!this.on) { for (const f of this.list) f.model.group.visible = false; return; }
    if (paused) return;
    if (this.tool?.blade) this.tool.blade.gentle = this.gentle;   // (the evade's i-frame window for this setting)
    this._people = this.peopleNow();
    // the wilds: after a few seconds out there, a pack comes in (the first time, just one); a pack
    // left far behind dissolves; after one is cut down, a rest before the next
    if (this.waves && !this.own && !this.practice) this.updateWaves(dt);
    if (this.practice?.kind) this.updatePractice(dt);
    this.updateGuards();
    const wild = !this.waves && !P.ride && !P.swim && this.wild(P.pos);
    this.wildFor = wild ? this.wildFor + dt : 0;
    this.packRest = Math.max(0, this.packRest - dt);
    const blots = this.list.filter((f) => !f.placed && !f.guard && f.alive);   // (the wilds' own: not the temple's, not a relic's guards)
    if (wild && this.wildFor > PACK.settle && this.packRest === 0 && blots.length === 0) {
      if (this.spawnPack()) { this.packRest = (PACK.rest[0] + this.rng() * (PACK.rest[1] - PACK.rest[0])) * (this.difficulty === 'gentle' ? GENTLE.rest : 1); this.firstSeen(); }
      else this.packRest = 3;
    }
    for (const f of this.list.slice()) {
      if (f.dead !== undefined) {   // bursting: shrink away, then gone
        f.dead -= dt;
        if (f.model.shade) { f.model.shade.melt = 1 - f.dead / 0.8; f.model.shade.update(dt, f); }   // (a shade runs away into the ground)
        else f.model.group.scale.setScalar(Math.max(0.01, f.dead / 0.8));
        f.tele.hide();
        if (f.dead <= 0) this.remove(f);
        continue;
      }
      if (!f.placed && !this.waves && f.pos.distanceTo(P.pos) > PACK.drop) { this.remove(f); continue; }
      // a machine only stirs while you are in its temple (the Arena's, always)
      const inTemple = !f.placed || this.waves || this.level?.temple?.inside?.(P.pos);
      const ev = inTemple ? f.update(dt, P, this.env) : [];
      for (const e of ev) {
        if (e === 'warn') this.sound?.foeWarn?.(f.def.sound ?? f.kind);
        if (e === 'notice') this.meet(f);
        if (e?.type && e.type !== 'strike') { this.worldEvent(f, e); continue; }
        if (e?.type !== 'strike') continue;
        if (f.kind === 'shade') this.slashTrail(f);
        const a = e.atk ?? f.def.attack;
        if (a.wave) this.addWave(f, a);
        if (a.leave) this.leaveSlag(f, a);
        if (a.surface || a.blink) this.burstUp(f, a);
        if (e.hit) this.strike(f, a);
      }
      if (f.def.trail && f.alive && inTemple) this.trailSlag(f);
      this.look(f, dt);
    }
    this.updateHold(dt);
    this.updateHazards(dt);
    this.keepApart();
    this.warnings();
    this.updateLock(dt);
    this.updateDebris(dt);
    this.shadePools?.update(dt);
    if (this.level?.temple?.inside?.(P.pos)) this.templeKit();
    // a fight on: the combat music comes in (src/audio.js), and touch shows its lock-on button
    const fighting = this.list.some((f) => f.alive && (['chase', 'wind', 'strike', 'recover'].includes(f.state)) && f.pos.distanceTo(P.pos) < 28);
    this.sound?.combat?.(fighting);
    if (typeof document !== 'undefined') document.body.classList.toggle('combat', fighting || !!this.lock);
  }

  /** Foes don't stand inside each other: two too close are pushed apart, half each. */
  keepApart() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), want = a.def.radius + b.def.radius + TURNS.apart;
      if (d >= want || d < 1e-4) continue;
      const push = (want - d) / 2 / d;
      a.step(-dx * push, -dz * push, this.env); b.step(dx * push, dz * push, this.env);
    }
  }

  /**
   * A foe winding up where you can't see it (behind the camera, off the side): a marker at the edge of
   * the screen on its side, filling as its strike comes.
   */
  warnings() {
    if (typeof document === 'undefined' || !this.camera) return;
    if (!this.warnEl) {
      this.warnEl = document.createElement('div');
      this.warnEl.id = 'foe-warn';
      this.warnEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:25';
      document.body.appendChild(this.warnEl);
      this.chips = [];
    }
    const cam = this.camera, fwd = cam.getWorldDirection(_w), out = this.list.filter((f) => f.alive && f.state === 'wind');
    let n = 0;
    for (const f of out) {
      const c = f.chest, ahead = _v.subVectors(c, cam.position).dot(fwd) > 0;
      const p = c.clone().project(cam);
      if (ahead && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.85) continue;   // on the screen: its ring says it all
      let x = ahead ? p.x : -p.x, y = ahead ? p.y : -p.y;
      if (!ahead && Math.hypot(x, y) < 0.2) y = -1;   // straight behind: at the bottom
      const k = 1 / Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.82, 1e-3);
      x *= k; y *= k;
      const chip = this.chips[n] ?? (this.chips[n] = this.warnEl.appendChild(Object.assign(document.createElement('div'), { className: 'foe-chip' })));
      chip.style.cssText = `position:absolute;left:${(x * 0.5 + 0.5) * 100}%;top:${(0.5 - y * 0.5) * 100}%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #2b211f;background:radial-gradient(circle, ${f.def.tone ?? '#8e64d6'} ${Math.round(f.k * 70)}%, rgba(247,236,210,0.85) ${Math.round(f.k * 70) + 1}%);box-shadow:2px 2px 0 #2b211f`;
      n++;
    }
    for (let i = n; i < (this.chips?.length ?? 0); i++) this.chips[i].style.display = 'none';
  }

  /** A strike that caught the traveller: a bite of the bar (never all of a healthy one), a shove, a machine knocks you down. */
  strike(f, a = f.atk ?? f.def.attack) {
    const P = this.player;
    // a flash only blinds whoever looks at it: turned away (the camera), it is nothing
    if (a.blind && !this.facing(f)) return false;
    // the evade's i-frames swallowed it (src/fluid-blade.js dodge): a blow, a lob, a charge, a flash, a line or a grip
    if (P.dodge?.(f.pos, a.tether || a.grab ? 'grab' : 'strike', this.gentle)) return false;
    // the guard took it (src/fluid-blade.js block): no harm, and the foe reels back
    const guarded = P.guard?.(f.pos);
    if (guarded) {
      const perfect = guarded === 'perfect';
      // a perfect parry chips a piece off a glass golem (before the stun, which would double it)
      if (a.onParry === 'chip' && perfect) { this.hurt(f, 'blade', _w.set(-Math.sin(f.heading), 0, -Math.cos(f.heading)), { damage: 1, source: 'parry' }); this.sparks(f, f.chest); if (!f.alive) return false; }
      f.staggered(perfect); this.sound?.foeHurt?.(f.def.sound ?? f.kind);
      if (perfect) { f.stunned = PARRY_STUN; if (!this.game.flag('foes.parried')) { this.game.set('foes.parried', true); this.notice?.('A perfect parry: raised just as the strike came, the guard costs nothing and leaves the foe stunned.'); } }
      // what a guard does to some attacks: a crab's spin is turned onto its back; a harpoon's or a root's line is
      // cut (the drone, the stalker dazed)
      if (a.onParry === 'flip') { f.flipped = f.stunned = Math.max(f.stunned, 2.6); f.vel.multiplyScalar(0.3); }
      else if (a.onParry === 'cut') { f.stunned = Math.max(f.stunned, perfect ? PARRY_STUN : 1); this.sparks(f, P.chest ?? P.pos); }
      return false;
    }
    this.harm(this.harmOf(a.damage));
    _v.subVectors(P.pos, f.pos).setY(0);
    if (_v.lengthSq() < 1e-4) _v.set(Math.sin(f.heading), 0, Math.cos(f.heading));
    _v.normalize();
    const g = this.difficulty === 'gentle' ? 0.6 : 1;
    if (a.tether || a.grab) {
      // a harpoon's line, a root's grip: you are pulled in (cut the foe, or it is stilled, and it lets go)
      const h = a.tether ?? a.grab;
      this.hold = { f, kind: a.tether ? 'tether' : 'grab', t: h.time * g, pull: h.pull, d: f.pos.distanceTo(P.pos) };
      f.letGo = false; P.flinch?.();
    } else if (a.knock) P.knockDown?.(_v.clone().multiplyScalar(a.knock).addScaledVector(_up, 3.5), { why: 'foe' });
    else { P.vel?.addScaledVector(_v, 5).addScaledVector(_up, 2.5); P.flinch?.(); }   // (a flinch from motion capture: player.js)
    if (a.blind) this.blind(a.blind * g, f.def.tone);
    return true;
  }

  /** Is the traveller looking toward f (the camera's view, else the body's heading)? */
  facing(f) {
    const P = this.player, d = _w.subVectors(f.chest, P.pos).setY(0);
    if (d.lengthSq() < 1e-4) return true;
    d.normalize();
    const fwd = this.camera ? this.camera.getWorldDirection(_v).setY(0).normalize() : _v.set(Math.sin(P.heading ?? 0), 0, Math.cos(P.heading ?? 0));
    return fwd.dot(d) > 0.45;
  }
  /** A strike's damage for this setting (Gentle: half). */
  harmOf(d) { return d * (this.difficulty === 'gentle' ? GENTLE.harm : 1); }
  /** A bite of the bar (never all of a healthy one). */
  harm(d) { const P = this.player; P.hurt?.(strikeDamage(P.health ?? 1, d), 'foe'); }

  /**
   * A cut that landed and didn't stop it (Foe.shrugged): a dull thunk instead of the splat, sparks off where it struck
   * and a gold ring round it, so you know the blow told but it comes on; the first time, what does stop one.
   */
  armour(f, dir) {
    this.sound?.foeArmour?.();
    this.sparks(f, f.chest);
    const T = this.tool;
    T?.rings?.add({ from: f.chest.clone(), dir: dir ? _w.copy(dir).setY(0).normalize().negate() : _up, reach: 0.05, r0: f.def.radius * 0.6, r1: f.def.radius + ARMOUR.ring, life: 0.25, color: '#f2c54b', thick: 1 });
    if (!this.game.flag('foes.armour')) {
      this.game.set('foes.armour', true);
      this.notice?.('That one shrugs off a light cut: the heavy third swing, a perfect parry or a cut before it is fully wound up staggers it.');
    }
  }

  /** A guard that cut a line or chipped glass: a few bright sparks. */
  sparks(f, at) {
    const T = this.tool;
    if (!T?.drops || !at) return;
    for (let i = 0; i < 14; i++) T.drops.add({ pos: at, vel: _v.randomDirection().multiplyScalar(3).addScaledVector(_up, 2), drag: 3, grav: 8, size: 0.035, stretch: 2, life: 0.4, color: i % 2 ? '#fff6dc' : f.def.tone ?? '#f2c54b' });
  }

  /** A line or a grip holding you: pulled toward the foe until it lets go (cut, stilled, flipped), or the time is up. */
  updateHold(dt) {
    const h = this.hold, P = this.player;
    if (!h) return;
    const f = h.f;
    h.t -= dt;
    if (h.t <= 0 || !f.alive || f.dead !== undefined || f.letGo || f.stunned > 0 || P.dead || P.down || P.ride) { this.hold = null; return; }
    _v.subVectors(f.pos, P.pos).setY(0);
    h.d = _v.length();
    const stop = f.def.radius + 0.9;
    if (h.d > stop) P.vel?.set(_v.x / h.d * h.pull, P.vel.y, _v.z / h.d * h.pull);
    else P.vel?.set(0, P.vel.y, 0);
  }
  /** How far the line from f reaches now (a drone's harpoon line, a stalker's roots: drawn to you), or 0. */
  held(f) { return this.hold?.f === f ? this.hold.d : 0; }

  /** A moth's flash: the screen goes white and fades (Gentle: shorter). */
  blind(s, tone = '#ff5fa2') {
    this.blinded = Math.max(this.blinded ?? 0, s);
    if (typeof document === 'undefined') return;
    if (!this.blindEl) {
      this.blindEl = Object.assign(document.createElement('div'), { id: 'foe-blind' });
      this.blindEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:23;opacity:0;transition:none';
      document.body.appendChild(this.blindEl);
    }
    this.blindEl.style.background = `radial-gradient(circle at 50% 45%, #ffffff 0%, #fffaf2 45%, ${tone} 140%)`;
    this.blindFor = s;
  }

  /** The machine's ground slam: a ring of shock running out over the floor (you jump it; a guard does not hold it). */
  addWave(f, a) {
    const W = a.wave, at = f.pos.clone();
    const mesh = new THREE.Mesh(_waveGeo ??= new THREE.RingGeometry(0.86, 1, 56).rotateX(-Math.PI / 2), _waveMat ??= makeMaterial({ color: '#e0703a', flat: true, glow: 0.7, side: THREE.DoubleSide, key: 'foe-wave' }));
    const inner = new THREE.Mesh(_waveGeo, _waveInk ??= makeMaterial({ color: '#2b211f', flat: true, side: THREE.DoubleSide, key: 'foe-wave-ink' }));
    inner.scale.setScalar(0.94); inner.position.y = -0.01; mesh.add(inner);
    mesh.position.set(at.x, at.y + 0.08, at.z); mesh.userData.noCollide = true;
    this.group.add(mesh);
    (this.shocks ??= []).push({ f, at, r: a.radius ?? 1.5, W, mesh, hit: false });
  }

  /** Slag poured or stamped out: burning patches on the ground (a ring round it, or a fan before it). */
  leaveSlag(f, a) {
    const n = a.leave === 'ring' ? 7 : 5;
    for (let i = 0; i < n; i++) {
      if (a.leave === 'ring') { const t = (i / n) * Math.PI * 2; this.addPatch(f.pos.x + Math.sin(t) * (a.radius ?? 2) * 0.75, f.pos.y, f.pos.z + Math.cos(t) * (a.radius ?? 2) * 0.75, 0.8, 5); }
      else { const t = f.attackH + (i / (n - 1) - 0.5) * (a.angle ?? 0.5) * 1.6, r = (a.range ?? 4) * (0.45 + (i % 2) * 0.35); this.addPatch(f.pos.x + Math.sin(t) * r, f.pos.y, f.pos.z + Math.cos(t) * r, 0.85, 5); }
    }
  }
  /** A slag walker treads burning slag behind it, a patch every so often. */
  trailSlag(f) {
    const T = f.def.trail;
    if (!f._trail) { f._trail = f.pos.clone(); return; }
    if (f.pos.distanceTo(f._trail) < T.every || f.crust > 0) return;
    f._trail.copy(f.pos);
    this.addPatch(f.pos.x, f.pos.y, f.pos.z, T.r, T.life);
  }
  addPatch(x, y, z, r, life) {
    const P = this.physics, g = P?.groundAt?.(x, y + 1.5, z, 4), gy = Number.isFinite(g) ? g : y;
    const mesh = new THREE.Mesh(_patchGeo ??= new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), _patchMat ??= makeMaterial({ color: '#ff7a2e', color2: '#ffd36a', flat: true, glow: 0.9, key: 'foe-slag-patch' }));
    const rim = new THREE.Mesh(_rimGeo ??= new THREE.RingGeometry(0.82, 1, 14).rotateX(-Math.PI / 2), _patchRim ??= makeMaterial({ color: '#2a1d1a', flat: true, key: 'foe-slag-rim' }));
    rim.position.y = 0.004; mesh.add(rim);
    mesh.position.set(x, gy + 0.04, z); mesh.scale.setScalar(r); mesh.rotation.y = this.rng() * 6; mesh.userData.noCollide = true;
    this.group.add(mesh);
    (this.patches ??= []).push({ pos: new THREE.Vector3(x, gy, z), r, life, max: life, mesh });
    if (this.patches.length > 48) { const old = this.patches.shift(); old.mesh.removeFromParent(); }
  }

  /** A ray bursting up, a hound stepping out of the shadow: sand or shadow thrown up there. */
  burstUp(f, a) {
    const T = this.tool, at = f.pos.clone().setY(f.pos.y + 0.2);
    if (a.surface) for (let i = 0; i < 26; i++) T?.drops?.add({ pos: at, vel: _v.randomDirection().setY(Math.random() * 1.5 + 0.5).multiplyScalar(3 + Math.random() * 3), drag: 2, grav: 9, size: 0.06 + Math.random() * 0.05, life: 0.7, color: i % 3 ? '#e8c58f' : '#c98d4f' });
    if (a.blink) { this.shadePools ??= new ShadePools(this.scene ?? this.group); for (let i = 0; i < 3; i++) this.shadePools.pools.add(new THREE.Vector3(f.pos.x + (this.rng() - 0.5), f.pos.y + 0.02, f.pos.z + (this.rng() - 0.5)), this.rng() * 6, _up); }
  }

  /** The shocks running out, the slag burning, the white of a flash fading. */
  updateHazards(dt) {
    const P = this.player, ground = P.onGround !== false;
    for (const s of this.shocks ?? []) {
      s.r += s.W.speed * dt;
      s.mesh.scale.setScalar(s.r);
      const d = Math.hypot(P.pos.x - s.at.x, P.pos.z - s.at.z);
      // caught by the front only on your feet: a jump clears it
      if (!s.hit && ground && Math.abs(d - s.r) < s.W.width && Math.abs(P.pos.y - s.at.y) < 1.2 && !P.dead && !P.down) {
        s.hit = true;
        if (P.dodge?.(s.at, 'shockwave', this.gentle)) s.dodged = true;   // (an evade's i-frames through the front)
        else {
          this.harm(this.harmOf(s.W.damage));
          _v.subVectors(P.pos, s.at).setY(0).normalize();
          P.vel?.addScaledVector(_v, 4).addScaledVector(_up, 3); P.flinch?.();
        }
      }
      if (s.r > s.W.reach) s.mesh.removeFromParent();
    }
    if (this.shocks) this.shocks = this.shocks.filter((s) => s.r <= s.W.reach);
    this.burnCool = Math.max(0, (this.burnCool ?? 0) - dt);
    for (const p of this.patches ?? []) {
      p.life -= dt;
      p.mesh.scale.setScalar(p.r * Math.min(1, p.life / 0.8, (p.max - p.life) / 0.25 + 0.3));
      // (an evade's i-frames carry you over it unburnt; standing in it after, it burns)
      if (this.burnCool === 0 && ground && !P.dead && !P.down && Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z) < p.r && Math.abs(P.pos.y - p.pos.y) < 0.8 && !P.dodge?.(p.pos, 'burn', this.gentle)) {
        this.burnCool = 0.7; this.harm(this.harmOf(0.05)); P.vel?.addScaledVector(_up, 2.5); P.flinch?.();
        this.sound?.foeHurt?.('blot');
      }
      if (p.life <= 0) p.mesh.removeFromParent();
    }
    if (this.patches) this.patches = this.patches.filter((p) => p.life > 0);
    if (this.blinded > 0) {
      this.blinded = Math.max(0, this.blinded - dt);
      if (this.blindEl) this.blindEl.style.opacity = String(Math.min(1, (this.blinded / (this.blindFor || 1)) * 1.6) * 0.88);
    } else if (this.blindEl) this.blindEl.style.opacity = '0';
  }

  /** The first time each kind comes for you: what it is and how to beat it, once (NOTES, src/foe-kinds.js). */
  meet(f) {
    const note = NOTES[f.kind];
    if (!note || this.own) return;
    const id = `foes.met.${f.kind}`;
    if (this.game.flag(id)) return;
    this.game.set(id, true);
    this.notice?.(note);
  }

  // ------------------------------------------------------------------ the Arena's practice (src/foe-spawner.js)
  /** A foe of `kind` comes in ahead of you (the Arena's spawner, tests, the console: foes.spawnKind('crab')). */
  spawnKind(kind, { n = FOES[kind]?.group ?? 1, dist = 9 } = {}) {
    const P = this.player;
    if (!FOES[kind] || !P) return [];
    const h = P.heading ?? 0, out = [];
    for (let i = 0; i < n; i++) {
      const a = h + (i - (n - 1) / 2) * 0.35, x = P.pos.x + Math.sin(a) * dist, z = P.pos.z + Math.cos(a) * dist;
      const y = this.physics ? this.physics.groundAt(x, P.pos.y + 20, z, 40) : P.pos.y;
      const f = this.add(kind, new THREE.Vector3(x, Number.isFinite(y) ? y : P.pos.y, z));
      f.heading = Math.atan2(P.pos.x - x, P.pos.z - z);
      out.push(f);
    }
    return out;
  }
  /** Practice: the waves stop; with a kind, it comes back each time the last one falls (null: the waves again). */
  setPractice(kind = null) {
    if (kind === null) { this.practice = null; this.waveRest = WAVE.rest; return; }
    this.practice = { kind: kind || null, rest: 0.5 };
    for (const f of this.list.slice()) if (f.dead === undefined) this.remove(f);
    if (kind) this.spawnKind(kind);
  }
  updatePractice(dt) {
    const p = this.practice;
    if (this.list.some((f) => f.alive)) { p.rest = 2; return; }
    if ((p.rest -= dt) <= 0) { this.spawnKind(p.kind); p.rest = 2; }
  }

  /** The first pack: say what they are and what cuts them, once. */
  firstSeen() {
    if (this.game.flag('foes.seen')) return;
    this.game.set('foes.seen', true);
    this.notice?.('Ink blots: watch their bodies wind up. {key:blade} cuts; {key:guard} guards; {key:evade} evades. A last-moment guard parries. Each foe cut gives the tank a charge back.');
  }

  /** The look follows the mind: a blot wobbles and squashes into its lunge, a machine walks and raises its arms. */
  look(f, dt) {
    const M = f.model, g = M.group, t = (this._t = (this._t ?? 0) + dt / Math.max(1, this.list.length));
    g.visible = true;
    g.position.copy(f.pos);
    g.position.y += f.over;   // (a hovering foe's held height over its footing: HOVER)
    g.rotation.y = f.heading;
    const moving = f.state === 'chase' || f.state === 'home';
    const wind = f.state === 'wind' ? THREE.MathUtils.smoothstep(f.k, 0, 0.72) : 0;
    const strike = f.state === 'strike', recover = f.state === 'recover';
    const recovery = recover ? THREE.MathUtils.clamp(f.timer / f.def.recover, 0, 1) : 0;
    const release = strike ? THREE.MathUtils.smoothstep(f.k, 0, 0.7) : 0;
    if (M.shade) {
      M.shade.melt = Math.max(0, M.shade.melt - dt / 0.8);   // (it pours up out of the ground as it comes)
      M.shade.update(dt, f);
    } else if (M.anim) {
      // each world's own kind moves itself (src/foe-kinds.js)
      g.scale.setScalar(M.size ?? 1); g.rotation.x = 0; g.rotation.z = 0;
      M.anim(f, this.animKit(f, dt, { t, wind, release, recovery, moving }));
    } else if (f.kind !== 'machine') {
      const w = Math.sin(performance.now() / 160 + f.home.x) * 0.06;
      const stretch = strike ? Math.sin(Math.PI * f.k) : 0;
      const squash = f.state === 'wind' && !f.def.hover ? 1 - 0.35 * f.k : 1;
      g.position.y += 0.15 + f.alt + Math.abs(Math.sin(performance.now() / 260 + f.home.z)) * (moving ? 0.25 : 0.08);
      const s = M.size;
      g.scale.set((1 + w + (1 - squash) * 0.5 - stretch * 0.15) * s, (squash - w - stretch * 0.15) * s, (1 + w + stretch * 0.6) * s);
      g.rotation.x = -wind * 0.25 + stretch * 0.35;
      M.eyeMat.uniforms.uColor.value.set(f.state === 'wind' ? '#f05a3c' : f.stunned > 0 ? '#bfe9ff' : M.base);
      if (M.wings) { const flap = Math.sin(performance.now() / (f.state === 'wind' ? 60 : 110)) * 0.6; M.wings[0].rotation.z = flap; M.wings[1].rotation.z = -flap; }
      // the spitter's glob: in the air over the last half of its wind-up, down onto the drawn ring
      if (M.glob) {
        const u = f.state === 'wind' ? (f.k - 0.45) / 0.55 : -1;
        const pts = f.attackPts ?? [f.attackAt];
        M.glob.visible = u > 0;
        if (u > 0) { M.glob.position.lerpVectors(f.chest, pts[Math.floor(pts.length / 2)], u); M.glob.position.y += Math.sin(Math.PI * u) * 3.5 + (1 - u) * 0.2; }
        // a volley: the other globs, a little behind the first
        const rest = pts.filter((_, i) => i !== Math.floor(pts.length / 2));
        for (let i = 0; i < Math.max(rest.length, f.globs?.length ?? 0); i++) {
          const gl = (f.globs ??= [])[i] ?? (f.globs[i] = this.group.add(new THREE.Mesh(M.glob.geometry, M.glob.material)).children.at(-1));
          const v = u - 0.08 * (i + 1);
          gl.visible = i < rest.length && v > 0;
          if (gl.visible) { gl.position.lerpVectors(f.chest, rest[i], v); gl.position.y += Math.sin(Math.PI * v) * 3.2 + (1 - v) * 0.2; }
        }
      }
    } else {
      const walk = moving ? Math.sin(t * 9) * 0.45 : 0;
      M.legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 9 + k * Math.PI * 2 / 3) * (moving ? 0.35 : 0) - wind * 0.16; });
      const arm = wind ? -2.6 * wind : strike ? THREE.MathUtils.lerp(-2.6, -0.45, release) : -0.45 * recovery;
      M.arms[0].rotation.x = arm; M.arms[1].rotation.x = arm * 0.85;
      M.body.rotation.y = wind * 0.3 + (strike ? 0.3 * (1 - release) : 0);
      g.rotation.x = -wind * 0.15 + (strike ? release * 0.3 : recovery * 0.3);
      g.position.y += f.alt - wind * 0.1;   // (alt: held up off its feet by the magnet glove, src/gadgets/magnet.js)
      M.eyeMat.uniforms.uColor.value.set(f.state === 'wind' ? '#f0a04b' : f.stunned > 0 ? '#bfe9ff' : '#70e7df');
      M.heart.rotation.z = Math.sin(performance.now() / 300) * (f.state === 'chase' ? 0.2 : 0.05);
      g.scale.setScalar(1);
    }
    // Recoil follows the blow, then settles; a heavy impact also buckles the body.
    const r = Math.sin(f.recoil * Math.PI * 0.5), strength = f.heavyRecoil ? 0.28 : 0.12;
    g.position.addScaledVector(f.recoilDir, r * strength);
    g.rotation.x += r * strength * (f.recoilDir.x * Math.sin(f.heading) + f.recoilDir.z * Math.cos(f.heading));
    g.rotation.z = -r * strength * (f.recoilDir.x * Math.cos(f.heading) - f.recoilDir.z * Math.sin(f.heading));
    g.position.y -= f.heavyRecoil ? r * 0.14 : 0;
    // Melee reads from the body; ranged impacts and areas (a lob, a lane, a shockwave's slam) are drawn on the floor.
    const a = f.atk ?? f.def.attack, pts = f.attackPts ?? [f.attackAt];
    const drawn = f.state === 'wind' && (a.tele || a.at === 'target' || a.at === 'behind');
    for (let i = 0; i < Math.max(pts.length, 1 + (f.teles?.length ?? 0)); i++) {
      const T = i === 0 ? f.tele : ((f.teles ??= [])[i - 1] ??= new Telegraph(this.group, f.def.tone ?? '#6d4fa8'));
      if (drawn && i < pts.length) { T.show(a, pts[i], f.attackH, a.at === 'behind' || a.at === 'target' ? pts[i].y : f.level); T.set(f.k, t); }
      else T.hide();
    }
  }

  /** What a kind's own animation may use (src/foe-kinds.js anim(f, c)): the pose's phases and a few effects. */
  animKit(f, dt, o) {
    const T = this.tool, kit = (this._kit ??= {
      dust: (at, color, n = 1, spread = 0.6) => { for (let i = 0; i < n; i++) T?.drops?.add({ pos: _w.set(at.x + (Math.random() - 0.5) * spread * 2, at.y + 0.1, at.z + (Math.random() - 0.5) * spread * 2), vel: _v.set((Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5), drag: 2.5, grav: 7, size: 0.05 + Math.random() * 0.04, life: 0.5, color }); },
      spray: (at, colors, n = 10, speed = 4, grav = 9) => { for (let i = 0; i < n; i++) T?.drops?.add({ pos: at, vel: _v.randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.6)).addScaledVector(_up, 1.5), drag: 2, grav, size: 0.04 + Math.random() * 0.05, stretch: 2, life: 0.55, color: colors[i % colors.length] }); },
      drip: (foe, color) => { this.shadePools ??= new ShadePools(this.scene ?? this.group); this.shadePools.drops.add({ pos: _w.copy(foe.chest).add(_v.randomDirection().multiplyScalar(0.25)), vel: _v.set(0, -0.5, 0), drag: 1, grav: 6, size: 0.04, stretch: 2.5, life: 0.5, color }); },
      tethered: (foe) => this.held(foe),
      lob: (foe, u, color = '#d7f3d9') => {
        const gl = (foe.globs ??= [])[0] ?? (foe.globs[0] = this.group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), makeMaterial({ color, flat: true, glow: 0.3, key: `foe-lob-${color}` }))).children.at(-1));
        gl.visible = u > 0;
        if (u > 0) { gl.position.lerpVectors(foe.chest, foe.attackAt, u); gl.position.y += Math.sin(Math.PI * u) * 4 + (1 - u) * 0.6; gl.rotation.x += 0.2; gl.rotation.y += 0.13; }
      },
    });
    return Object.assign(kit, o, { dt, now: performance.now() });
  }

  /**
   * The hitbox overlay's extra shapes (src/hitboxes.js registerHitboxes, from main.js): the shockwaves' fronts,
   * the burning slag, a line or a grip holding you, a volley's other rings, a buried ray's ripple.
   */
  hitShapes(out = []) {
    const P = this.player;
    for (const s of this.shocks ?? []) out.push({ kind: 'circle', c: s.at.clone(), r: s.r, color: s.hit ? '#a05050' : '#ff1f1f', tag: 'foe.shockwave', fill: 0 });
    for (const p of this.patches ?? []) out.push({ kind: 'circle', c: p.pos.clone(), r: p.r, color: '#ff7a00', tag: 'foe.slag', fill: 0.2 });
    if (this.hold && P) out.push({ kind: 'segment', a: this.hold.f.chest.clone(), b: P.pos.clone().setY(P.pos.y + 1), color: '#ff1f1f', tag: `foe.${this.hold.kind}` });
    for (const f of this.list) {
      if (!f.alive || f.dead !== undefined) continue;
      if (f.state === 'wind' && f.attackPts) for (const p of f.attackPts) out.push({ kind: 'circle', c: p.clone(), r: f.atk.radius ?? 1.5, color: '#ffa53a', tag: 'foe.volley', fill: 0.14 });
      if (f.buried) out.push({ kind: 'label', c: f.pos.clone().setY(f.pos.y + 0.8), text: 'buried: cut the fin / bomb / stomp', color: '#bfe9ff', tag: 'foe.buried' });
      if (f.phased) out.push({ kind: 'label', c: f.pos.clone().setY(f.pos.y + 0.8), text: 'shadow: blade passes', color: '#bfe9ff', tag: 'foe.phased' });
    }
    return out;
  }

  dispose() { for (const f of this.list.slice()) this.remove(f); this.group.removeFromParent(); this.warnEl?.remove(); this.reticle?.dispose(); this.blindEl?.remove(); this.shadePools?.dispose(); this.shocks = this.patches = null; this.hold = null; }
}
