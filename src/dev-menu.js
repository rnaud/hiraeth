// The dev menu (issue #387; docs/systems/dev-tools.md "The dev menu"): one menu over the world you are in, on L3 + R3
// (both sticks), F2 or ` (backquote), or the Debug menu's "Dev menu" button on a touch screen. The game is paused under
// it, as under the other full-screen menus. Its tabs (src/world-debug.js devTabs) are turned with LB / RB (Q / E, [ ],
// PgUp / PgDn, ◀ ▶, a click on a tab or a side tab), its rows gone through with the D-pad, the stick or the arrows,
// A / × (Enter, a click) does what the row says, B / ○ (Esc) closes it. It is drawn in the game menu's frame
// (src/game-menu.css: the tab strip, the two side tabs, the sheet, the strip at the foot), five tabs of the strip in
// sight round the open one.
//
// It took in the old DEV MENU (the panel the backquote and the settings' button opened until v1.81): the items on and
// off, the boxes reset or opened, the story's switches, completing a world, travel to any world, motion matching.
// Those are its own acts (below, and the tests drive them without a page); the world's (a teleport, god mode, a film,
// a quest's stage…) go to `onAct` (main.js; engine/game.js in the engines, where engine/menus.js draws the same tabs).
//
//   const dev = new DevMenu({ levelId, levels, boxes, quests, story, onTravel, world: () => ({ points, … }), onAct });
//   dev.toggle(on?) · dev.turn(±1) · dev.move(±1) · dev.choose() · dev.act(a)
//   dev.setItem(id, on) · dev.allItems() · dev.noItems() · dev.resetBoxes() · dev.openAllBoxes() · dev.setFlag(k, v)
//   dev.completeWorld() · dev.travel(id)

import { game as sharedGame } from './game-state.js';
import { items, ITEMS } from './items.js';
import { devTabs, DevNav, tabWindow } from './world-debug.js';
import { glyph } from './pad-glyphs.js';
import { shipSetting } from './ship/selection.js';
import { travelSearch } from './world-travel.js';

