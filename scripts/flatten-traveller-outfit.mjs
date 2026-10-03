// Replace the traveller's generated body texture with flat printed colour zones.
//
//   node scripts/flatten-traveller-outfit.mjs [in.glb] [out.glb]
//
// The generated texture has painted shading and crease lines baked in. Each
// vertex samples it once, is matched to the reference palette (dark painted
// lines are ignored), and neighbouring vertices vote so seams and painted
// strokes do not leave islands. The zones are written as COLOR_0 (display
// values: the game runs with colour management off), and the image is removed;
// the game shader now draws the shadow shapes and creases. The generated
// surface is lumpy, so its normals are also relaxed: the cel terminator then
// falls in a few broad shapes instead of many small blotches.
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePNG } from './png.mjs';
import { TRAVELLER_PALETTE as OUTFIT_PALETTE } from '../src/traveller-style.js';

const [input = 'public/anim/traveller.glb', output = input] = process.argv.slice(2);
const bytes = readFileSync(input);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const bin = bytes.subarray(28 + jsonLength);
const view = i => { const v = gltf.bufferViews[i]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function read(index) {
  const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView], n = SIZE[a.type];
  const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  const stride = (v.byteStride ?? 0) / Type.BYTES_PER_ELEMENT || n;
  const src = new Type(bin.buffer, bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), (a.count - 1) * stride + n);
  return Array.from({ length: a.count }, (_, i) => Array.from(src.subarray(i * stride, i * stride + n)));
}

const textured = gltf.materials.map((m, i) => m.pbrMetallicRoughness?.baseColorTexture ? i : -1).filter(i => i >= 0);
if (!textured.length) { console.log('no textured materials; nothing to do'); process.exit(0); }
const image = decodePNG(Buffer.from(view(gltf.images[0].bufferView)));

