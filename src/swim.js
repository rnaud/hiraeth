import * as THREE from 'three';
import { CAPSULE } from './player.js';

// ---------------------------------------------------------------------------
// Swimming. The traveller walks into water; past wading depth they float and
// swim (player.js calls swimFrame once a frame, before walking):
//
//   wading      water over the feet slows the walk (SWIM.wadeSlow at the chest);
//               the steps splash (water.js)
//   floating    where the water is SWIM.float deep and more, you float: the feet
//               hang SWIM.ride under the surface, the head above it
//   swimming    camera-relative, slow to start and to stop; Shift (L3 on a pad)
//               sprints on stamina (a front crawl); the strokes splash
//   diving      hold Z / Ctrl, or swim forward looking down (the pad's way: it
//               has no button spare); under water the strokes go where you look,
//               Space rises, letting go floats you back up
//   breath      SWIM.breath seconds of air under water (player.breath 0..1); at
//               the surface it comes back in SWIM.refill s. Out of air: you are
//               pushed up, and every SWIM.every s a small hurt (player.hurt),
//               which never takes the last of the bar
//   climbing out  push into a ledge at the surface: the mantle pulls you out
//               (player.tryMantle); a wall with no top in reach: you climb it
//               (or press Space at the surface: a ledge in front, else a kick up)
//   the bed     where it rises to SWIM.stand under the surface you stand again
//   falling in  water SWIM.cushion deep and more breaks any fall: no tumble, no
//               hurt (player.js moveStep asks player.cushioned)
//
// No jets and no wings in the water: they come back once you are out of it
// (a kick at the surface is enough). player.water is the world's water (water.js
// Waters: surfaceAt(x, z, y)); player.onSwim(event, info) hears 'enter',
// 'exit', 'stroke', 'dive', 'surface', 'gasp', 'hop' (water.js splashes them).
// ---------------------------------------------------------------------------

export const SWIM = {
  wade: 0.25,        // m of water over the feet before it counts as wading
  wadeSlow: 0.5,     // walking speed at chest-deep wading (× normal)
  float: 1.3,        // water this deep lifts you off your feet
  stand: 1.1,        // swimming, where the bed comes this close under the surface you stand
  ride: 1.28,        // floating, the feet (player.pos) hang this far under the surface
  cushion: 1.6,      // water this deep breaks any fall
  speed: 2.5,        // m/s, swimming
  sprint: 4.6,       // m/s, the sprint (a front crawl, on stamina)
  sprintCost: 0.14,  // stamina per second of sprinting
  dive: 2.4,         // m/s down (or up) when you dive / rise
  rise: 1.1,         // m/s: let go under water and you float back up
  accel: 2.6,        // 1/s: the water's slowness to speed up and to stop
  under: 0.32,       // m under the floating height: the head is under water
  breath: 22,        // s of air
  refill: 2.2,       // s to breathe back to full at the surface
  every: 1.2,        // s between hurts once out of air
  bite: 0.07,        // each hurt (of the bar), never the last of it
  hop: 7.5,          // m/s: Space at the surface kicks you up (onto a low ledge, out of the water)
  stroke: { tread: 0.55, breast: 0.85, crawl: 1.05 },   // strokes per second
};

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _push = new THREE.Vector3();
const sm = THREE.MathUtils.smoothstep, lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;

/**
 * The water where the player is: { surface, depth (the water column: surface -
 * the bed under you), over (water over the feet) } or null (dry, or no water).
 */
export function waterHere(P) {
  const W = P.water;
  if (!W) return null;
  const hit = W.surfaceAt(P.pos.x, P.pos.z, P.pos.y);
  if (!hit) return null;
  const surface = hit.y;
  const bed = P.onGround ? Math.min(P.pos.y, surface) : P.physics.groundAt(P.pos.x, Math.max(P.pos.y + 1.2, surface + 0.3), P.pos.z);
  const depth = surface - (Number.isFinite(bed) ? bed : surface - 60);
  return { surface, depth, over: surface - P.pos.y, body: hit.body };
}

/** Should a player in this water float (start swimming)? */
export function shouldFloat(w, { onGround, vy }) {
  if (!w) return false;
  if (w.depth >= SWIM.float && w.over >= SWIM.float) return true;                     // walked in past the chest
  return !onGround && vy < 0 && w.depth >= SWIM.cushion && w.over >= 0.35;          // fell, jumped or dropped in
}

