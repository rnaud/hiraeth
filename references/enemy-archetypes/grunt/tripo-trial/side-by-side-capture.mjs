// Side-by-side captures of the arena trial: procedural grunt (left) and Tripo grunt (right), same clock, same clip.
// Usage (from the repository, Vite already serving it on PORT, default 5448; never 5173):
//   node references/enemy-archetypes/grunt/tripo-trial/side-by-side-capture.mjs <scratch folder>
// Headless Chrome with --mute-audio; the page's own review mute is checked before any capture.
// MODE=side3: the trio, procedural | Tripo textured | Tripo flat (flatten-tripo.mjs), framed wider.
// MODE=side3l: procedural | Tripo flat 31k | Tripo LOD 12k (lod-tripo.mjs, the fitted grip), plus the club's whole cycle
// front and side for the grip sheet.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const BENCH = !!process.env.BENCH, MODE = process.env.MODE ?? 'side', TRIO = /^side3/.test(MODE), N = TRIO ? 3 : 2, DIST = TRIO ? 4.6 : 3.6;
const DIR = process.argv[2]; if (!DIR) throw new Error('usage: side-by-side-capture.mjs <scratch folder>');
const OUT = join(DIR, 'shots'); mkdirSync(OUT, { recursive: true });
// (QUALITY=handheld: the page's preset, ?quality=, else High)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', CDP = +(process.env.CDP ?? 5449), URL = `http://127.0.0.1:${process.env.PORT ?? 5448}/references/enemy-archetypes/grunt/tripo-trial/arena.html${process.env.QUALITY ? '?quality=' + process.env.QUALITY : ''}`;
const profile = join(DIR, 'chrome-profile'); rmSync(profile, { recursive: true, force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`,
  '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--disable-gpu-shader-disk-cache',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--force-device-scale-factor=1', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });
let ws;
try {
  let tabs; for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waits = new Map(); const errors = [];
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails?.exception?.description ?? 'exception'); });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL });
  for (let i = 0; i < 480; i++) { if (await ev('!!window.__gruntTrial').catch(() => false)) break; await sleep(250); }
  if (!(await ev('!!window.__gruntTrial'))) throw new Error('trial did not load: ' + errors.join(' | '));
  const audio = await ev('({muted:sound.muted,level:sound.masterLevel(),gain:sound.master?.gain.value??null})');
  if (!audio.muted || audio.level !== 0) throw new Error('not muted ' + JSON.stringify(audio));
  // BENCH=1: the page's own matched benchmark instead of the pictures (Measure 0 / 1 / 6 / 12, two rounds, every model).
  if (BENCH) {
    // (BENCH_MODELS=current,flat,lod: those models, in that order in round 1 and reversed in round 2; BENCH_COUNTS=0,1,6,12,24)
    if (process.env.BENCH_MODELS) await ev(`(()=>{const m=${JSON.stringify(process.env.BENCH_MODELS.split(','))};window.__benchModels=r=>r%2?[...m].reverse():m;return true})()`);
    if (process.env.BENCH_COUNTS) await ev(`(()=>{window.__benchCounts=${JSON.stringify(process.env.BENCH_COUNTS.split(',').map(Number))};return true})()`);
    await ev(`(()=>{document.getElementById('trial-bench').click();return true})()`);
    for (let i = 0; i < 2400 && !(await ev(`/complete/.test(document.getElementById('trial-status').textContent)`)); i++) await sleep(250);
    const data = await ev(`JSON.parse(document.getElementById('trial-report').dataset.result)`);
    writeFileSync(join(OUT, 'bench.json'), JSON.stringify(data, null, 1));
    console.log(JSON.stringify(data.records.map((r) => [r.round, r.model, r.count, r.cpuMedianMs, r.gpuMedianMs, r.gpuSamples, r.drawCalls, r.submittedTriangles, r.frameMedianMs])));
  }
  await ev(`(()=>{const G=window.__gruntTrial;window.__stepDt=()=>1/60;for(const e of document.body.children)if(!e.querySelector?.('canvas')&&e.tagName!=='CANVAS')e.style.visibility='hidden';G.set('trial-asset','${MODE}');G.set('trial-mode','idle');G.spawn(${N});return true})()`);
  const club = await ev(`(()=>{const a=window.__gruntTrial.pack()[0].def.attacks.find(a=>a.id==='club');return {wind:a.wind,strike:a.strike??.3,recover:a.recover??window.__gruntTrial.pack()[0].def.recover}})()`);
  const poses = [
    ['idle', 'idle', 2.0], ['walk-a', 'walk', 2.2], ['walk-b', 'walk', 2.45],
    ['club-wind', 'attack', club.wind * 0.9], ['club-strike', 'attack', club.wind + club.strike * 0.6], ['club-recover', 'attack', club.wind + club.strike + club.recover * 0.3],
  ];
  const views = [['front', 0], ['threeq', -0.6], ['side', -1.5708], ['back', 3.1416]];
  // (the trio's faces, closer: idle, and the wind-up's eye flash)
  const faces = TRIO ? [['face-idle', 'idle', 2.0], ['face-wind', 'attack', club.wind * 0.9]] : [];
  // (side3l: the club through its whole cycle, front and side, to see it stay in the hands)
  const cycle = MODE === 'side3l' ? [['wind', 0.3], ['wind', 0.6], ['strike', 0.3], ['strike', 0.9], ['recover', 0.1], ['recover', 0.6], ['recover', 0.95]].map(([ph, k]) => [`grip-${ph}-${Math.round(k * 100)}`, 'attack', ph === 'wind' ? club.wind * k : ph === 'strike' ? club.wind + club.strike * k : club.wind + club.strike + club.recover * k]) : [];
  for (const c of cycle) poses.push(c);
  const report = { mode: MODE, audio, club, errors, shots: [] };
  for (const [name, mode, t] of BENCH ? [] : poses) for (const [vn, yaw] of views) {
    if (mode === 'walk' && vn !== 'front') continue;
    if (name.startsWith('grip-') && vn !== 'front' && vn !== 'side') continue;
    await ev(`(()=>{const G=window.__gruntTrial;G.turn(${yaw});G.set('trial-mode','${mode}');G.spawn(${N});G.pairView(0,${DIST});G.setTime(0);G.runTo(${t});return true})()`);
    for (let i = 0; i < 400 && !(await ev('window.__gruntTrial.time()>=' + t)); i++) await sleep(50);
    await sleep(500);
    const st = await ev(`window.__gruntTrial.pack().map(f=>({state:f.state,k:+f.k.toFixed(3),heading:+f.heading.toFixed(3),tripo:f.tripoTrial?.root.visible,file:f.tripoTrial?.file}))`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(OUT, `${name}-${vn}.png`); writeFileSync(file, Buffer.from(shot.data, 'base64'));
    report.shots.push({ file, pose: name, view: vn, time: t, state: st });
  }
  for (const [name, mode, t] of BENCH ? [] : faces) {
    await ev(`(()=>{const G=window.__gruntTrial;G.turn(0);G.set('trial-mode','${mode}');G.spawn(${N});G.pairView(0,2.6,1.0);G.setTime(0);G.runTo(${t});return true})()`);
    for (let i = 0; i < 400 && !(await ev('window.__gruntTrial.time()>=' + t)); i++) await sleep(50);
    await sleep(500);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(OUT, `${name}-front.png`); writeFileSync(file, Buffer.from(shot.data, 'base64'));
    report.shots.push({ file, pose: name, view: 'front', time: t });
  }
  // per-model inventory as the page measures it (main pass, one foe)
  report.inventory = await ev(`(()=>{window.__gruntTrial.show();const d=JSON.parse(document.getElementById('trial-report').dataset.result);return {procedural:d.baselineInventory,tripo:d.generatedInventory,flat:d.flatInventory,lod:d.lodInventory}})()`);
  report.errors = errors;
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ shots: report.shots.length, audio, inventory: report.inventory, errors: errors.slice(0, 5) }, null, 1));
} finally {
  try { ws?.close(); } catch {}
  proc.kill('SIGTERM'); await sleep(1500); rmSync(profile, { recursive: true, force: true });
}
