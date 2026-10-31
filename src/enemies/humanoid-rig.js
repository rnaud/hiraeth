import * as THREE from 'three';
import { Animator, sideSpeedOf } from '../animator.js';
import { twoBone } from '../motion-kit/ik.js';
import { SecondOrder } from '../motion-kit/spring.js';
import { moveShape } from '../loco-moves.js';

// The humanoid foe rig (issue #724, docs/design/enemy-roster-v3.md; docs/systems/procedural-animation.md, "The humanoid
// foe rig"): one skeleton every humanoid foe shares, moved by the clips the traveller and the people use. The same
// retargeting as theirs (src/animator.js Animator: a hidden copy of the clip library's skeleton plays the clips; each of
// our limbs is aimed along the library bone's motion from its rest pose), so a 1.1 m mummer and a 2.6 m mummer king
// play the same walk, each on its own proportions. Clips: Quaternius' UAL (public/anim/ual.glb: idle, walk, jog, sprint,
// look round) for locomotion and the camp's life; the Mixamo moves already shipped (public/anim/moves.glb: the
// sword-and-shield and great-sword attacks, impact, strafes, get-ups, kneel) for the fight.
//
// What it does each frame (HumanoidDriver.update, from the model's anim(f, c)):
//   1. picks what the foe's state plays (stateClip: pure, tests/humanoid-rig.test.js): a loop of the library's
//      (locomotion by speed, the idle, the look round), or a move at a time in it (an attack's wind-up, strike and
//      recovery; a stagger, the poise knock-down and its get-up, a pickup, a site's sit and sleep);
//   2. an attack's wind-up is the clip's own anticipation stretched to the foe's wind-up time (windClipTime): its
//      loaded pose reached at HOLD_AT of the wind-up and held there (the telegraph rule: the body says it, complete at
//      75 %, held), then the strike runs the clip from the loaded pose through the cut at the attack's contact share
//      (strikeClipTime). The mind's timing is never touched: the clip follows the foe's clock, not the other way;
//   3. moves no clip has (a bow's draw, a throw, a horn to the mask, a rock dug up and held high) hold a procedural pose
//      of the arms over the clip's body (PROC_POSES; listed in the doc as the clips still missing);
//   4. procedural layers stay on top: the head turns to the traveller (src/enemies/gaze.js, after the pose), the feet
//      reach down to the ground on a slope (two-bone IK to the plane the foe stands on: no ray of their own), springs swing
//      the cloth and the props, and the model's own touches (a bow-legged stance, a mask's wobble) after it.
//
// Without the clip library (node tests, a page that never loads it) the same states hold a procedural stance and walk
// (fallbackPose), so a model always draws. The library's clips are shared by every foe (one AnimationClip each, parsed
// once); each foe has its own hidden skeleton and mixer (Animator), made when the clips are in (setFoeClips).

/** The clip library the humanoid foes play (src/foes.js sets it from its `lib`; the gallery loads it itself). */
const LIB = { lib: null };
export function setFoeClips(lib) { if (lib) LIB.lib = lib; }
export const foeClips = () => LIB.lib;

/** The wind-up's loaded pose is reached at this share of the wind-up and held (docs/systems/foes.md, "Telegraphs"). */
export const HOLD_AT = 0.75;
/** s a move eases in over (from the loop's pose) and out over. */
export const BLEND = { in: 0.12, out: 0.22 };
/** Feet on the ground: how far a foot reaches (share of the leg) down or up to the slope's plane. */
export const PLANT = { reach: 0.35 };
/**
 * A move changed for another while one plays (the feint's stopped cut into its thrust, a stagger into the knock-down, a
 * strafe into a wind-up): the joints crossfaded from the pose shown over `secs` (`fall` into lying down: the fall itself).
 */
export const XFADE = { secs: 0.18, fall: 0.4 };
/**
 * A thrown move (`release`: the rock lob, the king's throw, whose thing flies off during the wind-up itself, from
 * `release` of it): loaded by `release - hold` of the wind-up at the latest (the held telegraph), then the throw's clip
 * runs load → cut over the first `cut` share of what is left and its follow-through over the rest (releaseClipTime).
 */
export const RELEASE = { hold: 0.18, cut: 0.45 };
/**
 * Turning on the spot (issue #724): standing (under `maxSpeed` m/s) the body shows its heading turned toward the mind's
 * at no more than `rate` rad/s, and a turn of over `from` rad plays the traveller's own turn on the spot (left_turn_45,
 * _90, _180, mirrored for the right) by the share turned, its feet stepping round; moving, in a move or lying, the shown
 * heading catches the mind's within `snap` s.
 */
export const TURN = { rate: 5.5, from: 0.6, maxSpeed: 0.6, snap: 0.06, clips: [[1.15, 'left_turn_45'], [2.2, 'left_turn_90'], [Infinity, 'left_turn_180']], blendIn: 0.1, blendOut: 0.2, minRate: 0.8, maxRate: 3.2 };
/** Distance tiers: past `mid` m the pose is made every 2nd frame, past `far` every 4th (the time between kept). */
export const RIG_LOD = { mid: 22, far: 40 };
/**
 * Feet that stay where they land (issue #749): a foot the clip has on the ground is held where it came down (its
 * ground point, in the world) while the body moves over it, the leg reached to it by two-bone IK; let go as the clip
 * lifts it (eased back to the clip's over `free` s). A planted foot the body has moved too far from (`reach` × the leg,
 * a turn on the spot, a shove) steps: lifted `lift` × the leg and set down under the clip's over `step` s, one foot at a
 * time; both at once if a foot is out past `most` of the leg's reach (a hard shove), each step quicker the faster the
 * body goes (down to `quick` s). Not while it lies, sits, hops or flies, its own move carries it faster than `fast` m/s
 * (a lunge, a dash: a shove still steps), or far off. A foot counts as down from the clip's contact share `on`, or with its
 * ball within `low` × its scale of the ground it stands on (a turn's, a strafe's or a stagger's planted foot the clip's
 * contact curve calls up).
 */
export const FOOT_LOCK = { on: 0.6, low: 0.015, reach: 0.3, most: 0.97, step: 0.17, quick: 0.07, lift: 0.12, free: 0.1, fast: 7 };

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

// ------------------------------------------------------------------ the skeleton

/**
 * A humanoid's joints (in the Animator's shape: { body, torso, head, arms, elbows, hands, legs, knees, feet }, index 0
 * the right side, -x), proportions D:
 *   hip     the hips' height over the ground (m)       hipX   half the hips' width
 *   thigh, shin   the legs' two lengths (the ankle at hip - thigh - shin; the rest is the foot's height)
 *   chest   the shoulders over the hips                shoulder   half the shoulders' width
 *   upper, fore   the arms' two lengths              neck   the head's joint over the shoulders' line
 * Each limb hangs straight down at rest (the Animator aims them along -y), the feet point along +z.
 */
export function humanoidSkeleton(parent, D) {
  const J = (p, x, y, z, name) => { const g = new THREE.Group(); g.position.set(x, y, z); g.name = name; p.add(g); return g; };
  const body = J(parent, 0, 0, 0, 'body');
  const torso = J(body, 0, D.hip, 0, 'torso');
  const head = J(torso, 0, D.chest + D.neck, 0, 'head');
  const legs = [], knees = [], feet = [], arms = [], elbows = [], hands = [];
  for (const s of [-1, 1]) {
    const leg = J(body, s * D.hipX, D.hip, 0, `thigh ${s < 0 ? 'r' : 'l'}`);
    const knee = J(leg, 0, -D.thigh, 0, 'knee');
    const foot = J(knee, 0, -D.shin, 0, 'ankle');
    legs.push(leg); knees.push(knee); feet.push(foot);
    const arm = J(torso, s * D.shoulder, D.chest, 0, `shoulder ${s < 0 ? 'r' : 'l'}`);
    const elbow = J(arm, 0, -D.upper, 0, 'elbow');
    const hand = J(elbow, 0, -D.fore, 0, 'hand');
    arms.push(arm); elbows.push(elbow); hands.push(hand);
  }
  return { body, torso, head, legs, knees, feet, arms, elbows, hands, D };
}

