// The traveller's shipped GLBs, made from the untouched exports in data/characters/traveller-v1/
// (docs/systems/characters.md, "What the traveller costs"):
//   - the geometry is kept byte for byte (colors.json and the runtime cloth/head fitting index the
//     vertices in the export's order), in the same accessors;
//   - data nothing reads is dropped: images no material uses (Tripo's roughness and normal maps: the
//     game's ink material reads only the base colour), accessors no mesh or skin uses (the body's
//     pre-fit positions);
//   - the base-colour texture is resized from 4096² to 2048² (JPEG, 4:4:4, the 4:2:0 source's chroma
//     was 2048² already). Measured in the game's own frames (the face close shot at High on a Retina-
//     sized frame, full body): the pictures differ by under 0.06 / 255 on average, and it saves 67 MB
//     of GPU memory a texture, its upload and its download.
//
//   node scripts/tripo/slim-traveller.mjs            (writes public/characters/traveller-v1/{,head-v2/}model.glb)
//   node scripts/tripo/slim-traveller.mjs --check    (exits 1 if the shipped files aren't what this makes)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TRAVELLER_FILES = [
  ['data/characters/traveller-v1/model.glb', 'public/characters/traveller-v1/model.glb'],
  ['data/characters/traveller-v1/head-v2/model.glb', 'public/characters/traveller-v1/head-v2/model.glb'],
];
export const SLIM = { maxTexture: 2048, quality: 90 };

const pad4 = (n) => (n + 3) & ~3;

/** A GLB's JSON and binary chunk. */
export function readGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  const binAt = 20 + jsonLen;
  const bin = binAt < buf.length ? buf.subarray(binAt + 8, binAt + 8 + buf.readUInt32LE(binAt)) : Buffer.alloc(0);
  return { json, bin };
}

export function writeGlb(json, bin) {
  const js = Buffer.from(JSON.stringify(json), 'utf8');
  const jsPad = Buffer.concat([js, Buffer.alloc(pad4(js.length) - js.length, 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsPad.length + 8 + binPad.length, 8);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(jsPad.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
  const c2 = Buffer.alloc(8); c2.writeUInt32LE(binPad.length, 0); c2.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, c1, jsPad, c2, binPad]);
}

/** Every textureInfo of `materials` (a key ending in "Texture" with an index: baseColorTexture, normalTexture, an extension's). */
function forEachTexture(o, fn) {
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (/Texture$/.test(k) && v && typeof v.index === 'number') fn(v);
    else forEachTexture(v, fn);
  }
}

/** The accessors and images something reads (meshes, skins, animations; materials' textures). */
export function usedParts(json) {
  const accessors = new Set(), textures = new Set();
  for (const m of json.meshes ?? []) for (const p of m.primitives) {
    for (const a of Object.values(p.attributes)) accessors.add(a);
    if (p.indices !== undefined) accessors.add(p.indices);
    for (const t of p.targets ?? []) for (const a of Object.values(t)) accessors.add(a);
  }
  for (const s of json.skins ?? []) if (s.inverseBindMatrices !== undefined) accessors.add(s.inverseBindMatrices);
  for (const an of json.animations ?? []) for (const s of an.samplers) { accessors.add(s.input); accessors.add(s.output); }
  forEachTexture(json.materials ?? [], (info) => textures.add(info.index));
  const images = new Set([...textures].map((t) => json.textures[t].source));
  return { accessors, textures, images };
}

/**
 * The slim GLB: `resize(bytes, mimeType)` → { bytes, mimeType } for each used image (async).
 * The accessors something reads keep their bytes (in their order); what nothing reads goes.
 */
