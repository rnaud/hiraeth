import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerHazard } from '../hazards.js';
import { Flames } from '../story/flames.js';
import { glyphGeometry } from '../story/sign-text.js';
import { T, box, lathe, prep } from './kit.js';

// The temple's moving and answering parts. Each piece is built by the
// runtime (runtime.js) from a temple's layout, in the temple's local frame,
// and stands for one element of its logic (logic.js) when it has an id:
//
//   Door     a slab that sinks into the floor when its condition holds (lamps on the lintel show
//            how much of it is met); solid while shut. bell: true makes it a bell-tuned door (the
//            bell-note whistle, sounded near it, opens it).
//   Plate    a disc in the floor that a weight holds down (you, or a stone ball on it)
//   Ball     a stone ball in a groove (a "drum"): the fluid push rolls it along; at rest on its
//            plate it holds the plate down, and where it stopped is saved
//   Brazier  a cold bowl: an ember glob lights it for good (it answers 'fire' only)
//   Bramble  dry thorns across a doorway: an ember glob burns them away for good
//   Switch   a carved eye on a wall: a splash of fluid wakes it for good
//   Bank     four eyes that wake only together, inside a breath: it wants the fourth chamber
//   LightEar a lamp that wakes when you stand by it with the lantern charm
//   Platform a disc that rides between points (you ride along on it)
//   Bridge   stones that rise out of a chasm when their condition holds
//   Mark     a glyph stone: walk past it and it is where you come back to (a checkpoint)
//   Pit      a volume below a chasm: fall in and you are back at the room's mark
//
// Any of Door, Switch and Bridge can be `hidden`: only the glyph lens shows it (src/items.js 'lens'): a hidden
// door is plain wall until you carry the lens, a hidden eye and a hidden bridge are not there at all.
// (`hidden: 'lantern'`: only the lantern charm's light shows it.)
//
// A piece: { id?, update(dt, t), init(physics)?, setOpen(open, instant)?, solid?, dispose() }.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
// (the moving parts are dynamic too: never tiled, merged or culled as static props, src/perf.js)
const noCollide = (o) => { o.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; }); return o; };
const ease = (k) => k * k * (3 - 2 * k);
const _dl = new THREE.Vector3(), _dn = new THREE.Vector3();
/** What shows a hidden piece: the glyph lens (hidden: true), or the item named. */
const shownBy = (h) => (h === true ? 'lens' : h);
let uid = 0;
/** A material of its own (uniforms it can change without touching other pieces). */
const own = (o) => makeMaterial({ ...o, key: `temple.${uid++}` });

function mesh(geos, mat) {
  const g = mergeGeometries([geos].flat().map(prep));
  const m = new THREE.Mesh(g, mat);
  return m;
}

