import * as THREE from 'three';
import { makeMaterial, markHero, MODE_RIBBON } from './materials.js';
import { raycastTargets, hitTarget, registerTarget } from './targets.js';

// The traveller's handheld device doubles as a non-lethal tool, a little
// brass-and-glass emitter clipped onto it. Two modes:
//   'stun'  the paralyze ray: hitscan, a wavering cyan ribbon with ink rings
//           where it lands; for wildlife. Runs on a small energy gauge.
//   'dart'  a soft foam dart on a ballistic arc (under the level's gravity,
//           which can point anywhere): it pops whatever it touches into
//           action from afar, or bounces off the world and fades.
// Hits go through the shared target registry (targets.js); world geometry
// occludes them (physics.rayHit). The player's arm and chest follow the aim
// (Humanoid.aimAt via player.aim), and the camera moves over the shoulder.

export const MODES = ['stun', 'dart'];
export const MODE_NAMES = { stun: 'paralyze ray', dart: 'foam dart' };
export const TOOL = {
  range: 40,            // m, the ray's reach
  stunCost: 0.22,       // energy per shot (the gauge refills on its own)
  stunCooldown: 0.28,
  regen: 0.4,           // energy per second
  regenDelay: 0.6,      // after the last shot
  dartCooldown: 0.4,
  dartSpeed: 27,        // m/s at the muzzle
  dartGravity: 14,      // m/s², foam floats a bit
  maxDarts: 8,
};

/** Map raw input (keyboard, mouse, gamepad, touch all write into the same object) to the tool's three controls. */
export function toolInput(c = {}) {
  return {
    aim: !!(c.KeyR || c.MouseRight || c.PadAim),
    fire: !!(c.KeyG || c.MouseLeft || c.PadFire),
    mode: !!(c.KeyX || c.MouseMiddle || c.PadMode),
  };
}

/** Mouse: hold the right button to aim, left button fires (while aiming or with the pointer captured), middle switches mode. */
export function bindToolMouse(dom, input) {
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('mousedown', (e) => {
    if (e.button === 2) input.MouseRight = true;
    if (e.button === 1) { input.MouseMiddle = true; e.preventDefault(); }
    if (e.button === 0 && (document.pointerLockElement === dom || input.MouseRight)) input.MouseLeft = true;
  });
  window.addEventListener('mouseup', (e) => { const k = ['MouseLeft', 'MouseMiddle', 'MouseRight'][e.button]; if (k) input[k] = false; });
}

const _d = new THREE.Vector3();

/**
 * One hitscan shot: the nearest registered target along the ray, unless the
 * world is in the way. Returns { kind: 'target' | 'world' | 'none', point,
 * normal, distance, hit? } (hit is the registry's result, for hitTarget()).
 */
export function traceShot(physics, origin, dir, range = TOOL.range) {
  const t = raycastTargets(origin, dir, range);
  const w = physics?.rayHit?.(origin, dir, range) ?? null;
  if (t && (!w || t.distance <= w.distance)) return { kind: 'target', hit: t, target: t.target, point: t.point.clone(), normal: dir.clone().negate(), distance: t.distance };
  if (w) return { kind: 'world', point: w.point.clone(), normal: w.normal.clone(), distance: w.distance };
  return { kind: 'none', point: origin.clone().addScaledVector(dir, range), normal: dir.clone().negate(), distance: range };
}

/**
 * A foam dart: integrates under gravity along -up and sweeps each step against
 * the registered targets and the world. step() returns an event or null:
 *   { type: 'target', hit, dir }            stuck to a target (call hitTarget)
 *   { type: 'world', point, normal, first }  bounced (or came to rest)
 */
