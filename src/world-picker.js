// The Debug menu (L in play, Debug on the title and in the Start menu): every world, open, whatever
// you've found, the test rooms, the minigames, the game's other pages and what this build is, in
// sections with a heading each (docs/systems/dev-tools.md "The Debug menu"). It is drawn here, for the
// game (src/main.js: over the world, L) and for the title's Debug entry, which shows it alone (?worlds=1,
// src/boot.js, the "◀ Debug" buttons' DEBUG_MENU_HREF) without building a world.
// A world on the route opens in the debug save (src/debug-save.js): its own slot, as if every world
// before it had been played through; the others open in the save being played.
//
//   Play            Continue, then the route's worlds in story order (each in the debug save)
//   Story places    the worlds off the route that are finished (Home, the Lantern, the Atelier)
//   Test rooms      the rooms for trying things (levels with dev: true)
//   Worlds in progress   the worlds still being made (names.js WIP)
//   Games           the minigames, each with its best
//   Pages           the game's other pages (a dev server's own marked, and only there)
//   This build      version, build number, commit, where it runs
//
// Typing filters it (a box in the header; Enter opens the first match); on a controller LB / RB jump
// between sections and Y opens the filter. The item last opened gets the focus back on the way back.

import { ORDER, WIP } from './levels/names.js';
import { GAMES, gameHref } from './minigames/index.js';
import { bestScore, formatScore } from './minigames/kit/scores.js';
import { scoreDef } from './minigames/kit/flow.js';
import { InputMode } from './input-mode.js';
import { glyph } from './pad-glyphs.js';
import { VERSION } from './changelog.js';

/** The game's other pages (they leave the game), in the Pages section in this order. */
export const PAGES = [
  { href: 'changelog.html', label: 'What\'s new', hint: 'every change, with pictures' },
  { href: 'audits.html', label: 'Audits', hint: 'every audit report, its scores and findings, and how they changed' },
  { href: 'items.html', label: 'Items', hint: 'every item, its picture, what it does, where it is found' },
  { href: 'enemies.html', label: 'Creatures & spirits', hint: 'the enemies of every world, their attacks, and Arena practice' },
  { href: 'studio.html', label: 'Character studio', hint: 'the people alone, to tune them' },
  { href: 'motion.html', label: 'Motion', hint: 'the traveller\'s loops against motion matching' },
  { href: 'cinematics.html', label: 'Cinematics', hint: 'replay the films and record quality-control notes' },
  { href: 'trailer.html', label: 'Trailer', hint: 'the in-engine trailer' },
];

/**
 * The pages a dev server alone has (`npx vite`: their middleware is the dev server's, and the build leaves them
 * out): the reference lab (reference-lab.html, docs/systems/reference-lab.md). Marked "dev server" in the list.
 */
export const DEV_PAGES = [
  { href: 'reference-lab.html', label: 'Reference lab', hint: 'generate reference pictures with several AI providers and pick the best', dev: true },
];
/**
 * Pages that may not be there yet: listed once the page answers (probePages). The References page
 * (references.html) is being made beside this menu; it shows up here as soon as it exists.
 */
export const MAYBE_PAGES = [
  { href: 'references.html', label: 'References', hint: 'the pictures the game is drawn after', maybe: true },
];
/** Is this the dev server? (import.meta.env.DEV: false in a build, absent under node) */
export const devServer = () => { try { return !!import.meta.env?.DEV; } catch { return false; } };
/** The pages the list shows here (the maybe-pages too: hidden until they answer). */
export const pagesHere = (dev = devServer()) => (dev ? [...PAGES, ...MAYBE_PAGES, ...DEV_PAGES] : [...PAGES, ...MAYBE_PAGES]);

/** What this build is (vite.config.js defines __HIRAETH_BUILD__: { commit, build }; nothing under node). */
export function buildInfo() {
  // eslint-disable-next-line no-undef
  try { return typeof __HIRAETH_BUILD__ === 'object' && __HIRAETH_BUILD__ ? __HIRAETH_BUILD__ : {}; } catch { return {}; }
}

