import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The chimes' crystal (src/chimes.js; docs/systems/items.md "Chimes", "The crystal's look"): a faceted cyan
// crystal that catches the light, compiled into the G-buffer surface shader (materials.js) for a material made
// with `crystal` (the CHIME_CRYSTAL define). Like the rest it writes a flat albedo, how lit it is and its glow
// for post.js to print; no extra pass, no texture.
//
// Each shard carries one vertex attribute, `aCrystal` (vec4, chimes.js crystalGeometry): xyz the corner's
// barycentric weight in its triangle (a hidden edge's corner held at 1: no edge drawn across a facet), w the
// shard's length (m: the patterns keep their size), negative on the seam's faces. The field's pieces carry one
// instance attribute too, `aChimeGlow` (float: its tier's glow, 0 a one … 1 a hundred, plus 1 while it is drawn in).
//   facets      flat shading by the live sun, each facet one tone (shade .. light) of the albedo (vertex colours
//               times the instance colour: its tier), the shade side darker and cooler, toward lavender
//   seam        the faces of negative length go lavender (CHIME_CRYSTAL.seam, a little of its own colour in it)
//   edges       a bright line along each facet's edges with a fine ink line in it (the reference's pen),
//               brighter toward the light, thinned to a pixel and faded out once the facets are too small on
//               screen to carry it (no glittering mush far off)
//   inner glow  the facets that face you look into it: a paler core, and a warm heart at its middle seen through
//               the facets (it slides as it turns), pulsing gently, each crystal on its own beat (its position),
//               brighter the more it is worth (aChimeGlow) and brightest as it is drawn in
//   refraction  inner lines, caustic streaks seen through the facet: the view ray bent by the facet
//               (refract, in the shard's own frame) samples two sets of soft lines, so they slide as you
//               walk round it or it turns; a faint rainbow fringe on the facets seen grazing
//   rim         a pale light on the grazing facets (reads against dark floors and interiors)
//   sparkle     the facet whose mirror ray meets the sun flashes white (glow over the bloom threshold: a small
//               printed halo); with no sun (night, a dark room) a softer one off a light over your shoulder
// Ink: soft ink with a pen line (gHatch.a + 8, like the makers' boxes): post.js draws its outline and nothing
// inside it, no crease, colour-edge or shadow-edge line between the facets, no hatching, no spot black; its
// light term never drops under the toon threshold (its shading is its own tones), so no shadow line crosses it.
// Cost: ~50 ALU a pixel and four fwidth, on a few hundred pixels per crystal; all the crystals of a field, of
// every worth, are one instanced draw.
// ---------------------------------------------------------------------------

/** The crystal's tones and weights (sRGB colours; amounts 0..1). */
export const CHIME_CRYSTAL = {
  core: '#fff0c8',     // the inner glow's colour: a warm light at its heart
  edge: '#f4ffff',     // the facets' edges
  deep: '#5e54a0',     // the facets turned from the light go toward a darker albedo with this lavender in it
  seam: '#b4a0ec',     // the seam's lavender
  seamK: 0.8,          // how far its faces go to it
  heart: 0.75,         // the warm heart's strength
  ink: 0.35,           // the fine ink line in the edges (its share)
  glow: 0.42,          // the inner glow at rest (its share of the glow term: under the bloom threshold)
  tierGlow: 0.3,       // the glow term added at aChimeGlow 1 (a hundred: just over the bloom threshold, a soft halo)
  pulse: 0.35,         // how far it pulses (of the glow), and its speed (rad/s)
  speed: 2.1,
  edgeW: 0.045,        // the edge line's width (of the facet, barycentric), never under a pixel
  streaks: 0.2,        // the inner lines' strength
  fringe: 0.4,         // the rainbow fringe on grazing facets
  rim: 0.3,            // the rim light
  spark: [0.93, 0.985],  // the mirror ray's dot with the sun where the sparkle starts and is full
  pen: 0.85,           // the outline: a pen line's share (the rest a darker shade of the crystal)
};
export const CRYSTAL_ATTR = 'aCrystal';
/** The field's per-piece glow (an instance attribute: chimes.js ChimeView). */
export const CRYSTAL_GLOW_ATTR = 'aChimeGlow';
/** What a vertex without the attribute reads: no edges, a one's length (chimes.js CRYSTAL.one). */
export const CRYSTAL_DEFAULT = [1, 1, 1, 0.2];

const col = (c) => new THREE.Color(c);

