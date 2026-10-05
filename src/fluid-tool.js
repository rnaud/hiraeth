import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, markHero, MODE_RIBBON } from './materials.js';
import { raycastTargets, hitTarget, registerTarget, targetsInCone } from './targets.js';
import { game as sharedGame } from './game-state.js';
import { items as sharedItems } from './items.js';
import { MODES, STUN_SECONDS, FluidWings, FluidJets, HANDOFF, handoffPose, nextMode, ownedModes } from './fluid-kit.js';

// The magic-fluid backpack: the traveller's signature tool. A glass tank of
// shifting, lava-lamp fluid rides on the back; a ribbed hose runs from its cap
// over the right shoulder and down the arm to a brass nozzle on a bracer. Three abilities share one reserve
// of three charges (docs/game-brief.md, working decision 4):
//   shoot  a glob of fluid on a slight arc: it splashes on whatever it meets
//          and leaves a short-lived colourful splat on surfaces
//          (targets: onHit('shoot', point, dir, info))
//   push   a short cone of fluid shock (~6 m) that knocks people, creatures
//          and loose things away (targets in the cone: onHit('push', point, dir, info))
//   boost  a powered jump: press jump again in the air for a strong burst up
//          (and a little forward) on a spray of fluid. Holding jump after it
//          still opens the wings once you fall (with the glider). With the
//          jets, holding jump thrusts instead, and a quick double tap boosts.
// Two seconds after the last use, all three charges refill at once.
//
// Everything runs on the backpack (src/items.js): without items.has('backpack')
// the tank, hose and bracer are not worn and nothing fires. The other items
// grow out of it (fluid-kit.js):
//   jetpack  two nozzles under the tank. Thrust burns the same reserve as a
//            smooth gauge (FLUID.jet.drain charges a second: a full tank is
//            ten seconds of flight); a shot needs a whole charge left. The
//            refill clock waits until you land after a burn, then the usual
//            two seconds refill everything.
//   glider   fluid wings bloom out of the tank while gliding (hold jump while falling)
//   stun / fire   gun modes (X, the pad's D-pad left / right, the touch ◐ button): the glob
//            stills (onHit 'stun') or burns ('fire') instead of splashing; all
//            modes share the three charges (targets.js: who accepts which mode)
// Vehicles run on it too: boarding a powered vehicle swings the tank off the back into
// its socket (the player's boarding / unboarding timers, HANDOFF), and back on when you
// step off. While it is in a socket the tool is unavailable.
// The tank shows the fill as three stacked bands of colour; the bracer has
// three rings that light for the charges left. Magical water (the desert's
// cave) refills it and adds a colour band for good: tool.refill({ addColour: true }).
//
// Story API (main.js builds one FluidTool, window.tool; story code needs no
// import and can use the game-state bus instead, see game-state.js):
//   tool.charges          0..3
//   tool.colours          colour bands added to the fluid (game flag tool.colours, 1 at the start)
//   tool.tones            the tones in the blend, hex strings
//   tool.enabled          false: put away, nothing fires (the ship prologue, cutscenes)
//   tool.owned            the backpack is found (items.has('backpack'))
//   tool.mode / tool.modes / tool.setMode(id) / tool.cycleMode(±1)   'shoot' | 'stun' | 'fire'
//   tool.refill({ addColour, tone })   fill now; addColour adds a band (tone: its colour, optional)
//   game.emit('tool:refill', { addColour: true }) · game.emit('tool:enable', { on: false })
//   emits 'tool:fire' { mode, point } (mode: shoot / stun / fire / push / boost / jet start),
//   'tool:refilled' { charges, colours, added }, 'tool:mode' { mode }, 'tool:dock' { vehicle, on }

/** Every tuning value in one place. */
export const FLUID = {
  charges: 3,             // one reserve shared by shoot, boost and push
  refillDelay: 2,         // s after the last use (after landing, for the jets), all three come back at once
  maxColours: 5,          // colour bands magical water can add (the blend shows colours + 1 tones)
  shoot: { speed: 30, gravity: 8, range: 42, cooldown: 0.28, splatLife: 5, splatSize: 0.75 },
  push: { range: 6, angle: 0.62, cooldown: 0.4, shove: 2.4, recoil: 2.2 },    // angle: cone half-angle (rad, ~35°); shove: metres people are knocked back (info.shove)
  boost: { up: 15, forward: 4, keep: 0.35, doubleTap: 0.35 },              // keep: share of a rising jump's speed kept
  jet: { drain: 0.3, min: 0.02 },  // charges burnt per second of thrust (3 = 10 s); min: the gauge that still lights them
};

// The fluid's tones, in the order bands are added (written into the shader's uFluidTones).
// A world's source can bring its own tone instead: refill({ addColour: true, tone: '#e9a53c' }).
export const FLUID_TONES = ['#52c8cf', '#966ede', '#ef7e62', '#f6c84e', '#ed80b0', '#83cf71'];
/** The tones in the blend for a number of colour bands (1 -> cyan and violet); custom[i] overrides tone i. */
export const fluidTones = (colours = 1, custom = []) => FLUID_TONES.slice(0, THREE.MathUtils.clamp(Math.round(colours), 1, FLUID.maxColours) + 1).map((t, i) => (i >= 2 && custom?.[i]) || t);

/** Map raw input (keyboard, mouse, gamepad and touch all write into the same object) to the tool's controls. Boost is jump in the air (player.js). */
export function toolInput(c = {}) {
  return {
    aim: !!(c.KeyR || c.MouseRight || c.PadAim),
    shoot: !!(c.KeyG || c.MouseLeft || c.PadFire),
    push: !!(c.KeyC || c.MouseMiddle || c.PadPush),
    mode: !!(c.KeyX || c.PadModeNext),     // the next owned gun mode
    modeBack: !!c.PadModePrev,             // the previous one (D-pad left)
  };
}

/** Mouse: hold the right button to aim, the left button shoots (while aiming or with the pointer captured), the middle button pushes. */
export function bindToolMouse(dom, input) {
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('mousedown', (e) => {
    if (e.button === 2) input.MouseRight = true;
    if (e.button === 1) { input.MouseMiddle = true; e.preventDefault(); }
    if (e.button === 0 && (document.pointerLockElement === dom || input.MouseRight)) input.MouseLeft = true;
  });
  window.addEventListener('mouseup', (e) => { const k = ['MouseLeft', 'MouseMiddle', 'MouseRight'][e.button]; if (k) input[k] = false; });
}

/**
 * The shared reserve: a gauge of `max` charges. use() spends a whole charge
 * if there is one; drain(amount) burns part of one (the jets); update(dt)
 * counts the time since the last use and refills everything at once after
 * FLUID.refillDelay (returns true on that frame). hold() keeps the clock at 0.
 */
export class Reserve {
  constructor(max = FLUID.charges, delay = FLUID.refillDelay) {
    this.max = max; this.delay = delay; this.level = max; this.since = Infinity;
  }
  /** Whole charges left. */
  get charges() { return Math.floor(this.level + 1e-6); }
  set charges(n) { this.level = n; }
  use() {
    if (this.level < 1 - 1e-6) return false;
    this.level = Math.max(0, this.level - 1); this.since = 0;
    return true;
  }
  /** Burn up to `amount` of the gauge; returns what was burnt. */
  drain(amount) {
    if (this.level <= 0) return 0;
    const d = Math.min(this.level, amount);
    this.level -= d; this.since = 0;
    return d;
  }
  hold() { if (this.level < this.max) this.since = 0; }
  update(dt) {
    if (this.level >= this.max) return false;
    this.since += dt;
    if (this.since < this.delay - 1e-9) return false;
    this.level = this.max;
    return true;
  }
  /** Seconds until the refill (0 when full). */
  get refillIn() { return this.level >= this.max ? 0 : Math.max(0, this.delay - this.since); }
  fill() { this.level = this.max; this.since = Infinity; }
}

const _d = new THREE.Vector3(), _rp = new THREE.Vector3();

/**
 * The first world surface along a ray: the collision meshes (physics.rayHit)
 * and the level's heightfield (physics.base, the dunes), which the mesh rays
 * don't see. Returns { distance, point, normal } or null.
 */
export function rayWorld(physics, origin, dir, far) {
  const w = physics?.rayHit?.(origin, dir, far) ?? null;
  const base = physics?.base?.heightAt ? physics.base : null;
  if (!base) return w;
  const lim = w ? w.distance : far;
  const above = (t) => { _rp.copy(origin).addScaledVector(dir, t); const h = base.heightAt(_rp.x, _rp.z); return Number.isFinite(h) ? _rp.y - h : 1; };
  if (above(0) < 0) return w;   // starting under the heightfield (inside a cave): only the meshes count
  const step = Math.max(0.6, lim / 64);
  let t0 = 0;
  for (let t = Math.min(step, lim); ; t = Math.min(t + step, lim)) {
    if (above(t) < 0) {
      let a = t0, b = t;
      for (let i = 0; i < 10; i++) { const m = (a + b) / 2; if (above(m) < 0) b = m; else a = m; }
      const point = origin.clone().addScaledVector(dir, b), e = 0.35, H = (x, z) => base.heightAt(x, z);
      const normal = new THREE.Vector3(H(point.x - e, point.z) - H(point.x + e, point.z), 2 * e, H(point.x, point.z - e) - H(point.x, point.z + e)).normalize();
      return { distance: b, point, normal };
    }
    if (t >= lim) return w;
    t0 = t;
  }
}

/**
 * One straight trace: the nearest registered target along the ray, unless the
 * world is in the way (the crosshair uses it). Returns { kind: 'target' |
 * 'world' | 'none', point, normal, distance, hit? }.
 */
