// The motion check (docs/systems/rendering.md, "Stable in motion"): a build of the game in headless Chrome, its own
// clock stepped by hand (performance.now and requestAnimationFrame taken over once booted: every frame the same
// from run to run), the camera carried along a path frame by frame, every frame read back and measured.
//   node scripts/motion-check/serve.mjs --builds <dir of dist-<name>/> [--port 6121]
//   node scripts/motion-check/record.mjs --level bazaar --build main --preset high --paths pan,zoom --out <dir>
//   [--res 1728x1117@2]            the window (CSS px) and its device pixel ratio
//   [--toggles detail,wear,...]    the slow paths again with a feature off (TOG below): its share of the flicker
//   [--save 1]                     the frames as WebM clips (half size, and a 1:1 crop of the hottest part: --crop x,y,w,h)
//   [--frames N] [--tag t] [--hour 10] [--js file] (run in the page after setup) [--keepframes 3,4] [--heatcrop x,y,w,h]
//   [--zoomfrom 30 --zoomto 2]     the zoom path's distances
// Measures (per frame, per 10 000 px): flicker, a pixel that went one way by over 20 levels and came straight back
// (with the world frozen and the camera moving a third of a pixel a frame, nothing should); jolt, its second
// difference over 64; on the zoom and swing paths, the residual against the last frame warped to match (a straight
// move toward a wall scales the frame, a turn rotates it: exact for every depth), counted only where the value is
// outside the 3 x 3 it came from. A heat map of the flicker goes with each path.
// Playwright and Chrome as scripts/bench/browser.mjs finds them (PLAYWRIGHT, CHROME); FFMPEG: Playwright's own
// (libvpx: WebM). Chrome runs muted, the game's volume at 0.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { PLAYWRIGHT, CHROME } from '../bench/browser.mjs';
const { chromium } = await import(PLAYWRIGHT);

const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : '1']] : a), []));
const FFMPEG = process.env.FFMPEG ?? `${homedir()}/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac`;
const port = +(A.port ?? 6121), level = A.level ?? 'bazaar', build = A.build ?? 'main', preset = A.preset ?? 'high';
const out = A.out ?? `${tmpdir()}/memento-motion`;
mkdirSync(out, { recursive: true });
const [wh, d] = String(A.res ?? '1728x1117@2').split('@'); const [W, H] = wh.split('x').map(Number); const DPR = +(d ?? 1);
const paths = String(A.paths ?? 'still,pan,drift,zoom,orbitslow,swing30').split(',');
const toggles = A.toggles ? String(A.toggles).split(',') : [];
const tag = A.tag ?? build;
const save = !!A.save;

const CLOCK = `(() => {
  const realNow = performance.now.bind(performance);
  const V = window.__vt = { manual: false, t: 0, q: [] };
  performance.now = () => (V.manual ? V.t : realNow());
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { if (V.manual) { V.q.push(cb); return 1; } return raf((ts) => (V.manual ? V.q.push(cb) : cb(ts))); };
  V.start = () => { V.t = realNow(); V.manual = true; };
  V.step = (dt) => { V.t += dt * 1000; const q = V.q; V.q = []; for (const cb of q) cb(V.t); };
})();`;

