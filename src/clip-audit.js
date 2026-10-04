import * as THREE from 'three';
import { CROWD_POSES } from './crowd-shader.js';
import { geoBox } from './physics.js';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The clipping audit: what sinks into the ground, floats above it, or stands
// in a wall. A dev tool (window.clipAudit() in the running game, and
// tests/clip-audit.test.js on the worlds that build in node):
//
//   auditClipping({ physics, scene, npcs, crowd, relics, boxes, things, exclude })
//     → { checked: { npc: n, … }, offenders: [{ kind, name, at, issue, by }], counts: { kind: n } }
//
// - people (story NPCs, crowd people): feet on the ground (not sunk, not
//   hovering), the body capsule out of walls, not inside a solid;
// - boxes: every corner of the footprint on the ground (a box on a slope
//   floats at one corner and sinks at another);
// - relics: the shard not in a wall;
// - things you look at: the point not buried in solid geometry;
// - props (every small object in the scene, a unit being the largest group
//   under 25 m across): resting on something (a thin slab just outside each
//   face of its box must touch some geometry, the terrain, or another prop),
//   not wholly buried, and, for the ones you walk through (plants, flags:
//   userData.noCollide), not standing inside a building.
//   userData.floats = true marks a prop that is meant to hang in the air.

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _p = new THREE.Vector3();
const _box = new THREE.Box3(), _slab = new THREE.Box3(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const r2 = (v) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
const excluded = (o) => { for (let x = o; x; x = x.parent) if (x.userData?.noCollide) return true; return false; };
const shown = (o) => { for (let x = o; x; x = x.parent) if (x.visible === false) return false; return true; };

/** Surface just under (x, fromY, z), the level only (no box colliders, no ship), or -Infinity. */
function groundBelow(physics, x, fromY, z, drop = 8) {
  const keep = physics.bvh;
  if (physics.levelBVH !== undefined) physics.bvh = physics.levelBVH;
  try { return physics.groundAt(x, fromY, z, drop); } finally { physics.bvh = keep; }
}

/** Does any collision triangle cross this box? */
function touches(physics, box) {
  if (!physics.bvh) return false;
  let hit = false;
  physics.bvh.shapecast({
    intersectsBounds: (b) => !hit && b.intersectsBox(box),
    intersectsTriangle: (tri) => { if (box.intersectsTriangle(tri)) { hit = true; return true; } return false; },
  });
  return hit;
}

export function auditClipping({ physics, scene = null, npcs = [], crowd = null, relics = null, boxes = null, things = [], exclude = [], roots = null, maxProps = 20000 } = {}) {
  const offenders = [], checked = {};
  const flag = (kind, name, at, issue, by = 0) => offenders.push({ kind, name, at: r2(at), issue, by: +by.toFixed(2) });
  const count = (k) => { checked[k] = (checked[k] ?? 0) + 1; };

  // ------------------------------------------------------------------ people
  const person = (kind, name, pos, { seated = false, pose = null, r = 0.28 } = {}) => {
    count(kind);
    if (!seated && pose !== 'sit' && pose !== 'kerb') {
      const g = physics.groundAt(pos.x, pos.y + 1.2, pos.z, 4);
      if (!Number.isFinite(g)) flag(kind, name, pos, 'no ground under the feet');
      else if (pos.y - g > 0.12) flag(kind, name, pos, 'hovers above the ground', pos.y - g);
      else if (g - pos.y > 0.15) flag(kind, name, pos, 'feet sunk into the ground', g - pos.y);
    }
    if (physics.embedded(_v.copy(pos).addScaledVector(UP, 1.1))) { flag(kind, name, pos, 'inside a solid'); return; }
    if (pose === 'wall' || pose === 'rail') return;   // (leaning on it, on purpose)
    const probe = _w.copy(pos), push = physics.pushCapsule(probe, r, seated ? 0.5 : 0.35, 1.7, _p);
    if (push && push.length() > 0.08) flag(kind, name, pos, 'body in a wall', push.length());
  };
  for (const n of npcs) {
    if (!n?.pos || !n.def) continue;   // (the crowd's pooled puppets are checked as crowd people)
    person('npc', n.def?.id ?? n.def?.name ?? 'npc', n.pos, { seated: !!n.seat, r: 0.3 * (n.object?.scale?.x ?? 1) });
  }
  if (crowd) {
    const names = Object.fromEntries(Object.entries(CROWD_POSES).map(([k, v]) => [v, k]));
    for (const p of crowd.people ?? []) {
      // (walkers are checked where they stand now; the rest at home)
      const pose = names[p.pose] ?? null;
      person('crowd', `${p.role ?? (typeof p.spot === 'string' ? p.spot : 'crowd')} #${p.id}`, p.walk ? p.pos : p.home ?? p.pos, { pose, r: 0.24 * (p.scale ?? 1) });
    }
  }

  // ------------------------------------------------------------------ relics, boxes, things
  for (const it of relics?.items ?? []) {
    count('relic');
    if (solid(physics, it.pos)) flag('relic', `relic ${it.i}`, it.pos, 'inside a solid');
    else { const pr = _w.copy(it.pos), push = physics.pushCapsule(pr, 0.35, -0.5, 0.5, _p); if (push && push.length() > 0.1) flag('relic', `relic ${it.i}`, it.pos, 'in a wall', push.length()); }
  }
  for (const b of boxes?.list ?? []) {
    count('box');
    if (b.place?.lift) continue;   // (set above its ground on purpose: a roof whose collision lies under its tiles)
    const S = b.parts?.root?.scale?.x ?? 1, hw = 0.4 * S, hd = 0.275 * S, c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0);
    let up = 0, down = 0;
    for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, 0]]) {
      const x = b.pos.x + lx * c + lz * s, z = b.pos.z - lx * s + lz * c;
      const g = groundBelow(physics, x, b.pos.y + 1.2, z, 4);
      if (!Number.isFinite(g)) { up = Math.max(up, 1); continue; }
      up = Math.max(up, b.pos.y - g); down = Math.max(down, g - b.pos.y);
    }
    if (up > 0.12) flag('box', b.id, b.pos, 'a corner floats', up);
    if (down > 0.22) flag('box', b.id, b.pos, 'a corner sinks into the ground', down);   // (a box on a slope sits a little low on purpose)
  }
  for (const t of things) {
    const at = typeof t.at === 'function' ? t.at() : t.at;
    if (!at) continue;
    count('thing');
    if (solid(physics, at)) flag('thing', t.id, at, 'the point to look at is inside a solid');
  }

  // ------------------------------------------------------------------ props
  if (scene) auditProps(physics, scene, { exclude, roots, maxProps, flag, count });
  const counts = {};
  for (const o of offenders) counts[o.kind] = (counts[o.kind] ?? 0) + 1;
  return { checked, counts, offenders };
}

