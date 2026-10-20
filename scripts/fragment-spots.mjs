// Where the fragments of the singing light could hide (docs/systems/fragments.md): for each route world, floods the
// ground you can walk and jump over from the world's spawn (the walker's own steps: tests/fragments-reach.js), scores
// every spot it reached for being out of the way (a ledge with a drop under it, a nook with walls round it, a high
// place, far from the people, the chests and the relics, and far from the route: the level design audit's critical
// path, scripts/level-design/path.mjs) and for lying in the world's new country (the explorations' pieces, found by
// their sights' names: tests/fragments-reach.js NEW_COUNTRY) and in or on its places of interest (issue #250: inside a
// ribcage, on a temple's top, by a sight), and picks FRAGMENTS_PER_WORLD of the best, well apart, at least `--new` of
// them in the new country and `--poi` in places of interest, one a place. Prints them as src/fragments-data.js's lines, with each one's distance from the route; the picks are
// checked and hand-tuned there, so this is a starting point, not the source.
//
//   node scripts/fragment-spots.mjs [world …] [--keep 0,2,5] [--new 3] [--route 30]
//     --keep   keep these of the world's spots as they are (their indices: a save's found flags keep pointing at them)
//              and pick only the others, in their slots
//     --new    how many of the picks at least lie in the new country (default 3 where NEW_COUNTRY names some)
//     --route  the nearest a pick may lie to the route's line, in metres (default 30; the test's floor is 25)
//     --above  the lowest a pick may lie (Lorn's water is at 0: --above 0.3 keeps them out of the shallows)
//     --list n the n best spots of the new country instead (a few metres apart), to pick from by hand
//     --poi n  how many of the picks at least lie in or on a place of interest (default 4; issue #250: by a sight, up a
//              beacon, inside a named thing or a big piece, on a summit: tests/fragments-reach.js pointsOfInterest)
//     --by-poi with --list n: the best three spots of each of n places of interest instead
//     --count n how many a world (default FRAGMENTS_PER_WORLD); with --keep all the world's spots stay in their slots and
//              the rest are added after them (issue #317: 8 → 24 a world)
//     --apart m the least distance between two picks (default 25; the contact test's floor is 15)
//     --per-poi n how many picks one place of interest may hold (default 1)
//     --avoid x0,x1[,z0,z1] no pick in that box (the Signal Market's galleries, x -32.5 to -26.5: tests/market-explorations)
//     --busy m the nearest a pick may lie to the spawn's people, chests, relics and goal (default 14)
//     --anchors every pick on a named place of interest (issue #550: "fragment of lights should be in a place that makes
//              sense, like the top of a building, or the center of a point of interest"; never a bare summit): the
//              world's slots already on one stay (unless listed in --move), the others are picked afresh in their
//              slots, up to --per-poi (default 3 here) a place, --apart (default 18 here) apart; each printed with its
//              place, as src/fragments-data.js FRAGMENT_PLACES names it
//     --move 1,4 with --anchors: these slots are picked afresh too, on a place or not
//     --crowd n no pick with more than n others within 40 m (tests/fragments.test.js: 4, 6 in the compact worlds)
//     --things n the n named things of the scene (its objects' names, their boxes) that hold the most spots reached:
//              the candidates for tests/fragments-reach.js POI_THINGS
//
// Pure node, no browser; builds each world as the tests do (tests/built-worlds.js) and as the play-through does for
// the route (tests/playthrough-agent.js loadWorld).
import * as THREE from 'three';
import { builtWorld } from '../tests/built-worlds.js';
import { flood, reachCell, spotOk, standWhyNot, seaWhyNot, newCountry, pointsOfInterest, poiAt, central } from '../tests/fragments-reach.js';
import { Player } from '../src/player.js';
import { ORDER, partsOf, shiftAt } from '../src/levels/names.js';
import { CONTENT } from '../src/levels/content.js';
import { drawnSurfaces } from '../src/contact-audit.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { FRAGMENTS, FRAGMENTS_PER_WORLD } from '../src/fragments-data.js';
import { criticalPath, pathSegments, distanceToPath, arr } from './level-design/path.mjs';
import { alongLanes } from '../src/market-lanes.js';
import { OLD } from '../src/market-old.js';
import { AIR } from '../src/market-air.js';

