import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';

// The thing at the heart of every temple. The makers were gentle: what waits
// in their temples was left to keep them. Two kinds:
//
//   organic   a guardian the makers left that has grown wild, or afraid. It is never hurt: its meter
//             is CALM, which rises as you soothe it (light, water, a hand…) and falls a little when you
//             frighten it (a push). Full, it settles, and the temple is resolved. On the screen its bar
//             is its UNREST, full at the start and going down as it calms (guardianBar).
//   robot     a broken sentinel. Its meter is DAMAGE: you may break it (shots at its open vents, its
//             core), or switch it off. On the screen its bar is its HEALTH, full at the start and going
//             down with each blow (guardianBar), as a boss's bar does.
//
// Either way it fights the same: it moves about its arena and attacks in a loop, each attack
// telegraphed on the floor first (a disc, a fan or a lane that fills, inked in warning colours),
// then struck. A strike that catches you knocks you down (the ragdoll, src/ragdoll.js) and takes a
// bite of the health bar, but never the last of it from a healthy bar: only when you are already
// low does it knock you out, and then you wake at the temple's mark outside the arena and it is
// back where its current phase began. After some attacks it is open for a moment (it pants, its
// vents open): that is when soothing (or a shot) counts.
//
//   const g = new Guardian(rt, { def, model, arena: { center, r, y } });
//   g.update(dt, t)   per frame (the runtime; wakes it when you step into the arena)
//   g.add(k, why)     the meter, within the current phase (def.phases)
//   g.state           'sleep' | 'wake' | 'fight' | 'open' | 'weary' | 'resolved'
//
// def: { kind, name, phases: [{ to: 0.4, attacks: ['stamp', …], hint, openHint? (this phase's, else def.openHint) }],
//        attacks: { id: { shape: 'ring' | 'cone' | 'lane', at: 'player' | 'self', radius, range, angle,
//                          width, telegraph: s, damage: 0..1, knock: m/s, open?: s (vulnerable after),
//                          recover: s } },
//        onHit(g, part ('mouth' | 'body' | 'vent'), mode, info) -> handled, final: 'touch' | 'break',
//        touch: 'prompt', wake: text, weary: text, resolved: text }
// model: { group, pos (Vector3 on the floor), heading, mouth (Vector3), radius, height,
//          animate(dt, t, { state, attack, k, speed, meter }) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _a = V(), _b = V();
let uid = 0;

/**
 * The guardian's bar on the screen (src/temples/runtime.js meterHud): what is left of it, full at the
 * start and going down: a machine's health, a living guardian's unrest (it is calmed, never hurt).
 * { label, fill 0..1, color }.
 */
export function guardianBar(def, meter) {
  const robot = def?.kind === 'robot';
  const fill = THREE.MathUtils.clamp(1 - (meter ?? 0), 0, 1);
  return { label: `${def?.name ?? ''} · ${robot ? 'health' : 'unrest'}`, fill, color: robot ? '#d9503f' : '#f0a04b' };
}

/** Strikes never empty a healthy bar: what is left after a hit, at least. */
export const HIT = { floor: 0.08, low: 0.22, airborne: 1.3 };

/** The damage a strike does to a bar at `health`: the full bite when low, else capped to leave HIT.floor. */
export function strikeDamage(health, damage) {
  if (health <= HIT.low) return damage;   // already low: this one can knock you out
  return Math.min(damage, Math.max(0, health - HIT.floor));
}

/** Is point p (the traveller's feet) inside an attack's area? shape at origin o, facing heading h. */
export function inArea(a, o, h, p) {
  const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
  if (a.shape === 'ring') return d < (a.radius ?? 4);
  if (a.shape === 'cone') {
    if (d > (a.range ?? 12) || d < 0.01) return d < 0.01;
    const da = Math.atan2(Math.sin(Math.atan2(dx, dz) - h), Math.cos(Math.atan2(dx, dz) - h));
    return Math.abs(da) < (a.angle ?? 0.6);
  }
  if (a.shape === 'lane') {
    const f = [Math.sin(h), Math.cos(h)], along = dx * f[0] + dz * f[1], side = Math.abs(dx * f[1] - dz * f[0]);
    return along > -1 && along < (a.range ?? 20) && side < (a.width ?? 2.4) / 2;
  }
  return false;
}

