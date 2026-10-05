import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { ell, cyl, cone, tube, merge } from './wildlife/geo.js';

// Moustache, the dog at home (src/story/home.js): a scruffy, medium-sized
// dog, built and moved like the wildlife (src/wildlife/geo.js: flat printed
// colours, one geometry per moving part) but on his own: he follows you.
//
//   follow  trots after you, a couple of metres off your shoulder; gallops to
//           catch up; through the doors and into the houses with you
//   sniff   you stand still a while: he noses about near you
//   sit     ...and then sits, looking up at you, tail going
//   bark    the bird or the drone comes near: he plants his feet and barks at it
//   petted  you pet him (an interact): he sits, leans into your hand, wags hard
//   lie     he lies down (by the stone while you sit there: home.js lie())
//
// Procedural: four legs swing in a trot (diagonal pairs) or a gallop (front
// and back pairs) with the speed, the head bobs and turns to look, the ears
// flop with the motion, the tail wags faster when he's happy.

const Y = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _push = new THREE.Vector3();
const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

const FUR = '#b9a07e', FUR2 = '#8f7658', PALE = '#efe3cc', INK = '#2b211f', NOSE = '#3b2a24';

/** The dog's parts, in his own frame (+z his nose, +y up; his shoulder 0.5 m off the ground). */
function buildParts() {
  const body = merge([
    ell([0.2, 0.19, 0.42], FUR, [0, 0.52, -0.02], null, [10, 7]),
    ell([0.17, 0.17, 0.2], FUR2, [0, 0.56, -0.3], null, [8, 6]),            // the haunch, darker
    ell([0.15, 0.15, 0.17], PALE, [0, 0.47, 0.24], null, [8, 6]),           // the pale chest
    // scruff: tufts along the back
    ...[-0.3, -0.15, 0, 0.15, 0.3].map((z, i) => cone(0.05, 0.1, i % 2 ? FUR2 : FUR, [0, 0.7 - Math.abs(z) * 0.12, z], [-0.5, 0, 0], 5)),
    ell([0.06, 0.08, 0.06], FUR, [0, 0.66, 0.34], [-0.4, 0, 0]),             // the neck
  ]);
  const head = merge([
    ell([0.12, 0.11, 0.13], FUR, [0, 0, 0], null, [9, 7]),
    ell([0.07, 0.06, 0.11], PALE, [0, -0.03, 0.12], null, [8, 5]),          // the muzzle
    ell([0.03, 0.025, 0.025], NOSE, [0, -0.005, 0.225]),
    // the moustache: two bushy tufts under the nose, the reason for his name
    ell([0.055, 0.03, 0.04], '#f7f4ec', [-0.04, -0.06, 0.19], [0, 0.4, 0.3]), ell([0.055, 0.03, 0.04], '#f7f4ec', [0.04, -0.06, 0.19], [0, -0.4, -0.3]),
    // eyebrows like an old man's, and the eyes under them
    ell([0.035, 0.015, 0.02], '#e6d8bc', [-0.05, 0.065, 0.1], [0, 0, 0.3]), ell([0.035, 0.015, 0.02], '#e6d8bc', [0.05, 0.065, 0.1], [0, 0, -0.3]),
    ell([0.018, 0.018, 0.012], INK, [-0.05, 0.035, 0.115]), ell([0.018, 0.018, 0.012], INK, [0.05, 0.035, 0.115]),
    ell([0.04, 0.04, 0.03], FUR2, [0, 0.09, -0.02]),                          // a tuft on top
  ]);
  const ear = (s) => merge([ell([0.035, 0.085, 0.05], FUR2, [s * 0.015, -0.07, 0], [0, 0, s * 0.15])]);   // hangs from its root
  const upper = merge([cyl(0.05, 0.04, 0.22, FUR, [0, -0.11, 0])]);
  const lower = merge([cyl(0.035, 0.03, 0.2, FUR, [0, -0.1, 0]), ell([0.04, 0.025, 0.06], PALE, [0, -0.2, 0.02])]);
  const tail = merge([tube([[0, 0, 0], [0, 0.1, -0.08], [0, 0.2, -0.12], [0, 0.27, -0.08]], 0.035, FUR2, 8, 5), ell([0.04, 0.05, 0.04], PALE, [0, 0.28, -0.07])]);
  return { body, head, ear, upper, lower, tail };
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
    this.state = 'sit';
    this.stateT = 0;
    this.phase = 0;        // the gait's phase (rad)
    this.wag = 0;          // how happy (0..1): the tail
    this.look = 0;         // head turn (rad)
    this.lookUp = 0;       // head lift
    this.sitK = 1;         // 0 standing .. 1 sitting
    this.lieK = 0;
    this.barkCool = 0;
    this.barks = 0;
    this.stillT = 0;
    this.sniffAt = null;
    this.time = Math.random() * 10;
    const P = buildParts();
    const m = makeMaterial({ color: '#ffffff', vertexColors: true });
    const mesh = (g) => { const o = new THREE.Mesh(g, m); o.userData.noCollide = true; return o; };
    this.object = new THREE.Group();
    this.object.name = `dog ${name}`;
    this.object.userData.noCollide = true;
    this.rig = new THREE.Group();          // lowered when he sits or lies
    this.object.add(this.rig);
    this.body = new THREE.Group();
    this.rig.add(this.body);
    this.body.add(mesh(P.body));
    this.neck = new THREE.Group(); this.neck.position.set(0, 0.7, 0.4); this.body.add(this.neck);
    this.head = new THREE.Group(); this.head.position.set(0, 0.04, 0.06); this.neck.add(this.head);
    this.head.add(mesh(P.head));
    this.ears = [-1, 1].map((s) => { const e = new THREE.Group(); e.position.set(s * 0.1, 0.06, -0.02); e.add(mesh(P.ear(s))); this.head.add(e); return e; });
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.62, -0.42); this.tail.add(mesh(P.tail)); this.body.add(this.tail);
    // legs: [x, z] of the hip; front pair at +z
    this.legs = [[-0.11, 0.26], [0.11, 0.26], [-0.11, -0.3], [0.11, -0.3]].map(([x, z], i) => {
      const hip = new THREE.Group(); hip.position.set(x, 0.46, z);
      hip.add(mesh(P.upper));
      const knee = new THREE.Group(); knee.position.y = -0.22; hip.add(knee); knee.add(mesh(P.lower));
      this.body.add(hip);
      return { hip, knee, front: i < 2, side: x < 0 ? -1 : 1 };
    });
    this.object.scale.setScalar(1.15);
    scene?.add(this.object);
    this.place();
  }

  /** Stand on the ground at x, z (from a little above), else keep the height. */
  ground(dt = 1) {
    const g = this.physics?.groundAt?.(this.pos.x, this.pos.y + 1.2, this.pos.z, 4);
    if (Number.isFinite(g)) this.pos.y = dt >= 1 ? g : damp(this.pos.y, g, 18, dt);
  }

  place() { this.ground(1); this.object.position.copy(this.pos); this.object.rotation.y = this.heading; }

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
    this.time += dt; this.stateT += dt;
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
          want = THREE.MathUtils.clamp((d - 0.6) * 1.9, 1.1, d > 9 ? 7.5 : 5.2);
          face = Math.atan2(tx - this.pos.x, tz - this.pos.z);
          this.sniffAt = null;
          if (d > 45) { this.pos.set(tx, L.pos.y, tz); this.ground(1); }   // (left far behind: a portal, a jump)
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
    // move
    this.speed = damp(this.speed, want, want > this.speed ? 4 : 7, dt);
    if (face !== null) this.heading += angDiff(this.heading, face) * (1 - Math.exp(-(this.speed > 2 ? 7 : 4) * dt));
    if (this.speed > 0.02) {
      this.pos.x += Math.sin(this.heading) * this.speed * dt;
      this.pos.z += Math.cos(this.heading) * this.speed * dt;
      this.physics?.pushCapsule?.(this.pos, 0.3, 0.45, 0.7, _push);
    }
    this.ground(dt);
    this.pose(dt);
  }

  pose(dt) {
    const sp = this.speed, gallop = sp > 4.5;
    this.phase += dt * (sp < 0.05 ? 0 : (gallop ? 2.4 : 3.3) * Math.PI * Math.min(1.6, 0.55 + sp * 0.32));
    const sitting = (this.state === 'sit' || this.state === 'petted') && sp < 0.4;
    this.sitK = damp(this.sitK, sitting ? 1 : 0, 5, dt);
    this.lieK = damp(this.lieK, this.state === 'lie' ? 1 : 0, 3, dt);
    const swing = Math.min(1, sp / 2.5) * (gallop ? 0.75 : 0.55);
    for (const [i, leg] of this.legs.entries()) {
      // trot: diagonal pairs together; gallop: the front pair, then the back pair
      const off = gallop ? (leg.front ? 0 : Math.PI) + (leg.side > 0 ? 0.35 : 0) : (leg.front === (leg.side > 0) ? 0 : Math.PI);
      const s = Math.sin(this.phase + off);
      leg.hip.rotation.x = -s * swing;
      leg.knee.rotation.x = (leg.front ? -1 : 1) * Math.max(0, Math.cos(this.phase + off)) * swing * 0.9;
      // sitting: the back legs fold under, the front ones stay straight; lying: all fold
      if (!leg.front) { leg.hip.rotation.x += -1.25 * this.sitK; leg.knee.rotation.x += 2.1 * this.sitK; }
      leg.hip.rotation.x += (leg.front ? -1.3 : -1.2) * this.lieK;
      leg.knee.rotation.x += (leg.front ? -0.2 : 2.2) * this.lieK;
      void i;
    }
    // the body: tips back to sit, lowers to lie, bobs with the stride
    const bob = sp > 0.05 ? Math.abs(Math.sin(this.phase)) * (gallop ? 0.05 : 0.025) : Math.sin(this.time * 2.4) * 0.006;
    this.body.rotation.x = -0.5 * this.sitK * (1 - this.lieK) + (gallop ? Math.sin(this.phase) * 0.08 : 0);
    this.rig.position.y = -0.17 * this.sitK * (1 - this.lieK) - 0.33 * this.lieK + bob;
    this.rig.position.z = -0.12 * this.sitK;
    // the head: looks where he is going, up at you, at the sky when he barks; drops to sniff
    const barking = this.barkT !== undefined && this.time - this.barkT < 0.18;
    this.neck.rotation.x = -this.lookUp * 0.6 + 0.5 * this.sitK * (1 - this.lieK) - (barking ? 0.25 : 0) + this.lieK * 0.35;
    this.head.rotation.x = -this.lookUp * 0.5 + (this.state === 'sniff' ? 0.5 : 0) + Math.sin(this.time * 7) * 0.03 * (this.state === 'sniff' ? 1 : 0);
    this.head.rotation.y = damp(this.head.rotation.y, this.state === 'petted' ? Math.sin(this.time * 3) * 0.25 : this.state === 'sniff' ? Math.sin(this.time * 1.7) * 0.5 : 0, 4, dt);
    this.head.rotation.z = this.state === 'petted' ? 0.25 : 0;
    // the ears: flop with the bob and the turn
    for (const [k, e] of this.ears.entries()) e.rotation.x = damp(e.rotation.x, -Math.min(0.9, sp * 0.12) + (barking ? -0.3 : 0), 10, dt) + Math.sin(this.phase * 2 + k) * 0.05 * Math.min(1, sp);
    // the tail
    this.tail.rotation.y = Math.sin(this.time * (6 + this.wag * 12)) * (0.2 + this.wag * 0.55);
    this.tail.rotation.x = -0.25 - this.wag * 0.35 + this.lieK * 0.9;
    this.object.position.copy(this.pos);
    this.object.rotation.y = this.heading;
  }

  dispose() { this.object.removeFromParent(); }
}
