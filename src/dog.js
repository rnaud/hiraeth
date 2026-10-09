import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { ell, cyl, cone, merge } from './wildlife/geo.js';
import { Rig, planLeg } from './motion-kit/rig.js';
import { PLANS } from './motion-kit/plans.js';
import { SecondOrder } from './motion-kit/spring.js';
import { DOG_LOOK } from './characters/family.js';

// Moustache, the dog at home (src/story/home.js), as his selected design draws him
// (references/Home/characters/Moustache/reference-4.jpeg): an old, lean, long-legged wire terrier, sandy all
// over, a long white moustache and beard hanging from his muzzle, white scruffy brows, one ear folded over,
// a thin low tail. He follows you.
//
//   follow  trots after you, a couple of metres off your shoulder; hurries to catch up; through the doors and
//           into the houses with you
//   sniff   you stand still a while: he noses about near you, head down, nose working, tail slow
//   sit     ...and then sits (the hind feet step in under him, the rump goes down), looking up at you, tail
//           sweeping the ground
//   bark    the bird or the drone comes near: he plants his feet and barks at it
//   petted  you pet him (an interact): he sits, leans into your hand, wags hard
//   lie     he lies down (by the stone while you sit there: home.js lie())
//
// His legs are on the locomotion kit (src/motion-kit/: the quadruped plan's `dog` table): each leg a hip on
// the body and a thigh and shin solved by two-bone IK to a planted foot (front knees forward, hocks back), the
// feet stepping in diagonal pairs by the distance walked, never sliding; the body rides on them (height and
// tilt from the feet, a dip as a pair lifts, a lean into a hurry). Sitting and lying move the feet's homes
// (the planner steps them there) and lower the body onto them. The head steadies against the body's bob; the
// tail is a three-link chain that lags and wags on springs; the ears flop on springs.

const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const C = DOG_LOOK;
const _push = new THREE.Vector3(), _q = new THREE.Vector3();

/** His proportions (m, his own frame: +z his nose, +y up, the ground at 0), from the reference. */
export const DOG = {
  withers: 0.58, scale: 1,
  hips: { front: { x: 0.07, y: 0.44, z: 0.21 }, hind: { x: 0.075, y: 0.45, z: -0.29 } },
  feet: { front: { x: 0.075, z: 0.24 }, hind: { x: 0.08, z: -0.35 } },
  radius: { front: 0.03, hind: 0.034 },
  // the feet's homes sitting (the hind paws in under him) and lying (the forepaws out ahead, the hind ones aside)
  sit: { hind: { x: 0.1, z: -0.14 }, drop: 0.21, pitch: -0.62 },
  lie: { front: { x: 0.08, z: 0.46 }, hind: { x: 0.17, z: -0.18 }, drop: 0.3 },
};

