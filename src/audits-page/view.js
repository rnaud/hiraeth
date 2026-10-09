// The audits page's screens as HTML, from the data alone (audits.html, src/audits-page/main.js; tested in
// tests/audits-page.test.js): the index of every report, a report's tabs (its scores as tables and bars, its
// findings with their pictures, its ranked edits, the TODO items it produced, the whole report) and the
// comparison of two versions of one kind.

import { esc } from './markdown.js';
import { compareAudits, compareVersions, criterionMeans, KIND_NAMES, KIND_ORDER } from './parse.js';
import { glyph } from '../pad-glyphs.js';

/** A report's tabs, in the order LB / RB go through them. */
export const TABS = [
  { id: 'scores', label: 'Scores' },
  { id: 'findings', label: 'Findings' },
  { id: 'edits', label: 'Edits' },
  { id: 'todo', label: 'TODO' },
  { id: 'report', label: 'Report' },
  { id: 'compare', label: 'Compare' },
];

/** A score as the page prints it: 3.75, 3.7, 4. */
export const fmt = (n) => (n == null ? '—' : String(Math.round(n * 100) / 100));
/** A score's ink class (s1 … s5: the paper's colours from red to green). */
export const tone = (n) => (n == null ? '' : `s${Math.max(1, Math.min(5, Math.round(n)))}`);
const signed = (d) => (d > 0 ? `+${fmt(d)}` : d < 0 ? `−${fmt(-d)}` : '±0');
const arrow = (d) => (d == null ? '' : d > 0 ? '▲' : d < 0 ? '▼' : '◆');

/** The route a hash names: { id: null } the index; { id, tab, other } a report's tab (compare: `other` the version against). */
export function parseRoute(hash = '') {
  const parts = String(hash).replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { id: null, tab: 'scores', other: null };
  const tab = TABS.some((t) => t.id === parts[1]) ? parts[1] : 'scores';
  return { id: parts[0], tab, other: tab === 'compare' ? parts[2] ?? null : null };
}
export function routeHash({ id = null, tab = 'scores', other = null } = {}) {
  if (!id) return '#/';
  return `#/${encodeURIComponent(id)}${tab !== 'scores' ? `/${tab}` : ''}${tab === 'compare' && other ? `/${encodeURIComponent(other)}` : ''}`;
}

