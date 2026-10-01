import * as THREE from 'three';
import { makeMaterial } from './materials.js';

const RADIUS = 0.45;
const STEP = 0.6;    // obstacles lower than this are stepped onto
const HEIGHT = 2.2;
const WALK = 9;
const RUN = 22;
const GRAVITY = 32;
const JUMP = 13;
const LIMIT = 1900;
const JET_THRUST = 54;     // m/s² upward while thrusting (gravity is 32)
const JET_MAX_UP = 15;
const JET_DRAIN = 0.2;     // fuel per second
const JET_REFILL = 0.55;

function part(geo, color, opts = {}) {
  return new THREE.Mesh(geo, makeMaterial({ color, ...opts }));
}

// A small masked wanderer with a big hat and a long scarf.
function buildCharacter() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.95, 0);
    const leg = part(new THREE.CylinderGeometry(0.11, 0.09, 0.95, 6), '#34405e');
    leg.position.y = -0.47;
    const boot = part(new THREE.BoxGeometry(0.2, 0.14, 0.32), '#7a4a35');
    boot.position.set(0, -0.92, 0.06);
    pivot.add(leg, boot);
    body.add(pivot);
    legs.push(pivot);
  }

  const robe = part(new THREE.CylinderGeometry(0.27, 0.46, 0.95, 9), '#efe3c6');
  robe.position.y = 1.35;
  const belt = part(new THREE.CylinderGeometry(0.3, 0.33, 0.12, 9), '#d9643a');
  belt.position.y = 1.12;
  const shoulders = part(new THREE.SphereGeometry(0.33, 10, 6), '#efe3c6');
  shoulders.scale.set(1.15, 0.55, 0.85);
  shoulders.position.y = 1.8;

  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.38, 1.78, 0);
    const arm = part(new THREE.CylinderGeometry(0.08, 0.07, 0.75, 6), '#efe3c6');
    arm.position.y = -0.36;
    const hand = part(new THREE.SphereGeometry(0.09, 6, 4), '#34405e');
    hand.position.y = -0.76;
    pivot.add(arm, hand);
    pivot.rotation.z = side * 0.12;
    body.add(pivot);
    arms.push(pivot);
  }

  const head = part(new THREE.SphereGeometry(0.24, 12, 8), '#e5d6b8');
  head.position.y = 2.08;
  const mask = part(new THREE.SphereGeometry(0.21, 12, 8), '#fffaf0');
  mask.scale.set(1, 1.15, 0.6);
  mask.position.set(0, 2.06, 0.13);
  const visor = part(new THREE.BoxGeometry(0.3, 0.05, 0.06), '#2b211f');
  visor.position.set(0, 2.1, 0.25);
  const brim = part(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 16), '#d8a24a');
  brim.position.y = 2.27;
  const crown = part(new THREE.ConeGeometry(0.26, 0.5, 12), '#d8a24a');
  crown.position.y = 2.53;
  const band = part(new THREE.CylinderGeometry(0.255, 0.27, 0.08, 12), '#c8483a');
  band.position.y = 2.33;

  const pack = part(new THREE.BoxGeometry(0.46, 0.55, 0.24), '#8a5a3c', { flat: true });
  pack.position.set(0, 1.5, -0.33);
  const bedroll = part(new THREE.CylinderGeometry(0.11, 0.11, 0.56, 8), '#5fb7ad');
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 1.85, -0.36);

  // Scarf: two segments so it can fold while running / gliding.
  const scarf = new THREE.Group();
  scarf.position.set(0, 1.92, -0.2);
  const s1 = part(new THREE.PlaneGeometry(0.34, 0.8), '#c8483a', { side: THREE.DoubleSide });
  s1.position.y = -0.4;
  const s2pivot = new THREE.Group();
  s2pivot.position.y = -0.8;
  const s2 = part(new THREE.PlaneGeometry(0.34, 0.7), '#c8483a', { side: THREE.DoubleSide });
  s2.position.y = -0.35;
  s2pivot.add(s2);
  scarf.add(s1, s2pivot);

  // Jetpack (Incal level): twin canisters with inked flames.
  const jetpack = new THREE.Group();
  jetpack.position.set(0, 1.5, -0.36);
  const flames = [];
  for (const side of [-1, 1]) {
    const can = part(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 10), '#62c3c9');
    can.position.x = side * 0.14;
    const cap = part(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#f3ead8');
    cap.position.set(side * 0.14, 0.3, 0);
    const nozzle = part(new THREE.CylinderGeometry(0.07, 0.11, 0.14, 8), '#34405e');
    nozzle.position.set(side * 0.14, -0.37, 0);
    const flame = part(new THREE.ConeGeometry(0.1, 0.7, 7), '#f6c04a', { flat: true });
    flame.rotation.x = Math.PI;
    flame.position.set(side * 0.14, -0.78, 0);
    flame.visible = false;
    jetpack.add(can, cap, nozzle, flame);
    flames.push(flame);
  }
  const strap = part(new THREE.BoxGeometry(0.5, 0.08, 0.1), '#8a5a3c');
  strap.position.set(0, 0.1, 0.06);
  jetpack.add(strap);
  jetpack.visible = false;

  body.add(robe, belt, shoulders, head, mask, visor, brim, crown, band, pack, bedroll, scarf, jetpack);
  return { root, body, legs, arms, scarf, scarf2: s2pivot, pack, bedroll, jetpack, flames };
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _q1 = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _qId = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);