// ---------------------------------------------------------------------------------------- doors
export class Door {
  /**
   * @param rt   the runtime (kit, root, logic, M)
   * @param o    { id, at: [x, y, z] the doorway's foot, yaw (0: the slab faces ±z), w, h, t, lamps: [condition], bell }
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const { w = 4.4, h = 6, t = 0.9 } = o;
    this.w = w; this.h = h;
    const K = rt.kit, M = rt.M;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.slab = new THREE.Group();
    this.group.add(this.slab);
    this.slab.add(mesh([box(w, h, t, 0, h / 2, 0)], M.wallGlyph));
    this.slab.add(mesh([box(w + 0.02, 0.3, t + 0.12, 0, 0.6, 0), box(w + 0.02, 0.3, t + 0.12, 0, h - 0.6, 0)], M.trimMat));
    // the medallion: the glyph in a ring, glowing more as the door wakes
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.25, flat: true });
    const gl = [];
    for (const s of [1, -1]) {
      gl.push(T(glyphGeometry(Math.min(w, h) * 0.5, 0.1), [0, h * 0.58, s * (t / 2 + 0.04)], [0, s > 0 ? 0 : Math.PI, 0]));
      for (const y of [0.95, h - 0.95]) gl.push(T(new THREE.BoxGeometry(w * 0.7, 0.09, 0.06), [0, y, s * (t / 2 + 0.03)]));
    }
    this.glowMesh = mesh(gl, this.glow);
    this.slab.add(this.glowMesh);
    if (o.bell) {
      // a bell-tuned door: a bell's outline over the glyph
      const bell = lathe([[0.02, 0], [0.5, 0.05], [0.55, 0.35], [0.38, 0.9], [0.3, 1.25], [0.02, 1.35]], 14);
      this.slab.add(mesh([T(bell.clone(), [0, h * 0.82, t / 2 + 0.1], [Math.PI / 2, 0, 0], 0.8), T(bell, [0, h * 0.82, -t / 2 - 0.1], [-Math.PI / 2, 0, 0], 0.8)], this.glow));
    }
    // the lamps on the lintel above the doorway: one per condition (both faces)
    this.lamps = (o.lamps ?? []).map((cond, i, all) => {
      const m = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.05, flat: true });
      const x = (i - (all.length - 1) / 2) * 0.9;
      const g = [T(new THREE.SphereGeometry(0.22, 10, 8), [x, h + 0.55, t / 2 + 0.35]), T(new THREE.SphereGeometry(0.22, 10, 8), [x, h + 0.55, -t / 2 - 0.35])];
      const lm = mesh(g, m);
      this.group.add(lm);
      return { cond, m, on: false, mesh: lm };
    });
    noCollide(this.group);
    // solid while shut: an invisible block filling the doorway (added to the physics in init)
    this.block = new THREE.Mesh(box(w, h, t + 0.2, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.k = rt.logic?.isOpen(o.id) ? 1 : 0;
    this.open = this.k > 0.5;
    this.apply();
  }
  init(physics) { this.physics = physics; if (!this.open) this.handle = physics.addCollider?.(this.block) ?? null; }
  setOpen(open, instant = false) {
    if (open === this.open) return;
    this.open = open;
    if (open && this.handle) { this.physics?.removeCollider?.(this.handle); this.handle = null; }
    if (!open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block) ?? null;
    if (instant) { this.k = open ? 1 : 0; this.apply(); }
    else { this.rt.sound?.whoosh?.(); this.rt.rumble?.(open ? 1.6 : 0.8, 0.35); }
  }
  apply() {
    this.slab.position.y = -ease(this.k) * (this.h + 0.3);
    this.slab.visible = this.k < 0.999;
  }
  update(dt, t) {
    const want = this.open ? 1 : 0;
    if (this.k !== want) { this.k = THREE.MathUtils.clamp(this.k + (want ? dt / 1.8 : -dt / 0.9), 0, 1); this.apply(); }
    // a shut door is not a wall to climb (up it and over the lintel is out of the temple's rooms): you slip off
    const P = this.rt.player;
    if (!this.open && P?.climbing) {
      const l = this.group.worldToLocal(_dl.copy(P.pos));
      if (Math.abs(l.x) < this.w / 2 + 1.2 && Math.abs(l.z) < 1.6 && l.y > -1 && l.y < this.h + 3) {
        P.climbing = false;
        P.vel.copy(_dn.set(0, 0, Math.sign(l.z) || 1).transformDirection(this.group.matrixWorld).multiplyScalar(2.5)).setY(-1);
        P._climbCooldown = 1.2;
      }
    }
    // hidden: plain wall, no glyph, until the lens shows it
    if (this.o.hidden) { const seen = this.rt.logic.has(shownBy(this.o.hidden)); this.glowMesh.visible = seen; for (const l of this.lamps) l.mesh.visible = seen; if (!seen) return; }
    let met = 0;
    for (const l of this.lamps) {
      const on = this.open || !!this.rt.logic?.check(l.cond);
      if (on) met++;
      l.m.uniforms.uGlow.value += ((on ? 1 : 0.05) - l.m.uniforms.uGlow.value) * Math.min(1, dt * 6);
    }
    const wake = this.open ? 1 : this.lamps.length ? met / this.lamps.length : 0.2;
    this.glow.uniforms.uGlow.value = 0.2 + 0.7 * wake * (0.8 + 0.2 * Math.sin(t * 3));
  }
}

// ---------------------------------------------------------------------------------------- plates
export class Plate {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.r = o.r ?? 1.3;
    const K = rt.kit, M = rt.M;
    this.pos = K.world(...o.at);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    rt.root.add(this.group);
    this.group.add(mesh([T(new THREE.CylinderGeometry(this.r + 0.35, this.r + 0.45, 0.12, 24), [0, 0.04, 0])], M.trimMat));
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.1, flat: true });
    this.disc = mesh([T(new THREE.CylinderGeometry(this.r, this.r, 0.14, 24), [0, 0.1, 0]), T(glyphGeometry(this.r * 1.2, 0.04).rotateX(-Math.PI / 2), [0, 0.18, 0])], this.glow);
    this.group.add(this.disc);
    noCollide(this.group);
    this.k = 0;
  }
  weighed(p) { return !!p && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < this.r + 0.2 && Math.abs(p.pos.y - this.pos.y) < 0.6 && (p.onGround || p.down); }
  update(dt) {
    const L = this.rt.logic, on = this.weighed(this.rt.player);
    if (on) { if (L.press(this.id, 'player')) this.rt.sound?.chime?.(); } else L.release(this.id, 'player');
    const down = L.pressed(this.id);
    this.k += ((down ? 1 : 0) - this.k) * Math.min(1, dt * 8);
    this.disc.position.y = -0.07 * this.k;
    this.glow.uniforms.uGlow.value = 0.1 + 0.85 * this.k;
  }
}

// ---------------------------------------------------------------------------------------- balls
export class Ball {
  /** o: { id, a, b: [x, y, z] the groove's ends (where the ball touches the floor), r } */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.r = o.r ?? 1.1;
    const K = rt.kit, M = rt.M;
    this.a = K.world(...o.a); this.b = K.world(...o.b);
    this.len = this.a.distanceTo(this.b);
    this.dir = this.b.clone().sub(this.a).normalize();
    this.axis = new THREE.Vector3().crossVectors(UP, this.dir).normalize();
    this.t = rt.logic.drumT(o.id);
    this.v = 0;   // m/s along the groove
    this.group = new THREE.Group();
    rt.root.add(this.group);
    this.spin = new THREE.Group();
    this.group.add(this.spin);
    this.spin.add(mesh([new THREE.SphereGeometry(this.r, 18, 12)], M.stoneMat));
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.35, flat: true });
    this.spin.add(mesh([T(new THREE.TorusGeometry(this.r * 1.005, 0.06, 4, 36), [0, 0, 0], [0, 0, 0]), T(new THREE.TorusGeometry(this.r * 1.005, 0.06, 4, 36), [0, 0, 0], [0, Math.PI / 2, 0])], this.glow));
    noCollide(this.group);
    this.center = V();
    this.solid = { pos: V(), r: this.r * 0.95, top: 0, bottom: 0, vel: V() };
    this.place();
    this.off = registerTarget({
      kind: 'ball', radius: this.r + 0.15, position: () => this.center,
      onHit: (mode, point, dir, info) => this.hit(mode, dir, info),
    });
    this.rest = true;
  }
  place() {
    this.group.position.copy(this.a).lerp(this.b, this.t);
    this.center.copy(this.group.position).addScaledVector(UP, this.r);
    this.spin.position.y = this.r;
    this.solid.pos.copy(this.group.position);
    this.solid.bottom = this.group.position.y; this.solid.top = this.group.position.y + this.r * 2;
  }
  hit(mode, dir, info = {}) {
    if (!dir) return false;
    const along = dir.x * this.dir.x + dir.z * this.dir.z;
    const k = mode === 'push' ? 4.2 + 4.5 * (info.strength ?? 1) : 1.2;   // m/s: a push rolls it a few metres, a splash nudges it
    if (Math.abs(along) < 0.25) { this.wobble = 0.4; return true; }
    this.v += Math.sign(along) * k * Math.min(1, Math.abs(along) + 0.3);
    this.rest = false;
    this.rt.sound?.critter?.('creak', 0.7);
    return true;
  }
  update(dt) {
    if (this.wobble) { this.wobble = Math.max(0, this.wobble - dt); this.spin.rotation.z = Math.sin(this.wobble * 30) * this.wobble * 0.1; }
    if (this.rest) { this.solid.vel.set(0, 0, 0); return; }
    // rolling friction, and a gentle settle into the plate's dip when it is slow and close
    const L = this.rt.logic, e = L.el(this.id), at = e?.plateAt ?? 1;
    const near = Math.abs(this.t - at) * this.len;
    if (Math.abs(this.v) < 1.2 && near < 1.6) this.v += Math.sign(at - this.t) * 3.5 * dt * Math.min(1, near);
    this.v *= Math.exp(-1.6 * dt);
    let t = this.t + (this.v * dt) / this.len;
    if (t <= 0 || t >= 1) { t = THREE.MathUtils.clamp(t, 0, 1); this.v = -this.v * 0.25; this.rt.sound?.critter?.('clack', 0.5); }
    const moved = (t - this.t) * this.len;
    this.t = t;
    this.spin.rotateOnWorldAxis(this.axis, moved / this.r);
    this.place();
    this.solid.vel.copy(this.dir).multiplyScalar(this.v);
    if (Math.abs(this.v) < 0.05 && (near < 0.05 || near > 1.6)) {
      this.v = 0; this.rest = true;
      if (L.moveDrum(this.id, this.t) && L.drumOn(this.id, e?.plate)) this.rt.sound?.chime?.();
    }
  }
  dispose() { this.off?.(); }
}

