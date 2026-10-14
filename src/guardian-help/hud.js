// The helper prototypes' panel (issue #339): at the top left of the screen, the encounter's name, what to do now in one line,
// its count (feathers caught, vessels full) as pips, and a bar for what is running out (a falling feather, a leaking
// jar). In node (the tests) it only keeps what it would show.

/** pips: [{ on, miss }] → '●' caught/full, '✕' lost, '○' still to come. */
export const pipText = (pips = []) => pips.map((p) => (p.on ? '●' : p.miss ? '✕' : '○')).join(' ');

export class HelpHud {
  constructor(title) {
    this.title = title;
    this.shown = { line: '', count: '', pips: '', bar: 0, tag: '' };
    if (typeof document === 'undefined' || !document.body?.appendChild) return;
    const el = (this.el = document.createElement('section'));
    el.className = 'guardian-help';
    // (top left, under the key counter: the toasts have the top's middle)
    el.style.cssText = 'position:fixed;top:calc(52px + var(--safe-top, 0px));left:calc(14px + var(--safe-left, 0px));z-index:40;pointer-events:none;'
      + 'width:340px;padding:8px 12px 9px;background:#f7ecd2e8;color:#2b211f;border:2px solid #2b211f;border-radius:8px;'
      + 'box-shadow:3px 3px 0 #2b211f;font:600 13px/1.35 var(--face, system-ui);text-align:left';
    el.innerHTML = '<div data-k="title" style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.7"></div>'
      + '<div data-k="line" style="margin:3px 0 4px"></div>'
      + '<div style="display:flex;gap:10px;align-items:center"><span data-k="count" style="font-weight:700"></span><span data-k="pips" style="letter-spacing:.12em"></span></div>'
      + '<div style="height:6px;margin-top:5px;border:1.5px solid #2b211f;border-radius:4px;overflow:hidden;background:#fff8e9"><i data-k="bar" style="display:block;height:100%;width:0;background:#e0644a"></i></div>';
    this.parts = Object.fromEntries([...el.querySelectorAll('[data-k]')].map((n) => [n.dataset.k, n]));
    this.parts.title.textContent = `${title} · prototype`;
    document.body.appendChild(el);
  }
  /** What it shows now: { line, count, pips, bar (0..1 left of what is running out; 0 hides it), tag } */
  set({ line = '', count = '', pips = [], bar = 0, tone = '#e0644a' } = {}) {
    const S = this.shown, p = pipText(pips);
    S.line = line; S.count = count; S.pips = p; S.bar = bar;
    if (!this.parts) return;
    if (this.parts.line.textContent !== line) this.parts.line.textContent = line;
    if (this.parts.count.textContent !== count) this.parts.count.textContent = count;
    if (this.parts.pips.textContent !== p) this.parts.pips.textContent = p;
    this.parts.bar.style.width = `${(Math.max(0, Math.min(1, bar)) * 100).toFixed(1)}%`;
    this.parts.bar.style.background = tone;
    this.parts.bar.parentElement.style.visibility = bar > 0 ? 'visible' : 'hidden';
  }
  hide(on = true) { if (this.el) this.el.style.display = on ? 'none' : ''; }
  dispose() { this.el?.remove(); }
}
