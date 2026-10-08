// Buttons in prompts, drawn as small round badges (index.html .key): the
// floating "use" prompt (src/story/index.js placePrompt) and the cue's
// prompts at the bottom of the screen (src/hud.js).
//
// The badge holds the button's name as plain text ("E", "X / □"), so
// native-pad.js, which rewrites text nodes, still turns it into the
// handheld's own letter ("X") and swaps A and B when asked.

import { backKey } from './native-pad.js';
import { PAD } from './bindings.js';
import { verbKey as remapKey, verbButton } from './remap.js';
import { t } from './i18n.js';

/** What the player holds now: 'pad' (a controller is in use), 'touch', or 'keys' (the body's classes: main.js, ui.js). */
export function inputKind(doc = typeof document !== 'undefined' ? document : null) {
  const b = doc?.body?.classList;
  if (b?.contains?.('controller')) return 'pad';
  if (b?.contains?.('touch')) return 'touch';
  return 'keys';
}

/**
 * A panel's "how to close it", for the hands on the game: the keyboard's keys ("J or Esc to close"),
 * the pad's back button ("B / ○ close": native-pad.js prints it as the pad does), nothing on a touch
 * screen (its ✕ button says it).
 */
export function closeHint(keys, kind = inputKind(), back = backKey()) {
  if (kind === 'pad') return t('hint.close', { key: back });
  if (kind === 'touch') return '';
  return t('hint.toClose', { keys });
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** One button as a round badge. */
export const keyBadge = (label) => `<b class="key">${escapeHtml(label)}</b>`;

// a button name at the start of a prompt: "E go aboard", "B / ○ step outside", "A / × …", "SPACE hop", "W/S throttle"
// (as a badge, native-pad.js renames it to the player's own key or button: src/remap.js)
const LEAD = /^(E|SPACE|SHIFT|[WASD]\/[WASD]|X \/ □|A \/ ×|B \/ ○|Y \/ △|RT \/ R2|LT \/ L2|RB \/ R1|LB \/ L1|L3|R3|D-pad [↑↓←→]) (?=\S)/;

/**
 * A status line as HTML: every " · "-separated part that starts with a
 * button name gets that name as a badge; the rest stays plain (escaped) text.
 */
export function badgeLine(text) {
  return String(text ?? '').split('\n').map((line) => line.split(' · ').map((part) => {
    if (part.startsWith('✦ ')) return `<span class="charge">${escapeHtml(part)}</span>`;   // the father's charge, in its own gold (src/story/charge.js)
    const m = part.match(LEAD);
    return m ? keyBadge(m[1]) + ' ' + escapeHtml(part.slice(m[0].length)) : escapeHtml(part);
  }).join(' · ')).join('\n');
}

// ---- a verb's button, for the hands on the game
// Prompts that teach (the ship's nudge, the desert's first steps, the tank's first fill) name the
// verb's input as the player holds it: the keyboard's keys, the pad's buttons in Xbox / PlayStation
// form (src/bindings.js PAD; native-pad.js prints them as a handheld does), or the touch buttons.
// (the keys and buttons the player chose, src/remap.js: asked each time, so a rebinding shows at once)
const VERB_KEYS = {
  keys: { move: () => ['forward', 'left', 'back', 'right'].map(remapKey).join(''), look: 'the mouse', jump: () => remapKey('jump'), interact: () => remapKey('interact'),
    aim: () => `${remapKey('aim')} or the right mouse button`, fire: () => `${remapKey('fire')} or a left click`, mode: () => remapKey('mode') },
  pad: { move: 'the left stick', look: 'the right stick', jump: () => verbButton('jump'), interact: () => verbButton('interact'), aim: () => verbButton('aim'), fire: () => verbButton('fire'), mode: PAD.mode },
  touch: { move: 'the stick on the left', look: 'a drag on the right', jump: '⤒', interact: 'E', aim: '◎', fire: '✺', mode: '◐' },
};
/** The input for a verb (move, look, jump, interact, aim, fire, mode) on this kind of input. */
export const verbKey = (verb, kind = inputKind()) => {
  const k = VERB_KEYS[kind]?.[verb] ?? VERB_KEYS.keys[verb] ?? verb;
  return typeof k === 'function' ? k() : k;
};
