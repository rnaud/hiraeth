// #800 family F (creatures and spirits): one foe's Tripo generation from its approved image, unchanged. The
// shellback's recipe (../shellback-tripo/generate.mjs): image to model, H3.1, textured, PBR off, Remove Lighting on (the
// API's `delight`, read by texture model v3.5 only), 30k face target. The untouched export and the task record go to the
// concept folder's tripo/. Refuses to run once task.json exists, or if the balance would fall under the floor.
//
//   node references/enemy-redesign-2026-10-30/trials/familyF-tripo/generate.mjs <blot|worm|rootknot|wisp> [--dry] [--again <n>]
//   (--again n: a second try from the same picture, into tripo/again-<n>/, when the first came out wrong: the root knot's
//   first had five legs where the reference draws six)
//
// The key: TRIPO_3D_API_KEY from the main checkout's .env (read here, never printed).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tripo from '../../../../scripts/reference-lab/providers/tripo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
/** Each foe's approved image (tools/enemy-review-references.js, zero-based index). */
export const FOES = {
  blot: { concept: 'blob', image: 'eb43fb37-f063-47ab-9a4f-212ba29d443b-2.png' },
  worm: { concept: 'dune-worm', image: 'ca727e90-9d58-49d2-a060-bbbd815e325f-3.png' },
  rootknot: { concept: 'reed-knot', image: '0de92fb6-aa84-4252-b110-fd96a9913888-1.png' },
  wisp: { concept: 'keep-wisp', image: '885e3431-b1b8-4db6-ad7b-c772cd14d530-3.png' },
};
const FLOOR = 400, COST = 30;
const foe = FOES[process.argv[2]];
if (!foe) throw new Error(`which foe: ${Object.keys(FOES).join(' | ')}`);
const SRC_REL = `references/enemy-redesign-2026-10-30/${foe.concept}/${foe.image}`, SRC = join(ROOT, SRC_REL);
const again = process.argv.includes('--again') ? process.argv[process.argv.indexOf('--again') + 1] : null;
const OUT = join(ROOT, `references/enemy-redesign-2026-10-30/${foe.concept}/tripo${again ? `/again-${again}` : ''}`);
const ENV = process.env.HIRAETH_ENV ?? '/Users/anf/projects/moebius/.env';
const key = process.env.TRIPO_3D_API_KEY ?? readFileSync(ENV, 'utf8').match(/^TRIPO_3D_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no TRIPO_3D_API_KEY');
const BODY = { model: 'v3.1-20260211', texture: true, pbr: false, texture_quality: 'standard', texture_version: 'v3.5-20260815', delight: true,
  texture_alignment: 'original_image', face_limit: 30000, export_uv: true };
const ctx = { key, pollEvery: 3000, timeout: 900000 };
const before = await tripo.balance(ctx);
console.log('balance before', before.balance);
if (process.argv.includes('--dry')) process.exit(0);
if (existsSync(join(OUT, 'task.json'))) throw new Error('already generated: ' + join(OUT, 'task.json'));
if (before.balance - COST < FLOOR) throw new Error(`the balance ${before.balance} would fall under the floor ${FLOOR}: stopped`);
mkdirSync(OUT, { recursive: true });
const bytes = readFileSync(SRC);
const token = await tripo.upload({ bytes, mime: 'image/png', name: `${process.argv[2]}.png` }, ctx);
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
const record = { issue: 800, phase: 'family F', foe: process.argv[2], source: SRC_REL, sourceSha256: sha(bytes),
  endpoint: 'POST /v3/generation/image-to-model', request: BODY, task: taskId ?? gen.task_id, started, finished: new Date().toISOString(),
  creditsConsumed: gen.credits_consumed ?? null, balanceBefore: before.balance, balanceAfter: after.balance, floor: FLOOR,
  model: { file: 'model.glb', bytes: model.bytes.length, sha256: sha(model.bytes), format: model.format }, preview: preview ? { file: `preview.${preview.format}`, bytes: preview.bytes.length, sha256: sha(preview.bytes) } : null };
writeFileSync(join(OUT, 'task.json'), JSON.stringify(record, null, 2) + '\n');
console.log('done', JSON.stringify({ task: record.task, credits: record.creditsConsumed, before: before.balance, after: after.balance, bytes: model.bytes.length }));
