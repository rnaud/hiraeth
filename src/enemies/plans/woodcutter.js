import * as THREE from 'three';
import { Rig, planLeg } from '../../motion-kit/rig.js';
import { PLANS } from '../../motion-kit/plans.js';
import { materials, add, many, skinBy, pivot, pair, lerp, ease, eyeColor, finish, outerPoints, lowestIn, plate, shellPlate, shade, tubeGeometry } from './kit.js';
import { surfaceColor } from '../surfaces.js';
import { gazePart } from '../gaze.js';

// The wood cutter, built direct (issue #800 phase 2b). The game draws Tripo's body (woodcutter-tripo.js, the author's
// pick); this one is the trials' other, and stands in for it only while its mesh loads (src/enemies/foe-assets.js). This
// file holds what both bodies share: the numbers, the def's reach (woodcutterDef), the tools and the motion. Drawn to
// the approved reference
// (references/enemy-redesign-2026-10-30/keep-brute/a1860f49-…-0.png): a compact sage-green robot 2.4 m tall (the author's
// 2.2–2.6 m; today's brute is 4.7 m), a round barrel of a torso with a seam across its chest and an ochre vent on its
// belly, a pale dome of a head sunk in its top with one black visor slit, two great round pauldrons, short thick legs
// on wide rounded boots, a rust-red circular saw on its right forearm and an open dark-green clamp of a hand on its left.
// Broad masses and few flat colours (the Scavengers Reign brief).
//
// It is the brute in everything but its body and its size (its own archetype since #800: the brute's skins' palettes, sounds (FOE_CALLS 'iron',
// FOE_MOVES 'brute'), guard, stout, plates (#722: the two pauldrons and a breastplate), weak point (the belly vent, its
// louvres glowing as it winds up), its coming apart into pieces, its calm (rusted mid-task, slumped). Its def is the
// brute's with the reach scaled to its new height and every timing window kept (woodcutterDef). On the same rig family:
// the motion kit's brute plan (two short legs, the knee forward, a slow heavy step on soft springs), its step scaled to
// its legs (WOODCUTTER_PLAN), the arms on pivots (shoulder, elbow, wrist) skinned rigid, a part to a joint.
//
// Its attacks read from the body (src/telegraph.js; only the hurled slab marks the ground):
//   slam   both arms rise straight up over its head, the torso arching back, the vent glowing; then down: the saw's
//          edge and the clamp bite the ground before it (they meet it: touchGround), and the quake runs out
//   hurl   it bends over, its clamp tearing a slab out of the ground, straightens with it high over its shoulder, throws
//   sweep  the saw arm swings back behind it, the shoulder turning; then a backhand across its front at chest height
// Guarded, its forearms come up crossed before its visor; broken, flung wide.
//
// Draws: the hull, the head and every limb one skinned mesh (kit.js skinBy, each part's colour a vertex tint), the ochre
// fittings another, the saw's disc its own (it spins), the visor, the vent's glow, the three plates: about 8.

/** Its numbers (m): the top of its head; the hips; the shoulders' pivots; the arm's two segments; the saw's radius. */
export const WOODCUTTER = { height: 2.4, hipY: 0.9, sh: { x: 0.7, y: 1.84 }, upper: 0.42, fore: 0.46, saw: 0.38, radius: 0.7, chest: 1.45 };
const W = WOODCUTTER, UPPER = W.upper, FORE = W.fore;
/** The torso's profile (r, y): a barrel, widest a little under its middle, rounded under, its top a collar round the head. */
const BARREL = [[0.001, 0.84], [0.3, 0.86], [0.48, 0.92], [0.58, 1.02], [0.62, 1.18], [0.63, 1.4], [0.61, 1.6], [0.56, 1.78], [0.48, 1.9], [0.38, 1.97], [0.28, 2.0], [0.001, 2.0]].map(([r, y]) => new THREE.Vector2(r, y));
const DEPTH = 0.9;   // (its depth to its width: nearly round)
const radiusAt = (y) => { for (let i = 1; i < BARREL.length; i++) if (BARREL[i].y >= y) { const a = BARREL[i - 1], b = BARREL[i]; return lerp(a.x, b.x, (y - a.y) / Math.max(1e-6, b.y - a.y)); } return 0.001; };
/** The share of its gaze its torso twists by (its head turns the rest). */
export const GAZE_TWIST = 0.2;
/** Clearance of its hands and tool over the ground at rest, and where they meet it in a slam's blow (root frame, m). */
export const ARM_CLEAR = 0.04, BITE = 0.0;