// ---------------------------------------------------------------------------------------- fire
export class Brazier {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id;
    const K = rt.kit, M = rt.M, s = o.scale ?? 1;
    this.pos = K.world(...o.at);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    rt.root.add(this.group);
    const bowl = lathe([[0.25, 0], [0.5, 0.15], [0.9, 0.55], [1.1, 0.95], [1.0, 1.0], [0.75, 0.62], [0.2, 0.55]].map(([r, y]) => [r * s, y * s + 1.1 * s]), 18);
    this.group.add(mesh([lathe([[0.7, 0], [0.7, 0.2], [0.35, 0.4], [0.3, 1.15], [0.5, 1.2]].map(([r, y]) => [r * s, y * s]), 14), bowl], M.trimMat));
    this.coals = own({ color: '#5a4a40', glow: 0, flat: true });
    this.group.add(mesh([T(new THREE.CylinderGeometry(0.75 * s, 0.6 * s, 0.12, 14), [0, 1.62 * s, 0])], this.coals));
    noCollide(this.group);
    this.top = 1.66 * s;
    this.center = this.pos.clone().addScaledVector(UP, 1.6 * s);
    this.off = registerTarget({
      kind: 'flammable', flammable: 'brazier', radius: 1.0 * s, accepts: ['fire'], position: () => this.center,
      onHit: (mode) => this.hit(mode),
    });
    if (rt.logic.isLit(o.id)) this.ignite(true);
  }
  hit(mode) {
    const L = this.rt.logic;
    if (L.isLit(this.id)) return true;
    if (mode !== 'fire') { this.rt.notice?.('The bowl is cold, and dry. It wants fire.', `cold.${this.id}`); return true; }
    if (L.light(this.id)) { this.ignite(false); this.rt.onLit?.(this.id); }
    return true;
  }
  ignite(instant) {
    if (this.flames) return;
    this.flames = new Flames(this.group, [{ at: V(0, this.top, 0), h: 1.6, r: 0.45 }, { at: V(0.25, this.top, 0.1), h: 1.1, r: 0.3, phase: 2 }, { at: V(-0.2, this.top, -0.15), h: 1.25, r: 0.3, phase: 4 }, { at: V(0, this.top, 0), h: 0.8, r: 0.2, core: 1, phase: 1 }], { seed: this.id.length * 3 });
    this.flames.mesh.userData.dynamic = true;   // (moved every frame: no levels of detail, src/lod.js)
    this.coals.uniforms.uColor.value.set('#e0644a'); this.coals.uniforms.uGlow.value = 0.8;
    this.light = new THREE.Vector4(this.pos.x, this.pos.y + this.top + 0.8, this.pos.z, 14);
    this.rt.lights.push(this.light);
    if (!instant) { this.rt.sound?.whoosh?.(); this.rt.sound?.chime?.(); }
  }
  update(dt, t) { this.flames?.update(dt, t); }
  dispose() { this.off?.(); }
}

