// A fitted skin's texture read at each vertex's UV (the Node twin of sample-colors.py, with sharp instead of Pillow): the
// colours the engines put on as vertex colours, since their VMs decode no JPEG (engine/game.js engineColours; the
// guardians' skins, issue #264). Every primitive of every mesh, in the GLB's order, one [r, g, b] a vertex (sRGB 0..255).
//
//   node scripts/tripo/sample-colors.mjs public/guardians/keeper-v1          → public/guardians/keeper-v1/colors.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/tripo/sample-colors.mjs <folder with model.glb>'); process.exit(1); }
const b = readFileSync(join(dir, 'model.glb'));
const n = b.readUInt32LE(12), g = JSON.parse(b.subarray(20, 20 + n).toString('utf8')), data = b.subarray(28 + n);
const view = (i) => { const v = g.bufferViews[i]; return data.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };
const images = new Map();
async function image(ti) {
  if (images.has(ti)) return images.get(ti);
  const src = g.images[g.textures[ti].source];
  const { data: px, info } = await sharp(view(src.bufferView)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const im = { px, w: info.width, h: info.height };
  images.set(ti, im);
  return im;
}
const colors = [];
for (const mesh of g.meshes) for (const p of mesh.primitives) {
  const a = g.accessors[p.attributes.TEXCOORD_0], v = g.bufferViews[a.bufferView];
  if (a.componentType !== 5126 || a.type !== 'VEC2') throw new Error('TEXCOORD_0 is not float VEC2');
  const mat = g.materials[p.material], ti = mat?.pbrMetallicRoughness?.baseColorTexture?.index;
  const im = ti === undefined ? null : await image(ti);
  const f = mat?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
  const stride = v.byteStride ?? 8, base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  for (let j = 0; j < a.count; j++) {
    if (!im) { colors.push(f.slice(0, 3).map((x) => Math.round(x * 255))); continue; }
    const u = data.readFloatLE(base + j * stride), w = data.readFloatLE(base + j * stride + 4);
    const x = Math.min(im.w - 1, Math.max(0, Math.floor(u * im.w))), y = Math.min(im.h - 1, Math.max(0, Math.floor(w * im.h)));
    const k = (y * im.w + x) * 3;
    colors.push([im.px[k], im.px[k + 1], im.px[k + 2]]);
  }
}
writeFileSync(join(dir, 'colors.json'), JSON.stringify(colors));
console.log(`${dir}: ${colors.length} vertex colours`);
