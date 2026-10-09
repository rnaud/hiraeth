// The interactive changelog (changelog.html, docs/systems/changelog.md): every version's lines with their
// before / after pictures (a split you drag, or before, after, side by side), their numbers and how to see
// what has no picture; filters, a search, the mouse, touch, the keyboard and a controller. In the game the
// changelog panel (N) opens it over the world in a frame (?embed=1): the game hands its controller over
// (window.changelogPad), and closing asks the game to take the frame away.
import { CHANGELOG, VERSION } from '../changelog.js';
import { changelogEntries } from '../changelog-media.js';
import { Controller } from '../controller.js';
import { padFaces, watchLabels } from '../native-pad.js';
import { filterChips, filtered, lineHtml, MEDIA_SITE, pageOfId, pagerHtml, paginate, shotHtml, versionHtml } from './view.js';

const $ = (s, el = document) => el.querySelector(s);
const params = new URLSearchParams(location.search);
const embed = params.has('embed');
document.body.classList.toggle('embed', embed);
$('#version').textContent = `v${VERSION}`;

const entries = changelogEntries(CHANGELOG);
watchLabels();   // (the lines' buttons, "B / ○ or Esc", as one half: the pad last used here, else Xbox's; src/native-pad.js)


// ------------------------------------------------------------------ filters, search and pages
// Only the page shown is in the document (a hundred versions of pictures and tables at once is too much
// for a handheld): the lines that pass the filters, in pages of whole versions (view.js paginate).
const state = { kind: params.get('kind') ?? 'all', worlds: (params.get('world') ?? '').split(',').filter(Boolean), words: params.get('q') ?? '', page: Math.max(1, parseInt(params.get('page'), 10) || 1) };
const chips = filterChips(entries);
$('#kinds').innerHTML = chips.kinds.map(([id, label]) => `<button type="button" class="chip" data-kind="${id}">${label}</button>`).join('');
$('#worlds').innerHTML = chips.worlds.map(([id, label]) => `<button type="button" class="chip world" data-world="${id}">${label}</button>`).join('');
$('#search').value = state.words;

