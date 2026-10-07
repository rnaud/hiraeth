import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markBooted, buildLabel, updateStatus, installAppShell } from '../src/native-app.js';

test('the boot heartbeat flag is set after the first frame', () => {
  const win = {};
  markBooted(win);
  assert.equal(win.__moebiusBooted, true);
  assert.equal(typeof win.__moebiusBootedAt, 'number');
  // main.js: right after the first frame(t), in the requestAnimationFrame that ends the loading
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /import \{[^}]*\bmarkBooted\b[^}]*\} from '\.\/native-app\.js';/);
  const boot = main.slice(main.lastIndexOf("stage('ready')"));
  assert.match(boot, /requestAnimationFrame\(\(t\) => \{\s*(?:renderer\.domElement\.style\.visibility = '';\s*)?frame\(t\);\s*markBooted\(\);/);   // (the canvas shown first: hidden under the loading screen)
  // and the app polls exactly that flag, in either engine (WebBundles asks its Host)
  const java = (f) => readFileSync(new URL(`../android/app/src/main/java/com/rnaud/moebius/${f}`, import.meta.url), 'utf8');
  assert.match(java('WebBundles.java'), /host\.booted\(\(v\) -> \{/);
  assert.match(java('WebViewActivity.java'), /evaluateJavascript\("window\.__moebiusBooted===true"/);
  assert.match(java('MainActivity.java'), /post\(json\("ask", "booted", "id", id\)\)/);
  assert.match(readFileSync(new URL('../android/app/src/main/assets/memento-ext/content.js', import.meta.url), 'utf8'),
    /m\.ask === 'booted'\) port\.postMessage\(\{ answer: m\.id, value: window\.wrappedJSObject\.__moebiusBooted === true \}\)/);
});

test('the build label', () => {
  assert.equal(buildLabel({ web: 14, app: 12, bundle: true }), 'web build 14 · app 12');
  assert.equal(buildLabel({ web: 12, app: 12, bundle: false }), 'web build 12 (built in) · app 12');
  assert.equal(buildLabel({ web: 14, app: 12, bundle: true, ready: 15, readyVersion: '0.37' }), 'web build 14 · app 12 · update v0.37 (build 15) ready');
  assert.equal(buildLabel(null), '');
});

test('the update status says plainly whether this is the newest game', () => {
  assert.equal(updateStatus({ web: 16, app: 14, check: 'current', latest: 16 }), 'Up to date (build 16)');
  assert.equal(updateStatus({ web: 16, app: 14, check: 'downloading', latest: 17 }), 'Build 17 available, downloading…');
  assert.equal(updateStatus({ web: 16, app: 14, check: 'ready', ready: 17, latest: 17 }), 'Build 17 downloaded: restart to play it');
  assert.match(updateStatus({ web: 16, app: 14, check: 'offline' }), /^Offline/);
  assert.match(updateStatus({ web: 16, app: 14, check: 'apk', latest: 20 }), /newer app/);
  assert.equal(updateStatus({ web: 16, app: 14 }), '', 'older apps report no check: no line');
});

function fakeApp(info, store = new Map()) {
  const win = new EventTarget();
  win.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  win.__moebiusBootedAt = -1e9;   // the game has been up for a while
  win.document = Object.assign(new EventTarget(), { hidden: false, createElement: () => ({ style: {}, addEventListener(t, f) { this.click = f; } }) });
  const calls = [];
  win.Capacitor = { isNativePlatform: () => true, nativePromise: (plugin, method) => { calls.push(`${plugin}.${method}`); return Promise.resolve(method === 'info' ? info : undefined); } };
  const label = { hidden: true, textContent: '', kids: [], append(b) { this.kids.push(b); } };
  const log = [];
  const sound = { ctx: { state: 'running', suspend: async () => log.push('suspend'), resume: async () => log.push('resume') }, start: () => log.push('start') };
  const toasts = [];
  installAppShell({ sound, label: () => label, toast: (t) => toasts.push(t) }, win);
  return { win, calls, label, log, toasts };
}
// a few turns of the timers, so the page's chained answers all land even on a busy machine
const tick = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 5)); };

test('in the app: the label, the update toast and restart now', async () => {
  const a = fakeApp({ native: 2, app: 12, web: 14, bundle: true, ready: 15, readyVersion: '0.37' });
  await tick();
  assert.equal(a.label.hidden, false);
  assert.equal(a.label.textContent, 'web build 14 · app 12 · update v0.37 (build 15) ready');
  assert.deepEqual(a.toasts, ['Update ready (v0.37): it starts at the title screen, or choose Restart now in the Menu']);
  a.label.kids[0].click();
  assert.deepEqual(a.calls, ['AppShell.info', 'AppShell.restart']);
  a.win.dispatchEvent(new Event('moebius:webupdate'));   // the app told us about a download
  await tick();
  assert.equal(a.toasts.length, 1, 'one toast per update');
});

test('in the app: the update toast shows once, not again on the next world', async () => {
  const store = new Map(), info = { native: 3, app: 18, web: 18, bundle: true, ready: 19, readyVersion: '0.39' };
  const first = fakeApp(info, store); await tick();
  assert.equal(first.toasts.length, 1);
  const next = fakeApp(info, store); await tick();   // another world: a new page
  assert.equal(next.toasts.length, 0);
  const newer = fakeApp({ ...info, ready: 20 }, store); await tick();
  assert.equal(newer.toasts.length, 1, 'a newer download is told again');
});

test('in the app: the pad starts the sound, but not while the app is away (src/audio-guard.js, tests/audio-guard.test.js)', async () => {
  const a = fakeApp({ native: 2, app: 12, web: 12, bundle: false, ready: 0 });
  a.win.dispatchEvent(new Event('moebius:pause'));
  a.win.dispatchEvent(new Event('nativepadconnected'));   // (the pad's reset as the app leaves)
  a.win.document.hidden = true; a.win.document.dispatchEvent(new Event('visibilitychange'));
  a.win.dispatchEvent(new Event('moebius:resume'));   // (still hidden: wait for the page to show)
  a.win.dispatchEvent(new Event('nativepadconnected'));
  a.win.document.hidden = false; a.win.document.dispatchEvent(new Event('visibilitychange'));
  a.win.dispatchEvent(new Event('nativepadconnected'));
  await tick();
  assert.deepEqual(a.log, ['start']);
  assert.equal(a.label.textContent, 'web build 12 (built in) · app 12');
});

test('in a browser it does nothing', () => {
  assert.equal(installAppShell({}, { Capacitor: undefined }), null);
  assert.equal(installAppShell({}, undefined), null);
});