/** The dog's parts as geometries (vertex colours), in his own frame. */
function buildParts() {
  // (the wire coat: soft flat tufts on the outline, not spikes: they read as thorns in ink)
  const tuft = (at, rot, r = [0.03, 0.012, 0.045], col = C.dark) => ell(r, col, at, rot, [6, 4]);
  const body = merge([
    ell([0.105, 0.125, 0.16], C.fur, [0, 0.5, 0.13], null, [10, 8]),            // the deep chest
    ell([0.095, 0.1, 0.22], C.fur, [0, 0.525, -0.04], null, [10, 7]),          // the ribs and the back
    ell([0.078, 0.07, 0.12], C.fur, [0, 0.54, -0.19], null, [8, 6]),           // the loin, tucked up
    ell([0.09, 0.105, 0.12], C.fur, [0, 0.505, -0.29], null, [9, 7]),          // the haunch
    ...[-1, 1].map((s) => ell([0.042, 0.11, 0.075], C.dark, [s * 0.07, 0.46, -0.3], [0.2, 0, 0])),   // the thighs
    ...[-1, 1].map((s) => ell([0.038, 0.1, 0.06], C.fur, [s * 0.074, 0.48, 0.19], [-0.2, 0, 0])),    // the shoulders
    ell([0.062, 0.075, 0.055], C.pale, [0, 0.43, 0.22]),                         // the brisket, paler
    ell([0.07, 0.09, 0.1], C.fur, [0, 0.6, 0.27], [-0.6, 0, 0]),                // the base of the neck
    // the wire coat: a ragged topline and a fringe under the chest
    ...[-0.32, -0.18, -0.04, 0.1].map((z, i) => tuft([0, 0.618 - Math.abs(z + 0.05) * 0.07, z], [0.3, 0, i % 2 ? 0.3 : -0.3], [0.025, 0.012, 0.05], C.fur)),
    ...[0.06, 0.14, 0.22].map((z, i) => tuft([i % 2 ? 0.02 : -0.02, 0.385, z], [0.4, 0, 0], [0.03, 0.02, 0.04], C.pale)),
  ]);
  const neck = merge([
    cyl(0.05, 0.068, 0.3, C.fur, [0, 0.13, 0.05], [0.36, 0, 0], 8),
    ...[0.05, 0.15].map((y, i) => tuft([0, y + 0.03, -0.012 + y * 0.36], [0.36, 0, i % 2 ? 0.25 : -0.25], [0.022, 0.05, 0.014], C.dark)),
    ell([0.046, 0.08, 0.05], C.pale, [0, 0.1, 0.11], [0.36, 0, 0]),                               // the throat, paler
  ]);
  const head = merge([
    ell([0.066, 0.062, 0.082], C.fur, [0, 0, 0], null, [10, 8]),               // the skull
    ell([0.043, 0.042, 0.105], C.fur, [0, -0.022, 0.115], [-0.06, 0, 0], [9, 7]),   // the long muzzle
    ell([0.024, 0.019, 0.02], C.nose, [0, -0.008, 0.215]),                        // the nose
    // the moustache and beard: long white hair from the sides of the muzzle and hanging under the chin
    ...[-1, 1].map((s) => ell([0.03, 0.03, 0.06], C.white, [s * 0.03, -0.042, 0.155], [0.2, s * 0.25, 0])),
    ell([0.042, 0.055, 0.065], C.white, [0, -0.082, 0.125], [0.2, 0, 0]),
    ...[-0.028, -0.009, 0.01, 0.029].map((x, i) => cone(0.016, 0.08 + (i % 2) * 0.025, C.white, [x, -0.14 - (i % 2) * 0.01, 0.13 + (i % 2) * 0.01], [Math.PI - 0.15, 0, x * 3], 5)),
    ...[-1, 1].map((s) => cone(0.013, 0.07, C.white, [s * 0.048, -0.095, 0.165], [Math.PI - 0.2, 0, -s * 0.5], 5)),
    // white scruffy brows over small dark eyes
    ...[-1, 1].map((s) => ell([0.03, 0.013, 0.022], C.brow, [s * 0.034, 0.045, 0.058], [0, 0, -s * 0.25])),
    ...[-1, 1].map((s) => ell([0.012, 0.02, 0.014], C.brow, [s * 0.048, 0.058, 0.06], [0.5, 0, -s * 0.8])),
    ...[-1, 1].map((s) => ell([0.011, 0.012, 0.008], C.ink, [s * 0.035, 0.022, 0.072])),
    ...[0, 1, 2].map((i) => tuft([(i - 1) * 0.02, 0.06, -0.02 - i * 0.01], [0.2, 0, (i - 1) * 0.4], [0.014, 0.02, 0.025], C.dark)),   // a tuft on top
  ]);
  // the ears hang from their roots: a flap folded over forward; the right one (−x) folded further
  const ear = (s) => merge([ell([0.014, 0.05, 0.036], C.ear, [0, -0.04, 0.012], [0.35, 0, s * 0.15]), ell([0.008, 0.02, 0.022], C.fur, [0, -0.01, 0.0])]);
  // the tail: three thin tapering links along +y from their joints, a little wiry fringe under the first
  const link = (r0, r1, len, col, fringe) => merge([cyl(r1, r0, len, col, [0, len / 2, 0], null, 6), ...(fringe ? [ell([0.012, len * 0.4, 0.02], C.dark, [0, len * 0.5, -r0 * 0.8])] : [])]);
  const tail = [link(0.02, 0.016, 0.12, C.fur, true), link(0.016, 0.011, 0.11, C.fur, true), link(0.011, 0.005, 0.1, C.dark, false)];
  return { body, neck, head, ear, tail };
}

