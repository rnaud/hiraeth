import * as THREE from 'three';
import { inkMat, INK, PAPER, aimRay } from './kit.js';
import { rayWorld } from '../fluid-tool.js';
import { registerTarget, targetsInCone } from '../targets.js';
import { registerHazard, flameHazard, HAZARD_DPS } from '../hazards.js';
import { Flames } from '../story/flames.js';
import { thinTube, thinRing } from '../thin.js';
import { kick } from '../feel.js';

// The gust fan (docs/systems/gadgets.md, "The gust fan"): a folding paper fan of the makers. Press the use
// button to swing it (held, it swings again and again): a cone of wind leaves it along the aim, drawn as the
// game draws its wind (the sand's wisps, src/wind.js, and the halls' pale gust streaks, src/temples/pieces.js
// Gust) with a few ink curls. It shoves what it meets: crates slide, foes are knocked back (a blot swarm is
// blown apart), bombs roll, bubbles drift, the sand and the water are thrown up, a skiff's sail fills, a
// pinwheel spins, and what burns (an ember's fire, a lamp lit by one) goes out. In the air with the wings open
// a swing down at the ground lifts you a little (a hover hop, FAN.hover.gusts of them before you land again).

export const FAN = {
  range: 9,            // m the gust reaches
  angle: 0.5,          // rad: the cone's half-angle
  cool: 0.42,          // s between swings (held: it swings again at this pace)
  swing: 0.3,          // s the fan is out in the hand
  push: { prop: 10, foe: 3.6, bomb: 9, lift: 0.22 },   // m/s at full strength (a metal crate: a quarter); foe: the push's shove (m)
  stun: 0.45,          // s a foe reels at full strength
  recoil: 1.6,         // m/s back on the ground
  hover: { glide: 7.5, air: 4.2, gusts: 3 },          // m/s up with the wings open / without; gusts before you land
  sail: 9, sailMax: 30,  // m/s a skiff's sail takes from a gust (a ridden one: its own rider's), and its top
  spin: 6,             // s a pinwheel turns after a full gust in its face
  embers: 12,          // s a fire blown out in the Gadget Yard takes to catch again
  flatten: 0.7,        // how much of the aim's tilt is taken out on foot (the gust goes along the ground)
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Vector3(), _r = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);

/** How hard the gust is felt d metres out: strong near, a third of it at its reach, nothing past. Pure. */
export function gustStrength(d, range = FAN.range) {
  if (!(range > 0) || d > range) return 0;
  return 1 - 0.68 * Math.max(0, d) / range;
}

/**
 * The gust's way from the aim: on foot mostly along the ground (FAN.flatten of the tilt taken out), from the
 * wings straight down at the ground with a little of the aim forward (the hover). Pure (unit vector).
 */
export function gustDirection(aim, up, { air = false, out = new THREE.Vector3() } = {}) {
  if (air) {
    const fwd = _w.copy(aim).addScaledVector(up, -aim.dot(up));
    if (fwd.lengthSq() > 1e-6) fwd.normalize();
    return out.copy(up).multiplyScalar(-1).addScaledVector(fwd, 0.25).normalize();
  }
  out.copy(aim).addScaledVector(up, -aim.dot(up) * FAN.flatten);
  if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
  return out.normalize();
}

/** The traveller's speed up after a gust at the ground from the air: at least the hover's (wings open: more). Pure. */
export const hoverLift = (vu, gliding) => Math.max(vu, gliding ? FAN.hover.glide : FAN.hover.air);

/** What a gust does to a skiff's speed: along its keel, by how squarely it fills the sail. Pure ([fx, fz] its forward). */
export function sailPush([fx, fz], dir, k = 1) {
  const along = fx * dir.x + fz * dir.z, across = fz * dir.x - fx * dir.z;
  return { speed: FAN.sail * k * along, yaw: 1.2 * k * across };
}

/** How much of a gust a pinwheel facing `normal` catches (the wind into its face): 0..1. Pure. */
export const pinwheelCatch = (dir, normal) => THREE.MathUtils.clamp(-dir.dot(normal) * 1.25, 0, 1);

// ------------------------------------------------------------------ sounds
const now = (s) => (s?.ctx ? s.ctx.currentTime : null);
export const fanSfx = {
  /** the swing: the paper's snap open and a rush of air going away */
  swing(s, k = 1) {
    const t = now(s); if (t == null) return;
    s.burst(t, { dur: 0.03, type: 'bandpass', freq: 2600, q: 3, vol: 0.07 });
    s.burst(t + 0.045, { dur: 0.025, type: 'bandpass', freq: 2200, q: 3, vol: 0.05 });
    s.burst(t + 0.02, { dur: 0.38, type: 'bandpass', freq: 850, q: 0.55, vol: 0.22 * k, rate: 0.75 });
    s.burst(t + 0.05, { dur: 0.3, type: 'highpass', freq: 2400, q: 0.4, vol: 0.06 * k, rate: 1.3 });
    s.sweep(t, 210, 80, 0.28, 0.06 * k);
  },
  /** a pinwheel whirring up */
  whirr(s) { const t = now(s); if (t == null) return; for (let i = 0; i < 7; i++) s.burst(t + i * 0.05, { dur: 0.02, type: 'bandpass', freq: 1400 + i * 120, q: 5, vol: 0.035 }); s.sweep(t, 400, 900, 0.4, 0.025, 'triangle'); },
  /** a fire blown out: a hiss and a puff */
  douse(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.55, type: 'highpass', freq: 1800, q: 0.4, vol: 0.09, rate: 0.9 }); s.burst(t, { dur: 0.25, type: 'lowpass', freq: 500, q: 0.6, vol: 0.12, rate: 0.6 }); },
};

