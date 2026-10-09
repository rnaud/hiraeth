// The reference lab's batches and picks (docs/systems/reference-lab.md).
//
//   (the candidates are in the main checkout when run from a git worktree: storeRoot)
//   references/_candidates/<batch>/candidates.json        what was asked, each provider's state, every candidate
//   references/_candidates/<batch>/<provider>/<n>.<ext>   the pictures (the folder is git-ignored)
//   <target>/sheet-N.<ext> + <target>/manifest.json       a pick: the chosen picture, copied, and its record
//
// A batch runs every provider at once; one failing (no key, a refused key, a rate limit) leaves the others
// running and is written down in its own entry. candidates.json is rewritten as each provider finishes, so the
// page can show a batch while it runs. Running again into an existing batch (o.batch, CLI --into) adds the
// providers asked for to it, with the batch's own prompt and references: a provider that failed is retried in
// the same batch, so every provider's pictures stay side by side for one pick. mergeBatches() joins batches
// that were run apart.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { extOf, insideRoot, parseAspect, readRef, redact, sha256 } from './common.mjs';
import { PROVIDERS } from './providers/index.mjs';
import { KEY_NAMES, keyFor, mainCheckout } from './env.mjs';

export const CANDIDATES_DIR = 'references/_candidates';
const ID = /^[A-Za-z0-9][\w.-]*$/;

/** A new batch id: the time and a few random letters (sorts by time). */
export function newBatchId(date = new Date(), rand = randomBytes(2).toString('hex')) {
  return `${date.toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${rand}`;
}

/**
 * Where the candidates live: the MAIN checkout's references/_candidates/ (a batch made from a worktree shows on
 * the author's own dev server too, and outlives the worktree), or this checkout's when it is the main one.
 * REFERENCE_LAB_STORE=<dir> puts them elsewhere.
 */
