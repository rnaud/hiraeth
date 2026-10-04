// The galactic map: a star chart over the screen when you use the cockpit
// console. The worlds (ORDER) lie along a dotted route that spirals out
// from home; each shows its thumbnail, title and what you have done there
// (visited / discovery made / you are here). Without power it is locked.
//
// Pure helpers (consoleAction, mapEntries) are used by the tests.
//
// Home sits at the centre, where the route begins; it is a destination once
// enough worlds are done (src/story/ending.js).

import { homeEntry } from '../story/ending.js';

/** What the console does when you press E: a pending call first, then the map, which needs power. */
export function consoleAction({ powered, pendingCall }) {
  if (pendingCall) return 'call';
  return powered ? 'map' : 'locked';
}

/** The list of worlds on the chart; Home is last, once the ending is open (src/story/ending.js). */
export function mapEntries({ order, levels, flag, journal, current, home }) {
  const out = order.map((id, i) => {
    const L = levels.find((l) => l.id === id) ?? { id, title: id };
    const done = !!(flag?.(`world.${id}.done`) || journal?.storyDone?.(id));
    const visited = !!(journal?.seen?.(id) || id === current || done);
    return { id, i, title: L.title, source: L.source ?? '', blurb: L.blurb ?? '', visited, done, current: id === current };
  });
  const h = homeEntry({ unlocked: typeof home === 'function' ? home() : !!home, current });
  if (h) out.push({ ...h, i: out.length });
  return out;
}

const CSS = `
#starmap { position: fixed; inset: 0; z-index: 7000; display: none; place-items: center; background: rgba(20, 24, 44, 0.72); }
#starmap.open { display: grid; }
#starmap .chart { position: relative; width: min(1100px, 94vw); height: min(680px, 86vh); background: #1f2747; border: 2px solid #2b211f;
  box-shadow: 8px 8px 0 #2b211f; overflow: hidden; font: 13px/1.4 ui-monospace, Menlo, monospace; color: #f7ecd2; }
#starmap .chart::before { content: ''; position: absolute; inset: 0; opacity: .5;
  background-image: radial-gradient(#f7ecd2 1px, transparent 1.3px), radial-gradient(#f7ecd2 .7px, transparent 1px);
  background-size: 97px 89px, 41px 37px; background-position: 13px 7px, 0 0; }
#starmap svg { position: absolute; inset: 0; width: 100%; height: 100%; }
#starmap h1 { position: absolute; left: 22px; top: 14px; margin: 0; font-size: 20px; letter-spacing: .2em; color: #f2c54b; }
#starmap .sub { position: absolute; left: 22px; top: 44px; opacity: .7; font-size: 12px; }
#starmap .keys { position: absolute; right: 18px; bottom: 12px; opacity: .65; font-size: 11px; }
#starmap button.world { position: absolute; transform: translate(-50%, -50%); width: 86px; padding: 0; border: 0; background: none; cursor: pointer; color: inherit; font: inherit; }
#starmap .world .disc { display: block; width: 62px; height: 62px; margin: 0 auto; border-radius: 50%; border: 2.5px solid #f7ecd2; overflow: hidden; background: #3d4380;
  box-shadow: 0 0 0 3px #1f2747, 0 0 0 4.5px rgba(247, 236, 210, .35); transition: transform .15s; }
#starmap .world img { width: 100%; height: 100%; object-fit: cover; filter: saturate(.85); }
#starmap .world .name { display: block; margin-top: 6px; font-size: 11px; text-align: center; line-height: 1.25; text-shadow: 0 1px 0 #1f2747; }
#starmap .world .tag { display: block; font-size: 10px; text-align: center; color: #9fe0d6; min-height: 13px; }
#starmap .world.done .tag { color: #f2c54b; }
#starmap .world.unvisited .disc { filter: grayscale(.8) brightness(.7); border-style: dashed; }
#starmap .world.current .disc { border-color: #e6875f; box-shadow: 0 0 0 3px #1f2747, 0 0 0 6px #e6875f; }
#starmap .world.home .disc { position: relative; background: radial-gradient(circle at 50% 70%, #f6c89a 0 34%, #f2c54b 35% 38%, #4a5a8a 39%); border-color: #f2c54b; }
#starmap .world.home .disc::after { content: '⌂'; position: absolute; inset: 0; display: grid; place-items: center; font-size: 30px; color: #2b211f; }
#starmap .world.home .tag { color: #f2c54b; }
#starmap .world.sel .disc, #starmap .world:hover .disc, #starmap .world:focus .disc { transform: scale(1.18); border-color: #f2c54b; }
#starmap .world:focus { outline: none; }
#starmap .panel { position: absolute; right: 18px; top: 18px; width: 270px; padding: 12px 14px; background: #f7ecd2; color: #2b211f; border: 2px solid #2b211f; box-shadow: 4px 4px 0 #2b211f; }
#starmap .panel h2 { margin: 0 0 2px; font-size: 16px; letter-spacing: .05em; }
#starmap .panel .src { font-style: italic; opacity: .7; margin-bottom: 6px; font-size: 11px; }
#starmap .panel p { margin: 0 0 8px; font-size: 12px; }
#starmap .panel .state { font-size: 11px; letter-spacing: .06em; color: #8a5a3c; margin-bottom: 8px; }
#starmap .panel button.go { font: inherit; padding: 6px 12px; background: #f2c54b; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; cursor: pointer; }
#starmap .panel button.go[disabled] { background: #d9c7a6; cursor: default; opacity: .7; }
#starmap .locked { position: absolute; inset: 0; display: none; place-items: center; background: rgba(31, 39, 71, .78); }
#starmap.nopower .locked { display: grid; }
#starmap .locked div { padding: 16px 26px; text-align: center; background: #3a1f22; border: 2px solid #e6503a; box-shadow: 6px 6px 0 #2b211f; color: #f7ecd2; }
#starmap .locked b { display: block; font-size: 22px; letter-spacing: .18em; color: #e6503a; margin-bottom: 6px; }
`;

