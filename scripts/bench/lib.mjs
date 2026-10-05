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
/** --key value command-line options */
export const options = (argv = process.argv.slice(2)) => Object.fromEntries(argv.join(' ').split(/(?:^|\s)--/).filter(Boolean).map((s) => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; }));

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

// ------------------------------------------------------------------ is the machine quiet?
/** every process: pid, parent, %CPU (ps' decaying average), resident MB, command line */
export function processes() {
  return run('ps', ['-Ao', 'pid=,ppid=,pcpu=,rss=,command=']).split('\n').map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .map((m) => ({ pid: +m[1], ppid: +m[2], cpu: +m[3], rssMB: Math.round(+m[4] / 1024), cmd: m[5] }));
}
/** our process tree: this script, the pids given (our server), and all their descendants */
function ours(rows, extra = []) {
  const mine = new Set([process.pid, process.ppid, ...extra]);
  let grew = true;
  while (grew) { grew = false; for (const r of rows) if (!mine.has(r.pid) && mine.has(r.ppid)) { mine.add(r.pid); grew = true; } }
  return mine;
}
const SYSTEM = /WindowServer|kernel_task|\/footprint\b|\bps -Ao\b|\/launchd|mds_stores|coreaudiod|\/pmset\b/;

/**
 * Is the machine quiet enough to measure? Not when, besides our own process tree (`mine`: the runner,
 * its server, the browser or the player it launched):
 *  - any Unity process runs (an editor, the user's own included; a batch job of another worktree; an
 *    import worker or shader compiler; another Memento player),
 *  - another automated browser runs (Playwright's Chrome, a headless shell, a --remote-debugging Chrome),
 *  - the user's own Chrome works (its GPU process or a renderer over 8 % CPU: a tab with a game in it),
 *  - a vite / esbuild / rolldown / node --test / gradle / IL2CPP job runs (other worktrees' builds and servers),
 *  - another process uses over `cpu` % of a core, or the load average (1 min) is over `maxLoad`,
 *  - the Mac is on battery or in low power mode, or reports a thermal or performance warning.
 * Returns { quiet, reasons, seen (the offending command lines, cut short), load, power, thermal }.
 */
export function quietCheck({ mine: extra = [], maxLoad = 4, cpu = 25 } = {}) {
  const rows = processes(), mine = ours(rows, extra);
  const reasons = [], seen = [], idle = [];
  const flag = (why, r) => { reasons.push(why); seen.push(`${r.pid} ${r.cpu}% ${r.cmd.slice(0, 140)}`); };
  for (const r of rows) {
    if (mine.has(r.pid) || SYSTEM.test(r.cmd)) continue;
    if (/\/Unity\.app\/Contents\/|UnityShaderCompiler|Unity Hub\.app\/Contents\/MacOS|Memento\.app\/Contents\/MacOS\/Memento/.test(r.cmd)) {
      if (/Unity Hub\.app/.test(r.cmd) && !/Unity\.app/.test(r.cmd) && r.cpu < 5) continue;   // (the Hub idling in the menu bar)
      flag(/-batchmode/i.test(r.cmd) && !/AssetImportWorker/.test(r.cmd) ? 'a Unity batch job' : /Memento\.app/.test(r.cmd) ? 'another Memento player'
        : /AssetImportWorker|ShaderCompiler/.test(r.cmd) ? 'a Unity import worker' : /Unity Hub/.test(r.cmd) ? 'the Unity Hub working' : 'a Unity editor', r);
    } else if (/chrome-headless-shell|Chrome for Testing|playwright|--remote-debugging-(pipe|port)|puppeteer/i.test(r.cmd)) flag('another automated browser', r);
    else if (/Google Chrome/.test(r.cmd) && /--type=(renderer|gpu-process)/.test(r.cmd)) { if (r.cpu > 8) flag('the user\'s Chrome is busy', r); }
    else if (/\bvite\b|esbuild|rolldown|node --test|gradle|il2cpp|bee_backend/i.test(r.cmd) && /node|java|bee|il2cpp|esbuild|rolldown/i.test(r.cmd)) {
      // (an idle dev server, the user's own on 5173 for one, doesn't count; one serving or building does)
      if (r.cpu > 2 || /node --test|gradle|il2cpp|bee_backend|vite build/.test(r.cmd)) flag('a build or dev server at work', r); else idle.push(`${r.pid} ${r.cmd.slice(0, 100)}`);
    }
    else if (r.cpu > cpu) flag(`a busy process (${r.cmd.split(' ')[0].split('/').pop()})`, r);
  }
  const load = os.loadavg().map((x) => +x.toFixed(2));
  if (load[0] > maxLoad) reasons.push(`load average ${load[0]} > ${maxLoad}`);
  const batt = run('pmset', ['-g', 'batt']), therm = run('pmset', ['-g', 'therm']), pm = run('pmset', ['-g']);
  const power = /AC Power/.test(batt) ? 'AC' : /Battery Power/.test(batt) ? 'battery' : 'unknown';
  if (power === 'battery') reasons.push('on battery');
  const lowPower = /(lowpowermode|powermode)\s+1/.test(pm);
  if (lowPower) reasons.push('low power mode');
  const thermal = therm.split('\n').map((l) => l.trim()).filter(Boolean).join(' / ');
  if (/CPU_Speed_Limit\s*=\s*(?!100\b)\d+/.test(therm) || (/warning level/i.test(therm) && !/No thermal warning level/.test(therm))) reasons.push('thermal warning');
  return { quiet: reasons.length === 0, reasons: [...new Set(reasons)], seen, idle, load, power, lowPower, thermal, at: new Date().toISOString() };
}

/** Wait for quiet (checking every `every` s, up to `maxWait` s); returns the last check, with `waited` s. */
export async function gate({ mine = [], maxWait = 1800, every = 20, log = console.error, ...o } = {}) {
  const t0 = Date.now();
  for (;;) {
    const q = quietCheck({ mine, ...o });
    q.waited = Math.round((Date.now() - t0) / 1000);
    if (q.quiet || q.waited >= maxWait) return q;
    log(`bench: not quiet (${q.reasons.join(', ')}): ${q.seen.slice(0, 4).join(' | ')}; waiting…`);
    await sleep(every * 1000);
  }
}

/** Keep checking while a run records (every `every` s); stop() gives every check that wasn't quiet. */
export function watchQuiet({ mine = () => [], every = 5, ...o } = {}) {
  const bad = []; let stop = false, n = 0;
  (async () => {
    while (!stop) {
      await sleep(every * 1000); if (stop) break;
      const q = quietCheck({ mine: mine(), ...o }); n++;
      if (!q.quiet) bad.push({ at: q.at, reasons: q.reasons, seen: q.seen.slice(0, 6), load: q.load });
    }
  })();
  return { stop() { stop = true; return { checks: n, bad }; } };
}

export function machine() {
  const sw = run('sw_vers', ['-productVersion']).trim();
  const model = run('sysctl', ['-n', 'hw.model']).trim();
  return { model, cpu: os.cpus()[0]?.model, cores: os.cpus().length, memGB: Math.round(os.totalmem() / 2 ** 30), os: `macOS ${sw}`, node: process.version };
}

/** bytes of a file or a folder */
export function sizeOf(p) {
  try {
    const s = statSync(p);
    if (!s.isDirectory()) return s.size;
    return readdirSync(p).reduce((a, f) => a + sizeOf(join(p, f)), 0);
  } catch { return 0; }
}
