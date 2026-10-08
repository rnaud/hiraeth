import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerHazard } from '../hazards.js';
import { screened } from '../wind-screens.js';
import { registerWorking } from '../workings.js';
import { Flames } from '../story/flames.js';
import { glyphGeometry } from '../story/sign-text.js';
import { T, box, lathe, prep, annulus } from './kit.js';

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
//   Jaw      a gate of snapping jaws: a stilling glob stills them, and they rest open for good
//   Swing    a crystal pendulum over a bridge: it knocks you off; a stilling glob stops it a while
//   Updraft  a column of rising wind: it lifts the fluid wings, round and up, and lets you go at its top
//   Gust     gusts down a hall that shove you back unless you wait them out behind a screen
//   Seed     a husk in a stone ring that only a bloom glob wakes: it sprouts (a vine, a planter's flowers)
//   Bud      a flower-door: a great bud over a doorway that a bloom glob opens, petals folded back
//   Glass    a greenhouse pane too smooth to climb, until a vine has grown up it
//   EchoStone a singing stone: splash it and it sings its note (the echo shell catches it)
//   EchoEar  a horn that listens for its note played back close by (the echo shell)
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
//
// Swing, Updraft and Gust are also workings (src/workings.js): they register their volume as they are built and
// let go in dispose(), so a foe knocked into one, or flying through one, feels it as you do (src/foes.js
// Foe.feelWorld: docs/systems/foes.md, "Foes in the world's workings").

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
const PLATE_TOP = 0.17;   // m: a plate's disc top over the floor, up

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
    // stood on, not stood in: its disc's top is a floor for the feet (a moving solid, level.dynamic), as it sinks
    this.solid = { pos: this.pos, r: this.r, top: this.pos.y + PLATE_TOP, bottom: this.pos.y - 0.2, vel: V(), flat: true };
  }
  weighed(p) { return !!p && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < this.r + 0.2 && Math.abs(p.pos.y - this.pos.y) < 0.6 && (p.onGround || p.down); }
  update(dt) {
    const L = this.rt.logic, on = this.weighed(this.rt.player);
    if (on) { if (L.press(this.id, 'player')) this.rt.sound?.chime?.(); } else L.release(this.id, 'player');
    const down = L.pressed(this.id);
    this.k += ((down ? 1 : 0) - this.k) * Math.min(1, dt * 8);
    this.disc.position.y = -0.07 * this.k;
    this.solid.top = this.pos.y + PLATE_TOP + this.disc.position.y;
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
    // (round, src/carriers.js: its top a dome, where a disc at its crest had you stand on air at its sides)
    this.solid = {
      pos: V(), r: this.r, top: 0, bottom: 0, vel: V(),
      // (its two glowing bands stand 0.06 m proud of the stone: the dome a little over the stone, between them)
      // (out to 0.92 of its radius: past that it is too steep to stand on, and its faceted side parts from a true sphere)
      topAt: (x, z) => { const R = this.r + 0.03, d2 = (x - this.center.x) ** 2 + (z - this.center.z) ** 2; return d2 < (0.92 * R) ** 2 ? this.center.y + Math.sqrt(R * R - d2) : -Infinity; },
      pushOut: (p, rc) => {
        const dx = p.x - this.center.x, dz = p.z - this.center.z, d = Math.hypot(dx, dz), R = this.r + rc;
        // (beside it, below its crest by more than a step: out round it; higher up you stand on it)
        if (d >= R || d < 1e-4 || p.y > this.center.y + Math.sqrt(Math.max(0, this.r * this.r - Math.min(d, this.r) ** 2)) - 0.5) return false;
        p.x = this.center.x + (dx / d) * R; p.z = this.center.z + (dz / d) * R;
        return true;
      },
    };
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
    // (burning: the world's chemistry, src/chemistry.js, lets its fire reach the next bramble in the room)
    this.off = registerTarget({ kind: 'flammable', flammable: 'bramble', radius: Math.max(w, h) * 0.45, accepts: ['fire'], position: () => this.center, enabled: () => !this.burnt, burning: () => !!this.flames && this.burning < 2.2, onHit: (mode) => this.hit(mode) });
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
  /**
   * o: { id, at, yaw (the way it faces), size, crystal?: height, wrong?: text }: a carved eye that a splash of
   * fluid wakes. crystal: a singing crystal standing on the floor instead (its foot at `at`, this tall).
   * wrong: said when a splash does not wake it (it comes `after` another: logic.js).
   */
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, s = o.size ?? 1.4;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.glow = own({ color: rt.P.glow ?? '#70e7df', glow: 0.08, flat: true });
    if (o.crystal) {
      // a crystal of the swamp's groves on a ring of stone: it rings when it wakes
      const h = o.crystal;
      this.group.add(mesh([lathe([[s * 1.3, 0], [s * 1.3, 0.35], [s * 1.0, 0.5], [0.01, 0.5]], 12)], M.trimMat));
      this.group.add(mesh([T(new THREE.OctahedronGeometry(1, 0), [0, 0.5 + h / 2, 0], [0, 0.4, 0], [s * 0.7, h / 2, s * 0.7]), T(new THREE.OctahedronGeometry(1, 0), [s * 0.55, 0.5 + h * 0.25, 0.1], [0, 0, -0.35], [s * 0.35, h * 0.24, s * 0.35])], this.glow));
      this.center = this.group.position.clone().add(V(0, 0.5 + h / 2, 0));
    } else {
      this.group.add(mesh([T(new THREE.CylinderGeometry(s, s, 0.4, 24), [0, 0, 0], [Math.PI / 2, 0, 0])], M.trimMat));
      this.group.add(mesh([T(new THREE.SphereGeometry(s * 0.55, 16, 10).scale(1, 0.6, 0.35), [0, 0, 0.2]), T(glyphGeometry(s * 1.3, 0.06), [0, 0, 0.24])], this.glow));
      this.center = this.group.position.clone();
    }
    noCollide(this.group);
    this.on = rt.logic.isLit(o.id);
    this.hidden = !!o.hidden;
    const seen = () => !this.hidden || rt.logic.has(shownBy(o.hidden));
    this.off = registerTarget({ kind: 'switch', radius: o.crystal ? Math.max(s, o.crystal * 0.45) : s, position: () => this.center, enabled: seen, onHit: (mode) => this.hit(mode) });
    this.seen = seen;
    this.flash = 0;
  }
  /** A splash (any mode: it is fluid) wakes it. */
  hit() {
    if (this.rt.logic.light(this.id)) { this.on = true; this.rt.sound?.chime?.(); this.rt.onLit?.(this.id); }
    else if (!this.on && this.o.wrong) { this.flash = 0.6; this.rt.sound?.critter?.('blip', 0.5); this.rt.notice?.(this.o.wrong, `wrong.${this.id}`); }
    return true;
  }
  update(dt, t) {
    this.on ||= this.rt.logic.isLit(this.id);
    this.group.visible = this.seen();
    this.flash = Math.max(0, this.flash - dt);
    this.glow.uniforms.uGlow.value = this.on ? 0.8 + 0.2 * Math.sin(t * 2.5) : 0.08 + 0.05 * Math.sin(t * 1.3) + this.flash * 0.6;
  }
  dispose() { this.off?.(); }
}

