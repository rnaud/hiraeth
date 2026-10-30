import * as THREE from 'three/webgpu';
import { pass, mrt, output, vec4 } from 'three/tsl';
import { snapLightSpace, shadowDirection } from '../shadows.js';
import { surfaceMaterial, surfaceShared } from './surface-tsl.js';
import { inkComposite } from './ink-tsl.js';

// ---------------------------------------------------------------------------
// The WebGPU spike's vertical slice (issue #802, docs/systems/webgpu-spike.md). Web only, behind ?renderer=webgpu
// (WebGPURenderer on WebGPU) or ?renderer=webgpu-gl (the same on its WebGL 2 back end): once the world is built the
// game keeps running as ever (its systems, culling and levels of detail) but its frame is drawn here, by three's
// WebGPURenderer on a canvas of its own, in three passes:
//   1. the sun's near cascade (a depth map, the game's placement and snapping: shadows.js);
//   2. the G-buffer: every mesh in the surface material (makeMaterial) drawn by a stand-in with a TSL copy of it
//      (surface-tsl.js) into two targets, albedo + light and normal + view depth;
//   3. the ink composite (ink-tsl.js): cel shading, the shade's hatching, the ink lines, the sky.
// A stand-in shares its source's geometry, world matrix (the same Matrix4), skeleton or instance matrices, so the game
// moves it; its visibility is the source's (and every parent's) at each frame. Anything not in the surface material
// (flames, water, grass blades, overlays) is not drawn. window.__slice holds the timings the spike's bench reads.
// ---------------------------------------------------------------------------

const RING = 600;

