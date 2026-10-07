// Every world on the Steam Deck, in its own runtime (Electron, desktop/main.mjs), driven over the DevTools
// protocol: the game started on the Deck with --remote-debugging-port=9222 and an ssh tunnel to it
// (scripts/bench/deck-run.sh does both), then on the Mac:
//   node scripts/bench/deck-worlds.mjs [--port 5310] [--worlds desert,incal,...] [--quality deck|high|handheld]
//        [--scale 1] [--modes fixed,dynamic] [--secs 8] [--warmup 3] [--only spawn,qanat] [--profile 1] [--raw dir]
// Per world: the world loaded (?level=, navigation to the first frame), then every view of the world
// (viewpoints-worlds.json; the desert's are viewpoints.json's) placed, warmed up and recorded with the page
// logic of the other runs (web-page.mjs): frame intervals, the screen refreshes missed, the JS time of
// the animation-frame callbacks, the GPU time (timer queries), draws; in mode `dynamic` the render scale
// the game chose. --profile: the main thread's time by system at each view (the Android run's profiler).
// The game's sound stays at 0 (and the Deck's game runs with --mute-audio). See docs/systems/performance.md,
// "Every world on the Steam Deck".
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { options, viewpoints, sleep, ROOT, stats } from './lib.mjs';
import { INSTRUMENT } from './browser.mjs';
import { conditions, runAll } from './web-page.mjs';

const opt = options();
const PORT = +(opt.port ?? 5310);
const ORIGIN = 'moebius://game/index.html';
const VP = viewpoints();
const picked = JSON.parse(readFileSync(resolve(ROOT, 'scripts/bench/viewpoints-worlds.json'), 'utf8'));
const WORLDS = String(opt.worlds ?? 'desert,incal,bazaar,arzach,arzach2,garage,buried,edena,spheres,perdide,perdide2,home').split(',');
const quality = String(opt.quality ?? 'deck');
const modes = String(opt.modes ?? 'fixed').split(',');
const fixedScale = +(opt.scale ?? 1);
const secs = +(opt.secs ?? 8), warmup = +(opt.warmup ?? 3);
const only = typeof opt.only === 'string' ? opt.only.split(',') : null;
const RAW = resolve(opt.raw ?? `${ROOT}/scripts/bench/results/raw/deck-worlds-${quality}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`);
mkdirSync(RAW, { recursive: true });

// ------------------------------------------------------------------ the DevTools protocol, one page
class Page {
  static async open(port) {
    for (let i = 0; i < 120; i++) {
      try {
        const t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === 'page');
        if (t) { const p = new Page(); await p.connect(t.webSocketDebuggerUrl); return p; }
      } catch { /* starting */ }
      await sleep(1000);
    }
    throw new Error(`no page on port ${port}: start the game with scripts/bench/deck-run.sh`);
  }
  async connect(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.errors = [];
    this.ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id) { this.pending.get(d.id)?.(d); this.pending.delete(d.id); }
      else if (d.method === 'Runtime.exceptionThrown') this.errors.push(String(d.params.exceptionDetails?.exception?.description ?? d.params.exceptionDetails?.text).slice(0, 200));
    };
    await new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; });
    await this.send('Runtime.enable'); await this.send('Page.enable');
  }
  send(method, params = {}) { return new Promise((r) => { const i = ++this.id; this.pending.set(i, r); this.ws.send(JSON.stringify({ id: i, method, params })); }); }
  async eval(fn, arg) {
    const expression = typeof fn === 'string' ? fn : `(${fn})(${JSON.stringify(arg ?? null)})`;
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
    return r.result?.result?.value;
  }
  async waitFor(expr, ms = 300000, every = 250) {
    const t = Date.now();
    while (Date.now() - t < ms) { try { if (await this.eval(expr)) return true; } catch { /* navigating */ } await sleep(every); }
    throw new Error(`timed out: ${expr}`);
  }
}

