import * as THREE from 'three';
import { screen } from '../platform.js';
import { styleText } from '../ui-style-registry.js';   // the chips in the enamel of every message (issue #687)

// The gadgets on the screen (docs/systems/gadgets.md, "On the screen"): a small round chip in the top right
// corner with the gadget in hand (its picture alone, issue #240), a reticle on what the aim
// would catch, the wheel for choosing one (hold D-pad ↑ or B), and on a touch screen a use button and the
// chip to tap for the next one. Paper and ink like the rest of the HUD. Works without a page (the tests).
//
//   const hud = new GadgetHud({ camera, touch, input })
//   hud.chip({ def, count, max, refill, note, key }) · hud.chip(null)
//   hud.reticle(point | null, kind, label) · hud.wheel(list, highlighted | -1) · hud.wheel(null)
//   hud.marks([{ point, label }])   numbered diamonds on what a gadget has locked on to (the boomerang), [] hides
//   hud.onTap = () => …   (the chip tapped: the next gadget)
// Each part is the screen's state too (src/platform.js screen: 'gadget', 'gadgetWheel', 'reticle', 'gadgetMarks'), which
// an engine draws where there is no page (issue #344: the Unity bridge's BridgeHud.cs).


const at3 = (p) => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];

/** The chip as the screen's state: the gadget's id (its picture's name), name and mark, how full its count is (k), none left. */
export function chipState(c) {
  if (!c) return null;
  const max = c.max ?? 0;
  return { id: c.def.id, name: c.def.name ?? '', glyph: c.def.glyph ?? '◆', k: max ? Math.max(0, Math.min(1, (c.count ?? 0) / max)) : null, empty: !!(max && !c.count) };
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _p = new THREE.Vector3();

/** The chip's inside: the gadget's picture (its mark until the picture is drawn), and nothing else. */
export const chipHtml = (c) => (c.icon ? `<img src="${esc(c.icon)}" alt="">` : `<span class="g">${esc(c.def.glyph ?? '◆')}</span>`);

/** The pips of a count: ●●○ for 2 of 3. */
export const pips = (count, max) => (max > 0 ? Array.from({ length: max }, (_, i) => (i < count ? '●' : '○')).join('') : '');

export class GadgetHud {
  constructor({ camera = null, touch = false, input = null } = {}) {
    this.camera = camera;
    this.dom = typeof document !== 'undefined' && !!document.body && typeof document.createElement === 'function';
    this.onTap = null;
    this.last = { chip: '', wheel: '' };
    if (!this.dom) return;
    if (!document.getElementById('gadget-css')) { const st = document.createElement('style'); st.id = 'gadget-css'; st.textContent = styleText('gadget-css'); document.head.appendChild(st); }
    const mk = (id) => { const e = document.createElement('div'); e.id = id; document.body.appendChild(e); return e; };
    this.chipEl = mk('gadget-chip');
    this.chipEl.addEventListener('click', (e) => { e.stopPropagation(); this.onTap?.(); });
    this.chipEl.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.onTap?.(); }, { passive: false });
    this.retEl = mk('gadget-reticle');
    this.retEl.innerHTML = '<div class="r"></div><span></span>';
    this.wheelEl = mk('gadget-wheel');
    this.touch = touch; this.input = input;
  }

  /** Touch: a use button beside the others (held: TouchGadget, like the blade's ⚔), added once the touch controls are there. */
  touchButton() {
    const input = this.input, root = this.touch && input ? document.getElementById('touch') : null;
    if (root && root.childElementCount && !root.querySelector('.b-gadget')) {
      const b = document.createElement('button');
      b.className = 'b-gadget'; b.setAttribute('aria-label', 'Use the gadget in hand'); b.textContent = '◆';
      b.addEventListener('touchstart', (e) => { e.preventDefault(); input.TouchGadget = true; }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); input.TouchGadget = false; }, { passive: false });
      b.addEventListener('touchcancel', () => { input.TouchGadget = false; });
      root.appendChild(b);
      this.touchBtn = b;
    }
  }

  /**
   * The chip: the gadget in hand, or null (hidden). Its picture alone in the top right corner (issue #240: "smaller
   * and at the top right corner of the screen. Just show the gadget itself, no text"): no name, no button, no number
   * (a count is a thin ring round it, filled as far as there is; faded when none is left); a brief gold ring and a pop when it changes (the pad's, the keys', the wheel's).
   */
  chip(c) {
    screen.set('gadget', chipState(c));
    if (!this.dom) return;
    const empty = !!(c?.max && !c.count);
    const key = c ? `${c.def.id}|${c.count ?? ''}|${c.max ?? ''}|${c.icon ?? ''}` : '';
    if (this.touch && !this.touchBtn) this.touchButton();
    if (key === this.last.chip) return;
    const changed = (c?.def.id ?? '') !== (this.lastId ?? '');
    this.last.chip = key; this.lastId = c?.def.id ?? '';
    document.body.classList.toggle('gadget-on', !!c);
    this.chipEl.classList.toggle('on', !!c);
    if (!c) return;
    this.chipEl.innerHTML = chipHtml(c);
    this.chipEl.classList.toggle('empty', empty);
    // (a count, the ink, the lens's meter: a thin ring round the picture, filled as far as there is, no number)
    this.chipEl.classList.toggle('gauge', !!c.max);
    if (c.max) this.chipEl.style.setProperty('--k', String(Math.max(0, Math.min(1, (c.count ?? 0) / c.max))));
    this.chipEl.setAttribute('role', 'img');
    this.chipEl.setAttribute('aria-label', c.def.name ?? '');
    if (this.touchBtn) this.touchBtn.textContent = c.def.glyph ?? '◆';
    if (changed) { this.chipEl.classList.remove('flash'); void this.chipEl.offsetWidth; this.chipEl.classList.add('flash'); }
  }

  /** The reticle on a world point (kind: 'ok' | 'anchor' | 'target' | 'far'), or hidden. */
  reticle(point, kind = 'ok', label = '') {
    screen.set('reticle', point || kind === 'far' ? { at: point ? at3(point) : null, kind, label: label ?? '' } : null);
    if (!this.dom) return;
    if (!point && kind !== 'far') { this.retEl.classList.remove('on'); return; }
    let x = innerWidth / 2, y = innerHeight / 2;
    if (point && this.camera) {
      _p.copy(point).project(this.camera);
      if (_p.z > 1) { this.retEl.classList.remove('on'); return; }
      x = (_p.x * 0.5 + 0.5) * innerWidth; y = (-_p.y * 0.5 + 0.5) * innerHeight;
    }
    this.retEl.className = `on ${kind}`;
    this.retEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const s = this.retEl.querySelector('span');
    if (s.textContent !== label) s.textContent = label;
  }

  /** Numbered red diamonds on world points (the boomerang's locks); an empty list (or null) hides them. */
  marks(list) {
    list = list ?? [];
    screen.set('gadgetMarks', list.length ? list.map((m, i) => ({ at: m.point ? at3(m.point) : null, label: String(m.label ?? i + 1) })) : null);
    if (!this.dom) return;
    if (!this.marksEl) { this.marksEl = document.createElement('div'); this.marksEl.id = 'gadget-marks'; document.body.appendChild(this.marksEl); this.markEls = []; }
    while (this.markEls.length < list.length) { const e = document.createElement('div'); e.className = 'm new'; e.innerHTML = '<b></b>'; this.marksEl.appendChild(e); this.markEls.push(e); }
    this.markEls.forEach((e, i) => {
      const m = list[i];
      if (!m) { if (e.style.display !== 'none') { e.style.display = 'none'; e.classList.remove('new'); } return; }
      if (!this.camera || _p.copy(m.point).project(this.camera).z > 1) { e.style.display = 'none'; return; }
      if (e.style.display === 'none') { e.style.display = ''; e.classList.remove('new'); void e.offsetWidth; e.classList.add('new'); }
      e.style.transform = `translate(${((_p.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-_p.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px)`;
      const b = e.firstChild; if (b.textContent !== String(m.label ?? i + 1)) b.textContent = String(m.label ?? i + 1);
    });
  }

  /**
   * The wheel: [{ glyph, name, icon?, tint? }] round a circle (clockwise from the top), one highlighted; null hides it.
   * (tint: a glove mode's own colour behind its glyph, issue #511; the game waits while it is open, "paused" on it)
   */
  wheel(list, hi = -1) {
    screen.set('gadgetWheel', list ? { slots: list.map((l) => ({ id: (l.mode ? l.key : l.id) ?? '', glyph: l.glyph ?? '◆', name: l.name ?? '', none: !!l.none, tint: l.tint ?? null })), hi, name: hi >= 0 ? list[hi]?.name ?? '' : 'choose a gadget' } : null);
    if (!this.dom) return;
    const key = list ? `${list.map((l) => l.name + (l.icon ? 1 : 0)).join(',')}|${hi}` : '';
    if (key === this.last.wheel) return;
    this.last.wheel = key;
    this.wheelEl.classList.toggle('on', !!list);
    if (!list) return;
    // (more than eight: a wider ring of smaller slots, so ten gadgets and "nothing" never touch; more than twelve, the
    // gadgets and the glove's six modes: wider again)
    const n = list.length, many = n > 8, lots = n > 12, R = lots ? 166 : many ? 136 : 112, C = lots ? 202 : many ? 172 : 150;
    this.wheelEl.classList.toggle('many', many);
    this.wheelEl.classList.toggle('lots', lots);
    this.wheelEl.innerHTML = '<div class="ring"></div>' + list.map((l, i) => {
      const a = (i / n) * Math.PI * 2, x = C + Math.sin(a) * R, y = C - Math.cos(a) * R;
      const tint = l.tint && i !== hi ? `;background:${esc(l.tint)}` : '';
      return `<div class="slot${i === hi ? ' hi' : ''}${l.none ? ' none' : ''}${l.mode ? ' mode' : ''}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px${tint}">${l.icon ? `<img src="${esc(l.icon)}" alt="">` : esc(l.glyph)}</div>`;
    }).join('') + `<div class="name">${esc(hi >= 0 ? list[hi].name : 'choose a gadget')}</div>`;
  }

  dispose() { for (const e of [this.chipEl, this.retEl, this.wheelEl, this.touchBtn, this.marksEl]) e?.remove(); }
}