// ------------------------------------------------------------------ the fan's model
/** A half-open folding fan: pleats in cream and teal on dark ribs, a brass rivet, a red tassel. ~0.3 m. */
function fanModel({ open = 1 } = {}) {
  const g = new THREE.Group();
  const leaf = new THREE.Group(); g.add(leaf); g.userData.leaf = leaf;
  const pleats = 9, spread = Math.PI * (0.35 + 0.55 * open), R = 0.27, r0 = 0.07;
  const mats = [inkMat(PAPER, { side: THREE.DoubleSide }), inkMat('#4fa3a5', { side: THREE.DoubleSide }), inkMat('#e9d3a6', { side: THREE.DoubleSide })];
  const rib = inkMat('#3a2c26'), brass = inkMat('#d6a94a', { metal: 'brass' });
  for (let i = 0; i < pleats; i++) {
    const a0 = -spread / 2 + (i / pleats) * spread, a1 = a0 + spread / pleats;
    const s = new THREE.Shape();
    s.moveTo(Math.sin(a0) * r0, Math.cos(a0) * r0);
    s.lineTo(Math.sin(a0) * R, Math.cos(a0) * R);
    s.lineTo(Math.sin(a1) * R, Math.cos(a1) * R);
    s.lineTo(Math.sin(a1) * r0, Math.cos(a1) * r0);
    const geo = new THREE.ShapeGeometry(s);
    const m = new THREE.Mesh(geo, mats[i % 2 === 0 ? 0 : (i % 4 === 1 ? 1 : 2)]);
    m.position.z = (i % 2) * 0.006;   // (the folds: every other pleat a little proud)
    leaf.add(m);
  }
  for (let i = 0; i <= pleats; i++) {
    const a = -spread / 2 + (i / pleats) * spread;
    const ribM = new THREE.Mesh(new THREE.BoxGeometry(0.008, R + 0.01, 0.006).translate(0, (R + 0.01) / 2, 0.008), rib);
    ribM.rotation.z = -a;
    leaf.add(ribM);
  }
  // the guard sticks, thicker, and the rivet they turn on
  for (const a of [-spread / 2, spread / 2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.016, R + 0.03, 0.012).translate(0, (R + 0.03) / 2 - 0.02, 0.012), rib); m.rotation.z = -a; leaf.add(m); }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 10).rotateX(Math.PI / 2).translate(0, 0, 0.01), brass));
  // a red tassel on a cord
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 4).translate(0, -0.03, 0.01), inkMat('#c8483a')));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 6).rotateX(Math.PI).translate(0, -0.07, 0.01), inkMat('#c8483a')));
  // the makers' mark on the leaf: an ink swirl of wind
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 4, 14, Math.PI * 1.5).translate(0.02, 0.19, 0.012), inkMat(INK));
  leaf.add(curl);
  g.rotation.set(-0.25, 0.4, 0.15);
  return g;
}

/** A pinwheel's head: four paper blades curled round a brass pin (it turns about its local z). Radius ~0.55. */
function pinwheelHead(colors = ['#c8483a', PAPER, '#4fa3a5', '#f2c54b']) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.56, 0.02); s.quadraticCurveTo(0.44, 0.3, 0.06, 0.5); s.lineTo(0, 0);
    const geo = new THREE.ShapeGeometry(s, 6);
    // (each blade's tip bent back a little: a curl, not a flat cross)
    const P = geo.attributes.position;
    for (let k = 0; k < P.count; k++) { const x = P.getX(k), y = P.getY(k); P.setZ(k, -0.18 * Math.max(0, x + y - 0.3)); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, inkMat(colors[i], { side: THREE.DoubleSide }));
    m.rotation.z = (i / 4) * Math.PI * 2;
    g.add(m);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), inkMat('#d6a94a', { metal: 'brass' })));
  return g;
}

/** A curl of wind, Moebius-fashion: a stroke that runs straight and rolls up at its end. Along +z, ~1 m. */
function curlCurve() {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    if (u < 0.55) pts.push(new THREE.Vector3(0, 0, u * 1.6));
    else { const a = (u - 0.55) / 0.45 * Math.PI * 1.7, r = 0.22 * (1 - (u - 0.55) * 0.9); pts.push(new THREE.Vector3(0, r - Math.cos(a) * r, 0.88 + Math.sin(a) * r)); }
  }
  return new THREE.CatmullRomCurve3(pts);
}