// features off (and back on): in-page JS, [off, on]
const DEF = (k) => [`window.__df(${JSON.stringify(k)}, false)`, `window.__df(${JSON.stringify(k)}, true)`];
const POSTU = (k, v) => [`window.__pu ??= {}; window.__pu.${k} ??= post.uniforms.${k}.value; post.uniforms.${k}.value = ${v}`, `post.uniforms.${k}.value = window.__pu.${k}`];
const TOG = {
  detail: DEF('S_DETAIL'), form: DEF('S_FORM'), patch: DEF('S_PATCH'), wear: DEF('S_WEATHER'),
  haze: [`window.__pu ??= {}; window.__pu.hl ??= post.uniforms.uHazeLayers.value; window.__pu.hf ??= post.uniforms.uHeightFog.value; post.uniforms.uHazeLayers.value = [300, 2, 0, 0]; post.uniforms.uHeightFog.value = [0, 20, 0, 0]`,
    `post.uniforms.uHazeLayers.value = window.__pu.hl; post.uniforms.uHeightFog.value = window.__pu.hf`],
  cast: POSTU('uCast', '[0, 0]'),
  inkShadow: POSTU('uInkShadow', '[0, 0]'),
  spot: POSTU('uSpot', '[0, 3, 0.3, 0.2]'),
  ao: POSTU('uAO', '0'),
  wobble: POSTU('uWobble', '0'),
  albedoEdges: POSTU('uAlbedoEdges', '0'),
  shadowEdges: POSTU('uShadowEdges', '0'),
  hatch: [`window.__hh ??= sharedUniforms.uHatch.value; sharedUniforms.uHatch.value = 0`, `sharedUniforms.uHatch.value = window.__hh`],
  aerial: POSTU('uAerial', '0'),
  fog: POSTU('uFogDensity', '0'),
  allfog: [`window.__pu ??= {}; window.__pu.hl ??= post.uniforms.uHazeLayers.value; window.__pu.hf ??= post.uniforms.uHeightFog.value; window.__pu.fm ??= post.uniforms.uFogDensity.value; post.uniforms.uHazeLayers.value = [300, 2, 0, 0]; post.uniforms.uHeightFog.value = [0, 20, 0, 0]; post.uniforms.uFogDensity.value = 0`,
    `post.uniforms.uHazeLayers.value = window.__pu.hl; post.uniforms.uHeightFog.value = window.__pu.hf; post.uniforms.uFogDensity.value = window.__pu.fm`],
  shadows: ['window.__ev ??= { n: preset().nearEvery, f: preset().farEvery, fine: cascades.fine.enabled }; preset().nearEvery = preset().farEvery = 1e9; cascades.fine.enabled = false', 'preset().nearEvery = window.__ev.n; preset().farEvery = window.__ev.f; cascades.fine.enabled = window.__ev.fine'],
  motes: ['window.__mv = [wind.scene.visible]; wind.scene.visible = false', 'wind.scene.visible = window.__mv[0]'],
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => { errs.push(String(e).slice(0, 300)); console.log('pageerror', String(e).slice(0, 300)); });
page.on('console', (m) => { if (m.type() === 'error' && /Shader|WebGLProgram|GL_INVALID|THREE/.test(m.text())) console.log('console', m.text().slice(0, 600)); });
await page.addInitScript(CLOCK);
const base = `http://localhost:${port}/${build}/`;
await page.goto(base + 'manifest.webmanifest');
await page.evaluate((q) => {
  localStorage.clear();
  localStorage.setItem('moebius.game.v1', JSON.stringify({ flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 }, keepsakes: [] }));
  localStorage.setItem('moebius.settings.v1', JSON.stringify({ quality: q, showFps: false, music: 0, effects: 0, voices: 0, volume: 0 }));
}, preset);
const t0 = Date.now();
await page.goto(base + `?level=${level}` + (A.q ? '&' + A.q : ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__moebiusBooted && window.renderFrame && window.player, null, { timeout: 300000, polling: 200 });
console.log(`${level} ${build} ${preset}: booted in ${Date.now() - t0} ms`);
await page.waitForTimeout(3000);

// conditions: fixed scale, the hour, no weather, no HUD, the camera pinnable, the clock taken over
const setup = await page.evaluate(({ hour, noPlace }) => {
  const { THREE, camera } = window;
  window.sound?.setVolume?.(0); window.sound?.setVolumes?.(0, 0);
  const p = window.preset(); p.dynamic = null; window.resize();
  if (hour !== null) { window.sky.hour = hour; } window.sky.speed = 0; window.updateSky?.();
  window.weather.mode = 'clear'; window.weather.intensity = 0;
  const s = document.createElement('style');
  s.textContent = 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }';
  document.head.appendChild(s);
  document.querySelectorAll('body > *').forEach((e) => { if (e.tagName !== 'CANVAS' && e.querySelector('canvas')) e.style.setProperty('visibility', 'visible', 'important'); });
  window.__df = (k, on) => { window.__dl ??= {}; const l = window.__dl[k] ??= (() => { const a = []; scene.traverse((o) => { for (const m of [].concat(o.material ?? [])) if (m.defines && k in m.defines) a.push(m); }); return a; })(); for (const m of l) { if (on) m.defines[k] = ''; else delete m.defines[k]; m.needsUpdate = true; } return l.length; };
  const up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4();
  window.__cam = null;
  const baseUMW = THREE.PerspectiveCamera.prototype.updateMatrixWorld;
  camera.updateMatrixWorld = function (force) {
    const c = window.__cam;
    if (c) { this.position.copy(c.eye); this.quaternion.copy(c.q); if (this.fov !== c.fov) { this.fov = c.fov; this.updateProjectionMatrix(); } }
    return baseUMW.call(this, force);
  };
  window.__setCam = (eye, target, fov, still) => {
    const e = new THREE.Vector3(...eye), t = new THREE.Vector3(...target);
    window.__cam = { eye: e, q: new THREE.Quaternion().setFromRotationMatrix(m4.lookAt(e, t, up)), fov };
    // the traveller stands behind the camera (out of the shot), on the ground: the shadow maps and the zones follow
    if (still || window.__noPlace) return;
    const f = new THREE.Vector3().subVectors(t, e).setY(0); if (f.lengthSq() < 1e-6) f.set(0, 0, 1); f.normalize();
    const px = eye[0] - f.x * 2.5, pz = eye[2] - f.z * 2.5;
    const gy = window.physics.groundAt(px, eye[1] + 1, pz, 400);
    const py = Number.isFinite(gy) ? gy : eye[1] - 1.7;
    window.player.pos.set(px, py, pz); window.player.vel?.set(0, 0, 0);
  };
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  window.__noPlace = noPlace;
  window.__vt.start();
  const c = window.renderer.domElement;
  return { eye: camera.position.toArray(), dir: d.toArray(), fov: camera.fov, player: window.player.pos.toArray(), fb: [c.width, c.height], scale: window.quality.renderScale, sky: window.sky.hour };
}, { hour: A.hour !== undefined ? +A.hour : null, noPlace: !!A.noplace });
console.log('setup', JSON.stringify(setup));
if (A.js) console.log('js:', await page.evaluate(readFileSync(A.js, 'utf8')));

