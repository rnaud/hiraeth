import * as THREE from 'three';
import { registerTarget } from '../targets.js';
import { bounce } from './kit.js';
import { sfx } from './sfx.js';
import { gainInk } from '../ink.js';

// The things in a world the gadgets play with (docs/systems/gadgets.md, "The gadgets' world"): loose things
// (crates, pots, metal crates: they fall, slide, tumble, can be pushed by walking into them, thrown by a blast,
// pulled by the hook), cracked walls (a blast breaks them; in the Gadget Yard they grow back), anchors (rings
// the hook finds with a little aim assist), floor plates (pressed by the traveller or anything heavy left on
// them) and the gates they open. A level describes them in `level.gadgetYard` (src/gadgets/yard-kit.js builds
// that for the Gadget Yard); the runtime adopts them here once the collision exists.
//
//   const world = new GadgetWorld({ physics, player, spec: level.gadgetYard, sound })
//   world.update(dt)            after the traveller moved
//   world.props · world.anchors · world.breakAt(center, r) → how many broke · world.addProp({ object, ... })

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _p = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);
/** Loose things: gravity, how quickly they stop sliding, how they bounce, the walking push. */
export const PROPS = { gravity: 24, friction: 5, restitution: 0.3, push: { light: 2.6, heavy: 1.1 }, rest: 0.06 };

/**
 * A loose thing: its object's position is its centre (half its height `h` above its footing), `r` its
 * radius round. mass: 1 a crate, 4 a metal crate (a blast throws it a quarter as far); metal: what a magnet
 * would want; light: the hook can pull it.
 */
export class Prop {
  constructor({ object, r = 0.45, h = r, mass = 1, metal = false, light = mass <= 1.5, kind = 'crate', name = 'crate' }) {
    Object.assign(this, { object, r, h, mass, metal, light, kind, name });
    this.pos = object.position;
    this.vel = new THREE.Vector3();
    this.resting = false;
    this.home = object.position.clone();
    this.homeQ = object.quaternion.clone();
    this.held = null;   // a gadget holding it (the hook pulling): no gravity, no friction
  }
  /** A change of velocity (m/s, before its mass). */
  impulse(dv) { this.vel.addScaledVector(dv, 1 / this.mass); this.resting = false; return this; }
  /** Moving fast enough to hurt a foe, or still sliding. */
  get speed() { return this.vel.length(); }
}

/** One step of a loose thing (gravity along -up, its footing, walls). physics: groundAt, pushCapsule. */
export function stepProp(p, dt, physics, up = _Y) {
  if (p.resting && !p.held) return false;
  if (!p.held) p.vel.addScaledVector(up, -PROPS.gravity * dt);
  const steps = Math.min(8, Math.ceil((p.vel.length() * dt) / Math.max(0.1, p.r * 0.5)) || 1), sdt = dt / steps;
  let grounded = false;
  for (let i = 0; i < steps; i++) {
    p.pos.addScaledVector(p.vel, sdt);
    // (a capsule inside its box, its foot clear of the ground: a capsule shorter than its two ends would dig in)
    const rc = Math.max(0.05, Math.min(p.r * 0.92, p.h - 0.06));
    const push = physics.pushCapsule?.(p.pos, rc, -p.h + 0.12, p.h, _w, up);
    if (push) { const n = push.normalize(); if (p.vel.dot(n) < 0) bounce(p.vel, n, PROPS.restitution, 0.8); }
    const g = physics.groundAt(p.pos.x, p.pos.y + p.h * 0.5 + 0.2, p.pos.z, 50);
    if (Number.isFinite(g) && p.pos.y - p.h <= g + 1e-3) {
      p.pos.y = g + p.h;
      const vu = p.vel.dot(up);
      if (vu < 0) p.vel.addScaledVector(up, vu < -4 ? -vu * (1 + PROPS.restitution) : -vu);
      grounded = true;
    }
  }
  if (grounded && !p.held) {
    const vu = p.vel.dot(up);
    _v.copy(p.vel).addScaledVector(up, -vu).multiplyScalar(Math.exp(-PROPS.friction * dt));
    p.vel.copy(_v).addScaledVector(up, vu);
    if (p.vel.lengthSq() < PROPS.rest * PROPS.rest) { p.vel.set(0, 0, 0); p.resting = true; }
  }
  return grounded;
}

