// Z-fighting, world by world (.claude/skills/zfight-qc/SKILL.md): each world built as the game builds it (in node,
// no GPU), every visible static mesh's triangles, and the sites where two looks share a plane (scripts/zfight/lib.mjs).
//
//   node scripts/zfight/audit.mjs [--worlds desert,incal] [--temples] [--out report.json] [--worst 8] [--within x0,y0,z0,x1,y1,z1]
//
// --temples: each world's temples alone (their insides and their exteriors), counted apart from the rest of the world.
// Prints a line per world (sites, shared m²) and the worst sites; --out writes them all as JSON.
// tests/zfight.test.js holds the counts to their baselines (ZFIGHT_BASELINE there).
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { MeshBVH } from 'three-mesh-bvh';
import { trianglesOf, coplanarOverlaps, visibleSites, summarise } from './lib.mjs';

/** A ray against the triangles (either side): (origin, dir, far) -> null or { distance, normal }. */
export function rayOver(tris) {
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => pos.set([...t.a, ...t.b, ...t.c], i * 9));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const bvh = new MeshBVH(g), r = new THREE.Ray(), o = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
  return (origin, dir, far) => {
    r.set(o.set(...origin), d.set(...dir));
    const h = bvh.raycastFirst(r, THREE.DoubleSide, 0, far);
    if (!h) return null;
    n.copy(h.face.normal);
    const back = n.dot(d) > 0;   // (met from behind: from inside a closed solid, every way out meets a back)
    if (back) n.negate();   // (the side it was met from)
    return { distance: h.distance, normal: [n.x, n.y, n.z], back };
  };
}
/** Where someone can stand: anywhere, but inside a temple's box only in a room (under a roof, walls round: not on
 * top of the rooms or between them). */
export function standing(level, ray) {
  const rts = level?.temples ?? (level?.temple ? [level.temple] : []), v = new THREE.Vector3();
  const walled = (e) => [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].every((d) => ray(e, d, 80));
  return (e) => !rts.some((rt) => rt.inside?.(v.set(...e))) || (!!ray(e, [0, 1, 0], 45) && walled(e));
}
/** The visible sites among the triangles' fights (lib.mjs visibleSites, against these triangles and `blockers`). */
export function fightsIn(tris, blockers = tris, stand = null) {
  return visibleSites(coplanarOverlaps(tris), rayOver(blockers), { stand });
}

const args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };

/** A world's (or a part's) z-fights: { world, total, temples: { id: summary } }. */
export async function zfightsOf(id, { temples = true, within = null } = {}) {
  const { buildableById } = await import('../../src/levels/buildable.js');
  const scene = new THREE.Scene();
  const level = await quiet(() => buildableById(id).create(scene));
  const box = within ? new THREE.Box3(new THREE.Vector3(...within.slice(0, 3)), new THREE.Vector3(...within.slice(3))) : null;
  const inBox = (t) => !box || [t.a, t.b, t.c].some((p) => box.containsPoint(new THREE.Vector3(...p)));
  const tris = trianglesOf(scene, { THREE }).filter(inBox);
  const ray = rayOver(tris);
  const stand = standing(level, ray);
  const all = visibleSites(coplanarOverlaps(tris), ray, { stand });
  const out = { world: id, total: summarise(all), temples: {} };
  if (temples) for (const rt of level.temples ?? (level.temple ? [level.temple] : [])) {
    const t = trianglesOf(rt.root, { THREE }).filter(inBox);
    out.temples[rt.def?.id ?? rt.id] = summarise(visibleSites(coplanarOverlaps(t), ray, { stand }));
  }
  level.dispose?.();
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { LEVELS } = await import('../../src/levels/index.js');
  const worlds = arg('worlds')?.split(',') ?? LEVELS.filter((l) => !l.hidden).map((l) => l.id);
  const within = arg('within')?.split(',').map(Number) ?? null;
  const worst = +arg('worst', 8);
  const report = [];
  for (const w of worlds) {
    const t0 = Date.now();
    let r;
    try { r = await zfightsOf(w, { temples: args.includes('--temples') || true, within }); } catch (e) { console.log(`${w.padEnd(12)} failed: ${e.message}`); continue; }
    report.push(r);
    console.log(`${w.padEnd(12)} ${String(r.total.count).padStart(4)} sites, ${String(r.total.area).padStart(8)} m² shared  (${((Date.now() - t0) / 1000).toFixed(1)} s)` + Object.entries(r.temples).map(([id, s]) => `\n  temple ${id.padEnd(12)} ${String(s.count).padStart(4)} sites, ${s.area} m²`).join(''));
    for (const f of r.total.worst.slice(0, worst)) console.log(`    ${String(f.area).padStart(7)} m²  ${f.matA} × ${f.matB}  at ${f.seen?.at.join(', ')}  n ${f.normal.join(',')}  (${f.meshA} × ${f.meshB})`);
  }
  if (arg('out')) writeFileSync(arg('out'), JSON.stringify(report, null, 1));
}
