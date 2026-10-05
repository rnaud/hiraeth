// The Unity side of the benchmark on the handheld: the APK's benchmark mode (Bench.cs) launched with
// its arguments in the intent's "unity" extra, the GPU's busy share and clock sampled meanwhile (kgsl)
// and attributed to each recording by the player's own "rec start / rec end" log lines, the results
// pulled. android-run.sh installs the APK first. Only ever touches com.rnaud.memento.unity.
//   node scripts/bench/android-unity.mjs --preset handheld --out result.json [--secs 10] [--only spawn,camps]
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { options, sleep } from './lib.mjs';
import { ADB, sh, thermal } from '../handheld-perf/lib.mjs';

export const PKG = 'com.rnaud.memento.unity';
if (PKG === 'com.rnaud.moebius') throw new Error('never the web app');
const opt = options();
const preset = opt.preset ?? 'handheld';
const out = resolve(opt.out ?? `android-unity-${preset}.json`);
mkdirSync(dirname(out), { recursive: true });
const adb = (...a) => execFileSync(ADB[0], [...ADB.slice(1), ...a], { encoding: 'utf8' });
const FILES = `/sdcard/Android/data/${PKG}/files`;
const remote = `${FILES}/bench/unity-${preset}.json`;

const comp = sh(`cmd package resolve-activity --brief ${PKG}`).trim().split('\n').pop();
if (!comp.startsWith(PKG + '/')) { console.error(`${PKG} is not installed (android-run.sh installs it)`); process.exit(1); }
sh(`am force-stop ${PKG}`);
sh(`rm -f ${remote}`);
const args = ['-bench', '-benchPreset', preset, '-benchOut', remote, '-benchLabel', String(opt.label ?? 'device')];
if (opt.secs) args.push('-benchSecs', String(opt.secs));
if (opt.warmup) args.push('-benchWarmup', String(opt.warmup));
if (typeof opt.only === 'string') args.push('-benchOnly', opt.only);

// the GPU's busy share and the player's marks, both stamped on this Mac's clock
const samples = [], marks = [];
const gpu = spawn(ADB[0], [...ADB.slice(1), 'shell', 'while true; do echo $(cat /sys/class/kgsl/kgsl-3d0/gpu_busy_percentage) $(cat /sys/class/kgsl/kgsl-3d0/devfreq/cur_freq); sleep 0.5; done']);
let gb = ''; gpu.stdout.on('data', (d) => { gb += d; const ls = gb.split('\n'); gb = ls.pop(); for (const l of ls) { const m = l.match(/(\d+)\s*%\s+(\d+)/); if (m) samples.push([Date.now(), +m[1], +m[2] / 1e6]); } });
sh('logcat -c');
const cat = spawn(ADB[0], [...ADB.slice(1), 'logcat', '-v', 'brief', 'Unity:I', '*:S']);
const log = []; let cb = '';
cat.stdout.on('data', (d) => { cb += d; const ls = cb.split('\n'); cb = ls.pop(); for (const l of ls) { if (/Memento:/.test(l)) log.push(l.slice(0, 300)); if (/bench rec start/.test(l)) marks.push(['start', Date.now()]); if (/bench rec end/.test(l)) marks.push(['end', Date.now()]); if (/Memento: bench /.test(l)) console.log('  ' + l.replace(/^.*?Memento:/, 'Memento:').slice(0, 160)); } });

const t0 = Date.now();
sh(`am start -W -n ${comp} -e unity '${args.join(' ')}'`);
const timeout = +(opt.timeout ?? 1200) * 1000;
let done = false;
while (Date.now() - t0 < timeout) {
  await sleep(3000);
  if (sh(`ls ${remote} 2>/dev/null`).trim() === remote) { await sleep(2000); done = true; break; }
  if (Date.now() - t0 > 30000 && !sh(`pidof ${PKG}`).trim()) { console.error('the player stopped before writing its results'); break; }
}
gpu.kill(); cat.kill();
const th = thermal();
if (!done) { writeFileSync(out, JSON.stringify({ engine: 'unity', side: 'android-unity', error: 'no results', log: log.slice(-40) }) + '\n'); process.exit(3); }
const tmp = out + '.part';
rmSync(tmp, { force: true });
adb('pull', remote, tmp);
const r = JSON.parse(readFileSync(tmp, 'utf8'));
rmSync(tmp, { force: true });
const starts = marks.filter((m) => m[0] === 'start'), ends = marks.filter((m) => m[0] === 'end');
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null);
(r.views ?? []).forEach((v, i) => {
  if (!starts[i] || !ends[i]) return;
  const s = samples.filter((x) => x[0] >= starts[i][1] && x[0] <= ends[i][1]);
  Object.assign(v, { gpuBusy: med(s.map((x) => x[1])), gpuMHz: med(s.map((x) => x[2])) });
});
Object.assign(r, { side: 'android-unity', deviceModel: sh('getprop ro.product.model').trim(), android: sh('getprop ro.build.version.release').trim(), wallSecs: (Date.now() - t0) / 1000,
  thermalEnd: { gpuC: +th['gpuss-0'] / 1000, cpuC: +th['cpu-1-0'] / 1000, status: th.Thermal }, meminfo: sh(`dumpsys meminfo ${PKG} | grep -E "TOTAL PSS|TOTAL:" | head -2`).trim(), log: log.slice(-20) });
writeFileSync(out, JSON.stringify(r) + '\n');
for (const v of r.views ?? []) console.log(`android unity ${preset} ${v.name.padEnd(11)} frame ${v.frame?.median} ms (p95 ${v.frame?.p95}, p99 ${v.frame?.p99}) cpu ${v.cpu?.median} gpu ${v.gpu?.median} busy ${v.gpuBusy}% draws ${v.draws} tris ${v.tris}`);
console.log(`android unity: ${r.screen?.join('×')} ${r.api}, ${r.scripting}, first frame ${r.load?.firstFrame} s (copy-out ${r.load?.copyOut} s); ${out}`);
process.exit(0);
