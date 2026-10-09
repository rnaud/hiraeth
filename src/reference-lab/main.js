// The reference lab (reference-lab.html, Debug → Reference lab on the dev server only; docs/systems/reference-lab.md):
// one prompt and some style references sent to several image providers, the results side by side with the
// reference, then Pick (copied to its folder with a manifest entry) or Discard. The work is the dev server's
// (scripts/reference-lab/server.mjs): the page never sees a key.
//
// Mouse and keys: everything is a button; G generates, P picks and Del discards the focused candidate, Enter
// zooms it, ← → in the zoom, Esc closes it (then back to the Debug menu). A controller: the D-pad and the stick
// move across what is on screen (data-grid-nav), A presses or zooms, X picks, Y discards, LB / RB step the
// zoom, Menu generates, B closes the zoom, then back to the Debug menu.
//
// The 3D mode (the "3D models" switch; Tripo): the pictures clicked become the inputs (one: image to model; 2-4
// views: multiview; none: text to model from the prompt), each with its view and an optional crop drawn on it;
// the results are three.js viewers (viewer3d.js, loaded only then), and a pick sends the viewer's turntable too.
import { Controller, menuNavigate } from '../controller.js';
import { installNativePad, watchLabels, padFaces } from '../native-pad.js';
import { installGlyphs } from '../pad-glyphs.js';
import { InputMode } from '../input-mode.js';
import { DEBUG_MENU_HREF } from '../debug-back.js';
import { ASPECTS, PER_PAGE, batchHtml, candidateSrc, defaultChecked, esc, fileSrc, input3dRow, filterBatches, filterHtml, filterRefs, pageCount, pagerHtml, promptFor, promptOptions, providerRow, refFolders, refThumb } from './view.js';

const API = '/__reference-lab/';
const $ = (s) => document.querySelector(s);
const PAGE = 120;   // thumbnails drawn at once (more on "show more")

installNativePad(); watchLabels(); installGlyphs();
const inputMode = new InputMode({ touchDevice: false });
inputMode.apply(document.body.classList);
for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, (e) => { inputMode.event(e); inputMode.apply(document.body.classList); }, { capture: true, passive: true });
document.body.dataset.gridNav = '';

const state = { prompts: { docs: [], manifests: [] }, refs: [], providers: [], picked: [], shown: PAGE, page: 1, show: 'open', open: [], batches: [], poll: 0, mode: '2d', inputs: [], tripo: null };
const chosen = () => (state.mode === '3d' ? state.inputs.map((i) => i.path) : state.picked);
let viewer3d = null;   // (viewer3d.js, imported the first time a 3D batch shows)
const viewers = () => (viewer3d ??= import('./viewer3d.js'));

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
  $('#refs').innerHTML = list.slice(0, state.shown).map((r) => refThumb(r, chosen().includes(r.path))).join('')
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
  if (state.mode === '3d') return toggleInput(path);
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