/** The scene's small objects: [{ name, box, free (walk-through), obj }]. */
export function propUnits(scene, { exclude = [], roots = null, maxSize = 25, maxProps = 20000 } = {}) {
  scene.updateMatrixWorld(true);
  const skip = new Set(exclude.filter(Boolean));
  const boxOf = new Map();
  const size = (o) => {
    if (boxOf.has(o)) return boxOf.get(o);
    const b = new THREE.Box3().setFromObject(o);
    boxOf.set(o, b);
    return b;
  };
  const big = (b) => b.isEmpty() || Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) > maxSize;
  const units = new Map();
  const out = [];
  const visit = (o) => {
    if (out.length >= maxProps) return;
    if (!o.isMesh || o.isSkinnedMesh || o.isPoints || o.isLine || o.isSprite) return;
    for (let x = o; x; x = x.parent) if (skip.has(x)) return;
    if (!shown(o) || o.material?.visible === false) return;
    // effects: smoke, flames, glows, motes (see-through, nothing to rest on)
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (mat && (mat.transparent || mat.depthWrite === false || mat.blending === THREE.AdditiveBlending)) return;
    // (moving things: flames, sparks, smoke puffs, anything animated per frame)
    if (o.userData.dynamic || (o.isInstancedMesh && o.instanceMatrix.usage === THREE.DynamicDrawUsage)) return;
    if (o.isInstancedMesh) {
      const gbox = geoBox(o.geometry);
      const step = Math.max(1, Math.ceil(o.count / 400));
      for (let i = 0; i < o.count; i += step) {
        o.getMatrixAt(i, _m); _m.premultiply(o.matrixWorld);
        const b = gbox.clone().applyMatrix4(_m);
        if (big(b) || tiny(b)) continue;
        const e = _m.elements;
        out.push({ name: `${nameOf(o)}[${i}]`, box: b, free: excluded(o), obj: o, i, upright: e[5] / Math.hypot(e[4], e[5], e[6]) > 0.95 });
      }
      return;
    }
    // climb to the largest ancestor that is still a small thing (a lamp, not the street)
    let u = o;
    if (big(size(o))) return;
    while (u.parent && u.parent !== scene && !u.parent.isScene && !big(size(u.parent))) u = u.parent;
    if (units.has(u)) return;
    units.set(u, true);
    const b = size(u);
    if (tiny(b)) return;   // decals, painted lines, motes
    out.push({ name: nameOf(u), box: b, free: excluded(u), obj: u });
  };
  for (const r of roots ?? [scene]) r.traverse(visit);
  return out;
}

