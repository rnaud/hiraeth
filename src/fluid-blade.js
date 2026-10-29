import * as THREE from 'three';
import { allTargets, targetsInCone } from './targets.js';
import { hitStop, kick, flurryLeft } from './feel.js';
import { FLURRY, hopFits } from './flurry.js';
import { hasUpgrade, UPGRADES } from './ink.js';
import { fistGrip, carry, fitScale } from './blade-grip.js';
import { buildSword, BladeWake, wakeStyle, WAKE_TONES, HILT } from './fluid-sword.js';
import { SheathState, sheathFrame, buildFrog } from './sword-sheath.js';
import { ShieldDevice, SHIELD, shieldArc } from './shield.js';
import { MAGIC_COST } from './resources.js';
import { rumblePlay } from './rumble.js';
import { BLADE_LOOK, BLADE_QUALITY } from './blade-shader.js';
import { bodyTouch, bodySpan } from './foe-body.js';
import { SlashArc, SLASH_LOOK } from './slash-arc.js';
import { HIT_BURST } from './hit-burst.js';

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
  damage: [1, 1, 3],   // the combo's three swings (v1.22: the third lands three, the combo's niche: the mid-weight foes on the ground)
  edge: 1,             // every cut's damage times this (the scientist's light-tempered edge, 1.5: src/trials/upgrades.js FRAGMENT_TUNES)
  cooldown: 0.4,       // after the third swing (v1.41: 0.5)
  buffer: 0.2,         // s a press is remembered while the blade can't swing yet (an evade, the cooldown): it swings as soon as it can
};
/**
 * The cut's pull (attack magnetism): a swing begun with a foe a little out of reach steps you in through its wind-up
 * and cut, so the blade lands where you meant it: up to `max` m, to stand `ideal` m off its body (v1.35: 1.05, was 1.2; off
 * an archetype's front at the swing's height, its target's `reach`, not its sphere: a heron's stilts are near its middle).
 */
export const MAGNET = { max: 2.2, ideal: 1.05, arrive: 0.3 };
/**
 * The rising cut (v0.97): a swing begun on the ground at a foe hovering `min`+ m over the chest, within `flat` m,
 * leaps you up to it (to its height, at most `max` m) and in, and cuts on the way up; its cut is the leap's cone (the
 * captured arms swing level). `gravity` is the traveller's (player.js GRAVITY).
 */
export const RISE = { min: 1.0, flat: 4.5, max: 2.8, gravity: 32 };
/**
 * Never a leap of its own in a fight (issue #747, the author: "Never auto jump when fighting enemies"): the rising cut is
 * for a thing hung over you (a bell, a lamp, a rope), never a foe, a guardian or a weak point, nor while a fight is on. A
 * hulk's chest 2.3 m up, a warlord's 3 m, turned every press at them into a leap; a flyer is met in the air by a jump of your
 * own and the air combo.
 */
export const FIGHT_KINDS = new Set(['foe', 'foe-weak', 'guardian', 'sentinel', 'sentry']);
/** May a swing at `target` rise to it (RISE)? Not at anything you fight, nor in a fight (`fighting`). */
export const mayRise = (target, fighting = false) => !!target && !fighting && !target.foe && !FIGHT_KINDS.has(target.kind);
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
 * The time a grounded swing's pull has to close in (v1.35): through its wind-up and the first `MAGNET.arrive` of its cut,
 * so it is there as the blade comes through (it was the whole cut, and a foe 2-2.5 m off was still out of reach when
 * the blade passed: tests/combat-reach.test.js); then it stops.
 */
export const closeInTime = (sample, M = MAGNET) => sample.wind + sample.active * M.arrive;

/**
 * The soft aim (v1.35): the swing's plane tilts toward its target's body, so a low foe gets a lower arc and one hovering a
 * raised one, within `down` / `up` rad; the swing's way (its turn) is as before. `natural`: how high (m over the feet)
 * each swing's blade crosses in front of him at `at` m (measured from the clips: scripts/combat-reach.mjs); the blade is
 * aimed at the body's middle part (`inner` of its height kept off its top and bottom), and left as it is when it already
 * crosses there. Shared by the spine (`spine`) and the shoulder (src/humanoid.js swingTilt); eased in over the wind-up.
 */
export const AIM = { down: 0.62, up: 0.4, natural: [1.2, 1.2, 1.1], at: 1.3, inner: 0.3, spine: 0.45 };
/** The tilt (rad, + down) for a body spanning lo..hi m over his feet, `d` m off (flat), his shoulder `sh` m up, swing n. */
export function aimTilt(lo, hi, d, sh, n = 0, A = AIM) {
  if (!(hi > lo)) return 0;
  const h0 = A.natural[Math.min(n, A.natural.length - 1)] ?? A.natural[0], span = hi - lo;
  const want = THREE.MathUtils.clamp(h0, lo + Math.min(0.35, A.inner * span), hi - Math.min(0.3, A.inner * span));
  if (Math.abs(want - h0) < 0.05) return 0;
  const dd = THREE.MathUtils.clamp(d, 0.8, 2.2);
  return THREE.MathUtils.clamp(Math.atan2(h0 - sh, dd) - Math.atan2(want - sh, dd), -A.up, A.down);
}

/**
 * The three swings from motion capture (Mixamo's Sword and Shield pack, in public/anim/moves.glb:
 * scripts/mocap/mixamo-clips.json): source ranges from anticipation through follow-through.
 * attackSample maps explicit phase durations onto the source, accelerating through `hit`. Right to left and down; a rising backhand, left
 * to right; a heavy overhead chop, grounded (`heavy`: a longer wind-up, a nudge of the camera as it comes down, the third's damage and
 * knockback, BLADE.damage, Foe.hit's combo 2). Without the clips (not loaded yet) the arcs below.
 */
export const SWINGS = [
  // (v1.41, the author: "speed up the main character's attacks": each phase about a quarter quicker; it was 0.22 / 0.16 /
  // 0.24, 0.25 / 0.17 / 0.26 and 0.42 / 0.2 / 0.36, the combo 2.28 s from the first press to the end of the third)
  { clip: 'mixamo_ss_slash_1', from: 0.12, to: 1.02, hit: 0.6, wind: 0.16, active: 0.13, recover: 0.18 },
  { clip: 'mixamo_ss_slash_3', from: 0.32, to: 1.35, hit: 0.87, wind: 0.18, active: 0.14, recover: 0.19 },
  // (the third, v2.31, issue #712: the Great Sword pack's slash 3, the finisher. The author: "the third strike is a crouch
  // strike which doesn't make sense, it should be a third heavy strike". Slash 5, v1.39 to v2.30, dropped the pelvis 0.48 m
  // and cut low out of a crouch; this one stands tall: the sword raised high over the head in both hands through a longer
  // wind-up (the tip 2.26 m up at 0.3 s, coiled back behind the head to 0.73), cleaved down and across in front (the tip
  // from over his shoulder to 0.4 m off the ground 1.5 m out, 0.76-0.95 s) and brought back up into guard over a slower
  // follow-through: the most committed of the three, as Breath of the Wild's finishers are. Before v1.39 it was attack 1,
  // a leaping overhead that took both feet 1.4 m off the ground.)
  // (`roll`: the clip is the two-handed great sword's, its right fist turned so the blade would cut 34-80° off its edge,
  // flat on: the blade turned this much (rad) about its own line in the fist through the swing, so it cuts edge first:
  // FluidBlade.place, mountGrip; tests/blade-grip.test.js)
  // (`face`, v2.35, issue #759: "my third blow never connects with enemies. Like he is attacking up and backward": through its
  // wind-up the clip coils his hips 72° away from the foe, the sword dropped behind his head, for 0.3 s; he is turned back
  // into it by this share of the coil, so he stays turned at the foe and cocked, not away from it: TRACK)
  { clip: 'mixamo_gs_slash_3', from: 0.1, to: 1.15, hit: 0.86, activeFrom: 0.76, activeTo: 0.95, wind: 0.42, active: 0.15, recover: 0.36, heavy: true, roll: -0.95, face: 0.6 },
];
/**
 * A grounded swing keeps to its foe until its blade arrives (v2.35, issue #759): through the wind-up and the cut's pull
 * (`closeInTime`) the swing's way follows the foe where it is now, and the pull is taken again from there, so a foe the
 * blow before shoved 1–2 m back (a grunt slides 1.9 m from the second cut) or one that stepped aside is still met. Measured
 * before (scripts/combat-reach.mjs's rig with the foes' own minds and shoves): the third cut at a grunt 1.2 m off missed
 * with it 2.95 m off as the blade came through. Not a foe hopping back out of the swing on purpose (fight.evade, the
 * prowler's flip: `hopBack`), which still gets away; not the specials, which carry themselves.
 */
export const TRACK = { from: ['wind', 'strike'] };
/** The yaw (rad, in the frame's own heading) of the pelvis off the body's heading: how far a clip has turned his hips. */
export function hipYaw(p, out = _hy) {
  const pel = p?.humanoid?.b?.pelvis;
  if (!pel || !p.frame?.headingOf) return 0;
  pel.getWorldQuaternion(_hq);
  out.set(0, 0, 1).applyQuaternion(_hq);
  out.addScaledVector(p.frame.up, -out.dot(p.frame.up));
  if (out.lengthSq() < 1e-8) return 0;
  const d = p.frame.headingOf(out) - p.heading;
  return Math.atan2(Math.sin(d), Math.cos(d));
}
const _hy = new THREE.Vector3(), _hq = new THREE.Quaternion();
/** The blade's turn about its own line (rad) while a swing's clip is on his body: its `roll` (SWINGS), else 0. */
export const edgeRollOf = (clip) => SWINGS.find((S) => S.clip === clip)?.roll ?? 0;
export const SWING_SPEED = 1; // Legacy consumers; attacks now have authored phase timing.
/**
 * The evade: `duration` s long, `cooldown` s from one to the next, at `speed`. Its invulnerability (i-frames):
 * from `iframes[0]` to `iframes[1]` s into it (Gentle: `gentle`) no foe's blow lands (Foes.strike, the
 * shockwaves, the slag; src/foes.js). A window closed, the next one opens only `rest` s later at the
 * soonest: an evade begun before that runs without (spamming it is never unbroken cover).
 * `perfect`: the hit-stop (s) of an evade whose i-frames swallow a blow (a perfect dodge).
 */
export const EVADE = { duration: 0.28, cooldown: 0.65, speed: 7.5, iframes: [0.03, 0.24], gentle: [0.02, 0.28], rest: 0.3, perfect: 0.05, buffer: 0.2 };
/**
 * The dodge roll (the fight temples' iso view, src/fight-temples/session.js: the jump button and B / ○ roll there): the
 * evade made a tucked forward roll along the stick (or the way he faces, never a backstep), longer and further than the
 * evade, `duration` s at up to `speed` m/s, its i-frames `iframes` s into it (Gentle `gentle`), `cooldown` s from the start
 * of one to the next. FluidBlade.roll set to it turns the evade into it; null (everywhere else) the evade as it is.
 * The pose: src/jump.js ROLL (a ground flip about the hips, as long as this).
 */