// targets: built walls (pen detail, wear, patches) and form-hatched parts, found by rays from the spawn
const targets = await page.evaluate(() => {
  const { THREE } = window;
  const P = window.player.pos.clone();
  const want = (m) => m.defines && ('S_DETAIL' in m.defines || 'S_WEATHER' in m.defines || 'S_PATCH' in m.defines);
  const wantF = (m) => m.defines && 'S_FORM' in m.defines;
  const built = [], formed = [];
  scene.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible) return; const ms = [].concat(o.material ?? []); if (ms.some(want)) built.push(o); if (ms.some(wantF)) formed.push(o); });
  const BVH = window.physics.levelBVH?.constructor;
  const tree = new Map();
  const bvhOf = (o) => { if (!tree.has(o.geometry)) tree.set(o.geometry, BVH ? new BVH(o.geometry) : null); return tree.get(o.geometry); };
  const inv = new THREE.Matrix4(), lr = new THREE.Ray();
  const cast = (list, ray, far) => {
    let best = null;
    for (const o of list) {
      const b = bvhOf(o); if (!b) continue;
      inv.copy(o.matrixWorld).invert(); lr.copy(ray).applyMatrix4(inv);
      const h = b.raycastFirst(lr, THREE.DoubleSide);
      if (!h) continue;
      const pw = h.point.clone().applyMatrix4(o.matrixWorld), d = pw.distanceTo(ray.origin);
      if (d > far || (best && d >= best.distance)) continue;
      best = { distance: d, point: pw, face: h.face, object: o };
    }
    return best;
  };
  const ground = (x, z, y0) => { const g = window.physics.groundAt(x, y0 + 60, z, 400); return Number.isFinite(g) ? g : y0; };
  const origins = [P.clone()];
  for (const R of [40, 90]) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const x = P.x + Math.sin(a) * R, z = P.z + Math.cos(a) * R; origins.push(new THREE.Vector3(x, ground(x, z, P.y), z)); }
  const walls = [];
  const free = (o, dir, d) => !window.physics.raycastFirst?.(new THREE.Ray(o, dir), THREE.DoubleSide, 0, d);
  for (const [list, kind] of [[built, 'wall'], [formed, 'form']]) {
    if (!list.length) continue;
    for (const O of origins) for (const h of [2, 6]) for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2, dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const o = O.clone(); o.y += h;
      const hit = cast(list, new THREE.Ray(o, dir), 300);
      if (!hit || hit.distance < 6) continue;
      const n = hit.face?.normal?.clone().transformDirection(hit.object.matrixWorld);
      if (!n) continue;
      if (n.dot(dir) > 0) n.negate();
      if (kind === 'wall' && Math.abs(n.y) > 0.3) continue;
      if (!free(o, dir, hit.distance - 2)) continue;   // nothing else in the way (the collision)
      // room in front of it (for the walk and the zoom) and how flat it is round the point
      const p = hit.point.clone(), nh = new THREE.Vector3(n.x, 0, n.z).normalize();
      let clear = 0; for (const d of [8, 16, 24, 32, 64, 96, 128, 192]) { if (free(p.clone().addScaledVector(nh, 0.4), nh, d)) clear = d; else break; }
      let flat = 0;
      const side = new THREE.Vector3(-nh.z, 0, nh.x);
      for (const [u, v] of [[3, 0], [-3, 0], [0, 2.5], [0, -1.5]]) {
        const q = p.clone().addScaledVector(side, u); q.y += v; const e = q.clone().addScaledVector(nh, 4);
        const h2 = cast([hit.object], new THREE.Ray(e, nh.clone().negate()), 8);
        if (h2 && Math.abs(h2.distance - 4) < 0.25) flat++;
      }
      let form = null;
      const g = hit.object.geometry;
      if (kind === 'form' && g.attributes.aFormC && hit.face) {
        const ia = hit.face.a; const c = new THREE.Vector4().fromBufferAttribute(g.attributes.aFormC, ia);
        const ax = new THREE.Vector3().fromBufferAttribute(g.attributes.aFormA, ia);
        if (c.w > 0.5) form = { c: new THREE.Vector3(c.x, c.y, c.z).applyMatrix4(hit.object.matrixWorld).toArray(), a: ax.transformDirection(hit.object.matrixWorld).toArray(), kind: c.w };
      }
      walls.push({ kind, p: p.toArray(), n: nh.toArray(), ny: n.y, dist: hit.distance, from: o.toArray(), name: hit.object.name, form, clear, flat });
    }
  }
  return { walls, built: built.length, formed: formed.length };
});
const score = (w) => Math.abs(w.dist - 40) / 40 - Math.min(w.clear, A.zoomfrom ? 192 : 32) / 16 - w.flat * 0.5 - (w.from[0] === setup.player[0] && w.from[2] === setup.player[2] ? 0.5 : 0);
const wallsBy = (k) => targets.walls.filter((w) => w.kind === k).sort((a, b) => score(a) - score(b));
const wall = wallsBy('wall')[0] ?? null, formT = wallsBy('form').find((w) => w.form) ?? wallsBy('form')[0] ?? null;
console.log(`targets: ${targets.built} built meshes, ${targets.formed} formed; wall ${wall ? wall.dist.toFixed(0) + ' m clear ' + wall.clear + ' flat ' + wall.flat + ' ' + wall.name : 'none'}; form ${formT ? formT.dist.toFixed(0) + ' m ' + (formT.form ? 'axis' : 'no axis') : 'none'}`);

