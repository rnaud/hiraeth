// The game's JavaScript for the engines' VMs (docs/systems/engine-bridge.md): one CommonJS file per
// entry, three.js and the game's modules inside, nothing from Node or the page.
//
//   node scripts/engine-bundle.mjs            # every entry
//   node scripts/engine-bundle.mjs spike      # one
//
// GodotJS loads CommonJS (require / exports); Puerts too (its CommonJS loader). Neither has ESM
// with top-level await across files, so the bundle is flat; the engines' own modules ('godot',
// 'csharp', 'puerts') stay outside it.
import { rolldown } from 'rolldown';
import { mkdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ENTRIES = {
  spike: { input: 'engine/godot/spike.js', out: ['godot/js/memento-spike.js'] },
  godot: { input: 'engine/godot/game.js', out: ['godot/js/memento.js'] },
};

/**
 * GodotJS's V8 is built without ICU: a regular expression with a Unicode property escape
 * (`\p{L}`, `\p{N}`) is a syntax error there, and the whole bundle fails to load. Inside a
 * character class (the game's only uses: story/voice.js, story/dialogue.js, story/scripts.js) they
 * become the ranges of the scripts the game writes in (Latin, Greek, Cyrillic, Armenian, Hebrew,
 * Arabic, Devanagari, kana, CJK, Hangul) and the digits; tests/engine-bridge.test.js checks they
 * match the same characters on the game's own lines.
 */
export const UNICODE_CLASSES = {
  L: 'A-Za-z\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02C1\\u02C6-\\u02D1\\u0370-\\u0373\\u0376-\\u037D\\u037F-\\u03FF\\u0400-\\u0481\\u048A-\\u052F\\u0531-\\u0556\\u0561-\\u0587\\u05D0-\\u05EA\\u0620-\\u064A\\u0671-\\u06D3\\u0904-\\u0939\\u0958-\\u0961\\u1E00-\\u1FFF\\u3041-\\u3096\\u30A1-\\u30FA\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uAC00-\\uD7A3',
  N: '0-9\\u00B2\\u00B3\\u00B9\\u00BC-\\u00BE\\u0660-\\u0669\\u06F0-\\u06F9\\u0966-\\u096F\\u2070-\\u2079\\u2080-\\u2089\\u2150-\\u2189\\u2460-\\u249B\\uFF10-\\uFF19',
};
export function lowerUnicodeClasses(code) {
  return code.replace(/\\p\{(L|N)\}/g, (m, k) => UNICODE_CLASSES[k]);
}
const noIcu = () => ({
  name: 'memento-no-icu',
  transform(code, id) { if (!id.includes('node_modules') && code.includes('\\p{')) return { code: lowerUnicodeClasses(code), map: null }; return null; },
});

export async function bundle(name, override = {}) {
  const e = { ...ENTRIES[name], ...override };
  const t0 = Date.now();
  const build = await rolldown({
    input: resolve(ROOT, e.input),
    external: ['godot', 'godot-jsb', 'csharp', 'puerts'],
    platform: 'neutral',
    // (vite's import.meta.env, and the module URLs the reference sheets resolve their pictures from)
    transform: { define: { 'import.meta.env.BASE_URL': '"./"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"engine"', 'import.meta.url': '"engine://memento/src/module.js"' } },
    plugins: [noIcu()],
    logLevel: 'warn',
  });
  const out = [];
  for (const file of e.out) {   // (paths from the repository root, or absolute)
    const path = resolve(ROOT, file);
    mkdirSync(dirname(path), { recursive: true });
    await build.write({ file: path, format: 'cjs', codeSplitting: false, sourcemap: false, comments: { legal: false } });
    out.push({ file, bytes: statSync(path).size });
  }
  await build.close();
  return { name, ms: Date.now() - t0, out };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ENTRIES);
  for (const n of names) {
    const r = await bundle(n);
    console.log(`${r.name}: ${r.out.map((o) => `${o.file} ${(o.bytes / 1e6).toFixed(2)} MB`).join(', ')} (${r.ms} ms)`);
  }
}
