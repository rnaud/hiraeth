// The horned hound's shipped body (issue #800): the Tripo trial's asset (references/enemy-redesign-2026-10-30/trials/
// hound-tripo/: tripo-lod.glb and landmarks.json, made by prepare.mjs there from Tripo's rigged export) as the game's
// file, public/enemies/hound/body.glb, read by src/enemies/plans/hound-tripo.js:
//
// - the same mesh (11,987 triangles), positions, normals, UVs, COLOR_0 (the seven flat colours: what the engines draw,
//   as their VMs decode no picture: engine/boot.js COLOURED_PICTURES) and Tripo's weights on the game's bones;
// - its indices as 16 bits;
// - the flat texture at 512² (nearest: its seven flat colours stay flat), 1.33 MB of GPU memory with its mips where the
//   trial's 1024² took 5.33; the texels the added horns and drips are coloured from moved to the middle of a patch of
//   their colour (at 512² the cream texel lay within a texel of the saddle's mauve: the horns came out grey);
// - the landmarks the rig is fitted to in the mesh's extras (one file to load).
//
//   node scripts/tripo/ship-hound.mjs [--tex 512]        (deterministic: the same inputs write the same bytes)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { writeGlb } from '../../references/enemy-redesign-2026-10-30/trials/shellback-tripo/glb.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TRIAL = join(ROOT, 'references/enemy-redesign-2026-10-30/trials/hound-tripo');
export const SHIPPED = 'public/enemies/hound/body.glb';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TEX = +opt('--tex', 512);

const b = readFileSync(join(TRIAL, 'tripo-lod.glb')), jn = b.readUInt32LE(12), j = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const acc = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], A = TY[a.componentType], off = v.byteOffset + (a.byteOffset ?? 0); return new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)); };
const p = j.meshes[0].primitives[0], attrs = {};
for (const k of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0']) attrs[k] = acc(p.attributes[k]);
if (attrs.POSITION.length / 3 > 65535) throw new Error('too many vertices for 16-bit indices');
const I = Uint16Array.from(acc(p.indices));
const iv = j.bufferViews[j.images[0].bufferView], png = bin.subarray(iv.byteOffset, iv.byteOffset + iv.byteLength);
const landmarks = JSON.parse(readFileSync(join(TRIAL, 'landmarks.json'), 'utf8'));
const small = await sharp(png).resize(TEX, TEX, { kernel: 'nearest' }).removeAlpha().png({ compressionLevel: 9, palette: true, colours: landmarks.palette.length, dither: 0 }).toBuffer();
const { data: px } = await sharp(small).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const hex = (x, y) => { const i = (y * TEX + x) * 3; return '#' + [px[i], px[i + 1], px[i + 2]].map((c) => c.toString(16).padStart(2, '0')).join(''); };
/** The centre of the nearest (2r+1)² patch of one colour to uv (glTF uv: v down from the top). */
const patch = (uv, colour, r = 3) => {
  let best = null, bd = Infinity;
  for (let y = r; y < TEX - r; y++) for (let x = r; x < TEX - r; x++) {
    const d = (x + 0.5 - uv[0] * TEX) ** 2 + (y + 0.5 - uv[1] * TEX) ** 2;
    if (d >= bd) continue;
    let ok = true; for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r && ok; dx++) ok = hex(x + dx, y + dy) === colour;
    if (ok) { best = [(x + 0.5) / TEX, (y + 0.5) / TEX]; bd = d; }
  }
  if (!best) throw new Error(`no patch of ${colour}`);
  return best.map((v) => +v.toFixed(6));
};
const shipped = { ...landmarks, creamUV: patch(landmarks.creamUV, landmarks.palette.at(-1)), coatUV: patch(landmarks.coatUV, landmarks.palette[0]) };
const glb = writeGlb({ attrs, indices: I, image: small, name: 'hound',
  extras: { ...j.meshes[0].extras, source: 'references/enemy-redesign-2026-10-30/trials/hound-tripo/tripo-lod.glb', texture: TEX, landmarks: shipped } });
mkdirSync(join(ROOT, dirname(SHIPPED)), { recursive: true });
writeFileSync(join(ROOT, SHIPPED), glb);
console.log(JSON.stringify({ file: SHIPPED, bytes: glb.length, texture: TEX, pngBytes: small.length, vertices: attrs.POSITION.length / 3, triangles: I.length / 3, sha: createHash('sha256').update(glb).digest('hex').slice(0, 16) }));
