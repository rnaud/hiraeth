// Hints: off / subtle (the default) / full, the settings' "Hints" (src/ui.js; docs/systems/hints.md).
// The game teaches by its world; the screen says as little as it can. Every kind of help the game
// gives on request goes through here. Automatic advice remains off at every level:
//
//   teach      the first prompt for a genuinely new verb, once (the camera, the potion, the blade's
//              first fight, a new tool's card)                          off: no   subtle: yes  full: yes
//   words      the use prompt's sentence ("talk to Ilen"); its button glyph shows at every level
//                                                                       off: no   subtle: no   full: yes
//   keys       a control named in a line outside the teaching moments ({key:verb} in a toast, a quest
//              step, a conversation: quietKeys takes it out)            off: no   subtle: no   full: yes
//   tip        explanations after the fact, how to beat a foe, a tip said again after a failure
//                                                                       off: no   subtle: no   full: yes
//   objective  the optional gold column over the quest goal (not an advice card)
//                                                                       off: no   subtle: no   full: yes
//   nudge      a line after idling or wandering                         off: no   subtle: no   full: yes
//   puzzle     the drone's hints in a guardian's fight, asked for (Q, D-pad →): subtle opens them one by one
//              after a struggle (STRUGGLE), full at once, off never
//
// The scout's ping (the objective, on request) and the Controls page are not hints: they stay at
// every level.
//
//   import { hintsFor, quietOr, quietKeys } from './hint-level.js';
//   if (hintsFor('tip')) toast('…');            toast(quietOr('The crates rock.', 'The crates rock. Shove them.'));

export const HINT_LEVELS = ['off', 'subtle', 'full'];
export const DEFAULT_HINTS = 'subtle';

let level = DEFAULT_HINTS;
/** The hint level now ('off' | 'subtle' | 'full'). */
export const hintLevel = () => level;
/** Set the level (src/ui.js applyAccess, from the settings); an unknown value is the default. Returns it. */
export function setHintLevel(v) { level = HINT_LEVELS.includes(v) ? v : DEFAULT_HINTS; return level; }

/** What each kind of hint does at each level. */
export const HINT_POLICY = {
  teach: { off: false, subtle: true, full: true },
  words: { off: false, subtle: false, full: true },
  keys: { off: false, subtle: false, full: true },
  tip: { off: false, subtle: false, full: false },
  objective: { off: false, subtle: false, full: true },
  nudge: { off: false, subtle: false, full: false },
  puzzle: { off: false, subtle: true, full: true },
};

/** Whether a kind of hint shows at this level (an unknown kind always does). */
export const hintsFor = (kind, lv = level) => HINT_POLICY[kind]?.[lv] ?? true;
/** The text when tips show (full), else '' (a toast skips an empty line). */
export const tip = (text, lv = level) => (hintsFor('tip', lv) ? text : '');
/** Automatic feedback says what happened, without appending advice at any hint level. */
export const quietOr = (quiet, plain, lv = level) => quiet;

/**
 * A guardian's fight (src/temples/hints.js): how many of the drone's lines for this phase are open after
 * `secs` in it. Full: all three at once; subtle: the nudge after STRUGGLE[0] s, plainer after [1], plainest
 * after [2]; off: none.
 */
export const STRUGGLE = [40, 100, 180];
export function hintLinesOpen(secs, lv = level) {
  if (lv === 'full') return Infinity;
  if (lv === 'off') return 0;
  return STRUGGLE.filter((s) => secs >= s).length;
}

/**
 * A line without the controls it names, for the levels that don't spell them out (keys: src/prompt-keys.js
 * keyText). Sentence by sentence, each naming a control ({key:verb}):
 *   - a parenthesis naming one goes: "Open your wings (hold {key:jump} as you fall)" → "Open your wings";
 *   - after a colon or a semicolon, the clause goes: "Wash it: aim with {key:aim}, fire with {key:fire}." → "Wash it.";
 *   - "… with {key:call}" after three words or more goes: "Whistle for the skiff with {key:call}, out in the open."
 *     → "Whistle for the skiff, out in the open.";
 *   - anything else naming a control ("Aim with {key:aim}, fire with {key:fire}.", "{key:whistle} plays it back.") goes.
 */
export function quietKeys(text) {
  let s = String(text ?? '');
  if (!s.includes('{key:')) return s;
  const tone = /^~[a-z]+~\s*/.exec(s)?.[0] ?? '';   // (a line's tone stays in front: src/story/tone.js)
  s = s.slice(tone.length).replace(/\s*\([^()]*\{key:[^()]*\)/g, '');
  const out = [];
  for (const sentence of s.split(/(?<=[.!?…])\s+/)) {
    if (!sentence.includes('{key:')) { out.push(sentence); continue; }
    const end = /[.!?…]$/.test(sentence) ? '.' : '';
    const k = sentence.indexOf('{key:');
    const head = sentence.slice(0, k);
    const cut = Math.max(head.lastIndexOf(': '), head.lastIndexOf('; '));
    let p = cut > 0 ? sentence.slice(0, cut).trimEnd() + end : sentence;
    if (p.includes('{key:')) {
      p = p.replace(/(\S+(?:\s+\S+){2,}?)\s+(?:with|using)\s+\{key:\w+\}(?:\s+or\s+\{key:\w+\})?/g, (m, before) => (before.split(/\s+/).length >= 3 ? before : m));
      if (p.includes('{key:')) continue;
    }
    if (p.replace(/[.\s]/g, '')) out.push(p);
  }
  return tone + out.join(' ').trim();
}
