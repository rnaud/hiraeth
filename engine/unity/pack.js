// The Unity backend's data layouts, in plain JavaScript (the tests run them in Node). Unity is
// left-handed: the bridge mirrors x, as the C# port's exporter does (scripts/unity-export), so the
// port's shaders, which mirror it back before every pattern, see the page as the web does.
//   a point:   (x, y, z) → (−x, y, z)
//   a matrix:  X · M · X   (X = diag(−1, 1, 1)): the entries with exactly one index on x change sign
//   a triangle: its winding flips (a mirror turns counter-clockwise into clockwise)

/** X · M · X of a column-major 4×4 (three's elements), into out at o. */
export function mirrorMatrix(e, eo = 0, out = new Float32Array(16), o = 0) {
  for (let k = 0; k < 16; k++) out[o + k] = e[eo + k];
  // (column-major: e[col * 4 + row]; row 0 with col 1..3, col 0 with row 1..2)
  out[o + 4] = -out[o + 4]; out[o + 8] = -out[o + 8]; out[o + 12] = -out[o + 12];
  out[o + 1] = -out[o + 1]; out[o + 2] = -out[o + 2];
  return out;
}

/**
 * A geometry for Unity, one ArrayBuffer (BridgeMeshes.cs reads it):
 *   u32 vertices, u32 indices, u32 flags (1 normal, 2 uv, 4 colour, 8 skin, 16 bind), u32 groups,
 *   groups × (u32 start, u32 count, u32 material index),
 *   f32 position × 3n (x mirrored), [normal × 3n], [uv × 2n], [colour rgba × 4n],
 *   [skin index × 4n (as floats), skin weight × 4n], [bind: the rest pose, three's space, × 3n], [rig × 4n: 32],
 *   u32 index × m (wound for Unity).
 * colours: only when the material draws them (vertexColors); bind: for people (their outfit zones).
 */
export function unityGeometry(g, { colors = false, bind = false, rig = false } = {}) {
  const A = g.attributes, P = A.position.array, n = P.length / 3;
  const N = A.normal?.itemSize === 3 ? A.normal.array : null;
  const UV = A.uv?.itemSize === 2 ? A.uv.array : null;
  // (no colours but a per-vertex alpha, the wind's wisps: white with that alpha)
  const C = colors && A.color ? A.color : colors && A.aAlpha?.itemSize === 1 ? { itemSize: 1, alphaOnly: true, array: A.aAlpha.array } : null;
  const skin = A.skinIndex && A.skinWeight;
  const idx = g.index ?? null;
  const total = idx ? idx.length : n;
  const groups = g.groups?.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
  const R = rig && A.aRig ? A.aRig : null;   // (the crowd's figure: each vertex's part, zone and code, crowd.js)
  const flags = (N ? 1 : 0) | (UV ? 2 : 0) | (C ? 4 : 0) | (skin ? 8 : 0) | (bind ? 16 : 0) | (R ? 32 : 0);
  const floats = n * 3 + (N ? n * 3 : 0) + (UV ? n * 2 : 0) + (C ? n * 4 : 0) + (skin ? n * 8 : 0) + (bind ? n * 3 : 0) + (R ? n * 4 : 0);
  const head = 4 + groups.length * 3;
  const buf = new ArrayBuffer((head + floats + total) * 4);
  const u32 = new Uint32Array(buf), f32 = new Float32Array(buf);
  u32[0] = n; u32[1] = total; u32[2] = flags; u32[3] = groups.length;
  groups.forEach((gr, i) => { u32[4 + i * 3] = gr.start; u32[5 + i * 3] = Math.min(gr.count, total - gr.start); u32[6 + i * 3] = gr.materialIndex ?? 0; });
  let o = head;
  for (let i = 0; i < n; i++) { f32[o++] = -P[i * 3]; f32[o++] = P[i * 3 + 1]; f32[o++] = P[i * 3 + 2]; }
  if (N) for (let i = 0; i < n; i++) { f32[o++] = -N[i * 3]; f32[o++] = N[i * 3 + 1]; f32[o++] = N[i * 3 + 2]; }
  if (UV) { f32.set(UV.subarray(0, n * 2), o); o += n * 2; }
  if (C) {
    const k = C.itemSize, src = C.array, s = C.normalized && !(src instanceof Float32Array) ? 1 / (src instanceof Uint8Array ? 255 : 65535) : 1;
    if (C.alphaOnly) for (let i = 0; i < n; i++) { f32[o++] = 1; f32[o++] = 1; f32[o++] = 1; f32[o++] = src[i]; }
    else for (let i = 0; i < n; i++) { f32[o++] = src[i * k] * s; f32[o++] = src[i * k + 1] * s; f32[o++] = src[i * k + 2] * s; f32[o++] = k === 4 ? src[i * k + 3] * s : 1; }
  }
  if (skin) {
    for (const a of [A.skinIndex, A.skinWeight]) { const k = a.itemSize, src = a.array; for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) f32[o++] = c < k ? src[i * k + c] : 0; }
  }
  if (bind) { f32.set(P.subarray(0, n * 3), o); o += n * 3; }
  if (R) { const k = R.itemSize; for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) f32[o++] = c < k ? R.array[i * k + c] : 0; }
  // (the mirror flips the winding: a, c, b)
  for (let t = 0; t + 2 < total; t += 3) {
    const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
    u32[o++] = a; u32[o++] = c; u32[o++] = b;
  }
  for (let t = total - (total % 3); t < total; t++) u32[o++] = idx ? idx[t] : t;
  return buf;
}