export default {
  id: 'fan', name: 'Gust fan', glyph: '◗', order: 100, trigger: 'use',
  text: 'A folding fan of the makers’ paper on black ribs, a swirl of wind inked on its leaf. One flick of it moves more air than a storm’s first breath.',
  use: 'Press RT / R2 (T, or the middle mouse button) to swing it; hold to keep swinging. The gust pushes crates and bombs, knocks foes back (a swarm of blots is blown apart), sends bubbles drifting, throws up sand and spray, spins pinwheels, fills a skiff’s sail and blows out fires. In the air with the wings open, swing it at the ground to lift yourself a little, three times before you land.',
  model: () => fanModel(),
  create(ctx) { return new Fan(ctx); },

  /** Its bay in the Gadget Yard: three pinwheels facing three ways that together open a gate; a fire in a
   *  hut's doorway to blow out (a crate inside to blow back out); crates to blow about; a high ledge. */
  yard(kit) {
    kit.flag('#4fa3a5');
    const spec = kit.spec;
    spec.pinwheels ??= []; spec.embers ??= []; spec.windGates ??= [];
    // the alcove the pinwheels open
    kit.block([0.8, 3.4, 5], [-2.6, 1.7, -8.6]); kit.block([0.8, 3.4, 5], [1.4, 1.7, -8.6]);
    kit.block([4.8, 0.6, 5.4], [-0.6, 3.6, -8.6]); kit.block([4.8, 3.4, 0.8], [-0.6, 1.7, -11.2]);
    kit.lamp([-0.6, 0, -9.4]);
    const gate = kit.gate([3.1, 3.2, 0.25], [-0.6, 1.6, -6.2]);
    const gspec = spec.gates[spec.gates.length - 1];
    gspec.plates = null; gspec.want = 0;   // (opened by the wind, not by a plate: the fan's runtime sets want)
    // three pinwheels on posts, each facing its own way: one gust can't fill them all
    const wheels = [];
    for (const [at, n] of [[[-5.6, 0, -5.2], [1, 0, 0.45]], [[3.9, 0, -4.4], [-1, 0, 0.55]], [[-0.6, 0, -1.6], [0, 0, 1]]]) {
      const post = new THREE.Group(); post.position.set(...at);
      post.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.95, 8).translate(0, 0.975, 0), kit.mats.woodDark));
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.45, 0), kit.mats.lampOff);
      post.add(lamp);
      const head = new THREE.Group(); head.position.y = 1.95;
      const nl = new THREE.Vector3(...n).normalize();
      head.quaternion.setFromUnitVectors(_Z, nl);
      const blades = pinwheelHead(); head.add(blades);
      head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6).rotateX(Math.PI / 2).translate(0, 0, -0.08), kit.mats.ink));
      post.add(head);
      post.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
      kit.add(post);
      wheels.push(spec.pinwheels.length);
      spec.pinwheels.push({ head: kit.at([at[0], 1.95, at[2]]), normal: kit.dir(n), blades, lamp, on: kit.mats.lampOn, off: kit.mats.lampOff });
    }
    spec.windGates.push({ object: gate, wheels });
    // a hut with a fire burning in its doorway, a crate inside
    kit.block([0.6, 2.6, 3.2], [4.3, 1.3, -9.2]); kit.block([0.6, 2.6, 3.2], [6.9, 1.3, -9.2]);
    kit.block([3.2, 2.6, 0.6], [5.6, 1.3, -10.8]); kit.block([3.4, 0.4, 3.8], [5.6, 2.8, -9.1]);
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.22, 12).translate(0, 0.11, 0), kit.mats.ink);
    coals.position.set(5.6, 0, -7.75); coals.userData.noCollide = true; kit.add(coals);
    spec.embers.push({ at: kit.at([5.6, 0.18, -7.75]), r: 0.85, h: 2, regrow: FAN.embers, name: 'the hut’s fire' });
    kit.crate([5.6, 0.45, -9.6]);
    // crates in the open, and a metal one (it barely moves)
    kit.crate([2.8, 0.45, 1.2]); kit.crate([4.2, 0.45, 2.4]); kit.crate([5.2, 0.5, 0.6], { metal: true });
    // a high ledge to hover up to (jump, open the wings, swing at the ground)
    kit.block([3, 4.2, 3], [-5.4, 2.1, 0.6], { mat: 'pale' });
  },
};

// ------------------------------------------------------------------ the gust's look

/**
 * A gust, drawn: pale streaks racing out along the cone (the halls' gust streaks, src/temples/pieces.js), ink
 * curls rolling up at their ends, and the sand's own wind wisps (src/wind.js) skimming out along the ground.
 * Nothing transparent: each stroke grows, flies and shrinks away.
 */
