import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, markHero, MODE_RIBBON } from './materials.js';
import { DRONE_BELLY, DOCK_ON_TOP, DOCK_ON_SIDE } from './drone.js';
import { raycastTargets, hitTarget, registerTarget, targetsInCone } from './targets.js';
import { game as sharedGame } from './game-state.js';
import { items as sharedItems } from './items.js';
import { triggers } from './controller.js';
import { decalBasis, gatherTriangles, projectSplat, flatSplat, splatMaterial, drawnHit, DrawnSurfaces, SPLAT_REACH } from './splat-decal.js';
import { MODES, STUN_SECONDS, FluidWings, FluidJets, HANDOFF, handoffPose, nextMode, ownedModes } from './fluid-kit.js';

// The magic-fluid backpack: the traveller's signature tool. A glass tank of
// shifting, lava-lamp fluid rides on the back; a ribbed hose runs from its cap
// over the right shoulder and down the arm into the cuff of a glove on the right hand: the glove is
// what shoots, the fluid leaving from just in front of its knuckles. Three abilities share one reserve
// of three charges (docs/game-brief.md, working decision 4):
//   shoot  a glob of fluid, straight from the glove to the crosshair (no arc, no
//          preview): it splashes on whatever it meets and leaves a short-lived
//          colourful splat on surfaces (targets: onHit('shoot', point, dir, info)).
//          Only while aiming (LT / L2, right mouse, R): the trigger that shoots
//          then fires the jets when you are not aiming (controller.js triggers())
//   push   a short cone of fluid shock (~6 m) that knocks people, creatures
//          and loose things away (targets in the cone: onHit('push', point, dir, info))
//   boost  a powered jump: press jump again in the air for a strong burst up
//          (and a little forward) on a spray of fluid. Holding jump after it
//          still opens the wings once you fall (with the glider). With the
//          jets on the keyboard's Space, holding jump thrusts instead, and a quick
//          double tap boosts (a pad's jump never fires the jets: RT does, so any
//          second press in the air boosts).
// Two seconds after the last use, all three charges refill at once.
//
// Everything runs on the backpack (src/items.js): without items.has('backpack')
// the tank, hose and glove are not worn and nothing fires. The other items
// grow out of it (fluid-kit.js):
//   jetpack  two nozzles under the tank. Thrust burns the same reserve as a
//            smooth gauge (FLUID.jet.drain charges a second: a full tank is
//            ten seconds of flight); a shot needs a whole charge left. The
//            refill clock waits until you land after a burn, then the usual
//            two seconds refill everything.
//   glider   fluid wings bloom out of the tank while gliding (hold jump while falling)
//   stun / fire / bloom   gun modes (X, the pad's D-pad left / right, the touch ◐ button): the glob
//            stills (onHit 'stun'), burns ('fire') or grows ('bloom') instead of splashing; all
//            modes share the three charges (targets.js: who accepts which mode)
// Vehicles run on it too: boarding a powered vehicle swings the tank off the back into
// its socket (the player's boarding / unboarding timers, HANDOFF), and back on when you
// step off. While it is in a socket the tool is unavailable.
// The tank shows the fill as three stacked bands of colour; the glove's three
// knuckles light for the charges left, the plate on its back in the mode's tone. Magical water (the desert's
// cave) refills it and adds a colour band for good: tool.refill({ addColour: true }).
// An empty tank (game flag tool.empty: the desert's backpack comes out of its box dry,
// src/story/desert.js) holds nothing and never refills by itself: no charges, nothing
// fires, a press only sputters (and says so once: 'tool:dry'). The first magical water
// (any refill()) fills it and clears the flag for good.
//
// Story API (main.js builds one FluidTool, window.tool; story code needs no
// import and can use the game-state bus instead, see game-state.js):
//   tool.charges          0..3
//   tool.colours          colour bands added to the fluid (game flag tool.colours, 1 at the start)
//   tool.tones            the tones in the blend, hex strings
//   tool.enabled          false: put away, nothing fires (the ship prologue, cutscenes)
//   tool.owned            the backpack is found (items.has('backpack'))
//   tool.dry              the tank is empty (flag tool.empty): nothing until magical water fills it
//   tool.mode / tool.modes / tool.setMode(id) / tool.cycleMode(±1)   'shoot' | 'stun' | 'fire' | 'bloom'
//   tool.refill({ addColour, tone })   fill now; addColour adds a band (tone: its colour, optional)
//   game.emit('tool:refill', { addColour: true }) · game.emit('tool:enable', { on: false })
//   emits 'tool:fire' { mode, point } (mode: shoot / stun / fire / push / boost / jet start),
//   'tool:refilled' { charges, colours, added }, 'tool:mode' { mode }, 'tool:dock' { vehicle, on },
//   'tool:bloom' { point, normal } (a bloom glob landed on the world: src/boxes/effects.js grows a few flowers there)

