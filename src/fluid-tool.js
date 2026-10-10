import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, markHero, MODE_RIBBON } from './materials.js';
import { DRONE_BELLY, DOCK_ON_TOP, DOCK_ON_SIDE } from './drone.js';
import { raycastTargets, hitTarget, registerTarget, targetsInCone } from './targets.js';
import { game as sharedGame } from './game-state.js';
import { items as sharedItems, backpackStage } from './items.js';
import { triggers } from './controller.js';
import { decalBasis, gatherTriangles, projectSplat, flatSplat, splatMaterial, drawnHit, DrawnSurfaces, SPLAT_REACH } from './splat-decal.js';
import { MODES, STUN_SECONDS, FluidWings, FluidJets, HANDOFF, handoffPose, nextMode, ownedModes } from './fluid-kit.js';
import { FluidBlade, HIT_FX } from './fluid-blade.js';
import { MAGIC, MAGIC_COST } from './resources.js';
import { boostVelocity, DOUBLE_JUMP } from './jump.js';

// The magic-fluid backpack: the traveller's signature tool. A round glass tank of
// shifting, lava-lamp fluid rides on the back (no hose: it was cut in October 2026, accurate but stiff in
// play) and, once the fluid gun is found, feeds the glove on the right hand (its lit vial on the cuff shows
// the same fluid): the glove is what shoots, the fluid leaving from just in front of its knuckles. The
// progression rewrite (v1.38, docs/systems/progression.md): he starts with the fluid sword alone (the blade
// below works without any item); the backpack is the desert's first find, empty; its strengths come later
// (the lift valve's double jump, the wings, the jets: items.js BACKPACK_STAGES); the gun is a gadget
// (src/gadgets/gun.js), found in the Givers' Hearth, and shoots only while it is the gadget in hand
// (gunInHand). Its abilities share one magic bar (src/resources.js MAGIC: it was three charges, the tank's
// chambers; one unit is what a chamber was):
//   shoot  a glob of fluid, straight from the glove to the crosshair (no arc, no
//          preview): it splashes on whatever it meets and leaves a short-lived
//          colourful splat on surfaces (targets: onHit('shoot', point, dir, info)).
//          Only while aiming (LT / L2, right mouse, R) and the gun is in hand: RT / R2 (G,
//          a left click) shoots (controller.js triggers())
//   push   a short cone of fluid shock (~6 m) that knocks people, creatures
//          and loose things away (targets in the cone: onHit('push', point, dir, info))
//   lift   the double jump (player.js, the lift valve): a puff of fluid from the tank under the boots and
//          a flip; it costs nothing (liftFx is its look). It replaced the boost, a powered jump again
//          and again while the bar lasted (the old "triple jump")
// Like stamina, the bar refills by itself: MAGIC.delay s (1) after the last spend it starts to fill, the
// starting bar empty to full in MAGIC.fill s (4); the quick coil quickens both (src/boxes/effects.js).
//
// Everything but the blade runs on the backpack (src/items.js): without items.has('backpack')
// the tank is not worn and nothing fires. The other items grow out of it (fluid-kit.js):
//   jetpack  two nozzles under the tank. Thrust (jump held in the air) burns the same bar smoothly
//            (FLUID.jet.drain units a second: the starting bar is ten seconds
//            of flight); a shot needs a whole unit left. After a burn the bar
//            waits until you land, then refills as usual (no endless flight).
//   glider   fluid wings bloom out of the tank while gliding (hold jump while falling)
//   gun      the glove (a gadget): shown on the hand once found
//   stun / fire / bloom   gun modes (X, the pad's D-pad → with the gun in hand, the touch ◐ button): the glob
//            stills (onHit 'stun'), burns ('fire') or grows ('bloom') instead of splashing; all
//            modes share the bar (targets.js: who accepts which mode)
// Vehicles run on it too: boarding a powered vehicle swings the tank off the back into
// its socket (the player's boarding / unboarding timers, HANDOFF), and back on when you
// step off. While it is in a socket the tool is unavailable.
// The tank shows the bar's level in its glass (the HUD's magic bar, src/hud.js, says it on the screen);
// the glove's knuckles light for the whole units left, the plate on its back in the mode's tone. Magical water (the desert's
// cave) refills it and adds a colour band for good: tool.refill({ addColour: true }).
// An empty tank (game flag tool.empty: the desert's backpack comes out of its box dry,
// src/story/desert.js) holds nothing and never refills by itself: no magic, nothing
// fires, a press only sputters (and says so once: 'tool:dry'). The first magical water
// (any refill()) fills it and clears the flag for good. It may still hold the makers' dregs
// (flag tool.dregs: whole units of old fluid, the desert's chest leaves one): those fire as
// shots (never a push), are spent for good, and never come back; then it is dry again.
//
// Story API (main.js builds one FluidTool, window.tool; story code needs no
// import and can use the game-state bus instead, see game-state.js):
//   tool.charges          the whole units of magic left (0..the bar's length; tool.reserve.level: the exact level)
//   tool.colours          colour bands added to the fluid (game flag tool.colours, 1 at the start)
//   tool.tones            the tones in the blend, hex strings
//   tool.enabled          false: put away, nothing fires (the ship prologue, cutscenes)
//   tool.owned            the backpack is found (items.has('backpack')); tool.gunInHand: the gun is the gadget in hand
//   tool.dry              the tank is empty (flag tool.empty): nothing until magical water fills it
//   tool.mode / tool.modes / tool.setMode(id) / tool.cycleMode(±1)   'shoot' | 'push' | 'stun' | 'fire' | 'bloom' (push: the cone, fired as a shot)
//   tool.refill({ addColour, tone })   fill now; addColour adds a band (tone: its colour, optional)
//   game.emit('tool:refill', { addColour: true }) · game.emit('tool:enable', { on: false })
//   emits 'tool:fire' { mode, point } (mode: shoot / stun / fire / push / lift / jet start),
//   'tool:refilled' { charges, colours, added }, 'tool:mode' { mode }, 'tool:dock' { vehicle, on },
//   'tool:bloom' { point, normal } (a bloom glob landed on the world: src/boxes/effects.js grows a few flowers there)

/** Every tuning value in one place. */
export const FLUID = {
  charges: MAGIC.start,   // the magic bar's starting length in units, shared by shoot, boost and push (src/resources.js)
  refillDelay: MAGIC.delay,   // s after the last spend (after landing, for the jets) before it refills
  maxColours: 5,          // colour bands magical water can add (the blend shows colours + 1 tones)
  shoot: { speed: 34, gravity: 0, range: 42, cooldown: 0.28, splatLife: 5, splatSize: 0.75 },   // gravity 0: a straight shot
  push: { range: 6, angle: 0.62, cooldown: 0.4, shove: 2.4, recoil: 2.2 },    // angle: cone half-angle (rad, ~35°); shove: metres people are knocked back (info.shove)
  boost: DOUBLE_JUMP,                                       // the double jump's burst (src/jump.js, player.js); keep: share of a rising jump's speed kept
  jet: { drain: MAGIC_COST.jets, min: 0.02 },  // units burnt per second of thrust (3 = 10 s); min: the gauge that still lights them
};

// The fluid's tones, in the order bands are added (written into the shader's uFluidTones).
// A world's source can bring its own tone instead: refill({ addColour: true, tone: '#e9a53c' }).
export const FLUID_TONES = ['#72d5bf', '#e8ef9b', '#ef7e62', '#f6c84e', '#ed80b0', '#83cf71'];
/** The tones in the blend for a number of colour bands (1 -> cyan and violet); custom[i] overrides tone i. */
export const fluidTones = (colours = 1, custom = []) => FLUID_TONES.slice(0, THREE.MathUtils.clamp(Math.round(colours), 1, FLUID.maxColours) + 1).map((t, i) => (i >= 2 && custom?.[i]) || t);

/**
 * Map raw input (keyboard, mouse, gamepad and touch all write into the same object) to the tool's controls.
 * shoot only while aiming (fire: the button itself, so a press held from before the aim does not shoot);
 * quick: the touch button's shot, which aims for you. Boost is jump in the air (player.js).
 */
export function toolInput(c = {}) {
  const t = triggers(c);
  return {
    aim: t.aim,
    shoot: t.shoot,
    fire: t.fire,
    quick: t.quick,
    // the fluid blade (src/fluid-blade.js): the left mouse button while not aiming (pointer captured), F, RB / R1, touch ⚔
    blade: !!(c.KeyF || c.PadBlade || c.TouchBlade || (c.MouseLeft && !t.aim)),
    guard: !!(c.ControlLeft || c.ControlRight || c.KeyZ || c.PadGuard || c.TouchGuard),   // separate held guard: Ctrl or Z, LB / L1, touch shield
    evade: !!(c.AltLeft || c.AltRight || c.PadEvade || c.TouchEvade),   // Alt, B / ○, touch ↶
    mode: !!(c.KeyX || c.PadModeNext),     // the next owned gun mode (X, the pad's D-pad →)
  };
}

/** Mouse: hold the right button to aim, the left button shoots while aiming (with the pointer captured and not aiming: the blade). */
export function bindToolMouse(dom, input) {
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('mousedown', (e) => {
    if (e.button === 2) input.MouseRight = true;
    if (e.button === 1) e.preventDefault();
    if (e.button === 0 && (document.pointerLockElement === dom || input.MouseRight)) input.MouseLeft = true;
  });
  window.addEventListener('mouseup', (e) => { const k = ['MouseLeft', 'MouseMiddle', 'MouseRight'][e.button]; if (k) input[k] = false; });
}