class GustLook {
  constructor(parent) {
    this.N = 64;
    // (in ink: lines of wind, as drawn)
    this.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5), inkMat('#ffffff', { glow: 0.2 }), this.N);
    this.streaks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.N * 3), 3);
    this.streaks.frustumCulled = false; this.streaks.count = 0; this.streaks.userData.noCollide = true;
    parent.add(this.streaks);
    this._c = new THREE.Color();
    // the wind's fronts: open rings of ink racing out across the cone, wider as they go
    const arc = Math.PI * 1.25;
    this.frontGeo = thinRing(new THREE.TorusGeometry(1, 0.02, 3, 28, arc), 1, 28, 3, arc).rotateZ(Math.PI / 2 - arc / 2);
    this.frontMat = inkMat(INK, { thin: 1.8 });
    this.fronts = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(this.frontGeo, this.frontMat); m.visible = false; m.frustumCulled = false; m.userData.noCollide = true; parent.add(m); return m; });
    this.frontList = [];
    const curve = curlCurve();
    const geo = thinTube(new THREE.TubeGeometry(curve, 24, 0.022, 3, false), curve, 24, 3);
    this.curlMat = inkMat(INK, { thin: 1.5 });
    this.curls = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(geo, this.curlMat); m.visible = false; m.frustumCulled = false; m.userData.noCollide = true; parent.add(m); return m; });
    this.list = []; this.curlList = [];
    this._m = new THREE.Matrix4(); this._qq = new THREE.Quaternion(); this._s = new THREE.Vector3();
  }

  /** A gust from `from` along unit `dir`, cone half-angle `angle`, reaching `range` (k: how big). */
  add(from, dir, up, { range = FAN.range, angle = FAN.angle, k = 1 } = {}) {
    const side = _u.crossVectors(dir, Math.abs(dir.dot(up)) > 0.95 ? _Z : up).normalize(), lift = _r.crossVectors(side, dir).normalize();
    for (let i = 0; i < 26 * k; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.sqrt(Math.random()) * Math.tan(angle) * 0.92;
      const d = dir.clone().addScaledVector(side, Math.cos(a) * s).addScaledVector(lift, Math.sin(a) * s).normalize();
      if (this.list.length >= this.N) this.list.shift();
      this.list.push({ from: from.clone().addScaledVector(d, 0.9 + Math.random() * 0.9), dir: d, speed: 17 + Math.random() * 10, t: -Math.random() * 0.08, life: range / 22 + Math.random() * 0.12, w: 0.016 + Math.random() * 0.02, len: 1.5 + Math.random() * 2.2, wave: Math.random() * 6, color: i % 4 === 3 ? '#5a4a44' : INK });
    }
    for (let i = 0; i < 2; i++) {
      const m = this.fronts.find((x) => !x.visible); if (!m) break;
      m.visible = true;
      this.frontList.push({ m, from: from.clone(), dir: dir.clone(), up: up.clone(), t: -i * 0.08, life: 0.36, reach: range * (0.8 - i * 0.15), spin: (Math.random() - 0.5) * 0.8, tan: Math.tan(angle) });
    }
    for (let i = 0; i < 4; i++) {
      const c = this.curls.find((m) => !m.visible); if (!c) break;
      const a = (i / 4) * Math.PI * 2 + Math.random(), s = Math.tan(angle) * (0.35 + Math.random() * 0.4);
      const d = dir.clone().addScaledVector(side, Math.cos(a) * s).addScaledVector(lift, Math.sin(a) * s).normalize();
      c.visible = true;
      this.curlList.push({ m: c, from: from.clone(), dir: d, roll: a + Math.PI / 2, t: -i * 0.03, life: 0.42 + Math.random() * 0.12, speed: 14 + Math.random() * 5, size: 1.3 + Math.random() * 0.8 });
    }
  }

  update(dt) {
    if (!this.list.length && !this.streaks.count && !this.curlList.length && !this.frontList.length) return;
    this.list = this.list.filter((s) => (s.t += dt) < s.life);
    let n = 0;
    for (const s of this.list) {
      if (s.t < 0) continue;
      const k = s.t / s.life;
      const at = _v.copy(s.from).addScaledVector(s.dir, s.speed * s.t * (1 - 0.35 * k));
      const L = s.len * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 0.05, w = s.w * (1 - 0.5 * k);
      this._qq.setFromUnitVectors(_Z, s.dir);
      this._m.compose(at, this._qq, this._s.set(w, w, L));
      this.streaks.setColorAt(n, this._c.set(s.color));
      this.streaks.setMatrixAt(n++, this._m);
    }
    this.streaks.count = n;
    this.streaks.instanceMatrix.needsUpdate = true;
    if (this.streaks.instanceColor) this.streaks.instanceColor.needsUpdate = true;
    for (let i = this.frontList.length - 1; i >= 0; i--) {
      const f = this.frontList[i];
      f.t += dt;
      if (f.t >= f.life) { f.m.visible = false; this.frontList.splice(i, 1); continue; }
      if (f.t < 0) { f.m.scale.setScalar(0.001); continue; }
      const k = f.t / f.life, e = 1 - (1 - k) * (1 - k), d = 0.5 + f.reach * e;
      f.m.position.copy(f.from).addScaledVector(f.dir, d);
      // across the gust, its open side down (toward the ground)
      f.m.quaternion.setFromUnitVectors(_Z, f.dir);
      const upL = _u.copy(f.up).applyQuaternion(this._qq.copy(f.m.quaternion).invert());
      f.m.rotateZ(Math.atan2(upL.x, upL.y) * -1 + f.spin);
      const r = Math.max(0.15, d * f.tan * 0.8) * (1 - 0.25 * k);
      f.m.scale.set(r, r, r);
    }
    for (let i = this.curlList.length - 1; i >= 0; i--) {
      const c = this.curlList[i];
      c.t += dt;
      if (c.t >= c.life) { c.m.visible = false; this.curlList.splice(i, 1); continue; }
      if (c.t < 0) { c.m.scale.setScalar(0.001); continue; }
      const k = c.t / c.life;
      c.m.position.copy(c.from).addScaledVector(c.dir, 0.6 + c.speed * c.t * (1 - 0.4 * k));
      c.m.quaternion.setFromUnitVectors(_Z, c.dir);
      c.m.rotateZ(c.roll + k * 1.2);
      const s = c.size * Math.sin(Math.PI * Math.min(1, k * 1.1)) * (0.6 + k);
      c.m.scale.set(s, s, s * (1 + k));
    }
  }
  dispose() { this.streaks.removeFromParent(); this.curls.forEach((c) => c.removeFromParent()); this.fronts.forEach((c) => c.removeFromParent()); }
}

