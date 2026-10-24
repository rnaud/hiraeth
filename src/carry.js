import * as THREE from 'three';
import { registerInteractable, PRIORITY } from './interact.js';
import { screen } from './platform.js';
import { game as sharedGame } from './game-state.js';
import { t as tr } from './i18n.js';

// Carrying small things in both hands (issue #337, the author: "I should be able to pick up and put down small objects,
// that should be put to use for puzzles. Like grab a box from afar with the grappling hook, then put it down on a switch
// so I can go through a door"). docs/systems/carry.md.
//
// A carryable is any loose thing shaped as the gadgets' Prop (src/gadgets/world.js): { object, pos (its middle, the
// object's position), r (its radius round), h (half its height), vel, held, name, mass, metal }, registered here:
//
//   const off = registerCarryable(prop)    the use button near it picks it up ("pick up the crate"), off() forgets it
//   registerSnap({ pos, r, name, accepts? }) a place a thing put down near is set on (a floor plate: its disc's top)
//
// Picked up, it is the traveller's (player.carrying = { thing, k }): held in front of his chest in both hands
// (Player.finishFrame poses the arms on it: Humanoid.handOff), a slower walk, a hop for a jump, no sprint, no double jump,
// wings or jets, no climbing; the gun, the blade, the guard and the gadget in hand wait. The use button again puts it
// down in front of him (on a plate near that spot: set on its middle), the blade's button throws it a short way. A
// climb, a swim, a mount, a fall or a knock-down lets it go. A thing held puts its own collider aside while carried
// (it would stand in his way) and takes it back where it is put. The grappling hook drags a carryable into his hands
// (src/gadgets/hook.js). What is carried is on the screen's data too (platform.js screen.carry), for the engines.

export const CARRY = {
  maxR: 0.6,       // m: the largest thing carried (its radius round)
  maxMass: 1.5,    // a metal crate (4) is too heavy
  reach: 1.9,      // m from his feet to its middle, along the ground, to pick it up
  rise: 1.6,       // m: what lies more than this above or below his feet is out of reach
  speed: 0.62,     // share of the walk he keeps carrying it
  jump: 0.5,       // share of the jump's speed: a hop
  fwd: 0.24,       // m in front of him its near face is held (its middle: + its radius), against his belly
  up: 1.06,        // m over his feet its middle is held
  top: 1.42,       // m over his feet its top is held at most (a crate a metre high lower, under his chin)
  grip: { back: 0.45, down: 0.3 },   // where the hands hold its sides: this share of its radius back toward him and down
  put: 0.7,        // m in front of his feet its near face is put down
  snap: 0.9,       // m: a plate's rim this near the spot it would go takes it, set on its middle
  lift: 0.3,       // s to lift it into his arms
  throw: { speed: 6.5, up: 4.2 },   // m/s: thrown forward and up
};

const things = new Set(), snaps = new Set();
/** Can this be carried at all (small and light enough, not metal, not told otherwise)? */
export const canCarry = (t) => !!t && t.carry !== false && !t.metal && (t.r ?? 0.5) <= CARRY.maxR && (t.mass ?? 1) <= CARRY.maxMass;
export const carryables = () => [...things];
export const carrySnaps = () => [...snaps];

/** What a carried thing's `held` is set to: no gravity on it, no other gadget takes it, it weighs nothing on a plate. */
export const IN_HANDS = Object.freeze({ carry: true, name: 'hands' });

/** Hooks: a first-time line (main.js: the toast), a sound as it is set down. */
export const carryHooks = { notice: null, sound: null, toss: null };   // (toss: a thing thrown, heard: issue #379)
const TAUGHT = 'carry.taught';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _f = new THREE.Vector3(), _q = new THREE.Quaternion();
const _Y = new THREE.Vector3(0, 1, 0);
const upOf = (p) => p?.frame?.up ?? _Y;
const fwdOf = (p, out) => (p.frame?.dir ? p.frame.dir(p.heading ?? 0, out) : out.set(Math.sin(p.heading ?? 0), 0, Math.cos(p.heading ?? 0)));
const smooth = (k) => k * k * (3 - 2 * k);

let entries = false, carrier = null;
/** The one entry that puts down what is carried (registered once, with the first carryable). */
function ensureEntries() {
  if (entries) return;
  entries = true;
  const tag = new THREE.Vector3();
  registerInteractable({
    id: 'carry.put', priority: PRIORITY.use + 2, range: 1, gesture: null, offscreenUse: true,
    distance: (p) => (p?.carrying ? 0 : Infinity),
    prompt: () => { const snap = carrier?.carrying ? putSpot(carrier)?.snap : null; return snap ? `set it on the ${snap.name ?? 'plate'}` : 'put it down'; },
    at: () => (carrier?.carrying?.thing?.pos ? tag.copy(carrier.carrying.thing.pos).addScaledVector(upOf(carrier), (carrier.carrying.thing.h ?? 0.4) + 0.25) : null),
    use: (p) => { if (!putDown(p)) dropCarried(p, { gently: true }); },
  });
}