const toLab = hex => {
  const c = typeof hex === 'string' ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) : hex;
  const [r, g, b] = c.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const x = f((.4124 * r + .3576 * g + .1805 * b) / .9505), y = f(.2126 * r + .7152 * g + .0722 * b), z = f((.0193 * r + .1192 * g + .9505 * b) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const names = Object.keys(OUTFIT_PALETTE);
const palette = names.map(n => toLab(OUTFIT_PALETTE[n]));
const DARK = names.indexOf('dark'), MIN_ISLAND = 120;
function sample(u, v) {
  // a small footprint averages the generated brush noise; painted ink lines are skipped
  const acc = [0, 0, 0]; let n = 0;
  for (let dy = -3; dy <= 3; dy += 1.5) for (let dx = -3; dx <= 3; dx += 1.5) {
    const x = Math.min(image.width - 1, Math.max(0, Math.round((u - Math.floor(u)) * image.width + dx)));
    const y = Math.min(image.height - 1, Math.max(0, Math.round((v - Math.floor(v)) * image.height + dy)));
    const i = (y * image.width + x) * image.channels;
    const rgb = [image.pixels[i], image.pixels[i + 1], image.pixels[i + 2]].map(c => c / 255);
    if (Math.max(...rgb) < .3) continue;
    rgb.forEach((c, k) => acc[k] += c); n++;
  }
  return n ? acc.map(c => c / n) : null;
}
function classify(rgb) {
  if (!rgb) return -1;
  const lab = toLab(rgb);
  // painted shadows are darker and more saturated than the flat colour: weigh hue over lightness
  let best = -1, bestD = Infinity;
  palette.forEach((p, i) => {
    if (i === DARK) return;
    const d = .25 * (lab[0] - p[0]) ** 2 + (lab[1] - p[1]) ** 2 + (lab[2] - p[2]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

const colorViews = [];
for (const mesh of gltf.meshes) for (const prim of mesh.primitives) {
  if (!textured.includes(prim.material) || prim.attributes.COLOR_0 !== undefined) continue;
  const positions = read(prim.attributes.POSITION), uvs = read(prim.attributes.TEXCOORD_0);
  const indices = prim.indices !== undefined ? read(prim.indices).map(i => i[0]) : positions.map((_, i) => i);
  // weld UV seams so both sides of a seam share one zone
  const weld = new Map(), id = positions.map(p => {
    const key = p.map(c => Math.round(c * 2e4)).join();
    if (!weld.has(key)) weld.set(key, weld.size);
    return weld.get(key);
  });
  const neighbours = Array.from({ length: weld.size }, () => new Set());
  for (let t = 0; t < indices.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = id[indices[t + k]], b = id[indices[t + (k + 1) % 3]];
    neighbours[a].add(b); neighbours[b].add(a);
  }
  let label = new Int32Array(weld.size).fill(-1);
  const votes = Array.from({ length: weld.size }, () => new Float32Array(names.length));
  positions.forEach((_, i) => { const c = classify(sample(...uvs[i])); if (c >= 0) votes[id[i]][c]++; });
  votes.forEach((v, i) => { const m = Math.max(...v); if (m > 0) label[i] = v.indexOf(m); });
  // majority smoothing removes painted-stroke islands and fills unclassified ink
  for (let pass = 0; pass < 6; pass++) {
    const next = label.slice();
    neighbours.forEach((ns, i) => {
      const count = new Float32Array(names.length);
      if (label[i] >= 0) count[label[i]] += 1.5;
      for (const j of ns) if (label[j] >= 0) count[label[j]]++;
      const m = Math.max(...count);
      if (m > 0) next[i] = count.indexOf(m);
    });
    label = next;
  }
  // fold small islands (stray brush colours) into the zone that surrounds them
  for (let pass = 0; pass < 4; pass++) {
    const seen = new Int32Array(weld.size).fill(-1);
    for (let start = 0; start < weld.size; start++) {
      if (seen[start] >= 0) continue;
      const island = [start], border = new Float32Array(names.length);
      seen[start] = start;
      for (let k = 0; k < island.length; k++) for (const j of neighbours[island[k]]) {
        if (label[j] !== label[start]) border[label[j]]++;
        else if (seen[j] < 0) { seen[j] = start; island.push(j); }
      }
      const m = Math.max(...border);
      if (island.length < MIN_ISLAND && m > 0) for (const i of island) label[i] = border.indexOf(m);
    }
  }
  const colors = new Uint8Array(positions.length * 4), totals = {};
  positions.forEach((_, i) => {
    const name = names[label[id[i]] >= 0 ? label[id[i]] : 0], hex = OUTFIT_PALETTE[name];
    totals[name] = (totals[name] ?? 0) + 1;
    [1, 3, 5].forEach((o, k) => colors[i * 4 + k] = parseInt(hex.slice(o, o + 2), 16));
    colors[i * 4 + 3] = 255;
  });
  // relax normals across welded neighbours (about a hand's width), keeping their length
  const normals = read(prim.attributes.NORMAL);
  let smooth = Array.from({ length: weld.size }, () => [0, 0, 0]);
  normals.forEach((nm, i) => nm.forEach((c, k) => smooth[id[i]][k] += c));
  for (let pass = 0; pass < 10; pass++) smooth = smooth.map((nm, i) => {
    const sum = nm.slice();
    for (const j of neighbours[i]) for (let k = 0; k < 3; k++) sum[k] += smooth[j][k] / neighbours[i].size * 2;
    const l = Math.hypot(...sum) || 1;
    return sum.map(c => c / l);
  });
  const relaxed = new Float32Array(positions.length * 3);
  positions.forEach((_, i) => relaxed.set(smooth[id[i]], i * 3));
  console.log(mesh.name, totals);
  colorViews.push({ prim, colors, relaxed });
}

// Rebuild the binary chunk without the image, appending the colour buffers.
const imageViews = new Set(gltf.images.map(i => i.bufferView));
const remap = new Map(), chunks = [];
let offset = 0;
const push = data => { const start = offset; chunks.push(data); offset += data.length; const pad = (4 - offset % 4) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; } return start; };
const views = [];
gltf.bufferViews.forEach((v, i) => {
  if (imageViews.has(i)) return;
  remap.set(i, views.length);
  views.push({ ...v, byteOffset: push(view(i)) });
});
for (const a of gltf.accessors) if (a.bufferView !== undefined) a.bufferView = remap.get(a.bufferView);
for (const { prim, colors, relaxed } of colorViews) {
  views.push({ buffer: 0, byteOffset: push(Buffer.from(colors.buffer)), byteLength: colors.length, target: 34962 });
  gltf.accessors.push({ bufferView: views.length - 1, componentType: 5121, normalized: true, count: colors.length / 4, type: 'VEC4' });
  prim.attributes.COLOR_0 = gltf.accessors.length - 1;
  views.push({ buffer: 0, byteOffset: push(Buffer.from(relaxed.buffer)), byteLength: relaxed.byteLength, target: 34962 });
  gltf.accessors.push({ bufferView: views.length - 1, componentType: 5126, count: relaxed.length / 3, type: 'VEC3' });
  prim.attributes.NORMAL = gltf.accessors.length - 1;
}
gltf.bufferViews = views;
for (const i of textured) {
  const m = gltf.materials[i];
  delete m.pbrMetallicRoughness.baseColorTexture;
  m.name = 'Traveller flat outfit';
}
delete gltf.images; delete gltf.textures; delete gltf.samplers;
const binary = Buffer.concat(chunks);
gltf.buffers = [{ byteLength: binary.length }];
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8);
const chunk = (data, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(data.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, data]); };
writeFileSync(output, Buffer.concat([header, chunk(json, 0x4e4f534a), chunk(binary, 0x004e4942)]));
console.log(`wrote ${output}: ${bytes.length} -> ${28 + json.length + binary.length} bytes`);
