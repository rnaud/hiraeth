// The references page on the site (references.html, docs/systems/references.md "On the site"): the originals
// (references/, ≈ 220 MB) are never deployed; this writes what the page needs into the built site instead,
// dist/references/:
//
//   index.json        the dev server's index (scripts/references-index.mjs buildIndex), each picture with
//                     `thumb` and `web` (its two WebPs, relative to the page) and its pixels (`width`, `height`)
//   t/<hash>.webp     a 360 px thumbnail for the grid
//   w/<hash>.webp     a web-size copy for the viewer (WEB.size px on its long side)
//
// Named by the picture's content (sha1), so the same picture twice is one file and a deploy uploads only what
// changed. Each WebP is kept in a cache folder (CACHE_DIR, `.cache/references-site/`; actions/cache in CI keyed
// on the references' hash) under a name of its content and the settings: a rebuild only encodes new pictures,
// and the cache keeps only what this run used.
//
// Site-only, like the changelog's pictures: the deploy workflows run it after the content update and the Deck's
// runtime are made, and the zip, the APK, the Deck and the Xbox packages leave references/ out anyway
// (scripts/web-update.mjs REFERENCE_FILE, scripts/site-only.mjs).
//
//   node scripts/references-site.mjs [dist] [--cache <dir>] [--no-archive]     (then checks the site against Workers' limits)
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildIndex } from './references-index.mjs';
import { checkLimits } from './web-update.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Where the page finds them, beside it (dist/references/). */
export const SITE_DIR = 'references';
export const CACHE_DIR = '.cache/references-site';
/** The grid's thumbnails (as the dev server's) and the viewer's copies. */
export const THUMB = { size: 360, quality: 68 };
export const WEB = { size: 1600, quality: 80 };

const settingsKey = (s) => `${s.size}q${s.quality}`;

/** One picture's two WebPs and its pixels, from the cache or made now. */
async function encode(buf, hash, cache, sharp, stats) {
  const t = join(cache, `${hash}-t${settingsKey(THUMB)}.webp`);
  const w = join(cache, `${hash}-w${settingsKey(WEB)}.webp`);
  const m = join(cache, `${hash}.json`);
  if (existsSync(t) && existsSync(w) && existsSync(m)) { stats.hits++; return { t, w, meta: JSON.parse(await readFile(m, 'utf8')) }; }
  stats.made++;
  const img = sharp(buf, { failOn: 'none' }).rotate();
  const { width, height, orientation = 1 } = await img.metadata();   // (before the rotation: EXIF-turned pictures swap)
  const fit = (s) => ({ width: s.size, height: s.size, fit: 'inside', withoutEnlargement: true });
  await writeFile(t, await img.clone().resize(fit(THUMB)).webp({ quality: THUMB.quality }).toBuffer());
  await writeFile(w, await img.clone().resize(fit(WEB)).webp({ quality: WEB.quality, effort: 5 }).toBuffer());
  const out = orientation >= 5 ? { width: height, height: width } : { width, height };
  await writeFile(m, JSON.stringify(out));
  return { t, w, meta: out };
}

/**
 * Write the index, the thumbnails and the web-size copies into `<dist>/references/`.
 * Returns { count, made, hits, files, bytes, ms }.
 */
export async function buildReferencesSite({ root = ROOT, dist = join(root, 'dist'), cache = join(root, CACHE_DIR), archive = true, sharp = null, log = () => {} } = {}) {
  const t0 = Date.now();
  sharp ??= (await import('sharp')).default;
  const index = buildIndex(root);
  if (!archive) index.entries = index.entries.filter((e) => e.kind !== 'archive');
  const out = join(dist, SITE_DIR);
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 't'), { recursive: true });
  await mkdir(join(out, 'w'), { recursive: true });
  await mkdir(cache, { recursive: true });
  const stats = { made: 0, hits: 0 };
  const used = new Set(), written = new Set();
  let next = 0, bytes = 0;
  const worker = async () => {
    while (next < index.entries.length) {
      const e = index.entries[next++];
      const buf = await readFile(join(root, e.path));
      const hash = createHash('sha1').update(buf).digest('hex').slice(0, 16);
      let made;
      try { made = await encode(buf, hash, cache, sharp, stats); } catch (err) { log(`skipped ${e.path}: ${err.message}`); e.broken = true; continue; }
      for (const f of [made.t, made.w, join(cache, `${hash}.json`)]) used.add(f);
      Object.assign(e, { thumb: `${SITE_DIR}/t/${hash}.webp`, web: `${SITE_DIR}/w/${hash}.webp`, ...made.meta });
      if (written.has(hash)) continue;
      written.add(hash);
      await copyFile(made.t, join(dist, e.thumb));
      await copyFile(made.w, join(dist, e.web));
      const sizes = await Promise.all([stat(made.t), stat(made.w)]);
      bytes += sizes[0].size + sizes[1].size;   // (after the awaits: workers run side by side)
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(6, availableParallelism() - 1)) }, worker));
  index.entries = index.entries.filter((e) => !e.broken);
  index.count = index.entries.length;
  index.static = true;
  const json = JSON.stringify(index);
  await writeFile(join(out, 'index.json'), json);
  bytes += Buffer.byteLength(json);
  // the cache keeps what this run used (old settings and removed pictures go)
  for (const f of await readdir(cache)) if (!used.has(join(cache, f))) await rm(join(cache, f), { force: true });
  return { count: index.count, made: stats.made, hits: stats.hits, files: written.size * 2 + 1, bytes, ms: Date.now() - t0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const cache = opt('--cache');
  const archive = !args.includes('--no-archive');
  const dist = resolve(args.find((a) => !a.startsWith('--')) ?? 'dist');
  if (!existsSync(join(dist, 'references.html'))) throw new Error(`${dist}: no references.html, build the site first (npm run build)`);
  const r = await buildReferencesSite({ dist, archive, ...(cache ? { cache: resolve(cache) } : {}), log: console.warn });
  console.log(`references on the site: ${r.count} pictures, ${r.files} files, ${(r.bytes / 2 ** 20).toFixed(1)} MB `
    + `(${r.made} encoded, ${r.hits} from the cache) in ${(r.ms / 1000).toFixed(1)} s`);
  console.log(`the whole site: ${await checkLimits(dist)} files, within the Workers limits`);
}
