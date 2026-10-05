import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { featherGeometry } from './avian.js';
import { makeMaterial } from './materials.js';
import { sweepCapsule, unbury } from './physics.js';
import { padRide } from './controller.js';

// Vael's bird: a long-beaked, feathered soaring mount. Controls when riding:
// A/D bank and turn, W dive (gain speed), S pull up (trade speed for height),
// Space flap (climb). Touching down slowly lands it; Space on the ground takes off.
// On the ground she walks: her legs step in turn, her body bobs and sways, her
// wings stay folded (GAIT). Taking off she crouches, leaps, and only at the top
// of the leap opens her wings for the first beat (TAKEOFF).
// A controller: RT flies on (thrust, analog; squeezed on the ground, she takes off),
// the stick banks (left / right) and dives (forward) or climbs (back), the left button flaps (the bottom one jumps off: player.js jumpOff).

const MIN_SPEED = 9;
const MAX_SPEED = 55;
/** Walking on the ground: speed (m/s), strides (rad of the step cycle a second; turning on the spot: slower), leg swing, lift, bob. */
export const GAIT = { speed: 5, stride: 9.5, turnStride: 6, swing: 0.55, lift: 0.14, bob: 0.07, sway: 0.05 };
/** Taking off: the crouch (s), the leap's speed up and forward (m/s), gravity on it, the first wingbeat's speed. */
export const TAKEOFF = { crouch: 0.22, up: 8.5, forward: 7, gravity: 14, flight: 16 };
const _v = new THREE.Vector3(), _from = new THREE.Vector3();

