import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { allTargets, targetsInCone } from './targets.js';

// The fluid blade: the glove draws a blade of the tank's fluid and swings it (F, LB / L1, touch ⚔).
// It comes with the backpack and costs nothing: a press swings, presses in quick succession chain up
// to three swings (right to left, left to right, a heavier overhead last). The swing turns the body
// to the nearest foe in reach (a soft lock), the arm follows an arc in front of the chest (the tool's
// aim pose: player.aim, the same IK the shots use), and the blade lights from the glove for the swing
// and fades. Only targets that list 'blade' in `accepts` feel it (the ink blots and the makers'
// machines, src/foes.js; wildlife scatters); people, switches and the story's puzzles do not: a blade
// is not a splash.
//
//   const blade = new FluidBlade(tool)      (FluidTool makes it)
//   blade.update(dt, press, ok)             per frame, after the tool's own update
//   blade.swinging                          true during a swing
//   emits 'tool:fire' { mode: 'blade', point } on each swing

export const BLADE = {
  length: 1.25, radius: 0.045,
  swing: 0.3,          // s a swing takes
  hitAt: 0.42,         // share of the swing when it lands
  chain: 0.45,         // s after a swing in which the next press chains
  reach: 2.9, angle: 1.15,   // the swing's cone: metres from the chest, half-angle (rad, ~65°)
  lock: 6,             // m: the soft lock turns you to a foe this close
  damage: [1, 1, 2],   // the combo's three swings
  cooldown: 0.5,       // after the third swing
};

/** The arc a swing's hand follows (u 0..1 along it): side to side (+1 the right), up and down, for the three swings. */
export function swingArc(n, u) {
  const e = u * u * (3 - 2 * u);
  if (n === 2) return { side: 0.15 - 0.3 * e, rise: 0.75 - 1.35 * e, reach: 0.75 + 0.15 * Math.sin(Math.PI * e) };   // overhead, down
  const s = n === 0 ? 1 - 2 * e : -1 + 2 * e;                                                                    // right to left, then back
  return { side: 1.05 * s, rise: 0.15 - 0.1 * Math.cos(Math.PI * e), reach: 0.8 + 0.25 * Math.sin(Math.PI * e) };
}

/** Targets a swing from `origin` along `dir` touches: those in the cone that accept the blade, nearest first. */
export function bladeHits(origin, dir, physics = null, { reach = BLADE.reach, angle = BLADE.angle } = {}) {
  return targetsInCone(origin, dir, reach, angle, physics).filter((h) => h.target.accepts?.includes('blade'));
}

