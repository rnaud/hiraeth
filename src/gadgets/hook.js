import * as THREE from 'three';
import { inkMat, INK, InkLine, traceAim, aimRay, assistPick } from './kit.js';
import { rayWorld } from '../fluid-tool.js';
import { sfx } from './sfx.js';

// The grappling hook (docs/systems/gadgets.md, "The grappling hook"): hold the use button to aim (the camera
// comes over the shoulder, a reticle shows what the hook would catch within HOOK.range), let go to fire.
// The hook flies along the line from the glove to that point; caught on a surface or a ring it reels the
// traveller in (a wall: he takes hold of it, or hauls himself over its top; a floor: he lands there), and
// caught on something loose (a crate, a foe, a creature) it drags that to him instead. Jump while reeling
// in lets go, flinging him on with the reel's speed. A tap fires at once where the camera looks.

export const HOOK = {
  range: 25,         // m from the glove
  fly: 75,           // m/s the hook head flies out
  back: 95,          // m/s it comes back
  pull: 26,          // m/s the reel pulls the traveller
  ease: 7,           // 1/s: the pull slows over the last metres (speed ≤ distance × ease)
  arrive: 0.7,       // m from where he is reeled to: there
  maxPull: 2.2,      // s at most on the line
  stuck: 0.28,       // s without getting nearer: stuck on something, let go
  drag: 15,          // m/s a loose thing comes in
  dragTo: 1.8,       // m from the traveller it is let go
  hang: 1.35,        // m the hand holds the hook above the feet (a wall: reeled to below the hook)
  stand: 0.45,       // m off a wall when he arrives
  fling: 0.55,       // share of the reel's speed kept when jump lets go (and a hop up)
  cool: 0.25,        // s between shots
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const _Y = new THREE.Vector3(0, 1, 0);

/**
 * Where the traveller's feet are reeled to for a hook caught at `point` on a surface of normal `n`: on a
 * floor (n up) just above the point; on a wall a little out from it and a hand's reach below; under a
 * ceiling, hanging well below it. (Pure: tests/gadgets.test.js.)
 */
export function reelTarget(point, n, up = _Y, out = new THREE.Vector3()) {
  const nu = n.dot(up);
  out.copy(point);
  if (nu > 0.55) return out.addScaledVector(up, 0.05);                    // a floor: stand on it
  out.addScaledVector(n, HOOK.stand);                                      // a wall or an overhang: out from it
  return out.addScaledVector(up, -HOOK.hang - Math.max(0, -nu) * 0.6);   // below the hand
}

/** The reel's velocity toward `target` from `pos`: HOOK.pull, slowing over the last metres; zero there. */
export function reelVelocity(pos, target, { speed = HOOK.pull, ease = HOOK.ease } = {}, out = new THREE.Vector3()) {
  out.subVectors(target, pos);
  const d = out.length();
  if (d < 1e-4) return out.set(0, 0, 0);
  return out.multiplyScalar(Math.min(speed, Math.max(3, d * ease)) / d);
}

/** Can the hook reach a point d metres from the glove? */
export const inReach = (d, range = HOOK.range) => Number.isFinite(d) && d > 0.6 && d <= range;

function hookModel() {
  const g = new THREE.Group();
  const brass = inkMat('#d6a94a', { metal: 'brass' }), dark = inkMat('#3a3330'), rope = inkMat('#e8d9b4'), red = inkMat('#c8483a');
  // the launcher: a short brass barrel on a wrist cuff, a red grip band
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 12).rotateZ(Math.PI / 2), brass));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.04, 12).rotateZ(Math.PI / 2).translate(-0.04, 0, 0), red));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16).rotateY(Math.PI / 2).translate(-0.09, 0, 0), dark));
  // the coil of rope underneath
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.02, 8, 18).rotateX(Math.PI / 2).translate(-0.02, -0.06, 0), rope));
  // the head: a cone and three curled prongs
  const head = hookHead(dark);
  head.position.x = 0.12; head.rotation.z = -Math.PI / 2;
  g.add(head);
  g.rotation.set(0.3, -0.5, 0.2);
  return g;
}

