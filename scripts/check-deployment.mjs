// Check the built game against a running static host (Workers locally or live).
// Build first, then: npm run check:deployment -- http://localhost:8787/
import assert from 'node:assert/strict';
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
for (const file of files) {
  const name = relative(dist, file).split(sep).map(encodeURIComponent).join('/');
  const response = await fetch(new URL(name, base), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  assert.equal(new URL(response.url).origin, base.origin, `${name}: redirected to another host`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(file), `${name}: differs from the build`);
}
const root = await fetch(base, { signal: AbortSignal.timeout(30_000) });
assert.equal(root.status, 200, 'The game opens at the site root');
assert.deepEqual(Buffer.from(await root.arrayBuffer()), await readFile(resolve(dist, 'index.html')));
const missing = await fetch(new URL('__deployment_missing_asset__.glb', base), { signal: AbortSignal.timeout(30_000) });
assert.equal(missing.status, 404, 'Missing assets must not return the game HTML');
console.log(`Verified ${files.length} built files, the game root, and missing-asset handling at ${base.href}`);
