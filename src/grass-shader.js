import * as THREE from 'three';

// The grass blades' vertex stage (makeMaterial({ grass }), materials.js; placed by flora-grass.js).
//
// A tuft is one instance: a few blades, each a tapered strip of 3 triangles, its vertices'
// y running 0 (root) to 1 (tip). Per instance, aGrass = root x, y, z and height (m, 0 = none),
// aGrass2 = turn (rad), tint 0..1 (the ground's first tone to its second), lean, rank 0..1.
// Here the tuft is turned, scaled to its height, bent by the world's wind (uWind, the same
// gust front as the plants' SWAY) and by the traveller walking through it (brushLean, brush.js:
// the blades part round the feet and spring back).
//
// With distance it fades out smoothly (grassLod): no tuft ever pops in or out.
//  - Thinning: each tuft has its rank; the share of tufts kept falls with the distance from the
//    camera, and a tuft shrinks to nothing over a short band as the share passes its rank.
//  - Shrinking and blending: further out the blades get shorter and a little thinner, take the
//    ground's own colour under them (materials.js) and lose their outline (post.js, soft ink:
//    gHatch.r the pen line's share, gHatch.g the outline's fade).
//  - The patch's edge (uGrassView, round its centre a little ahead of the camera) sinks what is
//    left into the ground before the tufts wrap round.
//  - The far layer (flora-grass.js): sparse low tufts of two blades, out to about 2.5 times the
//    near patch, growing in where the near one thins out; the same look by distance, so the two
//    meet without a seam, and the field fades into the ground's inked ticks rather than ending.

/** How a brush's lean (m, brush.js) bends a blade (its tip's offset per unit of height): walking through, about 0.8. */
export const GRASS_BRUSH = 8;

export const GRASS_VERT_PARS = /* glsl */ `
  in vec4 aGrass;
  in vec4 aGrass2;
  uniform vec4 uGrassView;   // the patch's centre x, z; its edge fade's start and end (m from the centre)
  uniform vec4 uGrassLod;    // from the camera (m): the thinning's start and end, the share kept at its end; w 1: grows in instead (the far layer)
  uniform vec4 uGrassLook;   // from the camera (m): into the ground's colour from x to y, z the height left at y; w the pen-lined share (near)
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uTime;
  uniform vec4 uWind;
  float grassT;
  flat out vec3 vGrassLook;  // x the pen line (0..1), y the outline's fade (0..1), z the blend into the ground's colour (0..1)
  void grassPlace(inout vec3 p, inout vec3 nrm) {
    vec3 root = aGrass.xyz;
    float rank = aGrass2.w;
    float de = length(root.xz - uGrassView.xy);
    // (the camera's height counts a little: from up high the field is seen whole, as on the ground)
    float dc = length(vec3(root.xz - cameraPosition.xz, 0.35 * (root.y - cameraPosition.y)));
    // the share kept at this distance, and this tuft's part of it (shrinking over a band, never a step)
    float lodT = smoothstep(uGrassLod.x, uGrassLod.y, dc);
    float share = uGrassLod.w > 0.5 ? lodT : mix(1.0, uGrassLod.z, lodT);
    float life = clamp((share * 1.25 - rank) / 0.25, 0.0, 1.0);
    float edge = 1.0 - smoothstep(uGrassView.z, uGrassView.w, de);
    float look = smoothstep(uGrassLook.x, uGrassLook.y, dc);
    float h = aGrass.w * edge * life * mix(1.0, uGrassLook.z, look);
    float t = p.y;
    grassT = t;
    float pen = step(fract(rank * 7.31), uGrassLook.w) * (1.0 - smoothstep(uGrassLook.x * 0.6, uGrassLook.x * 1.4, dc));
    vGrassLook = vec3(pen, look, look);
    float c = cos(aGrass2.x), s = sin(aGrass2.x);
    vec2 xz = mat2(c, s, -s, c) * p.xz * mix(1.0, 0.8, look);
    // the wind: a lean downwind as the gust front passes, a flutter of the blade's own
    vec2 wd = uWind.xy;
    float str = uWind.z;
    float wave = 0.5 + 0.5 * sin(uTime * 1.7 - dot(root.xz, wd) * 0.09);
    float push = str * (0.35 + 0.65 * uWind.w * wave);
    float flutter = (0.4 + 0.6 * str) * sin(uTime * (2.3 + 1.1 * str) + root.x * 0.53 + root.z * 0.31 + rank * 6.28);
    vec2 bend = wd * (push * 0.32 + flutter * 0.1) + vec2(c, s) * aGrass2.z;
    // the traveller walking through: the blades part round the feet and spring back (brush.js)
    bend += brushLean(root, 0.12, 0.75, 1.6) * ${GRASS_BRUSH.toFixed(1)};
    // bent along a curve (the root stays put), the tip lowered so the blade keeps its length
    float b = length(bend);
    vec2 off = bend * t * t * h;
    float rise = t * h / sqrt(1.0 + b * b * t * t);
    p = vec3(root.x + xz.x + off.x, root.y - 0.04 + rise, root.z + xz.y + off.y);
    // lit like the ground it grows from (no crease lines against it), tipped a little with the bend,
    // flat like the ground far off
    nrm = normalize(vec3(bend.x * 0.25 * (1.0 - look), 1.0, bend.y * 0.25 * (1.0 - look)));
  }
`;

/**
 * The fade's distances for a layer: R the near patch's radius (m), Rf the far layer's (null: none),
 * far: this is the far layer. view: the edge fade round the patch's centre; lod: the thinning (or
 * the far layer's growing in) from the camera; look: the blend into the ground (the same for both
 * layers, so a near and a far tuft at one distance look alike), the height left, the pen share.
 * keep: the near layer thins down to this share (the far layer's density over its own), so the
 * field's density falls smoothly from the near patch's into the far layer's.
 */
export function grassLod(R, Rf = null, far = false, keep = 0) {
  const look = [0.55 * R, 1.25 * (Rf ?? R * 0.8), 0.55, far ? 0 : 0.12];
  if (far) return { view: [0.6 * Rf, 0.9 * Rf], lod: [0.35 * R, 1.1 * R, 1, 1], look };
  return { view: [0.62 * R, 0.9 * R], lod: [0.4 * R, 1.2 * R, keep, 0], look };
}

const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/**
 * The shader's height factor for a tuft (mirrors grassPlace): rank 0..1, dc its distance from the
 * camera (across the ground, plus a third of the height), de from the patch's centre, P a grassLod.
 * 0: nothing drawn.
 */
export function tuftScale(P, rank, dc, de) {
  const lodT = smooth(dc, P.lod[0], P.lod[1]);
  const share = P.lod[3] > 0.5 ? lodT : 1 + (P.lod[2] - 1) * lodT;
  const life = Math.min(1, Math.max(0, (share * 1.25 - rank) / 0.25));
  const edge = 1 - smooth(de, P.view[0], P.view[1]);
  const look = smooth(dc, P.look[0], P.look[1]);
  return edge * life * (1 + (P.look[2] - 1) * look);
}
/** How far into the ground's colour (and without its outline) a tuft at dc is drawn (0..1). */
export const tuftLook = (P, dc) => smooth(dc, P.look[0], P.look[1]);

/** The uniforms the GRASS block adds to a material (flora-grass.js keeps them up to date). */
export function grassUniforms() {
  return {
    uGrassView: { value: new THREE.Vector4(0, 0, 14, 24) },
    uGrassLod: { value: new THREE.Vector4(8, 30, 0.22, 0) },
    uGrassLook: { value: new THREE.Vector4(14, 60, 0.55, 0.12) },
  };
}
