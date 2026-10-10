// The references page (references.html, src/references-page/, scripts/references-index.mjs;
// docs/systems/references.md "The references page").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KINDS, LAB, LOOSE, ancestors, buildTree, classify, filterEntries, flatIds, formatHash, parseHash, worldsOf } from '../src/references-page/model.js';
import { gridHtml, infoHtml, thumbSrc, treeHtml, fullSrc } from '../src/references-page/view.js';
import { buildIndex, listPictures, referencesMiddleware, safePicture } from '../scripts/references-index.mjs';
import { BUILD_INPUT } from '../vite.config.js';
import { DEV_PAGES, PAGES, pagesHere } from '../src/world-picker.js';
import { cameFromDebug } from '../src/debug-back.js';

const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');

/** A small references/ folder with each kind of record. */
function fakeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'refpage-'));
  const put = (p, data = JPEG) => { mkdirSync(join(root, 'references', p, '..'), { recursive: true }); writeFileSync(join(root, 'references', p), data); };
  put('levels/The Desert/environment/IMG_1.JPG');
  put('levels/The Desert/environment/source.txt', 'Midjourney reference set\nhttps://www.midjourney.com/jobs/abc\nFour variations; downloaded 2026-10-07.');
  put('levels/The Desert/environment/prompt.txt', 'A desert with bones');
  put('levels/The Desert/places/skull/sheet-1.jpg');
  put('levels/The Desert/places/skull/manifest.json', JSON.stringify({ created: '2026-10-09', sheets: [{ file: 'sheet-1.jpg', service: 'Reference lab', providerLabel: 'OpenAI GPT Image', model: 'gpt-image-2', prompt: 'a skull in the dunes', why: 'the mouth reads', date: '2026-10-09', batch: 'b1', candidate: 'openai/1' }] }));
  put('levels/Home/characters/Lou/reference-3.jpeg');
  put('levels/Home/characters/Lou/review.txt', 'Selected: the coat.');
  put('levels/Lorn/characters/Saba/anf___sheet.png');
  put('levels/Lorn/characters/sources.json', JSON.stringify({ generator: 'Midjourney', references: [{ character: 'Saba, the Listener', file: 'Saba/anf___sheet.png', url: 'https://www.midjourney.com/jobs/s' }] }));
  put('batches/2026-10-09-x.json', JSON.stringify({ date: '2026-10-09', selection: 'User favourites', assets: [{ folder: 'levels/Home/characters/Lou', file: 'reference-3.jpeg', source_url: 'https://www.midjourney.com/jobs/lou' }], sets: [{ folder: 'levels/Home/characters/Lou', prompt: 'Lou, a girl in a coat', job: 'lou' }] }));
  put('enemy-archetypes/crab/sheet-1.jpg');
  put('Title Screen/A1.jpg');
  put('archive/world-enemies/The Desert/lineup-01.jpeg');
  put('box.webp');
  put('_candidates/b1/openai/1.jpg');
  return root;
}

test('what a path is: its world and its kind', () => {
  assert.deepEqual(classify('levels/The Desert/environment/IMG_3775.JPG'), { world: 'The Desert', kind: 'environment' });
  assert.deepEqual(classify('levels/Home/characters/Lou/reference-3.jpeg'), { world: 'Home', kind: 'characters' });
  assert.deepEqual(classify('levels/The Desert/places/skull/sheet-1.jpg'), { world: 'The Desert', kind: 'places' });
  assert.deepEqual(classify('archive/world-enemies/Vael/lineup-01.jpeg'), { world: 'Vael', kind: 'archive' });
  assert.deepEqual(classify('The Travellers Ship/Main Interior/reference-1.jpeg'), { world: null, kind: 'ship' });
  assert.deepEqual(classify('enemy-archetypes/crab/sheet-1.jpg'), { world: null, kind: 'archetypes' });
  assert.deepEqual(classify('box-opening.webp'), { world: null, kind: 'other' });
  for (const k of ['environment', 'characters', 'places', 'archive']) assert.ok(KINDS.some((x) => x.id === k));
});

