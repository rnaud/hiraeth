import { Vector4, Matrix4 } from 'three';
import { cleanExpression, NEUTRAL_EXPRESSION } from '../expression.js';
import { EYE_REACH } from '../eyes.js';

// The coral-shirt traveller's face (src/characters/traveller-v1.js). His Tripo body came with a face
// painted into its texture (thick black brows, almond eyes with a dark iris, a faint mouth line) and no
// rig for it, so he could not smile, frown, blink or talk. This draws the face in his material's
// fragment shader instead, in the head's bind space (vBind, skinned with the head like the paint was):
// first the head skin is flattened to remove painted lighting, the old features are covered,
// and the hair fringe is protected from those repairs. Then the brows, the
// eyes and the mouth are drawn again, where the paint had them and in the same hand, but moved by the
// same channels as everyone else's face (src/expression.js: smile, open, brow, browTilt, squint, gaze;
// the blink and the mouth on the syllables come in through Humanoid.updateEyes and setExpression).
//
//   const face = wearTripoFace(mesh)   (patches the mesh's material; a Humanoid's drawnFace)
//   face.set(expression)               Humanoid.setExpression
//   face.eyes(blink, squint, look)     Humanoid.updateEyes (look: the gaze, the eyes' bind space, +z ahead)
//
// The state is a handful of uniforms (tripoFaceState: pure, tested), so a moving face costs one small
// uniform upload a frame and the shader's work is a box test on every other pixel of his body.

/** Where his face is (bind space, metres; measured off the painted texture: docs/systems/faces.md). */
export const TRIPO_FACE = {
  mid: -0.001,                                   // the face's centre line (x)
  front: 0.035,                                  // only in front of this z (the back of the head has the same x, y)
  paint: {                                       // the painted features, covered
    eyes: [[-0.034, 1.6415], [0.0315, 1.6415]], eyeHalf: [0.0185, 0.0078],
    brows: [[-0.0385, 1.6616], [0.035, 1.6616]], browHalf: [0.032, 0.014],
    mouth: [-0.0005, 1.5803], mouthHalf: [0.026, 0.0038],
    skin: [0.72, 0.505, 0.37], lid: [0.684, 0.488, 0.345],   // the skin round them (sRGB, as the texture holds it)
  },
  eye: { x: 0.0328, y: 1.6415, w: 0.0163, h: 0.0056, iris: 0.0066 },
  brow: { inner: [0.0112, 1.6596], peak: [0.033, 1.6648], outer: [0.0618, 1.6603], half: 0.0039 },
  mouth: { y: 1.5805, w: 0.0195 },
  centre: [1.612, 0.08],                         // the face's middle on its surface (y, z): what the close shot frames
};
const _m = new Matrix4();
/**
 * How far the channels move his face, against the measures it was first drawn with (brows, the mouth's
 * corners and width, its opening), and how heavy the mouth's line is: in the conversations' close shot his
 * face is 120 to 180 px tall, where the first measures moved a corner by two pixels and drew the mouth one
 * pixel thick. Still within the people's own faces' range (face-ink.js), which are bent as far again.
 */
export const TRIPO_GAIN = { brow: 1.45, mouth: 1.5, open: 1.4, line: 1.5 };

/**
 * The face's uniforms for an expression (a clean one: expression.js cleanExpression), the lids (blink 0..1)
 * and the gaze (look: [x, y] of a direction, +z ahead); into `out` (one per face: no garbage a frame).
 */
