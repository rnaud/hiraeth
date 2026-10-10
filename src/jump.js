import * as THREE from 'three';

// The jump by its phase (Player.animateClips): the clips' three jumps (Jump_Start, Jump_Loop,
// Jump_Land, src/animator.js) are blended by where the body is in its flight, and a light
// procedural layer (JumpLayer.pose) is laid over them:
//  - take-off: the push, the late part of Jump_Start (the legs straighten, the arms swing up);
//  - rising, then the top (vertical speed near zero): the tucked Jump_Loop, tucked a little more
//    at the top;
//  - falling: the arms rise and open, the legs part a little;
//  - about to land (the time to the ground, from the height below and the fall speed, under a
//    third of a second): the first frame of Jump_Land, legs reaching down and forward, so the
//    landing clip carries on from it;
//  - landing: a short squash, deeper the harder the landing (the planted feet bend the knees).
// None of it changes where you go: velocity, jump height and timing are as before.

const sm = THREE.MathUtils.smoothstep;

export const JUMP_POSE = {
  takeoff: [0.14, 0.34],   // s in the air: the push, fading over this
  apex: [1.5, 6],          // |vertical speed| (m/s): fully the top under the first, not at all past the second
  fall: [3, 14],           // m/s down: the falling pose from the first, fully at the second
  reach: [0.12, 0.34],     // s to the ground: fully reaching under the first, not at all past the second
  land: { time: [0.28, 0.46], depth: 0.17, speed: [3, 20], min: 0.25 },   // the squash: s (short for a hop, longer for a drop), m at its deepest, landing speeds (m/s) it scales over
};

/** Seconds until a body `h` m above the ground, moving `vy` m/s up under gravity `g`, gets there (Infinity with no ground). */
export function timeToGround(h, vy, g = 32) {
  if (!Number.isFinite(h)) return Infinity;
  if (h <= 0) return 0;
  return (vy + Math.sqrt(vy * vy + 2 * g * h)) / g;
}

/**
 * Where the body is in its flight: weights (0..1) for each phase and the one that leads.
 * @param s.airT s in the air, s.vy m/s up, s.h m above the ground below (Infinity: none),
 *        s.jumped whether it left the ground by a jump (a step off a ledge has no take-off)
 */
export function jumpPhase({ airT = 0, vy = 0, h = Infinity, jumped = false, g = 32 } = {}, out = {}) {
  const P = JUMP_POSE;
  const tLand = vy <= 0 ? timeToGround(h, vy, g) : Infinity;
  out.tLand = tLand;
  out.takeoff = jumped && vy > 0 ? 1 - sm(airT, P.takeoff[0], P.takeoff[1]) : 0;
  out.apex = 1 - sm(Math.abs(vy), P.apex[0], P.apex[1]);
  out.fall = vy < 0 ? sm(-vy, P.fall[0], P.fall[1]) : 0;
  out.reach = vy < 0 ? 1 - sm(tLand, P.reach[0], P.reach[1]) : 0;
  out.stage = out.takeoff > 0.5 ? 'takeoff' : out.reach > 0.5 ? 'reach' : out.apex > 0.5 ? 'apex' : vy > 0 ? 'rise' : 'fall';
  return out;
}

/** How deep the landing squash is (0..1) for a landing at `speed` m/s into the ground. */
export function landSquash(speed) {
  const L = JUMP_POSE.land;
  if (!(speed > 1)) return 0;
  return L.min + (1 - L.min) * sm(speed, L.speed[0], L.speed[1]);
}

