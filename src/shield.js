import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { bracerMount, carry, fitScale } from './blade-grip.js';

// The shield: a makers' brass disc worn on the back of the traveller's left hand (src/blade-grip.js
// bracerMount), always there with the backpack, folded small. Raise the guard (LB / L1) and it opens
// in a blink: six brass petals spin out of the disc and fan out a little round the hub, a brass
// ring closes round them, and the tank's fluid floods out beyond them as ink would draw it (a few
// rings, a cross-hatch, the traveller seen through the gaps) inside a bright rim; as it opens it
// swivels on the hub to face the guard's way. Held, a shimmer runs out to the rim; a block
// flares it, a perfect parry bursts white rings off it, a blow it cannot take (the tank empty) cracks it and
// it flickers; let go and the fluid drains back into the hub and the petals fold away.
//
//   new ShieldState()            the pure state machine: update(dt, want) -> 'open' | 'close' | null,
//                                hit('block' | 'perfect' | 'broken'); open, fill, ribs(i), flare, flash, crack
//   shieldArc(chest, centre, normal, radius, up)   the bearing a disc covers round the chest (the guard's arc)
//   new ShieldDevice(tool)       the drawn device: place(dt, { dir, up }) after the pose, arc() for the guard

export const SHIELD = {
  radius: 0.35,       // m, open (the traveller stays in sight behind it)
  petal: 0.1,         // m, the brass petals' reach round the hub
  hub: 0.034,         // m, the folded disc
  ribs: 6,
  open: 0.16,         // s to open (the guard is up at half of it: GUARD in src/fluid-blade.js)
  close: 0.14,        // s to fold away
  stand: 0.03,        // m the open shield stands off the back of the hand
  slack: 0.15,        // m round the rim a blow still meets it (the foe's swing is not a line)
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
  /** Seen at all this frame (a cracked one flickers out now and then). */
  shown(t = this.t) { return !(this.crack > 0.15 && Math.sin(t * 91 + Math.sin(t * 37) * 3) > 0.35); }
}

/**
 * The guard's arc from the shield as drawn: the bearings round `chest` (flat, about `up`) between
 * the disc's two edges (`radius` + SHIELD.slack either side of `centre`, across its facing `normal`).
 * Returns { dir (flat unit, the arc's middle), half (rad) } for inGuard (src/fluid-blade.js).
 */
export function shieldArc(chest, centre, normal, radius, up = new THREE.Vector3(0, 1, 0), slack = SHIELD.slack) {
  const flat = (v) => v.addScaledVector(up, -v.dot(up));
  const n = flat(normal.clone());
  if (n.lengthSq() < 1e-8) n.copy(flat(new THREE.Vector3().subVectors(centre, chest)));
  n.normalize();
  const side = new THREE.Vector3().crossVectors(up, n).normalize(), r = radius + slack;
  const a = flat(new THREE.Vector3().subVectors(centre, chest).addScaledVector(side, r)).normalize();
  const b = flat(new THREE.Vector3().subVectors(centre, chest).addScaledVector(side, -r)).normalize();
  const dir = new THREE.Vector3().addVectors(a, b);
  if (dir.lengthSq() < 1e-8) dir.copy(n); else dir.normalize();
  return { dir, half: Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)) / 2 };
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _Z = new THREE.Vector3(0, 0, 1);

