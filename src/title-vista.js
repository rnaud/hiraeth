import * as THREE from 'three';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, sharedUniforms, MODE_STRATA } from './materials.js';
import { createPost, PRESETS } from './post.js';
import { applyTimeOfDay } from './timeofday.js';
import { Cascade, shadowDirection } from './shadows.js';
import { detectHandheld, resolveQuality } from './perf.js';
import { Flock } from './life.js';
import { mulberry32 } from './noise.js';
import { TAU, nB, clean, place, lumpy, table, needle, boulder } from './levels/sky-stones-kit.js';

// ---------------------------------------------------------------------------
// The title screen's backdrop (src/title.js): a live view over a sea of cloud at
// golden hour, drawn by the game's own pipeline (G-buffer materials, the ink and
// hatching pass, the sky with its two moons). Mushroom tables, needle spires and
// floating stones from the Sky Stones (src/levels/sky-stones-kit.js) rise out of
// the cloud, rose mesas close the horizon, a few birds circle, and the camera
// sweeps slowly round the great table and back. No player, no HUD, no story, and nothing
// here reads or writes a save.
//
// Light by design: built in small steps so the menu keeps answering, the sun's
// shadow map is drawn once (nothing in it moves), the resolution is capped (lower
// still on a phone, and on a handheld, which also runs it at 30 fps) and drops if the
// frames come slowly. A missing or software WebGL returns null: the title keeps
// its drawn backdrop. dispose() frees the GPU context before the game makes its own.
// ---------------------------------------------------------------------------

export const CLOUD_Y = 0;   // the top of the cloud deck
// golden hour: the sun low in the west (about 17:10 on the game's clock), one warm palette all day long
// (aqua above, honey along the horizon, blue-violet shade), so the hour only sets the light's angle
const HOUR = 17.15;
const GOLD = ['#8fc7cf', '#f8c996', '#9a8cc4', '#ffdcb0', '#ffecc8'];
const SCRIPT = [[0, ...GOLD], [24, ...GOLD]];
const SUN_AZ = 30 + ((HOUR - 6) / 12) * 180;   // (timeofday.js: the sun's azimuth at that hour, degrees)
// the camera looks across the light: the sun off to one side and a little behind, so the stones
// show their lit faces and throw long shadows over the cloud
const VIEW_AZ = SUN_AZ + 118;
export const DRIFT = { period: 240, swing: 0.62, r: 300 };   // one slow sweep there and back (s), its half-angle (rad), distance (m)
// two pale moons in the sky the camera looks into
const PLANETS = [{ az: VIEW_AZ - 26, el: 25, size: 7, color: '#f3ead8' }, { az: VIEW_AZ - 12, el: 15, size: 2.4, color: '#ecd2bf' }];

/**
 * The camera at time t (s): high over the cloud, a slow sweep round the great table and back
 * (an easy turn at each end), rising and sinking a little, looking down across the land.
 * Pure, and periodic over DRIFT.period.
 */
export function vistaCamera(t, pos = new THREE.Vector3(), target = new THREE.Vector3()) {
  const k = (t / DRIFT.period) * TAU;
  const yaw = THREE.MathUtils.degToRad(VIEW_AZ) + DRIFT.swing * Math.sin(k);
  const vx = Math.sin(yaw), vz = Math.cos(yaw);
  const r = DRIFT.r + 30 * Math.sin(2 * k + 0.5);
  const side = 45 * Math.sin(k + 1.2);   // a little crab sideways, for parallax between the stones
  pos.set(-vx * r + vz * side, CLOUD_Y + 150 + 18 * Math.sin(2 * k + 1.1), -vz * r - vx * side);
  // the look runs a touch ahead of the sweep, past the table and down onto the cloud
  const lead = yaw + 0.16 * Math.cos(k);
  target.set(Math.sin(lead) * 160, CLOUD_Y + 92 + 10 * Math.sin(k), Math.cos(lead) * 160);
  return { pos, target };
}

