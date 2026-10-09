#!/usr/bin/env node
// The unit tests a commit's changes reach, for .githooks/pre-commit (the full suite runs on
// GitHub before every deploy: .github/workflows/tests.yml).
//
//   node scripts/affected-tests.mjs <changed files…>   prints the test files to run, one a line,
//                                                       or ALL when everything should run
//
// A test is reached when it changed, or when one of the files it imports (followed through the
// repository's own imports) or reads by a literal path ('../src/main.js') changed, or when the test
// names a changed file's path ('changelog.md'). Paths a test builds from a template are not
// followed: the full run on GitHub covers those. Everything runs
// when a shared piece changed (package.json, the lock, a test helper, the hook, this script) or
// when the commit is large.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_CHANGED = 40;
const SHARED = /^(package\.json|package-lock\.json|\.githooks\/|scripts\/affected-tests\.mjs$|tests\/(?!.*\.test\.js$)[^/]+\.(js|mjs)$)/;
const CODE = /\.(js|mjs|cjs|json|glsl|html|css)$/;

// import … from './x.js', import('./x.js'), export … from './x.js', new URL('../x', import.meta.url)
const REFS = [
  /\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g,
  /\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
  /\bimport\s*['"](\.{1,2}\/[^'"]+)['"]/g,
  /new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url/g,
];

/** The repository files `file` refers to by a relative literal path (root-relative). */
export function refsOf(file, text) {
  const out = new Set();
  for (const re of REFS) {
    for (const m of text.matchAll(re)) {
      const p = m[1].split(/[?#]/)[0];
      out.add(normalize(join(dirname(file), p)));
    }
  }
  return [...out];
}

/** Which tests to run for these changed files: 'ALL' or a sorted list of test paths. */
export function affectedTests(changed, { root = ROOT, read = (f) => readFileSync(join(root, f), 'utf8'), exists = (f) => existsSync(join(root, f)), tests = null } = {}) {
  const files = changed.map((f) => normalize(f));
  if (files.length > MAX_CHANGED || files.some((f) => SHARED.test(f))) return 'ALL';
  if (!files.some((f) => CODE.test(f))) return [];
  const touched = new Set(files);
  const all = tests ?? readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.js')).map((f) => `tests/${f}`);
  const seen = new Map();   // file → its refs (null when unreadable)
  const refs = (f) => {
    if (!seen.has(f)) {
      let r = null;
      if (/\.(js|mjs|cjs)$/.test(f) && exists(f)) { try { r = refsOf(f, read(f)); } catch { r = null; } }
      seen.set(f, r);
    }
    return seen.get(f);
  };
  const reaches = (test) => {
    const stack = [test], visited = new Set();
    while (stack.length) {
      const f = stack.pop();
      if (visited.has(f)) continue;
      visited.add(f);
      if (touched.has(f)) return true;
      for (const r of refs(f) ?? []) if (!visited.has(r)) stack.push(r);
    }
    return false;
  };
  const names = (test) => { try { const t = read(test); return files.some((f) => t.includes(f)); } catch { return false; } };
  return all.filter((t) => reaches(t) || names(t)).sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const changed = process.argv.slice(2).map((f) => relative(ROOT, resolve(f)));
  const r = affectedTests(changed);
  process.stdout.write(r === 'ALL' ? 'ALL\n' : r.map((t) => `${t}\n`).join(''));
}
