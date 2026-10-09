// Button glyphs inside the menus' buttons (October 2026, the author's call): a small "A" in the
// confirm button, "B" in Back, LB / RB on the tabs either side, instead of a line of hints under them;
// and drawn for the controller in hand (src/native-pad.js padFamily): Xbox A B X Y, PlayStation × ○ □ △,
// a Switch pad's own letters (B at the bottom, A on the right), a handheld's (the Android app, a
// Retroid: native-pad.js padText), or the keyboard's key (Enter, Esc) when no pad is in use. Nothing on
// a touch screen: the buttons are tapped.
//
//   glyph('back')                      <span class="glyph" data-glyph="back"></span> inside a button
//   glyph('ok', { focus: true })       shown only while its button has the focus (the button A presses)
//   glyph('lb', { key: 'Q' })          the keyboard's key for it on this screen (default: GLYPH_KEYS)
//   installGlyphs(win)                 once per page: the labels follow the pad (connected, gone, the setting)
//
// A glyph holds no text: its label is CSS (a custom property per role on :root, set from the pad's
// family), so a menu drawn again keeps it, native-pad.js never rewrites it, and the screen readers
// skip it (aria-hidden): the button's own words say what it does.
//
// Roles are named by position as the prompts are (Xbox / PlayStation form): 'ok' and 'back' are the
// menus' confirm and back buttons, printed A and B whatever the layout (native-pad.js confirmKey).

import { padText, labelState, onLabels, padFaces, padLayout, padFamily } from './native-pad.js';

/** The roles, and the prompt each stands for (Xbox / PlayStation form; ok / back depend on the faces). */
export const GLYPH_ROLES = {
  ok: null, back: null, x: 'X / □', y: 'Y / △', lb: 'LB / L1', rb: 'RB / R1', lt: 'LT / L2', rt: 'RT / R2',
  view: 'View', menu: 'Menu', l3: 'L3', r3: 'R3', dpad: 'D-pad', lr: 'LB / RB',
};
/** The keyboard's key for a role, unless the glyph names its own (data-key). */
export const GLYPH_KEYS = { ok: 'Enter', back: 'Esc', lb: 'Q', rb: 'E', dpad: '← →' };

const VIEW_MENU = { xbox: ['View', 'Menu'], playstation: ['Create', 'Options'], nintendo: ['−', '+'], handheld: ['Select', 'Start'] };
// each face button's own colour, where the pad has one (by what is printed on it)
const COLOURS = {
  xbox: { A: '#4f9a3c', B: '#c8483a', X: '#2f6fb5', Y: '#c9961a' },
  playstation: { '×': '#5b7fc7', '○': '#d0504a', '□': '#c76aa8', '△': '#2f9a85' },
};

/**
 * The label of each role for a controller (pure): { role: { text, colour, round } }.
 * @param o.family 'xbox' | 'playstation' | 'nintendo' | 'handheld' ('' : as Xbox)
 * @param o.faces  'xbox' | 'nintendo' (where printed A is: native-pad.js padFaces)
 * @param o.layout 'standard' | 'android'
 */
export function padGlyphs({ family = '', faces = 'xbox', layout = 'standard' } = {}) {
  const fam = layout === 'android' ? 'handheld' : family || 'xbox';
  const okName = faces === 'nintendo' ? 'B / ○' : 'A / ×', backName = faces === 'nintendo' ? 'A / ×' : 'B / ○';
  const out = {};
  for (const [role, name] of Object.entries(GLYPH_ROLES)) {
    let text;
    if (role === 'view' || role === 'menu') text = VIEW_MENU[fam][role === 'view' ? 0 : 1];
    else {
      const src = role === 'ok' ? okName : role === 'back' ? backName : name;
      text = fam === 'handheld' ? padText(src, 'android', faces) : padText(src, 'standard', faces, fam);
    }
    if (role === 'dpad') text = '✚';
    const round = ['ok', 'back', 'x', 'y'].includes(role);
    out[role] = { text, colour: COLOURS[fam]?.[text] ?? '', round, scale: /^[×○□△]$/.test(text) ? 1.3 : 1 };   // (the shapes are small letters)
  }
  return out;
}

const cssString = (s) => `"${String(s).replace(/["\\]/g, '\\$&')}"`;

