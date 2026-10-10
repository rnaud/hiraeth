// The audits page (audits.html, Debug → Audits: src/world-picker.js PAGES; docs/systems/ui.md "The audits page"):
// by default a dashboard, a card per theme with its latest report's scores and the change since the one before
// (src/audits-page/dashboard.js, themes.js), each theme's earlier versions behind a History toggle; "All audits"
// (#/all) every report in docs/audits/ and the cinematics QC report; a report's scores, findings, ranked edits,
// the TODO items it produced, and two versions of one kind compared. The data is built from the reports at build time
// (scripts/audits-data.mjs: audits/audits.json, site-only like the changelog's pictures); a bundled game reads
// it from the site (mediaSrc).
//
// A controller: the D-pad and the stick move across what is on screen (data-grid-nav, menuNavigate: the cards,
// the chips, the tabs, the blocks of a report; a block taller than the screen scrolls first), A opens, B goes
// back (a picture, the report, All audits, the dashboard, then the Debug list), LB / RB the view (dashboard),
// the kind (All audits) or the tab (a report), Y a dashboard card's History, X / Y the audit before / after in a
// report, the right stick scrolls. The keys: arrows, Enter, Esc, Q / E, H, [ / ]. Mouse and touch: everything
// is a button or a link.
import { Controller, menuNavigate } from '../controller.js';
import { installNativePad, watchLabels, padFaces } from '../native-pad.js';
import { installGlyphs } from '../pad-glyphs.js';
import { InputMode } from '../input-mode.js';
import { mediaSrc } from '../changelog-page/view.js';
import { DEBUG_MENU_HREF } from '../debug-back.js';
import { indexHtml, kindChips, kindsOf, parseRoute, routeHash, tabHtml, tabsHtml, TABS } from './view.js';
import { dashboardHtml, viewTabs, VIEWS } from './dashboard.js';
import { latestByTheme } from './themes.js';

/** Where the data is, beside the page (scripts/audits-data.mjs DATA_FILE). */
export const DATA_PATH = 'audits/audits.json';
/** Where B goes from the index: the Debug list the page was opened from (the shared "◀ Debug" button's, src/debug-back.js). */
const DEBUG_HREF = DEBUG_MENU_HREF;

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
installNativePad(); watchLabels(); installGlyphs();
const inputMode = new InputMode({ touchDevice: isTouch });
inputMode.apply(document.body.classList);
for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, (e) => { inputMode.event(e); inputMode.apply(document.body.classList); }, { capture: true, passive: true });
document.body.dataset.gridNav = '';   // (menuNavigate: what is on screen, by where it is drawn)

const $ = (s) => document.querySelector(s);
const state = { kind: 'all', route: parseRoute(location.hash), data: null, lastCard: null, view: 'latest', openHistory: new Set() };

