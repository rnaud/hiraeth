import * as THREE from 'three';
import { makeMaterial, MODE_WATER } from './materials.js';
import { registerTarget } from './targets.js';
import { mulberry32 } from './noise.js';
import { WILDLIFE, SPECIES } from './wildlife/species.js';

// Wildlife: two or three small species per world, each with a surprise when
// it is scared (a balloon lizard floats off, a crab digs in, a moth splits in
// three...). They wander near paths, keep a wary distance from the traveller
// and react to sprinting, hard landings, passing vehicles and the fluid tool:
//   'stun'  (a stilling glob)  an enchanted freeze: still for a few seconds,
//                              shimmering through the glob's cold tones, then
//                              they wake and wander off calmly
//   'shoot' (a glob of fluid)  a splash: they shake it off and scamper away,
//                              glinting in the fluid's colours for a moment
//   'push'  (the fluid shock)  scares them: the surprise plays
//   'fire'  (an ember glob)    scares them too: it never burns, they just flee
// After a surprise a creature recovers, or comes back later somewhere out of
// sight, so a world never empties.
//
// Rendering: each species' moving parts are InstancedMeshes (one draw per
// part, whatever the head count). Creatures far from the player update
// coarsely, and sleep (hidden) beyond SLEEP metres.

export { WILDLIFE, SPECIES };

const Y = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const WHITE = new THREE.Color(1, 1, 1);
const NEAR = 60, SLEEP = 140;
const SCALE = 2.5;    // well larger than life, so they are easy to notice at play distance
const STUN = [4, 6];
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _to = new THREE.Vector3();
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _col = new THREE.Color();
const _sa = new THREE.Vector3(), _sb = new THREE.Vector3();   // creature steps only
const _mw = new THREE.Matrix4(), _mwr = new THREE.Matrix4(), _mr = new THREE.Matrix4(), _ml = new THREE.Matrix4(), _mb = new THREE.Matrix4();
const _ray = new THREE.Raycaster();

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const FLUID_DEFAULT = ['#52c8cf', '#966ede'];   // the fluid's first two tones (fluid-tool.js), if a hit brings none
const _ca = new THREE.Color(), _cb = new THREE.Color(), _col2 = new THREE.Color();
/** The instance tint that shows a creature (main colour `main`) in the fluid tones, blending from one to the next over time x. */
function shimmer(main, tones, x, out) {
  const n = tones.length, w = ((x % n) + n) % n, i = Math.floor(w), f = THREE.MathUtils.smoothstep(w - i, 0.35, 0.65);
  _ca.set(tones[i]).lerp(_cb.set(tones[(i + 1) % n]), f);
  const k = (c, m) => Math.min(4, Math.max(0.2, c / Math.max(m, 0.05)));
  return out.setRGB(k(_ca.r, main.r), k(_ca.g, main.g), k(_ca.b, main.b));
}
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const hashId = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** the tangent plane at up: rotate v around up by angle a */
function turnAround(v, up, a) { return v.applyQuaternion(_q.setFromAxisAngle(up, a)); }
function tangent(v, up) { v.addScaledVector(up, -v.dot(up)); return v; }

// --------------------------------------------------------------- particles
/** Puffs, spores, splashes, tickets: one instanced draw for all of them. */
class Particles {
  constructor(root, cap, glow, chips = false) {
    // puffs read as flat printed blobs: mostly self-lit, so they don't hatch like pebbles;
    // chips are little paper rectangles (tickets, petals, flecks)
    const geo = chips ? new THREE.BoxGeometry(1, 1, 1) : new THREE.IcosahedronGeometry(1, 1);
    this.chips = chips;
    this.mesh = new THREE.InstancedMesh(geo, makeMaterial({ color: '#ffffff', glow: Math.max(glow, 0.6) }), cap);
    this.mesh.frustumCulled = false;
    this.mesh.userData.noCollide = true;
    this.mesh.userData.dynamic = true;
    this.mesh.count = 0;
    for (let i = 0; i < cap; i++) { this.mesh.setMatrixAt(i, ZERO); this.mesh.setColorAt(i, WHITE); }
    root.add(this.mesh);
    this.cap = cap;
    this.list = [];
  }
  spawn(o) {
    if (this.list.length >= this.cap) this.list.shift();
    const p = {
      pos: o.pos.clone(), vel: o.vel?.clone() ?? new THREE.Vector3(), life: o.life ?? 1.2, age: 0,
      size: o.size ?? 0.08, grow: o.grow ?? 0, color: new THREE.Color(o.color ?? '#ffffff'),
      gravity: o.gravity ?? 0, drag: o.drag ?? 1.5, up: o.up ?? Y, flat: o.flat ?? 0,
      rot: new THREE.Quaternion().setFromEuler(_e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
      spin: o.spin ?? 0, axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      flutter: o.flutter ?? 0, seed: Math.random() * 10,
    };
    this.list.push(p);
    return p;
  }
  update(dt, t) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L.splice(i, 1); continue; }
      p.vel.multiplyScalar(Math.exp(-p.drag * dt)).addScaledVector(p.up, -p.gravity * dt);
      if (p.flutter) { _v.set(Math.sin(t * 5 + p.seed), 0, Math.cos(t * 4 + p.seed * 2)).multiplyScalar(p.flutter * dt); p.pos.add(_v); }
      p.pos.addScaledVector(p.vel, dt);
      if (p.spin) p.rot.multiply(_q.setFromAxisAngle(p.axis, p.spin * dt));
    }
    for (let i = 0; i < L.length; i++) {
      const p = L[i], k = p.age / p.life;
      const sz = p.size * (1 + p.grow * k) * Math.min(1, (1 - k) * 4) * Math.min(1, p.age * 12 + 0.3);
      if (this.chips) _s.set(sz * 1.4, sz * 0.06, sz * 0.75); else _s.setScalar(sz);
      _mw.compose(p.pos, p.rot, _s);
      this.mesh.setMatrixAt(i, _mw);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.count = L.length;
    this.mesh.visible = L.length > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** FX handed to the species' surprise code. */
class FX {
  constructor(root) {
    this.matte = new Particles(root, 200, 0);
    this.glow = new Particles(root, 140, 0.85);
    this.chips = new Particles(root, 90, 0, true);
    this.sound = null;
  }
  /** a burst of n particles from pos; up is the local up, dir an optional bias */
  burst(pos, up, { n = 10, color = '#e8d8b8', speed = 1.5, rise = 0.6, size = 0.07, life = 1, gravity = 2, drag = 2.5,
    glow = false, flat = 0, spin = 0, flutter = 0, grow = 0, dir = null, spread = 1 } = {}) {
    const cols = Array.isArray(color) ? color : [color];
    for (let i = 0; i < n; i++) {
      _v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6) * spread);
      if (dir) _v.addScaledVector(dir, speed);
      _v.addScaledVector(up, rise * (0.5 + Math.random()));
      (glow ? this.glow : flat ? this.chips : this.matte).spawn({ pos, vel: _v, up, color: cols[i % cols.length], size: size * (0.6 + Math.random() * 0.8),
        life: life * (0.7 + Math.random() * 0.6), gravity, drag, flat, spin, flutter, grow });
    }
  }
  one(pos, vel, up, o = {}) { return (o.glow ? this.glow : o.flat ? this.chips : this.matte).spawn({ pos, vel, up, ...o }); }
  update(dt, t) { this.matte.update(dt, t); this.glow.update(dt, t); this.chips.update(dt, t); }
  get meshes() { return [this.matte.mesh, this.glow.mesh, this.chips.mesh]; }
  play(kind, at, ear) {
    if (!this.sound?.critter) return;
    const d = ear ? at.distanceTo(ear) : 0;
    if (d < 45) this.sound.critter(kind, Math.max(0.15, 1 - d / 45));
  }
}