/**
 * Local movement frame: up (against gravity), forward reference and right.
 * In normal levels it's just +Y / +Z / +X; levels with strange gravity
 * rotate it, and the forward reference is parallel-transported so the camera
 * and controls don't spin when "up" changes.
 */
class Frame {
  constructor() {
    this.up = new THREE.Vector3(0, 1, 0);
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.right = new THREE.Vector3(1, 0, 0);
  }
  set(up, fwd) {
    this.up.copy(up);
    if (fwd) this.fwd.copy(fwd);
    this.orthonormalize();
  }
  /** Rotate up toward target (rate in 1/s; Infinity = snap). */
  turnToward(target, rate, dt) {
    const k = rate === Infinity ? 1 : 1 - Math.exp(-rate * dt);
    if (this.up.dot(target) > 0.99999) return;
    _q1.setFromUnitVectors(this.up, target);
    _q1.slerp(new THREE.Quaternion(), 1 - k); // partial rotation
    this.up.applyQuaternion(_q1).normalize();
    this.fwd.applyQuaternion(_q1);
    this.orthonormalize();
  }
  orthonormalize() {
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up));
    if (this.fwd.lengthSq() < 1e-6) this.fwd.set(1, 0, 0).addScaledVector(this.up, -this.up.x);
    this.fwd.normalize();
    this.right.crossVectors(this.up, this.fwd).normalize();
  }
  /** World direction for a heading angle in this frame (0 = fwd). */
  dir(heading, out) {
    return out.copy(this.right).multiplyScalar(Math.sin(heading)).addScaledVector(this.fwd, Math.cos(heading));
  }
  headingOf(v) {
    return Math.atan2(v.dot(this.right), v.dot(this.fwd));
  }
  /** Orientation quaternion of a character facing `heading`. */
  quaternion(heading, out) {
    const d = this.dir(heading, _v3);
    const x = _v2.crossVectors(this.up, d);
    _mat.makeBasis(x, this.up, d);
    return out.setFromRotationMatrix(_mat);
  }
}

