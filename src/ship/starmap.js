// The galactic map: a star chart over the screen when you use the holo table
// in the middle of the ship's deck. The worlds (ORDER) lie along a dotted route round home; each is a
// small drawn planet (src/ship/planets.js) with its name and what you have
// done there. Without power it is locked.
//
//  - Only the worlds you know of are named and can be chosen; the rest are
//    faint dots further along the route (the unlock rule: src/story/route.js).
//  - Every world on the chart carries the strike's signature (src/story/signature.js):
//    a small glyph mark on its disc, its reading in the panel, and a line beside the
//    chart saying why these worlds and no others.
//  - Choosing a world asks first: "Travel to X?" Yes / No (keyboard, mouse,
//    touch and pad: A / × yes, B / ○ no). The press that opens the question
//    never answers it.
//  - The chart is a field (the route) beside the info panel (under it on a
//    phone held upright), so the panel never covers a name. The route is laid
//    out in pixels for the field's size: a ring round home when there is room,
//    else a snake of rows (chartLayout, checked for overlaps by the tests).
//
// Pure helpers (consoleAction, mapEntries, chartLayout) are used by the tests.
//
// Home sits at the centre, where the route begins; it is a destination once
// enough worlds are done (src/story/ending.js).

import { homeEntry } from '../story/ending.js';
import { knownWorlds } from '../story/route.js';
import { planetSvg } from './planets.js';
import { hasSignature, signatureReading, SIGNATURE, SIGNATURE_LEGEND, SIGNATURE_LEGEND_SHORT } from '../story/signature.js';
import { padIndex, confirmKey, backKey } from '../native-pad.js';

/**
 * What E does at the ship's two consoles. `at`: 'dash' (the cockpit's voicemail button: the
 * waiting message, else 'empty') or 'table' (the holo table in the middle of the deck: the
 * galactic map, which needs power, else 'locked').
 */
export function consoleAction({ at = 'dash', powered, pendingCall }) {
  if (at === 'table') return powered ? 'map' : 'locked';
  return pendingCall ? 'call' : 'empty';
}

/** The list of worlds on the chart (`known`: named and choosable); Home is last, once the ending is open (src/story/ending.js). */
export function mapEntries({ order, levels, flag, journal, current, home }) {
  const isDone = (id) => !!(flag?.(`world.${id}.done`) || journal?.storyDone?.(id));
  const isVisited = (id) => !!(journal?.seen?.(id) || id === current || isDone(id));
  const known = new Set(knownWorlds({ order, done: isDone, visited: isVisited, current }));
  const out = order.map((id, i) => {
    const L = levels.find((l) => l.id === id) ?? { id, title: id };
    return { id, i, title: L.title, source: L.source ?? '', blurb: L.blurb ?? '', visited: isVisited(id), done: isDone(id), current: id === current, known: known.has(id), signature: hasSignature(id) };
  });
  const h = homeEntry({ unlocked: typeof home === 'function' ? home() : !!home, current });
  if (h) out.push({ ...h, i: out.length, known: true, signature: false });
  return out;
}

// ------------------------------------------------------------------ layout

/** A world's footprint on the chart at scale s: the disc, then two lines of name and a line of tag under it. */
export function worldBox(s = 1) {
  const disc = Math.round(58 * s), font = Math.max(9.5, 11.5 * s), line = font * 1.25;
  return { disc, font, w: Math.max(84, Math.round(108 * s)), h: disc + 10 + 2 * line + line * 0.95 };
}

/** The strike's signature as the ship draws it: the glyph, three dots over an upward arc. */
export const SIG_GLYPH = '<svg class="glyph" viewBox="0 0 20 16" aria-hidden="true"><circle cx="4.5" cy="2.2" r="1.7"/><circle cx="10" cy="2.2" r="1.7"/><circle cx="15.5" cy="2.2" r="1.7"/><path d="M3 15 Q10 4.5 17 15" fill="none" stroke-width="2.2" stroke-linecap="round"/></svg>';

const HEADER = 62;   // the title and the count, top left of the field
const PAD = 6;
const RING = { a0: -2.4, span: 6, r0: 0.75, p: 0.6 };   // tuned so 11 worlds fit an 860 x 650 field at full size

