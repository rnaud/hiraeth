// Shared helpers of the web-vs-Unity benchmark (docs/benchmark-web-vs-unity.md).
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const VIEWPOINTS = resolve(ROOT, 'scripts/bench/viewpoints.json');
export const viewpoints = () => JSON.parse(readFileSync(VIEWPOINTS, 'utf8'));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return String(e.stdout ?? ''); } };

/** median, 95th, 99th percentile, mean, max of a list of numbers (positive, finite ones) */
export function stats(list) {
  const a = list.filter((x) => Number.isFinite(x) && x > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const q = (p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
  const r = (x) => +x.toFixed(3);
  return { median: r(q(0.5)), p95: r(q(0.95)), p99: r(q(0.99)), mean: r(a.reduce((s, x) => s + x, 0) / a.length), max: r(a[a.length - 1]), n: a.length };
}
/** frames that took over twice the median (and 4 ms more): the stutter count */
export const hitches = (frames, med) => frames.filter((x) => x > 2 * med && x > med + 4).length;
export const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

/** a process's memory (macOS footprint): the whole and its graphics share (Metal / IOSurface / IOAccelerator) */
export function footprint(pid) {
  const out = run('footprint', ['-f', 'bytes', '-p', String(pid)]);
  const total = +(out.match(/Footprint: (\d+) B/)?.[1] ?? NaN);
  let graphics = 0;
  for (const l of out.split('\n')) { const m = l.match(/^\s*(\d+) B\s+\d+ B\s+\d+ B\s+\d+\s+(.*)$/); if (m && /graphics|IOAccelerator|IOSurface/i.test(m[2])) graphics += +m[1]; }
  return { total, graphics };
}
/** pids whose command line matches (pgrep -f) */
export const pidsOf = (pattern) => run('pgrep', ['-f', pattern]).split('\n').map(Number).filter(Boolean);
/** footprints summed over processes */
export function footprints(pids) {
  let total = 0, graphics = 0;
  for (const p of pids) { const f = footprint(p); if (Number.isFinite(f.total)) { total += f.total; graphics += f.graphics; } }
  return { total, graphics, processes: pids.length };
}
/** Sample a set of processes' footprint every `every` ms until stopped: { peak, last } */
export function memorySampler(getPids, every = 3000) {
  let peak = { total: 0, graphics: 0 }, last = null, stop = false;
  (async () => { while (!stop) { const pids = getPids(); if (pids.length) { last = footprints(pids); if (last.total > peak.total) peak = last; } await sleep(every); } })();
  return { stop() { stop = true; return { peak, last }; }, now: () => last };
}

/** processes using the CPU besides ours (ps' %CPU, a decaying average on macOS) */
export function busyProcesses({ threshold = 15, exclude = [] } = {}) {
  const out = run('ps', ['-Ao', 'pid=,ppid=,pcpu=,rss=,command=']);
  const rows = out.split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .map((m) => ({ pid: +m[1], ppid: +m[2], cpu: +m[3], rssMB: Math.round(+m[4] / 1024), cmd: m[5].slice(0, 160) }));
  const mine = new Set([process.pid, ...exclude]);
  // (our own children: Chrome, the Unity player)
  let grew = true; while (grew) { grew = false; for (const r of rows) if (!mine.has(r.pid) && mine.has(r.ppid)) { mine.add(r.pid); grew = true; } }
  return rows.filter((r) => r.cpu >= threshold && !mine.has(r.pid) && !/\bps -Ao\b|WindowServer|kernel_task|footprint/.test(r.cmd));   // (the compositor works for us)
}
/** Unity editors or batch jobs running anywhere (another worktree's agent, the user's open editor) */
export const unityJobs = () => run('ps', ['-Ao', 'pid=,pcpu=,command=']).split('\n').filter((l) => /Unity\.app\/Contents\/MacOS\/Unity /.test(l) && !/AssetImportWorker/.test(l))
  .map((l) => { const m = l.trim().match(/^(\d+)\s+([\d.]+)\s+(.*)$/); return m && { pid: +m[1], cpu: +m[2], batch: /-batchmode/i.test(m[3]), project: m[3].match(/-projectpath\s+(\S+)/i)?.[1] }; }).filter(Boolean);

/**
 * Wait until nothing else heavy runs (another agent's Unity batch job, a build): every `every` s, up to
 * `maxWait` s. Returns what was seen, for the results (`background`).
 */
export async function waitQuiet({ threshold = 40, every = 20, maxWait = 900, log = console.error } = {}) {
  const t0 = Date.now(); const seen = [];
  for (;;) {
    const busy = busyProcesses({ threshold });
    const batch = unityJobs().filter((u) => u.batch && u.cpu > 5);
    if (!busy.length && !batch.length) return { waited: Math.round((Date.now() - t0) / 1000), seen, load: os.loadavg().map((x) => +x.toFixed(2)) };
    seen.push({ at: new Date().toISOString(), busy: busy.map((b) => `${b.cpu}% ${b.cmd.slice(0, 80)}`), batch: batch.map((b) => `${b.cpu}% unity batch ${b.project}`) });
    if ((Date.now() - t0) / 1000 > maxWait) { log(`bench: still busy after ${maxWait} s, measuring anyway`); return { waited: Math.round((Date.now() - t0) / 1000), seen, load: os.loadavg().map((x) => +x.toFixed(2)), busy: true }; }
    log(`bench: waiting for a quiet machine: ${[...seen.at(-1).busy, ...seen.at(-1).batch].join('; ')}`);
    await sleep(every * 1000);
  }
}

export function machine() {
  const sw = run('sw_vers', ['-productVersion']).trim();
  return { cpu: os.cpus()[0]?.model, cores: os.cpus().length, memGB: Math.round(os.totalmem() / 2 ** 30), os: `macOS ${sw}`, node: process.version };
}

/** bytes of a file or a folder */
export function sizeOf(p) {
  try {
    const s = statSync(p);
    if (!s.isDirectory()) return s.size;
    return readdirSync(p).reduce((a, f) => a + sizeOf(join(p, f)), 0);
  } catch { return 0; }
}
