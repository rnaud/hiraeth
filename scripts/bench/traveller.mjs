// What the traveller costs (docs/systems/characters.md, "What the traveller costs"): his meshes, triangles,
// textures and their GPU memory, the load spent on his files (fetch, image decode, texture upload), and his
// share of a frame at four views round him (the conversation's face close shot, full body, from behind as
// the game's camera follows him, far off): the whole frame with him shown and hidden (A/B, interleaved),
// timed on the GPU (EXT_disjoint_timer_query_webgl2) and on the wall (synced by a readPixels), with its
// draw calls and triangles. Muted, on the GPU, never port 5173.
//   npx vite build && node scripts/bench/serve.mjs --port 5521 &
//   PLAYWRIGHT=…/playwright-core/index.mjs node scripts/bench/traveller.mjs --url http://localhost:5521/ --preset handheld
//        [--res 1280x720] [--scale 0.75] [--reps 5] [--shots dir] [--out file.json] [--views face,body,back,far] [--alone 1]
// --alone 1: nothing drawn but him (and the passes' fixed work), so his GPU time stands out of the Mac's noise
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { options, sleep, footprints } from './lib.mjs';
import { launch, glInfo } from './browser.mjs';
import { SCALE, prepareStorage, conditions } from './web-page.mjs';

const opt = options();
const BASE = (opt.url ?? 'http://localhost:5521/').replace(/\/?$/, '/');
const preset = opt.preset ?? 'handheld';
const [w, h] = (opt.res ?? '1280x720').split('x').map(Number);
const scale = opt.scale ? +opt.scale : (SCALE[preset] ?? 1);
const reps = +(opt.reps ?? 5);
const shots = typeof opt.shots === 'string' ? resolve(opt.shots) : null;
if (shots) mkdirSync(shots, { recursive: true });
const viewNames = typeof opt.views === 'string' ? opt.views.split(',') : ['face', 'body', 'back', 'far'];

// The load's uploads and decodes, timed from the page's first script: every texImage2D / texSubImage2D /
// texStorage2D / compressedTexImage2D of at least 1024 × 1024, and every createImageBitmap's decode.
const LOAD_HOOKS = `(() => {
  const L = window.__travLoad = { uploads: [], decodes: [] };
  const P = WebGL2RenderingContext.prototype;
  for (const name of ['texImage2D', 'texSubImage2D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'generateMipmap']) {
    const f = P[name];
    P[name] = function (...a) {
      const t0 = performance.now(); const r = f.apply(this, a); const ms = performance.now() - t0;
      const src = a.find((x) => x && typeof x === 'object' && 'width' in x && 'height' in x);
      const wd = src ? src.width : (typeof a[3] === 'number' ? a[3] : 0), ht = src ? src.height : (typeof a[4] === 'number' ? a[4] : 0);
      if (name === 'generateMipmap' ? ms > 2 : wd * ht >= 1024 * 1024) L.uploads.push({ name, w: wd, h: ht, ms: +ms.toFixed(2), at: +t0.toFixed(0) });
      return r;
    };
  }
  const cib = window.createImageBitmap;
  window.createImageBitmap = function (...a) {
    const t0 = performance.now();
    return cib.apply(this, a).then((b) => { if (b.width * b.height >= 1024 * 1024) L.decodes.push({ w: b.width, h: b.height, ms: +(performance.now() - t0).toFixed(1), at: +t0.toFixed(0) }); return b; });
  };
})();`;

