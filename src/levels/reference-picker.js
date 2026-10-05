// ---------------------------------------------------------------------------
// The References' quick menu (src/levels/references.js): every view at a glance, grouped by
// world and then by sheet, each with a tiny picture of its panel (cut from its sheet on a canvas
// with the view's own crop: no image files of its own), its number and its title. Choose one and
// the level fades straight to it (level.goTo).
//
//   open / close   Tab (keyboard) · X / □ (pad, free in this level: there is no mount to call)
//                  · the small "views" button at the top left (touch, mouse) · B / ○ or Esc closes
//   move           mouse · arrows and Enter · d-pad or left stick and A / × (main.js routes the pad
//                  here while it is open: level.quickMenu)
//
// The list is read from REFERENCE_VIEWS and REFERENCE_SHEETS when it is first opened, so views
// added to the view files show up by themselves. The thumbnails are drawn once, as each sheet
// image arrives (the current view's sheet first).
// ---------------------------------------------------------------------------

/** The world a view belongs to: its own `world`, its sheet's, or the start of its sheet's name ("The Desert / IMG_3775.JPG"). */
export function worldOf(view, sheets) {
  const sheet = sheets[view.sheet];
  return view.world ?? sheet?.world ?? String(sheet?.name ?? view.sheet).split(' / ')[0];
}

/**
 * The menu's entries: [{ world, sheets: [{ sheet, name, entries: [{ index, number, id, title, panel,
 * where, sheet, url, crop }] }] }], worlds and sheets in the order their first view comes in `views`.
 * number is the view's place in the level (index + 1, as the label and ?view=n count).
 */
export function pickerGroups(views, sheets) {
  const worlds = [], byWorld = new Map(), bySheet = new Map();
  views.forEach((v, index) => {
    const world = worldOf(v, sheets);
    let w = byWorld.get(world);
    if (!w) { w = { world, sheets: [] }; byWorld.set(world, w); worlds.push(w); }
    const key = `${world}|${v.sheet}`;
    let s = bySheet.get(key);
    if (!s) { s = { sheet: v.sheet, name: String(v.sheet), entries: [] }; bySheet.set(key, s); w.sheets.push(s); }
    s.entries.push({
      index, number: index + 1, id: v.id, title: v.title, panel: v.panel, where: v.where,
      sheet: v.sheet, url: sheets[v.sheet]?.url, crop: [...v.crop],
    });
  });
  return worlds;
}

/** The thumbnail's size (CSS px): the crop's proportions, fitted inside maxW × maxH. */
export function thumbSize(crop, maxW = 132, maxH = 84) {
  const [, , cw, ch] = crop, k = Math.min(maxW / cw, maxH / ch);
  return { w: Math.max(1, Math.round(cw * k)), h: Math.max(1, Math.round(ch * k)) };
}

/** Draw a view's panel (its crop of the sheet image) into a w × h canvas context. */
export function drawThumb(ctx, img, crop, w, h) {
  const [x, y, cw, ch] = crop;
  ctx.drawImage(img, x, y, cw, ch, 0, 0, w, h);
}

