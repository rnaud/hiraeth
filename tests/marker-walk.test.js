import test from 'node:test';
import assert from 'node:assert/strict';

// A marker that loops (issue #349): reached, it must move on and stay moved on; a way in through a door must not point
// straight back out (issue #351); a step finished only by what E offers there must say so in its words. Every world's
// quests at every step: .claude/skills/quest-qc/marker-walk.mjs.

const { walkMarkers, names } = await import('../.claude/skills/quest-qc/marker-walk.mjs');

test('a step’s words name the prompt that finishes it', () => {
  assert.ok(names('Take the rider’s flute from the tower’s window', 'take the rider’s flute'));
  assert.ok(names('Lay Sel’s notes on the cables under the Towers', 'lay a hand on the cables'));
  assert.ok(!names('Climb to the tallest tree’s crown', 'read the note on the post'), 'the crown reached was not the step done');
  assert.ok(!names('Climb the steps to the tower’s window', 'take the rider’s flute'));
});

test('every marker, walked to, moves on and stays moved on (issues #349, #351)', () => {
  const found = walkMarkers();
  assert.deepEqual(found.map((f) => `${f.world} ${f.at} [${f.kind}]: ${f.text}`), []);
});