/** Every tuning value in one place. */
export const FLUID = {
  charges: 3,             // one reserve shared by shoot, boost and push
  refillDelay: 2,         // s after the last use (after landing, for the jets), all three come back at once
  maxColours: 5,          // colour bands magical water can add (the blend shows colours + 1 tones)
  shoot: { speed: 34, gravity: 0, range: 42, cooldown: 0.28, splatLife: 5, splatSize: 0.75 },   // gravity 0: a straight shot
  push: { range: 6, angle: 0.62, cooldown: 0.4, shove: 2.4, recoil: 2.2 },    // angle: cone half-angle (rad, ~35°); shove: metres people are knocked back (info.shove)
  boost: { up: 15, forward: 4, keep: 0.35, doubleTap: 0.35 },              // keep: share of a rising jump's speed kept
  jet: { drain: 0.3, min: 0.02 },  // charges burnt per second of thrust (3 = 10 s); min: the gauge that still lights them
};

// The fluid's tones, in the order bands are added (written into the shader's uFluidTones).
// A world's source can bring its own tone instead: refill({ addColour: true, tone: '#e9a53c' }).
export const FLUID_TONES = ['#52c8cf', '#966ede', '#ef7e62', '#f6c84e', '#ed80b0', '#83cf71'];
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
    push: !!(c.KeyC || c.MouseMiddle || c.PadPush),
    mode: !!(c.KeyX || c.PadModeNext),     // the next owned gun mode
    modeBack: !!c.PadModePrev,             // the previous one (D-pad left)
  };
}

/** Mouse: hold the right button to aim, the left button shoots while aiming (with the pointer captured and not aiming: the jets), the middle button pushes. */
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

const INK = '#263c37', BRASS = '#acaa78', BRASS_DARK = '#6c806b', STEEL = '#83b9ae', STEEL_DARK = '#3d6b60', RUBBER = '#303f3d';
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

/** Instanced dots and dashes: droplets, sprays, the glob's wake. */
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
// 0.74 at the collar, +z forward, the character's right at -x). A slim, flat
// glass flask: it sits in the outer face of the traveller's canvas rucksack
// (traveller.js), held by two leather bands and two leather-bound side staves,
// its neck and valve out over the rucksack's lid.
export const TANK = {
  at: [0, 0.28, -0.283],    // glass bottom, half sunk into the rucksack's outer face
  scale: 0.8,              // a compact shoulder-to-waist flask on the adult body
  height: 0.52,             // glass
  full: 0.5,                // fluid height at three charges (a sliver of air on top)
  squash: 0.85,             // across the back (x), of the round profile (the canvas shows either side)
  depth: 0.55,              // front to back (z): a flat flask, not a drum
  straps: [0.012, 0.49],    // the leather bands round the glass: on the brass foot and at its brim, so the three bands show whole
  profile: [[0.12, 0], [0.153, 0.05], [0.167, 0.14], [0.162, 0.26], [0.147, 0.38], [0.121, 0.47], [0.098, 0.52]],
  outlet: [-0.1, 0.6, 0.02],      // where the hose leaves: the cap's fitting, on the wearer's right
  highlight: -1.05,         // streak angle (atan2(z, x) in tank space): on the back, to one side
  inked: true,              // blobs inked at full strength (not the player's softer interior lines)
};
const profileCurve = new THREE.SplineCurve(TANK.profile.map(([r, y]) => new THREE.Vector2(r, y)));
function radiusAt(y) {
  // the profile is monotonic in y: a few bisection steps are plenty
  let lo = 0, hi = 1;
  for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (profileCurve.getPoint(m).y < y) lo = m; else hi = m; }
  return profileCurve.getPoint((lo + hi) / 2).x;
}
/** The glass's radius at height y (tank frame, before the flattening: x × TANK.squash, z × TANK.depth). */
export const tankRadiusAt = radiusAt;
/**
 * The scout's dock on the tank, in the tank's frame (it rides with the tank, into a vehicle's
 * socket too): clamped by its foot to the top of the flask's left upright (the wearer's left),
 * beside the neck and above the shoulder, over the upright's top bracket (the lantern hangs from
 * the upright below), off the glass. (The rucksack is slim: lower down the swinging arms would
 * reach it.)
 */