/**
 * The magic bar: a gauge of `max` units (src/resources.js MAGIC). use(cost) spends `cost` units if there
 * are that many (a shot, a push, a boost: one); drain(amount) burns part of one (the jets); update(dt)
 * counts the time since the last spend and, after `delay` s, fills it at `rate` units a second like
 * stamina (returns true on the frame it is full again). hold() keeps the clock at 0.
 */
export class Reserve {
  constructor(max = FLUID.charges, delay = FLUID.refillDelay, rate = MAGIC.start / MAGIC.fill) {
    this.max = max; this.delay = delay; this.rate = rate; this.level = max; this.since = Infinity;
  }
  /** Whole units left. */
  get charges() { return Math.floor(this.level + 1e-6); }
  set charges(n) { this.level = n; }
  use(cost = 1) {
    if (this.level < cost - 1e-6) return false;
    this.level = Math.max(0, this.level - cost); this.since = 0;
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
    if (this.level >= this.max) { if (this.level > this.max) this.level = this.max; return false; }
    const wait = Math.max(0, this.delay - this.since);
    this.since += dt;
    const run = dt - wait;   // (the part of this frame after the wait)
    if (run <= 0) return false;
    this.level = Math.min(this.max, this.level + this.rate * run);
    return this.level >= this.max - 1e-9;
  }
  /** Seconds until it is full again (0 when full). */
  get refillIn() { return this.level >= this.max ? 0 : Math.max(0, this.delay - this.since) + (this.max - this.level) / Math.max(1e-6, this.rate); }
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
 * A glob of fluid: flies straight (FLUID.shoot.gravity is 0; a gravity along
 * -up, which can point anywhere, still bends it if given) and sweeps each step
 * against the targets and the world. step()
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
 * Aiming locked on (v1.41, the author: "gun aim stays on the locked target when aiming with L2 while locked on"): main.js
 * turns the camera to the locked foe's chest from where the camera stands (lockAim: the over-the-shoulder camera's own
 * yaw and pitch, CameraRig's convention: yaw about the frame's up from its forward, pitch + looking down) at `rate`;
 * and the crosshair's ray passing within `snap` m of that chest takes it (updateAimPoint), the line to it clear.
 */
export const LOCK_AIM = { rate: 14, snap: 1.4 };
/** The camera's yaw and pitch to look from `from` at `to` in frame F ({ up, fwd, right }). */
export function lockAim(from, to, F) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, len = Math.hypot(dx, dy, dz) || 1;
  const r = dx * F.right.x + dy * F.right.y + dz * F.right.z, a = dx * F.fwd.x + dy * F.fwd.y + dz * F.fwd.z, u = dx * F.up.x + dy * F.up.y + dz * F.up.z;
  return { yaw: Math.atan2(-r, -a), pitch: Math.asin(THREE.MathUtils.clamp(-u / len, -1, 1)) };
}
/** How far (m) the ray from `o` along unit `dir` passes from `p`, and whether `p` is ahead of it. */
export function rayMiss(o, dir, p) {
  const along = (p.x - o.x) * dir.x + (p.y - o.y) * dir.y + (p.z - o.z) * dir.z;
  if (along <= 0) return Infinity;
  return Math.hypot(p.x - o.x - dir.x * along, p.y - o.y - dir.y * along, p.z - o.z - dir.z * along);
}

/**
 * The way a shot leaves the nozzle at `from`: straight at the crosshair's point
 * `to` (the camera ray's first hit, so the glob lands where the crosshair sits),
 * or along the camera's aim `aimDir` when the point is closer than 2 m (the
 * nozzle is beside it: the line from it would be meaningless).
 */
export function shotDir(from, to, aimDir, out = new THREE.Vector3()) {
  out.subVectors(to, from);
  const d = out.length();
  return d < 2 ? out.copy(aimDir).normalize() : out.divideScalar(d);
}

/**
 * What you see is what you hit: if a ledge or a lip right in front of the nozzle stands
 * between it and a crosshair point the camera sees, the shot leaves from beside the nozzle
 * on the crosshair's own ray instead (the point of the ray at the nozzle's depth, never
 * before `rayFrom`, where that ray is known clear). Mutates from and dir.
 */
export function clearLine(physics, from, dir, to, rayFrom, rayDir, kind = 'world') {
  const dist = from.distanceTo(to);
  if (kind === 'none' || dist < 2) return false;
  const w = rayWorld(physics, from, dir, dist - 0.35);
  if (!w) return false;
  const t = Math.max(0, _cl.subVectors(from, rayFrom).dot(rayDir));
  from.copy(rayFrom).addScaledVector(rayDir, Math.min(t, Math.max(0, rayFrom.distanceTo(to) - 0.5)));
  dir.copy(rayDir);
  return true;
}
const _cl = new THREE.Vector3();

/** The double jump's burst (src/jump.js boostVelocity: the lift valve, player.js; once the fluid boost). */
export { boostVelocity };

// ---------------------------------------------------------------- visuals

const INK = '#263c37', BRASS = '#acaa78', BRASS_DARK = '#6c806b', STEEL = '#83b9ae', STEEL_DARK = '#3d6b60';
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

/**
 * Instanced dots and dashes: droplets, sprays, the glob's wake. A dot may carry a `floor` (its height along up) and
 * `land(dot)`: falling through it, it is gone and land is called (the sword's drops splash: src/fluid-blade.js); a
 * `flat` one lies flat on the ground (a splash).
 */
export class Dots {
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
    let i = 0, landed = null;
    for (const d of this.list) {
      d.vel.multiplyScalar(Math.exp(-d.drag * dt)).addScaledVector(up, -d.grav * dt);
      d.pos.addScaledVector(d.vel, dt);
      // (a drop given a `floor` (its height along up) and `land`: falling through it, it is gone and land(drop) is called)
      if (d.land && d.pos.dot(up) < d.floor && d.vel.dot(up) < 0) { d.age = d.life; (landed ??= []).push(d); continue; }
      const k = 1 - d.age / d.life, s = d.size * (d.grow ? 0.4 + 0.6 * Math.min(1, d.age * 8) : 1) * Math.min(1, k * 2.2);
      const sp = d.vel.length();
      if (d.flat) this._q.setFromUnitVectors(this._y, up);   // (a splash: a disc flat on the ground)
      else if (d.stretch > 1 && sp > 0.05) this._q.setFromUnitVectors(this._y, this._v.copy(d.vel).divideScalar(sp));
      else this._q.identity();
      this._s.set(s, d.flat ? s * 0.15 : s * (d.stretch > 1 ? 1 + (d.stretch - 1) * Math.min(1, sp / 4) : 1), s);
      this._m.compose(d.pos, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, this._c.set(d.color));
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (landed) for (const d of landed) d.land(d);
  }
}

/**
 * Short-lived colourful splats where globs land: two tones, grown fast, shrinking away. Each one is
 * projected onto the surface it hit (splat-decal.js): the world's triangles round the hit point,
 * clipped to the splat's box, so it wraps over curves and edges with no gap and no float. All of
 * them share one mesh (one draw call), rewritten only when a splat comes or goes; the shader grows
 * and shrinks each in place by its age.
 */