let pages = [];
function apply({ keepPage = false } = {}) {
  const shown = filtered(entries, state);
  pages = paginate(shown);
  if (!keepPage) state.page = 1;
  state.page = Math.max(1, Math.min(pages.length || 1, state.page));
  const lines = shown.flatMap((e) => e.lines), pics = lines.filter((l) => l.shots.length).length;
  const here = pages[state.page - 1] ?? [];
  $('#list').innerHTML = pagerHtml(state.page, pages, 'top') + here.map(versionHtml).join('')
    + (lines.length ? '' : '<p class="empty">Nothing matches.</p>') + pagerHtml(state.page, pages, 'bottom');
  for (const b of document.querySelectorAll('[data-kind]')) b.setAttribute('aria-pressed', String(b.dataset.kind === state.kind));
  for (const b of document.querySelectorAll('[data-world]')) b.setAttribute('aria-pressed', String(state.worlds.includes(b.dataset.world)));
  $('#count').textContent = `${lines.length} changes shown${pics ? `, ${pics} with pictures` : ''}${pages.length > 1 ? ` · page ${state.page} of ${pages.length}` : ''}`;
  const q = new URLSearchParams(location.search);
  for (const [k, v] of [['kind', state.kind === 'all' ? '' : state.kind], ['world', state.worlds.join(',')], ['q', state.words], ['page', state.page > 1 ? state.page : '']]) v ? q.set(k, v) : q.delete(k);
  history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`);
}
/** Show another page: at its top, or with its first (`at` 'first') or last ('last') line in focus. */
function goPage(n, at = null) {
  if (n < 1 || n > pages.length || n === state.page) return false;
  state.page = n; apply({ keepPage: true });
  if (at) { const list = visible(); focusLine(at === 'last' ? list[list.length - 1] : list[0]); }
  else scrollTo({ top: 0 });
  return true;
}
$('#kinds').addEventListener('click', (e) => { const k = e.target.closest('[data-kind]')?.dataset.kind; if (k) { state.kind = k; apply(); } });
$('#worlds').addEventListener('click', (e) => {
  const w = e.target.closest('[data-world]')?.dataset.world; if (!w) return;
  state.worlds = state.worlds.includes(w) ? state.worlds.filter((x) => x !== w) : [...state.worlds, w]; apply();
});
$('#search').addEventListener('input', (e) => { state.words = e.target.value; apply(); });
$('#list').addEventListener('click', (e) => { const b = e.target.closest('.pager [data-page]'); if (b && !b.disabled) goPage(+b.dataset.page, b.closest('.bottom') ? 'first' : null); });
$('#list').addEventListener('change', (e) => { if (e.target.matches('[data-pages]')) goPage(+e.target.value); });
// (a link to a line or a version opens the page it is on, with the filters let go if they hide it)
const hashId = location.hash.slice(1);
if (hashId && entries.some((e) => `v${e.v}` === hashId || e.lines.some((l) => `v${l.v}-${l.i + 1}` === hashId))) {
  if (!pageOfId(paginate(filtered(entries, state)), hashId)) Object.assign(state, { kind: 'all', worlds: [], words: '' }), $('#search').value = '';
  state.page = pageOfId(paginate(filtered(entries, state)), hashId);
}
apply({ keepPage: true });

// ------------------------------------------------------------------ pictures: the split, the modes, offline
const setSplit = (cmp, pct) => {
  pct = Math.max(0, Math.min(100, pct));
  cmp.style.setProperty('--split', `${pct}%`); cmp.setAttribute('aria-valuenow', String(Math.round(pct)));
};
function setMode(shots, mode) {
  const cmp = $('.compare', shots);
  shots.classList.toggle('sbs', mode === 'sbs');
  if (cmp) cmp.dataset.mode = mode === 'sbs' ? 'split' : mode;
  for (const b of shots.querySelectorAll('.modes [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
}
const modeOf = (shots) => (shots.classList.contains('sbs') ? 'sbs' : $('.compare', shots)?.dataset.mode ?? 'split');
const MODES = ['split', 'before', 'after', 'sbs'];

let drag = null;
document.addEventListener('pointerdown', (e) => {
  const cmp = e.target.closest('.compare:not(.single)'); if (!cmp) return;
  drag = cmp; cmp.setPointerCapture(e.pointerId);
  if (cmp.dataset.mode !== 'split') setMode(cmp.closest('.shots'), 'split');
  move(e);
});
const move = (e) => { if (!drag) return; const r = drag.getBoundingClientRect(); setSplit(drag, ((e.clientX - r.left) / r.width) * 100); };
document.addEventListener('pointermove', move);
document.addEventListener('pointerup', () => { drag = null; });
document.addEventListener('pointercancel', () => { drag = null; });
// (hovering with a mouse moves the split too, without a click)
document.addEventListener('mousemove', (e) => { if (drag || e.buttons) return; const cmp = e.target.closest('.compare:not(.single)'); if (cmp && cmp.dataset.mode === 'split' && matchMedia('(hover: hover)').matches) { const r = cmp.getBoundingClientRect(); setSplit(cmp, ((e.clientX - r.left) / r.width) * 100); } });

document.addEventListener('click', (e) => {
  const m = e.target.closest('.modes [data-mode]');
  if (m) { setMode(m.closest('.shots'), m.dataset.mode); return; }
  const t = e.target.closest('.shot-tabs [data-shot]');
  if (t) showShot(t.closest('.shots'), +t.dataset.shot);
});
function showShot(shots, k) {
  const list = JSON.parse(shots.dataset.shots);
  const mode = modeOf(shots);
  $('.shot', shots).innerHTML = shotHtml(list[k]);
  for (const b of shots.querySelectorAll('.shot-tabs [data-shot]')) b.setAttribute('aria-pressed', String(+b.dataset.shot === k));
  setMode(shots, list[k].before && list[k].after ? mode : 'split');
}

// a picture that doesn't load beside the page is read from the site; failing there too, a note (offline)
document.addEventListener('error', (e) => {
  const img = e.target; if (img.tagName !== 'IMG' || !img.dataset.path) return;
  const site = new URL(img.dataset.path, MEDIA_SITE).href;
  if (img.src !== site && !img.dataset.retried) { img.dataset.retried = '1'; img.src = site; return; }
  img.closest('.compare')?.classList.add('failed');
  if (!navigator.onLine) document.body.classList.add('offline');
}, true);
addEventListener('online', () => document.body.classList.remove('offline'));
if (!navigator.onLine) document.body.classList.add('offline');

// ------------------------------------------------------------------ keyboard and controller
const visible = () => [...document.querySelectorAll('article.line')].filter((a) => !a.hidden && !a.closest('section').hidden);
const controls = () => [...document.querySelectorAll('header button, header input, header a.btn')].filter((b) => b.getClientRects().length);
// (the sticky header's height kept as the scroll padding, so a line scrolled to starts under it)
const pad0 = () => { document.documentElement.style.scrollPaddingTop = `${($('header').getBoundingClientRect().height | 0) + 12}px`; };
pad0(); addEventListener('resize', pad0);
function focusLine(a) {
  if (!a) return;
  a.focus({ preventScroll: true });
  const tall = a.getBoundingClientRect().height > innerHeight - $('header').getBoundingClientRect().height - 24;
  a.scrollIntoView({ block: tall ? 'start' : 'nearest', behavior: 'smooth' });
}
function step(dy) {
  const list = visible(), cur = document.activeElement?.closest?.('article.line');
  if (!cur) { if (dy > 0) focusLine(list[0]); return; }
  const i = list.indexOf(cur);
  // (past the page's last line, the next page's first; above its first, the page before's last)
  if (dy > 0 && i >= list.length - 1 && goPage(state.page + 1, 'first')) return;
  if (dy < 0 && i <= 0 && goPage(state.page - 1, 'last')) return;
  if (dy < 0 && i <= 0) { (controls().find((b) => b.getAttribute('aria-pressed') === 'true') ?? controls()[0])?.focus(); return; }
  focusLine(list[Math.max(0, Math.min(list.length - 1, i + dy))]);
}
function slide(dx) {
  const cur = document.activeElement;
  if (cur?.closest?.('header')) { const c = controls(), i = c.indexOf(cur); c[(i + dx + c.length) % c.length]?.focus(); return; }
  const cmp = cur?.closest?.('article.line') && $('.compare:not(.single)', cur);
  if (!cmp) return;
  if (cmp.dataset.mode !== 'split') setMode(cmp.closest('.shots'), 'split');
  setSplit(cmp, parseFloat(cmp.style.getPropertyValue('--split') || '50') + dx * 10);
}
function confirm() {
  const cur = document.activeElement;
  if (cur?.closest?.('header')) { if (cur.tagName !== 'INPUT') cur.click(); return; }
  const shots = cur?.closest?.('article.line') && $('.shots', cur);
  if (!shots) return;
  const tabs = shots.querySelectorAll('.shot-tabs [data-shot]');
  const mode = modeOf(shots), next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  // the modes in turn; past the last one, the next picture of the line
  if (next === 'split' && tabs.length > 1) {
    const k = [...tabs].findIndex((b) => b.getAttribute('aria-pressed') === 'true');
    showShot(shots, (k + 1) % tabs.length);
  }
  if ($('.compare:not(.single)', shots)) setMode(shots, next);
}
function version(d) {
  const secs = [...document.querySelectorAll('section.version')].filter((s) => !s.hidden);
  const cur = document.activeElement?.closest?.('section.version');
  const i = cur ? secs.indexOf(cur) : -1;
  // (from the page's last version on, the next page; from its first back, the page before)
  if (d > 0 && i >= secs.length - 1 && goPage(state.page + 1, 'first')) return;
  if (d < 0 && i <= 0 && cur && goPage(state.page - 1, 'first')) return;
  const to = secs[Math.max(0, Math.min(secs.length - 1, i + d))];
  if (!to) return;
  focusLine([...to.querySelectorAll('article.line')].find((a) => !a.hidden));
}
function close() {
  if (embed) parent.postMessage({ memento: 'changelog-close' }, location.origin);
  else if (history.length > 1 && document.referrer.startsWith(location.origin)) history.back();
}
$('#close').addEventListener('click', close);

/** What a controller press does here: the game's own Controller (embedded, the game passes them on). */
const pad = (name, ...a) => {
  if (name === 'navigate') { const [x, y] = a; if (y) step(y); else if (x) slide(x); }
  else if (name === 'scroll') scrollBy(0, a[0]);
  else if (name === 'confirm') confirm();
  else if (name === 'back' || name === 'start' || name === 'select') close();
  else if (name === 'tabPrev' || name === 'tabNext') version(name === 'tabPrev' ? -1 : 1);
  return true;
};
window.changelogPad = pad;

addEventListener('keydown', (e) => {
  const typing = e.target.tagName === 'INPUT';
  if (e.key === 'Escape' || (!typing && (e.code === 'KeyN' || e.key === 'Backspace'))) { if (typing && e.key === 'Escape' && e.target.value) return; e.preventDefault(); close(); return; }
  if (typing) { if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); step(1); } return; }
  const k = { ArrowDown: ['navigate', 0, 1], ArrowUp: ['navigate', 0, -1], ArrowLeft: ['navigate', -1, 0], ArrowRight: ['navigate', 1, 0], PageDown: ['tabNext'], PageUp: ['tabPrev'] }[e.key];
  if (k) { e.preventDefault(); pad(...k); return; }
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.matches?.('article.line')) { e.preventDefault(); confirm(); }
  if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
});

// a controller of its own when the page is opened by itself (the site, the Deck's browser)
if (!embed) {
  const controller = new Controller({ context: () => 'menu', faces: () => padFaces(), action: (n) => pad(n), navigate: (x, y) => pad('navigate', x, y), scroll: (s) => pad('scroll', s), look: () => {} });
  let last = performance.now();
  const tick = (t) => { controller.update(Math.min(0.1, (t - last) / 1000), document.hasFocus()); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
const hint = () => { $('#hint').textContent = matchMedia('(pointer: coarse)').matches ? 'drag a picture to compare' : 'drag or hover a picture · ↑↓ changes · ←→ the split · Enter: before / after · LB / RB versions'; };
hint();

// a link to a line or a version (…/changelog.html#v0.79-3)
if (location.hash) requestAnimationFrame(() => { const a = document.getElementById(location.hash.slice(1)); if (a) focusLine(a.matches('article') ? a : $('article.line', a)); });
else if (embed) requestAnimationFrame(() => focusLine(visible()[0]));
export { lineHtml };
