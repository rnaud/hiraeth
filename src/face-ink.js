// The people's faces drawn the way Moebius draws them (Arzach, The Airtight Garage, The Incal,
// Edena): a flat colour with one shadow tone and very few, precise interior lines, all placed by
// the face's own landmarks (materials.js uFace, moved by the face morphs, morph.js faceLandmarks)
// and bent by the expression (uMood, uMood2), in the head's rest (bind) coordinates, so they
// move with the skinned head:
//
//   eyes       the lash line along the top of the opening (the eyeball's: materials.js eyeball),
//              a fine crease over the lid, a flick at the outer corner, a tick under the outer
//              half of the lower lid and at the tear duct
//   nose       one line down the shadow side of the bridge ending in a hook round the wing, a
//              lighter hook on the lit side, two small dark nostrils
//   mouth      a single line (bending with the smile, opening into a dark shape) with a short
//              tick at each corner and a lower-lip tick; a small arc over the chin
//   ears       a single curl round the rim and a smaller one inside (on the side of the head)
//   hatching   sparse parallel strokes that follow the face: in the inner socket by the bridge,
//              under the brow's outer end, in the hollow under the cheekbone, a few along the
//              shadow's edge; the deep shade is left flat (no surface hatching on the face:
//              FACE_FLAT_GLSL)
//   age        bags, crow's feet, the folds from the nose to the mouth, a cheekbone line,
//              frown creases and lines across the forehead (uFaceKit.x and the expression)
//
// Line weights are in CSS pixels, so they stay constant on screen; a smaller face draws them
// finer, and its detail goes in three steps by its size on screen (FACE_LOD): the eyes and mouth
// first, the small marks next, the hatching and the age lines only up close, so a face across
// the street is two eyes, a nose hook and a mouth, never noise (and post.js thins a distant
// person's inner ink on top of that).

/** Detail by the face's height on screen (CSS px; the face is 0.2 m): [from, full]. */
export const FACE_LOD = {
  basic: [14, 26],    // the mouth, the nose's hook
  marks: [40, 70],    // the lid crease and ticks, nostrils, the corners, the lower lip, ears, folds
  fine: [90, 160],    // hatching, age lines, freckles
  weight: [20, 160],  // lines go from 0.55 of their weight to full over this range
};
/** Hatching is only drawn while its strokes are this many CSS px apart (closer: they'd be a grey smear). */
export const FACE_HATCH_PX = [3.5, 6];

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** The face's detail at a size on screen (CSS px tall), as the shader computes it (for tests and tools). */
export function faceDetail(facePx) {
  const L = FACE_LOD;
  return { basic: smooth(...L.basic, facePx), marks: smooth(...L.marks, facePx), fine: smooth(...L.fine, facePx), weight: 1.3 * (0.55 + 0.45 * smooth(...L.weight, facePx)) };
}

/**
 * Which side of the nose its line goes down (+1 the head's +x side): the shade's. `toward`: how much
 * the +x side faces the sun (-1..1); `prev`: the side now. A light from nearly in front keeps it.
 */
export function noseSide(toward, prev = 1) {
  if (Math.abs(toward) < 0.12) return prev >= 0 ? 1 : -1;
  return toward > 0 ? -1 : 1;
}

/** Where the ears sit (bind z of their centre, m), per body. */
export const EAR_Z = { m: -0.026, f: -0.036 };

const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));

/**
 * GLSL (inside materials.js, after inkLine / segDist). faceInk(q, fwq, frontal, dark, nb):
 * q = (|x|, y - eyeY) in bind space, fwq = metres per device pixel, frontal = how much the
 * surface faces forward, dark = the shade (0 lit .. 1), nb = the bind-space normal. Returns the
 * ink's coverage (0..1) for gHatch.b.
 */
