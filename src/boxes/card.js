// The box-opening card, in the game's paper-and-ink UI. The item comes first (issue #82: on a handheld the card
// sat over the lift valve, its words above the thing you had just found): the card is a low strip along the foot
// of the screen, in the letterbox's bottom band and just over it (CARD_MAX_SHARE of the height, measured: the
// longest card, the Givers' blade's, on a handheld's 800 × 450), so the item the scene holds up stays clear above it; on it
// the name first and largest, then one line under it, what it does, its buttons inline (issue #329: no subtitle, nothing
// of what it is, itemLine(def) in src/items.js; the card no wider than CARD_MAX_CH of its words, centred, so it reads). Also the full-screen catcher for the scene (a click or tap dismisses the
// card) and a small "skip" button for touch. Built on demand, inert in node (no document). The scene and its card are the
// screen's state too (src/platform.js screen 'boxCard', cardState), which an engine draws where there is no page (issue
// #345: the Unity bridge's BridgeHud.cs).

import { keyText, inputKind } from '../prompt-keys.js';
import { glyph, GLYPH_KEYS } from '../pad-glyphs.js';
import { confirmKey, backKey } from '../native-pad.js';
import { screen } from '../platform.js';
import { t } from '../i18n.js';
import { stripTone } from '../story/tone.js';
import { itemLine } from '../items.js';
import { enamelCard, enamelStrip, en } from '../hud-look.js';   // the enamel look of every message (issue #687)

/** The card's widest (in ch of its words, issue #329: not the screen's width, a measure easy to read), centred. */
export const CARD_MAX_CH = 44;   // (the CSS below writes it out: tests/box-card.test.js)

const CSS = `
#boxscene { position: fixed; inset: 0; z-index: 8100; pointer-events: none; }
#boxscene.on { pointer-events: auto; cursor: default; }
#boxscene .skip { position: absolute; right: 18px; top: calc(11vh + 14px); font: var(--type-s) var(--face); letter-spacing: .08em;
  ${enamelStrip()} padding: 6px 12px; opacity: 0; transition: opacity .3s; pointer-events: none; }
#boxscene.on .skip { opacity: .85; pointer-events: auto; }
#boxscene.card .skip { opacity: 0; pointer-events: none; }
#boxcard { position: absolute; left: 50%; bottom: max(6px, calc(5.5vh - 34px)); width: max-content; max-width: min(44ch, calc(100vw - 24px)); box-sizing: border-box;
  transform: translate(-50%, 16px); opacity: 0; transition: opacity .35s, transform .45s cubic-bezier(.2,.9,.3,1.3); pointer-events: none;
  font: var(--type-s)/1.4 var(--face); ${enamelCard()} padding: 0.6em 1.2em; text-align: center; }
#boxscene.card #boxcard { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
#boxcard h2 { margin: 0; font: 900 1.75em/1.15 var(--face-title); letter-spacing: .04em; color: ${en('ink')}; }
#boxcard h2 .star { display: inline-block; width: 0.7em; height: 0.7em; margin-right: 0.35em; vertical-align: -1px; background: ${en('brass')};
  clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); }
#boxcard p.desc { margin: 4px 0 0; font-size: 1.08em; }
#boxcard p.desc kbd.kp { color: ${en('accent')}; }
#boxcard p { margin: 0; }
#boxcard p.found { font-size: 1.08em; margin: 4px 0 0; opacity: 1; }
#boxcard.found p.desc, #boxcard:not(.found) p.found { display: none; }
#boxcard .go, #boxscene .skip { display: inline-flex; align-items: center; }
#boxcard .go { font: 700 0.92em var(--face); letter-spacing: .08em; color: ${en('keyInk')}; background: ${en('ink')};
  border: 1px solid ${en('brass')}; border-radius: 5px; box-shadow: none; padding: 0.35em 0.9em; cursor: pointer; }
#boxcard .gorow { margin-top: 0.5em; }
#boxcard .go:focus { outline: 1.5px solid ${en('brass')}; outline-offset: 2px; }
@media (max-width: 640px) { #boxcard h2 { font-size: 1.5em; } #boxcard { padding: 6px 12px; } }
`;