export class Player {
  /**
   * @param physics  Physics (ground rays + capsule collision against the level)
   * @param opts     { mount: (physics) => vehicle, jetpack, climb, killY, limit,
   *                   spawn, spawnHeading, spawnUp, gravityAt(pos) -> up,
   *                   unsafe(pos) -> bool }
   */
  constructor(physics, opts = {}) {
    this.physics = physics;
    this.opts = { jetpack: false, climb: true, killY: -Infinity, limit: 1900, ...opts };
    this.char = buildCharacter();
    this.object = this.char.root;
    this.frame = new Frame();
    this.pos = new THREE.Vector3(0, physics.groundAt(0, 1e4, 0), 0);
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;
    this.onGround = true;
    this.gliding = false;
    this.phase = 0;
    this.time = 0;
    // Pose updates at 12 fps ("on twos"), like Sable's stop-motion feel;
    // movement itself stays smooth.
    this.stopMotion = true;
    this._animAcc = 0;
    this._push = new THREE.Vector3();
    this.lastSafe = new THREE.Vector3();
    this._safeTimer = 0;

    // Vehicles: anything with pos, heading, forward, speed, update(), seatTransform().
    this.mount = this.opts.mount ? this.opts.mount(physics) : null;   // summonable (bike, bird, skiff)
    this.bike = this.mount;                                            // backwards-compatible name
    this.vehicles = this.mount ? [this.mount] : [];
    this.ride = null;

    this.fuel = 1;
    this.thrusting = false;
    this.stamina = 1;
    this.climbing = false;
    this.wallN = new THREE.Vector3();
    this._press = 0;
    this._climbCooldown = 0;
    this.char.jetpack.visible = this.opts.jetpack;
    this.char.pack.visible = this.char.bedroll.visible = !this.opts.jetpack;
    if (this.opts.spawn) this.respawn();
    this.lastSafe.copy(this.pos);
  }

  get riding() {
    return !!this.ride;
  }

  get up() {
    return this.frame.up;
  }

  respawn(to) {
    if (this.ride) this.dismount();
    this.pos.copy(to ?? this.opts.spawn);
    this.vel.set(0, 0, 0);
    if (!to) {
      this.heading = this.opts.spawnHeading ?? Math.PI;
      this.frame.set(this.opts.spawnUp ?? Y, this.opts.spawnFwd ?? new THREE.Vector3(0, 0, 1));
    }
    this.onGround = false;
    this.climbing = false;
    this.fuel = 1;
    this.stamina = 1;
  }

