// The references page's index and thumbnails (references.html, docs/systems/references.md "The references
// page"). The middleware is the dev server's (apply: 'serve'); the site has the same index as a file, with
// thumbnails and web-size copies, written by the deploy (scripts/references-site.mjs: references/ itself, ≈ 220 MB,
// is not deployed).
//
//   GET /__references/index.json       every picture under references/ (not the lab's _candidates), with what
//                                      its folder says of it: read again on each request (a new pick shows at once)
//   GET /__references/thumb?p=<path>   a small WebP of one picture (sharp; cached in the system's temp folder)
//   the pictures themselves:           /references/… (Vite serves the checkout)
//
// What a picture's folder says (metaFor): the JSON records beside it and in the folders above it
// (manifest.json: the reference lab's picks; sources.json, selections.json, notes.json: Midjourney's), the
// batches' records (references/batches/*.json, folders relative to references/), and the text files beside it
// (prompt.txt, source.txt, review.txt, why.txt).
//
//   node scripts/references-index.mjs            a summary of the index (counts by kind, what has a prompt)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classify, isImagePath } from '../src/references-page/model.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const API = '/__references/';
const SKIP = new Set(['_candidates', '3d']);   // (the lab's store; a 3D pick's renders stay with its model)
const SIDE_TEXT = ['prompt.txt', 'source.txt', 'review.txt', 'why.txt'];
const JSON_NAMES = /^(manifest|sources|selections|notes|candidates)\.json$/;

/** Every picture under references/: [{ rel, folder, name, bytes }] (rel relative to references/). */
export function listPictures(root = ROOT) {
  const out = [];
  const walk = (rel, depth) => {
    if (depth > 7) return;
    const abs = join(root, 'references', rel);
    for (const f of readdirSync(abs).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
      if (f.startsWith('.') || SKIP.has(f)) continue;
      const p = rel ? `${rel}/${f}` : f;
      const st = statSync(join(abs, f));
      if (st.isDirectory()) walk(p, depth + 1);
      else if (isImagePath(f)) out.push({ rel: p, folder: rel || '.', name: f, bytes: st.size });
    }
  };
  if (existsSync(join(root, 'references'))) walk('', 0);
  return out;
}

const readJson = (abs) => { try { return JSON.parse(readFileSync(abs, 'utf8')); } catch { return null; } };
const readText = (abs) => { try { return readFileSync(abs, 'utf8').trim(); } catch { return null; } };
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The record of `name` in a JSON tree (an object whose file / name / path is it), and the tree's top fields. */
export function findRecord(json, relFromJson) {
  const base = relFromJson.split('/').pop();
  let found = null;
  const visit = (node) => {
    if (found || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    for (const k of ['file', 'name', 'path', 'image']) {
      const v = node[k];
      if (typeof v === 'string' && (v === relFromJson || v === base || v.endsWith(`/${relFromJson}`))) { found = node; return; }
    }
    Object.values(node).forEach(visit);
  };
  visit(json);
  return found;
}

/** What a JSON record (and its file's top level) says: provider, model, prompt, why, date, source, title. */
function fromRecord(rec, top) {
  const t = top && typeof top === 'object' && !Array.isArray(top) ? top : {};
  return {
    provider: str(rec?.providerLabel) ?? str(rec?.provider) ?? str(rec?.service) ?? str(t.service) ?? str(t.generator) ?? str(t.selectedBy) ?? null,
    model: str(rec?.model) ?? str(t.model) ?? null,
    prompt: str(rec?.prompt) ?? null,
    why: str(rec?.why) ?? str(rec?.note) ?? str(rec?.notes) ?? (rec !== t ? str(t.notes) : null) ?? null,
    date: str(rec?.date) ?? str(t.date) ?? str(t.created) ?? null,
    source: str(rec?.jobUrl) ?? str(rec?.url) ?? str(rec?.source_url) ?? str(t.jobUrl) ?? (str(rec?.source)?.startsWith('http') ? rec.source : null) ?? null,
    title: str(rec?.label) ?? str(rec?.character) ?? str(rec?.title) ?? null,
    from: str(rec?.from) ?? null,
    lab: !!(rec?.batch && rec?.candidate) || str(rec?.service) === 'Reference lab',
  };
}

/** The batches' records: folder → { prompt, job, date }, "folder/file" → the asset. */
export function batchRecords(root = ROOT) {
  const sets = new Map(), assets = new Map();
  const dir = join(root, 'references/batches');
  if (!existsSync(dir)) return { sets, assets };
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const j = readJson(join(dir, f));
    if (!j) continue;
    for (const s of j.sets ?? []) if (s.folder) sets.set(s.folder, { prompt: str(s.prompt), job: str(s.job), date: str(s.date) ?? str(j.date), batch: f });
    for (const a of j.assets ?? []) if (a.folder && a.file) assets.set(`${a.folder}/${a.file}`, { ...a, date: str(a.date) ?? str(j.date), batch: f, selection: str(j.selection) });
  }
  return { sets, assets };
}

