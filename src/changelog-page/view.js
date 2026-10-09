// The interactive changelog's markup and filters (changelog.html; src/changelog-page/main.js wires it
// up): plain functions of the entries (src/changelog-media.js changelogEntries), tested in Node.
import { KINDS, WORLDS } from '../changelog-media.js';
import { SHEET_SITE } from '../levels/reference-sheets.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The site that serves the pictures (they never ship in the APK, the update zip or the Deck's runtime). */
export const MEDIA_SITE = SHEET_SITE;
const APP_HOST = '127.0.0.1:41730';

/** Where a picture is read from: beside the page on the site and a dev server, the site's in a bundled game. */
export function mediaSrc(path, here = globalThis.location) {
  if (!here) return path;
  const bundled = !/^https?:$/.test(here.protocol) || here.host === APP_HOST || here.hostname === 'localhost' && here.port === '';
  return bundled ? new URL(path, MEDIA_SITE).href : path;
}

/** The filter chips: everything, the lines with pictures, then the kinds of change, then the worlds that appear. */
export function filterChips(entries) {
  const used = new Set(entries.flatMap((e) => e.lines.flatMap((l) => l.tags)));
  return {
    kinds: [['all', 'All'], ['shots', 'With pictures'], ['numbers', 'With numbers'], ...KINDS.filter(([id]) => used.has(id)).map(([id, label]) => [id, label])],
    worlds: WORLDS.filter(([id]) => used.has(id)).map(([id, label]) => [id, label]),
  };
}

