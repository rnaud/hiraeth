import { CATALOG, CONCEPTS, STATES, STORAGE_KEY, decisionFor, readReview, exportReview, filterRows } from './enemy-review-data.js';
import { STAGE_LABELS, BUILD_LABEL, referencesFor } from './enemy-review-references.js';

const $ = (id) => document.getElementById(id);
let records = {}, api, opened = false, generation = 0, pumping = false, rows = [], lastFocus;
const pictures = new Map(), failed = new Set();
try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) records = readReview(JSON.parse(raw)); }
catch { $('save-status').textContent = 'Saved feedback could not be read. Export any new notes before leaving.'; }
const node = (tag, text, className) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (className) e.className = className; return e; };
for (const [id, name] of [...new Map(CATALOG.map((r) => [r.world, r.worldName]))].sort((a,b) => a[1].localeCompare(b[1]))) {
  const option = node('option', name); option.value = id; $('world').append(option);
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(exportReview(records))); $('save-status').textContent = 'Saved in this browser · model and concept feedback stay separate. Export to back up.'; }
  catch { $('save-status').textContent = 'Browser storage is unavailable. Export feedback before leaving this page.'; }
  summary();
}
function summary() {
  const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
  for (const r of CATALOG) counts[decisionFor(records, r).status]++;
  $('summary').textContent = `${new Set(CATALOG.map((r) => r.type)).size} current types · ${counts.keep} keep / ${counts.rework} rework / ${counts.dismiss} dismiss · ${CONCEPTS.filter((c) => c.selections.length).length} concepts with selections · ${CONCEPTS.filter((c) => c.newEnemy).length} new concepts · ${CONCEPTS.filter((c) => c.comparisonOnly).length} kept enemy explorations`;
}
function link(text, url, className) { const a = node('a', text, className); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function referenceImage(selection, name) {
  const a = link('', selection.url, 'reference-image'), img = node('img');
  img.src = selection.image; img.alt = `${name} · selected concept, option ${selection.index + 1}`; img.referrerPolicy = 'no-referrer';
  img.onerror = () => { img.remove(); a.append(node('span', 'Image unavailable · open selected reference ↗')); };
  a.append(img); a.setAttribute('aria-label', `Open ${name}, selected option ${selection.index + 1} in Midjourney`); return a;
}
function referenceDetails(row, compact = false) {
  const section = node('section', null, 'reference-details');
  section.append(node('p', `${STAGE_LABELS[row.stage]} · ${BUILD_LABEL}`, 'badge'), node('p', row.note, 'direction-note'));
  if (compact) section.prepend(node('h3', row.name));
  const selections = compact ? row.selections : row.selections.slice(1);
  if (selections.length) { const strip = node('div', null, 'reference-strip'); for (const s of selections) strip.append(referenceImage(s, row.name)); section.append(strip); }
  for (const [i, s] of row.selections.entries()) section.append(link(`${row.stage === 'revising' ? 'Earlier selection' : i ? 'Also liked' : 'Selected reference'} · option ${s.index + 1} ↗`, s.url, 'source-link'));
  if (row.previousSelections?.length) {
    const history = node('details', null, 'model-references');
    history.append(node('summary', 'Earlier references · superseded'));
    for (const s of row.previousSelections) history.append(link(`Earlier reference · option ${s.index + 1} ↗`, s.url, 'source-link'));
    section.append(history);
  }
  if (row.jobUrl) section.append(link(row.stage === 'revising' ? 'Review new style options in Midjourney ↗' : 'Review options in Midjourney ↗', row.jobUrl, 'source-link'));
  return section;
}
function modelPreview(row) {
  const preview = node('button', null, 'preview'); preview.dataset.modelId = row.id; preview.setAttribute('aria-label', `Inspect ${row.name}`);
  preview.append(node('span', failed.has(row.id) ? 'Preview unavailable · open inspection' : 'Rendering model…'));
  if (pictures.has(row.id)) { const img = node('img'); img.src = pictures.get(row.id); img.alt = `${row.name}, current game model`; preview.append(img); }
  preview.append(node('span', 'Inspect in 3D ↗', 'inspect')); preview.onclick = () => inspect(row, preview);
  return preview;
}
function card(row) {
  const isConcept = row.id.startsWith('concept:');
  const d = decisionFor(records, row), article = node('article', null, 'card'); article.dataset.id = row.id; article.dataset.status = d.status;
  let preview;
  if (isConcept) {
    preview = node('div', null, 'comparison');
    const current = CATALOG.find((r) => r.type === row.type && r.home);
    const model = node('figure'), reference = node('figure'), art = node('div', null, 'concept-preview');
    model.append(node('figcaption', current ? 'CURRENT GAME MODEL' : 'NEW ENEMY', 'picture-heading'));
    if (current) model.append(modelPreview(current));
    else { const empty = node('div', null, 'no-model'); empty.append(node('strong', 'No game model yet'), node('span', 'Build from scratch')); model.append(empty); }
    reference.append(node('figcaption', row.stage === 'revising' ? 'EARLIER SELECTION · REDO IN REVIEW' : row.selections.length ? 'CHOSEN REFERENCE' : 'EXPLORATION', 'picture-heading'));
    if (row.selections.length) art.append(referenceImage(row.selections[0], row.name));
    else { art.append(node('span', 'Awaiting your selection')); if (row.jobUrl) art.append(link('View exploration ↗', row.jobUrl)); }
    reference.append(art); preview.append(model, reference);
  } else {
    preview = modelPreview(row);
  }
  const body = node('div', null, 'body');
  body.append(node('p', `${row.family}${row.retired ? ' · retired' : ''}`, 'meta'), node('h2', row.name), node('p', isConcept ? (row.newEnemy ? 'New enemy · build from scratch' : row.comparisonOnly ? `Alternative for kept model · ${row.type}` : `Replacement direction · ${row.type}`) : `${row.archetype} · ${row.role} · ${row.worldName}${!row.placed ? ' · gallery appearance' : ''}`, 'sub'));
  if (isConcept) {
    const status = node('dl', null, 'build-status');
    const next = row.comparisonOnly ? (row.selections.length ? 'Reference approved · build pending' : 'Compare options with the kept model') : row.stage === 'revising' ? 'Choose the new style reference' : row.stage === 'exploring' ? 'Choose a reference' : row.stage === 'shortlist' ? 'Choose the final direction, then rebuild' : row.stage === 'reserved' ? 'Reserved · build later' : row.newEnemy ? 'Build a new enemy' : 'Rebuild the existing model';
    for (const [label, value] of [['Game', row.newEnemy ? 'No model yet' : row.comparisonOnly && !row.selections.length ? 'Existing model · comparison only' : 'Existing model · reference not applied'], ['Reference', STAGE_LABELS[row.stage]], ['Next step', next]]) status.append(node('dt', label), node('dd', value));
    body.append(status);
    body.append(referenceDetails(row));
    const current = CATALOG.find((r) => r.type === row.type && r.home);
    if (current) {
      const review = decisionFor(records, current);
      body.append(node('p', `Current model review: ${review.status}${review.note ? ` — ${review.note}` : ''}`, 'model-feedback'));
      const compare = node('button', 'Inspect current game model', 'compare'); compare.onclick = () => inspect(current, compare); body.append(compare);
    }
  } else {
    const refs = referencesFor(row.type);
    if (refs.length) { const details = node('details', null, 'model-references'); details.append(node('summary', `${refs.length} reference direction${refs.length > 1 ? 's' : ''} · not implemented`)); for (const ref of refs) details.append(referenceDetails(ref, true)); body.append(details); }
    else body.append(node('p', 'No replacement reference selected.', 'sync-note'));
  }
  const choices = node('div', null, 'decisions'); choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', `Decision for ${row.name}`);
  for (const status of ['keep', 'rework', 'dismiss']) {
    const b = node('button', isConcept ? ({keep:'Keep concept',rework:'Refine',dismiss:'Dismiss'})[status] : status[0].toUpperCase()+status.slice(1)); b.setAttribute('aria-pressed', String(d.status === status));
    b.onclick = () => { records[row.id] = { ...decisionFor(records, row), status }; save(); render(); }; choices.append(b);
  }
  const label = node('label', 'What should stay or change?', 'note-label'), note = node('textarea'); note.value = d.note; note.maxLength = 10000; note.placeholder = 'Shape, colours, movement, personality…';
  note.setAttribute('aria-label', `Notes for ${row.name}`);
  note.oninput = () => { records[row.id] = { ...decisionFor(records, row), note: note.value }; save(); }; label.append(note);
  const reset = node('button', 'Mark undecided', 'reset'); reset.onclick = () => { records[row.id] = { ...decisionFor(records, row), status: 'undecided' }; save(); render(); };
  body.append(choices, label, reset); article.append(preview, body); return article;
}
function render() {
  generation++;
  rows = filterRows(Object.fromEntries(['view','world','family','status','search'].map((k) => [k, $(k).value])), records);
  const existing = $('view').value === 'existing'; $('world-filter').hidden = !existing;
  $('grid').classList.toggle('concept-grid', !existing);
  $('grid').replaceChildren(...rows.map(card)); $('empty').hidden = !!rows.length;
  $('count').textContent = `${rows.length} ${existing ? ($('world').value === 'home' ? 'enemy types' : 'appearances') : 'concepts'} shown`;
  if (!existing) $('loading').textContent = 'Selected references and pending explorations · no concepts implemented';
  summary(); void pump();
}
const yieldFrame = () => new Promise((r) => requestAnimationFrame(r));
async function pump() {
  if (!api || pumping || opened) return;
  pumping = true;
  try {
    while (!opened) {
      const targets = rows.map((r) => r.id.startsWith('concept:') ? CATALOG.find((c) => c.type === r.type && c.home) : r).filter(Boolean);
      const row = targets.find((r) => !pictures.has(r.id) && !failed.has(r.id)); if (!row) break;
      const version = generation;
      $('loading').textContent = `Rendering ${row.name}…`;
      await yieldFrame(); if (opened || version !== generation) continue;
      try {
        // The existing gallery owns the model and real material pipeline. No game/audio is constructed.
        api.capture(row.id);
        api.viewer.setSize(480, 360); api.viewer.render(row.id);
        const url = api.viewer.renderer.domElement.toDataURL('image/webp', .85); pictures.set(row.id, url);
        for (const preview of $('grid').querySelectorAll('[data-model-id]')) if (preview.dataset.modelId === row.id) { const img = node('img'); img.src = url; img.alt = `${row.name}, current game model`; preview.append(img); }
      } catch (e) { failed.add(row.id); console.error('Enemy preview failed', row.id, e); }
    }
  } finally {
    pumping = false;
    $('loading').textContent = opened ? 'Inspection open · thumbnail rendering paused' : $('view').value !== 'existing' ? 'Selected references and pending explorations · no concepts implemented' : failed.size ? `${failed.size} previews unavailable · inspect those individually` : 'Current game models · silent preview';
  }
}
function inspect(row, source) {
  if (!api) { $('loading').textContent = 'The game renderer is still loading. Please try again in a moment.'; return; }
  opened = true; lastFocus = source;
  $('inspection-title').textContent = `${row.name} · drag to turn, choose a movement or attack`;
  $('inspector').className = 'opened'; $('inspector').setAttribute('role','dialog'); $('inspector').setAttribute('aria-modal','true');
  document.querySelectorAll('body > header, body > section.summary, body > section.direction, body > nav, body > main, body > footer').forEach((e) => e.inert = true);
  api.viewer.fixed = null; api.choose(row.id); api.setPaused(false); $('close').focus();
}
function close() {
  if (!opened) return;
  api.setPaused(true); opened = false; $('inspector').className = 'parked'; $('inspector').removeAttribute('role'); $('inspector').removeAttribute('aria-modal');
  document.querySelectorAll('[inert]').forEach((e) => e.inert = false); lastFocus?.focus(); void pump();
}
$('close').onclick = close; document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
for (const key of ['view','world','family','status']) $(key).onchange = render;
$('search').oninput = render;
$('export').onclick = () => {
  const blob = new Blob([JSON.stringify(exportReview(records), null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = node('a');
  a.href = url; a.download = 'hiraeth-enemy-feedback.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('import').onchange = async () => {
  const file = $('import').files[0]; if (!file) return;
  try { if (file.size > 2e6) throw Error('This file is too large for an enemy review.'); const incoming = readReview(JSON.parse(await file.text())); records = { ...records, ...incoming }; save(); render(); }
  catch (e) { $('save-status').textContent = `Import not applied: ${e.message}`; }
  $('import').value = '';
};
render();
async function ready() {
  const start = performance.now();
  while (!$('viewer').contentWindow?.enemyViewer) {
    if (performance.now() - start > 60000) throw Error('The game preview did not load. Reload this page to retry.');
    await new Promise((r) => setTimeout(r, 250));
  }
  api = $('viewer').contentWindow.enemyViewer; api.setPaused(true); await api.clips;
  const frameDoc = $('viewer').contentDocument;
  // The original gallery grows to its long attack list. Inside the inspector the
  // model must fit the available viewport while that list scrolls independently.
  const embeddedStyle = frameDoc.createElement('style');
  embeddedStyle.textContent = 'main{height:calc(100vh - 80px);min-height:0}#stage{min-height:0;height:100%}aside{overflow:auto;min-height:0}header{height:80px}@media(max-width:760px){main{display:grid;grid-template-columns:1fr;grid-template-rows:55% 45%}#stage{height:100%;min-height:0}}';
  frameDoc.head.append(embeddedStyle);
  // Prevent navigation from replacing the shared renderer while inspecting.
  frameDoc.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  frameDoc.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  void pump();
}
ready().catch((e) => { $('loading').textContent = e.message; $('loading').className = 'error'; });
