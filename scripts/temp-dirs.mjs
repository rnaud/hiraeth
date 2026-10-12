// Temporary directories and the processes using them, removed when the process ends however it ends (issue #220:
// headless Chrome profiles of 300–800 MB each, left behind by runs that failed, timed out or were stopped, filled
// 17 GB of TMPDIR in a day). docs/systems/dev-tools.md, "Temporary profiles".
//
//   import { tempDir, ownProcess } from '<…>/scripts/temp-dirs.mjs';
//   const profile = tempDir('hiraeth-shots-chrome-');           // mkdtemp in TMPDIR (or `base`), removed at exit
//   const proc = ownProcess(spawn(CHROME, [`--user-data-dir=${profile}`, …]));   // killed at exit, before the removal
//   tempPath(file)                                              // a file (or dir) of your own naming, removed at exit
//   removeTemp(profile)                                         // now, when done with it early
//   keepTemp(dir)                                               // not at all after all (an output asked for)
//
// At exit: a normal end, process.exit, an uncaught exception or unhandled rejection, SIGINT / SIGTERM / SIGHUP (a
// signal no one else listens for ends the process, as it would have; one the script handles itself is left to it,
// and its own exit cleans up). Only SIGKILL leaves anything behind.
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir, constants } from 'node:os';
import { join } from 'node:path';

const paths = new Set(), procs = new Set();
let installed = false;

function kill(p) {
  try { if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL'); } catch { /* gone */ }
}
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);   // (sync: exit can't await)
/** The processes still running with `path` in their command line (Chrome's helpers: its GPU, network, renderers). */
function users(path) {
  if (process.platform === 'win32') return [];
  // (the path whole: followed by a space, a slash or the end, never another run's /tmp/x-12 for /tmp/x-1)
  const r = spawnSync('pgrep', ['-f', path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |/|$)'], { encoding: 'utf8' });
  return (r.stdout ?? '').split('\n').map(Number).filter((pid) => pid && pid !== process.pid);
}
function remove(path, settle = false) {
  // (a Chrome killed a moment ago still has helpers writing its profile, and writes it again after a removal: until
  // nothing runs in it and it stays gone, a second or two at most)
  for (let round = 0; round < 40; round++) {
    const left = users(path);
    for (const pid of left) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
    try { rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch { /* in use: again */ }
    if (!left.length && (round > 0 || !settle) && !existsSync(path)) return;
    pause(left.length ? 100 : 50);
  }
}

/** Kill the owned processes and remove every registered path now (also what exit does). */
export function cleanupTemps() {
  const settle = procs.size > 0;
  for (const p of procs) kill(p);
  procs.clear();
  for (const path of paths) remove(path, settle);
  paths.clear();
}

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];
function install() {
  if (installed) return;
  installed = true;
  process.on('exit', cleanupTemps);
  for (const sig of SIGNALS) {
    const on = () => {
      cleanupTemps();
      // (the script's own handler, if it has one, decides when to end; else end as the signal would have)
      if (process.listenerCount(sig) <= 1) process.exit(128 + (constants.signals[sig] ?? 1));
    };
    process.on(sig, on);
  }
}

/** A path (file or directory) to remove when the process ends. */
export function tempPath(path) {
  install();
  paths.add(path);
  return path;
}

/** A new directory `prefix` + six random characters in `base` (TMPDIR), removed when the process ends. */
export function tempDir(prefix, base = tmpdir()) {
  return tempPath(mkdtempSync(join(base, prefix)));
}

/** Remove a registered path now (when done with it before the end). */
export function removeTemp(path) {
  paths.delete(path);
  remove(path);
}

/** Keep a registered path after all (an output asked for: --keep-png). */
export function keepTemp(path) {
  paths.delete(path);
  return path;
}

/** A child process (headless Chrome, a server) killed when this process ends, before the temp paths are removed. */
export function ownProcess(child) {
  install();
  procs.add(child);
  child.once?.('exit', () => procs.delete(child));
  return child;
}