export class GadgetWorld {
  constructor({ physics, player = null, spec = null, sound = null, tool = null, game = null }) {
    Object.assign(this, { physics, player, sound, tool, game });
    this.props = []; this.breakables = []; this.anchors = []; this.plates = []; this.gates = []; this.offs = [];
    this.ropes = []; this.pickups = [];
    this.debris = [];
    this.pen = spec?.pen ?? null;
    for (const a of spec?.anchors ?? []) this.addAnchor(a);
    for (const b of spec?.breakables ?? []) this.addBreakable(b);
    for (const g of spec?.gates ?? []) this.addGate(g);
    for (const p of spec?.plates ?? []) this.plates.push({ on: false, ...p });
    for (const p of spec?.props ?? []) this.addProp(p);
    for (const r of spec?.ropes ?? []) this.addRope(r);
    for (const p of spec?.pickups ?? []) this.addPickup(p);
  }

  // ---------------------------------------------------------------- loose things
  addProp(o) {
    const p = o instanceof Prop ? o : new Prop(o);
    p.object.traverse((m) => { m.userData.noCollide = true; });
    p.object.updateMatrixWorld(true);
    // solid for the traveller (stood on, walked into, ridden), moving with it (physics.addMover)
    p.collider = this.physics?.addMover?.(p.object, { all: true }) ?? null;
    p.target = registerTarget({ kind: 'prop', prop: p, radius: p.r * 1.25, position: () => p.pos, enabled: () => p.object.visible,
      onHit: (mode, point, dir) => {
        if (!dir) return false;
        if (mode === 'push') p.impulse(_v.copy(dir).multiplyScalar(7).add(_w.set(0, 3, 0)));
        else p.impulse(_v.copy(dir).multiplyScalar(1.5));
        return true;
      } });
    this.props.push(p);
    return p;
  }

  /** The loose things' own queries must not meet their own colliders: those are set aside meanwhile. */
  withoutProps(fn) {
    const ph = this.physics, ex = ph?.extras;
    if (!ex) return fn();
    const mine = new Set(this.props.map((p) => p.collider).filter(Boolean));
    ph.extras = ex.filter((e) => !mine.has(e));
    try { return fn(); } finally { ph.extras = ex; }
  }

  updateProps(dt) {
    const P = this.player, up = P?.frame?.up ?? _Y;
    // walking into one pushes it along (a metal crate barely), as a block in an old Zelda
    if (P && !P.ride && P.onGround && P._moveDir?.lengthSq() > 0.25) {
      for (const p of this.props) {
        _v.subVectors(p.pos, P.pos); const vy = _v.dot(up); _v.addScaledVector(up, -vy);
        const d = _v.length();
        if (vy < -0.2 || vy > 1.6 || d > p.r + 0.62 || d < 1e-3) continue;
        if (_v.divideScalar(d).dot(P._moveDir) < 0.6) continue;
        const speed = p.mass > 1.5 ? PROPS.push.heavy : PROPS.push.light;
        const want = _w.copy(P._moveDir).multiplyScalar(speed);
        p.vel.x = want.x; p.vel.z = want.z; p.resting = false;
      }
    }
    this.withoutProps(() => { for (const p of this.props) if (p.object.visible) stepProp(p, dt, this.physics, up); });
    for (const p of this.props) {
      // a slide turns it a little (no tumbling: they stay upright, as drawn)
      const s = Math.hypot(p.vel.x, p.vel.z);
      if (s > 0.4 && !p.resting) p.object.rotation.y += (p.vel.x * 0.7 - p.vel.z * 0.4) * dt * 0.6;
      p.object.updateMatrixWorld();
      // fell out of the world: back where it was placed
      if (p.pos.y < -60) this.resetProp(p);
    }
  }
  resetProp(p) { p.pos.copy(p.home); p.object.quaternion.copy(p.homeQ); p.vel.set(0, 0, 0); p.resting = false; p.held = null; }

