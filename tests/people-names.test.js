// One name, one person (issue #229, the game audit v1.59): the scientist of the fragments was named Orrin, the name of
// the father's neighbours, and the Floating city's anchor-minder Odile, the name of Viridel's lost traveller. Every
// person you meet (the people book, src/story/people-book.js, and every world's people, src/levels/content.js) has a name
// no one else has, and none takes a name the story gives someone you never meet (docs/story-bible.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

await import('./register-gadgets.js');
const { EVERYONE } = await import('../src/story/people-book.js');
const { CONTENT } = await import('../src/levels/content.js');

const BIBLE = readFileSync(new URL('../docs/story-bible.md', import.meta.url), 'utf8');
// the people of the story you never meet, by name: they are told of (a log, a grave, a call home)
const TOLD_OF = {
  Odile: 'Viridel: Odile and Talo, whose ship fell; their stones on the Lantern’s point',
  Talo: 'Viridel: Odile and Talo',
  Orrin: 'home: the Orrins, the father’s neighbours who never came to dig out the well, and the Orrin boy',
};
const first = (name) => name.replace(/^(Madame|Mother|Sister|Brother|Aunt|The) /, '').split(' ')[0];

test('the people told of are in the story bible, and nobody you meet has their names', () => {
  for (const n of Object.keys(TOLD_OF)) assert.match(BIBLE, new RegExp(`\\b${n}`), `${n} is in docs/story-bible.md`);
  const bad = [];
  for (const p of EVERYONE) if (TOLD_OF[first(p.name)]) bad.push(`${p.world}: ${p.name} (${TOLD_OF[first(p.name)]})`);
  for (const [w, c] of Object.entries(CONTENT)) for (const n of c?.npcs ?? []) if (n.name && TOLD_OF[first(n.name)]) bad.push(`${w}: ${n.name} (${TOLD_OF[first(n.name)]})`);
  assert.deepEqual(bad, []);
});

test('one name, one person: in the people book and among every world’s people', () => {
  const ids = new Map();
  const add = (name, id, where) => { if (!name || !id) return; const k = first(name); if (!ids.has(k)) ids.set(k, new Map()); ids.get(k).set(id, where); };
  for (const p of EVERYONE) add(p.name, p.id, `the book, ${p.world}`);
  for (const [w, c] of Object.entries(CONTENT)) for (const n of c?.npcs ?? []) add(n.name, n.id, w);
  const shared = [...ids].filter(([, m]) => m.size > 1).map(([k, m]) => `${k}: ${[...m].map(([id, w]) => `${id} (${w})`).join(', ')}`);
  assert.ok(ids.size > 100, `${ids.size} names`);
  assert.deepEqual(shared, []);
  // the two renamed in v1.61: the scientist and the anchor-minder
  assert.equal(EVERYONE.find((p) => p.id === 'thrum')?.name, 'Anselm Thrum');
  assert.equal(CONTENT.spacecity.npcs.find((n) => n.id === 'tilde')?.name, 'Tilde');
});
