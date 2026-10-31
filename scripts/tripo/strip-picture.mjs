// A Tripo body's GLB without its picture (#800: the foes drawn by their vertex colours, src/enemies/foe-assets.js): its images,
// textures and samplers and the material's map dropped, the buffer rebuilt from the kept bufferViews only.
//   node scripts/tripo/strip-picture.mjs <in.glb> <out.glb>   (the wood cutter's: the trial's prepare.mjs output into public/enemies/woodcutter/body.glb)
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out] = process.argv.slice(2);
const b = readFileSync(inp), jn = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn, 28 + jn + b.readUInt32LE(20 + jn));
const imageViews = new Set((j.images ?? []).map((im) => im.bufferView));
delete j.images; delete j.textures; delete j.samplers;
for (const m of j.materials ?? []) { if (m.pbrMetallicRoughness) delete m.pbrMetallicRoughness.baseColorTexture; }
const keep = j.bufferViews.map((v, i) => !imageViews.has(i));
const remap = []; const views = []; const chunks = []; let off = 0;
j.bufferViews.forEach((v, i) => {
  if (!keep[i]) return;
  remap[i] = views.length;
  const data = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
  views.push({ ...v, byteOffset: off }); chunks.push(data); off += data.length;
});
j.bufferViews = views;
for (const a of j.accessors) a.bufferView = remap[a.bufferView];
const body = Buffer.concat(chunks), binPad = Buffer.concat([body, Buffer.alloc((4 - (body.length % 4)) % 4)]);
j.buffers = [{ byteLength: binPad.length }];
let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + binPad.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
const c2 = Buffer.alloc(8); c2.writeUInt32LE(binPad.length, 0); c2.writeUInt32LE(0x004e4942, 4);
writeFileSync(out, Buffer.concat([head, c1, js, c2, binPad]));
console.log(`${inp}: ${b.length} -> ${out}: ${12 + 8 + js.length + 8 + binPad.length} bytes`);
