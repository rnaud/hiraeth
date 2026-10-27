// The Unity build stops as the web game does (issue #702): the same src/loco-moves.js stopSetting, read through the
// engines' page (engine/platform.js: localStorage kept by the engine's own storage, location.search from the host),
// carried unless snap was chosen; engine/game.js sets the player's stop from it as main.js does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installPlatform } from '../engine/platform.js';

test('in the engines: carried by default, the old key not read, a stored snap or ?stop=snap kept', async () => {
  const kept = new Map([['hiraeth.stopFeel', 'snap']]);   // (a device from before #702)
  const host = { storage: { get: (k) => kept.get(k), set: (k, v) => kept.set(k, v), remove: (k) => kept.delete(k) }, search: '' };
  installPlatform(host);
  const { stopSetting } = await import('../src/loco-moves.js');
  assert.equal(stopSetting.get(), 'carry');
  stopSetting.set('snap');
  assert.equal(kept.get('hiraeth.stop'), 'snap', 'into the engine\'s own storage');
  assert.equal(stopSetting.get(), 'snap');
  kept.delete('hiraeth.stop');
  globalThis.location.search = '?stop=snap';
  assert.equal(stopSetting.get(), 'snap', 'the query, as on the web');
  const game = readFileSync(new URL('../engine/game.js', import.meta.url), 'utf8');
  assert.match(game, /player\.stopFeel = stopSetting\.get\(\)/);
});
