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
  return { hour: L.hour, preset: L.preset, post, shared: { ...L.shared }, hours: [row], planets: L.planets ?? [], envGround: col(L.uEnvGround ?? [0.73, 0.66, 0.55]), cloudShadows: L.shared?.uCloudShadows ?? 1 };
}
