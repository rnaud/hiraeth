// The page stays silent while the game is away (src/audio-guard.js): the Android app asleep, at
// home or in the recents, or the page hidden. The bug: on the Retroid the music went on with the
// screen off (GeckoView keeps a page that plays Web Audio running in the background, and the
// title screen and a loading world had nothing that suspended their sound).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audioGuard, audioAway } from '../src/audio-guard.js';
import { installAppShell } from '../src/native-app.js';

// a page with its own AudioContext class (as each real window has)
function page({ hidden = false, away = false, app = false } = {}) {
  const log = [];
  class AC extends EventTarget {
    constructor() { super(); this.state = 'running'; this.n = log.filter((l) => l === 'new').length; log.push('new'); }
    set(state) { this.state = state; this.dispatchEvent(new Event('statechange')); return Promise.resolve(); }
    resume() { log.push(`resume ${this.n}`); return this.set('running'); }
    suspend() { log.push(`suspend ${this.n}`); return this.set('suspended'); }
    close() { log.push(`close ${this.n}`); return this.set('closed'); }
  }
  const win = new EventTarget();
  win.document = Object.assign(new EventTarget(), { hidden });
  win.AudioContext = AC;
  if (away) win.__moebiusAway = true;
  if (app) win.Capacitor = { isNativePlatform: () => true, nativePromise: () => Promise.resolve(null) };
  const hide = (h) => { win.document.hidden = h; win.document.dispatchEvent(new Event('visibilitychange')); };
  const send = (name) => win.dispatchEvent(new Event(name));
  return { win, log, AC, hide, send };
}

test('every AudioContext is registered, suspended while away and resumed on return', () => {
  const p = page();
  const g = audioGuard(p.win);
  assert.equal(audioGuard(p.win), g, 'one guard per page');
  const a = new p.win.AudioContext(), b = new p.win.AudioContext();
  assert.ok(a instanceof p.AC, 'still the page\'s AudioContext');
  assert.deepEqual(g.contexts(), [a, b]);
  b.suspend();   // (one the game had suspended itself stays so)
  p.log.length = 0;
  p.send('moebius:pause');
  assert.equal(audioAway(p.win), true);
  assert.equal(p.win.__moebiusAway, true);
  assert.deepEqual(p.log, ['suspend 0', 'suspend 1']);
  p.log.length = 0;
  p.send('moebius:resume');
  assert.equal(audioAway(p.win), false);
  assert.deepEqual(p.log, ['resume 0'], 'only the one that was playing');
});

test('away blocks every resume until moebius:resume, and not while the page is hidden', () => {
  const p = page();
  const g = audioGuard(p.win);
  const ctx = new p.win.AudioContext();
  p.send('moebius:pause');
  p.hide(true);
  p.log.length = 0;
  ctx.resume();                         // a press, a pad, the game loop: nothing
  assert.equal(ctx.state, 'suspended');
  p.hide(false);                        // the page shows again (the lock screen), the app still away
  assert.equal(g.away(), true);
  assert.equal(ctx.state, 'suspended');
  p.send('moebius:resume');
  assert.equal(ctx.state, 'running');
  assert.deepEqual(p.log, ['resume 0']);
  // the app back but the page still hidden: silent until it shows
  p.send('moebius:pause'); p.hide(true); p.send('moebius:resume');
  assert.equal(g.away(), true);
  assert.equal(ctx.state, 'suspended');
  p.hide(false);
  assert.equal(ctx.state, 'running');
});

test('a context made while away starts suspended, and a deferred start runs on return', () => {
  const p = page({ away: true });   // a page that started while the app was away (window.__moebiusAway)
  const g = audioGuard(p.win);
  assert.equal(g.away(), true);
  const ctx = new p.win.AudioContext();
  assert.equal(ctx.state, 'suspended');
  let started = 0;
  g.whenBack(() => started++);
  assert.equal(started, 0);
  p.send('moebius:resume');
  assert.equal(started, 1);
  assert.equal(ctx.state, 'running', 'it was asked to play: it plays on return');
  g.whenBack(() => started++);
  assert.equal(started, 2, 'not away: at once');
});

