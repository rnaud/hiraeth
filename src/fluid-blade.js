import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { allTargets, targetsInCone } from './targets.js';
import { hitStop, kick } from './feel.js';
import { hasUpgrade } from './ink.js';

// The fluid blade: the glove draws a blade of the tank's fluid and swings it (F, LB / L1, touch ⚔).
// It comes with the backpack and costs nothing: a press swings, presses in quick succession chain up
// to three swings (right to left, left to right, a heavier overhead last). The swing turns the body
// to the nearest foe in reach (a soft lock), the arm follows an arc in front of the chest (the tool's
// aim pose: player.aim, the same IK the shots use), and the blade lights from the glove for the swing
// and fades. Only targets that list 'blade' in `accepts` feel it (the ink blots and the makers'
// machines, src/foes.js; wildlife scatters); people, switches and the story's puzzles do not: a blade
// is not a splash.
//
// The guard button held (LB / L1, Ctrl or Z on land, touch 🛡) raises the guard (GUARD), once a swing is done: the left arm comes up and a
// shield of fluid blooms over the forearm (the Sword and Shield pack's block idle). A strike from in
// front (GUARD.angle) is blocked: it spends a charge, does no harm and staggers the foe, and the
// arm takes the blow (the pack's block). With the tank empty a strike gets through.
//
//   const blade = new FluidBlade(tool)      (FluidTool makes it)
//   blade.update(dt, press, ok, held)       per frame, after the tool's own update
//   blade.block(from)                       a strike from `from`: true if the guard took it (player.guard)
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

/**
 * The three swings from motion capture (Mixamo's Sword and Shield pack, in public/anim/moves.glb:
 * scripts/mocap/mixamo-clips.json): each clip's cut only, `from` → `to` (clip seconds), played `speed`
 * times as fast, landing at `hit` (the hand's fastest). Right to left and down; a rising backhand, left
 * to right; an overhead cut from above the head. Without the clips (not loaded yet) the arcs below.
 */
