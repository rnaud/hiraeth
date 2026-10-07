import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODE_WATER } from './materials.js';

// The contact audit: do the surfaces you stand on and climb agree with what is drawn there?
// Collision (physics.js) is baked from the drawn meshes, but some worlds collide against a
// coarser stand-in (Vael II's rock, a temple kit's proxies) or draw a trim over a floor with no
// collision of its own; where the two part, feet sink into a drawn ledge or the traveller climbs
// half inside a drawn rock. A dev tool (window.contactAudit() in the running game) and
// tests/contact-audit.test.js on every world built in node.
//
//   auditContact({ physics, scene, solids, exclude, tol, cell, max })
//     → { checked: { top, wall, carrier }, counts: { issue: n }, groups: [{ issue, name, n, max, at }], worst }
//
// - tops: points on every walkable collision face (normal within ~45° of up), a few per cell of
//   `cell` metres. From 1 m above, a ray down meets the collision and the drawn surfaces: the
//   drawn top more than `tol` above the collision's is "feet sink" (the trim on a ledge drawn
//   over a lower floor), more than `tol` below is "feet hover" (a stand-in above what is drawn);
//   nothing drawn within 0.6 m of a collision top is "unseen floor".
// - walls: points on every face you can grab to climb (within ~20° of vertical, as Player.moveStep
//   starts a climb), a ray in from 0.75 m out along the face's level normal: the drawn surface more
//   than `tol` in front of the collision is "climbs inside" (the traveller hugs a stand-in inside
//   the drawn rock), more than `tol` behind is "climbs off" (he hangs in the air before it).
// - carriers: each moving solid (level.dynamic(): a riding disc, a taxi's roof) whose drawn top
//   over its disc is not its solid's top.
// What is drawn: every visible, opaque mesh where it is now, but not the walk-through scatter (instanced
// noCollide), flora, things that float on purpose, the shadow-only casters, the heightfield's own mesh
// or anything under `exclude` (the moving solids' own meshes are left out automatically).

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _p = new THREE.Vector3();
const _ray = new THREE.Ray(), _m = new THREE.Matrix4();
const OUT = 0.75;   // m: the climber's side of a wall, where its rays start (about where his chest hangs)
const WALK = 1.2;   // m: how far under a drawn top solid ground must be for the feet to pass through it
const shown = (o) => { for (let x = o; x; x = x.parent) if (x.visible === false) return false; return true; };
const walkThrough = (o) => { for (let x = o; x; x = x.parent) if (x.userData?.noCollide) return true; return false; };
const r2 = (v) => [+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)];

function nameOf(o) {
  const parts = [];
  for (let x = o; x && !x.isScene && parts.length < 2; x = x.parent) if (x.name) parts.unshift(x.name);
  return parts.join(' / ') || o.geometry?.type || o.type;
}

/** The moving solids' own drawn objects (a Platform's group, a taxi's model), to leave out of the still surfaces. */
export function solidObjects(solids = []) {
  const out = [];
  for (const v of solids) {
    for (const k of ['group', 'root', 'object', 'mesh', 'model']) if (v?.[k]?.isObject3D) out.push(v[k]);
    if (v?.model?.group?.isObject3D) out.push(v.model.group);   // (a guardian: its model is { group, pos, … })
  }
  return out;
}

/**
 * Every drawn, opaque, still surface you could stand on or climb as one BVH, and which mesh each
 * triangle came from: { bvh, owner(faceIndex) → name }.
 */
export function drawnSurfaces(scene, { exclude = [], maxInstances = 4000 } = {}) {
  scene.updateMatrixWorld(true);
  const skip = new Set(exclude.filter(Boolean));
  const geos = [], names = [], ends = [];
  let tris = 0;
  const add = (o, geo, m) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.attributes.position);
    if (geo.index) g.setIndex(geo.index);
    const w = g.clone().applyMatrix4(m);
    const flat = w.index ? w.toNonIndexed() : w;
    geos.push(flat);
    tris += flat.attributes.position.count / 3;
    names.push(nameOf(o)); ends.push(tris);
  };
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry?.attributes?.position) return;
    for (let x = o; x; x = x.parent) if (skip.has(x)) return;
    // (still where they are now: a temple's doors, which collide while shut, are dynamic: they are drawn too)
    if (!shown(o) || o.userData.flora || o.userData.floats) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || mat.visible === false || mat.colorWrite === false || mat.transparent || mat.depthWrite === false || mat.blending === THREE.AdditiveBlending) return;
    if (o.userData.water || mat.uniforms?.uMode?.value === MODE_WATER) return;   // (water is swum, not stood on)
    if (o.isInstancedMesh) {
      if (walkThrough(o) || o.count > maxInstances || o.instanceMatrix.usage === THREE.DynamicDrawUsage) return;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, _m); _m.premultiply(o.matrixWorld); add(o, o.geometry, _m.clone()); }
    } else add(o, o.geometry, o.matrixWorld);
  });
  if (!geos.length) return null;
  for (const g of geos) for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  const bvh = new MeshBVH(mergeGeometries(geos));
  // (the BVH reorders its index: a hit's faceIndex names a slot in it, whose first vertex is still the merged
  // geometry's own, three to a triangle)
  const index = bvh.geometry.index;
  const ownerFace = (face) => {
    let lo = 0, hi = ends.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ends[mid] > face) hi = mid; else lo = mid + 1; }
    return names[lo];
  };
  const owner = (slot) => ownerFace(Math.floor((index ? index.getX(3 * slot) : 3 * slot) / 3));
  return { bvh, owner, ownerFace, tris };
}

