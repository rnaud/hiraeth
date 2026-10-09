// The references page (references.html, Debug → References on the dev server: src/world-picker.js DEV_PAGES;
// docs/systems/references.md "The references page"): every picture under references/ by folder (the levels,
// each world's environment / characters / places, then the folders of no world, the lab's picks, the archive
// closed at the bottom), small pictures in a grid, one full screen with what its folder says of it, a search
// over the paths and filters; the address keeps the place (#path=…&q=…&world=…&kind=…&lab=1&prompt=1).
// The index comes from the dev server (scripts/references-index.mjs): references/ is not deployed.
//
// A controller: the D-pad and the stick move across what is on screen (data-grid-nav, menuNavigate), A opens,
// B goes back (the picture, the folders drawer, the search, then the Debug list), LB / RB the picture before /
// after (viewer) or the folder before / after, X the search, Y the folders (a narrow screen's drawer). The keys:
// arrows, Enter, Esc, ← / → in the viewer, [ / ] the folders, / the search, F the folders. Touch: swipe the picture.
import { Controller, menuNavigate } from '../controller.js';
import { installNativePad, watchLabels, padFaces } from '../native-pad.js';
import { installGlyphs } from '../pad-glyphs.js';
import { InputMode } from '../input-mode.js';
import { DEBUG_MENU_HREF } from '../debug-back.js';
import { KINDS, LOOSE, ancestors, buildTree, filterEntries, flatIds, formatHash, parseHash, worldsOf } from './model.js';
import { esc, fullSrc, gridHtml, infoHtml, treeHtml } from './view.js';

export const INDEX_URL = '/__references/index.json';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
installNativePad(); watchLabels(); installGlyphs();
const inputMode = new InputMode({ touchDevice: isTouch });
inputMode.apply(document.body.classList);
for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, (e) => { inputMode.event(e); inputMode.apply(document.body.classList); }, { capture: true, passive: true });
document.body.dataset.gridNav = '';   // (menuNavigate: what is on screen, by where it is drawn)

const $ = (s) => document.querySelector(s);
const narrow = () => matchMedia('(max-width: 900px)').matches;
const padOn = () => document.body.classList.contains('controller');

let data;
try {
  const res = await fetch(INDEX_URL, { cache: 'no-store' });
  if (!res.ok || !/json/.test(res.headers.get('content-type') ?? '')) throw new Error(`HTTP ${res.status}`);
  data = await res.json();
} catch (e) {
  $('#grid').innerHTML = `<p class="empty">The references' index couldn't be read (${esc(e.message)}). This page needs the dev server (<code>npx vite</code>): references/ is not part of the site or the app.</p>`;
  throw e;
}
const entries = data.entries;
const tree = buildTree(entries);
const state = { ...parseHash(location.hash), open: new Set(['levels']) };
for (const a of ancestors(state.sel)) state.open.add(a);
if (state.sel) state.open.add(state.sel);

// the filters' choices
$('#world').insertAdjacentHTML('beforeend', worldsOf(entries).map((w) => `<option value="${esc(w)}">${esc(w)}</option>`).join(''));
$('#kind').insertAdjacentHTML('beforeend', KINDS.filter((k) => entries.some((e) => e.kind === k.id)).map((k) => `<option value="${k.id}">${esc(k.label)}</option>`).join(''));
$('#title').innerHTML = `THE REFERENCES <span>${entries.length}</span>`;

// ------------------------------------------------------------------ drawing
let shown = [];
function syncControls() {
  $('#q').value = state.q; $('#world').value = state.world; $('#kind').value = state.kind;
  $('#lab').setAttribute('aria-pressed', String(!!state.lab)); $('#prompt').setAttribute('aria-pressed', String(!!state.prompt));
}
function drawTree() {
  $('#tree').innerHTML = treeHtml(tree, { sel: state.sel, open: state.open, all: entries.filter((e) => e.kind !== 'archive').length });
}
function drawGrid() {
  shown = filterEntries(entries, state);
  $('#grid').innerHTML = gridHtml(shown, state.sel);
  $('#shown').textContent = `${shown.length} shown`;
  for (const img of $('#grid').querySelectorAll('img')) img.addEventListener('error', () => { img.closest('.im').textContent = '?'; }, { once: true });
}
function saveHash() {
  const h = formatHash(state);
  if (h !== location.hash && !(h === '#' && !location.hash)) history.replaceState(null, '', h === '#' ? location.pathname + location.search : h);
}
function draw() {
  syncControls(); drawTree(); drawGrid(); saveHash();
  if (state.pic) openPic(state.pic, { keepHash: true }); else closePic({ keepHash: true });
}
addEventListener('hashchange', () => { Object.assign(state, parseHash(location.hash)); for (const a of ancestors(state.sel)) state.open.add(a); draw(); });