export const ROLL = { duration: 0.42, cooldown: 0.75, speed: 9.5, iframes: [0.02, 0.34], gentle: [0.02, 0.4], rest: 0.3, buffer: 0.2 };
/**
 * The roll cuts a swing off (issue #442: "the roll should cancel the sword attack to be faster to react"): with the
 * roll set, a press during a swing's wind-up or its follow-through (or a charge) rolls at once, the swing dropped
 * (the evade elsewhere: only from the follow-through). Not through its active frames (the cut's ~0.12 s): the cut you
 * committed to lands, and the press is kept `ROLL.buffer` s, so the roll comes the frame they end. (Fairness: the
 * wind-up stays a choice you can take back when a foe's tell starts; the hit itself is never free of commitment.)
 */
export const rollCancels = (phase, charging = false) => !phase || phase === 'wind' || phase === 'recover' || !!charging;
/**
 * The quick cut (the fight temples, issue #442: "the sword swings should be faster"): the combo's wind-ups, cuts and
 * follow-throughs shortened by these shares there, and the rest after the third (BLADE.cooldown) too; the clips play
 * through the same frames, faster. Only in there: the crowds of one- and two-cut foes want a quick blade, while the
 * world's fights (guardians, parries, the charged cut's timing) are tuned to the combo as it is (v1.41).
 * FluidBlade.quick set to it; null elsewhere.
 */
export const QUICK_CUT = { wind: 0.65, active: 0.9, recover: 0.55, cooldown: 0.6 };
const _quick = new WeakMap();
/** A combo swing under the quick cut `Q` (the same swing with shorter phases; memoised), or the swing itself with none. */
export function quickSwing(S, Q) {
  if (!Q || !S) return S;
  let m = _quick.get(Q); if (!m) _quick.set(Q, (m = new Map()));
  let out = m.get(S);
  if (!out) m.set(S, (out = { ...S, wind: S.wind * Q.wind, active: S.active * Q.active, recover: S.recover * Q.recover }));
  return out;
}
/**
 * The generous cut (the fight temples, issues #365, #368): the swing takes every foe a crescent round him reaches, not
 * only those the sword passes through, and the crescent is drawn (src/slash-arc.js): a sweep of the sword's water laid
 * as the cut goes, its outer edge `reach` m from his axis on the flat. What it covers is what it cuts: a foe whose body
 * (its hurt radius) the crescent reaches, as the crescent reaches it, a wall between keeping it out, no higher or lower
 * than `height` m off his feet. Each of the combo's swings sweeps its own way (`sweeps`: `from` → `to`, rad off the
 * cut's way, + his left, as its clip's blade goes: measured in the game; the heavy third a narrow forward cleave, its
 * own `reach`), the charged cut `charge`; the other moves cut with the sword alone. The sword there is drawn `length`
 * m long and `width` wide (its tip about 2.1 m out through a cut: the crescent's edge half a metre past it); a swing
 * at a foe a little out of reach steps in only to stand `pull` m off its body (MAGNET's ideal: under the crescent).
 * v1.77 took every foe in a cone 3.9 m from the chest and 1.5 rad either side with nothing drawn (#368: hits landed
 * well past what was seen, and it felt too big). FluidBlade.wide set to it; null elsewhere.
 */
export const WIDE_CUT = {
  reach: 2.6, height: 2.6, length: 1.25, width: 0.14, pull: 2.0,
  sweeps: [{ from: -1.2, to: 1.2 }, { from: 1.1, to: -1.1 }, { from: -0.5, to: 0.5, reach: 2.9 }],
  charge: { from: -1.4, to: 1.4, reach: 2.9 },
};
/** A cut's sweep under the generous cut: the combo's `n`th swing's, the charged cut's, or null (another move: the sword alone). */
export const wideSweep = (W, n, special = null) => (!W ? null : special === CHARGE ? W.charge : special ? null : W.sweeps?.[n] ?? null);
/** The span (rad off the cut's way: [start, how far it has reached]) of a sweep `u` (0..1) of the way through. */
export const sweepSpan = (sweep, u) => [sweep.from, sweep.from + (sweep.to - sweep.from) * THREE.MathUtils.clamp(u, 0, 1)];
/**
 * Is a body at flat offset (dx, dz) from his axis, `radius` m round, under a crescent along the flat unit `dir` over
 * `span` (sweepSpan), out to `reach` m? Its edge within the reach, and within the span by the angle its radius takes up.
 */
export function underSweep(dx, dz, radius, dir, span, reach) {
  const d = Math.hypot(dx, dz);
  if (d - radius > reach) return false;
  if (d <= radius) return true;
  const off = Math.atan2(dx * dir.z - dz * dir.x, dx * dir.x + dz * dir.z), slack = Math.asin(Math.min(1, radius / d));
  return off >= Math.min(span[0], span[1]) - slack && off <= Math.max(span[0], span[1]) + slack;
}
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
 * thrown on with a share of the edge's speed and falling (`near`: from that share of the way up; 0.85, off the point).
 * Plain objects for tool.drops.add.
 */
