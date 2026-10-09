import * as THREE from 'three';
import { twoBone, aim } from './ik.js';
import { GaitPlanner } from './gait.js';
import { BodyFromFeet } from './body.js';
import { PoseBlend } from './pose.js';
import { poleFor } from './plans.js';

// The rig: binds a model's joints by role to the kit (docs/systems/procedural-animation.md, "The kit") and runs
// it once a frame per foe. The mind (src/foes.js Foe) only moves f.pos and f.heading; the rig follows them:
//
//   1. the pose blend reads the foe's state (wind / strike / recover: src/motion-kit/pose.js) and tells the
//      planner to brace and lock through a wind-up
//   2. the gait planner steps the feet (src/motion-kit/gait.js), one ground ray per step
//   3. the body rides on the feet (src/motion-kit/body.js); the model adds the pose and its own wind-up moves
//   4. write(): each leg's chain is solved by two-bone IK (src/motion-kit/ik.js) from the hip on the drawn body
//      to its planted foot, and its segments are aimed joint to joint
//
// Detail tiers by distance (held 30 frames before a change, so nothing flickers between them):
//   near (≤ 25 m)  everything, every frame
//   mid  (≤ 60 m)  the planner every 2nd frame (with the time of both), IK every frame
//   far            the canned cycle by distance walked (no planning, no rays; still never skates)
// An optional stepped clock (`stepped: 12`, fps, phase-offset per foe; off by default) shows the pose only on
// its ticks for the ink look (docs/systems/procedural-animation.md, "The Moebius ink look"): the kit still runs
// every frame.

export const TIERS = { near: 25, mid: 60, hold: 30 };
const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _hip = new THREE.Vector3(), _foot = new THREE.Vector3(), _knee = new THREE.Vector3(), _end = new THREE.Vector3(), _pole = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

/** The tier for a distance, held: a change waits `hold` frames of asking for the same new tier. */
export class TierHold {
  constructor(hold = TIERS.hold) { this.hold = hold; this.tier = 'near'; this.want = 'near'; this.n = 0; }
  static of(d) { return d <= TIERS.near ? 'near' : d <= TIERS.mid ? 'mid' : 'far'; }
  update(distance) {
    const t = TierHold.of(distance);
    if (t === this.tier) { this.want = t; this.n = 0; return this.tier; }
    if (t !== this.want) { this.want = t; this.n = 0; }
    if (++this.n >= this.hold) { this.tier = t; this.n = 0; }
    return this.tier;
  }
}

/** obj's matrix in the frame of `ancestor` (its local matrices multiplied up to it). */
export function matrixTo(obj, ancestor, out) {
  out.identity();
  for (let o = obj; o && o !== ancestor; o = o.parent) { o.updateMatrix(); out.premultiply(o.matrix); }
  return out;
}

/**
 * Build a jointed leg: a hip pivot on the body and a chain (thigh, shin, foot) hung from the model's root group,
 * so the feet can stay planted while the body moves. Segments are modelled along +Y from their joint and aimed
 * joint to joint each frame. Options:
 *   group, body     the model's root and its body (the hip's parent; may be nested inside the body)
 *   hip             where the leg hangs from, in its parent's frame (Vector3-like)
 *   foot            the foot's rest spot on the ground, in the group's frame (y 0)
 *   lenA, lenB      thigh and shin lengths (group units); pole: the side the knee bends to, in the body's frame
 *   radius, mats    { joint, thigh, shin, foot } materials; pad: 'pad' | 'disc' | 'point'; ankle: pad height
 *   piston          { at } (body frame): a telescoping rod from the body to the thigh's middle (machines)
 *   air             where the foot hangs when the body is off the ground ({x, y, z} added to its rest, body frame)
 */
export function jointedLeg({ group, body, hipParent = body, hip, foot, lenA, lenB, pole, radius = 0.05, mats, pad = 'pad', ankle = null, piston = null, air = null, name = 'leg' }) {
  const H = new THREE.Object3D(); H.name = `${name} hip`; H.position.set(hip.x, hip.y, hip.z); hipParent.add(H);
  const root = new THREE.Group(); root.name = name; group.add(root);
  const r = radius, j = mats.joint ?? mats.thigh;
  const seg = (len, r0, r1, mat, ball) => {
    const g = new THREE.Group(); root.add(g);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 7).translate(0, len / 2, 0), mat); g.add(m);
    if (ball) g.add(new THREE.Mesh(new THREE.SphereGeometry(ball, 8, 6), j));
    return g;
  };
  const thigh = seg(lenA, r, r * 0.85, mats.thigh ?? j, r * 1.45);
  const shin = seg(lenB, r * 0.85, r * 0.6, mats.shin ?? j, r * 1.35);
  const f = new THREE.Group(); root.add(f);
  const ah = ankle ?? (pad === 'point' ? r * 0.6 : pad === 'disc' ? r * 0.9 : r * 0.8);
  if (pad === 'disc') f.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 2.1, r * 2.4, ah * 1.4, 10).translate(0, ah * 0.7, 0), mats.foot ?? j));
  else if (pad === 'point') f.add(new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, ah * 2, 6).rotateX(Math.PI).translate(0, ah, 0), mats.foot ?? j));
  else f.add(new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6).scale(r * 1.5, ah, r * 2.4).translate(0, ah, r * 0.6), mats.foot ?? j));
  let sleeve = null, rod = null;
  if (piston) {
    sleeve = seg(lenA * 0.55, r * 0.75, r * 0.75, mats.piston ?? j, 0);
    rod = seg(lenA * 0.6, r * 0.38, r * 0.38, mats.rod ?? mats.shin ?? j, 0);
  }
  return {
    hip: H, root, thigh, shin, foot: f, lenA, lenB, ankle: ah,
    pole: new THREE.Vector3(pole.x, pole.y, pole.z).normalize(),
    home: new THREE.Vector3(foot.x, 0, foot.z),
    piston: piston ? new THREE.Vector3(piston.at.x, piston.at.y, piston.at.z) : null, sleeve, rod,
    air: air ? new THREE.Vector3(air.x, air.y, air.z) : new THREE.Vector3(),
    restBody: null,   // (the foot's rest in the body's frame, for hanging feet: set by the rig)
  };
}

