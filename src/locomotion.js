import * as THREE from 'three';

// The body's answer to how it moves, laid over the clips (Animator.apply) for the traveller and
// the people near you. It never changes where anyone goes, only how they carry themselves:
//  - starts and stops: the chest tips forward as the body speeds up, back (and the hips dip) as
//    it brakes, and settles again once the speed holds;
//  - turns: the body banks into a curve, more the faster it goes; the head and then the chest
//    turn toward where you're steering before the hips get there;
//  - a fast turn on the spot is a pivot (feet.js turns the planted foot on its ball);
//  - steps and stairs: the drawn body rides a little behind a sudden change of floor height
//    (StepLag), so a stair doesn't jerk it up a whole step in one frame (the feet stay planted);
//  - the stride: how far the clip's feet are warped toward the hips (gaitFeet) to match the
//    real speed, and which feet are down, for feet.js.

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const clamp = THREE.MathUtils.clamp;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _x = new THREE.Vector3(1, 0, 0), _y = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);

export const LOCO = {
  leanPerAccel: 0.02, leanMax: 0.16, leanBack: 0.2,   // rad per m/s^2, forward and back limits
  dipPerBrake: 0.005, dipMax: 0.05,                    // m the hips dip per m/s^2 of braking
  bankPerTurn: 0.035, bankMax: 0.22,                    // rad per (rad/s x m/s / walk speed)
  headLead: 0.5, headMax: 0.6, chestLead: 0.28, chestMax: 0.32,
  pivotTurn: 3.2, pivotSpeed: 2.6,                      // rad/s faster than this, under this speed: a pivot
};

export class Locomotion {
  /** @param o.walk a walking pace (m/s), for scaling the bank; o.style: { lean, bank, head } multipliers */
  constructor({ walk = 3.8, style = null } = {}) {
    this.walk = walk;
    this.style = { lean: 1, bank: 1, head: 1, ...(style ?? {}) };
    this.vf = 0; this.af = 0; this.turn = 0; this.lastHeading = null;
    this.lean = 0; this.dip = 0; this.bank = 0; this.chest = 0; this.head = 0;
  }

  reset(heading = null) {
    this.vf = 0; this.af = 0; this.turn = 0; this.lastHeading = heading;
    this.lean = this.dip = this.bank = this.chest = this.head = 0;
  }

  /**
   * @param dt
   * @param s.vf      speed along the facing (m/s)
   * @param s.speed   horizontal speed
   * @param s.heading the facing (rad)
   * @param s.want    the heading being steered to (rad), or null
   * @param s.ground  on the ground (else everything eases out)
   */
  update(dt, { vf, speed, heading, want = null, ground = true }) {
    if (!(dt > 0)) return this;
    const S = this.style;
    // turn rate (rad/s) and forward acceleration (m/s^2), smoothed so a frame's noise isn't a lurch
    const dh = this.lastHeading === null ? 0 : wrap(heading - this.lastHeading);
    this.lastHeading = heading;
    this.turn += (dh / dt - this.turn) * damp(10, dt);
    const a = (vf - this.vf) / dt;
    this.vf = vf;
    this.af += (clamp(a, -60, 60) - this.af) * damp(7, dt);
    const g = ground ? 1 : 0;
    const leanT = clamp(this.af * LOCO.leanPerAccel, -LOCO.leanBack, LOCO.leanMax) * S.lean * g;
    this.lean += (leanT - this.lean) * damp(8, dt);
    const dipT = clamp(-this.af * LOCO.dipPerBrake, 0, LOCO.dipMax) * g * Math.min(speed / 1.5 + 0.3, 1);
    this.dip += (dipT - this.dip) * damp(10, dt);
    const bankT = clamp(-this.turn * LOCO.bankPerTurn * Math.min(speed / this.walk, 1.6), -LOCO.bankMax, LOCO.bankMax) * S.bank * g;
    this.bank += (bankT - this.bank) * damp(8, dt);
    // the head leads a turn, the chest follows it, the hips (the heading) come last
    const ahead = want === null ? 0 : wrap(want - heading);
    const headT = clamp(ahead * LOCO.headLead, -LOCO.headMax, LOCO.headMax) * S.head;
    const chestT = clamp(ahead * LOCO.chestLead, -LOCO.chestMax, LOCO.chestMax) * S.head;
    this.head += (headT - this.head) * damp(12, dt);
    this.chest += (chestT - this.chest) * damp(9, dt);
    this.pivot = Math.abs(this.turn) > LOCO.pivotTurn && speed < LOCO.pivotSpeed;
    return this;
  }

  /** Lay it over the rig (after Animator.apply): pitch and roll the chest and hips, turn the chest and head. */
  pose(char, k = 1) {
    if (k <= 0) return;
    const { body, torso, head } = char;
    // the hips take a little of the lean and the bank, the chest the rest (both in the body's frame)
    body.quaternion.premultiply(_q.setFromAxisAngle(_x, this.lean * 0.3 * k)).premultiply(_q2.setFromAxisAngle(_z, this.bank * 0.4 * k));
    body.position.y -= this.dip * k;
    torso.quaternion.premultiply(_q.setFromAxisAngle(_x, this.lean * 0.7 * k)).premultiply(_q2.setFromAxisAngle(_z, this.bank * 0.6 * k));
    torso.quaternion.premultiply(_q.setFromAxisAngle(_y, this.chest * k));
    head.quaternion.premultiply(_q.setFromAxisAngle(_y, this.head * k));
  }
}

