// Where the fragments of the singing light could hide (docs/systems/fragments.md): for each route world, floods the
// ground you can walk and jump over from the world's spawn (the walker's own steps: tests/fragments-reach.js), scores
// every spot it reached for being out of the way (a ledge with a drop under it, a nook with walls round it, a high
// place, far from the people, the chests and the relics, and far from the route: the level design audit's critical
// path, scripts/level-design/path.mjs) and for lying in the world's new country (the explorations' pieces, found by
// their sights' names: tests/fragments-reach.js NEW_COUNTRY), and picks FRAGMENTS_PER_WORLD of the best, well apart, at least `--new` of them in
// the new country. Prints them as src/fragments-data.js's lines, with each one's distance from the route; the picks are
// checked and hand-tuned there, so this is a starting point, not the source.
//
//   node scripts/fragment-spots.mjs [world …] [--keep 0,2,5] [--new 3] [--route 30]
//     --keep   keep these of the world's spots as they are (their indices: a save's found flags keep pointing at them)
//              and pick only the others, in their slots
//     --new    how many of the picks at least lie in the new country (default 3 where NEW_COUNTRY names some)
//     --route  the nearest a pick may lie to the route's line, in metres (default 30; the test's floor is 25)
//     --above  the lowest a pick may lie (Lorn's water is at 0: --above 0.3 keeps them out of the shallows)
//     --list n the n best spots of the new country instead (a few metres apart), to pick from by hand
//
// Pure node, no browser; builds each world as the tests do (tests/built-worlds.js) and as the play-through does for
// the route (tests/playthrough-agent.js loadWorld).
import * as THREE from 'three';
import { builtWorld } from '../tests/built-worlds.js';
import { flood, reachCell, spotOk, standWhyNot, seaWhyNot, newCountry } from '../tests/fragments-reach.js';
import { Player } from '../src/player.js';
import { ORDER, partsOf, shiftAt } from '../src/levels/names.js';
import { CONTENT } from '../src/levels/content.js';
import { drawnSurfaces } from '../src/contact-audit.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { FRAGMENTS, FRAGMENTS_PER_WORLD } from '../src/fragments-data.js';
import { criticalPath, pathSegments, distanceToPath, arr } from './level-design/path.mjs';

await import('../tests/register-gadgets.js');
const { loadWorld } = await import('../tests/playthrough-agent.js');

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const keepArg = opt('keep'), newArg = opt('new'), routeArg = opt('route'), aboveArg = opt('above'), listArg = opt('list');
const ROUTE_MIN = routeArg ? +routeArg : 30;
const worlds = args.length ? args : ORDER;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const DIRS = Array.from({ length: 8 }, (_, k) => [Math.cos((k / 8) * Math.PI * 2), Math.sin((k / 8) * Math.PI * 2)]);


