// The game menu (View / Select, J, the touch ❏; the Start menu's Items, Quests and Map): since October
// 2026 it takes the sketchbook's place. After the pause screen of Ocarina of Time, drawn in the
// game's own ink and paper: five panels side by side, turned with the shoulder buttons (LB / L1,
// RB / R1; Q / E or [ ] on a keyboard; the tabs and the side arrows with a mouse or a finger), the
// neighbours' names at the sheet's sides; inside a panel a cursor moves over a grid of cells with the
// stick, the D-pad or the arrows; the cell's name and what it is in the strip at the bottom, with the
// button that does something here. Moving off a row's end rests on the side tab first, as on the N64;
// once more turns. B / ○ closes the menu (out of a page it opened first).
//
// Playtest 2026-10-12 (issue #213): "Items are too small. I should be able to press A to see them bigger. The
// explanation should only be present when the item is full screen (and not overlap on top of the item). Default
// menu should be the quest one." So the menu opens on Quests; the items are large tiles with their names; A / ×
// on a thing opens it full screen (the full view: its picture large, its words beside it, or under it on a
// narrow screen, never over it; its action there: a gun mode taken, the fragment finder switched, a gadget in
// hand; ← → the one before and after; B / ○ back). The strip says only the name and what A / × does.
//
//   Quests      the father's charge and each quest under way: its overall goal and its next step only
//               (src/story/quests.js summary), the one tracked first; the finished ones by title, a short list
//   Map         the world you are in, from above (src/world-map.js): you, the ship, the way on, the temples,
//               the people met and the boxes opened; the legend beside it, A / × zooms on the one picked
//   Items       the gear (the makers' items, each drawn by the game's own pipeline: src/item-icons.js),
//               what you carry for the quests, the keepsakes for the father's charge
//   Worlds      the worlds you know, in the route's order, one a row: A / × shows what you have found there
//               and what is still to find; there A / × travels to a world you have been to (its landing, by the
//               ship: v1.62, issue #213, `onTravel`)
//   People      everyone you have talked to, a card each grouped by world (their portrait, name, role); A / ×
//               opens one: what you know of them, where they are now, what passed between you; B / ○ back
//               to the cards (src/story/people-book.js). The cards' grid moves by where the cards are on the
//               screen (gridStep, src/menu-pad.js: data-grid-nav), so it is right at any width; the items too.
//
// The Sketchbook panel (the Sightings, the story pages, the relics' and errands' sketches) went in v1.62 (issue #213:
// "the sketchbook is confusing about its purpose, I don't know why it's there at all"). The journal still keeps what
// it showed (src/quest.js: a save loses nothing); the Worlds' full view names each world's relics, the Quests the
// errands.
//
// What fills the panels comes from `sources` (src/game-menu-data.js, wired in main.js). The cursor and
// the panels are plain state (MenuState, moveCursor) so tests can drive them without a page.

import { escapeHtml, inputKind, keyText } from './prompt-keys.js';
import { glyph } from './pad-glyphs.js';
import { gridStep } from './menu-pad.js';
import { t, onLanguage } from './i18n.js';
import { chimeIcon } from './chime-icon.js';

// (the names in the language now: src/i18n.js; the menu opens on the first, Quests: issue #213)
export const PANELS = ['quests', 'map', 'items', 'worlds', 'people'].map((id) => ({ id, get name() { return t(`gm.${id}`); } }));
/** The panel the menu opens on (View / Select, J, the touch ❏): the quests (issue #213). */
export const DEFAULT_PANEL = 'quests';
/** The people's cards: this many a row (as the cursor counts them without a page; on one, where they are drawn). */
export const PEOPLE_COLS = 4;
/** The gear's cells: this many a row in the cursor's count (on a page the tiles are as many a row as fit, and the
 *  cursor moves by where they are drawn: data-grid-nav). Twelve since v1.55. */
export const GEAR_COLS = 12;
/** The worlds: one a row since v1.58 (issue #213: "the worlds tab I can't go up and down"). */
export const WORLD_COLS = 1;

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

/** Which panel shows and where the cursor is on each (kept while the game runs). */
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
const KIND_MARK = { core: '◍', weapon: '⚔', movement: '➶', mode: '◐', upgrade: '✚', charm: '✧', pass: '▭', cosmetic: '✦', quest: '⧉', keepsake: '✦' };
const icon = (it) => it.icon
  ? `<img class="ico" src="${esc(it.icon)}" alt="" data-icon="${esc(it.id)}">`
  : `<i class="ico mark" data-icon="${esc(it.id)}">${KIND_MARK[it.kind] ?? '✧'}</i>`;
