// The box-opening card, in the game's paper-and-ink UI: an artifact of the
// makers (the glyph, then what you found), what it is, what it does, and the
// makers' own line under it: left for one who has come a long way. Also the full-screen catcher for the scene (a click or
// tap dismisses the card) and a small "skip" button for touch. Built on
// demand, inert in node (no document).

import { keyText } from '../prompt-keys.js';
import { glyph } from '../pad-glyphs.js';
import { t } from '../i18n.js';
import { stripTone } from '../story/tone.js';

const CSS = `
#boxscene { position: fixed; inset: 0; z-index: 8100; pointer-events: none; }
#boxscene.on { pointer-events: auto; cursor: default; }
#boxscene .skip { position: absolute; right: 18px; top: calc(11vh + 14px); font: 12px ui-monospace, Menlo, monospace; letter-spacing: .08em; color: #2b211f;
  background: rgba(255, 246, 220, .9); border: 1.5px solid #2b211f; padding: 6px 12px; opacity: 0; transition: opacity .3s; pointer-events: none; }
#boxscene.on .skip { opacity: .85; pointer-events: auto; }
#boxscene.card .skip { opacity: 0; pointer-events: none; }
#boxcard { position: absolute; left: 50%; bottom: calc(11vh + 22px); width: min(560px, 90vw); box-sizing: border-box; transform: translate(-50%, 16px) rotate(-.5deg);
  opacity: 0; transition: opacity .35s, transform .45s cubic-bezier(.2,.9,.3,1.3); pointer-events: none;
  font: 14px/1.45 ui-monospace, Menlo, monospace; color: #2b211f; background: #fff6dc; border: 2px solid #2b211f; box-shadow: 6px 6px 0 #2b211f; padding: 14px 20px 12px; }
#boxscene.card #boxcard { opacity: 1; transform: translate(-50%, 0) rotate(-.5deg); pointer-events: auto; }
#boxcard .k { font-size: 11px; letter-spacing: .3em; opacity: .75; }
#boxcard .k svg { width: 22px; height: 14px; vertical-align: -2px; margin-right: 8px; fill: #25386c; stroke: #25386c; }
#boxcard .left { margin: 2px 0 0; font-size: 11px; font-style: italic; letter-spacing: .06em; opacity: .65; }
#boxcard h2 { margin: 4px 0 10px; font-size: 24px; letter-spacing: .04em; font-weight: bold; }
#boxcard h2 .star { display: inline-block; width: 18px; height: 18px; margin-right: 8px; vertical-align: -1px; background: #25386c;
  clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); }
#boxcard p { margin: 0 0 8px; }
#boxcard p b { display: block; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #7a3a35; margin-bottom: 1px; }
#boxcard p.does b { color: #277e86; }
#boxcard p.found { font-size: 15px; margin: 2px 0 10px; }
#boxcard.found p.what, #boxcard.found p.does, #boxcard.found p.left, #boxcard:not(.found) p.found { display: none; }
#boxcard .go, #boxscene .skip { display: inline-flex; align-items: center; }
#boxcard .go { margin: 10px 0 0 auto; font: 12px ui-monospace, Menlo, monospace; letter-spacing: .08em; color: #2b211f; background: #f2c54b;
  border: 1.5px solid #2b211f; box-shadow: 2px 2px 0 #2b211f; padding: 6px 12px; cursor: pointer; }
#boxcard .gorow { display: flex; justify-content: flex-end; }
#boxcard .go:focus { outline: 2px dashed #2b211f; outline-offset: 2px; }
@media (min-width: 980px) { #boxcard { left: 28px; transform: translate(0, 16px) rotate(-.5deg); } #boxscene.card #boxcard { transform: translate(0, 0) rotate(-.5deg); } }
@media (max-width: 600px) { #boxcard { font-size: 13px; padding: 12px 14px 10px; bottom: calc(11vh + 10px); } #boxcard h2 { font-size: 20px; } }
`;

// the glyph (three dots over an arch, as in src/story/dialogue.js MOTIFS)
const GLYPH = '<svg viewBox="0 0 24 16" aria-hidden="true"><circle cx="5" cy="5" r="2"/><circle cx="12" cy="3.2" r="2"/><circle cx="19" cy="5" r="2"/><path d="M3 15 Q12 6 21 15" fill="none" stroke-width="2"/></svg>';
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
      <div id="boxcard" role="dialog" aria-live="polite"><div class="k">${GLYPH}AN ARTIFACT OF THE MAKERS</div><h2><i class="star"></i><span class="name"></span></h2>
      <p class="found"></p>
      <p class="what"><b>What it is</b><span class="text"></span></p><p class="does"><b>What it does</b><span class="use"></span></p><p class="left">Left by the makers for one who has come a long way.</p>
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
  scene(on) { if (this.dom) this.el.classList.toggle('on', on); if (!on) this.hide(); }
  /**
   * The card for what came out of the box. `found`: an i18n key (src/i18n/en.js) for a line said instead of
   * "what it is / what it does" (the backpack's first find: short, and a mystery still; it carries a tone).
   * The button names its key or button (A / × and Enter); a click or a tap goes on too.
   */
  show(def, { found = null, hint = null } = {}) {
    this.shown = true;
    if (!this.dom) return;
    this.card.querySelector('.name').textContent = def.name;
    this.card.classList.toggle('found', !!found);
    this.card.querySelector('.found').textContent = found ? stripTone(t(found)) : '';
    this.card.querySelector('.text').innerHTML = esc(def.text);
    this.card.querySelector('.use').innerHTML = keyText(esc(def.use), { html: true, teach: true });   // (a {key:verb}: the player's own key or button)
    this.go.querySelector('.lbl').textContent = hint ?? t('box.continue');
    this.el.classList.add('card');
    try { this.go.focus({ preventScroll: true }); } catch { /* old browsers */ }
  }
  hide() { this.shown = false; if (this.dom) { this.el.classList.remove('card'); this.go.blur?.(); } }
}