/** The warning drawn on the floor before a strike: a fill that grows, inside an outline that pulses. */
export class Telegraph {
  constructor(parent, color) {
    this.fillM = makeMaterial({ color, glow: 0.7, flat: true, side: THREE.DoubleSide, key: `tele.fill.${uid++}` });
    this.edgeM = makeMaterial({ color: '#2b211f', flat: true, side: THREE.DoubleSide, key: `tele.edge.${uid++}` });
    this.group = new THREE.Group();
    this.fill = new THREE.Mesh(new THREE.BufferGeometry(), this.fillM);
    this.edge = new THREE.Mesh(new THREE.BufferGeometry(), this.edgeM);
    this.group.add(this.fill, this.edge);
    this.group.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
    this.group.visible = false;
    parent.add(this.group);
    this.shape = null;
  }
  show(a, o, h, y) {
    if (this.shape !== a) {
      this.shape = a;
      this.fill.geometry.dispose(); this.edge.geometry.dispose();
      if (a.shape === 'ring') {
        this.fill.geometry = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
        this.edge.geometry = new THREE.RingGeometry(0.93, 1.0, 48).rotateX(-Math.PI / 2);
      } else if (a.shape === 'cone') {
        const an = a.angle ?? 0.6;
        // (theta from +x toward -z after the flat turn; start so the fan's middle is along +z)
        this.fill.geometry = new THREE.CircleGeometry(1, 24, Math.PI / 2 - an, 2 * an).rotateX(Math.PI / 2);
        this.edge.geometry = new THREE.RingGeometry(0.95, 1.0, 24, 1, Math.PI / 2 - an, 2 * an).rotateX(Math.PI / 2);
      } else {
        this.fill.geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2);
        this.edge.geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2).scale(1.08, 1, 1.02).translate(0, -0.004, 0);
      }
    }
    this.group.position.set(o.x, y + 0.07, o.z);
    this.group.rotation.y = a.shape === 'ring' ? 0 : h;
    const R = a.shape === 'ring' ? a.radius ?? 4 : a.range ?? 12;
    if (a.shape === 'lane') this.group.scale.set(a.width ?? 2.4, 1, R); else this.group.scale.set(R, 1, R);
    this.group.visible = true;
  }
  set(k, t) {
    // the fill grows out from the middle (or along the fan, the lane) as the strike comes
    const s = Math.max(0.02, k);
    if (this.shape?.shape === 'lane') this.fill.scale.set(1, 1, s); else this.fill.scale.set(s, 1, s);
    this.fill.position.y = 0.01;
    this.fillM.uniforms.uGlow.value = 0.35 + 0.5 * k + 0.15 * Math.sin(t * 22);
  }
  hide() { this.group.visible = false; }
}

