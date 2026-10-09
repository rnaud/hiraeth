import * as THREE from 'three';
import { sharedUniforms, markHero, setEnvGround } from './materials.js';
import { createPost, createBloom, PRESETS } from './post.js';
import { createGBuffer, createComposeTarget, createBlit, setSubject } from './pipeline.js';
import { applyTimeOfDay, colourScript } from './timeofday.js';
import { applyEclipse } from './eclipse.js';
import { Cascade, shadowDirection, selfLitSkips } from './shadows.js';
import { detectDeck, detectHandheld, resolveQuality, tileSceneSteps, cullFar } from './perf.js';
import { LodManager, lodView } from './lod.js';
import { Physics, dropBuriedFloraSteps } from './physics.js';
import { Waters } from './water.js';
import { waterShared } from './water-shader.js';
import { buildFloraSteps, FLORA_WORLDS } from './flora.js';
import { buildGrass } from './flora-grass.js';
import { Flock } from './life.js';
import { wallOpenings } from './wall-openings.js';
import { slicer, runStepsAsync } from './load-steps.js';
import { shotCamera } from './title-shots.js';
import { onXbox } from './xbox.js';

// ---------------------------------------------------------------------------
// The title screen's backdrop (src/title.js): one of the worlds, built by the game's own
// level code and drawn by its own pipeline (G-buffer materials, shadows, the ink pass, the
// water's sparkle, the flora), seen from a fixed camera framed like one of the covers in
// references/Title Screen/ (the shot: src/title-shots.js). The traveller stands where the
// cover has him, standing still in a held stance, arms at his sides (TITLE_STANCE), only his
// breath and his coat moving (the game's Player, his body and his flask).
//
// Only what the frame needs: the level, its collision (for the plants and the traveller's
// feet: a static BVH, built in a worker), its water, flora and grass. No people, wildlife,
// foes, ship, story, weather or sound (the title's menu music plays on), and nothing saved:
// title.js runs it with the save slots sandboxed (src/save-slots.js sandbox) and starts the
// game afresh after a choice. The near and wide shadow maps are drawn once (nothing in them
// moves), the traveller's fine one each frame; the resolution is capped (lower on a phone,
// lower again and 30 fps on a handheld) and drops if the frames come slowly. A missing or
// software WebGL returns null: the title keeps its paper. dispose() frees the GPU context.
// ---------------------------------------------------------------------------

/** The worlds a shot may stand in: their modules, loaded on demand (levels/index.js would load them all). */
export const TITLE_LEVELS = {
  desert: () => import('./levels/desert.js').then((m) => ({ build: m.buildDesert, create: m.createDesert })),
  waterfall: () => import('./levels/waterfall.js').then((m) => ({ build: m.buildWaterfall, create: m.createWaterfall })),
  underwater: () => import('./levels/underwater.js').then((m) => ({ build: m.buildUnderwater, create: m.createUnderwater })),
  arzach2: () => import('./levels/arzach2.js').then((m) => ({ build: m.buildArzach2, create: m.createArzach2 })),
  mangrove: () => import('./levels/mangrove.js').then((m) => ({ build: m.buildMangrove, create: m.createMangrove })),
  saltharbour: () => import('./levels/salt-harbour.js').then((m) => ({ build: m.buildSaltHarbour, create: m.createSaltHarbour })),
  moonfoundry: () => import('./levels/moon-foundry.js').then((m) => ({ build: m.buildMoonFoundry, create: m.createMoonFoundry })),
  buried: () => import('./levels/buried.js').then((m) => ({ build: m.buildBuried, create: m.createBuried })),
  spheres: () => import('./levels/spheres.js').then((m) => ({ build: m.buildSpheres, create: m.createSpheres })),
  spacecity: () => import('./levels/space-city.js').then((m) => ({ build: m.buildSpaceCity, create: m.createSpaceCity })),
  glassdunes: () => import('./levels/glass-dunes.js').then((m) => ({ build: m.buildGlassDunes, create: m.createGlassDunes })),
  antennas: () => import('./levels/antennas.js').then((m) => ({ build: m.buildAntennas, create: m.createAntennas })),
  underside: () => import('./levels/underside.js').then((m) => ({ build: m.buildUnderside, create: m.createUnderside })),
  eclipse: () => import('./levels/eclipse.js').then((m) => ({ build: m.buildEclipse, create: m.createEclipse })),
};

