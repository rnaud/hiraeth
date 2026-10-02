import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';

// Arzach's bird: a long-beaked, pterodactyl-like mount. Controls when riding:
// A/D bank and turn, W dive (gain speed), S pull up (trade speed for height),
// Space flap (climb). Touching down slowly lands it; Space on the ground takes off.

const MIN_SPEED = 9;
const MAX_SPEED = 55;
const _v = new THREE.Vector3();

function buildBird() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const white = makeMaterial({ color: '#f4efe2' });
  const ochre = makeMaterial({ color: '#d8a24a', flat: true });
  const dark = makeMaterial({ color: '#34405e' });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), white);
  torso.scale.set(0.9, 0.75, 2.1);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 2.2, 8), white);
  neck.rotation.x = Math.PI / 2 - 0.5;
  neck.position.set(0, 0.7, 2.2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), white);
  head.scale.set(0.8, 0.8, 1.3);
  head.position.set(0, 1.25, 3.2);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.6, 6), ochre);
  crest.rotation.x = -2.2;
  crest.position.set(0, 1.6, 2.6);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 2.4, 6), ochre);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.15, 4.6);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), dark);
  eye.position.set(0.32, 1.38, 3.45);
  const eye2 = eye.clone();
  eye2.position.x = -0.32;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2.6, 6), white);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0, -3.0);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 1.2), makeMaterial({ color: '#c8483a', flat: true }));
  saddle.position.set(0, 0.78, 0.2);
  body.add(torso, neck, head, crest, beak, eye, eye2, tail, saddle);

  // wings: inner + outer panel, hinged so they can flap and fold
  const wings = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.7, 0.35, 0.4);
    const inner = new THREE.Mesh(
      mergeGeometries([new THREE.BoxGeometry(3.4, 0.12, 2.2).translate(side * 1.7, 0, 0)]),
      makeMaterial({ color: '#efe6d2', flat: true, side: THREE.DoubleSide })
    );
    const elbow = new THREE.Group();
    elbow.position.set(side * 3.4, 0, 0);
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 4.2, 3).rotateZ(side * Math.PI / 2).translate(side * 2.1, 0, -0.2).scale(1, 0.12, 1),
      makeMaterial({ color: '#e7dcc4', flat: true, side: THREE.DoubleSide })
    );
    elbow.add(outer);
    shoulder.add(inner, elbow);
    body.add(shoulder);
    wings.push({ shoulder, elbow, side });
  }
  // dangling legs
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 1.4, 5), ochre);
    leg.position.set(side * 0.4, -0.9, -0.6);
    body.add(leg);
    legs.push(leg);
  }
  const seat = new THREE.Group();
  seat.position.set(0, 0.88 - 0.56, 0.2);
  body.add(seat);
  root.userData.noCollide = true;
  return { root, body, wings, legs, seat };
}

export class Bird {
  constructor(physics) {
    this.physics = physics;
    this.kind = 'bird';
    const b = buildBird();
    this.object = b.root;
    this.body = b.body;
    this.wings = b.wings;
    this.legs = b.legs;
    this.seat = b.seat;
    this.pos = new THREE.Vector3(10, 0, 6);
    this.pos.y = physics.groundAt(10, 1e4, 6) + 1.4;
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;
    this.pitch = 0;
    this.bank = 0;
    this.speed = 0;
    this.landed = true;
    this.flap = 0;          // flap animation phase
    this.flapPower = 0;
    this.time = 0;
    this.boardDistance = 7;
    this.exitOffset = 2.5;
    this._push = new THREE.Vector3();
  }

  get forward() {
    return [Math.sin(this.heading), Math.cos(this.heading)];
  }

  /** Called by the player's whistle: fly to the player and land beside them. */
  summon(x, z, heading, near) {
    // land on the ground at the player's level (not on an arch above them)
    const from = near ? near.y + 4 : 1e4;
    this.target = new THREE.Vector3(x, this.physics.groundAt(x, from, z) + 1.4, z);
    this.targetHeading = heading;
    if (this.pos.distanceTo(this.target) > 600) this.pos.set(x - 200, this.target.y + 120, z - 200);
    this.landed = false;
    this.mode = 'summoned';
  }

  board() { this.mode = 'ridden'; }
  leave() { this.mode = this.landed ? 'idle' : 'glide-down'; }

  seatTransform(pos, quat) {
    this.seat.getWorldPosition(pos);
    this.seat.getWorldQuaternion(quat);
  }

  update(dt, input) {
    this.time += dt;
    if (input && this.mode === 'ridden') this.fly(dt, input);
    else if (this.mode === 'summoned') this.flyTo(dt);
    else if (this.mode === 'glide-down') this.glideDown(dt);
    else this.idle(dt);
    this.pose(dt);
  }