export function traceShot(physics, origin, dir, range = FLUID.shoot.range) {
  const t = raycastTargets(origin, dir, range);
  const w = rayWorld(physics, origin, dir, range);
  if (t && (!w || t.distance <= w.distance)) return { kind: 'target', hit: t, target: t.target, point: t.point.clone(), normal: dir.clone().negate(), distance: t.distance };
  if (w) return { kind: 'world', point: w.point.clone(), normal: w.normal.clone(), distance: w.distance };
  return { kind: 'none', point: origin.clone().addScaledVector(dir, range), normal: dir.clone().negate(), distance: range };
}

/**
 * A glob of fluid: flies under a light gravity along -up (which can point
 * anywhere) and sweeps each step against the targets and the world. step()
 * returns an event or null:
 *   { type: 'target', hit, dir }       it splashed on a target (call hitTarget)
 *   { type: 'world', point, normal }   it splatted on a surface
 *   { type: 'expire' }                 it flew out of reach
 */
export class Glob {
  constructor(pos, vel) {
    this.pos = pos.clone(); this.vel = vel.clone();
    this.dir = vel.clone().normalize();
    this.state = 'fly'; this.age = 0; this.travel = 0;
  }
  step(dt, { physics, up, gravity = FLUID.shoot.gravity, range = FLUID.shoot.range }) {
    this.age += dt;
    if (this.state !== 'fly') return null;
    this.vel.addScaledVector(up, -gravity * dt);
    const speed = this.vel.length();
    if (speed < 1e-6) return null;
    const len = speed * dt;
    _d.copy(this.vel).divideScalar(speed);
    this.dir.copy(_d);
    const t = raycastTargets(this.pos, _d, len);
    const w = rayWorld(physics, this.pos, _d, len + 0.05);
    if (t && (!w || t.distance <= w.distance)) {
      this.state = 'hit'; this.pos.copy(t.point);
      return { type: 'target', hit: t, dir: this.dir.clone() };
    }
    if (w) {
      this.state = 'splat'; this.pos.copy(w.point);
      return { type: 'world', point: w.point.clone(), normal: w.normal.clone() };
    }
    this.pos.addScaledVector(_d, len);
    if ((this.travel += len) > range * 1.6 || this.age > 4) { this.state = 'gone'; return { type: 'expire' }; }
    return null;
  }
}

/**
 * The launch direction that lobs a glob at `speed` onto `to` under gravity g
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

/** Where a glob fired now would go: points along the arc and how it ends. */
export function predictArc(origin, vel, { physics, up, gravity = FLUID.shoot.gravity, dt = 1 / 30, steps = 40 }, out = []) {
  const g = new Glob(origin, vel);
  out.length = 0;
  let end = null;
  for (let i = 0; i < steps && !end; i++) {
    const e = g.step(dt, { physics, up, gravity });
    out.push(g.pos.clone());
    if (e) end = e;
  }
  return { points: out, end: end?.type === 'expire' ? null : end };
}

/**
 * A boost: the velocity along up becomes a fresh burst (keeping a share of a
 * jump that is still rising), plus a push along fwd (unit, tangent). Works in
 * any gravity frame. Mutates and returns vel.
 */
export function boostVelocity(vel, up, fwd, { up: burst = FLUID.boost.up, forward = FLUID.boost.forward, keep = FLUID.boost.keep } = {}) {
  const vu = vel.dot(up);
  vel.addScaledVector(up, burst + Math.max(vu, 0) * keep - vu);
  if (fwd) vel.addScaledVector(fwd, forward);
  return vel;
}

// ---------------------------------------------------------------- visuals

const INK = '#2b211f', BRASS = '#e2b552', BRASS_DARK = '#b5862f', STEEL = '#86a9d8', STEEL_DARK = '#5f86bf', RUBBER = '#3c4a78';
// the tank's brass, steel and iron are metal (materials.js METALS); lit parts stay lights
const METAL_OF = { [BRASS]: 'brass', [BRASS_DARK]: 'brass', [STEEL]: 'steel', [STEEL_DARK]: 'painted', [INK]: 'iron' };
const flatMat = (color, o = {}) => makeMaterial({ color, flat: true, ...(METAL_OF[color] && !o.glow ? { metal: METAL_OF[color] } : {}), ...o });
const noCollide = (root) => { root.traverse((o) => { o.userData.noCollide = true; }); return root; };
/** Bake a group's static parts into one mesh per material (fewer draws in every pass); `keep` stay as they are. */
function mergeParts(group, keep = []) {
  const batches = new Map();
  for (const o of [...group.children]) {
    if (!o.isMesh || keep.includes(o)) continue;
    o.updateMatrix();
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(o.matrix);
    if (!batches.has(o.material)) batches.set(o.material, []);
    batches.get(o.material).push(g);
    group.remove(o); o.geometry.dispose();
  }
  for (const [material, parts] of batches) { group.add(new THREE.Mesh(mergeGeometries(parts), material)); parts.forEach((g) => g.dispose()); }
  return group;
}

/** Instanced dots and dashes: droplets, sprays, the glob's wake, the aim arc. */
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
    if (!this.list.length && !this.mesh.count) return;
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

/** A lumpy splat in the xy plane (facing +z): a blob with a few satellite drops. */
function splatGeometry(seed = 3) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const parts = [];
  const blob = (cx, cy, r, n, lump) => {
    const pos = [0, 0, 0], idx = [];
    const ph = rnd() * 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, k = 1 + lump * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 5 + ph * 2) * 0.3 + (rnd() - 0.5) * 0.4);
      pos.push(Math.cos(a) * r * k, Math.sin(a) * r * k, 0);
      idx.push(0, 1 + i, 1 + ((i + 1) % n));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.translate(cx, cy, 0);
    parts.push(g);
  };
  blob(0, 0, 1, 22, 0.32);
  for (let i = 0; i < 5; i++) { const a = rnd() * Math.PI * 2, d = 1.25 + rnd() * 0.45; blob(Math.cos(a) * d, Math.sin(a) * d, 0.12 + rnd() * 0.12, 8, 0.15); }
  const g = mergeGeometries(parts);
  const n = g.attributes.position.count;
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  return g;
}

