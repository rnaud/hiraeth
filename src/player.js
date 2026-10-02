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

// An Arzach-style rider: tall and gaunt, swallowed by an enormous red hooded
// cloak that reaches the ankles and flares out behind when running, a long
// pale face with a long thin nose, a peaked hood whose tip trails behind.
function buildCharacter() {
  const root = new THREE.Group();
  const body = new THREE.Group();          // whole-figure bob / lean / bank
  root.add(body);
  const C = { cloak: '#c8483a', lining: '#9e3a33', cloth: '#343a56', legs: '#2b2f45', wrap: '#e2d3b4',
    face: '#f1e6d0', ink: '#2b211f', belt: '#d8a24a' };

  const pelvis = part(new THREE.CylinderGeometry(0.12, 0.13, 0.15, 10), C.cloth);
  pelvis.position.y = 0.99;
  body.add(pelvis);

  // long thin legs with knees, wrapped boots
  const legs = [], knees = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.085, 0.96, 0);
    const thigh = part(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 7), C.legs);
    thigh.position.y = -0.25;
    const knee = new THREE.Group();
    knee.position.y = -0.49;
    const shin = part(new THREE.CylinderGeometry(0.05, 0.04, 0.42, 7), C.legs);
    shin.position.y = -0.21;
    const wrap = part(new THREE.CylinderGeometry(0.052, 0.058, 0.2, 7), C.wrap, { flat: true });
    wrap.position.y = -0.33;
    const boot = part(new THREE.BoxGeometry(0.1, 0.08, 0.25), C.wrap, { flat: true });
    boot.position.set(0, -0.43, 0.06);
    knee.add(shin, wrap, boot);
    pivot.add(thigh, knee);
    body.add(pivot);
    legs.push(pivot);
    knees.push(knee);
  }

  const torso = new THREE.Group();
  torso.position.y = 1.06;
  body.add(torso);
  const tunic = part(new THREE.CylinderGeometry(0.11, 0.135, 0.62, 10), C.cloth);
  tunic.position.y = 0.31;
  const belt = part(new THREE.TorusGeometry(0.135, 0.022, 6, 16).rotateX(Math.PI / 2), C.belt);
  belt.position.y = 0.06;
  torso.add(tunic, belt);

  // thin arms with elbows, red cuffs
  const arms = [], elbows = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.66, 0);
    const upper = part(new THREE.CylinderGeometry(0.036, 0.032, 0.32, 6), C.cloth);
    upper.position.y = -0.16;
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    const fore = part(new THREE.CylinderGeometry(0.032, 0.027, 0.3, 6), C.cloth);
    fore.position.y = -0.15;
    const cuff = part(new THREE.CylinderGeometry(0.036, 0.036, 0.06, 6), C.cloak);
    cuff.position.y = -0.27;
    const hand = part(new THREE.SphereGeometry(0.042, 6, 4), C.face);
    hand.position.y = -0.33;
    elbow.add(fore, cuff, hand);
    pivot.add(upper, elbow);
    pivot.rotation.z = side * 0.06;
    torso.add(pivot);
    arms.push(pivot);
    elbows.push(elbow);
  }

  // head: long pale face, long nose, deep peaked hood
  const head = new THREE.Group();
  head.position.y = 0.87;
  torso.add(head);
  const neck = part(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 6), C.face);
  neck.position.y = 0.79;
  torso.add(neck);
  const face = part(new THREE.CapsuleGeometry(0.07, 0.13, 4, 10), C.face);
  face.scale.set(1, 1, 0.95);
  face.position.y = 0.01;
  const nose = part(new THREE.ConeGeometry(0.02, 0.17, 6).rotateX(Math.PI / 2 + 0.45), C.face, { flat: true });
  nose.position.set(0, 0.0, 0.11);
  head.add(face, nose);
  for (const side of [-1, 1]) {
    const eye = part(new THREE.BoxGeometry(0.035, 0.01, 0.015), C.ink);
    eye.position.set(side * 0.032, 0.045, 0.066);
    eye.rotation.z = side * 0.18;            // heavy-lidded, weary
    head.add(eye);
  }
  const hood = part(new THREE.SphereGeometry(0.15, 16, 12, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5), C.cloak, { side: THREE.DoubleSide });
  hood.scale.set(1, 1.25, 1.15);
  hood.position.set(0, 0.04, -0.02);
  head.add(hood);
  // hood peak on a hinge: trails back, bounces (driven as "hatTip")
  const peakBase = new THREE.Group();
  peakBase.position.set(0, 0.17, -0.05);
  peakBase.rotation.x = -0.65;
  const hatTip = new THREE.Group();
  const peak = part(new THREE.ConeGeometry(0.075, 0.34, 10), C.cloak);
  peak.position.y = 0.15;
  hatTip.add(peak);
  peakBase.add(hatTip);
  head.add(peakBase);

  // the cloak: an open-fronted cone from the shoulders to the ankles whose
  // vertices are reshaped every frame (flare, spread, ripple)
  const CH = 1.55, CR0 = 0.19, CR1 = 0.47;
  const cloakGeo = new THREE.CylinderGeometry(CR0, CR1, CH, 22, 9, true, 0.42, Math.PI * 2 - 0.84);
  cloakGeo.translate(0, -CH / 2, 0);
  const base = cloakGeo.attributes.position.array.slice();
  const cloak = part(cloakGeo, C.cloak, { side: THREE.DoubleSide });
  cloak.position.y = 0.74;
  cloak.frustumCulled = false;
  const collar = part(new THREE.TorusGeometry(0.19, 0.035, 6, 18).rotateX(Math.PI / 2), C.lining);
  collar.position.y = 0.74;
  torso.add(cloak, collar);
  const cs = { flare: 0, spread: 0, lift: 0 };
  function updateCloak(state) {
    const k = 1 - Math.exp(-6 * state.dt);
    cs.flare += (state.flare - cs.flare) * k;
    cs.spread += (state.spread - cs.spread) * k;
    cs.lift += (state.lift - cs.lift) * k;
    const p = cloakGeo.attributes.position.array, t = state.t;
    for (let i = 0; i < p.length; i += 3) {
      const x0 = base[i], y0 = base[i + 1], z0 = base[i + 2];
      const h = -y0 / CH;                                   // 0 at the shoulders, 1 at the hem
      const ang = Math.atan2(x0, z0);                       // 0 = front
      const back = 0.5 - 0.5 * Math.cos(ang);               // 0 front .. 1 back
      const h2 = h * h;
      const wave = Math.sin(ang * 3 + t * 7 - h * 4) * 0.045 * h * (0.25 + cs.flare);
      const stride = Math.sin(t * 4 + ang) * 0.015 * h;     // gentle sway even when idle
      p[i] = x0 * (1 + cs.spread * h * 1.6) + wave * Math.cos(ang);
      p[i + 1] = y0 + back * h2 * (cs.flare * 0.55 + cs.lift * 0.9);
      p[i + 2] = z0 - back * h2 * (cs.flare * 0.95 + cs.lift * 0.3) + stride - wave * Math.sin(ang);
    }
    cloakGeo.attributes.position.needsUpdate = true;
    cloakGeo.computeVertexNormals();
  }

  // a small satchel at the hip (hidden when the jetpack is on)
  const pack = new THREE.Group();
  const satchel = part(new THREE.BoxGeometry(0.14, 0.16, 0.07), '#8a5a3c', { flat: true });
  satchel.position.set(0.16, 0.0, 0.03);
  pack.add(satchel);
  const bedroll = new THREE.Group();
  torso.add(pack, bedroll);

  // kept for the animation code; the cloak replaces the scarf
  const scarf = new THREE.Group(), scarf2 = new THREE.Group();
  torso.add(scarf);
  scarf.add(scarf2);

  // Jetpack (Incal level): twin canisters worn over the cloak.
  const jetpack = new THREE.Group();
  jetpack.position.set(0, 0.44, -0.3);
  const flames = [];
  for (const side of [-1, 1]) {
    const can = part(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), '#62c3c9');
    can.position.x = side * 0.11;
    const cap = part(new THREE.SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#f3ead8');
    cap.position.set(side * 0.11, 0.25, 0);
    const nozzle = part(new THREE.CylinderGeometry(0.05, 0.085, 0.12, 8), C.cloth);
    nozzle.position.set(side * 0.11, -0.31, 0);
    const flame = part(new THREE.ConeGeometry(0.08, 0.6, 7), '#f6c04a', { flat: true });
    flame.rotation.x = Math.PI;
    flame.position.set(side * 0.11, -0.67, 0);
    flame.visible = false;
    jetpack.add(can, cap, nozzle, flame);
    flames.push(flame);
  }
  jetpack.visible = false;
  torso.add(jetpack);

  return { root, body, torso, head, hatTip, legs, knees, arms, elbows, scarf, scarf2, pack, bedroll, jetpack, flames,
    scarfAnchors: [], updateCloak };
}