export function tripoFaceState(expression = NEUTRAL_EXPRESSION, { blink = 0, look = null } = {}, out = { brow: new Array(8), eye: new Array(4), mouth: new Array(4) }) {
  const x = expression ?? NEUTRAL_EXPRESSION, F = TRIPO_FACE, B = F.brow;
  // the brows: raised (or lowered and drawn together), their inner ends up (worry) or down (anger)
  // (October 2026: half as much again, so a face 120 px tall in the conversation's close shot reads: TRIPO_GAIN)
  const G = TRIPO_GAIN;
  const raise = x.brow >= 0 ? x.brow * 0.006 * G.brow : x.brow * 0.0035 * G.brow;
  const knit = Math.max(0, -x.brow) * 0.003 * G.brow, tilt = x.browTilt * 0.0055 * G.brow;
  const b = out.brow;
  b[0] = B.inner[0] - knit; b[1] = B.inner[1] + raise + tilt - knit * 0.5;
  b[2] = B.peak[0] - knit * 0.4; b[3] = B.peak[1] + raise + tilt * 0.3;
  b[4] = B.outer[0]; b[5] = B.outer[1] + raise * 0.75 - tilt * 0.25;
  b[6] = 1 + 0.08 * Math.max(0, -x.brow);
  b[7] = x.asymmetry ?? 0;
  // the lids: a blink shuts the upper one; a squint brings it half down and the lower one up; a smile
  // lifts the lower lid with the cheek; raised brows open the eye a little wider (a gasp)
  const close = Math.min(1, Math.max(blink, x.squint * 0.45)) - Math.max(0, x.brow - 0.4) * 0.22 * (1 - blink);
  const lower = Math.min(1, Math.max(0, x.smile) * 0.5 + x.squint * 0.45);
  const sx = Math.sin(EYE_REACH.yaw), sy = Math.sin(EYE_REACH.down);
  const gx = look ? Math.max(-1, Math.min(1, look[0] / sx)) * 0.0046 : 0;
  const gy = look ? Math.max(-1, Math.min(1, look[1] / sy)) * 0.0022 : 0;
  // the mouth: wider with a smile, its corners up (or down), the lower lip dropping as it opens
  const open = x.open, m = out.mouth, e = out.eye;
  m[0] = F.mouth.w * (1 + 0.14 * G.mouth * Math.max(0, x.smile) - 0.08 * G.mouth * Math.max(0, -x.smile) - 0.1 * open);
  m[0] *= 1 - Math.max(0, x.brow) * open * Math.max(0, 1 - x.smile) * 0.75;
  m[1] = x.smile * 0.0042 * G.mouth;
  m[2] = open * 0.017 * G.open;
  m[3] = open * (0.0026 + Math.max(0, x.brow) * Math.max(0, 1 - x.smile) * 0.008) * G.open;
  e[0] = close; e[1] = lower; e[2] = gx; e[3] = gy;
  return out;
}

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const v2 = (a) => `vec2(${f(a[0])}, ${f(a[1])})`;
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;