export async function createSlice({ scene, camera, sharedUniforms, U, preset, player, size, forceWebGL = false }) {
  const t0 = performance.now();
  const canvas = document.createElement('canvas');
  canvas.id = 'webgpu-slice';
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:0;display:block';
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL, trackTimestamp: true, powerPreference: 'high-performance' });
  await renderer.init();
  renderer.info.autoReset = false;
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const isWebGPU = !!renderer.backend.isWebGPUBackend;
  const tInit = performance.now() - t0;

  // ---- 1. the near cascade
  const S = surfaceShared(sharedUniforms);
  const sun = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2);
  sun.matrixAutoUpdate = false;
  const shadow = { size: 0, extent: 0, depth: 1600, rt: null, dir: new THREE.Vector3(), ls: new THREE.Vector3(), snapped: new THREE.Vector3() };
  const depthMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, colorWrite: false });
  function configureShadow() {
    const p = preset();
    const want = p.shadow?.near || 2048, extent = p.nearExtent ?? 220;
    if (shadow.size === want && shadow.extent === extent) return;
    shadow.rt?.dispose();
    const dt = new THREE.DepthTexture(want, want);
    dt.compareFunction = THREE.LessEqualCompare;
    dt.minFilter = dt.magFilter = THREE.LinearFilter;
    shadow.rt = new THREE.RenderTarget(want, want, { depthBuffer: true, depthTexture: dt });
    shadow.size = want; shadow.extent = extent;
    S.shadowMap = dt;
    S.shadowSize.value = want;
    const texel = (extent * 2) / want;
    S.shadowBias.value = (1.0 * texel) / shadow.depth;   // (shadows.js NEAR_CASCADE: 1 texel of bias, 1.6 of normal offset)
    S.shadowOffset.value = 1.6 * texel;
    for (const m of mats.values()) if (m) m.needsUpdate = true;
  }
  S.flipY = true;   // (three's TSL reads a render target's texture from the top on both back ends: TextureNode setupUV)
  S.zHalf = !isWebGPU;
  const mats = new Map();   // source material -> its TSL copy (null: not drawn)
  configureShadow();

  function placeShadow(center) {
    shadowDirection(sharedUniforms.uSunDir.value, shadow.dir);
    const dir = shadow.dir;
    sun.position.set(0, 0, 0);
    sun.up.set(0, 1, 0);
    if (Math.abs(dir.y) > 0.99) sun.up.set(0, 0, 1);
    sun.lookAt(-dir.x, -dir.y, -dir.z);
    sun.updateMatrix(); sun.updateMatrixWorld(true);
    const texel = (shadow.extent * 2) / shadow.size, half = shadow.extent;
    shadow.ls.copy(center).applyMatrix4(sun.matrixWorldInverse);
    const s = snapLightSpace(shadow.ls, texel, shadow.depth / 32, shadow.snapped);
    sun.left = s.x - half; sun.right = s.x + half; sun.bottom = s.y - half; sun.top = s.y + half;
    sun.near = -s.z - shadow.depth / 2; sun.far = -s.z + shadow.depth / 2;
    sun.coordinateSystem = renderer.coordinateSystem;
    sun.updateProjectionMatrix();
    S.shadowMatrix.value.multiplyMatrices(sun.projectionMatrix, sun.matrixWorldInverse);
  }

  // ---- 2. the stand-ins
  const proxyScene = new THREE.Scene();
  proxyScene.matrixWorldAutoUpdate = false;
  const entries = [];
  const skipped = { notSurface: 0, multi: 0, batched: 0, other: 0 };
  const materialFor = (src) => {
    if (mats.has(src)) return mats.get(src);
    const m = src?.userData?.surface && src.isShaderMaterial ? surfaceMaterial(src, S) : null;
    mats.set(src, m);
    return m;
  };
  const seen = new WeakSet();
  const adopt = (o) => {
    if (!o.isMesh || seen.has(o)) return;
    seen.add(o);
    if (o.isBatchedMesh) { skipped.batched++; return; }   // (the still meshes' batches: their sources are drawn one by one)
    if (Array.isArray(o.material)) { skipped.multi++; return; }
    const mat = materialFor(o.material);
    if (!mat) { skipped.notSurface++; return; }
    let p;
    if (o.isInstancedMesh) {
      p = new THREE.InstancedMesh(o.geometry, mat, o.instanceMatrix.count);
      p.instanceMatrix = o.instanceMatrix;
      p.count = o.count;
    } else if (o.isSkinnedMesh) {
      p = new THREE.SkinnedMesh(o.geometry, mat);
      p.bindMode = o.bindMode;
      p.bind(o.skeleton, o.bindMatrix);
    } else p = new THREE.Mesh(o.geometry, mat);
    p.matrixAutoUpdate = false;
    p.matrixWorldAutoUpdate = false;
    p.matrixWorld = o.matrixWorld;   // (the same matrix: the game moves it)
    p.frustumCulled = o.frustumCulled;
    p.renderOrder = o.renderOrder;
    p.castShadow = true;
    proxyScene.add(p);
    entries.push({ o, p, src: o.material });
  };
  scene.traverse(adopt);
  // (what the world adds later, the foes of each round: looked for every RESCAN frames, timed apart from the frame's own)
  const RESCAN = 60;

  // every frame: which sources are shown (they and every parent visible), their geometry and material now
  let stamp = 0;
  function sync() {
    stamp++;
    if (stamp % RESCAN === 0) { const t = performance.now(); scene.traverse(adopt); stats.rescanMs += performance.now() - t; }
    const mark = (o) => { o.__sliceSeen = stamp; for (const c of o.children) if (c.visible) mark(c); };
    if (scene.visible) mark(scene);
    for (const e of entries) {
      const { o, p } = e;
      p.visible = o.__sliceSeen === stamp;
      if (!p.visible) continue;
      if (p.geometry !== o.geometry) p.geometry = o.geometry;
      if (e.src !== o.material) { e.src = o.material; const m = Array.isArray(o.material) ? null : materialFor(o.material); if (m) p.material = m; else p.visible = false; }
      if (o.isInstancedMesh) { p.count = o.count; if (p.instanceMatrix !== o.instanceMatrix) p.instanceMatrix = o.instanceMatrix; }
    }
  }

  // ---- 3. the pipeline: the G-buffer pass and the composite
  const scenePass = pass(proxyScene, camera, { type: THREE.HalfFloatType });
  scenePass.setMRT(mrt({ output, normalDepth: vec4(0) }));
  const tA = scenePass.getTextureNode('output'), tN = scenePass.getTextureNode('normalDepth'), tD = scenePass.getTextureNode('depth');
  for (const t of [scenePass.getTexture('output'), scenePass.getTexture('normalDepth')]) { t.minFilter = t.magFilter = THREE.NearestFilter; }
  const pipeline = new THREE.RenderPipeline(renderer, inkComposite({ tA, tN, tD, U, SU: sharedUniforms, camera }));
  pipeline.outputColorTransform = false;

  // ---- timings (window.__slice)
  const stats = {
    backend: isWebGPU ? 'WebGPU' : 'WebGL2', initMs: tInit, compileMs: 0, firstFrameMs: 0, buildMs: 0,
    meshes: entries.length, materials: 0, skipped,
    cpu: [], sync: [], shadow: [], main: [], gpu: [], calls: [], tris: [], frames: 0, rescanMs: 0,
  };
  const push = (a, v) => { a.push(v); if (a.length > RING) a.shift(); };
  stats.materials = [...mats.values()].filter(Boolean).length;
  stats.buildMs = performance.now() - t0 - tInit;

  function setSize() {
    const w = size().w, h = size().h;
    const cur = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (cur.x !== w || cur.y !== h) renderer.setSize(w, h, false);
  }

  let gpuPending = false;
  function render() {
    const tA0 = performance.now();
    setSize();
    configureShadow();
    renderer.info.reset();
    const r0 = stats.rescanMs;
    sync();
    const tS = performance.now(), rescan = stats.rescanMs - r0;   // (the stand-ins' own upkeep, not a renderer's: left out)
    placeShadow(player.pos);
    proxyScene.overrideMaterial = depthMat;
    renderer.setRenderTarget(shadow.rt);
    renderer.clear();
    renderer.render(proxyScene, sun);
    renderer.setRenderTarget(null);
    proxyScene.overrideMaterial = null;
    const tM = performance.now();
    pipeline.render();
    const tE = performance.now();
    push(stats.sync, tS - tA0 - rescan); push(stats.shadow, tM - tS); push(stats.main, tE - tM); push(stats.cpu, tE - tA0 - rescan);
    push(stats.calls, renderer.info.render.drawCalls); push(stats.tris, renderer.info.render.triangles);
    stats.frames++;
    // the GPU's time for the frame's passes (timestamp queries; one resolve in flight at a time)
    if (!gpuPending && renderer.hasFeature?.('timestamp-query') !== false) {
      gpuPending = true;
      renderer.resolveTimestampsAsync('render').then((ms) => { if (Number.isFinite(ms) && ms > 0) push(stats.gpu, ms); }).catch(() => {}).finally(() => { gpuPending = false; });
    }
  }

  // ---- the programs, before the first frame (what a load would wait for)
  sync();
  placeShadow(player.pos);
  const tc = performance.now();
  try { await renderer.compileAsync(proxyScene, camera); } catch (e) { console.warn('slice compile', e); }
  stats.compileMs = performance.now() - tc;
  const tf = performance.now();
  render();
  stats.firstFrameMs = performance.now() - tf;
  const P = renderer._pipelines;   // (three's caches: how many shader stages and pipelines the world made)
  stats.programs = P ? { vertex: P.programs.vertex.size, fragment: P.programs.fragment.size, pipelines: P.caches.size } : null;
  stats.reset = () => { for (const k of ['cpu', 'sync', 'shadow', 'main', 'gpu', 'calls', 'tris']) stats[k].length = 0; };
  window.__slice = stats;
  Object.defineProperty(stats, "renderer", { value: renderer, enumerable: false });   // (dev: the console)
  // (dev: the G-buffer's two targets at a pixel, from the top left: albedo + light, normal + view depth)
  stats.probe = async (x, y) => {
    const rt = scenePass.renderTarget, out = [];
    for (let i = 0; i < 2; i++) out.push([...await renderer.readRenderTargetPixelsAsync(rt, x, y, 1, 1, i)].map((v) => (v.toFixed ? +v.toFixed(3) : v)));
    return out;
  };
  console.info(`webgpu slice: ${stats.backend}, ${entries.length} meshes in ${stats.materials} materials (skipped ${JSON.stringify(skipped)}), init ${tInit.toFixed(0)} ms, build ${stats.buildMs.toFixed(0)} ms, compile ${stats.compileMs.toFixed(0)} ms (${JSON.stringify(stats.programs)}), first frame ${stats.firstFrameMs.toFixed(0)} ms`);
  return { renderer, canvas, render, stats };
}