/** The custom properties for a controller's labels (pure): "--g-ok: "A"; --gc-ok: #4f9a3c; …". */
export function glyphVars(labels) {
  return Object.entries(labels).map(([role, l]) => `--g-${role}: ${cssString(l.text)}; --gc-${role}: ${l.colour || 'var(--glyph-ink)'}; --gz-${role}: ${l.scale ?? 1}em;`).join(' ');
}

/** A glyph to put inside a button (see the top). */
export function glyph(role, { focus = false, key = null } = {}) {
  const k = key ?? null;
  return `<span class="glyph${focus ? ' on-focus' : ''}" data-glyph="${role}"${k != null ? ` data-key="${String(k).replace(/"/g, '&quot;')}"` : ''} aria-hidden="true"></span>`;
}

/** The page's style for the glyphs (pure: the tests read it). */
export function glyphCss(roles = Object.keys(GLYPH_ROLES), keys = GLYPH_KEYS) {
  const rules = roles.map((r) => `body.controller .glyph[data-glyph="${r}"]::before { content: var(--g-${r}); font-size: var(--gz-${r}, 1em); }
body.controller .glyph[data-glyph="${r}"] { --gc: var(--gc-${r}); }
body:not(.controller) .glyph[data-glyph="${r}"]:not([data-key])::before { content: ${keys[r] ? cssString(keys[r]) : '""'}; }
${keys[r] ? '' : `body:not(.controller) .glyph[data-glyph="${r}"]:not([data-key]) { display: none; }`}`).join('\n');
  return `:root { --glyph-ink: #f7ecd2; }
.glyph { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; min-width: 1.7em; height: 1.7em;
  padding: 0 .4em; margin: 0 .5em 0 0; vertical-align: middle; border-radius: .3em; background: #2b211f; color: var(--gc, var(--glyph-ink));
  font: 700 max(10px, .68em)/1 ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0; text-transform: none; text-indent: 0;
  white-space: nowrap; flex: none; pointer-events: none; font-style: normal; }
.glyph.end { margin: 0 0 0 .5em; }
body.controller .glyph:is([data-glyph="ok"], [data-glyph="back"], [data-glyph="x"], [data-glyph="y"]) { border-radius: 50%; padding: 0; width: 1.7em; font-size: max(11px, .74em); }
body:not(.controller) .glyph { background: transparent; color: inherit; border: 1.5px solid currentColor; border-bottom-width: 3px; opacity: .8; font-weight: 600; }
body:not(.controller) .glyph[data-key]::before { content: attr(data-key); }
body.touch .glyph { display: none !important; }
/* the button A presses: the glyph only while it has the focus (a pad's), or the keys' focus ring */
body.controller .glyph.on-focus { visibility: hidden; }
body.controller :focus > .glyph.on-focus, body.controller :focus > * > .glyph.on-focus { visibility: visible; }
body:not(.controller) .glyph.on-focus { display: none; }
${rules}`;
}

let installed = null;
/** The labels for the pad on this page now (from native-pad.js's state, or worked out from the window). */
function currentLabels(win) {
  const st = labelState();
  const family = st.family || padFamily(win), faces = padFaces(win).faces, layout = padLayout(win);
  return padGlyphs({ family, faces, layout });
}

/** Once per page: the glyphs' style, and their labels kept up to date with the pad in hand. */
export function installGlyphs(win = globalThis.window) {
  const doc = win?.document;
  if (!doc?.head || installed === win) return;
  installed = win;
  const style = doc.createElement('style');
  style.id = 'pad-glyphs';
  style.textContent = glyphCss();
  doc.head.appendChild(style);
  const apply = () => {
    const st = doc.documentElement.style;
    for (const decl of glyphVars(currentLabels(win)).split(/;\s*/)) {
      const at = decl.indexOf(':');
      if (at > 0) st.setProperty(decl.slice(0, at).trim(), decl.slice(at + 1).trim());
    }
  };
  apply();
  onLabels(apply);
  win.addEventListener?.('gamepadconnected', apply);
  win.addEventListener?.('gamepaddisconnected', () => setTimeout(apply, 0));
}

/** (for prompts written as text, not glyphs) The confirm and back buttons as the pad in hand names them. */
export const okLabel = (win = globalThis.window) => currentLabels(win).ok.text;
export const backLabel = (win = globalThis.window) => currentLabels(win).back.text;