export class Dog {
  /**
   * @param o.physics  groundAt(x, y, z), pushCapsule(pos, r, step, h, out) (optional: flat ground)
   * @param o.at       where he starts · o.onBark() each bark · o.name
   */
  constructor(scene, { physics = null, at = new THREE.Vector3(), heading = 0, onBark = null, name = 'Moustache' } = {}) {
    this.physics = physics;
    this.name = name;
    this.onBark = onBark;
    this.pos = at.clone();
    this.heading = heading;
    this.speed = 0;
    this.vel = new THREE.Vector3();
    this.state = 'sit';
    this.stateT = 0;
    this.wag = 0;          // how happy (0..1): the tail
    this.lookUp = 0;       // head lift
    this.sitK = 1;         // 0 standing .. 1 sitting
    this.lieK = 0;
    this.barkCool = 0;
    this.barks = 0;
    this.stillT = 0;
    this.sniffAt = null;
    this.time = Math.random() * 10;
    const P = buildParts();
    const mat = makeMaterial({ color: '#ffffff', vertexColors: true });
    const mesh = (g) => { const o = new THREE.Mesh(g, mat); o.userData.noCollide = true; return o; };
    this.object = new THREE.Group();
    this.object.name = `dog ${name}`;
    this.object.userData.noCollide = true;
    this.body = new THREE.Group();         // rides on the feet (the kit's offsets), sits and lies
    this.object.add(this.body);
    this.body.add(mesh(P.body));
    this.neck = new THREE.Group(); this.neck.position.set(0, 0.6, 0.31); this.body.add(this.neck);
    this.neck.add(mesh(P.neck));
    this.head = new THREE.Group(); this.head.position.set(0, 0.28, 0.12); this.neck.add(this.head);
    this.head.add(mesh(P.head));
    this.ears = [-1, 1].map((s) => { const e = new THREE.Group(); e.position.set(s * 0.055, 0.05, -0.012); e.add(mesh(P.ear(s))); this.head.add(e); return e; });
    // the tail: set low on the rump, three links, each a joint the next hangs from
    this.tailRoot = new THREE.Group(); this.tailRoot.position.set(0, 0.56, -0.4); this.body.add(this.tailRoot);
    this.tail = [];
    let parent = this.tailRoot, len = 0;
    for (const [i, g] of P.tail.entries()) {
      const j = new THREE.Group(); j.position.y = len; parent.add(j); j.add(mesh(g));
      this.tail.push(j); parent = j; len = [0.12, 0.11, 0.1][i];
    }
    // the legs on the kit: four planted chains (front knees forward, hocks back), sized by the plan
    const plan = PLANS.dog, fur = makeMaterial({ color: C.fur }), dark = makeMaterial({ color: C.dark }), pale = makeMaterial({ color: C.pale });
    const legs = [];
    for (const [row, z] of [['front', 1], ['hind', -1]]) for (const s of [-1, 1]) {
      const H = DOG.hips[row], F = DOG.feet[row];
      const L = planLeg(plan, { group: this.object, body: this.body, hip: { x: s * H.x, y: H.y, z: H.z }, foot: { x: s * F.x, z: F.z }, radius: DOG.radius[row], pad: 'pad',
        mats: { joint: row === 'hind' ? dark : fur, thigh: row === 'hind' ? dark : fur, shin: fur, foot: fur }, ankle: DOG.radius[row] * 0.7, name: `${name} ${row} leg ${s < 0 ? 'right' : 'left'}` });
      // the wire coat on the legs: a soft fringe down the back of each thigh and forearm
      const fringe = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4).scale(DOG.radius[row] * 0.55, L.lenA * 0.36, DOG.radius[row] * 0.75).translate(0, L.lenA * 0.5, -z * DOG.radius[row] * 0.7), row === 'hind' ? dark : pale);
      L.thigh.add(fringe);
      // (slim joints and small paws: the kit's knobs and pads are a machine's, a third too big for him)
      L.root.traverse((o) => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && o !== fringe) o.scale.multiplyScalar(o.parent === L.foot ? 0.72 : 0.62); });
      void z;
      legs.push(L);
    }
    this.rig = new Rig({ plan, group: this.object, body: this.body, legs });
    this.legs = legs;
    this.homes = legs.map((l) => l.home.clone());
    // springs: the tail's links lag the wag and the turns; the ears flop with the bob; the head steadies
    this.tailK = this.tail.map((_, i) => new SecondOrder(4.5 - i * 0.8, 0.45, 0));
    this.earK = this.ears.map(() => new SecondOrder(4.5, 0.3, 0));
    this.headK = new SecondOrder(4, 0.8, 0);
    this.sitPose = new SecondOrder(1.6, 0.9, 0, 1);
    this.liePose = new SecondOrder(1.1, 1, 0, 0);
    this.prevY = 0;
    this.object.scale.setScalar(DOG.scale);
    scene?.add(this.object);
    this.place();
  }

  /** Stand on the ground at x, z (from a little above), else keep the height. */
  ground(dt = 1) {
    const g = this.physics?.groundAt?.(this.pos.x, this.pos.y + 1.2, this.pos.z, 4);
    if (Number.isFinite(g)) this.pos.y = dt >= 1 ? g : damp(this.pos.y, g, 18, dt);
  }

  place() { this.ground(1); this.object.position.copy(this.pos); this.object.rotation.y = this.heading; this.rig.planner.ready = false; }

  /** Pet him: he sits, leans into your hand and wags (for a few seconds). */
  pet() { this.state = 'petted'; this.stateT = 0; this.wag = 1; }
  /** Lie down (by the stone), until told otherwise or you walk off. */
  lie(on = true) { this.state = on ? 'lie' : 'follow'; this.stateT = 0; }

  /**
   * @param o.leader     who he follows: { pos, heading, vel } (the traveller)
   * @param o.targets    things worth barking at: [Vector3] (the bird, the drone), nearest first is fine
   * @param o.busy       a scene is playing: he settles where he is
   */
  update(dt, { leader = null, targets = [], busy = false } = {}) {
    this.stateT += dt;   // (his clock, this.time, runs in pose())
    this.barkCool = Math.max(0, this.barkCool - dt);
    const L = leader;
    let want = 0, face = null;
    const dist = L ? Math.hypot(L.pos.x - this.pos.x, L.pos.z - this.pos.z) : 0;
    const leaderSpeed = L?.vel ? Math.hypot(L.vel.x, L.vel.z) : 0;
    this.stillT = leaderSpeed < 0.3 ? this.stillT + dt : 0;
    // something to bark at (in the air, close enough to see clearly)?
    let threat = null, td = 22;
    if (!busy && this.state !== 'petted' && this.state !== 'lie') for (const t of targets) { if (!t) continue; const d = Math.hypot(t.x - this.pos.x, t.z - this.pos.z); if (d < td) { td = d; threat = t; } }
    if (threat && this.state !== 'bark' && this.barkCool <= 0) { this.state = 'bark'; this.stateT = 0; this.barks = 0; }
    switch (this.state) {
      case 'bark': {
        if (!threat || this.stateT > 3.2) { this.state = 'follow'; this.barkCool = 7; break; }
        face = Math.atan2(threat.x - this.pos.x, threat.z - this.pos.z);
        this.lookUp = damp(this.lookUp, THREE.MathUtils.clamp(Math.atan2(threat.y - this.pos.y - 0.6, Math.max(td, 0.5)) * 0.8, -0.2, 0.8), 6, dt);
        if (this.stateT > 0.25 + this.barks * 0.55 && this.barks < 5) { this.barks++; this.barkT = this.time; this.onBark?.(this); }
        this.wag = damp(this.wag, 0.3, 3, dt);
        break;
      }
      case 'petted':
        face = L ? Math.atan2(L.pos.x - this.pos.x, L.pos.z - this.pos.z) : null;
        this.wag = 1;
        this.lookUp = damp(this.lookUp, 0.5, 4, dt);
        if (this.stateT > 3.5) this.state = 'sit';
        break;
      case 'lie':
        this.wag = damp(this.wag, 0.1, 1, dt);
        this.lookUp = damp(this.lookUp, 0, 2, dt);
        if (L && dist > 7) this.state = 'follow';
        break;
      default: {
        if (!L) { this.state = 'sit'; break; }
        // where he wants to be: a couple of metres off your left, a little behind
        const back = 1.7, off = 1.2, s = Math.sin(L.heading), c = Math.cos(L.heading);
        const tx = L.pos.x - s * back + c * off, tz = L.pos.z - c * back - s * off;
        const d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
        if (busy) { this.state = dist < 6 ? 'sit' : this.state; }
        if (d > 1.0 && !(busy && dist < 6)) {
          this.state = 'follow';
          want = THREE.MathUtils.clamp((d - 0.6) * 2.6, 1.1, d > 5 ? 9.5 : 5.2);   // (hurrying: he keeps up with your run)
          face = Math.atan2(tx - this.pos.x, tz - this.pos.z);
          this.sniffAt = null;
          if (d > 45) { this.pos.set(tx, L.pos.y, tz); this.ground(1); this.rig.planner.ready = false; }   // (left far behind: a portal, a jump)
        } else if (this.stillT > 2.5 && !busy) {
          // you stand still: he noses about, then sits and looks up at you
          if (this.state !== 'sniff' && this.state !== 'sit') { this.state = 'sniff'; this.stateT = 0; }
          if (this.state === 'sniff') {
            if (!this.sniffAt || Math.hypot(this.sniffAt.x - this.pos.x, this.sniffAt.z - this.pos.z) < 0.3) {
              const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 1.8;
              this.sniffAt = new THREE.Vector3(L.pos.x + Math.cos(a) * r, 0, L.pos.z + Math.sin(a) * r);
            }
            want = 0.7; face = Math.atan2(this.sniffAt.x - this.pos.x, this.sniffAt.z - this.pos.z);
            if (this.stateT > 7) { this.state = 'sit'; this.stateT = 0; }
          } else face = Math.atan2(L.pos.x - this.pos.x, L.pos.z - this.pos.z);
        } else {
          this.state = d < 1.0 ? 'sit' : this.state;
          face = Math.atan2(L.pos.x - this.pos.x, L.pos.z - this.pos.z);
        }
        this.wag = damp(this.wag, leaderSpeed > 0.5 || dist < 3 ? 0.7 : 0.35, 2, dt);
        this.lookUp = damp(this.lookUp, this.state === 'sit' && dist < 3.5 ? 0.35 : this.state === 'sniff' ? -0.45 : 0, 4, dt);
      }
    }
    // he only sits or lies once he has stopped
    const sitting = (this.state === 'sit' || this.state === 'petted') && this.speed < 0.4, lying = this.state === 'lie' && this.speed < 0.4;
    if (sitting || lying) want = 0;
    // move
    this.speed = damp(this.speed, want, want > this.speed ? 4 : 7, dt);
    if (face !== null) this.heading += angDiff(this.heading, face) * (1 - Math.exp(-(this.speed > 2 ? 7 : 4) * dt));
    const x0 = this.pos.x, z0 = this.pos.z;
    if (this.speed > 0.02) {
      this.pos.x += Math.sin(this.heading) * this.speed * dt;
      this.pos.z += Math.cos(this.heading) * this.speed * dt;
      this.physics?.pushCapsule?.(this.pos, 0.3, 0.45, 0.7, _push);
    }
    if (dt > 0) this.vel.set((this.pos.x - x0) / dt, 0, (this.pos.z - z0) / dt);
    this.ground(dt);
    this.pose(dt, sitting, lying);
  }

  /** The feet's homes for standing, sitting or lying (the planner steps them there). */
  setHomes(sit, lie) {
    for (const [i, L] of this.legs.entries()) {
      const h = this.homes[i], front = h.z > 0, sx = Math.sign(h.x);
      const S = lie ? DOG.lie[front ? 'front' : 'hind'] : sit && !front ? DOG.sit.hind : null;
      const fh = this.rig.planner.feet[i].home;
      if (S) fh.set(sx * S.x, 0, S.z); else fh.copy(h);
      void L;
    }
  }

  pose(dt, sitting = this.state === 'sit', lying = this.state === 'lie') {
    this.time += dt;
    this.setHomes(sitting, lying);
    const sitK = this.sitK = THREE.MathUtils.clamp(this.sitPose.update(dt, sitting && !lying ? 1 : 0), 0, 1.1);
    const lieK = this.lieK = THREE.MathUtils.clamp(this.liePose.update(dt, lying ? 1 : 0), 0, 1.1);
    this.object.position.copy(this.pos);
    this.object.rotation.y = this.heading;
    const physics = this.physics;
    const o = this.rig.update({ pos: this.pos, heading: this.heading, state: 'walk' }, dt, {
      ground: physics?.groundAt ? (x, from, z) => physics.groundAt(x, from, z, 4) : null,
    });
    // the body: on its feet; sitting, it tips back about the shoulders and the rump goes down; lying, all of it
    const pitch = o.pitch + DOG.sit.pitch * sitK * (1 - lieK), F = DOG.hips.front;
    _q.set(0, F.y, F.z).applyAxisAngle(_x, pitch);
    this.body.position.set(o.x, o.y + F.y - _q.y - DOG.lie.drop * lieK, F.z - _q.z + o.z);
    this.body.rotation.set(pitch, o.yaw, o.roll);
    // the head: steady against the bob (it lags the body's height on a spring), up at you, down to sniff
    const bobY = this.body.position.y;
    const steady = this.headK.update(dt, bobY) - bobY;
    const barking = this.barkT !== undefined && this.time - this.barkT < 0.18;
    const sniff = this.state === 'sniff' ? 1 : 0;
    this.neck.rotation.x = -0.08 - pitch * 0.85 - this.lookUp * 0.5 + sniff * 1.05 - (barking ? 0.25 : 0) + lieK * 0.25 - steady * 1.5;
    this.head.rotation.x = -this.lookUp * 0.45 + sniff * (1.0 + Math.sin(this.time * 9) * 0.06) + (barking ? -0.15 : 0);
    this.head.rotation.y = damp(this.head.rotation.y, this.state === 'petted' ? Math.sin(this.time * 3) * 0.25 : sniff ? Math.sin(this.time * 1.7) * 0.5 : 0, 4, dt);
    this.head.rotation.z = this.state === 'petted' ? 0.25 : 0;
    // the ears: flop with the bob and the pace; the folded one hangs further
    const vy = dt > 0 ? (bobY - this.prevY) / dt : 0;
    this.prevY = bobY;
    for (const [k, e] of this.ears.entries()) {
      const fold = k === 0 ? 0.55 : 0.25;   // (forward over: a negative turn about x swings the hanging flap ahead)
      e.rotation.x = -fold - this.earK[k].update(dt, THREE.MathUtils.clamp(vy * 0.6 + Math.min(0.5, this.speed * 0.06) + (barking ? 0.3 : 0), -0.8, 0.8));
      e.rotation.z = (k === 0 ? -1 : 1) * 0.15;
    }
    // the tail: hangs low, lifts a little when he is happy or hurrying, wags by how happy; each link lags the last
    const wagF = 6 + this.wag * 12, amp = (0.15 + this.wag * 0.5) * (1 - lieK * 0.6) * (sitK > 0.5 ? 0.7 : 1);
    const wag = Math.sin(this.time * wagF) * amp;
    this.tailRoot.rotation.set(-2.55 + this.wag * 0.5 + Math.min(0.4, this.speed * 0.05) + sitK * 0.6 + lieK * 0.7, 0, 0);
    // (the root link swings with the wag; each link after follows the one before on its spring, so the tip lags)
    let lag = wag;
    for (const [i, j] of this.tail.entries()) {
      if (i > 0) lag = this.tailK[i].update(dt, lag);
      j.rotation.z = lag * (i === 0 ? 1 : 0.7);
      j.rotation.x = i === 0 ? 0 : -0.18 - 0.12 * i + sitK * 0.3;
    }
    this.rig.write();
  }

  dispose() { this.object.removeFromParent(); }
}
const _x = new THREE.Vector3(1, 0, 0);