const EXTRA = `(() => {
  const B = window.__bench, reset = B.reset;
  B.reset = () => { B.scales = []; reset(); };
  B.scales = [];
  setInterval(() => { if (B.rec && window.quality) B.scales.push(window.quality.renderScale); }, 250);
})();`;

/** the main thread's time per frame by system (as scripts/bench/android-worlds.mjs PROFILE) */
const PROFILE = `(() => {
  if (window.__prof) return true;
  const acc = {}, P = window.__prof = { on: false, acc };
  const wrap = (name, obj, key) => {
    if (!obj || typeof obj[key] !== 'function' || obj[key].__w) return;
    const f = obj[key];
    const w = function (...a) { if (!P.on) return f.apply(this, a); const t = performance.now(); try { return f.apply(this, a); } finally { acc[name] = (acc[name] || 0) + performance.now() - t; } };
    w.__w = 1; obj[key] = w;
  };
  const W = window;
  for (const [n, o, k] of [['crowd', W.crowd, 'update'], ['player', W.player, 'update'], ['rig', W.rig, 'update'], ['story', W.storyRt, 'update'], ['wind', W.wind, 'update'],
    ['level', W.level, 'update'], ['reactive', W.reactiveWorld, 'update'], ['wildlife', W.wildlife, 'update'], ['waters', W.waters, 'update'], ['sound', W.sound, 'update'],
    ['weather', W.weather, 'update'], ['sky', W, 'updateSky'], ['r.flora', W.flora, 'update'], ['r.grass', W.blades?.grass, 'update'], ['r.lod', W.lod?.(), 'update'],
    ['r.skinnedLods', W.skinnedLods, 'update'], ['r.shadowCull', W.shadowCull, 'begin'], ['r.bloom', W.bloom, 'render']]) wrap(n, o, k);
  for (const n of W.npcs) wrap('npcs', n, 'update');
  const R = W.renderer, render = R.render;
  R.render = function (sc, cam) {
    if (!P.on) return render.call(this, sc, cam);
    const k = sc.overrideMaterial ? 'r.pass.shadow' : sc === W.scene ? 'r.pass.gbuffer' : sc === W.post.scene ? 'r.pass.composite' : 'r.pass.other';
    const t = performance.now(); try { return render.call(this, sc, cam); } finally { acc[k] = (acc[k] || 0) + performance.now() - t; }
  };
  return true;
})()`;
async function profileView(page, seconds = 4) {
  await page.eval(PROFILE);
  await page.eval(() => { const P = window.__prof; for (const k of Object.keys(P.acc)) delete P.acc[k]; window.__bench.reset(); window.__bench.rec = true; P.on = true; return true; });
  await sleep(seconds * 1000);
  return page.eval(() => {
    const P = window.__prof, B = window.__bench; P.on = false; B.rec = false;
    const n = B.cpu.length, total = B.cpu.reduce((s, x) => s + x, 0);
    const per = Object.fromEntries(Object.entries(P.acc).map(([k, v]) => [k, +(v / n).toFixed(2)]).sort((a, b) => b[1] - a[1]));
    const sum = Object.values(P.acc).reduce((s, v) => s + v, 0);
    return { frames: n, jsPerFrame: +(total / n).toFixed(2), bySystem: per, rest: +((total - sum) / n).toFixed(2) };
  });
}

/** the share of frames that missed a refresh: longer than 1.5× the screen's interval (the quickest tenth of the frames) */
function missedShare(frames) {
  const s = [...frames].sort((a, b) => a - b), refresh = s[Math.floor(s.length * 0.1)] ?? 16.7;
  return +(frames.filter((f) => f > 1.5 * refresh).length / Math.max(frames.length, 1) * 100).toFixed(1);
}

