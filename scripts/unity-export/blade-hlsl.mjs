// The fluid sword's living blade and the guard's shield for the Unity port's Surface shader (issue #264): src/blade-shader.js
// BLADE_FLUID_GLSL, the very GLSL the web draws, turned into HLSL and written to
// unity/Hiraeth/Assets/Hiraeth/Shaders/BladeSurface.hlsl, which Surface.shader's HIRAETH_FIGHT variant includes: the blade's
// colour (bladeFluidBlade), the shield's (bladeFluidDisc, BLADE_DISC), their meniscus (bladeSkin, discSkin), a hit's ring
// (bladeRing) and the light (bladeLight). The web compiles the blade or the shield; here both are in, chosen by the
// material's _BladeOn (1 the blade, 2 the shield). tests/engine-unity.test.js checks the file is what this makes of the GLSL.
//   node scripts/unity-export/blade-hlsl.mjs          (writes it)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BLADE_FLUID_GLSL, BLADE_DISCARD, BLADE_VERT } from '../../src/blade-shader.js';
import { calls, RESERVED } from './skin-hlsl.mjs';

export const BLADE_HLSL_PATH = fileURLToPath(new URL('../../unity/Hiraeth/Assets/Hiraeth/Shaders/BladeSurface.hlsl', import.meta.url));

/** The GLSL with these defines set: #ifdef, #ifndef, #else, #endif resolved. */
export function preprocess(src, defs) {
  const out = [], stack = [];
  const on = () => stack.every((s) => s);
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*#\s*(ifdef|ifndef|else|endif)\b\s*(\w*)/);
    if (!m) { if (on()) out.push(line); continue; }
    if (m[1] === 'ifdef') stack.push(defs.has(m[2]));
    else if (m[1] === 'ifndef') stack.push(!defs.has(m[2]));
    else if (m[1] === 'else') stack.push(!stack.pop());
    else stack.pop();
  }
  if (stack.length) throw new Error('blade-hlsl: an #if left open');
  return out.join('\n');
}

/** A function's whole text (its signature to its closing brace) by name. */
function fn(src, name) {
  const m = new RegExp(`^[ \\t]*(?:float|vec[234]|void)\\s+${name}\\s*\\(`, 'm').exec(src);
  if (!m) throw new Error(`blade-hlsl: no ${name}`);
  let i = src.indexOf('{', m.index), d = 0;
  for (let k = i; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(m.index, k + 1); }
  throw new Error(`blade-hlsl: ${name} never closes`);
}

const HOST = { vFold: 'bdFold', vBind: 'bdBind', vWorldRel: 'bdWorldRel', gl_FragCoord: 'bdFragCoord', bayer4: 'bdBayer4', uPixelRatio: '_PixelRatio', uFluidBase: '_FluidBase.rgb', uFluidA: '_FluidA', uBladeB: '_BladeB', uBladeC: '_BladeC', uBlade: '_Blade',
  uSunDir: '_SunDir', uNight: '_Night', uToon: '_Toon' };

