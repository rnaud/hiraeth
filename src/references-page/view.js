// The references page's HTML (references.html; pure: the tests read it). See model.js for the data.
import { formatBytes, groupByFolder, LAB, LOOSE } from './model.js';

export const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** The dev server's small picture of a reference (scripts/references-index.mjs). */
export const thumbSrc = (path) => `/__references/thumb?p=${encodeURIComponent(path)}`;
/** The picture itself (Vite serves the checkout; it decodes %20 but not %2C, so commas stay as they are). */
export const fullSrc = (path) => `/${path.split('/').map((s) => encodeURI(s).replace(/#/g, '%23').replace(/\?/g, '%3F')).join('/')}`;

/** The folder tree: each node a button (data-id), its children under it while open. */
export function treeHtml(tree, { sel = '', open = new Set(), all = '' } = {}) {
  const node = (n, depth) => {
    const has = n.children?.length > 0, isOpen = has && open.has(n.id);
    const cls = [depth === 0 ? 'sec' : '', n.archive ? 'archive' : ''].filter(Boolean).join(' ');
    return `<li${cls ? ` class="${cls}"` : ''}><button class="node" data-id="${esc(n.id)}"${n.id === sel ? ' aria-current="true"' : ''}${has ? ` aria-expanded="${isOpen}"` : ''} title="${esc(n.id.startsWith('~') ? n.label : `references/${n.id}/`)}">`
      + `<span class="tw" aria-hidden="true">${has ? (isOpen ? '▾' : '▸') : ''}</span><span class="lb">${esc(n.label)}</span><small>${n.count}</small></button>`
      + (isOpen ? `<ul>${n.children.map((c) => node(c, depth + 1)).join('')}</ul>` : '')
      + '</li>';
  };
  return `<ul><li class="sec"><button class="node" data-id=""${sel === '' ? ' aria-current="true"' : ''} title="Every current reference (not the archive)"><span class="tw"></span><span class="lb">All</span><small>${all}</small></button></li>${tree.map((n) => node(n, 0)).join('')}</ul>`;
}

/** What is shown, as a line above the pictures. */
export function crumbHtml(sel, shown) {
  const where = sel === '' ? 'every current reference' : sel === LAB ? 'the reference lab’s picks' : sel === LOOSE ? 'the loose files at the top' : `references/${sel}/`;
  return `<p class="crumb"><b>${esc(where)}</b> · ${shown} picture${shown === 1 ? '' : 's'}</p>`;
}

/** One picture in the grid. */
export function thumbHtml(e) {
  const badges = `${e.lab ? '<i class="lab" title="a reference lab pick">lab</i>' : ''}${e.hasPrompt ? '<i title="has a prompt">P</i>' : ''}`;
  return `<button class="thumb" data-path="${esc(e.path)}" title="${esc(e.rel)}"><span class="im"><img loading="lazy" decoding="async" alt="" src="${esc(thumbSrc(e.path))}"></span>`
    + `<span class="nm">${esc(e.meta?.title || e.name)}</span>${badges ? `<span class="bd">${badges}</span>` : ''}</button>`;
}

/** The pictures, by folder. */
export function gridHtml(entries, sel) {
  if (!entries.length) return `${crumbHtml(sel, 0)}<p class="empty">Nothing here with these filters.</p>`;
  return crumbHtml(sel, entries.length) + groupByFolder(entries).map((g) => `<section class="group"><h2>${esc(g.folder === '.' ? 'references/' : `references/${g.folder}/`)} <small>${g.entries.length}</small></h2>`
    + `<div class="grid">${g.entries.map(thumbHtml).join('')}</div></section>`).join('');
}

/** A picture's information, beside it in the viewer. */
export function infoHtml(e, { width = 0, height = 0 } = {}) {
  const m = e.meta ?? {};
  const row = (k, v, raw = false) => (v ? `<dt>${k}</dt><dd>${raw ? v : esc(v)}</dd>` : '');
  const link = (u) => (/^https?:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, '').slice(0, 60))}</a>` : esc(u));
  const where = [e.world, e.kind].filter(Boolean).join(' · ');
  return `<h3>${esc(m.title || e.name)}</h3><dl>`
    + row('path', `<code>${esc(e.path)}</code>`, true)
    + row('size', `${formatBytes(e.bytes)}${width ? ` · ${width} × ${height}` : ''}`)
    + row('where', where)
    + row('by', m.provider)
    + row('model', m.model)
    + row('date', m.date)
    + row('lab', e.lab ? 'picked in the reference lab' : '')
    + row('source', m.source ? link(m.source) : '', true)
    + row('from', m.from)
    + row('records', (m.records ?? []).map((r) => `<code>${esc(r)}</code>`).join('<br>'), true)
    + '</dl>'
    + (m.why ? `<p class="lbl">why</p><div class="txt">${esc(m.why)}</div>` : '')
    + (m.review ? `<p class="lbl">review</p><div class="txt">${esc(m.review)}</div>` : '')
    + (m.prompt ? `<p class="lbl">prompt</p><div class="txt">${esc(m.prompt)}</div>` : '')
    + (m.notes ?? []).map((n) => `<p class="lbl">${esc(n.file)}</p><div class="txt">${esc(n.text)}</div>`).join('');
}