/**
 * The brute's plan for a body half its size (src/motion-kit/plans.js brute): the same alternate gait, knee and springs,
 * its step a little quicker and lower, the poses' dips and leans scaled to its height.
 */
const k = W.height / 4.7;
export const WOODCUTTER_PLAN = {
  ...PLANS.brute,
  gait: { ...PLANS.brute.gait, stepTime: [0.32, 0.6], height: 0.1 },
  body: { ...PLANS.brute.body, bob: 0.06, sway: 0.4 },
  poses: Object.fromEntries(Object.entries(PLANS.brute.poses).map(([n, p]) => [n, { ...p, ...(p.y != null ? { y: +(p.y * k * 1.3).toFixed(3) } : {}), ...(p.z != null ? { z: +(p.z * k * 1.3).toFixed(3) } : {}) }])),
  name: 'brute (wood cutter)',
};

/**
 * Its def: the brute's (ARCHETYPES.brute.def, a tier's or a stage's laid over it) with the reach scaled to a 2.4 m body.
 * Every timing window is the brute's (wind, strike, contact, recover, cool, the guard's hold and rest): the parry and
 * evade contract is unchanged; what is nearer is where it stands and what its arms reach. The quake (the slam's ring
 * that you jump) and the hurl's range are not the body's reach: kept.
 */
export function woodcutterDef(def) {
  const a = (id, o) => { const x = def.attacks.find((y) => y.id === id); return x ? { ...x, ...o } : null; };
  const attacks = def.attacks.map((x) => (x.id === 'slam' ? a('slam', { radius: 1.45, ahead: 1.5, max: 2.7 })
    : x.id === 'sweep' ? a('sweep', { range: 2.5, max: 2.4 })
    : x.id === 'hurl' ? a('hurl', { radius: 1.4 })
    : x));
  const out = { ...def, radius: W.radius, height: W.chest, attacks, attack: attacks[0], ...(def.guard ? { guard: { ...def.guard, near: 3.2 } } : {}) };
  return out;
}

/** The wood cutter's archetype id (src/enemies/archetypes.js ARCHETYPES.woodcutter: its own enemy beside the brute, #800). */
export const WOODCUTTER_ID = 'woodcutter';

/** The reference's own colours, on its home skin (Lorn II's wood cutter); the other skins keep their world's palette. */
export const WOODCUTTER_OWN = {
  perdide2: { body: '#7f9f88', body2: '#93b19a', joint: '#2f4b3b', head: '#e5cfbb', visor: '#18161c', saw: '#8c3d2c', clamp: '#7a3527', brass: '#c8922f', band: '#5c5c37', core: '#f0b54a', dark: '#1e2622' },
};
/** Each part's surface (src/foe-surface.js): a soft mottle on the hull, a fine net of cracks whose veins open as it is hurt. */
const PAINT = {
  body: {
    cracks: { color: 'glow', ink: 'joint', inkAmount: 0.06, scale: 0.3, width: 0.008, tone: 0.01, veins: 0.3, vein: 0.02, glow: 0.9, share: 0.12 },
    mottle: { color: 'body2', scale: 0.22, amount: 0.25, soft: 0.25, strength: 0.4 },
    gloss: { size: 0.03, sky: 0.3, amount: 0.3 },
  },
  saw: { rust: { color: 'saw*0.75', color2: '#c27a4e', amount: 0.3, amount2: 0.15, scale: 0.05, down: 0.2, pits: 0.5 } },
  brass: { gloss: { size: 0.03, sky: 0.4, amount: 0.5 } },
};
const paint = (name, P) => Object.fromEntries(Object.entries(PAINT[name]).map(([kk, v]) => [kk, Object.fromEntries(Object.entries(v).map(([f, x]) => [f, typeof x === 'string' ? surfaceColor(x, P) ?? x : x]))]));

/** A saw disc in the y–z plane (its normal along x): `n` square teeth round its rim, radius r, t thick. */
export function sawDisc(r, t, n = 12) {
  const s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / n) * 0.45, a2 = a0 + (Math.PI * 2 / n) * 0.62;
    const R0 = r * 0.84, R1 = r;
    const p = (rr, a) => [Math.cos(a) * rr, Math.sin(a) * rr];
    if (i === 0) s.moveTo(...p(R0, a0)); else s.lineTo(...p(R0, a0));
    s.lineTo(...p(R1, a0 + 0.03)); s.lineTo(...p(R1, a1)); s.lineTo(...p(R0, a2));
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.12, 0, Math.PI * 2, true); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -t / 2).rotateY(Math.PI / 2);
}