/**
 * A bank of eyes (o.eyes: [{ at, yaw }]) that wake only together: splash every one inside `window` seconds
 * of the first and the element `id` is lit for good; too slow, and they all go dark again. Four eyes and a
 * window shorter than the tank's refill: it wants the fourth chamber (src/items.js 'cell'). Six eyes and a
 * window a little longer than one refill: it wants the quick coil ('coil': two tanks in one breath).
 * o.full: said when every eye woke but the element's item is missing; o.fade: said once when some woke and
 * all went dark again before the rest.
 */
export class Bank {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o; this.window = o.window ?? 2.6;
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
      else this.rt.notice?.(this.o.full ?? 'All four woke, and went dark again: the bank wants more than this tank can hold in one breath.', `bank.${this.id}`);
    }
    return true;
  }
  /** How many eyes are awake now (inside the window). */
  awake() { return this.eyes.filter((x) => this.time - x.at <= this.window).length; }
  update(dt, t) {
    this.time += dt;
    this.done ||= this.rt.logic.isLit(this.id);
    // some woke, and all went dark again before the rest: say why, once
    const n = this.done ? 0 : this.awake();
    if (this.o.fade && this.was >= 2 && n === 0) this.rt.notice?.(this.o.fade, `bank.fade.${this.id}`);
    this.was = n;
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

// ---------------------------------------------------------------------------------------- living gates
const _frost = new THREE.Color('#d6f0fa');

/**
 * A gate of jaws (Lorn's Hush): two great leaves with teeth, hinged at a doorway's jambs, that snap shut
 * and half open, shut and half open, never wide enough to pass, and bite whoever tries. A stilling glob
 * (the 'stun' mode) stills them: element `still` (a 'switch' that needs the stilling mode) is lit, and
 * the door `id` (which opens on it) eases them wide, for good. Solid while shut.
 * o: { id (the door), still, at: the doorway's foot, yaw, w, h, seed }
 */
export class Jaw {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.still = o.still; this.o = o;
    const K = rt.kit, w = o.w ?? 5, h = o.h ?? 6.2;
    this.w = w; this.h = h;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.skin = own({ color: '#c94f6a', flat: true });
    const lip = own({ color: '#ee93a2', flat: true }), throat = own({ color: '#93304a', flat: true }), tooth = own({ color: '#f3ead8', flat: true });
    this.halves = [-1, 1].map((side) => {
      const g = new THREE.Group();
      g.position.set(side * w / 2, 0, 0);
      const cx = -side * w / 4;
      g.add(mesh([new THREE.SphereGeometry(1, 16, 10).scale(w / 4 + 0.15, h / 2, 0.75).translate(cx, h / 2, 0)], this.skin));
      // the inner edge (where the two meet): pale lips, dark gums, a row of teeth
      const edge = -side * (w / 2 - 0.1);
      g.add(mesh([new THREE.SphereGeometry(1, 12, 8).scale(0.7, h / 2 - 0.45, 0.82).translate(edge + side * 0.45, h / 2, 0)], throat));
      g.add(mesh([new THREE.SphereGeometry(1, 12, 8).scale(0.3, h / 2 - 0.2, 0.9).translate(edge + side * 0.1, h / 2, 0)], lip));
      const teeth = [];
      for (let i = 0; i < 9; i++) { const y = 0.7 + (i / 8) * (h - 1.4); teeth.push(T(new THREE.ConeGeometry(0.16, 0.7, 6), [edge, y, i % 2 ? 0.25 : -0.25], [0, 0, side * Math.PI / 2])); }
      g.add(mesh(teeth, tooth));
      this.group.add(g);
      return { g, side };
    });
    noCollide(this.group);
    // Collision while shut: each half as drawn, a moving collider that snaps with it (physics.addMover; synced
    // each frame), and a thin still slot down the middle, inside the lips when they meet, that keeps the way
    // when they gape (never wide enough to pass). A box the size of the doorway stood in for both: the
    // halves' round sides lay up to 0.75 m inside it. Open (stilled), they are walk-through as before: laid
    // back against the jambs they would narrow the way on and stand over the next room's mark.
    this.block = new THREE.Mesh(box(w * 0.42, h - 1, 0.12, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.center = this.group.position.clone().addScaledVector(UP, h * 0.5);
    this.open = rt.logic.isOpen(o.id);
    this.k = this.open ? 1 : 0;   // 0 snapping, 1 wide open
    this.frost = 0; this.snapT = (o.seed ?? 0) * 0.37; this.ang = 0; this.angry = 0;
    this.off = registerTarget({ kind: 'jaws', radius: Math.max(w, h) * 0.45, accepts: ['stun'], position: () => this.center, enabled: () => !this.open, onHit: (mode) => this.hit(mode) });
    this.group.updateMatrixWorld(true);
    const inv = this.group.matrixWorld.clone().invert(), _l = V(), _o = V();
    this.offHazard = registerHazard({
      kind: 'spikes', dps: 0.05,
      test: (p) => { if (this.open) return false; _l.copy(p).applyMatrix4(inv); return Math.abs(_l.x) < w / 2 && _l.y > -1.6 && _l.y < h && Math.abs(_l.z) < 1.5; },
      push: (p, out) => { _l.copy(p).applyMatrix4(inv); return out.copy(_o.set(0, 0, Math.sign(_l.z) || -1).transformDirection(this.group.matrixWorld)); },
    });
  }
  init(physics) { this.physics = physics; if (!this.open) this.solidify(); }
  /** The halves (as they stand: shut, until the frame syncs them) and the slot, as colliders. */
  solidify() {
    const P = this.physics;
    if (!this.open) for (const { g, side } of this.halves) g.rotation.y = side * 0.12;   // (shut: where a snap starts)
    this.movers = P.addMover ? this.halves.map(({ g }) => P.addMover(g, { all: true })).filter(Boolean) : [];
    this.handle = P.addCollider?.(this.block) ?? null;
  }
  hit(mode) {
    if (this.open) return false;
    if (mode === 'stun') {
      if (this.rt.logic.light(this.still)) { this.frost = 1; this.rt.sound?.chime?.(); this.rt.onLit?.(this.still); this.rt.notice?.(this.o.stilled ?? 'The jaws stop dead, frosted, and ease open. They forget to close.', `stilled.${this.id}`); }
      return true;
    }
    if (mode === 'push') { this.angry = 0.6; return true; }
    this.angry = 1.2;
    this.rt.sound?.critter?.('snap', 0.8);
    this.rt.notice?.(this.o.snaps ?? 'The jaws snap at the splash, and snap, and snap. Something colder might still them.', 'jaws.snap');
    return true;
  }
  setOpen(open, instant = false) {
    if (open === this.open) return;
    this.open = open;
    if (open && this.handle) {
      this.physics?.removeCollider?.(this.handle); this.handle = null;
      for (const m of this.movers ?? []) this.physics?.removeCollider?.(m);
      this.movers = [];
    }
    if (!open && this.physics && !this.handle) this.solidify();
    if (instant) this.k = open ? 1 : 0;
    else this.rt.rumble?.(1.2, 0.3);
  }
  update(dt) {
    this.angry = Math.max(0, this.angry - dt);
    this.frost = Math.max(0, this.frost - dt * 0.25);
    if (this.open) this.k = Math.min(1, this.k + dt / 2.4);
    // shut and half open, shut and half open (quicker when splashed): the opening slow, the snap fast
    this.snapT += dt * (this.angry ? 1.8 : 0.85);
    const ph = this.snapT % 1, snap = ph < 0.75 ? ease(ph / 0.75) : 1 - (ph - 0.75) / 0.25;
    const half = 0.12 + 0.38 * snap, k = ease(this.k);
    this.ang = this.open ? half * (1 - k) + 1.45 * k : half;
    for (const { g, side } of this.halves) g.rotation.y = side * this.ang;
    this.skin.uniforms.uColor.value.set('#c94f6a').lerp(_frost, Math.min(1, this.frost * 1.4));
  }
  dispose() { this.off?.(); this.offHazard?.(); for (const m of this.movers ?? []) this.physics?.removeCollider?.(m); }
}

/**
 * A pendulum of crystal (Lorn's Hush): it hangs from a pivot high over a bridge and swings across it
 * (along the local x), and knocks whoever it meets off into the chasm. A stilling glob stops it dead
 * for `stillFor` seconds. o: { at: the pivot, len, amp (rad), period (s), phase (0..1), yaw }
 */
export class Swing {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit, len = this.len = o.len ?? 10;
    this.amp = o.amp ?? 0.9; this.period = o.period ?? 2.8; this.s = (o.phase ?? 0) * this.period; this.stillFor = o.stillFor ?? 6;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.arm = new THREE.Group();
    this.group.add(this.arm);
    this.arm.add(mesh([box(0.18, len - 1.6, 0.18, 0, -(len - 1.6) / 2, 0), new THREE.TorusGeometry(0.45, 0.12, 5, 14)], rt.M.trimMat));
    this.mat = own({ color: rt.P.glow ?? '#a8e6ee', glow: 0.3, flat: true });
    this.arm.add(mesh([T(new THREE.OctahedronGeometry(1, 0), [0, -len, 0], [0, 0.6, 0], [1.5, 2.1, 1.5]), T(new THREE.OctahedronGeometry(1, 0), [0.9, -len + 0.6, 0.3], [0, 0, 0.5], [0.6, 1.0, 0.6])], this.mat));
    noCollide(this.group);
    this.center = V(); this.still = 0; this.cool = 0; this.theta = 0; this.way = 1;
    this.place();
    this.off = registerTarget({ kind: 'swing', radius: 1.9, accepts: ['stun'], position: () => this.center, onHit: (mode) => this.hit(mode) });
    // a working (src/workings.js): what it meets, a foe too, it knocks away the way it swings
    this.working = { kind: 'swing', center: this.center, radius: 1.9,
      contains: (p) => (p.x - this.center.x) ** 2 + (p.z - this.center.z) ** 2 < 1.9 * 1.9 && Math.abs(p.y + 0.9 - this.center.y) < 2.6,
      moving: () => this.still <= 0,
      push: (p, out) => out.set(this.way, 0, 0).transformDirection(this.group.matrixWorld) };
    this.offWorking = registerWorking(this.working);
  }
  hit(mode) {
    if (mode === 'stun') {
      if (!this.still) this.rt.sound?.chime?.();
      this.still = this.stillFor;
      this.rt.notice?.(this.o.stilled ?? 'The crystal stops dead mid-swing, frosted over, and hangs there humming.', 'swing.still');
      return true;
    }
    this.rt.notice?.(this.o.rings ?? 'The crystal rings under the splash, and swings on.', 'swing.ring');
    return true;
  }
  place() {
    this.arm.rotation.z = this.theta;
    this.group.updateMatrixWorld(true);
    this.center.set(0, -this.len, 0).applyMatrix4(this.arm.matrixWorld);
  }
  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    const was = this.theta;
    if (this.still > 0) this.still = Math.max(0, this.still - dt);
    else this.s += dt;
    this.theta = this.amp * Math.sin((this.s / this.period) * Math.PI * 2);
    if (this.theta !== was) this.way = Math.sign(this.theta - was);   // (the way it swings: the way it knocks)
    this.place();
    const k = this.still > 0 ? Math.min(1, this.still) : 0;
    this.mat.uniforms.uColor.value.set(this.rt.P.glow ?? '#a8e6ee').lerp(_frost, k);
    this.mat.uniforms.uGlow.value = 0.3 + 0.5 * k;
    // it meets you: off the bridge, the way it was swinging
    const P = this.rt.player;
    if (!P || P.dead || P.down || this.still > 0 || this.cool > 0) return;
    const dx = P.pos.x - this.center.x, dy = P.pos.y + 0.9 - this.center.y, dz = P.pos.z - this.center.z;
    if (dx * dx + dz * dz < 1.9 * 1.9 && Math.abs(dy) < 2.6) {
      this.cool = 1.5;
      const out = V(this.way, 0, 0).transformDirection(this.group.matrixWorld).multiplyScalar(9).addScaledVector(UP, 4);
      P.knockDown?.(out, { why: 'guardian' });
      P.hurt?.(Math.min(0.12, Math.max(0, (P.health ?? 1) - 0.1)), 'guardian');
      this.rt.rumble?.(0.4, 0.4);
    }
  }
  dispose() { this.off?.(); this.offWorking?.(); }
}

