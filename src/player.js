import * as THREE from 'three';
import { makeMaterial } from './materials.js';
import { Cape } from './cape.js';
import { Gear } from './gear.js';
import { items as sharedItems } from './items.js';
import { HANDOFF } from './fluid-kit.js';
import { inTightRoom } from './interiors.js';
import { Knockdown, toppleVelocities, getUpPlacement, GET_UP } from './ragdoll.js';
import { LocoMoves } from './loco-moves.js';
import { AirMoves } from './air-moves.js';
import { SWIM, swimFrame, swimPose, leaveSwim } from './swim.js';
import { Locomotion, StepLag, gaitFeet } from './locomotion.js';
import { triggers } from './controller.js';
import { JumpLayer, FLIP, flipPose, boostVelocity, HOP, hopKind } from './jump.js';
import { keepInside, EdgePush } from './edge.js';
import { STAMINA, spendStamina, restStamina, canSprint, fillStamina } from './stamina.js';
import { standGround, moverCarrier } from './carriers.js';
import { HEARTS, POTION, DAMAGE, quarters, sparing } from './resources.js';
import { hintsFor } from './hint-level.js';

const RADIUS = 0.45;
const STEP = 0.6;    // obstacles lower than this are stepped onto
const HEIGHT = 2.2;
/** The body's collision capsule (src/swim.js moves it through water too). */
export const CAPSULE = { radius: RADIUS, step: STEP, height: HEIGHT };
// m/s, matched to the mocap clips: the default pace plays the jog loop at
// ~1x, SHIFT the sprint loop with a slightly lengthened stride
const WALK = 3.8;
const RUN = 8.2;   // (7.2 until October 2026: a little faster now that it costs stamina, src/stamina.js)
export const GRAVITY = 32;   // (m/s²; the blade's rising cut leaps with it: src/fluid-blade.js RISE)
const JUMP = 13;
const LIMIT = 1900;
// The follow camera's look down when a world starts (rad, the rig's pitch): a little down the way the
// traveller faces, as Ocarina of Time's (CameraRig).
export const OPEN_PITCH = 0.13;
/**
 * The jets fly like a plane (Player.startJets / flyJets; docs/systems/movement-and-camera.md).
 * Jump held in the air is the throttle, full (A / ×, SPACE, touch ⤒; until v1.38 RT / R2 was, analog,
 * and lifted you off the ground: RT / R2 uses the gadget in hand now). Flying, the left stick flies
 * the nose (jetSteer): forward tips it down, back pulls it up (Settings: invert the jets'
 * pitch), left / right bank and turn. The thrust drives you along the nose (jetStep) at up to
 * JET.speed (JET.boost with L3 / Shift, JET.dive more nose down), with momentum (JET.accel) and
 * a grip on the air that turns a slip into the nose's way (JET.grip). Let go and you glide on:
 * gravity along the nose trades height for speed, the speed holds you up (JET.glideLift at
 * JET.liftSpeed), the nose droops into the fall (JET.droop), quickly in a stall (JET.stall), so
 * you glide down to the ground (or the wings open). Aim (LT / L2) while flying and the jets hold you, sinking slowly
 * (JET.hold), while you shoot. Touching the ground nose up or level with the throttle on skims
 * it; nose down (JET.land) or gliding lands you, softly (JET.cushion).
 */
export const JET = {
  speed: 22, boost: 1.4, dive: 0.35,          // m/s along the nose at full throttle; L3 / Shift; the most a dive adds
  accel: 2, grip: 3.5,                         // 1/s: the speed easing to the throttle's, a slip easing into the nose's way
  pitchRate: 1.7, turnRate: 1.8,               // rad/s at full stick, at full bank
  bank: 0.8, bankRate: 5,                      // rad, 1/s
  maxPitch: Math.PI / 2, takeoff: Math.PI / 2, lift: 7,   // rad: the nose straight up at most, and lifting off (a climb straight up a shaft); m/s up at lift-off
  carry: 6,                                    // m/s across: firing them in the air faster than this keeps your way (else nose up)
  drag: 0.22, liftSpeed: 16, glideLift: 0.9,   // the glide: 1/s of drag; held up glideLift of gravity at liftSpeed m/s
  droop: 1.2, stall: 4, stallDroop: 3,         // 1/s the nose drops into the fall unpowered (a quarter of it at liftSpeed); slower than stall m/s along it, a stall: stallDroop
  land: 0.25, cushion: 0.5,                    // rad nose down that lands you; a landing on the jets counts as this much of its speed
  idle: 0.35,                                  // the share of the full burn a light squeeze still burns
  hold: { sink: 1.2, rate: 2.5, burn: 0.5 },   // aiming in flight: m/s down, 1/s easing to it, its burn
};

const _jSide = new THREE.Vector3(), _jG = new THREE.Vector3();
/** The nose: `fwd` (the heading's level forward) tipped `pitch` rad up toward `U`. */
export function jetNose(fwd, U, pitch, out = new THREE.Vector3()) {
  return out.copy(fwd).multiplyScalar(Math.cos(pitch)).addScaledVector(U, Math.sin(pitch)).normalize();
}
/**
 * A frame of the stick on the nose (J { pitch, bank }, changed): f > 0 (the stick forward, W) tips
 * the nose down, f < 0 pulls it up (invert swaps them); s > 0 (right) banks right, and the bank
 * turns you. Returns the heading's change (rad; the heading grows turning left).
 */
export function jetSteer(J, f, s, dt, invert = false) {
  const pf = invert ? -f : f;
  J.pitch = THREE.MathUtils.clamp(J.pitch - pf * JET.pitchRate * dt, -JET.maxPitch, JET.maxPitch);
  J.bank += (THREE.MathUtils.clamp(s, -1, 1) * JET.bank - J.bank) * (1 - Math.exp(-JET.bankRate * dt));
  return -(J.bank / JET.bank) * JET.turnRate * dt;
}
/** m/s along the nose for throttle T (0..1), the nose's sine up (`up`, -1 straight down), boosted (L3 / Shift) or not. */
export function jetSpeed(T, up = 0, boost = false) {
  return JET.speed * THREE.MathUtils.clamp(T, 0, 1) * (boost ? JET.boost : 1) * (1 + JET.dive * Math.max(0, -up));
}
/**
 * A frame of flight: `vel` (changed) on a `nose` (unit) at throttle T (0..1). Under thrust the speed
 * along the nose eases to jetSpeed (JET.accel) and a slip across it dies away (JET.grip); the jets
 * hold you up. Unpowered (T 0) it glides: gravity along the nose speeds a dive and slows a climb,
 * drag slows you (the more the faster), and the faster you go the more of gravity's pull across the nose is held up
 * (JET.glideLift at JET.liftSpeed) and the better you hold your way. Returns the speed along the nose.
 */
export function jetStep(vel, nose, U, T, dt, { boost = false, gravity = 32 } = {}) {
  let along = vel.dot(nose);
  const side = _jSide.copy(vel).addScaledVector(nose, -along);
  const up = nose.dot(U);
  if (T > 0) {
    along += (jetSpeed(T, up, boost) - along) * (1 - Math.exp(-JET.accel * dt));
    side.multiplyScalar(Math.exp(-JET.grip * dt));
  } else {
    const k = THREE.MathUtils.clamp(along / JET.liftSpeed, 0, 1);
    along = (along - gravity * up * dt) * Math.exp(-JET.drag * Math.max(1, Math.abs(along) / JET.liftSpeed) * dt);   // (the drag grows with the speed: a glide settles)
    const across = _jG.copy(U).addScaledVector(nose, -up).multiplyScalar(-gravity * dt * (1 - JET.glideLift * k));
    side.add(across).multiplyScalar(Math.exp(-JET.grip * k * dt));
  }
  vel.copy(nose).multiplyScalar(along).add(side);
  return along;
}
/**
 * Unpowered, the nose eases toward the way you are moving (the fall takes it down), slowly while
 * you are fast; slower than JET.stall along it (`along`, m/s), a stall: it drops quickly, so the
 * fall turns into a dive and the dive into a glide. The new pitch.
 */
export function jetDroop(pitch, vel, U, dt, along = vel.length()) {
  const L = vel.length();
  if (L < 1e-3) return THREE.MathUtils.clamp(pitch - JET.stallDroop * dt, -JET.maxPitch, JET.maxPitch);
  const way = Math.asin(THREE.MathUtils.clamp(vel.dot(U) / L, -1, 1));
  const rate = along < JET.stall ? JET.stallDroop : JET.droop * (1 - 0.75 * THREE.MathUtils.clamp(L / JET.liftSpeed, 0, 1));
  return THREE.MathUtils.clamp(pitch + (way - pitch) * (1 - Math.exp(-rate * dt)), -JET.maxPitch, JET.maxPitch);
}
/**
 * Leaving the jets' chase (landing from a dive, or into the water, the wings, a wall, a ride): the view's
 * pitch eases back to the on-foot framing at `rate` (1/s: ~95 % in 0.75 s), done by `time` s at most.
 */
export const PITCH_SETTLE = { rate: 4, time: 1 };
/** The camera's pitch (+ looks down) behind a nose at `pitch`: up with a climb, down with a dive. */
export function jetCameraPitch(pitch) {
  return THREE.MathUtils.clamp(OPEN_PITCH + 0.12 - pitch * 0.4, -0.5, 0.85);
}

/** m: the jets' lean turns the body about its hips, this high over the feet. */
const JET_PIVOT = 1.0;
// a flinch as a foe's strike lands (Player.flinch): the Sword and Shield pack's impact, its first 0.6 s
const FLINCH = { clip: 'mixamo_ss_impact_1', from: 0, for: 0.6 };
// locked on (main.js sets player.lockOn = { dir }): you face the foe and the stick strafes round it or backs
// away, at a jog at most; sideways and backwards play captured steps (the Sword and Shield pack), m/s each covers
export const LOCK_MOVE = { speed: 4.2, turn: 12, left: { clip: 'mixamo_ss_strafe_1', speed: 1.14 }, right: { clip: 'mixamo_ss_strafe_2', speed: 1.01 }, back: { clip: 'mixamo_ss_walk_2', speed: 1.08 },
  in: 10, out: 10, swap: 18, keep: 0.55, side: 1.0 };
/**
 * Which captured step a locked-on move wants (pure: tests): 'left' / 'right' / 'back' / null (forward: the loops), from
 * the speed along the facing `vf` and to the right `vr` (m/s). The side `was` playing is kept until the move is clearly
 * another's (its sideways share under LOCK_MOVE.keep of the forward one; a new side needs LOCK_MOVE.side of it).
 */
export function strafeSide(vf, vr, was = null, L = LOCK_MOVE) {
  const side = vr > 0 ? 'right' : 'left', k = was === side ? L.keep : L.side;
  if (Math.abs(vr) > Math.abs(vf) * k && Math.abs(vr) > 0.3) return side;
  if (vf < -0.3) return 'back';
  if ((was === 'left' || was === 'right') && Math.abs(vr) > 0.3 && Math.abs(vr) > Math.abs(vf) * L.keep) return was;
  return null;
}
/**
 * One frame of the step's weight (pure: tests): S { w, side }, the side wanted (or null). A different side wanted while one
 * plays: the one playing fades out first (LOCK_MOVE.swap), and only then the new one comes in, never one swapped for the
 * other at weight. Returns the side to play this frame, or null.
 */
export function strafeStep(S, want, dt, L = LOCK_MOVE) {
  if (want && !S.side) S.side = want;
  const swapping = want && S.side && want !== S.side;
  const target = want && !swapping ? 1 : 0;
  S.w += (target - S.w) * (1 - Math.exp(-(swapping ? L.swap : target ? L.in : L.out) * dt));
  if (S.w < 0.03) { S.w = swapping ? 0 : S.w < 0.02 ? 0 : S.w; if (swapping || !want) { S.side = want ?? null; if (!want) return null; } }
  return S.side && S.w > 0 ? S.side : null;
}
// the gestures (Player.gesture): Mixamo's kneeling inspection (kneeling from its first frame: eased
// in over `in` s, held, eased out over `out`, its hands' bit of `loop` s round and round), and for
// petting the petting's stroking arm over it
const GESTURES = {
  kneel: { clip: 'kneeling_inspecting', from: 0.2, loop: 4.4, in: 0.45, out: 0.5 },
  pet: { clip: 'petting_animal', from: 2.5, loop: 8, w: 0.85 },
};
/**
 * The jets' pose for a flight at `speed` m/s along a nose `pitch` rad up: the body's lean (rad,
 * about the hips: 0 upright, π/2 flat out, more head first into a dive) and how far the arms
 * reach ahead and the legs trail (0 hovering .. 1 flying fast). Upright while slow; nose up
 * (lifting off, climbing straight) upright too, like a rocket.
 */
export function jetPose(speed, pitch) {
  const k = THREE.MathUtils.smoothstep(Math.abs(speed) / JET.speed, 0.12, 0.6);
  return { lean: THREE.MathUtils.lerp(0.1, THREE.MathUtils.clamp(Math.PI / 2 - pitch, 0.1, 2.75), k), reach: k };
}
const JET_DRAIN = 0.1;     // fuel per second (~10 s of thrust), when no backpack tool burns its fluid (tests)
const JET_REFILL = 0.55;
/**
 * Hearts and falls (speeds in m/s into the ground: a drop of h m lands at
 * about √(64 h)). Up to
 * FALL.tumble (~16 m) a landing costs nothing; harder ones knock you over into
 * a ragdoll tumble (src/ragdoll.js), you lie a moment and get up, and you lose
 * hearts (fallDamage, up to FALL.worst, never the last quarter). Only FALL.lethal
 * (~36 m) or more is fatal: you lie there and the game asks to restart. Hearts
 * never come back by themselves (a potion heals: src/resources.js POTION): FALL.regen
 * is 0 in the world; a game may lend some back (hearts a second, after FALL.wait s
 * without a hurt: the Arena's Second wind, src/minigames/waves.js).
 */
export const FALL = { tumble: 32, lethal: 48, worst: DAMAGE.fall, wait: 4, regen: 0 };
/** Wedged in mid-air (Player.unhang): never more than `reach` m from where it began for `time` s, while nothing held you up. */
export const HANG = { time: 1.0, reach: 0.35 };
/**
 * Jumping off a mount or a vehicle (Player.jumpOff: the pad's bottom button while riding; E or
 * the right button too while it moves faster than `moving` m/s or flies more than `air` m up):
 * a `hop` m/s up, its speed carried on (`keep` of it). In the air or at speed the pack comes back at once,
 * the wings open by themselves if you have them, and a fall that would kill you is not allowed
 * (a notice), unless the bird is yours: then, `catchAfter` s into a fall like that, she comes
 * and catches you (bird.js flyCatch).
 */
export const JUMP_OFF = { hop: 7, keep: 0.85, moving: 6, air: 3, catchAfter: 0.7 };
/** The hearts a landing at `speed` (m/s into the ground) takes: nothing short of a tumble, up to FALL.worst, all of them (Infinity) at FALL.lethal. */
export const fallDamage = (speed) => speed >= FALL.lethal ? Infinity : FALL.worst * Math.max(0, (speed - FALL.tumble) / (FALL.lethal - FALL.tumble)) ** 2;

function part(geo, color, opts = {}) {
  return new THREE.Mesh(geo, makeMaterial({ color, ...opts }));
}

// An Vael-style rider: tall and gaunt, swallowed by an enormous red hooded
// cloak that reaches the ankles and flares out behind when running, a long
// pale face with a long thin nose, a peaked hood whose tip trails behind.
export const RIDER_COLORS = { cloak: '#3f5fae', cloak2: '#7a4fa8', lining: '#2f3f80', cloth: '#b4a2c4', legs: '#aa98ba', boot: '#c39988', gloves: '#ea9678', wrap: '#e2d3b4',
  face: '#f1e6d0', ink: '#2b211f', belt: '#d8a24a', robe: '#ead9b4', robe2: '#c9a577' };

/** @param palette overrides for RIDER_COLORS (NPCs use their own) */
export function buildCharacter(palette = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();          // whole-figure bob / lean / bank
  root.add(body);
  const C = { ...RIDER_COLORS, ...palette };

  const pelvis = part(new THREE.CylinderGeometry(0.12, 0.13, 0.15, 10), C.cloth);
  pelvis.position.y = 0.99;
  body.add(pelvis);

  // long thin legs with knees, wrapped boots
  const legs = [], knees = [], feet = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.085, 0.96, 0);
    const thigh = part(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 7), C.legs);
    thigh.position.y = -0.25;
    const knee = new THREE.Group();
    knee.position.y = -0.49;
    const shin = part(new THREE.CylinderGeometry(0.05, 0.04, 0.42, 7), C.legs);
    shin.position.y = -0.21;
    const wrap = part(new THREE.CylinderGeometry(0.052, 0.058, 0.2, 7), C.wrap, { flat: true });
    wrap.position.y = -0.33;
    // the boot hangs from an ankle pivot so it can stay flat on the ground
    const ankle = new THREE.Group();
    ankle.position.y = -0.43;
    const boot = part(new THREE.BoxGeometry(0.1, 0.08, 0.25), C.wrap, { flat: true });
    boot.position.set(0, 0, 0.06);
    ankle.add(boot);
    knee.add(shin, wrap, ankle);
    pivot.add(thigh, knee);
    body.add(pivot);
    legs.push(pivot);
    knees.push(knee);
    feet.push(ankle);
  }

  const torso = new THREE.Group();
  torso.position.y = 1.06;
  body.add(torso);
  const tunic = part(new THREE.CylinderGeometry(0.11, 0.135, 0.62, 10), C.cloth);
  tunic.position.y = 0.31;
  const belt = part(new THREE.TorusGeometry(0.135, 0.022, 6, 16).rotateX(Math.PI / 2), C.belt);
  belt.position.y = 0.06;
  torso.add(tunic, belt);

  // thin arms with elbows, red cuffs
  const arms = [], elbows = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, 0.66, 0);
    const upper = part(new THREE.CylinderGeometry(0.036, 0.032, 0.32, 6), C.cloth);
    upper.position.y = -0.16;
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    const fore = part(new THREE.CylinderGeometry(0.032, 0.027, 0.3, 6), C.cloth);
    fore.position.y = -0.15;
    const cuff = part(new THREE.CylinderGeometry(0.036, 0.036, 0.06, 6), C.cloak);
    cuff.position.y = -0.27;
    const hand = part(new THREE.SphereGeometry(0.042, 6, 4), C.face);
    hand.position.y = -0.33;
    elbow.add(fore, cuff, hand);
    pivot.add(upper, elbow);
    pivot.rotation.z = side * 0.06;
    torso.add(pivot);
    arms.push(pivot);
    elbows.push(elbow);
  }

  // head: long pale face, long nose, deep peaked hood
  const head = new THREE.Group();
  head.position.y = 0.87;
  torso.add(head);
  // the skull's own turn on the neck (Animator.apply: the clip's head, not just its neck's line; Humanoid's Head bone follows it)
  const headNod = new THREE.Object3D();   // (not a Group: Humanoid moves the hood's groups off the rig head)
  head.add(headNod);
  const neck = part(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 6), C.face);
  neck.position.y = 0.79;
  torso.add(neck);
  const face = part(new THREE.CapsuleGeometry(0.07, 0.13, 4, 10), C.face);
  face.scale.set(1, 1, 0.95);
  face.position.y = 0.01;
  const nose = part(new THREE.ConeGeometry(0.02, 0.17, 6).rotateX(Math.PI / 2 + 0.45), C.face, { flat: true });
  nose.position.set(0, 0.0, 0.11);
  head.add(face, nose);
  for (const side of [-1, 1]) {
    const eye = part(new THREE.BoxGeometry(0.035, 0.01, 0.015), C.ink);
    eye.position.set(side * 0.032, 0.045, 0.066);
    eye.rotation.z = side * 0.18;            // heavy-lidded, weary
    head.add(eye);
  }
  const hood = part(new THREE.SphereGeometry(0.15, 16, 12, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5), C.cloak, { side: THREE.DoubleSide });
  hood.scale.set(1, 1.25, 1.15);
  hood.position.set(0, 0.04, -0.02);
  head.add(hood);
  // hood peak on a hinge: trails back, bounces (driven as "hatTip")
  const peakBase = new THREE.Group();
  peakBase.position.set(0, 0.17, -0.05);
  peakBase.rotation.x = -0.65;
  const hatTip = new THREE.Group();
  const peak = part(new THREE.ConeGeometry(0.075, 0.34, 10), C.cloak);
  peak.position.y = 0.15;
  hatTip.add(peak);
  peakBase.add(hatTip);
  head.add(peakBase);

  // the cloak itself is a cloth simulation (cape.js), pinned under this collar
  const collar = part(new THREE.TorusGeometry(0.19, 0.035, 6, 18).rotateX(Math.PI / 2), C.lining);
  collar.position.y = 0.74;
  torso.add(collar);

  // a small satchel at the hip (hidden when the jetpack is on)
  const pack = new THREE.Group();
  const satchel = part(new THREE.BoxGeometry(0.14, 0.16, 0.07), '#8a5a3c', { flat: true });
  satchel.position.set(0.16, 0.0, 0.03);
  pack.add(satchel);
  const bedroll = new THREE.Group();
  torso.add(pack, bedroll);

  // kept for the animation code; the cloak replaces the scarf
  const scarf = new THREE.Group(), scarf2 = new THREE.Group();
  torso.add(scarf);
  scarf.add(scarf2);

  // The jetpack's old canisters are gone: the jets are two nozzles under the
  // backpack's tank now (fluid-kit.js). The empty group stays as an anchor.
  const jetpack = new THREE.Group();
  jetpack.position.set(0, 0.44, -0.3);
  const flames = [];
  jetpack.visible = false;
  torso.add(jetpack);

  return { root, body, torso, head, headNod, hatTip, legs, knees, feet, arms, elbows, scarf, scarf2, pack, bedroll, jetpack, flames,
    scarfAnchors: [], colors: C };
}

const _v1 = new THREE.Vector3();
const _edgeN = new THREE.Vector3();
const _tq = new THREE.Quaternion(), _te = new THREE.Euler();
const _sq1 = new THREE.Quaternion(), _sq2 = new THREE.Quaternion(), _sq3 = new THREE.Quaternion(), _sq4 = new THREE.Quaternion();
// standing: how much of the idle clip's stance each foot keeps, fore-aft and outward from its hip (Player.standUnder)
export const IDLE_STANCE = { ahead: 0.3, out: 0.4 };
// standing: the head's pitch over the idle clip's (rad, + down): the clip looks 15° down, at the ground; he looks ahead, as drawn
export const IDLE_HEAD = -0.14;
/**
 * In a conversation (Player.talking, set by src/story/index.js) he holds still: the weight shift keeps
 * `sway` of its size, the head's glances and nods go, no captured look-around or breathing idle plays
 * (Animator.calm), and his eyes stay on whoever speaks (EyeLook calm). `rate`: how fast he settles (1/s).
 */
export const TALK_CALM = { sway: 0.2, rate: 3 };
/**
 * The standing layer's motion at time t (Player.idleLayer): the weight shift w (-1..1, scaled down when
 * calm), the breath, the head's glance (yaw, rad) and nod (pitch over IDLE_HEAD). calm 0..1, moveW: a
 * captured idle's own weight (it looks about by itself).
 */
export function idleMotion(t, calm = 0, moveW = 0) {
  const still = 1 - calm;
  const w = Math.tanh(3 * Math.sin(t * 0.38 + 0.6)) * (1 - (1 - TALK_CALM.sway) * calm);
  const breath = Math.sin(t * 1.7);
  const look = (Math.tanh(2.5 * Math.sin(t * 0.21)) * 0.45 + Math.sin(t * 0.9) * 0.03) * (1 - moveW) * still;
  const nod = Math.max(0, Math.sin(t * 0.13)) * 0.12 * still;
  return { w, breath, look, nod };
}
const _g1 = new THREE.Vector3(), _g2 = new THREE.Vector3(), _g3 = new THREE.Vector3(), _g4 = new THREE.Vector3(), _g5 = new THREE.Vector3(), _g6 = new THREE.Vector3();
const _mf = new THREE.Vector3(), _ml = new THREE.Vector3();   // (the matcher's frame: matchInput)
const LEG_A = 0.49, LEG_B = 0.47;   // thigh, shin+foot
// climbing key poses (rig angles in radians; arm x < 0 raises the arm forward/up)
const CLIMB_KEYS = {
  A: { armL: -3.05, armLz: 0.15, elbL: -0.25, armR: -1.75, armRz: -0.25, elbR: -1.55,
       legL: -0.35, kneeL: 0.55, footL: -0.2, legR: -1.15, kneeR: 1.75, footR: -0.5, sway: 1, lift: 0 },
  B: { armL: -1.75, armLz: 0.25, elbL: -1.55, armR: -3.05, armRz: -0.15, elbR: -0.25,
       legL: -1.15, kneeL: 1.75, footL: -0.5, legR: -0.35, kneeR: 0.55, footR: -0.2, sway: -1, lift: 0 },
};
const _cu = new THREE.Vector3(), _cs = new THREE.Vector3(), _cb = new THREE.Vector3(), _cw = new THREE.Vector3();
const _ca = new THREE.Vector3(), _cbb = new THREE.Vector3(), _cA = new THREE.Vector3(), _cv = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _jn = new THREE.Vector3(), _jf = new THREE.Vector3();   // (the jets' nose: flyJets)
const _mat = new THREE.Matrix4();
const _q1 = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _shoulder = new THREE.Vector3(), _head = new THREE.Vector3(), _toCam = new THREE.Vector3(), _chest = new THREE.Vector3();
const _qId = new THREE.Quaternion();
const _pc = new THREE.Vector3(), _pd = new THREE.Vector3(), _cr = new THREE.Vector3(), _cu2 = new THREE.Vector3();
const _xAxis = new THREE.Vector3(1, 0, 0);
const _cn = new THREE.Vector3(), _cd = new THREE.Vector3(), _ce = new THREE.Vector3(), _sw = new THREE.Vector3(), _ct = new THREE.Vector3();
const _hs = new THREE.Vector3(), _pv = new THREE.Vector3();
const _sr = new THREE.Vector3(), _sp = new THREE.Vector3(), _lb = new THREE.Vector3();   // (CameraRig.pickShoulder)