export class Bramble {
  /** o: { id, at: [x, y, z] the opening's foot, yaw, w, h } */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id;
    const K = rt.kit, w = o.w ?? 4, h = o.h ?? 4;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    let s = (o.seed ?? 7) * 9301 + 49297;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const parts = [];
    for (let i = 0; i < 26; i++) {
      const pts = [];
      let x = (rnd() - 0.5) * w, y = rnd() * 0.4, z = (rnd() - 0.5) * 0.8;
      for (let j = 0; j < 6; j++) { pts.push(V(x, y, z)); x = THREE.MathUtils.clamp(x + (rnd() - 0.5) * 1.6, -w / 2, w / 2); y = Math.min(h, y + 0.3 + rnd() * 0.8); z = THREE.MathUtils.clamp(z + (rnd() - 0.5) * 0.7, -0.6, 0.6); }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.05 + rnd() * 0.04, 4));
    }
    this.mat = own({ color: '#9a7448', flat: true });
    this.tangle = mesh(parts, this.mat);
    this.group.add(this.tangle);
    noCollide(this.group);
    this.block = new THREE.Mesh(box(w, h, 1.2, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.center = this.group.position.clone().addScaledVector(UP, h * 0.45);
    this.burnt = rt.logic.isLit(o.id);
    this.k = this.burnt ? 1 : 0;
    this.tangle.visible = !this.burnt;
    this.off = registerTarget({ kind: 'flammable', flammable: 'bramble', radius: Math.max(w, h) * 0.45, accepts: ['fire'], position: () => this.center, enabled: () => !this.burnt, onHit: (mode) => this.hit(mode) });
    this.h = h; this.w = w;
    // thorns prick: push into them and they push you back off (you can't climb a tangle of wire)
    const inv = this.group.matrixWorld.clone(), _l = V();
    this.group.updateMatrixWorld(true); inv.copy(this.group.matrixWorld).invert();
    const back = V(0, 0, -1).applyQuaternion(this.group.getWorldQuaternion(new THREE.Quaternion()));
    this.offHazard = registerHazard({
      kind: 'spikes', dps: 0.04,
      test: (p) => { if (this.burnt) return false; _l.copy(p).applyMatrix4(inv); return Math.abs(_l.x) < w / 2 + 0.2 && _l.y > -1.6 && _l.y < h && Math.abs(_l.z) < 1.4; },
      push: (p, out) => out.copy(back),
    });
  }
  init(physics) { this.physics = physics; if (!this.burnt) this.handle = physics.addCollider?.(this.block) ?? null; }
  hit(mode) {
    if (this.burnt) return false;
    if (mode !== 'fire') { this.rt.notice?.('Dry thorns, as hard as wire. Fluid only beads on them.', 'thorns'); return true; }
    if (!this.rt.logic.light(this.id)) return true;
    this.rt.onLit?.(this.id);
    this.burnt = true; this.burning = 0;
    this.flames = new Flames(this.group, [-1, -0.3, 0.4, 1].map((f, i) => ({ at: V(f * this.w * 0.35, 0, 0), h: this.h * 0.8, r: 0.6, phase: i * 1.3 })), { seed: 11 });
    this.flames.mesh.userData.dynamic = true;
    this.rt.sound?.whoosh?.();
    if (this.handle) { this.physics?.removeCollider?.(this.handle); this.handle = null; }
    return true;
  }
  update(dt, t) {
    if (this.burning === undefined || !this.flames) return;
    this.burning += dt;
    this.flames.update(dt, t);
    this.flames.intensity = Math.max(0.2, 1.6 - this.burning * 0.6);
    const k = Math.min(1, this.burning / 2.2);
    this.tangle.scale.set(1, 1 - 0.9 * k, 1);
    this.mat.uniforms.uColor.value.set('#9a7448').lerp(new THREE.Color('#2f2830'), k);
    if (this.burning > 2.6) { this.flames.mesh.removeFromParent(); this.flames = null; this.tangle.visible = false; }
  }
  dispose() { this.off?.(); this.offHazard?.(); }
}

