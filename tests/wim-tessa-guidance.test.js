import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/game-state.js';
import { DialogueRunner } from '../src/story/dialogue.js';
import { PEOPLE as garage } from '../src/temples/garage-data.js';
import { PEOPLE as spheres } from '../src/temples/spheres-data.js';

function context() {
  const values = new Map(), started = [];
  const game = new GameState({ getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) });
  return { game, started, quests: { start: id => started.push(id) } };
}

test('Wim’s real first conversation teaches the returning tool without changing quest acceptance', () => {
  const ctx = context(), r = new DialogueRunner(garage.wim, ctx);
  assert.equal(r.nodeId, 'hello');
  assert.equal(ctx.game.flag('met.wim'), true);
  r.advance(); r.advance();
  r.choose(0);
  assert.equal(r.nodeId, 'go');
  assert.deepEqual(ctx.started, ['temple.garage']);
  assert.match(r.text, /door under the clock/);
  assert.deepEqual(r.choices(), [], 'instruction remains two pages');
  r.advance();
  assert.match(r.text, /boomerang/);
  assert.match(r.text, /several targets on one throw/);
  assert.doesNotMatch(r.text, /makes you faster|Ordinary speed/);
  assert.equal(r.choices().length, 1);
  assert.match(r.choices()[0].text, /Several at once/);
  r.choose(0);
  assert.equal(r.ended, true);
  assert.equal(!!ctx.game.flag('temple.garage.done'), false);
  assert.equal(!!ctx.game.flag('item.boomerang'), false, 'advice must not grant the tool');
});

test('Tessa’s actual return question teaches splash and lens without completing the house', () => {
  const ctx = context();
  ctx.game.set('met.tessa', true); ctx.game.set('temple.spheres.entered', true);
  const r = new DialogueRunner(spheres.tessa, ctx);
  assert.equal(r.nodeId, 'inside'); r.advance(); r.choose(0);
  assert.equal(r.nodeId, 'answer');
  assert.match(r.text, /splash the sphere/);
  assert.match(r.text, /lens.*walker’s print/);
  assert.doesNotMatch(r.text, /notes in order/);
  assert.equal(r.choices().length, 1, 'answer remains one page with its original reply');
  assert.match(r.choices()[0].text, /I will/);
  r.choose(0); assert.equal(r.ended, true);
  assert.deepEqual(ctx.started, []);
  assert.equal(!!ctx.game.flag('temple.spheres.done'), false);
  assert.equal(!!ctx.game.flag('item.monocle'), false);
});
