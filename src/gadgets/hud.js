import * as THREE from 'three';

// The gadgets on the screen (docs/systems/gadgets.md, "On the screen"): a small chip in the lower left
// corner with the gadget in hand (its mark, its name, its count, the button), a reticle on what the aim
// would catch, the wheel for choosing one (hold D-pad ↑ or B), and on a touch screen a use button and the
// chip to tap for the next one. Paper and ink like the rest of the HUD. Works without a page (the tests).
//
//   const hud = new GadgetHud({ camera, touch, input })
//   hud.chip({ def, count, max, refill, note, key }) · hud.chip(null)
//   hud.reticle(point | null, kind, label) · hud.wheel(list, highlighted | -1) · hud.wheel(null)
//   hud.marks([{ point, label }])   numbered diamonds on what a gadget has locked on to (the boomerang), [] hides
//   hud.onTap = () => …   (the chip tapped: the next gadget)

const CSS = `
#gadget-chip { position: fixed; left: calc(16px + var(--safe-left, 0px)); bottom: calc(16px + var(--safe-bottom, 0px)); z-index: 30;
  display: none; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; background: rgba(247, 236, 210, 0.9); border: 1.5px solid #2b211f;
  box-shadow: 3px 3px 0 #2b211f; font: 11px/1.3 ui-monospace, Menlo, monospace; color: #2b211f; pointer-events: none; transform: rotate(-0.6deg); }
#gadget-chip.on { display: flex; }
#gadget-chip .g img { width: 34px; height: 34px; border-radius: 50%; }
#gadget-chip .g { width: 34px; height: 34px; overflow: hidden; border: 1.5px solid #2b211f; border-radius: 50%; display: grid; place-items: center; font-size: 17px; background: #fffaf0; }
#gadget-chip b { font-weight: normal; letter-spacing: 0.08em; text-transform: uppercase; display: block; }
#gadget-chip .pips { letter-spacing: 2px; font-size: 10px; }
#gadget-chip .pips i { font-style: normal; color: #2b211f; }
#gadget-chip .pips i.off { color: rgba(43, 33, 31, 0.25); }
#gadget-chip .gkey { margin-left: 4px; padding: 0 5px; border: 1px solid #2b211f; border-radius: 9px; font-size: 10px; background: #fffaf0; }
#gadget-chip.flash { animation: gchip 0.5s ease-out; }
@keyframes gchip { 0% { transform: rotate(-0.6deg) scale(1.25); } 100% { transform: rotate(-0.6deg) scale(1); } }
body.touch #gadget-chip { pointer-events: auto; bottom: calc(86px + var(--safe-bottom, 0px)); }
body.talking #gadget-chip, body.photo #gadget-chip { display: none; }
#gadget-reticle { position: fixed; left: 0; top: 0; z-index: 31; pointer-events: none; display: none; width: 34px; height: 34px; margin: -17px 0 0 -17px; }
#gadget-reticle.on { display: block; }
#gadget-reticle .r { position: absolute; inset: 0; border: 2.5px solid #2b211f; border-radius: 50%; box-shadow: 0 0 0 2px rgba(247, 236, 210, 0.8); }
#gadget-reticle .r::before, #gadget-reticle .r::after { content: ''; position: absolute; left: 50%; top: 50%; background: #2b211f; }
#gadget-reticle .r::before { width: 12px; height: 2px; margin: -1px 0 0 -6px; }
#gadget-reticle .r::after { width: 2px; height: 12px; margin: -6px 0 0 -1px; }
#gadget-reticle.anchor .r { border-color: #c8483a; transform: rotate(45deg) scale(1.1); border-radius: 4px; }
#gadget-reticle.target .r { border-color: #2f7f86; }
#gadget-reticle.far .r { border-style: dashed; opacity: 0.55; transform: scale(0.7); }
#gadget-reticle span { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); white-space: nowrap; padding: 0 5px;
  font: 10px/1.5 ui-monospace, Menlo, monospace; color: #2b211f; background: rgba(247, 236, 210, 0.85); border: 1px solid #2b211f; }
#gadget-marks { position: fixed; inset: 0; z-index: 31; pointer-events: none; }
#gadget-marks .m { position: absolute; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; }
#gadget-marks .m::before { content: ''; position: absolute; inset: 3px; border: 2.5px solid #c8483a; background: rgba(247, 236, 210, 0.75); transform: rotate(45deg); box-shadow: 0 0 0 1.5px #2b211f; }
#gadget-marks .m b { position: absolute; inset: 0; display: grid; place-items: center; font: bold 11px/1 ui-monospace, Menlo, monospace; color: #2b211f; }
#gadget-marks .m.new { animation: gmark 0.25s ease-out; }
@keyframes gmark { 0% { transform: scale(1.9); } 100% { transform: scale(1); } }
#gadget-wheel { position: fixed; left: 50%; top: 50%; z-index: 40; width: 300px; height: 300px; margin: -150px 0 0 -150px; display: none; pointer-events: none; }
#gadget-wheel.on { display: block; }
#gadget-wheel .ring { position: absolute; inset: 40px; border: 2px dashed rgba(43, 33, 31, 0.5); border-radius: 50%; background: rgba(247, 236, 210, 0.35); }
#gadget-wheel .slot { position: absolute; width: 56px; height: 56px; margin: -28px 0 0 -28px; border: 2px solid #2b211f; border-radius: 50%; background: #f7ecd2;
  display: grid; place-items: center; font-size: 24px; box-shadow: 3px 3px 0 #2b211f; transition: transform 0.08s; color: #2b211f; }
#gadget-wheel .slot img { width: 48px; height: 48px; border-radius: 50%; }
#gadget-wheel .slot { overflow: hidden; }
#gadget-wheel .slot.none { font-size: 11px; font-family: ui-monospace, Menlo, monospace; }
#gadget-wheel .slot.hi { transform: scale(1.25); background: #f2c54b; }
#gadget-wheel .name { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 3px 8px; background: #f7ecd2; border: 1.5px solid #2b211f;
  font: 12px/1.4 ui-monospace, Menlo, monospace; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; color: #2b211f; }
#touch .b-gadget { right: calc(112px + var(--safe-right)); bottom: calc(262px + var(--safe-bottom)); width: 54px; height: 54px; font-size: 22px; display: none; }
body.gadget-on #touch .b-gadget { display: block; }
`;

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const _p = new THREE.Vector3();

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

  /** The chip: the gadget in hand, or null (hidden). */
  chip(c) {
    if (!this.dom) return;
    const key = c ? `${c.def.id}|${c.count ?? ''}|${c.max ?? ''}|${c.note ?? ''}|${c.key}|${c.icon ? 1 : 0}` : '';
    if (this.touch && !this.touchBtn) this.touchButton();
    if (key === this.last.chip) return;
    const changed = (c?.def.id ?? '') !== (this.lastId ?? '');
    this.last.chip = key; this.lastId = c?.def.id ?? '';
    document.body.classList.toggle('gadget-on', !!c);
    this.chipEl.classList.toggle('on', !!c);
    if (!c) return;
    const sub = c.max ? `<span class="pips">${pips(c.count, c.max).split('').map((p) => `<i class="${p === '○' ? 'off' : ''}">●</i>`).join('')}</span>` : c.note ? `<span>${esc(c.note)}</span>` : '';
    this.chipEl.innerHTML = `<span class="g">${c.icon ? `<img src="${esc(c.icon)}" alt="">` : esc(c.def.glyph ?? '◆')}</span><span><b>${esc(c.def.name)}</b>${sub}</span><span class="gkey">${esc(c.key)}</span>`;
    if (this.touchBtn) this.touchBtn.textContent = c.def.glyph ?? '◆';
    if (changed) { this.chipEl.classList.remove('flash'); void this.chipEl.offsetWidth; this.chipEl.classList.add('flash'); }
  }

  /** The reticle on a world point (kind: 'ok' | 'anchor' | 'target' | 'far'), or hidden. */
  reticle(point, kind = 'ok', label = '') {
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
    if (!this.dom) return;
    list = list ?? [];
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

  /** The wheel: [{ glyph, name }] round a circle (clockwise from the top), one highlighted; null hides it. */
  wheel(list, hi = -1) {
    if (!this.dom) return;
    const key = list ? `${list.map((l) => l.name + (l.icon ? 1 : 0)).join(',')}|${hi}` : '';
    if (key === this.last.wheel) return;
    this.last.wheel = key;
    this.wheelEl.classList.toggle('on', !!list);
    if (!list) return;
    const R = 112, n = list.length;
    this.wheelEl.innerHTML = '<div class="ring"></div>' + list.map((l, i) => {
      const a = (i / n) * Math.PI * 2, x = 150 + Math.sin(a) * R, y = 150 - Math.cos(a) * R;
      return `<div class="slot${i === hi ? ' hi' : ''}${l.none ? ' none' : ''}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px">${l.icon ? `<img src="${esc(l.icon)}" alt="">` : esc(l.glyph)}</div>`;
    }).join('') + `<div class="name">${esc(hi >= 0 ? list[hi].name : 'choose a gadget')}</div>`;
  }

  dispose() { for (const e of [this.chipEl, this.retEl, this.wheelEl, this.touchBtn, this.marksEl]) e?.remove(); }
}
