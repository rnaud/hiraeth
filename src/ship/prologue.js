// The opening, as a small state machine of timed stages. It knows nothing
// about drawing: a director (src/ship/cinematics.js) is told when each stage
// starts and is asked to draw each frame. The tests drive it with a stub
// director and fake time.
//
//   black   → the screen is dark, the ship hums
//   wake    → eyes open in bed, the ceiling overhead
//   rise    → standing beside the bunk
//   walk    → you walk to the cockpit, in your own time (the voicemail button
//             blinks on the dash; nothing walks you there) and press it
//   call    → the father's message, over the dash; the singing light's theme comes nearer under it
//             (src/story/light-theme.js)
//   pause   → he pauses the recording, mid-word, to listen: the theme alone, from outside
//   pass    → the singing light passes the ship, close, singing (its glyph brushed onto the hull)
//   drain   → the power goes with it: the lamps, the core, the screen; the planet swings up
//   glide   → outside, over the desert: the dark ship glides down, no fire, on its last reserve
//   land    → a hard landing on its belly, a short skid through the dunes (a landing, not a crash)
//   settle  → the dust clears
//   hatch   → the hatch opens, the ramp comes down
//   stepout → the traveller walks out
//   objective → "Find a new source of power."
//
// Hold Esc (or B on a pad) to skip; Menu / Start pauses it. `prologue.done` is set at the end.

import { PROLOGUE_CALL } from '../story/calls.js';

/** Seconds a subtitle stays up. */
export const lineTime = (line) => Math.min(6.2, 1.4 + line.text.length * 0.052);

export function callTimeline(lines) {
  let t = 0.9;   // the picture tunes in first
  const out = [];
  for (const l of lines) {
    const d = l.cut ? lineTime(l) * 0.55 : lineTime(l);
    out.push({ line: l, t0: t, t1: t + d });
    t += d + (l.cut ? 0 : 0.35);
  }
  return { lines: out, total: t };
}

/**
 * The pause (s): he stops the recording and listens; the theme is sung alone `at` s in (after the click and a breath).
 */
export const PAUSE = 7.2;
export const PAUSE_THEME_AT = 0.9;
/** The opening's story beats, in the order they play (tests/prologue-call.test.js). */
export const OPENING_ORDER = ['call', 'pause', 'pass', 'drain', 'glide', 'land'];

export const PROLOGUE_STAGES = [
  { id: 'black', dur: 1.6 },
  { id: 'wake', dur: 7.2 },
  { id: 'rise', dur: 1.1 },
  { id: 'walk', until: true, dur: Infinity, play: true },   // as long as you like: it ends with the voicemail button
  { id: 'call', dur: callTimeline(PROLOGUE_CALL).total },
  { id: 'pause', dur: PAUSE },
  { id: 'pass', dur: 5.4 },
  { id: 'drain', dur: 4.8 },
  { id: 'glide', dur: 5.2 },
  { id: 'land', dur: 3.6 },
  { id: 'settle', dur: 3.6 },
  { id: 'hatch', dur: 3.4 },
  { id: 'stepout', until: true, dur: 9, play: true },
  { id: 'objective', dur: 1.4 },
];

export const SKIP_HOLD = 0.9;

/**
 * The walk teaches by the room (the dash's blinking button, its chime, the use prompt at the console),
 * and says one quiet line only if that wasn't enough: `after` s into the walk with the message
 * unplayed, for `show` s, once (docs/systems/ui.md, "Nothing on the screen").
 */
export const NUDGE = { after: 20, show: 6 };
/**
 * The nudge's line: how to move and look (with the input in your hands: src/prompt-keys.js verbKey)
 * if you haven't moved yet, else where the message is. `keys(verb)` names a verb's input.
 */
export function nudgeText({ moved, keys }) {
  if (!moved) return `Look around: move with ${keys('move')}, look with ${keys('look')}`;
  return 'A message blinks on the cockpit dash, at the front of the ship';
}
/** Whether the nudge shows at time t of the walk (s), and if it has shown already, it stays gone. */
export const nudgeDue = (t, { played = false, shown = false } = {}) => !played && !shown && t >= NUDGE.after;

export class Prologue {
  /**
   * @param o { director: { enter(id), frame(id, t, dt), ready?(id, t) -> bool, finish(skipped) },
   *            game (GameState), stages }
   */
  constructor({ director, game, stages = PROLOGUE_STAGES }) {
    this.director = director;
    this.game = game;
    this.stages = stages;
    this.i = -1;
    this.t = 0;
    this.skipT = 0;
    this.done = false;
    this.skipped = false;
  }

  get stage() { return this.stages[this.i]?.id ?? null; }
  get active() { return this.i >= 0 && !this.done; }
  /** The player has control in this stage (the walk to the cockpit). */
  interactive() { return !!this.stages[this.i]?.play && this.active; }
  /** E pressed while the player has control (the voicemail button, in the walk). */
  use() { if (this.interactive()) this.director.use?.(this.stage); }
  /** What E does right now, for the HUD (or null). */
  prompt() { return this.interactive() ? this.director.prompt?.(this.stage) ?? null : null; }
  /** The ship whose voicemail button blinks (or null). */
  waiting() { return this.active ? this.director.waiting?.(this.stage) ?? null : null; }

  start() {
    this.i = -1;
    this.done = false;
    this.next();
  }

  next() {
    this.i++;
    this.t = 0;
    if (this.i >= this.stages.length) return this.finish(false);
    this.director.enter(this.stage);
  }

  /** @param skipHeld  is the skip button held this frame */
  update(dt, skipHeld = false) {
    if (!this.active) return;
    this.skipT = skipHeld ? this.skipT + dt : 0;
    if (this.skipT >= SKIP_HOLD) return this.finish(true);
    this.t += dt;
    const s = this.stages[this.i];
    this.director.frame(s.id, this.t, dt);
    if (this.done) return;
    // stages with `until` end when the director says so (or after their dur as a safety net, if they have one)
    if ((s.until && this.director.ready?.(s.id, this.t)) || this.t >= s.dur) this.next();
  }

  finish(skipped) {
    if (this.done) return;
    this.done = true;
    this.skipped = skipped;
    this.director.finish(skipped);
    this.game.set('prologue.done', true);
  }
}
