// The surface census's pure logic (scripts/surface-census/census.mjs, docs/audits/surfaces-v2.30.md, issue #690): what
// a surface-shader material carries, put in one class, and the shares by class. Plain data in, plain data out; the
// page side (page.js) reads a material's options (its cache key, materials.js) and its compiled defines and hands them here.
//
//   classify({ defines, opts, skin, finished, world })   → { cls, why }
//   shares(rows, weightKey)                              → { cls: % } over the counted classes
//
// The classes:
//   treated   a pattern of its own: pen detail, weathering, patches, cracks, plates, glyphs, façades, tiles, leaves,
//             form hatching, folds, scrub, brushed metal, the ground's marks, and every S_* surface since v2.27
//             (paving, interiors, sheet metal, timber, the ground's middle distance, sea walls, pale stone, the buried
//             city, panelled domes, channels, rock tops, crystals)
//   skin      a temple's futuristic skin with the makers' machined finish (skins/machined.js mkFinish): treated
//   skin-bare a temple skin without that finish (the Rose House)
//   grid      a ruled grid of lines (S_GRID), with or without colour bands, and nothing else
//   bands     colour bands only (MODE_STRATA)
//   plain     one flat colour (or vertex colours): the shader's shade and hatching only
//   pending   being treated on another branch (Lorn's crystals, #686)
// and, left out of the shares as v2.27 left them out: terrain (the ground ink, counted on its own), water, glass,
// glow, people, grass, Vael's cloud, the makers' boxes, a temple door's dark and the drawn-only far
// backdrops (void, backdrop: by their meshes' names, census.mjs).

/** The defines that make a material "treated". */
export const TREATMENTS = [
  'S_DETAIL', 'S_WEATHER', 'S_PATCH', 'S_FACADE', 'S_TILES', 'S_LEAVES', 'S_CRACKS', 'S_GLYPHS', 'S_VGLYPH', 'S_PLATES',
  'S_FORM', 'S_FOLDS', 'S_SCRUB', 'METAL_BRUSHED', 'METAL', 'S_TICKS', 'S_SANDINK', 'S_RIPPLES', 'S_BIOMES', 'S_CREASES',
  // (since v2.27: issues #669, #677, #685, #686)
  'S_PAVING', 'S_INTERIOR', 'S_SHEET', 'S_TIMBER', 'S_GROUNDMID', 'S_SEAWALL', 'S_PALESTONE', 'S_BURIED', 'S_DOMES',
  'S_CHANNEL', 'S_ROCKTOP', 'S_CRYSTAL',
];
/** The ones added after the v2.27 census (what a material treated since then carries). */
export const NEW_TREATMENTS = ['S_PAVING', 'S_INTERIOR', 'S_SHEET', 'S_TIMBER', 'S_GROUNDMID', 'S_SEAWALL', 'S_PALESTONE', 'S_BURIED', 'S_DOMES', 'S_CHANNEL', 'S_ROCKTOP', 'S_CRYSTAL'];
/** The classes counted in the shares, in table order. */
export const COUNTED = ['treated', 'skin', 'skin-bare', 'grid', 'bands', 'plain', 'pending'];
/** Left out of the shares (v2.27's exclusions). */
export const LEFT_OUT = ['terrain', 'water', 'glass', 'glow', 'people', 'grass', 'cloud', 'box', 'void', 'backdrop'];
/** What counts as untreated: the classes a reference or code could still reach. */
export const UNTREATED = ['skin-bare', 'grid', 'bands', 'plain'];

// (Lorn's crystals: issue #686 on its own branch; its materials carry these options, or are Lorn's flat glowing shards)
const CRYSTAL_KEYS = ['greatCrystal', 'caveCrystals', 'lornGrove', 'crystalFacets'];
const LORN = new Set(['perdide', 'perdide2']);

/** One material's class: `defines` its compiled defines (object), `opts` its makeMaterial options (or {}). */
export function classify({ defines = {}, opts = {}, skin = false, finished = false, world = '' } = {}) {
  const d = (k) => !!defines[k];
  if (d('S_FIGURE') || d('S_EYE') || d('S_PORTRAIT') || d('CROWD') || d('FACE_PART') || d('FACE_KEYS') || opts.figure || opts.facePart) return { cls: 'people', why: 'a person' };
  if (opts.makersBox) return { cls: 'box', why: "a makers' box" };
  if (d('GRASS') || opts.grass) return { cls: 'grass', why: 'grass' };
  if (d('S_WATERMODE') || d('MIRROR')) return { cls: 'water', why: 'water' };
  if (d('S_GLASS') || d('S_VEIL') || opts.glass) return { cls: 'glass', why: 'glass' };
  if (d('S_CRYSTAL')) return { cls: 'treated', why: 'S_CRYSTAL' };
  if (CRYSTAL_KEYS.some((k) => opts[k]) || (LORN.has(world) && opts.glow > 0 && opts.flat)) return { cls: 'pending', why: 'crystals (#686)' };
  if (opts.glow > 0 || d('FLUID')) return { cls: 'glow', why: 'self-lit' };
  // (Vael's sea of cloud, arzach2.js cloudMat: a cloud, not a surface to texture)
  if (opts.color === '#fffbf4' && opts.lineTint === 1 && opts.shadeFlat === 1) return { cls: 'cloud', why: 'cloud' };
  if (d('S_TERRAIN')) return { cls: 'terrain', why: TREATMENTS.filter(d).join(' ') || 'terrain' };
  if (skin) return finished ? { cls: 'skin', why: 'temple skin, machined' } : { cls: 'skin-bare', why: 'temple skin, no machined finish' };
  const t = TREATMENTS.filter(d);
  if (t.length) return { cls: 'treated', why: t.join(' ') };
  if (d('S_GRID')) return { cls: 'grid', why: d('S_STRATA') ? 'S_GRID + bands' : 'S_GRID' };
  if (d('S_STRATA') || d('S_RIBBON')) return { cls: 'bands', why: 'MODE_STRATA' };
  return { cls: 'plain', why: 'flat colour' };
}

/** Shares (%) of `rows` ({ cls, [weightKey]: n }) by counted class, one decimal. */
export function shares(rows, weightKey = 'area') {
  const by = Object.fromEntries(COUNTED.map((c) => [c, 0]));
  let total = 0;
  for (const r of rows) if (r.cls in by) { by[r.cls] += r[weightKey] ?? 0; total += r[weightKey] ?? 0; }
  return Object.fromEntries(COUNTED.map((c) => [c, total ? Math.round((by[c] / total) * 1000) / 10 : 0]));
}

/** A walk's points: the critical path's samples (weight 1) and the places stood at (dwell), each with a ring. */
export function walkPoints({ samples = [], places = [], dwell = 3, ring = 4, around = 6 } = {}) {
  const out = samples.map((s) => ({ pos: s.pos, w: 1, kind: 'path' }));
  for (const p of places) {
    out.push({ pos: p.pos, w: dwell, kind: p.kind ?? 'place' });
    for (let k = 0; k < around; k++) {
      const a = (k / around) * Math.PI * 2;
      out.push({ pos: [p.pos[0] + Math.cos(a) * ring, p.pos[1], p.pos[2] + Math.sin(a) * ring], w: dwell / around, kind: `${p.kind ?? 'place'}-ring` });
    }
  }
  return out;
}