export class Guardian {
  /**
   * @param rt     the temple runtime (player, sound, notice, root, rumble, logic)
   * @param o      { def, model, arena: { center: Vector3 (the floor's middle), r, y } }
   */
  constructor(rt, { def, model, arena }) {
    this.rt = rt; this.def = def; this.model = model; this.arena = arena;
    this.meter = 0;
    this.floor = 0;     // the meter's floor (the current phase's start: where it comes back to)
    this.state = rt.logic.resolved ? 'resolved' : 'sleep';
    this.t = 0;         // time in the state
    this.attack = null; this.attackAt = V(); this.attackH = 0;
    this.cool = 2.5;
    this.order = 0;
    this.tele = new Telegraph(rt.root, def.kind === 'robot' ? '#e0644a' : '#f0a04b');
    this.solid = { pos: model.pos, r: model.radius ?? 2.6, top: 0, bottom: 0, vel: V() };
    this.prev = model.pos.clone();
    this.offs = [];
    const fighting = () => this.state === 'fight' || this.state === 'open';
    this.offs.push(registerTarget({ kind: def.kind === 'robot' ? 'sentinel' : 'guardian', radius: model.mouthR ?? 1.2, accepts: ['fire', 'stun'],
      position: () => model.mouth, enabled: () => fighting() || this.state === 'weary',
      onHit: (mode, point, dir, info) => this.hit('mouth', mode, dir, info) }));
    this.offs.push(registerTarget({ kind: def.kind === 'robot' ? 'sentinel' : 'guardian', radius: model.bodyR ?? (model.radius ?? 2.6) * 0.75, accepts: ['fire', 'stun'],
      position: () => (this._body ??= V()).copy(model.pos).addScaledVector(UP, model.floats ? 0 : (model.height ?? 3) * 0.5), enabled: () => fighting(),
      // (a glob that lands on the body close to the mouth counts as the mouth: the two overlap at the neck)
      onHit: (mode, point, dir, info) => this.hit(point && point.distanceTo(model.mouth) < (model.mouthR ?? 1.2) * 1.8 ? 'mouth' : 'body', mode, dir, info) }));
    if (def.final === 'touch') {
      this.offs.push(registerInteractable({
        id: `temple.${rt.def.id}.touch`, priority: PRIORITY.use + 2, range: 3.4, prompt: def.touch ?? 'lay a hand on it',
        at: () => (this._ta ??= V()).copy(model.mouth).addScaledVector(UP, 0.8),
        enabled: () => this.state === 'weary',
        // (from the edge of what you can reach: a big round body keeps you further off: model.touchR)
        distance: (p) => Math.max(0, Math.hypot(p.pos.x - model.mouth.x, p.pos.z - model.mouth.z) - (model.touchR ?? 0)),
        use: () => this.resolve(),
      }));
    }
    this.place();
  }

  get phaseIndex() { const P = this.def.phases; for (let i = 0; i < P.length; i++) if (this.meter < P[i].to - 1e-6) return i; return P.length; }
  get phase() { return this.def.phases[Math.min(this.phaseIndex, this.def.phases.length - 1)]; }
  get awake() { return this.state !== 'sleep' && this.state !== 'resolved'; }

  /** Raise (or lower) the meter, inside the current phase: a phase's end is reached only from within it. */
  add(k, why = '') {
    if (!this.awake || this.state === 'weary') return false;
    const i = this.phaseIndex, P = this.def.phases;
    const lo = i > 0 ? P[i - 1].to : 0, hi = P[Math.min(i, P.length - 1)].to;
    const before = this.meter;
    this.meter = THREE.MathUtils.clamp(this.meter + k, Math.max(lo, this.floor), hi);
    if (this.meter >= hi - 1e-6 && before < hi - 1e-6) this.phaseDone(i);
    this.def.onMeter?.(this, this.meter, why);
    return this.meter !== before;
  }
  phaseDone(i) {
    this.floor = this.def.phases[i].to;
    const last = i >= this.def.phases.length - 1;
    const P = this.def.phases[i + 1];
    if (last || P?.weary) {
      this.enter('weary');
      this.rt.notice?.(this.def.weary);
      if (this.def.final !== 'touch' && last) this.resolve();
    } else {
      this.rt.notice?.(P?.hint);
      this.attack = null; this.tele.hide(); this.cool = 2.2;
      this.rt.rumble?.(1.2, 0.4);
    }
  }
  enter(state) { this.state = state; this.t = 0; }
  hit(part, mode, dir, info) {
    if (this.def.onHit?.(this, part, mode, info, dir)) return true;
    if (mode === 'stun' && this.attack && this.state === 'fight') {
      // the stilling lens stops a strike before it lands
      this.attack = null; this.tele.hide(); this.cool = 2.5;
      this.rt.notice?.('It stops, stilled, mid-strike.', 'boss.stun');
    }
    return true;
  }
  wake() {
    if (this.state !== 'sleep') return;
    this.enter('wake');
    this.rt.notice?.(this.def.wake);
    this.rt.rumble?.(2.6, 0.6);
    this.rt.onBossWake?.(this);
  }
  /** Knocked out in the fight: back to sleep, the meter where this phase began. */
  reset() {
    if (this.state === 'resolved') return;
    this.meter = this.floor;
    this.attack = null; this.tele.hide();
    this.enter('sleep');
    this.cool = 2.5;
    this.model.pos.copy(this.model.home ?? this.arena.center);
    this.def.onReset?.(this);
  }
  resolve() {
    if (this.state === 'resolved') return;
    this.meter = 1;
    this.attack = null; this.tele.hide();
    this.enter('resolved');
    this.rt.notice?.(this.def.resolved);
    this.rt.onBossResolved?.(this);
  }