// the paths: (i, n) -> { eye, target, fov }
const V = (a) => a.map(Number);
const add = (a, b, k = 1) => a.map((x, i) => x + b[i] * k);
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const fov = setup.fov;
const radPerPx = (2 * Math.tan((fov * Math.PI) / 360)) / setup.fb[1];
const eye0 = V(setup.eye), dir0 = norm([setup.dir[0], 0, setup.dir[2]]);
const yawDir = (d, a) => [d[0] * Math.cos(a) + d[2] * Math.sin(a), d[1], -d[0] * Math.sin(a) + d[2] * Math.cos(a)];
const W0 = wall ? { eye: wall.from, look: wall.p } : { eye: eye0, look: add(eye0, setup.dir, 10) };
const dirW = norm([W0.look[0] - W0.eye[0], 0, W0.look[2] - W0.eye[2]]);
const pitchW = (W0.look[1] - W0.eye[1]) / Math.max(1, Math.hypot(W0.look[0] - W0.eye[0], W0.look[2] - W0.eye[2]));
const zoomD = wall ? [Math.min(+(A.zoomfrom ?? 30), Math.max(8, wall.clear)), +(A.zoomto ?? 2)] : null;
const PATHS = {
  // the camera held still, the clock running: anything that changes is time (motes, water, people) or a bug
  still: { n: 30, dt: 1 / 30, at: () => ({ eye: eye0, target: add(eye0, setup.dir, 10) }) },
  // a slow pan, 0.35 px a frame at the frame's middle, across the built walls if there are any
  pan: { n: 60, at: (i) => { const d = yawDir(dirW, (i - 30) * 0.35 * radPerPx); return { eye: W0.eye, target: add(W0.eye, [d[0], pitchW, d[2]], 10) }; } },
  // a slow sideways drift (0.35 px a frame at 20 m): parallax, sub-pixel
  drift: { n: 60, at: (i) => { const s = [dirW[2], 0, -dirW[0]]; const e = add(W0.eye, s, (i - 30) * 0.35 * radPerPx * 20); return { eye: e, target: add(e, [dirW[0], pitchW, dirW[2]], 10) }; } },
  // toward the wall along the free ray it was found by, from where it was seen to 2.5 m, the distance halving at
  // an even rate (each scale of the detail the same time)
  walk: wall && { n: 120, at: (i, n) => {
    const d0 = wall.dist, dist = d0 * Math.pow(2.5 / d0, i / (n - 1)), k = dist / d0;
    const e = W0.look.map((x, j) => x + (W0.eye[j] - x) * k);
    return { eye: e, target: W0.look };
  } },
  // straight at the wall along its normal, 30 m to 2 m: the frame only scales (measured against the last one
  // scaled to match: what is left is the drawing changing, a scale of detail handing over)
  zoom: wall && { n: 120, zoom: true, at: (i, n) => {
    const dist = zoomD[0] * Math.pow(zoomD[1] / zoomD[0], i / (n - 1));
    return { eye: add(wall.p, wall.n, dist), target: wall.p, dist };
  } },
  // round a cap or a tank: a quarter turn at its distance
  orbit: formT && { n: 90, at: (i, n) => {
    const c = formT.form ? formT.form.c : formT.p;
    const r0 = Math.max(6, Math.hypot(formT.from[0] - c[0], formT.from[2] - c[2]));
    const a0 = Math.atan2(formT.from[0] - c[0], formT.from[2] - c[2]), a = a0 + (i / (n - 1) - 0.5) * (Math.PI / 2);
    const e = [c[0] + Math.sin(a) * r0, formT.from[1], c[2] + Math.cos(a) * r0];
    return { eye: e, target: [c[0], formT.p[1], c[2]] };
  } },
  // round it slowly: the cap's own surface moves under a third of a pixel a frame (sub-pixel: shimmer shows as flicker)
  orbitslow: formT && { n: 60, at: (i) => {
    const c = formT.form ? formT.form.c : formT.p;
    const r0 = Math.max(6, Math.hypot(formT.from[0] - c[0], formT.from[2] - c[2]));
    const a0 = Math.atan2(formT.from[0] - c[0], formT.from[2] - c[2]), a = a0 + (i - 30) * 0.35 * radPerPx;
    const e = [c[0] + Math.sin(a) * r0, formT.from[1], c[2] + Math.cos(a) * r0];
    return { eye: e, target: [c[0], formT.p[1], c[2]] };
  } },
  // riding / flying fast: 30 m/s forward, 4 m over the start
  fast: { n: 60, at: (i) => { const e = add(eye0, dir0, i * 1.0); e[1] = eye0[1] + 4; return { eye: e, target: add(e, [dir0[0], -0.12, dir0[2]], 10) }; } },
  // walking through the haze, looking far: 1.5 m/s
  haze: { n: 60, at: (i) => { const e = add(eye0, dir0, i * 0.05); return { eye: e, target: add(e, [dir0[0], 0.02, dir0[2]], 100) }; } },
  // a slow turn looking far (the haze's bands and the fog must stay put on the ground as the view turns)
  turn: { n: 60, at: (i) => { const d = yawDir(dir0, (i - 30) * 0.35 * radPerPx); return { eye: eye0, target: add(eye0, [d[0], -0.05, d[2]], 100) }; } },
  // a quick level turn (20 px a frame, 32 degrees): measured against the last frame turned back (exact for any depth: a
  // turn has no parallax), what is left is what doesn't stay put in the world as the view turns
  // one step of 30 degrees: the same against it turned back (what drifts as the view turns, however slowly)
  swing30: { n: 2, swing: Math.PI / 6, at: (i) => { const d = yawDir(dir0, (i - 0.5) * Math.PI / 6); return { eye: eye0, target: add(eye0, [d[0], 0, d[2]], 100) }; } },
  swing: { n: 60, swing: 20 * radPerPx, at: (i) => { const d = yawDir(dir0, (i - 30) * 20 * radPerPx); return { eye: eye0, target: add(eye0, [d[0], 0, d[2]], 100) }; } },
  // down a shaft (the fog by height): 2 m/s down, looking down at 40°
  descend: { n: 60, at: (i) => { const e = add(eye0, [0, -1, 0], i * 0.066); return { eye: e, target: add(e, [dir0[0], -0.84, dir0[2]], 10) }; } },
};

