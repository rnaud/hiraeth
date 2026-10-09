import * as THREE from 'three';
import { inkMat, INK, PAPER, aimRay, assistPick } from './kit.js';
import { rayWorld } from '../fluid-tool.js';
import { allTargets, modeFor } from '../targets.js';
import { hitStop, kick } from '../feel.js';
import { MAGIC_COST } from '../resources.js';

// The boomerang (docs/systems/gadgets.md, "The boomerang"): a brass-and-ink crescent. Hold the use button to
// aim: a curved path of dots shows its flight, and whatever the reticle passes over while it is held is
// locked on to (up to BOOM.locks, numbered, as in Zelda). Let go to throw: it curves out through each lock in
// turn and comes back to the hand. On the way it stuns foes for a moment, flips switches and targets, rings
// the temples' crystals and gauges as a glob would, cuts ropes, nudges crates, and brings small things back
// (the relics, a pot of ink). Coated in the fluid tool's mode (ember, stilling, bloom) it carries it: an
// ember boomerang lights the lanterns it passes. A wall turns it back with a clink.

export const BOOM = {
  range: 22,          // m from the glove
  speed: 20,          // m/s out
  back: 24,           // m/s home
  turn: 5,            // rad/s it turns toward the hand at first, growing with the time out
  locks: 3,           // targets at most
  cone: 0.06,         // rad round the aim a target is caught by the lock (or `near` m of the line)
  near: 0.9,
  bend: 0.24,         // how far it swings out to the side, a share of the distance
  stun: 1.6,          // s a foe is stunned
  r: 0.28,            // m, its own reach (what it touches)
  touch: 1.1,         // m from a locked point: that lock is hit
  catch: 1.0,         // m from the hand: caught
  maxFlight: 6,       // s at most out
  cool: 0.25,
  preview: 44,        // dots on the path
};

/** What a boomerang carries of the fluid tool's mode (the others are plain fluid: nothing to carry). */
export const CARRY = ['fire', 'stun', 'bloom'];
const CARRY_TONES = { fire: ['#ff9a3c', '#ffd27a'], stun: ['#bfe9ff', '#7fc4e8'], bloom: ['#8fd16a', '#f2a7c8'] };
/** Targets it never locks on to (nor strikes as a glob would: a taxi is not hailed, a mount not called). */
export const NO_LOCK = new Set(['vehicle', 'mount', 'npc', 'wildlife', 'prop', 'pool', 'reactive', 'tree', 'tiles', 'crates', 'veil', 'chimney']);
const NO_STRIKE = new Set(['vehicle', 'mount']);

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Vector3(), _ls = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);

/**
 * The points its outward flight passes through: from the hand, a swing out to `side` (a unit vector across
 * the aim), then each lock in turn; with no lock, out to `end` (where the aim meets the world, or its reach).
 * (Pure: tests/boomerang.test.js.)
 */
export function boomPath(from, locks, end, side, { bend = BOOM.bend } = {}) {
  const first = locks.length ? locks[0] : end;
  const d = from.distanceTo(first);
  const swing = from.clone().lerp(first, 0.45).addScaledVector(side, d * bend);
  return [from.clone(), swing, ...(locks.length ? locks.map((p) => p.clone()) : [end.clone()])];
}

/** The curve through those points (centripetal Catmull-Rom: no loops between close points). */
export const boomCurve = (points) => new THREE.CatmullRomCurve3(points, false, 'centripetal');

/**
 * Its velocity homing on `target`: the direction turned toward it by at most `turn` × dt radians, at `speed`.
 * (Pure.) Returns `out`.
 */
export function homeVelocity(pos, vel, target, speed, turn, dt, out = new THREE.Vector3()) {
  const want = _v.subVectors(target, pos);
  const d = want.length();
  if (d < 1e-5) return out.copy(vel);
  want.divideScalar(d);
  const cur = _w.copy(vel);
  const L = cur.length();
  if (L < 1e-5) return out.copy(want).multiplyScalar(speed);
  cur.divideScalar(L);
  const ang = Math.acos(THREE.MathUtils.clamp(cur.dot(want), -1, 1)), step = turn * dt;
  if (ang <= step || ang < 1e-4) return out.copy(want).multiplyScalar(speed);
  // slerp the direction by step / ang
  const axis = _u.crossVectors(cur, want);
  if (axis.lengthSq() < 1e-10) axis.set(0, 1, 0); else axis.normalize();
  return out.copy(cur).applyAxisAngle(axis, step).multiplyScalar(speed);
}