const CSS = `
  #ref-picker-btn { position: fixed; left: calc(14px + env(safe-area-inset-left, 0px)); top: calc(14px + env(safe-area-inset-top, 0px)); z-index: 6;
    font: 400 11px/1 'Avenir Next', Futura, 'Futura PT', 'Helvetica Neue', Roboto, sans-serif; letter-spacing: 0.3em; text-transform: uppercase;
    color: #2b211f; padding: 8px 10px 8px 12px; background: rgba(251, 246, 234, 0.78); border: 1px solid rgba(43, 33, 31, 0.35);
    border-radius: 4px; box-shadow: 0 4px 16px rgba(43, 33, 31, 0.12); cursor: pointer; backdrop-filter: blur(3px); }
  #ref-picker-btn:hover, #ref-picker-btn:focus { outline: none; background: #fffaf0; border-color: #2b211f; }
  body.controller #ref-picker-btn, body.ref-picking #ref-picker-btn { display: none; }
  #ref-picker { position: fixed; inset: 0; z-index: 8000; display: none; place-items: center; color: #2b211f;
    font: 12px/1.35 ui-monospace, Menlo, monospace; background: rgba(243, 231, 204, 0.42); backdrop-filter: blur(2px); }
  #ref-picker.open { display: grid; }
  #ref-picker .card { display: flex; flex-direction: column; width: min(1120px, 94vw); height: min(860px, 90vh); box-sizing: border-box;
    background: rgba(251, 246, 234, 0.9); border: 1px solid rgba(43, 33, 31, 0.35); border-radius: 6px;
    box-shadow: 0 10px 40px rgba(43, 33, 31, 0.22); backdrop-filter: blur(4px); overflow: hidden; }
  #ref-picker header { display: flex; align-items: baseline; gap: 14px; padding: clamp(8px, 2vh, 18px) clamp(12px, 2.4vw, 26px) clamp(4px, 1vh, 10px); }
  #ref-picker h2 { margin: 0; font: 300 clamp(15px, 2.8vh, 22px)/1.1 'Avenir Next', Futura, 'Futura PT', 'Helvetica Neue', Roboto, sans-serif;
    letter-spacing: 0.4em; text-transform: uppercase; }
  #ref-picker header .count { opacity: 0.6; font-size: 11px; }
  #ref-picker header .close { margin-left: auto; font: inherit; font-size: 16px; line-height: 1; padding: 4px 9px; color: #2b211f; cursor: pointer;
    background: rgba(255, 252, 244, 0.6); border: 1px solid rgba(43, 33, 31, 0.3); border-radius: 4px; }
  #ref-picker header .close:hover, #ref-picker header .close:focus { outline: none; background: #fffaf0; border-color: #2b211f; }
  #ref-picker .list { flex: 1; min-height: 0; overflow-y: auto; padding: 0 clamp(12px, 2.4vw, 26px) 14px; overscroll-behavior: contain; }
  #ref-picker .world h3 { position: sticky; top: 0; z-index: 1; margin: 0; padding: clamp(8px, 1.6vh, 14px) 2px 6px;
    font: 400 clamp(11px, 1.8vh, 13px)/1.2 'Avenir Next', Futura, 'Futura PT', 'Helvetica Neue', Roboto, sans-serif;
    letter-spacing: 0.38em; text-transform: uppercase; background: #faf4e6; border-bottom: 1px solid rgba(43, 33, 31, 0.22); }
  #ref-picker .world h3 span { letter-spacing: 0.06em; text-transform: none; opacity: 0.55; margin-left: 8px; }
  #ref-picker .sheet h4 { margin: 10px 2px 6px; font-size: 11px; font-weight: normal; letter-spacing: 0.08em; opacity: 0.7; }
  #ref-picker .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 8px; }
  #ref-picker .entry { position: relative; display: flex; flex-direction: column; gap: 5px; align-items: stretch; padding: 6px; text-align: left;
    font: inherit; color: inherit; cursor: pointer; background: rgba(255, 252, 244, 0.5); border: 1px solid rgba(43, 33, 31, 0.16); border-radius: 4px;
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s; scroll-margin: 52px 0 10px; }
  #ref-picker .entry .thumb { display: grid; place-items: center; height: 84px; background: rgba(43, 33, 31, 0.05); border-radius: 2px; }
  #ref-picker .entry canvas { display: block; box-shadow: 0 0 0 1px rgba(43, 33, 31, 0.4); opacity: 0; transition: opacity 0.25s; }
  #ref-picker .entry canvas.ready { opacity: 1; }
  #ref-picker .entry .txt { display: block; font-size: 11px; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  #ref-picker .entry .txt b { color: #c8483a; margin-right: 4px; letter-spacing: 0.04em; }
  #ref-picker .entry:hover { background: #fffaf0; border-color: rgba(43, 33, 31, 0.4); }
  #ref-picker .entry:focus { outline: none; background: #fffaf0; border-color: #2b211f; box-shadow: 0 2px 12px rgba(43, 33, 31, 0.18), inset 0 -3px 0 #f2c54b; }
  #ref-picker .entry.current { border-color: #c8483a; }
  #ref-picker .entry.current::after { content: 'here'; position: absolute; top: 9px; right: 9px; padding: 1px 5px; font-size: 9px; letter-spacing: 0.14em;
    text-transform: uppercase; color: #fff6dc; background: #c8483a; border-radius: 2px; }
  #ref-picker footer { padding: 7px clamp(12px, 2.4vw, 26px); font-size: 11px; opacity: 0.7; border-top: 1px solid rgba(43, 33, 31, 0.18); }
  #ref-picker footer .pad { display: none; }
  body.controller #ref-picker footer .pad { display: inline; }
  body.controller #ref-picker footer .kb { display: none; }
  @media (pointer: coarse) { body:not(.controller) #ref-picker footer { display: none; } }
`;

