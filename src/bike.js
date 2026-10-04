import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { Paint, painted, paintMaterial, plate, spindle } from './vehicle-kit.js';
import { sweepCapsule, unbury } from './physics.js';
import { padRide } from './controller.js';

// A Sable-like hoverbike. Controls when riding: W throttle, S brake/reverse,
// A/D steer, Shift boost, Space hop; on a controller RT throttle (analog), LT
// brake / reverse, the stick steers, RB or L3 boost, the bottom button hops. It hovers on a spring above the dunes,
// banks into turns and pitches with the ground.
//
// It runs on the traveller's magic-fluid backpack (powered: true; the skiff
// too): boarding swings the tank into the socket behind the seat (player.js,
// fluid-tool.js), a hose clicks into the engine's port, and the fluid lights
// the jets' caps, the headlamp, the hover plate and the trails. Without the backpack
// it won't start. In the desert it must first be found (src/story/desert-bike.js).

const HOVER = 1.15;
const MAX = 34;      // m/s
const BOOST = 54;
const RADIUS = 0.85;
const LIMIT = 1900;

const _c = new THREE.Vector3();
const _tone = new THREE.Color();

function part(geo, color, opts = {}) {
  return new THREE.Mesh(geo, makeMaterial({ color, ...opts }));
}

// the bike's colours: a printed plate, flat and few
const C = { orange: '#d9643a', cream: '#f2e6cc', teal: '#5fb7ad', tealDark: '#3f8f87', navy: '#34405e', red: '#c8483a', brass: '#e2b552', glow: '#9fe0d0' };

/**
 * The hoverbike: a long-nosed fuselage in orange with a cream beak, two teal
 * jet fairings on its cheeks, a navy saddle with a raised cantle, swept bars
 * behind a little windscreen, an upswept rudder that turns with the steering,
 * a whip aerial with a pennant, and a hover plate underneath that glows with
 * the backpack's fluid. Painted parts share two draw calls (vehicle-kit.js).
 * Forward is +z; the seat, the bars and the tank's socket are where the
 * rider's pose and the hand-off expect them.
 */