// ------------------------------------------------------------------ what each state plays (pure)

/**
 * The clips of the fight's states and the sites' idles, shared by every humanoid (an archetype may override any: its
 * own `states`). A move: { clip (moves.glb, without 'mixamo_'), from, to (s in it), pingpong (back and forth between them), at (a
 * held frame) }. A loop: { loop: the library's own (idle, look, walk…) }. An attack's may add `lean` (rad about the
 * hips, negative back) laid over the clip as it loads.
 */
export const STATE_CLIPS = {
  idle: { loop: 'idle' },
  // (the sites, src/encounters/idle.js: squatting round the fire, asleep on its back, a lookout looking round)
  // (sitting on the ground: no sitting clip; the kneel's arms poking at the fire, the body set down on its seat and the
  // legs drawn up by hand: seatPose)
  sit: { clip: 'kneeling_inspecting', from: 1.1, to: 3.9, pingpong: true, seat: true },
  // (asleep: the get-up's lying frame, its hands folded on its belly and its chest rising and falling)
  sleep: { clip: 'get_up_back', at: 0.6, pose: 'rest', breathe: true },
  lookout: { loop: 'look' },
  guard: { loop: 'idle' },
  // (struck: the sword-and-shield impact; the poise knock-down: lying on its back, then the get-up)
  stagger: { clip: 'ss_impact_1', from: 0.0, to: 0.7 },
  // (the fall: the impact's stagger back run over `fall.secs`, the body tipped over backwards about its heels by `tip`,
  // then crossfaded into the lying frame)
  down: { clip: 'get_up_back', at: 0.6, rise: { from: 2.65, to: 5.55, secs: 0.9 }, fall: { clip: 'ss_impact_1', from: 0, to: 0.7, secs: 0.3, tip: -1.35 } },
  pickup: { clip: 'kneeling_inspecting', from: 0.3, to: 1.6 },
  // (circling you while it waits its turn: the sword-and-shield strafe, to its right; mirrored to its left)
  strafe: { clip: 'ss_strafe_1' },
};

/**
 * What a foe plays this frame (pure: tests/humanoid-rig.test.js). f: the foe's state ({ state, k, atk, downT, stunned,
 * reel, idle, provoked }); moves: the archetype's attack clips by attack id ({ clip, from, load, cut, to } or
 * { pose: 'bow' } for a procedural one); o: { strafe (−1..1: its sideways share of its speed), t (the foe's clock) }.
 * Returns { loop } (a loop of the library's, locomotion by speed when 'move'), or { clip, t, kind } (a move held at t),
 * plus `pose` (a procedural pose of the arms) and `load` (0..1 how far into its loaded pose: the telegraph's push).
 */
export function stateClip(f, moves = {}, o = {}, states = STATE_CLIPS) {
  const S = states;
  const at = (M, t, kind) => ({ clip: M.clip, t, kind });
  const a = f.atk, M = a ? moves[a.id] : null;
  // the poise knock-down (#722): falling over (its first `fall.secs`, o.downFor: s since it went down), lying, then the
  // get-up over its last `rise.secs`
  if (f.downT > 0) {
    const D = S.down, left = f.downT, F = D.fall;
    if (F && o.downFor != null && o.downFor < F.secs && left > (D.rise?.secs ?? 0)) {
      const u = clamp01(o.downFor / F.secs);
      return { clip: F.clip, t: F.from + (F.to - F.from) * u, kind: 'fall', fall: u, tip: F.tip };
    }
    if (D.rise && left < D.rise.secs) return at(D, D.rise.from + (D.rise.to - D.rise.from) * (1 - left / D.rise.secs), 'down');
    return at(D, D.at, 'down');
  }
  // (bending for its weapon: the mind's recover timer runs down over the pickup)
  if (f.reel === 'pickup' && f.state === 'recover') return at(S.pickup, S.pickup.from + (S.pickup.to - S.pickup.from) * clamp01(1 - (f.timer ?? 0) / (f.def?.disarm?.pickup ?? 1.2)), 'pickup');
  // an attack: the wind-up stretched to the foe's own time, the loaded pose held from HOLD_AT; the strike through the cut
  if (a && M && (f.state === 'wind' || f.state === 'strike' || f.state === 'recover')) {
    if (M.feint && a.feint != null) return feintClip(f, M, a.feint);
    if (M.release != null && M.clip) {
      // (a throw: loaded and held, then thrown in the wind-up's last share as its rock or its mummer flies)
      const k = f.k ?? 0, reach = releaseReach(M);
      const t = f.state === 'wind' ? releaseClipTime(k, M) : M.to;
      const out = { ...at(M, t, f.state === 'wind' ? 'wind' : 'recover'), load: f.state === 'wind' ? clamp01(k / reach) : 1, lean: M.lean ?? 0, ground: !!M.ground, thrown: f.state === 'wind' ? clamp01((k - M.release) / (1 - M.release)) : 1 };
      if (M.pose) Object.assign(out, { pose: M.pose, phase: f.state === 'wind' && k >= M.release ? 'strike' : f.state, k: f.state === 'wind' && k >= M.release ? out.thrown : f.state === 'wind' ? k : 0 });
      return out;
    }
    // (a charge, M.run: its wind-up the clip and the pose; its strike run on the library's locomotion, the pose held: #726)
    if (M.run && f.state === 'strike') return { loop: 'move', pose: M.pose, phase: 'strike', k: f.k ?? 0, load: 1 };
    if (M.pose && M.clip) {
      // (a clip for the body with a procedural pose of the arms over it: the fencer's shield drawn back for its bash)
      const load = f.state === 'wind' ? clamp01((f.k ?? 0) / HOLD_AT) : 1;
      const t = f.state === 'wind' ? windClipTime(f.k ?? 0, M) : f.state === 'strike' ? strikeClipTime(f.k ?? 0, M, a.contact ?? 0.5) : M.to;
      return { ...at(M, t, f.state), pose: M.pose, phase: f.state, k: f.k ?? 0, load, lean: M.lean ?? 0, ground: !!M.ground };
    }
    if (M.pose) return { loop: 'idle', pose: M.pose, phase: f.state, k: f.k ?? 0, load: f.state === 'wind' ? clamp01((f.k ?? 0) / HOLD_AT) : 1 };
    const g = M.ground ? { ground: true } : null;
    if (f.state === 'wind') return { ...at(M, windClipTime(f.k ?? 0, M), 'wind'), load: clamp01((f.k ?? 0) / HOLD_AT), lean: M.lean ?? 0, ...g };
    if (f.state === 'strike') return { ...at(M, strikeClipTime(f.k ?? 0, M, a.contact ?? 0.5), 'strike'), lean: M.lean ?? 0, ...g };
    return { ...at(M, M.to, 'recover'), ...g };
  }
  if (f.stunned > 0 && f.state !== 'chase') return at(S.stagger, S.stagger.from + (S.stagger.to - S.stagger.from) * clamp01(1 - f.stunned / 0.6), 'stagger');
  // calm at its site (src/encounters/idle.js): squatting by the fire, asleep, looking out
  const mode = f.idle?.mode;
  if (!f.provoked && f.state === 'idle' && mode && S[mode]) {
    const I = S[mode];
    if (!I.clip) return { loop: I.loop };
    const extra = { ...(I.seat ? { seat: true } : null), ...(I.pose ? { pose: I.pose } : null), ...(I.breathe ? { breathe: true } : null) };
    if (I.at != null) return { ...at(I, I.at, mode), ...extra };
    return { ...at(I, pingpong(o.t ?? 0, I.from, I.to), mode), ...extra };
  }
  // (o.strafe > 0: going to its left, +x; ss_strafe_1 steps to the right, so its mirror. It was the other way round, and
  // a circling foe's feet stepped against its slide, issue #749)
  if (Math.abs(o.strafe ?? 0) > 0.6 && S.strafe) return { clip: S.strafe.clip + (o.strafe > 0 ? '_m' : ''), t: o.strafeT ?? 0, kind: 'strafe' };
  return { loop: 'move' };
}

