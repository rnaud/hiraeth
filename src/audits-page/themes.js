// The audits page's dashboard as data (audits.html's default view, src/audits-page/dashboard.js; tested in
// tests/audits-page-themes.test.js on the real reports): each theme (a kind of audit) read down to what its card
// shows, by a small parser per kind, and the latest report of every theme with the change since the one before.
//
// The parsers run at build time beside the report parser (scripts/audits-data.mjs: `report.theme`), with the
// Markdown in hand, so a kind whose items are not 1-5 scores (the performance budgets, the visual audit's
// findings by severity, the temple visuals' frame times) is read as well:
//
//   theme = { figure: { text, sub } | null,          the big number for a report with no overall score
//             groups: [{ title, type, better, rows: [{ key, alt, label, value, text, status }] }] }
//
// type 'score': 1-5 (value), 'count': findings (value; fewer is better), 'status': ok / over / unmeasured,
// 'measure': a measurement as written (text).

import { plain } from './markdown.js';
import { compareVersions, KIND_NAMES, readTable } from './parse.js';

/** The dashboard's order: the full game audit, then the rest roughly by how much of the game they judge. */
export const THEME_ORDER = ['game', 'combat', 'level-design', 'temple-design', 'visual', 'temple-visuals', 'ink-lines', 'cinematics', 'dialogue', 'perf'];

const round2 = (n) => Math.round(n * 100) / 100;
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

/** A row's name as the versions are matched by: lower case, no "the", no (…) aside; `alt` the aside (an id: "(arzach2)"). */
export function itemKey(label) {
  const t = plain(label);
  const aside = (t.match(/\(([^)]*)\)/) ?? [])[1] ?? '';
  const norm = (s) => s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return { key: norm(t.replace(/\([^)]*\)/g, ' ')), alt: /^[a-z0-9_.-]+$/i.test(aside.trim()) ? norm(aside) : '' };
}

/** Every table of a Markdown report with the heading it sits under: [{ heading, ...readTable }]. */
export function tablesOf(md) {
  const lines = String(md ?? '').replace(/\r/g, '').split('\n');
  const out = [];
  let heading = '', fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) fence = !fence;
    if (fence) continue;
    const h = lines[i].match(/^#{2,4}\s+(.*)$/);
    if (h) heading = plain(h[1]);
    if (/^\s*\|/.test(lines[i]) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      const t = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) t.push(lines[i++]);
      out.push({ heading, ...readTable(t) });
    }
  }
  return out;
}

const scoreRow = (label, value, extra = {}) => ({ ...itemKey(label), label: plain(label), value: value == null ? null : round2(value), ...extra });

/** A score table's rows as items: their primary score (or, with `rowMean`, the mean of every score column). */
function tableItems(t, { rowMean = false } = {}) {
  return t.rows.map((r) => {
    const v = rowMean ? mean(t.scoreCols.map((c) => r.scores[c]?.value).filter((x) => x != null)) : r.scores[t.primary]?.value;
    return scoreRow(r.label, v);
  }).filter((r) => r.label && r.value != null);
}

/** The table a kind's card shows: the biggest score table whose primary column is a total (the first on a tie). */
export function mainTable(report, test = () => true) {
  const list = report.scoreTables.filter((t) => t.rows.length && test(t));
  const totals = list.filter((t) => t.total);
  const pool = totals.length ? totals : list;
  return pool.reduce((best, t) => (!best || t.rows.length > best.rows.length ? t : best), null);
}

/** The first "N of M" in a headline, as the card's big figure and the word after it (11 of 11 temples given … → 11/11 temples). */
export function headlineFigure(headline) {
  const m = String(headline ?? '').match(/(\d+)\s+of\s+(\d+)\s+([^,;(]+)/);
  return m ? { text: `${m[1]}/${m[2]}`, sub: m[3].trim().split(/\s+/)[0] } : null;
}

/** The visual audit's headline counts: "0 breaks the picture, 2 noticeable, 1 only when looking; …". */
export function severityCounts(headline) {
  const first = String(headline ?? '').split(';')[0];
  return [...first.matchAll(/(\d+)\s+([^,;\d]+)/g)].map((m) => ({ label: m[2].replace(/\([^)]*\)/g, '').trim(), value: +m[1] })).filter((x) => x.label);
}

