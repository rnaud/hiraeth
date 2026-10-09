// The game menu (View / Select, J, the touch ❏; the Start menu's Items and Quests): since October
// 2026 it takes the sketchbook's place. After the pause screen of Ocarina of Time, drawn in the
// game's own ink and paper: five panels side by side, turned with the shoulder buttons (LB / L1,
// RB / R1; Q / E or [ ] on a keyboard; the tabs and the side arrows with a mouse or a finger), the
// neighbours' names at the sheet's sides; inside a panel a cursor moves over a grid of cells with the
// stick, the D-pad or the arrows; the cell's name and what it is in the strip at the bottom, with the
// buttons that do something here. A / × uses or looks (an item's gun mode, a quest tracked, a sketch
// held up), B / ○ closes the menu from anywhere in it (there is nothing to go back to: the panels are
// side by side). Moving off a row's end rests on the side tab first, as on the N64; once more turns.
//
//   Items       the gear (the makers' items, each drawn by the game's own pipeline: src/item-icons.js),
//               what you carry for the quests, the keepsakes for the father's charge
//   Quests      the father's charge and each quest under way: its overall goal and its next step only
//               (src/story/quests.js summary), the one tracked first; the finished ones by title, a short list
//   Sketchbook  the Sightings (every trace of the singing light, the makers' sign and the father's signal
//               met so far, a ? for each still to find), every world's story page and relics, the errands'
//               and the observatory's sketches
//   Worlds      the worlds you know, in the route's order: their picture, story, relics and boxes
//   People      everyone you have talked to, a card each grouped by world (their portrait, name, role); A / ×
//               opens one: what you know of them, where they are now, what passed between you; B / ○ back
//               to the cards (src/story/people-book.js). The cards' grid moves by where the cards are on the
//               screen (gridStep, src/menu-pad.js: data-grid-nav), so it is right at any width.
//
// What fills the panels comes from `sources` (src/game-menu-data.js, wired in main.js). The cursor and
// the panels are plain state (MenuState, moveCursor) so tests can drive them without a page.

import { escapeHtml, inputKind, keyText } from './prompt-keys.js';
import { glyph } from './pad-glyphs.js';
import { gridStep } from './menu-pad.js';
import { t, onLanguage } from './i18n.js';
import { chimeIcon } from './chime-icon.js';

// (the names in the language now: src/i18n.js)
export const PANELS = ['items', 'quests', 'sketches', 'worlds', 'people'].map((id) => ({ id, get name() { return t(`gm.${id}`); } }));
/** The people's cards: this many a row (as the cursor counts them without a page; on one, where they are drawn). */
export const PEOPLE_COLS = 4;
/** The gear's grid: this many slots a row. */
export const GEAR_COLS = 8;
/** The Sightings' notes: this many a row. */
export const SIGHT_COLS = 5;
/** The worlds' cards: this many a row. */
export const WORLD_COLS = 4;

const esc = escapeHtml;

// ------------------------------------------------------------------ the cursor

/**
 * Move the cursor over a panel's rows of cells (each cell { col }: its place across the panel).
 * `at` { r, c } or { edge: -1 | 1 } (resting on a side tab). Left / right walk along the row; past its
 * end the cursor rests on that side's tab (`edge`), and once more turns the panel ({ turn: ±1 }).
 * Up / down go to the next row that has a cell in the same column (wrapping), else the nearest one.
 * Returns the new { r, c } / { edge } / { turn }.
 */
export function moveCursor(rows, at = { r: 0, c: 0 }, dx = 0, dy = 0) {
  const n = rows.length;
  if (at.edge) {
    if (dx === at.edge) return { turn: at.edge };
    if (dx === -at.edge || dy) {
      if (!n) return { r: 0, c: 0 };
      // back in from the side: the row nearest the middle, its cell on that side
      const r = Math.min(at.r ?? 0, n - 1);
      return { r, c: at.edge > 0 ? rows[r].length - 1 : 0 };
    }
    return at;
  }
  if (!n) return dx ? { edge: Math.sign(dx), r: 0 } : { r: 0, c: 0 };
  let r = Math.min(Math.max(at.r ?? 0, 0), n - 1), c = Math.min(Math.max(at.c ?? 0, 0), rows[r].length - 1);
  if (dx) {
    const nc = c + Math.sign(dx);
    if (nc < 0 || nc >= rows[r].length) return { edge: Math.sign(dx), r };
    return { r, c: nc };
  }
  if (dy) {
    const col = rows[r][c]?.col ?? c;
    for (let k = 1; k < n; k++) {
      const nr = (r + Math.sign(dy) * k + n * k) % n;
      const same = rows[nr].findIndex((x) => (x.col ?? 0) === col);
      if (same >= 0) return { r: nr, c: same };
    }
    // no row has that column: the next row, its nearest cell
    const nr = (r + Math.sign(dy) + n) % n;
    let best = 0;
    rows[nr].forEach((x, i) => { if (Math.abs((x.col ?? i) - col) < Math.abs((rows[nr][best].col ?? best) - col)) best = i; });
    return { r: nr, c: best };
  }
  return { r, c };
}

