// The traveller's levels of detail, the plain-array half (no three.js: it runs in traveller-lod-worker.js
// too). docs/systems/characters.md, "What the traveller costs".
//
// His meshes are far finer than any screen shows them (the body 61 k triangles, the head 45 k, the
// overshirt 17.5 k; under 2 mm of difference at half of that). A level is a second index list over the
// SAME vertices (meshoptimizer's simplifier only drops vertices from use and moves none), appended to
// the geometry's index and drawn by its draw range: the skin, the face keys, the cloth cage, the
// colours of colors.json, the shader and its program all stay as they are, and the shadow passes draw
// the level the camera does. A level is drawn only where its error is under half the Graphics preset's
// lodPx on screen (under half a pixel at High, one at Handheld), and never with the camera within
// `near` metres of his feet (the conversation's close shots, the two-shots): those are always the full
// meshes.

export const TRAVELLER_LOD = {
  ratios: [0.5, 0.25, 0.12, 0.05],   // the levels' share of the full triangles (each made from the full mesh)
  keep: 0.85,                        // a level must drop at least 15 % of the triangles of the finer one
  maxError: 0.05,                    // m: no level that strays further (a figure a few pixels tall needs none)
  minTris: 4000,                     // meshes smaller than this aren't worth it (the trousers, the glove)
  pxScale: 0.5,                      // the error allowed: this × the preset's lodPx, in pixels
  near: 3,                           // m from the camera to his feet: the full meshes always
  hyst: 0.8,                         // a coarser level is taken only under this share of the allowance
  // the simplifier's attribute weights: normals keep the shading, uv the texture's charts, masks
  // (skin, hair, the trousers' repair) where the shader changes colour
  weights: { normal: 0.5, uv: 0.5, mask: 0.02 },
};

const MASKS = ['travellerSkin', 'travellerHair', 'trouserRepair'];

/** The simplifier's input from a BufferGeometry's attributes and one of its index lists (`base`): plain arrays. */
export function lodInput(geometry, base = geometry.index, o = TRAVELLER_LOD) {
  const A = geometry.attributes, P = A.position, n = P.count;
  const position = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { position[i * 3] = P.getX(i); position[i * 3 + 1] = P.getY(i); position[i * 3 + 2] = P.getZ(i); }
  const parts = [];
  if (A.normal) parts.push([A.normal, 3, o.weights.normal]);
  if (A.uv) parts.push([A.uv, 2, o.weights.uv]);
  for (const m of MASKS) if (A[m]) parts.push([A[m], 1, o.weights.mask]);
  const stride = parts.reduce((s, p) => s + p[1], 0), attrs = new Float32Array(n * stride), weights = [];
  let at = 0;
  for (const [a, size, w] of parts) {
    for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) attrs[i * stride + at + c] = a.getComponent(i, c);
    for (let c = 0; c < size; c++) weights.push(w);
    at += size;
  }
  return { index: Uint32Array.from(base.array.subarray(0, base.count)), position, attrs, stride, weights };
}

/**
 * The levels, coarser and coarser: [{ index: Uint32Array, error }] with error in the geometry's units
 * (metres: the simplifier's absolute error, its attribute terms included), never decreasing.
 * `S` is meshoptimizer's MeshoptSimplifier (ready).
 */
export function simplifyLevels(S, input, ratios = TRAVELLER_LOD.ratios, { keep, maxError } = TRAVELLER_LOD) {
  const levels = [], full = input.index.length;
  let last = full, error = 0;
  for (const r of ratios) {
    const target = Math.floor((full * r) / 3) * 3;
    if (target < 3) break;
    const [index, e] = S.simplifyWithAttributes(input.index, input.position, 3, input.attrs, input.stride, input.weights, null, target, 1, ['ErrorAbsolute']);
    if (e > maxError) break;
    if (index.length > last * keep || index.length < 3) continue;
    error = Math.max(error, e);
    levels.push({ index, error });
    last = index.length;
  }
  return levels;
}

/**
 * Which level to draw: 0 the full mesh, i the levels' (i - 1)th. `levels` are [{ error }] of the
 * coarser levels; d the camera's distance from his feet (m), size his scale, pxPerRad the frame's
 * pixels a radian, px the preset's lodPx (0: always full).
 */
export function pickTravellerLevel(levels, cur, d, size, pxPerRad, px, o = TRAVELLER_LOD) {
  if (!(px > 0) || !(pxPerRad > 0) || !(d >= o.near * size)) return 0;
  const allow = (px * o.pxScale * d) / (pxPerRad * size);   // the error allowed, in the geometry's units
  let j = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i].error <= allow * (i + 1 <= cur ? 1 : o.hyst)) j = i + 1;
    else break;
  }
  return j;
}