// --------------------------------------------------------------- one species in this world
// rotations apply yaw first, then pitch, then roll (creature-friendly)
const slot = () => ({ p: new THREE.Vector3(), r: new THREE.Euler(0, 0, 0, 'YXZ'), s: new THREE.Vector3(1, 1, 1), show: true });

// only the big pieces cast shadows (legs, eyes and tails would cost a draw per shadow cascade)
const SHADOW_PARTS = new Set(['body', 'shell', 'stone1', 'stone2', 'stone3', 'lid', 'sail', 'temple', 'petals', 'cog', 'wingL', 'wingR']);

class Herd {
  constructor(root, def, count, noShadow = []) {
    this.def = def;
    const body = makeMaterial({ color: '#ffffff', vertexColors: true });
    const lit = makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.8 });
    this.sphere = new THREE.Sphere(new THREE.Vector3(), 1);
    this.parts = Object.entries(def.parts).map(([name, spec]) => {
      const s = spec.isBufferGeometry ? { geo: spec } : spec;
      const mesh = new THREE.InstancedMesh(s.geo, s.glow ? lit : body, count);
      mesh.name = `wildlife:${def.id}.${name}`;
      mesh.userData.noCollide = true;
      mesh.userData.dynamic = true;
      mesh.boundingSphere = this.sphere;   // kept around the herd by hand, so it culls correctly
      for (let i = 0; i < count; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, WHITE); }
      root.add(mesh);
      // hidden-until-the-surprise parts keep their shadow (the renderer would re-show noShadow meshes)
      if (!s.hidden && !(s.shadow ?? SHADOW_PARTS.has(name))) noShadow.push(mesh);
      return { name, mesh, at: new THREE.Vector3(...(s.at ?? [0, 0, 0])), hidden: !!s.hidden, free: !!s.free, dirty: true };
    });
    this.pose = { root: slot() };
    for (const p of this.parts) this.pose[p.name] = slot();
    this.members = [];
    // enchanted: the instance tint that turns the species' main colour into a fluid tone
    this.main = new THREE.Color(def.main ?? '#a0a0a0');
  }
  reset() {
    const P = this.pose;
    P.root.p.set(0, 0, 0); P.root.r.set(0, 0, 0); P.root.s.set(1, 1, 1); P.root.show = true;
    for (const part of this.parts) {
      const q = P[part.name];
      q.p.copy(part.at); q.r.set(0, 0, 0); q.s.set(1, 1, 1); q.show = !part.hidden;
    }
    return P;
  }
  hide(i) { for (const p of this.parts) { p.mesh.setMatrixAt(i, ZERO); p.dirty = true; } }
  flush() {
    // a sphere around every awake member (plus wherever its surprise has taken it)
    const box = this.box ??= new THREE.Box3();
    box.makeEmpty();
    let any = false, reach = 1;
    for (const c of this.members) if (!c.hidden && !c.asleep) { box.expandByPoint(c.wpos); any = true; reach = Math.max(reach, c.reach); }
    if (any) { box.getBoundingSphere(this.sphere); this.sphere.radius += reach; } else this.sphere.radius = -1;
    for (const p of this.parts) {
      p.mesh.visible = any && this.members.some((c) => !c.hidden && !c.asleep && c.shown[p.name]);
      if (p.dirty) { p.mesh.instanceMatrix.needsUpdate = true; p.dirty = false; }
      if (p.tinted) { p.mesh.instanceColor.needsUpdate = true; p.tinted = false; }
    }
  }
}