export class ReferencePicker {
  /**
   * @param o.views    the level's views (REFERENCE_VIEWS)
   * @param o.sheets   REFERENCE_SHEETS
   * @param o.current  () => the index of the view you are in (marked, and focused on opening)
   * @param o.goTo     (index) => the level fades to that view
   */
  constructor({ views, sheets, current = () => 0, goTo = () => {}, win = globalThis.window, doc = globalThis.document }) {
    Object.assign(this, { views, sheets, current, goTo, win, doc });
    this.open = false;
    this.el = null;            // the overlay (main.js: the root of the pad's menu navigation while open)
    this.items = [];           // the entries' buttons, in view order
    this.blocked = null;       // () => true while another menu or scene has the screen (main.js): Tab doesn't open over it
    this.loading = false;
    this.onKey = this.onKey.bind(this);
    if (win?.addEventListener) win.addEventListener('keydown', this.onKey, true);   // (capture: before the game's own keys)
    this.addButton();
  }

  /** The small button for touch and the mouse. */
  addButton() {
    const doc = this.doc;
    if (!doc?.createElement || !doc.body?.append) return;
    this.style();
    const b = doc.createElement('button');
    b.id = 'ref-picker-btn';
    b.type = 'button';
    b.setAttribute('aria-label', 'All the reference views');
    b.textContent = '▦ views';
    b.addEventListener('click', (e) => { e.stopPropagation(); b.blur(); this.toggle(true); });
    doc.body.append(b);
    this.button = b;
  }
  style() {
    if (this.styled || !this.doc?.head?.appendChild) return;
    this.styled = true;
    const css = this.doc.createElement('style');
    css.textContent = CSS;
    this.doc.head.appendChild(css);
  }

