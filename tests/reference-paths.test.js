// A guard against stale paths into references/ (docs/systems/references.md "The references folder"): every
// text file of the repository that names a folder under references/ names one that is there. The worlds live
// in references/levels/<World>/ (environment/, characters/, places/) and the retired world enemies in
// references/archive/world-enemies/<World>/, so an old `references/<World>/…` or `…/<World>/enemies/…` (or a
// world path written relative to references/, as the batches do: `<World>/characters/…`) fails here, as does
// a typo in a top-level folder's name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REFS = join(ROOT, 'references');
const BINARY = /\.(jpe?g|png|webp|gif|glb|gltf|bin|fbx|obj|gz|zip|apk|aab|jar|keystore|jks|mp3|ogg|wav|m4a|mp4|webm|ttf|otf|woff2?|ico|icns|exr|hdr|ktx2|basis|wasm|psd|pdf|blend|unitypackage|asset|mat|prefab|meta|so|dll|class|dex)$/i;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'android', 'unity', '_candidates', '.local-tools', '.claude', 'audits']);

/** The repository's text files: git's list, or a walk where there is no git. */
function textFiles() {
  let files;
  try {
    files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 1 << 30 }).toString().split('\0').filter(Boolean);
  } catch {
    files = [];
    const walk = (rel) => {
      for (const f of readdirSync(join(ROOT, rel))) {
        if (SKIP_DIRS.has(f)) continue;
        const p = rel ? `${rel}/${f}` : f;
        if (statSync(join(ROOT, p)).isDirectory()) walk(p); else files.push(p);
      }
    };
    walk('');
  }
  // (.claude/skills is the repo's: read it too; the rest of .claude is the agents' worktrees)
  return files.filter((f) => !BINARY.test(f) && (!f.startsWith('.claude/') || f.startsWith('.claude/skills/')) && existsSync(join(ROOT, f)));
}

