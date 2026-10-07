// The Steam Deck's Updates section: the Android panel (src/update-panel.js, src/updates.js) answered
// by the runtime (desktop/deck-updates.mjs, desktop/main.mjs, deck.py --status / --update).
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deckInfo, deckUpdates, plan, RESTART_EXIT } from '../desktop/deck-updates.mjs';
import { updateView, armedStep } from '../src/updates.js';
import { callApp, inApp } from '../src/native-app.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const running = { web: 812, bundle: false, runtime: 814001 };
const local = { runtime: 814001, runtimeVersion: '0.74', desktop: 1, nextWeb: 812, nextVersion: '0.74' };
const game = { build: 830, version: '0.75', size: 16_000_000, minDesktop: 1, notes: ['A new menu', 'Cabs'] };
const status = (o = {}) => ({ ...local, checkedAt: 1000, game, runtimeFeed: { build: 814001, version: '0.74', size: 158_000_000 }, ...o });
const view = (info, o = {}) => updateView(info, { version: '0.74', now: 61_000, ...o });

test('the Deck says what runs and what is new, in the Android panel\'s words', () => {
  let i = deckInfo({ running, local, status: null, desktop: 1 });
  assert.equal(i.check, 'idle');
  let v = view(i);
  assert.equal(v.running, 'v0.74 · build 812 (built in) · runtime 814001');
  assert.equal(v.legacy, false, 'every Deck runtime has the buttons');
  assert.deepEqual(v.actions.map((b) => b.a), ['check']);

  i = deckInfo({ running, local, status: status(), desktop: 1 });
  assert.equal(i.check, 'available');
  v = view(i);
  assert.equal(v.title, 'v0.75 · build 830 is available (15.3 MB)');
  assert.deepEqual(v.notes, ['A new menu', 'Cabs']);
  assert.deepEqual(v.actions.map((b) => b.a), ['download', 'check']);

  i = deckInfo({ running, local, status: status({ game: { ...game, build: 812 } }), desktop: 1 });
  assert.equal(view(i).title, 'You have the newest game');
  assert.equal(deckInfo({ running, local, status: status({ offline: true, gameError: 'x' }), desktop: 1 }).check, 'offline');
});

test('a newer runtime comes too, one bar over both downloads; a game for a newer runtime waits', () => {
  const s = status({ runtimeFeed: { build: 830001, version: '0.75', size: 100 } });
  const p = plan(running, local, s, 1);
  assert.deepEqual([p.runtime, p.game, p.size], [true, true, 100 + game.size]);
  const job = { kind: 'download', running: true, plan: p, step: 'game', got: 1000 };
  const i = deckInfo({ running, local, status: s, job, desktop: 1 });
  assert.equal(i.check, 'downloading');
  assert.equal(i.got, 1100, 'the runtime first, then the game');
  assert.equal(i.total, 100 + game.size);
  const waits = deckInfo({ running, local, status: status({ game: { ...game, minDesktop: 2 } }), desktop: 1 });
  assert.equal(waits.check, 'current');
  assert.match(waits.error, /newer Memento app/);
});

test('what the next launch runs is ready: Restart now, and no loop after a restart that didn\'t take', () => {
  const next = { ...local, nextWeb: 830, nextVersion: '0.75' };
  const i = deckInfo({ running, local: next, status: status(), desktop: 1 });
  assert.deepEqual([i.check, i.ready, i.readyVersion], ['ready', 830, '0.75']);
  assert.equal(armedStep(i), 'restart', 'Download and restart restarts once it is here');
  assert.deepEqual(view(i).actions.map((b) => b.a), ['restart']);
  const runtime = deckInfo({ running, local: { ...local, runtime: 830001, runtimeVersion: '0.75' }, status: null, desktop: 1 });
  assert.deepEqual([runtime.check, runtime.ready], ['ready', 830001]);
  assert.equal(deckInfo({ running, local: next, status: status(), desktop: 1, restartedFor: '830' }).ready, 0);
});

/** A fake deck.py: answers --status / --status-local / --update as told, writing what --update would. */
function fakeDeck(root, answers) {
  const calls = [];
  const run = (python, args) => {
    calls.push(args);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      const kind = args.find((a) => a.startsWith('--') && a !== '--root' && a !== '--progress');
      const a = answers[kind]?.(args) ?? { code: 0, out: '' };
      if (a.out) child.stdout.emit('data', a.out);
      child.emit('close', a.code);
    });
    return child;
  };
  return { run, calls };
}

test('the panel\'s calls run deck.py: check, download with progress, restart through deck.py', async () => {
  const root = mkdtempSync(join(tmpdir(), 'deck-updates-'));
  let next = local;
  const deck = fakeDeck(root, {
    '--status': () => ({ code: 0, out: JSON.stringify(status({ ...next })) }),
    '--status-local': () => ({ code: 0, out: JSON.stringify(next) }),
    '--update': (args) => { writeFileSync(args[args.indexOf('--progress') + 1], JSON.stringify({ step: 'game', got: 5, total: 10 })); next = { ...local, nextWeb: 830, nextVersion: '0.75' }; return { code: 0 }; },
  });
  const u = deckUpdates({ root, deckPy: '/app/deck.py', running, desktop: 1, run: deck.run, env: {} });
  let i = await u.check();
  assert.equal(i.check, 'checking');
  await u.job.done;
  i = await u.info();
  assert.equal(i.check, 'available');
  i = await u.download();
  assert.equal(i.check, 'downloading');
  await u.job.done;
  i = await u.info();
  assert.deepEqual([i.check, i.ready], ['ready', 830]);
  await u.restart();
  assert.equal(readFileSync(join(root, '.restart'), 'utf8').trim(), '830', 'deck.py reads which update the restart is for');
  assert.ok(deck.calls.every((a) => a[0] === '/app/deck.py' && a.includes('--root')));
  assert.equal(RESTART_EXIT, 76);
  assert.match(read('../scripts/steam-deck/deck.py'), /RESTART_EXIT = 76\b/);
});

test('the page reaches the Deck\'s runtime at moebius://game/__app/, the same calls as Android\'s', async () => {
  const asked = [];
  const win = { location: { protocol: 'moebius:' }, fetch: async (url, o) => { asked.push([url, o.method]); return { ok: true, json: async () => ({ web: 812 }) }; } };
  assert.equal(inApp(win), true);
  assert.deepEqual(await callApp('info', win), { web: 812 });
  assert.deepEqual(asked, [['/__app/info', 'POST']]);
  const refused = { location: { protocol: 'moebius:' }, fetch: async () => ({ ok: false, status: 404, text: async () => 'Not on this app' }) };
  await assert.rejects(callApp('openApk', refused), /Not on this app/);
  assert.equal(inApp({ location: { protocol: 'https:' }, fetch() {} }), false, 'the web game');
  const main = read('../desktop/main.mjs');
  assert.match(main, /url\.pathname\.startsWith\('\/__app\/'\)/);
  assert.match(main, /app\.exit\(RESTART_EXIT\)/);
  assert.match(read('../scripts/package-steam-deck.mjs'), /desktop\/deck-updates\.mjs/);
});
