// The census's walked points, in node (scripts/surface-census/census.mjs): each world built as the play-through builds
// it (tests/playthrough-agent.js loadWorld), its critical path laid through the route's quests from the landing and
// back (scripts/level-design/path.mjs, the level design audit's), sampled every `step` m, and the places the player
// stops at: the people, every quest stage's place, the doors and the inside of every way in (a temple's halls, a shop).
//
//   node scripts/surface-census/walk.mjs <out.json> [--worlds desert,home] [--step 8]
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = resolve(args[0]);
await import(join(ROOT, 'tests/register-gadgets.js'));
const A = await import(join(ROOT, 'tests/playthrough-agent.js'));
const P = await import(join(ROOT, 'scripts/level-design/path.mjs'));
const L = await import(join(ROOT, 'scripts/level-design/lib.mjs'));
const { partsOf } = await import(join(ROOT, 'src/levels/names.js'));
const { walkPoints } = await import('./lib.mjs');

const WORLDS = (arg('worlds') ?? [...A.ORDER, 'home'].join(',')).split(',').filter(Boolean);
const STEP = +arg('step', 8);
const out = {};
for (const id of WORLDS) {
  const t0 = Date.now();
  globalThis.location = { search: `?level=${id}` };
  let W;
  try { W = A.loadWorld(id); } catch (e) { console.log(`${id}: not built in node (${String(e).slice(0, 120)})`); continue; }
  const { level } = W;
  const ok = (a) => a && a.every(Number.isFinite);
  const places = [];
  const put = (kind, p) => { const a = P.arr(p); if (ok(a)) places.push({ kind, pos: a }); };
  put('landing', level.ship?.pos ?? level.spawn);
  for (const n of W.npcs) if (!n.pooled && n.def?.id) put('person', n.pos);
  const parts = partsOf(id);
  for (const q of W.quests.defs.values()) if (parts.includes(q.world)) for (const s of q.stages) { try { put('goal', W.quests.where(s)); } catch { /* no place */ } }
  for (const pt of level.portals ?? []) { if (pt.at) put('door', pt.at); if (pt.to) put('inside', pt.to); }
  for (const T of level.temples ?? (level.temple ? [level.temple] : [])) for (const pt of T.portals ?? []) if (pt.to) put('temple', pt.to);
  let samples = [];
  try { const { path } = P.criticalPath(W, id); samples = L.samplePath(path, STEP); } catch (e) { console.log(`${id}: no critical path (${String(e).slice(0, 80)})`); }
  // (a world with no route, home: the ground round the landing in rings, where the player walks between its few places)
  if (samples.length < 40 && places[0]) for (const r of [10, 20, 35, 50]) for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, [x, y, z] = places[0].pos; samples.push({ pos: [x + Math.cos(a) * r, y, z + Math.sin(a) * r] }); }
  const dedup = L.dedupe(places.map((p) => ({ ...p, name: p.kind })), 3).map((p) => ({ kind: p.kinds[0], pos: p.pos }));
  out[id] = walkPoints({ samples: samples.filter((s) => ok(s.pos)), places: dedup }).map((p) => ({ ...p, pos: p.pos.map((v) => Math.round(v * 100) / 100) }));
  W.dispose();
  console.log(`${id.padEnd(12)} ${samples.length} path samples, ${dedup.length} places → ${out[id].length} points (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
writeFileSync(OUT, JSON.stringify(out));
process.exit(0);