/** Walking speed in this water (× normal): slower the deeper you wade. */
export const wadeFactor = (w) => (w && w.over > SWIM.wade ? lerp(1, SWIM.wadeSlow, sm(w.over, SWIM.wade, SWIM.float)) : 1);

/**
 * The breath: under water it runs out over SWIM.breath s; at the surface it comes back.
 * Out of air, every SWIM.every s a hurt that never takes the last of the bar.
 * Returns 'gasp' on the frame the head comes up after being under, 'hurt' on a hurt.
 */
export function breathe(P, dt, under) {
  const was = P._underT ?? 0;
  if (under) {
    P._underT = was + dt;
    P.breath = Math.max(0, (P.breath ?? 1) - dt / (SWIM.breath * (P.breathK ?? 1)));   // (the breathing reed: breathK 2)
    if (P.breath > 0) { P._drownT = 0; return null; }
    P._drownT = (P._drownT ?? 0) + dt;
    if (P._drownT < SWIM.every) return null;
    P._drownT = 0;
    const bite = Math.min(SWIM.bite, Math.max(0, (P.health ?? 1) - 0.1));
    if (bite > 0) P.hurt(bite, 'drown');
    return 'hurt';
  }
  P._underT = 0; P._drownT = 0;
  P.breath = Math.min(1, (P.breath ?? 1) + dt / SWIM.refill);
  return was > 0.6 ? 'gasp' : null;
}

/** Start floating (walked in deep, or fell in): the splash, and the fall's speed eaten by the water. */
export function enterSwim(P, w) {
  const impact = Math.max(0, -P.vel.y);
  P.swim = { ph: 0, k: 0, crawl: 0, push: 0, hs: 0, under: false, pitch: 0, roll: 0, since: 0, wasUnder: false };
  P.vel.y = Math.max(P.vel.y * 0.35, -8);
  P.vel.x *= 0.55; P.vel.z *= 0.55;
  P.onGround = false;
  P.gliding = P.thrusting = false;
  P.wingK = 0;
  P._landing = null;
  P.onSwim?.('enter', { pos: P.pos.clone(), surface: w.surface, speed: impact });
}

/** Out of the water (stood up on the bed, hopped out, mantled onto a ledge, started climbing). */
export function leaveSwim(P, why = 'stand') {
  if (!P.swim) return;
  P.swim = null;
  P.onSwim?.('exit', { pos: P.pos.clone(), why });
}

/**
 * A frame of the player in water (player.js update, before walking). Returns
 * true if it moved the player this frame (swimming), false to walk as usual
 * (dry ground, or wading: then player.wadeSlow slows the walk).
 */
