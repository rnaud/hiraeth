// The Steam Deck's pipeline list traced again (docs/steam-deck.md, "The pipeline list"; BridgePso): a development Linux
// player (BridgeBuild.Linux -development, copied over with deck-unity.sh put) run with -pso-trace over every world, its
// trace gathered launch after launch in a profile of the bench's own, then fetched into the project:
//   node scripts/bench/deck-pso-trace.mjs --unity <dev player name on the Deck> --out <dir here> [--lock <dir>]
//        [--worlds desert,arzach,…] [--fresh 1] (the Deck's trace emptied first) [--passes views,temples,fights]
// Each world: its bench views once and its walk (viewpoints.json's desert, viewpoints-worlds.json's others: deck-engines.mjs's);
// its first temple's first room and the ship's rooms; a fight (a blot, knocked out, the guardian woken: no views, so
// the bench's flags leave the foes on). Then <out>/Vulkan.graphicsstate and, unless --no-copy 1, the project's
// unity/Hiraeth/Assets/StreamingAssets/hiraeth-pso/Vulkan.graphicsstate. Mesa's cache and TMPDIR are the bench's own.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { options, viewpoints, sleep, ROOT } from './lib.mjs';

const opt = options();
const DECK = process.env.DECK ?? 'deck@steamdeck.local';
const NAME = String(opt.unity ?? ''), OUT = resolve(String(opt.out ?? 'deck-pso-trace'));
if (!NAME) { console.log('usage: node scripts/bench/deck-pso-trace.mjs --unity <dev player name on the Deck> --out <dir>'); process.exit(1); }
const VP = viewpoints(), PW = JSON.parse(readFileSync(resolve(ROOT, 'scripts/bench/viewpoints-worlds.json'), 'utf8')).worlds;
const WORLDS = String(opt.worlds ?? ['desert', ...Object.keys(PW)].join(',')).split(',');
const PASSES = String(opt.passes ?? 'views,temples,fights').split(',');
const BENCH = '/home/deck/.local/share/hiraeth-bench-engines/pso-trace';
const TRACE = `${BENCH}/config/unity3d/rnaud/Hiraeth JS/pso-trace.graphicsstate`;
const ssh = (cmd) => spawnSync('ssh', ['-o', 'BatchMode=yes', DECK, cmd], { encoding: 'utf8', maxBuffer: 1 << 26 });
mkdirSync(OUT, { recursive: true });
ssh(`mkdir -p ${BENCH}/mesa ${BENCH}/tmp ${BENCH}/config${opt.fresh ? `; rm -f "${TRACE}"` : ''}`);

async function launch(world, pass, views, args) {
  const f = `${OUT}/views-${world}-${pass}.json`, dir = `${OUT}/${world}-${pass}`;
  writeFileSync(f, JSON.stringify(views));
  for (let attempt = 0; attempt < 3; attempt++) {
    if (opt.lock) while (true) { try { mkdirSync(String(opt.lock)); break; } catch { await sleep(30000); } }
    try {
      spawnSync(resolve(ROOT, 'scripts/bench/deck-unity.sh'), ['run', NAME, world, f, dir, '-pso-trace', ...args], { cwd: ROOT, encoding: 'utf8',
        env: { ...process.env, PLAYER_ENV: `MESA_SHADER_CACHE_DIR=${BENCH}/mesa TMPDIR=${BENCH}/tmp XDG_CONFIG_HOME=${BENCH}/config` } });
    } finally { if (opt.lock) try { rmdirSync(String(opt.lock)); } catch { /* gone */ } }
    const log = existsSync(`${dir}/player.log`) ? readFileSync(`${dir}/player.log`, 'utf8') : '';
    // (a launch that died before its world, the rare SIGSEGV after InitializeOrResetSwapChain, traced nothing: again)
    if (/Hiraeth bridge: exit/.test(log)) { console.log(world, pass, (log.match(/pso: trace saved: [^,]*/g) ?? ['(nothing saved)']).pop()); return; }
    console.log(world, pass, 'did not reach its end, again');
  }
}

for (const w of WORLDS) {
  const W = w === 'desert' ? { views: VP.views, paths: VP.paths } : PW[w];
  if (PASSES.includes('views') && W) await launch(w, 'views', [...W.views.map((v) => ({ ...v, world: w })), ...(W.paths ?? []).map((p) => ({ ...p, world: w }))], []);
  // (a temple that is not there ends the plan: the first only, and none at Home)
  if (PASSES.includes('temples') && w !== 'home') await launch(w, 'temples', [{ name: 'temple0', world: w, temple: 0 }], ['-aboard', 'main,console']);
  if (PASSES.includes('fights') && w !== 'home') await launch(w, 'fights', [], ['-fight', 'foe,down,guardian']);
}
const got = ssh(`cat "${TRACE}"`).stdout;
writeFileSync(`${OUT}/Vulkan.graphicsstate`, got);
const c = JSON.parse(got), n = c.m_VariantInfoMap.reduce((s, v) => s + v.second.graphicsStateInfoSet.length, 0);
console.log(`the list: ${n} states of ${c.m_VariantInfoMap.length} variants, ${OUT}/Vulkan.graphicsstate`);
if (!opt['no-copy']) { copyFileSync(`${OUT}/Vulkan.graphicsstate`, resolve(ROOT, 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-pso/Vulkan.graphicsstate')); console.log('copied into StreamingAssets/hiraeth-pso'); }
