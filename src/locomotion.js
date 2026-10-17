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
//    at a run, up or down a flight, it rides the stairs' own line, read ahead (StairLine);
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
  pivotKeep: 0.7, pivotHold: 0.12, pivotFast: 1.1,     // once pivoting: kept over 0.7x the turn, or for 0.12 s, under 1.1x the speed
  pivotGait: 0.9,                                      // and not with the loops over this share of the pose (a running reversal)
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
    this.pivot = false; this.pivotT = 0;
  }

  /**
   * @param dt
   * @param s.vf      speed along the facing (m/s)
   * @param s.speed   horizontal speed
   * @param s.heading the facing (rad)
   * @param s.want    the heading being steered to (rad), or null
   * @param s.ground  on the ground (else everything eases out)
   */
  update(dt, { vf, speed, heading, want = null, ground = true, gait = 0 }) {
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
    // (with hysteresis and a least hold: a pivot that flickered off for a frame, the speed crossing the line as the turn
    // eased, let a held foot go and planted it again where the clip's was, half a metre off: the motion QC's 20 cm jolt)
    // (not in a running reversal, the loops' gait over LOCO.pivotGait: the speed passing under 2.6 m/s for a frame on its way
    // back up made a pivot of one frame, the held foot's knee swung round with it, a calf 29 rad/s, the Arena, issue #47)
    const on = Math.abs(this.turn) > LOCO.pivotTurn && speed < LOCO.pivotSpeed && !(gait > LOCO.pivotGait);
    const stay = Math.abs(this.turn) > LOCO.pivotTurn * LOCO.pivotKeep;
    this.pivotT = on ? LOCO.pivotHold : Math.max(0, (this.pivotT ?? 0) - dt);
    this.pivot = on || (this.pivot && speed < LOCO.pivotSpeed * LOCO.pivotFast && (stay || this.pivotT > 0));
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

/** The gait's share of the pose over which gaitFeet keeps the last warp through a frame of no sweep (1: never). */
export const WARP_HOLD = 0.5;

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
  // (the loops' sweep falls to nothing for the frame a running reversal's speed passes through it, the gait still most of
  // the pose (Animator GAIT_HOLD): the warp of the frame before is kept. Set to 1 there, the clip's feet reached out their
  // whole stride for one frame, a swinging foot 8 cm on and 16 back, the calf 21 rad/s, the sprint reversed, issue #47)
  out.warp = sweep > 0.05 ? clamp(speed / sweep, 0.4, 1.25) : A.gaitW > WARP_HOLD && out.warp !== undefined ? out.warp : 1;
  // (captured feet swing low, a centimetre or two over the floor, as people's do: lifted clear while
  // the matcher or a captured walk leads, so a swinging foot never reads as dragged: feet.js)
  out.minClear = 0.045 * Math.min(1, (A.mmW ?? 0) + (A.walkName ? A.w.walk : 0));
  return out;
}

/**
 * The drawn body's lag behind a sudden change of floor height (a stair, a kerb, a step down off a
 * ledge on foot): the height jumps, the body follows over ~0.1 s. Smooth slopes don't trigger it.
 */
