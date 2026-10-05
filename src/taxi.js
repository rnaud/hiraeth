import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { Paint, paintMaterial, plate, spindle } from './vehicle-kit.js';
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

// The cab's palette (its body takes the colour it is given)
const INK = '#34405e', CREAM = '#f3ead8', RED = '#c8483a', GLASS = '#a9d3cc', SKIN = ['#e9cfb4', '#c99a7a', '#8a5a44', '#f0d8c0'];
const COATS = ['#c8483a', '#5fb7ad', '#d8a24a', '#8a6fb8', '#f3ead8', '#34405e'];
// the body, along +z: fat in the middle, rounded at the stern, a blunt nose
const HULL = [[0.001, -2.0], [0.5, -1.85], [0.82, -1.3], [0.9, -0.4], [0.88, 0.6], [0.72, 1.35], [0.42, 1.85], [0.001, 2.1]];
const SY = 0.55;
const BENCH_Y = 0.49;   // the passenger bench's top, in cab units: the passenger's (and your) hips
const rAt = (z) => {
  for (let i = 1; i < HULL.length; i++) if (z <= HULL[i][1]) { const [r0, z0] = HULL[i - 1], [r1, z1] = HULL[i]; return r0 + (r1 - r0) * (z - z0) / (z1 - z0); }
  return 0;
};
const half = (pts, phi, sy, seg = 14) => new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg, -phi, phi * 2).rotateX(Math.PI / 2).scale(1, sy, 1);

/**
 * The cab, in flat comic colours: a round-bellied body in its own colour with
 * a checker band at the waist and a navy belly, a low windscreen and a cage
 * of ribs over the driver (the bubble), a striped awning over the passenger
 * bench, V-fins at the tail, stub wings with lamps at their tips, a "for hire"
 * sign on the awning and glowing hover rings underneath. Its static parts
 * are built once per colour and shared (two draw calls); the moving and
 * lit parts are small meshes of their own.
 */
const CABS = new Map();
function cabParts(color) {
  if (CABS.has(color)) return CABS.get(color);
  const smooth = new Paint(), flat = new Paint();
  smooth.add(spindle(HULL, { seg: 16, sy: SY }), color, { at: [0, -0.1, 0] });
  smooth.add(half(HULL.map(([r, z]) => [r * 1.02, z * 1.005]), 0.75, SY * 1.02), INK, { at: [0, -0.1, 0] });
  // the checker band round the waist
  for (const side of [-1, 1]) {
    for (let i = 0; i < 15; i++) {
      const z = -1.5 + i * 0.22, r = rAt(z), r2 = rAt(z + 0.05) - rAt(z - 0.05);
      flat.add(new THREE.BoxGeometry(0.04, 0.16, 0.22), i % 2 ? INK : CREAM, { at: [side * (r + 0.005), -0.08, z], rot: [0, side * Math.atan2(r2, 0.1), 0] });
    }
  }
  // the nose cap and the bumper ring
  smooth.add(new THREE.SphereGeometry(0.3, 10, 6), CREAM, { at: [0, -0.12, 1.98], scale: [1.1, 0.7, 0.6] });
  smooth.add(new THREE.TorusGeometry(0.45, 0.05, 4, 16), INK, { at: [0, -0.1, 1.82], scale: [1, SY * 1.1, 1] });
  // the cab: a low windscreen and a cage of ribs over the driver, a steering wheel
  smooth.add(new THREE.CylinderGeometry(0.6, 0.6, 0.24, 8, 1, true, -0.9, 1.8), GLASS, { at: [0, 0.42, 0.8], rot: [-0.3, 0, 0] });
  for (const z of [0.55, 1.12]) flat.add(new THREE.TorusGeometry(0.62, 0.035, 3, 10, Math.PI), INK, { at: [0, 0.3, z], scale: [1, 0.85, 1] });
  flat.add(new THREE.TorusGeometry(0.62, 0.035, 4, 10, Math.PI * 0.62), INK, { at: [0, 0.3, 0.3], rot: [0, Math.PI / 2, 0.08], scale: [1, 0.85, 1.05] });
  flat.add(new THREE.TorusGeometry(0.14, 0.025, 4, 10), INK, { at: [0, 0.52, 1.05], rot: [-0.9, 0, 0] });
  // the passenger bench and the awning over it, on four posts, in red and cream stripes
  flat.add(new THREE.BoxGeometry(1.0, 0.14, 0.55), INK, { at: [0, 0.42, -0.85] });
  flat.add(new THREE.BoxGeometry(1.0, 0.42, 0.08), INK, { at: [0, 0.6, -1.17], rot: [-0.12, 0, 0] });
  for (const x of [-0.7, 0.7]) for (const z of [-1.5, -0.22]) flat.add(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 4), INK, { at: [x, 0.72, z] });
  const BANDS = 7;
  for (let i = 0; i < BANDS; i++) {
    const t0 = Math.PI / 2 + (i / BANDS) * Math.PI;
    smooth.add(new THREE.CylinderGeometry(0.8, 0.8, 1.55, 3, 1, true, t0, Math.PI / BANDS).rotateX(Math.PI / 2), i % 2 ? CREAM : RED, { at: [0, 1.15, -0.86], scale: [1, 0.42, 1] });
  }
  // a scalloped valance along the awning's sides
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) flat.add(new THREE.ConeGeometry(0.09, 0.14, 3), i % 2 ? CREAM : RED, { at: [side * 0.8, 1.08, -1.5 + i * 0.26 + 0.13], rot: [Math.PI, 0, 0] });
  // stub wings, the sign's base, and the hover rings' mounts
  for (const side of [-1, 1]) flat.add(plate([[0, -0.2], [0.55, -0.05], [0.55, 0.12], [0, 0.25]], 0.06), color, { at: [side * 0.85, -0.05, -0.25], rot: [Math.PI / 2, 0, side > 0 ? 0 : Math.PI], scale: [1, 1, 1] });
  flat.add(new THREE.BoxGeometry(0.62, 0.06, 0.16), INK, { at: [0, 1.36, -0.25] });
  const tail = new Paint();
  for (const side of [-1, 1]) {
    tail.add(plate([[0, 0], [0.4, 0], [0.62, 0.72], [0.4, 0.75]], 0.05).rotateY(Math.PI / 2), color, { at: [side * 0.2, 0, 0], rot: [0, 0, side * 0.55] });
    tail.add(plate([[0.5, 0.45], [0.62, 0.72], [0.4, 0.75], [0.36, 0.5]], 0.07).rotateY(Math.PI / 2), RED, { at: [side * 0.2, 0, 0], rot: [0, 0, side * 0.55] });
  }
  // what glows: the headlamps and the hover rings (always); the sign and the wing-tip lamps (for hire)
  const glow = mergeGeometries([
    ...[-0.32, 0.32].map((x) => new THREE.CircleGeometry(0.11, 10).translate(x, 0.02, 1.95).toNonIndexed()),
    ...[-1.0, 1.0].map((z) => new THREE.TorusGeometry(0.42, 0.06, 3, 12).rotateX(Math.PI / 2).translate(0, -0.62, z).toNonIndexed()),
  ]);
  const lamps = mergeGeometries([
    new THREE.BoxGeometry(0.52, 0.2, 0.1).translate(0, 1.5, -0.25).toNonIndexed(),
    ...[-1, 1].map((side) => new THREE.SphereGeometry(0.07, 6, 4).translate(side * 1.42, -0.04, -0.2).toNonIndexed()),
  ]);
  const parts = { smooth: smooth.geometry(), flat: flat.geometry(), tail: tail.geometry(), glow, lamps };
  CABS.set(color, parts);
  return parts;
}