/** How near a target's middle the world may be met and still count as its own solid (a lantern's cage, a switch's plate). */
export const ownReach = (radius = 0.5) => Math.min(radius * 0.5 + 0.1, 0.9);

/**
 * Is `p` in plain sight from one of `eyes`: the line to it meets nothing, or only something within `own` m of
 * it (its own solid)? (Pure but for the physics' rays.)
 */
export function inSight(physics, eyes, p, own = 0.4) {
  for (const eye of eyes) {
    if (!eye) continue;
    const d = eye.distanceTo(p);
    if (d < 1e-3) return true;
    const hit = rayWorld(physics, eye, _ls.subVectors(p, eye).divideScalar(d), d);
    if (!hit || hit.point.distanceTo(p) <= own) return true;
  }
  return false;
}

/** The targets a segment a→b passes within `r` of (their radius counted), nearest along it first. (Pure.) */
export function segmentHits(a, b, targets, r = BOOM.r) {
  const d = _v.subVectors(b, a), L = d.length(), out = [];
  if (L < 1e-6) return out;
  d.divideScalar(L);
  for (const t of targets) {
    if (t.enabled && !t.enabled()) continue;
    const c = t.position();
    if (!c) continue;
    const along = THREE.MathUtils.clamp(_w.subVectors(c, a).dot(d), 0, L);
    const off = _u.copy(a).addScaledVector(d, along).distanceTo(c);
    if (off <= r + (t.radius ?? 0.5)) out.push({ target: t, along, point: a.clone().addScaledVector(d, along) });
  }
  return out.sort((x, y) => x.along - y.along);
}

/** The crescent: brass, its inner edge inked, the makers' mark at its elbow. Lies in the xz plane, about 0.36 m across. */
function crescent(scale = 1) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  const R = 0.18 * scale, r = 0.13 * scale, off = 0.07 * scale;
  // the outer arc, then the inner one back (offset): a crescent
  s.absarc(0, 0, R, Math.PI * 0.12, Math.PI * 0.88, false);
  s.absarc(0, -off, r, Math.PI * 0.86, Math.PI * 0.14, true);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.022 * scale, bevelEnabled: true, bevelThickness: 0.008 * scale, bevelSize: 0.008 * scale, bevelSegments: 1, curveSegments: 18 });
  geo.translate(0, -R * 0.55, -0.011 * scale).rotateX(-Math.PI / 2);
  const brass = inkMat('#d6a94a', { metal: 'brass' }), ink = inkMat(INK), paper = inkMat(PAPER);
  g.add(new THREE.Mesh(geo, brass));
  // ink bands across both arms and a pale dot at the elbow (the makers' mark)
  for (const a of [0.26, 0.74]) {
    const ang = Math.PI * a, x = Math.cos(ang) * (R + r) * 0.5, z = -(Math.sin(ang) * (R + r) * 0.5 - R * 0.55);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.012 * scale, 0.04 * scale, 0.07 * scale), ink);
    band.position.set(x, 0, z); band.rotation.y = -ang;
    g.add(band);
  }
  const mark = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * scale, 0.018 * scale, 0.046 * scale, 10), paper);
  mark.position.set(0, 0, -(R + r) * 0.5 + R * 0.55);
  g.add(mark);
  return g;
}