// ------------------------------------------------------------------ choosing
function select(id, { toggle = true } = {}) {
  const node = findNode(id);
  if (toggle && node?.children?.length && (state.sel === id || !state.open.has(id))) { if (state.open.has(id) && state.sel === id) state.open.delete(id); else state.open.add(id); }
  state.sel = id; state.pic = null;
  drawTree(); drawGrid(); saveHash();
  scrollTo({ top: 0 });
  $(`.node[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
function findNode(id, nodes = tree) {
  for (const n of nodes) { if (n.id === id) return n; const c = findNode(id, n.children ?? []); if (c) return c; }
  return null;
}
function stepFolder(d) {
  const ids = ['', ...flatIds(tree, state.open)];
  const i = ids.indexOf(state.sel);
  select(ids[(i + d + ids.length) % ids.length], { toggle: false });
  if (narrow() && !document.body.classList.contains('drawer')) $('#grid .thumb')?.focus({ preventScroll: true });
}
function setFilter(patch) {
  Object.assign(state, patch, { pic: null });
  syncControls(); drawGrid(); saveHash();
}
const drawer = (on) => {
  document.body.classList.toggle('drawer', on);
  if (on) ($('#tree .node[aria-current="true"]') ?? $('#tree .node'))?.focus({ preventScroll: false });
};

// ------------------------------------------------------------------ a picture, full screen
const viewer = $('#viewer');
const viewerOpen = () => viewer.classList.contains('open');
let at = -1, from = null;
function openPic(path, { keepHash = false } = {}) {
  let i = shown.findIndex((e) => e.path === path || e.rel === path);
  if (i < 0) {   // (a deep link to a picture the filters hide: show its folder unfiltered)
    const e = entries.find((x) => x.path === path || x.rel === path);
    if (!e) return;
    Object.assign(state, { q: '', world: '', kind: '', lab: false, prompt: false, sel: e.folder === '.' ? LOOSE : e.folder });
    syncControls(); drawTree(); drawGrid();
    i = shown.findIndex((x) => x === e);
  }
  if (!viewerOpen()) from = document.activeElement;
  at = i; show();
  viewer.classList.add('open'); viewer.setAttribute('aria-hidden', 'false'); document.body.classList.add('viewing');
  viewer.querySelector('[data-close]').focus({ preventScroll: true });
  if (!keepHash) saveHash();
}
function show() {
  const e = shown[at];
  if (!e) return;
  state.pic = e.rel;
  const img = viewer.querySelector('.stage img');
  img.onload = () => { $('#viewer .info').innerHTML = infoHtml(e, { width: img.naturalWidth, height: img.naturalHeight }); };
  img.src = fullSrc(e.path); img.alt = e.name;
  $('#original').href = fullSrc(e.path);
  viewer.querySelector('.cap').textContent = `${e.rel} (${at + 1} of ${shown.length})`;
  $('#viewer .info').innerHTML = infoHtml(e);
  $('#viewer .info').scrollTop = 0;
  saveHash();
  // the next one, ready
  const next = shown[at + 1]; if (next) { const pre = new Image(); pre.src = fullSrc(next.path); }
}
function stepPic(d) { if (shown.length) { at = (at + d + shown.length) % shown.length; show(); } }
function closePic({ keepHash = false } = {}) {
  if (!viewerOpen()) return;
  viewer.classList.remove('open'); viewer.setAttribute('aria-hidden', 'true'); document.body.classList.remove('viewing');
  const left = shown[at];
  state.pic = null;
  if (!keepHash) saveHash();
  const back = left && $(`#grid .thumb[data-path="${CSS.escape(left.path)}"]`);
  (back ?? from)?.focus?.({ preventScroll: false });
}
viewer.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) stepPic(+b.dataset.go);
  else if (e.target.closest('[data-close]') || e.target === viewer || e.target.classList.contains('stage')) closePic();
});
// a swipe on the picture
let swipe = null;
const stage = viewer.querySelector('.stage');
stage.addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY, t: performance.now() }; });
stage.addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - swipe.t < 800) stepPic(dx < 0 ? 1 : -1);
  swipe = null;
});

// ------------------------------------------------------------------ mouse, touch, keys
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('#viewer')) return;
  const node = t.closest('.node');
  if (node) { select(node.dataset.id); if (narrow() && !findNode(node.dataset.id)?.children?.length) drawer(false); return; }
  const th = t.closest('.thumb');
  if (th) return openPic(th.dataset.path);
  if (t.closest('#lab')) return setFilter({ lab: !state.lab });
  if (t.closest('#prompt')) return setFilter({ prompt: !state.prompt });
  if (t.closest('#clear')) return setFilter({ q: '', world: '', kind: '', lab: false, prompt: false });
  if (t.closest('#folders')) return drawer(!document.body.classList.contains('drawer'));
  if (document.body.classList.contains('drawer') && !t.closest('#tree')) drawer(false);
});
$('#q').addEventListener('input', () => setFilter({ q: $('#q').value }));
$('#world').addEventListener('change', () => setFilter({ world: $('#world').value }));
$('#kind').addEventListener('change', () => setFilter({ kind: $('#kind').value }));

