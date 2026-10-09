#!/usr/bin/env node
// The reference lab from the command line (docs/systems/reference-lab.md): one prompt and some style references
// sent to several image providers at once, the candidates saved side by side, then the best one picked into
// its folder with a manifest. The page (reference-lab.html, on the dev server) does the same with pictures.
//
//   node scripts/gen-reference.mjs --list
//   node scripts/gen-reference.mjs --from docs/design/enemy-roster-prompts.md#crab \
//        --refs "references/archive/world-enemies/Vael II- The Sky Stones/lineup-01.jpeg" --providers openai,gemini,fal-flux --n 2
//   node scripts/gen-reference.mjs --prompt "…" --refs a.jpg,b.jpg --ar 16:9 --target references/enemy-archetypes/crab/
//   node scripts/gen-reference.mjs --batches
//   node scripts/gen-reference.mjs --pick <batch>/<provider>/<n> [--target …] [--why "the clearest silhouette"]
//   node scripts/gen-reference.mjs --discard <batch>[/<provider>/<n>]
//   node scripts/gen-reference.mjs --into <batch> --providers gemini      (a provider retried in the same batch)
//   node scripts/gen-reference.mjs --reject <batch> --why "too cute, not Moebius"   (none of them)
//   node scripts/gen-reference.mjs --merge <batch>,<batch>,…              (batches run apart, joined into the first)
//
// The 3D mode (Tripo; docs/systems/reference-lab.md, "3D mode"): one picture → image to model, 2–4 views of one
// subject → multiview, no picture and a prompt → text to model. --crop cuts a view out of a sheet (one --crop per
// picture, in order; - for none).
//   node scripts/gen-reference.mjs --3d --images references/enemy-archetypes/crab/sheet-1.jpg --crop 800,130,420,380
//   node scripts/gen-reference.mjs --3d --images a.jpg,b.jpg --views front,left [--rig] [--n 2] [--quad] [--faces 20000]
//   node scripts/gen-reference.mjs --3d --prompt "a lamp on three legs" --target references/enemy-archetypes/tripod/3d/
//   node scripts/gen-reference.mjs --pick <batch>/tripo/1 --why "…"     (the GLB into references/…/3d/)
//
// The keys come from .env.local / .env (scripts/reference-lab/env.mjs) and are never printed.
import { ROOT } from './reference-lab/common.mjs';
import { availability, loadKeys } from './reference-lab/env.mjs';
import { DEFAULT_PROVIDERS, PROVIDERS } from './reference-lab/providers/index.mjs';
import { resolveFrom } from './reference-lab/prompts.mjs';
import { CANDIDATES_DIR, discard, listBatches, mergeBatches, parseCandidate, readBatch, reject, runBatch } from './reference-lab/batch.mjs';
import { pickAny, run3dBatch } from './reference-lab/batch3d.mjs';
import tripo, { estimateCredits, CREDIT_USD } from './reference-lab/providers/tripo.mjs';

