// The v2 traveller's models in the build (issue #493): data/characters/traveller-v2/ is the Blender pipeline's output
// (scripts/blender/traveller/: the .blend, the previews, the GLBs and their manifests) and stays where it is; a build
// copies what the game loads (src/characters/traveller-v2.js: outfits.json, the base manifest and GLB, each outfit's
// manifest and GLB) to the same path under dist/, so the site, the Android app and the over-the-air bundle carry it
// as they carry public/'s files. The .blend and the previews stay out, and the base GLB's head and hair (the game
// draws its own portrait head). The dev server serves data/ as it is.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const V2_DIR = 'data/characters/traveller-v2/';
/** The base GLB's meshes the game never draws: his head and hair (it keeps its own portrait head, head-v3), left out of
 * the shipped copy (1.3 MB). The Blender pipeline's GLB in data/ keeps them. */
export const UNSHIPPED_NODES = ['Head', 'Hair'];

/**
 * A GLB without the meshes of the nodes named `drop` (the nodes stay, empty), and without the accessors and buffer
 * views only they used, its binary packed again. Everything else (the skin, the materials, the atlas) as it was.
 */
export function pruneGlb(buf, drop) {
  const n = buf.readUInt32LE(12), json = JSON.parse(buf.toString('utf8', 20, 20 + n));
  const binLen = buf.readUInt32LE(20 + n), bin = buf.subarray(28 + n, 28 + n + binLen);
  const keepMesh = new Set();
  for (const node of json.nodes ?? []) {
    if (node.mesh === undefined) continue;
    if (drop.includes(node.name)) { delete node.mesh; delete node.skin; } else keepMesh.add(node.mesh);
  }
  const reindex = (list, keep) => { const map = new Map(), out = []; list.forEach((x, i) => { if (keep(i)) { map.set(i, out.length); out.push(x); } }); return { map, out }; };
  const meshes = reindex(json.meshes, (i) => keepMesh.has(i));
  json.meshes = meshes.out;
  for (const node of json.nodes) if (node.mesh !== undefined) node.mesh = meshes.map.get(node.mesh);
  const used = new Set(), prims = json.meshes.flatMap((m) => m.primitives);
  for (const p of prims) {
    for (const a of Object.values(p.attributes)) used.add(a);
    if (p.indices !== undefined) used.add(p.indices);
    for (const t of p.targets ?? []) for (const a of Object.values(t)) used.add(a);
  }
  for (const s of json.skins ?? []) if (s.inverseBindMatrices !== undefined) used.add(s.inverseBindMatrices);
  const acc = reindex(json.accessors, (i) => used.has(i));
  json.accessors = acc.out;
  const A = (i) => acc.map.get(i);
  for (const p of prims) {
    for (const k of Object.keys(p.attributes)) p.attributes[k] = A(p.attributes[k]);
    if (p.indices !== undefined) p.indices = A(p.indices);
    for (const t of p.targets ?? []) for (const k of Object.keys(t)) t[k] = A(t[k]);
  }
  for (const s of json.skins ?? []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = A(s.inverseBindMatrices);
  const views = new Set();
  for (const a of json.accessors) {
    if (a.bufferView !== undefined) views.add(a.bufferView);
    if (a.sparse) { views.add(a.sparse.indices.bufferView); views.add(a.sparse.values.bufferView); }
  }
  for (const im of json.images ?? []) if (im.bufferView !== undefined) views.add(im.bufferView);
  const bv = reindex(json.bufferViews, (i) => views.has(i));
  const parts = [];
  let at = 0;
  for (const v of bv.out) {
    const data = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const pad = (4 - (at % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); at += pad; }
    v.byteOffset = at;
    parts.push(data);
    at += data.length;
  }
  json.bufferViews = bv.out;
  const V = (i) => bv.map.get(i);
  for (const a of json.accessors) {
    if (a.bufferView !== undefined) a.bufferView = V(a.bufferView);
    if (a.sparse) { a.sparse.indices.bufferView = V(a.sparse.indices.bufferView); a.sparse.values.bufferView = V(a.sparse.values.bufferView); }
  }
  for (const im of json.images ?? []) if (im.bufferView !== undefined) im.bufferView = V(im.bufferView);
  const tail = (4 - (at % 4)) % 4;
  if (tail) parts.push(Buffer.alloc(tail));
  const binOut = Buffer.concat(parts);
  json.buffers = [{ byteLength: binOut.length }];
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - (text.length % 4), 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + text.length + 8 + binOut.length, 8);
  jh.writeUInt32LE(text.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(binOut.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, text, bh, binOut]);
}

/** What the game loads of the v2 traveller, as paths from the project's root (in the order it loads them). */
export function shippedFiles(root = '.') {
  const list = JSON.parse(readFileSync(join(root, V2_DIR, 'outfits.json'), 'utf8'));
  const out = [V2_DIR + 'outfits.json', V2_DIR + (list.manifest ?? 'manifest.json'), V2_DIR + list.base];
  for (const o of list.outfits) {
    if (!o.dir) continue;
    const manifest = JSON.parse(readFileSync(join(root, V2_DIR, o.dir, 'manifest.json'), 'utf8'));
    out.push(V2_DIR + o.dir + 'manifest.json', V2_DIR + o.dir + manifest.glb);
  }
  return out;
}

/** A shipped file's bytes: the base GLB without what the game never draws (UNSHIPPED_NODES), the rest as they are. */
export function shippedBytes(f, root = '.') {
  const buf = readFileSync(join(root, f));
  const list = JSON.parse(readFileSync(join(root, V2_DIR, 'outfits.json'), 'utf8'));
  return f === V2_DIR + list.base ? pruneGlb(buf, UNSHIPPED_NODES) : buf;
}

/** The Vite plugin: a build emits shippedFiles at their own paths. */
export function travellerV2Plugin(root = '.') {
  return {
    name: 'traveller-v2-models',
    apply: 'build',
    generateBundle() {
      for (const f of shippedFiles(root)) this.emitFile({ type: 'asset', fileName: f, source: shippedBytes(f, root) });
    },
  };
}