/**
 * A jointedLeg sized by a body plan: the thigh and shin are the plan's shares (knee.lenA, knee.lenB) of the
 * distance from the hip (in the group's frame, through any scaled or nested parents) to the foot's rest, and the
 * pole follows the plan's rule (knees out and up, hocks back…) unless given.
 */
export function planLeg(plan, o) {
  const m = matrixTo(o.hipParent ?? o.body, o.group, new THREE.Matrix4());
  const hip = new THREE.Vector3(o.hip.x, o.hip.y, o.hip.z).applyMatrix4(m);
  const r = o.radius ?? 0.05, ankle = o.ankle ?? (o.pad === 'point' ? r * 0.6 : o.pad === 'disc' ? r * 0.9 : r * 0.8);
  const d = hip.distanceTo(new THREE.Vector3(o.foot.x, ankle, o.foot.z));
  const lenA = d * plan.knee.lenA, lenB = d * plan.knee.lenB, L = lenA + lenB;
  const a = plan.air ? (o.foot.z >= 0 ? plan.air.front : plan.air.hind) : null;
  return jointedLeg({ ...o, ankle, lenA, lenB, pole: o.pole ?? poleFor(plan.knee.pole, o.foot), air: o.air ?? (a ? { x: 0, y: a.y * L, z: a.z * L } : null) });
}

let serial = 1;

export class Rig {
  /**
   * plan: a body plan (src/motion-kit/plans.js). group: the model's root (at the foe's feet, turned to its
   * heading); body: what rides on the feet; legs: jointedLeg bindings; scale: the group's scale (world m per
   * group unit). stepped: fps of the stepped clock (0: off).
   */
  constructor({ plan, group, body, legs, scale = 1, seed = serial++, stepped = plan.stepped ?? 0 }) {
    this.plan = plan; this.group = group; this.body = body; this.legs = legs; this.scale = scale;
    this.length = legs.reduce((s, l) => s + l.lenA + l.lenB, 0) / Math.max(1, legs.length) * scale;   // (a leg, m)
    const L = this.length, G = plan.gait;
    this.planner = new GaitPlanner({
      homes: legs.map((l) => ({ x: l.home.x * scale, y: 0, z: l.home.z * scale })),
      gait: typeof G.gait === 'function' ? G.gait(legs.length) : G.gait, drift: G.drift * L, stepTime: G.stepTime, height: G.height * L, arc: G.arc, seed,
      reach: G.reach ? G.reach * L : undefined,
    });
    const B = plan.body;
    this.bodyFeet = new BodyFromFeet({ bob: B.bob * L, lean: B.lean, bank: B.bank, sway: B.sway, tilt: B.tilt, spring: B.spring, height: B.height });
    const P = {};
    for (const [k, p] of Object.entries(plan.poses ?? {})) P[k] = { ...p, y: (p.y ?? 0) * L, z: (p.z ?? 0) * L };
    this.pose = new PoseBlend({ poses: P, style: plan.style });
    this.tiers = new TierHold();
    this.tier = 'near';
    this.frame = seed;   // (mid-tier foes take turns: not all on the same frame)
    this.acc = 0;
    this.prev = null; this.heading = 0;
    this.walked = 0;
    this.air = 0;
    this.stepped = stepped; this.clock = (seed * 0.137) % 1; this.tick = true;
    this.out = { y: 0, x: 0, z: 0, pitch: 0, roll: 0, yaw: 0 };
    this.shown = { ...this.out };
    this.vel = { x: 0, z: 0 };
    this.cost = 0;
    // the feet's rest in the body's frame: where they hang when it leaves the ground
    this.group.updateMatrixWorld(true);
    for (const l of legs) {
      matrixTo(this.body, this.group, _m);
      l.restBody = new THREE.Vector3(l.home.x, l.ankle, l.home.z).applyMatrix4(_inv.copy(_m).invert());
    }
  }

