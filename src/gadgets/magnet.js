import * as THREE from 'three';
import { inkMat, INK, PAPER, aimRay, assistPick } from './kit.js';
import { rayWorld } from '../fluid-tool.js';
import { makeMaterial } from '../materials.js';
import { thinPole } from '../thin.js';
import { hitStop, kick } from '../feel.js';
import { reelTarget, reelVelocity } from './hook.js';
import { metalSpots } from './metal.js';

// The magnet glove (docs/systems/gadgets.md, "The magnet glove"): a heavy glove with a horseshoe of the
// makers' glyph on its back. Hold the use button and it reaches for the metal under the aim within MAG.range:
// loose metal (the metal crates, a makers' machine) is lifted and held out along the aim; the camera moves it
// (up lifts it), the left stick brings it nearer or sends it further; let go to drop it. A tap throws loose
// metal away from you. Heavy metal fixed in the world (tagged where it is built: src/gadgets/metal.js, iron
// blocks in the Gadget Yard, the Sealed Hangar's brass machinery) cannot be moved: the glove pulls you to it
// instead, across a gap or up a wall. Its field is drawn as wavy ink strokes between the glove and the metal.

export const MAG = {
  range: 18,                // m from the glove
  cone: 0.08, near: 1.0,    // the aim's assist (rad round the line, or m of it)
  tap: 0.2,                 // s: let go sooner than this, a tap
  min: 2.4, max: 14,        // m a held thing keeps from the glove
  reach: 7,                 // m/s the stick brings it in or sends it out
  follow: 9,                // 1/s: how tightly it follows the aim
  maxSpeed: 18,             // m/s at most
  lost: 6,                  // m from where it should be (caught behind a wall): let go
  shove: 13,                // m/s a tap throws loose metal (a machine: `shoveFoe`)
  shoveFoe: 9,
  pull: 18, ease: 6,        // the traveller pulled to fixed metal: m/s, and the slowing over the last metres
  arrive: 0.8, maxPull: 2.6, stuck: 0.3,
  swing: 6,                 // m/s a held thing must move to knock a foe it meets
  drop: 2.5,                // m a dropped machine must fall to be hurt by it
  gravity: 24,
  cool: 0.25,
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Vector3(), _g = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);

/**
 * Where a held thing is wanted: `dist` metres out along the aim from the glove, never below `floor`
 * (the ground under it plus its own half-height). (Pure: tests/magnet.test.js.)
 */
export function holdPoint(hand, dir, dist, floor = -Infinity, out = new THREE.Vector3()) {
  out.copy(hand).addScaledVector(dir, dist);
  if (out.y < floor) out.y = floor;
  return out;
}

/** The velocity that takes a held thing at `pos` to `goal`: proportional, at most `max`. (Pure.) */
export function followVelocity(pos, goal, { follow = MAG.follow, max = MAG.maxSpeed } = {}, out = new THREE.Vector3()) {
  out.subVectors(goal, pos).multiplyScalar(follow);
  const L = out.length();
  if (L > max) out.multiplyScalar(max / L);
  return out;
}

/** The held distance after the stick (y: +1 forward sends it out, -1 back brings it in) for dt. (Pure.) */
export const reachAfter = (dist, stickY, dt, { min = MAG.min, max = MAG.max, reach = MAG.reach } = {}) => THREE.MathUtils.clamp(dist + stickY * reach * dt, min, max);

/**
 * The metal the aim picks among `cands` ({ pos(), r }): the one the aim's own hit lands on (within its
 * reach round), else the nearest the line by angle; in range from the glove. (Pure but for the vectors.)
 */
export function pickMetal(origin, dir, cands, { range = MAG.range, cone = MAG.cone, near = MAG.near, aimHit = null, hand = origin } = {}) {
  if (aimHit) {
    let best = null, bd = Infinity;
    for (const c of cands) {
      const d = aimHit.distanceTo(c.pos());
      if (d <= (c.r ?? 0.6) + 0.35 && d < bd) { best = c; bd = d; }
    }
    if (best && hand.distanceTo(best.pos()) - (best.r ?? 0) <= range) return { item: best, direct: true };
  }
  const a = assistPick(origin, dir, cands, { range: range + 4, cone, near, pos: (c) => c.pos() });
  if (a && hand.distanceTo(a.item.pos()) - (a.item.r ?? 0) <= range) return { item: a.item, direct: false };
  return null;
}

// ------------------------------------------------------------------ the field's ink