/** Everything known about one picture (rel relative to references/). */
export function metaFor(root, pic, cache = new Map(), batches = batchRecords(root)) {
  const meta = { provider: null, model: null, prompt: null, why: null, date: null, source: null, title: null, from: null, review: null, notes: [], records: [] };
  let lab = false;
  const fill = (m) => { for (const k of Object.keys(m)) if (k !== 'lab' && m[k] && !meta[k]) meta[k] = m[k]; if (m.lab) lab = true; };
  // the JSON records: beside the picture first, then the folders above it (up to references/)
  const parts = pic.folder === '.' ? [] : pic.folder.split('/');
  for (let i = parts.length; i >= 0; i--) {
    const dirRel = parts.slice(0, i).join('/');
    const abs = join(root, 'references', dirRel);
    const key = `ls:${dirRel}`;
    if (!cache.has(key)) cache.set(key, existsSync(abs) ? readdirSync(abs).filter((f) => JSON_NAMES.test(f)) : []);
    for (const f of cache.get(key)) {
      const jk = `json:${dirRel}/${f}`;
      if (!cache.has(jk)) cache.set(jk, readJson(join(abs, f)));
      const json = cache.get(jk);
      if (!json) continue;
      const relFromJson = posix.relative(dirRel, pic.rel);
      const rec = findRecord(json, relFromJson);
      if (rec) { fill(fromRecord(rec, json)); meta.records.push(`references/${dirRel ? `${dirRel}/` : ''}${f}`); }
      else if (i === parts.length && (json.prompt || json.service || json.generator)) fill(fromRecord(json, json));   // (a folder's single record)
    }
  }
  // the batches (folders relative to references/)
  const asset = batches.assets.get(pic.rel);
  if (asset) { fill({ source: str(asset.source_url), date: asset.date, why: asset.selection, provider: 'Midjourney' }); meta.records.push(`references/batches/${asset.batch}`); }
  const set = batches.sets.get(pic.folder) ?? batches.sets.get(pic.folder.split('/').slice(0, -1).join('/'));
  if (set) { fill({ prompt: set.prompt, date: set.date, provider: 'Midjourney', source: set.job ? `https://www.midjourney.com/jobs/${set.job}` : null }); meta.records.push(`references/batches/${set.batch}`); }
  // a Midjourney download by its name or its links
  if (!meta.provider && (/^anf___/.test(pic.name) || /midjourney\.com/.test(meta.source ?? ''))) meta.provider = 'Midjourney';
  // the text files beside it
  for (const f of SIDE_TEXT) {
    const t = readText(join(root, 'references', pic.folder, f));
    if (!t) continue;
    if (f === 'prompt.txt' && !meta.prompt) meta.prompt = t;
    else if (f === 'review.txt') meta.review = t;
    else if (f === 'why.txt' && !meta.why) meta.why = t;
    else meta.notes.push({ file: f, text: t });
    if (f === 'source.txt' && !meta.source) meta.source = t.match(/https?:\/\/\S+/)?.[0] ?? null;
    if (f === 'source.txt' && !meta.provider && /midjourney/i.test(t)) meta.provider = 'Midjourney';
    if (f === 'source.txt' && !meta.date) meta.date = t.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  }
  return { meta, lab };
}

