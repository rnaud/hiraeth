// The temples' futuristic skins for the Unity port's Surface shader (issue #342): each skin's pattern as it declares it
// (src/temples/skins/skin-shader.js skinShader: its uniforms, helpers and bodies, the very GLSL the web draws) turned
// into HLSL, written to unity/Hiraeth/Assets/Hiraeth/Shaders/SkinPatterns.hlsl: one function a body, and
// skinSurface(), one switch over them, that Surface.shader's HIRAETH_SKIN variant calls where the web's body replaces
// `vec3 albedo = uColor;`. A material's uniforms reach it packed as vec4 slots (skinLayout) in _SkinData, a buffer of
// the material's own. tests/engine-unity.test.js checks the file is what this makes of the skins' current GLSL.
//   node scripts/unity-export/skin-hlsl.mjs          (writes it)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { skinShaders, SKIN_ORDER } from '../../src/temples/skins/skin-shader.js';

export const SKIN_HLSL_PATH = fileURLToPath(new URL('../../unity/Hiraeth/Assets/Hiraeth/Shaders/SkinPatterns.hlsl', import.meta.url));
const SKINS_DIR = fileURLToPath(new URL('../../src/temples/skins/', import.meta.url));

/** Import every skin's module (each declares its pattern at load). */
export async function loadSkins() {
  for (const f of readdirSync(SKINS_DIR).sort()) if (f.endsWith('.js') && f !== 'skin-shader.js' && f !== 'index.js') await import(new URL(`../../src/temples/skins/${f}`, import.meta.url));
  return skinShaders();
}

// HLSL's reserved words a GLSL name may be (renamed with a trailing underscore)
export const RESERVED = new Set(['line', 'point', 'triangle', 'lineadj', 'triangleadj', 'sample', 'half', 'vector', 'matrix', 'string', 'texture', 'sampler',
  'pass', 'technique', 'register', 'packoffset', 'snorm', 'unorm', 'shared', 'groupshared', 'static', 'cbuffer', 'tbuffer', 'compile', 'linear',
  'centroid', 'precise', 'nointerpolation', 'noperspective', 'export', 'extern', 'inline', 'interface', 'namespace', 'row_major', 'column_major',
  'globallycoherent', 'dword', 'fixed', 'min16float', 'filter', 'asm', 'auto', 'catch', 'char', 'class', 'const_cast', 'delete', 'dynamic_cast',
  'enum', 'explicit', 'friend', 'goto', 'long', 'mutable', 'new', 'operator', 'private', 'protected', 'public', 'reinterpret_cast', 'short',
  'signed', 'sizeof', 'static_cast', 'template', 'this', 'throw', 'try', 'typename', 'union', 'unsigned', 'using', 'virtual', 'abort', 'errorf',
  'printf']);
// the surface shader's own names a skin reads, as the port has them (Surface.shader, HiraethCommon.hlsl)
const HOST = { uTime: '_MTime', uPixelRatio: '_PixelRatio', uWearLite: '_WearLite', uGlow: '_Glow', cameraPosition: 'toThree(_WorldSpaceCameraPos)', gl_FragCoord: 'skFragCoord', bayer4: 'skBayer4' };

/** The argument list of the call whose '(' is at s[i]: [args (trimmed), the index after its ')']. */
function args(s, i) {
  let d = 0, start = i + 1;
  const out = [];
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '(' || c === '[') d++;
    else if (c === ')' || c === ']') { d--; if (d === 0) { out.push(s.slice(start, k).trim()); return [out, k + 1]; } }
    else if (c === ',' && d === 1) { out.push(s.slice(start, k).trim()); start = k + 1; }
  }
  throw new Error('skin-hlsl: unbalanced brackets');
}
/** Rewrite every call of `name(` by f(args) (inner calls first). */
export function calls(s, name, f) {
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
  let out = '', last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > 0 && /[\w.]/.test(s[m.index - 1])) continue;
    const open = m.index + m[0].length - 1;
    const [a, end] = args(s, open);
    out += s.slice(last, m.index) + f(a.map((x) => calls(x, name, f)));
    last = end; re.lastIndex = end;
  }
  return out + s.slice(last);
}

