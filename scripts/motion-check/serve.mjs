// Builds side by side for the motion check: /<name>/... is <builds>/dist-<name>/... (build each with
// `npx vite build --outDir <builds>/dist-<name>`), no caching.
//   node scripts/motion-check/serve.mjs --builds <dir> [--port 6121]
import { createServer } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { TYPES } from '../bench/serve.mjs';

const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const ROOT = resolve(A.builds ?? '.'), port = +(A.port ?? 6121);
createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const m = url.match(/^\/([\w.-]+)(\/.*)?$/);
  if (!m) return res.writeHead(404).end();
  const dir = join(ROOT, 'dist-' + m[1]);
  let f = normalize(join(dir, m[2] ?? '/'));
  if (!f.startsWith(dir)) return res.writeHead(403).end();
  try { if (statSync(f).isDirectory()) f = join(f, 'index.html'); } catch { /* not there */ }
  if (!existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream', 'Content-Length': statSync(f).size, 'Cache-Control': 'no-store' });
  createReadStream(f).pipe(res);
}).listen(port, () => console.log(`motion check: builds in ${ROOT} on ${port}`));
