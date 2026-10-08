import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { bracerMount, carry, fitScale } from './blade-grip.js';

// The shield: a makers' brass disc worn on the back of the traveller's left hand (src/blade-grip.js
// bracerMount), always there with the backpack, folded small. Raise the guard (LB / L1) and it opens
// in a blink: six brass petals spin out of the disc round the hub, a brass ring closes round them,
// and the tank's fluid spills out beyond them: no disc but a living blob of it, its edge never quite
// round, rippling as it flows, drawn as ink would draw it (a few swirling strokes following the flow
// round the hub, a bright wavy rim inked on its outside, the traveller seen through the gaps). As it
// opens it slides off the back of the hand on a short brass arm to the middle of the chest, where it
// covers both sides alike, and swivels on its hub to face the guard's way. Held, a ripple runs out to
// the rim; a block sends ripples running out, a perfect parry bursts bright rings off it, a blow it
// cannot take (the tank empty) cracks it and it flickers; let go and the fluid drains back into the
// hub, the arm folds back onto the hand and the petals fold away.
//
//   new ShieldState()            the pure state machine: update(dt, want) -> 'open' | 'close' | null,
//                                hit('block' | 'perfect' | 'broken'); open, fill, ribs(i), flare, flash, crack
//   blobRadius(theta, t, wobble) the fluid's edge (unit radius about 1): never a circle, rippling with time
//   shieldArc(chest, centre, normal, radius, up)   the bearing a shape covers round the chest (the guard's arc);
//                                radius a number (a disc) or { plus, minus } (its reach either side, measured)
//   centreTarget(...)            where the open shield sits: off the bracer toward the chest's middle line
//   new ShieldDevice(tool)       the drawn device: update(dt, { want, dir, up, chest }) after the pose, arc() for the guard

export const SHIELD = {
  radius: 0.35,       // m, open (the blob's mean reach; the traveller stays in sight behind it)
  petal: 0.1,         // m, the brass petals' reach round the hub
  hub: 0.034,         // m, the folded disc
  ribs: 6,
  open: 0.16,         // s to open (the guard is up at half of it: GUARD in src/fluid-blade.js)
  close: 0.14,        // s to fold away
  stand: 0.03,        // m the open shield stands off the back of the hand (before the arm swings it in)
  slack: 0.15,        // m round the rim a blow still meets it (the foe's swing is not a line)
  // open, it slides off the bracer on its arm to the chest's middle line: `pull` of the way across, its
  // reach ahead of the chest kept within `ahead` (m, min and max), at most `arm` m from the bracer
  pull: 1, ahead: [0.36, 0.44], arm: 0.42,
  wobble: 1,          // the edge's ripple at rest (1: the blob's own); spilling out and struck it ripples more
  flare: 0.25, flash: 0.4, crack: 0.7,   // s each hit's look lasts
};

const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Open or folded and how far between, and what the last blow did to it. Pure: no three.js. */
export class ShieldState {
  constructor() { this.k = 0; this.state = 'folded'; this.flare = 0; this.flash = 0; this.crack = 0; this.t = 0; this.spin = 0; }

  /** A frame: `want` the guard is held. Returns 'open' as it starts to open, 'close' as it starts to fold, else null. */
  update(dt, want) {
    dt = Math.max(0, dt);
    this.t += dt;
    let said = null;
    if (want && (this.state === 'folded' || this.state === 'closing')) { this.state = 'opening'; said = 'open'; }
    else if (!want && (this.state === 'open' || this.state === 'opening' || this.state === 'broken')) { this.state = 'closing'; said = 'close'; }
    if (this.state === 'opening') { this.k = Math.min(1, this.k + dt / SHIELD.open); if (this.k >= 1) this.state = 'open'; }
    else if (this.state === 'closing') { this.k = Math.max(0, this.k - dt / SHIELD.close); if (this.k <= 0) this.state = 'folded'; }
    this.flare = Math.max(0, this.flare - dt / SHIELD.flare);
    this.flash = Math.max(0, this.flash - dt / SHIELD.flash);
    this.crack = Math.max(0, this.crack - dt / SHIELD.crack);
    if (this.state === 'broken' && this.crack === 0) this.state = this.k >= 1 ? 'open' : 'opening';
    this.spin += dt * (this.state === 'opening' ? 9 : this.state === 'closing' ? -9 : 0.25);
    return said;
  }