export const TANK_RAIL = { x: TANK.profile.reduce((m, [r]) => Math.max(m, r), 0) * TANK.squash + 0.018, r: 0.012, z: -0.03, top: TANK.height * 1.24, brackets: [0.04, TANK.height - 0.07] };
export const SCOUT_DOCK_Y = TANK.height * 1.2;
export const SCOUT_DOCK_X = TANK_RAIL.x + TANK_RAIL.r + DRONE_BELLY / TANK.scale + 0.002;
export const SCOUT_DOCK_Z = TANK_RAIL.z;
/**
 * While the fluid wings are open (gliding) their roots and lobes fill the tank's sides, so the
 * scout hops up onto the cap, between them (its foot over the valve's bead), and back down to the
 * rail when they fold: scoutDockPose(k) is that hop (k 0 on the rail .. 1 on the cap), along an
 * arc that stays clear of the glass, turning from side-on to upright.
 */
export const SCOUT_CAP = { y: TANK.height + 0.12 + DRONE_BELLY / TANK.scale, hop: 0.2 };
const _dockArc = [new THREE.Vector3(SCOUT_DOCK_X, SCOUT_DOCK_Y, SCOUT_DOCK_Z), new THREE.Vector3(SCOUT_DOCK_X + 0.03, TANK.height + 0.5, SCOUT_DOCK_Z), new THREE.Vector3(0, SCOUT_CAP.y, 0)];
export function scoutDockPose(k, pos, quat) {
  const t = THREE.MathUtils.smoothstep(k, 0, 1), [a, b, c] = _dockArc;
  pos.set(0, 0, 0).addScaledVector(a, (1 - t) ** 2).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(c, t * t);
  quat.copy(DOCK_ON_SIDE).slerp(DOCK_ON_TOP, t);
  return pos;
}

const LEATHER = '#5e4b37';
function buildTank() {
  const g = new THREE.Group();
  g.name = 'Fluid tank';
  // (sq: the part takes the flask's flattening, across and front to back)
  const add = (geo, m, x = 0, y = 0, z = 0, sq = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if (sq) { o.scale.x = TANK.squash; o.scale.z = TANK.depth; } g.add(o); return o; };
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
  // hoops mark the three charge bands (the level reads against them from behind)
  for (const k of [1, 2]) {
    const y = (TANK.full * k) / 3;
    add(new THREE.TorusGeometry(radiusAt(y) + 0.006, 0.01, 5, 30).rotateX(Math.PI / 2), flatMat(INK), 0, y, 0);
  }
  // two worn leather bands round the glass, below the fluid and at its brim (clear of the hoops and the bands between)
  for (const y of TANK.straps) add(new THREE.TorusGeometry(radiusAt(y) + 0.012, 0.014, 4, 30).rotateX(Math.PI / 2).scale(1, 1.2, 1), flatMat(LEATHER), 0, y, 0);
  // the leather-bound side staves the bands hang from, bracketed into the rucksack (no back plate:
  // the rucksack is the flask's back)
  const railX = TANK_RAIL.x;
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(TANK_RAIL.r, TANK_RAIL.r, TANK_RAIL.top + 0.035, 6), flatMat(LEATHER), sx * railX, (TANK_RAIL.top - 0.035) / 2, TANK_RAIL.z, false);
    for (const y of TANK_RAIL.brackets) add(new THREE.BoxGeometry(0.03, 0.026, 0.15), flatMat(LEATHER), sx * railX, y, TANK_RAIL.z + 0.07, false);
    add(new THREE.SphereGeometry(0.018, 8, 6), flatMat(BRASS), sx * railX, TANK_RAIL.top, TANK_RAIL.z, false);   // a brass knob on the upright's top
  }
  // the hose's fitting on the cap, leaning toward the right shoulder
  const [ox, oy, oz] = TANK.outlet;
  add(new THREE.CylinderGeometry(0.022, 0.026, 0.07, 10), flatMat(BRASS), ox + 0.02, oy - 0.03, oz, false).rotation.z = 0.55;
  add(new THREE.TorusGeometry(0.026, 0.008, 4, 12).rotateX(Math.PI / 2), flatMat(INK), ox + 0.008, oy - 0.012, oz, false).rotation.z = 0.55;
  mergeParts(g, [glass]);
  g.position.set(...TANK.at); g.scale.setScalar(TANK.scale);
  return { group: noCollide(g), glass, outlet: new THREE.Vector3(ox, oy, oz), top: TANK.at[1] + (TANK.height + 0.11) * TANK.scale };
}

