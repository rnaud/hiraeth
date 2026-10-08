import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { raycastTargets, targetsInCone } from '../targets.js';
import { rayWorld } from '../fluid-tool.js';
import { thinPole } from '../thin.js';
import { hitStop, kick } from '../feel.js';

// What every gadget may use (docs/systems/gadgets.md): the camera's aim, an inked line, a throw's arc, a
// blast that reaches everything round it (foes, the yard's loose things and cracked walls, the fluid tool's
// targets, the traveller), and an ink burst to show it. The pure parts (aim maths, arcs, falloff) are tested
// in node (tests/gadgets.test.js); the rest wants the runtime's ctx (src/gadgets/index.js).

export const INK = '#2b211f';
export const PAPER = '#f3e7cc';
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);

/** An inked flat material (makeMaterial: the post pass draws its lines). */
export const inkMat = (color, o = {}) => makeMaterial({ color, flat: true, ...o });

/**
 * The aim: the camera's ray, started just past the traveller (what lies between the lens and his back is
 * not aimed at). Returns { origin, dir } (new vectors unless `out` is given).
 */
export function aimRay(camera, player, out = { origin: new THREE.Vector3(), dir: new THREE.Vector3() }) {
  camera.getWorldDirection(out.dir);
  out.origin.copy(camera.position);
  if (player) {
    const chest = _v.copy(player.pos).addScaledVector(player.frame?.up ?? _Y, 1.4);
    const skip = Math.max(0, _w.subVectors(chest, out.origin).dot(out.dir) - 0.5);
    out.origin.addScaledVector(out.dir, skip);
  }
  return out;
}

/**
 * The nearest of a list of points (anchors) that a ray passes close to, within `range` along it: the aim
 * assist that lets a hook find a ring without pixel-perfect aim. Close means inside `cone` radians of the
 * ray (or within `near` metres of it, for one right in front). Returns { item, along } or null.
 */
export function assistPick(origin, dir, items, { range = 25, cone = 0.07, near = 0.6, pos = (i) => i.pos } = {}) {
  let best = null;
  for (const it of items) {
    const p = pos(it);
    if (!p) continue;
    const along = _v.subVectors(p, origin).dot(dir);
    if (along <= 0.3 || along > range) continue;
    const off = Math.sqrt(Math.max(0, _v.lengthSq() - along * along));
    if (off > Math.max(near, along * Math.tan(cone))) continue;
    const score = off / along;
    if (!best || score < best.score) best = { item: it, along, score };
  }
  return best && { item: best.item, along: best.along };
}

/**
 * What the aim meets within `range`: a registered target (foes, the yard's loose things), an anchor
 * (assisted), or the world (meshes and the heightfield). { kind: 'target' | 'anchor' | 'world' | 'none',
 * point, normal, distance, target?, anchor? }.
 */
export function traceAim(physics, origin, dir, range, { anchors = [], assist = true } = {}) {
  const t = raycastTargets(origin, dir, range);
  const w = rayWorld(physics, origin, dir, range + 0.5);
  const wd = w ? w.distance : Infinity;
  const a = assist && anchors.length ? assistPick(origin, dir, anchors.filter((x) => x.enabled?.() ?? true), { range }) : null;
  // an anchor wins when nothing solid stands between: the line to it is clear
  if (a) {
    const to = _u.subVectors(a.item.pos, origin), d = to.length();
    const clear = rayWorld(physics, origin, to.divideScalar(d), d - 0.35);
    if (!clear && (!t || t.distance > d - 0.5)) return { kind: 'anchor', anchor: a.item, point: a.item.pos.clone(), normal: (a.item.normal ?? _Y).clone(), distance: d };
  }
  if (t && t.distance <= wd) return { kind: 'target', target: t.target, point: t.point.clone(), normal: dir.clone().negate(), distance: t.distance };
  if (w && w.distance <= range) return { kind: 'world', point: w.point.clone(), normal: w.normal.clone(), distance: w.distance };
  return { kind: 'none', point: origin.clone().addScaledVector(dir, range), normal: dir.clone().negate(), distance: range };
}

// ------------------------------------------------------------------ throws