/** The hook's head alone (it points up +y): a dark cone with three prongs curling back. */
function hookHead(mat) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 10).translate(0, 0.045, 0), mat));
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 5, 10, Math.PI * 0.9), mat);
    p.rotation.set(0, (i / 3) * Math.PI * 2, Math.PI / 2);
    p.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.04, 0.02, -Math.sin((i / 3) * Math.PI * 2) * 0.04);
    const holder = new THREE.Group(); holder.add(p); holder.rotation.y = (i / 3) * Math.PI * 2;
    g.add(holder);
  }
  return g;
}

export default {
  id: 'hook', name: 'Grappling hook', glyph: '⥉', order: 10,
  text: 'A brass reel on a wrist cuff, with a three-pronged hook on a line of makers’ cord thinner than a bootlace and stronger than a cable. Someone left it oiled.',
  use: 'Hold Y / △ (T, or the middle mouse button) to aim: the ring shows what it will catch, up to 25 m away. Let go to fire. Caught on a wall, a ledge or a ring, it reels you in; caught on something loose (a crate, a foe), it drags it to you. Jump while reeling in to let go.',
  model: hookModel,

  create(ctx) { return new Hook(ctx); },

  /** Its bay in the Gadget Yard: a tall wall with rings on top, two towers across a gap, a ring on a pole, crates up high. */
  yard(kit) {
    kit.flag('#c8483a');
    // the climbing wall, rings along its top edge
    kit.block([10, 7, 1.2], [0, 3.5, -9]);
    for (const x of [-3.5, 0, 3.5]) kit.anchor([x, 7.2, -8.3], { normal: [0, 0.2, 1] });
    // two towers across a 12 m gap, a ring on the far one's edge (and the far one carries two crates to pull down)
    kit.block([3, 5, 3], [-5.5, 2.5, -2]);
    kit.block([3, 5, 3], [6.5, 2.5, -2]);
    kit.anchor([5.1, 5.25, -2], { normal: [-1, 0.3, 0] });
    kit.crate([6.8, 5.45, -2.6]);
    kit.crate([6.3, 5.45, -1.2]);
    kit.steps([-5.5, 0, 1.4], 5, { yaw: 0 });
    // a ring on a tall pole in the open: swing up to it from anywhere
    kit.pole([0, 0, -2], 11);
    kit.anchor([0, 10.8, -0.84], { normal: [0, 0, 1] });   // (on the cap's rim, facing the yard: seen from below)
    // a low ledge under an overhang
    kit.block([4, 0.5, 2.6], [-3.5, 4.2, -7.1]);
  },
};