/**
 * The frame's commands, one ArrayBuffer (BridgeRenderer.cs Frame reads it): a stream of
 *   1 transforms: u32 n, n × (i32 id, f32 × 16 mirrored world matrix)
 *   2 visible:    i32 id, u32 on
 *   3 instances:  i32 id, u32 count, u32 hasColour, f32 × 16 count (mirrored), [f32 × 3 count]
 *   4 bones:      i32 id, u32 n, f32 × 16 n (X · Sᵢ · X: engine/skin.js, mirrored)
 *   5 camera:     f32 × 16 (mirrored camera world), f32 fov, near, far
 *   6 remove:     i32 id
 *   9 crowd:      i32 id, u32 count, f32 time, count × 32 floats (FarCrowd.cs Inst: at (Unity, yaw), anim, react,
 *                 look0, look1, dress, body, scale): the crowd's figures, posed in the port's Crowd.hlsl
 *   8 vertices:   i32 geometry id, u32 n, u32 flags (1 normals, 2 alpha), f32 × 3n positions (mirrored), [f32 × 3n normals],
 *                 [f32 × n alpha]: cloth, the wind's wisps
 *   7 skeleton:   i32 skeleton id, u32 n, f32 × 16 n (bone world × inverse bind, mirrored): the bones its meshes share
 *  12 grass:      i32 id, u32 count, u32 which (0 aGrass, 1 aGrass2, 2 the count alone), u32 start, u32 n, f32 × 4 n: the
 *                 tufts' attribute from start (flora-grass.js; aGrass's root x mirrored, aGrass2 as it is)
 *  13 grassView:  i32 id, f32 × 18: uGrassView (its centre in three's space), uGrassLod, uGrassLook, uColor, uColor2
 *  14 brush:      f32 × 4: the traveller's feet (three's space) and speed (the port's _Brush)
 *  15 material:   i32 material id, f32 r, g, b, glow (NaN: unchanged): a material's colour or glow, live
 *  17 cloth:      i32 cloth id, i32 the garment's geometry id, u32 steps, u32 flags (1 reset, 2 simulated), f32 targets 3N,
 *                 the cage's capsules 14K, the garment's 14K, the bones 16Bn (bind inverse folded in), the attachment 16:
 *                 the coral-shirt traveller's overshirt, a frame (BridgeCloth.cs; engine/cloth.js its sizes)
 *  16 fluid:      i32 material id, f32 × 26: uFluidA, uFluidB, the six tones (rgb): the traveller's fluid, live
 *   0 end
 */
