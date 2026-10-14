// Every file in public/ is copied into dist/ and so into the APK, the Deck package and the over-the-air zip: each one
// must be a file a game page loads (the site's own files, scripts/site-only.mjs, never reach a device and are left out) (issue #300: the Elder's first prototype body, 3 MB, shipped to every device for
// a review page and two tests). A file is loaded when the code reachable from the pages vite builds (vite.config.js
// BUILD_INPUT, following their imports) names its folder and its name; anything else is in ALLOWED with the reason.
// What only the tools or the tests read belongs in data/ (tools/ are served from the repository in dev).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_INPUT } from '../vite.config.js';
import { siteOnly } from '../scripts/site-only.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const posix = (p) => p.split(sep).join('/');
const walk = (d, out = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; };

/** Files in public/ no page's code names, each with why it ships anyway. */
export const ALLOWED = [
  [/^anim\/(mh\/)?LICENSE-[\w-]+\.txt$/, 'the licences of the bodies and clips beside them'],
  [/^anim\/traveller\.txt$/, 'where the old traveller body beside it (anim/traveller.glb) comes from'],
  [/^characters\/traveller-v1\/(README\.md|head-v3\/provenance\.json)$/, 'where the traveller\'s generated files come from'],
  [/^guardians\/[\w-]+\/rig\.json$/, 'the fitting report beside each guardian\'s body (scripts/tripo/rig-*.mjs)'],
];

/** The source files the built pages reach: their scripts and everything those import (static, dynamic, workers, globs). */
function reachable() {
  const seen = new Set(), queue = [];
  const add = (file) => { if (existsSync(file) && !seen.has(file)) { seen.add(file); queue.push(file); } };
  for (const html of Object.values(BUILD_INPUT)) {
    add(html);
    for (const [, src] of readFileSync(html, 'utf8').matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) add(src.startsWith('/') ? join(ROOT, src) : resolve(dirname(html), src));
  }
  while (queue.length) {
    const file = queue.shift();
    if (!/\.m?js$/.test(file)) continue;
    const text = readFileSync(file, 'utf8'), here = dirname(file);
    const specs = [
      ...text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g), ...text.matchAll(/\bimport\s*['"]([^'"]+)['"]/g),
      ...text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g), ...text.matchAll(/new URL\(\s*['"]([^'"]+\.m?js)['"]\s*,\s*import\.meta\.url/g),
    ].map((m) => m[1]).filter((s) => s.startsWith('.') || s.startsWith('/src/'));
    for (const s of specs) add(s.startsWith('/') ? join(ROOT, s) : resolve(here, s));
    // import.meta.glob(['./*.js', '!./index.js']): every module of the folder
    for (const [, list] of text.matchAll(/import\.meta\.glob\(\s*\[([^\]]*)\]/g)) {
      const globs = [...list.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const g of globs.filter((x) => !x.startsWith('!'))) {
        const dir = resolve(here, dirname(g)), ext = g.slice(g.lastIndexOf('.'));
        for (const f of readdirSync(dir)) if (f.endsWith(ext) && !globs.includes(`!./${f}`)) add(join(dir, f));
      }
    }
  }
  return [...seen];
}

const files = reachable();
// (the changelog's own prose names old files; it loads none)
const corpus = files.filter((f) => !/src\/changelog(-media)?\.js$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n')
  + readFileSync(join(ROOT, 'public/manifest.webmanifest'), 'utf8');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Is public/<rel> named by the pages' code: its whole path, or its folder (as a path's end) and its name (or its stem, or a numbered stem's root: sfx/step-sand-3.mp3 is `${name}-${i}`)? */
export function named(rel, text = corpus) {
  if (text.includes(rel)) return true;
  const slash = rel.lastIndexOf('/'), folder = rel.slice(0, slash + 1), base = rel.slice(slash + 1), stem = base.replace(/\.[^.]+$/, ''), root = stem.replace(/-\d+$/, '');
  if (folder && !new RegExp(`${escape(folder.slice(0, -1))}/?(?:['"\`]|\\$\\{)`).test(text)) return false;
  return text.includes(base) || new RegExp(`['"\`/]${escape(stem)}['"\`.]`).test(text) || new RegExp(`['"\`]${escape(root)}['"\`]`).test(text)
    || new RegExp(`(?:^|[\\s{,])${escape(stem)}\\s*:`, 'm').test(text);   // (an object's key: ITEMS.lightcell)
}

test('the reachable code is the game\'s: boot, the levels, the gadgets\' glob, the workers', () => {
  const rel = files.map((f) => posix(relative(ROOT, f)));
  for (const f of ['src/boot.js', 'src/characters/traveller-b3.js', 'src/characters/tripo-cloth-worker.js', 'src/music-page/main.js']) assert.ok(rel.includes(f) || rel.some((r) => r.startsWith(f.replace(/main\.js$/, ''))), `${f} reached`);
  assert.ok(rel.filter((r) => r.startsWith('src/gadgets/')).length > 3, 'the gadgets\' glob followed');
  assert.ok(!rel.includes('src/characters/elder-creature.js'), 'the Elder\'s first prototype is not reached');
});

test('every file in public/ is one a game page loads, or allowed with its reason', () => {
  const stray = walk(join(ROOT, 'public')).map((f) => posix(relative(join(ROOT, 'public'), f)))
    .filter((rel) => !siteOnly(rel) && !named(rel) && !ALLOWED.some(([re]) => re.test(rel)));
  assert.deepEqual(stray, [], 'files in public/ no page loads (move what only the tools or tests read to data/, or allow it with a reason)');
});

test('the rule catches a body no page names, and passes one a folder and a name do', () => {
  assert.equal(named('guardians/elder-v1/model.glb', "loadAsync(`${base}guardians/elder-v3/model.glb`)"), false);
  assert.equal(named('guardians/elder-v3/model.glb', "loadAsync(`${base}guardians/elder-v3/model.glb`)"), true);
  assert.equal(named('characters/b3/model.glb', "folder=`${base}characters/b3/`; load(folder+'model.glb')"), true);
  assert.equal(named('sfx/step-sand-3.mp3', "const SFX={'step-sand':5}; `sfx/${n}-${i}.mp3`"), true);
  assert.equal(named('characters/v1/model.glb', "`${base}characters/v1/head/`; 'model.glb'"), false);
});

test('every allowance still matches a file (none left over)', () => {
  const all = walk(join(ROOT, 'public')).map((f) => posix(relative(join(ROOT, 'public'), f)));
  for (const [re, why] of ALLOWED) assert.ok(all.some((rel) => re.test(rel)), `${re} (${why}) matches nothing`);
});