/**
 * A scarf tail simulated as a Verlet chain and drawn as a ribbon in world
 * space. It trails behind when you run or ride, sags when you stand, and is
 * pushed out of the body.
 */
class ClothTail {
  constructor(scene, { points = 8, seg = 0.2, width = 0.3, color = '#c8483a' } = {}) {
    this.n = points;
    this.seg = seg;
    this.width = width;
    this.p = Array.from({ length: points }, () => new THREE.Vector3());
    this.prev = Array.from({ length: points }, () => new THREE.Vector3());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < points - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, makeMaterial({ color, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.userData.noCollide = true;
    scene.add(this.mesh);
    this.ready = false;
  }

  update(dt, anchor, up, side, back, wind, bodyA, bodyB) {
    if (!this.ready || this.p[0].distanceTo(anchor) > 5) {
      for (let i = 0; i < this.n; i++) {
        this.p[i].copy(anchor).addScaledVector(up, -i * this.seg * 0.7).addScaledVector(back, i * this.seg * 0.7);
        this.prev[i].copy(this.p[i]);
      }
      this.ready = true;
    }
    const steps = 2, h = Math.min(dt, 1 / 30) / steps;
    for (let k = 0; k < steps; k++) {
      this.p[0].copy(anchor);
      for (let i = 1; i < this.n; i++) {
        const p = this.p[i], q = this.prev[i];
        _v1.subVectors(p, q).multiplyScalar(0.97);           // velocity with damping
        q.copy(p);
        p.add(_v1).addScaledVector(up, -4.0 * h * h).addScaledVector(wind, h * h);
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < this.n; i++) {
          const a = this.p[i - 1], b = this.p[i];
          _v1.subVectors(b, a);
          const d = _v1.length() || 1e-6;
          b.copy(a).addScaledVector(_v1, this.seg / d);
        }
        // keep the cloth out of the body (a capsule from hips to shoulders)
        for (let i = 1; i < this.n; i++) {
          const p = this.p[i];
          _v2.subVectors(bodyB, bodyA);
          const t = THREE.MathUtils.clamp(_v1.subVectors(p, bodyA).dot(_v2) / _v2.lengthSq(), 0, 1);
          _v3.copy(bodyA).addScaledVector(_v2, t);
          _v1.subVectors(p, _v3);
          const d = _v1.length();
          if (d < 0.3) p.copy(_v3).addScaledVector(d > 1e-4 ? _v1.divideScalar(d) : back, 0.3);
        }
      }
    }
    const pos = this.mesh.geometry.attributes.position.array;
    for (let i = 0; i < this.n; i++) {
      const w = this.width * (1 - 0.35 * (i / (this.n - 1)));   // tapers toward the tip
      const j = i * 6;
      pos[j] = this.p[i].x - side.x * w * 0.5; pos[j + 1] = this.p[i].y - side.y * w * 0.5; pos[j + 2] = this.p[i].z - side.z * w * 0.5;
      pos[j + 3] = this.p[i].x + side.x * w * 0.5; pos[j + 4] = this.p[i].y + side.y * w * 0.5; pos[j + 5] = this.p[i].z + side.z * w * 0.5;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

/**
 * Local movement frame: up (against gravity), forward reference and right.
 * In normal levels it's just +Y / +Z / +X; levels with strange gravity
 * rotate it, and the forward reference is parallel-transported so the camera
 * and controls don't spin when "up" changes.
 */
class Frame {
  constructor() {
    this.up = new THREE.Vector3(0, 1, 0);
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.right = new THREE.Vector3(1, 0, 0);
  }
  set(up, fwd) {
    this.up.copy(up);
    if (fwd) this.fwd.copy(fwd);
    this.orthonormalize();
  }
  /** Rotate up toward target (rate in 1/s; Infinity = snap). */
  turnToward(target, rate, dt) {
    const k = rate === Infinity ? 1 : 1 - Math.exp(-rate * dt);
    if (this.up.dot(target) > 0.99999) return;
    _q1.setFromUnitVectors(this.up, target);
    _q1.slerp(new THREE.Quaternion(), 1 - k); // partial rotation
    this.up.applyQuaternion(_q1).normalize();
    this.fwd.applyQuaternion(_q1);
    this.orthonormalize();
  }
  orthonormalize() {
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up));
    if (this.fwd.lengthSq() < 1e-6) this.fwd.set(1, 0, 0).addScaledVector(this.up, -this.up.x);
    this.fwd.normalize();
    this.right.crossVectors(this.up, this.fwd).normalize();
  }
  /** World direction for a heading angle in this frame (0 = fwd). */
  dir(heading, out) {
    return out.copy(this.right).multiplyScalar(Math.sin(heading)).addScaledVector(this.fwd, Math.cos(heading));
  }
  headingOf(v) {
    return Math.atan2(v.dot(this.right), v.dot(this.fwd));
  }
  /** Orientation quaternion of a character facing `heading`. */
  quaternion(heading, out) {
    const d = this.dir(heading, _v3);
    const x = _v2.crossVectors(this.up, d);
    _mat.makeBasis(x, this.up, d);
    return out.setFromRotationMatrix(_mat);
  }
}

export class Player {
  /**
   * @param physics  Physics (ground rays + capsule collision against the level)
   * @param opts     { mount: (physics) => vehicle, jetpack, climb, killY, limit,
   *                   spawn, spawnHeading, spawnUp, gravityAt(pos) -> up,
   *                   unsafe(pos) -> bool, items }
   *                 jetpack is only a hint now (the level wants the jets; the box
   *                 agent puts their box there): the jets, the wings and powered
   *                 vehicles go by items (src/items.js), in any world.
   */
  constructor(physics, opts = {}) {
    this.physics = physics;
    this.opts = { jetpack: false, climb: true, killY: -Infinity, limit: 1900, ...opts };
    this.char = buildCharacter();
    this.object = this.char.root;
    this.frame = new Frame();
    this.pos = new THREE.Vector3(0, physics.groundAt(0, 1e4, 0), 0);
    this.vel = new THREE.Vector3();
    this.heading = Math.PI;
    this.onGround = true;
    this.gliding = false;
    this.phase = 0;
    this.time = 0;
    // Optional: pose updates at 12 fps ("on twos"), like Sable's stop-motion
    // feel (Time of day > stop-motion anim); movement itself stays smooth.
    this.stopMotion = false;
    this._animAcc = 0;
    this._push = new THREE.Vector3();
    this.lastSafe = new THREE.Vector3();
    this._safeTimer = 0;

    // Vehicles: anything with pos, heading, forward, speed, update(), seatTransform().
    this.mount = this.opts.mount ? this.opts.mount(physics) : null;   // summonable (bike, bird, skiff)
    this.bike = this.mount;                                            // backwards-compatible name
    this.vehicles = this.mount ? [this.mount] : [];
    this.ride = null;

    this.fuel = 1;
    this.thrusting = false;     // the jets burning (throttle on)
    this.jetFlight = null;      // flying on the jets: { pitch, bank, along } (startJets / flyJets), gliding on too once the throttle is off
    this.jetHold = false;       // aiming in flight: the jets hold you, sinking slowly (JET.hold)
    this.jetPower = 0;          // 0..1 how hard they burn (the flames, the sound)
    this.invertFlight = false;  // Settings: push forward to climb on the jets
    this.stamina = 1;
    this.winded = false;   // (run dry: no sprint until it's back: src/stamina.js)
    this.maxHearts = this.opts.maxHearts ?? HEARTS.start;   // (main.js keeps it to src/resources.js maxHearts)
    this.hearts = this.maxHearts;   // in hearts, counted in quarters (hurt / restore; falls: FALL); health: the share 0..1
    this.drinking = null;     // { t, healed } the potion on its way to the lips (drinkPotion)
    this.climbing = false;
    this.wallN = new THREE.Vector3();
    this._press = 0;
    this._climbCooldown = 0;
    this.wind = new THREE.Vector3(1.2, 0, 0.5);   // levels can set this (wind on the scarf)
    this.onStep = null;                            // (footPos, heading) for footprints
    this.aim = null;                               // { k, point, dir } while aiming the tool (fluid-tool.js)
    this.onDoubleJump = null;                      // () => the double jump's puff of fluid (fluid-tool.js liftFx)
    this._airJumped = false;                       // the double jump spent since leaving the ground (canDoubleJump)
    this._flipAt = -Infinity;                      // when the last double jump's flip began (src/jump.js FLIP)
    this._hop = null;                              // locked on, the back flip or side hop under way (hop(): src/jump.js HOP)
    this._hopReady = 0;                            // (this.time) when the next hop may begin
    // Everything runs on the backpack (src/items.js). The fluid tool plugs in:
    //   fuelSource { jetLevel() 0..1, burnJet(dt) -> bool }  the jets burn the tank's reserve
    //   handoff { handPoint(out) }   boarding a powered vehicle swings the tank into its socket
    this.items = this.opts.items ?? sharedItems;
    this.fuelSource = null;
    this.handoff = null;
    this.boarding = null;                          // { v, t, dur, k } swinging the pack into a vehicle, then climbing on
    this.unboarding = null;                        // { v, t, dur, k } stepped off: taking the pack back
    this.onNotice = null;                          // (text) a short message for the player ("It needs power.")
    this.wingK = 0;                                // the fluid wings: 0 folded .. 1 open (fluid-kit.js draws them)
    // water (src/swim.js): the world's water (water.js Waters, or opts.water), the swim while
    // floating, the breath 0..1, and what the water is doing to you this frame
    this.water = this.opts.water ?? null;
    this.swim = null;
    this.breath = 1;
    this.inWater = null;
    this.wadeSlow = 1;
    this.onSwim = null;                            // (event, info): water.js splashes and sounds them
    this._stepSide = 1;
    this._prevPhase = 0;
    this.char.jetpack.visible = false;
    if (this.opts.spawn) this.respawn();
    this.lastSafe.copy(this.pos);
  }

  get riding() {
    return !!this.ride;
  }

  /** The hearts as a share of the whole, 0..1 (the old health bar's value; setting it sets the hearts). */
  get health() { return this.maxHearts > 0 ? this.hearts / this.maxHearts : 0; }
  set health(k) { this.hearts = Math.min(Math.max(+k || 0, 0), 1) * this.maxHearts; }
  /** A different number of heart containers: full ones stay full, a hurt keeps what it took. */
  setMaxHearts(n) {
    if (!(n > 0) || n === this.maxHearts) return;
    const full = this.hearts >= this.maxHearts - 1e-9;
    this.maxHearts = n;
    this.hearts = full ? n : Math.min(this.hearts, n);
  }
  /** Hearts back (a potion): up to the containers, never for the knocked out. Returns what was healed. */
  restore(h) {
    if (!(h > 0) || this.down?.dead) return 0;
    const was = this.hearts;
    this.hearts = Math.min(this.maxHearts, this.hearts + h);
    return this.hearts - was;
  }
  /**
   * Drink a potion (src/resources.js POTION): the flask comes up, the hearts come back POTION.at s in, it is
   * done at POTION.time. Not while knocked down, riding, swimming or already drinking, nor at full hearts
   * (`why` says which). Returns true when the drink starts; the caller takes the potion from the stock.
   */
  drinkPotion() {
    const why = this.cantDrink();
    if (why) return false;
    this.drinking = { t: 0, healed: false };
    return true;
  }
  /** Why a potion can't be drunk now ('' when it can): 'full', 'down', 'busy'. */
  cantDrink() {
    if (this.down || this.dead) return 'down';
    if (this.drinking || this.ride || this.boarding || this.swim) return 'busy';
    if (this.hearts >= this.maxHearts - 1e-9) return 'full';
    return '';
  }
  /** Per frame: the drink goes on (the hearts come back half-way through). */
  updateDrink(dt) {
    const D = this.drinking;
    if (!D) return;
    if (this.down) { this.drinking = null; return; }
    D.t += dt;
    if (!D.healed && D.t >= POTION.at) { D.healed = true; const got = this.restore(POTION.heal); this.opts.onDrink?.(got); }
    if (D.t >= POTION.time) this.drinking = null;
  }

  /** Owns an item (src/items.js). */
  has(id) { return !!this.items?.has(id); }
  /** The backpack is on the traveller's back and usable (owned, not in a vehicle's socket or being swung, not put away by the story). */
  get packWorn() { return this.has('backpack') && !this.ride && !this.boarding && !this.unboarding && (this.fuelSource?.enabled ?? true); }
  /** The jets are his here: the debug jets anywhere, or the Warden's harness in the City-Shaft (opts.harnessWorld: items.js HARNESS_WORLD). */
  get jetsOwned() { return this.has('jetpack') || (this.has('harness') && !!this.opts.harnessWorld); }
  /** The jets (they burn the backpack's fluid). */
  get canJet() { return this.packWorn && this.jetsOwned; }
  /** The fluid wings. */
  get canGlide() { return this.packWorn && this.has('glider'); }
  /** The double jump (the lift valve, the backpack's first strength: items.js BACKPACK_STAGES). */
  get canDoubleJump() { return this.packWorn && this.has('doublejump'); }
  /** The flip of a double jump under way (s into it), or null (src/jump.js FLIP). */
  get flipping() { const t = this.time - this._flipAt; return t >= 0 && t < FLIP.time ? t : null; }
  /** The locked-on hop under way: { kind, s (s into it), spec (its flip: src/jump.js) }, or null. */
  get hopping() { const H = this._hop; if (!H) return null; H.s = this.time - H.at; return H; }

  /**
   * Locked on, jump with the stick back or to a side (src/jump.js hopKind): a quick hop away, the back flip ('back') or the
   * side hop ('left' | 'right'), carried through the air at its own speed (no steering) with its flip laid over the body,
   * and the dodge frames of FluidBlade.hop (onHop: main.js, which also asks the foes whether it was a perfect dodge: the
   * flurry, src/flurry.js). Sets the velocity's along-up `vu` and its flat part `tv` (returned: { vu }). No double jump in it.
   */
  hop(kind, tv, U) {
    const H = kind === 'back' ? HOP.back : HOP.side, D = this.lockOn.dir;
    const right = _g6.crossVectors(D, U).normalize();
    tv.copy(kind === 'back' ? _g5.copy(D).negate() : right.multiplyScalar(kind === 'right' ? 1 : -1)).multiplyScalar(H.out);
    this._hop = { kind, at: this.time, s: 0, spec: kind === 'back' ? H.spec : { ...H.spec, side: kind === 'right' ? 1 : -1 }, iframes: H.iframes };
    this._airJumped = true; this._jumped = true; this._jumpedNow = false; this._groundJumpAt = -Infinity;
    this.onHop?.(kind, H.iframes);
    return H.up;
  }

  /**
   * A fresh press of jump in the air: the double jump, once each time you leave the ground (the lift valve): a
   * fresh burst up and a little forward (fluid-tool.js boostVelocity, the old boost's), a puff of fluid under the
   * boots (onDoubleJump) and a front flip (src/jump.js FLIP). Returns true if it jumped.
   */
  doubleJump() {
    if (!this.canDoubleJump || this._airJumped || this.onGround || this.climbing || this.mantle || this.swim || this.ride || this.down) return false;
    const U = this.frame.up, fwd = this.frame.dir(this.heading, _g6);
    boostVelocity(this.vel, U, fwd);
    this._airJumped = true; this.gliding = false; this._autoGlide = false;
    this._flipAt = this.time; this._jumped = true;
    this.onDoubleJump?.();
    return true;
  }
  /** The jets' gauge 0..1: the tank's reserve when the tool is worn, else the old fuel. */
  get jetFuel() { return this.fuelSource ? this.fuelSource.jetLevel() : this.fuel; }
  notice(text) { this.lastNotice = text; this.onNotice?.(text); }
  /** In the world's water (src/swim.js): a level's "unsafe" deep water isn't, now that you can swim. */
  get swimmable() { return !!this.swim || (this.inWater?.over ?? 0) > 0.05; }
  /** Water under you deep enough to break a fall (src/swim.js SWIM.cushion). */
  get cushioned() { return !!this.swim || (this.inWater?.depth ?? 0) >= SWIM.cushion; }

  /** Add the parts that live directly in the scene (the simulated scarf). */
  attach(scene) {
    // (the paraglider is gone: the fluid wings bloom out of the backpack's tank, fluid-kit.js)
    scene.add(this.object);
    this.scene = scene;
    if (this.humanoid) {
      // the explorer: suit, bubble helmet, radio pack and pouch belt (no cape)
      this.gear = new Gear(scene, this.humanoid, this.char);
      if (this.char.pack) this.char.pack.visible = false;
      this._lastVel = new THREE.Vector3();
      this.tails = [];
    } else {
      this.cape = new Cape(scene, this.char.capeAnchor ?? this.char.torso, { rows: 9, length: 0.95, bottom: 0.4, color: this.char.colors.cloak, color2: this.char.colors.cloak2 });
      this.tails = this.char.scarfAnchors.map((_, i) =>
        new ClothTail(scene, i === 0 ? { points: 10, seg: 0.2, width: 0.2 } : { points: 7, seg: 0.18, width: 0.16 }));
    }
  }

  /** Torso and leg capsules in world space, for the cape to collide with. */
  bodyCapsules() {
    const c = this.char;
    if (!this._caps) {
      this._caps = [{ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.2 }];
      for (let i = 0; i < 2; i++) this._caps.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.11 }, { a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.09 });
      if (this.char.jetpack.visible) this._caps.push({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.2 });
    }
    const K = this._caps;
    c.torso.localToWorld(K[0].a.set(0, 0.05, 0));
    c.torso.localToWorld(K[0].b.set(0, 0.6, 0));
    for (let i = 0; i < 2; i++) {
      c.legs[i].localToWorld(K[1 + i * 2].a.set(0, 0, 0));
      c.knees[i].localToWorld(K[1 + i * 2].b.set(0, 0, 0));
      K[2 + i * 2].a.copy(K[1 + i * 2].b);
      c.feet[i].localToWorld(K[2 + i * 2].b.set(0, 0, 0.05));
    }
    if (K[5]) { c.jetpack.localToWorld(K[5].a.set(0, -0.2, -0.02)); c.jetpack.localToWorld(K[5].b.set(0, 0.25, -0.02)); }
    return K;
  }

  updateCloth(dt) {
    this.character?.updateCloth(dt);
    // the robe: a short front-open skirt of heavy cloth hanging from the waist, kicked by the legs
    const pelvis = this.humanoid?.b?.pelvis;
    if (pelvis && !this.robe && !this.gear) {
      this.waist = new THREE.Object3D();
      this.scene.add(this.waist);
      this.robe = new Cape(this.scene, this.waist, { cols: 12, rows: 6, top: 0.17, bottom: 0.33, length: 0.62, y: 0.1, gap: 0.6, color: this.char.colors.robe ?? '#c98f52', color2: this.char.colors.robe2 ?? '#8a5a3c' });
    }
    if (this.robe) {
      this.object.updateMatrixWorld(true);
      pelvis.getWorldPosition(this.waist.position);
      this.object.getWorldQuaternion(this.waist.quaternion);
      this.robe.mesh.visible = this.object.visible;
      this.robe.update(dt, {
        up: this.frame.up,
        vel: this.ride ? this.ride.vel : this.climbing ? _cv.set(0, 0, 0) : this.vel,
        wind: this.wind, floor: this.pos,
        capsules: this.humanoid.capsules(),
        spread: 0, lift: this.jetPower * 0.5,
      });
    }
    if (this.cape) {
      this.object.updateMatrixWorld(true);
      this.cape.update(dt, {
        up: this.frame.up,
        vel: this.ride ? this.ride.vel : this.climbing ? _cv.set(0, 0, 0) : this.vel,
        wind: this.wind,
        floor: this.pos,
        capsules: this.humanoid ? this.humanoid.capsules() : this.bodyCapsules(),
        spread: this.gliding ? 1 : 0,
        lift: this.jetPower,
      });
    }
    if (!this.tails) return;
    this.object.updateMatrixWorld(true);
    const up = _cu.set(0, 1, 0).applyQuaternion(this.object.quaternion);
    const side = _cs.set(1, 0, 0).applyQuaternion(this.object.quaternion);
    const back = _cb.set(0, 0, -1).applyQuaternion(this.object.quaternion);
    // relative airflow: the scarf streams behind you when you move
    const vel = this.ride ? this.ride.vel : this.vel;
    const wind = _cw.copy(this.wind).addScaledVector(vel, -1.6);
    const a = _ca.set(0, 1.0, 0).applyMatrix4(this.object.matrixWorld);
    const b = _cbb.set(0, 1.75, 0).applyMatrix4(this.object.matrixWorld);
    for (let i = 0; i < this.tails.length; i++) {
      const anchor = _cA.copy(this.char.scarfAnchors[i]).applyMatrix4(this.object.matrixWorld);
      this.tails[i].update(dt, anchor, up, side, back, wind, a, b);
    }
  }

  get up() {
    return this.frame.up;
  }

  respawn(to) {
    if (this.ride) this.dismount(true);
    this.down = null;
    this.boarding = this.unboarding = null;
    this.endJets();
    this.pos.copy(to ?? this.opts.spawn);
    this.vel.set(0, 0, 0);
    if (!to) {
      this.heading = this.opts.spawnHeading ?? Math.PI;
      this.frame.set(this.opts.spawnUp ?? Y, this.opts.spawnFwd ?? new THREE.Vector3(0, 0, 1));
    } else if (this.opts.gravityAt) {
      // back where you stood, standing the way that place is up (the Hangar's ring: up turns with the floor)
      this.frame.set(this.opts.gravityAt(this.pos));
    }
    this._hang = null;
    this.mantle = null;
    this.onGround = false;
    this.climbing = false;
    this.fuel = 1;
    fillStamina(this);
    this.swim = null;
    this.breath = 1;
  }

  /**
   * Take a hurt, in hearts (counted in quarters: src/resources.js quarters; Infinity takes them all). At nothing left you are knocked out: you
   * go limp where you are (a ragdoll, src/ragdoll.js) and stay down until
   * restart() (the game asks: main.js), which puts you back where you last
   * stood safely, whole again. opts.onHurt(amount, why) hears every hurt,
   * opts.onKnockout(why) the knockout. Nothing hurts the dead.
   */
  hurt(amount, why = 'hit') {
    if (!(amount > 0) || this.opts.health === false || this.down?.dead) return;
    const q = amount === Infinity ? this.hearts : quarters(amount);
    this.hearts = Math.max(0, this.hearts - q);
    if (this.hearts < 1e-9) this.hearts = 0;
    this.hurtAt = this._clock ?? 0;
    this.opts.onHurt?.(q, why);
    if (this.hearts <= 0) {
      if (this.down) { this.down.dead = true; this.opts.onKnockout?.(why); }
      else this._knockout = why;   // (handled at the start of the next frame, not mid-landing)
    }
  }

  /** Lying knocked out (a fatal fall, or the bar run out): waiting for restart(). */
  get dead() { return !!this.down?.dead; }

  /**
   * Knocked down: the body goes limp, keeping its way of going (vel: m/s at
   * the moment, e.g. the landing), its top tipping over that way. dead: it
   * stays down. Riding, nothing knocks you down.
   */
  knockDown(vel, { dead = false, why = 'fall' } = {}) {
    if (this.ride) return false;
    const H = this.humanoid?.b?.pelvis ? this.humanoid : null;
    const U = this.frame.up, vu = vel.dot(U);
    const flat = _g1.copy(vel).addScaledVector(U, -vu);
    const along = flat.length();
    const dir = along > 1 ? flat.divideScalar(along) : this.frame.dir(this.heading, flat);
    // the legs stop, the top keeps going: it topples over (with a little twist, never the same twice)
    const vels = toppleVelocities(dir, U, { carry: Math.min(along, 14) * 0.45, rise: Math.max(vu, -40) * 0.2, tip: 2.6 + Math.min(along, 14) * 0.18 });
    this.down = new Knockdown(H, { dead }).start(vels);
    this.endJets(); this.gliding = this.climbing = false;
    this.mantle = null; this._hang = null; this.boarding = this.unboarding = null;
    this.wingK = 0;
    this.swim = null;
    this.vel.set(0, 0, 0);
    this.onGround = false;
    this.humanoid?.resetFeet();
    this.opts.onKnockdown?.(dead, why);
    if (dead) this.opts.onKnockout?.(why);
    return true;
  }

  /** Knocked out: get up where you last stood safely, whole again (main.js asks first). */
  restart() {
    this._knockout = null;
    this.down = null;
    this.hearts = this.maxHearts;
    this.drinking = null;
    this.hurtAt = -1e9;
    this.respawn(this.lastSafe.lengthSq() || !this.opts.spawn ? this.lastSafe.clone() : undefined);
    this.opts.onRestart?.();
  }

  /** (the old name) */
  wake() { this.restart(); }

  /** Per frame: the clock, the potion being drunk; hearts come back by themselves only where a game lends FALL.regen (never in the world). */
  heal(dt) {
    this._clock = (this._clock ?? 0) + dt;
    if (this.down?.dead) return;
    this.updateDrink(dt);
    if (FALL.regen > 0 && this.hearts < this.maxHearts && this._clock - (this.hurtAt ?? -1e9) > FALL.wait) this.hearts = Math.min(this.maxHearts, this.hearts + FALL.regen * dt);
  }