/** Which panel shows and where the cursor is on each (kept while the game runs: the menu opens where you left it). */
export class MenuState {
  constructor(panels = PANELS) { this.panels = panels; this.i = 0; this.at = {}; }
  get panel() { return this.panels[this.i]; }
  cursor(id = this.panel.id) { return (this.at[id] ??= { r: 0, c: 0 }); }
  show(id) { const i = this.panels.findIndex((p) => p.id === id); if (i >= 0) this.i = i; return this.panel; }
  turn(d) {
    const n = this.panels.length;
    this.i = (this.i + Math.sign(d) + n) % n;
    // arriving from a side: the cursor where it was on that panel (off the tab)
    const at = this.at[this.panel.id];
    if (at?.edge) this.at[this.panel.id] = { r: at.r ?? 0, c: 0 };
    return this.panel;
  }
  neighbours() { const n = this.panels.length; return { prev: this.panels[(this.i - 1 + n) % n], next: this.panels[(this.i + 1) % n] }; }
  /** Move on the current panel (its rows); a move past the side tab turns the panel. Returns 'turn' then. */
  move(rows, dx, dy) {
    const to = moveCursor(rows, this.cursor(), dx, dy);
    if (to.turn) { this.turn(to.turn); return 'turn'; }
    this.at[this.panel.id] = to;
    return 'move';
  }
  /** The cell under the cursor (null on a tab or an empty panel). */
  cell(rows) { const at = this.cursor(); return at.edge ? null : rows[at.r]?.[at.c] ?? null; }
}

// ------------------------------------------------------------------ the panels (pure: data → { html, rows })

const cellAttrs = (r, c) => `data-at="${r},${c}"`;
/** An item's picture: the game's own render of it (src/item-icons.js), or its kind's mark until that is ready. */
const KIND_MARK = { core: '◍', movement: '➶', mode: '◐', upgrade: '✚', charm: '✧', pass: '▭', cosmetic: '✦', quest: '⧉', keepsake: '✦' };
const icon = (it) => it.icon
  ? `<img class="ico" src="${esc(it.icon)}" alt="" data-icon="${esc(it.id)}">`
  : `<i class="ico mark" data-icon="${esc(it.id)}">${KIND_MARK[it.kind] ?? '✧'}</i>`;
const KINDS = ['core', 'movement', 'mode', 'gadget', 'upgrade', 'charm', 'pass', 'cosmetic', 'quest', 'keepsake'];
const KIND_NAME = Object.defineProperties({}, Object.fromEntries(KINDS.map((k) => [k, { get: () => t(`gm.kind.${k}`), enumerable: true }])));

/**
 * Items: { gear: [{ id, name, kind, text, use, icon, inUse, usable }], slots, pack: [{ id, name }], keepsakes: [{ id, name, text, world }],
 * chimes (the wallet, shown by the gear's heading; null: not shown) }.
 * The gear's grid (a slot for each item there is to find: the empty ones drawn but not named, so nothing
 * is given away but how many), under it what you carry for the quests and the keepsakes for the father's
 * charge, side by side; beside it all, the picked one large, as the N64's Equipment screen shows its hero.
 * Rows: the grid's, then a row a line of the pack (column 0) and of the keepsakes (column CARRY_COL).
 */
export const CARRY_COL = 4;
export function itemsPanel({ gear = [], slots = 0, pack = [], keepsakes = [], chimes = null } = {}) {
  const rows = [];
  gear.forEach((it, i) => { (rows[Math.floor(i / GEAR_COLS)] ??= []).push({ col: i % GEAR_COLS, kind: 'item', id: it.id, name: it.name, sub: KIND_NAME[it.kind] ?? '', desc: [it.text, it.use].filter(Boolean).join(' '), act: it.usable ? 'use' : null, it }); });
  const packs = pack.map((it) => ({ kind: 'pack', id: it.id, name: it.name, sub: KIND_NAME.quest, desc: t('gm.carried'), act: null, it: { ...it, kind: 'quest' } }));
  const keeps = keepsakes.map((it) => ({ kind: 'keepsake', id: it.id, name: it.name, sub: `${KIND_NAME.keepsake}${it.world ? ` · ${t('gm.fromWorld', { world: it.world })}` : ''}`, desc: it.text ?? '', act: null, it: { ...it, kind: 'keepsake' } }));
  const g = rows.length;
  for (let k = 0; k < Math.max(packs.length, keeps.length); k++) rows.push([...(packs[k] ? [{ ...packs[k], col: 0 }] : []), ...(keeps[k] ? [{ ...keeps[k], col: CARRY_COL }] : [])]);
  const where = (kind, id) => { for (let r = 0; r < rows.length; r++) { const c = rows[r].findIndex((x) => x.kind === kind && x.id === id); if (c >= 0) return cellAttrs(r, c); } return ''; };
  const slot = (it) => `<button class="slot${it.inUse ? ' inuse' : ''}" ${where('item', it.id)} aria-label="${esc(it.name)}">${icon(it)}${it.inUse ? `<em>${t('gm.inUse')}</em>` : ''}</button>`;
  const empties = Array.from({ length: Math.max(0, slots - gear.length) }, () => '<span class="slot empty" aria-hidden="true"></span>').join('');
  const line = (x) => `<button class="line ${x.kind}" ${where(x.kind, x.id)}>${icon(x.it)}<span>${esc(x.name)}</span></button>`;
  const html = `<div class="gm-items">
    <div class="gm-left">
      <section class="gm-gear"><h2>${t('gm.gear')} <span>${slots ? t('gm.gearCount', { n: gear.length, m: slots }) : gear.length}</span>${chimes !== null ? `<span class="gm-wallet" title="${esc(t('hud.chimes'))}">${chimeIcon('chime')}${t('gm.chimes', { n: chimes })}</span>` : ''}</h2>
        <div class="grid" style="--cols:${GEAR_COLS}">${gear.map(slot).join('')}${empties}</div></section>
      <div class="gm-carry">
        <section><h2>${t('gm.pack')}</h2>${packs.map(line).join('') || `<p class="none">${t('gm.packNone')}</p>`}</section>
        <section><h2>${t('gm.keepsakes')} <span>${keeps.length}</span></h2>${keeps.map(line).join('') || `<p class="none">${t('gm.keepNone')}</p>`}</section>
      </div>
    </div>
    <aside class="gm-preview" aria-hidden="true"></aside></div>`;
  return { html, rows, gearRows: g };
}