export class Dart {
  constructor(pos, vel) {
    this.pos = pos.clone(); this.vel = vel.clone();
    this.state = 'fly'; this.age = 0; this.bounces = 0;
    this.dir = vel.clone().normalize();
  }
  step(dt, { physics, up, gravity = TOOL.dartGravity }) {
    this.age += dt;
    if (this.state !== 'fly') return null;
    this.vel.addScaledVector(up, -gravity * dt);
    const speed = this.vel.length();
    if (speed < 1e-6) return null;
    const len = speed * dt;
    _d.copy(this.vel).divideScalar(speed);
    this.dir.copy(_d);
    const t = raycastTargets(this.pos, _d, len);
    const w = physics?.rayHit?.(this.pos, _d, len + 0.05) ?? null;
    if (t && (!w || t.distance <= w.distance)) {
      this.state = 'stuck'; this.age = 0; this.hit = t;
      this.pos.copy(t.point);
      this.offset = t.point.clone().sub(t.target.position());
      return { type: 'target', hit: t, dir: this.dir.clone() };
    }
    if (w) {
      this.bounces++;
      const n = w.normal, vn = this.vel.dot(n);
      // soft foam: little rebound off the surface, a lot of scuff along it
      this.vel.addScaledVector(n, -vn).multiplyScalar(0.55).addScaledVector(n, -vn * 0.3);
      this.pos.copy(w.point).addScaledVector(n, 0.05);
      if (this.vel.length() < 3 || this.bounces >= 3) { this.state = 'rest'; this.age = 0; this.restN = n.clone(); }
      return { type: 'world', point: w.point.clone(), normal: n.clone(), first: this.bounces === 1 };
    }
    this.pos.addScaledVector(_d, len);
    if (this.age > 6) { this.state = 'rest'; this.age = 0; }
    return null;
  }
}

/**
 * The launch direction that lobs a dart at `speed` onto `to` under gravity g
 * along -up (the flatter of the two arcs), so the crosshair is where it lands.
 * Out of reach: the 45° throw toward it.
 */
export function launchDir(from, to, speed, g, up, out = new THREE.Vector3()) {
  const d = out.subVectors(to, from);
  const y = d.dot(up);
  const hv = d.addScaledVector(up, -y), h = hv.length();
  if (h < 1e-4) return out.copy(up).multiplyScalar(Math.sign(y) || 1);
  hv.divideScalar(h);
  const v2 = speed * speed, disc = v2 * v2 - g * (g * h * h + 2 * y * v2);
  const theta = g < 1e-6 ? Math.atan2(y, h) : disc < 0 ? Math.PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (g * h));
  return hv.multiplyScalar(Math.cos(theta)).addScaledVector(up, Math.sin(theta)).normalize();
}

/** Where a dart fired now would go: points along the arc and how it ends. */
export function predictArc(origin, vel, { physics, up, gravity = TOOL.dartGravity, dt = 1 / 24, steps = 48 }, out = []) {
  const d = new Dart(origin, vel);
  out.length = 0;
  let end = null;
  for (let i = 0; i < steps && !end; i++) {
    const e = d.step(dt, { physics, up, gravity });
    out.push(d.pos.clone());
    if (e) end = e;
  }
  return { points: out, end };
}

// ---------------------------------------------------------------- visuals

const INK = '#2b211f', CYAN = '#62c3c9', LAVENDER = '#a99be0', CORAL = '#e6875f', CREAM = '#f3ead8', BRASS = '#e2b552', STEEL = '#86a9d8';
const flatMat = (color, o = {}) => makeMaterial({ color, flat: true, ...o });