/** The shader: tripoFace(albedo, vBind) → albedo (sRGB, as his material holds it). */
export const TRIPO_FACE_GLSL = (() => {
  const F = TRIPO_FACE, P = F.paint, E = F.eye;
  return /* glsl */ `
  uniform vec4 uTfBrowA;   // the brow's inner end and its peak (x from the centre line, y)
  uniform vec4 uTfBrowB;   // its outer end, its thickness
  uniform vec4 uTfEye;     // the upper lid's close (0 open, 1 shut, < 0 wider), the lower lid's lift, the iris's offset (m)
  uniform vec4 uTfMouth;   // half its width, the corners' lift, the lower lip's drop, the upper lip's lift (m)
  float tfCover(float d, float w, float aa) { return 1.0 - smoothstep(w - 0.5 * aa, w + 0.5 * aa, d); }
  float tfOval(vec2 p, vec2 c, vec2 h) { return 1.0 - smoothstep(0.8, 1.0, length((p - c) / h)); }
  // the parabola through three points: its height and slope at x
  vec2 tfQuad(float x, vec2 a, vec2 b, vec2 c) {
    float da = (a.x - b.x) * (a.x - c.x), db = (b.x - a.x) * (b.x - c.x), dc = (c.x - a.x) * (c.x - b.x);
    float y = a.y * (x - b.x) * (x - c.x) / da + b.y * (x - a.x) * (x - c.x) / db + c.y * (x - a.x) * (x - b.x) / dc;
    float s = a.y * (2.0 * x - b.x - c.x) / da + b.y * (2.0 * x - a.x - c.x) / db + c.y * (2.0 * x - a.x - b.x) / dc;
    return vec2(y, s);
  }
  vec3 tripoFace(vec3 albedo, vec3 b, float aa) {
    // The imported portrait contains baked shading. Flatten skin-coloured texels on
    // the head and neck before drawing features; leave black hair and pale cloth alone.
    float neck = (1.0 - smoothstep(0.027, 0.038, abs(b.x))) * smoothstep(0.015, 0.035, b.z);
    float head = smoothstep(mix(1.545, 1.49, neck), mix(1.56, 1.515, neck), b.y) * (1.0 - smoothstep(1.72, 1.74, b.y));
    float warmSkin = smoothstep(0.055, 0.095, albedo.r - albedo.g)
      * smoothstep(0.025, 0.055, albedo.g - albedo.b) * smoothstep(0.16, 0.28, albedo.r);
    albedo = mix(albedo, ${v3(P.skin)}, head * warmSkin);
    if (b.z < ${f(F.front)} || b.y < 1.553 || b.y > 1.684 || abs(b.x - (${f(F.mid)})) > 0.072) return albedo;
    const vec3 INK = vec3(0.075, 0.058, 0.05);
    // 1. cover the paint: the skin round it, where a pixel isn't skin already
    vec2 xy = b.xy;
    float er = max(max(tfOval(xy, ${v2(P.eyes[0])}, ${v2(P.eyeHalf)}), tfOval(xy, ${v2(P.eyes[1])}, ${v2(P.eyeHalf)})),
      max(max(tfOval(xy, ${v2(P.brows[0])}, ${v2(P.browHalf)}), tfOval(xy, ${v2(P.brows[1])}, ${v2(P.browHalf)})), tfOval(xy, ${v2(P.mouth)}, ${v2(P.mouthHalf)})));
    // Do not paint skin over the black fringe at the edge of the brow region.
    float fringe = smoothstep(1.669, 1.681, b.y) * (1.0 - smoothstep(0.12, 0.28, albedo.r));
    albedo = mix(albedo, ${v3(P.skin)}, er * (1.0 - fringe));
    // Clear the old lip, smile creases and chin ink over the whole moving mouth.
    float mouthBase = tfOval(xy, vec2(${f(F.mid)}, 1.579), vec2(0.044, 0.025));
    albedo = mix(albedo, ${v3(P.skin)}, mouthBase);
    vec2 p = vec2(b.x - (${f(F.mid)}), b.y), q = vec2(abs(p.x), p.y);
    float side = sign(p.x);
    // 2. the brows: one thick stroke each, square at the inner end, tapering to a point
    vec2 I = uTfBrowA.xy, Pk = uTfBrowA.zw, O = uTfBrowB.xy;
    float asym = side * uTfBrowB.w * 0.0045;
    I.y += asym * 0.5; Pk.y += asym; O.y += asym * 0.7;
    if (q.x > I.x - 0.004 && q.x < O.x + 0.003 && abs(q.y - Pk.y) < 0.022) {
      float x = clamp(q.x, I.x, O.x);
      vec2 ys = tfQuad(x, I, Pk, O);
      float t = (x - I.x) / (O.x - I.x);
      float hw = ${f(F.brow.half)} * uTfBrowB.z * mix(0.9, 1.0, smoothstep(0.0, 0.3, t)) * (1.0 - 0.78 * smoothstep(0.55, 1.0, t));
      float d = length(vec2(q.x - x, (q.y - ys.x) / sqrt(1.0 + ys.y * ys.y)));
      if (q.x < I.x) d = max(abs(q.y - ys.x), (I.x - q.x) * 2.2);   // (the inner end cut square, a little rounded)
      albedo = mix(albedo, INK * 1.15, tfCover(d, max(hw, 0.6 * aa), aa));
    }
    // 3. the eyes: an almond of white, a large dark iris that follows the gaze, the upper lid a heavy line
    float u = (q.x - ${f(E.x)}) / ${f(E.w)}, v = q.y - ${f(E.y)};
    if (abs(u) < 1.25 && abs(v) < 0.011) {
      float s1 = max(1.0 - u * u, 0.0);
      float up0 = ${f(E.h)} * pow(s1, 0.55) + 0.0005 * u;
      float lo = -${f(E.h)} * 0.85 * pow(s1, 0.75) + 0.0004 * u + uTfEye.y * ${f(E.h)} * 0.55 * s1;
      float up = mix(up0, lo + 0.00015, uTfEye.x);
      float open = step(abs(u), 1.0) * smoothstep(lo - 0.5 * aa, lo + 0.5 * aa, v) * (1.0 - smoothstep(up - 0.5 * aa, up + 0.5 * aa, v));
      vec2 ic = vec2(${f(E.x)} + side * uTfEye.z, ${f(E.y)} - 0.0004 + uTfEye.w);
      float di = length(q - ic);
      vec3 eye = vec3(0.88, 0.83, 0.76);
      float iris = 1.0 - smoothstep(${f(E.iris)} - 0.5 * aa, ${f(E.iris)} + 0.5 * aa, di);
      vec3 irisCol = mix(vec3(0.15, 0.095, 0.065), INK, smoothstep(${f(E.iris * 0.55)}, ${f(E.iris * 0.85)}, di));
      irisCol = mix(irisCol, INK * 0.6, 1.0 - smoothstep(${f(E.iris * 0.4)} - 0.5 * aa, ${f(E.iris * 0.4)} + 0.5 * aa, di));
      eye = mix(eye, irisCol, iris);
      // a catchlight (the same side on both eyes), once there are pixels enough for it
      float hl = 1.0 - smoothstep(0.0011 - 0.5 * aa, 0.0011 + 0.5 * aa, length(vec2(p.x - side * ic.x, q.y - ic.y) - vec2(-0.0021, 0.0019)));
      eye = mix(eye, vec3(0.97, 0.95, 0.9), hl * (1.0 - smoothstep(0.0006, 0.0011, aa)));
      albedo = mix(albedo, eye, open);
      // the upper lid: heavier toward the outer corner, a flick past it; it comes down with the blink (a closed eye: one arc)
      float wl = mix(0.00075, 0.00125, smoothstep(-0.7, 0.9, u)) * smoothstep(-1.06, -0.86, u) * (1.0 - smoothstep(1.0, 1.2, u));
      float uc = clamp(u, -1.0, 1.0);
      float upc = mix(${f(E.h)} * pow(max(1.0 - uc * uc, 0.0), 0.55) + 0.0005 * uc, lo + 0.00015, uTfEye.x) - max(u - 1.0, 0.0) * 0.012;
      albedo = mix(albedo, INK, tfCover(abs(v - upc), max(wl, 0.55 * aa * step(0.0001, wl)), aa));
      // the lower lid: a fine line under the outer half, darker as a squint or a smile lifts it
      float wlo = 0.00032 * smoothstep(-0.3, 0.2, u) * (1.0 - smoothstep(0.85, 1.0, u));
      albedo = mix(albedo, INK, (0.3 + 0.5 * uTfEye.y) * tfCover(abs(v - lo), max(wlo, 0.5 * aa * step(0.0001, wlo)), aa));
    }
    // 4. the mouth: one line, its corners up or down; open, a dark shape under it (teeth at the top)
    float mw = uTfMouth.x, t = p.x / mw;
    if (abs(t) < 1.35 && abs(p.y - ${f(F.mouth.y)}) < 0.028) {
      float s2 = max(1.0 - t * t, 0.0);
      float line = ${f(F.mouth.y)} + uTfMouth.y * (t * t + uTfBrowB.w * t * 0.65) - 0.0003 * s2;
      float top = line + uTfMouth.w * pow(s2, 0.6), bot = line - uTfMouth.z * pow(s2, 0.7);
      float inside = step(0.0002, uTfMouth.z) * step(abs(t), 1.0) * smoothstep(bot - 0.5 * aa, bot + 0.5 * aa, p.y) * (1.0 - smoothstep(top - 0.5 * aa, top + 0.5 * aa, p.y));
      vec3 mc = mix(vec3(0.5, 0.2, 0.17), vec3(0.24, 0.08, 0.07), smoothstep(bot, top, p.y));
      mc = mix(mc, vec3(0.92, 0.88, 0.8), step(top - min(0.0042, (top - bot) * 0.4), p.y) * step(0.0035, top - bot) * step(abs(t), 0.78) * smoothstep(0.0, 0.002, uTfMouth.y));
      albedo = mix(albedo, mc, inside);
      float slope = uTfMouth.y * (2.0 * t + uTfBrowB.w * 0.65) / mw;
      float wm = mix(${f(0.0007 * TRIPO_GAIN.line)}, ${f(0.00035 * TRIPO_GAIN.line)}, abs(t)) * (1.0 - smoothstep(0.96, 1.06, abs(t)));
      vec3 lip = vec3(0.24, 0.12, 0.09);
      albedo = mix(albedo, lip, tfCover(abs(p.y - top) / sqrt(1.0 + slope * slope), max(wm, 0.55 * aa * step(0.0001, wm)), aa));
      // the open mouth's lower edge, finer
      albedo = mix(albedo, lip, step(0.0006, uTfMouth.z) * tfCover(abs(p.y - bot), max(wm * 0.6, 0.45 * aa * step(0.0001, wm)), aa));
      // the lower lip: a short stroke under the mouth, lowered as it opens
      float ll = 1.0 - smoothstep(0.25, 0.4, abs(p.x) / ${f(F.mouth.w)});
      albedo = mix(albedo, lip, 0.45 * ll * tfCover(abs(p.y - (bot - 0.0047 - 0.0002 * s2)), max(${f(0.0003 * TRIPO_GAIN.line)}, 0.45 * aa), aa));
    }
    return albedo;
  }
`;
})();

