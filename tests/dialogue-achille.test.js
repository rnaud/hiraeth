import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game-state.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { PEOPLE } from '../src/temples/underwater-data.js';

const memory = () => {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
};
const expectedHint = "Roll a ball onto the dish’s footstone. Stand on the floor beside the dish, clear of the ball. Jump and stomp with the spring boots while the Listener’s ear is open.";

test('Achille visited-house hint follows real choices without granting progress and survives private state reload', () => {
  const storage = memory(), game = new GameState(storage);
  // Explicit conversation fixture: prior meeting/visit, not earned temple access.
  game.set('met.achille', true);
  game.set('temple.underwater.entered', true);
  const before = structuredClone(game.data);
  function conversation(state) {
    const r = new DialogueRunner(PEOPLE.achille, { game: state });
    assert.equal(r.nodeId, 'inside');
    assert.equal(r.pages.length, 2);
    assert.equal(r.choose(0), false, 'early choice cannot bypass the first page');
    assert.equal(r.nodeId, 'inside');
    assert.equal(r.advance(), true);
    const choices = r.choices();
    assert.deepEqual(choices.map(c => c.text), ['It shuts its ear to anything close.', 'I’m going back.']);
    assert.equal(r.choose(choices[0].index), true);
    assert.equal(r.nodeId, 'near');
    assert.equal(r.pages.length, 2);
    assert.equal(r.text, 'It was built to hear the whales from far off. The makers never sang to its face. They sang into the dishes.');
    assert.deepEqual(r.choices(), []);
    assert.equal(r.choose(0), false);
    assert.equal(r.advance(), true);
    assert.equal(r.text, expectedHint);
    assert.equal(r.tone, 'neutral');
    assert.deepEqual(r.choices().map(c => c.text), ['I’ll try that.']);
    assert.equal(r.choose(r.choices()[0].index), true);
    assert.equal(r.ended, true);
    assert.deepEqual(state.data, before, 'hint must not change flags, items or keepsakes');
    assert.equal(state.flag('temple.underwater.done'), undefined);
  }
  conversation(game);
  game.save();
  conversation(new GameState(storage));
});

test('Achille completed-house entry still takes precedence over the visited-house hint', () => {
  const game = new GameState(memory());
  game.set('met.achille', true);
  game.set('temple.underwater.entered', true);
  game.set('temple.underwater.done', true); // Explicit entry-selection fixture only.
  const before = structuredClone(game.data);
  const r = new DialogueRunner(PEOPLE.achille, { game });
  assert.equal(r.nodeId, 'after');
  assert.deepEqual(game.data, before);
});