export function swimFrame(P, dt, input, camYaw, { f = 0, s = 0, run = false, stickScale = 1 } = {}) {
  P.wadeSlow = 1;
  const F = P.frame, U = F.up;
  if (!P.water || U.y < 0.99) { P.inWater = null; if (P.swim) leaveSwim(P, 'gone'); return false; }   // (water lies flat under ordinary gravity only)
  const w = waterHere(P);
  P.inWater = w;
  if (!w || (P.swim && w.over < 0.3)) { if (P.swim) leaveSwim(P, 'gone'); breathe(P, dt, false); return false; }   // (out of it: teleported, carried off)
  if (!P.swim) {
    if (!shouldFloat(w, { onGround: P.onGround, vy: P.vel.y })) { P.wadeSlow = wadeFactor(w); breathe(P, dt, false); return false; }
    enterSwim(P, w);
  }
  const S = P.swim;
  S.since += dt;
  const rest = w.surface - SWIM.ride;

  // ---- what you want: camera-relative strokes (as on land), up / down
  const camF = _v1.copy(F.right).multiplyScalar(-Math.sin(camYaw)).addScaledVector(F.fwd, -Math.cos(camYaw));
  const camR = _v2.copy(F.right).multiplyScalar(Math.cos(camYaw)).addScaledVector(F.fwd, -Math.sin(camYaw));
  const move = _v3.set(0, 0, 0).addScaledVector(camF, f).addScaledVector(camR, s);
  if (move.lengthSq() > 1) move.normalize();
  const sprint = run && (P.stamina ?? 1) > 0.04 && move.lengthSq() > 0.01;
  P.stamina = sprint ? Math.max(0, P.stamina - SWIM.sprintCost * dt) : Math.min(1, (P.stamina ?? 1) + 0.25 * dt);
  const speed = (sprint ? SWIM.sprint : SWIM.speed) * (stickScale < 1 ? lerp(0.35, 1, stickScale) : 1);
  const under = P.pos.y < rest - SWIM.under;
  let rise = (input.Space ? 1 : 0) - (input.KeyZ || input.ControlLeft || input.ControlRight || input.PadDive ? 1 : 0);
  // swimming forward looking down dives; under water the strokes go where you look
  let look = 0;
  const cf = P.camFwd;
  if (cf && f > 0.2 && (under || cf.y < -0.55)) look = clamp(cf.y, -0.95, 0.95) * Math.min(f, 1);
  // out of air: up you go, and no diving again until you have your breath back
  if ((P.breath ?? 1) <= 0) S.gasping = true;
  else if (S.gasping && P.breath > 0.6) S.gasping = false;
  if (S.gasping) { rise = 1; look = Math.max(look, 0); }
  if (!under && look > 0) look = 0;

  // ---- Space at the surface: up onto a ledge in front, else a kick up out of the water
  const press = input.Space && !P._jumpHeld;
  P._jumpHeld = !!input.Space;
  if (!under && press) {
    const into = move.lengthSq() > 0.01 ? _push.copy(move).normalize() : F.dir(P.heading, _push);
    P.wallN.copy(into).negate();
    if (P.tryMantle(U, into)) { leaveSwim(P, 'ledge'); return true; }
    P.pos.y = Math.max(P.pos.y, rest);
    P.vel.y = SWIM.hop;
    leaveSwim(P, 'hop');
    P.onSwim?.('hop', { pos: P.pos.clone(), surface: w.surface });
    return true;
  }

  // ---- velocity: the water is slow to speed you up and to stop you
  const a = 1 - Math.exp(-SWIM.accel * dt);
  const flat = Math.sqrt(Math.max(0, 1 - look * look));
  P.vel.x += (move.x * speed * flat - P.vel.x) * a;
  P.vel.z += (move.z * speed * flat - P.vel.z) * a;
  const diving = rise < 0 || look < -0.2 || under;
  if (diving) {
    let want = rise * SWIM.dive + look * speed;
    if (!rise && Math.abs(look) < 0.2) want = SWIM.rise;              // let go: float back up
    P.vel.y += (want - P.vel.y) * (1 - Math.exp(-3 * dt));
  } else {
    // floating: a spring to the surface, the body bobbing a little with the strokes
    const bob = Math.sin(S.ph * Math.PI * 2) * 0.05 * S.k;
    P.vel.y += ((rest + bob - P.pos.y) * 22 - P.vel.y * 7) * dt;
  }

  // ---- move, slide along walls; push into a ledge at the surface to climb out
  P.pos.addScaledVector(P.vel, dt);
  const L = P.opts.limit ?? 1900;
  P.pos.x = clamp(P.pos.x, -L, L); P.pos.z = clamp(P.pos.z, -L, L);
  if (!diving && P.pos.y > rest + 0.08) { P.pos.y = rest + 0.08; P.vel.y = Math.min(P.vel.y, 0); }
  const push = P.physics.pushCapsule(P.pos, CAPSULE.radius, CAPSULE.step, CAPSULE.height, P._push ?? _push, U);
  if (push) {
    const n = push.normalize();
    const vn = P.vel.dot(n);
    if (vn < 0) P.vel.addScaledVector(n, -vn);
    if (move.dot(n) < -0.5 && Math.abs(n.y) < 0.5) {
      S.push += dt;
      if (S.push > 0.2 && !under) {
        P.wallN.copy(n);
        if (P.tryMantle(U, _v1.copy(n).negate())) { leaveSwim(P, 'ledge'); return true; }
        if (P.opts.climb && (P.stamina ?? 1) > 0.1) { leaveSwim(P, 'climb'); P.startClimb(n); return true; }
      }
    } else S.push = 0;
  } else S.push = 0;

  // ---- the bed: never through it; where it rises close under the surface, stand up
  const g = P.physics.groundAt(P.pos.x, P.pos.y + 1.2, P.pos.z);
  if (Number.isFinite(g) && P.pos.y < g) { P.pos.y = g; if (P.vel.y < 0) P.vel.y = 0; }
  if (Number.isFinite(g) && w.surface - g < SWIM.stand && P.pos.y - g < 0.6) {
    P.pos.y = g;
    P.vel.y = 0;
    P.onGround = true;
    leaveSwim(P, 'stand');
    return true;
  }

  // ---- facing, the strokes' rhythm, the breath
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (hs > 0.3) {
    let d = F.headingOf(_v1.set(P.vel.x, 0, P.vel.z)) - P.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    P.heading += d * (1 - Math.exp(-5 * dt));
  }
  const go = sm(Math.hypot(hs, P.vel.y), 0.25, 1.6);
  S.k += (go - S.k) * (1 - Math.exp(-4 * dt));
  S.crawl += ((sprint ? 1 : 0) - S.crawl) * (1 - Math.exp(-3 * dt));
  S.hs = hs;
  S.under = under;
  S.vy = P.vel.y;
  const rate = lerp(SWIM.stroke.tread, lerp(SWIM.stroke.breast, SWIM.stroke.crawl, S.crawl), S.k) * (0.75 + 0.25 * Math.min(Math.hypot(hs, P.vel.y) / SWIM.speed, 1.6));
  const before = S.ph;
  S.ph = (S.ph + rate * dt) % 1;
  if (S.ph < before && S.k > 0.3) P.onSwim?.('stroke', { pos: P.pos.clone(), surface: w.surface, k: S.k, under, crawl: S.crawl });
  if (under && !S.wasUnder) P.onSwim?.('dive', { pos: P.pos.clone(), surface: w.surface });
  S.wasUnder = under;
  const b = breathe(P, dt, under);
  if (b) P.onSwim?.(b, { pos: P.pos.clone(), surface: w.surface });
  P.onGround = false;
  P.gliding = P.thrusting = false;
  P.wingK = 0;
  P._hang = null;
  return true;
}