// ---------------------------------------------------------------------------------------- wind
/**
 * A column of rising wind (Vael's Aerie): pale rings drift up it. It catches the fluid wings: gliding in it
 * you are lifted, held near its middle, slowed, until near its top it lets you go (you fly out the way you
 * face). Without the wings it only ruffles you. o: { at: its foot (the floor's middle), r, h, lift }
 */
export class Updraft {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit;
    this.r = o.r ?? 4.5; this.h = o.h ?? 22; this.lift = o.lift ?? 7;
    this.foot = K.world(...o.at);
    this.root = new THREE.Group();
    rt.root.add(this.root);
    this.mat = own({ color: '#f4f8f6', glow: 0.35, flat: true });
    this.rings = [];
    const N = Math.max(6, Math.round(this.h / 2.4));
    const g = new THREE.TorusGeometry(this.r * 0.75, 0.07, 4, 32).rotateX(Math.PI / 2);
    for (let i = 0; i < N; i++) { const m = new THREE.Mesh(g, this.mat); this.root.add(m); this.rings.push({ m, s: i / N, w: 0.6 + (i % 3) * 0.2 }); }
    const stone = mesh([T(annulus(this.r - 0.3, this.r + 0.4, 0.25, 36), [0, 0.12, 0])], rt.M.trimMat);
    stone.position.copy(this.foot);
    this.root.add(stone);
    noCollide(this.root);
    this.rideT = 0;
    // a working (src/workings.js): it throws a foe up out of it, or tumbles a flying one
    this.offWorking = registerWorking({ kind: 'updraft', contains: (p) => this.contains(p), foot: this.foot, r: this.r, top: this.foot.y + this.h, lift: this.lift });
  }
  dispose() { this.offWorking?.(); }
  /** Is p (feet) in the column? */
  contains(p) { return Math.hypot(p.x - this.foot.x, p.z - this.foot.z) < this.r && p.y > this.foot.y - 1 && p.y < this.foot.y + this.h; }
  update(dt, t) {
    for (const r of this.rings) {
      r.s = (r.s + dt * 0.09) % 1;
      r.m.position.set(this.foot.x, this.foot.y + 0.5 + r.s * this.h, this.foot.z);
      const fade = Math.min(1, r.s * 8, (1 - r.s) * 6);
      r.m.scale.setScalar(Math.max(0.01, fade * (r.w + 0.08 * Math.sin(t * 2 + r.s * 20))));
      r.m.rotation.y = t * 0.4 + r.s * 3;
    }
    this.mat.uniforms.uGlow.value = 0.3 + 0.1 * Math.sin(t * 1.7);
    const P = this.rt.player;
    if (!P || P.dead || P.down || !this.contains(P.pos)) { this.rideT = 0; return; }
    if (!P.gliding) {
      if (!P.onGround && P.vel.y < 0) this.rt.notice?.(this.o.hint ?? 'The wind rushes up past you. Open your wings in it.', 'updraft.hint');
      return;
    }
    // the wings catch it: up, near its middle, slowly; at its top it eases, and lets you go
    const top = this.foot.y + this.h, k = THREE.MathUtils.clamp((top - P.pos.y) / 3, 0, 1);
    const want = this.lift * k;
    P.vel.y = Math.max(P.vel.y, want * 0.5) + (want - P.vel.y) * Math.min(1, dt * 3);
    if (k > 0.5) {
      P.glideSpeed = Math.min(P.glideSpeed ?? 1.5, 1.5);
      const c = Math.min(1, dt * 1.5);
      P.pos.x += (this.foot.x - P.pos.x) * c; P.pos.z += (this.foot.z - P.pos.z) * c;
    }
    if ((this.rideT += dt) > 0.4) this.rt.notice?.(this.o.ride ?? 'The wind fills your wings and lifts you, round and up.', 'updraft.ride');
  }
}