const profile = resolve(`/tmp/.chrome-traveller-${process.pid}`);
// headless (no window on the author's screen); glInfo below refuses a software renderer
const { ctx, page, pids } = await launch({ w, h, profile, headless: true });
await page.addInitScript(LOAD_HOOKS);
const ev = (fn, arg) => page.evaluate(fn, arg);
const logs = [];
page.on('console', (m) => { const s = m.text(); if (/^(load:|shaders:|traveller lod)/.test(s)) logs.push(s); });
page.on('pageerror', (e) => console.error('page error:', String(e).slice(0, 200)));
await page.goto(BASE + 'manifest.webmanifest');
const gl = await glInfo(page);
console.log('GPU:', gl.renderer, 'timer query:', gl.timerQuery);
if (/SwiftShader|llvmpipe|Software/i.test(gl.renderer ?? '')) { console.error('software rendering'); process.exit(2); }
await prepareStorage(ev, preset);
await ev(() => { localStorage.setItem('moebius.muted', '1'); return 1; });   // (and Chrome's --mute-audio)
const tNav = Date.now();
await page.goto(BASE + '?level=desert', { waitUntil: 'load' });
await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame && window.player?.character, null, { timeout: 300000, polling: 100 });
const bootMs = Date.now() - tNav;
// his levels of detail (characters/traveller-lod.js), built in a worker after he is made (none in older builds)
const lodMs = await page.waitForFunction(() => window.player.character.lod, null, { timeout: 30000, polling: 100 }).then(() => Date.now() - tNav - bootMs, () => null);
await sleep(4000);
await conditions(ev, { hour: 10, weather: 'clear', scale });
await ev(() => { window.__bench.timeGpu = false; window.sound?.setVolume?.(0); return true; });