// ------------------------------------------------------------------ the gadget

class Fan {
  constructor(ctx) {
    this.ctx = ctx;
    this.cool = 0; this.out = 0; this.holding = false; this.hovers = FAN.hover.gusts;
    this.aiming = false;   // (no over-the-shoulder aim: the gust goes where the camera looks)
    this.look = new GustLook(ctx.fx);
    this.held = fanModel(); this.held.scale.setScalar(1.5); this.held.visible = false;
    this.held.traverse((o) => { o.userData.noCollide = true; });
    ctx.fx.add(this.held);
    this.ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.dir = new THREE.Vector3(0, 0, -1);
    this.offs = [];
    this.time = 0;
    // the world's wind things (the Gadget Yard's, or any level's gadgetYard): pinwheels, fires, the gates they open
    const spec = ctx.level?.gadgetYard ?? ctx.level?.gadgetWorld ?? null;
    this.wheels = (spec?.pinwheels ?? []).map((p) => this.addPinwheel(p));
    this.embers = (spec?.embers ?? []).map((e) => this.addEmber(e));
    this.windGates = spec?.windGates ?? [];
  }

  get up() { return this.ctx.player?.frame?.up ?? _Y; }

  canUse() {
    const P = this.ctx.player;
    if (!P || P.down || P.dead || P.climbing || P.mantle || P.swim?.under) return false;
    return !P.ride || P.ride?.kind === 'skiff';   // (on a skiff: a gust into its own sail)
  }
  hand(out = new THREE.Vector3()) {
    const { tool, player: P } = this.ctx;
    if (tool?.muzzle && P?.object?.visible !== false) return tool.muzzle(out);
    return out.copy(P.pos).addScaledVector(P.frame?.up ?? _Y, 1.35);
  }

  equip() { this.ctx.sfx?.equip?.(this.ctx.sound); }
  unequip() { this.holding = false; }
  cancel() { this.holding = false; }

  press() { this.holding = true; if (this.cool <= 0) this.swing(); }
  hold() { if (this.holding && this.cool <= 0) this.swing(); }
  release() { this.holding = false; }

  /** One swing: the gust leaves the fan along the aim (from the wings in the air: down at the ground). */
  swing() {
    if (!this.canUse()) return null;
    const { camera, player: P } = this.ctx, up = this.up;
    const riding = P.ride?.kind === 'skiff' ? P.ride : null;
    const air = !riding && !P.onGround && !P.climbing;
    if (camera) aimRay(camera, P, this.ray); else P.frame?.dir?.(P.heading, this.ray.dir.set(0, 0, 1));
    if (riding) { const [fx, fz] = riding.forward; this.ray.dir.set(fx, 0.08, fz).normalize(); }
    const lifting = air && this.hovers > 0;
    gustDirection(this.ray.dir, up, { air: lifting, out: this.dir });
    const from = lifting ? P.pos.clone().addScaledVector(up, 0.9) : this.hand(new THREE.Vector3());
    const res = this.gust(from, this.dir);
    // in the air: the gust at the ground lifts you (wings open: more)
    if (lifting) {
      this.hovers--;
      const vu = P.vel.dot(up), want = hoverLift(vu, !!P.gliding);
      P.vel.addScaledVector(up, want - vu);
      P.onGround = false;
      res.lift = want;
    } else if (P.onGround && !riding) P.vel.addScaledVector(_v.copy(this.dir).addScaledVector(up, -this.dir.dot(up)), -FAN.recoil);
    // he turns to swing it the way it blows
    if (!riding && !lifting && P.frame?.headingOf) { const f = _v.copy(this.dir).addScaledVector(up, -this.dir.dot(up)); if (f.lengthSq() > 0.04) P.heading = P.frame.headingOf(f); }
    if (riding) {
      riding.speed = Math.min(FAN.sailMax, Math.max(riding.speed, 0) + FAN.sail);   // (the rider blows squarely into his own sail)
      res.sail = true;
    }
    this.cool = FAN.cool; this.out = FAN.swing; this.swingSide = (this.swingSide ?? 1) * -1;
    fanSfx.swing(this.ctx.sound, 1);
    kick(0.16);
    this.ctx.game?.emit?.('gadget:gust', { at: from.clone(), dir: this.dir.clone(), ...res });
    return res;
  }

