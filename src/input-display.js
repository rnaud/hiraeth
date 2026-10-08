import { BINDINGS } from './bindings.js';
import { STANDARD_NAMES, BINDING_KEYS, rawGamepads, pickProfile, parsePadId, hatDirection } from './pad-maps.js';

// The input display (docs/systems/controls.md, "The input display"): a small ink drawing of a pad in the
// lower right that lights each button as it is pressed, shows both sticks and the triggers' travel, and a
// strip of the last presses with the RAW index the browser gave (button 6, axis 9 = 0.71) and what the game
// made of it (RB / R1 → the fluid blade, from src/bindings.js). Its head names the pad (`id`), its `mapping`
// and the profile src/pad-maps.js chose. To check a controller that does not do what it should.
//
//   On in the Arena by default; F6 anywhere, View + D-pad ← in the Arena, the dev menu, ?inputs=1 (main.js).
//   inputDisplay.on · set(on) · toggle() · listen(f) · update() (each frame: nothing at all while off)
//   actionLabel(i, ctx) → 'RB / R1 → the fluid blade (again: the next swing)'   (the bindings table's words)

/** The controller's contexts (src/controller.js) → the bindings table's (src/bindings.js). */
const CONTEXTS = { game: 'foot', ride: 'ride', menu: 'menu', talk: 'talk', photo: 'photo' };

/** What standard button `i` does in this context, in the bindings table's words: 'RB / R1 → the fluid blade'. */
export function actionLabel(i, ctx = 'game') {
  const name = STANDARD_NAMES[i] ?? `button ${i}`;
  const rows = BINDINGS[CONTEXTS[ctx] ?? ctx] ?? BINDINGS.foot;
  const row = rows.find(([b]) => b === BINDING_KEYS[i]);
  const what = row ? row[1].split(' · ')[0] : i === 16 ? 'the system\'s (nothing in the game)' : 'nothing here';
  return `${name} → ${what}`;
}

/** One line of the strip for a raw input: 'button 7 → RB / R1 → the fluid blade' or 'button 5 → not mapped'. */
export function pressLine(raw, std, ctx) {
  if (!std.length) return `${raw} → not mapped`;
  return `${raw} → ${std.map((i) => actionLabel(i, ctx)).join(' · ')}`;
}

/** raw source ('button 6', 'axis 9') → the standard buttons it feeds, from a remap's sources. */
export function reverseSources(sources) {
  const out = new Map();
  sources.forEach((list, i) => { for (const s of list) { const k = s.replace(/ \(.*\)$/, ''); if (!out.has(k)) out.set(k, []); out.get(k).push(i); } });
  return out;
}

const listeners = new Set();
const SVGNS = 'http://www.w3.org/2000/svg';
const INK = '#2b211f', PAPER = '#fffaf0', LIT = '#c8483a';
const CSS = `
#inputs { position: fixed; right: 12px; bottom: 12px; z-index: 7000; width: 318px; padding: 8px 10px 8px; pointer-events: none;
  color: ${INK}; background: rgba(255, 250, 240, 0.92); border: 2px solid ${INK}; box-shadow: 3px 3px 0 ${INK};
  font: 10.5px/1.35 ui-monospace, Menlo, monospace; }
#inputs svg { display: block; width: 100%; height: auto; }
#inputs svg .k { fill: ${PAPER}; stroke: ${INK}; stroke-width: 2; }
#inputs svg .k.on { fill: ${LIT}; }
#inputs svg text { font: 700 9px ui-monospace, Menlo, monospace; fill: ${INK}; text-anchor: middle; dominant-baseline: central; }
#inputs svg .on + text, #inputs svg text.on { fill: ${PAPER}; }
#inputs svg text.small { font-size: 7px; }
#inputs svg .hatch { stroke: ${INK}; stroke-width: 0.8; opacity: 0.35; }
#inputs .id { font-weight: 700; overflow-wrap: anywhere; }
#inputs .meta, #inputs .raw { opacity: 0.8; overflow-wrap: anywhere; }
#inputs .raw { margin-top: 3px; min-height: 2.7em; }
#inputs ol { margin: 4px 0 0; padding: 4px 0 0; list-style: none; border-top: 1.5px solid ${INK}; min-height: 8.1em; }
#inputs li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#inputs li:first-child { color: ${LIT}; font-weight: 700; }
#inputs .hint { margin-top: 3px; opacity: 0.55; }
`;

// the pad, drawn: [standard index, shape, x, y, w, h, label]
const KEYS = [
  [4, 'pill', 36, 22, 54, 11, 'LB'], [5, 'pill', 190, 22, 54, 11, 'RB'],
  [12, 'rect', 63, 51, 15, 15, ''], [13, 'rect', 63, 79, 15, 15, ''], [14, 'rect', 49, 65, 15, 15, ''], [15, 'rect', 77, 65, 15, 15, ''],
  [0, 'circle', 210, 88, 9, 0, 'A'], [1, 'circle', 227, 72, 9, 0, 'B'], [2, 'circle', 193, 72, 9, 0, 'X'], [3, 'circle', 210, 56, 9, 0, 'Y'],
  [8, 'pill', 108, 55, 28, 10, 'View'], [9, 'pill', 144, 55, 28, 10, 'Menu'], [16, 'circle', 140, 78, 6, 0, ''],
];

