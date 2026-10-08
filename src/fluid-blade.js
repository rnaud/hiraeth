import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { allTargets, targetsInCone } from './targets.js';
import { hitStop, kick } from './feel.js';
import { hasUpgrade } from './ink.js';

// Three committed cuts: anticipation, release and recovery, with one buffered follow-up.
// Full-body captured poses on the ground, upper-body in the air. The blade's swept segment
// deals damage only during release, once per target. Guard and evade have separate inputs.
// A fresh guard can parry without spending fluid; holding guard spends a charge per block.
// Combat movement is applied by Player through the usual ground and collision controller.

export const BLADE = {
  length: 0.85, width: 0.052, guard: 0.1,   // a sword's blade (m), out of a hilt: the grip in the fist, the guard this far up it
  swing: 0.62,          // s a swing takes
  hitAt: 0.5,         // share of the swing when it lands
  chain: 0.45,         // s after a swing in which the next press chains
  reach: 2.9, angle: 1.15,   // the swing's cone: metres from the chest, half-angle (rad, ~65°)
  lock: 6,             // m: the soft lock turns you to a foe this close
  damage: [1, 1, 2],   // the combo's three swings
  cooldown: 0.5,       // after the third swing
};

/**
 * The three swings from motion capture (Mixamo's Sword and Shield pack, in public/anim/moves.glb:
 * scripts/mocap/mixamo-clips.json): source ranges from anticipation through follow-through.
 * attackSample maps explicit phase durations onto the source, accelerating through `hit`. Right to left and down; a rising backhand, left
 * to right; an overhead cut from above the head. Without the clips (not loaded yet) the arcs below.
 */
export const SWINGS = [
  { clip: 'mixamo_ss_slash_1', from: 0.12, to: 1.02, hit: 0.6, wind: 0.22, active: 0.16, recover: 0.24 },
  { clip: 'mixamo_ss_slash_3', from: 0.32, to: 1.35, hit: 0.87, wind: 0.25, active: 0.17, recover: 0.26 },
  { clip: 'mixamo_ss_attack_1', from: 0.55, to: 1.7, hit: 1.15, wind: 0.36, active: 0.2, recover: 0.34 },
];
export const SWING_SPEED = 1; // Legacy consumers; attacks now have authored phase timing.
export const EVADE = { duration: 0.28, cooldown: 0.65, speed: 7.5 };
/** Time within the captured clip: anticipation, fast cut, follow-through. */
export function attackSample(S, elapsed) {
  const wind = S.wind ?? 0.3, active = S.active ?? 0.2, recover = S.recover ?? 0.3;
  const duration = wind + active + recover;
  const a = S.activeFrom ?? S.hit - 0.08, b = S.activeTo ?? S.hit + 0.1;
  const lerp = THREE.MathUtils.lerp, clamp = (v) => THREE.MathUtils.clamp(v, 0, 1);
  const t = elapsed < wind ? lerp(S.from, a, clamp(elapsed / wind)) : elapsed < wind + active
    ? lerp(a, b, clamp((elapsed - wind) / active)) : lerp(b, S.to, clamp((elapsed - wind - active) / recover));
  return { t, duration, wind, active, phase: elapsed < wind ? 'wind' : elapsed < wind + active ? 'strike' : 'recover' };
}
/** Distance to the moving blade, sampled between consecutive poses to avoid tunnelling. */
export function sweptBladeTouches(point, radius, before, after) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), nearest = new THREE.Vector3();
  const line = new THREE.Line3(a, b);
  const steps = Math.max(1, Math.ceil(Math.max(before.a.distanceTo(after.a), before.b.distanceTo(after.b)) / 0.1));
  for (let i = 0; i <= steps; i++) {
    a.lerpVectors(before.a, after.a, i / steps); b.lerpVectors(before.b, after.b, i / steps);
    line.closestPointToPoint(point, true, nearest);
    if (nearest.distanceToSquared(point) <= radius * radius) return true;
  }
  return false;
}
/** The blade's grown moves (src/ink.js): the whirl replaces the third swing and cuts all round; the lunge is a swing begun at a run. */
export const WHIRL = { clip: 'mixamo_gs_high_spin', from: 0.55, to: 1.45, hit: 1.06, activeFrom: 0.65, activeTo: 1.38, wind: 0.25, active: 0.42, recover: 0.28, angle: Math.PI, damage: 2 };
export const LUNGE = { clip: 'mixamo_gs_slide_attack', from: 0.0, to: 0.9, hit: 0.5, dash: 9, damage: 2, reach: 3.6 };
/** The reach step: the blade this much longer, its swing this much further. */
export const REACH_UP = 1.3;
/** The guard: the clips (block idle held round and round, the block played as a strike lands), how wide it covers, and the shield. */
export const GUARD = { idle: 'mixamo_ss_block_idle', parry: 'mixamo_ss_block_1', parryFor: 0.55, angle: 1.3, rise: 0.12, radius: 0.5, perfect: 0.18, rearm: 0.35 };
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
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _e3 = new THREE.Vector3(), _mx = new THREE.Matrix4();

