// The C# port's own formats (unity/Hiraeth: WorldLoader.MakeMaterial, HiraethLook.Load), made from
// the bridge's data, so the bridge draws through the port's materials and look unchanged:
//   portMaterial(spec)  a material as scripts/unity-export/export-world.mjs materialOf writes it
//   portLook(look)      the look as the exporter writes world.json "look", for this one moment
// (the exporter's x mirror included: directions in Unity's frame).

const r5 = (v) => +(+v).toFixed(5);
const col = (c) => (Array.isArray(c) ? c.slice(0, 3).map(r5) : null);
const mx = (v) => (Array.isArray(v) ? [-v[0], v[1], v[2]].map(r5) : null);

/**
 * A material the port has no shader for, by what tells it apart: a shader's own uniforms (sorted), or three's material
 * type (inkSpec's 'other': a Lambert, a Standard, a line). engine/bridge-gaps.js names the known ones.
 */
export function unmappedKey(spec) {
  if (spec.type === 'other') return `three:${spec.three ?? 'material'}`;
  const names = Object.keys(spec.u ?? {}).sort();
  return `shader:${names.length ? names.join(',') : '(none)'}`;
}
/** The materials drawn as a Surface for want of their own port: key → { name, n }; each said once (console.warn). */
export const unmapped = new Map();
function noteUnmapped(spec) {
  const key = unmappedKey(spec);
  const was = unmapped.get(key);
  if (was) { was.n++; return; }
  unmapped.set(key, { name: spec.name ?? '', n: 1 });
  console.warn(`[bridge gap] no port for ${key}${spec.name ? ` ('${spec.name}')` : ''}: drawn as a Surface (engine/bridge-gaps.js)`);
}

