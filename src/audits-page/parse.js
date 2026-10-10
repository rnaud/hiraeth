// The audit reports as data (audits.html, src/audits-page/; built by scripts/audits-data.mjs, tested in
// tests/audits-page.test.js on the real reports). The reports stay the source: docs/audits/<kind>-v<version>.md
// and the cinematics QC report (docs/systems/cinematics-qc.md with its notes, cinematics-qc-notes.json).
//
// Each report starts with a small score block (the skills write it, .claude/skills/*/SKILL.md), an HTML
// comment GitHub doesn't show:
//
//   <!-- audit-scores
//   overall: 3.66 / 5
//   label: the average across the eleven route worlds
//   headline: (a report with no score: what it found, in one line; overall: none)
//   date: 2026-10-09            (optional: the title's date otherwise)
//   version: 1.6                (optional: the file name's otherwise)
//   -->
//
// Everything else is read from the Markdown: the sections (## headings), the score tables (any table with columns
// of 1-5 scores: the criteria, the total or mean, "a → b" and "a ✎b" read as before and after), the findings
// tables' severities, the ranked edits, and the TODO.md sections that name the report.

import { inline, plain, splitRow, toHtml } from './markdown.js';

export const KIND_NAMES = {
  game: 'Game', visual: 'Visual', combat: 'Combat', 'level-design': 'Level design', 'temple-design': 'Temple design',
  dialogue: 'Dialogue', perf: 'Performance', 'ink-lines': 'Ink lines', cinematics: 'Cinematics QC',
};
/** The kinds in the order the page lists them. */
export const KIND_ORDER = Object.keys(KIND_NAMES);
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** A version's parts, to sort by: '0.97' → [0, 97]. */
export const versionKey = (v) => String(v ?? '').split('.').map((n) => +n || 0);
export function compareVersions(a, b) {
  const x = versionKey(a), y = versionKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** The score block's fields ({} without one). */
export function scoreBlock(md) {
  const m = String(md).match(/<!--\s*audit-scores\s*\n([\s\S]*?)-->/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^\s*([a-z]+)\s*:\s*(.*?)\s*$/i);
    if (kv) out[kv[1].toLowerCase()] = kv[2];
  }
  if ('overall' in out) {
    const o = out.overall.match(/^(-?\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?/);
    out.of = o?.[2] ? +o[2] : 5;
    out.overall = o ? +o[1] : null;
  }
  return out;
}

/** A date in a title: 2026-10-09, "8 October 2026" or "October 2026" (→ 2026-10). */
export function titleDate(title) {
  const t = String(title);
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m && MONTHS.includes(m[2].toLowerCase())) return `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = t.match(/([A-Za-z]+)\s+(\d{4})/);
  if (m && MONTHS.includes(m[1].toLowerCase())) return `${m[2]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0')}`;
  return '';
}

/**
 * A cell's score: "3.5", "**3.5**", "2.00 → 1.89" (before 2, now 1.89), "4 ✎3" (the script's 4, 3 by eye),
 * "4 (was 3)", or the criteria and their total in one cell, "4/5/4/5/5 **4.6**" (the total); else null.
 */
export function cellScore(raw) {
  const packed = String(raw ?? '').match(/^\s*\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)+\s+\*\*(\d+(?:\.\d+)?)\*\*\s*$/);
  if (packed) return { value: +packed[1] };
  const t = plain(raw).replace(/\s+/g, ' ');
  const was = t.match(/^(\d+(?:\.\d+)?)\s*\(was (\d+(?:\.\d+)?)\)$/);
  if (was) return { value: +was[1], before: +was[2] };
  const m = t.match(/^(\d+(?:\.\d+)?)(?:\s*(?:→|✎)\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  return m[2] != null ? { value: +m[2], before: +m[1] } : { value: +m[1] };
}

const SCORE_HEADER = /\/\s*5\b/;
const NOT_SCORE = /^#$|\(|\/|ttk|%|^length$|^cuts/i;
const TOTAL = /^(total|mean|overall|score|average)\b/i;

/**
 * A table's shape ({ header, rows, labelCol, scoreCols, primary, before, criteria }): which columns hold 1-5
 * scores, which is the row's total (or the one score), and which are the criteria it is the mean of.
 */
export function readTable(lines, version = '') {
  const header = splitRow(lines[0]).map((h) => plain(h));
  const rows = lines.slice(2).map(splitRow).map((r) => header.map((_, i) => r[i] ?? ''));
  const scoreCols = [];
  header.forEach((h, c) => {
    if (NOT_SCORE.test(h) && !SCORE_HEADER.test(h) && !/^v\d/i.test(h)) return;   // (a version's column is one, whatever it says after)
    const cells = rows.map((r) => r[c]).filter((x) => plain(x) && !/^[—–-]$/.test(plain(x)));
    if (!cells.length) return;
    const scores = cells.map(cellScore);
    if (scores.filter(Boolean).length < Math.max(1, cells.length * 0.8)) return;
    if (scores.some((s) => s && (s.value < 1 || s.value > 5 || (s.before ?? 1) < 1 || (s.before ?? 1) > 5))) return;   // (the rubrics run 1-5: a 0 is a count)
    scoreCols.push(c);
  });
  const labelCol = header.findIndex((h, c) => !scoreCols.includes(c) && h !== '#' && rows.some((r) => plain(r[c]) && !cellScore(r[c])));
  let primary = scoreCols.find((c) => TOTAL.test(header[c]));
  const versioned = scoreCols.filter((c) => /^v\d/i.test(header[c]));
  if (primary == null && versioned.length) primary = versioned.find((c) => header[c].slice(1).split(/\s/)[0] === String(version)) ?? versioned.at(-1);
  if (primary == null && scoreCols.length === 1) primary = scoreCols[0];
  if (primary == null && scoreCols.length) primary = scoreCols.at(-1);
  // the earlier version's column, when a table carries both (the game audit's "v0.97 | v1.0")
  const before = versioned.length > 1 && primary != null ? versioned.filter((c) => c !== primary).at(-1) : null;
  const criteria = TOTAL.test(header[primary] ?? '') ? scoreCols.filter((c) => c !== primary) : scoreCols.filter((c) => c !== primary && c !== before);
  return { header, rows, labelCol: labelCol < 0 ? 0 : labelCol, scoreCols, primary: primary ?? null, before, criteria };
}

const slug = (s) => plain(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

/** What a section is for, by its heading (and whether it holds a score table). */
export function sectionRole(title, hasScores = false) {
  const t = plain(title);
  if (/ranked|recommend|invest|edits|next work|look next|what to do next|^next$/i.test(t)) return 'edits';
  if (hasScores || /^(the )?scores?$/i.test(t) || /^the table$/i.test(t)) return 'scores';
  if (/setup|coverage|about the tool|not (checked|measured)|was not checked|against the last|what happened to|^the script|^size$/i.test(t)) return 'setup';
  return 'findings';
}

/**
 * One report as data.
 * @param md    the Markdown
 * @param o.file  its path from the repository (docs/audits/combat-v1.4.md)
 * @param o.link  (href, { image }) → the href the page uses (scripts/audits-data.mjs: the pictures, the other reports)
 * @param o.depth 2: a section a ## heading; 3: ### too (the cinematics QC report: its passes and table are ###)
 */
export function parseReport(md, { file = '', link = (h) => h, kind: kindIn, version: versionIn, depth = 2 } = {}) {
  const block = scoreBlock(md);
  const base = file.split('/').pop().replace(/\.md$/, '');
  const fm = base.match(/^(.+?)-v(\d+(?:\.\d+)*)$/);
  const kind = kindIn ?? fm?.[1] ?? base;
  const version = block.version ?? versionIn ?? fm?.[2] ?? '';
  const id = fm ? base : `${kind}-v${version}`;
  const lines = String(md).replace(/\r/g, '').split('\n');
  const titleLine = lines.find((l) => /^#\s/.test(l)) ?? `# ${base}`;
  const title = plain(titleLine.replace(/^#\s+/, ''));
  const date = block.date ?? titleDate(title);
  const opts = { link };

  // the sections: what comes before the first ## (the summary), then each ##
  const parts = [{ title: 'Summary', lines: [] }];
  let fence = false;
  for (const l of lines) {
    if (/^\s*```/.test(l)) fence = !fence;
    if (!fence && /^#\s/.test(l)) continue;
    const h = !fence && l.match(/^(#{2,3})\s+(.*)$/);
    if (h && h[1].length <= depth) parts.push({ title: h[2], lines: [] });
    else parts.at(-1).lines.push(l);
  }
  const tables = [];
  const sections = [];
  for (const p of parts) {
    const body = p.lines.join('\n');
    if (!plain(body.replace(/<!--[\s\S]*?-->/g, '')) && p.title === 'Summary') continue;
    const sid = slug(p.title) || `s${sections.length}`;
    // its tables (a table is | rows with a --- line second), and the ### heading each sits under
    let sub = '';
    for (let i = 0; i < p.lines.length; i++) {
      const h3 = p.lines[i].match(/^###+\s+(.*)$/);
      if (h3) sub = plain(h3[1]);
      if (/^\s*\|/.test(p.lines[i]) && /^\s*\|?\s*:?-{2,}/.test(p.lines[i + 1] ?? '')) {
        const t = [];
        while (i < p.lines.length && /^\s*\|/.test(p.lines[i])) t.push(p.lines[i++]);
        const shape = readTable(t, version);
        tables.push({ section: sid, title: plain(p.title) + (sub ? ` · ${sub}` : ''), ...shape });
      }
    }
    const hasScores = tables.some((t) => t.section === sid && t.scoreCols.length);
    const role = p.title === 'Summary' ? 'summary' : sectionRole(p.title, hasScores);
    const edits = role === 'edits' ? countEdits(p.lines) : 0;
    sections.push({ id: sid, title: plain(p.title), titleHtml: inline(p.title, opts), role, html: toHtml(body, opts), edits, pictures: (body.match(/\.(webp|png|jpe?g)\)/gi) ?? []).length });
  }
  // the score tables as the page draws them: each row's label and scores
  const scoreTables = tables.filter((t) => t.scoreCols.length).map((t) => ({
    section: t.section, title: t.title,
    header: t.header, labelCol: t.labelCol, scoreCols: t.scoreCols, primary: t.primary, before: t.before, criteria: t.criteria,
    total: TOTAL.test(t.header[t.primary] ?? ''),   // (the primary column is the row's total or mean of the criteria)
    rows: t.rows.map((r) => ({
      label: plain(r[t.labelCol]),
      id: (r[t.labelCol].match(/`([^`]+)`/) ?? [])[1] ?? slug(r[t.labelCol]),
      cells: r.map((c) => inline(c, opts)),
      scores: Object.fromEntries(t.scoreCols.map((c) => [c, cellScore(r[c])]).filter(([, s]) => s)),
    })),
  }));
  // the findings tables' severities ({ severity: count })
  const severities = {};
  for (const t of tables) {
    const c = t.header.findIndex((h) => /^severity$/i.test(h));
    if (c < 0) continue;
    for (const r of t.rows) { const s = plain(r[c]).toLowerCase(); if (s) severities[s] = (severities[s] ?? 0) + 1; }
  }
  const overall = block.overall ?? null;
  return {
    id, kind, kindName: KIND_NAMES[kind] ?? kind, version, date, title, file,
    overall, of: block.of ?? 5, label: block.label ?? '', headline: block.headline ?? '',
    hasBlock: Object.keys(block).length > 0,
    sections, scoreTables, severities,
    edits: sections.reduce((n, s) => n + s.edits, 0),
    pictures: sections.reduce((n, s) => n + s.pictures, 0),
  };
}

/** How many ranked edits a section lists: its ordered lists' items, top level and under ### / bold headings. */
function countEdits(lines) {
  let n = 0;
  for (const l of lines) if (/^\d+[.)]\s/.test(l)) n++;
  return n;
}

/** A score table's mean of its primary column (the rows' totals). */
export function tableMean(t) {
  const v = t.rows.map((r) => r.scores[t.primary]?.value).filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** The columns to average down a table: its criteria under a total, else every score column (the cinematics' tech and interest). */
export const meanCols = (t) => (t.total || t.before != null ? t.criteria : t.scoreCols);

/** Each criterion's mean across a score table's rows: [{ col, name, mean }]. */
export function criterionMeans(t, cols = meanCols(t)) {
  return cols.map((c) => {
    const v = t.rows.map((r) => r.scores[c]?.value).filter((x) => x != null);
    return { col: c, name: t.header[c], mean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null };
  });
}

/**
 * The TODO.md (or DONE.md) sections that name a report, by its path in their # heading:
 * { [file]: [{ title, source, items: [{ text, html, done }] }] }.
 */
export function todoSections(md, files, { source = 'TODO.md', link = (h) => h } = {}) {
  const out = {};
  const lines = String(md).replace(/\r/g, '').split('\n');
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#\s/.test(l)) {
      const title = l.replace(/^#\s+/, '');
      const hit = files.filter((f) => title.includes(f));
      cur = hit.length ? { title: plain(title), source, items: [], files: hit } : null;
      if (cur) for (const f of hit) (out[f] ??= []).push(cur);
      continue;
    }
    if (!cur) continue;
    const m = l.match(/^[-*]\s+\[( |x)\]\s+(.*)$/i);
    if (m) {
      const text = [m[2]];
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*[-*]\s+\[/.test(lines[i + 1])) text.push(lines[++i].trim());
      const t = text.join(' ');
      cur.items.push({ text: plain(t), html: inline(t, { link }), done: m[1].toLowerCase() === 'x' });
    }
  }
  for (const list of Object.values(out)) for (const s of list) delete s.files;
  return out;
}

/** The cinematics QC notes (cinematics-qc-notes.json) as { id: verdict }, and the verdicts' counts. */
export function cinematicVerdicts(notes) {
  const by = {}, counts = {};
  for (const [id, n] of Object.entries(notes?.notes ?? {})) { if (!n?.verdict) continue; by[id] = n.verdict; counts[n.verdict] = (counts[n.verdict] ?? 0) + 1; }
  return { by, counts };
}

/**
 * The index: every report, newest first, each with the kind's history ({ v, overall } oldest first), the one before
 * it of the same kind and the change since (`delta`, null when either has no score).
 */
export function buildIndex(reports) {
  const byKind = {};
  for (const r of reports) (byKind[r.kind] ??= []).push(r);
  for (const list of Object.values(byKind)) list.sort((a, b) => compareVersions(a.version, b.version));
  return reports.map((r) => {
    const list = byKind[r.kind];
    const i = list.indexOf(r);
    const prev = list[i - 1] ?? null;
    return {
      id: r.id, kind: r.kind, kindName: r.kindName, version: r.version, date: r.date, title: r.title,
      overall: r.overall, of: r.of, label: r.label, headline: r.headline,
      prev: prev?.id ?? null, prevVersion: prev?.version ?? null,
      delta: prev && prev.overall != null && r.overall != null ? Math.round((r.overall - prev.overall) * 100) / 100 : null,
      history: list.slice(0, i + 1).map((x) => ({ v: x.version, overall: x.overall })),
      versions: list.map((x) => x.id),
      edits: r.edits, pictures: r.pictures, todo: r.todo ? { open: r.todo.open, done: r.todo.done } : { open: 0, done: 0 },
    };
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || compareVersions(b.version, a.version));
}

const norm = (s) => plain(s).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Two versions of one kind side by side: the overall change, each matching score table's rows (by label) with
 * their primary score and each shared criterion, before and after, and the findings' severities.
 */
export function compareAudits(a, b) {
  const rows = [];
  for (const tb of b.scoreTables) {
    // the table of the same title in the other report, else the one sharing most row labels
    const labels = new Set(tb.rows.map((r) => norm(r.label)));
    const ta = a.scoreTables.find((t) => norm(t.title) === norm(tb.title))
      ?? a.scoreTables.map((t) => [t, t.rows.filter((r) => labels.has(norm(r.label))).length]).sort((x, y) => y[1] - x[1]).find(([, n]) => n > 0)?.[0];
    if (!ta) continue;
    const crit = tb.criteria.map((c) => [c, ta.criteria.find((k) => norm(ta.header[k]) === norm(tb.header[c]))]).filter(([, k]) => k != null);
    for (const rb of tb.rows) {
      const ra = ta.rows.find((r) => norm(r.label) === norm(rb.label));
      const from = ra?.scores[ta.primary]?.value ?? null, to = rb.scores[tb.primary]?.value ?? null;
      rows.push({
        table: tb.title, label: rb.label, from, to, delta: from != null && to != null ? Math.round((to - from) * 100) / 100 : null,
        criteria: crit.map(([c, k]) => ({ name: tb.header[c], from: ra?.scores[k]?.value ?? null, to: rb.scores[c]?.value ?? null })),
      });
    }
  }
  const sev = [...new Set([...Object.keys(a.severities), ...Object.keys(b.severities)])].map((s) => ({ severity: s, from: a.severities[s] ?? 0, to: b.severities[s] ?? 0 }));
  return {
    from: a.id, to: b.id,
    overall: { from: a.overall, to: b.overall, delta: a.overall != null && b.overall != null ? Math.round((b.overall - a.overall) * 100) / 100 : null },
    rows, severities: sev,
    edits: { from: a.edits, to: b.edits },
  };
}