/**
 * The render size for the title: the Graphics preset's scale, never above 1, and at most
 * maxPixels (fewer on a phone or tablet, fewer still on a handheld). Returns { pr, w, h } (device pixels per CSS pixel, target size).
 */
export function vistaResolution({ width, height, dpr = 1, scale = 1, handheld = false, touch = false, drop = 1 }) {
  const maxPixels = handheld ? 0.5e6 : touch ? 1e6 : 2.1e6;
  let pr = Math.min(dpr, 2) * Math.min(scale, 1) * drop;
  const px = width * height * pr * pr;
  if (px > maxPixels) pr *= Math.sqrt(maxPixels / px);
  pr = Math.max(pr, 0.25);
  return { pr, w: Math.max(1, Math.floor(width * pr)), h: Math.max(1, Math.floor(height * pr)) };
}

// ------------------------------------------------------------------ the land
/**
 * Build the vista into `scene`. detail: 1 full, 0.5 a handheld's (fewer puffs, coarser rock).
 * Yields between pieces (await step()) so the title's menu stays responsive.
 * Returns { meshes, noShadow, movers, flock, triangles, solids ([x, z, radius] of what stands in the cloud) }.
 */
export async function buildVista(scene, { detail = 1, step = async () => {} } = {}) {
  const rng = mulberry32(1987);
  const R = (a, b) => a + rng() * (b - a);
  const low = detail < 1;
  const seg = (n) => Math.max(12, Math.round(n * (low ? 0.6 : 1)));
  const DS = THREE.DoubleSide;
  const M = {
    bone: makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', mode: MODE_STRATA, strataSize: 7, flat: true, side: DS }),
    cap: makeMaterial({ color: '#f5e5d1', color2: '#f3e0cb', color3: '#f6e9d8', mode: MODE_STRATA, strataSize: 5, side: DS }),
    rose: makeMaterial({ color: '#d9a59a', color2: '#c98f86', color3: '#e3b5a8', mode: MODE_STRATA, strataSize: 9, flat: true, side: DS }),
  };
  const vis = new Map(), shadowGeos = [], movers = [], noShadow = [], meshes = [];
  const add = (mat, g) => { if (!vis.has(mat)) vis.set(mat, []); vis.get(mat).push(clean(g)); };
  const addTable = (mat, o) => { const t = table({ colSeg: 16, ...o }); add(mat, t.vis); if (mat === M.cap) shadowGeos.push(clean(t.shadow)); return t; };
  const base = CLOUD_Y - 60;

  // the land is laid out in the camera's frame: f metres ahead of the great table's spot, r to the right
  // (the menu covers the middle of the screen, so the big pieces stand to the left and right of it)
  const yaw = THREE.MathUtils.degToRad(VIEW_AZ), Fx = Math.sin(yaw), Fz = Math.cos(yaw);
  const at = (f, r) => [Fx * f - Fz * r, Fz * f + Fx * r];
  // nothing stands on the camera's sweep (an arc DRIFT.r behind the middle, DRIFT.swing either way)
  const onPath = (x, z, pad) => {
    const d = Math.hypot(x, z), a = Math.atan2(-x, -z) - yaw;
    const da = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    return Math.abs(d - DRIFT.r) < pad + 40 && da < DRIFT.swing + pad / DRIFT.r + 0.15;
  };
  const solids = [];   // [x, z, r] the cloud parts round

  // the great mushroom table, left of the menu, a balanced stack on its rim
  const [gx, gz] = at(40, -170);
  const GREAT = { x: gx, z: gz, R: 50, top: CLOUD_Y + 64, dome: 4 };
  addTable(M.cap, { ...GREAT, base, stalk: 15, capT: 6.5, under: 18, seed: 2.2, rib: 2.4, ribK: 36, seg: seg(150), outline: 0.1, flute: 0.12, fluteK: 13, foot: 1.5, neckR: 1.25, waist: 0.22 });
  solids.push([gx, gz, 50]);
  const stack = (x, y, z, stones, seed) => {
    const r2 = mulberry32(seed * 31 + 1);
    let yy = y, ox = 0, oz = 0;
    for (const [r, sy, egg] of stones) {
      const sx = 1 + r2() * 0.25, sz = 0.85 + r2() * 0.3, ry = r2() * TAU, tilt = (r2() - 0.5) * 0.25;
      yy += r * sy * 0.92;
      add(M.bone, place(boulder(r, sx, sy, sz, egg, seed + yy, !low), x + ox, yy, z + oz, ry, 1, 1, 1, tilt, -tilt));
      yy += r * sy * 0.92;
      ox += (r2() - 0.5) * r * 0.35; oz += (r2() - 0.5) * r * 0.35;
    }
  };
  {
    const [sx, sz] = at(30, -150), [tx, tz] = at(58, -196);
    stack(sx, GREAT.top + 3, sz, [[5.2, 0.62, 0.05], [4.3, 0.74, 0.1], [3.4, 0.8, 0.15], [2.6, 0.9, 0.2], [1.8, 1, 0.25]], 1);
    stack(tx, GREAT.top + 3, tz, [[3.2, 0.6, 0], [2.6, 0.8, 0.1], [1.8, 0.9, 0.2]], 2);
  }
  await step();

  // needle clusters rising straight out of the cloud
  const cluster = (cx, cz, H, Rr, n, seed) => {
    const r2 = mulberry32(Math.floor(seed * 97) + 3), cy = base;
    add(M.bone, needle({ x: cx, y: cy, z: cz, H, R: Rr, seed: seed + 0.1, seg: seg(18), rings: low ? 18 : 28, lean: (r2() - 0.5) * 0.08 }).vis);
    for (let i = 0; i < n; i++) {
      const fused = i < Math.ceil(n / 2), a = r2() * TAU, d = Rr * (fused ? 0.55 + r2() * 0.4 : 1.3 + r2() * 1.5);
      const h = H * (fused ? 0.22 + r2() * 0.4 : 0.15 + Math.pow(r2(), 1.3) * 0.5) + (CLOUD_Y - cy) * 0.6, rr = Rr * (fused ? 0.4 + r2() * 0.25 : 0.3 + r2() * 0.35);
      add(M.bone, needle({ x: cx + Math.cos(a) * d, y: cy - 1, z: cz + Math.sin(a) * d, H: h, R: rr, seed: seed + i * 1.37 + 0.5, seg: seg(14), rings: low ? 14 : 20, lean: (r2() - 0.5) * 0.25 }).vis);
    }
    solids.push([cx, cz, Rr * 2]);
  };
  // the great needles: one close on the right, others framing the far sky
  const NEEDLES = [[10, 230, 290, 19, 7], [260, -330, 300, 20, 7], [620, 70, 330, 22, 6], [420, 420, 260, 17, 6], [900, -560, 340, 24, 6],
    [-140, -420, 230, 15, 5], [1000, 380, 300, 20, 5], [-60, 520, 240, 16, 5]];
  NEEDLES.forEach(([f, r, h, rr, n], i) => { const [x, z] = at(f, r); cluster(x, z, h, rr, n, 1.3 + i * 2.1); });
  await step();

  // mushroom tables of every size standing in the cloud
  const HERO = [[-70, 140, 34, 48], [300, -90, 30, 70], [180, 230, 22, 34], [500, -200, 40, 40], [520, 260, 36, 60]];
  const tables = HERO.map(([f, r, R0, top]) => [...at(f, r), R0, top]);
  for (let i = 0; tables.length < (low ? 22 : 30) && i < 400; i++) {
    const [x, z] = at(R(-200, 1000), R(-800, 800)), r = R(14, 38);
    if (onPath(x, z, r + 30) || [...solids, ...tables].some(([sx, sz, sr]) => Math.hypot(x - sx, z - sz) < sr + r + 25)) continue;
    tables.push([x, z, r, R(18, 70)]);
  }
  tables.forEach(([x, z, r, top], i) => {
    addTable(M.cap, { x, z, R: r, top: CLOUD_Y + top, base, dome: r * 0.07, stalk: r * R(0.28, 0.38), capT: r * R(0.1, 0.15), under: r * R(0.26, 0.36),
      seed: i * 3.7 + 0.4, rib: r * 0.04, ribK: 30, seg: seg(r > 28 ? 112 : 80), flute: 0.1, fluteK: 9 + (i % 5), foot: 1.6, neckR: 1.3, waist: 0.24,
      off: [R(-0.12, 0.12) * r, R(-0.12, 0.12) * r] });
    solids.push([x, z, r]);
  });
  await step();

  // floating stones and little mushroom islands, gently bobbing
  const floater = (x, y, z, r, sy, egg, seed, pebbles = 3, mushroom = false) => {
    const parts = [];
    if (mushroom) parts.push(table({ x: 0, z: 0, R: r, stalk: r * 0.2, top: 0, base: -r * 0.7, capT: r * 0.25, under: r * 0.2, dome: r * 0.18, seed, rib: r * 0.05, ribK: 20, seg: 64, colSeg: 8 }).vis);
    else parts.push(boulder(r, 1, sy, 0.9, egg, seed));
    for (let i = 0; i < pebbles; i++) parts.push(place(boulder(r * (0.08 + 0.06 * (pebbles - i) / pebbles), 1, 1.3, 1, 0.1, seed + i), (i % 2 ? 1 : -1) * r * 0.1, -r * sy - r * (0.6 + i * 0.9), 0));
    const geo = mergeGeometries(parts.map((p) => clean(p)));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.bone);
    m.position.set(x, y, z);
    scene.add(m); meshes.push(m);
    const ph = seed * 1.7;
    movers.push((t) => { m.position.y = y + Math.sin(t * 0.35 + ph) * 1.6; m.rotation.y = Math.sin(t * 0.05 + ph) * 0.3; });
  };
  const FLOAT = [[120, -300, 175, 7, 3.2, 0.1, 1, 3], [60, 120, 170, 5, 2.6, 0.15, 2, 2], [240, -120, 190, 10, 0.45, 0, 5, 1, true],
    [380, 140, 160, 6, 1.6, 0.2, 4, 2], [150, -420, 120, 4.5, 2.4, 0.1, 6, 3], [460, -40, 210, 8, 0.5, 0, 9, 1, true], [-90, 330, 140, 5, 2.8, 0.1, 7, 3]];
  for (const [f, r, y, ...rest] of FLOAT) { const [x, z] = at(f, r); floater(x, CLOUD_Y + y, z, ...rest); }

  // the far rose mesas closing the horizon
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU + R(-0.1, 0.1), d = R(1150, 1650), r = R(80, 170);
    addTable(M.rose, { x: Math.cos(a) * d, z: Math.sin(a) * d, R: r, top: CLOUD_Y + R(30, 120), base, dome: 0.8, stalk: r * 0.82, capT: r * 0.2, under: r * 0.2,
      seed: 50 + i * 1.7, rib: 0.8, ribK: 30, seg: seg(56), flute: 0.1, fluteK: 14, foot: 0.9, neckR: 0.95, waist: 0.04, outline: 0.18 });
  }
  await step();

  // merge per material (the caps welded for a smooth terminator, as in the level)
  for (const [mat, geos] of vis) {
    let g = mergeGeometries(geos);
    if (mat === M.cap) g = mergeVertices(g, 1e-3);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    scene.add(m); meshes.push(m);
    if (mat === M.cap) noShadow.push(m);   // (their slightly shrunken copies cast instead)
  }
  if (shadowGeos.length) {
    const sm = new THREE.Mesh(mergeGeometries(shadowGeos), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    scene.add(sm); meshes.push(sm);
  }
  await step();

  // the sea of cloud: cauliflower clusters of lit puffs over a flat deck
  {
    const PAL = ['#fffbf4', '#f8e4d6', '#d8dbee'];
    const puffGeo = (lod) => {
      const g = new THREE.IcosahedronGeometry(1, lod);
      lumpy(g, 0.08, 1.8, lod);
      g.computeVertexNormals();
      const p = g.attributes.position, c = new Float32Array(p.count * 3), col3 = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const lit = (x * 0.7 + y * 0.69 + z * 0.19) / Math.hypot(x, y, z) + nB(x * 2.2, z * 2.2 + y) * 0.16;
        col3.set(lit > -0.05 ? PAL[0] : lit > -0.3 ? PAL[1] : PAL[2]);
        c[i * 3] = col3.r; c[i * 3 + 1] = col3.g; c[i * 3 + 2] = col3.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      return g;
    };
    const cloudMat = makeMaterial({ color: '#ffffff', vertexColors: true, palette: PAL, glow: 0.5, line: 0.45, lineTint: 1 });   // (a thin line of its own: materials.js LINE)
    const near = [], far = [];
    const want = low ? [1300, 800] : [2800, 1600];
    for (let i = 0; i < 20000 && (near.length < want[0] || far.length < want[1]); i++) {
      // most of them where the camera looks
      const [x, z] = rng() < 0.8 ? at(R(-150, 1500), R(-1300, 1300)) : at(R(-1500, 1500), R(-1500, 1500));
      if (solids.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r * 0.6)) continue;
      const d = Math.hypot(x, z), list = d < 650 ? near : far;
      if (list.length >= (list === near ? want[0] : want[1])) continue;
      const big = rng() < 0.2, s = (big ? R(40, 66) : R(20, 40)) * (list === far ? 1.25 : 1);
      const y0 = CLOUD_Y + R(-8, 3) + (big ? s * 0.15 : 0);
      list.push({ x, y: y0, z, s, sy: R(0.55, 0.75), main: true });
      const lobes = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < lobes; k++) {
        const la = rng() * TAU, rr = s * R(0.6, 1.05), ls = s * R(0.4, 0.7);
        list.push({ x: x + Math.cos(la) * rr, y: y0 - ls * 0.2, z: z + Math.sin(la) * rr, s: ls, sy: R(0.6, 0.8) });
      }
      if (rng() < 0.6) list.push({ x: x + R(-0.2, 0.2) * s, y: y0 + s * 0.4, z: z + R(-0.2, 0.2) * s, s: s * R(0.45, 0.6), sy: 0.75 });
    }
    const dummy = new THREE.Object3D();
    const sets = [[near.filter((p) => p.main), low ? 1 : 2], [near.filter((p) => !p.main), 1], [far, 0]];
    for (const [list, lod] of sets) {
      const im = new THREE.InstancedMesh(puffGeo(lod), cloudMat, list.length);
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.set(p.s, p.s * p.sy, p.s * R(0.8, 1.1));
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.computeBoundingSphere();
      scene.add(im); meshes.push(im); noShadow.push(im);
    }
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200).rotateX(-Math.PI / 2), makeMaterial({ color: '#e6e2ef', glow: 0.5 }));
    deck.position.y = CLOUD_Y - 4;
    scene.add(deck); meshes.push(deck); noShadow.push(deck);
  }

  // a few birds circling the great table
  const flock = new Flock(scene, { count: low ? 4 : 6, color: '#f4efe2', size: 2.2, radius: 240, height: [190, 230], speed: 0.035, seed: 3 });
  for (const m of [flock.bodies, ...flock.wings]) { noShadow.push(m); meshes.push(m); }

  let triangles = 0;
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3;
    triangles += t * (o.isInstancedMesh ? o.count : 1);
  });
  return { meshes, noShadow, movers, flock, triangles, solids };
}