export function buildBird() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const white = makeMaterial({color:'#e9e3d4'});
  const cover = makeMaterial({color:'#d6cdbb',side:THREE.DoubleSide});
  const flight = makeMaterial({color:'#b8ad98',side:THREE.DoubleSide});
  const featherWhite = makeMaterial({color:'#eee8da',side:THREE.DoubleSide});
  const ochre = makeMaterial({color:'#bd945d',flat:true});
  const dark = makeMaterial({color:'#343b44'});
  function ellipsoid(parent,x,y,z,sx,sy,sz,material) {
    const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),material);
    m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
  }
  function feather(parent,length,width,x,y,z,angle,material) {
    const m=new THREE.Mesh(featherGeometry(length,width),material);
    m.position.set(x,y,z);m.rotation.y=angle;parent.add(m);return m;
  }
  // Deep breast, tapered back, an arched neck and a distinct brow and beak.
  ellipsoid(body,0,0,0,.86,.79,1.85,white);
  ellipsoid(body,0,-.16,.85,.72,.68,1.12,white);
  const neckCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.2,1.1),new THREE.Vector3(0,.65,1.7),new THREE.Vector3(0,1.3,1.9),new THREE.Vector3(0,1.55,2.5)]);
  body.add(new THREE.Mesh(new THREE.TubeGeometry(neckCurve,12,.32,10,false),white));
  ellipsoid(body,0,1.5,2.65,.39,.4,.63,white);
  const beak=new THREE.Mesh(new THREE.ConeGeometry(.22,1.45,8).rotateX(Math.PI/2),ochre);
  beak.scale.y=.65;beak.position.set(0,1.42,3.57);body.add(beak);
  const hook=new THREE.Mesh(new THREE.ConeGeometry(.13,.35,7),dark);
  hook.rotation.z=Math.PI;hook.position.set(0,1.29,4.18);body.add(hook);
  for(const side of [-1,1]) {
    ellipsoid(body,side*.354,1.61,2.85,.065,.085,.09,ochre);
    ellipsoid(body,side*.401,1.62,2.86,.028,.044,.048,dark);
    ellipsoid(body,side*.3,1.76,2.85,.16,.055,.23,white);
    for(let k=0;k<4;k++) feather(body,.65,.3,side*(.38+k*.085),.48-k*.12,1.35-k*.2,side*.4,featherWhite);
  }
  const tail=new THREE.Group();tail.position.set(0,.08,-1.35);body.add(tail);
  for(let i=-3;i<=3;i++) feather(tail,1.65-Math.abs(i)*.08,.37,i*.105,Math.abs(i)*-.012,0,i*.16,i%2?flight:featherWhite);
  const saddle=new THREE.Mesh(new THREE.BoxGeometry(.85,.18,1.15),makeMaterial({color:'#b55d48',flat:true}));
  saddle.position.set(0,.79,.2);body.add(saddle);
  const strap=new THREE.Mesh(new THREE.TorusGeometry(.79,.05,5,24).rotateY(Math.PI/2),ochre);strap.scale.y=.9;body.add(strap);

  const wings=[];
  for(const side of [-1,1]) {
    const shoulder=new THREE.Group();shoulder.position.set(side*.65,.35,.55);
    const elbow=new THREE.Group();elbow.position.set(side*2.65,0,-.3);
    // Rounded leading edge over an overlapping row of secondary feathers.
    feather(shoulder,3.2,1.7,0,.04,.1,-side*1.35,featherWhite);
    for(let i=0;i<10;i++) feather(shoulder,1.45+i*.04,.46,side*(.35+i*.235),-.03,-.05-i*.035,-side*.13,i%3?featherWhite:cover);
    feather(elbow,2.7,1.1,0,.03,.12,-side*1.17,cover);
    // Primary feathers fan from the wrist with separate, swept tips.
    for(let i=0;i<9;i++) feather(elbow,2.8-i*.09,.45,side*(.28+i*.18),-.035-i*.004,-i*.045,-side*(.48+i*.115),i%3?flight:featherWhite);
    // Shorter coverts lie on top and hide the feather roots.
    for(let i=0;i<7;i++) feather(shoulder,.9,.46,side*(.3+i*.34),.16,.16,-side*.35,cover);
    shoulder.add(elbow);body.add(shoulder);wings.push({shoulder,elbow,side});
  }
  const legs=[];
  for(const side of [-1,1]) {
    const leg=new THREE.Group();leg.position.set(side*.42,-.45,-.45);
    ellipsoid(leg,0,-.18,0,.22,.4,.32,white);
    const shin=new THREE.Mesh(new THREE.CylinderGeometry(.075,.055,.6,7),ochre);shin.position.set(0,-.58,.08);leg.add(shin);
    for(let i=-1;i<=1;i++) {
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.85,.08),new THREE.Vector3(i*.13,-.91,.28),new THREE.Vector3(i*.22,-.91,.58)]);
      leg.add(new THREE.Mesh(new THREE.TubeGeometry(curve,4,.045,5,false),ochre));
      const claw=new THREE.Mesh(new THREE.ConeGeometry(.05,.18,5).rotateX(Math.PI/2),dark);claw.position.set(i*.22,-.91,.65);leg.add(claw);
    }
    body.add(leg);legs.push(leg);
  }
  const seat=new THREE.Group();seat.position.set(0,.88-.56,.2);body.add(seat);
  // Keep every joint, but batch the stationary feathers within each joint.
  for (const group of [body,tail,...legs,...wings.flatMap(w=>[w.shoulder,w.elbow])]) {
    const batches=new Map();
    for(const child of [...group.children]) if(child.isMesh){
      child.updateMatrix();const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
      g.applyMatrix4(child.matrix);g.deleteAttribute('uv');
      if(!batches.has(child.material))batches.set(child.material,[]);
      batches.get(child.material).push(g);group.remove(child);child.geometry.dispose();
    }
    for(const [material,geos] of batches){group.add(new THREE.Mesh(mergeGeometries(geos),material));geos.forEach(g=>g.dispose());}
  }
  root.userData.noCollide=true;
  return {root,body,wings,legs,seat,tail};
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
    this.tail = b.tail;
    this.wingFold = 1;
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
    this.walkK = 0;         // 0..1: how much she is walking (the gait's weight)
    this.walkPhase = 0;     // the step cycle
    this.groundSpeed = 0;   // m/s along the ground, walking
    this.takeoff = null;    // { t, vy, speed, leapt }: the crouch and the leap, until the first wingbeat
    this.crouchK = 0;       // 0..1 down into the crouch; < 0 the legs pushing off
    this.time = 0;
    this.boardDistance = 7;
    this.exitOffset = 2.5;
    this._push = new THREE.Vector3();
  }

  get forward() {
    return [Math.sin(this.heading), Math.cos(this.heading)];
  }

  /** Called by the player's whistle: fly to the player and land beside them. */
  summon(x, z, heading, near, { airborne = false, vel = null } = {}) {
    if (airborne && near) {
      // you're falling or gliding: swoop in from behind and below and catch you
      this.catchRef = near; this.catchVel = vel;
      if (this.pos.distanceTo(near) > 500) this.pos.copy(near).add(new THREE.Vector3(-(vel?.x ?? 0) * 4 - 60, -30, -(vel?.z ?? 0) * 4 - 60));
      this.landed = false;
      this.mode = 'catching';
      this.speed = 30;
      return;
    }
    // land on the ground at the player's level (not on an arch above them)
    const from = near ? near.y + 4 : 1e4;
    this.target = new THREE.Vector3(x, this.physics.groundAt(x, from, z) + 1.4, z);
    this.targetHeading = heading;
    if (this.pos.distanceTo(this.target) > 600) this.pos.set(x - 200, this.target.y + 120, z - 200);
    this.landed = false;
    this.mode = 'summoned';
  }

  board() { this.mode = 'ridden'; }
  leave() { this.takeoff = null; this.crouchK = 0; this.mode = this.landed ? 'idle' : 'glide-down'; }

  seatTransform(pos, quat) {
    this.seat.getWorldPosition(pos);
    this.seat.getWorldQuaternion(quat);
  }

  update(dt, input) {
    this.time += dt;
    if (this.takeoff && this.mode !== 'ridden') { this.takeoff = null; this.crouchK = 0; }   // (no rider: no leap)
    if (input && this.mode === 'ridden') this.fly(dt, input);
    else if (this.mode === 'summoned') this.flyTo(dt);
    else if (this.mode === 'catching') this.flyCatch(dt);
    else if (this.mode === 'glide-down') this.glideDown(dt);
    else this.idle(dt);
    this.pose(dt);
  }

  idle(dt) {
    this.speed = 0;
    this.groundSpeed = 0; this.turning = false;   // (walking sets them again after, while ridden)
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
    // rise smoothly over hills and roofs on the way instead of through them
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 3, this.pos.z);
    if (d > 4 && this.pos.y < g + 3) this.pos.y += (g + 3 - this.pos.y) * (1 - Math.exp(-8 * dt));
    if (this.pos.y < g + 1.4) this.pos.y = g + 1.4;
    let dh = Math.atan2(aim.x, aim.z) - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * (1 - Math.exp(-3 * dt));
    this.bank = THREE.MathUtils.clamp(-dh, -0.5, 0.5);
    this.pitch = -aim.y * 0.5;
    this.flapPower = d < 20 ? 1 : 0.5;
  }

  /** Chase a falling rider: aim at a point a little ahead of and under them, faster than they fall. */
  flyCatch(dt) {
    const P = this.catchRef, V = this.catchVel ?? _v.set(0, 0, 0);
    // lead the rider by the time it takes to get there (at most 0.35 s), so a fast fall is met, not chased;
    // catchDist is to the spot under the rider itself (player.js mounts you within 2.6 m of it)
    const under = _from.set(P.x, P.y - 1.6, P.z);
    this.catchDist = under.distanceTo(this.pos);
    const lead = Math.min(0.35, this.catchDist / Math.max(this.speed, 1));
    const aim = new THREE.Vector3(P.x + V.x * lead, P.y + V.y * lead - 1.6, P.z + V.z * lead).sub(this.pos);
    const d = aim.length();
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 1, this.pos.z);
    // the rider landed first: just come and land beside them instead
    if (P.y - this.physics.groundAt(P.x, P.y + 1, P.z) < 1.5) { this.summon(P.x + 3, P.z + 2, this.heading, P); return; }
    aim.normalize();
    const vlen = Math.hypot(V.x, V.y, V.z);
    // (quick to speed up: a rider who jumped off falls ever faster, player.js watchFall)
    this.speed = THREE.MathUtils.lerp(this.speed, Math.max(vlen + 18, Math.min(70, d * 2 + 10)), 1 - Math.exp(-6 * dt));
    this.pos.addScaledVector(aim, Math.min(this.speed * dt, d));
    if (this.pos.y < g + 1.4) this.pos.y = g + 1.4;
    let dh = Math.atan2(aim.x, aim.z) - this.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this.heading += dh * (1 - Math.exp(-5 * dt));
    this.bank = THREE.MathUtils.clamp(-dh * 1.5, -0.6, 0.6);
    this.pitch = -aim.y * 0.6;
    this.flapPower = 1;
  }

  fly(dt, input) {
    let steer = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
    let dive = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
    const flapping = input.Space;
    const pad = padRide(input), thrust = pad ? pad.throttle : 0;
    if (pad) { if (pad.x) steer = pad.x; if (pad.y) dive = pad.y; }

    if (this.takeoff) return this.leap(dt, steer);
    if (this.landed) {
      this.idle(dt);
      // walk the bird around slowly (her gait: pose), take off with Space: a crouch, then a leap
      this.heading -= steer * 1.5 * dt;
      this.groundSpeed = dive > 0 || thrust > 0 ? GAIT.speed : 0;
      this.turning = Math.abs(steer) > 0.1;
      if (this.groundSpeed) {
        const [fx, fz] = this.forward;
        this.pos.x += fx * this.groundSpeed * dt;
        this.pos.z += fz * this.groundSpeed * dt;
        this.vel.set(fx * this.groundSpeed, 0, fz * this.groundSpeed);
      }
      if (flapping || thrust > 0.5) { this.takeoff = { t: 0, vy: 0, speed: this.groundSpeed, leapt: false }; this.groundSpeed = 0; this.turning = false; }
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
    this.speed += (Math.sin(this.pitch) * 22 - drag + (flapping ? 12 : 0) + thrust * 12) * dt;   // (RT: the flaps' thrust, without their lift)
    this.speed = THREE.MathUtils.clamp(this.speed, MIN_SPEED, MAX_SPEED);
    const lift = flapping ? 9 : 0;
    // a level glide holds height from 16 m/s; slower it sinks
    const sink = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(this.speed, MIN_SPEED, 16, 2.5, 0), -0.3, 2.5);

    const [fx, fz] = this.forward;
    const cp = Math.cos(this.pitch);
    this.vel.set(fx * cp * this.speed, -Math.sin(this.pitch) * this.speed + lift - sink, fz * cp * this.speed);
    const from = _from.copy(this.pos);
    this.pos.addScaledVector(this.vel, dt);
    this.flapPower += ((flapping ? 1 : Math.max(0.15, thrust * 0.8)) - this.flapPower) * (1 - Math.exp(-5 * dt));

    // swept: a 55 m/s dive covers several body lengths in a slow frame
    if (sweepCapsule(this.physics, this.pos, from, 1.4, -1.0, 1.4, this._push)) this.speed *= 0.85;
    if (this.physics.embedded?.(this.pos)) { unbury(this, from, 1.4); this.speed = MIN_SPEED; }
    // the ground below, looked for from the height it flew in at (never under a roof it dived through)
    const g = this.physics.groundAt(this.pos.x, Math.max(from.y, this.pos.y) + 0.5, this.pos.z);
    if (this.pos.y < g + 1.4) {
      this.pos.y = g + 1.4;
      if (this.speed < 22 || dive >= 0) { this.landed = true; this.speed = 0; }
      else this.pitch = Math.min(this.pitch, -0.1);   // skim and pull up
    }
    if (this.pos.y > 900) this.pos.y = 900;
  }

  /**
   * Taking off: down into a crouch (TAKEOFF.crouch s), then a leap, up and forward, legs pushing off,
   * wings folded and half-opening on the way up; at the top of the leap she is flying and the first
   * wingbeat comes down.
   */
  leap(dt, steer = 0) {
    const T = this.takeoff, K = TAKEOFF, [fx, fz] = this.forward;
    T.t += dt;
    this.heading -= steer * 1.2 * dt;
    this.flapPower = 0;
    if (T.t < K.crouch) {
      this.crouchK = Math.sin((T.t / K.crouch) * Math.PI / 2);
      this.idle(dt); this.flapPower = 0;
      return;
    }
    if (!T.leapt) { T.leapt = true; T.vy = K.up; T.speed = Math.max(T.speed, K.forward); }
    T.vy -= K.gravity * dt;
    T.speed += 8 * dt;
    const from = _from.copy(this.pos);
    this.pos.x += fx * T.speed * dt; this.pos.z += fz * T.speed * dt; this.pos.y += T.vy * dt;
    this.vel.set(fx * T.speed, T.vy, fz * T.speed);
    this.crouchK = -Math.min(1, (T.t - K.crouch) / 0.2);   // the legs push off, and trail
    if (sweepCapsule(this.physics, this.pos, from, 1.4, -1.0, 1.4, this._push)) T.speed *= 0.7;
    const g = this.physics.groundAt(this.pos.x, Math.max(from.y, this.pos.y) + 0.5, this.pos.z);
    if (this.pos.y < g + 1.4) this.pos.y = g + 1.4;
    // the top of the leap: the wings open and the first beat comes down
    if (T.vy <= 0.5) {
      this.takeoff = null; this.crouchK = 0;
      this.landed = false;
      this.speed = Math.max(K.flight, T.speed);
      this.flapPower = 1;
      this.flap = Math.PI / 2;   // (the wings up: the first stroke is down)
      this.vel.set(fx * this.speed, 0, fz * this.speed);
    }
  }

  pose(dt) {
    this.flap += dt * (3 + this.flapPower * 5);
    // folded on the ground; through a take-off's leap they start to open, but beat only once she's flying
    const leaping = this.takeoff?.leapt;
    const foldTo = this.takeoff ? (leaping ? 0.45 : 1) : this.landed ? 1 : 0;
    this.wingFold += (foldTo - this.wingFold) * (1 - Math.exp(-(leaping ? 7 : 5) * dt));
    const fold = this.wingFold;
    const amp = this.takeoff ? 0 : (1-fold) * (.12 + this.flapPower * .65);
    for (const w of this.wings) {
      // Shoulder powers the stroke; the wrist follows and twists on recovery.
      w.shoulder.rotation.y = w.side * fold * 1.12;
      w.shoulder.rotation.z = w.side * (Math.sin(this.flap) * amp - fold * .32 + .08);
      w.elbow.rotation.y = w.side * (fold * 1.5 + (1-fold)*(.12 + Math.max(0,Math.cos(this.flap))*.22*this.flapPower));
      w.elbow.rotation.z = w.side * Math.sin(this.flap-.65) * amp * .48;
      w.elbow.rotation.x = Math.cos(this.flap-.35) * amp * .18;
    }
    // the gait: walking on the ground (or stepping round on the spot), legs in turn, body bobbing
    const walking = this.landed && !this.takeoff && (this.groundSpeed > 0 || this.turning);
    this.walkK += ((walking ? (this.groundSpeed > 0 ? 1 : 0.6) : 0) - this.walkK) * (1 - Math.exp(-8 * dt));
    if (this.walkK > 0.01) this.walkPhase += dt * (this.groundSpeed > 0 ? GAIT.stride : GAIT.turnStride);
    const W = this.walkK, ph = this.walkPhase, C = this.crouchK;
    this.legs.forEach((l, i) => {
      l.userData.y0 ??= l.position.y;
      const s = Math.sin(ph + i * Math.PI), up = Math.max(0, Math.cos(ph + i * Math.PI));
      // flying: tucked back; walking: forward and back in turn, lifted as it swings forward; the crouch bends, the leap pushes back
      l.rotation.x = -(1 - fold) * 1.25 + s * GAIT.swing * W + (C > 0 ? 0.45 * C : 0.7 * C);
      l.position.y = l.userData.y0 + up * GAIT.lift * W + (C > 0 ? 0.12 * C : 0);
    });
    this.tail.rotation.x = -.08 + this.pitch*.18 + Math.sin(ph * 2) * 0.05 * W;
    this.tail.rotation.z = -this.bank*.25;
    this.object.position.copy(this.pos);
    this.object.rotation.set(0, this.heading, 0);
    // the bob (twice a stride: each step), a sway from foot to foot, the head nodding; the crouch: down, nose low
    this.body.rotation.set(this.pitch + Math.sin(ph * 2) * 0.035 * W + (C > 0 ? 0.14 * C : 0.12 * C), 0, this.bank + Math.sin(ph) * GAIT.sway * W);
    this.body.position.y = -GAIT.bob * W * (0.5 - 0.5 * Math.cos(ph * 2)) - (C > 0 ? 0.42 * C : 0);
  }
}

// ---------------------------------------------------------------------------
// The bird's promise (src/story/arzach.js sets `bird.promise`): "wherever there
// is sky, call, and she will come". In a world with open sky and no mount of
// its own, the whistle (E) calls her down out of the sky. She waits far off
// and unseen until called; the first whistle brings her in from on high.

/** Worlds with open sky and no mount of their own. */
export const OPEN_SKY = new Set(['edena', 'spheres', 'home']);

/** Does the bird answer the whistle in this world? */
export function birdAnswers(levelId, level, flag) {
  return !!flag?.('bird.promise') && !level.mount && (OPEN_SKY.has(levelId) || !!level.features?.sky);
}

/** The promised bird: hidden far away until the first whistle. */
export function promisedBird(physics, spawn) {
  const b = new Bird(physics);
  const x = (spawn?.x ?? 0) - 480, z = (spawn?.z ?? 0) - 480;
  const g = physics.groundAt(x, 1e4, z);
  b.pos.set(x, (Number.isFinite(g) ? g : spawn?.y ?? 0) + 1.4, z);
  b.object.visible = false;
  const summon = b.summon.bind(b);
  b.summon = (...args) => { b.object.visible = true; return summon(...args); };
  return b;
}
