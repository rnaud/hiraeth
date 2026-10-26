import { screen } from '../platform.js';
import { styleText } from '../ui-style-registry.js';   // the chips in the enamel of every message (issue #687)

// The spell on the screen (docs/systems/spells.md): a round chip under the gadget's in the top right corner, the enamel
// of the rest of the HUD (issue #687). Ready: the spell's glyph in its colour, a full ring round it. Recovering: the seconds
// left in the middle and the ring filling round as it comes back (a pale chip); ready again, a gold flash. While a
// spell is working, the ring is its colour and empties as it runs out. On a touch screen, the ✺ button casts it.
// The screen's state too (src/platform.js screen 'spell'), which an engine draws where there is no page (BridgeHud.cs).
//
//   const hud = new SpellHud({ touch, input })
//   hud.show({ id, name, glyph, color, k, left, ready, active }) · hud.show(null)


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
    if (!document.getElementById('spell-css')) { const st = document.createElement('style'); st.id = 'spell-css'; st.textContent = styleText('spell-css'); document.head.appendChild(st); }
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
