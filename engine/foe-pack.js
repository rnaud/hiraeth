// A foe's painted surface (src/foe-surface.js) as the engines carry it: which features it compiles, as bits (FS_* defines,
// FOE_SURFACE_FEATURES' order), and its uniforms packed as vec4 slots, one a uniform in FOE_SURFACE_PARS' order. Unity's
// Surface.shader draws it in its HIRAETH_FIGHT variant (FoeSurface.hlsl, scripts/unity-export/foe-hlsl.mjs: the web's own GLSL
// in HLSL), the slots in the material's _SkinData buffer (the temple skins' own: never both on one material), the bits in
// _FoeBits. engine/unity/port-format.js sends them with the material; engine/mirror.js again when they move (a brute's
// cracks opening as it is hurt, uFsCracksO).
import { FOE_SURFACE_FEATURES, FOE_SURFACE_PARS } from '../src/foe-surface.js';
import { CRYSTAL_GLSL } from '../src/crystal-shader.js';

/** A shader's uniforms (its `uniform <type> <name>;` lines) in order, each its slot. */
export const layoutOf = (glsl) => [...glsl.matchAll(/uniform\s+(float|vec2|vec3|vec4)\s+(\w+)\s*;/g)].map((m, slot) => ({ type: m[1], name: m[2], slot }));
/** Every uniform the foe surface reads, its slot and type (FOE_SURFACE_PARS' order). */
export const FOE_LAYOUT = layoutOf(FOE_SURFACE_PARS);
/** The chimes' crystal's uniforms (src/crystal-shader.js), the same way: Surface.shader HIRAETH_FIGHT's _CrystalOn, CrystalSurface.hlsl. */
export const CRYSTAL_LAYOUT = layoutOf(CRYSTAL_GLSL);

/** The features a material's defines compile, as bits (FOE_SURFACE_FEATURES' order); 0 without FOE_SURFACE. */
export function foeBits(defines) {
  if (!defines?.FOE_SURFACE) return 0;
  let b = 0;
  FOE_SURFACE_FEATURES.forEach((k, i) => { if (defines[`FS_${k.toUpperCase()}`]) b |= 1 << i; });
  return b;
}

// (a uniform's value as up to four numbers: plain (an ink spec's) or three's)
function put(d, o, v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) v = v.value;
  if (typeof v === 'number') { d[o] = v; return; }
  if (Array.isArray(v) || ArrayBuffer.isView(v)) { for (let i = 0; i < 4 && i < v.length; i++) d[o + i] = v[i]; return; }
  if (v && typeof v === 'object') {
    if (v.isColor) { d[o] = v.r; d[o + 1] = v.g; d[o + 2] = v.b; return; }
    if ('x' in v) { d[o] = v.x; d[o + 1] = v.y; if ('z' in v) d[o + 2] = v.z; if ('w' in v) d[o + 3] = v.w; }
  }
}

/** The uniforms (an ink spec's `u`, or a material's three uniforms) packed: 4 × layout's length floats, zeros where absent. */
export function foePack(u, out = null, layout = FOE_LAYOUT) {
  const d = out?.length === layout.length * 4 ? out : new Float32Array(layout.length * 4);
  d.fill(0);
  if (u) for (const e of layout) if (u[e.name] !== undefined) put(d, e.slot * 4, u[e.name]);
  return d;
}