// measuring, in the page: the frame's luma; per frame the mean change, the flicker (a pixel that went one way
// by more than T and came straight back by more than T) and the jolts (|second difference| over 64);
// per 8 × 8 block the flicker events (the heat map)
await page.evaluate(() => {
  const gl = window.renderer.getContext();
  const M = window.__meas = {
    w: 0, h: 0, buf: null, y: [], heat: null, bw: 0, bh: 0,
    begin() { const c = gl.canvas; this.w = gl.drawingBufferWidth; this.h = gl.drawingBufferHeight; this.buf = new Uint8Array(this.w * this.h * 4); this.y = []; this.bw = Math.ceil(this.w / 2); this.bh = Math.ceil(this.h / 2); this.heat = new Float32Array(this.bw * this.bh); this.n = 0; },
    grab() {
      const { w, h, buf } = this;
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const Y = new Uint8Array(w * h);
      for (let i = 0, j = 0; i < Y.length; i++, j += 4) Y[i] = (buf[j] * 54 + buf[j + 1] * 183 + buf[j + 2] * 19) >> 8;
      this.y.push(Y); if (this.y.length > 3) this.y.shift();
      const r = { d1: 0, flick: 0, jolt: 0 };
      if (this.y.length >= 2) {
        const [a, b, c] = this.y.length === 3 ? this.y : [null, ...this.y];
        let s1 = 0, fl = 0, jo = 0; const T = 20;
        for (let yy = 0; yy < h; yy++) {
          const row = yy * w, brow = (yy >> 1) * this.bw;
          for (let x = 0; x < w; x++) {
            const i = row + x, d = c[i] - b[i];
            s1 += d < 0 ? -d : d;
            if (a) {
              const e = b[i] - a[i];
              if ((d > T && e < -T) || (d < -T && e > T)) { fl++; this.heat[brow + (x >> 1)]++; }
              const j = d - e; if (j > 64 || j < -64) jo++;
            }
          }
        }
        r.d1 = s1 / (w * h); let sm = 0; for (let i = 0; i < c.length; i += 97) sm += c[i]; r.mean = sm / (c.length / 97); r.flick = fl / (w * h); r.jolt = jo / (w * h);
      }
      this.n++;
      return r;
    },
    // the last frame against the one before scaled about the middle by k (the camera moved straight in), over the
    // middle third: the drawing's own change
    zoomRes(k, hsPx) {
      const { w, h } = this, [b, c] = this.y.slice(-2), cx = (w - 1) / 2, cy = (h - 1) / 2, hs = Math.round(Math.min(h * 0.16, hsPx));
      let sum = 0, n = 0, big = 0;
      for (let y = Math.round(cy - hs); y < cy + hs; y++) for (let x = Math.round(cx - hs * 1.4); x < cx + hs * 1.4; x++) {
        const sx = cx + (x - cx) / k, sy = cy + (y - cy) / k, x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0, i0 = y0 * w + x0;
        const v = (b[i0] * (1 - fx) + b[i0 + 1] * fx) * (1 - fy) + (b[i0 + w] * (1 - fx) + b[i0 + w + 1] * fx) * fy;
        const d = Math.abs(c[y * w + x] - v); sum += d; n++;
        // (a change only if the value is outside the range of the 3 x 3 it moved from, by over 24: a line resampled is not)
        const cv = c[y * w + x], ri = Math.round(sy) * w + Math.round(sx);
        let lo = 255, hi = 0;
        for (const o of [-w - 1, -w, -w + 1, -1, 0, 1, w - 1, w, w + 1]) { const t = b[ri + o]; if (t < lo) lo = t; if (t > hi) hi = t; }
        if (cv < lo - 24 || cv > hi + 24) { big++; this.heat[(y >> 1) * this.bw + (x >> 1)]++; }
      }
      this.n++;
      return { res: sum / n, big: big / n };
    },
    // the last frame against the one before turned by a (yaw, level camera), the whole frame bar a margin
    rotRes(a, f) {
      const { w, h } = this, [b, c] = this.y.slice(-2), cx = (w - 1) / 2, cy = (h - 1) / 2, ca = Math.cos(a), sa = Math.sin(a);
      let sum = 0, n = 0, big = 0;
      for (let y = 8; y < h - 8; y += 1) for (let x = 8; x < w - 8; x += 1) {
        const vx = x - cx, vz = -f, X = ca * vx - sa * vz, Z = sa * vx + ca * vz;
        const sx = cx + f * X / -Z, sy = cy + f * (y - cy) / -Z;
        if (sx < 2 || sx > w - 3 || sy < 2 || sy > h - 3) continue;
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0, i0 = y0 * w + x0;
        const v = (b[i0] * (1 - fx) + b[i0 + 1] * fx) * (1 - fy) + (b[i0 + w] * (1 - fx) + b[i0 + w + 1] * fx) * fy;
        const cv = c[y * w + x]; sum += Math.abs(cv - v); n++;
        const ri = Math.round(sy) * w + Math.round(sx);
        let lo = 255, hi = 0;
        for (const o of [-w - 1, -w, -w + 1, -1, 0, 1, w - 1, w, w + 1]) { const t = b[ri + o]; if (t < lo) lo = t; if (t > hi) hi = t; }
        if (cv < lo - 6 || cv > hi + 6) { big++; this.heat[(y >> 1) * this.bw + (x >> 1)]++; }
      }
      this.n++;
      return { res: sum / Math.max(n, 1), big: big / Math.max(n, 1) };
    },
    // a pop: the last two frames (the same instant, the camera turned a tenth of a pixel) apart by more than 40
    pop() {
      const { w, h } = this, [b, c] = this.y.slice(-2); let n = 0;
      for (let yy = 0; yy < h; yy++) { const row = yy * w, brow = (yy >> 1) * this.bw; for (let x = 0; x < w; x++) { const d = c[row + x] - b[row + x]; if (d > 40 || d < -40) { n++; this.heat[brow + (x >> 1)]++; } } }
      this.n++;
      return n / (w * h);
    },
    // the heat map over the last frame (dimmed), red = flicker events per block; and the hottest 1:1 crop's corner
    heatImage(scale, cw, ch, hc) {
      const { w, h, bw, bh, heat } = this, Y = this.y[this.y.length - 1];
      const ow = hc ? hc[2] : Math.round(w * scale), oh = hc ? hc[3] : Math.round(h * scale);
      if (hc) scale = 1;
      const X0 = hc ? hc[0] : 0, Y0 = hc ? hc[1] : 0;
      const c = document.createElement('canvas'); c.width = ow; c.height = oh; const g = c.getContext('2d');
      const im = g.createImageData(ow, oh);
      let mx = 0; for (const v of heat) mx = Math.max(mx, v);
      const k = mx > 0 ? 1 / Math.max(1, Math.min(mx, 0.5 * this.n)) : 0;
      for (let oy = 0; oy < oh; oy++) for (let ox = 0; ox < ow; ox++) {
        const x = Math.min(w - 1, X0 + Math.floor(ox / scale)), y = Math.min(h - 1, Y0 + Math.floor(oy / scale));
        const v = Y[(h - 1 - y) * w + x] * 0.55, hv = Math.min(1, heat[((h - 1 - y) >> 1) * bw + (x >> 1)] * k);
        const o = (oy * ow + ox) * 4; im.data[o] = v + (255 - v) * hv; im.data[o + 1] = v * (1 - hv); im.data[o + 2] = v * (1 - hv); im.data[o + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      // the hottest cw × ch window (block sums)
      const bx = Math.ceil(cw / 2), by = Math.ceil(ch / 2); let best = -1, bxy = [0, 0];
      for (let y0 = 0; y0 + by <= bh; y0 += 16) for (let x0 = 0; x0 + bx <= bw; x0 += 16) {
        let s = 0; for (let y = y0; y < y0 + by; y += 4) for (let x = x0; x < x0 + bx; x += 4) s += heat[y * bw + x];
        if (s > best) { best = s; bxy = [x0 * 2, h - (y0 + by) * 2]; }
      }
      const total = heat.reduce((a, b) => a + b, 0);
      return { url: c.toDataURL('image/jpeg', 0.85), crop: bxy, total };
    },
    // the frame as a JPEG: half size, or a 1:1 crop at (x, y) (top-left, CSS-free device px)
    jpeg(scale, crop) {
      const src = gl.canvas, c = (this._c ??= document.createElement('canvas'));
      if (crop) { c.width = crop[2]; c.height = crop[3]; c.getContext('2d').drawImage(src, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]); }
      else { c.width = Math.round(src.width * scale); c.height = Math.round(src.height * scale); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height); }
      return c.toDataURL('image/jpeg', 0.88).split(',')[1];
    },
  };
  return 1;
});

