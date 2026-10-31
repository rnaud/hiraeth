// The flyers' shipped bodies (issue #800, family B): a trial's prepared asset (references/enemy-redesign-2026-10-30/
// trials/<foe>-tripo/: tripo-lod.glb, landmarks.json and flat-texture.png, made by prepare.mjs there from the untouched
// export) as the game's file, public/enemies/<concept>/body.glb, read by src/enemies/plans/<concept>-tripo.js — as
// scripts/tripo/ship-shellback.mjs ships the crab's:
//
// - the same mesh, its triangles grouped by part (extras.parts), positions, normals, UVs and COLOR_0 (the flat colours:
//   what the engines draw, as their VMs decode no picture: engine/boot.js COLOURED_PICTURES);
// - its indices as 16 bits;
// - no texture: every skin draws the vertex colours (the home skin's are the flat texture's own), as the other
//   generated bodies loaded by src/enemies/foe-assets.js do;
// - the landmarks the rig is fitted to beside it, landmarks.json (foe-assets.js reads the two files), and in its extras.
//
//   node scripts/tripo/ship-flyer.mjs jelly|moth|ray        (deterministic: the same inputs write the same bytes)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGlb } from '../../references/enemy-redesign-2026-10-30/trials/shellback-tripo/glb.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
/** Each flyer: its trial folder and its shipped file. */
export const FLYERS = {
  jelly: { trial: 'jelly-tripo', shipped: 'public/enemies/cloud-jelly/body.glb', name: 'cloud jelly' },
  moth: { trial: 'moth-tripo', shipped: 'public/enemies/lamp-moth/body.glb', name: 'lamp moth' },
  ray: { trial: 'ray-tripo', shipped: 'public/enemies/storm-ray/body.glb', name: 'storm ray' },
};
const which = process.argv[2], F = FLYERS[which];
if (!F) throw new Error(`which flyer? ${Object.keys(FLYERS).join(' | ')}`);
const TRIAL = join(ROOT, 'references/enemy-redesign-2026-10-30/trials', F.trial);
const b = readFileSync(join(TRIAL, 'tripo-lod.glb')), jn = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)); };
const p = json.meshes[0].primitives[0], extras = json.meshes[0].extras;
const P = acc(p.attributes.POSITION), N = acc(p.attributes.NORMAL), UV = acc(p.attributes.TEXCOORD_0), COL = acc(p.attributes.COLOR_0), I32 = acc(p.indices);
if (P.length / 3 > 65535) throw new Error('too many vertices for 16-bit indices');
const I = Uint16Array.from(I32);
const landmarks = JSON.parse(readFileSync(join(TRIAL, 'landmarks.json'), 'utf8'));
const glb = writeGlb({ attrs: { POSITION: P, NORMAL: N, TEXCOORD_0: UV, COLOR_0: COL }, indices: I, image: null, name: F.name,
  extras: { ...extras, source: `references/enemy-redesign-2026-10-30/trials/${F.trial}/tripo-lod.glb`, landmarks } });
mkdirSync(join(ROOT, dirname(F.shipped)), { recursive: true });
writeFileSync(join(ROOT, F.shipped), glb);
writeFileSync(join(ROOT, dirname(F.shipped), 'landmarks.json'), JSON.stringify(landmarks) + '\n');
const sha = createHash('sha256').update(glb).digest('hex').slice(0, 16);
console.log(JSON.stringify({ file: F.shipped, bytes: glb.length, sha, vertices: P.length / 3, triangles: I.length / 3, parts: extras.parts }));