// --------------------------------------------------------------- one creature
export class Creature {
  constructor(world, herd, index, spot, rng) {
    this.world = world; this.herd = herd; this.species = herd.def; this.index = index;
    this.rng = rng;
    this.pos = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.fwd = new THREE.Vector3(0, 0, 1);
    this.home = new THREE.Vector3(); this.quat = new THREE.Quaternion();
    this.target = new THREE.Vector3(); this.center = new THREE.Vector3(); this.wpos = new THREE.Vector3();
    this.size = (herd.def.size ?? 1) * SCALE * (0.88 + rng() * 0.24);
    this.seed = rng() * 100;
    this.phase = rng() * 6; this.speed = 0; this.moveAmt = 0; this.look = 0; this.lookTo = 0; this.glance = 0;
    this.state = 'idle'; this.timer = 1 + rng() * 3; this.cool = 0; this.calm = 0;
    this.k = 0; this.data = null; this.trick = herd.def.trick;
    this.hidden = false; this.asleep = false; this.appear = 1; this.tint = 0; this.tintShown = 0;
    this.acc = 0; this.travel = 0; this.reach = 1.5; this.removed = false;
    this.shown = {};
    this.place(spot);
    this.fwd.set(rng() - 0.5, 0, rng() - 0.5);
    this.orient();
    const r = (herd.def.radius ?? 0.45) * this.size;
    this.offTarget = registerTarget({
      kind: 'wildlife', radius: r, creature: this, accepts: ['stun', 'fire'],
      position: () => this.center,
      enabled: () => this.alive && this.visible,
      onHit: (mode, point, dir, info) => this.hit(mode, point, dir, info),
    });
  }

  get alive() { return !this.removed && this.state !== 'gone'; }
  get visible() { return !this.hidden && !this.asleep && this.state !== 'trick'; }
  get stunned() { return this.state === 'stun'; }