  /**
   * A frame knocked down: the ragdoll falls and lies (the player's place is the
   * ground under its pelvis, so the camera follows it), then gets up, turned the
   * way the body lay, through a kneel back to standing; then you have control.
   */
  updateDown(dt) {
    const D = this.down, U = this.frame.up, H = D.H;
    if (D.phase !== 'rise') {
      const up = D.update(dt, this.physics, U);
      if (H) D.rag.groundSpot(this.physics, U, this.pos);
      // tumbling on down a long fall (off a ledge, a cliff): its landing hurts like any (landHard), the dead stay down
      const landed = H ? D.rag.takeLanding() : 0;
      if (landed > FALL.tumble * (this.fallGuard ?? 1) && !this.cushioned) this.fallHurt(landed / (this.fallGuard ?? 1));
      if (this.pos.dot(U) < this.opts.killY || (this.opts.unsafe && this.opts.unsafe(this.pos))) {
        // (into deep water, off the world): back where you last stood safely, as anywhere
        this.down = null;
        if (this.health <= 0) this.restart(); else this.respawn(this.lastSafe);
        return;
      }
      if (up) {
        // get up facing the way you lay (toward the feet from the back, toward the head from the front);
        // with the captured get-ups (moves.glb), the one for how you lie, placed so its first frame lies
        // where you lie
        const A = this.animator;
        const G = H && A && this.locoMoves !== false && D.chooseGetUp(U, (n) => !!A.moveClip(n));
        const at = G && getUpPlacement(D, A, this.frame, this.pos);
        if (at) { this.heading = at.heading; this.pos.copy(at.pos); }
        else { D.getUp = null; if (H) this.heading = this.frame.headingOf(D.rag.riseDir(U, _g1)); }
        this.unstick();
        this.physics.pushCapsule(this.pos, RADIUS, STEP, HEIGHT, this._push, U);
        D.beginRise();
      } else {
        if (!H) { this.object.position.copy(this.pos); this.frame.quaternion(this.heading, this.object.quaternion); }
        this.finishDown(dt);
        return;
      }
    }
    // the rise: the get-up clip, or the standing pose down on one knee at first, blended in from lying there
    this.onGround = true; this._wasAir = false;
    this._riseMove = D.getUp ? { name: D.getUp.clip, t: D.riseClipT, w: 1 } : null;
    this.animate(dt, 0);
    this.object.position.copy(this.pos);
    this.frame.quaternion(this.heading, this.object.quaternion);
    if (H) {
      H.update();
      if (this.animator) H.poseHands(this.animator);
      if (!D.getUp) H.kneel(D.kneel, { up: U, fwd: this.frame.dir(this.heading, _g1).clone(), ground: this.pos.dot(U) });
    }
    if (D.rise(dt, U)) {
      // (up: the clip eases out into the stand over GET_UP.out, as you take over)
      if (D.getUp) this._riseOut = { name: D.getUp.clip, t: D.getUp.to, w: 1, rate: D.getUp.rate };
      this._riseMove = null;
      this.down = null; this._safeTimer = 0; this.humanoid?.resetFeet();
    }
    this.finishDown(dt);
  }

  /** The body's extras while down: the face, the gear, the cloth. */
  finishDown(dt) {
    const H = this.humanoid;
    if (typeof H?.face?.update === 'function') H.face.update(dt, { speed: 0, climbing: false });   // (face is the morph now, a plain object: calling it threw and stopped the game on every knockdown)
    if (this.gear) this.gear.update(dt, _g4.set(0, 0, 0), this.phase ?? 0, 0);
    this.updateCloth(dt);
  }

  /**
   * A gesture from motion capture (moves.glb), as you use something: 'kneel' (down on one knee to
   * pick up or look at something low: Mixamo's kneeling inspection) or 'pet' (the kneel, with the
   * petting's arms over it: stroking the dog). Played over `hold` s, eased in and out; walking off
   * ends it. Returns false without the clips (or with the captured moves off).
   */
  /**
   * Locked on and stepping sideways or back: play that step (its time follows the ground covered), eased in and out.
   * (v1.41, the author: "lock-on strafe animation artifacts when moving left and right". Three causes, fixed: a change of
   * side swapped one captured step for the other in a frame at full weight, a pop; a diagonal near the line between two
   * steps flipped between them, and between the steps and the loops, frame to frame; and the starts, stops and pivots
   * (src/loco-moves.js) and the chest turned to where you steer (src/locomotion.js) still played under it, a forward
   * walk's start or a run's 180° pivot laid over each change of side. Now a side is kept until another is clearly
   * wanted (strafeSide: hysteresis), a change of side fades the old step out before the new one fades in (`swap` its
   * rate), and locked on neither the starts, stops and pivots nor the chest's lead play.)
   */
  updateStrafe(dt, A, hs, R) {
    const S = (this._strafe ??= { w: 0, t: 0, side: null });
    let want = null;
    if (this.lockOn && this.onGround && hs > 0.4 && !R && !this.down && !this.ride && !this.swim && !this.climbing) {
      const F = this.frame.dir(this.heading, _g1), U = this.frame.up, Rt = _g2.crossVectors(F, U).normalize();
      want = strafeSide(this.vel.dot(F), this.vel.dot(Rt), S.side);
    }
    const st = strafeStep(S, want, dt);
    if (!st) return;
    const M = LOCK_MOVE[st], clip = A.moveClip?.(M.clip);
    if (!clip) return;
    S.t = (S.t + dt * hs / M.speed) % clip.duration;
    A.play(M.clip, S.t, S.w, { full: true });
  }

  /** Hit (a foe's strike that didn't knock you down): the upper body flinches, from motion capture (FLINCH). */
  flinch() { if (!this.down && !this.ride) this._flinch = { t: 0 }; }

  gesture(kind, { hold = kind === 'pet' ? 1.8 : 1.1 } = {}) {
    const A = this.animator;
    if (this.locoMoves === false || !A?.moveClip(GESTURES.kneel.clip) || !this.onGround || this.ride || this.swim || this.climbing) return false;
    this._gesture = { kind, t: 0, hold, w: 0 };
    return true;
  }

  /** Jump to another place, e.g. through a portal, with a new "up" (speed: carry on walking along fwd). */
  teleport(pos, up, fwd, { speed = 0 } = {}) {
    this.boarding = this.unboarding = null;
    if (this.down && !this.down.dead) this.down = null;   // (the dead stay down: the game asks to restart)   // the pack is simply back on (fluid-tool.js follows the state)
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.endJets();
    if (speed > 0 && fwd) this.vel.copy(fwd).normalize().multiplyScalar(speed);
    this.frame.set(up, fwd);
    this.heading = 0;
    this.onGround = false;
    this.climbing = false;
    this.mantle = null;   // (a climb onto a ledge in progress would pull you back to it)
    this.swim = null;     // (swim.js finds the water again if there is some here)
    this.lastSafe.copy(pos);
  }

  /** Distance from the player to the summonable mount. */
  bikeDistance() {
    return this.mount ? this.mount.pos.distanceTo(this.pos) : Infinity;
  }

  /** Nearest vehicle you could board right now. */
  nearestVehicle() {
    let best = null, bd = Infinity;
    for (const v of this.vehicles) {
      if (v.dormant) continue;   // not found yet (the desert's bike under its tarp)
      const d = v.pos.distanceTo(this.pos);
      if (d < bd && d < (v.boardDistance ?? 6)) { best = v; bd = d; }
    }
    return best;
  }

  mount_(v) {
    if (this.swim) leaveSwim(this, 'ride');
    this.ride = v;
    this.boarding = this.unboarding = null;
    this.endJets(); this.gliding = this.climbing = false;
    this.wingK = 0;   // the wings fold away at once
    v.board?.(this.pos);
  }

  /** Does this vehicle run on the backpack? (hoverbikes and skiffs; not the bird, who's alive, nor cabs, which drive themselves) */
  needsPower(v) { return !!v?.powered; }

  /**
   * Get on a vehicle. A powered one needs the backpack: without it, a notice
   * and nothing else. With it, the hand-off plays (HANDOFF.board, ~1 s: the
   * pack swings off into the vehicle's socket, then you climb on); moving
   * skips to the end. Without the fluid tool (tests) or a socket, you just get on.
   */
  board(v) {
    if (v.refuses?.(this, 'board')) return false;   // a cab without a pass (src/taxi.js)
    if (this.needsPower(v) && !this.has('backpack')) { this.notice('It needs power.'); return false; }
    if (this.needsPower(v) && this.handoff && v.socket && this.onGround && !this.climbing && !this.mantle) {
      this.boarding = { v, t: 0, dur: HANDOFF.board, k: 0, from: this.pos.clone(), heading: this.heading };
      this.vel.set(0, 0, 0);
      this.endJets(); this.gliding = false;
      return true;
    }
    this.mount_(v);
    return true;
  }

  finishBoarding() {
    const B = this.boarding;
    this.boarding = null;
    if (B) this.mount_(B.v);
  }

  /** instant: no hand-off back (respawning); the pack is simply on the back again. */
  dismount(instant = false) {
    const v = this.ride;
    this.ride = null;
    const out = this.exitSpot(v);   // (before it leaves: a cab says where its stop is while it still waits there)
    v.leave?.();
    this.pos.copy(out);
    this.vel.set(v.vel.x * 0.3, 0, v.vel.z * 0.3);
    this.heading = v.heading;
    this.onGround = false;
    this.unstick();
    // take the backpack back out of its socket and put it on
    if (!instant && this.needsPower(v) && this.handoff && v.socket && this.has('backpack')) this.unboarding = { v, t: 0, dur: HANDOFF.unboard, k: 0 };
  }

  /**
   * Where to step off a vehicle: its left side as before, else the right,
   * behind, in front, further out, and finally on the spot it occupies (it
   * collides with the level itself, so that's free). A spot only counts if
   * the body fits there, it isn't inside a building and you can reach it
   * from the seat without passing through a wall.
   */
  exitSpot(v) {
    const own = v.exitAt?.();   // (a cab waiting at a stop: the stop's own spot, src/taxi.js)
    if (own) return own;
    const [fx, fz] = v.forward;
    const side = v.exitOffset ?? 1.8, P = this.physics;
    const seat = _g4.set(v.pos.x, v.pos.y + 0.6, v.pos.z);
    const offsets = [[-fz, fx, 1], [fz, -fx, 1], [-fx, -fz, 1.4], [fx, fz, 1.6], [-fz, fx, 1.8], [fz, -fx, 1.8], [-fx, -fz, 2.4]];
    const spot = new THREE.Vector3();
    for (const [dx, dz, k] of offsets) {
      spot.set(v.pos.x + dx * side * k, v.pos.y, v.pos.z + dz * side * k);
      const g = P.groundAt(spot.x, spot.y + 2, spot.z);
      if (spot.y - g < 3) spot.y = g;
      const to = _g6.copy(spot).addScaledVector(Y, 1.1).sub(seat), d = to.length();
      if (P.rayDistance(seat, to.normalize(), d) < d) continue;           // a wall in the way
      if (P.embedded?.(_g6.copy(spot).addScaledVector(Y, 1.1))) continue;   // inside a building
      const probe = _g6.copy(spot);
      const push = P.pushCapsule(probe, RADIUS, STEP, HEIGHT, this._push, Y);
      if (push && push.length() > 0.05) continue;                          // the body doesn't fit
      return spot;
    }
    spot.copy(v.pos);
    const g = P.groundAt(spot.x, spot.y + 1, spot.z);
    if (spot.y - g < 3) spot.y = g;
    return spot;
  }

  /** How far up a vehicle is flying (m above the ground under it; Infinity over the void). */
  rideHeight(v = this.ride) {
    const g = this.physics.groundAt(v.pos.x, v.pos.y + 1, v.pos.z);
    return Number.isFinite(g) ? v.pos.y - g : Infinity;
  }

  /** Is the bird yours, and would she catch you in mid-air (bird.js summon airborne)? */
  get birdCatches() {
    const M = this.mount;
    return !!M && M.kind === 'bird' && !M.dormant && typeof M.summon === 'function' && (!this.opts.canSummon || this.opts.canSummon());
  }

  /** Something to break a long fall once off: the wings, or the jets with fluid in the tank (the pack is back on at once in the air). */
  get fallSaver() {
    const pack = this.has('backpack') && (this.fuelSource?.enabled ?? true);
    return pack && (this.has('glider') || (this.jetsOwned && this.jetFuel > 0.1));
  }

  /**
   * Jump off what you ride (JUMP_OFF): a hop, and its speed carries you on. Returns false
   * (with a notice) where the drop would kill you and nothing would save you.
   */
  jumpOff() {
    const v = this.ride;
    if (!v || this.boarding || this.unboarding) return false;
    const height = this.rideHeight(v), airborne = height > JUMP_OFF.air;
    const vel = _g5.copy(v.vel ?? _v1.set(0, 0, 0));
    const up = vel.y + JUMP_OFF.hop;
    const landing = Math.sqrt(up * up + 2 * GRAVITY * Math.max(0, height));
    const fatal = airborne && this.opts.health !== false && landing >= FALL.lethal * (this.fallGuard ?? 1);
    const bird = v === this.mount && this.birdCatches;
    if (fatal && !this.fallSaver && !bird) { this.notice('Too high to jump.'); return false; }
    const hx = vel.x * JUMP_OFF.keep, hz = vel.z * JUMP_OFF.keep;
    this.dismount(airborne || Math.abs(v.speed ?? 0) > JUMP_OFF.moving);   // (in the air or at speed the backpack is simply back on: no hand-off from a socket racing away)
    this.vel.set(hx, up, hz);
    this._jumpHeld = true;     // (the press that jumped is not also a jump, a boost or the wings)
    this._autoGlide = airborne && this.canGlide;
    this._offFlyer = airborne && bird ? { t: 0 } : null;
    this._carry = true;
    return true;
  }

  /** Off a flyer without wings or jets: a fall that would kill you brings the bird to catch you (JUMP_OFF.catchAfter s in). */
  watchFall(dt) {
    const O = this._offFlyer;
    if (!O) return;
    if (this.onGround || this.ride || this.swim || this.down || this.gliding || this.jetFlight || this.climbing) { this._offFlyer = null; return; }
    if ((O.t += dt) < JUMP_OFF.catchAfter || this.mount?.mode === 'catching') return;
    const U = this.frame.up, h = this.physics.heightAbove(this.pos, U), vu = this.vel.dot(U);
    const landing = Number.isFinite(h) ? Math.sqrt(vu * vu + 2 * GRAVITY * Math.max(0, h)) : Infinity;
    if (landing >= FALL.lethal * (this.fallGuard ?? 1) * 0.92) { this._offFlyer = null; this.callMount(); }
  }

  // E: get off; get on a vehicle close by; otherwise (call: the keyboard's E) whistle the mount or hail a taxi.
  // A pad keeps the two apart: its interact button never whistles, the left face button calls (callMount).
  // Getting off something moving or flying is a jump off (jumpOff), with its speed; standing, a step off beside it.
  interact({ call = true } = {}) {
    if (this.boarding || this.unboarding) return;
    if (this.ride) {
      const v = this.ride;
      if (v.exitAt?.()) return this.dismount();   // a cab at a stop: you step out onto it, however high it hovers
      if (Math.abs(v.speed ?? 0) > JUMP_OFF.moving || this.rideHeight(v) > JUMP_OFF.air) return this.jumpOff();
      return this.dismount();
    }
    const near = this.nearestVehicle();
    if (near) return this.board(near);
    if (call) return this.callMount();
  }

  /** Whistle the mount (the bike drives over, the bird flies down), or else hail the nearest taxi. Not while riding. */
  callMount() {
    if (this.boarding || this.unboarding || this.ride) return;
    if (this.opts.canSummon && !this.opts.canSummon()) return;   // e.g. in a room off the map
    if (this.mount?.dormant) return this.mount.onDormantCall?.(this);   // nothing to whistle for yet: it hasn't been found (Vael's bird: not until her call is learnt)
    if (this.mount && this.needsPower(this.mount) && !this.has('backpack')) { this.opts.onWhistle?.('mount'); return this.notice('It needs power.'); }   // the whistle wakes nothing
    if (this.mount) {
      this.opts.onWhistle?.('mount');
      const d = this.frame.dir(this.heading, _v1);
      const airborne = !this.onGround && !this.climbing && this.physics.heightAbove(this.pos, this.frame.up) > 3;
      return this.mount.summon(this.pos.x + d.z * 3 + d.x * 2, this.pos.z - d.x * 3 + d.z * 2, this.heading, this.pos,
        { airborne, vel: this.vel, camFwd: this.camFwd });
    }
    let best = null, bd = Infinity;
    for (const v of this.vehicles) {
      if (!v.hail) continue;
      // (a free cab answers before a nearer one with a fare aboard, which would have to drop it first)
      const d = v.pos.distanceTo(this.pos) * (v.fare ? 1.5 : 1);
      if (d < bd) { best = v; bd = d; }
    }
    if (best) { this.opts.onWhistle?.('taxi'); if (!best.refuses?.(this, 'hail')) best.hail(this.pos, this.heading); }
  }

  /** Flying on the jets, posed for it (not holding still to aim). */
  get onJets() { return !!this.jetFlight && !this.jetHold; }

  /**
   * The jets take over (JET): from the ground they lift you off nose up (JET.takeoff, JET.lift up);
   * fired in the air, nose up too unless you are moving across faster than JET.carry, when you
   * keep your way (the nose along it, never below level).
   */
  startJets(fromGround) {
    const U = this.frame.up, vu = this.vel.dot(U);
    const flat = _g5.copy(this.vel).addScaledVector(U, -vu), hs = flat.length();
    let pitch = JET.takeoff;
    // (fired just after a jump off the ground, A / × held from the take-off: off they go nose up, as from the ground)
    const takingOff = this.time - (this._groundJumpAt ?? -Infinity) < 0.45;
    if (!fromGround && !takingOff && hs > JET.carry) { this.heading = this.frame.headingOf(flat); pitch = THREE.MathUtils.clamp(Math.atan2(vu, hs), 0, JET.takeoff); }
    this.jetFlight = { pitch, bank: 0, along: 0 };
    this.gliding = false;
    if (fromGround) { this.onGround = false; this._jumped = false; this.vel.addScaledVector(U, Math.max(0, JET.lift - vu)); }
  }

  /** Off the jets (landed, too slow to glide, the wings, a ride, a climb, a fall over). */
  endJets() { this.jetFlight = null; this.thrusting = false; this.jetHold = false; this.jetPower = 0; }

  /**
   * A frame of flight on the jets (JET; jetSteer, jetStep): the stick flies the nose, the throttle
   * T drives you along it, unpowered you glide on. Aiming (tr.aim) the jets hold you, sinking
   * slowly. Returns false when the flight ends this frame (unpowered, the pad's jump pressed or
   * the wings' key held), so the frame goes on as a fall (a boost, the wings).
   */
  flyJets(dt, input, { f, s, T, tr, run, freshJump, canGlide, jetOn }) {
    const J = this.jetFlight, U = this.frame.up;
    const hold = jetOn && tr.aim && !this.onGround;
    if (!T && !hold && canGlide && input.Space && (run || !jetOn)) { this.endJets(); return false; }   // (dry, or jump held with run: the wings)
    // the burn: the throttle's (a light squeeze still burns JET.idle of it), half aiming
    let burn = hold ? JET.hold.burn : T > 0 ? JET.idle + (1 - JET.idle) * T : 0;
    if (burn && this.fuelSource && !this.fuelSource.burnJet(dt * burn)) burn = 0;
    if (burn && !this.fuelSource) { this.fuel = Math.max(this.fuel - JET_DRAIN * dt * burn, 0); if (this.fuel <= 0) burn = 0; }
    this.jetHold = burn > 0 && hold;
    const thrust = burn > 0 && !hold ? T : 0;
    this.thrusting = thrust > 0;
    this.jetPower = burn;
    if (this.jetHold) {
      // aiming: the way you were going bleeds away, a slow sink; the nose eases level, the bank out
      const k = 1 - Math.exp(-JET.hold.rate * dt), vu = this.vel.dot(U);
      this.vel.addScaledVector(U, -vu).multiplyScalar(1 - k).addScaledVector(U, vu + (-JET.hold.sink - vu) * k);
      J.pitch *= 1 - k; J.bank *= 1 - k; J.along = 0;
    } else {
      this.heading += jetSteer(J, f, s, dt, this.invertFlight);
      const nose = jetNose(this.frame.dir(this.heading, _g6), U, J.pitch, _jn);
      J.along = jetStep(this.vel, nose, U, thrust, dt, { boost: !!run, gravity: GRAVITY });
      if (!thrust) J.pitch = jetDroop(J.pitch, this.vel, U, dt, J.along);   // (a stall drops the nose: the fall becomes a glide)
    }
    this._jumpHeld = !!input.Space;
    return true;
  }

  update(dt, input, camYaw) {
    this.time += dt;
    if (this._knockout) { const why = this._knockout; this._knockout = null; if (!this.down) this.knockDown(this.vel, { dead: true, why }); else this.down.dead = true; }
    this.heal(dt);
    // knocked down: no control until you are back on your feet (the dead wait for restart())
    if (this.down) { this._jumpHeld = !!input.Space; this._eHeld = !!input.KeyE; this.updateDown(dt); return; }
    // the bird caught up with you in mid-air: you're on its back
    const M = this.mount;
    if (M && M.mode === 'catching' && !this.ride && M.catchDist < 2.6) {
      this.mount_(M);
      M.landed = false;
      M.speed = Math.max(18, Math.hypot(this.vel.x, this.vel.z));
      this.gliding = false;
    }
    if (input.KeyE && !this._eHeld) this.interact({ call: !input.PadE });
    this._eHeld = !!input.KeyE;
    // the pad's bottom button while riding: jump off (controller.js JumpOff)
    if (input.JumpOff && !this._offHeld && this.ride) this.jumpOff();
    this._offHeld = !!input.JumpOff;

    if (this.ride) {
      this.ride.update(dt, input, this.time);
      this.pos.copy(this.ride.pos);
      this.ride.seatTransform(this.object.position, this.object.quaternion);
      this._animAcc += dt;
      if (!this.stopMotion || this._animAcc >= 1 / 12) {
        this.animateRiding();
        this._animAcc = 0;
      }
      this.humanoid?.update();
      this.humanoid?.resetFeet();
      this.updateCloth(dt);
      return;
    }

    // gravity can change direction (Sealed Hangar)
    const F = this.frame;
    if (this.opts.gravityAt) F.turnToward(this.opts.gravityAt(this.pos), 5, dt);
    const U = F.up;

    let f = (input.KeyW || input.ArrowUp ? 1 : 0) - (input.KeyS || input.ArrowDown ? 1 : 0);
    let s = (input.KeyD || input.ArrowRight ? 1 : 0) - (input.KeyA || input.ArrowLeft ? 1 : 0);
    const run = input.ShiftLeft || input.ShiftRight;
    // analog stick (touch): direction and partial speed
    let stickScale = 1;
    if (input.stick && (input.stick.x || input.stick.y)) {
      f = input.stick.y; s = input.stick.x;
      stickScale = Math.min(Math.hypot(f, s), 1);
    }

    // the hand-off: swinging the pack into the vehicle's socket, then climbing on (moving, jumping skip it)
    if (this.boarding) {
      const B = this.boarding;
      B.t += dt; B.k = Math.min(1, B.t / B.dur);
      const gone = B.v.pos.distanceTo(this.pos) > (B.v.boardDistance ?? 6) + 4;
      if (B.k >= 1 || f || s || input.Space || gone) { this.finishBoarding(); this._jumpHeld = !!input.Space; return; }
      // stand still, turned to the socket
      this.vel.set(0, 0, 0);
      const to = _v1.subVectors(B.v.pos, this.pos);
      to.addScaledVector(F.up, -to.dot(F.up));
      if (to.lengthSq() > 0.01) { let d = F.headingOf(to) - this.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); this.heading += d * (1 - Math.exp(-10 * dt)); }
      this._jumpHeld = !!input.Space;
      this.finishFrame(dt, 0);
      return;
    }
    if (this.unboarding) {
      const B = this.unboarding;
      B.t += dt; B.k = Math.min(1, B.t / B.dur);
      if (B.k >= 1 || (input.Space && !this._jumpHeld)) this.unboarding = null;
    }
    if (this.mantle) {
      this.updateMantle(dt);
      this.finishFrame(dt, 0);
      return;
    }
    if (this.climbing || this.swim || this.ride) this._airJumped = false;   // (a hold, the water or a mount gives the double jump back)
    if (this.climbing) {
      this.updateClimb(dt, f, s, input);
      this.finishFrame(dt, 0);
      return;
    }
    this._climbCooldown = Math.max(this._climbCooldown - dt, 0);

    // water (src/swim.js): wading slows the walk; deep enough, you float and swim
    if (swimFrame(this, dt, input, camYaw, { f, s, run, stickScale })) { this.finishFrame(dt, this.swim?.hs ?? 0); return; }

    // camera-relative movement in the tangent plane
    const camF = _v1.copy(F.right).multiplyScalar(-Math.sin(camYaw)).addScaledVector(F.fwd, -Math.cos(camYaw));
    const camR = _v2.copy(F.right).multiplyScalar(Math.cos(camYaw)).addScaledVector(F.fwd, -Math.sin(camYaw));
    let move = new THREE.Vector3().addScaledVector(camF, f).addScaledVector(camR, s);
    if (move.lengthSq() > 0) move.normalize();
    (this._moveDir ??= new THREE.Vector3()).copy(move);   // where you steer (the head and chest lead the turn: locomotion.js)