/**
 * The render size: the Graphics preset's scale, never above 1, and at most maxPixels (fewer on a
 * phone or tablet, fewer still on a handheld). Returns { pr, w, h } (device pixels per CSS pixel, target size).
 */
export function titleResolution({ width, height, dpr = 1, scale = 1, handheld = false, touch = false, drop = 1 }) {
  const maxPixels = handheld ? 0.5e6 : touch ? 1e6 : 2.1e6;
  let pr = Math.min(dpr, 2) * Math.min(scale, 1) * drop;
  const px = width * height * pr * pr;
  if (px > maxPixels) pr *= Math.sqrt(maxPixels / px);
  pr = Math.max(pr, 0.25);
  return { pr, w: Math.max(1, Math.floor(width * pr)), h: Math.max(1, Math.floor(height * pr)) };
}

/** The title's graphics: the player's preset, but never its supersampling, and the handheld's recipe on one. */
export function titlePreset(name, o) {
  const p = resolveQuality(name, o);
  return { ...p, scale: Math.min(p.scale ?? 1, 1) };
}

// the shared surface uniforms the title sets (sun, shadow maps, style): put back as they were on dispose
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

const V = (a) => new THREE.Vector3(...a);

/**
 * Start the world behind the title. Resolves with a handle ({ canvas, dispose, setQuality, ... })
 * once the first frame is drawn, or null when WebGL is missing, software-only or the world fails.
 * @param o.parent    element the canvas goes into (first, under the menu)
 * @param o.shot      the shot (src/title-shots.js): level, hour, camera, traveller
 * @param o.settings  the title's Settings (its Graphics preset)
 * @param o.native / o.touch  the Android app, a touch screen (the handheld recipe)
 * @param o.still     draw one frame and stop (reduced motion)
 * @param o.signal    an AbortSignal: the player went on before the view was ready (it stops building and frees itself)
 * @param o.onStage   (name) as each part of the build begins (the boot's timings)
 */
