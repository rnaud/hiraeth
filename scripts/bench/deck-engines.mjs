// Every world on the Steam Deck in both engines, the web build (Electron, deck-run.sh + deck-worlds.mjs) and the Unity
// bridge's Linux player (deck-unity.sh), one world at a time and the same views (viewpoints.json's desert,
// viewpoints-worlds.json's others, their walks), the Steam Deck preset at native resolution in each:
//   node scripts/bench/deck-engines.mjs --web <game dir on the Deck> --unity <player name on the Deck> --out <dir here>
//        [--worlds desert,arzach,…] [--engines web,unity] [--lock <dir>] [--port 5420] [--refresh 90] [--loads cold,warm]
//        [--args '-fps 0'] (more of the player's arguments) [--resume 1]
// Per world and engine: a cold load (a profile and a shader cache of the bench's own, made empty first: Electron's
// profile and Mesa's MESA_SHADER_CACHE_DIR; the player's XDG_CONFIG_HOME, its TMPDIR (Unity's pipeline cache) and Mesa's),
// its start view only; then a warm one, the same caches again, every view and walk measured. The process tree's
// memory (PSS, gamescope left out) and the GPU's (VRAM + GTT, less what was used before the launch) sampled every 2 s.
// --lock: a directory made before each launch and removed after it (one bench on the Deck at a time, across agents).
// Then scripts/bench/deck-engines-summary.mjs <out>. See docs/systems/performance.md, "The Steam Deck, round 12".
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmdirSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { options, viewpoints, sleep, ROOT } from './lib.mjs';

const opt = options();
const DECK = process.env.DECK ?? 'deck@steamdeck.local';
const OUT = resolve(String(opt.out ?? 'deck-engines'));
const WEB = opt.web ? String(opt.web) : null, UNITY = opt.unity ? String(opt.unity) : null;
const PORT = String(opt.port ?? 5420), REFRESH = String(opt.refresh ?? 90);
const ENGINES = String(opt.engines ?? 'web,unity').split(',');
const LOADS = String(opt.loads ?? 'cold,warm').split(',');
const VP = viewpoints(), PICKED = () => JSON.parse(readFileSync(resolve(ROOT, 'scripts/bench/viewpoints-worlds.json'), 'utf8'));
const WORLDS = String(opt.worlds ?? 'desert,arzach,perdide,edena,underwater,incal,glassdunes,buried,moonfoundry,spheres,spacecity,bazaar,home').split(',');
const BENCH = '/home/deck/.local/share/hiraeth-bench-engines';   // (the bench's own profiles and caches, nothing of the player's)
mkdirSync(OUT, { recursive: true });

const ssh = (cmd) => spawnSync('ssh', ['-o', 'BatchMode=yes', DECK, cmd], { encoding: 'utf8' }).stdout.trim();
const sh = (cmd, args, env = {}) => { const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 28 }); return { code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '') }; };
const log = (s) => { console.log(s); writeFileSync(`${OUT}/run.log`, `${new Date().toISOString()} ${s}\n`, { flag: 'a' }); };

async function locked(fn) {
  if (opt.lock) while (true) { try { mkdirSync(String(opt.lock)); break; } catch { await sleep(30000); } }
  try { return await fn(); } finally { if (opt.lock) try { rmdirSync(String(opt.lock)); } catch { /* gone */ } }
}

/** the memory of a unit's processes (PSS, kB, gamescope and Xwayland left out) and the GPU's (VRAM + GTT, bytes), every 2 s */
function sampler(unit, file) {
  const loop = `export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus
    G=$(dirname $(ls /sys/class/drm/card*/device/mem_info_vram_used | head -1))
    while sleep 2; do
      cg=$(systemctl --user show -p ControlGroup --value ${unit}); [ -z "$cg" ] && { echo "$(date +%s.%N) - - $(cat $G/mem_info_vram_used) $(cat $G/mem_info_gtt_used)"; continue; }
      pss=0; n=0
      for p in $(find /sys/fs/cgroup$cg -name cgroup.procs -exec cat {} + 2>/dev/null); do
        case "$(cat /proc/$p/comm 2>/dev/null)" in gamescope*|Xwayland|"") continue;; esac
        v=$(awk '/^Pss:/{print $2}' /proc/$p/smaps_rollup 2>/dev/null); pss=$((pss + \${v:-0})); n=$((n+1))
      done
      echo "$(date +%s.%N) $pss $n $(cat $G/mem_info_vram_used) $(cat $G/mem_info_gtt_used)"
    done`;
  // (straight into the file: the runs between are spawnSync's, which hold this process's event loop)
  const fd = openSync(file, 'w');
  const p = spawn('ssh', ['-o', 'BatchMode=yes', DECK, loop], { stdio: ['ignore', fd, 'ignore'] });
  return { stop() { p.kill(); closeSync(fd); } };
}
const gpuNow = () => ssh('G=$(dirname $(ls /sys/class/drm/card*/device/mem_info_vram_used | head -1)); echo $(( $(cat $G/mem_info_vram_used) + $(cat $G/mem_info_gtt_used) ))');