    // The jets (items: backpack + jetpack, any world) fly like a plane (JET, startJets, flyJets).
    // The throttle: jump held in the air, on every input (the progression rewrite, v1.38: RT / R2 is the
    // gadget in hand's now; A / × held, SPACE held, touch ⤒ held), full; not the press itself, which may be
    // the double jump; not with run held when the wings are owned (A / × + L3, Shift + Space), which glides.
    const canJet = this.canJet, canGlide = this.canGlide, fuel = this.jetFuel;
    const tr = triggers(input);
    const jetOn = canJet && fuel > 0.004;
    const freshJump = !!input.Space && !this._jumpHeld;
    // (on the jets already, a press is the throttle at once: there is no double jump in flight)
    const spaceT = jetOn && !this.onGround && !this._hop && input.Space && (!freshJump || !!this.jetFlight) && !(canGlide && run) ? 1 : 0;   // (not in a hop: A / × held from it)
    const T = jetOn ? spaceT : 0;
    if (!this.jetFlight && jetOn && !this.climbing && !this.onGround && T > 0) this.startJets(false);
    const flying = !!this.jetFlight && this.flyJets(dt, input, { f, s, T, tr, run, freshJump, canGlide, jetOn });
    let steering = false;
    if (flying) {
      move = _jf.set(0, 0, 0);   // (flying into a wall slides along it: no grabbing it to climb)
      this._wantSpeed = 0; this._accel = 2.5;
      this.sprinting = false; this._carry = false; this._autoGlide = false; this.gliding = false;
    } else {
      this.thrusting = false; this.jetHold = false; this.jetPower = 0;
      // sprinting spends the stamina climbing does (src/stamina.js); winded, you jog
      const sprint = run && canSprint(this) && !this.aim && !this.lockOn;   // (locked on: no sprint, you strafe)
      this.sprinting = sprint && this.onGround && !this.gliding && move.lengthSq() > 0.01;
      let speed = (sprint ? RUN : WALK) * (stickScale < 1 ? THREE.MathUtils.lerp(0.35, 1, stickScale) : 1);
      if (this.gliding) speed *= 1.25;
      if (this.aim) speed = Math.min(speed, WALK) * (1 - 0.35 * this.aim.k);   // aiming: a steady walk
      else if (this.lockOn && !this.gliding) speed = Math.min(speed, LOCK_MOVE.speed);   // locked on: a jog at most
      if (this.onGround && this.combatMotion) speed *= this.combatMotion.scale;
      speed *= this.wadeSlow;                                                   // wading (src/swim.js)
      steering = move.lengthSq() > .001;
      if (this.onGround || this.gliding) this._carry = false;   // (jumped off something fast: its speed carries you until you land)
      // (in a locked-on hop, none: it carries you its own way)
      if (this._hop && this.onGround && this.time - this._hop.at > 0.1) { this._hop = null; this._hopReady = this.time + HOP.rest; }
      const accel = this.onGround ? (steering ? 8 : 16) : this._hop ? 0 : this._carry ? 0.5 : 2.5;
      // (the motion matcher predicts the body's path with this same spring: animateClips)
      this._wantSpeed = move.lengthSq() > 0 ? speed : 0;
      this._accel = accel;
      const a = 1 - Math.exp(-accel * dt);
      let vu = this.vel.dot(U);
      const tv = _v3.copy(this.vel).addScaledVector(U, -vu);
      const want = _g5.copy(move).multiplyScalar(speed);
      tv.addScaledVector(want.sub(tv), a);
      if (this.onGround && this.combatMotion) {
        const C = this.combatMotion;
        if (C.evade || C.dash) tv.copy(C.dir).multiplyScalar(C.speed);   // (the evade, the dash cut: carried at their own speed)
        else tv.addScaledVector(C.dir, C.speed * a);
      }
      // the blade's rising cut (src/fluid-blade.js RISE): a leap up and in to a foe hovering over you
      if (this.riseKick && this.onGround) {
        const K = this.riseKick;
        vu = Math.max(vu, K.up); this.onGround = false;
        tv.copy(K.dir).multiplyScalar(K.speed);
        this._jumped = true;
      }
      this.riseKick = null;
      // the blade's air cut (src/fluid-blade.js AIR): held a moment at the top, then driven down into the cut
      // (and carried in to its foe: speed along dir, as the cut's pull does on the ground)
      if (this.airKick) {
        const K = this.airKick;
        if (!this.onGround) { if (K.up != null) vu = K.up; if (K.dir) tv.copy(K.dir).multiplyScalar(K.speed); }
        this.airKick = null;
      }

      // jump / glide
      let jumped = false;
      // locked on, the stick back or to a side: the back flip, the side hop (hop: src/jump.js HOP), instead of the jump
      const hk = input.Space && this.onGround && !this._jumpHeld && this.lockOn && this.time >= this._hopReady && !this.down
        ? hopKind(move.dot(this.lockOn.dir) * stickScale, move.dot(_g6.crossVectors(this.lockOn.dir, U).normalize()) * stickScale) : null;
      if (hk) {
        vu = this.hop(hk, tv, U);
        this.onGround = false;
        jumped = true;
      } else if (input.Space && this.onGround && !this._jumpHeld) {
        vu = JUMP;
        this.onGround = false;
        jumped = true;
        this._jumped = true;   // (the pose's take-off: src/jump.js)
        this._jumpedNow = true;   // (and the captured jump's: src/air-moves.js)
        this._groundJumpAt = this.time;   // (the jets fired from it go nose up: startJets)
      }
      const jumpedNow = input.Space && !this._jumpHeld;
      this._jumpHeld = !!input.Space;
      // a fresh press in the air is the double jump, once each time you leave the ground (the lift valve)
      const airPress = jumpedNow && !jumped && !this.onGround;
      if (this.onGround) this._airJumped = false;
      if (airPress || this.onGround) this._autoGlide = false;   // (jumped off a flyer: the wings opened by themselves until you press jump)
      vu -= GRAVITY * dt;
      if (this.onGround) this.fuel = Math.min(this.fuel + JET_REFILL * dt, 1);

      // The fluid wings (items: backpack + glider): they open when you hold jump while falling
      // (with the jets owned and fluid in the tank, jump held with run: A / × + L3, Shift + Space; held alone
      // it fires the jets). You fly forward with momentum along your heading: A/D bank and turn, W dives
      // (faster, sinks more), S flares (slow, floaty).
      const air = !this.onGround;
      const wingsBtn = ((input.Space && (run || !jetOn)) || this._autoGlide) && !this._hop;
      const wantGlide = canGlide && air && wingsBtn;
      const wasGliding = this.gliding;
      this.gliding = wantGlide && (vu < 0 || wasGliding);
      if (this.gliding) {
        if (!wasGliding) this.glideSpeed = Math.max(Math.hypot(tv.x, tv.z), 11);
        const target = f > 0 ? 30 : f < 0 ? 7 : 15;
        this.glideSpeed += (target - this.glideSpeed) * (1 - Math.exp(-(f > 0 ? 0.9 : 0.6) * dt));
        const sink = (f > 0 ? 7 : f < 0 ? 1.3 : 2.4) * (f > 0 ? 1 : this.sinkK ?? 1);   // (the wind-silk scarf: sinkK 0.6)
        this.glideTurn = THREE.MathUtils.lerp(this.glideTurn ?? 0, -s * 1.25, 1 - Math.exp(-4 * dt));
        this.heading += this.glideTurn * dt;
        tv.copy(F.dir(this.heading, _g6)).multiplyScalar(this.glideSpeed);
        vu += GRAVITY * dt;                                  // the wing carries you: no free fall
        vu += (-sink - vu) * (1 - Math.exp(-3 * dt));
      } else this.glideTurn = 0;
      this.vel.copy(tv).addScaledVector(U, vu);
      // the double jump sets its burst on this.vel; the wings reopen once you fall again
      if (airPress) this.doubleJump();
    }

    // Swept collision: the frame's motion is split into sub-steps no longer
    // than half the capsule radius, each pushed out of walls and checked for
    // ground, so sprinting, gliding, the jetpack, long falls or a slow frame
    // can't carry you through a wall or a roof between two checks.
    const steps = Math.min(Math.ceil((this.vel.length() * dt) / (RADIUS * 0.5)), 48) || 1;
    const sdt = dt / steps;
    let carrier = null, pushed = false;
    this._edgeStep = false; this._edgeN ??= new THREE.Vector3();
    for (let k = 0; k < steps; k++) {
      carrier = this.moveStep(sdt, U, move);
      if (this._pushedStep) pushed = true;
      if (this.climbing || this._respawned || this._landing) break;
    }
    this._respawned = false;
    if (this._landing) {
      // a hard landing: over you go (the ragdoll starts from this frame's pose, next frame)
      const L = this._landing;
      this._landing = null;
      const dead = this.health <= 0;
      if (dead) this._knockout = null;
      this.knockDown(L.vel, { dead, why: 'fall' });
      if (!this.down) { this.finishFrame(dt, 0); return; }
      this.object.position.copy(this.pos);
      this.finishDown(dt);
      return;
    }
    if (!pushed) this._press = 0;
    // the ground under the jets: under thrust, nose level or up, you skim it (the nose lifts a
    // little, off you go again); nose down (JET.land) or gliding, you land, and the trigger held
    // through the landing lifts you off again only on a fresh squeeze
    if (this.jetFlight && this.onGround) {
      if (this.thrusting && this.jetFlight.pitch > -JET.land) { this.onGround = false; this.jetFlight.pitch = Math.max(this.jetFlight.pitch, 0.08); }
      else this.endJets();
    }
    // leaning into the world's edge (src/edge.js): how hard, where; the first time, what holds you back
    const E = (this.edge ??= new EdgePush());
    E.update(dt, this._edgeStep, this._edgeN, this.pos, steering ? move : null);
    if (E.wantsHint() && this.opts.edgeHint && hintsFor('tip')) this.notice(this.opts.edgeHint);   // (the wind and the lean say it: the line, hints full)
    if (this.climbing) { this.finishFrame(dt, 0); return; }
    // stamina: the sprint spends it, the ground gives it back (faster standing than walking)
    // (sprintK: the diver's pearl, a third less; restK: the pocket bellows, twice as fast back)
    if (this.sprinting && this.onGround) spendStamina(this, STAMINA.sprint * dt * (this.sprintK ?? 1));
    else if (this.onGround) restStamina(this, dt * (this.restK ?? 1), Math.hypot(this.vel.x, this.vel.z) < 0.5 ? STAMINA.stand : STAMINA.walk);
    // ride along on whatever you're standing on (and the feet held on it, and the drawn body's step lag, with you)
    (this._ridden ??= new THREE.Vector3()).set(0, 0, 0);
    if (carrier && this.onGround) { this.pos.addScaledVector(carrier.vel, dt); this._ridden.copy(carrier.vel).multiplyScalar(dt); }

    // Still ended up inside solid geometry (a moving taxi, a teleport, a
    // vehicle): step out to the nearest free spot, or back to the last one.
    const stuck = this.unstick() || this.unhang(dt);
    this.watchFall(dt);   // jumped off the bird, falling to your death: she comes for you

    // deep water and other unsafe places put you back where you last stood safely
    if (this.opts.unsafe && this.opts.unsafe(this.pos) && !this.swimmable) this.respawn(this.lastSafe);
    else if (!stuck && this.onGround && (this._safeTimer += dt) > 0.4) { this.lastSafe.copy(this.pos); this._safeTimer = 0; }

