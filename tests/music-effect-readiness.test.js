import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/music-page/player.js';
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Stop during effect preparation prevents activation; soundtrack preview skips failed effect preparation', async () => {
  const player = new Player(); let release, current = true, activated = 0, decoded = 0;
  player.prepareEffects = () => { decoded++; return new Promise(resolve => { release = resolve; }); };
  player.ready = async () => { activated++; return {}; };
  const pending = player.preparePreview({ effects: true, current: () => current });
  await settle(); current = false; release();
  assert.equal(await pending, null); assert.equal(activated, 0);
  player.prepareEffects = async () => { throw new Error('missing footstep'); };
  assert.ok(await player.preparePreview({ effects: false }));
  assert.equal(activated, 1); assert.equal(decoded, 1);
});

test('Stop during audio-clock readiness cannot launch the old effect after its owner is replaced', async () => {
  const player = new Player(); let release, current = true;
  player.prepareEffects = async () => {};
  player.ready = () => new Promise(resolve => { release = resolve; });
  const pending = player.preparePreview({ effects: true, current: () => current });
  await settle(); current = false; release({});
  assert.equal(await pending, null);
});

test('an explicit retry is passed through and successful preparation precedes activation', async () => {
  const player = new Player(), order = [];
  player.prepareEffects = async ({ retry }) => { order.push('prepare'); if (!retry) throw new Error('missing take'); };
  player.ready = async () => { order.push('activate'); return {}; };
  await assert.rejects(player.preparePreview({ effects: true }), /missing take/);
  assert.deepEqual(order, ['prepare']);
  assert.ok(await player.preparePreview({ effects: true, retry: true }));
  assert.deepEqual(order, ['prepare', 'prepare', 'activate']);
});