/**
 * Gusts down a hall (Vael's Aerie): calm a while, then a warning (pale streaks start), then the wind blows
 * along `dir` (local) and shoves whoever stands in the open back along it. Behind a screen (a `shelter`
 * box) it can't reach you. o: { min, max: the hall (local), dir: [x, 0, z], shelters: [[min, max]], calm, blow, push }
 */
export class Gust {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit;
    this.box = new THREE.Box3(V(...o.min), V(...o.max));
    this.shelters = (o.shelters ?? []).map(([a, b]) => new THREE.Box3(V(...a), V(...b)));
    this.dirL = V(...(o.dir ?? [0, 0, -1])).normalize();
    this.dirW = this.dirL.clone().applyAxisAngle(UP, K.yaw);
    this.calm = o.calm ?? 2.6; this.blow = o.blow ?? 2.4; this.warn = o.warn ?? 0.7; this.push = o.push ?? 7.5;
    this.t = o.phase ?? 0;
    // the streaks: thin pale bars that race down the hall while it blows
    this.mat = own({ color: '#fbf7ee', glow: 0.4, flat: true });
    this.streaks = [];
    const size = this.box.getSize(V());
    const g = new THREE.BoxGeometry(0.06, 0.06, 3.2);
    let s = 77;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.root = new THREE.Group();
    this.root.position.copy(K.world(0, 0, 0)); this.root.rotation.y = K.yaw;
    rt.root.add(this.root);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(g, this.mat);
      this.root.add(m);
      this.streaks.push({ m, x: this.box.min.x + rnd() * size.x, y: this.box.min.y + 0.4 + rnd() * Math.min(size.y, 8), u: rnd(), v: 0.8 + rnd() * 0.6 });
    }
    noCollide(this.root);
    this.size = size;
    // a working (src/workings.js): while it blows it shoves any foe in the open down the hall
    this.working = { kind: 'gust', dir: this.dirW, push: this.push,
      contains: (p) => this.box.containsPoint(rt.kit.local(p)),
      blowing: () => this.state === 1,
      sheltered: (p) => this.sheltered(rt.kit.local(p)) || screened(p, this.dirW) };
    this.offWorking = registerWorking(this.working);
  }
  dispose() { this.offWorking?.(); }
  /** 0 calm, a warning ramp, 1 blowing. */
  get state() {
    const c = this.t % (this.calm + this.blow);
    if (c < this.calm - this.warn) return 0;
    if (c < this.calm) return 0.5;
    return 1;
  }
  sheltered(l) { return this.shelters.some((b) => b.containsPoint(l)); }
  update(dt) {
    this.t += dt;
    const st = this.state;
    // the streaks: along the hall, from its far end to its near
    const len = this.size.z;
    for (const s of this.streaks) {
      s.u = (s.u + dt * (st === 1 ? 0.9 : 0.3) * s.v) % 1;
      const z = this.dirL.z < 0 ? this.box.max.z - s.u * len : this.box.min.z + s.u * len;
      s.m.position.set(s.x, s.y, z);
      s.m.visible = st > 0 && !(st === 0.5 && s.v > 1.1);
    }
    this.mat.uniforms.uGlow.value = st === 1 ? 0.6 : 0.35;
    const P = this.rt.player;
    if (!P || P.dead || st < 1) return;
    const l = this.rt.kit.local(P.pos);
    if (!this.box.containsPoint(l) || this.sheltered(l) || screened(P.pos, this.dirW)) return;   // (or behind a wall drawn in ink: src/wind-screens.js)
    // shoved back down the hall (your own legs win a little of it back)
    P.vel.x = this.dirW.x * this.push; P.vel.z = this.dirW.z * this.push;
    if (P.climbing) P.climbing = false;
    this.rt.notice?.(this.o.notice ?? 'The gust shoves you back down the hall. Wait it out behind a screen.', 'gust');
  }
}

