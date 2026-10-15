// The reference lab's dev-server middleware (reference-lab.html, docs/systems/reference-lab.md). It exists only
// under `vite dev` (apply: 'serve'): a build has neither the page (it is not in BUILD_INPUT) nor these calls.
//
//   GET  /__reference-lab/providers        each provider, its models, whether it has a key (never the key)
//   GET  /__reference-lab/prompts          the prompt documents' entries and the manifests' prompts
//   GET  /__reference-lab/refs             every picture under references/ (not the candidates), by folder
//   GET  /__reference-lab/batches          the history, summaries only (prompts cut short; cached, each batch re-read
//                                          only when its candidates.json changed; an ETag, so a poll with nothing
//                                          new is a 304); /batches/<id> one batch in full (polled while it runs)
//   GET  /__reference-lab/file/<batch>/<provider>/<n>.jpg   a candidate's picture (the store is the main checkout's)
//   GET  /__reference-lab/thumb/<batch>/<provider>/<n>.jpg  its thumbnail for the grid: a WebP at most 480 px a side
//                                          (sharp, cached in the temp folder); the full picture only when enlarged
//   POST /__reference-lab/generate         { prompt, refs, providers, models, n, ar, target, from, comparison } → { batch }
//   POST /__reference-lab/pick             { batch, candidate, target, why }
//   POST /__reference-lab/unpick           { batch, candidate }   a pick taken back (Pick mode's Back, to change it)
//   POST /__reference-lab/discard          { batch, candidate? }
//   POST /__reference-lab/reject           { batch, why }   none of them, and why (why: null takes it back)
//   POST /__reference-lab/generate3d       { images, crops, views, prompt, options, n, target, from } → { batch }  (3D mode, Tripo)
//   GET  /__reference-lab/tripo/balance    the Tripo account's credits (free to ask)
//   (pick takes { preview } too for a 3D batch: the page's turntable as a data URL)
//
// The keys are read here, on each generate (so a key added to .env.local works without a restart), and
// go only into the providers' request headers. Calls that spend money are refused from anything but this
// machine (a dev server started with --host is reachable from the network) and from other origins.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { thumb } from '../references-index.mjs';
import { IMAGE_EXT, ROOT, mimeOf } from './common.mjs';
import { availability, keyFor, loadKeys } from './env.mjs';
import { PROVIDERS } from './providers/index.mjs';
import { listPrompts } from './prompts.mjs';
import { CANDIDATES_DIR, batchDir, discard, listBatchesCached, newBatchId, readBatch, reject, runBatch, unpick } from './batch.mjs';
import { execute3dBatch, pickAny, prepare3dBatch } from './batch3d.mjs';
import tripo, { PREVIEW_ANIMATION, VIEWS } from './providers/tripo.mjs';

export const API_BASE = '/__reference-lab/';
/** The grid's candidate thumbnails: at most this many px a side (a card is ~300 px wide: sharp on a 2x screen), WebP. */
export const CAND_THUMB = 480;
const CAND_THUMBS = join(tmpdir(), 'hiraeth-reference-lab-thumbs');
const PICTURE = /\.(?:jpe?g|png|webp)$/i;
/** A candidate's file from `<batch>/<provider>/<file>`, checked (the batch id and each part: nothing outside the store), or null. */
export function candidateFile(root, spec, exts = /\.(?:jpe?g|png|webp|glb|fbx)$/i) {
  const m = String(spec).match(/^([A-Za-z0-9][\w.-]*)\/([a-z0-9-]+)\/([\w-]+\.[A-Za-z0-9]+)$/);
  if (!m || !exts.test(m[3])) return null;
  const file = join(batchDir(root, m[1]), m[2], m[3]);
  return existsSync(file) ? file : null;
}

/** Every picture under references/ (but the candidates): [{ path, folder, name, bytes }]. */
export function listRefs(root = ROOT) {
  const out = [];
  const walk = (rel, depth) => {
    if (depth > 6) return;
    for (const f of readdirSync(join(root, rel))) {
      if (f.startsWith('.')) continue;
      const p = `${rel}/${f}`;
      if (p === CANDIDATES_DIR) continue;
      const st = statSync(join(root, p));
      if (st.isDirectory()) walk(p, depth + 1);
      else if (IMAGE_EXT.test(f)) out.push({ path: p, folder: rel.replace(/^references\/?/, '') || '.', name: f, bytes: st.size });
    }
  };
  walk('references', 0);
  return out;
}

/** Is this request from this machine and this page? (pure over a request-like object) */
export function sameMachine(req) {
  const addr = String(req.socket?.remoteAddress ?? '');
  const local = addr === '' || addr === '::1' || addr === '127.0.0.1' || addr === '::ffff:127.0.0.1';
  const origin = req.headers?.origin;
  let sameOrigin = true;
  if (origin) { try { sameOrigin = new URL(origin).host === req.headers.host; } catch { sameOrigin = false; } }
  return local && sameOrigin;
}

const readBody = (req, limit = 1_000_000) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('request too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('not JSON')); } });
  req.on('error', reject);
});