/** A field stroke's width (of its full 1.6 cm) at `k` along it (0 glove, 1 metal) and `eye` m from the camera. Pure. */
export function fieldWidth(k, eye = Infinity) {
  const ends = 0.4 + 0.6 * Math.sin(Math.PI * THREE.MathUtils.clamp(k, 0, 1));
  return ends * THREE.MathUtils.clamp(eye / 5, 0.25, 1);
}

/**
 * Wavy ink strokes between two points (the magnet's field): a few lines bowing out round the straight
 * one, like the lines between a horseshoe's poles, drawn as short thin segments (one instanced mesh, kept a
 * pen line wide at any distance) in dashes that flow along them (toward the glove while it pulls).
 */
export class FieldLines {
  constructor(parent, { strokes = 5, segs = 22, px = 1.8 } = {}) {
    this.strokes = strokes; this.segs = segs;
    const g = thinPole(new THREE.CylinderGeometry(0.008, 0.008, 1, 4, 1, true).translate(0, 0.5, 0));   // (a pen line: fine, the thin pass keeps it 1.8 px far off)
    this.mesh = new THREE.InstancedMesh(g, makeMaterial({ color: '#ffffff', flat: true, thin: px }), strokes * segs);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(strokes * segs * 3), 3);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.userData.noCollide = true;
    parent.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._c = new THREE.Color();
    this.colors = [INK, '#c8483a', INK, '#3b4a6b', INK];
  }
  /** The strokes from a to b at time t: amp (m) how far they bow, flow (+1 toward a, -1 toward b), spread (0..1 a fan, for a search). */
  draw(a, b, t, { amp = 0.5, flow = 1, spread = 0, strokes = this.strokes, eye = null } = {}) {
    const d = _v.subVectors(b, a), L = d.length();
    if (L < 0.05) { this.mesh.count = 0; return; }
    d.divideScalar(L);
    const u = _w.set(0, 1, 0).cross(d); if (u.lengthSq() < 1e-4) u.set(1, 0, 0); u.normalize();
    const w = _u.crossVectors(d, u).normalize();
    let n = 0;
    const P = [new THREE.Vector3(), new THREE.Vector3()];
    for (let s = 0; s < strokes; s++) {
      const th = (s / strokes) * Math.PI * 2 + t * 0.9;
      for (let i = 0; i < this.segs; i++) {
        // dashes flowing along the line
        const k0 = i / this.segs, k1 = (i + 0.8) / this.segs;
        const ph = (k0 * 4 + t * 2.2 * flow + s * 0.37) % 1;
        if ((ph + 1) % 1 > 0.72) continue;
        for (const [j, k] of [[0, k0], [1, k1]]) {
          const bow = Math.sin(Math.PI * k) * amp * (1 + spread * k * 2) * (0.75 + 0.25 * Math.sin(k * 11 + t * 6 + s));
          const wig = Math.sin(k * 19 - t * 9 + s * 2) * 0.04 * (0.4 + amp);
          P[j].copy(a).addScaledVector(d, L * k).addScaledVector(u, Math.cos(th) * bow + wig).addScaledVector(w, Math.sin(th) * bow);
        }
        const seg = this._s.subVectors(P[1], P[0]), sl = seg.length();
        if (sl < 1e-4) continue;
        this._q.setFromUnitVectors(_Y, seg.divideScalar(sl));
        // (thinner toward their ends, and close to the eye: a stroke by the glove, a hand's breadth from the
        // camera, is a fine pen line, not a fat bar with its corners showing; the thin pass keeps it a line far off)
        const ws = fieldWidth(k0, eye ? eye.distanceTo(P[0]) : Infinity);
        this._m.compose(P[0], this._q, this._s.set(ws, sl, ws));
        this.mesh.setMatrixAt(n, this._m);
        this.mesh.setColorAt(n, this._c.set(this.colors[s % this.colors.length]));
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  hide() { this.mesh.count = 0; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); }
}

// ------------------------------------------------------------------ the glove

function gloveModel(scale = 1) {
  const g = new THREE.Group();
  const leather = inkMat('#6b4a36'), dark = inkMat('#3a2a22'), red = inkMat('#c8483a'), steel = inkMat('#c9ced6', { metal: 'steel' }), brass = inkMat('#d6a94a', { metal: 'brass' }), paper = inkMat(PAPER);
  const S = scale;
  // the cuff and the heavy back of the hand
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.075 * S, 0.085 * S, 0.12 * S, 12).rotateX(Math.PI / 2).translate(0, 0, -0.12 * S), dark));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.08 * S, 0.012 * S, 5, 16).translate(0, 0, -0.065 * S), brass));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15 * S, 0.07 * S, 0.13 * S).translate(0, 0, 0.0), leather));
  // four stubby fingers and a thumb, curled a little
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.017 * S, 0.06 * S, 3, 6).rotateX(Math.PI / 2 - 0.35), leather);
    f.position.set((-0.054 + i * 0.036) * S, -0.012 * S, 0.1 * S);
    g.add(f);
  }
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.019 * S, 0.05 * S, 3, 6).rotateZ(1.1), leather);
  th.position.set(-0.09 * S, -0.01 * S, 0.02 * S); g.add(th);
  // the horseshoe on its back: red, steel at its poles, the makers' mark (a pale ring round a dot) at its arch
  const shoe = new THREE.Group(); shoe.position.set(0, 0.06 * S, -0.005 * S); shoe.rotation.x = -Math.PI / 2;
  shoe.add(new THREE.Mesh(new THREE.TorusGeometry(0.05 * S, 0.016 * S, 6, 16, Math.PI).rotateZ(Math.PI), red));
  for (const x of [-0.05, 0.05]) shoe.add(new THREE.Mesh(new THREE.BoxGeometry(0.034 * S, 0.035 * S, 0.034 * S).translate(x * S, 0.017 * S, 0), steel));
  shoe.add(new THREE.Mesh(new THREE.TorusGeometry(0.014 * S, 0.004 * S, 4, 12).translate(0, -0.05 * S, 0.018 * S), paper));
  shoe.add(new THREE.Mesh(new THREE.SphereGeometry(0.005 * S, 6, 4).translate(0, -0.05 * S, 0.019 * S), paper));
  g.add(shoe);
  g.userData.shoe = shoe;
  return g;
}