/** The most of the screen's height a card takes (the longest, measured on 800 × 450): the item the scene holds up stays clear above it. */
export const CARD_MAX_SHARE = 0.34;
/**
 * The card as the screen's state (an engine draws it): the scene playing (its skip's button and word), and once the item
 * is out its name, its line (the found line, or what it does, its {key:verb} the input in hand's) and the button to go on.
 * The buttons in Xbox / PlayStation form with a pad (native-pad.js names them as the pad in hand prints them), else the keys.
 */
export function cardState({ def = null, found = null, hint = null, kind = inputKind() } = {}) {
  const pad = kind === 'pad';
  const out = { scene: true, back: pad ? backKey() : GLYPH_KEYS.back, skipLabel: t('box.skip') };
  if (!def) return out;
  return { ...out, card: true, name: def.name ?? '', text: found ? keyText(stripTone(t(found)), { kind, teach: true }) : keyText(itemLine(def), { kind, teach: true }), ok: pad ? confirmKey() : GLYPH_KEYS.ok, okLabel: hint ?? t('box.continue') };
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class BoxCard {
  constructor({ onDismiss, onSkip } = {}) {
    this.dom = typeof document !== 'undefined' && !!document.body && typeof document.createElement === 'function' && !!document.head;
    this.shown = false;
    if (!this.dom) return;
    if (!document.getElementById('boxcard-css')) {
      const st = document.createElement('style'); st.id = 'boxcard-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const el = (this.el = document.createElement('div'));
    el.id = 'boxscene';
    // (the buttons name what to press: the pad's A / × and B / ○, or the keys, drawn by src/pad-glyphs.js; nothing on touch)
    el.innerHTML = `<button class="skip" type="button">${glyph('back', { key: 'Esc' })}<span class="lbl"></span></button>
      <div id="boxcard" role="dialog" aria-live="polite"><h2><i class="star"></i><span class="name"></span></h2>
      <p class="found"></p>
      <p class="desc"></p>
      <div class="gorow"><button class="go" type="button">${glyph('ok')}<span class="lbl"></span></button></div></div>`;
    document.body.appendChild(el);
    this.card = el.querySelector('#boxcard');
    this.go = el.querySelector('.go');
    el.querySelector('.skip .lbl').textContent = t('box.skip');
    el.querySelector('.skip').addEventListener('click', (e) => { e.stopPropagation(); onSkip?.(); });
    // a click or tap anywhere dismisses the card once it is up
    el.addEventListener('click', () => { if (this.shown) onDismiss?.(); });
  }
  /** The scene is playing (catch clicks, show the skip button). */
  scene(on) {
    this.playing = !!on;
    if (this.dom) this.el.classList.toggle('on', on);
    if (!on) this.hide(); else screen.set('boxCard', cardState());
  }
  /**
   * The card for what came out of the box: its name and what it does (itemLine(def)). `found`: an i18n key (src/i18n/en.js)
   * for a line said instead of it (the backpack's first find: short, and a mystery still; it carries a tone).
   * The button names its key or button (A / × and Enter); a click or a tap goes on too.
   */
  show(def, { found = null, hint = null } = {}) {
    this.shown = true;
    this.last = { def, found, hint };
    screen.set('boxCard', cardState(this.last));
    if (!this.dom) return;
    this.card.querySelector('.name').textContent = def.name;
    this.card.classList.toggle('found', !!found);
    this.card.querySelector('.found').innerHTML = found ? keyText(esc(stripTone(t(found))), { html: true, teach: true }) : '';   // (a {key:verb} too: the house map's, #563)
    this.card.querySelector('.desc').innerHTML = keyText(esc(itemLine(def)), { html: true, teach: true });   // (what it does; a {key:verb}: the player's own key or button)
    this.go.querySelector('.lbl').textContent = hint ?? t('box.continue');
    this.el.classList.add('card');
    try { this.go.focus({ preventScroll: true }); } catch { /* old browsers */ }
  }
  hide() {
    this.shown = false; this.last = null;
    screen.set('boxCard', this.playing ? cardState() : null);
    if (this.dom) { this.el.classList.remove('card'); this.go.blur?.(); }
  }
  /** The card's state again for the input now in hand (a pad picked up, the keys pressed): its buttons' names follow it. */
  refresh() { if (this.playing) screen.set('boxCard', cardState(this.last ?? {})); }
}