  /**
   * A gust from `from` along unit `dir`: everything in the cone is pushed (also the tests' way in). Returns
   * { foes, things, doused, spun } counts.
   */
  gust(from, dir, { range = FAN.range, angle = FAN.angle } = {}) {
    const { physics, player: P } = this.ctx, up = this.up;
    from = from.clone(); dir = dir.clone();   // (the scratch vectors below are reused)
    const out = { foes: 0, things: 0, doused: 0, spun: 0, bombs: 0 };
    for (const r of targetsInCone(from, dir, range, angle, physics)) {
      const T = r.target, k = gustStrength(r.distance, range);
      if (k <= 0) continue;
      const along = _v.copy(r.dir).lerp(dir, 0.5).normalize();
      const flat = _w.copy(along).addScaledVector(up, -along.dot(up));
      if (flat.lengthSq() > 1e-6) flat.normalize(); else flat.copy(dir);
      const info = { strength: k, shove: FAN.push.foe * k, source: 'gust', mode: 'gust' };
      if (T.kind === 'foe') {
        const f = T.foe;
        T.onHit?.('push', r.point, flat, info);
        if (f?.alive) { f.stunned = Math.max(f.stunned ?? 0, FAN.stun * k); if (f.def?.hover) f.vel?.multiplyScalar(1.6); }
        out.foes++;
      } else if (T.kind === 'prop') {
        T.prop.impulse(_u.copy(flat).multiplyScalar(FAN.push.prop * k).addScaledVector(up, FAN.push.prop * FAN.push.lift * k));
        out.things++;
      } else if (T.kind === 'mount') {
        const m = P?.mount;
        if (m && 'speed' in m && m !== P.ride) {
          const s = sailPush(m.forward, flat, k * (m.kind === 'skiff' ? 1.4 : 0.4));   // (its sail catches it; a bike only a little)
          m.speed += s.speed; m.yawRate = (m.yawRate ?? 0) + s.yaw;
          out.things++;
        }
      } else if (T.accepts?.includes('gust')) {
        const r2 = T.onHit?.('gust', r.point, along, info);
        if (r2) { if (T.kind === 'flammable' || T.kind === 'ember') out.doused++; else if (T.kind === 'pinwheel') out.spun++; else out.things++; }
      } else if (T.onHit?.('push', r.point, flat, info)) out.things++;
    }
    // bombs on the ground (the bomb gadget's): rolled along
    for (const b of this.ctx.gadget?.('bomb')?.live ?? []) {
      if (b.held) continue;
      const to = _v.subVectors(b.pos, from), d = to.length();
      if (d > range || d < 1e-3 || to.divideScalar(d).dot(dir) < Math.cos(angle)) continue;
      const k = gustStrength(d, range);
      b.vel.addScaledVector(_w.copy(dir).addScaledVector(up, -dir.dot(up)).normalize(), FAN.push.bomb * k).addScaledVector(up, 2 * k);
      out.bombs++;
    }
    this.kickUp(from, dir, range);
    this.look.add(from, dir, up, { range, angle });
    return out;
  }

