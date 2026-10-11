// The title screen's first paint (issue #110): the shot's world as a vector drawing (public/title-vectors/<id>.svg,
// traced from the game's own render of it: scripts/title-vectors.mjs), flat colour and ink, with the name lettered
// over it, put on the screen the moment the page's script runs: no world, no WebGL, no three.js, nothing of the
// game. src/boot.js calls it first; src/title.js adds the menu to the same screen once it has loaded, and the game
// loads behind it (src/title-hold.js).
//
// Light: the drawing is one small file (35-180 kB, a quarter of that compressed), shown as an image; until it is in,
// the cover's paper. The singing light crosses its sky now and then (CSS, menus.css: off with reduced motion).
//
// Imports only what is pure and small: the shots, the lettering, the layout and the slots' summaries (for the shot's
// choice: the worlds the saves are in come more often).

import { logoSvg } from './title-logo.js';
import { chooseShot } from './title-shots.js';
import { titleLayout, layoutVars } from './title-layout.js';
import { slots } from './save-slots.js';

/** The shot's drawing (relative to the page, as the saves' thumbnails). */
export const vectorUrl = (shot) => `title-vectors/${shot.id}.svg`;

/** The name: HIRAETH in ivory block capitals, an ink line and a vermilion shadow (src/title-logo.js). */
export const LOGO = logoSvg();

/** The safe-area insets (a phone's notch and rounded corners), read off a probe, in CSS px. */
export function safeInsets(doc, win) {
  const el = doc.createElement('div');
  el.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  doc.body.appendChild(el);
  const cs = win.getComputedStyle?.(el);
  const v = (k) => parseFloat(cs?.[k]) || 0;
  const out = { top: v('paddingTop'), right: v('paddingRight'), bottom: v('paddingBottom'), left: v('paddingLeft') };
  el.remove();
  return out;
}

/**
 * Put the title on the screen: the drawing (or the paper until it loads) and the name, placed as the menu will
 * place it. @returns {{ root, shot, timing }} timing: { start, painted (the first frame with it), picture (the
 * drawing's first frame) } in the page's ms; src/title.js takes the same root over.
 */
export function paintTitle({ doc = document, win = window, store = slots, shot = undefined } = {}) {
  const now = () => win.performance?.now?.() ?? Date.now();
  const timing = { start: now(), painted: null, picture: null, shot: null };
  let ls = null;
  try { ls = win.localStorage; } catch { /* private mode */ }
  // (a different world each opening, never the last one shown: src/title-shots.js)
  shot ??= chooseShot({ storage: ls, search: win.location?.search ?? '', saves: (() => { try { return store.list(); } catch { return []; } })() });
  timing.shot = shot?.id ?? null;
  const root = doc.createElement('div');
  root.id = 'title';
  root.className = 'art-wait';
  root.dataset.screen = 'main';
  if (shot) root.dataset.shot = shot.id;
  root.innerHTML = `<img class="art" alt="" aria-hidden="true" decoding="async"><div class="paper" aria-hidden="true"></div><div class="print" aria-hidden="true"></div>
    <div class="light" aria-hidden="true"><i></i></div>
    <div class="front"><header>${LOGO}</header></div>`;
  const raf = (f) => (win.requestAnimationFrame ? win.requestAnimationFrame(f) : setTimeout(f, 16));
  const art = root.querySelector('img.art');
  if (shot) {
    art.onload = () => { root.classList.replace('art-wait', 'art-on'); raf(() => { timing.picture = now(); }); };
    art.onerror = () => { art.remove(); root.classList.add('art-none'); };   // (the paper, and the drawn land: src/title.js)
    art.src = vectorUrl(shot);
  } else art.remove();
  doc.body.appendChild(root);
  // the name where the menu will want it (two entries, the tools' row: src/title.js lays it out again with its own)
  const L = titleLayout({ w: win.innerWidth, h: win.innerHeight, buttons: 2, icons: 3, safe: safeInsets(doc, win), at: shot?.menu });
  for (const [k, v] of Object.entries(layoutVars(L))) root.style.setProperty(k, v);
  root.dataset.layout = L.mode;
  for (const g of root.querySelectorAll('header .logo g[stroke-width]')) g.setAttribute('stroke-width', L.ink.toFixed(1));
  raf(() => { timing.painted = now(); });
  return { root, shot, timing };
}
