import * as THREE from 'three';
import { allTargets, targetsInCone } from './targets.js';
import { hitStop, kick } from './feel.js';
import { hasUpgrade, UPGRADES } from './ink.js';
import { fistGrip, carry, fitScale } from './blade-grip.js';
import { buildSword, BladeWake, wakeStyle, WAKE_TONES, HILT } from './fluid-sword.js';
import { SheathState, sheathFrame, buildFrog } from './sword-sheath.js';
import { ShieldDevice, SHIELD, shieldArc } from './shield.js';
import { MAGIC_COST } from './resources.js';
import { rumblePlay } from './rumble.js';

// Three committed cuts: anticipation, release and recovery, with one buffered follow-up.
// Full-body captured poses on the ground, upper-body in the air. The blade's swept segment
// deals damage only during release, once per target. Guard and evade have separate inputs.
// A fresh guard can parry without spending fluid; holding guard spends a charge per block.
// Combat movement is applied by Player through the usual ground and collision controller.

export const BLADE = {
  length: 0.85, width: 0.111, guard: HILT.mouth - 0.012,   // the sword's blade (m; width at its widest), out of the hilt's cup this far up from the grip's middle (in the fist)
  swing: 0.62,          // s a swing takes
  hitAt: 0.5,         // share of the swing when it lands
  chain: 0.45,         // s after a swing in which the next press chains
  reach: 2.9, angle: 1.15,   // the swing's cone: metres from the chest, half-angle (rad, ~65°)
  lock: 6,             // m: the soft lock turns you to a foe this close
  damage: [1, 1, 2],   // the combo's three swings
  cooldown: 0.5,       // after the third swing
  buffer: 0.2,         // s a press is remembered while the blade can't swing yet (an evade, the cooldown): it swings as soon as it can
};
/**
 * The cut's pull (attack magnetism): a swing begun with a foe a little out of reach steps you in through its wind-up
 * and cut, so the blade lands where you meant it: up to `max` m, to stand `ideal` m off its body.
 */
export const MAGNET = { max: 2.2, ideal: 1.2 };
/**
 * The rising cut (v0.97): a swing begun on the ground at a foe hovering `min`+ m over the chest, within `flat` m,
 * leaps you up to it (to its height, at most `max` m) and in, and cuts on the way up; its cut is the leap's cone (the
 * captured arms swing level). `gravity` is the traveller's (player.js GRAVITY).
 */
export const RISE = { min: 1.0, flat: 4.5, max: 2.8, gravity: 32 };
/** The leap for a foe `dy` m over the chest and `d` m off (flat) through a wind-up and cut of `time` s: { up, speed } m/s, or null (not one to rise to). */
export function riseTo(dy, d, time, R = RISE) {
  if (!(dy >= R.min) || !(d <= R.flat) || !(time > 0)) return null;
  const h = Math.min(dy, R.max);
  return { up: Math.sqrt(2 * R.gravity * h), speed: Math.max(0, d - 1.2) / time };
}
/** How fast (m/s) a swing of `time` s (its wind-up and cut) must step to close on a foe `d` m away (flat, its body's `radius`): 0 in reach or too far. */
export function closeInSpeed(d, radius, time, M = MAGNET) {
  const gap = d - radius - M.ideal;
  return gap > 0 && gap <= M.max && time > 0 ? gap / time : 0;
}

/**
 * The three swings from motion capture (Mixamo's Sword and Shield pack, in public/anim/moves.glb:
 * scripts/mocap/mixamo-clips.json): source ranges from anticipation through follow-through.
 * attackSample maps explicit phase durations onto the source, accelerating through `hit`. Right to left and down; a rising backhand, left
 * to right; an overhead cut from above the head. Without the clips (not loaded yet) the arcs below.
 */
export const SWINGS = [
  { clip: 'mixamo_ss_slash_1', from: 0.12, to: 1.02, hit: 0.6, wind: 0.22, active: 0.16, recover: 0.24 },
  { clip: 'mixamo_ss_slash_3', from: 0.32, to: 1.35, hit: 0.87, wind: 0.25, active: 0.17, recover: 0.26 },
  { clip: 'mixamo_ss_attack_1', from: 0.55, to: 1.7, hit: 1.15, wind: 0.36, active: 0.2, recover: 0.34 },
];
export const SWING_SPEED = 1; // Legacy consumers; attacks now have authored phase timing.
/**
 * The evade: `duration` s long, `cooldown` s from one to the next, at `speed`. Its invulnerability (i-frames):
 * from `iframes[0]` to `iframes[1]` s into it (Gentle: `gentle`) no foe's blow lands (Foes.strike, the
 * shockwaves, the slag; src/foes.js). A window closed, the next one opens only `rest` s later at the
 * soonest: an evade begun before that runs without (spamming it is never unbroken cover).
 * `perfect`: the hit-stop (s) of an evade whose i-frames swallow a blow (a perfect dodge).
 */
export const EVADE = { duration: 0.28, cooldown: 0.65, speed: 7.5, iframes: [0.03, 0.24], gentle: [0.02, 0.28], rest: 0.3, perfect: 0.05 };
/** The i-frame window [from, to] (s into an evade) for this setting. */
export const iframeWindow = (gentle = false, E = EVADE) => (gentle ? E.gentle : E.iframes);
/** Is an evade `age` s old invulnerable (it was given i-frames: `granted`)? */
export const evadeInvulnerable = (age, gentle = false, granted = true, E = EVADE) => {
  const [a, b] = iframeWindow(gentle, E);
  return granted && age >= a && age < b;
};
/** The source-time window of a captured swing in which the blade cuts: [from, to]. */
export const activeRange = (S) => [S.activeFrom ?? S.hit - 0.08, S.activeTo ?? S.hit + 0.1];
/** How much wider than a target's sphere the blade's segment may pass and still touch it (m). */
export const BLADE_TOUCH = 0.12;
/** The sphere the swept blade is tested against for a target (its radius, the margin on top). */
export const bladeTouchRadius = (target) => (target.radius ?? 0.5) + BLADE_TOUCH;
function smooth01(x) { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); }
/** Time within the captured clip: anticipation, fast cut, follow-through. */
export function attackSample(S, elapsed) {
  const wind = S.wind ?? 0.3, active = S.active ?? 0.2, recover = S.recover ?? 0.3;
  const duration = wind + active + recover;
  const [a, b] = activeRange(S);
  const lerp = THREE.MathUtils.lerp, clamp = (v) => THREE.MathUtils.clamp(v, 0, 1);
  const t = elapsed < wind ? lerp(S.from, a, clamp(elapsed / wind)) : elapsed < wind + active
    ? lerp(a, b, clamp((elapsed - wind) / active)) : lerp(b, S.to, clamp((elapsed - wind - active) / recover));
  return { t, duration, wind, active, phase: elapsed < wind ? 'wind' : elapsed < wind + active ? 'strike' : 'recover' };
}
/** Does the blade's trail sweep now: the displayed clip time inside the attack's active window (its swing frames), or the arc's strike phase. */
export function trailCut(b) {
  if (!b.swinging || b.charging) return false;
  if (!b.move) return b.phase === 'strike';
  const [from, to] = activeRange(b.spec), t = b.tool.player?.swingMove?.t;
  return t !== undefined && t >= from && t <= to;
}
/**
 * The drops a cut flings off its edge this frame (src/fluid-sword.js wakeStyle `style`): `style.drops` of them
 * from the outer part of the blade (`from` last frame's segment, `seg` this frame's; {a: the cup, b: the point}),
 * thrown on with a share of the edge's speed and falling. Plain objects for tool.drops.add.
 */