/** A small line of a kind's overall scores, oldest to this one (an SVG; one dot when it is the first). */
export function sparkline(history, { w = 84, h = 26, of = 5 } = {}) {
  const pts = history.filter((p) => p.overall != null);
  if (!pts.length) return '';
  const x = (i) => (pts.length === 1 ? w / 2 : 4 + (i * (w - 8)) / (pts.length - 1));
  const y = (v) => h - 3 - (v / of) * (h - 6);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.overall).toFixed(1)}`).join(' ');
  const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.overall).toFixed(1)}" r="${i === pts.length - 1 ? 3 : 2}"><title>v${esc(p.v)}: ${fmt(p.overall)}</title></circle>`).join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><line x1="0" x2="${w}" y1="${y(of / 2 + 0.5)}" y2="${y(of / 2 + 0.5)}" class="mid"/>${pts.length > 1 ? `<path d="${line}"/>` : ''}${dots}</svg>`;
}

/** The change since the version before, as a badge. */
export function deltaBadge(e) {
  if (!e.prev) return `<span class="delta first">the first ${esc((KIND_NAMES[e.kind] ?? e.kind).toLowerCase())} audit</span>`;
  if (e.delta == null) return `<span class="delta none">after v${esc(e.prevVersion)}</span>`;
  const cls = e.delta > 0 ? 'up' : e.delta < 0 ? 'down' : 'same';
  return `<span class="delta ${cls}">${arrow(e.delta)} ${signed(e.delta)} <small>since v${esc(e.prevVersion)}</small></span>`;
}

/** The kinds to filter by (those with a report), 'all' first. */
export function kindsOf(index) {
  const used = new Set(index.map((e) => e.kind));
  return ['all', ...KIND_ORDER.filter((k) => used.has(k)), ...[...used].filter((k) => !KIND_ORDER.includes(k))];
}

/** A small strip of bars: the first score table's criteria (or rows) as thin columns. */
export function miniBars(report) {
  const t = report?.scoreTables?.[0];
  if (!t) return '';
  const means = criterionMeans(t);
  const vals = means.length >= 3 ? means.map((c) => ({ name: c.name, v: c.mean })) : t.rows.map((r) => ({ name: r.label, v: r.scores[t.primary]?.value }));
  const list = vals.filter((x) => x.v != null).slice(0, 60);
  if (!list.length) return '';
  return `<div class="mini" aria-hidden="true">${list.map((x) => `<i class="${tone(x.v)}" style="height:${Math.round((x.v / 5) * 100)}%" title="${esc(x.name)}: ${fmt(x.v)}"></i>`).join('')}</div>`;
}

/** One report's card in the index (focusable, data-nav: the pad moves across the grid, A opens it). */
export function cardHtml(e, report) {
  const score = e.overall != null
    ? `<div class="big ${tone(e.overall)}">${fmt(e.overall)}<small> / ${e.of}</small></div>`
    : `<div class="big none">no score</div>`;
  const todo = e.todo.open || e.todo.done ? `TODO ${e.todo.open} open${e.todo.done ? `, ${e.todo.done} done` : ''}` : 'no TODO section';
  return `<article class="card" data-id="${esc(e.id)}" data-kind="${esc(e.kind)}" tabindex="0" data-nav>
    <div class="meta"><b>${esc(e.kindName)}</b> · <span class="v">v${esc(e.version)}</span> · ${esc(e.date)}</div>
    <div class="row">${score}${sparkline(e.history, { of: e.of })}</div>
    ${deltaBadge(e)}
    <p class="label">${esc(e.overall != null ? e.label : e.headline)}</p>
    ${miniBars(report)}
    <div class="foot">${e.edits ? `${e.edits} edits · ` : ''}${e.pictures ? `${e.pictures} pictures · ` : ''}${todo}${glyph('ok', { focus: true })}</div>
  </article>`;
}

/** The index: the cards of a kind (or all), newest first. */
export function indexHtml(index, reports, kind = 'all') {
  const list = index.filter((e) => kind === 'all' || e.kind === kind);
  return list.map((e) => cardHtml(e, reports.find((r) => r.id === e.id))).join('') || '<p class="empty">No audit of this kind yet.</p>';
}

/** The kind chips, LB / RB at either end. */
export function kindChips(index, kind = 'all') {
  const kinds = kindsOf(index);
  const n = (k) => index.filter((e) => k === 'all' || e.kind === k).length;
  return `<span class="glyph" data-glyph="lb" aria-hidden="true"></span>${kinds.map((k) => `<button class="chip" data-kind="${esc(k)}" aria-pressed="${k === kind}">${esc(k === 'all' ? 'All' : KIND_NAMES[k] ?? k)} <small>${n(k)}</small></button>`).join('')}<span class="glyph end" data-glyph="rb" aria-hidden="true"></span>`;
}

/** A report's tab bar, LB / RB at either end. */
export function tabsHtml(report, tab) {
  const count = { findings: report.sections.filter((s) => s.role === 'findings').length, edits: report.edits, todo: report.todo?.open ?? 0, scores: report.scoreTables.length };
  return `<span class="glyph" data-glyph="lb" aria-hidden="true"></span>${TABS.map((t) => `<button class="tab" data-tab="${t.id}" aria-selected="${t.id === tab}" role="tab">${t.label}${count[t.id] ? ` <small>${count[t.id]}</small>` : ''}</button>`).join('')}<span class="glyph end" data-glyph="rb" aria-hidden="true"></span>`;
}

/** A bar of a 1-5 score, with the earlier score as a ghost under it. */
export function bar(v, before = null, of = 5) {
  if (v == null) return '';
  const ghost = before != null && before !== v ? `<i class="ghost" style="width:${((before / of) * 100).toFixed(1)}%"></i>` : '';
  return `<span class="bar">${ghost}<i class="${tone(v)}" style="width:${((v / of) * 100).toFixed(1)}%"></i></span>`;
}

/** Each criterion's mean as a small bar chart. */
export function criteriaChart(t) {
  const means = criterionMeans(t).filter((c) => c.mean != null);
  if (!means.length || (means.length === 1 && means[0].col === t.primary)) return '';   // (one score: the overall says it)
  return `<div class="chart"><h4>${t.total ? 'By criterion' : 'Means'} <small>(the mean of ${t.rows.length})</small></h4>${means.map((c) => `<div class="hbar"><span class="name">${esc(c.name)}</span>${bar(c.mean)}<b>${fmt(c.mean)}</b></div>`).join('')}</div>`;
}

/** The rows ranked by their primary score as a bar chart (worst first, as the reports rank). */
export function rowsChart(t) {
  const rows = t.rows.filter((r) => r.scores[t.primary]);
  if (rows.length < 2 || rows.length > 40) return '';
  const sorted = [...rows].sort((a, b) => a.scores[t.primary].value - b.scores[t.primary].value);
  const before = (r) => r.scores[t.primary].before ?? (t.before != null ? r.scores[t.before]?.value : null);
  return `<div class="chart"><h4>${esc(t.header[t.primary])} <small>(worst first${t.before != null ? `; the ghost: ${esc(t.header[t.before])}` : rows.some((r) => r.scores[t.primary].before != null) ? '; the ghost: before the edit by eye' : ''})</small></h4>${sorted.map((r) => `<div class="hbar"><span class="name" title="${esc(r.label)}">${esc(r.label)}</span>${bar(r.scores[t.primary].value, before(r))}<b>${fmt(r.scores[t.primary].value)}</b></div>`).join('')}</div>`;
}

/** A score table: every column, the score cells inked by their value, the primary one with its bar. */
export function scoreTableHtml(t, { verdicts = false } = {}) {
  const head = t.header.map((h, c) => `<th class="${t.scoreCols.includes(c) ? 'num' : ''}${c === t.primary ? ' primary' : ''}">${esc(h)}</th>`).join('') + (verdicts ? '<th>Verdict</th>' : '');
  const body = t.rows.map((r) => `<tr>${r.cells.map((cell, c) => {
    const s = r.scores[c];
    if (!s) return `<td>${cell}</td>`;
    return `<td class="num ${tone(s.value)}${c === t.primary ? ' primary' : ''}">${s.before != null ? `<s>${fmt(s.before)}</s> ` : ''}<b>${fmt(s.value)}</b>${c === t.primary ? bar(s.value, s.before) : ''}</td>`;
  }).join('')}${verdicts ? `<td class="verdict ${r.verdict === 'Pass' ? 'ok' : 'bad'}">${esc(r.verdict ?? '')}</td>` : ''}</tr>`).join('');
  return `<div class="table scroll" tabindex="0" data-nav><table class="scores"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** The Scores tab: the overall, the summary, then each score table with its charts. */
