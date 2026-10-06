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
// of the leap opens her wings for the first beat (TAKEOFF). Coming down to land (LANDING) she
// lowers her legs and reaches them forward, flares her wings and brakes, touches down with her
// feet on the ground (each foot on its own ray, so on a slope too), sinks into the knees a moment
// and walks out what's left of her speed.
// A controller: RT flies on (thrust, analog; squeezed on the ground, she takes off),
// the stick banks (left / right) and dives (forward) or climbs (back), the left button flaps (the bottom one jumps off: player.js jumpOff).

const MIN_SPEED = 9;
const MAX_SPEED = 55;
/** Walking on the ground: speed (m/s), strides (rad of the step cycle a second; turning on the spot: slower), leg swing, lift, bob. */
export const GAIT = { speed: 5, stride: 9.5, turnStride: 6, swing: 0.55, lift: 0.14, bob: 0.07, sway: 0.05 };
/** Taking off: the crouch (s), the leap's speed up and forward (m/s), gravity on it, the first wingbeat's speed. */
export const TAKEOFF = { crouch: 0.22, up: 8.5, forward: 7, gravity: 14, flight: 16 };
/**
 * Landing: within `height` m of the ground and coming down faster than `descent` m/s (or `ttc` s
 * from it) her legs come down and forward (`reach` rad) and her wings flare (the body `flare` rad
 * nose up); ridden, the flare brakes (`brake` m/s²) and holds the sink to `touch` m/s near the
 * ground. Touching down she sinks into her knees (`dip` m, over `settle` s) and walks out up to
 * `runout` m/s of her speed.
 */