  /** A blow on it: 'block' flares it, 'perfect' flashes it, 'broken' cracks it (it flickers while held). */
  hit(kind) {
    if (this.k <= 0) return;
    if (kind === 'perfect') { this.flash = 1; this.flare = 1; }
    else if (kind === 'broken') { this.crack = 1; this.state = 'broken'; }
    else this.flare = 1;
  }

  get up() { return this.state !== 'folded'; }
  /** The fluid between the ribs, 0 at the hub .. 1 to the rim (it floods once the ribs are mostly out, drains first). */
  get fill() { return smooth(this.k, 0.35, 1); }
  /** Rib i of n: 0 folded in the disc .. 1 out at its place (each a little after the last). */
  rib(i, n = SHIELD.ribs) { const d = (i / n) * 0.3; return smooth(this.k, d, d + 0.6); }
  /** How much its edge ripples now: spilling out, struck, cracked it ripples more. */
  get wobble() { return SHIELD.wobble * (1 + 1.4 * (1 - this.fill) + 1.2 * this.flare + 0.8 * this.crack); }
  /** Seen at all this frame (a cracked one flickers out now and then). */
  shown(t = this.t) { return !(this.crack > 0.15 && Math.sin(t * 91 + Math.sin(t * 37) * 3) > 0.35); }
}

/**
 * The fluid's edge at bearing `theta` round the hub (unit: about 1, between ~0.86 and ~1.1), at time `t`:
 * three waves of different counts running round at different speeds, so it is never a circle and never
 * the same twice; `wobble` scales them (0: a circle). Pure.
 */
export function blobRadius(theta, t = 0, wobble = 1) {
  const w = 0.06 * Math.sin(3 * theta + 1.3 * t) + 0.04 * Math.sin(5 * theta - 2.1 * t + 1) + 0.025 * Math.sin(8 * theta + 3.4 * t + 2);
  return 1 + Math.min(2.5, wobble) * w;
}

/**
 * The guard's arc from the shield as drawn: the bearings round `chest` (flat, about `up`) between
 * the shape's two edges (its reach either side of `centre` across its facing `normal`, + SHIELD.slack).
 * `radius` is a number (a disc: the same reach both ways) or { plus, minus }: its reach toward
 * up × normal and away from it, measured off the drawn edge (ShieldDevice.arc).
 * Returns { dir (flat unit, the arc's middle), half (rad) } for inGuard (src/fluid-blade.js).
 */
export function shieldArc(chest, centre, normal, radius, up = new THREE.Vector3(0, 1, 0), slack = SHIELD.slack) {
  const flat = (v) => v.addScaledVector(up, -v.dot(up));
  const n = flat(normal.clone());
  if (n.lengthSq() < 1e-8) n.copy(flat(new THREE.Vector3().subVectors(centre, chest)));
  n.normalize();
  const plus = typeof radius === 'number' ? radius : radius.plus, minus = typeof radius === 'number' ? radius : radius.minus;
  const side = new THREE.Vector3().crossVectors(up, n).normalize();
  const a = flat(new THREE.Vector3().subVectors(centre, chest).addScaledVector(side, plus + slack)).normalize();
  const b = flat(new THREE.Vector3().subVectors(centre, chest).addScaledVector(side, -(minus + slack))).normalize();
  const dir = new THREE.Vector3().addVectors(a, b);
  if (dir.lengthSq() < 1e-8) dir.copy(n); else dir.normalize();
  return { dir, half: Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) / 2 };
}

/**
 * Where the open shield's hub goes (world), from the bracer's `bracer` and the chest's `chest`, the guard's
 * flat way `dir` and `up`: slid across toward the chest's middle line by `pull`, its reach ahead of the chest
 * kept within `ahead`, its height the hand's; never more than `arm` from the bracer (the brass arm's length).
 * `w` (0..1) how far it has slid (it slides as it opens). Pure but for the vectors; writes `out`.
 */
