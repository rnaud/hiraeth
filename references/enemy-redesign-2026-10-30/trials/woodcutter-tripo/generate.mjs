// #800 phase 2b: the wood cutter's Tripo generation from the approved image (keep-brute/a1860f49-…-0.png), unchanged.
// Image to model, H3.1, textured, PBR off, Remove Lighting on (the API's `delight`, read by texture model v3.5 only),
// 30k face target. The untouched export and the task record go to keep-brute/tripo/.
//
//   node references/enemy-redesign-2026-10-30/trials/woodcutter-tripo/generate.mjs [--dry]
//
// The key: TRIPO_3D_API_KEY from the main checkout's .env (read here, never printed).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tripo from '../../../../scripts/reference-lab/providers/tripo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SRC = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-brute/a1860f49-ecc5-4922-91f6-94b031e5e9a7-0.png');
const OUT = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-brute/tripo');
const ENV = process.env.HIRAETH_ENV ?? '/Users/anf/projects/moebius/.env';
const key = process.env.TRIPO_3D_API_KEY ?? readFileSync(ENV, 'utf8').match(/^TRIPO_3D_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no TRIPO_3D_API_KEY');
const BODY = { model: 'v3.1-20260211', texture: true, pbr: false, texture_quality: 'standard', texture_version: 'v3.5-20260815', delight: true,
  texture_alignment: 'original_image', face_limit: 30000, export_uv: true };
const ctx = { key, pollEvery: 3000, timeout: 900000 };
mkdirSync(OUT, { recursive: true });
const before = await tripo.balance(ctx);
console.log('balance before', before);
if (process.argv.includes('--dry')) process.exit(0);
if (existsSync(join(OUT, 'task.json'))) throw new Error('already generated: ' + join(OUT, 'task.json'));
const bytes = readFileSync(SRC);
const token = await tripo.upload({ bytes, mime: 'image/png', name: 'woodcutter.png' }, ctx);
const started = new Date().toISOString();
let taskId = null;
const gen = await tripo.runTask('/generation/image-to-model', { input: token, ...BODY }, { ...ctx, onTask: (id) => { taskId = id; console.log('task', id); } }, (p, s) => console.log('progress', s, p));
const out = gen.output ?? {};
const model = await tripo.fetchOutput(out.model_url ?? out.pbr_model_url ?? out.base_model_url, ctx);
writeFileSync(join(OUT, 'model.glb'), model.bytes);
let preview = null;
if (out.rendered_image_url) { preview = await tripo.fetchOutput(out.rendered_image_url, ctx).catch(() => null); if (preview) writeFileSync(join(OUT, `preview.${preview.format}`), preview.bytes); }
const after = await tripo.balance(ctx);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const record = { issue: 800, phase: '2b', foe: 'brute (wood cutter)', source: 'references/enemy-redesign-2026-10-30/keep-brute/a1860f49-ecc5-4922-91f6-94b031e5e9a7-0.png', sourceSha256: sha(bytes),
  endpoint: 'POST /v3/generation/image-to-model', request: BODY, task: taskId ?? gen.task_id, started, finished: new Date().toISOString(),
  creditsConsumed: gen.credits_consumed ?? null, balanceBefore: before.balance, balanceAfter: after.balance,
  model: { file: 'model.glb', bytes: model.bytes.length, sha256: sha(model.bytes), format: model.format }, preview: preview ? { file: `preview.${preview.format}`, bytes: preview.bytes.length } : null };
writeFileSync(join(OUT, 'task.json'), JSON.stringify(record, null, 2) + '\n');
console.log('done', JSON.stringify({ task: record.task, credits: record.creditsConsumed, before: before.balance, after: after.balance, bytes: model.bytes.length }));
