// The references page on the site (scripts/references-site.mjs, docs/systems/references.md "On the site"): the
// index, thumbnails and web-size copies written into dist/references/ from a cache, the page reading a static
// index, and none of it in the over-the-air zip, the APK, the Deck or the Xbox packages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { buildReferencesSite, SITE_DIR, THUMB, WEB } from '../scripts/references-site.mjs';
import { indexSources, loadIndex, LIVE_INDEX, STATIC_INDEX } from '../src/references-page/model.js';
import { fullSrc, gridHtml, infoHtml, thumbSrc } from '../src/references-page/view.js';
import { siteOnly, leftOff, stripSiteOnly } from '../scripts/site-only.mjs';
import { leftOutOfPackage, stageGame } from '../scripts/xbox-package.mjs';
import { writeUpdate, UPDATES } from '../scripts/web-update.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const picture = (w, h, r = 120) => sharp({ create: { width: w, height: h, channels: 3, background: { r, g: 90, b: 60 } } }).jpeg().toBuffer();

/** A small checkout: references/ with a few pictures (one twice), a record, the lab's candidates. */
async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'refsite-'));
  const put = (p, data) => { mkdirSync(join(root, 'references', p, '..'), { recursive: true }); writeFileSync(join(root, 'references', p), data); };
  put('levels/The Desert/environment/IMG_1.JPG', await picture(2400, 1600));
  put('levels/The Desert/environment/prompt.txt', 'A desert with bones');
  put('levels/Home/characters/Lou/reference-3.jpeg', await picture(800, 1200, 30));
  put('Title Screen/A1.jpg', await picture(2400, 1600));   // (the same picture as IMG_1: one file on the site)
  put('archive/old/lineup.jpeg', await picture(500, 500, 200));
  put('_candidates/b1/openai/1.jpg', await picture(100, 100));
  return { root, dist: join(root, 'dist'), cache: join(root, 'cache'), put };
}

