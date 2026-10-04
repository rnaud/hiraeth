import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { sweepCapsule, unbury } from './physics.js';
import { padRide } from './controller.js';

// A flying taxi (the City-Shaft's cabs). Modes:
//   lane    follows its circular traffic lane (set by the level)
//   hail    flies to where the player whistled, then parks
//   parked  hovers in place, waiting
//   driven  W/S throttle, A/D steer, Space up, Shift down; a controller: RT throttle,
//           LT brake, the stick steers and tilts (back: up, forward: down), the bottom button up
// Taxis are excluded from the static collision (they move), but collide with
// the level themselves while driven.

const MAX = 40;
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3(), _from = new THREE.Vector3();

function buildTaxi(color) {
  const g = mergeGeometries([
    new THREE.BoxGeometry(1.7, 1.0, 3.4),
    new THREE.ConeGeometry(0.8, 1.4, 6).rotateX(Math.PI / 2).translate(0, 0, 2.3),
    new THREE.BoxGeometry(2.8, 0.25, 1.0).translate(0, -0.2, -0.9),
    new THREE.BoxGeometry(0.15, 0.7, 0.7).translate(0, 0.75, -1.45),
  ]);
  const body = new THREE.Mesh(g, makeMaterial({ color, flat: true }));
  // open cab: windshield dome in front of the driver
  const shield = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), makeMaterial({ color: '#f3ead8' }));
  shield.scale.set(1, 0.7, 0.8);
  shield.position.set(0, 0.5, 0.95);
  const grp = new THREE.Group();
  grp.add(body, shield);
  // a passenger in the back seat, hat and all (a driver of the player's ride sits in front)
  if (Math.random() < 0.6) {
    const coat = ['#c8483a', '#5fb7ad', '#d8a24a', '#8a6fb8', '#f3ead8'][Math.floor(Math.random() * 5)];
    const pax = new THREE.Group();
    pax.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.45, 3, 8).translate(0, 0.55, 0), makeMaterial({ color: coat })));
    pax.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8).translate(0, 1.15, 0.02), makeMaterial({ color: '#e9cfb4' })));
    if (Math.random() < 0.6) {
      pax.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 14).translate(0, 1.27, 0), makeMaterial({ color: coat })));
      pax.add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 10).translate(0, 1.47, 0), makeMaterial({ color: coat })));
    }
    pax.position.set(0, 0.2, -0.95);
    grp.add(pax);
  }
  grp.userData.noCollide = true;
  return grp;
}

export class Taxi {
  // set by the level each frame so idle taxis don't leave while you're beside them
  static playerPos = null;

  /**
   * @param lane  (t, taxi) => void, writes taxi.pos / heading / bank / pitch
   */
  constructor(physics, color, scale, lane) {
    this.physics = physics;
    this.kind = 'taxi';
    this.object = buildTaxi(color);
    this.scale = scale;
    this.object.scale.setScalar(scale);
    this.lane = lane;
    this.mode = 'lane';
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.yawRate = 0;
    this.vy = 0;
    this.bank = 0;
    this.pitch = 0;
    this.boardDistance = 3 + 2.2 * scale;
    this.exitOffset = 1.6 * scale;
    this._push = new THREE.Vector3();
    this._prev = new THREE.Vector3();
  }

  get forward() {
    return [Math.sin(this.heading), Math.cos(this.heading)];
  }

  hail(playerPos, playerHeading) {
    if (this.mode === 'driven') return;
    // stop beside the player, slightly above, facing the same way
    const fx = Math.sin(playerHeading), fz = Math.cos(playerHeading);
    this.target = new THREE.Vector3(playerPos.x + fz * 4 + fx * 3, playerPos.y + 1.2 * this.scale, playerPos.z - fx * 4 + fz * 3);
    this.targetHeading = playerHeading;
    this.mode = 'hail';
  }

  board() {
    this.mode = 'driven';
    this.speed = 0;
  }

  leave() {
    this.mode = 'parked';
    this.parkY = this.pos.y;
  }

  seatTransform(pos, quat) {
    const s = this.scale;
    _v.set(0, 0.5 - 0.6 / s, -0.25); // driver's feet, in taxi-local units
    pos.copy(_v).applyMatrix4(this.object.matrixWorld);
    quat.copy(this.object.quaternion);
  }

