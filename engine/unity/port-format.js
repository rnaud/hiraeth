// The C# port's own formats (unity/Memento: WorldLoader.MakeMaterial, MementoLook.Load), made from
// the bridge's data, so the bridge draws through the port's materials and look unchanged:
//   portMaterial(spec)  a material as scripts/unity-export/export-world.mjs materialOf writes it
//   portLook(look)      the look as the exporter writes world.json "look", for this one moment
// (the exporter's x mirror included: directions in Unity's frame).

const r5 = (v) => +(+v).toFixed(5);
const col = (c) => (Array.isArray(c) ? c.slice(0, 3).map(r5) : null);
const mx = (v) => (Array.isArray(v) ? [-v[0], v[1], v[2]].map(r5) : null);

/** export-world.mjs materialOf, from an ink spec (engine/ink-spec.js) instead of the material. */
export function portMaterial(spec, id = 0) {
  const u = spec.u ?? {};
  // the dust motes (life.js Motes: points with a size, a colour and a glow) → the port's Memento/Mote, on quads
  if (spec.type === 'shader' && Array.isArray(u.uColor) && typeof u.uSize === 'number' && typeof u.uGlow === 'number') {
    return { id, name: spec.name ?? '', port: 'mote', color: u.uColor.map(r5), ink: (Array.isArray(u.uInk) ? u.uInk : [0.169, 0.129, 0.122]).map(r5), glow: r5(u.uGlow), size: r5(u.uSize), side: 2, plain: 1 };
  }
  // the footprints (life.js Footprints: a decal multiplied into the albedo) → the port's Memento/Print
  if (spec.type === 'shader' && typeof u.uDepth === 'number' && spec.transparent && !spec.depthWrite) {
    return { id, name: spec.name ?? '', port: 'print', depth: r5(u.uDepth), side: 2, plain: 1 };
  }
  // the wind's wisps (wind.js WindStreaks: ribbons of ink with an alpha per vertex, tested against the G-buffer) → Memento/Wisp
  if (spec.type === 'shader' && 'uRes' in u && 'uInk' in u && spec.transparent && !('uMode' in u) && !('uColor' in u)) {
    return { id, name: spec.name ?? '', port: 'wisp', side: 2, plain: 1 };
  }
  // another of the game's shaders that the port has its own of: the fire's (story/flames.js → Memento/Flame)
  if (spec.type === 'shader' && Array.isArray(u.uPal) && u.uPal.length >= 15) {
    return { id, name: spec.name ?? '', port: 'flame', pal: u.uPal.slice(0, 15).map(r5), seed: typeof u.uSeed === 'number' ? u.uSeed : 0, k: typeof u.uK === 'number' ? u.uK : 1, side: 2, plain: 1 };
  }
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
  // the coral-shirt traveller's drawn face (characters/tripo-face.js: its uniforms live, op 18)
  if (Array.isArray(u.uTfBrowA)) { e.tripoFace = 1; for (const [k, name] of [['tfBrowA', 'uTfBrowA'], ['tfBrowB', 'uTfBrowB'], ['tfEye', 'uTfEye'], ['tfMouth', 'uTfMouth']]) if (Array.isArray(u[name])) e[k] = u[name].map(r5); }
  // a makers' box (MAKERS_BOX: boxes/model.js): its ray and clock, size, the marks' and the ray's colours
  if (spec.defines?.MAKERS_BOX) { e.box = 1; for (const [k, name] of [['boxA', 'uBoxA'], ['boxB', 'uBoxB'], ['boxMark', 'uBoxMark'], ['boxLight', 'uBoxLight']]) if (Array.isArray(u[name])) e[k] = u[name].map(r5); }   // (the coral-shirt traveller: linear colours, turned to display values in the shader)
  if (Array.isArray(u.uShade)) e.shade = u.uShade.map(r5);
  const ps = v('uPaletteSize');
  if (ps > 0 && Array.isArray(u.uPalette)) for (let i = 0; i < ps; i++) e.palette.push(u.uPalette.slice(i * 3, i * 3 + 3).map(r5));
  if (spec.defines?.METAL && Array.isArray(u.uMetal)) { e.metal = u.uMetal.map((x) => +x.toFixed(4)); e.brushAxis = u.uBrushAxis ?? [0, 1, 0]; }
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
    ['fluidA', 'uFluidA'], ['fluidB', 'uFluidB'], ['fluidBox', 'uFluidBox'], ['fluidTones', 'uFluidTones'], ['dissolve', 'uDissolve'], ['dissolveColor', 'uDissolveColor']]) {
    const x = u[name];
    if (x === undefined || x === null || typeof x === 'object' && !Array.isArray(x)) continue;
    e[k] = typeof x === 'number' ? x : x.map(r5);
  }
  if (spec.defines?.FLUID) e.fluid = 1;
  if (Array.isArray(u.uFluidBase)) e.fluidBase = u.uFluidBase.map(r5);
  if (spec.defines?.DISSOLVE) e.dissolveOn = 1;
  return e;
}

/**
 * world.json "look" for this moment (MementoLook.Load: one row of the hour table, the one now),
 * from the bridge's look (engine/game.js lookParams with full: the preset's and shared numbers).
 */
export function portLook(L) {
  const post = { ...L.post, ink: col(L.uInk) };
  const row = {
    h: L.hour, skyTop: col(L.uSkyTop), skyHorizon: col(L.uSkyHorizon), shadowTint: col(L.uShadowTint), lightTint: col(L.uLightTint), sunColor: col(L.uSunColor ?? [1, 1, 1]),
    light: mx(L.uSunDir), sunDisc: mx(L.uSunDisc ?? L.uSunDir), moonDisc: mx(L.uMoonDisc ?? [0, -1, 0]),
    flatten: r5(L.uFlatten ?? 0), night: r5(L.uNight ?? 0), moonVis: r5(L.uMoonVis ?? 0),
  };
  // (no clock in it: MementoLook keeps Unity's own, and a look that changed every frame was parsed every frame)
  const shared = { ...L.shared }; delete shared.uTime;
  // the weather (main.js: post.js uRain, uRainNear, uStorm): the port's Ambient.cs globals
  const weather = { rain: r5(L.post?.uRain ?? 0), rainNear: r5(L.post?.uRainNear ?? 0), storm: r5(L.post?.uStorm ?? 0) };
  return { hour: L.hour, preset: L.preset, post, shared, weather, hours: [row], planets: L.planets ?? [], envGround: col(L.uEnvGround ?? [0.73, 0.66, 0.55]), cloudShadows: L.shared?.uCloudShadows ?? 1 };
}