test('the build: the index the page reads, a thumbnail and a web-size copy of every picture, named by content', async () => {
  const { root, dist, cache } = await fixture();
  try {
    const r = await buildReferencesSite({ root, dist, cache });
    assert.equal(r.count, 4, 'not the candidates');
    assert.equal(r.made, 4); assert.equal(r.hits, 0);
    const index = JSON.parse(readFileSync(join(dist, SITE_DIR, 'index.json'), 'utf8'));
    assert.equal(index.static, true);
    assert.equal(index.count, 4);
    const by = (rel) => index.entries.find((e) => e.rel === rel);
    const desert = by('levels/The Desert/environment/IMG_1.JPG');
    // the dev server's shape, plus the two pictures and the pixels
    for (const k of ['rel', 'path', 'folder', 'name', 'bytes', 'world', 'kind', 'lab', 'hasPrompt', 'meta']) assert.ok(k in desert, k);
    assert.equal(desert.path, 'references/levels/The Desert/environment/IMG_1.JPG');
    assert.equal(desert.meta.prompt, 'A desert with bones');
    assert.match(desert.thumb, /^references\/t\/[0-9a-f]{16}\.webp$/);
    assert.match(desert.web, /^references\/w\/[0-9a-f]{16}\.webp$/);
    assert.deepEqual([desert.width, desert.height], [2400, 1600], 'the original\'s pixels');
    const t = await sharp(join(dist, desert.thumb)).metadata(), w = await sharp(join(dist, desert.web)).metadata();
    assert.equal(t.format, 'webp'); assert.equal(Math.max(t.width, t.height), THUMB.size);
    assert.equal(w.format, 'webp'); assert.equal(Math.max(w.width, w.height), WEB.size);
    const lou = by('levels/Home/characters/Lou/reference-3.jpeg');
    assert.equal((await sharp(join(dist, lou.web)).metadata()).height, 1200, 'never enlarged');
    assert.equal(by('Title Screen/A1.jpg').web, desert.web, 'the same picture twice is one file');
    assert.equal(readdirSync(join(dist, SITE_DIR, 'w')).length, 3);
    assert.ok(by('archive/old/lineup.jpeg'), 'the archive too (the page keeps it closed)');
    assert.ok(r.bytes > 0 && r.files === 7);
    assert.ok(!existsSync(join(dist, 'references/levels')), 'no originals');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the cache: a rebuild encodes nothing, a new picture alone, and keeps only what it used', async () => {
  const { root, dist, cache, put } = await fixture();
  try {
    await buildReferencesSite({ root, dist, cache });
    const again = await buildReferencesSite({ root, dist, cache });
    assert.equal(again.made, 0); assert.equal(again.hits, 4);
    assert.ok(existsSync(join(dist, SITE_DIR, 'index.json')));
    put('levels/Home/characters/Lou/reference-4.jpeg', await picture(640, 480, 10));
    rmSync(join(root, 'references/archive'), { recursive: true });
    const third = await buildReferencesSite({ root, dist, cache });
    assert.equal(third.made, 1); assert.equal(third.hits, 3);
    assert.equal(readdirSync(cache).length, 3 * 3, 'three files a distinct picture (thumbnail, copy, pixels); the removed one\'s gone');
    const noArchive = await buildReferencesSite({ root, dist, cache, archive: false });
    assert.equal(noArchive.count, 4);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/** A fetch answering some URLs with JSON, the rest with the game's HTML (a static host's fallback). */
const fakeFetch = (answers) => async (url) => {
  const body = answers[url];
  return body ? { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => structuredClone(body) }
    : { ok: true, status: 200, headers: { get: () => 'text/html' }, json: async () => { throw new Error('html'); } };
};

test('the page reads the dev server\'s live index there, the site\'s file elsewhere, the site\'s from a device', async () => {
  assert.deepEqual(indexSources({ dev: true }).map((s) => s.url), [LIVE_INDEX, STATIC_INDEX]);
  assert.deepEqual(indexSources({ dev: false }).map((s) => s.url), [STATIC_INDEX, LIVE_INDEX]);
  assert.equal(STATIC_INDEX, 'references/index.json', 'beside the page (the site may be under a sub-path)');
  const site = 'https://memento.example/';
  const entry = { rel: 'a/b.jpg', path: 'references/a/b.jpg', folder: 'a', name: 'b.jpg', thumb: 'references/t/0123.webp', web: 'references/w/0123.webp', width: 3000, height: 2000, bytes: 4096, meta: {} };
  const built = { static: true, entries: [entry] };
  // the built site: the static file
  const s = await loadIndex(indexSources({ dev: false }), fakeFetch({ [STATIC_INDEX]: built }));
  assert.equal(s.source.url, STATIC_INDEX); assert.equal(s.data.entries[0].thumb, 'references/t/0123.webp');
  // the dev server: the live index first; the static one if a build's index is all there is
  const live = { entries: [{ ...entry, thumb: undefined, web: undefined }] };
  assert.equal((await loadIndex(indexSources({ dev: true }), fakeFetch({ [LIVE_INDEX]: live, [STATIC_INDEX]: built }))).source.url, LIVE_INDEX);
  assert.equal((await loadIndex(indexSources({ dev: true }), fakeFetch({ [STATIC_INDEX]: built }))).source.url, STATIC_INDEX);
  // a game on a device: the site's, its pictures made absolute
  const d = await loadIndex(indexSources({ bundled: true, site }), fakeFetch({ [`${site}${STATIC_INDEX}`]: built }));
  assert.equal(d.data.entries[0].thumb, `${site}references/t/0123.webp`);
  assert.equal(d.data.entries[0].web, `${site}references/w/0123.webp`);
  await assert.rejects(loadIndex(indexSources({ dev: false }), fakeFetch({})), /HTTP|index/);
  // the view: the site's pictures when the index has them, the dev server's otherwise
  assert.equal(thumbSrc(entry), 'references/t/0123.webp');
  assert.equal(fullSrc(entry), 'references/w/0123.webp');
  assert.equal(thumbSrc(live.entries[0]), '/__references/thumb?p=references%2Fa%2Fb.jpg');
  assert.equal(fullSrc(live.entries[0]), '/references/a/b.jpg');
  assert.match(gridHtml([entry], 'a'), /src="references\/t\/0123\.webp"/);
  assert.match(infoHtml(entry), /4 KB · 3000 × 2000 · a web copy here/, 'the original\'s size and pixels');
  const main = read('src/references-page/main.js');
  assert.match(main, /loadIndex\(indexSources\(\{ dev: !!import\.meta\.env\?\.DEV, bundled: bundledGame\(\), site: SHEET_SITE \}\)\)/);
  assert.match(read('public/_headers'), /^\/references\/\*\n\s+Access-Control-Allow-Origin: \*$/m, 'a device reads the site\'s index (another origin)');
});

test('the site alone: the zip, the APK, the Deck and the Xbox packages leave references/ out', async () => {
  for (const f of ['references', 'references/index.json', 'references/t/0123.webp', 'references/w/0123.webp']) {
    assert.ok(siteOnly(f) && leftOff(f) && leftOutOfPackage(f), f);
  }
  for (const f of ['references.html', 'assets/references-abc.js', 'assets/reference-sheets-abc.js']) assert.ok(!siteOnly(f) && !leftOff(f), f);
  const dir = mkdtempSync(join(tmpdir(), 'refsite-pack-')), dist = join(dir, 'dist');
  const put = (p, s = 'x') => { mkdirSync(join(dist, p, '..'), { recursive: true }); writeFileSync(join(dist, p), s); };
  try {
    put('index.html', '<!doctype html>'); put('references.html', '<!doctype html>'); put('assets/main.js');
    put('references/index.json', '{}'); put('references/t/a.webp'); put('references/w/a.webp');
    // the over-the-air zip
    await writeUpdate({ dist, build: 7, music: false });
    const zip = readFileSync(join(dist, UPDATES, 'web-7.zip')).toString('latin1');
    assert.ok(zip.includes('references.html'), 'the page itself ships (small)');
    assert.ok(!zip.includes('references/'), 'not its pictures');
    // the Xbox package
    await stageGame({ dist, dest: join(dir, 'xbox'), build: 7, version: '1' });
    assert.ok(existsSync(join(dir, 'xbox/references.html')) && !existsSync(join(dir, 'xbox/references')));
    // the APK (android.yml strips dist/ before cap sync) and the Deck (the same leftOff)
    await stripSiteOnly(dist);
    assert.ok(!existsSync(join(dist, 'references')) && existsSync(join(dist, 'references.html')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.match(read('scripts/package-steam-deck.mjs'), /!leftOff\(fromDist\(src\)\)/);
});

test('the deploys write them after the content update and the Deck\'s runtime, from a cache; no device build does', () => {
  for (const wf of ['deploy.yml', 'cloudflare.yml']) {
    const y = read(`.github/workflows/${wf}`);
    assert.match(y, /actions\/cache@v4[\s\S]*path: \.cache\/references-site[\s\S]*hashFiles\('references\/\*\*', 'scripts\/references-site\.mjs'\)/, wf);
    assert.match(y, /node scripts\/references-site\.mjs dist/, wf);
  }
  const cf = read('.github/workflows/cloudflare.yml');
  assert.ok(cf.indexOf('node scripts/references-site.mjs') > cf.indexOf('node scripts/deck-runtime.mjs'), 'after the Deck runtime');
  assert.ok(cf.indexOf('node scripts/references-site.mjs') > cf.indexOf('node scripts/web-update.mjs'), 'after the content update');
  assert.ok(cf.indexOf('node scripts/references-site.mjs') < cf.indexOf('npx wrangler deploy'));
  for (const wf of ['android.yml', 'steam-deck.yml', 'xbox.yml']) assert.doesNotMatch(read(`.github/workflows/${wf}`), /references-site/, wf);
  assert.match(read('package.json'), /"sharp": "\d+\.\d+\.\d+"/, 'sharp pinned');
});
