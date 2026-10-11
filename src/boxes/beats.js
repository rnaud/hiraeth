// The box opening's closing beat: after the card, a short moment that depends on what the box held
// (the cinematics QC pass: every box ended the same way, the item flying into his chest whatever it was).
//
//   try    a gadget, a gun mode: he tries it once (held out in his right hand, it fires a spray of light ahead of
//          him, a kick back, its sound). Only what shoots: the backpack and its parts came before the gun, and him
//          firing them read as shooting with nothing to shoot (the author's playthrough, issues #58 and #70)
//   none   the backpack: none (he wears it the moment the card goes: on his back, its tank as it is)
//   wear   a cosmetic (the pale star): he pins it on, and a close look at it worn
//   keep   a charm or a token: he turns it over in his hand, then pockets it (the act: the pocket)
//   fit    an upgrade for the tank, a part for the pack (the lift valve, the jets, the wings, the bellows), and the
//          Givers' blade and guard (onto his back, never swung or fired out of the chest): over his shoulder, a click
//   point  a finder (the glyph lens, the listening shell): held up, he turns toward where it points
//          (the nearest unopened box), a thread of light going that way, a faint answer
//   play   something that sounds (the bell-note whistle, the echo shell): to his lips, a few notes
//
// Each lasts BEATS[name].dur s (all ≤ MAX_BEAT), skips with Esc / B like the rest of the scene, and has a
// closing shot that keeps to the box's camera plan (closingShot: mirrored for 'left', swung round to
// his side for 'side', raised for 'high'). Pure data and arithmetic: scene.js plays them.
//
// Box-local coordinates as in scene.js: x his right, y up, z toward the camera side (he stands at
// z = STAND_AT facing -z, where the box was). `Z` below is STAND_AT.

/** The longest a closing beat may add (s). */
export const MAX_BEAT = 2;

/**
 * Each beat: its length, where the item is held (`hold`, metres from his feet: x his right, y up, z
 * behind him), where it ends up (`stow`: hidden there, or 'worn': hidden once pinned, where the real
 * thing shows on him), when the action happens (`act`, s from the start), and the hold's scale (a
 * fraction of the hovering item's). 'point' turns him toward where the item points: the shot turns too.
 */
export const BEATS = {
  try: { dur: 1.7, act: 0.75, hold: [0.24, 1.2, -0.45], stow: [0.05, 1.3, 0.24], scale: 0.42 },
  wear: { dur: 1.6, act: 0.55, hold: [-0.06, 1.47, -0.16], stow: 'worn', scale: 0.22 },
  keep: { dur: 1.6, act: 1.2, hold: [0.18, 1.18, -0.4], stow: [0.26, 0.96, -0.04], scale: 0.38 },
  fit: { dur: 1.5, act: 1.25, hold: [0.32, 1.7, 0.02], stow: [0, 1.3, 0.24], scale: 0.4 },
  point: { dur: 1.8, act: 0.6, hold: [0.2, 1.45, -0.32], stow: [0.26, 0.96, -0.04], scale: 0.38 },
  play: { dur: 1.8, act: 0.5, hold: [0.04, 1.56, -0.24], stow: [0.26, 0.96, -0.04], scale: 0.32 },
  none: { dur: 0, act: 0, hold: [0, 1.3, 0.24], stow: 'worn', scale: 1 },
};

/** The beat for each kind of item (src/items.js ITEMS[id].kind). */
export const KIND_BEATS = { core: 'none', weapon: 'fit', movement: 'fit', mode: 'try', gadget: 'try', cosmetic: 'wear', charm: 'keep', pass: 'keep', upgrade: 'fit' };
/** Items whose use is not their kind's: the finders point, the things that sound play. */
export const ITEM_BEATS = { lens: 'point', shell: 'point', bell: 'play', echo: 'play' };

/** The closing beat for an item: its own if it has one, else its kind's, else 'keep'. */
export function beatFor(id, def = null) {
  return def?.beat ?? ITEM_BEATS[id] ?? KIND_BEATS[def?.kind] ?? 'keep';
}

/**
 * The wobbles, per beat (the item asks for it): a gadget is eager, three quick rocks, the last the
 * biggest; a little keepsake or a tank part only two, gentler, and the box opens sooner (it pays
 * for the beat). Otherwise the three of scene.js (null).
 */