function nameOf(o) {
  const parts = [];
  for (let x = o; x && !x.isScene && parts.length < 3; x = x.parent) if (x.name) parts.unshift(x.name);
  return parts.join(' / ') || o.geometry?.type || o.type;
}

/**
 * Everything drawn, the walk-through decoration too (moss pads, plants, a
 * hanging city's roof), as one BVH: what a prop may rest on. (Lots of grass
 * is left out: a prop on a lawn rests on the lawn's own ground anyway.)
 */
export function drawnBVH(scene, { exclude = [], roots = null, maxInstances = 3000 } = {}) {
  scene.updateMatrixWorld(true);
  const skip = new Set(exclude.filter(Boolean)), geos = [];
  const add = (geo, m) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.attributes.position);
    if (geo.index) g.setIndex(geo.index);
    const w = g.applyMatrix4(m);
    geos.push(w.index ? w.toNonIndexed() : w);
  };
  for (const r of roots ?? [scene]) r.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry?.attributes?.position) return;
    for (let x = o; x; x = x.parent) if (skip.has(x)) return;
    if (!shown(o) || o.userData.dynamic || (o.isInstancedMesh && o.instanceMatrix.usage === THREE.DynamicDrawUsage)) return;
    if (o.isInstancedMesh) {
      if (o.count > maxInstances) return;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, _m); _m.premultiply(o.matrixWorld); add(o.geometry.clone(), _m.clone()); }
    } else add(o.geometry.clone(), o.matrixWorld);
  });
  if (!geos.length) return null;
  const geometry = mergeGeometries(geos.map((g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); return g; }));
  return new MeshBVH(geometry);
}

