// The visual check's views (docs/plans/unity-default-portables.md section 4, D17): one file for every world, the same on
// both sides (the web in headless Chrome, Unity in the editor's batch). Built from the game's own data:
//   - the bench's views where a world has them (scripts/bench/viewpoints-worlds.json; the desert's viewpoints.json):
//     its boot camera, a crowd, a wide look;
//   - every other world (the detours, the Lantern, the night train): where the game puts you, read from the game itself
//     run in a bare V8 context (engine/game.js, the engines' bundle): the follow camera at the spawn, and a wide look;
//   - each temple's first room (level.temples[i].arrival: the traveller where you come in, the camera behind him, as
//     engine/unity/game.js aimed() places `view.temple`);
//   - each view at noon, the start and the wide one again at dusk; the weather clear.
// Writes { worlds: { <id>: { views } } }, the format BridgeArgs reads with -level, and a flat list for the web's side.
//
//   node scripts/unity-compare/views.mjs <out.json> [--worlds a,b] [--set main|lantern]
//
// The `lantern` set: Lorn with six worlds done, its views turned to where the Lantern's light hangs
// (src/story/lantern-sky.js), the flags for both sides in each view's `flags`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { bundle } from '../engine-bundle.mjs';
import { loadBundle } from '../../engine/vm-run.mjs';
import { tempPath } from '../temp-dirs.mjs';
import { ORDER, SIDE } from '../../src/levels/names.js';
import { lanternSky } from '../../src/story/lantern-sky.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(ROOT, 'output/unity-compare/views.json'));
const SET = arg('set', 'main');
export const NOON = 12, DUSK = 18.6;
/** The worlds the check walks: the route, the detours, home, the Lantern and the night train. */
export const WORLDS = [...ORDER, ...SIDE, 'home', 'lantern', 'overnighttrain'];
const only = arg('worlds')?.split(',');

const bench = JSON.parse(readFileSync(join(ROOT, 'scripts/bench/viewpoints-worlds.json'), 'utf8')).worlds;
const desert = JSON.parse(readFileSync(join(ROOT, 'scripts/bench/viewpoints.json'), 'utf8')).views;
const pick = (list, names) => names.map((n) => list.find((v) => v.name === n)).filter(Boolean);
const clean = (v) => ({ name: v.name, player: v.player, heading: v.heading, eye: v.eye, target: v.target, fov: v.fov ?? 55, note: v.note });

// the game in a bare V8 context, for the worlds the bench has no views of and the temples' first rooms
const UNSET = new Set(['shapeAttrs', 'quietWalk', 'listMatrices', 'stillMatrices', 'skipHidden', 'noticed', 'peopleLod', 'portrait', 'capeOffload', 'clothOffload', 'brush', 'materialFluid', 'materialLive', 'materialVec', 'vertices', 'then', 'photo']);
const backend = new Proxy({}, { get: (t, k) => (UNSET.has(k) ? undefined : () => {}) });
let B = null;
async function engine() {
  if (B) return B;
  const file = tempPath(join(tmpdir(), `hiraeth-compare-views-${process.pid}.js`));
  await bundle('godot', { input: 'engine/game.js', out: [file] });
  return (B = loadBundle(file).exports);
}
const hushed = async (fn) => {
  const w = console.warn, i = console.info, l = console.log, e = console.error; console.warn = console.info = console.log = console.error = () => {};
  try { return await fn(); } finally { console.warn = w; console.info = i; console.log = l; console.error = e; }
};
const r2 = (a) => a.map((x) => +x.toFixed(2));