// what he is made of, as drawn
const inventory = await ev(() => {
  const ch = window.player.character, meshes = [];
  const seen = new Set();
  const texMB = (t) => { const i = t?.image; if (!i) return 0; const wd = i.width ?? i.data?.width ?? 0, ht = i.height ?? i.data?.height ?? 0; return t.isCompressedTexture ? 0 : wd * ht * 4 * (t.generateMipmaps !== false ? 4 / 3 : 1) / 1e6; };
  const textures = new Map();
  const visit = (o, tag) => {
    if (!o.isMesh || seen.has(o)) return; seen.add(o);
    const g = o.geometry, a = g.attributes, tris = (g.index ? g.index.count : a.position.count) / 3;
    const morphs = Object.values(g.morphAttributes ?? {}).reduce((s, l) => s + l.length, 0);
    const bytes = Object.values(a).reduce((s, x) => s + (x.array?.byteLength ?? 0), 0) + (g.index?.array.byteLength ?? 0)
      + Object.values(g.morphAttributes ?? {}).flat().reduce((s, x) => s + x.array.byteLength, 0);
    for (const m of [].concat(o.material)) for (const k of Object.keys(m.uniforms ?? {})) { const v = m.uniforms[k].value; if (v?.isTexture && v.image && (v.image.width ?? 0) >= 512) textures.set(v, k); }
    for (const m of [].concat(o.material)) if (m.map) textures.set(m.map, 'map');
    meshes.push({ tag, name: o.name || o.type, visible: o.visible, skinned: !!o.isSkinnedMesh, verts: a.position.count, tris, morphs, attrs: Object.keys(a).join(' '), geomMB: +(bytes / 1e6).toFixed(2), shadow: o.castShadow });
  };
  window.player.object.traverse((o) => o.visible !== false && visit(o, 'player'));
  for (const s of ch.shadowCasters ?? []) s.traverse((o) => visit(o, 'shadow'));
  const bySource = new Map(); for (const [t, k] of textures) if (!bySource.has(t.source)) bySource.set(t.source, [t, k]);   // (copies of one texture share its upload)
  const tex = [...bySource.values()].map(([t, k]) => ({ uniform: k, w: t.image.width, h: t.image.height, gpuMB: +texMB(t).toFixed(1), format: t.format, compressed: !!t.isCompressedTexture }));
  const drawn = meshes.filter((m) => m.visible);
  return { meshes: drawn, textures: tex, totals: { meshes: drawn.length, tris: drawn.reduce((s, m) => s + m.tris, 0), verts: drawn.reduce((s, m) => s + m.verts, 0), geomMB: +drawn.reduce((s, m) => s + m.geomMB, 0).toFixed(1), texMB: +tex.reduce((s, t) => s + t.gpuMB, 0).toFixed(1) } };
});
const load = await ev(() => {
  const res = performance.getEntriesByType('resource').filter((r) => /characters\/traveller-v1\//.test(r.name))
    .map((r) => ({ file: r.name.replace(/^.*characters\/traveller-v1\//, ''), kB: Math.round((r.encodedBodySize || r.transferSize) / 1024), ms: +r.duration.toFixed(0), start: +r.startTime.toFixed(0) }));
  return { files: res, ...window.__travLoad };
});
console.log('boot', bootMs, 'ms'); for (const l of logs) console.log(' ', l);
console.log('traveller files:', JSON.stringify(load.files));
console.log('big uploads:', JSON.stringify(load.uploads));
console.log('big decodes:', JSON.stringify(load.decodes));
console.log('drawn:', JSON.stringify(inventory.totals));
for (const m of inventory.meshes) console.log('  ', JSON.stringify(m));
for (const t of inventory.textures) console.log('  tex', JSON.stringify(t));
const mem = footprints(pids());
console.log('memory (all Chrome processes):', (mem.total / 2 ** 20).toFixed(0), 'MiB, graphics', (mem.graphics / 2 ** 20).toFixed(0), 'MiB');

// the views, round where he stands (his feet, his heading), as the game's cameras frame him
await ev(() => {
  const { THREE } = window, p = window.player;
  const ch = p.character, skel = ch.mesh.skeleton;
  const head = skel.bones.find((b) => /^head$/i.test(b.name));
  window.__travViews = (name) => {
    p.object.updateMatrixWorld(true);
    const feet = p.object.getWorldPosition(new THREE.Vector3());
    const f = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    const r = new THREE.Vector3(-f.z, 0, f.x), up = new THREE.Vector3(0, 1, 0);
    const face = head.getWorldPosition(new THREE.Vector3()).addScaledVector(up, 0.07).addScaledVector(f, 0.06);
    const at = (v, a, d, y) => v.clone().addScaledVector(f, Math.cos(a) * d).addScaledVector(r, Math.sin(a) * d).addScaledVector(up, y);
    const V = {
      face: { eye: at(face, 0.5, 1.2, -0.08), target: face.clone().addScaledVector(up, -0.06), fov: 34 },
      body: { eye: at(feet, 0.35, 3.2, 1.0), target: feet.clone().addScaledVector(up, 0.9), fov: 45 },
      back: { eye: at(feet, Math.PI + 0.25, 3.6, 1.9), target: feet.clone().addScaledVector(up, 1.2), fov: 55 },
      far: { eye: at(feet, 0.6, 16, 2.5), target: feet.clone().addScaledVector(up, 0.9), fov: 50 },
    }[name];
    return { eye: V.eye.toArray(), target: V.target.toArray(), fov: V.fov };
  };
  // hide him (and his shirt's own shadow pass, main.js) or show him; his levels of detail off or on
  window.__travShow = (on) => { p.object.visible = on; };
  window.__travLod = (on) => { const l = ch.lod; if (!l) return; if (on) window.skinnedLods.add(l); else { window.skinnedLods.remove(l); l.reset(); } };
  // his own draws and triangles (every pass: the G-buffer, the shadow maps, his shirt's shadow), counted
  // at the renderer's every draw
  const mine = new Set();
  p.object.traverse((o) => o.isMesh && mine.add(o));
  for (const c of ch.shadowCasters ?? []) c.traverse((o) => o.isMesh && mine.add(o));
  const own = { calls: 0, tris: 0 }, r = window.renderer, draw = r.renderBufferDirect;
  r.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (mine.has(object)) {
      const n = geometry.index ? geometry.index.count : geometry.attributes.position.count, dr = geometry.drawRange;
      own.calls++; own.tris += Math.max(0, Math.min(n - dr.start, dr.count, group ? group.count : Infinity)) / 3;
    }
    return draw.call(this, camera, scene, geometry, material, object, group);
  };
  // the whole frame's GPU time (one query round renderFrame) and its wall time (synced by a readPixels)
  const gl = r.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), px = new Uint8Array(4);
  window.__travTime = async (n) => {
    const run = (k) => { const t0 = performance.now(); for (let i = 0; i < k; i++) window.renderFrame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / k; };
    run(12);
    const walls = [run(24), run(24), run(24)].sort((a, b) => a - b);
    const gpu = [];
    for (let i = 0; i < n && ext; i++) {
      const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); window.renderFrame(); gl.endQuery(ext.TIME_ELAPSED_EXT);
      for (let k = 0; k < 400 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); k++) await new Promise((res) => setTimeout(res, 2));
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
    gpu.sort((a, b) => a - b);
    // draws and triangles a frame, over 12 frames (the shadow maps refresh every few)
    const fs = window.frameStats; fs.calls = fs.tris = fs.n = 0; own.calls = own.tris = 0;
    for (let i = 0; i < 12; i++) window.renderFrame();
    return { wall: +walls[1].toFixed(2), gpu: gpu.length ? +gpu[gpu.length >> 1].toFixed(2) : null, calls: Math.round(fs.calls / 12), ktris: Math.round(fs.tris / 12000), his: { calls: Math.round(own.calls / 12), ktris: +(own.tris / 12000).toFixed(1) } };
  };
  window.__travShot = () => { window.renderFrame(); return r.domElement.toDataURL('image/png'); };
  // --alone: everything else hidden (the sky, the ground, the people…), so the GPU time is his and the passes' fixed cost
  window.__travAlone = () => {
    const keep = (o) => { for (let q = o; q; q = q.parent) if (q === p.object || (ch.shadowCasters ?? []).includes(q)) return true; return false; };
    let n = 0;
    window.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.visible && !keep(o)) { o.visible = false; n++; } });
    return n;
  };
  return true;
});