  place(spot) {
    this.pos.copy(spot.pos); this.up.copy(spot.up ?? Y).normalize(); this.home.copy(this.pos);
    this.water = spot.water ?? null;
    this.orient();
    this.center.copy(this.pos).addScaledVector(this.up, (this.species.height ?? 0.3) * this.size);
    this.wpos.copy(this.pos);
  }
  orient() {
    tangent(this.fwd, this.up);
    if (this.fwd.lengthSq() < 1e-6) this.fwd.set(1, 0, 0).cross(this.up).normalize();
    this.fwd.normalize();
    _u.crossVectors(this.up, this.fwd);
    _mb.makeBasis(_u, this.up, this.fwd);
    this.quat.setFromRotationMatrix(_mb);
  }
  /** a local point (x right, y up, z forward, in species units) to world space */
  toWorld(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).multiplyScalar(this.size).applyQuaternion(this.quat).add(this.pos);
  }
  toLocal(world, out = new THREE.Vector3()) {
    return out.copy(world).sub(this.pos).applyQuaternion(_q.copy(this.quat).invert()).divideScalar(this.size);
  }
  faceAway(from) {
    if (!from) return;
    _v.subVectors(this.pos, from); tangent(_v, this.up);
    if (_v.lengthSq() > 1e-4) { this.fwd.copy(_v).normalize(); this.orient(); }
  }

  /** The surprise. from: where the fright came from (world). Returns false if it can't play now. */
  scare(from = null) {
    if (this.removed || this.state === 'trick' || this.state === 'gone' || this.hidden) return false;
    if (from) this.faceAway(from);
    this.state = 'trick'; this.k = 0; this.speed = 0; this.tint = 0; this.data = {};
    this.trick.start?.(this, this.world.ctx);
    this.world.fx.play(this.trick.sound ?? 'squeak', this.pos, this.world.ear);
    this.world.onSurprise?.(this);
    return true;
  }
  /** The enchanted freeze: still for STUN seconds, shimmering in the fluid's tones; no surprise, no harm. */
  stun(seconds, tones = null) {
    if (this.removed || this.state === 'trick' || this.state === 'gone' || this.hidden) return false;
    this.state = 'stun'; this.speed = 0;
    this.tones = tones?.length ? tones : FLUID_DEFAULT;
    this.timer = seconds ?? STUN[0] + this.rng() * (STUN[1] - STUN[0]);
    this.world.fx.play('daze', this.pos, this.world.ear);
    return true;
  }
  /** A splash of plain fluid: a glint of its colours and a scamper away from where it landed. */
  splashed(from, tones = null) {
    if (this.removed || this.state === 'trick' || this.state === 'gone' || this.hidden || this.state === 'stun') return false;
    if (from) this.faceAway(from);
    this.tones = tones?.length ? tones : FLUID_DEFAULT;
    this.tint = 0.85;
    this.state = 'flee'; this.timer = 1.4 + this.rng(); this.cool = 1;
    this.world.fx.play('squeak', this.pos, this.world.ear);
    return true;
  }
  hit(mode, point, dir, info) {
    const from = dir && point ? _o.copy(point).addScaledVector(dir, -4) : point;
    if (mode === 'stun') return this.stun(undefined, info?.colours);
    if (mode === 'push' || mode === 'fire') return this.scare(from);
    if (mode === 'shoot') return this.splashed(from, info?.colours);
    return false;
  }
  /** take it out of the world for good (and out of the target registry) */
  remove() {
    if (this.removed) return;
    this.removed = true; this.hidden = true;
    this.offTarget();
    this.herd.hide(this.index);
    this.world.forget(this);
  }

  finishTrick() {
    const end = this.trick.end ?? 'recover';
    if (this.data?.to) { this.place(this.data.to); }
    this.data = null; this.k = 0; this.cool = 3;
    if (end === 'gone') {
      this.state = 'gone'; this.hidden = true; this.timer = 14 + this.rng() * 14;
      this.herd.hide(this.index);
    } else { this.state = 'flee'; this.timer = 1.5 + this.rng(); }
  }

  /** steer toward a world direction (projected on the ground plane), move at speed */
  steer(dir, speed, dt) {
    _w.copy(dir); tangent(_w, this.up);
    if (_w.lengthSq() > 1e-6) {
      _w.normalize();
      const turn = this.species.turn ?? 5;
      const cross = _u.crossVectors(this.fwd, _w).dot(this.up), dot = this.fwd.dot(_w);
      const ang = Math.atan2(cross, dot);
      const step = Math.sign(ang) * Math.min(Math.abs(ang), turn * dt);
      turnAround(this.fwd, this.up, step);
      this.orient();
      if (Math.abs(ang) > 1.6) speed *= 0.3;   // turn on the spot before running off
    }
    this.speed = damp(this.speed, speed, 6, dt);
    return this.step(dt);
  }
  step(dt) {
    if (this.speed < 0.01) return true;
    const d = this.speed * dt;
    const next = _sa.copy(this.pos).addScaledVector(this.fwd, d);
    this.travel += d;
    if (this.travel > 0.22 || d > 0.22) {
      this.travel = 0;
      const ok = this.world.walkable(this, _sb.copy(next).addScaledVector(this.fwd, 0.35 * this.size), _sb) && this.world.walkable(this, next, next);
      if (!ok) {
        this.speed = 0;
        turnAround(this.fwd, this.up, (this.rng() < 0.5 ? -1 : 1) * (1.8 + this.rng() * 1.2));
        this.orient();
        return false;
      }
      this.pos.copy(next);
      const g = this.world.level.gravityAt;
      if (g) { this.up.copy(g(this.pos)).normalize(); this.orient(); }
    } else this.pos.copy(next);
    return true;
  }

  update(dt, t, player, dist) {
    const sp = this.species, W = this.world;
    this.cool = Math.max(0, this.cool - dt);
    this.appear = Math.min(1, this.appear + dt * 1.6);
    this.tint = damp(this.tint, this.state === 'stun' ? 1 : 0, this.state === 'stun' ? 8 : 2, dt);
    const notice = sp.notice ?? 8, wary = sp.wary ?? 4.5, walk = sp.speed ?? 1;
    const s = this.state;
    if (s === 'idle' || s === 'walk' || s === 'wary' || s === 'flee') {
      const src = W.disturbanceFor(this, dist);
      if (src && this.cool <= 0) { this.scare(src); return; }
      if (s !== 'flee' && dist < notice && (W.playerSpeed > 0.6 || dist < wary) && W.playerGround) { this.state = 'wary'; this.calm = 0; }
    }
    _to.subVectors(player.pos, this.pos); tangent(_to, this.up);
    switch (this.state) {
      case 'idle': {
        this.speed = damp(this.speed, 0, 6, dt);
        this.timer -= dt;
        if (this.timer < 0) {
          const a = this.rng() * Math.PI * 2, r = (sp.roam ?? 5) * Math.sqrt(this.rng());
          this.target.copy(this.home);
          _v.set(Math.cos(a) * r, 0, Math.sin(a) * r);
          if (this.up.y < 0.999) _v.applyQuaternion(_q.setFromUnitVectors(Y, this.up));
          this.target.add(_v);
          this.state = 'walk'; this.timer = 4 + this.rng() * 4;
        }
        break;
      }
      case 'walk': {
        this.timer -= dt;
        _v.subVectors(this.target, this.pos); tangent(_v, this.up);
        if (_v.length() < 0.35 || this.timer < 0 || !this.steer(_v, walk, dt)) { this.state = 'idle'; this.timer = 1.5 + this.rng() * 4; }
        break;
      }
      case 'wary': {
        this.calm = W.playerSpeed < 0.4 ? this.calm + dt : 0;
        if (dist < wary * 0.9) this.steer(_v.copy(_to).negate(), walk * (sp.backoff ?? 1.5), dt);
        else this.steer(_to, 0, dt);   // turn to watch
        if (dist > notice * 1.3 || (this.calm > 4 && dist > wary)) { this.state = 'idle'; this.timer = 1 + this.rng() * 2; this.home.copy(this.pos); }
        break;
      }
      case 'flee': {
        this.timer -= dt;
        this.steer(_v.copy(_to).negate(), walk * 1.4, dt);
        if (this.timer < 0) { this.state = 'idle'; this.timer = 1 + this.rng() * 2; this.home.copy(this.pos); }
        break;
      }
      case 'stun': {
        this.speed = 0;
        this.timer -= dt;
        if (this.timer < 0) { this.state = 'flee'; this.timer = 3; this.cool = 1.5; }
        break;
      }
      case 'trick': {
        this.k += dt / (this.trick.dur ?? 4);
        if (this.k >= 1) { this.finishTrick(); return; }
        break;
      }
    }
    // gait phase and head glances
    if (this.state !== 'stun') this.phase += dt * (this.speed * (sp.cadence ?? 10) + (sp.idleRate ?? 0));
    this.moveAmt = damp(this.moveAmt, Math.min(1, this.speed / Math.max(walk, 0.1)), 8, dt);
    if (this.state === 'idle' && (this.glance -= dt) < 0) { this.glance = 1 + this.rng() * 2.5; this.lookTo = (this.rng() - 0.5) * 1.2; }
    if (this.state !== 'idle') this.lookTo = 0;
    if (this.state !== 'stun') this.look = damp(this.look, this.lookTo, 5, dt);
  }
}

