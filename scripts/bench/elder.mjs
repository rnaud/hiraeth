// What the Elder costs, and her fight seen in the real Aerie (issue #237): the game's own page at
// ?level=arzach&guardianReview=elder (the roost, the player put in it, muted and unhurt), headless Chrome on the GPU.
//
//   cost   held still at three views round her (the fight's 12 m, 35 m, 90 m), the whole frame with her shown, hidden
//          and drawn whole (her levels of detail off), timed on the GPU (EXT_disjoint_timer_query_webgl2) and on the wall,
//          with her own draws and triangles in every pass; her CPU a frame (her fight, her pose); what she is made of
//   fight  the game running: a contact sheet of her moves as the camera sees them (her blows' fronts and marks drawn),
//          her states and moves a second, the blows that reached the traveller
//
//   node scripts/bench/elder.mjs --url http://127.0.0.1:6237/ --out <dir> [--preset handheld] [--res 1280x720]
//        [--reps 4] [--fight 40] [--views near,mid,far]
// Serve the build first (npx vite build && node scripts/bench/serve.mjs --port 6237), or a dev server's URL. CDP 6239.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tempDir, ownProcess, removeTemp } from '../temp-dirs.mjs';
import { prepareStorage, conditions, SCALE } from './web-page.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const BASE = arg('url', 'http://127.0.0.1:6237/').replace(/\/?$/, '/'), OUT = resolve(arg('out', 'output/elder-bench'));
const preset = arg('preset', 'handheld'), [W, H] = arg('res', '1280x720').split('x').map(Number), scale = Number(arg('scale', SCALE[preset] ?? 1));
const reps = Number(arg('reps', 4)), fightSecs = Number(arg('fight', 40)), viewNames = arg('views', 'near,mid,far').split(',');
const CDP = Number(process.env.CDP ?? 6239), CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const profile = tempDir('hiraeth-elder-bench-chrome-');
const proc = ownProcess(spawn(CHROME, ['--headless=new', '--mute-audio', '--autoplay-policy=user-gesture-required', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', '--disable-gpu-shader-disk-cache', '--disk-cache-size=1', '--force-device-scale-factor=1', '--disable-gpu-vsync', '--disable-frame-rate-limit', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' }));
let ws;
try {
  let tabs;
  for (let i = 0; i < 80 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json(); } catch { await sleep(250); } }
  ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const waits = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && waits.has(d.id)) { const [res, rej] = waits.get(d.id); waits.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); } });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waits.set(i, [res, rej]); ws.send(JSON.stringify({ id: i, method, params })); });
  const evs = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const ev = (fn, a) => evs(`(${fn})(${JSON.stringify(a ?? null)})`);
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + 'manifest.webmanifest' }); await sleep(500);
  await prepareStorage(ev, preset);
  await send('Page.navigate', { url: BASE + '?level=arzach&guardianReview=elder' });
  for (let i = 0; i < 600; i++) { try { if (await evs('!!(window.__hiraethBooted && window.renderFrame && window.level?.temples)')) break; } catch { /* loading */ } await sleep(500); }
  const gl = await ev(() => { const g = window.renderer.getContext(), d = g.getExtension('WEBGL_debug_renderer_info'); return { renderer: d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?', timer: !!g.getExtension('EXT_disjoint_timer_query_webgl2') }; });
  console.log('GPU', gl.renderer, 'timer', gl.timer);
  await evs(`(async () => { const g = window.level.temples.find((t) => t.id === 'arzach').guardian; await g.model.ready; return g.model.generated; })()`);
  await sleep(3000);
  await conditions(ev, { hour: 11, weather: 'clear', scale });
  // the fight first, the game running (the camera the game's own, behind the traveller)
  const fight = await ev(async ({ secs }) => {
    const g = window.level.temples.find((t) => t.id === 'arzach').guardian, P = window.player, log = [], seen = new Set();
    let blows = 0; const contact = g.contact.bind(g); g.contact = (p) => { const r = contact(p); if (r) blows++; return r; };
    const strike = g.strike.bind(g); g.strike = (a, p) => { const r = strike(a, p); if (r) blows++; log.push(`${(performance.now() / 1000).toFixed(1)} ${a.id}${r ? ' hit' : ''}`); return r; };
    const t0 = performance.now(), shots = [];
    while (performance.now() - t0 < secs * 1000) {
      await new Promise((r) => setTimeout(r, 250));
      const key = `${g.state}/${g.attack?.id ?? ''}/${g.struck ? 's' : 'w'}`;
      if (!seen.has(key) && shots.length < 24) { seen.add(key); shots.push({ key, t: +((performance.now() - t0) / 1000).toFixed(1), url: (window.renderFrame(), window.renderer.domElement.toDataURL('image/jpeg', 0.7)) }); }
      // (she wakes, fights; at times her meter moved on, so every phase shows)
      const k = (performance.now() - t0) / (secs * 1000);
      if (k > 0.35 && g.phaseIndex === 0 && !g.attack) { g.meter = g.floor = 0.46; }
      if (k > 0.7 && g.phaseIndex === 1 && !g.attack) { g.meter = g.floor = 0.76; }
    }
    return { blows, log, shots, phase: g.phaseIndex, state: g.state, generated: g.model.generated };
  }, { secs: fightSecs });
  fight.shots.forEach((s, i) => writeFileSync(join(OUT, `fight-${String(i).padStart(2, '0')}-${s.key.replace(/\//g, '-')}.jpg`), Buffer.from(s.url.split(',')[1], 'base64')));
  console.log('fight:', fight.blows, 'blows reached him;', fight.log.join(' | '));
  console.log('fight states seen:', fight.shots.map((s) => `${s.t}s ${s.key}`).join(', '));

  // the cost, held still
  await ev(() => {
    const { THREE } = window, g = window.level.temples.find((t) => t.id === 'arzach').guardian, m = g.model, inner = m.inner, r = window.renderer;
    g.stop(); g.enter('fight'); g.meter = g.floor = 0; g.cool = 1e9;
    const mine = new Set(); inner.group.traverse((o) => o.isMesh && mine.add(o));
    const own = { calls: 0, tris: 0 }, draw = r.renderBufferDirect;
    r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      if (mine.has(object)) { const n = geometry.index ? geometry.index.count : geometry.attributes.position.count; own.calls++; own.tris += Math.min(n, geometry.drawRange.count) / 3; }
      return draw.call(this, camera, scene, geometry, material, object, group);
    };
    const gl = r.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), px = new Uint8Array(4);
    window.__eTime = async (n) => {
      const run = (k) => { const t0 = performance.now(); for (let i = 0; i < k; i++) window.renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / k; };
      run(10);
      const walls = [run(20), run(20), run(20)].sort((a, b) => a - b), gpu = [];
      for (let i = 0; i < n && ext; i++) {
        const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); window.renderFrame(); gl.endQuery(ext.TIME_ELAPSED_EXT);
        for (let k = 0; k < 400 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); k++) await new Promise((res) => setTimeout(res, 2));
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
      }
      gpu.sort((a, b) => a - b);
      const fs = window.frameStats; fs.calls = fs.tris = fs.n = 0; own.calls = own.tris = 0;
      for (let i = 0; i < 12; i++) window.renderFrame();
      return { wall: +walls[1].toFixed(2), gpu: gpu.length ? +gpu[gpu.length >> 1].toFixed(2) : null, calls: Math.round(fs.calls / 12), ktris: Math.round(fs.tris / 12000), hers: { calls: +(own.calls / 12).toFixed(1), ktris: +(own.tris / 12000).toFixed(1) } };
    };
    window.__eShow = (on) => { inner.group.visible = on; };
    window.__eLod = (on) => { const l = inner.lod; if (!l) return; if (on) window.skinnedLods.add(l); else { window.skinnedLods.remove(l); l.reset(); } };
    window.__eView = (name) => {
      const at = m.pos.clone(), f = new THREE.Vector3(Math.sin(m.heading), 0, Math.cos(m.heading));
      const d = { near: 12, mid: 35, far: 90 }[name], eye = at.clone().addScaledVector(f, d).add(new THREE.Vector3(d * 0.3, 2 + d * 0.12, 0));
      window.__benchSet(eye.toArray(), at.clone().add(new THREE.Vector3(0, 3.5, 0)).toArray(), 50);
    };
    // her CPU a frame: the fight's update (her pose in it) over 240 frames, at the fight's 60 Hz
    window.__eCpu = () => { const t0 = performance.now(); for (let i = 0; i < 240; i++) g.update(1 / 60, 100 + i / 60); return +((performance.now() - t0) / 240).toFixed(3); };
    window.__eInventory = () => {
      const mesh = inner.meshes[0], geo = mesh.geometry, map = inner.materials[0]?.map ?? mesh.material.uniforms?.map?.value ?? mesh.material.map, img = map?.image;
      return { tris: (geo.index?.count ?? 0) / 3, verts: geo.attributes.position.count, bones: mesh.skeleton.bones.length, texture: img ? [img.width, img.height] : null, textureMiB: img ? +(img.width * img.height * 4 * 4 / 3 / 2 ** 20).toFixed(1) : null, lod: inner.lod ? { min: inner.lod.min, max: inner.lod.max } : null };
    };
    window.requestAnimationFrame = () => 0;
    return true;
  });
  await sleep(400);
  const inventory = await ev(() => window.__eInventory());
  const cpu = await ev(() => window.__eCpu());
  console.log('her:', JSON.stringify(inventory), 'cpu', cpu, 'ms a frame (fight + pose)');
  const views = {};
  for (const name of viewNames) {
    await ev((n) => { window.__eView(n); window.renderFrame(); window.renderFrame(); return 1; }, name);
    await sleep(200);
    writeFileSync(join(OUT, `${preset}-${name}.png`), Buffer.from((await ev(() => { window.renderFrame(); return window.renderer.domElement.toDataURL('image/png'); })).split(',')[1], 'base64'));
    const runs = { shown: [], hidden: [], whole: [] };
    for (let k = 0; k < reps; k++) for (const c of Object.keys(runs)) {
      await ev((c) => { window.__eShow(c !== 'hidden'); window.__eLod(c !== 'whole'); return 1; }, c);
      runs[c].push(await ev(() => window.__eTime(20)));
    }
    await ev(() => { window.__eShow(true); window.__eLod(true); return 1; });
    const level = await ev(() => { window.renderFrame(); const l = window.level.temples.find((t) => t.id === 'arzach').guardian.model.inner.lod; return l ? { j: l.j, tris: l.stats.tris } : null; });
    const med = (list, k) => { const v = list.map((x) => (k ? x[k] : x)).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
    const sum = (c) => ({ gpu: med(runs[c], 'gpu'), wall: med(runs[c], 'wall'), calls: med(runs[c], 'calls'), ktris: med(runs[c], 'ktris'), hers: runs[c][0].hers });
    views[name] = { level, shown: sum('shown'), hidden: sum('hidden'), whole: sum('whole') };
    const v = views[name];
    console.log(`${name.padEnd(5)} level ${level?.j} (${level?.tris} tris) | gpu shown ${v.shown.gpu} hidden ${v.hidden.gpu} whole ${v.whole.gpu} ms | wall ${v.shown.wall}/${v.hidden.wall}/${v.whole.wall} | her draws ${v.shown.hers.calls}, ${v.shown.hers.ktris}k tris (whole ${v.whole.hers.ktris}k)`);
  }
  writeFileSync(join(OUT, `elder-${preset}.json`), JSON.stringify({ preset, res: [W, H], scale, gl, inventory, cpu, views, fight: { ...fight, shots: fight.shots.map((s) => ({ key: s.key, t: s.t })) } }, null, 1));
} finally {
  try { ws?.close(); } catch { /* gone */ }
  proc.kill('SIGKILL');
  removeTemp(profile);
}