const stores = new Map();
export function storeRoot(root) {
  if (process.env.REFERENCE_LAB_STORE) return process.env.REFERENCE_LAB_STORE;
  if (!stores.has(root)) stores.set(root, mainCheckout(root) ?? root);
  return stores.get(root);
}
/** A batch's folder (its id checked: no path tricks). */
export const batchDir = (root, batch) => {
  if (!ID.test(String(batch))) throw new Error(`batch id "${batch}"`);
  return join(storeRoot(root), CANDIDATES_DIR, batch);
};
const writeJson = (file, data) => { const tmp = `${file}.tmp`; writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`); renameSync(tmp, file); };

/** A target folder, checked to be inside references/ (and not the candidates): 'references/x/y/' form. */
export function checkTarget(root, target) {
  if (!target) return null;
  const { rel } = insideRoot(root, target);
  if (!rel.startsWith('references/') || rel.startsWith(`${CANDIDATES_DIR}`)) throw new Error(`target "${target}": a folder inside references/ please`);
  return `${rel.replace(/\/+$/, '')}/`;
}

/**
 * Run a batch. o: { root, prompt, refs: [paths], providers: [ids] | null (all with a key), n, ar, target,
 * from, comparison, models: { id: model }, keys, fetch, sleep, now, batch, onUpdate }. Returns the manifest.
 */
export async function runBatch(o) {
  const { root, keys = {} } = o;
  const prior = o.batch && existsSync(join(batchDir(root, o.batch), 'candidates.json')) ? readBatch(root, o.batch) : null;
  if (prior) o = { ...o, prompt: prior.prompt, refs: prior.refs, ar: prior.ar, n: o.n ?? prior.n, target: prior.target, from: prior.from, comparison: prior.comparison };
  const prompt = String(o.prompt ?? '').trim();
  if (!prompt) throw new Error('no prompt');
  const ar = parseAspect(o.ar ?? '1:1').label;
  const n = Math.max(1, Math.min(8, Math.round(+o.n || 1)));
  const target = checkTarget(root, o.target);
  const refs = (o.refs ?? []).map((p) => readRef(root, p));
  const want = o.providers?.length ? o.providers : PROVIDERS.filter((p) => keyFor(p, keys)).map((p) => p.id);
  const chosen = want.map((id) => PROVIDERS.find((p) => p.id === id) ?? { id, missing: true });
  const batch = o.batch ?? newBatchId(o.now ? new Date(o.now()) : new Date());
  const dir = batchDir(root, batch);
  mkdirSync(dir, { recursive: true });
  // (ignored by git on its own too: a checkout that has not pulled the .gitignore line yet)
  const ignore = join(storeRoot(root), CANDIDATES_DIR, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '# the reference lab\'s candidates (docs/systems/reference-lab.md): never committed\n*\n');
  const secrets = KEY_NAMES.map((k) => keys[k]).filter(Boolean);
  const manifest = prior ? { ...prior, status: 'running' } : {
    batch, date: new Date(o.now ? o.now() : Date.now()).toISOString().slice(0, 10), created: new Date(o.now ? o.now() : Date.now()).toISOString(),
    prompt, from: o.from ?? null, refs: refs.map((r) => r.path), ar, n, target, comparison: o.comparison ?? refs[0]?.path ?? null,
    status: 'running', providers: {}, candidates: [],
  };
  for (const p of chosen) {
    if (prior) {   // (a provider run again: its earlier pictures make way)
      for (const c of manifest.candidates.filter((x) => x.provider === p.id)) rmSync(join(dir, c.file), { force: true });
      manifest.candidates = manifest.candidates.filter((x) => x.provider !== p.id);
    }
    manifest.providers[p.id] = p.missing ? { status: 'error', kind: 'unknown', error: `no provider "${p.id}"` }
      : !keyFor(p, keys) ? { status: 'error', kind: 'no-key', label: p.label, error: `add ${p.keyName} to .env.local` }
        : { status: 'running', label: p.label, model: o.models?.[p.id] || p.model };
  }
  const save = () => { writeJson(join(dir, 'candidates.json'), manifest); o.onUpdate?.(manifest); };
  save();
  await Promise.all(chosen.filter((p) => manifest.providers[p.id].status === 'running').map(async (p) => {
    const t0 = Date.now(), entry = manifest.providers[p.id];
    try {
      const res = await p.generate({ prompt, refs: refs.slice(0, p.maxRefs), ar, n, model: entry.model },
        { key: keyFor(p, keys), env: keys, fetch: o.fetch, sleep: o.sleep, now: o.now, pollEvery: o.pollEvery });
      const ms = Date.now() - t0;
      mkdirSync(join(dir, p.id), { recursive: true });
      res.images.forEach((img, i) => {
        const file = `${p.id}/${i + 1}.${extOf(img.mime)}`;
        writeFileSync(join(dir, file), img.bytes);
        manifest.candidates.push({ id: `${p.id}/${i + 1}`, provider: p.id, label: p.label, model: res.model, file, mime: img.mime, bytes: img.bytes.length, sha256: sha256(img.bytes), ms, costUSD: res.costUSD == null ? null : +(res.costUSD / res.images.length).toFixed(4), status: 'new' });
      });
      Object.assign(entry, { status: 'done', model: res.model, ms, costUSD: res.costUSD, estimated: !!p.costEstimated, count: res.images.length, refsUsed: Math.min(refs.length, p.maxRefs), meta: res.meta ?? {} });
    } catch (e) {
      Object.assign(entry, { status: 'error', kind: e?.kind ?? 'error', ms: Date.now() - t0, error: redact(e?.message ?? String(e), secrets) });
    }
    save();
  }));
  manifest.status = 'done';
  manifest.candidates.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  save();
  return manifest;
}

/**
 * Join batches run apart (one provider at a time) into the first: their providers and pictures moved into it,
 * the others removed. Only batches with the same prompt: a pick is a choice between answers to one question.
 */
export function mergeBatches({ root, into, from }) {
  const m = readBatch(root, into);
  for (const b of from) {
    if (b === into) continue;
    const o = readBatch(root, b);
    if (o.prompt !== m.prompt) throw new Error(`${b} has another prompt than ${into}`);
    for (const [id, p] of Object.entries(o.providers)) {
      if (p.status !== 'done' && m.providers[id]) continue;   // (a failure never replaces what worked)
      m.candidates = m.candidates.filter((c) => c.provider !== id);
      for (const c of o.candidates.filter((x) => x.provider === id)) {
        mkdirSync(join(batchDir(root, into), id), { recursive: true });
        if (existsSync(join(batchDir(root, b), c.file))) renameSync(join(batchDir(root, b), c.file), join(batchDir(root, into), c.file));
        m.candidates.push(c);
      }
      m.providers[id] = p;
    }
    rmSync(batchDir(root, b), { recursive: true, force: true });
  }
  m.candidates.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  writeJson(join(batchDir(root, into), 'candidates.json'), m);
  return m;
}

/** A batch's manifest. */
export function readBatch(root, batch) {
  const f = join(batchDir(root, batch), 'candidates.json');
  if (!existsSync(f)) throw new Error(`no batch ${batch}`);
  return JSON.parse(readFileSync(f, 'utf8'));
}

/** Every batch, newest first: [{ batch, created, prompt, status, count, picked, providers }]. */
export function listBatches(root) {
  const dir = join(storeRoot(root), CANDIDATES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((b) => ID.test(b) && existsSync(join(dir, b, 'candidates.json'))).sort().reverse().map((b) => {
    try {
      const m = readBatch(root, b);
      return { batch: b, created: m.created, prompt: m.prompt, from: m.from, status: m.status, target: m.target, count: m.candidates.filter((c) => c.status !== 'discarded').length, picked: m.candidates.filter((c) => c.status === 'picked').length, providers: Object.keys(m.providers) };
    } catch { return { batch: b, status: 'unreadable' }; }
  });
}

/** 'batch/provider/n' or ('provider/n' with a batch) → { batch, candidate }. 'latest' finds the newest batch. */
export function parseCandidate(root, spec, batch = null) {
  const parts = String(spec).split('/');
  let b = batch, c = spec;
  if (parts.length === 3) { b = parts[0]; c = parts.slice(1).join('/'); }
  if (!b || b === 'latest') b = listBatches(root)[0]?.batch;
  if (!b) throw new Error('no batch: give batch/provider/n');
  return { batch: b, candidate: c };
}

/** The next free sheet number in a folder (sheet-1.jpg, sheet-2.png… whatever the extension). */
export function nextSheet(dir) {
  const used = existsSync(dir) ? readdirSync(dir).map((f) => f.match(/^sheet-(\d+)\./)?.[1]).filter(Boolean).map(Number) : [];
  return used.length ? Math.max(...used) + 1 : 1;
}

/**
 * Pick a candidate: copy it to the target as sheet-N.<ext> and append its record to the target's manifest.json.
 * o: { root, batch, candidate, target (else the batch's), why, now }. Returns { file, manifest, entry }.
 */
export function pick({ root, batch, candidate, target = null, why = '', now = Date.now }) {
  const m = readBatch(root, batch);
  const c = m.candidates.find((x) => x.id === candidate);
  if (!c) throw new Error(`no candidate ${candidate} in ${batch}`);
  if (c.status === 'discarded') throw new Error(`${candidate} was discarded`);
  const to = checkTarget(root, target || m.target);
  if (!to) throw new Error('no target folder: give --target references/…/');
  const dir = join(root, to);
  mkdirSync(dir, { recursive: true });
  const mf0 = join(dir, 'manifest.json');
  const again = existsSync(mf0) && JSON.parse(readFileSync(mf0, 'utf8')).sheets?.find((s) => s.batch === batch && s.candidate === c.id);
  if (again) {   // (picked twice: one sheet, the newer reason kept)
    const manifest = JSON.parse(readFileSync(mf0, 'utf8'));
    const entry = manifest.sheets.find((s) => s.batch === batch && s.candidate === c.id);
    if (why) entry.why = why;
    writeJson(mf0, manifest);
    return { file: `${to}${entry.file}`, manifest: `${to}manifest.json`, entry, again: true };
  }
  const ext = c.file.split('.').pop() === 'jpeg' ? 'jpg' : c.file.split('.').pop();
  const file = `sheet-${nextSheet(dir)}.${ext}`;
  copyFileSync(join(batchDir(root, batch), c.file), join(dir, file));
  const mf = join(dir, 'manifest.json');
  const manifest = existsSync(mf) ? JSON.parse(readFileSync(mf, 'utf8')) : {
    ...(to.startsWith('references/enemy-archetypes/') ? { archetype: to.split('/')[2] } : {}),
    created: new Date(now()).toISOString().slice(0, 10), sheets: [],
  };
  manifest.sheets ??= [];
  const entry = {
    file, service: 'Reference lab', provider: c.provider, providerLabel: c.label, model: c.model,
    prompt: m.prompt, from: m.from, refs: m.refs, ar: m.ar, date: new Date(now()).toISOString().slice(0, 10),
    batch, candidate: c.id, sha256: c.sha256, bytes: c.bytes, costUSD: c.costUSD, ...(why ? { why } : {}),
  };
  manifest.sheets.push(entry);
  writeJson(mf, manifest);
  c.status = 'picked'; c.pickedAs = `${to}${file}`;
  writeJson(join(batchDir(root, batch), 'candidates.json'), m);
  return { file: `${to}${file}`, manifest: `${to}manifest.json`, entry };
}

/** Discard a candidate (its picture deleted, marked so), or with no candidate the whole batch folder. */
export function discard({ root, batch, candidate = null }) {
  const dir = batchDir(root, batch);
  if (!existsSync(dir)) throw new Error(`no batch ${batch}`);
  if (!candidate) { rmSync(dir, { recursive: true, force: true }); return { removed: batch }; }
  const m = readBatch(root, batch);
  const c = m.candidates.find((x) => x.id === candidate);
  if (!c) throw new Error(`no candidate ${candidate} in ${batch}`);
  rmSync(join(dir, c.file), { force: true });
  c.status = 'discarded';
  writeJson(join(dir, 'candidates.json'), m);
  return { discarded: `${batch}/${candidate}` };
}