// ------------------------------------------------------------------ the 3D form
function setMode(mode) {
  state.mode = mode === '3d' ? '3d' : '2d';
  document.body.classList.toggle('mode-3d', state.mode === '3d');
  document.querySelectorAll('[data-mode]').forEach((b) => { b.classList.toggle('on', b.dataset.mode === state.mode); b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)); });
  try { localStorage.setItem('refLabMode', state.mode); } catch { /* private mode */ }
  drawRefs();
  if (state.mode === '3d') drawInputs();
}
function toggleInput(path) {
  // (a cropped one stays: click the sheet again for its next view; an uncropped one is taken back)
  const i = state.inputs.findIndex((x) => x.path === path && !x.crop);
  if (i >= 0) state.inputs.splice(i, 1);
  else if (state.inputs.length >= 4) { say('Four views at most (front, left, back, right).', true); return; }
  else {
    const used = new Set(state.inputs.map((x) => x.view));
    state.inputs.push({ path, view: ['front', 'left', 'back', 'right'].find((v) => !used.has(v)), crop: null });
  }
  drawRefs(); drawInputs();
}
function drawInputs() {
  const several = state.inputs.length > 1;
  $('#inputs3d').innerHTML = state.inputs.length ? state.inputs.map((inp, i) => input3dRow(inp, i, state.tripo?.views, several)).join('')
    : '<small class="empty">No picture: text to model from the prompt.</small>';
  const kind = !state.inputs.length ? 'text to model' : several ? `multiview to model (${state.inputs.length} views)` : 'image to model';
  const tex = $('#m3-texture').checked, rig = $('#m3-rig').checked;
  // (the pricing page, as estimateCredits in scripts/reference-lab/providers/tripo.mjs; the tasks' own credits are what is recorded)
  const credits = (state.inputs.length ? (tex ? 30 : 20) : (tex ? 20 : 10)) + (tex && $('#m3-hd').checked ? 10 : 0) + ($('#m3-quad').checked ? 5 : 0) + (rig ? 35 : 0);
  $('#m3-cost').textContent = `${kind} · about $${(credits * 0.01 * +$('#m3-n').value).toFixed(2)} (${credits} credits a model${rig ? ', of which rig 25 + walk 10' : ''})`;
}
for (const id of ['#m3-texture', '#m3-pbr', '#m3-hd', '#m3-quad', '#m3-rig', '#m3-n']) $(id).addEventListener('change', () => {
  if (id === '#m3-pbr' && $('#m3-pbr').checked) $('#m3-texture').checked = true;   // (PBR forces a texture)
  if (id === '#m3-texture' && !$('#m3-texture').checked) $('#m3-pbr').checked = false;
  drawInputs();
});
$('#inputs3d').addEventListener('change', (e) => {
  const v = e.target.closest('[data-inp-view]');
  if (v) state.inputs[+v.dataset.inpView].view = v.value;
});
async function showTripo() {
  const t = state.tripo;
  if (!t) return;
  $('#m3-model').innerHTML = t.models.map((m) => `<option${m === t.model ? ' selected' : ''}>${esc(m)}</option>`).join('');
  if (!t.available) { $('#tripo-state').textContent = `add ${t.keyName} to .env.local`; $('#tripo-state').classList.add('need'); return; }
  try {
    const b = await api('tripo/balance');
    $('#tripo-state').textContent = b.balance != null ? `${b.balance} credits ($${(b.balance * 0.01).toFixed(2)})${b.frozen ? `, ${b.frozen} held` : ''}` : 'key found';
  } catch (e) { $('#tripo-state').textContent = e.message; $('#tripo-state').classList.add('need'); }
}