const _v1 = new THREE.Vector3();
const _cu = new THREE.Vector3(), _cs = new THREE.Vector3(), _cb = new THREE.Vector3(), _cw = new THREE.Vector3();
const _ca = new THREE.Vector3(), _cbb = new THREE.Vector3(), _cA = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _q1 = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _qId = new THREE.Quaternion();
const _xAxis = new THREE.Vector3(1, 0, 0);

/**
 * A scarf tail simulated as a Verlet chain and drawn as a ribbon in world
 * space. It trails behind when you run or ride, sags when you stand, and is
 * pushed out of the body.
 */
class ClothTail {
  constructor(scene, { points = 8, seg = 0.2, width = 0.3, color = '#c8483a' } = {}) {
    this.n = points;
    this.seg = seg;
    this.width = width;
    this.p = Array.from({ length: points }, () => new THREE.Vector3());
    this.prev = Array.from({ length: points }, () => new THREE.Vector3());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < points - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, makeMaterial({ color, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.userData.noCollide = true;
    scene.add(this.mesh);
    this.ready = false;
  }

  update(dt, anchor, up, side, back, wind, bodyA, bodyB) {
    if (!this.ready || this.p[0].distanceTo(anchor) > 5) {
      for (let i = 0; i < this.n; i++) {
        this.p[i].copy(anchor).addScaledVector(up, -i * this.seg * 0.7).addScaledVector(back, i * this.seg * 0.7);
        this.prev[i].copy(this.p[i]);
      }
      this.ready = true;
    }
    const steps = 2, h = Math.min(dt, 1 / 30) / steps;
    for (let k = 0; k < steps; k++) {
      this.p[0].copy(anchor);
      for (let i = 1; i < this.n; i++) {
        const p = this.p[i], q = this.prev[i];
        _v1.subVectors(p, q).multiplyScalar(0.97);           // velocity with damping
        q.copy(p);
        p.add(_v1).addScaledVector(up, -4.0 * h * h).addScaledVector(wind, h * h);
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < this.n; i++) {
          const a = this.p[i - 1], b = this.p[i];
          _v1.subVectors(b, a);
          const d = _v1.length() || 1e-6;
          b.copy(a).addScaledVector(_v1, this.seg / d);
        }
        // keep the cloth out of the body (a capsule from hips to shoulders)
        for (let i = 1; i < this.n; i++) {
          const p = this.p[i];
          _v2.subVectors(bodyB, bodyA);
          const t = THREE.MathUtils.clamp(_v1.subVectors(p, bodyA).dot(_v2) / _v2.lengthSq(), 0, 1);
          _v3.copy(bodyA).addScaledVector(_v2, t);
          _v1.subVectors(p, _v3);
          const d = _v1.length();
          if (d < 0.3) p.copy(_v3).addScaledVector(d > 1e-4 ? _v1.divideScalar(d) : back, 0.3);
        }
      }
    }
    const pos = this.mesh.geometry.attributes.position.array;
    for (let i = 0; i < this.n; i++) {
      const w = this.width * (1 - 0.35 * (i / (this.n - 1)));   // tapers toward the tip
      const j = i * 6;
      pos[j] = this.p[i].x - side.x * w * 0.5; pos[j + 1] = this.p[i].y - side.y * w * 0.5; pos[j + 2] = this.p[i].z - side.z * w * 0.5;
      pos[j + 3] = this.p[i].x + side.x * w * 0.5; pos[j + 4] = this.p[i].y + side.y * w * 0.5; pos[j + 5] = this.p[i].z + side.z * w * 0.5;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

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
    // Optional: pose updates at 12 fps ("on twos"), like Sable's stop-motion
    // feel (Time of day > stop-motion anim); movement itself stays smooth.
    this.stopMotion = false;
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
    this.wind = new THREE.Vector3(1.2, 0, 0.5);   // levels can set this (wind on the scarf)
    this.onStep = null;                            // (footPos, heading) for footprints
    this._stepSide = 1;
    this._prevPhase = 0;
    this.char.jetpack.visible = this.opts.jetpack;
    this.char.pack.visible = this.char.bedroll.visible = !this.opts.jetpack;
    if (this.opts.spawn) this.respawn();
    this.lastSafe.copy(this.pos);
  }

  get riding() {
    return !!this.ride;
  }

  /** Add the parts that live directly in the scene (the simulated scarf). */
  attach(scene) {
    scene.add(this.object);
    this.tails = this.char.scarfAnchors.map((_, i) =>
      new ClothTail(scene, i === 0 ? { points: 10, seg: 0.2, width: 0.2 } : { points: 7, seg: 0.18, width: 0.16 }));
  }

  updateCloth(dt) {
    if (this.char.updateCloak) {
      const sp = this.ride ? Math.abs(this.ride.speed) : Math.hypot(this.vel.x, this.vel.z);
      const airborne = !this.ride && !this.onGround && !this.climbing;
      this.char.updateCloak({
        dt, t: this.time,
        flare: this.climbing ? 0 : THREE.MathUtils.clamp(sp / (this.ride ? 30 : RUN), 0, 1.3) + (airborne ? 0.3 : 0),
        spread: this.gliding ? 1 : 0,
        lift: this.thrusting ? 1 : this.gliding ? 0.5 : 0,
      });
    }
    if (!this.tails) return;
    this.object.updateMatrixWorld(true);
    const up = _cu.set(0, 1, 0).applyQuaternion(this.object.quaternion);
    const side = _cs.set(1, 0, 0).applyQuaternion(this.object.quaternion);
    const back = _cb.set(0, 0, -1).applyQuaternion(this.object.quaternion);
    // relative airflow: the scarf streams behind you when you move
    const vel = this.ride ? this.ride.vel : this.vel;
    const wind = _cw.copy(this.wind).addScaledVector(vel, -1.6);
    const a = _ca.set(0, 1.0, 0).applyMatrix4(this.object.matrixWorld);
    const b = _cbb.set(0, 1.75, 0).applyMatrix4(this.object.matrixWorld);
    for (let i = 0; i < this.tails.length; i++) {
      const anchor = _cA.copy(this.char.scarfAnchors[i]).applyMatrix4(this.object.matrixWorld);
      this.tails[i].update(dt, anchor, up, side, back, wind, a, b);
    }
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
      this.updateCloth(dt);
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

    // Moving solids (taxis): pushed out of their sides, or standing on the roof
    let carrier = null, roofH = Infinity;
    if (this.opts.dynamic) {
      for (const v of this.opts.dynamic()) {
        if (v === this.ride || !v.solid) continue;
        const d = v.solid;
        const dx = this.pos.x - d.pos.x, dz = this.pos.z - d.pos.z, hd = Math.hypot(dx, dz);
        if (hd > d.r + RADIUS) continue;
        const above = this.pos.y - d.top;
        if (above > -0.5 && above < 0.9 && this.vel.y - d.vel.y <= 0.5) {
          if (above < roofH) { roofH = above; carrier = d; }
        } else if (this.pos.y + HEIGHT > d.bottom && this.pos.y < d.top - 0.5 && hd > 1e-4) {
          const k = (d.r + RADIUS) / hd;
          this.pos.x = d.pos.x + dx * k;
          this.pos.z = d.pos.z + dz * k;
        }
      }
    }

    // Ground: first surface below step height (terrain, rocks, roofs, domes...)
    let h = this.physics.heightAbove(this.pos, U, STEP);
    if (carrier && roofH < h) h = roofH;
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
    // ride along on whatever you're standing on
    if (carrier && this.onGround) this.pos.addScaledVector(carrier.vel, dt);

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
    this.updateCloth(dt);
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
    c.arms[0].rotation.set(-2.75 + k * 0.4, 0, -0.15);
    c.arms[1].rotation.set(-2.75 - k * 0.4, 0, 0.15);
    c.elbows[0].rotation.x = -0.5 - Math.max(0, k) * 0.7;
    c.elbows[1].rotation.x = -0.5 - Math.max(0, -k) * 0.7;
    c.legs[0].rotation.x = -0.6 - k * 0.45;
    c.legs[1].rotation.x = -0.6 + k * 0.45;
    c.knees[0].rotation.x = 1.0 + k * 0.45;
    c.knees[1].rotation.x = 1.0 - k * 0.45;
    c.body.position.y = 0;
    c.body.rotation.set(-0.05, 0, 0);
    c.torso.rotation.set(0, 0, 0);
    c.head.rotation.set(-0.35, 0, 0);          // looking up the wall
    c.hatTip.rotation.x = -0.4;
    for (const fl of c.flames) fl.visible = false;
  }

  animateRiding() {
    const c = this.char;
    const flow = Math.min(Math.abs(this.ride.speed) / 30, 1.3);
    c.legs[0].rotation.set(-1.35, 0, 0.12);
    c.legs[1].rotation.set(-1.35, 0, -0.12);
    c.knees[0].rotation.x = c.knees[1].rotation.x = 1.45;
    c.body.position.y = 0;
    c.body.rotation.set(0.12 + flow * 0.12, 0, 0);
    c.torso.rotation.set(0.12, 0, 0);
    c.arms[0].rotation.set(-1.0, 0, -0.2);
    c.arms[1].rotation.set(-1.0, 0, 0.2);
    c.elbows[0].rotation.x = c.elbows[1].rotation.x = -0.6;
    c.head.rotation.set(-0.15, 0, 0);
    c.hatTip.rotation.x = -0.55 - flow * 0.5 + Math.sin(this.time * 20) * 0.06 * flow;  // flaps in the wind
    for (const fl of c.flames) fl.visible = false;
  }

  /**
   * Walk / run cycle driven by distance travelled (no foot sliding):
   * hips swing more and knees fold higher as speed rises, the body bobs up at
   * mid-stance when walking and dips (compresses) when running, leans into
   * speed and banks into turns, the torso twists against the hips, arms swing
   * opposite with elbows bending as you run, and the hat tip bounces. Idle has
   * breathing and a slow look around; landings squash.
   */
  animate(dt, hs) {
    const c = this.char;
    const L = THREE.MathUtils.lerp, sm = THREE.MathUtils.smoothstep;
    const moving = sm(hs, 0.3, 2.5);
    const run = sm(hs, WALK * 0.8, RUN * 0.9);
    // turn rate (for banking)
    let dh = this.heading - (this._lastHeading ?? this.heading);
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this._lastHeading = this.heading;
    this._turn = L(this._turn ?? 0, dt > 0 ? dh / dt : 0, 1 - Math.exp(-8 * dt));
    // landing squash
    if (this.onGround && this._wasAir) this._land = Math.min(1, (this._airTime ?? 0) * 1.5);
    this._wasAir = !this.onGround;
    this._airTime = this.onGround ? 0 : (this._airTime ?? 0) + dt;
    this._land = Math.max(0, (this._land ?? 0) - dt * 4);

    if (this.onGround) {
      const cycle = L(1.55, 3.0, run);                    // metres per full gait cycle
      this.phase += (hs / cycle) * Math.PI * 2 * dt;
    }
    const ph = this.phase;
    const hipAmp = L(0.5, 0.95, run) * moving;
    const kneeAmp = L(0.75, 1.75, run) * moving;
    const hip0 = Math.sin(ph) * hipAmp;                   // + = leg back
    const knee0 = Math.max(0, -Math.cos(ph)) * kneeAmp;   // folds while swinging forward
    const knee1 = Math.max(0, Math.cos(ph)) * kneeAmp;

    // footprints: a foot plants each half cycle
    if (this.onGround && hs > 1 && this.onStep && Math.floor(ph / Math.PI) !== Math.floor(this._prevPhase / Math.PI)) {
      this._stepSide *= -1;
      const d = this.frame.dir(this.heading, _v1);
      const r = _v2.crossVectors(d, this.frame.up);
      this.onStep(_v3.copy(this.pos).addScaledVector(r, this._stepSide * 0.11).addScaledVector(d, 0.1), this.heading, this.frame.up);
    }
    this._prevPhase = ph;

    for (const f of c.flames) {
      f.visible = this.thrusting;
      f.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    }

    const t = this.time;
    const breathe = Math.sin(t * 2.1) * 0.012 * (1 - moving);
    // vertical bob: up at mid-stance for a walk, compressed for a run
    const walkBob = 0.5 + 0.5 * Math.cos(2 * ph);
    const bob = L(walkBob, 1 - walkBob, run) * L(0.035, 0.09, run) * moving;
    const lean = L(0.03, 0.3, run) * moving;
    const bank = THREE.MathUtils.clamp(-this._turn * 0.06 * moving, -0.3, 0.3);

    if (!this.onGround && !this.thrusting && !this.gliding) {
      // airborne: one leg tucked, one reaching, arms up for balance
      c.legs[0].rotation.x = -0.6; c.legs[1].rotation.x = 0.25;
      c.knees[0].rotation.x = 1.1; c.knees[1].rotation.x = 0.4;
      c.arms[0].rotation.set(-0.5, 0, -0.55); c.arms[1].rotation.set(0.3, 0, 0.55);
      c.elbows[0].rotation.x = -0.9; c.elbows[1].rotation.x = -0.4;
      c.body.position.y = 0;
      c.body.rotation.set(0.1, 0, bank);
      c.torso.rotation.set(0, 0, 0);
      c.head.rotation.set(-0.1, 0, 0);
      c.hatTip.rotation.x = -0.25;                        // blown up by the fall
      return;
    }
    if (this.thrusting) {
      c.legs[0].rotation.x = 0.2; c.legs[1].rotation.x = -0.15;
      c.knees[0].rotation.x = 0.5; c.knees[1].rotation.x = 0.3;
      c.arms[0].rotation.set(0.25, 0, -0.5); c.arms[1].rotation.set(0.25, 0, 0.5);
      c.elbows[0].rotation.x = c.elbows[1].rotation.x = -0.3;
      c.body.position.y = 0;
      c.body.rotation.set(0.15, 0, bank);
      c.torso.rotation.set(0, 0, 0);
      c.head.rotation.set(-0.2, 0, 0);
      c.hatTip.rotation.x = -1.0 + Math.sin(t * 25) * 0.08;
      return;
    }
    if (this.gliding) {
      c.legs[0].rotation.x = 0.3; c.legs[1].rotation.x = 0.1;
      c.knees[0].rotation.x = 0.4; c.knees[1].rotation.x = 0.2;
      c.arms[0].rotation.set(0, 0, -1.45); c.arms[1].rotation.set(0, 0, 1.45);
      c.elbows[0].rotation.x = c.elbows[1].rotation.x = 0;
      c.body.position.y = 0;
      c.body.rotation.set(0.35, 0, bank * 2);
      c.torso.rotation.set(0, 0, 0);
      c.head.rotation.set(-0.3, 0, 0);
      c.hatTip.rotation.x = -1.1 + Math.sin(t * 14) * 0.08;
      return;
    }

    // ---- ground: walk / run / idle
    const squash = this._land;
    c.legs[0].rotation.set(hip0 - squash * 0.5, 0, 0.02);
    c.legs[1].rotation.set(-hip0 - squash * 0.5, 0, -0.02);
    c.knees[0].rotation.x = knee0 + 0.06 + squash * 1.0;
    c.knees[1].rotation.x = knee1 + 0.06 + squash * 1.0;
    c.body.position.y = bob - squash * 0.14 + breathe * 0.3;
    c.body.rotation.set(lean + squash * 0.15, 0, bank);
    // torso twists against the hips; idle breathing
    c.torso.rotation.set(0, Math.sin(ph) * 0.16 * moving, -Math.sin(ph) * 0.03 * run);
    c.torso.scale.y = 1 + breathe;
    // arms swing opposite the same-side leg, elbows fold as you run
    const armK = L(0.8, 1.15, run);
    c.arms[0].rotation.set(-hip0 * armK, 0, -0.08 - run * 0.1);
    c.arms[1].rotation.set(hip0 * armK, 0, 0.08 + run * 0.1);
    c.elbows[0].rotation.x = -(0.15 + L(0.2, 1.5, run) * moving + Math.max(0, -Math.sin(ph)) * 0.4 * run);
    c.elbows[1].rotation.x = -(0.15 + L(0.2, 1.5, run) * moving + Math.max(0, Math.sin(ph)) * 0.4 * run);
    // head: keeps looking ahead while moving, looks around when idle
    const look = (1 - moving) * (Math.sin(t * 0.37) * 0.5 + Math.sin(t * 0.13) * 0.3);
    c.head.rotation.set(-lean * 0.7 + (1 - moving) * Math.sin(t * 0.21) * 0.08, look - Math.sin(ph) * 0.1 * moving, 0);
    // hat tip: springs with the bob, trails back with speed
    c.hatTip.rotation.x = -0.55 - hs * 0.018 + Math.cos(2 * ph) * 0.12 * moving + squash * 0.4;
    c.hatTip.rotation.z = Math.sin(ph) * 0.1 * moving;
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
    // (skipped while gravity is rolling the view: the swinging ray would
    // otherwise clip the floor and yank the camera in)
    const rolling = this.camera.up.dot(U) < 0.985;
    const hit = rolling ? Infinity : this.physics.rayDistance(this._look, this._dir, dist + 0.5);
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