export const STEP_LAG = {
  rate: 12,            // 1/s: the drawn body eases onto the floor's height after a stair
  climb: 0.15,         // s: and keeps up with a flight's climb, read over this long (0: it lags the flight)
  fast: [4.5, 6.5],    // m/s along the ground: from the first speed to the second, eased in (under it, the easing alone)
};
export class StepLag {
  constructor() { this.lag = 0; this.last = null; this.climb = 0; }
  reset() { this.lag = 0; this.last = null; this.climb = 0; }
  /**
   * pos: the root (world), up: the way up there; carried: how far a moving floor took the root this
   * frame (a riding disc's rise is not a step: the body rides it as it is); returns the offset to add along up.
   */
  update(dt, pos, up, onGround, carried = null, o = {}) {
    // (the rise since the last frame along today's up: where gravity turns (the Hangar), a height
    // measured from the world's origin would jump with every turn of the up vector)
    let jump = 0, along = 0;
    if (this.last) {
      const dx = pos.x - this.last.x, dy = pos.y - this.last.y, dz = pos.z - this.last.z;
      jump = dx * up.x + dy * up.y + dz * up.z;
      along = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - jump * jump));   // (how far along the ground)
    }
    if (carried && this.last) jump -= carried.x * up.x + carried.y * up.y + carried.z * up.z;
    (this.last ??= pos.clone()).copy(pos);
    if (!onGround) { this.lag = 0; this.climb = 0; this.line?.reset(); return 0; }
    // (a stair is centimetres in one frame; a slope at a run is ~1 cm; a teleport is metres)
    const stair = Math.abs(jump) > 0.03 && Math.abs(jump) < 0.8;
    if (stair) this.lag -= jump;
    // (a flight taken at a sprint: a riser every two or three frames, and eased at 12/s alone the drawn body ran its
    // climb's speed / 12 under the treads, 38 cm: the legs folded to reach them, the swinging foot was lifted out of the
    // leg's reach and the soles sank, issue #47. The flight's climb, read over STEP_LAG.climb, carries the drawn body up
    // (or down) with it, never past the floor's height; from STEP_LAG.fast's speeds along the ground, eased in: at a jog
    // the easing alone keeps up well enough, and carried there the hips rose less smoothly, the pelvis's jerk 2.5 -> 4.3 km/s³)
    if (STEP_LAG.climb > 0 && dt > 0) {
      this.climb += ((stair ? jump / dt : 0) - this.climb) * (1 - Math.exp(-dt / STEP_LAG.climb));
      const ff = this.climb * dt * THREE.MathUtils.smoothstep(along / dt, STEP_LAG.fast[0], STEP_LAG.fast[1]);
      if (this.lag < 0 && ff > 0) this.lag = Math.min(0, this.lag + ff);
      else if (this.lag > 0 && ff < 0) this.lag = Math.max(0, this.lag + ff);
    }
    this.lag = clamp(this.lag * Math.exp(-STEP_LAG.rate * dt), -0.45, 0.45);
    // (a flight at a run: the drawn body on the stairs' own line, read ahead, rather than eased after each riser: StairLine)
    if (o.physics && STAIR_LINE.width > 0) {
      const line = (this.line ??= new StairLine());
      const off = line.update(dt, pos, up, onGround && !(carried && carried.lengthSq() > 1e-10), o.vel, o.physics);
      if (line.w > 0) return this.lag + (off - this.lag) * line.w;
    }
    return this.lag;
  }
}

/**
 * The drawn body up a flight at a run (issue #47, the fifth round). At a sprint a riser passes under him every two or
 * three frames, and the body eased after each one (StepLag) climbed 6 cm one frame and 10 the next by turns, then
 * stopped dead at the landing from 4.6 m/s up: the held feet and the knees read against it jolted 3-9 cm. People running
 * up stairs carry their hips up the stairs' pitch, not riser by riser. So the floor along his way is read ahead (a
 * few rays to the next risers, each riser found to a centimetre and kept where it was found), and the drawn body rides
 * the floor's profile smoothed by a window `width` either side, read `lead` ahead: Σ rise · C((lead - s) / width), C a
 * smooth step from 0 to 1, s each riser's distance ahead. On an even flight that is the line through the treads' middles (a ripple under 3 mm
 * for treads of 25-36 cm); it bends onto a landing over a window's length, not in a frame; it is continuous as the
 * controller steps each riser (its own height jumps a riser, the offset back by as much). Eased in by the speed along the
 * ground (`fast`), off in the air and on a moving floor; where no riser is near (slopes: no jump to find) it adds nothing.
 * (A riser is a jump the controller steps onto: under its STEP, src/player.js.)
 */
