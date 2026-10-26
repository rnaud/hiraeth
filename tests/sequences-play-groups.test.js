import test from 'node:test';
import assert from 'node:assert/strict';
import { SEQUENCES, glob as sequencePattern } from '../engine/sequences.js';
import { STREAM_DIFFS } from '../engine/bridge-stream-gaps.js';
import { FIGHTS } from './sequences-fights.js';
import { playPartition } from './sequences-play-groups.js';

test('play partitions cover every original sequence exactly once and retain stale-diff checks', () => {
  const original = SEQUENCES.filter(s => !s.id.startsWith('moment-') && !['opening','hold','plumb-talk'].includes(s.id) && !FIGHTS.has(s.id));
  const groups = ['main','games','outdoors'].map(name => SEQUENCES.filter(s => playPartition(s) === name));
  const ids = groups.flat().map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), original.map(s => s.id).sort());
  for (const entry of STREAM_DIFFS) {
    const scope = SEQUENCES.filter(s => sequencePattern(entry.seq ?? '*').test(s.id));
    if (scope.length && scope.every(s => original.includes(s))) {
      assert.equal(new Set(scope.map(playPartition)).size, 1, `preserve stale-entry check: ${entry.seq}`);
    }
  }
  assert.equal(playPartition({id:'future-play-case'}), 'main');
  assert.equal(playPartition({id:'game-future'}), 'games');
});

test('public sequence pattern alias retains wildcard, alternatives and literal metacharacters', () => {
  assert.ok(sequencePattern('a*|b').test('abc'));
  assert.ok(sequencePattern('a*|b').test('b'));
  assert.equal(sequencePattern('a*|b').test('cb'), false);
  assert.ok(sequencePattern('a.b+[x]').test('a.b+[x]'));
  assert.equal(sequencePattern('a.b+[x]').test('aZbxx'), false);
});