class InputDisplay {
  constructor() { this.on = false; this.el = null; this.log = []; this.prev = null; this.ctx = () => 'game'; this.index = () => null; }
  /** where to read the controller's context and the pad in use (main.js) */
  bind({ context, index } = {}) { if (context) this.ctx = context; if (index) this.index = index; return this; }
  set(on) { on = !!on; if (on === this.on) return; this.on = on; if (this.el) this.el.hidden = !on; this.prev = null; for (const f of listeners) f(on); }
  toggle() { this.set(!this.on); return this.on; }
  listen(f) { listeners.add(f); return () => listeners.delete(f); }

  build() {
    if (typeof document === 'undefined' || !document.body) return false;
    if (!document.getElementById('inputs-css')) { const s = document.createElement('style'); s.id = 'inputs-css'; s.textContent = CSS; document.head.appendChild(s); }
    const el = (this.el = document.createElement('div'));
    el.id = 'inputs';
    el.innerHTML = '<svg viewBox="0 0 280 150" aria-hidden="true"></svg><div class="id"></div><div class="meta"></div><div class="raw"></div><ol></ol><div class="hint">F6 · View + D-pad ← (Arena) · dev menu · ?inputs=1</div>';
    document.body.appendChild(el);
    const svg = el.querySelector('svg');
    const add = (tag, attrs, parent = svg) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); parent.appendChild(n); return n; };
    // the body: a pad's outline with its two grips, inked, a little hatching under the grips (Moebius's shading)
    add('path', { class: 'k', d: 'M70 36 H210 C246 36 266 58 270 92 C274 124 262 146 240 146 C222 146 212 128 200 116 H80 C68 128 58 146 40 146 C18 146 6 124 10 92 C14 58 34 36 70 36 Z' });
    for (let i = 0; i < 6; i++) { add('line', { class: 'hatch', x1: 22 + i * 6, y1: 140 - i * 2, x2: 14 + i * 6, y2: 118 - i * 2 }); add('line', { class: 'hatch', x1: 266 - i * 6, y1: 118 - i * 2, x2: 258 - i * 6, y2: 140 - i * 2 }); }
    this.keys = new Map();
    // the triggers: a bar each, filled by their travel
    this.trig = [6, 7].map((i, n) => {
      const x = n ? 190 : 36;
      add('rect', { class: 'k', x, y: 4, width: 54, height: 12, rx: 3 });
      const fill = add('rect', { x: x + 2, y: 6, width: 0, height: 8, fill: LIT });
      add('text', { x: x + 27, y: 10 }).textContent = n ? 'RT' : 'LT';
      return { i, x, fill };
    });
    for (const [i, shape, x, y, w, h, label] of KEYS) {
      const k = shape === 'circle' ? add('circle', { class: 'k', cx: x, cy: y, r: w })
        : add('rect', { class: 'k', x, y, width: w, height: h, rx: shape === 'pill' ? h / 2 : 2 });
      let t = null;
      if (label) { t = add('text', { x: shape === 'circle' ? x : x + w / 2, y: shape === 'circle' ? y : y + h / 2, ...(label.length > 2 ? { class: 'small' } : {}) }); t.textContent = label; }
      this.keys.set(i, { k, t });
    }
    // the sticks: a well, the cap where the stick is, lit while clicked (L3 / R3)
    this.sticks = [[10, 104, 106], [11, 176, 106]].map(([i, cx, cy]) => {
      add('circle', { class: 'k', cx, cy, r: 17 });
      const cap = add('circle', { class: 'k', cx, cy, r: 8 });
      return { i, cx, cy, cap };
    });
    this.idEl = el.querySelector('.id'); this.metaEl = el.querySelector('.meta'); this.rawEl = el.querySelector('.raw'); this.listEl = el.querySelector('ol');
    el.hidden = !this.on;
    return true;
  }

  /** each frame: read the pad, light the drawing, add new presses to the strip (nothing while off) */
  update() {
    if (!this.on) return;
    if (!this.el && !this.build()) return;
    const raws = rawGamepads().filter((p) => p?.connected !== false && p);
    const want = this.index();
    const raw = raws.find((p) => p.index === want) ?? raws[0];
    if (!raw) { this.show(null); return; }
    const mapped = Array.from(globalThis.navigator?.getGamepads?.() ?? []).find((p) => p?.index === raw.index) ?? raw;
    this.show(raw, mapped);
  }

  show(raw, pad) {
    if (!raw) {
      if (this.prev !== 'none') { this.idEl.textContent = 'no controller: press a button on it'; this.metaEl.textContent = ''; this.rawEl.textContent = ''; this.paint(null); this.prev = 'none'; }
      return;
    }
    const remap = pad?.remap;
    const profile = remap?.profile ?? pickProfile(raw);
    const sources = remap?.sources ?? STANDARD_NAMES.map((_, i) => [`button ${i}`]);
    const ctx = this.ctx() ?? 'game';
    const head = `${raw.id}|${raw.mapping}|${profile.key}|${remap?.hat}`;
    if (this.head !== head) {
      this.head = head;
      const { vendor, product, flavor } = parsePadId(raw.id);
      this.idEl.textContent = raw.id || '(no id)';
      this.metaEl.textContent = `mapping '${raw.mapping}' · ${vendor ? `${vendor}:${product} · ` : ''}${flavor === 'name' ? 'no vendor id' : flavor} · profile ${profile.key}: ${profile.name}`
        + (remap ? ` · hat: ${remap.hat ?? 'none yet'} · right stick: axes ${remap.right.join(' / ')}` : '');
      this.rev = reverseSources(sources);
    }
    this.paint(pad);
    // the raw state, live: every pressed button's index, every axis
    const pressed = Array.from(raw.buttons ?? []).map((b, i) => (b?.pressed || b?.value > 0.5 ? i : -1)).filter((i) => i >= 0);
    const axes = Array.from(raw.axes ?? []);
    const rawText = `raw: buttons [${pressed.join(' ') || '–'}] of ${raw.buttons?.length ?? 0} · axes ${axes.map((v, i) => `${i}:${v.toFixed(2)}`).join(' ')}`;
    if (rawText !== this.rawText) { this.rawText = rawText; this.rawEl.textContent = rawText; }
    // new presses: a raw button going down, a hat turning, an axis that is neither a stick nor a hat crossing the middle
    const prev = this.prev && this.prev.id === raw.id ? this.prev : { id: raw.id, buttons: [], axes: axes.map(() => null) };
    Array.from(raw.buttons ?? []).forEach((b, i) => {
      const down = !!(b?.pressed || b?.value > 0.5);
      if (down && !prev.buttons[i]) this.push(pressLine(`button ${i}`, this.rev.get(`button ${i}`) ?? [], ctx));
      prev.buttons[i] = down;
    });
    const sticks = new Set(remap ? [...remap.right, ...(remap.left ?? [0, 1])] : [0, 1, 2, 3]);
    axes.forEach((v, i) => {
      if (remap && i === remap.hat) {
        const d = hatDirection(v);
        const key = d ? `${+d.up}${+d.down}${+d.left}${+d.right}` : '';
        if (key && key !== prev.axes[i]) {
          const std = [12, 13, 14, 15].filter((_, n) => key[n] === '1');
          this.push(pressLine(`axis ${i} = ${v.toFixed(2)}`, std, ctx));
        }
        prev.axes[i] = key;
      } else if (!sticks.has(i)) {
        const hot = Math.abs(v) > 0.5 && Math.abs(v) <= 1.05 ? Math.sign(v) : 0;
        const fed = this.rev.has(`axis ${i}`);   // (an analog trigger: logged as it is squeezed, not as it comes back)
        if (prev.axes[i] !== null && hot !== prev.axes[i] && (fed ? hot > 0 : hot !== 0)) {
          this.push(pressLine(`axis ${i} = ${v.toFixed(2)}`, this.rev.get(`axis ${i}`) ?? [], ctx));
        }
        prev.axes[i] = hot;
      }
    });
    this.prev = prev;
  }

  push(line) {
    this.log.unshift(line); this.log.length = Math.min(this.log.length, 6);
    this.listEl.replaceChildren(...this.log.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
  }

  paint(pad) {
    const b = (i) => { const x = pad?.buttons?.[i]; return x ? x.pressed || x.value > 0.5 : false; };
    const v = (i) => { const x = pad?.buttons?.[i]; return x ? Math.max(+x.value || 0, x.pressed ? 1 : 0) : 0; };
    for (const [i, { k, t }] of this.keys) { const on = b(i); if (k.__on !== on) { k.__on = on; k.classList.toggle('on', on); t?.classList.toggle('on', on); } }
    for (const tr of this.trig) tr.fill.setAttribute('width', (50 * Math.min(1, v(tr.i))).toFixed(1));
    this.sticks.forEach((s, n) => {
      const x = +(pad?.axes?.[n * 2] ?? 0) || 0, y = +(pad?.axes?.[n * 2 + 1] ?? 0) || 0;
      s.cap.setAttribute('cx', (s.cx + Math.max(-1, Math.min(1, x)) * 9).toFixed(1));
      s.cap.setAttribute('cy', (s.cy + Math.max(-1, Math.min(1, y)) * 9).toFixed(1));
      s.cap.classList.toggle('on', b(s.i));
    });
  }
}

/** The one input display (main.js binds it to the controller). */
export const inputDisplay = new InputDisplay();
