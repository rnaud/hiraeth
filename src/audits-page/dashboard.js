// The audits page's default view as HTML (audits.html, src/audits-page/main.js; tested in
// tests/audits-page-themes.test.js): a card per theme with its latest report alone, the headline score, the
// change since the one before, its items (per world, per temple, per archetype …) in a compact table with their
// own changes, a link to the full report, and the theme's earlier versions behind a History toggle.
// The data: src/audits-page/themes.js latestByTheme.

import { esc } from './markdown.js';
import { fmt, tone } from './view.js';
import { glyph } from '../pad-glyphs.js';

const signed = (d) => (d > 0 ? `+${fmt(d)}` : d < 0 ? `−${fmt(-d)}` : '±0');
const arrow = (d) => (d > 0 ? '▲' : d < 0 ? '▼' : '◆');
/** A change's ink: good or bad by which way the theme's numbers should go. */
const way = (d, better = 'higher') => (d == null || d === 0 ? 'same' : (d > 0) === (better !== 'lower') ? 'up' : 'down');
const STATUS = { ok: 'within', over: 'over', unmeasured: 'not measured' };

/** The views the header switches between (LB / RB on the dashboard). */
export const VIEWS = [{ id: 'latest', label: 'Latest' }, { id: 'all', label: 'All audits' }];

/** The view tabs, LB / RB at either end (the "All audits" tab with how many reports there are). */
export function viewTabs(view = 'latest', count = 0, { glyphs = true } = {}) {
  const tabs = VIEWS.map((v) => `<button class="tab" data-view="${v.id}" aria-selected="${v.id === view}" role="tab">${v.label}${v.id === 'all' && count ? ` <small>${count}</small>` : ''}</button>`).join('');
  return glyphs ? `<span class="glyph" data-glyph="lb" aria-hidden="true"></span>${tabs}<span class="glyph end" data-glyph="rb" aria-hidden="true"></span>` : tabs;
}

/** The change of the theme's overall score, as a badge. */
export function themeDelta(t) {
  if (!t.prev) return `<span class="delta first">the first ${esc(t.name.toLowerCase())} audit</span>`;
  if (t.delta == null) return `<span class="delta none">after v${esc(t.prev.version)}</span>`;
  return `<span class="delta ${way(t.delta)}">${arrow(t.delta)} ${signed(t.delta)} <small>since v${esc(t.prev.version)}</small></span>`;
}

/** One item's change, small: ▲0.2 (nothing when it held, or had nothing to compare with). */
function itemChange(r, g) {
  if (g.type === 'status') return r.from && r.from !== r.status ? `<i class="d ${r.status === 'ok' ? 'up' : 'down'}" title="v${esc(r.fromVersion)}: ${esc(STATUS[r.from] ?? r.from)}">was ${esc(STATUS[r.from] ?? r.from)}</i>` : '<i class="d"></i>';
  if (r.delta == null || r.delta === 0) return `<i class="d"${r.delta === 0 ? ` title="the same as at v${esc(r.fromVersion)}"` : ''}></i>`;
  return `<i class="d ${way(r.delta, g.better)}" title="v${esc(r.fromVersion)}: ${fmt(r.from)}">${arrow(r.delta)}${fmt(Math.abs(r.delta))}</i>`;
}

/** An item's value cell. */
function itemValue(r, g) {
  if (g.type === 'score') return `<b class="v ${tone(r.value)}">${fmt(r.value)}</b>`;
  if (g.type === 'count') return `<b class="v ${r.value ? 'c-bad' : 'c-ok'}">${r.value}</b>`;
  if (g.type === 'status') return `<b class="v st ${r.status}">${r.value != null ? r.value : esc(STATUS[r.status] ?? r.status)}</b>`;
  return `<b class="v m">${esc(r.text ?? '')}</b>`;
}

/** An item's name on the card: without its (…) aside (the full name is the tooltip). */
export const shortLabel = (label) => String(label ?? '').replace(/\s*\([^)]*\)/g, '').trim() || String(label ?? '');

/** A group of items as a compact table: name, value, change (worst first for scores: as the reports rank). */
export function groupHtml(g) {
  if (!g.rows.length) return '';
  const scored = g.rows.filter((r) => r.value != null);
  const worst = g.type === 'score' && scored.length ? scored.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const note = g.type === 'score' ? `${g.rows.length}${worst ? ` · lowest ${fmt(worst.value)}` : ''}` : `${g.rows.length}`;
  const cls = g.type === 'status' ? ' long' : g.type === 'measure' ? ' measure' : '';
  return `<div class="group"><h4>${esc(g.title)} <small>${note}</small></h4><div class="items${cls}">${g.rows.map((r) => `<div class="it" title="${esc(r.label)}${r.text && g.type === 'status' ? `: ${esc(r.text)}` : ''}"><span class="n">${esc(shortLabel(r.label))}</span>${itemValue(r, g)}${itemChange(r, g)}</div>`).join('')}</div></div>`;
}