/** A game's best in the save (`state`: flag(name)), as its results show it, or '' (none yet, or no save). */
export function gameBest(g, state) {
  if (!state?.flag) return '';
  const v = bestScore(state, scoreDef(g, state));   // (a best of each difficulty: the one chosen last)
  return v === null ? '' : formatScore(g, v);
}

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** The words an item is found by (lower case: its name, its line, its id). */
const words = (...t) => esc(t.filter(Boolean).join(' ').toLowerCase());

/** A row: a link with its name and one line under it (and a tag at the end: "dev server", a best). */
export function rowHtml({ href, label, hint = '', tag = '', cls = '', q = '', extra = '' }) {
  return `<a class="row${cls ? ` ${cls}` : ''}" href="${esc(href)}" data-q="${words(label, hint, q, href)}"${extra}>`
    + `<span class="lbl">${label}${tag}</span>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}${glyph('ok', { focus: true })}</a>`;
}

/** A section: its heading (its name and one line), then its cards or rows. */
export function sectionHtml(key, title, line, body, kind = 'rows') {
  return `<section class="dbg-section" id="dbg-${key}" data-section="${key}" aria-labelledby="dbg-${key}-h">`
    + `<h2 class="sec" id="dbg-${key}-h">${esc(title)}${line ? ` <small>${esc(line)}</small>` : ''}</h2>`
    + `<div class="${kind}">${body}</div></section>`;
}

/** The Games section: each opens its game's page (?game=<id>, src/minigames/), its best beside its name. */
export function gamesRow(games = GAMES, state = null) {
  if (!games.length) return '';
  return sectionHtml('games', 'Games', 'the minigames, each on its own page', games.map((g) => {
    const best = gameBest(g, state);
    return rowHtml({ href: gameHref(g.id), label: esc(g.name), hint: g.blurb, q: g.id, cls: 'game',
      tag: best ? `<small class="best">best ${esc(best)}</small>` : '' });
  }).join(''));
}

/** Where a card goes: a route world in the debug save (?debugsave=1, src/boot.js), any other in the save being played. */
export function pickHref(id, order = ORDER) {
  return order.includes(id) ? `?level=${id}&debugsave=1` : `?level=${id}`;
}

/** What picking a world does to the save (the Play section's line, and This build's note). */
export const DEBUG_NOTE = 'A world on the route opens in a separate debug save, as if every world before it were done: '
  + 'their quests, boxes, gear and recordings. Your own saves are not touched (choose one on the title to go back to it).';

/** What a card says of the save it opens in. */
export const alongLine = (id, order = ORDER) => {
  const i = order.indexOf(id);
  return i < 0 ? 'in your save' : i === 0 ? 'debug save · a new journey' : `debug save · ${i} world${i === 1 ? '' : 's'} done before it`;
};

// the story places, in the order they come (the rest of the finished worlds off the route after them)
const PLACES = ['home', 'lantern', 'atelier'];
/**
 * The worlds by section (pure): the route in story order, the story places, the test rooms, the worlds in
 * progress. Every level is in exactly one.
 */
export function worldSections(levels, { order = ORDER, wip = WIP } = {}) {
  const byId = new Map(levels.map((l) => [l.id, l]));
  const play = order.map((id) => byId.get(id)).filter(Boolean);
  const rooms = levels.filter((l) => l.dev && !order.includes(l.id));
  const progress = levels.filter((l) => wip.includes(l.id) && !l.dev && !order.includes(l.id));
  const taken = new Set([...play, ...rooms, ...progress]);
  const rank = (l) => { const i = PLACES.indexOf(l.id); return i < 0 ? PLACES.length : i; };
  const places = levels.filter((l) => !taken.has(l)).sort((a, b) => rank(a) - rank(b));
  return { play, places, rooms, progress };
}
/** The worlds in the order the menu shows and numbers them (a number key opens the world with that number). */
export const pickOrder = (levels, o) => { const s = worldSections(levels, o); return [...s.play, ...s.places, ...s.rooms, ...s.progress]; };

/**
 * A world's card in the grid: its picture with its number, its name, its source and the save it opens in;
 * its blurb and moves are its tooltip and, focused, the strip at the foot. The confirm glyph shows on the
 * focused one (src/pad-glyphs.js).
 */
