import * as THREE from 'three';
import { makeMaterial, releaseMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { HIT, strikeDamage, heartsOf, quarters, DAMAGE } from '../resources.js';
import { ChargeGlow, TELL, groundMark, poseK, POSE_DONE } from '../telegraph.js';

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
// Either way it fights as a staged fight of its own (docs/systems/foes.md "The guardians"): four to six moves drawn
// from its body and its temple's mechanic, combos of two or three chained moves (the last the one to read: the
// punish, and after it the opening), and phases that add or change moves and visibly change it (a shift: it
// staggers, sheds, cracks or lights up, src/temples/boss.js PhaseMarks). Every move is telegraphed by the body
// (src/telegraph.js): its pose (the model's own, and a `rig` motion: rear, crouch, coil, spin, lean, rise, swell),
// a glow gathering on the striking part, a deep sound rising with it, a stillness before it lands; never a disc,
// a fan or a lane on the floor. Only a lobbed or thrown projectile (a seed, a cog, a mortar, a clod) marks where it
// will land. A strike that catches you knocks you down (the ragdoll, src/ragdoll.js) and takes a bite of the
// health bar, but never the last of it from a healthy bar: only when you are already low does it knock you out,
// and then you wake at the temple's mark outside the arena and it is back where its current phase began.
// Openings are read from the body (it pants, a vent opens, it is stuck after a missed slam): that is when
// soothing (or a shot) counts.
//
//   const g = new Guardian(rt, { def, model, arena: { center, r, y } });
//   g.update(dt, t)   per frame (the runtime; wakes it when you step into the arena)
//   g.add(k, why)     the meter, within the current phase (def.phases)
//   g.state           'sleep' | 'wake' | 'fight' | 'open' | 'shift' | 'weary' | 'resolved'
//
// def: { kind, name, phases: [{ to: 0.4, attacks: ['stamp', …] (the moves it begins with; a combo starts at its
//        first), pause, hint, openHint? }], shiftTime?, missHint?,
//        attacks: { id: { shape: 'ring' | 'cone' | 'lane', at: 'self' | 'front' (ring `ahead` m) | 'player',
//                          radius, range, angle, width, wind: s, damage: hearts, knock: m/s, recover: s,
//                          part: where its glow gathers ('mouth' | 'head' | 'eye' | 'feet' | 'arms' | 'wings' |
//                          'core' | 'tail'), rig, pose (the model's pose, else the id), side (±1: a mirrored swing),
//                          track (share of the wind-up it keeps aiming), lob + volley (a thrown projectile and its
//                          landing marks), over (its body travels to hang over the spot: a dive, a burrow),
//                          dash (m it charges through the strike), wave { speed, reach, width, damage } (a ring
//                          running out along the floor: jump it), reachUp (m: it reaches the air over it),
//                          then (the next move of a combo), link (a move only met inside a combo), gap (s before
//                          the next), open (s open after it), miss (s open, stuck, when it missed you) } },
//        onHit(g, part ('mouth' | 'body' | 'vent'), mode, info) -> handled, final: 'touch' | 'break',
//        onStrike(g, a), onCatch(g, a), onReset(g), openFor(g, a, s, missed) -> s (how long a combo's end leaves it open),
//        touch: 'prompt', wake: text, weary: text, resolved: text }
// model: { group, pos (Vector3 on the floor), heading, mouth (Vector3), radius, height, part?(name, out, side),
//          marks? { c, r } (where its phase marks go), tellRig? (its own frame for the moves' generic motions: a walker
//          keeps its legs out of it, planted), animate(dt, t, { state, attack, k, speed, meter, phase, kit: { eye, ground } }) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V();
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

// Strikes never take you from more than a heart to nothing (src/resources.js HIT, strikeDamage: in hearts).
export { HIT, strikeDamage };

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

/**
 * A mark drawn on the floor: a fill that grows, inside an outline that pulses. Only a projectile's landing mark
 * (src/telegraph.js groundMark: a lob) and the hitbox overlay use it; every other attack is read from the body.
 */
export class Telegraph {
  constructor(parent, color) {
    this.fillM = makeMaterial({ color, glow: 0.7, flat: true, side: THREE.DoubleSide, key: `tele.fill.${uid++}` });
    // (the fill's glow is its own, the outline is everyone's)
    this.edgeM = makeMaterial({ color: '#2b211f', flat: true, side: THREE.DoubleSide, key: 'tele.edge' });
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
  /** Gone for good (its foe let go): out of the scene, its shapes and its own fill disposed. */
  dispose() {
    this.group.removeFromParent();
    this.fill.geometry.dispose(); this.edge.geometry.dispose();
    releaseMaterial(this.fillM);
  }
}

/** The parts that come in pairs: a glow on each (both arms, both wings, both forefeet). */
const PAIRED = new Set(['arms', 'wings', 'feet']);
/** How long a phase change takes (s): it staggers, changes, and comes on again. */
export const SHIFT = 2.4;
/** The shockwave ring a slam sends out: drawn as it runs (it is the attack, not a warning), jump it. */
const WAVE_GEO = new THREE.TorusGeometry(1, 0.06, 4, 64).rotateX(Math.PI / 2);

/**
 * A move's facts as the fight uses them: its wind-up on this setting (Gentle: TELL.slow), whether it is heavy (the
 * louder sound), whether a strike of it is a combo's last (its `open` or `miss`: the punish read last).
 */
export const windOf = (a) => (a.wind ?? a.telegraph ?? 1.2) * (TELL.slow ?? 1);
/** A combo from move id: its chain of ids (then → then …). */
export function comboOf(def, id) {
  const out = [];
  for (let a = def.attacks[id], n = 0; a && n < 6; n++) { out.push(id); id = a.then; a = id ? def.attacks[id] : null; }
  return out;
}

/**
 * Glowing marks on a guardian's body that come with its phases (a machine's cracks, a living one's waking glyph
 * veins): none at first, some after the first change, all and pulsing after the second. Each a thin bent line over
 * an ellipsoid round its body (model.marks { c, r }, else from its radius and height).
 */
export class PhaseMarks {
  constructor(parent, model, robot) {
    const m = model.marks ?? {}, R = model.radius ?? 3, H = model.height ?? 4;
    const c = V(...(m.c ?? [0, model.floats ? 0 : H * 0.55, 0])), r = m.r ?? [R * 0.8, H * 0.35, R * 0.8];
    this.mat = makeMaterial({ color: robot ? '#ff8a3a' : '#ffe08a', glow: 0.2, flat: true, key: `guardian.marks.${uid++}` });
    this.lines = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 12; i++) {
      const pts = [];
      let th = rnd() * Math.PI * 2, ph = (rnd() - 0.5) * 1.6;
      for (let j = 0; j < 6; j++) {
        pts.push(V(c.x + Math.cos(ph) * Math.sin(th) * r[0] * 1.02, c.y + Math.sin(ph) * r[1] * 1.02, c.z + Math.cos(ph) * Math.cos(th) * r[2] * 1.02));
        th += (rnd() - 0.5) * 0.5; ph += (rnd() - 0.3) * 0.35;
      }
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, Math.max(0.05, R * 0.025), 4, false), this.mat);
      mesh.visible = false; mesh.userData.noCollide = true; mesh.userData.dynamic = true;
      parent.add(mesh); this.lines.push(mesh);
    }
    this.shown = 0;
  }
  /** phase 0: none; 1: half; 2+: all, pulsing. state 'resolved' fades them (a calmed one's glyphs stay soft). */
  set(phase, t, state) {
    const n = phase <= 0 ? 0 : phase === 1 ? 6 : 12;
    this.lines.forEach((l, i) => { l.visible = i < n && state !== 'sleep'; });
    this.mat.uniforms.uGlow.value = state === 'resolved' ? 0.15 : phase >= 2 ? 0.7 + 0.3 * Math.sin(t * 6) : 0.55;
  }
  dispose() { for (const l of this.lines) { l.removeFromParent(); l.geometry.dispose(); } releaseMaterial(this.mat); }
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
    this.attack = null; this.attackAt = V(); this.attackH = 0; this.view = null;
    this.cool = 2.5;
    this.order = 0;     // moves begun (the phase's list, in turn)
    this.combo = 0;     // moves chained in the current combo (0: none)
    this.hitLast = false;
    const tone = def.kind === 'robot' ? '#e0644a' : '#f0a04b';
    // a lobbed projectile's landing marks (the only thing drawn on the floor); the glow on the striking part(s)
    this.tele = new Telegraph(rt.root, tone);
    this.teles = [];
    const gs = Math.max(0.55, (model.radius ?? 3) * 0.26);
    this.glows = [new ChargeGlow(rt.root, tone, gs), new ChargeGlow(rt.root, tone, gs)];
    this.balls = [];
    this.waves = [];
    this.ballM = makeMaterial({ color: tone, glow: 0.8, flat: true, key: `guardian.ball.${uid++}` });
    // the generic wind-up motions act on a frame round its body (the model's own poses act inside it)
    if (!model.tellRig) {
      const rig = new THREE.Group(); rig.name = 'tell rig';
      while (model.group.children.length) rig.add(model.group.children[0]);
      model.group.add(rig); model.tellRig = rig;
    }
    this.rigK = { x: 0, y: 0, z: 0, ry: 0, s: 1, sy: 1, spin: 0 };
    this.marks = new PhaseMarks(model.tellRig, model, def.kind === 'robot');
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
  /** The wind-up's progress (0..1; 1 once struck), for the models and the tests. */
  get attackK() { return this._k ?? 0; }
  set attackK(v) { this._k = v; }

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
      this.stop();
      this.enter('weary');
      this.rt.notice?.(this.def.weary);
      if (this.def.final !== 'touch' && last) this.resolve();
    } else {
      // the change: it staggers and is changed (its marks, its moves), then comes on again
      this.rt.notice?.(P?.hint);
      this.stop(); this.cool = 1.2; this.combo = 0;
      this.enter('shift');
      this.rt.rumble?.(1.2, 0.4);
      this.rt.sound?.guardianWarn?.(this.def.kind, this.def.shiftTime ?? SHIFT, true);
    }
  }
  enter(state) { this.state = state; this.t = 0; }
  /** Whatever it was winding up or chaining is broken off (stilled, knocked out, a phase change). */
  stop() {
    this.attack = null; this.view = null; this.attackK = 0; this.combo = 0; this.closing = null;
    this.tele.hide(); for (const T of this.teles) T.hide();
    for (const g of this.glows) g.hide();
    for (const b of this.balls) b.visible = false;
  }
  hit(part, mode, dir, info) {
    if (this.def.onHit?.(this, part, mode, info, dir)) return true;
    if (mode === 'stun' && this.attack && this.state === 'fight' && !this.struck) {
      // the stilling lens stops a strike before it lands (and the rest of its combo)
      this.stop(); this.cool = 2.5;
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
    this.stop(); this.clearWaves(); this.closing = null;
    this.enter('sleep');
    this.cool = 2.5;
    this.model.pos.copy(this.model.home ?? this.arena.center);
    this.def.onReset?.(this);
  }
  resolve() {
    if (this.state === 'resolved') return;
    this.meter = 1;
    this.stop(); this.clearWaves();
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
    const m = this.model;
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
    this.keepIn();
    return sp;
  }
  /** Inside the arena. */
  keepIn() {
    const m = this.model, A = this.arena;
    _b.subVectors(m.pos, A.center).setY(0);
    const r = A.r - (m.radius ?? 2.6) - 1;
    if (_b.length() > r) { _b.setLength(r); m.pos.x = A.center.x + _b.x; m.pos.z = A.center.z + _b.z; }
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
    if (this.state === 'shift') { if (P) this.face(dt, P.pos, 1); if (this.t > (this.def.shiftTime ?? SHIFT)) this.enter('fight'); }
    if (this.state === 'fight' || this.state === 'open') speed = this.fight(dt, t, P);
    if (this.state === 'open' && this.t > (this.openFor ?? 2.5)) this.enter('fight');
    if (this.state === 'weary' || this.state === 'resolved') {
      speed = this.walk(dt, m.rest ?? A.center, 1.8, 0.2);
      if (speed < 0.1 && m.restHeading !== undefined) m.heading += Math.atan2(Math.sin(m.restHeading - m.heading), Math.cos(m.restHeading - m.heading)) * Math.min(1, dt);
    }
    this.updateWaves(dt, P);
    this.place();
    this.solid.vel.subVectors(m.pos, this.prev).divideScalar(Math.max(dt, 1e-4));
    this.prev.copy(m.pos);
    this.poseRig(dt, t);
    // (the locomotion kit's view of the world, src/temples/guardians.js: where you are for its detail tiers, the floor under a step)
    const kit = (this.motionKit ??= { eye: null, ground: (x, y, z) => { const g = this.rt.physics?.groundAt?.(x, y, z, 6); return Number.isFinite(g) ? g : null; } });
    kit.eye = P?.pos ?? null;
    m.animate(dt, t, { state: this.state, attack: this.view, k: this.attackK, speed, meter: this.meter, phase: this.phaseIndex, kit });
    this.marks.set(Math.min(this.phaseIndex, this.def.phases.filter((p) => !p.weary).length - 1), t, this.state);
    this.tells(t);
  }

  fight(dt, t, P) {
    const m = this.model, A = this.arena;
    if (!P) return 0;
    if (this.dashing > 0) {
      // a charge carries it on through the strike
      const d = Math.min(this.dashing, (this.attack?.dash ?? 0) * dt / 0.4);
      m.pos.x += Math.sin(this.attackH) * d; m.pos.z += Math.cos(this.attackH) * d; this.dashing -= d; this.keepIn();
    }
    if (this.attack) {
      const a = this.attack, wind = this.windFor;
      this.at += dt;
      if (this.at < wind) {
        // the wind-up: it aims (turns to you, a lob's mark or a dive's spot follows you) for its `track`, then holds
        const aiming = this.at < wind * (a.track ?? 0.5);
        if (a.at === 'player' && aiming) this.attackAt.set(P.pos.x, A.y, P.pos.z);
        if (a.shape !== 'ring' || a.at === 'front') { if (aiming && !m.rooted) this.face(dt, P.pos, 5); else if (aiming) this.face(dt, P.pos, 3); this.attackH = m.heading; }
        if (a.at === 'self') this.attackAt.copy(m.pos).setY(A.y);
        if (a.at === 'front') this.attackAt.set(m.pos.x + Math.sin(m.heading) * (a.ahead ?? 4), A.y, m.pos.z + Math.cos(m.heading) * (a.ahead ?? 4));
        if (a.over && !m.rooted && dt > 0) {
          // its body travels to hang over (or plough under the sand to) the spot, there by 70 % of the wind-up
          _a.subVectors(this.attackAt, m.pos).setY(0);
          const left = Math.max(dt, wind * 0.7 - this.at), d = _a.length();
          if (d > 0.05) { m.pos.addScaledVector(_a.normalize(), Math.min(d, (d / left) * dt, 14 * dt)); this.keepIn(); }
        }
        if (a.lob && a.volley > 1) this.spreadMarks(a);
        this.attackK = this.at / wind;
      } else if (!this.struck) {
        this.struck = true;
        this.attackK = 1;
        this.hitLast = this.strike(a, P);
      } else if (this.at > wind + (a.then ? (a.gap ?? 0.25) : (a.recover ?? 0.8))) {
        const next = a.then && !P.dead && !P.down ? this.def.attacks[a.then] : null;
        if (next) { this.begin(P, a.then); return 0; }
        // a combo's last move, or a lone one: open after it (it pants, its vents open), or stuck if it missed you;
        // a combo cut short (you are down) still ends in its opening: it has spent itself all the same
        const end = a.then ? this.def.attacks[comboOf(this.def, this.attack.id).at(-1)] : a;
        const missed = !this.hitLast && !!a.miss && a.miss > (end.open ?? 0);
        // (a temple may change it: the Cloud-Mother's last phase opens only on a stone the bell holds, def.openFor)
        const openFor = this.def.openFor?.(this, end, missed ? a.miss : end.open ?? 0, missed) ?? (missed ? a.miss : end.open ?? 0);
        this.stop();
        this.cool = this.phase.pause ?? 1.6;
        // (said once a phase: a later phase's opening may differ, the warden's crown vent: phase.openHint)
        if (openFor) { this.enter('open'); this.openFor = openFor; this.rt.notice?.(missed ? this.def.missHint ?? this.phase.openHint ?? this.def.openHint : this.phase.openHint ?? this.def.openHint, `${missed ? 'miss' : 'open'}.${this.phaseIndex}`); }
      }
      return 0;
    }
    if (this.state === 'open') { this.face(dt, P.pos, 1.5); return 0; }
    // between attacks: keep a little distance from you, and circle
    const ang = Math.atan2(P.pos.x - A.center.x, P.pos.z - A.center.z) + Math.sin(t * 0.3) * 0.8;
    const want = _b.set(A.center.x + Math.sin(ang) * A.r * 0.35, A.y, A.center.z + Math.cos(ang) * A.r * 0.35);
    if (this.closing) {
      // its next move is a close one: it comes for you first (a few seconds at most), then begins it
      this.closing.t += dt;
      const d = Math.hypot(P.pos.x - m.pos.x, P.pos.z - m.pos.z);
      const sp = this.walk(dt, P.pos, (this.def.speed ?? 2.4) * 1.6, this.closing.reach * 0.6);
      if (d <= this.closing.reach * 0.9 || this.closing.t > 3) { const id = this.closing.id; this.closing = null; this.begin(P, null, id); }
      return sp;
    }
    const speed = m.rooted ? 0 : this.walk(dt, want, this.def.speed ?? 2.4, 1);
    if (speed < 0.2) this.face(dt, P.pos, 2);
    this.cool -= dt;
    if (this.cool <= 0 && !P.dead) this.begin(P);
    return speed;
  }
  /** Begin a move: the phase's next in turn (one that reaches you), or `id` (a combo's next). */
  /** How far a move reaches from its body (m): a dive or a lob follows you anywhere. */
  reachOf(a) { return a.shape === 'cone' || a.shape === 'lane' ? a.range ?? 12 : a.at === 'player' ? Infinity : (a.radius ?? 4) + (a.at === 'front' ? a.ahead ?? 4 : 0) + (a.wave?.reach ?? 0); }
  begin(P, id = null, picked = null) {
    const chained = !!id;
    if (!id) {
      const list = this.phase.attacks;
      if (!list?.length) return;
      const d = Math.hypot(P.pos.x - this.model.pos.x, P.pos.z - this.model.pos.z);
      id = picked ?? list[this.order % list.length];
      // a close move with you out of its reach: it comes for you first (a rooted one throws something instead)
      const reach = this.reachOf(this.def.attacks[id]);
      if (!picked && d > reach * 0.95) {
        if (!this.model.rooted) { this.closing = { id, reach, t: 0 }; this.order++; return; }
        id = list.find((x) => this.reachOf(this.def.attacks[x]) > d) ?? id;
      }
      this.combo = 0;
    }
    if (!picked) this.order++;
    this.combo++;
    const a = { id, ...this.def.attacks[id] };
    this.attack = a; this.at = 0; this.struck = false; this.attackK = 0; this.dashing = 0;
    this.windFor = windOf(a);
    this.view = { ...a, id: a.pose ?? id, move: id };
    this.attackAt.set(P.pos.x, this.arena.y, P.pos.z);
    if (a.at === 'self') this.attackAt.copy(this.model.pos).setY(this.arena.y);
    this.attackH = this.model.heading;
    if (a.lob && a.volley > 1) this.spreadMarks(a);
    if (!chained) this.rt.sound?.critter?.(this.def.kind === 'robot' ? 'whirr' : 'creak', 0.9);
    this.rt.sound?.guardianWarn?.(this.def.kind, this.windFor, (a.damage ?? 0) >= 1 || !!a.wave);
  }
  /** A volley's landing marks: round the aimed spot, across the line to you. */
  spreadMarks(a) {
    const n = a.volley, h = Math.atan2(this.attackAt.x - this.model.pos.x, this.attackAt.z - this.model.pos.z), gap = (a.radius ?? 3) * 1.7;
    this.marksAt ??= [];
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * gap, along = n > 2 && i % 2 ? gap * 0.6 : 0;
      (this.marksAt[i] ??= V()).set(this.attackAt.x + Math.cos(h) * o + Math.sin(h) * along, this.arena.y, this.attackAt.z - Math.sin(h) * o + Math.cos(h) * along);
    }
    this.marksAt.length = n;
  }
  /** Where its strike lands: the aimed spot (a volley: each of its marks). */
  points(a) { return a.lob && a.volley > 1 ? this.marksAt : [this.attackAt]; }
  strike(a, P) {
    this.rt.rumble?.(0.6, 0.5);
    this.def.onStrike?.(this, a);
    if (a.dash) this.dashing = a.dash;
    if (a.wave) this.addWave(a);
    if (P.dead || P.down) return false;
    if (P.pos.y - this.arena.y > (a.reachUp ?? (a.shape === 'lane' ? 3.5 : HIT.airborne))) return false;   // jumped clear (a beam reaches a little higher)
    const at = this.points(a).find((p) => inArea(a, p, this.attackH, P.pos));
    if (!at) return false;
    this.catch(a, P, a.shape === 'ring' ? at : this.model.pos, a.damage, a.knock);
    return true;
  }
  /** It catches you: knocked down, away from `from`, and a bite of the bar (never the last of a healthy one). */
  catch(a, P, from, damage, knock) {
    const dmg = strikeDamage(heartsOf(P), quarters(damage ?? DAMAGE.heavy));
    _a.subVectors(P.pos, from).setY(0);
    if (_a.lengthSq() < 1e-4) _a.set(Math.sin(this.model.heading), 0, Math.cos(this.model.heading));
    _a.normalize().multiplyScalar(knock ?? 9).addScaledVector(UP, 4);
    P.knockDown?.(_a, { why: 'guardian' });
    P.hurt?.(dmg, 'guardian');
    this.def.onCatch?.(this, a);
  }

  /** A shockwave: a ring running out along the floor from where it struck (you jump it, or a jet carries you over). */
  addWave(a) {
    const W = a.wave, mesh = new THREE.Mesh(WAVE_GEO, this.ballM);
    mesh.userData.noCollide = true; mesh.userData.dynamic = true;
    const at = this.points(a)[0].clone();
    mesh.position.set(at.x, this.arena.y + 0.15, at.z);
    this.rt.root.add(mesh);
    this.waves.push({ at, r: a.shape === 'ring' ? a.radius ?? 3 : 1, W, a, mesh, hit: false });
  }
  updateWaves(dt, P) {
    for (const w of this.waves.slice()) {
      w.r += w.W.speed * dt;
      w.mesh.scale.set(w.r, 1 + 6 * (1 - w.r / (w.W.reach + 0.01)) * 0.3, w.r);
      const d = P ? Math.hypot(P.pos.x - w.at.x, P.pos.z - w.at.z) : Infinity;
      if (!w.hit && P && !P.dead && !P.down && Math.abs(d - w.r) < (w.W.width ?? 0.6) && P.pos.y - this.arena.y < 0.6) { w.hit = true; this.catch(w.a, P, w.at, w.W.damage ?? 0.5, w.W.knock ?? 7); }
      if (w.r > w.W.reach) { w.mesh.removeFromParent(); this.waves.splice(this.waves.indexOf(w), 1); }
    }
  }
  clearWaves() { for (const w of this.waves) w.mesh.removeFromParent(); this.waves.length = 0; }

  /** Where a part of it is (for the glow): the model's own `part`, else from its mouth, body and radius. */
  partAt(name, out, side = 1) {
    const m = this.model;
    if (m.part?.(name, out, side)) return out;
    const f = _c.set(Math.sin(m.heading), 0, Math.cos(m.heading)), r = _d.set(f.z, 0, -f.x);
    const H = m.height ?? 4, R = m.radius ?? 3, base = m.floats ? m.pos.y - H * 0.3 : m.pos.y;
    if (name === 'mouth' || name === 'head' || name === 'eye') return out.copy(m.mouth);
    if (name === 'feet') return out.copy(m.pos).setY(this.arena.y + 0.4).addScaledVector(f, R * 0.7).addScaledVector(r, side * R * 0.45);
    if (name === 'arms' || name === 'wings') return out.copy(m.pos).setY(base + H * 0.6).addScaledVector(r, side * R * 1.05);
    if (name === 'tail') return out.copy(m.pos).setY(base + H * 0.4).addScaledVector(f, -R * 1.1);
    return out.copy(m.pos).setY(m.floats ? m.pos.y : base + H * 0.5).addScaledVector(f, R * 0.6);   // the core
  }
  /** The body's tells drawn each frame: the glow on the striking part(s), a lob's landing marks and its projectile. */
  tells(t) {
    const a = this.attack, live = a && (this.state === 'fight') && (!this.struck || this.at < this.windFor + 0.12);
    if (!live) { for (const g of this.glows) g.hide(); this.tele.hide(); for (const T of this.teles) T.hide(); for (const b of this.balls) b.visible = false; return; }
    const k = this.struck ? 1 : this.attackK, part = a.part ?? 'core';
    this.glows[0].set(k, this.partAt(part, _e, 1), t);
    if (PAIRED.has(part)) this.glows[1].set(k, this.partAt(part, _e, -1), t); else this.glows[1].hide();
    // a lob: its landing marks through the wind-up, and the thrown thing in the air over its last half
    const pts = this.points(a);
    for (let i = 0; i < Math.max(pts.length, 1 + this.teles.length); i++) {
      const T = i === 0 ? this.tele : (this.teles[i - 1] ??= new Telegraph(this.rt.root, this.def.kind === 'robot' ? '#e0644a' : '#f0a04b'));
      if (groundMark(a) && i < pts.length && !this.struck) { T.show(a, pts[i], this.attackH, this.arena.y); T.set(this.attackK, t); } else T.hide();
    }
    const u = a.lob && !this.struck ? (this.attackK - 0.55) / 0.45 : -1;
    for (let i = 0; i < Math.max(pts.length, this.balls.length); i++) {
      const b = this.balls[i] ??= this.newBall();
      b.visible = u > 0 && i < pts.length;
      if (!b.visible) continue;
      const v = Math.max(0, u - i * 0.06);
      this.partAt(part, _e, 1);
      b.position.lerpVectors(_e, pts[i], v); b.position.y += Math.sin(Math.PI * v) * 5 * (1 - 0.3 * (pts[i].y - _e.y < 0 ? 0 : 1));
      b.rotation.x += 0.2; b.rotation.y += 0.13;
    }
  }
  newBall() {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.max(0.35, (this.model.radius ?? 3) * 0.13), 0), this.ballM);
    b.userData.noCollide = true; b.userData.dynamic = true; b.visible = false;
    this.rt.root.add(b); return b;
  }

  /**
   * The generic wind-up motions on the frame round its body (src/telegraph.js: the pose builds to POSE_DONE of the
   * wind-up, then holds still): rear (back and up, then down hard), crouch (low and wide, then up and out), coil (turned
   * away, then whipped across), spin (faster and faster), lean (drawn back, then thrust), rise (up high, then down
   * on you), swell (it fills, then lets go). Open, it heaves; changing phase, it staggers and shakes.
   */
  poseRig(dt, t) {
    const R = this.model.tellRig, K = this.rigK, a = this.attack, s0 = a?.side ?? 1;
    if (!R) return;
    let x = 0, y = 0, z = 0, ry = 0, s = 1, sy = 1, spin = 0, rate = 5;
    const winding = a && !this.struck && this.state === 'fight', struck = a && this.struck && this.state === 'fight';
    const u = winding ? poseK(this.attackK) : 0, H = this.model.height ?? 4;
    switch (a?.rig) {
      case 'rear': if (winding) { x = -0.3 * u; y = 0.12 * H * u; } else if (struck) { x = 0.12; y = -0.04 * H; rate = 18; } break;
      case 'crouch': if (winding) { y = -0.1 * H * u; sy = 1 - 0.12 * u; s = 1 + 0.06 * u; } else if (struck) { x = 0.1; sy = 1.05; rate = 16; } break;
      case 'coil': if (winding) ry = -s0 * 0.55 * u; else if (struck) { ry = s0 * 0.6; rate = 14; } break;
      case 'spin': spin = winding ? 2 + 14 * u : struck ? 16 : 0; break;
      case 'lean': if (winding) { x = -0.15 * u; z = -0.08 * H * u; } else if (struck) { x = 0.08; z = 0.06 * H; rate = 16; } break;
      case 'rise': if (winding) y = 0.4 * H * u; else if (struck) { y = -0.1 * H; rate = 14; } break;
      case 'swell': if (winding) s = 1 + 0.12 * u; else if (struck) { s = 0.94; rate = 18; } break;
    }
    if (this.state === 'open') { sy = 1 + 0.03 * Math.sin(t * 5); y = -0.03 * H; }
    if (this.state === 'shift') { const k = Math.min(1, this.t / 0.4) * Math.max(0, 1 - this.t / (this.def.shiftTime ?? SHIFT)); x = -0.15 * k + 0.04 * Math.sin(t * 31); ry = 0.05 * Math.sin(t * 23); y = 0.05 * H * k; }
    const e = Math.min(1, dt * rate);
    K.x += (x - K.x) * e; K.y += (y - K.y) * e; K.z += (z - K.z) * e; K.ry += (ry - K.ry) * e; K.s += (s - K.s) * e; K.sy += (sy - K.sy) * e;
    K.spin = spin ? K.spin + spin * dt : K.spin * Math.max(0, 1 - dt * 3);
    R.rotation.set(K.x, K.ry + K.spin, 0, 'YXZ');
    R.position.set(0, K.y, K.z);
    R.scale.set(K.s, K.s * K.sy, K.s);
  }
  dispose() {
    for (const f of this.offs) f();
    this.tele.group.removeFromParent(); this.tele.dispose?.();
    for (const T of this.teles) T.dispose();
    for (const g of this.glows) g.dispose();
    for (const b of this.balls) { b.removeFromParent(); b.geometry.dispose(); }
    this.clearWaves(); this.marks.dispose(); releaseMaterial(this.ballM);
  }
}
