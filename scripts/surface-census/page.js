// The census's page side (scripts/surface-census/census.mjs loads it into the running game: `import('/scripts/…')`,
// served by the dev server, so it shares the game's three.js). Two passes over the booted world:
//   census()      every visible mesh drawn with makeMaterial's surface shader, grouped by material (its cache key),
//                 classified (lib.mjs classify) by its options and compiled defines, and its world area
//   walk(points)  from each walked point (walk.mjs): a ray down (what the player stands on) and a fan of rays from his
//                 eye (what he sees round him, 8 headings × 3 pitches, out to 80 m), each hit put to its material
// and highlight(key, on) to tint one material's meshes for its picture.
import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
import { classify } from './lib.mjs';

const WORLD_ID = () => new URLSearchParams(location.search).get('level') ?? '';
const shown = (o) => { for (let x = o; x; x = x.parent) if (x.visible === false) return false; return true; };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Matrix4();

/** Area of a geometry's triangles (local units), within one draw group's range, sampled past 6000 triangles. */
function geoArea(g, start = 0, count = Infinity) {
  const pos = g.attributes.position; if (!pos) return 0;
  const idx = g.index, n = Math.min(idx ? idx.count : pos.count, start + count);
  const tris = Math.floor((n - start) / 3), step = Math.max(1, Math.floor(tris / 6000));
  let s = 0;
  for (let t = 0; t < tris; t += step) {
    const i = start + t * 3, i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    _a.fromBufferAttribute(pos, i0); _b.fromBufferAttribute(pos, i1); _c.fromBufferAttribute(pos, i2);
    s += _b.sub(_a).cross(_c.sub(_a)).length() / 2;
  }
  return s * step;
}
/** How a matrix scales an area (its determinant to the 2/3). */
const areaScale = (m) => Math.pow(Math.abs(m.determinant()), 2 / 3);

let GROUPS = null, MESHES = null;
function materialInfo(mat) {
  let opts = {};
  try { opts = JSON.parse(mat.userData.cacheKey ?? '{}'); } catch { /* a material of its own */ }
  const skin = !!mat.userData.skinPattern;
  const finished = skin && (mat.fragmentShader?.split('mkFinish(').length ?? 0) > 2;   // (the helper itself, then its calls)
  const c = classify({ defines: mat.defines ?? {}, opts, skin, finished, world: WORLD_ID() });
  const colour = typeof opts.color === 'string' ? opts.color : mat.uniforms?.uColor?.value?.getHexString ? `#${mat.uniforms.uColor.value.getHexString()}` : '?';
  const keys = Object.keys(opts).filter((k) => !['color', 'color2', 'color3'].includes(k)).slice(0, 10);
  return { ...c, colour, opts: keys.map((k) => (typeof opts[k] === 'object' ? k : `${k}:${opts[k]}`)).join(' '), skin: skin ? `${mat.userData.skinPattern.skin}/${mat.userData.skinPattern.body}` : '', defines: Object.keys(mat.defines ?? {}).filter((k) => k !== 'SURFACE_SPEC').join(' ') };
}
const nameOf = (o) => { for (let x = o; x; x = x.parent) if (x.name) return x.name.slice(0, 48); return '(unnamed)'; };