/**
 * A feint (the shade's, attack.feint: the share of the wind-up its cut stops at): the cut's clip begun, its anticipation
 * run only to `half` (the cut stopped halfway: never loaded) over the first 80 % of the feint's share and held there a
 * beat; then the body goes over to the move it really makes (M.feint: { clip, at (a held frame), pose }: the shade's sword
 * dropped to its hip, sunk in the sword-and-shield guard's crouch), loaded by 75 % of the wind-up, and its strike (the
 * thrust: the pose's own strike) and recovery on it. Pure (tests/duelists.test.js).
 */
export function feintClip(f, M, A) {
  const k = f.k ?? 0, T = M.feint;
  if (f.state === 'wind' && k < A + 0.05) {
    const u = clamp01(k / (A * 0.8)), e = 1 - (1 - u) * (1 - u);
    return { clip: M.clip, t: M.from + (M.half - M.from) * e, kind: 'wind', load: 0.5 * u, feint: 'cut' };
  }
  const load = f.state === 'wind' ? smooth((k - A - 0.05) / Math.max(0.05, HOLD_AT - A - 0.05)) : 1;
  return { clip: T.clip, t: T.at, kind: f.state, pose: T.pose, phase: f.state, k, load, feint: 'thrust' };
}

/** A time running back and forth between a and b (s: the loop's clock). */
export function pingpong(t, a, b) {
  const L = b - a;
  if (!(L > 0)) return a;
  const u = ((t % (2 * L)) + 2 * L) % (2 * L);
  return a + (u < L ? u : 2 * L - u);
}

/**
 * The clip's time through a wind-up (k: 0..1 of the foe's own wind-up): the clip's anticipation, from `from` to its
 * loaded pose `load`, stretched over the first HOLD_AT of the wind-up (eased out: it settles into it), then held.
 */
export function windClipTime(k, M) {
  const u = clamp01(k / HOLD_AT), e = 1 - (1 - u) * (1 - u);
  return M.from + (M.load - M.from) * e;
}
/** The share of the wind-up a thrown move (M.release) is loaded by: HOLD_AT, or earlier to hold it `RELEASE.hold` before it lets go. */
export function releaseReach(M) { return Math.max(0.2, Math.min(HOLD_AT, M.release - RELEASE.hold)); }
/**
 * The clip's time through a thrown move's wind-up (k 0..1): its anticipation to the loaded pose by releaseReach and held,
 * then from `release` the throw: load → cut over RELEASE.cut of what is left of the wind-up, the follow-through to `to`.
 */
export function releaseClipTime(k, M) {
  const r = M.release;
  if (k < r) return windClipTime(Math.min(1, k / releaseReach(M)) * HOLD_AT, M);
  const u = clamp01((k - r) / Math.max(1e-3, 1 - r)), c = RELEASE.cut;
  return u < c ? M.load + (M.cut - M.load) * smooth(u / c) : M.cut + (M.to - M.cut) * clamp01((u - c) / (1 - c));
}
/** The clip's time through a strike (k 0..1): the loaded pose to the cut at the attack's contact share, then the follow-through to `to`. */
export function strikeClipTime(k, M, contact = 0.5) {
  const c = Math.min(0.95, Math.max(0.05, contact));
  return k < c ? M.load + (M.cut - M.load) * (k / c) : M.cut + (M.to - M.cut) * clamp01((k - c) / (1 - c));
}

// ------------------------------------------------------------------ procedural arm poses (moves no clip has)

/**
 * Arms aimed by hand where no clip has the move: for each side (r, l), the upper arm's and the forearm's directions in
 * the torso's frame (x the foe's left, y up, z ahead), at the loaded pose. Blended over the clip's arms by the move's
 * weight, from the loop's arms toward the loaded pose as the wind-up goes, and back through the strike. `lean` (rad about
 * the hips' x, negative back) and `turn` (rad about the chest's y, positive: its left shoulder drawn back) lay a turn of
 * the chest under the arms; `strike` may give its own arms and `turn`.
 */
