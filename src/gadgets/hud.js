import * as THREE from 'three';
import { screen } from '../platform.js';

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

const CSS = `
#gadget-chip { position: fixed; isolation: isolate; right: calc(14px + var(--safe-right, 0px)); top: calc(12px + var(--safe-top, 0px)); z-index: 30;
  display: none; place-items: center; width: clamp(30px, 6vh, 42px); height: clamp(30px, 6vh, 42px); box-sizing: border-box; padding: 0;
  background: rgba(255, 250, 240, 0.92); border: 1.5px solid #2b211f; border-radius: 50%; box-shadow: 2px 2px 0 rgba(43, 33, 31, 0.6);
  font: calc(clamp(30px, 6vh, 42px) * 0.55)/1 var(--face); color: #2b211f; pointer-events: none; transition: opacity 0.2s; }
#gadget-chip.on { display: grid; }
body.minigame #gadget-chip, body.minigame #gadget-reticle, body.minigame #gadget-wheel { display: none !important; }   /* (a game takes the buttons: src/minigames/) */
#gadget-chip img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
#gadget-chip.gauge::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; pointer-events: none;
  background: conic-gradient(#2f7f86 calc(var(--k, 1) * 360deg), rgba(43, 33, 31, 0.18) 0);
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); mask: radial-gradient(closest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px)); }
#gadget-chip.empty { opacity: 0.5; }   /* (none left: the bombs thrown, the shell's song spent) */
#gadget-chip.flash { animation: gchip 0.6s ease-out; }
@keyframes gchip { 0% { transform: scale(1.35); box-shadow: 0 0 0 5px #f2c54b; } 100% { transform: scale(1); box-shadow: 2px 2px 0 rgba(43, 33, 31, 0.6); } }
@media (prefers-reduced-motion: reduce) { #gadget-chip.flash { animation: gchip-still 0.6s ease-out; } }
html.reduce-motion #gadget-chip.flash { animation: gchip-still 0.6s ease-out; }
@keyframes gchip-still { 0% { box-shadow: 0 0 0 5px #f2c54b; } 100% { box-shadow: 2px 2px 0 rgba(43, 33, 31, 0.6); } }
body:not(.nofps) #fps:not(:empty) ~ #gadget-chip { top: calc(48px + var(--safe-top, 0px)); }   /* (the frame readout, when asked for, keeps the corner) */
body.touch #gadget-chip { pointer-events: auto; right: calc(56px + var(--safe-right, 0px)); }   /* (beside the menu's button; tapped: the next gadget) */
body.talking #gadget-chip, body.photo #gadget-chip, body.photo #gadget-reticle, body.photo #gadget-wheel, body.photo #gadget-marks { display: none; }
body.cine-on #gadget-chip, body.cine-on #gadget-reticle, body.cine-on #gadget-wheel, body.cine-on #gadget-marks { display: none !important; }   /* (a cinematic: its letterbox is up, src/ship/cinema.js) */
#gadget-reticle { position: fixed; left: 0; top: 0; z-index: 31; pointer-events: none; display: none; width: 34px; height: 34px; margin: -17px 0 0 -17px; }
#gadget-reticle.on { display: block; }
#gadget-reticle .r { position: absolute; inset: 0; border: 2.5px solid #2b211f; border-radius: 50%; box-shadow: 0 0 0 2px rgba(247, 236, 210, 0.8); }
#gadget-reticle .r::before, #gadget-reticle .r::after { content: ''; position: absolute; left: 50%; top: 50%; background: #2b211f; }
#gadget-reticle .r::before { width: 12px; height: 2px; margin: -1px 0 0 -6px; }
#gadget-reticle .r::after { width: 2px; height: 12px; margin: -6px 0 0 -1px; }
#gadget-reticle.anchor .r { border-color: #c8483a; transform: rotate(45deg) scale(1.1); border-radius: 4px; }
#gadget-reticle.target .r { border-color: #2f7f86; }
#gadget-reticle.far .r { border-style: dashed; opacity: 0.55; transform: scale(0.7); }
#gadget-reticle.nohold .r { border-style: dashed; transform: rotate(45deg) scale(0.85); }   /* (a cross in a broken ring: a makers' house's bare stone won't take the hook, issue #432) */
#gadget-reticle.nohold .r::before { width: 16px; margin-left: -8px; }
#gadget-reticle.nohold .r::after { height: 16px; margin-top: -8px; }
#gadget-reticle span { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); white-space: nowrap; padding: 0 5px;
  font: calc(var(--type-s) * 0.8)/1.5 var(--face); color: #2b211f; background: rgba(247, 236, 210, 0.85); border: 1px solid #2b211f; }
#gadget-marks { position: fixed; inset: 0; z-index: 31; pointer-events: none; }
#gadget-marks .m { position: absolute; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; }
#gadget-marks .m::before { content: ''; position: absolute; inset: 3px; border: 2.5px solid #c8483a; background: rgba(247, 236, 210, 0.75); transform: rotate(45deg); box-shadow: 0 0 0 1.5px #2b211f; }
#gadget-marks .m b { position: absolute; inset: 0; display: grid; place-items: center; font: bold 11px/1 var(--face); color: #2b211f; }
#gadget-marks .m.new { animation: gmark 0.25s ease-out; }
@keyframes gmark { 0% { transform: scale(1.9); } 100% { transform: scale(1); } }
#gadget-wheel { position: fixed; left: 50%; top: 50%; z-index: 40; width: 300px; height: 300px; margin: -150px 0 0 -150px; display: none; pointer-events: none; }
#gadget-wheel.on { display: block; }
#gadget-wheel .ring { position: absolute; inset: 40px; border: 2px dashed rgba(43, 33, 31, 0.5); border-radius: 50%; background: rgba(247, 236, 210, 0.35); }
#gadget-wheel .slot { position: absolute; width: 56px; height: 56px; margin: -28px 0 0 -28px; border: 2px solid #2b211f; border-radius: 50%; background: #f7ecd2;
  display: grid; place-items: center; font-size: 24px; box-shadow: 3px 3px 0 #2b211f; transition: transform 0.08s; color: #2b211f; }
#gadget-wheel .slot img { width: 48px; height: 48px; border-radius: 50%; }
#gadget-wheel .slot { overflow: hidden; }
#gadget-wheel .slot.none { font-size: 11px; font-family: var(--face); }
#gadget-wheel .slot.hi { transform: scale(1.25); background: #f2c54b; }
#gadget-wheel .name { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 3px 8px; background: #f7ecd2; border: 1.5px solid #2b211f;
  font: var(--type-s)/1.4 var(--face); letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; color: #2b211f; }
#touch .b-gadget { display: none; }   /* (its place and size: src/touch-layout.js, set by ui.js TouchControls) */
body.gadget-on #touch .b-gadget { display: block; }
body.minigame #touch .b-gadget, body.talking #touch .b-gadget { display: none !important; }   /* (a game, a conversation: nothing to use it on) */
#gadget-wheel.many { width: 344px; height: 344px; margin: -172px 0 0 -172px; }
#gadget-wheel.many .slot { width: 50px; height: 50px; margin: -25px 0 0 -25px; font-size: 21px; }
#gadget-wheel.many .slot img { width: 44px; height: 44px; }
#gadget-wheel.many .slot.none { font-size: 11px; }
#gadget-wheel.many .slot.hi { transform: scale(1.18); }
#gadget-wheel.lots { width: 404px; height: 404px; margin: -202px 0 0 -202px; }
#gadget-wheel.lots .slot { width: 46px; height: 46px; margin: -23px 0 0 -23px; font-size: 20px; }
#gadget-wheel.lots .slot img { width: 40px; height: 40px; }
#gadget-wheel .slot.mode { font-family: var(--face); }
`;

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
    if (!document.getElementById('gadget-css')) { const st = document.createElement('style'); st.id = 'gadget-css'; st.textContent = CSS; document.head.appendChild(st); }
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
