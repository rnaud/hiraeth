import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareVersions, isNewerBuild, formatBytes, formatAgo, updateView, armedStep, STATES, SETTINGS_NATIVE } from '../src/updates.js';
import { applyReadyUpdate, callApp, inApp } from '../src/native-app.js';
import { nativeApi } from '../scripts/release-info.mjs';

const java = (name) => readFileSync(new URL(`../android/app/src/main/java/com/rnaud/moebius/${name}`, import.meta.url), 'utf8');
const base = { native: 4, app: 104, web: 104, bundle: false, ready: 0, readyVersion: '', latest: 104, latestVersion: '0.55', latestMin: 4, size: 0, got: 0, total: 0, error: '', notes: [], checkedAt: 0 };
const at = (o) => ({ ...base, ...o });
const NOW = 1_800_000_000_000;

test('versions compare by their numbers, builds against everything on the device', () => {
  assert.ok(compareVersions('0.9', '0.10') < 0);
  assert.ok(compareVersions('0.55', '0.56') < 0);
  assert.ok(compareVersions('1.0', '0.99') > 0);
  assert.equal(compareVersions('0.55', '0.55'), 0);
  assert.equal(compareVersions('0.5', '0.5.0'), 0);
  assert.ok(compareVersions('0.56', '') > 0);
  assert.equal(isNewerBuild(110, at({})), true);
  assert.equal(isNewerBuild(104, at({})), false);
  assert.equal(isNewerBuild(110, at({ ready: 110 })), false, 'already downloaded');
  assert.equal(isNewerBuild(105, at({ web: 106 })), false);
});

test('sizes and times, said plainly', () => {
  assert.equal(formatBytes(4791464), '4.6 MB');
  assert.equal(formatBytes(820 * 1024), '820 KB');
  assert.equal(formatBytes(10), '1 KB');
  assert.equal(formatBytes(0), '');
  assert.equal(formatAgo(NOW - 5000, NOW), 'just now');
  assert.equal(formatAgo(NOW - 5 * 60e3, NOW), '5 min ago');
  assert.equal(formatAgo(NOW - 3 * 3600e3, NOW), '3 h ago');
  assert.equal(formatAgo(NOW - 2 * 86400e3, NOW), '2 days ago');
  assert.equal(formatAgo(0, NOW), '');
});

test('the states are the app\'s (UpdateRules.java)', () => {
  const rules = java('UpdateRules.java');
  const listed = /States: ([\w, ]+)\./.exec(rules)?.[1].split(', ');
  assert.deepEqual(listed, STATES);
  assert.equal(SETTINGS_NATIVE, 4, 'the settings\' buttons (check, download, openApk) came with NATIVE_API 4');
  assert.ok(SETTINGS_NATIVE <= nativeApi(), 'this app has them');
  for (const m of ['check', 'download', 'restart', 'openApk', 'info']) assert.match(java('AppShellPlugin.java'), new RegExp(`public void ${m}\\(PluginCall call\\)`), m);
});

const actions = (v) => v.actions.map((b) => b.a);