export function shedDrops(from, seg, dt, style, rand = Math.random) {
  const out = [];
  if (!from || !seg || !(dt > 0)) return out;
  for (let i = 0; i < style.drops; i++) {
    const x = 0.35 + 0.65 * rand(), pos = new THREE.Vector3().lerpVectors(seg.a, seg.b, x);
    const was = new THREE.Vector3().lerpVectors(from.a, from.b, x);
    const vel = pos.clone().sub(was).divideScalar(dt).multiplyScalar(0.3 + 0.2 * rand());
    if (vel.length() > 9) vel.setLength(9);
    out.push({ pos, vel, drag: 2.5, grav: style.grav, size: style.size * (0.6 + 0.8 * rand()), stretch: 3, life: 0.3 + 0.3 * rand(), color: style.dropTones[i % style.dropTones.length] });
  }
  return out;
}

/** Distance to the moving blade, sampled between consecutive poses to avoid tunnelling. */
export function sweptBladeTouches(point, radius, before, after) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), nearest = new THREE.Vector3();
  const line = new THREE.Line3(a, b);
  const steps = Math.max(1, Math.ceil(Math.max(before.a.distanceTo(after.a), before.b.distanceTo(after.b)) / 0.1));
  for (let i = 0; i <= steps; i++) {
    a.lerpVectors(before.a, after.a, i / steps); b.lerpVectors(before.b, after.b, i / steps);
    line.closestPointToPoint(point, true, nearest);
    if (nearest.distanceToSquared(point) <= radius * radius) return true;
  }
  return false;
}
/** The blade's grown moves (src/ink.js): the whirl replaces the third swing and cuts all round; the lunge is a swing begun at a run. */
export const WHIRL = { clip: 'mixamo_gs_high_spin', from: 0.55, to: 1.45, hit: 1.06, activeFrom: 0.65, activeTo: 1.38, wind: 0.25, active: 0.42, recover: 0.28, angle: Math.PI, damage: 2 };
export const LUNGE = { clip: 'mixamo_gs_slide_attack', from: 0.0, to: 0.9, hit: 0.5, dash: 9, damage: 2, reach: 3.6 };
/**
 * The charged cut (v1.3, the Great Sword pack's slash): the blade button still held `after` s into the first swing's
 * wind-up turns it into a charge: the sword drawn back over the right shoulder (the clip from `raiseFrom` to its cocked
 * pose `hold` over `raise` s, blended in from the swing begun over `draw` s) and held there, gathering, as long as the button is; `full` s and it is full (a ring, a
 * ping). Let go: the clip's own swing from `hold`, a wide diagonal sweep (`angle`, `reach`), `damage[1]` full, else
 * `damage[0]`, and it staggers even an armoured foe (`breaks`: src/foes.js Foe.hit). Then the cooldown, as after a third swing.
 */
export const CHARGE = { clip: 'mixamo_gs_slash_1', raiseFrom: 0.3, hold: 0.45, raise: 0.18, draw: 0.2, after: 0.2, full: 0.6, move: 0.3,
  from: 0.45, hit: 0.65, activeFrom: 0.54, activeTo: 0.76, to: 1.05, wind: 0.07, active: 0.17, recover: 0.36, angle: 1.5, reach: 3.3, damage: [2, 3] };
/**
 * The air cut (v1.3, the Great Sword pack's jump attack): a swing begun in the air (not the rising cut) raises the sword
 * over the head with the body held a moment at the top (`lift` m/s up), then cleaves down as the body is driven down
 * (`plunge` m/s) into it, carried in to a foe up to `pull` m out of reach (to stand `ideal` m off its body: the slam lands close); the whole body plays it (the knee up, the landing crouch), its cone tipped `down` rad below
 * level. One an airtime: the next swing waits for the ground.
 */
export const AIR = { clip: 'mixamo_gs_jump_attack', from: 0.72, hit: 1.12, activeFrom: 0.98, activeTo: 1.24, to: 1.42, wind: 0.14, active: 0.17, recover: 0.22,
  lift: 2, plunge: 12, pull: 3.5, ideal: 0.7, down: 0.6, angle: 1.25, reach: 3.2, damage: 2 };
/**
 * The riposte (v1.3, the Sword and Shield pack's slash 4): for `window` s after a perfect parry the blade button plays a
 * fast overhead counter: the sword up over the head and down (cut on the clip's chop, 1.30–1.43 s), `damage` (doubled on
 * the parried foe, which the parry left stunned), and it staggers anyone (`breaks`), held reeling `stagger` s. A gold
 * ring and a bright ring-out as it starts, a heavier one as it lands. The window missed, the blade is as before. The clip's
 * chop comes down `turn` rad to his right (measured on the traveller): he turns that much to his left into it, so it lands
 * on the foe, and steps in to stand `ideal` m off its body (the chop reaches less far than a swing).
 */
export const RIPOSTE = { clip: 'mixamo_ss_slash_4', window: 0.6, from: 1.05, hit: 1.37, activeFrom: 1.3, activeTo: 1.43, to: 1.78, wind: 0.12, active: 0.12, recover: 0.3,
  angle: 1.3, reach: 3.2, damage: 3, stagger: 1.2, turn: 1.3, ideal: 0.5 };
/**
 * The dash cut (v1.3, the Sword and Shield pack's attack 2): the blade button pressed during an evade, or within `late` s
 * of its end, plays a running cut the moment the evade ends: carried forward at `speed` m/s through the wind-up and cut
 * (Player's collision controller moves him); with a foe within `pull` m, past it: to `past` m beyond it, `side` m to its
 * left (the foe on his sword side, the sweep crossing it as he goes by), as fast as that takes (up to `fastest` m/s), still
 * facing it. No i-frames of its own (the
 * evade's are all there are). `cooldown` s from one dash cut to the next: evade, cut, evade again and the press is a
 * plain swing.
 */
export const DASH = { clip: 'mixamo_ss_attack_2', late: 0.15, cooldown: 1.5, speed: 9, pull: 5, side: 1.1, past: 1.0, fastest: 16, from: 0.3, hit: 0.56, activeFrom: 0.49, activeTo: 0.64, to: 1.0, wind: 0.16, active: 0.14, recover: 0.26,
  angle: 1.7, reach: 3.2, damage: 2 };
/** Is a press now a riposte: `since` s after a perfect parry (RIPOSTE.window)? */
export const riposteOpen = (since, R = RIPOSTE) => since >= 0 && since < R.window;
/** Is a press now a dash cut: evading, or `late` s at most after an evade (`since` s; 0 while evading), the dash cut's cooldown `cool` over. */
export const dashOpen = (since, cool, D = DASH) => since <= D.late && cool <= 0;
/** The attacks that end a combo (no chain after them; the cooldown follows), and play as heavy ones (sound, knockback). */
const ENDS = new Set([CHARGE, AIR, RIPOSTE, DASH]);
/** Every attack the blade plays from a captured clip: the combo's three, the grown whirl and lunge, the charged cut, the air cut, the riposte and the dash cut. */
export const ATTACKS = { swing1: SWINGS[0], swing2: SWINGS[1], swing3: SWINGS[2], whirl: WHIRL, lunge: LUNGE, charge: CHARGE, air: AIR, riposte: RIPOSTE, dash: DASH };
/** The charged cut's pose while held `t` s (src/fluid-blade.js CHARGE): drawn back to `hold`, then a slow breath about it. */
export function chargePose(t, C = CHARGE) {
  const k = smooth01(t / C.raise);
  return C.raiseFrom + (C.hold - C.raiseFrom) * k - 0.012 * k * (1 - Math.cos(t * 7));
}
/** The reach step: the blade this much longer, its swing this much further. */
export const REACH_UP = 1.3;
/**
 * The blade's length as drawn and as it cuts (m): BLADE.length (a game's tuning may change it: Ink tide's
 * longer blade, kit/onfoot.js tune), the reach step on top. The mesh is built at BLADE.length once and
 * stretched to this each frame (bladeScale), so a tuning shows on the blade itself.
 */