/** The footprint rectangle of a world whose disc centre is (x, y). */
export function boxRect(x, y, b) {
  return { x0: x - b.w / 2, x1: x + b.w / 2, y0: y - b.disc / 2, y1: y - b.disc / 2 + b.h };
}

const hits = (a, b, m) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;
const clear = (rects, m = 3) => { for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (hits(rects[i], rects[j], m)) return false; return true; };

function ring(n, W, H, s) {
  const b = worldBox(s), x0 = PAD, x1 = W - PAD, y0 = HEADER, y1 = H - PAD;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const Rx = (x1 - x0 - b.w) / 2, Ry = (y1 - y0 - b.h) / 2;
  const toDisc = (bx, by, bb) => [bx, by - bb.h / 2 + bb.disc / 2];   // box centre to disc centre
  const pts = [];
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(1, n - 1), a = RING.a0 + k * RING.span, r = RING.r0 + (1 - RING.r0) * Math.pow(k, RING.p);
    pts.push(toDisc(cx + Math.cos(a) * r * Rx, cy + Math.sin(a) * r * Ry, b));
  }
  const hb = worldBox(s * 0.8);
  const home = toDisc(cx, cy, hb);
  const rects = [...pts.map(([x, y]) => boxRect(x, y, b)), boxRect(home[0], home[1], hb)];
  if (Rx < 40 || Ry < 30 || !clear(rects) || rects.some((r) => r.x0 < 0 || r.x1 > W || r.y0 < HEADER - 4 || r.y1 > H)) return null;
  return { kind: 'ring', scale: s, box: b, homeBox: hb, pts, home, centre: [cx, cy] };
}

function snake(n, W, H) {
  const m = n + 1;   // the last place is home's
  let best = null;
  for (let cols = 2; cols <= m; cols++) {
    const rows = Math.ceil(m / cols), cw = (W - 2 * PAD) / cols, ch = (H - HEADER - PAD) / rows;
    let s = 1;
    for (; s > 0.5; s -= 0.025) { const b = worldBox(s); if (b.w + 6 <= cw && b.h + 6 <= ch) break; }
    if (!best || s > best.s + 1e-6) best = { s, cols, rows, cw, ch };
  }
  const { s, cols, cw, ch } = best, b = worldBox(s);
  const at = (i) => {
    const r = Math.floor(i / cols), c = r % 2 ? cols - 1 - (i % cols) : i % cols;
    return [PAD + cw * (c + 0.5), HEADER + ch * r + (ch - b.h) / 2 + b.disc / 2];
  };
  const pts = Array.from({ length: n }, (_, i) => at(i));
  return { kind: 'snake', scale: s, box: b, homeBox: b, pts, home: at(n), centre: null };
}

/**
 * Where the worlds go on a field of W x H px: n world discs along the route,
 * and home's place. A ring round home at the largest scale that fits (down to
 * 0.8), else a snake of rows. Footprints never overlap (worldBox, boxRect).
 */
export function chartLayout(n, W, H) {
  for (let s = 1; s >= 0.8 - 1e-6; s -= 0.025) { const L = ring(n, W, H, s); if (L) return L; }
  return snake(n, W, H);
}

// ------------------------------------------------------------------ the chart

