// The z-fight sites inside one temple, in its own frame (scripts/zfight/audit.mjs; .claude/skills/zfight-qc):
//   node scripts/zfight/list-temple.mjs <temple id> [--all] [--dynamic]   (--all: hidden sites too; --dynamic: the moving pieces too)
import * as THREE from 'three';
import { trianglesOf, coplanarOverlaps, visibleSites } from './lib.mjs';
import { rayOver, standing } from './audit.mjs';

const id = process.argv[2] ?? 'desert';
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const { buildableById } = await import('../../src/levels/buildable.js');
const { TEMPLE_HOME, templeOf } = await import('../../src/temples/index.js');
const scene = new THREE.Scene();
const level = quiet(() => buildableById(TEMPLE_HOME[id] ?? id).create(scene));
const rt = templeOf(level, id) ?? level.temple;
const all = trianglesOf(scene, { THREE });
const fights = coplanarOverlaps(trianglesOf(rt.root, { THREE, dynamic: process.argv.includes('--dynamic') }));
const shown = process.argv.includes('--all') ? fights.map((f) => ({ ...f, seen: { at: f.samples[0].p } })) : (() => { const ray = rayOver(all); return visibleSites(fights, ray, { stand: standing(level, ray) }); })();
const short = (m) => m.replace(/^.*\(([^,]+), \d+\)#\d+$/, '$1');
for (const f of shown) {
  const l = rt.kit.local(new THREE.Vector3(...f.seen.at)).toArray().map((x) => x.toFixed(1)).join(', ');
  const fr = f.seen.from ? rt.kit.local(new THREE.Vector3(...f.seen.from)).toArray().map((x) => x.toFixed(1)).join(", ") : "";
  console.log(`from ${fr}  ${String(f.area).padStart(7)} m²  ${short(f.meshA)}[${f.matA.split(':')[1] ?? ''}] × ${short(f.meshB)}[${f.matB.split(':')[1] ?? ''}]  local ${l}  n ${f.normal.join(',')}`);
}
console.log(`${shown.length} sites`);
