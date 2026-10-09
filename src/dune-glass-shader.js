import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The Glass Dunes' glass drawn the way the plates draw it (references/levels/The Glass Dunes/,
// docs/systems/materials.md "Dune glass"): not refraction but a print. Compiled into the G-buffer
// surface shader (materials.js) for a material made with `duneGlass` (the DUNE_GLASS define) or, for
// the sand, `dunePool` (DUNE_POOL); like the rest it writes a flat albedo, how lit it is and its glow
// for post.js to print. Both read one vertex attribute, `aGlass` (vec4), written by the kit
// (src/levels/glass-dunes-kit.js glassRidge, glassPools).
//
// The glass (aGlass: x the silhouettes' signed distance in m, negative inside; y how thin the glass is
// there, 0..1; z the lobe, 0 in a crease .. 1 on a belly; w the height up the ridge, 0 foot .. 1 crest, 2 a
// passage's vault):
//   silhouettes  the giants, heads and trees held inside, cut at the distance's zero crossing: one flat
//                dark shape with a hard edge (antialiased over a pixel), whatever the mesh's spacing
//   the light through  thin glass (the ridge's low ends, its foot, the lip of a wave, the crest), and
//                every edge seen grazing (a lobe turning away from the eye: 1 − |n·v|), lets the sun
//                through, the more the more you look toward the sun: printed as two flat bands, a mint
//                glow and a lime core, lifted out of the shade (lit: post.js prints them in the light's
//                colour, never hatched). No sun (night): a faint mint glow at the thinnest parts.
//   deep shade   a face turned well away from the sun, or a lobe's crease, prints a step darker
//                (the billows' rounded lobes, plate 2); a lobe's belly a pale streak up it
// The sand (aGlass: x how near a glass wall's foot, 0..1; yz the way to it, in the xz plane):
//   pools        the light come through the glass falls on the sand beyond it: near a wall's foot, on
//                the side away from the sun (where the glass stands between the point and the sun),
//                two flat bands, mint then lime, lifted out of the wall's shadow; a faint mint all round
//                the foot whatever the sun.
// Cost: a handful of ALU a pixel and one fwidth per band; no texture, no extra pass.
// ---------------------------------------------------------------------------

/** The glass's tones and thresholds (sRGB colours). */
export const DUNE_GLASS = {
  mint: '#86dca6',     // the glow band
  lime: '#bdf09c',     // its core
  sil: '#2a5848',      // the silhouettes held inside
  rim: 0.85,           // the grazing edges' weight in the light through
  band: [0.58, 0.98],  // where the glow band and its core start (the light through, 0..1+)
  deep: 0.78,          // the deep shade: the albedo times this
  night: 0.72,         // the faint glow at night (thin parts)
};
/** The sand's pools of light: their reach is set by the kit; the bands (0..1) and tones. */
export const DUNE_POOL = { mint: '#d2eeae', lime: '#eef7b4', band: [0.32, 0.62], all: 0.35 };
/** What a vertex without the attribute reads (no silhouette, thick glass, a belly, mid height / no pool). */
export const GLASS_ATTR = 'aGlass';
export const GLASS_DEFAULT = [100, 0, 1, 0.5];

const col = (c) => new THREE.Color(c);

/** Turn a fresh makeMaterial() material into dune glass (o.duneGlass: true or DUNE_GLASS's fields). */
export function duneGlassMaterial(mat, o = {}) {
  const g = { ...DUNE_GLASS, ...(o.duneGlass === true ? {} : o.duneGlass) };
  mat.defines = { ...mat.defines, DUNE_GLASS: 1 };
  Object.assign(mat.uniforms, {
    uDuneMint: { value: new THREE.Vector4(...col(g.mint).toArray(), g.rim) },
    uDuneLime: { value: new THREE.Vector4(...col(g.lime).toArray(), g.night) },
    uDuneSil: { value: new THREE.Vector4(...col(g.sil).toArray(), 0) },
    uDuneK: { value: new THREE.Vector4(g.band[0], g.band[1], g.deep, 0) },
  });
  mat.defaultAttributeValues = { ...mat.defaultAttributeValues, [GLASS_ATTR]: GLASS_DEFAULT };
  return mat;
}
/** Turn a fresh terrain material into sand that takes the glass's light (o.dunePool: true or DUNE_POOL's fields). */
export function dunePoolMaterial(mat, o = {}) {
  const p = { ...DUNE_POOL, ...(o.dunePool === true ? {} : o.dunePool) };
  mat.defines = { ...mat.defines, DUNE_POOL: 1 };
  Object.assign(mat.uniforms, {
    uPoolMint: { value: new THREE.Vector4(...col(p.mint).toArray(), p.all) },
    uPoolLime: { value: new THREE.Vector4(...col(p.lime).toArray(), 0) },
    uPoolK: { value: new THREE.Vector4(p.band[0], p.band[1], 0, 0) },
  });
  mat.defaultAttributeValues = { ...mat.defaultAttributeValues, [GLASS_ATTR]: [0, 0, 0, 0] };
  return mat;
}

