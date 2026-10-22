import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateView } from '../src/updates.js';
import { UnityUpdates } from '../engine/unity/updates.js';
const base = { platform: 'unity', web: 100, app: 90, native: 4, check: 'apk', latest: 101, latestMin: 5 };
const view = p => updateView({ ...base, player: { supported: true, ...p } });

test('player update has honest progress, busy and failure states without claiming readiness', () => {
  assert.equal(view({ state: 'available', size: 200 }).actions[0].label, 'Update player and restart');
  const v = view({ state: 'downloading', got: 30, total: 100 });
  assert.equal(v.progress, .3); assert.equal(v.busy, true); assert.deepEqual(v.actions, []);
  for (const state of ['busy', 'offline', 'error', 'current']) {
    const r = view({ state, detail: 'Keep playing.' });
    assert.equal(r.detail, 'Keep playing.'); assert.ok(!r.actions.some(a => /restart/.test(a.a)));
  }
  assert.equal(view({ state: 'ready' }).actions[0].a, 'player-restart');
});

test('old and standalone players never offer an unusable player-update call', () => {
  for (const player of [undefined, { supported: false, guidance: 'Use your installer.' }]) {
    const v = updateView({ ...base, native: 3, player });
    assert.ok(!v.actions.some(a => a.a.startsWith('player')));
    assert.match(v.detail, /installer|quit and relaunch/i);
  }
  let reads = 0;
  const u = new UnityUpdates({ host: { UpdateInfo: () => JSON.stringify({ ...base, native: 3 }), get PlayerUpdateInfo() { reads++; throw Error('old host'); } } });
  u.read(); assert.equal(reads, 0);
});

test('accepted update saves once, asks native revalidation, and waits through failure', () => {
  const calls = []; let state = 'available';
  const host = { UpdateInfo: () => JSON.stringify(base), PlayerUpdateInfo: () => JSON.stringify({ supported: true, state }),
    PlayerUpdateDownload: () => { calls.push('download'); state = 'downloading'; },
    PlayerUpdateRestart: () => { calls.push('revalidate'); state = 'checking'; } };
  const u = new UnityUpdates({ host, save: () => calls.push('save') });
  u.read(); u.act('player-download'); assert.deepEqual(calls, ['download']);
  u.act('player-download'); u.act('player-restart'); assert.deepEqual(calls, ['download']);
  state = 'ready'; u.read(); assert.deepEqual(calls, ['download', 'save', 'revalidate']);
  u.read(); assert.equal(calls.length, 3);
  state = 'error'; u.read(); assert.equal(u.view().actions[0].a, 'player-check');
});

test('save failure never invokes native player restart', () => {
  let invoked = false;
  const u = new UnityUpdates({ host: { UpdateInfo: () => JSON.stringify(base), PlayerUpdateInfo: () => JSON.stringify({ supported: true, state: 'ready' }), PlayerUpdateRestart: () => { invoked = true; } }, save: () => { throw Error('disk full'); } });
  u.read(); u.act('player-restart'); assert.equal(invoked, false); assert.match(u.failed, /disk full/);
});