export async function startTitleWorld({ parent, shot, settings, native = false, touch = false, still = false, signal = null, win = window, onStage = () => {} } = {}) {
  THREE.ColorManagement.enabled = false;   // (as the game: colours are authored as display values)
  const load = TITLE_LEVELS[shot?.level];
  if (!load) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false });
  } catch (e) { console.info('title world: no WebGL', e?.message ?? e); return null; }
  const gl = renderer.getContext();
  const gpu = (() => {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    try { return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''); } catch { return ''; }
  })();
  if (/SwiftShader|llvmpipe|softpipe/i.test(gpu)) { renderer.dispose(); renderer.forceContextLoss(); return null; }   // a software GPU: the paper
  const handheld = detectHandheld({ native, touch, gpu });
  const onDeck = detectDeck({ app: win.location?.protocol === 'moebius:', gpu }), xbox = onXbox(win);
  const hiDPI = (win.devicePixelRatio ?? 1) >= 2;
  let preset = titlePreset(settings?.quality ?? 'auto', { handheld, deck: onDeck, xbox, hiDPI });
  const restore = snapshot(sharedUniforms);
  const restoreWater = snapshot(waterShared);
  const canvas = renderer.domElement;
  canvas.className = 'vista';
  canvas.setAttribute('aria-hidden', 'true');
  renderer.autoClear = false;

  let disposed = false, raf = 0, lost = false, torn = false;
  const cancelled = () => disposed || !!signal?.aborted;
  const ABORT = Symbol('abort');
  const slice = slicer();
  const step = async () => { await slice(); if (cancelled()) throw ABORT; };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 5000);
  const gbuffer = createGBuffer();
  const composeRT = createComposeTarget();
  const blit = createBlit(composeRT.texture);
  const post = createPost();
  const U = post.uniforms, SU = sharedUniforms;
  U.tAlbedo.value = gbuffer.textures[0]; U.tNormal.value = gbuffer.textures[1]; U.tHatch.value = gbuffer.textures[2];
  const bloom = createBloom(gbuffer);
  U.tBloom.value = bloom.texture; U.tBloom2.value = bloom.wide; U.uBloom.value = 1;

  const cascades = {
    fine: new Cascade({ name: 'fine', size: 1024, extent: 12, depth: 1600, bias: 3.4, offset: 2.6, uniforms: { map: SU.uShadowMap0, matrix: SU.uShadowMatrix0, bias: SU.uShadowBias0, offset: SU.uShadowNormalOffset0 } }),
    near: new Cascade({ name: 'near', size: 2048, extent: 220, depth: 1600, bias: 2.3, offset: 3.2, uniforms: { map: SU.uShadowMap, matrix: SU.uShadowMatrix, bias: SU.uShadowBias, offset: SU.uShadowNormalOffset } }),
    far: new Cascade({ name: 'far', size: 2048, extent: 1150, depth: 3200, bias: 2.2, offset: 2.4, uniforms: { map: SU.uShadowMap2, matrix: SU.uShadowMatrix2, bias: SU.uShadowBias2, offset: SU.uShadowNormalOffset2 } }),
  };
  const configureShadows = () => {
    const S = preset.shadow ?? { fine: 1024, near: 2048, far: 2048 };
    cascades.fine.configure(Math.min(S.fine || 512, 1024));
    if (!S.fine) cascades.fine.disable();
    cascades.near.configure(Math.min(S.near, 2048), preset.nearExtent ?? 220);
    cascades.far.configure(Math.min(S.far, 2048));
    for (const c of Object.values(cascades)) c.prime(renderer);
    SU.uShadowTexel.value.set(cascades.fine.texel, cascades.near.texel, cascades.far.texel);
  };
  configureShadows();

  let level = null, physics = null, waters = null, flora = null, grass = null, lod = null, tiled = null, player = null, tool = null;
  const flocks = [], noShadow = [];
  const teardownAll = () => { teardown(); return null; };
  try {
    onStage('world');
    const meta = await load();
    await step();
    level = meta.build ? await runStepsAsync(meta.build(scene), slice) : meta.create(scene);
    await step();
    wallOpenings.collectScene(scene).flush(SU);
    setEnvGround(level.envGround ?? level.ground?.mesh?.material?.uniforms?.uColor?.value);
    onStage('collision');
    physics = await Physics.create(scene, level.ground?.heightAt ? level.ground : null, slice, level.collision ?? {});
    await step();
    try { if (level.initSteps) await runStepsAsync(level.initSteps(physics), slice); else level.init?.(physics); } catch (e) { if (e === ABORT) throw e; console.warn('title world: level init', e); }
    await step();
    waters = new Waters(scene, { physics, drops: false });
    await runStepsAsync(dropBuriedFloraSteps(scene, physics), slice);
    await step();
    tiled = await runStepsAsync(tileSceneSteps(scene), slice);
    tiled.small.push(...(level.smallProps ?? []));
    await step();
    onStage('flora');
    flora = await runStepsAsync(buildFloraSteps({ scene, level, levelId: shot.level, physics, density: preset.floraDensity ?? 1, keep: shot.traveller ? [{ x: shot.traveller.at[0], z: shot.traveller.at[2], r: 2 }] : [] }), slice);
    if (flora) { tiled.small.push(...flora.small); noShadow.push(...flora.noShadow); }
    await step();
    grass = buildGrass({ scene, level, physics, presetKey: preset.key, water: FLORA_WORLDS[shot.level]?.water });
    if (grass) noShadow.push(...grass.meshes);
    await step();
    for (const f of level.life?.flocks ?? []) { const fl = new Flock(scene, f); flocks.push(fl); noShadow.push(fl.bodies, ...fl.wings); }
    if (shot.traveller) {
      onStage('traveller');
      ({ player, tool } = await makeTraveller({ scene, physics, level, camera, waters, shot, step }));
    }
  } catch (e) {
    if (e !== ABORT) console.warn('title world failed to build', e);
    return teardownAll();
  }
  if (cancelled()) return teardownAll();

  // the look: the world's ink preset and its touches, its sky at the shot's hour
  for (const [k, v] of Object.entries(PRESETS[level.defaults?.preset ?? 'Moebius print'] ?? PRESETS['Moebius print'])) if (U[k]) U[k].value = v;
  for (const [k, v] of Object.entries(level.defaults?.look ?? {})) if (U[k]) U[k].value = v;
  for (const [k, v] of Object.entries(shot.look ?? {})) if (U[k]) U[k].value = v;
  const baseAO = U.uAO.value, baseCloud = level.defaults?.cloudShadows ?? 1;
  const applyDetail = () => {
    const low = !!preset.lowDetail;
    U.uAO.value = preset.ao && !low ? baseAO : 0;
    SU.uCloudShadows.value = preset.cloudShadows && !low ? baseCloud : 0;
    SU.uShadowTaps.value = preset.taps ?? 9;
    U.uPostLite.value = preset.postLite ? 1 : 0;
    SU.uWearLite.value = low || preset.postLite ? 1 : 0;
    waterShared.uWaterLite.value = low || preset.postLite ? 1 : 0;
  };
  applyDetail();
  const focus = new THREE.Vector3();
  const script = level.sky?.script ? colourScript(level.sky.script) : undefined;
  // the sky at the shot's hour, the fog and light of where the traveller stands, the eight nearest lamps
  const applySky = () => {
    focus.set(...(shot.traveller ? shot.traveller.at : shot.camera.target));
    const hour = shot.hour ?? level.defaults?.hour ?? 10;
    const atmo = level.atmo?.(focus.x, focus.z, focus.y) ?? null;
    applyTimeOfDay(hour, SU.uSunDir.value, U, atmo, atmo?.script ?? script);
    const eclipse = level.sky?.eclipse && { ...level.sky.eclipse, ...(shot.sky?.eclipse ?? {}) };
    if (eclipse) applyEclipse(hour, eclipse, U, SU.uSunDir.value);
    if (level.sky?.moon === false) U.uMoonVis.value = 0;
    level.lightAt?.(focus, SU.uSunDir.value);
    const planets = shot.sky?.planets ?? level.sky?.planets ?? [];   // (a shot may hang its cover's planet: a ringed one over the desert)
    for (let i = 0; i < 3; i++) {
      const p = planets[i];
      if (!p) { U.uPlanet.value[i].set(0, -1, 0, 0); continue; }
      const el = THREE.MathUtils.degToRad(p.el), az = THREE.MathUtils.degToRad(p.az);
      U.uPlanet.value[i].set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az), THREE.MathUtils.degToRad(p.size));
      const c = new THREE.Color(p.color);
      U.uPlanetColor.value[i].set(c.r, c.g, c.b, p.ring ?? 0);
      U.uPlanetCraters.value.setComponent(i, p.craters === false ? 0 : 1);
    }
    const L = SU.uLights.value, ranked = (level.lights ?? []).map((l) => [l, (l.x - focus.x) ** 2 + (l.y - focus.y) ** 2 + (l.z - focus.z) ** 2]).sort((a, b) => a[1] - b[1]);
    let n = 0;
    for (const [l] of ranked) { if (n >= 8) break; L[n++].copy(l); }
    SU.uLightCount.value = n;
    for (; n < 8; n++) L[n].set(0, -1e5, 0, 0);
  };
  applySky();
  SU.uWind.value.set(1, 0.4, level.features?.wind ? 1 : 0.55, 0);

  // the camera: the shot's pose for this screen's shape (src/title-shots.js shotCamera)
  const size = { pr: 1, drop: 1, w: 1, h: 1, cssW: 1, cssH: 1 };
  const aim = new THREE.Vector3();
  const frame = () => {
    const c = shotCamera(shot, size.cssW / size.cssH);
    camera.position.set(...c.eye);
    camera.up.set(0, 1, 0);
    camera.lookAt(aim.set(...c.target));
    if (c.roll) camera.rotateZ(THREE.MathUtils.degToRad(c.roll));
    camera.fov = c.fov;
    camera.aspect = size.cssW / size.cssH;
    if (c.shiftY || c.shiftX) camera.setViewOffset(size.cssW, size.cssH, (c.shiftX ?? 0) * size.cssW, (c.shiftY ?? 0) * size.cssH, size.cssW, size.cssH);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    waters?.keepCamera(camera, c.eye[1] < (waters.surfaceAt(c.eye[0], c.eye[2], c.eye[1], 400)?.y ?? -Infinity) ? 'under' : 'over');
    shadowsDirty = true;
  };
  const resize = () => {
    const w = Math.max(1, parent.clientWidth || win.innerWidth), h = Math.max(1, parent.clientHeight || win.innerHeight);
    const r = titleResolution({ width: w, height: h, dpr: win.devicePixelRatio ?? 1, scale: preset.scale, handheld: preset.key === 'handheld', touch, drop: size.drop });
    Object.assign(size, r, { cssW: w, cssH: h });
    renderer.setPixelRatio(r.pr);
    renderer.setSize(w, h, false);
    gbuffer.setSize(r.w, r.h);
    bloom.setSize(r.w, r.h);
    composeRT.setSize(r.w, r.h);
    blit.material.uniforms.resolution.value.set(1 / r.w, 1 / r.h);
    U.uRes.value.set(r.w, r.h);
    U.uPixelRatio.value = r.pr;
    SU.uPixelRatio.value = r.pr;
    SU.uViewH.value = r.h;
    frame();
  };

  // the shadows: the near and wide maps once (nothing in them moves), the traveller's fine one each frame
  const shadowOverride = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
  const shadowDir = new THREE.Vector3();
  let shadowsDirty = true;
  const glow = [];
  scene.traverse((o) => { if (o.isMesh && selfLitSkips(o)) glow.push(o); });
  const hideFor = (list) => { const off = []; for (const o of list) if (o?.visible) { o.visible = false; off.push(o); } return off; };
  const ahead = (d, out) => {
    camera.getWorldDirection(out);
    out.y = Math.max(out.y, -0.3);
    out.normalize().multiplyScalar(d).add(camera.position);
    const g = level.ground?.heightAt?.(out.x, out.z);
    if (Number.isFinite(g)) out.y = g;
    return out;
  };
  const _c = new THREE.Vector3();
  const drawShadows = (all) => {
    shadowDirection(SU.uSunDir.value, shadowDir);
    for (const c of Object.values(cascades)) c.aim(shadowDir);
    scene.overrideMaterial = shadowOverride;
    const off = hideFor([...(level.noShadow ?? []), ...noShadow, ...(player?.gear?.noShadow ?? []), ...glow]);
    if (all) {
      cascades.near.place(ahead(Math.min(cascades.near.extent * 0.6, 140), _c)); cascades.near.render(renderer, scene);
      cascades.far.place(ahead(cascades.far.extent * 0.55, _c)); cascades.far.render(renderer, scene);
    }
    if (player && cascades.fine.enabled) {
      cascades.fine.place(player.pos);
      cascades.fine.render(renderer, scene);
      for (const o of player.character?.shadowCasters ?? []) renderer.render(o, cascades.fine.cam);
    }
    scene.overrideMaterial = null;
    for (const o of off) o.visible = true;
  };

  let t = shot.clock ?? 0;   // (the level's own clock: a shot may start it where a manta or a boat is in frame)
  const _up = new THREE.Vector3(0, 1, 0), noInput = {};
  const update = (dt) => {
    t += dt;
    SU.uTime.value = t; U.uTime.value = t;
    if (player) {
      try {
        player.update(dt, noInput, Math.atan2(camera.position.x - player.pos.x, camera.position.z - player.pos.z));
        tool?.update(dt, noInput, true);
        player.character?.updateHands?.();
      } catch (e) { console.warn('title world: traveller', e); player.update = () => {}; }
    }
    for (const f of flocks) f.update(dt, t, focus, camera.position);
    if (level.update && !level._titleBroken) {
      try { level.update(dt, t, { player: player ?? stubPlayer(focus), rig: { yaw: 0, target: focus.clone() }, camera, passage: { active: false, prepare() {}, go() {}, update() {} }, fade: () => {} }); }
      catch (e) { level._titleBroken = true; console.info('title world: the level\'s own motion is off here', e?.message ?? e); }
    }
    waters?.update(dt, t, { player, sky: U });
  };
  const frameHidden = [];
  const render = () => {
    scene.matrixWorldAutoUpdate = true;
    scene.updateMatrixWorld();
    scene.matrixWorldAutoUpdate = false;
    camera.updateMatrixWorld();
    const pxPerRad = size.h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    frameHidden.length = 0;
    flora?.update(camera, preset.floraFar ?? 1, { pxPerRad, px: preset.lodPx ?? 0 });
    grass?.update(camera);
    cullFar(tiled.small, camera, preset.propFar ?? 520, frameHidden);
    lodView.pxPerRad = pxPerRad; lodView.px = preset.lodPx ?? 0;
    (lod ??= new LodManager(scene, { keep: [player?.object, level.ground?.mesh].filter(Boolean) })).update(camera, pxPerRad, preset.lodPx ?? 0);
    drawShadows(shadowsDirty);
    if (shadowsDirty) { lod.viewPass?.(); shadowsDirty = false; }
    renderer.setRenderTarget(gbuffer);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    bloom.render(renderer);
    U.uInvProj.value.copy(camera.projectionMatrixInverse);
    U.uCamWorld.value.copy(camera.matrixWorld);
    U.uProj11.value = camera.projectionMatrix.elements[5];
    if (player) setSubject(U, camera, player.pos, player.frame?.up ?? _up, false); else U.uSubject.value.w = -1;
    renderer.setRenderTarget(composeRT);
    renderer.clear();
    renderer.render(post.scene, post.camera);
    waters?.renderOver(renderer, camera, { tNormal: gbuffer.textures[1], tAlbedo: gbuffer.textures[0], target: composeRT, toon: U.uToon.value });
    renderer.setRenderTarget(null);
    renderer.render(blit.scene, post.camera);
    for (const o of frameHidden) o.visible = true;
    scene.matrixWorldAutoUpdate = true;
  };

  parent.prepend(canvas);
  // (a cover drawn the other way round: the world as built, seen in a mirror)
  if (shot.mirror) canvas.style.transform = 'scaleX(-1)';
  resize();
  win.addEventListener('resize', resize);
  const onLost = (e) => { e.preventDefault(); lost = true; cancelAnimationFrame(raf); handle.onLost?.(); };
  canvas.addEventListener('webglcontextlost', onLost);

  // compile the shaders off the main thread where the driver can (a stuck warm-up is not waited for)
  onStage('shaders');
  const warm = async (s, c) => {
    let timer;
    await Promise.race([renderer.compileAsync(s, c).catch(() => {}), new Promise((r) => { timer = setTimeout(r, 4000); })]);
    clearTimeout(timer);
  };
  // (the traveller settles into his stance and the water bakes its bed round him before the first frame)
  update(0.5); for (let i = 0; i < 20; i++) update(1 / 30);
  await warm(scene, camera);
  if (!cancelled()) await warm(post.scene, post.camera);
  if (cancelled()) return teardownAll();
  try { render(); } catch (e) { console.warn('title world failed to draw', e); return teardownAll(); }

  // a gentle life: 30 fps on a handheld, and a lower resolution if the frames come slowly
  const minGap = preset.key === 'handheld' ? 1000 / 31 : 0;
  let last = performance.now(), slow = 0, fast = 0;
  const frameStats = { frames: 0, ms: 0 };
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const gap = now - last;
    if (gap < minGap) return;
    last = now;
    if (win.document?.hidden) return;
    const t0 = performance.now();
    update(Math.min(gap / 1000, 0.1));
    render();
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
    try { tool?.dispose?.(); } catch { /* gone */ }
    try { physics?.dispose?.(); } catch { /* gone */ }
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const c of Object.values(cascades)) c.rt?.dispose();
    gbuffer.dispose(); composeRT.dispose(); bloom.dispose?.(); blit.material.dispose();
    post.scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    post.dispose?.();
    renderer.dispose();
    if (!lost) renderer.forceContextLoss();
    canvas.remove();
    restore(); restoreWater();
  }

  const handle = {
    canvas, renderer, scene, camera, post, level, player, shot, frameStats, handheld,
    get preset() { return preset.key; },
    get resolution() { return { ...size }; },
    onLost: null,
    /** Stop drawing (the last frame stays on screen while the title fades out). */
    stop() { cancelAnimationFrame(raf); raf = 0; },
    /** Draw one frame now (a still title after a change). */
    draw() { render(); },
    /** Look from another pose (the authoring tools: scripts/title-shots.mjs). */
    setShot(next) { Object.assign(shot, next); if (next.traveller && player) placeTraveller(player, next.traveller, physics); applySky(); canvas.style.transform = shot.mirror ? 'scaleX(-1)' : ''; frame(); for (let i = 0; i < 10; i++) update(1 / 30); render(); },
    /** The Graphics setting changed in the title's settings. */
    setQuality(name) {
      preset = titlePreset(name, { handheld, deck: onDeck, xbox, hiDPI });
      size.drop = 1;
      applyDetail();
      configureShadows();
      resize();
      if (still) render();
    },
    /** Free the GPU context and put the shared uniforms back (the game makes its own renderer). */
    dispose() { teardown(); },
  };
  return handle;
}

