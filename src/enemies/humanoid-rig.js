import * as THREE from 'three';
import { Animator } from '../animator.js';
import { twoBone } from '../motion-kit/ik.js';
import { SecondOrder } from '../motion-kit/spring.js';

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
/** Distance tiers: past `mid` m the pose is made every 2nd frame, past `far` every 4th (the time between kept). */
export const RIG_LOD = { mid: 22, far: 40 };

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
  sit: { clip: 'kneeling_inspecting', from: 1.1, to: 3.9, pingpong: true },
  sleep: { clip: 'get_up_back', at: 0.6 },
  lookout: { loop: 'look' },
  guard: { loop: 'idle' },
  // (struck: the sword-and-shield impact; the poise knock-down: lying on its back, then the get-up)
  stagger: { clip: 'ss_impact_1', from: 0.0, to: 0.7 },
  down: { clip: 'get_up_back', at: 0.6, rise: { from: 2.65, to: 5.55, secs: 0.9 } },
  pickup: { clip: 'kneeling_inspecting', from: 0.3, to: 1.6 },
  // (circling you while it waits its turn: the sword-and-shield strafe, mirrored the other way)
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
  // the poise knock-down (#722): lying, then the get-up over its last `rise.secs`
  if (f.downT > 0) {
    const D = S.down, left = f.downT;
    if (D.rise && left < D.rise.secs) return at(D, D.rise.from + (D.rise.to - D.rise.from) * (1 - left / D.rise.secs), 'down');
    return at(D, D.at, 'down');
  }
  // (bending for its weapon: the mind's recover timer runs down over the pickup)
  if (f.reel === 'pickup' && f.state === 'recover') return at(S.pickup, S.pickup.from + (S.pickup.to - S.pickup.from) * clamp01(1 - (f.timer ?? 0) / (f.def?.disarm?.pickup ?? 1.2)), 'pickup');
  // an attack: the wind-up stretched to the foe's own time, the loaded pose held from HOLD_AT; the strike through the cut
  if (a && M && (f.state === 'wind' || f.state === 'strike' || f.state === 'recover')) {
    if (M.feint && a.feint != null) return feintClip(f, M, a.feint);
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
    if (I.at != null) return at(I, I.at, mode);
    return at(I, pingpong(o.t ?? 0, I.from, I.to), mode);
  }
  if (Math.abs(o.strafe ?? 0) > 0.6 && S.strafe) return { clip: S.strafe.clip + (o.strafe < 0 ? '_m' : ''), t: o.strafeT ?? 0, kind: 'strafe' };
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
/** The clip's time through a strike (k 0..1): the loaded pose to the cut at the attack's contact share, then the follow-through to `to`. */
export function strikeClipTime(k, M, contact = 0.5) {
  const c = Math.min(0.95, Math.max(0.05, contact));
  return k < c ? M.load + (M.cut - M.load) * (k / c) : M.cut + (M.to - M.cut) * clamp01((k - c) / (1 - c));
}

// ------------------------------------------------------------------ procedural arm poses (moves no clip has)

/**
 * Arms aimed by hand where no clip has the move: for each side (r, l), the upper arm's and the forearm's directions in
 * the torso's frame (x the foe's left, y up, z ahead), at the loaded pose. Blended over the clip's arms by the move's
 * weight, from the loop's arms toward the loaded pose as the wind-up goes, and back through the strike.
 */