/** The device on the left hand, drawn: the brass disc, the ribs, the fluid, the rim, the cracks. */
export class ShieldDevice {
  constructor(tool) {
    this.tool = tool;
    this.s = new ShieldState();
    const R = SHIELD.radius, brass = makeMaterial({ color: '#c99a46', metal: 'brass', key: 'fluid-blade-brass' });
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
    // the shield: swivels on the hub to face the guard's way (face). Round the hub a collar of six brass
    // petals that fan out a little and a brass ring; beyond them no solid disc but the fluid drawn as ink
    // would draw it: a few rings, a cross-hatch, a bright rim and a shimmer running out to it (the game's
    // materials are opaque: the see-through is the gaps between the lines)
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
    this.field = new THREE.Group();   // (unit radius: scaled to the shield's)
    const lines = [], fine = 0.009, clear = 0.42;
    for (const r of [0.48, 0.76]) lines.push(new THREE.Mesh(new THREE.TorusGeometry(r, fine, 4, 48), tool.globMat));
    // the hatching in a band round the edge (thicker toward the rim, as ink shades a curve), clear round the hub
    for (const turn of [Math.PI / 4, -Math.PI / 4]) for (let d = -0.81; d <= 0.82; d += 0.27) {
      const out = Math.sqrt(Math.max(0, 1 - d * d)) * 0.97, inner = Math.abs(d) < clear ? Math.sqrt(clear * clear - d * d) : 0;
      for (const [u0, u1] of inner ? [[-out, -inner], [inner, out]] : [[-out, out]]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(u1 - u0, fine * 1.1, 0.008), tool.globMat);
        const m = (u0 + u1) / 2;
        strip.position.set(Math.cos(turn) * m - Math.sin(turn) * d, Math.sin(turn) * m + Math.cos(turn) * d, turn > 0 ? 0.004 : -0.004);
        strip.rotation.z = turn;
        lines.push(strip);
      }
    }
    this.membrane = new THREE.Group();
    this.membrane.add(...lines);
    this.rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022, 6, 64), edge);
    this.shimmer = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 4, 48), edge);
    // the parry's flash: two white rings bursting out past the rim (the block's flare swells the lines)
    this.flashDisc = new THREE.Group();
    this.flashDisc.add(new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 48), edge), new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.02, 6, 48), edge));
    this.field.add(this.membrane, this.rim, this.shimmer, this.flashDisc);
    // the cracks: a zigzag of ink lines across the fluid from near the hub
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
    this.field.add(this.cracks);
    this.face.add(this.collar, this.field);
    this.root.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; o.frustumCulled = false; });
    this.root.visible = false;
    this.mount = null;
    this.centre = new THREE.Vector3(); this.normal = new THREE.Vector3(0, 0, 1);
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

  /**
   * Per frame, after the pose (src/fluid-blade.js update): want (the guard held), worn (shown at
   * all), dir (flat, the guard's way), up. Returns what the state machine said ('open' | 'close' | null).
   */
  update(dt, { want = false, worn = true, dir = null, up = null, time = 0 } = {}) {
    const S = this.s, said = S.update(dt, want && worn);
    const on = worn && this.attach() && this.tool.player?.object?.visible !== false;
    this.root.visible = on;
    if (!on) return said;
    fitScale(this.root);
    const k = S.k, R = SHIELD.radius;
    this.face.visible = k > 0.002;
    if (this.face.visible) {
      // swivel on the hub toward the guard's way, as much as it is open (folded it lies on the hand)
      this.root.updateWorldMatrix(true, false);
      this.root.matrixWorld.decompose(_a, _q, _b);
      if (dir && up) {
        const z = _a.copy(dir).normalize(), x = _b.crossVectors(up, z).normalize(), y = new THREE.Vector3().crossVectors(z, x);
        _q2.setFromRotationMatrix(_m.makeBasis(x, y, z));
        const turn = smooth(k, 0, 0.7);
        this.face.quaternion.copy(_q).invert().multiply(_q.clone().slerp(_q2, turn));
      } else this.face.quaternion.identity();
      this.face.position.set(0, 0, SHIELD.stand * smooth(k, 0, 0.5));
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
      // the fluid: its lines flood out from the hub, the rim closes round them; held, a shimmer runs out to the rim
      const f = S.fill, pulse = 1 + 0.015 * Math.sin(time * 9) + 0.18 * S.flare;
      const shown = S.shown(time);
      this.field.visible = f > 0.01;
      this.field.scale.setScalar(Math.max(0.01, R * f * pulse));
      this.membrane.visible = shown;
      this.membrane.rotation.z = time * 0.5;   // (the hatching turns slowly, the fluid's tones running along its lines)
      this.rim.visible = f > 0.5 && shown;
      this.rim.scale.setScalar(0.9 + 0.1 * smooth(f, 0.5, 1));
      const run = (time * 0.9) % 1;
      this.shimmer.visible = f > 0.95 && shown && S.crack === 0;
      this.shimmer.scale.setScalar(0.25 + 0.72 * run);
      this.flashDisc.visible = S.flash > 0.02;
      this.flashDisc.scale.setScalar(1.02 + 0.45 * (1 - S.flash));
      this.cracks.visible = S.crack > 0.02 && f > 0.3;
    }
    // where it is, for the guard's arc (src/fluid-blade.js block) and the block's splash
    this.face.updateWorldMatrix(true, false);
    this.centre.setFromMatrixPosition(this.face.matrixWorld);
    this.normal.copy(_Z).transformDirection(this.face.matrixWorld);
    return said;
  }

  /** The guard's arc round `chest` from the shield as drawn now, or null (not drawn, or not open enough to tell). */
  arc(chest, up) {
    if (!this.root.visible || !this.root.parent || this.s.k < 0.3) return null;
    return shieldArc(chest, this.centre, this.normal, SHIELD.radius, up);
  }

  dispose() { this.root.removeFromParent(); }
}