const SRGB_LINE = 'albedo=mix(albedo*12.92,1.055*pow(max(albedo,vec3(0.0)),vec3(1.0/2.4))-.055,step(vec3(.0031308),albedo));';

/**
 * Draw the face on `mesh` (his body, its material from tripo-material.js makeReviewInkMaterial): the
 * shader and its uniforms. Returns the face (a Humanoid's drawnFace). The uniforms are looked up on the
 * mesh's material each time: markHero gives the player copies of his materials (with copies of these).
 */
export function wearTripoFace(mesh) {
  const mat = mesh.material;
  if (!mat.fragmentShader.includes(SRGB_LINE)) throw new Error('tripo-face: the traveller material changed (no sRGB line to draw after)');
  Object.assign(mat.uniforms, {
    uTfBrowA: { value: new Vector4() }, uTfBrowB: { value: new Vector4(0, 0, 1, 0) }, uTfEye: { value: new Vector4() }, uTfMouth: { value: new Vector4(TRIPO_FACE.mouth.w, 0, 0, 0) },
  });
  const at = mat.fragmentShader.indexOf('void main()');
  mat.fragmentShader = mat.fragmentShader.slice(0, at) + TRIPO_FACE_GLSL + '\n  ' + mat.fragmentShader.slice(at);
  // (metres per pixel at the head: the derivatives taken out here, in uniform control flow)
  mat.fragmentShader = mat.fragmentShader.replace(SRGB_LINE, `${SRGB_LINE}\n albedo = tripoFace(albedo, vBind, max(fwidth(vBind.x) + fwidth(vBind.y), 1e-6) * 0.75);`);
  // The face repair must never draw skin or brows onto the actual hair surface.
  // A mesh-space scalp mask survives skinning and the garment split.
  if (mesh.geometry.attributes.travellerHair) {
    mat.vertexShader = mat.vertexShader.replace('out vec2 vTextureUV;', 'out vec2 vTextureUV;\nin float travellerHair; out float vTravellerHair; in float travellerSkin; out float vTravellerSkin;')
      .replace('vTextureUV = uv;', 'vTextureUV = uv; vTravellerHair = travellerHair; vTravellerSkin = travellerSkin;');
    mat.fragmentShader = mat.fragmentShader.replace('in vec2 vTextureUV;', 'in vec2 vTextureUV; in float vTravellerHair; in float vTravellerSkin;')
      .replace('albedo = tripoFace(albedo, vBind, max(fwidth(vBind.x) + fwidth(vBind.y), 1e-6) * 0.75);',
        'albedo = mix(albedo, vec3(0.72, 0.505, 0.37), smoothstep(0.15, 0.85, vTravellerSkin)); albedo = tripoFace(albedo, vBind, max(fwidth(vBind.x) + fwidth(vBind.y), 1e-6) * 0.75); albedo = mix(albedo, vec3(0.075, 0.058, 0.05), smoothstep(0.25, 0.65, vTravellerHair));');
  }
  mat.needsUpdate = true;
  const face = {
    mesh,
    expression: cleanExpression(NEUTRAL_EXPRESSION),
    blink: 0,
    look: null,
    _look: [0, 0],
    state: tripoFaceState(),
    set(e) { this.expression = cleanExpression(e ?? {}); this.push(); },
    eyes(blink = 0, squint = null, look = null) {
      this.blink = blink;
      if (squint != null && Math.abs(squint - this.expression.squint) > 1e-6) this.expression = { ...this.expression, squint };
      if (look) { this._look[0] = look.x ?? look[0]; this._look[1] = look.y ?? look[1]; }
      this.look = look ? this._look : null;
      this.push();
    },
    /** The middle of his face (between the eyes and the mouth, on its surface) in the world, through the head bone's skinning; null if it isn't his. */
    at(head, out) {
      const sk = mesh.skeleton, i = sk?.bones.indexOf(head) ?? -1;
      if (i < 0) return null;
      _m.multiplyMatrices(head.matrixWorld, sk.boneInverses[i]).multiply(mesh.bindMatrix).premultiply(mesh.bindMatrixInverse).premultiply(mesh.matrixWorld);
      return out.set(TRIPO_FACE.mid, TRIPO_FACE.centre[0], TRIPO_FACE.centre[1]).applyMatrix4(_m);
    },
    /** Which way his face looks (the world direction of the head's +z, through the same skinning); after at(). */
    facing(out) { return out.set(0, 0, 1).transformDirection(_m); },
    push() {
      const s = tripoFaceState(this.expression, { blink: this.blink, look: this.look }, this.state);
      const u = mesh.material.uniforms;
      if (!u?.uTfBrowA) return;
      u.uTfBrowA.value.set(s.brow[0], s.brow[1], s.brow[2], s.brow[3]);
      u.uTfBrowB.value.set(s.brow[4], s.brow[5], s.brow[6], s.brow[7]);
      u.uTfEye.value.set(...s.eye);
      u.uTfMouth.value.set(...s.mouth);
    },
  };
  face.push();
  return face;
}
