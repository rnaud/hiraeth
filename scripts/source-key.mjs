// The game's code as one key (issue #385): a SHA-256 of every module the engines' bundle is built from (src/ and
// engine/, the .js and .json files, by path) and the versions of three and three-mesh-bvh. engine-bundle.mjs defines it
// in the bundle (__HIRAETH_SOURCE_KEY__), scripts/bake-worlds.mjs writes it into each world's bake, and src/world-bake.js
// uses a bake only when the two agree: a bundle built from other code (updated over the air) generates its worlds.
//   node scripts/source-key.mjs     → the key
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src', 'engine'];

function files(dir, out = []) {
  for (const f of readdirSync(dir).sort()) {
    const p = resolve(dir, f);
    if (statSync(p).isDirectory()) { if (f !== 'node_modules') files(p, out); }
    else if (/\.(m?js|json|glsl)$/.test(f)) out.push(p);
  }
  return out;
}

export function sourceKey(root = ROOT) {
  const h = createHash('sha256');
  for (const d of DIRS) for (const p of files(resolve(root, d))) { h.update(relative(root, p)); h.update('\0'); h.update(readFileSync(p)); h.update('\0'); }
  for (const m of ['three', 'three-mesh-bvh']) {
    try { h.update(`${m}@${JSON.parse(readFileSync(resolve(root, 'node_modules', m, 'package.json'), 'utf8')).version}`); } catch { h.update(`${m}@?`); }
  }
  return h.digest('hex').slice(0, 24);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(sourceKey());