    // facing
    const tvel = _v1.copy(this.vel).addScaledVector(U, -this.vel.dot(U));
    const hs = tvel.length();
    if (this.onJets) {
      // flying on the jets: the heading is the nose's (flyJets steers it)
    } else if (this.lockOn && !this.gliding && !this.climbing && !this.ride && !this.swim) {
      // locked on: face the foe square, whichever way you move (strafing, backing off): no lead into the step
      const d = Math.atan2(Math.sin(this.frame.headingOf(this.lockOn.dir) - this.heading), Math.cos(this.frame.headingOf(this.lockOn.dir) - this.heading));
      this.heading += d * (1 - Math.exp(-LOCK_MOVE.turn * dt));
    } else if (this.aim && !this.gliding) this.faceAim(dt, tvel, hs);
    else if (hs > 0.5 && !this.gliding) {
      let d = F.headingOf(tvel) - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-12 * dt));
    } else if (this.edge.k > 0.15 && !this.gliding) {
      // leaning into the world's edge: turned to face it
      let d = F.headingOf(_v1.copy(this.edge.n).negate()) - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * (1 - Math.exp(-6 * this.edge.k * dt));
    } else if (this.faceToward && !this.gliding) {
      // standing still in a conversation, or looking at something: turned toward it
      const to = _v1.subVectors(this.faceToward, this.pos);
      to.addScaledVector(U, -to.dot(U));
      if (to.lengthSq() > 0.09) {
        let d = F.headingOf(to) - this.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += d * (1 - Math.exp(-5 * dt));
      }
    }
    this.finishFrame(dt, hs);
  }

  /**
   * One collision sub-step of free movement: integrate, push out of walls
   * (sliding along them, maybe grabbing them to climb), moving solids, then
   * the ground. Returns the carrier (a taxi roof) you stand on, if any.
   */
  moveStep(dt, U, move) {
    this._pushedStep = false;
    this.pos.addScaledVector(this.vel, dt);
    // the world's edge: held there, the outward speed taken away (sliding along it, not running on the spot: src/edge.js)
    // (not in a room built off the map, a shop's at its slot far out over the edge: src/interior-kit.js)
    if (Number.isFinite(this.opts.limit) && Math.max(Math.abs(this.pos.x), Math.abs(this.pos.z)) > this.opts.limit - 2 && !inTightRoom(this.pos, 0.3)
      && keepInside(this.pos, this.vel, this.opts.limit, _edgeN)) { this._edgeStep = true; this._edgeN.copy(_edgeN); }

    // Walls and ceilings: a capsule from just above step height to the head.
    // Anything lower than STEP is stepped onto by the ground ray below.
    const push = this.physics.pushCapsule(this.pos, RADIUS, STEP, HEIGHT, this._push, U);
    if (push) {
      this._pushedStep = true;
      const n = push.normalize();
      const vn = this.vel.dot(n);
      if (vn < 0) this.vel.addScaledVector(n, -vn); // slide along the wall
      // pushing into a steep wall: start climbing (immediately in the air)
      const wall = Math.abs(n.dot(U)) < 0.35 && move.dot(n) < -0.6;
      if (this.opts.climb && wall && this._climbCooldown === 0 && this.stamina > 0.1 && !this.winded) {
        this._press += dt;
        if (!this.onGround || this._press > 0.25) this.startClimb(n);
      } else this._press = 0;
    }
    if (this.climbing) return null;

    // Moving solids (taxis): pushed out of their sides, or standing on the roof
    let carrier = null, roofH = Infinity;
    if (this.opts.dynamic) {
      for (const v of this.opts.dynamic()) {
        if (v === this.ride || !v.solid) continue;
        const d = v.solid;
        const dx = this.pos.x - d.pos.x, dz = this.pos.z - d.pos.z, hd = Math.hypot(dx, dz);
        if (hd > d.r + RADIUS) continue;
        if (d.topAt) {
          // (a shaped solid, src/carriers.js: a cab's hull and canopy, a ball's dome)
          const above = this.pos.y - (hd <= d.r ? d.topAt(this.pos.x, this.pos.z) : -Infinity);
          if (above > -0.5 && above < 0.9 && this.vel.y - d.vel.y <= 0.5) { if (above < roofH) { roofH = above; carrier = d; } }
          else if (this.pos.y + HEIGHT > d.bottom) d.pushOut?.(this.pos, RADIUS);
          continue;
        }
        const above = this.pos.y - d.top;
        if (above > -0.5 && above < 0.9 && this.vel.y - d.vel.y <= 0.5) {
          if (above < roofH) { roofH = above; carrier = d; }
        } else if (this.pos.y + HEIGHT > d.bottom && this.pos.y < d.top - 0.5 && hd > 1e-4) {
          const k = (d.r + RADIUS) / hd;
          this.pos.x = d.pos.x + dx * k;
          this.pos.z = d.pos.z + dz * k;
        }
      }
    }

    // Ground: first surface below step height (terrain, rocks, roofs, domes...)
    let h = this.physics.heightAbove(this.pos, U, STEP);
    // (what is underfoot, for the footsteps: the world's ground or something built on it, src/audio.js footSurface)
    this.footing = carrier && roofH < h ? 'built' : this.physics.groundKind ?? 'ground';
    if (carrier && roofH < h) h = roofH;
    // (or the ground is a moving collider, the great wheel's rim: it carries you as a moving solid does)
    else if (this.physics.groundMover && h < 0.8) carrier = moverCarrier(this.physics.groundMover, this.pos, this._moverRide ??= { vel: new THREE.Vector3() });
    if (this.pos.y < this.opts.killY) { this.respawn(); this._respawned = true; return null; }
    const vu = this.vel.dot(U);
    this._groundH = h;   // (the jump's pose looks ahead to the landing: src/jump.js)
    if (h <= 0 || (this.onGround && h < 0.8 && vu <= 0)) {
      // (fallGuard: the makers' soft-fall soles make a landing count as a slower one)
      // (fallGuard: the makers' soft-fall soles; on the jets they brake a landing too: JET.cushion)
      const guard = (this.fallGuard ?? 1) / (this.jetFlight ? JET.cushion : 1);
      if (!this.onGround && !this.ride && vu < -FALL.tumble * guard && !this.cushioned) this.landHard(-vu / guard);
      if (!this.onGround) { this._impact = -vu; this._jumped = false; }
      this.pos.addScaledVector(U, -h);
      this.vel.addScaledVector(U, -vu);
      this.onGround = true;
    } else {
      this.onGround = h <= 0.01;
    }
    return carrier;
  }

  /**
   * Landing at `speed` m/s, faster than FALL.tumble: a knockdown (after this
   * sub-step loop) and a hurt (fallDamage), which never takes the last quarter
   * heart unless the fall was fatal (FALL.lethal).
   */
  landHard(speed) {
    if (this.opts.health === false || this._landing) return;
    this._landing = { vel: this.vel.clone(), speed };
    this.lastLanding = speed;   // (the rumble's hard landing: src/rumble.js 'land')
    this.fallHurt(speed);
  }

  /** A landing's hurt at `speed` m/s (fallDamage, in hearts): never the last quarter unless it was fatal. */
  fallHurt(speed) {
    if (this.opts.health === false) return;
    const fatal = speed >= FALL.lethal;
    this.hurt(fatal ? Infinity : sparing(this.hearts, quarters(fallDamage(speed))), 'fall');
  }

  /**
   * Buried inside solid geometry (the capsule's middle is enclosed on every
   * side)? Move to the nearest spot where the capsule fits, or back to the
   * last place you stood safely. Returns true if it had to move you.
   */
  unstick() {
    const P = this.physics;
    if (!P.embedded) return false;
    const U = this.frame.up, half = HEIGHT * 0.5;
    const centre = _g5.copy(this.pos).addScaledVector(U, half);
    if (!P.embedded(centre)) return false;
    const free = P.escape?.(centre, RADIUS, U, half);
    if (free) this.pos.copy(free).addScaledVector(U, -half);
    else this.backToSafe();
    this.vel.set(0, 0, 0);
    this.onGround = false;
    this.climbing = false;
    return true;
  }

  /**
   * Hung in the air: off the ground, not held up by the jets or the wings, and
   * yet not falling, for HANG.time s (wedged between the faces of something,
   * which pushes the capsule back up every step). Nothing holds a body up like
   * that, so it goes back where you last stood safely. Returns true if it did.
   */
  unhang(dt) {
    if (this.onGround || this.jetFlight || this.gliding || this.climbing || this.mantle || this.ride || this.boarding) { this._hang = null; return false; }
    // (net movement from where it began: wedged bodies jitter in place, so the path length can grow)
    const H = this._hang ??= { t: 0, from: this.pos.clone() };
    H.t += dt;
    if (H.from.distanceTo(this.pos) > HANG.reach) { this._hang = null; return false; }
    if (H.t < HANG.time) return false;
    this.backToSafe();
    return true;
  }

  /** Back to the last place you stood safely, standing the way that place is up. */
  backToSafe() {
    this.pos.copy(this.lastSafe);
    this.endJets();
    this.vel.set(0, 0, 0);
    if (this.opts.gravityAt) this.frame.set(this.opts.gravityAt(this.pos));
    this._hang = null;
    this.onGround = false;
    this.climbing = false;
  }

  finishFrame(dt, hs) {
    // the wings bloom open over ~0.4 s and fold back faster on landing (fluid-kit.js draws them)
    {
      const open = this.gliding ? 1 : 0;
      const k = this.wingK + (open ? 1 / 0.42 : -1 / 0.3) * dt;
      this.wingK = Math.min(1, Math.max(0, k));
    }
    this._animAcc += dt;
    if (!this.stopMotion || this._animAcc >= 1 / 12) {
      if (this.mantle) this.animateMantle(this._animAcc);
      else if (this.climbing) this.animateClimb(this._animAcc);
      else this.animate(this._animAcc, hs);
      this._animAcc = 0;
    }
    this.object.position.copy(this.pos);
    // a stair or a kerb: the drawn body follows the floor's jump over a moment (src/locomotion.js StepLag)
    {
      const U = this.frame.up, walking = this.onGround && !this.ride && !this.climbing && !this.mantle && !this.swim && !this.boarding;
      this.object.position.addScaledVector(U, (this._stepLag ??= new StepLag()).update(dt, this.pos, U, walking, this._ridden));
    }
    this.frame.quaternion(this.heading, this.object.quaternion);
    // a scene's pose laid over the clip (kneeling at the stone, sitting in a window: src/story/home.js):
    // overlay(player, dt) poses the rig and may lower the body; the feet then stay where it put them
    const posed = !!this.overlay && !this.climbing && !this.mantle;
    if (posed) this.overlay(this, dt);
    const H = this.humanoid;
    if (H) {
      const armRotations = this.character?.poseArms(this);
      H.update();
      if (this.animator && !this.ride && !this.gliding && !this.onJets && !this.swim && !posed) {
        H.poseHands(this.animator);
        this.character?.poseWrists(armRotations);
      }
      const U = this.frame.up;
      if (this.mantle) { H.resetFeet(); H.reach(this.mantleTargets()); }
      else if (this.climbing) { H.resetFeet(); H.reach(this.animator ? this.climbContacts(dt) : this.climbTargets()); }
      else if (posed) H.resetFeet();
      else if (this.onGround && this.animator && !this.onJets) {
        // the gait says which feet are down and how far to shorten the stride (src/locomotion.js gaitFeet)
        const o = gaitFeet(this.animator, _g2.copy(this.vel).addScaledVector(U, -this.vel.dot(U)).length(), this._feetO ??= {});
        o.pivot = !!this.loco?.pivot;
        o.carry = this._ridden;   // (a moving floor takes the held feet along)
        // the feet find the moving floors too (src/carriers.js), not the floor under them
        this._feetGround ??= this.opts.dynamic ? standGround(this.physics, () => this.opts.dynamic(), () => this.ride) : this.physics;
        H.plantFeet(dt, this._feetGround, U, this.object.position, this.frame.dir(this.heading, _g1).clone(), (p, side, n) => this.stepped(p.clone(), 0, n), o);
      } else H.resetFeet();
      if (this.aim && !this.aim.noArm && !this.climbing && !this.mantle && !this.gliding) H.aimAt?.(this.aim.point, this.aim.k, U);   // (noArm: a captured blade swing moves the arm itself)
      // the soft aim: a swing's plane tilted toward its target's body, low or high (src/fluid-blade.js AIM)
      if (this.aim?.tilt && !this.climbing && !this.mantle && !this.gliding) H.swingTilt?.(this.aim.tilt, this.aim.dir, U);
      // the fluid sword drawn from (or put back on) his back: the right hand reaches back over the shoulder (src/sword-sheath.js)
      const SR = this.sheathReach;
      if (SR?.k > 0.01 && H.chestAnchor && !this.climbing && !this.mantle && !this.gliding && !this.swim && !this.ride) H.reachBack?.(H.chestAnchor.localToWorld(_g1.copy(SR.at)), SR.k, U, SR.grip);
      if (this.wingK > 0.03) this.spreadArms();
      // the hand-off: both hands on the tank while it swings between the back and the socket
      const hk = this.handoffGrip();
      if (hk > 0.01 && this.handoff?.handPoint) H.handOff?.(this.handoff.handPoint(_g1), hk, U);
      // the eyes glance about and blink, as everyone's do (eyes.js); talking, on the other's face (eyeTarget: src/story/index.js)
      H.updateEyes?.(dt, this.eyeTarget ?? null, { calm: !!this.talking });
    }
    // climbing on: over the last part of the hand-off, a hop from where you stand onto the seat
    if (this.boarding && this.boarding.k > 0.66 && this.boarding.v.seatTransform) {
      const e = THREE.MathUtils.smoothstep(this.boarding.k, 0.66, 1);
      this.boarding.v.seatTransform(_g2, _q1);
      this.object.position.lerp(_g2, e).addScaledVector(this.frame.up, Math.sin(Math.PI * e) * 0.35);
      this.object.quaternion.slerp(_q1, e);
    }
    if (this.gear && dt > 0) {
      const v = this.ride ? this.ride.vel : this.vel;
      const acc = _g4.subVectors(v, this._lastVel).divideScalar(dt);
      this._lastVel.copy(v);
      acc.applyQuaternion(_tq.copy(this.object.quaternion).invert());
      const moving = this.ride ? 0.3 : Math.min(Math.hypot(this.vel.x, this.vel.z) / 6, 1);
      this.gear.update(dt, acc.clampLength(0, 40), this.phase ?? 0, this.onGround ? moving : 0.4);
    }
    this.updateCloth(dt);
  }

  /**
   * Aiming the tool (this.aim = { k, point, dir } from the fluid tool): the body
   * turns to the aim; walking sideways the legs lead by up to ~50° and the
   * chest twists back (Humanoid.aimAt).
   */
  faceAim(dt, tvel, hs) {
    const F = this.frame;
    let target = F.headingOf(this.aim.dir);
    if (hs > 0.5 && this.aim.lead !== false) {   // (lead: false, the blade's riposte turned into its chop)
      let lead = F.headingOf(tvel) - target;
      lead = Math.atan2(Math.sin(lead), Math.cos(lead));
      if (Math.abs(lead) > Math.PI / 2) lead = Math.atan2(Math.sin(lead + Math.PI), Math.cos(lead + Math.PI));   // backing off: face the aim
      target += THREE.MathUtils.clamp(lead, -0.9, 0.9) * Math.min(1, hs / 2);
    }
    const d = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
    this.heading += d * (1 - Math.exp(-14 * this.aim.k * dt));
  }

  /** Gliding on the fluid wings: the arms open out and a little back under them, the lower one leading the turn. */
  spreadArms() {
    const H = this.humanoid, B = H.b, U = this.frame.up, k = THREE.MathUtils.smoothstep(this.wingK, 0, 1);
    if (!B.upperarm_r || !B.hand_r) return;
    const fwd = this.frame.dir(this.heading, _g1), back = _g2.copy(fwd).negate();
    const right = _g3.crossVectors(fwd, U).normalize();
    const turn = this.glideTurn ?? 0;
    const hands = ['r', 'l'].map((s, i) => {
      const side = i === 0 ? 1 : -1;
      const sh = B[`upperarm_${s}`].getWorldPosition(new THREE.Vector3());
      const rest = B[`hand_${s}`].getWorldPosition(new THREE.Vector3());
      // turning toward a side dips that hand and lifts the other
      const target = sh.clone().addScaledVector(right, side * 0.5).addScaledVector(U, -0.12 - side * turn * 0.12).addScaledVector(back, 0.12);
      return rest.lerp(target, k);
    });
    H.reach({ hands, wallN: back, up: U });
    // the hands as the wings' tips: fingers on along the forearm, palms down, the leading edge
    // (the thumb's) a little up; set each frame, never left to the IK (which once made them spin)
    const palm = _g4.copy(U).negate().addScaledVector(fwd, 0.25).normalize();
    for (const s of ['r', 'l']) {
      const along = B[`hand_${s}`].getWorldPosition(_g5).sub(B[`lowerarm_${s}`].getWorldPosition(_g6)).normalize();
      H.turnHand?.(s, along, palm, k);
    }
  }

  /** How much the hands hold the tank during a hand-off, 0..1 (on as it lifts off, off as it's seated / worn). */
  handoffGrip() {
    const sm = THREE.MathUtils.smoothstep;
    if (this.boarding) { const k = this.boarding.k; return sm(k, 0, HANDOFF.lift + 0.06) * (1 - sm(k, HANDOFF.seat - 0.05, HANDOFF.seat + 0.1)); }
    if (this.unboarding) { const k = this.unboarding.k; return sm(k, HANDOFF.grab - 0.08, HANDOFF.grab + 0.1) * (1 - sm(k, HANDOFF.worn - 0.05, HANDOFF.worn + 0.15)); }
    return 0;
  }

  /** The clip's hands and feet, pressed onto the wall where they are: raycast each into the wall. */
  climbContacts(dt = 1 / 60) {
    const B = this.humanoid.b, U = this.frame.up, n = this.wallN;
    const into = n.clone().negate(), right = new THREE.Vector3().crossVectors(into, U).normalize();
    const travel = U.clone().multiplyScalar(this._climbF ?? 0).addScaledVector(right, (this._climbS ?? 0) * 0.8);
    const moving = travel.lengthSq() > 0.001; travel.normalize();
    const holds = this._wallHolds ??= {};
    const press = (bone, out) => {
      const p = B[bone].getWorldPosition(new THREE.Vector3());
      const local = p.clone().sub(this.pos);
      const hit = this.physics.rayHit(p.clone().addScaledVector(n, 0.5), into, 1.4);
      const raw = hit ? hit.point.clone().addScaledVector(n, out) : p;
      const h = holds[bone] ??= { previous: local.clone(), point: raw.clone(), locked: false, weight: 0, released: false };
      const speed = local.clone().sub(h.previous).dot(travel) / Math.max(dt, 0.001);
      h.previous.copy(local);
      // A support stroke moves back relative to the body: keep that hold in world space.
      if (moving && speed > 0.04) { h.locked = false; h.released = false; }
      else if (hit && !h.locked && !h.released && (!moving || speed < -0.08)) { h.point.copy(raw); h.locked = true; }
      if (!hit) h.locked = false;
      if (hit && moving && speed > .04) raw.addScaledVector(n, Math.min(.07, speed * .035));
      if (h.locked && h.point.distanceTo(raw) > 0.32) { h.locked = false; h.released = true; }
      h.weight += ((h.locked ? 1 : 0) - h.weight) * (1 - Math.exp(-24 * dt));
      return raw.lerp(h.point, h.weight);
    };
    return { hands: [press('hand_r', 0.04), press('hand_l', 0.04)], feet: [press('foot_r', 0.13), press('foot_l', 0.13)], wallN: n, up: U, wallContact: true };
  }

  /** Hand and foot holds on the wall for the current point of the climb cycle. */
  climbTargets() {
    const B = this.humanoid.b, U = this.frame.up, n = this.wallN, into = _g6.copy(n).negate();
    const cyc = ((this.phase / (Math.PI * 2)) % 1 + 1) % 1;
    const tri = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
    const t = tri * tri * (3 - 2 * tri);
    const hold = (base, out) => {
      const hit = this.physics.rayHit(_g5.copy(base).addScaledVector(n, 0.6), into, 1.6);
      return hit ? hit.point.addScaledVector(n, out) : base.clone().addScaledVector(into, 0.3);
    };
    const hands = [], feet = [];
    ['r', 'l'].forEach((s, i) => {
      const k = i === 0 ? t : 1 - t;                    // one hand reaches while the other pulls
      const sh = B[`upperarm_${s}`].getWorldPosition(new THREE.Vector3());
      hands.push(hold(sh.addScaledVector(U, 0.12 + 0.48 * k), 0.05));
      const hip = B[`thigh_${s}`].getWorldPosition(new THREE.Vector3());
      feet.push(hold(hip.addScaledVector(U, -0.78 + 0.38 * (1 - k)), 0.1));   // the opposite foot steps up
    });
    return { hands, feet, wallN: n, up: U, wallContact: true };
  }

  // ------------------------------------------------------------------ mantling
  /** Near the top of a wall (or where it turns into a slope): look for a surface to pull up onto. */
  tryMantle(U, into) {
    for (const d of [0.55, 0.9, 1.3]) {
      const probe = _g5.copy(this.pos).addScaledVector(U, 2.7).addScaledVector(into, d);
      const hit = this.physics.rayHit(probe, _g6.copy(U).negate(), 3.4);
      if (!hit || hit.normal.dot(U) < 0.45) continue;
      const rise = _g4.subVectors(hit.point, this.pos).dot(U);
      if (rise < -0.3 || rise > 2.8) continue;
      // (and room to stand there: not a floor met from inside something, an olive's crown, or under a ceiling)
      if (this.physics.rayDistance(_g5.copy(hit.point).addScaledVector(U, 0.05), U, 1.7) < 1.6) continue;
      if (hit.front === false || this.physics.rayHit(_g5.copy(hit.point).addScaledVector(U, 0.05), U, 4)?.front === false) continue;   // (inside a closed solid: met from within, or the way up leaves through its back)
      this.climbing = false;
      this.mantle = { from: this.pos.clone(), to: hit.point.clone(), edge: this.pos.clone().addScaledVector(U, Math.max(rise, 0)).addScaledVector(into, 0.32), rise, t: 0, n: this.wallN.clone() };
      this.vel.set(0, 0, 0);
      return true;
    }
    return false;
  }

  updateMantle(dt) {
    const M = this.mantle, U = this.frame.up;
    M.t = Math.min(M.t + dt / (0.75 + Math.max(0, M.rise) * .12), 1);
    const ease = (x) => x * x * x * (x * (x * 6 - 15) + 10);
    // up first (hauling the body over the edge), then forward onto the top
    const up = ease(Math.min(M.t / 0.6, 1)), fwd = ease(Math.max((M.t - 0.35) / 0.65, 0));
    const lift = M.rise + 0.25 * Math.sin(Math.PI * Math.min(M.t / 0.85, 1));
    this.pos.copy(M.from).addScaledVector(U, lift * up);
    const horiz = _g4.subVectors(M.to, M.from).addScaledVector(U, -_g4.subVectors(M.to, M.from).dot(U));
    this.pos.addScaledVector(horiz, fwd);
    this.phase += dt * 4;
    if (M.t >= 1) {
      this.pos.copy(M.to);
      this.mantle = null;
      this.onGround = true;
      this.vel.set(0, 0, 0);
    }
  }

  mantleTargets() {
    const M = this.mantle, U = this.frame.up;
    const side = _g5.crossVectors(U, M.n).normalize();
    const hands = [M.edge.clone().addScaledVector(side, 0.22), M.edge.clone().addScaledVector(side, -0.22)];
    // Release each grip into the clip before standing, avoiding a last-frame arm snap.
    if (this.humanoid) hands.forEach((target, i) => {
      const t = THREE.MathUtils.smoothstep(M.t, i ? .66 : .54, i ? .94 : .84);
      target.lerp(this.humanoid.b[`hand_${i ? 'l' : 'r'}`].getWorldPosition(new THREE.Vector3()), t);
    });
    // feet scrabble up the wall in the first half, then step onto the top
    const k = Math.min(M.t / 0.6, 1);
    const feet = M.t < 0.6 ? [0, 1].map((i) => M.from.clone().addScaledVector(U, M.rise * k * (i ? 0.7 : 0.4)).addScaledVector(M.n, -0.35)) : null;
    return { hands, feet, wallN: M.n, up: U };
  }

  animateMantle(dt = 1 / 60) {
    const c = this.char, k = this.mantle.t;
    if (this.animator) {
      // the ledge-climb clip times the limbs; our mantle moves the body, the hands hold the edge
      this.animator.update(dt, { speed: 0, onGround: true, mode: 'ledge', ledgeT: k, walkAt: 1, jogAt: 2, sprintAt: 3, strideScale: 1 });
      this.object.position.copy(this.pos);
      this.frame.quaternion(this.heading, this.object.quaternion);
      this.animator.apply(this.object, {});
      c.body.position.set(0, 0, 0);
      return;
    }
    c.body.position.set(0, 0, 0);
    c.body.rotation.set(0.35 * Math.sin(Math.PI * k), 0, 0);
    c.torso.rotation.set(0.2, 0, 0);
    c.head.rotation.set(-0.2 + k * 0.3, 0, 0);
    c.arms[0].rotation.set(-1.4 + k * 1.1, 0, -0.15); c.arms[1].rotation.set(-1.4 + k * 1.1, 0, 0.15);
    c.elbows[0].rotation.set(-0.8, 0, 0); c.elbows[1].rotation.set(-0.8, 0, 0);
    c.legs[0].rotation.set(-1.3 * Math.sin(Math.PI * k), 0, 0); c.legs[1].rotation.set(-0.4, 0, 0);
    c.knees[0].rotation.set(1.6 * Math.sin(Math.PI * k), 0, 0); c.knees[1].rotation.set(0.6, 0, 0);
  }

  // ------------------------------------------------------------------ climbing
  // Sable-style: push into a steep wall to grab it; W/S climb, A/D shuffle,
  // Space jumps off, reaching the top mantles over it. Uses stamina.
  /**
   * The ground at a wall's face (x, z just off it) when it stands over the climber's feet by no more than a
   * step (sand banked up the wall: src/sand-drifts.js), else null: where his feet may not go below.
   */
  climbFloor(x, z) {
    if (this.frame.up.y < 0.999) return null;
    const g = this.physics.groundAt(x, this.pos.y + 1.0, z, 2.5);
    return Number.isFinite(g) && g > this.pos.y && g - this.pos.y < 0.7 ? g : null;   // (a step at most: not a sill passed on the way)
  }

  startClimb(n) {
    // (a wall that is not to be climbed: the ink pen's, src/gadgets/bridge.js; he slides along it instead)
    if (this.physics.noClimbNear?.(_v1.copy(this.pos).addScaledVector(this.frame.up, 1.2), RADIUS + 0.35)) { this._climbCooldown = Math.max(this._climbCooldown ?? 0, 0.3); return false; }
    // (where sand is banked up the wall, he takes hold standing on the bank at its face)
    const face = this.climbFloor(this.pos.x - n.x * (RADIUS - 0.06), this.pos.z - n.z * (RADIUS - 0.06));
    if (face !== null) this.pos.y = face;
    this.climbing = true;
    this.wallN.copy(n);
    this.vel.set(0, 0, 0);
    this.endJets(); this.gliding = false;
    this.heading = this.frame.headingOf(_v1.copy(n).negate());
    this._climbTime = 0;
    this._wallHolds = null;
    this._climbF = this._climbS = 0;
  }

  updateClimb(dt, f, s, input) {
    const U = this.frame.up, n = this.wallN;
    const into = _v1.copy(n).negate();
    const chest = _v2.copy(this.pos).addScaledVector(U, 1.2);
    const hit = this.physics.rayHit(chest, into, 1.6);
    // the wall ended (a ledge) or leans back into a slope: pull up onto it
    if (!hit) { if (f >= 0 && this.tryMantle(U, into)) return; this.stopClimb(false); return; }
    n.copy(hit.normal);
    if (n.dot(U) > 0.55) { if (!this.tryMantle(U, into)) this.stopClimb(true); return; }
    if (n.dot(U) < -0.6) { this.stopClimb(false); return; }                // an overhang
    // stick to the wall
    // hug the wall: the mocap clips hold the hips ~0.25 m off it
    this.pos.copy(hit.point).addScaledVector(n, this.animator ? 0.27 : RADIUS + 0.08).addScaledVector(U, -1.2);
    // (a wall that moves, the great wheel's turning rim: the hands go with it)
    if (hit.mover) this.pos.addScaledVector(moverCarrier(hit.mover, hit.point, this._moverRide ??= { vel: new THREE.Vector3() }).vel, dt);
    // where sand is banked up the wall's foot (src/sand-drifts.js), the climb starts on the bank: the ground
    // right at the face is higher than where the climber hangs, 0.27 m out, and his hands and knees went
    // into the drawn sand. Never below the ground at the face; climbing down onto it, he stands.
    const face = this.climbFloor(hit.point.x + n.x * 0.06, hit.point.z + n.z * 0.06);
    if (face !== null) {
      this.pos.y = face;
      if (f < 0) { this.stopClimb(true); return; }
    }

    // a ceiling over the head (an olive's crown over its trunk, a beam): no higher
    if (f > 0 && this.physics.rayDistance(_v2.copy(this.pos).addScaledVector(U, 1.2), U, 0.8) < 0.7) f = 0;

    // reached the top: nothing in front at head height -> mantle over
    const head = _v2.copy(this.pos).addScaledVector(U, 2.3);
    if (f > 0 && !this.physics.rayHit(head, into, 1.6) && this.tryMantle(U, into)) return;

    const right = _v3.crossVectors(into, U).normalize();   // screen-right while facing the wall
    const fast = (input.ShiftLeft || input.ShiftRight) && canSprint(this);
    const sp = (fast ? 2.1 : 1.4) * (this.climbSpeedK ?? 1);   // (the star-thread: a third faster)
    this._climbRate = sp / 1.4;
    this.pos.addScaledVector(U, f * sp * dt).addScaledVector(right, s * sp * 0.8 * dt);
    this.heading = this.frame.headingOf(into);
    this.phase += dt * (f || s ? 7 : 0);
    this._climbF = f; this._climbS = s;

    // ~22 s of climbing (climbK: the makers' resin halves it), less climbing fast: the sprint's stamina (src/stamina.js)
    spendStamina(this, (f || s ? 0.045 * (fast ? STAMINA.climbFast : 1) : 0.02) * dt * (this.climbK ?? 1));
    if (input.Space && !this._jumpHeld) {                       // jump off the wall
      this.stopClimb(false);
      this.vel.copy(n).multiplyScalar(6).addScaledVector(U, 8);
      this._climbCooldown = 0.5;
      this._wallKick = true;   // (the captured kick off the wall: src/air-moves.js)
    }
    this._jumpHeld = !!input.Space;
    if (this.stamina <= 0) { this.stamina = 0; this.winded = true; this.stopClimb(false); this._climbCooldown = 1; }
    // climbing down onto the ground, or coming out on top of something
    // (e.g. through a tree canopy): stand on it
    this._climbTime += dt;
    const h = this.physics.heightAbove(this.pos, U, STEP);
    if (f < 0 && h < 0.05) this.stopClimb(true);
    else if (f > 0 && this._climbTime > 0.6 && h > -0.05 && h < 0.2) this.stopClimb(true);
  }

  stopClimb(onTop) {
    this.climbing = false;
    this.vel.set(0, 0, 0);
    this.onGround = false;
    if (!onTop) this._climbCooldown = Math.max(this._climbCooldown, 0.3);
  }

  /**
   * Keyframed climbing: two key poses (left hand reaching / right hand
   * reaching), eased between as you move, so one arm stretches up while the
   * other pulls and the opposite knee steps high; hips sway toward the pulling
   * side, and the head looks up the wall.
   */
  animateClimb(dt = 1 / 60) {
    const c = this.char;
    this._gait = null;
    if (this.animator) {
      // mocap climbing (Quaternius UAL): up / down / left / right loops and a hanging idle;
      // the hands and feet are then pressed onto the real wall (climbContacts)
      this.animator.update(dt, { speed: 0, onGround: true, mode: 'climb', climbRate: this._climbRate ?? 1, climbF: this._climbF ?? 0, climbS: this._climbS ?? 0, walkAt: 1, jogAt: 2, sprintAt: 3, strideScale: 1 });
      this.object.position.copy(this.pos);
      this.frame.quaternion(this.heading, this.object.quaternion);
      this.animator.apply(this.object, {});
      for (const fl of c.flames) fl.visible = false;
      return;
    }
    const K = CLIMB_KEYS;
    const cyc = ((this.phase / (Math.PI * 2)) % 1 + 1) % 1;
    const tri = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;              // 0 -> 1 -> 0
    const t = tri * tri * (3 - 2 * tri);                        // ease
    const L = (a, b) => a + (b - a) * t;
    const P = {};
    for (const k in K.A) P[k] = L(K.A[k], K.B[k]);
    c.arms[0].rotation.set(P.armR, 0, P.armRz);  c.elbows[0].rotation.set(P.elbR, 0, 0);
    c.arms[1].rotation.set(P.armL, 0, P.armLz);  c.elbows[1].rotation.set(P.elbL, 0, 0);
    c.legs[0].rotation.set(P.legR, 0, -0.08);    c.knees[0].rotation.set(P.kneeR, 0, 0);
    c.legs[1].rotation.set(P.legL, 0, 0.08);     c.knees[1].rotation.set(P.kneeL, 0, 0);
    c.feet[0].rotation.set(P.footR, 0, 0);       c.feet[1].rotation.set(P.footL, 0, 0);
    c.body.position.set(P.sway * 0.06, P.lift * 0.05, 0);
    c.body.rotation.set(-0.08, 0, P.sway * 0.07);
    c.torso.rotation.set(0, P.sway * 0.12, 0);
    c.head.rotation.set(-0.45, -P.sway * 0.2, 0);
    for (const fl of c.flames) fl.visible = false;
  }

  animateRiding() {
    const c = this.char;
    this._gait = null;
    for (const f of c.feet) f.rotation.set(0, 0, 0);
    const flow = Math.min(Math.abs(this.ride.speed) / 30, 1.3);
    if (this.ride.kind === 'taxi') return this.animateSeated(flow);
    c.legs[0].rotation.set(-1.35, 0, 0.12);
    c.legs[1].rotation.set(-1.35, 0, -0.12);
    c.knees[0].rotation.x = c.knees[1].rotation.x = 1.45;
    c.body.position.set(0, 0, 0);
    c.body.rotation.set(0.12 + flow * 0.12, 0, 0);
    c.torso.rotation.set(0.12, 0, 0);
    c.arms[0].rotation.set(-1.0, 0, -0.2);
    c.arms[1].rotation.set(-1.0, 0, 0.2);
    c.elbows[0].rotation.x = c.elbows[1].rotation.x = -0.6;
    c.head.rotation.set(-0.15, 0, 0);
    c.hatTip.rotation.x = -0.55 - flow * 0.5 + Math.sin(this.time * 20) * 0.06 * flow;  // flaps in the wind
    for (const fl of c.flames) fl.visible = false;
  }

  /**
   * Seated in a cab (it drives itself): upright against the seat's back, thighs level on the
   * cushion, shins down to the footrest, hands resting on the thighs; he looks about as it flies
   * and sways a little into its turns.
   */
  animateSeated(flow) {
    const c = this.char, t = this.time, bank = this.ride.bank ?? 0;
    c.legs[0].rotation.set(-1.52, 0, 0.07);
    c.legs[1].rotation.set(-1.52, 0, -0.07);
    c.knees[0].rotation.x = c.knees[1].rotation.x = 1.5;
    for (const f of c.feet) f.rotation.set(0.05, 0, 0);
    c.body.position.set(0, 0, 0);
    c.body.rotation.set(-0.04, 0, 0);
    c.torso.rotation.set(0.02 + Math.sin(t * 1.1) * 0.01, 0, -bank * 0.35);
    c.arms[0].rotation.set(-0.5, 0, -0.16);
    c.arms[1].rotation.set(-0.5, 0, 0.16);
    c.elbows[0].rotation.x = c.elbows[1].rotation.x = -0.72;
    c.head.rotation.set(-0.06 - flow * 0.04, Math.sin(t * 0.27) * 0.32 * Math.sin(t * 0.09 + 1), bank * 0.2);
    c.hatTip.rotation.x = -0.3 - flow * 0.35 + Math.sin(t * 16) * 0.04 * flow;  // the wind under the canopy
    for (const fl of c.flames) fl.visible = false;
  }

  /**
   * Locomotion with planted feet.
   * Each foot alternates stance (planted where it landed, on the real ground:
   * slopes, steps, rocks) and swing (an arc to where it will land next,
   * predicted from the velocity). A two-bone IK solves hip and knee for each
   * foot target; the pelvis drops when a foot has to reach down. Walking
   * keeps a foot down most of the time and bobs up at mid-stance; running has
   * a flight phase, compresses at contact, leans in and pumps the arms.
   * Standing still, feet stay put and take small corrective steps when you
   * turn. Airborne / glide / jetpack keep authored poses.
   */
  animate(dt, hs) {
    if (this.swim) return swimPose(this, dt);
    if (this.animator && !this.onJets && !this.gliding) return this.animateClips(dt, hs);
    const c = this.char;
    const L = THREE.MathUtils.lerp, sm = THREE.MathUtils.smoothstep;
    const moving = sm(hs, 0.3, 2.5);
    const run = sm(hs, WALK * 0.8, RUN * 0.9);
    let dh = this.heading - (this._lastHeading ?? this.heading);
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this._lastHeading = this.heading;
    this._turn = L(this._turn ?? 0, dt > 0 ? dh / dt : 0, 1 - Math.exp(-8 * dt));
    if (this.onGround && this._wasAir) { this._land = Math.min(1, (this._airTime ?? 0) * 1.5); this._gait = null; }
    this._wasAir = !this.onGround;
    this._airTime = this.onGround ? 0 : (this._airTime ?? 0) + dt;
    this._land = Math.max(0, (this._land ?? 0) - dt * 4);
    for (const f of c.flames) {
      f.visible = this.thrusting;
      f.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    }
    const t = this.time;
    const bank = THREE.MathUtils.clamp(-this._turn * 0.06 * moving, -0.3, 0.3);
    for (const f of c.feet) f.rotation.set(0, 0, 0);

    if (!this.onGround || this.onJets || this.gliding) {
      this._gait = null;
      c.body.position.set(0, 0, 0);
      c.torso.rotation.set(0, 0, 0);
      if (this.onJets) {
        c.legs[0].rotation.set(0.2, 0, 0); c.legs[1].rotation.set(-0.15, 0, 0);
        c.knees[0].rotation.x = 0.5; c.knees[1].rotation.x = 0.3;
        c.arms[0].rotation.set(0.25, 0, -0.5); c.arms[1].rotation.set(0.25, 0, 0.5);
        c.elbows[0].rotation.x = c.elbows[1].rotation.x = -0.3;
        // lean along the nose like a plane, the faster the more (slow, or nose up lifting off, you
        // stand like a rocket; flat out flying level, head first into a dive), turned about the hips;
        // arms reach ahead, legs trail together; the bank rolls you about the spine into the turn
        const J = this.jetFlight;
        const P = jetPose(J.along, J.pitch);
        c.body.rotation.set(P.lean, J.bank * Math.sin(P.lean), J.bank * Math.cos(P.lean));
        c.body.position.set(0, JET_PIVOT * (1 - Math.cos(P.lean)), -JET_PIVOT * Math.sin(P.lean));
        const k = P.reach, flut = Math.sin(t * 9) * 0.05 * k;
        c.head.rotation.set(L(-0.25, -0.3 - Math.min(P.lean, 1.5) * 0.4, k), 0, 0);
        c.legs[0].rotation.set(L(0.2, -0.04 + flut, k), 0, 0); c.legs[1].rotation.set(L(-0.1, 0.06 - flut, k), 0, 0);
        c.knees[0].rotation.x = L(0.5, 0.12, k); c.knees[1].rotation.x = L(0.3, 0.2, k);
        c.arms[0].rotation.set(L(0.25, -2.85, k), 0, L(-0.35, -0.16, k)); c.arms[1].rotation.set(L(0.25, -2.85, k), 0, L(0.35, 0.16, k));
        c.elbows[0].rotation.x = c.elbows[1].rotation.x = L(-0.3, -0.06, k);
        c.hatTip.rotation.x = -0.5 + Math.sin(t * 25) * 0.08;
      } else if (this.gliding) {
        c.legs[0].rotation.set(0.3, 0, 0); c.legs[1].rotation.set(0.1, 0, 0);
        c.knees[0].rotation.x = 0.4; c.knees[1].rotation.x = 0.2;
        c.arms[0].rotation.set(0, 0, -1.45); c.arms[1].rotation.set(0, 0, 1.45);
        c.elbows[0].rotation.x = c.elbows[1].rotation.x = 0;
        c.body.rotation.set(0.35, 0, bank * 2);
        c.head.rotation.set(-0.3, 0, 0);
        c.hatTip.rotation.x = -0.6 + Math.sin(t * 14) * 0.08;
      } else {
        // airborne: one leg tucked, one reaching, arms out for balance
        const up = this.vel.dot(this.frame.up) > 0;
        c.legs[0].rotation.set(up ? -0.7 : -0.35, 0, 0); c.legs[1].rotation.set(up ? 0.3 : 0.1, 0, 0);
        c.knees[0].rotation.x = up ? 1.2 : 0.7; c.knees[1].rotation.x = up ? 0.5 : 0.25;
        c.arms[0].rotation.set(-0.5, 0, -0.6); c.arms[1].rotation.set(0.3, 0, 0.6);
        c.elbows[0].rotation.x = -0.9; c.elbows[1].rotation.x = -0.4;
        c.body.rotation.set(0.1, 0, bank);
        c.head.rotation.set(-0.1, 0, 0);
        c.hatTip.rotation.x = up ? 0.2 : -0.1;
      }
      return;
    }

    // ---------------------------------------------------------- gait
    const U = this.frame.up;
    const fwd = this.frame.dir(this.heading, _g1);
    const right = _g2.crossVectors(U, fwd).normalize().negate();   // character's right (-x local)
    const G = (this._gait ??= this.initGait(fwd, right));
    const duty = L(0.62, 0.3, run);                                 // fraction of the cycle a foot is down
    const cycle = L(1.6, 2.7, run);                                  // metres per gait cycle (two steps)
    const liftH = L(0.1, 0.32, run);
    if (moving > 0.05) G.phase = (G.phase + (hs / cycle) * dt) % 1;
    const hipW = 0.085;

    for (let i = 0; i < 2; i++) {
      const F = G.feet[i];
      const side = i === 0 ? -1 : 1;                                   // legs[0] is on the -x side
      // where this foot will land: the body travels (1 - p) * cycle before
      // touchdown, and the foot lands half a stance ahead of the hips
      const p = (G.phase + i * 0.5) % 1;
      const ahead = moving > 0.05 ? (p >= duty ? (1 - p) * cycle : 0) + duty * cycle * 0.45 : 0;
      // the moving velocity direction, not the facing (so strafing / turning plants correctly)
      const dir = hs > 0.5 ? _g6.copy(this.vel).addScaledVector(U, -this.vel.dot(U)).normalize() : fwd;
      _g3.copy(this.pos).addScaledVector(dir, ahead).addScaledVector(right, -side * hipW * L(1.3, 0.8, run));
      this.groundPoint(_g3, U);
      if (moving > 0.05) {
        const swing = p >= duty;
        if (swing && !F.swinging) { F.swinging = true; F.from.copy(F.plant); }
        if (!swing && F.swinging) {                                    // touch down
          F.swinging = false;
          F.plant.copy(_g3);
          this.stepped(F.plant, i);
        }
        if (swing) {
          const s = sm((p - duty) / (1 - duty), 0, 1);
          F.target.lerpVectors(F.from, _g3, s).addScaledVector(U, Math.sin(Math.PI * s) * liftH);
          F.toe = -Math.sin(Math.PI * s) * 0.5;
        } else {
          F.target.copy(F.plant);
          F.toe = 0;
        }
        F.step = null;
      } else {
        // standing: stay planted; a quick corrective step if a foot is left behind
        if (!F.step && !G.feet[1 - i].step && F.plant.distanceTo(_g3) > 0.32) {
          F.step = { from: F.plant.clone(), to: _g3.clone(), k: 0 };
        }
        if (F.step) {
          F.step.k += dt / 0.22;
          const s = sm(Math.min(F.step.k, 1), 0, 1);
          F.target.lerpVectors(F.step.from, F.step.to, s).addScaledVector(U, Math.sin(Math.PI * s) * 0.09);
          if (F.step.k >= 1) { F.plant.copy(F.step.to); this.stepped(F.plant, i); F.step = null; }
        } else F.target.copy(F.plant);
        F.toe = 0;
        F.swinging = false;
      }
    }

    // body: bob, lean, bank, landing squash; pelvis drops to reach the lower foot
    const ph = G.phase * Math.PI * 2;
    const walkBob = 0.5 + 0.5 * Math.cos(2 * ph);
    const bob = L(walkBob, 1 - walkBob, run) * L(0.03, 0.08, run) * moving;
    const lean = L(0.03, 0.3, run) * moving;
    const breathe = Math.sin(t * 2.1) * 0.012 * (1 - moving);
    const squash = this._land;
    // place the root now so IK can work in body space
    this.object.position.copy(this.pos);
    this.frame.quaternion(this.heading, this.object.quaternion);
    c.body.rotation.set(lean + squash * 0.15, 0, bank);
    c.body.position.set(0, 0, 0);   // (x, z too: the jets' lean turns the body about the hips)
    this.object.updateMatrixWorld(true);
    let reachDrop = 0;
    for (let i = 0; i < 2; i++) {
      c.body.worldToLocal(_g4.copy(G.feet[i].target));
      const d = _g4.sub(c.legs[i].position).length();
      reachDrop = Math.max(reachDrop, d - (LEG_A + LEG_B) * 0.985);
    }
    G.drop = L(G.drop ?? 0, Math.min(Math.max(reachDrop, 0), 0.24), 1 - Math.exp(-14 * dt));
    c.body.position.y = bob - G.drop - squash * 0.14 + breathe * 0.3;
    c.body.updateMatrixWorld(true);

    // two-bone IK per leg
    for (let i = 0; i < 2; i++) {
      const F = G.feet[i];
      c.body.worldToLocal(_g4.copy(F.target));
      _g4.sub(c.legs[i].position);
      const dist = THREE.MathUtils.clamp(_g4.length(), 0.25, (LEG_A + LEG_B) * 0.999);
      const roll = THREE.MathUtils.clamp(Math.atan2(_g4.x, -_g4.y), -0.35, 0.35);
      const pitchToFoot = Math.atan2(-_g4.z, -_g4.y);                 // + = foot behind the hip
      const alpha = Math.acos(THREE.MathUtils.clamp((LEG_A * LEG_A + dist * dist - LEG_B * LEG_B) / (2 * LEG_A * dist), -1, 1));
      const bend = Math.PI - Math.acos(THREE.MathUtils.clamp((LEG_A * LEG_A + LEG_B * LEG_B - dist * dist) / (2 * LEG_A * LEG_B), -1, 1));
      c.legs[i].rotation.set(pitchToFoot - alpha, 0, roll);
      c.knees[i].rotation.x = bend;
      // keep the boot flat on the ground (toe dips during the swing)
      c.feet[i].rotation.x = -(pitchToFoot - alpha + bend) - (lean + squash * 0.15) + F.toe;
      F.localZ = _g4.z;
    }

    // upper body: twist against the hips, arms swing with the opposite foot
    const swingDiff = (G.feet[0].localZ - G.feet[1].localZ);
    c.torso.rotation.set(0, -swingDiff * 0.35, -Math.sin(ph) * 0.03 * run);
    c.torso.scale.y = 1 + breathe;
    const armK = L(1.4, 2.0, run) * moving;
    c.arms[0].rotation.set(THREE.MathUtils.clamp(G.feet[0].localZ * armK, -1.2, 1.2), 0, -0.06 - run * 0.1);
    c.arms[1].rotation.set(THREE.MathUtils.clamp(G.feet[1].localZ * armK, -1.2, 1.2), 0, 0.06 + run * 0.1);
    const elb = 0.15 + L(0.15, 1.45, run) * moving;
    c.elbows[0].rotation.x = -(elb + Math.max(0, -G.feet[0].localZ) * 0.5 * run);
    c.elbows[1].rotation.x = -(elb + Math.max(0, -G.feet[1].localZ) * 0.5 * run);
    const look = (1 - moving) * (Math.sin(t * 0.37) * 0.5 + Math.sin(t * 0.13) * 0.3);
    c.head.rotation.set(-lean * 0.7 + (1 - moving) * Math.sin(t * 0.21) * 0.08, look + swingDiff * 0.15, 0);
    c.hatTip.rotation.x = -hs * 0.02 + Math.cos(2 * ph) * 0.12 * moving + squash * 0.4;
    c.hatTip.rotation.z = Math.sin(ph) * 0.1 * moving;
  }

  /**
   * The stick, for the motion matcher (src/motion-match.js): the velocity now and the one steered
   * to, in the body's frame (x left, z ahead), and the spring's rate between them (update()).
   * Aiming, the body keeps facing the target as it walks (sidesteps, steps back).
   */
  matchInput() {
    const U = this.frame.up, fwd = this.frame.dir(this.heading, _mf), left = _ml.crossVectors(U, fwd);
    const o = (this._mmIn ??= { vel: { x: 0, z: 0 }, want: { x: 0, z: 0 }, k: 8, face: null });
    o.vel.x = this.vel.dot(left); o.vel.z = this.vel.dot(fwd);
    const m = this._moveDir, sp = this._wantSpeed ?? 0;
    o.want.x = m ? m.dot(left) * sp : 0; o.want.z = m ? m.dot(fwd) * sp : 0;
    o.k = this._accel ?? 8;
    o.face = this.aim ? 0 : null;
    return o;
  }

  /** Motion-captured clips (Quaternius, CC0) retargeted onto the rig. */
  animateClips(dt, hs) {
    const c = this.char, A = this.animator;
    this._gait = null;
    for (const f of c.flames) f.visible = false;
    let dh = this.heading - (this._lastHeading ?? this.heading);
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this._lastHeading = this.heading;
    this._turn = THREE.MathUtils.lerp(this._turn ?? 0, dt > 0 ? dh / dt : 0, 1 - Math.exp(-8 * dt));
    const N = A.lib.native;
    // the jump by its phase (src/jump.js): take-off, the top, the fall, reaching for the ground, the squash
    const U0 = this.frame.up, vy = this.vel.dot(U0);
    const J = (this._jumpLayer ??= new JumpLayer()).update(dt, {
      onGround: this.onGround, vy, airT: this._clipAirT = this.onGround ? 0 : (this._clipAirT ?? 0) + dt,
      h: this._groundH ?? Infinity, jumped: !!this._jumped, impact: this._impact ?? 0, speed: hs,
    });
    // a get-up (Player.updateDown), and its last moment easing out once you have control again
    const R = this._riseMove ?? this._riseOut;
    if (R) A.play(R.name, R.t, R.w, { full: true, head: true });
    if (this._riseOut && !this._riseMove) {
      const O = this._riseOut;
      O.w -= dt / GET_UP.out;   // (held on its last frame: past it the clip's fists come up)
      if (O.w <= 0 || hs > 1.5) this._riseOut = null;
    }
    // a gesture (Player.gesture): kneeling to pick something up, petting the dog
    const Gs = this._gesture;
    if (Gs) {
      Gs.t += dt;
      const D = GESTURES.kneel, end = Gs.hold + D.in + D.out;
      if (hs > 0.8 || !this.onGround || R) Gs.t = Math.max(Gs.t, Gs.hold + D.in);   // (walking off: up again)
      Gs.w = THREE.MathUtils.smoothstep(Math.min(Gs.t / D.in, (end - Gs.t) / D.out), 0, 1);
      if (Gs.t >= end) this._gesture = null;
      else if (!R) {
        A.play(D.clip, D.from + (Gs.t % D.loop), Gs.w, { full: true, head: true, free: true });
        if (Gs.kind === 'pet') A.playUpper(GESTURES.pet.clip, GESTURES.pet.from + (Gs.t % GESTURES.pet.loop), Gs.w * GESTURES.pet.w);
      }
    }
    // locked on, moving sideways or backwards: the captured steps over the loops (LOCK_MOVE)
    this.updateStrafe(dt, A, hs, R);
    // Combat poses are applied after locomotion; flinches remain an upper-body overlay.
    // else a flinch as a foe's strike lands (Player.flinch)
    const Sw = this.swingMove, Fl = this._flinch;
    if (Fl) { Fl.t += dt; if (Fl.t >= FLINCH.for || this.down) this._flinch = null; }
    if (!Sw && this._flinch && !R) A.playUpper(FLINCH.clip, FLINCH.from + Fl.t, THREE.MathUtils.clamp(Math.min(Fl.t / 0.05, (FLINCH.for - Fl.t) / 0.2), 0, 1));
    // jumps, drops, the kick off a wall and a hard landing's stumble from motion capture (src/air-moves.js)
    const captured = this.locoMoves !== false && !!A.lib.motion?.clips?.length && !A.matching;
    // (talking: held still, no looking about: TALK_CALM)
    this._calm = THREE.MathUtils.lerp(this._calm ?? 0, this.talking ? 1 : 0, 1 - Math.exp(-TALK_CALM.rate * dt));
    A.calm = !!this.talking;
    A.idleMoves = captured && !this.talking;
    const air = (this.airMoves ??= new AirMoves());
    air.update(dt, { onGround: this.onGround, airT: this._clipAirT, tLand: J.phase?.tLand ?? Infinity, jumped: !!this._jumpedNow, wallKick: !!this._wallKick, speed: hs, impact: this._impact ?? 0,
      free: captured && !R && !this._gesture && !this.ride && !this.swim && !this.gliding && !this.onJets && !this.aim && this.flipping == null && !this._hop });   // (the flip is procedural: src/jump.js)
    this._jumpedNow = this._wallKick = false;
    if (!R) air.play(A);
    // starts, stops, turns on the spot and the pivot at a run from motion capture (src/loco-moves.js),
    // over the loops, played by the body's own motion (the controller is as it was)
    const steering = !!(this._moveDir && this._moveDir.lengthSq() > 0.01 && (this._wantSpeed ?? 0) > 0);
    if (this.locoMoves !== false && A.lib.motion?.clips?.length) {
      if (this.moves?.A !== A) this.moves = new LocoMoves(A);
      // (locked on: none of them, the captured steps sideways and back play instead: updateStrafe)
      const free = this.onGround && !this.aim && !this.ride && !this.swim && !this.overlay && !this.down && !this.climbing && !A.matching && !R && !air.cur && !this._gesture && !this.lockOn;
      this.moves.update(dt, { speed: hs, steering, wantSpeed: this._wantSpeed ?? 0, heading: this.heading, want: steering ? this.frame.headingOf(this._moveDir) : null, ground: free, size: A.legRatio });
      this.moves.play(A);
    }
    // (the air cut, src/fluid-blade.js AIR: the whole body in the air too, its own rise off the floor left out: the controller flies it)
    if (Sw && !R && !this.down) A.playCombat(Sw.clip, Sw.t, Sw.w, { full: (Sw.full && this.onGround) || (!!Sw.air && !this.onGround), ground: !!Sw.air && !this.onGround, id: Sw.id, blend: Sw.blend ?? 0.09 });
    // our walk / run speeds land on the walk and sprint clips; jog in between
    A.update(dt, {
      speed: hs, onGround: this.onGround, mode: 'ground', vy, jump: this.onGround ? null : J.phase,
      walkAt: Math.min(N.walk * 1.2, WALK * 0.4), jogAt: WALK, sprintAt: RUN,
      strideScale: 1,
      mm: A.matching ? this.matchInput() : null,
    });
    this.object.position.copy(this.pos);
    this.frame.quaternion(this.heading, this.object.quaternion);
    A.apply(this.object, { legScale: 1.04 });
    // starts, stops and turns (src/locomotion.js): the lean into a change of speed, the bank into a
    // curve, the head and chest turned to where you steer before the hips get there
    const U = this.frame.up, fwd = this.frame.dir(this.heading, _g1);
    const vf = this.vel.dot(fwd);
    const want = this.onGround && this._moveDir && this._moveDir.lengthSq() > 0.01 && !this.aim && !this.lockOn ? this.frame.headingOf(this._moveDir) : null;   // (locked on: the chest stays on the foe)
    (this.loco ??= new Locomotion({ walk: WALK })).update(dt, { vf, speed: hs, heading: this.heading, want, ground: this.onGround && !this.swim });
    this.loco.pose(c);
    if (this.combatMotion?.evade) {
      const e = Math.sin(Math.PI * this.combatMotion.evade);
      c.body.position.y -= e * 0.16;
      c.body.rotation.z += e * 0.18 * this.combatMotion.dir.dot(this.frame.right);
    }
    // the blade's charge held (src/fluid-blade.js CHARGE_LOOK, chargeBody): sunk into his knees, trembling with it once full
    if (this.chargeHold && this.onGround) {
      c.body.position.y -= this.chargeHold.crouch;
      c.body.rotation.z += this.chargeHold.shake;
      c.body.rotation.x += this.chargeHold.shake * 0.5;
    }
    J.pose(c, 1 - 0.6 * (A.legsW ?? 0));   // (a captured jump in the air, or its landing, has its own: a little of the tuck stays)
    // the double jump's front flip (src/jump.js FLIP), last: the whole body turns about the hips
    const flip = this.flipping, hop = this.hopping;
    if (flip != null && !this.onGround && !this.climbing && !this.swim && !this.ride && !this.down) flipPose(c, flip);
    // the locked-on hop's flip: the back flip, the side hop's lean (src/jump.js BACK_FLIP, SIDE_HOP)
    else if (hop && !this.climbing && !this.swim && !this.ride && !this.down) flipPose(c, hop.s, 1, hop.spec);
    if (this.edge?.k > 0.01 && this.onGround) this.edge.pose(c, 1 - THREE.MathUtils.smoothstep(hs, 0.6, 2.6));
    this.idleLayer(dt, hs);
    if (this.onGround && !this.humanoid) this.footIK(dt);
    c.hatTip.rotation.x = -hs * 0.02 + c.body.position.y * 3;
    // footstep: a foot reaches its lowest point and starts rising again
    if (this.onGround && hs > 0.8 && !this.humanoid) {
      for (let i = 0; i < 2; i++) {
        const y = c.feet[i].getWorldPosition(_g4).dot(this.frame.up);
        const prev = this._fy?.[i];
        const v = prev === undefined ? 0 : y - prev;
        this._fc = this._fc ?? [0, 0];
        this._fc[i] -= dt;
        if ((this._fv?.[i] ?? 0) < -1e-4 && v >= 0 && this._fc[i] <= 0) { this.stepped(_g4.clone(), i); this._fc[i] = 0.28; }
        (this._fy ??= [])[i] = y;
        (this._fv ??= [])[i] = v;
      }
    }
  }

  /**
   * Standing still: a relaxed, living stance on top of the idle clip. The
   * weight settles on one leg for a few seconds (the hip drops on the other
   * side, the shoulders counter-tilt, the free knee bends), then shifts over;
   * the stance narrows, the chest breathes, the elbows soften and the head
   * looks around now and then. The foot IK keeps both feet planted.
   */
  idleLayer(dt, hs) {
    // (not under a move of the clips' own: a turn on the spot, a stop's settling steps, a kneel)
    const target = this.onGround && !this.ride && hs < 0.35 && !this.climbing ? 1 - (this.animator?.legsW ?? 0) : 0;
    const k = this._still = THREE.MathUtils.lerp(this._still ?? target, target, 1 - Math.exp(-(target ? 2.5 : 8) * dt));
    if (k < 0.01) return;
    const c = this.char, t = this.time;
    const rot = (j, x, y, z) => j.quaternion.multiply(_tq.setFromEuler(_te.set(x * k, y * k, z * k)));
    // (w: -1..1, dwells on each side; held small while he talks: TALK_CALM)
    const { w, breath, look, nod } = idleMotion(t, this._calm ?? 0, this.animator?.moveW ?? 0);
    c.body.position.x -= w * 0.045 * k;
    c.body.position.y -= 0.015 * Math.abs(w) * k;
    rot(c.body, 0, w * 0.06, -w * 0.07);
    rot(c.torso, breath * 0.018, -w * 0.05, w * 0.09);
    this.standUnder(k);
    // narrow the stance; the free leg relaxes forward with a bent knee
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;                               // which way is inward for this leg
      const free = THREE.MathUtils.smoothstep(-w * side, 0.1, 0.9);
      rot(c.legs[i], -0.09 * free, 0.08 * free * side, side * 0.05);
      rot(c.knees[i], 0.2 * free, 0, 0);
    }
    // soft arms, a slow sway, one hand hooks the belt while the weight is on that side
    // (the right one, in the tank's glove, hangs a little out from the hip: its cuff sank into it)
    // (not the coral-shirt traveller: his belt is under the open overshirt, and the hook drew the hand
    // across in front of its panel at the hip, the wrist bent in, off the end of the sleeve: character.beltHook)
    const cuffed = this.has('backpack'), hooks = this.character?.beltHook !== false;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1, cuff = cuffed && i === 0;
      const hook = hooks ? THREE.MathUtils.smoothstep(w * side, 0.4, 0.95) * (cuff ? 0.3 : 0.6) : 0;
      rot(c.arms[i], 0.06 + breath * 0.01 - hook * 0.25, 0, side * ((cuff ? -0.06 : 0.1) + hook * 0.35));
      rot(c.elbows[i], -0.28 - hook * 0.9, 0, 0);
    }
    // glances: hold, turn the head, hold
    // (not while a captured idle looks about on its own: Animator idleMoves; not while he talks: idleMotion)
    rot(c.head, IDLE_HEAD + nod, look, 0);
  }

  /**
   * The idle clip stands in a wide, split stance (the left foot 13 cm ahead of its hip, the right
   * 26 cm behind, both well out to the side): side on, it reads as a stride. The drawings stand
   * him upright with his feet under his hips, a little apart. Each thigh swings (by k) so its ankle
   * comes in under the hip: IDLE_STANCE.ahead of its fore-aft offset kept, IDLE_STANCE.out of its
   * offset outward. (Before the weight shift's own leg poses, which go on top.)
   */
  standUnder(k) {
    const c = this.char, root = this.object;
    root.updateMatrixWorld(true);
    const rootQ = root.getWorldQuaternion(_sq1);
    // (legs brought upright reach lower: the body rises by what the less lowered ankle went down,
    // so the knees keep the clip's bend instead of folding to keep the feet on the ground)
    let sank = Infinity;
    for (let i = 0; i < 2; i++) {
      const hip = root.worldToLocal(c.legs[i].getWorldPosition(_g5)), d = root.worldToLocal(c.feet[i].getWorldPosition(_g6)).sub(hip);
      const y0 = d.y;
      const want = _g4.set(d.x * IDLE_STANCE.out + Math.sign(d.x) * (1 - IDLE_STANCE.out) * 0.03, d.y, d.z * IDLE_STANCE.ahead).setLength(d.length());
      const swing = _sq2.setFromUnitVectors(d.normalize(), want.normalize()).slerp(_sq3.identity(), 1 - k);
      // (the swing is in the root's frame: to the world, then into the thigh's parent)
      const world = c.legs[i].getWorldQuaternion(_sq3).premultiply(_sq4.copy(rootQ).multiply(swing).multiply(_sq1.clone().invert()));
      c.legs[i].quaternion.copy(c.legs[i].parent.getWorldQuaternion(_sq2).invert().multiply(world));
      c.legs[i].updateMatrixWorld(true);
      sank = Math.min(sank, y0 - root.worldToLocal(c.feet[i].getWorldPosition(_g6)).y + root.worldToLocal(c.legs[i].getWorldPosition(_g5)).y);
    }
    if (sank > 0 && sank < 0.2) { c.body.position.y += sank; c.body.updateMatrixWorld(true); }
  }

  /**
   * Fit the clip's feet to the real ground (slopes, steps, rocks). The clips
   * assume flat ground at the root: each foot near its planted height is moved
   * by the ground's offset under it, the pelvis drops for the lower foot, and
   * a two-bone solve bends the leg to reach.
   */
  footIK(dt) {
    const c = this.char, U = this.frame.up;
    const root = this.object;
    root.updateMatrixWorld(true);
    const S = (this._ik ??= { off: [0, 0], drop: 0 });
    const feetW = [0, 1].map((i) => c.feet[i].getWorldPosition(new THREE.Vector3()));
    const heights = feetW.map((p) => _g5.copy(p).sub(this.pos).dot(U));       // above the clip's floor
    for (let i = 0; i < 2; i++) {
      // how planted is this foot in the clip (fully at ankle height, fading by 25 cm up)
      const planted = 1 - THREE.MathUtils.smoothstep(heights[i], 0.09, 0.3);
      const g = _g4.copy(feetW[i]).addScaledVector(U, -heights[i]);           // the foot's spot on the clip floor
      this.groundPoint(g, U);
      const off = THREE.MathUtils.clamp(g.sub(this.pos).dot(U), -0.45, 0.45) * planted;
      S.off[i] = THREE.MathUtils.lerp(S.off[i], off, 1 - Math.exp(-18 * dt));
    }
    const drop = Math.min(S.off[0], S.off[1], 0);
    S.drop = THREE.MathUtils.lerp(S.drop, drop, 1 - Math.exp(-14 * dt));
    if (Math.abs(S.off[0]) + Math.abs(S.off[1]) < 0.004) return;
    c.body.position.y += S.drop;
    c.body.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const target = feetW[i].addScaledVector(U, S.off[i]);
      this.legIK(i, target);
    }
  }

  /** Two-bone IK for one rig leg: hip pitch/roll + knee bend to put the ankle at `target` (world). */
  legIK(i, target) {
    const c = this.char;
    const ankleRest = c.feet[i].position.y;                       // knee -> ankle (negative)
    const A = LEG_A, B = Math.abs(ankleRest);
    c.body.worldToLocal(_g4.copy(target)).sub(c.legs[i].position);
    const dist = THREE.MathUtils.clamp(_g4.length(), 0.2, (A + B) * 0.999);
    const roll = THREE.MathUtils.clamp(Math.atan2(_g4.x, -_g4.y), -0.35, 0.35);
    const pitch = Math.atan2(-_g4.z, -_g4.y);
    const alpha = Math.acos(THREE.MathUtils.clamp((A * A + dist * dist - B * B) / (2 * A * dist), -1, 1));
    const bend = Math.PI - Math.acos(THREE.MathUtils.clamp((A * A + B * B - dist * dist) / (2 * A * B), -1, 1));
    // keep the clip's foot orientation in body space
    c.feet[i].updateWorldMatrix(true, false);
    const footQ = c.feet[i].getWorldQuaternion(new THREE.Quaternion());
    c.legs[i].rotation.set(pitch - alpha, 0, roll);
    c.knees[i].rotation.set(bend, 0, 0);
    c.knees[i].updateWorldMatrix(true, false);
    const kneeQ = c.knees[i].getWorldQuaternion(new THREE.Quaternion());
    c.feet[i].quaternion.copy(kneeQ.invert().multiply(footQ));
    c.feet[i].updateMatrixWorld(true);
  }

  initGait(fwd, right) {
    const mk = (side) => {
      const p = this.pos.clone().addScaledVector(right, -side * 0.12);
      this.groundPoint(p, this.frame.up);
      return { plant: p, from: p.clone(), target: p.clone(), swinging: false, step: null, toe: 0, localZ: 0 };
    };
    return { phase: 0, feet: [mk(-1), mk(1)], drop: 0 };
  }

  /** Snap a world point to the ground below/above it (along up). */
  groundPoint(p, up) {
    const h = this.physics.heightAbove(_g5.copy(p).addScaledVector(up, 0.7), up, 0.6) - 0.7;
    if (Number.isFinite(h) && Math.abs(h) < 1.5) p.addScaledVector(up, -h);
    return p;
  }

  stepped(p, i, n) {
    if (this.onStep) this.onStep(p, this.heading, n ? n.clone() : this.frame.up, i);
  }
}

