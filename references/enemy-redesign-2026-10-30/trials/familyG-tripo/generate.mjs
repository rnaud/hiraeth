// #800 family G (the two-legged humanoids): a foe's Tripo generation and rig from its T-pose picks (<concept>/tpose/:
// sheet-1.jpg front and back, sheet-2.jpg the left side; picked by the agent, the author asleep: "keep going with your
// own recommendations", the reasons in tpose/manifest.json and the foe's README). The dune mummer's recipe
// (trials/mummer-tripo/generate.mjs): multiview to model (front, back, left: each view cut from its sheet to the body
// and set on a square of the sheet's own ground at the same body height), H3.1, textured, PBR off, Remove Lighting on
// (`delight`, texture model v3.5), 30k face target; then Tripo's rig check (free) and its biped rig (Mixamo names). The
// untouched exports, the views as sent and the task record go to <concept>/tripo/. The body boxes are measured off the
// sheet (the pixels off its ground by more than OFF; the front and the back split at the emptiest column near the middle).
//
//   node references/enemy-redesign-2026-10-30/trials/familyG-tripo/generate.mjs <mummerking|sentinel|hulk> [--dry]
//
// The key: TRIPO_3D_API_KEY from the main checkout's .env (read here, never printed).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import tripo from '../../../../scripts/reference-lab/providers/tripo.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
/** Each foe's concept folder. */
export const FOES = { mummerking: 'keep-mummerking', sentinel: 'sentinel', hulk: 'hulk' };
const foe = process.argv[2];
if (!FOES[foe]) throw new Error(`which foe? ${Object.keys(FOES).join(', ')}`);
const BASE = join(ROOT, 'references/enemy-redesign-2026-10-30', FOES[foe]);
const TPOSE = join(BASE, 'tpose'), OUT = join(BASE, 'tripo');
const ENV = process.env.HIRAETH_ENV ?? '/Users/anf/projects/moebius/.env';
const key = process.env.TRIPO_3D_API_KEY ?? readFileSync(ENV, 'utf8').match(/^TRIPO_3D_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!key) throw new Error('no TRIPO_3D_API_KEY');
/** The body's height on its square, the square's side (px); a pixel is the body's when off the ground by more than OFF. */
const FILL = 0.72, SIZE = 1024, OFF = 60;
const BODY = { model: 'v3.1-20260211', texture: true, pbr: false, texture_quality: 'standard', texture_version: 'v3.5-20260815', delight: true,
  texture_alignment: 'original_image', face_limit: 30000, export_uv: true };
const RIG = { model: 'v1.0-20240301', rig_type: 'biped', spec: 'mixamo', out_format: 'glb' };
const ctx = { key, pollEvery: 3000, timeout: 900000 };
const sha = (b) => createHash('sha256').update(b).digest('hex');
mkdirSync(OUT, { recursive: true });

/** A sheet's ground (its corner) and which pixels are off it: { w, h, bg, on(x, y) }. */
async function readSheet(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = [data[(2 * info.width + 2) * 3], data[(2 * info.width + 2) * 3 + 1], data[(2 * info.width + 2) * 3 + 2]];
  const on = (x, y) => { const i = (y * info.width + x) * 3; return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > OFF; };
  return { w: info.width, h: info.height, bg, on };
}
/** The box [x, y, w, h] of the pixels off the ground within columns [x0, x1). */
function boxOf(S, x0, x1) {
  let lx = Infinity, hx = -1, ly = Infinity, hy = -1;
  for (let y = 0; y < S.h; y++) for (let x = x0; x < x1; x++) if (S.on(x, y)) { lx = Math.min(lx, x); hx = Math.max(hx, x); ly = Math.min(ly, y); hy = Math.max(hy, y); }
  return [lx, ly, hx - lx + 1, hy - ly + 1];
}
/** The front and back of sheet-1 (split at the emptiest column of its middle fifth), the side of sheet-2. */
async function measure() {
  const s1 = await readSheet(join(TPOSE, 'sheet-1.jpg')), s2 = await readSheet(join(TPOSE, 'sheet-2.jpg'));
  let split = s1.w >> 1, least = Infinity;
  for (let x = Math.round(s1.w * 0.4); x < Math.round(s1.w * 0.6); x++) { let k = 0; for (let y = 0; y < s1.h; y++) if (s1.on(x, y)) k++; if (k < least) { least = k; split = x; } }
  return [
    { view: 'front', sheet: 'sheet-1.jpg', box: boxOf(s1, 4, split), bg: s1.bg },
    { view: 'back', sheet: 'sheet-1.jpg', box: boxOf(s1, split, s1.w - 4), bg: s1.bg },
    { view: 'left', sheet: 'sheet-2.jpg', box: boxOf(s2, 4, s2.w - 4), bg: s2.bg },
  ].map((v) => ({ ...v, split: v.sheet === 'sheet-1.jpg' ? { column: split, onPixels: least } : null }));
}
/**
 * A view cut to its body and centred on a square of its sheet's ground (PNG), the body `fill` of the square's height:
 * the same in every view (FILL, or less when a T-pose's span would not fit: the views must agree in scale).
 */