/**
 * A seated figure (a driver with a peaked cap, or a passenger in a hat), one vertex-coloured
 * mesh, its origin at the hips. Built a metre from seat to crown and drawn at FIGURE_H of it,
 * divided by the cab's scale: people are people-sized in a cab of any size (the City-Shaft's
 * cabs are twice the bazaar's, and their drivers and fares used to be twice the traveller).
 */
export const FIGURE_H = 0.9;   // seat to crown, in metres (the traveller, seated, is ~0.9)
function figure({ coat, skin, hat, cap = false }) {
  const p = new Paint();
  p.add(new THREE.CapsuleGeometry(0.21, 0.3, 2, 7), coat, { at: [0, 0.36, 0] });
  p.add(new THREE.SphereGeometry(0.16, 8, 6), skin, { at: [0, 0.84, 0.02] });
  if (cap) {
    p.add(new THREE.CylinderGeometry(0.17, 0.16, 0.12, 10), hat, { at: [0, 0.98, 0] });
    p.add(new THREE.BoxGeometry(0.3, 0.03, 0.16), INK, { at: [0, 0.93, 0.14] });
  } else if (hat) {
    p.add(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 12), hat, { at: [0, 0.96, 0] });
    p.add(new THREE.ConeGeometry(0.13, 0.24, 10), hat, { at: [0, 1.08, 0] });
  }
  return p.mesh({ smooth: true });
}

