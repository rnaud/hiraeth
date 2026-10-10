// The traveller's face drawn in ink over his generated head (src/characters/tripo-head.js).
//
// The Tripo head came with a face painted the way a 3D render paints one: big almond eyes wide open,
// a whole round iris ringed by a bright white and a soft catchlight, a dark lash line all the way round,
// a rosy rounded nose tip and coloured lips, with no line anywhere. Next to the sheets
// (references/main character/) that read as a toy or an anime figure. The sheets draw him the Moebius way: smaller, narrower
// eyes whose heavy upper lid cuts the top of a flat dark iris, a crease over the lid, hardly any lower lid,
// a cream white, no shine; a strong straight nose told by one line down its side and a hook round the
// wing; a mouth that is one line and a short stroke under the lower lip; one flat skin colour.
//
// So the head's fragment shader covers the painted eyes, evens out the paint's rosy nose and lips, and
// draws those features again in its rest coordinates (the source export's, `hb`). The face's shape keys
// move the skin under them (a blink folds the lids shut, a smile lifts the corners, raised brows stretch
// the lids), and as the drawing is in rest coordinates it rides them as the paint did. The gaze moves only
// the drawn iris (uHeadEye.zw), so the lids stay where they are.
//
//   HEAD_INK                   the measures (source units: the export's metres before HEAD_FIT.scale)
//   headInkState(e, opts, out) the uniforms for an expression, the blink and the look (pure)
//   headSide(rel)              the camera's side of his face (uHeadSide: the nose's line on the side turned away)
//   HEAD_INK_GLSL              headInk(albedo, hb, ha) → albedo (sRGB, as the material holds it)

/**
 * Measured off a front orthographic render of the export's texture (1 px = 0.00025): the painted eyes'
 * openings span x 0.058..0.145 from the centre line, y 0.577..0.612 (0.087 by 0.035, a whole iris of radius
 * 0.016 inside), the brows' lower edge at y 0.645, the nose's wings at x ±0.049 over y 0.45..0.49, the
 * mouth's line at y 0.3955 between x ±0.077.
 */
export const HEAD_INK = Object.freeze({
  mid: -0.001,                                         // the face's centre line (x)
  front: 0.15,                                         // drawn only in front of this z
  skin: [0.81, 0.515, 0.345],                          // the cheek's paint (sRGB): every skin pixel takes its hue
  flatten: 0.4,                                        // how much of the paint's baked light and shade is evened out
  painted: { x: 0.1005, y: 0.5945, w: 0.049, h: 0.0195 },   // the painted eye, covered
  // the drawn eye: centre, half width, the upper and lower lid's height over and under the centre, the iris
  eye: { x: 0.0995, y: 0.5935, w: 0.0405, up: 0.0134, lo: 0.0108, iris: 0.0136, irisY: 0.0006 },
  gaze: { x: 0.0075, y: 0.003 },                       // how far the iris goes at the eyes' reach
  squeeze: 0.3,                                        // the blink shape key's share as the drawn lids shut
  nose: { bridge: [[0.021, 0.548], [0.0305, 0.49]], wing: [0.0395, 0.4695, 0.0125], nostril: [0.0215, 0.4585, 0.0062, 0.0025] },
  mouth: { y: 0.3955, w: 0.066, lip: 0.3738 },
});

/**
 * The face from afar (ink-lines v1.33: "the character's eyes render almost like black eyes when looking at him from
 * afar"). Under a pixel a line was drawn a pixel wide in full ink, and once the eye's opening was a pixel or two tall
 * it was one dark mark: at 10 m the eyes were black dots. Now a stroke drawn wider than itself carries its coverage
 * (hiStroke: its width over the drawn width, lifted by `keep` so it still reads), and between `eye[0]` and `eye[1]`
 * (ha, source units a pixel: the opening ~6 px tall to ~2.7 px) the opening turns to one `tone`, the cream white and
 * the dark iris mixed as they share it (the iris about 45 % of the opening).
 */
export const HEAD_INK_FAR = Object.freeze({ keep: 0.35, from: [0.003, 0.006], eye: [0.0045, 0.009], tone: [0.3, 0.18, 0.13] });

/** The drawn eye's size against the painted one (width × height of the opening; the iris's radius). */
export const EYE_CHANGE = Object.freeze({
  width: (2 * HEAD_INK.eye.w) / 0.087, height: (HEAD_INK.eye.up + HEAD_INK.eye.lo) / 0.035, iris: HEAD_INK.eye.iris / 0.016,
});

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