export class Splats {
  /** physics: the collision (or a function returning it) */
  constructor(parent, physics = null, { max = 24, maxCorners = 30000 } = {}) {
    this.physics = physics;
    this.max = max; this.maxCorners = maxCorners;
    this.list = []; this.time = 0;
    const g = new THREE.BufferGeometry();
    const attr = (name, size) => { const a = new THREE.BufferAttribute(new Float32Array(maxCorners * size), size); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.attrs = { position: attr('position', 3), normal: attr('normal', 3), color: attr('color', 3), aSplat: attr('aSplat', 4), aSplat2: attr('aSplat2', 4) };
    g.setDrawRange(0, 0);
    this.material = splatMaterial();
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.name = 'Fluid splats';
    // (always shown, an empty draw range when there are none: so the shader warm-up at load compiles it)
    this.mesh.frustumCulled = false;
    Object.assign(this.mesh.userData, { noCollide: true, dynamic: true, noLod: true });
    parent.add(this.mesh);
    this._c = new THREE.Color(); this._u = new THREE.Vector3(); this._v = new THREE.Vector3(); this._n = new THREE.Vector3(); this._d = new THREE.Vector3();
  }

  /**
   * A splat on a surface (point, unit normal) in two tones: projected onto what is there. dir: the
   * shot's direction (unit), if it came flying: the splat is cast halfway between the surface's normal
   * and back along the shot, so a step's riser facing you takes paint as well as its tread.
   */
  add(point, normal, toneA, toneB, size = FLUID.shoot.splatSize, life = FLUID.shoot.splatLife, dir = null) {
    const sq = 0.8 + Math.random() * 0.35, n = this._n.copy(normal).normalize(), angle = Math.random() * Math.PI * 2;
    const basis = decalBasis(n, angle, this._u, this._v);
    // the box: in front of the hit for what stands proud of it, deep behind it to wrap round curves and edges
    const sx = size * sq, sy = size / sq, front = Math.max(0.3, size * 0.8), back = Math.max(0.4, SPLAT_REACH * Math.max(sx, sy) * 0.9);
    const physics = typeof this.physics === 'function' ? this.physics() : this.physics;
    const drawn = this.drawnSurfaces(physics);
    let piece = null;
    if (physics?.bvh || physics?.base?.heightAt || drawn) {
      // what is drawn round the hit, in any direction the splat may be cast (and a margin: the drawn
      // surface may lie a little off the collision's)
      const m = 0.6, R = Math.max(sx * SPLAT_REACH, sy * SPLAT_REACH, front, back) + m;
      const tris = gatherTriangles(physics, point, basis, R, R, R, R, { drawn });
      // the glob hit the collision; the splat sits on the drawn surface there (a dome's or a trunk's stand-in can differ)
      const on = drawnHit(tris, point, n, m);
      const center = on?.point ?? point;
      if (on) n.copy(on.normal);
      if (dir) n.sub(this._d.copy(dir).normalize()).normalize();
      decalBasis(n, angle, this._u, this._v);
      piece = projectSplat(tris, { center, basis, sx, sy, front, back });
    }
    if (!piece?.count) piece = flatSplat({ center: point, basis, sx, sy });   // nothing to project onto: flat, as before
    this.list.push({ piece, born: this.time, life, a: this._c.set(toneA).toArray(), b: this._c.set(toneB).toArray(), phase: Math.random() * 6.283 });
    while (this.list.length > this.max || this.corners() > this.maxCorners) this.list.shift();
    this.rebuild();
  }
  corners() { let n = 0; for (const s of this.list) n += s.piece.count; return n; }

  /** The scene's static drawn meshes (splat-decal.js), the ground's own left to its exact heightfield. */
  drawnSurfaces(physics) {
    const scene = this.mesh.parent?.parent;
    if (!scene) return null;
    if (this.drawn?.scene !== scene) {
      const ground = physics?.base?.mesh?.geometry?.attributes?.position;
      this.drawn = new DrawnSurfaces(scene, { exclude: (o) => !!ground && o.geometry.attributes.position === ground });
    }
    return this.drawn;
  }

  update(dt) {
    this.time += dt;
    this.material.uniforms.uSplatTime.value = this.time;
    // the drawn surfaces are found once, a moment after the world is up, not on the first shot
    if (!this.drawn?.items && this.time > 1.5) this.drawnSurfaces(typeof this.physics === 'function' ? this.physics() : this.physics)?.collect();
    if (!this.list.length) return;
    const n = this.list.length;
    this.list = this.list.filter((s) => this.time - s.born < s.life);
    if (this.list.length !== n) this.rebuild();
  }

  /** Write every live splat into the shared buffers. */
  rebuild() {
    const A = this.attrs;
    let k = 0;
    for (const s of this.list) {
      const { positions, normals, coords, count } = s.piece;
      A.position.array.set(positions, k * 3);
      A.normal.array.set(normals, k * 3);
      for (let i = 0; i < count; i++) {
        const j = k + i;
        A.color.array.set(s.a, j * 3);
        A.aSplat.array[j * 4] = coords[i * 2]; A.aSplat.array[j * 4 + 1] = coords[i * 2 + 1];
        A.aSplat.array[j * 4 + 2] = s.born; A.aSplat.array[j * 4 + 3] = s.life;
        A.aSplat2.array[j * 4] = s.phase; A.aSplat2.array[j * 4 + 1] = s.b[0]; A.aSplat2.array[j * 4 + 2] = s.b[1]; A.aSplat2.array[j * 4 + 3] = s.b[2];
      }
      k += count;
    }
    for (const a of Object.values(A)) { a.clearUpdateRanges(); a.addUpdateRange(0, k * a.itemSize); a.needsUpdate = true; }
    this.mesh.geometry.setDrawRange(0, k);
  }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); this.mesh.removeFromParent(); }
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
// 0.74 at the collar, +z forward, the character's right at -x). The round backpack (v1.38, the progression
// rewrite; references/Core Objects/Round Backpack/, the worn sheet): a glass dome, half a sphere, of living jade
// fluid (a little nebula: materials.js flaskNebula) on a flat brass porthole ring lying against the back (the ring's
// plane z = 0, the dome out toward -z, 0.85 of its radius deep), a band across its equator with three charge lights,
// a boss under the ring, a short capped brass neck on the ring's top with a turquoise cloth tied round it, a slim
// olive canvas back plate against the body and leather straps up over the shoulders; no hose. Its stages (items.js
// BACKPACK_STAGES, the states sheet's second pick): 1 the lift valve (the valve's wheel on the neck, a second ring,
// two small fins), 2 the wings (folding brass vanes at its sides), 3 the jets (a second valve on the cap, the glass
// brighter, the fluid quicker). The side struts carry the scout and lantern; charge height, vehicle socket and scout
// docks keep their frames.
const SPHERE_R = 0.19, SPHERE_Y = SPHERE_R + 0.01;
/** How deep the dome stands out of its ring, in its radius (1: a true half sphere). */
const DOME_DEPTH = 0.85;
/** The back plate's front face (tank frame z, the ring's flange between it and the ring's plane) and its thickness. */
const PLATE_Z = 0.02, PLATE_D = 0.015, PLATE_BEVEL = 0.008;
export const TANK = {
  at: [0, 0.4, -0.245],     // the ring's centre at the glass's foot: on the old body's rucksack's outer face (the plate sunk in it)
  scale: 0.8,               // a dome 30 cm across on the adult body (the sheet: "about the size of a large melon")
  height: SPHERE_Y + SPHERE_R,   // glass
  full: SPHERE_Y + SPHERE_R - 0.025,   // fluid height with the bar full (a sliver of air under the neck)
  squash: 1,                // across the back (x), of the round profile
  depth: DOME_DEPTH,        // out from the back (-z): a dome, half a sphere a little flattened
  dome: { z: 0, plate: PLATE_Z, plateD: PLATE_D + 2 * PLATE_BEVEL },   // the ring's plane (the dome's flat face), the plate's front face and thickness (padded)
  radius: SPHERE_R, center: SPHERE_Y,
  straps: [],               // leather bands round the glass (none: the cradle holds it, the straps go over the shoulders)
  // the dome's outline (radius at height), for the dock clearance and tankRadiusAt
  profile: Array.from({ length: 13 }, (_, i) => { const a = -Math.PI / 2 + (i / 12) * Math.PI; return [Math.max(0.02, SPHERE_R * Math.cos(a)), SPHERE_Y + SPHERE_R * Math.sin(a)]; }),
  collar: { y: SPHERE_Y + SPHERE_R - 0.015, h: 0.05 },   // the straps' attachment frame, round the neck
  neck: { y: SPHERE_Y + SPHERE_R - 0.015, h: 0.05, r: 0.05, stopper: 0.036, z: -0.022 },   // on the ring's top, leaning onto the glass
  band: { y: SPHERE_Y, h: 0.042 },   // the brass band across the dome's equator, its three charge lights on the outer face
  plate: { w: 0.36, h: 0.46, d: PLATE_D },   // the olive canvas back plate (worn)
  highlight: -1.05,         // (the old sphere's streak angle; the dome's window highlight is in its shader)
  inked: true,              // (kept out of the player's soft-ink mask: the glass draws its own outline-only ink)
  base: '#49ab83',          // the living fluid's own green (a gun mode tints it its first tone)
  glow: [0.32, 0.62],       // the glass's glow: empty .. full (the magic bar); the jets' stage adds STAGE_GLOW
};
/** How much brighter the glass is at the jets' stage (3), and how much quicker its fluid. */
export const STAGE_GLOW = 0.18, STAGE_RATE = 1.3;
const profileCurve = new THREE.SplineCurve(TANK.profile.map(([r, y]) => new THREE.Vector2(r, y)));
function radiusAt(y) {
  // the profile is monotonic in y: a few bisection steps are plenty
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (profileCurve.getPoint(m).y < y) lo = m; else hi = m; }
  return profileCurve.getPoint((lo + hi) / 2).x;
}
/** The glass's radius at height y (tank frame, across the back: x × TANK.squash; out from it, -z × TANK.depth). */
export const tankRadiusAt = radiusAt;
/**
 * How far a point (tank frame) is from the glass, as the dome's ellipsoid measure: under 1 inside the dome (the
 * ring's plane z = 0 to its top, -z × TANK.depth out), over 1 outside; a point behind the ring's plane (z > 0,
 * toward the back) is never in the glass.
 */
export function tankGlassMeasure(p) {
  if (p.z > TANK.dome.z) return Infinity;
  const R = SPHERE_R;
  return (p.x / (R * TANK.squash)) ** 2 + ((p.y - SPHERE_Y) / R) ** 2 + ((p.z - TANK.dome.z) / (R * TANK.depth)) ** 2;
}
/**
 * The scout's dock on the tank, in the tank's frame (it rides with the tank, into a vehicle's
 * socket too): clamped by its foot to the top of the cradle's left strut (the wearer's left),
 * beside the neck and above the shoulder, over the strut's top bracket (the lantern hangs from
 * the strut below), off the glass.
 */
// (the top and the dock where they were on the body with the old, taller tank: 0.645 and 0.624 of it over a
// glass bottom 0.12 m lower; high enough that the swinging arms never reach the scout. v1.38's slimmer dome: the
// struts stand beside it, between its ring and its top, 11 cm nearer the back than beside the old sphere)
export const TANK_RAIL = { x: SPHERE_R * TANK.squash + 0.03, r: 0.012, z: -0.07, top: 0.495, brackets: [0.06, TANK.center] };
export const SCOUT_DOCK_Y = 0.474;
export const SCOUT_DOCK_X = TANK_RAIL.x + TANK_RAIL.r + DRONE_BELLY / TANK.scale + 0.002;
export const SCOUT_DOCK_Z = TANK_RAIL.z;
/**
 * While the fluid wings are open (gliding) their roots and lobes fill the tank's sides, so the
 * scout hops up onto the cap, between them (its foot over the valve's bead), and back down to the
 * rail when they fold: scoutDockPose(k) is that hop (k 0 on the rail .. 1 on the cap), along an
 * arc that stays clear of the glass, turning from side-on to upright.
 */