for (const id of worlds) {
  const { physics, level } = builtWorld(id);
  const spawn = level.spawn;
  // the route: the level design audit's critical path, its straight legs in 3D
  globalThis.location = { search: `?level=${id}` };
  const W = loadWorld(id);
  const segs = pathSegments(criticalPath(W, id).path);
  const route = (x, y, z) => distanceToPath([x, y, z], segs);
  // the new country: near the explorations' sights
  const { sights, isNew } = newCountry(W.level, id);
  const wantNew = newArg != null ? +newArg : sights.length ? 3 : 0;
  // what is on the way: the spawn, the people, the chests, the relics, the story's goal
  const busy = [[spawn.x, spawn.z]];
  for (const n of CONTENT[id]?.npcs ?? []) if (n.at) busy.push(n.at);
  for (const s of CONTENT[id]?.relics?.spots ?? []) busy.push(Array.isArray(s) ? s : [s.at[0], s.at[2]]);
  if (CONTENT[id]?.story?.goal) busy.push([CONTENT[id].story.goal[0], CONTENT[id].story.goal[2]]);
  for (const part of partsOf(id)) for (const p of PLACEMENTS[part] ?? []) if (Array.isArray(p.at)) { const a = shiftAt(part, p.at); busy.push([a[0], a.length === 3 ? a[2] : a[1]]); }
  const nearBusy = (x, z) => Math.min(...busy.map(([bx, bz]) => Math.hypot(bx - x, bz - z)));

  const drawn = drawnSurfaces(builtWorld(id).scene, { exclude: [physics.base?.mesh] });
  // (stood on as drawn: the drawn surface or the terrain under it, as tests/contact-audit.test.js checks)
  const drawnAt = (x, y, z) => { const h = drawn?.bvh?.raycastFirst(new THREE.Ray(V(x, y + 1.2, z), V(0, -1, 0)), THREE.DoubleSide); return Math.abs(Math.max(h ? y + 1.2 - h.distance : -Infinity, level.ground?.heightAt?.(x, z) ?? -Infinity) - y) < 0.25; };
  level.openWays?.(physics, true);   // (what the player opens on the way: the floating city's drifted span reeled home)
  const reached = flood({ physics, level }, [spawn, ...Object.values(level.partSpawns ?? {})], { radius: 700, max: 1500000, cell: reachCell(id) });
  const ys = reached.map((n) => n[1]).sort((a, b) => a - b), mid = ys[ys.length >> 1];
  const scored = [];
  for (let i = 0; i < reached.length; i += reachCell(id) === 1 ? 4 : 2) {
    const [x, y, z, depth, inside] = reached[i];
    if (inside) continue;   // (the rooms through doorways: shops, houses, the temples)
    if (aboveArg != null && y < +aboveArg) continue;
    const away = nearBusy(x, z);
    if (away < 14 || Math.hypot(x - spawn.x, z - spawn.z) < 40 || level.unsafe?.(V(x, y, z))) continue;
    const off = route(x, y, z);
    if (off < ROUTE_MIN) continue;   // (never on the way anyone sends you)
    if (!spotOk({ physics, level }, V(x, y, z)) || !drawnAt(x, y, z)) continue;
    // (a city under the sea: under a hall's glass, or out on the seabed near air, where the helmet takes you)
    if (seaWhyNot({ physics, level }, V(x, y, z))) continue;
    // a ledge: how far the ground falls off 4 m round it; a nook: walls within 3 m at chest height
    let drop = 0, nook = 0;
    for (const [dx, dz] of DIRS) {
      const g = physics.groundAt(x + dx * 4, y + 1, z + dz * 4, 60);
      drop = Math.max(drop, Number.isFinite(g) ? y - g : 60);
      if (physics.rayDistance(V(x, y + 1, z), V(dx, 0, dz), 3) < 3) nook++;
    }
    const high = Math.max(0, y - mid);
    if (nook >= 7 || (drop < 2.5 && nook < 3 && high < 8)) continue;   // (walled in all round: inside something)
    const fresh = isNew(x, y, z);
    // (and the new country's high pieces, a deck or a tier tens of metres up, count their height in full)
    const score = Math.min(drop, 14) + 1.6 * Math.min(nook, 6) + 0.25 * Math.min(high, fresh ? 80 : 40) + Math.min(depth * 2, 400) / 80 + Math.min(away, 80) / 20
      + Math.min(off, 120) / 15 + (fresh ? 6 : 0);
    scored.push({ x, y, z, score, drop, nook, high, off, fresh });
  }
  scored.sort((a, b) => b.score - a.score);
  if (listArg) {
    const shown = [];
    for (const s of scored) if ((s.fresh || process.env.LIST_ALL) && shown.length < +listArg && shown.every((p) => Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) > 8)) shown.push(s);
    console.log(`  ${id}: the new country's best ${shown.length}`);
    for (const p of shown) console.log(`    [${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}],   // score ${p.score.toFixed(1)}: route ${p.off.toFixed(0)} m, drop ${p.drop.toFixed(1)}, nook ${p.nook}, high ${p.high.toFixed(1)}`);
    continue;
  }
  scored.length = Math.min(scored.length, 20000);
  // (the spots kept: their slots stay theirs)
  const keep = new Set((keepArg ?? '').split(',').filter((s) => s !== '').map(Number));
  const kept = [...keep].map((i) => { const [x, y, z] = FRAGMENTS[id][i]; return { i, x, y, z, off: route(x, y, z), fresh: isNew(x, y, z), kept: true }; });
  // (the best, spread over the world: each next pick the best score plus a bonus for being far from those already picked;
  // until `wantNew` are in the new country, only new country)
  const picks = [...kept];
  let wantNewLeft = wantNew;
  while (picks.length < FRAGMENTS_PER_WORLD) {
    const needNew = picks.filter((p) => p.fresh).length < wantNewLeft;
    let best = null, bv = -Infinity;
    for (const s of scored) {
      if (needNew && !s.fresh) continue;
      const d = picks.length ? Math.min(...picks.map((p) => Math.hypot(p.x - s.x, p.z - s.z, p.y - s.y))) : 300;
      if (d < 25) continue;
      const v = s.score + Math.min(d, 300) / 12;
      if (v > bv) { bv = v; best = s; }
    }
    if (!best && needNew) { wantNewLeft = picks.filter((p) => p.fresh).length; console.log(`  (${id}: only ${wantNewLeft} in the new country)`); continue; }
    if (!best) break;
    // (and the traveller can stand on it: else it is dropped and the next best taken)
    const k = scored.indexOf(best);
    scored.splice(k, 1);
    if (standWhyNot({ physics, level }, V(best.x, best.y, best.z), Player)) continue;
    picks.push(best);
  }
  // (the new picks into the slots not kept, in order)
  const free = [...Array(FRAGMENTS_PER_WORLD).keys()].filter((i) => !keep.has(i));
  picks.filter((p) => !p.kept).forEach((p, k) => { p.i = free[k]; });
  picks.sort((a, b) => a.i - b.i);
  console.log(`  ${id}: [   // (${reached.length} spots reached, ${scored.length} out of the way, ${sights.length} new-country sights)`);
  for (const p of picks) console.log(`    [${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}],   // ${p.i}${p.kept ? ' kept' : ''}: route ${p.off.toFixed(0)} m${p.fresh ? ', new country' : ''}${p.kept ? '' : `, drop ${p.drop.toFixed(1)}, nook ${p.nook}, high ${p.high.toFixed(1)}`}`);
  console.log('  ],');
}
