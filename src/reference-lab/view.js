// The reference lab's page, drawn (reference-lab.html, docs/systems/reference-lab.md): pure functions from the
// dev server's answers to HTML, so the tests read them without a browser. Nothing here knows a key: the page
// only ever sees which providers have one.
import { glyph } from '../pad-glyphs.js';

export const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A repository path as the dev server serves it (each segment encoded: the folders have spaces). */
export const fileSrc = (path) => `/${String(path).split('/').map(encodeURIComponent).join('/')}`;

/** A candidate's picture, through the dev server (the candidates are kept in the main checkout, not under its root). */
export const candidateSrc = (batch, file) => `/__reference-lab/file/${encodeURIComponent(batch)}/${String(file).split('/').map(encodeURIComponent).join('/')}`;

export const ASPECTS =['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9'];

/** The prompt sources as <option>s: free text, each document's entries and variants, the recorded prompts. */
export function promptOptions(prompts) {
  const groups = [`<option value="">Free text</option>`];
  for (const d of prompts?.docs ?? []) {
    groups.push(`<optgroup label="${esc(d.doc.split('/').pop())}">${d.entries.flatMap((e) => e.variants.map((v) =>
      `<option value="${esc(`doc:${d.doc}#${e.id}/${v.key}`)}">${esc(e.title)} · ${esc(v.label)}</option>`)).join('')}</optgroup>`);
  }
  if (prompts?.manifests?.length) {
    groups.push(`<optgroup label="Recorded prompts (references/)">${prompts.manifests.map((m, i) =>
      `<option value="man:${i}">${esc(m.label)} · ${esc(m.source.replace(/^references\//, ''))}</option>`).join('')}</optgroup>`);
  }
  return groups.join('');
}

/** The prompt an option stands for: { prompt, ar, target, from } or null (free text). */
export function promptFor(prompts, value) {
  if (!value) return null;
  if (value.startsWith('man:')) { const m = prompts.manifests[+value.slice(4)]; return m ? { prompt: m.prompt, ar: m.ar, target: '', from: m.source } : null; }
  const [, doc, id, key] = value.match(/^doc:(.+)#([\w-]+)\/([\w-]+)$/) ?? [];
  const d = prompts.docs.find((x) => x.doc === doc), e = d?.entries.find((x) => x.id === id), v = e?.variants.find((x) => x.key === key);
  return v ? { prompt: v.prompt, ar: v.ar, target: e.target, from: `${doc}#${id}${key === 'main' ? '' : `/${key}`}`, needsImage: v.needsImage } : null;
}

/** The folders of the references, for the filter. */
export const refFolders = (refs) => [...new Set(refs.map((r) => r.folder))].sort((a, b) => a.localeCompare(b));

/** The references a filter keeps (folder exact or '', words all in the path). */
export function filterRefs(refs, { folder = '', query = '' } = {}) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return refs.filter((r) => (!folder || r.folder === folder) && words.every((w) => r.path.toLowerCase().includes(w)));
}

export function refThumb(r, selected) {
  return `<button type="button" class="ref${selected ? ' on' : ''}" data-ref="${esc(r.path)}" title="${esc(r.path)}" aria-pressed="${selected}">
    <img src="${esc(fileSrc(r.path))}" alt="" loading="lazy"><span>${esc(r.name)}</span></button>`;
}

/** A provider's row in the form: a checkbox and its model, greyed with what to add when it has no key. */
export function providerRow(p, { checked = false, model = p.model } = {}) {
  const cost = p.costPerImage != null ? `${p.costEstimated ? '~' : ''}$${p.costPerImage.toFixed(3)}/image` : 'price by token';
  if (!p.available) {
    return `<div class="prov off" data-provider="${esc(p.id)}"><label><input type="checkbox" disabled> ${esc(p.label)}</label>
      <small class="need">add ${esc(p.keyName)}${p.keyAliases?.length ? ` (or ${esc(p.keyAliases.join(', '))})` : ''} to .env.local</small></div>`;
  }
  const models = p.models.length > 1 ? `<select class="model" data-model-for="${esc(p.id)}" title="Model">${p.models.map((m) => `<option${m === model ? ' selected' : ''}>${esc(m)}</option>`).join('')}</select>` : `<small class="m">${esc(p.models[0])}</small>`;
  return `<div class="prov" data-provider="${esc(p.id)}"><label><input type="checkbox" data-use="${esc(p.id)}"${checked ? ' checked' : ''}> ${esc(p.label)}</label>
    ${models}<small class="cost">${esc(cost)} · ${p.maxRefs} refs max</small></div>`;
}

const money = (v, est) => (v == null ? '' : `${est ? '~' : ''}$${Number(v).toFixed(3)}`);
const secs = (ms) => (ms == null ? '' : `${(ms / 1000).toFixed(1)} s`);

/** A candidate's card: the picture (zoom), which provider made it, its time and cost, Pick and Discard. */
export function candidateCard(batch, c, est = false, label = '') {
  const gone = c.status === 'discarded';
  return `<figure class="cand ${esc(c.status)}" data-cand="${esc(c.id)}" data-nav tabindex="0">
    ${gone ? '<div class="gone">discarded</div>' : `<img src="${esc(candidateSrc(batch, c.file))}" alt="${esc(c.id)}" loading="lazy">`}
    <figcaption><b>${esc(label || c.label || c.provider)}</b> #${esc(c.id.split('/').pop())} ${esc(secs(c.ms))} ${esc(money(c.costUSD, est))}${c.status === 'picked' ? ` <span class="picked">✓ ${esc(c.pickedAs ?? 'picked')}</span>` : ''}</figcaption>
    ${gone ? '' : `<div class="acts"><button type="button" class="btn" data-pick="${esc(c.id)}">${glyph('x', { key: 'P' })}Pick</button><button type="button" class="btn" data-discard="${esc(c.id)}">${glyph('y', { key: 'Del' })}Discard</button></div>`}
  </figure>`;
}

/**
 * A batch: its prompt, each provider's state on one line, then every provider's pictures together in one grid
 * (the references it was drawn from on their own above everything), so the pick is one choice across all of them.
 */
export function batchHtml(m) {
  if (!m) return '<p class="empty">Generate a batch, or open one from the history.</p>';
  if (m.mode === '3d') return batch3dHtml(m);
  // the reference the batch was drawn from (when there is one): on its own above everything else
  const refs = m.refs?.length ? m.refs : (m.comparison ? [m.comparison] : []);
  const cmp = refs.length ? `<div class="refrow">${refs.map((r) => `<figure class="cand cmp" tabindex="0" data-nav data-cmp="${esc(r)}"><img src="${esc(fileSrc(r))}" alt="the reference"><figcaption><b>reference</b> ${esc(r.split('/').pop())}</figcaption></figure>`).join('')}</div>` : '';
  const states = Object.entries(m.providers).map(([id, p]) => {
    const state = p.status === 'running' ? '<span class="spin">generating…</span>'
      : p.status === 'error' ? `<span class="err">${esc(p.kind)}: ${esc(p.error)}</span>`
        : `${p.count} in ${esc(secs(p.ms))}${p.costUSD != null ? ` · ${esc(money(p.costUSD, p.estimated))}` : ''}`;
    return `<li class="pstate ${esc(p.status)}" data-row="${esc(id)}"><b>${esc(p.label ?? id)}</b> <small>${esc(p.model ?? '')}</small> ${state}</li>`;
  }).join('');
  const cards = m.candidates.map((c) => candidateCard(m.batch, c, m.providers[c.provider]?.estimated, m.providers[c.provider]?.label)).join('');
  const total = Object.values(m.providers).reduce((s, p) => s + (p.costUSD ?? 0), 0);
  const picked = m.candidates.find((c) => c.status === 'picked');
  const left = m.candidates.filter((c) => c.status !== 'discarded').length;
  const verdict = m.rejected
    ? `<p class="rejected"><b>None of them</b> (${esc(m.rejected.date)}): ${esc(m.rejected.why)} <button type="button" class="btn small" data-unreject>Take back</button></p>`
    : picked ? `<p class="meta"><span class="picked">Kept: ${esc(m.providers[picked.provider]?.label ?? picked.provider)} #${esc(picked.id.split('/').pop())}</span></p>`
      : `<p class="meta">${left} pictures from ${Object.keys(m.providers).length} provider(s): pick the one to keep, or say why none works.</p>`;
  const none = !picked && !m.rejected && m.status !== 'running' ? `<button type="button" class="btn small" data-reject>None of them…</button> ` : '';
  return `<article class="batch${m.rejected ? ' is-rejected' : ''}" data-batch-id="${esc(m.batch)}">${cmp}<div class="bhead"><p class="meta"><b>${esc(m.batch)}</b> · ${esc(m.status)} · ${esc(m.ar)} · ${m.n} each · ${m.refs.length} ref(s)${total ? ` · ${esc(money(total, true))} in all` : ''}${m.target ? ` · → ${esc(m.target)}` : ''}</p>
    <p class="prompt">${esc(m.from ? `${m.from}: ` : '')}${esc(m.prompt.length > 320 ? `${m.prompt.slice(0, 320)}…` : m.prompt)}</p>
    <ul class="pstates">${states}</ul>
    ${verdict}
    ${none}<button type="button" class="btn small" data-discard-batch>Discard the batch</button></div>
    <div class="wall">${cards}</div></article>`;
}

/** The batch filter: to pick (the default: finished, nothing picked, not turned down: a batch still generating waits
 * out of the way until it is done), picked, none of them, all (the running ones too). */
export const FILTERS = [['open', 'To pick'], ['picked', 'Picked'], ['rejected', 'None of them'], ['all', 'All']];
export function filterBatches(list, show = 'open') {
  if (show === 'all') return list;
  if (show === 'picked') return list.filter((b) => b.picked > 0);
  if (show === 'rejected') return list.filter((b) => b.rejected);
  return list.filter((b) => !b.picked && !b.rejected && b.status !== 'running');
}
/** How many batches are still generating (said beside the filters; they join To pick when done). */
export const runningCount = (list) => list.filter((b) => b.status === 'running').length;
export function filterHtml(list, show = 'open') {
  const run = runningCount(list);
  return `<nav class="filters">${FILTERS.map(([k, label]) => `<button type="button" class="btn small${k === show ? ' on' : ''}" data-show="${k}"${k === show ? ' aria-pressed="true"' : ''}>${esc(label)} <small>${filterBatches(list, k).length}</small></button>`).join('')}${run ? ` <small class="spin">${run} generating…</small>` : ''}</nav>`;
}

/** Every batch, newest first, a page at a time: the page's numbers, and where it is. */
export const PER_PAGE = 5;
export const pageCount = (n, per = PER_PAGE) => Math.max(1, Math.ceil(n / per));
export function pagerHtml(total, page, per = PER_PAGE) {
  const pages = pageCount(total, per);
  if (pages < 2) return `<p class="meta">${total} batch${total === 1 ? '' : 'es'}</p>`;
  const nums = Array.from({ length: pages }, (_, i) => i + 1)
    .filter((i) => i === 1 || i === pages || Math.abs(i - page) <= 2)
    .map((i, k, a) => `${k && i - a[k - 1] > 1 ? '<span>…</span>' : ''}<button type="button" class="btn small${i === page ? ' on' : ''}" data-page="${i}"${i === page ? ' aria-current="page"' : ''}>${i}</button>`).join('');
  return `<nav class="pager"><button type="button" class="btn small" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>◀</button>${nums}<button type="button" class="btn small" data-page="${page + 1}"${page >= pages ? ' disabled' : ''}>▶</button> <small>${total} batches · ${(page - 1) * per + 1}–${Math.min(total, page * per)}</small></nav>`;
}

/** Checked at first: Gemini and OpenAI when they have a key (the author's default, as DEFAULT_PROVIDERS on the server); the rest a click away. */
export const DEFAULT_CHECKED = ['openai', 'gemini'];
export const defaultChecked = (p) => p.available && DEFAULT_CHECKED.includes(p.id);

// ------------------------------------------------------------------ the 3D mode (Tripo)
const mb = (bytes) => (bytes == null ? '' : `${(bytes / 1e6).toFixed(1)} MB`);
const cropText = (c) => (c ? ` · crop ${c.x},${c.y} ${c.w}×${c.h}` : '');

/** The options of a 3D batch in a few words. */
export function options3dText(o = {}) {
  return [o.model, o.texture ? (o.pbr ? 'PBR texture' : 'texture') : 'no texture', o.texture && o.textureQuality === 'detailed' ? 'HD texture' : '',
    o.faceLimit ? `≤ ${o.faceLimit} faces` : '', o.quad ? 'quad (FBX)' : '', o.rig ? 'rigged' : ''].filter(Boolean).join(' · ');
}

/** A 3D candidate's card: a viewer (its still until the live one is mounted), its controls, Pick and Discard. */
export function model3dCard(batch, c) {
  const gone = c.status === 'discarded';
  const src = (f) => (f ? candidateSrc(batch, f) : '');
  const rig = c.rig ? ` · rig: ${c.rig.status}${c.rig.rigType ? ` (${c.rig.rigType})` : ''}${c.rig.error ? `: ${c.rig.error}` : ''}` : '';
  const anim = c.rig?.animated ? src(c.rig.animated) : '';
  const viewer = gone ? '<div class="gone">discarded</div>'
    : `<div class="viewer" data-model="${esc(src(c.file))}" data-format="${esc(c.format ?? 'glb')}"${anim ? ` data-anim="${esc(anim)}"` : ''}${c.preview ? ` data-still="${esc(src(c.preview))}"` : ''}>${c.preview ? `<img src="${esc(src(c.preview))}" alt="${esc(c.id)}" loading="lazy">` : '<span class="wait">3D model</span>'}</div>
    <div class="vacts"><button type="button" class="btn small on" data-view-act="spin" title="Turntable on / off">Turn</button><button type="button" class="btn small" data-view-act="wire" title="Wireframe">Wire</button><button type="button" class="btn small" data-view-act="tex" title="Texture / clay">Clay</button>${anim ? '<button type="button" class="btn small" data-view-act="anim" title="The preview walk (rigged)">Walk</button>' : ''}</div>`;
  return `<figure class="cand model3d ${esc(c.status)}" data-cand="${esc(c.id)}" data-nav tabindex="0">
    ${viewer}
    <figcaption><b>${esc(c.label || c.provider)}</b> #${esc(c.id.split('/').pop())} ${esc(secs(c.ms))} ${esc(money(c.costUSD, c.estimated))} · ${esc(mb(c.bytes))} ${esc(c.format ?? '')}${esc(rig)}${c.status === 'picked' ? ` <span class="picked">✓ ${esc(c.pickedAs ?? 'picked')}</span>` : ''}</figcaption>
    ${gone ? '' : `<div class="acts"><button type="button" class="btn" data-pick="${esc(c.id)}">${glyph('x', { key: 'P' })}Pick</button><button type="button" class="btn" data-discard="${esc(c.id)}">${glyph('y', { key: 'Del' })}Discard</button></div>`}
  </figure>`;
}

/** A 3D batch: the pictures as sent (or the prompt) above, Tripo's state, then every model in a viewer. */
export function batch3dHtml(m) {
  const inputs = (m.inputs ?? []).map((i) => `<figure class="cand cmp" tabindex="0" data-nav><img src="${esc(candidateSrc(m.batch, i.file))}" alt="the ${esc(i.view ?? '')} view"><figcaption><b>${esc(i.view ?? 'view')}</b> · ${esc(String(i.path).split('/').pop())}${esc(cropText(i.crop))}</figcaption></figure>`).join('');
  const refrow = inputs ? `<div class="refrow">${inputs}</div>` : '';
  const p = m.providers?.tripo ?? {};
  const stages = Object.entries(p.stages ?? {}).map(([n, s]) => `#${esc(n)} ${esc(s)}`).join(' · ');
  const state = p.status === 'running' ? `<span class="spin">generating… ${stages}</span>`
    : p.status === 'error' ? `<span class="err">${esc(p.kind)}: ${esc(p.error)}</span>`
      : `${p.count} in ${esc(secs(p.ms))} · ${esc(money(p.costUSD, p.estimated))} (${esc(p.credits)} credits)${p.error ? ` <span class="err">${esc(p.error)}</span>` : ''}`;
  const picked = m.candidates.find((c) => c.status === 'picked');
  const left = m.candidates.filter((c) => c.status !== 'discarded').length;
  const verdict = m.rejected
    ? `<p class="rejected"><b>None of them</b> (${esc(m.rejected.date)}): ${esc(m.rejected.why)} <button type="button" class="btn small" data-unreject>Take back</button></p>`
    : picked ? `<p class="meta"><span class="picked">Kept: #${esc(picked.id.split('/').pop())} → ${esc(picked.pickedAs ?? '')}</span></p>`
      : m.status === 'running' ? '' : `<p class="meta">${left} model(s): pick the one to keep, or say why none works.</p>`;
  const none = !picked && !m.rejected && m.status !== 'running' ? '<button type="button" class="btn small" data-reject>None of them…</button> ' : '';
  const what = { image: 'image to model', multiview: 'multiview to model', text: 'text to model' }[m.kind] ?? m.kind;
  return `<article class="batch b3d${m.rejected ? ' is-rejected' : ''}" data-batch-id="${esc(m.batch)}">${refrow}<div class="bhead"><p class="meta"><b>${esc(m.batch)}</b> · ${esc(m.status)} · <b>3D</b> ${esc(what)} · ${m.n} candidate(s) · ${esc(options3dText(m.options))}${m.estimateUSD != null ? ` · about $${Number(m.estimateUSD).toFixed(2)}` : ''}${m.target ? ` · → ${esc(m.target)}` : ''}</p>
    ${m.prompt ? `<p class="prompt">${esc(m.from ? `${m.from}: ` : '')}${esc(m.prompt.length > 320 ? `${m.prompt.slice(0, 320)}…` : m.prompt)}</p>` : ''}
    <ul class="pstates"><li class="pstate ${esc(p.status)}" data-row="tripo"><b>${esc(p.label ?? 'Tripo 3D')}</b> <small>${esc(p.model ?? '')}</small> ${state}</li></ul>
    ${verdict}
    ${none}<button type="button" class="btn small" data-discard-batch>Discard the batch</button></div>
    <div class="wall w3d">${m.candidates.map((c) => model3dCard(m.batch, c)).join('')}</div></article>`;
}

/** The 3D form's chosen pictures: each with its view, its crop and a remove button. */
export function input3dRow(inp, i, views = ['front', 'left', 'back', 'right'], several = false) {
  return `<div class="inp" data-inp="${i}"><img src="${esc(fileSrc(inp.path))}" alt="">
    <span class="nm" title="${esc(inp.path)}">${esc(inp.path.split('/').pop())}<small>${esc(inp.crop ? `crop ${inp.crop.x},${inp.crop.y} ${inp.crop.w}×${inp.crop.h}` : 'whole picture')}</small></span>
    ${several ? `<select data-inp-view="${i}" title="Which view this is">${views.map((v) => `<option${v === inp.view ? ' selected' : ''}>${v}</option>`).join('')}</select>` : ''}
    <button type="button" class="btn small" data-inp-crop="${i}">Crop…</button><button type="button" class="x" data-inp-del="${i}" title="Remove">✕</button></div>`;
}