function buildTaxi(color, { driver = true, fares = true, scale = 1 } = {}) {
  const P = cabParts(color);
  const grp = new THREE.Group();
  const body = new THREE.Mesh(P.smooth, paintMaterial({ smooth: true, side: THREE.DoubleSide, metal: 'painted' }));
  const trim = new THREE.Mesh(P.flat, paintMaterial({ metal: 'painted' }));
  const tail = new THREE.Group();
  tail.position.set(0, 0.2, -1.7);
  tail.add(new THREE.Mesh(P.tail, paintMaterial({ metal: 'painted' })));
  const glow = new THREE.Mesh(P.glow, makeMaterial({ color: '#fff3c4', glow: 1, flat: true }));
  const lamps = new THREE.Mesh(P.lamps, makeMaterial({ color: '#f6c84e', glow: 1, flat: true }));
  grp.add(body, trim, tail, glow, lamps);
  const rnd = Math.random;
  // the driver up front, in the bubble; a passenger on the bench, now and then. Both human-sized
  // whatever the cab's scale (k undoes it): the driver sits low enough in the cockpit that his
  // head and shoulders clear the windscreen; the passenger sits on the bench, where you sit
  let cabbie = null, pax = null;
  const k = FIGURE_H / scale;
  if (driver) {
    cabbie = figure({ coat: rnd() < 0.5 ? INK : COATS[Math.floor(rnd() * COATS.length)], skin: SKIN[Math.floor(rnd() * SKIN.length)], hat: color === '#f2c54b' ? RED : '#f2c54b', cap: true });
    cabbie.scale.setScalar(k);
    cabbie.position.set(0, Math.max(0, 0.54 - 0.6 / scale), 0.78);
    cabbie.userData.y0 = cabbie.position.y;
    grp.add(cabbie);
  }
  if (fares && rnd() < 0.6) {
    const coat = COATS[Math.floor(rnd() * COATS.length)];
    pax = figure({ coat, skin: SKIN[Math.floor(rnd() * SKIN.length)], hat: rnd() < 0.6 ? coat : null });
    pax.scale.setScalar(k);
    pax.position.set(0, BENCH_Y, -0.85);
    grp.add(pax);
  }
  grp.traverse((o) => { o.userData.noCollide = true; });
  return { root: grp, tail, glow, lamps, cabbie, pax, near: [tail, cabbie, pax].filter(Boolean), mid: [glow, lamps] };
}

export class Taxi {
  // set by the level each frame so idle taxis don't leave while you're beside them
  static playerPos = null;

  /**
   * @param lane  (t, taxi) => void, writes taxi.pos / heading / bank / pitch
   * @param fares false: a cab that never carries anyone but you (Wren's)
   */
  constructor(physics, color, scale, lane, { driver = true, fares = true } = {}) {
    this.physics = physics;
    this.kind = 'taxi';
    const b = buildTaxi(color, { driver, fares, scale });
    this.object = b.root;
    this.parts = b;
    this.time = Math.random() * 10;
    this.scale = scale;
    this.object.scale.setScalar(scale);
    this.lane = lane;
    this.mode = 'lane';
    // a passenger aboard (shown in traffic only): a cab that comes when you call is free, its seat yours
    this.fare = !!b.pax;
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
    this.fare = false;   // it's coming for you: no one else aboard
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
    _v.set(0, BENCH_Y - 0.9 / s, -0.8); // the passenger's feet (hips on the bench, under the awning), in taxi-local units
    pos.copy(_v).applyMatrix4(this.object.matrixWorld);
    quat.copy(this.object.quaternion);
  }

  /**
   * The cab's moving details: the tail fins trim into turns, the driver looks
   * about (and into the turn), the "for hire" lamps are lit while it's free
   * (blinking while it waits for you) and dark while you ride. A passenger rides
   * only in traffic: a cab that answers your call (or Wren's, coming to the lamp)
   * comes empty, and one back in its lane picks up a new fare out of sight.
   * Far away only its painted body is drawn.
   */
  animate(dt) {
    const P = this.parts;
    this.time += dt;
    let dh = this.heading - (this._lastHeading ?? this.heading);
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this._lastHeading = this.heading;
    const turn = THREE.MathUtils.clamp(dt > 0 ? dh / dt : 0, -1.5, 1.5);
    this._turn = (this._turn ?? 0) + (turn - (this._turn ?? 0)) * (1 - Math.exp(-4 * dt));
    // (levels of detail: the glow and the lamps from mid range, the fins and the people up close)
    const d2 = Taxi.playerPos ? Taxi.playerPos.distanceToSquared(this.pos) : 0, s = this.scale;
    const far = d2 > (60 + 15 * s) ** 2;
    for (const o of P.mid) o.visible = d2 < (110 + 25 * s) ** 2;
    for (const o of P.near) o.visible = !far;
    if (this.mode !== 'lane') this.fare = false;
    else if (far && P.pax) this.fare = true;
    if (P.pax) P.pax.visible = !far && this.fare;
    if (P.cabbie && this.driverOut?.()) P.cabbie.visible = false;
    if (far) return;
    P.tail.rotation.set(Math.sin(this.time * 1.7) * 0.04, -this._turn * 0.3, 0);
    const waiting = this.mode === 'parked' || this.mode === 'hail';
    P.lamps.visible &&= this.mode !== 'driven' && !this.fare && (!waiting || Math.sin(this.time * 6) > -0.3);   // (not for hire with a fare aboard)
    if (P.cabbie) {
      P.cabbie.rotation.y = this._turn * 0.5 + Math.sin(this.time * 0.37) * 0.35 * Math.sin(this.time * 0.11);
      P.cabbie.position.y = P.cabbie.userData.y0 + Math.abs(Math.sin(this.time * 2.1)) * 0.02 / s;
    }
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
    this.animate(dt);
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

  /** Solid volume for characters: a vertical cylinder, its roof the awning's crest. */
  get solid() {
    const s = this.scale;
    return { pos: this.pos, vel: this.vel, r: 1.45 * s, top: this.pos.y + 1.45 * s, bottom: this.pos.y - 0.6 * s };
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