export const bladeLength = (state, B = BLADE) => B.length * (hasUpgrade('reach', state) ? REACH_UP : 1);
/** How far the blade's mesh, built `built` m long, is stretched to be bladeLength. */
export const bladeScale = (state, built, B = BLADE) => bladeLength(state, B) / built;
/** Each step of ink reached (src/ink.js UPGRADES: the reach, the whirl, the lunge) makes the blade this much broader. */
export const INK_BROADER = 0.1;
/** The blade's width at its widest (m): BLADE.width, broader by INK_BROADER for each step of ink reached. */
export const bladeWidth = (state, B = BLADE) => B.width * (1 + INK_BROADER * UPGRADES.filter((u) => hasUpgrade(u.id, state)).length);
/**
 * The blade as it lights for a swing (`lit` 0..1; src/fluid-blade.js place): grown out of the cup to its length,
 * narrow at first and filling out to its width. { length, width } (m).
 */
export const bladeGrowth = (lit, state, B = BLADE) => {
  const k = Math.max(0.05, lit), s = k * k * (3 - 2 * k);
  return { length: bladeLength(state, B) * k, width: bladeWidth(state, B) * (0.3 + 0.7 * s) };
};
/**
 * The guard: the clips (block idle held round and round, the block played as a strike lands), how wide it
 * covers, and the shield (src/shield.js). What it covers is the shield as drawn (ShieldDevice.arc: the
 * bearings between its rim's edges round the chest); `angle` is that arc for a shield held `reach` in
 * front of the chest, used when there is no shield drawn to measure.
 */
export const GUARD = { idle: 'mixamo_ss_block_idle', parry: 'mixamo_ss_block_1', parryFor: 0.55, reach: 0.45, radius: SHIELD.radius, perfect: 0.18, rearm: 0.35 };
GUARD.angle = shieldArc(new THREE.Vector3(), new THREE.Vector3(0, 0, GUARD.reach), new THREE.Vector3(0, 0, 1), SHIELD.radius).half;
/** How long the blade stays in the fist after the last swing, guard, evade or blow (s); locked on it stays out. (The draw and the sheathe: src/sword-sheath.js.) */
export const STANCE = { linger: 2.5 };
/** Is a strike from `from` in front of someone at `pos` facing `dir` (flat), within GUARD.angle? */
export function inGuard(pos, dir, from, angle = GUARD.angle) {
  const dx = from.x - pos.x, dz = from.z - pos.z, d = Math.hypot(dx, dz);
  if (d < 1e-4) return true;
  return Math.acos(THREE.MathUtils.clamp((dx * dir.x + dz * dir.z) / (d * Math.hypot(dir.x, dir.z) || 1), -1, 1)) <= angle;
}
/** Is the blade in the fist: in a fight (a swing or its chain, the guard, an evade, locked on, a blow taken) or just after one. */
export function bladeDrawn({ ok = true, swinging = false, guarding = false, evading = false, locked = false, since = Infinity } = {}) {
  return ok && (swinging || guarding || evading || locked || since < STANCE.linger);
}

/** The arc a swing's hand follows (u 0..1 along it): side to side (+1 the right), up and down, for the three swings. */
export function swingArc(n, u) {
  const e = u * u * (3 - 2 * u);
  if (n === 2) return { side: 0.15 - 0.3 * e, rise: 0.75 - 1.35 * e, reach: 0.75 + 0.15 * Math.sin(Math.PI * e) };   // overhead, down
  const s = n === 0 ? 1 - 2 * e : -1 + 2 * e;                                                                    // right to left, then back
  return { side: 1.05 * s, rise: 0.15 - 0.1 * Math.cos(Math.PI * e), reach: 0.8 + 0.25 * Math.sin(Math.PI * e) };
}

/** Targets a swing from `origin` along `dir` touches: those in the cone that accept the blade, nearest first. */
export function bladeHits(origin, dir, physics = null, { reach = BLADE.reach, angle = BLADE.angle } = {}) {
  return targetsInCone(origin, dir, reach, angle, physics).filter((h) => h.target.accepts?.includes('blade'));
}