/** export-world.mjs materialOf, from an ink spec (engine/ink-spec.js) instead of the material. */
export function portMaterial(spec, id = 0) {
  const u = spec.u ?? {};
  // the dust motes (life.js Motes: points with a size, a colour and a glow) → the port's Hiraeth/Mote, on quads
  if (spec.type === 'shader' && Array.isArray(u.uColor) && typeof u.uSize === 'number' && typeof u.uGlow === 'number') {
    return { id, name: spec.name ?? '', port: 'mote', color: u.uColor.map(r5), ink: (Array.isArray(u.uInk) ? u.uInk : [0.169, 0.129, 0.122]).map(r5), glow: r5(u.uGlow), size: r5(u.uSize), alpha: r5(u.uAlpha ?? 1), side: 2, plain: 1 };
  }
  // the footprints (life.js Footprints: a decal multiplied into the albedo) → the port's Hiraeth/Print
  if (spec.type === 'shader' && typeof u.uDepth === 'number' && spec.transparent && !spec.depthWrite) {
    return { id, name: spec.name ?? '', port: 'print', depth: r5(u.uDepth), side: 2, plain: 1 };
  }
  // the jump's shade (src/jump-shadow.js: a patch multiplied into the G-buffer, its light term taken away) → Hiraeth/JumpShade
  if (spec.type === 'shader' && typeof u.uDark === 'number' && Object.keys(u).length === 1 && spec.transparent && !spec.depthWrite) {
    return { id, name: spec.name ?? '', port: 'jumpshade', dark: r5(u.uDark), side: 2, plain: 1 };
  }
  // the wind's wisps (wind.js WindStreaks: ribbons of ink with an alpha per vertex, tested against the G-buffer) → Hiraeth/Wisp
  if (spec.type === 'shader' && 'uRes' in u && 'uInk' in u && spec.transparent && !('uMode' in u) && !('uColor' in u)) {
    return { id, name: spec.name ?? '', port: 'wisp', side: 2, plain: 1 };
  }
  // a deadly drop's dark (src/pit-void.js: a temple's pit, a world's void; a wash over the finished picture, its box's
  // inside faces, the scene's depth read by hand) → the bridge's Hiraeth/PitVoid: three's world into the box's frame
  // (16, column-major, three's space: the shader mirrors x back), the box, its colours and its look
  if (spec.type === 'shader' && Array.isArray(u.uInv) && u.uInv.length === 16 && Array.isArray(u.uLook) && Array.isArray(u.uRings) && Array.isArray(u.uMin)) {
    return { id, name: spec.name ?? '', port: 'pitvoid', inv: u.uInv.map(r5), min: u.uMin.map(r5), max: u.uMax.map(r5), color: col(u.uColor), ring: col(u.uRing),
      look: u.uLook.slice(0, 3).map(r5), rings: u.uRings.slice(0, 3).map(r5), mid: (u.uMid ?? [0, 0]).map(r5), side: 1, plain: 1 };
  }
  // a way through's light (src/door-light.js, issue #391: a glow filling its opening, its parts in the mesh's colours, a
  // wash over the finished picture tested by hand against the G-buffer's depth) → the bridge's Hiraeth/DoorLight: its
  // colours, and uDoor (how strongly it shows, the eye's distance) live (engine/mirror.js LIVE_VECTORS)
  if (spec.type === 'shader' && Array.isArray(u.uDoor) && u.uDoor.length === 4 && Array.isArray(u.uFar) && Array.isArray(u.uPool) && spec.transparent && spec.depthTest === false) {
    return { id, name: spec.name ?? '', port: 'doorlight', color: col(u.uColor), pool: col(u.uPool), far: col(u.uFar), door: u.uDoor.map(r5), side: 2, plain: 1 };
  }
  // a see-through surface's body (src/veil.js Veils: a wash over the finished picture, tested by hand against the
  // G-buffer's depth) → the bridge's Hiraeth/Veil: its colour, alpha a layer, glow, how near the eye it fades out
  if (spec.type === 'shader' && Array.isArray(u.uWash) && u.uWash.length === 3 && Array.isArray(u.uColor) && spec.transparent && spec.depthTest === false) {
    // (and a light's: added to the picture, not laid over it, three's AdditiveBlending; its rays streaked round it, uRays:
    // strength, clock, how many round, the soft edge: the chest's light, the ways through's, src/boxes/light.js, src/thresholds.js)
    return { id, name: spec.name ?? '', port: 'veil', color: u.uColor.map(r5), alpha: r5(u.uWash[0]), glow: r5(u.uWash[1]), near: r5(u.uWash[2]), side: spec.side ?? 2, plain: 1,
      add: spec.blending === 2 ? 1 : 0, rays: Array.isArray(u.uRays) && u.uRays.length === 4 ? u.uRays.map(r5) : [0, 0, 0, 0.5] };
  }
  // a world as the galactic map draws it (src/ship/approach.js planetMaterial: the holo table's planet aboard, the
  // approach's) → the port's Hiraeth/Planet (HoloTable.cs, ShipTravel.cs): its body, shade and mark, the mark's kind, its
  // spin as it was made (the web turns it slowly), its lines' weight and fineness, the light in its own frame
  if (spec.type === 'shader' && Array.isArray(u.uBody) && Array.isArray(u.uShade) && Array.isArray(u.uMark) && typeof u.uKind === 'number') {
    return { id, name: spec.name ?? '', port: 'planet', body: col(u.uBody), shade: col(u.uShade), mark: col(u.uMark), kind: u.uKind,
      spin: r5(u.uSpin ?? 0), inkK: r5(u.uInkK ?? 1), freq: r5(u.uFreq ?? 1), light: Array.isArray(u.uLight) ? u.uLight.slice(0, 3).map(r5) : [-0.55, 0.5, 0.68], side: 2, plain: 1 };
  }
  // a recording's figure in light (src/ship/hologram.js: the father's message, the parents at home) → the bridge's
  // Hiraeth/HoloFigure: its kind (0 a colour, 1 per vertex, 2 the clothes by region, 3 the eyes, 4 its picture), colours,
  // the face's numbers, and what moves (uHoloA rising, torn, the mouth; uHoloB the span and the bust's cut; uHoloC its
  // feet and scale: engine/mirror.js LIVE_VECTORS); its beam (uConeH) draws nothing on the page (three's additive blend
  // of an alpha of 0), so nothing here either
  if (spec.type === 'shader' && Array.isArray(u.uHoloA) && typeof u.uConeH === 'number') return { id, name: spec.name ?? '', port: 'hidden', side: 2, plain: 1 };
  if (spec.type === 'shader' && Array.isArray(u.uHoloA) && typeof u.uKind === 'number') {
    const v4 = (k, d) => (Array.isArray(u[k]) ? [...u[k], 0, 0, 0, 0].slice(0, 4).map(r5) : d);
    return { id, name: spec.name ?? '', port: 'holo', kind: u.uKind, color: col(u.uColor) ?? [1, 1, 1], color2: col(u.uColor2) ?? [1, 1, 1], color3: col(u.uColor3) ?? [1, 1, 1],
      skin: col(u.uSkin) ?? [0.91, 0.78, 0.66], tint: col(u.uTint) ?? [0.56, 0.95, 0.9], outfit: v4('uOutfit', [0.13, 0.97, 1.47, 0.64]), glove: v4('uGlove', [0, 0, 0, 0]),
      face: v4('uFace', [-1, 0, 0, 0]), eyeC: v4('uEyeC', [0.034, 1.7, 0.066, 0.44]), genFace: v4('uGeneratedFace', [0, 0.023, 0, 0]),
      holoA: v4('uHoloA', [0, 0, 0, 0]), holoB: v4('uHoloB', [0, 1, 0, 0]), holoC: v4('uHoloC', [0, 0, 0, 1]), side: spec.side ?? 0, vertexColors: spec.vertexColors ? 1 : 0, plain: 1 };
  }
  // another of the game's shaders that the port has its own of: the fire's (story/flames.js → Hiraeth/Flame)
  if (spec.type === 'shader' && Array.isArray(u.uPal) && u.uPal.length >= 15) {
    return { id, name: spec.name ?? '', port: 'flame', pal: u.uPal.slice(0, 15).map(r5), seed: typeof u.uSeed === 'number' ? u.uSeed : 0, k: typeof u.uK === 'number' ? u.uK : 1, side: 2, plain: 1 };
  }
  // (past here: makeMaterial's surface (Hiraeth/Surface), or a plain colour. Any other shader or three.js material that gets
  // here has no port of its own and is drawn as a Surface: a gap, recorded and said once, never silent; issue #428,
  // engine/bridge-gaps.js lists the known ones and tests/bridge-gaps.test.js fails on a new one)
  if (spec.type === 'shader' || spec.type === 'other') noteUnmapped(spec);
  const v = (k, d = 0) => (typeof u[k] === 'number' ? u[k] : d);
  const e = {
    id, name: spec.name ?? '',
    color: col(u.uColor), color2: col(u.uColor2 ?? u.uColor), color3: col(u.uColor3 ?? u.uColor),
    mode: v('uMode'), flat: v('uFlat'), strataSize: v('uStrataSize', 4), grid: v('uGrid'), glyphs: v('uGlyphs'),
    biomes: v('uBiomes'), ripples: v('uRipples'), sandInk: v('uSandInk'), ticks: v('uTicks'), glow: v('uGlow'),
    folds: v('uFolds'), scrub: v('uScrub'), pattern: v('uPattern'), figure: v('uFigure'), suit: v('uSuit'),
    palette: [],
    side: spec.side ?? 0,
    sway: v('uSway'),
    strataObject: spec.defines?.STRATA_OBJECT ? 1 : 0,
    vertexColors: spec.vertexColors ? 1 : 0,
    plain: spec.type === 'ink' ? 0 : 1,
  };
  // the web's newer surface marks (materials.js): weathering, pen detail, colour across a wall, plating, the window
  // share, banked sand, the shade (lift, hue, hatch, strata strokes), the spot-black and line steps
  for (const [k, name] of [['weather', 'uWeather'], ['patch', 'uPatch'], ['plates', 'uPlates'], ['windows', 'uWindows'], ['drift', 'uDrift'], ['spotStep', 'uSpotStep'], ['lineStep', 'uLineStep']])
    if (typeof u[name] === 'number') e[k] = r5(u[name]);
  if (Array.isArray(u.uDetail)) e.detail = u.uDetail.map(r5);
  if (spec.albedoLinear) e.toDisplay = 1;
  if (spec.lining) e.lining = [...spec.lining.map(r5), 1];
  // hatching that follows the form (S_FORM: its axis per vertex, src/form.js), a dark cap's veins
  if (spec.defines?.S_FORM) { e.form = 1; e.veins = v('uVeins'); }
  // a merged mesh's material values per vertex (S_VMAT: the City-Shaft's towers); a cliff's dense cracks (uCracks)
  if (spec.defines?.S_VMAT) e.vmat = 1;
  if (v('uCracks') > 0) e.cracks = r5(v('uCracks'));
  // the coral-shirt traveller's drawn face (characters/tripo-face.js: its uniforms live, op 18)
  if (Array.isArray(u.uTfBrowA)) { e.tripoFace = 1; for (const [k, name] of [['tfBrowA', 'uTfBrowA'], ['tfBrowB', 'uTfBrowB'], ['tfEye', 'uTfEye'], ['tfMouth', 'uTfMouth']]) if (Array.isArray(u[name])) e[k] = u[name].map(r5); }
  // a makers' box (MAKERS_BOX: boxes/model.js): its ray and clock, size, the marks' and the ray's colours
  if (spec.defines?.MAKERS_BOX) { e.box = 1; for (const [k, name] of [['boxA', 'uBoxA'], ['boxB', 'uBoxB'], ['boxMark', 'uBoxMark'], ['boxLight', 'uBoxLight']]) if (Array.isArray(u[name])) e[k] = u[name].map(r5); }   // (the coral-shirt traveller: linear colours, turned to display values in the shader)
  if (Array.isArray(u.uShade)) e.shade = u.uShade.map(r5);
  const ps = v('uPaletteSize');
  if (ps > 0 && Array.isArray(u.uPalette)) for (let i = 0; i < ps; i++) e.palette.push(u.uPalette.slice(i * 3, i * 3 + 3).map(r5));
  if (spec.defines?.METAL && Array.isArray(u.uMetal)) { e.metal = u.uMetal.map((x) => +x.toFixed(4)); e.brushAxis = u.uBrushAxis ?? [0, 1, 0]; }
  // a room inside a hull (materials.js ROOM_LIGHT: the ship's rooms): its key (three, object: the port's shader reads the object's normal in three's frame) and strength
  if (spec.defines?.ROOM_LIGHT && Array.isArray(u.uRoomKey)) e.room = u.uRoomKey.map(r5);
  if (spec.defines?.WATER) {
    e.water = {};
    for (const [k, x] of Object.entries(u)) {
      if (!k.startsWith('uWater') && !k.startsWith('uDeep') && !k.startsWith('uShallow') && !k.startsWith('uFoam')) continue;
      e.water[k] = typeof x === 'number' ? r5(x) : Array.isArray(x) ? x.map(r5) : x;
    }
  }
  if (spec.defines?.GRASS) e.grass = 1;
  for (const [k, name] of [['outfit', 'uOutfit'], ['skin', 'uSkin'], ['glove', 'uGlove'], ['trim', 'uTrim'], ['face', 'uFace'], ['mood', 'uMood'], ['mood2', 'uMood2'],
    ['faceKit', 'uFaceKit'], ['faceKit2', 'uFaceKit2'], ['eyeC', 'uEyeC'], ['eyeR', 'uEyeR'], ['eyeLook', 'uEyeLook'], ['creases', 'uCreases'], ['limbs', 'uLimbs'],
    ['glass', 'uGlass'], ['glassCenter', 'uGlassCenter'], ['hero', 'uHero'],
    ['holoKind', 'uKind'], ['holoCut', 'uCut'], ['holoTint', 'uTint'],
    ['fluidA', 'uFluidA'], ['fluidB', 'uFluidB'], ['fluidBox', 'uFluidBox'], ['fluidDome', 'uFluidDome'], ['fluidDomeK', 'uFluidDomeK'], ['fluidTones', 'uFluidTones'], ['dissolve', 'uDissolve'], ['dissolveColor', 'uDissolveColor']]) {
    const x = u[name];
    if (x === undefined || x === null || typeof x === 'object' && !Array.isArray(x)) continue;
    e[k] = typeof x === 'number' ? x : x.map(r5);
  }
  // see-through but for its rim (makeMaterial({ veil }): |n·v| over it discarded in the G-buffer; its body is the wash above)
  if (v('uVeil') > 0) e.veil = r5(v('uVeil'));
  if (spec.defines?.FLUID) e.fluid = 1;
  if (Array.isArray(u.uFluidBase)) e.fluidBase = u.uFluidBase.map(r5);
  if (spec.defines?.DISSOLVE) e.dissolveOn = 1;
  // the Glass Dunes' glass and the sand its light falls on (src/dune-glass-shader.js DUNE_GLASS, DUNE_POOL): Surface.shader's
  // _DuneOn (1 the glass, 2 the sand), the tones and thresholds in _DuneMint, _DuneLime, _DuneSil, _DuneK; the vertices'
  // aGlass go as the form's point (pack.js), which a dune material has no other use for
  if (spec.defines?.DUNE_GLASS) Object.assign(e, { duneOn: 1, duneMint: (u.uDuneMint ?? [0, 0, 0, 0]).map(r5), duneLime: (u.uDuneLime ?? [0, 0, 0, 0]).map(r5), duneSil: (u.uDuneSil ?? [0, 0, 0, 0]).map(r5), duneK: (u.uDuneK ?? [0, 0, 0, 0]).map(r5) });
  else if (spec.defines?.DUNE_POOL) Object.assign(e, { duneOn: 2, duneMint: (u.uPoolMint ?? [0, 0, 0, 0]).map(r5), duneLime: (u.uPoolLime ?? [0, 0, 0, 0]).map(r5), duneK: (u.uPoolK ?? [0, 0, 0, 0]).map(r5) });
  // (issue #264, surfaces B) a billboard painted another way by night (materials.js NIGHT_PAINT: the Signal Market's screens):
  // its aNight in the form's slot (pack.js); a reflection in still water (MIRROR: the Garden's lake), its water's height, lift,
  // reach and shimmer, the lake's ellipse; Lorn's veins under the water (WATER_VEINS: the map sent apart, backend.js
  // materialTexture, its box live); a splat of the fluid (splat-decal.js: aSplat in the form's slot, its clock live, uSplatTime)
  if (spec.defines?.NIGHT_PAINT) e.nightOn = 1;
  if (spec.defines?.MIRROR && Array.isArray(u.uMirror)) Object.assign(e, { mirrorOn: 1, mirror: u.uMirror.map(r5), mirrorLake: (u.uMirrorLake ?? [0, 0, 1e5, 1e5]).map(r5) });
  if (spec.defines?.WATER_VEINS) Object.assign(e, { veinOn: 1, veinBox: (Array.isArray(u.uVeinBox) ? u.uVeinBox : [0, 0, 0, 0]).map(r5) });
  if (spec.defines?.BREATHE && Array.isArray(u.uBreathe)) e.breathe = u.uBreathe.map((x) => Math.min(r5(x), 1e9));   // (the Buried Machine's clock: BridgeRenderer.Breathe, live)
  if (typeof u.uSplatTime === 'number') Object.assign(e, { splatOn: 1, splatClock: [r5(u.uSplatTime), 0, 0, 0] });
  // three's polygon offset, Surface.shader's Offset: the splats lie on the ground itself, pulled in front in depth (issue #459:
  // without it the ground hid them, or not, frame by frame). Only theirs so far: the ground's other decals that have one
  // (sand drifts, salt, the crash's scorch…) would each be a new raster state for the Retroid's prewarmed pipelines
  if (spec.offset && typeof u.uSplatTime === 'number') e.offset = spec.offset.map(r5);
  // a temple skin's pattern (src/temples/skins/skin-shader.js): Surface.shader's HIRAETH_SKIN, its uniforms the material's _SkinData
  if (spec.skin?.body > 0) { e.skinPattern = spec.skin.body; e.skinData = spec.skin.data.map(r5); }
  return e;
}