function buildBike() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // pitched / banked
  root.add(body);
  const smooth = new Paint(), flat = new Paint();
  // the fuselage: fat under the saddle, drawn out to a long nose
  smooth.add(spindle([[0.05, -1.55], [0.2, -1.45], [0.34, -1.15], [0.42, -0.6], [0.45, 0], [0.42, 0.6], [0.34, 1.15], [0.24, 1.6], [0.12, 1.95]], { seg: 12, sx: 1.05, sy: 0.72 }), C.orange);
  // the beak: cream, long and pointed, a red ring where it meets the body
  smooth.add(spindle([[0.16, 1.8], [0.13, 2.2], [0.08, 2.6], [0.015, 2.95]], { seg: 8, sx: 1.05, sy: 0.72 }), C.cream, { at: [0, -0.02, 0] });
  smooth.add(new THREE.TorusGeometry(0.16, 0.035, 5, 14), C.red, { at: [0, -0.02, 1.82], scale: [1.05, 0.72, 1] });
  // a cream belly and a red racing stripe along the spine
  smooth.add(spindle([[0.3, -1.1], [0.4, -0.5], [0.43, 0.2], [0.38, 0.9], [0.3, 1.3]], { seg: 12, sx: 1.08, sy: 0.5 }), C.cream, { at: [0, -0.12, 0] });
  flat.add(new THREE.BoxGeometry(0.12, 0.05, 1.1), C.red, { at: [0, 0.3, 0.95], rot: [-0.18, 0, 0] });
  // the jet fairings on its cheeks, with their struts, swept fins and foot pegs
  for (const side of [-1, 1]) {
    smooth.add(spindle([[0.1, -1.05], [0.2, -0.9], [0.25, -0.5], [0.26, 0], [0.22, 0.45], [0.12, 0.75], [0.02, 0.9]], { seg: 10, sx: 1, sy: 0.9 }), C.teal, { at: [side * 0.64, -0.12, -0.28] });
    smooth.add(new THREE.TorusGeometry(0.2, 0.03, 4, 12), C.cream, { at: [side * 0.64, -0.12, -1.33] });
    flat.add(new THREE.BoxGeometry(0.34, 0.08, 0.5), C.navy, { at: [side * 0.38, -0.08, -0.35] });
    flat.add(plate([[0, 0], [0.55, 0], [0.75, 0.3], [0.45, 0.3]], 0.04), C.tealDark, { at: [side * 0.64, 0.08, -0.62], rot: [0, -Math.PI / 2, 0] });
    flat.add(new THREE.BoxGeometry(0.16, 0.05, 0.2), C.navy, { at: [side * 0.42, -0.2, 0.05] });
  }
  // the saddle: padded, its cantle raised, clear of the tank's cradle behind it
  smooth.add(new THREE.CapsuleGeometry(0.2, 0.62, 3, 10).rotateX(Math.PI / 2), C.navy, { at: [0, 0.31, -0.3], scale: [1.25, 0.5, 1] });
  flat.add(new THREE.BoxGeometry(0.44, 0.16, 0.08), C.navy, { at: [0, 0.4, -0.7], rot: [-0.35, 0, 0] });
  // the bars: a stem, swept handlebars with red grips, a windscreen and a round headlamp
  flat.add(new THREE.CylinderGeometry(0.045, 0.06, 0.42, 6), C.navy, { at: [0, 0.45, 0.72], rot: [-0.35, 0, 0] });
  flat.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.5, 0.7, 0.5), new THREE.Vector3(-0.22, 0.64, 0.66), new THREE.Vector3(0.22, 0.64, 0.66), new THREE.Vector3(0.5, 0.7, 0.5)]), 8, 0.035, 5), C.navy);
  for (const side of [-1, 1]) flat.add(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 6), C.red, { at: [side * 0.5, 0.7, 0.5], rot: [0, 0, Math.PI / 2] });
  smooth.add(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 8, 1, true, -0.8, 1.6), '#cfe3dc', { at: [0, 0.5, 0.68], rot: [-0.45, 0, 0], scale: [1, 1, 0.6] });
  smooth.add(new THREE.CylinderGeometry(0.13, 0.15, 0.1, 10), C.brass, { at: [0, 0.3, 1.32], rot: [Math.PI / 2 - 0.25, 0, 0] });
  // the aerial for the pennant
  flat.add(new THREE.CylinderGeometry(0.012, 0.018, 1.05, 4), C.navy, { at: [-0.3, 0.72, -1.38] });
  const sm = smooth.mesh({ smooth: true, side: THREE.DoubleSide }), fl = flat.mesh();
  body.add(sm, fl);

  // the rudder: it turns with the steering (animate)
  const rudder = new THREE.Group();
  rudder.position.set(0, 0.2, -1.35);
  const fin = new Paint();
  fin.add(plate([[0, 0], [-0.32, 0], [-0.55, 0.62], [-0.38, 0.66]], 0.05), C.cream, { rot: [0, Math.PI / 2, 0] });
  fin.add(plate([[-0.45, 0.42], [-0.55, 0.62], [-0.38, 0.66], [-0.31, 0.46]], 0.07), C.red, { rot: [0, Math.PI / 2, 0] });
  rudder.add(fin.mesh());
  body.add(rudder);
  // the pennant at the aerial's tip: it flutters, harder the faster you go
  const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0, -0.07, -0.34)]);
  flagGeo.computeVertexNormals();
  const flag = new THREE.Mesh(painted(flagGeo, C.red), paintMaterial({ side: THREE.DoubleSide }));
  flag.position.set(-0.3, 1.24, -1.38);
  body.add(flag);

  // what the fluid lights: the jets' caps and the headlamp, and the hover plate under the belly
  const caps = new THREE.Mesh(mergeGeometries([
    ...[-1, 1].map((side) => new THREE.CircleGeometry(0.17, 12).rotateY(Math.PI).translate(side * 0.64, -0.12, -1.34)),
    new THREE.SphereGeometry(0.1, 10, 6).scale(1, 1, 0.5).rotateX(-0.25).translate(0, 0.31, 1.37).toNonIndexed(),
  ].map((g) => (g.index ? g.toNonIndexed() : g))), makeMaterial({ color: C.cream }));
  const under = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(Math.PI / 2).scale(0.42, 1, 1.35).translate(0, -0.33, 0.1), makeMaterial({ color: C.glow }));
  body.add(caps, under);

  // where the rider sits (character feet origin; hips land on the seat)
  const seatAnchor = new THREE.Group();
  seatAnchor.position.set(0, -0.56, -0.4);
  body.add(seatAnchor);
  // the backpack's socket: a brass cradle behind the seat, the engine's port under it
  const { socket, port } = buildSocket(body, { at: [0, 0.21, -1.0], port: [0.2, 0.05, -0.62] });
  const jets = [new THREE.Vector3(0.64, -0.12, -1.36), new THREE.Vector3(-0.64, -0.12, -1.36)];
  const animate = (dt, b) => {
    rudder.rotation.y = THREE.MathUtils.clamp(-b.yawRate * 0.35, -0.5, 0.5);
    const flow = Math.min(1, Math.abs(b.speed) / 30);
    flag.rotation.y = Math.sin(b.time * (5 + flow * 9)) * (0.5 - flow * 0.35);
    flag.scale.set(1, 1, 1 + flow * 0.25);
  };
  return { root, body, seatAnchor, socket, port, lights: [caps, under], jets, animate };
}