test('each state: what the settings say and offer', () => {
  const o = { version: '0.55', now: NOW };
  assert.equal(updateView(null), null, 'not in the app: no section');
  assert.equal(updateView({ native: 4 }), null);

  let v = updateView(at({ check: 'current', checkedAt: NOW - 120e3 }), o);
  assert.equal(v.title, 'You have the newest game');
  assert.equal(v.detail, 'Checked 2 min ago.');
  assert.equal(v.running, 'v0.55 · build 104 (built in) · app 104');
  assert.deepEqual(actions(v), ['check']);

  v = updateView(at({ check: 'checking' }), o);
  assert.equal(v.busy, true);
  assert.deepEqual(actions(v), []);

  const notes = ['one', 'two', 'three', 'four', 'five', 'six'];
  v = updateView(at({ check: 'available', latest: 110, latestVersion: '0.56', size: 4791464, notes }), o);
  assert.equal(v.title, 'v0.56 · build 110 is available (4.6 MB)');
  assert.deepEqual(v.notes, ['one', 'two', 'three', 'four']);
  assert.equal(v.more, 2);
  assert.deepEqual(actions(v), ['download', 'check']);
  assert.equal(v.actions[0].label, 'Download and restart');
  assert.equal(v.actions[0].primary, true);
  assert.match(v.detail, /saves are kept/);

  v = updateView(at({ check: 'downloading', latest: 110, latestVersion: '0.56', got: 2395732, total: 4791464 }), { ...o, armed: true });
  assert.equal(v.progress, 0.5);
  assert.equal(v.progressText, '50% · 2.3 MB of 4.6 MB');
  assert.equal(v.busy, true);
  assert.match(v.detail, /restarts when it is done/);
  assert.match(updateView(at({ check: 'downloading', latest: 110, size: 1000, got: 0, total: 0 }), o).progressText, /^0%/, 'the size from web.json until the download says');
  assert.match(updateView(at({ check: 'downloading', latest: 110 }), o).detail, /keep playing/, 'a download in the background');

  v = updateView(at({ check: 'ready', ready: 110, readyVersion: '0.56', latest: 110 }), o);
  assert.equal(v.title, 'v0.56 · build 110 is downloaded');
  assert.deepEqual(actions(v), ['restart']);
  assert.match(v.detail, /title screen/);

  v = updateView(at({ check: 'apk', latest: 120, latestVersion: '0.60', latestMin: 5, apkVersion: '0.60' }), o);
  assert.match(v.title, /^v0\.60 · build 120 needs a new version of the app/);
  assert.deepEqual(actions(v), ['apk', 'check']);
  assert.equal(v.actions[0].label, 'Get the new app');
  assert.match(v.detail, /saves are kept/);

  // the APK feed (GitHub) out of reach: a quiet note, the game's own updates go on
  v = updateView(at({ check: 'current', checkedAt: NOW - 120e3, native: 5, apkCheck: 'failed' }), o);
  assert.equal(v.title, 'You have the newest game');
  assert.equal(v.detail, 'Checked 2 min ago. Couldn\'t check for a new app.');
  assert.deepEqual(actions(v), ['check']);
  assert.equal(updateView(at({ check: 'current', checkedAt: NOW - 120e3, apkCheck: 'ok' }), o).detail, 'Checked 2 min ago.');
  assert.match(updateView(at({ check: 'apk', latest: 120, latestMin: 6, apkCheck: 'failed' }), o).detail, /saves are kept\. Couldn't check for a new app\.$/);
  assert.equal(updateView(at({ check: 'available', latest: 110, apkCheck: 'failed' }), o).detail.includes('new app'), false, 'never in the way of an update');

  v = updateView(at({ check: 'offline' }), o);
  assert.equal(v.title, 'You\'re offline');
  assert.deepEqual(actions(v), ['check']);

  v = updateView(at({ check: 'error', error: 'IOException: HTTP 503', latest: 104 }), o);
  assert.match(v.detail, /HTTP 503/);
  assert.deepEqual(actions(v), ['check']);
  v = updateView(at({ check: 'error', error: 'SocketException: reset', latest: 110 }), o);
  assert.deepEqual(actions(v), ['download'], 'a download that broke off goes on from there');
  v = updateView(at({ check: 'error', latest: 120, latestMin: 5 }), o);
  assert.deepEqual(actions(v), ['check'], 'not a download this app can take');

  v = updateView(at({ check: 'off' }), o);
  assert.deepEqual(actions(v), []);
  v = updateView(at({ check: 'idle' }), o);
  assert.deepEqual(actions(v), ['check']);
  v = updateView(at({ check: 'something new' }), o);
  assert.equal(v.state, 'idle', 'an unknown state reads as not checked');

  v = updateView(at({ check: 'ready', ready: 110 }), { ...o, restarting: true });
  assert.equal(v.state, 'restarting');
  assert.deepEqual(actions(v), []);

  v = updateView(at({ check: 'current' }), { ...o, failed: 'The check couldn\'t start' });
  assert.match(v.detail, /^The check couldn't start\./);

  v = updateView(at({ bundle: true, web: 106 , check: 'current' }), o);
  assert.equal(v.running, 'v0.55 · build 106 · app 104');
});

test('an app from before the settings\' buttons: the old line, and Restart now when ready', () => {
  const o = { version: '0.55', now: NOW };
  let v = updateView({ native: 3, app: 90, web: 95, bundle: true, ready: 0, check: 'current', latest: 95 }, o);
  assert.equal(v.legacy, true);
  assert.deepEqual(actions(v), []);
  v = updateView({ native: 3, app: 90, web: 95, bundle: true, ready: 97, readyVersion: '0.54', check: 'ready', latest: 97 }, o);
  assert.deepEqual(actions(v), ['restart']);
  assert.equal(v.title, 'v0.54 · build 97 is downloaded');
});

test('"Download and restart": restart once ready, stop waiting on a failure', () => {
  assert.equal(armedStep(at({ check: 'downloading' })), 'wait');
  assert.equal(armedStep(at({ check: 'checking' })), 'wait');
  assert.equal(armedStep(at({ check: 'ready', ready: 110 })), 'restart');
  assert.equal(armedStep(at({ check: 'ready', ready: 0 })), 'stop', 'nothing actually there');
  assert.equal(armedStep(at({ check: 'offline' })), 'stop');
  assert.equal(armedStep(at({ check: 'error' })), 'stop');
  assert.equal(armedStep(null), 'stop');
});

function fakeWin(info, { restart = () => Promise.resolve() } = {}) {
  const calls = [], session = new Map();
  const win = {
    sessionStorage: { getItem: (k) => session.get(k) ?? null, setItem: (k, v) => session.set(k, v) },
    Capacitor: {
      isNativePlatform: () => true,
      nativePromise: (plugin, method) => { calls.push(method); return method === 'restart' ? restart() : Promise.resolve(info); },
    },
  };
  return { win, calls };
}

test('the title screen is the safe point: a downloaded update starts there, once', async () => {
  let a = fakeWin(at({ ready: 110 }));
  assert.equal(await applyReadyUpdate(a.win), true);
  assert.deepEqual(a.calls, ['info', 'restart']);
  assert.equal(await applyReadyUpdate(a.win), false, 'not twice for one build in one session (no loop)');
  a = fakeWin(at({ ready: 0 }));
  assert.equal(await applyReadyUpdate(a.win), false);
  assert.deepEqual(a.calls, ['info']);
  a = fakeWin(at({ ready: 110 }), { restart: () => Promise.reject(new Error('no update ready')) });
  assert.equal(await applyReadyUpdate(a.win), false, 'the title shows anyway');
  assert.equal(await applyReadyUpdate({}), false, 'in a browser');
  // an app that doesn't answer doesn't hold up the title
  const slow = { sessionStorage: null, Capacitor: { isNativePlatform: () => true, nativePromise: () => new Promise(() => {}) } };
  const t = Date.now();
  assert.equal(await applyReadyUpdate(slow, { timeout: 30 }), false);
  assert.ok(Date.now() - t < 1000);
  // boot.js asks before the title, in the app only
  const boot = readFileSync(new URL('../src/boot.js', import.meta.url), 'utf8');
  assert.ok(boot.indexOf('applyReadyUpdate()') > 0 && boot.indexOf('applyReadyUpdate()') < boot.indexOf('await showTitle()'));
});

test('callApp: the app\'s answer or its refusal', async () => {
  const { win } = fakeWin(at({}));
  assert.equal(inApp(win), true);
  assert.equal(inApp({}), false);
  assert.deepEqual(await callApp('info', win), at({}));
  await assert.rejects(callApp('info', {}), /not in the app/);
});

test('the settings carry the update section in the app, and save before an update restarts', () => {
  const ui = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /\$\{isNativeApp \|\| isDeckApp \|\| isXboxApp \? '<section class="updates" hidden><\/section>' : ''\}/, 'the Android app, the Steam Deck and the Xbox app');
  assert.match(ui, /new UpdatePanel\(el\.querySelector\('\.updates'\), \{ onBeforeRestart \}\)/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /onBeforeRestart: \(\) => \{ if \(!player\.riding && !ship\.playing\) writeSave\(\); flushPlay\(\); reactiveWorld\.flush\(\); \}/);
  const panel = readFileSync(new URL('../src/update-panel.js', import.meta.url), 'utf8');
  assert.ok(panel.indexOf('await this.onBeforeRestart?.()') < panel.indexOf("await callApp('restart'"), 'saved first');
});
