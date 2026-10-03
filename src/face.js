import * as THREE from 'three';

// Rest-space ink follows the skinned head without a painted image or facial bones.
// Drawn like a Moebius face: few marks, each a tapered pen stroke — almond lids
// with solid pupils, one hooked line down the shadow side of the nose, a mouth
// with a short lower-lip stroke, and fine parallel hatching in the face's shadow.
export const PORTRAIT_GLSL = `
uniform float uPortrait;
uniform vec4 uExpression; // blink, smile, mouth opening, brow lift
uniform vec2 uGaze;
// Ink of half-width w (metres); never thinner than a pen line on screen.
float portraitPen(float d, float w, float aa) {
  w = max(w, aa * .45);
  return 1.0 - smoothstep(w - aa * .5, w + aa * .5, d);
}
// A straight stroke that swells in the middle and lifts off at both ends.
float portraitSeg(vec2 p, vec2 a, vec2 b, float w, float aa) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return portraitPen(length(p - a - ab * t), w * (.3 + .7 * sin(3.14159 * t)), aa);
}
// A stroke along y = y0 + k (x / h)^2 for |x - x0| < h, tapered towards its ends.
float portraitArc(vec2 p, float x0, float y0, float h, float k, float w, float aa) {
  float u = (p.x - x0) / h;
  float y = y0 + k * u * u;
  float slope = 2.0 * k * u / h;
  float d = abs(p.y - y) / sqrt(1.0 + slope * slope);
  float taper = 1.0 - smoothstep(.55, 1.0, abs(u));
  return portraitPen(d, w * (.35 + .65 * taper), aa) * (1.0 - smoothstep(.98, 1.04, abs(u)));
}
float portraitInk(vec3 p, float dark) {
  float aa = max(fwidth(p.x) + fwidth(p.y), .00035);
  // fine marks only once the face is large enough on screen to read them
  float fine = 1.0 - smoothstep(.0012, .0028, aa);
  float side = sign(p.x);
  vec2 q = vec2(abs(p.x), p.y);
  float open = 1.0 - uExpression.x, smile = uExpression.y;

  // eyes: an arched upper lid that flattens into a lowered arc as it blinks
  vec2 e = vec2(q.x - .039 - uGaze.x * side, q.y - 1.843 - uGaze.y);
  float lidK = mix(.0028, -.0042, open) - smile * .0012;
  float lidY = mix(-.0006, .0034, open) + smile * .0007;
  float ink = portraitArc(e, 0.0, lidY, .0115, lidK, .00085, aa);
  ink = max(ink, portraitSeg(e, vec2(.0105, lidY + lidK * .83), vec2(.0138, lidY + lidK * .83 + .0016), .0005, aa) * open);
  vec2 iris = (e - vec2(-.0006, -.0004)) / vec2(max(.0027, aa * .9), max(.0034, aa * 1.1));
  float lidAt = lidY + lidK * (e.x / .0115) * (e.x / .0115);
  ink = max(ink, (1.0 - smoothstep(1.0 - aa / .003, 1.0, length(iris))) * step(e.y, lidAt) * smoothstep(.15, .45, open));
  ink = max(ink, portraitArc(e, .0035, -.0058, .0055, .0012, .00035, aa) * open * fine * .7);

  // brows: a light stroke, thicker at the inner end, lifting with expression
  vec2 b = vec2(q.x, q.y - uExpression.w * .005);
  ink = max(ink, portraitSeg(b, vec2(.027, 1.8605), vec2(.041, 1.8655), .0008, aa));
  ink = max(ink, portraitSeg(b, vec2(.039, 1.8652), vec2(.054, 1.8628), .0006, aa));

  // nose: one hooked line down the shadow side, a small wing and the far nostril
  vec2 n = vec2(-p.x, p.y);
  ink = max(ink, portraitSeg(n, vec2(.0075, 1.817), vec2(.0118, 1.7925), .0006, aa) * .9);
  ink = max(ink, portraitArc(n, .0115, 1.7838, .0052, .0026, .0006, aa) * step(n.x, .0135));
  ink = max(ink, (1.0 - smoothstep(.0012, .0012 + aa, length((vec2(p.x, p.y) - vec2(.0085, 1.7832)) * vec2(1.0, 1.6)))) * fine);

  // mouth: a line that bends with the smile, opening into a dark shape
  float mouthHalf = .0145 + smile * .002;
  float mouthY = 1.7492 - smile * .0016, mouthK = smile * .0042;
  ink = max(ink, portraitArc(vec2(p.x, p.y), 0.0, mouthY, mouthHalf, mouthK, .00075, aa));
  float gape = uExpression.z * .0042;
  vec2 m = (vec2(p.x, p.y) - vec2(0.0, mouthY - gape * .55 + mouthK * .25)) / vec2(mouthHalf * .62, max(gape * .6, 1e-5));
  ink = max(ink, (1.0 - smoothstep(1.0 - .15, 1.0, length(m))) * step(.0004, gape));
  ink = max(ink, portraitArc(vec2(p.x, p.y), 0.0, 1.7418 - gape * .9, .0058, -.0007, .0004, aa) * fine * .75);
  ink = max(ink, portraitSeg(q, vec2(mouthHalf - .0005, mouthY + mouthK), vec2(mouthHalf + .0022, mouthY + mouthK + .0021 * sign(smile)), .00045, aa)
    * smoothstep(.15, .5, abs(smile)) * fine);
  // chin: a short arc under the lip
  ink = max(ink, portraitArc(vec2(p.x, p.y), 0.0, 1.7275, .0072, .0013, .00045, aa) * fine * .35);

  // shadow: close parallel strokes hugging the shadow edge, the deep shade left flat
  float h = (p.x * .55 + p.y) / .0042;
  float fh = max(fwidth(h), 1e-4);
  float hatch = portraitPen(abs(fract(h) - .5) * .0042, .0003, aa * .6) * smoothstep(.03, .14, dark) * (1.0 - smoothstep(.42, .75, dark)) * fine
    * (1.0 - smoothstep(.25, .5, fh)) * smoothstep(.013, .02, length(e));
  ink = max(ink, hatch * .5);
  return ink * smoothstep(.075, .1, p.z);
}
`;

