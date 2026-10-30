// #800 phase 2b: the hound's Tripo generation from the approved image (hound/5d7b275f-…-1.png), unchanged; the
// shellback's generate.mjs with the hound's paths. Image to model, H3.1, textured, PBR off, Remove Lighting on (the
// API's `delight`, read by texture model v3.5 only), 30k face target. Then (--rig) Tripo's free rig check and its
// quadruped rig (v2.5), to see whether its skeleton and weights can carry the game's legs. The untouched exports and
// the task record go to the hound folder's tripo/.
//
//   node references/enemy-redesign-2026-10-30/trials/hound-tripo/generate.mjs [--dry] [--rig]
//
// The key: TRIPO_3D_API_KEY from the main checkout's .env (read here, never printed).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tripo from '../../../../scripts/reference-lab/providers/tripo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const SRC_REL = 'references/enemy-redesign-2026-10-30/hound/5d7b275f-a6fd-4e34-a0fe-7c6d4ebc850a-1.png';
const SRC = join(ROOT, SRC_REL);
const OUT = join(ROOT, 'references/enemy-redesign-2026-10-30/hound/tripo');
const ENV = process.env.HIRAETH_ENV ?? '/Users/anf/projects/moebius/.env';
const key = process.env.TRIPO_3D_API_KEY ?? readFileSync(ENV, 'utf8').match(/^TRIPO_3D_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no TRIPO_3D_API_KEY');
const BODY = { model: 'v3.1-20260211', texture: true, pbr: false, texture_quality: 'standard', texture_version: 'v3.5-20260815', delight: true,
  texture_alignment: 'original_image', face_limit: 30000, export_uv: true };
const ctx = { key, pollEvery: 3000, timeout: 900000 };
const sha = (b) => createHash('sha256').update(b).digest('hex');
mkdirSync(OUT, { recursive: true });
const before = await tripo.balance(ctx);
console.log('balance before', before);
if (process.argv.includes('--dry')) process.exit(0);
const recordFile = join(OUT, 'task.json');

if (!existsSync(recordFile)) {
  const bytes = readFileSync(SRC);
  const token = await tripo.upload({ bytes, mime: 'image/png', name: 'hound.png' }, ctx);
  const started = new Date().toISOString();
  let taskId = null;
  const gen = await tripo.runTask('/generation/image-to-model', { input: token, ...BODY }, { ...ctx, onTask: (id) => { taskId = id; console.log('task', id); } }, (p, s) => console.log('progress', s, p));
  const out = gen.output ?? {};
  const model = await tripo.fetchOutput(out.model_url ?? out.pbr_model_url ?? out.base_model_url, ctx);
  writeFileSync(join(OUT, 'model.glb'), model.bytes);
  let preview = null;
  if (out.rendered_image_url) { preview = await tripo.fetchOutput(out.rendered_image_url, ctx).catch(() => null); if (preview) writeFileSync(join(OUT, `preview.${preview.format}`), preview.bytes); }
  const after = await tripo.balance(ctx);
  const record = { issue: 800, phase: '2b', source: SRC_REL, sourceSha256: sha(bytes),
    endpoint: 'POST /v3/generation/image-to-model', request: BODY, task: taskId ?? gen.task_id, started, finished: new Date().toISOString(),
    creditsConsumed: gen.credits_consumed ?? null, balanceBefore: before.balance, balanceAfter: after.balance,
    model: { file: 'model.glb', bytes: model.bytes.length, sha256: sha(model.bytes), format: model.format }, preview: preview ? { file: `preview.${preview.format}`, bytes: preview.bytes.length } : null };
  writeFileSync(recordFile, JSON.stringify(record, null, 2) + '\n');
  console.log('done', JSON.stringify({ task: record.task, credits: record.creditsConsumed, before: before.balance, after: after.balance, bytes: model.bytes.length }));
}

if (process.argv.includes('--rig')) {
  const record = JSON.parse(readFileSync(recordFile, 'utf8'));
  if (record.rig) throw new Error('already rigged: ' + record.rig.task);
  const b0 = await tripo.balance(ctx);
  const rc = await tripo.runTask('/animations/rig-check', { input: record.task }, ctx);
  console.log('rig check', JSON.stringify(rc.output));
  record.rigCheck = { task: rc.task_id, output: rc.output, credits: rc.credits_consumed ?? 0 };
  if (rc.output?.riggable && rc.output.rig_type === 'quadruped') {
    const body = { input: record.task, model: 'v2.5-20260210', rig_type: 'quadruped', spec: 'tripo', out_format: 'glb' };
    const r = await tripo.runTask('/animations/rig', body, ctx, (p, s) => console.log('rig', s, p));
    const file = await tripo.fetchOutput(r.output?.model_url, ctx);
    writeFileSync(join(OUT, 'rigged.glb'), file.bytes);
    const b1 = await tripo.balance(ctx);
    record.rig = { endpoint: 'POST /v3/animations/rig', request: body, task: r.task_id, creditsConsumed: r.credits_consumed ?? null, balanceBefore: b0.balance, balanceAfter: b1.balance,
      model: { file: 'rigged.glb', bytes: file.bytes.length, sha256: sha(file.bytes) } };
    console.log('rigged', JSON.stringify({ task: r.task_id, credits: r.credits_consumed, before: b0.balance, after: b1.balance }));
  }
  writeFileSync(recordFile, JSON.stringify(record, null, 2) + '\n');
}
