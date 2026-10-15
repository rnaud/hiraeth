// A skin's surface patterns as data the web and the Unity port both draw from (issue #342, docs/systems/temples.md
// "Futuristic skins", "In Unity"). Each skin declares its pattern once (skinShader): its uniforms (`pars`), its helper
// functions (`glsl`), its bodies (each replaces the surface shader's `vec3 albedo = uColor;`) and how its pen lines and
// glow join the surface's (`ink`, `emit`). spliceSkin() splices a body into makeMaterial's own fragment shader, as each
// skin did by hand before (the web's shader text unchanged, character for character), and marks the material with its
// pattern (userData.skinPattern), so the bridge can send it as data:
//   skinPatternSpec(material) → { body, data }   body: the pattern's number (SKIN_ORDER's place × 8 + the body's, + 1),
//                                                data: its uniforms packed as vec4 slots in pars order (skinLayout)
// scripts/skin-hlsl.mjs turns the same pars, glsl and bodies into the port's HLSL (Shaders/SkinPatterns.hlsl, one
// function a body, one switch over them in Surface.shader's HIRAETH_SKIN variant): one variant for all the skins.

/** The skins in their fixed order: a pattern's number is its skin's place here × 8 + its body's place + 1. */
export const SKIN_ORDER = ['rose-house', 'wardens-well', 'founders-belfry', 'footprint', 'engine-house', 'lamp-house', 'hush-house',
  'aerie', 'clock-house', 'undertower', 'mooring-house', 'casting-house', 'whale-house', 'whale-sea'];
export const BODIES_PER_SKIN = 8;

// the surface shader's lines a skin replaces (materials.js)
const ALBEDO = 'vec3 albedo = uColor;';
const DETAIL = 'float detail = 0.0;';
const EMIT = 'float emit = 0.0;';
const EMIT_LINE = 'float emit = 0.0;   // lit windows at night (facade)';
const LIGHT = 'L = mix(L, 1.0, max(uGlow, emit));';

const REGISTRY = new Map();

/**
 * A skin's pattern, declared once (at its module's load).
 *   pars:    its uniforms, GLSL declarations (`uniform vec4 uSkR[16];` …)
 *   defines: GLSL #defines of its constants (before the shader)
 *   glsl:    its helper functions (before main())
 *   bodies:  { name: GLSL } each replacing `vec3 albedo = uColor;` (declaring albedo, its ink and glow)
 *   ink:     the body's pen lines' name (the surface's detail starts from it)
 *   emit:    its glow's name; emitAt: 'init' (the surface's emit starts from it), 'line' (the same, the facade's whole
 *            line replaced) or 'light' (added to the surface's emit just before the light); null: none
 */
export function skinShader(id, d) {
  const at = SKIN_ORDER.indexOf(id);
  if (at < 0) throw new Error(`skin-shader.js: "${id}" is not in SKIN_ORDER`);
  const names = Object.keys(d.bodies);
  if (names.length > BODIES_PER_SKIN) throw new Error(`skin-shader.js: ${id} has more than ${BODIES_PER_SKIN} bodies`);
  const S = { id, pars: d.pars, defines: d.defines ?? '', glsl: d.glsl, bodies: d.bodies, ink: d.ink, emit: d.emit ?? null, emitAt: d.emitAt ?? 'init', layout: skinLayout(d.pars) };
  S.number = (name) => { const k = names.indexOf(name); if (k < 0) throw new Error(`skin-shader.js: ${id} has no body "${name}"`); return at * BODIES_PER_SKIN + k + 1; };
  REGISTRY.set(id, S);
  return S;
}

/** Every skin's pattern declared so far (scripts/skin-hlsl.mjs imports them all). */
export const skinShaders = () => [...REGISTRY.values()].sort((a, b) => SKIN_ORDER.indexOf(a.id) - SKIN_ORDER.indexOf(b.id));

/**
 * A skin's uniforms laid out in vec4 slots, in pars order: each scalar or vector one slot (its x, xy, xyz or xyzw), an
 * array one slot an element. → [{ name, type, n (null: not an array), slot }], with .slots the total.
 */
export function skinLayout(pars) {
  const out = [];
  let slot = 0;
  for (const m of pars.matchAll(/uniform\s+(float|int|vec2|vec3|vec4)\s+(\w+)\s*(?:\[\s*(\d+)\s*\])?\s*;/g)) {
    const n = m[3] ? +m[3] : null;
    out.push({ name: m[2], type: m[1], n, slot });
    slot += n ?? 1;
  }
  out.slots = slot;
  return out;
}

/** Splice a skin's body into a makeMaterial's fragment shader (the web's look), marking the material with its pattern. */
export function spliceSkin(m, S, body, file = `skins/${S.id}.js`) {
  const fs = m.fragmentShader, at = fs.lastIndexOf('void main()');
  const emitFrom = S.emit === null ? null : S.emitAt === 'light' ? LIGHT : S.emitAt === 'line' ? EMIT_LINE : EMIT;
  if (at < 0 || !fs.includes(ALBEDO) || !fs.includes(DETAIL) || (emitFrom && !fs.includes(emitFrom))) throw new Error(`${file}: the surface shader changed: no albedo, emit or detail line to replace`);
  const B = S.bodies[body];
  if (typeof B !== 'string') throw new Error(`${file}: no body "${body}"`);
  let tail = fs.slice(at).replace(ALBEDO, B);
  if (emitFrom) tail = tail.replace(emitFrom, S.emitAt === 'light' ? `emit = max(emit, ${S.emit}); ${LIGHT}` : `float emit = ${S.emit};`);
  tail = tail.replace(DETAIL, `float detail = ${S.ink};`);
  m.fragmentShader = S.pars + S.defines + fs.slice(0, at) + S.glsl + tail;
  m.userData.skinPattern = { skin: S.id, body };
  return m;
}

/** A uniform's value into vec4 slots (a number, a colour, a vector; an array of them). */
function put(out, at, v, n) {
  const one = (o, x) => {
    if (typeof x === 'number' || typeof x === 'boolean') { out[o] = +x; return; }
    if (!x) return;
    if (x.isColor) { out[o] = x.r; out[o + 1] = x.g; out[o + 2] = x.b; return; }
    if (x.isVector2) { out[o] = x.x; out[o + 1] = x.y; return; }
    if (x.isVector3) { out[o] = x.x; out[o + 1] = x.y; out[o + 2] = x.z; return; }
    if (x.isVector4) { out[o] = x.x; out[o + 1] = x.y; out[o + 2] = x.z; out[o + 3] = x.w; }
  };
  if (n === null) { one(at * 4, v); return; }
  if (Array.isArray(v)) for (let i = 0; i < n && i < v.length; i++) one((at + i) * 4, v[i]);
  else if (ArrayBuffer.isView(v)) {
    // (a flat array of n vec4s, or of n numbers)
    const w = v.length >= n * 4 ? 4 : 1;
    for (let i = 0; i < n; i++) for (let c = 0; c < w; c++) out[(at + i) * 4 + c] = v[i * w + c] ?? 0;
  }
}

/** A material's pattern as the engines see it, or null: its number and its uniforms packed (skinLayout's slots). */
export function skinPatternSpec(m, into = null) {
  const P = m?.userData?.skinPattern;
  const S = P && REGISTRY.get(P.skin);
  if (!S) return null;
  const L = S.layout, data = into && into.length === L.slots * 4 ? into : new Float32Array(L.slots * 4);
  data.fill(0);
  for (const e of L) put(data, e.slot, m.uniforms[e.name]?.value, e.n);
  return { body: S.number(P.body), data };
}