let data;
try {
  const res = await fetch(mediaSrc(DATA_PATH), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  data = await res.json();
} catch (e) {
  $('#index').innerHTML = `<p class="empty">The audits couldn't be read (${String(e.message)}). On a device they come from the site: check the connection.</p>`;
  throw e;
}
const { reports, index } = data;
const reportOf = (id) => reports.find((r) => r.id === id);
const themes = latestByTheme(reports);
const visibleIds = () => index.filter((e) => state.kind === 'all' || e.kind === state.kind).map((e) => e.id);

// ------------------------------------------------------------------ drawing
function setPics(root) {
  for (const img of root.querySelectorAll('img[data-path]')) {
    img.src = mediaSrc(img.dataset.path);
    img.addEventListener('error', () => img.closest('figure, .thumb')?.classList.add('failed'), { once: true });
  }
  for (const f of root.querySelectorAll('figure')) { f.tabIndex = 0; f.dataset.nav = ''; }
}

/** The header and the main area as a list (the dashboard or All audits) wants them. */
function listChrome(view) {
  state.view = view;
  document.body.classList.remove('reading');
  document.body.dataset.view = view;
  $('#back').hidden = true;   // (the shared ◀ Debug button is the way out from here)
  $('#prev').hidden = $('#next').hidden = true;
  $('#index').hidden = false; $('#reader').hidden = true;
  document.title = 'Hiraeth · the audits';
}

function drawIndex() {
  listChrome('all');
  $('#title').innerHTML = `THE AUDITS <span>all ${index.length} reports</span>`;
  $('#nav').innerHTML = `${viewTabs('all', index.length, { glyphs: false })}<span class="sep" aria-hidden="true"></span>${kindChips(index, state.kind)}`;
  $('#nav').setAttribute('aria-label', 'What kind of audit');
  $('#index').innerHTML = indexHtml(index, reports, state.kind);
  const back = state.lastCard && $(`.card[data-id="${CSS.escape(state.lastCard)}"]`);
  if (back) back.focus({ preventScroll: false });
}

function drawDashboard() {
  listChrome('latest');
  $('#title').innerHTML = `THE AUDITS <span>the latest of ${themes.length} themes</span>`;
  $('#nav').innerHTML = viewTabs('latest', index.length);
  $('#nav').setAttribute('aria-label', 'Which audits');
  $('#index').innerHTML = dashboardHtml(themes, { open: state.openHistory });
  const back = state.lastCard && $(`#index a[data-open="${CSS.escape(state.lastCard)}"]`);
  if (back) back.focus({ preventScroll: false });
}

/** A card's History, shown or hidden (the pad's Y on the card, H, or its button). */
function toggleHistory(kind) {
  const card = $(`.theme[data-kind="${CSS.escape(kind)}"]`);
  if (!card) return;
  const open = !state.openHistory.has(kind);
  if (open) state.openHistory.add(kind); else state.openHistory.delete(kind);
  const btn = card.querySelector('.hist-toggle'), panel = card.querySelector('.history');
  if (!btn || !panel) return;
  btn.setAttribute('aria-expanded', String(open));
  btn.querySelector('.caret').textContent = open ? '▴' : '▾';
  panel.hidden = !open;
  if (open) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
/** The card the focus is in (or the one a pointer last opened), on the dashboard. */
const focusedTheme = () => document.activeElement?.closest?.('.theme')?.dataset.kind ?? null;

function drawReader() {
  const { id, tab, other } = state.route;
  const r = reportOf(id);
  if (!r) { location.hash = '#/'; return; }
  state.lastCard = id;
  const entry = index.find((e) => e.id === id);
  document.body.classList.add('reading');
  $('#title').innerHTML = `${r.kindName.toUpperCase()} <span>v${r.version} · ${r.date}</span>`;
  $('#back').innerHTML = `<span class="glyph" data-glyph="back" aria-hidden="true"></span>◀ Audits`;
  $('#back').setAttribute('href', routeHash({ view: state.view }));
  $('#back').hidden = false;
  $('#prev').hidden = $('#next').hidden = false;
  $('#nav').innerHTML = tabsHtml(r, tab);
  $('#nav').setAttribute('aria-label', 'The report’s parts');
  $('#index').hidden = true; $('#reader').hidden = false;
  const body = $('#reader');
  body.innerHTML = `<h2 class="rtitle">${r.title}</h2>${tabHtml(r, tab, { entry, reports, other })}`;
  setPics(body);
  scrollTo(0, 0);
  document.title = `Hiraeth · ${r.kindName} v${r.version} audit`;
  // the pad's focus: on the open tab (A there does nothing; ↓ goes into the report)
  if (document.body.classList.contains('controller')) $(`.tab[aria-selected="true"]`)?.focus({ preventScroll: true });
}

function draw() {
  state.route = parseRoute(location.hash);
  closePic();
  if (state.route.id) drawReader(); else if (state.route.view === 'all') drawIndex(); else drawDashboard();
}
addEventListener('hashchange', draw);

// ------------------------------------------------------------------ moving about
const go = (route) => { location.hash = routeHash(route); };
function openCard(id) { go({ id }); }
function back() {
  if (picOpen()) return closePic();
  if (state.route.id) return go({ view: state.view });
  if (state.route.view === 'all') return go({});
  location.href = DEBUG_HREF;
}
function stepView(d) {
  const i = VIEWS.findIndex((v) => v.id === (state.route.view ?? 'latest'));
  const view = VIEWS[(i + d + VIEWS.length) % VIEWS.length].id;
  go({ view });
}
function stepKind(d) {
  const kinds = kindsOf(index);
  state.kind = kinds[(kinds.indexOf(state.kind) + d + kinds.length) % kinds.length];
  drawIndex();
  if (document.body.classList.contains('controller')) $(`.chip[data-kind="${state.kind}"]`)?.focus({ preventScroll: true });
}
function stepTab(d) {
  const i = TABS.findIndex((t) => t.id === state.route.tab);
  go({ id: state.route.id, tab: TABS[(i + d + TABS.length) % TABS.length].id });
}
function stepAudit(d) {
  const ids = visibleIds(), i = ids.indexOf(state.route.id);
  if (i < 0) return;
  go({ id: ids[(i + d + ids.length) % ids.length], tab: state.route.tab === 'compare' ? 'scores' : state.route.tab });
}
/** A direction: a block taller than the screen scrolls first (a report's long section), a wide table sideways; else the focus moves. */
function navigate(x, y, fresh = true) {
  const el = document.activeElement;
  if (el && el !== document.body && !picOpen()) {
    const r = el.getBoundingClientRect(), top = $('header').getBoundingClientRect().bottom, vh = innerHeight;
    if (y > 0 && r.bottom > vh + 8 && r.top < vh) { scrollBy({ top: Math.min(vh * 0.6, r.bottom - vh + 24), behavior: 'smooth' }); return; }
    if (y < 0 && r.top < top - 8 && r.bottom > top) { scrollBy({ top: -Math.min(vh * 0.6, top - r.top + 24), behavior: 'smooth' }); return; }
    if (x && el.classList.contains('scroll') && el.scrollWidth > el.clientWidth + 4) {
      const at = el.scrollLeft, max = el.scrollWidth - el.clientWidth;
      if ((x > 0 && at < max - 2) || (x < 0 && at > 2)) { el.scrollBy({ left: x * el.clientWidth * 0.6, behavior: 'smooth' }); return; }
    }
  }
  if (picOpen()) { if (x) stepPic(x); return; }
  menuNavigate(document.body, x, y, fresh);
}

// ------------------------------------------------------------------ pictures, full size
const pic = $('#pic');
let pics = [], picAt = -1;
const picOpen = () => pic.classList.contains('open');
function openPic(path) {
  pics = [...new Set([...$('#reader').querySelectorAll('img[data-path]')].map((i) => i.dataset.path))];
  picAt = Math.max(0, pics.indexOf(path));
  showPic();
  pic.classList.add('open'); pic.setAttribute('aria-hidden', 'false');
  state.picFrom = document.activeElement;
  pic.querySelector('[data-close]').focus({ preventScroll: true });
}
function showPic() {
  const path = pics[picAt];
  const src = [...$('#reader').querySelectorAll('img[data-path]')].find((i) => i.dataset.path === path);
  pic.querySelector('img').src = mediaSrc(path);
  const cap = src?.closest('figure')?.querySelector('figcaption')?.textContent || src?.alt || src?.closest('.thumb')?.title || path.split('/').pop();
  pic.querySelector('.cap').textContent = `${cap} (${picAt + 1} of ${pics.length})`;
}
function stepPic(d) { if (pics.length) { picAt = (picAt + d + pics.length) % pics.length; showPic(); } }
function closePic() {
  if (!picOpen()) return;
  pic.classList.remove('open'); pic.setAttribute('aria-hidden', 'true');
  state.picFrom?.focus?.({ preventScroll: true });
}
pic.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) stepPic(+b.dataset.go);
  else if (e.target.closest('[data-close]') || e.target === pic) closePic();
});