// the crop: a rectangle dragged on the picture (natural pixels), or one of four views side by side
const crop = $('#crop');
let cropAt = -1, cropRect = null, cropDrag = null;
const cropImg = crop.querySelector('img'), cropBox = crop.querySelector('.rect');
function openCrop(i) {
  cropAt = i; cropRect = state.inputs[i].crop ? { ...state.inputs[i].crop } : null;
  cropImg.onload = drawCrop;
  cropImg.src = fileSrc(state.inputs[i].path);
  if (cropImg.complete) drawCrop();
  crop.classList.add('open'); crop.setAttribute('aria-hidden', 'false');
  crop.querySelector('[data-crop-use]').focus({ preventScroll: true });
}
function closeCrop() { crop.classList.remove('open'); crop.setAttribute('aria-hidden', 'true'); }
const cropScale = () => cropImg.clientWidth / (cropImg.naturalWidth || 1);
function drawCrop() {
  const k = cropScale();
  cropBox.hidden = !cropRect;
  if (cropRect) Object.assign(cropBox.style, { left: `${cropRect.x * k}px`, top: `${cropRect.y * k}px`, width: `${cropRect.w * k}px`, height: `${cropRect.h * k}px` });
  crop.querySelector('.cap').textContent = cropRect ? `crop ${cropRect.x},${cropRect.y} ${cropRect.w}×${cropRect.h} of ${cropImg.naturalWidth}×${cropImg.naturalHeight}` : `the whole picture (${cropImg.naturalWidth}×${cropImg.naturalHeight}): drag a rectangle around one view`;
}
const cropPoint = (e) => {
  const r = cropImg.getBoundingClientRect(), k = cropScale();
  return { x: Math.round(Math.min(Math.max(0, e.clientX - r.left), r.width) / k), y: Math.round(Math.min(Math.max(0, e.clientY - r.top), r.height) / k) };
};
const stage = crop.querySelector('.stage');
stage.addEventListener('pointerdown', (e) => { cropDrag = cropPoint(e); stage.setPointerCapture(e.pointerId); e.preventDefault(); });
stage.addEventListener('pointermove', (e) => {
  if (!cropDrag) return;
  const p = cropPoint(e);
  cropRect = { x: Math.min(p.x, cropDrag.x), y: Math.min(p.y, cropDrag.y), w: Math.abs(p.x - cropDrag.x), h: Math.abs(p.y - cropDrag.y) };
  drawCrop();
});
stage.addEventListener('pointerup', () => { cropDrag = null; if (cropRect && (cropRect.w < 8 || cropRect.h < 8)) cropRect = null; drawCrop(); });
crop.addEventListener('click', (e) => {
  const q = e.target.closest('[data-crop-q]');
  if (q) {   // (our sheets: four views side by side across the top ~62%)
    const W = cropImg.naturalWidth, H = cropImg.naturalHeight, k = +q.dataset.cropQ;
    cropRect = { x: Math.round((k * W) / 4), y: 0, w: Math.round(W / 4), h: Math.round(H * 0.62) };
    return drawCrop();
  }
  if (e.target.closest('[data-crop-whole]')) { cropRect = null; return drawCrop(); }
  if (e.target.closest('[data-crop-use]')) { state.inputs[cropAt].crop = cropRect; closeCrop(); drawInputs(); return; }
  if (e.target.closest('[data-crop-close]')) closeCrop();
});

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
async function generate3d() {
  const prompt = $('#prompt').value.trim();
  if (!state.inputs.length && !prompt) { say('Click a picture (or several views), or write a prompt for text to model.', true); return; }
  if (state.inputs.length > 1 && !state.inputs.some((i) => i.view === 'front')) { say('Mark one of the views front.', true); return; }
  const faces = parseInt($('#m3-faces').value, 10);
  const sel = promptFor(state.prompts, $('#source').value);
  const body = {
    images: state.inputs.map((i) => i.path), crops: state.inputs.map((i) => i.crop), views: state.inputs.map((i) => i.view),
    prompt: state.inputs.length ? null : prompt, from: !state.inputs.length && sel && sel.prompt === prompt ? sel.from : null,
    n: +$('#m3-n').value, target: $('#target').value.trim() || null,
    options: { model: $('#m3-model').value, texture: $('#m3-texture').checked, pbr: $('#m3-pbr').checked, textureQuality: $('#m3-hd').checked ? 'detailed' : 'standard', faceLimit: Number.isFinite(faces) ? faces : null, quad: $('#m3-quad').checked, rig: $('#m3-rig').checked },
  };
  $('#go').disabled = true;
  try {
    const { batch, estimateUSD } = await api('generate3d', body);
    say(`Batch ${batch}: Tripo is modelling (about $${Number(estimateUSD).toFixed(2)}; a minute or two)…`);
    await loadPage(1);
  } catch (e) { say(e.message, true); } finally { $('#go').disabled = false; }
}
async function generate() {
  if (state.mode === '3d') return generate3d();
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
    await loadPage(1);
  } catch (e) { say(e.message, true); } finally { $('#go').disabled = false; }
}
// Every batch on one page, newest first, PER_PAGE at a time, filtered (to pick by default: #show=…&page=N);
// polled while one of them runs.
async function loadPage(page = state.page) {
  clearTimeout(state.poll);
  try { state.batches = (await api('batches')).batches; } catch (e) { say(e.message, true); return; }
  const list = filterBatches(state.batches, state.show);
  state.page = Math.min(Math.max(1, page), pageCount(list.length));
  const ids = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE).map((b) => b.batch);
  state.open = (await Promise.all(ids.map((id) => api(`batches/${encodeURIComponent(id)}`).catch(() => null)))).filter(Boolean);
  const hash = new URLSearchParams({ ...(state.show !== 'open' ? { show: state.show } : {}), ...(state.page > 1 ? { page: state.page } : {}) }).toString();
  history.replaceState(null, '', hash ? `#${hash}` : location.pathname);
  drawBatches();
  if (state.open.some((m) => m.status === 'running')) state.poll = setTimeout(() => loadPage(), 2000);
}
function drawBatches() {
  const f = document.activeElement?.closest?.('[data-cand]');
  const keep = f && { batch: f.closest('[data-batch-id]')?.dataset.batchId, cand: f.dataset.cand };
  const n = filterBatches(state.batches, state.show).length;
  const pager = pagerHtml(n, state.page);
  const empty = state.batches.length ? `<p class="empty">${state.show === 'open' ? 'Nothing left to pick.' : 'No batch here.'}</p>` : batchHtml(null);
  $('#batches').innerHTML = `${filterHtml(state.batches, state.show)}${state.open.length ? `${pager}${state.open.map(batchHtml).join('')}${n > PER_PAGE ? pager : ''}` : empty}`;
  if (keep) document.querySelector(`[data-batch-id="${CSS.escape(keep.batch)}"] [data-cand="${CSS.escape(keep.cand)}"]`)?.focus({ preventScroll: true });
  if (document.querySelector('#batches .viewer[data-model]') || viewer3d) viewers().then((v) => v.mountViewers($('#batches'))).catch((e) => say(`the 3D viewer: ${e.message}`, true));
}
const batchOf = (el) => state.open.find((m) => m.batch === el?.closest?.('[data-batch-id]')?.dataset.batchId);

