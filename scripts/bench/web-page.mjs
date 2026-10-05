// What the web side of the benchmark does in the game's page, shared by the Mac run (web-bench.mjs,
// Playwright) and the handheld run (android-web.mjs, DevTools protocol to the device's Chrome).
// `ev(fn, arg)` evaluates a function with one JSON argument in the page and returns its value.
import { stats, hitches, median, sleep } from './lib.mjs';

export const SCALE = { high: 1, handheld: 0.75 };

/** the tab's storage: the prologue done and the backpack (as the Unity side), the preset, no fps line (its GPU timer would collide with ours), sound off */
export const prepareStorage = (ev, quality) => ev((quality) => {
  localStorage.clear();
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality, showFps: false, music: 0, effects: 0, voices: 0 }));
  return true;
}, quality);

/** fixed scale (no dynamic resolution), the hour, the weather, the HUD hidden, the camera pinnable, the traveller placeable */
export const conditions = (ev, o) => ev(({ hour, weather, scale }) => {
  const { THREE, camera } = window;
  const p = window.preset(); p.dynamic = null;
  window.quality.renderScale = scale; window.resize();
  window.sky.hour = hour; window.sky.speed = 0; window.updateSky?.();
  window.weather.mode = weather; window.weather.intensity = 0;
  // the HUD and everything over the canvas out of the frame (as the Unity side hides its canvases)
  const hide = document.createElement('style');
  hide.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }';
  document.head.appendChild(hide);
  document.querySelectorAll('body > *').forEach((e) => { if (e.tagName !== 'CANVAS' && e.querySelector('canvas')) e.style.setProperty('visibility', 'visible', 'important'); });
  // the camera pinned where the bench says, whatever the rig or a scene does with it
  const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4();
  window.__benchCam = null;
  window.__benchSet = (eye, target, fov) => {
    const e = new THREE.Vector3(...eye), t = new THREE.Vector3(...target);
    window.__benchCam = { eye: e, q: new THREE.Quaternion().setFromRotationMatrix(m.lookAt(e, t, up)), fov };
  };
  const base = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) {
    const c = window.__benchCam;
    if (c) { this.position.copy(c.eye); this.quaternion.copy(c.q); if (this.fov !== c.fov) { this.fov = c.fov; this.updateProjectionMatrix(); } }
    return base.call(this, force);
  };
  window.__benchPlace = (p, h) => {
    window.player.teleport(new THREE.Vector3(...p), up, new THREE.Vector3(0, 0, 1));
    window.player.heading = h;
  };
  const c = window.renderer.domElement;
  return [c.width, c.height];
}, o);

async function record(ev, seconds) {
  await ev(() => { window.__bench.reset(); window.__bench.rec = true; return true; });
  await sleep(seconds * 1000);
  return ev(() => {
    const B = window.__bench; B.rec = false;
    const m = performance.memory;
    return { frames: B.frames, cpu: B.cpu, gpu: B.gpu, calls: B.calls, tris: B.tris, heap: m ? { used: m.usedJSHeapSize, total: m.totalJSHeapSize } : null, preError: B.preError ?? null };
  });
}

function summarise(name, kind, seconds, r, tag) {
  const f = stats(r.frames);
  const v = {
    name, kind, secs: seconds, frames: r.frames.length, fps: +(r.frames.length / (r.frames.reduce((a, b) => a + b, 0) / 1000)).toFixed(1),
    frame: f, cpu: stats(r.cpu), gpu: stats(r.gpu), hitches: f ? hitches(r.frames, f.median) : null,
    draws: median(r.calls), tris: median(r.tris), mem: { jsHeapUsed: r.heap?.used, jsHeapTotal: r.heap?.total },
    raw: { frame: r.frames.map((x) => +x.toFixed(2)), gpu: r.gpu.map((x) => +x.toFixed(2)), cpu: r.cpu.map((x) => +x.toFixed(2)) },
  };
  if (r.preError) v.error = r.preError;
  console.log(`${tag} ${name.padEnd(11)} frame ${f?.median} ms (mean ${f?.mean}, p95 ${f?.p95}, p99 ${f?.p99}) cpu ${v.cpu?.median} gpu ${v.gpu?.median} draws ${v.draws} tris ${v.tris}`);
  return v;
}

/**
 * Every view (placed, warmed up, recorded) and every path (held at its start for the warm-up, then the
 * traveller and the camera carried along it by the clock on each animation frame, recorded).
 * onEach(name, kind) runs after each recording (a screenshot, a thermal reading).
 */
export async function runAll(ev, VP, { secs, warmup, only = null, paths = true, tag = 'web', onEach = async () => ({}) }) {
  const views = [];
  let first = true;
  for (const v of VP.views) {
    if (only && !only.includes(v.name)) continue;
    await ev((v) => { window.__benchPlace(v.player, v.heading); window.__benchSet(v.eye, v.target, v.fov); return true; }, v);
    await sleep((warmup + (first ? 2 : 0)) * 1000); first = false;
    const r = await record(ev, secs);
    views.push(Object.assign(summarise(v.name, 'view', secs, r, tag), await onEach(v.name, 'view')));
  }
  if (paths) for (const p of VP.paths) {
    if (only && !only.includes(p.name)) continue;
    await ev((p) => {
      const pts = p.points, n = pts.length;
      const at = (s) => {
        const k = Math.min(Math.max(s, 0), n - 1.001), i = Math.floor(k), u = k - i, a = pts[i], b = pts[i + 1];
        const L = (x, y) => x.map((c, j) => c + (y[j] - c) * u);
        let dh = b.h - a.h; dh = ((dh + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        return { p: L(a.p, b.p), h: a.h + dh * u, eye: L(a.eye, b.eye), target: L(a.target, b.target) };
      };
      const s0 = at(0);
      window.__benchPlace(s0.p, s0.h); window.__benchSet(s0.eye, s0.target, p.fov);
      window.__benchPath = { at, speed: p.speed, t0: null };
      window.__bench.pre = () => {
        const P = window.__benchPath; if (P.t0 === null) return;
        const s = at(((performance.now() - P.t0) / 1000) * P.speed);
        window.player.pos.set(...s.p); window.player.vel.set(0, 0, 0); window.player.heading = s.h;
        window.__benchSet(s.eye, s.target, p.fov);
      };
      return true;
    }, p);
    await sleep(warmup * 1000);
    await ev(() => { window.__benchPath.t0 = performance.now(); return true; });
    const r = await record(ev, p.secs);
    await ev(() => { window.__bench.pre = null; return true; });
    views.push(Object.assign(summarise(p.name, 'path', p.secs, r, tag), await onEach(p.name + '-end', 'path')));
  }
  return views;
}

/** what the GPU holds (an estimate: every geometry's and instance buffer's bytes in the scene) and the textures */
export const gpuEstimate = (ev) => ev(() => {
  const geo = new Set(); let inst = 0;
  window.scene.traverse((o) => { if (o.geometry) geo.add(o.geometry); if (o.instanceMatrix) inst += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); });
  let bytes = 0;
  for (const g of geo) { for (const a of Object.values(g.attributes)) bytes += a.array?.byteLength ?? a.data?.array?.byteLength ?? 0; if (g.index) bytes += g.index.array.byteLength; }
  const info = window.renderer.info.memory;
  return { geometryMB: +((bytes + inst) / 1e6).toFixed(1), geometries: info.geometries, textures: info.textures, programs: window.renderer.info.programs?.length };
});