// ------------------------------------------------------------------ mouse, touch, keys
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('#pic')) return;
  const card = t.closest('.card');
  if (card) return openCard(card.dataset.id);
  const kind = t.closest('[data-kind]');
  if (kind && kind.matches('.chip')) { state.kind = kind.dataset.kind; drawIndex(); return; }
  const view = t.closest('[data-view]');
  if (view) return go({ view: view.dataset.view });
  const hist = t.closest('[data-history]');
  if (hist) return toggleHistory(hist.dataset.history);
  const tab = t.closest('[data-tab]');
  if (tab) return go({ id: state.route.id, tab: tab.dataset.tab });
  const cmp = t.closest('[data-compare]');
  if (cmp) return go({ id: state.route.id, tab: 'compare', other: cmp.dataset.compare });
  const jump = t.closest('[data-jump]');
  if (jump) { const s = document.getElementById(jump.dataset.jump); s?.focus({ preventScroll: true }); s?.scrollIntoView({ block: 'start' }); return; }
  const thumb = t.closest('.thumb, figure img, figure');
  if (thumb) { const img = thumb.matches('img') ? thumb : thumb.querySelector('img[data-path]'); if (img) { e.preventDefault(); openPic(img.dataset.path); } return; }
  if (t.closest('#prev')) return stepAudit(-1);
  if (t.closest('#next')) return stepAudit(1);
});
/** A / Enter on what has the focus. */
function confirm() {
  const el = document.activeElement;
  if (picOpen()) { if (el?.matches('[data-go]')) el.click(); else closePic(); return; }
  if (!el || el === document.body) return menuNavigate(document.body, 0, 1);
  if (el.matches('.card')) return openCard(el.dataset.id);
  if (el.matches('figure')) { const img = el.querySelector('img[data-path]'); if (img) openPic(img.dataset.path); return; }
  if (el.matches('button, a[href], summary')) el.click();
}
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return;
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (dir) { e.preventDefault(); navigate(...dir); return; }
  if (e.key === 'Enter' || e.key === ' ') { if (document.activeElement?.matches('.card, figure, .sec') || picOpen()) { e.preventDefault(); confirm(); } return; }
  if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); back(); return; }
  if (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E') { const d = /e/i.test(e.key) ? 1 : -1; if (state.route.id) stepTab(d); else if (state.route.view === 'all') stepKind(d); else stepView(d); return; }
  if ((e.key === 'h' || e.key === 'H') && !state.route.id && state.route.view !== 'all') { const k = focusedTheme(); if (k) toggleHistory(k); return; }
  if (state.route.id && (e.key === '[' || e.key === ']')) stepAudit(e.key === ']' ? 1 : -1);
});