/** Does a line pass the filters: a kind (or all), the worlds picked (any of them), the words searched (all of them)? */
export function matches(line, { kind = 'all', worlds = [], words = '' } = {}) {
  if (kind === 'shots' && !line.shots.length) return false;
  if (kind === 'numbers' && !line.numbers.length) return false;
  if (!['all', 'shots', 'numbers'].includes(kind) && !line.tags.includes(kind)) return false;
  if (worlds.length && !worlds.some((w) => line.tags.includes(w))) return false;
  const hay = `${line.text} ${line.see ?? ''} ${line.shots.map((s) => `${s.caption} ${s.reference?.caption ?? ''}`).join(' ')} ${line.numbers.map((n) => `${n.title} ${n.device ?? ''} ${n.rows.map((r) => r.where).join(' ')}`).join(' ')} v${line.v}`.toLowerCase();
  return words.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/** A measured value as a number for its bar: a number, or the middle of a range written '17–25'. */
export function valueOf(x) {
  if (typeof x === 'number') return x;
  const n = String(x ?? '').replace(/\s/g, '').split(/[–-]|to/).map(Number.parseFloat).filter(Number.isFinite);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
}

/** The change from before to after, and whether it is the better way. */
export function delta(row, better = 'lower') {
  const a = valueOf(row.before), b = valueOf(row.after);
  if (a === null || b === null || a === 0) return null;
  const pct = ((b - a) / Math.abs(a)) * 100;
  const good = Math.abs(pct) < 0.5 ? null : better === 'higher' ? pct > 0 : pct < 0;
  return { pct, good };
}

function numbersHtml(n) {
  const max = Math.max(...n.rows.flatMap((r) => [valueOf(r.before), valueOf(r.after)]).filter((x) => x !== null), 1e-9);
  const unit = n.unit ? ` ${esc(n.unit)}` : '';
  const rows = n.rows.map((r) => {
    const d = delta(r, n.better);
    // (a number shown with as many decimals as the other side of its row: 14.0 against 13.2, not 14)
    const dp = Math.max(...[r.before, r.after].map((x) => (typeof x === 'number' ? (String(x).split('.')[1] ?? '').length : 0)));
    const show = (x) => (typeof x === 'number' ? x.toFixed(dp) : x);
    r = { ...r, before: show(r.before), after: show(r.after) };
    const pct = d ? `<span class="delta ${d.good === null ? '' : d.good ? 'good' : 'bad'}">${d.pct > 0 ? '+' : ''}${d.pct.toFixed(Math.abs(d.pct) < 10 ? 1 : 0)} %</span>` : '';
    const bar = (x, cls) => (valueOf(x) === null ? '' : `<div class="bar ${cls}" style="width:${((valueOf(x) / max) * 100).toFixed(1)}%"></div>`);
    return `<tr><td>${esc(r.where)}</td><td class="n">${esc(r.before ?? '—')}${r.before !== undefined && r.before !== null ? unit : ''}</td><td class="n">${esc(r.after ?? '—')}${r.after !== undefined && r.after !== null ? unit : ''}</td><td class="n">${pct}</td><td class="bars">${bar(r.before, 'before')}${bar(r.after, 'after')}</td></tr>`;
  }).join('');
  return `<div class="numbers"><h3>${esc(n.title)}</h3><div class="meta">${[n.device, n.better === 'higher' ? 'higher is better' : n.better === 'lower' ? 'lower is better' : '', n.note].filter(Boolean).map(esc).join(' · ')}</div>
<table><thead><tr><th>where</th><th class="n">before</th><th class="n">after</th><th class="n">change</th><th class="bars"><span style="color:#8a7b62">■</span> before <span>■</span> after</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** One picture pair: the split view, its side-by-side twin, the modes and the caption. */
export function shotHtml(s, src = mediaSrc) {
  const size = s.size ?? s.view?.size;
  const aspect = size ? `${size[0]} / ${size[1]}` : '16 / 9';
  const ar = size ? (size[0] / size[1]).toFixed(4) : '1.7778';
  const single = !s.before || !s.after;
  const one = s.after ?? s.before;
  const img = (path, cls, alt) => `<img class="${cls}" loading="lazy" decoding="async" alt="${esc(alt)}" src="${esc(src(path))}" data-path="${esc(path)}">`;
  const compare = single
    ? `<div class="compare single" style="--aspect:${aspect};--ar:${ar}">${img(one, 'after', s.caption)}<span class="label a">${s.after ? 'NOW' : 'BEFORE'}</span><div class="offline">The picture is on the game’s site: it shows when you are online.</div></div>`
    : `<div class="compare" data-mode="split" style="--aspect:${aspect};--ar:${ar}" role="slider" aria-label="Before and after: drag to compare" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
${img(s.after, 'after', `After: ${s.caption}`)}${img(s.before, 'before', `Before: ${s.caption}`)}<div class="handle"></div><span class="label b">BEFORE</span><span class="label a">AFTER</span>
<div class="offline">The pictures are on the game’s site: they show when you are online.</div></div>
<div class="side" style="--aspect:${aspect};--ar:${ar}"><figure>${img(s.before, 'sb', `Before: ${s.caption}`)}<figcaption>BEFORE</figcaption></figure><figure>${img(s.after, 'sa', `After: ${s.caption}`)}<figcaption>AFTER</figcaption></figure></div>`;
  const modes = single ? '' : `<button type="button" data-mode="split" aria-pressed="true">Slider</button><button type="button" data-mode="before" aria-pressed="false">Before</button><button type="button" data-mode="after" aria-pressed="false">After</button><button type="button" data-mode="sbs" aria-pressed="false">Side by side</button>`;
  const pair = `${compare}<div class="modes">${modes}<span class="caption">${esc(s.caption)}</span></div>`;
  return s.sheet ? `<div class="with-ref"><div class="pair">${pair}</div>${referenceHtml(s, src)}</div>` : pair;
}

/** The design sheet a change was drawn to: its own picture beside the pair, labelled, opened full size on a click. */
export function referenceHtml(s, src = mediaSrc) {
  const cap = s.reference?.caption ?? 'The design sheet';
  return `<figure class="reference"><button type="button" class="ref-open" data-full="${esc(src(s.sheet))}" aria-label="${esc(`Open the reference full size: ${cap}`)}">`
    + `<img class="ref" loading="lazy" decoding="async" alt="${esc(`Reference: ${cap}`)}" src="${esc(src(s.sheet))}" data-path="${esc(s.sheet)}"></button>`
    + `<figcaption><b>REFERENCE</b> ${esc(cap)} <span class="ref-hint">(click to enlarge)</span></figcaption></figure>`;
}

/** A line's card. */
export function lineHtml(line) {
  const id = `v${line.v}-${line.i + 1}`;
  const rich = line.shots.length || line.numbers.length;
  const tagNames = Object.fromEntries([...KINDS, ...WORLDS].map(([k, label]) => [k, label]));
  const tags = line.tags.filter((t) => tagNames[t]).map((t) => `<span class="tag">${esc(tagNames[t])}</span>`).join('');
  const tabs = line.shots.length > 1 ? `<div class="shot-tabs">${line.shots.map((s, k) => `<button type="button" data-shot="${k}" aria-pressed="${k === 0}">${esc(s.title ?? `${k + 1}`)}</button>`).join('')}</div>` : '';
  const shots = line.shots.length ? `<div class="shots" data-shots='${esc(JSON.stringify(line.shots.map((s) => ({ before: s.before, after: s.after, caption: s.caption, size: s.size ?? s.view?.size, sheet: s.sheet ?? undefined, reference: s.reference ? { caption: s.reference.caption } : undefined }))))}'>${tabs}<div class="shot">${shotHtml(line.shots[0])}</div></div>` : '';
  const see = line.see ? `<div class="see"><b>HOW TO SEE IT</b> ${esc(line.see)}</div>` : '';
  return `<article class="line${rich ? '' : ' plain'}" id="${id}" tabindex="0" data-v="${esc(line.v)}" data-i="${line.i}">
<p class="text">${esc(line.text)}</p>${shots}${line.numbers.map(numbersHtml).join('')}${see}${tags ? `<div class="tags">${tags}</div>` : ''}</article>`;
}

/** The lines a page holds at most: whole versions are kept together, so a page runs over only for one long version. */
export const PAGE_LINES = 30;

/**
 * The entries split into pages of whole versions, newest first: a version joins the page while the page
 * holds fewer than `budget` lines, or when the page is still empty (a version longer than a page is a page).
 */
export function paginate(entries, budget = PAGE_LINES) {
  const pages = [];
  let page = [], n = 0;
  for (const e of entries) {
    if (page.length && n + e.lines.length > budget) { pages.push(page); page = []; n = 0; }
    page.push(e); n += e.lines.length;
  }
  if (page.length) pages.push(page);
  return pages;
}

/** The entries with only the lines that pass the filters, versions left empty dropped. */
export const filtered = (entries, state) => entries.map((e) => ({ ...e, lines: e.lines.filter((l) => matches(l, state)) })).filter((e) => e.lines.length);

/** The page (1-based) that holds a line or a version by its id ('v0.79-3', 'v0.79'), or 0 when none does. */
export function pageOfId(pages, id) {
  const k = pages.findIndex((p) => p.some((e) => `v${e.v}` === id || e.lines.some((l) => `v${l.v}-${l.i + 1}` === id)));
  return k + 1;
}

/** The pager: newer, this page of how many (its versions), older; `where` names it (above or below the list). */
export function pagerHtml(page, pages, where = 'top') {
  if (pages.length < 2) return '';
  const opts = pages.map((q, k) => `<option value="${k + 1}"${k + 1 === page ? ' selected' : ''}>${k + 1}: v${esc(q[0].v)}${q.length > 1 ? ` – v${esc(q[q.length - 1].v)}` : ''}</option>`).join('');
  return `<nav class="pager ${where}" aria-label="Pages">
<button type="button" class="btn" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>← Newer</button>
<label>Page <select data-pages aria-label="Page">${opts}</select> of ${pages.length}</label>
<button type="button" class="btn" data-page="${page + 1}"${page >= pages.length ? ' disabled' : ''}>Older →</button></nav>`;
}

/** A version's section. */
export function versionHtml(e) {
  const pics = e.lines.filter((l) => l.shots.length).length, nums = e.lines.filter((l) => l.numbers.length).length;
  const extra = [pics ? `${pics} with pictures` : '', nums ? `${nums} with numbers` : ''].filter(Boolean).join(', ');
  return `<section class="version" data-v="${esc(e.v)}" id="v${esc(e.v)}"><h2>v${esc(e.v)} <small>${esc(e.date)} · ${e.lines.length} changes${extra ? ` · ${extra}` : ''}</small></h2>${e.lines.map(lineHtml).join('')}</section>`;
}