export function cardHtml(l, i, current = false) {
  return `<a class="card${current ? ' current' : ''}" href="${pickHref(l.id)}" data-id="${esc(l.id)}" data-q="${words(l.title, l.source, l.id, l.moves)}" title="${esc(l.blurb)}">
    <span class="pic"><img src="thumbs/${esc(l.id)}.jpg" alt="" loading="lazy" onerror="this.style.visibility='hidden'" /><b class="num">${i + 1}</b>${glyph('ok', { focus: true })}</span>
    <span class="txt"><h3>${esc(l.title)}</h3><span class="src">${esc(l.source)}</span><span class="along">${esc(alongLine(l.id))}</span></span>
  </a>`;
}

/** The build's facts, for This build (pure). `app`: the Android / Deck app's build line, when there is one. */
export function buildRows({ version = VERSION, info = buildInfo(), dev = devServer(), app = '' } = {}) {
  const fact = (k, v, cls = '') => `<div class="row fact${cls}" data-q="${words(k, v)}"><span class="lbl">${esc(k)}</span><span class="hint">${esc(v)}</span></div>`;
  return [
    fact('Version', `v${version}`),
    fact('Build', app || (info.build ? `build ${info.build}` : 'web')),
    fact('Commit', info.commit || 'unknown'),
    fact('Running on', dev ? 'the dev server (npx vite)' : 'the built game'),
    `<p class="debug-note" data-q="${words('debug save', DEBUG_NOTE)}">${esc(DEBUG_NOTE)}</p>`,
  ].join('');
}

/** The menu's sections, in order (pure): [{ key, title, line, html }] (the tests read it). */
export function menuSections({ levels, current = null, cont = null, state = null, dev = devServer(), games = GAMES }) {
  const s = worldSections(levels);
  let n = 0;
  const cards = (list) => list.map((l) => cardHtml(l, n++, l.id === current)).join('');
  const out = [];
  const contRow = cont ? rowHtml({ href: `?level=${cont.id}`, label: `▶ Continue — ${esc(cont.title)}`, hint: 'the world this save was left in, in your save', cls: 'continue', q: 'continue' }) : '';
  out.push({ key: 'play', title: 'Play', line: 'the route, in story order · each world in its own debug save', html: `${contRow ? `<div class="rows lead">${contRow}</div>` : ''}<div class="cards">${cards(s.play)}</div>` });
  if (s.places.length) out.push({ key: 'places', title: 'Story places', line: 'off the route · in your save', html: `<div class="cards">${cards(s.places)}</div>` });
  if (s.rooms.length) out.push({ key: 'rooms', title: 'Test rooms', line: 'rooms for trying things · in your save', html: `<div class="cards">${cards(s.rooms)}</div>` });
  if (s.progress.length) out.push({ key: 'progress', title: 'Worlds in progress', line: 'still being made, off the galactic map · in your save', html: `<div class="cards">${cards(s.progress)}</div>` });
  const g = games.length ? gamesRow(games, state) : '';
  if (g) out.push({ key: 'games', title: 'Games', line: '', html: g, whole: true });
  const pages = pagesHere(dev).map((p) => rowHtml({ href: p.href, label: esc(p.label), hint: p.hint,
    tag: p.dev ? '<small class="tag">dev server</small>' : '', cls: p.maybe ? 'maybe' : '', extra: p.maybe ? ' hidden data-maybe=""' : '' })).join('');
  out.push({ key: 'pages', title: 'Pages', line: 'the game\'s other pages · each has a ◀ Debug button back here', html: `<div class="rows">${pages}</div>` });
  out.push({ key: 'build', title: 'This build', line: '', html: `<div class="rows facts">${buildRows({ dev })}</div>` });
  return out;
}

/** The section chips in the header (and their LB / RB glyphs at the ends). */
const chipsHtml = (sections) => `${glyph('lb')}${sections.map((s) => `<button type="button" class="chip" data-jump="${s.key}">${esc(s.title)}</button>`).join('')}${glyph('rb')}`;

/**
 * Which items match a filter (pure): every word of it is in the item's words. '' matches all.
 * @returns a predicate on an item's data-q
 */
