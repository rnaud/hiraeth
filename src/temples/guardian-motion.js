import * as THREE from 'three';
import { Rig, planLeg } from '../motion-kit/rig.js';
import { SecondOrderAngle } from '../motion-kit/spring.js';
import { makeMaterial } from '../materials.js';

// The temple guardians on the locomotion kit (kit phase 6: docs/systems/procedural-animation.md, "Phase 6, the
// guardians"; the models are src/temples/guardians.js). The fight (src/temples/boss.js) still only moves the model's
// `pos` and `heading` and tells it its state; the model asks its kit for the body's offsets and draws its legs last.
//
//   tellFrame(group)      the model's own frame for the fight's generic wind-up motions (boss.js poseRig): its body goes
//                         in it, its legs stay out (planted on the floor while the body rears, crouches, coils, swells)
//   GuardianLegs          a Rig (src/motion-kit/rig.js) on a guardian's plan (src/motion-kit/plans.js GUARDIAN_PLANS):
//                         update(M, dt, opts, { air }) → the body's offsets; write() last, once the body is placed
//   TurnLag               a head or neck that lags the body's turns (a spring on the heading)
//   flatMats(key, colours)  plain printed materials for kit legs (the models' other parts are vertex-coloured)

let uid = 0;

/** Move a model's parts into a frame of their own (its `tellRig`), so legs built after it stay out of it. */
export function tellFrame(group) {
  const rig = new THREE.Group(); rig.name = 'tell rig';
  while (group.children.length) rig.add(group.children[0]);
  group.add(rig);
  return rig;
}

/** { name: colour } → { name: flat material } (printed flat, as the vertex-coloured parts are). */
export function flatMats(key, colours) {
  const out = {};
  for (const [k, c] of Object.entries(colours)) out[k] = makeMaterial({ color: c, flat: true, key: `guardian.${key}.${k}.${uid++}` });
  return out;
}

/** The fight's state in the kit's words (src/motion-kit/pose.js): wind, strike, recover, or at rest. */
export function kitState(out, M, { state, attack, k = 0 }) {
  const fight = state === 'fight' && !!attack;
  out.pos = M.pos; out.heading = M.heading;
  out.state = fight ? (k < 1 ? 'wind' : 'strike') : state === 'open' ? 'recover' : 'idle';
  out.k = Math.min(1, k);
  out.atk = fight ? (out._atk ??= {}) : null;
  if (out.atk) { out.atk.id = attack.id; out.atk.lunge = !!(attack.dash || attack.over); }
  out.stunned = 0;
  return out;
}

export class GuardianLegs {
  /**
   * plan: GUARDIAN_PLANS entry; group, body: the model's root and what rides on the legs; legs: planLeg options
   * (hip in the body's frame, foot: the rest spot on the floor in the group's frame, radius, pad, mats, pole…).
   */
  constructor({ plan, group, body, legs, seed }) {
    this.plan = plan;
    this.legs = legs.map((o, i) => planLeg(plan, { group, body, name: `guardian leg ${i}`, ...o }));
    this.rig = new Rig({ plan, group, body, legs: this.legs, seed });
    this.f = {};
    this.ctx = {};
  }
  /** One frame: the body's offsets { y, x, z, pitch, roll, yaw }. extra.air: off the floor (1 hanging, above 1 tucked). */
  update(M, dt, opts, extra = {}) {
    const f = kitState(this.f, M, opts), c = this.ctx, a = opts.attack, kit = opts.kit ?? {};
    c.eye = kit.eye; c.ground = kit.ground; c.touch = kit.touch;
    c.air = extra.air ?? 0;
    c.recovery = opts.state === 'open' ? 1 : 0;
    // (still aiming: the feet may step round as it turns to you; then they brace and hold)
    c.free = f.state === 'wind' && (opts.k ?? 0) < (a?.track ?? 0.5);
    return this.rig.update(f, dt, c);
  }
  write() { this.rig.write(); }
  /** Leg i's foot in the world. */
  footAt(i, out) { return this.legs[i].foot.getWorldPosition(out); }
  get length() { return this.rig.length; }
}

/** A part that lags the body's turns: lag() is how far behind the heading it is (rad), on a soft spring. */
export class TurnLag {
  constructor(f = 1.2, z = 0.55) { this.s = new SecondOrderAngle(f, z, 0); this.first = true; }
  update(dt, heading) {
    if (this.first) { this.s.reset(heading); this.first = false; }
    const y = this.s.update(dt, heading);
    return Math.atan2(Math.sin(heading - y), Math.cos(heading - y));
  }
}
