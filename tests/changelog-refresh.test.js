// What's new's Refresh (issue #114, src/changelog-refresh.js): the site reloads the page, an app fetches the
// newest game over the air and restarts into it, saving first; the button is in the page for the mouse and the pad.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { refreshChangelog } from '../src/changelog-refresh.js';

const base = { native: 6, app: 104, web: 104, bundle: true, ready: 0, latest: 104, latestVersion: '1.49', latestMin: 4, check: 'idle' };
/** A pretend app: each call moves it along the states listed for it. */
function fakeApp(script) {
  const calls = [];
  let info = { ...base };
  const app = async (m) => {
    calls.push(m);
    const next = script[m]?.shift?.();
    if (next instanceof Error) throw next;
    if (next) info = { ...info, ...next };
    return info;
  };
  return { app, calls };
}
const run = (o) => {
  const said = [], log = { reload: 0, saved: 0 };
  return refreshChangelog({ reload: () => { log.reload++; }, say: (t) => said.push(t), beforeRestart: () => { log.saved++; }, version: '1.49', sleep: async () => {}, ...o })
    .then((r) => ({ r, said, ...log }));
};

test('on the site, Refresh reloads the page (the newest changelog comes with it)', async () => {
  const { r, reload, said } = await run({ app: null });
  assert.equal(r, 'reload');
  assert.equal(reload, 1);
  assert.match(said[0], /newest/);
});

test('in the app, a newer game is checked for, downloaded, saved for and restarted into', async () => {
  const { app, calls } = fakeApp({
    check: [{ check: 'checking' }],
    info: [{}, { check: 'available', latest: 120, latestVersion: '1.50' }, { check: 'downloading', got: 5, total: 10 }, { check: 'ready', ready: 120, readyVersion: '1.50' }],
    download: [{ check: 'downloading', got: 1, total: 10 }],
  });
  const { r, reload, saved, said } = await run({ app });
  assert.equal(r, 'restart');
  assert.deepEqual(calls.filter((c) => c !== 'info'), ['check', 'download', 'restart']);
  assert.equal(saved, 1, 'the game is saved before the restart');
  assert.equal(reload, 0, 'no reload: the bundle on the device is the same');
  assert.ok(said.some((s) => /Downloading v1\.50/.test(s)), said.join(' | '));
  assert.ok(said.some((s) => /restarting/.test(s)));
});

test('in the app with nothing newer, it says so and stays', async () => {
  const { app, calls } = fakeApp({ check: [{ check: 'current', checkedAt: 1 }] });
  const { r, reload, said } = await run({ app });
  assert.equal(r, 'current');
  assert.equal(reload, 0);
  assert.ok(!calls.includes('restart'));
  assert.equal(said.at(-1), 'You have the newest game.');
});

test('in the app: offline, a new app needed, a check that fails, an app too old to check', async () => {
  assert.equal((await run({ app: fakeApp({ check: [{ check: 'offline' }] }).app })).r, 'offline');
  const apk = await run({ app: fakeApp({ check: [{ check: 'apk', latest: 130, apkVersion: '1.50' }] }).app });
  assert.equal(apk.r, 'apk');
  assert.match(apk.said.at(-1), /new version of the app.*Settings/);
  assert.equal((await run({ app: fakeApp({ check: [new Error('no')] }).app })).r, 'error');
  const old = await run({ app: fakeApp({ info: [{ native: 3 }] }).app });
  assert.equal(old.r, 'reload', 'an app before NATIVE_API 4 reloads, as on the site');
});

test('a check that never ends gives up quietly', async () => {
  let t = 0;
  const { app } = fakeApp({ check: [{ check: 'checking' }] });
  const { r } = await run({ app, now: () => (t += 1000), timeout: 5000 });
  assert.equal(r, 'timeout');
});

test('the page has the button, the pad\'s Y / △ and R, and the game saves before a restart', () => {
  const html = readFileSync(new URL('../changelog.html', import.meta.url), 'utf8');
  assert.match(html, /<button class="btn" id="refresh" type="button"/);
  assert.match(html, /id="refresh-note" role="status"/);
  const page = readFileSync(new URL('../src/changelog-page/main.js', import.meta.url), 'utf8');
  assert.match(page, /name === 'y'\) refresh\(\)/, 'the pad\'s Y / △');
  assert.match(page, /glyph\('y', \{ key: 'R' \}\)\}Refresh/);
  assert.match(page, /e\.code === 'KeyR'/);
  assert.match(page, /addEventListener\('click', refresh\)/);
  const game = readFileSync(new URL('../src/changelog.js', import.meta.url), 'utf8');
  assert.match(game, /window\.changelogBeforeRestart = /);
  assert.match(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), /new Changelog\(\{ onBeforeRestart: saveBeforeRestart \}\)/);
});
