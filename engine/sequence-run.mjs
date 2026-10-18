// The sequences (engine/sequences.js) played by the engines' bundle in node: engine/game.js bundled as the engines take
// it, each sequence in a fresh VM (engine/vm-run.mjs: no page, no GPU), its world made with the menus the Unity host
// makes, a fixed step of the game's time, each beat probed. The engines' state stream, against the web's
// (tests/sequences-web.json) in tests/sequences.test.js; scripts/unity-compare/sequences.mjs writes it beside the pictures.
//
//   node engine/sequence-run.mjs [ids…] [--out stream.json]
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadBundle } from './vm-run.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'noticed', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = () => new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
const tick = () => new Promise((r) => setTimeout(r, 5));
export const STEP = 1 / 30;

/** The engines' bundle, built once into a temp file: its path. */
export async function buildBundle() {
  const { bundle } = await import('../scripts/engine-bundle.mjs');
  const { tempPath } = await import('../scripts/temp-dirs.mjs');
  const file = tempPath(join(tmpdir(), `hiraeth-sequences-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  return file;
}

/** The VM's Math.random seed: each sequence plays one run of what the game draws at random. */
export const SEED = 454;

/**
 * One sequence in a fresh VM → { beats: [{ beat, t, late, …probe }], errors }. quiet: the worlds' chatter hushed.
 * level: played in another world than its own. held: a step of no time after every step (a clock held still, as a
 * measuring run's window.__stepDt holds it), and out.nan: { radius: the "Computed radius is NaN" errors, positions: the
 * meshes left with a NaN in their position attribute } (issue #452). seed: the VM's Math.random seed (issue #454).
 */
export async function runSequence(file, id, { quiet = true, log = () => {}, level = null, held = false, seed = SEED } = {}) {
  const c = console, said = { warn: c.warn, info: c.info, log: c.log, error: c.error };
  if (quiet) c.warn = c.info = c.log = c.error = () => {};
  const nan = held ? { radius: 0, positions: [] } : null;
  if (nan) { const e = c.error; c.error = (...a) => { if (/radius is NaN/.test(String(a[0]))) nan.radius++; else e(...a); }; }
  const out = { beats: [], errors: [] };
  let timers = null;
  try {
    // (the VM's timers kept, and cleared once the sequence is over: a world's intervals would keep node running)
    const T = new Set(), track = (f, clear) => (...a) => { const h = f(...a); T.add([h, clear]); return h; };
    timers = T;
    // (Math.random seeded: what a world draws at random, a fight temple's waves and where its foes rise, the same every
    // run, so a foe's wind-up chip in a beat is there every time or never: issue #454)
    const B = loadBundle(file, { pads: () => [] }, { setTimeout: track(setTimeout, clearTimeout), setInterval: track(setInterval, clearInterval) }, { seed }).exports;
    const seq = B.sequenceById(id) ?? B.routeById?.(id);
    if (!seq) throw new Error(`no sequence ${id}`);
    const opts = B.engineSetup(level ? { ...seq.setup, level } : seq.setup);
    let g = null;
    const menus = new B.EngineMenus({ settings: new B.Settings(), house: () => g?.houseView?.() ?? null });
    g = await B.createGame({ ...opts, backend: backend(), menus, saves: false });
    menus.sources = g.menuSources();
    const G = B.engineGame(g, menus);
    // (the world's first second, its loads landing, as the page's before its review starts)
    for (let f = 0; f < 30; f++) { g.frame(STEP); if (f % 3 === 0) await tick(); }
    const staged = B.engineReady(G, seq.setup);
    if (staged?.then) { let done = false; staged.then((ok) => { done = true; if (ok === false) out.errors.push('the cinematic refused to start'); }, (e) => { done = true; out.errors.push(`staging: ${e?.message ?? e}`); }); for (let f = 0; f < 120 && !done; f++) { g.frame(STEP); await tick(); } }
    const run = new B.SequenceRun(G, seq);
    for (let f = 0; f < 30 * 400; f++) {
      const r = run.tick(STEP);
      if (r?.done) break;
      if (r?.keys) for (const [code, down] of r.keys) B.engineKey(g, menus, code, down);
      if (r?.record) { out.beats.push({ beat: r.record.name, t: +run.time.toFixed(2), late: r.late, ...B.probe(G) }); log(`${id} ${r.record.name}`); }
      g.frame(STEP);
      if (held) g.frame(0);
      if (f % 4 === 0) await tick();
    }
    out.errors.push(...run.errors);
    if (nan) {
      g.scene.traverse((o) => { const a = o.geometry?.attributes?.position?.array; if (a && a.some((v) => Number.isNaN(v))) nan.positions.push(o.name || o.parent?.name || o.type); });
      out.nan = nan;
    }
  } catch (e) { out.errors.push(String(e?.stack ?? e).split('\n').slice(0, 3).join(' | ')); }
  finally { Object.assign(c, said); for (const [h, clear] of timers ?? []) clear(h); }
  return out;
}

/** Every sequence (or those of `ids`) → { <id>: { beats, errors } }. */
export async function runAll(ids = null, { file = null, log = () => {} } = {}) {
  file ??= await buildBundle();
  const { SEQUENCES } = await import('./sequences-ids.mjs').catch(() => ({ SEQUENCES: null }));
  const B = loadBundle(file, { pads: () => [] }).exports;
  const all = (SEQUENCES ?? B.SEQUENCES).map((s) => s.id);
  const out = {};
  for (const id of all) {
    if (ids && !ids.includes(id)) continue;
    const t0 = Date.now();
    out[id] = await runSequence(file, id, { log });
    log(`${id}: ${out[id].beats.length} beats in ${((Date.now() - t0) / 1000).toFixed(1)} s${out[id].errors.length ? ` (${out[id].errors.join('; ')})` : ''}`);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), oi = a.indexOf('--out');
  const outFile = oi >= 0 ? resolve(a[oi + 1]) : null;
  const ids = a.filter((x, i) => !x.startsWith('--') && a[i - 1] !== '--out');
  const res = await runAll(ids.length ? ids : null, { log: (m) => process.stdout.write(`${m}\n`) });
  if (outFile) writeFileSync(outFile, JSON.stringify(res, null, 1));
  else console.log(JSON.stringify(res, null, 1).slice(0, 4000));
  void ROOT;
  process.exit(0);
}