  /**
   * One frame of planning. f: the foe ({ pos, heading, state, k, atk, stunned }); ctx: { eye (where the camera
   * or the player is), ground(x, fromY, z), air (0..1: off the ground: tucked or hanging), recovery, touch(at) }.
   * Returns the body's offsets { y, x, z, pitch, roll, yaw } for the model to draw (with its own moves on top).
   */
  update(f, dt, ctx = {}) {
    const p = f.pos;
    if (!this.prev) { this.prev = p.clone(); this.heading = f.heading; }
    if (dt > 0) {
      const vx = (p.x - this.prev.x) / dt, vz = (p.z - this.prev.z) / dt;
      // (a jump of more than 3 m in a frame is a teleport, not a walk: replant)
      if (Math.hypot(p.x - this.prev.x, p.z - this.prev.z) > 3) { this.planner.ready = false; this.vel.x = this.vel.z = 0; }
      else { this.vel.x = vx; this.vel.z = vz; this.walked += Math.hypot(p.x - this.prev.x, p.z - this.prev.z); }
    }
    this.prev.copy(p);
    this.tier = ctx.eye ? this.tiers.update(Math.hypot(ctx.eye.x - p.x, ctx.eye.z - p.z)) : 'near';
    const pose = this.pose.update(dt, { state: f.state, k: f.k, atk: f.atk, recovery: ctx.recovery, stunned: f.stunned });
    this.planner.setStance(pose.lock, pose.spread);
    const air = ctx.air ?? 0;
    if (air > 0.01) { this.air = air; this.planner.ready = false; }
    else if (this.air > 0) { this.air = 0; this.planner.ready = false; }
    else if (this.tier === 'far') this.planner.canned(p, f.heading, this.walked, this.plan.gait.duty ?? 0.6);
    else {
      this.acc += dt;
      if (this.tier === 'near' || ++this.frame % 2 === 0) {
        const ev = this.planner.update(this.acc, p, f.heading, this.vel, ctx.ground);
        this.acc = 0;
        if (ev.length && ctx.touch) for (const e of ev) ctx.touch(e.at, this.length, e.leg);
      }
    }
    const b = this.bodyFeet.update(dt, this.planner, p, f.heading, this.vel);
    const o = this.out;
    o.y = b.y + pose.y; o.x = b.x; o.z = pose.z; o.pitch = b.pitch + pose.pitch; o.roll = b.roll + pose.roll; o.yaw = pose.yaw;
    // the stepped clock: the pose shown only on its ticks
    if (this.stepped > 0) {
      this.clock += dt * this.stepped;
      this.tick = this.clock >= 1;
      if (this.tick) { this.clock %= 1; Object.assign(this.shown, o); }
      return this.shown;
    }
    this.tick = true;
    return o;
  }

  /** The planted (or swinging) foot of leg i in the world. */
  footOf(i) { return this.planner.feet[i].pos; }

  /**
   * Solve and draw the legs, once the model has placed its body for this frame (call last: after the group and
   * the body are where they will be drawn). Off the ground (ctx.air), the feet hang from the body (tucked by
   * `air`). Skipped between the stepped clock's ticks.
   */
  write() {
    if (!this.tick) return;
    const g = this.group;
    g.updateMatrix();
    _inv.copy(g.matrix).invert();
    const bodyM = matrixTo(this.body, g, _m);
    bodyM.decompose(_a, _q, _s);
    const air = this.air;
    for (let i = 0; i < this.legs.length; i++) {
      const L = this.legs[i];
      matrixTo(L.hip, g, _m2);
      _hip.setFromMatrixPosition(_m2);
      _pole.copy(L.pole).applyQuaternion(_q);
      // the foot: planted in the world (into the group's frame), or hanging from the body
      _foot.copy(this.planner.feet[i].pos).applyMatrix4(_inv);
      _foot.y += L.ankle;
      if (air > 0) {
        _b.copy(L.restBody).add(L.air).applyMatrix4(bodyM);
        _b.lerp(_hip, Math.max(0, air - 1) * 0.6);   // (air above 1: tucked up under the body)
        _foot.lerp(_b, Math.min(1, air));
      }
      twoBone(_hip, _foot, L.lenA, L.lenB, _pole, _knee, _end);
      L.root.position.copy(_hip);
      _knee.sub(_hip); _end.sub(_hip);
      aim(L.thigh, _zero, _knee);
      aim(L.shin, _knee, _end);
      L.foot.position.copy(_end); L.foot.position.y -= L.ankle;
      if (L.piston) {
        // a telescoping rod: the sleeve from the body's anchor, the rod from the thigh's middle, each aimed at the other
        _a.copy(L.piston).applyMatrix4(bodyM).sub(_hip);
        _b.copy(_knee).multiplyScalar(0.5);
        aim(L.sleeve, _a, _b);
        aim(L.rod, _b, _a);
      }
    }
  }

  /** Show or hide the legs with the body (a shadow that sinks, a buried foe). */
  set visible(v) { for (const l of this.legs) l.root.visible = v; }
}
const _m2 = new THREE.Matrix4(), _zero = new THREE.Vector3();