// ---------------------------------------------------------------------------------------- bloom (Viridel)
const BLOOMS = ['#f2a7b8', '#f6d36a', '#ffffff', '#b7a0cf', '#ef7e62'];

/**
 * A seed of the makers in a stone ring (Viridel's Greenhouse): a dry husk that only a bloom glob (the 'bloom'
 * mode) wakes. It sprouts and flowers, and element `id` (a 'switch' that needs the bloom mode) is lit for
 * good: what it grows (a vine bridge, a vine up a glass wall, a planter's flowers) is the logic's to show.
 * Plain fluid only soaks it. o: { id, at (its foot), yaw, size, seed, drink, burn }
 */
export class Seed {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, s = this.s = o.size ?? 1;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    // the ring of stone, the dark earth in it, the husk
    this.group.add(mesh([lathe([[1.3 * s, 0], [1.35 * s, 0.5 * s], [1.1 * s, 0.6 * s], [1.0 * s, 0.4 * s], [0.01, 0.4 * s]], 16)], M.trimMat));
    this.husk = own({ color: '#9a7448', flat: true });
    this.huskMesh = mesh([T(new THREE.SphereGeometry(0.45 * s, 10, 8).scale(1, 1.3, 1), [0, 0.75 * s, 0]), T(new THREE.ConeGeometry(0.12 * s, 0.6 * s, 6), [0, 1.35 * s, 0])], this.husk);
    this.group.add(this.huskMesh);
    // what grows: a stem, leaves, a head of flowers (scaled up from nothing)
    this.sprout = new THREE.Group();
    this.sprout.position.y = 0.45 * s;
    const stem = own({ color: '#4f8a5a', flat: true }), leaf = own({ color: '#7fcf72', flat: true }), petals = own({ color: BLOOMS[(o.seed ?? 0) % BLOOMS.length], glow: 0.2, flat: true });
    const lv = [];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; lv.push(T(new THREE.SphereGeometry(1, 8, 5).scale(0.55 * s, 0.1 * s, 0.25 * s).translate(0.55 * s, 0, 0), [0, (0.5 + i * 0.35) * s, 0], [0, a, 0.35])); }
    this.sprout.add(mesh([T(new THREE.CylinderGeometry(0.07 * s, 0.11 * s, 2.2 * s, 6), [0, 1.1 * s, 0])], stem), mesh(lv, leaf));
    const ph = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ph.push(T(new THREE.SphereGeometry(1, 8, 5).scale(0.35 * s, 0.08 * s, 0.2 * s).translate(0.32 * s, 0, 0), [0, 2.25 * s, 0], [0, a, -0.4])); }
    ph.push(T(new THREE.SphereGeometry(0.16 * s, 8, 6), [0, 2.28 * s, 0]));
    this.sprout.add(mesh(ph, petals));
    this.group.add(this.sprout);
    noCollide(this.group);
    this.center = this.group.position.clone().addScaledVector(UP, 0.9 * s);
    this.on = rt.logic.isLit(o.id);
    this.k = this.on ? 1 : 0;
    this.apply();
    this.off = registerTarget({ kind: 'seed', radius: 1.1 * s, accepts: ['bloom', 'fire'], position: () => this.center, enabled: () => !this.on, onHit: (mode) => this.hit(mode) });
  }
  hit(mode) {
    if (this.on) return false;
    if (mode === 'bloom') {
      if (this.rt.logic.light(this.id)) { this.on = true; this.rt.sound?.chime?.(); this.rt.sound?.whoosh?.(); this.rt.onLit?.(this.id); }
      return true;
    }
    if (mode === 'fire') { this.rt.notice?.(this.o.burn ?? 'The husk only blackens at the edges. A seed wants to grow, not to burn.', 'seed.burn'); return true; }
    this.wobble = 0.5;
    this.rt.notice?.(this.o.drink ?? 'The husk soaks up the water, and stays a seed. Something in it is waiting to be told to grow.', 'seed.drink');
    return true;
  }
  apply() {
    const k = ease(this.k);
    this.sprout.scale.setScalar(Math.max(0.001, k));
    this.sprout.visible = k > 0.002;
    this.huskMesh.scale.setScalar(1 - 0.6 * k);
  }
  update(dt, t) {
    this.on ||= this.rt.logic.isLit(this.id);
    if (this.on && this.k < 1) { this.k = Math.min(1, this.k + dt / 1.4); this.apply(); }
    if (this.wobble) { this.wobble = Math.max(0, this.wobble - dt); this.huskMesh.rotation.z = Math.sin(this.wobble * 28) * this.wobble * 0.3; }
    if (this.on) this.sprout.rotation.z = Math.sin(t * 1.3 + (this.o.seed ?? 0)) * 0.04;
  }
  dispose() { this.off?.(); }
}