/**
 * A cradle for the backpack's tank on a vehicle's body: a brass ring and two
 * clamps; `socket` is where the tank's glass bottom sits (its +z toward the
 * vehicle's front), `port` the engine inlet the hose clicks into.
 */
export function buildSocket(body, { at = [0, 0.25, -1.4], port = [0.22, 0.05, -1.0] } = {}) {
  const socket = new THREE.Group();
  socket.position.set(...at);
  body.add(socket);
  const brass = '#e2b552', dark = '#5f86bf';
  // the ring and its two clamps are one brass mesh (the first child: it glows if nothing else does)
  const ring = part(mergeGeometries([
    new THREE.TorusGeometry(0.2, 0.025, 5, 20).rotateX(Math.PI / 2).scale(1.2, 1, 1).translate(0, -0.02, 0),
    ...[-1, 1].map((sx) => new THREE.BoxGeometry(0.04, 0.16, 0.06).translate(sx * 0.26, 0.06, 0)),
  ].map((g) => g.toNonIndexed())), brass);
  const base = part(new THREE.CylinderGeometry(0.21, 0.23, 0.05, 16).scale(1.2, 1, 1), dark, { flat: true });
  base.position.y = -0.045;
  socket.add(ring, base);
  const p = new THREE.Group();
  p.position.set(...port);
  body.add(p);
  const nub = part(new THREE.CylinderGeometry(0.03, 0.04, 0.06, 8), brass);
  p.add(nub);
  for (const o of [socket, p]) o.traverse((m) => { m.userData.noCollide = true; });
  return { socket, port: p };
}

let powerId = 0;

export { buildBike };

/**
 * The stick's sideways push as steering, -1..1. Pushing ahead is rarely quite
 * straight, so while driving forward a wider deadzone ignores the drift, and the
 * curve keeps small pushes gentle: a full turn needs the stick well over.
 */
export function bikeSteer(x, forward = false) {
  const dz = forward ? 0.32 : 0.12, a = Math.abs(x);
  if (a <= dz) return 0;
  return Math.sign(x) * Math.min(1, (a - dz) / (1 - dz)) ** 1.6;
}

export class Hoverbike {
  /**
   * @param {object} [opts]
   * @param {() => {root, body, seatAnchor}} [opts.build] mesh builder (default: the bike)
   * @param {number} [opts.floor] never hover below this height (e.g. a water surface)
   */
  constructor(physics, opts = {}) {
    this.physics = physics;
    this._push = new THREE.Vector3();
    this.kind = opts.kind ?? 'bike';
    this.floor = opts.floor ?? -Infinity;
    const b = (opts.build ?? buildBike)();
    this.object = b.root;
    this.body = b.body;
    this.seat = b.seatAnchor;
    this.jets = b.jets ?? null;          // where the hover trails stream from (body space)
    this.animate = b.animate ?? null;    // (dt, vehicle): its moving details (a rudder, a flag, a sail)
    // it runs on the backpack: the tank sits in the socket while ridden
    this.powered = opts.powered ?? true;
    if (this.powered) {
      const sk = b.socket ? b : buildSocket(this.body, opts.socket ?? { at: [0, 0.25, -1.45], port: [0.25, 0.1, -1.05] });
      this.socket = sk.socket; this.port = sk.port;
      this.powerLights = this.makePowerLights(b.lights);
    }
    // dormant: not found yet (the desert's bike under its tarp, src/story/desert.js): it lies
    // where it is, can't be boarded or whistled for, and nothing moves it
    this.dormant = false;
    this.pos = new THREE.Vector3(8, 0, 4);
    this.pos.y = this.groundAt(8, 1e4, 4) + HOVER;
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;
    this.speed = 0;
    this.yawRate = 0;
    this.bank = 0;
    this.pitch = 0;
    this.time = 0;
    this.grounded = true;
  }