  /** What the gust throws up where it passes over the ground: sand and dust, or spray off water; the wind's own wisps. */
  kickUp(from, dir, range) {
    const { physics, tool, wind, player: P } = this.ctx, up = this.up;
    const water = P?.water ?? null;
    let wisps = 0;
    for (const d of [1.5, 3.5, 5.5, 7.5]) {
      if (d > range) break;
      const at = _v.copy(from).addScaledVector(dir, d);
      const g = rayWorld(physics, _w.copy(at).addScaledVector(up, 0.3), _u.copy(up).negate(), 3.2);
      const surf = water?.surfaceAt?.(at.x, at.z, at.y);
      const wet = surf && Number.isFinite(surf.y) && surf.y <= at.y + 0.2 && at.y - surf.y < 3.2 && (!g || surf.y >= g.point.y - 0.05);
      const flat = _q.copy(dir).addScaledVector(up, -dir.dot(up)); if (flat.lengthSq() < 1e-4) flat.randomDirection().addScaledVector(up, -flat.dot(up)); flat.normalize();
      const k = 1 - d / (range + 2);
      if (wet) {
        const p = _r.set(at.x, surf.y + 0.05, at.z);
        water.splash?.(p, surf.y, 0.35 + 0.5 * k, { sound: d < 2 });
        for (let i = 0; i < 9; i++) tool?.drops?.add?.({ pos: p, vel: _u.copy(flat).multiplyScalar(4 + Math.random() * 6).addScaledVector(up, 2 + Math.random() * 3.5).add(_w.randomDirection().multiplyScalar(1.2)), drag: 1.8, grav: 10, size: 0.035 + Math.random() * 0.035, stretch: 2.2, life: 0.5 + Math.random() * 0.3, color: i % 3 ? '#ffffff' : '#bfe4e6' });
      } else if (g) {
        const p = g.point;
        for (let i = 0; i < 7; i++) tool?.drops?.add?.({ pos: p, vel: _u.copy(flat).multiplyScalar(3 + Math.random() * 6).addScaledVector(up, 0.6 + Math.random() * 2).add(_w.randomDirection().multiplyScalar(0.8)), drag: 2.4, grav: 6, size: 0.03 + Math.random() * 0.04, stretch: 1.6, life: 0.45 + Math.random() * 0.35, color: i % 2 ? '#e2d2ae' : '#cdb88e' });
        // the sand's wind: wisps skimming out along the ground from here (src/wind.js)
        if (wind?.spawn && wind.wisps) for (let i = 0; i < 3; i++) {
          const w = wind.wisps.find((q) => q.age >= q.life); if (!w) break;
          const sp = 13 + Math.random() * 8, sx = (Math.random() - 0.5) * 1.6;
          wind.spawn(w, p.x - flat.z * sx, p.z + flat.x * sx, flat.x * sp, flat.z * sp, { life: 0.5 + Math.random() * 0.4, len: 1.5 + Math.random() * 2.5, h: 0.06 + Math.random() * 0.5, strength: 0.85, thick: 1.4 });
          wisps++;
        }
      }
    }
    // and a few at the fan's own height, out along the gust (the strokes that read from behind)
    if (wind?.spawn && wind.wisps) {
      const flat = _q.copy(dir).addScaledVector(up, -dir.dot(up));
      if (flat.lengthSq() > 0.09) {
        flat.normalize();
        for (let i = 0; i < 6; i++) {
          const w = wind.wisps.find((q) => q.age >= q.life); if (!w) break;
          const sp = 16 + Math.random() * 8, sx = (Math.random() - 0.5) * 2.2;
          wind.spawn(w, from.x + flat.x * 1.5 - flat.z * sx, from.z + flat.z * 1.5 + flat.x * sx, flat.x * sp, flat.z * sp, { life: 0.45 + Math.random() * 0.3, len: 2 + Math.random() * 2.5, strength: 0.9, thick: 1.5 });
          w.y0 = from.y - 0.4 + (Math.random() - 0.5) * 0.9; w.h = 0;
          wisps++;
        }
      }
    }
    return wisps;
  }

  // ---------------------------------------------------------------- pinwheels
  addPinwheel(p) {
    const w = { ...p, spin: 0, angle: 0, lit: false };
    w.off = registerTarget({ kind: 'pinwheel', pinwheel: w, radius: 0.65, accepts: ['gust'], position: () => w.head,
      onHit: (mode, point, dir, info) => {
        if (mode !== 'gust') { if (mode === 'shoot') this.ctx.notice?.('The paper only gets wet. A pinwheel wants wind.', 'pinwheel.wet'); return false; }
        const c = pinwheelCatch(dir, w.normal) * (info?.strength ?? 1);
        if (c < 0.15) { this.ctx.notice?.('The wind slips past its edge: blow into its face.', 'pinwheel.edge'); w.spin = Math.max(w.spin, 0.08); return false; }
        if (w.spin < 0.2) fanSfx.whirr(this.ctx.sound);
        w.spin = Math.min(1, Math.max(w.spin, 0.45 + 0.55 * c));
        return true;
      } });
    this.offs.push(w.off);
    return w;
  }

  updateWheels(dt) {
    for (const w of this.wheels) {
      w.spin = Math.max(0, w.spin - dt / FAN.spin);
      w.angle += dt * 22 * w.spin * w.spin + dt * 0.15;
      if (w.blades) w.blades.rotation.z = -w.angle;
      const lit = w.spin > 0.12;
      if (lit !== w.lit) { w.lit = lit; if (w.lamp) w.lamp.material = lit ? w.on : w.off; }
    }
    // a wind gate: open while all its pinwheels turn at once (and it stays open a while after)
    const gates = this.ctx.world?.gates ?? [];
    for (const g of this.windGates) {
      const all = g.wheels.every((i) => this.wheels[i]?.lit);
      const wg = (g._w ??= gates.find((x) => x.object === g.object));
      if (all && !g.open) { g.open = true; g.hold = 20; this.ctx.sound?.chime?.(); this.ctx.notice?.('All three pinwheels turn together: the gate sinks.', 'pinwheel.gate'); }
      if (g.open && !all) { g.hold -= dt; if (g.hold <= 0) g.open = false; }
      if (wg) wg.want = g.open ? 1 : 0;
    }
  }