class Hook {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = 'idle'; this.t = 0; this.cool = 0; this.aiming = false;
    this.head = hookHead(inkMat(INK));
    this.head.traverse((o) => { o.userData.noCollide = true; });
    this.head.scale.setScalar(2.2);
    this.head.visible = false;
    ctx.fx.add(this.head);
    this.line = new InkLine(ctx.fx, { px: 1.7 });
    this.headPos = new THREE.Vector3(); this.target = null; this.goal = new THREE.Vector3(); this.from = new THREE.Vector3();
    this.reel = new THREE.Vector3(); this.best = Infinity; this.since = 0;
    this.ray = { origin: new THREE.Vector3(), dir: new THREE.Vector3() };
    this.aimHit = null;
  }

  get busy() { return this.state !== 'idle'; }

  /** The glove's mouth (the fluid tool's muzzle), or the chest. */
  hand(out = new THREE.Vector3()) {
    const { tool, player: P } = this.ctx;
    if (tool?.muzzle && P?.object?.visible !== false) return tool.muzzle(out);
    return out.copy(P.pos).addScaledVector(P.frame.up, 1.45);
  }

  /** What the hook would catch now: the aim's trace, checked from the glove (something nearer in the way catches it). */
  trace() {
    const { camera, player: P, physics, world } = this.ctx;
    aimRay(camera, P, this.ray);
    const hand = this.hand(_u);
    const far = HOOK.range + hand.distanceTo(this.ray.origin) + 2;
    const hit = traceAim(physics, this.ray.origin, this.ray.dir, far, { anchors: world?.anchors ?? [] });
    hit.reach = hand.distanceTo(hit.point);
    if (hit.kind !== 'none' && hit.kind !== 'target') {
      // the line from the glove: whatever stands in the way is what it bites
      const to = _w.subVectors(hit.point, hand), d = to.length();
      if (d > 0.8) {
        const block = rayWorld(physics, hand, to.divideScalar(d), d - 0.3);
        if (block) { hit.kind = 'world'; hit.point.copy(block.point); hit.normal.copy(block.normal); hit.reach = block.distance; hit.anchor = null; }
      }
    }
    // nothing loose under the crosshair: a light thing near the line, in plain sight, is caught instead (aim assist)
    if (hit.kind === 'world' || hit.kind === 'none') {
      const props = (world?.props ?? []).filter((p) => p.light && p.object.visible && !p.held);
      const a = assistPick(this.ray.origin, this.ray.dir, props, { range: Math.min(far, hit.kind === 'world' ? hit.distance + 1.5 : far), cone: 0.05, near: 0.5 });
      if (a) {
        const to = _w.subVectors(a.item.pos, hand), d = to.length();
        if (inReach(d) && !rayWorld(physics, hand, to.divideScalar(d), d - a.item.r)) Object.assign(hit, { kind: 'target', target: { kind: 'prop', prop: a.item, position: () => a.item.pos }, point: a.item.pos.clone(), reach: d });
      }
    }
    hit.ok = hit.kind !== 'none' && inReach(hit.reach);
    return hit;
  }

  canUse() {
    const P = this.ctx.player;
    return !!P && !P.ride && !P.down && !P.climbing && !P.mantle && !P.swim && !P.dead;
  }

  equip() { this.ctx.sfx.equip(this.ctx.sound); }
  unequip() { this.cancel(); }

  press() {
    if (this.state === 'pull' || this.state === 'drag') { this.letGo(false); return; }   // pressed again: let go
    if (this.state !== 'idle' || !this.canUse()) return;
    this.aiming = true; this.aimT = 0;
  }
  hold(dt) { if (this.aiming) this.aimT += dt; }
  release() {
    if (!this.aiming) return;
    this.aiming = false;
    if (this.cool > 0 || !this.canUse()) return;
    this.fire(this.trace());
  }

  fire(hit) {
    const P = this.ctx.player;
    this.hand(this.headPos);
    this.from.copy(this.headPos);
    this.target = hit;
    this.t = 0;
    this.state = 'out';
    this.cool = HOOK.cool;
    if (!hit.ok) { const dir = _v.subVectors(hit.point, this.headPos).normalize(); hit.point.copy(this.headPos).addScaledVector(dir, HOOK.range); hit.kind = 'none'; }
    this.goal.copy(hit.point);
    sfx.hookFire(this.ctx.sound);
    P.faceToward = null;
  }

  /** Let go of the line (jump while reeling, pressed again, knocked down): the hook comes back. */
  letGo(fling = false) {
    const P = this.ctx.player;
    if (this.state === 'pull' && P) {
      const up = P.frame.up;
      if (fling) { P.vel.copy(this.reel).multiplyScalar(HOOK.fling).addScaledVector(up, 6.5); P.onGround = false; }
      else P.vel.multiplyScalar(0.35);
    }
    if (this.dragged?.prop) { this.dragged.prop.held = null; this.dragged.prop.vel.multiplyScalar(0.25); }
    this.dragged = null;
    this.state = 'back';
  }

  cancel() { this.aiming = false; if (this.state !== 'idle') this.letGo(false); }

  /** Before the traveller moves: the reel sets his velocity (his own collision then carries him along walls). */
  control(dt, input) {
    const P = this.ctx.player;
    if (this.state !== 'pull') return;
    if (!P || P.ride || P.down || P.swim) { this.letGo(false); return; }
    const up = P.frame.up;
    // jump lets go, flinging you on
    if (input.Space && !this._jumpHeld) { this._jumpHeld = true; this.letGo(true); P._jumpHeld = true; return; }
    this._jumpHeld = !!input.Space;
    this.t += dt;
    const d = P.pos.distanceTo(this.goal);
    if (d < this.best - 0.05) { this.best = d; this.since = 0; } else this.since += dt;
    if (d < HOOK.arrive || this.since > HOOK.stuck || this.t > HOOK.maxPull) { this.arrive(); return; }
    reelVelocity(P.pos, this.goal, {}, this.reel);
    P.vel.copy(this.reel).addScaledVector(up, 32 * dt);   // (the gravity his step takes away is given back: a straight line)
    P.onGround = false; P.gliding = false;
    if (P.jetFlight) P.endJets();
    // facing along the line
    _v.copy(this.reel).addScaledVector(up, -this.reel.dot(up));
    if (_v.lengthSq() > 1) P.heading = P.frame.headingOf(_v);
  }

  /** Reeled in: take hold of the wall, haul over a ledge's top, or land on the floor. */
  arrive() {
    const P = this.ctx.player, up = P.frame.up, n = this.target.normal;
    const nu = n.dot(up);
    this.state = 'back';
    P.vel.set(0, 0, 0);
    if (nu < 0.55 && nu > -0.4) {
      const into = _v.copy(n).addScaledVector(up, -nu).normalize().negate();
      P.wallN.copy(into).negate();
      if (P.tryMantle?.(up, into)) return;
      if (P.opts?.climb !== false && P.stamina > 0.1 && !P.winded) { P.startClimb?.(_w.copy(into).negate()); return; }
      P.vel.copy(into).multiplyScalar(-2).addScaledVector(up, 3);   // pushed off it
    } else if (nu >= 0.55) P.vel.copy(this.reel).multiplyScalar(0.12);
  }

  /** After the traveller moved: the hook's flight, a dragged thing, the line, the reticle. */
  update(dt) {
    const { player: P } = this.ctx;
    this.cool = Math.max(0, this.cool - dt);
    const hand = this.hand(_u);
    if (this.aiming) {
      if (!this.canUse()) this.aiming = false;
      else {
        this.aimHit = this.trace();
        this.ctx.hud.reticle(this.aimHit.ok ? this.aimHit.point : null, this.aimHit.ok ? (this.aimHit.kind === 'anchor' ? 'anchor' : this.aimHit.kind === 'target' ? 'target' : 'ok') : 'far', this.aimHit.ok ? `${Math.round(this.aimHit.reach)} m` : 'out of reach');
        this.ctx.aimAt(this.aimHit.point, this.ray.dir);
        this._ret = true;
      }
    }
    // (only once it stops aiming: another gadget's aim may hold the reticle meanwhile)
    if (!this.aiming && this._ret) { this._ret = false; this.ctx.hud.reticle(null); }
    switch (this.state) {
      case 'out': {
        const T = this.target;
        if (T.kind === 'target') { const p = T.target.position?.(); if (p) this.goal.copy(p); }
        const to = _v.subVectors(this.goal, this.headPos), d = to.length(), step = HOOK.fly * dt;
        if (d <= step) {
          this.headPos.copy(this.goal);
          this.bite(T);
        } else this.headPos.addScaledVector(to.divideScalar(d), step);
        break;
      }
      case 'pull': break;   // (the head stays where it bit)
      case 'drag': this.updateDrag(dt, hand); break;
      case 'back': {
        const to = _v.subVectors(hand, this.headPos), d = to.length(), step = HOOK.back * dt;
        if (d <= step + 0.2) { this.state = 'idle'; } else this.headPos.addScaledVector(to.divideScalar(d), step);
        break;
      }
    }
    const shown = this.state !== 'idle';
    this.head.visible = shown || this.aiming;
    if (this.head.visible) {
      const at = shown ? this.headPos : hand;
      this.head.position.copy(at);
      const dir = shown ? _w.subVectors(this.headPos, hand) : this.ray.dir;
      if (dir.lengthSq() > 1e-4) this.head.quaternion.setFromUnitVectors(_Y, _w.copy(dir).normalize());
    }
    if (shown) this.line.set(hand, this.headPos); else this.line.hide();
    if (P && this.state === 'pull' && P.object) P.aim = null;
  }

  /** The hook reached its point: what it caught decides what the reel does. */
  bite(T) {
    const P = this.ctx.player;
    if (T.kind === 'none') { this.state = 'back'; sfx.hookMiss(this.ctx.sound); return; }
    if (T.kind === 'target') {
      const tg = T.target;
      sfx.hookCatch(this.ctx.sound, !!tg.prop?.metal);
      if (tg.kind === 'prop' && tg.prop.light) { this.dragged = { prop: tg.prop }; tg.prop.held = this; this.state = 'drag'; sfx.hookReel(this.ctx.sound); return; }
      if (tg.kind === 'foe' && tg.foe?.alive) { this.dragged = { foe: tg.foe }; this.state = 'drag'; tg.foe.stunned = Math.max(tg.foe.stunned, 0.6); sfx.hookReel(this.ctx.sound); return; }
      if (tg.kind === 'prop') {   // too heavy to drag: reel yourself to it
        T.normal.copy(_v.subVectors(P.pos, tg.prop.pos).setY(0).normalize());
        T.point.copy(tg.prop.pos).addScaledVector(T.normal, tg.prop.r).setY(tg.prop.pos.y + tg.prop.h);
      } else {
        // anything else alive (creatures, people): a tug toward you (the push, the other way)
        tg.onHit?.('push', T.point, _v.subVectors(P.pos, T.point).setY(0).normalize(), { strength: 1, shove: 2.2, mode: 'hook' });
        this.state = 'back';
        return;
      }
    } else sfx.hookCatch(this.ctx.sound, T.kind === 'anchor');
    // reel the traveller in
    this.state = 'pull'; this.t = 0; this.best = Infinity; this.since = 0;
    this._jumpHeld = true;
    reelTarget(T.point, T.normal, P.frame.up, this.goal);
    this.headPos.copy(T.point);
    if (P.climbing) P.stopClimb?.(false);
    sfx.hookReel(this.ctx.sound);
  }

  updateDrag(dt, hand) {
    const P = this.ctx.player, D = this.dragged;
    const thing = D?.prop?.pos ?? D?.foe?.pos;
    if (!thing || (D.foe && !D.foe.alive)) { this.letGo(false); return; }
    const to = _v.subVectors(P.pos, thing); to.y = 0;
    const d = to.length();
    if (d < HOOK.dragTo) {
      if (D.prop) { D.prop.held = null; D.prop.vel.copy(to.normalize()).multiplyScalar(1.2); }
      if (D.foe) { D.foe.vel.set(0, 0, 0); D.foe.stunned = Math.max(D.foe.stunned, 1.2); D.foe.flash = 1; }
      this.dragged = null; this.state = 'back';
      return;
    }
    to.divideScalar(d);
    if (D.prop) {
      // lifted a little off the ground as it comes, falling when let go
      const lift = THREE.MathUtils.clamp(P.pos.y + 1 - D.prop.pos.y, -4, 4);
      D.prop.vel.copy(to).multiplyScalar(Math.min(HOOK.drag, d * 4)).setY(lift * 3);
      D.prop.resting = false;
    } else D.foe.vel.copy(to).multiplyScalar(Math.min(HOOK.drag * 0.8, d * 4));
    this.headPos.copy(thing).setY(thing.y + (D.prop ? D.prop.h * 0.6 : D.foe.def.height));
  }

  hud() { return { note: this.state === 'pull' ? 'reeling' : this.state === 'drag' ? 'pulling' : '' }; }

  dispose() { this.head.removeFromParent(); this.line.dispose(); }
}