export class StarMap {
  /** @param o { order, levels, flag(), journal, current, onTravel(id) } */
  constructor(o) {
    this.o = o;
    this.open = false;
    this.sel = 0;
    if (typeof document === 'undefined' || !document.body) return;
    if (!document.getElementById('starmap-css')) { const s = document.createElement('style'); s.id = 'starmap-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.el = document.createElement('div');
    this.el.id = 'starmap';
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      const n = this.entries.length;
      if (e.code === 'Escape') { this.toggle(false); e.stopPropagation(); }
      else if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].includes(e.code)) this.select((this.sel + 1) % n);
      else if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].includes(e.code)) this.select((this.sel + n - 1) % n);
      else if (e.code === 'Enter' || e.code === 'Space' || (e.code === 'KeyE' && !e.repeat && this._armed)) this.go();
    }, true);
    window.addEventListener('keyup', (e) => { if (e.code === 'KeyE') this._armed = true; });
  }

  /** Positions along a spiral, in percent of the chart. */
  layout(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const k = i / Math.max(1, n - 1);
      const a = -2.4 + k * Math.PI * 2.35, r = 0.28 + k * 0.72;
      out.push([38 + Math.cos(a) * r * 29, 52 + Math.sin(a) * r * 37]);
    }
    return out;
  }

  render() {
    const o = this.o;
    this.entries = mapEntries(o);
    const worlds = this.entries.filter((e) => !e.home);
    const pts = this.layout(worlds.length);
    const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
    pts.push(...this.entries.filter((e) => e.home).map(() => [38, 52]));   // home: the centre the route spirals out from
    this.el.innerHTML = `<div class="chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <ellipse cx="38" cy="52" rx="2.6" ry="4" fill="#f2c54b" stroke="#2b211f" stroke-width=".3"/>
        ${[0.3, 0.55, 0.8, 1.02].map((r) => `<ellipse cx="38" cy="52" rx="${r * 29}" ry="${r * 37}" fill="none" stroke="rgba(247,236,210,.18)" stroke-width=".15"/>`).join('')}
        <path d="${path}" fill="none" stroke="#e6875f" stroke-width=".35" stroke-dasharray="1 1.2" vector-effect="non-scaling-stroke"/>
      </svg>
      <h1>GALACTIC MAP</h1><div class="sub">${worlds.filter((e) => e.done).length} of ${worlds.length} worlds · discoveries made</div>
      ${this.entries.map((e, i) => `<button class="world${e.done ? ' done' : ''}${e.visited ? '' : ' unvisited'}${e.current ? ' current' : ''}${e.home ? ' home' : ''}" data-i="${i}" style="left:${pts[i][0]}%;top:${pts[i][1]}%">
          <span class="disc">${e.home ? '' : `<img src="thumbs/${e.id}.jpg" alt="" onerror="this.style.visibility='hidden'">`}</span>
          <span class="name">${e.title}</span><span class="tag">${e.current ? 'you are here' : e.home ? 'they are waiting' : e.done ? '✦ discovery made' : e.visited ? 'visited' : '· · ·'}</span></button>`).join('')}
      <div class="panel"></div>
      <div class="keys">← → choose · ENTER travel · ESC close</div>
      <div class="locked"><div><b>NO POWER</b>The ship cannot fly.<br>Find a new source of power.</div></div>
    </div>`;
    this.el.classList.toggle('nopower', !o.powered());
    for (const b of this.el.querySelectorAll('button.world')) {
      b.addEventListener('click', () => { if (this.sel === +b.dataset.i) this.go(); else this.select(+b.dataset.i); });
      b.addEventListener('mouseenter', () => this.select(+b.dataset.i));
    }
    this.select(this.sel);
  }

  select(i) {
    this.sel = i;
    const e = this.entries[i];
    for (const b of this.el.querySelectorAll('button.world')) b.classList.toggle('sel', +b.dataset.i === i);
    const p = this.el.querySelector('.panel');
    p.innerHTML = `<h2>${e.title}</h2><div class="src">${e.source}</div><p>${e.blurb}</p>
      <div class="state">${e.current ? 'THE SHIP IS HERE' : e.home ? 'HOME' : e.done ? 'DISCOVERY MADE' : e.visited ? 'VISITED' : 'NOT YET VISITED'}</div>
      <button class="go"${e.current || !this.o.powered() ? ' disabled' : ''}>${e.current ? 'you are here' : 'Travel ▶'}</button>`;
    p.querySelector('.go').addEventListener('click', () => this.go());
  }

  go() {
    const e = this.entries?.[this.sel];
    if (!e || e.current || !this.o.powered()) return;
    this.toggle(false);
    this.o.onTravel(e.id);
  }

  toggle(on = !this.open) {
    if (!this.el) { this.open = on; return; }
    this.open = on;
    this._armed = false;   // the E that opened the map must not also choose
    if (on) {
      this.render();
      const cur = this.entries.findIndex((e) => e.current);
      const next = this.entries.findIndex((e, i) => i > cur && !e.done && !e.home);
      const home = this.o.flag?.('ending.done') ? -1 : this.entries.findIndex((e) => e.home && !e.current);   // they are waiting
      this.select(home >= 0 ? home : next >= 0 ? next : (cur + 1) % this.entries.length);
      document.exitPointerLock?.();
    }
    this.el.classList.toggle('open', on);
  }

  /** Gamepad: d-pad / stick to choose, A to travel, B to close. */
  update() {
    if (!this.open || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gp = [...navigator.getGamepads()].find(Boolean);
    if (!gp) return;
    const b = (i) => gp.buttons[i]?.pressed;
    const x = (b(15) ? 1 : 0) - (b(14) ? 1 : 0) || Math.round(gp.axes[0] ?? 0);
    const now = performance.now();
    if (x && now - (this._padT ?? 0) > 220) { this._padT = now; this.select((this.sel + x + this.entries.length) % this.entries.length); }
    if (b(0) && !this._padA) this.go();
    if (b(1) && !this._padB) this.toggle(false);
    this._padA = b(0); this._padB = b(1);
  }
}