// --------------------------------------------------------------- the world's wildlife
export class Wildlife {
  /**
   * @param scene    creatures are added under one group here
   * @param level    the built level (spawn, ground, unsafe, gravityAt…)
   * @param physics  ground queries (creatures never join the collision)
   * @param opts     { content: CONTENT[level.id], sound, defs (override WILDLIFE[level.id]) }
   */
  constructor(scene, level, physics, { content = null, sound = null, defs = null, seed } = {}) {
    this.level = level; this.physics = physics; this.content = content;
    this.root = new THREE.Group(); this.root.name = 'Wildlife'; this.root.userData.noCollide = true;
    scene.add(this.root);
    this.fx = new FX(this.root); this.fx.sound = sound;
    this.rng = mulberry32(seed ?? hashId(level.id ?? 'world'));
    this.list = [];
    this.herds = [];
    this.frame = 0; this.t = 0;
    this.playerSpeed = 0; this.playerGround = true; this.air = 0; this.disturb = [];
    this.ear = null;
    this.ctx = { fx: this.fx, world: this, t: 0, dt: 0 };
    this.stars = this.makeStars();
    // puffs, spores and stun stars cast no shadows (the renderer hides level.noShadow in its shadow passes)
    (level.noShadow ??= []).push(...this.fx.meshes, this.stars.mesh, this.stars.swirl);
    this.waters = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uMode?.value === MODE_WATER) this.waters.push(o); });
    this.waterCache = new Map();
    this.avoid = this.clutter(content);
    const list = defs ?? WILDLIFE[level.id] ?? [];
    for (const def of list) this.populate(def);
  }

  get creatures() { return this.list; }
  get species() { return this.herds.map((h) => h.def); }

  makeStars() {
    // three little sparks in the fluid's tones wheel over an enchanted head, with an ink swirl under them
    const g = new THREE.OctahedronGeometry(1, 0).scale(1, 1, 0.35);
    const mesh = new THREE.InstancedMesh(g, makeMaterial({ color: '#ffffff', flat: true, glow: 0.9 }), 30);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(30 * 3).fill(1), 3);
    const swirl = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.08, 4, 20, Math.PI * 1.6).rotateX(Math.PI / 2), makeMaterial({ color: '#2b211f', flat: true }), 10);
    for (const m of [mesh, swirl]) {
      m.frustumCulled = false; m.userData.noCollide = true; m.userData.dynamic = true; m.count = 0;
      this.root.add(m);
    }
    return { mesh, swirl };
  }

  /** spawn clutter, people and the gate: keep a little room around them */
  clutter(content) {
    const L = this.level, out = [];
    if (L.spawn) out.push({ p: L.spawn.clone(), r: 9 });
    for (const n of content?.npcs ?? []) out.push({ p: new THREE.Vector3(n.at[0], n.y ?? L.spawn?.y ?? 0, n.at[1]), r: 3.5, flat: n.y === undefined });
    if (content?.gate) out.push({ p: new THREE.Vector3(content.gate.at[0], L.spawn?.y ?? 0, content.gate.at[1]), r: 7, flat: true });
    return out;
  }

  /** default anchors: around the spawn, the people and the story goal */
  anchors() {
    const L = this.level, C = this.content, H = (x, z) => L.ground?.heightAt?.(x, z);
    const out = [{ p: L.spawn.clone(), r: [10, 42], w: 4 }];
    for (const n of C?.npcs ?? []) {
      const h = n.y ?? H(n.at[0], n.at[1]);
      const y = Number.isFinite(h) ? h : L.spawn.y;
      out.push({ p: new THREE.Vector3(n.at[0], y, n.at[1]), r: [4, 22], w: 1 });
    }
    const g = C?.story?.goal;
    if (g && g[1] === 'ground' && Number.isFinite(H(g[0], g[2]))) out.push({ p: new THREE.Vector3(g[0], H(g[0], g[2]), g[2]), r: [8, 30], w: 1 });
    return out;
  }

  /** the water surface height at (x, z), or -Infinity (1 m grid, cached) */
  waterAt(x, z) {
    if (!this.waters.length) return -Infinity;
    const key = Math.round(x) * 73856093 ^ Math.round(z) * 19349663;
    let y = this.waterCache.get(key);
    if (y === undefined) {
      _ray.set(_o.set(Math.round(x), 5000, Math.round(z)), _d.set(0, -1, 0));
      _ray.far = 1e4;
      const hits = _ray.intersectObjects(this.waters, false);
      y = hits.length ? hits[0].point.y : -Infinity;
      if (this.waterCache.size > 50000) this.waterCache.clear();
      this.waterCache.set(key, y);
    }
    return y;
  }

  /** the first surface below p along -up (within above/drop), into out; or null */
  surface(p, up, out, above = 1.2, drop = 3) {
    if (up.y > 0.999) {
      const y = this.physics.groundAt(p.x, p.y + above, p.z, above + drop);
      return Number.isFinite(y) ? out.set(p.x, y, p.z) : null;
    }
    _o.copy(p).addScaledVector(up, above);
    const hit = this.physics.rayHit(_o, _d.copy(up).negate(), above + drop);
    return hit ? out.copy(hit.point) : null;
  }

  /** where a creature at c can stand at p (on land, or on the water if it swims); result into out */
  walkable(c, p, out) {
    const sp = c.species, up = c.up;
    if (sp.habitat === 'water') {
      const w = this.waterAt(p.x, p.z);
      if (!Number.isFinite(w)) return false;
      const g = this.physics.groundAt(p.x, w + 0.6, p.z, 8);
      if (w - g < (sp.depth ?? 0.25)) return false;
      out.set(p.x, w, p.z);
      return true;
    }
    if (!this.surface(p, up, out, 0.6 * Math.max(1, c.size), 1.2 * Math.max(1, c.size))) return false;
    _v.subVectors(out, c.pos);
    if (Math.abs(_v.dot(up)) > 0.45 * Math.max(1, c.size)) return false;
    if (this.level.unsafe?.(out)) return false;
    if (up.y > 0.99 && this.waterAt(out.x, out.z) > out.y - 0.04) return false;
    if (sp.leash && out.distanceTo(c.home) > sp.leash) return false;
    return true;
  }

  /** a good place to put a creature of species sp, at or near p (on a surface already) */
  goodSpot(sp, p, up, strict = true) {
    const L = this.level;
    if (sp.habitat === 'water') {
      const w = this.waterAt(p.x, p.z);
      if (!Number.isFinite(w)) return null;
      const g = this.physics.groundAt(p.x, w + 0.6, p.z, 10);
      const depth = w - g;
      if (!(depth > (sp.depth ?? 0.25) + 0.1 && depth < (sp.maxDepth ?? 4))) return null;
      return { pos: new THREE.Vector3(p.x, w, p.z), up: Y.clone(), water: w };
    }
    if (L.unsafe?.(p)) return null;
    const flat = sp.flatness ?? 0.28;
    _u.set(1, 0, 0); if (Math.abs(up.x) > 0.9) _u.set(0, 0, 1);
    const t1 = _u.cross(up).normalize().clone(), t2 = new THREE.Vector3().crossVectors(up, t1);
    for (const [a, b] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
      _w.copy(p).addScaledVector(t1, a).addScaledVector(t2, b);
      if (!this.surface(_w, up, _s, 0.6, 1.2)) return null;
      if (Math.abs(_s.sub(p).dot(up)) > flat) return null;
    }
    // headroom (not tucked under a ledge or inside a wall)
    _o.copy(p).addScaledVector(up, 0.12);
    if (this.physics.rayDistance(_o, up, 1.6) < 1.6) return null;
    let water = null;
    if (up.y > 0.99) {
      const w = this.waterAt(p.x, p.z);
      if (w > p.y - 0.05) return null;
      if (sp.habitat === 'shore') {
        // dry land with water close by: remember which way the water is
        let best = null;
        for (let i = 0; i < 12 && !best; i++) {
          const a = (i / 12) * Math.PI * 2;
          for (const r of [2.5, 4.5, 7]) {
            const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, wy = this.waterAt(x, z);
            // a real shoreline: the water there lies just below this bank
            if (wy < p.y + 0.05 && wy > p.y - 0.8 && wy - this.physics.groundAt(x, wy + 0.5, z, 6) > 0.3) { best = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); break; }
          }
        }
        if (!best) return null;
        water = best;
      }
    }
    if (strict) for (const a of this.avoid) {
      const d = a.flat ? Math.hypot(p.x - a.p.x, p.z - a.p.z) : p.distanceTo(a.p);
      if (d < a.r) return null;
    }
    return { pos: p.clone(), up: up.clone(), water };
  }

  /** Sample places for a species around its anchors (deterministic per world). */
  findSpots(def, want) {
    const rng = this.rng, L = this.level;
    const anchors = (def.anchors?.(L, this) ?? this.anchors()).map((a) => ({ w: 1, r: [6, 30], up: null, ...a }));
    const total = anchors.reduce((s, a) => s + a.w, 0);
    const spots = [];
    const sep = def.spacing ?? 3;
    for (let tries = 0; tries < want * 60 && spots.length < want; tries++) {
      let pick = rng() * total, A = anchors[0];
      for (const a of anchors) { if ((pick -= a.w) <= 0) { A = a; break; } }
      const up = A.up ?? (L.gravityAt ? L.gravityAt(A.p).clone().normalize() : Y.clone());
      const ang = rng() * Math.PI * 2, rad = A.r[0] + (A.r[1] - A.r[0]) * Math.sqrt(rng());
      _u.set(1, 0, 0); if (Math.abs(up.x) > 0.9) _u.set(0, 0, 1);
      const t1 = _u.cross(up).normalize(), t2 = _w.crossVectors(up, t1);
      const p = A.p.clone().addScaledVector(t1, Math.cos(ang) * rad).addScaledVector(t2, Math.sin(ang) * rad);
      // terrain worlds: search from the terrain height there; elsewhere from the anchor's level
      const h = up.y > 0.999 ? L.ground?.heightAt?.(p.x, p.z) : NaN;
      const base = Number.isFinite(h) && Math.abs(h - A.p.y) < 40 ? Math.max(h, A.p.y - 30) : null;
      if (base !== null) p.y = base;
      const s = new THREE.Vector3();
      const hit = def.habitat === 'water' ? p : this.surface(p, up, s, base !== null ? 2 : 3, base !== null ? 4 : 6);
      if (!hit) continue;
      const g = this.goodSpot(def, hit, up, true);
      if (!g) continue;
      if (spots.some((o) => o.pos.distanceTo(g.pos) < sep)) continue;
      if (this.list.some((c) => c.pos.distanceTo(g.pos) < 2)) continue;
      spots.push(g);
    }
    return spots;
  }

  populate(def) {
    const count = def.count ?? 4;
    const spots = this.findSpots(def, count * 3);
    if (!spots.length) { console.warn(`wildlife: no room for ${def.id} in ${this.level.id}`); return; }
    const n = Math.min(count, spots.length);
    const herd = new Herd(this.root, def, n, this.level.noShadow ??= []);
    herd.spots = spots;
    this.herds.push(herd);
    // spread the first ones over the pool (it is ordered by the anchor sampling)
    for (let i = 0; i < n; i++) {
      const c = new Creature(this, herd, i, spots[Math.floor((i * spots.length) / n)], this.rng);
      herd.members.push(c);
      this.list.push(c);
    }
  }

  forget(c) {
    const i = this.list.indexOf(c);
    if (i >= 0) this.list.splice(i, 1);
    const j = c.herd.members.indexOf(c);
    if (j >= 0) c.herd.members.splice(j, 1);
  }

  /** a free spot for a surprise to land on: from c, along its forward (or around), between min and max metres */
  spotNear(c, min = 3, max = 8, { habitat, from, dir } = {}) {
    const sp = habitat ? { ...c.species, habitat } : c.species;
    const origin = from ?? c.pos;
    for (let i = 0; i < 14; i++) {
      const a = (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.45);
      _v.copy(dir ?? c.fwd); tangent(_v, c.up).normalize(); turnAround(_v, c.up, a);
      const r = min + (max - min) * (i === 0 ? 0.6 : this.rng());
      _p.copy(origin).addScaledVector(_v, r * c.size);
      const p = new THREE.Vector3();
      if (sp.habitat === 'water') { if (!Number.isFinite(this.waterAt(_p.x, _p.z))) continue; p.copy(_p); }
      else if (!this.surface(_p, c.up, p, 3, 6)) continue;
      const up = this.level.gravityAt ? this.level.gravityAt(p).clone().normalize() : c.up.clone();
      const g = this.goodSpot(sp, p, up, false);
      if (g) return g;
    }
    return null;
  }

  /** turn c toward a spot; returns the spot in c's local (species) units */
  aim(c, spot) {
    _v.subVectors(spot.pos, c.pos); tangent(_v, c.up);
    if (_v.lengthSq() > 1e-4) { c.fwd.copy(_v).normalize(); c.orient(); }
    return c.toLocal(spot.pos);
  }

  /** respawn a gone creature somewhere out of the player's sight */
  respawn(c, player, camera) {
    const herd = c.herd, eye = camera?.position ?? player.pos;
    if (camera) camera.getWorldDirection(_d); else _d.set(0, 0, 0);
    const fov = camera ? Math.cos(THREE.MathUtils.degToRad((camera.fov ?? 60) * 0.75)) : 1;
    const order = herd.spots.map((s, i) => [s, (i * 7 + this.frame) % herd.spots.length]).sort((a, b) => a[1] - b[1]).map((a) => a[0]);
    for (const s of order) {
      const d = s.pos.distanceTo(player.pos);
      if (d < 22 || d > SLEEP * 0.8) continue;
      _v.subVectors(s.pos, eye);
      const inView = camera && _v.dot(_d) > fov * _v.length();
      if (inView && d < 80) continue;
      if (this.list.some((o) => o !== c && !o.hidden && o.pos.distanceTo(s.pos) < 2)) continue;
      c.place(s);
      c.state = 'idle'; c.timer = 1 + this.rng() * 3; c.hidden = false; c.appear = 0; c.tint = 0; c.cool = 2;
      return true;
    }
    c.timer = 3;
    return false;
  }

  /** what might frighten creatures this frame: sprinting, hard landings, vehicles */
  sense(dt, player) {
    const D = this.disturb; D.length = 0;
    const v = player.vel ?? Y;
    const up = player.frame?.up ?? Y;
    const along = v.dot(up);
    this.playerSpeed = Math.sqrt(Math.max(0, v.lengthSq() - along * along));
    this.playerGround = !!player.onGround || !!player.riding;
    if (!player.riding) {
      if (player.onGround) {
        if (this.air > 0.5) D.push({ p: player.pos, r: 9 + Math.min(this.air, 2) * 2, why: 'landing' });
        this.air = 0;
        if (this.playerSpeed > 5.2) D.push({ p: player.pos, r: 9, why: 'sprint' });
      } else this.air += dt;
    }
    const seen = new Set();
    for (const veh of [player.ride, player.mount, ...(player.vehicles ?? [])]) {
      if (!veh?.pos || seen.has(veh)) continue;
      seen.add(veh);
      const sp = veh.vel ? veh.vel.length() : Math.abs(veh.speed ?? 0);
      if (sp > 4 || (veh === player.ride && Math.abs(veh.speed ?? 0) > 4)) D.push({ p: veh.pos, r: 12, why: 'vehicle' });
    }
  }
  disturbanceFor(c, dist) {
    for (const d of this.disturb) if (d.p.distanceTo(c.pos) < d.r * (c.species.skittish ?? 1)) return d.p;
    if (dist < (c.species.touch ?? 1.1) * c.size + 0.5 && this.playerGround) return this.playerPos;
    return null;
  }

  update(dt, t, player, camera, paused = false) {
    if (paused) return;
    this.frame++; this.t = t;
    this.ctx.t = t;
    this.playerPos = player.pos;
    this.ear = camera?.position ?? player.pos;
    this.sense(dt, player);
    let stunned = 0;
    for (const c of this.list) {
      if (c.state === 'gone') {
        c.timer -= dt;
        if (c.timer <= 0) this.respawn(c, player, camera);
        if (c.state === 'gone') continue;
      }
      const d = c.pos.distanceTo(player.pos);
      const busy = c.state === 'trick' || c.state === 'stun';
      if (d > SLEEP && !busy) {
        if (!c.asleep) { c.asleep = true; c.herd.hide(c.index); for (const k in c.shown) c.shown[k] = false; }
        continue;
      }
      c.asleep = false;
      c.acc += dt;
      if (d > NEAR && !busy && (this.frame + c.index) % 4) continue;
      const step = Math.min(c.acc, 0.25); c.acc = 0;
      c.update(step, t, player, d);
      if (!c.hidden) this.write(c, t, step);
      if (c.state === 'stun' && !c.hidden) this.writeStars(c, t, stunned++);
    }
    this.stars.mesh.count = stunned * 3; this.stars.swirl.count = stunned;
    this.stars.mesh.visible = this.stars.swirl.visible = stunned > 0;
    if (stunned) { this.stars.mesh.instanceMatrix.needsUpdate = true; this.stars.mesh.instanceColor.needsUpdate = true; this.stars.swirl.instanceMatrix.needsUpdate = true; }
    this.fx.update(dt, t);
    for (const h of this.herds) h.flush();
  }

  /** pose a creature and write its parts' instance matrices */
  write(c, t, dt) {
    const herd = c.herd, sp = c.species, P = herd.reset();
    this.ctx.dt = dt;
    gait(c, P, t);
    if (c.state === 'trick') c.trick.pose?.(c, c.k, P, this.ctx);
    else if (c.state === 'stun') {
      const w = Math.min(1, c.timer * 2) * Math.min(1, (STUN[1] - c.timer) * 3 + 0.3);
      P.root.r.z += Math.sin(t * 9 + c.seed) * 0.16 * w;
      P.root.r.x += Math.sin(t * 6.3 + c.seed) * 0.08 * w;
      P.root.s.y *= 1 - 0.08 * w;
      sp.dazed?.(c, P, t);
    }
    _s.setScalar(c.size * c.appear);
    _mw.compose(c.pos, c.quat, _s);
    _mr.compose(P.root.p, _q.setFromEuler(P.root.r), P.root.s);
    _mwr.multiplyMatrices(_mw, _mr);
    c.wpos.setFromMatrixPosition(_mwr);
    c.center.set(0, sp.height ?? 0.3, 0).applyMatrix4(_mwr);
    c.reach = (sp.reach ?? 1.5) * c.size * (c.state === 'trick' ? (c.trick.reach ?? 2) : 1);
    // enchanted: the tint shimmers through the fluid's tones (rewritten every frame while it shows)
    const tinted = c.tint > 0.02 || c.tintShown !== 0;
    if (tinted) { c.tintShown = c.tint < 0.02 ? 0 : c.tint; _col.copy(WHITE).lerp(shimmer(herd.main, c.tones ?? FLUID_DEFAULT, t * 1.1 + c.seed, _col2), c.tintShown); }
    for (const part of herd.parts) {
      const q = P[part.name];
      c.shown[part.name] = q.show && (part.free || P.root.show);
      if (!c.shown[part.name] || q.s.x * q.s.y * q.s.z === 0) part.mesh.setMatrixAt(c.index, ZERO);
      else {
        _ml.compose(q.p, _q.setFromEuler(q.r), q.s);
        _ml.premultiply(part.free ? _mw : _mwr);
        part.mesh.setMatrixAt(c.index, _ml);
      }
      part.dirty = true;
      if (tinted) { part.mesh.setColorAt(c.index, _col); part.tinted = true; }
    }
  }

  writeStars(c, t, i) {
    const h = (c.species.height ?? 0.3) * 2 + 0.18;
    for (let k = 0; k < 3; k++) {
      const a = t * 3.2 + (k * Math.PI * 2) / 3 + c.seed;
      c.toWorld(Math.cos(a) * 0.26, h + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.26, _p);
      _s.setScalar(0.075 * Math.max(0.8, c.size));
      _q.copy(c.quat).multiply(_q2.setFromAxisAngle(Y, a * 2));
      _mw.compose(_p, _q, _s);
      this.stars.mesh.setMatrixAt(i * 3 + k, _mw);
      const tones = c.tones ?? FLUID_DEFAULT;
      this.stars.mesh.setColorAt(i * 3 + k, _col2.set(tones[(k + Math.floor(t * 3)) % tones.length]));
    }
    c.toWorld(0, h - 0.04, 0, _p);
    _s.setScalar(0.2 * Math.max(0.8, c.size));
    _q.copy(c.quat).multiply(_q2.setFromAxisAngle(Y, -t * 4));
    _mw.compose(_p, _q, _s);
    this.stars.swirl.setMatrixAt(i, _mw);
  }

  dispose() {
    for (const c of [...this.list]) c.remove();
    this.root.removeFromParent();
  }
}