test('a hidden or frozen page is away too; owners hear every change', () => {
  const p = page({ hidden: true });
  const g = audioGuard(p.win), seen = [];
  assert.equal(g.away(), true, 'hidden from the start');
  const off = g.on((away) => seen.push(away));
  p.hide(false);
  p.win.dispatchEvent(new Event('pagehide'));
  p.win.dispatchEvent(new Event('pageshow'));
  off();
  p.hide(true);
  assert.deepEqual(seen, [false, true, false]);
  // closed contexts are let go
  const ctx = new p.win.AudioContext();
  ctx.close();
  assert.deepEqual(g.contexts(), []);
});

test('in the app: the pad reconnecting while away starts nothing; the sound comes back with the app', async () => {
  const p = page({ app: true });
  const log = [];
  const sound = { ctx: null, start() { log.push('start'); if (!this.ctx) this.ctx = new p.win.AudioContext(); else this.ctx.resume(); } };
  installAppShell({ sound }, p.win);
  sound.start();
  p.send('moebius:pause');
  p.hide(true);
  p.send('nativepadconnected');         // the pad's reset or a reconnect while asleep
  assert.deepEqual(log, ['start'], 'nothing started while away');
  sound.start();                        // (the frame loop or an input asking anyway)
  assert.equal(sound.ctx.state, 'suspended');
  p.send('moebius:resume');
  p.hide(false);
  assert.equal(sound.ctx.state, 'running');
  p.send('nativepadconnected');
  assert.equal(log.length, 3);
});

test('the Sound starts nothing while away and mutes its master gain', async () => {
  const p = page({ away: true });
  const store = new Map();
  const saved = { window: globalThis.window, localStorage: globalThis.localStorage };
  globalThis.window = p.win;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    const { Sound } = await import('../src/audio.js');
    const s = new Sound('desert');
    assert.equal(s.ctx, null, 'a world that loads while the app is away stays silent');
    s.start(); s.start();
    assert.equal(s.ctx, null);
    assert.equal(s.masterLevel(), 0);
    // its master: hushed at once when away, back softly on return
    const calls = [];
    s.ctx = { currentTime: 3, state: 'running' };
    s.master = { gain: { cancelScheduledValues: (t) => calls.push(['cancel', t]), setValueAtTime: (v, t) => calls.push(['set', v, t]), setTargetAtTime: (v, t) => calls.push(['target', v, t]) } };
    s._away(true);
    assert.deepEqual(calls, [['cancel', 3], ['set', 0, 3]]);
    // (the deferred start runs on return: it finds this fake context playing and stops there)
    p.send('moebius:resume');
    assert.deepEqual(calls.at(-1), ['target', 0.9, 3]);
  } finally {
    globalThis.window = saved.window; globalThis.localStorage = saved.localStorage;
  }
});

test('the guard is in place before any sound: the title screen and a loading world are covered', () => {
  const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  const boot = src('boot.js');
  assert.ok(boot.indexOf('audioGuard();') < boot.indexOf("import('./title.js')"), 'boot installs it before the title');
  // (and a world that loads while away asks whether sound may start only on return: Chrome's probe would be suspended)
  assert.match(src('audio.js'), /this\.guard = audioGuard\(window\);[\s\S]*this\.guard\.whenBack\(\(\) => \{ if \(!this\._disposed && Sound\.mayStart\(window\)\) this\.start\(\); \}\);/);
  assert.match(src('audio.js'), /start\(\) \{\s*\/\/[^\n]*\n\s*if \(this\.guard\?\.away\(\)\)/);
  assert.match(src('story/arzach2.js'), /audioAway\(\)\) return false;/, 'the bell\'s own context');
});