// Indoors the camera is Uncharted's: close over the right shoulder at the traveller's own
// height, looking level. It starts level when you step inside and is then yours to tilt (the
// stick or the mouse); where a wall is close behind, the arm comes in rather than climbing.
const INDOOR_PITCH = 0.1;        // rad: a touch down from level, at shoulder height

// The follow camera's arm. Out in the open it hangs back like Ocarina of Time's: low behind the
// traveller, a little over his head, looking a little down the way he faces, the traveller about a
// quarter of the frame's height in its lower middle and the world ahead filling the rest
// (OPEN_DIST, OPEN_LOOK, OPEN_PITCH; the wheel and LB + the right stick zoom it, ZOOM). In closed
// spaces it comes in close over a shoulder, like Uncharted: about 2 m back at shoulder height, the
// traveller big in the frame and to one side, the way ahead beside him (TIGHT_DIST, TIGHT_LOOK,
// TIGHT_SIDE): the ship, rooms, temples, the giant's chest, caves, alleys, canyons, low ceilings.
// The shoulder is the one with room beside it (CameraRig.pickShoulder), the right by default.
export const OPEN_DIST = 6.4;      // m, the arm from the look point (was 9.5 until v0.82)
export const OPEN_LOOK = 2.15;     // m over the feet: the look point in the open, over the head
export const TIGHT_DIST = 1.9;     // m, at the default zoom (scaled with the wheel; was 2.6)
export const TIGHT_LOOK = 1.5;     // m over the feet: close in, at the shoulders
export const HALL_DIST = 2.6;      // m: close in, but in a hall (hallness): a little further back (the close arm before v0.82), the room round him
export const ZOOM = [3, 60];       // m: the wheel's and the pad's range for the open arm
const TIGHT_SIDE = 0.7;            // m: the look point off the shoulder when close
const AIM_DIST = [3.4, 2.4];       // m: the arm while aiming, in the open and close in
const SHOULDER = { room: 2.4, margin: 0.6, cramped: 0.3, gain: 0.8, hold: 0.6, rest: 1.6, rate: 2.2 };   // pickShoulder
const PROBE_EVERY = 0.12;          // s between clearance probes
const PROBE_N = 8;                 // horizontal rays round the player
const LENS_R = 0.36;               // m: the room the lens needs round it (its near plane is 0.3 m out)
const ARM_HOLD = 0.35;             // s: after the arm comes in, how long before it lets out again
const ARM_CUT = 0.1;               // m: an arm cut shorter by more than this by a wall in one frame comes in on the spring (or is held)
const ARM_IN = 9;                  // 1/s: its spring coming in then, if it can't hold (the lens kept out of the walls on the way)
const ARM_OUT = 3.6;               // 1/s: its spring letting out again
const ARM_IN_MAX = 12;             // m/s: and at most this fast
const ARM_AHEAD = 0.22;            // s: turning by hand, how far ahead along the turn the arm looks for walls
const ARM_IN_ROOM = 0.16;          // m: as long as the lens keeps this much room on the way (else at once)
const SHORT_ARM = 1.05;            // m: an arm cut shorter than this close in tips the camera down over the head…
const SHORT_TILT = 0.7;            // rad: …by up to this much
const ARM_HOLD_CUT = 0.45;         // m: only a cut this big is held (holdSpot): less comes in on the spring
const AIR_FOLLOW = 3.5;            // 1/s: close in, how fast the view rises with a jump (on the ground: 14)…
const AIR_LAG = 0.8;               // m: …never more than this below him
const LOOK_R = 0.3;                // m: the room the look point keeps off walls close in
const SIDE_IN = 9;                 // 1/s: the look point eased off a wall that comes up right beside it
const SIDE_R = 0.1;                // m: the ball swept beside the look point to find the room for the shoulder
const HOLD_HANDS = 0.25;           // s: since you last turned the camera, it doesn't turn itself to hold its spot
const SWING = [0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6];   // rad: the turns tried when a wall is behind you indoors