/**
 * world.json "look" for this moment (HiraethLook.Load: one row of the hour table, the one now),
 * from the bridge's look (engine/game.js lookParams with full: the preset's and shared numbers).
 */
export function portLook(L) {
  const post = { ...L.post, ink: col(L.uInk) };
  const row = {
    h: L.hour, skyTop: col(L.uSkyTop), skyHorizon: col(L.uSkyHorizon), shadowTint: col(L.uShadowTint), lightTint: col(L.uLightTint), sunColor: col(L.uSunColor ?? [1, 1, 1]),
    light: mx(L.uSunDir), sunDisc: mx(L.uSunDisc ?? L.uSunDir), moonDisc: mx(L.uMoonDisc ?? [0, -1, 0]),
    flatten: r5(L.uFlatten ?? 0), night: r5(L.uNight ?? 0), moonVis: r5(L.uMoonVis ?? 0),
  };
  // (no clock in it: HiraethLook keeps Unity's own, and a look that changed every frame was parsed every frame)
  const shared = { ...L.shared }; delete shared.uTime;
  // the weather (main.js: post.js uRain, uRainNear, uStorm): the port's Ambient.cs globals
  const weather = { rain: r5(L.post?.uRain ?? 0), rainNear: r5(L.post?.uRainNear ?? 0), storm: r5(L.post?.uStorm ?? 0) };
  return { hour: L.hour, preset: L.preset, post, shared, weather, hours: [row], planets: L.planets ?? [], envGround: col(L.uEnvGround ?? [0.73, 0.66, 0.55]), cloudShadows: L.shared?.uCloudShadows ?? 1 };
}