/** One skin's GLSL (helpers or a body) to HLSL: its names its own (prefixed), its uniforms the material's slots. */
function hlsl(code, S, p, fns, defs) {
  let s = code;
  // a vector made of one number: HLSL's constructors want every component
  for (const t of ['vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4']) s = calls(s, t, (a) => (a.length === 1 ? `((${t})(${a[0]}))` : `${t}(${a.join(', ')})`));
  s = calls(s, 'atan', (a) => (a.length === 2 ? `atan2(${a[0]}, ${a[1]})` : `atan(${a[0]})`));
  s = calls(s, 'mod', (a) => `skMod(${a[0]}, ${a[1]})`);
  s = s.replace(/\bivec([234])\b/g, 'int$1').replace(/\bbvec([234])\b/g, 'bool$1').replace(/\bvec([234])\b/g, 'float$1')
    .replace(/\bmix\s*\(/g, 'lerp(').replace(/\bfract\s*\(/g, 'frac(').replace(/\bdFdx\s*\(/g, 'ddx(').replace(/\bdFdy\s*\(/g, 'ddy(')
    .replace(/\binversesqrt\s*\(/g, 'rsqrt(');
  // a vector compared whole (GLSL's == is one bool, HLSL's one a component)
  const vecs = new Set(S.layout.filter((e) => e.n === null && /^vec/.test(e.type)).map((e) => e.name));
  s = s.replace(/\b(\w+)\s*(==|!=)\s*(\w+)\b/g, (m, a, op, b) => (vecs.has(a) || vecs.has(b) ? (op === '==' ? `all(${a} == ${b})` : `any(${a} != ${b})`) : m));
  // the uniforms: arrays indexed in the buffer, the rest its slots (int ones cast)
  for (const e of S.layout) {
    const at = `_SkinData[${e.slot}]`;
    if (e.n !== null) { s = s.replace(new RegExp(`\\b${e.name}\\s*\\[`, 'g'), `_SkinData[${e.slot} + `); continue; }
    const v = e.type === 'int' ? `((int)${at}.x)` : e.type === 'float' ? `${at}.x` : e.type === 'vec2' ? `${at}.xy` : e.type === 'vec3' ? `${at}.xyz` : at;
    s = s.replace(new RegExp(`\\b${e.name}\\b`, 'g'), `(${v})`);
  }
  // the skin's own functions and constants, prefixed (several skins name theirs alike)
  for (const f of [...fns, ...defs]) s = s.replace(new RegExp(`\\b${f}\\b`, 'g'), `${p}${f}`);
  for (const [k, v] of Object.entries(HOST)) s = s.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
  s = s.replace(/\b\w+\b/g, (w) => (RESERVED.has(w) ? `${w}_` : w));
  // a constant at the top of the helpers: HLSL's are static
  s = s.replace(/^(\s*)const\s+(float|int|float[234]|bool)\b/gm, (m, sp, t) => (sp.length <= 2 ? `${sp}static const ${t}` : m));
  return s;
}

/** The HLSL of every skin (SkinPatterns.hlsl). */
export function skinHlsl(skins = skinShaders()) {
  const parts = [], cases = [];
  for (const S of skins) {
    const p = `s${SKIN_ORDER.indexOf(S.id)}_`;
    const fns = [...S.glsl.matchAll(/^\s*(?:float|int|bool|void|vec[234]|ivec[234])\s+(\w+)\s*\(/gm)].map((m) => m[1]);
    const defs = [...S.defines.matchAll(/#define\s+(\w+)/g)].map((m) => m[1]);
    const defines = S.defines.split('\n').filter((l) => l.trim()).map((l) => hlsl(l, S, p, fns, defs)).join('\n');
    const bodies = Object.entries(S.bodies).map(([name, body]) => {
      const n = S.number(name);
      cases.push(`    case ${n}: ${p}${name}(vWorldPos, vObjPos, vObjNormal, vTextureUV, skFragCoord, n, uColor, albedo, ink, emit); break;`);
      return `void ${p}${name}(float3 vWorldPos, float3 vObjPos, float3 vObjNormal, float2 vTextureUV, float4 skFragCoord, float3 n, float3 uColor, inout float3 albedoOut, inout float inkOut, inout float emitOut)
{
${hlsl(body, S, p, fns, defs)}
  albedoOut = albedo; inkOut = ${S.ink};${S.emit ? ` emitOut = ${S.emit};` : ''}
}`;
    });
    parts.push(`// ------------------------------------------------------------------ ${S.id} (src/temples/skins/${S.id === 'whale-sea' ? 'whale-house' : S.id}.js)
${defines}
${hlsl(S.glsl, S, p, fns, defs)}
${bodies.join('\n')}
${defs.map((d) => `#undef ${p}${d}`).join('\n')}`);
  }
  return `// GENERATED by scripts/unity-export/skin-hlsl.mjs from the temples' skins (src/temples/skins/*.js skinShader): do not edit.
// The futuristic skins' surface patterns (issue #342) for Surface.shader's HIRAETH_SKIN variant: each body the web's own
// GLSL in HLSL, its uniforms the material's _SkinData slots (skin-shader.js skinLayout), three's frame throughout.
#ifndef HIRAETH_SKIN_PATTERNS_INCLUDED
#define HIRAETH_SKIN_PATTERNS_INCLUDED

StructuredBuffer<float4> _SkinData;   // the material's uniforms packed (engine/unity/port-format.js skinData)
float skMod(float x, float y) { return x - y * floor(x / y); }
float2 skMod(float2 x, float y) { return x - y * floor(x / y); }
float3 skMod(float3 x, float y) { return x - y * floor(x / y); }
float2 skMod(float2 x, float2 y) { return x - y * floor(x / y); }
// materials.js bayer4: a 4 x 4 ordered dither
float skBayer4(float2 p) { float2 q = skMod(floor(p), 4.0); int i = (int)q.x + (int)q.y * 4; static const int m[16] = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 }; return (m[i] + 0.5) / 16.0; }

${parts.join('\n\n')}

/** The skin's albedo, pen lines (the surface's detail starts from them) and glow, by its pattern's number (_SkinBody). */
float3 skinSurface(int body, float3 vWorldPos, float3 vObjPos, float3 vObjNormal, float2 vTextureUV, float4 skFragCoord, float3 n, float3 uColor, out float ink, out float emit)
{
  float3 albedo = uColor;
  ink = 0.0; emit = 0.0;
  UNITY_BRANCH switch (body)
  {
${cases.join('\n')}
    default: break;
  }
  return albedo;
}
#endif
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await loadSkins();
  writeFileSync(SKIN_HLSL_PATH, skinHlsl());
  console.log(SKIN_HLSL_PATH);
}
