import * as THREE from 'three';

// Shader-drawn cloth folds for the traveller's flat-coloured suit, in bind-pose
// coordinates so they ride with the skin: chevron folds at the elbows and
// knees, gathered elastic cuffs at the wrists and ankles, pulls from the
// crotch and armpits, and the zip down the front. More of each fold is drawn
// on the shadow side, the way a pen sketch darkens a form.
export const CREASE_GLSL = `
uniform float uCreases;
uniform vec3 uLimbs[16];   // bind pose: upper arm L/R, forearm L/R, thigh L/R, shin L/R (start, end)
// Rings round a limb bent into chevrons and broken into arcs.
float foldRings(float t, float c, float s, float centre, float reach, float spacing, float bend, float seed, float dark, float widthPx) {
  float u = (t - centre) / spacing + bend * abs(s) + .3 * c;
  float fu = max(fwidth(u), 1e-4);
  float k = floor(u + .5);
  float arc = vnoise(vec2(k * 3.7 + seed, c * 1.7 + s * 2.3 + seed * 1.3));
  float keep = smoothstep(.5 - .22 * dark, .58 - .22 * dark, arc);
  float near = 1.0 - smoothstep(.45, 1.0, abs(t - centre) / reach);
  return inkLine(abs(u - k) / fu, widthPx) * keep * near * (1.0 - smoothstep(.22, .45, fu));
}
// Short pleats running along a limb where an elastic cuff gathers the cloth.
float cuffPleats(float t, float c, float s, float centre, float reach, float count, float seed) {
  float u = atan(s, c) / 6.2832 * count;
  float fu = max(fwidth(u), 1e-4);
  float k = floor(u + .5);
  float len = reach * (.45 + .55 * hash(vec2(k, seed)));
  float on = 1.0 - smoothstep(len * .8, len, abs(t - centre));
  return inkLine(abs(u - k) / fu, .75) * on * step(.35, hash(vec2(k, seed + 4.0))) * (1.0 - smoothstep(.2, .4, fu));
}
float outfitCreases(vec3 p, vec3 n, float dark) {
  float ink = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 a = uLimbs[i * 2], b = uLimbs[i * 2 + 1];
    float len = length(b - a);
    vec3 d = (b - a) / len;
    float t = dot(p - a, d);
    vec3 r = p - a - d * t;
    vec3 e1 = normalize(vec3(0.0, 0.0, 1.0) - d * d.z);
    float rl = max(length(r), 1e-4);
    float c = dot(r, e1) / rl, s = dot(r, cross(d, e1)) / rl;
    bool leg = i >= 4, lower = i % 4 >= 2;
    float inside = step(rl, leg ? .23 : .16) * step(-.04, t) * step(t, len + .04);
    float seed = float(i) * 11.3, f;
    if (!lower) {
      // elbow / knee: chevrons pointing down the limb, densest on the joint
      f = foldRings(t, c, s, len, leg ? .17 : .13, leg ? .042 : .03, leg ? .9 : .7, seed, dark, 1.0);
      if (leg) f = max(f, foldRings(t, c, s, .06, .09, .045, 1.4, seed + 5.0, dark, .9) * step(-.2, c));
    } else {
      f = foldRings(t, c, s, 0.0, leg ? .11 : .1, leg ? .036 : .028, leg ? .8 : .7, seed, dark, .95);
      // elastic cuff above the glove / boot: tight rings and pleats
      float cuff = len - (leg ? .1 : .085);
      f = max(f, foldRings(t, c, s, cuff, .045, .013, .12, seed + 2.0, dark * .5 + .5, .8));
      f = max(f, cuffPleats(t, c, s, cuff, .03, leg ? 26.0 : 18.0, seed));
    }
    ink = max(ink, f * inside);
  }
  // zip and pulls on the front of the suit
  float front = smoothstep(.3, .65, n.z);
  float x = abs(p.x), fx = max(fwidth(p.x), 1e-5);
  ink = max(ink, inkLine(x / fx, .9) * step(.86, p.y) * step(p.y, 1.53) * front);
  ink = max(ink, inkLine(segDist(vec2(p.x, p.y), vec2(-.008, 1.5), vec2(.008, 1.5)) / fx, 1.1) * front);
  vec2 q = vec2(x, p.y);
  ink = max(ink, inkLine(segDist(q, vec2(.03, .86), vec2(.13, .97)) / fx, .9) * front * .9);
  ink = max(ink, inkLine(segDist(q, vec2(.05, .84), vec2(.17, .9)) / fx, .8) * front * .7 * step(.3, dark + .3));
  ink = max(ink, inkLine(segDist(q, vec2(.19, 1.37), vec2(.12, 1.27)) / fx, .85) * smoothstep(.1, .4, n.z) * .8);
  return ink * (1.0 - smoothstep(.0035, .007, fx));
}
`;

// the outfit rig's names, and the people's skeleton's (the traveller now wears the outfit on it: outfit.js)
const LIMBS = ['upper_arm', 'forearm', 'hand', 'thigh', 'shin', 'foot'];
const HUMAN = ['upperarm_', 'lowerarm_', 'hand_', 'thigh_', 'calf_', 'foot_'];
/**
 * Bind-pose limb segments (upper arms, forearms, thighs, shins) of a skin, in its own geometry's
 * coordinates (an outfit fitted through its inverse bind matrices gets its own rig's joints back).
 */
export function limbSegments(skinned) {
  const { bones, boneInverses } = skinned.skeleton;
  const at = (k, side) => {
    const names = [LIMBS[k] + side, HUMAN[k] + side.toLowerCase()];
    const i = bones.findIndex(b => names.includes(b.name.replace('.', '')));
    return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(boneInverses[i].clone().invert()).applyMatrix4(skinned.bindMatrixInverse);
  };
  const out = [];
  for (const [from, to] of [[0, 1], [1, 2], [3, 4], [4, 5]]) for (const side of ['L', 'R']) {
    const a = at(from, side), b = at(to, side);
    if (!a || !b) return null;
    out.push(a, b);
  }
  return out;
}