/**
 * Quests: { charge: { title, goal, step, worlds } | null, active: [{ id, title, goal, step, main, tracked }],
 * errands: [{ id, title, goal, step }], done: [{ id, title, outro }], failed: [...] }.
 * Each quest under way shows its overall goal and its next step, nothing else (no steps done, no history);
 * the finished and failed ones are a short list of titles beside them (ENDED of each).
 */
export const ENDED = 6;
export function questsPanel({ charge = null, active = [], errands = [], done = [], failed = [] } = {}) {
  const rows = [];
  const main = [];
  if (charge) main.push({ kind: 'charge', id: 'charge', name: charge.title, sub: t('gm.charge'), desc: `${charge.goal}. ${charge.worlds ?? ''}`.trim(), act: null, q: charge });
  for (const q of active) main.push({ kind: 'quest', id: q.id, name: q.title, sub: q.tracked ? t('gm.tracked') : (q.main ? t('gm.mainQuest') : t('gm.errand')), desc: `${q.goal}.`, act: q.tracked ? null : 'track', q });
  for (const q of errands) main.push({ kind: 'errand', id: q.id, name: q.title, sub: t('gm.parcel'), desc: `${q.goal}.`, act: null, q });
  const ended = [...done.slice(0, ENDED).map((q) => ({ ...q, failed: false })), ...failed.slice(0, ENDED).map((q) => ({ ...q, failed: true }))];
  const side = ended.map((q) => ({ kind: 'ended', id: q.id, name: q.title, sub: q.failed ? t('gm.failed') : t('gm.complete'), desc: q.outro ?? '', act: null, q }));
  const n = Math.max(main.length, side.length);
  for (let r = 0; r < n; r++) {
    const row = [];
    if (main[r]) row.push({ ...main[r], col: 0 });
    if (side[r]) row.push({ ...side[r], col: 1 });
    rows.push(row);
  }
  const at = (kind, id) => { for (let r = 0; r < rows.length; r++) { const c = rows[r].findIndex((x) => x.kind === kind && x.id === id); if (c >= 0) return cellAttrs(r, c); } return ''; };
  const card = (x) => {
    const q = x.q, cls = x.kind === 'charge' ? 'charge' : x.kind === 'errand' ? 'errand' : `quest${q.tracked ? ' tracked' : ''}${q.main ? ' main' : ''}`;
    const mark = x.kind === 'charge' ? '✦' : x.kind === 'errand' ? '✉' : q.main ? '◆' : '◇';
    return `<button class="qcard ${cls}" ${at(x.kind, x.id)} data-quest="${esc(x.id)}">
      <span class="qhead"><i class="mark">${mark}</i><b>${esc(x.name)}</b>${q.tracked ? `<em class="tag">${t('gm.trackedTag')}</em>` : ''}</span>
      <span class="goal">${esc(q.goal)}</span>
      <span class="next"><small>${t('gm.next')}</small>${keyText(esc(q.step), { html: true })}</span></button>`;
  };
  const more = (list) => (list.length > ENDED ? `<li class="more">${t('gm.more', { n: list.length - ENDED })}</li>` : '');
  const endedHtml = ended.length
    ? `<ul>${ended.filter((q) => !q.failed).map((q) => `<li><button class="ended" ${at('ended', q.id)}><i>✓</i>${esc(q.title)}</button></li>`).join('')}${more(done)}
       ${ended.filter((q) => q.failed).map((q) => `<li><button class="ended failed" ${at('ended', q.id)}><i>·</i>${esc(q.title)}</button></li>`).join('')}${more(failed)}</ul>`
    : `<p class="none">${t('gm.noneYet')}</p>`;
  const tracked = rows.findIndex((r) => r[0]?.q?.tracked);
  const html = `<div class="gm-quests">
    <div class="qlist">${main.map(card).join('') || `<p class="none">${t('gm.nothingAsked')}</p>`}</div>
    <aside class="qdone"><h2>${t('gm.done')}</h2>${endedHtml}</aside></div>`;
  return { html, rows, start: tracked >= 0 ? { r: tracked, c: 0 } : null };
}