/** A budget's verdict from its result cell: **Over** …, Not measured …, else within. */
export function budgetStatus(result) {
  const t = plain(result).trim();
  if (/^over\b/i.test(t)) return 'over';
  if (/not measured|unmeasured/i.test(t)) return 'unmeasured';
  return 'ok';
}

const scoreGroup = (title, rows) => ({ title, type: 'score', better: 'higher', rows });

/** The parsers, a kind each: (report, tables) → theme. */
export const PARSERS = {
  // the archetypes (the table by kind) and the guardians, each the biggest of its label
  combat(report) {
    const byLabel = (re) => mainTable(report, (t) => re.test(t.header[t.labelCol] ?? ''));
    const groups = [];
    const foes = byLabel(/^kind$/i), guardians = byLabel(/^guardian/i);
    if (foes) groups.push(scoreGroup('Archetypes', tableItems(foes)));
    if (guardians) groups.push(scoreGroup('Guardians', tableItems(guardians)));
    return { figure: null, groups };
  },
  // the twelve themes of the whole game
  game(report) {
    const t = mainTable(report, (x) => /theme/i.test(x.header[x.labelCol] ?? '')) ?? mainTable(report);
    return { figure: null, groups: t ? [scoreGroup('Themes', tableItems(t))] : [] };
  },
  'level-design': (report) => byMain(report, 'Worlds'),
  'temple-design': (report) => byMain(report, 'Temples'),
  dialogue: (report) => byMain(report, 'Areas'),
  // a scene's mean across the resolutions it was drawn at
  'ink-lines'(report) {
    const t = mainTable(report);
    return { figure: null, groups: t ? [scoreGroup('Scenes', tableItems(t, { rowMean: true }))] : [] };
  },
  // the cinematics by world (the id before its dot), each the mean of tech and interest; the review page's verdicts
  cinematics(report) {
    const t = report.scoreTables.reduce((b, x) => (!b || x.rows.length > b.rows.length ? x : b), null);
    if (!t) return { figure: null, groups: [] };
    const by = new Map();
    for (const r of t.rows) {
      const v = mean(t.scoreCols.map((c) => r.scores[c]?.value).filter((x) => x != null));
      if (v == null) continue;
      const w = String(r.id || r.label).split(/[.\s·]/)[0];
      if (!by.has(w)) by.set(w, []);
      by.get(w).push(v);
    }
    const groups = [scoreGroup('By world', [...by].map(([w, v]) => scoreRow(w, mean(v), { text: `${v.length}` })))];
    if (report.verdicts) groups.push({ title: 'Verdicts', type: 'status', better: 'higher', rows: Object.entries(report.verdicts).map(([v, n]) => ({ ...itemKey(v), label: v, value: n, status: /pass/i.test(v) ? 'ok' : 'over' })) });
    return { figure: null, groups };
  },
  // no score: its findings by severity (fewer is better)
  visual(report) {
    let rows = severityCounts(report.headline);
    if (!rows.length) rows = Object.entries(report.severities ?? {}).map(([label, value]) => ({ label, value }));
    const total = rows.reduce((n, r) => n + r.value, 0);
    return {
      figure: rows.length ? { text: String(total), sub: total === 1 ? 'finding' : 'findings' } : headlineFigure(report.headline),
      groups: rows.length ? [{ title: 'Findings by severity', type: 'count', better: 'lower', rows: rows.map((r) => ({ ...itemKey(r.label), label: r.label, value: r.value })) }] : [],
    };
  },
  // no score: the budgets table, each budget over, within or not measured
  perf(report, tables) {
    const t = tables.find((x) => /^budget/i.test(x.header[0] ?? ''));
    const resCol = t ? Math.max(1, t.header.findIndex((h) => /result/i.test(h))) : -1;
    const rows = t ? t.rows.map((r) => ({ ...itemKey(r[0]), label: plain(r[0]), status: budgetStatus(r[resCol]), text: plain(r[resCol]) })) : [];
    const over = rows.filter((r) => r.status === 'over').length;
    return {
      figure: rows.length ? { text: `${over}/${rows.length}`, sub: 'budgets over' } : headlineFigure(report.headline),
      groups: rows.length ? [{ title: 'Budgets', type: 'status', better: 'lower', rows }] : [],
    };
  },
  // no score: the frame times before and after, as written
  'temple-visuals'(report, tables) {
    const t = tables.find((x) => x.header.some((h) => /ms/.test(h) && /→|before/.test(h)));
    const c = t ? t.header.findIndex((h) => /ms/.test(h)) : -1;
    const preset = t ? t.header.findIndex((h) => /preset/i.test(h)) : -1;
    const rows = t ? t.rows.map((r) => {
      const label = plain(r[0]) + (preset >= 0 ? ` · ${plain(r[preset])}` : '');
      return { ...itemKey(label), label, text: `${plain(r[c])} ms` };
    }) : [];
    return { figure: headlineFigure(report.headline), groups: rows.length ? [{ title: 'Frame time', type: 'measure', better: 'lower', rows }] : [] };
  },
};