export const STAIR_LINE = {
  width: 0.45,             // m: the smoothing's half width (0: off, StepLag alone)
  fast: [4.5, 6.5],        // m/s along the ground: eased in from the first to the second
  ahead: 0.6,              // m: how far ahead the floor is read (at least the width)
  probe: 0.08,             // m between two rays ahead
  rise: [0.03, 0.6],       // m: a jump in the floor this big is a riser
  sharp: 0.8,              // and stays this share of itself over a centimetre (a slope's doesn't)
  keep: 0.05,              // m: a riser found again within this of one kept is that one
  rate: 6,                 // 1/s: the line's share eased in and out
  lead: 0.15,              // m: the line read this far ahead of him (his hips over the tread he is stepping onto)
};
const _sl = new THREE.Vector3(), _sl2 = new THREE.Vector3(), _sld = new THREE.Vector3();
const smoother = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
export class StairLine {
  constructor() { this.risers = []; this.w = 0; this.ref = 0; this.pitch = 0; }
  reset() { this.risers.length = 0; this.w = 0; this.pitch = 0; }
  /** The floor's height along up at `p`, read from `from` over it (relative to p; NaN: none). */
  floorAt(physics, p, up, from = 0.9) {
    const d = physics.heightAbove(p, up, from);
    return Number.isFinite(d) && d < from + 0.9 ? -d : NaN;
  }
  /** Returns the drawn body's offset along up from `pos` (meaningful while this.w > 0). */
  update(dt, pos, up, onGround, vel, physics) {
    const L = STAIR_LINE, h0 = pos.dot(up);
    // (heights are read along up: where gravity turns (the Hangar), the risers kept are forgotten)
    if (this.up && this.up.dot(up) < 0.999) this.risers.length = 0;
    (this.up ??= new THREE.Vector3()).copy(up);
    const flat = _sld.copy(vel ?? _sld.set(0, 0, 0)).addScaledVector(up, -(vel ? vel.dot(up) : 0));
    const speed = vel ? flat.length() : 0;
    let want = onGround && dt > 0 ? THREE.MathUtils.smoothstep(speed, L.fast[0], L.fast[1]) : 0;
    if (!onGround) this.risers.length = 0;
    // the floor ahead: rays every `probe` m along the way he goes; a jump between two is narrowed to a centimetre
    if (want > 0 && speed > 1e-3) {
      flat.divideScalar(speed);
      const n = Math.ceil(Math.max(L.ahead, L.width) / L.probe);
      let prev = 0, prevA = 0;
      for (let j = 1; j <= n; j++) {
        const a = j * L.probe, h = this.floorAt(physics, _sl.copy(pos).addScaledVector(flat, a), up);
        if (!Number.isFinite(h)) break;
        const jump = h - prev;
        if (Math.abs(jump) > L.rise[0] && Math.abs(jump) < L.rise[1]) {
          // (bisected: a riser's jump stays whole over a centimetre, a slope's shrinks with the bracket)
          let lo = prevA, hi = a, hLo = prev, hHi = h;
          for (let k = 0; k < 3; k++) {
            const m = (lo + hi) / 2, hm = this.floorAt(physics, _sl.copy(pos).addScaledVector(flat, m), up);
            if (!Number.isFinite(hm)) break;
            if (Math.abs(hm - hLo) > Math.abs(hHi - hm)) { hi = m; hHi = hm; } else { lo = m; hLo = hm; }
          }
          if (Math.abs(hHi - hLo) > L.sharp * Math.abs(jump)) this.found(_sl.copy(pos).addScaledVector(flat, (lo + hi) / 2), flat, h0 + hLo, hHi - hLo);
        }
        prev = h; prevA = a;
      }
    }
    // (risers kept: forgotten once a window behind him, their rise counted into the floor they leave behind)
    const R = this.risers;
    if (!R.length) this.ref = h0;
    for (let i = R.length - 1; i >= 0; i--) {
      const s = _sl2.subVectors(R[i].p, pos).dot(R[i].n);
      R[i].s = s;
      if (s < -L.width - 0.05) { this.ref += R[i].r; R.splice(i, 1); }
      else if (s > L.ahead + 0.3) R.splice(i, 1);
    }
    // the floor he is on, by the risers kept, against the controller's: off by most of a riser (a riser missed, a floor
    // that moved), the line lets go
    let floor = this.ref, line = this.ref, pitch = 0;
    for (const k of R) {
      if (k.s <= 0) floor += k.r;
      const u = clamp(((L.lead - k.s) / L.width + 1) / 2, 0, 1);
      line += k.r * smoother(u); pitch += k.r * 30 * u * u * (1 - u) * (1 - u) / (2 * L.width);
    }
    this.pitch = pitch;   // (the line's rise a metre along his way: a flight's pitch, 0 on the level)
    const err = Math.abs(floor - h0), slack = R.length ? 0.5 * Math.max(...R.map((k) => Math.abs(k.r))) + 0.02 : 0.02;
    if (R.length && err > slack + 0.2) want = 0;
    this.w += (want - this.w) * (1 - Math.exp(-L.rate * dt));
    if (want === 0 && this.w < 1e-3) { this.w = 0; if (!onGround) this.ref = h0; }
    return clamp(line - h0, -0.45, 0.45);
  }
  found(p, n, lo, r) {
    for (const k of this.risers) if (Math.abs(_sl2.subVectors(p, k.p).dot(k.n)) < STAIR_LINE.keep && Math.abs(k.r - r) < 0.03) return;
    if (!this.risers.length) this.ref = lo;   // (the floor before the first riser kept)
    this.risers.push({ p: p.clone(), n: n.clone(), r, s: 0 });
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
  const B = { slender: { stride: 1.06, bob: 1.12, sway: 0.018 }, slim: { stride: 1.04, bob: 1.1, sway: 0.02 }, average: { stride: 1, bob: 1, sway: 0.03 }, broad: { stride: 0.97, bob: 0.95, sway: 0.04 },
    stout: { stride: 0.94, bob: 0.88, sway: 0.05 }, heavy: { stride: 0.9, bob: 0.82, sway: 0.065 } }[build] ?? { stride: 1, bob: 1, sway: 0.03 };
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

// The captured walks (lib.motion.walks, scripts/mocap/: CMU subjects' walking cycles) by their
// capture's description, and who they suit; the rest are plain walks anyone may have
const WALK_SUITS = [
  [/old man|elderly/, (p) => p.older],
  [/heavyset|strong man/, (p) => p.build === 'heavy' || p.build === 'stout' || p.build === 'broad'],
  [/lady|relaxed/, (p) => p.kind === 'f'],
  [/childish|teen/, (p) => p.child],
  [/rushed|fast/, () => false],   // (hurried: nobody strolls like that)
];

/**
 * A person's own captured walk (an entry of lib.motion.walks), or null to keep the library's:
 * one whose own pace is near theirs (so its cadence stays a walker's), suited to who they are
 * when there is one (an older walker, a heavy build, a woman, a child), seeded like the rest of
 * their gait (`rand`).
 * @param o.speed their walking speed (m/s); o.size their body's size against the clips' (legs)
 */
export function walkFor(walks, rand, { kind = 'm', build = 'average', size = 1, speed = 1.25, older = false } = {}) {
  if (!walks?.length) return null;
  const p = { kind, build, older, child: size < 0.8 };
  const fit = walks.filter((w) => { const r = speed / (w.speed * size); return r > 0.8 && r < 1.25; });
  const special = fit.filter((w) => WALK_SUITS.some(([re, ok]) => re.test(w.desc) && ok(p)));
  const plain = fit.filter((w) => !WALK_SUITS.some(([re]) => re.test(w.desc)));
  const pick = rand(), keep = rand(), which = rand();
  const pool = special.length && pick < 0.7 ? special : plain;
  if (!pool.length || keep < 0.12) return null;   // (now and then the library's own walk, too)
  return pool[Math.floor(which * pool.length) % pool.length];
}

/** Lay a person's gait style over the rig (after Animator.apply): k = how much they're walking (0..1). */
export function poseStyle(char, G, phase, k, still = 1 - k) {
  const { body, torso, head } = char;
  if (G.sway) body.quaternion.multiply(_q.setFromAxisAngle(_z, Math.sin(phase * Math.PI * 2) * G.sway * k));
  const pitch = G.lean * k + G.stoop * still;
  if (pitch) torso.quaternion.premultiply(_q.setFromAxisAngle(_x, pitch));
  if (G.chin) head.quaternion.multiply(_q.setFromAxisAngle(_x, G.chin - pitch * 0.5));
}