export const BEAT_WOBBLES = {
  try: { wobble: 2.5, list: [{ at: 0.15, dur: 0.42, amp: 0.24, dir: 1 }, { at: 0.9, dur: 0.42, amp: 0.27, dir: -1 }, { at: 1.6, dur: 0.5, amp: 0.33, dir: 1 }] },
  keep: { wobble: 2.0, list: [{ at: 0.25, dur: 0.55, amp: 0.2, dir: 1 }, { at: 1.15, dur: 0.5, amp: 0.23, dir: -1 }] },
  fit: { wobble: 2.0, list: [{ at: 0.2, dur: 0.5, amp: 0.22, dir: -1 }, { at: 1.1, dur: 0.5, amp: 0.26, dir: 1 }] },
};
/** The reveal's hold per plan (s): 'side' cuts to a new angle at the reveal, so it holds a little longer. */
export const PLAN_REVEAL = { side: 1.15 };

/**
 * The opening's timings for a plan and a beat: scene.js's TIMES with the wobble phase (and its
 * wobbles) and the reveal adjusted. Returns { times, wobbles }.
 */
export function timingFor(plan, beat, base) {
  const w = BEAT_WOBBLES[beat];
  const times = { ...base.times, ...(w ? { wobble: w.wobble } : {}), ...(PLAN_REVEAL[plan] ? { reveal: PLAN_REVEAL[plan] } : {}) };
  return { times, wobbles: w ? w.list : base.wobbles };
}

/**
 * Each beat's closing shot, for the plain plan ('shoulder'): the lens and the aim, box-local, with Z the
 * traveller's z; and the lens's field of view. 'point' turns with him (scene.js), seen from the side away from his turn.
 */
const SHOTS = {
  try: { pos: (Z) => [1.9, 1.45, Z - 1.55], look: (Z) => [0.1, 1.2, Z - 1.1], fov: 46 },
  wear: { pos: (Z) => [0.75, 1.55, Z - 1.35], look: (Z) => [-0.03, 1.42, Z], fov: 32 },
  keep: { pos: (Z) => [1.0, 1.5, Z - 1.5], look: (Z) => [0.12, 1.2, Z - 0.2], fov: 36 },
  fit: { pos: (Z) => [1.5, 1.75, Z + 1.9], look: (Z) => [0, 1.3, Z + 0.1], fov: 40 },
  point: { pos: (Z) => [-2.6, 1.55, Z - 0.3], look: (Z) => [0.3, 1.4, Z - 1.0], fov: 50 },   // (from his left, him in profile and the thread going off ahead: scene.js mirrors it for a turn to his left)
  play: { pos: (Z) => [1.1, 1.6, Z - 1.7], look: (Z) => [0.05, 1.45, Z - 0.1], fov: 36 },
};
const SIDE_SWING = 0.6;   // rad the 'side' plan swings the lens round toward his right (him more in profile; less from behind)

/**
 * The closing shot of a beat in a plan: { pos, look, fov } box-local ([x, y, z]). 'left' mirrors it
 * to his left; 'side' swings it round toward his side; 'high' lifts it and opens the lens a little.
 */
export function closingShot(beat, plan, Z) {
  const s = SHOTS[beat] ?? SHOTS.keep;
  let [x, y, z] = s.pos(Z);
  const look = s.look(Z);
  let fov = s.fov;
  if (plan === 'side') {
    // about his vertical axis (x = 0, z = Z), toward +x: a front shot turns into a profile
    const dz = z - Z, a = dz < 0 ? SIDE_SWING : -SIDE_SWING * 0.6, c = Math.cos(a), sn = Math.sin(a);
    [x, z] = [x * c - dz * sn, Z + x * sn + dz * c];
  }
  if (plan === 'high') { y += 0.7; fov += 4; }
  if (plan === 'left') { x = -x; look[0] = -look[0]; }
  return { pos: [x, y, z], look, fov };
}

/** Where the item is at u (0..1) of the beat, as blends: { toHold (0..1), toStow (0..1) }. */
export function beatPath(beat, t) {
  const b = BEATS[beat] ?? BEATS.keep, ease = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
  const stowAt = b.dur - (beat === 'wear' ? b.dur - b.act : 0.42);   // (worn: it is on him once the act is done)
  return { toHold: ease(t / 0.45), toStow: ease((t - stowAt) / (beat === 'wear' ? 0.12 : 0.36)) };
}