export const FACE_INK_GLSL = /* glsl */ `
  // ---- pen strokes in metres; widths in CSS px
  // straight, from width w0 at a to w1 at b
  float fkSeg(vec2 p, vec2 a, vec2 b, float w0, float w1, float fwq) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return inkLine(length(p - a - ab * t) / fwq, mix(w0, w1, t));
  }
  // straight, swelling to w in the middle and lifting off at both ends
  float fkStroke(vec2 p, vec2 a, vec2 b, float w, float fwq) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
    return inkLine(length(p - a - ab * t) / fwq, w * (0.3 + 0.7 * sin(3.14159 * t)));
  }
  // along a parabola in a frame turned by ang round c (local y = k u^2, u = local x / h, |u| < 1),
  // w in the middle, taper * w at the ends
  float fkArc(vec2 p, vec2 c, float h, float k, float ang, float w, float taper, float fwq) {
    vec2 d = p - c;
    float cs = cos(ang), sn = sin(ang);
    vec2 l = vec2(cs * d.x + sn * d.y, -sn * d.x + cs * d.y);
    float u = clamp(l.x / h, -1.0, 1.0);
    float y = k * u * u, slope = 2.0 * k * u / h;
    float dist = abs(l.x / h) > 1.0 ? length(vec2(l.x - u * h, l.y - y)) : abs(l.y - y) / sqrt(1.0 + slope * slope);
    return inkLine(dist / fwq, w * mix(taper, 1.0, 1.0 - u * u));
  }
  // along an ellipse (centre c, radii r) from angle a0 to a1 (rad, a0 < a1), tapering at both ends
  float fkCurl(vec2 p, vec2 c, vec2 r, float a0, float a1, float w, float fwq) {
    vec2 d = (p - c) / r;
    float mid = 0.5 * (a0 + a1), hlf = 0.5 * (a1 - a0);
    float da = mod(atan(d.y, d.x) - mid + 3.14159, 6.28318) - 3.14159;
    float t = clamp(da / hlf, -1.0, 1.0), a = mid + t * hlf;
    float dist = length(p - c - r * vec2(cos(a), sin(a)));
    return inkLine(dist / fwq, w * mix(0.2, 1.0, 1.0 - t * t));
  }
  // parallel strokes across a patch (an ellipse: centre c, radii r) at angle ang, s apart: each a
  // lens, thinning to nothing at the patch's edge, its length its own; amount (0..1) how many
  float fkHatch(vec2 p, vec2 c, vec2 r, float ang, float s, float w, float amount, float fwq) {
    vec2 d = p - c;
    float cs = cos(ang), sn = sin(ang);
    float across = -sn * d.x + cs * d.y;
    float v = across / s, id = floor(v + 0.5);
    float h = fract(sin(id * 12.9898 + c.x * 311.7 + c.y * 157.3) * 43758.5453);
    float e = length(d / r);
    float len = 1.0 - smoothstep(0.45 + 0.4 * h, 1.0, e);
    return inkLine(abs(v - id) * s / fwq, w * len) * step(h * 0.9 + 0.05, amount) * step(0.04, len)
      * smoothstep(${f(FACE_HATCH_PX[0])}, ${f(FACE_HATCH_PX[1])}, s / fwq / uPixelRatio);
  }

  // short parallel strokes over the plane (dashes len long, s apart, at angle ang), each a tapered
  // lens with a gap after it, amount (0..1) of them drawn
  float fkDashes(vec2 p, float ang, float s, float len, float w, float amount, float fwq) {
    float cs = cos(ang), sn = sin(ang);
    float along = cs * p.x + sn * p.y, across = -sn * p.x + cs * p.y;
    float v = across / s, id = floor(v + 0.5);
    float a = (along + fract(sin(id * 7.13) * 4375.85) * len) / len, cell = floor(a);
    float h = fract(sin(id * 12.9898 + cell * 78.233) * 43758.5453);
    float lens = sin(3.14159 * clamp((fract(a) - 0.12) / 0.76, 0.0, 1.0));
    return inkLine(abs(v - id) * s / fwq, w * lens) * step(h, amount) * step(0.05, lens)
      * smoothstep(${f(FACE_HATCH_PX[0])}, ${f(FACE_HATCH_PX[1])}, s / fwq / uPixelRatio);
  }

  float faceInk(vec2 q, float fwq, float frontal, float dark, vec3 nb) {
    float e = uFace.y, ny = uFace.z - uFace.x, cy = uFace.w - uFace.x;
    // the expression (all 0, the kit at 1, 1, 0, 1: the face at rest)
    float smile = uMood.x, gape = uMood.y, brow = uMood.z, squint = uMood.w, tilt = uMood2.x;
    float lines = uFaceKit.x, es = uFaceKit2.x, nw = uFaceKit2.y, cheeks = uFaceKit2.z;
    float fs = max(smile, 0.0), sad = max(-smile, 0.0);
    // the side the nose line goes on: the shade's (uMood2.y: +1 the +x side; Humanoid.updateEyes)
    float sx = vBind.x < 0.0 ? -1.0 : 1.0;
    float shadeSide = smoothstep(-0.4, 0.4, sx * uMood2.y);
    // detail by the face's size on screen (FACE_LOD)
    float facePx = 0.2 / max(fwq * uPixelRatio, 1e-7);
    float lod1 = smoothstep(${f(FACE_LOD.basic[0])}, ${f(FACE_LOD.basic[1])}, facePx);
    float lod2 = smoothstep(${f(FACE_LOD.marks[0])}, ${f(FACE_LOD.marks[1])}, facePx);
    float lod3 = smoothstep(${f(FACE_LOD.fine[0])}, ${f(FACE_LOD.fine[1])}, facePx);
    float W = 1.3 * (0.55 + 0.45 * smoothstep(${f(FACE_LOD.weight[0])}, ${f(FACE_LOD.weight[1])}, facePx));   // (a pen of 1.3 CSS px up close)
    float m = 0.0;

    // ---- the eyes: the opening (centre E) is the eyeball's, with its lash line (MODE_EYE)
    vec2 E = vec2(e + 0.0008, -0.0035);
    float lift = 0.0025 * fs + 0.002 * squint;    // a smile or a squint pushes the lower lid up
    float lidDrop = 0.0032 * squint - 0.0012 * max(brow, 0.0);
    // the crease over the lid: a fine arch, lowered by a squint, lifted with the brow
    m = max(m, fkArc(q, E + vec2(0.0006, 0.0098 * es - lidDrop), 0.0128 * es, -0.0046 * es, -0.05, 0.7 * W * uFaceKit.w, 0.15, fwq) * lod2 * 0.9);
    // the flick at the outer corner, out and a little down
    vec2 oc = E + vec2(0.0118 * es, 0.0006 - lidDrop * 0.3);
    m = max(m, fkSeg(q, oc, oc + vec2(0.0042, -0.0016) * es, 1.25 * W * uFaceKit.w, 0.2 * W, fwq) * lod1);
    // the lower lid: a tick under its outer half; the tear duct
    m = max(m, fkArc(q, E + vec2(0.0042 * es, -0.0072 * es + lift), 0.0062 * es, 0.0016, 0.12, 0.65 * W, 0.1, fwq) * lod2 * 0.85);
    m = max(m, fkSeg(q, E + vec2(-0.0118 * es, 0.0004), E + vec2(-0.0142 * es, -0.0012), 0.7 * W, 0.2 * W, fwq) * lod2 * 0.8);
    // age: bags under the eyes, crow's feet at the outer corners (squinting and smiling deepen both)
    float age = clamp(lines - 0.5, 0.0, 1.5);
    m = max(m, fkArc(q, E + vec2(0.0035, -0.0118 * es + lift), 0.0085 * es, 0.0022, 0.1, 0.55 * W, 0.1, fwq) * lod3 * min(0.35 * lines + 0.35 * fs + 0.3 * squint, 1.0));
    float crow = min(age * 0.6 + fs * 0.5 + squint * 0.5, 1.0) * lod3;
    vec2 cf = E + vec2(0.0175 * es, 0.0005);
    m = max(m, fkStroke(q, cf, cf + vec2(0.0072, 0.0032), 0.55 * W, fwq) * crow);
    m = max(m, fkStroke(q, cf + vec2(0.0004, -0.0018), cf + vec2(0.0068, -0.0055), 0.55 * W, fwq) * crow * 0.85);

    // ---- the nose (its marks scaled by the nose's width)
    vec2 n = vec2(q.x / nw, q.y);
    // the line down the shadow side of the bridge, from under the brow to the wing
    float bridge = fkSeg(n, vec2(0.0085, 0.38 * ny), vec2(0.0112, 0.76 * ny), 0.15 * W, 0.8 * W, fwq);
    bridge = max(bridge, fkSeg(n, vec2(0.0112, 0.76 * ny), vec2(0.0142, ny + 0.0008), 0.8 * W, 1.0 * W, fwq));
    m = max(m, bridge * shadeSide * lod2);
    // the hook round the wing, into the nostril (the lit side's lighter and shorter)
    vec2 wing = vec2(0.0152, ny - 0.0052);
    m = max(m, fkCurl(n, wing, vec2(0.0052, 0.0056), -2.5, mix(0.35, 1.45, shadeSide), 1.1 * W, fwq) * mix(0.6, 1.0, shadeSide) * lod1);
    // the nostrils: two small dark commas
    vec2 nd = n - vec2(0.0074, ny - 0.0104);
    nd = mat2(0.94, 0.34, -0.34, 0.94) * nd / vec2(0.0029, 0.0012);
    float nAA = fwq / 0.0012;
    m = max(m, (1.0 - smoothstep(1.0 - nAA, 1.0 + nAA, length(nd))) * mix(0.75, 1.0, shadeSide) * lod2);

    // ---- the mouth: one line whose corners rise with a smile (drop when sad), opening into a dark shape
    float my = ny + (cy - ny) * 0.42;
    float hw = 0.019 * uFaceKit.y * (1.0 + 0.1 * smile);
    float mu = min(q.x / hw, 1.0), bend = smile * 0.0075;
    float mSlope = (0.002 + 2.0 * bend * mu) / hw;
    vec2 mEnd = vec2(hw, my + 0.002 + bend);
    float dMouth = q.x < hw ? abs(q.y - (my + 0.002 * mu + bend * mu * mu - 0.0006 * (1.0 - smoothstep(0.0, 0.3, mu)))) / sqrt(1.0 + mSlope * mSlope) : length(q - mEnd);
    m = max(m, inkLine(dMouth / fwq, (1.25 - 0.5 * mu * mu) * (1.0 + 0.35 * abs(smile)) * W) * lod1);
    // the corners: a short tick, down at rest, up with a smile
    m = max(m, fkSeg(q, mEnd - vec2(0.0004, 0.0), mEnd + vec2(0.0024, -0.0018 + 0.0042 * fs - 0.0016 * sad), 0.8 * W, 0.2 * W, fwq) * lod2);
    float oh = gape * 0.0085;
    if (gape > 0.001) {
      vec2 o = (q - vec2(0.0, my + smile * 0.0012 - oh * 0.85)) / vec2(hw * (0.78 - 0.18 * gape), oh);
      m = max(m, 1.0 - smoothstep(1.0 - fwq / oh, 1.0 + fwq / oh, length(o)));
    }
    // the lower lip: a short arc under the middle of the mouth
    m = max(m, fkArc(q, vec2(0.0, my - 0.0078 - oh * 1.8), 0.0066 * uFaceKit.y, 0.0013, 0.0, 0.8 * W, 0.12, fwq) * lod2 * 0.85);
    // over the chin
    m = max(m, fkArc(q, vec2(0.0, cy + 0.0125), 0.0072, 0.0011, 0.0, 0.6 * W, 0.15, fwq) * lod3 * (0.35 + 0.35 * min(lines, 1.0)));
    // the folds from the nose to the mouth (age, a smile)
    m = max(m, fkStroke(q, vec2(0.0205 + 0.002 * fs, ny - 0.0025), vec2(0.0335 + 0.006 * fs, ny - 0.038 + 0.006 * fs), 0.8 * W, fwq) * lod2 * min(0.75 * max(lines - 0.4, 0.0) + 0.5 * fs, 1.0));
    // the cheekbone (a lined face)
    m = max(m, fkStroke(q, vec2(0.044, -0.019), vec2(0.062, -0.034), 0.75 * W, fwq) * lod3 * min(age * 0.7, 1.0));

    // ---- the brow: frown creases between the brows; lines across the forehead when raised or worried
    float fur = max(-brow, 0.0) + max(-tilt, 0.0) * 0.5;
    m = max(m, fkStroke(q, vec2(0.0068, 0.012), vec2(0.0045, 0.030), 0.8 * W, fwq) * min(fur * 1.2, 1.0) * lod2);
    float up = max(brow, 0.0) + max(tilt, 0.0) * 0.6;
    for (int i = 0; i < 3; i++) {
      float wd = 0.034 - float(i) * 0.005 - max(tilt, 0.0) * 0.012;
      m = max(m, fkArc(q, vec2(0.0, 0.045 + float(i) * 0.0075), wd, -0.003, 0.0, 0.7 * W, 0.1, fwq) * min(up * (1.2 - float(i) * 0.3), 1.0) * lod2 * 0.8);
    }

    // ---- hatching that follows the face (the deep shade itself stays flat)
    float shade = smoothstep(0.02, 0.2, dark);
    // the inner socket, between the eye and the bridge
    m = max(m, fkHatch(q, vec2(0.0158, -0.0015), vec2(0.0048, 0.0075), 1.25, 0.0017, 0.55 * W, 0.35 + 0.25 * lines + 0.5 * shade, fwq) * lod3 * 0.75);
    // under the outer end of the brow
    m = max(m, fkHatch(q, vec2(e + 0.0105, 0.0098), vec2(0.0075, 0.0032), -0.75, 0.0017, 0.5 * W, 0.15 + 0.2 * lines + 0.6 * shade, fwq) * lod3 * 0.7);
    // the hollow under the cheekbone (hollow cheeks: more)
    float hollow = clamp(0.35 - 0.45 * cheeks, 0.0, 1.0);
    m = max(m, fkHatch(q, vec2(0.0505, -0.056), vec2(0.0105, 0.0165), -1.0, 0.0024, 0.55 * W, 0.2 * lines + 0.6 * hollow + 0.6 * shade, fwq) * lod3 * 0.75);
    // under the lower lip
    m = max(m, fkHatch(q, vec2(0.0, my - 0.0125 - oh * 1.8), vec2(0.008, 0.0028), 0.0, 0.0015, 0.5 * W, 0.4 + 0.5 * shade, fwq) * lod3 * 0.6);

    // freckles: a dusting of dots over the cheeks and the bridge of the nose (seeded by the real x: not mirrored)
    if (uFaceKit.z > 0.0) {
      vec2 fc = vec2(vBind.x, q.y) / 0.0042, id = floor(fc), fr = fract(fc) - 0.5;
      float h = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
      vec2 jit = vec2(fract(h * 17.0), fract(h * 31.0)) - 0.5;
      float region = exp(-pow((q.x - 0.043) / 0.022, 2.0) - pow((q.y + 0.017) / 0.012, 2.0)) + 0.7 * exp(-pow(q.x / 0.01, 2.0) - pow((q.y + 0.014) / 0.01, 2.0));
      float dotK = 1.0 - smoothstep(0.1, 0.1 + max(fwq / 0.0042, 0.05), length(fr - jit * 0.5));
      m = max(m, dotK * step(1.0 - uFaceKit.z * min(region, 1.0) * 0.8, h) * lod3 * 0.6);
    }
    m *= frontal;

    // a few strokes along the shadow's edge, over the whole head (deeper in, the shade is flat)
    float edge = smoothstep(0.02, 0.07, dark) * (1.0 - smoothstep(0.14, 0.24, dark));
    m = max(m, fkDashes(vec2(vBind.x, q.y), 0.62, 0.0028, 0.012, 0.5 * W, 0.55, fwq) * edge * lod3 * 0.7);

    // ---- the ear: a curl round the rim, a smaller one inside (on the side of the head)
    float earK = smoothstep(0.056, 0.066, q.x) * smoothstep(0.35, 0.65, abs(nb.x)) * lod2;
    if (earK > 0.0) {
      vec2 ep = vec2(vBind.z - uFaceKit2.w, q.y + 0.008);
      float ear = fkCurl(ep, vec2(-0.001, 0.0), vec2(0.0105, 0.0195), 1.15, 4.55, 1.0 * W, fwq);
      ear = max(ear, fkCurl(ep, vec2(0.0015, -0.002), vec2(0.0055, 0.0095), 1.7, 4.4, 0.75 * W, fwq) * 0.85);
      m = max(m, ear * earK);
    }
    return m;
  }
`;

/**
 * GLSL: how much of the surface hatching a person's skin keeps (materials.js, MODE_OUTFIT): none on
 * the head above the chin (the face is flat colour and one shadow tone; its own strokes are
 * faceInk's), all of it down the neck.
 */
export const FACE_FLAT_GLSL = /* glsl */ `
  float faceFlat(vec3 b) {
    return abs(b.x) < 0.16 && b.y > uOutfit.z ? smoothstep(uFace.w - 0.03, uFace.w - 0.005, b.y) : 0.0;
  }
`;
