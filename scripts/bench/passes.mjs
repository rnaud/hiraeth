// What a frame costs, pass by pass, at the benchmark's viewpoints (viewpoints.json) on the Mac's GPU:
// every renderer.render() of the game's renderFrame() timed on its own (EXT_disjoint_timer_query_webgl2),
// with its draw calls and triangles, over a tight loop of frames (the shadow maps' every-other-frame
// refreshes averaged in), then A/B toggles timed the same way (the whole frame, synced by a readPixels).
//   npx vite build && node scripts/bench/serve.mjs --port 6851 &
//   node scripts/bench/passes.mjs --url http://localhost:6851/ --preset handheld --only cave,dunes
//        [--res 1280x720] [--frames 48] [--reps 3] [--scale 2.5] [--eval snippet.js] [--toggles base,noFar,noNear,...] [--wet 1] [--shots dir] [--out file.json]
// --wet 1: the cave's pool full and its stream running (as after the channel is cleared).
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { options, viewpoints, sleep } from './lib.mjs';
import { launch, glInfo } from './browser.mjs';
import { SCALE, prepareStorage, conditions } from './web-page.mjs';

const opt = options();
const BASE = (opt.url ?? 'http://localhost:6851/').replace(/\/?$/, '/');
const preset = opt.preset ?? 'handheld';
const [w, h] = (opt.res ?? '1280x720').split('x').map(Number);
const VP = viewpoints();
// inside the cave's room as well (the bench's own "cave" stands in its passage): across the basin to the
// roots, and down over the pool from its rim
VP.views.push(
  { name: 'cave-room', player: [-1250, 1000, 1270], heading: Math.PI, eye: [-1250, 1002.4, 1275], target: [-1250, 999.5, 1250], fov: 60 },
  { name: 'cave-pool', player: [-1240, 1000, 1264], heading: Math.PI + 0.6, eye: [-1236.5, 1002.8, 1269], target: [-1250, 998.3, 1250], fov: 60 },
);
const only = typeof opt.only === 'string' ? opt.only.split(',') : ['cave', 'dunes'];
const frames = +(opt.frames ?? 48), reps = +(opt.reps ?? 3);
const toggles = (typeof opt.toggles === 'string' ? opt.toggles : 'base').split(',');
const shots = typeof opt.shots === 'string' ? resolve(opt.shots) : null;
if (shots) mkdirSync(shots, { recursive: true });
const out = opt.out ? resolve(opt.out) : null;
// --scale: the render scale in place of the preset's fixed one (e.g. 2 to make the Mac's GPU the bottleneck)
const scale = opt.scale ? +opt.scale : (SCALE[preset] ?? 1);

// [switch it off, switch it back on], evaluated in the page
const TOGGLES = {
  base: ['', ''],
  noShadow: ['preset().nearEvery = preset().farEvery = 1e9; cascades.fine.enabled = false', 'Object.assign(preset(), window.__every); cascades.fine.enabled = window.__fine'],
  noNear: ['preset().nearEvery = 1e9', 'Object.assign(preset(), window.__every)'],
  noFar: ['preset().farEvery = 1e9', 'Object.assign(preset(), window.__every)'],
  noFine: ['cascades.fine.enabled = false', 'cascades.fine.enabled = window.__fine'],
  postAlbedo: ['post.uniforms.uDebug.value = 2', 'post.uniforms.uDebug.value = 0'],
  noBloom: ['window.__br = bloom.render; bloom.render = () => {}', 'bloom.render = window.__br'],
  noWind: ['wind.scene.visible = false', 'wind.scene.visible = true'],
  noFlora: ['window.__ff = preset().floraFar; preset().floraFar = 0.0001', 'preset().floraFar = window.__ff'],
  noCrowd: ['window.__cr = crowd && { ...crowd.range }; if (crowd) crowd.range.far = 0', 'if (crowd) Object.assign(crowd.range, window.__cr)'],
  noNpc: ['npcs.forEach((n) => (n.object.visible = false))', 'npcs.forEach((n) => (n.object.visible = true))'],
  // everything of the level's but the cave's own group (the desert outside, still drawn and shadowed)
  onlyCave: [`window.__oc = []; { const c = level.qanat.cave, keep = [c.group, c.pool, c.stream, c.bone, player.object];
    const under = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
    scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible && !under(o)) { o.visible = false; window.__oc.push(o); } }); }`, 'for (const o of window.__oc) o.visible = true'],
  noCaveGroup: ['level.qanat.cave.group.visible = false', 'level.qanat.cave.group.visible = true'],
  noInterior: ['window.__ir = interiorCull.rooms; interiorCull.rooms = []', 'interiorCull.rooms = window.__ir'],   // (as before perf.js InteriorCuller)
  noPool: ['level.qanat.cave.pool.visible = level.qanat.cave.stream.visible = false', 'level.qanat.cave.pool.visible = level.qanat.cave.stream.visible = true'],
  noWaterPass: ['window.__ro = waters.renderOver; waters.renderOver = () => {}', 'waters.renderOver = window.__ro'],
  scale05: ['quality.renderScale = 0.5; resize()', 'quality.renderScale = window.__scale; resize()'],
};