const encode = (frames, file) => new Promise((res) => {
  const p = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '8M', '-qmin', '2', '-qmax', '12', '-pix_fmt', 'yuv420p', file]);
  p.on('close', (c) => res(c));
  p.stderr.on('data', (d) => process.stdout.write(d));
  for (const f of frames) p.stdin.write(Buffer.from(f, 'base64'));
  p.stdin.end();
});

const runPath = async (name, def, label, { keep }) => {
  const n = +(A.frames ?? def.n);
  const dt = def.dt ?? (A.dt !== undefined ? +A.dt : 1e-4);   // (the world frozen while the camera moves, unless asked)
  await page.evaluate(() => window.__meas.begin());
  // two frames at the start to settle (shadow maps, the noise bake, zones)
  const p0 = def.at(0, n);
  for (let k = 0; k < 6; k++) await page.evaluate(({ e, t, fov, dt }) => { window.__setCam(e, t, fov); window.__vt.step(dt); }, { e: p0.eye, t: p0.target, fov, dt: k < 3 ? 1 / 30 : dt });
  const rows = [], full = [], crops = [];
  for (let i = 0; i < n; i++) {
    const p = def.at(i, n);
    const r = await page.evaluate(({ e, t, fov, keep, crop, dt }) => {
      window.__setCam(e, t, fov); window.__vt.step(dt);
      const m = window.__meas.grab();
      if (keep) { m.full = window.__meas.jpeg(0.5); if (crop) m.crop = window.__meas.jpeg(1, crop); }
      return m;
    }, { e: p.eye, t: p.target, fov, keep, crop: keep ? keep.crop : null, dt });
    if (r.full) full.push(r.full); if (r.crop) crops.push(r.crop);
    // (over 2.5 m of the wall each way: no parallax from what stands before or beside it)
    if (def.swing && i > 0) Object.assign(r, await page.evaluate(([a, f]) => window.__meas.rotRes(a, f), [def.swing * (A.sign ? +A.sign : -1), 1 / radPerPx]));
    if (def.zoom && i > 0) Object.assign(r, await page.evaluate(([k, hs]) => window.__meas.zoomRes(k, hs), [def.at(i - 1, n).dist / p.dist, (2.5 / (radPerPx * p.dist))]));
    rows.push({ mean: +(r.mean ?? 0).toFixed(1), res: +(r.res ?? 0).toFixed(3), big: +((r.big ?? 0) * 1e4).toFixed(2), d1: +r.d1.toFixed(3), flick: +(r.flick * 1e4).toFixed(2), jolt: +(r.jolt * 1e4).toFixed(2) });
  }
  const heat = await page.evaluate((hc) => window.__meas.heatImage(0.5, 960, 600, hc), A.heatcrop ? A.heatcrop.split(',').map(Number) : null);
  const sk = n <= 3 ? 1 : 2, sum = (k) => rows.slice(sk).reduce((a, r) => a + r[k], 0) / Math.max(1, rows.length - sk);
  const pk = (k) => Math.max(...rows.slice(sk).map((r) => r[k]));
  return { name, label, n, res: +sum('res').toFixed(3), resPeak: pk('res'), big: +sum('big').toFixed(2), bigPeak: pk('big'), d1: +sum('d1').toFixed(3), flick: +sum('flick').toFixed(2), flickPeak: pk('flick'), jolt: +sum('jolt').toFixed(2), joltPeak: pk('jolt'), rows, heat, full, crops };
};