  idle(dt) {
    this.speed = 0;
    this.vel.set(0, 0, 0);
    this.pitch *= Math.exp(-4 * dt);
    this.bank *= Math.exp(-4 * dt);
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 1, this.pos.z);
    this.pos.y += (g + 1.4 - this.pos.y) * (1 - Math.exp(-6 * dt));
    this.flapPower *= Math.exp(-3 * dt);
  }

  glideDown(dt) {
    // rider jumped off mid-air: circle down and land
    this.heading += 0.4 * dt;
    const [fx, fz] = this.forward;
    this.pos.x += fx * 14 * dt;
    this.pos.z += fz * 14 * dt;
    this.pos.y -= 6 * dt;
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 1, this.pos.z);
    if (this.pos.y < g + 1.5) { this.landed = true; this.mode = 'idle'; }
    this.bank = 0.3;
  }

  flyTo(dt) {
    _v.subVectors(this.target, this.pos);
    const d = _v.length();
    if (d < 1.5) { this.landed = true; this.mode = 'idle'; this.heading = this.targetHeading; return; }
    // arrive from above: aim a bit higher until close
    const aim = _v.clone();
    if (d > 30) aim.y += Math.min(d * 0.3, 40);
    aim.normalize();
    const sp = Math.min(40, d * 1.5 + 5);
    this.pos.addScaledVector(aim, Math.min(sp * dt, d));
    let dh = Math.atan2(aim.x, aim.z) - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * (1 - Math.exp(-3 * dt));
    this.bank = THREE.MathUtils.clamp(-dh, -0.5, 0.5);
    this.pitch = -aim.y * 0.5;
    this.flapPower = d < 20 ? 1 : 0.5;
  }

  fly(dt, input) {
    const steer = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
    const dive = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
    const flapping = input.Space;

    if (this.landed) {
      this.idle(dt);
      // walk the bird around slowly, take off with Space
      this.heading -= steer * 1.5 * dt;
      if (dive > 0) {
        const [fx, fz] = this.forward;
        this.pos.x += fx * 5 * dt;
        this.pos.z += fz * 5 * dt;
      }
      if (flapping) { this.landed = false; this.speed = 16; this.pos.y += 1; this.vel.set(0, 10, 0); this.flapPower = 1; }
      return;
    }

    // bank to turn (coordinated turn), pitch from W/S
    this.bank += (steer * 0.8 - this.bank) * (1 - Math.exp(-3 * dt));
    const targetPitch = dive * 0.55 - (flapping ? 0.25 : 0);
    this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-2.5 * dt));
    this.heading -= Math.tan(this.bank) * 9.8 / Math.max(this.speed, 8) * dt * 2.2;

    // energy: diving speeds up, climbing slows down, drag, flaps add thrust
    // drag only bites above cruising speed, so a level glide keeps its momentum
    const drag = this.speed > 22 ? (this.speed - 22) * 0.35 : 0.25;
    this.speed += (Math.sin(this.pitch) * 22 - drag + (flapping ? 12 : 0)) * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, MIN_SPEED, MAX_SPEED);
    const lift = flapping ? 9 : 0;
    // a level glide holds height from 16 m/s; slower it sinks
    const sink = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(this.speed, MIN_SPEED, 16, 2.5, 0), -0.3, 2.5);

    const [fx, fz] = this.forward;
    const cp = Math.cos(this.pitch);
    this.vel.set(fx * cp * this.speed, -Math.sin(this.pitch) * this.speed + lift - sink, fz * cp * this.speed);
    this.pos.addScaledVector(this.vel, dt);
    this.flapPower += ((flapping ? 1 : 0.15) - this.flapPower) * (1 - Math.exp(-5 * dt));

    if (this.physics.pushCapsule(this.pos, 1.4, -1.0, 1.4, this._push)) this.speed *= 0.85;
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 0.5, this.pos.z);
    if (this.pos.y < g + 1.4) {
      this.pos.y = g + 1.4;
      if (this.speed < 22 || dive >= 0) { this.landed = true; this.speed = 0; }
      else this.pitch = Math.min(this.pitch, -0.1);   // skim and pull up
    }
    if (this.pos.y > 900) this.pos.y = 900;
  }

  pose(dt) {
    this.flap += dt * (3 + this.flapPower * 9);
    const amp = this.landed ? 0.05 : 0.15 + this.flapPower * 0.75;
    for (const w of this.wings) {
      const fold = this.landed ? 1.2 : 0;
      w.shoulder.rotation.z = w.side * (Math.sin(this.flap) * amp + (this.landed ? -0.9 : 0.05));
      w.elbow.rotation.z = w.side * (Math.sin(this.flap - 0.8) * amp * 0.6 - fold * 0.9);
    }
    for (const l of this.legs) l.rotation.x = this.landed ? 0 : 1.2;
    this.object.position.copy(this.pos);
    this.object.rotation.set(0, this.heading, 0);
    this.body.rotation.set(this.pitch, 0, this.bank);
  }
}
