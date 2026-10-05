import * as THREE from 'three';

// The grass blades' vertex stage (makeMaterial({ grass }), materials.js; placed by flora-grass.js).
//
// A tuft is one instance: a few blades, each a tapered strip of 3 triangles, its vertices'
// y running 0 (root) to 1 (tip). Per instance, aGrass = root x, y, z and height (m, 0 = none),
// aGrass2 = turn (rad), tint 0..1 (the ground's first tone to its second), lean, phase 0..1.
// Here the tuft is turned, scaled to its height, bent by the world's wind (uWind, the same
// gust front as the plants' SWAY) and by the traveller walking through it (uBrush: the blades
// part round the feet), and it sinks into the ground as it nears the edge of the patch
// (uGrassView), where the ground's own inked texture takes over.

export const GRASS_VERT_PARS = /* glsl */ `
  in vec4 aGrass;
  in vec4 aGrass2;
  uniform vec4 uGrassView;   // camera x, z; the fade's start and end (m from the camera)
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uTime;
  uniform vec4 uWind;
  uniform vec4 uBrush;
  float grassT;
  float grassFade;
  flat out float vGrassSoft;   // 1: soft ink (post.js tints its outline a darker green); a few tufts keep a real pen line
  void grassPlace(inout vec3 p, inout vec3 nrm) {
    vec3 root = aGrass.xyz;
    float d = length(root.xz - uGrassView.xy);
    // thinned with distance, then sinking into the ground near the patch's edge
    float keep = step(aGrass2.w, mix(1.0, 0.3, smoothstep(uGrassView.z * 0.5, uGrassView.w, d)));
    grassFade = (1.0 - smoothstep(uGrassView.z, uGrassView.w, d)) * keep;
    float h = aGrass.w * grassFade;
    float t = p.y;
    grassT = t;
    vGrassSoft = step(0.12, fract(aGrass2.w * 7.31));
    float c = cos(aGrass2.x), s = sin(aGrass2.x);
    vec2 xz = mat2(c, s, -s, c) * p.xz;
    // the wind: a lean downwind as the gust front passes, a flutter of the blade's own
    vec2 wd = uWind.xy;
    float str = uWind.z;
    float wave = 0.5 + 0.5 * sin(uTime * 1.7 - dot(root.xz, wd) * 0.09);
    float push = str * (0.35 + 0.65 * uWind.w * wave);
    float flutter = (0.4 + 0.6 * str) * sin(uTime * (2.3 + 1.1 * str) + root.x * 0.53 + root.z * 0.31 + aGrass2.w * 6.28);
    vec2 bend = wd * (push * 0.32 + flutter * 0.1) + vec2(c, s) * aGrass2.z;
    // the traveller walking through: the blades part round the feet, more when hurrying
    vec2 away = root.xz - uBrush.xz;
    float dB = length(away);
    float brush = (1.0 - smoothstep(0.2, 1.0, dB)) * step(abs(root.y - uBrush.y), 1.6) * (0.9 + 0.12 * min(uBrush.w, 5.0));
    bend += (dB > 1e-3 ? away / dB : vec2(0.0)) * brush * 1.3;
    // bent along a curve (the root stays put), the tip lowered so the blade keeps its length
    float b = length(bend);
    vec2 off = bend * t * t * h;
    float rise = t * h / sqrt(1.0 + b * b * t * t);
    p = vec3(root.x + xz.x + off.x, root.y - 0.04 + rise, root.z + xz.y + off.y);
    // lit like the ground it grows from (no crease lines against it), tipped a little with the bend
    nrm = normalize(vec3(bend.x * 0.25, 1.0, bend.y * 0.25));
  }
`;

/** The uniforms the GRASS block adds to a material (flora-grass.js keeps uGrassView up to date). */
export function grassUniforms() {
  return { uGrassView: { value: new THREE.Vector4(0, 0, 14, 24) } };
}