// ---------------------------------------------------------------------------------------- switches
export class Switch {
  /** o: { id, at, yaw (the way it faces), size }: a carved eye that a splash of fluid wakes */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id;
    const K = rt.kit, M = rt.M, s = o.size ?? 1.4;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.group.add(mesh([T(new THREE.CylinderGeometry(s, s, 0.4, 24), [0, 0, 0], [Math.PI / 2, 0, 0])], M.trimMat));
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.08, flat: true });
    this.group.add(mesh([T(new THREE.SphereGeometry(s * 0.55, 16, 10).scale(1, 0.6, 0.35), [0, 0, 0.2]), T(glyphGeometry(s * 1.3, 0.06), [0, 0, 0.24])], this.glow));
    noCollide(this.group);
    this.center = this.group.position.clone();
    this.on = rt.logic.isLit(o.id);
    this.hidden = !!o.hidden;
    const seen = () => !this.hidden || rt.logic.has(shownBy(o.hidden));
    this.off = registerTarget({ kind: 'switch', radius: s, position: () => this.center, enabled: seen, onHit: (mode) => this.hit(mode) });
    this.seen = seen;
  }
  /** A splash (any mode: it is fluid) wakes it. */
  hit() {
    if (this.rt.logic.light(this.id)) { this.on = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
    return true;
  }
  update(dt, t) {
    this.on ||= this.rt.logic.isLit(this.id);
    this.group.visible = this.seen();
    this.glow.uniforms.uGlow.value = this.on ? 0.8 + 0.2 * Math.sin(t * 2.5) : 0.08 + 0.05 * Math.sin(t * 1.3);
  }
  dispose() { this.off?.(); }
}