export const PROC_POSES = {
  // a bow held sideways before it, the cord drawn back to the mask
  bow: { l: [[0.15, 0.25, 1], [0.1, 0.3, 1]], r: [[-0.3, 0.35, 0.5], [0.6, 0.55, -0.4]], strike: { r: [[-0.4, 0.1, 0.6], [-0.2, -0.3, 0.9]] } },
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
  // (the fencer's, #724) its shield drawn back to its shoulder, then punched out before it
  bash: { l: [[0.55, -0.35, -0.55], [-0.35, 0.45, 0.8]], strike: { l: [[0.2, -0.05, 1], [0.05, 0.1, 1]] } },
  // its shield lowered before its hip while its sword goes up in both the clip's hands (the overhead)
  shieldDown: { l: [[0.3, -0.95, 0.3], [0.05, -0.55, 0.85]] },
  // its shield held square before it (the sweep's other hand)
  shieldUp: { l: [[0.35, -0.3, 0.9], [-0.5, 0.5, 0.7]] },
  // (the shade's guard, #661) its sword arm across its body, the blade up to its left; the empty sleeve's cuff against it
  swordGuard: { r: [[-0.2, -0.55, 0.8], [0.85, 0.4, 0.35]], l: [[0.3, -0.45, 0.85], [-0.55, 0.5, 0.65]] },
  // its guard broken: both arms flung wide, the shield out to its side
  flung: { r: [[-0.95, 0.15, 0.1], [-0.9, 0.45, 0.2]], l: [[0.95, 0.15, 0.1], [0.9, 0.45, 0.2]] },
  // hands clutching its face (the mask knocked off)
  clutch: { l: [[0.3, 0.1, 0.6], [-0.5, 0.8, 0.3]], r: [[-0.3, 0.1, 0.6], [0.5, 0.8, 0.3]] },
};

// ------------------------------------------------------------------ the driver

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _h = new THREE.Vector3(), _k = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
let seed = 0;

/**
 * One foe's clips on its skeleton. J: humanoidSkeleton's joints; rig: the group the skeleton hangs in (the Animator's
 * root: its +z the foe's forward); moves: its attack clips (stateClip); states: its own STATE_CLIPS over the shared;
 * speeds: { walk, jog, sprint } m/s (its own: the stride follows its legs, the speeds its kind's); style(J, want): its own
 * touches over the clip's pose each time it is made (a bow-legged stance).
 */