/** The collision's own triangles (the level's and any added later), as position arrays. */
function collisionGeometries(physics) {
  const out = [];
  const lvl = physics.levelBVH !== undefined ? physics.levelBVH : physics.bvh;
  const g = lvl?.geometry ?? physics.geometry;
  if (g?.attributes?.position) out.push(g);
  // (a moving collider, the great wheel, where it stands now: its BVH is in its own frame)
  for (const e of physics.extras ?? []) if (e.bvh?.geometry) out.push(e.moving ? e.bvh.geometry.clone().applyMatrix4(e.matrix) : e.bvh.geometry);
  return out;
}

/** A collision triangle's corners into _a, _b, _c and its (unnormalised) normal into _n. */
function tri(geo, t) {
  const pos = geo.attributes.position, idx = geo.index;
  const vi = (j) => (idx ? idx.getX(3 * t + j) : 3 * t + j);
  _a.fromBufferAttribute(pos, vi(0)); _b.fromBufferAttribute(pos, vi(1)); _c.fromBufferAttribute(pos, vi(2));
  return _n.subVectors(_c, _b).cross(_d.subVectors(_a, _b));
}

const first = (bvh, origin, dir, far) => {
  _ray.origin.copy(origin); _ray.direction.copy(dir);
  return bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
};

/**
 * @param o.physics  the level's Physics
 * @param o.scene    what is drawn
 * @param o.solids   level.dynamic() (moving floors), checked as carriers and left out of the still surfaces
 * @param o.tol      metres the drawn and the collision surfaces may differ by (default 0.06)
 * @param o.cell     metres between samples on a face (default 1.5); o.max: a cap on samples of each kind
 * @param o.region   optional (p) => bool: only sample there; o.walk: also sample the drawn tops (default true)
 */