/**
 * What feet.js needs from the animator this frame: which feet are down, how much of the pose is
 * the gait, and the stride warp (the body's speed over the speed the loop sweeps a planted foot
 * back at, so the clip's feet and the held ones move alike).
 */
export function gaitFeet(animator, speed, out = {}) {
  const A = animator;
  out.contact = A.contact;
  out.toContact = A.toContact;
  out.speed = speed;
  out.gait = A.gaitW;
  const sweep = A.footSpeed * Math.max(A.gaitW, 0.05);
  out.warp = sweep > 0.05 ? clamp(speed / sweep, 0.4, 1.25) : 1;
  // (motion-captured feet swing low: lift them clear while the matcher leads: feet.js)
  out.minClear = A.mmW > 0 ? 0.045 * A.mmW : 0;
  return out;
}

/**
 * The drawn body's lag behind a sudden change of floor height (a stair, a kerb, a step down off a
 * ledge on foot): the height jumps, the body follows over ~0.1 s. Smooth slopes don't trigger it.
 */
export class StepLag {
  constructor() { this.lag = 0; this.last = null; }
  reset() { this.lag = 0; this.last = null; }
  /** pos: the root (world), up: the way up there; returns the offset to add along up. */
  update(dt, pos, up, onGround) {
    // (the rise since the last frame along today's up: where gravity turns (the Hangar), a height
    // measured from the world's origin would jump with every turn of the up vector)
    const jump = this.last ? (pos.x - this.last.x) * up.x + (pos.y - this.last.y) * up.y + (pos.z - this.last.z) * up.z : 0;
    (this.last ??= pos.clone()).copy(pos);
    if (!onGround) { this.lag = 0; return 0; }
    // (a stair is centimetres in one frame; a slope at a run is ~1 cm; a teleport is metres)
    if (Math.abs(jump) > 0.03 && Math.abs(jump) < 0.8) this.lag -= jump;
    this.lag = clamp(this.lag * Math.exp(-12 * dt), -0.45, 0.45);
    return this.lag;
  }
}

/**
 * A person's own way of walking, from their body and a seed (0..1 random draws): so a crowd
 * doesn't march in step, and a heavy man doesn't walk like a slim girl.
 *  stride: x the loop's stride (longer: a slower cadence for the same speed)
 *  bob:    x the hips' rise and fall;  sway: the hips' roll from side to side (rad at a walk)
 *  lean:   the chest's pitch forward walking (rad);  stoop: standing too;  chin: the head's pitch
 *  pace:   x their walking speed;  phase: where in the cycle they start;  wobble: the cadence's
 *          slow drift (a fraction), so two people side by side drift out of step
 * @param rand  () => 0..1 (seeded)
 * @param o.build costumes.js BUILDS key; o.kind 'm' | 'f'; o.size the body's scale (children ~0.6)
 */
export function gaitStyle(rand, { build = 'average', kind = 'm', size = 1 } = {}) {
  const r = () => rand() * 2 - 1;
  const B = { slim: { stride: 1.04, bob: 1.1, sway: 0.02 }, average: { stride: 1, bob: 1, sway: 0.03 }, broad: { stride: 0.97, bob: 0.95, sway: 0.04 }, heavy: { stride: 0.9, bob: 0.82, sway: 0.065 } }[build] ?? { stride: 1, bob: 1, sway: 0.03 };
  const child = size < 0.8, f = kind === 'f';
  // an older or more tired walker now and then: a shorter stride, bent forward, eyes lower
  const age = Math.max(0, rand() * 1.6 - 0.6);
  return {
    stride: B.stride * (f ? 0.97 : 1) * (child ? 0.92 : 1) * (1 + r() * 0.05) * (1 - age * 0.08),
    bob: B.bob * (child ? 1.25 : 1) * (1 + r() * 0.12),
    sway: B.sway * (f ? 1.3 : 1) * (1 + r() * 0.3),
    lean: 0.03 + r() * 0.03 + age * 0.09,
    stoop: Math.max(0, age * 0.12 + r() * 0.02),
    chin: r() * 0.06 + age * 0.08,
    pace: (1 + r() * 0.06) * (1 - age * 0.12),
    phase: rand(),
    wobble: 0.02 + rand() * 0.03,
    wobbleRate: 0.25 + rand() * 0.3,
  };
}

/** Lay a person's gait style over the rig (after Animator.apply): k = how much they're walking (0..1). */
export function poseStyle(char, G, phase, k, still = 1 - k) {
  const { body, torso, head } = char;
  if (G.sway) body.quaternion.multiply(_q.setFromAxisAngle(_z, Math.sin(phase * Math.PI * 2) * G.sway * k));
  const pitch = G.lean * k + G.stoop * still;
  if (pitch) torso.quaternion.premultiply(_q.setFromAxisAngle(_x, pitch));
  if (G.chin) head.quaternion.multiply(_q.setFromAxisAngle(_x, G.chin - pitch * 0.5));
}