export function matcher(text) {
  const terms = String(text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return (q) => terms.every((t) => String(q ?? '').includes(t));
}

/** The maybe-pages (MAYBE_PAGES) that answer: shown. A page that isn't there (404, or the game's own page in its place) stays hidden. */
export async function probePages(root, fetcher = globalThis.fetch) {
  if (!fetcher) return;
  for (const a of root.querySelectorAll('a.row[data-maybe]')) {
    try {
      const r = await fetcher(a.getAttribute('href'), { cache: 'no-store' });
      const text = r.ok ? await r.text() : '';
      if (r.ok && text && !text.includes('id="picker"')) a.hidden = false;
    } catch { /* not there */ }
  }
}

/** The last item opened from the menu (this tab): it gets the focus back on the way back (◀ Debug). */
export const LAST_KEY = 'moebius.debugMenu.last';

/**
 * The menu into the #picker element: its header (the filter, the section chips), its sections. Returns
 * { jump(dir), filter(text), focusSearch(), sections() } for the keys and the pad.
 */
export function fillPicker(picker, { levels, current = null, cont = null, state = null }) {
  const doc = picker.ownerDocument;
  const header = picker.querySelector('header');
  const sections = menuSections({ levels, current, cont, state });
  // the header: the title, the filter and the close button; under it a chip a section
  const tools = header.querySelector('.tools') ?? header.lastElementChild;
  const search = Object.assign(doc.createElement('input'), { type: 'search', className: 'filter', placeholder: 'filter…', autocomplete: 'off', spellcheck: false });
  search.setAttribute('aria-label', 'Filter the Debug menu');
  search.setAttribute('enterkeyhint', 'go');
  const searchBox = doc.createElement('label');
  searchBox.className = 'search';
  searchBox.innerHTML = `${glyph('y', { key: '/' })}<span class="say">filter</span>`;
  searchBox.append(search);
  tools.prepend(searchBox);
  const nav = doc.createElement('nav');
  nav.className = 'jump';
  nav.setAttribute('aria-label', 'Sections');
  nav.innerHTML = chipsHtml(sections);
  header.append(nav);   // (in the sticky header: the chips stay in sight)
  const body = picker.querySelector('.sections') ?? doc.createElement('div');
  body.className = 'sections';
  body.innerHTML = sections.map((s) => (s.whole ? s.html : sectionHtml(s.key, s.title, s.line, s.html, 'body'))).join('')
    + '<p class="none" hidden>Nothing matches. <button type="button" class="clear">clear the filter</button></p>';
  if (!body.isConnected) header.after(body);
  probePages(body);
  // a grid on a controller: the D-pad and the stick move to the card or row that way (menuNavigate, data-grid-nav);
  // the focused card's words in the strip at the foot (the cards are small: a picture, a name, the save)
  picker.dataset.gridNav = '';
  const info = picker.querySelector('.info') ?? picker.appendChild(Object.assign(doc.createElement('p'), { className: 'info' }));
  picker.addEventListener('focusin', (e) => {
    const card = e.target.closest?.('.card');
    const l = card && levels.find((x) => x.id === card.dataset.id);
    info.innerHTML = l ? `<b>${esc(l.title)}</b> ${esc(l.blurb)} <span class="moves">${esc(l.moves)}</span>` : '';
    info.hidden = !l;
    const sec = e.target.closest?.('.dbg-section')?.dataset.section;
    if (sec) mark(sec);
  });
  info.hidden = true;
  // (the sticky header's height: a focused card scrolled to stays under it, not behind it)
  const headSize = () => picker.style.setProperty('--head', `${header.offsetHeight + 14}px`);
  if (doc.defaultView?.ResizeObserver) new doc.defaultView.ResizeObserver(headSize).observe(header); else headSize();
  const close = picker.querySelector('.close');
  if (close && !close.querySelector('.glyph')) close.insertAdjacentHTML('afterbegin', glyph('back', { key: 'Esc' }));
  // the chip of the section in view (or with the focus) is lit
  const mark = (key) => { for (const c of nav.querySelectorAll('.chip')) c.classList.toggle('here', c.dataset.jump === key); };
  const visible = () => [...body.querySelectorAll('.dbg-section')].filter((s) => !s.hidden);
  const items = (sec) => [...sec.querySelectorAll('a[href]')].filter((a) => !a.hidden && a.getClientRects().length);
  const goTo = (sec, focus = true) => {
    if (!sec) return;
    mark(sec.dataset.section);
    // (the heading under the sticky header: the picker scrolls, the header's height above it)
    const top = sec.getBoundingClientRect().top - picker.getBoundingClientRect().top + picker.scrollTop - (header.offsetHeight + 8);
    picker.scrollTo?.({ top: Math.max(0, top), behavior: 'smooth' });
    if (focus) items(sec)[0]?.focus({ preventScroll: true });
  };
  nav.addEventListener('click', (e) => {
    const c = e.target.closest?.('.chip');
    if (c) goTo(body.querySelector(`#dbg-${c.dataset.jump}`), !doc.body.classList.contains('touch'));
  });
  /** LB / RB: the section before or after the one with the focus (or in view). */
  const jump = (dir) => {
    const list = visible();
    if (!list.length) return;
    const at = doc.activeElement?.closest?.('.dbg-section');
    let i = list.indexOf(at);
    if (i < 0) { const lit = nav.querySelector('.chip.here')?.dataset.jump; i = list.findIndex((s) => s.dataset.section === lit); }
    goTo(list[i < 0 ? 0 : (i + dir + list.length) % list.length]);
  };
  const none = body.querySelector('.none');
  /** Show only what matches (and the sections with something in them). */
  const filter = (text) => {
    const ok = matcher(text);
    let any = false;
    for (const sec of body.querySelectorAll('.dbg-section')) {
      let shown = 0;
      const head = sec.querySelector('h2.sec')?.firstChild?.textContent.toLowerCase() ?? '';   // ("test rooms", "pages": the whole section)
      for (const el of sec.querySelectorAll('[data-q]')) {
        const show = ok(`${el.dataset.q} ${head}`);
        el.classList.toggle('filtered', !show);
        if (show && !el.hidden && !el.classList.contains('debug-note')) shown++;   // (a maybe-page not there yet: hidden)
      }
      sec.hidden = !shown;
      nav.querySelector(`[data-jump="${sec.dataset.section}"]`)?.toggleAttribute('disabled', !shown);
      any ||= !!shown;
    }
    none.hidden = any;
    picker.classList.toggle('filtering', !!String(text).trim());
  };
  search.addEventListener('input', () => filter(search.value));
  body.querySelector('.clear').addEventListener('click', () => { search.value = ''; filter(''); search.focus(); });
  // the box's keys are its own (the game's and the menu's shortcuts don't see them): Enter opens the
  // first match, Esc clears it (empty: leaves it), ↓ to the first match
  search.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); const first = visible().flatMap(items)[0]; first?.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); if (search.value) { search.value = ''; filter(''); } else search.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); visible().flatMap(items)[0]?.focus(); }
  });
  search.addEventListener('focus', () => picker.classList.add('typing'));
  search.addEventListener('blur', () => picker.classList.remove('typing'));
  // the item opened is remembered (this tab): back here, it has the focus again
  body.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (a) try { doc.defaultView?.sessionStorage?.setItem(LAST_KEY, a.getAttribute('href')); } catch { /* none */ }
  });
  const focusSearch = () => { search.focus(); search.select?.(); };
  /** A key typed on the menu (not in the box): a letter starts the filter with it. True: taken. */
  const typeKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || e.target === search) return false;
    if (e.key === '/') { e.preventDefault(); focusSearch(); return true; }
    if (!/^[a-z]$/i.test(e.key)) return false;
    e.preventDefault();
    search.value += e.key;
    search.focus();
    filter(search.value);
    return true;
  };
  return { jump, filter, focusSearch, typeKey, search, goTo: (key) => goTo(body.querySelector(`#dbg-${key}`)), numbered: pickOrder(levels) };
}

