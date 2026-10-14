// Z-fighting, world by world (.claude/skills/zfight-qc/SKILL.md): each world built as the game builds it (in node,
// no GPU), every visible static mesh's triangles, and the sites where two looks share a plane (scripts/zfight/lib.mjs).
//
//   node scripts/zfight/audit.mjs [--worlds desert,incal] [--temples] [--out report.json] [--worst 8] [--within x0,y0,z0,x1,y1,z1] [--no-names]
//   node scripts/zfight/audit.mjs --ship [--worst 8]        the ship alone, parked (src/ship/ship.js: its hull and its rooms;
//                                                          every world's ship is the same one, built by main.js, not the level)
//
// A site between two meshes merged of many pieces says which pieces (scripts/zfight/names.mjs: the lines of src/ that
// made them and the comment over the line); --no-names leaves that out (a little faster).
// --temples: each world's temples alone (their insides and their exteriors), counted apart from the rest of the world.
// Prints a line per world (sites, shared m²) and the worst sites; --out writes them all as JSON.
// tests/zfight.test.js holds the counts to their baselines (ZFIGHT_BASELINE there).
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { MeshBVH } from 'three-mesh-bvh';
import { trianglesOf, coplanarOverlaps, visibleSites, summarise } from './lib.mjs';
import { nameParts, partOf, describe } from './names.mjs';

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
export async function zfightsOf(id, { temples = true, within = null, names = false } = {}) {
  if (names) await nameParts();   // (before the world's modules load: what a merged mesh's pieces are)
  const { buildableById } = await import('../../src/levels/buildable.js');
  const scene = new THREE.Scene();
  const level = await quiet(() => buildableById(id).create(scene));
  const box = within ? new THREE.Box3(new THREE.Vector3(...within.slice(0, 3)), new THREE.Vector3(...within.slice(3))) : null;
  const inBox = (t) => !box || [t.a, t.b, t.c].some((p) => box.containsPoint(new THREE.Vector3(...p)));
  const tris = trianglesOf(scene, { THREE, partOf: names ? partOf : null }).filter(inBox);
  const ray = rayOver(tris);
  const stand = standing(level, ray);
  const all = visibleSites(coplanarOverlaps(tris), ray, { stand });
  // (a merged mesh's two pieces, by the lines that made them: 'island (space-city-kit.js:178) — the parapet …')
  if (names) for (const f of all) { if (f.parts) f.parts = f.parts.map(describe); }
  const out = { world: id, total: summarise(all), all, temples: {} };
  if (temples) for (const rt of level.temples ?? (level.temple ? [level.temple] : [])) {
    const t = trianglesOf(rt.root, { THREE }).filter(inBox);
    out.temples[rt.def?.id ?? rt.id] = summarise(visibleSites(coplanarOverlaps(t), ray, { stand }));
  }
  level.dispose?.();
  return out;
}

/** The ship's z-fights (issue #325, "a lot of textures shimmering in my ship"): the parked ship built as main.js builds it,
 * on flat ground, its hull and its rooms; sites seen from where someone can stand aboard or round it. */
export async function shipZfights({ names = false } = {}) {
  if (names) await nameParts();
  const { Physics } = await import('../../src/physics.js');
  const { Ship } = await import('../../src/ship/ship.js');
  globalThis.window ??= { addEventListener() {} };
  const scene = new THREE.Scene(), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2));
  ground.userData.zfightIgnore = true;   // (the stand-in ground: not the ship's)
  scene.add(ground);
  const physics = new Physics(scene);
  const level = { spawn: V(0, 0, 60), ground: { heightAt: () => 0 }, lights: [], shipSite: { x: 0, z: 0, heading: Math.PI / 2 } };
  const ship = await quiet(() => new Ship({ scene, physics, level, levelId: 'audit', content: { npcs: [], relics: { spots: [] } } }));
  const tris = trianglesOf(ship.parked.group, { THREE, partOf: names ? partOf : null });
  const all = visibleSites(coplanarOverlaps(tris), rayOver(tris));
  if (names) for (const f of all) { if (f.parts) f.parts = f.parts.map(describe); }
  return { world: 'ship', total: summarise(all), all, temples: {} };
}

if (import.meta.url === `file://${process.argv[1]}` && args.includes('--ship')) {
  const r = await shipZfights({ names: !args.includes('--no-names') });
  console.log(`ship         ${String(r.total.count).padStart(4)} sites, ${String(r.total.area).padStart(8)} m² shared`);
  for (const f of r.total.worst.slice(0, +arg('worst', 8))) console.log(`    ${String(f.area).padStart(7)} m²  ${f.matA} × ${f.matB}  at ${f.seen?.at.join(', ')}  n ${f.normal.join(',')}  (${f.meshA} × ${f.meshB})` + (f.parts ? f.parts.map((p, i) => `\n             ${i ? 'B' : 'A'}: ${p || '?'}`).join('') : ''));
  if (arg('out')) writeFileSync(arg('out'), JSON.stringify([r], null, 1));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const names = !args.includes('--no-names');
  if (names) await nameParts();
  const { LEVELS } = await import('../../src/levels/index.js');
  const worlds = arg('worlds')?.split(',') ?? LEVELS.filter((l) => !l.hidden).map((l) => l.id);
  const within = arg('within')?.split(',').map(Number) ?? null;
  const worst = +arg('worst', 8);
  const report = [];
  for (const w of worlds) {
    const t0 = Date.now();
    let r;
    try { r = await zfightsOf(w, { temples: args.includes('--temples') || true, within, names }); } catch (e) { console.log(`${w.padEnd(12)} failed: ${e.message}`); continue; }
    report.push(r);
    console.log(`${w.padEnd(12)} ${String(r.total.count).padStart(4)} sites, ${String(r.total.area).padStart(8)} m² shared  (${((Date.now() - t0) / 1000).toFixed(1)} s)` + Object.entries(r.temples).map(([id, s]) => `\n  temple ${id.padEnd(12)} ${String(s.count).padStart(4)} sites, ${s.area} m²`).join(''));
    for (const f of r.total.worst.slice(0, worst)) console.log(`    ${String(f.area).padStart(7)} m²  ${f.matA} × ${f.matB}  at ${f.seen?.at.join(', ')}  n ${f.normal.join(',')}  (${f.meshA} × ${f.meshB})` + (f.parts ? f.parts.map((p, i) => `\n             ${i ? 'B' : 'A'}: ${p || '?'}`).join('') : ''));
  }
  if (arg('out')) writeFileSync(arg('out'), JSON.stringify(report, null, 1));   // (every site: report[i].all)
}
