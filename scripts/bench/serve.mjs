// A plain static server for the benchmark's browser sides, on one port (default 5245):
//   /                the web game's production build (dist/, as `vite preview` serves it)
//   /unity-webgl/    Unity's WebGL build (unity/Memento/Builds/WebGL, BenchBuild.WebGL)
//   node scripts/bench/serve.mjs [--port 5245] [--dist dist] [--webgl unity/Memento/Builds/WebGL]
// No compression (both sides are read from the same disk; the report gives the gzipped sizes apart).
// staticHandler() is the same server for a script of its own (android-engines.mjs serves the GeckoView
// side itself, with its page bridge: gecko-bridge.mjs).
import { createServer } from 'node:http';
import { createReadStream, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, join, extname, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';

export const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.data': 'application/octet-stream', '.bin': 'application/octet-stream', '.gz': 'application/octet-stream' };

/**
 * roots: [[prefix, dir], …] (the first prefix that matches); inject(req): a tag to put first in the
 * head of every HTML page for this request, or null.
 */
export function staticHandler(roots, { inject = () => null } = {}) {
  return (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const tag = inject(req);
    const html = (s) => (tag ? s.replace(/<head>/i, (h) => h + tag) : s);
    // (an empty page of the game's origin, for setting its storage without booting it: android-engines.mjs)
    if (url === '/bench-blank.html') { res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' }).end(html('<!doctype html><html><head><title>bench</title></head></html>')); return; }
    const [prefix, dir] = roots.find(([p]) => url.startsWith(p));
    let f = normalize(join(dir, url.slice(prefix.length)));
    if (!f.startsWith(dir)) { res.writeHead(403).end(); return; }
    try { if (statSync(f).isDirectory()) f = join(f, 'index.html'); } catch { /* */ }
    if (!existsSync(f)) {
      // (the game's routes fall back to its page, as vite preview does)
      if (prefix === '/' && !extname(url)) f = join(dir, 'index.html'); else { res.writeHead(404).end(); return; }
    }
    const type = TYPES[extname(f)] ?? 'application/octet-stream';
    if (tag && type === 'text/html') { const body = html(readFileSync(f, 'utf8')); res.writeHead(200, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' }).end(body); return; }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': statSync(f).size, 'Cache-Control': 'no-store' });
    createReadStream(f).pipe(res);
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opt = Object.fromEntries(process.argv.slice(2).join(' ').split(/\s*--/).filter(Boolean).map((s) => { const [k, ...v] = s.split(/\s+/); return [k, v.join(' ') || true]; }));
  const PORT = +(opt.port ?? 5245);
  const ROOTS = [['/unity-webgl/', resolve(ROOT, opt.webgl ?? 'unity/Memento/Builds/WebGL')], ['/', resolve(ROOT, opt.dist ?? 'dist')]];
  createServer(staticHandler(ROOTS)).listen(PORT, () => console.log(`bench: serving ${ROOTS.map(([p, d]) => `${p} → ${d}`).join(', ')} on http://localhost:${PORT}/`));
}