/**
 * The head's shape-key weights and drawn-face uniforms for an expression (clean: expression.js), the blink
 * (0..1) and the look (a direction's [x, y], +z ahead; null straight ahead). Into `out`: no garbage a frame.
 *   keys:   blink, smile, brow, browTilt, asymmetry, open (tripo-head.js HEAD_KEYS)
 *   eye:    the lower lid's lift (a smile's cheek, a squint), the lids (-1 shut .. 0 open .. 1 wide: raised brows),
 *           the iris's offset x, y (source units)
 *   speech: the mouth's opening, the smile (the teeth show on a wide open smile)
 */
export function headInkState(e, { blink = 0, look = null } = {}, out = { keys: new Array(6), eye: new Array(4), speech: new Array(2) }) {
  const k = out.keys;
  // the lids are drawn shut (eye[1]); the shape key only gathers the skin round the eye a little with them
  // (folded all the way, the drawn lid had no height left to be drawn in: a closed eye was a faint broken line)
  const shut = Math.min(1, Math.max(blink, e.squint * 0.45));
  const wide = Math.min(1, Math.max(0, (e.brow - 0.4) / 0.6)) * (1 - blink);   // raised brows open the eyes wide (a gasp)
  k[0] = HEAD_INK.squeeze * shut;
  k[1] = e.smile; k[2] = e.brow; k[3] = e.browTilt; k[4] = e.asymmetry; k[5] = e.open;
  const G = HEAD_INK.gaze;
  out.eye[0] = Math.min(1, Math.max(0, e.smile) * 0.55 + Math.max(0, e.squint) * 0.35);
  out.eye[1] = wide - shut;
  out.eye[2] = look ? clamp1(look[0] / 0.3) * G.x : 0;
  out.eye[3] = look ? clamp1(look[1] / 0.2) * G.y : 0;
  out.speech[0] = e.open; out.speech[1] = e.smile;
  return out;
}

/** Which side of his face a camera is on: `rel` its position from the face's middle in rest space; + his left, -1..1. */
export function headSide(rel) {
  const d = Math.hypot(rel.x, rel.y, rel.z);
  return d > 1e-6 ? Math.max(-1, Math.min(1, rel.x / d)) : 0;
}

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const v2 = (a) => `vec2(${f(a[0])}, ${f(a[1])})`;
const v3 = (a) => `vec3(${a.map(f).join(', ')})`;