const profile = resolve(`/tmp/.chrome-passes-${process.pid}`);
const { ctx, page } = await launch({ w, h, profile });
const ev = (fn, arg) => page.evaluate(fn, arg);
page.on('pageerror', (e) => console.error('page error:', String(e).slice(0, 200)));
await page.goto(BASE + 'manifest.webmanifest');
const gl = await glInfo(page);
console.log('GPU:', gl.renderer, 'timer query:', gl.timerQuery);
if (/SwiftShader|llvmpipe|Software/i.test(gl.renderer ?? '')) { console.error('software rendering'); process.exit(2); }
await prepareStorage(ev, preset);
await page.goto(BASE + '?level=desert' + (opt.q ? '&' + opt.q : ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame && window.player, null, { timeout: 300000, polling: 100 });
await sleep(4000);
await conditions(ev, { hour: VP.hour, weather: VP.weather, scale });
// the page's own per-frame GPU query would collide with ours
await ev(() => { window.__bench.timeGpu = false; window.sound?.setVolume?.(0); return true; });

// --nohsr 1: a never-taken discard in every surface shader, so an Apple GPU can't hide the overdraw with its
// hidden-surface removal (it shades the fragments in draw order with only the early depth test, as a
// GPU without HSR does: a closer model of the handheld's Adreno)
if (opt.nohsr === '1') {
  const n = await ev(() => {
    const seen = new Set();
    window.scene.traverse((o) => { for (const m of [].concat(o.material ?? [])) if (m.isShaderMaterial && !seen.has(m) && /void main\s*\(\s*\)\s*\{/.test(m.fragmentShader)) {
      seen.add(m); m.fragmentShader = m.fragmentShader.replace(/void main\s*\(\s*\)\s*\{/, 'void main() {\n  if (gl_FragCoord.x < -1.0) discard;'); m.needsUpdate = true; } });
    return seen.size;
  });
  console.log('nohsr: patched', n, 'materials');
  await ev(() => { window.renderFrame(); return 1; });
  await sleep(5000);
}

// the profiler: every renderer.render() timed and labelled by what it draws into
await ev(() => {
  const r = window.renderer, gl = r.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const P = window.__passes = { on: false, list: [], pending: [] };
  const cascadeOf = (rt) => Object.values(window.cascades).find((c) => c.rt === rt)?.name;
  const label = (scene, rt) => {
    if (scene === window.scene) {
      if (scene.overrideMaterial) return 'shadow-' + (cascadeOf(rt) ?? '?');
      if (rt?.textures?.[0] === window.post.uniforms.tAlbedo.value) return 'gbuffer';
      return 'scene→other';
    }
    if (scene === window.post.scene) return rt ? 'ink-post' : 'blit';
    if (scene === window.wind.scene) return 'wind';
    if (window.waters?.pass && Object.values(window.waters.pass).includes(scene)) return 'water-over';
    if (!rt) return 'blit';
    if (rt === window.bloom.texture?.renderTarget || /bloom/i.test(scene.name)) return 'bloom';
    return 'other(' + (scene.name || scene.children?.[0]?.material?.type || scene.type) + ' ' + rt.width + 'x' + rt.height + ')';
  };
  const base = r.render.bind(r);
  r.render = (scene, cam) => {
    if (!P.on || !ext) return base(scene, cam);
    const rt = r.getRenderTarget(), lb = label(scene, rt);
    const c0 = r.info.render.calls, t0 = r.info.render.triangles;
    const q = gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    try { return base(scene, cam); } finally {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      P.pending.push({ q, lb, calls: r.info.render.calls - c0, tris: r.info.render.triangles - t0 });
    }
  };
  P.collect = () => {
    const done = [];
    for (const p of P.pending) {
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) return null;
    }
    const bad = gl.getParameter(ext.GPU_DISJOINT_EXT);
    for (const p of P.pending) { done.push({ lb: p.lb, ms: gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6, calls: p.calls, tris: p.tris }); gl.deleteQuery(p.q); }
    P.pending = [];
    return bad ? 'disjoint' : done;
  };
  return !!ext;
});

async function breakdown(n) {
  const all = [];
  for (let i = 0; i < n; i++) {
    // (only this frame's passes: the game's own loop keeps rendering between our calls)
    await ev(() => { const P = window.__passes; P.on = true; try { window.renderFrame(); } finally { P.on = false; } return true; });
    let got = null;
    for (let k = 0; k < 200 && !got; k++) { got = await ev(() => window.__passes.collect()); if (!got) await sleep(5); }
    if (Array.isArray(got)) all.push(got);
  }
  const by = {};
  for (const f of all) for (const p of f) {
    const e = by[p.lb] ??= { ms: 0, calls: 0, tris: 0, runs: 0 };
    e.ms += p.ms; e.calls += p.calls; e.tris += p.tris; e.runs++;
  }
  const F = all.length;
  const rows = Object.entries(by).map(([lb, e]) => ({ pass: lb, msPerFrame: +(e.ms / F).toFixed(3), msPerRun: +(e.ms / e.runs).toFixed(3), runsPerFrame: +(e.runs / F).toFixed(2), callsPerRun: Math.round(e.calls / e.runs), ktrisPerRun: Math.round(e.tris / e.runs / 1000) }));
  rows.sort((a, b) => b.msPerFrame - a.msPerFrame);
  return { frames: F, totalMs: +rows.reduce((s, r) => s + r.msPerFrame, 0).toFixed(3), rows };
}

const loop = () => ev(() => {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const run = (n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / n; };
  run(24);   // (the GPU's clocks up first)
  const a = [run(24), run(24), run(24), run(24), run(24)].sort((x, y) => x - y);
  frameStats.calls = frameStats.tris = frameStats.n = 0;
  renderFrame();
  return { ms: +a[2].toFixed(2), min: +a[0].toFixed(2), calls: frameStats.calls, ktris: Math.round(frameStats.tris / 1000) };
});

// --eval file.js: a function body run in the page at each view (after the breakdown); its value is printed
const extra = typeof opt.eval === 'string' ? (await import('node:fs')).readFileSync(resolve(opt.eval), 'utf8') : null;
const results = { preset, res: [w, h], scale, gl: gl.renderer, time: new Date().toISOString(), views: {} };
for (const name of only) {
  const v = VP.views.find((x) => x.name === name);
  if (!v) { console.error('no view', name); continue; }
  await ev((v) => { window.__benchPlace(v.player, v.heading); window.__benchSet(v.eye, v.target, v.fov); return true; }, v);
  await sleep(3000);
  if (opt.wet === '1' && name.startsWith('cave')) { await ev(() => { const c = level.qanat?.cave; c?.setWater(1, c.levels.high); return !!c; }); await sleep(1500); }
  await ev((scale) => { window.__every = { nearEvery: preset().nearEvery, farEvery: preset().farEvery }; window.__fine = cascades.fine.enabled; window.__scale = scale; return 1; }, scale);
  if (shots) await page.screenshot({ path: join(shots, `${preset}-${name}${opt.wet === '1' ? '-wet' : ''}.png`) });
  const bd = await breakdown(frames);
  console.log(`\n== ${name} (${preset}, ${w}x${h}): GPU ${bd.totalMs} ms a frame over ${bd.frames} frames`);
  for (const r of bd.rows) console.log(`  ${r.pass.padEnd(28)} ${String(r.msPerFrame).padStart(7)} ms/frame  ${String(r.msPerRun).padStart(7)} ms/run  ×${r.runsPerFrame}  ${String(r.callsPerRun).padStart(5)} draws  ${String(r.ktrisPerRun).padStart(6)} ktris`);
  // each toggle timed `reps` times, interleaved (the GPU's clocks drift), the median kept
  const ab = {}, runs = {};
  for (let k = 0; k < reps; k++) for (const tg of toggles) {
    const [on, off] = TOGGLES[tg] ?? [tg, ''];
    if (on) await page.evaluate(on + '; 1');
    await sleep(300);
    (runs[tg] ??= []).push(await loop());
    if (off) await page.evaluate(off + '; 1');
  }
  for (const tg of toggles) {
    const l = runs[tg].sort((a, b) => a.ms - b.ms);
    ab[tg] = { ...l[l.length >> 1], spread: [l[0].ms, l[l.length - 1].ms] };
    console.log(`  A/B ${tg.padEnd(12)} ${JSON.stringify(ab[tg])}`);
  }
  if (extra) { const r = await page.evaluate(`(() => { ${extra} })()`); console.log('  eval:', typeof r === 'string' ? r : JSON.stringify(r, null, 1)); ab.eval = r; }
  results.views[name] = { breakdown: bd, ab };
}
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(results, null, 1) + '\n'); }
await ctx.close();
rmSync(profile, { recursive: true, force: true });
process.exit(0);
