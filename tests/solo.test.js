import test from 'node:test';
import assert from 'node:assert/strict';
import { SOLO_TUNE } from '../src/audio.js';
import { PEOPLE } from '../src/story/desert-data.js';

test('Bako’s solo: an unhurried tune that comes home to its tonic', () => {
  const len = SOLO_TUNE.flat().reduce((a, [, d]) => a + d, 0);
  assert.ok(len > 25 && len < 45, `${len.toFixed(1)} s of playing`);
  for (const phrase of SOLO_TUNE) assert.equal(phrase.at(-1)[0], 0, 'every breath ends on the tonic');
  // the hijaz colour: the flat second and the augmented second up to the major third
  const notes = new Set(SOLO_TUNE.flat().map(([n]) => ((n % 12) + 12) % 12));
  assert.ok(notes.has(1) && notes.has(4) && !notes.has(2) && !notes.has(3));
});

test('asking Bako to play starts it', () => {
  const nodes = PEOPLE.bako.talk.nodes;
  const asks = [...nodes.hello.choices, ...nodes.ney.choices].filter((c) => c.do?.emit?.[0] === 'music:solo');
  assert.equal(asks.length, 2);
  for (const c of asks) assert.equal(c.do.emit[1].who, 'bako');
});
