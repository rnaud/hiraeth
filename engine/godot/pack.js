// The Godot backend's data layouts, in plain JavaScript (no 'godot' module: the tests run them in
// Node). engine/godot/backend.js hands the results to Godot.

/** Variant type ids (Godot 4.x core/variant/variant.h), for bytes_to_var. */
export const VARIANT = { PACKED_BYTE: 29, PACKED_INT32: 30, PACKED_FLOAT32: 32, PACKED_VECTOR2: 35, PACKED_VECTOR3: 36, PACKED_COLOR: 37 };

/**
 * A packed array as var_to_bytes writes it: [type u32][count u32][data], little-endian, so that
 * bytes_to_var turns it into a PackedVector3Array (and friends) natively, at memory speed.
 */
export function packedBytes(type, arr, count) {
  const bytes = new ArrayBuffer(8 + arr.byteLength);
  const dv = new DataView(bytes);
  dv.setUint32(0, type, true);
  dv.setUint32(4, count, true);
  new Uint8Array(bytes, 8).set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
  return bytes;
}

/** The triangle list, wound for Godot (a, c, b: three's front faces are counter-clockwise, Godot's clockwise), as Int32. */
export function godotIndex(index, vertexCount, start = 0, count = null) {
  const n = count ?? (index ? index.length : vertexCount) - start;
  const out = new Int32Array(Math.max(0, n - (n % 3)));
  for (let k = 0; k < out.length; k += 3) {
    const a = index ? index[start + k] : start + k, b = index ? index[start + k + 1] : start + k + 1, c = index ? index[start + k + 2] : start + k + 2;
    out[k] = a; out[k + 1] = c; out[k + 2] = b;
  }
  return out;
}

/** Instances (16 floats each, three's column-major) as a MultiMesh buffer: a 3×4 row-major transform (12 floats), then a colour if any (4). */
export function multimeshBuffer(mats, count, colors = null) {
  const stride = colors ? 16 : 12;
  const out = new Float32Array(count * stride);
  for (let i = 0; i < count; i++) {
    const e = i * 16, o = i * stride;
    out[o] = mats[e]; out[o + 1] = mats[e + 4]; out[o + 2] = mats[e + 8]; out[o + 3] = mats[e + 12];
    out[o + 4] = mats[e + 1]; out[o + 5] = mats[e + 5]; out[o + 6] = mats[e + 9]; out[o + 7] = mats[e + 13];
    out[o + 8] = mats[e + 2]; out[o + 9] = mats[e + 6]; out[o + 10] = mats[e + 10]; out[o + 11] = mats[e + 14];
    if (colors) { out[o + 12] = colors[i * 3]; out[o + 13] = colors[i * 3 + 1]; out[o + 14] = colors[i * 3 + 2]; out[o + 15] = 1; }
  }
  return out;
}

/** Colours (3 or 4 a vertex, maybe normalised integers) as RGBA floats, for a PackedColorArray. */
export function rgbaColors(attr, n) {
  const k = attr.itemSize, src = attr.array, out = new Float32Array(n * 4);
  const s = attr.normalized && !(src instanceof Float32Array) ? 1 / (src instanceof Uint8Array ? 255 : 65535) : 1;
  for (let i = 0; i < n; i++) { out[i * 4] = src[i * k] * s; out[i * 4 + 1] = src[i * k + 1] * s; out[i * 4 + 2] = src[i * k + 2] * s; out[i * 4 + 3] = k === 4 ? src[i * k + 3] * s : 1; }
  return out;
}
