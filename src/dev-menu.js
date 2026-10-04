import { game as sharedGame } from './game-state.js';
import { items, ITEMS } from './items.js';

// The developer's menu: ` (backquote) or the button in the settings panel.
// Items on and off, every box closed or opened, a jump to any world, the
// story's big switches. Paper-and-ink like the rest of the UI, big targets
// for touch. Works without a page too (the tests drive its methods).
//
//   const dev = new DevMenu({ levelId, levels, boxes, quests, story, onTravel });
//   dev.toggle(on?) · dev.setItem(id, on) · dev.allItems() · dev.noItems()
//   dev.resetBoxes() · dev.openAllBoxes() · dev.setFlag(k, v) · dev.completeWorld() · dev.travel(id)

const CSS = `
#devmenu { position: fixed; inset: 0; z-index: 9000; display: none; align-items: flex-start; justify-content: flex-end; pointer-events: none; }
#devmenu.open { display: flex; }
#devmenu .panel { pointer-events: auto; margin: calc(12px + env(safe-area-inset-top, 0px)) calc(12px + env(safe-area-inset-right, 0px)) 0 0; width: min(380px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px); overflow: auto; box-sizing: border-box; padding: 14px 16px 16px; background: #f7ecd2; border: 2px solid #2b211f; box-shadow: 6px 6px 0 #2b211f;
  font: 13px ui-monospace, Menlo, monospace; color: #2b211f; transform: rotate(.3deg); }
#devmenu h1 { margin: 0 0 4px; font-size: 16px; letter-spacing: .16em; display: flex; justify-content: space-between; align-items: center; }
#devmenu h1 button { font-size: 12px; padding: 4px 10px; }
#devmenu h2 { margin: 12px 0 6px; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #7a3a35; border-bottom: 1.5px solid #2b211f; padding-bottom: 2px; }
#devmenu .hint { margin: 0; font-size: 11px; opacity: .6; }
#devmenu label.item { display: flex; gap: 10px; align-items: center; padding: 5px 4px; min-height: 30px; cursor: pointer; border-bottom: 1px dashed rgba(43,33,31,.25); }
#devmenu label.item input { width: 20px; height: 20px; accent-color: #c8483a; flex: none; }
#devmenu label.item small { opacity: .55; margin-left: auto; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
#devmenu .btns { display: flex; flex-wrap: wrap; gap: 6px; }
#devmenu button { font: inherit; font-size: 12px; padding: 7px 10px; min-height: 34px; background: #fffaf0; border: 2px solid #2b211f; box-shadow: 2px 2px 0 #2b211f; cursor: pointer; color: #2b211f; }
#devmenu button:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 #2b211f; }
#devmenu button.here { background: #f2c54b; }
#devmenu .worlds { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
#devmenu .worlds button { text-align: left; }
`;

export class DevMenu {
  constructor({ levelId, levels = [], boxes = null, quests = null, story = null, onTravel = null, game: g = sharedGame } = {}) {
    Object.assign(this, { levelId, levels, boxes, quests, story, onTravel, g });
    this.open = false;
    this.dom = typeof document !== 'undefined' && !!document.head && typeof document.createElement === 'function';
    if (!this.dom) return;
    if (!document.getElementById('devmenu-css')) { const st = document.createElement('style'); st.id = 'devmenu-css'; st.textContent = CSS; document.head.appendChild(st); }
    const el = (this.el = document.createElement('div'));
    el.id = 'devmenu';
    document.body.appendChild(el);
    el.addEventListener('change', (e) => {
      const c = e.target;
      if (c.dataset.item) this.setItem(c.dataset.item, c.checked);
      if (c.dataset.flag) this.setFlag(c.dataset.flag, c.checked);
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest?.('button');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'close') this.toggle(false);
      else if (a === 'all') this.allItems();
      else if (a === 'none') this.noItems();
      else if (a === 'reset') this.resetBoxes();
      else if (a === 'openall') this.openAllBoxes();
      else if (a === 'complete') this.completeWorld();
      else if (b.dataset.level) this.travel(b.dataset.level);
      this.render();
    });
    window.addEventListener('keydown', (e) => { if (e.code === 'Backquote' && !e.repeat) this.toggle(); });
    this.offs = [items.on(() => this.open && this.render()), g.on('flag', () => this.open && this.sync())];
  }

  toggle(on = !this.open) {
    this.open = on;
    if (!this.dom) return;
    if (on) { this.render(); document.exitPointerLock?.(); }
    this.el.classList.toggle('open', on);
  }

  // ------------------------------------------------------------------ actions
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
  travel(id) { if (this.onTravel) this.onTravel(id); else if (typeof location !== 'undefined') location.search = `?level=${id}`; }

  // ------------------------------------------------------------------ the page
  sync() {
    if (!this.dom) return;
    for (const c of this.el.querySelectorAll('[data-item]')) c.checked = items.has(c.dataset.item);
    for (const c of this.el.querySelectorAll('[data-flag]')) c.checked = !!this.g.flag(c.dataset.flag);
  }
  render() {
    if (!this.dom || !this.open) return;
    const counts = this.boxes?.counts?.()[this.levelId];
    const itemRows = Object.entries(ITEMS).map(([id, d]) => `<label class="item"><input type="checkbox" data-item="${id}"${items.has(id) ? ' checked' : ''}>${d.name}<small>${d.kind}</small></label>`).join('');
    const flag = (k, label) => `<label class="item"><input type="checkbox" data-flag="${k}"${this.g.flag(k) ? ' checked' : ''}>${label}<small>${k}</small></label>`;
    const worlds = this.levels.map((l) => `<button data-level="${l.id}"${l.id === this.levelId ? ' class="here"' : ''}>${l.title}</button>`).join('');
    this.el.innerHTML = `<div class="panel">
      <h1>DEV MENU <button data-a="close" type="button">close \`</button></h1>
      <p class="hint">\` toggles this panel · changes apply at once</p>
      <h2>Items</h2>${itemRows}
      <div class="btns" style="margin-top:8px"><button data-a="all" type="button">all items</button><button data-a="none" type="button">no items</button></div>
      <h2>Boxes${counts ? ` · here ${counts.found}/${counts.total}` : ''}</h2>
      <div class="btns"><button data-a="reset" type="button">reset boxes</button><button data-a="openall" type="button">open all boxes</button></div>
      <p class="hint">reset also takes the items back, so every box can be opened again</p>
      <h2>Story</h2>${flag('prologue.done', 'Prologue done')}${flag('ship.powered', 'Ship powered')}
      <div class="btns" style="margin-top:8px"><button data-a="complete" type="button">complete current world</button></div>
      <h2>Teleport</h2><div class="worlds">${worlds}</div>
    </div>`;
  }
}