export const PROC_POSES = {
  // (the mummer's volley, #724) side-on to you, its left shoulder at you (the chest turned 0.75 rad to its right): the bow
  // arm straight out at you, the cord hand drawn back past its pot, the elbow high; loosed, the hand flies back open
  bow: { turn: -0.75, l: [[0.66, 0.16, 0.74], [0.68, 0.12, 0.72]], r: [[-0.62, 0.32, -0.72], [0.72, 0.18, 0.66]], strike: { turn: -0.7, r: [[-0.75, 0.15, -0.65], [-0.55, -0.35, -0.75]] } },
  // a rock dug up and held high over the mask in both hands, leaning back
  lob: { l: [[0.25, 1, -0.15], [-0.4, 0.8, -0.2]], r: [[-0.25, 1, -0.15], [0.4, 0.8, -0.2]], lean: -0.25, strike: { l: [[0.2, 0.3, 1], [0.1, 0, 1]], r: [[-0.2, 0.3, 1], [-0.1, 0, 1]] } },
  // a horn raised to the mask in both hands, its bell up
  horn: { l: [[0.4, 0.2, 0.7], [-0.6, 0.7, 0.2]], r: [[-0.4, 0.2, 0.7], [0.6, 0.7, 0.2]], lean: -0.2 },
  // a small one held high over its crown in both hands (the mummer king's throw), bent back
  throw: { l: [[0.3, 1, -0.1], [0.05, 1, 0.1]], r: [[-0.3, 1, -0.1], [-0.05, 1, 0.1]], lean: -0.3, strike: { l: [[0.2, 0.2, 1], [0.1, -0.2, 1]], r: [[-0.2, 0.2, 1], [-0.1, -0.2, 1]] } },
  // the alert: one arm up pointing at you, the other at its side
  point: { r: [[-0.2, 0.6, 0.8], [0, 0.5, 1]], l: [[0.2, -1, 0.1], [0.1, -1, 0.3]] },
  // (the shade's feint, #724) the sword dropped to its hip, drawn back low, the empty sleeve back; then the thrust, low
  // and straight, the arm out at you
  thrust: { r: [[-0.2, -0.9, -0.35], [0.05, -0.6, 0.8]], l: [[0.25, -0.9, -0.35], [0.15, -0.9, 0.3]], strike: { r: [[-0.05, -0.05, 1], [0, -0.05, 1]] } },
  // (the fencer's, #724) its shield shoulder drawn right back, the chest turned away with it and the shield cocked behind
  // its hip, then punched out before it as the chest turns back through
  bash: { turn: 0.9, l: [[0.35, -0.45, -0.82], [0.25, 0.35, -0.9]], strike: { turn: -0.3, l: [[0.15, -0.05, 1], [0.0, 0.1, 1]] } },
  // its shield lowered before its hip while its sword goes up in both the clip's hands (the overhead)
  shieldDown: { l: [[0.3, -0.95, 0.3], [0.05, -0.55, 0.85]] },
  // its shield held square before it (the sweep's other hand)
  shieldUp: { l: [[0.35, -0.3, 0.9], [-0.5, 0.5, 0.7]] },
  // (the shade's guard, #661) its sword arm across its body, the blade up to its left; the empty sleeve's cuff against it
  // at its chest, under the hood (#724: it covered the hood)
  swordGuard: { r: [[-0.2, -0.55, 0.8], [0.85, 0.4, 0.35]], l: [[0.35, -0.7, 0.62], [-0.6, -0.05, 0.8]] },
  // (the fencer's guard, #724) its sword drawn back over its right shoulder, the fist by its ear, the point at you over the
  // shield (the shield arm is the sword-and-shield block's)
  swordBack: { r: [[-0.55, -0.35, -0.55], [0.15, 0.95, 0.25]] },
  // (asleep on its back) its hands folded on its belly
  rest: { r: [[-0.3, -0.85, 0.4], [0.8, -0.15, 0.55]], l: [[0.3, -0.85, 0.4], [-0.8, -0.15, 0.55]] },
  // its guard broken: both arms flung wide, the shield out to its side
  flung: { r: [[-0.95, 0.15, 0.1], [-0.9, 0.45, 0.2]], l: [[0.95, 0.15, 0.1], [0.9, 0.45, 0.2]] },
  // (the hulk's stomp, #726) its long arms flung up and out for balance as a foot comes up (the leg: its model's own
  // style); brought down hard as it stamps
  // (the grunt's club overhead, #726: the sheet's attack pose) both arms straight up over its head, the club behind it,
  // leaning back; then down before it
  // (#744: the fists brought together over its head, both on the haft)
  overhead: { lean: -0.12, r: [[-0.02, 1, -0.12], [0.3, 1, -0.35]], l: [[0.02, 1, -0.12], [-0.3, 1, -0.35]], strike: { r: [[-0.15, 0.1, 1], [-0.05, -0.4, 1]], l: [[0.15, 0.1, 1], [0.05, -0.4, 1]] } },
  stomp: { lean: -0.1, r: [[-0.75, 0.55, 0.3], [-0.35, 0.9, 0.25]], l: [[0.75, 0.55, 0.3], [0.35, 0.9, 0.25]], strike: { r: [[-0.55, -0.7, 0.45], [-0.2, -0.85, 0.5]], l: [[0.55, -0.7, 0.45], [0.2, -0.85, 0.5]] } },
  // (the prowler's spit, #726) its arms braced low and out, the head reared back (its model's own style), leaning back
  spit: { lean: -0.18, r: [[-0.45, -0.8, 0.35], [-0.15, -0.55, 0.8]], l: [[0.45, -0.8, 0.35], [0.15, -0.55, 0.8]] },
  // (the warlord's roar, #726) its arms flung wide and up, its chest thrown out
  roar: { lean: -0.22, r: [[-0.92, 0.32, 0.18], [-0.75, 0.62, 0.2]], l: [[0.92, 0.32, 0.18], [0.75, 0.62, 0.2]] },
  // (the warlord's charge, #726) the glaive levelled like a lance: its right fist back by its hip, its left forward along
  // the shaft, leaning in, its head down (its style); held through the run
  lance: { lean: 0.22, r: [[-0.35, -0.82, -0.45], [-0.05, -0.15, 1]], l: [[0.25, -0.55, 0.8], [-0.1, -0.2, 1]] },
  // (the warlord's sweep, #726: the sheet's attack pose) the glaive drawn up and back over its right shoulder in both
  // fists, its chest turned away; then swung across before it
  glaiveHigh: { turn: 0.55, r: [[-0.5, 0.45, -0.2], [0.15, 0.95, -0.1]], l: [[0.2, 0.2, 0.75], [-0.55, 0.75, 0.25]],
    strike: { turn: -0.45, r: [[-0.15, -0.1, 1], [0.6, -0.1, 0.8]], l: [[0.35, -0.2, 0.9], [0.85, -0.1, 0.5]] } },
  // (the warlord's last stand, #726) braced wide, both fists back round to its right with the glaive behind it; swung
  // out at its full reach as it whirls
  whirl: { turn: 0.7, r: [[-0.75, -0.35, -0.55], [-0.45, 0.05, -0.9]], l: [[0.05, -0.45, 0.9], [-0.85, 0.05, -0.5]],
    strike: { turn: 0, r: [[-0.95, -0.05, 0.3], [-0.85, 0.05, 0.55]], l: [[-0.05, -0.2, 1], [-0.85, 0.05, 0.55]] } },
  // hands clutching its face (the mask knocked off)
  clutch: { l: [[0.3, 0.1, 0.6], [-0.5, 0.8, 0.3]], r: [[-0.3, 0.1, 0.6], [0.5, 0.8, 0.3]] },
};

// ------------------------------------------------------------------ the driver

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _h = new THREE.Vector3(), _k = new THREE.Vector3();
const _m4q = new THREE.Quaternion(), _fe = new THREE.Euler();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
let seed = 0;
/** The next driver's clip phase (each driver starts its clips `seed` steps along): for a test that must not depend on how many came before (as the rigs' nextRigSeed). */
export function nextDriverSeed(n) { seed = n; }

/**
 * One foe's clips on its skeleton. J: humanoidSkeleton's joints; rig: the group the skeleton hangs in (the Animator's
 * root: its +z the foe's forward); moves: its attack clips (stateClip); states: its own STATE_CLIPS over the shared;
 * speeds: { walk, jog, sprint } m/s (its own: the stride follows its legs, the speeds its kind's); style(J, want): its own
 * touches over the clip's pose each time it is made (a bow-legged stance).
 */
export class HumanoidDriver {
  constructor(J, rig, { moves = {}, states = {}, speeds = { walk: 0.9, jog: 2.4, sprint: 4.5 }, style = null, seat = null } = {}) {
    // (seat: the hips' height over the ground sitting on it, m: its sack or its barrel on the sand)
    Object.assign(this, { J, rig, moves, states: { ...STATE_CLIPS, ...states }, speeds, style, seat: seat ?? J.D.hip * 0.3 });
    this.shownH = null; this.turn = null; this.downFor = null; this.seatW = 0;
    this.A = null; this.lib = null;
    this.prev = null; this.speed = 0; this.side = 0; this.walked = 0; this.strafeT = 0; this.vNow = 0; this.t = (seed++ * 0.731) % 7;
    this.moveW = 0; this.last = null; this.procW = 0; this.proc = null;
    this.frame = seed; this.acc = 0;
    this.cost = 0;   // (ms this foe's pose took last time it was made: the measure, scripts/enemy-roster/rig-cost.mjs)
  }

  /** The Animator, once the clips are in (made the first frame they are). */
  animator() {
    const lib = LIB.lib;
    if (!lib) return null;
    if (this.lib !== lib) {
      this.lib = lib;
      this.A = new Animator(lib, this.J);
      this.A.offsetLoops(this.t % 1);
      const legs = this.J.D.thigh + this.J.D.shin;
      if (this.A.gait) this.A.legRatio = legs / this.A.gait.legLength;
      this.legScale = this.J.D.hip / (this.A.restHips.y || 0.95);
    }
    return this.A;
  }