/** A tube re-laid every frame between two points: the ray's wavering strands. Ribbon mode: print colour bands (lavender to cyan) and a dot dissolve. */
class Strand {
  constructor(parent, { rings = 36, sides = 5 } = {}) {
    this.R = rings; this.S = sides;
    const n = rings * sides;
    this.pos = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3); this.fold = new Float32Array(n * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aFold', new THREE.BufferAttribute(this.fold, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let r = 0; r < rings - 1; r++) for (let k = 0; k < sides; k++) {
      const a = r * sides + k, b = r * sides + ((k + 1) % sides), c = a + sides, d = b + sides;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, makeMaterial({ color: '#ffffff', mode: MODE_RIBBON, glow: 1, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.userData.noCollide = true;
    parent.add(this.mesh);
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3();
  }
  /** Lay the strand from a to b: a travelling wave (amp m), radius r, fade 0..1 dissolves it. */
  set(a, b, time, { amp = 0.12, waves = 0.35, speed = 26, phase = 0, radius = 0.05, fade = 0, band = 0 }) {
    const T = this._t.subVectors(b, a), L = T.length();
    if (L < 1e-4) { this.mesh.visible = false; return; }
    T.divideScalar(L);
    const N = this._n.set(0, 1, 0).cross(T);
    if (N.lengthSq() < 1e-6) N.set(1, 0, 0).cross(T);
    N.normalize();
    const B = this._b.crossVectors(T, N).normalize();
    const { R, S } = this;
    for (let r = 0; r < R; r++) {
      const u = r / (R - 1), s = u * L;
      const env = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.6;         // pinned at the muzzle, loose at the far end
      const w = s * waves * Math.PI * 2 - time * speed + phase;
      const ox = Math.sin(w) * amp * env, oy = Math.cos(w * 0.7 + phase) * amp * env;
      const c = this._c.copy(a).addScaledVector(T, s).addScaledVector(N, ox).addScaledVector(B, oy);
      const rad = radius * (0.55 + 0.45 * Math.sin(Math.min(1, u * 6) * Math.PI / 2)) * (1 + 0.35 * Math.sin(w * 1.7));
      for (let k = 0; k < S; k++) {
        const th = (k / S) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        const nx = N.x * cs + B.x * sn, ny = N.y * cs + B.y * sn, nz = N.z * cs + B.z * sn;
        const j = (r * S + k) * 3;
        this.pos[j] = c.x + nx * rad; this.pos[j + 1] = c.y + ny * rad; this.pos[j + 2] = c.z + nz * rad;
        this.nrm[j] = nx; this.nrm[j + 1] = ny; this.nrm[j + 2] = nz;
        const f = (r * S + k) * 2;
        this.fold[f] = 3.55 + band + 0.45 * Math.sin(s * 0.9 - time * 31 + phase);   // lavender <-> cyan print bands
        this.fold[f + 1] = Math.min(0.99, fade + u * u * 0.25);
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.aFold.needsUpdate = true;
    this.mesh.visible = true;
  }
}

/** Instanced dots and dashes: ink rings, sparks, foam crumbs, the dart's dotted wake. */
class Dots {
  constructor(parent, max, material, geo = new THREE.SphereGeometry(1, 6, 4)) {
    this.mesh = new THREE.InstancedMesh(geo, material, max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.userData.noCollide = true;
    parent.add(this.mesh);
    this.max = max; this.list = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._c = new THREE.Color(); this._y = new THREE.Vector3(0, 1, 0); this._v = new THREE.Vector3();
  }
  add(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ drag: 0, grav: 0, stretch: 1, size: 0.05, life: 0.5, color: INK, ...p, pos: p.pos.clone(), vel: p.vel ? p.vel.clone() : new THREE.Vector3(), age: 0 });
  }
  update(dt, up) {
    this.list = this.list.filter((d) => (d.age += dt) < d.life);
    let i = 0;
    for (const d of this.list) {
      d.vel.multiplyScalar(Math.exp(-d.drag * dt)).addScaledVector(up, -d.grav * dt);
      d.pos.addScaledVector(d.vel, dt);
      const k = 1 - d.age / d.life, s = d.size * (d.grow ? 0.4 + 0.6 * Math.min(1, d.age * 8) : 1) * Math.min(1, k * 2.2);
      const sp = d.vel.length();
      if (d.stretch > 1 && sp > 0.05) this._q.setFromUnitVectors(this._y, this._v.copy(d.vel).divideScalar(sp));
      else this._q.identity();
      this._s.set(s, s * (d.stretch > 1 ? 1 + (d.stretch - 1) * Math.min(1, sp / 4) : 1), s);
      this._m.compose(d.pos, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, this._c.set(d.color));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** The emitter clipped onto the handheld device (device frame: +y along the forearm, +z the screen). */
function buildEmitter() {
  const g = new THREE.Group();
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.026, 0.03, 0.12, 10), flatMat(STEEL), 0, 0.06, -0.012);                          // barrel
  for (const y of [0.025, 0.075]) add(new THREE.TorusGeometry(0.031, 0.008, 5, 14).rotateX(Math.PI / 2), flatMat(BRASS), 0, y, -0.012);
  add(new THREE.CylinderGeometry(0.048, 0.026, 0.05, 12, 1, true), flatMat(BRASS, { side: THREE.DoubleSide }), 0, 0.142, -0.012);   // flared trumpet muzzle
  const lens = add(new THREE.SphereGeometry(0.024, 10, 8), makeMaterial({ color: CYAN, flat: true, glow: 0.9 }), 0, 0.14, -0.012);
  // a fin and a little ball aerial on the back, Moebius retro-futurist
  const fin = add(new THREE.BoxGeometry(0.006, 0.07, 0.04), flatMat('#5f86bf'), 0, 0.05, -0.05);
  fin.rotation.x = -0.35;
  add(new THREE.CylinderGeometry(0.003, 0.003, 0.07, 4), flatMat(INK), 0.022, 0.03, -0.035).rotation.z = -0.4;
  add(new THREE.SphereGeometry(0.009, 6, 5), flatMat(BRASS), 0.036, 0.062, -0.035);
  // the loaded dart pokes out of the trumpet in dart mode
  const loaded = add(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 8), flatMat(CORAL), 0, 0.155, -0.012);
  const loadedTip = add(new THREE.SphereGeometry(0.02, 8, 6), flatMat('#c8483a'), 0, 0.188, -0.012);
  g.traverse((o) => { o.userData.noCollide = true; });
  g.position.set(0, 0.06, 0);
  return { group: g, lens, loaded: [loaded, loadedTip], muzzle: new THREE.Vector3(0, 0.2, -0.012) };
}

function buildDartMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10), flatMat(CORAL));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), flatMat('#c8483a'));
  tip.position.y = 0.17;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.045, 10), flatMat(CREAM));
  band.position.y = -0.13;
  g.add(body, tip, band);
  g.traverse((o) => { o.userData.noCollide = true; });
  g.visible = false;
  return g;
}