export default {
  id: 'magnet', name: 'Magnet glove', glyph: '∩', order: 40,
  text: 'A heavy glove of oiled leather with a horseshoe of the makers’ glyph riveted to its back. It hums when metal is near, and it does not care how heavy the metal is.',
  use: 'Hold Y / △ (T, or the middle mouse button) near metal within 18 m: a metal crate or a makers’ machine is lifted and held out where you look. The camera moves it, the left stick (W / S) brings it nearer or sends it further; let go to drop it. A tap throws it away from you. Heavy metal fixed in place (iron blocks, the makers’ brass machinery) pulls you to it instead, across a gap.',
  model: () => { const m = gloveModel(1.2); m.rotation.set(0.5, -0.6, 0.15); return m; },
  create(ctx) { return new Magnet(ctx); },

  /**
   * Its bay in the Gadget Yard: a metal crate up on a tower and a pit walled round a floor plate (lift the
   * crate over the wall onto the plate: the gate of the alcove opens on a pot of ink); an iron block across
   * a gap from a ledge (pull yourself over); machines to throw about come with the yard's pen.
   */
  yard(kit) {
    kit.flag('#7f8a96');
    // the puzzle: the crate on a tower you cannot climb (sheer, 5 m), the plate in a pit walled round (3 m, no way in)
    kit.block([2.6, 5, 2.6], [5, 2.5, -2]);
    kit.crate([5, 5.5, -2], { metal: true });
    const pit = [-1, -6.5], h = 3;
    kit.block([4.4, h, 0.5], [pit[0], h / 2, pit[1] - 2]); kit.block([4.4, h, 0.5], [pit[0], h / 2, pit[1] + 2]);
    kit.block([0.5, h, 3.5], [pit[0] - 2, h / 2, pit[1]]); kit.block([0.5, h, 3.5], [pit[0] + 2, h / 2, pit[1]]);
    const plate = kit.plate([pit[0], 0, pit[1]], { mass: 3, things: true });   // (only metal presses it: not you)
    // the alcove its gate closes: a pot of ink inside
    kit.block([0.6, 2.6, 3.4], [-6.2, 1.3, -6.5]); kit.block([0.6, 2.6, 3.4], [-3.8, 1.3, -6.5]); kit.block([3, 0.4, 3.4], [-5, 2.8, -6.5]);
    kit.block([3, 2.6, 0.6], [-5, 1.3, -8.4]);
    kit.gate([1.8, 2.4, 0.25], [-5, 1.2, -4.8], { plates: [plate] });
    kit.pickup([-5, 0, -6.8], { amount: 2 });
    // the gap: a ledge to stand on, and across 11 m of air, an iron block on a pillar (no other way up)
    kit.steps([5.8, 0, 5.2], 3, { yaw: Math.PI / 2, width: 1.6 });
    kit.block([2.2, 3, 2.2], [2.6, 1.5, 5.2]);
    kit.block([1.2, 6.2, 1.2], [-8.4, 3.1, 3.2]);
    kit.ironBlock([1.6, 1.6, 1.6], [-8.4, 7, 3.2]);
    // and a loose metal crate in the open to throw about
    kit.crate([1.5, 0.5, 1], { metal: true });
  },
};