  groundAt(x, fromY, z) {
    return Math.max(this.physics.groundAt(x, fromY, z), this.floor);
  }

  get forward() {
    return [Math.sin(this.heading), Math.cos(this.heading)];
  }

  /** Put it right here (arriving in a new world already riding). */
  place(x, z, heading, near) {
    const from = near ? near.y + 4 : 1e4;
    this.pos.set(x, this.groundAt(x, from, z) + HOVER + 1, z);
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.heading = heading;
    this.auto = null;
  }

  /**
   * Whistled for: it drives over to you from wherever it is (if it's very far
   * or lost, it comes in from a way off), then pulls up beside you.
   * `near` is the live player position; the bike keeps the same offset from it.
   */
  summon(x, z, heading, near, { camFwd = null } = {}) {
    const ref = near ?? new THREE.Vector3(x, 0, z);
    if (![this.pos.x, this.pos.y, this.pos.z].every(Number.isFinite) || this.pos.distanceTo(ref) > 80) {
      // come in from the side of the view, so you see it arrive
      const a = Math.atan2(camFwd?.x ?? Math.sin(heading), camFwd?.z ?? Math.cos(heading)) + (Math.random() < 0.5 ? 1.5 : -1.5);
      const sx = ref.x + Math.sin(a) * 20, sz = ref.z + Math.cos(a) * 20;
      this.pos.set(sx, this.groundAt(sx, 1e4, sz) + HOVER, sz);
      this.vel.set(0, 0, 0);
      this.heading = Math.atan2(ref.x - sx, ref.z - sz);
    }
    this.auto = { near: ref, dx: x - ref.x, dz: z - ref.z, heading, elapsed: 0, stalled: 0 };
  }

  /** Find a clear, boardable spot beside the caller before teleporting. */
  recallNear(A) {
    for (const radius of [3, 4.5]) for (let i = 0; i < 12; i++) {
      const angle = A.heading + i * Math.PI / 6;
      const p = new THREE.Vector3(A.near.x + Math.sin(angle) * radius, 0, A.near.z + Math.cos(angle) * radius);
      const ground = this.groundAt(p.x, A.near.y + 2, p.z);
      if (!Number.isFinite(ground) || Math.abs(ground - A.near.y) > 2.5) continue;
      p.y = ground + HOVER;
      const probe = p.clone();
      if (this.physics.pushCapsule(probe, RADIUS, -0.35, 1.0, this._push)) continue;
      const origin = A.near.clone().add(new THREE.Vector3(0, 1, 0)), delta = p.clone().sub(origin);
      if (this.physics.rayDistance?.(origin, delta.clone().normalize(), delta.length()) < delta.length() - 0.5) continue;
      this.pos.copy(p); this.vel.set(0, 0, 0); this.speed = this.yawRate = 0;
      this.heading = A.heading; this.auto = null;
      this.object.position.copy(p); this.object.rotation.y = this.heading;
      return true;
    }
    return false;
  }

  /**
   * The parts the fluid lights while the tank sits in the socket: the pods'
   * caps (bike) or the socket's ring, each with its own material.
   */
  makePowerLights(meshes = null) {
    const id = powerId++, lights = [];
    const add = (o, i) => {
      // each its own material, starting from the colour it was built in
      const base = o.material?.uniforms?.uColor?.value?.clone() ?? new THREE.Color('#f2e6cc');
      o.material = makeMaterial({ color: `#${base.getHexString()}`, key: `power.${id}.${i}` });
      lights.push({ mesh: o, base });
    };
    if (meshes?.length) meshes.forEach(add);
    else this.socket.children.slice(0, 1).forEach((o, i) => add(o, 10 + i));
    return lights;
  }

