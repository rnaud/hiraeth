import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { Cape } from './cape.js';
import { Trinkets } from './trinkets.js';

const RADIUS = 0.45;
const STEP = 0.6;    // obstacles lower than this are stepped onto
const HEIGHT = 2.2;
// m/s, matched to the mocap clips: the default pace plays the jog loop at
// ~1x, SHIFT the sprint loop with a slightly lengthened stride
const WALK = 5.5;
const RUN = 11;
const GRAVITY = 32;
const JUMP = 13;
const LIMIT = 1900;
const JET_THRUST = 54;     // m/s² upward while thrusting (gravity is 32)
const JET_MAX_UP = 15;
const JET_DRAIN = 0.1;     // fuel per second (~10 s of thrust)
const JET_REFILL = 0.55;

function part(geo, color, opts = {}) {
  return new THREE.Mesh(geo, makeMaterial({ color, ...opts }));
}

// An Arzach-style rider: tall and gaunt, swallowed by an enormous red hooded
// cloak that reaches the ankles and flares out behind when running, a long
// pale face with a long thin nose, a peaked hood whose tip trails behind.
export const RIDER_COLORS = { cloak: '#3f5fae', cloak2: '#7a4fa8', lining: '#2f3f80', cloth: '#343a56', legs: '#2b2f45', wrap: '#e2d3b4',
  face: '#f1e6d0', ink: '#2b211f', belt: '#d8a24a', robe: '#ead9b4', robe2: '#c9a577' };

/** @param palette overrides for RIDER_COLORS (NPCs use their own) */
export function buildCharacter(palette = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();          // whole-figure bob / lean / bank
  root.add(body);
  const C = { ...RIDER_COLORS, ...palette };

  const pelvis = part(new THREE.CylinderGeometry(0.12, 0.13, 0.15, 10), C.cloth);
  pelvis.position.y = 0.99;
  body.add(pelvis);

  // long thin legs with knees, wrapped boots
  const legs = [], knees = [], feet = [];
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
    // the boot hangs from an ankle pivot so it can stay flat on the ground
    const ankle = new THREE.Group();
    ankle.position.y = -0.43;
    const boot = part(new THREE.BoxGeometry(0.1, 0.08, 0.25), C.wrap, { flat: true });
    boot.position.set(0, 0, 0.06);
    ankle.add(boot);
    knee.add(shin, wrap, ankle);
    pivot.add(thigh, knee);
    body.add(pivot);
    legs.push(pivot);
    knees.push(knee);
    feet.push(ankle);
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

  // the cloak itself is a cloth simulation (cape.js), pinned under this collar
  const collar = part(new THREE.TorusGeometry(0.19, 0.035, 6, 18).rotateX(Math.PI / 2), C.lining);
  collar.position.y = 0.74;
  torso.add(collar);

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

  return { root, body, torso, head, hatTip, legs, knees, feet, arms, elbows, scarf, scarf2, pack, bedroll, jetpack, flames,
    scarfAnchors: [], colors: C };
}