class Magnet {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = 'idle'; this.t = 0; this.cool = 0; this.aiming = false;
    this.cand = null; this.held = null; this.dist = 5; this.falling = []; this.knocked = new Map();
    this.ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.field = new FieldLines(ctx.fx);
    this.goal = new THREE.Vector3(); this.reel = new THREE.Vector3(); this.point = new THREE.Vector3(); this.normal = new THREE.Vector3();
    this.lastPos = new THREE.Vector3();
    this.glove = gloveModel(1.4);
    this.glove.traverse((o) => { o.userData.noCollide = true; });
    this.glove.visible = false;
    ctx.fx.add(this.glove);
    this.pulse = 0; this.pulseTo = new THREE.Vector3(); this.humT = 0; this.time = 0;
  }

  /** Every metal spot fixed in this world (looked for once, when the glove is first used). */
  spots() { return (this._spots ??= metalSpots(this.ctx.scene, this.ctx.level)); }

  /** What the glove may take hold of now. */
  candidates() {
    const out = [];
    for (const p of this.ctx.world?.props ?? []) if (p.metal && p.object.visible) out.push({ kind: 'prop', prop: p, r: p.r, pos: () => p.pos });
    for (const f of this.ctx.foes?.list ?? []) if (f.kind === 'machine' && f.alive && !this.falling.some((x) => x.foe === f)) out.push({ kind: 'foe', foe: f, r: f.def.radius, pos: () => f.chest });
    for (const s of this.spots()) out.push({ kind: 'fixed', spot: s, r: s.extent, pos: () => s.pos });
    return out;
  }

  canUse() {
    const P = this.ctx.player;
    return !!P && !P.ride && !P.down && !P.mantle && !P.dead && !P.swim?.under;
  }
  hand(out = new THREE.Vector3()) {
    const { tool, player: P } = this.ctx;
    if (tool?.muzzle && P?.object?.visible !== false) return tool.muzzle(out);
    return out.copy(P.pos).addScaledVector(P.frame.up, 1.45);
  }

  /** The metal under the aim now, in plain sight from the glove. */
  pick() {
    const { camera, player: P, physics, world } = this.ctx;
    aimRay(camera, P, this.ray);
    const hand = this.hand(_q);
    const ray = () => rayWorld(physics, this.ray.origin, this.ray.dir, MAG.range + 6);
    const aim = ray();   // (the props' own colliders count here: aiming at a crate hits the crate)
    this.aimHit = aim;
    const p = pickMetal(this.ray.origin, this.ray.dir, this.candidates(), { aimHit: aim?.point ?? null, hand });
    if (!p) return null;
    const c = p.item, at = c.pos(), d = hand.distanceTo(at);
    if (d < 0.8) return null;
    // in plain sight: the aim itself lands on it, or the traveller's eyes see its middle or its top
    if (!p.direct) {
      const eyes = [_g.copy(P.pos).addScaledVector(P.frame.up, 1.7), camera.position];
      const seen = (q) => eyes.some((eye) => {
        const dd = eye.distanceTo(q), to = _v.subVectors(q, eye).divideScalar(dd);
        const block = world?.withoutProps ? world.withoutProps(() => rayWorld(physics, eye, to, dd)) : rayWorld(physics, eye, to, dd);
        return !block || block.distance >= dd - (c.r ?? 0.6) - 0.35;
      });
      if (!seen(at) && !seen(_w.copy(at).addScaledVector(P.frame.up, (c.r ?? 0.6) * 0.8))) return null;
    }
    c.direct = p.direct;
    return c;
  }

  equip() { this.ctx.sfx.equip(this.ctx.sound); snd.hum(this.ctx.sound, 0.6); }
  unequip() { this.cancel(); }
  cancel() {
    this.aiming = false;
    if (this.state === 'hold') this.drop();
    if (this.state === 'pull') this.letGo(false);
    if (this.state === 'aim') this.state = 'idle';
  }

  press() {
    if (this.state === 'pull') { this.letGo(false); return; }
    if (this.state !== 'idle' || this.cool > 0 || !this.canUse()) return;
    this.state = 'aim'; this.t = 0; this.aiming = true;
    this.cand = this.pick();
  }
  hold(dt) {
    if (this.state !== 'aim') return;
    this.t += dt;
    if (this.t < MAG.tap) return;
    const c = this.cand;
    if (!c) return;   // (still looking: it takes hold as soon as the aim finds metal)
    if (c.kind === 'fixed') this.startPull(c); else this.grab(c);
  }
  release() {
    const st = this.state;
    this.aiming = false;
    if (st === 'aim') {
      this.state = 'idle';
      if (this.t < MAG.tap) this.tap(this.cand ?? this.pick());
    } else if (st === 'hold') this.drop();
  }

  // ---------------------------------------------------------------- loose metal
  grab(c) {
    const hand = this.hand(_q);
    this.held = c; this.state = 'hold';
    this.dist = THREE.MathUtils.clamp(hand.distanceTo(c.pos()), MAG.min, MAG.max);
    if (c.prop) { c.prop.held = this; c.prop.resting = false; }
    if (c.foe) { c.foe.stunned = Math.max(c.foe.stunned, 0.5); c.foe.flash = 1; }
    this.lastPos.copy(c.pos());
    snd.grab(this.ctx.sound, !!c.foe);
    kick(0.15);
  }

  drop() {
    const c = this.held;
    this.held = null; this.state = 'idle'; this.cool = MAG.cool;
    if (!c) return;
    if (c.prop) { c.prop.held = null; c.prop.vel.multiplyScalar(0.6); c.prop.resting = false; }
    if (c.foe && c.foe.alive) this.falling.push({ foe: c.foe, vy: 0, from: c.foe.alt });
    snd.drop(this.ctx.sound);
  }

  /** A tap: loose metal thrown away, a machine knocked back and stunned, fixed metal pulls you to it. */
  tap(c) {
    const hand = this.hand(new THREE.Vector3()), up = this.ctx.player.frame.up;
    this.cool = MAG.cool;
    this.pulse = 0.35;
    if (!c) { this.pulseTo.copy(this.ray.origin).addScaledVector(this.ray.dir, 4); snd.fizz(this.ctx.sound); return; }
    this.pulseTo.copy(c.pos());
    const dir = _v.subVectors(c.pos(), hand).normalize();
    if (c.kind === 'fixed') { this.startPull(c); return; }
    if (c.prop) {
      const p = c.prop;
      if (p.held && p.held !== this) p.held = null;   // (off a rope: it snaps)
      p.vel.addScaledVector(dir, MAG.shove).addScaledVector(up, 3.5); p.resting = false;
    } else if (c.foe) {
      const f = c.foe, flat = dir.clone().setY(0).normalize();
      f.vel.copy(flat).multiplyScalar(MAG.shoveFoe); f.stunned = Math.max(f.stunned, 1); f.flash = 1;
    }
    snd.shove(this.ctx.sound);
    kick(0.3);
  }

  /** Each frame a thing is held: where the aim wants it, how it gets there, what it knocks on the way. */
  updateHold(dt) {
    const c = this.held, { physics, player: P } = this.ctx;
    const hand = this.hand(_q);
    aimRay(this.ctx.camera, P, this.ray);
    if (c.foe && !c.foe.alive) { this.held = null; this.state = 'idle'; return; }
    const at = c.pos();
    // (the ground under it, not its own top: the loose things' colliders are set aside)
    const under = () => physics?.groundAt?.(at.x, Math.max(at.y, hand.y) + 2, at.z, 60);
    const ground = this.ctx.world?.withoutProps ? this.ctx.world.withoutProps(under) : under();
    const half = c.prop ? c.prop.h : 0.2 + (c.foe?.def.height ?? 0);
    holdPoint(hand, this.ray.dir, this.dist, (Number.isFinite(ground) ? ground : -Infinity) + half + 0.05, this.goal);
    if (at.distanceTo(this.goal) > MAG.lost + this.dist * 0.2 || hand.distanceTo(at) > MAG.range + 3) { this.drop(); return; }
    const speed = _w.subVectors(at, this.lastPos).length() / Math.max(dt, 1e-4);
    this.lastPos.copy(at);
    if (c.prop) {
      followVelocity(at, this.goal, {}, c.prop.vel);
      c.prop.resting = false;
    } else if (c.foe) {
      const f = c.foe, v = followVelocity(f.chest, this.goal, {}, _u).multiplyScalar(dt);
      // across: only where nothing stands in the way; up: its height over its footing
      const flat = _w.set(v.x, 0, v.z), L = flat.length();
      if (L > 1e-4) {
        const blocked = rayWorld(physics, f.chest, flat.clone().divideScalar(L), L + f.def.radius);
        if (!blocked) { f.pos.x += flat.x; f.pos.z += flat.z; }
      }
      const g = physics?.groundAt?.(f.pos.x, f.pos.y + f.alt + 2, f.pos.z, 40);
      if (Number.isFinite(g)) f.pos.y = g;
      f.alt = THREE.MathUtils.clamp(f.alt + v.y, 0, 9);
      f.vel.set(0, 0, 0); f.stunned = Math.max(f.stunned, 0.4);
    }
    // swung into a foe: it is knocked down
    if (speed > MAG.swing) {
      for (const f of this.ctx.foes?.list ?? []) {
        if (!f.alive || f === c.foe) continue;
        if ((this.knocked.get(f) ?? 0) > this.time) continue;
        if (f.chest.distanceTo(at) > (c.r ?? 0.6) + f.def.radius + 0.3) continue;
        this.knocked.set(f, this.time + 0.7);
        const dir = _v.subVectors(f.chest, at).setY(0).normalize();
        if (this.ctx.foes?.hurt) this.ctx.foes.hurt(f, 'blade', dir, { damage: 1, combo: 2, source: 'magnet' });
        else f.hit?.('blade', dir, { damage: 1 });
        hitStop(0.06); kick(0.4);
        snd.bonk(this.ctx.sound);
      }
    }
  }

  /** Dropped machines fall (their height over their footing), and are hurt by a long fall. */
  updateFalling(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const x = this.falling[i], f = x.foe;
      if (!f.alive) { this.falling.splice(i, 1); continue; }
      x.vy -= MAG.gravity * dt;
      f.alt += x.vy * dt;
      f.stunned = Math.max(f.stunned, 0.2);
      if (f.alt <= (f.def.hover ?? 0)) {
        f.alt = f.def.hover ?? 0;
        this.falling.splice(i, 1);
        f.stunned = Math.max(f.stunned, 1.2); f.flash = 1;
        if (x.from > MAG.drop) {
          if (this.ctx.foes?.hurt) this.ctx.foes.hurt(f, 'blade', _v.set(0, -1, 0), { damage: x.from > 5 ? 2 : 1, source: 'magnet' });
          kick(0.35);
        }
        snd.thud(this.ctx.sound, Math.min(1, x.from / 5));
        const drops = this.ctx.tool?.drops;
        if (drops) for (let k = 0; k < 14; k++) drops.add({ pos: f.pos, vel: _w.randomDirection().setY(Math.random()).multiplyScalar(3), drag: 2, grav: 10, size: 0.05, stretch: 2, life: 0.5, color: k % 2 ? INK : '#a8824a' });
      }
    }
  }

  // ---------------------------------------------------------------- fixed metal: pulled to it
  startPull(c) {
    const { physics, player: P } = this.ctx;
    const hand = this.hand(_q), at = c.pos(), d = hand.distanceTo(at);
    // where it meets the metal: the aim's own hit on it, or the line from the glove to its middle
    let hit = c.direct && this.aimHit && this.aimHit.point.distanceTo(at) <= (c.r ?? 0.6) + 0.4 ? this.aimHit : null;
    if (!hit) hit = rayWorld(physics, hand, _v.subVectors(at, hand).divideScalar(d), d + 1);
    if (hit) { this.point.copy(hit.point); this.normal.copy(hit.normal); }
    else { this.normal.subVectors(hand, at).normalize(); this.point.copy(at).addScaledVector(this.normal, c.spot?.radius ?? 0.5); }
    this.held = c; this.state = 'pull'; this.t = 0; this.best = Infinity; this.since = 0;
    reelTarget(this.point, this.normal, P.frame.up, this.goal);
    if (P.climbing) P.stopClimb?.(false);
    this._jumpHeld = true;
    snd.clamp(this.ctx.sound);
    kick(0.25);
  }

  letGo(fling = false) {
    const P = this.ctx.player;
    if (this.state === 'pull' && P) {
      if (fling) { P.vel.copy(this.reel).multiplyScalar(0.55).addScaledVector(P.frame.up, 6.5); P.onGround = false; }
      else P.vel.multiplyScalar(0.35);
    }
    this.state = 'idle'; this.held = null; this.cool = MAG.cool;
  }

  /** Before the traveller moves: the stick's reach while holding, the pull while pulled. */
  control(dt, input) {
    const P = this.ctx.player;
    if (this.state === 'hold') {
      const y = input.stick?.y ?? ((input.KeyW ? 1 : 0) - (input.KeyS ? 1 : 0));
      this.dist = reachAfter(this.dist, y, dt);
      // (the stick moves what is held: the traveller stands meanwhile)
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) input[k] = false;
      if ('stick' in input) input.stick = null;
      return;
    }
    if (this.state !== 'pull') return;
    if (!P || P.ride || P.down || P.swim) { this.letGo(false); return; }
    const up = P.frame.up;
    if (input.Space && !this._jumpHeld) { this._jumpHeld = true; this.letGo(true); P._jumpHeld = true; return; }
    this._jumpHeld = !!input.Space;
    this.t += dt;
    const d = P.pos.distanceTo(this.goal);
    if (d < this.best - 0.05) { this.best = d; this.since = 0; } else this.since += dt;
    if (d < MAG.arrive || this.since > MAG.stuck || this.t > MAG.maxPull) { this.arrive(); return; }
    reelVelocity(P.pos, this.goal, { speed: MAG.pull, ease: MAG.ease }, this.reel);
    P.vel.copy(this.reel).addScaledVector(up, 32 * dt);
    P.onGround = false; P.gliding = false;
    if (P.jetFlight) P.endJets?.();
    _v.copy(this.reel).addScaledVector(up, -this.reel.dot(up));
    if (_v.lengthSq() > 1) P.heading = P.frame.headingOf(_v);
  }

  /** Arrived at the metal: take hold of it (a wall), haul over its top, or stand on it. */
  arrive() {
    const P = this.ctx.player, up = P.frame.up, n = this.normal, nu = n.dot(up);
    this.state = 'idle'; this.held = null; this.cool = MAG.cool;
    P.vel.set(0, 0, 0);
    snd.clamp(this.ctx.sound, 0.5);
    if (nu < 0.55 && nu > -0.4) {
      const into = _v.copy(n).addScaledVector(up, -nu).normalize().negate();
      P.wallN.copy(into).negate();
      if (P.tryMantle?.(up, into)) return;
      if (P.opts?.climb !== false && P.stamina > 0.1 && !P.winded) { P.startClimb?.(_w.copy(into).negate()); return; }
      P.vel.copy(into).multiplyScalar(-2).addScaledVector(up, 3);
    } else if (nu >= 0.55) P.vel.copy(this.reel).multiplyScalar(0.12);
  }

  // ---------------------------------------------------------------- every frame
  update(dt, paused = false) {
    this.time += dt;
    this.cool = Math.max(0, this.cool - dt);
    const { hud } = this.ctx;
    if (!paused) this.updateFalling(dt);
    if ((this.state === 'aim' || this.state === 'hold') && !this.canUse()) this.cancel();
    // (a conversation, a scene: what was under way was let go (cancel); its field and the glove go with it)
    if (paused) { this.field.hide(); this.glove.visible = false; this.pulse = 0; if (this._shown) { this._shown = false; hud.reticle(null); } return; }
    const hand = this.hand(new THREE.Vector3()), eye = this.ctx.camera?.position ?? null;
    let showing = false;
    if (this.state === 'aim') {
      this.cand = this.pick();
      const c = this.cand;
      if (c) {
        const d = hand.distanceTo(c.pos());
        hud.reticle(c.pos(), c.kind === 'fixed' ? 'anchor' : 'target', `${c.kind === 'fixed' ? 'fixed metal: pulls you' : c.kind === 'foe' ? 'machine' : 'metal crate'} · ${Math.round(d)} m`);
        this.field.draw(hand, c.pos(), this.time, { amp: 0.25 + 0.03 * d, flow: 1, strokes: 3, eye });
        this.ctx.aimAt(c.pos(), this.ray.dir);
      } else {
        // searching: a short fan of field lines feeling ahead
        const end = _g.copy(this.ray.origin).addScaledVector(this.ray.dir, 3);
        hud.reticle(null, 'far', 'no metal in reach');
        this.field.draw(hand, end, this.time, { amp: 0.18, spread: 0.6, flow: -1, strokes: 3, eye });
        this.ctx.aimAt(end, this.ray.dir);
      }
      showing = true;
    } else if (this.state === 'hold') {
      this.updateHold(dt);
      if (this.held) {
        const at = this.held.pos();
        this.field.draw(hand, at, this.time, { amp: 0.35 + 0.04 * this.dist, flow: 1, eye });
        hud.reticle(at, 'target', `${Math.round(this.dist)} m · left stick nearer / further`);
        this.ctx.aimAt(at, this.ray.dir);
        this.humT -= dt;
        if (this.humT <= 0) { this.humT = 0.32; snd.hum(this.ctx.sound, 1); }
        showing = true;
      }
    } else if (this.state === 'pull') {
      this.field.draw(hand, this.point, this.time, { amp: 0.4, flow: -1, eye });
      this.humT -= dt;
      if (this.humT <= 0) { this.humT = 0.25; snd.hum(this.ctx.sound, 1.3); }
    } else if (this.pulse > 0) {
      this.pulse -= dt;
      this.field.draw(hand, this.pulseTo, this.time * 3, { amp: 0.6 * (1 - this.pulse / 0.35) + 0.1, flow: -2, eye });
    } else this.field.hide();
    if (showing) this._shown = true;
    else if (this._shown) { this._shown = false; hud.reticle(null); }
    // the glove's horseshoe in the hand while it works
    const on = this.state !== 'idle' || this.pulse > 0;
    this.glove.visible = on;
    if (on) {
      this.glove.position.copy(hand);
      this.glove.quaternion.setFromUnitVectors(_w.set(0, 0, 1), _u.copy(this.ray.dir));
    }
  }

  hud() { return { note: this.state === 'hold' ? 'holding' : this.state === 'pull' ? 'pulling you' : '' }; }

  dispose() { this.field.dispose(); this.glove.removeFromParent(); }
}