const KINDS = ['core', 'weapon', 'movement', 'mode', 'gadget', 'upgrade', 'charm', 'pass', 'cosmetic', 'quest', 'keepsake'];
const KIND_NAME = Object.defineProperties({}, Object.fromEntries(KINDS.map((k) => [k, { get: () => t(`gm.kind.${k}`), enumerable: true }])));

/** What A / × does to an item in its full view: a gun mode taken, a gadget in hand, a switch turned (null: nothing). */
export function itemUse(it) {
  if (!it?.usable) return null;
  if (it.toggle) return it.inUse ? t('gm.full.off') : t('gm.full.on');
  if (it.kind === 'gadget') return t('gm.full.equip');
  return t('gm.full.mode');
}

/**
 * Items: { gear: [{ id, name, kind, text, icon, inUse, usable, toggle }], slots, pack: [{ id, name }], keepsakes: [{ id, name, text, world }],
 * chimes (the wallet, shown by the gear's heading; null: not shown) }.
 * The gear as large tiles, each with its name under its picture (a slot for each item there is to find: the empty
 * ones drawn but not named, so nothing is given away but how many), under it what you carry for the quests and the
 * keepsakes for the father's charge, side by side. A / × on one: its full view (what it is, what it does, its use).
 * Rows: the gear's (GEAR_COLS a row), then a row a line of the pack (column 0) and of the keepsakes (column CARRY_COL).
 */
export const CARRY_COL = 4;
export function itemsPanel({ gear = [], slots = 0, pack = [], keepsakes = [], chimes = null } = {}) {
  const rows = [];
  const full = (it, sub, text) => ({ pic: `<div class="big ${esc(it.kind ?? '')}">${icon(it)}</div>`, sub, text, inUse: !!it.inUse, use: itemUse(it) });
  gear.forEach((it, i) => {
    const sub = KIND_NAME[it.kind] ?? '';
    (rows[Math.floor(i / GEAR_COLS)] ??= []).push({ col: i % GEAR_COLS, kind: 'item', id: it.id, name: it.name, sub, desc: it.text ?? '', act: 'look', use: it.usable ? 'use' : null, it, full: full(it, sub, it.text ?? '') });
  });
  const packs = pack.map((it) => ({ kind: 'pack', id: it.id, name: it.name, sub: KIND_NAME.quest, desc: t('gm.carried'), act: 'look', it: { ...it, kind: 'quest' }, full: full({ ...it, kind: 'quest' }, KIND_NAME.quest, t('gm.carried')) }));
  const keeps = keepsakes.map((it) => {
    const sub = `${KIND_NAME.keepsake}${it.world ? ` · ${t('gm.fromWorld', { world: it.world })}` : ''}`;
    return { kind: 'keepsake', id: it.id, name: it.name, sub, desc: it.text ?? '', act: 'look', it: { ...it, kind: 'keepsake' }, full: full({ ...it, kind: 'keepsake' }, sub, it.text ?? '') };
  });
  const g = rows.length;
  for (let k = 0; k < Math.max(packs.length, keeps.length); k++) rows.push([...(packs[k] ? [{ ...packs[k], col: 0 }] : []), ...(keeps[k] ? [{ ...keeps[k], col: CARRY_COL }] : [])]);
  const where = (kind, id) => { for (let r = 0; r < rows.length; r++) { const c = rows[r].findIndex((x) => x.kind === kind && x.id === id); if (c >= 0) return cellAttrs(r, c); } return ''; };
  const slot = (it) => `<button class="slot${it.inUse ? ' inuse' : ''}" ${where('item', it.id)} aria-label="${esc(it.name)}"><span class="pic">${icon(it)}${it.inUse ? `<em>${t('gm.inUse')}</em>` : ''}</span><span class="nm">${esc(it.name)}</span></button>`;
  const empties = Array.from({ length: Math.max(0, slots - gear.length) }, () => '<span class="slot empty" aria-hidden="true"><span class="pic"></span></span>').join('');
  const line = (x) => `<button class="line ${x.kind}" ${where(x.kind, x.id)}>${icon(x.it)}<span>${esc(x.name)}</span></button>`;
  const html = `<div class="gm-items" data-grid-nav>
      <section class="gm-gear"><h2>${t('gm.gear')} <span>${slots ? t('gm.gearCount', { n: gear.length, m: slots }) : gear.length}</span>${chimes !== null ? `<span class="gm-wallet" title="${esc(t('hud.chimes'))}">${chimeIcon('chime')}${t('gm.chimes', { n: chimes })}</span>` : ''}</h2>
        <div class="grid">${gear.map(slot).join('')}${empties}</div></section>
      <div class="gm-carry">
        <section><h2>${t('gm.pack')}</h2>${packs.map(line).join('') || `<p class="none">${t('gm.packNone')}</p>`}</section>
        <section><h2>${t('gm.keepsakes')} <span>${keeps.length}</span></h2>${keeps.map(line).join('') || `<p class="none">${t('gm.keepNone')}</p>`}</section>
      </div></div>`;
  return { html, rows, gearRows: g };
}