  /**
   * Lie still at (x, z), half sunk in the sand and tipped on one side, until
   * wake(): the bike before it is found.
   */
  rest(x, z, heading, { sink = 0.9, tilt = [0.08, 0.2] } = {}) {
    this.dormant = true;
    this.auto = null;
    this.vel.set(0, 0, 0);
    this.speed = this.yawRate = 0;
    this.heading = heading;
    this.pos.set(x, this.groundAt(x, 1e4, z) + HOVER - sink, z);
    this.pitch = tilt[0]; this.bank = tilt[1];
    this.object.position.copy(this.pos);
    this.object.rotation.y = heading;
    this.body.rotation.set(this.pitch, 0, this.bank);
    this.object.updateMatrixWorld(true);
  }

  /** Found: it lifts out of the sand onto its hover spring and works as ever. */
  wake() {
    if (!this.dormant) return;
    this.dormant = false;
    this.vel.set(0, 3, 0);
    this.grounded = false;
  }

  /** k 0..1: how much the fluid powers it now; tones: the fluid's colours (fluid-tool.js). */
  setPower(k, tones = [], time = 0) {
    this.powerK = k;
    if (!this.powerLights) return;
    const pulse = 0.75 + 0.25 * Math.sin(time * (4 + Math.abs(this.speed) * 0.25));
    this.powerLights.forEach((L, i) => {
      const u = L.mesh.material.uniforms, tone = tones[(i + Math.floor(time * 1.5)) % Math.max(1, tones.length)] ?? '#f2e6cc';
      u.uColor.value.copy(L.base).lerp(_tone.set(tone), k);
      u.uGlow.value = 0.95 * k * pulse;
    });
  }

  /** Where the rider sits (world space). */
  seatTransform(pos, quat) {
    this.seat.getWorldPosition(pos);
    this.seat.getWorldQuaternion(quat);
  }