/**
 * The other worlds' tools, in the frame of the hand that holds them (its −y down the forearm), shared by the direct body
 * and the Tripo one: Viridel's shears (two blades on a pin), the Moon Foundry's ladle (its iron and the melt in its bowl,
 * hung from the fist at (0, −0.2, 0.08)), the Waterfall's turbine (its eight vanes, on the chest).
 */
export const WOODCUTTER_TOOLS = {
  shears: () => ({ blades: pair((t) => new THREE.ConeGeometry(0.06, 0.55, 4).scale(1, 1, 0.35).rotateZ(Math.PI + t * 0.12).translate(t * 0.06, -0.38, 0.05)), pin: new THREE.CylinderGeometry(0.04, 0.04, 0.18, 10).rotateZ(Math.PI / 2).translate(0, -0.1, 0.05) }),
  ladle: () => ({ iron: [new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8).translate(0, -0.3, 0.1).rotateX(-0.5), new THREE.SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, -0.7, 0.4)], melt: new THREE.CircleGeometry(0.15, 12).rotateX(-Math.PI / 2).translate(0, -0.72, 0.4) }),
  vanes: () => Array.from({ length: 8 }, (_, j) => new THREE.BoxGeometry(0.05, 0.22, 0.02).translate(0, 0.13, 0).rotateY(0.5).rotateZ((j / 8) * Math.PI * 2)),
};

/**
 * The arm poses, the hands on the ground and the attacks, shared by the direct body and the Tripo one (their joints:
 * `arms` [{ sh, el, fist, hand?, reach }] right (x < 0, the saw's) then left; `hull` the body the rig moves).
 */