export const SCOUT_CAP = { y: TANK.neck.y + TANK.neck.h + 0.07 + DRONE_BELLY / TANK.scale, hop: 0.2 };
const _dockArc = [new THREE.Vector3(SCOUT_DOCK_X, SCOUT_DOCK_Y, SCOUT_DOCK_Z), new THREE.Vector3(SCOUT_DOCK_X + 0.03, SCOUT_DOCK_Y + 0.14, SCOUT_DOCK_Z), new THREE.Vector3(0, SCOUT_CAP.y, TANK.neck.z)];
export function scoutDockPose(k, pos, quat) {
  const t = THREE.MathUtils.smoothstep(k, 0, 1), [a, b, c] = _dockArc;
  pos.set(0, 0, 0).addScaledVector(a, (1 - t) ** 2).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(c, t * t);
  quat.copy(DOCK_ON_SIDE).slerp(DOCK_ON_TOP, t);
  return pos;
}

const LEATHER = '#6a4a33', CANVAS = '#7d8a5a', CANVAS_DARK = '#5f6c44', CLOTH = '#3f9a92', LIGHT_OFF = '#3d6b60';
/**
 * The round backpack itself (the worn tank's and the item's picture, src/boxes/model.js): the glass dome in its
 * fluid material (`glassMat`: its dome uniform set here), the brass porthole ring it stands on (a rim in the plane
 * of the back and a flange back to the plate), the band across its equator with its three charge lights, the boss
 * under the ring, the neck and its cap on the ring's top, the cloth tie and, worn (`worn`), the slim canvas back plate
 * and the leather straps up over the shoulders. In the tank's frame. Returns { group, glass, lights, stages }:
 * `lights` the band's three charge lights (lit for the units of the bar: FluidTool.updateWorn), `stages`
 * [null, s1, s2, s3] the parts each backpack stage adds (shown by setStage), kept apart from the merged rest.
 */
export function buildFlask(glassMat, { worn = true, mat = flatMat, stage = 3 } = {}) {
  const g = new THREE.Group();
  g.name = 'Round backpack';
  const add = (geo, m, x = 0, y = 0, z = 0, to = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); to.add(o); return o; };
  const R = SPHERE_R, CY = SPHERE_Y, N = TANK.neck, B = TANK.band, K = TANK.depth, PZ = PLATE_Z;
  // (its vertices in the tank's frame, the centre CY up: the shader reads the fill height off them, and marches
  // its nebula through the dome its uniform describes)
  const glass = add(new THREE.SphereGeometry(R, 40, 22, Math.PI, Math.PI).scale(1, 1, K).translate(0, CY, 0), glassMat);
  glass.name = 'Fluid glass';
  glassMat.uniforms?.uFluidDome?.value.set(0, CY, TANK.dome.z, R);
  glassMat.uniforms?.uFluidDomeK && (glassMat.uniforms.uFluidDomeK.value = K);
  const brass = mat(BRASS), dark = mat(BRASS_DARK), open = mat(BRASS, { side: THREE.DoubleSide });
  // half a ring (a torus' arc) laid round the dome's -z half: across it (`across`, in the xz plane) or over it (yz)
  const halfRing = (r, tube, across, segs = 32) => {
    const t = new THREE.TorusGeometry(r, tube, 4, segs, Math.PI);
    return (across ? t.rotateX(-Math.PI / 2) : t.rotateZ(-Math.PI / 2).rotateY(Math.PI / 2)).scale(1, 1, K);
  };
  // the porthole ring: a rim round the glass in the plane of the back, a flange tapering back to the plate (in, so
  // the sword's frog behind the right shoulder stays clear: tests/sword-sheath.test.js)
  add(new THREE.TorusGeometry(R + 0.003, 0.007, 6, 48), brass, 0, CY, 0);
  add(new THREE.CylinderGeometry(R - 0.018, R + 0.008, PZ, 48, 1, true).rotateX(Math.PI / 2), open, 0, CY, PZ / 2);
  // the band across the dome's equator (half a hoop) and its edges
  const band = add(new THREE.CylinderGeometry(R + 0.008, R + 0.008, B.h, 32, 1, true, Math.PI / 2, Math.PI).scale(1, 1, K), open, 0, B.y, 0);
  band.name = 'Band';
  for (const y of [B.y - B.h / 2, B.y + B.h / 2]) add(halfRing(R + 0.009, 0.004, true), dark, 0, y, 0);
  // rivets where the band meets the ring, and the boss under it
  for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.012, 8, 6), dark, sx * (R + 0.012), CY, -0.006);
  add(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 16).rotateX(Math.PI / 2), brass, 0, 0.006, -0.004);
  add(new THREE.SphereGeometry(0.014, 8, 6), dark, 0, 0.006, -0.022);
  // the neck and its cap on the ring's top, a collar ring, and the turquoise cloth tied round it (its knot and a loose end)
  const NZ = N.z;
  add(new THREE.CylinderGeometry(N.r * 0.92, N.r, N.h, 18), brass, 0, N.y + N.h / 2, NZ);
  add(new THREE.TorusGeometry(N.r * 1.02, 0.007, 4, 18).rotateX(Math.PI / 2), dark, 0, N.y + N.h * 0.75, NZ);
  add(new THREE.CylinderGeometry(N.stopper, N.stopper * 1.05, 0.02, 14), brass, 0, N.y + N.h + 0.01, NZ);
  add(new THREE.TorusGeometry(N.r * 1.12, 0.014, 6, 18).rotateX(Math.PI / 2).scale(1, 0.8, 1), mat(CLOTH), 0, N.y + 0.012, NZ);
  add(new THREE.SphereGeometry(0.022, 8, 6).scale(1.3, 0.9, 0.8), mat(CLOTH), 0.04, N.y + 0.008, NZ - 0.035);
  add(new THREE.BoxGeometry(0.018, 0.06, 0.008).rotateZ(-0.5), mat(CLOTH), 0.062, N.y - 0.03, NZ - 0.045);
  // the band's three charge lights on its outer face (-z: away from the back), each its own material (lit by FluidTool)
  const lights = [-1, 0, 1].map((i) => { const a = Math.PI + i * 0.2; const m = add(new THREE.SphereGeometry(0.0115, 8, 6), makeMaterial({ color: LIGHT_OFF, flat: true, glow: 0.2 }), Math.sin(a) * (R + 0.012), B.y, Math.cos(a) * (R + 0.012) * K - 0.004); m.name = 'Charge light'; return m; });
  if (worn) {
    // the slim olive canvas back plate behind the ring, against his back, padded, stitched round, two rivets
    const P = TANK.plate;
    const shape = new THREE.Shape(), w = P.w / 2, h = P.h, r = 0.06, y0 = CY - h / 2;
    shape.moveTo(-w + r, y0); shape.lineTo(w - r, y0); shape.quadraticCurveTo(w, y0, w, y0 + r); shape.lineTo(w, y0 + h - r);
    shape.quadraticCurveTo(w, y0 + h, w - r, y0 + h); shape.lineTo(-w + r, y0 + h); shape.quadraticCurveTo(-w, y0 + h, -w, y0 + h - r);
    shape.lineTo(-w, y0 + r); shape.quadraticCurveTo(-w, y0, -w + r, y0);
    add(new THREE.ExtrudeGeometry(shape, { depth: P.d, bevelEnabled: true, bevelSize: PLATE_BEVEL, bevelThickness: PLATE_BEVEL, bevelSegments: 2, curveSegments: 6 }), mat(CANVAS), 0, 0, PZ + PLATE_BEVEL);
    const edge = shape.getPoints(10).map((p) => new THREE.Vector3(p.x * 0.9, CY + (p.y - CY) * 0.92, PZ - 0.002));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge.slice(0, -1), true), 72, 0.0035, 4, true), mat(CANVAS_DARK));
    for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.012, 8, 6), dark, sx * (w - 0.04), y0 + h - 0.05, PZ - 0.002);
    // the leather straps: from the plate's top corners up over his shoulders (into the collar of his shirt), buckled
    // (their far end where v1.37's sphere had it on the body: the plate's back is where it was)
    const shift = PZ + P.d + 2 * PLATE_BEVEL - (R + 0.012 + 0.045 + 0.012);
    for (const sx of [-1, 1]) {
      const a = new THREE.Vector3(sx * (w - 0.05), y0 + h - 0.02, PZ + 0.02), b = new THREE.Vector3(sx * 0.105, 0.43 / TANK.scale + 0.05, 0.27 / TANK.scale + 0.12 + shift), d = b.clone().sub(a);
      const strap = add(new THREE.BoxGeometry(0.046, 0.011, d.length()), mat(LEATHER), (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
      add(new THREE.BoxGeometry(0.034, 0.018, 0.022), brass, a.x, a.y, a.z + 0.004).quaternion.copy(strap.quaternion);   // its buckle
    }
  }
  // the stages' parts (setStage shows them): 1 the lift valve, 2 the wings' vanes, 3 the jets' valve
  const stages = [null, new THREE.Group(), new THREE.Group(), new THREE.Group()];
  stages.forEach((s, i) => { if (s) { s.name = `Backpack stage ${i}`; g.add(s); } });
  {
    const s = stages[1];
    // the valve's wheel on the neck's cap (the sheet's), a second ring over the dome (top to bottom), two small fins on the band
    const top = N.y + N.h + 0.02;
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 8), dark, 0, top + 0.017, NZ, s);
    add(new THREE.TorusGeometry(0.045, 0.007, 5, 20).rotateX(Math.PI / 2), brass, 0, top + 0.036, NZ, s);
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.09, 0.006, 0.006).rotateY((i * Math.PI) / 3), brass, 0, top + 0.036, NZ, s);
    add(halfRing(R + 0.012, 0.008, false, 32), brass, 0, CY, 0, s);
    for (const sx of [-1, 1]) {
      const fin = new THREE.Shape(); fin.moveTo(0, -0.03); fin.lineTo(0.075, -0.006); fin.lineTo(0.07, 0.016); fin.lineTo(0, 0.03); fin.lineTo(0, -0.03);
      const m = add(new THREE.ExtrudeGeometry(fin, { depth: 0.008, bevelEnabled: false }).translate(0, 0, -0.004), open, sx * (R + 0.016), B.y, -0.012, s);
      m.rotation.y = sx < 0 ? Math.PI : 0;
    }
  }
  {
    const s = stages[2];
    // folding brass vanes at the sides like little wings, folded back along the ring (three a side, on a hinge post)
    for (const sx of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.009, 0.009, 0.12, 8), dark, sx * (R + 0.03), B.y + 0.02, 0.005, s);
      for (let i = 0; i < 3; i++) {
        const vane = new THREE.Shape(); vane.moveTo(0, -0.018); vane.lineTo(0.13 - i * 0.025, -0.01); vane.lineTo(0.12 - i * 0.025, 0.014); vane.lineTo(0, 0.018); vane.lineTo(0, -0.018);
        const m = add(new THREE.ExtrudeGeometry(vane, { depth: 0.006, bevelEnabled: false }), open, sx * (R + 0.03), B.y + 0.06 - i * 0.04, 0.005, s);
        m.rotation.set(0, sx < 0 ? Math.PI - 1.1 : 1.1, sx * (0.35 - i * 0.3));
      }
    }
  }
  {
    const s = stages[3];
    // the jets' extra valve: a capped brass stack on the ring's shoulder beside the neck, its own little wheel
    add(new THREE.CylinderGeometry(0.018, 0.022, 0.07, 12), brass, 0.085, N.y, -0.01, s);
    add(new THREE.CylinderGeometry(0.026, 0.026, 0.014, 12), dark, 0.085, N.y + 0.04, -0.01, s);
    add(new THREE.TorusGeometry(0.022, 0.005, 4, 14).rotateX(Math.PI / 2), brass, 0.085, N.y + 0.056, -0.01, s);
  }
  setStage({ stages }, stage);
  return { group: g, glass, lights, stages };
}