/** A loose thing that may be carried: the use button near it picks it up. Returns off(). */
export function registerCarryable(t) {
  if (!t) return () => {};
  ensureEntries();
  things.add(t);
  const tag = new THREE.Vector3();
  const off = registerInteractable({
    id: `carry.${t.id ?? t.name ?? 'thing'}`, priority: PRIORITY.use, range: CARRY.reach, gesture: null,
    prompt: () => `pick up the ${t.name ?? 'thing'}`,
    reachAt: () => t.pos, reachCollider: () => t.collider,
    at: () => tag.copy(t.pos).addScaledVector(_Y, (t.h ?? 0.4) + 0.3),
    enabled: () => !t.held && t.object?.visible !== false && canCarry(t) && (t.canPick?.() ?? true),
    distance: (p) => {
      if (!p?.pos || p.carrying || p.ride || p.climbing || p.swim || p.down || p.dead || !p.onGround) return Infinity;
      const U = upOf(p), d = _f.subVectors(t.pos, p.pos), dy = d.dot(U);
      if (dy < -CARRY.rise || dy > CARRY.rise) return Infinity;
      d.addScaledVector(U, -dy);
      return Math.max(0, d.length() - (t.r ?? 0.4));
    },
    use: (p) => pickUp(p, t),
  });
  return () => { off(); things.delete(t); if (t.held === IN_HANDS && carrier?.carrying?.thing === t) dropCarried(carrier); };
}

/** A place a thing is set on when put down near it: { pos (its top's middle, world), r, name, accepts?(thing), taken?() }. */
export function registerSnap(s) { snaps.add(s); return () => snaps.delete(s); }

/** Where the carried thing's middle is held: in front of his chest. */
export function holdPoint(p, t = p.carrying?.thing, out = new THREE.Vector3()) {
  const U = upOf(p), base = p.object?.position ?? p.pos, r = t?.r ?? 0.4;
  // (a bigger thing lower, its top under his chin: CARRY.top)
  return out.copy(base).addScaledVector(U, Math.min(CARRY.up, CARRY.top - (t?.h ?? r))).addScaledVector(fwdOf(p, _f), CARRY.fwd + r);
}

/** Where his hands hold it (the middle between them, world): on its sides, a little toward him and down from its middle. */
export function gripPoint(p, t = p.carrying?.thing, out = new THREE.Vector3()) {
  if (!t?.pos) return null;
  const r = t.r ?? 0.4;
  return out.copy(t.pos).addScaledVector(fwdOf(p, _f), -r * CARRY.grip.back).addScaledVector(upOf(p), -r * CARRY.grip.down);
}

/**
 * Where it would go if put down now: { pos (its middle), snap } or null (no floor there, or no room). On a snap (a plate)
 * near the spot in front of him: on its middle; else on the floor there, or nearer him when that is in a wall.
 */
export function putSpot(p, t = p.carrying?.thing, physics = p.physics) {
  if (!t) return null;
  const U = upOf(p), F = fwdOf(p, new THREE.Vector3()), r = t.r ?? 0.4, h = t.h ?? r;
  const at = new THREE.Vector3().copy(p.pos).addScaledVector(F, CARRY.put + r);
  let best = null, bd = Infinity;
  for (const s of snaps) {
    if (s.enabled && !s.enabled()) continue;
    if (s.accepts && !s.accepts(t)) continue;
    if (s.taken?.(t)) continue;
    const d = _v.subVectors(s.pos, at), dy = d.dot(U);
    if (Math.abs(_w.subVectors(s.pos, p.pos).dot(U)) > 1.2) continue;
    d.addScaledVector(U, -dy);
    const L = d.length();
    if (L < s.r + CARRY.snap && L < bd) { bd = L; best = s; }
  }
  if (best) return { pos: best.pos.clone().addScaledVector(U, h + 0.01), snap: best };
  for (const k of [1, 0.55]) {
    const q = new THREE.Vector3().copy(p.pos).addScaledVector(F, (CARRY.put + r) * k + (1 - k) * 0.2);
    const g = physics?.groundAt?.(q.x, p.pos.y + 1.2, q.z, 2.6);
    if (!Number.isFinite(g) || g < p.pos.y - 1.1 || g > p.pos.y + 0.6) continue;
    q.y = g + h + 0.01;
    // (room for it there: nothing of the world inside it)
    const probe = _v.copy(q);
    const rc = Math.max(0.05, Math.min(r * 0.85, h - 0.06));
    const push = physics?.pushCapsule?.(probe, rc, -h + 0.1, h, _w, U);
    if (push && push.lengthSq() > 0.01) continue;
    return { pos: q, snap: null };
  }
  return null;
}

