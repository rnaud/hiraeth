// #800 phase 2: the dune mummer's Tripo generation and rig, from the author's T-pose picks (keep-mummer/tpose/:
// sheet-1.jpg front and back, sheet-2.jpg the left side). Multiview to model (front, back, left: one subject a
// picture, each cut from its sheet to the body and set on a square of the sheet's own cream at the same body height),
// H3.1, textured, PBR off, Remove Lighting on (`delight`, texture model v3.5), 30k face target. Then Tripo's rig check
// (free) and its humanoid rig (biped, Mixamo bone names). The untouched exports, the views as sent and the task record
// go to keep-mummer/tripo/.
//
//   node references/enemy-redesign-2026-10-30/trials/mummer-tripo/generate.mjs [--dry]
//
// The key: TRIPO_3D_API_KEY from the main checkout's .env (read here, never printed).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import tripo from '../../../../scripts/reference-lab/providers/tripo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const TPOSE = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-mummer/tpose');
const OUT = join(ROOT, 'references/enemy-redesign-2026-10-30/keep-mummer/tripo');
const ENV = process.env.HIRAETH_ENV ?? '/Users/anf/projects/moebius/.env';
const key = process.env.TRIPO_3D_API_KEY ?? readFileSync(ENV, 'utf8').match(/^TRIPO_3D_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no TRIPO_3D_API_KEY');
/** Each view's body box in its sheet (px [x, y, w, h]: the pixels off the cream by more than 60, measured). */
const VIEWS = [
  { view: 'front', sheet: 'sheet-1.jpg', box: [55, 132, 712, 581] },
  { view: 'back', sheet: 'sheet-1.jpg', box: [773, 132, 710, 580] },
  { view: 'left', sheet: 'sheet-2.jpg', box: [568, 139, 457, 1218] },
];
/** The body's height on its square, the square's side (px). */
const FILL = 0.72, SIZE = 1024;
const BODY = { model: 'v3.1-20260211', texture: true, pbr: false, texture_quality: 'standard', texture_version: 'v3.5-20260815', delight: true,
  texture_alignment: 'original_image', face_limit: 30000, export_uv: true };
const RIG = { model: 'v1.0-20240301', rig_type: 'biped', spec: 'mixamo', out_format: 'glb' };
const ctx = { key, pollEvery: 3000, timeout: 900000 };
const sha = (b) => createHash('sha256').update(b).digest('hex');
mkdirSync(OUT, { recursive: true });

/** A view cut to its body and centred on a square of its sheet's cream, the body FILL of the height (PNG). */
async function viewPng({ sheet, box: [x, y, w, h] }) {
  const file = join(TPOSE, sheet);
  const { data } = await sharp(file).extract({ left: 2, top: 2, width: 1, height: 1 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = { r: data[0], g: data[1], b: data[2] }, m = 6, W = w + 2 * m, H = h + 2 * m, side = Math.round(h / FILL);
  const cut = await sharp(file).extract({ left: x - m, top: y - m, width: W, height: H }).toBuffer();
  const px = Math.round((side - W) / 2), py = Math.round((side - H) / 2);
  const sq = await sharp(cut).extend({ left: px, right: side - W - px, top: py, bottom: side - H - py, background: bg }).png().toBuffer();
  return sharp(sq).resize(SIZE, SIZE).png().toBuffer();
}

const before = await tripo.balance(ctx);
console.log('balance before', before);
const views = [];
for (const V of VIEWS) { const png = await viewPng(V); writeFileSync(join(OUT, `view-${V.view}.png`), png); views.push({ ...V, png }); }
if (process.argv.includes('--dry')) process.exit(0);
const recFile = join(OUT, 'task.json');
let record = existsSync(recFile) ? JSON.parse(readFileSync(recFile, 'utf8')) : null;
if (!record) {
  const inputs = [];
  for (const v of views) inputs.push({ [v.view]: await tripo.upload({ bytes: v.png, mime: 'image/png', name: `mummer-${v.view}.png` }, ctx) });
  const started = new Date().toISOString();
  let taskId = null;
  const gen = await tripo.runTask('/generation/multiview-to-model', { inputs, ...BODY }, { ...ctx, onTask: (id) => { taskId = id; console.log('task', id); } }, (p, s) => console.log('progress', s, p));
  const out = gen.output ?? {};
  const model = await tripo.fetchOutput(out.model_url ?? out.pbr_model_url ?? out.base_model_url, ctx);
  writeFileSync(join(OUT, 'model.glb'), model.bytes);
  let preview = null;
  if (out.rendered_image_url) { preview = await tripo.fetchOutput(out.rendered_image_url, ctx).catch(() => null); if (preview) writeFileSync(join(OUT, `preview.${preview.format}`), preview.bytes); }
  const after = await tripo.balance(ctx);
  record = { issue: 800, phase: '2 (mummer)',
    sources: VIEWS.map((v, i) => ({ view: v.view, sheet: `references/enemy-redesign-2026-10-30/keep-mummer/tpose/${v.sheet}`, box: v.box, sent: `view-${v.view}.png`, sha256: sha(views[i].png) })),
    generation: { endpoint: 'POST /v3/generation/multiview-to-model', request: BODY, task: taskId ?? gen.task_id, started, finished: new Date().toISOString(),
      creditsConsumed: gen.credits_consumed ?? null, balanceBefore: before.balance, balanceAfter: after.balance,
      model: { file: 'model.glb', bytes: model.bytes.length, sha256: sha(model.bytes) }, preview: preview ? { file: `preview.${preview.format}`, bytes: preview.bytes.length } : null } };
  writeFileSync(recFile, JSON.stringify(record, null, 2) + '\n');
  console.log('generated', record.generation.task, record.generation.creditsConsumed);
}
if (!record.rig) {
  const b0 = await tripo.balance(ctx);
  const check = await tripo.runTask('/animations/rig-check', { input: record.generation.task }, ctx);
  console.log('rig check', JSON.stringify(check.output));
  let rigTask = null;
  const rig = await tripo.runTask('/animations/rig', { input: record.generation.task, ...RIG }, { ...ctx, onTask: (id) => { rigTask = id; console.log('rig task', id); } }, (p, s) => console.log('rig', s, p));
  const model = await tripo.fetchOutput(rig.output?.model_url, ctx);
  writeFileSync(join(OUT, 'rigged.glb'), model.bytes);
  const b1 = await tripo.balance(ctx);
  record.rig = { check: { endpoint: 'POST /v3/animations/rig-check', task: check.task_id, output: check.output ?? null, creditsConsumed: check.credits_consumed ?? 0 },
    endpoint: 'POST /v3/animations/rig', request: RIG, task: rigTask ?? rig.task_id, creditsConsumed: rig.credits_consumed ?? null, balanceBefore: b0.balance, balanceAfter: b1.balance,
    model: { file: 'rigged.glb', bytes: model.bytes.length, sha256: sha(model.bytes) } };
  writeFileSync(recFile, JSON.stringify(record, null, 2) + '\n');
  console.log('rigged', record.rig.task, record.rig.creditsConsumed, b0.balance, '→', b1.balance);
}