export const HEAD_INK_GLSL = (() => {
  const H = HEAD_INK, P = H.painted, E = H.eye, N = H.nose, M = H.mouth;
  return /* glsl */ `
  uniform vec4 uHeadEye;   // the lower lid's lift, the lids (-1 shut, 1 wide), the iris's offset (source units)
  uniform float uHeadSide; // the camera's side of his face (headSide: + his left)
  float hiLine(float d, float w, float aa) { return step(1e-7, w) * (1.0 - smoothstep(w - 0.5 * aa, w + 0.5 * aa, d)); }
  // a stroke of its own width w that is never drawn under wMin (about a pixel): drawn that wide, it carries what it
  // would have covered (w / wMin, lifted a little toward 1 by HEAD_INK_FAR.keep so it still reads): a lid 0.3 px
  // thick is a pale pixel, not a black one (the eyes read as black sockets from afar: ink-lines v1.33)
  float hiStroke(float d, float w, float wMin, float aa) {
    float wd = max(w, wMin);
    return mix(clamp(w / max(wd, 1e-7), 0.0, 1.0), 1.0, mix(1.0, ${f(HEAD_INK_FAR.keep)}, smoothstep(${f(HEAD_INK_FAR.from[0])}, ${f(HEAD_INK_FAR.from[1])}, aa))) * hiLine(d, wd, aa);
  }
  float hiSeg(vec2 p, vec2 a, vec2 b, out float t) { vec2 ab = b - a; t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); return length(p - a - ab * t); }
  float hiLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
  vec3 headInk(vec3 albedo, vec3 hb, float ha) {
    const vec3 SKIN = ${v3(H.skin)};
    const vec3 INK = vec3(0.075, 0.055, 0.045);
    float warm = smoothstep(0.05, 0.09, albedo.r - albedo.g) * smoothstep(0.02, 0.05, albedo.g - albedo.b) * smoothstep(0.3, 0.45, albedo.r);
    vec2 p = vec2(hb.x - (${f(H.mid)}), hb.y), q = vec2(abs(p.x), p.y);
    bool face = hb.z > ${f(H.front)} && q.x < 0.16 && q.y > 0.34 && q.y < 0.64;
    // 1. the painted eyes covered: the white, the iris and the lashes (anything not skin round them), and the whole opening
    if (face) {
      vec2 e = (q - ${v2([P.x, P.y])}) / ${v2([P.w, P.h])};
      float r = length(e);
      float cover = max(1.0 - smoothstep(0.9, 1.05, r), (1.0 - warm) * (1.0 - smoothstep(1.15, 1.45, r)));
      vec3 fill = mix(vec3(0.81, 0.5, 0.34), vec3(0.8, 0.455, 0.3), smoothstep(${f(P.y - 0.006)}, ${f(P.y + 0.012)}, q.y));
      albedo = mix(albedo, fill, cover);
      warm = max(warm, cover);
    }
    // 2. one skin colour: the paint's rosy nose, lips and lids take the cheek's hue, its baked shading evened out
    float lr = hiLum(albedo) / hiLum(SKIN);
    albedo = mix(albedo, SKIN * mix(clamp(lr, 0.55, 1.25), 1.0, ${f(H.flatten)}), 0.92 * warm);
    if (!face) return albedo;
    // the detail by the face's size on screen (ha: source units a pixel; the face is about 0.45 tall):
    // the white of the eye and the lid's crease from about 110 px, the nose's lines from 75 px
    float fine = 1.0 - smoothstep(0.0028, 0.0042, ha), mid = 1.0 - smoothstep(0.0045, 0.0065, ha);
    // 3. the eyes: a narrow almond, the heavy upper lid cutting the top of a flat dark iris, a crease over it
    float u = (q.x - ${f(E.x)}) / ${f(E.w)}, v = q.y - ${f(E.y)};
    if (abs(u) < 1.3 && v > -0.02 && v < 0.026) {
      float uc = clamp(u, -1.0, 1.0), s = max(1.0 - uc * uc, 0.0);
      float wide = 1.0 + 0.4 * max(uHeadEye.y, 0.0), shut = max(-uHeadEye.y, 0.0);
      float up = ${f(E.up)} * wide * pow(s, 0.5) * (1.0 - 0.14 * uc);
      float lo = -${f(E.lo)} * (1.0 + 0.25 * max(uHeadEye.y, 0.0)) * pow(s, 0.75) * (1.0 + 0.12 * uc) + uHeadEye.x * ${f(E.lo * 0.6)} * s;
      float up0 = up;
      up = mix(up, lo + 0.0002, shut);   // (the blink: the upper lid down onto the lower)
      float inside = step(abs(u), 1.0) * smoothstep(lo - 0.5 * ha, lo + 0.5 * ha, v) * (1.0 - smoothstep(up - 0.5 * ha, up + 0.5 * ha, v));
      // the white: cream, shaded under the lid; far off, the opening is one dark mark with the iris
      vec3 white = mix(vec3(0.88, 0.82, 0.73), vec3(0.76, 0.66, 0.56), smoothstep(up - 0.0045, up - 0.0008, v));
      white = mix(vec3(0.42, 0.27, 0.2), white, fine);
      vec2 ic = vec2(${f(E.x)} + clamp(sign(p.x) * uHeadEye.z, -0.012, 0.012), ${f(E.y + E.irisY)} + uHeadEye.w);
      float di = length(q - ic);
      vec3 iris = mix(vec3(0.17, 0.1, 0.065), vec3(0.09, 0.06, 0.045), smoothstep(${f(E.iris * 0.62)}, ${f(E.iris * 0.92)}, di));
      iris = mix(iris, vec3(0.05, 0.035, 0.03), 1.0 - smoothstep(${f(E.iris * 0.42)} - 0.5 * ha, ${f(E.iris * 0.42)} + 0.5 * ha, di));
      iris *= mix(1.0, 0.75, smoothstep(up - 0.0045, up - 0.0008, v));
      float ir = max(${f(E.iris)}, 1.2 * ha);
      vec3 eye = mix(white, iris, 1.0 - smoothstep(ir - 0.5 * ha, ir + 0.5 * ha, di));
      // further off, once the opening is a pixel or two tall: one tone, the cream and the iris as they share it
      // (HEAD_INK_FAR), so the eye lays on the face the dark it would at any size, not a black mark
      eye = mix(eye, ${v3(HEAD_INK_FAR.tone)}, smoothstep(${f(HEAD_INK_FAR.eye[0])}, ${f(HEAD_INK_FAR.eye[1])}, ha));
      albedo = mix(albedo, eye, inside);
      // the upper lid: one heavy stroke, finer at the inner corner, a little past the outer one
      float ue = clamp(u, -0.97, 1.12);
      float upl = ${f(E.up)} * wide * pow(max(1.0 - min(ue * ue, 1.0), 0.0), 0.5) * (1.0 - 0.14 * min(ue, 1.0));
      upl = mix(upl, lo + 0.0002, shut) - max(ue - 1.0, 0.0) * 0.022;
      float wl = mix(0.0011, 0.0021, smoothstep(-0.9, 0.3, u)) * (1.0 - 0.45 * smoothstep(0.9, 1.12, u));
      float onLid = smoothstep(-1.05, -0.92, u) * (1.0 - smoothstep(1.08, 1.16, u));
      albedo = mix(albedo, INK, onLid * hiStroke(abs(v - upl), wl, 0.85 * ha, ha));
      // the crease over the lid, fine, from the inner third out past the corner
      float cr = mix(up0, lo, 0.5 * shut) + 0.0062 - 0.0012 * uc * uc + 0.0008 * uc;
      float onCrease = smoothstep(-0.6, -0.35, u) * (1.0 - smoothstep(0.95, 1.08, u)) * fine;
      albedo = mix(albedo, INK, 0.75 * onCrease * hiStroke(abs(v - cr), 0.00075, 0.6 * ha, ha));
      // the lower lid: a light broken line under the outer half only
      float onLower = smoothstep(-0.15, 0.1, u) * (1.0 - smoothstep(0.8, 0.98, u)) * fine;
      albedo = mix(albedo, INK, (0.45 + 0.35 * uHeadEye.x) * onLower * hiStroke(abs(v - lo), 0.0006, 0.45 * ha, ha));
    }
    // 4. the nose: one line down its side into a hook round the wing (darker on the side turned away), the nostrils
    float t;
    float away = mix(0.22, 1.0, smoothstep(0.08, 0.4, -sign(p.x) * uHeadSide)) * smoothstep(-0.3, -0.08, -sign(p.x) * uHeadSide);
    float dB = hiSeg(q, ${v2(N.bridge[0])}, ${v2(N.bridge[1])}, t);
    float wb = mix(0.0006, 0.00115, t);
    albedo = mix(albedo, INK, 0.8 * away * mid * smoothstep(0.0, 0.25, t) * hiStroke(dB, wb, 0.5 * ha, ha));
    vec2 w = q - ${v2(N.wing)};
    float ang = atan(w.y, w.x);
    float onWing = smoothstep(-1.85, -1.55, ang) * (1.0 - smoothstep(1.55, 1.85, ang));
    float ww = mix(0.0013, 0.0006, smoothstep(-1.2, 1.4, ang));
    albedo = mix(albedo, INK, 0.85 * mid * onWing * hiStroke(abs(length(w) - ${f(N.wing[2])}), ww, 0.55 * ha, ha));
    vec2 nn = (q - ${v2(N.nostril)}) / ${v2(N.nostril.slice(2))};
    float nr = length(vec2(nn.x * 0.95 + nn.y * 0.3, nn.y));
    albedo = mix(albedo, vec3(0.3, 0.15, 0.1), 0.8 * mid * (1.0 - smoothstep(1.0 - 0.6 * ha / ${f(N.nostril[3])}, 1.0 + 0.6 * ha / ${f(N.nostril[3])}, nr)));
    // 5. the mouth: one line, finer toward the corners, and a short stroke under the lower lip
    float mt = p.x / ${f(M.w)};
    if (abs(mt) < 1.1 && abs(p.y - ${f(M.y)}) < 0.03) {
      float my = ${f(M.y)} - 0.0007 * (1.0 - mt * mt);
      float wm = mix(0.0015, 0.0007, abs(mt)) * (1.0 - 0.5 * smoothstep(0.9, 1.04, abs(mt)));
      albedo = mix(albedo, vec3(0.2, 0.1, 0.075), (1.0 - smoothstep(0.94, 1.05, abs(mt))) * hiStroke(abs(p.y - my), wm, 0.6 * ha, ha));
      float wlip = 0.001 * (1.0 - 0.5 * smoothstep(0.1, 0.36, abs(mt)));
      albedo = mix(albedo, vec3(0.3, 0.15, 0.1), 0.5 * fine * (1.0 - smoothstep(0.22, 0.38, abs(mt))) * hiStroke(abs(p.y - ${f(M.lip)}), wlip, 0.7 * ha, ha));
    }
    return albedo;
  }
`;
})();