function hlsl(code) {
  let s = code;
  // (the shield's swirl: a turn of the plane, GLSL's column-major mat2 written out)
  s = s.replace(/mat2\(cos\((\w+)\), sin\(\1\), -sin\(\1\), cos\(\1\)\) \* (\w+)/g, (m, a, v) => `float2(cos(${a}) * ${v}.x - sin(${a}) * ${v}.y, sin(${a}) * ${v}.x + cos(${a}) * ${v}.y)`);
  if (/\bmat[234]\b/.test(s)) throw new Error('blade-hlsl: a matrix the converter does not know');
  for (const t of ['vec2', 'vec3', 'vec4']) s = calls(s, t, (a) => (a.length === 1 ? `((${t})(${a[0]}))` : `${t}(${a.join(', ')})`));
  s = calls(s, 'atan', (a) => (a.length === 2 ? `atan2(${a[0]}, ${a[1]})` : `atan(${a[0]})`));
  s = s.replace(/\bvec([234])\b/g, 'float$1').replace(/\bmix\s*\(/g, 'lerp(').replace(/\bfract\s*\(/g, 'frac(');
  for (const [k, v] of Object.entries(HOST)) s = s.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
  s = s.split('\n').map((l) => { const c = l.indexOf('//'), code = c < 0 ? l : l.slice(0, c); return code.replace(/\b\w+\b/g, (w) => (RESERVED.has(w) ? `${w}_` : w)) + (c < 0 ? '' : l.slice(c)); }).join('\n');
  return s;
}

/** BLADE_FLUID_GLSL (and BLADE_DISCARD, BLADE_VERT: the meniscus's cut, the bow along the swing) in HLSL. */
export function bladeHlsl(glsl = BLADE_FLUID_GLSL, cut = BLADE_DISCARD, vert = BLADE_VERT) {
  const blade = preprocess(glsl, new Set(['BLADE_FLUID'])), disc = preprocess(glsl, new Set(['BLADE_FLUID', 'BLADE_DISC']));
  // (the shared part: the ring, the hash, what the colour leaves the light, the blade's meniscus; then each colour, the light)
  const parts = [
    fn(blade, 'bladeRing'), fn(blade, 'bladeHash'), fn(blade, 'bladeSkin'), fn(disc, 'discSkin'),
    fn(blade, 'bladeFluid').replace(/\bbladeFluid\b/, 'bladeFluidBlade'), fn(disc, 'bladeFluid').replace(/\bbladeFluid\b/, 'bladeFluidDisc'), fn(blade, 'bladeLight'),
    // the meniscus's cut (and the shield's back sheet seen through), where the web discards with the other fluids
    `void bladeCutBlade() {\n${preprocess(cut, new Set(['BLADE_FLUID']))}\n}`, `void bladeCutDisc() {\n${preprocess(cut, new Set(['BLADE_FLUID', 'BLADE_DISC']))}\n}`,
    // the vertices: the blade bowed back along the swing, a wave up its edges, a ring's bulge (three's object space)
    `float3 bladeBendBlade(float3 transformed, float2 aFold) {\n${preprocess(vert, new Set(['BLADE_FLUID']))}\n  return transformed;\n}`,
    `float3 bladeBendDisc(float3 transformed, float2 aFold) {\n${preprocess(vert, new Set(['BLADE_FLUID', 'BLADE_DISC']))}\n  return transformed;\n}`,
  ];
  if (!/float bladeSpark, bladeWave;/.test(blade)) throw new Error('blade-hlsl: bladeSpark, bladeWave moved');
  const s = hlsl(parts.join('\n'));
  if (/\bu[A-Z]\w*|\bv[A-Z]\w*/.test(s.replace(/\/\/.*$/gm, ''))) throw new Error(`blade-hlsl: a uniform or varying left: ${s.replace(/\/\/.*$/gm, '').match(/\bu[A-Z]\w*|\bv[A-Z]\w*/)[0]}`);
  return `// GENERATED by scripts/unity-export/blade-hlsl.mjs from src/blade-shader.js BLADE_FLUID_GLSL: do not edit.
// The fluid sword's living blade and the guard's shield (their currents, ripples, motes, meniscus, a hit's ring, their light)
// for Surface.shader's HIRAETH_FIGHT variant: the web's GLSL in HLSL, three's frame throughout; the blade or the shield by the
// material's _BladeOn (1, 2), its live numbers in _Blade, _BladeB, _BladeC (engine/mirror.js LIVE_VECTORS) and _FluidA.
#ifndef HIRAETH_BLADE_SURFACE_INCLUDED
#define HIRAETH_BLADE_SURFACE_INCLUDED

// (set by Surface.shader before the calls: the web's varyings aFold, the bind (the rest pose), the eye to the point)
static float2 bdFold;
static float3 bdBind, bdWorldRel;
static float bladeSpark, bladeWave;   // (what the colour leaves the light: the glowing bits, the ripples' field)
static float4 bdFragCoord;            // (the pixel: the shield's back sheet's print screen)
// materials.js bayer4: a 4 x 4 ordered dither
float bdBayer4(float2 p) { float2 q = p - 4.0 * floor(p / 4.0); q = floor(q); int i = (int)q.x + (int)q.y * 4; static const int m[16] = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 }; return (m[i] + 0.5) / 16.0; }
${s}
#endif
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(BLADE_HLSL_PATH, bladeHlsl());
  console.log(BLADE_HLSL_PATH);
}
