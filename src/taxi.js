import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// A flying taxi (John Difool drives one in L'Incal). Modes:
//   lane    follows its circular traffic lane (set by the level)
//   hail    flies to where the player whistled, then parks
//   parked  hovers in place, waiting
//   driven  W/S throttle, A/D steer, Space up, Shift down
// Taxis are excluded from the static collision (they move), but collide with
// the level themselves while driven.

const MAX = 40;
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

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
  grp.userData.noCollide = true;
  return grp;
}

export class Taxi {
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
    if (input && this.mode === 'driven') this.drive(dt, input);
    else if (this.mode === 'lane') this.lane(t, this);
    else if (this.mode === 'hail') this.flyToTarget(dt);
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
    const throttle = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
    const steer = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
    const lift = (input.Space ? 1 : 0) - (input.ShiftLeft || input.ShiftRight ? 1 : 0);

    if (throttle > 0) this.speed += (MAX - this.speed) * (1 - Math.exp(-0.8 * dt));
    else if (throttle < 0) this.speed = Math.max(this.speed - 30 * dt, -10);
    else this.speed *= Math.exp(-0.6 * dt);

    this.yawRate += (-steer * 1.5 - this.yawRate) * (1 - Math.exp(-5 * dt));
    this.heading += this.yawRate * dt;
    this.vy += (lift * 14 - this.vy) * (1 - Math.exp(-3 * dt));

    const [fx, fz] = this.forward;
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    this.pos.y += this.vy * dt;

    if (this.physics.pushCapsule(this.pos, 1.1 * s, -0.6 * s, 0.9 * s, this._push)) {
      if (Math.hypot(this._push.x, this._push.z) > 0.02) this.speed *= 0.7;
      if (this._push.y < 0 && this.vy > 0) this.vy = 0;
    }
    const g = this.physics.groundAt(this.pos.x, this.pos.y, this.pos.z);
    const minY = g + 0.7 * s;
    if (this.pos.y < minY) { this.pos.y = minY; this.vy = Math.max(this.vy, 0); }

    const k = 1 - Math.exp(-5 * dt);
    this.bank += (THREE.MathUtils.clamp(-this.yawRate * this.speed * 0.02, -0.5, 0.5) - this.bank) * k;
    this.pitch += (THREE.MathUtils.clamp(-this.vy * 0.025, -0.3, 0.3) - this.pitch) * k;
  }
}