/** A throw's starting velocity: along the aim, tipped up by `lift` radians (gravity along -up), at `speed`. */
export function throwVelocity(aimDir, up, speed, lift = 0.32, out = new THREE.Vector3()) {
  const flat = _v.copy(aimDir).addScaledVector(up, -aimDir.dot(up));
  const fl = flat.length();
  const pitch = Math.asin(THREE.MathUtils.clamp(aimDir.dot(up), -1, 1));
  const a = THREE.MathUtils.clamp(pitch + lift, -1.2, 1.35);
  if (fl < 1e-4) return out.copy(up).multiplyScalar(speed * Math.sign(aimDir.dot(up) || 1));
  flat.divideScalar(fl);
  return out.copy(flat).multiplyScalar(Math.cos(a) * speed).addScaledVector(up, Math.sin(a) * speed);
}

/**
 * The points of a ballistic arc from `from` with velocity `vel` under `gravity` m/s² along -up, every `step`
 * seconds, `n` of them; `hit(a, b)` (optional) → a point where the segment a→b meets something: the arc stops
 * there. Returns { points, end, landed }.
 */
export function arcPoints(from, vel, up, gravity, { step = 0.05, n = 40, hit = null } = {}) {
  const points = [from.clone()];
  const p = from.clone(), v = vel.clone();
  for (let i = 0; i < n; i++) {
    const q = p.clone().addScaledVector(v, step).addScaledVector(up, -0.5 * gravity * step * step);
    v.addScaledVector(up, -gravity * step);
    const h = hit?.(p, q);
    if (h) { points.push(h.clone()); return { points, end: h.clone(), landed: true }; }
    points.push(q.clone()); p.copy(q);
  }
  return { points, end: p, landed: false };
}

/** A bounce off a surface: the normal part reversed and scaled by `restitution`, the rest kept by `friction`. */
export function bounce(vel, normal, restitution = 0.42, friction = 0.72) {
  const vn = vel.dot(normal);
  if (vn >= 0) return vel;
  const tangent = _v.copy(vel).addScaledVector(normal, -vn).multiplyScalar(friction);
  return vel.copy(tangent).addScaledVector(normal, -vn * restitution);
}

// ------------------------------------------------------------------ blasts

/** How hard a blast of radius r is felt at distance d: 1 at the centre, easing to 0 at the edge (smooth, no step). */
export function blastFalloff(d, r) {
  if (!(r > 0) || d >= r) return 0;
  const x = Math.max(0, d) / r;
  return (1 - x * x) * (1 - x * x);
}

/** The blade-equivalent damage a blast deals at falloff k (foes.js Foe.hit 'blade'): 2 close in, never under 1 if felt at all. */
export const blastDamage = (k, max = 2) => (k <= 0 ? 0 : Math.max(1, Math.round(max * k)));

/**
 * A blast at `center`: every foe, loose thing, cracked wall and target within `radius` feels it (by
 * blastFalloff), the traveller is thrown (never hurt: a bomb is for the world), and the frame catches.
 * Returns { foes, things, broken } counts.
 */
export function blast(ctx, center, { radius = 4.5, power = 11, damage = 2, lift = 0.45, source = 'bomb' } = {}) {
  const out = { foes: 0, things: 0, broken: 0 };
  const up = ctx.player?.frame?.up ?? _Y;
  // the world's targets: foes take a heavy cut and are thrown; anything else is pushed away from the centre
  for (const r of targetsInCone(center, _Y, radius, Math.PI, ctx.physics)) {
    const T = r.target, d = center.distanceTo(T.position()), k = blastFalloff(Math.max(0, d - (T.radius ?? 0) * 0.5), radius);
    if (k <= 0) continue;
    const dir = r.dir.clone().addScaledVector(up, -r.dir.dot(up)).normalize();
    if (T.kind === 'foe') {
      T.onHit?.('blade', r.point, dir, { damage: blastDamage(k, damage), combo: 2, source });
      const f = T.foe;
      if (f?.alive) f.vel.copy(dir).multiplyScalar((f.kind === 'machine' ? 4 : 10) * k);
      out.foes++;
    } else if (T.kind === 'prop') {
      T.prop.impulse(_v.copy(dir).multiplyScalar(power * k).addScaledVector(up, power * lift * k));
      out.things++;
    } else if (T.onHit?.('push', r.point, dir, { strength: k, shove: 3.2 * k, source, mode: source })) out.things++;
  }
  out.broken = ctx.world?.breakAt?.(center, radius) ?? 0;
  // the traveller: thrown, not hurt
  const P = ctx.player;
  if (P && !P.ride && !P.dead) {
    const d = _v.subVectors(P.pos, center).addScaledVector(up, 0).length(), k = blastFalloff(d, radius * 0.85);
    if (k > 0.02) {
      const away = _v.subVectors(P.pos, center); away.addScaledVector(up, -away.dot(up));
      if (away.lengthSq() < 1e-4) away.copy(P.frame?.dir?.(P.heading, _w) ?? _w.set(0, 0, 1)).negate();
      away.normalize();
      if (P.climbing) P.stopClimb?.(false);
      P.vel.addScaledVector(away, 11 * k).addScaledVector(up, 8 * k);
      P.onGround = false; P._carry = true;   // (thrown: the air doesn't steer it away, player.js)
    }
  }
  const near = P ? P.pos.distanceTo(center) : 99;
  hitStop(near < radius * 2 ? 0.07 : 0.03);
  kick(THREE.MathUtils.clamp(1.1 - near / 18, 0.15, 0.9));
  return out;
}

