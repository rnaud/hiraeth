// The reference lab's 3D mode (docs/systems/reference-lab.md, "3D mode"): picked references (one view, or several
// views of one subject, each maybe cut out of a sheet) or a prompt → n Tripo models side by side, then one picked
// into a references/…/3d/ folder with its preview and manifest record.
//
//   (the same store as the 2D batches: storeRoot, the main checkout's references/_candidates/)
//   <batch>/candidates.json             mode: '3d', the inputs and options, Tripo's state, every candidate
//   <batch>/inputs/<i>-<view>.png|jpg   the pictures as sent (crops cut)
//   <batch>/tripo/<n>.glb               a model (.fbx when quad), <n>-preview.<ext> Tripo's render,
//   <batch>/tripo/<n>-rigged.glb, <n>-animated.glb   with --rig: the rigged model and its preview walk
//   <target>/model-N.glb (+ -preview.webp, -rigged.glb, -<anim>.glb) + <target>/manifest.json `models`: a pick
//
// One candidate failing (a refused task, a timeout) leaves the others running; a rig failing leaves its model.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readRef, redact, sha256, times } from './common.mjs';
import { KEY_NAMES, keyFor } from './env.mjs';
import { CANDIDATES_DIR, batchDir, checkTarget, newBatchId, pick, readBatch, storeRoot } from './batch.mjs';
import { prepareView, parseCrop } from './crop.mjs';
import tripo, { CREDIT_USD, VIEWS, estimateCredits, tripoOptions } from './providers/tripo.mjs';