/** Where the game puts you in a world, and its temples' first rooms, from the game itself. */
async function fromGame(id) {
  const E = await engine();
  const g = await hushed(() => E.createGame({ levelId: id, backend, flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2 } }));
  await hushed(async () => { for (let i = 0; i < 40; i++) g.frame(1 / 30); });
  const p = g.player.pos, c = g.camera.position, d = g.camera.getWorldDirection(c.clone());
  const views = [];
  views.push({ name: 'start', player: r2(p.toArray()), heading: +g.player.heading.toFixed(4), eye: r2(c.toArray()), target: r2(c.clone().addScaledVector(d, 20).toArray()), fov: 55, note: 'the follow camera where the game puts you' });
  // a wide look: up and back from the start, over the traveller toward where the camera looks
  const back = d.clone().setY(0).normalize();
  const eye = p.clone().addScaledVector(back, -18); eye.y += 14;
  views.push({ name: 'wide', player: r2(p.toArray()), heading: +g.player.heading.toFixed(4), eye: r2(eye.toArray()), target: r2(p.clone().addScaledVector(back, 40).toArray()), fov: 55, note: 'up and back from the start' });
  const temples = [];
  for (const [i, T] of (g.level.temples ?? []).entries()) {
    const a = T?.arrival;
    if (!a?.pos) continue;
    const q = a.pos, h = a.heading ?? 0, fx = Math.sin(h), fz = Math.cos(h);
    temples.push({ name: `temple${i}`, player: r2([q.x, q.y, q.z]), heading: +h.toFixed(4), eye: r2([q.x - fx * 5, q.y + 2.6, q.z - fz * 5]), target: r2([q.x + fx * 4, q.y + 1.2, q.z + fz * 4]), fov: 55, note: `the first room of ${T.name ?? T.id ?? `temple ${i}`}` });
  }
  return { views, temples };
}

const worlds = {};
for (const id of WORLDS.filter((w) => !only || only.includes(w))) {
  if (SET === 'lantern' && id !== 'perdide') continue;
  let base;
  const known = id === 'desert' ? pick(desert, ['spawn', 'camps']).map((v, i) => ({ ...v, name: i ? 'crowd' : 'start' })) : bench[id] ? pick(bench[id].views, ['start', 'crowd', 'wide']) : null;
  let temples = [];
  try {
    const g = await fromGame(id);
    temples = g.temples;
    base = known?.length ? known.map(clean) : g.views;
    if (id === 'desert' && !known.find((v) => v.name === 'wide')) base.push(g.views[1]);
  } catch (e) {
    console.log(`${id}: the game failed to start in the VM (${e?.message ?? e}); the bench's views alone`);
    base = (known ?? []).map(clean);
  }
  const views = [];
  if (SET === 'lantern') {
    // (turned to the Lantern's light: six worlds done, it hangs over the side of the sky the sun never crosses)
    const L = lanternSky({ level: id, completed: ORDER.slice(0, 6) });
    // (from the highest of the views, over what stands round the start)
    const el = (L.el * Math.PI) / 180, az = (L.az * Math.PI) / 180, s = base.reduce((a, b) => (b.eye[1] > a.eye[1] ? b : a));
    const t = [s.eye[0] + Math.cos(el) * Math.sin(az) * 100, s.eye[1] + Math.sin(el) * 100, s.eye[2] + Math.cos(el) * Math.cos(az) * 100];
    const flags = Object.fromEntries(ORDER.slice(0, 6).map((w) => [`world.${w}.done`, true]));
    views.push({ ...s, name: 'lantern', target: r2(t), hour: NOON, flags, note: 'six worlds done: the Lantern\'s light in the sky' });
    views.push({ ...s, name: 'lantern-dusk', target: r2(t), hour: DUSK, flags });
  } else {
    for (const v of [...base, ...temples]) {
      views.push({ ...v, hour: NOON, weather: 'clear' });
      if (v.name === 'start' || v.name === 'wide') views.push({ ...v, name: `${v.name}-dusk`, hour: DUSK, weather: 'clear', note: `${v.note ?? v.name} at dusk` });
    }
  }
  if (views.length) worlds[id] = { views };
  console.log(`${id}: ${views.map((v) => v.name).join(', ')}`);
}
mkdirSync(dirname(OUT), { recursive: true });
const flat = Object.entries(worlds).flatMap(([world, { views }]) => views.map((v) => ({ ...v, world, name: `${world}--${v.name}` })));
writeFileSync(OUT, JSON.stringify({ about: 'The visual check\'s views (scripts/unity-compare/views.mjs): every world, three.js coordinates', set: SET, worlds, views: flat }, null, 1));
console.log(`${flat.length} views in ${Object.keys(worlds).length} worlds: ${OUT}`);
process.exit(0);