/** Pick `t` up into his arms (true if it is his now). */
export function pickUp(p, t, { from = 'hand' } = {}) {
  if (!p || !t || p.carrying || !canCarry(t) || (t.held && t.held !== IN_HANDS)) return false;
  p.carrying = { thing: t, k: from === 'hook' ? 0.6 : 0, from: t.pos.clone(), fromQ: t.object?.quaternion?.clone() ?? new THREE.Quaternion(), how: from };
  t.held = IN_HANDS;
  t.vel?.set(0, 0, 0);
  t.resting = false;
  if (t.collider && p.physics?.removeCollider) { p.physics.removeCollider(t.collider); t._stashed = p.physics; }
  carrier = p;
  t.onPick?.(p, from);
  p.sprinting = false;
  p.gliding = false;
  screen.set('carry', { name: t.name ?? 'thing', how: from });
  if (!sharedGame.flag?.(TAUGHT)) { sharedGame.set?.(TAUGHT, true); carryHooks.notice?.(tr('hint.carry')); }
  return true;
}

/** Let go of what is carried (no checks): the collider back, `held` cleared. */
function release(p) {
  const C = p.carrying;
  if (!C) return null;
  const t = C.thing;
  p.carrying = null;
  if (t.held === IN_HANDS) t.held = null;
  if (t._stashed) { const ph = t._stashed; if (ph.restoreCollider) ph.restoreCollider(t.collider); else if (!ph.extras?.includes(t.collider)) ph.extras?.push(t.collider); t._stashed = null; }
  if (carrier === p) carrier = null;
  screen.set('carry', null);
  return t;
}

/** Put it down in front of him (on a plate near there: on its middle). False when there is no room to. */
export function putDown(p) {
  const t = p?.carrying?.thing;
  if (!t) return false;
  const spot = putSpot(p, t);
  if (!spot) return false;
  release(p);
  t.pos.copy(spot.pos);
  if (t.object) {
    // (square to him, or to the plate's own frame)
    if (spot.snap?.yaw != null) t.object.rotation.set(0, spot.snap.yaw, 0);
    else t.object.rotation.set(0, p.heading ?? 0, 0);
    t.object.updateMatrixWorld();
  }
  t.vel?.set(0, 0, 0);
  t.resting = false;
  t.onPut?.(spot.pos, spot.snap, 'put');
  carryHooks.sound?.(t, spot.snap);
  return true;
}

/** Throw it a short way ahead of him (the blade's button while carrying). */
export function throwCarried(p) {
  const t = p?.carrying?.thing;
  if (!t || (p.carrying.k ?? 0) < 0.6) return false;
  release(p);
  const U = upOf(p), F = fwdOf(p, _f);
  if (t.vel) { t.vel.copy(F).multiplyScalar(CARRY.throw.speed).addScaledVector(U, CARRY.throw.up); if (p.vel) t.vel.addScaledVector(p.vel, 0.5); }
  t.resting = false;
  t.onPut?.(t.pos.clone(), null, 'throw');
  carryHooks.toss?.(t);
  return true;
}

/** Let it go where it is (a climb, a swim, a knock-down): put down at his feet if there is room, else dropped. */
export function dropCarried(p, { gently = false } = {}) {
  const t = p?.carrying?.thing;
  if (!t) return false;
  if (gently && putDown(p)) return true;
  release(p);
  t.vel?.set(0, 0, 0);
  t.resting = false;
  t.onPut?.(t.pos.clone(), null, 'drop');
  return true;
}

/** What makes him let go of it now (a climb, the water, a mount, the wings, a knock-down), or null. */
export function mustDrop(p) {
  if (p.climbing || p.mantle) return 'climb';
  if (p.hidden) return 'hidden';   // (aboard the ship, in a scene)
  if (p.swim) return 'swim';
  if (p.ride || p.boarding) return 'ride';
  if (p.dead || p.down) return 'down';
  if (p.gliding || p.jetFlight) return 'fly';
  return null;
}

/**
 * Per frame, from Player.finishFrame (after he moved, before his arms are posed): it rises into his arms over CARRY.lift
 * and is held there, square to him; what makes him let go lets it go.
 */
export function updateCarry(p, dt) {
  const C = p.carrying;
  if (!C) return;
  const t = C.thing;
  if (mustDrop(p) || !t.object || t.object.visible === false || t.held !== IN_HANDS) { dropCarried(p); return; }
  C.k = Math.min(1, C.k + dt / CARRY.lift);
  const e = smooth(C.k), want = holdPoint(p, t, _w);
  t.pos.lerpVectors(C.from, want, e);
  _q.setFromAxisAngle(upOf(p), p.heading ?? 0);
  t.object.quaternion.copy(C.fromQ).slerp(_q, e);
  t.object.updateMatrixWorld();
  t.vel?.set(0, 0, 0);
  carrier = p;
}

/** How far into his arms it is (0..1; 0 carrying nothing): the arms' pose weight (Player.finishFrame, src/hands.js). */
export const carryK = (p) => (p?.carrying ? smooth(Math.min(1, p.carrying.k ?? 0)) : 0);