/**
 * Quests: { charge: { title, goal, step, worlds } | null, active: [{ id, title, goal, step, main, tracked }],
 * errands: [{ id, title, goal, step }], done: [{ id, title, outro }], failed: [...] }.
 * Each quest under way shows its overall goal and its next step, nothing else (no steps done, no history);
 * the finished and failed ones are a short list of titles beside them (ENDED of each); A / × on one of those
 * opens how it ended.
 */
export const ENDED = 6;
export function questsPanel({ charge = null, active = [], errands = [], done = [], failed = [] } = {}) {
  const rows = [];
  const main = [];
  if (charge) main.push({ kind: 'charge', id: 'charge', name: charge.title, sub: t('gm.charge'), desc: `${charge.goal}. ${charge.worlds ?? ''}`.trim(), act: null, q: charge });
  for (const q of active) main.push({ kind: 'quest', id: q.id, name: q.title, sub: q.tracked ? t('gm.tracked') : (q.main ? t('gm.mainQuest') : t('gm.errand')), desc: `${q.goal}.`, act: q.tracked ? null : 'track', q });
  for (const q of errands) main.push({ kind: 'errand', id: q.id, name: q.title, sub: t('gm.parcel'), desc: `${q.goal}.`, act: null, q });
  const ended = [...done.slice(0, ENDED).map((q) => ({ ...q, failed: false })), ...failed.slice(0, ENDED).map((q) => ({ ...q, failed: true }))];
  const side = ended.map((q) => {
    const sub = q.failed ? t('gm.failed') : t('gm.complete');
    return { kind: 'ended', id: q.id, name: q.title, sub, desc: q.outro ?? '', act: 'look', q, full: { pic: `<div class="big mark ${q.failed ? 'failed' : 'done'}"><i>${q.failed ? '·' : '✓'}</i></div>`, sub, text: q.outro ?? '' } };
  });
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

/** A world's facts, in a line each: the story, the relics, the boxes, the fragments (once the first is found), the people. */
export function worldFacts(w) {
  const facts = [];
  facts.push({ on: !!w.told, text: t(w.told ? 'gm.told' : 'gm.notTold') });
  const [rn, rm] = w.relics ?? [0, 0];
  if (rm) facts.push({ on: rn >= rm, text: t('gm.w.relics', { n: rn, m: rm }), list: (w.relicList ?? []).map((x) => (x.found ? x.name : '?')) });
  if (w.boxes) facts.push({ on: w.boxes[0] >= w.boxes[1], text: t('gm.w.boxes', { n: w.boxes[0], m: w.boxes[1] }) });
  if (w.fragments) facts.push({ on: w.fragments[0] >= w.fragments[1], text: t('gm.fragments', { n: w.fragments[0], m: w.fragments[1] }) });
  if (w.people?.length) facts.push({ on: true, text: t('gm.w.people', { n: w.people.length }), list: w.people });
  return facts;
}
const factsHtml = (facts) => `<ul class="ffacts">${facts.map((f) => `<li class="${f.on ? 'on' : ''}"><i>${f.on ? '✓' : '…'}</i><span>${esc(f.text)}${f.list?.length ? `<small>${f.list.map(esc).join(' · ')}</small>` : ''}</span></li>`).join('')}</ul>`;

/**
 * Worlds: [{ id, title, thumb, current, told, relics: [n, of], boxes: [n, of] | null, blurb, n, relicList, people, travel }]
 * in the route's order: the worlds you know of, one a row (↑ ↓ go between them), their picture and what is done there.
 * A / × on one: its full view, what you have found there and what is still to find; in it A / × "Travel here" on a
 * world you have been to that you are not in (`travel`: v1.62, issue #213), to its landing.
 */
export function worldsPanel(list = []) {
  const rows = [];
  list.forEach((w, i) => {
    const sub = [w.current ? t('gm.here') : '', t(w.told ? 'gm.told' : 'gm.notTold')].filter(Boolean).join(' · ');
    rows.push([{ col: 0, kind: 'world', id: w.id, name: w.title, sub, desc: w.blurb ?? '', act: 'look', use: !!w.travel,
      full: { use: w.travel ? t('gm.travel') : null, pic: `<div class="big world">${w.thumb ? `<img src="${esc(w.thumb)}" alt="" onerror="this.remove()">` : ''}<b class="num">${w.n ?? i + 1}</b>${w.current ? `<em class="tag">${t('gm.hereTag')}</em>` : ''}</div>`,
        sub, text: w.blurb ?? '', facts: factsHtml(worldFacts(w)) } }]);
  });
  const card = (w, i) => `<button class="wcard${w.current ? ' here' : ''}${w.told ? ' told' : ''}" ${cellAttrs(i, 0)}>
      <span class="pic">${w.thumb ? `<img src="${esc(w.thumb)}" alt="" onerror="this.remove()">` : ''}<b class="num">${w.n ?? i + 1}</b>${w.current ? `<em class="tag">${t('gm.hereTag')}</em>` : ''}</span>
      <span class="wtext"><span class="wname">${esc(w.title)}${w.travel ? `<em class="wtravel">${t('gm.travel')}</em>` : ''}</span>
      <span class="wfacts"><span class="${w.told ? 'on' : ''}">${t(w.told ? 'gm.toldMark' : 'gm.notToldMark')}</span><span>◆ ${w.relics?.[0] ?? 0}/${w.relics?.[1] ?? 0}</span>${w.boxes ? `<span>▣ ${w.boxes[0]}/${w.boxes[1]}</span>` : ''}${w.fragments ? `<span class="frag" title="${esc(t('gm.fragments', { n: w.fragments[0], m: w.fragments[1] }))}">${w.fragments[0] >= w.fragments[1] ? t('gm.fragAll', { n: w.fragments[1] }) : t('gm.fragLeft', { n: w.fragments[1] - w.fragments[0] })}</span>` : ''}</span>
      <span class="wblurb">${esc(w.blurb ?? '')}</span></span></button>`;
  // (the fragments of the singing light, all told, once the first is found: worldsData's `fragmentsAll`)
  const all = list.fragmentsAll?.found ? `<p class="gm-fragments">${t('gm.fragments', { n: list.fragmentsAll.found, m: list.fragmentsAll.total })}</p>` : '';
  const html = `${all}<div class="gm-worlds">${list.map(card).join('') || `<p class="none">${t('gm.noWorlds')}</p>`}</div>`;
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

/** A mark's symbol on the map and in its legend. */
const MARK_SYM = {
  you: '<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -9 L7 7 L0 3.5 L-7 7 Z"/></svg>',
  ship: '<svg viewBox="-12 -8 24 16" aria-hidden="true"><path d="M-11 1 C-6 -6 6 -6 11 1 C6 6 -6 6 -11 1 Z"/><path d="M-4 -4 L0 -7 L4 -4" fill="none"/></svg>',
  goal: '<i>✦</i>', temple: '<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M-8 8 V-1 L0 -8 L8 -1 V8 Z"/><path d="M-3 8 V2 H3 V8" fill="none"/></svg>',
  person: '<i>●</i>', box: '<i>▣</i>',
};

/**
 * Map: { world, marks: [{ id, kind, name, sub, u, v, deg, on }] (src/world-map.js mapMarks), canvas (the drawn ground,
 * or null while it is drawn), progress (0..1), zoom (the mark zoomed on, or null), scale: { frac, label }, note }.
 * The map large, the marks over it (the traveller's arrow turned the way he faces), north up; beside it the legend,
 * a line a mark, the cursor's one ringed on the map; A / × zooms on it (again: the whole map).
 * Rows: one line of the legend a row.
 */
export function mapPanel({ world = '', marks = [], canvas = null, progress = 0, zoom = null, scale = null, note = '' } = {}) {
  const rows = marks.map((m, i) => [{ col: 0, kind: 'mark', id: m.id, name: m.name, sub: m.sub, desc: '', act: 'zoom', mark: m, r: i }]);
  const pos = (m) => `left:${(m.u * 100).toFixed(2)}%;top:${(m.v * 100).toFixed(2)}%`;
  // (the way on, the ship and the temples named on the map, unless another name is already beside them)
  const named = new Set();
  for (const m of marks) {
    if (!m.on || !['goal', 'ship', 'temple'].includes(m.kind)) continue;
    if (marks.some((o) => named.has(o.id) && Math.hypot(o.u - m.u, o.v - m.v) < 0.08)) continue;
    named.add(m.id);
  }
  const markHtml = (m) => `<span class="mk mk-${m.kind}${named.has(m.id) ? ' named' : ''}" data-mark="${esc(m.id)}" style="${pos(m)}${m.deg !== undefined ? `;--deg:${m.deg.toFixed(1)}deg` : ''}">${MARK_SYM[m.kind] ?? ''}<b>${esc(m.name)}</b></span>`;
  const lines = marks.map((m, i) => `<button class="mline mk-${m.kind}${m.on ? '' : ' off'}" ${cellAttrs(i, 0)} data-mark="${esc(m.id)}"><span class="sym">${MARK_SYM[m.kind] ?? ''}</span><span class="mtext"><b>${esc(m.name)}</b><small>${esc(m.sub ?? '')}</small></span></button>`).join('');
  const html = `<div class="gm-map${zoom ? ' zoomed' : ''}">
    <div class="gm-mapsheet">
      <div class="gm-mapimg">${canvas ? '' : `<p class="drawing"><span class="pen" aria-hidden="true"></span>${t('gm.map.drawing')} ${Math.round(progress * 100)}%</p>`}</div>
      <div class="gm-marks">${marks.filter((m) => m.on).map(markHtml).join('')}</div>
      <span class="gm-north" aria-hidden="true">N</span>
      ${scale ? `<span class="gm-scale" style="--w:${(scale.frac * 100).toFixed(1)}%"><i></i>${esc(scale.label)}</span>` : ''}
    </div>
    <aside class="gm-legend"><h2>${esc(world)}${zoom ? ` <span>${t('gm.map.zoomed')}</span>` : ''}</h2>${lines || `<p class="none">${t('gm.map.none')}</p>`}${note ? `<p class="gm-mapnote">${esc(note)}</p>` : ''}</aside>
  </div>`;
  return { html, rows, canvas };
}

const BUILDERS = { items: itemsPanel, quests: questsPanel, map: mapPanel, worlds: worldsPanel, people: peoplePanel };

/** The verb A / × does on a cell ('' if nothing). */
export const ACT = Object.defineProperties({}, Object.fromEntries(['use', 'track', 'look', 'turn', 'open', 'back', 'zoom', 'whole', 'travel'].map((k) => [k, { get: () => t(`gm.act.${k}`), enumerable: true }])));

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

/**
 * A thing's full view (A / × on it, issue #213): its picture large on the left, its name, kind and words on the
 * right (under it on a narrow screen: never over it), its facts and its action (A / ×); a Back button (B / ○) and
 * the ones before and after (← →). `cell`: a panel's cell with `full` { pic, sub, text, facts, use, inUse }.
 */
export function fullHtml(cell, { prev = null, next = null, note = null } = {}) {
  const f = cell.full ?? {};
  return `<div class="gm-full-in" data-full="${esc(cell.id)}" data-kind="${esc(cell.kind)}">
    <button class="fback">${glyph('back', { key: 'Esc' })}<span>${t('gm.back')}</span></button>
    <div class="fpic">${f.pic ?? ''}</div>
    <div class="ftext">
      <h2>${esc(f.title ?? cell.name)}</h2>
      ${f.sub ? `<span class="fsub">${esc(f.sub)}</span>` : ''}${f.inUse ? `<em class="finuse">${t('gm.inUse')}</em>` : ''}
      ${f.text ? `<p>${keyText(esc(f.text), { html: true, teach: true })}</p>` : ''}
      ${f.facts ?? ''}
      ${f.use ? `<button class="fuse" data-full-use>${glyph('ok')}<span>${esc(f.use)}</span></button>` : ''}
      ${note ? `<p class="fnote" role="status">${esc(note)}</p>` : ''}
    </div>
    <nav class="fstep">${prev ? `<button data-full-step="-1"><span class="arrow">◀</span>${esc(prev)}</button>` : '<span></span>'}${prev || next ? glyph('dpad', { key: '← →' }) : ''}${next ? `<button data-full-step="1">${esc(next)}<span class="arrow">▶</span></button>` : '<span></span>'}</nav>
  </div>`;
}

// ------------------------------------------------------------------ the menu on the page

export class GameMenu {
  /**
   * @param el      the menu's root (index.html #journal)
   * @param o.sources { items(), quests(), map({ zoom }), worlds(), people(open) } → each panel's data (src/game-menu-data.js)
   * @param o.onTrack (id) a quest chosen (the scout finds it) · o.onUse (id) an item used (a gun mode, a gadget, a switch)
   * @param o.onTravel (id) "Travel here" on a world: null if the ship goes, else the line why not (shown in the full view)
   * @param o.onClose () the ✕, B / ○ or Esc (Journal.toggle(false))
   */
  constructor(el, { sources = {}, onTrack = null, onUse = null, onTravel = null, onClose = null } = {}) {
    Object.assign(this, { el, sources, onTrack, onUse, onTravel, onClose });
    this.note = null;       // a line in the full view (a fast travel refused: why)
    this.state = new MenuState();
    this.rows = [];
    this.full = null;       // the thing open full screen: { panel, kind, id } (null: the panel)
    this.person = null;     // the People panel: the person whose page is open (null: the cards)
    this.detail = null;     // (that page's data: its neighbours for ← →)
    this.gridAt = null;     // (the cards' cursor while a page is open)
    this.mapZoom = null;    // the Map panel: the mark zoomed on (null: the whole map)
    if (!el) return;
    el.classList.add('gamemenu');
    el.innerHTML = `
      <div class="gm pad-raw" role="dialog" aria-label="${t('gm.label')}">
        <nav class="gm-tabs">${PANELS.map((p) => `<button class="gm-tab" data-panel="${p.id}">${p.name}</button>`).join('')}</nav>
        <button class="gm-close close" aria-label="${t('gm.close')}">${glyph('back', { key: 'Esc' })}✕</button>
        <div class="gm-stage">
          <button class="gm-side prev" data-go="-1"><span class="arrow">◀</span>${glyph('lb', { key: 'Q' })}<span class="nm"></span></button>
          <div class="gm-sheet"><h1 class="gm-title"></h1><div class="gm-body"></div><div class="gm-full" hidden></div></div>
          <button class="gm-side next" data-go="1"><span class="arrow">▶</span>${glyph('rb', { key: 'E' })}<span class="nm"></span></button>
        </div>
        <footer class="gm-info"><div class="gm-what"><b class="gm-name"></b><span class="gm-sub"></span></div><div class="gm-keys"></div></footer>
      </div>`;
    this.body = el.querySelector('.gm-body');
    this.fullEl = el.querySelector('.gm-full');
    // (a new language: the tabs' and the close button's words; the panels are drawn again as they open)
    onLanguage(() => {
      for (const b of el.querySelectorAll('.gm-tab')) b.textContent = PANELS.find((p) => p.id === b.dataset.panel)?.name ?? b.textContent;
      el.querySelector('.gm')?.setAttribute('aria-label', t('gm.label'));
      el.querySelector('.gm-close')?.setAttribute('aria-label', t('gm.close'));
    });
    el.addEventListener('click', (e) => {
      const tg = e.target.closest?.('[data-at], [data-go], [data-panel], [data-step], [data-full-step], [data-full-use], .fback, .gm-close');
      if (!tg) return;
      if (tg.classList.contains('gm-close')) { this.onClose?.(); return; }
      if (tg.classList.contains('fback')) { this.back(); return; }
      if (tg.dataset.fullStep) { this.stepFull(+tg.dataset.fullStep); return; }
      if (tg.dataset.fullUse !== undefined) { this.confirm(); return; }
      if (tg.dataset.go) { this.turn(+tg.dataset.go); return; }
      if (tg.dataset.panel) { this.show(tg.dataset.panel); return; }
      if (tg.dataset.step) { this.stepPerson(+tg.dataset.step); return; }
      if (tg.classList.contains('pback')) { this.back(); return; }   // (a person's page: Back goes back at once)
      const [r, c] = tg.dataset.at.split(',').map(Number);
      const at = this.state.cursor();
      // a tap (or click) picks a cell and says what it is; on the one picked, it does what A / × does
      if (!at.edge && at.r === r && at.c === c) this.confirm();
      else this.select(r, c);
    });
    // a mouse over a cell picks it (not a finger: that would act on the first tap)
    el.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse' || this.full) return;
      const tg = e.target.closest?.('[data-at]');
      if (!tg) return;
      const [r, c] = tg.dataset.at.split(',').map(Number), at = this.state.cursor();
      if (at.r !== r || at.c !== c || at.edge) this.select(r, c, false);
    });
  }

  get panel() { return this.state.panel.id; }

  /** Build the current panel's cells from its source and draw it. */
  render() {
    const id = this.panel;
    let data = null;
    // (the People panel: its source is asked for the open person's page too; the Map, for its zoom)
    const arg = id === 'people' ? this.person : id === 'map' ? { zoom: this.mapZoom } : undefined;
    try { data = this.sources[id]?.(arg) ?? null; } catch (e) { console.warn('game menu', id, e); }
    if (id === 'people' && this.person && !data?.person) { this.person = null; if (this.gridAt) this.state.at.people = this.gridAt; }
    this.detail = id === 'people' ? data?.person ?? null : null;
    const { html, rows, start, canvas } = BUILDERS[id](data ?? undefined);
    this.rows = rows;
    // a panel opened for the first time: where it says to start (the Quests panel: the quest you are on)
    if (!this.state.at[id] && start) this.state.at[id] = { ...start };
    // the cursor stays inside what there is
    const at = this.state.cursor();
    if (!at.edge && rows.length) { at.r = Math.min(at.r, rows.length - 1); at.c = Math.min(at.c, rows[at.r].length - 1); }
    // (a thing open full screen that is no longer there: back to the panel)
    if (this.full && (this.full.panel !== id || !this.fullCell())) this.full = null;
    if (!this.el) return;
    this.el.dataset.panel = id;
    this.el.querySelector('.gm-title').textContent = this.state.panel.name;
    for (const b of this.el.querySelectorAll('.gm-tab')) b.classList.toggle('on', b.dataset.panel === id);
    const { prev, next } = this.state.neighbours();
    this.el.querySelector('.gm-side.prev .nm').textContent = prev.name;
    this.el.querySelector('.gm-side.next .nm').textContent = next.name;
    this.body.innerHTML = html;
    // (the map's ground: the canvas the world's map drew, src/world-map.js)
    if (canvas && canvas.nodeType === 1) this.body.querySelector('.gm-mapimg')?.appendChild(canvas);
    this.body.scrollTop = 0;
    this.drawFull();
    this.paint();
  }

  /** Mark the cursor's cell (or tab) and fill the info strip: its name and what it is, and what A / × does. */
  paint(scroll = true) {
    if (!this.el) return;
    const at = this.state.cursor();
    for (const x of this.el.querySelectorAll('.at')) x.classList.remove('at');
    for (const s of this.el.querySelectorAll('.gm-side')) s.classList.toggle('at', !this.full && !!at.edge && +s.dataset.go === at.edge);
    const cell = this.state.cell(this.rows);
    const node = cell && this.body.querySelector(`[data-at="${at.r},${at.c}"]`);
    if (node) { node.classList.add('at'); if (scroll && !this.full) node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }
    // (the map: the picked mark ringed)
    for (const m of this.body.querySelectorAll('.mk')) m.classList.toggle('sel', m.dataset.mark === cell?.id);
    const name = this.el.querySelector('.gm-name'), sub = this.el.querySelector('.gm-sub');
    const shown = this.full ? this.fullCell() : cell;
    if (at.edge && !this.full) {
      const to = this.state.neighbours()[at.edge > 0 ? 'next' : 'prev'];
      name.textContent = to.name; sub.textContent = t('gm.toPanel', { name: to.name });
    } else { name.textContent = shown?.name ?? ''; sub.textContent = shown?.sub ?? ''; }
    this.el.querySelector('.gm-keys').innerHTML = menuPrompts(this.verb(cell, at));
  }

  /** The verb A / × does now (the strip). */
  verb(cell = this.state.cell(this.rows), at = this.state.cursor()) {
    if (this.full) return this.fullCell()?.full?.use ?? null;
    if (at.edge) return ACT.turn;
    if (!cell?.act) return null;
    if (cell.act === 'zoom') return this.mapZoom === cell.id ? ACT.whole : ACT.zoom;
    return ACT[cell.act];
  }

  open(panel = null) {
    // (View / Select, J, the touch ❏: the Quests, issue #213; the Start menu's Items, Quests and Map their own)
    this.leavePerson(); this.full = null; this.state.show(panel ?? DEFAULT_PANEL); this.render();
    // (drawn while the menu was still hidden: once it shows, the cursor's cell scrolled into view)
    if (this.el && typeof requestAnimationFrame === 'function') requestAnimationFrame(() => this.paint());
  }
  close() { this.full = null; this.drawFull(); }
  show(panel) { this.leavePerson(); this.full = null; this.state.show(panel); this.render(); }
  turn(d) { this.leavePerson(); this.full = null; this.state.turn(d); this.render(); }
  select(r, c, scroll = true) { this.state.at[this.panel] = { r, c }; this.paint(scroll); }

  /** The stick, the D-pad, the arrows. */
  navigate(dx, dy) {
    // a thing full screen: ← → the one before / after, ↑ ↓ read on down its words
    if (this.full) {
      if (dx) this.stepFull(Math.sign(dx));
      else if (dy) { const tx = this.fullEl?.querySelector('.ftext'); if (tx) tx.scrollTop += Math.sign(dy) * Math.max(40, tx.clientHeight * 0.35); }
      return;
    }
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
   * A grid that moves by where its cells are drawn (data-grid-nav: the People cards, the items' tiles, as many a
   * row as fit): the cell that way on the screen (gridStep, src/menu-pad.js); past a row's end the side tab, as
   * moveCursor does. False without a page or such a grid (moveCursor then).
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

  // ---- the full view (issue #213)

  /** The cells of this panel that open full screen, in reading order. */
  fullCells() { return this.rows.flat().filter((x) => x.full); }
  /** The cell open full screen now (null: none). */
  fullCell() { return this.full ? this.fullCells().find((x) => x.kind === this.full.kind && x.id === this.full.id) ?? null : null; }

  /** Open a cell full screen (A / × on it). */
  openFull(cell) {
    if (!cell?.full) return;
    this.note = null;
    this.full = { panel: this.panel, kind: cell.kind, id: cell.id };
    this.drawFull();
    this.paint(false);
  }

  /** ← → in the full view: the one before or after (the cursor follows it). */
  stepFull(d) {
    const list = this.fullCells(), i = list.findIndex((x) => x.kind === this.full?.kind && x.id === this.full?.id);
    const to = list[i + Math.sign(d)];
    if (i < 0 || !to) return;
    this.note = null;
    this.full = { panel: this.panel, kind: to.kind, id: to.id };
    this.cursorOn(to);
    this.drawFull();
    this.paint(false);
  }

  /** The cursor on a cell of this panel. */
  cursorOn(cell) {
    for (let r = 0; r < this.rows.length; r++) {
      const c = this.rows[r].findIndex((x) => x.kind === cell.kind && x.id === cell.id);
      if (c >= 0) { this.state.at[this.panel] = { r, c }; return true; }
    }
    return false;
  }

  /** Draw (or hide) the full view over the sheet. */
  drawFull() {
    if (!this.fullEl) return;
    const cell = this.fullCell();
    this.fullEl.hidden = !cell;
    this.el?.classList.toggle('full', !!cell);
    if (!cell) { this.fullEl.innerHTML = ''; return; }
    const list = this.fullCells(), i = list.indexOf(cell);
    this.fullEl.innerHTML = fullHtml(cell, { prev: list[i - 1]?.name ?? null, next: list[i + 1]?.name ?? null, note: this.note });
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

  /** B / ○, Esc: out of a full view, a person's page or a zoomed map. True if it did (else the menu closes). */
  back() {
    if (this.full) {
      const cell = this.fullCell();
      this.full = null; this.note = null;
      if (cell) this.cursorOn(cell);
      this.drawFull();
      this.paint();
      return true;
    }
    if (this.panel === 'people' && this.person) {
      this.leavePerson();
      this.render();
      // the cursor on the card of the person just read (← → may have moved on from the one opened)
      const id = this._backTo; this._backTo = null;
      const r = this.rows.findIndex((row) => row.some((x) => x.id === id));
      if (r >= 0) this.select(r, this.rows[r].findIndex((x) => x.id === id));
      return true;
    }
    if (this.panel === 'map' && this.mapZoom) { this.mapZoom = null; this.render(); return true; }
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

  /** The world's map is drawn (src/world-map.js): the Map panel again, if it shows. */
  mapReady() { if (this.panel === 'map') this.render(); }

  /**
   * A / ×, Enter: in a full view, its action (a gun mode taken, a switch turned, a gadget in hand); on a cell,
   * what it does (a quest tracked, a thing opened full screen, a person's page, the map zoomed on a mark), or the
   * tab's turn.
   */
  confirm() {
    if (this.full) {
      const cell = this.fullCell();
      if (!cell?.use || !cell.full?.use) return;
      // a world: the ship takes you there (the menu closes), or the line why not, under the button
      if (cell.kind === 'world') { const no = this.onTravel?.(cell.id) ?? null; if (no) { this.note = no; this.drawFull(); } return; }
      this.onUse?.(cell.id); this.render();
      return;
    }
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
    else if (cell.act === 'look') this.openFull(cell);
    else if (cell.act === 'open') this.openPerson(cell.id);
    else if (cell.act === 'back') this.back();
    else if (cell.act === 'zoom') {
      this.mapZoom = this.mapZoom === cell.id ? null : cell.id;
      this.render();
      // (the cursor stays on the mark zoomed on)
      const r = this.rows.findIndex((row) => row[0]?.id === cell.id);
      if (r >= 0) this.select(r, 0);
    }
  }

  /** An item's picture is ready (src/item-icons.js): swap its mark for it, wherever it shows. */
  iconReady(id, url) {
    if (!url) return;
    for (const row of this.rows) for (const x of row) if (x.kind === 'item' && x.id === id && x.it) {
      x.it.icon = url;
      if (x.full) x.full.pic = `<div class="big ${esc(x.it.kind ?? '')}"><img class="ico" src="${esc(url)}" alt="" data-icon="${esc(id)}"></div>`;
    }
    if (!this.el) return;
    if (this.full?.id === id) this.drawFull();
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
    if (c === 'Backspace') return this.back();
    return false;
  }
}
