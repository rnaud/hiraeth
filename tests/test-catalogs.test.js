// The tests' literal catalogues of source directories (tests/catalogs/*.js, scripts/test-catalogs-core.mjs) are exactly
// their directories: a file added, removed or renamed fails here until `node scripts/test-catalogs.mjs` is run, so a
// test reading a catalogue can't miss one. Each directory is listed by its own literal path (what the test selector
// follows), and each catalogue read by name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { SPECS, entries, renderCatalog } from '../scripts/test-catalogs-core.mjs';

const LISTINGS = {
  'src/story': readdirSync(new URL('../src/story/', import.meta.url)),
  'src/temples': readdirSync(new URL('../src/temples/', import.meta.url)),
  'src/levels': readdirSync(new URL('../src/levels/', import.meta.url)),
  'src/gadgets': readdirSync(new URL('../src/gadgets/', import.meta.url)),
  src: readdirSync(new URL('../src/', import.meta.url), { recursive: true }),
  engine: readdirSync(new URL('../engine/', import.meta.url), { recursive: true }),
};
// (NAMES only ever iterated: the selector reads each catalogue's path from it)
const NAMES = ['story-modules', 'story-data-modules', 'story-sources', 'temples-data-modules', 'temples-sources', 'levels-sources', 'gadgets-sources', 'src-sources', 'engine-sources'];

test('every catalogue is listed here and its directory is listed by name', () => {
  const listed = [];
  for (const name of NAMES) { listed.push(name); assert.ok(LISTINGS[SPECS[name].dir], `${name}: ${SPECS[name].dir} listed here`); }
  assert.deepEqual(listed.sort(), Object.keys(SPECS).sort());
});

for (const name of NAMES) {
  test(`${name} is exactly its directory (node scripts/test-catalogs.mjs)`, () => {
    const spec = SPECS[name];
    const want = renderCatalog(name, entries(name, LISTINGS[spec.dir]));
    assert.equal(readFileSync(new URL(`./catalogs/${name}.js`, import.meta.url), 'utf8'), want, `tests/catalogs/${name}.js is out of date: node scripts/test-catalogs.mjs`);
  });
}

test('a catalogue is what it says: its loaders import, its readers read, each entry once; a stranger is refused', async () => {
  const story = await import('./catalogs/story-data-modules.js');
  assert.ok(story.files.includes('desert-data.js') && story.files.every((f) => /-(?:data|people)\.js$/.test(f)));
  assert.equal(await story.load('desert-data.js'), await import('../src/story/desert-data.js'));
  assert.throws(() => story.load('../desert-data.js'), /not in src\/story/);
  const src = await import('./catalogs/src-sources.js');
  assert.equal(src.source('story/desert-data.js'), readFileSync(new URL('../src/story/desert-data.js', import.meta.url), 'utf8'));
  assert.ok(src.files.includes('levels/desert.js') && src.files.includes('main.js'));
  assert.equal(new Set(src.files).size, src.files.length);
  // the check catches a file added, dropped or renamed
  const files = entries('story-sources', LISTINGS['src/story']);
  const text = renderCatalog('story-sources', files);
  for (const other of [[...files, 'new-world-data.js'].sort(), files.slice(1), files.map((f, i) => (i ? f : 'renamed.js')).sort()])
    assert.notEqual(renderCatalog('story-sources', other), text);
});