// ------------------------------------------------------------------ the ink line

/**
 * A line of ink from a to b (the hook's rope): a unit cylinder up y stretched between the points each set(),
 * kept at least `px` pixels wide however far (src/thin.js), so it reads as a pen line at any distance.
 */
export class InkLine {
  constructor(parent, { color = INK, radius = 0.018, px = 1.6 } = {}) {
    const g = thinPole(new THREE.CylinderGeometry(radius, radius, 1, 5, 1, true).translate(0, 0.5, 0));
    this.mesh = new THREE.Mesh(g, makeMaterial({ color, flat: true, thin: px }));
    this.mesh.userData.noCollide = true; this.mesh.frustumCulled = false; this.mesh.visible = false;
    parent.add(this.mesh);
  }
  set(a, b) {
    const d = _v.subVectors(b, a), L = d.length();
    if (L < 1e-3) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    this.mesh.position.copy(a);
    this.mesh.quaternion.setFromUnitVectors(_Y, d.divideScalar(L));
    this.mesh.scale.set(1, L, 1);
  }
  hide() { this.mesh.visible = false; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); }
}

// ------------------------------------------------------------------ the ink burst (a blast's look)

/** A star of ink, n points, for the splash on the ground (in the xz plane, radius 1). */
export function splashShape(n = 11, seed = 1) {
  const s = new THREE.Shape();
  let r = seed;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2, rad = i % 2 === 0 ? 0.75 + rand() * 0.35 : 0.38 + rand() * 0.12;
    if (i === 0) s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  return s;
}

/**
 * The look of a blast, Moebius-fashion: a clean cream cloud that swells and goes, a star of ink splashed on
 * the ground, a ring of speed strokes thrown out, and drops of ink (the fluid tool's droplets). A few kept
 * and reused; nothing transparent (the G-buffer has no blending): each piece grows, then shrinks away.
 */