async function pickCand(m, id) {
  if (!m) return;
  const target = m.target || $('#target').value.trim();
  if (!target) { say(`Give a target folder (references/…/${m.mode === '3d' ? '3d/' : ''}) first.`, true); $('#target').focus(); return; }
  const why = prompt(`Pick ${id} into ${target}: why this one? (optional, kept in manifest.json)`, '');
  if (why === null) return;
  try {
    let preview = null;
    const c = m.mode === '3d' ? m.candidates.find((x) => x.id === id) : null;
    if (c) {   // (a 3D pick: the turntable drawn here goes beside the GLB as its preview)
      say(`Drawing ${id}'s turntable…`);
      preview = await (await viewers()).turntable(candidateSrc(m.batch, c.file), c.format).catch(() => null);
    }
    const r = await api('pick', { batch: m.batch, candidate: id, target, why, preview });
    say(`Picked: ${r.file} (recorded in ${r.manifest})`);
    await loadPage();
  } catch (e) { say(e.message, true); }
}
async function rejectBatch(m) {
  const why = prompt(`None of these ${m.candidates.length} works: why? (kept with the batch${m.target ? ` and in ${m.target}manifest.json` : ''}, for the next prompt)`, '');
  if (why === null) return;
  if (!why.trim()) { say('Say why none of them works.', true); return; }
  try { await api('reject', { batch: m.batch, why }); say(`${m.batch}: none of them.`); await loadPage(); } catch (e) { say(e.message, true); }
}
async function unreject(m) {
  try { await api('reject', { batch: m.batch, why: null }); await loadPage(); } catch (e) { say(e.message, true); }
}
async function discardCand(m, id) {
  if (!m) return;
  try { await api('discard', { batch: m.batch, candidate: id }); await loadPage(); say(`Discarded ${id}.`); } catch (e) { say(e.message, true); }
}
async function discardBatch(m) {
  if (!confirm(`Delete batch ${m.batch} and all its pictures?`)) return;
  try { await api('discard', { batch: m.batch }); await loadPage(); say(`Removed ${m.batch}.`); } catch (e) { say(e.message, true); }
}

// ------------------------------------------------------------------ the zoom
const zoom = $('#zoom');
let zoomList = [], zoomAt = 0, zoomBatch = null;
const zoomOpen = () => zoom.classList.contains('open');
function openZoom(el) {
  const seen = new Set();   // (a picture once in the zoom, however often it shows)
  zoomBatch = batchOf(el);
  zoomList = [...(el.closest('[data-batch-id]') ?? document).querySelectorAll('figure img')].filter((i) => !i.closest('.viewer') && !seen.has(i.src) && seen.add(i.src))
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
  if (e.target.closest('[data-zpick]')) { const c = zoomList[zoomAt]?.cand; closeZoom(); if (c) pickCand(zoomBatch, c); return; }
  if (e.target.closest('[data-close]') || e.target === zoom) closeZoom();
});