const CSS = `
#starmap { position: fixed; inset: 0; z-index: 7000; display: none; place-items: center; background: rgba(20, 24, 44, 0.72); }
#starmap.open { display: grid; }
#starmap .chart { position: relative; display: grid; grid-template-columns: 1fr clamp(210px, 27%, 300px); width: min(1200px, 96vw); height: min(720px, 90vh);
  background: #1f2747; border: 2px solid #2b211f; box-shadow: 8px 8px 0 #2b211f; overflow: hidden; font: 13px/1.4 ui-monospace, Menlo, monospace; color: #f7ecd2; }
#starmap .chart::before { content: ''; position: absolute; inset: 0; opacity: .45; pointer-events: none;
  background-image: radial-gradient(#f7ecd2 1px, transparent 1.3px), radial-gradient(#f7ecd2 .7px, transparent 1px);
  background-size: 97px 89px, 41px 37px; background-position: 13px 7px, 0 0; }
#starmap .field { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
#starmap svg.route { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
#starmap h1 { position: absolute; left: 20px; top: 12px; margin: 0; font-size: 20px; letter-spacing: .2em; color: #f2c54b; }
#starmap .sub { position: absolute; left: 20px; top: 40px; opacity: .7; font-size: 12px; }
#starmap button.world { position: absolute; transform: translateX(-50%); padding: 0; border: 0; background: none; cursor: pointer; color: inherit; font: inherit; }
#starmap .world .disc { position: relative; display: block; margin: 0 auto; border-radius: 50%; transition: transform .15s; }
#starmap .world .disc::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; border: 2px solid transparent; }
#starmap .world svg.planet { display: block; width: 100%; height: 100%; overflow: visible; }
#starmap .world .name { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 10px; text-align: center; line-height: 1.25; text-shadow: 0 1px 0 #1f2747; }
#starmap .world .tag { display: block; text-align: center; line-height: 1.2; color: #9fe0d6; min-height: 1.2em; white-space: nowrap; }
#starmap .world .star { position: absolute; right: -7px; top: -7px; width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; background: #f2c54b; color: #2b211f; border: 2px solid #2b211f; font-size: 11px; line-height: 1; }
#starmap .world .sig { position: absolute; left: -7px; bottom: -5px; width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; background: #1f2747; border: 1.5px solid #cdb4ff; }
#starmap svg.glyph { width: 13px; height: 11px; fill: #cdb4ff; stroke: #cdb4ff; overflow: visible; }
#starmap .panel .sigline { display: flex; gap: 6px; align-items: baseline; font-size: 11px; letter-spacing: .04em; color: #5b3f8f; margin: -2px 0 8px; }
#starmap .panel .sigline svg.glyph { fill: #6a4aa8; stroke: #6a4aa8; flex: none; }
#starmap .legend { padding: 8px 10px; font-size: 11px; line-height: 1.35; color: #e9dcff; border: 1.5px dashed rgba(205, 180, 255, .55); background: rgba(31, 39, 71, .6); }
#starmap .legend b { color: #cdb4ff; letter-spacing: .08em; font-weight: normal; }
#starmap .legend svg.glyph { vertical-align: -1px; margin-right: 4px; }
#starmap .legend .short { display: none; }
#starmap.portrait .legend, #starmap.small .legend { padding: 3px 8px; font-size: 10px; }
#starmap.portrait .legend .long, #starmap.small .legend .long { display: none; }
#starmap.portrait .legend .short, #starmap.small .legend .short { display: inline; }
@media (max-height: 760px) { #starmap .legend .long { display: none; } #starmap .legend .short { display: inline; } }
#starmap .world.unvisited .disc::after { border: 2px dashed rgba(247, 236, 210, .75); }
#starmap .world.current .disc::after { border: 3px solid #e6875f; }
#starmap .world.current .tag { color: #e6875f; }
#starmap .world.home .disc { background: radial-gradient(circle at 50% 70%, #f6c89a 0 34%, #f2c54b 35% 38%, #4a5a8a 39%); border: 2.5px solid #f2c54b; box-sizing: border-box; }
#starmap .world.home .disc::before { content: '⌂'; position: absolute; inset: 0; display: grid; place-items: center; font-size: 26px; color: #2b211f; }
#starmap .world.home .tag { color: #f2c54b; }
#starmap .world.sel .disc, #starmap .world:hover .disc, #starmap .world:focus-visible .disc { transform: scale(1.08); }
#starmap .world.sel .disc::after { border: 3px solid #f2c54b; }
#starmap .world:focus { outline: none; }
#starmap .side { position: relative; display: flex; flex-direction: column; gap: 10px; min-height: 0; padding: 16px 16px 12px 0; }
#starmap .panel { flex: 0 1 auto; min-height: 0; overflow: auto; padding: 12px 14px; background: #f7ecd2; color: #2b211f; border: 2px solid #2b211f; box-shadow: 4px 4px 0 #2b211f; }
#starmap .panel .mini { float: right; width: 44px; height: 44px; margin: 0 0 4px 8px; }
#starmap .panel h2 { margin: 0 0 2px; font-size: 16px; letter-spacing: .05em; }
#starmap .panel .src { font-style: italic; opacity: .7; margin-bottom: 6px; font-size: 11px; }
#starmap .panel p { margin: 0 0 8px; font-size: 12px; clear: right; }
#starmap .panel .state { font-size: 11px; letter-spacing: .06em; color: #8a5a3c; margin-bottom: 8px; }
#starmap button.go, #starmap .confirm button { font: inherit; padding: 6px 12px; color: #2b211f; background: #f2c54b; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; cursor: pointer; }
#starmap button.go[disabled] { background: #d9c7a6; cursor: default; opacity: .7; }
#starmap .keys { margin-top: auto; opacity: .65; font-size: 11px; text-align: right; }
#starmap .close { position: absolute; right: 12px; top: 12px; z-index: 2; font: inherit; font-size: 13px; padding: 4px 10px; color: #f7ecd2; background: none; border: 1.5px solid rgba(247, 236, 210, .6); cursor: pointer; }
/* portrait (phones): the field on top, the panel under it */
#starmap.portrait .chart { grid-template-columns: 1fr; grid-template-rows: 1fr 292px; height: min(800px, 92vh); }
#starmap.portrait .side { padding: 0 10px 8px; gap: 4px; }
#starmap.portrait .panel { padding: 10px 12px; }
#starmap.portrait .panel p { font-size: 11.5px; margin-bottom: 6px; }
#starmap.portrait .sub { font-size: 11px; top: 36px; }
#starmap.portrait h1 { font-size: 16px; }
/* small landscape (a handheld): tighter panel */
#starmap.small .side { padding: 10px 10px 8px 0; gap: 6px; }
#starmap.small .panel { padding: 8px 10px; }
#starmap.small .panel h2 { font-size: 14px; }
#starmap.small .panel p { font-size: 11px; margin-bottom: 6px; }
#starmap.small .panel .mini { width: 34px; height: 34px; }
#starmap .confirm { position: absolute; inset: 0; z-index: 5; display: none; place-items: center; background: rgba(20, 24, 44, .62); }
#starmap.asking .confirm { display: grid; }
#starmap .confirm .card { max-width: min(380px, 86%); padding: 16px 20px 18px; text-align: center; background: #f7ecd2; color: #2b211f; border: 2px solid #2b211f; box-shadow: 6px 6px 0 #2b211f; }
#starmap .confirm .card .mini { display: block; width: 56px; height: 56px; margin: 0 auto 8px; }
#starmap .confirm h3 { margin: 0 0 4px; font-size: 17px; letter-spacing: .04em; }
#starmap .confirm .what { font-size: 12px; opacity: .75; margin-bottom: 14px; }
#starmap .confirm .row { display: flex; gap: 14px; justify-content: center; }
#starmap .confirm button.no { background: #efe3c6; }
#starmap .confirm button:focus { outline: 3px solid #e6875f; outline-offset: 2px; }
#starmap .confirm .hint { margin-top: 10px; font-size: 11px; opacity: .6; }
#starmap .locked { position: absolute; inset: 0; z-index: 6; display: none; place-items: center; background: rgba(31, 39, 71, .78); }
#starmap.nopower .locked { display: grid; }
#starmap .locked div { padding: 16px 26px; text-align: center; background: #3a1f22; border: 2px solid #e6503a; box-shadow: 6px 6px 0 #2b211f; color: #f7ecd2; }
#starmap .locked b { display: block; font-size: 22px; letter-spacing: .18em; color: #e6503a; margin-bottom: 6px; }
`;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const NEXT = ['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'], PREV = ['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'];

