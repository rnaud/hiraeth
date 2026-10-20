// A gait held still for a picture (the side-by-sides of the traveller, issue #493: scripts/unity-compare/ views with a
// `gait`): his Animator set to one gait at one phase of its loop and kept there, frame after frame, whatever each side's
// clock does, so the page and an engine pose him alike. The rest of his frame (the feet on the ground, the arms, the hands,
// the thigh-lift keys) is the game's own, from that pose. engine/game.js pin() holds it in the engines; on the page
// scripts/design-qc/capture.mjs imports this file through its dev server.
//
//   holdGait(player, { gait: 'idle' | 'walk' | 'jog' | 'sprint', phase: 0..1 })   → true when held
//   releaseGait(player)                                                       his Animator his own again

const GAITS = ['idle', 'walk', 'jog', 'sprint'];

/** The Animator's state for a held gait: that loop's weight 1, the others 0, the shared phase (and the idle's time) fixed. */
function pose(a, gait, phase) {
  for (const k in a.w) a.w[k] = k === gait ? 1 : 0;
  a.phase = phase;
  a.idleT = 0;
  a.landT = undefined;
  const idle = a.actions?.idle, clip = a.clips?.idle;
  if (idle && clip) idle.time = phase * clip.duration;
}

export function holdGait(player, { gait = 'jog', phase = 0.25 } = {}) {
  const a = player?.animator ?? player?._animator;
  if (!a || !GAITS.includes(gait)) return false;
  const N = a.lib?.native ?? {};
  // (the loop's own ground speed: the feet's sweep and contacts read as at that gait; idle 0)
  const speed = gait === 'idle' ? 0 : N[gait] ?? 0;
  const own = a.__ownUpdate ?? a.update;
  a.__ownUpdate = own;
  pose(a, gait, phase);
  // (no time passes in the Animator: dt 0, so its weights, phase and loops stay where they are put)
  a.update = function (dt, s) {
    pose(this, gait, phase);
    return own.call(this, 0, { ...s, speed, onGround: true, mode: 'ground', steering: false, reverse: false, jump: null });
  };
  return true;
}

export function releaseGait(player) {
  const a = player?.animator ?? player?._animator;
  if (!a?.__ownUpdate) return;
  a.update = a.__ownUpdate;
  delete a.__ownUpdate;
}
