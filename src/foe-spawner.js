import { FOES } from './foes.js';
import { ENEMY_ROSTER, WORLD_ENEMIES } from './enemies/roster.js';
import { ATTACKS } from './enemies/attacks.js';
import { GUARDIANS, ArenaGuardians } from './arena-guardians.js';
import { TITLES } from './levels/names.js';

// The Arena's FOES list (docs/systems/foes.md, "The Arena"): every foe there is to fight, grouped (the ink and the
// worlds' kinds; each world's four enemies, src/enemies/roster.js; the temple guardians, src/arena-guardians.js),
// with a search and a world filter. Choose a foe and the waves stop: it comes in ahead of you, and again each time
// it falls (practice). A world's "waves from here" runs the Arena's cycle (foes.js ARENA_WAVES) from that world's
// first enemy; a guardian is called into a ring on the sand. Paper and ink, as the Arcade's board.
//
//   open / close   the FOES tab on the left edge (it says how) · D-pad ↓ (the mount's call: there is none here)
//                  · K on the keyboard · B / ○ or Esc closes
//   move           mouse · arrows and Enter · D-pad or left stick and A / × · LB / RB the world filter
//
//   const list = new FoeList();   (src/levels/arena.js: level.quickMenu, so main.js routes the pad to it)
//   list.attach({ foes, player, physics, sound, notice, scene, kind })   (main.js, once the foes are up)

const CSS = `
#foe-tab { position: fixed; left: calc(10px + env(safe-area-inset-left, 0px)); top: 14%; z-index: 30; display: grid; justify-items: start; gap: 4px;
  font: 12px ui-monospace, Menlo, monospace; color: #2b211f; }
#foe-tab button { font: 700 12px/1 ui-monospace, Menlo, monospace; letter-spacing: .2em; padding: 10px 7px; writing-mode: vertical-rl; cursor: pointer;
  background: #fffaf0; color: #2b211f; border: 2px solid #2b211f; box-shadow: 2px 2px 0 #2b211f; border-radius: 3px; }
#foe-tab button:hover, #foe-tab button:focus { outline: none; background: #ffd866; }
#foe-tab small { writing-mode: vertical-rl; font-size: 10px; letter-spacing: .08em; padding: 4px 3px; background: rgba(247, 236, 210, .85); border: 1px solid #2b211f; border-radius: 3px; }
#foe-tab .pad { display: none; } body.controller #foe-tab .pad { display: inline; } body.controller #foe-tab .kb { display: none; }
body.foe-list #foe-tab { display: none; }
#foe-list { position: fixed; inset: 0; z-index: 8000; display: none; place-items: center; color: #2b211f; font: 12px/1.35 ui-monospace, Menlo, monospace; background: rgba(43, 33, 31, .42); }
#foe-list.open { display: grid; }
#foe-list .sheet { position: relative; width: min(920px, 95vw); max-height: 90vh; display: grid; grid-template-rows: auto auto auto 1fr auto; box-sizing: border-box; padding: 16px 20px 10px;
  background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 7px 7px 0 #2b211f; }
#foe-list h1 { margin: 0 0 8px; font-size: 20px; letter-spacing: .14em; text-transform: uppercase; }
#foe-list .close { position: absolute; right: 12px; top: 10px; font: 700 16px/1 ui-monospace, Menlo, monospace; padding: 4px 9px; cursor: pointer; background: #fbf4e2; border: 2px solid #2b211f; border-radius: 4px; color: #2b211f; }
#foe-list input { font: inherit; padding: 6px 8px; border: 2px solid #2b211f; background: #fffaf0; color: #2b211f; margin-bottom: 6px; }
#foe-list .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
#foe-list .chips button { font: inherit; font-size: 11px; padding: 3px 7px; cursor: pointer; background: #fbf4e2; border: 1px solid #2b211f; border-radius: 10px; color: #2b211f; }
#foe-list .chips button.on { background: #2b211f; color: #f7ecd2; }
#foe-list .body { overflow: auto; padding-right: 4px; }
#foe-list section { margin-bottom: 10px; }
#foe-list h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #7a3a35; }
#foe-list .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px; }
#foe-list .row { text-align: left; font: inherit; padding: 5px 8px; min-height: 28px; cursor: pointer; background: #fffaf0; color: #2b211f; border: 2px solid #2b211f; box-shadow: 2px 2px 0 #2b211f; border-radius: 3px; }
#foe-list .row small { display: block; opacity: .6; font-size: 10px; }
#foe-list .row.on { background: #f2c54b; }
#foe-list .row.waves { font-size: 10px; letter-spacing: .1em; padding: 2px 7px; min-height: 0; box-shadow: none; text-transform: uppercase; }
#foe-list button:focus, #foe-list .row:hover { outline: none; background: #ffd866; }
#foe-list .empty { font-style: italic; opacity: .7; }
#foe-list footer { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; color: #6b5a4e; }
#foe-list footer .pad { display: none; } body.controller #foe-list footer .pad { display: inline; } body.controller #foe-list footer .kb { display: none; }
`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** A world's name as the game writes it (the roster's own titles are its sheets' folder names). */
const worldName = (w) => TITLES[w] ?? WORLD_ENEMIES[w]?.[0]?.worldTitle ?? w;
const CATEGORY = { 'local-creature': 'creature', 'possessed-machine': 'possessed machine', 'shadow-spirit': 'shadow spirit' };

