// The worlds' bakes for the Unity builds (issue #385, src/world-bake.js): each world loaded once by the engines' own
// code (engine/game.js, bundled as the engines have it, in a bare V8 context: engine/vm-run.mjs) with its bake
// recorded: the collision's BVH, the buried instances' checks, the crowd's ray tests. Written to
// StreamingAssets/hiraeth-js/public/bake/<world>.bin (not committed), with index.json (the code's key, each file's size).
// The Unity workflows run it before their build; the web never does.
//   node scripts/bake-worlds.mjs [--worlds desert,incal] [--out dir]
import { writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { bundle } from './engine-bundle.mjs';
import { sourceKey } from './source-key.mjs';
import { loadBundle } from '../engine/vm-run.mjs';
import { ORDER, SIDE } from '../src/levels/names.js';
import { DUNE_VISITS } from '../src/desert-sites.js';
import { mergeBakes } from '../src/world-bake.js';
import { tempPath } from './temp-dirs.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BAKE_OUT = 'unity/Hiraeth/Assets/StreamingAssets/hiraeth-js/public/bake';
/** Every world a Unity build can load: the route, the side worlds, home and the Lantern. */
export const BAKED_WORLDS = [...ORDER, ...SIDE, 'home', 'lantern'];

/**
 * The saves' flags that change a world's triangles, each set baked (one file a world, every variant in it): the desert's
 * walking dunes stand differently on each visit (src/desert-dunes.js). Elsewhere a save that changes the world (a temple
 * done, home's tomb) generates what differs.
 */
export const BAKE_VARIANTS = { desert: DUNE_VISITS.map((_, v) => ({ 'desert.dunes.visit': v })) };

// (the backend takes every call and draws nothing, as the engine tests' stand-in)
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });

const quietly = async (fn) => { const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; } };

/** One world's bake (every variant of it, merged), from the bundle `file`: { buf, line }. */
export async function bakeWorld(id, file) {
  const lines = [], bufs = [];
  for (const bakeFlags of BAKE_VARIANTS[id] ?? [null]) {
    const B = loadBundle(file, { pads: () => [] });
    const game = await quietly(() => B.exports.createGame({ levelId: id, backend, bake: 'record', bakeFlags, log: (...a) => lines.push(a.join(' ')) }));
    bufs.push(game.bakeOut());
    game.dispose?.();
  }
  return { buf: bufs.length > 1 ? mergeBakes(bufs.filter(Boolean)) : bufs[0], line: lines.filter((l) => l.startsWith('bake:')).join('; ') };
}

/**
 * Bake each world into `out`: [{ id, bytes, ms, rss, line }]. Each world in a node of its own (`apart`, the default with
 * more than one): the bundle's contexts are not all let go between worlds, and every world in one process grew to 7 GB.
 */
export async function bakeWorlds({ worlds = BAKED_WORLDS, out = BAKE_OUT, file = tempPath(join(tmpdir(), `hiraeth-bake-${process.pid}.cjs`)), log = console.log, apart = worlds.length > 1 } = {}) {
  const dir = resolve(ROOT, out);
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.bin')) rmSync(join(dir, f));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  const key = sourceKey();
  const done = [];
  for (const id of worlds) {
    const t0 = performance.now();
    let r;
    if (apart) {
      const c = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--one', id, '--bundle', file, '--out', dir], { encoding: 'utf8', maxBuffer: 1 << 26 });
      const res = c.stdout.split('\n').find((l) => l.startsWith('{"one"'));
      if (c.status !== 0 || !res) throw new Error(`bake ${id} failed (${c.status}): ${(c.stderr || c.stdout).slice(-2000)}`);
      r = JSON.parse(res);
    } else {
      const { buf, line } = await bakeWorld(id, file);
      if (buf) writeFileSync(join(dir, `${id}.bin`), Buffer.from(buf));
      r = { bytes: buf ? buf.byteLength : 0, line, rss: Math.round(process.resourceUsage().maxRSS / 1024) };
    }
    r = { id, bytes: r.bytes, rss: r.rss, ms: Math.round(performance.now() - t0), line: r.line };
    done.push(r);
    log(`${id}: ${(r.bytes / 1e6).toFixed(2)} MB in ${(r.ms / 1000).toFixed(1)} s, peak ${r.rss} MB (${r.line})`);
  }
  rmSync(file, { force: true });
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ source: key, worlds: Object.fromEntries(done.map((d) => [d.id, d.bytes])) }, null, 1));
  return done;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  if (arg('--one')) {
    // (one world, in a node of its own: bakeWorlds' child)
    const id = arg('--one'), { buf, line } = await bakeWorld(id, arg('--bundle'));
    if (buf) writeFileSync(join(arg('--out'), `${id}.bin`), Buffer.from(buf));
    console.log(JSON.stringify({ one: id, bytes: buf ? buf.byteLength : 0, line, rss: Math.round(process.resourceUsage().maxRSS / 1024) }));
  } else {
    const t0 = performance.now();
    const done = await bakeWorlds({ worlds: arg('--worlds')?.split(',') ?? BAKED_WORLDS, out: arg('--out') ?? BAKE_OUT });
    const total = done.reduce((s, d) => s + d.bytes, 0);
    console.log(`baked ${done.length} worlds, ${(total / 1e6).toFixed(1)} MB, in ${((performance.now() - t0) / 1000).toFixed(0)} s; peak RSS ${Math.max(Math.round(process.resourceUsage().maxRSS / 1024), ...done.map((d) => d.rss ?? 0))} MB`);
  }
}