/**
 * The glove the fluid comes out of: the traveller wears it on his right hand (traveller.js
 * fluidGlove: meshes skinned to the hand, hidden until the tank is worn, a plate and three charge
 * lights; Humanoid.glove: their meshes and two anchors, the fluid's mouth in front of the knuckles
 * and the hose's end on the cuff). A body without one (an NPC's, the tests' bare rig) still shoots
 * from its right hand: the mouth a hand's length past the wrist, the hose to the wrist.
 */
function gloveOf(H) {
  const G = H?.glove;
  return { meshes: G?.meshes ?? [], plate: G?.plate ?? null, lights: G?.lights ?? [], muzzle: G?.muzzle ?? null, inlet: G?.inlet ?? null, show: G?.show ?? null, visible: false };
}
/** A lit part of the glove: its colour (from ink to `tone` by `k`) and glow. (Read off the mesh each time: markHero swaps its material.) */
function lightGlove(mesh, tone, k, glow) {
  const u = mesh?.material?.uniforms;
  if (!u) return;
  u.uColor.value.set(INK).lerp(_c.set(tone), k);
  u.uGlow.value = glow * k;
}

/** The hose: a ribbed tube re-laid every frame along a Catmull-Rom curve through the tank, the arm and the glove's cuff. */
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
    this.held = { fire: false, quick: false, push: false, mode: false, modeBack: false };
    this.mode = 'shoot'; this.modeFlash = 0; this.fluidTime = 0; this.rate = 1;
    this.appear = items.has('backpack') ? 1 : 0; this.jetBurnt = false; this.where = 'back'; this.power = new Map();
    this.aimPoint = new THREE.Vector3(); this.aimDir = new THREE.Vector3(0, 0, -1);
    this.globs = [];
    this.fill = items.has('backpack') && state.flag('tool.empty') ? 0 : 1; this.flash = 0; this.wave = 0; this.slosh = 0; this.pulse = 2; this.lastHit = null; this.ringLit = [1, 1, 1];
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
      if (!owned && !this.modes.includes(this.mode)) this.mode = 'shoot';
    }));
    // boost: the player asks on a fresh press of jump in the air (player.js); the jets
    // burn the reserve (fuelSource) and boarding a vehicle swings the tank into it (handoff)
    if (player) { player.onAirJump = (since, o) => this.boost(since, o); player.fuelSource = this; player.handoff = this; }
  }

  /** Put the tank, hose and glove on the traveller (needs the humanoid's chest anchor and arm bones). */
  wear() {
    const p = this.player, H = p?.humanoid;
    if (!H?.chestAnchor) return;
    // (the traveller keeps his canvas rucksack, the flask sits in its outer face: traveller.js, updateWorn())
    if (!H.outfit) for (const o of (p.gear?.packDockParent ?? p.gear?.scoutDock?.parent)?.children ?? []) if (o.isMesh) o.visible = false;   // the procedural pack
    const tank = (this.tank = buildTank());
    H.chestAnchor.add(tank.group);
    // the scout clings to the tank's left side (the cap would hide the helmet), folded, its foot on the glass
    this.placeDock(this.owned);
    this.glove = gloveOf(H);
    this.hose = new Hose(this.scene ?? tank.group);
    const copies = new Map(), glassMat = tank.glass.material;
    markHero(tank.group, copies);
    // the fluid stays out of the player's soft-ink mask, so the post pass inks its blobs like print
    if (TANK.inked) tank.glass.material = glassMat;
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
    this.fx.removeFromParent(); this.tank?.group.removeFromParent(); this.hose?.mesh.removeFromParent();
    if (this.glove?.show) this.glove.show(false); else for (const o of this.glove?.meshes ?? []) o.visible = false;
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
  /** The tank is empty (the desert's backpack, until the giant's pool fills it): no charges, no refill. */
  get dry() { return this.owned && !!this.state.flag('tool.empty'); }
  /** The tank is on the traveller's back (not in a vehicle's socket, nor swinging between). */
  get worn() { const p = this.player; return this.owned && !p?.ride && !p?.boarding && !p?.unboarding; }
  /** The gun modes the traveller owns ('shoot' first); none without the backpack. */
  get modes() { return ownedModes((id) => this.items.has(id)); }
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

  /** Can the arm come up right now? Not without the backpack (or with it in a vehicle), while gliding, climbing, on the jets, in menus and photo mode. */
  allowed(paused) {
    const p = this.player;
    return !paused && this._enabled && !!p && this.worn && !p.gliding && !p.climbing && !p.mantle && !p.thrusting && !p.down && p.object?.visible !== false;   // (nor knocked down)
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
    return shot;
  }

  /** Per frame, after the player and camera moved. ctl is the merged input (or {} in menus). */
  update(dt, ctl = {}, paused = false) {
    this.time += dt;
    const p = this.player, input = toolInput(paused ? {} : ctl);
    const ok = this.allowed(paused);
    // a shot: a fresh press of the fire button while aiming (or the touch button's quick shot)
    const quickPress = input.quick && !this.held.quick;
    const shootPress = (input.shoot && !this.held.fire) || quickPress, pushPress = input.push && !this.held.push;
    const modePress = input.mode && !this.held.mode, modeBackPress = input.modeBack && !this.held.modeBack;
    this.held.fire = input.fire; this.held.quick = input.quick; this.held.push = input.push; this.held.mode = input.mode; this.held.modeBack = input.modeBack;
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
    // an empty tank stays empty (no clock, no refill) until magical water fills it
    if (this.dry) { this.reserve.level = 0; this.reserve.since = 0; }
    else if (this.reserve.update(dt)) this.onRefilled(false);

    if (this.k > 0 && p) {
      this.updateAimPoint();
      p.aim = Object.assign(this._pose ??= {}, { k: this.k, point: this.aimPoint, dir: this.aimDir });
      if (this.cooldown === 0 && this.pending === 'shoot' && this.k > 0.8) { this.pending = null; this.shoot(); if (input.quick) this.quick = Math.max(this.quick, 0.5); }
      else if (this.cooldown === 0 && this.pending === 'push' && this.k > 0.45) { this.pending = null; this.push(); }
    } else if (p) p.aim = null;
    if (this.rig) this.rig.aimK = smooth(Math.min(this.k, this.camK));

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
    chest.localToWorld(back.p.set(...TANK.at)); chest.getWorldQuaternion(back.q); chest.getWorldScale(back.s).multiplyScalar(TANK.scale);
    if (where === 'back') {
      if (g.parent !== chest) chest.add(g);
      g.position.set(...TANK.at); g.quaternion.identity(); g.scale.setScalar(TANK.scale);
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

  /** The tank, hose and glove follow the body; the fluid level eases to the charges left. */
  updateWorn(dt) {
    const p = this.player;
    // (fillTo: a scene holds the glass at its own level, the first fill rising slowly: src/story/desert.js)
    const target = this.fillTo ?? this.reserve.level / this.reserve.max;
    // drains quickly; refills with a rise and a little overshoot
    const rate = this.fillTo != null ? 12 : target > this.fill ? 4.2 : 9;
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
    // the glove is worn with the tank (it is what shoots); the hand is bare without it
    if (this.glove?.show) this.glove.show(owned);
    else if (this.glove && this.glove.visible !== owned) for (const o of this.glove.meshes) o.visible = owned;
    if (this.glove) this.glove.visible = owned;
    this.hose.mesh.visible = visible && where !== 'flight';
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
    if (where === 'socket') return this.layHoseToPort();
    if (where === 'flight') return;
    // the glove's knuckles light for the charges left (in sequence as it refills), its plate in the
    // mode's tone, brighter for a moment as it fires or changes mode, dim with the tank empty
    for (let i = 0; i < 3; i++) {
      const lit = this.reserve.charges > i ? 1 : 0;
      this.ringLit[i] += (lit - this.ringLit[i]) * (1 - Math.exp(-(lit ? 7 : 20) * dt));
      lightGlove(this.glove?.lights[i], tones[i % tones.length], THREE.MathUtils.clamp(this.ringLit[i], 0, 1), 0.95);
    }
    if (this.glove?.plate) lightGlove(this.glove.plate, tones[0], this.reserve.charges ? 1 : 0.3, 0.7 + 0.3 * Math.max(this.flash, this.mode !== 'shoot' ? 0.5 : 0));
    // the hose: up out of the cap, over the right shoulder, down the outside of the arm into the glove's cuff
    const H = p.humanoid, B = H.b;
    const P = this.hosePts;
    const tg = this.tank.group;
    tg.updateWorldMatrix(true, false);
    tg.localToWorld(P[0].copy(this.tank.outlet));
    _q.setFromRotationMatrix(tg.matrixWorld);
    const Uc = _o.set(0, 1, 0).applyQuaternion(_q), Rc = _f.set(-1, 0, 0).applyQuaternion(_q), Bk = _m.set(0, 0, -1).applyQuaternion(_q);
    const S = B.upperarm_r.getWorldPosition(_t1), E = B.lowerarm_r.getWorldPosition(_t2);
    if (this.glove?.inlet) { this.glove.inlet.updateWorldMatrix(true, false); this.glove.inlet.getWorldPosition(P[5]); }
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
    if (this.dry) this.state.emit('tool:dry', {});   // (the story says why, once: src/story/desert.js)
    this.sound?.fluidEmpty?.();
    const from = this.muzzle(_m), up = this.player.frame.up;
    for (let i = 0; i < 4; i++) this.drops.add({ pos: from, vel: _a.copy(up).multiplyScalar(-0.5 - Math.random()).add(_t1.randomDirection().multiplyScalar(0.4)), grav: 9, size: 0.018, life: 0.45, color: this.modeTones[i % 2] });
  }

  /** The tones as hex strings, for targets (info.colours). */
  info(strength = 1) { return { colours: this.modeTones, strength, shove: FLUID.push.shove, tool: this }; }

  /** Fire a glob at the crosshair now (the arm is assumed to be up): straight from the nozzle to the crosshair's point. */
  shoot() {
    if (!this.reserve.use()) { this.sputter(); return { kind: 'empty' }; }
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
    this.pulse = 0; this.flash = 1; this.slosh = 1;
    this.sound?.fluidShoot?.('shoot');
    const tones = this.modeTones;
    for (let i = 0; i < 9; i++) this.drops.add({ pos: from, vel: _a.copy(d).multiplyScalar(2.5 + i).add(_t1.randomDirection().multiplyScalar(1)), drag: 6, grav: 6, size: 0.024, life: 0.4, color: tones[i % tones.length] });
    this.rings.add({ from, dir: d, reach: 0.4, r0: 0.05, r1: 0.35, life: 0.3, color: tones[0], thick: 0.8 });
    return glob;
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
   * did (the player then skips its glide for this press). With the jets on
   * the same key (the keyboard's Space, touch's jump: o.jets) only a quick
   * double tap boosts, so holding jump still thrusts; a pad's jump never fires
   * the jets (RT does), so there any press in the air boosts.
   */
  boost(since = Infinity, { jets = true } = {}) {
    const p = this.player;
    if (!p || !this._enabled || !this.worn || p.climbing || p.mantle || p.object?.visible === false) return false;
    if (this.canJet && jets && since > FLUID.boost.doubleTap) return false;
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

  /** One line for the HUD while aiming: the mode and the charges (no button list: the settings carry the controls). */
  hudText() {
    const pips = '◆'.repeat(this.reserve.charges) + '◇'.repeat(this.reserve.max - this.reserve.charges);
    if (this.dry) return `empty tank ${pips}`;
    const wait = this.reserve.level < this.reserve.max ? ` refill ${Math.ceil(this.reserve.refillIn)}s` : '';
    return `${this.modeName} ${pips}${wait}`;
  }
}

const _c = new THREE.Color();