export class FluidBlade {
  constructor(tool) {
    this.tool = tool;
    this.n = -1; this.t = 0; this.chainT = 0; this.cool = 0; this.lit = 0; this.hit = false; this.queued = false;
    this.point = new THREE.Vector3(); this.dir = new THREE.Vector3(0, 0, 1); this.pose = { k: 0, point: this.point, dir: this.dir };
    // a sword: a flat, two-edged blade of the tank's fluid (the glob's lava in its tones) tapering to a point,
    // its two edges bright (glowing: the bloom draws its halo), out of a hilt: a brass guard, a wrapped grip in
    // the fist, a brass pommel. The blade grows out of the guard as it lights; the trail's drops follow its tip
    const L = BLADE.length, W = BLADE.width, tip = W * 2.2;
    const outline = new THREE.Shape().moveTo(-W / 2, 0).lineTo(W / 2, 0).lineTo(W / 2 * 0.86, L - tip).lineTo(0, L).lineTo(-W / 2 * 0.86, L - tip).lineTo(-W / 2, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(outline, { depth: 0.002, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 1, curveSegments: 1 }).translate(0, 0, -0.001);
    const edgeMat = makeMaterial({ color: '#fffbea', flat: true, glow: 1, key: 'fluid-blade-edge' });
    this.core = new THREE.Mesh(bladeGeo, tool.globMat);
    this.edges = [-1, 1].map((s) => {
      const len = Math.hypot(L - tip, W * 0.07), e = new THREE.Mesh(new THREE.BoxGeometry(0.005, len, 0.004).translate(0, len / 2, 0), edgeMat);
      e.position.set(s * W / 2 * 0.98, 0, 0); e.rotation.z = s * Math.atan2(W / 2 * 0.14, L - tip); return e;
    });
    const tipEdges = [-1, 1].map((s) => { const len = Math.hypot(tip, W / 2 * 0.86), e = new THREE.Mesh(new THREE.BoxGeometry(0.005, len, 0.004).translate(0, len / 2, 0), edgeMat); e.position.set(s * W / 2 * 0.86, L - tip, 0); e.rotation.z = s * Math.atan2(W / 2 * 0.86, tip); return e; });
    this.bladeGroup = new THREE.Group();
    this.bladeGroup.position.y = BLADE.guard + 0.012;
    this.bladeGroup.add(this.core, ...this.edges, ...tipEdges);
    const brass = makeMaterial({ color: '#c99a46', metal: 'brass', key: 'fluid-blade-brass' }), wrap = makeMaterial({ color: '#3a2a22', flat: true, key: 'fluid-blade-grip' });
    this.hilt = new THREE.Group();
    this.hilt.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.022, 0.034).translate(0, BLADE.guard, 0), brass));          // the guard
    this.hilt.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.16, 8).translate(0, 0.01, 0), wrap));       // the grip, in the fist
    this.hilt.add(new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6).translate(0, -0.08, 0), brass));                   // the pommel
    this.group = new THREE.Group();
    this.group.add(this.bladeGroup, this.hilt);
    this.group.visible = false;
    this.group.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    tool.fx.add(this.group);
    // the guard's shield: a lens of the same fluid with a bright rim, over the left forearm
    this.guardK = 0; this.guardT = 0; this.parry = 0;
    this.guardHeld = false; this.guardAge = Infinity; this.guardRearm = 0; this.perfectReady = false;
    this.evadeHeld = false; this.evadeT = 0; this.evadeCool = 0; this.evadeDir = new THREE.Vector3();
    this.hitTargets = new Set(); this.previousBlade = null;
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
    const perfect = this.perfectReady && this.guardAge <= GUARD.perfect;
    if (!perfect && !T.reserve.use()) { T.sputter?.(); return false; }
    p.perfectBlock = perfect; this.perfectReady = false;
    this.guardRearm = GUARD.rearm;
    this.parry = GUARD.parryFor;
    hitStop(perfect ? 0.14 : 0.07); kick(perfect ? 0.5 : 0.14);
    T.used('block', p.pos);
    T.sound?.fluidBlock?.(perfect);
    const at = this.shield.position, tones = T.modeTones;
    T.rings?.add({ from: at, dir: this.dir, reach: 0.1, r0: 0.2, r1: 1.1, life: 0.3, color: tones[0], thick: 1 });
    for (let i = 0; i < 18; i++) T.drops?.add({ pos: at, vel: _a.copy(this.dir).multiplyScalar(-2).add(_b.randomDirection().multiplyScalar(3)), drag: 3, grav: 6, size: 0.03, life: 0.4, color: tones[i % tones.length] });
    p.vel?.addScaledVector(this.dir, -2);   // pushed back a step
    if (perfect) { T.sound?.fluidMode?.('stun'); for (let i = 0; i < 12; i++) T.glow?.add({ pos: at, vel: _a.randomDirection().multiplyScalar(2), drag: 3, size: 0.07, life: 0.5, color: '#fff6dc', grow: true }); }
    return perfect ? 'perfect' : true;
  }

  get swinging() { return this.n >= 0; }

  /** Per frame. press: a fresh press of the blade button; ok: the tool may act (FluidTool.allowed); held: the button is down. */
  update(dt, press, ok, held = false, evade = false) {
    const T = this.tool, p = T.player;
    this.cool = Math.max(0, this.cool - dt);
    this.evadeCool = Math.max(0, this.evadeCool - dt);
    this.evadeT = Math.max(0, this.evadeT - dt);
    this.guardRearm = Math.max(0, this.guardRearm - dt);
    this.guardAge += dt;
    if (held && !this.guardHeld) { this.guardAge = 0; this.perfectReady = this.guardRearm === 0; this.guardRearm = GUARD.rearm; }
    if (!held) this.perfectReady = false;
    this.guardHeld = held;
    const dodgePress = evade && !this.evadeHeld; this.evadeHeld = evade;
    if (ok && dodgePress && !this.evadeT && !this.evadeCool && p?.onGround && (!this.swinging || this.phase === 'recover')) {
      this.stop(); this.evadeT = EVADE.duration; this.evadeCool = EVADE.cooldown;
      if (p._moveDir?.lengthSq() > 0.01) this.evadeDir.copy(p._moveDir);
      else p.frame.dir(p.heading, this.evadeDir).negate();
      p.frame.dir(p.heading, this.dir);
      const target = lockTarget(p.pos);
      if (target) {
        _a.subVectors(target.position(), p.pos); _a.addScaledVector(p.frame.up, -_a.dot(p.frame.up));
        if (_a.lengthSq() > 1e-6) this.dir.copy(_a).normalize();
      }
      this.guardK = 0;
    }
    if (held) this.queued = false;
    if (p) p.combatMotion = null;
    this.chainT = Math.max(0, this.chainT - dt);
    this.parry = Math.max(0, this.parry - dt);
    if (!ok || !p) { this.stop(); this.evadeT = 0; this.guardK = 0; this.placeShield(dt); return this.fade(dt); }
    if (press && !held && !this.evadeT) {
      if (this.swinging) this.queued = this.n < 2;                 // chained: the next swing follows this one
      else if (this.cool === 0) this.start(this.chainT > 0 ? Math.min(this.last + 1, 2) : 0);
    }
    if (this.swinging) {
      const previousTime = this.t * this.dur;
      this.t += dt / this.dur;
      this.sample = attackSample(this.spec, this.t * this.dur);
      this.phase = this.sample.phase;
      if (!this.released && this.t * this.dur >= this.sample.wind) { this.released = true; T.sound?.fluidSlash?.(this.n); }
      // Player poses before the tool updates. Use the source time actually displayed, not
      // the next requested pose, so damage follows the visible hand even on a long frame.
      if (this.move) {
        const displayed = p.swingMove?.id === this.swingId ? p.swingMove.t : null;
        const from = this.spec.activeFrom ?? this.spec.hit - 0.08, to = this.spec.activeTo ?? this.spec.hit + 0.1;
        if (displayed !== null && displayed >= from && (this.contactT ?? displayed) <= to) this.strike();
        this.contactT = displayed;
      } else if (this.t * this.dur >= this.sample.wind && previousTime < this.sample.wind + this.sample.active) this.strike();
      if (this.t >= 1) {
        this.last = this.n; this.n = -1; p.swingMove = null;
        if (this.last === 2) { this.cool = BLADE.cooldown; this.chainT = 0; }
        else { this.chainT = BLADE.chain; if (this.queued) this.start(this.last + 1); }
        this.queued = false;
      }
    }
    // A captured swing poses the whole grounded body; the aim layer only turns toward the target.
    if (this.swinging && this.move && T.k < 0.05) {
      const S = this.move, u = Math.min(this.t, 1);
      (p.swingMove ??= {}).clip = S.clip; p.swingMove.t = this.sample.t;
      p.swingMove.full = !!p.onGround; p.swingMove.id = this.swingId;
      p.swingMove.w = THREE.MathUtils.clamp(Math.min(u * this.dur / 0.07, (1 - u) * this.dur / 0.12), 0, 1);
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
    // the guard: held after the swing (or with no swing to finish), turned to the nearest foe
    const want = held && !this.swinging && !this.evadeT && T.k < 0.05;
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
        m.w = this.guardK; m.full = false; m.id = this.parry > 0 ? "block" : "guard";
      }
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.dir, 3);
      this.pose.k = this.guardK; this.pose.noArm = !!idle;
      p.aim = this.pose;
    } else if (!this.swinging && p.swingMove) p.swingMove = null;
    if (!want && this.guardK === 0) this.guardT = 0;
    this.lit += ((this.swinging ? 1 : 0) - this.lit) * (1 - Math.exp(-(this.swinging ? 30 : 9) * dt));
    if (this.evadeT && p.onGround) {
      this.point.copy(p.pos).addScaledVector(p.frame.up, 1.3).addScaledVector(this.dir, 3);
      this.pose.k = 1; this.pose.noArm = true; p.aim = this.pose;
      p.combatMotion = { dir: this.evadeDir, speed: EVADE.speed * (0.55 + 0.45 * Math.sin(Math.PI * this.evadeT / EVADE.duration)), scale: 0, evade: this.evadeT / EVADE.duration };
    } else if (this.swinging && p.onGround) {
      const active = this.phase === 'strike';
      p.combatMotion = { dir: this.dir, speed: active ? (this.special === LUNGE ? 7 : 1.7) : 0, scale: this.phase === 'recover' ? 0.45 : 0.15 };
    }
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
    this.n = n; this.t = 0; this.hit = false; this.released = false; this.phase = "wind"; this.swingId = (this.swingId ?? 0) + 1; this.hitTargets.clear(); this.previousBlade = null; this.contactT = null;
    // the captured swing if the clip is there, else the arc; grown: the whirl for the third, the lunge from a run
    // (the lunge: a swing begun at a run, or locked on and closing in fast)
    const closing = p.lockOn && p.vel && p.vel.dot(p.lockOn.dir) > 2.5;
    this.special = !this.chained && n === 0 && (p.sprinting || closing) && hasUpgrade('lunge', T.state) ? LUNGE : n === 2 && hasUpgrade('whirl', T.state) ? WHIRL : null;
    const S = this.special ?? SWINGS[n], A = p.animator;
    this.move = S && A?.moveClip?.(S.clip) ? S : null;
    this.spec = S; this.sample = attackSample(S, 0); this.dur = this.sample.duration;
    this.hitAt = (this.sample.wind + this.sample.active * 0.45) / this.dur;
    // the swing's way: toward the nearest foe in reach, else where the traveller faces
    const foe = lockTarget(p.pos, BLADE.lock, allTargets(), T.lockOn?.() ?? null);
    if (foe) this.dir.subVectors(foe.position(), p.pos); else p.frame.dir(p.heading, this.dir);
    this.dir.addScaledVector(U, -this.dir.dot(U));
    if (this.dir.lengthSq() < 1e-6) p.frame.dir(p.heading, this.dir);
    this.dir.normalize();
    T.used('blade', p.pos);
  }

  /** The active cut: coarse range/occlusion first, then the actual swept blade. */
  strike() {
    const T = this.tool, p = T.player, U = p.frame.up;
    const origin = _o.copy(p.pos).addScaledVector(U, 1.1);
    const S = this.special, up = hasUpgrade('reach', T.state) ? REACH_UP : 1;
    let hits = bladeHits(origin, this.dir, T.physics, { reach: (S?.reach ?? BLADE.reach) * up, angle: S?.angle ?? BLADE.angle });
    const pose = this.bladeSegment();
    if (pose) hits = hits.filter((h) => sweptBladeTouches(h.target.position(), (h.target.radius ?? 0.5) + 0.12, this.previousBlade ?? pose, pose));
    hits = hits.filter((h) => !this.hitTargets.has(h.target));
    for (const h of hits) this.hitTargets.add(h.target);
    const info = { ...T.info(), damage: S?.damage ?? BLADE.damage[this.n] ?? 1, combo: S ? 2 : this.n };
    for (const h of hits) h.target.onHit?.('blade', h.point, h.dir, { ...info, mode: 'blade' });
    // wildlife in the cone scatters (it doesn't list the blade: it never feels it, it just runs)
    for (const h of targetsInCone(origin, this.dir, BLADE.reach, BLADE.angle, T.physics)) if (h.target.kind === 'wildlife' && !this.hitTargets.has(h.target)) { this.hitTargets.add(h.target); h.target.onHit?.('push', h.point, h.dir, info); }
    if (hits.length) {
      T.lastHit = 'target';
      hitStop(this.n === 2 || this.special ? 0.11 : 0.06); kick(this.n === 2 || this.special ? 0.5 : 0.25);   // (the cut lands: the frame freezes, src/feel.js)
      for (const h of hits) T.splash(h.point, h.dir.clone().negate(), 0.6);
      this.hit = true;
    }
    T.sound?.fluidSlashHit?.(hits.length > 0, info.combo === 2);
    return hits;
  }

  bladeSegment() {
    const p = this.tool.player, hand = p?.humanoid?.b?.hand_r;
    if (!hand || !this.move) return null;
    const a = this.tool.muzzle(new THREE.Vector3());
    const along = GRIP.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()));
    const length = BLADE.length * (hasUpgrade('reach', this.tool.state) ? REACH_UP : 1);
    a.addScaledVector(along, BLADE.guard + 0.012);
    return { a, b: a.clone().addScaledVector(along, length * Math.max(0.05, this.lit)) };
  }

  stop() { if (this.tool.player) this.tool.player.combatMotion = null; this.n = -1; this.queued = false; if (this.tool.player) this.tool.player.swingMove = null; }

  fade(dt) { this.lit += (0 - this.lit) * (1 - Math.exp(-12 * dt)); this.place(dt); }

  /** The blade from the glove, along the arm (shoulder to hand), lit while it swings; a trail of fluid off its tip. */
  place(dt) {
    this.previousBlade = this.bladeSegment();
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
    // the flat blade turned so its edge leads the cut: its width along the way the hand is moving
    const mv = _e1.subVectors(hand, this._lastHand ?? hand);
    (this._lastHand ??= new THREE.Vector3()).copy(hand);
    mv.addScaledVector(along, -mv.dot(along));
    if (mv.lengthSq() > 1e-7) (this._edge ??= new THREE.Vector3()).copy(mv).normalize();
    else if (!this._edge || Math.abs(this._edge.dot(along)) > 0.9) (this._edge ??= new THREE.Vector3()).copy(Math.abs(along.y) < 0.9 ? _Y : _Z).cross(along).normalize();
    const ex = _e2.copy(this._edge).addScaledVector(along, -this._edge.dot(along)).normalize(), ez = _e3.crossVectors(ex, along);
    this.group.quaternion.setFromRotationMatrix(_mx.makeBasis(ex, along, ez));
    this.group.scale.setScalar(1);
    this.bladeGroup.scale.set(1, Math.max(0.05, this.lit) * (hasUpgrade('reach', T.state) ? REACH_UP : 1), 1);   // (the blade grows out of the guard as it lights)
    if (this.swinging && dt > 0) {
      const tip = _b.copy(hand).addScaledVector(along, (BLADE.guard + BLADE.length) * this.lit), tones = T.modeTones;
      // a fine trail: small sparks along the edge, gone in a blink (the blade itself carries the look)
      for (let i = 0; i < 4; i++) T.glow.add({ pos: _o.lerpVectors(hand, tip, 0.35 + i * 0.21), vel: _r.set(0, 0, 0), drag: 8, size: 0.012 + i * 0.004, life: 0.09, color: tones[(this.n + i) % tones.length], grow: false });
    }
  }

  dispose() { this.group.removeFromParent(); this.shield.removeFromParent(); if (this.tool.player?.guard) this.tool.player.guard = null; }
}