/**
 * Sketchbook: { sightings: [{ id, name, ask, found, of, entries: [{ id, line, who, world, found }] }] | null,
 * worlds: [{ id, title, story: { title, img }, relics: [{ name, img }], found, of }],
 * extra: [{ id, title, tiles: [{ name, img, caption }] }] } (the observatory, the errands).
 * First the Sightings (src/story/sightings.js): a block a thread, its notes SIGHT_COLS a row, the ones met
 * as a short line with the world and who said it, the rest a ? (with the world's name once you know it).
 * Then one row a world: its story page (drawn when told), then its relics (a ? until found).
 */
export function sketchesPanel({ sightings = null, worlds = [], extra = [] } = {}) {
  const rows = [];
  const tile = (x, r, c, wide = false) => `<button class="tile${wide ? ' wide' : ''}${x.img ? '' : ' empty'}" ${cellAttrs(r, c)} aria-label="${esc(x.name || t('gm.notFound'))}">${x.img ? `<img src="${esc(x.img)}" alt="">` : `<i>${wide ? '…' : '?'}</i>`}</button>`;
  const sections = [];
  // the Sightings: a thread a block, its notes SIGHT_COLS a row (a row of the grid is a row of the cursor's)
  if (sightings?.length) {
    const found = sightings.reduce((n, t) => n + t.found, 0), of = sightings.reduce((n, t) => n + t.of, 0);
    const blocks = sightings.map((t) => {
      const notes = [], base = rows.length;
      t.entries.forEach((e, i) => {
        const r = base + Math.floor(i / SIGHT_COLS), c = i % SIGHT_COLS;
        (rows[r] ??= []).push({ col: c, kind: 'sighting', id: e.id, name: e.found ? e.line : 'Not found yet',
          sub: e.found ? [t.name, e.world, e.who].filter(Boolean).join(' · ') : `${t.name} · ${e.world || 'somewhere further on'}`,
          desc: e.found ? t.ask : `A trace still to find${e.world ? ` in ${e.world}` : ''}. ${t.ask}`, act: null });
        notes.push(`<button class="note${e.found ? '' : ' empty'}" ${cellAttrs(r, c)} aria-label="${esc(e.found ? e.line : 'not found yet')}">${e.found
          ? `<q>${esc(e.line)}</q><small>${esc([e.world, e.who].filter(Boolean).join(' · '))}</small>`
          : `<i>?</i>${e.world ? `<small>${esc(e.world)}</small>` : ''}`}</button>`);
      });
      return `<div class="thread ${esc(t.id)}"><h3>${esc(t.name)} <span>${t.found}/${t.of}</span></h3><div class="notes" style="--cols:${SIGHT_COLS}">${notes.join('')}</div></div>`;
    });
    sections.push(`<section class="sightings"><h2>Sightings <span>${found}/${of}</span></h2>${blocks.join('')}</section>`);
  }
  for (const w of worlds) {
    const r = rows.length, cells = [];
    cells.push({ col: 0, kind: 'story', id: `${w.id}.story`, name: w.story?.title || w.title, sub: t(w.story?.img || w.story?.told ? 'gm.storyTold' : 'gm.storyNotTold', { world: w.title }), desc: t(w.story?.img ? 'gm.storyDrawn' : w.story?.told ? 'gm.storyOld' : 'gm.storyLater'), act: w.story?.img ? 'look' : null, img: w.story?.img ?? null });
    (w.relics ?? []).forEach((x, i) => cells.push({ col: 1 + i, kind: 'relic', id: `${w.id}.${i}`, name: x.img ? x.name : t('gm.notFoundYet'), sub: t('gm.relicOf', { world: w.title, i: i + 1, n: w.relics.length }), desc: t(x.img ? 'gm.relicFound' : 'gm.relicHint'), act: x.img ? 'look' : null, img: x.img ?? null }));
    rows.push(cells);
    sections.push(`<section class="world"><h2>${esc(w.title)} <span>${w.found ?? 0}/${w.of ?? (w.relics ?? []).length}</span></h2><div class="row">${cells.map((x, c) => tile({ name: x.name, img: x.img }, r, c, c === 0)).join('')}</div></section>`);
  }
  for (const e of extra) {
    const r = rows.length;
    const cells = e.tiles.map((x, i) => ({ col: i, kind: 'sketch', id: `${e.id}.${i}`, name: x.name, sub: e.title, desc: x.caption ?? '', act: x.img ? 'look' : null, img: x.img ?? null }));
    if (!cells.length) continue;
    rows.push(cells);
    sections.push(`<section class="world extra"><h2>${esc(e.title)}${e.count ? ` <span>${esc(e.count)}</span>` : ''}</h2><div class="row">${cells.map((x, c) => tile({ name: x.name, img: x.img }, r, c, !!e.wide)).join('')}</div></section>`);
  }
  const html = `<div class="gm-sketches">${sections.join('') || `<p class="none">${t('gm.nothingDrawn')}</p>`}</div>`;
  return { html, rows };
}

/**
 * Worlds: [{ id, title, thumb, current, told, relics: [n, of], boxes: [n, of] | null, blurb, n }] in the
 * route's order: the worlds you know of, their picture, and what is done there.
 */
