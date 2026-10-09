// Buttons in prompts, drawn as small round badges (index.html .key): the
// floating "use" prompt (src/story/index.js placePrompt) and the cue's
// prompts at the bottom of the screen (src/hud.js).
//
// The badge holds the button's name as plain text ("E", "X / □"), so
// native-pad.js, which rewrites text nodes, still turns it into the
// handheld's own letter ("X") and swaps A and B when asked.

import { backKey } from './native-pad.js';
import { STILL, AIMING } from './bindings.js';
import { verbKey as remapKey, verbButton, controlPrefs } from './remap.js';
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
    return m ? keyBadge(m[1]) + ' ' + keysHtml(part.slice(m[0].length)) : keysHtml(part);
  }).join(' · ')).join('\n');
}

// ---- a verb's button, for the hands on the game
// Prompts that teach (the ship's nudge, the desert's first steps, the tank's first fill) name the
// verb's input as the player holds it: the keyboard's keys, the pad's buttons in Xbox / PlayStation
// form (src/bindings.js PAD; native-pad.js prints them as a handheld does), or the touch buttons.
// (the keys and buttons the player chose, src/remap.js: asked each time, so a rebinding shows at once)
const VERB_KEYS = {
  keys: { move: () => ['forward', 'left', 'back', 'right'].map(remapKey).join(''), look: 'the mouse', jump: () => remapKey('jump'), interact: () => remapKey('interact'),
    aim: () => `${remapKey('aim')} or the right mouse button`, fire: () => `${remapKey('fire')} or a left click`, mode: () => remapKey('mode'),
    blade: () => `${remapKey('blade')} or a left click`, guard: () => remapKey('guard'), evade: () => remapKey('evade'), lock: () => remapKey('lock'),
    call: () => remapKey('interact'), gadget: () => remapKey('gadget'), run: () => remapKey('run'), scout: () => remapKey('scout'),
    whistle: () => remapKey('whistle'), thrust: () => `${remapKey('jump')} held in the air`, potion: () => remapKey('potion') },
  pad: { move: 'the left stick', look: 'the right stick', jump: () => verbButton('jump'), interact: () => verbButton('interact'), aim: () => verbButton('aim'), fire: () => verbButton('fire'),
    mode: () => verbButton('pick') + AIMING,   // (the gun mode: pick's button while aiming, or the wheel's inner ring)
    blade: () => verbButton('blade'), guard: () => verbButton('guard'), evade: () => verbButton('evade'), lock: () => verbButton('lock'),
    call: () => verbButton('run') + STILL, gadget: () => verbButton('gadget'), run: () => verbButton('run'), scout: () => verbButton('lock'),   // (call: run's button clicked standing still)
    whistle: () => `${verbButton('gadget')} with no gadget in hand`, thrust: () => verbButton('fire'), potion: () => verbButton('potion') },
  touch: { move: 'the stick on the left', look: 'a drag on the right', jump: '⤒', interact: 'E', aim: '◎', fire: '✺', mode: '◐',
    blade: '⚔', guard: '◇', evade: '↶', lock: '◉', call: 'E', gadget: '◆', run: 'run', scout: 'ping',
    whistle: '◆ with no gadget in hand', thrust: '⤒ held in the air', potion: 'the flask by your hearts' },
};
/**
 * The input for a verb (move, look, jump, interact, aim, fire, mode, blade, guard, evade, lock, call, gadget, whistle, thrust,
 * run, scout) on this kind of input; an unknown verb is its own word.
 */
export const verbKey = (verb, kind = inputKind()) => {
  const k = VERB_KEYS[kind]?.[verb] ?? VERB_KEYS.keys[verb] ?? verb;
  return typeof k === 'function' ? k() : k;
};

// ---- keys in lines: {key:verb}
// Any text the player reads (dialogue, things, balloons, toasts, quest steps, item cards) may name a verb's
// input as {key:aim}, {key:fire}, {key:mode}… It is resolved as it is shown, by verbKey for the input in
// hand and the player's own keys and buttons: "R or the right mouse button", "LT / L2", "◎". As HTML it is a
// <kbd class="kp pad-raw">: the name is already the one bound (remap.js), so native-pad.js must not rename it
// again, but it still prints a handheld's own letters (padText). The voice skips it (voice.js spokenMask),
// the translator's scripts leave it as it is (scripts.js lineChunks), and i18n's t() keeps it (its {names}
// are word characters only). An unknown verb shows as its own word. {glyph} and the other motifs are apart.

/** Plain text as HTML, escaped, its {key:verb}s as the player's own keys or buttons. */
export const keysHtml = (text) => keyText(escapeHtml(text), { html: true });

/** A key placeholder: {key:verb}. */
export const KEY_TOKEN = /\{key:([A-Za-z]+)\}/g;
/** Whether a text holds a key placeholder. */
export const hasKeys = (text) => typeof text === 'string' && text.includes('{key:');

/**
 * A text with its {key:verb} placeholders resolved for the input in hand (o.kind: 'keys' | 'pad' | 'touch').
 * o.html: each as a <kbd class="kp pad-raw"> (only the names are escaped: escape the rest first).
 */
export function keyText(text, { kind = inputKind(), html = false } = {}) {
  const s = String(text ?? '');
  if (!hasKeys(s)) return s;
  return s.replace(KEY_TOKEN, (m, verb) => {
    const w = verbKey(verb, kind);
    return html ? `<kbd class="kp pad-raw">${escapeHtml(w)}</kbd>` : w;
  });
}

let prefsSeen = null, prefsRev = 0;
/** What the placeholders resolve against now (the input in hand, the player's bindings): a text showing them is drawn again when it changes. */
export function keySig(kind = inputKind()) {
  const p = controlPrefs();
  if (p !== prefsSeen) { prefsSeen = p; prefsRev++; }
  return `${kind}:${prefsRev}`;
}