export function woodcutterMotion({ g, hull, arms, rig, slab, coreM, eyeM, bodyM, P, props = new Set(), saw = null, fan = null, head = null, hullY = 0 }) {
  const U = bodyM?.uniforms?.uFsCracksO;   // (the veins: wider and brighter as it is hurt)
  const lowest = (a) => lowestIn(g, a.fist, a.reach);
  /** Bend arm a's elbow forward until its hand (and tool) clear the ground (the forearm's swing lifts it). */
  const clearGround = (a, clear = ARM_CLEAR) => {
    for (let i = 0; i < 6; i++) {
      const need = clear - lowest(a);
      if (need <= 0) return;
      const was = a.el.rotation.x;
      a.el.rotation.x = Math.max(-2.2, was - Math.min(0.6, need * 2));
      if (a.el.rotation.x === was) return;
    }
  };
  /** Swing arm a's shoulder down (toward hanging) until its lowest point meets the ground at `want` (a blow lands). */
  const touchGround = (a, want = BITE) => {
    let x0 = a.sh.rotation.x, y0 = lowest(a) - want;
    if (y0 <= 0) return;
    // (secant steps between where it is and hanging straight down, as far as needed)
    let x1 = Math.min(0, x0 + 0.25); a.sh.rotation.x = x1; let y1 = lowest(a) - want;
    for (let i = 0; i < 6 && Math.abs(y1) > 0.005; i++) {
      const x2 = THREE.MathUtils.clamp(x1 - y1 * (x1 - x0) / ((y1 - y0) || 1e-6), -3, 0.2);
      x0 = x1; y0 = y1; x1 = x2; a.sh.rotation.x = x1; y1 = lowest(a) - want;
    }
  };
  let raise = 0, bend = 0, back = 0, swing = 0, wake = 0, glow = 0, wall = 0, flung = 0, spin = 0, twitchT = 0, dive = 0;
  const twitch = [0, 0];
  const _v = new THREE.Vector3();
  return function anim(f, c) {
    const id = f.atk?.id, dt = c.dt, wind = f.state === 'wind', strike = f.state === 'strike';
    // calm: slumped where it stopped working; roused, it lifts its arms (a groan: Foes.meet)
    wake = ease(wake, f.state === 'idle' && !f.provoked ? 0 : 1, 1.6, dt);
    const up = id === 'slam' ? (wind ? c.wind : strike ? 1 - c.release : 0) : 0;
    raise = ease(raise, up, wind ? 9 : 16, dt);
    const hk = id === 'hurl' && wind ? f.k : 0;
    bend = ease(bend, hk > 0 ? (hk < 0.45 ? THREE.MathUtils.smoothstep(hk, 0, 0.3) : 1 - THREE.MathUtils.smoothstep(hk, 0.45, 0.75)) : 0, 10, dt);
    const lift = hk > 0.45 ? THREE.MathUtils.smoothstep(hk, 0.45, 0.75) : 0;
    back = ease(back, id === 'sweep' && wind ? c.wind : 0, 9, dt);
    swing = ease(swing, id === 'sweep' && strike ? 1 : 0, 18, dt);
    const o = rig.update(f, dt, { eye: c.eye, ground: c.ground, recovery: c.recovery, air: f.alt > 0.05 ? 1 : 0,
      touch: (at, L) => { c.touch(at, L); c.thump?.(at, 0.45); } });
    wall = ease(wall, f.guardK ?? 0, 10, dt);
    flung = ease(flung, f.reel === 'guardbroken' && f.stunned > 0 ? 1 : 0, f.reel === 'guardbroken' ? 12 : 3, dt);
    // (its arms end at its knees: to bite the ground it bends deep at the hips and drops on its knees, the blow's weight)
    dive = ease(dive, strike && id === 'slam' ? THREE.MathUtils.smoothstep(c.release, 0.1, 0.7) : bend * 0.8, strike ? 22 : 7, dt);
    const slump = 1 - wake;
    hull.position.set(o.x, hullY + o.y - slump * 0.06 - dive * 0.24, o.z + dive * 0.05);
    hull.rotation.set(o.pitch + slump * 0.14 + wall * 0.06 - flung * 0.2 + dive * 0.62, o.yaw, o.roll);
    hull.rotation.y += (f.gaze?.yaw ?? 0) * GAZE_TWIST * wake;
    if (head) head.rotation.x = slump * 0.35;   // (its head hangs while it is rusted still)
    const walk = Math.sin(rig.walked * 2.6) * Math.min(1, Math.hypot(rig.vel.x, rig.vel.z) / 1.2) * 0.3;
    for (const [i, a] of arms.entries()) {
      const sgn = i ? 1 : -1;
      let x = sgn * walk + slump * -0.08, z = sgn * 0.08, y = 0, elb = (i ? -0.12 : -0.55) - slump * 0.25;   // (the saw held a little forward, as drawn)
      // slam: both arms straight up over its head, the elbows a little bent, the tools together
      x = lerp(x, -2.95, raise); elb = lerp(elb, -0.3, raise); z = lerp(z, -sgn * 0.3, raise);
      if (strike && id === 'slam') { x = lerp(-2.95, -1.05, c.release); elb = lerp(-0.3, -0.1, c.release); z = lerp(-sgn * 0.3, -sgn * 0.1, c.release); }
      // hurl: the clamp arm down to the ground, then up over its shoulder with the slab
      if (i === 1) { x = lerp(x, -0.6, bend); elb = lerp(elb, -0.3, bend); x = lerp(x, -2.7, lift); elb = lerp(elb, -1.1, lift); z = lerp(z, 0.25, lift); }
      // sweep: the saw arm back and out behind it, then across the front at the height of your chest
      if (i === 0) { x = lerp(x, 0.8, back); z = lerp(z, -1.2, back); y = lerp(y, -0.5, back); if (swing > 0) { x = lerp(0.8, -1.45, swing); z = lerp(-1.2, 0.45, swing); y = lerp(-0.5, 0.9, swing); } }
      // the guard: forearms crossed before its visor; flung wide when broken
      x = lerp(x, -1.15, wall); elb = lerp(elb, -1.9, wall); z = lerp(z, -sgn * 0.7, wall); y = lerp(y, 0, wall);
      x = lerp(x, -0.9, flung); z = lerp(z, sgn * 1.3, flung); elb = lerp(elb, -0.15, flung); y = lerp(y, 0, flung);
      a.sh.rotation.set(x, y, z);
      a.el.rotation.x = elb;
    }
    // the clamp's fingers twitch while it waits; they close round the slab
    twitchT -= dt;
    if (twitchT < 0) { twitch[Math.random() < 0.5 ? 0 : 1] = 0.25; twitchT = 0.6 + Math.random() * 1.6; }
    arms.forEach((a, i) => { twitch[i] = Math.max(0, twitch[i] - dt); if (a.hand) a.hand.rotation.x = (f.state === 'chase' || f.state === 'idle') && twitch[i] > 0 ? Math.sin(c.now / 30) * 0.12 : hk > 0.3 ? 0.35 : 0; });
    // the blow lands: the saw's edge and the clamp meet the ground before it (from the contact on), else clear of it
    const bite = strike && id === 'slam' && c.release > 0.55;
    for (const [i, a] of arms.entries()) {
      if (bite || (i === 1 && hk > 0.2 && hk < 0.45)) touchGround(a, i === 1 && !bite ? ARM_CLEAR : BITE);
      clearGround(a, bite ? BITE : ARM_CLEAR);
    }
    // the saw turns: idling slow, whining up through a wind-up, fast through a blow
    if (saw) { spin += dt * (strike ? 30 : wind ? 6 + 18 * c.wind : f.state === 'chase' ? 4 : wake * 1.2); saw.rotation.x = spin; }
    slab.visible = id === 'hurl' && wind && hk > 0.3 && hk < 0.8;
    if (id === 'hurl' && wind && f.k > 0.8) c.lob(f, (f.k - 0.8) / 0.2, P.slab ?? '#8a7f70'); else c.lob(f, -1);
    if (id === 'hurl' && wind && hk > 0.28 && hk < 0.4 && Math.random() < 0.5) c.dust(arms[1].fist.getWorldPosition(_v), P.slab ?? '#8a7f70', 2, 0.3);
    if (bite && saw && Math.random() < 0.6) c.dust(saw.getWorldPosition(_v).setY(f.pos.y), P.slab ?? '#8a7f70', 2, 0.3);
    // the veins open as it is hurt; the vent's louvres and the visor warm through a wind-up
    glow = ease(glow, wind ? 0.5 + 0.5 * c.wind : 0, 6, dt);
    if (U) U.value = Math.min(1, 1 - f.hp / f.def.hp + glow * 0.5);
    if (coreM) { coreM.uniforms.uColor.value.set(eyeColor(f, P.core, P.glow)); coreM.uniforms.uGlow.value = 0.3 + glow * 0.6; }
    if (eyeM && eyeM !== coreM) eyeM.uniforms.uColor.value.set(eyeColor(f, P.visor ?? P.dark, '#f3a361'));
    if (fan) fan.rotation.z += dt * (f.state === 'chase' ? 6 : 2);
    if (props.has('wet') && Math.random() < 0.08) c.drip(f, '#bfe2f2');
    g.position.y += f.alt;   // (held up off its feet: the magnet glove)
    rig.write();
  };
}