/** Show the parts of a backpack stage (0..3) and those below it (buildFlask's `stages`). */
export function setStage(flask, stage = 0) {
  (flask.stages ?? []).forEach((s, i) => { if (s) s.visible = i <= stage; });
  return flask;
}

function buildTank(stage = 0) {
  const { group: g, glass, lights, stages } = buildFlask(makeMaterial({ color: '#ffffff', fluid: 'tank', glow: TANK.glow[1], fluidBox: [0, TANK.full, SPHERE_R, TANK.highlight], fluidTones: FLUID_TONES, fluidBase: TANK.base }), { stage });
  g.name = 'Fluid tank';
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  // the cradle's brass struts at the sphere's sides, bracketed to the plate: the scout rides the left one's top, the lantern hangs off it
  const railX = TANK_RAIL.x;
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(TANK_RAIL.r, TANK_RAIL.r, TANK_RAIL.top - 0.05, 6), flatMat(BRASS_DARK), sx * railX, 0.05 + (TANK_RAIL.top - 0.05) / 2, TANK_RAIL.z);
    for (const y of TANK_RAIL.brackets) add(new THREE.BoxGeometry(0.026, 0.024, PLATE_Z - TANK_RAIL.z), flatMat(BRASS_DARK), sx * railX, y, (TANK_RAIL.z + PLATE_Z) / 2);   // (back to the plate; short: clear of the sword's frog behind the shoulder)
    add(new THREE.SphereGeometry(0.018, 8, 6), flatMat(BRASS), sx * railX, TANK_RAIL.top, TANK_RAIL.z);   // a brass knob on the strut's top
  }
  mergeParts(g, [glass, ...lights, ...stages.filter(Boolean)]);
  g.position.set(...TANK.at); g.scale.setScalar(TANK.scale);
  return { group: noCollide(g), glass, lights, stages, top: TANK.at[1] + (TANK.neck.y + TANK.neck.h + 0.05) * TANK.scale };
}

/**
 * The glove the fluid comes out of: the traveller wears it on his right hand (traveller.js
 * fluidGlove: meshes skinned to the hand, hidden until the tank is worn, a plate and three charge
 * lights and the vial on its cuff; Humanoid.glove: their meshes and the fluid's mouth in front of the
 * knuckles). A body without one (an NPC's, the tests' bare rig) still shoots from its right hand: the
 * mouth a hand's length past the wrist.
 */