/**
 * A bank of eyes (o.eyes: [{ at, yaw }]) that wake only together: splash every one inside `window` seconds
 * of the first and the element `id` is lit for good; too slow, and they all go dark again. Four eyes and a
 * window shorter than the tank's refill: it wants the fourth chamber (src/items.js 'cell').
 */
export class Bank {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.window = o.window ?? 2.6;
    const K = rt.kit, M = rt.M, s = o.size ?? 0.9;
    this.eyes = o.eyes.map((e, i) => {
      const g = new THREE.Group();
      g.position.copy(K.world(...e.at));
      g.rotation.y = K.heading(e.yaw ?? 0);
      rt.root.add(g);
      g.add(mesh([T(new THREE.CylinderGeometry(s, s, 0.4, 20), [0, 0, 0], [Math.PI / 2, 0, 0])], M.trimMat));
      const glow = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.06, flat: true });
      g.add(mesh([T(new THREE.SphereGeometry(s * 0.55, 14, 8).scale(1, 1, 0.35), [0, 0, 0.2])], glow));
      noCollide(g);
      const eye = { g, glow, at: -1e9, center: g.position.clone() };
      eye.off = registerTarget({ kind: 'switch', radius: s, position: () => eye.center, onHit: () => this.hit(i) });
      return eye;
    });
    this.done = rt.logic.isLit(o.id);
    this.time = 0;
  }
  hit(i) {
    if (this.done) return true;
    const e = this.eyes[i];
    e.at = this.time;
    this.rt.sound?.critter?.('blip', 0.8);
    if (this.eyes.every((x) => this.time - x.at <= this.window)) {
      if (this.rt.logic.light(this.id)) { this.done = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
      else this.rt.notice?.('All four woke, and went dark again: the bank wants more than this tank can hold in one breath.', `bank.${this.id}`);
    }
    return true;
  }
  update(dt, t) {
    this.time += dt;
    this.done ||= this.rt.logic.isLit(this.id);
    for (const e of this.eyes) {
      const lit = this.done || this.time - e.at <= this.window;
      e.glow.uniforms.uGlow.value = lit ? (this.done ? 0.85 : 0.55 + 0.4 * Math.max(0, 1 - (this.time - e.at) / this.window)) : 0.06 + 0.04 * Math.sin(t * 1.5);
    }
  }
  dispose() { for (const e of this.eyes) e.off?.(); }
}

/** Bell-tuned: the bell-note whistle sounded within reach rings element `id` (a 'bell' element: needs the bell). */
export class BellEar {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.at = rt.kit.world(...o.at); this.reach = o.reach ?? 40;
    this.off = rt.game?.on?.('bell', ({ pos, soft } = {}) => {
      if (!pos || soft || pos.distanceTo(this.at) > this.reach) return;   // (soft: the listening shell's hum, not a bell)
      if (rt.logic.light(this.id)) { rt.sound?.chime?.(); rt.notice?.('The door answers the bell’s note.'); rt.onLit?.(this.id); }
    });
  }
  update() {}
  dispose() { this.off?.(); }
}

/**
 * Wakes to the lantern charm's light: stand by it (within `reach`) with the lantern a moment (`hold` s), and
 * element `id` (a 'switch' that needs the lantern) is lit for good. o: { id, at, reach, hold }
 */
export class LightEar {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.at = rt.kit.world(...o.at); this.reach = o.reach ?? 3.5; this.hold = o.hold ?? 1.5;
    this.t = 0;
    this.glow = own({ color: rt.P.lamp ?? '#f6c84e', glow: 0.05, flat: true });
    const m = mesh([T(new THREE.SphereGeometry(0.5, 14, 10), [0, 0, 0])], this.glow);
    m.position.copy(this.at).add(V(0, 2.8, 0));
    noCollide(m);
    rt.root.add(m);
    this.lit = rt.logic.isLit(o.id);
  }
  update(dt, t) {
    const P = this.rt.player, has = this.rt.logic.has('lantern');
    const near = P && has && P.pos.distanceTo(this.at) < this.reach;
    this.t = near ? this.t + dt : 0;
    if (!this.lit && this.t > this.hold && this.rt.logic.light(this.id)) { this.lit = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
    this.glow.uniforms.uGlow.value = this.lit ? 0.9 : near ? 0.2 + 0.7 * Math.min(1, this.t / this.hold) : 0.05 + 0.03 * Math.sin(t * 1.2);
  }
}