export const SWINGS = [
  { clip: 'mixamo_ss_slash_1', from: 0.33, to: 0.85, hit: 0.6 },
  { clip: 'mixamo_ss_slash_3', from: 0.53, to: 1.19, hit: 0.87 },
  { clip: 'mixamo_ss_attack_1', from: 0.78, to: 1.5, hit: 1.15 },
];
export const SWING_SPEED = 1.5;
/** The blade's grown moves (src/ink.js): the whirl replaces the third swing and cuts all round; the lunge is a swing begun at a run. */
export const WHIRL = { clip: 'mixamo_gs_high_spin', from: 0.55, to: 1.45, hit: 1.06, angle: Math.PI, damage: 2 };
export const LUNGE = { clip: 'mixamo_gs_slide_attack', from: 0.0, to: 0.9, hit: 0.5, dash: 9, damage: 2, reach: 3.6 };
/** The reach step: the blade this much longer, its swing this much further. */
export const REACH_UP = 1.3;
/** The guard: the clips (block idle held round and round, the block played as a strike lands), how wide it covers, and the shield. */
export const GUARD = { idle: 'mixamo_ss_block_idle', parry: 'mixamo_ss_block_1', parryFor: 0.55, angle: 1.3, rise: 0.12, radius: 0.5, perfect: 0.3 };   // (perfect: a guard raised this little before the strike: free, and the foe is stunned)
/** Is a strike from `from` in front of someone at `pos` facing `dir` (flat), within GUARD.angle? */
export function inGuard(pos, dir, from, angle = GUARD.angle) {
  const dx = from.x - pos.x, dz = from.z - pos.z, d = Math.hypot(dx, dz);
  if (d < 1e-4) return true;
  return Math.acos(THREE.MathUtils.clamp((dx * dir.x + dz * dir.z) / (d * Math.hypot(dir.x, dir.z) || 1), -1, 1)) <= angle;
}
/** The blade in the fist, in the hand bone's frame: out of the fist (+z), leaning along the fingers (+y). */
const GRIP = new THREE.Vector3(0, 0.45, 1).normalize();

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
export function lockTarget(from, range = BLADE.lock, targets = allTargets(), locked = null) {
  if (locked?.enabled()) return locked;   // (the lock-on's foe first: src/foes.js)
  let best = null, bd = range;
  for (const t of targets) {
    if (!t.lock || !t.enabled()) continue;
    const p = t.position(), d = Math.hypot(p.x - from.x, p.z - from.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

const _o = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);

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
    // the guard's shield: a lens of the same fluid with a bright rim, over the left forearm
    this.guardK = 0; this.guardT = 0; this.parry = 0;
    this.shield = new THREE.Group();
    this.shield.add(new THREE.Mesh(new THREE.SphereGeometry(GUARD.radius, 24, 12).scale(1, 1, 0.16), tool.globMat));
    this.shield.add(new THREE.Mesh(new THREE.TorusGeometry(GUARD.radius * 0.98, 0.018, 6, 40), makeMaterial({ color: '#fffbea', flat: true, glow: 1, key: 'fluid-blade-edge' })));
    this.shield.visible = false;
    this.shield.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    tool.fx.add(this.shield);
    if (tool.player) tool.player.guard = (from) => this.block(from);
  }

  /** The guard is up (enough to block). */
  get guarding() { return this.guardK > 0.5; }

  /**
   * A strike from `from` (a foe's position): the guard takes it if it is up, the strike comes from in
   * front, and a charge is left to spend. Then the arm takes the blow (the block clip), the shield
   * flashes, and true; else false (it gets through).
   */
  block(from) {
    const T = this.tool, p = T.player;
    if (!p || !this.guarding || !inGuard(p.pos, this.dir, from)) return false;
    const perfect = (this.guardSince ?? 9) < GUARD.perfect;   // raised just in time: it costs nothing
    if (!perfect && !T.reserve.use()) { T.sputter?.(); return false; }
    this.parry = GUARD.parryFor;
    hitStop(0.07); kick(0.35);
    T.used('block', p.pos);
    T.sound?.fluidBlock?.();
    const at = this.shield.position, tones = T.modeTones;
    T.rings?.add({ from: at, dir: this.dir, reach: 0.1, r0: 0.2, r1: 1.1, life: 0.3, color: tones[0], thick: 1 });
    for (let i = 0; i < 18; i++) T.drops?.add({ pos: at, vel: _a.copy(this.dir).multiplyScalar(-2).add(_b.randomDirection().multiplyScalar(3)), drag: 3, grav: 6, size: 0.03, life: 0.4, color: tones[i % tones.length] });
    p.vel?.addScaledVector(this.dir, -2);   // pushed back a step
    if (perfect) { hitStop(0.11); kick(0.5); T.sound?.fluidMode?.('stun'); for (let i = 0; i < 12; i++) T.glow?.add({ pos: at, vel: _a.randomDirection().multiplyScalar(2), drag: 3, size: 0.07, life: 0.5, color: '#fff6dc', grow: true }); }
    return perfect ? 'perfect' : true;
  }

  get swinging() { return this.n >= 0; }

  /** Per frame. press: a fresh press of the blade button; ok: the tool may act (FluidTool.allowed); held: the button is down. */
  update(dt, press, ok, held = false) {
    const T = this.tool, p = T.player;
    this.cool = Math.max(0, this.cool - dt);
    this.chainT = Math.max(0, this.chainT - dt);
    this.parry = Math.max(0, this.parry - dt);
    if (!ok || !p) { this.stop(); this.guardK = 0; this.placeShield(dt); return this.fade(dt); }
    if (press) {
      if (this.swinging) this.queued = this.n < 2;                 // chained: the next swing follows this one
      else if (this.cool === 0) this.start(this.chainT > 0 ? Math.min(this.last + 1, 2) : 0);
    }
    if (this.swinging) {
      this.t += dt / this.dur;
      if (this.special === LUNGE && this.t < this.hitAt) p.vel?.addScaledVector(this.dir, LUNGE.dash * dt * 6);   // (the lunge carries you into the cut)
      if (!this.hit && this.t >= this.hitAt) { this.hit = true; this.strike(); }
      if (this.t >= 1) {
        this.last = this.n; this.n = -1; p.swingMove = null;
        if (this.last === 2) { this.cool = BLADE.cooldown; this.chainT = 0; }
        else { this.chainT = BLADE.chain; if (this.queued) this.start(this.last + 1); }
        this.queued = false;
      }
    }
    // a captured swing: the clip moves the arm (above the legs), the aim pose only turns the body
    if (this.swinging && this.move && T.k < 0.05) {
      const S = this.move, u = Math.min(this.t, 1);
      (p.swingMove ??= {}).clip = S.clip; p.swingMove.t = S.from + u * (S.to - S.from);
      p.swingMove.w = THREE.MathUtils.clamp(Math.min((u + (this.chained ? 0.12 : 0)) / 0.12, (1 - u) / 0.18), 0, 1);
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.dir, 3);
      this.pose.k = 1; this.pose.noArm = true;
      p.aim = this.pose;
    }
    // the arm follows the arc (the tool's aim pose, unless the tool is aiming itself)
    else if (this.swinging && T.k < 0.05) {
      this.pose.noArm = false;
      const U = p.frame.up, F = this.dir, R = _r.crossVectors(F, U).normalize();
      const a = swingArc(this.n, Math.min(this.t, 1));
      const chest = _o.copy(p.pos).addScaledVector(U, 1.35);
      this.point.copy(chest).addScaledVector(F, a.reach).addScaledVector(R, a.side).addScaledVector(U, a.rise);
      this.pose.k = Math.min(1, 0.35 + this.t * 3);
      p.aim = this.pose;
    }
    // the guard: held (LB / L1, Ctrl), up once a swing is done, turned to the locked or the nearest foe
    const want = held && !this.swinging && T.k < 0.05;
    if (want && this.guardK < 0.5) this.guardSince = 0; else this.guardSince = (this.guardSince ?? 9) + dt;
    this.guardK += ((want ? 1 : 0) - this.guardK) * (1 - Math.exp(-(want ? 14 : 10) * dt));
    if (this.guardK < 0.01) this.guardK = 0;
    if (this.guardK > 0 && !this.swinging) {
      this.guardT += dt;
      const foe = lockTarget(p.pos, BLADE.lock, allTargets(), T.lockOn?.() ?? null);
      if (foe) { this.dir.subVectors(foe.position(), p.pos); this.dir.addScaledVector(p.frame.up, -this.dir.dot(p.frame.up)); if (this.dir.lengthSq() > 1e-6) this.dir.normalize(); }
      else if (!want) { /* (easing out: keep the last way) */ }
      else p.frame.dir(p.heading, this.dir);
      const A = p.animator, idle = A?.moveClip?.(GUARD.idle);
      if (idle) {
        const m = (p.swingMove ??= {});
        if (this.parry > 0 && A.moveClip(GUARD.parry)) { m.clip = GUARD.parry; m.t = GUARD.parryFor - this.parry; }
        else { m.clip = GUARD.idle; m.t = this.guardT % idle.duration; }
        m.w = this.guardK;
      }
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.dir, 3);
      this.pose.k = this.guardK; this.pose.noArm = !!idle;
      p.aim = this.pose;
    } else if (!this.swinging && p.swingMove) p.swingMove = null;
    if (!want && this.guardK === 0) this.guardT = 0;
    this.lit += ((this.swinging ? 1 : 0) - this.lit) * (1 - Math.exp(-(this.swinging ? 30 : 9) * dt));
    this.place(dt);
    this.placeShield(dt);
  }

  /** The shield over the left forearm, facing the guard's way, as big as the guard is up (a flash as it blocks). */
  placeShield() {
    const p = this.tool.player, B = p?.humanoid?.b, on = this.guardK > 0.03 && p?.object?.visible !== false;
    this.shield.visible = on;
    if (!on) return;
    const at = B?.hand_l ? B.hand_l.getWorldPosition(_a) : _a.copy(p.pos).addScaledVector(p.frame.up, 1.1);
    if (B?.lowerarm_l) at.lerp(B.lowerarm_l.getWorldPosition(_b), 0.35);
    at.addScaledVector(this.dir, 0.12).addScaledVector(p.frame.up, GUARD.rise);
    this.shield.position.copy(at);
    this.shield.quaternion.setFromUnitVectors(_Z, this.dir);
    this.shield.scale.setScalar(Math.max(0.05, this.guardK) * (1 + (this.parry > 0 ? 0.25 * this.parry / GUARD.parryFor : 0)));
  }

  start(n) {
    const T = this.tool, p = T.player, U = p.frame.up;
    this.chained = this.n >= 0 || this.chainT > 0;
    this.n = n; this.t = 0; this.hit = false;
    // the captured swing if the clip is there, else the arc; grown: the whirl for the third, the lunge from a run
    this.special = !this.chained && n === 0 && p.sprinting && hasUpgrade('lunge', T.state) ? LUNGE : n === 2 && hasUpgrade('whirl', T.state) ? WHIRL : null;
    const S = this.special ?? SWINGS[n], A = p.animator;
    this.move = S && A?.moveClip?.(S.clip) ? S : null;
    this.dur = this.move ? (S.to - S.from) / SWING_SPEED : BLADE.swing;
    this.hitAt = this.move ? (S.hit - S.from) / (S.to - S.from) : BLADE.hitAt;
    // the swing's way: toward the nearest foe in reach, else where the traveller faces
    const foe = lockTarget(p.pos, BLADE.lock, allTargets(), T.lockOn?.() ?? null);
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
    const S = this.special, up = hasUpgrade('reach', T.state) ? REACH_UP : 1;
    const hits = bladeHits(origin, this.dir, T.physics, { reach: (S?.reach ?? BLADE.reach) * up, angle: S?.angle ?? BLADE.angle });
    const info = { ...T.info(), damage: S?.damage ?? BLADE.damage[this.n] ?? 1, combo: S ? 2 : this.n };
    for (const h of hits) h.target.onHit?.('blade', h.point, h.dir, { ...info, mode: 'blade' });
    // wildlife in the cone scatters (it doesn't list the blade: it never feels it, it just runs)
    for (const h of targetsInCone(origin, this.dir, BLADE.reach, BLADE.angle, T.physics)) if (h.target.kind === 'wildlife') h.target.onHit?.('push', h.point, h.dir, info);
    if (hits.length) {
      T.lastHit = 'target';
      hitStop(this.n === 2 ? 0.09 : 0.05); kick(this.n === 2 ? 0.5 : 0.25);   // (the cut lands: src/feel.js)
      for (const h of hits) T.splash(h.point, h.dir.clone().negate(), 0.6);
      p.vel?.addScaledVector(this.dir, 1.2);   // a step into the cut
    }
    T.sound?.fluidSlashHit?.(hits.length > 0);
    return hits;
  }

  stop() { this.n = -1; this.queued = false; if (this.tool.player) this.tool.player.swingMove = null; }

  fade(dt) { this.lit += (0 - this.lit) * (1 - Math.exp(-12 * dt)); this.place(dt); }

  /** The blade from the glove, along the arm (shoulder to hand), lit while it swings; a trail of fluid off its tip. */
  place(dt) {
    const T = this.tool, p = T.player, B = p?.humanoid?.b;
    const on = this.lit > 0.03 && p?.object?.visible !== false;
    this.group.visible = on;
    if (!on) return;
    const hand = T.muzzle(_a);
    let along;
    if (this.move && B?.hand_r) along = _f.copy(GRIP).applyQuaternion(B.hand_r.getWorldQuaternion(_q));   // in the fist, as the capture holds its sword
    else if (B?.upperarm_r) along = _f.subVectors(hand, B.upperarm_r.getWorldPosition(_b)).normalize();
    else along = _f.copy(this.point).sub(hand).normalize();
    // (an arc: lean it a little toward the swing's way, so a cut reads as a cut)
    if (!this.move) along.addScaledVector(this.dir, 0.35).normalize();
    this.group.position.copy(hand);
    this.group.quaternion.copy(_q.setFromUnitVectors(_Y, along));
    this.group.scale.set(1, Math.max(0.05, this.lit) * (hasUpgrade('reach', T.state) ? REACH_UP : 1), 1);
    if (this.swinging && dt > 0) {
      const tip = _b.copy(hand).addScaledVector(along, BLADE.length * this.lit), tones = T.modeTones;
      for (let i = 0; i < 3; i++) T.glow.add({ pos: _o.lerpVectors(hand, tip, 0.45 + i * 0.27), vel: _r.set(0, 0, 0), drag: 6, size: 0.05 + i * 0.015, life: 0.16, color: tones[(this.n + i) % tones.length], grow: false });
    }
  }

  dispose() { this.group.removeFromParent(); this.shield.removeFromParent(); if (this.tool.player?.guard) this.tool.player.guard = null; }
}