export async function slimGlb(buf, resize) {
  const { json, bin } = readGlb(buf);
  const used = usedParts(json);
  const views = [], chunks = [];
  let offset = 0;
  const addView = (bytes, extra = {}) => {
    const at = offset;
    chunks.push(bytes, Buffer.alloc(pad4(bytes.length) - bytes.length));
    offset = pad4(at + bytes.length);
    views.push({ buffer: 0, byteOffset: at, byteLength: bytes.length, ...extra });
    return views.length - 1;
  };
  const viewBytes = (i) => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
  // the images first (as Tripo wrote them), then the geometry
  const imageMap = new Map(), images = [];
  for (const [i, img] of (json.images ?? []).entries()) {
    if (!used.images.has(i)) continue;
    const out = await resize(viewBytes(img.bufferView), img.mimeType);
    imageMap.set(i, images.length);
    images.push({ ...img, mimeType: out.mimeType, bufferView: addView(out.bytes) });
  }
  const viewMap = new Map(), accessorMap = new Map(), accessors = [];
  for (const [i, a] of json.accessors.entries()) {
    if (!used.accessors.has(i)) continue;
    const copy = { ...a };
    if (a.bufferView !== undefined) {
      if (!viewMap.has(a.bufferView)) {
        const { buffer, byteOffset, byteLength, ...rest } = json.bufferViews[a.bufferView];
        viewMap.set(a.bufferView, addView(viewBytes(a.bufferView), rest));
      }
      copy.bufferView = viewMap.get(a.bufferView);
    }
    accessorMap.set(i, accessors.length);
    accessors.push(copy);
  }
  const acc = (i) => accessorMap.get(i);
  const meshes = structuredClone(json.meshes ?? []);
  for (const m of meshes) for (const p of m.primitives) {
    for (const k of Object.keys(p.attributes)) p.attributes[k] = acc(p.attributes[k]);
    if (p.indices !== undefined) p.indices = acc(p.indices);
    for (const t of p.targets ?? []) for (const k of Object.keys(t)) t[k] = acc(t[k]);
  }
  const skins = structuredClone(json.skins ?? []);
  for (const s of skins) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = acc(s.inverseBindMatrices);
  const animations = structuredClone(json.animations ?? []);
  for (const an of animations) for (const s of an.samplers) { s.input = acc(s.input); s.output = acc(s.output); }
  const textureMap = new Map(), textures = [];
  for (const [i, t] of (json.textures ?? []).entries()) if (used.textures.has(i)) { textureMap.set(i, textures.length); textures.push({ ...t, source: imageMap.get(t.source) }); }
  const samplersUsed = [...new Set(textures.map((t) => t.sampler).filter((s) => s !== undefined))];
  for (const t of textures) if (t.sampler !== undefined) t.sampler = samplersUsed.indexOf(t.sampler);
  const materials = structuredClone(json.materials ?? []);
  forEachTexture(materials, (info) => { info.index = textureMap.get(info.index); });
  const out = { ...json, accessors, meshes, bufferViews: views, buffers: [{ byteLength: offset }], images, textures, samplers: samplersUsed.map((s) => json.samplers[s]), materials };
  if (json.skins) out.skins = skins;
  if (json.animations) out.animations = animations;
  if (!images.length) { delete out.images; delete out.textures; delete out.samplers; }
  return writeGlb(out, Buffer.concat(chunks).subarray(0, offset));
}

/** sharp: at most `maxTexture` on a side, JPEG 4:4:4. */
export async function makeResize({ maxTexture = SLIM.maxTexture, quality = SLIM.quality } = {}) {
  let sharp;
  try { sharp = (await import('sharp')).default; } catch { throw new Error('slim-traveller needs sharp (npm install: it comes with wrangler)'); }
  return async (bytes) => {
    const img = sharp(bytes), meta = await img.metadata();
    const size = Math.min(maxTexture, Math.max(meta.width, meta.height));
    const out = await img.resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
      .jpeg({ quality, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
    return { bytes: out, mimeType: 'image/jpeg' };
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const resize = await makeResize();
  let stale = 0;
  for (const [src, dst] of TRAVELLER_FILES) {
    const before = readFileSync(resolve(ROOT, src));
    const after = await slimGlb(before, resize);
    if (check) {
      const shipped = readFileSync(resolve(ROOT, dst));
      if (!shipped.equals(after)) { console.error(`${dst} is not what slim-traveller makes from ${src}`); stale++; }
      continue;
    }
    writeFileSync(resolve(ROOT, dst), after);
    console.log(`${dst}: ${(before.length / 1e6).toFixed(2)} MB → ${(after.length / 1e6).toFixed(2)} MB`);
  }
  process.exit(stale ? 1 : 0);
}
