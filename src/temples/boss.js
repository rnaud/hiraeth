import * as THREE from 'three';
import { makeMaterial, releaseMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { HIT, strikeDamage, heartsOf, quarters, DAMAGE } from '../resources.js';
import { ChargeGlow, TELL, groundMark, poseK, POSE_DONE } from '../telegraph.js';
import { SecondOrder } from '../motion-kit/spring.js';

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
// will land. A strike that catches you knocks you back on your feet (src/player.js stagger; before v1.71 the ragdoll) and takes a bite of the
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
//        first), pause, hint, openHint?, asks? }], shiftTime?, missHint?,
//        asks (v1.63, #257): a second verb the phase asks for besides the temple's gadget, { verb: 'parry' | 'push' |
//          'shot' | 'dodge', moves: [ids], open: s, perfect?: s (a perfect parry's), hint, said, lines: [3, the drone's] }:
//          until it answers one of `moves` (the guard holds it, the push or a splash in its wind-up, a perfect dodge's
//          flurry as it lands) the phase's openings don't come and the gadget takes nothing (`asking`, said `hint`);
//          answered, it reels open `open` s (`said`), and from then on the phase plays as before (and the verb still opens it)
//        attacks: { id: { shape: 'ring' | 'cone' | 'lane', at: 'self' | 'front' (ring `ahead` m) | 'player',
//                          radius, range, angle, width, wind: s, damage: hearts, knock: m/s, recover: s,
//                          part: where its glow gathers ('mouth' | 'head' | 'eye' | 'feet' | 'arms' | 'wings' |
//                          'core' | 'tail'), rig, pose (the model's pose, else the id), side (±1: a mirrored swing),
//                          track (share of the wind-up it keeps aiming), lob + volley (a thrown projectile and its
//                          landing marks), over (its body travels to hang over the spot: a dive, a burrow; leap
//                          [from, to]: only over those shares of the wind-up, a spring onto the spot),
//                          dash (m it charges through the strike), wave { speed, reach, width, damage } (a ring
//                          running out along the floor: jump it), reachUp (m: it reaches the air over it),
//                          then (the next move of a combo), link (a move only met inside a combo), gap (s before
//                          the next), open (s open after it), miss (s open, stuck, when it missed you), guard (the
//                          shield takes it: def.onBlock(g, a, perfect)),
//                          parts (v1.69, #314: the body it strikes with, model.hitParts: 'head' | 'feet' | 'body'; the
//                          blow lands where those posed bones meet you, over `active` s from the strike, instead of
//                          the shape's floor; a body without hitParts falls back to the shape), active (s),
//                          reach (m from its middle the blow can land: when it comes for you first),
//                          splash (m: a body blow's reach past the bones it lands with: a stamp's splash),
//                          blast (v1.70, #319: a blow drawn where it lands, Blast: { kind: 'beam' (a ray out of its
//                          `from` part, aimed at you, `r` round, `sweep` rad swept across, `len` m) | 'front' (a
//                          front running out from its body over the floor, the move's own shape: a ring, a fan of
//                          `angle`, a lane of `width`; from `r0` to `r1` m, `h` m high) }; over `active` s from the
//                          strike, landing where it is drawn, once; with `parts` too, either lands), late (s after
//                          the strike before its body blow is live: a leap's shell coming down) } },
//        onHit(g, part ('mouth' | 'body' | 'vent'), mode, info) -> handled, final: 'touch' | 'break',
//        onStrike(g, a), onCatch(g, a), onReset(g), openFor(g, a, s, missed) -> s (how long a combo's end leaves it open),
//        touch: 'prompt', wake: text, weary: text, resolved: text }
// model: { group, pos (Vector3 on the floor), heading, mouth (Vector3), radius, height, part?(name, out, side),
//          hitParts?(name, out) → [{ c, r }] (world spheres on its posed bones: a move's `parts`; without it, the
//          posed mesh itself near the named part, Guardian.meshParts), lockAt?(out) (its weak
//          point, where the lock-on aims: src/foes.js GuardianLock.aim), turnRate? (rad/s, the fastest it turns: a big
//          walker turns no faster than its feet can step it round), shadow? { rx, rz, feet } (its contact shadow),
//          marks? { c, r } (where its phase marks go), tellRig? (its own frame for the moves' generic motions: a walker
//          keeps its legs out of it, planted), tellWeight? (how much of those motions it takes: 0, its own poses tell its
//          moves), turnAccel? (rad/s², its turns gathered), rises? (Hz: taking off and landing eased, not in a frame),
//          animate(dt, t, { state, attack, k, speed, meter, phase, kit: { eye, ground } }) }

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
/** The traveller as a guardian's body blow meets him (m): a column this high over his feet, this far round (Guardian.touches). */
export const COLUMN = { h: 1.8, r: 0.45 };
/**
 * A body kept in by its bones (Guardian.keepIn): its `parts` (model.hitParts) at `r` of their size, `wall` m short of the
 * arena's wall (its stones' own depth, and a little room).
 */
export const KEEP_IN = { parts: ['body', 'head'], r: 0.8, wall: 0.6, speed: 1 };
/** A guardian that faces you as it circles (def.faceYou) walks at this share of its speed: sideways and back. */
export const FACE_WALK = 0.7;
/** How long a phase change takes (s): it staggers, changes, and comes on again. */
export const SHIFT = 2.4;
/**
 * The longest a guardian's notice may be (characters; a ${…} not counted), so it is one line a player reads mid-fight
 * (issue #120: "what to do, not why"). A notice is the #toast (index.html): the game's face (issue #128), about 0.5 em
 * a character in English, in a box at most 40 em wide less 1.8 em of padding: about 76 characters a line at any
 * screen size (its type follows the screen's height); 72 keeps a margin. The quest steps keep under it too (tests/quest-steps.test.js).
 */
export const NOTICE_CHARS = 72;
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

/** A flat disc on the floor (y up), the contact shadow's every spot. */
const SPOT_GEO = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
/**
 * A guardian's contact shadow (v1.69, issue #315: "he cast no shadow"). Its body is drawn into the sun's shadow maps
 * like any mesh, but the temples' halls are lit by their own lamps (the Rose House's cistern by its braziers: no sun
 * reaches its floor), and there nothing grounded it: it floated over the tiles. So a shadow of its own under it, as an
 * inker spots one in: a flat patch of the floor's own colour darkened (`tone`) under its body, following its body as it
 * sways, rears and turns, and one under each foot, shrinking as the foot lifts. model.shadow { rx, rz (m: the body's
 * patch, across and along), feet (m: a foot's), y (its height over the floor) }; none for a body that swims in the air.
 */
export class GroundShadow {
  constructor(parent, model, tone = '#4a3530', floor = null) {
    const S = model.shadow ?? {}, R = model.radius ?? 2.6;
    this.model = model; this.floor = floor; this.S = { rx: S.rx ?? R * 0.7, rz: S.rz ?? R * 0.9, feet: S.feet ?? Math.max(0.3, R * 0.16), y: S.y ?? 0.03 };
    this.mat = makeMaterial({ color: tone, flat: true, key: `guardian.shadow.${uid++}` });
    this.mat.polygonOffset = true; this.mat.polygonOffsetFactor = -2; this.mat.polygonOffsetUnits = -4;   // (over the floor it lies on: never fighting it)
    this.group = new THREE.Group(); this.group.name = 'guardian contact shadow';
    const n = 1 + (model.kit?.legs?.length ?? 0);
    this.spots = Array.from({ length: n }, () => {
      const m = new THREE.Mesh(SPOT_GEO, this.mat);
      m.userData.noCollide = true; m.userData.dynamic = true; m.userData.castShadow = false;
      this.group.add(m); return m;
    });
    this.group.userData.noCollide = true; this.group.userData.dynamic = true;
    parent.add(this.group);
    this.update();
  }
  /** Each frame, after the body is posed. */
  update() {
    const m = this.model, S = this.S;
    this.group.visible = !!m.group?.parent;
    if (!this.group.visible) return;
    const [body, ...feet] = this.spots, c = m.body?.getWorldPosition?.(_e) ?? _e.copy(m.pos);
    if (m.floats) {
      // (v1.70, issue #319: a body that swims in the air of its hall had nothing under it, and no sun reaches the
      // floor of a hall: how high it hangs and where it will come down were guesses. Now a patch on the floor under
      // it, smaller the higher it hangs, and no feet)
      const y = this.floor?.() ?? m.pos.y - (m.hover ?? 5), k = 1 / (1 + 0.12 * Math.max(0, c.y - y));
      body.visible = true;
      body.position.set(c.x, y + S.y, c.z); body.rotation.y = m.heading; body.scale.set(S.rx * k, 1, S.rz * k);
      for (const f of feet) f.visible = false;
      return;
    }
    // (the body's patch: under its body, on the floor it stands on; smaller as the body rises off it, none dug under)
    const up = THREE.MathUtils.clamp((c.y - m.pos.y) / Math.max(1, (m.height ?? 4) * 0.75), 0, 2), k = up < 0 ? 0 : 1 / (1 + 0.25 * Math.max(0, up - 1));
    body.visible = c.y > m.pos.y - 0.5;
    body.position.set(c.x, m.pos.y + S.y, c.z); body.rotation.y = m.heading; body.scale.set(S.rx * k, 1, S.rz * k);
    const P = m.kit?.rig?.planner?.feet;
    feet.forEach((spot, i) => {
      const f = P?.[i];
      spot.visible = !!f;
      if (!f) return;
      // (planted: the foot's own spot; in a step, the floor it left or lands on, shrinking with its height)
      const floor = f.planted ? f.pos.y : Math.min(f.from?.y ?? f.pos.y, f.to?.y ?? f.pos.y), h = Math.max(0, f.pos.y - floor);
      const r = S.feet * Math.max(0.35, 1 - h / 1.2);
      spot.position.set(f.pos.x, floor + S.y + 0.01, f.pos.z); spot.scale.set(r, 1, r);
    });
  }
  dispose() { this.group.removeFromParent(); releaseMaterial(this.mat); }
}

/**
 * A body blow on a body with no `hitParts` of its own (v1.70, issue #319: every guardian but the Keeper struck with a
 * shape on the floor, up to 18.7 m from its body): its posed mesh, sampled (every vertex of a built body, every
 * `skinStep`th of a skinned one) up to the traveller's height (COLUMN.h + `top` over the floor: what is over his head
 * meets no one on the floor), one sphere for each `cell` m cube its vertices fill, `r` m round; near a named part
 * (model.part) within `near` x its radius ('body': all of it).
 */
export const MESH_PARTS = { cell: 0.7, r: 0.5, skinStep: 5, near: 0.75, max: 900, top: 0.4 };
/**
 * A blow drawn where it lands (v1.70, issue #319): the warden's eye-beam hit a lane 28 m long the game never drew, the
 * Elder's gale a lane of 20, every shock and gust its whole floor at once. Now a beam is a ray of light out of its eye
 * (or dish, or mouth), aimed down at you through the wind-up, `r` m round, swept across a fan when it `sweep`s; a front
 * is a band of wind, sound or shock running out from its body over the floor, `h` m high (one you can jump, `h` under
 * HIT.airborne), `depth` m thick; each lands only where it is drawn, as it is drawn, once.
 * Defaults: `active` s (a beam's, a sweep's, a front's), the beam's radius, a front's thickness and its bands' height,
 * the height a beam is aimed at over the floor.
 */
export const BLAST = { beam: 0.35, sweep: 0.75, front: 0.4, beamR: 0.7, depth: 0.5, band: 0.22, aimY: 1.0 };
const BEAM_GEO = new THREE.CylinderGeometry(1, 1, 1, 10, 48, true).translate(0, 0.5, 0);
const _q = new THREE.Quaternion(), _s = V(), _t = V(), _u = V();

/** The shortest distance between segments p1-q1 and p2-q2 (3D). */
export function segmentGap(p1, q1, p2, q2) {
  const d1 = _s.subVectors(q1, p1), d2 = _t.subVectors(q2, p2), r = _u.subVectors(p1, p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let sc, tc;
  if (a < 1e-9 && e < 1e-9) return r.length();
  if (a < 1e-9) { sc = 0; tc = THREE.MathUtils.clamp(f / e, 0, 1); }
  else {
    const c = d1.dot(r);
    if (e < 1e-9) { tc = 0; sc = THREE.MathUtils.clamp(-c / a, 0, 1); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      sc = den > 1e-9 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
      tc = (b * sc + f) / e;
      if (tc < 0) { tc = 0; sc = THREE.MathUtils.clamp(-c / a, 0, 1); } else if (tc > 1) { tc = 1; sc = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
    }
  }
  return Math.hypot(r.x + d1.x * sc - d2.x * tc, r.y + d1.y * sc - d2.y * tc, r.z + d1.z * sc - d2.z * tc);
}

/**
 * One guardian's drawn blow (BLAST): aimed as it strikes (`aim`), moved on as it runs (`set(k)`), tested against the
 * traveller where it is now (`touches`), and drawn the same (a beam's cylinder; a front's bands of light along its edge).
 */
export class Blast {
  constructor(parent, mat) {
    this.beam = new THREE.Mesh(BEAM_GEO, mat);
    this.beam.name = 'guardian blow (beam)';
    const n = 96, L = 3, pos = new Float32Array(L * (n + 1) * 2 * 3), idx = [];
    for (let l = 0; l < L; l++) for (let i = 0; i < n; i++) {
      const a = (l * (n + 1) + i) * 2, b = a + 2;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    geo.setIndex(idx);
    this.n = n; this.lines = L;
    this.front = new THREE.Mesh(geo, mat);
    this.front.name = 'guardian blow (front)';
    for (const m of [this.beam, this.front]) { m.userData.noCollide = true; m.userData.dynamic = true; m.userData.castShadow = false; m.userData.blow = true; m.visible = false; m.frustumCulled = false; parent.add(m); }
    this.B = null;
  }
  /**
   * Aim move a (its `blast`) as it strikes: g the guardian, from (its part, world), at (where you stood as its aim
   * held: the beam comes down through your chest there, along its heading). Returns this.
   */
  aim(g, a, from, at) {
    // (the floor: where you stood, for a beam; the one it stands on, for a front: a dais over the hall's floor, the warden's)
    const S = a.blast, m = g.model, y = S.kind === 'beam' ? Math.min(g.arena.y, at?.y ?? g.arena.y) : m.floats ? g.arena.y : m.pos.y;
    if (S.kind === 'beam') {
      const along = at ? (at.x - from.x) * Math.sin(g.attackH) + (at.z - from.z) * Math.cos(g.attackH) : 8;
      const drop = Math.max(0.2, from.y - (y + BLAST.aimY)), d = Math.max(2, along);
      this.B = { kind: 'beam', a, o: from.clone(), yaw: g.attackH, pitch: Math.atan2(drop, d), r: S.r ?? BLAST.beamR, len: S.len ?? a.range ?? 20, sweep: S.sweep ?? 0, side: a.side ?? 1, floor: y };
    } else {
      const o = a.at === 'front' ? g.attackAt.clone() : m.pos.clone();
      const r0 = S.r0 ?? (a.shape === 'ring' && a.at === 'front' ? 0 : (m.radius ?? 3) * 0.6);
      const r1 = S.r1 ?? (a.shape === 'ring' ? a.radius ?? 4 : a.range ?? 12);
      this.B = { kind: 'front', a, shape: a.shape, o: o.setY(y), yaw: g.attackH, r0, r1, h: S.h ?? 1.2, angle: S.angle ?? a.angle ?? 0.6, width: S.width ?? a.width ?? 3, depth: S.depth ?? BLAST.depth };
    }
    this.set(0);
    return this;
  }
  /** Its progress over its live window (0..1): the beam's sweep, the front's radius; a beam out of `from` now (its eye, as it moves). */
  set(k, from = null) {
    const B = this.B;
    if (!B) return;
    B.k = THREE.MathUtils.clamp(k, 0, 1);
    if (B.kind === 'beam') {
      if (from) B.o.copy(from);
      const yaw = B.yaw + (B.sweep ? -B.side * B.sweep * (1 - 2 * B.k) : 0), cp = Math.cos(B.pitch), sp = Math.sin(B.pitch);
      B.dir = (B.dir ?? V()).set(Math.sin(yaw) * cp, -sp, Math.cos(yaw) * cp);
      // (it ends on the floor it burns, or at its length)
      const toFloor = sp > 1e-3 ? (B.o.y - B.floor) / sp : Infinity;
      B.L = Math.min(B.len, toFloor);
      B.end = (B.end ?? V()).copy(B.o).addScaledVector(B.dir, B.L);
    } else B.r = THREE.MathUtils.lerp(B.r0, B.r1, B.k);
  }
  /** Does it meet a traveller standing at p (his column, COLUMN) where it is now? */
  touches(p) {
    const B = this.B;
    if (!B) return false;
    if (B.kind === 'beam') return segmentGap(B.o, B.end, _c.copy(p), _d.copy(p).setY(p.y + COLUMN.h)) < B.r + COLUMN.r;
    if (p.y - B.o.y > B.h) return false;
    const dx = p.x - B.o.x, dz = p.z - B.o.z, gap = B.depth / 2 + COLUMN.r;
    if (B.shape === 'lane') {
      const f0 = Math.sin(B.yaw), f1 = Math.cos(B.yaw), along = dx * f0 + dz * f1, side = Math.abs(dx * f1 - dz * f0);
      return Math.abs(along - B.r) < gap && side < B.width / 2 + COLUMN.r;
    }
    const d = Math.hypot(dx, dz);
    if (Math.abs(d - B.r) > gap) return false;
    if (B.shape === 'cone') { const th = Math.atan2(dx, dz) - B.yaw, da = Math.atan2(Math.sin(th), Math.cos(th)); return Math.abs(da) < B.angle + COLUMN.r / Math.max(1, d); }
    return true;
  }
  /** Drawn where it is now (or hidden: off). */
  draw(on = true) {
    const B = this.B;
    this.beam.visible = on && B?.kind === 'beam';
    this.front.visible = on && B?.kind === 'front';
    if (!on || !B) return;
    if (B.kind === 'beam') {
      this.beam.position.copy(B.o);
      this.beam.quaternion.copy(_q.setFromUnitVectors(UP, B.dir));
      this.beam.scale.set(B.r, B.L, B.r);
      this.beam.updateMatrixWorld();
      return;
    }
    // (the front's edge: up to three bands of light at heights over the floor, as wind lines or a shock's lip)
    const pos = this.front.geometry.attributes.position, nor = this.front.geometry.attributes.normal, n = this.n;
    const L = Math.max(1, Math.min(this.lines, Math.round(B.h / 0.9))), bh = BLAST.band;
    for (let l = 0; l < this.lines; l++) {
      const shown = l < L, y = B.o.y + (L === 1 ? Math.min(B.h, 0.6) * 0.5 : 0.25 + (B.h - 0.5) * (l / (L - 1)));
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        let x, z, nx, nz;
        if (B.shape === 'lane') {
          const f0 = Math.sin(B.yaw), f1 = Math.cos(B.yaw), w = (u - 0.5) * B.width;
          x = B.o.x + f0 * B.r + f1 * w; z = B.o.z + f1 * B.r - f0 * w; nx = f0; nz = f1;
        } else {
          const th = B.shape === 'cone' ? B.yaw + (2 * u - 1) * B.angle : u * Math.PI * 2;
          nx = Math.sin(th); nz = Math.cos(th); x = B.o.x + nx * B.r; z = B.o.z + nz * B.r;
        }
        const j = (l * (n + 1) + i) * 2;
        // (a band not used this time folded away under the floor)
        const lo = shown ? y - bh / 2 : B.o.y - 50, hi = shown ? y + bh / 2 : B.o.y - 50;
        pos.setXYZ(j, x, lo, z); pos.setXYZ(j + 1, x, hi, z);
        nor.setXYZ(j, nx, 0, nz); nor.setXYZ(j + 1, nx, 0, nz);
      }
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
    this.front.geometry.computeBoundingSphere();
  }
  /** The meshes it is drawn with now (the combat review's QC reads them as what the blow is). */
  meshes() { return [this.beam, this.front].filter((m) => m.visible); }
  dispose() { for (const m of [this.beam, this.front]) m.removeFromParent(); this.front.geometry.dispose(); }
}

/**
 * The guardians in play (a temple's, the Arena's sparring one): src/foes.js locks on to them (GuardianLock) and reads their
 * moves for the perfect dodge (src/flurry.js guardianThreat). Added as one is made, gone with dispose().
 */
export const GUARDIANS_LIVE = new Set();

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
    // (its drawn blows: a beam, a front of wind or shock, lit as its glow is: Blast)
    this.blastM = makeMaterial({ color: tone, glow: 0.85, flat: true, side: THREE.DoubleSide, key: `guardian.blast.${uid++}` });
    this.blast = new Blast(rt.root, this.blastM);
    // the generic wind-up motions act on a frame round its body (the model's own poses act inside it)
    if (!model.tellRig) {
      const rig = new THREE.Group(); rig.name = 'tell rig';
      while (model.group.children.length) rig.add(model.group.children[0]);
      model.group.add(rig); model.tellRig = rig;
    }
    this.rigK = { x: 0, y: 0, z: 0, ry: 0, s: 1, sy: 1, spin: 0 };
    this.marks = new PhaseMarks(model.tellRig, model, def.kind === 'robot');
    // (its contact shadow, of the floor's colour darkened: the temple's palette, else sand)
    this.ground = new GroundShadow(rt.root, model, '#' + new THREE.Color(rt.P?.floor ?? '#d8c08e').multiplyScalar(0.58).getHexString(), () => this.arena.y);
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
    GUARDIANS_LIVE.add(this);
  }

  get phaseIndex() { const P = this.def.phases; for (let i = 0; i < P.length; i++) if (this.meter < P[i].to - 1e-6) return i; return P.length; }
  get phase() { return this.def.phases[Math.min(this.phaseIndex, this.def.phases.length - 1)]; }
  get awake() { return this.state !== 'sleep' && this.state !== 'resolved'; }
  /** The phase's second verb (`phase.asks`) not answered yet: its openings and the gadget wait for it. */
  get asking() { const A = this.phase?.asks; return !!A && !(this.answered ??= new Set()).has(this.phaseIndex); }
  /**
   * The phase's second verb answered (def.phases[i].asks, v1.63 #257): `verb` against the move it is winding up or
   * landing (one of asks.moves), and it reels open. True when it did.
   */
  answer(verb, perfect = false) {
    const A = this.phase?.asks, a = this.attack;
    if (!A || A.verb !== verb || this.state !== 'fight' || !a || !A.moves.includes(a.id)) return false;
    if ((verb === 'push' || verb === 'shot') && this.struck) return false;   // (in its wind-up, before it lands)
    const first = this.asking;
    (this.answered ??= new Set()).add(this.phaseIndex);
    this.stop(); this.cool = this.phase.pause ?? 1.6;
    this.enter('open'); this.openFor = perfect && A.perfect ? A.perfect : A.open ?? 3;
    this.rt.rumble?.(0.8, 0.4);
    this.rt.sound?.critter?.(this.def.kind === 'robot' ? 'whirr' : 'creak', 1.2);
    if (first) this.rt.notice?.(A.said, `asks.said.${this.phaseIndex}`);
    return true;
  }
  /** The wind-up's progress (0..1; 1 once struck), for the models and the tests. */
  get attackK() { return this._k ?? 0; }
  set attackK(v) { this._k = v; }

  /** Raise (or lower) the meter, inside the current phase: a phase's end is reached only from within it. */
  add(k, why = '') {
    if (!this.awake || this.state === 'weary') return false;
    const i = this.phaseIndex, P = this.def.phases;
    const lo = i > 0 ? P[i - 1].to : 0, hi = P[Math.min(i, P.length - 1)].to;
    const before = this.meter;
    // (the phase's second verb not answered yet: the gadget takes nothing, and it says what it waits for)
    if (k > 0 && this.asking) { this.rt.notice?.(this.phase.asks.hint, `asks.${i}`); return false; }
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
      // the change: it staggers and is changed (its marks, its moves), then comes on again (a phase that asks for a
      // second verb says that first: its own hint comes again once it is answered, the drone's lines)
      this.rt.notice?.(P?.asks?.hint ?? P?.hint);
      this.stop(); this.cool = 1.2; this.combo = 0;
      this.enter('shift');
      this.rt.rumble?.(1.2, 0.4);
      this.rt.sound?.guardianWarn?.(this.def.kind, this.def.shiftTime ?? SHIFT, true);
    }
  }
  enter(state) { this.state = state; this.t = 0; if (state === 'open') this.opened = (this.opened ?? 0) + 1; }   // (opened: openings so far, each its own)
  /** Whatever it was winding up or chaining is broken off (stilled, knocked out, a phase change). */
  stop() {
    this.attack = null; this.view = null; this.attackK = 0; this.combo = 0; this.closing = null; this.live = null; this.blast?.draw(false);
    this.tele.hide(); for (const T of this.teles) T.hide();
    for (const g of this.glows) g.hide();
    for (const b of this.balls) b.visible = false;
  }
  hit(part, mode, dir, info) {
    // (the phase's second verb: the push, or a splash, into the move it winds up)
    if ((mode === 'push' || mode === 'shoot') && this.answer(mode === 'push' ? 'push' : 'shot')) return true;
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
    this.answered?.delete(this.phaseIndex);   // (back at the phase's start: its second verb asked again)
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
    } else {
      const g = ph?.groundAt(m.pos.x, this.arena.y + 2.5, m.pos.z, 6);
      if (Number.isFinite(g)) m.pos.y = Math.max(this.arena.y - 2, g); else if (m.rises) m.pos.y = this.arena.y;
    }
    // (a body that takes off and lands as its phases change, model.rises (Hz): eased up and down, never there in a
    // frame; the Elder jumped 3.5 m up when her phase took her aloft, and back down, #237)
    if (m.rises) {
      const y = m.pos.y;
      if (!this._rise) this._rise = new SecondOrder(m.rises, 1, 0, y);
      else if (Math.abs(y - this._rise.y) > 6) this._rise.reset(y);   // (put somewhere else: there at once)
      m.pos.y = this._rise.update(this._dt ?? 1 / 60, y);
    }
    this.solid.pos = m.pos;
    if (m.floats) { this.solid.bottom = m.pos.y - (m.height ?? 3) / 2; this.solid.top = m.pos.y + (m.height ?? 3) / 2; }
    else { this.solid.bottom = m.pos.y; this.solid.top = m.pos.y + (m.height ?? 3); }
    m.group.position.copy(m.pos);
    // (its yaw alone, set whole: v1.70, issue #319. A fitted skin took the procedural body's turn as a quaternion when it
    // loaded, and facing away from the hall's door (a heading past a quarter turn) that read back as a half turn on x and
    // z with the yaw mirrored; setting the yaw alone after it, the Keeper and the Elder faced π − heading, away from
    // you, and struck behind them)
    m.group.rotation.set(0, m.heading, 0);
  }

  /**
   * Walk toward `to` (on the floor), turning; returns the speed. `face` (a point, or null): it steps there sideways or
   * back, turned to face it all the while (def.faceYou: the Keeper keeps its head on you as it circles, issue #321), at
   * FACE_WALK of its speed.
   */
  walk(dt, to, speed = 2.2, keep = 0, face = null) {
    const m = this.model;
    _a.subVectors(to, m.pos).setY(0);
    const d = _a.length();
    let sp = 0;
    if (face) this.face(dt, face, 2.5);
    if (d > keep + 0.3) {
      _a.normalize();
      if (face) {
        sp = Math.min(speed * FACE_WALK, (d - keep) * 2);
        m.pos.x += _a.x * sp * dt; m.pos.z += _a.z * sp * dt;
      } else {
        this.turnTo(dt, Math.atan2(_a.x, _a.z), 2.5);
        sp = Math.min(speed, (d - keep) * 2);
        m.pos.x += Math.sin(m.heading) * sp * dt; m.pos.z += Math.cos(m.heading) * sp * dt;
      }
    }
    this.keepIn();
    return sp;
  }
  /**
   * Inside the arena. A body with its blows on its bones (model.hitParts) is kept in by them, as posed last frame: every
   * sphere of its shell and head inside the wall (KEEP_IN.wall m short of it) and off the arena's posts (arena.posts
   * [{ x, z, r }]: the cistern's spout), its middle pushed back by as much as the furthest is past (issue #320: "he
   * clips into the walls at times": its middle was kept its radius off the wall, its 7.8 m shell and its neck were not).
   */
  keepIn() {
    const m = this.model, A = this.arena;
    _b.subVectors(m.pos, A.center).setY(0);
    const r = A.r - (m.radius ?? 2.6) - 1;
    if (_b.length() > r) { _b.setLength(r); m.pos.x = A.center.x + _b.x; m.pos.z = A.center.z + _b.z; }
    // (fighting only: weary, it lays its head by the spout, as it should)
    // (a body without hitParts that asks to be kept in, def.keepIn: by its mouth, the Keeper's procedural body)
    if (!(m.hitParts || this.def.keepIn) || !this._posed || !(this.state === 'fight' || this.state === 'open' || this.state === 'shift')) return;
    const S = this._keepS ??= [];
    S.length = 0;
    if (m.hitParts) { for (const n of KEEP_IN.parts) for (const s of m.hitParts(n, this._one ??= [])) S.push(s); }
    else S.push({ c: m.mouth, r: m.mouthR ?? 1 });
    let px = 0, pz = 0;
    for (const s of S) {
      // (each sphere where it would be with its middle moved since it was posed)
      const cx = s.c.x + m.pos.x - this._posed.x, cz = s.c.z + m.pos.z - this._posed.z;
      const dx = cx - A.center.x, dz = cz - A.center.z, d = Math.hypot(dx, dz), over = d + s.r * KEEP_IN.r - (A.r - KEEP_IN.wall);
      if (over > 0 && d > 1e-3 && over * over > px * px + pz * pz) { px = (-dx / d) * over; pz = (-dz / d) * over; }
      for (const o of A.posts ?? []) {
        const ox = cx - o.x, oz = cz - o.z, od = Math.hypot(ox, oz), need = o.r + s.r * KEEP_IN.r - od;
        if (need > 0 && od > 1e-3 && s.c.y - A.y < (o.h ?? Infinity) + s.r && need * need > px * px + pz * pz) { px = (ox / od) * need; pz = (oz / od) * need; }
      }
    }
    // (in a move never faster than KEEP_IN.speed m/s: a push all at once slid its body off its braced feet, which crossed under it)
    const L = Math.hypot(px, pz), cap = this.attack ? KEEP_IN.speed * (this._dt ?? 1 / 60) : Infinity;   // (in a move: walking, its feet step with it)
    if (L > cap) { px *= cap / L; pz *= cap / L; }
    m.pos.x += px; m.pos.z += pz;
    if (px || pz) this._pushed = true;   // (its feet may step under it then, braced or not: GuardianLegs, `pushed`)
  }
  face(dt, p, rate = 4) {
    const m = this.model;
    this.turnTo(dt, Math.atan2(p.x - m.pos.x, p.z - m.pos.z), rate);
  }
  /** Turn toward heading `want` at `rate` (a share a second), never faster than the body's turnRate (rad/s). */
  turnTo(dt, want, rate) {
    const m = this.model, d = Math.atan2(Math.sin(want - m.heading), Math.cos(want - m.heading)) * Math.min(1, dt * rate), cap = (m.turnRate ?? Infinity) * dt;
    let step = THREE.MathUtils.clamp(d, -cap, cap);
    // (turnAccel, rad/s²: a big body gathers its turn and slows out of it; the Elder went from still to 3 rad/s in a
    // frame, her wingtips 13 m/s at once, #237. A turn not asked for last frame starts from still.)
    if (m.turnAccel && dt > 0) {
      const v = this._turnF === this.frame - 1 || this._turnF === this.frame ? this._turnV ?? 0 : 0, a = m.turnAccel * dt;
      this._turnV = v + THREE.MathUtils.clamp(step / dt - v, -a, a); this._turnF = this.frame;
      step = this._turnV * dt;
    }
    m.heading += step;
  }

  update(dt, t) {
    const P = this.rt.player, m = this.model, A = this.arena;
    this.t += dt; this._dt = dt;
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
    this.frame = (this.frame ?? 0) + 1;
    this.updateWaves(dt, P);
    if (m.hitParts || this.def.keepIn) this.keepIn();   // (turning on the spot by a wall swings its head and shell too: kept in every frame)
    this.place();
    this.solid.vel.subVectors(m.pos, this.prev).divideScalar(Math.max(dt, 1e-4));
    this.prev.copy(m.pos);
    this.poseRig(dt, t);
    // (the locomotion kit's view of the world, src/temples/guardians.js: where you are for its detail tiers, the floor under a step)
    const kit = (this.motionKit ??= { eye: null, ground: (x, y, z) => { const g = this.rt.physics?.groundAt?.(x, y, z, 6); return Number.isFinite(g) ? g : null; } });
    kit.eye = P?.pos ?? null;
    m.animate(dt, t, { state: this.state, attack: this.view, k: this.attackK, speed, meter: this.meter, phase: this.phaseIndex, kit, pushed: !!this._pushed });
    this._pushed = false;
    (this._posed ??= V()).copy(m.pos);   // (where its middle was as its bones were posed: keepIn reads them from there)
    this.ground.update();
    this._meshFrame = this._mesh = null;   // (posed anew: a body blow's mesh is sampled again when next asked, meshParts)
    this.blast.draw(!!this.live?.blast && this.state === 'fight');
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
        if (aiming) (this.aimP ??= V()).copy(P.pos);   // (where you were as its aim held: a beam's pitch)
        // (a body that travels over the spot comes no nearer the wall than it may stand: keepIn; else it landed in the
        // wall and was pushed off it again, its blow struck from where it never stood)
        if (a.over && aiming) { _b.subVectors(this.attackAt, A.center).setY(0); const r = A.r - (m.radius ?? 2.6) - 1; if (_b.length() > r) this.attackAt.set(A.center.x, A.y, A.center.z).addScaledVector(_b.setLength(r), 1); }
        if (a.shape !== 'ring' || a.at === 'front') { if (aiming && !m.rooted) this.face(dt, P.pos, 5); else if (aiming) this.face(dt, P.pos, 3); this.attackH = m.heading; }
        if (a.at === 'self') this.attackAt.copy(m.pos).setY(A.y);
        if (a.at === 'front') this.attackAt.set(m.pos.x + Math.sin(m.heading) * (a.ahead ?? 4), A.y, m.pos.z + Math.cos(m.heading) * (a.ahead ?? 4));
        // (a.leap [from, to]: it springs over only between those shares of the wind-up, the spot fixed by then: the Keeper's
        // leap, issue #320, in place of a burrow its cistern's stone floor made no sense of)
        const [u0, u1] = a.leap ?? [0, 0.7];
        if (a.over && !m.rooted && dt > 0 && this.at >= wind * u0) {
          // its body travels to hang over (or plough under the sand to) the spot, there by 70 % of the wind-up
          _a.subVectors(this.attackAt, m.pos).setY(0);
          const left = Math.max(dt, wind * u1 - this.at), d = _a.length();
          if (d > 0.05) { m.pos.addScaledVector(_a.normalize(), Math.min(d, (d / left) * dt, 14 * dt)); this.keepIn(); }
        }
        if (a.lob && a.volley > 1) this.spreadMarks(a);
        this.attackK = this.at / wind;
      } else if (!this.struck) {
        this.struck = true;
        this.attackK = 1;
        this.hitLast = this.strike(a, P);
      } else if (this.live) {
        // (a blow on its bones, or drawn: it lands where it meets you, over its active window)
        if (this.live.blast) this.blast.set((this.at - wind) / this.live.for, a.blast.kind === 'beam' ? this.partAt(a.blast.from ?? a.part ?? 'core', (this._from ??= V()), a.side ?? 1) : null);
        if (this.contact(P)) this.hitLast = true;
        if (this.live && this.at > wind + this.live.for) { this.live = null; this.blast.draw(false); }
      } else if (this.at > wind + (a.then ? (a.gap ?? 0.25) : (a.recover ?? 0.8))) {
        const next = a.then && !P.dead && !P.down ? this.def.attacks[a.then] : null;
        if (next) { this.begin(P, a.then); return 0; }
        // a combo's last move, or a lone one: open after it (it pants, its vents open), or stuck if it missed you;
        // a combo cut short (you are down) still ends in its opening: it has spent itself all the same
        const end = a.then ? this.def.attacks[comboOf(this.def, this.attack.id).at(-1)] : a;
        const missed = !this.hitLast && !!a.miss && a.miss > (end.open ?? 0);
        // (a temple may change it: the Cloud-Mother's last phase opens only on a stone the bell holds, def.openFor)
        let openFor = this.def.openFor?.(this, end, missed ? a.miss : end.open ?? 0, missed) ?? (missed ? a.miss : end.open ?? 0);
        // (the phase's second verb not answered yet: no opening of its own; it says what it waits for)
        if (openFor && this.asking) { openFor = 0; this.rt.notice?.(this.phase.asks.hint, `asks.${this.phaseIndex}`); }
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
    const speed = m.rooted ? 0 : this.walk(dt, want, this.def.speed ?? 2.4, 1, this.def.faceYou ? P.pos : null);
    if (speed < 0.2) this.face(dt, P.pos, 2);
    this.cool -= dt;
    if (this.cool <= 0 && !P.dead) this.begin(P);
    return speed;
  }
  /** Begin a move: the phase's next in turn (one that reaches you), or `id` (a combo's next). */
  /** How far a move reaches from its body (m): a dive or a lob follows you anywhere. */
  reachOf(a) { return a.reach ?? (a.shape === 'cone' || a.shape === 'lane' ? a.range ?? 12 : a.at === 'player' ? Infinity : (a.radius ?? 4) + (a.at === 'front' ? a.ahead ?? 4 : 0) + (a.wave?.reach ?? 0)); }
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
    if (!picked && !chained) this.order++;   // (a combo's links are not moves of the rotation: a three-move combo in a list of three locked it on that one, v1.63)
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
    // a blow on its bones (a.parts) or drawn (a.blast): live over its active window, landing where it meets you (contact)
    if (this.bodyBlow(a) || a.blast) {
      const S = a.blast, blast = S ? this.blast.aim(this, a, this.partAt(S.from ?? a.part ?? 'core', V(), a.side ?? 1), this.aimP) : null;
      this.live = { a, for: (a.active ?? (S ? (S.kind === 'beam' ? (S.sweep ? BLAST.sweep : BLAST.beam) : BLAST.front) : 0.15)) + (a.late ?? 0), done: false, blast: !!blast };
      return this.contact(P);
    }
    if (P.dead || P.down || P.staggered) return false;   // (staggered by a blow a moment ago: src/player.js STAGGER.guard)
    if (P.untouchable?.()) { this.answer('dodge'); return false; }   // (a perfect dodge's flurry: src/flurry.js; the phase's second verb, asks)
    if (P.pos.y - this.arena.y > (a.reachUp ?? (a.shape === 'lane' ? 3.5 : HIT.airborne))) return false;   // jumped clear (a beam reaches a little higher)
    const at = this.points(a).find((p) => inArea(a, p, this.attackH, P.pos));
    if (!at) return false;
    return this.lands(a, P, a.shape === 'ring' ? at : this.model.pos);
  }
  /** Does move a land with its body (its `parts`: the model's posed bones, or its posed mesh)? */
  bodyBlow(a) { return !!a?.parts; }
  /** The spheres move a strikes with now (world { c, r }), its parts on the posed bones (or mesh), a.splash wider. */
  partsOf(a, out = (this._parts ??= [])) {
    out.length = 0;
    if (!a?.parts) return out;
    const add = a.splash ?? 0, list = this.model.hitParts ? a.parts.flatMap((n) => this.model.hitParts(n, [])) : this.meshParts(a.parts);
    for (const s of list) out.push(add ? { c: s.c, r: s.r + add } : s);
    return out;
  }
  /**
   * Its posed mesh as spheres (MESH_PARTS), near the named parts: the body a blow lands with on a body that names no
   * bones of its own. Sampled once a frame.
   */
  meshParts(names) {
    const key = `${this.frame ?? 0}:${names.join(',')}`;
    if (this._mesh?.key === key) return this._mesh.out;
    const m = this.model, C = MESH_PARTS, v = _a;
    if (this._meshFrame !== (this.frame ?? 0)) {
      // (every drawn vertex of its body, posed now: one point a cell)
      this._meshFrame = this.frame ?? 0;
      // (only what is at his height: a part over his head meets no traveller on the floor)
      const cells = new Map(), top = this.arena.y + COLUMN.h + C.top;
      m.group.updateMatrixWorld(true);
      m.group.traverse((o) => {
        if (!o.isMesh || !o.visible || o.userData.noBody || o.userData.blow) return;
        const p = o.geometry?.attributes?.position;
        if (!p || /glyph|marks|tele|glow|shadow/i.test(o.name)) return;
        const step = o.isSkinnedMesh ? C.skinStep : Math.max(1, Math.floor(p.count / C.max));
        if (o.isSkinnedMesh) o.skeleton?.update();
        for (let i = 0; i < p.count; i += step) {
          if (o.isSkinnedMesh) o.getVertexPosition(i, v); else v.fromBufferAttribute(p, i);
          v.applyMatrix4(o.matrixWorld);
          if (v.y > top) continue;
          const k = `${Math.round(v.x / C.cell)},${Math.round(v.y / C.cell)},${Math.round(v.z / C.cell)}`;
          if (!cells.has(k)) cells.set(k, v.clone());
        }
      });
      this._cells = [...cells.values()];
    }
    const near = [];
    for (const n of names) {
      if (n === 'body') { near.length = 0; break; }
      for (const side of PAIRED.has(n) ? [1, -1] : [1]) { const q = this.partAt(n, V(), side); if (q) near.push(q); }
    }
    const R = (m.radius ?? 3) * C.near, out = [];
    for (const c of this._cells) if (!near.length || near.some((q) => q.distanceTo(c) < R)) out.push({ c, r: C.r });
    this._mesh = { key, out };
    return out;
  }
  /**
   * Does a sphere of move a's parts meet a traveller standing at p (his feet; a column HIT.column m high and `r` round)?
   * The fight's own test, also for the QC (.claude/skills/combat-review/guardian.mjs): the parts as posed now.
   */
  touches(a, p) {
    const C = COLUMN;
    // (a drawn blow, where it is now)
    if (a.blast && this.live?.blast && this.live.a.id === a.id && this.blast.touches(p)) return true;
    for (const s of this.partsOf(a)) {
      const y = THREE.MathUtils.clamp(s.c.y, p.y, p.y + C.h);
      if (Math.hypot(s.c.x - p.x, y - s.c.y, s.c.z - p.z) < s.r + C.r) return true;
    }
    return false;
  }
  /** Would move a, struck now, reach a traveller standing at p? Its body's parts if it has them, else its area. */
  wouldHit(a, p) { return this.bodyBlow(a) || a.blast ? this.touches(a, p) : this.points(a).some((o) => inArea(a, o, this.attackH, p)); }
  /** Over a body blow's active window: its parts meet you now? Lands once. */
  contact(P) {
    const L = this.live;
    if (!L || L.done || !P || P.dead || P.down || P.staggered) return false;
    if (this.at < this.windFor + (L.a.late ?? 0)) return false;   // (a.late s: live only once its body has come down on you)
    if (!this.touches(L.a, P.pos)) return false;
    L.done = true;
    if (P.untouchable?.()) { this.answer('dodge'); return false; }   // (in a perfect dodge's flurry it passes through)
    return this.lands(L.a, P, this.model.pos);
  }
  /** A blow that reached you: the phase's guard asked for, the shield, or it catches you (from `from`). */
  lands(a, P, from) {
    // the phase asks for the guard against this move (asks.verb 'parry'): held, it is jarred open
    const A = this.phase?.asks;
    if (A?.verb === 'parry' && A.moves.includes(a.id)) { const held = P.guard?.(this.model.pos); if (held) { this.answer('parry', held === 'perfect'); return false; } }
    // a move the guard can take (its `guard`: the Keeper's charge and stamp): the shield raised toward it holds it
    // (src/fluid-blade.js block, through player.guard), and the guardian may answer (def.onBlock: jarred, it pants)
    if (a.guard) { const held = P.guard?.(this.model.pos); if (held) { this.blocked = (this.blocked ?? 0) + 1; this.def.onBlock?.(this, a, held === 'perfect'); return false; } }
    this.catch(a, P, from, a.damage, a.knock);
    return true;
  }
  /**
   * It catches you: knocked back, away from `from`, and a bite of the bar (never the last of a healthy one). On his feet
   * (src/player.js stagger, issue #331: the ragdoll every blow, "enemies hitting me shouldn't ragdoll me"); a traveller
   * without one (the tests' stand-ins) is knocked down as before.
   */
  catch(a, P, from, damage, knock) {
    const dmg = strikeDamage(heartsOf(P), quarters(damage ?? DAMAGE.heavy));
    _a.subVectors(P.pos, from).setY(0);
    if (_a.lengthSq() < 1e-4) _a.set(Math.sin(this.model.heading), 0, Math.cos(this.model.heading));
    _a.normalize().multiplyScalar(knock ?? 9).addScaledVector(UP, 4);
    if (P.stagger) P.stagger(_a, { why: 'guardian' }); else P.knockDown?.(_a, { why: 'guardian' });
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
      if (!w.hit && P && !P.dead && !P.down && !P.staggered && !P.untouchable?.() && Math.abs(d - w.r) < (w.W.width ?? 0.6) && P.pos.y - this.arena.y < 0.6) { w.hit = true; this.catch(w.a, P, w.at, w.W.damage ?? 0.5, w.W.knock ?? 7); }
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
    // (def.glow false: no spark on the striking part, its body's wind-up the whole tell; the Keeper's, issue #320: "his
    // attack tell looks like a weird triangle shape, there's no need for it since he telegraphs his attacks better now")
    if (this.def.glow === false) for (const g of this.glows) g.hide();
    else {
      this.glows[0].set(k, this.partAt(part, _e, 1), t);
      if (PAIRED.has(part)) this.glows[1].set(k, this.partAt(part, _e, -1), t); else this.glows[1].hide();
    }
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
      // (a.twist: how far its body turns, rad; the Keeper's own neck carries its sweep, its six feet planted under it)
      case 'coil': if (winding) ry = -s0 * (a.twist ?? 0.55) * u; else if (struck) { ry = s0 * (a.twist != null ? a.twist * 1.1 : 0.6); rate = 14; } break;
      case 'spin': spin = winding ? 2 + 14 * u : struck ? 16 : 0; break;
      case 'lean': if (winding) { x = -0.15 * u; z = -0.08 * H * u; } else if (struck) { x = 0.08; z = 0.06 * H; rate = 16; } break;
      case 'rise': if (winding) y = 0.4 * H * u; else if (struck) { y = -0.1 * H; rate = 14; } break;
      case 'swell': if (winding) s = 1 + 0.12 * u; else if (struck) { s = 0.94; rate = 18; } break;
    }
    if (this.state === 'open') { sy = 1 + 0.03 * Math.sin(t * 5); y = -0.03 * H; }
    if (this.state === 'shift') { const k = Math.min(1, this.t / 0.4) * Math.max(0, 1 - this.t / (this.def.shiftTime ?? SHIFT)); x = -0.15 * k + 0.04 * Math.sin(t * 31); ry = 0.05 * Math.sin(t * 23); y = 0.05 * H * k; }
    // (a body whose own poses tell its moves takes only `tellWeight` of these: the Elder's, issue #237, reared 0.8 m and
    // rose 2.8 m out of her own poses, her legs tucked as if flying)
    const w = this.model.tellWeight ?? 1;
    if (w !== 1) { x *= w; y *= w; z *= w; ry *= w; spin *= w; s = 1 + (s - 1) * w; sy = 1 + (sy - 1) * w; }
    const e = Math.min(1, dt * rate);
    K.x += (x - K.x) * e; K.y += (y - K.y) * e; K.z += (z - K.z) * e; K.ry += (ry - K.ry) * e; K.s += (s - K.s) * e; K.sy += (sy - K.sy) * e;
    K.spin = spin ? K.spin + spin * dt : K.spin * Math.max(0, 1 - dt * 3);
    R.rotation.set(K.x, K.ry + K.spin, 0, 'YXZ');
    R.position.set(0, K.y, K.z);
    R.scale.set(K.s, K.s * K.sy, K.s);
  }
  dispose() {
    GUARDIANS_LIVE.delete(this);
    for (const f of this.offs) f();
    this.tele.group.removeFromParent(); this.tele.dispose?.();
    for (const T of this.teles) T.dispose();
    for (const g of this.glows) g.dispose();
    for (const b of this.balls) { b.removeFromParent(); b.geometry.dispose(); }
    this.clearWaves(); this.marks.dispose(); this.ground.dispose(); this.blast.dispose(); releaseMaterial(this.ballM); releaseMaterial(this.blastM);
  }
}