export function worldsPanel(list = []) {
  const rows = [];
  list.forEach((w, i) => { const r = Math.floor(i / WORLD_COLS); (rows[r] ??= []).push({ col: i % WORLD_COLS, kind: 'world', id: w.id, name: w.title, sub: [w.current ? t('gm.here') : '', t(w.told ? 'gm.told' : 'gm.notTold')].filter(Boolean).join(' · '), desc: w.blurb ?? '', act: null }); });
  const card = (w, i) => `<button class="wcard${w.current ? ' here' : ''}${w.told ? ' told' : ''}" ${cellAttrs(Math.floor(i / WORLD_COLS), i % WORLD_COLS)}>
      <span class="pic">${w.thumb ? `<img src="${esc(w.thumb)}" alt="" onerror="this.remove()">` : ''}<b class="num">${w.n ?? i + 1}</b>${w.current ? `<em class="tag">${t('gm.hereTag')}</em>` : ''}</span>
      <span class="wname">${esc(w.title)}</span>
      <span class="wfacts"><span class="${w.told ? 'on' : ''}">${t(w.told ? 'gm.toldMark' : 'gm.notToldMark')}</span><span>◆ ${w.relics?.[0] ?? 0}/${w.relics?.[1] ?? 0}</span>${w.boxes ? `<span>▣ ${w.boxes[0]}/${w.boxes[1]}</span>` : ''}</span></button>`;
  const html = `<div class="gm-worlds" style="--cols:${WORLD_COLS}">${list.map(card).join('') || `<p class="none">${t('gm.noWorlds')}</p>`}</div>`;
  return { html, rows };
}

/** A person's picture: their portrait from a conversation (src/portrait-cache.js), or their initial on their colour. */
const face = (p) => `<span class="pic" data-portrait="${esc(p.id)}" style="--bg:${esc(p.portrait?.background || p.color || '#e2d3ae')}">${p.portrait?.src
  ? `<img src="${esc(p.portrait.src)}" alt="">` : `<i>${esc((p.name || '?').replace(/^(The|Madame|Mother|Brother|Sister|Aunt) /, '')[0] ?? '?')}</i>`}</span>`;

/**
 * People: { groups: [{ world, title, people: [{ id, name, role, worldTitle, portrait, color, now }]}], person: detail | null }.
 * The cards (PEOPLE_COLS a row in the cursor's count, a block a world in the route's order), or, with `person`
 * (peopleData's detail: { id, name, role, worldTitle, portrait, story, now, talks, quests, things, choices, prev, next }),
 * that one's page: a Back button (B / ○), what you know, where they are now, what passed between you, the people
 * before and after (← →).
 */
