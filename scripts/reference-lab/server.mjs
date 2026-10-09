// The reference lab's dev-server middleware (reference-lab.html, docs/systems/reference-lab.md). It exists only
// under `vite dev` (apply: 'serve'): a build has neither the page (it is not in BUILD_INPUT) nor these calls.
//
//   GET  /__reference-lab/providers        each provider, its models, whether it has a key (never the key)
//   GET  /__reference-lab/prompts          the prompt documents' entries and the manifests' prompts
//   GET  /__reference-lab/refs             every picture under references/ (not the candidates), by folder
//   GET  /__reference-lab/batches          the history; /batches/<id> one batch (polled while it runs)
//   GET  /__reference-lab/file/<batch>/<provider>/<n>.jpg   a candidate's picture (the store is the main checkout's)
//   POST /__reference-lab/generate         { prompt, refs, providers, models, n, ar, target, from, comparison } → { batch }
//   POST /__reference-lab/pick             { batch, candidate, target, why }
//   POST /__reference-lab/discard          { batch, candidate? }
//   POST /__reference-lab/reject           { batch, why }   none of them, and why (why: null takes it back)
//
// The keys are read here, on each generate (so a key added to .env.local works without a restart), and
// go only into the providers' request headers. Calls that spend money are refused from anything but this
// machine (a dev server started with --host is reachable from the network) and from other origins.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { IMAGE_EXT, ROOT, mimeOf } from './common.mjs';
import { availability, loadKeys } from './env.mjs';
import { PROVIDERS } from './providers/index.mjs';
import { listPrompts } from './prompts.mjs';
import { CANDIDATES_DIR, batchDir, discard, listBatches, newBatchId, pick, readBatch, reject, runBatch } from './batch.mjs';

export const API_BASE = '/__reference-lab/';

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
  return async (req, res, next) => {
    const url = (req.url ?? '').split('?')[0];
    if (!url.startsWith(API_BASE)) return next();
    const send = (status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
    if (!sameMachine(req)) return send(403, { error: 'the reference lab answers this machine only' });
    const path = url.slice(API_BASE.length);
    try {
      if (req.method === 'GET' && path === 'providers') return send(200, { providers: availability(PROVIDERS, keysFn()) });
      if (req.method === 'GET' && path === 'prompts') return send(200, listPrompts(root));
      if (req.method === 'GET' && path === 'refs') return send(200, { refs: listRefs(root) });
      if (req.method === 'GET' && path === 'batches') return send(200, { batches: listBatches(root) });
      if (req.method === 'GET' && path.startsWith('batches/')) return send(200, readBatch(root, decodeURIComponent(path.slice(8))));
      if (req.method === 'GET' && path.startsWith('file/')) {
        // a candidate's picture, from wherever the store is (the main checkout: not under this server's root)
        const m = decodeURIComponent(path.slice(5)).match(/^([A-Za-z0-9][\w.-]*)\/([a-z0-9-]+)\/(\d+\.(?:jpe?g|png|webp))$/);
        if (!m) return send(404, { error: 'not found' });
        const file = join(batchDir(root, m[1]), m[2], m[3]);
        if (!existsSync(file)) return send(404, { error: 'not found' });
        res.statusCode = 200; res.setHeader('Content-Type', mimeOf(file)); res.setHeader('Cache-Control', 'no-cache');
        return res.end(readFileSync(file));
      }
      if (req.method !== 'POST') return send(404, { error: 'not found' });
      const body = await readBody(req);
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
      if (path === 'pick') return send(200, pick({ root, batch: body.batch, candidate: body.candidate, target: body.target, why: body.why }));
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
