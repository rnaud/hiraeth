import * as THREE from 'three';

// The ember wisp's fireball (issue #398; docs/systems/foes.md, "The ember wisp's fireball"): a slow ball of fire
// thrown from out of reach that homes gently at the traveller, and that a cut timed as it arrives sends back along
// the line to its thrower, faster; hit by its own fire, the wisp is stunned and drops low enough to cut. Pure logic
// over plain vectors (tested in node: tests/fireball.test.js); src/foes.js Foes throws, draws and answers them.
//
//   speed  m/s it flies out (slow: it can be read and met); gentle: × gentle
//   turn   rad/s its flight turns toward you at most (gentle homing: a run across its line still makes it curve, a
//          step aside at the last moment does not, since it stops homing inside `near`)
//   near   m from your chest inside which it flies straight on (the last stretch is yours to time)
//   hit    m from your chest it lands (burns, unless guarded or sent back)
//   reach  m from your chest inside which a cut that is cutting (the blade's active frames) sends it back: from about
//          a quarter of a second before it lands, with the cut's own active frames on top (the forgiving window)
//   front  cos of the half-angle in front of you it must be in for a cut to meet it (75°)
//   back   m/s it flies back at its thrower, straight (no dodging its own fire)
//   life   s it flies before it burns out (a missed ball flies on past you and fizzles)
//   damage hearts it burns you for (an ordinary blow); returned: the harm it does its thrower; stun: s its thrower is
//          stunned (down low, a cut lands double: src/foes.js Foe.hit)
//   chest  m over your feet it aims at
export const FIREBALL = { speed: 6.5, turn: 1.1, near: 2.6, hit: 0.75, reach: 2.4, front: 0.26, back: 15, life: 6, damage: 0.5, returned: 1.5, stun: 3.2, chest: 1.1, gentle: 0.8 };

const _d = new THREE.Vector3(), _c = new THREE.Vector3();

/** Where it aims at the traveller: his chest. */
export const aimAt = (P, out = new THREE.Vector3(), B = FIREBALL) => out.set(P.pos.x, P.pos.y + B.chest, P.pos.z);

/**
 * Is a ball at `pos` within a cut's reach of the traveller standing at `feet`, facing `heading` (rad)? In front of him
 * (FIREBALL.front) and inside FIREBALL.reach of his chest: the deflect window's test.
 */
export function catchable(pos, feet, heading, B = FIREBALL) {
  _c.set(feet.x, feet.y + B.chest, feet.z);
  const d = pos.distanceTo(_c);
  if (d > B.reach) return false;
  if (d < 0.3) return true;
  const fx = Math.sin(heading), fz = Math.cos(heading), dx = pos.x - _c.x, dz = pos.z - _c.z, l = Math.hypot(dx, dz);
  return l < 0.3 || (dx * fx + dz * fz) / l >= B.front;
}

export class Fireball {
  /** Thrown by `owner` (a Foe) from `from` at `to` (its aim), at `k` × its speed (Gentle slower). */
  constructor(owner, from, to, B = FIREBALL, k = 1) {
    this.B = B; this.owner = owner; this.pos = from.clone(); this.prev = from.clone();
    this.speed = B.speed * k; this.t = 0;
    this.state = 'out';   // 'out' at you; 'back' at its thrower; 'past' missed you, flying on; 'gone'
    this.vel = _d.subVectors(to, from).normalize().multiplyScalar(this.speed).clone();
    this.returned = 0;    // how many times it has been sent back (a cut, a perfect parry)
  }
  get dir() { return _d.copy(this.vel).normalize(); }

  /**
   * One step of its flight toward `target` (out: your chest; back: its thrower's chest). Returns what happened: null,
   * 'arrive' (at you), 'struck' (its thrower, sent back), 'fizzle' (burnt out, or its thrower gone).
   */
  step(dt, target) {
    if (this.state === 'gone') return null;
    const B = this.B;
    this.t += dt; this.prev.copy(this.pos);
    if (this.t > B.life) return 'fizzle';
    if (this.state === 'back') {
      if (!this.owner?.alive || this.owner.dead !== undefined) return 'fizzle';
      _c.subVectors(target, this.pos);
      const d = _c.length(), reach = (this.owner.def?.radius ?? 0.6) + 0.35;
      if (d <= reach) return 'struck';
      _c.divideScalar(Math.max(d, 1e-6));
      this.vel.copy(_c).multiplyScalar(B.back);
      this.pos.addScaledVector(_c, Math.min(d, B.back * dt));
      return this.pos.distanceTo(target) <= reach ? 'struck' : null;
    }
    if (this.state === 'out') {
      _c.subVectors(target, this.pos);
      const d = _c.length();
      if (d <= B.hit) return 'arrive';
      if (d > B.near) this.steer(_c.divideScalar(d), B.turn * dt);
    }
    this.pos.addScaledVector(this.vel, dt);
    if (this.state === 'out' && this.pos.distanceTo(target) <= B.hit) return 'arrive';
    return null;
  }

  /** Its flight turned toward unit direction `want` by at most `max` rad (gentle homing). */
  steer(want, max) {
    const cur = _d.copy(this.vel).normalize(), dot = THREE.MathUtils.clamp(cur.dot(want), -1, 1), ang = Math.acos(dot);
    if (ang < 1e-5) return;
    const k = Math.min(1, max / ang);
    cur.lerp(want, k).normalize();
    this.vel.copy(cur).multiplyScalar(this.speed);
  }

  /** Sent back (a cut, a perfect parry): at its thrower, faster, along the line. False if it is not on its way to you. */
  deflect() {
    if (this.state !== 'out' || !this.owner?.alive) return false;
    this.state = 'back'; this.t = 0; this.returned++;
    this.vel.subVectors(this.owner.chest, this.pos).normalize().multiplyScalar(this.B.back);
    return true;
  }
  /** It missed you (an evade): it flies on, straight, and burns out. */
  pass() { if (this.state === 'out') this.state = 'past'; }
}