/** Every visible surface-shader mesh, by material: [{ key, cls, why, colour, opts, defines, area, meshes, names }]. */
export function census(scene = window.scene) {
  GROUPS = new Map(); MESHES = [];
  const geoCache = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || !shown(o) || o.isBatchedMesh) return;
    const mats = [].concat(o.material);
    const g = o.geometry;
    const parts = Array.isArray(o.material) && g.groups.length ? g.groups.map((gr) => ({ mat: mats[gr.materialIndex], start: gr.start, count: gr.count })) : [{ mat: mats[0], start: 0, count: Infinity }];
    let inst = 1;
    if (o.isInstancedMesh) {
      const n = o.count, step = Math.max(1, Math.floor(n / 400));
      let s = 0; for (let i = 0; i < n; i += step) { o.getMatrixAt(i, _m); s += areaScale(_m); }
      inst = n ? (s * n) / Math.ceil(n / step) : 0;
    }
    const scale = areaScale(o.matrixWorld) * inst;
    for (const p of parts) {
      const mat = p.mat; if (!mat?.userData?.surface) continue;
      const gk = `${g.uuid}:${p.start}`;
      if (!geoCache.has(gk)) geoCache.set(gk, geoArea(g, p.start, p.count));
      const area = geoCache.get(gk) * scale;
      const key = mat.userData.cacheKey ?? mat.uuid;
      if (!GROUPS.has(key)) GROUPS.set(key, { key, ...materialInfo(mat), area: 0, meshes: 0, names: new Map(), mats: new Set(), objs: [], under: 0, seen: 0, hits: [] });
      const G = GROUPS.get(key);
      G.area += area; G.meshes++; G.mats.add(mat); G.objs.push(o);
      G.names.set(nameOf(o), (G.names.get(nameOf(o)) ?? 0) + area);
      if (area > (G.bigArea ?? -1)) { G.bigArea = area; G.big = o; }
    }
    MESHES.push(o);
  });
  return [...GROUPS.values()].map(publicRow);
}
const _box = new THREE.Box3();
/** Where a mesh stands: its box's middle and size (m), rounded. */
const whereOf = (o) => { if (!o) return null; _box.setFromObject(o); const c = _box.getCenter(new THREE.Vector3()), z = _box.getSize(new THREE.Vector3()); return { at: c.toArray().map(Math.round), size: z.toArray().map(Math.round) }; };
const publicRow = (G) => ({ key: G.key, cls: G.cls, why: G.why, colour: G.colour, opts: G.opts, defines: G.defines, skin: G.skin, area: Math.round(G.area), meshes: G.meshes,
  where: whereOf(G.big), names: [...G.names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n), under: +G.under.toFixed(2), seen: +G.seen.toFixed(2), hits: G.hits.slice(0, 6) });

/**
 * The walked pass: rays from each point { pos, w }. A ray down from 2.5 m over it (12 m; else from 60 m over it, 120 m:
 * a path point hanging over the ground) is what he stands on; from 1.7 m over that, a fan out to 80 m is what he sees.
 * Each hit adds the point's weight to its material (under: the share of the down rays, seen: of the fan's).
 */