export function centreTarget(bracer, chest, dir, up, w = 1, out = new THREE.Vector3(), { pull = SHIELD.pull, ahead = SHIELD.ahead, arm = SHIELD.arm } = {}) {
  const d = new THREE.Vector3().subVectors(bracer, chest), side = new THREE.Vector3().crossVectors(up, dir).normalize();
  const across = d.dot(side), fwd = d.dot(dir);
  const want = new THREE.Vector3().addScaledVector(side, -across * pull).addScaledVector(dir, THREE.MathUtils.clamp(fwd, ahead[0], ahead[1]) - fwd);
  if (want.length() > arm) want.setLength(arm);
  return out.copy(bracer).addScaledVector(want, w);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _Z = new THREE.Vector3(0, 0, 1), _Y = new THREE.Vector3(0, 1, 0);

/**
 * A flat stroke in the shield's plane, rebuilt as it flows: a line of points with a width at each,
 * both faces drawn (it is seen from the front and over the shoulder alike).
 */
class Stroke {
  constructor(n, material, closed = false, z = 0) {
    this.n = n; this.closed = closed; this.z = z;
    const pos = new Float32Array(n * 2 * 3), nor = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n * 2; i++) nor[i * 3 + 2] = 1;
    const idx = [], segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = ((i + 1) % n) * 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b, a, b, a + 1, a + 1, b, b + 1);   // (and the back)
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.pts = Array.from({ length: n }, () => [0, 0, 0]);   // x, y, half-width
  }
  /** Rebuild from this.pts (filled by the caller). */
  build() {
    const P = this.pts, n = this.n, pos = this.geo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      const p = P[i], a = P[this.closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[this.closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = p[2];
      pos.set([p[0] - ty * w, p[1] + tx * w, this.z, p[0] + ty * w, p[1] - tx * w, this.z], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

/** The device on the left hand, drawn: the brass disc, its arm, the petals, the fluid, its rim, the cracks. */
export class ShieldDevice {
  constructor(tool) {
    this.tool = tool;
    this.s = new ShieldState();
    const brass = makeMaterial({ color: '#c99a46', metal: 'brass', key: 'fluid-blade-brass' });
    const dark = makeMaterial({ color: '#5b4326', metal: 'brass', key: 'shield-brass-dark' });
    const edge = makeMaterial({ color: '#fffbea', flat: true, glow: 1, key: 'fluid-blade-edge' });
    const ink = makeMaterial({ color: '#2b211f', flat: true, key: 'shield-crack' });
    this.root = new THREE.Group();
    this.root.name = 'shield bracer';
    // the disc on the back of the hand: a brass drum with a raised rim and a bead of fluid at its hub, strapped round the palm
    const disc = new THREE.Group();
    disc.add(new THREE.Mesh(new THREE.CylinderGeometry(SHIELD.hub, SHIELD.hub * 1.06, 0.01, 18).rotateX(Math.PI / 2).translate(0, 0, 0.002), brass));
    disc.add(new THREE.Mesh(new THREE.TorusGeometry(SHIELD.hub * 0.92, 0.0035, 5, 20).translate(0, 0, 0.0085), dark));
    // the ribs folded into it, their ends drawn on its face like the leaves of a closed iris
    for (let i = 0; i < SHIELD.ribs; i++) {
      const a = (i / SHIELD.ribs) * Math.PI * 2, leaf = new THREE.Mesh(new THREE.BoxGeometry(0.0025, SHIELD.hub * 0.5, 0.002).translate(0, SHIELD.hub * 0.5, 0.0078), dark);
      leaf.rotation.z = a + 0.35;
      disc.add(leaf);
    }
    this.bead = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8).scale(1, 1, 0.5).translate(0, 0, 0.008), tool.globMat);
    disc.add(this.bead);
    this.root.add(disc);
    // the arm: a brass rod from a knuckle on the disc to the shield's hub, swung out as it opens
    this.arm = new THREE.Group();
    this.rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.009, 1, 6).translate(0, 0.5, 0), brass);
    this.knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), dark);
    this.arm.add(this.rod, this.knuckle);
    this.root.add(this.arm);
    // the shield: on the arm's end, swivelled to face the guard's way (face). Round the hub a collar of six
    // brass petals and a brass ring (the only solid part); beyond them the fluid as ink would draw it: a
    // few swirling strokes round the hub, a wavy bright rim with its ink line outside, a ripple running out
    // (the game's materials are opaque: the see-through is the gaps between the strokes)
    this.face = new THREE.Group();
    this.root.add(this.face);
    this.ribs = [];
    for (let i = 0; i < SHIELD.ribs; i++) {
      const pivot = new THREE.Group(), tilt = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.012, 1, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.22).translate(0, 0.5, 0.004), brass);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 5), dark);
      tilt.add(plate, tip); pivot.add(tilt);
      this.face.add(pivot);
      this.ribs.push({ pivot, tilt, rib: plate, tip, home: (i / SHIELD.ribs) * Math.PI * 2 });
    }
    this.collar = new THREE.Mesh(new THREE.TorusGeometry(SHIELD.petal * 0.92, 0.006, 6, 36), brass);
    // the fluid (in metres: the strokes are rebuilt each frame at the shield's size)
    this.field = new THREE.Group();
    this.flows = Array.from({ length: 5 }, (_, i) => new Stroke(22, tool.globMat, false, i % 2 ? 0.003 : -0.003));
    this.rimLine = new Stroke(72, edge, true, 0.004);
    this.inkLine = new Stroke(72, ink, true, -0.002);
    this.ripple = new Stroke(56, edge, true, 0.002);
    this.waves = [new Stroke(56, tool.globMat, true, 0.005), new Stroke(56, edge, true, 0.006)];   // (a block's ripples running out)
    this.bursts = [new Stroke(56, edge, true, 0.008), new Stroke(56, edge, true, 0.008)];         // (a parry's bright rings off it)
    this.field.add(...this.flows.map((s) => s.mesh), this.rimLine.mesh, this.inkLine.mesh, this.ripple.mesh, ...this.waves.map((s) => s.mesh), ...this.bursts.map((s) => s.mesh));
    // the cracks: a zigzag of ink lines across the fluid from near the hub (unit radius: scaled to the shield's)
    this.cracks = new THREE.Group();
    const zig = [[0.05, 0.1], [0.32, 0.22], [0.5, 0.12], [0.78, 0.3], [0.97, 0.2]];
    for (const turn of [0.3, 2.2, 4.1]) for (let i = 0; i < zig.length - 1; i++) {
      const [r0, a0] = zig[i], [r1, a1] = zig[i + 1];
      const p0 = new THREE.Vector2(Math.cos(turn + a0) * r0, Math.sin(turn + a0) * r0), p1 = new THREE.Vector2(Math.cos(turn + a1) * r1, Math.sin(turn + a1) * r1);
      const len = p0.distanceTo(p1), seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.012), ink);
      seg.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0.012);
      seg.rotation.z = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      this.cracks.add(seg);
    }
    this.face.add(this.collar, this.field, this.cracks);
    this.root.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; o.frustumCulled = false; });
    this.root.visible = false;
    this.mount = null;
    this.centre = new THREE.Vector3(); this.normal = new THREE.Vector3(0, 0, 1);
    this.reach = 0;   // the blob's reach now (m, its mean radius as drawn)
    this.outline = Array.from({ length: 36 }, () => new THREE.Vector3());   // its edge in the world, for the arc
  }

  /** On the hand once there is a body with hands (else nowhere: no shield drawn, the guard's own arc). */
  attach() {
    const H = this.tool.player?.humanoid;
    if (H && this.mount?.bone && this.mount.humanoid === H && this.root.parent === this.mount.bone) return true;
    const m = H?.b?.hand_l ? bracerMount(H) : null;
    if (!m) { this.root.removeFromParent(); this.mount = null; return false; }
    this.mount = { ...m, humanoid: H };
    carry(this.root, this.mount);
    return true;
  }

  /** The fluid drawn for this frame: R the blob's reach (m), f how far it has flooded, at time t. */
  drawFluid(R, f, t, S) {
    const wob = S.wobble, TAU = Math.PI * 2;
    const edgeAt = (th, scale = 1, extra = 0) => R * scale * blobRadius(th, t + extra, wob);
    // the rim: a bright wavy line (thicker where the edge bulges), its ink line just outside
    const fill = (stroke, scale, w, out = 0, extra = 0) => {
      for (let i = 0; i < stroke.n; i++) {
        const th = (i / stroke.n) * TAU, r = edgeAt(th, scale, extra) + out, p = stroke.pts[i];
        p[0] = Math.cos(th) * r; p[1] = Math.sin(th) * r; p[2] = w * (0.75 + 0.5 * (blobRadius(th, t, wob) - 0.92) / 0.18);
      }
      stroke.build();
    };
    fill(this.rimLine, 1, 0.0052 * (1 + 0.6 * S.flare));
    fill(this.inkLine, 1, 0.003, 0.0085);
    // the flow: strokes curling out from the collar toward the rim, turning slowly round the hub (the
    // fluid's tones running along them), each wavering; they reach the rim as the fluid floods out
    for (let j = 0; j < this.flows.length; j++) {
      const st = this.flows[j], th0 = (j / this.flows.length) * TAU + t * 0.55, n = st.n;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), th = th0 + 1.9 * u + 0.18 * Math.sin(3.1 * u + t * 2.3 + j);
        const r = (SHIELD.petal * 1.05 + (edgeAt(th) * 0.86 - SHIELD.petal * 1.05) * u) * Math.min(1, f * 1.15), p = st.pts[i];
        p[0] = Math.cos(th) * r; p[1] = Math.sin(th) * r; p[2] = 0.0055 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 + 0.5 * S.flare) + 0.0008;
      }
      st.build();
    }
    // held, a ripple runs out from the hub to the rim, the blob's shape
    const run = (t * 0.9) % 1;
    this.ripple.mesh.visible = f > 0.95 && S.crack === 0;
    if (this.ripple.mesh.visible) fill(this.ripple, 0.25 + 0.68 * run, 0.0035 * (1 - run * 0.6), 0, 0.4);
    // a block: two ripples running out past the rim as the flare dies
    for (let i = 0; i < this.waves.length; i++) {
      const k = S.flare - i * 0.25, w = this.waves[i];
      w.mesh.visible = k > 0.02;
      if (w.mesh.visible) fill(w, 0.35 + (1 - k) * 0.85, 0.006 * k, 0, 0.7 + i);
    }
    // a perfect parry: bright rings bursting off it
    for (let i = 0; i < this.bursts.length; i++) {
      const b = this.bursts[i];
      b.mesh.visible = S.flash > 0.02;
      if (b.mesh.visible) fill(b, (i ? 0.78 : 1.04) + 0.5 * (1 - S.flash), 0.008 * S.flash, 0, 1.5 + i);
    }
  }

  /**
   * Per frame, after the pose (src/fluid-blade.js update): want (the guard held), worn (shown at
   * all), dir (flat, the guard's way), up, chest (the chest's middle: the open shield slides to its
   * middle line). Returns what the state machine said ('open' | 'close' | null).
   */
  update(dt, { want = false, worn = true, dir = null, up = null, chest = null, time = 0 } = {}) {
    const S = this.s, said = S.update(dt, want && worn);
    const on = worn && this.attach() && this.tool.player?.object?.visible !== false;
    this.root.visible = on;
    if (!on) return said;
    fitScale(this.root);
    const k = S.k, R = SHIELD.radius;
    this.face.visible = k > 0.002;
    this.arm.visible = false;
    if (this.face.visible) {
      this.root.updateWorldMatrix(true, false);
      this.root.matrixWorld.decompose(_a, _q, _b);
      // where it sits: off the back of the hand, then (as it opens) slid on its arm to the chest's middle line
      const stand = _c.set(0, 0, SHIELD.stand * smooth(k, 0, 0.5));
      if (dir && up && chest) {
        const slide = smooth(k, 0.1, 0.85);
        centreTarget(_a, chest, dir, up, slide, _d);
        this.root.worldToLocal(_d);
        this.face.position.copy(stand).add(_d);
        const len = this.face.position.length();
        this.arm.visible = len > 0.02;
        if (this.arm.visible) {
          this.rod.quaternion.setFromUnitVectors(_Y, _b.copy(this.face.position).divideScalar(len));
          this.rod.scale.set(1, len, 1);
          this.knuckle.position.set(0, 0, 0.006);
        }
      } else this.face.position.copy(stand);
      // swivel on the hub toward the guard's way, as much as it is open (folded it lies on the hand)
      if (dir && up) {
        const z = _a.copy(dir).normalize(), x = _b.crossVectors(up, z).normalize(), y = _c.crossVectors(z, x);
        _q2.setFromRotationMatrix(_m.makeBasis(x, y, z));
        const turn = smooth(k, 0, 0.7);
        this.face.quaternion.copy(_q).invert().multiply(_q.clone().slerp(_q2, turn));
      } else this.face.quaternion.identity();
      // the petals spin out of the disc and fan out a little round the hub, the brass ring closing round them
      const shake = S.crack > 0 ? S.crack * 0.08 * Math.sin(time * 70) : 0;
      for (let i = 0; i < this.ribs.length; i++) {
        const r = this.ribs[i], u = S.rib(i, this.ribs.length);
        r.pivot.rotation.z = THREE.MathUtils.lerp(-Math.PI * 0.5 + i * 0.08, r.home, u) + S.spin * 0.04 * (1 - u) + shake * (i % 2 ? 1 : -1);
        r.tilt.rotation.x = -0.35 * u;   // (fanned back from the face, a shallow cup)
        const len = THREE.MathUtils.lerp(SHIELD.hub * 0.9, SHIELD.petal, u);
        r.rib.scale.set(1, len, 1); r.tip.position.set(0, len, 0.004);
      }
      this.collar.visible = k > 0.5;
      this.collar.scale.setScalar(smooth(k, 0.5, 1));
      // the fluid spills out of the hub, swells with a blow
      const f = S.fill, shown = S.shown(time);
      this.reach = Math.max(0.01, R * f * (1 + 0.012 * Math.sin(time * 9) + 0.12 * S.flare));
      this.field.visible = f > 0.01 && shown;
      if (this.field.visible) this.drawFluid(this.reach, f, time, S);
      this.cracks.visible = S.crack > 0.02 && f > 0.3;
      this.cracks.scale.setScalar(this.reach);
    } else this.reach = 0;
    // where it is, for the guard's arc (src/fluid-blade.js block) and the block's splash: its hub, its facing, its edge
    this.face.updateWorldMatrix(true, false);
    this.centre.setFromMatrixPosition(this.face.matrixWorld);
    this.normal.copy(_Z).transformDirection(this.face.matrixWorld);
    const n = this.outline.length;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2, r = this.reach * blobRadius(th, time, S.wobble);
      this.outline[i].set(Math.cos(th) * r, Math.sin(th) * r, 0).applyMatrix4(this.face.matrixWorld);
    }
    return said;
  }

  /**
   * The guard's arc round `chest` from the shield as drawn now, or null (not drawn, or not open enough to
   * tell): its reach either side measured off the drawn edge (open, never less than SHIELD.radius's share
   * as it floods: the guard is up from half open).
   */
  arc(chest, up) {
    if (!this.root.visible || !this.root.parent || this.s.k < 0.3) return null;
    const n = _a.copy(this.normal).addScaledVector(up, -this.normal.dot(up));
    if (n.lengthSq() < 1e-8) return shieldArc(chest, this.centre, this.normal, SHIELD.radius, up);
    n.normalize();
    const side = _b.crossVectors(up, n).normalize();
    let plus = 0, minus = 0;
    for (const p of this.outline) { const s = _c.subVectors(p, this.centre).dot(side); plus = Math.max(plus, s); minus = Math.max(minus, -s); }
    // (opening, the guard is up before the fluid is all out: it covers at least what a disc of its size would)
    const least = SHIELD.radius * 0.9;
    return shieldArc(chest, this.centre, this.normal, { plus: Math.max(plus, least), minus: Math.max(minus, least) }, up);
  }

  dispose() { this.root.removeFromParent(); }
}
