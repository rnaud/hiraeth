// A family A foe's shipped body (issue #800: the toad, the centipede, the skitter): its Tripo trial asset
// (references/enemy-redesign-2026-10-30/trials/familyA-tripo/<foe>-lod.glb and <foe>-landmarks.json, made by
// prepare-<foe>.mjs there from the untouched export) as the game's files, public/enemies/<concept>/body.glb and
// landmarks.json, read by src/enemies/foe-assets.js:
//
// - the same mesh, its triangles grouped by part (one flat colour a part: each part its own mesh in the game, coloured by
//   its material, so no picture is needed), positions, normals and COLOR_0 (each part's flat colour: what the engines
//   and the trial page can draw by);
// - its indices as 16 bits;
// - no texture and no UVs: the parts are flat colours (the trial's 1024² texture stays in the trial);
// - the landmarks the rig is fitted to beside it, landmarks.json (src/enemies/foe-assets.js loads the two).
//
//   node scripts/tripo/ship-body.mjs <toad|centipede|skitter>     (deterministic: the same inputs write the same bytes)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGlb } from '../../references/enemy-redesign-2026-10-30/trials/shellback-tripo/glb.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const TRIAL = join(ROOT, 'references/enemy-redesign-2026-10-30/trials/familyA-tripo');
/** Each foe's shipped file (its concept's folder). */
export const SHIPPED = { toad: 'public/enemies/bellows-toad/body.glb', centipede: 'public/enemies/centipede/body.glb', skitter: 'public/enemies/skitter/body.glb' };
const foe = process.argv[2];
if (!SHIPPED[foe]) throw new Error(`which foe: ${Object.keys(SHIPPED).join(' | ')}`);

const b = readFileSync(join(TRIAL, `${foe}-lod.glb`)), jn = b.readUInt32LE(12), json = JSON.parse(b.toString('utf8', 20, 20 + jn)), bin = b.subarray(28 + jn);
const TY = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }, CO = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const acc = (i) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView], A = TY[a.componentType], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new A(bin.buffer.slice(bin.byteOffset + off, bin.byteOffset + off + a.count * CO[a.type] * A.BYTES_PER_ELEMENT)); };
const p = json.meshes[0].primitives[0], extras = json.meshes[0].extras;
const P = acc(p.attributes.POSITION), N = acc(p.attributes.NORMAL), COL = acc(p.attributes.COLOR_0), I32 = acc(p.indices);
if (P.length / 3 > 65535) throw new Error('too many vertices for 16-bit indices');
const I = Uint16Array.from(I32);
const landmarks = JSON.parse(readFileSync(join(TRIAL, `${foe}-landmarks.json`), 'utf8'));
const glb = writeGlb({ attrs: { POSITION: P, NORMAL: N, COLOR_0: COL }, indices: I, image: null, name: foe,
  extras: { ...extras, source: `references/enemy-redesign-2026-10-30/trials/familyA-tripo/${foe}-lod.glb` } });
mkdirSync(join(ROOT, dirname(SHIPPED[foe])), { recursive: true });
writeFileSync(join(ROOT, SHIPPED[foe]), glb);
// (the rig's landmarks beside it: src/enemies/foe-assets.js reads the two)
writeFileSync(join(ROOT, dirname(SHIPPED[foe]), 'landmarks.json'), JSON.stringify(landmarks) + '\n');
const sha = createHash('sha256').update(glb).digest('hex').slice(0, 16);
console.log(JSON.stringify({ file: SHIPPED[foe], bytes: glb.length, sha, vertices: P.length / 3, triangles: I.length / 3, parts: landmarks.parts }));