test('the index: every picture but the candidates, with what its folder says', () => {
  const root = fakeRepo();
  try {
    const pics = listPictures(root).map((p) => p.rel);
    assert.ok(!pics.some((p) => p.startsWith('_candidates')), 'not the lab’s store');
    assert.equal(pics.length, 8);
    const { entries } = buildIndex(root);
    const by = (rel) => entries.find((e) => e.rel === rel);
    const skull = by('levels/The Desert/places/skull/sheet-1.jpg');
    assert.equal(skull.lab, true);
    assert.equal(skull.meta.provider, 'OpenAI GPT Image');
    assert.equal(skull.meta.model, 'gpt-image-2');
    assert.equal(skull.meta.why, 'the mouth reads');
    assert.equal(skull.meta.prompt, 'a skull in the dunes');
    assert.equal(skull.path, 'references/levels/The Desert/places/skull/sheet-1.jpg');
    const env = by('levels/The Desert/environment/IMG_1.JPG');
    assert.equal(env.meta.prompt, 'A desert with bones');
    assert.equal(env.meta.provider, 'Midjourney');
    assert.equal(env.meta.date, '2026-10-07');
    assert.equal(env.meta.source, 'https://www.midjourney.com/jobs/abc');
    assert.equal(env.hasPrompt, true);
    const lou = by('levels/Home/characters/Lou/reference-3.jpeg');
    assert.equal(lou.meta.prompt, 'Lou, a girl in a coat', 'from the batch');
    assert.equal(lou.meta.why, 'User favourites');
    assert.equal(lou.meta.review, 'Selected: the coat.');
    assert.equal(lou.lab, false);
    const saba = by('levels/Lorn/characters/Saba/anf___sheet.png');
    assert.equal(saba.meta.title, 'Saba, the Listener');
    assert.equal(saba.meta.provider, 'Midjourney');
    assert.equal(by('box.webp').folder, '.');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('filters, search and the archive kept apart', () => {
  const root = fakeRepo();
  try {
    const { entries } = buildIndex(root);
    const rels = (f) => filterEntries(entries, f).map((e) => e.rel);
    assert.ok(!rels({}).some((r) => r.startsWith('archive/')), 'the archive is not among the current references');
    assert.deepEqual(rels({ sel: 'archive' }), ['archive/world-enemies/The Desert/lineup-01.jpeg']);
    assert.deepEqual(rels({ kind: 'archive' }), ['archive/world-enemies/The Desert/lineup-01.jpeg']);
    assert.deepEqual(rels({ sel: LAB }), ['levels/The Desert/places/skull/sheet-1.jpg']);
    assert.deepEqual(rels({ lab: true, sel: 'levels/Home' }), []);
    assert.deepEqual(rels({ sel: LOOSE }), ['box.webp']);
    assert.deepEqual(rels({ world: 'The Desert' }).sort(), ['levels/The Desert/environment/IMG_1.JPG', 'levels/The Desert/places/skull/sheet-1.jpg']);
    assert.deepEqual(rels({ q: 'desert skull' }), ['levels/The Desert/places/skull/sheet-1.jpg'], 'every word');
    assert.deepEqual(rels({ q: 'listener' }), ['levels/Lorn/characters/Saba/anf___sheet.png'], 'the title too');
    assert.equal(rels({ prompt: true }).length, 3);
    assert.deepEqual(rels({ sel: 'levels/The Desert/environment' }), ['levels/The Desert/environment/IMG_1.JPG']);
    assert.deepEqual(rels({ sel: 'levels/The Des' }), [], 'a folder, not a prefix of a name');
    assert.deepEqual(worldsOf(entries), ['The Desert', 'Home', 'Lorn']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the tree: Levels and their kinds first, the folders of no world, the lab, the archive last and closed', () => {
  const root = fakeRepo();
  try {
    const { entries } = buildIndex(root);
    const tree = buildTree(entries);
    assert.equal(tree[0].id, 'levels');
    assert.deepEqual(tree[0].children.map((n) => n.id), ['levels/The Desert', 'levels/Home', 'levels/Lorn']);
    assert.deepEqual(tree[0].children[0].children.map((n) => n.id), ['levels/The Desert/environment', 'levels/The Desert/places']);
    const last = tree.at(-1);
    assert.equal(last.id, 'archive'); assert.equal(last.closed, true); assert.equal(last.count, 1);
    assert.ok(tree.some((n) => n.id === LAB && n.count === 1));
    assert.ok(tree.some((n) => n.id === 'enemy-archetypes'));
    assert.ok(tree.some((n) => n.id === LOOSE));
    const html = treeHtml(tree, { sel: 'levels', open: new Set(['levels']) });
    assert.match(html, /data-id="levels" aria-current="true" aria-expanded="true"/);
    assert.match(html, /data-id="levels\/The Desert"/);
    assert.doesNotMatch(html, /data-id="archive\/world-enemies"/, 'the archive closed');
    assert.deepEqual(flatIds(tree, new Set()).slice(0, 1), ['levels']);
    assert.ok(flatIds(tree, new Set(['levels'])).includes('levels/Home'));
    assert.deepEqual(ancestors('levels/The Desert/places/skull'), ['levels', 'levels/The Desert', 'levels/The Desert/places']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the address keeps the place: a folder, a picture, the filters', () => {
  const s = { sel: 'levels/The Desert/environment', pic: null, q: 'bones dune', world: 'The Desert', kind: 'environment', lab: true, prompt: true };
  assert.deepEqual(parseHash(formatHash(s)), s);
  const p = parseHash('#path=levels%2FThe%20Desert%2Fenvironment%2FIMG_3775.JPG');
  assert.equal(p.pic, 'levels/The Desert/environment/IMG_3775.JPG');
  assert.equal(p.sel, 'levels/The Desert/environment');
  assert.equal(parseHash('#path=box-opening.webp').sel, LOOSE);
  assert.equal(formatHash({}), '#');
  const wide = { ...s, sel: 'levels/The Desert', pic: 'levels/The Desert/environment/IMG_3775.JPG' };
  assert.deepEqual(parseHash(formatHash(wide)), wide, 'a picture opened from a wider folder keeps it');
  assert.equal(parseHash(formatHash({ sel: '', pic: 'levels/Home/characters/Lou/a.jpg' })).sel, '', 'from All');
  assert.doesNotMatch(formatHash({ sel: 'levels/Home/characters/Lou', pic: 'levels/Home/characters/Lou/a.jpg' }), /in=/);
  assert.doesNotMatch(formatHash({ sel: 'levels/The Desert' }), /\+/, 'spaces as %20');
});

test('the view: thumbnails from the dev server, the information of a picture', () => {
  assert.equal(thumbSrc('references/levels/The Desert/x.jpg'), '/__references/thumb?p=references%2Flevels%2FThe%20Desert%2Fx.jpg');
  assert.equal(fullSrc('references/levels/The Desert/x.jpg'), '/references/levels/The%20Desert/x.jpg');
  assert.equal(fullSrc('references/levels/Lorn/characters/Saba, the Listener/a#1.png'), '/references/levels/Lorn/characters/Saba,%20the%20Listener/a%231.png', 'commas as they are (Vite does not decode %2C)');
  const e = { path: 'references/a/b.jpg', rel: 'a/b.jpg', folder: 'a', name: 'b.jpg', bytes: 2048, world: 'The Desert', kind: 'places', lab: true, hasPrompt: true,
    meta: { provider: 'OpenAI', model: 'gpt-image-2', prompt: 'a <skull>', why: 'reads', date: '2026-10-09', records: ['references/a/manifest.json'], notes: [{ file: 'source.txt', text: 'MJ' }] } };
  const h = infoHtml(e, { width: 1536, height: 1024 });
  for (const s of ['references/a/b.jpg', '2 KB · 1536 × 1024', 'OpenAI', 'gpt-image-2', '2026-10-09', 'a &lt;skull&gt;', 'reads', 'source.txt', 'picked in the reference lab']) assert.ok(h.includes(s), s);
  const g = gridHtml([e], 'a');
  assert.match(g, /loading="lazy"/);
  assert.match(g, /data-path="references\/a\/b\.jpg"/);
  assert.match(gridHtml([], ''), /Nothing here/);
});

test('the middleware: the index, small pictures, nothing outside references/ or in the candidates', async () => {
  const root = fakeRepo();
  try {
    const mw = referencesMiddleware({ root });
    const call = (url) => new Promise((resolve) => {
      const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, headers: this.headers, body: b }); } };
      mw({ url, method: 'GET' }, res, () => resolve({ status: 'next' }));
    });
    const idx = await call('/__references/index.json');
    assert.equal(idx.status, 200);
    assert.equal(JSON.parse(idx.body).entries.length, 8);
    assert.equal((await call('/somewhere')).status, 'next');
    assert.equal((await call('/__references/thumb?p=../package.json')).status, 404);
    assert.equal((await call(`/__references/thumb?p=${encodeURIComponent('references/_candidates/b1/openai/1.jpg')}`)).status, 404);
    assert.equal(safePicture(root, 'references/levels/../../x.jpg'), null);
    assert.ok(safePicture(root, 'references/levels/The Desert/environment/IMG_1.JPG'));
    const t = await call(`/__references/thumb?p=${encodeURIComponent('references/levels/The Desert/environment/IMG_1.JPG')}`);
    assert.equal(t.status, 200, 'a picture (sharp, or the file itself when it can’t read it)');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the real folder: every world has its node, nothing in the levels is of no kind', () => {
  const { entries } = buildIndex();
  assert.ok(entries.length > 300, `${entries.length} pictures`);
  const tree = buildTree(entries);
  assert.ok(tree[0].children.length >= 20, 'the worlds');
  for (const e of entries.filter((x) => x.rel.startsWith('levels/'))) assert.ok(['environment', 'characters', 'places'].includes(e.kind), e.rel);
  assert.equal(tree.at(-1).id, 'archive');
  assert.ok(entries.some((e) => e.lab), 'the lab’s picks are found');
});

test('the page: built, in the Debug menu everywhere (reference material), with the ◀ Debug button and controller glyphs', () => {
  const inputs = Object.values(BUILD_INPUT).map((p) => p.split('/').pop());
  assert.ok(inputs.includes('references.html'), 'built: the site has its index and pictures (scripts/references-site.mjs)');
  assert.ok(PAGES.some((p) => p.href === 'references.html' && p.ref && !p.dev));
  assert.ok(!DEV_PAGES.some((p) => p.href === 'references.html'));
  assert.ok(pagesHere(true).some((p) => p.href === 'references.html'));
  assert.ok(pagesHere(false).some((p) => p.href === 'references.html'));
  assert.equal(cameFromDebug('http://localhost:5365/references.html', ''), true);
  const html = readFileSync(new URL('../references.html', import.meta.url), 'utf8');
  assert.match(html, /<script type="module" src="\/src\/debug-back-page\.js"><\/script>/);
  assert.match(html, /<body[^>]* data-debug-back="keys-off pad-off"/);
  assert.match(html, /class="debug-room"/);
  for (const g of ['back', 'lb', 'rb', 'x', 'y']) assert.match(html, new RegExp(`data-glyph="${g}"`), g);
  const src = readFileSync(new URL('../src/references-page/main.js', import.meta.url), 'utf8');
  assert.match(src, /dataset\.gridNav = ''/);
  assert.match(src, /tabPrev/);
});