/** The item opened last from the menu, focused again (the way back from a page or a world). */
export function restoreLast(picker, storage = globalThis.sessionStorage) {
  let href = null;
  try { href = storage?.getItem(LAST_KEY); } catch { /* none */ }
  if (!href) return null;
  const el = [...picker.querySelectorAll('.sections a[href]')].find((a) => a.getAttribute('href') === href && !a.hidden);
  if (!el) return null;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: 'center' });
  return el;
}

/** The menu alone, before any world is built: a card (or its number) loads that world; close goes back to the title. */
export async function showWorldsOnly(doc = document, win = window) {
  const [{ LEVELS, levelById }, { SaveGame, isTouch }, { Controller, menuNavigate }, { padFaces }, { game }, { inApp, callApp, buildLabel }] = await Promise.all([
    import('./levels/index.js'), import('./ui.js'), import('./controller.js'), import('./native-pad.js'), import('./game-state.js'), import('./native-app.js')]);
  const picker = doc.getElementById('picker');
  // what is in hand (remembered from the title): the glyphs in the buttons follow it (src/pad-glyphs.js)
  const inputMode = new InputMode({ touchDevice: isTouch });
  const hint = picker.querySelector('header .hint');
  const showInput = () => { inputMode.apply(doc.body.classList); if (hint) hint.textContent = inputMode.kind === 'keys' ? 'type to filter · a number opens its world' : ''; };
  for (const ev of ['keydown', 'pointerdown', 'touchstart']) win.addEventListener(ev, (e) => { inputMode.event(e); showInput(); }, { capture: true, passive: true });
  const saved = SaveGame.load()?.level;
  const menu = fillPicker(picker, { levels: LEVELS, cont: levelById(saved) ?? null, state: game });
  // in the Android app (or on the Deck): its build line in This build
  if (inApp(win)) callApp('info', win).then((i) => { const line = buildLabel(i); const el = picker.querySelector('#dbg-build .fact:nth-child(2) .hint'); if (line && el) el.textContent = line; }).catch(() => {});
  showInput();   // (the keys' hint; a pad's back button is in the close button)
  const toTitle = () => { win.location.href = win.location.pathname; };
  picker.querySelector('.close').addEventListener('click', toTitle);
  const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  win.addEventListener('keydown', (e) => {
    if (e.target === menu.search) return;   // (the filter's keys are its own)
    if (e.code === 'Escape') { if (picker.classList.contains('filtering')) menu.filter(menu.search.value = ''); else toTitle(); return; }
    if (ARROWS[e.code]) { e.preventDefault(); menuNavigate(picker, ...ARROWS[e.code]); return; }   // (the grid, as the pad moves in it)
    if (e.code === 'PageDown' || e.code === 'PageUp') { e.preventDefault(); menu.jump(e.code === 'PageDown' ? 1 : -1); return; }
    const n = Number(e.key);
    if (e.key !== ' ' && n >= 1 && n <= Math.min(9, menu.numbered.length)) { win.location.search = pickHref(menu.numbered[n - 1].id); return; }
    menu.typeKey(e);
  });
  // a controller: d-pad / stick move, A opens, B back to the title (as on the title, src/title.js), LB / RB a section, Y the filter
  const controller = new Controller({
    context: () => 'menu',
    look: () => {}, faces: () => padFaces(),
    activity: () => { inputMode.pad(); showInput(); },   // (and the world it opens starts with no touch buttons: src/input-mode.js)
    navigate: (x, y, fresh) => menuNavigate(picker, x, y, fresh),
    scroll: (amount) => { picker.scrollTop += amount; },
    action: (name) => {
      if (doc.activeElement === menu.search && name === 'back') { menu.search.blur(); return; }
      if (name === 'back' || name === 'start' || name === 'select') toTitle();
      if (name === 'tabPrev' || name === 'tabNext') menu.jump(name === 'tabNext' ? 1 : -1);
      if (name === 'y') menu.focusSearch();
      if (name === 'confirm') { if (picker.contains(doc.activeElement) && doc.activeElement !== menu.search) doc.activeElement.click(); else menuNavigate(picker, 0, 1); }
    },
  });
  let last = performance.now();
  const loop = (now) => {
    const pads = Array.from(navigator.getGamepads?.() ?? []).some((p) => p?.connected);
    if (inputMode.frame(pads) === 'pad' !== doc.body.classList.contains('controller')) showInput();
    controller.update(Math.min((now - last) / 1000, 0.1), !doc.hidden && doc.hasFocus());
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  doc.getElementById('loading')?.remove();
  picker.classList.add('open');
  restoreLast(picker);   // (back from a page or a world: the item it was opened from)
}