export function woodcutterModel(skin) {
  const P = { ...skin.palette, ...(WOODCUTTER_OWN[skin.id] ?? {}) }, props = new Set(skin.props), M = materials('brute', skin);
  P.head ??= P.body2; P.visor ??= P.dark; P.band ??= P.brass; P.clamp ??= P.joint;
  const home = !!WOODCUTTER_OWN[skin.id];
  const g = new THREE.Group(); g.name = `${skin.name} · wood cutter (direct)`;
  const body = pivot(g, 0, 0, 0, 'body');
  // (the hull turns about its hips: its frame `H` under it puts the parts at their heights over the ground)
  const hullTurn = pivot(body, 0, W.hipY, 0, 'hull'), hull = pivot(hullTurn, 0, -W.hipY, 0, 'hull frame');
  // the materials it is built in; the skinned meshes wear `bodyM` (the parts' colours vertex tints) and `brassM`
  const hullB = M.mat('wcHullB', P.body), jointB = M.mat('wcJointB', P.joint), headB = M.mat('wcHeadB', P.head), bandB = M.mat('wcBandB', P.band), clampB = M.mat('wcClampB', P.clamp), brassB = M.mat('wcBrassB', P.brass);
  const bodyM = M.own('wcBody', P.body, { vertexColors: true, flat: false, hatch: 0.45, patches: 0, foeSurface: paint('body', P) });
  const brassM = M.mat('wcBrass', P.brass, { vertexColors: true, foeSurface: paint('brass', P) });
  const coreM = M.own('core', P.core, { glow: 0.3 });
  const eyeM = M.own('visor', P.visor, { glow: 0.2 });
  // ---------------------------------------------------------------- the torso: the barrel, its chest seam, the vent, the head
  const torso = add(hull, new THREE.LatheGeometry(BARREL, 30), hullB); torso.scale.z = DEPTH;
  // (the seam across its chest and the two short ones down from it, as drawn: a dark groove)
  const seams = [new THREE.TorusGeometry(radiusAt(1.68) + 0.004, 0.012, 4, 36).rotateX(Math.PI / 2).scale(1, 1, DEPTH).translate(0, 1.68, 0)];
  for (const a of [-0.32, 0.32]) seams.push(tubeGeometry([[Math.sin(a) * (radiusAt(1.68) + 0.004), 1.68, Math.cos(a) * (radiusAt(1.68) + 0.004) * DEPTH], [Math.sin(a) * (radiusAt(1.9) + 0.004), 1.9, Math.cos(a) * (radiusAt(1.9) + 0.004) * DEPTH]], 0.01));
  many(hull, seams, jointB);
  // the vent: an ochre frame on its belly, five louvres over a glow (its weak point: it warms as it winds up)
  const front = radiusAt(1.22) * DEPTH;
  const vent = pivot(hull, 0, 1.22, front - 0.02, 'vent'); vent.rotation.x = -0.06;
  const frame = [];
  for (const [w, h, x, y] of [[0.3, 0.04, 0, 0.12], [0.3, 0.04, 0, -0.12], [0.04, 0.28, 0.13, 0], [0.04, 0.28, -0.13, 0]]) frame.push(new THREE.BoxGeometry(w, h, 0.06).translate(x, y, 0.02));
  for (let i = 0; i < 5; i++) frame.push(new THREE.BoxGeometry(0.22, 0.018, 0.035).rotateX(-0.5).translate(0, -0.08 + i * 0.04, 0.03));
  many(vent, frame, brassB);
  const core = add(vent, new THREE.PlaneGeometry(0.22, 0.2), coreM, 0, 0, 0.012);
  // a bolt or two (the reference's small round fittings)
  many(hull, [new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10).rotateX(Math.PI / 2).translate(radiusAt(1.12) * 0.55, 1.12, radiusAt(1.12) * DEPTH * 0.84), new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10).rotateX(Math.PI / 2).translate(-radiusAt(1.5) * 0.7, 1.5, radiusAt(1.5) * DEPTH * 0.72)], jointB);
  // the head: a pale dome sunk in the collar, forward of the middle; a dark ring round its foot; the visor slit
  const head = pivot(hull, 0, 1.92, 0.1, 'head');
  add(head, new THREE.SphereGeometry(1, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.72).scale(0.27, 0.3, 0.27), headB, 0, 0.18, 0);
  add(head, new THREE.TorusGeometry(0.25, 0.035, 6, 24).rotateX(Math.PI / 2), jointB, 0, 0.04, 0);
  const visor = add(head, new THREE.CapsuleGeometry(0.028, 0.17, 3, 10).rotateZ(Math.PI / 2).scale(1, 1, 0.5), eyeM, 0, 0.3, 0.245);
  visor.rotation.x = -0.4;
  // ---------------------------------------------------------------- the arms: a ball shoulder under a pauldron, upper arm, elbow, forearm, a tool
  const sawM = M.mat('wcSaw', P.saw, { foeSurface: paint('saw', P) });
  let sawDiscPivot = null;
  const arms = pair((s) => {
    const sh = pivot(hull, s * W.sh.x, W.sh.y, 0, 'shoulder');
    add(sh, new THREE.SphereGeometry(0.17, 14, 10), jointB);
    add(sh, new THREE.CylinderGeometry(0.12, 0.115, UPPER, 12).translate(0, -UPPER / 2, 0), hullB);
    many(sh, [new THREE.CylinderGeometry(0.13, 0.13, 0.05, 14).translate(0, -UPPER + 0.06, 0), new THREE.CylinderGeometry(0.125, 0.125, 0.04, 14).translate(0, -UPPER + 0.12, 0)], bandB);
    const el = pivot(sh, 0, -UPPER, 0.0, 'elbow');
    add(el, new THREE.SphereGeometry(0.13, 12, 8), jointB);
    // (the forearm a thick gauntlet, a little wider at the wrist; a dark band round the wrist)
    add(el, new THREE.CylinderGeometry(0.16, 0.14, FORE, 12).translate(0, -FORE / 2 - 0.04, 0), hullB);
    add(el, new THREE.CylinderGeometry(0.165, 0.165, 0.09, 14).translate(0, -FORE + 0.02, 0), s < 0 && props.has('saw') ? bandB : jointB);
    const fist = pivot(el, 0, -FORE - 0.06, 0.0, 'fist');
    let hand = null, reach = null;
    if (s < 0 && props.has('saw')) {
      // the saw's hand: a rust clamp round the disc's hub; the disc in the arm's plane (its edge ahead and below)
      add(fist, new THREE.BoxGeometry(0.2, 0.2, 0.24), clampB, 0, -0.06, 0.04);
      add(fist, new THREE.CylinderGeometry(0.15, 0.15, 0.14, 16).rotateZ(Math.PI / 2), clampB, -0.05, -0.2, 0.12);
      sawDiscPivot = pivot(fist, -0.14, -0.2, 0.12, 'saw');
      add(sawDiscPivot, sawDisc(W.saw, 0.035, 12), sawM);
      add(sawDiscPivot, new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10).rotateZ(Math.PI / 2), brassB);
    } else if (props.has('shears')) {
      const bladeM = M.mat('blade', P.blade ?? '#cfd4d8');
      hand = pivot(fist, 0, 0, 0, 'fingers');
      const T = WOODCUTTER_TOOLS.shears();
      many(hand, T.blades, bladeM); many(hand, [T.pin], brassB);
    } else {
      // the clamp: a palm and three plated fingers curling forward, a thumb inside (the reference's open hand)
      hand = pivot(fist, 0, 0, 0, 'fingers');
      const parts = [new THREE.BoxGeometry(0.2, 0.14, 0.18).translate(0, -0.06, 0.02)];
      for (let j = 0; j < 3; j++) {
        const x = (j - 1) * 0.065;
        parts.push(new THREE.BoxGeometry(0.055, 0.1, 0.06).translate(x, -0.18, 0.08), new THREE.BoxGeometry(0.05, 0.09, 0.055).rotateX(0.5).translate(x, -0.26, 0.11), new THREE.BoxGeometry(0.045, 0.08, 0.05).rotateX(1.0).translate(x, -0.31, 0.16));
      }
      parts.push(new THREE.BoxGeometry(0.06, 0.1, 0.06).rotateZ(-s * 0.6).translate(-s * 0.11, -0.13, 0.08), new THREE.BoxGeometry(0.05, 0.08, 0.05).rotateZ(-s * 0.9).translate(-s * 0.15, -0.2, 0.1));
      many(hand, parts, s < 0 ? clampB : jointB);
    }
    sh.rotation.z = s * 0.08;
    return { sh, el, fist, hand, reach };
  });
  // its armour (issue #722, src/enemies/fight.js ARMOUR): the two great pauldrons and a breastplate over its chest above
  // the seam (the vent, its weak point, stays bare under it); knocked off one by one
  const plateM = M.mat('wcPlate', P.plate ?? shade(P.body, 1.04), { side: THREE.DoubleSide, foeSurface: { mottle: paint('body', P).mottle, gloss: paint('body', P).gloss } });   // (smooth, as drawn: no rivets)
  const plates = [];
  for (const [i, a] of arms.entries()) {
    const s = i ? 1 : -1, cap = new THREE.SphereGeometry(0.37, 20, 10, 0, Math.PI * 2, 0, 1.8).scale(1, 0.95, 0.92);
    cap.rotateZ(-s * 0.55);   // (a round shell sloping down and out over the shoulder, as drawn)
    plates.push(plate(a.sh, cap, plateM, s * 0.03, 0.06, 0, `pauldron ${s > 0 ? 'left' : 'right'}`));
  }
  const chest = [1.7, 1.76, 1.82, 1.88, 1.93].map((y) => [radiusAt(y), y]);
  plates.splice(1, 0, plate(hull, shellPlate(chest, -0.75, 1.5, { out: 0.01, thick: 0.04, segs: 12, depth: DEPTH }), plateM, 0, 0, 0, 'breastplate'));
  // ---------------------------------------------------------------- short thick legs on the kit: a knee band, a boot, a wide rounded clog
  const legs = pair((s) => planLeg(WOODCUTTER_PLAN, { group: g, body, hipParent: hull, hip: { x: s * 0.36, y: W.hipY, z: 0 }, foot: { x: s * 0.46, z: 0.02 },
    radius: 0.16, balls: 0.85, taper: 0.3, pad: 'pad', ankle: 0.22, mats: { joint: jointB, thigh: hullB, shin: hullB, foot: hullB }, name: `wood cutter leg ${s > 0 ? 'left' : 'right'}` }));
  for (const [i, L] of legs.entries()) {
    const s = i ? 1 : -1;
    // (the broad boot: a clog of a foot, longer ahead than behind, its sole flat on the ground)
    for (const ch of L.foot.children.slice()) { ch.removeFromParent(); ch.geometry.dispose(); }
    const clog = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.27, 0.27, 0.46).translate(0, 0, 0.1);
    add(L.foot, clog, hullB);
    add(L.foot, new THREE.CylinderGeometry(0.28, 0.28, 0.03, 20).scale(1, 1, 1.65).translate(0, 0.015, 0.1), jointB);   // (the sole's rim)
    add(L.foot, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10).rotateZ(Math.PI / 2).translate(s * 0.235, 0.12, 0.0), jointB);   // (the ankle bolt)
    // (the shin a wide boot to the knee; a dark band and a round bolt at the knee)
    add(L.shin, new THREE.CylinderGeometry(0.19, 0.21, L.lenB * 0.62, 14).translate(0, L.lenB * 0.31, 0), hullB);
    many(L.shin, [new THREE.CylinderGeometry(0.18, 0.18, 0.05, 14).translate(0, L.lenB * 0.66, 0), new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12).rotateZ(Math.PI / 2).translate(s * 0.19, L.lenB * 0.98, 0.0)], jointB);
  }
  // ---------------------------------------------------------------- a skin's tools and dress (the other worlds' on this body)
  const extras = [];
  if (sawDiscPivot) extras.push(sawDiscPivot);
  let fan = null;
  if (props.has('turbine')) {
    fan = pivot(hull, 0, 1.58, radiusAt(1.58) * DEPTH + 0.03, 'turbine');
    many(fan, WOODCUTTER_TOOLS.vanes(), brassB);
  }
  if (props.has('ladle')) {
    const lad = pivot(arms[0].fist, 0, -0.2, 0.08, 'ladle'), ironM = M.mat('iron', P.dark);
    const T = WOODCUTTER_TOOLS.ladle();
    many(lad, T.iron, ironM); add(lad, T.melt, coreM);
    extras.push(lad);
  }
  if (props.has('door')) add(hull, new THREE.CircleGeometry(0.11, 16), coreM, 0, 1.6, radiusAt(1.6) * DEPTH + 0.01);   // (the furnace walker's: a second glow over its heart)
  if (props.has('roots') && !home) {
    const rootM = M.mat('root', P.root ?? P.dark), roots = [];
    for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2 + 0.4, pts = []; for (let t = 0; t <= 3; t++) { const y = 2.1 - t * 0.14, r = radiusAt(y) + 0.02; pts.push([Math.sin(a + t * 0.15) * r, y, Math.cos(a + t * 0.15) * r * DEPTH]); } roots.push(tubeGeometry(pts, 0.025, 0.01)); }
    many(hull, roots, rootM);
  }
  // ---------------------------------------------------------------- its look at you, the rig, the skinned meshes
  const gaze = [gazePart(g, head, { mode: 'turn', yaw: 0.6, up: 0.2, down: 0.3 })];
  const rig = new Rig({ plan: WOODCUTTER_PLAN, group: g, body, legs });
  for (const a of arms) a.reach = outerPoints(a.fist);   // (before the merge: the clamp's fingers, the saw's disc)
  // (the slab it hurls: torn out of the ground in its clamp; before the merge so it stays its own, hidden till then)
  const slab = add(arms[1].fist, new THREE.DodecahedronGeometry(0.24, 0).scale(1.3, 0.7, 1), M.mat('slab', P.slab ?? '#8a7f70', { flat: true }), 0, -0.34, 0.18);
  slab.visible = false;
  skinBy(g, [{ from: [hullB, jointB, headB, bandB, clampB], into: bodyM }, { from: [brassB], into: brassM }]);
  finish(g);
  const parts = [hullTurn, ...arms.flatMap((a) => [a.sh, a.el, a.fist]), ...extras, ...legs.map((l) => l.root)];
  return {
    group: g, gaze, body: hullTurn, rig, parts, eyeMat: eyeM, base: P.visor, size: skin.scale, skin: skin.id, tones: [P.body, P.brass, P.saw ?? P.joint],
    plates, weak: { obj: core, r: 0.2, name: 'vent' }, trial: 'direct', archetype: WOODCUTTER_ID, trialDef: woodcutterDef, wcJoints: { arms, legs, head },
    tell: (id) => (id === 'hurl' ? arms[1].fist : arms[0].fist),
    anim: woodcutterMotion({ g, hull: hullTurn, hullY: W.hipY, arms, rig, slab, coreM, eyeM, bodyM, P, props, saw: sawDiscPivot, fan, head }),
    dispose: M.dispose,
  };
}