// ---------------------------------------------------------------- the tool

const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Vector3(), _a = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();

export class Blaster {
  /**
   * @param o.player    Player (frame, gear.device, aim pose, vehicles)
   * @param o.camera    the aim ray comes from the camera centre (the crosshair)
   * @param o.rig       CameraRig (moves over the shoulder while aiming)
   * @param o.level     optional: level.targets are registered too
   * @param o.hud       optional ToolHud (crosshair, mode, gauge)
   * @param o.noShadow  array of objects hidden from the shadow passes
   */
  constructor({ scene, player, physics, camera, rig = null, sound = null, level = null, hud = null, noShadow = null }) {
    Object.assign(this, { scene, player, physics, camera, rig, sound, hud });
    this.mode = 'stun';
    this.k = 0; this.energy = 1; this.cooldown = 0; this.sinceShot = 9; this.quick = 0;
    this.pending = false; this.time = 0;
    this.held = { fire: false, mode: false };
    this.aimPoint = new THREE.Vector3(); this.aimDir = new THREE.Vector3(0, 0, -1);
    this.aimEnd = null;
    this.darts = [];
    this.beams = [];
    this.flash = 0; this.lastHit = null;

    const fx = (this.fx = new THREE.Group());
    fx.name = 'Tool effects'; fx.userData.noCollide = true;
    scene?.add(fx);
    noShadow?.push(fx);
    this.ink = new Dots(fx, 420, flatMat('#ffffff'));
    this.glow = new Dots(fx, 220, makeMaterial({ color: '#ffffff', flat: true, glow: 0.95 }));
    this.arc = new Dots(fx, 48, flatMat('#ffffff'));
    this.strands = [new Strand(fx), new Strand(fx, { rings: 30, sides: 4 })];
    this.dartMeshes = Array.from({ length: TOOL.maxDarts }, () => { const m = buildDartMesh(); fx.add(m); return m; });

    const dev = player?.gear?.device;
    if (dev) {
      this.emitter = buildEmitter();
      dev.add(this.emitter.group);
      markHero(this.emitter.group);
    }
    this.setMode('stun', true);

    // Things the darts wake from afar: taxis cruising their lanes get hailed, and whatever the level offers.
    this.offs = [];
    for (const v of player?.vehicles ?? []) {
      if (!v.hail) continue;
      this.offs.push(registerTarget({ kind: 'vehicle', radius: 2.6, position: () => v.pos,
        enabled: () => v.mode === 'lane' || v.mode === 'return',
        onHit: (mode) => { if (mode === 'dart') v.hail(player.pos, player.heading); return mode === 'dart'; } }));
    }
    for (const t of level?.targets ?? []) this.offs.push(registerTarget(t));
  }