// ------------------------------------------------------------------ its sounds (the game's synth: src/audio.js)
const now = (s) => (s?.ctx ? s.ctx.currentTime : null);
export const snd = {
  /** The field: a low electric hum (k: louder, higher, while it pulls). */
  hum(s, k = 1) { const t = now(s); if (t == null) return; s.sweep(t, 92 * k, 96 * k, 0.34, 0.035, 'sawtooth'); s.sweep(t, 184 * k, 190 * k, 0.3, 0.015, 'square'); },
  /** It takes hold: a clank, and the field coming up. */
  grab(s, machine = false) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.06, type: 'bandpass', freq: machine ? 900 : 1300, q: 2, vol: 0.14 }); s.sweep(t, 140, 320, 0.25, 0.06, 'sawtooth'); },
  /** Let go: the field drops away. */
  drop(s) { const t = now(s); if (t == null) return; s.sweep(t, 300, 90, 0.25, 0.05, 'sawtooth'); },
  /** A tap: a shove of the field, a thump of air. */
  shove(s) { const t = now(s); if (t == null) return; s.sweep(t, 220, 70, 0.22, 0.12, 'square'); s.burst(t, { dur: 0.12, type: 'lowpass', freq: 600, q: 0.7, vol: 0.14 }); },
  /** Nothing to take: a crackle. */
  fizz(s) { const t = now(s); if (t == null) return; for (let i = 0; i < 4; i++) s.burst(t + i * 0.03, { dur: 0.02, type: 'highpass', freq: 3000 + i * 500, q: 1, vol: 0.04 }); },
  /** Fixed metal: a heavy clamp of iron on iron. */
  clamp(s, k = 1) { const t = now(s); if (t == null) return; [1, 1.5].forEach((m, i) => s.sweep(t + i * 0.006, 620 * m, 560 * m, 0.3, 0.06 * k, 'triangle')); s.burst(t, { dur: 0.1, type: 'lowpass', freq: 800, q: 0.9, vol: 0.18 * k }); },
  /** A held thing swung into a foe. */
  bonk(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.1, type: 'lowpass', freq: 500, q: 1, vol: 0.25 }); s.sweep(t, 200, 80, 0.15, 0.1); },
  /** A dropped machine lands. */
  thud(s, k = 1) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.18, type: 'lowpass', freq: 400, q: 0.8, vol: 0.12 + 0.18 * k }); s.sweep(t, 120, 50, 0.2, 0.08 * k); },
};