async function runWorld(page, world, mode) {
  const label = `${world} ${quality} ${mode}`;
  page.errors = [];
  await page.eval((q) => {
    localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
    localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: q, showFps: true, hudV: 1, deckV: 1, music: 0, effects: 0, voices: 0 }));
    return true;
  }, quality);
  const t0 = Date.now();
  await page.send('Page.navigate', { url: `${ORIGIN}?level=${world}&fps=1` });
  await sleep(1500);
  await page.waitFor('!!(window.__moebiusBooted && window.renderFrame && window.player && window.__bench)');
  const load = +((Date.now() - t0) / 1000).toFixed(1);
  await sleep(4000);
  await page.eval(() => { window.story?.closePage?.(); window.sound?.setVolumes?.(0, 0); return true; });
  const W = world === 'desert' ? { views: VP.views, paths: VP.paths } : picked.worlds[world];
  if (!W) throw new Error(`no views for ${world}`);
  const dyn = mode === 'dynamic';
  if (dyn) await page.eval(() => { window.__dyn = window.preset().dynamic; return true; });
  const canvas = await conditions((fn, a) => page.eval(fn, a), { hour: VP.hour, weather: VP.weather, scale: fixedScale });
  if (dyn) await page.eval(() => { window.preset().dynamic = window.__dyn; return true; });
  await page.eval(() => { const st = document.createElement('style'); st.textContent = '#fps { visibility: visible !important; }'; document.head.appendChild(st); return true; });
  const onEach = async () => page.eval(() => {
    const B = window.__bench, s = B.scales.slice().sort((a, b) => a - b);
    return { fpsText: document.getElementById('fps')?.textContent, preset: window.preset().key, scale: window.quality.renderScale, scales: s.length ? { median: s[s.length >> 1], min: s[0], max: s[s.length - 1] } : null };
  });
  const items = [...W.views.map((v) => v.name), ...(W.paths ?? []).map((p) => p.name)].filter((n) => !only || only.includes(n));
  const views = [];
  for (const name of items) {
    await page.eval((l) => { window.__benchLabel = l; return true; }, label + ' ' + name).catch(() => 0);
    const one = { ...VP, views: W.views.filter((x) => x.name === name), paths: (W.paths ?? []).filter((x) => x.name === name) };
    const [v] = await runAll((fn, a) => page.eval(fn, a), one, { secs, warmup, tag: label, onEach });
    v.missedShare = missedShare(v.raw.frame);
    if (opt.profile) {
      v.profile = await profileView(page);
      console.log(`  ${name} profile: js ${v.profile.jsPerFrame} ms ` + Object.entries(v.profile.bySystem).slice(0, 10).map(([k, x]) => `${k} ${x}`).join(', ') + ` rest ${v.profile.rest}`);
    }
    console.log(`${label} ${name.padEnd(9)} ${v.fps} fps p95 ${v.frame?.p95} missed ${v.missedShare}% js ${v.cpu?.median} gpu ${v.gpu?.median} draws ${v.draws} scale ${v.scales?.median ?? v.scale}`);
    views.push(v);
  }
  return { world, mode, quality, load, canvas, errors: page.errors.slice(0, 5), views };
}

const page = await Page.open(PORT);
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT + '\n' + EXTRA });
const out = { when: new Date().toISOString(), quality, fixedScale, gl: await page.eval(() => {
  const gl = document.createElement('canvas').getContext('webgl2'), d = gl?.getExtension('WEBGL_debug_renderer_info');
  return { renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null, ua: navigator.userAgent, size: [innerWidth, innerHeight, devicePixelRatio] };
}), runs: [] };
console.log(out.gl);
for (const world of WORLDS) for (const mode of modes) {
  try { out.runs.push(await runWorld(page, world, mode)); }
  catch (e) { console.error(`${world} ${mode}: ${e.message}`); out.runs.push({ world, mode, quality, error: e.message }); }
  writeFileSync(`${RAW}/deck-worlds.json`, JSON.stringify(out, null, 1));
}
console.log(`${RAW}/deck-worlds.json`);
process.exit(0);