export default {
  id: 'boomerang', name: 'Boomerang', glyph: '☾', order: 30,
  text: 'A crescent of hammered brass with its edges inked, light as a feather and always sure of the way home. The makers threw them to fetch what had rolled too far.',
  use: 'Hold Y / △ (T, or the middle mouse button) to aim: a curved line shows its flight, and what the reticle passes over is locked on to, up to three. Let go to throw: it curves through each in turn and comes back. It stuns foes, flips switches and targets, cuts ropes and brings small things back to you. Thrown with an ember (or stilling) mode on the backpack, it carries it: an ember boomerang lights the lanterns it passes.',
  model: () => { const m = crescent(1); m.rotation.set(0.9, 0.3, 0.2); return m; },
  create(ctx) { return new Boomerang(ctx); },

  /** Its bay in the Gadget Yard: three targets in a row, lanterns to light, crates hung on ropes, pots of ink over a gap, ink blots. */
  yard(kit) {
    kit.flag('#d6a94a');
    // three targets on posts in an arc: lock on to all three and throw once
    kit.target([-4.5, 0, -6]); kit.target([0, 0, -8.5]); kit.target([4.5, 0, -6]);
    // a row of lanterns along a wall: an ember boomerang lights them as it passes
    kit.block([9, 2.4, 0.6], [0, 1.2, -11.5], { mat: 'pale' });
    for (const x of [-3, 0, 3]) kit.lantern([x - 0.5, 0, -10.8]);
    // two crates hung on ropes from a beam: cut the ropes and they drop
    kit.block([0.5, 5, 0.5], [-6.6, 2.5, -1.5]); kit.block([0.5, 5, 0.5], [-2.4, 2.5, -1.5]);
    kit.block([4.7, 0.4, 0.5], [-4.5, 5.2, -1.5], { mat: 'woodDark' });
    kit.rope([-5.6, 5, -1.5], { length: 2 }); kit.rope([-3.4, 5, -1.5], { length: 2.6 });
    // pots of ink up on a block you cannot reach from below: fetch them
    kit.block([2.4, 4.2, 2.4], [5.5, 2.1, -1]);
    kit.pickup([5.1, 4.2, -1.3]); kit.pickup([5.9, 4.2, -0.6]);
  },
};

