// Check the built game against a running static host (Workers locally or live).
// Build first, then: npm run check:deployment -- http://localhost:8787/
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = process.argv[2];
if (!input) throw new Error('Pass the deployment base URL, including its trailing slash.');
const base = new URL(input);
assert.ok(['http:', 'https:'].includes(base.protocol), 'Use an HTTP(S) URL');
assert.ok(base.pathname.endsWith('/'), 'The base URL must end in /');
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && !entry.name.startsWith('_')) files.push(path);
  }
}
await walk(dist);
assert.ok(files.length > 0, 'Build the game first');
// (eight at a time: the references page's pictures alone are over a thousand files, scripts/references-site.mjs)
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < files.length) {
    const file = files[next++];
    const name = relative(dist, file).split(sep).map(encodeURIComponent).join('/');
    const response = await fetch(new URL(name, base), { signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
    assert.equal(new URL(response.url).origin, base.origin, `${name}: redirected to another host`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(file), `${name}: differs from the build`);
  }
}));
// Virtual archive URLs must also reconstruct the exact bytes declared by their indexes.
for (const file of files.filter(file => /web-\d+\.zip\.json$/.test(file))) {
  const index = JSON.parse(await readFile(file, 'utf8'));
  const name = relative(dist, file).split(sep).join('/').replace(/\.json$/, '');
  const response = await fetch(new URL(name, base), { signal: AbortSignal.timeout(120_000) });
  assert.equal(response.status, 200, `${name}: download failed`);
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of response.body) { hash.update(chunk); size += chunk.length; }
  assert.equal(size, index.size, `${name}: incomplete archive`);
  assert.equal(hash.digest('hex'), index.sha256, `${name}: corrupt archive`);
}
const root = await fetch(base, { signal: AbortSignal.timeout(30_000) });
assert.equal(root.status, 200, 'The game opens at the site root');
assert.deepEqual(Buffer.from(await root.arrayBuffer()), await readFile(resolve(dist, 'index.html')));
// The games on devices fetch the recorded themes from here (src/music-store.js): another origin, so CORS (public/_headers).
const theme = files.map(file => relative(dist, file).split(sep).join('/')).find(name => /^music\/[^/]+\.mp3$/.test(name));
if (theme) {
  const response = await fetch(new URL(theme, base), { method: 'HEAD', headers: { Origin: 'http://127.0.0.1:41730' }, signal: AbortSignal.timeout(30_000) });
  assert.equal(response.headers.get('access-control-allow-origin'), '*', `${theme}: the devices can't fetch the themes (no CORS header: public/_headers)`);
}
const missing = await fetch(new URL('__deployment_missing_asset__.glb', base), { signal: AbortSignal.timeout(30_000) });
assert.equal(missing.status, 404, 'Missing assets must not return the game HTML');
console.log(`Verified ${files.length} built files, the game root, and missing-asset handling at ${base.href}`);
