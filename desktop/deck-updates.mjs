// The settings' Updates section on the Steam Deck: the same panel as the Android app's
// (src/update-panel.js, src/updates.js), answered by the runtime instead of AppShellPlugin.
// The page calls moebius://game/__app/<method> (src/native-app.js); desktop/main.mjs hands it here.
//
//   info      what runs, what the next launch would run, the last check, a download's progress,
//             the update log: the same fields as Android's AppShell.info (platform 'deck')
//   check     deck.py --status: the newest game (the site's web.json) and runtime (the site, GitHub)
//   download  deck.py --update --progress <file>: the runtime and the game, verified, for the next launch
//   restart   writes .restart and exits RESTART_EXIT: deck.py launches again, into the update
//
// deck.py does every download and install (one place for the checksums, locks and pins); this
// only runs it and says how it went. Pure parts (deckInfo) are tested in tests/deck-updates.test.js.
import { spawn } from 'node:child_process';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** deck.py's RESTART_EXIT: launch again into the update. */
export const RESTART_EXIT = 76;

const read = (file, fallback = '') => { try { return readFileSync(file, 'utf8'); } catch { return fallback; } };
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };

/**
 * What the settings show, in AppShell.info's fields (src/updates.js updateView).
 * @param o.running   { web, bundle, runtime } what runs now
 * @param o.local     deck.py local_state: { runtime, runtimeVersion, desktop, nextWeb, nextVersion } (what the next launch runs)
 * @param o.status    the last deck.py --status (or null): + checkedAt, game, runtimeFeed, gameError, offline
 * @param o.job       { kind: 'check' | 'download', running, error, plan, step, got }
 * @param o.desktop   this runtime's DESKTOP_API
 * @param o.restartedFor  the update a restart was for (MOEBIUS_RESTARTED_FOR): not offered again
 */
export function deckInfo({ running, local, status, job = null, desktop, restartedFor = '', log = '' }) {
  local = local ?? { runtime: running.runtime, nextWeb: running.web, desktop };
  const readyRuntime = local.runtime > running.runtime ? local.runtime : 0;
  const readyWeb = local.nextWeb > running.web ? local.nextWeb : 0;
  let ready = readyWeb || readyRuntime;
  if (ready && String(ready) === String(restartedFor)) ready = 0;   // (restarted for it, and it didn't come: no loop)
  const p = plan(running, local, status, desktop);
  const info = {
    platform: 'deck', native: desktop, app: running.runtime, web: running.web, bundle: !!running.bundle,
    check: 'idle', latest: p.latest, latestVersion: p.latestVersion, latestMin: p.latestMin,
    size: p.size, got: 0, total: 0, ready, readyVersion: ready ? (readyWeb ? local.nextVersion : local.runtimeVersion) || '' : '',
    notes: p.notes, checkedAt: status?.checkedAt || 0, error: '', log,
  };
  if (job?.running && job.kind === 'check') info.check = 'checking';
  else if (job?.running && job.kind === 'download') {
    const q = job.plan ?? p;
    info.check = 'downloading';
    info.total = q.size;
    // (the runtime downloads first, then the game: one bar over both)
    info.got = Math.min(q.size || Infinity, (job.step === 'game' && q.runtime ? q.runtimeSize : 0) + (job.got || 0));
  } else if (ready) info.check = 'ready';
  else if (job?.error) Object.assign(info, { check: 'error', error: job.error });
  else if (!status) info.check = 'idle';
  else if (status.offline) info.check = 'offline';
  else if (status.gameError && !p.runtime) Object.assign(info, { check: 'error', error: 'The game\'s site didn\'t answer' });
  else if (p.runtime || p.game) info.check = 'available';
  else {
    info.check = 'current';
    if (p.waits) info.error = 'The newest game needs a newer Memento app, which isn\'t out yet.';
  }
  return info;
}