/** The story's big switches on the Story tab: [flag, label]. */
export const STORY_FLAGS = [['prologue.done', 'Prologue done'], ['ship.powered', 'Ship powered'], ['desert.bike.found', 'Hoverbike found'], ['desert.tree.lit', 'Qanat’s tree lit'], ['tool.empty', 'Battery empty']];
/** How many tabs the strip shows round the open one (the engines' sheet has room for as many: BridgeMenu.cs DrawGame). */
export const TAB_STRIP = 5;

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export class DevMenu {
  /**
   * @param o.world   () → what devTabs takes from the world: { world, points, films, quests, toggles, save, notes, motion }
   * @param o.onAct   (act) a world's row chosen (a teleport, a switch, a film, a stage…): the host carries it out
   * @param o.onToggle (on) opened or closed
   * @param o.caps    the acts the host carries out (src/world-debug.js devTabs; null: all)
   * @param o.doc     the page's document (null: no page, the engines and the tests)
   */
  constructor({ levelId, levels = [], boxes = null, quests = null, story = null, onTravel = null, game: g = sharedGame, world = () => ({}), onAct = () => {}, onToggle = () => {}, caps = null,
    doc = typeof document !== 'undefined' && document?.head && typeof document.createElement === 'function' ? document : null } = {}) {
    Object.assign(this, { levelId, levels, boxes, quests, story, onTravel, g, world, onAct, onToggle, caps, doc });
    this.open = false;
    this.nav = new DevNav();
    this.tabs = [];
    this.dom = !!doc;
    if (!this.dom) return;
    const el = (this.el = doc.createElement('div'));
    el.id = 'devmenu';
    el.className = 'gamemenu';
    el.innerHTML = `<div class="gm pad-raw" role="dialog" aria-label="Dev menu">
        <nav class="gm-tabs"></nav>
        <button class="gm-close close" aria-label="Close the dev menu">${glyph('back', { key: 'Esc' })}✕</button>
        <div class="gm-stage">
          <button class="gm-side prev" data-go="-1"><span class="arrow">◀</span>${glyph('lb', { key: 'Q' })}<span class="nm"></span></button>
          <div class="gm-sheet"><div class="gm-body"></div></div>
          <button class="gm-side next" data-go="1"><span class="arrow">▶</span>${glyph('rb', { key: 'E' })}<span class="nm"></span></button>
        </div>
        <footer class="gm-info"><div class="gm-what"><b class="gm-name"></b><span class="gm-sub"></span></div><div class="gm-keys"></div></footer>
      </div>`;
    doc.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const tg = e.target.closest?.('[data-go], [data-tab], [data-at], .gm-close');
      if (!tg) return;
      e.preventDefault();
      if (tg.classList.contains('gm-close')) this.toggle(false);
      else if (tg.dataset.go) this.turn(+tg.dataset.go);
      else if (tg.dataset.tab) { this.nav.show(this.tabs, tg.dataset.tab); this.render(); }
      else {
        // a click (a tap) on a row does it, as A / × on it
        this.nav.at(this.tabs, +tg.dataset.at);
        this.choose();
      }
    });
    doc.defaultView?.addEventListener('keydown', (e) => this.key(e), { capture: true });
    this.offs = [items.on(() => this.open && this.refresh()), g.on?.('flag', () => this.open && this.refresh())];
  }

  toggle(on = !this.open) {
    if (on === this.open) return;
    this.open = on;
    if (on) { this.refresh(); this.doc?.exitPointerLock?.(); }
    else if (this.dom && this.el.contains(this.doc.activeElement)) this.doc.activeElement.blur();
    if (this.dom) this.el.classList.toggle('open', on);
    this.onToggle(on);
  }

  /** The tabs as they are now (the people move, a quest goes on, a switch flips), the cursor kept where it was. */
  build() {
    const counts = this.boxes?.counts?.()?.[this.levelId] ?? null;
    this.tabs = devTabs({ ...this.world(), levelId: this.levelId, levels: this.levels,
      items: Object.entries(ITEMS).map(([id, d]) => ({ id, name: d.name, kind: d.kind, on: items.has(id) })),
      flags: STORY_FLAGS.map(([k, label]) => [k, label, !!this.g.flag(k)]), boxes: counts, caps: this.caps });
    this.nav.fit(this.tabs);
    return this.tabs;
  }
  refresh() { this.build(); this.render(); this.changed?.(); }
  get tab() { return this.tabs[this.nav.tab] ?? null; }
  turn(d) { this.nav.turn(this.tabs, d); this.render(); this.changed?.(); }
  move(d) { this.nav.step(this.tabs, d); this.render(); this.changed?.(); }
  /** A / × (Enter, a click): the row's act. */
  choose() { const r = this.nav.current(this.tabs); if (r) this.act(r.act); }
  /** A row's act: the old dev menu's done here, the world's handed to the host; then drawn again. */
  act(a) {
    if (a.do === 'ship') shipSetting.set(a.id);
    else if (a.do === 'item') this.setItem(a.id, !items.has(a.id));
    else if (a.do === 'items') { if (a.all) this.allItems(); else this.noItems(); }
    else if (a.do === 'boxes') { if (a.open) this.openAllBoxes(); else this.resetBoxes(); }
    else if (a.do === 'flag') this.setFlag(a.key, !this.g.flag(a.key));
    else if (a.do === 'complete') this.completeWorld();
    else if (a.do === 'travel') { this.toggle(false); this.travel(a.id); return; }
    else if (a.do === 'page') { this.toggle(false); if (typeof location !== 'undefined') location.href = a.href; return; }
    else this.onAct(a);
    if (this.open) this.refresh();
  }

  // ------------------------------------------------------------------ the old dev menu's acts
  setItem(id, on) { return on ? items.grant(id) : items.revoke(id); }
  allItems() { for (const id of Object.keys(ITEMS)) items.grant(id); }
  noItems() { for (const id of Object.keys(ITEMS)) items.revoke(id); }
  /** Every box closed again, and the items they held taken back (so the boxes can be opened again). */
  resetBoxes() {
    this.noItems();
    for (const k of Object.keys(this.g.data?.flags ?? {})) if (k.startsWith('box.')) this.g.set(k, undefined);
    this.boxes?.rebuild?.();
  }
  openAllBoxes() { this.boxes?.openAll?.(); if (!this.boxes) this.allItems(); }
  setFlag(k, v) { this.g.set(k, !!v); }
  /** This world's main quests done (their own endings run: keepsakes, the ship's power), or at least its discovery flag. */
  completeWorld() {
    const q = this.quests;
    let any = false;
    if (q) for (const d of q.defs.values()) if (d.world === this.levelId && d.main && !q.isDone(d.id)) { if (!q.isStarted(d.id)) q.start(d.id); q.complete(d.id); any = true; }
    this.g.set(`world.${this.levelId}.done`, true);
    if (!any) this.story?.complete?.();
  }
  travel(id) { if (this.onTravel) this.onTravel(id); else if (typeof location !== 'undefined') travelSearch(`?level=${id}`); }

  // ------------------------------------------------------------------ the page
  /** The keyboard (capture: before the game's own keys see it). */
  key(e) {
    if ((e.code === 'F2' || e.code === 'Backquote') && !e.repeat) { e.preventDefault(); e.stopPropagation(); this.toggle(); return; }
    if (!this.open || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return;
    const turn = { KeyQ: -1, BracketLeft: -1, PageUp: -1, ArrowLeft: -1, KeyE: 1, BracketRight: 1, PageDown: 1, ArrowRight: 1 }[e.code];
    const step = { ArrowUp: -1, KeyW: -1, ArrowDown: 1, KeyS: 1 }[e.code];
    if (turn) this.turn(turn);
    else if (step) this.move(step);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { if (!e.repeat) this.choose(); }
    else if (e.code === 'Escape' || e.code === 'Backspace') this.toggle(false);
    else return;   // (the rest: the game's, which is paused under the menu)
    e.preventDefault(); e.stopPropagation();
  }
  /** The controller's menu actions (main.js hands them over while the menu is on top): true when taken. */
  pad(name, x = 0, y = 0) {
    if (!this.open) return false;
    if (name === 'navigate') { if (y) this.move(y); else if (x) this.turn(x); return true; }
    if (name === 'tabPrev' || name === 'tabNext') { this.turn(name === 'tabPrev' ? -1 : 1); return true; }
    if (name === 'confirm') { this.choose(); return true; }
    if (name === 'back' || name === 'worldDebug') { this.toggle(false); return true; }
    return false;
  }
  render() {
    if (!this.dom || !this.open) return;
    const tabs = this.tabs, n = this.nav, tab = this.tab, el = this.el;
    if (!tab) return;
    const [a, b] = tabWindow(tabs.length, n.tab, TAB_STRIP);
    el.querySelector('.gm-tabs').innerHTML = `${a > 0 ? '<span class="dv-more">…</span>' : ''}${tabs.slice(a, b).map((t, i) => `<button class="gm-tab${a + i === n.tab ? ' on' : ''}" data-tab="${esc(t.id)}">${esc(t.name)}</button>`).join('')}${b < tabs.length ? '<span class="dv-more">…</span>' : ''}`;
    const side = (d) => tabs[(n.tab + d + tabs.length) % tabs.length]?.name ?? '';
    el.querySelector('.gm-side.prev .nm').textContent = side(-1);
    el.querySelector('.gm-side.next .nm').textContent = side(1);
    const rows = tab.rows.map((r, i) => (r.head
      ? `<h3 class="dv-head">${esc(r.label)} <small>${esc(r.hint)}</small></h3>`
      : `<button type="button" class="dv-row${i === n.row ? ' at' : ''}${r.now ? ' now' : ''}" data-at="${i}"><b>${esc(r.label)}</b><small>${esc(r.hint)}</small>${
        r.state !== undefined ? `<em class="dv-state${r.state ? ' on' : ''}">${r.state ? 'on' : 'off'}</em>` : r.tag ? `<em class="dv-tag">${esc(r.tag)}</em>` : ''}</button>`)).join('');
    el.querySelector('.gm-body').innerHTML = `<h2>${esc(tab.title)} <span>${esc(tab.line)} · ${n.tab + 1} / ${tabs.length}</span></h2>${tab.note ? `<p class="dv-note">${esc(tab.note)}</p>` : ''}${
      rows ? `<div class="dv-rows">${rows}</div>` : `<p class="none">${esc(tab.empty ?? 'Nothing here.')}</p>`}`;
    const cur = n.current(tabs);
    el.querySelector('.gm-name').textContent = cur?.label ?? '';
    el.querySelector('.gm-sub').textContent = cur?.hint ?? '';
    el.querySelector('.gm-keys').innerHTML = cur ? `<span class="gm-act">${glyph('ok')}${esc(verb(cur))}</span>` : '';
    el.querySelector('.dv-row.at')?.scrollIntoView?.({ block: 'nearest' });
  }
}

/** What A / × does on a row, in the strip at the foot (the engines' too). */
export function verb(r) {
  const d = r?.act?.do;
  if (r?.state !== undefined) return r.state ? 'Turn off' : 'Turn on';
  return { tp: 'Teleport', film: 'Play', quest: 'Set', travel: 'Travel', picker: 'Open', page: 'Open', reload: 'Reload', shot: 'Take', flush: 'Send', hour: 'Set', heal: 'Heal' }[d] ?? 'Do it';
}