/** The middleware (exported for the tests). `deps`: { root, fetch, loadKeys } to mock. */
export function referenceLabMiddleware({ root = ROOT, fetch: fetchFn, keys: keysFn = () => loadKeys(root) } = {}) {
  const running = new Map();   // batch → promise (the page polls the file; this keeps errors from going unseen)
  const summaries = new Map();   // the batches list's cache (listBatchesCached)
  return async (req, res, next) => {
    const url = (req.url ?? '').split('?')[0];
    if (!url.startsWith(API_BASE)) return next();
    const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
    // (an answer the browser keeps and asks again for with If-None-Match: nothing new is a 304 without a body)
    const fresh = (etag) => {
      res.setHeader('ETag', etag); res.setHeader('Cache-Control', 'no-cache');
      if (req.headers?.['if-none-match'] !== etag) return false;
      res.statusCode = 304; res.end(); return true;
    };
    const fileTag = (st, more = '') => `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}${more}"`;
    const sendJson = (data) => { res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    if (!sameMachine(req)) return send(403, { error: 'the reference lab answers this machine only' });
    const path = url.slice(API_BASE.length);
    try {
      if (req.method === 'GET' && path === 'providers') {
        const keys = keysFn();
        return send(200, { providers: availability(PROVIDERS, keys), tripo: { ...availability([tripo], keys)[0], views: VIEWS, animations: PREVIEW_ANIMATION } });
      }
      if (req.method === 'GET' && path === 'tripo/balance') {
        const key = keyFor(tripo, keysFn());
        if (!key) return send(200, { available: false });
        return send(200, { available: true, ...(await tripo.balance({ key, fetch: fetchFn })) });
      }
      if (req.method === 'GET' && path === 'prompts') return send(200, listPrompts(root));
      if (req.method === 'GET' && path === 'refs') return send(200, { refs: listRefs(root) });
      if (req.method === 'GET' && path === 'batches') {
        const list = listBatchesCached(root, summaries);
        return fresh(`"${list.version}"`) || sendJson(list);
      }
      if (req.method === 'GET' && path.startsWith('batches/')) {
        const id = decodeURIComponent(path.slice(8));
        const f = join(batchDir(root, id), 'candidates.json');
        if (existsSync(f) && fresh(fileTag(statSync(f)))) return;
        return sendJson(readBatch(root, id));
      }
      if (req.method === 'GET' && (path.startsWith('file/') || path.startsWith('thumb/'))) {
        // a candidate's picture, from wherever the store is (the main checkout: not under this server's root)
        // (<provider>/<n>.jpg, and the 3D mode's tripo/<n>.glb, tripo/<n>-preview.webp, inputs/<i>-<view>.png…);
        // thumb/: pictures only, small (the grid's; the picture itself where sharp can't read it)
        const small = path.startsWith('thumb/');
        let file = null;
        try { file = candidateFile(root, decodeURIComponent(path.slice(small ? 6 : 5)), small ? PICTURE : undefined); } catch { /* a bad batch id */ }
        if (!file) return send(404, { error: 'not found' });
        const st = statSync(file);
        if (fresh(fileTag(st, small ? `-t${CAND_THUMB}` : ''))) return;
        let buf = null, type = mimeOf(file);
        if (small) { try { buf = await thumb(file, st, CAND_THUMB, CAND_THUMBS); type = 'image/webp'; } catch { /* no sharp, or it can't read it */ } }
        res.statusCode = 200; res.setHeader('Content-Type', type);
        return res.end(buf ?? readFileSync(file));
      }
      if (req.method !== 'POST') return send(404, { error: 'not found' });
      const body = await readBody(req, path === 'pick' ? 8_000_000 : 1_000_000);   // (a 3D pick carries its turntable)
      if (path === 'generate') {
        const batch = newBatchId();
        const job = runBatch({ ...body, root, batch, keys: keysFn(), fetch: fetchFn });
        running.set(batch, job);
        job.catch(() => {}).finally(() => running.delete(batch));
        // (a bad request fails before any provider is called: say so now; otherwise the page polls the batch)
        const early = await Promise.race([job.then(() => null, (e) => e), new Promise((r) => setTimeout(() => r(null), 50))]);
        if (early) return send(400, { error: String(early.message ?? early) });
        return send(202, { batch });
      }
      if (path === 'generate3d') {
        // the inputs read and cropped first (a bad request says so now, nothing spent), then Tripo in the background
        const prepared = await prepare3dBatch({ ...body, root, batch: newBatchId() });
        const job = execute3dBatch(prepared, { keys: keysFn(), fetch: fetchFn });
        running.set(prepared.manifest.batch, job);
        job.catch(() => {}).finally(() => running.delete(prepared.manifest.batch));
        return send(202, { batch: prepared.manifest.batch, estimateUSD: prepared.manifest.estimateUSD });
      }
      if (path === 'pick') return send(200, pickAny({ root, batch: body.batch, candidate: body.candidate, target: body.target, why: body.why, preview: body.preview ?? null }));
      if (path === 'unpick') return send(200, unpick({ root, batch: body.batch, candidate: body.candidate }));
      if (path === 'reject') return send(200, reject({ root, batch: body.batch, why: body.why ?? null }));
      if (path === 'discard') return send(200, discard({ root, batch: body.batch, candidate: body.candidate ?? null }));
      return send(404, { error: 'not found' });
    } catch (e) {
      return send(400, { error: String(e?.message ?? e) });
    }
  };
}

/** The Vite plugin: the middleware on the dev server only. */
export function referenceLabPlugin(opts = {}) {
  return {
    name: 'reference-lab',
    apply: 'serve',
    configureServer(server) { server.middlewares.use(referenceLabMiddleware(opts)); },
  };
}