function confirm() {
  const el = document.activeElement;
  if (viewerOpen()) { if (el?.matches('[data-go], [data-close], a')) el.click(); return; }
  if (!el || el === document.body) return menuNavigate(document.body, 0, 1);
  if (el.matches('select')) { const o = el.options; el.selectedIndex = (el.selectedIndex + 1) % o.length; el.dispatchEvent(new Event('change')); return; }
  if (el.matches('input')) return;
  if (el.matches('button, a[href]')) el.click();
}
function back() {
  if (viewerOpen()) return closePic();
  if (document.body.classList.contains('drawer')) { drawer(false); $('#folders').focus({ preventScroll: true }); return; }
  if (document.activeElement === $('#q')) { $('#q').blur(); ($('#grid .thumb') ?? $('#folders'))?.focus({ preventScroll: true }); return; }
  location.href = DEBUG_MENU_HREF;
}
function focusSearch() { if (viewerOpen()) closePic(); $('#q').focus(); $('#q').select(); }
function folders() {
  if (narrow()) return drawer(!document.body.classList.contains('drawer'));
  ($('#tree .node[aria-current="true"]') ?? $('#tree .node'))?.focus({ preventScroll: false });
}
function navigate(x, y, fresh = true) {
  if (viewerOpen()) {
    if (x) { stepPic(x); return; }
    const info = $('#viewer .info');   // (up / down: the information scrolls)
    info.scrollBy({ top: y * 120, behavior: 'smooth' });
    return;
  }
  if (document.body.classList.contains('drawer')) return menuNavigate($('#tree'), x, y, fresh);
  menuNavigate(document.body, x, y, fresh);
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT';
  if (e.key === 'Escape') { e.preventDefault(); back(); return; }
  if (typing) { if (e.key === 'Enter' || e.key === 'ArrowDown') { if (e.target.id === 'q') { e.preventDefault(); $('#grid .thumb')?.focus(); } } return; }
  if (viewerOpen()) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stepPic(e.key === 'ArrowRight' ? 1 : -1); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); navigate(0, e.key === 'ArrowDown' ? 1 : -1); return; }
    if (e.key === 'Backspace') { e.preventDefault(); closePic(); }
    return;
  }
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (dir) { e.preventDefault(); navigate(...dir); return; }
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.matches('.thumb, .node')) { e.preventDefault(); confirm(); return; }
  if (e.key === '/') { e.preventDefault(); focusSearch(); return; }
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); folders(); return; }
  if (e.key === '[' || e.key === ']') { stepFolder(e.key === ']' ? 1 : -1); return; }
  if (e.key === 'Backspace') { e.preventDefault(); back(); }
});

// ------------------------------------------------------------------ a controller
const controller = new Controller({
  context: () => 'menu', look: () => {}, faces: () => padFaces(),
  activity: () => { inputMode.pad(); inputMode.apply(document.body.classList); },
  navigate: (x, y, fresh) => navigate(x, y, fresh),
  scroll: (amount) => { if (viewerOpen()) $('#viewer .info').scrollBy(0, amount); else if (document.body.classList.contains('drawer')) $('#tree').scrollBy(0, amount); else scrollBy(0, amount); },
  action: (name) => {
    if (name === 'back') back();
    else if (name === 'confirm') confirm();
    else if (name === 'tabPrev' || name === 'tabNext') { const d = name === 'tabNext' ? 1 : -1; if (viewerOpen()) stepPic(d); else stepFolder(d); }
    else if (name === 'x') focusSearch();
    else if (name === 'y') folders();
  },
});
let last = performance.now();
const tick = (t) => {
  const pads = Array.from(navigator.getGamepads?.() ?? []).some((p) => p?.connected);
  if ((inputMode.frame(pads) === 'pad') !== padOn()) inputMode.apply(document.body.classList);
  controller.update(Math.min(0.1, (t - last) / 1000), !document.hidden && document.hasFocus());
  last = t; requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

// the header's height, for the sticky folders
const head = () => document.documentElement.style.setProperty('--head', `${$('header').offsetHeight}px`);
addEventListener('resize', head); head();

draw();
if (padOn() && !viewerOpen()) ($('#grid .thumb') ?? $('#tree .node'))?.focus({ preventScroll: true });
window.referencesPage = { data, state, select, openPic, setFilter };   // (for the screenshots and the console)