  place() {
    const m = this.model;
    // on the floor under it (the cistern's basin is a little lower than its rim)
    const ph = this.rt.physics;
    if (m.floats) {
      // it swims in the air of its hall: its body (centred on pos) at the arena's height plus its hover
      m.pos.y = this.arena.y + (m.hover ?? 5);
      this.solid.pos = m.pos;
      this.solid.bottom = m.pos.y - (m.height ?? 3) / 2; this.solid.top = m.pos.y + (m.height ?? 3) / 2;
    } else {
      if (ph) { const g = ph.groundAt(m.pos.x, this.arena.y + 2.5, m.pos.z, 6); if (Number.isFinite(g)) m.pos.y = Math.max(this.arena.y - 2, g); }
      this.solid.pos = m.pos;
      this.solid.bottom = m.pos.y; this.solid.top = m.pos.y + (m.height ?? 3);
    }
    m.group.position.copy(m.pos);
    m.group.rotation.y = m.heading;
  }

  /** Walk toward `to` (on the floor), turning; returns the speed. */
  walk(dt, to, speed = 2.2, keep = 0) {
    const m = this.model, A = this.arena;
    _a.subVectors(to, m.pos).setY(0);
    const d = _a.length();
    let sp = 0;
    if (d > keep + 0.3) {
      _a.normalize();
      const want = Math.atan2(_a.x, _a.z);
      m.heading += Math.atan2(Math.sin(want - m.heading), Math.cos(want - m.heading)) * Math.min(1, dt * 2.5);
      sp = Math.min(speed, (d - keep) * 2);
      m.pos.x += Math.sin(m.heading) * sp * dt; m.pos.z += Math.cos(m.heading) * sp * dt;
    }
    // inside the arena
    _b.subVectors(m.pos, A.center).setY(0);
    const r = A.r - (m.radius ?? 2.6) - 1;
    if (_b.length() > r) { _b.setLength(r); m.pos.x = A.center.x + _b.x; m.pos.z = A.center.z + _b.z; }
    return sp;
  }
  face(dt, p, rate = 4) {
    const m = this.model, want = Math.atan2(p.x - m.pos.x, p.z - m.pos.z);
    m.heading += Math.atan2(Math.sin(want - m.heading), Math.cos(want - m.heading)) * Math.min(1, dt * rate);
  }

  update(dt, t) {
    const P = this.rt.player, m = this.model, A = this.arena;
    this.t += dt;
    let speed = 0;
    const inArena = P && Math.hypot(P.pos.x - A.center.x, P.pos.z - A.center.z) < A.r - 1.5 && Math.abs(P.pos.y - A.y) < 6;
    if (this.state === 'sleep' && inArena && !P.dead) this.wake();
    if (this.state === 'wake' && this.t > (this.def.wakeTime ?? 3)) { this.enter('fight'); this.rt.notice?.(this.def.phases[0].hint); }
    if (this.state === 'fight' || this.state === 'open') speed = this.fight(dt, t, P);
    if (this.state === 'open' && this.t > (this.openFor ?? 2.5)) this.enter('fight');
    if (this.state === 'weary' || this.state === 'resolved') {
      speed = this.walk(dt, m.rest ?? A.center, 1.8, 0.2);
      if (speed < 0.1 && m.restHeading !== undefined) m.heading += Math.atan2(Math.sin(m.restHeading - m.heading), Math.cos(m.restHeading - m.heading)) * Math.min(1, dt);
    }
    this.place();
    this.solid.vel.subVectors(m.pos, this.prev).divideScalar(Math.max(dt, 1e-4));
    this.prev.copy(m.pos);
    m.animate(dt, t, { state: this.state, attack: this.attack, k: this.attackK ?? 0, speed, meter: this.meter, phase: this.phaseIndex });
  }