export function scoresHtml(report, entry) {
  const overall = report.overall != null
    ? `<div class="overall"><div class="big ${tone(report.overall)}">${fmt(report.overall)}<small> / ${report.of}</small></div><div><p>${esc(report.label)}</p>${entry ? deltaBadge(entry) : ''}</div></div>`
    : `<div class="overall"><div class="big none">no score</div><div><p>${esc(report.headline)}</p>${entry ? deltaBadge(entry) : ''}</div></div>`;
  const sev = Object.entries(report.severities ?? {});
  const sevHtml = sev.length ? `<div class="chart"><h4>Findings by severity</h4>${sev.map(([s, n]) => `<div class="hbar"><span class="name">${esc(s)}</span><span class="bar"><i class="sev" style="width:${Math.min(100, n * 20)}%"></i></span><b>${n}</b></div>`).join('')}</div>` : '';
  const verdicts = report.verdicts ? `<div class="chart"><h4>Verdicts <small>(the review page's notes)</small></h4>${Object.entries(report.verdicts).map(([v, n]) => `<div class="hbar"><span class="name">${esc(v)}</span><span class="bar"><i class="${v === 'Pass' ? 's5' : 's2'}" style="width:${((n / Object.values(report.verdicts).reduce((a, b) => a + b, 0)) * 100).toFixed(1)}%"></i></span><b>${n}</b></div>`).join('')}</div>` : '';
  const summary = report.sections.find((s) => s.role === 'summary');
  const tables = report.scoreTables.map((t) => `<section class="block" data-section="${esc(t.section)}">
      <h3>${esc(t.title)}</h3>
      <div class="charts">${rowsChart(t)}${criteriaChart(t)}</div>
      ${scoreTableHtml(t, { verdicts: !!report.verdicts })}
    </section>`).join('');
  return `${overall}<div class="charts">${sevHtml}${verdicts}</div>${tables || '<p class="empty">This report has no score table: its findings are in the Findings tab.</p>'}${summary ? `<details class="sec summary"${report.scoreTables.length ? '' : ' open'}><summary data-nav>The report’s opening: what it set out to do, and its verdict</summary>${summary.html}</details>` : ''}`;
}

/** Some of a report's sections, each a focusable block (the pad steps through them; the stick scrolls). */
export function sectionsHtml(sections) {
  return sections.map((s) => `<section class="sec" id="sec-${esc(s.id)}" tabindex="0" data-nav><h2>${s.titleHtml}</h2>${s.html}</section>`).join('');
}

/** The Report tab: a contents line, then every section. */
export function reportHtml(report) {
  const list = report.sections;
  const toc = `<nav class="toc">${list.map((s) => `<button class="chip" data-jump="sec-${esc(s.id)}">${esc(s.title)}</button>`).join('')}</nav>`;
  return `${toc}${sectionsHtml(list)}<p class="source">From <code>${esc(report.file)}</code>.</p>`;
}