export class InkBursts {
  constructor(parent, { drops = null } = {}) {
    this.group = new THREE.Group(); this.group.name = 'Ink bursts'; this.group.userData.noCollide = true;
    parent.add(this.group);
    this.drops = drops;
    this.mats = { cloud: inkMat('#f7ecd6', { glow: 0.55 }), cloud2: inkMat('#e9d3a6', { glow: 0.35 }), ink: inkMat(INK), spark: inkMat('#f2c54b', { glow: 1 }) };
    this.geo = {
      puff: new THREE.IcosahedronGeometry(1, 1),
      splash: new THREE.ShapeGeometry(splashShape(12, 7)).rotateX(-Math.PI / 2),
      core: new THREE.IcosahedronGeometry(1, 0),
      stroke: new THREE.BoxGeometry(0.07, 0.07, 1).translate(0, 0, 0.5),
    };
    this.live = [];
    this.pool = [];
  }
  make() {
    const g = new THREE.Group(); g.userData.noCollide = true;
    const puffs = [];
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(this.geo.puff, i % 3 === 2 ? this.mats.cloud2 : this.mats.cloud); m.userData.noCollide = true; g.add(m); puffs.push(m); }
    const splash = new THREE.Mesh(this.geo.splash, this.mats.ink); splash.userData.noCollide = true; g.add(splash);
    const core = new THREE.Mesh(this.geo.core, this.mats.ink); core.userData.noCollide = true; g.add(core);
    const strokes = [];
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(this.geo.stroke, i % 4 === 0 ? this.mats.spark : this.mats.ink); m.userData.noCollide = true; g.add(m); strokes.push(m); }
    return { group: g, puffs, splash, core, strokes, dirs: strokes.map(() => new THREE.Vector3()), offs: puffs.map(() => new THREE.Vector3()) };
  }
  /** A burst at `at` (on a surface of normal `up`), `size` its radius in metres. */
  add(at, up = _Y, size = 4) {
    const b = this.pool.pop() ?? this.make();
    b.t = 0; b.size = size; b.life = 1.1;
    b.group.position.copy(at);
    b.group.quaternion.setFromUnitVectors(_Y, up);
    b.group.visible = true;
    this.group.add(b.group);
    b.offs.forEach((o, i) => o.set(Math.cos(i * 2.4) * 0.45, 0.35 + (i % 3) * 0.22, Math.sin(i * 2.4) * 0.45).multiplyScalar(i === 0 ? 0 : 1));
    b.dirs.forEach((d, i) => d.set(Math.cos(i / b.dirs.length * Math.PI * 2 + Math.random() * 0.3), 0.15 + Math.random() * 0.75, Math.sin(i / b.dirs.length * Math.PI * 2 + Math.random() * 0.3)).normalize());
    b.strokes.forEach((s, i) => s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.dirs[i]));
    b.splash.rotation.y = Math.random() * Math.PI * 2;
    this.live.push(b);
    // drops of ink flung out (the fluid tool's droplets, when there is one)
    if (this.drops) {
      const world = at.clone();
      for (let i = 0; i < 40; i++) {
        const v = new THREE.Vector3().randomDirection(); if (v.dot(up) < 0) v.addScaledVector(up, -2 * v.dot(up));
        this.drops.add({ pos: world, vel: v.multiplyScalar(4 + Math.random() * 9).addScaledVector(up, 3), drag: 1.6, grav: 14, size: 0.05 + Math.random() * 0.08, stretch: 2.2, life: 0.5 + Math.random() * 0.5, color: i % 5 === 0 ? '#3b3350' : INK });
      }
    }
    return b;
  }
  update(dt) {
    for (const b of this.live) {
      b.t += dt;
      const k = b.t / b.life, S = b.size;
      // first a burst of ink, out and gone in a third of a second
      const ck = b.t / 0.32, cs = S * 0.55 * (ck < 0.3 ? ck / 0.3 : Math.max(0, 1 - (ck - 0.3) / 0.7));
      b.core.visible = cs > 0.01; b.core.scale.setScalar(Math.max(0.001, cs)); b.core.position.y = S * 0.2; b.core.rotation.set(b.t * 3, b.t * 5, 0);
      // then the cloud: swells fast, hangs, shrinks away
      const swell = Math.min(1, Math.max(0, b.t - 0.05) * 8), fade = k < 0.5 ? 1 : Math.max(0, 1 - (k - 0.5) / 0.5);
      b.puffs.forEach((p, i) => {
        const s = S * (i === 0 ? 0.42 : 0.3) * swell * fade * (1 + 0.15 * Math.sin(i * 1.7));
        p.visible = s > 0.01;
        p.scale.setScalar(Math.max(0.001, s));
        p.position.copy(b.offs[i]).multiplyScalar(S * (0.55 + 0.6 * Math.min(1, k * 3)));
      });
      // the ink star on the ground: out in a flash, then drawn back in
      const ss = S * 0.85 * Math.min(1, b.t * 12) * (k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3));
      b.splash.visible = ss > 0.01; b.splash.scale.setScalar(Math.max(0.001, ss)); b.splash.position.y = 0.04;
      // speed strokes flung out
      b.strokes.forEach((s, i) => {
        const r = S * (0.25 + 1.1 * Math.min(1, b.t * 3.2)), len = S * 0.5 * Math.max(0, 1 - b.t * 2.2);
        s.visible = len > 0.02;
        s.position.copy(b.dirs[i]).multiplyScalar(r);
        s.scale.set(1, 1, Math.max(0.001, len));
      });
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      if (b.t >= b.life) { b.group.visible = false; b.group.removeFromParent(); this.live.splice(i, 1); this.pool.push(b); }
    }
  }
  dispose() { this.group.removeFromParent(); Object.values(this.geo).forEach((g) => g.dispose()); }
}