// What a world's own tests keep the fragments off (issue #550: the picks checked against them before they are written
// down): the Signal Market's screen lanes, old market and galleries (tests/market-explorations.test.js), the Floating
// city's ways down to the anchor and up the stack (tests/spacecity-ways.test.js). → a reason, or null.
const WORLD_RULES = {
  bazaar: () => (x, y, z) => (alongLanes(x, z).off <= 9 ? 'the screen lanes' : Math.abs(x) < OLD.x + 3 && z > OLD.z0 - 3 && z < OLD.z1 + 3 && y < 1.5 ? 'the old market'
    : x > AIR.x0 - 2 && x < AIR.x1 + 2 ? 'the galleries' : null),
  spacecity: (level) => { const lines = (level.lines ?? []).filter((l) => l.name === 'down to the anchor' || l.name === 'up the stack');
    return (x, y, z) => (lines.some((l) => l.points.some((p) => Math.hypot(p[0] - x, p[2] - z) <= 5 && Math.abs(p[1] - y) <= 5)) ? 'a way' : null); },
};

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const keepArg = opt('keep'), newArg = opt('new'), routeArg = opt('route'), aboveArg = opt('above'), listArg = opt('list'), poiArg = opt('poi');
// (issue #317: more a world; the spacing and how many in one place of interest)
const countArg = opt('count'), apartArg = opt('apart'), perPoiArg = opt('per-poi'), busyArg = opt('busy');
// (issue #550: every pick on a named place; and the scene's named things that could be places)
const ANCHORS = args.includes('--anchors'); if (ANCHORS) args.splice(args.indexOf('--anchors'), 1);
const moveArg = opt('move'), thingsArg = opt('things');
// (--crowd n: no pick with more than n others within 40 m of it, nor one it would give more: tests/fragments.test.js's spread)
const crowdArg = opt('crowd'), CROWD = crowdArg ? +crowdArg : Infinity;
const BUSY = busyArg ? +busyArg : 14;
// (--avoid x0,x1,z0,z1: no pick in that box, a way a world's own test keeps clear: the Signal Market's galleries)
const avoidArg = opt('avoid'), AVOID = avoidArg ? avoidArg.split(',').map(Number) : null;
const COUNT = countArg ? +countArg : FRAGMENTS_PER_WORLD, APART = apartArg ? +apartArg : ANCHORS ? 18 : 25, PER_POI = perPoiArg ? +perPoiArg : ANCHORS ? 3 : 1;
// (WHY_POI=1: each place of interest, how many of the spots reached in it each rule turned down: to see why a world has few)
const WHY_POI = !!process.env.WHY_POI;
const BY_POI = args.includes('--by-poi'); if (BY_POI) args.splice(args.indexOf('--by-poi'), 1);
const ROUTE_MIN = routeArg ? +routeArg : 30;
const worlds = args.length ? args : ORDER;
// (the worlds built as the contact test and the places-of-interest test build them, before the gadgets are registered:
// the play-through's gadgets add to a world's build, and a spot good there was not always good in the tests', #317)
for (const id of worlds) builtWorld(id);
await import('../tests/register-gadgets.js');
const { loadWorld } = await import('../tests/playthrough-agent.js');
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
  // the points of interest (issue #250): in a sight, on a beacon, inside a named thing's bounds, on a summit
  const pois = pointsOfInterest({ scene: builtWorld(id).scene, level }, id);
  const wantPoi = poiArg != null ? +poiArg : 4;
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
  const scored = [], whyPoi = new Map(), valid = [];
  const rule = WORLD_RULES[id]?.(W.level) ?? null;
  for (let i = 0; i < reached.length; i += reachCell(id) === 1 ? 4 : 2) {
    const [x, y, z, depth, inside] = reached[i];
    const why = WHY_POI ? pois.find((p) => p.test(x, y, z))?.name : null;
    const no = (r) => { if (why) { const m = whyPoi.get(why) ?? {}; m[r] = (m[r] ?? 0) + 1; whyPoi.set(why, m); } };
    if (inside) { no('inside'); continue; }   // (the rooms through doorways: shops, houses, the temples)
    if (aboveArg != null && y < +aboveArg) { no('low'); continue; }
    if (AVOID && x > AVOID[0] && x < AVOID[1] && z > (AVOID[2] ?? -Infinity) && z < (AVOID[3] ?? Infinity)) { no('avoid'); continue; }
    if (rule?.(x, y, z)) { no('rule'); continue; }
    const away = nearBusy(x, z);
    if (away < BUSY || Math.hypot(x - spawn.x, z - spawn.z) < 40 || level.unsafe?.(V(x, y, z))) { no(away < BUSY ? 'busy' : 'spawn/harm'); continue; }
    const off = route(x, y, z);
    if (off < ROUTE_MIN) { no('route'); continue; }   // (never on the way anyone sends you)
    if (!spotOk({ physics, level }, V(x, y, z)) || !drawnAt(x, y, z)) { no('spot'); continue; }
    // (a city under the sea: under a hall's glass, or out on the seabed near air, where the helmet takes you)
    if (seaWhyNot({ physics, level }, V(x, y, z))) { no('sea'); continue; }
    no('ok');
    valid.push([x, y, z, off]);
    // a ledge: how far the ground falls off 4 m round it; a nook: walls within 3 m at chest height
    let drop = 0, nook = 0;
    for (const [dx, dz] of DIRS) {
      const g = physics.groundAt(x + dx * 4, y + 1, z + dz * 4, 60);
      drop = Math.max(drop, Number.isFinite(g) ? y - g : 60);
      if (physics.rayDistance(V(x, y + 1, z), V(dx, 0, dz), 3) < 3) nook++;
    }
    const high = Math.max(0, y - mid);
    const poi = poiAt(pois, physics, x, y, z);
    // (walled in all round: inside something; or out on open ground. Not in a place of interest: inside a ribcage is
    // the point)
    if (nook >= (poi ? 8 : 7) || (!poi && drop < 2.5 && nook < 3 && high < 8)) continue;
    const fresh = isNew(x, y, z);
    // (and the new country's high pieces, a deck or a tier tens of metres up, count their height in full)
    const score = Math.min(drop, 14) + 1.6 * Math.min(nook, 6) + 0.25 * Math.min(high, fresh ? 80 : 40) + Math.min(depth * 2, 400) / 80 + Math.min(away, 80) / 20
      + Math.min(off, 120) / 15 + (fresh ? 6 : 0) + (poi ? (poi.kind === 'summit' ? 7 : 10) : 0);
    scored.push({ x, y, z, score, drop, nook, high, off, fresh, poi: poi?.name ?? null });
  }
  scored.sort((a, b) => b.score - a.score);
  if (thingsArg) {
    // (the scene's named things, their boxes 3 to 250 m across, and the spots reached on or in each: the smallest holds it)
    const { scene } = builtWorld(id);
    scene.updateMatrixWorld(true);
    const things = [], named = new Set(pois.map((p) => p.name));
    scene.traverse((o) => {
      if (!o.name || o === scene || /^fragment\./.test(o.name)) return;
      const b = new THREE.Box3().setFromObject(o);
      if (b.isEmpty()) return;
      const diag = b.getSize(V(0, 0, 0)).length();
      if (diag >= 3 && diag <= 250) things.push({ name: o.name, b, diag, spots: [] });
    });
    const p = V(0, 0, 0);
    for (const [x, y, z, off] of valid) {
      let best = null;
      p.set(x, y + 0.5, z);
      for (const t of things) if ((!best || t.diag < best.diag) && t.b.containsPoint(p)) best = t;
      best?.spots.push([x, y, z, off]);
    }
    const top = things.filter((t) => t.spots.length).sort((a, b) => b.spots.length - a.spots.length).slice(0, +thingsArg);
    console.log(`  ${id}: ${top.length} named things holding spots reached (of ${things.length})`);
    for (const t of top) {
      const hi = t.spots.reduce((a, s) => (s[1] > a[1] ? s : a));
      const sz = t.b.getSize(V(0, 0, 0));
      console.log(`    ${JSON.stringify(t.name)}${named.has(t.name) ? ' (a place already)' : ''}: ${t.spots.length} spots; box ${sz.x.toFixed(0)}×${sz.y.toFixed(0)}×${sz.z.toFixed(0)} at [${t.b.getCenter(V(0, 0, 0)).toArray().map((v) => v.toFixed(0))}]; highest [${hi.slice(0, 3).map((v) => v.toFixed(1))}] route ${hi[3].toFixed(0)} m`);
    }
    continue;
  }
  if (WHY_POI) { for (const p of pois) if (!whyPoi.has(p.name)) whyPoi.set(p.name, { unreached: 1 }); for (const [n, m] of whyPoi) console.log(`    ${n}: ${Object.entries(m).map(([k, v]) => `${k} ${v}`).join(', ')}`); continue; }
  if (listArg && BY_POI) {
    // (the best spot in each place of interest, the places by their best: to pick from by hand)
    const best = new Map();
    for (const s of scored) if (s.poi && !standWhyNot({ physics, level }, V(s.x, s.y, s.z), Player) && (!best.has(s.poi) || best.get(s.poi).length < 3) && (best.get(s.poi) ?? []).every((p) => Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) > 6)) best.set(s.poi, [...(best.get(s.poi) ?? []), s]);
    console.log(`  ${id}: the best in ${best.size} places of interest (of ${pois.length})`);
    for (const [name, l] of [...best].slice(0, +listArg)) for (const p of l) console.log(`    [${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}],   // ${name}: score ${p.score.toFixed(1)}, route ${p.off.toFixed(0)} m, drop ${p.drop.toFixed(1)}, nook ${p.nook}, high ${p.high.toFixed(1)}`);
    continue;
  }
  if (listArg) {
    const shown = [];
    for (const s of scored) if ((s.fresh || process.env.LIST_ALL) && shown.length < +listArg && shown.every((p) => Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) > 8)) shown.push(s);
    console.log(`  ${id}: the new country's best ${shown.length}`);
    for (const p of shown) console.log(`    [${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}],   // score ${p.score.toFixed(1)}: route ${p.off.toFixed(0)} m, drop ${p.drop.toFixed(1)}, nook ${p.nook}, high ${p.high.toFixed(1)}`);
    continue;
  }
  scored.length = Math.min(scored.length, 20000);
  // (the spots kept: their slots stay theirs)
  const keep = new Set(keepArg === 'all' ? FRAGMENTS[id].map((_, i) => i) : (keepArg ?? '').split(',').filter((s) => s !== '').map(Number));
  // (--anchors: the slots on a named place already stay where they are, but those listed in --move)
  const moveSet = new Set((moveArg ?? '').split(',').filter((s) => s !== '').map(Number));
  const named = (x, y, z) => { const p = poiAt(pois, physics, x, y, z); return p && p.kind !== 'summit' ? p : null; };
  if (ANCHORS) FRAGMENTS[id].forEach(([x, y, z], i) => { if (!moveSet.has(i) && named(x, y, z)) keep.add(i); });
  // (and on it or in its middle first: a sight's mark, a thing's roof or its middle, not the ground at its edge; issue #550's
  // "the top of a building, or the center of a point of interest")
  if (ANCHORS) {
    for (const s of scored) {
      const p = pois.filter((q) => q.test(s.x, s.y, s.z)).find((q) => central(q, s.x, s.y, s.z)) ?? named(s.x, s.y, s.z);
      s.poi = p?.name ?? null;
      s.central = !!p && central(p, s.x, s.y, s.z);
      if (s.central) s.score += 14;
    }
    scored.sort((a, b) => b.score - a.score);
  }
  const kept = [...keep].map((i) => { const [x, y, z] = FRAGMENTS[id][i]; return { i, x, y, z, off: route(x, y, z), fresh: isNew(x, y, z), poi: poiAt(pois, physics, x, y, z)?.name ?? null, kept: true }; });
  // (the best, spread over the world: each next pick the best score plus a bonus for being far from those already picked;
  // until `wantNew` are in the new country, only new country)
  const picks = [...kept];
  let wantNewLeft = wantNew, wantPoiLeft = wantPoi;
  while (picks.length < COUNT) {
    const needNew = picks.filter((p) => p.fresh).length < wantNewLeft;
    const needPoi = ANCHORS || (!needNew && picks.filter((p) => p.poi).length < wantPoiLeft);
    let best = null, bv = -Infinity;
    for (const s of scored) {
      if (needNew && !s.fresh) continue;
      if (needPoi && !s.poi) continue;
      // (one a place of interest: two in the same ribcage is one find)
      if (s.poi && s.poi !== 'a summit' && picks.filter((p) => p.poi === s.poi).length >= PER_POI) continue;   // (each summit its own)
      const d = picks.length ? Math.min(...picks.map((p) => Math.hypot(p.x - s.x, p.z - s.z, p.y - s.y))) : 300;
      if (d < APART) continue;
      if (CROWD < Infinity) {
        const near = picks.filter((p) => Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) < 40);
        if (near.length > CROWD || near.some((p) => picks.filter((q) => q !== p && Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < 40).length >= CROWD)) continue;
      }
      const v = s.score + Math.min(d, 300) / 12;
      if (v > bv) { bv = v; best = s; }
    }
    if (!best && needNew) { wantNewLeft = picks.filter((p) => p.fresh).length; console.log(`  (${id}: only ${wantNewLeft} in the new country)`); continue; }
    if (!best && ANCHORS) { console.log(`  (${id}: no more spots on a named place: ${picks.length} of ${COUNT})`); break; }
    if (!best && needPoi) { wantPoiLeft = picks.filter((p) => p.poi).length; console.log(`  (${id}: only ${wantPoiLeft} in places of interest)`); continue; }
    if (!best) break;
    // (and the traveller can stand on it: else it is dropped and the next best taken)
    const k = scored.indexOf(best);
    scored.splice(k, 1);
    // (as written down, to a decimetre and a centimetre up: a knife-edge spot good to the millimetre and not a few
    // centimetres off is no spot, #317)
    const r = { ...best, x: +best.x.toFixed(1), y: +best.y.toFixed(2), z: +best.z.toFixed(1) };
    if (!spotOk({ physics, level }, V(r.x, r.y, r.z)) || !drawnAt(r.x, r.y, r.z)) continue;
    if (standWhyNot({ physics, level }, V(r.x, r.y, r.z), Player)) continue;
    picks.push(r);
  }
  // (the new picks into the slots not kept, in order)
  const free = [...Array(COUNT).keys()].filter((i) => !keep.has(i));
  picks.filter((p) => !p.kept).forEach((p, k) => { p.i = free[k]; });
  picks.sort((a, b) => a.i - b.i);
  // (how they spread: the ground reached, and each one's nearest other, issue #317)
  const cellA = reachCell(id) ** 2, nn = picks.map((p) => Math.min(...picks.filter((q) => q !== p).map((q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)))).sort((a, b) => a - b);
  console.log(`  (${id}: ${(reached.length * cellA / 1e6).toFixed(2)} km² of ground reached; ${picks.filter((p) => p.poi).length} of ${picks.length} in a place of interest; nearest other: min ${nn[0]?.toFixed(0)}, median ${nn[nn.length >> 1]?.toFixed(0)}, max ${nn.at(-1)?.toFixed(0)} m)`);
  console.log(`  ${id}: [   // (${reached.length} spots reached, ${scored.length} out of the way, ${sights.length} new-country sights)`);
  if (ANCHORS) console.log(`  (${id}: ${picks.filter((p) => !p.kept && p.central).length} of the ${picks.filter((p) => !p.kept).length} picked on their place or in its middle)`);
  for (const p of picks) console.log(`    [${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}],   // ${p.i}${p.kept ? ' kept' : ''}: route ${p.off.toFixed(0)} m${p.fresh ? ', new country' : ''}${p.poi ? `, ${p.poi}` : ''}${p.kept ? '' : `, drop ${p.drop.toFixed(1)}, nook ${p.nook}, high ${p.high.toFixed(1)}`}`);
  console.log('  ],');
}
