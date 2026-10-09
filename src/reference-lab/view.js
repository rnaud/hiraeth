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

/** A candidate's card: the picture (zoom), its time and cost, Pick and Discard. */
export function candidateCard(batch, c, est = false) {
  const gone = c.status === 'discarded';
  return `<figure class="cand ${esc(c.status)}" data-cand="${esc(c.id)}" data-nav tabindex="0">
    ${gone ? '<div class="gone">discarded</div>' : `<img src="${esc(candidateSrc(batch, c.file))}" alt="${esc(c.id)}" loading="lazy">`}
    <figcaption><b>${esc(c.id)}</b> ${esc(secs(c.ms))} ${esc(money(c.costUSD, est))}${c.status === 'picked' ? ` <span class="picked">✓ ${esc(c.pickedAs ?? 'picked')}</span>` : ''}</figcaption>
    ${gone ? '' : `<div class="acts"><button type="button" class="btn" data-pick="${esc(c.id)}">${glyph('x', { key: 'P' })}Pick</button><button type="button" class="btn" data-discard="${esc(c.id)}">${glyph('y', { key: 'Del' })}Discard</button></div>`}
  </figure>`;
}

/** A batch: its prompt, then a row a provider (the comparison picture first), its state, time and cost. */
export function batchHtml(m) {
  if (!m) return '<p class="empty">Generate a batch, or open one from the history.</p>';
  const cmp = m.comparison ? `<figure class="cand cmp" tabindex="0" data-nav data-cmp="${esc(m.comparison)}"><img src="${esc(fileSrc(m.comparison))}" alt="the comparison"><figcaption><b>reference</b> ${esc(m.comparison.split('/').pop())}</figcaption></figure>` : '';
  const rows = Object.entries(m.providers).map(([id, p]) => {
    const cands = m.candidates.filter((c) => c.provider === id);
    const state = p.status === 'running' ? '<span class="spin">generating…</span>'
      : p.status === 'error' ? `<span class="err">${esc(p.kind)}: ${esc(p.error)}</span>`
        : `${p.count} in ${esc(secs(p.ms))}${p.costUSD != null ? ` · ${esc(money(p.costUSD, p.estimated))}` : ''}`;
    return `<section class="prow ${esc(p.status)}" data-row="${esc(id)}"><h3>${esc(p.label ?? id)} <small>${esc(p.model ?? '')}</small> <small class="state">${state}</small></h3>
      <div class="cands">${cands.length || p.status === 'running' ? cmp : ''}${cands.map((c) => candidateCard(m.batch, c, p.estimated)).join('')}</div></section>`;
  }).join('');
  const total = Object.values(m.providers).reduce((s, p) => s + (p.costUSD ?? 0), 0);
  return `<div class="bhead"><p class="meta"><b>${esc(m.batch)}</b> · ${esc(m.status)} · ${esc(m.ar)} · ${m.n} each · ${m.refs.length} ref(s)${total ? ` · ${esc(money(total, true))} in all` : ''}${m.target ? ` · → ${esc(m.target)}` : ''}</p>
    <p class="prompt">${esc(m.from ? `${m.from}: ` : '')}${esc(m.prompt.length > 320 ? `${m.prompt.slice(0, 320)}…` : m.prompt)}</p>
    <button type="button" class="btn small" data-discard-batch="${esc(m.batch)}">Discard the batch</button></div>${rows}`;
}

/** Checked at first: one provider a key (fal's other models are a click away, each a bill of its own). */
export const defaultChecked = (p) => p.available && (!p.id.startsWith('fal-') || p.id === 'fal-flux');

/** The history: a button a batch, newest first. */
export function historyHtml(list, current = '') {
  if (!list?.length) return '<p class="empty">No batches yet.</p>';
  return list.map((b) => `<button type="button" class="hist${b.batch === current ? ' on' : ''}" data-batch="${esc(b.batch)}">
    <b>${esc(b.batch.slice(0, 16).replace(/-(\d\d)-(\d\d)$/, ' $1:$2'))}</b> ${esc(b.count ?? 0)} img${b.picked ? ` · ${b.picked} picked` : ''}${b.status === 'running' ? ' · running' : ''}
    <small>${esc(String(b.from ?? b.prompt ?? '').slice(0, 80))}</small></button>`).join('');
}