  dispose() { this.offs.forEach((off) => off()); this.offs = []; this.fx.removeFromParent(); this.emitter?.group.removeFromParent(); }

  get aiming() { return this.k > 0.5; }

  setMode(mode, silent = false) {
    if (!MODES.includes(mode)) return;
    this.mode = mode;
    if (this.emitter) for (const o of this.emitter.loaded) o.visible = mode === 'dart';
    if (!silent) this.sound?.toolClick?.(mode === 'dart');
  }
  cycleMode() { this.setMode(MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]); }

  /** Can the tool come out right now? Put away while riding, gliding, climbing, on the jetpack, in menus and photo mode. */
  allowed(paused) {
    const p = this.player;
    return !paused && !!p && !p.ride && !p.gliding && !p.climbing && !p.mantle && !p.thrusting && p.object?.visible !== false;
  }

  /** World position of the muzzle (the device's emitter, or the chest if there's no device). */
  muzzle(out = new THREE.Vector3()) {
    const dev = this.player?.gear?.device;
    if (this.emitter && dev?.visible) {
      dev.updateMatrixWorld(true);
      return this.emitter.group.localToWorld(out.copy(this.emitter.muzzle));
    }
    const p = this.player;
    return out.copy(p.pos).addScaledVector(p.frame.up, 1.45).addScaledVector(p.frame.dir(p.heading, _a), 0.45);
  }

  /** The crosshair's point: along the camera ray (skipping what's behind the player), the first target or surface, else at full range. */
  updateAimPoint() {
    const cam = this.camera, p = this.player;
    cam.getWorldDirection(this.aimDir);
    const o = _o.copy(cam.position);
    const chest = _t1.copy(p.pos).addScaledVector(p.frame.up, 1.4);
    const skip = Math.max(0, _t2.subVectors(chest, o).dot(this.aimDir) - 0.5);
    o.addScaledVector(this.aimDir, skip);
    const shot = traceShot(this.physics, o, this.aimDir, TOOL.range + 4);
    this.aimPoint.copy(shot.point);
    this.aimKind = shot.kind;
    return shot;
  }

  /** Per frame, after the player and camera moved. ctl is the merged input (or {} in menus). */
  update(dt, ctl = {}, paused = false) {
    this.time += dt;
    const p = this.player, input = toolInput(paused ? {} : ctl);
    const ok = this.allowed(paused);
    const firePress = input.fire && !this.held.fire, modePress = input.mode && !this.held.mode;
    this.held.fire = input.fire; this.held.mode = input.mode;
    if (ok && modePress) this.cycleMode();
    if (ok && firePress) { this.pending = true; if (!input.aim) this.quick = 0.9; }
    this.quick = Math.max(0, this.quick - dt);
    const want = ok && (input.aim || this.quick > 0);
    if (!ok) { this.pending = false; this.quick = 0; }
    this.k += ((want ? 1 : 0) - this.k) * (1 - Math.exp(-(want ? 11 : ok ? 7 : 14) * dt));
    if (this.k < 0.002) this.k = 0;

    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceShot += dt;
    if (this.sinceShot > TOOL.regenDelay) this.energy = Math.min(1, this.energy + TOOL.regen * dt);

    if (this.k > 0 && p) {
      this.updateAimPoint();
      p.aim = Object.assign(this._pose ??= {}, { k: this.k, point: this.aimPoint, dir: this.aimDir });
      // fire once the arm is up; the ray repeats while held
      const ready = this.k > 0.8 && this.cooldown === 0;
      if (ready && (this.pending || (input.fire && this.mode === 'stun'))) {
        this.pending = false;
        this.fire();
        if (input.fire) this.quick = Math.max(this.quick, 0.5);
      }
    } else if (p) p.aim = null;
    if (this.rig) this.rig.aimK = this.k * this.k * (3 - 2 * this.k);

    this.updateDarts(dt);
    this.updateBeams(dt);
    this.updateArc(ok && this.k > 0.6 && this.mode === 'dart');
    const up = p?.frame.up ?? _y;
    this.ink.update(dt, up); this.glow.update(dt, up);
    if (this.emitter) {
      const glow = this.emitter.lens.scale;
      glow.setScalar(1 + this.flash * 0.9 + (this.mode === 'stun' ? 0.15 * Math.sin(this.time * 9) * this.k : 0));
    }
    this.flash = Math.max(0, this.flash - dt * 5);
    this.hud?.update({ on: this.k > 0.5, mode: this.mode, name: MODE_NAMES[this.mode], energy: this.energy, ready: this.cooldown === 0 && (this.mode === 'dart' || this.energy >= TOOL.stunCost), aimKind: this.aimKind, hit: this.lastHit });
    this.lastHit = null;
  }

  /** Fire in the current mode now (the arm is assumed to be up). Returns what happened. */
  fire() {
    const from = this.muzzle(_m);
    const dir = _f.subVectors(this.aimPoint, from);
    const dist = dir.length();
    if (dist < 2) dir.copy(this.aimDir); else dir.divideScalar(dist);
    this.flash = 1;
    this.sinceShot = 0;
    if (this.mode === 'stun') {
      if (this.energy < TOOL.stunCost) { this.cooldown = 0.25; this.sound?.toolClick?.(false, true); this.lastHit = 'empty'; return { kind: 'empty' }; }
      this.energy -= TOOL.stunCost;
      this.cooldown = TOOL.stunCooldown;
      const shot = traceShot(this.physics, from, dir, TOOL.range);
      if (shot.kind === 'target') hitTarget(shot.hit, 'stun', dir.clone());
      this.beams.push({ from: from.clone(), to: shot.point.clone(), age: 0, life: 0.26, kind: shot.kind, target: shot.target, phase: Math.random() * 6 });
      this.sound?.zap?.();
      this.burstAt(shot, 'stun');
      return shot;
    }
    this.cooldown = TOOL.dartCooldown;
    if (dist >= 2 && this.aimKind !== 'none') launchDir(from, this.aimPoint, TOOL.dartSpeed, TOOL.dartGravity, this.player.frame.up, dir);
    const dart = new Dart(from, dir.clone().multiplyScalar(TOOL.dartSpeed));
    dart.mesh = this.dartMeshes.find((m) => !m.visible) ?? this.recycleDart();
    dart.mesh.visible = true;
    this.darts.push(dart);
    this.sound?.puff?.();
    for (let i = 0; i < 5; i++) this.ink.add({ pos: from, vel: _a.copy(dir).multiplyScalar(2 + i).add(_t1.randomDirection().multiplyScalar(0.6)), drag: 7, size: 0.02, life: 0.3, color: CREAM });
    return { kind: 'dart', dart };
  }

  recycleDart() {
    const old = this.darts.shift();
    return old.mesh;
  }

  /** Hit feedback. Targets: a pop, two inked rings and dashes flying off (foam crumbs for darts); the world: a soft dusty tick; nothing: a faint fizzle. */
  burstAt(shot, mode) {
    const pt = shot.point, n = shot.normal;
    const T = _t1.set(0, 1, 0).cross(n);
    if (T.lengthSq() < 1e-4) T.set(1, 0, 0).cross(n);
    T.normalize();
    const B = _t2.crossVectors(n, T).normalize();
    // far hits draw bigger, so the burst still reads as a mark on the page
    const sc = this.camera ? THREE.MathUtils.clamp(pt.distanceTo(this.camera.position) / 12, 1, 3) : 1;
    const ring = (count, speed, size, color, drag, life, dots = this.ink) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        dots.add({ pos: pt, vel: new THREE.Vector3().addScaledVector(T, Math.cos(a) * speed * sc).addScaledVector(B, Math.sin(a) * speed * sc), drag, size: size * sc, life, color });
      }
    };
    if (shot.kind === 'target') {
      this.lastHit = 'target';
      this.sound?.pop?.(mode);
      ring(22, 9, 0.045, INK, 7, 0.55);
      ring(14, 4.5, 0.05, INK, 7, 0.65);
      ring(16, 6.5, 0.04, mode === 'stun' ? CYAN : CORAL, 6, 0.5, mode === 'stun' ? this.glow : this.ink);
      for (let i = 0; i < 10; i++) {
        const v = new THREE.Vector3().randomDirection().addScaledVector(n, 1.2).normalize().multiplyScalar((4 + Math.random() * 5) * sc);
        this.ink.add({ pos: pt, vel: v, drag: 3, grav: 6, size: 0.03 * sc, stretch: 4, life: 0.5 + Math.random() * 0.3, color: i % 3 ? INK : (mode === 'stun' ? LAVENDER : CREAM) });
      }
      if (mode === 'stun') for (let i = 0; i < 8; i++) this.glow.add({ pos: pt, vel: new THREE.Vector3().randomDirection().multiplyScalar(1.5 * sc), drag: 2, size: 0.07 * sc, life: 0.9, color: i % 2 ? CYAN : LAVENDER, grow: true });
    } else if (shot.kind === 'world') {
      this.lastHit = 'world';
      this.sound?.tap?.(mode);
      ring(12, 3, 0.03, mode === 'stun' ? INK : CREAM, 8, 0.4);
      if (mode === 'stun') ring(8, 1.8, 0.04, CYAN, 6, 0.45, this.glow);
    } else {
      this.sound?.fizzle?.();
      for (let i = 0; i < 6; i++) this.glow.add({ pos: pt, vel: new THREE.Vector3().randomDirection().multiplyScalar(0.8), drag: 3, size: 0.05, life: 0.4, color: CYAN });
    }
  }

  updateBeams(dt) {
    this.beams = this.beams.filter((b) => (b.age += dt) < b.life);
    const b = this.beams[this.beams.length - 1];
    if (!b) { for (const s of this.strands) s.mesh.visible = false; return; }
    // the near end stays on the muzzle as the arm moves; the far end on a moving target
    if (this.player?.gear?.device?.visible) this.muzzle(b.from);
    if (b.target) b.to.copy(b.target.position());
    const k = b.age / b.life, fade = THREE.MathUtils.smoothstep(k, 0.25, 1);
    this.strands[0].set(b.from, b.to, this.time, { amp: 0.03 + 0.06 * k, waves: 0.45, speed: 30, phase: b.phase, radius: 0.042 * (1 - 0.4 * k), fade });
    this.strands[1].set(b.from, b.to, this.time, { amp: 0.11 + 0.1 * k, waves: 0.6, speed: -24, phase: b.phase + 2.1, radius: 0.016, fade: Math.min(1, fade + 0.15), band: -0.4 });
  }

  updateDarts(dt) {
    const up = this.player?.frame.up ?? _y;
    for (const d of this.darts) {
      if (d.state === 'fly') {
        const lastWake = d.wake ?? 0;
        // substeps keep the sweep short against thin targets
        const n = Math.max(1, Math.ceil(dt / (1 / 60)));
        for (let i = 0; i < n && d.state === 'fly'; i++) {
          const e = d.step(dt / n, { physics: this.physics, up });
          if (!e) continue;
          if (e.type === 'target') {
            hitTarget(e.hit, 'dart', e.dir);
            this.burstAt({ kind: 'target', point: e.hit.point, normal: e.dir.clone().negate() }, 'dart');
          } else if (e.first) this.burstAt({ kind: 'world', point: e.point, normal: e.normal }, 'dart');
        }
        if ((d.wake = lastWake + dt) > 0.035) { d.wake = 0; this.ink.add({ pos: d.pos, size: 0.03, life: 0.6, color: INK }); }
      }
      if (d.state === 'stuck' && d.hit) d.pos.copy(d.hit.target.position()).add(d.offset);
      // orient along flight; a stuck dart wobbles, then pops; a resting one lies there and shrinks away
      const m = d.mesh;
      m.position.copy(d.pos);
      if (d.state === 'fly' || d.state === 'stuck') m.quaternion.setFromUnitVectors(_y, d.dir);
      let s = 1;
      if (d.state === 'stuck') {
        m.quaternion.multiply(_q.setFromAxisAngle(_a.set(1, 0, 0), Math.sin(d.age * 40) * 0.25 * (1 - d.age / 0.5)));
        if (d.age > 0.5) d.dead = true;
      } else if (d.state === 'rest') {
        s = 1 - THREE.MathUtils.smoothstep(d.age, 2.2, 2.8);
        if (d.age > 2.8) d.dead = true;
      }
      m.scale.setScalar(Math.max(s, 0.001));
    }
    for (const d of this.darts) if (d.dead) {
      if (d.state === 'stuck') for (let i = 0; i < 6; i++) this.ink.add({ pos: d.pos, vel: new THREE.Vector3().randomDirection().multiplyScalar(2.5), drag: 4, grav: 5, size: 0.03, life: 0.5, color: i % 2 ? CORAL : CREAM });
      d.mesh.visible = false;
    }
    this.darts = this.darts.filter((d) => !d.dead);
  }

  /** Dart mode: a dotted ink arc shows where the dart will fly. */
  updateArc(on) {
    if (!on) { this.arc.list.length = 0; this.arc.update(0, _y); return; }
    const from = this.muzzle(_m);
    const dir = _f.subVectors(this.aimPoint, from);
    if (dir.length() < 2) dir.copy(this.aimDir);
    else if (this.aimKind === 'none') dir.normalize();
    else launchDir(from, this.aimPoint, TOOL.dartSpeed, TOOL.dartGravity, this.player.frame.up, dir);
    const { points, end } = predictArc(from, dir.multiplyScalar(TOOL.dartSpeed), { physics: this.physics, up: this.player.frame.up }, this._arc ??= []);
    this.arc.list.length = 0;
    for (let i = 2; i < points.length; i += 1) this.arc.list.push({ pos: points[i], vel: new THREE.Vector3(), drag: 0, grav: 0, stretch: 1, size: 0.035 * this.k, life: 1, age: 0, color: end?.type === 'target' ? CORAL : INK });
    if (end) this.arc.list.push({ pos: end.type === 'target' ? end.hit.point : end.point, vel: new THREE.Vector3(), drag: 0, grav: 0, stretch: 1, size: 0.09 * this.k, life: 1, age: 0, color: end.type === 'target' ? CORAL : INK });
    this.arc.update(0, _y);
  }

  /** One line for the HUD while aiming. */
  hudText(pad = false) {
    const n = Math.round(this.energy * 5);
    const gauge = this.mode === 'stun' ? ` [${'■'.repeat(n)}${'·'.repeat(5 - n)}]` : '';
    const touch = globalThis.document?.body?.classList.contains('touch');
    return `${MODE_NAMES[this.mode]}${gauge} · ${pad ? 'RT / R2 fire · ← → switch' : touch ? '✺ fire · ⇄ switch' : 'click / G fire · X switch'}`;
  }
}