/**
 * A theme's overall scores as a trend line, scaled to their own range (a sparkline from 0 to 5 is flat: the
 * audits move by tenths), each version a dot with its number under it. '' with fewer than two scores.
 */
export function trendHtml(history, { w = 300, h = 64 } = {}) {
  const pts = history.filter((p) => p.overall != null);
  if (pts.length < 2) return '';
  const vals = pts.map((p) => p.overall);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 0.2) { lo -= 0.1; hi += 0.1; }
  const pad = { l: 30, r: 10, t: 8, b: 16 };
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (pts.length - 1);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.overall).toFixed(1)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.overall).toFixed(1)}" r="${i === pts.length - 1 ? 3.5 : 2.5}"><title>v${esc(p.version)}: ${fmt(p.overall)}</title></circle><text x="${x(i).toFixed(1)}" y="${h - 3}" text-anchor="middle">${esc(p.version)}</text>`).join('');
  return `<svg class="trend-line" viewBox="0 0 ${w} ${h}" role="img" aria-label="Overall score by version, ${fmt(vals[0])} to ${fmt(vals.at(-1))}"><text x="${pad.l - 4}" y="${y(hi) + 3}" text-anchor="end">${fmt(hi)}</text><text x="${pad.l - 4}" y="${y(lo) + 3}" text-anchor="end">${fmt(lo)}</text><line x1="${pad.l}" x2="${w - pad.r}" y1="${y(lo)}" y2="${y(lo)}" class="base"/><path d="${path}"/>${dots}</svg>`;
}

/** The theme's earlier versions: a trend line and the list, newest first, each opening its report. */
export function historyHtml(t, open = false) {
  const rows = [...t.history].reverse();
  const line = trendHtml(t.history);
  return `<div class="history" id="hist-${esc(t.kind)}"${open ? '' : ' hidden'}>${line ? `<div class="trend">${line}</div>` : ''}<ol>${rows.map((h, i) => `<li><a class="hist-row" href="#/${encodeURIComponent(h.id)}" data-open="${esc(h.id)}"><span class="hv">v${esc(h.version)}</span><span class="hd">${esc(h.date)}</span>${h.overall != null ? `<b class="tint ${tone(h.overall)}">${fmt(h.overall)}</b>` : `${h.figure ? `<b>${esc(h.figure.text)}</b>` : ''}<span class="hh" title="${esc(h.headline)}">${esc(h.headline)}</span>`}${h.delta != null ? `<i class="d ${way(h.delta)}">${arrow(h.delta)}${fmt(Math.abs(h.delta))}</i>` : h.overall != null ? '<i class="d"></i>' : ''}${i === 0 ? '<small>latest</small>' : ''}</a></li>`).join('')}</ol></div>`;
}

/** One theme's card. */
export function themeCard(t, { open = false } = {}) {
  const r = t.latest;
  const fig = r.overall != null
    ? `<div class="big ${tone(r.overall)}">${fmt(r.overall)}<small> / ${r.of}</small></div>`
    : r.theme?.figure ? `<div class="big fig">${esc(r.theme.figure.text)}<small> ${esc(r.theme.figure.sub)}</small></div>` : '<div class="big none">no score</div>';
  const items = (t.groups ?? []).reduce((n, g) => n + g.rows.length, 0);
  const n = t.history.length;
  return `<article class="theme${items > 14 ? ' wide' : ''}" data-kind="${esc(t.kind)}">
  <a class="theme-open" href="#/${encodeURIComponent(r.id)}" data-open="${esc(r.id)}" title="Open the ${esc(t.name.toLowerCase())} audit v${esc(r.version)}">
    <div class="meta"><b>${esc(t.name)}</b> · <span class="v">v${esc(r.version)}</span> · ${esc(r.date)}</div>
    <div class="row">${fig}${themeDelta(t)}</div>
    <p class="label">${esc(r.overall != null ? r.label : r.headline)}</p>
    ${(t.groups ?? []).map(groupHtml).join('')}
    <div class="foot"><span>Open the full audit ▶</span>${glyph('ok', { focus: true })}</div>
  </a>
  ${n > 1 ? `<button class="hist-toggle" data-history="${esc(t.kind)}" aria-expanded="${open}" aria-controls="hist-${esc(t.kind)}">${glyph('y', { key: 'H' })}History <small>${n} audits</small><span class="caret" aria-hidden="true">${open ? '▴' : '▾'}</span></button>${historyHtml(t, open)}` : '<p class="only">The only one so far.</p>'}
</article>`;
}

/** The dashboard: every theme's card, in the themes' order. */
export function dashboardHtml(themes, { open = new Set() } = {}) {
  return themes.map((t) => themeCard(t, { open: open.has(t.kind) })).join('') || '<p class="empty">No audit yet.</p>';
}
