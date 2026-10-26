// Tripo outfit trial (#682): the untouched exports (output/tripo-outfits/<id>/<task>/model_url.glb, ~10 MB each,
// git-ignored) inventoried and slimmed into a committed review copy:
//   data/characters/tripo-outfits/<id>/inventory.json   the task, settings, credits, the source's hash and budget
//   data/characters/tripo-outfits/<id>/preview.glb      the same mesh, every texture at 1024² JPEG (review only)
//
//   node scripts/tripo/prepare-tripo-outfits.mjs
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { readGlb, slimGlb, makeResize } from './slim-traveller-core.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const PREVIEW = { maxTexture: 1024, quality: 88 };

async function budget(buf) {
  const { json, bin } = readGlb(buf);
  let triangles = 0, vertices = 0;
  for (const m of json.meshes ?? []) for (const p of m.primitives) {
    vertices += json.accessors[p.attributes.POSITION].count;
    triangles += (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3;
  }
  const images = [];
  let decoded = 0;
  for (const [index, img] of (json.images ?? []).entries()) {
    const v = json.bufferViews[img.bufferView];
    const bytes = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const meta = await sharp(bytes).metadata();
    images.push({ index, mimeType: img.mimeType, width: meta.width, height: meta.height, bytes: v.byteLength });
    decoded += meta.width * meta.height * 4 * (4 / 3);   // RGBA8 with mipmaps
  }
  const pos = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
  return {
    bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex'), triangles: Math.round(triangles), vertices,
    meshes: json.meshes.length, primitives: json.meshes.reduce((n, m) => n + m.primitives.length, 0), materials: json.materials,
    images, decodedTextureMiB: +(decoded / 2 ** 20).toFixed(2), skins: (json.skins ?? []).length, animations: (json.animations ?? []).length,
    bounds: { min: pos.min, max: pos.max },
  };
}

const resize = await makeResize(PREVIEW);
for (const id of ['void-navigator', 'gravity-ranger']) {
  const dir = join(ROOT, `output/tripo-outfits/${id}`);
  if (!existsSync(dir)) { console.log(id, 'no export yet'); continue; }
  const tasks = readdirSync(dir).filter((t) => existsSync(join(dir, t, 'task.json')));
  const records = tasks.map((t) => JSON.parse(readFileSync(join(dir, t, 'task.json'), 'utf8'))).sort((a, b) => a.created.localeCompare(b.created));
  const pick = records.at(-1);
  const src = readFileSync(join(dir, pick.task, pick.files.model_url.file));
  const preview = await slimGlb(src, resize);
  const out = join(ROOT, `data/characters/tripo-outfits/${id}`);
  writeFileSync(join(out, 'preview.glb'), preview);
  const inventory = {
    issue: 682, outfit: id, review: 'tools/tripo-outfits-review.html',
    note: 'Review trial only, not in the game. The untouched export is git-ignored (over 10 MB); this file records it. preview.glb: the same positions, normals, UVs and triangles, its three textures re-encoded at 1024² JPEG.',
    reference: `references/characters/traveller-outfits/${id}/approved-reference.png`, inputs: 'reference/ (crop-recipe.json)',
    tripo: { task: pick.task, studio: `https://studio.tripo3d.ai/workspace/generate/${pick.task}`, endpoint: pick.endpoint, views: pick.views, settings: pick.settings, credits: pick.credits_consumed, balance: pick.balance, created: pick.created },
    attempts: records.map((r) => ({ task: r.task, credits: r.credits_consumed, created: r.created })),
    source: { path: `output/tripo-outfits/${id}/${pick.task}/${pick.files.model_url.file}`, ...(await budget(src)) },
    preview: { path: `data/characters/tripo-outfits/${id}/preview.glb`, textureSize: PREVIEW.maxTexture, ...(await budget(preview)) },
  };
  delete inventory.preview.materials;
  writeFileSync(join(out, 'inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(id, pick.task, `${(src.length / 1e6).toFixed(2)} MB → ${(preview.length / 1e6).toFixed(2)} MB`, inventory.source.triangles, 'tris', inventory.source.images.map((i) => `${i.width}²`).join(' '));
}