/** The ink and the worlds' kinds, in the order they are met (the list's first section). */
export const SPAWN_KINDS = Object.keys(FOES);

/** The list's sections: { id, title, items: [{ kind | guardian, name, sub, search }] }. */
export function foeSections() {
  const ink = { id: 'ink', title: 'The ink and the worlds’ kinds', items: SPAWN_KINDS.map((k) => ({ kind: k, name: FOES[k].name, sub: `${FOES[k].hp} hp`, search: `${k} ${FOES[k].name} ink` })) };
  const worlds = Object.entries(WORLD_ENEMIES).map(([w, r]) => ({ id: w, title: worldName(w), waves: true, items: r.map((e) => {
    const moves = e.attacks.map((a) => ATTACKS[a]?.name ?? a);
    return { kind: e.id, name: e.name, sub: `${CATEGORY[e.category] ?? e.category} · ${moves.join(', ')}`, search: `${e.name} ${worldName(w)} ${e.worldTitle} ${w} ${CATEGORY[e.category] ?? ''} ${e.form} ${e.attacks.join(' ')} ${moves.join(' ')}` };
  }) }));
  const guardians = { id: 'guardians', title: 'Temple guardians', items: GUARDIANS.map((g) => ({ guardian: g.id, name: g.name, sub: `${g.world} · ${g.kind === 'robot' ? 'a machine: shoot it when it opens' : 'living: water when it pants'}`, search: `${g.name} ${g.world} ${g.id} guardian temple boss` })) };
  return [ink, ...worlds, guardians];
}

/** The world filter's stops, in order: All, the ink, each world, the guardians. */
export const FILTERS = ['all', 'ink', ...Object.keys(WORLD_ENEMIES), 'guardians'];