class Boomerang {
  constructor(ctx) {
    this.ctx = ctx;
    this.aiming = false; this.cool = 0; this.flight = null; this.locks = [];
    this.ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.mesh = crescent(2.4);
    this.mesh.traverse((o) => { o.userData.noCollide = true; });
    this.mesh.visible = false;
    ctx.fx.add(this.mesh);
    // the path's dots (paper and ink), and its trail of swept strokes in flight
    const dots = (this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), inkMat(INK), BOOM.preview));
    dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BOOM.preview * 3), 3);
    dots.count = 0; dots.frustumCulled = false; dots.userData.noCollide = true;
    ctx.fx.add(dots);
    const trail = (this.trail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), inkMat(INK), 24));
    trail.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(24 * 3), 3);
    trail.count = 0; trail.frustumCulled = false; trail.userData.noCollide = true;
    ctx.fx.add(trail);
    this.history = [];
    this._m = new THREE.Matrix4(); this._c = new THREE.Color(); this._qq = new THREE.Quaternion(); this._s = new THREE.Vector3();
  }

  get busy() { return !!this.flight; }

  canUse() {
    const P = this.ctx.player;
    return !!P && !P.ride && !P.down && !P.climbing && !P.mantle && !P.dead && !P.swim?.under;
  }
  hand(out = new THREE.Vector3()) {
    const { tool, player: P } = this.ctx;
    if (tool?.muzzle && P?.object?.visible !== false) return tool.muzzle(out);
    return out.copy(P.pos).addScaledVector(P.frame.up, 1.45);
  }

  /** Everything it may lock on to now: the world's targets (not people, mounts, taxis…), and the relics. */
  lockables() {
    const out = [];
    for (const t of allTargets()) if (!NO_LOCK.has(t.kind) && t.enabled()) out.push({ key: t, kind: t.kind, target: t, pos: () => t.position() });
    for (const it of this.ctx.relics?.items ?? []) if (!it.done && it.grp.parent) out.push({ key: it, kind: 'relic', relic: it, pos: () => it.grp.position });
    return out;
  }

  /** The lock under the aim now (nearest the line, in plain sight from the glove), or null. */
  aimPick() {
    const { camera, player: P, physics } = this.ctx;
    aimRay(camera, P, this.ray);
    const hand = this.hand(_q);
    const cands = this.lockables().filter((c) => !this.locks.some((l) => l.key === c.key));
    const a = assistPick(this.ray.origin, this.ray.dir, cands, { range: BOOM.range + 4, cone: BOOM.cone, near: BOOM.near, pos: (c) => c.pos() });
    if (!a) return null;
    const p = a.item.pos(), d = hand.distanceTo(p);
    if (d > BOOM.range || d < 1) return null;
    // in sight: the line from the glove or from the eye meets nothing but the thing's own solid (a lantern
    // hidden behind a post, or behind its own, is not locked on to)
    if (!inSight(physics, [hand, camera.position], p, ownReach(a.item.target?.radius))) return null;
    return a.item;
  }

  /** Where an unlocked throw would turn back: the aim's meeting with the world, or its reach. */
  aimEnd(out = new THREE.Vector3()) {
    const { physics } = this.ctx;
    const hand = this.hand(_q);
    const far = rayWorld(physics, this.ray.origin, this.ray.dir, BOOM.range + 6);
    out.copy(far ? far.point : _v.copy(this.ray.origin).addScaledVector(this.ray.dir, BOOM.range + 4));
    // no further than its reach from the glove, and a little short of a wall (it turns before it)
    const d = out.distanceTo(hand), k = Math.min(1, BOOM.range / Math.max(d, 1e-3));
    out.sub(hand).multiplyScalar(k * (far ? 0.92 : 1)).add(hand);
    return out;
  }

  /** The side it swings out to: the camera's right (thrown from the right hand, it comes round to the left). */
  side(out = new THREE.Vector3()) {
    const up = this.ctx.player?.frame?.up ?? _Y;
    return out.crossVectors(this.ray.dir, up).normalize();
  }

  /**
   * The curve it will fly: swung out to the right, or to the left if that way meets a wall before the first
   * lock (or flat out, if both do). How far each gets clear is checked along the curve, a few rays.
   */
  plan(from, pts, end) {
    const { physics } = this.ctx;
    // (across the way to the first lock, or along the aim)
    const toward = _v.subVectors(pts[0] ?? end, from).normalize();
    const right = toward.lengthSq() > 0.5 ? new THREE.Vector3().crossVectors(toward, this.ctx.player?.frame?.up ?? _Y).normalize() : this.side(new THREE.Vector3());
    let best = null;
    for (const [k, bend] of [[1, BOOM.bend], [-1, BOOM.bend], [1, 0.04]]) {
      const curve = boomCurve(boomPath(from, pts, end, right.clone().multiplyScalar(k), { bend }));
      const n = 16, a = new THREE.Vector3(), b = new THREE.Vector3();
      let clear = 1;
      curve.getPointAt(0, a);
      for (let i = 1; i <= n; i++) {
        curve.getPointAt(i / n, b);
        const d = _w.subVectors(b, a), L = d.length();
        const hit = L > 1e-4 ? rayWorld(physics, a, d.divideScalar(L), L + BOOM.r) : null;
        if (hit && !pts.some((p) => hit.point.distanceTo(p) < BOOM.touch + 0.8)) { clear = (i - 1) / n; break; }
        a.copy(b);
      }
      if (!best || clear > best.clear + 1e-6) best = { curve, clear };
      if (clear >= 1) break;
    }
    return best.curve;
  }

  equip() { this.ctx.sfx.equip(this.ctx.sound); }
  unequip() { this.aiming = false; this.locks = []; this.ctx.hud.marks?.([]); }
  cancel() { this.aiming = false; this.locks = []; this.ctx.hud.marks?.([]); }

  press() {
    if (this.flight || !this.canUse()) return;
    this.aiming = true; this.locks = [];
  }
  release() {
    if (!this.aiming) return;
    this.aiming = false;
    if (this.cool > 0 || this.flight || !this.canUse()) { this.locks = []; return; }
    this.throw();
  }

  /** Off it goes: the path through the locks (frozen where they were), the fluid mode it carries. */
  throw() {
    const { player: P, tool } = this.ctx;
    aimRay(this.ctx.camera, P, this.ray);
    const from = this.hand(new THREE.Vector3());
    const pts = this.locks.map((l) => l.pos().clone());
    const curve = this.plan(from, pts, this.aimEnd(new THREE.Vector3()));
    // (a mode carried spends a charge of the tank, as a glob of it would; none left, it flies plain)
    let mode = CARRY.includes(tool?.mode) ? tool.mode : null;
    if (mode && tool.reserve && !tool.reserve.use(MAGIC_COST.gadget)) { mode = null; this.ctx.notice?.('Out of magic: the boomerang flies plain.', 'boom-dry'); }
    this.flight = {
      pos: from.clone(), vel: new THREE.Vector3(), curve, len: curve.getLength(), s: 0, phase: 'out', t: 0,
      pending: this.locks.map((l, i) => ({ ...l, at: pts[i] })), hit: new Set(), carry: [], mode, bounces: 0, spin: 0,
    };
    this.locks = [];
    this.ctx.hud.marks?.([]);
    this.cool = BOOM.cool;
    this.history.length = 0;
    snd.throw(this.ctx.sound);
    this.whirT = 0;
  }

  /** It touched something: what that is decides (a stun, a switch, a cut, a pickup to fetch). */
  strike(entry, point, dir) {
    const F = this.flight, ctx = this.ctx;
    const key = entry.key ?? entry.target ?? entry.relic;
    if (F.hit.has(key)) return false;
    F.hit.add(key);
    const flat = _v.copy(dir).setY(0);
    if (flat.lengthSq() > 1e-6) flat.normalize();
    if (entry.kind === 'relic') { F.carry.push({ relic: entry.relic }); snd.fetch(ctx.sound); return true; }
    const T = entry.target;
    if (!T || NO_STRIKE.has(T.kind)) return false;
    const mode = F.mode;
    const info = { mode: mode ?? 'shoot', colours: mode ? CARRY_TONES[mode] : ['#d6a94a', INK], strength: 0.6, shove: 1.2, source: 'boomerang' };
    switch (T.kind) {
      case 'foe': {
        const f = T.foe;
        if (!f?.alive) return false;
        f.stunned = Math.max(f.stunned ?? 0, BOOM.stun); f.flash = 1;
        f.vel?.addScaledVector(flat, f.kind === 'machine' ? 1 : 3);
        if (mode === 'stun' || mode === 'fire') T.onHit?.(mode, point, dir, info);
        hitStop(0.05); kick(0.25);
        snd.thock(ctx.sound, f.kind === 'machine');
        break;
      }
      case 'pickup': {
        if (T.pickup.taken || T.pickup.carried) return false;
        T.pickup.carried = this;
        F.carry.push({ pickup: T.pickup });
        snd.fetch(ctx.sound);
        return true;
      }
      case 'rope': T.onHit?.('blade', point, dir, info); break;
      case 'prop': T.prop?.impulse(_w.copy(flat).multiplyScalar(4).addScaledVector(_Y, 2)); snd.clink(ctx.sound, 0.6); break;
      case 'npc': case 'wildlife': T.onHit?.('push', point, flat.clone(), info); snd.thock(ctx.sound, false); break;
      default: {
        // what a glob would do: the switch flips, the crystal rings, an ember lights the lantern
        T.onHit?.(modeFor(T, mode ?? 'shoot'), point, dir, info);
        snd.ting(ctx.sound);
      }
    }
    // a splash of ink (or of the mode's tone) where it struck
    const drops = ctx.tool?.drops;
    if (drops) for (let i = 0; i < 10; i++) drops.add({ pos: point, vel: _w.randomDirection().multiplyScalar(2 + Math.random() * 3).addScaledVector(_Y, 1.5), drag: 2, grav: 10, size: 0.04 + Math.random() * 0.04, stretch: 2, life: 0.4 + Math.random() * 0.3, color: mode ? CARRY_TONES[mode][i % 2] : i % 3 ? INK : '#d6a94a' });
    ctx.game?.emit?.('gadget:boomerang', { kind: T.kind });
    return true;
  }

  /** One step of its flight (out along the curve, then homing on the hand). */
  step(dt) {
    const F = this.flight, { physics, player: P } = this.ctx;
    const hand = this.hand(this._hand ??= new THREE.Vector3());
    const prev = (this._prev ??= new THREE.Vector3()).copy(F.pos);
    F.t += dt;
    if (F.phase === 'out') {
      F.s += BOOM.speed * dt;
      const k = Math.min(1, F.s / F.len);
      F.curve.getPointAt(k, F.pos);
      F.curve.getTangentAt(k, F.vel).multiplyScalar(BOOM.speed);
      if (k >= 1) F.phase = 'back';
    } else {
      const turn = BOOM.turn + F.t * 6;
      homeVelocity(F.pos, F.vel, hand, BOOM.back, turn, dt, F.vel);
      F.pos.addScaledVector(F.vel, dt);
      if (F.pos.distanceTo(hand) < BOOM.catch + BOOM.back * dt * 0.5 || F.t > BOOM.maxFlight || (P && F.pos.distanceTo(hand) > 120)) { this.caught(); return; }
    }
    // the locks it reaches
    for (const L of F.pending) {
      if (F.hit.has(L.key)) continue;
      const live = L.pos();
      if (F.pos.distanceTo(L.at) < BOOM.touch || (live && F.pos.distanceTo(live) < BOOM.touch)) this.strike(L, F.pos.clone(), F.vel.clone().normalize());
    }
    // anything else in its way
    const seg = segmentHits(prev, F.pos, allTargets().filter((t) => !F.hit.has(t) && t.kind !== 'npc'));
    for (const h of seg) this.strike({ key: h.target, kind: h.target.kind, target: h.target }, h.point, _w.subVectors(F.pos, prev).normalize().clone());
    for (const it of this.ctx.relics?.items ?? []) if (!it.done && !F.hit.has(it) && it.grp.parent && it.grp.position.distanceTo(F.pos) < 0.9) this.strike({ key: it, kind: 'relic', relic: it }, F.pos.clone(), F.vel.clone());
    // a wall: it turns back with a clink (out), or glances off it (home)
    const mv = (this._mv ??= new THREE.Vector3()).subVectors(F.pos, prev), L = mv.length();
    if (L > 1e-5 && F.bounces < 4) {
      mv.divideScalar(L);
      const hit = this.ctx.world?.withoutProps ? this.ctx.world.withoutProps(() => rayWorld(physics, prev, mv, L + BOOM.r)) : rayWorld(physics, prev, mv, L + BOOM.r);
      // (a lock's own solid, a target's face, a lantern's cage: struck, and passed through on the way out)
      const atLock = hit && F.phase === 'out' && F.pending.find((Lk) => hit.point.distanceTo(Lk.at) < BOOM.touch + 0.8);
      // (a glancing touch on the way out, a corner grazed: it flies on along its curve)
      const graze = hit && F.phase === 'out' && Math.abs(mv.dot(hit.normal)) < 0.4;
      if (atLock) { if (!F.hit.has(atLock.key)) this.strike(atLock, hit.point.clone(), mv.clone()); }
      else if (graze) { if (!F.grazed) { F.grazed = true; snd.clink(this.ctx.sound, 0.4); } }
      else if (hit) {
        F.pos.copy(hit.point).addScaledVector(hit.normal, BOOM.r + 0.05);
        const speed = F.phase === 'out' ? BOOM.speed : BOOM.back;
        const vn = F.vel.dot(hit.normal);
        if (vn < 0) F.vel.addScaledVector(hit.normal, -2 * vn);
        F.vel.setLength(speed);
        F.phase = 'back'; F.bounces++;
        snd.clink(this.ctx.sound, 1);
        const glow = this.ctx.tool?.glow;
        if (glow) for (let i = 0; i < 8; i++) glow.add({ pos: hit.point, vel: _w.copy(hit.normal).multiplyScalar(2).add(_q.randomDirection().multiplyScalar(2.5)), drag: 3, size: 0.04, life: 0.25, color: '#ffe08a' });
      }
    }
  }

  /** Back in the glove: what it brought is yours. */
  caught() {
    const F = this.flight, P = this.ctx.player;
    for (const c of F.carry) {
      if (c.pickup) { c.pickup.carried = null; this.ctx.world?.take?.(c.pickup); }
      if (c.relic && !c.relic.done) {
        // laid at your feet: the relics' own pickup takes it (src/quest.js), with its sketch and its chime
        c.relic.grp.position.copy(P.pos).addScaledVector(P.frame.up, 1.1);
        c.relic.base = c.relic.grp.position.y;
        if (c.relic.light) c.relic.light.set(c.relic.grp.position.x, c.relic.grp.position.y, c.relic.grp.position.z, c.relic.light.w);
      }
    }
    this.flight = null;
    snd.catch(this.ctx.sound);
  }

  update(dt, paused = false) {
    this.cool = Math.max(0, this.cool - dt);
    const { player: P, hud } = this.ctx;
    if (this.aiming && !this.canUse()) { this.aiming = false; this.locks = []; }
    if (this.aiming && !paused) { this.updateAim(); this._shown = true; }
    else {
      this.dots.count = 0;
      // (only when it stops aiming: another gadget's aim may hold the reticle meanwhile)
      if (this._shown) { this._shown = false; hud.reticle?.(null); hud.marks?.([]); }
    }
    if (this.flight && !paused) {
      const F = this.flight;
      const steps = Math.max(1, Math.ceil((BOOM.back * dt) / 0.4));
      for (let i = 0; i < steps && this.flight; i++) this.step(dt / steps);
      if (this.flight) {
        // what it carries rides on it
        for (const c of F.carry) {
          if (c.pickup) c.pickup.carry(_v.copy(F.pos).addScaledVector(_Y, -0.25));
          if (c.relic && !c.relic.done) { c.relic.grp.position.x = F.pos.x; c.relic.grp.position.z = F.pos.z; c.relic.base = F.pos.y - 0.3; c.relic.light?.set(F.pos.x, F.pos.y, F.pos.z, c.relic.light.w); }
        }
        // its whirr, faster than the eye
        this.whirT -= dt;
        if (this.whirT <= 0) { this.whirT = 0.09; snd.whirr(this.ctx.sound, THREE.MathUtils.clamp(1 - P.pos.distanceTo(F.pos) / 40, 0.1, 1)); }
        // the carried mode trails off it
        const glow = this.ctx.tool?.glow;
        if (F.mode && glow && Math.random() < dt * 40) glow.add({ pos: F.pos, vel: _w.randomDirection().multiplyScalar(0.6), drag: 2, size: 0.07, life: 0.35, color: CARRY_TONES[F.mode][Math.random() < 0.5 ? 0 : 1] });
      }
    }
    this.drawMesh(dt);
    this.drawTrail(dt);
  }

  updateAim() {
    const { hud } = this.ctx;
    const pick = this.aimPick();
    if (pick && this.locks.length < BOOM.locks) {
      this.locks.push(pick);
      snd.lock(this.ctx.sound, this.locks.length);
    }
    // locks that went away (a foe cut down, a relic taken) fall off
    this.locks = this.locks.filter((l) => (l.target ? l.target.enabled() : !l.relic?.done));
    hud.marks?.(this.locks.map((l, i) => ({ point: _w.copy(l.pos()).addScaledVector(_Y, 0.55).clone(), label: i + 1 })));
    const end = this.aimEnd(new THREE.Vector3());
    const from = this.hand(new THREE.Vector3());
    this.drawPath(this.plan(from, this.locks.map((l) => l.pos().clone()), end), from);
    hud.reticle?.(this.locks.length >= BOOM.locks ? null : end, 'ok', this.locks.length ? `${this.locks.length} / ${BOOM.locks}` : '');
    this.ctx.aimAt(this.locks[0]?.pos() ?? end, this.ray.dir);
  }

  /** The dotted path: out along the curve, and a fainter way home (straight back to the hand). */
  drawPath(curve, from) {
    const n = BOOM.preview, out = Math.round(n * 0.75);
    let k = 0;
    for (let i = 1; i <= out; i++) {
      const p = curve.getPointAt(i / out, _v);
      const s = 0.075 + 0.015 * Math.sin(i * 0.9);
      this._m.makeScale(s, s, s).setPosition(p);
      this.dots.setMatrixAt(k, this._m); this.dots.setColorAt(k, this._c.set(i % 2 ? INK : '#d6a94a')); k++;
    }
    const end = curve.getPointAt(1, _w);
    for (let i = 1; i < n - out; i++) {
      const p = _u.copy(end).lerp(from, i / (n - out));
      const s = 0.045;
      this._m.makeScale(s, s, s).setPosition(p);
      this.dots.setMatrixAt(k, this._m); this.dots.setColorAt(k, this._c.set(i % 2 ? INK : PAPER)); k++;
    }
    this.dots.count = k;
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
  }

  drawMesh(dt) {
    const F = this.flight, M = this.mesh;
    M.visible = !!F || this.aiming;
    if (!M.visible) return;
    if (F) {
      M.position.copy(F.pos);
      F.spin += dt * 26;
      // flat to its flight, a little tipped, spinning
      M.rotation.set(0.25, F.spin, 0.15);
      M.scale.setScalar(1);
    } else {
      this.hand(M.position);
      M.rotation.set(1.1, performance.now() / 900, 0.2);
      M.scale.setScalar(0.55);
    }
  }

  /** Swept strokes behind it: the last few places it was, each a short ink dash shrinking away. */
  drawTrail(dt) {
    const F = this.flight, T = this.trail, H = this.history;
    if (F) H.unshift({ p: F.pos.clone(), t: 0 });
    for (const h of H) h.t += dt;
    while (H.length > 24 || (H.length && H[H.length - 1].t > 0.22)) H.pop();
    let n = 0;
    for (let i = 0; i + 1 < H.length; i++) {
      const a = H[i].p, b = H[i + 1].p, d = _v.subVectors(b, a), L = d.length();
      if (L < 1e-3) continue;
      const k = 1 - H[i].t / 0.22, w = 0.09 * k + 0.015;
      this._qq.setFromUnitVectors(_w.set(0, 0, 1), d.divideScalar(L));
      this._m.compose(_u.copy(a).lerp(b, 0.5), this._qq, this._s.set(w, w * 0.4, L));
      T.setMatrixAt(n, this._m);
      T.setColorAt(n, this._c.set(F?.mode ? CARRY_TONES[F.mode][i % 2] : i % 3 === 2 ? '#d6a94a' : INK));
      n++;
    }
    T.count = n;
    T.instanceMatrix.needsUpdate = true;
    if (T.instanceColor) T.instanceColor.needsUpdate = true;
  }

  hud() { return { note: this.flight ? (this.flight.phase === 'out' ? 'out' : 'coming back') : this.aiming && this.locks.length ? `${this.locks.length} locked` : '' }; }

  dispose() { this.mesh.removeFromParent(); this.dots.removeFromParent(); this.trail.removeFromParent(); this.ctx.hud?.marks?.([]); }
}