/** Short-lived colourful splats where globs land: two tones, grown fast, shrinking away. */
class Splats {
  constructor(parent, max = 36) {
    this.mesh = new THREE.InstancedMesh(splatGeometry(), makeMaterial({ color: '#ffffff', flat: true, glow: 0.55, side: THREE.DoubleSide }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.userData.noCollide = true;
    parent.add(this.mesh);
    this.max = max; this.list = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._z = new THREE.Vector3(0, 0, 1); this._c = new THREE.Color();
  }
  /** A splat on a surface (point, unit normal) in two tones. */
  add(point, normal, toneA, toneB, size = FLUID.shoot.splatSize, life = FLUID.shoot.splatLife) {
    const q = new THREE.Quaternion().setFromUnitVectors(this._z, normal).multiply(new THREE.Quaternion().setFromAxisAngle(this._z, Math.random() * Math.PI * 2));
    const sq = 0.8 + Math.random() * 0.35;
    for (const [tone, k, lift] of [[toneA, 1, 0.03], [toneB, 0.5, 0.045]]) {
      if (this.list.length >= this.max) this.list.shift();
      this.list.push({ pos: point.clone().addScaledVector(normal, lift), q, sx: size * k * sq, sy: size * k / sq, color: tone, age: 0, life: life * (k < 1 ? 0.85 : 1) });
    }
  }
  update(dt) {
    if (!this.list.length && !this.mesh.count) return;
    this.list = this.list.filter((s) => (s.age += dt) < s.life);
    let i = 0;
    for (const s of this.list) {
      // pops out with a little overshoot, holds, then shrinks away
      const a = s.age, grow = a < 0.14 ? Math.sin((a / 0.14) * Math.PI * 0.62) / Math.sin(Math.PI * 0.62) * 1.12 : 1.12 - 0.12 * Math.min(1, (a - 0.14) / 0.2);
      const k = grow * (1 - THREE.MathUtils.smoothstep(a, s.life - 1.1, s.life));
      this._m.compose(s.pos, s.q, this._s.set(s.sx * k, s.sy * k, 1));
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, this._c.set(s.color));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Expanding inked rings: the push's shock front and the boost's ground ring. */
class Rings {
  constructor(parent, max = 8) {
    this.mesh = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.07, 4, 32), makeMaterial({ color: '#ffffff', flat: true, glow: 0.8 }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.userData.noCollide = true;
    parent.add(this.mesh);
    this.max = max; this.list = [];
    this._m = new THREE.Matrix4(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._z = new THREE.Vector3(0, 0, 1); this._c = new THREE.Color();
  }
  /** A ring travelling from `from` along dir (unit) to `reach` metres, its radius growing from r0 to r1. */
  add({ from, dir, reach = 0, r0 = 0.2, r1 = 1, life = 0.35, delay = 0, color = '#ffffff', thick = 1 }) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ from: from.clone(), dir: dir.clone(), q: new THREE.Quaternion().setFromUnitVectors(this._z, dir), reach, r0, r1, life, age: -delay, color, thick });
  }
  update(dt) {
    if (!this.list.length && !this.mesh.count) return;
    this.list = this.list.filter((r) => (r.age += dt) < r.life);
    let i = 0;
    for (const r of this.list) {
      if (r.age < 0) continue;
      const k = r.age / r.life, e = 1 - (1 - k) * (1 - k);
      const rad = THREE.MathUtils.lerp(r.r0, r.r1, e), th = r.thick * (1 - k * 0.7);
      this._p.copy(r.from).addScaledVector(r.dir, r.reach * e);
      this._m.compose(this._p, r.q, this._s.set(rad, rad, th * Math.max(rad, 0.4)));
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, this._c.set(r.color));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// The tank, in its own frame (y up the glass from its bottom, +z toward the
// wearer's back), placed in the chest anchor's frame (y = 0 at the hips,
// 0.74 at the collar, +z forward, the character's right at -x).
export const TANK = {
  at: [0, 0.4, -0.33],      // glass bottom, behind the shoulder blades
  height: 0.52,             // glass
  full: 0.5,                // fluid height at three charges (a sliver of air on top)
  squash: 1.2,              // wider than deep
  profile: [[0.12, 0], [0.153, 0.05], [0.167, 0.14], [0.162, 0.26], [0.147, 0.38], [0.121, 0.47], [0.098, 0.52]],
  outlet: [-0.11, 0.6, 0.03],      // where the hose leaves: the cap's fitting, on the wearer's right
  highlight: -1.05,         // streak angle (atan2(z, x) in tank space): on the back, to one side
  inked: true,              // blobs inked at full strength (not the player's softer interior lines)
};
/** The docked scout's centre off the tank's axis: the widest glass (0.167 × squash), the scout's half depth docked (0.11), a gap. */
export const SCOUT_DOCK_X = 0.167 * TANK.squash + 0.11 + 0.03;
const profileCurve = new THREE.SplineCurve(TANK.profile.map(([r, y]) => new THREE.Vector2(r, y)));
function radiusAt(y) {
  // the profile is monotonic in y: a few bisection steps are plenty
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (profileCurve.getPoint(m).y < y) lo = m; else hi = m; }
  return profileCurve.getPoint((lo + hi) / 2).x;
}

function buildTank() {
  const g = new THREE.Group();
  g.name = 'Fluid tank';
  const add = (geo, m, x = 0, y = 0, z = 0, sq = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (sq) o.scale.x = TANK.squash; g.add(o); return o; };
  const R = TANK.profile.reduce((m, [r]) => Math.max(m, r), 0);
  const glass = add(new THREE.LatheGeometry(profileCurve.getPoints(24), 28),
    makeMaterial({ color: '#ffffff', fluid: 'tank', glow: 0.5, fluidBox: [0, TANK.full, R, TANK.highlight], fluidTones: FLUID_TONES }));
  glass.name = 'Fluid glass';
  // brass base cup and foot ring, the cap with its valve
  add(new THREE.CylinderGeometry(0.136, 0.16, 0.075, 28), flatMat(BRASS), 0, -0.03, 0);
  add(new THREE.TorusGeometry(0.159, 0.013, 5, 28).rotateX(Math.PI / 2), flatMat(BRASS_DARK), 0, -0.066, 0);
  add(new THREE.CylinderGeometry(0.06, 0.103, 0.06, 24), flatMat(BRASS), 0, TANK.height + 0.024, 0);
  add(new THREE.CylinderGeometry(0.03, 0.036, 0.03, 12), flatMat(STEEL), 0, TANK.height + 0.068, 0, false);
  add(new THREE.TorusGeometry(0.045, 0.008, 4, 16).rotateX(Math.PI / 2), flatMat(INK), 0, TANK.height + 0.086, 0, false);
  add(new THREE.SphereGeometry(0.022, 10, 7), flatMat(BRASS), 0, TANK.height + 0.094, 0, false);
  // hoops mark the three charge bands
  for (const k of [1, 2]) {
    const y = (TANK.full * k) / 3;
    add(new THREE.TorusGeometry(radiusAt(y) + 0.006, 0.01, 5, 30).rotateX(Math.PI / 2), flatMat(INK), 0, y, 0);
  }
  // side rails and the back plate on the straps
  const railX = R * TANK.squash + 0.018;
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.012, 0.012, TANK.height + 0.05, 6), flatMat(STEEL_DARK), sx * railX, TANK.height / 2 - 0.01, 0.02, false);
    for (const y of [0.04, TANK.height - 0.04]) add(new THREE.BoxGeometry(0.03, 0.026, 0.15), flatMat(STEEL_DARK), sx * railX, y, 0.09, false);
  }
  add(new THREE.BoxGeometry(0.36, 0.46, 0.024), flatMat(STEEL_DARK), 0, TANK.height / 2, 0.17, false);
  // the hose's fitting on the cap, leaning toward the right shoulder
  const [ox, oy, oz] = TANK.outlet;
  add(new THREE.CylinderGeometry(0.022, 0.026, 0.07, 10), flatMat(BRASS), ox + 0.02, oy - 0.03, oz, false).rotation.z = 0.55;
  add(new THREE.TorusGeometry(0.026, 0.008, 4, 12).rotateX(Math.PI / 2), flatMat(INK), ox + 0.008, oy - 0.012, oz, false).rotation.z = 0.55;
  mergeParts(g, [glass]);
  g.position.set(...TANK.at);
  return { group: noCollide(g), glass, outlet: new THREE.Vector3(ox, oy, oz), top: TANK.at[1] + TANK.height + 0.11 };
}

// The bracer, in the right forearm's outfit frame (Humanoid.forearm.r, as the outfit's own rig had it: +y
// along the forearm toward the hand, -x the thumb side (up when aiming), +z
// outward).
const BRACER = { nozzle: [-0.056, 0.2, 0.0], muzzle: [-0.056, 0.335, 0.0], inlet: [-0.012, 0.075, 0.05], rings: [0.215, 0.248, 0.281] };

function buildBracer() {
  const g = new THREE.Group();
  g.name = 'Fluid bracer';
  const add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.054, 0.05, 0.12, 14), flatMat(STEEL_DARK), 0, 0.13, 0);
  for (const y of [0.074, 0.188]) add(new THREE.TorusGeometry(0.054, 0.009, 4, 16).rotateX(Math.PI / 2), flatMat(BRASS), 0, y, 0);
  const [nx, ny, nz] = BRACER.nozzle;
  add(new THREE.BoxGeometry(0.04, 0.07, 0.034), flatMat(BRASS_DARK), nx * 0.7, 0.16, nz);                                  // the saddle
  add(new THREE.CylinderGeometry(0.02, 0.024, 0.15, 10), flatMat(BRASS), nx, ny + 0.06, nz);                                // barrel
  add(new THREE.CylinderGeometry(0.038, 0.02, 0.04, 12, 1, true), flatMat(BRASS, { side: THREE.DoubleSide }), nx, ny + 0.145, nz);   // flared muzzle
  const lens = add(new THREE.SphereGeometry(0.019, 10, 8), makeMaterial({ color: FLUID_TONES[0], flat: true, glow: 0.9 }), nx, ny + 0.13, nz);
  const rings = BRACER.rings.map((y) => {
    const m = makeMaterial({ color: INK, flat: true }).clone();
    m.uniforms = { ...m.uniforms, uColor: { value: new THREE.Color(INK) }, uGlow: { value: 0 } };
    return add(new THREE.TorusGeometry(0.03, 0.01, 6, 16).rotateX(Math.PI / 2), m, nx, y, nz);
  });
  const [ix, iy, iz] = BRACER.inlet;
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), flatMat(BRASS), ix, iy, iz);
  mergeParts(g, [lens, ...rings]);
  return { group: noCollide(g), rings, lens, muzzle: new THREE.Vector3(...BRACER.muzzle), inlet: new THREE.Vector3(ix, iy - 0.03, iz) };
}