/** The squash over its time (0..1 of its JUMP_POSE.land.time): down fast, back up slowly. */
export function squashCurve(e) {
  if (e <= 0 || e >= 1) return 0;
  return e < 0.18 ? sm(e, 0, 0.18) : (1 - (e - 0.18) / 0.82) ** 2;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
// a turn in the joint's parent frame (x: pitch, +forward for the body, +back for a hanging limb; z: roll)
const turn = (j, x, y, z) => { if (j) j.quaternion.premultiply(_q.setFromEuler(_e.set(x, y, z))); };

/**
 * The procedural part: the phase weights eased from frame to frame (so a sudden change, a bump
 * on a ledge, doesn't snap the pose) and the landing squash; pose(char) lays it over the clips.
 */
export class JumpLayer {
  constructor() {
    this.w = { takeoff: 0, apex: 0, fall: 0, reach: 0 };
    this.air = 0;              // eased: 1 in the air, 0 on the ground
    this.phase = jumpPhase();
    this.squashT = Infinity;   // s since the last landing
    this.squashK = 0;
    this.squash = 0;           // this frame's squash (0..1)
    this.wasAir = false;
    this.airT = 0;             // s the last time in the air lasted
  }

  /** s: { onGround, vy, airT, h, jumped, impact (m/s into the ground when it landed), speed (horizontal m/s) } */
  update(dt, s) {
    const air = !s.onGround;
    if (!air && this.wasAir && s.impact > 1) {
      this.squashT = 0;
      // (at a run the legs take it in their stride: a lighter squash; standing after a real jump the
      // landing clip crouches already, Animator.update: a little on top of it)
      const clip = this.airT > 0.45 && (s.speed ?? 0) < 3;
      this.squashK = landSquash(s.impact) * (1 - 0.45 * sm(s.speed ?? 0, 3, 8)) * (clip ? 0.45 : 1);
      const T = JUMP_POSE.land.time;
      this.squashDur = T[0] + (T[1] - T[0]) * sm(s.impact, 8, 24);
    }
    this.wasAir = air;
    this.airT = air ? s.airT ?? 0 : this.airT;
    const P = air ? jumpPhase(s, this.phase) : null;
    const k = 1 - Math.exp(-14 * dt);
    for (const key in this.w) this.w[key] += ((P ? P[key] : 0) - this.w[key]) * k;
    this.air += ((air ? 1 : 0) - this.air) * (1 - Math.exp(-(air ? 12 : 18) * dt));
    this.squashT += dt;
    this.squash = air ? 0 : this.squashK * squashCurve(this.squashT / (this.squashDur ?? JUMP_POSE.land.time[0]));
    return this;
  }

  /** Lay the phase over the clips' pose (after Animator.apply), by k (0..1); the hands are left as they are. */
  pose(c, k = 1) {
    // (k: how much of it; less under a captured jump, src/air-moves.js)
    const a = this.air * k, W = this.w, q = this.squash * k;
    if (a > 0.01) {
      const tk = W.takeoff * a, ap = W.apex * a * (1 - W.reach), fl = W.fall * a * (1 - W.reach), rc = W.reach * a;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;   // index 0 is the character's right (-x)
        // the push: arms swing forward and up, legs straighten
        // the top: knees come up a little more
        // falling: arms rise and open, legs part, one knee more bent than the other
        // reaching for the ground: legs forward, arms forward and out for balance
        turn(c.arms[i], -0.9 * tk - 0.15 * ap - 0.35 * fl - 0.45 * rc, 0, side * (0.1 * tk + 0.25 * ap + 0.85 * fl + 0.3 * rc));
        turn(c.elbows[i], -0.25 * tk - 0.2 * fl, 0, 0);
        turn(c.legs[i], 0.12 * tk - 0.3 * ap - (i ? 0.1 : 0.22) * fl - 0.28 * rc, 0, side * 0.07 * fl);
        turn(c.knees[i], -0.2 * tk + 0.4 * ap + (i ? 0.1 : 0.35) * fl - 0.2 * rc, 0, 0);
      }
      turn(c.torso, -0.06 * tk + 0.12 * ap - 0.1 * fl + 0.1 * rc, 0, 0);
      turn(c.head, -0.12 * tk + 0.05 * ap - 0.12 * fl + 0.12 * rc, 0, 0);
    }
    if (q > 0.001) {
      const L = JUMP_POSE.land;
      c.body.position.y -= L.depth * q;
      turn(c.body, 0.12 * q, 0, 0);
      turn(c.torso, 0.18 * q, 0, 0);
      turn(c.head, -0.2 * q, 0, 0);
      for (let i = 0; i < 2; i++) turn(c.arms[i], -0.3 * q, 0, (i === 0 ? -1 : 1) * 0.25 * q);
    }
  }
}