const ENCLOSED = { ceil: 26, ring: 36, up: 42 };   // m: a shut space (a cave, a dome, a hall), however big

// How far up you can look (the rig's pitch: + looks down from above, - looks up from below).
// In the open nearly straight up: the camera drops to the grass behind the traveller and the
// top of the frame passes the zenith. Close in (tight spaces, rooms) as before: the arm is short
// there, and a steep look up would only fill the view with the ceiling or the traveller.
// Aiming (the fluid tool), anywhere, all the way up: the shot follows the reticle, so in a temple's
// tight rooms too you can aim straight up at a ceiling's switch or a guardian overhead (the tight
// limit stopped it at ~36°); the arm drops under the shoulder there, held off the floor.
export const PITCH_UP_OPEN = -1.36;
export const PITCH_UP_TIGHT = -0.62;
export const PITCH_UP_AIM = -1.5;
export const PITCH_DOWN = 1.3;

const smoothstep = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * How tight a spot is, 0 (open) .. 1 (tight), from the clearance probes
 * (metres from the chest, Infinity where a ray found nothing):
 * @param ceil  straight up
 * @param ring  PROBE_N horizontal rays, evenly round (so ring[i] and ring[i + N/2] are opposite)
 * @param up    rays slanting up and out (a dome or a cave roof catches them; a forest canopy lets most through)
 */
export function tightness({ ceil = Infinity, ring = [], up = [] }) {
  // a low ceiling (1.3 m over the chest is a 2.5 m passage; 5.5 m over it is a hall)
  const roof = 1 - smoothstep(1.6, 5.5, ceil);
  // walls on both sides: the narrowest width across (a corridor, an alley, a canyon floor)
  const half = ring.length >> 1;
  let width = Infinity, near = 0;
  for (let i = 0; i < half; i++) width = Math.min(width, ring[i] + ring[i + half]);
  for (const d of ring) if (d < 4.5) near++;
  const narrow = 1 - smoothstep(4.5, 9, width);
  // walls close on most sides: a small room, a cabin, a nook
  const shut = smoothstep(4, 7, near);
  // roofed over in every direction and walled round most of the way: inside something,
  // however big (the giant's chest; its way in and a gap or two may let a ray out)
  const walled = ring.filter((d) => d < ENCLOSED.ring).length;
  const enclosed = ceil < ENCLOSED.ceil && up.length > 0 && up.every((d) => d < ENCLOSED.up) && walled >= Math.ceil(ring.length * 0.6);
  const walls = Math.max(narrow, shut);
  return THREE.MathUtils.clamp(Math.max(
    enclosed ? 1 : 0,
    walls * (Number.isFinite(ceil) ? 1 : 0.8),   // an alley or a canyon under open sky: nearly all the way
    roof * 0.85,                                 // under a low ceiling the camera can't stand high anyway
    roof * walls * 1.5,
  ), 0, 1);
}

/**
 * How much a closed space is a hall rather than a passage, 0..1, from the same probes: a high
 * ceiling and walls far apart every way across (the giant's chest, a great cave, a temple's big
 * hall). There the close arm stands back further (HALL_DIST) so the room shows round the traveller;
 * in a corridor, a cabin or a narrow cave it stays over the shoulder (TIGHT_DIST).
 */
export function hallness({ ceil = Infinity, ring = [] }) {
  const half = ring.length >> 1;
  let width = Infinity;
  for (let i = 0; i < half; i++) width = Math.min(width, ring[i] + ring[i + half]);
  return smoothstep(6, 14, ceil) * smoothstep(9, 20, width);
}