const entries = (dir) => (existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir).filter((f) => !f.startsWith('.')) : []);
const WORLDS = entries(join(REFS, 'levels'));
const PLACEHOLDER = /^(\$\{|<|…|\*|\{|\.\.\.|\s|\(|:|$)/;
/** The tests that build a references/ tree of their own in a temporary folder (x/, a b/…). */
const FIXTURE_TREES = new Set(['tests/reference-lab.test.js', 'tests/reference-lab-3d.test.js', 'tests/references-page.test.js']);
/** Folders named before this guard that were never committed (the traveller's sheets of 2026-10-05, lore/). */
const NEVER_COMMITTED = new Set(['references/traveller']);

/**
 * Does `rest` (what follows "references/" in a text) start with folders that exist, as deep as the layout is
 * fixed (a top-level entry; under levels/, the world and its kind)? Returns null, or what is missing.
 * Names have spaces, so each level takes the longest entry `rest` starts with (followed by "/" or the end of the path).
 */
export function missingIn(rest, root = REFS) {
  let dir = root, at = rest, path = 'references';
  for (let depth = 0; depth < 3; depth++) {
    if (PLACEHOLDER.test(at)) return null;
    if (depth === 0 && /^_candidates(\/|$)/.test(at)) return null;   // (the lab's store: git-ignored, in the main checkout)
    const name = entries(dir).sort((x, y) => y.length - x.length)
      .find((n) => at === n || at.startsWith(`${n}/`) || (at.startsWith(n) && !/[\w%-]/.test(at[n.length])));
    if (!name) return `${path}/${at.split('/')[0]}`;
    path += `/${name}`; dir = join(dir, name); at = at.slice(name.length);
    if (!at.startsWith('/')) return null;   // (the path ends here, or prose follows)
    at = at.slice(1);
    if (!(depth === 0 ? ['levels', 'archive'].includes(name) : /^references\/(levels|archive)\//.test(path))) return null;
  }
  return null;
}

test('the layout: the worlds are under references/levels/, each with its environment beside its people', () => {
  assert.ok(WORLDS.length >= 20, `${WORLDS.length} worlds under references/levels/`);
  for (const w of WORLDS) {
    const kinds = entries(join(REFS, 'levels', w));
    for (const k of kinds) assert.ok(['environment', 'characters', 'places'].includes(k), `references/levels/${w}/${k}: loose in a world (environment/, characters/, places/ only; the old world enemies are in references/archive/world-enemies/)`);
  }
  for (const w of WORLDS) assert.ok(!existsSync(join(REFS, w)), `references/${w}/ is back at the top level`);
});

test('every path into references/ names a folder that is there', () => {
  const bad = [];
  // (not another folder's references/: a skill's own, `…/moebius-ai-characters/references/`)
  const re = /(?<![A-Za-z_-]{2,}\/)(?<!\w)references(?:\/|%2F)((?:[^"'`)\]\n<>,;|]|%20)*)/g;
  for (const f of textFiles()) {
    if (f === 'tests/reference-paths.test.js' || FIXTURE_TREES.has(f)) continue;
    const t = readFileSync(join(ROOT, f), 'utf8');
    if (t.includes('\0')) continue;
    for (const m of t.matchAll(re)) {
      let rest = m[1];
      try { rest = decodeURIComponent(rest); } catch { rest = rest.replace(/%20/g, ' '); }
      rest = rest.replace(/\\\//g, '/').replace(/\\/g, '');
      const miss = missingIn(rest);
      // (a folder's own references/ beside the file: a skill's `references/repo-map.md`)
      const own = existsSync(join(ROOT, dirname(f), 'references', rest.split('/')[0]));
      if (miss && !own && !NEVER_COMMITTED.has(miss)) bad.push(`${f}: ${miss}  (in "references/${m[1].slice(0, 60)}")`);
    }
  }
  assert.deepEqual(bad, [], `stale paths into references/:\n${bad.join('\n')}`);
});

test('no world path written the old way (relative to references/, without levels/)', () => {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forms = WORLDS.flatMap((w) => [w, w.replace(/ /g, '%20')]).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<=^|[\\s"'\`(=\\[,])(${forms.map(esc).join('|')})(?:/|\\\\/)(?=[^/"'\`\\s)\\]>,;:])`, 'gm');
  const bad = [];
  for (const f of textFiles()) {
    if (f === 'tests/reference-paths.test.js' || f.startsWith('references/archive/')) continue;   // (the archive's own files name their folders relative to themselves)
    const t = readFileSync(join(ROOT, f), 'utf8');
    if (t.includes('\0')) continue;
    for (const m of t.matchAll(re)) bad.push(`${f}: "${t.slice(m.index, m.index + 60).split('\n')[0]}"`);
  }
  assert.deepEqual(bad, [], `world paths without levels/:\n${bad.join('\n')}`);
});

test('the archived enemy atlas finds its pictures beside it', () => {
  const dir = join(REFS, 'archive/world-enemies');
  const html = readFileSync(join(dir, 'enemy-atlas.html'), 'utf8');
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => decodeURIComponent(m[1])).filter((s) => !/^(https?:|data:)/.test(s));
  assert.ok(srcs.length >= 100, `${srcs.length} pictures`);
  const missing = srcs.filter((s) => !existsSync(join(dir, s)));
  assert.deepEqual(missing, []);
});

test('the guard itself: an old path is caught, a new one passes', () => {
  if (!WORLDS.includes('The Desert')) return;
  assert.equal(missingIn('levels/The Desert/environment/IMG_3775.JPG'), null);
  assert.equal(missingIn('levels/The Desert/places/<id>/'), null);
  assert.equal(missingIn('enemy-archetypes/crab/sheet-1.jpg'), null);
  assert.equal(missingIn('Core Objects/Fluid Glove'), null);
  assert.equal(missingIn('_candidates/x'), null);
  assert.ok(missingIn('The Desert/environement/IMG_3775.JPG'));
  assert.ok(missingIn('levels/The Desert/environement/IMG_3775.JPG'));
  assert.ok(missingIn('levels/The Dessert/characters'));
  assert.ok(missingIn('levels/The Desert/enemies/lineup-01.jpeg'), 'the old world enemies are archived');
  assert.equal(missingIn('archive/world-enemies/The Desert/lineup-01.jpeg'), null);
  assert.ok(missingIn('archive/world-enemies/The Dessert/lineup-01.jpeg'));
});
