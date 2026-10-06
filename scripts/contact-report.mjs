// The contact audit over every world, as a report (docs/systems/movement.md, "Contact").
//   node scripts/contact-report.mjs                # every world, the worst groups of each
//   node scripts/contact-report.mjs desert buried  # only those
//   TOP=40 node scripts/contact-report.mjs desert
import * as THREE from 'three';
import { Physics } from '../src/physics.js';
import { auditContact, formatContact } from '../src/contact-audit.js';
import { LEVELS } from '../src/levels/index.js';

const quiet = (f) => { const w = console.warn, l = console.log, i = console.info; console.warn = console.log = console.info = () => {}; try { return f(); } finally { console.warn = w; console.log = l; console.info = i; } };
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : ['desert', 'incal', 'arzach', 'arzach2', 'garage', 'buried', 'edena', 'spheres', 'perdide', 'perdide2', 'bazaar', 'atelier', 'home'];
const TOP = +(process.env.TOP ?? 12);
for (const id of ids) {
  const scene = new THREE.Scene();
  const level = quiet(() => LEVELS.find((l) => l.id === id).create(scene));
  const physics = new Physics(scene, level.ground?.heightAt ? level.ground : null);
  quiet(() => level.init?.(physics));
  const region = level.unsafe ? (p) => !level.unsafe(p) : null;
  const r = auditContact({ physics, scene, region, solids: level.dynamic?.() ?? [], max: 12000 });
  const geos = [(physics.levelBVH !== undefined ? physics.levelBVH : physics.bvh)?.geometry ?? physics.geometry, ...(physics.extras ?? []).map((e) => e.bvh?.geometry)];
  const tris = geos.filter(Boolean).reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
  console.log(`\n=== ${id} === (collision ${Math.round(tris / 1000)} k triangles)\n${formatContact(r, { top: TOP })}`);
}
