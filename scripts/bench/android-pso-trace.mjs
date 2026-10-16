// Android's pipeline list traced again (BridgePso; docs/systems/performance.md, "Unity on the Retroid, round 7"), as
// deck-pso-trace.mjs traces the Deck's: a development build of the Unity APK (com.rnaud.hiraeth.unity:
// BUILD_ARGS=-development NO_UPLOAD=1 scripts/unity-android-release.sh), installed, run with -pso-trace over every world,
// its trace gathered launch after launch in the app's own folder, then fetched into the project:
//   node scripts/bench/android-pso-trace.mjs --out <dir here> [--apk <apk>] [--worlds desert,arzach,…] [--fresh 1]
//        [--passes views,temples,fights] [--extra "-no-slim"] [--no-copy 1]
// Each world: its bench views once and its walk (viewpoints.json's desert, viewpoints-worlds.json's others); its first
// temple's first room and the ship's rooms; a fight (a blot, knocked out, the guardian woken). Then <out>/Vulkan.graphicsstate
// and, unless --no-copy 1, the project's unity/Hiraeth/Assets/StreamingAssets/hiraeth-pso/Android/Vulkan.graphicsstate.
// Muted (the plan's -mute read back from the log, and no audio stream started, or the app is stopped), the frame readout
// on (-metrics), the app stopped after each launch. It installs, starts and stops com.rnaud.hiraeth.unity only.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { options, viewpoints, sleep, ROOT } from './lib.mjs';

const opt = options();
const SERIAL = process.env.ANDROID_SERIAL ?? 'ea2c972a';
const ADB = process.env.ADB ?? `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`;
const PKG = 'com.rnaud.hiraeth.unity', ACT = `${PKG}/com.unity3d.player.UnityPlayerGameActivity`;
const OUT = resolve(String(opt.out ?? 'android-pso-trace'));
const VP = viewpoints(), PW = JSON.parse(readFileSync(resolve(ROOT, 'scripts/bench/viewpoints-worlds.json'), 'utf8')).worlds;
const WORLDS = String(opt.worlds ?? ['desert', ...Object.keys(PW)].join(',')).split(',');
const PASSES = String(opt.passes ?? 'views,temples,fights').split(',');
const EXTRA = opt.extra ? String(opt.extra).split(' ').filter(Boolean) : [];
const DEV = `/sdcard/Android/data/${PKG}/files`, TRACE = `${DEV}/pso-trace.graphicsstate`;
const adb = (...a) => spawnSync(ADB, ['-s', SERIAL, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }).stdout ?? '';
const sh = (c) => adb('shell', c);
mkdirSync(OUT, { recursive: true });
if (/mIsShowing=true/.test(sh('dumpsys window policy'))) { console.error('the handheld is locked: unlock it first'); process.exit(1); }
if (opt.apk) { console.log(adb('install', '-r', String(opt.apk)).trim()); }
sh(`am force-stop ${PKG}`);
if (opt.fresh) sh(`rm -f ${TRACE}`);

async function launch(world, pass, views, args) {
  const dir = `${OUT}/${world}-${pass}`; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/views.json`, JSON.stringify({ views }));
  for (let attempt = 0; attempt < 3; attempt++) {
    sh(`rm -rf ${DEV}/pso; mkdir -p ${DEV}/pso`);
    adb('push', `${dir}/views.json`, `${DEV}/pso/views.json`);
    adb('logcat', '-c');
    const plan = ['-mute', '-metrics', '-level', world, '-views', `${DEV}/pso/views.json`, '-bench', '6', '-limit', '900', '-out', `${DEV}/pso`, '-pso-trace', ...args, ...EXTRA].join(' ');
    sh(`am start -W -n ${ACT} -e unity '${plan}'`);
    let ok = false;
    for (let i = 0; i < 25 && !ok; i++) { await sleep(1000); ok = /the plan from the intent: -mute/.test(adb('logcat', '-d', '-s', 'Unity')); }
    if (!ok) { sh(`am force-stop ${PKG}`); console.error(world, pass, 'no -mute plan read: stopped'); process.exit(2); }
    const uid = (sh(`dumpsys package ${PKG}`).match(/userId=(\d+)/) ?? [])[1];
    const loud = () => sh('dumpsys audio').split('\n').some((l) => l.includes(`u/pid:${uid}/`) && l.includes('state:started'));
    const t0 = Date.now();
    while (Date.now() - t0 < 960e3) {
      await sleep(4000);
      if (loud()) { sh(`am force-stop ${PKG}`); console.error('sound started: stopped'); process.exit(3); }
      if (!sh(`pidof ${PKG}`).trim()) { await sleep(1500); if (!sh(`pidof ${PKG}`).trim()) break; }
    }
    sh(`am force-stop ${PKG}`);
    const log = adb('logcat', '-d', '-s', 'Unity');
    writeFileSync(`${dir}/log.txt`, log);
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
sh(`am force-stop ${PKG}`);
adb('pull', TRACE, `${OUT}/Vulkan.graphicsstate`);
if (!existsSync(`${OUT}/Vulkan.graphicsstate`)) { console.error('no trace on the device'); process.exit(4); }
const c = JSON.parse(readFileSync(`${OUT}/Vulkan.graphicsstate`, 'utf8')), n = c.m_VariantInfoMap.reduce((s, v) => s + v.second.graphicsStateInfoSet.length, 0);
console.log(`the list: ${n} states of ${c.m_VariantInfoMap.length} variants, ${OUT}/Vulkan.graphicsstate`);
if (!opt['no-copy']) {
  const to = resolve(ROOT, 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-pso/Android');
  mkdirSync(to, { recursive: true });
  copyFileSync(`${OUT}/Vulkan.graphicsstate`, `${to}/Vulkan.graphicsstate`);
  console.log('copied into StreamingAssets/hiraeth-pso/Android');
}