/**
 * The traveller's stance on the title: stern and still, as the covers draw him (upright, his back to
 * us, looking out over the world), not the game's swinging idle. Over the idle clip, held calm (the
 * Player's talking calm: no glances, no captured look-about, the weight shift small), each frame his
 * arms are set straight down at his sides, hands by the thighs, elbows barely bent, the head a touch
 * lowered; only the breath moves them. Rig angles (rad, src/player.js makeChar): an arm's x < 0
 * raises it forward, its z turns it outward by `side` (arms[0] -1, arms[1] +1); an elbow's x < 0 bends it.
 *   out      each arm out from the body (clears the hips and the coat's skirt)
 *   outGlove the right one, in the flask's glove, a little further (its cuff stands off the hip)
 *   back     the arms a hair behind the body's line (hands by the seams, not in front of the thighs)
 *   elbow    the elbows' bend
 *   head     the head's pitch over the clip's (+ down)
 *   breath   the arms' rise with each breath, its rate (rad/s)
 */
export const TITLE_STANCE = { out: 0.11, outGlove: 0.15, back: 0.04, elbow: -0.1, head: 0.05, breath: 0.012, rate: 1.7 };

/** Hold the stance on the rig (after the clip and the standing layer, before the body follows the rig). */
export function holdStance(c, t = 0, S = TITLE_STANCE) {
  const b = Math.sin(t * S.rate);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    c.arms[i].rotation.set(S.back + b * S.breath * 0.5, 0, side * ((i === 0 ? S.outGlove : S.out) + b * S.breath));
    c.elbows[i].rotation.set(S.elbow - b * S.breath * 0.5, 0, 0);
  }
  c.head?.quaternion.multiply(_hq.setFromEuler(_he.set(S.head, 0, 0)));
}
const _hq = new THREE.Quaternion(), _he = new THREE.Euler();

