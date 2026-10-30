// A minimal GLB reader/writer for the shellback's Tripo trial (#800): one mesh, one primitive, one base-colour texture.
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
const CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** { json, P (positions), N, UV, I (indices), image: { bytes, mime }, tex: { px, w, h } (RGB raw) } */
export async function readTripo(file) {
  const b = readFileSync(file), jn = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
  const view = (i) => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
  const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    return new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)); };
  const p = json.meshes[0].primitives[0];
  const img = json.images[json.textures[json.materials[p.material].pbrMetallicRoughness.baseColorTexture.index].source];
  const bytes = Buffer.from(view(img.bufferView));
  const { data: px, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let I = acc(p.indices); if (!(I instanceof Uint32Array)) I = Uint32Array.from(I);
  return { json, P: acc(p.attributes.POSITION), N: acc(p.attributes.NORMAL), UV: acc(p.attributes.TEXCOORD_0), I, image: { bytes, mime: img.mimeType }, tex: { px, w: info.width, h: info.height } };
}

/** The texture's colour at uv (bilinear; glTF uv: v down from the top). */
export function sample(tex, u, v, out = [0, 0, 0]) {
  const x = Math.min(tex.w - 1, Math.max(0, u * tex.w - 0.5)), y = Math.min(tex.h - 1, Math.max(0, v * tex.h - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(tex.w - 1, x0 + 1), y1 = Math.min(tex.h - 1, y0 + 1), fx = x - x0, fy = y - y0;
  for (let c = 0; c < 3; c++) {
    const a = tex.px[(y0 * tex.w + x0) * 3 + c], b = tex.px[(y0 * tex.w + x1) * 3 + c], d = tex.px[(y1 * tex.w + x0) * 3 + c], e = tex.px[(y1 * tex.w + x1) * 3 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }
  return out;
}

/**
 * A GLB of one mesh: attrs { POSITION, NORMAL, TEXCOORD_0, COLOR_0 (Uint8 normalized RGBA or float RGB), JOINTS_0, WEIGHTS_0 }
 * (typed arrays), indices, an embedded PNG/JPEG texture, extras. Deterministic.
 */
export function writeGlb({ attrs, indices, image, imageMime = 'image/png', name = 'mesh', extras = {} }) {
  const chunks = [], views = [], accessors = [];
  let off = 0;
  const push = (buf, target) => { const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; } views.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...(target ? { target } : {}) }); chunks.push(buf); off += buf.length; return views.length - 1; };
  const attributes = {};
  const SIZES = { POSITION: 3, NORMAL: 3, TEXCOORD_0: 2, COLOR_0: 4, JOINTS_0: 4, WEIGHTS_0: 4 };
  for (const [k, arr] of Object.entries(attrs)) {
    if (!arr) continue;
    const size = k === 'COLOR_0' && arr.length % 4 ? 3 : SIZES[k];
    const ct = arr instanceof Float32Array ? 5126 : arr instanceof Uint16Array ? 5123 : 5121;
    const count = arr.length / size, a = { bufferView: push(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), 34962), componentType: ct, count, type: { 2: 'VEC2', 3: 'VEC3', 4: 'VEC4' }[size] };
    if (k === 'COLOR_0' && ct !== 5126) a.normalized = true;
    if (k === 'POSITION') { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < arr.length; i++) { mn[i % 3] = Math.min(mn[i % 3], arr[i]); mx[i % 3] = Math.max(mx[i % 3], arr[i]); } a.min = mn; a.max = mx; }
    accessors.push(a); attributes[k] = accessors.length - 1;
  }
  // (a Uint16Array of indices is written as it is, half the bytes: the shipped shellback's, scripts/tripo/ship-shellback.mjs)
  const ind = indices instanceof Uint32Array || indices instanceof Uint16Array ? indices : Uint32Array.from(indices);
  accessors.push({ bufferView: push(Buffer.from(ind.buffer, ind.byteOffset, ind.byteLength), 34963), componentType: ind instanceof Uint16Array ? 5123 : 5125, count: ind.length, type: 'SCALAR' });
  const indicesAcc = accessors.length - 1;
  const json = { asset: { version: '2.0', generator: 'hiraeth #800 shellback trial' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: [{ attributes, indices: indicesAcc, material: 0 }], extras }], accessors, bufferViews: views, buffers: [{ byteLength: 0 }],
    materials: [{ name: `${name} flat`, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 1, ...(image ? { baseColorTexture: { index: 0 } } : {}) } }] };
  if (image) { json.images = [{ mimeType: imageMime, bufferView: push(image) }]; json.textures = [{ source: 0, sampler: 0 }]; json.samplers = [{ magFilter: 9729, minFilter: 9987 }]; }
  const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
  json.buffers[0].byteLength = off;
  let js = Buffer.from(JSON.stringify(json), 'utf8'); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(chunks), head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, js, bh, bin]);
}
