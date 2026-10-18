// The stutter harness's runs on the Steam Deck (issue #468 phase 2, docs/systems/performance.md "Stutters"): the routes of
// engine/stutter-routes.js STUTTER_RUNS (or those named) played by a Linux player copied there (a development build for
// the profiler's markers: scripts/unity-export/unity-batch.sh BridgeBuild.Linux -development -out
// Builds/bridge-linux-dev/hiraeth-js.x86_64, then scripts/bench/deck-unity.sh put <dir> <name>), in gamescope's headless
// backend at 1280 × 800 and 90 Hz as deck-unity.sh runs it, held to the refresh as the shipped player is (vsync), muted,
// in the bench's own profile (its saves, its Mesa cache and pipeline list warmed as a player's would be), each frame
// recorded (-stutter), the files fetched, then read by scripts/stutter/report.mjs (the spike line 33 ms). `-bundle
// none` unless --bundle names a script to play instead (copied to the bench's folder).
//   node scripts/stutter/run-deck.mjs <player name> [ids…] --out <dir> [--repeat 2] [--bundle <hiraeth.cjs>] [--extra "…"] [--tag b]
// Takes .local-tools/handoff/deck.lock first (and leaves it to its caller); starts and stops only its own unit.
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { STUTTER_RUNS } from '../../engine/stutter-routes.js';

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const [player, ...ids] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!player) { console.error('usage: run-deck.mjs <player name> [ids…] --out <dir>'); process.exit(1); }
const DECK = process.env.DECK ?? 'deck@steamdeck.local';
const BASE = '.local/share/hiraeth-bench-games', PROF = '.local/share/hiraeth-bench-unity', UNIT = 'hiraeth-stutter-bench';
const OUT = resolve(arg('out', 'output/stutter/deck')), repeat = +arg('repeat', 1), tag = arg('tag', ''), LIMIT = +arg('limit', 240);
const EXTRA = (arg('extra') ?? '').split(' ').filter(Boolean);
const ENVS = 'export XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus';
const ssh = (c) => spawnSync('ssh', ['-o', 'BatchMode=yes', DECK, c], { encoding: 'utf8', maxBuffer: 1 << 26 });
mkdirSync(OUT, { recursive: true });
const busy = ssh(`${ENVS}; for u in ${UNIT} hiraeth-unity-bench hiraeth-bench; do systemctl --user is-active -q $u && echo -n "$u "; done; pgrep -f "hiraeth-js[.]x86_64|gamescope --backend[ ]headless" >/dev/null && echo -n "a bench player"; true`).stdout.trim();
if (busy) { console.error(`the Deck is busy (${busy}): not started`); process.exit(2); }
ssh(`mkdir -p ${PROF}/stutter ${PROF}/config`);
let bundle = 'none';
if (arg('bundle')) { bundle = `$HOME/${PROF}/stutter/hiraeth.cjs`; spawnSync('scp', ['-q', resolve(arg('bundle')), `${DECK}:${PROF}/stutter/hiraeth.cjs`]); console.log(`the script: ${arg('bundle')}`); }

const runs = STUTTER_RUNS.filter((r) => !ids.length || ids.includes(r.id));
for (let k = 1; k <= repeat; k++) {
  for (const run of runs) {
    const name = `${run.id}${tag ? '-' + tag : ''}-${k}`, prefix = `$HOME/${PROF}/stutter/${name}`;
    const t0 = Date.now();
    const plan = ['-mute', '-metrics', '-sequence', run.id, '-stutter', prefix, '-limit', String(LIMIT), '-bundle', bundle, ...EXTRA].join(' ');
    const r = ssh(`${ENVS}
      rm -f ${prefix}.unity.tsv ${prefix}.js.json
      cd ~/${BASE}/${player} || exit 9
      systemd-run --user --unit=${UNIT} --collect -p RuntimeMaxSec=${LIMIT + 240} --working-directory=$HOME/${BASE}/${player} \\
        gamescope --backend headless -W 1280 -H 800 -w 1280 -h 800 -r 90 -- \\
        env XDG_CONFIG_HOME=$HOME/${PROF}/config PWD=$HOME/${PROF} ./hiraeth-js.x86_64 -screen-fullscreen 1 -screen-width 1280 -screen-height 800 \\
          -logFile $HOME/${PROF}/stutter/${name}.log ${plan} >/dev/null
      for i in $(seq 1 ${Math.ceil((LIMIT + 200) / 2)}); do systemctl --user is-active -q ${UNIT} || break; sleep 2; done
      systemctl --user stop ${UNIT} 2>/dev/null; true`);
    for (const ext of ['unity.tsv', 'js.json', 'log']) spawnSync('scp', ['-q', `${DECK}:${PROF}/stutter/${name}.${ext}`, join(OUT, `${name}.${ext}`)]);
    const got = existsSync(join(OUT, `${name}.unity.tsv`)) && existsSync(join(OUT, `${name}.js.json`));
    console.log(`${name} (${run.what}): ${got ? 'recorded' : 'NOT recorded'} in ${((Date.now() - t0) / 1000).toFixed(0)} s${r.status ? `, ssh ${r.status}` : ''}`);
    ssh(`rm -f ${prefix}.unity.tsv ${prefix}.js.json ${prefix}.log`);
  }
}
if (bundle !== 'none') ssh(`rm -f ${PROF}/stutter/hiraeth.cjs`);
spawnSync(process.execPath, [resolve('scripts/stutter/report.mjs'), OUT, '--spike', arg('spike', '33')], { stdio: 'inherit' });