/** The hose: a ribbed tube re-laid every frame along a Catmull-Rom curve through the tank, the arm and the bracer. */
class Hose {
  constructor(parent, { rings = 48, sides = 7, radius = 0.02 } = {}) {
    Object.assign(this, { R: rings, S: sides, radius });
    const n = rings * sides;
    this.pos = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3);
    const fold = new Float32Array(n * 2);
    for (let r = 0; r < rings; r++) for (let k = 0; k < sides; k++) fold[(r * sides + k) * 2] = r / (rings - 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aFold', new THREE.BufferAttribute(fold, 2));   // x: 0 at the tank -> 1 at the hand (the fluid pulse runs along it)
    const idx = [];
    for (let r = 0; r < rings - 1; r++) for (let k = 0; k < sides; k++) {
      const a = r * sides + k, b = r * sides + ((k + 1) % sides), c = a + sides, d = b + sides;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, makeMaterial({ color: RUBBER, fluid: 'hose', glow: 0.12, fluidTones: FLUID_TONES }));
    this.mesh.name = 'Fluid hose';
    this.mesh.frustumCulled = false; this.mesh.userData.noCollide = true;
    parent.add(this.mesh);
    this.curve = new THREE.CatmullRomCurve3([], false, 'centripetal');
    this.pts = Array.from({ length: rings }, () => new THREE.Vector3());
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3(); this._p = new THREE.Vector3();
  }
  /** Lay the hose through control points (world space). */
  set(points) {
    const C = this.curve, P = this.pts, R = this.R, S = this.S;
    C.points = points;
    for (let r = 0; r < R; r++) C.getPoint(r / (R - 1), P[r]);
    let len = 0;
    const T = this._t, N = this._n, B = this._b;
    for (let r = 0; r < R; r++) {
      const a = P[Math.max(0, r - 1)], b = P[Math.min(R - 1, r + 1)];
      T.subVectors(b, a).normalize();
      if (r === 0) { N.set(0, 1, 0).cross(T); if (N.lengthSq() < 1e-6) N.set(1, 0, 0).cross(T); N.normalize(); }
      else { N.addScaledVector(T, -N.dot(T)).normalize(); }   // parallel transport: no twisting
      B.crossVectors(T, N);
      if (r > 0) len += P[r].distanceTo(P[r - 1]);
      const rad = this.radius * (1 + 0.09 * Math.sin(len * (Math.PI * 2 / 0.045)));   // ribs
      for (let k = 0; k < S; k++) {
        const th = (k / S) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        const nx = N.x * cs + B.x * sn, ny = N.y * cs + B.y * sn, nz = N.z * cs + B.z * sn;
        const j = (r * S + k) * 3;
        this.pos[j] = P[r].x + nx * rad; this.pos[j + 1] = P[r].y + ny * rad; this.pos[j + 2] = P[r].z + nz * rad;
        this.nrm[j] = nx; this.nrm[j + 1] = ny; this.nrm[j + 2] = nz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.length = len;
  }
}

// ---------------------------------------------------------------- the tool

const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Vector3(), _a = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _q = new THREE.Quaternion();
const smooth = (k) => k * k * (3 - 2 * k);
const range01 = (k, a, b) => THREE.MathUtils.clamp((k - a) / (b - a), 0, 1);

export class FluidTool {
  /**
   * @param o.player    Player (frame, humanoid bones, aim pose, vehicles, vel)
   * @param o.camera    the aim ray comes from the camera centre (the crosshair)
   * @param o.rig       CameraRig (moves over the shoulder while aiming)
   * @param o.level     optional: level.targets are registered too
   * @param o.hud       optional ToolHud (crosshair, charges)
   * @param o.noShadow  array of objects hidden from the shadow passes
   * @param o.state     the game-state store (game-state.js; tests pass their own)
   * @param o.items     the item registry (items.js; what the traveller owns)
   */
  constructor({ scene, player, physics, camera, rig = null, sound = null, level = null, hud = null, noShadow = null, state = sharedGame, items = sharedItems }) {
    Object.assign(this, { scene, player, physics, camera, rig, sound, hud, state, items });
    this.reserve = new Reserve();
    this.k = 0; this.camK = 0; this.cooldown = 0; this.quick = 0; this.quickShoot = false;
    this.pending = null; this.time = 0; this._enabled = true;
    this.held = { shoot: false, push: false, mode: false, modeBack: false };
    this.mode = 'shoot'; this.modeFlash = 0; this.fluidTime = 0; this.rate = 1;
    this.appear = items.has('backpack') ? 1 : 0; this.jetBurnt = false; this.where = 'back'; this.power = new Map();
    this.aimPoint = new THREE.Vector3(); this.aimDir = new THREE.Vector3(0, 0, -1);
    this.globs = [];
    this.fill = 1; this.flash = 0; this.wave = 0; this.slosh = 0; this.pulse = 2; this.lastHit = null; this.ringLit = [1, 1, 1];
    this._lastVel = new THREE.Vector3(); this._hasVel = false;

    const fx = (this.fx = new THREE.Group());
    fx.name = 'Fluid effects'; fx.userData.noCollide = true;
    scene?.add(fx);
    noShadow?.push(fx);
    this.drops = new Dots(fx, 360, flatMat('#ffffff', { glow: 0.7 }));
    this.glow = new Dots(fx, 160, makeMaterial({ color: '#ffffff', flat: true, glow: 0.95 }));
    this.arc = new Dots(fx, 48, flatMat('#ffffff'));
    this.splats = new Splats(fx);
    this.rings = new Rings(fx);
    const globMat = (this.globMat = makeMaterial({ color: '#ffffff', fluid: 'glob', glow: 0.8, fluidBox: [-1, 1, 1, 0], fluidTones: FLUID_TONES }));
    this.globU = globMat.uniforms;
    this.globMeshes = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), globMat); m.visible = false; m.userData.noCollide = true; fx.add(m); return m; });
    this.wear();

    // Things a glob wakes from afar: taxis cruising their lanes get hailed, and whatever the level offers.
    this.offs = [];
    for (const v of player?.vehicles ?? []) {
      if (!v.hail) continue;
      this.offs.push(registerTarget({ kind: 'vehicle', radius: 2.6, position: () => v.pos,
        enabled: () => v.mode === 'lane' || v.mode === 'return',
        onHit: (mode) => { if (mode === 'shoot') v.hail(player.pos, player.heading); return mode === 'shoot'; } }));
    }
    // a parked hoverbike or skiff is a loose thing: the push sends it sliding and turning
    const m = player?.mount;
    if (m && 'speed' in m && 'yawRate' in m && m.kind !== 'bird') {
      this.offs.push(registerTarget({ kind: 'mount', radius: 1.3, position: () => (this._mountAt ??= new THREE.Vector3()).copy(m.pos).addScaledVector(player.frame.up, 0.6),
        enabled: () => player.ride !== m && !m.auto && !m.dormant,
        onHit: (mode, point, dir, info) => {
          if (mode !== 'push' || !dir) return false;
          const [fx, fz] = m.forward, k = FLUID.push.shove * 1.3 * (0.6 + 0.4 * (info?.strength ?? 1));
          m.speed += (dir.x * fx + dir.z * fz) * k;
          m.yawRate += (dir.x * fz - dir.z * fx) * 1.6;
          return true;
        } }));
    }
    for (const t of level?.targets ?? []) this.offs.push(registerTarget(t));
    // the story drives it through the shared bus too
    this.offs.push(state.on('tool:refill', (o) => this.refill(o ?? {})));
    this.offs.push(state.on('tool:enable', (o) => { this.enabled = o?.on ?? true; }));
    // found (a box, a quest, the dev menu): the tank appears with a shimmer; a lost mode falls back to shoot
    this.offs.push(items.on((id, owned) => {
      if (id === 'backpack' && owned) this.shimmer();
      if (!owned && !this.modes.includes(this.mode)) this.mode = 'shoot';
    }));
    // boost: the player asks on a fresh press of jump in the air (player.js); the jets
    // burn the reserve (fuelSource) and boarding a vehicle swings the tank into it (handoff)
    if (player) { player.onAirJump = (since) => this.boost(since); player.fuelSource = this; player.handoff = this; }
  }

  /** Put the tank, hose and bracer on the traveller (needs the humanoid's chest anchor and arm bones). */
  wear() {
    const p = this.player, H = p?.humanoid;
    if (!H?.chestAnchor) return;
    // the cream radio pack gives way to the tank once it is found (update(); the traveller's pack: traveller.js)
    if (!H.outfit) for (const o of p.gear?.scoutDock?.parent?.children ?? []) if (o.isMesh) o.visible = false;   // the procedural pack
    const tank = (this.tank = buildTank());
    H.chestAnchor.add(tank.group);
    // the scout clings to the tank's left side (the cap would hide the helmet), clear of the glass
    // and the frame: lens out, wings fore and aft (side on, they cut into the tank)
    this.placeDock(this.owned);
    const fore = H.forearm?.r ?? H.b.lowerarm_r;
    if (fore) {
      this.bracer = buildBracer();
      fore.add(this.bracer.group);
    }
    // the handheld device stays in the gear but the bracer replaces it in the hand
    for (const o of p.gear?.device?.children ?? []) o.visible = false;
    this.hose = new Hose(this.scene ?? tank.group);
    const copies = new Map(), glassMat = tank.glass.material;
    markHero(tank.group, copies);
    // the fluid stays out of the player's soft-ink mask, so the post pass inks its blobs like print
    if (TANK.inked) tank.glass.material = glassMat;
    if (this.bracer) markHero(this.bracer.group, copies);
    markHero(this.hose.mesh, copies);
    this.tankU = tank.glass.material.uniforms;
    this.hoseU = this.hose.mesh.material.uniforms;
    this.hosePts = Array.from({ length: 6 }, () => new THREE.Vector3());
    // the wings bloom from the cap (inked at full strength, like the fluid in the glass)
    this.wings = new FluidWings(tank.group, FLUID_TONES);
    // the fluid jets clip under the tank (the old canisters are gone, player.js); their flames are the globs' fluid
    const metal = { brass: flatMat(BRASS), dark: flatMat(STEEL_DARK), brassOpen: flatMat(BRASS, { side: THREE.DoubleSide }), core: makeMaterial({ color: '#fff6dc', flat: true, glow: 1 }) };
    this.jets = new FluidJets(tank.group, this.globMat, metal);
    this.wingU = this.wings.material.uniforms;
    this.chest = H.chestAnchor;
  }

  /** The scout docks on the tank's side once it is worn, else where the gear put it (on the radio pack). */
  placeDock(owned) {
    const dock = this.player?.gear?.scoutDock;
    this._dockOwned = owned;
    if (!dock) return;
    if (owned || !this.player.gear.packDock) { dock.position.set(SCOUT_DOCK_X, TANK.at[1] + TANK.height * 0.62, TANK.at[2] + 0.02); dock.rotation.set(0, Math.PI / 2, 0); }
    else { dock.position.copy(this.player.gear.packDock); dock.rotation.set(0, 0, 0); }
  }

  dispose() {
    this.offs.forEach((off) => off()); this.offs = [];
    this.fx.removeFromParent(); this.tank?.group.removeFromParent(); this.bracer?.group.removeFromParent(); this.hose?.mesh.removeFromParent();
    const p = this.player;
    if (p?.onAirJump) p.onAirJump = null;
    if (p?.fuelSource === this) p.fuelSource = null;
    if (p?.handoff === this) p.handoff = null;
  }

  // ------------------------------------------------------------ the story API
  get charges() { return this.reserve.charges; }
  get colours() { return THREE.MathUtils.clamp(this.state.flag('tool.colours') ?? 1, 1, FLUID.maxColours); }
  /** The fluid's own blend (colour bands from magical water). */
  get tones() { return fluidTones(this.colours, this.state.flag('tool.tones')); }
  /** What the tank, the globs and the splashes show now: the current mode's tones (stun cold blue, fire ember). */
  get modeTones() { return MODES[this.mode]?.tones ?? this.tones; }
  /** The backpack is found. */
  get owned() { return this.items.has('backpack'); }
  /** The tank is on the traveller's back (not in a vehicle's socket, nor swinging between). */
  get worn() { const p = this.player; return this.owned && !p?.ride && !p?.boarding && !p?.unboarding; }
  /** The gun modes the traveller owns ('shoot' first); none without the backpack. */
  get modes() { return ownedModes((id) => this.items.has(id)); }
  get modeName() { return MODES[this.mode]?.name ?? 'fluid'; }
  /** Switch to an owned mode: the tank and bracer retint, the HUD says so. Returns true if it changed. */
  setMode(mode) {
    if (!this.modes.includes(mode) || mode === this.mode) return false;
    this.mode = mode;
    this.modeFlash = 1; this.flash = Math.max(this.flash, 0.8); this.slosh = Math.max(this.slosh, 0.6);
    this.sound?.fluidMode?.(mode);
    if (this.tank && this.player?.object?.visible !== false) {
      const tones = this.modeTones, at = this.tank.group.localToWorld(_o.set(0, TANK.height * 0.6, 0)), up = this.player.frame.up;
      for (let i = 0; i < 12; i++) this.glow.add({ pos: at, vel: _a.randomDirection().multiplyScalar(0.9).addScaledVector(up, 0.6), drag: 3, size: 0.03, life: 0.5 + Math.random() * 0.3, color: tones[i % tones.length], grow: true });
    }
    this.state.emit('tool:mode', { mode });
    return true;
  }
  /** The next (dir 1) or previous (-1) owned mode. */
  cycleMode(dir = 1) { return this.setMode(nextMode(this.mode, this.modes, dir)); }
  /** The tank appears on the back (the backpack was just found). */
  shimmer() {
    this.appear = 0; this.flash = 1; this.wave = 1; this.slosh = 1;
    this.sound?.fluidRefill?.(true);
  }
  get enabled() { return this._enabled; }
  set enabled(on) {
    this._enabled = !!on;
    if (!on) { this.pending = null; this.quick = 0; }
  }
  /**
   * Fill the tank now (magical water). addColour: true also adds a colour band
   * for good, in the next tone of FLUID_TONES or in `tone` (a hex colour, e.g.
   * a world's own light). Returns the colour count.
   */
  refill({ addColour = false, tone = null } = {}) {
    const added = addColour && this.colours < FLUID.maxColours;
    if (added) {
      const c = this.colours + 1;
      if (tone) { const custom = [...(this.state.flag('tool.tones') ?? [])]; custom[c] = '#' + new THREE.Color(tone).getHexString(); this.state.set('tool.tones', custom); }
      this.state.set('tool.colours', c);
    }
    this.reserve.fill();
    this.onRefilled(added);
    return this.colours;
  }

  get aiming() { return this.k > 0.5; }

  /** Can the arm come up right now? Not without the backpack (or with it in a vehicle), while gliding, climbing, on the jets, in menus and photo mode. */
  allowed(paused) {
    const p = this.player;
    return !paused && this._enabled && !!p && this.worn && !p.gliding && !p.climbing && !p.mantle && !p.thrusting && !p.down && p.object?.visible !== false;   // (nor knocked down)
  }

  /** World position of the nozzle's mouth (or the chest if the traveller has no bracer). */
  muzzle(out = new THREE.Vector3()) {
    const p = this.player;
    if (this.bracer && p.object?.visible !== false) {
      this.bracer.group.updateWorldMatrix(true, false);
      return this.bracer.group.localToWorld(out.copy(this.bracer.muzzle));
    }
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
    const shot = traceShot(this.physics, o, this.aimDir, FLUID.shoot.range + 4);
    this.aimPoint.copy(shot.point);
    this.aimKind = shot.kind;
    return shot;
  }

  /** Per frame, after the player and camera moved. ctl is the merged input (or {} in menus). */
  update(dt, ctl = {}, paused = false) {
    this.time += dt;
    const p = this.player, input = toolInput(paused ? {} : ctl);
    const ok = this.allowed(paused);
    const shootPress = input.shoot && !this.held.shoot, pushPress = input.push && !this.held.push;
    const modePress = input.mode && !this.held.mode, modeBackPress = input.modeBack && !this.held.modeBack;
    this.held.shoot = input.shoot; this.held.push = input.push; this.held.mode = input.mode; this.held.modeBack = input.modeBack;
    // X / D-pad right (left: back) / the touch button: the next owned gun mode (also while not aiming, and riding)
    if (!paused && this._enabled && this.owned && (modePress || modeBackPress)) this.cycleMode(modeBackPress ? -1 : 1);
    if (!this.modes.includes(this.mode)) this.mode = 'shoot';
    this.modeFlash = Math.max(0, this.modeFlash - dt / 1.6);
    if (ok && (shootPress || pushPress)) {
      if (this.reserve.charges <= 0) this.sputter();
      else if (shootPress) { this.pending = 'shoot'; if (!input.aim) { this.quick = 0.9; this.quickShoot = true; } }
      else { this.pending = 'push'; if (!input.aim) this.quick = Math.max(this.quick, 0.55); }
    }
    this.quick = Math.max(0, this.quick - dt);
    if (this.quick === 0) this.quickShoot = false;
    const want = ok && (input.aim || this.quick > 0);
    if (!ok) { this.pending = null; this.quick = 0; this.quickShoot = false; }
    this.k += ((want ? 1 : 0) - this.k) * (1 - Math.exp(-(want ? (this.pending === 'push' ? 16 : 11) : ok ? 7 : 14) * dt));
    if (this.k < 0.002) this.k = 0;
    // the camera only moves over the shoulder for aimed shots (not a quick push)
    const camWant = ok && (input.aim || this.quickShoot) ? 1 : 0;
    this.camK += (camWant - this.camK) * (1 - Math.exp(-(camWant ? 11 : 7) * dt));

    this.cooldown = Math.max(0, this.cooldown - dt);
    // the jets' fluid recovers once you land: after a burn the refill clock waits for the ground
    if (p?.onGround || p?.ride || p?.climbing) this.jetBurnt = false;
    if (this.jetBurnt) this.reserve.hold();
    if (this.reserve.update(dt)) this.onRefilled(false);

    if (this.k > 0 && p) {
      this.updateAimPoint();
      p.aim = Object.assign(this._pose ??= {}, { k: this.k, point: this.aimPoint, dir: this.aimDir });
      if (this.cooldown === 0 && this.pending === 'shoot' && this.k > 0.8) { this.pending = null; this.shoot(); if (input.shoot) this.quick = Math.max(this.quick, 0.5); }
      else if (this.cooldown === 0 && this.pending === 'push' && this.k > 0.45) { this.pending = null; this.push(); }
    } else if (p) p.aim = null;
    if (this.rig) this.rig.aimK = smooth(Math.min(this.k, this.camK));

    this.updateGlobs(dt);
    this.updateArc(ok && this.k > 0.6 && input.aim && this.reserve.charges > 0);
    const up = p?.frame.up ?? _y;
    this.drops.update(dt, up); this.glow.update(dt, up);
    this.splats.update(dt); this.rings.update(dt);
    this.updateWorn(dt);
    this.hud?.update({ on: this.k > 0.5 && this.camK > 0.3, charges: this.reserve.charges, max: this.reserve.max, refillIn: this.reserve.refillIn, ready: this.cooldown === 0 && this.reserve.charges > 0, aimKind: this.aimKind, hit: this.lastHit, tones: this.modeTones,
      owned: this.owned, mode: this.mode, modeName: this.modeName, modes: this.modes.length, modeFlash: this.modeFlash });
    this.lastHit = null;
  }

  // ------------------------------------------------------------ the jets (player.fuelSource)
  /** The jets own the item and the tank is on the back. */
  get canJet() { return this.worn && this.items.has('jetpack'); }
  /** The gauge the jets burn, 0..1 of the tank. */
  jetLevel() { return this.reserve.level / this.reserve.max; }
  /** A frame of thrust: burns FLUID.jet.drain charges a second; false when there's nothing left to burn. */
  burnJet(dt) {
    if (!this.canJet || this.reserve.level <= FLUID.jet.min * 0.5) return false;
    if (!this.jetBurnt) { this.jetBurnt = true; this.state.emit('tool:fire', { mode: 'jet', point: this.player.pos.clone() }); }
    this.reserve.drain(FLUID.jet.drain * dt);
    this.pulse = Math.min(this.pulse, 0.4);
    return true;
  }

  /** While thrusting: fluid flames spit from the two nozzles, drops falling off them in the tank's tones. */
  updateJets(dt) {
    const J = this.jets, p = this.player;
    if (!J) return;
    const on = this.canJet && p.object?.visible !== false;
    J.update(dt, { on, thrusting: !!p.thrusting, time: this.time });
    if (!on || J.thrust < 0.2) return;
    const tones = this.modeTones, U = p.frame.up, mouths = J.mouths(this._mouths ??= [new THREE.Vector3(), new THREE.Vector3()]);
    this._jetAcc = (this._jetAcc ?? 0) + dt;
    while (this._jetAcc > 1 / 60) {
      this._jetAcc -= 1 / 60;
      for (const m of mouths) {
        const v = _a.copy(U).multiplyScalar(-(5 + Math.random() * 5)).add(_t1.randomDirection().multiplyScalar(1.2)).addScaledVector(p.vel, 0.6);
        this.drops.add({ pos: m, vel: v, drag: 3, grav: 4, size: 0.016 + Math.random() * 0.02, stretch: 3, life: 0.3 + Math.random() * 0.25, color: tones[(Math.random() * tones.length) | 0] });
      }
    }
  }

  /** The wings follow the player's glide (player.wingK: 0 folded, 1 open). */
  updateWings(dt) {
    const W = this.wings, p = this.player;
    if (!W) return;
    const open = this.worn && p.object?.visible !== false ? (p.wingK ?? 0) : 0;
    W.update(dt, { open, turn: p.glideTurn ?? 0, wind: p.wind?.length() ?? 0, time: this.fluidTime, fill: this.fill });
  }

  // ------------------------------------------------------------ powering vehicles (player.handoff)
  /**
   * Where the tank is this frame follows from the player's state alone, so
   * nothing can strand it: on the back; swinging off it into the socket of the
   * vehicle being boarded (player.boarding.k); in the socket while riding a
   * powered vehicle; swinging back onto the back after stepping off
   * (player.unboarding.k). Returns 'back' | 'flight' | 'socket'.
   */
  updateDock(dt) {
    const p = this.player, T = this.tank;
    if (!T || !p) return 'back';
    const B = p.boarding?.v?.socket ? p.boarding : null, U = !B && p.unboarding?.v?.socket ? p.unboarding : null;
    const R = !B && !U && p.ride?.powered && p.ride.socket ? p.ride : null;
    const v = B?.v ?? R ?? U?.v ?? null;
    let where = 'back', u = 0;
    if (B) { u = range01(B.k, HANDOFF.lift, HANDOFF.seat); where = u >= 1 ? 'socket' : u > 0 ? 'flight' : 'back'; }
    else if (R) { u = 1; where = 'socket'; }
    else if (U) { u = 1 - range01(U.k, HANDOFF.grab, HANDOFF.worn); where = u <= 0 ? 'back' : u < 1 ? 'flight' : 'socket'; }
    const was = this.where;
    this.where = where;
    this.dockVehicle = where === 'socket' ? v : null;
    const g = T.group, chest = this.chest;
    // the back's pose and the socket's, in world space
    const back = this._back ??= { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    chest.updateWorldMatrix(true, false);
    chest.localToWorld(back.p.set(...TANK.at)); chest.getWorldQuaternion(back.q); chest.getWorldScale(back.s);
    if (where === 'back') {
      if (g.parent !== chest) chest.add(g);
      g.position.set(...TANK.at); g.quaternion.identity(); g.scale.setScalar(1);
      if (was === 'flight') this.onDocked(null, false);
      return where;
    }
    const sock = v.socket;
    sock.updateWorldMatrix(true, false);
    const ss = sock.getWorldScale(_t3);
    if (where === 'socket') {
      if (g.parent !== sock) sock.add(g);
      g.position.set(0, 0, 0); g.quaternion.identity();
      g.scale.set(back.s.x / ss.x, back.s.y / ss.y, back.s.z / ss.z);
      if (was !== 'socket') this.onDocked(v, true);
      return where;
    }
    // in flight: in the scene, along an arc from the back to the socket
    const S = this._sock ??= { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    sock.getWorldPosition(S.p); sock.getWorldQuaternion(S.q); S.s.copy(back.s);
    const host = this.scene ?? chest;
    if (g.parent !== host) host.add(g);
    const out = handoffPose(u, back, S, p.frame.up, this._pose2 ??= { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() });
    if (host === this.scene) { g.position.copy(out.p); g.quaternion.copy(out.q); g.scale.copy(out.s); }
    if (was === 'socket') this.onDocked(v, false);
    return where;
  }

  /** The click of the tank going into a socket (on) or leaving it. */
  onDocked(v, on) {
    this.flash = 1; this.slosh = 1; this.pulse = 0;
    this.sound?.fluidDock?.(on);
    const at = this.tank.group.localToWorld(_o.set(0, 0.1, 0)), up = this.player.frame.up, tones = this.modeTones;
    this.rings.add({ from: at, dir: up, reach: 0.05, r0: 0.12, r1: on ? 0.9 : 0.5, life: 0.35, color: tones[0], thick: 1 });
    for (let i = 0; i < (on ? 18 : 8); i++) this.glow.add({ pos: at, vel: _a.randomDirection().multiplyScalar(1.6).addScaledVector(up, 0.8), drag: 3, size: 0.035, life: 0.5 + Math.random() * 0.3, color: tones[i % tones.length], grow: true });
    if (v) this.state.emit('tool:dock', { vehicle: v, on });
  }

  /** Where the traveller's hands hold the tank during a hand-off (the tank's middle). */
  handPoint(out = new THREE.Vector3()) {
    return this.tank ? this.tank.group.localToWorld(out.set(0, TANK.height * 0.45, 0)) : out.copy(this.player.pos);
  }

  /** The vehicles' engines glow in the fluid's tones while the tank sits in their socket. */
  updatePower(dt) {
    for (const v of this.player?.vehicles ?? []) {
      if (!v.powered) continue;
      const want = v === this.dockVehicle ? 1 : 0;
      const k = THREE.MathUtils.damp(this.power.get(v) ?? 0, want, want ? 3.5 : 6, dt);
      this.power.set(v, k);
      v.setPower?.(k, this.modeTones, this.time);
    }
    if (this.trails) for (const tr of this.trails) {
      const U = tr.mesh.material.uniforms;
      if (U.uFluidTones && this._trailKey !== this._tonesKey) U.uFluidTones.value.forEach((c, i) => c.set(this.modeTones[i] ?? FLUID_TONES[i]));
      if (U.uFluidA) U.uFluidA.value.y = this.modeTones.length;
    }
    if (this.trails) this._trailKey = this._tonesKey;
  }

  /** The hover trails take the fluid's tones (the vehicle runs on it). */
  powerTrails(trails) {
    this.trails = trails ?? null;
    for (const tr of trails ?? []) tr.mesh.material = makeMaterial({ color: '#ffffff', mode: MODE_RIBBON, glow: 1, fluid: 'trail', fluidTones: FLUID_TONES, key: 'fluid-trail' });
    this._trailKey = null;
  }

  /** The tank, hose and bracer follow the body; the fluid level eases to the charges left. */
  updateWorn(dt) {
    const p = this.player;
    const target = this.reserve.level / this.reserve.max;
    // drains quickly; refills with a rise and a little overshoot
    const rate = target > this.fill ? 4.2 : 9;
    this.fill += (target - this.fill) * (1 - Math.exp(-rate * dt));
    this.flash = Math.max(0, this.flash - dt * 3);
    this.wave = Math.max(0, this.wave - dt * 0.9);
    this.pulse += dt * 5;
    if (p?.vel && dt > 0) {
      // the fluid sloshes with the body's accelerations
      if (this._hasVel) this.slosh = Math.max(this.slosh * Math.exp(-2.2 * dt), Math.min(1, _a.subVectors(p.vel, this._lastVel).length() / dt / 70));
      this._lastVel.copy(p.vel); this._hasVel = true;
    }
    // the mode's look: its tones, and how the lava moves (stilling: nearly still; ember: boiling)
    const look = MODES[this.mode] ?? MODES.shoot;
    this.rate += (look.rate - this.rate) * (1 - Math.exp(-4 * dt));
    this.fluidTime += dt * this.rate;
    const tones = this.modeTones, n = tones.length, key = tones.join();
    const retone = key !== this._tonesKey;
    this._tonesKey = key;
    for (const U of [this.tankU, this.hoseU, this.globU, this.wingU]) {
      if (!U) continue;
      if (retone) U.uFluidTones.value.forEach((c, i) => c.set(tones[i] ?? FLUID_TONES[i]));
      U.uFluidA.value.x = this.fill; U.uFluidA.value.y = n; U.uFluidA.value.z = U === this.globU ? this.time * Math.max(this.rate, 0.4) : this.fluidTime;
      if (U === this.wingU) { U.uFluidB.value.x = this.flash; continue; }
      U.uFluidB.value.set(this.flash, this.wave, this.pulse, this.slosh * Math.min(1, this.rate));
    }
    if (!this.tank) return;
    if (retone && this.bracer) this.bracer.lens.material.uniforms.uColor.value.set(tones[0]);
    // found: it grows onto the back with a little overshoot and a shimmer of fluid
    if (this.appear < 1) {
      const was = this.appear;
      this.appear = Math.min(1, this.appear + dt / 0.9);
      if (was === 0 && this.player?.object?.visible !== false) {
        const at = this.tank.group.localToWorld(_o.set(0, TANK.height * 0.5, 0)), up = p.frame.up;
        for (let i = 0; i < 26; i++) this.glow.add({ pos: _t1.copy(at).add(_a.randomDirection().multiplyScalar(0.3)), vel: _a.randomDirection().multiplyScalar(0.8).addScaledVector(up, 0.7), drag: 2, size: 0.04, life: 0.9 + Math.random() * 0.5, color: tones[i % tones.length], grow: true });
      }
    }
    const owned = this.owned, visible = owned && p.object?.visible !== false;
    const where = owned ? this.updateDock(dt) : 'back';
    this.tank.group.visible = visible;
    // the traveller's radio pack is on the back until the tank takes its place
    for (const o of p.humanoid?.radioPack ?? []) o.visible = !owned;
    if (this._dockOwned !== owned) this.placeDock(owned);
    if (this.bracer) this.bracer.group.visible = owned;
    this.hose.mesh.visible = visible && where !== 'flight';
    if (owned && this.appear < 1 && where === 'back') {
      const e = this.appear, sc = 0.25 + 0.75 * e + Math.sin(Math.PI * e) * 0.18;
      this.tank.group.scale.setScalar(sc);
      this.flash = Math.max(this.flash, 1 - e);
    }
    this.updateJets(dt);
    this.updateWings(dt);
    this.updatePower(dt);
    if (!visible) return;
    if (where === 'socket') return this.layHoseToPort();
    if (where === 'flight') return;
    // the bracer's rings light for the charges left (in sequence as it refills)
    this.bracer?.rings.forEach((ring, i) => {
      const lit = this.reserve.charges > i ? 1 : 0;
      this.ringLit[i] += (lit - this.ringLit[i]) * (1 - Math.exp(-(lit ? 7 : 20) * dt));
      const u = ring.material.uniforms, k = this.ringLit[i];
      u.uColor.value.set(INK).lerp(_c.set(tones[i % tones.length]), k);
      u.uGlow.value = 0.95 * k;
    });
    if (this.bracer) this.bracer.lens.scale.setScalar(this.reserve.charges ? 1 + this.flash * 0.8 + (this.mode !== 'shoot' ? 0.35 : 0) : 0.6);
    // the hose: up out of the cap, over the right shoulder, down the outside of the arm to the bracer
    const H = p.humanoid, B = H.b;
    const P = this.hosePts;
    const tg = this.tank.group;
    tg.updateWorldMatrix(true, false);
    tg.localToWorld(P[0].copy(this.tank.outlet));
    _q.setFromRotationMatrix(tg.matrixWorld);
    const Uc = _o.set(0, 1, 0).applyQuaternion(_q), Rc = _f.set(-1, 0, 0).applyQuaternion(_q), Bk = _m.set(0, 0, -1).applyQuaternion(_q);
    const S = B.upperarm_r.getWorldPosition(_t1), E = B.lowerarm_r.getWorldPosition(_t2);
    if (this.bracer) { this.bracer.group.updateWorldMatrix(true, false); this.bracer.group.localToWorld(P[5].copy(this.bracer.inlet)); }
    else B.hand_r.getWorldPosition(P[5]);
    P[1].copy(P[0]).addScaledVector(Uc, 0.06).addScaledVector(Rc, 0.04);
    P[2].copy(S).addScaledVector(Uc, 0.1).addScaledVector(Bk, 0.05);
    // off the sleeve: outward, square to each bone
    const side = (a, b, out) => { _t3.subVectors(b, a).normalize(); out.copy(Rc).addScaledVector(_t3, -Rc.dot(_t3)); return out.lengthSq() > 1e-6 ? out.normalize() : out.copy(Rc); };
    side(S, E, _a);
    P[3].lerpVectors(S, E, 0.5).addScaledVector(_a, 0.07).addScaledVector(Bk, 0.02);
    side(E, P[5], _a);
    P[4].copy(E).addScaledVector(_a, 0.065).addScaledVector(Bk, 0.015);
    this.hose.set(P);
  }

  /** In a socket: the hose runs from the cap down into the vehicle's engine (its port). */
  layHoseToPort() {
    const v = this.dockVehicle, P = this.hosePts, tg = this.tank.group;
    tg.updateWorldMatrix(true, false);
    tg.localToWorld(P[0].copy(this.tank.outlet));
    if (v.port) { v.port.updateWorldMatrix(true, false); v.port.getWorldPosition(P[5]); }
    else tg.localToWorld(P[5].set(-0.1, -0.05, 0.2));
    const up = _o.set(0, 1, 0).applyQuaternion(tg.getWorldQuaternion(_q));
    P[1].copy(P[0]).addScaledVector(up, 0.07);
    P[2].lerpVectors(P[0], P[5], 0.3).addScaledVector(up, 0.12);
    P[3].lerpVectors(P[0], P[5], 0.6).addScaledVector(up, 0.06);
    P[4].lerpVectors(P[0], P[5], 0.85).addScaledVector(up, 0.03);
    this.hose.set(P);
  }

  /** A press with the tank empty: a dribble from the nozzle and a dry click. */
  sputter() {
    this.lastHit = 'empty';
    this.sound?.fluidEmpty?.();
    const from = this.muzzle(_m), up = this.player.frame.up;
    for (let i = 0; i < 4; i++) this.drops.add({ pos: from, vel: _a.copy(up).multiplyScalar(-0.5 - Math.random()).add(_t1.randomDirection().multiplyScalar(0.4)), grav: 9, size: 0.018, life: 0.45, color: this.modeTones[i % 2] });
  }

  /** The tones as hex strings, for targets (info.colours). */
  info(strength = 1) { return { colours: this.modeTones, strength, shove: FLUID.push.shove, tool: this }; }

  /** Fire a glob at the crosshair now (the arm is assumed to be up). */
  shoot() {
    if (!this.reserve.use()) { this.sputter(); return { kind: 'empty' }; }
    const from = this.muzzle(_m).clone();
    const dir = _f.subVectors(this.aimPoint, from);
    const dist = dir.length();
    if (dist < 2) dir.copy(this.aimDir); else dir.divideScalar(dist);
    if (dist >= 2 && this.aimKind !== 'none') launchDir(from, this.aimPoint, FLUID.shoot.speed, FLUID.shoot.gravity, this.player.frame.up, dir);
    this.cooldown = FLUID.shoot.cooldown;
    const glob = new Glob(from, dir.clone().multiplyScalar(FLUID.shoot.speed));
    glob.mesh = this.globMeshes.find((m) => !m.visible) ?? this.globs.shift()?.mesh ?? this.globMeshes[0];
    glob.mesh.visible = true;
    glob.tone = Math.floor(Math.random() * 6);
    glob.mode = this.mode;               // 'shoot' | 'stun' | 'fire': what it does where it lands
    this.globs.push(glob);
    this.used('shoot', from, { glob: glob.mode });
    this.sound?.fluidShoot?.(glob.mode);
    const tones = this.modeTones;
    for (let i = 0; i < 7; i++) this.drops.add({ pos: from, vel: _a.copy(dir).multiplyScalar(3 + i * 1.2).add(_t1.randomDirection().multiplyScalar(1.1)), drag: 6, grav: 6, size: 0.022, life: 0.35, color: tones[i % tones.length] });
    return { kind: 'glob', glob };
  }

  /** The push: a cone of fluid shock from the hand. Returns the targets it touched. */
  push() {
    if (!this.reserve.use()) { this.sputter(); return []; }
    const p = this.player, U = p.frame.up;
    const origin = _o.copy(p.pos).addScaledVector(U, 1.15);
    // along the aim, flattened toward the ground plane when it's a quick push
    const dir = _f.copy(this.aimDir);
    if (this.camK < 0.5) { dir.addScaledVector(U, -dir.dot(U) * 0.75); }
    if (dir.lengthSq() < 1e-6) p.frame.dir(p.heading, dir);
    dir.normalize();
    const hits = targetsInCone(origin, dir, FLUID.push.range, FLUID.push.angle, this.physics);
    for (const h of hits) hitTarget(h, 'push', h.dir, this.info(1 - h.distance / FLUID.push.range));
    this.cooldown = FLUID.push.cooldown;
    this.used('push', origin);
    this.sound?.fluidPush?.();
    // recoil: a small step back (on the ground)
    if (p.vel && p.onGround) p.vel.addScaledVector(_a.copy(dir).addScaledVector(U, -dir.dot(U)), -FLUID.push.recoil);
    // the shock front: three rings in the fluid's tones, and a fan of spray
    const from = this.muzzle(_m).clone(), tones = this.modeTones, tan = Math.tan(FLUID.push.angle);
    for (let i = 0; i < 3; i++) this.rings.add({ from, dir, reach: FLUID.push.range * (0.75 + i * 0.12), r0: 0.15, r1: FLUID.push.range * tan * (0.7 + i * 0.12), life: 0.32 + i * 0.07, delay: i * 0.05, color: tones[i % tones.length], thick: 0.9 });
    for (let i = 0; i < 42; i++) {
      const v = _a.copy(dir).add(_t1.randomDirection().multiplyScalar(tan * 0.9)).normalize().multiplyScalar(9 + Math.random() * 9);
      this.drops.add({ pos: from, vel: v, drag: 3.2, grav: 7, size: 0.028 + Math.random() * 0.02, stretch: 3, life: 0.45 + Math.random() * 0.25, color: tones[i % tones.length] });
    }
    for (const h of hits) this.splash(h.point, h.dir.clone().negate(), 0.7);
    this.lastHit = hits.length ? 'target' : null;
    return hits;
  }

  /**
   * Called by the player on a fresh press of jump in the air (since: seconds
   * since the previous press). Spends a charge on a boost; returns true if it
   * did (the player then skips its glide for this press). With the jets
   * only a quick double tap boosts, so holding jump still thrusts.
   */
  boost(since = Infinity) {
    const p = this.player;
    if (!p || !this._enabled || !this.worn || p.climbing || p.mantle || p.object?.visible === false) return false;
    if (this.canJet && since > FLUID.boost.doubleTap) return false;
    if (!this.reserve.use()) { this.sputter(); return false; }
    const U = p.frame.up, fwd = p.frame.dir(p.heading, _f);
    boostVelocity(p.vel, U, fwd);
    this.used('boost', p.pos);
    this.sound?.fluidBoost?.();
    // a spray of fluid down from the tank and under the boots, and a ring where it leaves
    const tones = this.modeTones;
    const base = this.tank ? this.tank.group.localToWorld(_o.set(0, -0.05, 0)) : _o.copy(p.pos).addScaledVector(U, 0.9);
    for (let i = 0; i < 34; i++) {
      const fromTank = i % 4 === 0;
      const at = fromTank ? base : _t2.copy(p.pos).addScaledVector(U, 0.15);
      const v = _a.copy(U).multiplyScalar(-(5 + Math.random() * 7)).add(_t1.randomDirection().multiplyScalar(fromTank ? 1.5 : 4.5));
      this.drops.add({ pos: at, vel: v.addScaledVector(p.vel, 0.2), drag: 2.5, grav: 6, size: 0.045 + Math.random() * 0.045, stretch: 1.7, life: 0.5 + Math.random() * 0.35, color: tones[i % tones.length] });
    }
    for (let i = 0; i < 10; i++) this.glow.add({ pos: _t2.copy(p.pos).addScaledVector(U, 0.1), vel: _a.randomDirection().multiplyScalar(2.5).addScaledVector(U, -1.5), drag: 3, size: 0.08, life: 0.45, color: tones[i % tones.length], grow: true });
    for (let i = 0; i < 2; i++) this.rings.add({ from: _t2.copy(p.pos).addScaledVector(U, 0.05), dir: U, reach: -0.3, r0: 0.25, r1: 1.4 + i * 0.6, life: 0.45 + i * 0.1, delay: i * 0.06, color: tones[i % tones.length], thick: 1.2 });
    // and a splat on the ground right under you
    const g = rayWorld(this.physics, _t2.copy(p.pos).addScaledVector(U, 0.5), _t3.copy(U).negate(), 3.5);
    if (g) this.splats.add(g.point, g.normal, tones[0], tones[1 % tones.length], 0.9);
    return true;
  }

  /** Bookkeeping for every use: the hose pulse, the tank's flash and slosh, the story event (globs: mode 'shoot', glob: the gun mode). */
  used(mode, point, extra = null) {
    this.pulse = 0; this.flash = 1; this.slosh = 1;
    this.state.emit('tool:fire', { mode, point: point.clone(), ...extra });
  }

  onRefilled(added) {
    this.wave = 1; this.flash = 0.6; this.slosh = Math.max(this.slosh, 0.7);
    this.ringLit = this.ringLit.map((v, i) => Math.min(v, -i * 0.6));   // the rings light up one after another
    this.sound?.fluidRefill?.(added);
    if (this.tank && this.player?.object?.visible !== false) {
      const tones = this.modeTones, at = this.tank.group.localToWorld(_o.set(0, TANK.height + 0.1, 0)), up = this.player.frame.up;
      for (let i = 0; i < 14; i++) this.glow.add({ pos: at, vel: _a.copy(up).multiplyScalar(1 + Math.random() * 1.5).add(_t1.randomDirection().multiplyScalar(0.8)), drag: 2, size: 0.035, life: 0.7 + Math.random() * 0.4, color: tones[i % tones.length], grow: true });
    }
    this.state.emit('tool:refilled', { charges: this.reserve.charges, colours: this.colours, added });
  }

  /**
   * Droplets and a ring burst where fluid meets something (normal: away from
   * the surface), in the glob's mode: a splash of fluid; a stilling burst
   * (cold shards that hang in the air, a pale ring); or an ember burst (sparks
   * rising, a flash of flame). onTarget: it hit someone or something.
   */
  splash(point, normal, scale = 1, mode = 'shoot', onTarget = false) {
    const tones = MODES[mode]?.tones ?? this.tones;
    const sc = (this.camera ? THREE.MathUtils.clamp(point.distanceTo(this.camera.position) / 14, 1, 2.5) : 1) * scale;
    if (mode === 'stun') {
      // shards fly out and stop dead, hanging a moment like frost in the air
      for (let i = 0; i < 26; i++) {
        const v = _a.randomDirection().addScaledVector(normal, 0.6).normalize().multiplyScalar((4 + Math.random() * 5) * sc);
        this.drops.add({ pos: point, vel: v, drag: 9, grav: 0.3, size: (0.03 + Math.random() * 0.035) * sc, stretch: 3.5, life: 0.9 + Math.random() * 0.6, color: tones[i % tones.length] });
      }
      for (let i = 0; i < (onTarget ? 22 : 8); i++) this.glow.add({ pos: _t1.copy(point).add(_a.randomDirection().multiplyScalar(0.5 * sc)), vel: _a.randomDirection().multiplyScalar(0.25), drag: 1.5, size: 0.06 * sc, life: onTarget ? STUN_SECONDS * (0.4 + Math.random() * 0.6) : 1.1, color: i % 3 ? '#f2fbff' : tones[1], grow: true });
      for (let i = 0; i < 2; i++) this.rings.add({ from: point, dir: normal, reach: 0.02, r0: 0.1 * sc, r1: (1.3 + i * 0.5) * sc, life: 0.5 + i * 0.15, delay: i * 0.08, color: i ? '#f2fbff' : tones[1], thick: 0.6 });
      return;
    }
    if (mode === 'fire') {
      // sparks leap up and drift, a puff of flame, a hot ring
      const up = this.player?.frame.up ?? _y;
      for (let i = 0; i < 30; i++) {
        const v = _a.randomDirection().addScaledVector(normal, 0.9).addScaledVector(up, 1.1).normalize().multiplyScalar((2.5 + Math.random() * 5) * sc);
        this.drops.add({ pos: point, vel: v, drag: 2.6, grav: -1.8, size: (0.03 + Math.random() * 0.04) * sc, stretch: 1.6, life: 0.6 + Math.random() * 0.7, color: tones[i % tones.length] });
      }
      for (let i = 0; i < 9; i++) this.glow.add({ pos: _t1.copy(point).addScaledVector(normal, 0.1), vel: _a.randomDirection().multiplyScalar(0.8 * sc).addScaledVector(up, 1.8 * sc), drag: 2.5, size: (0.1 + Math.random() * 0.08) * sc, life: 0.45 + Math.random() * 0.25, color: tones[i % 3], grow: true });
      this.rings.add({ from: point, dir: normal, reach: 0.05, r0: 0.2 * sc, r1: 1.1 * sc, life: 0.28, color: tones[1], thick: 1 });
      return;
    }
    for (let i = 0; i < 28; i++) {
      const v = _a.randomDirection().addScaledVector(normal, 1.2).normalize().multiplyScalar((3 + Math.random() * 6) * sc);
      this.drops.add({ pos: point, vel: v, drag: 2.2, grav: 9, size: (0.045 + Math.random() * 0.05) * sc, stretch: 2.5, life: 0.55 + Math.random() * 0.4, color: tones[i % tones.length] });
    }
    for (let i = 0; i < 5; i++) this.glow.add({ pos: point, vel: _a.randomDirection().addScaledVector(normal, 0.8).multiplyScalar(1.4 * sc), drag: 3, size: 0.09 * sc, life: 0.5, color: tones[i % tones.length], grow: true });
    this.rings.add({ from: point, dir: normal, reach: 0.05, r0: 0.15 * sc, r1: 1.0 * sc, life: 0.32, color: tones[1 % tones.length], thick: 0.8 });
  }

  updateGlobs(dt) {
    const up = this.player?.frame.up ?? _y;
    for (const g of this.globs) {
      if (g.state === 'fly') {
        const n = Math.max(1, Math.ceil(dt / (1 / 60)));
        for (let i = 0; i < n && g.state === 'fly'; i++) {
          const e = g.step(dt / n, { physics: this.physics, up });
          if (!e) continue;
          const gm = g.mode ?? 'shoot', gTones = MODES[gm]?.tones ?? this.tones;
          if (e.type === 'target') {
            hitTarget(e.hit, gm, e.dir, { ...this.info(), colours: gTones });
            this.lastTarget = e.hit.target;   // (for the story and debugging: what the last glob landed on)
            this.lastHit = 'target';
            this.sound?.fluidSplash?.(true, gm);
            this.splash(e.hit.point, e.dir.clone().negate(), 1, gm, true);
          } else if (e.type === 'world') {
            this.lastHit = this.lastHit ?? 'world';
            this.sound?.fluidSplash?.(false, gm);
            this.splash(e.point, e.normal, 0.8, gm);
            // a splat: fluid; frost (pale, lingering); scorch (dark, with an ember rim, quick)
            if (gm === 'fire') this.splats.add(e.point, e.normal, '#3a2622', gTones[1], 0.6, 2.4);
            else if (gm === 'stun') this.splats.add(e.point, e.normal, gTones[0], '#f2fbff', 0.7, FLUID.shoot.splatLife + 1.5);
            else this.splats.add(e.point, e.normal, gTones[g.tone % gTones.length], gTones[(g.tone + 1) % gTones.length]);
          }
        }
        if ((g.wake = (g.wake ?? 0) + dt) > 0.03) {
          g.wake = 0;
          const gm = g.mode ?? 'shoot', tones = MODES[gm]?.tones ?? this.tones, c = tones[(g.tone + (this.time * 20 | 0)) % tones.length];
          // the wake: dripping fluid; glittering frost that hangs; sparks that rise
          if (gm === 'stun') this.glow.add({ pos: g.pos, vel: _a.randomDirection().multiplyScalar(0.2), drag: 4, size: 0.03, life: 0.7, color: (this.time * 30 | 0) % 2 ? '#f2fbff' : c });
          else if (gm === 'fire') this.drops.add({ pos: g.pos, vel: _a.copy(g.vel).multiplyScalar(0.05).add(_t1.randomDirection().multiplyScalar(0.6)), grav: -2.5, drag: 1.5, size: 0.04, life: 0.55, color: c });
          else this.drops.add({ pos: g.pos, vel: _a.copy(g.vel).multiplyScalar(0.1), grav: 4, size: 0.035, life: 0.4, color: c });
        }
      }
      const m = g.mesh;
      if (g.state !== 'fly') { m.visible = false; g.dead = true; continue; }
      m.position.copy(g.pos);
      // a wobbling drop, stretched along its flight
      m.quaternion.setFromUnitVectors(_y, g.dir);
      const w = Math.sin(g.age * 38) * 0.14, s = 0.13;
      m.scale.set(s * (1 + w), s * (1.45 - w), s * (1 + w));
    }
    this.globs = this.globs.filter((g) => !g.dead);
  }

  /** While aiming: a dotted arc shows where the glob will fly. */
  updateArc(on) {
    if (!on) { if (this.arc.list.length || this.arc.mesh.count) { this.arc.list.length = 0; this.arc.update(0, _y); } return; }
    const from = this.muzzle(_m);
    const dir = _f.subVectors(this.aimPoint, from);
    if (dir.length() < 2) dir.copy(this.aimDir);
    else if (this.aimKind === 'none') dir.normalize();
    else launchDir(from, this.aimPoint, FLUID.shoot.speed, FLUID.shoot.gravity, this.player.frame.up, dir);
    const { points, end } = predictArc(from, dir.multiplyScalar(FLUID.shoot.speed), { physics: this.physics, up: this.player.frame.up }, this._arc ??= []);
    this.arc.list.length = 0;
    const tones = this.modeTones;
    for (let i = 2; i < points.length; i++) this.arc.list.push({ pos: points[i], vel: new THREE.Vector3(), drag: 0, grav: 0, stretch: 1, size: 0.03 * this.k, life: 1, age: 0, color: end?.type === 'target' ? tones[0] : INK });
    if (end) this.arc.list.push({ pos: end.type === 'target' ? end.hit.point : end.point, vel: new THREE.Vector3(), drag: 0, grav: 0, stretch: 1, size: 0.08 * this.k, life: 1, age: 0, color: end.type === 'target' ? tones[1] : INK });
    this.arc.update(0, _y);
  }

  /** One line for the HUD while aiming: the mode and the charges (no button list: the settings carry the controls). */
  hudText() {
    const pips = '◆'.repeat(this.reserve.charges) + '◇'.repeat(this.reserve.max - this.reserve.charges);
    const wait = this.reserve.level < this.reserve.max ? ` refill ${Math.ceil(this.reserve.refillIn)}s` : '';
    return `${this.modeName} ${pips}${wait}`;
  }
}

const _c = new THREE.Color();