export function shedDrops(from, seg, dt, style, rand = Math.random, near = 0.35) {
  const out = [];
  if (!from || !seg || !(dt > 0)) return out;
  for (let i = 0; i < style.drops; i++) {
    const x = near + (1 - near) * rand(), pos = new THREE.Vector3().lerpVectors(seg.a, seg.b, x);
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
 * The charged cut (v1.3, the Great Sword pack's slash): the blade button still held `after` s after the press that began a
 * combo swing turns it into a charge once that swing has cut (in its follow-through, `chargeOpen`): the sword drawn back
 * over the right shoulder (the clip from `raiseFrom` to its cocked pose `hold` over `raise` s, blended in from the swing
 * over `draw` s) and held there, gathering, as long as the button is; `full` s and it is full (a ring, a ping). Let go:
 * the clip's own swing from `hold`, a wide diagonal sweep (`angle`, `reach`), `damage[1]` full, else `damage[0]`, and it
 * staggers even an armoured foe (`breaks`: src/foes.js Foe.hit). Then the cooldown, as after a third swing.
 * (Until v1.41 it took over the first swing's wind-up 0.2 s after the press: a press held a little long turned the first
 * attack into a strange half-drawn charge let go at once, the "odd wind-up" the author saw now and then. Now a tap is
 * always the swing, and a hold is the swing and then the charge: `after` is longer than any tap.)
 * While it gathers (CHARGE_LOOK): he sinks into his knees, motes of fluid drift into the blade, and once full he trembles
 * with it and the blade burns brighter.
 */
export const CHARGE = { clip: 'mixamo_gs_slash_1', raiseFrom: 0.3, hold: 0.45, raise: 0.18, draw: 0.2, after: 0.3, full: 0.85, move: 0.3,
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
 * plain swing. Through a foe's back (v1.47, issue #35: the blow's way within about 75° of the way it faces) it lands
 * double (src/foes.js BACKSTAB, Foe.hit's `info.dash`): the answer to a foe turned from you, and to the evade round one.
 */
export const DASH = { clip: 'mixamo_ss_attack_2', late: 0.15, cooldown: 1.1, speed: 9, pull: 5, side: 1.1, past: 1.0, fastest: 16, from: 0.3, hit: 0.56, activeFrom: 0.49, activeTo: 0.64, to: 1.0, wind: 0.16, active: 0.14, recover: 0.26,
  angle: 1.7, reach: 3.2, damage: 2 };
/**
 * The running cut (v2.32, issue #718: "pressing shift + attack with the sword creates a non sensical animation"): the blade
 * pressed at a run (sprinting, or `min` m/s and more on the ground), a combo's first swing, played the standing first slash
 * over a sprinting stride and slid him from 8 to 1.4 m/s in a third of a second, his legs held mid-stride. Breath of the
 * Wild's sprint attack carries the run into one strong cut and then a recovery; this is ours: the Sword and Shield pack's
 * running cut (the dash cut's clip, attack 2), the run's own speed (at most `carry` m/s) carried on through the wind-up and
 * the cut along the way he runs (or at a foe in reach), easing to a stop through the follow-through (as (1 − u)^`ease`), `damage` 2 and heavy (the knockback, the hit-stop, the heavy hit burst); then the cooldown, as after a third
 * swing. Not the dash cut's backstab (that stays the evade's). The lunge (an ink upgrade) still takes a run's swing first.
 *
 * v2.35, issue #760 (the author: "Running attack animation is still non sensical"): attack 2 is a spin. Measured on the
 * traveller, its hips turn 108° one way through the wind-up and 141° the other through the follow-through, so a cut begun
 * at a sprint ended with him turned round, the blade pointing back the way he came, his whole body (`full`) planted and slid
 * at the run's speed. Now the Great Sword pack's slash 1 (the charged cut's clip) from the sword going up (0.3 s): raised
 * over his right shoulder and cleaved down and across in front, the way he runs, his hips within ±32° of it; played over
 * the upper body only (`upper`), the legs still running as the run carries him, slowing to a stop through the follow-through.
 */
export const RUN_CUT = { clip: 'mixamo_gs_slash_1', upper: true, min: 5.2, carry: 9, ease: 1.6, from: 0.3, hit: 0.65, activeFrom: 0.54, activeTo: 0.76, to: 1.05, wind: 0.14, active: 0.14, recover: 0.36,
  angle: 1.7, reach: 3.2, damage: 2 };
/** Does a press start the running cut (RUN_CUT): on the ground, sprinting or at `min` m/s, not in a chain (`chained`)? */
export const runCutOpen = ({ onGround = false, sprinting = false, speed = 0, chained = false } = {}, R = RUN_CUT) => onGround && !chained && (sprinting || speed >= R.min);
/**
 * Does a swing turn into the charge now (CHARGE)? A combo swing (`n` 0..2, not a special: the air cuts, the riposte, the
 * dash cut, the whirl or the lunge), on the ground, its blade button held `held` s since the press that began it, past
 * CHARGE.after, and not in the middle of its cut (`phase` 'wind' or 'recover').
 */
export const chargeOpen = ({ n = -1, special = null, phase = '', held = -Infinity, onGround = true } = {}, C = CHARGE) =>
  n >= 0 && !special && onGround && held >= C.after && (phase === 'wind' || phase === 'recover');
/**
 * The held charge as it shows (v1.41: the author wanted "an animation that clearly shows the held charge"): `crouch` m
 * he sinks into his knees over the first `sink` s, `motes` a second drifting into the blade from `from` m off it, and
 * once full a tremble (`shake` rad at `rate` Hz) and the blade's glow up to `glow`.
 */
export const CHARGE_LOOK = { crouch: 0.09, sink: 0.25, motes: 14, from: 0.75, shake: 0.018, rate: 31, glow: 1 };
/** The crouch (m) and the tremble (rad) of a charge held `t` s (`full`), at time `time` (pure: tests). */
export function chargeBody(t, full, time = t, L = CHARGE_LOOK) {
  const k = THREE.MathUtils.smoothstep(t / L.sink, 0, 1);
  return { crouch: L.crouch * k, shake: full ? L.shake * Math.sin(time * L.rate * Math.PI * 2) : 0, k };
}
/**
 * Mid-air combos (v1.41, the author: "mid-air sword combos after jumping and attacking"): in the air the first two
 * presses are the combo's first two swings, upper body over the jump (`swings`: each the ground swing's timing, light,
 * its cone tipped `down` toward foes below), each holding him up in the air through its wind-up and cut (his fall held to
 * `drift` m/s, `sink` through its follow-through, the rise kept at `keep` of itself, lifted to `lift` m/s as it starts) and
 * carried in to a foe up to `pull` m out of reach; the next one pressed for starts `cancel` s into the follow-through. The
 * third is the air cut (AIR), the plunge, ending it. One combo an airtime.
 */
export const AIR_COMBO = {
  swings: [
    { ...SWINGS[0], air: true, light: true, damage: 1, down: 0.35 },
    { ...SWINGS[1], air: true, light: true, damage: 1, down: 0.35 },
  ],
  lift: 2.4, drift: -0.8, sink: -2.4, keep: 0.82, pull: 2.6, ideal: 1.0, cancel: 0.05,
};
/** Is `S` one of the mid-air combo's light swings? */
export const airLight = (S) => !!S?.light && AIR_COMBO.swings.includes(S);
/** The riposte's window after a foe's poise breaks (s: issue #722; the parry's is RIPOSTE.window). */
export const RIPOSTE_BROKEN = 1.1;
/** Is a press now a riposte: `since` s after a perfect parry (RIPOSTE.window)? */
export const riposteOpen = (since, R = RIPOSTE) => since >= 0 && since < R.window;
/** Is a press now a dash cut: evading, or `late` s at most after an evade (`since` s; 0 while evading), the dash cut's cooldown `cool` over. */
export const dashOpen = (since, cool, D = DASH) => since <= D.late && cool <= 0;
/** The attacks that end a combo (no chain after them; the cooldown follows), and play as heavy ones (sound, knockback). */
const ENDS = new Set([CHARGE, AIR, RIPOSTE, DASH, RUN_CUT]);
/** Every attack the blade plays from a captured clip: the combo's three, the grown whirl and lunge, the charged cut, the air cut, the riposte and the dash cut. */
export const ATTACKS = { swing1: SWINGS[0], swing2: SWINGS[1], swing3: SWINGS[2], whirl: WHIRL, lunge: LUNGE, charge: CHARGE, air: AIR, riposte: RIPOSTE, dash: DASH, run: RUN_CUT };
/** The charged cut's pose while held `t` s (src/fluid-blade.js CHARGE): drawn back to `hold`, then a slow breath about it. */
export function chargePose(t, C = CHARGE) {
  const k = smooth01(t / C.raise);
  return C.raiseFrom + (C.hold - C.raiseFrom) * k - 0.012 * k * (1 - Math.cos(t * 7));
}
/**
 * How many bits of fluid a blow throws (v1.41, the author: "too much visual noise and too many particles on hits"): a
 * blade's cut lands its own light splash (`cut` drops, `cutGlow` glints, no ring; it was the shot's splash, 28 drops, 5
 * glints and a ring, on top of the foe's own); a block `block` drops, a perfect parry `parry` glints (were 18 and 12);
 * through every cut at most `trail` sparks a frame over the ground the edge crossed (was 6), and a drop off the edge
 * landing pops `landing` droplet with its flat splash (was 2).
 * The foes' share is src/foes.js HIT_SPLASH.
 */
export const HIT_FX = { cut: 7, cutGlow: 1, block: 10, parry: 8, trail: 3, landing: 1 };
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
 * The blade's lite look (src/blade-shader.js BLADE_QUALITY, set by main.js applyDetail: the handheld, Low, a desktop Auto
 * that had to drop resolution). Lite: no ripples' lines or motes in the shader, no extra drops off the point, no splashes.
 */
export const bladeLite = () => BLADE_QUALITY.lite;
/** The share of the blade standing out of the cup in the fist between cuts: bladeGrowth's `lit` at `time` s (breathing about BLADE_LOOK.idle; 0, off: only the bead). */
export const bladeIdle = (time, L = BLADE_LOOK) => L.idle * (1 + 0.12 * Math.sin(time * L.breathRate));
/** How far a swing smears the fluid (0..1) for the tip moving `speed` m/s. */
export const bladeSmear = (speed, L = BLADE_LOOK) => THREE.MathUtils.clamp(speed / L.smearAt, 0, 1);
/** How far back (m) the fluid trails the point moving `speed` m/s. */
export const bladeLag = (speed, L = BLADE_LOOK) => Math.min(L.lagMax, Math.max(0, speed) * L.lag);

/**
 * The guard: the clips (block idle held round and round, the block played as a strike lands), how wide it
 * covers, and the shield (src/shield.js). What it covers is the shield as drawn (ShieldDevice.arc: the
 * bearings between its rim's edges round the chest); `angle` is that arc for a shield held `reach` in
 * front of the chest, used when there is no shield drawn to measure.
 */
export const GUARD = { idle: 'mixamo_ss_block_idle', parry: 'mixamo_ss_block_1', parryFor: 0.55, reach: 0.45, radius: SHIELD.radius, perfect: 0.18, rearm: 0.35, cancel: 0.1 };
/**
 * The guard at any moment (v2.35, issue #757, the author: "I should be able to shield/parry at any time even in the middle of
 * an attack animation"): a fresh press of the guard stops any swing at once, in its wind-up, its cut or its follow-through
 * (the combo's, the charge, the riposte, the dash cut, the running cut, the air cuts), and the guard comes up from the pose
 * the swing had reached over `GUARD.cancel` s (drawn at once, not grown from the walk's arms). Its parry window and timing
 * are a fresh guard's (guardAge, rearm, the shield's rise): only the gate changed. Held, the guard still lets a riposte begin.
 */
export const guardCancels = ({ press = false, swinging = false, ok = true } = {}) => !!press && !!swinging && !!ok;
GUARD.angle = shieldArc(new THREE.Vector3(), new THREE.Vector3(0, 0, GUARD.reach), new THREE.Vector3(0, 0, 1), SHIELD.radius).half;
/** How long the blade stays in the fist after the last swing, guard, evade or blow (s); locked on it stays out. (The draw and the sheathe: src/sword-sheath.js.) */
export const STANCE = { linger: 2.5 };
/** Is a strike from `from` in front of someone at `pos` facing `dir` (flat), within GUARD.angle? */
export function inGuard(pos, dir, from, angle = GUARD.angle) {
  const dx = from.x - pos.x, dz = from.z - pos.z, d = Math.hypot(dx, dz);
  if (d < 1e-4) return true;
  return Math.acos(THREE.MathUtils.clamp((dx * dir.x + dz * dir.z) / (d * Math.hypot(dir.x, dir.z) || 1), -1, 1)) <= angle;
}
/**
 * A fight (issue #390, the author: "the sword should stay open and in hand while I'm fighting, vs back to not glowing
 * after each hit"): a foe awake (chasing, winding up, striking, recovering) within `near` m, or locked on, keeps the
 * blade drawn and lit, open at full length between cuts; `after` s with neither (and nothing struck or taken: STANCE)
 * the fight is over and the blade goes back on his back. `lit`: how open it stands between cuts in a fight.
 */
export const FIGHT = { near: 10, after: 3, lit: 1 };
const ENGAGED = new Set(['chase', 'wind', 'strike', 'recover']);
/** Is a foe engaged with someone at `from`: a living foe target (src/foes.js) awake within `near` m (flat). */
export function foeEngaged(from, targets = allTargets(), near = FIGHT.near) {
  for (const t of targets) {
    if (t.kind !== 'foe' || !t.foe || !ENGAGED.has(t.foe.state) || !t.enabled()) continue;
    const q = t.position();
    if (Math.hypot(q.x - from.x, q.z - from.z) < near) return true;
  }
  return false;
}
/** Is the blade in the fist: in a fight (a swing or its chain, the guard, an evade, locked on, a blow taken, a foe engaged near) or just after one. */
export function bladeDrawn({ ok = true, swinging = false, guarding = false, evading = false, locked = false, fighting = false, since = Infinity } = {}) {
  return ok && (swinging || guarding || evading || locked || fighting || since < STANCE.linger);
}
/** How lit the blade wants to be (0..1): 1 through a swing, FIGHT.lit between cuts in a fight (the hilt in the fist), else 0 (only the bead). */
export const bladeLitWant = ({ swinging = false, fighting = false, inHand = false } = {}, F = FIGHT) => swinging ? 1 : fighting && inHand ? F.lit : 0;

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

/**
 * The targets with a drawn body (src/foe-body.js) the swept blade meets this frame, from `before` to `after`: in reach of
 * `origin` (the body's bounds), not behind a wall, the blade through one of its parts. Each: { target, point: where it
 * met it, dir: from origin to it, flat, body: true }.
 */
export function bodyHits(origin, reach, physics, before, after, targets = allTargets()) {
  const out = [];
  for (const t of targets) {
    const model = t.body?.();
    if (!model || !t.enabled() || !t.accepts?.includes('blade')) continue;
    const S = bodySpan(model, _span);
    const d = S.centre.distanceTo(origin);
    if (d - S.radius > reach + BLADE.length) continue;
    const point = bodyTouch(model, before, after, BLADE_TOUCH);
    if (!point) continue;
    const to = _bh.subVectors(point, origin), dist = to.length();
    if (physics?.rayDistance && dist > 0.3 && physics.rayDistance(origin, to.clone().divideScalar(dist), dist) < dist - 0.05) continue;
    const dir = new THREE.Vector3(S.centre.x - origin.x, 0, S.centre.z - origin.z);
    if (dir.lengthSq() < 1e-8) dir.copy(to).setY(0);
    out.push({ target: t, point: point.clone(), distance: dist, dir: dir.normalize(), body: true });
  }
  return out;
}
const _span = { lo: 0, hi: 0, centre: new THREE.Vector3(), radius: 0 }, _bh = new THREE.Vector3();

/**
 * The nearest foe the soft lock turns to: a target with lock: true within `range` (flat distance; or its own
 * `lockRange`: the Rose House's watcher, turned to from across its landing, issue #245), or null.
 */
export function lockTarget(from, range = BLADE.lock, targets = allTargets(), locked = null) {
  if (locked?.enabled()) return locked;   // (the lock-on's foe first: src/foes.js)
  let best = null, bd = Infinity;
  for (const t of targets) {
    if (!t.lock || !t.enabled()) continue;
    const p = t.position(), d = Math.hypot(p.x - from.x, p.z - from.z);
    if (d < (t.lockRange ?? range) && d < bd) { bd = d; best = t; }
  }
  return best;
}

const _y0 = new THREE.Vector3(0, 1, 0);
const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const RIPOSTE_GOLD = '#ffd46b';
const _tip = new THREE.Vector3(), _vel = new THREE.Vector3(), _back = new THREE.Vector3(), _lag = new THREE.Vector3();

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
    // its life (src/blade-shader.js; alive()): the smear and lag of a swing, the ripple of a hit or a parry, the flash
    this.bead = sword.group.getObjectByName('bead');
    this.smear = 0; this.lagV = new THREE.Vector3(); this.tipPrev = null; this.flowExtra = 0; this.flash = 0;
    this.ripple = { age: 99, from: 0.75, k: 0, gold: 0 };
    this.wake = new BladeWake(tool.fx);
    this.group.name = 'fluid blade';
    this.group.visible = false;
    this.group.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; o.frustumCulled = false; });
    tool.fx.add(this.group);
    this.since = Infinity; this.grip = null;
    // out of a fight the sword sits on his back, in a leather frog behind the right shoulder (src/sword-sheath.js):
    // drawn over the shoulder when a fight starts, put back when it is over
    this.sheath = new SheathState();
    this.sheathAt = sheathFrame(); this.sheathOutfit = null;
    this.frog = buildFrog();
    this.frog.visible = false;
    // the guard's shield: the makers' hub on a bracer round the left forearm, opening into a disc of the sword's water (src/shield.js)
    this.guardK = 0; this.guardT = 0; this.parry = 0;
    this.guardHeld = false; this.guardAge = Infinity; this.guardRearm = 0; this.perfectReady = false;
    this.evadeHeld = false; this.evadeT = 0; this.evadeCool = 0; this.evadeDir = new THREE.Vector3();
    // its i-frames: how long it has run, whether it was given them, the rest before the next can be, a blow swallowed
    this.evadeAge = Infinity; this.evadeGranted = false; this.iframeRest = 0; this.dodged = false; this.gentle = false;
    // the dodge roll (ROLL: the evade made a roll; the fight temples set it) and the generous cut (WIDE_CUT); the evade under way's spec
    this.roll = null; this.wide = null; this.quick = null; this.rollWant = 0; this.evadeSpec = EVADE;
    // (the generous cut's crescent: its state, the hits' and the drawing's both, src/slash-arc.js; its tones, null: the sword's water)
    this.slash = null; this.arc = null; this.slashTones = null;
    // the locked-on hops' own dodge frames (hop(): the back flip, the side hop; src/jump.js HOP): how long it has run, its window
    this.hopAge = Infinity; this.hopWin = null; this.hopGranted = false;
    this.hitTargets = new Set(); this.previousBlade = null; this.buffered = 0; this.closeIn = 0;
    // the counters: the riposte's window after a perfect parry, the dash cut's after an evade (and its cooldown)
    this.sinceParry = Infinity; this.sinceEvade = Infinity; this.dashWant = false; this.dashCool = 0;
    this.device = new ShieldDevice(tool);
    this.shield = this.device.root;
    this.guardArc = null;
    if (tool.player) {
      tool.player.guard = (from) => this.block(from);
      // (the guard up now, and the way it faces: what a temple's wind asks, src/temples/pieces.js Gust `guard`)
      tool.player.guarding = () => !!this.guarding && tool.shieldOn !== false;
      tool.player.guardDir = () => this.dir;
      // (where a beam from `from` meets the raised shield, or null: the block's own test, src/beam-stop.js)
      tool.player.shieldFace = (from) => this.faceFor(from);
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
  /** The guard would take a blow from `from` now (block's test, without its effects). */
  covers(from) {
    const p = this.tool.player, arc = this.guardArc;
    return !!p && this.guarding && this.tool.shieldOn !== false && (arc ? inGuard(p.pos, arc.dir, from, arc.half) : inGuard(p.pos, this.dir, from));
  }
  /** Where a blow from `from` meets the shield (its hub as drawn; undrawn, the guard's point before his chest), or null: not covered. */
  faceFor(from, out = new THREE.Vector3()) {
    if (!this.covers(from)) return null;
    const p = this.tool.player;
    return this.device.root.visible ? out.copy(this.device.centre) : out.copy(p.pos).addScaledVector(p.frame?.up ?? _Y, 1.2).addScaledVector(this.dir, GUARD.reach);
  }

  block(from) {
    const T = this.tool, p = T.player;
    // (the shield as drawn says what it covers; with none drawn, the guard's own arc)
    const arc = this.guardArc;
    if (!p || !this.guarding || !(arc ? inGuard(p.pos, arc.dir, from, arc.half) : inGuard(p.pos, this.dir, from))) return false;
    this.since = 0;
    const perfect = this.parryLive;
    // (the backpack's fluid takes the blow, a unit of the bar; before the backpack, the brass alone holds)
    if (!perfect && T.owned !== false && !T.reserve.use(MAGIC_COST.shield)) { T.sputter?.(); this.device.s.hit('broken'); T.sound?.shieldBreak?.(); return false; }   // (it cracks: the fluid is not there to take it)
    p.perfectBlock = perfect; this.perfectReady = false;
    if (perfect) { this.sinceParry = 0; this.riposteFor = null; }   // (the riposte's window opens)
    this.guardRearm = GUARD.rearm;
    this.parry = GUARD.parryFor;
    hitStop(perfect ? 0.14 : 0.07); kick(perfect ? 0.5 : 0.14);
    T.used('block', p.pos);
    const recordedParry = T.sound?.fluidBlock?.(perfect);
    this.device.s.hit(perfect ? 'perfect' : 'block');
    // (the fluid answers: a ring up from the cup; a perfect parry flares the blade out of it a moment, gold)
    this.rippleAt(0, perfect ? BLADE_LOOK.ripple.parry : BLADE_LOOK.ripple.block, perfect ? 1 : 0);
    if (perfect) this.lit = Math.max(this.lit, 0.9);
    const at = this.device.root.visible ? this.device.centre : _o.copy(p.pos).addScaledVector(p.frame.up, 1.2).addScaledVector(this.dir, GUARD.reach), tones = T.modeTones;
    T.rings?.add({ from: at, dir: this.dir, reach: 0.1, r0: 0.2, r1: 1.1, life: 0.3, color: tones[0], thick: 1 });
    for (let i = 0; i < HIT_FX.block; i++) T.drops?.add({ pos: at, vel: _a.copy(this.dir).multiplyScalar(-2).add(_b.randomDirection().multiplyScalar(3)), drag: 3, grav: 6, size: 0.03, life: 0.4, color: tones[i % tones.length] });
    p.vel?.addScaledVector(this.dir, -2);   // pushed back a step
    if (perfect) { if (!recordedParry) T.sound?.fluidMode?.('stun'); for (let i = 0; i < HIT_FX.parry; i++) T.glow?.add({ pos: at, vel: _a.randomDirection().multiplyScalar(2), drag: 3, size: 0.07, life: 0.5, color: '#fff6dc', grow: true }); }
    return perfect ? 'perfect' : true;
  }

  /** The evade's i-frames are on now (`gentle`: the Gentle setting's longer window). */
  iframes(gentle = this.gentle) { return (this.evadeT > 0 && evadeInvulnerable(this.evadeAge, gentle, this.evadeGranted, this.evadeSpec)) || this.hopFrames(gentle); }
  /** Rolling now (the evade under way is a ROLL): s into it, or null. */
  get rolling() { return this.evadeT > 0 && this.evadeSpec !== EVADE ? this.evadeSpec.duration - this.evadeT : null; }
  /** A hop's dodge frames are on now (Gentle: to its end, as the evade's). */
  hopFrames(gentle = this.gentle) {
    const W = this.hopWin;
    return !!W && this.hopGranted && this.hopAge >= W[0] && this.hopAge < (gentle ? W[1] + 0.06 : W[1]);
  }
  /**
   * A locked-on hop begins (Player.hop: the back flip, the side hop): its dodge frames `win` [from, to] s into it, unless a
   * window closed less than EVADE.rest ago (spamming hops is never unbroken cover, as with the evade). The guard drops, a
   * swing in its follow-through stops.
   */
  hop(win, kind = null) {
    this.hopKind = kind;   // ('back' | 'left' | 'right': a blow's `dodge` asks for one, src/flurry.js hopFits)
    this.hopAge = 0; this.hopWin = win; this.hopGranted = this.iframeRest === 0; this.dodged = false;
    if (this.swinging && (this.phase === 'recover' || this.charging)) this.stop();
    this.guardK = 0; this.since = 0;
  }

  /**
   * A blow (`kind`: 'strike', 'grab', 'shockwave', 'burn') from `from` while evading: swallowed by the i-frames
   * (true), else false (it lands). The first blow an evade swallows is a perfect dodge ('perfect'): the frame
   * freezes a blink, a white ring at the feet, a hum (lingering ground, the burn, gives none).
   */
  dodge(from, kind = 'strike', gentle = this.gentle, atk = null) {
    this.gentle = !!gentle;
    if (flurryLeft() > 0) return true;   // (the flurry: nothing touches you while the world is slowed, src/flurry.js)
    if (!this.iframes(gentle)) return false;
    if (this.dodged || kind === 'burn') return true;
    this.dodged = true;
    if (this.rolling !== null) this.onRollDodge?.(from, kind);
    if (this.hopFrames(gentle) && hopFits(atk, this.hopKind)) this.onHopDodge?.(from, kind);   // (a hop's frames swallowed a blow: a perfect dodge too, main.js starts the flurry)
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
  /** A fight on (FIGHT): locked on, a foe engaged near, or one of those within FIGHT.after s. */
  inFight(p = this.tool.player) { return !!p?.lockOn || foeEngaged(p?.pos ?? _o) || (this.fightSince ?? Infinity) < FIGHT.after; }

  clearDefensiveInput() { this.rollWant = 0; }

  /**
   * Per frame. press: a fresh press of the blade button; ok: the tool may act (FluidTool.allowed); held: the guard is
   * down; evade: the evade's button; bladeHeld: the blade button is down (held through a wind-up it charges: CHARGE).
   */
  update(dt, press, ok, held = false, evade = false, bladeHeld = false) {
    const T = this.tool, p = T.player;
    this.cutNow = false; this.pose.dir = this.dir; this.pose.lead = true; this.pose.tilt = 0; this.pose.face = 0;
    if (p) p.chargeHold = null;
    // (how long the blade button has been down since its press: CHARGE.after)
    this.holdT = bladeHeld ? (press ? 0 : (this.holdT ?? -Infinity) + dt) : -Infinity;
    if (p?.onGround) { this.airUsed = false; this.airN = 0; }
    this.cool = Math.max(0, this.cool - dt);
    this.evadeCool = Math.max(0, this.evadeCool - dt);
    this.evadeT = Math.max(0, this.evadeT - dt);
    this.sinceEvade = this.evadeT > 0 ? 0 : this.sinceEvade + dt;
    this.sinceParry += dt; this.dashCool = Math.max(0, this.dashCool - dt);
    // (the i-frames' clock: their window closing starts the rest before the next evade may have them)
    const wasOn = this.evadeGranted && this.evadeAge < iframeWindow(this.gentle, this.evadeSpec)[1];
    this.evadeAge = this.evadeT > 0 ? this.evadeAge + dt : Infinity;
    this.iframeRest = Math.max(0, this.iframeRest - dt);
    if (wasOn && !(this.evadeT > 0 && this.evadeAge < iframeWindow(this.gentle, this.evadeSpec)[1])) this.iframeRest = this.evadeSpec.rest ?? EVADE.rest;
    const hopWas = this.hopFrames();
    this.hopAge += dt;
    if (hopWas && !this.hopFrames()) this.iframeRest = EVADE.rest;
    if (this.hopWin && this.hopAge > this.hopWin[1] + 1) this.hopWin = null;
    this.guardRearm = Math.max(0, this.guardRearm - dt);
    this.guardAge += dt;
    const guardPress = held && !this.guardHeld;
    if (guardPress) { this.guardAge = 0; this.perfectReady = this.guardRearm === 0; this.guardRearm = GUARD.rearm; }
    if (!held) this.perfectReady = false;
    this.guardHeld = held;
    const dodgePress = evade && !this.evadeHeld; this.evadeHeld = evade;
    // (out of a swing: the evade from its follow-through; the roll from its wind-up too, and pressed through the cut
    // itself it is kept a moment and rolls as the cut ends: rollCancels, issue #442)
    const outOfSwing = !this.swinging || (this.roll ? rollCancels(this.phase, this.charging) : this.phase === 'recover' || this.charging);
    this.rollWant = Math.max(0, this.rollWant - dt);
    // Both forms remember a short grounded press, but never cancel an active cut or shorten cooldown/i-frame rest.
    if (!ok || !p?.onGround) this.rollWant = 0;
    else if (dodgePress) this.rollWant = (this.roll ?? EVADE).buffer ?? EVADE.buffer;
    if (ok && (dodgePress || this.rollWant > 0) && !this.evadeT && !this.evadeCool && p?.onGround && outOfSwing) {
      const E = this.evadeSpec = this.roll ?? EVADE;
      this.rollWant = 0;
      this.stop(); this.evadeT = E.duration; this.evadeCool = E.cooldown;
      this.evadeAge = 0; this.evadeGranted = this.iframeRest === 0; this.dodged = false;
      if (p._moveDir?.lengthSq() > 0.01) this.evadeDir.copy(p._moveDir);
      else if (this.roll) p.frame.dir(p.heading, this.evadeDir);   // (a roll goes the way he faces: never a backstep)
      else p.frame.dir(p.heading, this.evadeDir).negate();
      p.frame.dir(p.heading, this.dir);
      const target = this.roll ? null : lockTarget(p.pos);
      if (this.roll) this.dir.copy(this.evadeDir);   // (he faces the way he rolls)
      if (target) {
        _a.subVectors(target.position(), p.pos); _a.addScaledVector(p.frame.up, -_a.dot(p.frame.up));
        if (_a.lengthSq() > 1e-6) this.dir.copy(_a).normalize();
      }
      this.guardK = 0;
    }
    if (held) this.queued = false;
    // (the guard at any moment: a fresh press stops the swing, whatever its phase, #757)
    if (guardCancels({ press: guardPress, swinging: this.swinging, ok: ok && !!p })) {
      this.stop(); this.chainT = 0; this.buffered = 0; this.dashWant = false; this.last = -1;
      this.guardLead = true;   // (drawn at once from the swing's pose: placed below)
    }
    if (!held) this.guardLead = false;
    if (p) p.combatMotion = null;
    this.chainT = Math.max(0, this.chainT - dt);
    this.parry = Math.max(0, this.parry - dt);
    if (!ok || !p) {
      // (climbing, swimming, gliding, on the jets, aiming, riding, knocked down, a scene: the blade put away at once, the shield folds)
      this.stop(); this.evadeT = 0; this.guardK = 0; this.guardWant = false; this.since = Infinity; this.fightSince = Infinity; if (p) p.inFight = false;
      this.sheath.update(dt, false, { ok: false });   // (flown back to the frog, no reach: the arms are busy)
      this.placeShield(dt); return this.fade(dt);
    }
    // the riposte: a press in the window a perfect parry opened (the guard may still be held)
    // (a foe's broken poise opens it too, a little longer, and a press kept from the swing that broke it counts: openRiposte)
    if ((press || (this.riposteFor && this.buffered > 0)) && riposteOpen(this.sinceParry, this.riposteFor ?? RIPOSTE) && !this.swinging && !this.evadeT && p.onGround) { this.sinceParry = Infinity; this.riposteFor = null; this.buffered = 0; press = false; this.start(0, RIPOSTE); }
    // the dash cut: a press during an evade (or just after it) cuts as the evade ends, once a cooldown
    if (press && this.evadeT > 0) this.dashWant = true;
    if ((this.dashWant || press) && !this.evadeT && !this.swinging && !held && p.onGround && this.cool === 0 && dashOpen(this.sinceEvade, this.dashCool)) { this.dashWant = false; this.buffered = 0; press = false; this.start(0, DASH); }
    if (this.sinceEvade > DASH.late || this.dashCool > 0) this.dashWant = false;
    // a press is kept a moment (BLADE.buffer): pressed during an evade or the cooldown, it swings as soon as it can
    if (press && !held) this.buffered = BLADE.buffer;
    else this.buffered = Math.max(0, this.buffered - dt);
    if (this.buffered > 0 && !held && !this.evadeT) {
      if (this.swinging) { this.queued = this.n < 2 && !ENDS.has(this.special); this.buffered = 0; }   // chained: the next swing follows this one (not after the charged or the air cut)
      else if (this.cool === 0 && !(this.airUsed && !p.onGround)) { this.start(this.chainT > 0 ? Math.min(this.last + 1, 2) : 0); this.buffered = 0; }   // (in the air: the air combo's next, start())
    }
    // held past CHARGE.after since the press that began a combo swing, once it has cut: the charge (CHARGE, chargeOpen), on
    // the ground, the clip there
    if (this.swinging && !this.charging && bladeHeld && chargeOpen({ n: this.n, special: this.special, phase: this.phase, held: this.holdT, onGround: p.onGround })
      && p.animator?.moveClip?.(CHARGE.clip)) {
      this.charging = { t: 0, full: false, mote: 0 }; this.phase = 'charge'; this.queued = false; T.sound?.fluidCharge?.(false);
    }
    if (this.charging) {
      const C = this.charging;
      C.t += dt;
      if (!C.full && C.t >= CHARGE.full) {
        C.full = true; T.sound?.fluidCharge?.(true);
        this.rippleAt(0, BLADE_LOOK.ripple.charge);
        const at = _o.copy(p.pos).addScaledVector(p.frame.up, 1.2);
        T.rings?.add({ from: at, dir: p.frame.up, reach: 0.05, r0: 0.25, r1: 1.2, life: 0.3, color: '#fff6dc', thick: 1 });
        T.rings?.add({ from: _a.copy(p.pos).addScaledVector(p.frame.up, 0.05), dir: p.frame.up, reach: 0.02, r0: 0.3, r1: 1.0, life: 0.35, color: T.modeTones?.[0] ?? '#52c8cf', thick: 0.8 });
      }
      // (gathering: motes of fluid drift into the blade from round it, faster once full: CHARGE_LOOK)
      C.mote += dt * CHARGE_LOOK.motes * (C.full ? 1.6 : 1);
      const seg = C.mote >= 1 ? this.bladeSegment(1) : null;
      while (C.mote >= 1) {
        C.mote -= 1;
        if (!seg || !T.glow) continue;
        const to = _tip.lerpVectors(seg.a, seg.b, 0.3 + 0.7 * Math.random()), from = _back.copy(to).add(_vel.randomDirection().multiplyScalar(CHARGE_LOOK.from));
        T.glow.add({ pos: from, vel: _lag.subVectors(to, from).multiplyScalar(2.6), drag: 0.6, size: 0.035, life: 0.38, color: Math.random() < 0.5 ? '#fff6dc' : T.modeTones?.[0] ?? '#52c8cf', grow: true });
      }
      p.chargeHold = chargeBody(C.t, C.full, T.time ?? C.t);
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
        if (this.spec?.heavy) kick(0.12);   // (the heavy third comes down: a nudge of the camera, landed or not)
        if (this.special === AIR && !p.onGround) p.airKick = { up: -AIR.plunge, ...(this.airPull ? { dir: this.dir, speed: 1 } : {}) };   // (the air cut: driven down into it, the carry in spent)
      }
      // (the air combo's light swings: held up in the air through the wind-up and the cut, sinking a little through the
      // follow-through, AIR_COMBO; the next one pressed for cuts the follow-through short)
      if (airLight(this.special) && !p.onGround) {
        const vu = p.vel ? p.vel.dot(p.frame.up) : 0, rec = this.phase === 'recover';
        p.airKick = { up: Math.max(vu > 0 ? vu * AIR_COMBO.keep : vu, rec ? AIR_COMBO.sink : AIR_COMBO.drift), ...(this.airPull && this.phase === 'wind' ? { dir: this.dir, speed: this.airPull } : {}) };
        if (rec && this.queued && this.t * this.dur >= this.sample.wind + this.sample.active + AIR_COMBO.cancel) { this.last = this.n; this.queued = false; this.chainT = BLADE.chain; this.start(this.last + 1); }
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
        if (this.last === 2 || ENDS.has(this.special)) { this.cool = BLADE.cooldown * (flurryLeft() > 0 ? FLURRY.cool : 1) * (this.quick?.cooldown ?? 1); this.chainT = 0; }   // (a flurry's blows come quicker)
        else { this.chainT = BLADE.chain; if (this.queued) this.start(this.last + 1); }
        this.queued = false;
      }
    }
    // A captured swing poses the whole grounded body; the aim layer only turns toward the target.
    if (this.swinging && this.move && T.k < 0.05) {
      const S = this.move, u = Math.min(this.t, 1), m = (p.swingMove ??= {});
      if (this.charging) { m.clip = CHARGE.clip; m.t = chargePose(this.charging.t); }
      else { m.clip = S.clip; m.t = this.sample.t; }
      m.air = S === AIR; m.full = !S.upper && (!!p.onGround || m.air); m.id = this.swingId; m.blend = this.charging ? CHARGE.draw : 0.09;
      // (in over 70 ms, out over 120; the charged cut let go is already in: no dip back toward the loops)
      m.w = this.charging ? 1 : THREE.MathUtils.clamp(Math.min(S === CHARGE ? 1 : u * this.dur / 0.07, (1 - u) * this.dur / 0.12), 0, 1);
      // (the riposte: turned into its chop, which comes down to his right)
      this.pose.dir = this.special === RIPOSTE ? (this._turned ??= new THREE.Vector3()).copy(this.dir).applyAxisAngle(p.frame.up, RIPOSTE.turn) : this.dir;
      // (the heavy third: turned back into its foe by `face` of the clip's coil through the wind-up, eased out over the cut: #759)
      if (S.face && p.onGround && this.phase !== 'recover') {
        const k = S.face * (this.phase === 'wind' ? 1 : 1 - THREE.MathUtils.clamp((this.t * this.dur - this.sample.wind) / this.sample.active, 0, 1));
        const hy = hipYaw(p);
        this.pose.face = -k * hy;   // (locked on, the lock's facing turned by as much: Player's facing)
        this.pose.dir = p.frame.dir(p.frame.headingOf(this.dir) + this.pose.face, this._turned ??= new THREE.Vector3());
      }
      this.pose.lead = this.special !== RIPOSTE;
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.pose.dir, 3);
      this.pose.k = 1; this.pose.noArm = true;
      this.pose.tilt = this.tilt ? this.tilt * this.aimK() : 0;   // (the soft aim: src/humanoid.js swingTilt)
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
        // (out of a swing it cancelled: the guard pose whole at once, blended from the swing's over GUARD.cancel s: #757)
        m.w = this.guardLead ? 1 : this.guardK; m.full = false; m.id = this.parry > 0 ? "block" : "guard"; m.blend = this.guardLead ? GUARD.cancel : 0.09;
      }
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.dir, 3);
      this.pose.k = this.guardK; this.pose.noArm = !!idle;
      p.aim = this.pose;
    } else if (!this.swinging && p.swingMove) p.swingMove = null;
    if (!want && this.guardK === 0) this.guardT = 0;
    // (a fight: a foe engaged near or locked on, FIGHT; it lasts FIGHT.after s past the last of them, so it never flickers between cuts)
    this.fightSince = (p.lockOn || foeEngaged(p.pos)) ? 0 : (this.fightSince ?? Infinity) + dt;
    const fighting = this.fightSince < FIGHT.after;
    p.inFight = fighting;   // (Player: no climb of its own in a fight, issue #747)
    const litWant = bladeLitWant({ swinging: this.swinging, fighting, inHand: this.sheath.held >= 1 });
    this.lit += (litWant - this.lit) * (1 - Math.exp(-(litWant > this.lit ? 30 : 9) * dt));
    if (this.charging) this.lit = 0.8 + 0.2 * Math.sin(this.charging.t * (this.charging.full ? 26 : 12));   // (gathering: the blade pulses, faster once full)
    if (this.evadeT && p.onGround) {
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.dir, 3);
      this.pose.k = 1; this.pose.noArm = true; p.aim = this.pose;
      const E = this.evadeSpec;
      p.combatMotion = { dir: this.evadeDir, speed: E.speed * (0.55 + 0.45 * Math.sin(Math.PI * this.evadeT / E.duration)), scale: 0, evade: this.evadeT / E.duration, roll: this.rolling };
    } else if (this.charging && p.onGround) {
      p.combatMotion = { dir: this.dir, speed: 0, scale: CHARGE.move };   // (gathering: a slow step at most)
    } else if (this.swinging && p.onGround) {
      this.follow(p);
      const active = this.phase === 'strike';
      // (closing in on a foe just out of reach: MAGNET, through the wind-up and the cut)
      const pull = this.phase !== 'recover' && this.closeLeft > 0 ? this.closeIn : 0;
      this.closeLeft -= pull * dt;
      // (the dash cut: carried on through its wind-up and cut, slowing through the follow-through)
      if (this.special === DASH) p.combatMotion = { dir: this.dashDir, speed: this.phase === 'recover' ? this.dashSpeed * 0.25 * (1 - this.t) : this.dashSpeed, scale: 0.15, dash: true };
      // (the running cut: the run carried on through its wind-up and cut along the swing's way, easing to a stop through the follow-through)
      else if (this.special === RUN_CUT) {
        const S = this.sample, rec = this.phase === 'recover' ? THREE.MathUtils.clamp((this.t * this.dur - S.wind - S.active) / Math.max(1e-3, this.dur - S.wind - S.active), 0, 1) : 0;
        p.combatMotion = { dir: this.runDir, speed: (this.runSpeed ?? 0) * (1 - rec) ** RUN_CUT.ease, scale: 0.1, dash: true };
      }
      else p.combatMotion = { dir: this.dir, speed: Math.max(active ? (this.special === LUNGE ? 7 : 1.7) : 0, pull), scale: this.phase === 'recover' ? 0.45 : 0.15 };
    }
    // in a fight the blade stays in the fist (a while after, and all the time locked on), then is put away
    this.since += dt;
    if (this.swinging || this.evadeT || this.guardK > 0.05 || p._flinch) this.since = 0;
    const drawWant = bladeDrawn({ ok, swinging: this.swinging, guarding: this.guardK > 0.05, evading: this.evadeT > 0, locked: !!p.lockOn, fighting, since: this.since });
    // (drawn over the shoulder; a swing pressed with it on the back starts at once and the hilt is in the fist before its cut)
    const drawEvent = this.sheath.update(dt, drawWant, { quick: this.swinging });
    if (this._drawAudioReady && drawEvent === 'draw') T.sound?.bladeForm?.();
    this._drawAudioReady = true;
    this.place(dt);
    this.placeShield(dt);
  }

  /**
   * The shield strapped round the left forearm (src/shield.js): open while the guard is wanted, the arm braced across
   * before the chest and the face turned to its way; then the guard's arc from where it is drawn (block). The hands
   * close (player.shieldGrip).
   */
  placeShield(dt = 0) {
    const T = this.tool, p = T.player, D = this.device;
    const U = p?.frame?.up, chest = U ? _f.copy(p.pos).addScaledVector(U, 1.1) : null;   // (the raised arm is braced across before it)
    const said = D.update(dt, { want: !!this.guardWant, worn: !!p && !p.ride && !p.boarding && !p.unboarding && T.shieldOn !== false, dir: this.dir, up: U, chest, time: T.time ?? 0 });
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
    // (in the air: the air combo, two light swings and then the air cut, once an airtime, if its clip is there: AIR_COMBO)
    const A = p.animator, air = !force && !p.onGround && !!A?.moveClip?.(AIR.clip);
    const airStep = air ? Math.min(this.airN ?? 0, AIR_COMBO.swings.length) : -1;
    if (air) { this.airN = airStep + 1; this.n = n = airStep; }
    const airSpec = air ? AIR_COMBO.swings[airStep] ?? AIR : null;
    const hs = p.vel ? Math.hypot(p.vel.x, p.vel.z) : 0;
    this.special = force ? force : air ? airSpec : !this.chained && n === 0 && (p.sprinting || closing) && hasUpgrade('lunge', T.state) ? LUNGE
      : n === 0 && A?.moveClip?.(RUN_CUT.clip) && runCutOpen({ onGround: p.onGround, sprinting: p.sprinting, speed: hs, chained: this.chained }) ? RUN_CUT
        : n === 2 && hasUpgrade('whirl', T.state) ? WHIRL : null;
    if (airSpec === AIR) this.airUsed = true;
    const S = this.special ?? quickSwing(SWINGS[n], this.quick);   // (the fight temples' quick cut: QUICK_CUT)
    this.move = S && A?.moveClip?.(S.clip) ? S : null;
    this.spec = S; this.sample = attackSample(S, 0); this.dur = this.sample.duration;
    // (the press answered at once: the grip and the fluid drawn back, the cut's whoosh at the end of the wind-up;
    // before, nothing was heard for the wind-up's 133 ms, issue #379. The dash cut and the riposte have their own.)
    if (!force) T.sound?.fluidWindup?.(n, ENDS.has(this.special));
    if (this.special === RUN_CUT) { T.sound?.fluidDash?.(); this.runSpeed = THREE.MathUtils.clamp(hs, 0, RUN_CUT.carry); }   // (the rush of the run carried into it)
    this.hitAt = (this.sample.wind + this.sample.active * 0.45) / this.dur;
    // the swing's way: toward the nearest foe in reach, else where the traveller faces
    const foe = lockTarget(p.pos, BLADE.lock, allTargets(), T.lockOn?.() ?? null);
    if (foe) this.dir.subVectors(foe.position(), p.pos); else p.frame.dir(p.heading, this.dir);
    this.dir.addScaledVector(U, -this.dir.dot(U));
    // a foe just out of reach: the swing steps you in to it (not the lunge, which carries you itself); one hovering
    // over you: a rising cut, up to it
    const flat = this.dir.length(), time = this.sample.wind + this.sample.active, pullT = closeInTime(this.sample);
    const rise = foe && this.special !== LUNGE && !force && p.onGround && mayRise(foe, this.inFight(p)) ? riseTo(foe.position().dot(U) - p.pos.dot(U) - 1.1, flat, time) : null;
    this.rising = !!rise;
    if (rise) p.riseKick = { up: rise.up, speed: rise.speed, dir: this.dir.clone().normalize() };
    this.closeIn = foe && !rise && this.special !== LUNGE && this.special !== DASH && this.special !== RUN_CUT && p.onGround ? closeInSpeed(flat, foe.reach ?? foe.radius ?? 0.6, pullT, force === RIPOSTE ? { ideal: RIPOSTE.ideal, max: MAGNET.max } : flurryLeft() > 0 ? { ...MAGNET, max: FLURRY.reach } : wideSweep(this.wide, n, this.special) ? { ...MAGNET, ideal: this.wide.pull } : MAGNET) : 0;   // (in a flurry: from further, src/flurry.js; the generous cut: only to bring it under the crescent)
    this.closeLeft = this.closeIn * pullT;
    // (kept to its foe through the wind-up and the pull, TRACK: the plain swings, the whirl, the riposte; not rising, in the air or the carried specials)
    this.trackHop = !!foe?.foe?.hopBack;
    this.track = foe && !rise && p.onGround && !air && ![LUNGE, DASH, RUN_CUT, AIR].includes(this.special) ? foe : null;
    this.trackSpec = force === RIPOSTE ? { ideal: RIPOSTE.ideal, max: MAGNET.max } : flurryLeft() > 0 ? { ...MAGNET, max: FLURRY.reach } : wideSweep(this.wide, n, this.special) ? { ...MAGNET, ideal: this.wide.pull } : MAGNET;
    this.aimAt(foe, flat - this.closeLeft, !rise && p.onGround && this.special !== AIR);   // (aimed from where the pull will have him)
    if (this.special === RUN_CUT) { (this.runDir ??= new THREE.Vector3()).copy(this.dir); if (this.runDir.lengthSq() > 1e-8) this.runDir.normalize(); else p.frame.dir(p.heading, this.runDir); }
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
    // the air combo's light swings: lifted a little as each starts, carried in to a foe out of reach (AIR_COMBO.pull)
    this.airPull = 0;
    if (air && airSpec !== AIR) {
      const reach = foe ? closeInSpeed(flat, foe.radius ?? 0.6, this.sample.wind, { ideal: AIR_COMBO.ideal, max: AIR_COMBO.pull }) : 0;
      this.airPull = reach;
      p.airKick = { up: Math.max(p.vel ? p.vel.dot(U) : 0, AIR_COMBO.lift), ...(reach > 0 ? { dir: this.dir.clone().normalize(), speed: reach } : {}) };
    }
    // the air cut: held a moment at the top, and carried in to a foe a little out of reach (AIR.pull) as the ground's pull does
    else if (air) {
      const reach = foe ? closeInSpeed(flat, foe.radius ?? 0.6, this.sample.wind, { ideal: AIR.ideal, max: AIR.pull }) : 0;
      this.airPull = reach > 0;
      p.airKick = { up: Math.max(p.vel ? p.vel.dot(U) : 0, AIR.lift), ...(reach > 0 ? { dir: this.dir.clone().normalize(), speed: reach } : {}) };
    }
    if (this.dir.lengthSq() < 1e-6) p.frame.dir(p.heading, this.dir);
    this.dir.normalize();
    T.used('blade', p.pos);
  }

  /**
   * TRACK: through the wind-up and the cut's pull, the swing's way turned to where its foe is now and the pull taken again
   * from there (not a foe hopping back out of it on purpose: it keeps the pull it had).
   */
  follow(p) {
    const T = this.track;
    if (!T || !TRACK.from.includes(this.phase) || this.charging) return;
    const pullT = closeInTime(this.sample), el = this.t * this.dur, left = pullT - el;
    if (left <= 1e-3 || !(T.enabled?.() ?? true)) { if (left <= 1e-3) this.track = null; return; }
    const U = p.frame.up;
    _a.subVectors(T.position(), p.pos); _a.addScaledVector(U, -_a.dot(U));
    const flat = _a.length();
    if (flat > 1e-3) this.dir.copy(_a).divideScalar(flat);
    if (T.foe?.hopBack || this.trackHop) { this.trackHop = true; return; }   // (hopped back out of it on purpose: let it go)
    this.closeIn = closeInSpeed(flat, T.reach ?? T.radius ?? 0.6, left, this.trackSpec ?? MAGNET);
    this.closeLeft = this.closeIn * left;
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
    const pullT = closeInTime(this.sample);
    this.closeIn = foe && p.onGround ? closeInSpeed(_a.length(), foe.reach ?? foe.radius ?? 0.6, pullT) : 0;
    this.closeLeft = this.closeIn * pullT;
    this.aimAt(foe, foe ? _a.length() - this.closeLeft : 0, !!p?.onGround);
  }

  /**
   * The soft aim for this swing (AIM, aimTilt): how far its plane tilts toward `foe`'s body (`flat` m off), eased in over
   * the wind-up (aimK); none without a foe, rising, or in the air.
   */
  aimAt(foe, flat, ok = true) {
    this.tilt = 0;
    const p = this.tool.player;
    if (!foe || !ok || !p) return;
    const U = p.frame.up, feet = p.pos.dot(U), model = foe.body?.();
    let lo, hi;
    if (model) { const S = bodySpan(model, _span); lo = S.lo - feet; hi = S.hi - feet; }
    else { const c = foe.position().dot(U) - feet, r = foe.radius ?? 0.5; lo = c - r; hi = c + r; }
    const sh = p.humanoid?.b?.upperarm_r ? p.humanoid.b.upperarm_r.getWorldPosition(_a).dot(U) - feet : 1.25;
    this.tilt = aimTilt(lo, hi, Math.max(0, flat - (foe.radius ?? 0.5) * 0.5), sh, this.special ? 0 : this.n);
  }

  /** The soft aim's share now: in over the wind-up, held through the cut, out over the follow-through. */
  aimK() {
    if (!this.tilt || !this.sample) return 0;
    const S = this.sample, e = this.t * this.dur;
    if (this.charging) return 1;
    if (e < S.wind) return THREE.MathUtils.smoothstep(e / S.wind, 0, 1);
    if (e < S.wind + S.active) return 1;
    return 1 - THREE.MathUtils.smoothstep((e - S.wind - S.active) / Math.max(1e-3, this.dur - S.wind - S.active), 0, 1);
  }

  /**
   * A foe's poise broken (issue #722, src/foes.js Foes.poiseBroken): the riposte's window opens as a perfect parry's does,
   * `window` s (a little longer: the blow that broke it is still in its follow-through).
   */
  openRiposte(window = RIPOSTE_BROKEN) { this.sinceParry = 0; this.riposteFor = { window }; }

  /** The active cut: coarse range/occlusion first, then the actual swept blade. */
  strike() {
    const T = this.tool, S = this.special;
    this.cutNow = true;
    const C = this.coarse(this._coarse ??= { origin: _o }), origin = C.origin;
    const pose = this.rising ? null : this.bladeSegment();   // (the rising cut: the leap's cone, the arms swing level)
    let hits = bladeHits(origin, C.dir, T.physics, { reach: C.reach, angle: C.angle });
    if (pose) {
      // a foe's drawn body (src/foe-body.js): the swept blade meets any of its parts, wherever the cone's test of its sphere
      // would say (a heron's stilts, a crab's pincers, a moth's wings); anything else: its sphere, as before
      hits = hits.filter((h) => !h.target.body?.());
      hits.push(...bodyHits(origin, C.reach, T.physics, this.previousBlade ?? pose, pose));
      hits = hits.filter((h) => h.body || sweptBladeTouches(h.target.position(), bladeTouchRadius(h.target), this.previousBlade ?? pose, pose));
    }
    // the generous cut (WIDE_CUT, the fight temples): every foe the drawn crescent has reached so far, a wall between keeping one out
    const sweep = !S?.down && !this.rising ? wideSweep(this.wide, this.n, S) : null;
    // (the crescent is the whole of it there: what the sword itself meets is under it, and nothing outside it is cut)
    if (sweep) hits = this.sweepHits(sweep, origin);
    hits = hits.filter((h) => !this.hitTargets.has(h.target));
    for (const h of hits) this.hitTargets.add(h.target);
    const damage = (S === CHARGE ? CHARGE.damage[this.chargeFull ? 1 : 0] : S?.damage ?? BLADE.damage[this.n] ?? 1) * (BLADE.edge ?? 1);
    const light = airLight(S), heavy = this.n === 2 || (!!S && !light);   // (the air combo's light swings count as the combo's own)
    const info = { ...T.info(), damage, combo: S && !light ? 2 : this.n, ...(S === CHARGE ? { breaks: true, charged: this.chargeFull } : {}), ...(S === AIR || light ? { air: true } : {}), ...(S === RIPOSTE ? { breaks: true, stagger: RIPOSTE.stagger, riposte: true } : {}), ...(S === DASH ? { dash: true, source: 'dash' } : {}) };
    // Geometry proposes a contact; the target owns its outcome. Preserve callbacks
    // without a return value, but respect explicit rejection and the shared dull
    // result (armour / a guardian whose current state did not answer the cut).
    hits = hits.filter((h) => {
      const result = { ...info, mode: 'blade' };
      const accepted = h.target.onHit?.('blade', h.point, h.dir, result);
      return accepted !== false && !result.dull;
    });
    // a creature the blade passes through is bonked (v1.41: it was only scared off, from anywhere in the cone): knocked
    // away head over heels, dazed a moment, no harm (src/wildlife.js BONK); the cut's sphere test as for a foe with no body
    let bonked = 0;
    for (const h of targetsInCone(origin, C.dir, C.reach, C.angle, T.physics)) {
      if (h.target.kind !== 'wildlife' || this.hitTargets.has(h.target)) continue;
      if (pose && !sweptBladeTouches(h.target.position(), bladeTouchRadius(h.target), this.previousBlade ?? pose, pose)) continue;
      this.hitTargets.add(h.target);
      if (h.target.onHit?.('blade', h.point, h.dir, info)) bonked++;
    }
    if (bonked && !hits.length) hitStop(0.035);
    if (hits.length) {
      T.lastHit = 'target';
      hitStop((S === CHARGE && this.chargeFull) || S === RIPOSTE ? 0.15 : heavy ? 0.11 : 0.06); kick(S === CHARGE || S === RIPOSTE ? 0.7 : heavy ? 0.5 : 0.25);   // (the cut lands: the frame freezes, src/feel.js)
      if (S === RIPOSTE) {
        // (the riposte lands: a gold burst off the foe, a ring-out)
        T.sound?.fluidRiposte?.(true);
        for (const h of hits) {
          T.rings?.add({ from: h.point, dir: this.dir, reach: 0.1, r0: 0.2, r1: 1.4, life: 0.32, color: RIPOSTE_GOLD, thick: 1 });
          for (let i = 0; i < 14; i++) T.glow?.add({ pos: h.point, vel: _a.randomDirection().multiplyScalar(3), drag: 3, size: 0.06, life: 0.45, color: i % 2 ? '#fff6dc' : RIPOSTE_GOLD, grow: true });
        }
      }
      for (const h of hits) T.splash(h.point, h.dir.clone().negate(), 0.6, 'cut');
      // (the inked star where it landed, held through the hit-stop: src/hit-burst.js; issue #713) along the blade's way
      const cut = pose && this.previousBlade ? _vel.subVectors(pose.b, this.previousBlade.b) : this.dir;
      // (a third of the way from the contact into the struck body's middle: on the foe, not on the traveller beside it)
      for (const h of hits.slice(0, 3)) T.bursts?.add({ at: h.target?.position ? _back.copy(h.point).lerp(h.target.position(), HIT_BURST.into) : h.point, heavy, cut });   // (a light splash of the blade's fluid: the foe's own splash says the rest, Foes.react)
      this.hit = true;
      // (a ring runs along the blade from where it struck, both ways)
      const at = pose ? _tip.copy(hits[0].point).sub(pose.a).dot(_vel.subVectors(pose.b, pose.a)) / Math.max(pose.a.distanceToSquared(pose.b), 1e-6) : 0.75;
      this.rippleAt(THREE.MathUtils.clamp(at, 0.2, 1), heavy ? BLADE_LOOK.ripple.heavy : BLADE_LOOK.ripple.hit, S === RIPOSTE ? 1 : 0);
    }
    if (hits.length || bonked) T.sound?.fluidSlashHit?.(true, hits.length > 0 && info.combo === 2);
    return hits;
  }

  /** How far through its cut the swing is (0..1): the clip's displayed time across its active window, or the arc's strike phase. */
  cutU() {
    if (this.move) {
      const [a, b] = activeRange(this.spec), t = this.tool.player?.swingMove?.t;
      return t === undefined ? 0 : THREE.MathUtils.clamp((t - a) / Math.max(1e-4, b - a), 0, 1);
    }
    const S = this.sample;
    return S ? THREE.MathUtils.clamp((this.t * this.dur - S.wind) / Math.max(1e-4, S.active), 0, 1) : 0;
  }

  /**
   * The generous cut's hits this frame (WIDE_CUT; strike()): the crescent laid as far as the cut has gone (this.slash,
   * what src/slash-arc.js draws), every foe whose body it reaches, out of a wall's way.
   */
  sweepHits(sweep, origin) {
    const T = this.tool, p = T.player, W = this.wide, up = hasUpgrade('reach', T.state) ? REACH_UP : 1;
    const dir = _f.copy(this.dir).setY(0);
    if (dir.lengthSq() < 1e-8) return [];
    dir.normalize();
    const u = Math.max(this.slash?.id === this.swingId ? this.slash.u : 0, this.cutU() || 1e-3);
    const reach = (sweep.reach ?? W.reach) * up;
    this.slash = { id: this.swingId, sweep, u, reach, at: (this.slash?.at ?? new THREE.Vector3()).copy(p.pos), dir: (this.slash?.dir ?? new THREE.Vector3()).copy(dir), done: -1 };
    const span = sweepSpan(sweep, u), out = [];
    for (const t of allTargets()) {
      if (!t.enabled() || !t.accepts?.includes('blade')) continue;
      // (its body as drawn: a foe's own radius, not the blade's touch margin on it)
      const c = t.position(), dx = c.x - p.pos.x, dz = c.z - p.pos.z, r = t.foe?.def?.radius ?? t.radius ?? 0.5;
      if (Math.abs(c.y - p.pos.y) > W.height + r || !underSweep(dx, dz, r, dir, span, reach)) continue;
      _r.subVectors(c, origin); const d = _r.length(), to = d > 1e-5 ? _r.divideScalar(d).clone() : dir.clone();
      if (T.physics?.rayDistance && d > 0.3 && T.physics.rayDistance(origin, to, d) < d - r - 0.05) continue;   // (a wall between)
      out.push({ target: t, distance: Math.max(0, Math.hypot(dx, dz) - r), point: c.clone(), dir: to });
    }
    return out;
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

  /** How far the blade shows (bladeGrowth's `lit`): lit, or in the fist (`inFist`) the idle share (bladeIdle: 0, none), eased in and out. */
  shownLit(dt, inFist) {
    const want = inFist && !this.swinging && !this.charging ? 1 : 0;
    this.idleK = dt > 0 ? (this.idleK ?? 0) + (want - (this.idleK ?? 0)) * (1 - Math.exp(-4 * dt)) : want;
    const time = (this.tool.time ?? 0) + (this._inspectT ?? 0);
    return Math.max(this.lit, bladeIdle(time) * this.idleK);
  }

  /** A ring along the blade from `from` (0 the cup .. 1 the point), `k` strong, gold by `gold` (src/blade-shader.js), and a flash. */
  rippleAt(from, k = 1, gold = 0) {
    Object.assign(this.ripple, { age: 0, from, k, gold });
    this.flash = Math.max(this.flash, Math.min(1, 0.5 * k));
  }

  /**
   * The blade's life a frame (src/blade-shader.js), once it is placed: its currents' clock (faster through a swing), the
   * smear and the lag (the point's speed, and where the fluid trails in the blade's own frame), the breath, the ripple and
   * the flash, the magic's glow; the bead in the cup breathing with it.
   */
  alive(dt) {
    const T = this.tool, L = BLADE_LOOK, M = this.swordMat.uniforms;
    let speed = 0, lagged = false;
    if (this.bladeGroup.visible && this.group.visible) {
      if (dt > 0) {
        this.core.updateWorldMatrix(true, false);
        const tip = _tip.set(0, this.builtLength, 0).applyMatrix4(this.core.matrixWorld);
        if (this.tipPrev) {
          speed = _vel.subVectors(tip, this.tipPrev).length() / dt;
          if (speed > 1e-3) {
            // (a point bladeLag back along the way it moves, in the blade's object space: x across, z through)
            _back.copy(tip).addScaledVector(_vel, -bladeLag(speed) / (speed * dt));
            this.core.worldToLocal(_back);   // (the point itself is (0, builtLength, 0) there)
            _lag.set(_back.x, 0, _back.z);
            lagged = true;
          }
        }
        (this.tipPrev ??= new THREE.Vector3()).copy(tip);
      }
    } else this.tipPrev = null;
    if (!lagged && dt > 0) _lag.set(0, 0, 0);
    if (dt > 0) {
      const want = bladeSmear(speed);
      this.smear += (want - this.smear) * (1 - Math.exp(-(want > this.smear ? 30 : 6) * dt));
      this.lagV.lerp(_lag, 1 - Math.exp(-25 * dt));
      this.flowExtra += dt * L.flow * this.smear;
      this.ripple.age += dt;
      this.flash *= Math.exp(-8 * dt);
    }
    const time = (T.time ?? 0) + (this._inspectT ?? 0), breath = time * L.breathRate;
    M.uFluidA.value.z = time + this.flowExtra;   // (the currents flow up it)
    const R = T.reserve, energy = R?.max ? R.level / R.max : 1;
    M.uBlade.value.set(this.smear, energy, breath, bladeLite() ? 1 : 0);
    M.uBladeB.value.set(this.lagV.x, this.lagV.z, this.ripple.age, this.ripple.from);
    M.uBladeC.value.x = this.ripple.k; M.uBladeC.value.y = this.ripple.gold; M.uBladeC.value.z = this.flash;
    // the bead breathes (scaled about the cup's lip, where it stands)
    if (this.bead) {
      const k = 1 + 0.12 * (0.5 + 0.5 * Math.sin(breath)) + 0.5 * this.flash;
      this.bead.scale.setScalar(k); this.bead.position.y = HILT.mouth * (1 - k);
    }
  }

  stop() { this.track = null; this.charging = null; if (this.tool.player) this.tool.player.combatMotion = null; this.n = -1; this.queued = false; if (this.tool.player) this.tool.player.swingMove = null; }

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
    const ok = this.group.parent === g.bone ? (fitScale(this.group), true) : carry(this.group, g);
    // (turned about the blade's own line, y, by the swing's roll: the hilt where it was, the edge leading)
    this.group.quaternion.copy(g.quaternion);
    if (this.edgeRoll) this.group.quaternion.multiply(_q2.setFromAxisAngle(_y0, this.edgeRoll));
    return ok;
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
  /**
   * The generous cut's crescent (WIDE_CUT, src/slash-arc.js) drawn from this.slash, the state its hits read: laid while
   * the cut goes, lingering SLASH_LOOK.linger s once it is through; nothing outside the fight temples.
   */
  drawSlash(dt) {
    const S = this.slash;
    if (S && (S.u >= 1 || S.id !== this.swingId || !this.swinging || this.phase === 'recover')) S.done = S.done < 0 ? 0 : S.done + dt;
    if (S && (S.done > SLASH_LOOK.linger || !this.wide)) this.slash = null;
    if (this.wide && !this.arc && this.tool.fx) this.arc = new SlashArc(this.tool.fx);
    if (!this.arc) return;
    if (this.slash && this.slash.done < 0 && this.slash.u < 0.2) {
      // (in the sword's own water: a fight temple's colours worn tint it, src/kit-colours.js)
      const U = this.swordMat?.uniforms;
      if (this.slashTones) this.arc.tint(this.slashTones);   // (the fight temples' fury: the ember's)
      else if (U?.uFluidTones) this.arc.tint([U.uFluidBase?.value ?? U.uFluidTones.value[4], '#fff6dc']);
    }
    this.arc.update(dt, this.slash);
  }

  place(dt) {
    // (a swing's `roll`, SWINGS: the blade turned about its own line in the fist, eased in and out with the swing's pose)
    // (keyed by the clip on his body: the pose shown, at its weight)
    const P = this.tool.player, R = P?.shownClip ? edgeRollOf(P.shownClip) : 0;
    this.edgeRoll = R ? R * THREE.MathUtils.clamp(P.shownW ?? 1, 0, 1) : 0;
    this.drawSlash(dt);
    this.previousBlade = this.bladeSegment();
    const T = this.tool, p = T.player, S = this.sheath;
    const on = p?.object?.visible !== false && T.swordOn !== false;   // (once found: main.js sets tool.swordOn from the items; a scene may put it away)
    const held = S.held;
    // (the frog stood off an outfit's pack or hood: src/sword-sheath.js SHEATH_OUT, the v2 Wardrobe's outfit worn)
    const worn = p?.character?.v2?.wardrobe?.worn?.id ?? null;
    if (worn !== this.sheathOutfit) { this.sheathOutfit = worn; this.sheathAt = sheathFrame(undefined, worn); if (p?.sheathReach) p.sheathReach.at = this.sheathAt.position; }
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
    // (in the fist between cuts nothing stands out of the cup, only the bead breathes in it: bladeIdle, BLADE_LOOK.idle 0)
    const shown = this.shownLit(dt, held >= 0.97 && placed);
    this.bladeGroup.visible = shown > 0.03 && (held > 0.97 || !placed);
    // (the blade grows out of the cup as it lights: its length tuned and upgraded, its width filling out, broader with ink)
    const grown = bladeGrowth(shown, T.state);
    this.bladeGroup.scale.set(grown.width / this.builtWidth, grown.length / this.builtLength, 1);
    this.alive(dt);
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
        const steps = Math.min(HIT_FX.trail, Math.max(1, Math.ceil(from.b.distanceTo(seg.b) / 0.2)));   // (v1.41: up to 6 a frame, one every 12 cm)
        for (let k = 1; k <= steps; k++) {
          const u = k / steps, x = 0.7 + 0.3 * ((k + n) % 2);
          _a.lerpVectors(from.a, seg.a, u); _b.lerpVectors(from.b, seg.b, u);
          T.glow.add({ pos: _o.lerpVectors(_a, _b, x), vel: _r.set(0, 0, 0), drag: 8, size: 0.012 + 0.008 * ((k + n) % 2), life: 0.12, color: tones[(n + k) % tones.length], grow: false });
        }
        // (they fall to the ground at his feet and splash there; a fast cut throws more off the point: not on the lite look)
        const lite = bladeLite(), floor = p?.frame?.up ? p.pos.dot(p.frame.up) : null;
        const land = !lite && floor !== null ? (this._land ??= (d) => this.splash(d)) : null;
        const drop = (d) => T.drops?.add(land ? { ...d, floor, land } : d);
        for (const d of shedDrops(from, seg, dt, style)) drop(d);
        if (!lite && this.smear > 0.45) for (const d of shedDrops(from, seg, dt, { ...style, drops: this.smear > 0.8 ? 2 : 1 }, Math.random, 0.85)) drop(d);
      } else {
        // wind-up, follow-through: a glint at the tip, and now and then a drip off the splash by the cup
        T.glow.add({ pos: _o.lerpVectors(seg.a, seg.b, 0.9), vel: _r.set(0, 0, 0), drag: 8, size: 0.01, life: 0.06, color: tones[n % tones.length], grow: false });
        if (Math.random() < dt * 6) T.drops?.add({ pos: _o.lerpVectors(seg.a, seg.b, 0.05 + Math.random() * 0.25), vel: _r.set(0, 0, 0), grav: 9, size: 0.012, stretch: 2.5, life: 0.45, color: WAKE_TONES[Math.random() < 0.7 ? 0 : 1] });
      }
    }
    this.trailFrom = seg ? { a: seg.a.clone(), b: seg.b.clone() } : null;
  }

  /** A drop off the blade meets the ground (tool.drops `land`): two droplets pop up off it, a little flat splash spreads and fades. */
  splash(d) {
    const T = this.tool, up = T.player?.frame?.up ?? _Y;
    for (let i = 0; i < HIT_FX.landing; i++) T.drops?.add({ pos: d.pos, vel: _a.randomDirection().multiplyScalar(0.6).addScaledVector(up, 1 + Math.random()), grav: 9, size: d.size * 0.5, life: 0.2, color: d.color });
    T.drops?.add({ pos: d.pos, flat: true, grow: true, size: d.size * 2.4, life: 0.35, color: d.color });
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

  dispose() { this.arc?.dispose(); this.group.removeFromParent(); this.frog.removeFromParent(); this.wake.dispose(); this.device.dispose(); if (this.tool.player?.guard) this.tool.player.guard = null; if (this.tool.player?.shieldFace) this.tool.player.shieldFace = null; }
}