// ---------------------------------------------------------------------------------------- moving floors
export class Platform {
  /** o: { id?, path: [[x, y, z]...] (its top's centre), r, speed (m/s), pause (s at each end), when?: condition to move } */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M;
    this.path = o.path.map((p) => K.world(...p));
    this.r = o.r ?? 2.2;
    this.group = new THREE.Group();
    rt.root.add(this.group);
    const th = o.thick ?? 0.8;
    this.group.add(mesh([T(new THREE.CylinderGeometry(this.r, this.r * 0.85, th, 28), [0, -th / 2, 0])], M.floor));
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.5, flat: true });
    this.group.add(mesh([T(new THREE.TorusGeometry(this.r * 0.92, 0.07, 4, 40), [0, -th - 0.02, 0], [Math.PI / 2, 0, 0]), T(glyphGeometry(this.r * 0.9, 0.04).rotateX(-Math.PI / 2), [0, -th - 0.05, 0], [Math.PI, 0, 0])], this.glow));
    this.group.add(mesh([T(new THREE.TorusGeometry(this.r - 0.1, 0.12, 5, 40), [0, 0.02, 0], [Math.PI / 2, 0, 0])], M.trimMat));
    noCollide(this.group);
    this.solid = { pos: V(), r: this.r, top: 0, bottom: 0, vel: V() };
    // a closed path as a ping-pong: lengths of its legs
    this.legs = [];
    for (let i = 0; i < this.path.length - 1; i++) this.legs.push(this.path[i].distanceTo(this.path[i + 1]));
    this.total = this.legs.reduce((a, b) => a + b, 0);
    this.s = (o.phase ?? 0) * this.total; this.dirn = 1; this.wait = o.pause ?? 1.2;   // (phase: where along its path it starts, 0..1)
    this.prev = V();
    this.at(0, this.group.position);
    this.thick = th;
    this.place(0);
  }
  at(s, out) {
    let d = s;
    for (let i = 0; i < this.legs.length; i++) {
      if (d <= this.legs[i] || i === this.legs.length - 1) return out.copy(this.path[i]).lerp(this.path[i + 1], Math.min(1, d / this.legs[i]));
      d -= this.legs[i];
    }
    return out.copy(this.path[0]);
  }
  place(dt) {
    this.prev.copy(this.group.position);
    this.at(this.s, this.group.position);
    this.solid.pos.copy(this.group.position);
    this.solid.top = this.group.position.y; this.solid.bottom = this.group.position.y - this.thick - 0.4;
    if (dt > 0) this.solid.vel.subVectors(this.group.position, this.prev).divideScalar(dt);
  }
  update(dt, t) {
    const moving = !this.o.when || this.rt.logic.check(this.o.when);
    this.glow.uniforms.uGlow.value = moving ? 0.55 + 0.25 * Math.sin(t * 2) : 0.1;
    if (!moving) { this.solid.vel.set(0, 0, 0); return; }
    if (this.wait > 0) { this.wait -= dt; this.solid.vel.set(0, 0, 0); return; }
    // eased near the ends
    const sp = (this.o.speed ?? 2.4) * (0.35 + 0.65 * Math.min(1, Math.min(this.s, this.total - this.s) / 2.5));
    this.s += this.dirn * sp * dt;
    if (this.s >= this.total) { this.s = this.total; this.dirn = -1; this.wait = this.o.pause ?? 1.2; }
    if (this.s <= 0) { this.s = 0; this.dirn = 1; this.wait = this.o.pause ?? 1.2; }
    this.place(dt);
    // going down with someone on it: they go down with it (the player only keeps to a floor that isn't falling away)
    const P = this.rt.player;
    if (P && this.solid.vel.y < 0 && !P.climbing && Math.hypot(P.pos.x - this.solid.pos.x, P.pos.z - this.solid.pos.z) < this.r && Math.abs(P.pos.y - this.solid.top) < 0.4 && P.vel.y <= 0.5) P.vel.y = Math.min(P.vel.y, this.solid.vel.y);
  }
}

