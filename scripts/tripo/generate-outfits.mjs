// Tripo outfit trial (#682): one multiview-to-model generation per outfit from the cropped turnaround views
// (crop-outfit-sheets.mjs), through the reference lab's Tripo client (key from .env via env.mjs, never printed).
//
//   node scripts/tripo/generate-outfits.mjs <id> [--retry]
//   → output/tripo-outfits/<id>/<task>/  every file the task returned, untouched, plus task.json
//
// Settings: H3.1 geometry, Smart Mesh (smart_low_poly, 20k triangle ceiling), textured PBR, detailed texture on the
// v3.5 texture model with delight (Studio's "Remove Lighting"), colours matched to the input pictures.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { keyFor, loadKeys } from '../reference-lab/env.mjs';
import tripo from '../reference-lab/providers/tripo.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const id = process.argv[2];
if (!id) throw new Error('usage: generate-outfits.mjs <outfit id>');
const key = keyFor(tripo, loadKeys(ROOT));
if (!key) throw new Error('no Tripo key in the environment or .env');
const ctx = { key, timeout: 1800000, pollEvery: 4000 };

export const SETTINGS = {
  model: 'v3.1-20260211',
  texture: true, pbr: true,
  texture_version: 'v3.5-20260815', texture_quality: 'detailed', delight: true,
  texture_alignment: 'original_image',
  smart_low_poly: true, face_limit: 20000,
};

const refDir = join(ROOT, `data/characters/tripo-outfits/${id}/reference`);
const views = ['front', 'left', 'back'];
const before = await tripo.balance(ctx);
console.log(id, 'balance before', before.balance);
const inputs = [];
for (const view of views) {
  const token = await tripo.upload({ bytes: readFileSync(join(refDir, `${view}.png`)), mime: 'image/png', name: `${view}.png` }, ctx);
  inputs.push({ [view]: token });
}
const body = { inputs, ...SETTINGS };
let lastP = -1;
const task = await tripo.runTask('/generation/multiview-to-model', body, { ...ctx, onTask: (t) => console.log(id, 'task', t) }, (p, s) => { if (p !== lastP) { lastP = p; console.log(id, s, p); } });
const out = join(ROOT, `output/tripo-outfits/${id}/${task.task_id}`);
mkdirSync(out, { recursive: true });
const files = {};
for (const [name, url] of Object.entries(task.output ?? {})) {
  if (typeof url !== 'string' || !/^https:/.test(url)) continue;
  try {
    const f = await tripo.fetchOutput(url, ctx);
    const file = `${name}.${f.format}`;
    writeFileSync(join(out, file), f.bytes);
    files[name] = { file, bytes: f.bytes.length };
  } catch (e) { files[name] = { error: String(e.message).slice(0, 200) }; }
}
const after = await tripo.balance(ctx);
const record = {
  issue: 682, outfit: id, task: task.task_id, status: task.status, created: new Date().toISOString(),
  endpoint: '/v3/generation/multiview-to-model', views, settings: SETTINGS,
  credits_consumed: task.credits_consumed ?? null, balance: { before: before.balance, after: after.balance },
  files,
};
writeFileSync(join(out, 'task.json'), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record, null, 2));
if (!existsSync(join(out, files.model_url?.file ?? files.pbr_model_url?.file ?? '-'))) console.log(id, 'warning: no model file saved');