  /** @param input key state, or null when nobody rides it */
  update(dt, input) {
    if (this.dormant) return;   // under its tarp: nothing moves it
    this.time += dt;
    const ridden = !!input;
    let [fx, fz] = this.forward;

    let throttle = 0, steer = 0, boost = false;
    if (ridden) this.auto = null;
    if (!ridden && this.auto) {
      // autopilot: steer at the spot beside the player, ease off as it arrives
      const A = this.auto, tx = A.near.x + A.dx, tz = A.near.z + A.dz;
      const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
      A.elapsed += dt;
      if ((A.elapsed >= 4 || A.stalled > 0.8) && A.elapsed >= (A.nextRecall ?? 0)) {
        A.nextRecall = A.elapsed + 0.5;
        if (this.recallNear(A)) return;
      }
      if (d < 1.2) {
        this.speed = 0; this.vel.x = this.vel.z = 0;
        this.heading = A.heading; this.yawRate = 0; this.auto = null;
      } else {
        let dh = Math.atan2(dx, dz) - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        this.heading += dh * (1 - Math.exp(-10 * dt)); this.yawRate = 0;
        [fx, fz] = this.forward;
        const want = Math.min(BOOST, d * 3.5) * Math.max(0.25, Math.cos(dh));
        this.speed += (want - this.speed) * (1 - Math.exp(-5 * dt));
      }
    }
    if (ridden) {
      throttle = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
      const pad = padRide(input);
      // the pad: RT goes, LT brakes; the stick only steers (its own forward push is ignored, so less deadzone)
      if (pad) throttle = THREE.MathUtils.clamp(throttle + pad.throttle - pad.brake, -1, 1);
      steer = input.stick && (input.stick.x || input.stick.y) ? bikeSteer(input.stick.x, pad ? Math.abs(input.stick.y) > 0.6 : throttle > 0)
        : (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
      boost = input.ShiftLeft || input.ShiftRight || !!pad?.boost;
    }
    const recalling = !ridden && !!this.auto;
    const oldPos = this.pos.clone();
    const max = boost ? BOOST : MAX;
    // (an analog throttle aims at its share of the top speed)
    if (throttle > 0) this.speed += (max * throttle - this.speed) * (1 - Math.exp(-(boost ? 0.9 : 0.6) * dt));
    else if (throttle < 0) this.speed = Math.max(this.speed + 40 * throttle * dt, -8);
    else if (!recalling) this.speed *= Math.exp(-((this.powered && !ridden && (this.powerK ?? 0) < 0.5) ? 2.5 : 0.5) * dt);   // its tank taken out: it powers down and stops

    // steering: right = decreasing heading; tighter at low speed
    const grip = THREE.MathUtils.clamp(Math.abs(this.speed) / 14, 0.35, 1);
    const targetRate = -steer * 1.9 * grip * Math.sign(this.speed || 1);
    this.yawRate += (targetRate - this.yawRate) * (1 - Math.exp(-6 * dt));
    this.heading += this.yawRate * dt;

    // horizontal velocity slides toward the facing direction (a bit of drift)
    const a = 1 - Math.exp(-(recalling ? 12 : this.grounded ? 3.5 : 0.8) * dt);
    this.vel.x += (fx * this.speed - this.vel.x) * a;
    this.vel.z += (fz * this.speed - this.vel.z) * a;

    // hover spring + gravity
    // hover over whatever is below (terrain, rocks, mesa tops...)
    const probe = this.pos.y - 0.2;
    const g = this.groundAt(this.pos.x, probe, this.pos.z);
    const gAhead = this.groundAt(this.pos.x + fx * 2.5, probe, this.pos.z + fz * 2.5);
    const target = Math.max(g, gAhead - 0.3) + HOVER + Math.sin(this.time * 2.3) * 0.06;
    if (this.pos.y < target + 0.6) {
      this.vel.y += ((target - this.pos.y) * 45 - this.vel.y * 7) * dt;
      this.grounded = true;
    } else {
      this.vel.y -= 26 * dt;
      this.grounded = false;
    }
    if (ridden && input.Space && this.grounded && !this._hopHeld) this.vel.y = 11;
    this._hopHeld = ridden && !!input.Space;

    this.pos.addScaledVector(this.vel, dt);
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -LIMIT, LIMIT);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -LIMIT, LIMIT);

    // swept, so a boosted bike (or a slow frame) can't jump through a wall
    if (sweepCapsule(this.physics, this.pos, oldPos, RADIUS, -0.35, 1.0, this._push)) this.speed *= 0.6;
    // the ground where it is now, looked for from where it came from: a long
    // drop can't skip through a roof
    const gNow = this.groundAt(this.pos.x, Math.max(oldPos.y, this.pos.y) + 0.3, this.pos.z);
    if (this.pos.y < gNow + 0.4) { this.pos.y = gNow + 0.4; this.vel.y = Math.max(this.vel.y, 0); }
    // still buried in something solid: back to where it was free
    if (this.physics.embedded?.(_c.copy(this.pos).setY(this.pos.y + 0.3))) unbury(this, oldPos, RADIUS);

    if (this.auto) {
      const progress = Math.hypot(this.pos.x - oldPos.x, this.pos.z - oldPos.z);
      this.auto.stalled = progress < Math.max(0.02, Math.abs(this.speed) * dt * 0.2) ? this.auto.stalled + dt : 0;
    }

    // pose: pitch with the ground, bank into turns
    const hBack = this.groundAt(this.pos.x - fx * 1.5, probe, this.pos.z - fz * 1.5);
    const hFront = this.groundAt(this.pos.x + fx * 1.5, probe, this.pos.z + fz * 1.5);
    const targetPitch = this.grounded ? -Math.atan2(hFront - hBack, 3) : -this.vel.y * 0.02;
    // the bike's right side is local -x, so leaning right is a positive roll
    const targetBank = THREE.MathUtils.clamp(-this.yawRate * Math.abs(this.speed) * 0.025, -0.55, 0.55);
    const k = 1 - Math.exp(-6 * dt);
    this.pitch += (targetPitch - this.pitch) * k;
    this.bank += (targetBank - this.bank) * k;

    this.object.position.copy(this.pos);
    this.object.rotation.y = this.heading;
    this.body.rotation.set(this.pitch, 0, this.bank);
    this.animate?.(dt, this);
  }
}
