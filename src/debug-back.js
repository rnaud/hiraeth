// The way back to the Debug menu (the title's Debug entry: the worlds list alone, ?worlds=1, src/boot.js)
// from every page and world it opens: a small "◀ Debug" button at the top left inside the safe area, in
// the pages' paper and ink, with the back button's glyph for the pad in hand (src/pad-glyphs.js), and
// B / Esc doing the same while nothing else on the page is open.
//
//   <body data-debug-back="…" data-debug-busy="#full.open">   options, space separated:
//     keys-off    Esc is the page's own (it already goes back, or means something else)
//     pad-off     B is the page's own (its Controller already goes back)
//     from-debug  only when the page was opened from the Debug menu (What's new is the players' too)
//     fade        fades out while the pointer is still (the trailer: nothing over the film)
//   data-debug-busy   a selector: while it matches, B / Esc are the page's (a viewer, a dialog open)
//   class="debug-room"  on the page's title: moved right of the button, not under it
//   <script type="module" src="/src/debug-back-page.js"></script>   installs it from those
//
// The game's own worlds opened from the Debug menu get the button alone (src/boot.js): B and Esc are
// the game's there.

import { glyph, installGlyphs } from './pad-glyphs.js';
import { padIndex } from './native-pad.js';

/** Where the button goes: the Debug menu (relative: the site's root on GitHub Pages and in the app alike). */
export const DEBUG_MENU_HREF = './?worlds=1';

/** The options from a page's data-debug-back value (pure). */
export function debugBackOptions(value = '') {
  const t = new Set(String(value ?? '').split(/\s+/).filter(Boolean));
  return { keys: !t.has('keys-off'), pad: !t.has('pad-off'), fromDebugOnly: t.has('from-debug'), fade: t.has('fade') };
}

/** Was this page opened from the Debug menu (the worlds list, or a page it opened)? (pure: the referrer and the query) */
export function cameFromDebug(referrer = '', search = '') {
  if (new URLSearchParams(search).get('from') === 'debug') return true;
  try {
    const u = new URL(referrer);
    return u.searchParams.get('worlds') === '1' || /(motion|studio|items|enemies|cinematics|trailer|audits)\.html$/.test(u.pathname);
  } catch { return false; }
}

/** The button (pure: the tests read it). */
export function debugBackHtml(href = DEBUG_MENU_HREF) {
  return `<a class="debug-back" href="${href}" title="Back to the Debug menu (B / Esc)" aria-label="Back to the Debug menu">${glyph('back')}<span class="arrow" aria-hidden="true">◀</span> Debug</a>`;
}

/** Its style: small, at the top left inside the safe area, paper and ink with the cards' offset shadow. */
export const DEBUG_BACK_CSS = `.debug-back { position: fixed; z-index: 2147483000;
  top: calc(env(safe-area-inset-top, 0px) + 8px); left: calc(env(safe-area-inset-left, 0px) + 8px);
  display: inline-flex; align-items: center; gap: 2px; padding: 3px 9px 3px 5px; box-sizing: border-box;
  background: #f6f1e4; color: #2b211f; border: 2px solid #2b211f; border-radius: 3px; box-shadow: 3px 3px 0 #2b211f;
  font: 700 11px/1.2 ui-monospace, Menlo, Consolas, monospace; letter-spacing: .14em; text-transform: uppercase;
  text-decoration: none; cursor: pointer; transition: opacity .4s, transform .08s; -webkit-tap-highlight-color: transparent; }
.debug-back:hover, .debug-back:focus-visible { background: #fffaf0; outline: none; }
.debug-back:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #2b211f; }
.debug-back .glyph { margin: 0 4px 0 0; font-size: 10px; }
.debug-back .arrow { font-size: 9px; margin-right: 5px; }
.debug-back.faded { opacity: 0; pointer-events: none; }
/* the page's title beside it (class="debug-room"), not under it */
body.has-debug-back .debug-room { padding-left: calc(env(safe-area-inset-left, 0px) + 112px) !important; }
body.has-debug-back span.debug-room { display: inline-block; }
@media print { .debug-back { display: none; } }`;

/**
 * Put the button on the page and wire B / Esc to it. Returns the button, or null where it doesn't belong
 * (from-debug pages opened otherwise, an embedded page).
 * @param o.keys   Esc goes back (false: the page's own)    o.pad: B on a controller goes back (false: the page's own)
 * @param o.busy   () => true while something on the page is open: B / Esc are the page's then
 * @param o.fade   fade out while the pointer is still
 * @param o.fromDebugOnly  only when opened from the Debug menu
 */
export function installDebugBack({ win = globalThis.window, keys = true, pad = true, busy = () => false, fade = false, fromDebugOnly = false, href = DEBUG_MENU_HREF } = {}) {
  const doc = win?.document;
  if (!doc?.body || doc.querySelector('.debug-back')) return doc?.querySelector('.debug-back') ?? null;
  const search = win.location?.search ?? '';
  if (new URLSearchParams(search).get('embed') === '1' || win.self !== win.top) return null;   // (inside the game or another page)
  if (fromDebugOnly && !cameFromDebug(doc.referrer, search)) return null;
  installGlyphs(win);
  const style = doc.createElement('style');
  style.id = 'debug-back-style';
  style.textContent = DEBUG_BACK_CSS;
  doc.head.appendChild(style);
  const holder = doc.createElement('div');
  holder.innerHTML = debugBackHtml(href);
  const button = holder.firstElementChild;
  doc.body.appendChild(button);
  doc.body.classList.add('has-debug-back');
  // (the glyph and the arrow follow what is in hand: a pad's B, the keys' Esc, a finger's arrow)
  const mark = (kind) => { const c = doc.body.classList; if (kind === 'pad') c.add('controller'); else if (kind === 'touch') c.add('touch'); };
  if (win.matchMedia?.('(pointer: coarse)').matches && !win.matchMedia?.('(pointer: fine)').matches) mark('touch');
  const go = () => { win.location.href = href; };
  // (Esc in a text box clears it or leaves it; a slider or a checkbox with the focus is not typing)
  const typing = (e) => (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? '') && !/^(checkbox|range|radio|button)$/.test(e.target.type)) || !!e.target?.isContentEditable;
  if (keys) {
    // (in the capture phase, before the page's own: a viewer the page closes on Esc is still open here)
    win.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || typing(e) || busy()) return;
      e.preventDefault();
      go();
    }, { capture: true });
  }
  if (fade) {
    let timer = 0;
    const wake = () => { button.classList.remove('faded'); clearTimeout(timer); timer = setTimeout(() => button.classList.add('faded'), 2500); };
    for (const ev of ['pointermove', 'pointerdown', 'keydown', 'touchstart']) win.addEventListener(ev, wake, { passive: true });
    wake();
  }
  if (pad && win.navigator?.getGamepads) {
    // B: pressed and let go here (one held down from the page before, or the button that opened this one, doesn't count)
    let armed = false, was = true;
    const poll = () => {
      const p = Array.from(win.navigator.getGamepads() ?? []).find((g) => g?.connected);
      if (p) {
        const down = !!p.buttons[padIndex('back', win)]?.pressed;
        if (p.buttons.some((b) => b?.pressed)) mark('pad');
        if (!down) armed = true;
        else if (armed && !was && !busy() && (doc.hasFocus?.() ?? true)) { go(); return; }
        was = down;
      } else was = false;
      win.requestAnimationFrame(poll);
    };
    win.requestAnimationFrame(poll);
  }
  return button;
}