// ------------------------------------------------------------------ the live view
// the shared surface uniforms the vista sets (sun, shadow maps, style): put back as they were on dispose
function snapshot(U) {
  const out = {};
  for (const [k, u] of Object.entries(U)) {
    const v = u.value;
    out[k] = Array.isArray(v) ? v.map((x) => x?.clone?.() ?? x) : v?.isTexture ? v : v?.clone ? v.clone() : v;
  }
  return () => {
    for (const [k, v] of Object.entries(out)) {
      const u = U[k];
      if (Array.isArray(v)) v.forEach((x, i) => { if (x?.copy && u.value[i]?.copy) u.value[i].copy(x); else u.value[i] = x; });
      else if (v?.copy && !v.isTexture && u.value?.copy && !u.value.isTexture) u.value.copy(v);
      else u.value = v;
    }
  };
}

/**
 * Start the vista behind the title. Resolves with a handle ({ canvas, dispose, setQuality, ... })
 * once the first frame is on screen, or null when WebGL is missing, software-only or fails.
 * @param o.parent    element the canvas goes into (first, under the menu)
 * @param o.settings  the title's Settings (its Graphics preset)
 * @param o.native / o.touch  the Android app, a touch screen (the handheld recipe)
 * @param o.still     draw one frame and stop (reduced motion)
 * @param o.signal    an AbortSignal: the player went on before the view was ready (it stops building and frees itself)
 */