// ---------------------------------------------------------------- the pose
// Procedural strokes on the traveller's rig (player.js buildCharacter: the
// humanoid follows it). Treading water upright when still; a breaststroke
// lying flat when swimming (pull, draw the knees, kick and shoot the arms,
// glide); a front crawl when sprinting; under water the body pitches with the
// way it goes. The rig's root is at the feet: the body is moved so the chest
// stays where a floating chest would be.

const TAU = Math.PI * 2;
/** smooth 0..1 over [a, b] of the cycle */
const seg = (p, a, b) => sm(p, a, b);

function setLimbs(c, L) {
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;           // legs[0] / arms[0]: the -x side (the character's right)
    c.arms[i].rotation.set(L.ax[i], 0, side * L.az[i]);
    c.elbows[i].rotation.set(L.ex[i], 0, 0);
    c.legs[i].rotation.set(L.lx[i], 0, side * L.lz[i]);
    c.knees[i].rotation.x = L.kx[i];
    c.feet[i].rotation.set(L.fx[i], 0, 0);
  }
}
const mixL = (A, B, k) => {
  const o = {};
  for (const key in A) o[key] = [lerp(A[key][0], B[key][0], k), lerp(A[key][1], B[key][1], k)];
  return o;
};

/** Treading water: arms sculling out in front, legs cycling. */
function tread(p) {
  const sc = Math.sin(p * TAU), sc2 = Math.sin(p * TAU + Math.PI);
  return {
    ax: [-0.75 + 0.12 * sc, -0.75 + 0.12 * sc2], az: [0.75 + 0.2 * sc, 0.75 + 0.2 * sc2], ex: [-0.7, -0.7],
    lx: [-0.55 + 0.35 * sc, -0.55 + 0.35 * sc2], lz: [0.18, 0.18], kx: [1.0 + 0.45 * sc2, 1.0 + 0.45 * sc], fx: [0.5, 0.5],
  };
}

/** The breaststroke, in the body's frame (lying face down, the head forward). */
function breast(p) {
  // arms: glide forward (overhead) → sweep out and down (pull) → hands meet under the chest → shoot forward
  const pull = seg(p, 0.0, 0.32), tuck = seg(p, 0.3, 0.48), shoot = seg(p, 0.5, 0.68);
  const ax = -2.95 + 1.15 * pull + 0.15 * tuck - 1.3 * shoot * (1 - 0) + 0.0;   // (overhead -2.95 → -1.8 → -1.65 → back to -2.95)
  const az = 0.25 + 0.75 * pull * (1 - tuck) - 0.12 * tuck;
  const ex = -0.1 - 1.1 * pull * (1 - shoot) - 0.7 * tuck * (1 - shoot);
  // legs: straight in the glide → draw the heels up (knees bend, out) → kick round and back together
  const draw = seg(p, 0.32, 0.5), kick = seg(p, 0.5, 0.66);
  const lx = 0.08 - 0.75 * draw * (1 - kick);
  const lz = 0.08 + 0.32 * draw * (1 - 0.6 * kick) - 0.2 * kick * 0.4;
  const kx = 0.1 + 1.85 * draw * (1 - kick);
  const fx = 0.9 - 0.6 * draw * (1 - kick);
  return { ax: [ax, ax], az: [az, az], ex: [ex, ex], lx: [lx, lx], lz: [lz, lz], kx: [kx, kx], fx: [fx, fx] };
}