/** Shared idle and wander animation, driven by the species' gait. */
function gait(c, P, t) {
  const sp = c.species, g = sp.gait ?? 'walk', m = c.moveAmt, ph = c.phase, s = c.seed;
  const breathe = Math.sin(t * 2.3 + s);
  if (P.body) P.body.s.y *= 1 + breathe * 0.025;
  if (sp.hover) P.root.p.y += sp.hover + Math.sin(t * 1.7 + s) * 0.06;
  if (P.head) { P.head.r.y += c.look; P.head.r.x += Math.sin(t * 0.7 + s) * 0.05 - (c.state === 'wary' ? 0.15 : 0); }
  const lift = sp.lift ?? 0.05, stride = sp.stride ?? 0.06;
  if (g === 'walk' || g === 'scuttle') {
    const a = Math.sin(ph), b = Math.cos(ph);
    if (P.legsA) { P.legsA.p.y += Math.max(0, a) * lift * m; P.legsA.p.z += b * stride * m; }
    if (P.legsB) { P.legsB.p.y += Math.max(0, -a) * lift * m; P.legsB.p.z -= b * stride * m; }
    P.root.p.y += Math.abs(a) * (sp.bob ?? 0.012) * m;
    P.root.r.z += a * (g === 'scuttle' ? 0.04 : 0.02) * m;
  } else if (g === 'hop') {
    const hop = Math.abs(Math.sin(ph * 0.5));
    P.root.p.y += hop * (sp.hopHeight ?? 0.12) * m;
    P.root.r.x += -Math.cos(ph * 0.5) * 0.12 * m;
    if (P.legsA) P.legsA.r.x += -hop * 0.6 * m;
    if (P.legsB) P.legsB.r.x += hop * 0.4 * m;
    // idle: a little sniff
    P.root.s.y *= 1 + Math.max(0, Math.sin(t * 5 + s)) * 0.03 * (1 - m);
  } else if (g === 'slither' || g === 'inch') {
    if (g === 'inch') { const k = Math.sin(ph); if (P.body) { P.body.s.z *= 1 + k * 0.14 * m; P.body.s.y *= 1 - k * 0.1 * m; } }
    else if (P.body) P.body.r.y += Math.sin(ph) * 0.12 * m;
  } else if (g === 'hover') {
    const f = Math.sin(t * (sp.flap ?? 9) + s) * (sp.flapAmp ?? 0.5);
    if (P.wingL) P.wingL.r.z += f;
    if (P.wingR) P.wingR.r.z -= f;
    P.root.r.z += Math.sin(t * 1.1 + s) * 0.06;
  } else if (g === 'swim') {
    if (P.body) P.body.r.y += Math.sin(t * 5 + s) * 0.12 * (0.4 + m);
    P.root.p.y += Math.sin(t * 1.3 + s) * 0.02;
  }
  if (P.tail) P.tail.r.y += Math.sin(t * (g === 'swim' ? 7 : 1.7) + s) * (g === 'swim' ? 0.5 : 0.22) + Math.sin(ph) * 0.25 * m;
  sp.idle?.(c, P, t);
}