export class FaceExpression {
  constructor() {
    this.time = 0;
    this.uniforms = { uPortrait: { value: 1 }, uExpression: { value: new THREE.Vector4() }, uGaze: { value: new THREE.Vector2() } };
  }
  update(dt, { speed = 0, climbing = false, blink, smile = 0, mouth, brow = 0 } = {}) {
    this.time += Math.max(0, dt);
    const phase = this.time % 4.3;
    const naturalBlink = phase < .18 ? Math.sin(Math.PI * phase / .18) ** 2 : 0;
    const effort = climbing ? .65 : THREE.MathUtils.clamp(speed / 7, 0, 1);
    const v = this.uniforms.uExpression.value;
    v.set(THREE.MathUtils.clamp(blink ?? naturalBlink, 0, 1), THREE.MathUtils.clamp(smile, -1, 1),
      THREE.MathUtils.clamp(mouth ?? effort * (.25 + .15 * Math.sin(this.time * 5)), 0, 1), THREE.MathUtils.clamp(brow, -1, 1));
    this.uniforms.uGaze.value.set(Math.sin(this.time * .53) * .0015, Math.sin(this.time * .31) * .0007);
  }
}

// The inspection viewer uses the identical ink function with its unlit material.
export function attachPortraitPreview(material, uniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vPortrait;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPortrait = position;');
    shader.fragmentShader = 'varying vec3 vPortrait;\n' + PORTRAIT_GLSL + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(.10,.085,.09), portraitInk(vPortrait, 0.0));');
  };
  material.customProgramCacheKey = () => 'traveller-portrait-v2';
}