/** The nearest foe the soft lock turns to: a target with lock: true within `range` (flat distance), or null. */
export function lockTarget(from, range = BLADE.lock, targets = allTargets(), locked = null) {
  if (locked?.enabled()) return locked;   // (the lock-on's foe first: src/foes.js)
  let best = null, bd = range;
  for (const t of targets) {
    if (!t.lock || !t.enabled()) continue;
    const p = t.position(), d = Math.hypot(p.x - from.x, p.z - from.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const RIPOSTE_GOLD = '#ffd46b';

export class FluidBlade {
  constructor(tool) {
    this.tool = tool;
    this.n = -1; this.t = 0; this.chainT = 0; this.cool = 0; this.lit = 0; this.hit = false; this.queued = false;
    this.point = new THREE.Vector3(); this.dir = new THREE.Vector3(0, 0, 1); this.pose = { k: 0, point: this.point, dir: this.dir };
    // the sword (src/fluid-sword.js, the selected design): a broad blade of turquoise fluid out of a brass cup, on a
    // leather-wrapped grip in the fist with a brass pommel. The blade grows out of the cup as it lights (its length
    // and width), broader with each step of ink; a wake of fluid trails off its edge through the cut
    const sword = buildSword({ length: BLADE.length, width: BLADE.width, bladeBase: BLADE.guard + 0.012 });
    this.builtLength = sword.builtLength; this.builtWidth = sword.builtWidth;
    this.core = sword.core; this.bladeGroup = sword.blade; this.hilt = sword.hilt; this.swordMat = sword.material;
    this.group = sword.group;
    this.wake = new BladeWake(tool.fx);
    this.group.name = 'fluid blade';
    this.group.visible = false;
    this.group.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; o.frustumCulled = false; });
    tool.fx.add(this.group);
    this.since = Infinity; this.grip = null;
    // out of a fight the sword sits on his back, in a leather frog behind the right shoulder (src/sword-sheath.js):
    // drawn over the shoulder when a fight starts, put back when it is over
    this.sheath = new SheathState();
    this.sheathAt = sheathFrame();
    this.frog = buildFrog();
    this.frog.visible = false;
    // the guard's shield: the makers' disc on the back of the left hand, opening into a shield of the tank's fluid (src/shield.js)
    this.guardK = 0; this.guardT = 0; this.parry = 0;
    this.guardHeld = false; this.guardAge = Infinity; this.guardRearm = 0; this.perfectReady = false;
    this.evadeHeld = false; this.evadeT = 0; this.evadeCool = 0; this.evadeDir = new THREE.Vector3();
    // its i-frames: how long it has run, whether it was given them, the rest before the next can be, a blow swallowed
    this.evadeAge = Infinity; this.evadeGranted = false; this.iframeRest = 0; this.dodged = false; this.gentle = false;
    this.hitTargets = new Set(); this.previousBlade = null; this.buffered = 0; this.closeIn = 0;
    // the counters: the riposte's window after a perfect parry, the dash cut's after an evade (and its cooldown)
    this.sinceParry = Infinity; this.sinceEvade = Infinity; this.dashWant = false; this.dashCool = 0;
    this.device = new ShieldDevice(tool);
    this.shield = this.device.root;
    this.guardArc = null;
    if (tool.player) {
      tool.player.guard = (from) => this.block(from);
      tool.player.dodge = (from, kind, gentle) => this.dodge(from, kind, gentle);
    }
  }

  /** The guard is up (enough to block). */
  get guarding() { return this.guardK > 0.5; }
  /** A block now would be a perfect parry (a fresh guard inside GUARD.perfect). */
  get parryLive() { return this.guarding && this.perfectReady && this.guardAge <= GUARD.perfect; }
  /**
   * The blade cut this frame (the hitbox overlay): update() called strike(), a captured swing between its active
   * source times, an arc in its strike phase.
   */
  get cutting() { return !!this.cutNow; }
  /** The coarse volume a cut first looks in: a cone from the chest along the swing's way (strike()). */
  coarse(out = {}) {
    const T = this.tool, p = T.player, S = this.special, up = hasUpgrade('reach', T.state) ? REACH_UP : 1;
    out.origin = (out.origin ?? new THREE.Vector3()).copy(p.pos).addScaledVector(p.frame.up, 1.1);
    // (the air cut's cone tipped down toward the ground under it)
    out.dir = S?.down ? (out.tilt ??= new THREE.Vector3()).copy(this.dir).multiplyScalar(Math.cos(S.down)).addScaledVector(p.frame.up, -Math.sin(S.down)) : this.dir;
    out.reach = (S?.reach ?? BLADE.reach) * up; out.angle = S?.angle ?? BLADE.angle;
    return out;
  }

  /**
   * A strike from `from` (a foe's position): the guard takes it if it is up, the strike comes from in
   * front, and a charge is left to spend. Then the arm takes the blow (the block clip), the shield
   * flashes, and true; else false (it gets through).
   */
  block(from) {
    const T = this.tool, p = T.player;
    // (the shield as drawn says what it covers; with none drawn, the guard's own arc)
    const arc = this.guardArc;
    if (!p || !this.guarding || !(arc ? inGuard(p.pos, arc.dir, from, arc.half) : inGuard(p.pos, this.dir, from))) return false;
    this.since = 0;
    const perfect = this.parryLive;
    if (!perfect && !T.reserve.use(MAGIC_COST.shield)) { T.sputter?.(); this.device.s.hit('broken'); T.sound?.shieldBreak?.(); return false; }   // (it cracks: the fluid is not there to take it)
    p.perfectBlock = perfect; this.perfectReady = false;
    if (perfect) this.sinceParry = 0;   // (the riposte's window opens)
    this.guardRearm = GUARD.rearm;
    this.parry = GUARD.parryFor;
    hitStop(perfect ? 0.14 : 0.07); kick(perfect ? 0.5 : 0.14);
    T.used('block', p.pos);
    T.sound?.fluidBlock?.(perfect);
    this.device.s.hit(perfect ? 'perfect' : 'block');
    const at = this.device.root.visible ? this.device.centre : _o.copy(p.pos).addScaledVector(p.frame.up, 1.2).addScaledVector(this.dir, GUARD.reach), tones = T.modeTones;
    T.rings?.add({ from: at, dir: this.dir, reach: 0.1, r0: 0.2, r1: 1.1, life: 0.3, color: tones[0], thick: 1 });
    for (let i = 0; i < 18; i++) T.drops?.add({ pos: at, vel: _a.copy(this.dir).multiplyScalar(-2).add(_b.randomDirection().multiplyScalar(3)), drag: 3, grav: 6, size: 0.03, life: 0.4, color: tones[i % tones.length] });
    p.vel?.addScaledVector(this.dir, -2);   // pushed back a step
    if (perfect) { T.sound?.fluidMode?.('stun'); for (let i = 0; i < 12; i++) T.glow?.add({ pos: at, vel: _a.randomDirection().multiplyScalar(2), drag: 3, size: 0.07, life: 0.5, color: '#fff6dc', grow: true }); }
    return perfect ? 'perfect' : true;
  }

  /** The evade's i-frames are on now (`gentle`: the Gentle setting's longer window). */
  iframes(gentle = this.gentle) { return this.evadeT > 0 && evadeInvulnerable(this.evadeAge, gentle, this.evadeGranted); }

  /**
   * A blow (`kind`: 'strike', 'grab', 'shockwave', 'burn') from `from` while evading: swallowed by the i-frames
   * (true), else false (it lands). The first blow an evade swallows is a perfect dodge ('perfect'): the frame
   * freezes a blink, a white ring at the feet, a hum (lingering ground, the burn, gives none).
   */
  dodge(from, kind = 'strike', gentle = this.gentle) {
    this.gentle = !!gentle;
    if (!this.iframes(gentle)) return false;
    if (this.dodged || kind === 'burn') return true;
    this.dodged = true;
    const T = this.tool, p = T.player;
    hitStop(EVADE.perfect); kick(0.08);
    T.sound?.fluidMode?.('stun');
    if (p) {
      const at = _o.copy(p.pos).addScaledVector(p.frame.up, 0.9);
      T.rings?.add({ from: _a.copy(p.pos).addScaledVector(p.frame.up, 0.05), dir: p.frame.up, reach: 0.05, r0: 0.3, r1: 1.4, life: 0.32, color: '#fff6dc', thick: 1 });
      for (let i = 0; i < 10; i++) T.glow?.add({ pos: at, vel: _b.randomDirection().multiplyScalar(1.6), drag: 3, size: 0.05, life: 0.4, color: i % 2 ? '#fff6dc' : T.modeTones?.[0] ?? '#52c8cf', grow: true });
    }
    return 'perfect';
  }

  get swinging() { return this.n >= 0; }

  /**
   * Per frame. press: a fresh press of the blade button; ok: the tool may act (FluidTool.allowed); held: the guard is
   * down; evade: the evade's button; bladeHeld: the blade button is down (held through a wind-up it charges: CHARGE).
   */
  update(dt, press, ok, held = false, evade = false, bladeHeld = false) {
    const T = this.tool, p = T.player;
    this.cutNow = false; this.pose.dir = this.dir; this.pose.lead = true;
    // (how long the blade button has been down since its press: CHARGE.after)
    this.holdT = bladeHeld ? (press ? 0 : (this.holdT ?? -Infinity) + dt) : -Infinity;
    if (p?.onGround) this.airUsed = false;
    this.cool = Math.max(0, this.cool - dt);
    this.evadeCool = Math.max(0, this.evadeCool - dt);
    this.evadeT = Math.max(0, this.evadeT - dt);
    this.sinceEvade = this.evadeT > 0 ? 0 : this.sinceEvade + dt;
    this.sinceParry += dt; this.dashCool = Math.max(0, this.dashCool - dt);
    // (the i-frames' clock: their window closing starts the rest before the next evade may have them)
    const wasOn = this.evadeGranted && this.evadeAge < iframeWindow(this.gentle)[1];
    this.evadeAge = this.evadeT > 0 ? this.evadeAge + dt : Infinity;
    this.iframeRest = Math.max(0, this.iframeRest - dt);
    if (wasOn && !(this.evadeT > 0 && this.evadeAge < iframeWindow(this.gentle)[1])) this.iframeRest = EVADE.rest;
    this.guardRearm = Math.max(0, this.guardRearm - dt);
    this.guardAge += dt;
    if (held && !this.guardHeld) { this.guardAge = 0; this.perfectReady = this.guardRearm === 0; this.guardRearm = GUARD.rearm; }
    if (!held) this.perfectReady = false;
    this.guardHeld = held;
    const dodgePress = evade && !this.evadeHeld; this.evadeHeld = evade;
    if (ok && dodgePress && !this.evadeT && !this.evadeCool && p?.onGround && (!this.swinging || this.phase === 'recover' || this.charging)) {
      this.stop(); this.evadeT = EVADE.duration; this.evadeCool = EVADE.cooldown;
      this.evadeAge = 0; this.evadeGranted = this.iframeRest === 0; this.dodged = false;
      if (p._moveDir?.lengthSq() > 0.01) this.evadeDir.copy(p._moveDir);
      else p.frame.dir(p.heading, this.evadeDir).negate();
      p.frame.dir(p.heading, this.dir);
      const target = lockTarget(p.pos);
      if (target) {
        _a.subVectors(target.position(), p.pos); _a.addScaledVector(p.frame.up, -_a.dot(p.frame.up));
        if (_a.lengthSq() > 1e-6) this.dir.copy(_a).normalize();
      }
      this.guardK = 0;
    }
    if (held) this.queued = false;
    if (p) p.combatMotion = null;
    this.chainT = Math.max(0, this.chainT - dt);
    this.parry = Math.max(0, this.parry - dt);
    if (!ok || !p) {
      // (climbing, swimming, gliding, on the jets, aiming, riding, knocked down, a scene: the blade put away at once, the shield folds)
      this.stop(); this.evadeT = 0; this.guardK = 0; this.guardWant = false; this.since = Infinity;
      this.sheath.update(dt, false, { ok: false });   // (flown back to the frog, no reach: the arms are busy)
      this.placeShield(dt); return this.fade(dt);
    }
    // the riposte: a press in the window a perfect parry opened (the guard may still be held)
    if (press && riposteOpen(this.sinceParry) && !this.swinging && !this.evadeT && p.onGround) { this.sinceParry = Infinity; this.buffered = 0; press = false; this.start(0, RIPOSTE); }
    // the dash cut: a press during an evade (or just after it) cuts as the evade ends, once a cooldown
    if (press && this.evadeT > 0) this.dashWant = true;
    if ((this.dashWant || press) && !this.evadeT && !this.swinging && !held && p.onGround && this.cool === 0 && dashOpen(this.sinceEvade, this.dashCool)) { this.dashWant = false; this.buffered = 0; press = false; this.start(0, DASH); }
    if (this.sinceEvade > DASH.late || this.dashCool > 0) this.dashWant = false;
    // a press is kept a moment (BLADE.buffer): pressed during an evade or the cooldown, it swings as soon as it can
    if (press && !held) this.buffered = BLADE.buffer;
    else this.buffered = Math.max(0, this.buffered - dt);
    if (this.buffered > 0 && !held && !this.evadeT) {
      if (this.swinging) { this.queued = this.n < 2 && !ENDS.has(this.special); this.buffered = 0; }   // chained: the next swing follows this one (not after the charged or the air cut)
      else if (this.cool === 0 && !(this.airUsed && !p.onGround)) { this.start(this.chainT > 0 ? Math.min(this.last + 1, 2) : 0); this.buffered = 0; }
    }
    // held through the first swing's wind-up: the charge (CHARGE), on the ground, the clip there
    if (this.swinging && !this.charging && this.n === 0 && !this.special && !this.chained && this.phase === 'wind' && bladeHeld && this.holdT >= CHARGE.after
      && p.onGround && p.animator?.moveClip?.(CHARGE.clip)) {
      this.charging = { t: 0, full: false }; this.phase = 'charge'; T.sound?.fluidCharge?.(false);
    }
    if (this.charging) {
      const C = this.charging;
      C.t += dt;
      if (!C.full && C.t >= CHARGE.full) {
        C.full = true; T.sound?.fluidCharge?.(true);
        const at = _o.copy(p.pos).addScaledVector(p.frame.up, 1.2);
        T.rings?.add({ from: at, dir: p.frame.up, reach: 0.05, r0: 0.25, r1: 1.2, life: 0.3, color: '#fff6dc', thick: 1 });
      }
      // turned to the nearest foe while it gathers
      const foe = lockTarget(p.pos, BLADE.lock, allTargets(), T.lockOn?.() ?? null);
      if (foe) { _a.subVectors(foe.position(), p.pos); _a.addScaledVector(p.frame.up, -_a.dot(p.frame.up)); if (_a.lengthSq() > 1e-6) this.dir.copy(_a).normalize(); }
      if (!bladeHeld || !p.onGround) this.release();
    }
    if (this.swinging && !this.charging) {
      const previousTime = this.t * this.dur;
      this.t += dt / this.dur;
      this.sample = attackSample(this.spec, this.t * this.dur);
      this.phase = this.sample.phase;
      if (!this.released && this.t * this.dur >= this.sample.wind) {
        this.released = true; T.sound?.fluidSlash?.(ENDS.has(this.special) ? 2 : this.n);
        if (this.special === AIR && !p.onGround) p.airKick = { up: -AIR.plunge, ...(this.airPull ? { dir: this.dir, speed: 1 } : {}) };   // (the air cut: driven down into it, the carry in spent)
      }
      // Player poses before the tool updates. Use the source time actually displayed, not
      // the next requested pose, so damage follows the visible hand even on a long frame.
      if (this.move) {
        const displayed = p.swingMove?.id === this.swingId ? p.swingMove.t : null;
        const [from, to] = activeRange(this.spec);
        if (displayed !== null && displayed >= from && (this.contactT ?? displayed) <= to) this.strike();
        this.contactT = displayed;
      } else if (this.t * this.dur >= this.sample.wind && previousTime < this.sample.wind + this.sample.active) this.strike();
      if (this.t >= 1) {
        this.last = this.n; this.n = -1; p.swingMove = null;
        if (this.last === 2 || ENDS.has(this.special)) { this.cool = BLADE.cooldown; this.chainT = 0; }
        else { this.chainT = BLADE.chain; if (this.queued) this.start(this.last + 1); }
        this.queued = false;
      }
    }
    // A captured swing poses the whole grounded body; the aim layer only turns toward the target.
    if (this.swinging && this.move && T.k < 0.05) {
      const S = this.move, u = Math.min(this.t, 1), m = (p.swingMove ??= {});
      if (this.charging) { m.clip = CHARGE.clip; m.t = chargePose(this.charging.t); }
      else { m.clip = S.clip; m.t = this.sample.t; }
      m.air = S === AIR; m.full = !!p.onGround || m.air; m.id = this.swingId; m.blend = this.charging ? CHARGE.draw : 0.09;
      // (in over 70 ms, out over 120; the charged cut let go is already in: no dip back toward the loops)
      m.w = this.charging ? 1 : THREE.MathUtils.clamp(Math.min(S === CHARGE ? 1 : u * this.dur / 0.07, (1 - u) * this.dur / 0.12), 0, 1);
      // (the riposte: turned into its chop, which comes down to his right)
      this.pose.dir = this.special === RIPOSTE ? (this._turned ??= new THREE.Vector3()).copy(this.dir).applyAxisAngle(p.frame.up, RIPOSTE.turn) : this.dir;
      this.pose.lead = this.special !== RIPOSTE;
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.pose.dir, 3);
      this.pose.k = 1; this.pose.noArm = true;
      p.aim = this.pose;
    }
    // the arm follows the arc (the tool's aim pose, unless the tool is aiming itself)
    else if (this.swinging && T.k < 0.05) {
      this.pose.noArm = false;
      const U = p.frame.up, F = this.dir, R = _r.crossVectors(F, U).normalize();
      const a = swingArc(this.n, Math.min(this.t, 1));
      const chest = _o.copy(p.pos).addScaledVector(U, 1.35);
      this.point.copy(chest).addScaledVector(F, a.reach).addScaledVector(R, a.side).addScaledVector(U, a.rise);
      this.pose.k = Math.min(1, 0.35 + this.t * 3);
      p.aim = this.pose;
    }
    // the guard: held after the swing (or with no swing to finish), turned to the nearest foe
    const want = held && !this.swinging && !this.evadeT && T.k < 0.05;
    this.guardWant = want;
    this.guardK += ((want ? 1 : 0) - this.guardK) * (1 - Math.exp(-(want ? 14 : 10) * dt));
    if (this.guardK < 0.01) this.guardK = 0;
    if (this.guardK > 0 && !this.swinging) {
      this.guardT += dt;
      const foe = lockTarget(p.pos, BLADE.lock, allTargets(), T.lockOn?.() ?? null);
      if (foe) { this.dir.subVectors(foe.position(), p.pos); this.dir.addScaledVector(p.frame.up, -this.dir.dot(p.frame.up)); if (this.dir.lengthSq() > 1e-6) this.dir.normalize(); }
      else if (!want) { /* (easing out: keep the last way) */ }
      else p.frame.dir(p.heading, this.dir);
      const A = p.animator, idle = A?.moveClip?.(GUARD.idle);
      if (idle) {
        const m = (p.swingMove ??= {});
        if (this.parry > 0 && A.moveClip(GUARD.parry)) { m.clip = GUARD.parry; m.t = GUARD.parryFor - this.parry; }
        else { m.clip = GUARD.idle; m.t = this.guardT % idle.duration; }
        m.w = this.guardK; m.full = false; m.id = this.parry > 0 ? "block" : "guard";
      }
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.dir, 3);
      this.pose.k = this.guardK; this.pose.noArm = !!idle;
      p.aim = this.pose;
    } else if (!this.swinging && p.swingMove) p.swingMove = null;
    if (!want && this.guardK === 0) this.guardT = 0;
    this.lit += ((this.swinging ? 1 : 0) - this.lit) * (1 - Math.exp(-(this.swinging ? 30 : 9) * dt));
    if (this.charging) this.lit = 0.8 + 0.2 * Math.sin(this.charging.t * (this.charging.full ? 26 : 12));   // (gathering: the blade pulses, faster once full)
    if (this.evadeT && p.onGround) {
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.dir, 3);
      this.pose.k = 1; this.pose.noArm = true; p.aim = this.pose;
      p.combatMotion = { dir: this.evadeDir, speed: EVADE.speed * (0.55 + 0.45 * Math.sin(Math.PI * this.evadeT / EVADE.duration)), scale: 0, evade: this.evadeT / EVADE.duration };
    } else if (this.charging && p.onGround) {
      p.combatMotion = { dir: this.dir, speed: 0, scale: CHARGE.move };   // (gathering: a slow step at most)
    } else if (this.swinging && p.onGround) {
      const active = this.phase === 'strike';
      // (closing in on a foe just out of reach: MAGNET, through the wind-up and the cut)
      const pull = this.phase !== 'recover' ? this.closeIn : 0;
      // (the dash cut: carried on through its wind-up and cut, slowing through the follow-through)
      if (this.special === DASH) p.combatMotion = { dir: this.dashDir, speed: this.phase === 'recover' ? this.dashSpeed * 0.25 * (1 - this.t) : this.dashSpeed, scale: 0.15, dash: true };
      else p.combatMotion = { dir: this.dir, speed: Math.max(active ? (this.special === LUNGE ? 7 : 1.7) : 0, pull), scale: this.phase === 'recover' ? 0.45 : 0.15 };
    }
    // in a fight the blade stays in the fist (a while after, and all the time locked on), then is put away
    this.since += dt;
    if (this.swinging || this.evadeT || this.guardK > 0.05 || p._flinch) this.since = 0;
    const drawWant = bladeDrawn({ ok, swinging: this.swinging, guarding: this.guardK > 0.05, evading: this.evadeT > 0, locked: !!p.lockOn, since: this.since });
    // (drawn over the shoulder; a swing pressed with it on the back starts at once and the hilt is in the fist before its cut)
    this.sheath.update(dt, drawWant, { quick: this.swinging });
    this.place(dt);
    this.placeShield(dt);
  }

  /**
   * The shield on the back of the left hand (src/shield.js): open while the guard is wanted, turned to its
   * way; then the guard's arc from where it is drawn (block). The hands close round it (player.shieldGrip).
   */
  placeShield(dt = 0) {
    const T = this.tool, p = T.player, D = this.device;
    const U = p?.frame?.up, chest = U ? _f.copy(p.pos).addScaledVector(U, 1.1) : null;   // (the open shield slides to the chest's middle line)
    const said = D.update(dt, { want: !!this.guardWant, worn: !!p && T.worn !== false, dir: this.dir, up: U, chest, time: T.time ?? 0 });
    if (said === 'open') T.sound?.shieldOpen?.();
    else if (said === 'close') T.sound?.shieldClose?.();
    if (p) p.shieldGrip = D.s.k;
    this.guardArc = p && U ? D.arc(_o.copy(p.pos).addScaledVector(U, 1.1), U) : null;
  }

  /** A swing: the combo's `n`th, or a counter (`force`: RIPOSTE, DASH). */
  start(n, force = null) {
    const T = this.tool, p = T.player, U = p.frame.up;
    this.chained = this.n >= 0 || this.chainT > 0;
    this.charging = null; this.chargeFull = false;
    this.n = n; this.t = 0; this.hit = false; this.released = false; this.phase = "wind"; this.swingId = (this.swingId ?? 0) + 1; this.hitTargets.clear(); this.previousBlade = null; this.contactT = null;
    // the captured swing if the clip is there, else the arc; grown: the whirl for the third, the lunge from a run
    // (the lunge: a swing begun at a run, or locked on and closing in fast)
    const closing = p.lockOn && p.vel && p.vel.dot(p.lockOn.dir) > 2.5;
    // (in the air: the air cut, once an airtime, if its clip is there)
    const A = p.animator, air = !force && !p.onGround && !!A?.moveClip?.(AIR.clip);
    this.special = force ? force : air ? AIR : !this.chained && n === 0 && (p.sprinting || closing) && hasUpgrade('lunge', T.state) ? LUNGE : n === 2 && hasUpgrade('whirl', T.state) ? WHIRL : null;
    if (air) this.airUsed = true;
    const S = this.special ?? SWINGS[n];
    this.move = S && A?.moveClip?.(S.clip) ? S : null;
    this.spec = S; this.sample = attackSample(S, 0); this.dur = this.sample.duration;
    this.hitAt = (this.sample.wind + this.sample.active * 0.45) / this.dur;
    // the swing's way: toward the nearest foe in reach, else where the traveller faces
    const foe = lockTarget(p.pos, BLADE.lock, allTargets(), T.lockOn?.() ?? null);
    if (foe) this.dir.subVectors(foe.position(), p.pos); else p.frame.dir(p.heading, this.dir);
    this.dir.addScaledVector(U, -this.dir.dot(U));
    // a foe just out of reach: the swing steps you in to it (not the lunge, which carries you itself); one hovering
    // over you: a rising cut, up to it
    const flat = this.dir.length(), time = this.sample.wind + this.sample.active;
    const rise = foe && this.special !== LUNGE && !force && p.onGround ? riseTo(foe.position().dot(U) - p.pos.dot(U) - 1.1, flat, time) : null;
    this.rising = !!rise;
    if (rise) p.riseKick = { up: rise.up, speed: rise.speed, dir: this.dir.clone().normalize() };
    this.closeIn = foe && !rise && this.special !== LUNGE && this.special !== DASH && p.onGround ? closeInSpeed(flat, foe.radius ?? 0.6, time, force === RIPOSTE ? { ideal: RIPOSTE.ideal, max: MAGNET.max } : MAGNET) : 0;
    if (force === DASH) {
      // past the foe on its left (on his sword side), through its line; with none near, straight on
      this.dashCool = DASH.cooldown; T.sound?.fluidDash?.();
      const F = _f.copy(this.dir).normalize(), time = this.sample.wind + this.sample.active;
      (this.dashDir ??= new THREE.Vector3()).copy(F); this.dashSpeed = DASH.speed;
      if (foe && flat <= DASH.pull) {
        const R = _r.crossVectors(F, U).normalize();
        this.dashDir.copy(this.dir).addScaledVector(F, DASH.past).addScaledVector(R, -DASH.side);
        this.dashSpeed = THREE.MathUtils.clamp(this.dashDir.length() / time, DASH.speed * 0.6, DASH.fastest);
        this.dashDir.normalize();
      }
    }
    if (force === RIPOSTE) {
      // (turned into the chop at once: it comes down RIPOSTE.turn to his right)
      p.heading = p.frame.headingOf(_f.copy(this.dir).normalize().applyAxisAngle(U, RIPOSTE.turn));
      T.sound?.fluidRiposte?.(false);
      const at = _o.copy(p.pos).addScaledVector(U, 1.2);
      T.rings?.add({ from: at, dir: U, reach: 0.05, r0: 0.3, r1: 1.5, life: 0.28, color: RIPOSTE_GOLD, thick: 1 });
    }
    // the air cut: held a moment at the top, and carried in to a foe a little out of reach (AIR.pull) as the ground's pull does
    if (air) {
      const reach = foe ? closeInSpeed(flat, foe.radius ?? 0.6, this.sample.wind, { ideal: AIR.ideal, max: AIR.pull }) : 0;
      this.airPull = reach > 0;
      p.airKick = { up: Math.max(p.vel ? p.vel.dot(U) : 0, AIR.lift), ...(reach > 0 ? { dir: this.dir.clone().normalize(), speed: reach } : {}) };
    }
    if (this.dir.lengthSq() < 1e-6) p.frame.dir(p.heading, this.dir);
    this.dir.normalize();
    T.used('blade', p.pos);
  }

  /** The charge let go (CHARGE): the clip's own swing from the cocked pose, full or not. */
  release() {
    const p = this.tool.player;
    this.chargeFull = !!this.charging?.full; this.charging = null;
    rumblePlay('charged', { full: this.chargeFull });   // (src/rumble.js)
    this.special = CHARGE; this.spec = CHARGE; this.move = p?.animator?.moveClip?.(CHARGE.clip) ? CHARGE : null;
    this.t = 0; this.released = false; this.hit = false; this.hitTargets.clear(); this.previousBlade = null; this.contactT = null;
    this.sample = attackSample(CHARGE, 0); this.dur = this.sample.duration; this.phase = 'wind';
    this.hitAt = (this.sample.wind + this.sample.active * 0.45) / this.dur;
    // (a foe a little out of reach: the sweep steps you in, as a swing does: MAGNET)
    const T = this.tool, foe = p ? lockTarget(p.pos, BLADE.lock, allTargets(), T.lockOn?.() ?? null) : null;
    if (foe && p.onGround) { _a.subVectors(foe.position(), p.pos); _a.addScaledVector(p.frame.up, -_a.dot(p.frame.up)); }
    this.closeIn = foe && p.onGround ? closeInSpeed(_a.length(), foe.radius ?? 0.6, this.sample.wind + this.sample.active) : 0;
  }

  /** The active cut: coarse range/occlusion first, then the actual swept blade. */
  strike() {
    const T = this.tool, S = this.special;
    this.cutNow = true;
    const C = this.coarse(this._coarse ??= { origin: _o }), origin = C.origin;
    let hits = bladeHits(origin, C.dir, T.physics, { reach: C.reach, angle: C.angle });
    const pose = this.rising ? null : this.bladeSegment();   // (the rising cut: the leap's cone, the arms swing level)
    if (pose) hits = hits.filter((h) => sweptBladeTouches(h.target.position(), bladeTouchRadius(h.target), this.previousBlade ?? pose, pose));
    hits = hits.filter((h) => !this.hitTargets.has(h.target));
    for (const h of hits) this.hitTargets.add(h.target);
    const damage = S === CHARGE ? CHARGE.damage[this.chargeFull ? 1 : 0] : S?.damage ?? BLADE.damage[this.n] ?? 1;
    const info = { ...T.info(), damage, combo: S ? 2 : this.n, ...(S === CHARGE ? { breaks: true } : {}), ...(S === AIR ? { air: true } : {}), ...(S === RIPOSTE ? { breaks: true, stagger: RIPOSTE.stagger, riposte: true } : {}) };
    for (const h of hits) h.target.onHit?.('blade', h.point, h.dir, { ...info, mode: 'blade' });
    // wildlife in the cone scatters (it doesn't list the blade: it never feels it, it just runs)
    for (const h of targetsInCone(origin, this.dir, BLADE.reach, BLADE.angle, T.physics)) if (h.target.kind === 'wildlife' && !this.hitTargets.has(h.target)) { this.hitTargets.add(h.target); h.target.onHit?.('push', h.point, h.dir, info); }
    if (hits.length) {
      T.lastHit = 'target';
      hitStop((S === CHARGE && this.chargeFull) || S === RIPOSTE ? 0.15 : this.n === 2 || S ? 0.11 : 0.06); kick(S === CHARGE || S === RIPOSTE ? 0.7 : this.n === 2 || S ? 0.5 : 0.25);   // (the cut lands: the frame freezes, src/feel.js)
      if (S === RIPOSTE) {
        // (the riposte lands: a gold burst off the foe, a ring-out)
        T.sound?.fluidRiposte?.(true);
        for (const h of hits) {
          T.rings?.add({ from: h.point, dir: this.dir, reach: 0.1, r0: 0.2, r1: 1.4, life: 0.32, color: RIPOSTE_GOLD, thick: 1 });
          for (let i = 0; i < 14; i++) T.glow?.add({ pos: h.point, vel: _a.randomDirection().multiplyScalar(3), drag: 3, size: 0.06, life: 0.45, color: i % 2 ? '#fff6dc' : RIPOSTE_GOLD, grow: true });
        }
      }
      for (const h of hits) T.splash(h.point, h.dir.clone().negate(), 0.6);
      this.hit = true;
    }
    T.sound?.fluidSlashHit?.(hits.length > 0, info.combo === 2);
    return hits;
  }

  /** The blade as drawn (or as it would be, lit by `lit`): from the guard to the tip, in the world, the hilt in the fist. Null with no fist to hold it. */
  bladeSegment(lit = this.lit) {
    const p = this.tool.player;
    if (!p?.humanoid?.b?.hand_r || !this.move) return null;
    const m = this.gripMatrix(_m1);
    if (!m) return null;
    const base = BLADE.guard + 0.012, len = bladeLength(this.tool.state) * Math.max(0.05, lit);
    // (in the hilt's own frame, as the blade is drawn in it: carried at world size, the bone's scale undone)
    return { a: new THREE.Vector3(0, base, 0).applyMatrix4(m), b: new THREE.Vector3(0, base + len, 0).applyMatrix4(m) };
  }

  stop() { this.charging = null; if (this.tool.player) this.tool.player.combatMotion = null; this.n = -1; this.queued = false; if (this.tool.player) this.tool.player.swingMove = null; }

  fade(dt) { this.lit += (0 - this.lit) * (1 - Math.exp(-12 * dt)); this.place(dt); }

  /** Where the hilt sits in the right fist (src/blade-grip.js fistGrip, worked out once per body): this.grip, or null with no fist. */
  fist() {
    const H = this.tool.player?.humanoid;
    if (H && this.grip?.humanoid === H) return this.grip;
    const g = H?.b?.hand_r ? fistGrip(H) : null;
    this.grip = g ? { ...g, humanoid: H } : null;
    return this.grip;
  }

  /** The hilt's world matrix in the fist (at world size), into `out`; null with no fist. */
  gripMatrix(out) {
    const g = this.fist();
    if (!g) return null;
    g.bone.updateWorldMatrix(true, false);
    g.bone.matrixWorld.decompose(_p1, _q1, _s1);
    _p1.copy(g.position).applyMatrix4(g.bone.matrixWorld); _q1.multiply(g.quaternion);
    return out.compose(_p1, _q1, _s1.set(1, 1, 1));
  }

  /** The hilt's world matrix in its frog on the back (src/sword-sheath.js), into `out`; null with no chest to wear it on. */
  backMatrix(out) {
    const C = this.tool.player?.humanoid?.chestAnchor;
    if (!C) return null;
    C.updateWorldMatrix(true, false);
    C.matrixWorld.decompose(_p1, _q1, _s1);
    _p1.copy(this.sheathAt.position).applyMatrix4(C.matrixWorld); _q1.multiply(this.sheathAt.quaternion);
    return out.compose(_p1, _q1, _s1.set(1, 1, 1));
  }

  /** The hilt in the right fist (src/blade-grip.js): carried by the hand's bone, where the body's own fingers close. */
  mountGrip() {
    const g = this.fist();
    if (!g) { if (this.group.parent !== this.tool.fx) this.tool.fx.add(this.group); return false; }
    if (this.group.parent === g.bone) { fitScale(this.group); return true; }
    return carry(this.group, g);
  }

  /** The frog (and the hilt, when it is in it) on the chest anchor, behind the right shoulder. */
  mountBack(object) {
    const C = this.tool.player?.humanoid?.chestAnchor;
    if (!C) return false;
    return carry(object, { bone: C, position: this.sheathAt.position, quaternion: this.sheathAt.quaternion });
  }

  /**
   * The sword where the sheath says (src/sword-sheath.js): in its frog on his back, in the fist, or on its way
   * between them (the world's blend of the two, the hand at the frog by then); lit (grown out of the guard)
   * while it swings, a trail of fluid off its edge. The right arm reaches back for it (player.sheathReach).
   */
  place(dt) {
    this.previousBlade = this.bladeSegment();
    const T = this.tool, p = T.player, S = this.sheath;
    // (worn with the backpack: the hands and the back bare without it)
    const on = p?.object?.visible !== false && T.owned !== false;
    const held = S.held;
    this.group.visible = on;
    const frogOn = on && !!this.mountBack(this.frog);
    this.frog.visible = frogOn;
    if (p) {
      p.swordGrip = on ? held : 0;
      const R = (p.sheathReach ??= { k: 0, at: this.sheathAt.position });
      R.k = on ? S.reach : 0; R.grip = this.fist()?.position ?? null;
    }
    if (!on) { this.wake.update(dt, null, false); return; }
    let placed = false;
    if (held >= 1) placed = this.mountGrip();
    else if (held <= 0) placed = this.mountBack(this.group);
    else {
      // on its way: the world's blend of the frog's place and the fist's (the hand is at the frog as it changes hands)
      const a = this.backMatrix(_m1), b = a && this.gripMatrix(_m2);
      if (a && b) {
        a.decompose(_p2, _q2, _s2); b.decompose(_p1, _q1, _s1);
        _p2.lerp(_p1, held); _q2.slerp(_q1, held);
        if (this.group.parent !== T.fx) T.fx.add(this.group);
        T.fx.updateWorldMatrix(true, false);
        _m2.compose(_p2, _q2, _s2.set(1, 1, 1)).premultiply(_m1.copy(T.fx.matrixWorld).invert());
        _m2.decompose(this.group.position, this.group.quaternion, this.group.scale);
        placed = true;
      } else placed = held > 0.5 ? this.mountGrip() : this.mountBack(this.group);
    }
    if (!placed) {
      // no fist and no back (a body without hands): at the glove's mouth, along the arm, as before there were fists
      const hand = T.muzzle(_a), B = p?.humanoid?.b;
      const along = B?.upperarm_r ? _f.subVectors(hand, B.upperarm_r.getWorldPosition(_b)).normalize() : _f.copy(this.point).sub(hand).normalize();
      if (along.lengthSq() < 1e-8) along.set(0, 1, 0);
      if (this.group.parent !== T.fx) T.fx.add(this.group);
      this.group.position.copy(hand);
      this.group.quaternion.setFromUnitVectors(_Y, along);
      this.group.scale.setScalar(1);
      this.group.visible = held > 0.02 || this.lit > 0.03;
    }
    // (the blade only once the hilt is in the fist: a swing begun with it on the back lights as it arrives)
    this.bladeGroup.visible = this.lit > 0.03 && (held > 0.97 || !placed);
    // (the blade grows out of the cup as it lights: its length tuned and upgraded, its width filling out, broader with ink)
    const grown = bladeGrowth(this.lit, T.state);
    this.bladeGroup.scale.set(grown.width / this.builtWidth, grown.length / this.builtLength, 1);
    const U = this.swordMat.uniforms.uFluidA.value;
    U.z = (T.time ?? 0) + (this._inspectT ?? 0);   // (the currents flow up it)
    const seg = this.swinging && dt > 0 ? this.bladeSegment() ?? { a: this.group.getWorldPosition(_a).clone(), b: this.point.clone() } : null;
    const cut = !!seg && !this.charging && trailCut(this) && !!this.trailFrom;
    const style = wakeStyle(this.special, this.chargeFull);
    this.wake.update(dt, seg, cut, style, p?.frame?.up);
    if (seg) {
      const tones = style.tones, from = this.trailFrom, n = this.n < 0 ? 0 : this.n;
      if (this.charging) {
        // gathering: sparks drawn in to the blade from round it, and the fluid dripping off it
        for (let i = 0; i < (this.charging.full ? 3 : 2); i++) {
          const at = _o.lerpVectors(seg.a, seg.b, Math.random()), off = _r.randomDirection().multiplyScalar(0.35);
          T.glow.add({ pos: at.add(off), vel: off.multiplyScalar(-4), drag: 2, size: 0.016, life: 0.12, color: this.charging.full ? '#fff6dc' : tones[i % tones.length], grow: false });
        }
        if (Math.random() < dt * 8) T.drops?.add({ pos: _o.lerpVectors(seg.a, seg.b, Math.random() * 0.6), vel: _r.set(0, 0, 0), grav: 9, size: 0.014, stretch: 2.5, life: 0.5, color: WAKE_TONES[0] });
      } else if (cut) {
        // the cut (the clip's own swing frames: activeRange): sparks over the ground the edge crossed since the
        // last frame (fewer than before the wake: it draws the sweep), and drops of fluid flung off the edge
        const steps = Math.min(6, Math.max(1, Math.ceil(from.b.distanceTo(seg.b) / 0.12)));
        for (let k = 1; k <= steps; k++) {
          const u = k / steps, x = 0.7 + 0.3 * ((k + n) % 2);
          _a.lerpVectors(from.a, seg.a, u); _b.lerpVectors(from.b, seg.b, u);
          T.glow.add({ pos: _o.lerpVectors(_a, _b, x), vel: _r.set(0, 0, 0), drag: 8, size: 0.012 + 0.008 * ((k + n) % 2), life: 0.12, color: tones[(n + k) % tones.length], grow: false });
        }
        for (const d of shedDrops(from, seg, dt, style)) T.drops?.add(d);
      } else {
        // wind-up, follow-through: a glint at the tip, and now and then a drip off the splash by the cup
        T.glow.add({ pos: _o.lerpVectors(seg.a, seg.b, 0.9), vel: _r.set(0, 0, 0), drag: 8, size: 0.01, life: 0.06, color: tones[n % tones.length], grow: false });
        if (Math.random() < dt * 6) T.drops?.add({ pos: _o.lerpVectors(seg.a, seg.b, 0.05 + Math.random() * 0.25), vel: _r.set(0, 0, 0), grav: 9, size: 0.012, stretch: 2.5, life: 0.45, color: WAKE_TONES[Math.random() < 0.7 ? 0 : 1] });
      }
    }
    this.trailFrom = seg ? { a: seg.a.clone(), b: seg.b.clone() } : null;
  }

  /**
   * The studio's look at the blade and the shield (studio.html ?backpack=true&sword=true&shield=1&view=arms):
   * the hilt in the fist (lit: the blade out), the shield open by `shield` and struck as `guard` says.
   */
  inspect({ sword = false, lit = 1, shield = 0, guard = '', draw = 0 } = {}, dt = 1 / 60) {
    const p = this.tool.player;
    // (draw: a share of the draw shown, the hand on its way to the back; else the sword in the fist or on the back)
    if (draw > 0 && draw < 1) this.sheath.scrub(draw); else this.sheath.set(sword || draw >= 1);
    const inHand = this.sheath.held >= 1;
    this.lit = inHand && sword ? lit : 0; this.move = inHand ? (this.move ?? SWINGS[0]) : null;
    if (p?.frame?.dir) p.frame.dir(p.heading ?? 0, this.dir);
    const S = this.device.s;
    if (this._guard !== guard) { this._guard = guard; S.flare = S.flash = S.crack = 0; if (S.state === 'broken') S.state = 'open'; }
    S.k = shield; S.state = shield >= 1 ? 'open' : shield > 0 ? 'opening' : 'folded';
    if (guard === 'block') S.flare = 0.6; else if (guard === 'parry') { S.flash = 0.7; S.flare = 0.7; } else if (guard === 'broken') { S.crack = 0.8; S.state = 'broken'; }
    this.guardWant = shield > 0;
    this.place(0);
    const D = this.device;
    D.update(0, { want: this.guardWant, worn: true, dir: this.dir, up: p?.frame?.up, chest: p?.pos && p.frame?.up ? _f.copy(p.pos).addScaledVector(p.frame.up, 1.1) : null, time: (this.tool.time ?? 0) + (this._inspectT = (this._inspectT ?? 0) + dt) });
    S.k = shield;   // (held where the panel says)
  }

  dispose() { this.group.removeFromParent(); this.frog.removeFromParent(); this.wake.dispose(); this.device.dispose(); if (this.tool.player?.guard) this.tool.player.guard = null; }
}