function gloveOf(H) {
  const G = H?.glove;
  return { meshes: G?.meshes ?? [], plate: G?.plate ?? null, lights: G?.lights ?? [], vial: G?.vial ?? null, muzzle: G?.muzzle ?? null, show: G?.show ?? null, visible: false };
}
/** A lit part of the glove: its colour (from ink to `tone` by `k`) and glow. (Read off the mesh each time: markHero swaps its material.) */
function lightGlove(mesh, tone, k, glow) {
  const u = mesh?.material?.uniforms;
  if (!u) return;
  u.uColor.value.set(INK).lerp(_c.set(tone), k);
  u.uGlow.value = glow * k;
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
    this.held = { fire: false, quick: false, push: false, blade: false, mode: false };
    this.mode = 'shoot'; this.modeFlash = 0; this.fluidTime = 0; this.rate = 1;
    this.appear = items.has('backpack') ? 1 : 0; this.stage = this.stageNow(); this.jetBurnt = false; this.where = 'back'; this.power = new Map();
    this.aimPoint = new THREE.Vector3(); this.aimDir = new THREE.Vector3(0, 0, -1);
    this.globs = [];
    this.fill = items.has('backpack') && state.flag('tool.empty') ? 0 : 1; this.flash = 0; this.wave = 0; this.slosh = 0; this.lastHit = null; this.ringLit = [1, 1, 1];
    this._lastVel = new THREE.Vector3(); this._hasVel = false;

    const fx = (this.fx = new THREE.Group());
    fx.name = 'Fluid effects'; fx.userData.noCollide = true;
    scene?.add(fx);
    noShadow?.push(fx);
    this.drops = new Dots(fx, 360, flatMat('#ffffff', { glow: 0.7 }));
    this.glow = new Dots(fx, 160, makeMaterial({ color: '#ffffff', flat: true, glow: 0.95 }));
    this.splats = new Splats(fx, () => this.physics);
    this.rings = new Rings(fx);
    const globMat = (this.globMat = makeMaterial({ color: '#ffffff', fluid: 'glob', glow: 0.8, fluidBox: [-1, 1, 1, 0], fluidTones: FLUID_TONES }));
    this.globU = globMat.uniforms;
    this.globMeshes = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), globMat); m.visible = false; m.userData.noCollide = true; fx.add(m); return m; });
    this.blade = new FluidBlade(this);   // the glove's blade of fluid (RB / R1, a left click, F)
    this.wear();

    // Things a glob wakes from afar: taxis cruising their lanes get hailed, and whatever the level offers.
    this.offs = [];
    for (const v of player?.vehicles ?? []) {
      if (!v.hail) continue;
      this.offs.push(registerTarget({ kind: 'vehicle', radius: 2.6, position: () => v.pos,
        enabled: () => v.mode === 'lane' || v.mode === 'return',
        onHit: (mode) => { if (mode === 'shoot' && !v.refuses?.(player, 'hail')) v.hail(player.pos, player.heading); return mode === 'shoot'; } }));
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
      // a strength found (the lift valve, the wings, the jets): the backpack's next stage, with a flash of fluid
      const stage = this.stageNow();
      if (stage !== this.stage) { const up = stage > this.stage; this.stage = stage; if (this.tank) setStage(this.tank, stage); if (up) { this.flash = 1; this.wave = 1; this.slosh = 1; } }
      if (!owned && !this.modes.includes(this.mode)) this.mode = 'shoot';
    }));
    // the double jump's puff of fluid (player.js asks for its look); the jets
    // burn the reserve (fuelSource) and boarding a vehicle swings the tank into it (handoff)
    if (player) { player.onDoubleJump = () => this.liftFx(); player.fuelSource = this; player.handoff = this; }
  }

  /** Put the tank and glove on the traveller (needs the humanoid's chest anchor and arm bones). */
  wear() {
    const p = this.player, H = p?.humanoid;
    if (!H?.chestAnchor) return;
    // (the traveller keeps his canvas rucksack, the flask sits in its outer face: traveller.js, updateWorn())
    if (!H.outfit) for (const o of (p.gear?.packDockParent ?? p.gear?.scoutDock?.parent)?.children ?? []) if (o.isMesh) o.visible = false;   // the procedural pack
    const tank = (this.tank = buildTank(this.stage ?? 0));
    tank.group.position.set(...this.tankAt);
    H.chestAnchor.add(tank.group);
    // the scout clings to the tank's left side (the cap would hide the helmet), folded, its foot on the glass
    this.placeDock(this.owned);
    this.glove = gloveOf(H);
    const copies = new Map(), glassMat = tank.glass.material;
    markHero(tank.group, copies);
    // the fluid stays out of the player's soft-ink mask, so the post pass inks its blobs like print
    if (TANK.inked) tank.glass.material = glassMat;
    this.tankU = tank.glass.material.uniforms;
    // the wings bloom from the cap (inked at full strength, like the fluid in the glass)
    this.wings = new FluidWings(tank.group, FLUID_TONES);
    // the fluid jets clip under the tank (the old canisters are gone, player.js); their flames are the globs' fluid
    const metal = { brass: flatMat(BRASS), dark: flatMat(STEEL_DARK), brassOpen: flatMat(BRASS, { side: THREE.DoubleSide }), core: makeMaterial({ color: '#fff6dc', flat: true, glow: 1 }) };
    this.jets = new FluidJets(tank.group, this.globMat, metal);
    this.wingU = this.wings.material.uniforms;
    this.chest = H.chestAnchor;
  }

  /**
   * The scout docks on the tank's side once it is worn (parented to the tank, so it goes along into
   * a vehicle's socket and back), else where the gear put it (on the rucksack's lid).
   */
  placeDock(owned) {
    const gear = this.player?.gear, dock = gear?.scoutDock;
    this._dockOwned = owned;
    if (!dock) return;
    if (owned || !gear.packDock) {
      const frame = this.tank?.group;
      if (frame) { if (dock.parent !== frame) frame.add(dock); scoutDockPose(this.scoutCapK ?? 0, dock.position, dock.quaternion); }
      else { dock.position.set(SCOUT_DOCK_X, TANK.at[1] + SCOUT_DOCK_Y, TANK.at[2] + SCOUT_DOCK_Z); dock.quaternion.copy(DOCK_ON_SIDE); }
    } else {
      if (gear.packDockParent && dock.parent !== gear.packDockParent) gear.packDockParent.add(dock);
      dock.position.copy(gear.packDock); dock.quaternion.copy(DOCK_ON_TOP);
    }
  }

  dispose() {
    this.offs.forEach((off) => off()); this.offs = [];
    this.blade?.dispose();
    this.fx.removeFromParent(); this.tank?.group.removeFromParent();
    if (this.glove?.show) this.glove.show(false); else for (const o of this.glove?.meshes ?? []) o.visible = false;
    const p = this.player;
    if (p?.onDoubleJump) p.onDoubleJump = null;
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
  /** Where the flask sits on the back (chest anchor frame): the body's own place for it (Humanoid.tankAt), else TANK.at. */
  get tankAt() { return this.player?.humanoid?.tankAt ?? TANK.at; }
  /** The backpack is found. */
  get owned() { return this.items.has('backpack'); }
  /** The tank is empty (the desert's backpack, until the giant's pool fills it): no charges, no refill. */
  get dry() { return this.owned && !!this.state.flag('tool.empty'); }
  /** The makers' dregs left in an empty tank (flag tool.dregs): shots only, spent for good. */
  get dregs() { return this.dry ? Math.max(0, Math.min(this.reserve.max, Math.floor(Number(this.state.flag('tool.dregs')) || 0))) : 0; }
  /** The tank is on the traveller's back (not in a vehicle's socket, nor swinging between). */
  get worn() { const p = this.player; return this.owned && !p?.ride && !p?.boarding && !p?.unboarding; }
  /** The gun modes the traveller owns ('shoot' first); none without the gun (and the backpack it drinks from). */
  get modes() { return ownedModes((id) => this.items.has(id)); }
  /** The gun is found and is the gadget in hand (src/gadgets/: the flag gadget.equipped): only then do the triggers shoot. */
  get gunInHand() { return (!!this.forceGun || (this.items.has('gun') && this.state.flag('gadget.equipped') === 'gun')) && this.modes.length > 0; }   // (forceGun: a game on foot lends it in hand, src/minigames/kit/onfoot.js)
  /** The backpack's stage (0..3): how many of its strengths are owned (items.js BACKPACK_STAGES); the tank shows it. */
  stageNow() { return backpackStage((id) => this.items.has(id)); }
  get modeName() { return MODES[this.mode]?.name ?? 'fluid'; }
  /** Switch to an owned mode: the tank and the glove's plate retint, the HUD says so. Returns true if it changed. */
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
    if (this.state.flag('tool.empty')) this.state.set('tool.empty', false);   // the first water: an empty tank fills for good
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

  /** Can the arm come up right now? Not without the backpack (or with it in a vehicle), while gliding, climbing, flying on the jets (aiming in flight holds you: player.jetHold, and then it can), in menus and photo mode. */
  allowed(paused) {
    return this.bodyFree(paused) && this.worn;
  }
  /** The body is free for the arm (the blade needs no item: it is his from the start): not riding, gliding, climbing, on the jets, knocked down, in a menu. */
  bodyFree(paused) {
    const p = this.player;
    return !paused && this._enabled && !!p && !p.ride && !p.boarding && !p.unboarding && !p.gliding && !p.climbing && !p.mantle && !p.thrusting && !p.onJets && !p.down && p.object?.visible !== false;   // (nor knocked down)
  }

  /**
   * World position of the fluid's mouth: in front of the glove's knuckles (or, on a body without the
   * glove, a hand's length past the right wrist; the chest if there is no arm or no body to see).
   */
  muzzle(out = new THREE.Vector3()) {
    const p = this.player, G = this.glove, B = p.humanoid?.b;
    if (G?.muzzle && p.object?.visible !== false) { G.muzzle.updateWorldMatrix(true, false); return G.muzzle.getWorldPosition(out); }
    if (B?.hand_r && B.lowerarm_r && p.object?.visible !== false) {
      B.hand_r.updateWorldMatrix(true, false);
      const h = B.hand_r.getWorldPosition(out), e = B.lowerarm_r.getWorldPosition(_a);
      return h.addScaledVector(e.sub(h).normalize(), -0.1);
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
    (this.aimFrom ??= new THREE.Vector3()).copy(o);   // where the crosshair's ray starts (clear from here on)
    const shot = traceShot(this.physics, o, this.aimDir, FLUID.shoot.range + 4);
    this.aimPoint.copy(shot.point);
    this.aimKind = shot.kind;
    // locked on: the crosshair near the foe's chest takes it, if nothing stands between (LOCK_AIM)
    const lockAt = this.lockOn?.()?.position?.();
    if (lockAt && rayMiss(o, this.aimDir, lockAt) < LOCK_AIM.snap) {
      const to = _t2.subVectors(lockAt, o), d = to.length();
      if (d < FLUID.shoot.range + 4 && !(this.physics?.rayDistance?.(o, to.divideScalar(d), d) < d - 0.6)) { this.aimPoint.copy(lockAt); this.aimKind = 'target'; this.aimLocked = true; return shot; }
    }
    this.aimLocked = false;
    return shot;
  }

  /** Per frame, after the player and camera moved. ctl is the merged input (or {} in menus). */
  update(dt, ctl = {}, paused = false) {
    this.time += dt;
    const p = this.player, input = toolInput(paused ? {} : ctl);
    // the triggers and the mode button are the gun's only while it is the gadget in hand (src/gadgets/: else the
    // gadget in hand has them); the blade, the guard and the evade are always his
    if (!this.gunInHand) { input.aim = input.shoot = input.fire = input.quick = input.mode = false; }
    const ok = this.allowed(paused), bodyOk = this.bodyFree(paused);
    // a shot: a fresh press of the fire button while aiming (or the touch button's quick shot)
    const quickPress = input.quick && !this.held.quick;
    // (the push is a gun mode: fired as a shot, it throws its cone instead of a glob)
    const firePress = (input.shoot && !this.held.fire) || quickPress, pushPress = firePress && !!MODES[this.mode]?.cone, shootPress = firePress && !pushPress;   // (a cone mode: the push, the tether's pull)
    const modePress = input.mode && !this.held.mode;
    const bladePress = input.blade && !this.held.blade;
    this.held.blade = input.blade;
    this.held.fire = input.fire; this.held.quick = input.quick; this.held.mode = input.mode;
    // X / D-pad → / the touch button: the next owned gun mode, round again after the last (also while not aiming, and riding)
    if (!paused && this._enabled && this.owned && modePress) this.cycleMode(1);
    if (!this.modes.includes(this.mode)) this.mode = 'shoot';
    this.modeFlash = Math.max(0, this.modeFlash - dt / 1.6);
    if (ok && (shootPress || pushPress)) {
      if (this.reserve.charges <= 0 || (pushPress && this.dry)) this.sputter();   // (the dregs only shoot)
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
    // an empty tank stays empty (no clock, no refill) until magical water fills it
    // (the makers' dregs, tool.dregs: what was spent of them since the last frame is gone for good)
    if (this.dry) {
      const d = this.dregs;
      if (this._dregsAt === d && d > 0 && this.reserve.level < d - 1e-6) {
        const left = Math.floor(this.reserve.level + 1e-6);
        this.state.set('tool.dregs', left);
        this.state.emit('tool:dregs', { left });
      }
      this.reserve.level = this._dregsAt = this.dregs; this.reserve.since = 0;
    } else { this._dregsAt = null; if (this.reserve.update(dt)) this.onRefilled(false); }

    if (this.k > 0 && p) {
      this.updateAimPoint();
      p.aim = Object.assign(this._pose ??= {}, { k: this.k, point: this.aimPoint, dir: this.aimDir });
      if (this.cooldown === 0 && this.pending === 'shoot' && this.k > 0.8) { this.pending = null; this.shoot(); if (input.quick) this.quick = Math.max(this.quick, 0.5); }
      else if (this.cooldown === 0 && this.pending === 'push' && this.k > 0.45) { this.pending = null; this.push(); }
    } else if (p) p.aim = null;
    if (this.rig) this.rig.aimK = smooth(Math.min(this.k, this.camK));
    // the blade swings when the arm isn't up for a shot (it takes the aim pose for its arc)
    this.blade.update(dt, bladePress && this.k < 0.3, bodyOk && this.k < 0.5 && !this.player?.swim, input.guard, input.evade, !!input.blade && this.k < 0.3);   // (the guard: held; the blade button held: the charge)

    this.updateGlobs(dt);
    const up = p?.frame.up ?? _y;
    this.drops.update(dt, up); this.glow.update(dt, up);
    this.splats.update(dt); this.rings.update(dt);
    this.updateWorn(dt);
    const dry = this.dry;
    this.hud?.update({ on: this.k > 0.5 && this.camK > 0.3, charges: this.reserve.charges, max: this.reserve.max, refillIn: dry ? 0 : this.reserve.refillIn, ready: this.cooldown === 0 && this.reserve.charges > 0, aimKind: this.aimKind, hit: this.lastHit, tones: this.modeTones,
      owned: this.owned, mode: this.mode, modeName: dry ? 'empty' : this.modeName, modes: this.modes.length, modeFlash: this.modeFlash,
      level: this.reserve.level, jets: !!p?.thrusting && this.canJet, dry });
    this.lastHit = null;
  }

  // ------------------------------------------------------------ the jets (player.fuelSource)
  /** The jets own the item and the tank is on the back. */
  get canJet() { return this.worn && (this.items.has('jetpack') || (this.items.has('harness') && !!this.player?.opts?.harnessWorld)); }   // (the debug jets, or the Warden's harness in the City-Shaft)
  /** The gauge the jets burn, 0..1 of the tank. */
  jetLevel() { return this.reserve.level / this.reserve.max; }
  /** A frame of thrust: burns FLUID.jet.drain charges a second; false when there's nothing left to burn. */
  burnJet(dt) {
    if (!this.canJet || this.reserve.level <= FLUID.jet.min * 0.5) return false;
    if (!this.jetBurnt) { this.jetBurnt = true; this.state.emit('tool:fire', { mode: 'jet', point: this.player.pos.clone() }); }
    this.reserve.drain(FLUID.jet.drain * dt);
    return true;
  }

  /** While thrusting: fluid flames spit from the two nozzles, drops falling off them in the tank's tones. */
  updateJets(dt) {
    const J = this.jets, p = this.player;
    if (!J) return;
    const on = this.canJet && p.object?.visible !== false;
    J.update(dt, { on, thrusting: !!p.thrusting || !!p.jetHold, power: p.jetPower ?? 1, time: this.time });   // (the flames as long as the throttle: player.jetPower)
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
    chest.localToWorld(back.p.set(...this.tankAt)); chest.getWorldQuaternion(back.q); chest.getWorldScale(back.s).multiplyScalar(TANK.scale);
    if (where === 'back') {
      if (g.parent !== chest) chest.add(g);
      g.position.set(...this.tankAt); g.quaternion.identity(); g.scale.setScalar(TANK.scale);
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
    this.flash = 1; this.slosh = 1;
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

  /** The tank and glove follow the body; the fluid level eases to the charges left. */
  updateWorn(dt) {
    const p = this.player;
    // (fillTo: a scene holds the glass at its own level, the first fill rising slowly: src/story/desert.js)
    const target = this.fillTo ?? this.reserve.level / this.reserve.max;
    // drains quickly; refills with a rise and a little overshoot
    const rate = this.fillTo != null ? 12 : target > this.fill ? 4.2 : 9;
    this.fill += (target - this.fill) * (1 - Math.exp(-rate * dt));
    this.flash = Math.max(0, this.flash - dt * 3);
    this.wave = Math.max(0, this.wave - dt * 0.9);
    if (p?.vel && dt > 0) {
      // the fluid sloshes with the body's accelerations
      if (this._hasVel) this.slosh = Math.max(this.slosh * Math.exp(-2.2 * dt), Math.min(1, _a.subVectors(p.vel, this._lastVel).length() / dt / 70));
      this._lastVel.copy(p.vel); this._hasVel = true;
    }
    // the mode's look: its tones, and how the lava moves (stilling: nearly still; ember: boiling)
    const look = MODES[this.mode] ?? MODES.shoot;
    const quick = (this.stage ?? 0) >= 3 ? STAGE_RATE : 1;   // (the jets' stage: the fluid swirls faster)
    this.rate += (look.rate * quick - this.rate) * (1 - Math.exp(-4 * dt));
    this.fluidTime += dt * this.rate;
    const tones = this.modeTones, n = tones.length, key = tones.join();
    const retone = key !== this._tonesKey;
    this._tonesKey = key;
    // the flask's own fluid: green, or a gun mode's first tone (stilling's cold blue, ember's orange, bloom's leaf green)
    if (retone && this.tankU?.uFluidBase) this.tankU.uFluidBase.value.set(MODES[this.mode]?.tones?.[0] ?? TANK.base);
    for (const U of [this.tankU, this.globU, this.wingU]) {
      if (!U) continue;
      if (retone) U.uFluidTones.value.forEach((c, i) => c.set(tones[i] ?? FLUID_TONES[i]));
      U.uFluidA.value.x = this.fill; U.uFluidA.value.y = n; U.uFluidA.value.z = U === this.globU ? this.time * Math.max(this.rate, 0.4) : this.fluidTime;
      if (U === this.wingU) { U.uFluidB.value.x = this.flash; continue; }
      U.uFluidB.value.set(this.flash, this.wave, 0, this.slosh * Math.min(1, this.rate));
    }
    if (!this.tank) return;
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
    // the rucksack's outer pocket shows until the flask sits in its place (and again while the flask is in a vehicle)
    for (const o of p.humanoid?.packPocket ?? []) o.visible = !(owned && where === 'back');
    if (this._dockOwned !== owned) this.placeDock(owned);
    // the scout hops onto the cap while the wings are open, and back onto the rail when they fold
    const capK = THREE.MathUtils.clamp((this.scoutCapK ?? 0) + (owned && (p?.wingK ?? 0) > 0.02 ? 1 : -1) * dt / SCOUT_CAP.hop, 0, 1);
    if (capK !== (this.scoutCapK ?? 0)) { this.scoutCapK = capK; this.placeDock(owned); }
    // the glove is the fluid gun (src/gadgets/gun.js): worn once it is found, with the tank (it drinks from it);
    // the hand is bare without it (the sword's hilt is held bare-handed)
    const gloved = owned && this.items.has('gun');
    if (this.glove?.show) this.glove.show(gloved);
    else if (this.glove && this.glove.visible !== gloved) for (const o of this.glove.meshes) o.visible = gloved;
    if (this.glove) this.glove.visible = gloved;
    if (owned && this.appear < 1 && where === 'back') {
      const e = this.appear, sc = 0.25 + 0.75 * e + Math.sin(Math.PI * e) * 0.18;
      this.tank.group.scale.setScalar(sc * TANK.scale);
      this.flash = Math.max(this.flash, 1 - e);
      // the scout's dock rides the tank but not its growing in (small, it would sit inside the glass)
      const dock = p.gear?.scoutDock;
      if (dock?.parent === this.tank.group) { scoutDockPose(this.scoutCapK ?? 0, dock.position, dock.quaternion); dock.position.divideScalar(sc); this._dockScaled = true; }
    } else if (this._dockScaled) { this._dockScaled = false; this.placeDock(owned); }
    this.updateJets(dt);
    this.updateWings(dt);
    this.updatePower(dt);
    if (!visible) return;
    if (where !== 'back') return;
    // the backpack's glass glows with the bar (empty: dim; full: bright; the jets' stage brighter still), and the band's
    // three charge lights light for the whole units left, as the glove's knuckles do
    if (this.tankU?.uGlow) this.tankU.uGlow.value = THREE.MathUtils.lerp(TANK.glow[0], TANK.glow[1], THREE.MathUtils.clamp(this.fill, 0, 1)) + ((this.stage ?? 0) >= 3 ? STAGE_GLOW : 0);
    for (let i = 0; i < (this.tank.lights?.length ?? 0); i++) lightGlove(this.tank.lights[i], tones[i % tones.length], THREE.MathUtils.clamp(this.ringLit[i], 0, 1), 0.9);
    // the glove's knuckles light for the charges left (in sequence as it refills), its plate in the
    // mode's tone, brighter for a moment as it fires or changes mode, dim with the tank empty
    for (let i = 0; i < 3; i++) {
      const lit = this.reserve.charges > i ? 1 : 0;
      this.ringLit[i] += (lit - this.ringLit[i]) * (1 - Math.exp(-(lit ? 7 : 20) * dt));
      lightGlove(this.glove?.lights[i], tones[i % tones.length], THREE.MathUtils.clamp(this.ringLit[i], 0, 1), 0.95);
    }
    if (this.glove?.plate) lightGlove(this.glove.plate, tones[0], this.reserve.charges ? 1 : 0.3, 0.7 + 0.3 * Math.max(this.flash, this.mode !== 'shoot' ? 0.5 : 0));
    // the vial on the cuff: the tank's own fluid, so glove and tank read as one (no hose since October 2026);
    // its glow follows the level in the glass, a flash as it fires
    if (this.glove?.vial) lightGlove(this.glove.vial, tones[1 % n], 0.35 + 0.65 * THREE.MathUtils.clamp(this.fill, 0, 1), 0.75 + 0.25 * this.flash);
  }

  /** A press with the tank empty: a dribble from the nozzle and a dry click. */
  sputter() {
    this.lastHit = 'empty';
    if (this.dry) this.state.emit('tool:dry', {});   // (the story says why, once: src/story/desert.js)
    this.sound?.fluidEmpty?.();
    const from = this.muzzle(_m), up = this.player.frame.up;
    for (let i = 0; i < 4; i++) this.drops.add({ pos: from, vel: _a.copy(up).multiplyScalar(-0.5 - Math.random()).add(_t1.randomDirection().multiplyScalar(0.4)), grav: 9, size: 0.018, life: 0.45, color: this.modeTones[i % 2] });
  }

  /** The tones as hex strings, for targets (info.colours). */
  info(strength = 1) { return { colours: this.modeTones, strength, shove: FLUID.push.shove, tool: this }; }

  /** Fire a glob at the crosshair now (the arm is assumed to be up): straight from the nozzle to the crosshair's point. */
  shoot() {
    if (!this.reserve.use(MAGIC_COST.shoot)) { this.sputter(); return { kind: 'empty' }; }
    const from = this.muzzle(_m).clone();
    const dir = shotDir(from, this.aimPoint, this.aimDir, _f);
    if (this.aimFrom) clearLine(this.physics, from, dir, this.aimPoint, this.aimFrom, this.aimDir, this.aimKind);
    this.cooldown = FLUID.shoot.cooldown;
    const glob = new Glob(from, dir.clone().multiplyScalar(FLUID.shoot.speed));
    glob.mesh = this.globMeshes.find((m) => !m.visible) ?? this.globs.shift()?.mesh ?? this.globMeshes[0];
    glob.mesh.visible = true;
    glob.tone = Math.floor(Math.random() * 6);
    glob.mode = this.mode;               // 'shoot' | 'stun' | 'fire' | 'bloom': what it does where it lands
    this.globs.push(glob);
    this.used('shoot', from, { glob: glob.mode });
    this.sound?.fluidShoot?.(glob.mode);
    const tones = this.modeTones;
    for (let i = 0; i < 7; i++) this.drops.add({ pos: from, vel: _a.copy(dir).multiplyScalar(3 + i * 1.2).add(_t1.randomDirection().multiplyScalar(1.1)), drag: 6, grav: 6, size: 0.022, life: 0.35, color: tones[i % tones.length] });
    return { kind: 'glob', glob };
  }

  /**
   * A first spark (a scene shows what the tank does): one glob out of the nozzle along `dir`,
   * slower than a shot and spending nothing, with its spray, its sound and its splash where it
   * lands. Returns the glob (null without the tank on).
   */
  spark(dir, { speed = FLUID.shoot.speed * 0.55 } = {}) {
    if (!this.owned || !this.tank) return null;
    const from = this.muzzle(_m).clone(), d = _f.copy(dir).normalize();
    const glob = new Glob(from, d.clone().multiplyScalar(speed));
    glob.mesh = this.globMeshes.find((m) => !m.visible) ?? this.globMeshes[0];
    glob.mesh.visible = true;
    glob.tone = 0; glob.mode = 'shoot';
    this.globs.push(glob);
    this.flash = 1; this.slosh = 1;
    this.sound?.fluidShoot?.('shoot');
    const tones = this.modeTones;
    for (let i = 0; i < 9; i++) this.drops.add({ pos: from, vel: _a.copy(d).multiplyScalar(2.5 + i).add(_t1.randomDirection().multiplyScalar(1)), drag: 6, grav: 6, size: 0.024, life: 0.4, color: tones[i % tones.length] });
    this.rings.add({ from, dir: d, reach: 0.4, r0: 0.05, r1: 0.35, life: 0.3, color: tones[0], thick: 0.8 });
    return glob;
  }

  /** The push: a cone of fluid shock from the hand. Returns the targets it touched. */
  push() {
    if (this.dry || !this.reserve.use(MAGIC_COST.push)) { this.sputter(); return []; }   // (an empty tank's dregs don't push)
    // the tether (the City Floating in Space's mode): the same cone, pulling toward you: its targets get 'tether' and the way back to the hand
    const pull = !!MODES[this.mode]?.pull, cone = pull ? this.mode : 'push';
    const p = this.player, U = p.frame.up;
    const origin = _o.copy(p.pos).addScaledVector(U, 1.15);
    // along the aim, flattened toward the ground plane when it's a quick push
    const dir = _f.copy(this.aimDir);
    if (this.camK < 0.5) { dir.addScaledVector(U, -dir.dot(U) * 0.75); }
    if (dir.lengthSq() < 1e-6) p.frame.dir(p.heading, dir);
    dir.normalize();
    const hits = targetsInCone(origin, dir, FLUID.push.range, FLUID.push.angle, this.physics);
    for (const h of hits) hitTarget(h, cone, pull ? h.dir.clone().negate() : h.dir, this.info(1 - h.distance / FLUID.push.range));
    this.cooldown = FLUID.push.cooldown;
    this.used('push', origin);
    this.sound?.fluidPush?.();
    // recoil: a small step back (on the ground)
    if (p.vel && p.onGround) p.vel.addScaledVector(_a.copy(dir).addScaledVector(U, -dir.dot(U)), -FLUID.push.recoil * (pull ? -0.5 : 1));
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
   * The double jump's look (player.js calls it as the lift valve opens: player.onDoubleJump): a puff of fluid
   * down from the tank and under the boots, and a ring where it leaves. It costs nothing.
   */
  liftFx() {
    const p = this.player;
    if (!p || p.object?.visible === false) return;
    const U = p.frame.up;
    this.used('lift', p.pos);
    this.sound?.fluidBoost?.();
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

  /** Bookkeeping for every use: the tank's flash and slosh, the story event (globs: mode 'shoot', glob: the gun mode). */
  used(mode, point, extra = null) {
    this.flash = 1; this.slosh = 1;
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
    if (mode === 'cut') {
      // a blade's cut (src/fluid-blade.js HIT_FX): a few drops of the blade's fluid off the edge, a glint; no ring
      for (let i = 0; i < HIT_FX.cut; i++) {
        const v = _a.randomDirection().addScaledVector(normal, 1.2).normalize().multiplyScalar((2.5 + Math.random() * 4) * sc);
        this.drops.add({ pos: point, vel: v, drag: 2.4, grav: 9, size: (0.035 + Math.random() * 0.035) * sc, stretch: 2.5, life: 0.35 + Math.random() * 0.25, color: tones[i % tones.length] });
      }
      for (let i = 0; i < HIT_FX.cutGlow; i++) this.glow.add({ pos: point, vel: _a.randomDirection().multiplyScalar(0.8 * sc), drag: 3, size: 0.07 * sc, life: 0.3, color: tones[1 % tones.length], grow: true });
      return;
    }
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
    if (mode === 'bloom') {
      // petals: a puff of green and pink that drifts down slowly, a soft ring
      for (let i = 0; i < 24; i++) {
        const v = _a.randomDirection().addScaledVector(normal, 1.0).normalize().multiplyScalar((1.5 + Math.random() * 3.5) * sc);
        this.drops.add({ pos: point, vel: v, drag: 4.5, grav: 1.4, size: (0.04 + Math.random() * 0.04) * sc, stretch: 1.2, life: 0.9 + Math.random() * 0.8, color: tones[i % tones.length] });
      }
      for (let i = 0; i < 6; i++) this.glow.add({ pos: point, vel: _a.randomDirection().addScaledVector(normal, 0.6).multiplyScalar(0.8 * sc), drag: 3, size: 0.08 * sc, life: 0.7, color: tones[(i + 1) % tones.length], grow: true });
      this.rings.add({ from: point, dir: normal, reach: 0.05, r0: 0.15 * sc, r1: 1.2 * sc, life: 0.45, color: tones[0], thick: 0.7 });
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
            if (gm === 'fire') this.splats.add(e.point, e.normal, '#3a2622', gTones[1], 0.6, 2.4, g.dir);
            else if (gm === 'stun') this.splats.add(e.point, e.normal, gTones[0], '#f2fbff', 0.7, FLUID.shoot.splatLife + 1.5, g.dir);
            else if (gm === 'bloom') { this.splats.add(e.point, e.normal, gTones[0], gTones[1], 0.6, FLUID.shoot.splatLife, g.dir); this.state.emit('tool:bloom', { point: e.point.clone(), normal: e.normal.clone() }); }
            else this.splats.add(e.point, e.normal, gTones[g.tone % gTones.length], gTones[(g.tone + 1) % gTones.length], FLUID.shoot.splatSize, FLUID.shoot.splatLife, g.dir);
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

  /** One line for the HUD while aiming: the mode and the magic left, in units (no button list: the settings carry the controls). */
  hudText() {
    const n = Math.round(this.reserve.max), pips = '◆'.repeat(Math.min(n, this.reserve.charges)) + '◇'.repeat(Math.max(0, n - this.reserve.charges));
    if (this.dry) return `empty tank ${pips}`;
    const wait = this.reserve.level < this.reserve.max ? ` full in ${Math.ceil(this.reserve.refillIn)}s` : '';
    return `${this.modeName} ${pips}${wait}`;
  }
}

const _c = new THREE.Color();
