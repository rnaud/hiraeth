import * as THREE from 'three';
import { Drone, DroneFold } from '../drone.js';

// Plumb in the prologue (issue #434): the drone asleep in its charging cradle in the cabin (src/ship/interior.js DOCK)
// while the ship orbits, and after the landing the beat where it wakes, blooms, lifts out of the cradle and comes to the
// traveller's shoulder at the hatch; then it rides at his shoulder down the ramp. The prologue's director
// (src/ship/cinematics.js) moves it; at the end it hands over to the scout (src/scout.js escort) where it is, so the
// drone that walked out with him is the one that speaks and flies off toward the village.
//
//   const bot = new PrologueDrone(scene)
//   bot.dock(worldPos, worldQuat)            asleep in its cradle (folded, eye shut)
//   bot.wake(t, dt, seat, shoulder, look)    the beat: t s into it (WAKE), from the cradle to the shoulder spot
//   bot.follow(dt, shoulder, look)           at the shoulder, keeping up with him
//   bot.hide()                               gone (handed over, or the prologue skipped)

/** The beat's timing (s into the prologue's 'drone' stage). */
export const WAKE = {
  lamp: 0.5,      // the cradle's ring flickers back on (the emergency power)
  eye: 1.0,       // the lens opens
  bloom: 1.6,     // the petals open, the rotors spin up
  lift: 2.3,      // it lifts out of the cup
  arrive: 4.1,    // at his shoulder
};
/**
 * Where it rides by him (m): his left, behind, over his head (src/scout.js APPEAR's spot, where the scout takes over);
 * `near`, the end of its beat at the hatch: by his right ear (the cradle's side, toward the camera in the cabin, which
 * sees the two together); it swings round to the left as the hatch opens.
 */
export const SHOULDER = { side: 0.55, back: 0.35, over: 0.5, head: 1.6, near: { side: -0.45, back: -0.15, over: 0.15 } };

const smooth = (t) => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const _f = new THREE.Vector3(), _l = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _o = new THREE.Vector3(), _a = new THREE.Vector3();

/** The shoulder spot by someone at `pos` facing `heading` (world, y up): a fresh or `out` Vector3. */
export function shoulderSpot(pos, heading, out = new THREE.Vector3(), near = false) {
  const fx = Math.sin(heading), fz = Math.cos(heading), S = near ? SHOULDER.near : SHOULDER;
  // (his left, y up: cross(up, forward) = (fz, 0, -fx), as the scout's appearSpot)
  return out.set(pos.x + fz * S.side - fx * S.back, pos.y + SHOULDER.head + S.over, pos.z - fx * S.side - fz * S.back);
}

export class PrologueDrone {
  constructor(scene) {
    this.drone = new Drone(); this.fold = new DroneFold();
    this.object = this.drone.object;
    this.object.name = 'plumb-prologue';
    this.object.userData.noCollide = true;
    scene?.add(this.object);
    this.from = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.t = 0;
    this.object.visible = false;
  }
  get position() { return this.object.position; }
  /** Asleep in its cradle: folded, its eye shut, sitting in the cup. */
  dock(pos, quat) {
    this.object.visible = true;
    this.object.position.copy(pos); if (quat) this.object.quaternion.copy(quat);
    this.from.copy(pos); this.vel.set(0, 0, 0);
    this.fold.snap(false); this.fold.eye = 0; this.drone.pose(this.fold);
  }
  /**
   * The beat: `t` s in. Asleep, then the eye, the bloom, a little hop out of the cup and a curve over to `shoulder`
   * (world), facing `look` (world) once it is there.
   */
  wake(t, dt, seat, shoulder, look) {
    this.object.visible = true;
    const awake = t >= WAKE.eye, open = t >= WAKE.bloom;
    this.fold.update(dt, open, awake);
    if (t < WAKE.lift) {
      // in the cup: a shiver as the rotors spin up
      this.object.position.copy(seat);
      if (open) this.object.position.y += Math.sin(t * 40) * 0.002 * smooth((t - WAKE.bloom) / 0.4);
      this.from.copy(seat);
    } else {
      // out of the cup (straight up first), then over to the shoulder in an arc, easing in
      const k = smooth((t - WAKE.lift) / (WAKE.arrive - WAKE.lift));
      const hop = Math.min(1, (t - WAKE.lift) / 0.5);
      _a.copy(seat).lerp(shoulder, k);
      _a.y = THREE.MathUtils.lerp(seat.y, shoulder.y, k) + Math.sin(Math.PI * k) * 0.2 + (1 - k) * 0.12 * smooth(hop);
      const prev = _o.copy(this.object.position);
      this.object.position.copy(_a);
      if (dt > 0) this.vel.subVectors(_a, prev).divideScalar(dt);
    }
    // facing: out of the cup, the way it flies; then at what it looks at
    const k = smooth((t - WAKE.lift - 0.6) / 1.2);
    this.face(t < WAKE.lift ? null : _f.subVectors(shoulder, seat).lerp(_l.subVectors(look, this.object.position), k), dt);
    this.drone.pose(this.fold, dt, null);
  }
  /** At his shoulder (world), keeping up: a damped follow, a little bob, facing `look`. */
  follow(dt, shoulder, look) {
    this.object.visible = true;
    this.fold.update(dt, true, true);
    if (dt > 0) {
      this.t += dt;
      const want = _a.copy(shoulder); want.y += Math.sin(this.t * 2.6) * 0.04;
      const p = this.object.position;
      // a critically damped spring (no overshoot): it keeps pace without lagging far
      const w = 7, x = _o.subVectors(p, want);
      const acc = _l.copy(x).multiplyScalar(-w * w).addScaledVector(this.vel, -2 * w);
      this.vel.addScaledVector(acc, dt);
      p.addScaledVector(this.vel, dt);
    }
    this.face(_f.subVectors(look, this.object.position), dt);
    this.drone.pose(this.fold, dt, null);
  }
  /** Turn smoothly to face along `dir` (level), or keep the way it faces (null). */
  face(dir, dt) {
    if (!dir) return;
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) return;
    _m.lookAt(_o.set(0, 0, 0), dir.normalize().negate(), _l.set(0, 1, 0));
    _q.setFromRotationMatrix(_m);
    this.object.quaternion.slerp(_q, dt > 0 ? 1 - Math.exp(-6 * dt) : 1);
  }
  hide() { this.object.visible = false; }
  dispose() { this.object.removeFromParent(); }
}