/** A stand-in for the player, for a level's update that looks where he is (no traveller in the shot). */
function stubPlayer(at) {
  return { pos: at.clone(), vel: new THREE.Vector3(), heading: 0, frame: { up: new THREE.Vector3(0, 1, 0) }, object: new THREE.Object3D(), vehicles: [], riding: false, onGround: true };
}

/** Stand him on his spot, facing the shot's way, feet on the ground. */
function placeTraveller(player, { at, heading = 0 }, physics) {
  const p = V(at);
  const g = physics?.groundAt?.(p.x, p.y + 2, p.z);
  if (Number.isFinite(g) && Math.abs(g - p.y) < 3) p.y = g;
  player.respawn(p);
  player.heading = heading;
  player.onGround = true;
  player.lastSafe.copy(p);
  player.object.position.copy(p);
}

/**
 * The traveller as the game draws him: the Player (his body, cape, gear; held in TITLE_STANCE), his generated
 * body (characters/traveller-v1.js), his flask on his back (fluid-tool.js), the game's animation
 * library. Loaded only when the shot has him; the world shows without him if a file is missing.
 */
async function makeTraveller({ scene, physics, level, camera, waters, shot, step }) {
  const base = import.meta.env?.BASE_URL ?? '/';
  const [{ Player }, { Animator, loadAnimationLibrary }, { loadTravellerV1, createTravellerV1 }, { FluidTool }] = await Promise.all([
    import('./player.js'), import('./animator.js'), import('./characters/traveller-v1.js'), import('./fluid-tool.js'),
  ]);
  const [lib, assets] = await Promise.all([
    loadAnimationLibrary().catch((e) => { console.warn('title world: animation library', e); return null; }),
    loadTravellerV1(base).catch((e) => { console.warn('title world: traveller', e); return null; }),
  ]);
  await step();
  const at = shot.traveller;
  const player = new Player(physics, { climb: false, spawn: V(at.at), spawnHeading: at.heading ?? 0, gravityAt: level.gravityAt, water: waters, limit: Infinity });
  if (lib) player.animator = player._animator = new Animator(lib, player.char);
  if (assets) {
    player.character = createTravellerV1(player.char, assets);
    player.humanoid = player.character.humanoid;
  }
  // (the stance: TITLE_STANCE, held calm, the arms set just before the body follows the rig)
  player.talking = true;
  if (player.character) player.character.poseArms = (p) => { holdStance(p.char, p.time); return []; };
  player.attach(scene);
  const hero = markHero(player.char.root);
  markHero(player.cape?.mesh, hero);
  await step();
  let tool = null;
  try {
    // (his flask: owned and full, as in any world past the prologue; nothing listens and nothing is saved)
    const state = { flag: (k) => (k === 'tool.colours' ? 1 : undefined), on: () => () => {}, set() {} };
    const items = { has: (id) => id === 'backpack', on: () => () => {} };
    tool = new FluidTool({ scene, player, physics, camera, level: null, state, items });
  } catch (e) { console.warn('title world: flask', e); }
  placeTraveller(player, at, physics);
  return { player, tool };
}