export class CameraRig {
  constructor(camera, dom, physics) {
    this.camera = camera;
    this.physics = physics;
    this._curDist = OPEN_DIST;
    this._dir = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = OPEN_PITCH;
    this.pitch0 = OPEN_PITCH;   // (the default, for tools and tests)
    this.dist = OPEN_DIST;
    this.target = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._dragging = false;
    this._lastMouse = -1e9;
    this._now = 0;
    this._distBoost = 0;
    this.aimK = 0;           // set by the fluid tool while aiming (0..1)
    this.down = false;       // the traveller knocked down (main.js): the view follows the body on the ground, lower and softer
    this.downK = 0;
    // tight rooms (the ship sets this indoors): a lower look point, the camera up
    // under the ceiling looking down over the shoulder, and allowed in close
    this.indoor = false;
    this.indoorK = 0;
    // tight spaces in general (found by probing round the player, or flagged):
    // the arm comes in close over the shoulder, and goes back out in the open
    this.tight = 0;          // an explicit hint from a level (0..1), on top of what the probes find
    this.tightRaw = 0;       // what the last probe saw
    this.tightGoal = 0;      // after hysteresis
    this.tightK = 0;         // eased: what the arm uses
    this.hallRaw = 0;        // how much of a hall the last probe saw (hallness)
    this.hallK = 0;          // eased
    this._probeT = 0;
    this._lowT = 0;
    this._riding = false;
    this._lastP = null;
    this._ring = new Array(PROBE_N).fill(Infinity);
    this._up = new Array(4).fill(Infinity);
    this._side = 0;          // the look point's offset off the shoulder (signed: + right, - left), eased (it snapped and shook the view by walls)
    this.shoulder = 1;       // which shoulder close in: 1 the right, -1 the left (pickShoulder)
    this._swapT = 0;         // how long the other shoulder has looked better
    this._restT = 9;         // since the last swap
    this._jumped = false;    // the last updateTight was a jump (a teleport, a hand-over)
    this._swing = 0;         // indoors: the turn the camera is easing through to get clear of a wall behind you
    this._wide = 0; this._wideT = 0;   // the wider arm asked for (gliding, the jets), held a moment
    this._chasePitched = false;        // the last follow had a chase that tips the view (the jets' climb or dive)
    this._settleT = 0; this._settleFrom = 0;   // after it: easing the view back to the on-foot pitch (PITCH_SETTLE)

    dom.addEventListener('click', () => dom.requestPointerLock?.());
    dom.addEventListener('mousedown', () => (this._dragging = true));
    window.addEventListener('mouseup', () => (this._dragging = false));
    this.sensitivity = 1;
    this.invertY = false;
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== dom && !this._dragging) return;
      this.look(e.movementX, e.movementY);
    });
    dom.addEventListener('wheel', (e) => this.zoom(1 + Math.sign(e.deltaY) * 0.1), { passive: true });
  }

  /** Zoom the open arm by a factor (the wheel, LB + the right stick), within ZOOM. */
  zoom(f) {
    this.dist = THREE.MathUtils.clamp(this.dist * f, ZOOM[0], ZOOM[1]);
  }

  /** The look point's height over the feet: over the head in the open, at the shoulders close in, lower aiming. */
  lookHeight(k = Math.max(this.tightK, this.indoorK), ak = this.aimK ?? 0, pitch = this.pitch) {
    const free = THREE.MathUtils.lerp(OPEN_LOOK, TIGHT_LOOK, k);
    const aim = THREE.MathUtils.lerp(1.7, 1.4, k);
    // looking up from low down: aim higher so the sky and clouds fill the view
    const h = THREE.MathUtils.lerp(free, aim, ak) + Math.max(0, -pitch) * 1.4 * (1 - ak);
    return THREE.MathUtils.lerp(h, 0.9 - 0.3 * k, this.downK);   // knocked down: the body on the ground
  }

  /**
   * Which shoulder the camera looks over close in (this.shoulder, 1 right / -1 left), from the room
   * beside the look point and beside the arm on either side (rays along the camera's right, `R`):
   * the camera goes over the shoulder with room, so the traveller stands toward the wall and the way
   * ahead shows beside him. Hardly offset yet (coming in from the open), it picks freely (the right
   * unless the left has clearly more room); once over a shoulder it only swaps when that side is
   * cramped, the other has much more room, and that has held a moment, and not again soon after
   * (SHOULDER). Aiming is always over the right shoulder (the tool's hand). A jump picks at once.
   */
  pickShoulder(dt, want, ak, look, R, dir) {
    this._restT += dt;
    if (ak > 0.05) { this.shoulder = 1; this._swapT = 0; return; }
    if (want < 0.05 && Math.abs(this._side) < 0.05) { this._swapT = 0; return; }
    const P = this.physics, room = (s) => {
      _sr.copy(R).multiplyScalar(s);
      const a = P.rayDistance(look, _sr, SHOULDER.room);
      _sp.copy(look).addScaledVector(dir, Math.min(1.4, this._curDist * 0.7));
      return Math.min(a, P.rayDistance(_sp, _sr, SHOULDER.room));
    };
    if (this._jumped || (Math.abs(this._side) < 0.12 && this._restT > SHOULDER.rest)) {   // (not halfway through a swap)
      this._swapT = 0;
      this.shoulder = room(-1) > room(1) + SHOULDER.margin ? -1 : 1;
      return;
    }
    const here = room(this.shoulder), there = room(-this.shoulder);
    const cramped = here < want + 0.45 + SHOULDER.cramped;
    if (cramped && there > here + SHOULDER.gain && this._restT > SHOULDER.rest) this._swapT += dt;
    else this._swapT = 0;
    if (this._swapT > SHOULDER.hold) { this.shoulder = -this.shoulder; this._swapT = 0; this._restT = 0; }
  }

  /** Turn the camera by a pointer delta in pixels (mouse or touch). */
  look(dx, dy) {
    this._lastMouse = this._now;
    const k = 0.0025 * this.sensitivity;
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k * (this.invertY ? -1 : 1), this.pitchUpLimit(), PITCH_DOWN);
  }

  /** The lowest pitch (the steepest look up) right now: nearly straight up in the open, less close in, straight up aiming. */
  pitchUpLimit(k = Math.max(this.tightK, this.indoorK), ak = this.aimK ?? 0) {
    const free = THREE.MathUtils.lerp(PITCH_UP_OPEN, PITCH_UP_TIGHT, THREE.MathUtils.clamp(k, 0, 1));
    return THREE.MathUtils.lerp(free, PITCH_UP_AIM, THREE.MathUtils.clamp(ak, 0, 1));
  }

  /**
   * Of yaws near `yaw`, the first (nearest) whose camera arm is clear for `want`
   * metres, else the clearest: for placing the camera in a small room.
   * (Level ground frame only: up is +y.)
   */
  clearYaw(playerPos, yaw, { want = this.dist, offsets = [0, -0.5, 0.5, -1, 1, -1.6, 1.6, -2.3, 2.3, Math.PI] } = {}) {
    const pitch = this.indoor ? Math.max(this.pitch, INDOOR_PITCH) : this.pitch, cp = Math.cos(pitch);
    const look = _head.copy(playerPos).addScaledVector(Y, this.indoor ? 1.5 : 1.8);
    let best = yaw, bd = -1;
    for (const o of offsets) {
      const a = yaw + o;
      _toCam.set(Math.sin(a) * cp, Math.sin(pitch), Math.cos(a) * cp);
      let d = Math.min(want, this.physics.rayDistance(look, _toCam, want + 0.5) - 0.4);
      // and the body in sight from there (not just the head: a top bunk hides the rest)
      _shoulder.copy(look).addScaledVector(_toCam, d);
      const chest = _chest.copy(playerPos).addScaledVector(Y, 0.9);
      const to = _shoulder.sub(chest), L = to.length();
      if (L > 0.1 && this.physics.rayDistance(chest, to.divideScalar(L), L) < L) d *= 0.3;
      if (d >= want - 0.05) return a;
      if (d > bd + 0.05) { bd = d; best = a; }
    }
    return best;
  }

  /**
   * Probe the clearance round the player: up, a ring of horizontal rays at
   * chest height, and a few slanting up. Returns tightness() of it (0..1).
   * (A heightfield, the desert's dunes, is no mesh: its walls are sampled.)
   */
  probe(playerPos, U = Y, Fw = _zAxis, Rt = _xAxis) {
    const P = this.physics, chest = _pc.copy(playerPos).addScaledVector(U, 1.2);
    const ceil = this._ceil = P.rayDistance(chest, U, 30);
    const base = P.base && U.y > 0.999 ? P.base : null;
    for (let i = 0; i < PROBE_N; i++) {
      const a = (i / PROBE_N) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      _pd.copy(Rt).multiplyScalar(s).addScaledVector(Fw, c);
      let d = P.rayDistance(chest, _pd, 40);
      if (base) for (const r of [1.5, 3, 5, 8]) {
        if (r >= d) break;
        if (base.heightAt(chest.x + _pd.x * r, chest.z + _pd.z * r) > chest.y + 0.8 + r * 0.35) { d = r; break; }   // (a steep bank, not a dune slope)
      }
      this._ring[i] = d;
      if (i % 2 === 0) {
        _pd.multiplyScalar(0.7071).addScaledVector(U, 0.7071);
        this._up[i >> 1] = P.rayDistance(chest, _pd, 50);
      }
    }
    this.hallRaw = hallness({ ceil, ring: this._ring });
    return tightness({ ceil, ring: this._ring, up: this._up });
  }

  /**
   * The tight-space blend for this frame: probe now and then, hold the goal
   * with hysteresis (in quickly, out only once it has been open a while), ease.
   */
  updateTight(playerPos, dt, U, Fw, Rt) {
    const jumped = !this._lastP || this._lastP.distanceToSquared(playerPos) > 36;   // a teleport, a portal, a respawn
    // (how he moves, smoothed: sideArm looks a moment ahead of him, at the door he is about to go through)
    this._vel ??= new THREE.Vector3();
    if (jumped || dt <= 0) this._vel.set(0, 0, 0);
    else this._vel.lerp(_pv.subVectors(playerPos, this._lastP).divideScalar(dt), 1 - Math.exp(-8 * dt));
    (this._lastP ??= new THREE.Vector3()).copy(playerPos);
    this._jumped = jumped;
    this._probeT -= dt;
    if (this._probeT <= 0 || jumped) {
      const step = jumped ? 0 : PROBE_EVERY - this._probeT;
      this._probeT = PROBE_EVERY;
      // riding or gliding: speed wants room, whatever the walls
      let raw = this._riding ? 0 : this.probe(playerPos, U, Fw, Rt);
      raw = Math.max(raw, this.tight || 0, this.indoor ? 1 : 0, inTightRoom(playerPos) ? 1 : 0);
      this.tightRaw = raw;
      if (jumped) { this.tightGoal = raw; this._lowT = 0; }
      else if (raw > this.tightGoal + 0.1) { this.tightGoal = raw; this._lowT = 0; }
      else if (raw < this.tightGoal - 0.1) {
        // only let go once it has stayed open for a moment (a doorway, a gap between two stalls)
        if ((this._lowT += step) > 1.0) { this.tightGoal = raw; this._lowT = 0; }
      } else this._lowT = 0;
    }
    if (jumped) { this.tightK = this.tightGoal; this.hallK = this.hallRaw; }
    else this.hallK += (this.hallRaw - this.hallK) * (1 - Math.exp(-0.8 * dt));
    const rate = this.tightGoal > this.tightK ? 3.2 : 1.1;
    this.tightK += (this.tightGoal - this.tightK) * (1 - Math.exp(-rate * dt));
    return this.tightK;
  }

  /** Jump straight to the current tight / open state (after placing the player in a scene). */
  snapTight(playerPos) {
    this._lastP = null;
    if (playerPos) this.updateTight(playerPos, 0, Y, _zAxis, _xAxis);
    this.indoorK = this.indoor ? 1 : 0;
  }

  /**
   * While riding: swing behind the bike unless the mouse moved recently. A ride may ask for its own
   * view (shot: { side, boost, pitch }): a cab, which drives itself, is watched from beside and a
   * little above, where you see the traveller seated in it under its canopy.
   * The jets' flight asks for the same chase behind the nose (main.js: shot { pitch, keepTight }).
   * `wide` (metres, not riding a vehicle): a longer arm for what needs to see ahead and below
   * (gliding, the jets, climbing); held a moment after it drops (a tap of the jets doesn't pump it).
   * When a chase that tipped the view ends (landing from a dive, or leaving the jets for the water, the
   * wings, a wall or a ride), the pitch eases back to the on-foot framing (PITCH_SETTLE), unless you
   * turn the camera yourself.
   */
  follow(heading, dt, riding, shot = null, wide = null) {
    this._riding = !!riding && !shot?.keepTight;   // (the jets' chase keeps the close-in framing: a temple's shaft)
    this.settlePitch(dt, shot?.pitch != null);
    if (wide != null) {
      if (wide >= this._wide) { this._wide = wide; this._wideT = 0; }
      else if ((this._wideT += dt) > 1.2) this._wide = wide;
    }
    const goal = wide != null ? this._wide : riding ? shot?.boost ?? 7 : 0;
    this._distBoost += (goal - this._distBoost) * (1 - Math.exp(-2 * dt));
    if (!riding || this._now - this._lastMouse < 1.5) return;
    let d = heading + (shot?.side ?? 0) + Math.PI - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * (1 - Math.exp(-(shot?.yawRate ?? 2.2) * dt));
    if (shot?.pitch != null) this.pitch += (shot.pitch - this.pitch) * (1 - Math.exp(-1.5 * dt));
  }

  /** After a pitched chase ends: the pitch eases back to pitch0 (PITCH_SETTLE), given up if you turn the camera. */
  settlePitch(dt, pitched) {
    if (this._chasePitched && !pitched) { this._settleT = PITCH_SETTLE.time; this._settleFrom = this._now; }
    this._chasePitched = pitched;
    if (this._settleT <= 0) return;
    if (pitched || this._lastMouse >= this._settleFrom) { this._settleT = 0; return; }   // a new chase, or your own hand
    this._settleT -= dt;
    this.pitch += (this.pitch0 - this.pitch) * (1 - Math.exp(-PITCH_SETTLE.rate * dt));
    if (Math.abs(this.pitch - this.pitch0) < 0.005 || this._settleT <= 0) { this.pitch = this.pitch0; this._settleT = 0; }
  }

  /**
   * How far the camera can hang back from `from` along `dir` (up to `far`) with its lens clear:
   * the centre ray and four round it, spreading to `r` at the far end, so a bunk post or a
   * table leg slipping between two rays still stops it (a cheap cone cast). Metres along `dir`.
   */
  coneClear(from, dir, far, U = Y, r = 0.32) {
    const P = this.physics;
    let d = P.rayDistance(from, dir, far);
    _cn.crossVectors(U, dir);
    if (_cn.lengthSq() < 1e-6) _cn.set(1, 0, 0);
    _cn.normalize();
    _cd.crossVectors(dir, _cn).normalize();
    for (let i = 0; i < 4; i++) {
      const s = i & 1 ? -1 : 1;
      _ce.copy(dir).multiplyScalar(far).addScaledVector(i < 2 ? _cn : _cd, s * r);
      const L = _ce.length();
      const h = P.rayDistance(from, _ce.divideScalar(L), L);
      if (h < L) d = Math.min(d, (h * far) / L);
    }
    return d;
  }

  /**
   * Indoors (the ship's rooms): with a wall, a bunk or the reactor right behind the traveller the arm
   * would crush in against the back of the head (and pump in and out as you move). Instead the
   * camera swings round, easing, to the nearest side with room for the whole arm, like a camera
   * sliding along the wall. Never while you are turning it yourself.
   */
  swingClear(dt, want, pitch, k, U, Fw, Rt) {
    if (this._now - this._lastMouse < 0.8 || this.noSwing) { this._swing = 0; return; }
    const here = this.armRoom(this.yaw, pitch, want, k, U, Fw, Rt);
    let best = 0;
    if (here < want - 0.4) {
      let bestD = here + 0.35;   // only for a real gain
      for (const o of SWING) {
        const d = this.armRoom(this.yaw + o, pitch, want, k, U, Fw, Rt) - Math.abs(o) * 0.3;   // the nearer turn wins a tie
        if (d > bestD) { bestD = d; best = o; }
      }
    }
    this._swing += (best - this._swing) * (1 - Math.exp(-5 * dt));
    this.yaw += this._swing * (1 - Math.exp(-1.6 * dt));
  }

  /**
   * The arm the camera would get at this yaw (close in): clear of walls from the look point off the
   * shoulder (a cone), and with the head in sight from its end (as update() keeps them).
   */
  armRoom(yaw, pitch, want, k, U, Fw, Rt) {
    const cp = Math.cos(pitch);
    const dir = _toCam.copy(Rt).multiplyScalar(Math.sin(yaw) * cp).addScaledVector(U, Math.sin(pitch)).addScaledVector(Fw, Math.cos(yaw) * cp);
    const look = _sw.copy(this.target).addScaledVector(U, this.lookHeight(k, 0, pitch));
    _shoulder.crossVectors(U, dir).normalize().multiplyScalar(this.shoulder);
    const side = Math.max(0, Math.min(TIGHT_SIDE * k, this.physics.rayDistance(look, _shoulder, TIGHT_SIDE * k + 0.45) - 0.45));
    look.addScaledVector(_shoulder, side);
    let d = this.physics.sweepSphere ? Math.min(want, this.physics.sweepSphere(look, dir, want, LENS_R * 0.8)) : Math.min(want, this.coneClear(look, dir, want + 0.5, U) - 0.4);
    const head = _chest.copy(this.target).addScaledVector(U, 1.55);
    const to = _ct.copy(look).addScaledVector(dir, Math.max(d, 0)).sub(head), L = to.length();
    if (L > 0.3) {
      const h = this.physics.rayDistance(head, to.divideScalar(L), L);
      if (h < L) d *= Math.max(0, h - 0.3) / L;
    }
    return d;
  }

  /** The arm's length before walls pull it in: open, tight (over the shoulder) or aiming. */
  armLength(tk = this.tightK, ak = this.aimK ?? 0) {
    const open = this.dist + this._distBoost;
    // the close arm follows the wheel too (zoomed out a little further, in a little nearer)
    const close = THREE.MathUtils.clamp(THREE.MathUtils.lerp(TIGHT_DIST, HALL_DIST, this.hallK) * this.dist / OPEN_DIST, 1.5, 4.5);
    // aiming: over the right shoulder, a little nearer close in
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(open, Math.min(open, close), tk), THREE.MathUtils.lerp(AIM_DIST[0], AIM_DIST[1], tk), ak);
  }

  /**
   * The room beside `look` toward the shoulder `s` (along the camera's right, `_shoulder`), up to `far`:
   * also a little way ahead, counted as more room the further ahead it is, so a wall beside the way
   * ahead (the end of a pillar row, a door's jamb) eases the offset in before you reach it.
   */
  sideRoom(look, s, far, U = Y) {
    const P = this.physics, dir = _lb.copy(_shoulder).multiplyScalar(s);
    // (a thin ball swept sideways, not a ray: a door's jamb beside the look point is found a little before it is level
    // with it, and a row of thin uprights reads as a wall, where the ray found each all at once and the look point jumped)
    const side = (from) => (P.sweepSphere ? Math.min(far, P.sweepSphere(from, dir, far, SIDE_R) + SIDE_R) : P.rayDistance(from, dir, far));
    let room = side(look);
    _sr.copy(this._dir).addScaledVector(U, -this._dir.dot(U)).negate();   // ahead, level
    if (_sr.lengthSq() > 1e-6) {
      _sr.normalize();
      for (const [ahead, extra] of [[0.7, 0.25], [1.4, 0.5]]) {
        _sp.copy(look).addScaledVector(_sr, ahead);
        if (P.rayDistance(look, _sr, ahead) < ahead) break;   // (a wall ahead: nothing beside it to see)
        room = Math.min(room, side(_sp) + extra);
      }
    }
    return room;
  }

  /**
   * Close in, how much of the shoulder offset to keep (0..1, eased): none while the arm from beside the shoulder is cut
   * short and the arm from straight behind the head is not. A corridor whose one side is a row of open doors (the
   * sleeping cars') has room beside the shoulder through every door, so the look point went toward it, and the arm
   * behind caught on every door frame: in and out, a metre each time. Looked at every PROBE_EVERY s, held a moment.
   */
  sideArm(dt, want, dist, U = Y) {
    const P = this.physics;
    if (!P.sweepSphere) return 1;
    this._centreK ??= 1; this._centreT ??= 0; this._armT = (this._armT ?? 0) - dt;
    if (this._armT <= 0 || this._jumped) {
      this._armT = PROBE_EVERY;
      _shoulder.crossVectors(U, this._dir).normalize();
      // here, and where he will be in half a second (a door ahead: centred before the look point is in it)
      const ahead = _pv.copy(this._vel ?? _pv.set(0, 0, 0)).addScaledVector(U, -this._vel?.dot(U) || 0).multiplyScalar(0.5);
      for (const a of ahead.lengthSq() > 0.04 ? [0, 1] : [0]) {
        _hs.copy(this._look).addScaledVector(ahead, a);
        if (a && P.rayDistance(this._look, _sr.copy(ahead).normalize(), ahead.length()) < ahead.length()) continue;   // (a wall ahead: not going there)
        // (either shoulder: the one it is on may be the wrong one yet, pickShoulder has not chosen)
        let beside = 0;
        for (const sh of [1, -1]) {
          _sp.copy(_hs).addScaledVector(_shoulder, sh * want);
          if (P.roomAt(_sp, LENS_R) >= LENS_R * 0.8) beside = Math.max(beside, P.sweepSphere(_sp, this._dir, dist, LENS_R));
        }
        const behind = P.sweepSphere(_hs, this._dir, dist, Math.min(LENS_R, Math.max(0.12, P.roomAt(_hs, LENS_R) - 0.02)));
        if (beside < dist - 0.3 && behind > beside + 0.3) this._centreT = 0.8;
      }
    }
    this._centreT -= dt;
    const goal = this._centreT > 0 ? 0 : 1;
    this._centreK = this._jumped ? goal : this._centreK + (goal - this._centreK) * (1 - Math.exp(-3 * dt));
    return this._centreK;
  }

  /** @param frame the player's local frame (up / fwd / right) */
  update(playerPos, dt, frame) {
    this._now += dt;
    // (how fast the camera is being turned, by hand or by the lock-on, since the last frame: the arm looks ahead of it)
    const turnRate = dt > 0 && this._yawPrev != null ? Math.atan2(Math.sin(this.yaw - this._yawPrev), Math.cos(this.yaw - this._yawPrev)) / dt : 0;
    const U = frame ? frame.up : Y, Fw = frame ? frame.fwd : _zAxis, Rt = frame ? frame.right : _xAxis;
    const ak = this.aimK ?? 0;   // aiming the tool: in close, over the right shoulder
    this.indoorK += ((this.indoor ? 1 : 0) - this.indoorK) * (1 - Math.exp(-5 * dt));
    const ik = this.indoorK;
    const tk = this.updateTight(playerPos, dt, U, Fw, Rt);
    const k = Math.max(ik, tk);   // how close-quarters the framing is
    // closing in (a doorway, an alley), or done aiming: a steep look up eases back down to what fits
    // (with the aim's own easing: aimK)
    this.pitch = Math.max(this.pitch, this.pitchUpLimit(k, ak));
    const dist = this.armLength(tk, ak);
    this.downK += ((this.down ? 1 : 0) - this.downK) * (1 - Math.exp(-3 * dt));
    // (knocked down, softer; but not while the body is falling away from it: a long tumble left the frame)
    if (this._jumped) this.target.copy(playerPos);   // (a teleport, a hand-over: the framing is chosen where you are now)
    const lag = this.target.distanceTo(playerPos);
    const ty = this.target.y;
    this.target.lerp(playerPos, 1 - Math.exp(-THREE.MathUtils.lerp(14, 5, this.downK * (1 - smoothstep(1.5, 4, lag))) * dt));
    // a jump close in (a carriage, a corridor): the view rises with it less and more softly, so the arm doesn't knock
    // against the ceiling at the top of every hop and the frame doesn't bob (main.js sets rig.air while airborne);
    // never more than a metre behind, nor while the arm is wide or the ground falls away below
    this._airK = (this._airK ?? 0) + ((this.air ? 1 : 0) - (this._airK ?? 0)) * (1 - Math.exp(-10 * dt));
    const ak2 = this._airK * smoothstep(0.5, 0.9, Math.max(this.tightK, this.indoorK));
    // (rising only: coming down it follows at once, or he drops out of the bottom of the frame on landing)
    if (ak2 > 0.01 && U.y > 0.999 && !this._jumped && playerPos.y > ty) {
      const soft = ty + (playerPos.y - ty) * (1 - Math.exp(-AIR_FOLLOW * dt));
      this.target.y = Math.max(THREE.MathUtils.lerp(this.target.y, soft, ak2), playerPos.y - AIR_LAG);
    }
    if (this.target.lengthSq() === 0) this.target.copy(playerPos);
    // in the ship the view tips down a little from under the ceiling; more when a wall has
    // pulled the camera right in, so the head never fills the screen
    // Where a wall cuts the arm short (the curved corridor, a corner by the bunk), the camera
    // climbs instead, up under the ceiling looking down over the traveller, rather than crushing
    // in against the back of the head. The steepness is chosen for the room it gives, and eased
    // (it used to follow the arm's snaps frame by frame and bob the view up and down).
    // stepping inside: the view comes level once (from the steep look down of the open, or up at
    // the sky), then the stick and the mouse tilt it as anywhere else
    // (eased over a few tenths of a second: set at once, it jumped the view as you stepped through
    // the ship's hatch or a house's door; turning the camera yourself takes over)
    if (this.indoor && !this._wasIndoor && Math.abs(this.pitch - INDOOR_PITCH) > 0.25) this._levelTo = INDOOR_PITCH;
    if (!this.indoor || this._now - this._lastMouse < 0.05) this._levelTo = null;
    if (this._levelTo != null) {
      this.pitch += (this._levelTo - this.pitch) * (1 - Math.exp(-8 * dt));
      if (Math.abs(this.pitch - this._levelTo) < 0.01) { this.pitch = this._levelTo; this._levelTo = null; }
    }
    this._wasIndoor = this.indoor;
    // close in with the arm cut very short (turning round in a narrow corridor, a corner), the camera tips down over
    // the head, eased, so the traveller stays in the frame rather than his shoulders filling it (the camera QC's "out")
    const tiltGoal = k > 0.5 && ak < 0.5 ? THREE.MathUtils.clamp((SHORT_ARM - this._curDist) / (SHORT_ARM - 0.45), 0, 1) : 0;
    this._tilt = (this._tilt ?? 0) + (tiltGoal - (this._tilt ?? 0)) * (1 - Math.exp(-5 * dt));
    const pitch = Math.min(this.pitch + this._tilt * SHORT_TILT, PITCH_DOWN);
    // (in the ship's rooms, and close in anywhere the walls cut the arm: a vestibule, a corridor's end; never aiming)
    if (Math.max(ik, this.physics.sweepSphere ? tk : 0) > 0.5 && ak < 0.5 && U.y > 0.999) this.swingClear(dt, dist, pitch, k, U, Fw, Rt);
    const cp = Math.cos(pitch);
    const cam = this.camera.position;
    // over the head in the open (the traveller in the lower middle of the frame), at the shoulders
    // close in; looking up from low down, higher, so the sky and clouds fill the view
    // (never over whatever is overhead: on a table by a carriage's curved wall, the look point rose through the ceiling,
    // and the camera behind it ended up outside the train looking at its hull; the cap eased, down quickly, up slowly)
    let lh = this.lookHeight(k, ak, pitch);
    if (k > 0.05 && U.y > 0.999) {
      const roof = Math.min(this.physics.rayDistance(_pv.copy(this.target).addScaledVector(U, 0.9), U, lh + 0.3), 10) + 0.9 - 0.25;
      this._lookCap = this._jumped || this._lookCap == null ? roof : this._lookCap + (roof - this._lookCap) * (1 - Math.exp(-(roof < this._lookCap ? 12 : 2) * dt));
      lh = Math.max(0.9, Math.min(lh, this._lookCap));
    }
    this._look.copy(this.target).addScaledVector(U, lh);
    // (and never in a wall: the traveller's body keeps his axis 0.45 m off them, but pressed into a window's opening or up
    // on a seat by a curved wall the look point touched one, and the arm went out through it)
    if (k > 0.05 && U.y > 0.999 && this.physics.roomAt && this.physics.roomAt(this._look, LOOK_R) < LOOK_R) this.physics.pushCapsule?.(this._look, LOOK_R, -LOOK_R, LOOK_R, _ct, U);
    this._dir.copy(Rt).multiplyScalar(Math.sin(this.yaw) * cp)
      .addScaledVector(U, Math.sin(pitch))
      .addScaledVector(Fw, Math.cos(this.yaw) * cp);
    // over a shoulder (aiming: the right; close in: the one with room, pickShoulder), but never past
    // a wall beside you. The offset is signed (+ right) and eased, so a change of shoulder slides
    // across behind the head; a wall closing in on the side it is on pulls it in at once (it used to
    // flick on and off by walls, shaking the view: eased out, snapped in).
    let want = Math.max(0.85 * ak, TIGHT_SIDE * k);
    if (k > 0.5 && ak < 0.5) {
      want *= this.sideArm(dt, want, dist, U);
      // (and less of it the shorter the arm: with the lens right behind the head, a look point 70 cm off the shoulder put
      // the traveller's head off the edge of the frame, turning round in a corridor or a shop)
      want *= THREE.MathUtils.clamp((this._curDist - 0.3) / 1.2, 0.25, 1);
    }
    if (want > 0.01 || Math.abs(this._side) > 0.01) {
      _shoulder.crossVectors(U, this._dir).normalize();   // the camera's right
      this.pickShoulder(dt, want, ak, this._look, _shoulder, this._dir);
      const s = this.shoulder;
      const room = this.sideRoom(this._look, s, want + 0.45, U);
      const goal = s * Math.max(0, Math.min(want, room - 0.45));
      const onSide = this._side * s >= 0;   // (the offset is on that shoulder already, or there is none)
      if (this._jumped) this._side = goal;
      else if (onSide && Math.abs(goal) < Math.abs(this._side)) {
        // a wall coming in beside it: eased in quickly, and pulled in at once only as far as needed
        // to keep the look point off the wall (it used to snap all the way in, a jump in the view)
        this._side += (goal - this._side) * (1 - Math.exp(-10 * dt));
        // (and quickly, but over a few frames, off a wall right beside it: at once, a door's jamb appearing beside the
        // look point jumped it 30 cm; never closer than 0.08 m, where the arm's ball has no room left to start from)
        if (Math.abs(this._side) > room - 0.2) {
          const to = s * Math.max(0, room - 0.2);
          this._side += (to - this._side) * (1 - Math.exp(-SIDE_IN * dt));
          if (Math.abs(this._side) > room - 0.08) this._side = s * Math.max(0, room - 0.08);
        }
      } else this._side += (goal - this._side) * (1 - Math.exp(-(onSide ? 4 : SHOULDER.rate) * dt));
      // (sliding across: never past a wall on the side it is still on)
      if (Math.sign(this._side) !== s && Math.abs(this._side) > 0.01) {
        const back = this.physics.rayDistance(this._look, _lb.copy(_shoulder).multiplyScalar(-s), Math.abs(this._side) + 0.45);
        this._side = -s * Math.max(0, Math.min(Math.abs(this._side), back - 0.2));
      }
      this._look.addScaledVector(_shoulder, this._side);
    } else this._side = 0;

    // Line of sight: pull the camera in front of any wall between it and the
    // player (snap in, ease back out).
    // (skipped while gravity is rolling the view: the swinging ray would
    // otherwise clip the floor and yank the camera in)
    const rolling = this.camera.up.dot(U) < 0.985;
    // (close in, a cone of rays: a single one slips past bunk posts and table legs, and the lens ends up inside them)
    // Close in, a ball the lens's size swept back along the arm (src/physics.js sweepSphere): it sees a row of window
    // mullions, chair backs or compartment door frames as the solid band they are, where a ray (or the cone of rays it
    // replaced) slipped between them on one frame and hit one on the next, popping the camera in and out (the camera QC,
    // .claude/skills/camera-qc: the Overnight Train's carriages); and the lens keeps its room by itself (no shove off a
    // wall afterwards). The ball is as big as the room round the look point allows, so a look point near a wall still
    // finds its arm. In the open, the one ray as before.
    const swept = !rolling && k > 0.05 && this.physics.sweepSphere;
    let hit, margin = THREE.MathUtils.lerp(0.6, 0.4, k);
    if (swept) {
      const r = this._sweepR = THREE.MathUtils.clamp(this.physics.roomAt(this._look, LENS_R) - 0.02, 0.12, LENS_R);
      hit = this.physics.sweepSphere(this._look, this._dir, dist + 0.5, r);
      margin = Math.max(0, margin - r);   // (the ball keeps its own room)
    } else hit = rolling ? Infinity : this.physics.rayDistance(this._look, this._dir, dist + 0.5);
    // (close in it may come right in: a floor of 1.5 m would put it through a corridor wall)
    // (and never further than the swept ball found room for, even under the floor of an arm: a look point pressed to a
    // wall put the lens through it, and the push off the far side sent it out of the carriage to look at its hull)
    let allowed = Math.max(Math.min(dist, hit - margin), Math.min(THREE.MathUtils.lerp(1.5, 0.45, k), swept ? Math.max(0.15, hit) : Infinity));
    // the ground limits the arm too (so you can drop low and look at the sky):
    // the longest arm whose end stays 0.4 m above the ground, found by
    // bisection, folded into the same target so the two can't fight
    if (U.y > 0.999) {
      // (from just under whatever is overhead: from 3 m up, a ceiling's top reads as "ground")
      const clear = (d) => {
        cam.copy(this._look).addScaledVector(this._dir, d);
        const lift = k > 0.05 || this.indoor ? Math.max(0.25, Math.min(3, this.physics.rayDistance(cam, Y, 3) - 0.1)) : 3;
        return cam.y >= this.physics.groundAt(cam.x, cam.y + lift, cam.z) + 0.4;
      };
      if (!clear(allowed)) {
        let lo = 0.8, hi = allowed;
        for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (clear(m)) lo = m; else hi = m; }
        allowed = lo;
      }
    }
    // close in, the look point sits off the shoulder: also keep the head itself in sight
    // (a bunk or a doorframe between the camera and the head, but not the look point)
    if (k > 0.5) {
      _head.copy(this.target).addScaledVector(U, 1.55);
      cam.copy(this._look).addScaledVector(this._dir, allowed);
      _toCam.subVectors(cam, _head);
      const L = _toCam.length();
      const h = L > 0.3 ? this.physics.rayDistance(_head, _toCam.divideScalar(L), L) : Infinity;
      if (h < L) allowed = Math.max(0.45, allowed * Math.max(0, h - 0.3) / L);
    }
    // snap in, ease back out; tiny changes are ignored so it can't jitter. After coming in it holds a moment before
    // it lets out (ARM_HOLD): along a row of windows or seats the room behind comes and goes every metre, and the arm
    // pumped in and out with it
    // Close in, an arm cut short by a metre or more in one frame (the traveller stepping out of a corridor into a
    // vestibule, past a partition's end, through a door): rather than jump in, the camera stays where it was, if it
    // still has its room and sees him from there, and turns to follow him (holdSpot); while you turn it by hand, it
    // comes in quickly but not at once, unless the lens would be in a wall on the way (the camera QC's pops).
    // (in and out on a spring, critically damped: its speed changes smoothly, where an easing's first step was a kink)
    // While you turn it by hand, the arm also looks where the turn is taking it (ARM_AHEAD s on): coming round toward a
    // wall or a door's frame it starts in before it gets there, on the spring, instead of meeting the edge and jumping.
    // So does a quick walk or a run (the look point a moment on, where he is going: through a door, the arm behind
    // will be cut by its jambs as soon as he is through).
    const hands = this._now - this._lastMouse < HOLD_HANDS;
    let soft = allowed;
    const turning = hands && Math.abs(turnRate) > 0.3, moving = (this._vel?.lengthSq() ?? 0) > 4;
    if ((turning || moving) && swept && k > 0.5 && U.y > 0.999) {
      const a = this.yaw + (turning ? THREE.MathUtils.clamp(turnRate * ARM_AHEAD, -0.8, 0.8) : 0);
      _hs.copy(Rt).multiplyScalar(Math.sin(a) * cp).addScaledVector(U, Math.sin(pitch)).addScaledVector(Fw, Math.cos(a) * cp);
      let from = this._look;
      if (moving) {
        _pv.copy(this._vel).addScaledVector(U, -this._vel.dot(U)).multiplyScalar(ARM_AHEAD);
        const L = _pv.length();
        if (this.physics.rayDistance(this._look, _sr.copy(_pv).divideScalar(L), L + 0.3) > L + 0.3) from = _sp.copy(this._look).add(_pv);
      }
      const ahead = this.physics.sweepSphere(from, _hs, dist + 0.5, this._sweepR ?? LENS_R) - margin;
      soft = Math.min(allowed, Math.max(ahead, THREE.MathUtils.lerp(1.5, 0.45, k)));
    }
    const cut = this._curDist - soft;
    this._armV ??= 0;
    const spring = (w, to) => { this._armV += (w * w * (to - this._curDist) - 2 * w * this._armV) * dt; return this._curDist + this._armV * dt; };
    if (cut > 0.02) {
      const close = k > 0.5 && ak < 0.5 && swept && U.y > 0.999 && !this._jumped && this._camPrev && (cut > ARM_CUT || soft < allowed);
      if (close && !hands && cut > ARM_HOLD_CUT && this.holdSpot(dist, U, Fw, Rt)) this._armV = 0;   // (held: yaw, pitch and the arm turned to where it was)
      else if (close) {
        let next = spring(ARM_IN, soft);
        if (this._armV < -ARM_IN_MAX) { this._armV = -ARM_IN_MAX; next = this._curDist - ARM_IN_MAX * dt; }
        cam.copy(this._look).addScaledVector(this._dir, next);
        if (next <= soft) { next = soft; this._armV = 0; }
        // (the lens would be in a wall on the way, or under the ground a heightfield makes: at once)
        else if (next > allowed && (this.physics.roomAt(cam, LENS_R) < ARM_IN_ROOM || cam.y < this.physics.groundAt(cam.x, cam.y + 0.2, cam.z) + 0.3)) { next = allowed; this._armV = 0; }
        this._curDist = next;
        this._holdT = ARM_HOLD;
      } else { this._curDist = soft; this._armV = 0; this._holdT = ARM_HOLD; }
    } else if ((this._holdT = (this._holdT ?? 0) - dt) <= 0) {
      const next = spring(ARM_OUT, allowed);
      if (next >= allowed || this._armV < 0) { this._curDist = Math.min(next, allowed); if (next >= allowed) this._armV = 0; }
      else this._curDist = next;
    } else this._armV = 0;
    cam.copy(this._look).addScaledVector(this._dir, this._curDist);
    // keep the lens clear of walls beside, above and below it (its near plane
    // reaches ~0.35 m off the axis: a wall that close would be cut open)
    if (k > 0.05 && !rolling) {
      if (!swept) this.unclip(cam, U);   // (the swept ball left the lens its room already: the rays only shoved it about)
      // and off anything else that close (a bunk's edge just under the lens, a corner): a sphere pushed out
      this.physics.pushCapsule?.(cam, LENS_R, -LENS_R, LENS_R, _ct, U);
    }
    this.constrain?.(cam);
    // roll the camera with gravity (smoothly, so portals don't snap the view)
    // (a quaternion turn, so even a 180° flip rotates instead of collapsing)
    if (this.camera.up.dot(U) < 0.99999) {
      _q1.setFromUnitVectors(this.camera.up, U).slerp(_qId, Math.exp(-6 * dt));
      this.camera.up.applyQuaternion(_q1).normalize();
    }
    this.camera.lookAt(this._look);
    (this._camPrev ??= new THREE.Vector3()).copy(cam);
    this._yawPrev = this.yaw;
  }

  /**
   * The camera's last spot, if it will still do: room round the lens, the look point and the head in sight from it, no
   * further than the arm. Then the arm is turned to it (yaw, pitch and length): the camera stays put and turns to follow
   * the traveller, instead of jumping in to the short arm straight behind him. Returns whether it held.
   */
  holdSpot(dist, U = Y, Fw = _zAxis, Rt = _xAxis) {
    const P = this.physics, H = this._camPrev;
    const to = _hs.subVectors(H, this._look), L = to.length();
    if (L < 0.8 || L > dist + 0.3) return false;
    if (P.roomAt(H, LENS_R) < 0.28) return false;
    to.divideScalar(L);
    if (Math.abs(to.dot(U)) > 0.8) return false;
    if (P.sweepSphere(this._look, to, L + 0.05, this._sweepR ?? LENS_R) < L) return false;   // (as the arm will be found next frame: else it holds, lets go, holds…)
    const head = _head.copy(this.target).addScaledVector(U, 1.55), toH = _ct.subVectors(H, head), Lh = toH.length();
    if (Lh > 0.3 && P.rayDistance(head, toH.divideScalar(Lh), Lh) < Lh - 0.1) return false;
    const pitch = Math.asin(THREE.MathUtils.clamp(to.dot(U), -1, 1)) - (this._tilt ?? 0) * SHORT_TILT;
    if (pitch < this.pitchUpLimit() || pitch > PITCH_DOWN) return false;
    this.yaw = Math.atan2(to.dot(Rt), to.dot(Fw));
    this.pitch = pitch;
    this._dir.copy(to);
    this._curDist = Math.min(L, this._curDist);   // (no further than it was: walking away from it, it comes along)
    this._holdT = ARM_HOLD;
    return true;
  }

  /** Push the camera off any surface closer than `r` to its sides, top or bottom. */
  unclip(cam, U = Y, r = 0.42) {
    _cr.crossVectors(U, this._dir).normalize();          // the camera's right (or left: both are tried)
    _cu2.crossVectors(this._dir, _cr).normalize();       // its up
    for (const [v, s] of [[_cr, 1], [_cr, -1], [_cu2, 1], [_cu2, -1]]) {
      _pd.copy(v).multiplyScalar(s);
      const d = this.physics.rayDistance(cam, _pd, r);
      if (d < r) cam.addScaledVector(_pd, -(r - d));
    }
  }
}