function byMain(report, title) {
  const t = mainTable(report);
  return { figure: null, groups: t ? [scoreGroup(title, tableItems(t))] : [] };
}

/** A report's theme (a kind with no parser of its own: its main score table, or its headline's "N of M"). */
export function themeOf(report, md = '') {
  const parser = PARSERS[report.kind];
  const theme = parser ? parser(report, tablesOf(md)) : byMain(report, 'Items');
  if (!theme.figure && report.overall == null) theme.figure = headlineFigure(report.headline);
  return theme;
}

/** A theme's display name. */
export const themeName = (kind) => KIND_NAMES[kind] ?? kind.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/**
 * Each row's change since the theme's earlier reports: the newest earlier report holding a row of the same name
 * (a batch audit judges some archetypes only: each is compared with the last time it was judged).
 * Returns the groups with `from`, `fromVersion` and `delta` on each row that has one.
 */
export function itemDeltas(groups, earlier) {
  const match = (row, g) => g.rows.find((x) => x.key === row.key || (row.alt && (x.alt === row.alt || x.key === row.alt)));
  return groups.map((g) => ({
    ...g,
    rows: g.rows.map((row) => {
      if (g.type === 'measure' || (row.value == null && !row.status)) return row;
      for (const r of earlier) {
        const og = (r.theme?.groups ?? []).find((x) => x.type === g.type && x.title === g.title) ?? (r.theme?.groups ?? []).find((x) => x.type === g.type);
        const hit = og && match(row, og);
        if (!hit) continue;
        if (g.type === 'status') return { ...row, from: hit.status ?? null, fromVersion: r.version, delta: null };
        if (hit.value == null) continue;
        return { ...row, from: hit.value, fromVersion: r.version, delta: round2(row.value - hit.value) };
      }
      return row;
    }),
  }));
}

/**
 * The dashboard: one entry per theme, its latest report (the highest version; the later date on a tie), the
 * change since the last earlier report with an overall score, every version oldest first, and the latest's
 * items with their changes.
 *   [{ kind, name, latest, prev, delta, history: [{ id, version, date, overall, headline, figure, delta }], groups }]
 */
export function latestByTheme(reports) {
  const byKind = new Map();
  for (const r of reports) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, []);
    byKind.get(r.kind).push(r);
  }
  const order = (k) => (THEME_ORDER.includes(k) ? THEME_ORDER.indexOf(k) : THEME_ORDER.length);
  return [...byKind].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b)).map(([kind, list]) => {
    const sorted = [...list].sort((a, b) => compareVersions(a.version, b.version) || (a.date || '').localeCompare(b.date || ''));
    const latest = sorted.at(-1);
    const earlier = sorted.slice(0, -1).reverse();
    const prev = latest.overall != null ? earlier.find((r) => r.overall != null) ?? null : earlier[0] ?? null;
    const history = sorted.map((r, i) => {
      const before = sorted.slice(0, i).reverse().find((x) => x.overall != null);
      return { id: r.id, version: r.version, date: r.date, overall: r.overall, of: r.of, headline: r.headline, label: r.label, figure: r.theme?.figure ?? null,
        delta: before && r.overall != null ? round2(r.overall - before.overall) : null };
    });
    return {
      kind, name: themeName(kind), latest, prev,
      delta: prev && latest.overall != null && prev.overall != null ? round2(latest.overall - prev.overall) : null,
      history,
      groups: itemDeltas(latest.theme?.groups ?? [], earlier),
    };
  });
}