/** Turn a fresh makeMaterial() material into the chimes' crystal (o.crystal: true or CHIME_CRYSTAL's fields). */
export function crystalMaterial(mat, o = {}) {
  const k = { ...CHIME_CRYSTAL, ...(o.crystal === true ? {} : o.crystal) };
  mat.defines = { ...mat.defines, CHIME_CRYSTAL: 1 };
  Object.assign(mat.uniforms, {
    uCrystalCore: { value: new THREE.Vector4(...col(k.core).toArray(), k.glow) },
    uCrystalEdge: { value: new THREE.Vector4(...col(k.edge).toArray(), k.edgeW) },
    uCrystalDeep: { value: new THREE.Vector4(...col(k.deep).toArray(), k.pen) },
    uCrystalA: { value: new THREE.Vector4(k.pulse, k.speed, k.spark[0], k.spark[1]) },
    uCrystalB: { value: new THREE.Vector4(k.streaks, k.fringe, k.rim, k.tierGlow) },
    uCrystalSeam: { value: new THREE.Vector4(...col(k.seam).toArray(), k.seamK) },
    uCrystalC: { value: new THREE.Vector4(k.heart, k.ink, 0, 0) },
  });
  mat.defaultAttributeValues = { ...mat.defaultAttributeValues, [CRYSTAL_ATTR]: CRYSTAL_DEFAULT, [CRYSTAL_GLOW_ATTR]: [0] };
  return mat;
}

export const CRYSTAL_VERT_PARS = /* glsl */ `
  #ifdef CHIME_CRYSTAL
    in vec4 aCrystal;
    in float aChimeGlow;
    out vec4 vCrystal;
    out float vCrystalBeat;
    out float vCrystalGlow;
  #endif
`;
export const CRYSTAL_VERT = /* glsl */ `
  #ifdef CHIME_CRYSTAL
  {
    vCrystal = aCrystal;
    vCrystalGlow = aChimeGlow;
    vec4 cc = vec4(0.0, 0.0, 0.0, 1.0);
    #ifdef USE_INSTANCING
      cc = instanceMatrix * cc;
    #endif
    cc = modelMatrix * cc;
    vCrystalBeat = fract(sin(dot(floor(cc.xz * 7.0), vec2(12.9898, 78.233))) * 43758.5453) * 6.2832;   // (its own beat)
  }
  #endif
`;

