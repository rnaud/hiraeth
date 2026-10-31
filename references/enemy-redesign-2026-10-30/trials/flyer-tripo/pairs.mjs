// #800 family B: before / after pictures of a flyer, the same views on two checkouts (the commit before, as an archive
// with this checkout's node_modules linked in, and this one), through scripts/changelog-shots.mjs's own serve, muted
// Chrome and shoot (its `view.foe`: the creatures gallery's body alone, large, 3D only, inked by the post pass; or a world
// view with a `setup` that sets the foe down). Each view's PNG written as <out>/<name>-before.png / -after.png.
//
//   PORT=54xx node pairs.mjs <spec.json> <out-dir> [--before <dir>] [--after <dir>] [--before-only] [--only a,b]
// spec: [{ name, view }] (a view as src/changelog-media.js's: { foe: { id, yaw, pitch, zoom, pose, at } } or { level, … }).
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

if (process.env.PORT === '5173') throw new Error('never 5173');
const argv = process.argv.slice(2), flag = (k) => { const i = argv.indexOf(k); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const ONLYB = argv.includes('--before-only') && (argv.splice(argv.indexOf('--before-only'), 1), true);
const BEFORE = flag('--before'), AFTER = flag('--after') ?? resolve(new URL('../../../..', import.meta.url).pathname), ONLY = flag('--only')?.split(',');
const [SPEC, OUT] = argv;
const { serve, chrome, shoot, DEFAULT_VIEW } = await import(join(AFTER, 'scripts/changelog-shots.mjs'));
const spec = JSON.parse(readFileSync(SPEC, 'utf8')).filter((s) => !ONLY || ONLY.includes(s.name));
mkdirSync(OUT, { recursive: true });
const base = `http://127.0.0.1:${process.env.PORT}/`;
for (const [tag, dir] of [['before', BEFORE], ['after', ONLYB ? null : AFTER]]) {
  if (!dir) continue;
  const server = await serve(dir), c = await chrome();
  try {
    for (const s of spec) {
      const v = { ...DEFAULT_VIEW, ...s.view, ...(s[tag] ?? {}) };
      await shoot(c, base, v, join(OUT, `${s.name}-${tag}.png`));
      console.log(tag, s.name, c.errors.length ? `errors: ${c.errors.slice(-2).join(' | ')}` : 'ok');
    }
  } finally { await c.close(); await server.close(); }
}