export class StarMap {
  /** @param o { order, levels, flag(), journal, current, powered(), home(), onTravel(id) } */
  constructor(o) {
    this.o = o;
    this.open = false;
    this.sel = 0;
    this.asking = null;   // the entry the "Travel to …?" question is about
    if (typeof document === 'undefined' || !document.body) return;
    if (!document.getElementById('starmap-css')) { const s = document.createElement('style'); s.id = 'starmap-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.el = document.createElement('div');
    this.el.id = 'starmap';
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      // a held key repeats (e.repeat): only a new press chooses or answers; and the E that
      // opened the map from the console must be let go first (_armed)
      const choose = !e.repeat && (e.code === 'Enter' || e.code === 'Space' || (e.code === 'KeyE' && this._armed));
      if (this.asking) {
        if (e.code === 'Escape' || e.code === 'Backspace') { this.answer(false); e.stopPropagation(); }
        else if (NEXT.includes(e.code) || PREV.includes(e.code) || e.code === 'Tab') { this.focusAnswer(this._yes ? 'no' : 'yes'); e.preventDefault(); }
        else if (choose) { this.answer(this._yes); e.preventDefault(); }
        return;
      }
      if (e.code === 'Escape') { this.toggle(false); e.stopPropagation(); }
      else if (NEXT.includes(e.code)) this.step(1);
      else if (PREV.includes(e.code)) this.step(-1);
      else if (choose) { this.go(); e.preventDefault(); }
    }, true);
    window.addEventListener('keyup', (e) => { if (e.code === 'KeyE') this._armed = true; });
    window.addEventListener('resize', () => { if (this.open) this.place(); });
  }

  /** The entries you can choose (known worlds, and home), as indices into entries. */
  choices() { return (this.entries ?? []).map((e, i) => (e.known ? i : -1)).filter((i) => i >= 0); }

  step(d) {
    const c = this.choices();
    if (!c.length) return;
    const at = c.indexOf(this.sel);
    this.select(c[(Math.max(0, at) + d + c.length) % c.length]);
  }

  render() {
    const o = this.o;
    this.entries = mapEntries(o);
    const W = typeof innerWidth !== 'undefined' ? innerWidth : 1200, H = typeof innerHeight !== 'undefined' ? innerHeight : 720;
    this.portrait = W < H * 0.9;
    this.el.classList.toggle('portrait', this.portrait);
    this.el.classList.toggle('small', !this.portrait && Math.min(H * 0.9, 720) < 480);
    const touch = document.body.classList.contains('touch');
    const pad = [...(navigator.getGamepads?.() ?? [])].some(Boolean);
    this.hints = pad ? 'pad' : touch ? 'touch' : 'keys';
    const worlds = this.entries.filter((e) => !e.home), known = worlds.filter((e) => e.known);
    const done = worlds.filter((e) => e.done).length;
    this.el.innerHTML = `<div class="chart">
      <div class="field">
        <svg class="route"></svg>
        <h1>GALACTIC MAP</h1><div class="sub">${known.length} worlds charted · ${done} ${done === 1 ? 'discovery' : 'discoveries'} made</div>
        ${this.entries.map((e, i) => e.known ? `<button class="world${e.done ? ' done' : ''}${e.visited ? '' : ' unvisited'}${e.current ? ' current' : ''}${e.home ? ' home' : ''}" data-i="${i}">
            <span class="disc">${e.home ? '' : planetSvg(e.id)}${e.done ? '<span class="star">✦</span>' : ''}${e.signature ? `<span class="sig" title="${SIGNATURE.toLowerCase()}">${SIG_GLYPH}</span>` : ''}</span>
            <span class="name">${e.title}</span><span class="tag">${e.current ? 'you are here' : e.home ? 'they are waiting' : e.visited ? '' : 'new'}</span></button>` : '').join('')}
        <button class="close">close ✕</button>
      </div>
      <div class="side">
        <div class="panel"></div>
        <div class="legend">${SIG_GLYPH}<b>${SIGNATURE}</b> · <span class="long">${SIGNATURE_LEGEND}</span><span class="short">${SIGNATURE_LEGEND_SHORT}</span></div>
        <div class="keys">${{ touch: 'tap a world, then Travel', pad: `D-pad choose · ${confirmKey()} travel · ${backKey()} close`, keys: '← → choose · Enter travel · Esc close' }[this.hints]}</div>
      </div>
      <div class="confirm"><div class="card"></div></div>
      <div class="locked"><div><b>NO POWER</b>The ship cannot fly.<br>Find a new source of power.</div></div>
    </div>`;
    this.el.classList.toggle('nopower', !o.powered?.());
    this.el.querySelector('.close').addEventListener('click', () => this.toggle(false));
    for (const b of this.el.querySelectorAll('button.world')) {
      b.addEventListener('click', () => { if (this.asking) return; if (this.sel === +b.dataset.i) this.go(); else this.select(+b.dataset.i); });
      b.addEventListener('mouseenter', () => { if (!this.asking) this.select(+b.dataset.i); });
    }
    this.el.querySelector('.confirm').addEventListener('click', (e) => { if (e.target.classList.contains('confirm')) this.answer(false); });   // a click beside the card: no
  }

  /** Lay the route out for the field's current size: the discs, the names, the dotted line. */
  place() {
    const field = this.el.querySelector('.field');
    if (!field) return;
    const W = field.clientWidth, H = field.clientHeight;
    const worlds = this.entries.filter((e) => !e.home), home = this.entries.find((e) => e.home);
    const L = (this.layout = chartLayout(worlds.length, W, H));
    const pos = (e) => (e.home ? L.home : L.pts[e.i]);
    for (const b of field.querySelectorAll('button.world')) {
      const e = this.entries[+b.dataset.i], bx = e.home ? L.homeBox : L.box, [x, y] = pos(e);
      Object.assign(b.style, { left: `${x}px`, top: `${y - bx.disc / 2}px`, width: `${bx.w}px`, fontSize: `${bx.font}px` });
      Object.assign(b.querySelector('.disc').style, { width: `${bx.disc}px`, height: `${bx.disc}px` });
    }
    const seg = (a, b, faint) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${faint ? 'rgba(247,236,210,.22)' : '#e6875f'}" stroke-width="${faint ? 1.2 : 1.6}" stroke-dasharray="${faint ? '2 7' : '4 5'}"/>`;
    let svg = '';
    if (L.centre) {
      svg += [0.5, 0.78, 1.05].map((r) => `<ellipse cx="${L.centre[0]}" cy="${L.centre[1]}" rx="${r * (W / 2 - PAD)}" ry="${r * ((H - HEADER) / 2 - PAD)}" fill="none" stroke="rgba(247,236,210,.13)" stroke-width="1"/>`).join('');
      if (!home) svg += `<circle cx="${L.home[0]}" cy="${L.home[1]}" r="${L.box.disc * 0.2}" fill="#f2c54b" stroke="#2b211f" stroke-width="2"/>`;   // the sun home goes round
    }
    for (let i = 1; i < worlds.length; i++) svg += seg(L.pts[i - 1], L.pts[i], !worlds[i].known || !worlds[i - 1].known);
    if (home) svg += `<path d="M${L.pts[worlds.length - 1].join(' ')} L${L.home.join(' ')}${L.centre ? ` L${L.pts[0].join(' ')}` : ''}" fill="none" stroke="#f2c54b" stroke-width="1.4" stroke-dasharray="2 6"/>`;
    // the worlds not known yet: faint dots, no names
    for (const e of worlds) if (!e.known) svg += `<circle cx="${L.pts[e.i][0]}" cy="${L.pts[e.i][1]}" r="${Math.max(3, L.box.disc * 0.07)}" fill="rgba(247,236,210,.3)"/>`;
    const route = field.querySelector('svg.route');
    route.setAttribute('viewBox', `0 0 ${W} ${H}`);
    route.innerHTML = svg;
  }

  select(i) {
    if (!this.entries?.[i]?.known) return;
    this.sel = i;
    const e = this.entries[i];
    for (const b of this.el.querySelectorAll('button.world')) b.classList.toggle('sel', +b.dataset.i === i);
    const p = this.el.querySelector('.panel');
    const sig = signatureReading(e.id, { visited: e.visited });
    p.innerHTML = `${e.home ? '' : planetSvg(e.id, { cls: 'mini' })}<h2>${e.title}</h2><div class="src">${e.source}</div><p>${e.blurb}</p>
      ${sig ? `<div class="sigline">${SIG_GLYPH}<span>SIGNATURE · ${sig}</span></div>` : ''}
      <div class="state">${e.current ? 'THE SHIP IS HERE' : e.home ? 'HOME' : e.done ? '✦ DISCOVERY MADE' : e.visited ? 'VISITED' : 'NOT YET VISITED'}</div>
      <button class="go"${e.current || !this.o.powered?.() ? ' disabled' : ''}>${e.current ? 'you are here' : 'Travel ▶'}</button>`;
    p.querySelector('.go').addEventListener('click', () => this.go());
  }

  /** Travel to the chosen world: ask first. */
  go() {
    const e = this.entries?.[this.sel];
    if (!e || !e.known || e.current || !this.o.powered?.() || this.asking) return;
    this.ask(e);
  }

  ask(e) {
    this.asking = e;
    this._askT = now();
    this._padA = this._padB = true;   // the A that asked must be let go before it answers
    const card = this.el.querySelector('.confirm .card');
    card.innerHTML = `${e.home ? '' : planetSvg(e.id, { cls: 'mini' })}<h3>Travel to ${e.title}?</h3>
      <div class="what">${e.home ? 'The ship will take you home.' : 'The ship will take off and fly there.'}</div>
      <div class="row"><button class="yes">Yes, fly ▶</button><button class="no">No</button></div>
      <div class="hint">${{ touch: '', pad: `${confirmKey()} yes · ${backKey()} no`, keys: 'Enter yes · Esc no' }[this.hints]}</div>`;
    card.querySelector('.yes').addEventListener('click', () => this.answer(true));
    card.querySelector('.no').addEventListener('click', () => this.answer(false));
    this.el.classList.add('asking');
    this.focusAnswer('yes');
  }

  focusAnswer(which) {
    this._yes = which === 'yes';
    this.el.querySelector(`.confirm .${which}`)?.focus();
  }

  answer(yes) {
    const e = this.asking;
    if (!e || (yes && now() - this._askT < 150)) return;   // one tap, seen twice (a touch and its click), is not an answer
    this.asking = null;
    this.el.classList.remove('asking');
    this._padA = this._padB = true;   // nor may the answer, held, act again on the map
    if (!yes) { this.el.querySelector(`button.world[data-i="${this.sel}"]`)?.focus({ preventScroll: true }); return; }
    this.toggle(false);
    this.o.onTravel(e.id);
  }

  toggle(on = !this.open) {
    if (!this.el) { this.open = on; return; }
    this.open = on;
    this._armed = false;   // the E that opened the map must not also choose
    this._padA = this._padB = true;   // nor the A that opened it (wait for a fresh press)
    this.asking = null;
    this.el.classList.remove('asking');
    this.el.classList.toggle('open', on);
    if (on) {
      this.render();
      this.place();
      const cur = this.entries.findIndex((e) => e.current);
      const next = this.entries.findIndex((e, i) => i > cur && e.known && !e.done && !e.home);
      const any = this.entries.findIndex((e) => e.known && !e.done && !e.current && !e.home);
      const home = this.o.flag?.('ending.done') ? -1 : this.entries.findIndex((e) => e.home && !e.current);   // they are waiting
      this.select(home >= 0 ? home : next >= 0 ? next : any >= 0 ? any : Math.max(0, cur));
      document.exitPointerLock?.();
    }
  }

  /** Gamepad: d-pad / stick to choose, A to travel, B to close; in the question, A yes and B no. */
  update() {
    if (!this.open || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find(Boolean);
    if (!gp) return;
    const b = (i) => !!gp.buttons[i]?.pressed;
    const x = (b(15) || b(13) ? 1 : 0) - (b(14) || b(12) ? 1 : 0) || Math.round(gp.axes[0] ?? 0);
    const now = performance.now();
    const A = b(padIndex('ok')), B = b(padIndex('back')), pressA = A && !this._padA, pressB = B && !this._padB;   // printed A / B (native-pad.js)
    this._padA = A; this._padB = B;
    if (this.asking) {
      if (x && now - (this._padT ?? 0) > 220) { this._padT = now; this.focusAnswer(this._yes ? 'no' : 'yes'); }
      if (pressA) this.answer(this._yes);
      else if (pressB) this.answer(false);
      return;
    }
    if (x && now - (this._padT ?? 0) > 220) { this._padT = now; this.step(x); }
    if (pressA) this.go();
    else if (pressB) this.toggle(false);
  }
}
