import * as THREE from 'three';
import { inkMat, INK, PAPER, aimRay, throwVelocity, arcPoints, bounce, blast } from './kit.js';
import { rayWorld } from '../fluid-tool.js';
import { raycastTargets } from '../targets.js';
import { sfx } from './sfx.js';

// Ink bombs (docs/systems/gadgets.md, "Ink bombs"): hold the use button and a dotted arc shows where the
// bomb would land, with a ring the size of its blast; let go to throw (a tap throws at once where the camera
// looks). It bounces and rolls, its fuse fizzing, and goes off BOMB.fuse seconds after the throw (at once if
// it lands on a foe): cracked walls break, foes are cut and thrown, loose things fly, the traveller is
// knocked back (never hurt). BOMB.max in the pouch; one more grows back every BOMB.refill seconds.

export const BOMB = {
  max: 3, refill: 5,           // bombs in the pouch; s for one to grow back
  fuse: 2.2,                   // s from the throw
  speed: 15, lift: 0.3,        // m/s; radians the throw tips up over the aim
  carry: 0.5,                  // share of the traveller's own speed it takes
  gravity: 22,                 // m/s² (a little more than real: a snappy arc)
  r: 0.2,                      // m, the bomb's radius
  restitution: 0.42, friction: 0.7, roll: 2.2,
  radius: 4.5, power: 11, damage: 3,   // (damage: the blade's cuts close in: a blot in two metres is gone)
  chain: 0.15,                 // s: a bomb caught in another's blast goes off this soon after
  preview: 34,                 // dots on the arc
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);

/** Bombs back in the pouch after `dt` (count, timer) → { count, t }. Pure. */
export function refillPouch(count, t, dt, { max = BOMB.max, every = BOMB.refill } = {}) {
  if (count >= max) return { count: max, t: 0 };
  t += dt;
  while (t >= every && count < max) { t -= every; count++; }
  return { count, t: count >= max ? 0 : t };
}

function bombBody(scale = 1) {
  const g = new THREE.Group();
  const body = inkMat('#2f3456'), band = inkMat(PAPER), brass = inkMat('#d6a94a', { metal: 'brass' }), wick = inkMat('#8a6a48');
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 18, 12), body));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.2 * scale, 0.018 * scale, 6, 28).rotateX(Math.PI / 2), band));
  // the makers' mark on its side: a small pale ring round a dot
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.055 * scale, 0.012 * scale, 5, 16).translate(0, 0.07 * scale, 0.19 * scale).rotateX(-0.35), band));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.07 * scale, 0.05 * scale, 12).translate(0, 0.205 * scale, 0), brass));
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.011 * scale, 0.011 * scale, 0.09 * scale, 5).rotateZ(0.35).translate(0.016 * scale, 0.27 * scale, 0), wick);
  g.add(fuse);
  const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.028 * scale, 0), inkMat('#f6c84e', { glow: 1 }));
  spark.position.set(0.032 * scale, 0.315 * scale, 0);
  g.add(spark);
  g.userData.spark = spark; g.userData.body = g.children[0];
  return g;
}