export async function startVista({ parent, settings, native = false, touch = false, still = false, signal = null, win = window } = {}) {
  THREE.ColorManagement.enabled = false;   // (as the game: colours are authored as display values)
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
  } catch (e) { console.info('title vista: no WebGL', e?.message ?? e); return null; }
  const gl = renderer.getContext();
  const gpu = (() => {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    try { return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''); } catch { return ''; }
  })();
  if (/SwiftShader|llvmpipe|softpipe/i.test(gpu)) { renderer.dispose(); renderer.forceContextLoss(); return null; }   // a software GPU: the drawn backdrop
  const handheld = detectHandheld({ native, touch, gpu });
  const restore = snapshot(sharedUniforms);
  const canvas = renderer.domElement;
  canvas.className = 'vista';
  canvas.setAttribute('aria-hidden', 'true');
  renderer.autoClear = false;

  let disposed = false, raf = 0, lost = false, torn = false;
  const cancelled = () => disposed || !!signal?.aborted;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 6000);
  const gbuffer = new THREE.WebGLRenderTarget(1, 1, { count: 3, type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  const composeRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const post = createPost();
  const U = post.uniforms;
  U.tAlbedo.value = gbuffer.textures[0]; U.tNormal.value = gbuffer.textures[1]; U.tHatch.value = gbuffer.textures[2];
  const fxaa = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms), vertexShader: FXAAShader.vertexShader, fragmentShader: FXAAShader.fragmentShader, depthTest: false, depthWrite: false });
  fxaa.uniforms.tDiffuse.value = composeRT.texture;
  const blitScene = new THREE.Scene();
  const blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fxaa);
  blitQuad.frustumCulled = false;
  blitScene.add(blitQuad);

  // the style: the Sky Stones' print look, the preset's lighter touches on a handheld
  for (const [k, v] of Object.entries(PRESETS['Moebius print'])) if (U[k]) U[k].value = v;
  U.uCumulus.value = 0;   // (the sea of cloud is the horizon's cloud bank here)
  U.uAlbedoEdges.value = 0.4;   // (fewer lines inside the puffs, where their lit and shaded tones meet)
  let preset = resolveQuality(settings?.quality ?? 'auto', { handheld, hiDPI: (win.devicePixelRatio ?? 1) >= 2 });
  const applyDetail = () => {
    U.uAO.value = preset.ao ? 1 : 0;
    U.uPostLite.value = preset.postLite ? 1 : 0;
    sharedUniforms.uCloudShadows.value = preset.cloudShadows ? 0.6 : 0;
    sharedUniforms.uShadowTaps.value = preset.taps;
  };
  applyDetail();
  // the sky: golden hour, two pale moons
  applyTimeOfDay(HOUR, sharedUniforms.uSunDir.value, U, { tint: [1, 1, 1], fog: 0.75 }, SCRIPT);
  PLANETS.forEach((p, i) => {
    const el = THREE.MathUtils.degToRad(p.el), az = THREE.MathUtils.degToRad(p.az);
    U.uPlanet.value[i].set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az), THREE.MathUtils.degToRad(p.size));
    const c = new THREE.Color(p.color);
    U.uPlanetColor.value[i].set(c.r, c.g, c.b, 0);
    U.uPlanetCraters.value.setComponent(i, 0);
  });

  // the sun's shadow: one wide map over the whole vista, drawn once (the near and fine cascades stay off)
  const SU = sharedUniforms;
  const cascades = [
    new Cascade({ name: 'fine', size: 16, extent: 12, depth: 1600, uniforms: { map: SU.uShadowMap0, matrix: SU.uShadowMatrix0, bias: SU.uShadowBias0, offset: SU.uShadowNormalOffset0 } }),
    new Cascade({ name: 'near', size: 16, extent: 220, depth: 1600, uniforms: { map: SU.uShadowMap, matrix: SU.uShadowMatrix, bias: SU.uShadowBias, offset: SU.uShadowNormalOffset } }),
    new Cascade({ name: 'far', size: handheld ? 1024 : 2048, extent: 760, depth: 3200, bias: 2.2, offset: 2.4, uniforms: { map: SU.uShadowMap2, matrix: SU.uShadowMatrix2, bias: SU.uShadowBias2, offset: SU.uShadowNormalOffset2 } }),
  ];
  const [fine, near, far] = cascades;
  fine.disable(); near.disable();
  SU.uShadowTexel.value.set(fine.texel, near.texel, far.texel);

  const size = { pr: 1, drop: 1, w: 1, h: 1 };
  const resize = () => {
    const w = Math.max(1, parent.clientWidth || win.innerWidth), h = Math.max(1, parent.clientHeight || win.innerHeight);
    const r = vistaResolution({ width: w, height: h, dpr: win.devicePixelRatio ?? 1, scale: preset.scale, handheld: preset.key === 'handheld', touch, drop: size.drop });
    Object.assign(size, r);
    renderer.setPixelRatio(r.pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // a phone held upright sees as much of the land as a wide screen does across
    // and its horizon sits higher, so the stones show above and below the menu rather than behind it
    const tall = w / h < 1;
    camera.fov = tall ? THREE.MathUtils.clamp(50 / (w / h) ** 0.42, 50, 72) : 50;
    if (tall) camera.setViewOffset(w, h, 0, h * 0.13, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    gbuffer.setSize(r.w, r.h);
    composeRT.setSize(r.w, r.h);
    fxaa.uniforms.resolution.value.set(1 / r.w, 1 / r.h);
    U.uRes.value.set(r.w, r.h);
    U.uPixelRatio.value = r.pr;
    SU.uPixelRatio.value = r.pr;
  };

  const ABORT = Symbol('abort');
  const step = () => new Promise((r, j) => setTimeout(() => (cancelled() ? j(ABORT) : r()), 0));
  let world;
  try {
    world = await buildVista(scene, { detail: preset.key === 'handheld' ? 0.5 : 1, step });
  } catch (e) {
    if (e !== ABORT) console.warn('title vista failed to build', e);
    teardown();
    return null;
  }
  if (cancelled()) { teardown(); return null; }
  parent.prepend(canvas);
  resize();
  win.addEventListener('resize', resize);
  const onLost = (e) => { e.preventDefault(); lost = true; cancelAnimationFrame(raf); handle.onLost?.(); };
  canvas.addEventListener('webglcontextlost', onLost);

  const shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
  const drawShadow = () => {
    const dir = shadowDirection(SU.uSunDir.value, new THREE.Vector3());
    for (const c of cascades) { c.aim(dir); c.prime(renderer); }
    fine.disable(); near.disable();
    far.place(new THREE.Vector3(0, CLOUD_Y + 40, 0));
    scene.updateMatrixWorld();
    const hidden = world.noShadow.filter((o) => o.visible);
    for (const o of hidden) o.visible = false;
    scene.overrideMaterial = shadowOverride;
    far.render(renderer, scene);
    scene.overrideMaterial = null;
    for (const o of hidden) o.visible = true;
  };

  const _pos = new THREE.Vector3(), _tgt = new THREE.Vector3();
  let t = 0;
  const CENTRE = new THREE.Vector3(0, CLOUD_Y, 0);
  const render = (dt = 1 / 60) => {
    vistaCamera(t, _pos, _tgt);
    camera.position.copy(_pos);
    camera.lookAt(_tgt);
    for (const m of world.movers) m(t);
    world.flock.update(dt, t, CENTRE, camera.position);
    SU.uTime.value = t; U.uTime.value = t;
    scene.updateMatrixWorld();
    renderer.setRenderTarget(gbuffer);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    U.uInvProj.value.copy(camera.projectionMatrixInverse);
    U.uCamWorld.value.copy(camera.matrixWorld);
    U.uProj11.value = camera.projectionMatrix.elements[5];
    U.uSubject.value.w = -1;
    renderer.setRenderTarget(composeRT);
    renderer.clear();
    renderer.render(post.scene, post.camera);
    renderer.setRenderTarget(null);
    renderer.render(blitScene, post.camera);
  };

  // compile the shaders off the main thread where the driver can (a stuck warm-up is not waited for)
  const warm = async (s, c) => {
    let timer;
    await Promise.race([renderer.compileAsync(s, c).catch(() => {}), new Promise((r) => { timer = setTimeout(r, 2500); })]);
    clearTimeout(timer);
  };
  vistaCamera(0, _pos, _tgt); camera.position.copy(_pos); camera.lookAt(_tgt);
  await warm(scene, camera);
  if (!cancelled()) await warm(post.scene, post.camera);
  if (cancelled()) { teardown(); return null; }
  try {
    drawShadow();
    render();
  } catch (e) {
    console.warn('title vista failed to draw', e);
    teardown();
    return null;
  }

  // the slow drift: 30 fps on a handheld, and a lower resolution if the frames come slowly
  const minGap = preset.key === 'handheld' ? 1000 / 31 : 0;
  let last = performance.now(), slow = 0, fast = 0;
  const frameStats = { frames: 0, ms: 0 };
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const gap = now - last;
    if (gap < minGap) return;
    last = now;
    if (win.document?.hidden) return;
    const dt = Math.min(gap / 1000, 0.1);
    t += dt;
    const t0 = performance.now();
    render(dt);
    frameStats.frames++; frameStats.ms += performance.now() - t0;
    // under ~24 fps for a while: draw fewer pixels (down to 45 %); back up when it is easy again
    if (gap > 42) slow++; else slow = Math.max(0, slow - 1);
    if (gap < 20 && size.drop < 1) fast++; else fast = 0;
    if (slow > 45 && size.drop > 0.45) { size.drop = Math.max(0.45, size.drop * 0.8); slow = 0; resize(); }
    if (fast > 240) { size.drop = Math.min(1, size.drop * 1.15); fast = 0; resize(); }
  };
  if (!still) raf = requestAnimationFrame(loop);

  function teardown() {
    if (torn) return;
    torn = true;
    disposed = true;
    cancelAnimationFrame(raf);
    win.removeEventListener('resize', resize);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const c of cascades) c.rt?.dispose();
    gbuffer.dispose(); composeRT.dispose(); fxaa.dispose(); blitQuad.geometry.dispose();
    post.scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    renderer.dispose();
    if (!lost) renderer.forceContextLoss();
    canvas.remove();
    restore();
  }

  const handle = {
    canvas, renderer, scene, camera, post, world, handheld, frameStats,
    get preset() { return preset.key; },
    get resolution() { return { ...size }; },
    /** The drift's clock (s): read it, or set it to look at another moment of the sweep. */
    get time() { return t; },
    set time(v) { t = v; render(0); },
    onLost: null,
    /** Stop drawing (the last frame stays on screen while the title fades out). */
    stop() { cancelAnimationFrame(raf); raf = 0; },
    /** The Graphics setting changed in the title's settings. */
    setQuality(name) {
      preset = resolveQuality(name, { handheld, hiDPI: (win.devicePixelRatio ?? 1) >= 2 });
      size.drop = 1;
      applyDetail();
      resize();
      if (still) render();
    },
    /** Free the GPU context and put the shared uniforms back (the game makes its own renderer). */
    dispose() { teardown(); },
  };
  return handle;
}