/** The index: { generated, count, entries: [{ rel, path, folder, name, bytes, world, kind, lab, hasPrompt, meta }] }. */
export function buildIndex(root = ROOT) {
  const cache = new Map(), batches = batchRecords(root);
  const entries = listPictures(root).map((p) => {
    const { meta, lab } = metaFor(root, p, cache, batches);
    return { ...p, path: `references/${p.rel}`, ...classify(p.rel), lab, hasPrompt: !!meta.prompt, meta };
  });
  return { generated: new Date().toISOString(), count: entries.length, entries };
}

// ------------------------------------------------------------------ thumbnails
export const THUMB_WIDTH = 360;
const THUMBS = join(tmpdir(), 'hiraeth-reference-thumbs');
let sharpMod;
async function thumb(abs, st) {
  const key = createHash('sha1').update(`${abs}|${st.size}|${st.mtimeMs}|${THUMB_WIDTH}`).digest('hex');
  const file = join(THUMBS, `${key}.webp`);
  if (existsSync(file)) return readFileSync(file);
  sharpMod ??= (await import('sharp')).default;
  const buf = await sharpMod(abs).rotate().resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: 'inside', withoutEnlargement: true }).webp({ quality: 68 }).toBuffer();
  mkdirSync(THUMBS, { recursive: true });
  writeFileSync(file, buf);
  return buf;
}

/** A picture's path from the request, checked to be a picture inside references/ (not the candidates), or null. */
export function safePicture(root, p) {
  const rel = String(p ?? '').replace(/^\/+/, '').replace(/^references\//, '');
  if (!rel || !isImagePath(rel) || rel.split('/').some((s) => s === '..' || s === '' || s.startsWith('.')) || rel.startsWith('_candidates/')) return null;
  const abs = join(root, 'references', rel);
  return existsSync(abs) ? abs : null;
}

/** The middleware (exported for the tests). */
export function referencesMiddleware({ root = ROOT } = {}) {
  return async (req, res, next) => {
    const [path, query = ''] = (req.url ?? '').split('?');
    if (!path.startsWith(API)) return next();
    const what = path.slice(API.length);
    try {
      if (what === 'index.json') {
        res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
        return res.end(JSON.stringify(buildIndex(root)));
      }
      if (what === 'thumb') {
        const abs = safePicture(root, new URLSearchParams(query).get('p'));
        if (!abs) { res.statusCode = 404; return res.end('not found'); }
        let buf, type = 'image/webp';
        try { buf = await thumb(abs, statSync(abs)); } catch { buf = readFileSync(abs); type = /\.png$/i.test(abs) ? 'image/png' : /\.webp$/i.test(abs) ? 'image/webp' : 'image/jpeg'; }   // (no sharp: the picture itself)
        res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 'max-age=3600');
        return res.end(buf);
      }
      res.statusCode = 404; return res.end('not found');
    } catch (e) {
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: String(e?.message ?? e) }));
    }
  };
}

/** The Vite plugin: the middleware on the dev server only. */
export function referencesPlugin(opts = {}) {
  return { name: 'references-page', apply: 'serve', configureServer(server) { server.middlewares.use(referencesMiddleware(opts)); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { entries } = buildIndex();
  const by = {};
  for (const e of entries) by[e.kind] = (by[e.kind] ?? 0) + 1;
  console.log(`${entries.length} pictures`, by);
  console.log(`with a prompt: ${entries.filter((e) => e.hasPrompt).length}, lab picks: ${entries.filter((e) => e.lab).length}`);
}
