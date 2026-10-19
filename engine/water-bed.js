// The water's bed map for the engines (issue #502): src/water.js bakes the bed under each body as a one-channel half-float
// texture (heights over the body's surface, -60..6 m), which the bridge's texture path cannot carry (RGBA bytes only:
// engine/unity/backend.js _texture). Sent instead as RGBA bytes, R the depth under the surface on a square-root scale
// (r = sqrt(depth / BED_RANGE), depth 0..BED_RANGE m): ~2 cm a step at the shallows' edge (0.42 m), ~3.5 cm at the
// shallows' (1.15 m), ~6 cm at the deep band's (3.4 m), the bands water-shader.js draws; deeper than BED_RANGE is deep
// water, and a bed over the surface (a bank) reads as depth 0, as the shader's bands take it. Surface.shader waterDepth
// reads it back with _BedRef.z = 1: bed = _BedRef.x - BED_RANGE r².

/** m: the deepest bed the bytes tell apart (past the deep band at 3.4 m, the caustics' 0.7 m and the contact's reach). */
export const BED_RANGE = 16;

/** A half float's value (IEEE 754 binary16 bits). */
export function fromHalf(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

/** The byte for a bed `h` m over the surface (negative: under it). */
export function bedByte(h) {
  const d = Math.min(Math.max(-h, 0), BED_RANGE);
  return Math.round(Math.sqrt(d / BED_RANGE) * 255);
}

/** The bed's height over the surface the shader reads back from a byte (its twin: Surface.shader waterDepth). */
export function bedFromByte(b) {
  const r = b / 255;
  return -BED_RANGE * r * r;
}

/**
 * The bed map `tex` (src/water.js finishBake: a DataTexture of half floats, RedFormat) as an RGBA bytes texture the
 * backends' texture path takes (engine/unity/backend.js _texture: isDataTexture, RGBAFormat, UnsignedByteType), rows as
 * they are (three's DataTexture: flipY false, row 0 at v 0), filtered linearly, no mipmaps. Kept on the source.
 */
export function bedBytes(tex) {
  if (tex.__bedBytes) return tex.__bedBytes;
  const img = tex.image, src = img?.data, w = img?.width ?? 0, h = img?.height ?? 0;
  if (!src || w < 2 || h < 2) return null;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = bedByte(src instanceof Uint16Array ? fromHalf(src[i]) : src[i]); data[i * 4 + 3] = 255; }
  // (THREE.RGBAFormat 1023, UnsignedByteType 1009, LinearFilter 1006, NoColorSpace '')
  tex.__bedBytes = { isTexture: true, isDataTexture: true, format: 1023, type: 1009, flipY: false, generateMipmaps: false, minFilter: 1006, magFilter: 1006, colorSpace: '', version: 0, userData: {}, image: { data, width: w, height: h } };
  return tex.__bedBytes;
}
