import * as THREE from 'three';
import { makeMaterial, releaseMaterial } from './materials.js';
import { registerTarget } from './targets.js';
import { screened } from './wind-screens.js';
import { hazardAt } from './hazards.js';
import { workingsAt } from './workings.js';
import { Telegraph, inArea } from './temples/boss.js';
import { ChargeGlow, TELL, groundMark, poseK } from './telegraph.js';
import { strikeDamage, heartsOf, quarters, DAMAGE } from './resources.js';
import { game as sharedGame } from './game-state.js';
import { gainInk, INK_OF } from './ink.js';
import { ShadeBody, ShadePools } from './shade.js';
import { KINDS, NOTES, kindModel } from './foe-kinds.js';
import { guardKinds, templeKind } from './foe-worlds.js';
import { hitStop, kick, slowMo } from './feel.js';
import { LockReticle } from './lock-reticle.js';
import { TITLES } from './levels/names.js';
import { rumblePlay } from './rumble.js';
import { Rig, planLeg } from './motion-kit/rig.js';
import { PLANS } from './motion-kit/plans.js';
import { ARCHETYPES, ARCHETYPE_KINDS, ARCHETYPE_NOTES, BUILT, archetypeOfKind, parseKind, skinned } from './enemies/archetypes.js';
import { skinFor, skinOf, skinWorlds } from './enemies/skins.js';
import { archetypeModel } from './enemies/plans/index.js';
import { WORLDS, PLACED, worldArchetypes, packOf } from './foe-worlds.js';
import { CLIMB, HOP, ROUTE, PERCH, KNOCK, reachOf, findRoute, findPerch, hopAt, hopTime, knockedOff, knockedInto } from './foe-height.js';

// Foes (docs/systems/foes.md): the first things in the game that fight back.
//
// - **The enemy roster** (docs/design/enemy-roster.md): 21 archetypes, each in its world's skin
//   (src/enemies/archetypes.js, src/enemies/skins.js; who fights where: src/foe-worlds.js). Built ones run on their
//   own bodies (src/enemies/plans/), the others on an old kind's meanwhile. Wildlife (the crab, the lizard…) keeps
//   to itself until provoked (`calm`); the machines and the spirits come for you.
// - **Ink blots** gather in the wilds: loose ink and scribble that drift in from the margins of the
//   drawing, away from people, the ship and the cities. They compress, then lunge through a visible
//   strike and recover. The fluid blade cuts them back into ink; a shot or an ember
//   glob washes them too, stilling freezes them. Each one cut gives a third of the magic bar back (one unit).
// - **The makers' machines** stand in the temples' rooms: old constructs gone wrong, heavier, slower,
//   planting their feet and raising their arms before a committed slam. The blade breaks them (fluid and ember only stagger
//   them, stilling freezes them); broken, they stay broken (a flag per save).
//
// Their blows take hearts (an ordinary one half a heart: each attack's `damage`, docs/systems/foes.md), and
// none takes you from more than a heart to nothing in one blow (strikeDamage, as the guardians). The
// Enemies setting turns them all off; Home, the Lab, the References and the Atelier never have any.
//
//   const foes = new Foes({ scene, level, levelId, content, physics, player, tool, sound, npcs, settings, notice })
//   foes.update(dt, paused)            per frame
//   foes.list                          every foe alive in the world

/** Each kind's tuning. attack: its first strike (src/temples/boss.js inArea for the area); attacks: all it has
 *  (src/foe-kinds.js says what an attack may hold: a combo's `then`, a shockwave, a volley…). */