  fight(dt, t, P) {
    const m = this.model, A = this.arena;
    if (!P) return 0;
    let speed = 0;
    if (this.attack) {
      const a = this.attack;
      this.at += dt;
      if (this.at < a.telegraph) {
        // the wind-up: it turns to its mark (a ring follows you for a moment, then holds)
        if (a.at === 'player' && this.at < a.telegraph * (a.track ?? 0.45)) this.attackAt.set(P.pos.x, A.y, P.pos.z);
        if (a.at === 'self') this.attackAt.copy(m.pos);
        if (a.shape !== 'ring') { this.face(dt, P.pos, 5); this.attackH = m.heading; this.attackAt.copy(m.pos); }
        this.attackK = this.at / a.telegraph;
        this.tele.show(a, this.attackAt, this.attackH, A.y);
        this.tele.set(this.attackK, t);
      } else if (!this.struck) {
        this.struck = true;
        this.attackK = 1;
        this.strike(a, P);
      } else if (this.at > a.telegraph + (a.recover ?? 0.8)) {
        this.tele.hide();
        // (said once a phase: a later phase's opening may differ, the warden's crown vent: phase.openHint)
        if (a.open) { this.enter('open'); this.openFor = a.open; this.rt.notice?.(this.phase.openHint ?? this.def.openHint, `open.${this.phaseIndex}`); }
        this.attack = null;
        this.cool = this.phase.pause ?? 1.6;
      } else this.tele.set(1, t);
      return 0;
    }
    if (this.state === 'open') { this.face(dt, P.pos, 1.5); return 0; }
    // between attacks: keep a little distance from you, and circle
    const ang = Math.atan2(P.pos.x - A.center.x, P.pos.z - A.center.z) + Math.sin(t * 0.3) * 0.8;
    const want = _b.set(A.center.x + Math.sin(ang) * A.r * 0.35, A.y, A.center.z + Math.cos(ang) * A.r * 0.35);
    speed = this.walk(dt, want, this.def.speed ?? 2.4, 1);
    if (speed < 0.2) this.face(dt, P.pos, 2);
    this.cool -= dt;
    if (this.cool <= 0 && !P.dead) this.begin(P);
    return speed;
  }
  begin(P) {
    const list = this.phase.attacks;
    if (!list?.length) return;
    // the next attack: in turn, but one that reaches you (a fan only when you are near it)
    const d = Math.hypot(P.pos.x - this.model.pos.x, P.pos.z - this.model.pos.z);
    let id = list[this.order++ % list.length];
    const a0 = this.def.attacks[id];
    if (a0.shape === 'cone' && d > (a0.range ?? 12) * 0.9) id = list.find((x) => this.def.attacks[x].at === 'player') ?? id;
    const a = { id, ...this.def.attacks[id] };
    this.attack = a; this.at = 0; this.struck = false; this.attackK = 0;
    this.attackAt.set(P.pos.x, this.arena.y, P.pos.z);
    this.attackH = this.model.heading;
    this.rt.sound?.critter?.(this.def.kind === 'robot' ? 'whirr' : 'creak', 0.9);
  }
  strike(a, P) {
    this.rt.rumble?.(0.6, 0.5);
    this.def.onStrike?.(this, a);
    if (P.dead || P.down) return false;
    if (P.pos.y - this.arena.y > (a.shape === 'lane' ? 3.5 : HIT.airborne)) return false;   // jumped clear (a beam reaches a little higher)
    if (!inArea(a, this.attackAt, this.attackH, P.pos)) return false;
    const dmg = strikeDamage(P.health ?? 1, a.damage ?? 0.25);
    _a.subVectors(P.pos, a.shape === 'ring' ? this.attackAt : this.model.pos).setY(0);
    if (_a.lengthSq() < 1e-4) _a.set(Math.sin(this.model.heading), 0, Math.cos(this.model.heading));
    _a.normalize().multiplyScalar(a.knock ?? 9).addScaledVector(UP, 4);
    P.knockDown?.(_a, { why: 'guardian' });
    P.hurt?.(dmg, 'guardian');
    this.def.onCatch?.(this, a);
    return true;
  }
  dispose() { for (const f of this.offs) f(); this.tele.group.removeFromParent(); }
}
