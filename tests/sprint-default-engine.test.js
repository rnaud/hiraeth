// The Unity build sprints as the web game does (issue #709): the same src/animator.js sprintSetting, read through the
// engines' page (engine/platform.js), Kevin Iglesias's unless the library's was chosen again; #704's key not read;
// engine/game.js loads it before the first frame, and a batch's -js-off kevinSprint asks for the library's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installPlatform } from '../engine/platform.js';

test('in the engines: Kevin Iglesias\'s sprint by default, the old key not read, a stored ual or ?sprint=ual kept', async () => {
  const kept = new Map([['hiraeth.sprint', 'ual']]);   // (a device that tried #704's switch and left it off)
  const host = { storage: { get: (k) => kept.get(k), set: (k, v) => kept.set(k, v), remove: (k) => kept.delete(k) }, search: '' };
  installPlatform(host);
  const { sprintSetting } = await import('../src/animator.js');
  assert.equal(sprintSetting.get(), 'kevin');
  sprintSetting.set('ual');
  assert.equal(kept.get('hiraeth.sprintLoop'), 'ual', 'into the engine\'s own storage');
  assert.equal(sprintSetting.get(), 'ual');
  kept.delete('hiraeth.sprintLoop');
  globalThis.location.search = '?sprint=ual';
  assert.equal(sprintSetting.get(), 'ual', 'the query, as on the web');
  const game = readFileSync(new URL('../engine/game.js', import.meta.url), 'utf8');
  assert.match(game, /const sprintAsk = sprint \?\? sprintSetting\.get\(\)/);
  const unity = readFileSync(new URL('../engine/unity/game.js', import.meta.url), 'utf8');
  assert.match(unity, /sprint: off\.has\('kevinSprint'\) \? 'ual'/);
});