  update(dt, input, t) {
    this._prev.copy(this.pos);
    if (this.mode === 'parked') this.idle += dt; else this.idle = 0;
    // left parked long enough with nobody nearby: fly back into traffic
    const near = Taxi.playerPos && Taxi.playerPos.distanceTo(this.pos) < 25;
    if (this.mode === 'parked' && this.idle > 30 && !near) this.mode = 'return';
    if (input && this.mode === 'driven') this.drive(dt, input);
    else if (this.mode === 'lane') this.lane(t, this);
    else if (this.mode === 'hail') this.flyToTarget(dt);
    else if (this.mode === 'return') this.returnToLane(dt, t);
    else {
      // parked: hover in place
      this.speed *= Math.exp(-2 * dt);
      this.bank *= Math.exp(-3 * dt);
      this.pitch *= Math.exp(-3 * dt);
      this.pos.y = (this.parkY ?? this.pos.y) + Math.sin(t * 1.3) * 0.15;
    }
    if (dt > 0) this.vel.subVectors(this.pos, this._prev).divideScalar(dt);
    this.object.position.copy(this.pos);
    this.object.rotation.set(this.pitch, this.heading, this.bank, 'YXZ');
    this.object.updateMatrixWorld();
  }

  /** Chase where the lane would put us now; rejoin traffic when caught up. */
  returnToLane(dt, t) {
    const ghost = this._ghost ??= { pos: new THREE.Vector3(), heading: 0, bank: 0, pitch: 0 };
    this.lane(t, ghost);
    _v.subVectors(ghost.pos, this.pos);
    const d = _v.length();
    if (d < 2) { this.mode = 'lane'; return; }
    this.pos.addScaledVector(_v.normalize(), Math.min(Math.max(30, d * 0.8) * dt, d));
    let dh = (d > 20 ? Math.atan2(_v.x, _v.z) : ghost.heading) - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * (1 - Math.exp(-3 * dt));
    this.bank = THREE.MathUtils.clamp(-dh * 0.6, -0.4, 0.4);
    this.pitch = -_v.y * 0.3;
  }

  /** Solid volume for characters: a vertical cylinder, roof on top. */
  get solid() {
    const s = this.scale;
    return { pos: this.pos, vel: this.vel, r: 1.45 * s, top: this.pos.y + 0.55 * s, bottom: this.pos.y - 0.6 * s };
  }

  flyToTarget(dt) {
    _v.subVectors(this.target, this.pos);
    const d = _v.length();
    if (d < 0.6) {
      this.mode = 'parked';
      this.parkY = this.target.y;
      return;
    }
    const sp = Math.min(45, d * 1.2 + 4);
    this.pos.addScaledVector(_v.normalize(), Math.min(sp * dt, d));
    // face the direction of travel, turning to the player's heading on arrival
    const want = d > 15 ? Math.atan2(_v.x, _v.z) : this.targetHeading;
    let dh = want - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * (1 - Math.exp(-3 * dt));
    this.bank = THREE.MathUtils.clamp(-dh * 0.6, -0.4, 0.4);
    this.pitch = -_v.y * 0.3;
  }

  drive(dt, input) {
    const s = this.scale;
    let throttle = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
    let steer = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
    let lift = (input.Space ? 1 : 0) - (input.ShiftLeft || input.ShiftRight ? 1 : 0);
    const pad = padRide(input);
    if (pad) {
      throttle = THREE.MathUtils.clamp(throttle + pad.throttle - pad.brake, -1, 1);
      if (pad.x) steer = pad.x;
      lift = THREE.MathUtils.clamp(lift - pad.y, -1, 1);   // pull back to climb
    }

    if (throttle > 0) this.speed += (MAX * throttle - this.speed) * (1 - Math.exp(-0.8 * dt));
    else if (throttle < 0) this.speed = Math.max(this.speed + 30 * throttle * dt, -10);
    else this.speed *= Math.exp(-0.6 * dt);

    this.yawRate += (-steer * 1.5 - this.yawRate) * (1 - Math.exp(-5 * dt));
    this.heading += this.yawRate * dt;
    this.vy += (lift * 14 - this.vy) * (1 - Math.exp(-3 * dt));

    const [fx, fz] = this.forward;
    const from = _from.copy(this.pos);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    this.pos.y += this.vy * dt;

    // swept, so full throttle in a slow frame can't jump through a tower
    if (sweepCapsule(this.physics, this.pos, from, 1.1 * s, -0.6 * s, 0.9 * s, this._push)) {
      if (Math.hypot(this._push.x, this._push.z) > 0.02) this.speed *= 0.7;
      if (this._push.y < 0 && this.vy > 0) this.vy = 0;
    }
    if (this.physics.embedded?.(this.pos)) { unbury(this, from, 1.1 * s); this.vy = 0; }
    const g = this.physics.groundAt(this.pos.x, Math.max(from.y, this.pos.y), this.pos.z);
    const minY = g + 0.7 * s;
    if (this.pos.y < minY) { this.pos.y = minY; this.vy = Math.max(this.vy, 0); }

    const k = 1 - Math.exp(-5 * dt);
    this.bank += (THREE.MathUtils.clamp(-this.yawRate * this.speed * 0.02, -0.5, 0.5) - this.bank) * k;
    this.pitch += (THREE.MathUtils.clamp(-this.vy * 0.025, -0.3, 0.3) - this.pitch) * k;
  }
}