function auditProps(physics, scene, { exclude, roots, maxProps, flag, count }) {
  const units = propUnits(scene, { exclude, roots, maxProps });
  const drawn = drawnBVH(scene, { exclude, roots });
  const touchesDrawn = (box) => !!drawn && touches({ bvh: drawn }, box);
  // a coarse grid of the units' boxes, so a prop resting on another (a pot on a crate) counts as held
  const cell = 4, grid = new Map(), key = (x, z) => `${x},${z}`;
  units.forEach((u, i) => {
    for (let x = Math.floor(u.box.min.x / cell); x <= Math.floor(u.box.max.x / cell); x++)
      for (let z = Math.floor(u.box.min.z / cell); z <= Math.floor(u.box.max.z / cell); z++) {
        const k = key(x, z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i);
      }
  });
  const near = (i, box) => {
    const seen = new Set();
    for (let x = Math.floor(box.min.x / cell); x <= Math.floor(box.max.x / cell); x++)
      for (let z = Math.floor(box.min.z / cell); z <= Math.floor(box.max.z / cell); z++)
        for (const j of grid.get(key(x, z)) ?? []) if (j !== i && !seen.has(j)) { seen.add(j); if (units[j].box.intersectsBox(box)) return true; }
    return false;
  };
  const base = physics.base;
  units.forEach((u, i) => {
    if (floats(u.obj)) return;
    count('prop');
    const b = u.box, c = b.getCenter(_v);
    // wholly under the terrain
    if (base) {
      const h = base.heightAt(c.x, c.z);
      if (b.max.y < h - 0.05) { flag('prop', u.name, c, 'buried under the ground', h - b.max.y); return; }
    }
    // held by something: a slab just outside the box's faces touches geometry, the terrain, or another prop
    const g = 0.02, t = 0.12;
    const slabs = [
      [b.min.x, b.min.y - g - t, b.min.z, b.max.x, b.min.y - g, b.max.z],   // below
      [b.min.x, b.max.y + g, b.min.z, b.max.x, b.max.y + g + t, b.max.z],   // above (hanging)
      [b.min.x - g - t, b.min.y, b.min.z, b.min.x - g, b.max.y, b.max.z],
      [b.max.x + g, b.min.y, b.min.z, b.max.x + g + t, b.max.y, b.max.z],
      [b.min.x, b.min.y, b.min.z - g - t, b.max.x, b.max.y, b.min.z - g],
      [b.min.x, b.min.y, b.max.z + g, b.max.x, b.max.y, b.max.z + g + t],
    ];
    let held = false;
    if (base) for (const [x, z] of [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.min.x, b.max.z], [b.max.x, b.max.z]]) if (base.heightAt(x, z) > b.min.y - 0.15) { held = true; break; }
    for (const s of slabs) { if (held) break; _slab.min.set(s[0], s[1], s[2]); _slab.max.set(s[3], s[4], s[5]); held = touches(physics, _slab) || touchesDrawn(_slab); }
    // (a walk-through thing is not in the collision BVH itself: standing flush on a floor, the floor is just under its base)
    if (!held && u.free) { _slab.min.set(b.min.x, b.min.y - 0.12, b.min.z); _slab.max.set(b.max.x, b.min.y + 0.03, b.max.z); held = touches(physics, _slab); }
    if (!held) { _box.copy(b).expandByScalar(0.06); held = near(i, _box); }
    if (!held) {
      const under = groundBelow(physics, c.x, b.min.y - 0.01, c.z, 200);
      flag('prop', u.name, c, 'floats', Number.isFinite(under) ? b.min.y - under : 99);
      return;
    }
    // something you walk through standing inside a building
    // (a post or a trunk by its middle: a tree through a wall; anything else only when wholly inside, not a rock half sunk in a slope)
    if (!u.free) return;
    if (u.i !== undefined && !u.upright) {
      // a leaning blade, a tumbled rock: by its own axis, root to tip, not by its box
      const gb = geoBox(u.obj.geometry), x = (gb.min.x + gb.max.x) / 2, z = (gb.min.z + gb.max.z) / 2, gh = gb.max.y - gb.min.y;
      u.obj.getMatrixAt(u.i, _m); _m.premultiply(u.obj.matrixWorld);
      const buried = [0.35, 0.65, 0.95].every((f) => solid(physics, _w.set(x, gb.min.y + gh * f, z).applyMatrix4(_m)));
      if (buried && !ownSolid(physics, c, b)) flag('prop', u.name, c, 'stands inside a solid');
      return;
    }
    const h = b.max.y - b.min.y, trunk = h > 1.2 && h > 1.8 * Math.max(b.max.x - b.min.x, b.max.z - b.min.z);   // (a post, a trunk)
    if (solid(physics, _w.set(c.x, c.y, c.z)) && (trunk || solid(physics, _w.set(c.x, b.max.y - 0.08, c.z))) && !ownSolid(physics, c, b)) flag('prop', u.name, c, 'stands inside a solid');
  });
}

/** Too small to matter: a decal or a painted line (flat), a firefly or a mote (under 12 cm). */
const tiny = (b) => b.max.y - b.min.y < 0.02 || Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) < 0.12;
/** Inside something solid, for sure (physics.buried: the faces' sides and the count of them agree). */
const solid = (physics, p) => (physics.buried ?? physics.embedded).call(physics, p);
const floats = (o) => { for (let x = o; x; x = x.parent) if (x.userData?.floats) return true; return false; };

const SIDES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
const _own = new THREE.Box3();
/** Is the solid around p the prop's own collider (an invisible trunk inside a drawn tree)? Its walls are all within the prop's box. */
function ownSolid(physics, p, box) {
  _own.copy(box).expandByScalar(0.15);
  for (const d of SIDES) {
    const h = physics.rayHit(p, d, 60);
    if (!h || !_own.containsPoint(h.point)) return false;
  }
  return true;
}

/** A short text report: counts, then the worst offenders of each kind. */
export function formatAudit(r, { top = 12 } = {}) {
  const lines = [`checked ${Object.entries(r.checked).map(([k, n]) => `${k} ${n}`).join(', ')}`, `offenders ${Object.entries(r.counts).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}`];
  const byKind = {};
  for (const o of r.offenders) (byKind[o.kind] ??= []).push(o);
  for (const [k, list] of Object.entries(byKind)) {
    list.sort((a, b) => b.by - a.by);
    lines.push(`-- ${k}`);
    for (const o of list.slice(0, top)) lines.push(`  ${o.issue}${o.by ? ` (${o.by} m)` : ''}: ${o.name} at ${o.at.join(', ')}`);
    if (list.length > top) lines.push(`  … and ${list.length - top} more`);
  }
  return lines.join('\n');
}
