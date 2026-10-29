// Fixed game entry + bounded runtime assets for whole-game tests. Generic VM and
// bundle callers retain conservative selection. The selector audits exact source
// fingerprints in scripts/test-loader-contract.json before using this boundary.
import { bundle as compile } from '../scripts/engine-bundle-core.mjs';
import { loadSource } from './vm-run.mjs';
import { readFileSync, realpathSync, readdirSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, dirname, join } from 'node:path';
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

/**
 * The compiled game, kept between test processes (each whole-game test file compiled engine/game.js again: ~3 s).
 * A kept bundle is used only when everything its compile read is as it was: the compiler (engine-bundle-core.mjs)
 * and the locked packages (package-lock.json) by the key; every module rolldown put in it, byte for byte; and the
 * names of every file under src/ and engine/ (a new file a glob would take in, a file an import would now resolve
 * to). Anything else compiles afresh, as does GAME_BUNDLE_CACHE=0. The kept bytes are checked against their hash.
 */
const CACHE = join(ROOT, '.cache', 'game-bundles');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const tree = () => sha(['src', 'engine'].map((d) => d + '\n' + readdirSync(join(ROOT, d), { recursive: true }).map(String).sort().join('\n')).join('\n'));
const moduleFile = (id) => (typeof id === 'string' && isAbsolute(id) && !id.includes('\0') && existsSync(id) ? id : null);
export function bundleKey(name, input) {
  return sha([name, input, readFileSync(join(ROOT, 'scripts/engine-bundle-core.mjs')), readFileSync(join(ROOT, 'package-lock.json'))].join('\0'));
}
export function keptBundle(key, dir = CACHE) {
  try {
    const meta = JSON.parse(readFileSync(join(dir, key + '.json'), 'utf8'));
    if (meta.key !== key || meta.tree !== tree() || !meta.modules || !Object.keys(meta.modules).length) return null;
    for (const [file, hash] of Object.entries(meta.modules)) if (!existsSync(file) || sha(readFileSync(file)) !== hash) return null;
    const code = readFileSync(join(dir, key + '.cjs'), 'utf8');
    return sha(code) === meta.code ? code : null;
  } catch { return null; }
}
export function keep(key, code, modules, dir = CACHE) {
  const files = {};
  for (const id of modules) {
    const file = moduleFile(id);
    if (!file) { if (id.includes('\0')) continue; return; }   // (a virtual module is the plugins' own; an unreadable one: keep nothing)
    files[file] = sha(readFileSync(file));
  }
  if (!Object.keys(files).length) return;
  mkdirSync(dir, { recursive: true });
  const tmp = `.${process.pid}.tmp`;
  writeFileSync(join(dir, key + '.cjs' + tmp), code); renameSync(join(dir, key + '.cjs' + tmp), join(dir, key + '.cjs'));
  writeFileSync(join(dir, key + '.json' + tmp), JSON.stringify({ key, tree: tree(), code: sha(code), modules: files }));
  renameSync(join(dir, key + '.json' + tmp), join(dir, key + '.json'));
}

export async function bundle(name, override = {}) {
  if (!['godot', 'unity'].includes(name) || override.input !== 'engine/game.js' ||
      !Array.isArray(override.out) || override.out.length !== 1 || typeof override.out[0] !== 'string' ||
      Object.keys(override).some(k => !['input', 'out'].includes(k))) throw Error('Fixed game test entry required');
  const file = resolve(ROOT, override.out[0]);
  const key = process.env.GAME_BUNDLE_CACHE === '0' ? null : bundleKey(name, override.input);
  const kept = key && keptBundle(key);
  if (kept) {
    const t0 = Date.now();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, kept);
    bundles.set(file, kept);
    return { name, ms: Date.now() - t0, out: [{ file: override.out[0], bytes: Buffer.byteLength(kept) }], kept: true };
  }
  const result = await compile(name, override);
  // Keep the bytes just compiled: loading an arbitrary or subsequently replaced
  // file must not expand the declared executable inputs.
  const code = readFileSync(file, 'utf8');
  bundles.set(file, code);
  if (key) try { keep(key, code, result.modules ?? []); } catch { /* not kept: the next file compiles again */ }
  return result;
}
export function loadBundle(file, host = {}, globals = {}, options = {}) {
  const path = resolve(ROOT, file);
  if (!bundles.has(path)) throw Error('Build this game bundle through the bounded test runtime first');
  return loadSource(bundles.get(path), host, globals, { ...options, filename: path, readBytes: readGameAsset });
}