  // ---------------------------------------------------------------- anchors
  addAnchor(a) { const x = { normal: _Y.clone(), radius: 0.4, ...a, pos: a.pos.clone() }; this.anchors.push(x); return x; }

  // ---------------------------------------------------------------- cracked walls
  /**
   * A cracked wall or prop: `object` drawn (kept out of the level's collision), `center` and `radius` where a
   * blast must reach it, `regrow` seconds before it stands again (the Gadget Yard; Infinity: gone for good),
   * `color` its debris.
   */
  addBreakable(b) {
    const x = { regrow: 12, color: '#b9a88e', radius: 1.5, broken: false, t: 0, ...b, center: b.center.clone() };
    x.object.traverse((m) => { m.userData.noCollide = true; });
    x.solid = this.solid(x.object);
    x.handle = this.physics?.addCollider?.(x.solid) ?? null;
    this.breakables.push(x);
    return x;
  }
  /** A stand-in for collision: the same meshes, not flagged noCollide (addCollider leaves those out). */
  solid(object) {
    object.updateMatrixWorld(true);
    const g = new THREE.Group();
    object.traverse((m) => { if (m.isMesh) { const c = new THREE.Mesh(m.geometry); c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); c.matrixWorld.copy(m.matrixWorld); g.add(c); } });
    g.updateMatrixWorld = function () { for (const c of this.children) c.matrixWorld.copy(c.matrix); };
    return g;
  }
  /** A blast at `center` of radius r: what it reaches breaks. Returns how many. */
  breakAt(center, r) {
    let n = 0;
    for (const b of this.breakables) {
      if (b.broken || center.distanceTo(b.center) > r + b.radius * 0.6) continue;
      this.breakIt(b, center);
      n++;
    }
    return n;
  }
  breakIt(b, from = null) {
    b.broken = true; b.t = 0;
    b.object.visible = false;
    if (b.handle) { this.physics.removeCollider(b.handle); b.handle = null; }
    b.onBreak?.(b);
    if (b.flag && this.game) this.game.set(b.flag, true);
    // chunks thrown out, away from the blast
    const box = new THREE.Box3().setFromObject(b.solid);
    const size = box.getSize(_p);
    for (let i = 0; i < 22; i++) {
      const at = new THREE.Vector3(box.min.x + Math.random() * size.x, box.min.y + Math.random() * size.y, box.min.z + Math.random() * size.z);
      const away = from ? _v.subVectors(at, from).setY(0).normalize() : _v.randomDirection();
      this.debris.push({ pos: at, vel: away.clone().multiplyScalar(3 + Math.random() * 6).add(new THREE.Vector3(0, 2 + Math.random() * 5, 0)), s: 0.12 + Math.random() * Math.min(0.35, size.y * 0.12), t: 0, spin: new THREE.Vector3().randomDirection(), color: b.color });
    }
    sfx.crumble(this.sound);
  }
  updateBreakables(dt) {
    const P = this.player;
    for (const b of this.breakables) {
      if (!b.broken || !Number.isFinite(b.regrow)) continue;
      b.t += dt;
      // grows back when its time is up and nobody stands in it
      if (b.t > b.regrow && !(P && P.pos.distanceTo(b.center) < b.radius + 1)) {
        b.broken = false; b.object.visible = true;
        b.handle = this.physics?.addCollider?.(b.solid) ?? null;
      }
    }
  }

  // ---------------------------------------------------------------- floor plates and gates
  addGate(g) {
    const x = { open: 0, travel: 3, speed: 2.5, ...g };
    x.object.traverse((m) => { m.userData.noCollide = true; });
    x.base = x.object.position.clone();
    x.handle = this.physics?.addMover?.(x.object, { all: true }) ?? null;
    this.gates.push(x);
    return x;
  }
  updatePlates(dt) {
    const P = this.player;
    for (const pl of this.plates) {
      const near = (p, h = 1.2) => Math.hypot(p.x - pl.pos.x, p.z - pl.pos.z) < pl.radius && Math.abs(p.y - pl.pos.y) < h;
      const on = (!pl.things && !!P && !P.ride && near(P.pos, 0.6)) || this.props.some((p) => p.object.visible && !p.held && p.mass >= (pl.mass ?? 1) && near(p.pos, p.h + 0.4));   // (one held up, by the magnet, a bubble, the hook, weighs nothing on it)
      if (on !== pl.on) { pl.on = on; sfx.click(this.sound, on); pl.onChange?.(on); }
      pl.k = THREE.MathUtils.damp(pl.k ?? 0, on ? 1 : 0, 14, dt);
      if (pl.object) pl.object.position.y = pl.pos.y - 0.08 * pl.k;
    }
    for (const g of this.gates) {
      const want = g.plates ? (g.plates.some((i) => this.plates[i]?.on) ? 1 : 0) : g.want ?? 0;
      g.open = THREE.MathUtils.clamp(g.open + Math.sign(want - g.open) * g.speed * dt / g.travel, 0, 1);
      g.object.position.copy(g.base).addScaledVector(_Y, -g.travel * g.open);
      g.object.updateMatrixWorld();
    }
  }

  // ---------------------------------------------------------------- ropes
  /**
   * A rope (or a vine) from `top` down `length` metres, drawn by `object` (a unit-length mesh hanging down
   * -y from its origin, scaled to the length), holding `prop` (an index into spec.props, or a Prop) at its
   * end while it stands. A cut (a target of kind 'rope': the boomerang, the fluid blade) drops what it
   * holds; `regrow` s later (the Gadget Yard) it hangs again with its load. A load pulled off it snaps it.
   */
  addRope(r) {
    const x = { regrow: 14, cut: false, t: 0, length: 3, ...r, top: r.top.clone() };
    if (typeof x.prop === 'number') x.prop = this.props[x.prop] ?? null;
    x.object?.traverse((m) => { m.userData.noCollide = true; });
    if (x.prop) { x.prop.held = x; x.hang = x.top.clone().addScaledVector(_Y, -x.length - x.prop.h); x.prop.pos.copy(x.hang); x.prop.home.copy(x.hang); }
    x.target = registerTarget({ kind: 'rope', rope: x, radius: 0.35, accepts: ['blade'], position: () => (x._mid ??= new THREE.Vector3()).copy(x.top).addScaledVector(_Y, -x.length * 0.55), enabled: () => !x.cut,
      onHit: (mode) => { if (mode !== 'blade' && mode !== 'cut') return false; this.cutRope(x); return true; } });
    this.ropes.push(x);
    return x;
  }
  cutRope(x) {
    if (x.cut) return false;
    x.cut = true; x.t = 0;
    if (x.object) x.object.visible = false;
    if (x.prop?.held === x) { x.prop.held = null; x.prop.resting = false; x.prop.vel.set(0, -0.5, 0); }
    x.onCut?.(x);
    sfx.snip?.(this.sound);
    return true;
  }
  updateRopes(dt) {
    const P = this.player;
    for (const x of this.ropes) {
      if (!x.cut) {
        const p = x.prop;
        if (p && p.held === x) { p.vel.set(0, 0, 0); p.pos.copy(x.hang); }
        else if (p && p.pos.distanceTo(x.hang) > 1.2) this.cutRope(x);   // pulled off it (the hook, a blast): it snaps
        if (x.object) { x.object.position.copy(x.top); x.object.scale.set(1, x.length, 1); }
        continue;
      }
      if (!Number.isFinite(x.regrow)) continue;
      x.t += dt;
      if (x.t > x.regrow && !(P && x.prop && P.pos.distanceTo(x.hang) < 3)) {
        x.cut = false;
        if (x.object) x.object.visible = true;
        if (x.prop) { x.prop.vel.set(0, 0, 0); x.prop.held = x; x.prop.pos.copy(x.hang); x.prop.resting = false; }
      }
    }
  }

  // ---------------------------------------------------------------- small pickups
  /**
   * A small thing to pick up (`kind` 'ink': a pot of the makers' ink, `amount` of it): walked into within
   * `reach` it is taken (the ink runs into the glove, src/ink.js); a gadget may carry it to you meanwhile
   * (`carried`: the boomerang; it follows `carry(p)`). A target of kind 'pickup' (so the boomerang finds
   * it). `regrow` s after it was taken (the Gadget Yard) another stands there.
   */
  addPickup(o) {
    const x = { kind: 'ink', amount: 1, reach: 1.3, regrow: 20, taken: false, t: 0, carried: null, ...o, home: o.pos.clone(), pos: o.pos.clone() };
    x.object?.traverse((m) => { m.userData.noCollide = true; });
    x.carry = (p) => { x.pos.copy(p); };
    x.target = registerTarget({ kind: 'pickup', pickup: x, radius: 0.45, position: () => x.pos, enabled: () => !x.taken, onHit: () => false });
    this.pickups.push(x);
    return x;
  }
  take(x) {
    if (x.taken) return false;
    x.taken = true; x.t = 0; x.carried = null;
    if (x.object) x.object.visible = false;
    if (x.kind === 'ink') {
      // (the first ink of a save is said as a blot's: here it is a pot's)
      const say = (t) => this.notice?.(t.startsWith('The blot leaves its ink') ? 'A pot of the makers’ ink: it runs into the glove. Gather enough and the blade grows.' : t);
      gainInk(x.amount, { game: this.game ?? undefined, notice: say });
    }
    x.onTake?.(x);
    this.sound?.chime?.();
    return true;
  }
  updatePickups(dt, time) {
    const P = this.player;
    for (const x of this.pickups) {
      if (x.taken) {
        x.t += dt;
        if (Number.isFinite(x.regrow) && x.t > x.regrow && !(P && P.pos.distanceTo(x.home) < 4)) { x.taken = false; x.pos.copy(x.home); if (x.object) x.object.visible = true; }
        continue;
      }
      if (P && !P.ride && P.pos.distanceTo(x.pos) < x.reach + 0.6 && Math.abs(P.pos.y + 0.8 - x.pos.y) < 1.8) { this.take(x); continue; }
      if (x.object) {
        // it bobs and turns where it stands (still while it is carried: the carrier spins it)
        if (!x.carried) { x.object.position.copy(x.pos); x.object.position.y += Math.sin(time * 2.2 + x.home.x) * 0.08; x.object.rotation.y += dt * 1.2; }
        else x.object.position.copy(x.pos);
      }
    }
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    this.time = (this.time ?? 0) + dt;
    this.updateRopes(dt);
    this.updatePickups(dt, this.time);
    this.updateProps(dt);
    this.updateBreakables(dt);
    this.updatePlates(dt);
    // the debris of a broken wall: tumbles, lands, shrinks away (drawn by the runtime's debris mesh)
    for (const d of this.debris) {
      d.t += dt;
      d.vel.y -= PROPS.gravity * dt;
      d.pos.addScaledVector(d.vel, dt);
      const g = this.physics?.groundAt?.(d.pos.x, d.pos.y + 1, d.pos.z, 20) ?? -Infinity;
      if (d.pos.y < g + d.s * 0.5) { d.pos.y = g + d.s * 0.5; d.vel.multiplyScalar(0.4); d.vel.y = Math.abs(d.vel.y) * 0.3; }
    }
    this.debris = this.debris.filter((d) => d.t < 2.2);
  }

  dispose() {
    for (const p of this.props) { p.target?.(); if (p.collider) this.physics?.removeCollider?.(p.collider); }
    for (const b of this.breakables) if (b.handle) this.physics?.removeCollider?.(b.handle);
    for (const g of this.gates) if (g.handle) this.physics?.removeCollider?.(g.handle);
    for (const x of [...this.ropes, ...this.pickups]) x.target?.();
    this.offs.forEach((f) => f());
  }
}