/** argv → options (pure). */
export function parseArgs(argv) {
  const o = { refs: [], providers: null };   // (no n unless --n: a new batch makes 1 each, --into keeps the batch's own: runBatch)
  const flags = new Set(['list', 'batches', 'help', '3d', 'rig', 'quad', 'no-texture', 'no-pbr']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected "${a}"`);
    const [k, inline] = a.slice(2).split(/=(.*)/s);
    if (flags.has(k)) { o[k] = true; continue; }
    const v = inline ?? argv[++i];
    if (v === undefined) throw new Error(`--${k} needs a value`);
    if (k === 'refs') o.refs = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === 'providers') o.providers = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === 'n') o.n = +v;
    else if (k === 'model') { if (v.includes('=')) { const [id, m] = v.split('='); (o.models ??= {})[id] = m; } else o.model3d = v; }
    else if (k === 'images') o.images = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === 'views') o.views = v.split(',').map((s) => s.trim());
    else if (k === 'crop') (o.crops ??= []).push(v);
    else if (k === 'faces') o.faces = +v;
    else if (k === 'texture-quality') o.textureQuality = v;
    else if (k === 'negative') o.negative = v;
    else if (['prompt', 'from', 'ar', 'target', 'pick', 'discard', 'batch', 'why', 'comparison', 'into', 'reject'].includes(k)) o[k] = v;
    else if (k === 'merge') o.merge = v.split(',').map((s) => s.trim()).filter(Boolean);
    else throw new Error(`unknown option --${k}`);
  }
  return o;
}

const HELP = `node scripts/gen-reference.mjs
  --prompt "…" | --from docs/…prompts.md#<id>[/alt]   what to draw
  --refs a.jpg,b.jpg          style references (repository paths)
  --providers openai,gemini   default: Gemini and OpenAI (DEFAULT_PROVIDERS); --list shows them all
  --model gemini=gemini-3-pro-image   another model for one provider (repeatable)
  --n 2  --ar 16:9  --target references/enemy-archetypes/<id>/
  --into <batch>              run the providers into an existing batch (its prompt and references)
  --reject <batch> --why …    none of them, and why (kept in the batch and the target's manifest.json)
  --merge <batch>,<batch>     join batches run apart into the first, for one pick across them
  --list | --batches | --pick <batch>/<provider>/<n> [--why …] | --discard <batch>[/<provider>/<n>]
3D (Tripo, TRIPO_3D_API_KEY):
  --3d --images a.jpg[,b.jpg…]   one picture: image to model; 2–4: multiview (--views front,left,back,right)
  --3d --prompt "…"              no picture: text to model
  --crop x,y,w,h                 a view cut out of a sheet (one per picture, in order; - for none)
  --model v3.1-20260211 | v3.0-20250812 | v2.5-20250123 | P1-20260311 | P2-20260801
  --no-texture  --no-pbr  --texture-quality detailed  --faces 20000  --quad (FBX out)  --rig  --n 2
  --target references/…/3d/      default: a 3d/ folder beside the first picture
Candidates go to ${CANDIDATES_DIR}/<batch>/ (git-ignored).`;

export async function main(argv = process.argv.slice(2), { root = ROOT, keys = loadKeys(root), fetch: f, log = console.log } = {}) {
  const o = parseArgs(argv);
  if (o.help) { log(HELP); return 0; }
  if (o.list) {
    for (const p of availability(PROVIDERS, keys)) log(`${p.available ? '✓' : '·'} ${p.id.padEnd(13)} ${p.label.padEnd(36)} ${p.model}${p.available ? '' : `   (add ${p.keyName} to .env.local)`}`);
    return 0;
  }
  if (o.batches) {
    for (const b of listBatches(root)) log(`${b.batch}  ${String(b.count ?? 0).padStart(2)} candidates, ${b.picked ?? 0} picked  ${b.mode === '3d' ? `[3D ${b.kind}] ` : ''}${String(b.from ?? b.prompt ?? '').slice(0, 70)}`);
    return 0;
  }
  if (o.pick) {
    const { batch, candidate } = parseCandidate(root, o.pick, o.batch);
    const r = pickAny({ root, batch, candidate, target: o.target, why: o.why });
    log(`picked ${batch}/${candidate} → ${r.file} (recorded in ${r.manifest})`);
    return 0;
  }
  if (o.discard) {
    const parts = o.discard.split('/');
    const r = discard({ root, batch: parts[0], candidate: parts.length > 1 ? parts.slice(1).join('/') : null });
    log(r.removed ? `removed batch ${r.removed}` : `discarded ${r.discarded}`);
    return 0;
  }
  if (o.reject) {
    reject({ root, batch: o.reject, why: o.why ?? '' });
    log(`${o.reject}: none of them (${o.why})`);
    return 0;
  }
  if (o.merge) {
    const m = mergeBatches({ root, into: o.merge[0], from: o.merge.slice(1) });
    log(`merged into ${m.batch}: ${m.candidates.length} candidates from ${Object.keys(m.providers).join(', ')}`);
    return 0;
  }
  if (o['3d']) return main3d(o, { root, keys, fetch: f, log });
  let prompt = o.prompt, ar = o.ar, target = o.target, from = null;
  if (o.into) ({ prompt, ar, target } = readBatch(root, o.into));
  if (o.from) {
    const p = resolveFrom(root, o.from);
    prompt ??= p.prompt; ar ??= p.ar; target ??= p.target; from = p.from;
    if (p.needsImage && !o.refs.length) log(`note: ${p.from} expects the chosen sheet-1 as an image reference: add it with --refs`);
  }
  if (!prompt) { log(HELP); return 1; }
  const providers = o.providers ?? PROVIDERS.filter((p) => DEFAULT_PROVIDERS.includes(p.id) && availability([p], keys)[0].available).map((p) => p.id);
  if (!providers.length) { log('no provider has a key: add OPENAI_API_KEY, GEMINI_API_KEY, FAL_KEY or BFL_API_KEY to .env.local (--list)'); return 1; }
  log(`batch: ${providers.join(', ')} · ${o.n ?? (o.into ? 'the batch\'s count' : 1)} each · ${ar ?? '1:1'} · ${o.refs.length} reference(s)`);
  const m = await runBatch({ root, prompt, refs: o.refs, providers, models: o.models, n: o.n, ar: ar ?? '1:1', target, from, comparison: o.comparison, keys, fetch: f, ...(o.into ? { batch: o.into, n: o.n } : {}) });
  for (const [id, p] of Object.entries(m.providers)) {
    log(p.status === 'done'
      ? `✓ ${id.padEnd(13)} ${p.count} image(s) in ${(p.ms / 1000).toFixed(1)} s, ${p.model}${p.costUSD != null ? `, ${p.estimated ? '~' : ''}$${p.costUSD.toFixed(3)}` : ''}`
      : `✗ ${id.padEnd(13)} ${p.kind}: ${p.error}`);
  }
  log(`candidates: ${CANDIDATES_DIR}/${m.batch}/  (pick: --pick ${m.batch}/<provider>/<n>${target ? '' : ' --target references/…/'})`);
  return m.candidates.length ? 0 : 2;
}

/** The 3D mode: one Tripo batch. */
async function main3d(o, { root, keys, fetch: f, log }) {
  const images = o.images ?? o.refs ?? [];
  let prompt = o.prompt, from = null, target = o.target;
  if (o.from) { const p = resolveFrom(root, o.from); prompt ??= p.prompt; from = p.from; }
  if (!images.length && !prompt) { log(HELP); return 1; }
  const options = { model: o.model3d ?? o.models?.tripo, texture: !o['no-texture'], pbr: !o['no-pbr'], textureQuality: o.textureQuality, faceLimit: o.faces, quad: !!o.quad, rig: !!o.rig };
  const kind = !images.length ? 'text' : images.length === 1 ? 'image' : 'multiview';
  const n = o.n || 1;
  log(`3D batch: Tripo ${kind} to model · ${n} candidate(s) · ${images.length} picture(s)${o.crops?.length ? ' (cropped)' : ''}${options.rig ? ' · rigged' : ''} · about $${(estimateCredits(kind, options) * n * CREDIT_USD).toFixed(2)}`);
  if (!availability([tripo], keys)[0].available) log(`note: no ${tripo.keyName} in .env.local: the batch will say so`);
  const m = await run3dBatch({ root, images, crops: o.crops, views: o.views, prompt: images.length ? null : prompt, negative: o.negative, options, n, target, from, keys, fetch: f });
  const p = m.providers.tripo;
  log(p.status === 'done'
    ? `✓ tripo ${p.count} model(s) in ${(p.ms / 1000).toFixed(1)} s, ${p.model}, ${p.estimated ? '~' : ''}$${p.costUSD.toFixed(2)} (${p.credits} credits)${p.error ? `; ${p.error}` : ''}`
    : `✗ tripo ${p.kind}: ${p.error}`);
  for (const c of m.candidates) if (c.rig) log(`  ${c.id} rig: ${c.rig.status}${c.rig.rigType ? ` (${c.rig.rigType})` : ''}${c.rig.error ? `: ${c.rig.error}` : ''}`);
  log(`candidates: ${CANDIDATES_DIR}/${m.batch}/  (pick: --pick ${m.batch}/tripo/<n>${m.target ? ` → ${m.target}` : ' --target references/…/3d/'})`);
  return m.candidates.length ? 0 : 2;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('gen-reference.mjs')) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(`gen-reference: ${e.message}`); process.exitCode = 1; });
}