const fillOf = (views) => Math.min(FILL, ...views.map(({ box: [, , w, h] }) => (0.94 * h) / (w + 12)));
async function viewPng({ sheet, box: [x, y, w, h], bg }, fill) {
  const file = join(TPOSE, sheet), meta = await sharp(file).metadata();
  const m = 6, L = Math.max(0, x - m), T = Math.max(0, y - m), W = Math.min(meta.width - L, w + 2 * m), H = Math.min(meta.height - T, h + 2 * m);
  const side = Math.max(Math.round(h / fill), W + 4);
  const cut = await sharp(file).extract({ left: L, top: T, width: W, height: H }).toBuffer();
  const px = Math.round((side - W) / 2), py = Math.round((side - H) / 2);
  const sq = await sharp(cut).extend({ left: px, right: side - W - px, top: py, bottom: side - H - py, background: { r: bg[0], g: bg[1], b: bg[2] } }).png().toBuffer();
  return sharp(sq).resize(SIZE, SIZE).png().toBuffer();
}

const VIEWS = await measure();
console.log(JSON.stringify(VIEWS.map(({ view, box, split }) => ({ view, box, split }))));
const before = await tripo.balance(ctx);
console.log('balance before', before);
const views = [], fill = fillOf(VIEWS);
console.log('body height on its square', +fill.toFixed(3));
for (const V of VIEWS) { const png = await viewPng(V, fill); writeFileSync(join(OUT, `view-${V.view}.png`), png); views.push({ ...V, png }); }
if (process.argv.includes('--dry')) process.exit(0);
const recFile = join(OUT, 'task.json');
let record = existsSync(recFile) ? JSON.parse(readFileSync(recFile, 'utf8')) : null;
if (!record) {
  const inputs = [];
  for (const v of views) inputs.push({ [v.view]: await tripo.upload({ bytes: v.png, mime: 'image/png', name: `${foe}-${v.view}.png` }, ctx) });
  const started = new Date().toISOString();
  let taskId = null;
  const gen = await tripo.runTask('/generation/multiview-to-model', { inputs, ...BODY }, { ...ctx, onTask: (id) => { taskId = id; console.log('task', id); } }, (p, s) => console.log('progress', s, p));
  const out = gen.output ?? {};
  const model = await tripo.fetchOutput(out.model_url ?? out.pbr_model_url ?? out.base_model_url, ctx);
  writeFileSync(join(OUT, 'model.glb'), model.bytes);
  let preview = null;
  if (out.rendered_image_url) { preview = await tripo.fetchOutput(out.rendered_image_url, ctx).catch(() => null); if (preview) writeFileSync(join(OUT, `preview.${preview.format}`), preview.bytes); }
  const after = await tripo.balance(ctx);
  record = { issue: 800, phase: 'family G', foe,
    fill: +fill.toFixed(4), sources: VIEWS.map((v, i) => ({ view: v.view, sheet: `references/enemy-redesign-2026-10-30/${FOES[foe]}/tpose/${v.sheet}`, box: v.box, sent: `view-${v.view}.png`, sha256: sha(views[i].png) })),
    generation: { endpoint: 'POST /v3/generation/multiview-to-model', request: BODY, task: taskId ?? gen.task_id, started, finished: new Date().toISOString(),
      creditsConsumed: gen.credits_consumed ?? (before.balance - after.balance), balanceBefore: before.balance, balanceAfter: after.balance,
      model: { file: 'model.glb', bytes: model.bytes.length, sha256: sha(model.bytes) }, preview: preview ? { file: `preview.${preview.format}`, bytes: preview.bytes.length } : null } };
  writeFileSync(recFile, JSON.stringify(record, null, 2) + '\n');
  console.log('generated', record.generation.task, record.generation.creditsConsumed);
}
// --rerig <model>: the rig again on another rig model (the first kept: rigged-<n>.glb, record.rigTries), when the first
// put its joints wrong (the hulk's v1.0 rig crossed its arms and set a foot behind it)
const rerig = process.argv.indexOf('--rerig');
if (rerig > 0 && record.rig) {
  const { renameSync } = await import('node:fs');
  record.rigTries ??= [];
  const n = record.rigTries.length + 1;
  renameSync(join(OUT, 'rigged.glb'), join(OUT, `rigged-${n}.glb`));
  record.rigTries.push({ ...record.rig, model: { ...record.rig.model, file: `rigged-${n}.glb` }, why: process.argv[rerig + 2] ?? null });
  delete record.rig;
  RIG.model = process.argv[rerig + 1];
}
if (!record.rig && !process.argv.includes('--no-rig')) {
  const b0 = await tripo.balance(ctx);
  const check = await tripo.runTask('/animations/rig-check', { input: record.generation.task }, ctx);
  console.log('rig check', JSON.stringify(check.output));
  let rigTask = null;
  const rig = await tripo.runTask('/animations/rig', { input: record.generation.task, ...RIG }, { ...ctx, onTask: (id) => { rigTask = id; console.log('rig task', id); } }, (p, s) => console.log('rig', s, p));
  const model = await tripo.fetchOutput(rig.output?.model_url, ctx);
  writeFileSync(join(OUT, 'rigged.glb'), model.bytes);
  const b1 = await tripo.balance(ctx);
  record.rig = { check: { endpoint: 'POST /v3/animations/rig-check', task: check.task_id, output: check.output ?? null, creditsConsumed: check.credits_consumed ?? 0 },
    endpoint: 'POST /v3/animations/rig', request: RIG, task: rigTask ?? rig.task_id, creditsConsumed: rig.credits_consumed ?? (b0.balance - b1.balance), balanceBefore: b0.balance, balanceAfter: b1.balance,
    model: { file: 'rigged.glb', bytes: model.bytes.length, sha256: sha(model.bytes) } };
  writeFileSync(recFile, JSON.stringify(record, null, 2) + '\n');
  console.log('rigged', record.rig.task, record.rig.creditsConsumed, b0.balance, '→', b1.balance);
}
