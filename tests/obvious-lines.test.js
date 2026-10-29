import test from 'node:test';
import assert from 'node:assert/strict';
// (src/ directories through their literal catalogues, checked against the directories: tests/test-catalogs.test.js)
import * as storySources from './catalogs/story-sources.js';
import * as templeSources from './catalogs/temples-sources.js';
import * as levelSources from './catalogs/levels-sources.js';

// Players: "The character shouldn't say 'how is it that I can understand you': it's obvious." Nobody
// asks, in any world, how the traveller and the people understand each other (the translator at his
// ear is never discussed in a conversation: docs/story-bible.md, "The translator").
const dirs = [['src/story/', storySources], ['src/temples/', templeSources], ['src/levels/', levelSources]];
/** [path from the repository root, its text] of each .js file in those three. */
const files = dirs.flatMap(([d, sources]) => sources.files.filter((f) => f.endsWith('.js')).map((f) => [d + f, () => sources.source(f)]));

test('no line asks how the traveller understands anyone, in any world', () => {
  const bad = [];
  for (const [f, read] of files) {
    const src = read();
    for (const m of src.matchAll(/['"`]([^'"`\n]*\b(how (is it|come|can|do|does)[^'"`\n]*understand|understand (each other|one another)|speak (my|our|your) language|your translator)\b[^'"`\n]*)['"`]/gi)) bad.push(`${f.pathname.split('/src/')[1]}: ${m[1].slice(0, 80)}`);
  }
  assert.deepEqual(bad, []);
});

test('Nour has no answer about the translator any more', async () => {
  const { PEOPLE } = await import('../src/story/desert-data.js');
  const nodes = PEOPLE.nour.talk.nodes;
  assert.equal(nodes.ear, undefined);
  for (const [id, n] of Object.entries(nodes)) for (const c of n.choices ?? []) assert.ok(!/understand/i.test(c.text), `${id}: ${c.text}`);
});