export const DUNE_GLASS_VERT_PARS = /* glsl */ `
  #if defined(DUNE_GLASS) || defined(DUNE_POOL)
    in vec4 aGlass;
    out vec4 vGlass;
  #endif
`;
export const DUNE_GLASS_VERT = /* glsl */ `
  #if defined(DUNE_GLASS) || defined(DUNE_POOL)
    vGlass = aGlass;
  #endif
`;

export const DUNE_GLASS_GLSL = /* glsl */ `
  #if defined(DUNE_GLASS) || defined(DUNE_POOL)
  in vec4 vGlass;
  // the sun's light, 0 at night (and the moon's light takes no colour through the glass)
  float duneSun() { return smoothstep(-0.02, 0.1, uSunDir.y) * (1.0 - uNight); }
  float duneBand(float x, float at) { float fw = max(fwidth(x), 1e-4); return smoothstep(at - fw, at + fw, x); }
  #endif
  #ifdef DUNE_GLASS
  uniform vec4 uDuneMint;   // rgb the glow band, a the grazing edges' weight
  uniform vec4 uDuneLime;   // rgb its core, a the night's glow
  uniform vec4 uDuneSil;    // rgb the silhouettes
  uniform vec4 uDuneK;      // the bands' thresholds (x glow, y core), z the deep shade

  // (derivatives first, in uniform flow: the caller runs it for every pixel of the material)
  void duneGlass(inout vec3 albedo, inout float L, inout float emit, vec3 n, float ndl) {
    vec3 v = normalize(-vWorldRel);
    float rim = 1.0 - abs(dot(n, v));
    rim *= rim * step(vGlass.w, 1.5);   // (w over 1.5: a vault, seen grazing from inside: no rim)
    float back = clamp(dot(-v, uSunDir) * 0.5 + 0.5, 0.0, 1.0);   // 1 looking into the sun
    float sun = duneSun();
    float shade = 1.0 - step(uToon, L);
    // the silhouettes: a hard edge at the distance's zero
    float sil = 1.0 - duneBand(vGlass.x, 0.0);
    // the light through: thin glass and grazing edges, the more toward the sun; through a silhouette, none
    float through = (vGlass.y * (0.6 + 0.55 * back) + rim * uDuneMint.a * (0.25 + 0.95 * back)) * sun * (0.55 + 0.6 * shade);
    through = max(through, vGlass.y * uDuneLime.a * uNight);
    through *= 1.0 - sil;
    float b1 = duneBand(through, uDuneK.x), b2 = duneBand(through, uDuneK.y);
    // the deep shade: turned well away from the sun, or a lobe's crease (printed: a step darker)
    float deep = max(duneBand(-ndl, 0.38), duneBand(0.22, vGlass.z)) * shade * (1.0 - b1);
    albedo *= mix(1.0, uDuneK.z, deep);
    albedo = mix(albedo, uDuneSil.rgb * (0.85 + 0.3 * min(vGlass.w, 1.0)), sil);
    // a pale streak up each lobe's belly, where it turns most toward you (the plates' long highlights)
    float streak = duneBand(vGlass.z, 0.9) * (1.0 - sil) * (1.0 - b1) * smoothstep(0.1, 0.5, vGlass.w) * step(vGlass.w, 1.5);
    albedo = mix(albedo, mix(albedo, uDuneMint.rgb, 0.6) * 1.12, streak * (0.55 + 0.45 * shade));
    // the bands: lifted out of the shade (lit, so never hatched), their own colours
    albedo = mix(albedo, mix(albedo, uDuneMint.rgb, 0.75), b1);
    albedo = mix(albedo, uDuneLime.rgb, b2);
    L = mix(L, max(L, uToon + 0.08), b1);
    L = mix(L, max(L, 0.92), b2);
    emit = max(emit, 0.3 * b1 + 0.2 * b2);
  }
  #endif
  #ifdef DUNE_POOL
  uniform vec4 uPoolMint;   // rgb the pool's band, a the faint mint all round a foot
  uniform vec4 uPoolLime;   // rgb its core
  uniform vec4 uPoolK;      // the bands' thresholds

  void dunePool(inout vec3 albedo, inout float L) {
    float near = vGlass.x;
    vec2 to = vGlass.yz;
    vec2 s2 = uSunDir.xz / max(length(uSunDir.xz), 1e-3);
    float behind = smoothstep(-0.15, 0.55, dot(to, s2) / max(length(to), 1e-3));   // the glass between here and the sun
    float low = 1.0 - 0.45 * smoothstep(0.3, 0.9, uSunDir.y);   // (a low sun's light goes further through)
    float pool = near * (behind * low + (1.0 - behind) * uPoolMint.a) * duneSun();
    float b1 = duneBand(pool, uPoolK.x), b2 = duneBand(pool, uPoolK.y);
    albedo = mix(albedo, uPoolMint.rgb, b1 * 0.7);
    albedo = mix(albedo, uPoolLime.rgb, b2 * 0.85);
    L = mix(L, max(L, uToon + 0.06), b2);
    L = mix(L, max(L, uToon - 0.04), b1 * (1.0 - b2));
  }
  #endif
`;