/** The sections kept by a search (every word in an item's name, world, kind or moves) and a world filter. */
export function filterSections(sections, { q = '', world = 'all' } = {}) {
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return sections.filter((s) => world === 'all' || s.id === world).map((s) => {
    const items = s.items.filter((i) => { const hay = `${i.search} ${s.title}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
    return { ...s, items };
  }).filter((s) => s.items.length);
}

export class FoeList {
  constructor({ win = globalThis.window, doc = globalThis.document } = {}) {
    Object.assign(this, { win, doc });
    this.open = false;
    this.el = null;      // (main.js: the root of the pad's menu navigation while open)
    this.items = [];
    this.blocked = null; // () => true while another menu has the screen (main.js)
    this.foes = null; this.guardians = null;
    this.sections = foeSections();
    this.filter = { q: '', world: 'all' };
    this.onKey = this.onKey.bind(this);
    if (win?.addEventListener) win.addEventListener('keydown', this.onKey, true);
  }

  /** The game's side, once it is up (main.js): the foes to send, the guardians' ring. `kind`: ?foe= to start on. */
  attach({ foes, player = foes?.player, physics = foes?.physics, sound = null, notice = () => {}, scene = foes?.scene, kind = null }) {
    this.foes = foes;
    this.guardians = new ArenaGuardians({ scene, player, physics, sound, notice });
    if (kind && (FOES[kind] || this.sections.some((s) => s.items.some((i) => i.kind === kind)))) foes.setPractice(kind);
    this.addTab();
    return this;
  }

  /** What a row does: { kind } practise it, { waves: world } the cycle from there (or on), { guardian }, { clear }. */
  choose(c) {
    const F = this.foes;
    if (!F) return;
    if (c.guardian) { F.setPractice(''); this.guardians?.call(c.guardian); }
    else {
      this.guardians?.dismiss();
      if (c.kind) F.setPractice(c.kind);
      else if (c.waves !== undefined) F.startWaves(c.waves || null);
      else if (c.clear) F.setPractice('');
    }
    this.sync();
  }

  update(dt, t) { this.guardians?.update(dt, t); }
  solids() { return this.guardians?.solids() ?? []; }

  style() {
    if (this.styled || !this.doc?.head?.appendChild) return;
    this.styled = true;
    this.doc.head.appendChild(Object.assign(this.doc.createElement('style'), { id: 'foe-spawner-css', textContent: CSS }));
  }

  /** The tab on the left edge, always there in the Arena, saying how to open the list. */
  addTab() {
    const doc = this.doc;
    if (!doc?.createElement || !doc.body?.append || this.tab) return;
    this.style();
    const t = doc.createElement('div');
    t.id = 'foe-tab';
    t.innerHTML = '<button type="button" aria-label="The list of foes">FOES ▸</button><small><span class="kb">K</span><span class="pad">D-pad ↓</span></small>';
    t.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); e.currentTarget.blur(); this.toggle(true); });
    doc.body.append(t);
    this.tab = t;
  }

  build() {
    const doc = this.doc;
    if (!doc?.createElement || !doc.body?.append) return;
    this.style();
    if (!this.el) {
      const el = doc.createElement('div');
      el.id = 'foe-list';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'The foes');
      el.innerHTML = `<div class="sheet"><h1>Foes</h1><button class="close" type="button" aria-label="Close">×</button>
        <input type="search" placeholder="Search: a name, a world, a move (crab, Vael, beam…)" aria-label="Search the foes">
        <div class="chips"></div><div class="body"></div>
        <footer><button class="row waves" type="button" data-a="waves">Waves again</button><button class="row waves" type="button" data-a="clear">Clear the field</button>
        <span class="kb">arrows choose · Enter fights · K or Esc closes</span><span class="pad">D-pad choose · A / × fights · LB / RB a world · B / ○ closes</span></footer></div>`;
      el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); this.toggle(false); });
      el.querySelector('.sheet').addEventListener('click', (e) => e.stopPropagation());
      el.addEventListener('click', () => this.toggle(false));
      const input = el.querySelector('input');
      input.addEventListener('input', () => { this.filter.q = input.value; this.render(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (input.value) { input.value = ''; this.filter.q = ''; this.render(); } else this.toggle(false); } });
      el.querySelector('footer').addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (b) this.choose(b.dataset.a === 'waves' ? { waves: null } : { clear: true }); });
      doc.body.append(el);
      this.el = el;
    }
    this.render();
  }

  /** The chips and the sections, as the filter says. */
  render() {
    if (!this.el) return;
    const title = (id) => (id === 'all' ? 'All' : id === 'ink' ? 'Ink' : id === 'guardians' ? 'Guardians' : worldName(id).replace(/^The /, ''));
    this.el.querySelector('.chips').innerHTML = FILTERS.map((w) => `<button type="button" data-world="${w}" class="${w === this.filter.world ? 'on' : ''}">${esc(title(w))}</button>`).join('');
    for (const b of this.el.querySelectorAll('.chips button')) b.addEventListener('click', (e) => { e.stopPropagation(); this.setWorld(b.dataset.world); });
    const shown = filterSections(this.sections, this.filter);
    this.el.querySelector('.body').innerHTML = shown.length ? shown.map((s) => `<section data-section="${s.id}"><h2>${esc(s.title)}${s.waves ? `<button class="row waves" type="button" data-waves="${s.id}">Waves from here</button>` : ''}</h2><div class="grid">${
      s.items.map((i) => `<button class="row" type="button" ${i.guardian ? `data-guardian="${i.guardian}"` : `data-kind="${esc(i.kind)}"`}>${esc(i.name)}<small>${esc(i.sub)}</small></button>`).join('')}</div></section>`).join('')
      : '<p class="empty">Nothing by that name.</p>';
    for (const b of this.el.querySelectorAll('.body button')) {
      b.addEventListener('click', (e) => { e.stopPropagation(); this.choose(b.dataset.guardian ? { guardian: b.dataset.guardian } : b.dataset.waves ? { waves: b.dataset.waves } : { kind: b.dataset.kind }); });
      b.addEventListener('mousemove', () => { if (this.doc.activeElement !== b) b.focus({ preventScroll: true }); });
    }
    this.items = [...this.el.querySelectorAll('.body button, footer button')];
    this.sync();
  }

  /** The current choice lit: the foe practised, the guardian out, or "Waves again" while the waves run. */
  sync() {
    if (!this.el) return;
    const F = this.foes, g = this.guardians?.id;
    for (const b of this.el.querySelectorAll('[data-kind]')) b.classList.toggle('on', !g && F?.practice?.kind === b.dataset.kind);
    for (const b of this.el.querySelectorAll('[data-guardian]')) b.classList.toggle('on', g === b.dataset.guardian);
    this.el.querySelector('[data-a="waves"]')?.classList.toggle('on', !F?.practice && !g);
  }

  setWorld(w) {
    this.filter.world = FILTERS.includes(w) ? w : 'all';
    this.render();
    if (this.open) setTimeout(() => this.focus(0), 0);
  }
  /** LB / RB (main.js turn): the world filter before / after, round. */
  turn(d) {
    const i = FILTERS.indexOf(this.filter.world), n = FILTERS.length;
    this.setWorld(FILTERS[(i + Math.sign(d) + n) % n]);
  }

  toggle(on = !this.open) {
    if (on === this.open) return this.open;
    if (on) {
      this.build();
      if (!this.el) return false;
      this.open = true;
      this.el.classList.add('open');
      this.doc.body.classList.add('foe-list');
      this.doc.exitPointerLock?.();
      setTimeout(() => this.focus(0), 30);
    } else {
      this.open = false;
      this.el?.classList.remove('open');
      this.doc?.body?.classList.remove('foe-list');
      if (this.el?.contains(this.doc.activeElement)) this.doc.activeElement.blur();
    }
    return this.open;
  }

  focused() { return Math.max(0, this.items.indexOf(this.doc?.activeElement)); }
  focus(i) { const b = this.items[i]; if (b) { b.focus({ preventScroll: true }); b.scrollIntoView?.({ block: 'nearest' }); } }

  /** Left / right: the row before / after; up / down: the one above / below in its grid. */
  navigate(x, y) {
    if (!this.open || !this.items.length) return;
    const n = this.items.length, at = this.focused();
    if (!this.items.includes(this.doc.activeElement)) { this.focus(0); return; }
    if (!y) { this.focus(Math.max(0, Math.min(n - 1, at + Math.sign(x)))); return; }
    // the nearest row in the next line down (or up): by its place on the screen, across sections
    const r0 = this.items[at].getBoundingClientRect(), cx = r0.left + r0.width / 2;
    let best = -1, bestD = Infinity;
    this.items.forEach((b, j) => {
      if (j === at) return;
      const r = b.getBoundingClientRect(), dy = (r.top - r0.top) * Math.sign(y);
      if (dy <= 2) return;
      const d = dy * 4 + Math.abs(r.left + r.width / 2 - cx);
      if (d < bestD) { bestD = d; best = j; }
    });
    if (best >= 0) this.focus(best);
  }

  onKey(e) {
    if (e.target?.closest?.('input, textarea, select')) return;
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (e.code === 'KeyK' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (!this.open && this.blocked?.()) return;
      stop();
      if (!e.repeat) this.toggle();
      return;
    }
    if (!this.open) return;
    if (e.code === 'Escape') { stop(); this.toggle(false); return; }
    if (e.key === '/') { stop(); this.el.querySelector('input')?.focus(); return; }
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (dirs[e.code]) { stop(); this.navigate(...dirs[e.code]); return; }
    if (e.code === 'PageUp' || e.code === 'BracketLeft') { stop(); this.turn(-1); return; }
    if (e.code === 'PageDown' || e.code === 'BracketRight') { stop(); this.turn(1); return; }
    if (e.code === 'Enter' || e.code === 'Space') { stop(); this.doc.activeElement?.click?.(); }
  }

  dispose() {
    this.guardians?.dismiss();
    this.win?.removeEventListener?.('keydown', this.onKey, true);
    this.el?.remove(); this.tab?.remove();
  }
}

/** The list without a level's quick menu (a world with waves but no FoeList of its own; tests): mounted now. */
export function mountFoeSpawner({ foes, kind = null, ...o } = {}) {
  return new FoeList().attach({ foes, kind, ...o });
}