/**
 * A flower-door (Viridel's Greenhouse): a doorway shut by a great bud, its petals hinged round the rim and
 * folded in over the opening. A bloom glob opens it: element `bloom` (a 'switch' that needs the bloom mode)
 * is lit, and the door `id` (which opens on it) folds its petals back against the wall, for good. Plain fluid
 * only beads on it, fire makes it curl tighter. Solid while shut. o: { id, bloom, at (the doorway's foot), yaw, w, h, color }
 */
export class Bud {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.bloom = o.bloom; this.o = o;
    const K = rt.kit, w = o.w ?? 5, h = o.h ?? 6.4;
    this.w = w; this.h = h;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.skin = own({ color: o.color ?? '#f6c7d0', flat: true });
    const vein = own({ color: '#e58aa0', flat: true }), sepal = own({ color: '#5f9a52', flat: true });
    // seven petals on an oval rim round the doorway's middle, each pointing in at the middle
    const cy = h / 2, rx = w / 2 + 0.1, ry = h / 2 + 0.1;
    this.petals = [];
    const N = 7;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.PI / 2;
      const hinge = new THREE.Group();
      hinge.position.set(Math.cos(a) * rx, cy + Math.sin(a) * ry, 0);
      hinge.rotation.z = a - Math.PI / 2;   // its local -y points in at the middle
      const reach = Math.hypot(Math.cos(a) * rx, Math.sin(a) * ry) * 1.08;
      const p = new THREE.Group();
      hinge.add(p);
      p.add(mesh([new THREE.SphereGeometry(1, 12, 8).scale(Math.min(2.4, reach * 0.62), reach / 2, 0.32).translate(0, -reach / 2, (i % 2 ? 0.12 : -0.12))], this.skin));
      p.add(mesh([box(0.12, reach * 0.8, 0.7, 0, -reach * 0.45, 0)], vein));
      this.group.add(hinge);
      this.petals.push({ hinge, p, i });
    }
    // green sepals round the rim (they stay)
    const sp = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; sp.push(T(new THREE.ConeGeometry(0.35, 1.3, 5), [Math.cos(a) * (rx + 0.3), cy + Math.sin(a) * (ry + 0.3), 0], [0, 0, a - Math.PI / 2])); }
    this.group.add(mesh(sp, sepal));
    noCollide(this.group);
    this.block = new THREE.Mesh(box(w, h, 1.6, 0, h / 2, 0), new THREE.MeshBasicMaterial());
    this.block.position.copy(this.group.position); this.block.rotation.copy(this.group.rotation);
    this.center = this.group.position.clone().addScaledVector(UP, h * 0.5);
    this.open = rt.logic.isOpen(o.id);
    this.k = this.open ? 1 : 0; this.curl = 0;
    this.off = registerTarget({ kind: 'bud', radius: Math.max(w, h) * 0.45, accepts: ['bloom', 'fire'], position: () => this.center, enabled: () => !this.open, onHit: (mode) => this.hit(mode) });
    this.apply(0);
  }
  init(physics) { this.physics = physics; if (!this.open) this.handle = physics.addCollider?.(this.block) ?? null; }
  hit(mode) {
    if (this.open) return false;
    if (mode === 'bloom') {
      if (this.rt.logic.light(this.bloom)) { this.rt.sound?.chime?.(); this.rt.onLit?.(this.bloom); this.rt.notice?.(this.o.opened ?? 'The bud swells, and splits, and its petals fold back against the wall like a hand opening.', `bud.${this.id}`); }
      return true;
    }
    if (mode === 'fire') { this.curl = 1.5; this.rt.notice?.(this.o.burnt ?? 'The petals curl away from the ember and close tighter.', 'bud.fire'); return true; }
    this.curl = 0.4;
    this.rt.notice?.(this.o.wet ?? 'The water beads on the petals and runs off. The bud stays shut: it is waiting to be told to grow.', 'bud.wet');
    return true;
  }
  setOpen(open, instant = false) {
    if (open === this.open) return;
    this.open = open;
    if (open && this.handle) { this.physics?.removeCollider?.(this.handle); this.handle = null; }
    if (!open && this.physics && !this.handle) this.handle = this.physics.addCollider?.(this.block) ?? null;
    if (instant) this.k = open ? 1 : 0;
    else this.rt.rumble?.(1.0, 0.25);
  }
  apply(t) {
    const k = ease(this.k), c = Math.min(1, this.curl);
    for (const { p, i } of this.petals) {
      // shut: folded in over the doorway (a little breathing); open: swung out and back against the wall
      p.rotation.x = (1 - k) * (0.05 * Math.sin(t * 1.2 + i) - c * 0.12) - k * 1.75 * (i % 2 ? 1 : -1);
      p.scale.setScalar(1 - 0.08 * c);
    }
  }
  update(dt, t) {
    this.curl = Math.max(0, this.curl - dt);
    if (this.open && this.k < 1) this.k = Math.min(1, this.k + dt / 2.2);
    if (!this.open && this.k > 0) this.k = Math.max(0, this.k - dt / 0.9);   // (held shut behind you: an arena's door)
    this.apply(t);
  }
  dispose() { this.off?.(); }
}

/**
 * A pane of greenhouse glass over a wall (Viridel): too smooth to climb (you slip off it) until a vine has
 * grown up it, which happens when `when` holds (a seed at its foot, bloomed). o: { at (the foot's middle,
 * local, on the wall's face), yaw (facing out of the wall), w, h, when: condition, slip: text }
 */
