// The stone hand's riddle (src/story/knuckle-riddle.js), made fair after the 2026-10-08 playtest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RIDDLE, riddleState, strikeKnuckle, nextKnuckle, dots, glinting, knuckleRadius } from '../src/story/knuckle-riddle.js';
import { KNUCKLE_ORDER, KNUCKLE_LINES, KNUCKLE_HINT_STEP, THINGS, LOCALS } from '../src/story/arzach-data.js';
import { parseLine } from '../src/story/tone.js';

const O = KNUCKLE_ORDER;

test('the order is smallest finger to tallest: little, index, ring, middle', () => {
  assert.deepEqual(O, [3, 0, 2, 1]);
});

test('the right order rings it; each right knuckle says so', () => {
  const s = riddleState();
  assert.equal(nextKnuckle(s, O), 3);
  assert.deepEqual(O.slice(0, 3).map((i) => strikeKnuckle(s, i, O).result), ['right', 'right', 'right']);
  assert.equal(strikeKnuckle(s, O[3], O).result, 'rung');
  assert.equal(s.misses, 0);
  assert.equal(nextKnuckle(s, O), null);
  assert.equal(strikeKnuckle(s, 0, O).result, 'done', 'rung: a knuckle only chimes');
});

test('a wrong knuckle breaks the chain (bug: before, a wrong hit rang its bell as a right one did)', () => {
  const s = riddleState();
  strikeKnuckle(s, 3, O); strikeKnuckle(s, 0, O);
  const r = strikeKnuckle(s, 1, O);
  assert.equal(r.result, 'wrong');
  assert.deepEqual(s.seq, [], 'the chain starts again');
  // a miss on the first knuckle starts the chain from it
  strikeKnuckle(s, 3, O);
  assert.equal(strikeKnuckle(s, 3, O).result, 'wrong');
  assert.deepEqual(s.seq, [3]);
  assert.equal(strikeKnuckle(s, 0, O).result, 'right', 'and goes on from there');
});

test('hints come with misses: Kesh calls the order on the second, the next knuckle glints from the third', () => {
  const s = riddleState();
  assert.equal(strikeKnuckle(s, 1, O).hint, null, 'the first miss: only the knock');
  assert.equal(glinting(s), false);
  assert.equal(strikeKnuckle(s, 2, O).hint, 'call');
  assert.equal(RIDDLE.hint, 2);
  assert.equal(strikeKnuckle(s, 0, O).hint, 'glint');
  assert.equal(glinting(s), true);
  assert.equal(nextKnuckle(s, O), 3, 'the glint is on the little finger first');
  strikeKnuckle(s, 3, O);
  assert.equal(nextKnuckle(s, O), 0, 'then moves on along the chain');
});

test('the clues can be read by looking: dots one to four, stones and fingers graded in size', () => {
  assert.deepEqual([3, 0, 2, 1].map((i) => dots(i, O)), [1, 2, 3, 4]);
  const r = O.map((i) => knuckleRadius(i, O));
  for (let k = 1; k < r.length; k++) assert.ok(r[k] - r[k - 1] >= 0.4, `each stone clearly bigger than the last (${r})`);
});

test('the hints are written down: Kesh’s call names the order and the dots; the journal spells it; the hand says so', () => {
  for (const l of Object.values(KNUCKLE_LINES)) assert.ok(parseLine(l).explicit, `a tone: ${l}`);
  assert.match(KNUCKLE_LINES.call, /Little.*First.*Ring.*Middle/s);
  assert.match(KNUCKLE_LINES.call, /dots/i);
  assert.match(KNUCKLE_HINT_STEP, /little.*one dot.*first.*two.*ring.*three.*middle.*four/s);
  assert.match(THINGS.palm.talk.nodes.look.say.join(' '), /taller than the last/);
  assert.match(THINGS.palm.talk.nodes.look.say.join(' '), /one, two, three, four/);
  const kesh = LOCALS.find((p) => p.id === 'hollin');
  assert.match(kesh.talk.nodes.again.say.join(' '), /dots/);
});
