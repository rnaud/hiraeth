// The reference lab (reference-lab.html, Debug → Reference lab on the dev server only; docs/systems/reference-lab.md):
// one prompt and some style references sent to several image providers, the results side by side with the
// reference, then Pick (copied to its folder with a manifest entry) or Discard. The work is the dev server's
// (scripts/reference-lab/server.mjs): the page never sees a key.
//
// Mouse and keys: everything is a button; G generates, P picks and Del discards the focused candidate, Enter
// zooms it, ← → in the zoom, Esc closes it (then back to the Debug menu). A controller: the D-pad and the stick
// move across what is on screen (data-grid-nav), A presses or zooms, X picks, Y discards, LB / RB step the
// zoom, Menu generates, B closes the zoom, then back to the Debug menu.
import { Controller, menuNavigate } from '../controller.js';
import { installNativePad, watchLabels, padFaces } from '../native-pad.js';
import { installGlyphs } from '../pad-glyphs.js';
import { InputMode } from '../input-mode.js';
import { DEBUG_MENU_HREF } from '../debug-back.js';
import { ASPECTS, batchHtml, defaultChecked, esc, fileSrc, filterRefs, historyHtml, promptFor, promptOptions, providerRow, refFolders, refThumb } from './view.js';

const API = '/__reference-lab/';
const $ = (s) => document.querySelector(s);
const PAGE = 120;   // thumbnails drawn at once (more on "show more")

installNativePad(); watchLabels(); installGlyphs();
const inputMode = new InputMode({ touchDevice: false });
inputMode.apply(document.body.classList);
for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, (e) => { inputMode.event(e); inputMode.apply(document.body.classList); }, { capture: true, passive: true });
document.body.dataset.gridNav = '';

const state = { prompts: { docs: [], manifests: [] }, refs: [], providers: [], picked: [], shown: PAGE, batch: null, batches: [], poll: 0 };

