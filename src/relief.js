// Painted relief (issue #696): a surface's marks drawn raised or engraved without normal maps. Beside a mark's ink line, a
// thin lighter line on the side that faces the sun and a thin darker one (never ink: a tone of the surface's own colour)
// on the side turned from it, oriented by the sun's way across the face, so they agree with the cast shadows. Still flat
// colour, Moebius's pen-and-wash bevel: a flagstone's edge catching the light, a rivet's shadow, a groove's lit far lip.
//
// One switch: the shared uRelief (materials.js sharedUniforms; 1 on, the default since the author picked it, 0 off), set
// at run time by ?relief=0 or the dev panel's "painted relief" (main.js), and in the Unity port by the same shared value
// (_Relief, HiraethLook.cs). Off, every pattern draws exactly what it drew before (the flat marks). RELIEF_GLSL is included by the surface shader before every
// pattern (materials.js); scripts/unity-export/marks-hlsl.mjs writes its HLSL at the head of SurfaceMarks.hlsl.
//
//   reliefEdge(dpx, g, sun2, inkW)  the signed relief beside an edge: + lit, - shaded, 0 away from it. dpx: px from the
//                                   mark's edge (or its line's middle) on this side; g: the way the nearest slope faces in
//                                   the face's own frame (out of a raised thing: a stone's edge, a rivet's flank; back into
//                                   an engraved one: toward the groove); sun2: the sun's way in that frame (its length the
//                                   share of the sun across the face: 0 head on); inkW: the mark's ink line (CSS px), the
//                                   band starts just past it.
//   reliefTone(alb, r)              the albedo with relief r: lighter (under a ceiling: a channel over ~0.9 prints as
//                                   specks), or darker; nothing while uRelief is 0.
//   reliefFrameSun(wdx, wdy, odx, ody, sun)  the sun's way across the face in another frame (an object's own, a room's),
//                                   from the two frames' screen derivatives: for patterns drawn in object space.
// Users (each the edge it knows): paving's stones (raised), sheet metal's panels and rivets (raised), pale stone's blocks (raised), the buried city's wind bands (engraved), the sea walls' repaired patches
// (raised), a rock top's fissures (engraved, at half strength), the interiors' floor tiles (raised), the makers' machined finish (its inlaid
// border and sockets engraved, its set-back panels' lips).

/** light, dark: the strongest lift and darkening (a share of the colour), most: and at most this much of a channel (on a
 *  pale wall a share of its colour stepped over a ramp was inked by post.js as a second, dashed line); width: the band's full part (CSS px), from one
 *  ramp past the ink line's half; soft: each ramp (device px: a step from one px to the next under post.js's colour-edge
 *  threshold, so the band is never inked as a line of its own); ceiling: a
 *  lifted channel's top; grazing: the sun's share across a face at which the relief is full. */
export const RELIEF = { light: 0.16, dark: 0.16, most: 0.065, width: 0.8, soft: 2.0, ceiling: 0.9, grazing: 0.45 };

const f = (v) => (Number.isInteger(v) ? `${v}.0` : `${+v.toFixed(5)}`);
const R = RELIEF;

export const RELIEF_GLSL = /* glsl */ `
  // ---------------------------------------------------------------- painted relief (src/relief.js RELIEF, issue 696)
  float reliefEdge(float dpx, vec2 g, vec2 sun2, float inkW) {
    float a = 0.5 * inkW * uPixelRatio, w = ${f(R.width)} * uPixelRatio;
    float band = smoothstep(a - 0.2, a + ${f(R.soft)}, dpx) * (1.0 - smoothstep(a + ${f(R.soft)} + w, a + ${f(2 * R.soft)} + w, dpx));
    return band * clamp(dot(g, sun2) / ${f(R.grazing)}, -1.0, 1.0);
  }
  vec3 reliefTone(vec3 alb, float r) {
    float k = uRelief * r;
    if (k > 0.0) return max(alb, min(alb + min(alb * ${f(R.light)}, vec3(${f(R.most)})) * k, vec3(${f(R.ceiling)})));
    return alb + min(alb * ${f(R.dark)}, vec3(${f(R.most)})) * k;
  }
  vec3 reliefFrameSun(vec3 wdx, vec3 wdy, vec3 odx, vec3 ody, vec3 sun) {
    float a = dot(wdx, wdx), b = dot(wdx, wdy), c = dot(wdy, wdy), det = a * c - b * b;
    if (det <= 1e-6 * a * c) return vec3(0.0);
    float sx = dot(wdx, sun), sy = dot(wdy, sun);
    float u = (c * sx - b * sy) / det, v = (a * sy - b * sx) / det;
    vec3 w = u * wdx + v * wdy, o = u * odx + v * ody;
    return o * (length(w) / max(length(o), 1e-12));
  }
`;

// The same in JavaScript, for the tests (tests/relief.test.js): one device px a CSS px unless said.
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
/** reliefEdge in doubles. */
export function reliefEdge(dpx, g, sun2, inkW, pixelRatio = 1) {
  const a = 0.5 * inkW * pixelRatio, w = R.width * pixelRatio;
  const band = smooth(a - 0.2, a + R.soft, dpx) * (1 - smooth(a + R.soft + w, a + 2 * R.soft + w, dpx));
  return band * Math.min(Math.max(dot(g, sun2) / R.grazing, -1), 1);
}
/** reliefTone in doubles (on: uRelief). */
export function reliefTone(alb, r, on = 1) {
  const k = on * r;
  if (k > 0) return alb.map((c) => Math.max(c, Math.min(c + Math.min(c * R.light, R.most) * k, R.ceiling)));
  return alb.map((c) => c + Math.min(c * R.dark, R.most) * k);
}
/** reliefFrameSun in doubles. */
export function reliefFrameSun(wdx, wdy, odx, ody, sun) {
  const a = dot(wdx, wdx), b = dot(wdx, wdy), c = dot(wdy, wdy), det = a * c - b * b;
  if (det <= 1e-6 * a * c) return [0, 0, 0];
  const sx = dot(wdx, sun), sy = dot(wdy, sun);
  const u = (c * sx - b * sy) / det, v = (a * sy - b * sx) / det;
  const w = wdx.map((x, i) => u * x + v * wdy[i]), o = odx.map((x, i) => u * x + v * ody[i]);
  const k = Math.hypot(...w) / Math.max(Math.hypot(...o), 1e-12);
  return o.map((x) => x * k);
}