  /**
   * The pose this frame. f: the foe; c: Foes.animKit's kit ({ dt, ground, eye }). o: { pose (a procedural arm pose to
   * hold over everything: 'clutch'), poseW (its weight, 0..1: 1 if not given), upper ({ clip, w }: a move above the legs
   * over everything the clips play, its own loop: the fencer's guard, ss_block_idle) }. Returns what stateClip chose.
   */
  update(f, c, o = {}) {
    const dt = Math.max(0, c.dt ?? 0), p = f.pos;
    // its own speed and sideways share (the foe's velocity isn't kept: the step it took)
    if (!this.prev) this.prev = p.clone();
    if (dt > 0) {
      const dx = p.x - this.prev.x, dz = p.z - this.prev.z, d = Math.hypot(dx, dz);
      if (d < 3) {
        const v = d / dt, side = d > 1e-5 ? (dx * Math.cos(f.heading) - dz * Math.sin(f.heading)) / d : 0;
        this.speed += (v - this.speed) * (1 - Math.exp(-12 * dt));
        this.side += (side * Math.min(1, v / 0.6) - this.side) * (1 - Math.exp(-8 * dt));
        this.walked += d;
        this.vNow = v;
        // (the strafe's clip time: run at the rate that carries its planted foot across at the body's own sideways speed,
        // so it stays put; it was 0.9 s a metre walked, clamped at the clip's end: a foe circling you long after its
        // first metre skated on a held frame, issue #749)
        this.strafeT += (d * Math.abs(side)) / Math.max(0.2, this.strafeRate());
      } else this.vNow = 0;
      this.prev.copy(p);
    }
    this.t += dt;
    // far off: every 2nd or 4th frame (the time between carried)
    const dist = c.eye ? Math.hypot(c.eye.x - p.x, c.eye.z - p.z) : 0, every = dist > RIG_LOD.far ? 4 : dist > RIG_LOD.mid ? 2 : 1;
    this.acc += dt;
    if (every > 1) this.locks = null;   // (far off: no feet held)
    if (every > 1 && ++this.frame % every && this.drawnOnce) return this.chosen;
    const step = this.acc; this.acc = 0;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    // (how long it has been going down: its fall first)
    this.downFor = f.downT > 0 ? (this.downFor == null ? 0 : this.downFor + step) : null;
    const want = stateClip(f, this.moves, { strafe: this.side, strafeT: this.strafeT % this.strafeDur(), t: this.t, downFor: this.downFor }, this.states);
    this.chosen = want;
    const A = this.animator();
    this.turnInPlace(f, want, step, A);
    if (A) this.clipPose(A, f, want, step, o);
    else fallbackPose(this.J, f, want, this.walked, this.t);
    this.crossfade(want, step);
    this.style?.(this.J, want);   // (the body's own stance over the clip's: a bow-legged mummer)
    this.seatPose(want, step);
    this.procPose(want, o, step);
    this.plant(f);
    this.lockFeet(f, want, step);
    this.drawnOnce = true;
    if (t0) this.cost = performance.now() - t0;
    return want;
  }

  clipPose(A, f, want, dt, o) {
    const S = this.speeds;
    const move = want.clip ? want : null;
    // a move's weight: in over BLEND.in, out over BLEND.out (held to the last move's pose as it fades)
    // (no time passing, a still frame: the move whole, or none)
    if (move) { this.last = move; this.moveW = dt === 0 ? 1 : Math.min(1, this.moveW + dt / BLEND.in); }
    else this.moveW = dt === 0 ? 0 : Math.max(0, this.moveW - dt / BLEND.out);
    const M = move ?? this.last;
    // (a move's clip, once the captured moves are in: one asked for before they were is asked for again, not remembered
    // missing: Animator.moveClip keeps what it found by name)
    if (M && this.moveW > 0.001 && !A.moveClip(M.clip)) this.lib._moveBy?.delete(M.clip);
    else if (M && this.moveW > 0.001) {
      const full = M.kind === 'down' || M.kind === 'fall' || M.kind === 'sleep' || M.kind === 'sit' || M.kind === 'pickup';
      // (an attack's own hop and lean are its; a strafe keeps the gait's feet: it walks sideways)
      A.play(M.clip, M.t, smooth(this.moveW), { full, head: true, walks: M.kind === 'strafe', ground: !!M.ground });
    }
    // turning on the spot: the traveller's own turn, its feet stepping round (none while a move plays)
    const T = this.turn;
    if (T && T.w > 0.001 && this.moveW < 0.5) A.play(T.clip, T.t, smooth(T.w) * (1 - this.moveW), { full: false, head: true });
    // a move above the legs over it all (the fencer's shield up: the sword-and-shield guard), its own clock
    const U = o.upper;
    if (U && U.w > 0.001) A.playUpper(U.clip, (this.t * (U.rate ?? 1)) % (A.moveClip(U.clip)?.duration || 1), Math.min(1, U.w));
    const loop = want.loop === 'look' ? 'look' : null;
    A.calm = !!loop;
    A.update(dt, {
      speed: move && move.kind !== 'strafe' ? 0 : this.speed, onGround: true, mode: 'ground',
      walkAt: S.walk, jogAt: S.jog, sprintAt: S.sprint, strideScale: 1, trueStride: true,
    });
    // the look round: the library's own loop (Animator plays it only after standing a while; here, at once)
    if (loop && A.actions.look) {
      A.actions.look.time = this.t % A.clips.look.duration;
      for (const [k, a] of Object.entries(A.actions)) a.setEffectiveWeight(k === 'look' ? 1 - A.moveW : 0);
      A.mixer.update(0); A.src.updateMatrixWorld(true);
    }
    A.apply(this.rig, { legScale: this.legScale });
    const J = this.J, B = J.body.position;
    // (the hips' sway and drift to this body's size; a move that lies down turns about these hips, not the traveller's)
    B.x *= this.legScale; B.z *= this.legScale;
    if (A.fullW > 0) {
      _a.set(0, J.D.hip - 0.97, 0); _b.copy(_a).applyQuaternion(J.body.quaternion);
      B.addScaledVector(_a.sub(_b), A.fullW);
    }
    // a move's own lean over the clip's (M.lean, rad: back on its heels for the mummer's whack), into the strike and out
    if (want.lean) J.torso.rotateX(want.lean * (want.kind === 'wind' ? smooth(want.load) : 1 - smooth((f.k ?? 0) * 2.5)) * this.moveW);
    // the telegraph's push: held in its loaded pose, it leans further into it as the wind-up runs out
    if (want.kind === 'wind' && want.load >= 1 && !(want.thrown > 0)) J.torso.rotateX(-0.12 * smooth(((f.k ?? 0) - HOLD_AT) / (1 - HOLD_AT)));
    // the fall: the stagger back tipped over about its heels, onto its back
    if (want.kind === 'fall') {
      const k = smooth(want.fall), back = -0.12 * J.D.hip;
      _a.set(0, 0, back); _q.setFromAxisAngle(_x.set(1, 0, 0), want.tip * k * k);
      B.sub(_a).applyQuaternion(_q).add(_a);
      J.body.quaternion.premultiply(_q);
      B.y = Math.max(B.y, -J.D.hip * 0.8);
    }
    // asleep: its chest rising and falling, slow
    if (want.breathe) { const b = Math.sin(this.t * 1.7); J.torso.rotateX(0.05 * b); J.head.rotateX(-0.04 * b); }
  }

