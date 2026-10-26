// Fixed game entry + bounded runtime assets for whole-game tests. Generic VM and
// bundle callers retain conservative selection. The selector audits exact source
// fingerprints in scripts/test-loader-contract.json before using this boundary.
import { bundle as compile } from '../scripts/engine-bundle-core.mjs';
import { loadSource } from './vm-run.mjs';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundles = new Map();
const within = (root, file) => { const rel = relative(root, file); return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel); };
export function readGameAsset(path) {
  if (typeof path !== 'string' || isAbsolute(path) || path.includes('\\') || path.includes('\0')) throw Error('Invalid game asset path');
  const root = resolve(ROOT, path.startsWith('data/') ? 'data' : 'public');
  const file = resolve(ROOT, path.startsWith('data/') ? path : 'public/' + path);
  if (!within(root, file) || !within(realpathSync(root), realpathSync(file))) throw Error('Game asset outside public/data');
  return readFileSync(file);
}
export async function bundle(name, override = {}) {
  if (!['godot', 'unity'].includes(name) || override.input !== 'engine/game.js' ||
      !Array.isArray(override.out) || override.out.length !== 1 || typeof override.out[0] !== 'string' ||
      Object.keys(override).some(k => !['input', 'out'].includes(k))) throw Error('Fixed game test entry required');
  const result = await compile(name, override);
  const file = resolve(ROOT, override.out[0]);
  // Keep the bytes just compiled: loading an arbitrary or subsequently replaced
  // file must not expand the declared executable inputs.
  bundles.set(file, readFileSync(file, 'utf8'));
  return result;
}
export function loadBundle(file, host = {}, globals = {}, options = {}) {
  const path = resolve(ROOT, file);
  if (!bundles.has(path)) throw Error('Build this game bundle through the bounded test runtime first');
  return loadSource(bundles.get(path), host, globals, { ...options, filename: path, readBytes: readGameAsset });
}