const writeJson = (file, data) => { const tmp = `${file}.tmp`; writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`); renameSync(tmp, file); };

/** The views for n pictures: the ones given, the rest filled in front, left, back, right order (pure). */
export function assignViews(count, given = []) {
  const out = [], used = new Set(given.filter(Boolean));
  const free = VIEWS.filter((v) => !used.has(v));
  for (let i = 0; i < count; i++) out.push(given[i] || free.shift() || null);
  return out;
}

/** Where a 3D pick goes by default: a `3d/` folder beside the first reference (references/…/<id>/3d/), or null. */
export function default3dTarget(first) {
  const p = String(first ?? '');
  if (!p.startsWith('references/') || p.startsWith(CANDIDATES_DIR)) return null;
  return `${dirname(p)}/3d/`;
}

/** 'text' | 'image' | 'multiview' for this many pictures. */
export const kindFor = (images) => (!images.length ? 'text' : images.length === 1 ? 'image' : 'multiview');

/**
 * The batch made ready: the inputs read (and cropped), written into the batch, candidates.json started. Throws
 * on a bad request before anything is spent. o: { root, images, crops, views, prompt, negative, options, n,
 * target, from, batch, now, sharp }. Returns { manifest, dir, views: [{ bytes, mime, name, view }] }.
 */
export async function prepare3dBatch(o) {
  const { root } = o;
  const images = (o.images ?? []).filter(Boolean);
  if (images.length > 4) throw new Error('at most 4 pictures (front, left, back, right)');
  const kind = kindFor(images);
  const prompt = String(o.prompt ?? '').trim();
  if (kind === 'text' && !prompt) throw new Error('give pictures (references) or a prompt');
  const crops = images.map((_, i) => parseCrop(o.crops?.[i] ?? null));
  const views = kind === 'multiview' ? assignViews(images.length, o.views ?? []) : images.map(() => (kind === 'image' ? 'front' : null));
  if (kind === 'multiview' && !views.includes('front')) throw new Error('several views need one marked front');
  const options = tripoOptions({ ...(o.options ?? {}), ...(o.model ? { model: o.model } : {}) });
  estimateCredits(kind, options);
  const n = Math.max(1, Math.min(4, Math.round(+o.n || 1)));
  const target = checkTarget(root, o.target || default3dTarget(images[0]));
  const read = images.map((p) => readRef(root, p));
  const prepared = await Promise.all(read.map((r, i) => prepareView(Buffer.from(r.base64, 'base64'), r.mime, crops[i], { sharp: o.sharp })));
  const batch = o.batch ?? newBatchId(o.now ? new Date(o.now()) : new Date());
  const dir = batchDir(root, batch);
  mkdirSync(join(dir, 'inputs'), { recursive: true });
  const ignore = join(storeRoot(root), CANDIDATES_DIR, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '# the reference lab\'s candidates (docs/systems/reference-lab.md): never committed\n*\n');
  const inputs = prepared.map((v, i) => {
    const file = `inputs/${i + 1}-${views[i] ?? 'view'}.${v.mime === 'image/png' ? 'png' : 'jpg'}`;
    writeFileSync(join(dir, file), v.bytes);
    return { path: read[i].path, view: views[i], crop: v.crop, file, bytes: v.bytes.length };
  });
  const t = o.now ? o.now() : Date.now();
  const estimate = +(estimateCredits(kind, options) * n * CREDIT_USD).toFixed(2);
  const manifest = {
    batch, mode: '3d', date: new Date(t).toISOString().slice(0, 10), created: new Date(t).toISOString(),
    kind, prompt: prompt || null, negative: o.negative || null, from: o.from ?? null, refs: inputs.map((i) => i.path), inputs, options, n, target,
    status: 'running', estimateUSD: estimate,
    providers: { tripo: { status: 'running', label: tripo.label, model: options.model, stages: {} } }, candidates: [],
  };
  writeJson(join(dir, 'candidates.json'), manifest);
  return { manifest, dir, views: prepared.map((v, i) => ({ bytes: v.bytes, mime: v.mime, name: inputs[i].file.split('/').pop(), view: views[i] })) };
}

/** The prepared batch run: the pictures uploaded once, n models made at once, each written as it lands. */
export async function execute3dBatch({ manifest, dir, views }, o) {
  const keys = o.keys ?? {};
  const key = keyFor(tripo, keys);
  const secrets = KEY_NAMES.map((k) => keys[k]).filter(Boolean);
  const entry = manifest.providers.tripo;
  const save = () => { writeJson(join(dir, 'candidates.json'), manifest); o.onUpdate?.(manifest); };
  const finish = () => {
    manifest.status = 'done';
    manifest.candidates.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    delete entry.stages;
    save();
    return manifest;
  };
  if (!key) { Object.assign(entry, { status: 'error', kind: 'no-key', error: `add ${tripo.keyName} to .env.local` }); return finish(); }
  const t0 = Date.now();
  const ctx = { key, fetch: o.fetch, sleep: o.sleep, now: o.now, pollEvery: o.pollEvery, timeout: o.timeout };
  let inputs = [];
  try {
    const tokens = await Promise.all(views.map((v) => tripo.upload(v, ctx)));
    inputs = views.map((v, i) => ({ view: v.view, token: tokens[i] }));
  } catch (e) {
    Object.assign(entry, { status: 'error', kind: e?.kind ?? 'error', ms: Date.now() - t0, error: redact(e?.message ?? String(e), secrets) });
    return finish();
  }
  const failures = [];
  mkdirSync(join(dir, 'tripo'), { recursive: true });
  await times(manifest.n, async (i) => {
    const n = i + 1, s0 = Date.now();
    const stage = (name, p) => { entry.stages[n] = `${name}${p ? ` ${p}%` : ''}`; save(); };
    try {
      const r = await tripo.makeModel({ kind: manifest.kind, prompt: manifest.prompt, negative: manifest.negative, inputs, options: manifest.options },
        { ...ctx, onStage: stage });
      const file = `tripo/${n}.${r.file.format}`;
      writeFileSync(join(dir, file), r.file.bytes);
      let preview = null;
      if (r.preview) { preview = `tripo/${n}-preview.${r.preview.format}`; writeFileSync(join(dir, preview), r.preview.bytes); }
      let rig = null;
      if (r.rig) {
        rig = { status: r.rig.status, rigType: r.rig.rigType ?? null, ...(r.rig.rigModel ? { rigModel: r.rig.rigModel } : {}), ...(r.rig.animation ? { animation: r.rig.animation } : {}) };
        if (r.rig.file) { rig.file = `tripo/${n}-rigged.${r.rig.file.format}`; writeFileSync(join(dir, rig.file), r.rig.file.bytes); }
        if (r.rig.animated) { rig.animated = `tripo/${n}-animated.${r.rig.animated.format}`; writeFileSync(join(dir, rig.animated), r.rig.animated.bytes); }
        if (r.rig.error) Object.assign(rig, { kind: r.rig.kind, error: redact(r.rig.error, secrets) });
      }
      const estimated = !r.credits;
      const credits = r.credits || estimateCredits(manifest.kind, manifest.options);
      manifest.candidates.push({
        id: `tripo/${n}`, provider: 'tripo', label: tripo.label, model: r.model, kind: manifest.kind, file, format: r.file.format, preview,
        bytes: r.file.bytes.length, sha256: sha256(r.file.bytes), ms: Date.now() - s0, credits, costUSD: +(credits * CREDIT_USD).toFixed(2), estimated,
        tasks: r.tasks, rig, status: 'new',
      });
    } catch (e) {
      failures.push({ n, kind: e?.kind ?? 'error', error: redact(e?.message ?? String(e), secrets) });
    }
    delete entry.stages[n];
    save();
  }, 4);
  const done = manifest.candidates;
  const credits = done.reduce((s, c) => s + (c.credits ?? 0), 0);
  Object.assign(entry, {
    status: done.length ? 'done' : 'error', ms: Date.now() - t0, count: done.length, credits, costUSD: +(credits * CREDIT_USD).toFixed(2),
    estimated: done.some((c) => c.estimated),
    ...(failures.length ? { failures, kind: failures[0].kind, error: failures.length === manifest.n ? failures[0].error : `${failures.length} of ${manifest.n} failed: ${failures[0].error}` } : {}),
  });
  if (done.length && failures.length) entry.status = 'done';
  return finish();
}

/** A whole 3D batch (the CLI): prepare, then run. Same options as prepare3dBatch plus { keys, fetch, sleep, pollEvery, timeout, onUpdate }. */
export async function run3dBatch(o) {
  return execute3dBatch(await prepare3dBatch(o), o);
}

/** The next free model number in a folder (model-1.glb, model-2.fbx…). */
export function nextModel(dir) {
  const used = existsSync(dir) ? readdirSync(dir).map((f) => f.match(/^model-(\d+)\./)?.[1]).filter(Boolean).map(Number) : [];
  return used.length ? Math.max(...used) + 1 : 1;
}

/** A preview data URL from the page (its turntable) → { bytes, ext }, or null. */
export function previewFromDataUrl(url, max = 6_000_000) {
  if (!url) return null;
  const m = String(url).match(/^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error('the preview is not a WebP, PNG or JPEG data URL');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > max) throw new Error('the preview is too large');
  return { bytes, ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
}

/**
 * Pick a 3D candidate: its model (and rigged model, preview walk) copied to the target as model-N.*, a preview
 * (the page's turntable when it sends one, else Tripo's render) as model-N-preview.*, and its record appended to
 * the target's manifest.json `models`. o: { root, batch, candidate, target, why, preview, now }.
 */
export function pick3d({ root, batch, candidate, target = null, why = '', preview = null, now = Date.now }) {
  const m = readBatch(root, batch);
  if (m.mode !== '3d') throw new Error(`${batch} is not a 3D batch`);
  const c = m.candidates.find((x) => x.id === candidate);
  if (!c) throw new Error(`no candidate ${candidate} in ${batch}`);
  if (c.status === 'discarded') throw new Error(`${candidate} was discarded`);
  if (m.rejected) throw new Error(`${batch} was turned down (none of them): take that back first`);
  const to = checkTarget(root, target || m.target);
  if (!to) throw new Error('no target folder: give --target references/…/3d/');
  const turn = previewFromDataUrl(preview);
  const dir = join(root, to), src = batchDir(root, batch);
  mkdirSync(dir, { recursive: true });
  const mf = join(dir, 'manifest.json');
  const manifest = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : {
    ...(to.startsWith('references/enemy-archetypes/') ? { archetype: to.split('/')[2] } : {}),
    created: new Date(now()).toISOString().slice(0, 10), models: [],
  };
  manifest.models ??= [];
  const again = manifest.models.find((s) => s.batch === batch && s.candidate === c.id);
  if (again) {   // (picked twice: one model, the newer reason and turntable kept)
    if (why) again.why = why;
    if (turn) { again.preview = `${again.file.replace(/\.\w+$/, '')}-preview.${turn.ext}`; writeFileSync(join(dir, again.preview), turn.bytes); }
    writeJson(mf, manifest);
    return { file: `${to}${again.file}`, manifest: `${to}manifest.json`, entry: again, again: true };
  }
  const N = nextModel(dir), stem = `model-${N}`;
  const file = `${stem}.${c.format}`;
  copyFileSync(join(src, c.file), join(dir, file));
  let prev = null;
  if (turn) { prev = `${stem}-preview.${turn.ext}`; writeFileSync(join(dir, prev), turn.bytes); }
  else if (c.preview && existsSync(join(src, c.preview))) { prev = `${stem}-preview.${c.preview.split('.').pop()}`; copyFileSync(join(src, c.preview), join(dir, prev)); }
  let rigged = null, animated = null;
  if (c.rig?.file && existsSync(join(src, c.rig.file))) { rigged = `${stem}-rigged.${c.rig.file.split('.').pop()}`; copyFileSync(join(src, c.rig.file), join(dir, rigged)); }
  if (c.rig?.animated && existsSync(join(src, c.rig.animated))) {
    const name = String(c.rig.animation ?? 'animated').split(':').pop().replace(/[^\w-]/g, '') || 'animated';
    animated = `${stem}-${name}.${c.rig.animated.split('.').pop()}`; copyFileSync(join(src, c.rig.animated), join(dir, animated));
  }
  const entry = {
    file, ...(prev ? { preview: prev } : {}), ...(rigged ? { rigged } : {}), ...(animated ? { animated } : {}),
    service: 'Reference lab 3D', provider: c.provider, providerLabel: c.label, model: c.model, kind: m.kind,
    inputs: m.inputs.map(({ path, view, crop }) => ({ path, view, ...(crop ? { crop } : {}) })),
    ...(m.prompt ? { prompt: m.prompt } : {}), options: m.options, tasks: c.tasks,
    ...(c.rig ? { rig: { status: c.rig.status, rigType: c.rig.rigType, ...(c.rig.rigModel ? { rigModel: c.rig.rigModel } : {}), ...(c.rig.animation ? { animation: c.rig.animation } : {}) } } : {}),
    date: new Date(now()).toISOString().slice(0, 10), batch, candidate: c.id, format: c.format, sha256: c.sha256, bytes: c.bytes,
    credits: c.credits, costUSD: c.costUSD, ...(why ? { why } : {}),
  };
  manifest.models.push(entry);
  writeJson(mf, manifest);
  c.status = 'picked'; c.pickedAs = `${to}${file}`;
  writeJson(join(src, 'candidates.json'), m);
  return { file: `${to}${file}`, manifest: `${to}manifest.json`, entry };
}

/** Pick in any batch: 3D ones by pick3d, the pictures by pick. */
export function pickAny(o) {
  return readBatch(o.root, o.batch).mode === '3d' ? pick3d(o) : pick(o);
}