export const FOES = {
  blot: ARCHETYPE_KINDS.blot,   // (the ink blot, the teacher: src/enemies/archetypes.js, the spitting blot's spit folded in)
  machine: {
    name: 'makers’ machine', hp: 4, radius: 0.8, height: 1.0, speed: 2.1, sight: 13, giveUp: 14, reach: 2.6, heavy: true, metal: true, breaks: true,
    tone: '#e0703a', sound: 'machine', takes: { shoot: 0, fire: 0 },
    attacks: [
      { id: 'slam', shape: 'cone', range: 3.3, angle: 0.8, damage: 1, wind: 1.05, strike: 0.32, contact: 0.55, knock: 7, weight: 1.6 },
      // the ground slam: both arms high, crouched, a longer hold; then a ring of shock runs out over the floor (jump it)
      { id: 'quake', shape: 'ring', at: 'self', radius: 2.0, damage: 0.75, wind: 1.35, strike: 0.3, contact: 0.6, knock: 6, wave: { speed: 7, reach: 8, damage: 0.5, width: 0.55 } },
    ],
    recover: 1.5, cool: [1.4, 2.4], hit: 0.5,
  },
  // a person made of living shadow (src/shade.js): it walks up and cuts with a sword's swing, dripping as it goes
  shade: {
    name: 'shade', hp: 5, radius: 0.45, height: 1.15, speed: 3.0, sight: 18, giveUp: 40, reach: 2.3, clamber: true, tone: '#3b2a5c',
    attack: { shape: 'cone', range: 2.9, angle: 0.9, damage: 0.75, wind: 0.95, strike: 0.24, contact: 0.55 },
    recover: 1.1, cool: [1.2, 2.2], hit: 0.4,
  },
  ...KINDS,   // the old kinds, stand-ins for archetypes not built yet (src/foe-kinds.js)
  ...ARCHETYPE_KINDS,   // the built archetypes (src/enemies/archetypes.js): batches 1-3
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
/** What a pack is: the world's roster (src/foe-worlds.js packOf): the first, its own kind alone; then a lead and its fillers. */
export function packKinds(n, levelId, rng = Math.random) { return packOf(n, levelId, rng); }
const STILL = 3.5;   // s a stilling glob holds a foe
const PARRY_STUN = 2;   // s a perfect parry leaves it stunned
/** The Arena's waves (level.foes.waves: src/levels/arena.js), round and round; they come in this far out, this long after the last. */
// (the spitting blot, the blot swarm and the root stalker came here first; the bellows toad, the skitters and the root
// knot took their places in v1.12; the furnace brute and the crucible cart took the glass golem's and the slag walker's
// in v1.15, the ring drone the rust drone's, and the bell walker came in after the tripods)
export const WAVES = [['blot'], ['blot', 'blot', 'blot'], ['toad', 'blot'], Array(8).fill('skitter'), ['machine'], ['shade'], ['ray', 'ray'], ['toad', 'toad', 'machine'], ['shade', 'shade', 'blot'], ['machine', 'machine', 'blot', 'blot', 'ray'],
  // then the worlds' (the archetypes and their stand-ins: src/enemies/archetypes.js, src/foe-kinds.js)
  ['worm'], ['brute'], ['moth', 'moth', 'moth'], ['drone', 'drone'], ['rootknot', 'blot'], ['heron'], ['crab', 'crab'], ['cart'], ['hound', 'hound'], ['lizard', 'lizard'], ['tripod'], ['tripod', 'lizard', 'lizard'], ['bell'], ['brute', 'crab', 'drone', 'hound'], ['cart', 'drone', 'lizard']];
export const WAVE = { near: 10, far: 14, rest: 3 };
/** How many foes may wind up a strike at once (the others circle, waiting a turn); how far apart they keep. */
export const TURNS = { strikers: 2, apart: 0.3 };
/** Relics out in the wilds are guarded (placed, not by chance): a few blots gather round as you come near; cut down, they are gone for good. */
export const GUARDS = { near: 32, size: 2, ring: 3.5 };
/** A foe placed by hand (src/foe-worlds.js PLACED): it comes out as you come within `near` m, calm where it stands. */
export const POSTS = { near: 60 };
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
/**
 * Where a winding-up foe's warning marker goes, in the screen's -1..1 (x right, y up), or null for none: none
 * while it is on the screen and in sight (its body and its ring are the tell); on the screen but hidden behind
 * the world, over where it is; off the screen or behind the camera, at the edge on its side (straight behind:
 * at the bottom). px, py: its chest projected; ahead: in front of the camera.
 */
export function warnSpot(px, py, ahead, hidden = false) {
  const onScreen = ahead && Math.abs(px) < 0.9 && Math.abs(py) < 0.85;
  if (onScreen) return hidden ? { x: px, y: py, edge: false } : null;
  let x = ahead ? px : -px, y = ahead ? py : -py;
  if (!ahead && Math.hypot(x, y) < 0.2) y = -1;
  const k = 1 / Math.max(Math.abs(x) / 0.9, Math.abs(y) / 0.82, 1e-3);
  return { x: x * k, y: y * k, edge: true };
}
/** A buried ray winding up its burst swims to its ring: there by `arrive` of the wind-up, at most `max` m/s, within `stop` m. */
export const SWIM = { arrive: 0.85, max: 12, stop: 0.4 };
export const PHASE = { near: 3.2 };
/** The centipede's ring (Foes.corral): its body walls you in within `wall` m of it, unless you are `over` m over its back. */
export const RING = { wall: 0.95, over: 0.9 };
/** A sky ray ploughed into the ground by a perfect parry of its skim (onParry 'ground'): s it lies there, open. */
export const GROUNDED = 2.5;
/**
 * Batch 3 (v1.12): a toad that chokes on its glob (a shot in its swollen throat: s stunned); one the air cut met in its
 * leap (s on its back); a heron toppled by a charged cut at its legs (s down) or its bill knocked aside (s open: a
 * guard, a perfect parry); the spores a toad's glob leaves (s, m, how hard they slow you: m/s bled off a second).
 */
export const CHOKE = 2.2, LEAP_FLIP = 2.6, TOPPLE = 3, OPEN = { guard: 1.2, perfect: 2.6 };
export const SPORES = { life: 3, r: 1.4, slow: 7 };
/** Batch 4 (v1.15): a bell walker whose toll the bell-note whistle answered sits open this long (s), the clapper in reach. */
export const HUSH = 3;
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
 *   stunned. `cool`: s before the same working takes it again. A pendulum stilled (frosted over by a stilling
 *   glob, hanging there humming) is no blow: its frost takes a foe that touches it, held `frost` s (no harm, its
 *   eyes pale: stunned, so a cut lands double), and not again for `frost` + `cool` s (it walks out of it).
 */
export const HOVER = { max: 12, climb: 3, sink: 3 };
export const COVER = { near: 6, far: 10, dirs: 8, minCool: 0.8, hold: 2.6, gentle: 1.2, stay: 1.4, climb: 2.2, close: 3, out: 0.3 };
export const FALL = { gravity: 20, edge: 1.1, hard: 3.5, harder: 8, stun: 1.2, lost: 60 };
export const WORLD_HARM = { every: 0.6, spikes: 1, fire: 1, other: 1, shove: 5 };
export const WORKS = {
  updraft: { throw: 10, out: 3, tumble: 0.9, stun: 1.4, cool: 2 },
  gust: { heavy: 0.7, still: 1.1, hover: 1.2, light: 1.25 },
  swing: { knock: 9, up: 4, heavy: 0.75, stun: 1.2, cool: 1.5, frost: 3 },
};
const _hz = new THREE.Vector3(), _pb = new THREE.Vector3(), _fb = new THREE.Vector3(), _cs = new THREE.Vector3(), _cf = new THREE.Vector3();

/** A strike reaches the traveller only this close in height (m, its feet to the foe's): the hitbox overlay draws it (src/hitboxes.js). */
export const STRIKE_RISE = 1.6;
/** An attack that reaches you up or down a ledge: a lob lands at your feet, a step through the shadow comes out behind you. */
export const reachesUp = (a) => a.at === 'target' || a.at === 'behind';
/** A foe's target sphere (shots, the cone, the lock): its body's radius and a margin. The blade adds its own (fluid-blade.js BLADE_TOUCH). */
export const hurtRadius = (def) => def.radius + 0.15;
/** How near a charge (attack.sweep) must run to you to hit: half its lane's width (the hitbox overlay's lane is the ground it covers). */
export const sweepRadius = (a, def) => (a.width ? a.width / 2 : def.radius + 0.75);

/**
 * One foe's mind: idle at home (a slow drift round it), chase once you come into sight, wind up its
 * strike in reach (the telegraph), strike, recover, and go home if you lead it too far. Pure logic over
 * plain vectors: env { ground(x, y, z) → y or null (no footing), seen(from, to) → true when clear }.
 * update() returns the events of the frame: 'notice', 'warn', 'strike' { hit }, 'home'.
 */
export class Foe {
  constructor(kind, at, { rng = Math.random, id = null, templeOnly, skin = null, calm = false } = {}) {
    // a kind, or a kind in a world's skin ('crab@saltharbour': src/enemies/skins.js)
    const p = parseKind(kind);
    this.kind = p.kind; this.skin = p.skin ?? skin;
    if (!FOES[this.kind]) throw new Error(`Unknown enemy: ${kind}`);
    this.def = FOES[this.kind];
    this.archetype = archetypeOfKind(this.kind);
    this.moves = this.skin && this.archetype ? skinOf(this.archetype, this.skin)?.moves ?? [] : [];   // (its skin's own moves)
    this.templeOnly = templeOnly ?? this.kind === 'machine';
    this.id = id; this.rng = rng;
    // out in the wilds (calm: a pack, Foes.spawnPack) a kind with a calm (def.calm) keeps to it until provoked:
    // wildlife grazes, a machine patrols, a blot lies pooled; of a hunting kind, not every one hunts (calm.hunts).
    // Anywhere else (the Arena, a relic's guards, a temple, a test) it comes for you as it sees you.
    const C = this.def.calm;
    this.provoked = !(calm && C); this.wilds = calm;
    this.watcher = !this.provoked && C.hunts != null && rng() > C.hunts;
    this.farFor = 0; this.burstT = rng() * 2;
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
    // batch 2 (v1.9): a support's lanterns and the neighbours it wards (the jelly); the ward on this one, if any
    // ({ by, t }); the tail segments it has shed (the centipede); the ring it runs round you (attack.encircle)
    this.lanterns = this.def.lanterns ?? 0; this.wards = []; this.ward = null; this.allies = [];
    this.shed = 0; this.ring = null;
    // the world (v0.98): the height a hovering foe holds over its footing (HOVER), its hiding place (COVER),
    // a fall (FALL: { vy, top, base, hard }), a tumble up an updraft, and the hazards' and workings' rests
    this.over = 0; this.overV = 0; this.fallTop = null; this.youY = null;
    this.cover = null; this.hid = false;
    this.air = null; this.tumble = 0; this.tumbleTop = 0;
    this.hazCool = 0; this.workCool = { updraft: 0, swing: 0 };
    // over height (v1.4, src/foe-height.js): a hop up or down a ledge, the way it is following, how long it has
    // been stuck walking straight at you, the next plan; perched on the high ground; knocked by you (s), dazed (s)
    this.hop = null; this.route = null; this.stuck = 0; this.replan = 0; this.perchFor = 0; this.perched = null;   // (perched: the height it holds)
    this.waiting = false; this.holding = null; this.knockedBy = 0; this.dazed = 0;
    // batch 3 (v1.12): toppled and open (s: the heron), the heap it rides in ({ on, i, climb }: a skitter), running from
    // you (scatter, s: a flock), how long you have stood in its flock (lingerT), where a leap set off, its flock near it
    this.toppled = 0; this.open = 0; this.riding = null; this.scatter = 0; this.lingerT = 0; this.leapFrom = null; this.mates = 0;
    // batch 4 (v1.15): its tracks jammed by a bomb (s: the cart can't turn)
    this.jammed = 0;
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

  /**
   * The attacks it may begin at d metres: not a combo's follow-up, d within each one's [min, max]; a skin's own
   * move only in that skin (skins), one kept for when it is hurt (below: a share of its health), a tail whip only
   * with you behind it (rear), a flank bite only from behind you (flank).
   */
  attacksAt(d, dy = 0) {
    const D = this.def;
    return D.attacks.filter((a) => !a.chain && (a.ward || a.mend || (d >= (a.min ?? 0) && d <= (a.max ?? D.reach) + 1e-6 && (dy < STRIKE_RISE || reachesUp(a))))
      && (!a.skins || this.moves.includes(a.id)) && (a.below == null || this.hp <= D.hp * a.below + 1e-9)
      && (!a.rear || this.behind) && (!a.flank || this.unseen)
      && (!a.up || !this.buried) && (!a.surface || !D.burrow || this.buried)   // (a burrower: some moves only up, its burst only from under)
      && (!(a.ward || a.mend) || !!this.allyFor(a))                              // (a support's move needs a neighbour to take it)
      && (!a.pile || this.mates >= 2));                                           // (a heap needs two of its flock to climb on)
  }
  /** The neighbour a support's move (attack.ward / attack.mend) would go to, or null: one not yet warded while a lantern is free; one hurt. */
  allyFor(a) {
    const near = (x) => x.alive && x.pos.distanceTo(this.pos) <= (a.ward ?? a.mend).range;
    if (a.ward) return (this.wards?.length ?? 0) < (this.lanterns ?? 0) ? (this.allies ?? []).find((x) => near(x) && !(x.ward?.t > 0)) ?? null : null;
    if (a.mend) return (this.allies ?? []).filter((x) => near(x) && x.hp < x.def.hp - 0.5).sort((p, q) => p.hp / p.def.hp - q.hp / q.def.hp)[0] ?? null;
    return null;
  }
  /** One of them, by weight (the one it just used less likely). dy: your height off its level (m): out of a blow's reach, only a lob. */
  chooseAttack(d, dy = 0) {
    const can = this.attacksAt(d, dy);
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
    this.cover = null; this.hid = false; this.waiting = false; this.holding = null;   // (it may hide again after this strike)
    this.ring = null;
    this.allyTarget = a.ward || a.mend ? this.allyFor(a) : null;   // (a support's move: to a neighbour)
    this.attackH = this.heading + (a.back ? Math.PI : 0);   // (a tail whip: behind it)
    if (this.buried && !a.surface) this.surfaced();   // (a ray comes up out of the sand to glide)
    if (this.def.keep) this.retreat = PRESSURE.retreat;   // (it struck: it may back off again after)
    this.farFor = 0;
    this.placeArea(a, P);
  }
  /** Where attack a lands: a ring ahead (a lunge), round it, under you (lobbed), past you (a step through the shadow). */
  placeArea(a, P) {
    if (a.leap) {
      // a leap (the toad's belly flop): onto where you stand, as far as it can jump; it turns to it
      const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz) || 1, r = Math.min(d, a.range ?? d);
      this.attackAt.set(this.pos.x + (dx / d) * r, P.pos.y, this.pos.z + (dz / d) * r);
      this.heading = this.attackH = Math.atan2(dx, dz);
      this.attackPts = null;
      return;
    }
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
  /**
   * A buried ray winding up its burst swims under the sand to where its ring is, arriving by SWIM.arrive of the
   * wind-up, so the fin is seen racing at you before it comes up (before, it sat still and sank its fin, and
   * burst up out of nowhere: playtest 2026-10-08). Walls and drops stop it as any step; it still comes up there.
   */
  swimTo(at, wind, dt, env) {
    const dx = at.x - this.pos.x, dz = at.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < SWIM.stop) return;
    const left = Math.max(dt, SWIM.arrive * wind - this.timer);
    const m = Math.min(d - SWIM.stop * 0.5, Math.min(SWIM.max, d / left) * dt);
    if (m > 0) this.step(dx / d * m, dz / d * m, env);
    this.heading = Math.atan2(dx, dz);
  }
  /** Up out of the sand (a dune ray): it stays up a while, to be fought. */
  surfaced() { this.buried = false; this.upFor = BURROW.up; }
  /**
   * The centipede's ring (attack.encircle): through the wind-up it spirals round where you stood (attackAt), from its
   * own distance (at most r0) in to r1, at `speed` × its own, its body following its head round into a ring
   * (src/enemies/plans/centipede.js); Foes.corral keeps you inside while it closes.
   */
  encircle(a, wind, dt, env) {
    const E = a.encircle, c = this.attackAt;
    if (!this.ring) {
      const dx = this.pos.x - c.x, dz = this.pos.z - c.z, r = Math.hypot(dx, dz);
      this.ring = { ang: Math.atan2(dx, dz), r0: Math.max(E.r1 + 0.5, Math.min(E.r0, r || E.r0)), dir: this.rng() < 0.5 ? -1 : 1, r: r || E.r0 };
    }
    const R = this.ring, k = Math.min(1, this.timer / wind);
    R.r = THREE.MathUtils.lerp(R.r0, E.r1, THREE.MathUtils.smoothstep(k, 0.15, 0.95));
    R.ang += R.dir * ((this.def.speed * E.speed) / Math.max(R.r, 0.5)) * dt;
    const tx = c.x + Math.sin(R.ang) * R.r, tz = c.z + Math.cos(R.ang) * R.r, mx = tx - this.pos.x, mz = tz - this.pos.z;
    if (Math.hypot(mx, mz) > 1e-4) { this.step(mx, mz, env); this.heading = Math.atan2(mx, mz); }
  }
  /** Its ward ends (run out, its jelly gone, or the lantern popped). */
  unward() { const J = this.ward?.by; this.ward = null; if (J) J.wards = J.wards.filter((x) => x !== this); }
  /** A shot or the boomerang pops one of a support's lanterns: the lit one first, and the ward it held. True when one popped. */
  pop() {
    if (!(this.lanterns > 0)) return false;
    this.lanterns--;
    if (this.wards.length) this.wards.at(-1).unward();   // (the lit one, warding, is the one you hit)
    while (this.wards.length > this.lanterns) this.wards.at(-1).unward();
    this.flash = 1;
    return true;
  }
  /** Done with attack a: its follow-up straight away (a combo), else recover. */
  next(a, P, ev) {
    const n = a.then ? attackOf(this.kind, a.then) : null;
    if (n && !P.dead && !P.down) { this.beginWind(n, P); ev.push('warn'); return; }
    if (a.dives && this.def.burrow) { this.buried = true; this.upFor = 0; }   // (the worm's dive: back under the sand)
    if (a.leap) { this.alt = 0; this.leapFrom = null; }                       // (down from its leap)
    this.state = 'recover'; this.timer = a.recover ?? this.def.recover; this.k = 0; this.reel = null;
    if (a.opens) { this.open = a.opens; this.timer = Math.max(this.timer, a.opens); }   // (the bell's drop: it tips up open toward you)
  }
  /** The bell-note whistle answered its toll (attack.whistle): it chokes, and sits open a while (HUSH). True when it did. */
  hush() {
    if (!this.alive || this.state !== 'wind' || !this.atk?.whistle) return false;
    this.state = 'recover'; this.timer = HUSH; this.open = HUSH; this.k = 0; this.letGo = true; this.flash = 1; this.reel = 'hushed';
    return true;
  }
  /** An instant attack lands as its wind-up ends: a lob, a flash, a ray bursting up, a hound stepping out of the shadow. */
  resolve(a, P, playerOk, ev, env) {
    if (a.blink || a.surface) {
      const y = env.ground ? env.ground(this.attackAt.x, this.attackAt.y + 1.2, this.attackAt.z) : this.attackAt.y;
      if (y != null) this.pos.set(this.attackAt.x, y, this.attackAt.z);
      if (a.surface) this.surfaced();
      this.heading = this.attackH = Math.atan2(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    }
    // a support's move on its neighbour (the jelly's ward, its mend): Foes.support does the rest
    if ((a.ward || a.mend) && this.allyTarget?.alive) ev.push({ type: a.ward ? 'ward' : 'mend', target: this.allyTarget, atk: a });
    if (a.damage > 0 || a.slip || a.blur) {
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
    for (const k of ['flipped', 'lit', 'crust', 'sleep', 'low', 'knockedBy', 'dazed', 'toppled', 'open', 'scatter', 'jammed']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    // carried in a heap (a skitter climbing its flock-mate for the pile): its mind waits until the heap topples or breaks
    if (this.riding) { this.ride(dt); return ev; }
    // a jelly's ward on it runs out, or ends with the jelly (its lantern popped: Foe.pop)
    if (this.ward && ((this.ward.t -= dt) <= 0 || !this.ward.by.alive || this.ward.by.dead !== undefined)) this.unward();
    if (this.wards.length) this.wards = this.wards.filter((x) => x.alive && x.ward?.by === this);
    // the world's hazards and workings it is in (v0.98: knocked into spines, a gust, an updraft, a pendulum)
    this.feelWorld(dt, env, ev);
    // up or down a ledge: crouched, then in the air (src/foe-height.js HOP); its mind waits until it lands
    if (this.hop) { this.leap(dt, ev); return ev; }
    // a shove's slide eases out (a shove may carry it off a ledge, or into a hazard: step's `shoved`)
    if (this.vel.lengthSq() > 1e-4) {
      this.step(this.vel.x * dt, this.vel.z * dt, env, this.vel.lengthSq() > 1);
      this.vel.multiplyScalar(Math.exp(-(this.air ? 1 : 6) * dt));
    }
    // your blow or push carried it into deep water: swept away (KNOCK.deep)
    if (!this.air && !D.hover && this.knockedBy > 0 && this.sweptBy(env, ev)) return ev;
    // knocked off a ledge, thrown up: it falls, and its mind waits until it lands
    if (this.air) { this.fall(dt, env, ev); return ev; }
    // a flyer keeps to its height, low only while it recovers from a dive (and falls when stilled)
    // (knocked low by a cut, it drops fast and stays within the blade's reach a while)
    if (D.hover) {
      // (a support stays up after its moves; it comes down only to mend, within reach: the jelly)
      const mending = this.state === 'wind' && this.atk?.mend, low = this.state === 'recover' && !D.support;
      this.alt += ((this.stunned > 0 ? 0.3 : mending ? 1.1 : this.low > 0 || low ? 0.35 : D.hover) - this.alt) * (1 - Math.exp(-(this.low > 0 ? 6 : low ? 1.2 : mending ? 2.5 : 3) * dt));
      this.fly(dt, P, env, ev);
      if (!this.alive) return ev;
    }
    if (this.stunned > 0) { this.stunned -= dt; return ev; }
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    this.dist = d;
    // where it stands to you: you behind it (a tail whip), it behind you, out of your sight (a flank bite)
    if (d > 1e-4) {
      this.behind = (dx * Math.sin(this.heading) + dz * Math.cos(this.heading)) / d < -0.35;
      const ph = P.heading ?? 0;
      this.unseen = -(dx * Math.sin(ph) + dz * Math.cos(ph)) / d < -0.2;
    }
    const away = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);
    // lost: gone where it can't follow (riding, far above or below its level, fallen); down: knocked over, about to rise
    const lost = P.dead || !!P.ride || Math.abs(P.pos.y - this.level) >= 6, down = !lost && !!P.down;
    const playerOk = !lost && !down;
    // led too far from home: only once you have left as well (you still fighting it there, it stays)
    const youLeft = Math.hypot(P.pos.x - this.home.x, P.pos.z - this.home.z) > D.giveUp + PRESSURE.leave;
    switch (this.state) {
      case 'idle': {
        // its calm (def.calm): wildlife grazes, basks or lies about and fights only when provoked (close in, hurt,
        // or one of its own provoked near it); a machine patrols its round; a blot lies pooled until you come near
        if (D.calm && !this.provoked) { if (this.calmly(dt, P, d, env)) { this.state = 'chase'; ev.push('notice'); } break; }
        this.wander += dt * 0.4;
        const tx = this.home.x + Math.sin(this.wander) * 2.5, tz = this.home.z + Math.cos(this.wander * 0.7) * 2.5;
        this.walkTo(tx, tz, D.speed * 0.3, dt, env);
        if (playerOk && d < D.sight && (env.seen?.(this.chest, P.pos) ?? true)) { this.state = 'chase'; ev.push('notice'); }
        break;
      }
      case 'chase': {
        if (lost || (away > D.giveUp && youLeft) || d > D.sight * 2) { this.state = 'home'; ev.push('home'); break; }
        if (this.scatter > 0 && d > 1e-4) { this.step(-dx / d * D.speed * dt, -dz / d * D.speed * dt, env); this.face(-dx, -dz, dt, 10); break; }   // (a flock runs from an ember, then regroups)
        this.face(dx, dz, dt, 8);
        if (down) { this.circle(P, D.reach + PRESSURE.hold, dt, env); break; }   // (you are down: it waits round you, facing you, for you to rise)
        // a support (the jelly) keeps over its neighbours, a little toward you, and works on them; alone, it comes for you
        if (D.support) {
          const ally = this.allies.filter((x) => x.alive && x.dead === undefined).sort((p, q) => p.pos.distanceTo(this.pos) - q.pos.distanceTo(this.pos))[0];
          if (ally) {
            const a = this.cool === 0 && (env.mayStrike?.(this) ?? true) ? this.chooseAttack(d, Math.abs(P.pos.y - this.level)) : null;
            if (a) { this.beginWind(a, P); ev.push('warn'); break; }
            const ax = P.pos.x - ally.pos.x, az = P.pos.z - ally.pos.z, al = Math.hypot(ax, az) || 1;
            this.walkTo(ally.pos.x + (ax / al) * 1.4, ally.pos.z + (az / al) * 1.4, D.speed, dt, env, 0.5);
            break;
          }
        }
        if (D.hover && !D.support && this.hide(dt, P, d, env)) break;   // (between strikes, a hovering foe hides behind the world: COVER)
        // over height (v1.4): a walker finds its way up and down to you; out of a blow's reach it doesn't swing at air
        const walker = !D.hover, dy = Math.abs(P.pos.y - this.level), high = dy >= STRIKE_RISE;
        if (walker && D.perch) this.perchUp(P, d, dt, env);   // (a lobber, the toad, climbs to the high ground and holds it)
        if (this.route?.perch && !(this.cool === 0 && d <= D.reach && this.attacksAt(d, dy).length)) { this.followRoute(dt, env); break; }
        // an attack it may begin from beyond its reach once it has chased you a while (the blot's spit)
        this.farFor = d > D.reach ? this.farFor + dt : 0;
        if (this.cool === 0 && d > D.reach && this.farFor > 0 && this.farAttack(d, dy) && (env.mayStrike?.(this) ?? true)) { this.beginWind(this.farAttack(d, dy), P); ev.push('warn'); this.route = null; break; }
        // a pair's flanker circles round behind you first (the lizards)
        if (D.flanks && this.flanker && walker && !this.unseen && d > 1.5 && d < D.sight) {
          const ph = P.heading ?? 0, bx = P.pos.x - Math.sin(ph) * 3.4, bz = P.pos.z - Math.cos(ph) * 3.4;
          this.walkTo(bx, bz, D.speed, dt, env, 0.5); this.face(dx, dz, dt, 6);
          break;
        }
        // a flock (the skitters) rings you between darts, waiting its turn at flock.ring m
        if (D.flock && walker && d < D.reach + 2 && (this.cool > 0 || !(env.mayStrike?.(this) ?? true))) {
          if (d < D.flock.ring - 0.8 && d > 1e-4) { this.step(-dx / d * D.speed * dt, -dz / d * D.speed * dt, env); this.face(dx, dz, dt, 8); }   // (back out to the ring after a dart)
          else this.circle(P, D.flock.ring, dt, env);
          break;
        }
        if (D.keep && d < D.keep && d > 1e-4 && this.retreat > 0) {
          // too close: it backs off a little, then stands its ground (PRESSURE.retreat), no endless chase
          this.retreat = Math.max(0, this.retreat - dt);
          this.step(-dx / d * D.speed * 0.7 * dt, -dz / d * D.speed * 0.7 * dt, env); this.face(dx, dz, dt, 8);
        }
        else if (d > D.reach || (high && !this.attacksAt(d, dy).length)) {
          if (D.burst && this.halted(dt)) break;   // (it moves in bursts, freezing between: the crab's scuttle)
          if (walker) this.approach(P, dt, env, high ? D.radius + 0.6 : D.reach * 0.8);
          else this.walkTo(P.pos.x, P.pos.z, D.speed, dt, env, D.reach * 0.8);
        }
        else if (this.cool === 0 && !(env.mayStrike?.(this) ?? true)) {
          // another is striking: circle round at a step's distance, waiting a turn
          this.circle(P, D.reach + 1.4, dt, env);
        } else if (this.cool === 0) {
          // one of its attacks that fits the distance (none: it closes in)
          const a = this.chooseAttack(d, dy);
          if (a) { this.beginWind(a, P); ev.push('warn'); this.route = null; }
          else if (walker) this.approach(P, dt, env, D.radius + 0.6);
          // a flyer too close for any of its moves (a sky ray past you after a skim) wheels off to come round again
          else if (D.hover && d < Math.min(...D.attacks.filter((x) => !x.chain && !x.ward && !x.mend && !x.rear && (!x.skins || this.moves.includes(x.id))).map((x) => x.min ?? 0)) && d > 1e-4) { this.step(-dx / d * D.speed * dt, -dz / d * D.speed * dt, env); }
          else this.walkTo(P.pos.x, P.pos.z, D.speed, dt, env, D.radius + 0.6);
        }
        break;
      }
      case 'wind': {
        const a = this.atk ?? D.attack;
        const wind = a.wind * (env.slow?.() ?? 1);
        this.timer += dt; this.k = Math.min(1, this.timer / wind);
        if (a.track && this.k < a.track && playerOk) {
          // the aim follows you, then holds: a lob's mark, a searchlight's beam (a lane turns the foe with it)
          if (a.shape === 'lane' && !a.at) this.heading = this.attackH = Math.atan2(dx, dz);
          this.placeArea(a, P);
        }
        if (a.surface && this.buried) this.swimTo(this.attackAt, wind, dt, env);   // (its fin is seen coming at you)
        if (a.encircle) this.encircle(a, wind, dt, env);                         // (the centipede runs its ring round you)
        if (a.mend && this.allyTarget?.alive) { const T = this.allyTarget.pos; this.walkTo(T.x, T.z, D.speed * 1.5, dt, env, 0.3); }   // (down over the hurt one)
        if (a.reverse && this.k < 0.8) { const b = (a.reverse / (wind * 0.8)) * dt; this.step(-Math.sin(this.heading) * b, -Math.cos(this.heading) * b, env); }   // (the cart backs up before its ram)
        if (this.timer >= wind) {
          if (a.instant || a.at === 'target') this.resolve(a, P, playerOk, ev, env);
          else { this.state = 'strike'; this.timer = 0; this.k = 0; this.contacted = false; if (a.leap) this.leapFrom = this.pos.clone(); }
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
          const moved = this.step(Math.sin(this.attackH) * d, Math.cos(this.attackH) * d, env);
          // (a charge that a wall stops: it stalls there, stunned, open: the cart's ram)
          if (!moved && a.stall && d > 1e-4 && this.k > 0.1) { this.state = 'recover'; this.timer = a.stall; this.stunned = a.stall; this.k = 0; this.reel = 'stalled'; ev.push({ type: 'stalled' }); break; }
        }
        if (a.dive) this.alt = THREE.MathUtils.lerp(D.hover, 0.35, this.k);
        if (a.leap && this.leapFrom) {
          // the leap: across to where you stood, up in an arc (its body, its target: alt), down on the spot
          const tx = THREE.MathUtils.lerp(this.leapFrom.x, this.attackAt.x, this.k), tz = THREE.MathUtils.lerp(this.leapFrom.z, this.attackAt.z, this.k);
          this.step(tx - this.pos.x, tz - this.pos.z, env, true);
          this.alt = Math.sin(Math.PI * this.k) * a.leap.height;
        }
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
        this.perched = null; this.route = null;
        this.walkTo(this.home.x, this.home.z, D.speed * 0.8, dt, env, 0.5);
        this.hp = Math.min(D.hp, this.hp + dt * 0.5);
        if (away < 1) { this.state = 'idle'; if (D.calm?.wild && this.wilds) this.provoked = false; }   // (home, wildlife calms down again)
        else if (playerOk && d < (D.calm && !this.provoked ? D.calm.provoke : D.sight * 0.6) && away < D.giveUp * 0.8) this.state = 'chase';
        break;
      }
    }
    return ev;
  }

  /**
   * Idle, calm (def.calm, src/enemies/archetypes.js): grazing or wading about its home, basking or lying still with
   * a shift now and then, patrolling a wide round (a machine), pooled (a blot). A shy one backs off as you come
   * near; a watcher (of a kind where not every one hunts) turns to watch you go. True when it is provoked into a
   * fight: you came within `provoke` m in sight, or it was provoked (hurt, or one of its own near it: Foes.alarm).
   */
  calmly(dt, P, d, env) {
    const D = this.def, C = D.calm, still = C.mode === 'bask' || C.mode === 'lie' || C.mode === 'pool' || C.mode === 'sit';
    const lost = P.dead || !!P.ride || Math.abs(P.pos.y - this.level) >= 6 || !!P.down;
    // a flock (the skitters): run at it and it scatters in a ripple, each away from you, then drifts home again
    if (C.mode === 'flock' && !lost && d < C.shy && d > 1e-4) {
      const vx = P.vel?.x ?? 0, vz = P.vel?.z ?? 0, sp = Math.hypot(vx, vz);
      if (sp > 3 && (vx * (this.pos.x - P.pos.x) + vz * (this.pos.z - P.pos.z)) / (sp * d) > 0.3) this.scatter = Math.max(this.scatter, 0.8 + this.rng() * 0.6);
    }
    if (this.scatter > 0 && d > 1e-4) {
      this.step(-(P.pos.x - this.pos.x) / d * D.speed * dt, -(P.pos.z - this.pos.z) / d * D.speed * dt, env);
      this.face(this.pos.x - P.pos.x, this.pos.z - P.pos.z, dt, 10);
    } else if (C.shy && C.mode !== 'flock' && !this.provoked && !lost && d < C.shy && d > 1e-4) {
      // backs away from you, facing you, into its crevice
      this.step(-(P.pos.x - this.pos.x) / d * D.speed * 0.35 * dt, -(P.pos.z - this.pos.z) / d * D.speed * 0.35 * dt, env);
      this.face(P.pos.x - this.pos.x, P.pos.z - this.pos.z, dt, 5);
    } else if (this.watcher && !lost && d < D.sight) this.face(P.pos.x - this.pos.x, P.pos.z - this.pos.z, dt, 3);   // (stands and watches you go)
    else if (C.mode !== 'coil' && C.mode !== 'root' && C.mode !== 'stand' && C.mode !== 'toll') {   // (coiled, a centipede suns where it lies; a root knot stands rooted; a brute stands where it stopped working, a bell in its square)
      // circling (a ray in the thermals, a moth round its lamp: round and round), drifting (a jelly with the wind),
      // wading (a heron, slow and wide), a flock grazing close round its home
      const round = C.mode === 'circle', drift = C.mode === 'drift', wade = C.mode === 'wade';
      const patrol = C.mode === 'patrol' || C.mode === 'trundle';   // (a machine's old round: a tripod's, a cart's between the furnaces)
      this.wander += dt * (still ? 0.12 : patrol ? 0.25 : round ? 0.5 : drift ? 0.08 : wade ? 0.09 : 0.4);
      const R = patrol ? C.round ?? 7 : still ? 0.8 : round ? 5 : drift ? 4 : wade ? 3.5 : 2.5;
      const tx = this.home.x + Math.sin(this.wander) * R, tz = this.home.z + Math.cos(this.wander * (patrol || round ? 1 : 0.7)) * R;
      this.walkTo(tx, tz, D.speed * (still ? 0.12 : patrol ? 0.35 : round ? 0.6 : drift ? 0.15 : wade ? 0.18 : 0.25), dt, env);
    }
    if (lost) return false;
    if (this.provoked) return true;
    if (this.watcher) return false;
    if (d < C.provoke && (env.seen?.(this.chest, P.pos) ?? true)) {
      // (a flock fights only if you stay in the middle of it a while: calm.linger)
      if (C.linger && (this.lingerT += dt) < C.linger) return false;
      this.provoked = true; return true;
    }
    this.lingerT = 0;
    return false;
  }

  /**
   * Carried in a heap (attack.pile, Foes.pile): it climbs onto the one under it (its model lifts it by its place in the
   * heap) and holds on while that one winds up; the heap topples (thrown forward) or breaks (scattered), and it is off.
   */
  ride(dt) {
    const R = this.riding, B = R.on;
    if (!(B.alive && B.dead === undefined && B.state === 'wind' && B.atk?.pile)) { this.dismount(B.alive && B.state === 'strike' && !!B.atk?.pile); return; }
    R.climb = Math.min(1, R.climb + dt / 0.45);
    const k = Math.min(1, dt * 9), a = B.heading + R.i * 2.4;
    this.pos.x += (B.pos.x + Math.sin(a) * 0.14 - this.pos.x) * k; this.pos.z += (B.pos.z + Math.cos(a) * 0.14 - this.pos.z) * k; this.pos.y = B.pos.y;
    this.heading = B.heading + Math.sin(R.i * 1.7) * 0.4; this.state = 'chase'; this.k = 0;
  }
  /** Off the heap: thrown forward as it topples onto you, or tumbled off to the sides as it breaks. */
  dismount(thrown) {
    const B = this.riding.on, a = thrown ? B.heading : B.heading + Math.PI / 2 * (this.riding.i % 2 ? 1 : -1);
    this.riding = null; this.provoked = true;
    this.vel.set(Math.sin(a), 0, Math.cos(a)).multiplyScalar(thrown ? 4.5 : 3);
    this.state = 'recover'; this.timer = thrown ? 0.7 : 0.5; this.k = 0;
  }

  /** It moves in bursts (def.burst [go, stop] s): true while it is frozen between two (the crab's scuttle). */
  halted(dt) {
    const [go, stop] = this.def.burst;
    this.burstT = (this.burstT + dt) % (go + stop);
    return this.burstT > go;
  }

  /** An attack it may begin from beyond its reach (attack.far: once it has chased you that long, the blot's spit), or null. */
  farAttack(d, dy) {
    const can = this.attacksAt(d, dy).filter((a) => a.far && this.farFor >= a.far);
    return can[0] ?? null;
  }

  /** Round you at r m, a slow step to one side, facing you: waiting a turn, or for you to get up. */
  circle(P, r, dt, env) {
    const a = Math.atan2(this.pos.x - P.pos.x, this.pos.z - P.pos.z) + dt * 0.6 * (this.side ??= this.rng() < 0.5 ? -1 : 1);
    this.walkTo(P.pos.x + Math.sin(a) * r, P.pos.z + Math.cos(a) * r, this.def.speed * 0.5, dt, env);
    this.face(P.pos.x - this.pos.x, P.pos.z - this.pos.z, dt, 8);
  }

  /**
   * A walker on its way to you over the world's height (src/foe-height.js): straight at you on your level, else
   * (you up a ledge or down off one, or stuck against something) along a route it plans over a small grid,
   * walking steps, clambering ledges and hopping down drops it can take; no way, it holds off (holdOff).
   */
  approach(P, dt, env, stopAt) {
    const D = this.def, R = this.route;
    this.replan = Math.max(0, this.replan - dt);
    if (R && !R.perch && Math.hypot(P.pos.x - R.goal.x, P.pos.z - R.goal.z) < ROUTE.drift && Math.abs(P.pos.y - R.goal.y) < 1) { this.followRoute(dt, env); return; }
    this.route = null;
    if (Math.abs(P.pos.y - this.pos.y) <= ROUTE.flat && this.stuck < ROUTE.stuck) {
      // on your level: straight at you, as ever; getting nowhere for a while (a wall, a gap), it looks for a way
      const was = _cs.copy(this.pos), want = Math.min(D.speed * dt, Math.max(0, Math.hypot(P.pos.x - was.x, P.pos.z - was.z) - stopAt));
      const wx = was.x, wz = was.z;
      this.walkTo(P.pos.x, P.pos.z, D.speed, dt, env, stopAt);
      const got = Math.hypot(this.pos.x - wx, this.pos.z - wz);
      this.stuck = want > 1e-4 && got < want * 0.3 ? this.stuck + dt : Math.max(0, this.stuck - dt * 2);
      this.waiting = false; this.holding = null;
      return;
    }
    if (this.replan === 0 && env.ground) {
      this.replan = ROUTE.every;
      const pts = findRoute(this.pos, P.pos, env, reachOf(D), { stopAt, rise: STRIKE_RISE - 0.4, canStep: env.canStep, blocked: (x, y, z) => this.offRoute(x, z) || this.refuses(x, y, z, env) });
      if (pts?.length) { this.route = { pts, i: 0, goal: P.pos.clone(), t: 0 }; this.stuck = 0; this.waiting = false; this.holding = null; this.followRoute(dt, env); return; }
      this.stuck = 0;
      this.waiting = Math.abs(P.pos.y - this.pos.y) > ROUTE.flat;   // (no way to you: it waits it out)
    }
    if (this.waiting) this.holdOff(P, dt, env);
    else this.walkTo(P.pos.x, P.pos.z, D.speed, dt, env, stopAt);
  }

  /** On along its route: a walk to the next cell, or a hop (a clamber up, a drop down) when that is the way. */
  followRoute(dt, env) {
    const R = this.route, w = R?.pts[R.i];
    if (!w) { this.route = null; return; }
    if (w.how === 'clamber' || w.how === 'drop') {
      this.hop = { from: this.pos.clone(), to: new THREE.Vector3(w.x, w.y, w.z), t: 0, how: w.how, air: hopTime(w.y - this.pos.y) };
      R.i++; R.t = 0;
      if (R.i >= R.pts.length) this.route = null;
      return;
    }
    const bx = this.pos.x, bz = this.pos.z;
    this.walkTo(w.x, w.z, this.def.speed, dt, env);
    R.t = Math.hypot(this.pos.x - bx, this.pos.z - bz) < this.def.speed * dt * 0.3 ? R.t + dt : 0;
    // there (or as near as its body lets it, held off by the wall at a ledge's foot: the hop goes from here)
    const near = Math.hypot(this.pos.x - w.x, this.pos.z - w.z), next = R.pts[R.i + 1];
    if (near < 0.15 || (R.t > 0.15 && near < this.def.radius + 0.35 && (next?.how === 'clamber' || next?.how === 'drop'))) {
      // there, but not at the height the plan had (a cell on an edge): a cell to keep off, and a new plan
      if (Math.abs(this.pos.y - w.y) > 0.5) { this.markBad(w); this.route = null; this.replan = 0; this.perchFor = 0; return; }
      R.i++; R.t = 0;
    }
    if (R.t > ROUTE.stuck) { this.markBad(w); this.route = null; this.replan = Math.min(this.replan, 0.3); return; }   // (blocked on the way: keep off that cell, plan again)
    if (R.i >= R.pts.length) this.route = null;
  }

  /** A cell a route led it to that wasn't as planned (followRoute): kept out of its next plans. */
  offRoute(x, z) { return !!this.badCells?.includes(`${Math.round(x * 4)},${Math.round(z * 4)}`); }
  markBad(w) { (this.badCells ??= []).push(`${Math.round(w.x * 4)},${Math.round(w.z * 4)}`); if (this.badCells.length > 12) this.badCells.shift(); }

  /** Up or down a ledge (HOP): crouched first (the tell), then the arc; a soft landing ('hop'). */
  leap(dt, ev) {
    const H = this.hop;
    H.t += dt;
    this.face(H.to.x - H.from.x, H.to.z - H.from.z, dt, 10);
    if (H.t < HOP.crouch) return;
    const u = Math.min(1, (H.t - HOP.crouch) / H.air);
    hopAt(H.from, H.to, u, this.pos);
    if (u >= 1) { this.pos.copy(H.to); this.hop = null; ev.push({ type: 'hop', how: H.how, h: H.to.y - H.from.y }); }
  }

  /** Struck in the middle of a hop: crouched, it stays where it is; in the air, it falls from there. */
  knockOutOfHop() {
    const H = this.hop;
    this.hop = null; this.route = null;
    if (H.t <= HOP.crouch) { this.pos.copy(H.from); return; }
    this.air = { vy: 0, top: this.pos.y, base: Math.min(H.from.y, H.to.y), hard: false, knocked: this.knockedBy > 0 };
  }

  /** It can't get to you: it holds off below, ROUTE.hold m out, pacing slowly and watching you, never against the wall. */
  holdOff(P, dt, env) {
    // (on the side it came from, swaying a little either way: pacing, not walking round to the ledge's far side)
    const H = (this.holding ??= { a: Math.atan2(this.pos.x - P.pos.x, this.pos.z - P.pos.z), t: 0 });
    H.t += dt;
    const a = H.a + Math.sin(H.t * 0.6) * 0.3;
    this.walkTo(P.pos.x + Math.sin(a) * ROUTE.hold, P.pos.z + Math.cos(a) * ROUTE.hold, this.def.speed * 0.45, dt, env);
    this.face(P.pos.x - this.pos.x, P.pos.z - this.pos.z, dt, 8);
  }

  /**
   * A perching kind (the spitting blot, `perch`): over you by PERCH.rise it is perched (it won't step down off
   * it: step); else every PERCH.every s it looks for the high ground near it (findPerch) and walks up there.
   */
  perchUp(P, d, dt, env) {
    const D = this.def;
    this.perched = this.pos.y - P.pos.y >= PERCH.rise - 0.3 && d <= D.reach ? this.pos.y : null;   // (you out of its reach: it comes down after you)
    if (this.route?.perch) { if (Math.hypot(P.pos.x - this.route.goal.x, P.pos.z - this.route.goal.z) > PERCH.far * 0.4) this.route = null; return; }
    if (this.perched != null) return;
    this.perchFor = Math.max(0, this.perchFor - dt);
    if (this.perchFor > 0 || !env.ground || d > D.sight) return;
    this.perchFor = PERCH.every;
    const pts = findPerch(this.pos, P.pos, env, { keep: D.keep ?? 4, reach: D.reach, height: D.height, canStep: env.canStep, blocked: (x, y, z) => this.offRoute(x, z) || this.refuses(x, y, z, env) });
    if (pts?.length) { this.route = { pts, i: 0, goal: P.pos.clone(), t: 0, perch: true }; }
  }

  /** Its strike was blocked: it reels back, open a moment longer than after a strike. */
  staggered(perfect = false) {
    if (!this.alive) return;
    this.state = 'recover'; this.timer = this.def.recover * (perfect ? 1.8 : 0.65); this.k = 0; this.flash = 0.8; this.reel = perfect ? 'parried' : 'blocked';   // (reel: why it recovers, for the hitbox overlay's label)
    this.recoil = 1; this.heavyRecoil = perfect; this.recoilDir.set(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    if (!this.def.rooted) this.vel.set(-Math.sin(this.heading), 0, -Math.cos(this.heading)).multiplyScalar(this.def.heavy ? 2 : 5);   // (a root knot is rooted)
  }

  /** A blow travelling against its face (dir: the blow's way): what a shell turns. */
  frontal(dir) { return dir.x * Math.sin(this.heading) + dir.z * Math.cos(this.heading) < -0.3; }

  face(dx, dz, dt, rate = 6) {
    if (this.jammed > 0) return;   // (a bomb jammed its tracks: it can't turn)
    const want = Math.atan2(dx, dz), da = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
    this.heading += da * (1 - Math.exp(-rate * dt));
  }

  walkTo(x, z, speed, dt, env, stopAt = 0) {
    const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz);
    if (d <= stopAt + 1e-3) return;
    this.face(dx, dz, dt);
    const s = Math.min(speed * dt, d - stopAt);
    if (this.def.tracks) {
      // a tracked machine drives along its heading, slower the further it has to turn (it turns, then goes)
      const hx = Math.sin(this.heading), hz = Math.cos(this.heading), along = (dx * hx + dz * hz) / d;
      if (along > 0) this.step(hx * s * along, hz * s * along, env);
      return;
    }
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
    if (env.canStep && !env.canStep(from, nx, nz, D.radius, D.hover || this.air ? 0.5 : CLIMB.step + 0.1)) return false;
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
      // knocked off the edge: over it goes, and falls (fall()); your blow or push did it: it lands dazed (KNOCK)
      this.pos.x = nx; this.pos.z = nz;
      this.air = { vy: 0, top: this.pos.y, base: y ?? this.pos.y, hard: false, knocked: this.knockedBy > 0 };
      this.calm(); this.route = null;
      return true;
    }
    // (a step up or down: a ledge higher or deeper it crosses only with a hop it chose: followRoute)
    if (y == null || y - this.pos.y > CLIMB.step || this.pos.y - y > CLIMB.step) return false;
    if (!shoved && this.perched != null && y < this.perched - 0.5) return false;   // (perched over you: it keeps the high ground)
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
      } else if (w.kind === 'swing' && this.workCool.swing === 0) {
        // stilled, frosted over: the frost takes a foe that touches it, held a few seconds (no harm)
        const S = WORKS.swing;
        this.workCool.swing = S.frost + S.cool;
        this.calm(); this.vel.set(0, 0, 0); this.route = null;
        this.stunned = Math.max(this.stunned, S.frost); this.flash = 0.6;
        ev.push({ type: 'frosted' });
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
        if (A.knocked && this.sweptBy(env, ev, h)) return;   // (into deep water, from any height: swept away)
        const off = A.knocked ? knockedOff(h) : null;
        if (off) {
          // knocked off a ledge by you: dazed a long while, stars over it (KNOCK); from high enough, it is over
          this.stunned = Math.max(this.stunned, KNOCK.stun); this.dazed = KNOCK.stun; this.flash = 1;
          ev.push({ type: 'landed', h, hard: true, knocked: off });
          return;
        }
        if (A.hard || h > FALL.hard) { this.stunned = Math.max(this.stunned, FALL.stun); this.flash = 1; ev.push({ type: 'landed', h, hard: true }); }
        else ev.push({ type: 'landed', h, hard: false });
        return;
      }
    }
    this.pos.y = ny; A.top = Math.max(A.top, ny);
    if (A.top - ny > FALL.lost || ny < (env.killY?.() ?? -Infinity) || env.pit?.(this.pos)) this.gone(ev);
  }
  /**
   * Knocked by you into water (env.water: its surface over its feet) deep enough to sweep it away (KNOCK.deep):
   * a 'landed' event knocked 'swept' (Foes.knockedOff: a great splash, and it is over). True when it was.
   */
  sweptBy(env, ev, h = 0) {
    const w = env.water?.(this.pos.x, this.pos.y, this.pos.z);
    if (!w || !knockedInto(w.surface - this.pos.y)) return false;
    this.knockedBy = 0; this.calm(); this.route = null;
    ev.push({ type: 'landed', h, hard: true, knocked: 'swept', surface: w.surface });
    return true;
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
    this.provoked = true;   // (wildlife hurt fights back)
    const D = this.def, src = info.source;
    if (this.buried && mode === 'blade' && info.air) {
      // the air cut driven down onto the mound: up it comes, and the blow lands double (the mound worm)
      this.surfaced(); this.stunned = BURROW.flush; this.flash = 1; this.k = 0; this.letGo = true;
      if (this.state === 'wind' || this.state === 'strike') this.state = 'chase';
      this.hp -= (info.damage ?? 1) * 2;
      if (this.hp <= 0) { this.state = 'dead'; this.k = 0; return 'burst'; }
      return 'flushed';
    }
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
    if (mode === 'shoot' && this.state === 'wind' && this.atk?.choke && this.k > 0.2) {
      // a shot in the swollen throat (the toad): the glob bursts in it and it chokes, stunned, the lob lost
      this.state = 'chase'; this.k = 0; this.stunned = CHOKE; this.flash = 1; this.letGo = true;
      this.hp -= D.takes.shoot ?? 1;
      if (this.hp <= 0) { this.state = 'dead'; return 'burst'; }
      return 'choked';
    }
    if (mode === 'blade' && info.air && this.state === 'strike' && this.atk?.leap) {
      // the air cut meets a leap in the air (the toad's belly flop): double, and it comes down on its back
      this.flipped = this.stunned = LEAP_FLIP; this.state = 'recover'; this.timer = LEAP_FLIP; this.k = 0;
      this.alt = 0; this.leapFrom = null; this.flash = 1; this.recoil = 1; this.heavyRecoil = true;
      this.hp -= (info.damage ?? 1) * 2;
      if (this.hp <= 0) { this.state = 'dead'; this.k = 0; return 'burst'; }
      return true;
    }
    if (src === 'bomb' && this.shelled) { this.shelled = false; this.flash = 1; }   // (a bomb cracks a crab's shell for good)
    if (src === 'bomb' && D.jams) this.jammed = D.jams;                             // (a bomb on a cart's tracks: it can't turn)
    // the bell walker: only the clapper takes harm; a cut or a bomb rings off the bronze unless it sits open (tipped toward
    // you after its drop, its toll choked by the whistle, a guarded drop) or is stilled
    if (D.clapper && mode === 'blade' && !(this.open > 0) && !(this.stunned > 0) && src !== 'parry') {
      this.flash = 0.5; this.recoil = 0.5; this.heavyRecoil = false; if (dir) this.recoilDir.copy(dir).setY(0).normalize();
      return 'glance';
    }
    let dmg = 0;
    if (mode === 'blade') {
      if (this.shelled && !(this.flipped > 0) && dir && this.frontal(dir) && src !== 'parry') {
        // the shell turns the blade from the front: a glance, no harm
        this.flash = 0.5; this.recoil = 0.5; this.heavyRecoil = false; this.recoilDir.copy(dir).setY(0).normalize();
        return 'glance';
      }
      // (stilled, it shatters: double; seen through the lens, its weak point too: src/gadgets/lens.js; a doused slag walker's crust)
      dmg = (info.damage ?? 1) * (this.stunned > 0 || this.exposed > 0 || this.crust > 0 ? 2 : 1) * (D.weak?.[src] ?? 1);
      if (D.segmented && dir && src !== 'parry') {
        // plated (the centipede): from behind or the side the plates take half and it never reels; its head,
        // turned in for the ring, takes the cut double; cut from behind once it is hurt, its tail breaks off
        if (!this.frontal(dir)) {
          dmg *= 0.5; this.plated = true;
          if (D.shed && !this.shed && this.hp - dmg <= D.hp * D.shed.below) { this.shed = D.shed.segments; this.shedNow = true; }
        } else if (this.state === 'wind' && this.atk?.encircle) dmg *= 2;
      }
      // (a cut wakes a stunned one; asleep in a bloom or toppled, it stays down for the cuts, double)
      if (!(this.sleep > 0) && !(this.toppled > 0)) { this.stunned = 0; this.dazed = 0; }
    } else if (mode === 'shoot' && D.takes.shoot === 'pop') {
      // a support's lanterns: a shot pops one (and the ward it held); with none left, it hurts it
      if (this.pop()) { this.provoked = true; return 'popped'; }
      dmg = 1;
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
    if (mode === 'push' && dir && !D.rooted) { this.vel.set(dir.x, 0, dir.z).multiplyScalar((info.shove ?? 2.4) * (D.heavy ? 1.2 : 3)); }
    // (the heavy third swing throws them, the charged cut further: off a ledge, KNOCK; a root knot is rooted)
    if (dir && mode !== 'push' && mode !== 'world' && !D.rooted) this.vel.set(dir.x, 0, dir.z).multiplyScalar((D.heavy ? 1.5 : 4) * (info.breaks && !info.riposte ? KNOCK.charged : info.combo === 2 ? 2.2 : 1));
    if (dir && (mode === 'blade' || mode === 'push')) this.knockedBy = KNOCK.recent;   // (yours: carried off a ledge now, it lands dazed)
    if (dir && this.hop && mode !== 'world') this.knockOutOfHop();
    this.flash = 1;
    this.recoil = 1; this.heavyRecoil = (info.damage ?? 1) >= 2;
    if (dir) this.recoilDir.copy(dir).setY(0).normalize();
    if (mode === 'blade' || mode === 'fire' || mode === 'world') this.letGo = true;   // (a hold, a line, is broken)
    // Light cuts interrupt a blot (the flinchy ones), or the first two thirds of anyone's wind-up; the charged cut (info.breaks) anyone.
    // (a ward from a jelly: half the harm, and it shrugs off staggers; plated: a cut on its back never staggers it;
    // the push breaks a ring it is closing)
    const warded = this.ward?.t > 0, plated = this.plated; this.plated = false;
    if (warded) dmg *= 0.5;
    const ringBroken = mode === 'push' && this.state === 'wind' && (!!this.atk?.encircle || !!this.atk?.pile);   // (the push breaks a ring, scatters a heap)
    const topple = mode === 'blade' && D.topples && !!info.breaks && src !== 'parry' && !(this.toppled > 0);   // (a charged cut at a heron's legs)
    const reels = ringBroken || (!warded && !plated && ((mode === 'world' && !info.stun) || (D.flinchy && mode === 'blade') || (mode === 'blade' && !!info.breaks) || (this.state === 'wind' && this.k < 0.66 && !(D.stout && mode === 'blade')) || (this.heavyRecoil && this.state !== 'strike')));
    // a cut that doesn't stop it: a heavy foe, or one committed to its blow (late in its wind-up, striking); Foes.hurt answers with its armour's thunk
    this.shrugged = mode === 'blade' && !reels && (!!D.heavy || this.state === 'wind' || this.state === 'strike');
    if (mode === 'blade' && D.hover) this.low = KNOCKED_LOW;   // (cut, a hovering foe drops within reach)
    if (reels) { this.state = 'recover'; this.timer = this.heavyRecoil ? D.hit * 2 : D.hit; this.k = 0; this.reel = this.heavyRecoil ? 'staggered' : 'flinched'; }
    // (the riposte: held reeling a while longer, src/fluid-blade.js RIPOSTE)
    if (reels && info.stagger) { this.timer = Math.max(this.timer, info.stagger); this.reel = info.riposte ? 'riposted' : this.reel; }
    else if (this.state === 'idle' || this.state === 'home') this.state = 'chase';
    this.hp -= dmg;
    if (this.hp <= 0) { this.state = 'dead'; this.k = 0; return 'burst'; }
    if (topple) { this.toppled = TOPPLE; this.stunned = Math.max(this.stunned, TOPPLE); this.state = 'recover'; this.timer = 0.6; this.k = 0; this.open = 0; return 'toppled'; }
    return true;
  }
}

/** A foe's name for the words of a wave: its skin's (an anchor crab) or its kind's (an ink blot). */
export function foeName(id) {
  const { kind, skin } = parseKind(id), a = archetypeOfKind(kind);
  const own = skin && a && ARCHETYPES[a].status === 'built' ? skinOf(a, skin)?.name : null;
  return own ?? FOES[kind]?.name ?? kind;
}
const pluralOf = (id) => (foeName(id) !== FOES[parseKind(id).kind]?.name ? `${foeName(id)}s` : FOES[parseKind(id).kind]?.plural ?? `${foeName(id)}s`);

/** A wave said in words: "3 ink blots", "2 machines and 2 ink blots", "2 anchor crabs" (a skin by its name). */
export function waveWords(kinds) {
  const count = (k) => kinds.filter((x) => x === k).length, say = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
  // (the old names first, as they always were, then the worlds' kinds and the archetypes, the ink blot last)
  const order = ['machine', 'shade', ...Object.keys(KINDS), ...Object.keys(ARCHETYPE_KINDS).filter((k) => k !== 'blot'), 'blot'];
  const rank = (k) => order.indexOf(parseKind(k).kind) + (parseKind(k).skin ? 0.5 : 0);
  const flock = kinds.find((k) => FOES[parseKind(k).kind]?.flock);   // (a flock is said as one: "a swarm of dune skitters")
  const ids = [...new Set(kinds)].filter((k) => !FOES[parseKind(k).kind]?.flock).sort((a, b) => rank(a) - rank(b));
  const words = { machine: 'machine', shade: 'shade', blot: 'ink blot' };
  const parts = ids.map((k) => say(count(k), words[k] ?? foeName(k), words[k] ? undefined : pluralOf(k)));
  if (flock) parts.push(`a swarm of ${pluralOf(flock)}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0] ?? '';
}

const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
/**
 * A world's waves in the Arena (the FOES list's "Waves from here", enemies.html's "Fight this world's roster"): each of
 * its archetypes alone in its skin (the built ones and the stand-ins: src/foe-worlds.js), then two of its packs.
 */
export function worldWaves(world) {
  const kinds = [...new Set(worldArchetypes(world).map((a) => ARCHETYPES[a].kind).filter(Boolean))];
  const alone = kinds.map((k) => aloneWave(k, world));
  return [...alone, ...[1, 2].map((n) => packOf(n + 2, world, seeded(n * 7 + world.length)).map((k) => skinned(k, world)))];
}

/** A kind alone in a world's skin: a group kind as its group; a support with what it supports (def.escort: the jelly and a blot). */
export function aloneWave(k, w) {
  const D = FOES[k];
  return [...Array(D?.group ?? 1).fill(skinned(k, w)), ...(D?.escort ? [skinned(D.escort, w)] : [])];
}
/** The built archetypes, each alone in each of its skins (src/enemies/skins.js), a group kind as a group. */
const SKIN_WAVES = BUILT.flatMap((a) => skinWorlds(a).map((w) => aloneWave(ARCHETYPES[a].kind, w)));
const WORLD_START = {};
/**
 * The Arena's whole cycle (v1.8, the enemy roster): the ink and the worlds' kinds (WAVES), then each built archetype
 * in each of its skins, then each world's own (worldWaves); then round again.
 */
export const ARENA_WAVES = [...WAVES, ...SKIN_WAVES];
for (const w of Object.keys(WORLDS)) { WORLD_START[w] = ARENA_WAVES.length; ARENA_WAVES.push(...worldWaves(w)); }
/** The n-th wave of the Arena's cycle. */
export const arenaWave = (n) => ARENA_WAVES[((n % ARENA_WAVES.length) + ARENA_WAVES.length) % ARENA_WAVES.length];
/** Where a world's waves start in the cycle (its first archetype alone); -1 for none. */
export const arenaWaveOf = (world) => WORLD_START[world] ?? -1;
/** A wave in words, a world's skins by name: "2 coin lizards and 1 ink blot". */
export const waveText = (kinds) => waveWords(kinds);

/** Far enough from people and the ship for the wilds: p { x, z }; people: [{ x, z }]. */
export function inWilds(p, { people = [], spawn = null } = {}) {
  if (spawn && Math.hypot(p.x - spawn.x, p.z - spawn.z) < WILD.spawn) return false;
  for (const q of people) if (Math.hypot(p.x - q.x, p.z - q.z) < WILD.people) return false;
  return true;
}

// ------------------------------------------------------------------ how they look
let foeMaterialId = 0;
const INK = '#1e1a26';
function blotModel(kind = 'blot') {
  const g = new THREE.Group();
  const ink = makeMaterial({ color: INK, flat: true, key: 'foe-ink' });
  const eye = makeMaterial({ color: '#f4efe0', flat: true, glow: 0.6, key: `foe-eye.${foeMaterialId++}` });
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
  g.scale.setScalar(M.size);
  return M;
}

function machineModel() {
  // a makers' construct gone wrong: a round brass shell on three jointed piston legs, two arms with claws, the
  // makers' glyph (three dots over an arc) glowing on its face, plates riveted round its belly. The shell (the
  // hull) rides on its feet; the legs are on the locomotion kit (src/motion-kit/: a piston machine, plan 18).
  const g = new THREE.Group(), hull = new THREE.Group(); hull.name = 'hull'; g.add(hull);
  const brass = makeMaterial({ color: '#b08a4a', metal: 'brass', key: 'foe-brass' });
  const dark = makeMaterial({ color: '#3a3330', flat: true, key: 'foe-dark' });
  const plate = makeMaterial({ color: '#8f6f3e', metal: 'copper', key: 'foe-plate' });
  const core = makeMaterial({ color: '#70e7df', flat: true, glow: 0.9, key: `foe-core.${foeMaterialId++}` });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 12).scale(1, 0.85, 0.95), brass); body.position.y = 1.35; hull.add(body);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 6, 24).rotateX(Math.PI / 2), plate); belt.position.y = 1.22; hull.add(belt);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), dark); cap.position.y = 1.82; hull.add(cap);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 4), dark); mast.position.y = 2.1; hull.add(mast);
  // the glyph for an eye: three dots over an upturned arc
  const heart = new THREE.Group(); heart.position.set(0, 1.42, 0.55); hull.add(heart);
  heart.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 4, 16, Math.PI).rotateZ(0), core));
  for (const x of [-0.12, 0, 0.12]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), core); d.position.set(x, 0.22, 0); heart.add(d); }
  const arms = [-1, 1].map((s) => {
    const a = new THREE.Group(); a.position.set(s * 0.66, 1.45, 0); hull.add(a);
    a.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), plate));
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.75, 6).translate(0, -0.37, 0), dark); a.add(up);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.22).translate(0, -0.85, 0.04), brass); a.add(claw);
    return a;
  });
  // three legs round the belly: a thigh out and up to a brass knee, a shin down to a round foot, and a piston from
  // the shell to each thigh that slides as the knee bends
  const legs = [0, 1, 2].map((k) => {
    const ang = (k / 3) * Math.PI * 2 + Math.PI / 6, sx = Math.sin(ang), cz = Math.cos(ang);
    return planLeg(PLANS.machine, { group: g, body: hull, hip: { x: sx * 0.32, y: 0.95, z: cz * 0.32 }, foot: { x: sx * 0.66, z: cz * 0.66 }, radius: 0.05, pad: 'disc',
      piston: { at: { x: sx * 0.5, y: 1.2, z: cz * 0.5 } }, mats: { joint: plate, thigh: dark, shin: dark, foot: plate, piston: brass, rod: dark }, name: `machine leg ${k}` });
  });
  const rig = new Rig({ plan: PLANS.machine, group: g, body: hull, legs });
  return { group: g, body, hull, head: cap, arms, legs: legs.map((l) => l.root), rig, heart, eyeMat: core, parts: [body, belt, cap, mast, heart, ...arms, ...legs.map((l) => l.root)],
    tell: (id) => (id === 'quake' ? cap : arms[0].children[2]) };   // (the slam's claw; the quake's crown, both arms over it)
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _gl = new THREE.Vector3(), _gf = new THREE.Vector3();
/** The world's sounds on a foe (the game's synth, src/audio.js burst / sweep): spines, a flame's hiss, a hard landing. */
const sndAt = (s) => (s?.ctx && s.burst && s.sweep ? s.ctx.currentTime : null);
const worldSnd = {
  spines(s) { const t = sndAt(s); if (t == null) return; s.burst(t, { dur: 0.05, type: 'highpass', freq: 2600, q: 1.2, vol: 0.12 }); s.burst(t + 0.04, { dur: 0.05, type: 'bandpass', freq: 1500, q: 2, vol: 0.1 }); },
  hiss(s) { const t = sndAt(s); if (t == null) return; s.burst(t, { dur: 0.35, type: 'highpass', freq: 3200, q: 0.7, vol: 0.1 }); s.sweep(t, 300, 140, 0.2, 0.04, 'sawtooth'); },
  thud(s, k = 1) { const t = sndAt(s); if (t == null) return; s.burst(t, { dur: 0.18, type: 'lowpass', freq: 400, q: 0.8, vol: 0.12 + 0.18 * k }); s.sweep(t, 120, 50, 0.2, 0.08 * k); },
};
let _waveGeo, _waveMat, _waveInk, _patchGeo, _patchMat, _rimGeo, _patchRim;   // (shared by every shockwave and slag patch)
const _sporeMats = {};   // (a toad's spore patches, by colour)
/** A heap of skitters (attack.pile): its flock within this many m climbs on. The spores' haze over your sight (of a flash's white). */
const PILE = { near: 7 }, BLUR = 0.55;
/** The drops a foe bursts into as it falls. */
const BURST_TONES = {
  machine: ['#a8824a', '#70e7df', '#3a3330'],
  ray: ['#c98d4f', '#e8c58f', '#2b211f'], moth: ['#ff5fa2', '#5ff0e8', '#241a2e'],
};

/** Every foe in a world: the packs of ink blots in the wilds, the machines in the temple, their looks and their targets. */
export class Foes {
  constructor({ scene, level, levelId, content = null, physics, player, tool = null, sound = null, npcs = [], settings = null, notice = null, camera = null, lib = null, humans = null, waters = null, game = sharedGame, rng = Math.random }) {
    Object.assign(this, { scene, level, levelId, physics, player, tool, sound, npcs, settings, notice, camera, lib, humans, waters, game, rng });   // (waters: src/water.js, a foe knocked in is swept away)   // (lib, humans: a shade's body, src/shade.js)
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
      // the water over (x, y, z) (src/water.js Waters): { surface } or null; a sea whose bed is walked is not water here
      water: (x, y, z) => { const w = this.waters?.surfaceAt?.(x, z, y, 0.5); return w && !w.body?.sea && w.y > y ? { surface: w.y } : null; },
      pit: (p) => { const rt = this.level?.temple; return !!rt && (!!rt.pits?.some((x) => x.contains(p)) || (!!rt.below?.(p) && !rt.inside?.(p))); },
      // (lift: how high over `from` the way is tested; a walker's is over a step it may climb, CLIMB.step, so the
      // riser of a stair isn't taken for a wall: before v1.4 it was 0.5 m, and no foe climbed a step higher)
      canStep: (from, x, z, radius, lift = 0.5) => {
        if (!physics?.rayDistance) return true;
        _w.set(x - from.x, 0, z - from.z);
        const d = _w.length(); if (d < 1e-6) return true;
        _w.divideScalar(d); _v.copy(from).y += lift;
        return physics.rayDistance(_v, _w, d + radius) >= d + radius;
      },
      // the turns (TURNS.strikers at once); one off the screen waits while any other is striking, so a blow
      // from behind never comes on top of one you can see (it still warns at the screen's edge)
      mayStrike: (f) => {
        // (a flock darts in one at a time: the skitters' ripple rush)
        if (f.def.flock?.one && this.list.some((x) => x !== f && x.kind === f.kind && x.alive && x.dead === undefined && (x.state === 'wind' || x.state === 'strike'))) return false;
        const busy = this.list.filter((x) => x !== f && x.alive && ['wind', 'strike'].includes(x.state)).length;
        return busy < this.strikers && (busy === 0 || this.onScreen(f));
      },
      seen: (from, to) => !physics?.rayDistance || physics.rayDistance(from, _w.subVectors(_v.copy(to).setY(to.y + 1), from).normalize(), from.distanceTo(_v)) >= from.distanceTo(_v) - 0.5,
    };
    if (!this.peaceful) this.placeMachines();
    // the bell-note whistle (src/boxes/effects.js ring: the game's 'bell'): a bell walker winding up its toll near it chokes
    this.offBell = game?.on?.('bell', (e) => this.bellNote(e)) ?? null;
    // the relics' guards: a relic out in the wilds (src/levels/content.js relics.spots), once per save
    this.guards = this.peaceful || level?.foes?.waves || level?.foes?.own ? [] : (content?.relics?.spots ?? []).map((s, i) => {
      const a = Array.isArray(s) ? s : s.at, x = a[0], z = a.length === 2 ? a[1] : a[2];
      const y = a.length === 2 ? level?.ground?.heightAt?.(x, z) ?? 0 : a[1];
      return { i, pos: new THREE.Vector3(x, y, z), id: `foes.${levelId}.r${i}` };
    });
    // the encounters placed by hand (src/foe-worlds.js PLACED): Lorn II's wood cutter
    this.posts = this.peaceful || level?.foes?.waves || level?.foes?.own ? [] : (PLACED[levelId] ?? []).map((p, i) => ({ ...p, i, pos: new THREE.Vector3(p.at[0], level?.ground?.heightAt?.(p.at[0], p.at[1]) ?? 0, p.at[1]), id: `foes.${levelId}.p${i}` }));
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
    if (this.lockSlip > 0) { this.lock = null; return null; }   // (a moth's dust: the lock won't take)
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
    if (this.lockSlip > 0) { this.lockSlip = Math.max(0, this.lockSlip - dt); this.lock = null; }
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

  /**
   * A foe of `kind` (a kind, or a kind in a skin: 'crab@saltharbour') at `at`. With no skin, an archetype wears this
   * world's (src/enemies/skins.js: its own skin where the world has none). o.calm: a wild pack's, calm until provoked.
   */
  add(kind, at, o = {}) {
    const p = parseKind(kind), a = archetypeOfKind(p.kind);
    const skin = p.skin ?? (a && ARCHETYPES[a].status === 'built' ? skinFor(a, this.levelId) : null);
    const f = new Foe(p.kind, at, { rng: this.rng, ...o, skin });
    f.model = archetypeModel(f.kind, skin) ?? (f.kind === 'machine' ? machineModel() : f.kind === 'shade' && this.lib && this.humans?.[0] ? this.shadeModel() : kindModel(f.kind) ?? blotModel(f.kind));
    f.model.group.position.copy(at);
    if (!f.model.shade) this.group.add(f.model.group);
    f.tele = new Telegraph(this.group, f.def.tone ?? '#6d4fa8');
    if (f.def.flanks) f.flanker = this.list.some((x) => x.alive && x.kind === f.kind && !x.flanker && x.pos.distanceTo(at) < 12);   // (the second of a pair circles behind you)
    f.target = registerTarget({ kind: 'foe', foe: f, lock: true, radius: hurtRadius(f.def), accepts: ['blade', 'stun', 'fire', 'bloom'],
      position: () => f.chest, enabled: () => f.alive && f.model.group.visible,
      onHit: (mode, point, dir, info) => this.hurt(f, mode, dir, info) });
    this.list.push(f);
    return f;
  }

  remove(f) {
    f.target?.(); f.tele?.dispose(); f.glow?.dispose(); f.model.group.removeFromParent(); f.model.shade?.dispose();
    for (const t of f.teles ?? []) t.dispose();
    for (const g of f.globs ?? []) g.removeFromParent();
    f.stars?.removeFromParent();
    if (this.hold?.f === f) this.hold = null;
    if (this.lock === f) this.lock = null;
    // (each foe's shapes and its warning's glow are its own: let go with it, or every wave of a fight leaves
    // its GPU buffers and materials behind)
    for (const o of [f.model.group, ...(f.globs ?? [])]) o?.traverse((m) => m.geometry?.dispose());
    if (f.model.dispose && this.debris?.some((d) => d.owner === f)) f.awaitingDebrisDisposal = true;   // (its pieces still fly: their materials go with the last)
    else if (f.model.dispose) f.model.dispose(); else if (f.model.eyeMat) releaseMaterial(f.model.eyeMat);
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
        this.add(templeKind(this.levelId, i), new THREE.Vector3(x, y, z), { id }).placed = true;
        break;
      }
    });
  }

  /**
   * Room for a foe of `kind` to stand at `at`: its body's column is clear of the world (no foe comes in inside a
   * rock, a wall or a closed building, where it could not be seen: playtest 2026-10-08). The column starts a
   * little over its feet, so a slope it stands on is not counted. No physics (tests): yes.
   */
  roomAt(kind, at) {
    const phys = this.physics, D = FOES[parseKind(kind).kind] ?? FOES.blot;
    if (!phys?.pushCapsule) return true;
    const r = Math.max(0.2, Math.min(D.radius ?? 0.5, 0.9)), top = Math.max(1, (D.height ?? 0.6) * 2) + (D.hover ?? 0);
    const push = phys.pushCapsule(_pb.copy(at), r, 0.3, top, _hz);
    return !push || push.lengthSq() < 0.05 * 0.05;
  }

  /**
   * Where a foe placed round `c` (at bearing a, r m out; the ground found from `up` m over c, `down` m deep)
   * stands: the first of that spot and a few others turned round it and nearer in that has ground and room
   * (roomAt). None: next to c, on c's own ground, never inside the world at a guessed height.
   */
  openSpot(kind, c, a, r, up, down) {
    const phys = this.physics;
    for (const [da, kr] of [[0, 1], [0.6, 1], [-0.6, 1], [0, 0.6], [1.4, 0.8], [-1.4, 0.8], [Math.PI, 0.7], [0, 0.3]]) {
      const x = c.x + Math.sin(a + da) * r * kr, z = c.z + Math.cos(a + da) * r * kr;
      const y = phys ? phys.groundAt(x, c.y + up, z, down) : c.y;
      if (!Number.isFinite(y)) continue;
      const at = new THREE.Vector3(x, y, z);
      if (this.roomAt(kind, at)) return at;
    }
    return c.clone();
  }

  /**
   * A pack comes in, out of sight round you, where there is footing and room to stand: the world's (src/foe-worlds.js
   * packOf), each in the world's skin. Out here wildlife and the others keep to their calm until provoked.
   */
  spawnPack() {
    const P = this.player, phys = this.physics, kinds = packKinds(this.packs, this.levelId, this.rng).slice(0, this.difficulty === 'gentle' ? GENTLE.pack : 99), n = kinds.length;
    const base = this.rng() * Math.PI * 2;
    let made = 0, flock = null;
    for (let tries = 0; tries < 24 && made < n; tries++) {
      const a = base + (tries % 6) * 0.35 + (tries > 11 ? Math.PI : 0), r = PACK.near + this.rng() * (PACK.far - PACK.near);
      let x = P.pos.x + Math.sin(a) * r, z = P.pos.z + Math.cos(a) * r;
      // (a flock grazes together: the rest of it round the first, a few metres apart)
      if (flock && FOES[parseKind(kinds[made]).kind]?.flock) { const b = this.rng() * Math.PI * 2, rr = 0.9 + this.rng() * 2.4; x = flock.x + Math.sin(b) * rr; z = flock.z + Math.cos(b) * rr; }
      const y = phys ? phys.groundAt(x, P.pos.y + 25, z, 60) : P.pos.y;
      if (!Number.isFinite(y) || Math.abs(y - P.pos.y) > 5) continue;
      const at = new THREE.Vector3(x, y, z);
      if (!this.wild(at) || !this.roomAt(kinds[made], at)) continue;
      this.add(kinds[made], at, { calm: true });
      if (!flock && FOES[parseKind(kinds[made]).kind]?.flock) flock = at;
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
        const at = this.openSpot(kinds[k], g.pos, (k / GUARDS.size) * Math.PI * 2 + 0.7, GUARDS.ring, 4, 12);
        const f = this.add(kinds[k], at);
        f.guard = g;   // (guarding its relic: a calm kind is roused already)
      }
    }
  }

  /**
   * A placed encounter you come near (src/foe-worlds.js PLACED; not cut down yet, not out): it comes out where it stands,
   * facing its way, calm (a brute rusted mid-task); left far behind it goes with the packs and comes back as you return.
   */
  updatePosts() {
    const P = this.player;
    for (const p of this.posts ?? []) {
      if (this.game.flag(p.id) || P.pos.distanceTo(p.pos) > POSTS.near || this.list.some((f) => f.post === p && f.alive)) continue;
      const kind = ARCHETYPES[p.archetype]?.kind;
      if (!kind || !FOES[kind]) continue;
      const y = this.physics?.groundAt?.(p.pos.x, p.pos.y + 20, p.pos.z, 40);
      if (Number.isFinite(y)) p.pos.y = y;
      const f = this.add(kind, this.openSpot(kind, p.pos, 0, 0.01, 6, 12), { calm: true, id: p.id });
      f.post = p; f.heading = p.heading ?? 0; f.home.copy(f.pos);
    }
  }

  /** The Arena: once the last wave is down, a short rest, then the next round you (ARENA_WAVES, round and round). */
  updateWaves(dt) {
    if (this.list.some((f) => f.alive)) { this.waveRest = WAVE.rest; return; }
    this.waveRest -= dt;
    if (this.waveRest > 0) return;
    // (enemies.html's links: ?enemy= one archetype in a skin again and again, ?enemyWorld= that world's waves round)
    const world = WORLDS[this.level?.foes?.world] ? this.level.foes.world : null, single = this.level?.foes?.kind && FOES[parseKind(this.level.foes.kind).kind] ? this.level.foes.kind : null;
    const ww = world ? worldWaves(world) : null;
    const P = this.player, kinds = single ? Array(FOES[parseKind(single).kind].group ?? 1).fill(single) : ww ? ww[this.wave % ww.length] : arenaWave(this.wave), base = this.rng() * Math.PI * 2;
    kinds.forEach((kind, i) => {
      const a = base + (i / kinds.length) * Math.PI * 2, r = WAVE.near + this.rng() * (WAVE.far - WAVE.near);
      this.add(kind, this.openSpot(kind, P.pos, a, r, 20, 40));
    });
    this.wave++;
    this.waveRest = WAVE.rest;
    const skin = parseKind(kinds[0]).skin, from = skin && (TITLES[skin] ?? skin);
    this.notice?.(`Wave ${this.wave}${from ? ` · ${from}` : ''}: ${waveText(kinds)}.`);
  }
  /** The Arena's waves again, from a world's first enemy (the FOES list), or on from where they were; the field cleared. */
  startWaves(world = null) {
    for (const f of this.list.slice()) if (f.dead === undefined) this.remove(f);
    this.practice = null; this.waveRest = WAVE.rest;
    const at = world ? arenaWaveOf(world) : -1;
    if (at >= 0) this.wave = at;
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
    const n = f.def.flock ? 1 : f.kind === 'shade' ? 5 : 3;
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
    if (e.type === 'fell') { f.lost = true; this.burst(f); return; }   // (out of the world: nothing to drop where it went)
    if (e.type === 'thrown' || e.type === 'tumbled') { s?.whoosh?.(); return; }
    if (e.type === 'frosted') { s?.chime?.(); this.animKit(f, 0, {}).dust(f.chest, '#dff4ff', 10, 0.6); return; }   // (a stilled crystal's frost: held, eyes pale)
    if (e.type === 'stalled') { worldSnd.thud(s, 0.9); kick(0.15); this.sparks(f, f.chest); this.animKit(f, 0, {}).dust(f.pos, '#cdb89a', 12, 1); return; }   // (a cart's ram stopped by a wall)
    if (e.type === 'hop') { worldSnd.thud(s, e.how === 'drop' ? 0.35 : 0.2); this.animKit(f, 0, {}).dust(f.pos, '#cdb89a', 6, 0.5); return; }   // (up or down a ledge: a soft landing)
    if (e.knocked) { this.knockedOff(f, e); return; }
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
   * Knocked off a ledge by you (KNOCK, src/foe-height.js): a heavy landing, dazed a long while with stars over it
   * (a cut lands double: it is stunned), or from KNOCK.defeat up, the fall is the end of it. The first time, a note.
   */
  knockedOff(f, e) {
    const swept = e.knocked === 'swept', over = e.knocked === 'over' || swept;
    if (swept) {
      f.lost = true;   // (the water takes it, and what it carried: no chimes)
      // into deep water: a great splash (src/water.js), and the water takes it
      if (this.waters?.splash) this.waters.splash(f.pos, e.surface, 2);
      else this.sound?.splash?.(2);
      hitStop(0.08); kick(0.4);
    } else {
      worldSnd.thud(this.sound, 1); hitStop(over ? 0.1 : 0.07); kick(over ? 0.5 : 0.4);
      this.animKit(f, 0, {}).dust(f.pos, '#cdb89a', 14, 0.9);
    }
    this.hurt(f, 'world', null, { damage: over ? f.hp : 0, stun: KNOCK.stun, source: 'fall' });   // (dazed: no harm, the stun is the opening)
    if (swept && !this.game.flag('foes.swept')) {
      this.game.set('foes.swept', true);
      this.notice?.('Knocked into deep water, a foe is swept away.');
    } else if (!swept && !this.game.flag('foes.knocked')) {
      this.game.set('foes.knocked', true);
      this.notice?.(over ? 'Off the edge and down: a long fall ends a foe outright.' : 'Knocked off a ledge, a foe lies dazed a long while: cut it while the stars turn, the cut lands double.');
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
      (this.debris ??= []).push({ owner:f, o: part, floor, t: 0, vel: new THREE.Vector3((this.rng() - 0.5) * 6, 3 + this.rng() * 4, (this.rng() - 0.5) * 6), spin: new THREE.Vector3(this.rng() * 8 - 4, this.rng() * 8 - 4, this.rng() * 8 - 4) });
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
      if (d.t > 3.4) {d.o.removeFromParent();d.o.traverse(o=>o.geometry?.dispose());}
    }
    if (this.debris) {
      const expired=new Set(this.debris.filter(d=>d.t>3.4).map(d=>d.owner));
      this.debris = this.debris.filter((d) => d.t <= 3.4);
      for(const f of expired)if(f.awaitingDebrisDisposal&&!this.debris.some(d=>d.owner===f)){f.model.dispose();f.awaitingDebrisDisposal=false;}
    }
  }

  /** The fluid tool touched a foe (targets.js): its mind decides; the look, the sound and the reward follow. */
  hurt(f, mode, dir, info) {
    // the push on any of a heap scatters it (the one under it reels); an ember into a flock sends the rest running
    if (mode === 'push' && f.riding?.on?.state === 'wind') { const B = f.riding.on; B.state = 'recover'; B.timer = B.def.hit * 2; B.k = 0; B.reel = 'scattered'; }
    if (mode === 'fire' && f.def.flock) for (const x of this.list) if (x !== f && x.kind === f.kind && x.alive && !x.riding && x.pos.distanceTo(f.pos) < 6) x.scatter = 1.4 + this.rng() * 0.6;
    const r = f.hit(mode, dir, info);
    if (!r) return false;
    if (r === 'choked') { this.sound?.foeHurt?.(f.def.sound ?? f.kind); this.animKit(f, 0, {}).spray(f.chest, [f.model.spore ?? f.def.tone, '#ffffff'], 18, 3, 3); return true; }   // (its glob bursts in its throat)
    if (r === 'glance') { this.sound?.foeHurt?.('machine'); this.sparks(f, f.chest); return true; }   // (off a crab's shell)
    if (r === 'popped') { this.sound?.foeHurt?.(f.def.sound ?? f.kind); this.sparks(f, f.chest); return true; }   // (a jelly's lantern)
    if (f.shedNow) this.shedTail(f);
    if (r === 'flushed') { this.sound?.foeHurt?.(f.def.sound ?? f.kind); this.burstUp(f, { surface: true }); return true; }   // (a cut at a ray's fin: sand flies, up it comes)
    if (r === 'burst') { if (mode === 'blade' || mode === 'shoot' || mode === 'fire' || mode === 'world') this.sound?.foeHurt?.(f.def.sound ?? f.kind); this.burst(f); return true; }
    if (f.shrugged) { this.armour(f, dir); return true; }
    if (mode === 'blade' || mode === 'shoot' || mode === 'fire' || mode === 'world') this.sound?.foeHurt?.(f.def.sound ?? f.kind);
    return true;
  }

  /** A centipede cut from behind sheds its tail: its last segments break off and run as skitterers (def.shed). */
  shedTail(f) {
    f.shedNow = false;
    const S = f.def.shed, sp = f.model.spine, tail = sp?.at(-1) ?? f.pos;
    for (let i = 0; i < S.n; i++) {
      const at = new THREE.Vector3(tail.x + (i - 0.5) * 0.8, f.pos.y, tail.z), x = this.add(S.kind, at);
      x.state = 'chase'; x.cool = 0.8 + i * 0.4; x.guard = f.guard; x.placed = f.placed;
    }
    this.animKit(f, 0, {}).spray(tail, f.model.tones ?? [INK], 10, 3, 9);
  }

  /** Done: a blot bursts back into ink, a machine comes apart; the magic bar gets a unit back. */
  burst(f) {
    this.sound?.foeBurst?.(f.def.sound ?? f.kind);
    // the blow that ends one lands harder (a longer freeze, a bigger kick); the last of a fight, a moment of
    // slow motion to mark it done (src/feel.js)
    const P = this.player, last = !this.list.some((x) => x !== f && x.alive && x.dead === undefined && x.state !== 'idle' && (!P || x.pos.distanceTo(P.pos) < 28));
    hitStop(last ? 0.12 : 0.09); kick(last ? 0.6 : 0.35);
    if (last) slowMo(0.45, 0.35);
    const T = this.tool, at = f.chest.clone();
    const tones = f.model.tones ?? BURST_TONES[f.kind] ?? [INK, '#3b3350', '#6d4fa8'];   // (an archetype's from its skin)
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
    // (src/chimes.js, main.js: what it leaves; `lost` when it went out of the world or into deep water)
    this.game.emit?.('foe:burst', { kind: f.kind, skin: f.skin, archetype: f.archetype, pos: f.pos.clone(), lost: !!f.lost, practice: !!this.practice?.kind, waves: !!this.waves });
  }

  update(dt, paused = false) {
    TELL.slow = this.difficulty === 'gentle' ? GENTLE.wind : 1;   // (the guardians' wind-ups too: src/telegraph.js)
    const P = this.player;
    if (!P) return;
    if (!this.on) { for (const f of this.list) { f.model.group.visible = false; f.tele.hide(); f.glow?.hide(); } return; }
    if (paused) return;
    if (this.tool?.blade) this.tool.blade.gentle = this.gentle;   // (the evade's i-frame window for this setting)
    this._people = this.peopleNow();
    // the wilds: after a few seconds out there, a pack comes in (the first time, just one); a pack
    // left far behind dissolves; after one is cut down, a rest before the next
    if (this.waves && !this.own && !this.practice) this.updateWaves(dt);
    if (this.practice?.kind) this.updatePractice(dt);
    this.updateGuards();
    this.updatePosts();
    const wild = !this.waves && !P.ride && !P.swim && this.wild(P.pos);
    this.wildFor = wild ? this.wildFor + dt : 0;
    this.packRest = Math.max(0, this.packRest - dt);
    const blots = this.list.filter((f) => !f.placed && !f.guard && !f.post && f.alive);   // (the wilds' own: not the temple's, not a relic's guards, not one placed by hand)
    if (wild && this.wildFor > PACK.settle && this.packRest === 0 && blots.length === 0) {
      if (this.spawnPack()) { this.packRest = (PACK.rest[0] + this.rng() * (PACK.rest[1] - PACK.rest[0])) * (this.difficulty === 'gentle' ? GENTLE.rest : 1); this.firstSeen(); }
      else this.packRest = 3;
    }
    for (const f of this.list.slice()) {
      if (f.dead !== undefined) {   // bursting: shrink away, then gone
        f.dead -= dt;
        if (f.model.shade) { f.model.shade.melt = 1 - f.dead / 0.8; f.model.shade.update(dt, f); }   // (a shade runs away into the ground)
        else f.model.group.scale.setScalar(Math.max(0.01, f.dead / 0.8));
        f.tele.hide(); f.glow?.hide();
        if (f.dead <= 0) this.remove(f);
        continue;
      }
      if (!f.placed && !this.waves && f.pos.distanceTo(P.pos) > PACK.drop) { this.remove(f); continue; }
      // a machine only stirs while you are in its temple (the Arena's, always)
      const inTemple = !f.placed || this.waves || this.level?.temple?.inside?.(P.pos);
      // a support sees its neighbours (the jelly: who it may ward or mend)
      if (f.def.support) f.allies = this.list.filter((x) => x !== f && x.alive && x.dead === undefined && !x.def.support && x.pos.distanceTo(f.pos) < 12);
      // a flock knows how many of its own are near to climb into a heap with (attack.pile)
      if (f.def.flock) f.mates = this.list.filter((x) => x !== f && x.kind === f.kind && x.alive && x.dead === undefined && !x.riding && x.pos.distanceTo(f.pos) < PILE.near).length;
      const ev = inTemple ? f.update(dt, P, this.env) : [];
      for (const e of ev) {
        if (e === 'warn') this.sound?.foeWarn?.(f.def.sound ?? f.kind, ((f.atk ?? f.def.attack).wind ?? 0.8) * this.env.slow());   // (rising over its whole wind-up)
        if (e === 'warn' && f.atk?.pile) this.pile(f);   // (its flock climbs onto it)
        if (e === 'notice') { this.meet(f); this.alarm(f); }
        if (e?.type === 'ward' || e?.type === 'mend') { this.support(f, e); continue; }
        if (e?.type && e.type !== 'strike') { this.worldEvent(f, e); continue; }
        if (e?.type !== 'strike') continue;
        if (f.kind === 'shade') this.slashTrail(f);
        const a = e.atk ?? f.def.attack;
        if (a.wave) this.addWave(f, a);
        if (a.leave === 'spores') this.leaveSpores(f, a);
        else if (a.leave) this.leaveSlag(f, a);
        if (a.surface || a.blink) this.burstUp(f, a);
        if (e.hit) this.strike(f, a);
      }
      if (f.def.trail && f.alive && inTemple) this.trailSlag(f);
      this.look(f, dt);
    }
    this.updateHold(dt);
    this.corral();
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
      if (!a.alive || !b.alive || a.riding || b.riding) continue;   // (a heap's riders sit on the one under them)
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
      // on the screen and in sight, its body says it all; on the screen but behind a wall, a rock or a roof
      // (a physics ray from the camera), it gets a marker too, over where it is (playtest 2026-10-08)
      const onScreen = ahead && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.85;
      const hidden = onScreen && this.hiddenFromCamera(f);
      const spot = warnSpot(p.x, p.y, ahead, hidden);
      if (!spot) continue;
      const { x, y } = spot;
      const chip = this.chips[n] ?? (this.chips[n] = this.warnEl.appendChild(Object.assign(document.createElement('div'), { className: 'foe-chip' })));
      chip.style.cssText = `position:absolute;left:${(x * 0.5 + 0.5) * 100}%;top:${(0.5 - y * 0.5) * 100}%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #2b211f;background:radial-gradient(circle, ${f.def.tone ?? '#8e64d6'} ${Math.round(f.k * 70)}%, rgba(247,236,210,0.85) ${Math.round(f.k * 70) + 1}%);box-shadow:2px 2px 0 #2b211f`;
      n++;
    }
    for (let i = n; i < (this.chips?.length ?? 0); i++) this.chips[i].style.display = 'none';
  }

  /** Is f's body hidden from the camera by the world (a physics ray from the camera to its chest)? */
  hiddenFromCamera(f) {
    const phys = this.physics, cam = this.camera;
    if (!phys?.rayDistance || !cam) return false;
    const to = _fb.subVectors(f.chest, cam.position), d = to.length();
    if (d < 1e-3) return false;
    return phys.rayDistance(cam.position, to.divideScalar(d), d) < d - (f.def.radius ?? 0.5) - 0.3;
  }

  /** The bell-note whistle sounded at e.pos: a toll winding up near it chokes (Foe.hush), the bell sits open. The count hushed. */
  bellNote({ pos, soft = false } = {}) {
    if (soft || !pos) return 0;
    let n = 0;
    for (const f of this.list) if (f.alive && f.dead === undefined && f.pos.distanceTo(pos) < 26 && f.hush()) { n++; this.sparks(f, f.chest); }
    if (n && !this.game.flag('foes.hushed')) { this.game.set('foes.hushed', true); this.notice?.('The bell-note whistle answered its toll: the bell walker chokes on its own note and sits open. Strike the clapper.'); }
    return n;
  }

  /** A strike that caught the traveller: a bite of the bar (never all of a healthy one), a shove, a machine knocks you down. */
  strike(f, a = f.atk ?? f.def.attack) {
    const P = this.player;
    // a flash only blinds whoever looks at it: turned away (the camera), it is nothing
    if (a.blind && !this.facing(f)) return false;
    // roots running under the ground (the root knot's grip) take only feet on it: a jump clears them
    if (a.ground && P.onGround === false) return false;
    // the evade's i-frames swallowed it (src/fluid-blade.js dodge): a blow, a lob, a charge, a flash, a line or a grip
    if (P.dodge?.(f.pos, a.tether || a.grab ? 'grab' : 'strike', this.gentle)) return false;
    // the guard took it (src/fluid-blade.js block): no harm, and the foe reels back
    const guarded = P.guard?.(f.pos);
    if (guarded) {
      const perfect = guarded === 'perfect';
      // a perfect parry chips a piece off a glass golem (before the stun, which would double it)
      if (a.onParry === 'chip' && perfect) { this.hurt(f, 'blade', _w.set(-Math.sin(f.heading), 0, -Math.cos(f.heading)), { damage: 1, source: 'parry' }); this.sparks(f, f.chest); if (!f.alive) return false; }   // (a glass golem, a crab's claw)
      f.staggered(perfect); this.sound?.foeHurt?.(f.def.sound ?? f.kind);
      if (perfect) { f.stunned = PARRY_STUN; if (!this.game.flag('foes.parried')) { this.game.set('foes.parried', true); this.notice?.('A perfect parry: raised just as the strike came, the guard costs nothing and leaves the foe stunned.'); } }
      // what a guard does to some attacks: a crab's spin is turned onto its back; a harpoon's or a root's line is
      // cut (the drone, the root knot dazed)
      if (a.onParry === 'flip') { f.flipped = f.stunned = Math.max(f.stunned, 2.6); f.vel.multiplyScalar(0.3); }
      else if (a.onParry === 'cut') { f.stunned = Math.max(f.stunned, perfect ? PARRY_STUN : 1); this.sparks(f, P.chest ?? P.pos); }
      // a perfect parry sends a tripod's bolt back down its beam, into its lamp
      else if (a.onParry === 'reflect' && perfect && f.alive) { this.hurt(f, 'world', null, { damage: 2, source: 'parry' }); this.sparks(f, f.chest); }
      // a heron's bill knocked aside: its head open a while (longer on a perfect parry), within reach
      else if (a.onParry === 'open') { f.open = perfect ? OPEN.perfect : OPEN.guard; f.stunned = Math.max(f.stunned, f.open); }
      // a sky ray's skim parried: it ploughs into the ground and lies there, open
      else if (a.onParry === 'ground' && perfect) { f.stunned = Math.max(f.stunned, GROUNDED); f.alt = 0.15; f.vel.multiplyScalar(0.2); this.animKit(f, 0, {}).dust(f.pos, '#cdb89a', 12, 1.2); }
      return false;
    }
    // a moth's dust: your lock slips off and won't take for a while (no harm)
    if (a.slip) { this.lock = null; this.lockSlip = a.slip * (this.difficulty === 'gentle' ? 0.6 : 1); P.flinch?.(); return true; }
    // a root knot's spores: your sight blurs, whichever way you look (no harm)
    if (a.blur) { this.blind(a.blur * (this.difficulty === 'gentle' ? 0.6 : 1), f.model?.spore ?? f.def.tone, BLUR); P.flinch?.(); return true; }
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
    } else if (a.shove) {
      // a horn lizard's blare: you are shoved a few metres, toward its partner when it has one
      const mate = f.def.flanks ? this.list.find((x) => x !== f && x.alive && x.dead === undefined && x.kind === f.kind && x.pos.distanceTo(P.pos) < 16) : null;   // (a heron's buffet: straight back)
      if (mate) { _w.subVectors(mate.pos, P.pos).setY(0); if (_w.lengthSq() > 1e-4) _v.copy(_w.normalize()); }
      P.vel?.addScaledVector(_v, a.shove).addScaledVector(_up, 2); P.flinch?.();
    } else if (a.knock) P.knockDown?.(_v.clone().multiplyScalar(a.knock).addScaledVector(_up, 3.5), { why: 'foe' });
    else { P.vel?.addScaledVector(_v, 5).addScaledVector(_up, 2.5); P.flinch?.(); }   // (a flinch from motion capture: player.js)
    if (a.blind) this.blind(a.blind * g, f.def.tone);
    // a ray's downdraft: thrown down, the glide and the jets broken
    if (a.draft) { P.gliding = false; P.endJets?.(); if (P.vel) P.vel.y = Math.min(P.vel.y, -a.draft); }
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
  /** A strike's damage in hearts for this setting (Gentle: half), counted in quarters. */
  harmOf(d) { return quarters(d * (this.difficulty === 'gentle' ? GENTLE.harm : 1)); }
  /** Hearts off the traveller (a blow never takes him from more than a heart to nothing: strikeDamage). */
  harm(d) { const P = this.player; P.hurt?.(strikeDamage(heartsOf(P), d), 'foe'); }

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
  /**
   * A centipede closing its ring (attack.encircle) is a wall: wherever its body is (its model's spine, else its head),
   * you can't walk across it; on the inside you are held in, out over its back only from high enough (the wings, the
   * jets, a ledge: RING.over m over its back). Pushes you back to your side of it.
   */
  corral() {
    const P = this.player;
    if (!P?.pos || P.dead || P.ride) return;
    for (const f of this.list) {
      if (!f.alive || f.dead !== undefined || f.state !== 'wind' || !f.atk?.encircle) continue;
      const c = f.attackAt, inside = Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < Math.hypot(f.pos.x - c.x, f.pos.z - c.z);
      for (let pass = 0; pass < 3; pass++) for (const p of f.model.spine?.length ? f.model.spine : [f.pos]) {   // (a few passes: one segment's push may lean you on the next)
        if (P.pos.y > p.y + RING.over) continue;
        const dx = P.pos.x - p.x, dz = P.pos.z - p.z, d = Math.hypot(dx, dz);
        if (d >= RING.wall || d < 1e-4) continue;
        // which side: toward the ring's centre if you are inside it, away if outside
        let nx = c.x - p.x, nz = c.z - p.z; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
        if (!inside) { nx = -nx; nz = -nz; }
        const push = RING.wall - d;
        P.pos.x += nx * push; P.pos.z += nz * push;
        if (P.vel) { const vn = P.vel.x * nx + P.vel.z * nz; if (vn < 0) { P.vel.x -= vn * nx; P.vel.z -= vn * nz; } }
      }
    }
  }

  /** A support's move landed on its neighbour (the jelly): a ward (half the harm, no staggers) held by a lantern, or a mend. */
  support(f, e) {
    const T = e.target;
    if (!T?.alive || T.dead !== undefined || !f.alive) return;
    if (e.type === 'ward') {
      if (f.wards.length >= f.lanterns) return;
      T.ward?.by && T.unward();
      T.ward = { by: f, t: e.atk.ward.time };
      f.wards.push(T);
      this.tool?.rings?.add({ from: T.chest.clone(), dir: _up, reach: 0.05, r0: T.def.radius * 0.5, r1: T.def.radius + 0.6, life: 0.4, color: f.def.tone, thick: 1 });
    } else {
      T.hp = Math.min(T.def.hp, T.hp + e.atk.mend.hp);
      this.animKit(f, 0, {}).spray(T.chest, [f.def.tone, '#ffffff'], 12, 2, -2);
    }
    this.sound?.chime?.();
  }

  /** How far the line from f reaches now (a drone's harpoon line, a root knot's roots: drawn to you), or 0. */
  held(f) { return this.hold?.f === f ? this.hold.d : 0; }

  /** A moth's flash: the screen goes white and fades (Gentle: shorter). */
  blind(s, tone = '#ff5fa2', strength = 0.88) {
    this.blinded = Math.max(this.blinded ?? 0, s);
    this.blindStrength = strength;
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
    if ((W.count ?? 1) > 1) (this.waveQueue ??= []).push({ f, a, at: at.clone(), n: W.count - 1, t: W.every ?? 0.7 });   // (the toll's other rings)
    this.ringOut(f, W, at, a.radius);
  }
  /** One ring of shock running out from `at` over the floor (addWave). */
  ringOut(f, W, at, r0 = 1.5) {
    const mesh = new THREE.Mesh(_waveGeo ??= new THREE.RingGeometry(0.86, 1, 56).rotateX(-Math.PI / 2), _waveMat ??= makeMaterial({ color: '#e0703a', flat: true, glow: 0.7, side: THREE.DoubleSide, key: 'foe-wave' }));
    const inner = new THREE.Mesh(_waveGeo, _waveInk ??= makeMaterial({ color: '#2b211f', flat: true, side: THREE.DoubleSide, key: 'foe-wave-ink' }));
    inner.scale.setScalar(0.94); inner.position.y = -0.01; mesh.add(inner);
    mesh.position.set(at.x, at.y + 0.08, at.z); mesh.userData.noCollide = true;
    this.group.add(mesh);
    (this.shocks ??= []).push({ f, at, r: r0 ?? 1.5, W, mesh, hit: false });
    if (this.player?.pos) rumblePlay('slam', { dist: this.player.pos.distanceTo(at) });   // felt underfoot, by how near (src/rumble.js)
  }

  /** Slag poured or stamped out: burning patches on the ground (a ring round it, or a fan before it). */
  leaveSlag(f, a) {
    const n = a.leave === 'ring' ? 7 : 5;
    for (let i = 0; i < n; i++) {
      if (a.leave === 'ring') { const t = (i / n) * Math.PI * 2; this.addPatch(f.pos.x + Math.sin(t) * (a.radius ?? 2) * 0.75, f.pos.y, f.pos.z + Math.cos(t) * (a.radius ?? 2) * 0.75, 0.8, a.leaveLife ?? 5); }
      else { const t = f.attackH + (i / (n - 1) - 0.5) * (a.angle ?? 0.5) * 1.6, r = (a.range ?? 4) * (0.45 + (i % 2) * 0.35); this.addPatch(f.pos.x + Math.sin(t) * r, f.pos.y, f.pos.z + Math.cos(t) * r, 0.85, a.leaveLife ?? 5); }
    }
  }
  /** A toad's glob bursts into spores where it lands (each of a volley's): a patch that slows you a while (SPORES). */
  leaveSpores(f, a) {
    for (const p of f.attackPts ?? [f.attackAt]) this.addPatch(p.x, p.y, p.z, SPORES.r * ((a.radius ?? 1.5) / 1.5), SPORES.life, 'spores', f.model?.spore ?? f.def.tone);
  }
  /**
   * A heap (attack.pile, the skitters): as one winds it up, up to `pile` of its flock near it climb onto it (Foe.ride),
   * the nearest first; they ride the heap until it topples onto you or the push scatters it.
   */
  pile(f) {
    const mates = this.list.filter((x) => x !== f && x.alive && x.dead === undefined && x.kind === f.kind && !x.riding && x.state !== 'wind' && x.state !== 'strike' && x.pos.distanceTo(f.pos) < PILE.near)
      .sort((a, b) => a.pos.distanceTo(f.pos) - b.pos.distanceTo(f.pos)).slice(0, f.atk.pile);
    mates.forEach((x, i) => { x.riding = { on: f, i, climb: 0 }; x.state = 'chase'; x.k = 0; x.provoked = true; });
    f.heap = mates.length;
  }
  /** A slag walker treads burning slag behind it, a patch every so often. */
  trailSlag(f) {
    const T = f.def.trail;
    if (!f._trail) { f._trail = f.pos.clone(); return; }
    if (f.pos.distanceTo(f._trail) < T.every || f.crust > 0) return;
    f._trail.copy(f.pos);
    this.addPatch(f.pos.x, f.pos.y, f.pos.z, T.r, T.life);
  }
  addPatch(x, y, z, r, life, kind = 'slag', color = null) {
    const P = this.physics, g = P?.groundAt?.(x, y + 1.5, z, 4), gy = Number.isFinite(g) ? g : y;
    const spores = kind === 'spores';   // (a toad's spores: a dusty patch that slows you; slag burns)
    const mat = spores ? (_sporeMats[color] ??= makeMaterial({ color: color ?? '#c4b1d9', flat: true, glow: 0.25, key: `foe-spores-${color}` })) : (_patchMat ??= makeMaterial({ color: '#ff7a2e', color2: '#ffd36a', flat: true, glow: 0.9, key: 'foe-slag-patch' }));
    const mesh = new THREE.Mesh(_patchGeo ??= new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), mat);
    const rim = new THREE.Mesh(_rimGeo ??= new THREE.RingGeometry(0.82, 1, 14).rotateX(-Math.PI / 2), _patchRim ??= makeMaterial({ color: '#2a1d1a', flat: true, key: 'foe-slag-rim' }));
    rim.position.y = 0.004; mesh.add(rim);
    mesh.position.set(x, gy + 0.04, z); mesh.scale.setScalar(r); mesh.rotation.y = this.rng() * 6; mesh.userData.noCollide = true;
    this.group.add(mesh);
    (this.patches ??= []).push({ pos: new THREE.Vector3(x, gy, z), r, life, max: life, mesh, kind });
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
    for (const q of this.waveQueue ?? []) {
      q.t -= dt;
      if (q.t > 0 || q.n <= 0) continue;
      q.n--; q.t = q.a.wave.every ?? 0.7;
      if (q.f.alive && q.f.dead === undefined) { this.ringOut(q.f, q.a.wave, q.at, q.a.radius); this.sound?.foeWarn?.(q.f.def.sound ?? q.f.kind, 0.15); }
    }
    if (this.waveQueue) this.waveQueue = this.waveQueue.filter((q) => q.n > 0);
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
      if (p.kind === 'spores') {
        // the spores: wading through them, you go at about half your pace (the traveller's own speed bled off)
        if (ground && !P.dead && Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z) < p.r && Math.abs(P.pos.y - p.pos.y) < 0.8 && P.vel) {
          const k = Math.exp(-SPORES.slow * dt); P.vel.x *= k; P.vel.z *= k; this.mired = 0.2;
        }
        if (p.life <= 0) p.mesh.removeFromParent();
        continue;
      }
      // (an evade's i-frames carry you over it unburnt; standing in it after, it burns)
      if (this.burnCool === 0 && ground && !P.dead && !P.down && Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z) < p.r && Math.abs(P.pos.y - p.pos.y) < 0.8 && !P.dodge?.(p.pos, 'burn', this.gentle)) {
        this.burnCool = 0.7; this.harm(this.harmOf(DAMAGE.graze)); P.vel?.addScaledVector(_up, 2.5); P.flinch?.();
        this.sound?.foeHurt?.('blot');
      }
      if (p.life <= 0) p.mesh.removeFromParent();
    }
    if (this.patches) this.patches = this.patches.filter((p) => p.life > 0);
    if (this.blinded > 0) {
      this.blinded = Math.max(0, this.blinded - dt);
      if (this.blindEl) this.blindEl.style.opacity = String(Math.min(1, (this.blinded / (this.blindFor || 1)) * 1.6) * (this.blindStrength ?? 0.88));
    } else if (this.blindEl) this.blindEl.style.opacity = '0';
  }

  /**
   * One provoked (it noticed you, or you hurt it): those of its own kind near it that keep a calm are provoked too
   * (def.calm.alarm m: a lizard's partner, a crab's neighbours, the hounds of a pair).
   */
  alarm(f) {
    for (const x of this.list) {
      if (x === f || !x.alive || x.dead !== undefined || x.provoked || (x.kind !== f.kind && !x.def.calm?.joins) || !x.def.calm?.alarm) continue;
      if (x.pos.distanceTo(f.pos) > x.def.calm.alarm) continue;
      x.provoked = true; x.watcher = false;
      if (x.state === 'idle') x.state = 'chase';
    }
  }

  /** The first time each kind comes for you: what it is and how to beat it, once (NOTES, src/foe-kinds.js; the archetypes', src/enemies/archetypes.js). */
  meet(f) {
    const note = ARCHETYPE_NOTES[f.kind] ?? NOTES[f.kind];
    if (!note || this.own) return;
    const id = `foes.met.${f.kind}`;
    if (this.game.flag(id)) return;
    this.game.set(id, true);
    this.notice?.(note);
  }

  // ------------------------------------------------------------------ the Arena's practice (src/foe-spawner.js)
  /** A foe of `kind` comes in ahead of you (the Arena's spawner, tests, the console: foes.spawnKind('crab'), foes.spawnKind('lizard@bazaar')). */
  spawnKind(kind, { n = FOES[parseKind(kind).kind]?.group ?? 1, dist = 9 } = {}) {
    const P = this.player;
    if (!FOES[parseKind(kind).kind] || !P) return [];
    const h = P.heading ?? 0, out = [];
    for (let i = 0; i < n; i++) {
      const at = this.openSpot(kind, P.pos, h + (i - (n - 1) / 2) * 0.35, dist, 20, 40);
      const f = this.add(kind, at);
      f.heading = Math.atan2(P.pos.x - at.x, P.pos.z - at.z);
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
    this.notice?.('Creatures, possessed machines and shadow spirits: watch their bodies wind up. {key:blade} cuts; {key:guard} guards; {key:evade} evades. A last-moment guard parries. Each foe cut gives the tank a charge back.');
  }

  /** The look follows the mind: a blot wobbles and squashes into its lunge, a machine walks and raises its arms. */
  look(f, dt) {
    const M = f.model, g = M.group, t = (this._t = (this._t ?? 0) + dt / Math.max(1, this.list.length));
    g.visible = true;
    g.position.copy(f.pos);
    g.position.y += f.over;   // (a hovering foe's held height over its footing: HOVER)
    g.rotation.set(0, f.heading, 0);
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
      // a flyer winding up its dive climbs and tips its nose down at you (the body is the tell: nothing on the ground)
      if (f.def.hover && f.state === 'wind') { g.position.y += 0.7 * wind; g.rotation.x = 0.45 * wind; }
      M.eyeMat.uniforms.uColor.value.set(f.state === 'wind' ? '#f05a3c' : f.stunned > 0 ? '#bfe9ff' : M.base);
    } else {
      // the legs: planted by the kit (src/motion-kit/), the hull riding on them; lifted by the magnet glove, they hang
      const c = this.animKit(f, dt, { recovery });
      const o = M.rig.update(f, dt, { eye: c.eye, ground: c.ground, touch: c.touch, recovery, air: f.alt > 0.05 ? 1 : 0 });
      // the slam: one arm high over its shoulder; the quake: both arms high, crouched low on its legs
      const quake = (f.atk ?? f.def.attack).id === 'quake';
      const arm = wind ? -2.6 * wind : strike ? THREE.MathUtils.lerp(-2.6, -0.45, release) : -0.45 * recovery;
      M.arms[0].rotation.x = arm; M.arms[1].rotation.x = quake || !wind ? arm * 0.85 : -0.3 * wind;
      M.body.rotation.y = wind * 0.3 + (strike ? 0.3 * (1 - release) : 0);
      M.hull.position.set(o.x, o.y - (quake && wind ? 0.22 * wind : 0), o.z);
      M.hull.rotation.set(o.pitch - wind * 0.1 + (strike ? release * 0.2 : recovery * 0.2), o.yaw, o.roll);
      g.position.y += f.alt;   // (alt: held up off its feet by the magnet glove, src/gadgets/magnet.js)
      M.eyeMat.uniforms.uColor.value.set(f.state === 'wind' ? '#f0a04b' : f.stunned > 0 ? '#bfe9ff' : '#70e7df');
      M.heart.rotation.z = Math.sin(performance.now() / 300) * (f.state === 'chase' ? 0.2 : 0.05);
      g.scale.setScalar(1);
      M.rig.write();
    }
    // Recoil follows the blow, then settles; a heavy impact also buckles the body.
    const r = Math.sin(f.recoil * Math.PI * 0.5), strength = f.heavyRecoil ? 0.28 : 0.12;
    g.position.addScaledVector(f.recoilDir, r * strength);
    // Compose recoil onto the orientation. Rewriting one Euler component after a
    // quaternion yaw past 90 degrees can discard its equivalent PI roll and invert a shade.
    g.rotateX(r * strength * (f.recoilDir.x * Math.sin(f.heading) + f.recoilDir.z * Math.cos(f.heading)));
    g.rotateZ(-r * strength * (f.recoilDir.x * Math.cos(f.heading) - f.recoilDir.z * Math.sin(f.heading)));
    g.position.y -= f.heavyRecoil ? r * 0.14 : 0;
    // up or down a ledge (HOP): it crouches first, then stretches through the leap; dazed, stars turn over it
    if (f.hop && !M.shade) {
      const c = f.hop.t < HOP.crouch ? Math.sin(Math.PI * 0.5 * Math.min(1, f.hop.t / (HOP.crouch * 0.6))) : 0, up = c ? 0 : 0.1;
      g.scale.x *= 1 + 0.12 * c - up * 0.5; g.scale.z *= 1 + 0.12 * c - up * 0.5; g.scale.y *= 1 - 0.15 * c + up;
    }
    this.daze(f, dt);
    {
    // The body is the tell (src/telegraph.js); only a lobbed shot's landing mark is drawn on the floor.
    const a = f.atk ?? f.def.attack, pts = f.attackPts ?? [f.attackAt];
    const drawn = f.state === 'wind' && groundMark(a);
    for (let i = 0; i < Math.max(pts.length, 1 + (f.teles?.length ?? 0)); i++) {
      const T = i === 0 ? f.tele : ((f.teles ??= [])[i - 1] ??= new Telegraph(this.group, f.def.tone ?? '#6d4fa8'));
      if (drawn && i < pts.length) { T.show(a, pts[i], f.attackH, pts[i].y); T.set(f.k, t); }
      else T.hide();
    }
    }
    this.chargeGlow(f, t);
  }

  /** The glow building on the striking part through a wind-up (src/telegraph.js ChargeGlow), a last flare as it strikes. */
  chargeGlow(f, t) {
    const winding = f.state === 'wind' && !f.stunned, striking = f.state === 'strike' && !f.contacted;
    if (!winding && !striking) { f.glow?.hide(); return; }
    const M = f.model;
    f.glow ??= new ChargeGlow(this.group, f.def.tone ?? '#f05a3c', Math.max(0.14, Math.min(0.5, f.def.radius * 0.45)));
    const a = f.atk ?? f.def.attack, part = M.tell?.(a.id, f) ?? null;
    if (part) { M.group.updateMatrixWorld(true); part.getWorldPosition(_gl); }
    else _gl.copy(f.chest).add(_gf.set(Math.sin(f.heading), 0, Math.cos(f.heading)).multiplyScalar(f.def.radius * 0.9));
    f.glow.set(winding ? f.k : 1, _gl, performance.now() / 1000);
  }

  /** The stars of a foe dazed (Foe.dazed: knocked off a ledge by you), turning over its head. */
  daze(f, dt) {
    if (!(f.dazed > 0) && !f.stars) return;
    if (!f.stars) {
      f.stars = new THREE.Group(); f.stars.name = 'dazed';
      const mat = makeMaterial({ color: '#fff6c2', flat: true, glow: 1, key: 'foe-daze' }), geo = new THREE.OctahedronGeometry(0.19, 0).scale(1, 1.3, 0.45);
      for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(geo, mat); const a = (i / 5) * Math.PI * 2; m.position.set(Math.sin(a) * 0.62, (i % 2) * 0.12, Math.cos(a) * 0.62); m.rotation.y = a; f.stars.add(m); }
      this.group.add(f.stars);
    }
    f.stars.visible = f.dazed > 0 && f.alive && f.dead === undefined;
    if (!f.stars.visible) return;
    f.stars.position.copy(f.chest); f.stars.position.y += 0.85 + Math.sin(performance.now() / 180) * 0.06;
    f.stars.rotation.y += dt * 4.5;
  }

  /** What a kind's own animation may use (src/foe-kinds.js anim(f, c)): the pose's phases and a few effects. */
  animKit(f, dt, o) {
    const T = this.tool, kit = (this._kit ??= {
      dust: (at, color, n = 1, spread = 0.6) => { for (let i = 0; i < n; i++) T?.drops?.add({ pos: _w.set(at.x + (Math.random() - 0.5) * spread * 2, at.y + 0.1, at.z + (Math.random() - 0.5) * spread * 2), vel: _v.set((Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5), drag: 2.5, grav: 7, size: 0.05 + Math.random() * 0.04, life: 0.5, color }); },
      spray: (at, colors, n = 10, speed = 4, grav = 9) => { for (let i = 0; i < n; i++) T?.drops?.add({ pos: at, vel: _v.randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.6)).addScaledVector(_up, 1.5), drag: 2, grav, size: 0.04 + Math.random() * 0.05, stretch: 2, life: 0.55, color: colors[i % colors.length] }); },
      drip: (foe, color) => { this.shadePools ??= new ShadePools(this.scene ?? this.group); this.shadePools.drops.add({ pos: _w.copy(foe.chest).add(_v.randomDirection().multiplyScalar(0.25)), vel: _v.set(0, -0.5, 0), drag: 1, grav: 6, size: 0.04, stretch: 2.5, life: 0.5, color }); },
      tethered: (foe) => this.held(foe),
      // a heavy footfall (the furnace brute's, the bell walker's): the camera shakes and the pad rumbles near it
      thump: (at, k = 1) => {
        const P = this.player; if (!P?.pos) return;
        const d = Math.hypot(P.pos.x - at.x, P.pos.z - at.z);
        if (d > 10) return;
        kick(0.06 * k * (1 - d / 10)); rumblePlay('slam', { dist: d + 6 });
      },
      // for the locomotion kit (src/motion-kit/rig.js): one ground ray per step, a puff where a foot lands
      ground: (x, y, z) => { const g = this.physics?.groundAt?.(x, y, z, 4); return Number.isFinite(g) ? g : null; },
      touch: (at, L) => { if (T?.drops && Math.random() < 0.45) this._kit.dust(at, '#cdb89a', 1, 0.12 * L); },
      // a thrown glob along its arc (u 0..1, < 0 hides it): the i-th of a volley, from (its chest) to (its landing)
      lob: (foe, u, color = '#d7f3d9', i = 0, to = foe.attackAt, from = foe.chest) => {
        const gl = (foe.globs ??= [])[i] ?? (foe.globs[i] = this.group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), makeMaterial({ color, flat: true, glow: 0.3, key: `foe-lob-${color}` }))).children.at(-1));
        gl.visible = u > 0;
        if (u > 0) { gl.position.lerpVectors(from, to, u); gl.position.y += Math.sin(Math.PI * u) * 4 + (1 - u) * 0.6; gl.rotation.x += 0.2; gl.rotation.y += 0.13; }
      },
    });
    return Object.assign(kit, o, { dt, now: performance.now(), eye: this.player?.pos });
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

  dispose() { this.offBell?.(); this.offBell = null; for (const f of this.list.slice()) this.remove(f); this.updateDebris(10); this.group.removeFromParent(); this.warnEl?.remove(); this.reticle?.dispose(); this.blindEl?.remove(); this.shadePools?.dispose(); this.shocks = this.patches = this.waveQueue = null; this.hold = null; }
}