// ------------------------------------------------------------------ mouse, keys, a controller
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('#zoom') || t.closest('#crop')) return;
  const md = t.closest('[data-mode]'); if (md) return setMode(md.dataset.mode);
  const va = t.closest('[data-view-act]'); if (va) { viewers().then((v) => v.viewerAct(va.closest('figure'), va.dataset.viewAct)); return; }
  const ic = t.closest('[data-inp-crop]'); if (ic) return openCrop(+ic.dataset.inpCrop);
  const idel = t.closest('[data-inp-del]'); if (idel) { state.inputs.splice(+idel.dataset.inpDel, 1); drawInputs(); drawRefs(); return; }
  const ref = t.closest('[data-ref]'); if (ref) return toggleRef(ref.dataset.ref);
  const un = t.closest('[data-unpick]'); if (un) return toggleRef(un.dataset.unpick);
  if (t.closest('[data-more]')) { state.shown += PAGE; drawRefs(); return; }
  const pk = t.closest('[data-pick]'); if (pk) return pickCand(batchOf(pk), pk.dataset.pick);
  const dc = t.closest('[data-discard]'); if (dc) return discardCand(batchOf(dc), dc.dataset.discard);
  if (t.closest('[data-discard-batch]')) return discardBatch(batchOf(t));
  if (t.closest('[data-reject]')) return rejectBatch(batchOf(t));
  if (t.closest('[data-unreject]')) return unreject(batchOf(t));
  const sh = t.closest('[data-show]'); if (sh) { state.show = sh.dataset.show; loadPage(1); return; }
  const pg = t.closest('[data-page]'); if (pg && !pg.disabled) { loadPage(+pg.dataset.page).then(() => $('#batches').scrollIntoView({ block: 'start' })); return; }
  if (t.closest('#go')) return generate();
  const fig = t.closest('#batches figure'); if (fig && t.tagName === 'IMG' && !t.closest('.viewer')) return openZoom(fig);
});
const focusedCand = () => (zoomOpen() ? zoomList[zoomAt]?.cand : document.activeElement?.closest?.('[data-cand]')?.dataset.cand);
const focusedBatch = () => (zoomOpen() ? zoomBatch : batchOf(document.activeElement));
const typing = (el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '') && !/^(checkbox|button)$/.test(el.type);
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (crop.classList.contains('open')) { if (e.key === 'Escape') { e.preventDefault(); closeCrop(); } return; }
  if (zoomOpen()) {
    if (e.key === 'Escape') { e.preventDefault(); closeZoom(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stepZoom(e.key === 'ArrowRight' ? 1 : -1); }
    else if (e.key === 'p' || e.key === 'P') { const c = focusedCand(), m = focusedBatch(); if (c) { closeZoom(); pickCand(m, c); } }
    return;
  }
  if (typing(e.target)) return;
  const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (dir) { e.preventDefault(); menuNavigate(document.body, ...dir); return; }
  if (e.key === 'g' || e.key === 'G') { e.preventDefault(); generate(); return; }
  const c = focusedCand();
  if (c && (e.key === 'p' || e.key === 'P')) pickCand(focusedBatch(), c);
  else if (c && (e.key === 'Delete' || e.key === 'Backspace')) discardCand(focusedBatch(), c);
  else if (e.key === 'Enter' && document.activeElement?.matches('#batches figure:not(.model3d)')) openZoom(document.activeElement);
});
function confirmPad() {
  const el = document.activeElement;
  if (zoomOpen()) { if (el?.matches('[data-go], [data-zpick], [data-close]')) el.click(); else closeZoom(); return; }
  if (!el || el === document.body) return menuNavigate(document.body, 0, 1);
  if (el.matches('#batches figure:not(.model3d)')) return openZoom(el);
  if (el.matches('input[type="checkbox"]')) { el.click(); el.dispatchEvent(new Event('change', { bubbles: true })); return; }
  if (el.matches('button, a[href], summary')) el.click();
  else el.focus();
}
function back() {
  if (crop.classList.contains('open')) return closeCrop();
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
    else if (name === 'x') { const c = focusedCand(), m = focusedBatch(); if (c) { if (zoomOpen()) closeZoom(); pickCand(m, c); } }
    else if (name === 'y') { const c = focusedCand(); if (c && !zoomOpen()) discardCand(focusedBatch(), c); }
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
  state.providers = providers.providers; state.tripo = providers.tripo ?? null; state.prompts = prompts; state.refs = refs.refs; state.batches = batches.batches;
  $('#source').innerHTML = promptOptions(prompts);
  $('#ref-folder').innerHTML = `<option value="">every folder</option>${refFolders(state.refs).map((f) => `<option>${esc(f)}</option>`).join('')}`;
  drawProviders(); drawRefs(); drawPicked(); showTripo();
  let saved = '2d'; try { saved = localStorage.getItem('refLabMode') ?? '2d'; } catch { /* private mode */ }
  setMode(new URLSearchParams(location.hash.slice(1)).get('mode') ?? saved);
  const n = state.providers.filter((p) => p.available).length;
  say(`${n} of ${state.providers.length} providers have a key · ${state.refs.length} reference pictures · ${state.batches.length} batches`);
  // (everything is on disk: a reload shows the page it showed)
  const h = new URLSearchParams(location.hash.slice(1));
  state.show = ['open', 'picked', 'rejected', 'all'].includes(h.get('show')) ? h.get('show') : 'open';
  await loadPage(+h.get('page') || 1);
} catch (e) {
  say(`The reference lab needs the dev server (npx vite): ${e.message}`, true);
}