// ------------------------------------------------------------------ a controller
const controller = new Controller({
  context: () => 'menu', look: () => {}, faces: () => padFaces(),
  activity: () => { inputMode.pad(); inputMode.apply(document.body.classList); },
  navigate: (x, y, fresh) => navigate(x, y, fresh),
  scroll: (amount) => { if (!picOpen()) scrollBy(0, amount); },
  action: (name) => {
    if (name === 'back') back();
    else if (name === 'confirm') confirm();
    else if (name === 'tabPrev' || name === 'tabNext') { const d = name === 'tabNext' ? 1 : -1; if (picOpen()) stepPic(d); else if (state.route.id) stepTab(d); else if (state.route.view === 'all') stepKind(d); else stepView(d); }
    else if ((name === 'x' || name === 'y') && state.route.id && !picOpen()) stepAudit(name === 'y' ? 1 : -1);
    else if (name === 'y' && !state.route.id && state.route.view !== 'all') { const k = focusedTheme(); if (k) toggleHistory(k); }
  },
});
let last = performance.now();
const tick = (t) => {
  const padOn = Array.from(navigator.getGamepads?.() ?? []).some((p) => p?.connected);
  if ((inputMode.frame(padOn) === 'pad') !== document.body.classList.contains('controller')) inputMode.apply(document.body.classList);
  controller.update(Math.min(0.1, (t - last) / 1000), !document.hidden && document.hasFocus());
  last = t; requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

draw();
window.auditsPage = { data, state, go, themes, toggleHistory };   // (for the screenshots and the console)