  /** The joints of one move eased over from the last pose of another (XFADE), the clip's pose kept to start the next. */
  crossfade(want, dt) {
    const J = this.J, js = this._joints ??= [J.body, J.torso, J.head, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
    const clip = want.clip ?? null;
    if (clip && this.shownClip && clip !== this.shownClip && this.moveW > 0.5 && this.shown) {
      this.xf = { q: this.shown.q.map((q) => q.clone()), p: this.shown.p.clone(), t: 0, secs: want.kind === 'down' && this.shownKind !== 'fall' ? XFADE.fall : XFADE.secs };
    }
    this.shownClip = clip ?? (this.moveW > 0.001 ? this.shownClip : null);
    this.shownKind = want.kind ?? null;
    if (this.xf) {
      const X = this.xf; X.t += dt;
      const k = smooth(X.t / X.secs);
      js.forEach((j, i) => j.quaternion.copy(_q.copy(X.q[i]).slerp(j.quaternion, k)));
      J.body.position.lerpVectors(X.p, J.body.position, k);
      if (k >= 1) this.xf = null;
    }
    const S = this.shown ??= { q: js.map(() => new THREE.Quaternion()), p: new THREE.Vector3() };
    js.forEach((j, i) => S.q[i].copy(j.quaternion)); S.p.copy(J.body.position);
  }

  /**
   * Turning on the spot (TURN): the body's shown heading (the rig turned about its feet against the mind's heading) eased
   * toward the mind's, and a standing turn of over TURN.from rad played as the traveller's turn on the spot by the share of
   * it turned (moveShape: the clip's own turn, its yaw kept out of the hips), its weight in and out.
   */
  turnInPlace(f, want, dt, A) {
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    if (this.shownH == null || !Number.isFinite(this.shownH)) this.shownH = f.heading;
    const gap = wrap(f.heading - this.shownH);
    const standing = this.speed < TURN.maxSpeed && !want.clip && want.loop !== 'look' && !(f.downT > 0) && !f.carriedBy && !(f.alt > 0.05);
    if (!standing || dt === 0) this.shownH += gap * (dt === 0 ? 1 : 1 - Math.exp(-dt / TURN.snap));
    else this.shownH += Math.sign(gap) * Math.min(Math.abs(gap), TURN.rate * dt, Math.abs(gap) * (1 - Math.exp(-dt / 0.12)) + 0.6 * dt);
    this.shownH = f.heading - wrap(f.heading - this.shownH);
    this.rig.rotation.y = wrap(this.shownH - f.heading);
    // the turn's clip
    let T = this.turn;
    if (A && standing && Math.abs(gap) > TURN.from && (!T || T.out)) {
      const name = TURN.clips.find(([lim]) => Math.abs(gap) < lim)[1] + (gap < 0 ? '_m' : '');
      const clip = A.moveClip(name), shape = clip && moveShape(clip);
      if (shape) T = this.turn = { clip: name, shape, t: 0, w: T?.w ?? 0, angle: gap, start: this.shownH, out: false };
    }
    if (!T) return;
    if (!standing) T.out = true;
    const sh = T.shape, k = Math.abs(T.angle) > 1e-3 ? clamp01(wrap(this.shownH - T.start) / T.angle) : 1;
    let at = sh.n - 1;
    for (let i = 0; i < sh.n; i++) if (sh.share[i] >= k) { at = i; break; }
    T.t = Math.min(sh.end, Math.max(T.t + dt * TURN.minRate, Math.min(at / sh.fps, T.t + dt * TURN.maxRate)));
    if (k >= 1 && T.t >= Math.min(sh.end, sh.off + 0.3)) T.out = true;
    T.w = T.out ? Math.max(0, T.w - dt / TURN.blendOut) : Math.min(1, T.w + dt / TURN.blendIn);
    if (T.out && T.w <= 0) this.turn = null;
  }

  /**
   * Sitting on the ground (a move's `seat`: the camp round its fire): the body set down until its hips are `seat` m over
   * the ground, kept upright, each leg drawn up by two-bone IK to a foot flat on the ground before it, the knees up and
   * out; the arms stay the clip's (poking at the fire). Eased in and out with the move.
   */
  seatPose(want, dt) {
    this.seatW += ((want.seat ? 1 : 0) - this.seatW) * (dt === 0 ? 1 : 1 - Math.exp(-10 * dt));
    const w = smooth(this.seatW);
    if (w < 0.01) return;
    const J = this.J, D = J.D, g = this.rig, L = D.thigh + D.shin, ankle = D.hip - L;
    J.body.position.y += (this.seat - D.hip - J.body.position.y) * w;
    J.body.position.x *= 1 - w; J.body.position.z *= 1 - w;
    J.body.quaternion.slerp(_q.identity(), 0.75 * w);
    J.body.updateMatrixWorld(true);
    g.updateWorldMatrix(true, false);
    g.getWorldQuaternion(_q2);
    const s = g.getWorldScale(_b).y || 1;
    J.legs.forEach((leg, i) => {
      const side = i ? 1 : -1, knee = J.knees[i], foot = J.feet[i];
      leg.updateWorldMatrix(true, false);
      leg.getWorldPosition(_h);
      // (the foot flat before it, a little out; the knee up, forward and out)
      const want_ = g.localToWorld(_a.set(side * (D.hipX + 0.18 * L), ankle, 0.62 * L));
      _c.set(side * 0.55, 1, 0.5).applyQuaternion(_q2);
      twoBone(_h, want_, D.thigh * s, D.shin * s, _c, _k);
      const kneeW = _k.clone(), ankleW = want_.clone();
      // (blended from the clip's: aim along the lerp of the clip's knee and the seated one)
      knee.getWorldPosition(_y); _y.lerp(kneeW, w);
      aimWorld(leg, _y.sub(_h)); leg.updateMatrixWorld(true);
      knee.getWorldPosition(_h); foot.getWorldPosition(_z); _z.lerp(ankleW, w);
      aimWorld(knee, _z.sub(_h)); knee.updateMatrixWorld(true);
      // (the foot flat on the ground, toes out a little)
      _q.setFromAxisAngle(UP, side * 0.25).premultiply(_q2);
      foot.parent.getWorldQuaternion(_m4q).invert();
      foot.quaternion.slerp(_m4q.multiply(_q), w); foot.updateMatrixWorld(true);
    });
  }

  /** The procedural arms (PROC_POSES) over the clip's: a move's own (want.pose) or one asked for (o.pose). */
  procPose(want, o, dt) {
    const name = o.pose ?? want.pose ?? null;
    const P = name ? PROC_POSES[name] : null;
    const target = P ? (o.pose ? o.poseW ?? 1 : want.phase === 'wind' ? smooth(want.load) : want.phase === 'strike' ? 1 : 1 - clamp01(want.k ?? 0)) : 0;
    if (P) { this.proc = P; this.procName = name; }
    this.procW += (target - this.procW) * (dt === 0 ? 1 : 1 - Math.exp(-14 * dt));
    if (!this.proc || this.procW < 0.01) return;
    const Q = this.proc, J = this.J, strike = want.phase === 'strike' && Q.strike ? smooth((want.k ?? 0) * 2) : 0;
    if (Q.lean) J.torso.rotateX(Q.lean * this.procW);
    const turn = (Q.turn ?? 0) + ((Q.strike?.turn ?? Q.turn ?? 0) - (Q.turn ?? 0)) * strike;
    if (turn) { J.torso.rotateY(turn * this.procW); J.torso.updateMatrixWorld(true); }
    ['r', 'l'].forEach((s, i) => {
      const base = Q[s];
      if (!base) return;
      const dirs = Q.strike?.[s] && strike > 0 ? base.map((d, j) => d.map((x, n) => x + (Q.strike[s][j][n] - x) * strike)) : base;
      aimLimb(J.arms[i], J.torso, dirs[0], this.procW);
      aimLimb(J.elbows[i], J.torso, dirs[1], this.procW);
    });
  }

  /** The strafe clip's length (s) and its foot's sideways speed on this body (m/s at rate 1: the library's × legRatio). */
  strafeDur() { const c = this.A?.moveClip(this.states.strafe?.clip); return c?.duration || 1.1; }
  strafeRate() {
    const A = this.A, c = A?.moveClip(this.states.strafe?.clip);
    if (!c) return 1 / 0.9;
    return sideSpeedOf(this.lib, c) * (A.legRatio || 1);
  }

  /** The feet held where they came down (FOOT_LOCK, issue #749): after the pose, the slope and the clip's contacts. */
  lockFeet(f, want, dt) {
    const A = this.A, J = this.J, K = FOOT_LOCK;
    const lying = want.kind === 'down' || want.kind === 'fall' || want.kind === 'sleep' || want.kind === 'sit' || this.seatW > 0.2;
    const shoved = (f.vel?.lengthSq?.() ?? 0) > 1;
    if (!A || dt <= 0 || lying || f.dying || f.hop || f.hopBack || f.air || f.flight || f.yank || f.carriedBy || f.riding || (f.alt ?? 0) > 0.05 || want.ground || (this.vNow > K.fast && !shoved)) {
      this.locks = null; return;
    }
    const g = this.rig;
    g.updateWorldMatrix(true, true);
    const s = g.getWorldScale(_b).y || 1, L = (J.D.thigh + J.D.shin) * s;
    const locks = this.locks ??= [{}, {}];
    const stepping = locks.some((k) => k.step);
    const stepT = Math.max(K.quick, Math.min(K.step, (0.5 * K.reach * L) / Math.max(0.05, this.vNow)));
    const root = g.getWorldPosition(_h).clone(), S0 = f.slope;
    const groundY = (p) => root.y + (S0 ? S0.sx * (p.x - root.x) + S0.sz * (p.z - root.z) : 0);
    J.legs.forEach((leg, i) => {
      const S = locks[i], foot = J.feet[i], c = A.contact[i ? 'l' : 'r'] ?? 1;
      // (the ball of the foot is what is held: the ankle rolls over it from heel-off to toe-off)
      const ball = (this.balls ??= J.feet.map((ft) => footBall(ft) ?? new THREE.Vector3(0, -(J.D.hip - J.D.thigh - J.D.shin), 0)))[i];
      const ankle = foot.getWorldPosition(_a).clone(), posed = foot.localToWorld(_x.copy(ball)).clone();
      const down = c >= K.on || posed.y - groundY(posed) < K.low * s;
      if (S.step) S.step.t += dt;
      if (down) {
        if (S.step) { if (S.step.t >= S.step.T) { S.step = null; S.at = posed.clone(); } }
        else if (!S.at) { S.at = S.free && S.free.t < K.free ? S.free.from.clone() : posed.clone(); S.free = null; }
        else {
          const off = Math.hypot(posed.x - S.at.x, posed.z - S.at.z);
          leg.getWorldPosition(_k);
          // (out past the leg's reach, and further than the clip's own leg is stretched: it can't hold on)
          const far = _k.distanceTo(_z.set(S.at.x, posed.y, S.at.z).add(_y.subVectors(ankle, posed))) > Math.max(K.most * L, _k.distanceTo(ankle) + 0.06 * L);
          if ((off > K.reach * L && !stepping && !locks[1 - i].step) || far) { S.step = { from: S.at.clone(), t: 0, T: stepT }; S.at = null; }
        }
      } else {
        if (S.at) S.free = { from: S.at.clone(), t: 0 };
        S.at = null;
        if (S.step && S.step.t >= S.step.T) S.step = null;
        if (S.free) { S.free.t += dt; if (S.free.t >= K.free) S.free = null; }
      }
      // where the ball goes: held (its height the clip's, on its slope), stepping (an arc to the clip's), let go (eased)
      let target = null;
      // (a body whose drawn sole sits lower under its ankle than the clip's, J.ballOnGround: #800's Tripo bipeds, the
      //  ball held on the ground, never under it as the clip's height would put it)
      if (S.at) target = _c.set(S.at.x, posed.y, S.at.z);
      else if (S.step) {
        const u = smooth(S.step.t / S.step.T);
        target = _c.lerpVectors(S.step.from, posed, u); target.y = posed.y + K.lift * L * Math.sin(Math.PI * Math.min(1, S.step.t / S.step.T));
      } else if (S.free) { target = _c.lerpVectors(S.free.from, posed, smooth(S.free.t / K.free)); target.y = posed.y; }
      else if (J.ballOnGround && posed.y < groundY(posed)) target = _c.copy(posed);
      if (target && J.ballOnGround) target.y = Math.max(target.y, groundY(target));
      const ballAt = target && J.flatFeet && S.at ? target.clone() : null;
      if (target) target.add(_y.subVectors(ankle, posed));   // (the ankle where it must be for the ball to be there, the foot turned as the clip has it)
      if (!target || target.distanceToSquared(ankle) < 1e-8) return;
      const knee = J.knees[i];
      const footQ = foot.getWorldQuaternion(_q2).clone();
      // (a broad flat foot held flat on the ground while it is planted, J.flatFeet of the way: the clip's roll and pitch of
      //  the traveller's narrow foot dug a Tripo biped's wide pad's edge 3-6 cm into the ground, #800)
      //  (the ankle moved for the flattened foot, so its ball stays where it is held: turned about the ball, not the ankle)
      if (ballAt) {
        _fe.setFromQuaternion(footQ, 'YXZ'); footQ.slerp(_q.setFromEuler(_fe.set(0, _fe.y, 0, 'YXZ')), J.flatFeet);
        target.copy(ballAt).sub(_y.copy(ball).multiply(foot.getWorldScale(_x)).applyQuaternion(footQ));
      }
      leg.getWorldPosition(_h); knee.getWorldPosition(_k);
      // (the knee bends the way the clip had it: the pole from the hip-ankle line out to the clip's knee)
      _y.lerpVectors(_h, ankle, 0.5); _z.subVectors(_k, _y);
      if (_z.lengthSq() < 1e-8) { J.body.getWorldQuaternion(_q); _z.set(0, 0, 1).applyQuaternion(_q); }
      const goal = target.clone();
      twoBone(_h, goal, J.D.thigh * s, J.D.shin * s, _z, _k);
      aimWorld(leg, _x.subVectors(_k, _h)); leg.updateMatrixWorld(true);
      knee.getWorldPosition(_h);
      aimWorld(knee, _x.subVectors(goal, _h)); knee.updateMatrixWorld(true);
      foot.parent.getWorldQuaternion(_q).invert();
      foot.quaternion.copy(_q.multiply(footQ)); foot.updateMatrixWorld(true);
    });
  }

  /**
   * The feet reach the ground on a slope: each foot's ground from the plane the foe stands on (f.slope, read from its
   * five ground rays: src/enemies/slope.js; no ray of its own), against the root's; the body lowered to the lower foot,
   * each leg's ankle reached up to its own ground by two-bone IK, the foot kept flat as the clip left it.
   */
  plant(f) {
    const S = f.slope, J = this.J, g = this.rig;
    if (!S || (Math.abs(S.sx) < 1e-3 && Math.abs(S.sz) < 1e-3) || this.chosen?.kind === 'down' || this.chosen?.kind === 'fall' || this.chosen?.kind === 'sleep' || this.seatW > 0.5) return;
    const L = J.D.thigh + J.D.shin;
    g.updateWorldMatrix(true, true);
    const root = g.getWorldPosition(_h).clone(), s = g.getWorldScale(_b).y || 1, reach = PLANT.reach * L * s;
    let lo = 0;
    const offs = J.feet.map((foot) => {
      foot.getWorldPosition(_a);
      const off = Math.max(-reach, Math.min(reach, S.sx * (_a.x - root.x) + S.sz * (_a.z - root.z)));
      lo = Math.min(lo, off);
      return off;
    });
    // (the hips down to the lower foot's ground, in the rig's own scale)
    J.body.position.y += lo / s;
    J.body.updateMatrixWorld(true);
    // (each sole laid on the slope: the foot's turn as the clip left it, tipped from level onto the plane)
    _y.set(-S.sx, 1, -S.sz).normalize();
    const tip = new THREE.Quaternion().setFromUnitVectors(UP, _y);
    J.legs.forEach((leg, i) => {
      const lift = offs[i] - lo, knee = J.knees[i], foot = J.feet[i];
      const footQ = foot.getWorldQuaternion(_q2).clone().premultiply(tip);
      if (lift < 0.004) { foot.parent.getWorldQuaternion(_q).invert(); foot.quaternion.copy(_q.multiply(footQ)); foot.updateMatrixWorld(true); return; }
      leg.getWorldPosition(_h); foot.getWorldPosition(_a);
      _a.y += lift;
      // (the knee forward: the body's +z)
      J.body.getWorldQuaternion(_q); _c.set(0, 0, 1).applyQuaternion(_q);
      twoBone(_h, _a, J.D.thigh * s, J.D.shin * s, _c, _k);
      aimWorld(leg, _k.clone().sub(_h));
      leg.updateMatrixWorld(true);
      knee.getWorldPosition(_h);
      aimWorld(knee, _a.clone().sub(_h));
      knee.updateMatrixWorld(true);
      foot.parent.getWorldQuaternion(_q).invert();
      foot.quaternion.copy(_q.multiply(footQ));
      foot.updateMatrixWorld(true);
    });
  }
}

/** Every drawn vertex (world) of a joint: its own meshes', or a skinned mesh's bound to its bones (and theirs under it). */
function verticesOf(obj) {
  const out = [], q = new THREE.Vector3();
  obj.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) out.push(q.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone()); } });
  if (out.length) return out;
  const joints = new Set(); obj.traverse((o) => joints.add(o));
  let top = obj; while (top.parent) top = top.parent;
  top.traverse((m) => {
    if (!m.isSkinnedMesh) return;
    const bones = new Set(m.skeleton.bones.map((b, i) => (joints.has(b) ? i : -1)).filter((i) => i >= 0));
    if (!bones.size) return;
    m.skeleton.update();
    const p = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    for (let i = 0; i < p.count; i++) if (bones.has(si.getX(i)) && sw.getX(i) > 0.5) out.push(m.getVertexPosition(i, q).applyMatrix4(m.matrixWorld).clone());
  });
  return out;
}