// ------------------------------------------------------------------ its sounds (the game's synth: src/audio.js)
const now = (s) => (s?.ctx ? s.ctx.currentTime : null);
export const snd = {
  /** The throw: a flick of the wrist and air. */
  throw(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.14, type: 'bandpass', freq: 1800, q: 0.8, vol: 0.1, rate: 1.3 }); s.sweep(t, 420, 900, 0.12, 0.05, 'triangle'); },
  /** In flight: a soft whirr, pulsing (vol by distance). */
  whirr(s, vol = 1) { const t = now(s); if (t == null || vol < 0.05) return; s.burst(t, { dur: 0.06, type: 'bandpass', freq: 1100 + Math.random() * 300, q: 2.5, vol: 0.045 * vol, rate: 1.1 }); },
  /** A lock on: a rising note, higher for each. */
  lock(s, i = 1) { const t = now(s); if (t == null) return; const f = [660, 880, 1100][Math.min(2, i - 1)]; s.sweep(t, f, f * 1.02, 0.12, 0.06, 'triangle'); s.sweep(t + 0.05, f * 1.5, f * 1.5, 0.09, 0.03, 'sine'); },
  /** It strikes a foe: a hollow knock (a machine: a clang). */
  thock(s, metal = false) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.08, type: 'lowpass', freq: metal ? 1600 : 700, q: 1, vol: 0.18 }); if (metal) s.sweep(t, 1500, 1350, 0.25, 0.06, 'triangle'); else s.sweep(t, 260, 140, 0.1, 0.07); },
  /** It flips a switch: a bright ting. */
  ting(s) { const t = now(s); if (t == null) return; s.sweep(t, 1900, 1850, 0.3, 0.06, 'sine'); s.sweep(t, 2850, 2800, 0.2, 0.025, 'sine'); },
  /** A wall: a clink of brass on stone (k how hard). */
  clink(s, k = 1) { const t = now(s); if (t == null) return; [1, 1.37, 2.1].forEach((m, i) => s.sweep(t + i * 0.004, 2300 * m, 2150 * m, 0.16, 0.05 * k / (i + 1), 'triangle')); s.burst(t, { dur: 0.03, type: 'highpass', freq: 3500, q: 0.8, vol: 0.08 * k }); },
  /** It takes hold of something to fetch. */
  fetch(s) { const t = now(s); if (t == null) return; s.sweep(t, 700, 1050, 0.12, 0.05, 'triangle'); },
  /** Back in the glove: a slap of brass in leather. */
  catch(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.05, type: 'lowpass', freq: 1200, q: 0.9, vol: 0.14 }); s.sweep(t, 600, 420, 0.08, 0.05, 'triangle'); },
};
