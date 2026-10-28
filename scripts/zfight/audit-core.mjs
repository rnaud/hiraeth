// Geometry audit implementation; optional source-name IO is injected by audit.mjs.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { trianglesOf, coplanarOverlaps, visibleSites, summarise } from './lib.mjs';

/** A ray against the triangles (either side): (origin, dir, far) -> null or { distance, normal }. */
export function rayOver(tris) {
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => pos.set([...t.a, ...t.b, ...t.c], i * 9));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const bvh = new MeshBVH(g), r = new THREE.Ray(), o = new THREE.Vector3(), d = new THREE.Vector3(), n = new THREE.Vector3();
  const open = verticalMisses(pos);
  return (origin, dir, far) => {
    // (most rays the finder casts are straight down for a floor or up for a ceiling, and most meet nothing: those whose
    // column no triangle's box reaches are answered without the BVH, the same null it would give)
    if (dir[0] === 0 && dir[2] === 0 && open(origin, dir[1], far)) return null;
    r.set(o.set(...origin), d.set(...dir));
    const h = bvh.raycastFirst(r, THREE.DoubleSide, 0, far);
    if (!h) return null;
    n.copy(h.face.normal);
    const back = n.dot(d) > 0;   // (met from behind: from inside a closed solid, every way out meets a back)
    if (back) n.negate();   // (the side it was met from)
    return { distance: h.distance, normal: [n.x, n.y, n.z], back };
  };
}
/**
 * (origin, up, far) -> true when a vertical ray from origin (up: +1 or -1) over `far` metres surely meets none of the
 * triangles (`pos`: 9 floats each): no triangle's box, padded by a millimetre, takes in that stretch of the column.
 * The boxes' heights are kept in cells of the ground plan as up to `K` spans a cell (two that come too close made one,
 * the gap between them counted in: "maybe"), each triangle in the finest of four grids (cells of 1, 4, 16, 64 m: wider
 * over a whole world, the finest at most `budget` cells) where it covers at most `many` cells, or in the coarsest.
 * false is "maybe": the caller casts the ray.
 */
function verticalMisses(pos, { budget = 262144, many = 256, K = 4, pad = 1e-3 } = {}) {
  let X0 = Infinity, X1 = -Infinity, Z0 = Infinity, Z1 = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { X0 = Math.min(X0, pos[i]); X1 = Math.max(X1, pos[i]); Z0 = Math.min(Z0, pos[i + 2]); Z1 = Math.max(Z1, pos[i + 2]); }
  if (!(X0 <= X1)) return () => true;   // (no triangles: every ray misses)
  X0 -= 2 * pad; Z0 -= 2 * pad; X1 += 2 * pad; Z1 += 2 * pad;
  const fine = Math.max(1, Math.sqrt(((X1 - X0) * (Z1 - Z0)) / budget));
  const grids = [1, 4, 16, 64].map((m) => {
    const s = fine * m, nx = Math.floor((X1 - X0) / s) + 1, nz = Math.floor((Z1 - Z0) / s) + 1;
    return { s, nx, nz, n: new Uint8Array(nx * nz), lo: new Float64Array(nx * nz * K), hi: new Float64Array(nx * nz * K) };
  });
  const add = ({ n, lo, hi }, cell, a, b) => {
    const at = cell * K;
    let c = n[cell];
    for (;;) {
      for (let j = 0; j < c;) {   // (the spans it meets taken into it)
        if (lo[at + j] <= b && hi[at + j] >= a) { a = Math.min(a, lo[at + j]); b = Math.max(b, hi[at + j]); c--; lo[at + j] = lo[at + c]; hi[at + j] = hi[at + c]; } else j++;
      }
      if (c < K) break;
      let best = 0, gap = Infinity;   // (full: the nearest taken in too, and the gap with it)
      for (let j = 0; j < c; j++) { const g = Math.max(lo[at + j] - b, a - hi[at + j]); if (g < gap) { gap = g; best = j; } }
      a = Math.min(a, lo[at + best]); b = Math.max(b, hi[at + best]); c--; lo[at + best] = lo[at + c]; hi[at + best] = hi[at + c];
    }
    lo[at + c] = a; hi[at + c] = b; n[cell] = c + 1;
  };
  for (let i = 0; i < pos.length; i += 9) {
    const x0 = Math.min(pos[i], pos[i + 3], pos[i + 6]) - pad, x1 = Math.max(pos[i], pos[i + 3], pos[i + 6]) + pad;
    const y0 = Math.min(pos[i + 1], pos[i + 4], pos[i + 7]) - pad, y1 = Math.max(pos[i + 1], pos[i + 4], pos[i + 7]) + pad;
    const z0 = Math.min(pos[i + 2], pos[i + 5], pos[i + 8]) - pad, z1 = Math.max(pos[i + 2], pos[i + 5], pos[i + 8]) + pad;
    let g = grids[grids.length - 1];
    for (const q of grids) {
      if ((Math.floor((x1 - X0) / q.s) - Math.floor((x0 - X0) / q.s) + 1) * (Math.floor((z1 - Z0) / q.s) - Math.floor((z0 - Z0) / q.s) + 1) <= many) { g = q; break; }
    }
    const cx1 = Math.floor((x1 - X0) / g.s), cz0 = Math.floor((z0 - Z0) / g.s), cz1 = Math.floor((z1 - Z0) / g.s);
    for (let cx = Math.floor((x0 - X0) / g.s); cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) add(g, cx * g.nz + cz, y0, y1);
  }
  return ([x, y, z], up, far) => {
    if (!(x >= X0 && x <= X1 && z >= Z0 && z <= Z1)) return true;   // (off the plan of every triangle)
    const a = up > 0 ? y : y - far, b = up > 0 ? y + far : y;
    for (const { s, nz, n, lo, hi } of grids) {
      const cell = Math.floor((x - X0) / s) * nz + Math.floor((z - Z0) / s), at = cell * K;
      for (let j = 0; j < n[cell]; j++) if (lo[at + j] <= b && hi[at + j] >= a) return false;
    }
    return true;
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

const quiet = async (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return await fn(); } finally { console.warn = w; console.log = l; } };

/**
 * A world's (or a part's) z-fights: { world, total, temples: { id: summary } }. `built`: the world already built as
 * here ({ scene, level }, its level's create alone, unchanged since: tests/zfight.test.js shares its temples' builds),
 * left for the caller to dispose.
 */
export async function zfightsOf(id, { temples = true, within = null, names = false, built = null } = {}, { nameParts, partOf, describe } = {}) {
  if (names) await nameParts();   // (before the world's modules load: what a merged mesh's pieces are)
  const { buildableById } = await import('../../src/levels/buildable.js');
  const scene = built?.scene ?? new THREE.Scene();
  const level = built?.level ?? await quiet(() => buildableById(id).create(scene));
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
  if (!built) level.dispose?.();
  return out;
}

/** The ship's z-fights (issue #325, "a lot of textures shimmering in my ship"): the parked ship built as main.js builds it,
 * on flat ground, its hull and its rooms; sites seen from where someone can stand aboard or round it. */
export async function shipZfights({ names = false } = {}, { nameParts, partOf, describe } = {}) {
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
  const ship = await quiet(() => new Ship({ scene, physics, level, levelId: 'audit', content: { npcs: [] } }));
  const tris = trianglesOf(ship.parked.group, { THREE, partOf: names ? partOf : null });
  const all = visibleSites(coplanarOverlaps(tris), rayOver(tris));
  if (names) for (const f of all) { if (f.parts) f.parts = f.parts.map(describe); }
  return { world: 'ship', total: summarise(all), all, temples: {} };
}

