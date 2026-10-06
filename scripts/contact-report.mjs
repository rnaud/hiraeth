// The contact audit over every world, as a report (docs/systems/movement.md, "Contact").
//   node scripts/contact-report.mjs                # every world, the worst groups of each
//   node scripts/contact-report.mjs desert buried  # only those
//   TOP=40 node scripts/contact-report.mjs desert
//   COST=1 node scripts/contact-report.mjs desert  # what the collision costs instead: triangles, the BVH's
//                                                  # bake, and 20 k ground rays and capsule pushes
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { auditContact, formatContact } from '../src/contact-audit.js';
import { LEVELS } from '../src/levels/index.js';

const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar', 'atelier', 'home'];
const TOP = +(process.env.TOP ?? 12);
const COST = !!process.env.COST;
/** The two hot queries, 20 000 times each over a 200 m square round the spawn. */
function cost(physics, level) {
  const p = new THREE.Vector3(), spawn = level.spawn ?? new THREE.Vector3();
  let s = 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const t0 = performance.now();
  for (let i = 0; i < 20000; i++) { p.set(spawn.x + (rnd() - 0.5) * 200, spawn.y + 20, spawn.z + (rnd() - 0.5) * 200); physics.groundAt(p.x, p.y, p.z, 60); }
  const t1 = performance.now();
  for (let i = 0; i < 20000; i++) { p.set(spawn.x + (rnd() - 0.5) * 200, spawn.y, spawn.z + (rnd() - 0.5) * 200); physics.pushCapsule(p, 0.4, 0.6, 2.0); }
  return `20k ground rays ${(t1 - t0).toFixed(0)} ms, 20k capsule pushes ${(performance.now() - t1).toFixed(0)} ms`;
}
for (const id of ids) {
  const scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === id).create(scene));
  const t0 = performance.now();
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const bake = performance.now() - t0;
  const region = level.unsafe ? (p) => !level.unsafe(p) : null;
  const geos = [(physics.levelBVH !== undefined ? physics.levelBVH : physics.bvh)?.geometry ?? physics.geometry, ...(physics.extras ?? []).map((e) => e.bvh?.geometry)];
  const tris = geos.filter(Boolean).reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
  if (COST) { console.log(`${id}: ${Math.round(tris / 1000)} k triangles, bake ${bake.toFixed(0)} ms, ${cost(physics, level)}`); continue; }
  const r = auditContact({ physics, scene, region, solids: level.dynamic?.() ?? [], max: 12000 });
  console.log(`\n=== ${id} === (collision ${Math.round(tris / 1000)} k triangles)\n${formatContact(r, { top: TOP })}`);
}
