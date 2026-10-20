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
//   node scripts/unity-compare/views.mjs <out.json> [--worlds a,b] [--set main|lantern|changes|traveller]
//
// The `lantern` set: Lorn with six worlds done, its views turned to where the Lantern's light hangs
// (src/story/lantern-sky.js), the flags for both sides in each view's `flags`.
// The `changes` set (issue #556): views of what the v1.87 landings changed, each aimed from the game's own data (CHANGES
// below): the Rose House's water down its steps and a field's channel with the keeper calmed, the lagoons, Marrow's strap,
// the drinking roots toward the red rag's mast, a fragment on a cairn or plinth, the Mooring-House's west door and great
// door, the Glass Dunes' posts to the court. Replace its entries with the next landings' when they want looking at.
// The `traveller` set (issue #493): the traveller close, at the desert's start: standing, at a jog and at a sprint (held at a
// phase of the loop with a thigh swung forward, so the shirt's thigh-lift keys are on: engine/gait-hold.js), from behind as
// the follow camera sees him, and a film's shot (low, a long lens, at dusk); with run.mjs --traveller v2[:outfit].
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { bundle } from '../engine-bundle.mjs';
import { loadBundle } from '../../engine/vm-run.mjs';
import { tempPath } from '../temp-dirs.mjs';
import { ORDER, SIDE, isDiscarded } from '../../src/levels/names.js';
import { lanternSky } from '../../src/story/lantern-sky.js';
import { STORY, SITES } from '../../src/desert-sites.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0] && !args[0].startsWith('--') ? args[0] : join(ROOT, 'output/unity-compare/views.json'));
const SET = arg('set', 'main');
export const NOON = 12, DUSK = 18.6;
/** The worlds the check walks: the route, the detours (not the discarded ones: names.js DISCARDED, all seven now), home, the Lantern and the night train. */
export const WORLDS = [...ORDER, ...SIDE.filter((id) => !isDiscarded(id)), 'home', 'lantern', 'overnighttrain'];
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
async function fromGame(id, flags = {}) {
  const E = await engine();
  const g = await hushed(() => E.createGame({ levelId: id, backend, flags: { 'prologue.done': true, 'item.backpack': true, 'items.v': 2, ...flags } }));
  await hushed(async () => { for (let i = 0; i < 40; i++) g.frame(1 / 30); });
  if (SET === 'changes') return { g };
  if (SET === 'traveller') return { views: travellerViews(g.player.pos, g.player.heading), temples: [] };
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


// ---- the `traveller` set (issue #493): where the game puts him, his front (sin h, cos h) and his side
export function travellerViews(p, h) {
  const f = [Math.sin(h), Math.cos(h)], sd = [f[1], -f[0]];
  const at = (fw, side, up) => r2([p.x + f[0] * fw + sd[0] * side, p.y + up, p.z + f[1] * fw + sd[1] * side]);
  const P = r2([p.x, p.y, p.z]), chest = r2([p.x, p.y + 1.0, p.z]);
  const v = (name, gait, phase, eye, target, note, more = {}) => ({ name, player: P, heading: +h.toFixed(4), eye, target, fov: 40, gait: { gait, phase }, note, ...more });
  return [
    v('trav-stand', 'idle', 0, at(3.0, 1.2, 1.5), chest, 'standing, his front three-quarter'),
    v('trav-jog', 'jog', 0.6, at(0.6, 3.4, 1.2), chest, 'at a jog (held), from his side: both thigh-lift keys on'),
    v('trav-sprint', 'sprint', 0.6, at(2.6, -1.8, 1.3), chest, 'at a sprint (held), his front three-quarter'),
    v('trav-back', 'idle', 0, at(-3.6, 0.4, 1.9), at(4, 0, 1.2), 'from behind, as the follow camera'),
    v('trav-film', 'idle', 0, at(3.6, -1.0, 0.7), r2([p.x, p.y + 1.25, p.z]), 'a film\'s shot: low, a long lens, at dusk', { fov: 28, hour: DUSK }),
  ];
}

// ---- the `changes` set (issue #556): what the v1.87 landings changed, aimed from the game's data in the VM
const VV = (x, y, z) => ({ x, y, z });
/** A view from `eye` at `target` ([x, y, z] each), the traveller put `back` m behind the eye (out of the frame, near enough to stream the place in). */
function look(name, eye, target, note, { fov = 55, back = 3 } = {}) {
  const dx = target[0] - eye[0], dz = target[2] - eye[2], l = Math.hypot(dx, dz) || 1;
  const player = [eye[0] - (dx / l) * back, eye[1] - 1.6, eye[2] - (dz / l) * back];
  return { name, player: r2(player), heading: +Math.atan2(dx, dz).toFixed(4), eye: r2(eye), target: r2(target), fov, note };
}
/** A fragment on its marker: the fragment of this world nearest [x, z], seen from `d` m off, a little above. */
function fragmentView(g, name, [x, z], note, az = 0.6, d = 5) {
  const f = g.fragments.list.reduce((a, b) => (Math.hypot(b.pos.x - x, b.pos.z - z) < Math.hypot(a.pos.x - x, a.pos.z - z) ? b : a));
  const p = f.pos, H = g.level.ground.heightAt(p.x + Math.sin(az) * d, p.z + Math.cos(az) * d);
  return look(name, [p.x + Math.sin(az) * d, Math.max(H + 1.5, p.y + 0.8), p.z + Math.cos(az) * d], [p.x, p.y - 0.5, p.z], note);
}
export const CHANGES = {
  // (#553 the water in its beds and down the Rose House's steps, #564 the bed maps, #561 the mast, #552 the straps)
  desert: {
    flags: { 'temple.desert.done': true, 'desert.well.watched': true },
    views(g) {
      const T = g.level.temple, O = T.outside, S = O.stairs, d = O.door, h = d.heading, f = [Math.sin(h), Math.cos(h)], side = [f[1], -f[0]];
      const base = d.at.y - S.sill, foot = base + S.y1, mid = (S.z0 + S.z1) / 2 - S.door, along = (s, o, y) => [d.at.x + f[0] * s + side[0] * o, y, d.at.z + f[1] * s + side[1] * o];
      const H = (x, z) => g.level.ground.heightAt(x, z);
      // a field's channel by Qanat (src/temples/desert.js change: the first plot's, along its inner edge), from low
      const C = STORY.city, [deg, dist, L, W] = [92, 92, 30, 20], a = (deg * Math.PI) / 180, cx = C.x + Math.sin(a) * dist, cz = C.z + Math.cos(a) * dist;
      const al = [Math.cos(a), -Math.sin(a)], ac = [Math.sin(a), Math.cos(a)], ch = [cx - ac[0] * (W / 2 + 1.2), cz - ac[1] * (W / 2 + 1.2)];
      const fe = [ch[0] - ac[0] * 3 - al[0] * 9, ch[1] - ac[1] * 3 - al[1] * 9], ft = [ch[0] + al[0] * 6, ch[1] + al[1] * 6];
      // the lagoons from their low side (the lowest sand just past their rim)
      const LG = SITES.lagoons, low = [...Array(16).keys()].map((k) => (k / 16) * Math.PI * 2).reduce((b, t) => (H(LG.x + Math.sin(t) * LG.r * 1.08, LG.z + Math.cos(t) * LG.r * 1.08) < H(LG.x + Math.sin(b) * LG.r * 1.08, LG.z + Math.cos(b) * LG.r * 1.08) ? t : b));
      const le = [LG.x + Math.sin(low) * LG.r * 1.12, LG.z + Math.cos(low) * LG.r * 1.12];
      const m = g.npcs.find((n) => n.def?.id === 'marrow');
      const roots = g.story.quests?.resolve?.('roots') ?? g.quests?.resolve?.('roots'), mast = [STORY.rag.x, H(STORY.rag.x, STORY.rag.z) + STORY.rag.h - 2, STORY.rag.z];
      return [
        look('steps-three', along(mid + 6, 16, foot + 9), along(mid, 0, (d.at.y + foot) / 2), 'the Rose House\'s water down its steps, the keeper calmed (#553)'),
        look('steps-low', along(S.z1 - S.door + 12, 2, foot + 1.7), along(S.z0 - S.door, 0, d.at.y), 'from the foot of the Rose House\'s steps (#553)'),
        look('field', [fe[0], H(fe[0], fe[1]) + 1.4, fe[1]], [ft[0], H(ft[0], ft[1]) + 0.1, ft[1]], 'a field\'s channel by Qanat, the keeper calmed (#553)'),
        look('lagoons', [le[0], H(le[0], le[1]) + 3, le[1]], [LG.x, H(LG.x, LG.z) - 1, LG.z], 'the salt lagoons from their low side (#553, #564)'),
        // (he walks a little loop by the camps: aimed at him where he is, on both sides)
        { name: 'marrow', npc: 'marrow', dist: 2.6, fov: 45, eye: r2(m.pos.toArray()), target: r2(m.pos.toArray()), note: 'Marrow: his strap (#552)' },
        look('roots-mast', [roots.x, roots.y + 1.7, roots.z], mast, 'from the drinking roots, the red rag\'s mast through Qanat\'s gate (#561)', { fov: 40 }),
      ];
    },
  },
  // (#550 a fragment on a cairn)
  perdide: { views: (g) => [fragmentView(g, 'frag-cairn', [-428, 60], 'a fragment on its cairn (#550)')] },
  // (#550 a fragment on a plinth; #552 Ferro's strap)
  bazaar: {
    views(g) {
      const out = [fragmentView(g, 'frag-plinth', [-84, -48], 'a fragment on its plinth (#550)')];
      const n = g.npcs.find((x) => x.def?.id === 'ferro');
      if (n) { const h = n.heading, f = [Math.sin(h), Math.cos(h)]; out.push(look('ferro', [n.pos.x + f[0] * 2.6 + f[1] * 0.6, n.pos.y + 1.5, n.pos.z + f[1] * 2.6 - f[0] * 0.6], [n.pos.x, n.pos.y + 1.1, n.pos.z], 'Ferro: her strap (#552)', { fov: 45 })); }
      return out;
    },
  },
  // (#561 the Mooring-House: the west door open on the Chain Locker; the great door's windows to the lamp-eye)
  spacecity: {
    views(g) {
      const T = (g.level.temples ?? []).find((t) => t.id === 'spacecity'), wp = (id) => { const p = T.piece(id); p.group.updateMatrixWorld(true); return p.center ?? p.group.getWorldPosition(p.group.position.clone()); };
      const d1 = wp('d1'), s1 = wp('s1'), gN = wp('gN'), hub = T.kit.world(0, 0, 30), inn = hub.clone().sub(d1).setY(0).normalize();
      return [
        look('mooring-d1', [d1.x + inn.x * 4, d1.y + 1.7, d1.z + inn.z * 4], [s1.x, s1.y, s1.z], 'from the great door: the glazed window, the lamp-eye through it (#561)', { back: 1 }),
        look('mooring-westdoor', [gN.x + 9, gN.y + 2.2, gN.z], [gN.x - 12, gN.y + 0.8, gN.z], 'the upper west landing: the west door open on the Chain Locker (#561)', { back: 1 }),
      ];
    },
  },
  // (#561 the carriers' oil jars and the row of posts to the half-buried court)
  glassdunes: {
    views(g) {
      const H = (x, z) => g.level.ground.heightAt(x, z);
      return [look('court-posts', [150, H(150, -114) + 3.5, -114], [231, H(231, -147) + 1, -147], 'the oil jars and the posts to the half-buried court (#561)')];
    },
  },
};

const worlds = {};
for (const id of WORLDS.filter((w) => !only || only.includes(w))) {
  if (SET === 'lantern' && id !== 'perdide') continue;
  if (SET === 'traveller') {
    if (id !== 'desert') continue;
    const { views } = await fromGame(id);
    worlds[id] = { views: views.map((v) => ({ hour: NOON, weather: 'clear', ...v })) };
    console.log(`${id}: ${views.map((v) => v.name).join(', ')}`);
    continue;
  }
  if (SET === 'changes') {
    if (!CHANGES[id]) continue;
    const { g } = await fromGame(id, CHANGES[id].flags);
    const views = (await hushed(() => CHANGES[id].views(g))).map((v) => ({ ...v, hour: NOON, weather: 'clear', ...(CHANGES[id].flags ? { flags: CHANGES[id].flags } : {}) }));
    worlds[id] = { views };
    console.log(`${id}: ${views.map((v) => v.name).join(', ')}`);
    continue;
  }
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