  // ---------------------------------------------------------------- fires (an ember's, in the yard)
  addEmber(e) {
    const x = { ...e, lit: true, t: 0, at: e.at.clone() };
    x.group = new THREE.Group(); x.group.position.copy(x.at); x.group.userData.noCollide = true;
    this.ctx.fx.add(x.group);
    x.flames = new Flames(x.group, [{ at: new THREE.Vector3(0, 0, 0), h: e.h, r: e.r * 0.62 }, { at: new THREE.Vector3(0.3, 0, 0.1), h: e.h * 0.7, r: e.r * 0.4, phase: 2 }, { at: new THREE.Vector3(-0.28, 0, -0.12), h: e.h * 0.8, r: e.r * 0.45, phase: 4 }], { seed: 5 });
    x.k = 1;
    const hz = flameHazard({ x: x.at.x, z: x.at.z, y0: x.at.y, y1: x.at.y + e.h + 0.4, rMax: e.r, dps: HAZARD_DPS.embers });
    x.offHz = registerHazard({ ...hz, test: (p) => x.lit && x.k > 0.5 && hz.test(p) });   // (it burns only while it burns)
    x.center = x.at.clone().addScaledVector(_Y, e.h * 0.4);
    x.offT = registerTarget({ kind: 'ember', ember: x, radius: e.r, accepts: ['gust', 'fire'], position: () => x.center, burning: () => x.lit,
      onHit: (mode) => {
        if (mode === 'fire') { if (!x.lit) { x.lit = true; x.t = 0; this.ctx.sound?.whoosh?.(); } return true; }
        if (mode !== 'gust' || !x.lit) return false;
        this.douse(x);
        return true;
      } });
    this.offs.push(x.offHz, x.offT);
    return x;
  }

  douse(x) {
    x.lit = false; x.t = 0;
    fanSfx.douse(this.ctx.sound);
    // a puff of smoke and a few sparks blown off
    const D = this.ctx.tool?.drops, G = this.ctx.tool?.glow;
    for (let i = 0; i < 16; i++) D?.add?.({ pos: _v.copy(x.at).addScaledVector(_Y, 0.4 + Math.random()), vel: _w.randomDirection().multiplyScalar(1.2).addScaledVector(this.dir, 3).addScaledVector(_Y, 1.5), drag: 2, grav: -0.5, size: 0.12 + Math.random() * 0.12, life: 0.7 + Math.random() * 0.5, color: i % 2 ? '#efe6d6' : '#d8cebd', grow: true });
    for (let i = 0; i < 10; i++) G?.add?.({ pos: _v.copy(x.at).addScaledVector(_Y, 0.5), vel: _w.randomDirection().multiplyScalar(2).addScaledVector(this.dir, 5), drag: 2.5, size: 0.04, life: 0.45, color: '#f6c84e' });
    this.ctx.notice?.(`The gust blows out ${x.name ?? 'the fire'}.`, 'ember.out');
  }

  updateEmbers(dt) {
    for (const x of this.embers) {
      x.t += dt;
      if (!x.lit && Number.isFinite(x.regrow) && x.t > x.regrow) { x.lit = true; x.t = 0; }
      x.k = THREE.MathUtils.damp(x.k, x.lit ? 1 : 0, x.lit ? 2.5 : 9, dt);
      x.group.visible = x.k > 0.02;
      x.group.scale.set(1, Math.max(0.02, x.k), 1);
      x.flames.intensity = x.k;
      if (x.group.visible) x.flames.update(dt, this.time);
    }
  }

  update(dt) {
    const P = this.ctx.player, up = this.up;
    this.time += dt;
    this.cool = Math.max(0, this.cool - dt);
    if (P?.onGround || P?.climbing || P?.swim) this.hovers = FAN.hover.gusts;
    // the fan in the hand while it swings: snapped open, swept across
    this.out = Math.max(0, this.out - dt);
    this.held.visible = this.out > 0 && !!P && P.object?.visible !== false;
    if (this.held.visible) {
      const k = 1 - this.out / FAN.swing;
      this.hand(this.held.position);
      const cam = this.ctx.camera;
      if (cam) this.held.quaternion.copy(cam.quaternion); else this.held.quaternion.identity();
      this.held.rotateZ((this.swingSide ?? 1) * (0.9 - 1.8 * THREE.MathUtils.smootherstep(k, 0, 0.6)));
      this.held.rotateX(-0.6);
      const leaf = this.held.userData.leaf;
      if (leaf) leaf.scale.set(0.35 + 0.65 * Math.min(1, k * 4), 1, 1);
    }
    this.look.update(dt);
    this.updateWheels(dt);
    this.updateEmbers(dt);
  }

  hud() {
    const P = this.ctx.player;
    if (P && !P.onGround && !P.climbing && !P.ride) return { count: this.hovers, max: FAN.hover.gusts };
    return { note: this.holding ? 'gusting' : '' };
  }

  dispose() {
    this.offs.forEach((f) => f?.());
    for (const x of this.embers) { x.group.removeFromParent(); x.flames.geo?.dispose?.(); }
    this.look.dispose(); this.held.removeFromParent();
  }
}