export class CommandWriter {
  constructor(bytes = 1 << 16) { this._alloc(bytes); this.n = 0; }
  _alloc(bytes) { const old = this.u32; this.buf = new ArrayBuffer(bytes); this.u32 = new Uint32Array(this.buf); this.i32 = new Int32Array(this.buf); this.f32 = new Float32Array(this.buf); if (old) this.u32.set(old.subarray(0, this.n)); }
  reserve(words) { if (this.n + words + 1 > this.u32.length) { let b = this.buf.byteLength * 2; while ((this.n + words + 1) * 4 > b) b *= 2; this._alloc(b); } }
  u(v) { this.u32[this.n++] = v; }
  i(v) { this.i32[this.n++] = v; }
  f(v) { this.f32[this.n++] = v; }
  matrix(e, eo = 0) { mirrorMatrix(e, eo, this.f32, this.n); this.n += 16; }
  /** The stream so far, closed with 0, as a fresh ArrayBuffer; the writer starts again. */
  take() { this.reserve(1); this.u32[this.n++] = 0; const out = this.buf.slice(0, this.n * 4); this.n = 0; return out; }
  get empty() { return this.n === 0; }
}
export const OP = { transforms: 1, visible: 2, instances: 3, bones: 4, camera: 5, remove: 6, skeleton: 7, vertices: 8, crowd: 9, puffs: 10, lights: 11, grass: 12, grassView: 13, brush: 14, material: 15, fluid: 16, cloth: 17 };

/**
 * Instances as the port's Puffs.Inst (8 floats each, op 10: the footprints' decals): the position in Unity's
 * space and the turn about y (as crowdInstances), the scale on each axis, and the fade (an instanced aFade, 0–1).
 */
export function puffInstances(mats, count, attrs, out = new Float32Array(count * 8)) {
  const fade = attrs?.aFade;
  for (let i = 0; i < count; i++) {
    const e = i * 16, o = i * 8;
    out[o] = -mats[e + 12]; out[o + 1] = mats[e + 13]; out[o + 2] = mats[e + 14]; out[o + 3] = -Math.atan2(mats[e + 8], mats[e + 10]);
    out[o + 4] = Math.hypot(mats[e], mats[e + 1], mats[e + 2]); out[o + 5] = Math.hypot(mats[e + 4], mats[e + 5], mats[e + 6]); out[o + 6] = Math.hypot(mats[e + 8], mats[e + 9], mats[e + 10]);
    out[o + 7] = fade ? fade.array[i * fade.itemSize] : 1;
  }
  return out;
}

/**
 * The crowd's instances as the port's FarCrowd.cs Inst (32 floats each): at = the position in Unity's
 * frame and the yaw (−the heading: the mirror), anim, react, look0, look1, dress, body from crowd.js's
 * per-instance attributes, scale (x) from the matrix.
 */
export function crowdInstances(mats, count, attrs, out = new Float32Array(count * 32)) {
  const K = ['aAnim', 'aReact', 'aLook0', 'aLook1', 'aDress', 'aBody'];
  for (let i = 0; i < count; i++) {
    const e = i * 16, o = i * 32;
    const s = Math.hypot(mats[e + 4], mats[e + 5], mats[e + 6]) || 1;
    const heading = Math.atan2(mats[e + 8], mats[e + 10]);
    out[o] = -mats[e + 12]; out[o + 1] = mats[e + 13]; out[o + 2] = mats[e + 14]; out[o + 3] = -heading;
    K.forEach((k, j) => { const a = attrs?.[k]; for (let c = 0; c < 4; c++) out[o + 4 + j * 4 + c] = a ? a.array[i * a.itemSize + c] : (k === 'aBody' ? [0, 1, 1, 0][c] : 0); });
    out[o + 28] = s; out[o + 29] = 0; out[o + 30] = 0; out[o + 31] = 0;
  }
  return out;
}