async function api(path, body) {
  const res = await fetch(API + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}
const say = (text, bad = false) => { const s = $('#status'); s.textContent = text; s.classList.toggle('bad', bad); };

// ------------------------------------------------------------------ the form
function drawRefs() {
  const list = filterRefs(state.refs, { folder: $('#ref-folder').value, query: $('#ref-search').value });
  $('#refs').innerHTML = list.slice(0, state.shown).map((r) => refThumb(r, state.picked.includes(r.path))).join('')
    + (list.length > state.shown ? `<button type="button" class="btn more" data-more>show more (${list.length - state.shown})</button>` : '')
    + (list.length ? '' : '<p class="empty">No picture matches.</p>');
  $('#ref-count').textContent = `${list.length} of ${state.refs.length}`;
}
function drawPicked() {
  $('#picked').innerHTML = state.picked.length ? state.picked.map((p) => `<span class="chip"><img src="${esc(fileSrc(p))}" alt="">${esc(p.split('/').pop())}<button type="button" class="x" data-unpick="${esc(p)}" title="Remove">✕</button></span>`).join('') : '<small class="empty">No style reference: text alone.</small>';
  const cmp = $('#comparison'), was = cmp.value;
  cmp.innerHTML = `<option value="">(none)</option>${state.picked.map((p) => `<option value="${esc(p)}">${esc(p.split('/').pop())}</option>`).join('')}`;
  cmp.value = state.picked.includes(was) ? was : state.picked[0] ?? '';
  const max = Math.min(...state.providers.filter((p) => p.available && document.querySelector(`[data-use="${p.id}"]`)?.checked).map((p) => p.maxRefs));
  $('#refs-note').textContent = Number.isFinite(max) && state.picked.length > max ? `some providers take only ${max}: the first ${max} go to them` : '';
}
function toggleRef(path) {
  const i = state.picked.indexOf(path);
  if (i >= 0) state.picked.splice(i, 1); else state.picked.push(path);
  document.querySelectorAll(`.ref[data-ref="${CSS.escape(path)}"]`).forEach((b) => { b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', String(i < 0)); });
  drawPicked();
}
function drawProviders() {
  const any = state.providers.some((p) => p.available);
  $('#providers').innerHTML = state.providers.map((p) => providerRow(p, { checked: defaultChecked(p) })).join('')
    + (any ? '' : '<p class="need">No provider has a key yet: add OPENAI_API_KEY, GEMINI_API_KEY, FAL_KEY or BFL_API_KEY to .env.local at the repository root, then reload.</p>');
}

$('#source').addEventListener('change', () => {
  const p = promptFor(state.prompts, $('#source').value);
  if (!p) return;
  $('#prompt').value = p.prompt;
  if (p.ar && ASPECTS.includes(p.ar)) $('#ar').value = p.ar;
  if (p.target) $('#target').value = p.target;
  say(p.needsImage ? 'This prompt expects the chosen sheet as an image reference: pick it in the references.' : `Prompt from ${p.from}`);
});
$('#ref-search').addEventListener('input', () => { state.shown = PAGE; drawRefs(); });
$('#ref-folder').addEventListener('change', () => { state.shown = PAGE; drawRefs(); });
$('#providers').addEventListener('change', drawPicked);

// ------------------------------------------------------------------ batches
async function generate() {
  const prompt = $('#prompt').value.trim();
  if (!prompt) { say('Write a prompt first (or choose one).', true); $('#prompt').focus(); return; }
  const providers = [...document.querySelectorAll('[data-use]:checked')].map((c) => c.dataset.use);
  if (!providers.length) { say('Choose at least one provider with a key.', true); return; }
  const models = Object.fromEntries([...document.querySelectorAll('[data-model-for]')].map((s) => [s.dataset.modelFor, s.value]));
  const sel = promptFor(state.prompts, $('#source').value);
  const body = { prompt, refs: state.picked, providers, models, n: +$('#n').value, ar: $('#ar').value, target: $('#target').value.trim() || null, comparison: $('#comparison').value || null, from: sel && sel.prompt === prompt ? sel.from : null };
  $('#go').disabled = true;
  try {
    const { batch } = await api('generate', body);
    say(`Batch ${batch}: generating with ${providers.join(', ')}…`);
    await openBatch(batch);
  } catch (e) { say(e.message, true); } finally { $('#go').disabled = false; }
}
async function openBatch(id) {
  clearTimeout(state.poll);
  try { state.batch = await api(`batches/${encodeURIComponent(id)}`); } catch (e) { say(e.message, true); return; }
  history.replaceState(null, '', `#batch=${encodeURIComponent(id)}`);
  drawBatch();
  if (state.batch.status === 'running') state.poll = setTimeout(() => openBatch(id), 1500);
  else { say(`Batch ${id}: done.`); refreshHistory(); }
}
function drawBatch() {
  const focused = document.activeElement?.closest?.('[data-cand]')?.dataset.cand;
  $('#batch').innerHTML = batchHtml(state.batch);
  if (focused) document.querySelector(`[data-cand="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
  drawHistory();
}
async function refreshHistory() { try { state.batches = (await api('batches')).batches; drawHistory(); } catch { /* the server restarted */ } }
const drawHistory = () => { $('#history').innerHTML = historyHtml(state.batches, state.batch?.batch); };

async function pickCand(id) {
  if (!state.batch) return;
  const target = state.batch.target || $('#target').value.trim();
  if (!target) { say('Give a target folder (references/…/) first.', true); $('#target').focus(); return; }
  const why = prompt(`Pick ${id} into ${target}: why this one? (optional, kept in manifest.json)`, '');
  if (why === null) return;
  try {
    const r = await api('pick', { batch: state.batch.batch, candidate: id, target, why });
    say(`Picked: ${r.file} (recorded in ${r.manifest})`);
    await openBatch(state.batch.batch);
  } catch (e) { say(e.message, true); }
}
async function discardCand(id) {
  if (!state.batch) return;
  try { await api('discard', { batch: state.batch.batch, candidate: id }); await openBatch(state.batch.batch); say(`Discarded ${id}.`); } catch (e) { say(e.message, true); }
}
async function discardBatch(id) {
  if (!confirm(`Delete batch ${id} and all its pictures?`)) return;
  try { await api('discard', { batch: id }); state.batch = null; drawBatch(); await refreshHistory(); say(`Removed ${id}.`); } catch (e) { say(e.message, true); }
}

// ------------------------------------------------------------------ the zoom
const zoom = $('#zoom');
let zoomList = [], zoomAt = 0;
const zoomOpen = () => zoom.classList.contains('open');
function openZoom(el) {
  const seen = new Set();   // (the comparison is in every row: once in the zoom)
  zoomList = [...document.querySelectorAll('#batch figure img')].filter((i) => !seen.has(i.src) && seen.add(i.src))
    .map((i) => ({ src: i.src, cap: i.closest('figure').querySelector('figcaption')?.textContent.trim() ?? '', cand: i.closest('[data-cand]')?.dataset.cand ?? null }));
  zoomAt = Math.max(0, zoomList.findIndex((z) => z.src === el.querySelector('img')?.src));
  if (!zoomList.length) return;
  showZoom(); zoom.classList.add('open'); zoom.setAttribute('aria-hidden', 'false');
  state.zoomFrom = el; zoom.querySelector('[data-close]').focus({ preventScroll: true });
}
function showZoom() {
  const z = zoomList[zoomAt];
  zoom.querySelector('img').src = z.src;
  zoom.querySelector('.cap').textContent = `${z.cap} (${zoomAt + 1} of ${zoomList.length})`;
  zoom.querySelector('[data-zpick]').hidden = !z.cand;
}
const stepZoom = (d) => { if (zoomList.length) { zoomAt = (zoomAt + d + zoomList.length) % zoomList.length; showZoom(); } };
function closeZoom() { zoom.classList.remove('open'); zoom.setAttribute('aria-hidden', 'true'); state.zoomFrom?.focus?.({ preventScroll: true }); }
zoom.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) return stepZoom(+go.dataset.go);
  if (e.target.closest('[data-zpick]')) { const c = zoomList[zoomAt]?.cand; closeZoom(); if (c) pickCand(c); return; }
  if (e.target.closest('[data-close]') || e.target === zoom) closeZoom();
});

// ------------------------------------------------------------------ mouse, keys, a controller
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('#zoom')) return;
  const ref = t.closest('[data-ref]'); if (ref) return toggleRef(ref.dataset.ref);
  const un = t.closest('[data-unpick]'); if (un) return toggleRef(un.dataset.unpick);
  if (t.closest('[data-more]')) { state.shown += PAGE; drawRefs(); return; }
  const pk = t.closest('[data-pick]'); if (pk) return pickCand(pk.dataset.pick);
  const dc = t.closest('[data-discard]'); if (dc) return discardCand(dc.dataset.discard);
  const db = t.closest('[data-discard-batch]'); if (db) return discardBatch(db.dataset.discardBatch);
  const h = t.closest('[data-batch]'); if (h) return openBatch(h.dataset.batch);
  if (t.closest('#go')) return generate();
  const fig = t.closest('#batch figure'); if (fig && t.tagName === 'IMG') return openZoom(fig);
});
const focusedCand = () => (zoomOpen() ? zoomList[zoomAt]?.cand : document.activeElement?.closest?.('[data-cand]')?.dataset.cand);
const typing = (el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '') && !/^(checkbox|button)$/.test(el.type);
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (zoomOpen()) {
    if (e.key === 'Escape') { e.preventDefault(); closeZoom(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stepZoom(e.key === 'ArrowRight' ? 1 : -1); }
    else if (e.key === 'p' || e.key === 'P') { const c = focusedCand(); if (c) { closeZoom(); pickCand(c); } }
    return;
  }
  if (typing(e.target)) return;
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (dir) { e.preventDefault(); menuNavigate(document.body, ...dir); return; }
  if (e.key === 'g' || e.key === 'G') { e.preventDefault(); generate(); return; }
  const c = focusedCand();
  if (c && (e.key === 'p' || e.key === 'P')) pickCand(c);
  else if (c && (e.key === 'Delete' || e.key === 'Backspace')) discardCand(c);
  else if (e.key === 'Enter' && document.activeElement?.matches('#batch figure')) openZoom(document.activeElement);
});
function confirmPad() {
  const el = document.activeElement;
  if (zoomOpen()) { if (el?.matches('[data-go], [data-zpick], [data-close]')) el.click(); else closeZoom(); return; }
  if (!el || el === document.body) return menuNavigate(document.body, 0, 1);
  if (el.matches('#batch figure')) return openZoom(el);
  if (el.matches('input[type="checkbox"]')) { el.click(); el.dispatchEvent(new Event('change', { bubbles: true })); return; }
  if (el.matches('button, a[href], summary')) el.click();
  else el.focus();
}
function back() {
  if (zoomOpen()) return closeZoom();
  if (typing(document.activeElement)) { document.activeElement.blur(); return; }
  location.href = DEBUG_MENU_HREF;
}
const controller = new Controller({
  context: () => 'menu', look: () => {}, faces: () => padFaces(),
  activity: () => { inputMode.pad(); inputMode.apply(document.body.classList); },
  navigate: (x, y, fresh) => { if (zoomOpen()) { if (x && fresh) stepZoom(x); return; } menuNavigate(document.body, x, y, fresh); },
  scroll: (amount) => { if (!zoomOpen()) document.activeElement?.closest?.('.scroll')?.scrollBy(0, amount) ?? scrollBy(0, amount); },
  action: (name) => {
    if (name === 'back') back();
    else if (name === 'confirm') confirmPad();
    else if (name === 'start') generate();
    else if (name === 'tabPrev' || name === 'tabNext') { if (zoomOpen()) stepZoom(name === 'tabNext' ? 1 : -1); }
    else if (name === 'x') { const c = focusedCand(); if (c) { if (zoomOpen()) closeZoom(); pickCand(c); } }
    else if (name === 'y') { const c = focusedCand(); if (c && !zoomOpen()) discardCand(c); }
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

// ------------------------------------------------------------------ start
$('#ar').innerHTML = ASPECTS.map((a) => `<option${a === '16:9' ? ' selected' : ''}>${a}</option>`).join('');
try {
  const [providers, prompts, refs, batches] = await Promise.all([api('providers'), api('prompts'), api('refs'), api('batches')]);
  state.providers = providers.providers; state.prompts = prompts; state.refs = refs.refs; state.batches = batches.batches;
  $('#source').innerHTML = promptOptions(prompts);
  $('#ref-folder').innerHTML = `<option value="">every folder</option>${refFolders(state.refs).map((f) => `<option>${esc(f)}</option>`).join('')}`;
  drawProviders(); drawRefs(); drawPicked(); drawHistory();
  $('#batch').innerHTML = batchHtml(null);
  const n = state.providers.filter((p) => p.available).length;
  say(`${n} of ${state.providers.length} providers have a key · ${state.refs.length} reference pictures · ${state.batches.length} batches`);
  // (everything is on disk: a reload opens the batch it showed, else the newest)
  const was = new URLSearchParams(location.hash.slice(1)).get('batch');
  const open = state.batches.find((b) => b.batch === was) ?? state.batches[0];
  if (open) await openBatch(open.batch);
} catch (e) {
  say(`The reference lab needs the dev server (npx vite): ${e.message}`, true);
}