export class HumanoidDriver {
  constructor(J, rig, { moves = {}, states = {}, speeds = { walk: 0.9, jog: 2.4, sprint: 4.5 }, style = null } = {}) {
    Object.assign(this, { J, rig, moves, states: { ...STATE_CLIPS, ...states }, speeds, style });
    this.A = null; this.lib = null;
    this.prev = null; this.speed = 0; this.side = 0; this.walked = 0; this.t = (seed++ * 0.731) % 7;
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
      }
      this.prev.copy(p);
    }
    this.t += dt;
    // far off: every 2nd or 4th frame (the time between carried)
    const dist = c.eye ? Math.hypot(c.eye.x - p.x, c.eye.z - p.z) : 0, every = dist > RIG_LOD.far ? 4 : dist > RIG_LOD.mid ? 2 : 1;
    this.acc += dt;
    if (every > 1 && ++this.frame % every && this.drawnOnce) return this.chosen;
    const step = this.acc; this.acc = 0;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const want = stateClip(f, this.moves, { strafe: this.side, strafeT: this.walked * 0.9, t: this.t }, this.states);
    this.chosen = want;
    const A = this.animator();
    if (A) this.clipPose(A, f, want, step, o);
    else fallbackPose(this.J, f, want, this.walked, this.t);
    this.crossfade(want, step);
    this.style?.(this.J, want);   // (the body's own stance over the clip's: a bow-legged mummer)
    this.procPose(want, o, step);
    this.plant(f);
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
      const full = M.kind === 'down' || M.kind === 'sleep' || M.kind === 'sit' || M.kind === 'pickup';
      // (an attack's own hop and lean are its; a strafe keeps the gait's feet: it walks sideways)
      A.play(M.clip, M.t, smooth(this.moveW), { full, head: true, walks: M.kind === 'strafe', ground: !!M.ground });
    }
    // a move above the legs over it all (the fencer's shield up: the sword-and-shield guard), its own clock
    const U = o.upper;
    if (U && U.w > 0.001) A.playUpper(U.clip, (this.t * (U.rate ?? 1)) % (A.moveClip(U.clip)?.duration || 1), Math.min(1, U.w));
    const loop = want.loop === 'look' ? 'look' : null;
    A.calm = !!loop;
    A.update(dt, {
      speed: move && move.kind !== 'strafe' ? 0 : this.speed, onGround: true, mode: 'ground',
      walkAt: S.walk, jogAt: S.jog, sprintAt: S.sprint, strideScale: 1,
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
    if (want.kind === 'wind' && want.load >= 1) J.torso.rotateX(-0.12 * smooth(((f.k ?? 0) - HOLD_AT) / (1 - HOLD_AT)));
  }

  /** The joints of one move eased over from the last pose of another (XFADE), the clip's pose kept to start the next. */
  crossfade(want, dt) {
    const J = this.J, js = this._joints ??= [J.body, J.torso, J.head, ...J.arms, ...J.elbows, ...J.hands, ...J.legs, ...J.knees, ...J.feet];
    const clip = want.clip ?? null;
    if (clip && this.shownClip && clip !== this.shownClip && this.moveW > 0.5 && this.shown) {
      this.xf = { q: this.shown.q.map((q) => q.clone()), p: this.shown.p.clone(), t: 0, secs: want.kind === 'down' ? XFADE.fall : XFADE.secs };
    }
    this.shownClip = clip ?? (this.moveW > 0.001 ? this.shownClip : null);
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
   * A held prop's grip turned as the clip's fist holds it (side 0 the right, 1 the left): its +y out of the fist's thumb
   * side (the haft of the library's sword), its +z along the fingers; `w` of the way from the turn it has now (the
   * model's carry, set before). False without the clips, or while a procedural pose holds the arms (the fist's turn is
   * the clip's, not the pose's): the model keeps its own carry then.
   */
  gripFrom(node, side = 0, w = 1) {
    const A = this.A;
    if (!A || this.procW > 0.5 || !(w > 0)) return false;
    const s = side ? 'l' : 'r';
    // (the library's world is the rig's frame: both face +z, y up)
    A.dir(A.bone(`pinky_01_${s}`), A.bone(`index_01_${s}`), _y);
    A.dir(A.bone(`hand_${s}`), A.bone(`middle_01_${s}`), _z);
    _z.addScaledVector(_y, -_z.dot(_y)).normalize();
    _x.crossVectors(_y, _z);
    _q.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
    this.rig.getWorldQuaternion(_q2); _q.premultiply(_q2);
    node.parent.updateWorldMatrix(true, false);
    node.parent.getWorldQuaternion(_q2).invert();
    node.quaternion.slerp(_q2.multiply(_q), Math.min(1, w));
    return true;
  }

  /** The procedural arms (PROC_POSES) over the clip's: a move's own (want.pose) or one asked for (o.pose). */
  procPose(want, o, dt) {
    const name = o.pose ?? want.pose ?? null;
    const P = name ? PROC_POSES[name] : null;
    const target = P ? (o.pose ? o.poseW ?? 1 : want.phase === 'wind' ? smooth(want.load) : want.phase === 'strike' ? 1 : 1 - clamp01(want.k ?? 0)) : 0;
    if (P) this.proc = P;
    this.procW += (target - this.procW) * (dt === 0 ? 1 : 1 - Math.exp(-14 * dt));
    if (!this.proc || this.procW < 0.01) return;
    const Q = this.proc, J = this.J, strike = want.phase === 'strike' && Q.strike ? smooth((want.k ?? 0) * 2) : 0;
    if (Q.lean) J.torso.rotateX(Q.lean * this.procW);
    ['r', 'l'].forEach((s, i) => {
      const base = Q[s];
      if (!base) return;
      const dirs = Q.strike?.[s] && strike > 0 ? base.map((d, j) => d.map((x, n) => x + (Q.strike[s][j][n] - x) * strike)) : base;
      aimLimb(J.arms[i], J.torso, dirs[0], this.procW);
      aimLimb(J.elbows[i], J.torso, dirs[1], this.procW);
    });
  }

  /**
   * The feet reach the ground on a slope: each foot's ground from the plane the foe stands on (f.slope, read from its
   * five ground rays: src/enemies/slope.js; no ray of its own), against the root's; the body lowered to the lower foot,
   * each leg's ankle reached up to its own ground by two-bone IK, the foot kept flat as the clip left it.
   */
  plant(f) {
    const S = f.slope, J = this.J, g = this.rig;
    if (!S || (Math.abs(S.sx) < 1e-3 && Math.abs(S.sz) < 1e-3) || this.chosen?.kind === 'down' || this.chosen?.kind === 'sleep') return;
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
