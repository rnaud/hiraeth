import * as THREE from 'three';

// How a blow feels (docs/systems/foes.md, "Feel"): a hit-stop (the frame freezes: the world stops dead for a
// few hundredths of a second as a cut lands, so the impact reads) and a camera kick that dies away. main.js runs
// the frame's time through feelDt() and shakes the camera after the rig has placed it.
//
//   hitStop(0.06)          the world freezes for the next 60 ms (FEEL.slow of real time: none; a longer one wins)
//   slowMo(0.4, 0.35)      the world runs at 35% for the next 0.4 s (of real time), after any hit-stop (the last foe of a fight)
//   kick(0.4)              the camera jolts (0..1, adds up to 1) and settles over FEEL.settle s
//   feelDt(dt) → dt        per frame, the world's time step
//   shakeCamera(camera, dt)
//
// The player's motion settings (src/ui.js: "Reduce motion", "Camera shake"; docs/systems/ui.md) turn them down:
//   setMotion({ reduce: true })   no hit-stop, no slow motion, no camera kick
//   setMotion({ shake: 0.5 })     the kicks at half their size (0: none)

export const FEEL = { slow: 0, settle: 0.28, reach: 0.14, maxStop: 0.14 };
const state = { stop: 0, shake: 0, t: 0, slow: 0, rate: 1 };
const motion = { reduce: false, shake: 1 };

/** The motion settings (src/ui.js applyAccess). */
export function setMotion({ reduce = motion.reduce, shake = motion.shake } = {}) {
  motion.reduce = !!reduce; motion.shake = Math.min(1, Math.max(0, +shake || 0));
  if (motion.reduce) { state.stop = 0; state.slow = 0; }
  if (motion.reduce || !motion.shake) state.shake = 0;
}
export const motionState = () => ({ ...motion });
/** How much of a camera shake to play (the ship's own scenes: src/ship/ship.js shake): 0 with reduced motion. */
export const shakeScale = () => (motion.reduce ? 0 : motion.shake);

export function hitStop(s) { if (motion.reduce) return; state.stop = Math.min(FEEL.maxStop, Math.max(state.stop, s)); }
/** Slow motion for s seconds of real time at `rate` of the world's speed (eases back to full over its last third). */
export function slowMo(s, rate = 0.35) { if (motion.reduce) return; state.slow = Math.max(state.slow, s); state.slowFor = state.slow; state.rate = rate; }
export function kick(k) { if (motion.reduce) return; state.shake = Math.min(1, state.shake + k * motion.shake); }
/** The world's step this frame: nothing during a hit-stop (the frame freezes). */
export function feelDt(dt) {
  if (state.stop <= 0) {
    if (state.slow <= 0) return dt;
    state.slow = Math.max(0, state.slow - dt);
    const ease = Math.min(1, state.slow / (state.slowFor / 3));   // (1 until the last third, then back to full speed)
    return dt * THREE.MathUtils.lerp(1, state.rate, ease);
  }
  state.stop -= dt;
  return Math.max(dt * FEEL.slow, 1e-5);   // (frozen, but never a zero step: some systems divide by it)
}
const _o = new THREE.Vector3();
/** The camera's jolt (after the rig placed it): a quick wobble, smaller as it settles. */
export function shakeCamera(camera, dt) {
  if (state.shake <= 0.001) { state.shake = 0; return; }
  state.t += dt;
  const a = state.shake * state.shake * FEEL.reach;
  _o.set(Math.sin(state.t * 71) + Math.sin(state.t * 43) * 0.5, Math.sin(state.t * 59 + 1) * 0.8, Math.sin(state.t * 67 + 2) * 0.5).multiplyScalar(a);
  camera.position.add(_o);
  state.shake = Math.max(0, state.shake - dt / FEEL.settle);
}
/** (tests) */
export const feelState = () => ({ ...state });
export function resetFeel() { state.stop = 0; state.shake = 0; state.t = 0; state.slow = 0; state.rate = 1; }
