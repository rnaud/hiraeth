import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { Hoverbike } from './bike.js';

const RADIUS = 0.45;
const STEP = 0.6;    // obstacles lower than this are stepped onto
const HEIGHT = 2.2;
const _up = new THREE.Vector3(0, 1, 0);
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

export class Player {
  /**
   * @param physics  Physics (ground rays + capsule collision against the level)
   * @param opts     { bike, jetpack, killY, spawn: Vector3, spawnHeading }
   */
  constructor(physics, opts = {}) {
    this.physics = physics;
    this.opts = { bike: true, jetpack: false, killY: -Infinity, ...opts };
    this.char = buildCharacter();
    this.object = this.char.root;
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

    // Vehicles: anything with pos, heading, forward, speed, update(), seatTransform().
    this.bike = new Hoverbike(physics);
    this.vehicles = this.opts.bike ? [this.bike] : [];
    this.ride = null;

    this.fuel = 1;
    this.thrusting = false;
    this.char.jetpack.visible = this.opts.jetpack;
    this.char.pack.visible = this.char.bedroll.visible = !this.opts.jetpack;
    if (this.opts.spawn) this.respawn();
  }

  get riding() {
    return !!this.ride;
  }

  respawn() {
    if (this.ride) this.dismount();
    this.pos.copy(this.opts.spawn);
    this.vel.set(0, 0, 0);
    this.heading = this.opts.spawnHeading ?? Math.PI;
    this.onGround = false;
    this.fuel = 1;
  }

  /** Distance from the player to the bike, on the ground plane. */
  bikeDistance() {
    return Math.hypot(this.bike.pos.x - this.pos.x, this.bike.pos.z - this.pos.z);
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

  mount(v) {
    this.ride = v;
    this.gliding = this.thrusting = false;
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
    this.object.quaternion.identity();
  }

  // E: get off; get on a vehicle close by; otherwise whistle the bike or hail a taxi.
  interact() {
    if (this.ride) return this.dismount();
    const near = this.nearestVehicle();
    if (near) return this.mount(near);
    if (this.opts.bike) {
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      return this.bike.summon(this.pos.x + fz * 3 + fx * 2, this.pos.z - fx * 3 + fz * 2, this.heading);
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

    const f = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
    const s = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
    const run = input.ShiftLeft || input.ShiftRight;

    // camera-relative movement
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let mx = fx * f + rx * s, mz = fz * f + rz * s;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    let speed = run ? RUN : WALK;
    if (this.gliding) speed *= 1.25;
    if (this.thrusting) speed *= 1.3;
    const accel = this.onGround ? 10 : this.thrusting ? 5 : 2.5;
    const a = 1 - Math.exp(-accel * dt);
    this.vel.x += (mx * speed - this.vel.x) * a;
    this.vel.z += (mz * speed - this.vel.z) * a;

    // jump / glide
    if (input.Space && this.onGround && !this._jumpHeld) {
      this.vel.y = JUMP;
      this.onGround = false;
    }
    const jumpedNow = input.Space && !this._jumpHeld;
    this._jumpHeld = !!input.Space;
    this.vel.y -= GRAVITY * dt;

    // Jetpack: hold Space in the air (or keep holding after a jump) to thrust
    // while there's fuel; refills on the ground. Out of fuel -> glide.
    this.thrusting = this.opts.jetpack && !this.onGround && input.Space && this.fuel > 0 && !jumpedNow;
    if (this.thrusting) {
      this.vel.y = Math.min(this.vel.y + JET_THRUST * dt, JET_MAX_UP);
      this.fuel = Math.max(this.fuel - JET_DRAIN * dt, 0);
    } else if (this.onGround) {
      this.fuel = Math.min(this.fuel + JET_REFILL * dt, 1);
    }
    this.gliding = !this.onGround && !this.thrusting && input.Space && this.vel.y < 0;
    if (this.gliding) this.vel.y = Math.max(this.vel.y, -2.2);

    this.pos.addScaledVector(this.vel, dt);
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -LIMIT, LIMIT);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -LIMIT, LIMIT);

    // Walls and ceilings: a capsule from just above step height to the head.
    // Anything lower than STEP is stepped onto by the ground ray below.
    const push = this.physics.pushCapsule(this.pos, RADIUS, STEP, HEIGHT, this._push);
    if (push) {
      const n = push.normalize();
      const vn = this.vel.dot(n);
      if (vn < 0) this.vel.addScaledVector(n, -vn); // slide along the wall
    }

    // Ground: first surface below step height (terrain, rocks, roofs, domes...)
    const g = this.physics.groundAt(this.pos.x, this.pos.y + STEP, this.pos.z);
    if (this.pos.y < this.opts.killY) this.respawn();
    if (this.pos.y <= g || (this.onGround && this.pos.y - g < 0.8 && this.vel.y <= 0)) {
      this.pos.y = g;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = this.pos.y <= g + 0.01;
    }

    // facing
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.5) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-12 * dt));
    }

    this._animAcc += dt;
    if (!this.stopMotion || this._animAcc >= 1 / 12) {
      this.animate(this._animAcc, hs);
      this._animAcc = 0;
    }
    this.object.position.copy(this.pos);
    this.object.quaternion.setFromAxisAngle(_up, this.heading);
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

  update(playerPos, dt) {
    this._now += dt;
    const dist = this.dist + this._distBoost;
    this.target.lerp(playerPos, 1 - Math.exp(-14 * dt));
    if (this.target.lengthSq() === 0) this.target.copy(playerPos);
    const cp = Math.cos(this.pitch);
    const cam = this.camera.position;
    this._look.set(this.target.x, this.target.y + 1.8, this.target.z);
    this._dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);

    // Line of sight: pull the camera in front of any wall between it and the
    // player (snap in, ease back out).
    const hit = this.physics.rayDistance(this._look, this._dir, dist + 0.5);
    const allowed = Math.max(Math.min(dist, hit - 0.6), 1.5);
    this._curDist = allowed < this._curDist ? allowed : this._curDist + (allowed - this._curDist) * (1 - Math.exp(-3 * dt));
    cam.copy(this._look).addScaledVector(this._dir, this._curDist);

    const g = this.physics.groundAt(cam.x, cam.y + 1.2, cam.z) + 1.0;
    if (cam.y < g) cam.y = g;
    this.constrain?.(cam);
    this.camera.lookAt(this._look);
  }
}