export const CRYSTAL_GLSL = /* glsl */ `
  #ifdef CHIME_CRYSTAL
  in vec4 vCrystal;
  in float vCrystalBeat;
  in float vCrystalGlow;
  uniform vec4 uCrystalCore;   // rgb the inner glow, a its share of the glow at rest
  uniform vec4 uCrystalEdge;   // rgb the edges, a their width (barycentric)
  uniform vec4 uCrystalDeep;   // rgb the facets turned from the light, a the outline's pen share
  uniform vec4 uCrystalA;      // x the pulse, y its speed, zw the sparkle's band (mirror ray · sun)
  uniform vec4 uCrystalB;      // x the inner lines, y the rainbow fringe, z the rim light, w the glow added at aChimeGlow 1
  uniform vec4 uCrystalSeam;   // rgb the seam, a how far its faces go to it
  uniform vec4 uCrystalC;      // x the warm heart, y the edges' ink line

  // soft lines, a pixel or more wide whatever the distance (their coordinate's own derivative)
  float crystalLines(float x, float w) {
    float f = abs(fract(x) - 0.5), fw = max(fwidth(x), 1e-4);
    return (1.0 - smoothstep(w, w + fw * 1.5, 0.5 - f)) * (1.0 - smoothstep(0.18, 0.4, fw));   // (gone once they crowd under a pixel)
  }
  // (derivatives first, in uniform flow: called for every pixel of the material)
  void chimeCrystal(inout vec3 albedo, inout float L, inout float emit, vec3 n) {
    vec3 v = normalize(-vWorldRel);
    float ndv = clamp(dot(n, v), 0.0, 1.0), ndl = dot(n, uSunDir);
    float sun = smoothstep(-0.04, 0.12, uSunDir.y) * (1.0 - 0.8 * uNight);
    // the facet's edges: the nearest barycentric weight, against its own screen footprint
    float e = min(min(vCrystal.x, vCrystal.y), vCrystal.z), efw = max(fwidth(e), 1e-4);
    float edge = (1.0 - smoothstep(uCrystalEdge.a, uCrystalEdge.a + efw * 1.2, e - efw * 0.6)) * (1.0 - smoothstep(0.07, 0.16, efw));
    float inkW = uCrystalEdge.a * 0.3;
    float ink = (1.0 - smoothstep(inkW, inkW + efw, e - efw * 0.3)) * (1.0 - smoothstep(0.025, 0.06, efw));   // (only close: gone before the bright line)
    float Lw = max(abs(vCrystal.w), 1e-3), seam = step(vCrystal.w, 0.0), glow = vCrystalGlow;
    // the view ray bent into the shard, in its own frame (the lines move with it and slide with the view)
    vec3 vo = normalize(vObjRel), no = normalize(vObjNormal);
    vec3 rr = refract(vo, no, 0.66);
    vec3 q = (vObjPos + rr * Lw * 0.55) / Lw;
    float t = uTime * 0.25;
    float s1 = crystalLines(q.y * 2.6 + q.x * 1.3 + 0.35 * sin(q.z * 5.0 + t), 0.045);
    float s2 = crystalLines(q.y * -1.9 + q.z * 2.4 + 0.3 * sin(q.x * 6.0 - t * 1.3), 0.035);
    float streak = max(s1, s2 * 0.7) * uCrystalB.x * (0.35 + 0.65 * ndv);   // (seen into the facets facing you)

    // the facets: one tone each by the live sun (the vertex colours' cyan and seam under it)
    float lit = smoothstep(-0.35, 0.75, ndl) * mix(0.55, 1.0, sun) + (1.0 - sun) * 0.35 * ndv;
    vec3 deep = mix(albedo * 0.62, uCrystalDeep.rgb, 0.3);   // (its own hue, darker and cooler: lavender in the shade)
    vec3 c = mix(mix(deep, albedo, 0.4), albedo * 1.15, lit);
    // the seam: a lavender band down its length
    c = mix(c, mix(uCrystalSeam.rgb, albedo, 0.2) * mix(0.8, 1.12, lit), seam * uCrystalSeam.a);
    // the inner glow: the facets facing you look into it, a warm heart at its middle, pulsing on its own beat
    float beat = 0.5 + 0.5 * sin(uTime * uCrystalA.y + vCrystalBeat);
    float pulse = 1.0 - uCrystalA.x + uCrystalA.x * beat;
    float core = ndv * ndv * pulse;
    vec3 hq = (vObjPos + rr * Lw * 0.1) / Lw * vec3(3.6, 1.9, 3.6);   // (a little parallax: it sits inside)
    float heart = exp(-dot(hq, hq) * 3.0) * (0.35 + 0.65 * ndv) * pulse * uCrystalC.x * (1.0 + 0.8 * min(glow, 1.5));
    c = mix(c, mix(uCrystalCore.rgb, albedo, 0.25), clamp(0.25 * core * (1.0 + glow) + heart, 0.0, 1.0));
    // inner lines, paler for the core behind them
    c = mix(c, mix(uCrystalCore.rgb, vec3(1.0), 0.4), streak * (0.55 + 0.45 * core));
    // the rim: grazing facets pale, with a faint rainbow fringe (the hue turns with the view)
    float rim = 1.0 - ndv;
    float fringe = smoothstep(0.42, 0.9, rim) * uCrystalB.y;
    vec3 hue = 0.5 + 0.5 * cos(6.2832 * (rim * 1.4 + dot(rr, vec3(0.6, 0.35, 0.5)) + vec3(0.0, 0.33, 0.67)));
    c = mix(c, mix(hue, vec3(1.0), 0.35), fringe * 0.55);
    c += uCrystalEdge.rgb * rim * rim * rim * uCrystalB.z;
    // the edges catch the light (a little rainbow where the facet grazes)
    vec3 edgeC = mix(uCrystalEdge.rgb, mix(hue, vec3(1.0), 0.5), fringe);
    c = mix(c, edgeC, edge * (0.18 + 0.45 * max(ndl, 0.0) * sun + 0.1 * ndv));
    c = mix(c, deep * 0.55, ink * uCrystalC.y);   // (the pen, in the bright line: seen close only)
    // the sparkle: the facet whose mirror ray meets the sun (no sun: a light over your shoulder)
    vec3 refl = reflect(-v, n);
    float spark = smoothstep(uCrystalA.z, uCrystalA.w, dot(refl, uSunDir)) * sun;
    spark = max(spark, smoothstep(0.985, 0.998, dot(refl, normalize(v + vec3(0.0, 0.55, 0.0)))) * (1.0 - sun) * 0.8);
    c = mix(c, vec3(1.0), spark);
    albedo = min(c, vec3(1.0));
    // lit, always (its shade is its own tones): no shadow line across it, no hatching
    L = max(L, uToon + 0.08 + 0.3 * lit);
    emit = max(emit, max(uCrystalCore.a * (0.75 + 0.25 * beat) + uCrystalB.w * glow + 0.2 * heart, 0.95 * spark));
  }
  #endif
`;