const _v1 = new THREE.Vector3();
const _tq = new THREE.Quaternion(), _te = new THREE.Euler();
const _g1 = new THREE.Vector3(), _g2 = new THREE.Vector3(), _g3 = new THREE.Vector3(), _g4 = new THREE.Vector3(), _g5 = new THREE.Vector3(), _g6 = new THREE.Vector3();
const LEG_A = 0.49, LEG_B = 0.47;   // thigh, shin+foot
// climbing key poses (rig angles in radians; arm x < 0 raises the arm forward/up)
const CLIMB_KEYS = {
  A: { armL: -3.05, armLz: 0.15, elbL: -0.25, armR: -1.75, armRz: -0.25, elbR: -1.55,
       legL: -0.35, kneeL: 0.55, footL: -0.2, legR: -1.15, kneeR: 1.75, footR: -0.5, sway: 1, lift: 0 },
  B: { armL: -1.75, armLz: 0.25, elbL: -1.55, armR: -3.05, armRz: -0.15, elbR: -0.25,
       legL: -1.15, kneeL: 1.75, footL: -0.5, legR: -0.35, kneeR: 0.55, footR: -0.2, sway: -1, lift: 0 },
};
const _cu = new THREE.Vector3(), _cs = new THREE.Vector3(), _cb = new THREE.Vector3(), _cw = new THREE.Vector3();
const _ca = new THREE.Vector3(), _cbb = new THREE.Vector3(), _cA = new THREE.Vector3(), _cv = new THREE.Vector3();
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
    // the paraglider: a curved, striped wing over the head with lines down to the hands
    {
      const wing = new THREE.Group();
      // an arc spanning left-right over the head (chord along the flight direction), top at the origin
      const g = new THREE.CylinderGeometry(4.2, 4.2, 2.2, 28, 1, true, Math.PI - 0.85, 1.7);
      g.rotateX(Math.PI / 2).translate(0, -4.2, 0);
      const top = new THREE.Mesh(g, makeMaterial({ color: '#f2c54b', color2: '#c8483a', color3: '#f3ead8', mode: 2, strataSize: 0.35, side: THREE.DoubleSide }));
      wing.add(top);
      // risers: unit tubes re-aimed every frame from the canopy to the hands
      const lineMat = makeMaterial({ color: '#34405e' });
      const unit = new THREE.CylinderGeometry(0.014, 0.014, 1, 3, 1, true).translate(0, 0.5, 0);
      this.risers = [];
      for (const sx of [-1, 1]) for (const k of [0.3, 0.6, 0.85]) {
        const a = sx * k;
        const m = new THREE.Mesh(unit, lineMat);
        m.visible = false;
        m.userData.noCollide = true;
        m.frustumCulled = false;
        this.object.add(m);
        this.risers.push({ mesh: m, at: new THREE.Vector3(Math.sin(a) * 4.2, Math.cos(a) * 4.2 - 4.2, 0), hand: sx < 0 ? 'r' : 'l' });
      }
      wing.position.set(0, 4.7, -0.1);
      wing.visible = false;
      wing.userData.noCollide = true;
      this.object.add(wing);
      this.wing = wing;
    }
    scene.add(this.object);
    this.scene = scene;
    // a shorter cape, so the clutter on the belt shows
    this.cape = new Cape(scene, this.char.capeAnchor ?? this.char.torso, { rows: 9, length: 0.95, bottom: 0.4, color: this.char.colors.cloak, color2: this.char.colors.cloak2 });
    if (this.humanoid) {
      this.trinkets = new Trinkets(this.char.capeAnchor);
      if (this.char.pack) this.char.pack.visible = false;
      this._lastVel = new THREE.Vector3();
    }
    this.tails = this.char.scarfAnchors.map((_, i) =>
      new ClothTail(scene, i === 0 ? { points: 10, seg: 0.2, width: 0.2 } : { points: 7, seg: 0.18, width: 0.16 }));
  }

  /** Torso and leg capsules in world space, for the cape to collide with. */
  bodyCapsules() {
    const c = this.char;
    if (!this._caps) {
      this._caps = [{ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.2 }];
      for (let i = 0; i < 2; i++) this._caps.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.11 }, { a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.09 });
      if (this.char.jetpack.visible) this._caps.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.2 });
    }
    const K = this._caps;
    c.torso.localToWorld(K[0].a.set(0, 0.05, 0));
    c.torso.localToWorld(K[0].b.set(0, 0.6, 0));
    for (let i = 0; i < 2; i++) {
      c.legs[i].localToWorld(K[1 + i * 2].a.set(0, 0, 0));
      c.knees[i].localToWorld(K[1 + i * 2].b.set(0, 0, 0));
      K[2 + i * 2].a.copy(K[1 + i * 2].b);
      c.feet[i].localToWorld(K[2 + i * 2].b.set(0, 0, 0.05));
    }
    if (K[5]) { c.jetpack.localToWorld(K[5].a.set(0, -0.2, -0.02)); c.jetpack.localToWorld(K[5].b.set(0, 0.25, -0.02)); }
    return K;
  }

  updateCloth(dt) {
    // the robe: a short front-open skirt of heavy cloth hanging from the waist, kicked by the legs
    const pelvis = this.humanoid?.b?.pelvis;
    if (pelvis && !this.robe) {
      this.waist = new THREE.Object3D();
      this.scene.add(this.waist);
      this.robe = new Cape(this.scene, this.waist, { cols: 12, rows: 6, top: 0.17, bottom: 0.33, length: 0.62, y: 0.1, gap: 0.6, color: this.char.colors.robe ?? '#c98f52', color2: this.char.colors.robe2 ?? '#8a5a3c' });
    }
    if (this.robe) {
      this.object.updateMatrixWorld(true);
      pelvis.getWorldPosition(this.waist.position);
      this.object.getWorldQuaternion(this.waist.quaternion);
      this.robe.mesh.visible = this.object.visible;
      this.robe.update(dt, {
        up: this.frame.up,
        vel: this.ride ? this.ride.vel : this.climbing ? _cv.set(0, 0, 0) : this.vel,
        wind: this.wind, floor: this.pos,
        capsules: this.humanoid.capsules(),
        spread: 0, lift: this.thrusting ? 0.5 : 0,
      });
    }
    if (this.cape) {
      this.object.updateMatrixWorld(true);
      this.cape.update(dt, {
        up: this.frame.up,
        vel: this.ride ? this.ride.vel : this.climbing ? _cv.set(0, 0, 0) : this.vel,
        wind: this.wind,
        floor: this.pos,
        capsules: this.humanoid ? this.humanoid.capsules() : this.bodyCapsules(),
        spread: this.gliding ? 1 : 0,
        lift: this.thrusting ? 1 : 0,
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
      this.humanoid?.update();
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

    let f = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
    let s = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
    const run = input.ShiftLeft || input.ShiftRight;
    // analog stick (touch): direction and partial speed
    let stickScale = 1;
    if (input.stick && (input.stick.x || input.stick.y)) {
      f = input.stick.y; s = input.stick.x;
      stickScale = Math.min(Math.hypot(f, s), 1);
    }

    if (this.mantle) {
      this.updateMantle(dt);
      this.finishFrame(dt, 0);
      return;
    }
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

    let speed = (run ? RUN : WALK) * (stickScale < 1 ? THREE.MathUtils.lerp(0.35, 1, stickScale) : 1);
    if (this.gliding) speed *= 1.25;
    if (this.thrusting) speed *= 1.9;
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
    // Shift + Space glides even when there's fuel left
    const wantGlide = !this.onGround && input.Space && (run || !this.opts.jetpack || this.fuel <= 0);
    this.thrusting = this.opts.jetpack && !this.onGround && input.Space && this.fuel > 0 && !jumpedNow && !wantGlide;
    if (this.thrusting) {
      // tilted forward: part of the thrust drives you along when you steer
      if (move.lengthSq() > 0) tv.addScaledVector(move, JET_THRUST * 0.35 * dt);
      vu = Math.min(vu + JET_THRUST * dt, JET_MAX_UP);
      this.fuel = Math.max(this.fuel - JET_DRAIN * dt, 0);
    } else if (this.onGround) {
      this.fuel = Math.min(this.fuel + JET_REFILL * dt, 1);
    }
    // Paraglider: opens when you hold Space while falling. You fly forward with
    // momentum along your heading: A/D bank and turn, W dives (faster, sinks
    // more), S flares (slow, floaty).
    const wasGliding = this.gliding;
    this.gliding = wantGlide && (vu < 0 || wasGliding);
    if (this.gliding) {
      if (!wasGliding) this.glideSpeed = Math.max(Math.hypot(tv.x, tv.z), 11);
      const target = f > 0 ? 30 : f < 0 ? 7 : 15;
      this.glideSpeed += (target - this.glideSpeed) * (1 - Math.exp(-(f > 0 ? 0.9 : 0.6) * dt));
      const sink = f > 0 ? 7 : f < 0 ? 1.3 : 2.4;
      this.glideTurn = THREE.MathUtils.lerp(this.glideTurn ?? 0, -s * 1.25, 1 - Math.exp(-4 * dt));
      this.heading += this.glideTurn * dt;
      tv.copy(F.dir(this.heading, _g6)).multiplyScalar(this.glideSpeed);
      vu += GRAVITY * dt;                                  // the wing carries you: no free fall
      vu += (-sink - vu) * (1 - Math.exp(-3 * dt));
    } else this.glideTurn = 0;
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
    if (hs > 0.5 && !this.gliding) {
      let d = F.headingOf(tvel) - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-12 * dt));
    }
    this.finishFrame(dt, hs);
  }

  finishFrame(dt, hs) {
    if (this.wing) {
      // the wing pops open and banks into turns
      const open = this.gliding ? 1 : 0;
      this._wingK = THREE.MathUtils.lerp(this._wingK ?? 0, open, 1 - Math.exp(-(open ? 9 : 14) * dt));
      this.wing.visible = this._wingK > 0.03;
      for (const r of this.risers ?? []) r.mesh.visible = this.wing.visible && !!this.humanoid;
      this.wing.scale.set(this._wingK, 0.6 + 0.4 * this._wingK, 1);
      this.wing.rotation.z = -(this.glideTurn ?? 0) * 0.35;
    }
    this._animAcc += dt;
    if (!this.stopMotion || this._animAcc >= 1 / 12) {
      if (this.mantle) this.animateMantle();
      else if (this.climbing) this.animateClimb(this._animAcc);
      else this.animate(this._animAcc, hs);
      this._animAcc = 0;
    }
    this.object.position.copy(this.pos);
    this.frame.quaternion(this.heading, this.object.quaternion);
    const H = this.humanoid;
    if (H) {
      H.update();
      const U = this.frame.up;
      if (this.mantle) { H.resetFeet(); H.reach(this.mantleTargets()); }
      else if (this.climbing) { H.resetFeet(); H.reach(this.climbTargets()); }
      else if (this.onGround && this.animator && !this.thrusting) {
        H.plantFeet(dt, this.physics, U, this.pos, this.frame.dir(this.heading, _g1).clone(), (p, side, n) => this.stepped(p.clone(), 0, n));
      } else H.resetFeet();
      if (this.wing && this._wingK > 0.03) this.holdWing();
    }
    if (this.trinkets && dt > 0) {
      const v = this.ride ? this.ride.vel : this.vel;
      const acc = _g4.subVectors(v, this._lastVel).divideScalar(dt);
      this._lastVel.copy(v);
      acc.applyQuaternion(_tq.copy(this.object.quaternion).invert());
      const moving = this.ride ? 0.3 : Math.min(Math.hypot(this.vel.x, this.vel.z) / 6, 1);
      this.trinkets.update(dt, acc.clampLength(0, 40), this.phase ?? 0, this.onGround ? moving : 0.4);
    }
    this.updateCloth(dt);
  }

  /** Gliding: both hands up on the brake handles, the canopy above them, the risers running into the fists. */
  holdWing() {
    const H = this.humanoid, B = H.b, U = this.frame.up, k = this._wingK;
    const fwd = this.frame.dir(this.heading, _g1), back = _g2.copy(fwd).negate();
    const right = _g3.crossVectors(fwd, U).normalize();
    const hands = ['r', 'l'].map((s, i) => {
      const sh = B[`upperarm_${s}`].getWorldPosition(new THREE.Vector3());
      const pull = (i === 0 ? 1 : -1) * (this.glideTurn ?? 0) * 0.25;     // pull the brake on the side you turn to
      return sh.addScaledVector(U, 0.5 - Math.max(0, pull)).addScaledVector(right, (i === 0 ? 1 : -1) * 0.12).addScaledVector(fwd, 0.08);
    });
    H.reach({ hands, wallN: back, up: U });
    this.object.updateMatrixWorld(true);
    // the canopy rides 3.4 m above the hands' midpoint
    const mid = new THREE.Vector3();
    for (const s of ['r', 'l']) mid.add(B[`hand_${s}`].getWorldPosition(_g4)).multiplyScalar(1);
    mid.multiplyScalar(0.5);
    this.object.worldToLocal(mid);
    this.wing.position.set(mid.x, mid.y + 3.4 * (0.6 + 0.4 * k), mid.z);
    this.wing.updateMatrixWorld(true);
    for (const r of this.risers) {
      const p0 = this.wing.localToWorld(_g4.copy(r.at));
      const p1 = B[`hand_${r.hand}`].getWorldPosition(_g5);
      this.object.worldToLocal(p0); this.object.worldToLocal(p1);
      const d = p1.sub(p0), len = d.length();
      r.mesh.position.copy(p0);
      r.mesh.quaternion.setFromUnitVectors(_g6.set(0, 1, 0), d.divideScalar(len || 1));
      r.mesh.scale.set(1, len, 1);
    }
  }

  /** Hand and foot holds on the wall for the current point of the climb cycle. */
  climbTargets() {
    const B = this.humanoid.b, U = this.frame.up, n = this.wallN, into = _g6.copy(n).negate();
    const cyc = ((this.phase / (Math.PI * 2)) % 1 + 1) % 1;
    const tri = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
    const t = tri * tri * (3 - 2 * tri);
    const hold = (base, out) => {
      const hit = this.physics.rayHit(_g5.copy(base).addScaledVector(n, 0.6), into, 1.6);
      return hit ? hit.point.addScaledVector(n, out) : base.clone().addScaledVector(into, 0.3);
    };
    const hands = [], feet = [];
    ['r', 'l'].forEach((s, i) => {
      const k = i === 0 ? t : 1 - t;                    // one hand reaches while the other pulls
      const sh = B[`upperarm_${s}`].getWorldPosition(new THREE.Vector3());
      hands.push(hold(sh.addScaledVector(U, 0.12 + 0.48 * k), 0.05));
      const hip = B[`thigh_${s}`].getWorldPosition(new THREE.Vector3());
      feet.push(hold(hip.addScaledVector(U, -0.78 + 0.38 * (1 - k)), 0.1));   // the opposite foot steps up
    });
    return { hands, feet, wallN: n, up: U };
  }

  // ------------------------------------------------------------------ mantling
  /** Near the top of a wall (or where it turns into a slope): look for a surface to pull up onto. */
  tryMantle(U, into) {
    for (const d of [0.55, 0.9, 1.3]) {
      const probe = _g5.copy(this.pos).addScaledVector(U, 2.7).addScaledVector(into, d);
      const hit = this.physics.rayHit(probe, _g6.copy(U).negate(), 3.4);
      if (!hit || hit.normal.dot(U) < 0.45) continue;
      const rise = _g4.subVectors(hit.point, this.pos).dot(U);
      if (rise < -0.3 || rise > 2.8) continue;
      this.climbing = false;
      this.mantle = { from: this.pos.clone(), to: hit.point.clone(), edge: this.pos.clone().addScaledVector(U, Math.max(rise, 0)).addScaledVector(into, 0.32), rise, t: 0, n: this.wallN.clone() };
      this.vel.set(0, 0, 0);
      return true;
    }
    return false;
  }

  updateMantle(dt) {
    const M = this.mantle, U = this.frame.up;
    M.t = Math.min(M.t + dt / 0.75, 1);
    const ease = (x) => x * x * (3 - 2 * x);
    // up first (hauling the body over the edge), then forward onto the top
    const up = ease(Math.min(M.t / 0.6, 1)), fwd = ease(Math.max((M.t - 0.35) / 0.65, 0));
    const lift = M.rise + 0.25 * Math.sin(Math.PI * Math.min(M.t / 0.85, 1));
    this.pos.copy(M.from).addScaledVector(U, lift * up);
    const horiz = _g4.subVectors(M.to, M.from).addScaledVector(U, -_g4.subVectors(M.to, M.from).dot(U));
    this.pos.addScaledVector(horiz, fwd);
    this.phase += dt * 4;
    if (M.t >= 1) {
      this.pos.copy(M.to);
      this.mantle = null;
      this.onGround = true;
      this.vel.set(0, 0, 0);
    }
  }

  mantleTargets() {
    const M = this.mantle, U = this.frame.up;
    const side = _g5.crossVectors(U, M.n).normalize();
    const hands = [M.edge.clone().addScaledVector(side, 0.22), M.edge.clone().addScaledVector(side, -0.22)];
    // feet scrabble up the wall in the first half, then step onto the top
    const k = Math.min(M.t / 0.6, 1);
    const feet = M.t < 0.6 ? [0, 1].map((i) => M.from.clone().addScaledVector(U, M.rise * k * (i ? 0.7 : 0.4)).addScaledVector(M.n, -0.35)) : null;
    return { hands, feet, wallN: M.n, up: U };
  }

  animateMantle() {
    const c = this.char, k = this.mantle.t;
    c.body.position.set(0, 0, 0);
    c.body.rotation.set(0.35 * Math.sin(Math.PI * k), 0, 0);
    c.torso.rotation.set(0.2, 0, 0);
    c.head.rotation.set(-0.2 + k * 0.3, 0, 0);
    c.arms[0].rotation.set(-1.4 + k * 1.1, 0, -0.15); c.arms[1].rotation.set(-1.4 + k * 1.1, 0, 0.15);
    c.elbows[0].rotation.set(-0.8, 0, 0); c.elbows[1].rotation.set(-0.8, 0, 0);
    c.legs[0].rotation.set(-1.3 * Math.sin(Math.PI * k), 0, 0); c.legs[1].rotation.set(-0.4, 0, 0);
    c.knees[0].rotation.set(1.6 * Math.sin(Math.PI * k), 0, 0); c.knees[1].rotation.set(0.6, 0, 0);
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
    // the wall ended (a ledge) or leans back into a slope: pull up onto it
    if (!hit) { if (f >= 0 && this.tryMantle(U, into)) return; this.stopClimb(false); return; }
    n.copy(hit.normal);
    if (n.dot(U) > 0.55) { if (!this.tryMantle(U, into)) this.stopClimb(true); return; }
    if (n.dot(U) < -0.6) { this.stopClimb(false); return; }                // an overhang
    // stick to the wall
    this.pos.copy(hit.point).addScaledVector(n, RADIUS + 0.08).addScaledVector(U, -1.2);

    // reached the top: nothing in front at head height -> mantle over
    const head = _v2.copy(this.pos).addScaledVector(U, 2.3);
    if (f > 0 && !this.physics.rayHit(head, into, 1.6) && this.tryMantle(U, into)) return;

    const right = _v3.crossVectors(into, U).normalize();   // screen-right while facing the wall
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

  /**
   * Keyframed climbing: two key poses (left hand reaching / right hand
   * reaching), eased between as you move, so one arm stretches up while the
   * other pulls and the opposite knee steps high; hips sway toward the pulling
   * side, and the head looks up the wall.
   */
  animateClimb() {
    const c = this.char;
    this._gait = null;
    const K = CLIMB_KEYS;
    const cyc = ((this.phase / (Math.PI * 2)) % 1 + 1) % 1;
    const tri = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;              // 0 -> 1 -> 0
    const t = tri * tri * (3 - 2 * tri);                        // ease
    const L = (a, b) => a + (b - a) * t;
    const P = {};
    for (const k in K.A) P[k] = L(K.A[k], K.B[k]);
    c.arms[0].rotation.set(P.armR, 0, P.armRz);  c.elbows[0].rotation.set(P.elbR, 0, 0);
    c.arms[1].rotation.set(P.armL, 0, P.armLz);  c.elbows[1].rotation.set(P.elbL, 0, 0);
    c.legs[0].rotation.set(P.legR, 0, -0.08);    c.knees[0].rotation.set(P.kneeR, 0, 0);
    c.legs[1].rotation.set(P.legL, 0, 0.08);     c.knees[1].rotation.set(P.kneeL, 0, 0);
    c.feet[0].rotation.set(P.footR, 0, 0);       c.feet[1].rotation.set(P.footL, 0, 0);
    c.body.position.set(P.sway * 0.06, P.lift * 0.05, 0);
    c.body.rotation.set(-0.08, 0, P.sway * 0.07);
    c.torso.rotation.set(0, P.sway * 0.12, 0);
    c.head.rotation.set(-0.45, -P.sway * 0.2, 0);
    for (const fl of c.flames) fl.visible = false;
  }

  animateRiding() {
    const c = this.char;
    this._gait = null;
    for (const f of c.feet) f.rotation.set(0, 0, 0);
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
   * Locomotion with planted feet.
   * Each foot alternates stance (planted where it landed, on the real ground:
   * slopes, steps, rocks) and swing (an arc to where it will land next,
   * predicted from the velocity). A two-bone IK solves hip and knee for each
   * foot target; the pelvis drops when a foot has to reach down. Walking
   * keeps a foot down most of the time and bobs up at mid-stance; running has
   * a flight phase, compresses at contact, leans in and pumps the arms.
   * Standing still, feet stay put and take small corrective steps when you
   * turn. Airborne / glide / jetpack keep authored poses.
   */
  animate(dt, hs) {
    if (this.animator && !this.thrusting && !this.gliding) return this.animateClips(dt, hs);
    const c = this.char;
    const L = THREE.MathUtils.lerp, sm = THREE.MathUtils.smoothstep;
    const moving = sm(hs, 0.3, 2.5);
    const run = sm(hs, WALK * 0.8, RUN * 0.9);
    let dh = this.heading - (this._lastHeading ?? this.heading);
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this._lastHeading = this.heading;
    this._turn = L(this._turn ?? 0, dt > 0 ? dh / dt : 0, 1 - Math.exp(-8 * dt));
    if (this.onGround && this._wasAir) { this._land = Math.min(1, (this._airTime ?? 0) * 1.5); this._gait = null; }
    this._wasAir = !this.onGround;
    this._airTime = this.onGround ? 0 : (this._airTime ?? 0) + dt;
    this._land = Math.max(0, (this._land ?? 0) - dt * 4);
    for (const f of c.flames) {
      f.visible = this.thrusting;
      f.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    }
    const t = this.time;
    const bank = THREE.MathUtils.clamp(-this._turn * 0.06 * moving, -0.3, 0.3);
    for (const f of c.feet) f.rotation.set(0, 0, 0);

    if (!this.onGround || this.thrusting || this.gliding) {
      this._gait = null;
      c.body.position.y = 0;
      c.torso.rotation.set(0, 0, 0);
      if (this.thrusting) {
        c.legs[0].rotation.set(0.2, 0, 0); c.legs[1].rotation.set(-0.15, 0, 0);
        c.knees[0].rotation.x = 0.5; c.knees[1].rotation.x = 0.3;
        c.arms[0].rotation.set(0.25, 0, -0.5); c.arms[1].rotation.set(0.25, 0, 0.5);
        c.elbows[0].rotation.x = c.elbows[1].rotation.x = -0.3;
        // lean into the flight: more the faster you go
        const fly = THREE.MathUtils.clamp(hs / (RUN * 1.9), 0, 1);
        c.body.rotation.set(0.2 + fly * 0.65, 0, bank);
        c.head.rotation.set(-0.25 - fly * 0.45, 0, 0);
        c.legs[0].rotation.set(0.2 + fly * 0.3, 0, 0); c.legs[1].rotation.set(-0.1 + fly * 0.35, 0, 0);
        c.arms[0].rotation.set(0.25 + fly * 0.5, 0, -0.35); c.arms[1].rotation.set(0.25 + fly * 0.5, 0, 0.35);
        c.hatTip.rotation.x = -0.5 + Math.sin(t * 25) * 0.08;
      } else if (this.gliding) {
        c.legs[0].rotation.set(0.3, 0, 0); c.legs[1].rotation.set(0.1, 0, 0);
        c.knees[0].rotation.x = 0.4; c.knees[1].rotation.x = 0.2;
        c.arms[0].rotation.set(0, 0, -1.45); c.arms[1].rotation.set(0, 0, 1.45);
        c.elbows[0].rotation.x = c.elbows[1].rotation.x = 0;
        c.body.rotation.set(0.35, 0, bank * 2);
        c.head.rotation.set(-0.3, 0, 0);
        c.hatTip.rotation.x = -0.6 + Math.sin(t * 14) * 0.08;
      } else {
        // airborne: one leg tucked, one reaching, arms out for balance
        const up = this.vel.dot(this.frame.up) > 0;
        c.legs[0].rotation.set(up ? -0.7 : -0.35, 0, 0); c.legs[1].rotation.set(up ? 0.3 : 0.1, 0, 0);
        c.knees[0].rotation.x = up ? 1.2 : 0.7; c.knees[1].rotation.x = up ? 0.5 : 0.25;
        c.arms[0].rotation.set(-0.5, 0, -0.6); c.arms[1].rotation.set(0.3, 0, 0.6);
        c.elbows[0].rotation.x = -0.9; c.elbows[1].rotation.x = -0.4;
        c.body.rotation.set(0.1, 0, bank);
        c.head.rotation.set(-0.1, 0, 0);
        c.hatTip.rotation.x = up ? 0.2 : -0.1;
      }
      return;
    }

    // ---------------------------------------------------------- gait
    const U = this.frame.up;
    const fwd = this.frame.dir(this.heading, _g1);
    const right = _g2.crossVectors(U, fwd).normalize().negate();   // character's right (-x local)
    const G = (this._gait ??= this.initGait(fwd, right));
    const duty = L(0.62, 0.3, run);                                 // fraction of the cycle a foot is down
    const cycle = L(1.6, 2.7, run);                                  // metres per gait cycle (two steps)
    const liftH = L(0.1, 0.32, run);
    if (moving > 0.05) G.phase = (G.phase + (hs / cycle) * dt) % 1;
    const hipW = 0.085;

    for (let i = 0; i < 2; i++) {
      const F = G.feet[i];
      const side = i === 0 ? -1 : 1;                                   // legs[0] is on the -x side
      // where this foot will land: the body travels (1 - p) * cycle before
      // touchdown, and the foot lands half a stance ahead of the hips
      const p = (G.phase + i * 0.5) % 1;
      const ahead = moving > 0.05 ? (p >= duty ? (1 - p) * cycle : 0) + duty * cycle * 0.45 : 0;
      // the moving velocity direction, not the facing (so strafing / turning plants correctly)
      const dir = hs > 0.5 ? _g6.copy(this.vel).addScaledVector(U, -this.vel.dot(U)).normalize() : fwd;
      _g3.copy(this.pos).addScaledVector(dir, ahead).addScaledVector(right, -side * hipW * L(1.3, 0.8, run));
      this.groundPoint(_g3, U);
      if (moving > 0.05) {
        const swing = p >= duty;
        if (swing && !F.swinging) { F.swinging = true; F.from.copy(F.plant); }
        if (!swing && F.swinging) {                                    // touch down
          F.swinging = false;
          F.plant.copy(_g3);
          this.stepped(F.plant, i);
        }
        if (swing) {
          const s = sm((p - duty) / (1 - duty), 0, 1);
          F.target.lerpVectors(F.from, _g3, s).addScaledVector(U, Math.sin(Math.PI * s) * liftH);
          F.toe = -Math.sin(Math.PI * s) * 0.5;
        } else {
          F.target.copy(F.plant);
          F.toe = 0;
        }
        F.step = null;
      } else {
        // standing: stay planted; a quick corrective step if a foot is left behind
        if (!F.step && !G.feet[1 - i].step && F.plant.distanceTo(_g3) > 0.32) {
          F.step = { from: F.plant.clone(), to: _g3.clone(), k: 0 };
        }
        if (F.step) {
          F.step.k += dt / 0.22;
          const s = sm(Math.min(F.step.k, 1), 0, 1);
          F.target.lerpVectors(F.step.from, F.step.to, s).addScaledVector(U, Math.sin(Math.PI * s) * 0.09);
          if (F.step.k >= 1) { F.plant.copy(F.step.to); this.stepped(F.plant, i); F.step = null; }
        } else F.target.copy(F.plant);
        F.toe = 0;
        F.swinging = false;
      }
    }

    // body: bob, lean, bank, landing squash; pelvis drops to reach the lower foot
    const ph = G.phase * Math.PI * 2;
    const walkBob = 0.5 + 0.5 * Math.cos(2 * ph);
    const bob = L(walkBob, 1 - walkBob, run) * L(0.03, 0.08, run) * moving;
    const lean = L(0.03, 0.3, run) * moving;
    const breathe = Math.sin(t * 2.1) * 0.012 * (1 - moving);
    const squash = this._land;
    // place the root now so IK can work in body space
    this.object.position.copy(this.pos);
    this.frame.quaternion(this.heading, this.object.quaternion);
    c.body.rotation.set(lean + squash * 0.15, 0, bank);
    c.body.position.y = 0;
    this.object.updateMatrixWorld(true);
    let reachDrop = 0;
    for (let i = 0; i < 2; i++) {
      c.body.worldToLocal(_g4.copy(G.feet[i].target));
      const d = _g4.sub(c.legs[i].position).length();
      reachDrop = Math.max(reachDrop, d - (LEG_A + LEG_B) * 0.985);
    }
    G.drop = L(G.drop ?? 0, Math.min(Math.max(reachDrop, 0), 0.24), 1 - Math.exp(-14 * dt));
    c.body.position.y = bob - G.drop - squash * 0.14 + breathe * 0.3;
    c.body.updateMatrixWorld(true);

    // two-bone IK per leg
    for (let i = 0; i < 2; i++) {
      const F = G.feet[i];
      c.body.worldToLocal(_g4.copy(F.target));
      _g4.sub(c.legs[i].position);
      const dist = THREE.MathUtils.clamp(_g4.length(), 0.25, (LEG_A + LEG_B) * 0.999);
      const roll = THREE.MathUtils.clamp(Math.atan2(_g4.x, -_g4.y), -0.35, 0.35);
      const pitchToFoot = Math.atan2(-_g4.z, -_g4.y);                 // + = foot behind the hip
      const alpha = Math.acos(THREE.MathUtils.clamp((LEG_A * LEG_A + dist * dist - LEG_B * LEG_B) / (2 * LEG_A * dist), -1, 1));
      const bend = Math.PI - Math.acos(THREE.MathUtils.clamp((LEG_A * LEG_A + LEG_B * LEG_B - dist * dist) / (2 * LEG_A * LEG_B), -1, 1));
      c.legs[i].rotation.set(pitchToFoot - alpha, 0, roll);
      c.knees[i].rotation.x = bend;
      // keep the boot flat on the ground (toe dips during the swing)
      c.feet[i].rotation.x = -(pitchToFoot - alpha + bend) - (lean + squash * 0.15) + F.toe;
      F.localZ = _g4.z;
    }

    // upper body: twist against the hips, arms swing with the opposite foot
    const swingDiff = (G.feet[0].localZ - G.feet[1].localZ);
    c.torso.rotation.set(0, -swingDiff * 0.35, -Math.sin(ph) * 0.03 * run);
    c.torso.scale.y = 1 + breathe;
    const armK = L(1.4, 2.0, run) * moving;
    c.arms[0].rotation.set(THREE.MathUtils.clamp(G.feet[0].localZ * armK, -1.2, 1.2), 0, -0.06 - run * 0.1);
    c.arms[1].rotation.set(THREE.MathUtils.clamp(G.feet[1].localZ * armK, -1.2, 1.2), 0, 0.06 + run * 0.1);
    const elb = 0.15 + L(0.15, 1.45, run) * moving;
    c.elbows[0].rotation.x = -(elb + Math.max(0, -G.feet[0].localZ) * 0.5 * run);
    c.elbows[1].rotation.x = -(elb + Math.max(0, -G.feet[1].localZ) * 0.5 * run);
    const look = (1 - moving) * (Math.sin(t * 0.37) * 0.5 + Math.sin(t * 0.13) * 0.3);
    c.head.rotation.set(-lean * 0.7 + (1 - moving) * Math.sin(t * 0.21) * 0.08, look + swingDiff * 0.15, 0);
    c.hatTip.rotation.x = -hs * 0.02 + Math.cos(2 * ph) * 0.12 * moving + squash * 0.4;
    c.hatTip.rotation.z = Math.sin(ph) * 0.1 * moving;
  }

  /** Motion-captured clips (Quaternius, CC0) retargeted onto the rig. */
  animateClips(dt, hs) {
    const c = this.char, A = this.animator;
    this._gait = null;
    for (const f of c.flames) f.visible = false;
    let dh = this.heading - (this._lastHeading ?? this.heading);
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this._lastHeading = this.heading;
    this._turn = THREE.MathUtils.lerp(this._turn ?? 0, dt > 0 ? dh / dt : 0, 1 - Math.exp(-8 * dt));
    const N = A.lib.native;
    // our walk / run speeds land on the walk and sprint clips; jog in between
    A.update(dt, {
      speed: hs, onGround: this.onGround, mode: 'ground',
      walkAt: Math.min(N.walk * 1.2, WALK * 0.4), jogAt: WALK, sprintAt: RUN,
      strideScale: 1 + 0.3 * THREE.MathUtils.smoothstep(hs, WALK, RUN),
    });
    const bank = THREE.MathUtils.clamp(-this._turn * 0.05 * Math.min(hs / WALK, 1), -0.25, 0.25);
    this.object.position.copy(this.pos);
    this.frame.quaternion(this.heading, this.object.quaternion);
    A.apply(this.object, { bank, legScale: 1.04 });
    this.idleLayer(dt, hs);
    if (this.onGround && !this.humanoid) this.footIK(dt);
    c.hatTip.rotation.x = -hs * 0.02 + c.body.position.y * 3;
    // footstep: a foot reaches its lowest point and starts rising again
    if (this.onGround && hs > 0.8 && !this.humanoid) {
      for (let i = 0; i < 2; i++) {
        const y = c.feet[i].getWorldPosition(_g4).dot(this.frame.up);
        const prev = this._fy?.[i];
        const v = prev === undefined ? 0 : y - prev;
        this._fc = this._fc ?? [0, 0];
        this._fc[i] -= dt;
        if ((this._fv?.[i] ?? 0) < -1e-4 && v >= 0 && this._fc[i] <= 0) { this.stepped(_g4.clone(), i); this._fc[i] = 0.28; }
        (this._fy ??= [])[i] = y;
        (this._fv ??= [])[i] = v;
      }
    }
  }

  /**
   * Standing still: a relaxed, living stance on top of the idle clip. The
   * weight settles on one leg for a few seconds (the hip drops on the other
   * side, the shoulders counter-tilt, the free knee bends), then shifts over;
   * the stance narrows, the chest breathes, the elbows soften and the head
   * looks around now and then. The foot IK keeps both feet planted.
   */
  idleLayer(dt, hs) {
    const target = this.onGround && !this.ride && hs < 0.35 && !this.climbing ? 1 : 0;
    const k = this._still = THREE.MathUtils.lerp(this._still ?? 0, target, 1 - Math.exp(-(target ? 2.5 : 8) * dt));
    if (k < 0.01) return;
    const c = this.char, t = this.time;
    const rot = (j, x, y, z) => j.quaternion.multiply(_tq.setFromEuler(_te.set(x * k, y * k, z * k)));
    const w = Math.tanh(3 * Math.sin(t * 0.38 + 0.6));          // -1..1, dwells on each side
    const breath = Math.sin(t * 1.7);
    c.body.position.x += w * 0.045 * k;
    c.body.position.y -= 0.015 * Math.abs(w) * k;
    rot(c.body, 0, w * 0.06, -w * 0.07);
    rot(c.torso, breath * 0.018, -w * 0.05, w * 0.09);
    // narrow the stance; the free leg relaxes forward with a bent knee
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;                               // which way is inward for this leg
      const free = THREE.MathUtils.smoothstep(-w * side, 0.1, 0.9);
      rot(c.legs[i], 0.1 * free, 0.08 * free * side, side * 0.05);
      rot(c.knees[i], 0.3 * free, 0, 0);
    }
    // soft arms, a slow sway, one hand hooks the belt while the weight is on that side
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const hook = THREE.MathUtils.smoothstep(w * side, 0.4, 0.95) * 0.6;
      rot(c.arms[i], 0.06 + breath * 0.01 - hook * 0.25, 0, side * (0.1 + hook * 0.35));
      rot(c.elbows[i], -0.28 - hook * 0.9, 0, 0);
    }
    // glances: hold, turn the head, hold
    const look = Math.tanh(2.5 * Math.sin(t * 0.21)) * 0.45 + Math.sin(t * 0.9) * 0.03;
    rot(c.head, -0.04 + Math.max(0, Math.sin(t * 0.13)) * 0.12, look, 0);
  }

  /**
   * Fit the clip's feet to the real ground (slopes, steps, rocks). The clips
   * assume flat ground at the root: each foot near its planted height is moved
   * by the ground's offset under it, the pelvis drops for the lower foot, and
   * a two-bone solve bends the leg to reach.
   */
  footIK(dt) {
    const c = this.char, U = this.frame.up;
    const root = this.object;
    root.updateMatrixWorld(true);
    const S = (this._ik ??= { off: [0, 0], drop: 0 });
    const feetW = [0, 1].map((i) => c.feet[i].getWorldPosition(new THREE.Vector3()));
    const heights = feetW.map((p) => _g5.copy(p).sub(this.pos).dot(U));       // above the clip's floor
    for (let i = 0; i < 2; i++) {
      // how planted is this foot in the clip (fully at ankle height, fading by 25 cm up)
      const planted = 1 - THREE.MathUtils.smoothstep(heights[i], 0.09, 0.3);
      const g = _g4.copy(feetW[i]).addScaledVector(U, -heights[i]);           // the foot's spot on the clip floor
      this.groundPoint(g, U);
      const off = THREE.MathUtils.clamp(g.sub(this.pos).dot(U), -0.45, 0.45) * planted;
      S.off[i] = THREE.MathUtils.lerp(S.off[i], off, 1 - Math.exp(-18 * dt));
    }
    const drop = Math.min(S.off[0], S.off[1], 0);
    S.drop = THREE.MathUtils.lerp(S.drop, drop, 1 - Math.exp(-14 * dt));
    if (Math.abs(S.off[0]) + Math.abs(S.off[1]) < 0.004) return;
    c.body.position.y += S.drop;
    c.body.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const target = feetW[i].addScaledVector(U, S.off[i]);
      this.legIK(i, target);
    }
  }

  /** Two-bone IK for one rig leg: hip pitch/roll + knee bend to put the ankle at `target` (world). */
  legIK(i, target) {
    const c = this.char;
    const ankleRest = c.feet[i].position.y;                       // knee -> ankle (negative)
    const A = LEG_A, B = Math.abs(ankleRest);
    c.body.worldToLocal(_g4.copy(target)).sub(c.legs[i].position);
    const dist = THREE.MathUtils.clamp(_g4.length(), 0.2, (A + B) * 0.999);
    const roll = THREE.MathUtils.clamp(Math.atan2(_g4.x, -_g4.y), -0.35, 0.35);
    const pitch = Math.atan2(-_g4.z, -_g4.y);
    const alpha = Math.acos(THREE.MathUtils.clamp((A * A + dist * dist - B * B) / (2 * A * dist), -1, 1));
    const bend = Math.PI - Math.acos(THREE.MathUtils.clamp((A * A + B * B - dist * dist) / (2 * A * B), -1, 1));
    // keep the clip's foot orientation in body space
    c.feet[i].updateWorldMatrix(true, false);
    const footQ = c.feet[i].getWorldQuaternion(new THREE.Quaternion());
    c.legs[i].rotation.set(pitch - alpha, 0, roll);
    c.knees[i].rotation.set(bend, 0, 0);
    c.knees[i].updateWorldMatrix(true, false);
    const kneeQ = c.knees[i].getWorldQuaternion(new THREE.Quaternion());
    c.feet[i].quaternion.copy(kneeQ.invert().multiply(footQ));
    c.feet[i].updateMatrixWorld(true);
  }

  initGait(fwd, right) {
    const mk = (side) => {
      const p = this.pos.clone().addScaledVector(right, -side * 0.12);
      this.groundPoint(p, this.frame.up);
      return { plant: p, from: p.clone(), target: p.clone(), swinging: false, step: null, toe: 0, localZ: 0 };
    };
    return { phase: 0, feet: [mk(-1), mk(1)], drop: 0 };
  }

  /** Snap a world point to the ground below/above it (along up). */
  groundPoint(p, up) {
    const h = this.physics.heightAbove(_g5.copy(p).addScaledVector(up, 0.7), up, 0.6) - 0.7;
    if (Number.isFinite(h) && Math.abs(h) < 1.5) p.addScaledVector(up, -h);
    return p;
  }

  stepped(p, i, n) {
    if (this.onStep) this.onStep(p, this.heading, n ? n.clone() : this.frame.up, i);
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
    this.sensitivity = 1;
    this.invertY = false;
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== dom && !this._dragging) return;
      this.look(e.movementX, e.movementY);
    });
    dom.addEventListener('wheel', (e) => {
      this.dist = THREE.MathUtils.clamp(this.dist * (1 + Math.sign(e.deltaY) * 0.1), 4, 60);
    }, { passive: true });
  }

  /** Turn the camera by a pointer delta in pixels (mouse or touch). */
  look(dx, dy) {
    this._lastMouse = this._now;
    const k = 0.0025 * this.sensitivity;
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k * (this.invertY ? -1 : 1), -0.62, 1.3);
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
    // looking up from low down: aim higher so the sky and clouds fill the view
    this._look.copy(this.target).addScaledVector(U, 1.8 + Math.max(0, -this.pitch) * 1.4);
    this._dir.copy(Rt).multiplyScalar(Math.sin(this.yaw) * cp)
      .addScaledVector(U, Math.sin(this.pitch))
      .addScaledVector(Fw, Math.cos(this.yaw) * cp);

    // Line of sight: pull the camera in front of any wall between it and the
    // player (snap in, ease back out).
    // (skipped while gravity is rolling the view: the swinging ray would
    // otherwise clip the floor and yank the camera in)
    const rolling = this.camera.up.dot(U) < 0.985;
    const hit = rolling ? Infinity : this.physics.rayDistance(this._look, this._dir, dist + 0.5);
    let allowed = Math.max(Math.min(dist, hit - 0.6), 1.5);
    // the ground limits the arm too (so you can drop low and look at the sky):
    // the longest arm whose end stays 0.4 m above the ground, found by
    // bisection, folded into the same target so the two can't fight
    if (U.y > 0.999) {
      const clear = (d) => { cam.copy(this._look).addScaledVector(this._dir, d); return cam.y >= this.physics.groundAt(cam.x, cam.y + 3, cam.z) + 0.4; };
      if (!clear(allowed)) {
        let lo = 0.8, hi = allowed;
        for (let k = 0; k < 8; k++) { const m = (lo + hi) / 2; if (clear(m)) lo = m; else hi = m; }
        allowed = lo;
      }
    }
    // snap in, ease back out; tiny changes are ignored so it can't jitter
    if (allowed < this._curDist - 0.02) this._curDist = allowed;
    else this._curDist += (allowed - this._curDist) * (1 - Math.exp(-3 * dt));
    cam.copy(this._look).addScaledVector(this._dir, this._curDist);
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