export default {
  id: 'bomb', name: 'Ink bombs', glyph: '●', order: 20,
  text: 'Round pots of the makers’ blackest ink, sealed under a brass cap with a short fuse. They grow back in their pouch, a drop at a time.',
  use: 'Hold Y / △ (T, or the middle mouse button): a dotted arc shows where it will land and how far the blast reaches. Let go to throw it. It bounces, rolls and goes off after two seconds (at once on a foe): it breaks cracked walls, throws foes and crates, and knocks you back if you stand too close. Three in the pouch; another grows back every five seconds.',
  model: () => bombBody(1),
  create(ctx) { return new Bombs(ctx); },

  /** Its bay in the Gadget Yard: a cracked wall closing an alcove, a cracked boulder, a crate stack, a pen of ink blots. */
  yard(kit) {
    kit.flag('#2f3456');
    // an alcove behind a cracked wall: a lamp waits inside
    kit.block([0.8, 3.4, 5], [-4.6, 1.7, -8]);
    kit.block([0.8, 3.4, 5], [-0.6, 1.7, -8]);
    kit.block([4.8, 0.6, 5.4], [-2.6, 3.6, -8]);
    kit.block([4.8, 3.4, 0.8], [-2.6, 1.7, -10.6]);
    kit.lamp([-2.6, 0, -8.6]);
    kit.cracked([3.2, 3.2, 0.7], [-2.6, 1.6, -5.6]);
    // a cracked boulder across a path
    kit.cracked([2.4, 2.2, 2.4], [3.5, 1.1, -8.5], { shape: 'boulder' });
    // a stack of crates and two metal ones
    kit.crate([4.8, 0.45, -2.5]); kit.crate([5.8, 0.45, -2.6]); kit.crate([5.3, 1.35, -2.55]);
    kit.crate([2.6, 0.5, -3.2], { metal: true }); kit.crate([1.5, 0.5, -3.6], { metal: true });
    // a pen of ink blots (kept at three; new ones come back while you are away from it)
    kit.pen([-4.5, 0, 1.5], 3.2, 3);
  },
};

