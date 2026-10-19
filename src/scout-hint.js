// After the first conversation, one line on how to find the next quest (issue #151): the scout's button
// (Q, D-pad →, the touch ping: src/scout.js) sends the drone to it. Said once a save (flag
// teach.scout), the first time a conversation ends where the scout can fly and has somewhere to go; a ping
// before that counts as learnt, so a player who found it alone is never told. A teaching line (src/hint-level.js
// 'teach': hints subtle or full, never off). Apart from the drone's own lines (src/drone.js, src/temples/hints.js):
// this is the game's prompt, on the cue at the bottom of the screen like the first steps' (main.js: the toasts at
// the top are the new quest's just then), in the input in hand (src/prompt-keys.js {key:scout}: Q, D-pad →, ping; the
// cue badges D-pad →, native-pad.js prints a handheld's own name).
//
//   const hint = installScoutHint({ game, usable: () => …, show: () => { /* put scoutHintLine() up */ } })
//   hint.pinged()                       // the player sent the scout (Q, D-pad →): learnt, never said

import { hintsFor, hintLevel } from './hint-level.js';
import { keyText } from './prompt-keys.js';
import { t } from './i18n.js';

export const SCOUT_TAUGHT = 'teach.scout';
/** Seconds after the conversation closes: the camera back behind you first. */
export const SCOUT_HINT_DELAY = 1.2;
/** Seconds it stays on the cue (counted while it shows). */
export const SCOUT_HINT_SHOW = 6;

/** The line, for the input in hand (kind: 'keys' | 'pad' | 'touch'; default: what is in hand now). */
export const scoutHintLine = (kind) => keyText(t('teach.scout'), { kind, teach: true });

/** Whether the line is due now (pure): never said, a place the scout works, hints not off. */
export const scoutHintDue = (state, { usable = true, level = hintLevel() } = {}) =>
  !!usable && !state.flag(SCOUT_TAUGHT) && hintsFor('teach', level);

/**
 * Listens for the end of each conversation (game 'dialogue:end') and says the line once.
 * @param o.game    the save (flag, set, on)
 * @param o.usable  () => whether the scout can go somewhere from here now (not on the ship, not in a game, a goal to find)
 * @param o.show    (line) => put it on the screen (main.js: the cue, scoutHintLine() each frame: the input in hand as it is then)
 * @param o.level   () => the hint level (default src/hint-level.js's)
 * @param o.later   (fn, ms) => schedule (default setTimeout)
 */
export function installScoutHint({ game, usable = () => true, show, level = hintLevel, later = (fn, ms) => setTimeout(fn, ms), delay = SCOUT_HINT_DELAY }) {
  const off = game.on('dialogue:end', () => {
    if (!scoutHintDue(game, { usable: usable(), level: level() })) return;
    game.set(SCOUT_TAUGHT, true);   // (said once: it counts as taught, saved with the game)
    later(() => show(scoutHintLine()), delay * 1000);
  });
  return {
    pinged() { if (!game.flag(SCOUT_TAUGHT)) game.set(SCOUT_TAUGHT, true); },
    off,
  };
}

// Plumb's talk (issue #543): the first time Plumb comes to your shoulder with something to tell you (its mark over it),
// one line on the cue that the same button hears it, once a save (flag teach.plumb; hints subtle or full).
export const PLUMB_TAUGHT = 'teach.plumb';
/** The line, for the input in hand ("D-pad → talks to Plumb"). */
export const plumbHintLine = (kind) => keyText(t('teach.plumb'), { kind, teach: true });
/** Whether to say it now (and it counts as said): never said, hints not off. */
export function plumbHintDue(state, level = hintLevel()) {
  if (state.flag(PLUMB_TAUGHT) || !hintsFor('teach', level)) return false;
  state.set(PLUMB_TAUGHT, true);
  return true;
}
