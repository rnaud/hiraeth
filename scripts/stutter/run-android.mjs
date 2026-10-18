// The stutter harness's runs on the Retroid (issue #468 phase 2, docs/systems/performance.md "Stutters"): the routes of
// engine/stutter-routes.js STUTTER_RUNS (or those named) played by the Unity APK (com.rnaud.hiraeth.unity, a development
// build for the profiler's markers: BUILD_ARGS=-development NO_UPLOAD=1 scripts/unity-android-release.sh), muted, the
// frame readout on (-metrics), its Handheld preset, each frame recorded (-stutter), the files pulled, then read by
// scripts/stutter/report.mjs (the spike line 33 ms). `-bundle none` unless --bundle names a script to play instead
// (pushed to the app's folder): the downloaded script over the air never plays.
//   node scripts/stutter/run-android.mjs [ids…] --out <dir> [--repeat 2] [--bundle <hiraeth.cjs>] [--extra "-js-off x"] [--tag b]
// Only ever starts and stops com.rnaud.hiraeth.unity, and stops it after each run.
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { STUTTER_RUNS } from '../../engine/stutter-routes.js';

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const ids = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const SERIAL = process.env.ANDROID_SERIAL ?? 'ea2c972a';
const ADB = process.env.ADB ?? `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
const PKG = 'com.rnaud.hiraeth.unity', ACT = `${PKG}/com.unity3d.player.UnityPlayerGameActivity`;
if (PKG === 'com.rnaud.hiraeth') throw new Error('never the web app');
const OUT = resolve(arg('out', 'output/stutter/android')), repeat = +arg('repeat', 1), tag = arg('tag', '');
const EXTRA = (arg('extra') ?? '').split(' ').filter(Boolean);
const DEV = `/sdcard/Android/data/${PKG}/files`, DIR = `${DEV}/stutter`;
const adb = (...a) => spawnSync(ADB, ['-s', SERIAL, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }).stdout ?? '';
const sh = (c) => adb('shell', c);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });
if (/mIsShowing=true/.test(sh('dumpsys window policy'))) { console.error('the handheld is locked: unlock it first'); process.exit(1); }
sh(`am force-stop ${PKG}`);
sh(`mkdir -p ${DIR}`);
let bundle = 'none';
if (arg('bundle')) { bundle = `${DIR}/hiraeth.cjs`; adb('push', resolve(arg('bundle')), bundle); console.log(`the script: ${arg('bundle')} (${(statSync(resolve(arg('bundle'))).size / 1e6).toFixed(1)} MB)`); }

const runs = STUTTER_RUNS.filter((r) => !ids.length || ids.includes(r.id));
for (let k = 1; k <= repeat; k++) {
  for (const run of runs) {
    const name = `${run.id}${tag ? '-' + tag : ''}-${k}`, prefix = `${DIR}/${name}`;
    sh(`rm -f ${prefix}.unity.tsv ${prefix}.js.json`);
    adb('logcat', '-c');
    const plan = ['-mute', '-metrics', '-sequence', run.id, '-stutter', prefix, '-limit', arg('limit', '240'), '-bundle', bundle, ...EXTRA].join(' ');
    const t0 = Date.now();
    sh(`am start -W -n ${ACT} -e unity '${plan}'`);
    let ok = false;
    for (let i = 0; i < 25 && !ok; i++) { await sleep(1000); ok = /the plan from the intent: -mute/.test(adb('logcat', '-d', '-s', 'Unity')); }
    if (!ok) { sh(`am force-stop ${PKG}`); console.error(name, 'no -mute plan read: stopped'); process.exit(2); }
    const uid = (sh(`dumpsys package ${PKG}`).match(/userId=(\d+)/) ?? [])[1];
    const loud = () => sh('dumpsys audio').split('\n').some((l) => l.includes(`u/pid:${uid}/`) && l.includes('state:started'));
    while (Date.now() - t0 < (+arg('limit', '240') + 120) * 1000) {
      await sleep(3000);
      if (loud()) { sh(`am force-stop ${PKG}`); console.error('sound started: stopped'); process.exit(3); }
      if (sh(`ls ${prefix}.js.json ${prefix}.unity.tsv 2>/dev/null`).trim().split('\n').length === 2) { await sleep(2000); break; }
      if (!sh(`pidof ${PKG}`).trim()) { await sleep(1500); if (!sh(`pidof ${PKG}`).trim()) break; }
    }
    sh(`am force-stop ${PKG}`);
    writeFileSync(join(OUT, `${name}.log`), adb('logcat', '-d', '-s', 'Unity'));
    for (const ext of ['unity.tsv', 'js.json']) adb('pull', `${prefix}.${ext}`, join(OUT, `${name}.${ext}`));
    const got = existsSync(join(OUT, `${name}.unity.tsv`)) && existsSync(join(OUT, `${name}.js.json`));
    console.log(`${name} (${run.what}): ${got ? 'recorded' : 'NOT recorded'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    sh(`rm -f ${prefix}.unity.tsv ${prefix}.js.json`);
    await sleep(3000);   // (a breath between runs: the device's clocks settle)
  }
}
sh(`am force-stop ${PKG}`);
if (bundle !== 'none') sh(`rm -f ${bundle}`);
spawnSync(process.execPath, [resolve('scripts/stutter/report.mjs'), OUT, '--spike', arg('spike', '33')], { stdio: 'inherit' });
