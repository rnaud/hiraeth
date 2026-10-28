// The relics (five yellow shards a world) went in v2.34 (issue #732): the fragments of the singing light are what
// is found. No world places one, no foe guards one, nothing counts them, and the end of the road asks only for
// every world's story (an old save's `journal.relics` stays in its data, unread: tests/save-migrate.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT, ORDER } from '../src/levels/content.js';
import { roadDone, ROAD } from '../src/story/ending.js';
import * as quest from '../src/quest.js';
import { ROSTERS, CLASSIC } from '../src/foe-worlds.js';
import { FRAGMENTS } from '../src/fragments-data.js';

test('no world has relics, and no roster guards one', () => {
  for (const [id, c] of Object.entries(CONTENT)) assert.equal(c?.relics, undefined, `${id} has no relics`);
  for (const [id, R] of Object.entries({ ...ROSTERS, classic: CLASSIC })) assert.equal(R.guards, undefined, `${id}: no relic guards`);
  assert.equal(quest.Relics, undefined, 'no Relics to place');
  for (const id of ORDER) assert.ok(FRAGMENTS[id]?.length > 0, `${id}: fragments of the singing light to find instead`);
});

test('the end of the road: every world’s story told, whatever relics an old save kept', () => {
  const order = ['desert', 'arzach'];
  assert.equal(roadDone({ order, storyDone: () => true }), true);
  assert.equal(roadDone({ order, storyDone: () => true, relicCount: () => 0, relics: () => 5 }), true, 'no relic asked for');
  assert.equal(roadDone({ order, storyDone: (id) => id === 'desert' }), false, 'a story still to tell');
  assert.equal(roadDone({ order: [], storyDone: () => true }), false, 'no route, no end');
  assert.doesNotMatch(Object.values(ROAD).join(' '), /small things|relic/i, 'its words count no relics');
});