export const LANDING = { height: 5, descent: 0.6, ttc: 1.6, rate: 5, reach: 0.5, lower: 0.12, flare: 0.42, brake: 9, touch: 2.2, dip: 0.28, settle: 0.5, runout: 5, footReach: 0.45 };
/** Where her feet are on the leg (the leg's own frame: the middle toe's base), and the ground under it. */
export const FOOT = new THREE.Vector3(0, -0.91, 0.25);
const _v = new THREE.Vector3(), _from = new THREE.Vector3(), _f = new THREE.Vector3();

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
    this.landK = 0;         // 0..1 coming in to land: legs down and forward, wings flared (LANDING)
    this.flareK = 0;        // the body's flare (nose up), following landK in the air and easing out on the ground
    this.settle = null;     // { t, k }: the touchdown's sink into the knees
    this.runout = 0;        // m/s still to walk off after touching down
    this.vy = 0;            // m/s up (measured each frame, whatever moved her)
    this.footDrop = [0, 0]; // m each foot reaches down (+) or draws up (-) to the ground under it
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
    const y0 = this.pos.y, wasLanded = this.landed;
    if (input && this.mode === 'ridden') this.fly(dt, input);
    else if (this.mode === 'summoned') this.flyTo(dt);
    else if (this.mode === 'catching') this.flyCatch(dt);
    else if (this.mode === 'glide-down') this.glideDown(dt);
    else this.idle(dt);
    if (dt > 0) this.vy = (this.pos.y - y0) / dt;
    if (this.landed && !wasLanded) this.touchdown();
    this.approach(dt);
    this.pose(dt);
  }

  /** Height of her feet over the ground under her (m; the body rides 1.4 m over it). */
  heightOver() {
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 0.5, this.pos.z);
    return Number.isFinite(g) ? this.pos.y - 1.4 - g : Infinity;
  }

  /** Coming in to land (LANDING): how much her legs are out and her wings flared, from her height and her sink. */
  approach(dt) {
    let want = 0;
    if (!this.landed && !this.takeoff && this.mode !== 'catching') {
      const L = LANDING, h = this.heightOver(), sink = -this.vy;
      const low = 1 - THREE.MathUtils.smoothstep(h, L.height * 0.35, L.height);
      const coming = THREE.MathUtils.smoothstep(sink, L.descent * 0.3, L.descent);
      const soon = sink > 0.05 && h / sink < L.ttc ? 1 : 0;
      want = Math.max(low * coming, soon * low);
      if (this.mode === 'summoned' && this.target && this.pos.distanceTo(this.target) < 14) want = 1;   // (called down beside you)
    }
    // (out quickly, away again more slowly: a skim over a rise doesn't snap them back)
    this.landK += (want - this.landK) * (1 - Math.exp(-(want > this.landK ? LANDING.rate : LANDING.rate * 0.6) * dt));
    if (this.settle) {
      this.settle.t += dt;
      if (this.settle.t >= LANDING.settle) this.settle = null;
    }
  }

  /** Feet on the ground: the sink into the knees, scaled by how hard she came down, and the run-out. */
  touchdown() {
    const hard = THREE.MathUtils.clamp(-this.vy / 4, 0.35, 1);
    this.settle = { t: 0, k: hard };
    this.runout = this.mode === 'ridden' ? Math.min(Math.hypot(this.vel.x, this.vel.z), LANDING.runout) : 0;
    this.landK = Math.max(this.landK, 0.6);   // (the legs are down whatever: she's standing on them)
  }

  /** The settle's sink now (0..1 of LANDING.dip): quickly down, slowly back up. */
  get settleK() {
    if (!this.settle) return 0;
    const u = this.settle.t / LANDING.settle;
    return this.settle.k * (u < 0.25 ? Math.sin((u / 0.25) * Math.PI / 2) : 0.5 + 0.5 * Math.cos(((u - 0.25) / 0.75) * Math.PI));
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
    this.pos.y -= 6 * (1 - 0.7 * this.landK) * dt;   // (the flare: slower over the last metres)
    const g = this.physics.groundAt(this.pos.x, this.pos.y + 1, this.pos.z);
    if (this.pos.y < g + 1.4) { this.pos.y = g + 1.4; this.landed = true; this.mode = 'idle'; }
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
      // (just down: she walks out what's left of her speed)
      this.runout *= Math.exp(-3 * dt);
      if (this.runout < 0.6) this.runout = 0;
      this.groundSpeed = Math.max(dive > 0 || thrust > 0 ? GAIT.speed : 0, this.runout);
      this.turning = Math.abs(steer) > 0.1;
      if (this.groundSpeed) {
        const [fx, fz] = this.forward;
        this.pos.x += fx * this.groundSpeed * dt;
        this.pos.z += fz * this.groundSpeed * dt;
        this.vel.set(fx * this.groundSpeed, 0, fz * this.groundSpeed);
      }
      if (flapping || thrust > 0.5) { this.runout = 0; this.settle = null; this.takeoff = { t: 0, vy: 0, speed: this.groundSpeed, leapt: false }; this.groundSpeed = 0; this.turning = false; }
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
    // coming in to land (not diving): the flared wings brake her
    if (this.landK > 0.05 && dive <= 0) this.speed -= this.landK * LANDING.brake * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, MIN_SPEED, MAX_SPEED);
    const lift = flapping ? 9 : 0;
    // a level glide holds height from 16 m/s; slower it sinks
    const sink = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(this.speed, MIN_SPEED, 16, 2.5, 0), -0.3, 2.5);

    const [fx, fz] = this.forward;
    const cp = Math.cos(this.pitch);
    this.vel.set(fx * cp * this.speed, -Math.sin(this.pitch) * this.speed + lift - sink, fz * cp * this.speed);
    // the flare holds the sink over the last metres (not a dive: that skims or lands as it comes)
    if (this.landK > 0.05 && dive <= 0) {
      const near = 1 - THREE.MathUtils.smoothstep(this.heightOver(), 0.3, 2.5);
      this.vel.y = Math.max(this.vel.y, THREE.MathUtils.lerp(this.vel.y, -LANDING.touch, this.landK * near));
    }
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
    const Lk = this.landK, S = this.settleK;
    this.flap += dt * (3 + this.flapPower * 5) * (1 - 0.35 * Lk);   // (the flare's beats: slower, deeper)
    // folded on the ground; through a take-off's leap they start to open, but beat only once she's flying;
    // just down, they stay half open through the settle
    const leaping = this.takeoff?.leapt;
    const foldTo = this.takeoff ? (leaping ? 0.45 : 1) : this.landed ? (this.settle ? 0.5 : 1) : 0;
    this.wingFold += (foldTo - this.wingFold) * (1 - Math.exp(-(leaping ? 7 : 5) * dt));
    const fold = this.wingFold;
    const amp = this.takeoff ? 0 : (1-fold) * (.12 + Math.max(this.flapPower, 0.6 * Lk) * .65);
    // the flare: wings up and forward, cupped against the air
    const flare = Lk * (1 - fold);
    for (const w of this.wings) {
      // Shoulder powers the stroke; the wrist follows and twists on recovery.
      w.shoulder.rotation.y = w.side * (fold * 1.12 - flare * 0.3);
      w.shoulder.rotation.z = w.side * (Math.sin(this.flap) * amp - fold * .32 + .08 + flare * 0.3);
      w.shoulder.rotation.x = -flare * 0.25;
      w.elbow.rotation.y = w.side * (fold * 1.5 + (1-fold)*(.12 + Math.max(0,Math.cos(this.flap))*.22*this.flapPower));
      w.elbow.rotation.z = w.side * Math.sin(this.flap-.65) * amp * .48;
      w.elbow.rotation.x = Math.cos(this.flap-.35) * amp * .18;
    }
    // the gait: walking on the ground (or stepping round on the spot), legs in turn, body bobbing
    const walking = this.landed && !this.takeoff && (this.groundSpeed > 0 || this.turning);
    this.walkK += ((walking ? (this.groundSpeed > 0 ? 1 : 0.6) : 0) - this.walkK) * (1 - Math.exp(-8 * dt));
    if (this.walkK > 0.01) this.walkPhase += dt * (this.groundSpeed > 0 ? GAIT.stride : GAIT.turnStride);
    const W = this.walkK, ph = this.walkPhase, C = this.crouchK;
    this.tail.rotation.x = -.08 + this.pitch*.18 + Math.sin(ph * 2) * 0.05 * W - Lk * (1 - fold) * 0.35;   // (the tail fans down, a brake too)
    this.tail.rotation.z = -this.bank*.25;
    this.object.position.copy(this.pos);
    this.object.rotation.set(0, this.heading, 0);
    // the bob (twice a stride: each step), a sway from foot to foot, the head nodding; the crouch: down, nose low;
    // coming in to land: nose up into the flare; just down: a sink into the knees
    // (the flare eases out over the touchdown rather than snapping level with it)
    this.flareK += ((this.landed ? 0 : Lk) - this.flareK) * (1 - Math.exp(-9 * dt));
    const F = this.flareK, h = this.landed ? 0 : this.heightOver();
    const near = 1 - THREE.MathUtils.smoothstep(h, 0.2, 1.6);   // the last metre: the feet come level for the ground
    this.body.rotation.set(this.pitch + Math.sin(ph * 2) * 0.035 * W + (C > 0 ? 0.14 * C : 0.12 * C) - LANDING.flare * F + 0.08 * S, 0, this.bank + Math.sin(ph) * GAIT.sway * W);
    this.body.position.y = -GAIT.bob * W * (0.5 - 0.5 * Math.cos(ph * 2)) - (C > 0 ? 0.42 * C : 0) - LANDING.dip * S;
    // legs: flying, tucked; coming in to land, down and reaching forward; walking, forward and back in
    // turn, lifted as it swings forward; the crouch and the settle bend them, the leap pushes back
    const legOut = Math.max(Lk, this.landed ? 1 : 0);
    const plant = this.landed && !this.takeoff?.leapt ? 1 : Lk * (1 - THREE.MathUtils.smoothstep(h, 0.15, 0.9));
    this.object.updateMatrixWorld(true);
    this.legs.forEach((l, i) => {
      l.userData.y0 ??= l.position.y;
      const s = Math.sin(ph + i * Math.PI), up = Math.max(0, Math.cos(ph + i * Math.PI));
      // (reaching forward, then, close to the ground, the toes brought level against the body's nose-up)
      const tucked = -(1 - fold) * 1.25 * (1 - legOut) + F * (-LANDING.reach * (1 - near) + (LANDING.flare - 0.1) * near);
      l.rotation.x = tucked + s * GAIT.swing * W + (C > 0 ? 0.45 * C : 0.7 * C) + 0.4 * S;
      l.position.y = l.userData.y0 - LANDING.lower * F + (C > 0 ? 0.12 * C : 0);
      // the foot on the ground under it (its own ray: on a slope one reaches down, the other draws up)
      let drop = 0;
      if (plant > 0.01 && this.object.visible) {   // (not for a bird no one sees: the promised one, far off)
        l.updateMatrixWorld(true);
        const foot = l.localToWorld(_f.copy(FOOT));
        const g = this.physics.groundAt(foot.x, foot.y + 1.2, foot.z);
        if (Number.isFinite(g)) drop = THREE.MathUtils.clamp(g + 0.05 - foot.y, -LANDING.footReach, LANDING.footReach) * plant;
      }
      this.footDrop[i] = drop;
      l.position.y += drop + up * GAIT.lift * W;
    });
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