  /** Jump to another place, e.g. through a portal, with a new "up". */
  teleport(pos, up, fwd) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.frame.set(up, fwd);
    this.heading = 0;
    this.onGround = false;
    this.climbing = false;
    this.lastSafe.copy(pos);
  }

  /** Distance from the player to the summonable mount. */
  bikeDistance() {
    return this.mount ? this.mount.pos.distanceTo(this.pos) : Infinity;
  }

  /** Nearest vehicle you could board right now. */
  nearestVehicle() {
    let best = null, bd = Infinity;
    for (const v of this.vehicles) {
      const d = v.pos.distanceTo(this.pos);
      if (d < bd && d < (v.boardDistance ?? 6)) { best = v; bd = d; }
    }
    return best;
  }

  mount_(v) {
    this.ride = v;
    this.gliding = this.thrusting = this.climbing = false;
    v.board?.();
  }

  dismount() {
    const v = this.ride;
    this.ride = null;
    v.leave?.();
    const [fx, fz] = v.forward;
    const side = v.exitOffset ?? 1.8;
    this.pos.set(v.pos.x - fz * side, v.pos.y, v.pos.z + fx * side);
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 2, this.pos.z);
    if (this.pos.y - g < 3) this.pos.y = g;
    this.vel.set(v.vel.x * 0.3, 0, v.vel.z * 0.3);
    this.heading = v.heading;
    this.onGround = false;
  }

  // E: get off; get on a vehicle close by; otherwise whistle the mount or hail a taxi.
  interact() {
    if (this.ride) return this.dismount();
    const near = this.nearestVehicle();
    if (near) return this.mount_(near);
    if (this.mount) {
      const d = this.frame.dir(this.heading, _v1);
      return this.mount.summon(this.pos.x + d.z * 3 + d.x * 2, this.pos.z - d.x * 3 + d.z * 2, this.heading, this.pos);
    }
    let best = null, bd = Infinity;
    for (const v of this.vehicles) {
      if (!v.hail) continue;
      const d = v.pos.distanceTo(this.pos);
      if (d < bd) { best = v; bd = d; }
    }
    best?.hail(this.pos, this.heading);
  }

  update(dt, input, camYaw) {
    this.time += dt;
    if (input.KeyE && !this._eHeld) this.interact();
    this._eHeld = !!input.KeyE;

    if (this.ride) {
      this.ride.update(dt, input, this.time);
      this.pos.copy(this.ride.pos);
      this.ride.seatTransform(this.object.position, this.object.quaternion);
      this._animAcc += dt;
      if (!this.stopMotion || this._animAcc >= 1 / 12) {
        this.animateRiding();
        this._animAcc = 0;
      }
      return;
    }

    // gravity can change direction (Airtight Garage)
    const F = this.frame;
    if (this.opts.gravityAt) F.turnToward(this.opts.gravityAt(this.pos), 5, dt);
    const U = F.up;

    const f = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
    const s = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
    const run = input.ShiftLeft || input.ShiftRight;

    if (this.climbing) {
      this.updateClimb(dt, f, s, input);
      this.finishFrame(dt, 0);
      return;
    }
    this._climbCooldown = Math.max(this._climbCooldown - dt, 0);

    // camera-relative movement in the tangent plane
    const camF = _v1.copy(F.right).multiplyScalar(-Math.sin(camYaw)).addScaledVector(F.fwd, -Math.cos(camYaw));
    const camR = _v2.copy(F.right).multiplyScalar(Math.cos(camYaw)).addScaledVector(F.fwd, -Math.sin(camYaw));
    const move = new THREE.Vector3().addScaledVector(camF, f).addScaledVector(camR, s);
    if (move.lengthSq() > 0) move.normalize();

    let speed = run ? RUN : WALK;
    if (this.gliding) speed *= 1.25;
    if (this.thrusting) speed *= 1.3;
    const accel = this.onGround ? 10 : this.thrusting ? 5 : 2.5;
    const a = 1 - Math.exp(-accel * dt);
    let vu = this.vel.dot(U);
    const tv = _v3.copy(this.vel).addScaledVector(U, -vu);
    tv.addScaledVector(_v1.copy(move).multiplyScalar(speed).sub(tv), a);

    // jump / glide
    if (input.Space && this.onGround && !this._jumpHeld) {
      vu = JUMP;
      this.onGround = false;
    }
    const jumpedNow = input.Space && !this._jumpHeld;
    this._jumpHeld = !!input.Space;
    vu -= GRAVITY * dt;

    // Jetpack: hold Space in the air (or keep holding after a jump) to thrust
    // while there's fuel; refills on the ground. Out of fuel -> glide.
    this.thrusting = this.opts.jetpack && !this.onGround && input.Space && this.fuel > 0 && !jumpedNow;
    if (this.thrusting) {
      vu = Math.min(vu + JET_THRUST * dt, JET_MAX_UP);
      this.fuel = Math.max(this.fuel - JET_DRAIN * dt, 0);
    } else if (this.onGround) {
      this.fuel = Math.min(this.fuel + JET_REFILL * dt, 1);
    }
    this.gliding = !this.onGround && !this.thrusting && input.Space && vu < 0;
    if (this.gliding) vu = Math.max(vu, -2.2);
    this.vel.copy(tv).addScaledVector(U, vu);

    this.pos.addScaledVector(this.vel, dt);
    const L = this.opts.limit;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -L, L);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -L, L);

    // Walls and ceilings: a capsule from just above step height to the head.
    // Anything lower than STEP is stepped onto by the ground ray below.
    const push = this.physics.pushCapsule(this.pos, RADIUS, STEP, HEIGHT, this._push, U);
    if (push) {
      const n = push.normalize();
      const vn = this.vel.dot(n);
      if (vn < 0) this.vel.addScaledVector(n, -vn); // slide along the wall
      // pushing into a steep wall: start climbing (immediately in the air)
      const wall = Math.abs(n.dot(U)) < 0.35 && move.dot(n) < -0.6;
      if (this.opts.climb && wall && this._climbCooldown === 0 && this.stamina > 0.1) {
        this._press += dt;
        if (!this.onGround || this._press > 0.25) this.startClimb(n);
      } else this._press = 0;
    } else this._press = 0;
    if (this.climbing) { this.finishFrame(dt, 0); return; }

    // Ground: first surface below step height (terrain, rocks, roofs, domes...)
    const h = this.physics.heightAbove(this.pos, U, STEP);
    if (this.pos.y < this.opts.killY) this.respawn();
    vu = this.vel.dot(U);
    if (h <= 0 || (this.onGround && h < 0.8 && vu <= 0)) {
      this.pos.addScaledVector(U, -h);
      this.vel.addScaledVector(U, -vu);
      this.onGround = true;
    } else {
      this.onGround = h <= 0.01;
    }
    if (this.onGround) this.stamina = Math.min(this.stamina + 0.5 * dt, 1);

    // deep water and other unsafe places put you back where you last stood safely
    if (this.opts.unsafe) {
      if (this.opts.unsafe(this.pos)) this.respawn(this.lastSafe);
      else if (this.onGround && (this._safeTimer += dt) > 0.4) { this.lastSafe.copy(this.pos); this._safeTimer = 0; }
    }

    // facing
    const tvel = _v1.copy(this.vel).addScaledVector(U, -this.vel.dot(U));
    const hs = tvel.length();
    if (hs > 0.5) {
      let d = F.headingOf(tvel) - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-12 * dt));
    }
    this.finishFrame(dt, hs);
  }

  finishFrame(dt, hs) {
    this._animAcc += dt;
    if (!this.stopMotion || this._animAcc >= 1 / 12) {
      if (this.climbing) this.animateClimb(this._animAcc);
      else this.animate(this._animAcc, hs);
      this._animAcc = 0;
    }
    this.object.position.copy(this.pos);
    this.frame.quaternion(this.heading, this.object.quaternion);
  }

  // ------------------------------------------------------------------ climbing
  // Sable-style: push into a steep wall to grab it; W/S climb, A/D shuffle,
  // Space jumps off, reaching the top mantles over it. Uses stamina.
  startClimb(n) {
    this.climbing = true;
    this.wallN.copy(n);
    this.vel.set(0, 0, 0);
    this.gliding = this.thrusting = false;
    this.heading = this.frame.headingOf(_v1.copy(n).negate());
    this._climbTime = 0;
  }

  updateClimb(dt, f, s, input) {
    const U = this.frame.up, n = this.wallN;
    const into = _v1.copy(n).negate();
    const chest = _v2.copy(this.pos).addScaledVector(U, 1.2);
    const hit = this.physics.rayHit(chest, into, 1.6);
    if (!hit) { this.stopClimb(false); return; }
    n.copy(hit.normal);
    if (Math.abs(n.dot(U)) > 0.6) { this.stopClimb(true); return; }   // wall became a floor: step on
    // stick to the wall
    this.pos.copy(hit.point).addScaledVector(n, RADIUS + 0.08).addScaledVector(U, -1.2);

    // reached the top: nothing in front at head height -> mantle over
    const head = _v2.copy(this.pos).addScaledVector(U, 2.3);
    if (f > 0 && !this.physics.rayHit(head, into, 1.6)) {
      this.pos.addScaledVector(U, 2.4).addScaledVector(into, 1.1);
      this.stopClimb(true);
      return;
    }

    const right = _v3.crossVectors(into, U).normalize().negate();
    const sp = (input.ShiftLeft || input.ShiftRight ? 6.5 : 4);
    this.pos.addScaledVector(U, f * sp * dt).addScaledVector(right, s * sp * 0.8 * dt);
    this.heading = this.frame.headingOf(into);
    this.phase += dt * (f || s ? 7 : 0);

    this.stamina -= (f || s ? 0.045 : 0.02) * dt;   // ~22 s of climbing
    if (input.Space && !this._jumpHeld) {                       // jump off the wall
      this.stopClimb(false);
      this.vel.copy(n).multiplyScalar(6).addScaledVector(U, 8);
      this._climbCooldown = 0.5;
    }
    this._jumpHeld = !!input.Space;
    if (this.stamina <= 0) { this.stamina = 0; this.stopClimb(false); this._climbCooldown = 1; }
    // climbing down onto the ground, or coming out on top of something
    // (e.g. through a tree canopy): stand on it
    this._climbTime += dt;
    const h = this.physics.heightAbove(this.pos, U, STEP);
    if (f < 0 && h < 0.05) this.stopClimb(true);
    else if (f > 0 && this._climbTime > 0.6 && h > -0.05 && h < 0.2) this.stopClimb(true);
  }

  stopClimb(onTop) {
    this.climbing = false;
    this.vel.set(0, 0, 0);
    this.onGround = false;
    if (!onTop) this._climbCooldown = Math.max(this._climbCooldown, 0.3);
  }

  animateClimb() {
    const c = this.char;
    const k = Math.sin(this.phase);
    c.arms[0].rotation.set(-2.7 + k * 0.35, 0, -0.2);
    c.arms[1].rotation.set(-2.7 - k * 0.35, 0, 0.2);
    c.legs[0].rotation.x = -0.5 - k * 0.4;
    c.legs[1].rotation.x = -0.5 + k * 0.4;
    c.body.position.y = 0;
    c.body.rotation.x = -0.05;
    c.scarf.rotation.x = -0.1;
    c.scarf2.rotation.x = 0.1;
    for (const fl of c.flames) fl.visible = false;
  }

  animateRiding() {
    const c = this.char;
    const flow = Math.min(Math.abs(this.ride.speed) / 30, 1.3);
    c.legs[0].rotation.set(-1.35, 0, 0.12);
    c.legs[1].rotation.set(-1.35, 0, -0.12);
    c.body.position.y = 0;
    c.body.rotation.x = 0.25 + flow * 0.15;
    c.arms[0].rotation.set(-1.15, 0, -0.25);
    c.arms[1].rotation.set(-1.15, 0, 0.25);
    c.scarf.rotation.x = -0.4 - flow * 0.9 + Math.sin(this.time * 18) * 0.06 * flow;
    c.scarf2.rotation.x = -flow * 0.35 + Math.sin(this.time * 23 + 1) * 0.2 * flow;
  }

  animate(dt, hs) {
    const c = this.char;
    const moving = Math.min(hs / WALK, 1.6);
    this.phase += dt * (4 + hs * 0.55) * (this.onGround ? 1 : 0.3);
    const swing = this.onGround ? Math.sin(this.phase) * 0.7 * Math.min(moving, 1) : 0.5;
    c.legs[0].rotation.x = swing;
    c.legs[1].rotation.x = this.onGround ? -swing : -0.3;
    c.body.position.y = this.onGround ? Math.abs(Math.sin(this.phase)) * 0.08 * moving : 0;
    c.body.rotation.x = Math.min(hs / RUN, 1) * 0.18;

    for (const f of c.flames) {
      f.visible = this.thrusting;
      f.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    }
    if (this.thrusting) {
      c.arms[0].rotation.set(0.25, 0, -0.5);
      c.arms[1].rotation.set(0.25, 0, 0.5);
      c.legs[0].rotation.x = 0.2;
      c.legs[1].rotation.x = -0.15;
      c.scarf.rotation.x = -0.25 + Math.sin(this.time * 16) * 0.08;
      c.scarf2.rotation.x = Math.sin(this.time * 19) * 0.25;
    } else if (this.gliding) {
      c.arms[0].rotation.set(0, 0, -1.45);
      c.arms[1].rotation.set(0, 0, 1.45);
      c.scarf.rotation.x = -1.35 + Math.sin(this.time * 14) * 0.06;
      c.scarf2.rotation.x = Math.sin(this.time * 17) * 0.2;
    } else {
      c.arms[0].rotation.set(-swing * 0.8, 0, -0.12);
      c.arms[1].rotation.set(swing * 0.8, 0, 0.12);
      const flow = Math.min(hs / RUN, 1);
      c.scarf.rotation.x = -0.15 - flow * 0.9 + Math.sin(this.time * 6) * 0.05 * (0.3 + flow);
      c.scarf2.rotation.x = -flow * 0.4 + Math.sin(this.time * 9 + 1) * 0.15 * flow;
    }
  }
}