export function walk(points) {
  if (!GROUPS) census();
  const prev = THREE.Mesh.prototype.raycast;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
  const occluders = MESHES.filter((o) => {
    const m = [].concat(o.material)[0];
    if (m?.transparent && m.opacity < 0.5) return false;
    const G = GROUPS.get(m?.userData?.cacheKey ?? m?.uuid);
    return !(G && ['glass', 'grass', 'people'].includes(G.cls)) && !o.isSkinnedMesh;
  });
  for (const o of occluders) {
    const g = o.geometry, tris = g.index ? g.index.count : g.attributes.position?.count ?? 0;
    if (tris > 300 && !g.boundsTree) { try { g.boundsTree = computeBoundsTree.call(g); } catch { /* not indexable: the plain raycast */ } }
  }
  const spheres = occluders.map((o) => {
    if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); return o.boundingSphere.clone().applyMatrix4(o.matrixWorld); }
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    return o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);
  });
  const rc = new THREE.Raycaster(); rc.firstHitOnly = true;
  const groupOf = (hit) => { const o = hit.object, m = Array.isArray(o.material) ? o.material[hit.face?.materialIndex ?? 0] : o.material; return GROUPS.get(m?.userData?.cacheKey ?? m?.uuid) ?? null; };
  const tally = { under: 0, seen: 0, missUnder: 0, other: { under: 0, seen: 0 } };
  const near = (p, r) => occluders.filter((_, i) => spheres[i].center.distanceTo(p) < spheres[i].radius + r);
  // (two faces in one plane, a deck's plain base and its paved top: the one drawn over the other, by its render order or
  // polygon offset, else the treated one; a ray takes either at random)
  const front = (h) => { const m = [].concat(h.object.material)[0], G = groupOf(h); return (h.object.renderOrder ?? 0) * 100 - (m?.polygonOffset ? m.polygonOffsetFactor + m.polygonOffsetUnits : 0) * 10 + (G && G.cls !== 'plain' && G.cls !== 'grid' && G.cls !== 'bands' ? 1 : 0); };
  const cast = (from, dir, far, list) => {
    rc.set(from, dir); rc.far = far;
    const h = rc.intersectObjects(list, false);
    if (!h.length) return null;
    const tied = h.filter((x) => x.distance < h[0].distance + 0.06);
    return tied.length > 1 ? tied.sort((a, b) => front(b) - front(a))[0] : h[0];
  };
  const DOWN = new THREE.Vector3(0, -1, 0), P = new THREE.Vector3(), E = new THREE.Vector3(), D = new THREE.Vector3();
  for (const pt of points) {
    P.set(...pt.pos);
    let list = near(P, 130);
    let hit = cast(P.clone().setY(P.y + 2.5), DOWN, 12, list) ?? cast(P.clone().setY(P.y + 60), DOWN, 120, list);
    if (!hit) { tally.missUnder += pt.w; continue; }
    const G = groupOf(hit);
    tally.under += pt.w;
    if (G) { G.under += pt.w; if (G.hits.length < 12) G.hits.push({ kind: 'under', at: hit.point.toArray().map((v) => +v.toFixed(2)), from: [P.x, hit.point.y + 2, P.z] }); } else tally.other.under += pt.w;
    E.copy(hit.point).y += 1.7;
    list = near(E, 85);
    const w = pt.w / 24;
    for (let k = 0; k < 8; k++) for (const pitch of [-0.12, -0.35, -0.7]) {
      const yaw = (k / 8) * Math.PI * 2 + 0.2;
      D.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const h = cast(E, D, 80, list);
      if (!h) continue;
      tally.seen += w;
      const S = groupOf(h);
      if (S) { S.seen += w; if (S.hits.length < 12 && h.distance > 4 && h.distance < 30) S.hits.push({ kind: 'seen', at: h.point.toArray().map((v) => +v.toFixed(2)), from: E.toArray().map((v) => +v.toFixed(2)) }); } else tally.other.seen += w;
    }
  }
  THREE.Mesh.prototype.raycast = prev;
  return { tally, rows: [...GROUPS.values()].map(publicRow) };
}

/** Tint one material magenta (on) or put it back (off): the picture's second half, which surface it is. (Its own
 *  colours changed, not its material swapped: the game's passes draw the surface shader's materials only.) */
const MAGENTA = new THREE.Color('#ff00e0');
export function highlight(key, on) {
  const G = GROUPS?.get(key); if (!G) return 0;
  for (const m of G.mats) {
    const u = m.uniforms ?? {};
    if (on) {
      m.userData.__census = { c: ['uColor', 'uColor2', 'uColor3'].map((k) => u[k]?.value?.clone()), vc: m.vertexColors };
      for (const k of ['uColor', 'uColor2', 'uColor3']) u[k]?.value?.copy(MAGENTA);
      if (m.vertexColors) { m.vertexColors = false; m.needsUpdate = true; }
    } else if (m.userData.__census) {
      const S = m.userData.__census;
      ['uColor', 'uColor2', 'uColor3'].forEach((k, i) => S.c[i] && u[k]?.value?.copy(S.c[i]));
      if (S.vc) { m.vertexColors = true; m.needsUpdate = true; }
      delete m.userData.__census;
    }
  }
  // (merged meshes carry their colours per vertex, vertex-material.js: those painted too)
  for (const o of G.objs) {
    const g = o.geometry;
    for (const k of ['aMatC1', 'aMatC2', 'aMatC3']) {
      const a = g.attributes[k]; if (!a) continue;
      if (on) { g.userData.__census ??= {}; g.userData.__census[k] = a.array.slice(); for (let i = 0; i < a.count; i++) a.setXYZ(i, MAGENTA.r, MAGENTA.g, MAGENTA.b); }
      else if (g.userData.__census?.[k]) a.array.set(g.userData.__census[k]);
      a.needsUpdate = true;
    }
    if (!on) delete g.userData.__census;
  }
  return G.mats.size;
}
