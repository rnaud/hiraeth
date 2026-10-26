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
import { styleText } from '../ui-style-registry.js';   // the enamel look of every message (issue #687; src/hud-styles/box-card.js)

/** The item's picture (issue #695): the one the Items page and Unity's menus show (scripts/item-pictures.mjs). */
export const itemPicture = (id) => (id ? `item-pictures/${id}.webp` : '');

/** The card's width (issue #695, the author: "why is it so narrow"; BotW's is about half the screen): this share of the
 * viewport's width, at most CARD_MAX_PX, never wider than the screen less 24 px (src/hud-styles/box-card.js writes it). */
export const CARD_VW = 46, CARD_MAX_PX = 720;
/** (the old measure, issue #329: kept for its readers) */
export const CARD_MAX_CH = 44;


/** The most of the screen's height a card takes (the longest, measured on 800 × 450): the item the scene holds up stays clear above it. */
export const CARD_MAX_SHARE = 0.34;
/**
 * The card as the screen's state (an engine draws it): the scene playing (its skip's button and word), and once the item
 * is out its id (its picture: public/item-pictures/<id>, Unity's BridgeMenu.Picture; '' for a find with none), its name, its
 * line (the found line, or what it does, its {key:verb} the input in hand's) and the button to go on.
 * The buttons in Xbox / PlayStation form with a pad (native-pad.js names them as the pad in hand prints them), else the keys.
 */
export function cardState({ def = null, found = null, hint = null, item = null, kind = inputKind() } = {}) {
  const pad = kind === 'pad';
  const out = { scene: true, back: pad ? backKey() : GLYPH_KEYS.back, skipLabel: t('box.skip') };
  if (!def) return out;
  return { ...out, card: true, id: item ?? def.id ?? '', name: def.name ?? '', text: found ? keyText(stripTone(t(found)), { kind, teach: true }) : keyText(itemLine(def), { kind, teach: true }), ok: pad ? confirmKey() : GLYPH_KEYS.ok, okLabel: hint ?? t('box.continue') };
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class BoxCard {
  constructor({ onDismiss, onSkip } = {}) {
    this.dom = typeof document !== 'undefined' && !!document.body && typeof document.createElement === 'function' && !!document.head;
    this.shown = false;
    if (!this.dom) return;
    if (!document.getElementById('boxcard-css')) {
      const st = document.createElement('style'); st.id = 'boxcard-css'; st.textContent = styleText('boxcard-css'); document.head.appendChild(st);
    }
    const el = (this.el = document.createElement('div'));
    el.id = 'boxscene';
    // (the buttons name what to press: the pad's A / × and B / ○, or the keys, drawn by src/pad-glyphs.js; nothing on touch)
    el.innerHTML = `<button class="skip" type="button">${glyph('back', { key: 'Esc' })}<span class="lbl"></span></button>
      <div id="boxcard" class="nopic" role="dialog" aria-live="polite"><div class="pic"><img alt=""></div><div class="body"><h2><i class="star"></i><span class="name"></span></h2>
      <p class="found"></p>
      <p class="desc"></p>
      <div class="gorow"><button class="go" type="button">${glyph('ok')}<span class="lbl"></span></button></div></div></div>`;
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
   * The button names its key or button (A / × and Enter); a click or a tap goes on too. `item`: its id (its picture).
   */
  show(def, { found = null, hint = null, item = null } = {}) {
    this.shown = true;
    this.last = { def, found, hint, item };
    screen.set('boxCard', cardState(this.last));
    if (!this.dom) return;
    this.card.querySelector('.name').textContent = def.name;
    // (its picture at the left, issue #695: the Items page's own; none for a find without one, a temple's map, a picture missing)
    const src = itemPicture(item ?? def.id), img = this.card.querySelector('.pic img');
    this.card.classList.toggle('nopic', !src);
    if (src) { img.onerror = () => this.card.classList.add('nopic'); if (img.getAttribute('src') !== src) img.src = src; }
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