/** The double jump's burst (m/s): up, and forward along the heading; keep: the share of a jump still rising that is kept. */
export const DOUBLE_JUMP = { up: 15, forward: 4, keep: 0.35 };

/**
 * The double jump (the lift valve, Player.doubleJump; once the fluid boost): the velocity along up becomes a fresh
 * burst (keeping a share of a jump that is still rising), plus a push along fwd (unit, tangent). Works in any gravity
 * frame. Mutates and returns vel.
 */
export function boostVelocity(vel, up, fwd, { up: burst = DOUBLE_JUMP.up, forward = DOUBLE_JUMP.forward, keep = DOUBLE_JUMP.keep } = {}) {
  const vu = vel.dot(up);
  vel.addScaledVector(up, burst + Math.max(vu, 0) * keep - vu);
  if (fwd) vel.addScaledVector(fwd, forward);
  return vel;
}

/** For tests and the HUD: the phase's leading stage given plain numbers. */
export const jumpStage = (s) => jumpPhase(s).stage;

// ---- the double jump's flip (the lift valve: Player.doubleJump)
// A front flip on the second jump, laid over everything else (it is the last turn of the body): the body turns once
// head over heels about its hips (`pivot` m over the feet, the jets' lean turns about the same point), quick in the
// middle and eased at both ends, tucked as it goes over (knees to the chest, arms round the shins) and opening out
// to land. Short (`time` s: done before the double jump's top, 0.47 s up), so it never reaches the ground. Nothing
// of it changes the flight.
export const FLIP = { time: 0.44, pivot: 0.95, tuck: { legs: 1.5, knees: 2.0, arms: 1.1, elbows: 1.3, torso: 0.35, head: 0.3 } };

/** The share of the turn done (0..1) at s seconds into the flip. */
export function flipTurn(s) {
  const e = THREE.MathUtils.clamp(s / FLIP.time, 0, 1);
  return e * e * e * (e * (e * 6 - 15) + 10);   // (smootherstep: the turn eases in and out)
}
/** How tucked (0..1) at s seconds into the flip: in by the first third, open again by the end. */
export function flipTuck(s) {
  const e = s / FLIP.time;
  if (e <= 0 || e >= 1) return 0;
  return e < 0.3 ? sm(e, 0, 0.3) : 1 - sm(e, 0.62, 1);
}

const _fq = new THREE.Quaternion(), _fx = new THREE.Vector3(1, 0, 0), _fp = new THREE.Vector3();
/**
 * Lay the flip on the posed rig `c` (Player.animateClips, last): s seconds into it, k how much of it (0..1). The
 * tuck bends the limbs; the turn goes round the body's x (its right: +x is a forward pitch, head first) about the
 * pivot, so the hips stay where the flight carries them.
 */
export function flipPose(c, s, k = 1) {
  if (s == null || s < 0 || s >= FLIP.time || !c?.body) return false;
  const T = FLIP.tuck, q = flipTuck(s) * k;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    turn(c.legs[i], -T.legs * q, 0, side * 0.12 * q);
    turn(c.knees[i], T.knees * q, 0, 0);
    turn(c.arms[i], -T.arms * q, 0, side * 0.25 * q);
    turn(c.elbows[i], -T.elbows * q, 0, 0);
  }
  turn(c.torso, T.torso * q, 0, 0);
  turn(c.head, T.head * q, 0, 0);
  const a = Math.PI * 2 * flipTurn(s) * k;
  _fq.setFromAxisAngle(_fx, a);
  c.body.quaternion.premultiply(_fq);
  // about the pivot: the body's origin is at the feet, so turn its offset from the pivot with it
  _fp.set(0, FLIP.pivot, 0);
  c.body.position.sub(_fp).applyQuaternion(_fq).add(_fp);
  return true;
}