/** The nearest foe the soft lock turns to: a target with lock: true within `range` (flat distance), or null. */
export function lockTarget(from, range = BLADE.lock, targets = allTargets()) {
  let best = null, bd = range;
  for (const t of targets) {
    if (!t.lock || !t.enabled()) continue;
    const p = t.position(), d = Math.hypot(p.x - from.x, p.z - from.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);

export class FluidBlade {
  constructor(tool) {
    this.tool = tool;
    this.n = -1; this.t = 0; this.chainT = 0; this.cool = 0; this.lit = 0; this.hit = false; this.queued = false;
    this.point = new THREE.Vector3(); this.dir = new THREE.Vector3(0, 0, 1); this.pose = { k: 0, point: this.point, dir: this.dir };
    // the blade: the glob's lava in the tank's tones, from the glove along the arm, and a pale edge
    // (glowing: the bloom draws its halo); the trail's glowing drops follow its tip
    const geo = new THREE.CapsuleGeometry(BLADE.radius, BLADE.length, 4, 10).translate(0, BLADE.length / 2 + BLADE.radius, 0);
    this.core = new THREE.Mesh(geo, tool.globMat);
    this.edge = new THREE.Mesh(new THREE.CylinderGeometry(BLADE.radius * 0.35, BLADE.radius * 0.35, BLADE.length * 0.92, 6).translate(0, BLADE.length * 0.5, BLADE.radius * 0.8),
      makeMaterial({ color: '#fffbea', flat: true, glow: 1, key: 'fluid-blade-edge' }));
    this.group = new THREE.Group();
    this.group.add(this.core, this.edge);
    this.group.visible = false;
    this.group.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    tool.fx.add(this.group);
  }

  get swinging() { return this.n >= 0; }

  /** Per frame. press: a fresh press of the blade button; ok: the tool may act (FluidTool.allowed). */
  update(dt, press, ok) {
    const T = this.tool, p = T.player;
    this.cool = Math.max(0, this.cool - dt);
    this.chainT = Math.max(0, this.chainT - dt);
    if (!ok || !p) { this.stop(); return this.fade(dt); }
    if (press) {
      if (this.swinging) this.queued = this.n < 2;                 // chained: the next swing follows this one
      else if (this.cool === 0) this.start(this.chainT > 0 ? Math.min(this.last + 1, 2) : 0);
    }
    if (this.swinging) {
      this.t += dt / BLADE.swing;
      if (!this.hit && this.t >= BLADE.hitAt) { this.hit = true; this.strike(); }
      if (this.t >= 1) {
        this.last = this.n; this.n = -1;
        if (this.last === 2) { this.cool = BLADE.cooldown; this.chainT = 0; }
        else { this.chainT = BLADE.chain; if (this.queued) this.start(this.last + 1); }
        this.queued = false;
      }
    }
    // the arm follows the arc (the tool's aim pose, unless the tool is aiming itself)
    if (this.swinging && T.k < 0.05) {
      const U = p.frame.up, F = this.dir, R = _r.crossVectors(F, U).normalize();
      const a = swingArc(this.n, Math.min(this.t, 1));
      const chest = _o.copy(p.pos).addScaledVector(U, 1.35);
      this.point.copy(chest).addScaledVector(F, a.reach).addScaledVector(R, a.side).addScaledVector(U, a.rise);
      this.pose.k = Math.min(1, 0.35 + this.t * 3);
      p.aim = this.pose;
    }
    this.lit += ((this.swinging ? 1 : 0) - this.lit) * (1 - Math.exp(-(this.swinging ? 30 : 9) * dt));
    this.place(dt);
  }

  start(n) {
    const T = this.tool, p = T.player, U = p.frame.up;
    this.n = n; this.t = 0; this.hit = false;
    // the swing's way: toward the nearest foe in reach, else where the traveller faces
    const foe = lockTarget(p.pos);
    if (foe) this.dir.subVectors(foe.position(), p.pos); else p.frame.dir(p.heading, this.dir);
    this.dir.addScaledVector(U, -this.dir.dot(U));
    if (this.dir.lengthSq() < 1e-6) p.frame.dir(p.heading, this.dir);
    this.dir.normalize();
    T.sound?.fluidSlash?.(n);
    T.used('blade', p.pos);
  }

  /** The swing lands: every foe in the cone takes the swing's damage. */
  strike() {
    const T = this.tool, p = T.player, U = p.frame.up;
    const origin = _o.copy(p.pos).addScaledVector(U, 1.1);
    const hits = bladeHits(origin, this.dir, T.physics);
    const info = { ...T.info(), damage: BLADE.damage[this.n] ?? 1, combo: this.n };
    for (const h of hits) h.target.onHit?.('blade', h.point, h.dir, { ...info, mode: 'blade' });
    // wildlife in the cone scatters (it doesn't list the blade: it never feels it, it just runs)
    for (const h of targetsInCone(origin, this.dir, BLADE.reach, BLADE.angle, T.physics)) if (h.target.kind === 'wildlife') h.target.onHit?.('push', h.point, h.dir, info);
    if (hits.length) {
      T.lastHit = 'target';
      for (const h of hits) T.splash(h.point, h.dir.clone().negate(), 0.6);
      p.vel?.addScaledVector(this.dir, 1.2);   // a step into the cut
    }
    T.sound?.fluidSlashHit?.(hits.length > 0);
    return hits;
  }

  stop() { this.n = -1; this.queued = false; }

  fade(dt) { this.lit += (0 - this.lit) * (1 - Math.exp(-12 * dt)); this.place(dt); }

  /** The blade from the glove, along the arm (shoulder to hand), lit while it swings; a trail of fluid off its tip. */
  place(dt) {
    const T = this.tool, p = T.player, B = p?.humanoid?.b;
    const on = this.lit > 0.03 && p?.object?.visible !== false;
    this.group.visible = on;
    if (!on) return;
    const hand = T.muzzle(_a);
    let along;
    if (B?.upperarm_r) along = _f.subVectors(hand, B.upperarm_r.getWorldPosition(_b)).normalize();
    else along = _f.copy(this.point).sub(hand).normalize();
    // lean it a little toward the swing's way, so a cut reads as a cut
    along.addScaledVector(this.dir, 0.35).normalize();
    this.group.position.copy(hand);
    this.group.quaternion.copy(_q.setFromUnitVectors(_Y, along));
    this.group.scale.set(1, Math.max(0.05, this.lit), 1);
    if (this.swinging && dt > 0) {
      const tip = _b.copy(hand).addScaledVector(along, BLADE.length * this.lit), tones = T.modeTones;
      for (let i = 0; i < 3; i++) T.glow.add({ pos: _o.lerpVectors(hand, tip, 0.45 + i * 0.27), vel: _r.set(0, 0, 0), drag: 6, size: 0.05 + i * 0.015, life: 0.16, color: tones[(this.n + i) % tones.length], grow: false });
    }
  }

  dispose() { this.group.removeFromParent(); }
}
