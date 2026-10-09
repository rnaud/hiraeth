// The reference lab's API keys (docs/systems/reference-lab.md), read server-side only.
//
// Where from, the first that has a key winning: the process environment, then `.env.local` and `.env` at the
// root of the checkout that runs it, then the same two files in the main checkout (so a git worktree, which
// has neither, still finds the author's). Both files are git-ignored (.gitignore: .env, .env.*, .env.local).
//
// Only the names below are read; their values stay in this process: availability() tells the page which
// providers have a key, never the key.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

/** Every key name the providers use (fal answers to two names). */
export const KEY_NAMES = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'FAL_KEY', 'FAL_API_KEY', 'BFL_API_KEY'];
/** Settings read alongside (not secret). */
export const SETTING_NAMES = ['GEMINI_IMAGE_API'];
export const ENV_FILES = ['.env.local', '.env'];

/** KEY=value lines (comments, `export `, quotes) → { KEY: value } (pure). */
export function parseEnv(text = '') {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}

/** The main checkout's root when `root` is a git worktree (null otherwise, or without git). */
export function mainCheckout(root) {
  try {
    // (without the GIT_* variables a hook sets: they would answer for the repository being committed, not `root`)
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const main = dirname(resolve(root, common));
    return resolve(main) === resolve(root) ? null : main;
  } catch { return null; }
}

/** The env files looked at, in order (pure apart from `main`). */
export function envFiles(root, main = mainCheckout(root)) {
  const dirs = [root, ...(main ? [main] : [])];
  return dirs.flatMap((d) => ENV_FILES.map((f) => join(d, f)));
}

/**
 * The keys and settings: { OPENAI_API_KEY: '…', … } with only the names above, empty ones left out.
 * `files` and `processEnv` for the tests.
 */
export function loadKeys(root, { processEnv = process.env, files = envFiles(root), read = (f) => readFileSync(f, 'utf8') } = {}) {
  const want = [...KEY_NAMES, ...SETTING_NAMES];
  const out = {};
  const take = (src) => { for (const k of want) if (!out[k] && typeof src[k] === 'string' && src[k].trim()) out[k] = src[k].trim(); };
  take(processEnv ?? {});
  for (const f of files) if (existsSync(f)) { try { take(parseEnv(read(f))); } catch { /* unreadable: skip */ } }
  return out;
}

/** A provider's key from the loaded keys (its name, then its aliases), or ''. */
export const keyFor = (provider, keys) => [provider.keyName, ...(provider.keyAliases ?? [])].map((k) => keys[k]).find(Boolean) ?? '';

/** What the page and the CLI may know: each provider, whether it has a key, which name to add. No values. */
export function availability(providers, keys) {
  return providers.map((p) => ({
    id: p.id, label: p.label, keyName: p.keyName, keyAliases: p.keyAliases ?? [],
    available: !!keyFor(p, keys),
    model: p.model, models: p.models, maxRefs: p.maxRefs, checked: p.checked, docs: p.docs,
    costPerImage: p.costPerImage(p.model, {}), costEstimated: !!p.costEstimated,
  }));
}