/** What a download would bring: the runtime when the feeds have a newer one, the game when the site does. */
export function plan(running, local, status, desktop) {
  const haveWeb = Math.max(running.web || 0, local?.nextWeb || 0), haveRuntime = Math.max(running.runtime || 0, local?.runtime || 0);
  const game = status?.game, feed = status?.runtimeFeed;
  const runtime = !!(feed?.build > haveRuntime);
  const newer = !!(game?.build > haveWeb);
  const fits = newer && game.minDesktop <= desktop;
  const out = {
    runtime, game: fits, waits: newer && !fits && !runtime,
    runtimeSize: runtime ? feed.size || 0 : 0,
    size: (runtime ? feed.size || 0 : 0) + (fits ? game.size || 0 : 0),
    latest: newer ? game.build : runtime ? feed.build : haveWeb,
    latestVersion: newer ? game.version : runtime ? feed.version : '',
    latestMin: newer ? game.minDesktop : desktop,
    notes: newer && Array.isArray(game.notes) ? game.notes : [],
  };
  return out;
}

/** The updater behind the panel: runs deck.py, keeps the last check and the download's state. */
export function deckUpdates({ root, deckPy, python = 'python3', running, desktop, run = spawn, now = () => Date.now(), env = process.env }) {
  const progressFile = path.join(root, '.update-progress.json');
  let status = null, local = null, localAt = 0, job = null;
  const restartedFor = env.MOEBIUS_RESTARTED_FOR ?? '';

  const deck = (args, { stdout = 'pipe' } = {}) => new Promise((resolve) => {
    let out = '', err = '';
    let child;
    try {
      child = run(python, [deckPy, ...args, '--root', root], { stdio: ['ignore', stdout, stdout === 'pipe' ? 'pipe' : stdout] });
    } catch (error) { resolve({ code: -1, out, err: error.message }); return; }
    child.stdout?.on('data', (d) => { out += d; });
    child.stderr?.on('data', (d) => { err += d; });
    child.on('error', (error) => resolve({ code: -1, out, err: error.message }));
    child.on('close', (code) => resolve({ code, out, err }));
  });

  const refreshLocal = async () => {
    const r = await deck(['--status-local']);
    const l = r.code === 0 ? json(r.out) : null;
    if (l) { local = l; localAt = now(); }
  };

  const log = () => [read(path.join(root, 'update.log')).trim(), read(path.join(root, 'launch.log')).trim()].filter(Boolean).join('\n\n');

  async function info() {
    if (!job?.running && now() - localAt > 5000) await refreshLocal();   // (a background update may have finished)
    if (job?.running && job.kind === 'download') {
      const p = json(read(progressFile));
      if (p) { job.step = p.step; job.got = p.got; }
    }
    return deckInfo({ running, local, status, job, desktop, restartedFor, log: log() });
  }

  async function check() {
    if (job?.running) return info();
    job = { kind: 'check', running: true };
    const done = deck(['--status']).then((r) => {
      const s = r.code === 0 ? json(r.out.trim().split('\n').pop()) : null;
      if (s) { status = s; local = { runtime: s.runtime, runtimeVersion: s.runtimeVersion, desktop: s.desktop, nextWeb: s.nextWeb, nextVersion: s.nextVersion }; localAt = now(); }
      job = s ? null : { kind: 'check', running: false, error: (r.err.trim().split('\n').pop() || 'The check didn\'t run').slice(0, 200) };
    });
    job.done = done;
    return info();
  }

  async function download() {
    if (job?.running) return info();
    if (!status) { await check(); await job?.done; }
    const p = plan(running, local, status, desktop);
    job = { kind: 'download', running: true, plan: p, step: p.runtime ? 'runtime' : 'game', got: 0 };
    try { writeFileSync(progressFile, '{}'); } catch { /* the bar waits */ }
    let fd = 'ignore';
    try { fd = openSync(path.join(root, 'update.log'), 'w'); } catch { /* no log */ }
    job.done = deck(['--update', '--progress', progressFile], { stdout: fd }).then(async (r) => {
      if (typeof fd === 'number') closeSync(fd);
      await refreshLocal();
      const failed = r.code !== 0;
      job = failed ? { kind: 'download', running: false, error: 'The download didn\'t come through' } : null;
      // (what was new is here now: check again so "available" doesn't linger)
      if (!failed) { const c = await deck(['--status']); const s = c.code === 0 ? json(c.out.trim().split('\n').pop()) : null; if (s) status = s; }
    });
    return info();
  }

  /** Ask deck.py to launch again (desktop/main.mjs exits RESTART_EXIT once this answers). */
  async function restart() {
    const i = await info();
    writeFileSync(path.join(root, '.restart'), `${i.ready || ''}\n`);
    return i;
  }

  return { info, check, download, restart, get job() { return job; } };
}
