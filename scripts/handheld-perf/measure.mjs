// node scripts/handheld-perf/measure.mjs <label> [scenario,...] [seconds=20] [preset=handheld]
// Each scenario: load it on the device (load time), stand where it says, then walk forward while the
// camera sweeps slowly left and right for N seconds. Prints one JSON line per scenario (and appends it
// to $PERF_OUT, default handheld-perf.jsonl): frame-time median / 95th / 99th percentile, worst frame,
// fps, the F readout's CPU ms, draw calls, triangles and render scale, the GPU's busy share and clock,
// and the temperatures at the end.
import { appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { ourPage, prepare, fullscreen, BASE, sleep, thermal, ADB } from './lib.mjs';
import { SCENARIOS } from './scenarios.mjs';

const [label = 'run', names = Object.keys(SCENARIOS).join(','), secs = '20', presetName = 'handheld'] = process.argv.slice(2);
const OUT = process.env.PERF_OUT ?? 'handheld-perf.jsonl';

/** the GPU's busy share and clock once a second while measuring (Qualcomm kgsl) */
function gpuSampler() {
  const kid = spawn(ADB[0], [...ADB.slice(1), 'shell', 'while true; do echo $(cat /sys/class/kgsl/kgsl-3d0/gpu_busy_percentage) $(cat /sys/class/kgsl/kgsl-3d0/devfreq/cur_freq); sleep 1; done']);
  const rows = []; let buf = '';
  kid.stdout.on('data', (d) => { buf += d; const ls = buf.split('\n'); buf = ls.pop(); for (const l of ls) { const m = l.match(/(\d+)\s*%\s+(\d+)/); if (m) rows.push([+m[1], +m[2] / 1e6]); } });
  const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  return { stop() { kid.kill(); return { gpuBusy: med(rows.map((r) => r[0])), gpuMHz: med(rows.map((r) => r[1])) }; } };
}

const page = await ourPage();
const errors = [];
page.log = (type, t) => { if (type === 'exception' || type === 'error') errors.push(t.slice(0, 160)); };
await prepare(page, presetName);
for (const name of names.split(',')) {
  const sc = SCENARIOS[name];
  errors.length = 0;
  await page.goto(BASE + '?' + sc.q);
  await page.waitFor(sc.title ? '!!window.title?.vista' : '!!window.__moebiusBooted', 300000, 250);
  const load = await page.eval('window.__moebiusBootedAt ?? null');   // ms from navigation to the first frame
  await fullscreen(page);
  await sleep(sc.settle ?? 4000);
  if (sc.setup) { await page.eval(sc.setup); await sleep(3000); }
  const gs = gpuSampler();
  const v0 = sc.title ? await page.eval('({ ...title.vista.frameStats })') : null;
  const r = await page.eval(async ({ secs, walk, turn }) => {
    const fpsEl = document.getElementById('fps');
    const times = [], readouts = [];
    let last = performance.now(), t = 0;
    const end = last + secs * 1000;
    if (walk && window.input) input.KeyW = true;
    await new Promise((done) => {
      const f = () => {
        const now = performance.now(), dt = now - last; last = now; times.push(dt); t += dt / 1000;
        if (turn && window.rig) rig.look(Math.sin(t * 0.7) * turn * dt / 16, 0);
        if (now < end) requestAnimationFrame(f); else done();
      };
      requestAnimationFrame(f);
      const iv = setInterval(() => { if (performance.now() > end) clearInterval(iv); else readouts.push(fpsEl?.textContent ?? ''); }, 1000);
    });
    if (window.input) input.KeyW = false;
    const s = times.slice(5).sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
    const ps = readouts.map((x) => x.match(/([\d.]+)× · (\d+) calls · (\d+)k tris/)).filter(Boolean).map((m) => ({ scale: +m[1], calls: +m[2], tris: +m[3] }));
    const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
    return {
      med: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), max: Math.round(s[s.length - 1]),
      fps: +(1000 * s.length / s.reduce((a, b) => a + b, 0)).toFixed(1),
      cpu: med(readouts.map((x) => +(x.match(/cpu ([\d.]+)/)?.[1] ?? NaN)).filter(Number.isFinite)),
      calls: med(ps.map((p) => p.calls)), ktris: med(ps.map((p) => p.tris)), scale: med(ps.map((p) => p.scale)), scaleEnd: ps.at(-1)?.scale,
      pos: window.player?.pos.toArray().map(Math.round), view: `${innerWidth}x${innerHeight}`,
    };
  }, { secs: +secs, walk: sc.walk ?? true, turn: sc.turn ?? 2.5 });
  Object.assign(r, gs.stop());
  if (sc.title) {
    const v = await page.eval('({ ...title.vista.frameStats, res: title.vista.resolution })');
    Object.assign(r, { titleRenders: v.frames - v0.frames, titleMsPerRender: +((v.ms - v0.ms) / (v.frames - v0.frames)).toFixed(1), titleRes: `${v.res.w}x${v.res.h}` });
  }
  const th = thermal();
  const row = { label, name, load: load && Math.round(load), ...r, gpuC: +th['gpuss-0'] / 1000, cpuC: +th['cpu-1-0'] / 1000, thermal: th.Thermal, errors: errors.slice(0, 2) };
  console.log(JSON.stringify(row));
  appendFileSync(OUT, JSON.stringify({ t: new Date().toISOString(), ...row }) + '\n');
}
page.close();
process.exit(0);