export class Glass {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    const K = rt.kit, w = this.w = o.w ?? 8, h = this.h = o.h ?? 10;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    const pane = own({ color: o.color ?? '#cfe9e0', glow: 0.12, flat: true });
    this.group.add(mesh([box(w, h, 0.12, 0, h / 2, 0.08)], pane));
    // the mullions: a grid of thin white bars
    const bars = [], nx = Math.max(1, Math.round(w / 1.6)), ny = Math.max(1, Math.round(h / 2));
    for (let i = 0; i <= nx; i++) bars.push(box(0.12, h, 0.18, -w / 2 + (i / nx) * w, h / 2, 0.16));
    for (let j = 0; j <= ny; j++) bars.push(box(w, 0.12, 0.18, 0, (j / ny) * h, 0.16));
    this.group.add(mesh(bars, rt.M.trimMat));
    // the vine that grows up it: stems in a lazy zigzag, leaves all along, a few flowers
    this.vine = new THREE.Group();
    const stems = [], leaves = [], flowers = [];
    for (const x0 of [-w * 0.22, w * 0.18]) {
      const pts = [];
      for (let j = 0; j <= 10; j++) pts.push(V(x0 + Math.sin(j * 1.3 + x0) * 0.9, (j / 10) * (h + 0.6), 0.45));
      stems.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.16, 5));
      for (let j = 0; j < 18; j++) { const p = pts[Math.floor(j / 18 * 10)]; leaves.push(T(new THREE.SphereGeometry(1, 7, 4).scale(0.5, 0.28, 0.1), [p.x + ((j % 2) * 2 - 1) * 0.45, p.y + (j % 3) * 0.3, 0.5], [0, 0, j * 0.9])); }
      for (let j = 2; j < 10; j += 3) flowers.push(T(new THREE.SphereGeometry(0.22, 8, 6), [pts[j].x + 0.4, pts[j].y, 0.6]));
    }
    this.vine.add(mesh(stems, own({ color: '#4f8a5a', flat: true })), mesh(leaves, own({ color: '#7fcf72', flat: true })), mesh(flowers, own({ color: '#f2a7b8', glow: 0.25, flat: true })));
    this.group.add(this.vine);
    noCollide(this.group);
    this.k = this.grown ? 1 : 0;
    this.apply();
  }
  get grown() { return !!this.o.when && this.rt.logic.check(this.o.when); }
  apply() { const k = ease(this.k); this.vine.scale.set(1, Math.max(0.001, k), 1); this.vine.visible = k > 0.002; }
  update(dt) {
    const g = this.grown;
    if (g && this.k < 1) { this.k = Math.min(1, this.k + dt / 2.4); this.apply(); }
    if (g) return;
    // too smooth to hold: you slip off it
    const P = this.rt.player;
    if (!P?.climbing) return;
    const l = this.group.worldToLocal(_dl.copy(P.pos));
    if (Math.abs(l.x) < this.w / 2 + 0.6 && l.z > -0.5 && l.z < 1.8 && l.y > -1.5 && l.y < this.h + 0.5) {
      P.climbing = false;
      P.vel.copy(_dn.set(0, 0, 1).transformDirection(this.group.matrixWorld).multiplyScalar(2.2)).setY(-1);
      P._climbCooldown = 1.2;
      this.rt.notice?.(this.o.slip ?? 'The glass is too smooth to hold. Something would have to grow up it first.', 'glass.slip');
    }
  }
}

// ---------------------------------------------------------------------------------------- echoes (the Signal Market)
/** The notes the makers' stones sing: a scale degree (src/audio.js orbNote) and a colour each. */
export const NOTES = {
  low: { degree: 0, color: '#f2b14e', name: 'low' },
  mid: { degree: 2, color: '#62c3c9', name: 'middle' },
  high: { degree: 4, color: '#e58aa0', name: 'high' },
};

/**
 * A singing stone of the makers (the Signal Market's Undertower): splash it and it sings one note, a ring of
 * light pulsing out; the echo shell (src/echo-shell.js), carried within earshot, catches it (game event
 * 'note' { pos, note, degree, color, label }). o: { note: 'low' | 'mid' | 'high', at (its foot), yaw, h }
 */
export class EchoStone {
  constructor(rt, o) {
    this.rt = rt; this.o = o; this.note = o.note;
    const N = NOTES[o.note] ?? NOTES.mid;
    this.N = N;
    const K = rt.kit, M = rt.M, h = o.h ?? 3.2;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    this.group.add(mesh([lathe([[0.9, 0], [0.95, 0.3], [0.7, 0.45], [0.62, h * 0.9], [0.4, h], [0.01, h + 0.1]], 8)], M.stoneMat));
    this.glow = own({ color: N.color, glow: 0.15, flat: true });
    const bands = [];
    for (const y of [0.35, 0.55, 0.75]) bands.push(T(new THREE.TorusGeometry(0.66 - y * 0.12, 0.07, 4, 20), [0, h * y, 0], [Math.PI / 2, 0, 0]));
    bands.push(T(glyphGeometry(0.8, 0.06), [0, h * 0.62, 0.64]));
    this.group.add(mesh(bands, this.glow));
    // the ring of light that pulses out when it sings
    this.ringM = own({ color: N.color, glow: 0.8, flat: true });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 4, 40).rotateX(Math.PI / 2), this.ringM);
    this.ring.position.y = h * 0.6;
    this.ring.visible = false;
    this.group.add(this.ring);
    noCollide(this.group);
    this.center = this.group.position.clone().addScaledVector(UP, h * 0.6);
    this.flash = 0;
    this.off = registerTarget({ kind: 'switch', radius: 1.1, position: () => this.center, onHit: () => this.sing() });
  }
  sing() {
    this.flash = 1.6;
    this.rt.sound?.orbNote?.(this.N.degree, this.center, { size: 0.8 });
    this.rt.game?.emit?.('note', { pos: this.center.clone(), note: this.note, degree: this.N.degree, color: this.N.color, label: `the ${this.N.name} stone’s note` });
    return true;
  }
  update(dt, t) {
    this.flash = Math.max(0, this.flash - dt);
    const k = this.flash / 1.6;
    this.glow.uniforms.uGlow.value = 0.15 + 0.05 * Math.sin(t * 1.4) + 0.8 * k;
    this.ring.visible = k > 0.01;
    if (this.ring.visible) { this.ring.scale.setScalar(1 + (1 - k) * 9); this.ringM.uniforms.uGlow.value = 0.9 * k; }
  }
  dispose() { this.off?.(); }
}

