// ---------------------------------------------------------------------------
// The Arcade's games board (src/levels/arcade.js, docs/systems/minigames.md "The Arcade"): every game on
// one sheet, its name, its line and its best; choose one and its page opens (?game=<id>&from=arcade),
// without walking to its sign. The level's quick menu (level.quickMenu, as the References' list of views:
// main.js treats it as one of its menus, routes the pad to it and keeps the game still while it is open).
//
//   open / close   Tab (keyboard) · D-pad ↓ (pad: the potion's button, the menu takes it in this level)
//                  · the board by the way in (the interact button) · the small "games" button (touch, mouse)
//                  · B / ○ or Esc closes
//   move           mouse · arrows and Enter · d-pad or left stick and A / ×
// ---------------------------------------------------------------------------

import { gameHref } from '../minigames/index.js';
import { ARCADE } from '../minigames/kit/arcade.js';

const CSS = `
  #arcade-board-btn { position: fixed; left: calc(14px + var(--safe-left, env(safe-area-inset-left, 0px))); top: calc(14px + var(--safe-top, env(safe-area-inset-top, 0px))); z-index: 6;
    font: 700 11px/1 ui-monospace, Menlo, monospace; letter-spacing: 0.2em; text-transform: uppercase; color: #2b211f; padding: 8px 12px;
    background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; border-radius: 4px; cursor: pointer; }
  #arcade-board-btn:hover, #arcade-board-btn:focus { outline: none; background: #ffd866; }
  body.controller #arcade-board-btn, body.arcade-board #arcade-board-btn { display: none; }
  #arcade-board { position: fixed; inset: 0; z-index: 8000; display: none; place-items: center; color: #2b211f;
    font: 13px/1.4 ui-monospace, Menlo, monospace; background: rgba(43, 33, 31, 0.42); }
  #arcade-board.open { display: grid; }
  #arcade-board .sheet { position: relative; width: min(860px, 94vw); max-height: 90vh; overflow: auto; box-sizing: border-box; padding: 18px 24px 14px;
    background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 7px 7px 0 #2b211f; transform: rotate(-0.5deg); }
  #arcade-board .kicker { margin: 0 0 2px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #8a5a3c; }
  #arcade-board h1 { margin: 0 0 12px; font-size: 24px; letter-spacing: 0.14em; text-transform: uppercase; }
  #arcade-board .close { position: absolute; right: 14px; top: 12px; font: 700 16px/1 ui-monospace, Menlo, monospace; padding: 4px 9px; color: #2b211f; cursor: pointer;
    background: #fbf4e2; border: 2px solid #2b211f; border-radius: 4px; }
  #arcade-board .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
  #arcade-board .game { position: relative; display: grid; grid-template-columns: 14px 1fr; gap: 2px 10px; align-items: start; padding: 9px 10px 9px 9px; text-align: left;
    font: inherit; color: inherit; cursor: pointer; background: #fbf4e2; border: 2px solid #2b211f; box-shadow: 3px 3px 0 #2b211f; border-radius: 4px; }
  #arcade-board .game i { grid-row: span 3; width: 14px; height: 14px; margin-top: 2px; border: 2px solid #2b211f; border-radius: 50%; background: var(--c); }
  #arcade-board .game b { font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; }
  #arcade-board .game span { font-size: 11px; color: #4a3b33; }
  #arcade-board .game em { font-style: normal; font-size: 11px; color: #8a5a3c; }
  #arcade-board .game:hover, #arcade-board .game:focus { outline: none; background: #ffd866; }
  #arcade-board .game:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #2b211f; }
  #arcade-board footer { margin-top: 12px; font-size: 11px; color: #6b5a4e; }
  #arcade-board footer .pad { display: none; }
  body.controller #arcade-board footer .pad { display: inline; }
  body.controller #arcade-board footer .kb { display: none; }
`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class ArcadeBoard {
  /**
   * @param o.games  the games (src/minigames/index.js GAMES)
   * @param o.best   (game) => its best as text, or ''
   * @param o.go     (href) => void: open a game's page
   */
  constructor({ games, best = () => '', go = (href) => { location.href = href; }, win = globalThis.window, doc = globalThis.document }) {
    Object.assign(this, { games, best, go, win, doc });
    this.open = false;
    this.el = null;          // (main.js: the root of the pad's menu navigation while open)
    this.items = [];
    this.blocked = null;     // () => true while another menu has the screen (main.js)
    this.onKey = this.onKey.bind(this);
    if (win?.addEventListener) win.addEventListener('keydown', this.onKey, true);   // (capture: before the game's own keys; Tab is no lock-on here, there are no foes)
    this.addButton();
  }

  style() {
    if (this.styled || !this.doc?.head?.appendChild) return;
    this.styled = true;
    this.doc.head.appendChild(Object.assign(this.doc.createElement('style'), { textContent: CSS }));
  }

  addButton() {
    const doc = this.doc;
    if (!doc?.createElement || !doc.body?.append) return;
    this.style();
    const b = doc.createElement('button');
    b.id = 'arcade-board-btn';
    b.type = 'button';
    b.textContent = '▦ games';
    b.setAttribute('aria-label', 'The games board');
    b.addEventListener('click', (e) => { e.stopPropagation(); b.blur(); this.toggle(true); });
    doc.body.append(b);
    this.button = b;
  }

  build() {
    const doc = this.doc;
    if (!doc?.createElement || !doc.body?.append) return;
    this.style();
    this.el?.remove();
    const el = doc.createElement('div');
    el.id = 'arcade-board';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'The games board');
    el.innerHTML = `<div class="sheet"><p class="kicker">The Arcade</p><h1>The games</h1><button class="close" type="button" aria-label="Close">×</button>
      <div class="grid">${this.games.map((g) => {
        const best = this.best(g);
        return `<button class="game" type="button" data-id="${esc(g.id)}" style="--c:${esc(g.color ?? '#71d7cf')}"><i></i><b>${esc(g.name)}</b><span>${esc(g.blurb)}</span><em>${best ? `best ${esc(best)}` : 'no best yet'}</em></button>`;
      }).join('')}</div>
      <footer><span class="kb">arrows choose · Enter plays · Tab or Esc closes · in a game, [ and ] play the one before / after</span><span class="pad">D-pad or left stick choose · A / × plays · B / ○ closes · in a game, LB / RB play the one before / after</span></footer></div>`;
    this.items = [...el.querySelectorAll('button.game')];
    for (const b of this.items) {
      b.addEventListener('click', (e) => { e.stopPropagation(); this.choose(b.dataset.id); });
      b.addEventListener('mousemove', () => { if (doc.activeElement !== b) b.focus({ preventScroll: true }); });
    }
    el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); this.toggle(false); });
    el.querySelector('.sheet').addEventListener('click', (e) => e.stopPropagation());
    el.addEventListener('click', () => this.toggle(false));
    doc.body.append(el);
    this.el = el;
  }

  toggle(on = !this.open) {
    if (on === this.open) return this.open;
    if (on) {
      this.build();   // (drawn again on each opening: the bests as they are now)
      if (!this.el) return false;
      this.open = true;
      this.el.classList.add('open');
      this.doc.body.classList.add('arcade-board');
      this.doc.exitPointerLock?.();
      setTimeout(() => this.items[0]?.focus({ preventScroll: true }), 30);
    } else {
      this.open = false;
      this.el?.classList.remove('open');
      this.doc?.body?.classList.remove('arcade-board');
      if (this.el?.contains(this.doc.activeElement)) this.doc.activeElement.blur();
    }
    return this.open;
  }

  choose(id) {
    this.toggle(false);
    this.go(gameHref(id, ARCADE));
  }

  focused() { return Math.max(0, this.items.indexOf(this.doc?.activeElement)); }
  focus(i) { const b = this.items[i]; if (b) { b.focus({ preventScroll: true }); b.scrollIntoView?.({ block: 'nearest' }); } }

  /** Left / right: the game before / after; up / down: the one above / below in the grid. */
  navigate(x, y) {
    if (!this.open || !this.items.length) return;
    const n = this.items.length, at = this.focused();
    if (!this.doc.activeElement || !this.items.includes(this.doc.activeElement)) { this.focus(0); return; }
    if (!y) { this.focus(Math.max(0, Math.min(n - 1, at + Math.sign(x)))); return; }
    const top0 = this.items[0].offsetTop;
    const cols = Math.max(1, this.items.filter((b) => b.offsetTop === top0).length);
    const j = at + Math.sign(y) * cols;
    if (j >= 0 && j < n) this.focus(j);
  }

  onKey(e) {
    if (e.target?.closest?.('input, textarea, select')) return;
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (e.code === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (!this.open && this.blocked?.()) return;
      stop();
      if (!e.repeat) this.toggle();
      return;
    }
    if (!this.open) return;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
    if (dir) { stop(); this.navigate(...dir); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { stop(); if (!e.repeat) this.items[this.focused()]?.click(); }
    else if (e.code === 'Escape') { stop(); this.toggle(false); }
  }
}