// pops: at poses along the path, the same instant drawn twice, the second turned by a tenth of a pixel: an
// antialiased surface changes by a few levels, an aliased one (a hard step, a level switch) jumps
const runPops = async (name, def, K = 10) => {
  const n = +(A.frames ?? def.n);
  await page.evaluate(() => window.__meas.begin());
  const per = [];
  for (let k = 0; k < K; k++) {
    const i = Math.round((k * (n - 1)) / (K - 1)), p = def.at(i, n);
    const d = norm(p.target.map((x, j) => x - p.eye[j])), d2 = yawDir(d, 0.1 * radPerPx), t2 = add(p.eye, d2, 10);
    const r = await page.evaluate(({ e, t, t2, fov }) => {
      window.__setCam(e, t, fov); window.__vt.step(1 / 30); window.__vt.step(1e-4); window.__vt.step(1e-4);
      window.__meas.grab();
      window.__setCam(e, t2, fov, true); window.__vt.step(1e-4);
      window.__meas.grab();
      return window.__meas.pop();
    }, { e: p.eye, t: p.target, t2, fov });
    per.push(+(r * 1e4).toFixed(2));
  }
  const heat = await page.evaluate(() => window.__meas.heatImage(0.5, 960, 600));
  return { per, mean: +(per.reduce((a, b) => a + b, 0) / K).toFixed(2), heat };
};

