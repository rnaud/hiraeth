import { screen } from '../platform.js';
import { en } from '../hud-look.js';   // the chips in the enamel of every message (issue #687)

// The spell on the screen (docs/systems/spells.md): a round chip under the gadget's in the top right corner, the enamel
// of the rest of the HUD (issue #687). Ready: the spell's glyph in its colour, a full ring round it. Recovering: the seconds
// left in the middle and the ring filling round as it comes back (a pale chip); ready again, a gold flash. While a
// spell is working, the ring is its colour and empties as it runs out. On a touch screen, the ✺ button casts it.
// The screen's state too (src/platform.js screen 'spell'), which an engine draws where there is no page (BridgeHud.cs).
//
//   const hud = new SpellHud({ touch, input })
//   hud.show({ id, name, glyph, color, k, left, ready, active }) · hud.show(null)

const CSS = `
#spell-chip { position: fixed; isolation: isolate; right: calc(14px + var(--safe-right, 0px)); top: calc(26px + clamp(30px, 6vh, 42px) + var(--safe-top, 0px)); z-index: 30;
  display: none; place-items: center; width: clamp(30px, 6vh, 42px); height: clamp(30px, 6vh, 42px); box-sizing: border-box; padding: 0;
  background: ${en('strip')}; border: 1.5px solid ${en('brass')}; border-radius: 50%; box-shadow: ${en('shadow')};
  font: calc(clamp(30px, 6vh, 42px) * 0.55)/1 var(--face); color: var(--spell, ${en('ink')}); pointer-events: none; transition: opacity 0.2s, background 0.2s; }
#spell-chip.on { display: grid; }
#spell-chip::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
  background: conic-gradient(var(--ring, ${en('brass')}) calc(var(--k, 1) * 360deg), rgba(22, 23, 23, 0.35) 0);
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); mask: radial-gradient(closest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); }
#spell-chip .g { text-shadow: none; }
#spell-chip.wait { background: ${en('strip')}; color: ${en('soft')}; }
#spell-chip.wait .g { font: bold calc(clamp(30px, 6vh, 42px) * 0.36)/1 var(--face); text-shadow: none; }
#spell-chip.flash { animation: schip 0.7s ease-out; }
@keyframes schip { 0% { transform: scale(1.35); box-shadow: 0 0 0 6px #f2c54b; } 100% { transform: scale(1); box-shadow: ${en('shadow')}; } }
@media (prefers-reduced-motion: reduce) { #spell-chip.flash { animation: schip-still 0.7s ease-out; } }
html.reduce-motion #spell-chip.flash { animation: schip-still 0.7s ease-out; }
@keyframes schip-still { 0% { box-shadow: 0 0 0 6px #f2c54b; } 100% { box-shadow: ${en('shadow')}; } }
body:not(.nofps) #fps:not(:empty) ~ #spell-chip { top: calc(62px + clamp(30px, 6vh, 42px) + var(--safe-top, 0px)); }
body.touch #spell-chip { right: calc(56px + var(--safe-right, 0px)); }
body.minigame #spell-chip, body.talking #spell-chip, body.photo #spell-chip { display: none !important; }
body.cine-on #spell-chip { display: none !important; }
#touch .b-spell { display: none; }
body.spell-on #touch .b-spell { display: block; }
body.minigame #touch .b-spell, body.talking #touch .b-spell { display: none !important; }
#touch .b-spell.wait { opacity: 0.45; }
`;

/** The chip's state for the screen (pure): null when no spell is known. */
export function spellChipState(s) {
  if (!s) return null;
  return { id: s.id, name: s.name ?? '', glyph: s.glyph ?? '✺', color: s.color ?? '#2b211f', k: Math.round(Math.max(0, Math.min(1, s.k ?? 1)) * 100) / 100,
    left: Math.max(0, Math.ceil(s.left ?? 0)), ready: !!s.ready, active: Math.round(Math.max(0, Math.min(1, s.active ?? 0)) * 100) / 100 };
}

export class SpellHud {
  constructor({ touch = false, input = null } = {}) {
    this.dom = typeof document !== 'undefined' && !!document.body && typeof document.createElement === 'function';
    this.touch = touch; this.input = input; this.last = ''; this.wasReady = null; this.lastId = '';
    if (!this.dom) return;
    if (!document.getElementById('spell-css')) { const st = document.createElement('style'); st.id = 'spell-css'; st.textContent = CSS; document.head.appendChild(st); }
    this.el = document.createElement('div'); this.el.id = 'spell-chip'; this.el.setAttribute('role', 'img');
    this.el.innerHTML = '<span class="g"></span>';
    // (after the gadget's chip, so the frame readout's rule finds it: #fps ~ #spell-chip)
    document.body.appendChild(this.el);
  }

  /** Touch: the cast button beside the gadget's (TouchSpell while pressed), added once the touch controls are there. */
  touchButton() {
    const input = this.input, root = this.touch && input ? document.getElementById('touch') : null;
    if (root && root.childElementCount && !root.querySelector('.b-spell')) {
      const b = document.createElement('button');
      b.className = 'b-spell'; b.setAttribute('aria-label', 'Cast the spell'); b.textContent = '✺';
      b.addEventListener('touchstart', (e) => { e.preventDefault(); input.TouchSpell = true; }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); input.TouchSpell = false; }, { passive: false });
      b.addEventListener('touchcancel', () => { input.TouchSpell = false; });
      root.appendChild(b);
      this.touchBtn = b;
    }
  }

  show(s) {
    const st = spellChipState(s);
    screen.set('spell', st);
    if (!this.dom) return;
    if (this.touch && !this.touchBtn) this.touchButton();
    const key = st ? `${st.id}|${st.k}|${st.left}|${st.ready}|${st.active}` : '';
    if (key === this.last) return;
    this.last = key;
    document.body.classList.toggle('spell-on', !!st);
    this.el.classList.toggle('on', !!st);
    if (!st) { this.wasReady = null; return; }
    const E = this.el, wait = !st.ready && !st.active;
    E.classList.toggle('wait', wait);
    E.style.setProperty('--spell', st.color);
    E.style.setProperty('--ring', st.active ? st.color : wait ? '#2f7f86' : st.color);
    E.style.setProperty('--k', String(st.active ? st.active : st.k));
    E.firstChild.textContent = wait ? String(st.left) : st.glyph;
    E.setAttribute('aria-label', wait ? `${st.name}: ${st.left} s` : st.name);
    this.touchBtn?.classList.toggle('wait', wait);
    if (this.touchBtn) this.touchBtn.textContent = wait ? String(st.left) : st.glyph;
    // (ready again, or another spell chosen: a gold flash)
    if ((st.ready && this.wasReady === false) || (this.lastId && st.id !== this.lastId)) { E.classList.remove('flash'); void E.offsetWidth; E.classList.add('flash'); }
    this.wasReady = st.ready; this.lastId = st.id;
  }

  dispose() { this.el?.remove(); this.touchBtn?.remove(); document.body?.classList?.remove('spell-on'); screen.set('spell', null); }
}
