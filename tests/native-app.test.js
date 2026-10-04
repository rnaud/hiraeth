import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markBooted, buildLabel, installAppShell } from '../src/native-app.js';

test('the boot heartbeat flag is set after the first frame', () => {
  const win = {};
  markBooted(win);
  assert.equal(win.__moebiusBooted, true);
  assert.equal(typeof win.__moebiusBootedAt, 'number');
  // main.js: right after the first frame(t), in the requestAnimationFrame that ends the loading
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /import \{[^}]*\bmarkBooted\b[^}]*\} from '\.\/native-app\.js';/);
  const boot = main.slice(main.lastIndexOf("stage('ready')"));
  assert.match(boot, /requestAnimationFrame\(\(t\) => \{\s*frame\(t\);\s*markBooted\(\);/);
  // and the app polls exactly that flag
  const java = readFileSync(new URL('../android/app/src/main/java/com/rnaud/moebius/WebBundles.java', import.meta.url), 'utf8');
  assert.match(java, /evaluateJavascript\("window\.__moebiusBooted===true"/);
});

test('the build label', () => {
  assert.equal(buildLabel({ web: 14, app: 12, bundle: true }), 'web build 14 · app 12');
  assert.equal(buildLabel({ web: 12, app: 12, bundle: false }), 'web build 12 (built in) · app 12');
  assert.equal(buildLabel({ web: 14, app: 12, bundle: true, ready: 15, readyVersion: '0.37' }), 'web build 14 · app 12 · update v0.37 (build 15) ready');
  assert.equal(buildLabel(null), '');
});

function fakeApp(info) {
  const win = new EventTarget();
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
const tick = () => new Promise((r) => setTimeout(r, 5));

test('in the app: the label, the update toast and restart now', async () => {
  const a = fakeApp({ native: 2, app: 12, web: 14, bundle: true, ready: 15, readyVersion: '0.37' });
  await tick();
  assert.equal(a.label.hidden, false);
  assert.equal(a.label.textContent, 'web build 14 · app 12 · update v0.37 (build 15) ready');
  assert.deepEqual(a.toasts, ['Update ready (v0.37) — restart to apply']);
  a.label.kids[0].click();
  assert.deepEqual(a.calls, ['AppShell.info', 'AppShell.restart']);
  a.win.dispatchEvent(new Event('moebius:webupdate'));   // the app told us about a download
  await tick();
  assert.equal(a.toasts.length, 1, 'one toast per update');
});

test('in the app: sound pauses with the app and comes back', async () => {
  const a = fakeApp({ native: 2, app: 12, web: 12, bundle: false, ready: 0 });
  a.win.dispatchEvent(new Event('moebius:pause'));
  a.win.document.hidden = true; a.win.document.dispatchEvent(new Event('visibilitychange'));
  a.win.dispatchEvent(new Event('moebius:resume'));   // (still hidden: wait for the page to show)
  a.win.document.hidden = false; a.win.document.dispatchEvent(new Event('visibilitychange'));
  a.win.dispatchEvent(new Event('nativepadconnected'));
  await tick();
  assert.deepEqual(a.log, ['suspend', 'suspend', 'resume', 'start']);
  assert.equal(a.label.textContent, 'web build 12 (built in) · app 12');
});

test('in a browser it does nothing', () => {
  assert.equal(installAppShell({}, { Capacitor: undefined }), null);
  assert.equal(installAppShell({}, undefined), null);
});
