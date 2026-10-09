#!/usr/bin/env node
// The reference lab from the command line (docs/systems/reference-lab.md): one prompt and some style references
// sent to several image providers at once, the candidates saved side by side, then the best one picked into
// its folder with a manifest. The page (reference-lab.html, on the dev server) does the same with pictures.
//
//   node scripts/gen-reference.mjs --list
//   node scripts/gen-reference.mjs --from docs/design/enemy-roster-prompts.md#crab \
//        --refs "references/Vael II- The Sky Stones/enemies/lineup-01.jpeg" --providers openai,gemini,fal-flux --n 2
//   node scripts/gen-reference.mjs --prompt "…" --refs a.jpg,b.jpg --ar 16:9 --target references/enemy-archetypes/crab/
//   node scripts/gen-reference.mjs --batches
//   node scripts/gen-reference.mjs --pick <batch>/<provider>/<n> [--target …] [--why "the clearest silhouette"]
//   node scripts/gen-reference.mjs --discard <batch>[/<provider>/<n>]
//   node scripts/gen-reference.mjs --into <batch> --providers gemini      (a provider retried in the same batch)
//   node scripts/gen-reference.mjs --reject <batch> --why "too cute, not Moebius"   (none of them)
//   node scripts/gen-reference.mjs --merge <batch>,<batch>,…              (batches run apart, joined into the first)
//
// The keys come from .env.local / .env (scripts/reference-lab/env.mjs) and are never printed.
import { ROOT } from './reference-lab/common.mjs';
import { availability, loadKeys } from './reference-lab/env.mjs';
import { DEFAULT_PROVIDERS, PROVIDERS } from './reference-lab/providers/index.mjs';
import { resolveFrom } from './reference-lab/prompts.mjs';
import { CANDIDATES_DIR, discard, listBatches, mergeBatches, parseCandidate, pick, readBatch, reject, runBatch } from './reference-lab/batch.mjs';

/** argv → options (pure). */
export function parseArgs(argv) {
  const o = { n: 1, refs: [], providers: null };
  const flags = new Set(['list', 'batches', 'help']);
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
    else if (k === 'model') { const [id, m] = v.split('='); (o.models ??= {})[id] = m; }
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
Candidates go to ${CANDIDATES_DIR}/<batch>/ (git-ignored).`;

export async function main(argv = process.argv.slice(2), { root = ROOT, keys = loadKeys(root), fetch: f, log = console.log } = {}) {
  const o = parseArgs(argv);
  if (o.help) { log(HELP); return 0; }
  if (o.list) {
    for (const p of availability(PROVIDERS, keys)) log(`${p.available ? '✓' : '·'} ${p.id.padEnd(13)} ${p.label.padEnd(36)} ${p.model}${p.available ? '' : `   (add ${p.keyName} to .env.local)`}`);
    return 0;
  }
  if (o.batches) {
    for (const b of listBatches(root)) log(`${b.batch}  ${String(b.count ?? 0).padStart(2)} candidates, ${b.picked ?? 0} picked  ${String(b.from ?? b.prompt ?? '').slice(0, 70)}`);
    return 0;
  }
  if (o.pick) {
    const { batch, candidate } = parseCandidate(root, o.pick, o.batch);
    const r = pick({ root, batch, candidate, target: o.target, why: o.why });
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
  log(`batch: ${providers.join(', ')} · ${o.n} each · ${ar ?? '1:1'} · ${o.refs.length} reference(s)`);
  const m = await runBatch({ root, prompt, refs: o.refs, providers, models: o.models, n: o.n, ar: ar ?? '1:1', target, from, comparison: o.comparison, keys, fetch: f, ...(o.into ? { batch: o.into, n: o.n } : {}) });
  for (const [id, p] of Object.entries(m.providers)) {
    log(p.status === 'done'
      ? `✓ ${id.padEnd(13)} ${p.count} image(s) in ${(p.ms / 1000).toFixed(1)} s, ${p.model}${p.costUSD != null ? `, ${p.estimated ? '~' : ''}$${p.costUSD.toFixed(3)}` : ''}`
      : `✗ ${id.padEnd(13)} ${p.kind}: ${p.error}`);
  }
  log(`candidates: ${CANDIDATES_DIR}/${m.batch}/  (pick: --pick ${m.batch}/<provider>/<n>${target ? '' : ' --target references/…/'})`);
  return m.candidates.length ? 0 : 2;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('gen-reference.mjs')) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error(`gen-reference: ${e.message}`); process.exitCode = 1; });
}