/**
 * Something that listens for a note played back close to it (the echo shell's game event 'echo' { pos, note }):
 * its own note, within `reach`, lights element `id` (a 'switch' that needs the shell); another note it only
 * shrugs off. A horn of brass on a post (or over a door's lintel: o.lintel), ringed in its note's colour.
 * o: { id, note, at, yaw, reach, lintel }
 */
export class EchoEar {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o; this.note = o.note;
    const N = NOTES[o.note] ?? NOTES.mid;
    const K = rt.kit, M = rt.M;
    this.reach = o.reach ?? 7;
    this.group = new THREE.Group();
    this.group.position.copy(K.world(...o.at));
    this.group.rotation.y = K.heading(o.yaw ?? 0);
    rt.root.add(this.group);
    const y = o.lintel ? 0 : 2.4;
    if (!o.lintel) this.group.add(mesh([T(new THREE.CylinderGeometry(0.16, 0.22, 2.4, 8), [0, 1.2, 0]), T(new THREE.CylinderGeometry(0.5, 0.6, 0.25, 12), [0, 0.12, 0])], M.trimMat));
    // the horn: a flared bell of brass facing out, its mouth ringed in the note's colour
    this.group.add(mesh([T(lathe([[0.12, 0], [0.18, 0.5], [0.35, 0.9], [0.75, 1.15], [0.8, 1.2]], 14), [0, y, -0.4], [Math.PI / 2, 0, 0])], own({ color: '#d8a24a', flat: true })));
    this.glow = own({ color: N.color, glow: 0.2, flat: true });
    this.group.add(mesh([T(new THREE.TorusGeometry(0.78, 0.07, 4, 24), [0, y, 0.82])], this.glow));
    noCollide(this.group);
    this.at = this.group.position.clone().addScaledVector(UP, y);
    this.lit = rt.logic.isLit(o.id);
    this.off = rt.game?.on?.('echo', ({ pos, note } = {}) => {
      if (!pos || pos.distanceTo(this.at) > this.reach || this.lit) return;
      if (note === this.note) {
        if (rt.logic.light(this.id)) { this.lit = true; rt.sound?.chime?.(); rt.notice?.(o.heard ?? 'It hears its own note, played back close by, and answers.'); rt.onLit?.(this.id); }
      } else { this.shrug = 0.8; rt.notice?.(o.wrong ?? `It hears the note, and stays still: it listens for the ${N.name} one.`, `ear.wrong.${this.id}`); }
    });
    this.shrug = 0;
  }
  update(dt, t) {
    this.lit ||= this.rt.logic.isLit(this.id);
    this.shrug = Math.max(0, this.shrug - dt);
    this.glow.uniforms.uGlow.value = this.lit ? 0.9 : 0.2 + 0.08 * Math.sin(t * 2) + this.shrug * 0.4;
  }
  dispose() { this.off?.(); }
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
    // the rim's band, flush with the top (a lip standing 14 cm proud of it swallowed the feet of whoever stood by the edge)
    this.group.add(mesh([T(new THREE.TorusGeometry(this.r - 0.1, 0.12, 5, 40), [0, -0.1, 0], [Math.PI / 2, 0, 0])], M.trimMat));
    noCollide(this.group);
    this.solid = { pos: V(), r: this.r, top: 0, bottom: 0, vel: V(), flat: true };   // (flat: a level disc to its rim, src/contact-audit.js)
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
   * o: { id, a, b: [x, y, z] the walkway's ends (its top), w, n: stones, from: 'below' | 'above' | 'grow' }
   * from 'above': the stones hang high over the gap (they fell up), bobbing, and come down into place.
   * from 'grow' (a vine bridge, Viridel's bloom): woven vine that grows out from `a`, a span at a time.
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
    const vine = this.from === 'grow';
    if (vine) { this.vineM ??= own({ color: '#5f9a52', flat: true }); this.leafM ??= own({ color: '#8fcf72', flat: true }); this.bloomM ??= own({ color: '#f2a7b8', glow: 0.25, flat: true }); }
    for (let i = 0; i < n; i++) {
      const c = a.clone().lerp(b, (i + 0.5) / n);
      const g = new THREE.Group();
      g.position.copy(K.world(c.x, c.y, c.z));
      g.rotation.y = K.heading(yaw);
      if (vine) {
        // a span of woven vine: two thick stems along it, a mat between them, leaves and a flower or two
        const len = L / n + 0.1, parts = [box(w * 0.9, 0.35, len, 0, -0.18, 0)], leaves = [], flowers = [];
        for (const s of [-1, 1]) parts.push(T(new THREE.CylinderGeometry(0.28, 0.28, len, 8), [s * w * 0.45, -0.05, 0], [Math.PI / 2, 0, 0]));
        for (let k = 0; k < 4; k++) leaves.push(T(new THREE.SphereGeometry(1, 8, 5).scale(0.5, 0.12, 0.28), [((k % 2) * 2 - 1) * w * 0.5, 0.05, (k / 3 - 0.5) * len], [0, k * 1.3, 0.3]));
        if (i % 2) flowers.push(T(new THREE.SphereGeometry(0.22, 8, 6), [w * 0.5, 0.2, 0]), T(new THREE.SphereGeometry(0.18, 8, 6), [-w * 0.5, 0.18, len * 0.3]));
        g.add(mesh(parts, this.vineM));
        g.add(mesh(leaves, this.leafM));
        if (flowers.length) g.add(mesh(flowers, this.bloomM));
      } else {
        g.add(mesh([box(w, 1.0, L / n - 0.08, 0, -0.5, 0), box(w + 0.3, 0.25, L / n - 0.05, 0, -1.05, 0)], o.hidden ? (this.ghost ??= own({ color: rt.P.glow ?? '#a8e6ee', glow: 0.45, flat: true })) : M.floor));
        g.add(mesh([T(glyphGeometry(w * 0.5, 0.04).rotateX(-Math.PI / 2), [0, 0.01, 0])], M.glyph));
      }
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
      if (this.from === 'grow') {
        // grown out from the near end, a span at a time
        const g = ease(THREE.MathUtils.clamp((this.time - s.delay * 1.6) / 0.7, 0, 1));
        s.g.scale.set(Math.max(0.05, g), Math.max(0.05, g), Math.max(0.001, g));
        s.g.visible = this.open && g > 0.001;
      } else if (above) {
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