const hasLod = await ev(() => !!window.player.character.lod);
console.log('levels of detail:', hasLod ? `built ${lodMs} ms after boot` : 'none');
// the world held still from here (no game frames, only ours): every condition draws the same frame
await ev(() => { window.requestAnimationFrame = () => 0; return 1; });
await sleep(300);
if (opt.alone) console.log('alone: hid', await ev(() => window.__travAlone()), 'other objects');
const results = { preset, res: [w, h], scale, gl: gl.renderer, time: new Date().toISOString(), bootMs, lodMs, logs, load, inventory, memory: mem, views: {} };
const shot = async (file) => writeFileSync(file, Buffer.from((await ev(() => window.__travShot())).split(',')[1], 'base64'));
for (const name of viewNames) {
  const v = await ev((n) => window.__travViews(n), name);
  await ev((v) => { window.__benchSet(v.eye, v.target, v.fov); window.renderFrame(); window.renderFrame(); return true; }, v);
  await sleep(300);
  if (shots) {
    await shot(join(shots, `${preset}-${name}.png`));
    if (hasLod) { await ev(() => { window.__travLod(false); return 1; }); await shot(join(shots, `${preset}-${name}-full.png`)); await ev(() => { window.__travLod(true); return 1; }); }
  }
  const runs = { shown: [], hidden: [], ...(hasLod ? { full: [] } : {}) };
  for (let k = 0; k < reps; k++) for (const c of Object.keys(runs)) {
    await ev((c) => { window.__travShow(c !== 'hidden'); window.__travLod(c !== 'full'); return 1; }, c);
    await sleep(100);
    runs[c].push(await ev(() => window.__travTime(24)));
  }
  await ev(() => { window.__travShow(true); window.__travLod(true); return 1; });
  const level = await ev(() => { window.renderFrame(); const l = window.player.character.lod; return l ? { j: l.j, tris: l.stats.tris, full: l.stats.full, each: l.entries.map((e) => `${e.mesh.name}:${e.cur}`).join(' ') } : null; });
  const med = (l, f) => { const a = l.map(f).filter((x) => x != null).sort((a, b) => a - b); return a.length ? a[a.length >> 1] : null; };
  const row = {};
  for (const [s, l] of Object.entries(runs)) row[s] = { wall: med(l, (x) => x.wall), gpu: med(l, (x) => x.gpu), calls: med(l, (x) => x.calls), ktris: med(l, (x) => x.ktris), his: l[0].his };
  const share = (a) => ({ wall: +(a.wall - row.hidden.wall).toFixed(2), gpu: a.gpu != null ? +(a.gpu - row.hidden.gpu).toFixed(2) : null, ...a.his });
  row.traveller = share(row.shown);
  if (row.full) row.travellerFull = share(row.full);
  row.level = level;
  results.views[name] = row;
  console.log(`== ${name}: frame ${row.shown.wall} ms wall, ${row.shown.gpu} ms GPU, ${row.shown.calls} draws, ${row.shown.ktris} ktris; hidden ${row.hidden.wall} / ${row.hidden.gpu} ms`
    + ` → he costs ${JSON.stringify(row.traveller)}` + (row.full ? `\n   without his levels → ${JSON.stringify(row.travellerFull)}; level ${JSON.stringify(level)}` : ''));
}
if (opt.out) { const out = resolve(opt.out); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(results, null, 1) + '\n'); }
await ctx.close();
rmSync(profile, { recursive: true, force: true });
process.exit(0);