/**
 * The ball of a foot, in its ankle's frame (issue #749): of its sole (the drawn points within 1.5 cm of its lowest along
 * the ankle's own down), 70 % of the way from the heel to the toe along the foot's own forward. The point a walking
 * foot stays on through its stance (heel-off to toe-off); the lowest point rolls from the heel to the toe. Read once
 * from the drawn foot (any pose: in the ankle's own frame), null with nothing drawn under it.
 */
export function footBall(foot) {
  foot.updateWorldMatrix(true, true);
  const V = verticesOf(foot).map((p) => foot.worldToLocal(p));
  if (V.length < 3) return null;
  // (the ankle's -y is down the leg at rest; its +z the toes)
  const lo = Math.min(...V.map((p) => p.y)), sole = V.filter((p) => p.y < lo + 0.015 * (1 / (foot.getWorldScale(_b).y || 1)));
  const zs = sole.map((p) => p.z), a = Math.min(...zs), b = Math.max(...zs);
  return new THREE.Vector3(0, lo, a + 0.7 * (b - a));
}

/** A limb joint's -y aimed along dir (world), its parent's frame read now. */
function aimWorld(j, dir) {
  j.parent.getWorldQuaternion(_q).invert();
  j.quaternion.setFromUnitVectors(DOWN, dir.normalize().applyQuaternion(_q));
}
/** A limb joint's -y aimed along d ([x, y, z] in `frame`'s space), blended by w from its pose now. */
function aimLimb(j, frame, d, w) {
  frame.updateWorldMatrix(true, false);
  frame.getWorldQuaternion(_q);
  _x.set(d[0], d[1], d[2]).normalize().applyQuaternion(_q);
  j.parent.updateWorldMatrix(true, false);
  j.parent.getWorldQuaternion(_q2).invert();
  _x.applyQuaternion(_q2);
  _q.setFromUnitVectors(DOWN, _x);
  j.quaternion.slerp(_q, w);
  j.updateMatrixWorld(true);
}