export function peoplePanel({ groups = [], person = null } = {}) {
  if (person) {
    const p = person;
    const rows = [[{ col: 0, kind: 'back', id: 'back', name: p.name, sub: [p.role, p.worldTitle].filter(Boolean).join(' · '), desc: p.now ?? '', act: 'back' }]];
    const list = (items) => `<ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
    const between = [
      p.talks ? esc(p.talks > 1 ? t('gm.p.talksN', { n: p.talks }) : t('gm.p.talks1')) : '',
      ...(p.quests ?? []).map((q) => `<i class="q ${esc(q.state)}">${q.state === 'done' ? '✓' : q.state === 'failed' ? '·' : '◇'}</i>${esc(q.title)} <small>${esc(t(`gm.p.quest.${q.state}`))}</small>`),
      ...(p.things ?? []).map(esc),
    ].filter(Boolean);
    const html = `<div class="gm-person" data-person="${esc(p.id)}">
      <button class="pback" ${cellAttrs(0, 0)}>${glyph('back', { key: 'Esc' })}<span>${t('gm.back')}</span></button>
      <header class="phead">${face(p)}<div class="pname"><h2>${esc(p.name)}</h2><span class="role">${esc(p.role ?? '')}</span><span class="pworld">${esc(p.worldTitle ?? '')}</span></div></header>
      <div class="ptext">
        <section class="pstory"><h3>${t('gm.p.story')}</h3>${(p.story ?? []).map((s) => `<p>${esc(s)}</p>`).join('')}</section>
        ${p.now ? `<section class="pnow"><h3>${t('gm.p.now')}</h3><p>${esc(p.now)}</p></section>` : ''}
        ${p.choices?.length ? `<section class="pchoice"><h3>${t('gm.p.choice')}</h3>${p.choices.map((s) => `<p>${esc(s)}</p>`).join('')}</section>` : ''}
        <section class="pwith"><h3>${t('gm.p.between')}</h3>${between.length ? list(between) : `<p class="none">${t('gm.p.nothing')}</p>`}</section>
      </div>
      <nav class="pstep">${p.prev ? `<button data-step="-1"><span class="arrow">◀</span>${esc(p.prev)}</button>` : '<span></span>'}${glyph('dpad')}${p.next ? `<button data-step="1">${esc(p.next)}<span class="arrow">▶</span></button>` : '<span></span>'}</nav>
    </div>`;
    return { html, rows };
  }
  const rows = [];
  const blocks = groups.map((g) => {
    const base = rows.length;
    const cards = g.people.map((p, i) => {
      const r = base + Math.floor(i / PEOPLE_COLS), c = i % PEOPLE_COLS;
      (rows[r] ??= []).push({ col: c, kind: 'person', id: p.id, name: p.name, sub: [p.role, g.title].filter(Boolean).join(' · '), desc: p.now ?? '', act: 'open' });
      return `<button class="pcard" ${cellAttrs(r, c)} data-person="${esc(p.id)}">${face(p)}<span class="pname"><b>${esc(p.name)}</b><small>${esc(p.role ?? '')}</small></span></button>`;
    });
    return `<section class="pworld"><h2>${esc(g.title)} <span>${g.people.length}</span></h2><div class="pgrid">${cards.join('')}</div></section>`;
  });
  const html = `<div class="gm-people" data-grid-nav>${blocks.join('') || `<p class="none">${t('gm.p.none')}</p>`}</div>`;
  return { html, rows };
}

const BUILDERS = { items: itemsPanel, quests: questsPanel, sketches: sketchesPanel, worlds: worldsPanel, people: peoplePanel };

/** The verb A / × does on a cell ('' if nothing). */
export const ACT = Object.defineProperties({}, Object.fromEntries(['use', 'track', 'look', 'turn', 'open', 'back'].map((k) => [k, { get: () => t(`gm.act.${k}`), enumerable: true }])));

/**
 * What the confirm button does on the picked cell, in the info strip: its glyph (a pad's printed A, the
 * keyboard's Enter: src/pad-glyphs.js) and the verb; nothing on a touch screen (a second tap uses) or
 * where it does nothing. Turning the panels and closing are on their own buttons: the side tabs carry
 * LB / RB (Q / E), the ✕ carries B (Esc).
 */
export function menuPrompts(act = null, kind = inputKind()) {
  if (kind === 'touch' || !act) return '';
  return `<span class="gm-act">${glyph('ok')}${escapeHtml(act)}</span>`;
}

// ------------------------------------------------------------------ the menu on the page

export class GameMenu {
  /**
   * @param el      the menu's root (index.html #journal)
   * @param o.sources { items(), quests(), sketches(), worlds() } → each panel's data (src/game-menu-data.js)
   * @param o.onTrack (id) a quest chosen (the scout finds it) · o.onUse (id) an item used (a gun mode)
   * @param o.onClose () the ✕, B / ○ or Esc (Journal.toggle(false))
   */
  constructor(el, { sources = {}, onTrack = null, onUse = null, onClose = null } = {}) {
    Object.assign(this, { el, sources, onTrack, onUse, onClose });
    this.state = new MenuState();
    this.rows = [];
    this.looking = null;
    this.person = null;     // the People panel: the person whose page is open (null: the cards)
    this.detail = null;     // (that page's data: its neighbours for ← →)
    this.gridAt = null;     // (the cards' cursor while a page is open)
    if (!el) return;
    el.classList.add('gamemenu');
    el.innerHTML = `
      <div class="gm pad-raw" role="dialog" aria-label="${t('gm.label')}">
        <nav class="gm-tabs">${PANELS.map((p) => `<button class="gm-tab" data-panel="${p.id}">${p.name}</button>`).join('')}</nav>
        <button class="gm-close close" aria-label="${t('gm.close')}">${glyph('back', { key: 'Esc' })}✕</button>
        <div class="gm-stage">
          <button class="gm-side prev" data-go="-1"><span class="arrow">◀</span>${glyph('lb', { key: 'Q' })}<span class="nm"></span></button>
          <div class="gm-sheet"><h1 class="gm-title"></h1><div class="gm-body"></div><div class="gm-look" hidden></div></div>
          <button class="gm-side next" data-go="1"><span class="arrow">▶</span>${glyph('rb', { key: 'E' })}<span class="nm"></span></button>
        </div>
        <footer class="gm-info"><div class="gm-what"><b class="gm-name"></b><span class="gm-sub"></span><p class="gm-desc"></p></div><div class="gm-keys"></div></footer>
      </div>`;
    this.body = el.querySelector('.gm-body');
    // (a new language: the tabs' and the close button's words; the panels are drawn again as they open)
    onLanguage(() => {
      for (const b of el.querySelectorAll('.gm-tab')) b.textContent = PANELS.find((p) => p.id === b.dataset.panel)?.name ?? b.textContent;
      el.querySelector('.gm')?.setAttribute('aria-label', t('gm.label'));
      el.querySelector('.gm-close')?.setAttribute('aria-label', t('gm.close'));
    });
    this.lookEl = el.querySelector('.gm-look');
    el.addEventListener('click', (e) => {
      const t = e.target.closest?.('[data-at], [data-go], [data-panel], [data-step], .gm-close, .gm-look');
      if (!t) return;
      if (t.classList.contains('gm-close')) { this.onClose?.(); return; }
      if (t.classList.contains('gm-look')) { this.look(false); return; }
      if (t.dataset.go) { this.turn(+t.dataset.go); return; }
      if (t.dataset.panel) { this.show(t.dataset.panel); return; }
      if (t.dataset.step) { this.stepPerson(+t.dataset.step); return; }
      if (t.classList.contains('pback')) { this.back(); return; }   // (a person's page: Back goes back at once)
      const [r, c] = t.dataset.at.split(',').map(Number);
      const at = this.state.cursor();
      // a tap (or click) picks a cell and says what it is; on the one picked, it does what A / × does
      if (!at.edge && at.r === r && at.c === c) this.confirm();
      else this.select(r, c);
    });
    // a mouse over a cell picks it (not a finger: that would act on the first tap)
    el.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target.closest?.('[data-at]');
      if (!t) return;
      const [r, c] = t.dataset.at.split(',').map(Number), at = this.state.cursor();
      if (at.r !== r || at.c !== c || at.edge) this.select(r, c, false);
    });
  }

  get panel() { return this.state.panel.id; }

  /** Build the current panel's cells from its source and draw it. */
  render() {
    const id = this.panel;
    let data = null;
    // (the People panel: its source is asked for the open person's page too)
    try { data = this.sources[id]?.(id === 'people' ? this.person : undefined) ?? null; } catch (e) { console.warn('game menu', id, e); }
    if (id === 'people' && this.person && !data?.person) { this.person = null; if (this.gridAt) this.state.at.people = this.gridAt; }
    this.detail = id === 'people' ? data?.person ?? null : null;
    const { html, rows, start } = BUILDERS[id](data ?? undefined);
    this.rows = rows;
    // a panel opened for the first time: where it says to start (the Quests panel: the quest you are on)
    if (!this.state.at[id] && start) this.state.at[id] = { ...start };
    // the cursor stays inside what there is
    const at = this.state.cursor();
    if (!at.edge && rows.length) { at.r = Math.min(at.r, rows.length - 1); at.c = Math.min(at.c, rows[at.r].length - 1); }
    if (!this.el) return;
    this.el.dataset.panel = id;
    this.el.querySelector('.gm-title').textContent = this.state.panel.name;
    for (const b of this.el.querySelectorAll('.gm-tab')) b.classList.toggle('on', b.dataset.panel === id);
    const { prev, next } = this.state.neighbours();
    this.el.querySelector('.gm-side.prev .nm').textContent = prev.name;
    this.el.querySelector('.gm-side.next .nm').textContent = next.name;
    this.body.innerHTML = html;
    this.body.scrollTop = 0;
    this.look(false);
    this.paint();
  }

  /** Mark the cursor's cell (or tab) and fill the info strip. */
  paint(scroll = true) {
    if (!this.el) return;
    const at = this.state.cursor();
    for (const x of this.el.querySelectorAll('.at')) x.classList.remove('at');
    for (const s of this.el.querySelectorAll('.gm-side')) s.classList.toggle('at', !!at.edge && +s.dataset.go === at.edge);
    const cell = this.state.cell(this.rows);
    const node = cell && this.body.querySelector(`[data-at="${at.r},${at.c}"]`);
    if (node) { node.classList.add('at'); if (scroll) node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }
    const name = this.el.querySelector('.gm-name'), sub = this.el.querySelector('.gm-sub'), desc = this.el.querySelector('.gm-desc');
    if (at.edge) {
      const to = this.state.neighbours()[at.edge > 0 ? 'next' : 'prev'];
      name.textContent = to.name; sub.textContent = ''; desc.textContent = t('gm.toPanel', { name: to.name });
    } else {
      name.textContent = cell?.name ?? ''; sub.textContent = cell?.sub ?? ''; desc.textContent = keyText(cell?.desc ?? '');   // (a {key:verb}: the player's own key or button; the menu is .pad-raw, so it isn't renamed twice)
    }
    this.el.querySelector('.gm-keys').innerHTML = menuPrompts(at.edge ? ACT.turn : cell?.act ? ACT[cell.act] : null);
    // Items: the picked one, large
    const pv = this.body.querySelector('.gm-preview');
    if (pv) pv.innerHTML = cell?.it ? `<div class="big ${esc(cell.it.kind ?? '')}">${icon(cell.it)}</div><b>${esc(cell.name)}</b><span>${esc(cell.sub)}</span>${cell.it.inUse ? `<em>${t('gm.inUse')}</em>` : ''}` : '';
  }

  open(panel = null) {
    this.leavePerson(); if (panel) this.state.show(panel); this.render();
    // (drawn while the menu was still hidden: once it shows, the cursor's cell scrolled into view)
    if (this.el && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.paint());
  }
  close() { this.look(false); }
  show(panel) { this.leavePerson(); this.state.show(panel); this.render(); }
  turn(d) { this.leavePerson(); this.state.turn(d); this.render(); }
  select(r, c, scroll = true) { this.state.at[this.panel] = { r, c }; this.look(false); this.paint(scroll); }

  /** The stick, the D-pad, the arrows. */
  navigate(dx, dy) {
    if (this.looking) { this.look(false); if (!dx && !dy) return; }
    // a person's page: ← → the one before / after, ↑ ↓ read on down it
    if (this.panel === 'people' && this.person) {
      if (dx) this.stepPerson(Math.sign(dx));
      else if (dy && this.body) this.body.scrollTop += Math.sign(dy) * Math.max(40, this.body.clientHeight * 0.35);
      return;
    }
    if (this.gridMove(dx, dy)) return;
    if (this.state.move(this.rows, Math.sign(dx), Math.sign(dy)) === 'turn') this.render();
    else this.paint();
  }

  /**
   * A grid that moves by where its cells are drawn (data-grid-nav: the People cards, as many a row as fit):
   * the cell that way on the screen (gridStep, src/menu-pad.js); past a row's end the side tab, as moveCursor
   * does. False without a page or such a grid (moveCursor then).
   */
  gridMove(dx, dy) {
    const root = this.el ? this.body.querySelector('[data-grid-nav]') : null;
    const at = this.state.cursor();
    if (!root || at.edge) return false;
    const nodes = [...root.querySelectorAll('[data-at]')];
    const i = nodes.findIndex((n) => n.dataset.at === `${at.r},${at.c}`);
    if (i < 0) return false;
    const j = gridStep(nodes.map((n) => n.getBoundingClientRect()), i, Math.sign(dx), Math.sign(dy));
    if (j === i) {
      if (dx) { this.state.at[this.panel] = { edge: Math.sign(dx), r: at.r }; this.paint(); }
      return true;
    }
    const [r, c] = nodes[j].dataset.at.split(',').map(Number);
    this.select(r, c);
    return true;
  }

  /** Open a person's page (the People panel), the cards' cursor kept for coming back. */
  openPerson(id) {
    if (!this.person) this.gridAt = { ...this.state.cursor() };
    this.person = id;
    this.state.at.people = { r: 0, c: 0 };
    this.render();
  }

  /** ← → on a person's page: the one before or after (in the cards' order). */
  stepPerson(d) {
    const to = d < 0 ? this.detail?.prevId : this.detail?.nextId;
    if (!to) return;
    this.person = to;
    this.state.at.people = { r: 0, c: 0 };
    this.render();
  }

  /** (turning away from the People panel: its cards when you come back) */
  leavePerson() {
    if (!this.person) return;
    const id = this.person;
    this.person = null; this.detail = null;
    this.state.at.people = this.gridAt ?? { r: 0, c: 0 };
    this._backTo = id;
  }

  /** B / ○, Esc: put a held-up sketch down, or close a person's page. True if it did (else the menu closes). */
  back() {
    if (this.looking) { this.look(false); return true; }
    if (this.panel === 'people' && this.person) {
      this.leavePerson();
      this.render();
      // the cursor on the card of the person just read (← → may have moved on from the one opened)
      const id = this._backTo; this._backTo = null;
      const r = this.rows.findIndex((row) => row.some((x) => x.id === id));
      if (r >= 0) this.select(r, this.rows[r].findIndex((x) => x.id === id));
      return true;
    }
    return false;
  }

  /** A person's portrait is ready (src/portrait-cache.js): put it on their card and page. */
  portraitReady(id, shot) {
    if (!this.el || !shot?.src) return;
    for (const pic of this.el.querySelectorAll(`.pic[data-portrait="${CSS.escape?.(id) ?? id}"]`)) {
      pic.innerHTML = `<img src="${esc(shot.src)}" alt="">`;
      if (shot.background) pic.style.setProperty('--bg', shot.background);
    }
  }

  /** A / ×, Enter: what the cell does (a quest tracked, a gun mode taken, a sketch held up), or the tab's turn. */
  confirm() {
    const at = this.state.cursor();
    if (at.edge) { this.turn(at.edge); return; }
    const cell = this.state.cell(this.rows);
    if (!cell?.act) return;
    if (cell.act === 'track') {
      this.onTrack?.(cell.id); this.render();
      // (the one you are on moves to the top: the cursor goes with it)
      const r = this.rows.findIndex((row) => row.some((x) => x.id === cell.id && x.kind === cell.kind));
      if (r >= 0) this.select(r, this.rows[r].findIndex((x) => x.id === cell.id));
    }
    else if (cell.act === 'use') { this.onUse?.(cell.id); this.render(); }
    else if (cell.act === 'open') this.openPerson(cell.id);
    else if (cell.act === 'back') this.back();
    else if (cell.act === 'look') this.look(this.looking === cell.id ? false : cell);
  }

  /** Hold a sketch up over the panel (any move, a press or a click puts it back). */
  look(cell) {
    this.looking = cell ? cell.id : null;
    if (!this.lookEl) return;
    this.lookEl.hidden = !cell;
    if (cell) this.lookEl.innerHTML = `<figure><img src="${esc(cell.img)}" alt=""><figcaption><b>${esc(cell.name)}</b> ${esc(cell.sub)}</figcaption></figure>`;
    else this.lookEl.innerHTML = '';
  }

  /** An item's picture is ready (src/item-icons.js): swap its mark for it, wherever it shows. */
  iconReady(id, url) {
    if (!url) return;
    for (const row of this.rows) for (const x of row) if (x.kind === 'item' && x.id === id && x.it) x.it.icon = url;
    if (!this.el) return;
    for (const m of this.el.querySelectorAll(`.ico.mark[data-icon="${CSS.escape?.(id) ?? id}"]`)) {
      const img = document.createElement('img');
      img.className = 'ico'; img.src = url; img.alt = ''; img.dataset.icon = id;
      m.replaceWith(img);
    }
  }

  /** The keyboard, while open: true if the key was the menu's. */
  key(e) {
    const c = e.code;
    if (c === 'KeyQ' || c === 'BracketLeft' || c === 'PageUp') { this.turn(-1); return true; }
    if (c === 'KeyE' || c === 'BracketRight' || c === 'PageDown' || c === 'Tab') { this.turn(c === 'Tab' && e.shiftKey ? -1 : 1); return true; }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[c];
    if (dir) { this.navigate(dir[0], dir[1]); return true; }
    if (c === 'Enter' || c === 'Space') { this.confirm(); return true; }
    return false;
  }
}