export class CameraRig {
  constructor(camera, dom, physics) {
    this.camera = camera;
    this.physics = physics;
    this._curDist = 11;
    this._dir = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0.22;
    this.dist = 11;
    this.target = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._dragging = false;
    this._lastMouse = -1e9;
    this._now = 0;
    this._distBoost = 0;

    dom.addEventListener('click', () => dom.requestPointerLock?.());
    dom.addEventListener('mousedown', () => (this._dragging = true));
    window.addEventListener('mouseup', () => (this._dragging = false));
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== dom && !this._dragging) return;
      this._lastMouse = this._now;
      this.yaw -= e.movementX * 0.0025;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.0025, -0.35, 1.3);
    });
    dom.addEventListener('wheel', (e) => {
      this.dist = THREE.MathUtils.clamp(this.dist * (1 + Math.sign(e.deltaY) * 0.1), 4, 60);
    }, { passive: true });
  }

  /** While riding: swing behind the bike unless the mouse moved recently. */
  follow(heading, dt, riding) {
    this._distBoost += ((riding ? 6 : 0) - this._distBoost) * (1 - Math.exp(-2 * dt));
    if (!riding || this._now - this._lastMouse < 1.5) return;
    let d = heading + Math.PI - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * (1 - Math.exp(-2.2 * dt));
  }

  /** @param frame the player's local frame (up / fwd / right) */
  update(playerPos, dt, frame) {
    this._now += dt;
    const U = frame ? frame.up : Y, Fw = frame ? frame.fwd : _zAxis, Rt = frame ? frame.right : _xAxis;
    const dist = this.dist + this._distBoost;
    this.target.lerp(playerPos, 1 - Math.exp(-14 * dt));
    if (this.target.lengthSq() === 0) this.target.copy(playerPos);
    const cp = Math.cos(this.pitch);
    const cam = this.camera.position;
    this._look.copy(this.target).addScaledVector(U, 1.8);
    this._dir.copy(Rt).multiplyScalar(Math.sin(this.yaw) * cp)
      .addScaledVector(U, Math.sin(this.pitch))
      .addScaledVector(Fw, Math.cos(this.yaw) * cp);

    // Line of sight: pull the camera in front of any wall between it and the
    // player (snap in, ease back out).
    const hit = this.physics.rayDistance(this._look, this._dir, dist + 0.5);
    const allowed = Math.max(Math.min(dist, hit - 0.6), 1.5);
    this._curDist = allowed < this._curDist ? allowed : this._curDist + (allowed - this._curDist) * (1 - Math.exp(-3 * dt));
    cam.copy(this._look).addScaledVector(this._dir, this._curDist);

    if (U.y > 0.999) {
      const g = this.physics.groundAt(cam.x, cam.y + 1.2, cam.z) + 1.0;
      if (cam.y < g) cam.y = g;
    }
    this.constrain?.(cam);
    // roll the camera with gravity (smoothly, so portals don't snap the view)
    // (a quaternion turn, so even a 180° flip rotates instead of collapsing)
    if (this.camera.up.dot(U) < 0.99999) {
      _q1.setFromUnitVectors(this.camera.up, U).slerp(_qId, Math.exp(-6 * dt));
      this.camera.up.applyQuaternion(_q1).normalize();
    }
    this.camera.lookAt(this._look);
  }
}