/** The front crawl: the arms turn over in turn, the legs flutter. */
function crawl(p) {
  const o = { ax: [0, 0], az: [0.12, 0.12], ex: [0, 0], lx: [0, 0], lz: [0.04, 0.04], kx: [0, 0], fx: [1.0, 1.0] };
  for (let i = 0; i < 2; i++) {
    const q = (p + i * 0.5) % 1;
    // under water (q < 0.55): the hand pulls from overhead down past the hip; then it recovers over the water, elbow high
    const inWater = q < 0.55;
    const k = inWater ? q / 0.55 : (q - 0.55) / 0.45;
    o.ax[i] = inWater ? lerp(-3.0, -0.25, sm(k, 0, 1)) : lerp(-0.25, -3.0 - 0.0, sm(k, 0, 1)) ;
    o.az[i] = inWater ? 0.12 : 0.12 + 0.55 * Math.sin(Math.PI * k);
    o.ex[i] = inWater ? -0.45 * Math.sin(Math.PI * k) : -1.4 * Math.sin(Math.PI * k);
    const fl = Math.sin(p * TAU * 3 + i * Math.PI);
    o.lx[i] = 0.12 * fl; o.kx[i] = 0.25 + 0.2 * Math.max(0, fl);
  }
  return o;
}

/**
 * Pose the traveller swimming (player.js animate calls it while player.swim).
 * Returns the pitch it leans the body to (for the camera's and the tests' sake).
 */
export function swimPose(P, dt) {
  const c = P.char, S = P.swim;
  for (const fl of c.flames ?? []) fl.visible = false;
  P._gait = null;
  const k = S.k, cr = S.crawl;
  // the body: upright treading (a little forward) → flat; under water it pitches with the way you go
  let pitch = lerp(0.18, 1.4, k);
  if (S.under || S.vy < -0.5) pitch += Math.atan2(-(S.vy ?? 0), Math.max(S.hs, 0.4)) * k * 0.8;
  pitch = clamp(pitch, 0.1, 2.6);
  S.pitch += (pitch - S.pitch) * (1 - Math.exp(-5 * dt));
  const roll = cr * 0.45 * Math.sin(S.ph * TAU) * k;
  S.roll += (roll - S.roll) * (1 - Math.exp(-8 * dt));
  const th = S.pitch;
  // keep the chest (1.2 m up the body) where a floating chest is: just under the surface treading
  // water, the back breaking it swimming flat (the water is opaque: a body under it is gone)
  const chest = 1.2, at = SWIM.ride + lerp(-0.15, 0.1, k) * (S.under ? 0 : 1);
  c.body.rotation.set(th, 0, S.roll);
  c.body.position.set(0, at - chest * Math.cos(th), -chest * Math.sin(th));
  c.torso.rotation.set(0, 0, 0);
  c.torso.scale.y = 1;
  // the head: up out of the water when flat (lifting on the breaststroke's pull), turned to breathe on the crawl
  const lift = (1 - cr) * seg(S.ph, 0.1, 0.35) * (1 - seg(S.ph, 0.5, 0.65));
  c.head.rotation.set(-lerp(0.1, 1.05, k) * (S.under ? 0.55 : 1) - 0.3 * lift * k, cr * k * 0.9 * Math.max(0, Math.sin(S.ph * TAU)), 0);
  const limbs = mixL(tread(S.ph), mixL(breast(S.ph), crawl(S.ph), cr), k);
  setLimbs(c, limbs);
  if (c.hatTip) c.hatTip.rotation.set(-0.2 * k, 0, 0);
  // the root, placed now (finishFrame places it too)
  P.object.position.copy(P.pos);
  P.frame.quaternion(P.heading, P.object.quaternion);
  return th;
}