/** The TODO tab: the items of the TODO.md (and DONE.md) sections that name the report. */
export function todoHtml(report) {
  const secs = report.todo?.sections ?? [];
  if (!secs.length) return `<p class="empty">No section of TODO.md names <code>${esc(report.file)}</code>: its edits went nowhere yet, or they were written elsewhere.</p>`;
  return secs.map((s) => `<section class="sec todo" tabindex="0" data-nav><h2>${esc(s.title)} <small>${esc(s.source)} · ${s.items.filter((i) => !i.done).length} open${s.items.some((i) => i.done) ? `, ${s.items.filter((i) => i.done).length} done` : ''}</small></h2>
    <ul>${s.items.map((i) => `<li class="task${i.done ? ' done' : ''}"><span class="check${i.done ? ' done' : ''}">${i.done ? '✓' : ''}</span>${i.html}</li>`).join('')}</ul></section>`).join('');
}

/** The tab's content. */
export function tabHtml(report, tab, { entry = null, reports = [], other = null } = {}) {
  if (tab === 'scores') return scoresHtml(report, entry);
  if (tab === 'findings') {
    const s = report.sections.filter((x) => x.role === 'findings');
    return s.length ? sectionsHtml(s) : '<p class="empty">No findings section.</p>';
  }
  if (tab === 'edits') {
    const s = report.sections.filter((x) => x.role === 'edits');
    return s.length ? sectionsHtml(s) : '<p class="empty">This report ranks no edits.</p>';
  }
  if (tab === 'todo') return todoHtml(report);
  if (tab === 'report') return reportHtml(report);
  return compareHtml(report, reports, other);
}

/** The versions to compare a report with: the others of its kind, oldest first. */
export function siblings(report, reports) {
  return reports.filter((r) => r.kind === report.kind).sort((a, b) => compareVersions(a.version, b.version));
}

/** The Compare tab: two versions of the report's kind (from: `other`, else the one before; to: this one). */
export function compareHtml(report, reports, otherId = null) {
  const all = siblings(report, reports);
  if (all.length < 2) return `<p class="empty">Only one ${esc(report.kindName.toLowerCase())} audit so far (v${esc(report.version)}): the next one will be compared with it here.</p>`;
  const i = all.indexOf(report);
  let from = all.find((r) => r.id === otherId && r !== report) ?? all[i - 1] ?? all[i + 1];
  let to = report;
  if (all.indexOf(from) > all.indexOf(to)) [from, to] = [to, from];
  const c = compareAudits(from, to);
  const pick = all.map((r) => `<button class="chip" data-compare="${esc(r.id)}" aria-pressed="${r === from || r === to}"${r === report ? ' disabled title="the report open"' : ''}>v${esc(r.version)}</button>`).join('');
  const d = c.overall.delta;
  const head = `<div class="overall"><div class="big ${tone(c.overall.from)}">${fmt(c.overall.from)}</div><div class="arrow">→</div><div class="big ${tone(c.overall.to)}">${fmt(c.overall.to)}</div>${d != null ? `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'same'}">${arrow(d)} ${signed(d)}</span>` : ''}<p>v${esc(from.version)} (${esc(from.date)}) → v${esc(to.version)} (${esc(to.date)})</p></div>`;
  const rows = c.rows.length ? `<div class="table scroll" tabindex="0" data-nav><table class="scores compare"><thead><tr><th></th><th class="num">v${esc(from.version)}</th><th class="num">v${esc(to.version)}</th><th class="num">change</th><th></th></tr></thead><tbody>${c.rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="num ${tone(r.from)}">${fmt(r.from)}</td><td class="num ${tone(r.to)}">${fmt(r.to)}</td><td class="num delta ${r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'same'}">${r.delta == null ? '' : `${arrow(r.delta)} ${signed(r.delta)}`}</td><td class="pair">${bar(r.to, r.from)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No score table in common.</p>';
  const sev = c.severities.length ? `<div class="chart"><h4>Findings by severity</h4>${c.severities.map((s) => `<div class="hbar"><span class="name">${esc(s.severity)}</span><b>${s.from} → ${s.to}</b></div>`).join('')}</div>` : '';
  return `<div class="pickers"><span>Versions:</span>${pick}<small>(the one open is fixed; pick the other)</small></div>${head}<div class="charts">${sev}<div class="chart"><h4>Ranked edits</h4><div class="hbar"><span class="name">listed</span><b>${c.edits.from} → ${c.edits.to}</b></div></div></div>${rows}`;
}