export class Bridge {
  /**
   * o: { id, a, b: [x, y, z] the walkway's ends (its top), w, n: stones, from: 'below' | 'above' }
   * from 'above': the stones hang high over the gap (they fell up), bobbing, and come down into place.
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id;
    const K = rt.kit, M = rt.M, w = o.w ?? 3.6, n = o.n ?? 7;
    const a = V(...o.a), b = V(...o.b), L = a.distanceTo(b), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    this.stones = [];
    this.root = new THREE.Group();
    rt.root.add(this.root);
    this.from = o.from ?? 'below';
    const blocks = [];
    for (let i = 0; i < n; i++) {
      const c = a.clone().lerp(b, (i + 0.5) / n);
      const g = new THREE.Group();
      g.position.copy(K.world(c.x, c.y, c.z));
      g.rotation.y = K.heading(yaw);
      g.add(mesh([box(w, 1.0, L / n - 0.08, 0, -0.5, 0), box(w + 0.3, 0.25, L / n - 0.05, 0, -1.05, 0)], o.hidden ? (this.ghost ??= own({ color: rt.P.glow ?? '#a8e6ee', glow: 0.45, flat: true })) : M.floor));
      g.add(mesh([T(glyphGeometry(w * 0.5, 0.04).rotateX(-Math.PI / 2), [0, 0.01, 0])], M.glyph));
      this.root.add(g);
      this.stones.push({ g, y: g.position.y, delay: i * 0.18 });
      const bl = new THREE.Mesh(box(w, 1.0, L / n, 0, -0.5, 0), new THREE.MeshBasicMaterial());
      bl.position.copy(g.position); bl.rotation.copy(g.rotation);
      blocks.push(bl);
    }
    this.block = new THREE.Group(); for (const bl of blocks) this.block.add(bl);
    noCollide(this.root);
    this.open = rt.logic.isOpen(o.id);
    this.k = this.open ? 1 : 0;
    this.time = this.open ? 99 : 0;
    this.apply();
  }
  init(physics) { this.physics = physics; if (this.open) this.handle = physics.addCollider?.(this.block) ?? null; }
  setOpen(open, instant = false) {
    if (open === this.open) return;
    this.open = open;
    this.time = instant ? 99 : 0;
    if (open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block) ?? null;
    if (!open && this.handle) { this.physics.removeCollider?.(this.handle); this.handle = null; }
    if (!instant) this.rt.rumble?.(2.2, 0.4);
  }
  apply(t = 0) {
    const above = this.from === 'above';
    for (const [i, s] of this.stones.entries()) {
      const k = this.open ? ease(THREE.MathUtils.clamp((this.time - s.delay) / (above ? 2.2 : 1.1), 0, 1)) : 0;
      if (above) {
        // hanging up there, each at its own height, bobbing; then down into the walkway
        const hang = 9 + (i % 3) * 1.6 + Math.sin(t * 0.6 + i * 1.7) * 0.5;
        s.g.position.y = s.y + (1 - k) * hang;
        s.g.rotation.z = (1 - k) * Math.sin(i * 2.3) * 0.25;
        s.g.visible = true;
      } else {
        s.g.position.y = s.y - (1 - k) * 14;
        s.g.visible = k > 0.001;
      }
    }
  }
  update(dt, t) {
    if (this.open && this.time < 6) { this.time += dt; this.apply(t); }
    else if (!this.open && this.from === 'above') this.apply(t);
  }
}

// ---------------------------------------------------------------------------------------- marks and pits
export class Mark {
  /** A checkpoint: a glyph stone. o: { room, at, yaw } */
  constructor(rt, o) {
    this.rt = rt; this.room = o.room;
    const K = rt.kit, M = rt.M;
    this.pos = K.world(...o.at);
    this.heading = K.heading(o.yaw ?? 0);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    rt.root.add(this.group);
    this.group.add(mesh([lathe([[0.55, 0], [0.55, 0.15], [0.42, 0.3], [0.38, 1.2], [0.5, 1.35], [0.02, 1.5]], 10)], M.trimMat));
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.1, flat: true });
    this.group.add(mesh([T(glyphGeometry(0.62, 0.05), [0, 0.85, 0.4])], this.glow));
    noCollide(this.group);
    this.spot = this.pos.clone().add(V(Math.sin(this.heading) * 1.6, 0.05, Math.cos(this.heading) * 1.6));
  }
  update(dt, t) {
    const p = this.rt.player;
    if (p && p.onGround && p.pos.distanceTo(this.pos) < 4 && this.rt.checkpoint?.room !== this.room) this.rt.setCheckpoint(this);
    const on = this.rt.checkpoint === this;
    this.glow.uniforms.uGlow.value = on ? 0.75 + 0.2 * Math.sin(t * 2) : 0.12;
  }
}

/** Fall below a chasm's lip and you are back at the room's mark. o: { room, min: [x, y, z], max } (local) */
export class Pit {
  constructor(rt, o) {
    this.rt = rt; this.room = o.room;
    this.box = new THREE.Box3(V(...o.min), V(...o.max));
  }
  contains(p) { return this.box.containsPoint(this.rt.kit.local(p)); }
}
