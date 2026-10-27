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

// issue #715: the Android player too old for the newest game offers its download (the testers' APK) instead of waiting
test('a Unity Android player too old for the newest game offers Get the new player, opening the testers\' APK', () => {
  const v = updateView({ ...base, os: 'android', openUrl: true, player: { supported: false, guidance: 'This install cannot update its player here.' } });
  assert.match(v.title, /needs a newer version of the player/);
  assert.deepEqual(v.actions.map(a => [a.a, a.label, !!a.primary]), [['player-apk', 'Get the new player', true], ['check', 'Check again', false]]);
  assert.match(v.detail, /install it over this one\. Your saves are kept\./);
  assert.doesNotMatch(v.detail, /Steam Deck|installer/);
  // (a player that can't open links: the page's address instead of a button that does nothing)
  const old = updateView({ ...base, os: 'android', openUrl: false });
  assert.deepEqual(old.actions.map(a => a.a), ['check']);
  assert.match(old.detail, /github\.com\/rnaud\/hiraeth\/releases\/tag\/unity-android/);

  const opened = [];
  const host = { UpdateInfo: () => JSON.stringify(base), Platform: () => 'android', OpenUrl: (u) => opened.push(u), PlayerUpdateInfo: () => JSON.stringify({ supported: false }) };
  const u = new UnityUpdates({ host });
  u.read();
  assert.equal(u.view().actions[0].a, 'player-apk');
  u.act('player-apk');
  assert.deepEqual(opened, ['https://github.com/rnaud/hiraeth/releases/download/unity-android/hiraeth-unity.apk']);
  // (the feed's own link when it names one on the release; anything else falls back to the testers' APK)
  for (const [apk, want] of [['https://github.com/rnaud/hiraeth/releases/download/v2.31/hiraeth-unity.apk', 'https://github.com/rnaud/hiraeth/releases/download/v2.31/hiraeth-unity.apk'], ['https://evil.example/x.apk', opened[0]]]) {
    const got = [];
    const w = new UnityUpdates({ host: { ...host, UpdateInfo: () => JSON.stringify({ ...base, apk }), OpenUrl: (x) => got.push(x) } });
    w.read(); w.act('player-apk'); assert.deepEqual(got, [want]);
  }
  // (a failed open says so)
  const f = new UnityUpdates({ host: { ...host, OpenUrl: () => { throw Error('no browser'); } } });
  f.read(); f.act('player-apk'); assert.match(f.view().detail, /^The download couldn't open\./);
});

test('the Deck, the Xbox and Linux keep their own player wording, with no APK button', () => {
  const deck = updateView({ ...base, os: 'linux', player: { supported: true, state: 'available', size: 100 } });
  assert.equal(deck.actions[0].a, 'player-download');
  assert.ok(!deck.actions.some(a => a.a === 'player-apk'));
  const linux = updateView({ ...base, os: 'linux', openUrl: true });
  assert.match(linux.detail, /Steam Deck/); assert.ok(!linux.actions.some(a => a.a === 'player-apk'));
  const xbox = updateView({ ...base, os: 'xbox', openUrl: true });
  assert.match(xbox.detail, /Xbox package/); assert.doesNotMatch(xbox.detail, /Steam Deck/);
  assert.deepEqual(xbox.actions.map(a => a.a), ['check']);
  const guided = updateView({ ...base, os: 'xbox', player: { supported: false, guidance: 'Update it through its original installer, then relaunch.' } });
  assert.equal(guided.detail, 'Update it through its original installer, then relaunch.');
  // (a player older than OpenUrl, with no Platform either: as before)
  const u = new UnityUpdates({ host: { UpdateInfo: () => JSON.stringify(base) } });
  u.read(); assert.equal(u.info.openUrl, false); assert.ok(!u.view().actions.some(a => a.a === 'player-apk'));
});