class Bombs {
  constructor(ctx) {
    this.ctx = ctx;
    this.count = BOMB.max; this.t = 0; this.aiming = false;
    this.live = [];
    this.held = bombBody(0.75); this.held.visible = false; this.held.traverse((o) => { o.userData.noCollide = true; });
    ctx.fx.add(this.held);
    // the arc's dots and the landing ring (the blast's reach)
    const dots = (this.dots = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), inkMat(INK), BOMB.preview));
    dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BOMB.preview * 3), 3);
    dots.count = 0; dots.frustumCulled = false; dots.userData.noCollide = true;
    ctx.fx.add(dots);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(BOMB.radius, 0.05, 4, 64).rotateX(Math.PI / 2), inkMat('#c8483a', { glow: 0.4, thin: 1.4 }));
    this.ring.visible = false; this.ring.userData.noCollide = true;
    ctx.fx.add(this.ring);
    this.ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
    this._m = new THREE.Matrix4(); this._c = new THREE.Color();
  }

  canUse() {
    const P = this.ctx.player;
    return !!P && !P.ride && !P.down && !P.climbing && !P.mantle && !P.dead && !P.swim?.under;
  }
  hand(out = new THREE.Vector3()) {
    const { tool, player: P } = this.ctx;
    if (tool?.muzzle && P?.object?.visible !== false) return tool.muzzle(out);
    return out.copy(P.pos).addScaledVector(P.frame.up, 1.45);
  }
  /** The throw's velocity from the aim now. */
  throwVel(out = new THREE.Vector3()) {
    const { camera, player: P } = this.ctx;
    aimRay(camera, P, this.ray);
    throwVelocity(this.ray.dir, P.frame.up, BOMB.speed, BOMB.lift, out);
    return out.addScaledVector(P.vel, BOMB.carry);
  }

  equip() { this.ctx.sfx.equip(this.ctx.sound); }
  unequip() { this.aiming = false; }
  cancel() { this.aiming = false; }

  press() {
    if (!this.canUse()) return;
    if (this.count <= 0) { this.ctx.notice?.('No ink bombs left: one grows back in a few seconds.', 'bomb-empty'); sfx.hookMiss(this.ctx.sound); return; }
    this.aiming = true;
  }
  release() {
    if (!this.aiming) return;
    this.aiming = false;
    if (!this.canUse() || this.count <= 0) return;
    this.throw();
  }

  throw() {
    const from = this.hand(new THREE.Vector3());
    const vel = this.throwVel(new THREE.Vector3());
    this.spawn(from, vel);
    this.count--;
    sfx.bombThrow(this.ctx.sound);
  }

  /** A lit bomb at `pos` going at `vel` (also the tests' and the yard's way in). */
  spawn(pos, vel, fuse = BOMB.fuse) {
    const mesh = bombBody(1);
    mesh.traverse((o) => { o.userData.noCollide = true; });
    mesh.position.copy(pos);
    this.ctx.fx.add(mesh);
    const b = { pos: mesh.position, vel: vel.clone(), fuse, mesh, spin: new THREE.Vector3().randomDirection(), tick: 0, rest: false };
    this.live.push(b);
    return b;
  }

  /** One bomb's flight: gravity, the world (bounce, roll), a foe in its path (it goes off). */
  stepBomb(b, dt) {
    const { physics, player: P } = this.ctx, up = P?.frame?.up ?? _Y;
    b.vel.addScaledVector(up, -BOMB.gravity * dt);
    const move = _v.copy(b.vel).multiplyScalar(dt), L = move.length();
    if (L < 1e-5) return;
    const dir = _w.copy(move).divideScalar(L);
    // a foe in the way: off at once
    const t = raycastTargets(b.pos, dir, L + BOMB.r);
    if (t && t.target.kind === 'foe') { b.pos.copy(t.point); b.fuse = 0; return; }
    const hit = rayWorld(physics, b.pos, dir, L + BOMB.r);
    if (hit) {
      b.pos.copy(hit.point).addScaledVector(hit.normal, BOMB.r);
      const vn = -b.vel.dot(hit.normal);
      bounce(b.vel, hit.normal, BOMB.restitution, BOMB.friction);
      if (vn > 1.5) sfx.bombBounce(this.ctx.sound, Math.min(1, vn / 10) * this.near(b));
      // rolling on the ground: friction takes the speed away
    } else b.pos.add(move);
    // rolling along the ground: kept on it (a ray along a shallow roll can pass the floor under a sphere's reach)
    const below = rayWorld(physics, _u.copy(b.pos).addScaledVector(up, 0.4), _q.copy(up).negate(), 0.4 + BOMB.r);
    if (below && below.distance < 0.4 + BOMB.r) {
      b.pos.copy(below.point).addScaledVector(up, BOMB.r);
      const vu = b.vel.dot(up);
      if (vu < 0) b.vel.addScaledVector(up, vu < -2 ? -vu * (1 + BOMB.restitution) : -vu);
      // and the ground takes the roll away
      const vk = b.vel.dot(up);
      _u.copy(b.vel).addScaledVector(up, -vk).multiplyScalar(Math.exp(-BOMB.roll * dt));
      b.vel.copy(_u).addScaledVector(up, vk);
    }
  }

  /** How loud from here (1 beside the traveller, fading out over 60 m). */
  near(b) { const P = this.ctx.player; return P ? THREE.MathUtils.clamp(1 - P.pos.distanceTo(b.pos) / 60, 0, 1) : 1; }

  explode(b) {
    const { ctx } = this, up = ctx.player?.frame?.up ?? _Y;
    b.mesh.removeFromParent();
    const res = blast(ctx, b.pos, { radius: BOMB.radius, power: BOMB.power, damage: BOMB.damage });
    // its look: the cloud, the star of ink on the ground under it, a splash of ink where it lands
    const ground = rayWorld(ctx.physics, _q.copy(b.pos).addScaledVector(up, 0.5), _v.copy(up).negate(), 3);
    ctx.bursts.add(ground ? ground.point : b.pos, ground ? ground.normal : up, BOMB.radius * 0.8);
    if (ground) ctx.tool?.splats?.add?.(ground.point, ground.normal, INK, '#3b3350', 2.6, 9);
    sfx.bombBlast(ctx.sound, this.near(b));
    // other bombs caught in it go off just after
    for (const o of this.live) if (o !== b && o.fuse > BOMB.chain && o.pos.distanceTo(b.pos) < BOMB.radius) o.fuse = BOMB.chain;
    ctx.game?.emit?.('gadget:blast', { at: b.pos.clone(), ...res });
    return res;
  }

  update(dt) {
    const { player: P } = this.ctx;
    ({ count: this.count, t: this.t } = refillPouch(this.count, this.t, dt));
    if (this.aiming && !this.canUse()) this.aiming = false;
    // in hand while aiming, the arc and where it lands
    this.held.visible = this.aiming;
    if (this.aiming) {
      const from = this.hand(_q);
      this.held.position.copy(from);
      this.held.rotation.y += dt * 2;
      this.drawArc(from, this.throwVel(new THREE.Vector3()));
      this.ctx.aimAt(this.arcEnd ?? from, this.ray.dir);
    } else { this.dots.count = 0; this.ring.visible = false; }
    // the bombs out in the world
    for (const b of this.live) {
      // (held in a bubble, src/gadgets/bubble.js: carried by it, its fuse sealed until it pops)
      if (!b.held) {
        const steps = Math.min(6, Math.ceil(b.vel.length() * dt / 0.15) || 1);
        for (let i = 0; i < steps && b.fuse > 0; i++) this.stepBomb(b, dt / steps);
        b.fuse -= dt;
      }
      b.mesh.rotation.x += b.vel.length() * dt * 1.6;
      // the fuse fizzes, faster as it burns down; the bomb swells a little on each tick at the end
      b.tick -= dt;
      const left = Math.max(0, b.fuse);
      if (b.tick <= 0) { b.tick = Math.max(0.08, left * 0.18); sfx.bombFuse(this.ctx.sound); b.flash = 1; }
      b.flash = Math.max(0, (b.flash ?? 0) - dt * 8);
      b.mesh.scale.setScalar(1 + (left < 0.8 ? 0.18 * b.flash : 0.05 * b.flash));
      const spark = b.mesh.userData.spark;
      if (spark) spark.scale.setScalar(0.7 + Math.random() * 0.9);
      if (Math.random() < dt * 30) this.ctx.tool?.glow?.add?.({ pos: spark ? spark.getWorldPosition(_u) : b.pos, vel: _v.randomDirection().multiplyScalar(0.8).addScaledVector(P?.frame?.up ?? _Y, 1), drag: 2, size: 0.03, life: 0.3, color: '#f6c84e' });
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      if (b.fuse <= 0) { this.live.splice(i, 1); this.explode(b); }
      else if (b.pos.y < -200) { this.live.splice(i, 1); b.mesh.removeFromParent(); }
    }
  }

  /** The dotted arc from the hand, stopped where it meets the world; the blast's ring laid there. */
  drawArc(from, vel) {
    const { physics, player: P } = this.ctx, up = P.frame.up;
    const arc = arcPoints(from, vel, up, BOMB.gravity, { step: 0.045, n: BOMB.preview - 1, hit: (a, b) => {
      const d = _v.subVectors(b, a), L = d.length();
      const h = rayWorld(physics, a, d.divideScalar(L), L);
      if (h) { this._normal = h.normal; return h.point; }
      return null;
    } });
    const pts = arc.points;
    let n = 0;
    for (let i = 1; i < pts.length && n < BOMB.preview; i += 1) {
      const s = 0.065 + 0.015 * Math.sin(i * 0.9);
      this._m.makeScale(s, s, s).setPosition(pts[i]);
      this.dots.setMatrixAt(n, this._m);
      this.dots.setColorAt(n, this._c.set(i % 2 ? INK : PAPER));
      n++;
    }
    this.dots.count = n;
    this.dots.instanceMatrix.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
    this.arcEnd = arc.end;
    this.ring.visible = arc.landed;
    if (arc.landed) {
      // (laid flat whatever it lands on: the blast reaches round it, not along the wall)
      this.ring.position.copy(arc.end).addScaledVector(this._normal ?? up, 0.06);
      this.ring.quaternion.setFromUnitVectors(_Y, up);
    }
  }

  hud() { return { count: this.count, max: BOMB.max, refill: this.count < BOMB.max ? this.t / BOMB.refill : 0 }; }

  dispose() {
    for (const b of this.live) b.mesh.removeFromParent();
    this.live = [];
    this.held.removeFromParent(); this.dots.removeFromParent(); this.ring.removeFromParent();
  }
}
