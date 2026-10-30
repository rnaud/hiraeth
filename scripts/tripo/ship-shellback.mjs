// The shellback crab's shipped body (issue #800): the Tripo trial's asset (references/enemy-redesign-2026-10-30/trials/
// shellback-tripo/: tripo-lod.glb, landmarks.json and flat-texture.png, made by prepare.mjs there from the untouched
// export) as the game's file, public/enemies/shellback/body.glb, read by src/enemies/plans/shellback-tripo.js:
//
// - the same mesh (12,592 triangles, the dome's first), positions, normals, UVs and COLOR_0 (the five flat colours: what
//   the engines draw, as their VMs decode no picture: engine/boot.js COLOURED_PICTURES);
// - its indices as 16 bits (8,548 vertices): 74 KB fewer;
// - the flat texture at 512² (it holds five flat colours, one a part: nearest, so no new colour is made), 1.33 MB of
//   GPU memory with its mips where the trial's 1024² took 5.33;
// - the landmarks the rig is fitted to in the mesh's extras (one file to load).
//
//   node scripts/tripo/ship-shellback.mjs        (deterministic: the same inputs write the same bytes)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { writeGlb } from '../../references/enemy-redesign-2026-10-30/trials/shellback-tripo/glb.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TRIAL = join(ROOT, 'references/enemy-redesign-2026-10-30/trials/shellback-tripo');
export const SHIPPED = 'public/enemies/shellback/body.glb';
const TEX = 512;

const b = readFileSync(join(TRIAL, 'tripo-lod.glb')), jn = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)); };
const p = json.meshes[0].primitives[0], extras = json.meshes[0].extras;
const P = acc(p.attributes.POSITION), N = acc(p.attributes.NORMAL), UV = acc(p.attributes.TEXCOORD_0), COL = acc(p.attributes.COLOR_0), I32 = acc(p.indices);
if (P.length / 3 > 65535) throw new Error('too many vertices for 16-bit indices');
const I = Uint16Array.from(I32);
const landmarks = JSON.parse(readFileSync(join(TRIAL, 'landmarks.json'), 'utf8'));
const png = await sharp(readFileSync(join(TRIAL, 'flat-texture.png'))).resize(TEX, TEX, { kernel: 'nearest' }).removeAlpha()
  .png({ compressionLevel: 9, palette: true, colours: 8, dither: 0 }).toBuffer();
const glb = writeGlb({ attrs: { POSITION: P, NORMAL: N, TEXCOORD_0: UV, COLOR_0: COL }, indices: I, image: png, name: 'shellback',
  extras: { ...extras, source: 'references/enemy-redesign-2026-10-30/trials/shellback-tripo/tripo-lod.glb', texture: TEX, landmarks } });
mkdirSync(join(ROOT, dirname(SHIPPED)), { recursive: true });
writeFileSync(join(ROOT, SHIPPED), glb);
const sha = createHash('sha256').update(glb).digest('hex').slice(0, 16);
console.log(JSON.stringify({ file: SHIPPED, bytes: glb.length, sha, vertices: P.length / 3, triangles: I.length / 3, dome: extras.domeTriangles, texture: TEX, pngBytes: png.length }));
