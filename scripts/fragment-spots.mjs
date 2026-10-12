// Where the fragments of the singing light could hide (docs/systems/fragments.md): for each route world, floods the
// ground you can walk and jump over from the world's spawn (the walker's own steps: tests/fragments-reach.js), scores
// every spot it reached for being out of the way (a ledge with a drop under it, a nook with walls round it, a high
// place, far from the people, the chests and the relics) and picks FRAGMENTS_PER_WORLD of the best, well apart.
// Prints them as src/fragments-data.js's lines; the picks are checked and hand-tuned there, so this is a starting
// point, not the source.
//
//   node scripts/fragment-spots.mjs [world …]        (every route world when none is named)
//
// Pure node, no browser; builds each world as the tests do (tests/built-worlds.js).
import * as THREE from 'three';
import { builtWorld } from '../tests/built-worlds.js';
import { flood, spotOk, standWhyNot } from '../tests/fragments-reach.js';
import { Player } from '../src/player.js';
import { ORDER, partsOf, shiftAt } from '../src/levels/names.js';
import { CONTENT } from '../src/levels/content.js';
import { drawnSurfaces } from '../src/contact-audit.js';
import { PLACEMENTS } from '../src/boxes/placements.js';
import { FRAGMENTS_PER_WORLD } from '../src/fragments-data.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const worlds = process.argv.slice(2).length ? process.argv.slice(2) : ORDER;
const DIRS = Array.from({ length: 8 }, (_, k) => [Math.cos((k / 8) * Math.PI * 2), Math.sin((k / 8) * Math.PI * 2)]);

for (const id of worlds) {
  const { physics, level } = builtWorld(id);
  const spawn = level.spawn;
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
  const reached = flood({ physics, level }, [spawn, ...Object.values(level.partSpawns ?? {})], { radius: 700, max: 1500000 });
  const ys = reached.map((n) => n[1]).sort((a, b) => a - b), mid = ys[ys.length >> 1];
  const scored = [];
  for (let i = 0; i < reached.length; i += 2) {
    const [x, y, z, depth, inside] = reached[i];
    if (inside) continue;   // (the rooms through doorways: shops, houses, the temples)
    const away = nearBusy(x, z);
    if (away < 14 || Math.hypot(x - spawn.x, z - spawn.z) < 40 || level.unsafe?.(V(x, y, z))) continue;
    if (!spotOk({ physics, level }, V(x, y, z)) || !drawnAt(x, y, z)) continue;
    // (a city under the sea: every place he walks is under glass, so a spot with open water over it is outside)
    if (level.sea && physics.rayDistance(V(x, y + 0.3, z), V(0, 1, 0), 400) === Infinity) continue;
    // a ledge: how far the ground falls off 4 m round it; a nook: walls within 3 m at chest height
    let drop = 0, nook = 0;
    for (const [dx, dz] of DIRS) {
      const g = physics.groundAt(x + dx * 4, y + 1, z + dz * 4, 60);
      drop = Math.max(drop, Number.isFinite(g) ? y - g : 60);
      if (physics.rayDistance(V(x, y + 1, z), V(dx, 0, dz), 3) < 3) nook++;
    }
    const high = Math.max(0, y - mid);
    if (nook >= 7 || (drop < 2.5 && nook < 3 && high < 8)) continue;   // (walled in all round: inside something)
    const score = Math.min(drop, 14) + 1.6 * Math.min(nook, 6) + 0.25 * Math.min(high, 40) + Math.min(depth * 2, 400) / 80 + Math.min(away, 80) / 20;
    scored.push({ x, y, z, score, drop, nook, high });
  }
  scored.sort((a, b) => b.score - a.score);
  scored.length = Math.min(scored.length, 20000);
  // (the best, spread over the world: each next pick the best score plus a bonus for being far from those already picked)
  const picks = [];
  while (picks.length < FRAGMENTS_PER_WORLD) {
    let best = null, bv = -Infinity;
    for (const s of scored) {
      const d = picks.length ? Math.min(...picks.map((p) => Math.hypot(p.x - s.x, p.z - s.z))) : 300;
      if (d < 25) continue;
      const v = s.score + Math.min(d, 300) / 12;
      if (v > bv) { bv = v; best = s; }
    }
    if (!best) break;
    // (and the traveller can stand on it: else it is dropped and the next best taken)
    const k = scored.indexOf(best);
    scored.splice(k, 1);
    if (standWhyNot({ physics, level }, V(best.x, best.y, best.z), Player)) continue;
    picks.push(best);
  }
  console.log(`  ${id}: [   // (${reached.length} spots reached, ${scored.length} out of the way)`);
  for (const p of picks) console.log(`    [${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}],   // drop ${p.drop.toFixed(1)}, nook ${p.nook}, high ${p.high.toFixed(1)}`);
  console.log('  ],');
}