export function auditContact({ physics, scene, solids = [], exclude = [], tol = 0.06, cell = 1.5, max = 60000, region = null, seed = 1, walk = true } = {}) {
  // (the heightfield's own mesh is the terrain's, checked against heightAt elsewhere: the rays here are for meshes)
  const drawn = drawnSurfaces(scene, { exclude: [...exclude, ...solidObjects(solids), physics.base?.mesh] });
  const groups = new Map(), counts = {}, checked = { top: 0, wall: 0, walk: 0, carrier: 0 };
  let worst = null;
  const flag = (issue, name, at, by) => {
    counts[issue] = (counts[issue] ?? 0) + 1;
    const key = `${issue}|${name}|${Math.round(at.x / 40)},${Math.round(at.z / 40)}`;
    const g = groups.get(key) ?? { issue, name, n: 0, max: 0, at: null };
    g.n++;
    if (by >= g.max) { g.max = +by.toFixed(2); g.at = r2(at); }
    groups.set(key, g);
    if (!worst || by > worst.by) worst = { issue, name, at: r2(at), by: +by.toFixed(2) };
  };
  if (!drawn || !physics.bvh) return { checked, counts, groups: [], worst };
  const coll = physics.bvh;
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
  // where to look: the walkable faces and the climbable ones, sampled by area (one point per cell² of
  // face, fewer when a world has more than `max` of either: spread evenly, not the first faces only)
  const faces = { top: [], wall: [] }, area = { top: 0, wall: 0 };
  const geos = collisionGeometries(physics);
  geos.forEach((geo, gi) => {
    const pos = geo.attributes.position, idx = geo.index;
    const nt = (idx ? idx.count : pos.count) / 3;
    for (let t = 0; t < nt; t++) {
      tri(geo, t);
      const ar = _n.length() / 2;
      if (ar < 1e-3) continue;
      const ny = Math.abs(_n.y) / (2 * ar);
      const kind = ny > 0.7 ? 'top' : ny < 0.35 ? 'wall' : null;
      if (!kind) continue;
      if (region && !region(_p.copy(_a).add(_b).add(_c).divideScalar(3))) continue;
      faces[kind].push(gi, t, ar);
      area[kind] += ar;
    }
  });
  for (const kind of ['top', 'wall']) {
    const F = faces[kind], density = Math.min(1 / (cell * cell), max / Math.max(area[kind], 1e-6));
    for (let f = 0; f < F.length; f += 3) {
      const geo = geos[F[f]], ar = F[f + 2];
      const want = ar * density, k = Math.floor(want) + (rnd() < want - Math.floor(want) ? 1 : 0);
      if (!k) continue;
      tri(geo, F[f + 1]);
      _n.normalize();
      const top = kind === 'top';
      for (let i = 0; i < k; i++) {
        let u = rnd(), v = rnd();
        if (u + v > 1) { u = 1 - u; v = 1 - v; }
        _p.copy(_a).multiplyScalar(1 - u - v).addScaledVector(_b, u).addScaledVector(_c, v);
        if (region && !region(_p)) continue;
        if (top) {
          // (a top seen from above: a face turned down is the underside of something, skipped)
          _o.set(_p.x + 1.37e-4, _p.y + 1.0, _p.z + 2.91e-4);
          const hc = first(coll, _o, DOWN, 1.6);
          // (under something else: not this face's top; or met from inside a solid, a shut door's block, by its underside)
          if (!hc || Math.abs(hc.point.y - _p.y) > 0.02 || hc.face.normal.y < 0) continue;
          // (where the heightfield lies over it, sand banked on a floor, you stand on that: the terrain's own business)
          if (physics.base && physics.base.heightAt(_p.x, _p.z) > _p.y + 0.02) continue;
          checked.top++;
          const hd = first(drawn.bvh, _o, DOWN, 1.6);
          if (!hd || hd.point.y < _p.y - 0.6) {
            // (a top buried deeper than a metre in the drawn rock: the way up leaves through the back of a drawn face)
            const hu = first(drawn.bvh, _o, UP, 4);
            if (hu && hu.face.normal.y > 0 && !physics.embedded(_o)) flag('feet sink', drawn.owner(hu.faceIndex), _p, 1 + hu.distance);
            else flag('unseen floor', 'collision with nothing drawn', _p, 0.6);
            continue;
          }
          const dy = hd.point.y - _p.y;
          if (dy > tol && physics.embedded(_o)) { checked.top--; continue; }   // (the point above is inside a solid: a shut door's block)
          if (dy > tol) flag('feet sink', drawn.owner(hd.faceIndex), _p, dy);
          else if (dy < -tol) flag('feet hover', drawn.owner(hd.faceIndex), _p, -dy);
        } else {
          _d.set(_n.x, 0, _n.z).normalize();
          // the outside: the side a ray from 2 m out meets first
          _o.copy(_p).addScaledVector(_d, OUT);
          let hc = first(coll, _o, _d.clone().negate(), OUT + 0.4);
          if (!hc || hc.point.distanceTo(_p) > 0.05) {
            _d.negate();
            _o.copy(_p).addScaledVector(_d, OUT);
            hc = first(coll, _o, _d.clone().negate(), OUT + 0.4);
            if (!hc || hc.point.distanceTo(_p) > 0.05) continue;   // (behind something else)
          }
          // (only where the traveller hangs: above step height off the floor in front, which he steps onto, and the terrain's)
          _o.copy(_p).addScaledVector(_d, 0.6);
          if (_p.y - physics.groundAt(_o.x, _p.y + 0.1, _o.z, 50) < 0.6) continue;
          _o.copy(_p).addScaledVector(_d, OUT);
          checked.wall++;
          const hd = first(drawn.bvh, _o, _d.clone().negate(), OUT + 0.6);
          let gap = hd ? hd.distance - OUT : 0.6;   // (+: the drawn surface lies behind the collision)
          if (gap > tol) {
            // (or the climber's side is itself inside the drawn rock, the stand-in deeper than OUT: the way out
            // along the normal leaves through the back of a drawn face)
            const ho = first(drawn.bvh, _o, _d, 3);
            if (ho && ho.face.normal.dot(_d) > 0) gap = -(OUT + ho.distance);
          }
          if (gap < -tol) flag('climbs inside', drawn.owner((hd && hd.distance < OUT ? hd : first(drawn.bvh, _o, _d, 3)).faceIndex), _p, -gap);
          else if (gap > tol) flag('climbs off', hd ? drawn.owner(hd.faceIndex) : 'collision with nothing drawn', _p, gap);
        }
      }
    }
  }
  // ---- the other way round: a drawn surface you would walk through
  // The tops above are sampled on the *collision*, so a thing drawn with no collision of its own over
  // open ground (a root over the sand, a trim on a roof with no proxy) is never sampled at all. Here the
  // walkable faces of the drawn surfaces are sampled instead, and the ground under each (the collision
  // and the heightfield): a drawn top more than `tol` over it is one the feet pass through.
  if (walk) {
    const dgeo = drawn.bvh.geometry, dpos = dgeo.attributes.position;
    const dfaces = [];
    let darea = 0;
    for (let f = 0; f < dpos.count / 3; f++) {
      _a.fromBufferAttribute(dpos, 3 * f); _b.fromBufferAttribute(dpos, 3 * f + 1); _c.fromBufferAttribute(dpos, 3 * f + 2);
      _n.subVectors(_c, _b).cross(_d.subVectors(_a, _b));
      const ar = _n.length() / 2;
      if (ar < 1e-3 || _n.y / (2 * ar) < 0.7) continue;   // (only what is drawn facing up: a face you could stand on)
      if (region && !region(_p.copy(_a).add(_b).add(_c).divideScalar(3))) continue;
      dfaces.push(f, ar);
      darea += ar;
    }
    const density = Math.min(1 / (cell * cell), max / Math.max(darea, 1e-6));
    for (let i = 0; i < dfaces.length; i += 2) {
      const f = dfaces[i], ar = dfaces[i + 1];
      const want = ar * density, k = Math.floor(want) + (rnd() < want - Math.floor(want) ? 1 : 0);
      if (!k) continue;
      _a.fromBufferAttribute(dpos, 3 * f); _b.fromBufferAttribute(dpos, 3 * f + 1); _c.fromBufferAttribute(dpos, 3 * f + 2);
      for (let j = 0; j < k; j++) {
        let u = rnd(), v = rnd();
        if (u + v > 1) { u = 1 - u; v = 1 - v; }
        _p.copy(_a).multiplyScalar(1 - u - v).addScaledVector(_b, u).addScaledVector(_c, v);
        if (region && !region(_p)) continue;
        // (buried: the ground already stands over what is drawn here, so no one walks on it)
        if (physics.base && physics.base.heightAt(_p.x, _p.z) > _p.y - tol) continue;
        _o.set(_p.x, _p.y + 0.05, _p.z);
        if (physics.embedded(_o)) continue;     // (inside a solid: a face drawn inside the collision, not stood on)
        // (and nothing drawn right over it: the underside of a stack, a floor under a table, is not walked on)
        if (first(drawn.bvh, _o, UP, 2)) continue;
        checked.walk++;
        const g = physics.groundAt(_p.x, _p.y + 0.05, _p.z, WALK + 0.05);
        const dy = _p.y - g;
        // (further than WALK over anything solid it is not a floor anyone stands on but a thing in the air:
        // a cloud, a hanging city, a lamp; those are not walked through, they are flown past)
        if (dy > tol && dy <= WALK) flag('walks through', drawn.ownerFace(f), _p, dy);
      }
    }
  }

  // the moving solids: their drawn top over the disc against the solid's top
  const rc = new THREE.Raycaster();
  for (const v of solids) {
    const d = v?.solid, objs = solidObjects([v]);
    if (!d || !objs.length || !Number.isFinite(d.top)) continue;
    checked.carrier++;
    const name = v.id ?? v.constructor?.name ?? 'moving solid';
    // (round the middle; a level disc, a riding floor, out to its rim: a car's roof or a ball is only a disc in the middle)
    const rings = d.flat ? [0.45, 0.93] : [0.35];
    for (const [f, a] of [[0, 0], ...rings.flatMap((f) => Array.from({ length: 8 }, (_, i) => [f, (i / 8) * Math.PI * 2]))]) {
      _o.set(d.pos.x + Math.cos(a) * d.r * f, d.top + 1.5, d.pos.z + Math.sin(a) * d.r * f);
      rc.set(_o, DOWN); rc.far = 3;
      const hit = rc.intersectObjects(objs, true).find((h) => h.object.isMesh && shown(h.object));
      if (!hit) continue;
      const dy = hit.point.y - d.top;
      if (dy > tol) flag('carrier sinks', name, hit.point, dy);
      else if (dy < -tol) flag('carrier hovers', name, hit.point, -dy);
    }
  }
  return { checked, counts, groups: [...groups.values()].sort((a, b) => b.max * Math.sqrt(b.n) - a.max * Math.sqrt(a.n)), worst };
}

/** A few lines for the console or a test's message. */
export function formatContact(r, { top = 15 } = {}) {
  const lines = [`checked tops ${r.checked.top}, walls ${r.checked.wall}, drawn tops ${r.checked.walk ?? 0}, carriers ${r.checked.carrier}; ` + (Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing off')];
  for (const g of r.groups.slice(0, top)) lines.push(`  ${g.issue.padEnd(14)} ${String(g.n).padStart(5)} × up to ${g.max.toFixed(2)} m  ${g.name}  at ${g.at.join(', ')}`);
  return lines.join('\n');
}