const results = { level, build, preset, res: A.res ?? '1728x1117@2', setup, wall, formT, paths: {} };
for (const name of paths) {
  const def = PATHS[name];
  if (!def) { console.log(`${name}: no target here, skipped`); continue; }
  const file = `${out}/${level}-${preset}-${name}-${tag}`;
  if (A.pops) {
    const r = await runPops(name, def);
    writeFileSync(`${file}-pops.jpg`, Buffer.from(r.heat.url.split(',')[1], 'base64'));
    console.log(`${name.padEnd(8)} pops base     ${String(r.mean).padStart(7)} /1e4 px  [${r.per.join(' ')}]  hottest ${r.heat.crop}`);
    const entry = { pops: { base: r.mean, per: r.per, crop: r.heat.crop }, toggles: {} };
    for (const tg of toggles) {
      const [off, on] = TOG[tg] ?? [tg, ''];
      await page.evaluate(off + '; 1');
      const t = await runPops(name, def);
      if (on) await page.evaluate(on + '; 1');
      writeFileSync(`${file}-pops-no-${tg}.jpg`, Buffer.from(t.heat.url.split(',')[1], 'base64'));
      console.log(`${name.padEnd(8)} pops -${tg.padEnd(10)} ${String(t.mean).padStart(7)}  [${t.per.join(' ')}]`);
      entry.toggles[tg] = t.mean;
    }
    results.paths[name] = entry;
    continue;
  }
  const r = await runPath(name, def, 'base', { keep: null });
  writeFileSync(`${file}-heat.jpg`, Buffer.from(r.heat.url.split(',')[1], 'base64'));
  if (def.zoom || def.swing) console.log(`${name.padEnd(8)} base     residual ${r.res} (peak ${r.resPeak})  over 32: ${r.big} /1e4 (peak ${r.bigPeak})\n  series ${r.rows.map((x) => x.big).join(' ')}`);
  console.log(`${name.padEnd(8)} base     flicker ${String(r.flick).padStart(7)} /1e4 px (peak ${r.flickPeak})  jolt ${String(r.jolt).padStart(7)} (peak ${r.joltPeak})  change ${r.d1}  hottest crop ${r.heat.crop}`);
  const entry = { base: { res: r.res, big: r.big, flick: r.flick, flickPeak: r.flickPeak, jolt: r.jolt, joltPeak: r.joltPeak, d1: r.d1, rows: r.rows, crop: r.heat.crop }, toggles: {} };
  if (save) {
    const crop = A.crop ? A.crop.split(',').map(Number) : [...r.heat.crop, 960, 600];
    const s = await runPath(name, def, 'save', { keep: { crop } });
    await encode(s.full, `${file}.webm`);
    await encode(s.crops, `${file}-crop.webm`);
    writeFileSync(`${file}-first.jpg`, Buffer.from(s.full[0], 'base64'));
    writeFileSync(`${file}-mid.jpg`, Buffer.from(s.full[Math.floor(s.full.length / 2)], 'base64'));
    writeFileSync(`${file}-cropmid.jpg`, Buffer.from(s.crops[Math.floor(s.crops.length / 2)], 'base64'));
    for (const k of String(A.keepframes ?? '').split(',').filter(Boolean)) { writeFileSync(`${file}-f${k}.jpg`, Buffer.from(s.full[+k], 'base64')); writeFileSync(`${file}-crop-f${k}.jpg`, Buffer.from(s.crops[+k], 'base64')); }
    console.log(`  clip ${file}.webm, ${file}-crop.webm (crop ${crop})`);
  }
  for (const tg of (['pan', 'orbitslow'].includes(name) || A.alltoggles ? toggles : [])) {
    const [off, on] = TOG[tg] ?? [tg, ''];
    await page.evaluate(off + '; 1');
    const t = await runPath(name, def, tg, { keep: null });
    if (on) await page.evaluate(on + '; 1');
    writeFileSync(`${file}-heat-no-${tg}.jpg`, Buffer.from(t.heat.url.split(',')[1], 'base64'));
    if (def.zoom || def.swing) console.log(`${name.padEnd(8)} -${tg.padEnd(8)} residual ${t.res} (peak ${t.resPeak})  over 32: ${t.big} (peak ${t.bigPeak})\n  series ${t.rows.map((x) => x.big).join(' ')}`);
    console.log(`${name.padEnd(8)} -${tg.padEnd(8)} flicker ${String(t.flick).padStart(7)} (peak ${t.flickPeak})  jolt ${String(t.jolt).padStart(7)} (peak ${t.joltPeak})  change ${t.d1}`);
    entry.toggles[tg] = { res: t.res, big: t.big, flick: t.flick, flickPeak: t.flickPeak, jolt: t.jolt, joltPeak: t.joltPeak, d1: t.d1 };
  }
  results.paths[name] = entry;
}
writeFileSync(`${out}/${level}-${preset}-${tag}.json`, JSON.stringify(results, null, 1));
if (errs.length) console.log('ERRORS', errs.join(' | '));
await browser.close();
process.exit(0);