/**
 * No clips (node, a page without the library): a stance and a walk by hand, so the body still draws its states: the
 * legs swing by the distance walked, the arms with them; a wind-up raises the arms (its procedural pose if it has one).
 */
export function fallbackPose(J, f, want, walked, t) {
  const sw = want.loop === 'move' ? Math.sin(walked * 6) * 0.5 : 0, D = J.D;
  J.body.position.set(0, -Math.abs(sw) * 0.04 * D.hip, 0); J.body.quaternion.identity();
  J.torso.rotation.set(0.05, 0, 0); J.head.rotation.set(0, 0, 0);
  // (the feet kept level: turned back against the thigh's swing and the knee's bend)
  J.legs.forEach((l, i) => { const a = sw * (i ? 1 : -1), k = Math.max(0, -a) * 0.8; l.rotation.set(a, 0, 0); J.knees[i].rotation.set(k, 0, 0); J.feet[i].rotation.set(-a - k, 0, 0); });
  const up = want.kind === 'wind' ? smooth(want.load ?? 0) : want.kind === 'strike' ? 1 - smooth((f.k ?? 0) * 2) : 0;
  J.arms.forEach((a, i) => { a.rotation.set(-sw * (i ? 1 : -1) * 0.6 - up * 2.6, 0, (i ? 1 : -1) * 0.12); J.elbows[i].rotation.set(-0.3 - up * 0.4, 0, 0); });
  if (want.kind === 'sleep' || want.kind === 'down') { J.body.rotation.x = -1.4; J.body.position.y = 0.15; }
  else if (want.kind === 'sit') { J.body.position.y = -D.hip * 0.45; J.legs.forEach((l, i) => { l.rotation.x = -1.4; J.knees[i].rotation.x = 2.2; }); }
}

/** Second-order springs for a body's loose parts (a skirt of rags, a horn on its back): driven by the speed and the turn. */
export class Sway {
  constructor(f = 2.2, z = 0.35, r = 0, most = 0.45) { this.x = new SecondOrder(f, z, r); this.z = new SecondOrder(f, z, r); this.last = null; this.most = most; }
  /** Its swing this frame (rad about x and z, within ±most), from the foe's speed ahead (m/s) and its heading (rad). */
  update(dt, ahead, heading) {
    const m = this.most, c = (x) => Math.max(-m, Math.min(m, x));
    if (!(dt > 0) || this.last === null) { this.last = heading; return { x: c(this.x.y), z: c(this.z.y) }; }
    const turn = THREE.MathUtils.euclideanModulo(heading - this.last + Math.PI, Math.PI * 2) - Math.PI;
    this.last = heading;
    const rate = Math.max(-6, Math.min(6, turn / dt));
    return { x: c(this.x.update(dt, -0.05 * Math.min(ahead, 6))), z: c(this.z.update(dt, 0.06 * rate)) };
  }
}