/** the views of a world as the player reads them: a list, each with its world; views twice (the first a warm-up), walks once */
function unityViews(world, cold) {
  const W = world === 'desert' ? { views: VP.views, paths: VP.paths } : PICKED().worlds[world];
  if (!W) throw new Error(`no views for ${world}`);
  const v = W.views.map((x) => ({ ...x, world }));
  const list = cold ? v.slice(0, 1) : [...v, ...v, ...(W.paths ?? []).map((p) => ({ ...p, world }))];
  const file = `${OUT}/views-${world}${cold ? '-cold' : ''}.json`;
  writeFileSync(file, JSON.stringify(list));
  return file;
}

async function webRun(world, load) {
  const dir = `${OUT}/web/${world}-${load}`; mkdirSync(dir, { recursive: true });
  const prof = `${BENCH}/web-${world}`, mesa = `${BENCH}/web-${world}-mesa`;
  if (load === 'cold') ssh(`rm -rf ${prof} ${mesa}; mkdir -p ${prof} ${mesa}`);
  const gpu0 = +gpuNow();
  const t0 = Date.now();
  const st = sh('scripts/bench/deck-run.sh', ['start', 'headless', WEB], { PORT, REFRESH, BENCH_PROFILE: prof, BENCH_ENV: `MESA_SHADER_CACHE_DIR=${mesa}` });
  log(`web ${world} ${load}: ${st.out.trim()}`);
  if (st.code) return { error: st.out };
  const mem = sampler('hiraeth-bench', `${dir}/memory.txt`);
  let page = null;
  for (let i = 0; i < 180 && page === null; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (l.some((x) => x.type === 'page')) page = (Date.now() - t0) / 1000; } catch { /* starting */ } if (page === null) await sleep(500); }
  const args = ['scripts/bench/deck-worlds.mjs', '--port', PORT, '--worlds', world, '--quality', 'deck', '--modes', 'fixed', '--raw', dir,
    ...(load === 'cold' ? ['--only', world === 'desert' ? 'spawn' : 'start', '--secs', '2', '--warmup', '1'] : ['--secs', '6', '--warmup', '2', '--settle', '1']),
    ...(world === 'moonfoundry' && !PICKED().worlds.moonfoundry ? ['--pick', '1'] : [])];
  const r = sh('node', args);
  writeFileSync(`${dir}/deck-worlds.log`, r.out);
  mem.stop();
  sh('scripts/bench/deck-run.sh', ['stop'], { PORT });
  const loaded = r.out.match(/loaded in ([\d.]+) s/)?.[1];
  log(`web ${world} ${load}: page after ${page} s, world loaded in ${loaded} s${r.code ? ' (exit ' + r.code + ')' : ''}`);
  return { page, load: loaded ? +loaded : null, gpu0 };
}

async function unityRun(world, load) {
  const dir = `${OUT}/unity/${world}-${load}`; mkdirSync(dir, { recursive: true });
  const base = `${BENCH}/unity-${world}`;
  if (load === 'cold') ssh(`rm -rf ${base} /home/deck/.local/share/hiraeth-bench-unity/config; mkdir -p ${base}/mesa ${base}/tmp`);
  const views = unityViews(world, load === 'cold');
  const gpu0 = +gpuNow();
  const mem = sampler('hiraeth-unity-bench', `${dir}/memory.txt`);
  const r = sh('scripts/bench/deck-unity.sh', ['run', UNITY, world, views, dir, ...(opt.args ? String(opt.args).split(' ') : [])], { REFRESH, PLAYER_ENV: `MESA_SHADER_CACHE_DIR=${base}/mesa TMPDIR=${base}/tmp` });
  mem.stop();
  writeFileSync(`${dir}/run.txt`, r.out);
  const ul = existsSync(`${dir}/unity.log`) ? readFileSync(`${dir}/unity.log`, 'utf8') : '';
  log(`unity ${world} ${load}: ${ul.match(/load: first node[^\n]*/)?.[0] ?? '(no first node)'} | ${ul.match(/load: world settled[^\n]*/)?.[0]?.slice(0, 160) ?? ''}`);
  // (a launch that never reached its world, or a run with no results: said, and tried again by the loop)
  const crash = ul.match(/Received signal \w+/)?.[0] ?? (existsSync(`${dir}/player.log`) ? readFileSync(`${dir}/player.log`, 'utf8').match(/Received signal \w+/)?.[0] : null);
  if (load === 'warm' && !existsSync(`${dir}/unity-bench.json`)) return { gpu0, error: `no results${crash ? ' (' + crash + ')' : ''}` };
  return { gpu0 };
}

const meta = existsSync(`${OUT}/meta.json`) ? JSON.parse(readFileSync(`${OUT}/meta.json`, 'utf8')) : {};
for (const world of WORLDS) for (const engine of ENGINES) for (const load of LOADS) {
  const key = `${engine}/${world}-${load}`;
  if (opt.resume && meta[key] && !meta[key].error && !meta[key].redo) continue;   // (--resume 1: what an earlier run measured kept)
  const failed = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try { meta[key] = await locked(() => (engine === 'web' ? webRun : unityRun)(world, load)); }
    catch (e) { meta[key] = { error: e.message }; }
    if (!meta[key].error) break;
    log(`${key}: ${meta[key].error}${attempt < 2 ? ', again' : ''}`);
    failed.push(meta[key].error);
  }
  if (failed.length) meta[key].failed = failed;   // (the launches that failed before this one: a crash is a finding too)
  writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
}
log('done');