  /** The overlay and every entry, on the first opening (from the views as they are now). */
  build() {
    if (this.el || !this.doc?.createElement || !this.doc.body?.append) return;
    const doc = this.doc;
    this.style();
    this.groups = pickerGroups(this.views, this.sheets);
    const el = doc.createElement('div');
    el.id = 'ref-picker';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'All the reference views');
    const card = doc.createElement('div');
    card.className = 'card';
    card.innerHTML = `<header><h2>References</h2><span class="count">${this.views.length} views · ${this.groups.length} worlds</span>`
      + '<button class="close" type="button" aria-label="Close">×</button></header><div class="list"></div>'
      + '<footer><span class="kb">arrows choose · Enter goes there · Tab or Esc closes</span>'
      + '<span class="pad">D-pad or left stick choose · A / × goes there · B / ○ closes</span></footer>';
    const list = card.querySelector('.list');
    this.items = new Array(this.views.length);
    this.canvases = new Map();   // sheet → [{ canvas, entry, w, h }]
    const dpr = Math.min(2, this.win?.devicePixelRatio || 1);
    for (const w of this.groups) {
      const sec = doc.createElement('section');
      sec.className = 'world';
      const n = w.sheets.reduce((a, s) => a + s.entries.length, 0);
      sec.innerHTML = `<h3>${esc(w.world)}<span>${n} view${n === 1 ? '' : 's'}</span></h3>`;
      for (const s of w.sheets) {
        const block = doc.createElement('div');
        block.className = 'sheet';
        block.innerHTML = `<h4>${esc(s.name)} · ${s.entries.length} panel${s.entries.length === 1 ? '' : 's'}</h4><div class="grid"></div>`;
        const grid = block.querySelector('.grid');
        for (const e of s.entries) {
          const b = doc.createElement('button');
          b.type = 'button';
          b.className = 'entry';
          b.dataset.i = String(e.index);
          b.title = `${e.number}. ${e.title} (${s.name}, panel ${e.panel})`;
          const { w: tw, h: th } = thumbSize(e.crop);
          const c = doc.createElement('canvas');
          c.width = Math.round(tw * dpr); c.height = Math.round(th * dpr);
          c.style.width = `${tw}px`; c.style.height = `${th}px`;
          const thumb = doc.createElement('span');
          thumb.className = 'thumb';
          thumb.append(c);
          const txt = doc.createElement('span');
          txt.className = 'txt';
          txt.innerHTML = `<b>${e.number}</b>${esc(e.title)}`;
          b.append(thumb, txt);
          b.addEventListener('click', (ev) => { ev.stopPropagation(); this.choose(e.index); });
          b.addEventListener('mousemove', () => { if (doc.activeElement !== b) b.focus({ preventScroll: true }); });
          grid.append(b);
          this.items[e.index] = b;
          if (!this.canvases.has(e.sheet)) this.canvases.set(e.sheet, []);
          this.canvases.get(e.sheet).push({ canvas: c, entry: e });
        }
        sec.append(block);
      }
      list.append(sec);
    }
    card.querySelector('.close').addEventListener('click', (ev) => { ev.stopPropagation(); this.toggle(false); });
    card.addEventListener('click', (ev) => ev.stopPropagation());
    el.addEventListener('click', () => this.toggle(false));   // (a click beside the card closes it)
    el.append(card);
    doc.body.append(el);
    this.el = el;
    this.list = list;
  }

  /** The sheets, loaded once (the current view's first); each one's thumbnails are drawn as it arrives. */
  load() {
    if (this.loading || !this.canvases || typeof Image === 'undefined') return;
    this.loading = true;
    const first = this.views[this.current()]?.sheet;
    const order = [...this.canvases.keys()].sort((a, b) => (b === first) - (a === first));
    for (const key of order) {
      const url = this.sheets[key]?.url;
      if (!url) continue;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        for (const { canvas, entry } of this.canvases.get(key)) {
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.imageSmoothingQuality = 'high';
          drawThumb(ctx, img, entry.crop, canvas.width, canvas.height);
          canvas.classList.add('ready');
        }
      };
      img.src = url;
    }
  }

  toggle(on = !this.open) {
    if (on === this.open) return this.open;
    if (on) {
      this.build();
      if (!this.el) return false;
      this.open = true;
      this.el.classList.add('open');
      this.doc.body.classList.add('ref-picking');
      this.doc.exitPointerLock?.();
      const cur = this.current();
      for (const b of this.items) b?.classList.remove('current');
      this.items[cur]?.classList.add('current');
      this.focus(cur, 'center');
      this.load();
    } else {
      this.open = false;
      this.el?.classList.remove('open');
      this.doc?.body?.classList.remove('ref-picking');
      if (this.el?.contains(this.doc.activeElement)) this.doc.activeElement.blur();
    }
    return this.open;
  }

  /** Jump to view i (and close). */
  choose(i) {
    this.toggle(false);
    this.goTo(i);
  }

  focused() {
    const i = this.items.indexOf(this.doc?.activeElement);
    return i >= 0 ? i : this.current();
  }
  focus(i, block = 'nearest') {
    const b = this.items[i];
    if (!b) return;
    b.focus({ preventScroll: true });
    b.scrollIntoView({ block, inline: 'nearest' });
  }

  /**
   * Move the focus: left / right to the previous / next view (on along the rows), up / down to the
   * nearest entry in the row above / below (across the sheets' and worlds' headings too).
   */
  navigate(x, y) {
    if (!this.open || !this.items.length) return;
    const n = this.items.length, at = this.focused();
    if (!y) { this.focus(Math.max(0, Math.min(n - 1, at + Math.sign(x)))); return; }
    const r = this.items[at].getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ahead = [];
    this.items.forEach((b, i) => {
      const q = b.getBoundingClientRect(), dy = (q.top + q.height / 2 - cy) * Math.sign(y);
      if (i !== at && dy > r.height / 2) ahead.push({ i, dy, dx: Math.abs(q.left + q.width / 2 - cx) });
    });
    if (!ahead.length) return;
    // the nearest row first, then the entry closest across it
    const row = Math.min(...ahead.map((c) => c.dy));
    const best = ahead.filter((c) => c.dy < row + r.height / 2).sort((a, b) => a.dx - b.dx)[0];
    this.focus(best.i);
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
    else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { stop(); if (!e.repeat) this.choose(this.focused()); }
    else if (e.code === 'Escape') { stop(); this.toggle(false); }
    else if (e.code === 'Home' || e.code === 'End') { stop(); this.focus(e.code === 'Home' ? 0 : this.items.length - 1); }
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
