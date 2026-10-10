// The audits page's data (audits.html, src/audits-page/, docs/systems/ui.md "The audits page"): every report in
// docs/audits/ and the cinematics QC report read into one JSON at build time (src/audits-page/parse.js), with
// the TODO.md and DONE.md sections that name each report. The reports stay the source of truth.
//
// The JSON and the reports' pictures are the site's alone, like the changelog's pictures: the build writes them
// to dist/audits/ (auditsPlugin, vite.config.js), and the over-the-air zip, the APK and the Deck leave that folder
// out (scripts/web-update.mjs AUDIT_FILE, scripts/site-only.mjs). A dev server serves both from docs/.
//
//   node scripts/audits-data.mjs            prints a summary of what the page will show
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildIndex, cinematicVerdicts, parseReport, todoSections } from '../src/audits-page/parse.js';
import { themeOf } from '../src/audits-page/themes.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const AUDITS_DIR = 'docs/audits';
export const CINEMATICS_QC = { file: 'docs/systems/cinematics-qc.md', notes: 'docs/systems/cinematics-qc-notes.json' };
/** Where the page reads them, beside it (dist/audits/ on the site; a dev server answers the same paths). */
export const AUDITS_URL = 'audits';
export const DATA_FILE = `${AUDITS_URL}/audits.json`;
const REPO = 'https://github.com/rnaud/hiraeth/blob/main/';

/** The report files the page shows: docs/audits/*.md, then the cinematics QC report. */
export function reportFiles(root = ROOT) {
  const dir = join(root, AUDITS_DIR);
  const md = readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => `${AUDITS_DIR}/${f}`);
  return existsSync(join(root, CINEMATICS_QC.file)) ? [...md, CINEMATICS_QC.file] : md;
}

/** A report's link as the page uses it: its pictures beside the page, another report in the page, the rest on GitHub. */
export function linkFor(file) {
  const dir = posix.dirname(file);
  return (href, { image = false } = {}) => {
    if (/^(https?:|mailto:)/.test(href)) return href;
    if (href.startsWith('#')) return `${REPO}${file}${href}`;
    const [path, hash = ''] = href.split('#');
    const to = posix.normalize(posix.join(dir, path));
    if (to.startsWith(`${AUDITS_DIR}/`)) {
      const rel = to.slice(AUDITS_DIR.length + 1);
      if (/^[^/]+\.md$/.test(rel) && !image) return `#/${rel.replace(/\.md$/, '')}`;
      if (rel.includes('/')) return `${AUDITS_URL}/${rel}`;
    }
    return `${REPO}${to}${hash ? `#${hash}` : ''}`;
  };
}

/** Every report's pictures and other files (docs/audits/<report>/*): [{ path (from docs/audits), abs }]. */
export function mediaFiles(root = ROOT) {
  const dir = join(root, AUDITS_DIR);
  const out = [];
  for (const d of readdirSync(dir)) {
    const p = join(dir, d);
    if (!statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p)) if (statSync(join(p, f)).isFile()) out.push({ path: `${d}/${f}`, abs: join(p, f) });
  }
  return out;
}

/** The page's data: { reports, index, todoFiles }. */
export function auditsData(root = ROOT) {
  const read = (f) => readFileSync(join(root, f), 'utf8');
  const files = reportFiles(root);
  const reports = files.map((file) => {
    const cine = file === CINEMATICS_QC.file;
    const md = read(file);
    const r = parseReport(md, { file, link: linkFor(file), ...(cine ? { kind: 'cinematics', depth: 3 } : {}) });
    if (cine && existsSync(join(root, CINEMATICS_QC.notes))) {
      const { by, counts } = cinematicVerdicts(JSON.parse(read(CINEMATICS_QC.notes)));
      r.verdicts = counts;
      for (const t of r.scoreTables) for (const row of t.rows) if (by[row.id]) row.verdict = by[row.id];
    }
    r.theme = themeOf(r, md);   // (what the dashboard's card shows: src/audits-page/themes.js)
    return r;
  });
  const todo = {};
  for (const src of ['TODO.md', 'DONE.md']) {
    if (!existsSync(join(root, src))) continue;
    for (const [f, list] of Object.entries(todoSections(read(src), files, { source: src, link: linkFor(src) }))) (todo[f] ??= []).push(...list);
  }
  for (const r of reports) {
    const sections = todo[r.file] ?? [];
    const items = sections.flatMap((s) => s.items);
    r.todo = { sections, open: items.filter((i) => !i.done).length, done: items.filter((i) => i.done).length };
  }
  return { reports, index: buildIndex(reports) };
}

/**
 * The Vite plugin: a dev server answers /audits/audits.json (read again on each request) and the pictures from
 * docs/audits/; a build writes both to dist/audits/ (site-only: see the top).
 */
export function auditsPlugin(root = ROOT) {
  return {
    name: 'audits-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0]);
        const m = url.match(/\/audits\/(.+)$/);
        if (!m) return next();
        if (m[1] === 'audits.json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(auditsData(root)));
          return;
        }
        const f = mediaFiles(root).find((x) => x.path === m[1]);
        if (!f) return next();
        res.setHeader('Content-Type', { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', json: 'application/json' }[f.path.split('.').pop()] ?? 'application/octet-stream');
        res.end(readFileSync(f.abs));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: DATA_FILE, source: JSON.stringify(auditsData(root)) });
      for (const f of mediaFiles(root)) this.emitFile({ type: 'asset', fileName: `${AUDITS_URL}/${f.path}`, source: readFileSync(f.abs) });
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { reports, index } = auditsData();
  for (const e of index) {
    const r = reports.find((x) => x.id === e.id);
    console.log(`${e.kindName.padEnd(14)} v${e.version.padEnd(5)} ${e.date.padEnd(10)} ${e.overall ?? '—'} ${e.delta != null ? `(${e.delta >= 0 ? '+' : ''}${e.delta})` : ''}`
      + `  ${r.sections.length} sections, ${r.scoreTables.length} score tables (${r.scoreTables.map((t) => `${t.rows.length}×[${t.criteria.map((c) => t.header[c]).join(',')}]→${t.header[t.primary]}`).join('; ')}), ${r.edits} edits, ${r.pictures} pictures, TODO ${r.todo.open}/${r.todo.done}`);
  }
  console.log(`${(JSON.stringify({ reports, index }).length / 1024).toFixed(0)} KB of JSON`);
}
