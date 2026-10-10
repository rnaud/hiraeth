import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';
import { SandDrifts } from './sand-drifts.js';
import { mulberry32 } from './noise.js';
import { wallOpenings } from './wall-openings.js';
import { STORY, processionLoop } from './desert-sites.js';
import { cityFloor } from './desert-landmarks.js';
import { Banner } from './life.js';
import { Flames, FlameBody, Embers, Smoke, SmokeColumn, FIRE, COOL_FIRE } from './story/flames.js';
import { registerHazard, flameHazard, HAZARD_DPS } from './hazards.js';
import { magicMaterial, magicPool, magicStream } from './story/magic-water.js';
import { hiddenWriting, ghostPath } from './gadgets/hidden.js';

// The desert's story places (references/levels/The Desert/environment/IMG_3772-3775: pale rose domes,
// cream walls, bone, flat sky):
//   the old city of Qanat   a walled ring of domes and tower-houses laid
//                           round a paved square, the burning tree rooted
//                           in its middle; the dry well at its roots and a
//                           carved stele
//   the camps               tents, fires, banners and log benches outside
//                           the main gate, where the pilgrims wait
//   the fallen giant        its skull outside the back gate (the way down),
//                           an arm reaching out of the sand
//   the cave                the giant's chest under the city, built far
//                           overhead: a pool of shifting water, the tree's
//                           roots hanging into it, the channel blocked by a
//                           fallen rib
// Render meshes are merged per material and never collide; collision comes
// from coarse hidden proxies (like desert-landmarks.js).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/**
 * The keepers' way up (level design audit, third round): in the giant's chest a stair of stone blocks climbs from the
 * floor behind the pool to a doorway in the dome's far wall (`stair`: local z of its foot and of the ledge, the ledge's
 * height), and comes out under a hatch in Qanat's back lane (`z`: city-local, on the back lane's axis). One way: the
 * hatch only lifts from below.
 */
export const HATCH = { z: -42, stair: { foot: -17.5, ledge: -25.6, door: -28.4, y: 3.0 } };
const UP = V(0, 1, 0);
const PROXY = makeMaterial({ color: '#ff00ff' });
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

function prep(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  return geo;
}
/** rotate (XYZ Euler), scale, then move, in place */
function T(geo, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  return geo.applyMatrix4(_m.compose(V(...p), _q, typeof s === 'number' ? V(s, s, s) : V(...s)));
}
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg);
/** A dome's collider: the same half-sphere, coarser (you walk on the roofs; they were hollow). */
const domeSolid = (r, at, sy = 1) => T(new THREE.SphereGeometry(r, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2), at, [0, 0, 0], [1, sy, 1]);
const dome = (r, seg = 16, rings = 6) => new THREE.SphereGeometry(r, Math.max(seg, 16), Math.max(rings, 9), 0, Math.PI * 2, 0, Math.PI / 2);

/**
 * A tube whose radius tapers from r0 to r1 along the curve: a closed solid, its faces
 * turned outward, each end shut by a low rounded cap (they used to be inside out and open,
 * so you saw into the tree's roots and limbs, and through them).
 */
export function taper(points, r0, r1, seg = 16, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(seg, false);
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, c = curve.getPointAt(u), r = THREE.MathUtils.lerp(r0, r1, u);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      // (the seam's last vertex is the first one again, exactly, so the tube welds shut)
      const a = (j % radial) / radial * Math.PI * 2;
      pos.push(c.x + (Math.cos(a) * N.x + Math.sin(a) * B.x) * r, c.y + (Math.cos(a) * N.y + Math.sin(a) * B.y) * r, c.z + (Math.cos(a) * N.z + Math.sin(a) * B.z) * r);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // the caps: a fan from a point a little beyond each end, along the curve
  for (const [i, r, sgn] of [[0, r0, -1], [seg, r1, 1]]) {
    const c = curve.getPointAt(i / seg).addScaledVector(frames.tangents[i], sgn * r * 0.45), k = pos.length / 3, ring = i * (radial + 1);
    pos.push(c.x, c.y, c.z);
    for (let j = 0; j < radial; j++) idx.push(...(sgn > 0 ? [k, ring + j, ring + j + 1] : [k, ring + j + 1, ring + j]));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Inside-out: for rooms you stand in (the cave's dome). */
function inward(g) {
  const geo = g.index ? g : g.toNonIndexed();
  const ix = geo.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  geo.computeVertexNormals();
  return geo;
}

/** Drop the triangles whose centre passes the test (an opening in a wall). */
function cut(g, test) {
  const geo = g.index ? g.toNonIndexed() : g, p = geo.attributes.position.array, keep = [];
  for (let i = 0; i < p.length; i += 9) {
    const cx = (p[i] + p[i + 3] + p[i + 6]) / 3, cy = (p[i + 1] + p[i + 4] + p[i + 7]) / 3, cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
    if (!test(cx, cy, cz)) for (let k = 0; k < 9; k++) keep.push(p[i + k]);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  out.computeVertexNormals();
  return out;
}

/** cut(), keeping the smooth normals the geometry had (a hole in smooth bone shows no facets). */
function trim(g, test) {
  if (!g.attributes.normal) g.computeVertexNormals();
  const geo = g.index ? g.toNonIndexed() : g, p = geo.attributes.position.array, n = geo.attributes.normal.array, kp = [], kn = [];
  for (let i = 0; i < p.length; i += 9) {
    const cx = (p[i] + p[i + 3] + p[i + 6]) / 3, cy = (p[i + 1] + p[i + 4] + p[i + 7]) / 3, cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
    if (!test(cx, cy, cz)) for (let k = 0; k < 9; k++) { kp.push(p[i + k]); kn.push(n[i + k]); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(kp, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(kn, 3));
  return out;
}

/**
 * A flat band along a curve lying in a plane (a rib of the giant's chest): an elliptical section, `w` wide across
 * the plane (along `axis`, its normal) and `t` thick within it. Open ends (they stand in the floor).
 */
export function band(points, w, t, seg = 24, radial = 6, axis = V(0, 0, 1)) {
  const curve = new THREE.CatmullRomCurve3(points), pos = [], idx = [], T0 = V(0, 0, 0), N = V(0, 0, 0);
  for (let i = 0; i <= seg; i++) {
    const u = i / seg, c = curve.getPointAt(u);
    curve.getTangentAt(u, T0);
    N.crossVectors(T0, axis).normalize();
    for (let j = 0; j <= radial; j++) {
      const a = (j % radial) / radial * Math.PI * 2;
      pos.push(c.x + axis.x * w * Math.cos(a) + N.x * t * Math.sin(a), c.y + axis.y * w * Math.cos(a) + N.y * t * Math.sin(a), c.z + axis.z * w * Math.cos(a) + N.z * t * Math.sin(a));
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A thick arch running along z (the skull's mouth, its tunnel): an inner face toward the axis (you walk under it),
 * an outer face, and the front lip at z1. Angles a0..a1 from +x, counter-clockwise; centre height yc.
 */
function archShell(ri, ro, yc, z0, z1, a0, a1, seg = 18) {
  const pos = [], idx = [];
  const ring = (r, z) => { const k = pos.length / 3; for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; pos.push(Math.cos(a) * r, yc + Math.sin(a) * r, z); } return k; };
  const quad = (A, B, flip) => { for (let i = 0; i < seg; i++) { const a = A + i, b = B + i; if (flip) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1); } };
  const i0 = ring(ri, z0), i1 = ring(ri, z1), o0 = ring(ro, z0), o1 = ring(ro, z1), fi = ring(ri, z1), fo = ring(ro, z1);
  quad(i0, i1, false); quad(o0, o1, true); quad(fi, fo, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Wobble a geometry's vertices by a smooth pseudo-noise (rough stone). */
export function rough(g, amount, freq = 0.3, seed = 0) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * freq + seed) * Math.cos(z * freq * 1.3 - seed) + Math.sin(y * freq * 1.7 + x * 0.5 * freq + seed * 2) * 0.6;
    const l = Math.hypot(x, z) || 1;
    // (a dome's foot ring, y = 0, only ever goes down: lifted, it opened a slit between the floor and the wall
    // that the sun shone through, a lit seam round the cave's floor; down, it stands in the floor)
    const dy = n * amount * 0.3;
    p.setXYZ(i, x + (x / l) * n * amount, y + (Math.abs(y) < 0.01 ? -Math.abs(dy) : dy), z + (z / l) * n * amount);
  }
  g.computeVertexNormals();
  return g;
}

/** Turn a closed indexed solid's faces outward if they were wound inward (its signed volume). */
function outward(g) {
  const p = g.attributes.position, ix = g.index.array, a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0);
  let vol = 0;
  for (let i = 0; i < ix.length; i += 3) { a.fromBufferAttribute(p, ix[i]); b.fromBufferAttribute(p, ix[i + 1]); c.fromBufferAttribute(p, ix[i + 2]); vol += a.dot(b.cross(c)); }
  if (vol < 0) for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  g.computeVertexNormals();
  return g;
}

/** A round strut from a to b (a brace). */
function strut(a, b, r) {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
  return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

/** The cool fire's colours in the tree's leaves (the drinking's fire: violet most, streaks of teal and rose, gold at the heart). */
export const LEAF_FIRE = { violet: ['#8c6ddc', '#a07fea', '#7c62d0'], teal: '#58c4c2', rose: '#e88bbd', gold: '#ffc65a' };
/**
 * The burning crown: soft masses of leaf-fire round each branch tip, one mesh coloured per vertex, relative to `pivot`
 * (the mesh is scaled about it as the fire catches). Each mass is violet, dappled with teal and rose by a slow noise
 * over the crown, and burns gold underneath and toward the heart, where the branches carry the fire.
 */
function fireLeaves(tips, pivot, rand) {
  const parts = [], c = new THREE.Color(), gold = new THREE.Color(LEAF_FIRE.gold), teal = new THREE.Color(LEAF_FIRE.teal), rose = new THREE.Color(LEAF_FIRE.rose);
  const violet = LEAF_FIRE.violet.map((x) => new THREE.Color(x));
  for (const tip of tips) {
    const n = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const r = 3.4 + rand() * 2.4, out = V(tip.x - pivot.x, 0, tip.z - pivot.z).normalize();
      const at = tip.clone().add(V((rand() - 0.5) * 6, (rand() - 0.2) * 3, (rand() - 0.5) * 6)).addScaledVector(out, rand() * 2);
      let g = mergeVertices(new THREE.IcosahedronGeometry(1, 1));
      g.scale(r * (0.9 + rand() * 0.4), r * (0.5 + rand() * 0.15), r * (0.9 + rand() * 0.4));
      g.rotateY(rand() * Math.PI);
      { const p = g.attributes.position;   // (lumpy, not round)
        for (let j = 0; j < p.count; j++) { const x = p.getX(j), y = p.getY(j), z = p.getZ(j), k = 1 + 0.16 * Math.sin(x * 1.3 + z * 0.9) * Math.cos(y * 1.7 - x * 0.5); p.setXYZ(j, x * k, y * k, z * k); } }
      g.translate(at.x - pivot.x, at.y - pivot.y, at.z - pivot.z);
      g.computeVertexNormals();
      g = g.toNonIndexed();
      g.deleteAttribute('uv');
      const base = violet[Math.floor(rand() * violet.length)], p = g.attributes.position, k = p.count, a = new Float32Array(k * 3);
      for (let j = 0; j < k; j++) {
        const x = p.getX(j), y = p.getY(j), z = p.getZ(j);
        const t = Math.sin(x * 0.33 + y * 0.5) * Math.cos(z * 0.29 - y * 0.21) + 0.35 * Math.sin(x * 0.9 - z * 0.7);
        c.copy(base);
        if (t > 0.62) c.lerp(teal, 0.85); else if (t < -0.78) c.lerp(rose, 0.7);
        const under = THREE.MathUtils.clamp((at.y - pivot.y - y) / r * 0.5 + 0.5, 0, 1);   // (below the mass's middle)
        const heart = THREE.MathUtils.clamp(1 - Math.hypot(x, z) / 11, 0, 1);
        c.lerp(gold, THREE.MathUtils.clamp(0.8 * under ** 3 + 0.5 * heart, 0, 0.85));
        a[j * 3] = c.r; a[j * 3 + 1] = c.g; a[j * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      parts.push(g);
    }
  }
  return mergeGeometries(parts);
}

// Plain colours are "paint": every plain-coloured part of a place is drawn by
// one vertex-coloured mesh (flat or smooth, one- or two-sided), instead of a
// mesh per colour. The textured materials (strata, grids, glows) batch by
// material as usual.
const PAINT = {};
const paintMaterial = (smooth, side) => PAINT[`${smooth}${side}`] ??= makeMaterial({ color: '#ffffff', vertexColors: true, ...(smooth ? {} : { flat: true }), ...(side === THREE.DoubleSide ? { side } : {}) });
const paint = (color, { smooth = false, side = THREE.FrontSide } = {}) => ({ paint: new THREE.Color(color), smooth, side });
function painted(geo, c) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/** A place with its own frame: batched render meshes and hidden colliders. */
class Kit {
  constructor(root, name, origin, yaw = 0) {
    this.group = new THREE.Group(); this.group.name = name; root.add(this.group);
    this.origin = origin.clone(); this.yaw = yaw;
    this.frame = new THREE.Matrix4().compose(origin, new THREE.Quaternion().setFromAxisAngle(UP, yaw), V(1, 1, 1));
    this.batches = new Map(); this.proxies = [];
  }
  world(x, y, z) { return V(x, y, z).applyMatrix4(this.frame); }
  local(p) { return p.clone().applyMatrix4(this.frame.clone().invert()); }
  heading(h) { return h + this.yaw; }
  add(mat, geo) {
    let g = prep(geo).applyMatrix4(this.frame);
    if (mat.paint) { g = painted(g, mat.paint); mat = mat.material ?? paintMaterial(mat.smooth, mat.side); }   // (material: a painted part with a material of its own)
    wallOpenings.addGeometry(g, mat);   // (a window, a door: no crack runs through it)
    if (!this.batches.has(mat)) this.batches.set(mat, []);
    this.batches.get(mat).push(g);
    return this;
  }
  solid(geo) { const g = prep(geo).applyMatrix4(this.frame); this.proxies.push(g); SandDrifts.current?.addGeometry(g); return this; }
  // (the copy is taken before add(), which transforms a non-indexed geometry in place: else the proxy is moved twice)
  both(mat, geo, proxy) { const p = proxy ?? geo.clone(); this.add(mat, geo); this.solid(p); return this; }
  flush() {
    const meshes = [];
    for (const [mat, list] of this.batches) {
      const m = new THREE.Mesh(mergeGeometries(list), mat);
      m.userData.noCollide = true; m.name = `${this.group.name} (${list.length})`;
      this.group.add(m); meshes.push(m);
    }
    if (this.proxies.length) {
      const c = new THREE.Mesh(mergeGeometries(this.proxies), PROXY);
      c.visible = false; c.name = `${this.group.name} collision`;
      this.group.add(c);
    }
    this.batches.clear(); this.proxies = [];
    return meshes;
  }
}

// ------------------------------------------------------------------ materials
function materials() {
  return {
    wall: makeMaterial({ color: '#f0d7c3', color2: '#e8c4ae', color3: '#f6e6d6', mode: MODE_STRATA, strataSize: 2.4, flat: true, weathered: true }),
    wallGlyph: makeMaterial({ color: '#efd8c4', color2: '#e3bfa8', color3: '#f6e6d6', mode: MODE_STRATA, strataSize: 1.2, flat: true, grid: 1.4, glyphs: true }),
    paving: makeMaterial({ color: '#e9d6bf', grid: 2.2, flat: true }),
    white: paint('#f6efe0'), pink: paint('#e9a99a'), rose: paint('#dd8f86'), ochre: paint('#e6b86f'), teal: paint('#5fb7ad'), lav: paint('#b7a0cf'),
    // domes are smooth (no facets on the shadow line)
    dWhite: paint('#f6efe0', { smooth: true }), dPink: paint('#e9a99a', { smooth: true }), dRose: paint('#dd8f86', { smooth: true }),
    dTeal: paint('#5fb7ad', { smooth: true }), dLav: paint('#b7a0cf', { smooth: true }), dOchre: paint('#e6b86f', { smooth: true }),
    dark: paint('#34405e'),
    ink: paint('#2b211f'),
    // the great tree's bark: pale lavender grey, as drawn (references/levels/The Desert/places/qanat-tree)
    bark: makeMaterial({ color: '#c4bac8', color2: '#b8aec0', color3: '#cec5d2', mode: MODE_STRATA, strataSize: 5, flat: true, cracks: 1 }),
    barkRoot: makeMaterial({ color: '#c4bac8', color2: '#b8aec0', color3: '#cec5d2', mode: MODE_STRATA, strataSize: 5.01, flat: true, cracks: 1 }),
    // its burning leaves: coloured per vertex, self-lit (the fire glows by its material: no light of its own)
    leaves: makeMaterial({ color: '#ffffff', vertexColors: true, glow: 0.9 }),
    char: paint('#2f2830'),
    bone: paint('#f2ead6', { smooth: true }),
    boneDark: paint('#d9cdb2', { smooth: true }),
    stone: paint('#c9b8a0'),
    stoneDS: paint('#c9b8a0', { side: THREE.DoubleSide }),
    wood: paint('#8a5a3c'),
    rope: paint('#716c70'),
    red: paint('#c8483a'),
    cloth: ['#c8483a', '#5fb7ad', '#d8a24a', '#8a6fb8', '#e6875f', '#f3ead8', '#62c3c9', '#e88fa6'].map((c) => paint(c, { side: THREE.DoubleSide })),
    // the giant's chest (references/levels/The Desert/places/skull-cave): lavender rock between the ribs, a floor of warm sand
    // (both lifted in the shade, the floor keeping its own warm hue there: the cave is lit only through cracks, and the
    // reference's shaded sand stays peach and its rock lavender, never brown-black)
    cave: makeMaterial({ color: '#ab98b6', color2: '#9a88a8', color3: '#bcaac4', mode: MODE_STRATA, strataSize: 1.6, flat: true, shade: 0.35 }),
    caveFloor: makeMaterial({ color: '#e4b48c', color2: '#d8a77e', color3: '#ecc39e', mode: MODE_STRATA, strataSize: 0.6, flat: true, side: THREE.DoubleSide, shade: 0.5, shadeHue: 0.7, hatch: 0.6 }),
    mural: makeMaterial({ color: '#e9dcc0', flat: true, grid: 0.9 }),
    glyph: makeMaterial({ color: '#70e7df', glow: 0.85, flat: true }),
    dry: paint('#5a4a40'),
    boneMesh: makeMaterial({ color: '#f2ead6' }),
  };
}

// ------------------------------------------------------------------ the city
export function buildDesertCity(scene, terrain) {
  const root = new THREE.Group(); root.name = 'Desert story'; scene.add(root);
  const M = materials();
  const lights = [], portals = [], banners = [], smokes = [], updaters = [];
  // (what the level design audit's third round added, the keepers' hatch and stair: put in the scene last, src/levels/desert.js,
  // so the contact audit's samples of everything built before stay where they were)
  const late = new THREE.Group(); late.name = 'Desert story (added in v1.17)';
  const out = { root, lights, portals, banners, sites: {}, seats: [], fires: [], late };
  const rng = mulberry32(3301);
  const floor = cityFloor();

  // ================================================================ Qanat
  const C = STORY.city;
  const city = new Kit(root, 'Old city of Qanat', V(C.x, floor, C.z), C.yaw);
  const R = 64, WALL_H = 9.5, WALL_T = 3;
  const GATE = 0, BACK = Math.PI;   // local angles of the gates (+z main, -z back)
  const angOf = (a) => [Math.sin(a), Math.cos(a)];   // local angle → (x, z): 0 = +z
  {
    // the round wall, in segments, with crenellations and towers
    const N = 30;
    for (let i = 0; i < N; i++) {
      const a = (i + 0.5) / N * Math.PI * 2;
      const dg = Math.abs(Math.atan2(Math.sin(a - GATE), Math.cos(a - GATE))), db = Math.abs(Math.atan2(Math.sin(a - BACK), Math.cos(a - BACK)));
      if (dg < 0.11 || db < 0.07) continue;   // the gates
      const [sx, sz] = angOf(a), L = 2 * Math.PI * R / N * 1.04;
      const seg = new THREE.BoxGeometry(L, WALL_H, WALL_T);
      city.both(M.wall, T(seg, [sx * R, WALL_H / 2 - 1, sz * R], [0, a + Math.PI / 2, 0]));
      // merlons on the outer edge
      for (let k = 0; k < 4; k++) {
        const t = (k + 0.5) / 4 - 0.5;
        const g = new THREE.BoxGeometry(L / 4 * 0.55, 1.3, 0.9);
        T(g, [t * L, WALL_H - 0.35, WALL_T / 2 - 0.45]);
        city.add(M.wall, T(g, [sx * R, 0, sz * R], [0, a + Math.PI / 2 + Math.PI, 0]));
      }
      // little dark loopholes
      if (i % 2 === 0) city.add(M.dark, T(new THREE.BoxGeometry(0.6, 1.4, 0.3), [sx * (R + WALL_T / 2 + 0.05), WALL_H * 0.6, sz * (R + WALL_T / 2 + 0.05)], [0, a, 0]));
    }
    // towers with domes, between the segments
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + 0.31;
      const [sx, sz] = angOf(a), h = 14 + (i % 3) * 2.5;
      const tw = new THREE.CylinderGeometry(3.6, 4, h, 14);
      city.both(M.wall, T(tw, [sx * R, h / 2 - 1, sz * R]), new THREE.CylinderGeometry(3.8, 4, h, 8).translate(sx * R, h / 2 - 1, sz * R));
      city.both(i % 3 === 1 ? M.dTeal : i % 2 ? M.dPink : M.dWhite, T(dome(3.9, 14, 6), [sx * R, h - 1, sz * R], [0, 0, 0], [1, 1.25, 1]), domeSolid(3.86, [sx * R, h - 1, sz * R], 1.25));
      city.add(M.ink, new THREE.CylinderGeometry(0.08, 0.08, 4, 4).translate(sx * R, h + 5.5, sz * R));
      city.add(M.dark, T(new THREE.BoxGeometry(0.7, 1.6, 0.4), [sx * (R + 3.9), h * 0.62, sz * (R + 3.9)], [0, a, 0]));
    }
    // the main gate: two tall pylons, an arch and a carved lintel with the glyph
    const gz = R;
    for (const s of [-1, 1]) {
      city.both(M.wall, new THREE.BoxGeometry(6, 18, 7).translate(s * 8.2, 8, gz));
      city.both(M.dWhite, T(dome(3.2, 12, 5), [s * 8.2, 17, gz], [0, 0, 0], [1, 1.4, 1]), domeSolid(3.17, [s * 8.2, 17, gz], 1.4));
      city.add(M.red, new THREE.BoxGeometry(0.4, 9, 2.2).translate(s * 8.2, 9, gz + 3.55));   // painted bands
    }
    city.both(M.wallGlyph, new THREE.BoxGeometry(22.4, 4.2, 7.4).translate(0, 15, gz), new THREE.BoxGeometry(22.4, 4.2, 7.4).translate(0, 15, gz));
    // the arch on both faces of the gate (each its own: T moves a geometry in place, and a clone of the
    // outer one, moved again, hung the inner arch 15 m up and 64 m out over the camps)
    for (const f of [3.2, -3.2]) city.add(M.wall, T(new THREE.TorusGeometry(5.2, 1.0, 6, 16, Math.PI), [0, 7.8, gz + f]));
    city.add(M.glyph, glyphGeometry(1.6).translate(0, 15, gz + 3.75));
    // for the seeing lens only (src/gadgets/hidden.js): words on the inner face of the west pylon, and a stair
    // of the makers' glass climbing over the avenue onto the lintel, where the gate's own glyph looks out
    {
      const inward = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, C.yaw);
      hiddenWriting(root, city.world(-8.2, 3.6, gz - 3.58), inward, 'THE GIANT\nKEEPS\nTHE POOL', { width: 3.2, id: 'qanat.gate.words', range: 18,
        message: 'Words inside the gate, only for the glass: “The giant keeps the pool.” The well was never dry: its water went down to him.' });
      const stair = [];
      for (let i = 0; i < 12; i++) stair.push(city.world(-3, 1.4 * (i + 1), gz - 23.2 + i * 1.6));
      stair.push(city.world(-3, 17.12, gz - 2.6));
      ghostPath(root, stair, { width: 1.6, depth: 1.5, id: 'qanat.gate.stair' });
    }
    // the back gate, smaller, toward the giant
    for (const s of [-1, 1]) city.both(M.wall, new THREE.BoxGeometry(4, 13, 5).translate(s * 5.4, 5.5, -R));
    city.both(M.wall, new THREE.BoxGeometry(14.8, 3, 5.4).translate(0, 11.5, -R));
    city.add(M.glyph, glyphGeometry(1.0).translate(0, 11.4, -R - 2.75).rotateY(0));
    // the keepers' hatch in the back lane, halfway from the square to the back gate: where the keepers' stair from the
    // giant's chest comes up (level design audit, third round: the walk out of the cave to the well was the way you went
    // down). A kerb of stone round a heavy wooden lid with an iron ring; it only lifts from below
    {
      const HZ = HATCH.z, hk = new Kit(late, 'The keepers’ hatch', V(C.x, floor, C.z), C.yaw);
      for (const [w, d, x, z] of [[2.6, 0.4, 0, HZ - 1.1], [2.6, 0.4, 0, HZ + 1.1], [0.4, 1.8, -1.1, HZ], [0.4, 1.8, 1.1, HZ]]) hk.both(M.wall, new THREE.BoxGeometry(w, 0.34, d).translate(x, 0.17, z));
      hk.both(M.wood, new THREE.BoxGeometry(1.8, 0.14, 1.8).translate(0, 0.25, HZ));
      hk.add(M.ink, new THREE.BoxGeometry(1.84, 0.02, 0.06).translate(0, 0.33, HZ - 0.45)).add(M.ink, new THREE.BoxGeometry(1.84, 0.02, 0.06).translate(0, 0.33, HZ + 0.45));   // its iron straps
      hk.add(M.ink, new THREE.TorusGeometry(0.16, 0.03, 4, 10).rotateX(Math.PI / 2).translate(0, 0.34, HZ));   // the ring
      hk.add(M.glyph, glyphGeometry(0.45).rotateX(-Math.PI / 2).translate(0, 0.35, HZ + 0.62));   // the keepers' eye on the lid
      hk.flush();
      out.hatch = { at: hk.world(0, 0, HZ), out: hk.world(0, 0, HZ + 2.8), look: hk.world(0, 0.3, HZ) };
    }

    // the town's square: the tree stands rooted in its middle, on the ground, no terrace or dais under it (the author's
    // call, October 2026, after the picked reference: references/levels/The Desert/places/qanat-tree/sheet-1.jpg); the
    // houses are laid round it, their doors on the square
    const SQUARE = 23;
    // paving in the avenue and over the square (flush with the ground you walk on: 2 cm proud)
    city.add(M.paving, new THREE.BoxGeometry(11, 0.12, 40).translate(0, -0.04, 45));
    city.add(M.paving, new THREE.CylinderGeometry(SQUARE + 3, SQUARE + 3, 0.1, 40).translate(0, -0.03, 0));

    // houses: domes, cubes and tall tower-houses between the wall and the square
    const HOUSE_MATS = [M.white, M.white, M.pink, M.ochre, M.wall];
    const DOME_MATS = [M.dWhite, M.dPink, M.dRose, M.dTeal, M.dLav, M.dWhite];
    const placed = [];
    const clear = (x, z, r) => {
      if (Math.abs(x) < 7.5 + r && z > 20) return false;          // the avenue to the gate
      if (Math.abs(x) < 5 + r && z < -20) return false;           // the back lane
      if (Math.hypot(x, z) < SQUARE + 1 + r || Math.hypot(x, z) > R - 4 - r) return false;
      return placed.every((p) => Math.hypot(p.x - x, p.z - z) > p.r + r + 2.2);
    };
    for (let tries = 0; tries < 700 && placed.length < 46; tries++) {
      const a = rng() * Math.PI * 2, d = SQUARE + 3 + rng() * 34, x = Math.sin(a) * d, z = Math.cos(a) * d;
      const kind = rng();
      const r = kind < 0.4 ? 3 + rng() * 2.5 : kind < 0.75 ? 3.4 + rng() * 2 : 2.2 + rng() * 1;
      if (!clear(x, z, r)) continue;
      placed.push({ x, z, r });
      const face = Math.atan2(-x, -z);   // doors look toward the tree
      const wm = HOUSE_MATS[Math.floor(rng() * HOUSE_MATS.length)], dm = DOME_MATS[Math.floor(rng() * DOME_MATS.length)];
      const [fx, fz] = [Math.sin(face), Math.cos(face)];
      if (kind < 0.4) {
        // a round house under a dome
        const h = 3 + rng() * 2.5;
        // (the houses are low-poly as drawn: their 8-sided stand-ins lay up to 0.4 m inside them)
        city.both(wm, new THREE.CylinderGeometry(r, r * 1.04, h, 16).translate(x, h / 2, z));
        { const sy = 0.75 + rng() * 0.5; city.both(dm, T(dome(r * 1.02, 16, 6), [x, h, z], [0, 0, 0], [1, sy, 1])); }
        city.add(M.dark, T(new THREE.BoxGeometry(1.3, 2.1, 0.3), [x + fx * r * 0.98, 1.05, z + fz * r * 0.98], [0, face, 0]));
      } else if (kind < 0.75) {
        // a block house, flat roof, a small dome and a parapet
        const h = 3.5 + rng() * 3.5;
        const g = T(new THREE.BoxGeometry(r * 1.7, h, r * 1.7), [x, h / 2, z], [0, face, 0]);
        city.both(wm, g);
        city.both(wm, T(new THREE.BoxGeometry(r * 1.8, 0.5, r * 1.8), [x, h + 0.25, z], [0, face, 0]));   // (the roof slab: you stand on it, not in it)
        if (rng() < 0.7) { const at = [x - fx * r * 0.2, h + 0.4, z - fz * r * 0.2]; city.both(dm, T(dome(r * 0.55, 12, 5), at)); }
        city.add(M.dark, T(new THREE.BoxGeometry(1.2, 2, 0.3), [x + fx * r * 0.86, 1, z + fz * r * 0.86], [0, face, 0]));
        for (const s of [-1, 1]) city.add(M.dark, T(new THREE.BoxGeometry(0.6, 0.8, 0.3), [x + fx * r * 0.86 + fz * s * r * 0.5, h * 0.7, z + fz * r * 0.86 - fx * s * r * 0.5], [0, face, 0]));
      } else {
        // a tower-house: a tall shaft, a bulb and a needle (the reference pages' spires)
        const h = 10 + rng() * 9;
        city.both(wm, new THREE.CylinderGeometry(r * 0.75, r, h, 12).translate(x, h / 2, z));
        city.both(dm, T(new THREE.SphereGeometry(r * 1.25, 18, 12), [x, h + r * 0.6, z], [0, 0, 0], [1, 0.8, 1]));
        city.add(M.ink, new THREE.CylinderGeometry(0.07, 0.12, 5, 4).translate(x, h + r * 1.6 + 2.5, z));
        city.add(M.dark, T(new THREE.BoxGeometry(0.9, 1.9, 0.3), [x + fx * r * 0.98, 0.95, z + fz * r * 0.98], [0, face, 0]));
        city.add(M.dark, T(new THREE.BoxGeometry(0.6, 1.0, 0.3), [x + fx * r * 0.8, h * 0.75, z + fz * r * 0.8], [0, face, 0]));
      }
    }
    out.sites.houses = placed.length;

    // braziers along the avenue: a post, a bowl, a little fire
    const brazierFlames = [];
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
      const x = s * 6.5, z = 28 + k * 9;
      city.both(M.stone, new THREE.CylinderGeometry(0.22, 0.32, 2.2, 6).translate(x, 1.1, z));
      city.add(M.ink, lathe([[0.2, 0], [0.8, 0.45], [0.95, 0.7], [0.85, 0.72]], 10).translate(x, 2.2, z));
      brazierFlames.push({ at: city.world(x, 2.75, z), h: 1.5, r: 0.45 });
      const p = city.world(x, 3.4, z);
      lights.push(new THREE.Vector4(p.x, p.y, p.z, 9));
    }
    const bf = new Flames(root, brazierFlames, { seed: 31 });
    updaters.push({ near: city.world(0, 0, 40), r: 300, f: (dt, t) => bf.update(dt, t) });

    // banners on the gate pylons and along the avenue
    for (const s of [-1, 1]) {
      const p = city.world(s * 8.2, 15, R + 3.7);
      banners.push(new Banner(root, p, city.heading(0), { width: 2.2, height: 9, color: s > 0 ? '#c8483a' : '#5fb7ad' }));
    }

    // ---------------------------------------------------------------- the tree
    // (references/levels/The Desert/places/qanat-tree/sheet-1.jpg: an enormous pale tree, its trunk fluted and gnarled,
    // great buttress roots flowing out over the square, one low arm arching down over Nour's bench, and a wide crown of
    // limbs whose leaves are the fire itself, a slow cool fire in violet, teal and gold)
    const top = 0.02;   // the square's paving: the tree is rooted in it (since v1.41; it stood on three tiers 6.6 m up)
    const TREE = { x: 0, z: -3 }, S = 1.45;   // S: the old tree's size (the fire's hazard keeps its reach)
    const TWIST = 0.03;
    // a massive fluted trunk: a lathe, twisted and ridged, flaring at its foot; it forks at FORK into the crown's limbs
    const FORK = 21;
    const PROFILE = [[6.3, -0.3], [5.6, 0.7], [5.0, 2.4], [4.7, 5], [4.5, 9], [4.35, 13], [4.4, 16.5], [4.8, 19.5], [5.4, 22]];
    const gnarl = (y, th) => 1 + 0.07 * Math.sin(th * 9 + y * 0.22) + 0.04 * Math.sin(th * 15 - y * 0.35) + 0.05 * Math.sin(y * 0.9 + th * 2);
    const twist = (g) => {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), tw = y * TWIST;
        const n = gnarl(y, Math.atan2(z, x));
        p.setXYZ(i, (x * Math.cos(tw) - z * Math.sin(tw)) * n, y, (x * Math.sin(tw) + z * Math.cos(tw)) * n);
      }
      g.computeVertexNormals();
      return g.translate(TREE.x, top, TREE.z);
    };
    // the bark's radius at angle th (atan2(z, x) round the axis) and height y over the square
    const profileR = (y) => {
      for (let i = 1; i < PROFILE.length; i++) if (y <= PROFILE[i][1]) { const [r0, y0] = PROFILE[i - 1], [r1, y1] = PROFILE[i]; return r0 + (r1 - r0) * THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1); }
      return PROFILE[PROFILE.length - 1][0];
    };
    const barkR = (th, y) => profileR(y) * gnarl(y, th - y * TWIST);
    // collision is the bark itself (so a climber's hands touch what you see), minus the foot's flare, drawn over the roots
    // (shut at both ends: under the paving, and a low crown over the top, between the limbs)
    const CROWN = [[3.2, 22.6], [0, 23]];
    city.both(M.bark, twist(lathe([[0, -0.3], ...PROFILE, ...CROWN], 40)), twist(lathe([[0, -0.3], [5.4, -0.3], ...PROFILE.slice(1), ...CROWN], 40)));
    // the makers' ledge (below): a plank shelf high on the trunk, over a buttress root, toward the old shrine's corner
    const LEDGE = { phi: -0.5, H: 3.2, H2: 7.2, shoulder: 1.6 };   // H the root's shoulder, H2 the shelf, over the square
    // tree-local helpers: a point at angle a (local angle: 0 toward the main gate), r out from the axis, y over the square
    const onTree = (a, r, y) => V(TREE.x + Math.sin(a) * r, top + y, TREE.z + Math.cos(a) * r);
    // the buttress roots: tall fins flowing out of the trunk and down over the square, each ending in a low tail you
    // step over (none toward the well and the stairs, the back stair, the ledge's own buttress or the low arm). A fin
    // stands 7–8 m up the trunk and is down to 0.4 m by 7.4 m out: the ring round the trunk is walked round (the
    // routes: tests/desert-story.test.js, tests/boxes.test.js)
    const FINS = [[0.75, 7.6], [1.35, 8.2], [1.95, 7.0], [2.55, 7.8], [-2.5, 7.4], [-1.85, 8.0], [-1.4, 6.8]];
    const finH = (r, hTop) => r < 4.2 ? hTop : r > 7.4 ? 0.38 : 0.38 + (hTop - 0.38) * (1 - (r - 4.2) / 3.2) ** 2.2;
    const fin = (a0, hTop) => {
      const n = 14, r0 = 2.8, r1 = 8.4, pos = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const r = r0 + (r1 - r0) * i / n, a = a0 + 0.1 * Math.sin(r * 0.6 + a0 * 3), h = finH(r, hTop);
        const c = onTree(a, r, 0), ex = Math.cos(a), ez = -Math.sin(a);   // (e: across the fin, level)
        const wb = THREE.MathUtils.lerp(2.1, 0.95, i / n), wt = THREE.MathUtils.lerp(0.5, 0.42, i / n);
        for (const [u, y] of [[-wb / 2, -0.5], [wb / 2, -0.5], [wb * 0.3, h * 0.55], [wt / 2, h], [-wt / 2, h], [-wb * 0.3, h * 0.55]]) pos.push(c.x + ex * u, c.y + y, c.z + ez * u);
      }
      const K = 6;
      for (let i = 0; i < n; i++) for (let j = 0; j < K; j++) { const a = i * K + j, b = i * K + (j + 1) % K, c = a + K, d = b + K; idx.push(a, b, d, a, d, c); }
      for (let j = 1; j < K - 1; j++) { idx.push(0, j + 1, j); const L = n * K; idx.push(L, L + j, L + j + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      outward(g);
      return g;
    };
    for (const [a, h] of FINS) {
      city.both(M.bark, fin(a, h));
      // its tail, low over the paving (0.35 m proud), running out over the square and down into it
      const pts = [onTree(a, 6.2, -0.3), onTree(a + 0.05, 8.5, -0.15), onTree(a + 0.1, 10.5, -0.12), onTree(a + 0.12, 12.4, -0.6)];
      city.both(M.bark, taper(pts, 0.72, 0.3, 12, 6));
    }
    // the low arm: a great root arching out of the trunk over Nour's bench and down into the square
    // (3.6 m clear over the walk round the trunk, where the way to the back gate passes under it)
    const ARM = -1.1;
    { const arm = [[3.2, 4.4], [6, 5.4], [8.5, 4.9], [10.5, 3.6], [12.3, 1.6], [13.5, 0.3], [14.3, -0.8]].map(([r, y], i) => onTree(ARM + 0.04 * i, r, y));
      city.both(M.bark, taper(arm, 1.05, 0.6, 22, 8)); }
    // limbs: five great arms spreading wide out of the fork, each parting into branches that carry the burning leaves
    const limbs = [], tips = [];
    for (let k = 0; k < 5; k++) {
      const b = k / 5 * Math.PI * 2 + 0.3, reach = 19 + (k % 2) * 3, lift = 31 + (k % 3) * 1.5;
      const p = [onTree(b, 1.0, FORK - 2), onTree(b + 0.05, 6.5, FORK + 3.2), onTree(b + 0.1, reach * 0.62, lift - 3), onTree(b + 0.12, reach, lift)];
      city.add(M.bark, taper(p, 2.3, 0.6, 18, 8));
      city.solid(taper(p, 2.0, 0.55, 6, 5));
      limbs.push(p[3]); tips.push(p[3], p[2]);
      // branches: two out to the sides and one up, from two thirds along the limb
      const fork = new THREE.CatmullRomCurve3(p).getPointAt(0.55);
      for (const [db, rr, yy] of [[-0.42, reach * 1.02, lift + 4.5], [0.42, reach * 0.95, lift + 5.5], [0.06, reach * 0.55, lift + 9]]) {
        const tip = onTree(b + db, rr, yy), mid = fork.clone().lerp(tip, 0.5).add(V(0, 1.2, 0));
        city.add(M.bark, taper([fork.clone().add(V(0, -0.4, 0)), mid, tip], 0.95, 0.22, 10, 6));
        tips.push(tip);
      }
    }
    // the fire: the leaves of the crown, a slow cool fire (glowing by their material: no light of their own), with a
    // smaller flame body breathing among the limbs (story/flames.js FlameBody, two shells)
    const treeOrigin = city.world(0, 0, 0);
    const treeGroup = new THREE.Group();
    treeGroup.position.copy(treeOrigin); treeGroup.quaternion.setFromAxisAngle(UP, C.yaw);
    root.add(treeGroup);
    const flames = new FlameBody(treeGroup, { at: V(TREE.x, top + FORK + 1, TREE.z), width: 30, height: 24, seed: 7, belly: 0.55, pace: 0.4, torn: 1.2, cover: 1, shells: [0, 2] });
    const PIVOT = V(TREE.x, top + FORK + 8, TREE.z);
    const foliage = new THREE.Mesh(fireLeaves(tips, PIVOT, mulberry32(7717)), M.leaves);
    foliage.name = 'The tree’s burning leaves';
    foliage.position.copy(PIVOT);
    foliage.userData.noCollide = true;
    treeGroup.add(foliage);
    // climb into it and it burns (src/hazards.js): its volume, from just over the fork to the tip
    // (only while it burns: the tree stands cold until it is lit, src/story/desert.js)
    { const lo = city.world(TREE.x, top + 14 * S, TREE.z), hi = city.world(TREE.x, top + 62 * S, TREE.z);
      const h = flameHazard({ x: lo.x, z: lo.z, y0: lo.y, y1: hi.y, rMax: 15 * S, belly: 0.4, dps: HAZARD_DPS.fire }), test = h.test;
      h.test = (p) => (out.city?.lit ?? 1) > 0.5 && test(p);
      registerHazard(h); }
    const crown = city.world(TREE.x, top + 30 * S, TREE.z);
    const embers = new Embers(root, [...limbs.map((p) => city.world(p.x, p.y + 3, p.z)), crown], { count: 70, rise: 2.4, life: 6, spread: 4, size: 0.6, color: '#fff3c4' });
    embers.mesh.boundingSphere = new THREE.Sphere(crown.clone(), 45); embers.mesh.frustumCulled = true;
    // the landmark: a tall column of light smoke from the crown flame, high over the horizon haze,
    // bending downwind into a long drifting plume, so the city can be found from anywhere on the plain
    const smoke = new SmokeColumn(root, crown);
    const treeLight = new THREE.Vector4(crown.x, crown.y - 12, crown.z, 90);
    const treeLight2 = new THREE.Vector4(crown.x, top + floor + 6, crown.z, 58);   // the plaza and the nearest roofs, warm at night
    lights.push(treeLight, treeLight2);

    // the dry well at the tree's roots, and the carved stele beside it
    const WELL = { x: 0, z: 8 };
    // (the kerb collides as the ring it is drawn as, and its dry bottom holds you up: a solid cylinder
    // used to cap the well's mouth with an invisible floor 1.1 m over the paving)
    city.both(M.stone, lathe([[2.0, 0], [2.6, 0], [2.6, 1.0], [2.25, 1.15], [2.0, 1.0], [2.0, 0]], 24).translate(WELL.x, top, WELL.z));
    city.both(M.dry, new THREE.CylinderGeometry(2.02, 2.02, 0.1, 24).translate(WELL.x, top + 0.06, WELL.z));
    const wellMat = magicMaterial(21);
    const wellWater = magicPool(2.0, wellMat, { rings: 4, segs: 24 });
    wellWater.position.copy(city.world(WELL.x, top + 0.12, WELL.z));
    wellWater.visible = false;
    root.add(wellWater);
    // the stele: kneeling giants carry water to a burning tree, the glyph above
    const ST = { x: 6.2, z: 8.2 };
    city.both(M.mural, T(new THREE.BoxGeometry(3.2, 4.4, 0.6), [ST.x, top + 2.2, ST.z], [0, -0.35, 0]));
    city.add(M.ink, mural(3.0, 3.0).applyMatrix4(new THREE.Matrix4().compose(V(ST.x, top + 2.0, ST.z), new THREE.Quaternion().setFromAxisAngle(UP, -0.35), V(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.31))));
    city.add(M.glyph, glyphGeometry(0.55).applyMatrix4(new THREE.Matrix4().compose(V(ST.x, top + 3.9, ST.z), new THREE.Quaternion().setFromAxisAngle(UP, -0.35), V(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.32))));

    // the makers' ledge: high up the trunk, a plank shelf on a pier of root, the pier standing
    // on the shoulder of a buttress root that rises out of the square. On the dais, on a low drum
    // ringed with the makers' light, the box that holds the backpack (src/boxes/placements.js:
    // 'desert.backpack'), out in the open where you see it from the stairs. A real little climb, in
    // two pitches: up the root's face onto its shoulder, then up the pier's face and over the dais's
    // edge (player.js tryMantle), where there is room to stand in front of the box.
    // Ledge frame L: x across, y up from the square, z out from the tree's axis (toward phi).
    const { phi, H, H2 } = LEDGE;
    const lM = new THREE.Matrix4().compose(V(TREE.x, top, TREE.z), new THREE.Quaternion().setFromAxisAngle(UP, phi), V(1, 1, 1));
    const lg = (g) => g.applyMatrix4(lM);
    const lToCity = (x, y, z) => V(x, y, z).applyMatrix4(lM);
    // the bark's reach along the dais (the twist and the knots), so the box sits just clear of it
    const reach = (x, z, y) => { const p = lToCity(x, 0, z); return Math.hypot(p.x - TREE.x, p.z - TREE.z) - barkR(Math.atan2(p.z - TREE.z, p.x - TREE.x), y); };
    const DRUM = { r: 0.86, h: 0.78 };   // the chest's stand: tall enough that the box shows over the shelf's edge from the stairs
    let sBack = 2.5;
    for (; sBack < 6; sBack += 0.05) {
      let clear = true;
      for (let x = -0.85; x <= 0.85 && clear; x += 0.17) for (let y = H2 + DRUM.h; y <= H2 + DRUM.h + 1.5 && clear; y += 0.3) if (reach(x, sBack, y) < 0.12) clear = false;
      if (clear) break;
    }
    const BOX_HALF = 0.55;                 // half the box's depth (src/boxes/model.js BOX.d * BOX_SCALE / 2)
    const sC = sBack + BOX_HALF;           // the box's centre
    const sF2 = sC + 1.7;                  // the shelf's front edge (the pier's face): room to stand, and for the climb's last reach
    const sF = sF2 + LEDGE.shoulder;       // the root's face, its shoulder between the two
    const sIn = sBack - 1.1;               // well into the bark
    // ---- the buttress root: a flat-faced wall of bark you can climb, flaring a little at its foot; its top the shoulder
    const BW = 2.0, bIn = sIn - 0.4, bD = sF - bIn;
    city.solid(lg(new THREE.BoxGeometry(BW, H + 0.3, bD).translate(0, (H - 0.3) / 2, bIn + bD / 2)));
    {
      const b = new THREE.BoxGeometry(BW, H + 0.3, bD, 6, 8, 7).translate(0, (H - 0.3) / 2, bIn + bD / 2);
      const p = b.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const foot = THREE.MathUtils.clamp((0.6 - y) / 0.9, 0, 1);             // the flare at the foot
        const side = Math.abs(Math.abs(x) - BW / 2) < 0.01, front = Math.abs(z - sF) < 0.01;
        if (side) x += Math.sign(x) * (0.08 * Math.sin(y * 3.1 + z * 2.3) + 0.35 * foot * foot);
        if (front) z += 0.04 * Math.sin(x * 4.1 + y * 2.7);                      // (the climbing face stays flat)
        p.setXYZ(i, x, y, z);
      }
      b.computeVertexNormals();
      city.add(M.bark, lg(b));
      // two roots twisting down its sides into the paving
      for (const s of [-1, 1]) city.add(M.bark, lg(taper([V(s * 0.62, H - 0.6, sF - 1.5), V(s * 1.25, H * 0.5, sF - 0.9), V(s * 1.5, 0.15, sF - 0.6), V(s * 1.7, -0.25, sF - 0.3)], 0.42, 0.2, 10, 6)));
      // the makers' mark on its face, and offering cloths tied to the shoulder's corners
      city.add(M.glyph, lg(glyphGeometry(0.42).translate(0, 1.75, sF + 0.06)));
      [[-1, 0, 1.25], [1, 1, 0.95]].forEach(([s, c, len]) => city.add(M.cloth[c], lg(new THREE.PlaneGeometry(0.2, len).translate(s * (BW / 2 - 0.08), H - 0.1 - len / 2, sF + 0.02))));
    }
    // ---- the pier: the root climbing on up the trunk, its front face flat and plumb (the second pitch)
    const PW = 1.6, pIn = sIn, pD = sF2 - pIn;
    // (its own batch of the same bark: it stands into the trunk, and the tree's own mesh stays one closed skin, tests/desert-tree.test.js)
    // (drawn up to the planks' underside: its top level with the boards showed through them; it collides up to the shelf's top)
    city.add(M.barkRoot, lg(new THREE.BoxGeometry(PW, H2 - H - 0.15, pD).translate(0, (H + H2 - 0.15) / 2, pIn + pD / 2)));
    city.solid(lg(new THREE.BoxGeometry(PW, H2 - H, pD).translate(0, (H + H2) / 2, pIn + pD / 2)));
    for (const s of [-1, 1]) city.add(M.barkRoot, lg(taper([V(s * 0.5, H2 - 0.5, sF2 - 0.9), V(s * 0.95, (H + H2) / 2, sF2 - 0.6), V(s * 1.0, H + 0.2, sF2 - 0.2), V(s * 1.15, H - 0.2, sF2 + 0.2)], 0.36, 0.22, 10, 6)));
    // the glyph painted on its face, lit like the root's mark
    city.add(M.glyph, lg(glyphGeometry(0.32).translate(0, (H + H2) / 2 + 0.15, sF2 + 0.03)));
    // ---- the shelf: planks across two joists, its front edge flush with the pier's face, braced back to the bark
    const DT = 0.42, DW = 3.6, dz0 = sBack - 0.9, dz1 = sF2;
    city.solid(lg(new THREE.BoxGeometry(DW, DT, dz1 - dz0).translate(0, H2 - DT / 2, (dz0 + dz1) / 2)));
    { const n = Math.round((dz1 - dz0) / 0.5), pw = (dz1 - dz0) / n;
      for (let i = 0; i < n; i++) {
        const w = DW + (i % 3 === 1 ? -0.12 : i % 3 === 2 ? 0.08 : 0), x = i % 2 ? 0.05 : -0.04;
        city.add(M.wood, lg(new THREE.BoxGeometry(w, 0.14, pw - 0.05).translate(x, H2 - 0.07, dz0 + pw * (i + 0.5))));
      }
      for (const s of [-1, 1]) city.add(M.wood, lg(new THREE.BoxGeometry(0.24, 0.3, dz1 - dz0).translate(s * 1.35, H2 - 0.29, (dz0 + dz1) / 2)));   // the joists
      // braces from the bark up to the joists' ends
      for (const s of [-1, 1]) { const a = V(s * 1.35, H2 - 2.6, sBack - 0.2), b = V(s * 1.35, H2 - 0.4, dz1 - 0.35); city.add(M.wood, lg(strut(a, b, 0.11))); }
      // the front plank painted with the makers' colours, and their glyph painted on the boards before the chest
      city.add(M.lav, lg(new THREE.BoxGeometry(DW + 0.02, 0.06, 0.03).translate(0, H2 - 0.05, dz1 + 0.005)));
      city.add(M.ochre, lg(new THREE.BoxGeometry(DW + 0.02, 0.04, 0.03).translate(0, H2 - 0.11, dz1 + 0.005)));
      city.add(M.glyph, lg(glyphGeometry(0.42).rotateX(-Math.PI / 2).translate(0, H2 + 0.006, (sC + BOX_HALF + dz1) / 2 + 0.1)));
    }
    // cloths tied to its corners, hanging long
    [[-1, dz1 - 0.06, 3, 2.3, 0], [1, dz1 - 0.06, 2, 1.7, 0], [-1, sC - 0.5, 1, 1.9, 1], [1, sC - 0.3, 7, 1.4, 1]].forEach(([s, z, c, len, side]) => {
      const g = new THREE.PlaneGeometry(0.24, len, 1, 4);
      { const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.05 * Math.sin(p.getY(i) * 2.4 + s)); }
      g.translate(0, -len / 2, 0);
      if (side) g.rotateY(Math.PI / 2);
      city.add(M.cloth[c], lg(g.translate(s * (DW / 2 + 0.02), H2 - 0.12, z + (side ? 0 : 0.02))));
    });
    // the stand the chest sits on (where it shows over the shelf's edge from the stairs): a low box of planks, a cloth over it
    // (narrower than the chest, so the climb's last reach over the shelf's edge stays clear of it: tests/boxes.test.js)
    city.both(M.wood, lg(new THREE.BoxGeometry(1.2, DRUM.h, 0.6).translate(0, H2 + DRUM.h / 2, sC)));
    city.add(M.ink, lg(new THREE.BoxGeometry(1.24, 0.04, 0.64).translate(0, H2 + DRUM.h * 0.5, sC)));
    city.add(M.cloth[0], lg(new THREE.PlaneGeometry(0.5, DRUM.h - 0.04).translate(0, H2 + DRUM.h / 2 + 0.02, sC + 0.31)));
    // a stone bench in the square below, under the tree's arm: where Nour keeps the chest company
    const BENCH = { x: -7.33, z: 2.22 }, footC = lToCity(0, 0, sF + 0.8), benchYaw = Math.atan2(footC.x - BENCH.x, footC.z - BENCH.z);
    city.both(M.stone, T(new THREE.BoxGeometry(1.5, 0.42, 0.5), [BENCH.x, 0.21 + top, BENCH.z], [0, benchYaw, 0]));
    city.add(M.cloth[1], T(new THREE.BoxGeometry(1.2, 0.04, 0.44), [BENCH.x, 0.44 + top, BENCH.z], [0, benchYaw, 0]));
    // pilgrims' lanterns on posts round the tree's foot, and cloths hung from the low arm
    for (const a of [0.55, 1.5, 2.3, -2.3, -1.65]) {
      const x = Math.sin(a) * 10.9, z = Math.cos(a) * 10.9;
      city.add(M.ink, new THREE.CylinderGeometry(0.05, 0.07, 1.55, 5).translate(x, top + 0.78, z));
      city.add(M.ink, new THREE.BoxGeometry(0.34, 0.05, 0.34).translate(x, top + 1.55, z));
      city.add(M.ochre, new THREE.BoxGeometry(0.25, 0.32, 0.25).translate(x, top + 1.74, z));
      city.add(M.ink, new THREE.ConeGeometry(0.24, 0.22, 4).rotateY(Math.PI / 4).translate(x, top + 2.0, z));
    }
    [[7.5, 4.3, 3, 1.5], [9.6, 3.4, 2, 1.1], [11.2, 1.6, 6, 0.8]].forEach(([r, y, c, len]) => {
      const p = onTree(ARM + 0.04 * (r / 2.3), r, y - len / 2);
      city.add(M.cloth[c], new THREE.PlaneGeometry(0.3, len, 1, 3).rotateY(ARM).translate(p.x, p.y, p.z));
    });
    const toWorld = (x, y, z) => { const p = lToCity(x, y, z); return city.world(p.x, p.y, p.z); };
    // (ledge-local points: x across, y up from the square, z out from the chest's centre)
    const ledge = {
      box: toWorld(0, H2 + DRUM.h, sC), yaw: city.heading(phi), height: H2 + DRUM.h,
      at: (x, y, z) => toWorld(x, y, sC + z),
      foot: toWorld(0, 0, sF + 0.8),        // in the square in front of the buttress: push into it and climb
      face: sF - sC,                        // the root's climbing face, metres in front of the box
      shoulder: toWorld(0, H, (sF + sF2) / 2),   // the root's top, between the two pitches
      dais: { y: toWorld(0, H2, sC).y, face: sF2 - sC },   // the dais's top, and its edge (the pier's face) in front of the box
      bench: { at: city.world(BENCH.x, top + 0.42, BENCH.z), heading: city.heading(benchYaw) },
    };

    const cityMeshes = city.flush();
    out.city = {
      bark: cityMeshes.find((m) => m.material === M.bark),   // the tree: trunk, roots, limbs and the buttress (tests: closed)
      center: city.world(0, 0, 0), gate: city.world(0, 0, R + 6), backGate: city.world(0, 0, -R - 4),
      top: city.world(0, top, 0), well: city.world(WELL.x, top, WELL.z), stele: city.world(ST.x, top, ST.z + 1.2),
      wellLook: city.world(WELL.x, top, WELL.z + 3.4), treeBase: city.world(TREE.x, top, TREE.z), crown,
      flames, foliage, embers, smoke, light: treeLight, light2: treeLight2, wellWater, wellMat, yaw: C.yaw,
      plinthStair: city.world(0, 0, 31),   // (the avenue's end at the square, where the stairs up to the tree once began)
      local: (x, y, z) => city.world(x, y, z), top: city.world(0, top, 0).y,
      stairTop: city.world(0, top, 12.6), ledge,   // (in the square before the well, where the stairs came up)
      // the fire: 0 (the tree stands cold, no flame, no smoke, no sparks) .. 1 (burning). A new game starts
      // at 0; src/story/desert.js lights it once the spark-stone is set in the full well
      lit: 1,
      /** Set how far the fire has caught (0..1). From cold, the smoke column starts climbing from the crown. */
      setLit(k) {
        const c = out.city, was = c.lit;
        c.lit = THREE.MathUtils.clamp(k, 0, 1);
        c.flames.lit = c.lit;
        // the leaves catch with the fire, growing out of the branches (cold, the limbs stand bare)
        c.foliage.visible = c.lit > 0.001;
        c.foliage.scale.setScalar(0.3 + 0.7 * c.lit);
        if (was <= 0.001 && c.lit > 0.001) c.smoke.light();
        c.smoke.mesh.visible = c.lit > 0.001;
        if (c.lit <= 0.001) c.embers.mesh.visible = false;
      },
    };
  }

  // ================================================================ the camps
  const P = STORY.camps;
  const camp = new Kit(root, 'Pilgrim camps', V(P.x, floor, P.z), C.yaw);
  {
    const fires = [{ x: 0, z: 0, big: true }, { x: -17, z: 9 }, { x: 15, z: -11 }];
    const campFlames = [];
    for (const f of fires) {
      // stones in a ring, logs, flames, smoke
      const n = f.big ? 11 : 8, rr = f.big ? 1.5 : 1.1;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; camp.add(M.stone, T(new THREE.IcosahedronGeometry(f.big ? 0.42 : 0.32, 0), [f.x + Math.sin(a) * rr, 0.12, f.z + Math.cos(a) * rr], [a, a * 2, 0], [1, 0.7, 1])); }
      for (let i = 0; i < 3; i++) camp.add(M.wood, T(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 5), [f.x, 0.25, f.z], [Math.PI / 2, i * 1.05, 0.2]));
      camp.solid(new THREE.CylinderGeometry(rr + 0.3, rr + 0.3, 0.5, 8).translate(f.x, 0.25, f.z));
      const s = f.big ? 1 : 0.7;
      campFlames.push({ at: camp.world(f.x, 0.25, f.z), h: 2.6 * s, r: 0.75 * s }, { at: camp.world(f.x + 0.35, 0.25, f.z - 0.2), h: 1.7 * s, r: 0.5 * s, phase: 2 }, { at: camp.world(f.x - 0.3, 0.25, f.z + 0.25), h: 1.9 * s, r: 0.55 * s, phase: 4 }, { at: camp.world(f.x, 0.3, f.z), h: 1.3 * s, r: 0.4 * s, core: 1, phase: 1 });
      const fp = camp.world(f.x, 1.5, f.z);
      lights.push(new THREE.Vector4(fp.x, fp.y, fp.z, f.big ? 16 : 11));
      out.fires.push(fp);
      const sp = camp.world(f.x, 2.5, f.z);
      const smoke = new Smoke(root, sp, { count: f.big ? 18 : 12, height: f.big ? 26 : 16, size: f.big ? 1.25 : 0.9 });
      smoke.mid = sp.clone().add(V(0, f.big ? 13 : 8, 0));
      smoke.mesh.boundingSphere = new THREE.Sphere(smoke.mid.clone(), f.big ? 22 : 15); smoke.mesh.frustumCulled = true;
      smokes.push(smoke);
      // log benches round the fire, 0.3 m high: people sit on them facing the flames
      const nb = f.big ? 6 : 4, br = f.big ? 4.4 : 3.4;
      for (let i = 0; i < nb; i++) {
        const a = i / nb * Math.PI * 2 + (f.big ? 0.5 : 0.2);
        const bx = f.x + Math.sin(a) * br, bz = f.z + Math.cos(a) * br;
        camp.both(M.wood, T(new THREE.BoxGeometry(1.9, 0.3, 0.5), [bx, 0.15, bz], [0, a, 0]));
        out.seats.push({ at: camp.world(bx, 0.3, bz), heading: camp.heading(a + Math.PI), fire: f, i });
      }
    }
    const cf = new Flames(root, campFlames, { seed: 47 });
    updaters.push({ near: camp.world(0, 0, 0), r: 260, f: (dt, t) => cf.update(dt, t) });
    // the stragglers' smoke: while the tree stands cold, the camps keep green wood on the big fire so that whoever
    // fell behind the procession can find the way in. A column over the dunes, seen from the landing, where the city
    // itself is behind the ridge (level design audit v1.9: the first leg was blind). Once the tree burns, its own
    // column is the way to the city, and this one is let die down (out.update).
    out.campSmoke = new SmokeColumn(root, camp.world(0, 2.5, 0), { count: 140, height: 190, drift: 170, base: 2.2, top: 13, period: 110 });

    // tents: peaked cloth tents and round domed ones, with poles and pennants
    const TENTS = [[-11, -5, 'peak'], [10, 5, 'peak'], [-24, -8, 'dome'], [24, 0, 'dome'], [-14, 22, 'peak'], [14, 24, 'wing'], [-30, 10, 'peak'], [30, 16, 'peak'], [-6, 32, 'dome'], [7, -24, 'wing'], [-22, -24, 'peak'], [26, -20, 'dome']];
    TENTS.forEach(([x, z, kind], i) => {
      const cm = M.cloth[i % M.cloth.length], face = Math.atan2(-x, -z);
      if (kind === 'peak') {
        const g = new THREE.ConeGeometry(3.4, 4.6, 6, 1, true).translate(0, 2.3, 0);
        camp.both(cm, T(g, [x, 0, z], [0, face, 0]), new THREE.CylinderGeometry(1.6, 3.2, 3.6, 6).translate(x, 1.8, z));
        camp.add(M.dark, T(new THREE.BoxGeometry(1.2, 1.8, 0.2), [x + Math.sin(face) * 2.6, 0.9, z + Math.cos(face) * 2.6], [0, face, 0], [1, 1, 1]));
        camp.add(M.wood, new THREE.CylinderGeometry(0.07, 0.07, 6.6, 4).translate(x, 3.3, z));
        camp.add(M.cloth[(i + 3) % M.cloth.length], T(new THREE.PlaneGeometry(1.4, 0.7).translate(0.7, 0, 0), [x, 6.2, z], [0, face + 1, 0]));
      } else if (kind === 'dome') {
        camp.both(cm, T(dome(3.2, 14, 6), [x, 0, z], [0, 0, 0], [1, 0.8, 1]), new THREE.CylinderGeometry(2.4, 3.2, 2.4, 8).translate(x, 1.2, z));
        camp.add(M.cloth[(i + 2) % M.cloth.length], new THREE.CylinderGeometry(3.24, 3.24, 0.5, 14, 1, true).translate(x, 0.9, z));
        camp.add(M.dark, T(new THREE.BoxGeometry(1.1, 1.5, 0.3), [x + Math.sin(face) * 3.0, 0.75, z + Math.cos(face) * 3.0], [0, face, 0]));
      } else {
        // a bat-wing awning on two poles (references/levels/The Desert/environment/IMG_3775)
        for (const s of [-1, 1]) camp.add(M.wood, new THREE.CylinderGeometry(0.08, 0.1, 4.2, 5).translate(x + Math.cos(face) * s * 3, 2.1, z - Math.sin(face) * s * 3));
        const w = new THREE.PlaneGeometry(7.5, 4.5, 6, 3);
        const p = w.attributes.position;
        for (let k = 0; k < p.count; k++) { const u = p.getX(k) / 3.75, v = p.getY(k) / 2.25; p.setZ(k, -Math.abs(u) * 0.8 - (1 - Math.abs(u)) * 0.6 * Math.cos(v * 1.4)); p.setY(k, p.getY(k) - Math.abs(u) * 0.7 * (1 - Math.abs(Math.sin(u * 3)))); }
        w.computeVertexNormals();
        camp.add(cm, T(w, [x, 3.5, z], [-1.1, face, 0]));
        camp.add(M.cloth[5], new THREE.BoxGeometry(2.6, 0.04, 2).translate(x, 0.03, z));
      }
    });
    // rugs, jars, crates and a loom
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2, d = 7 + rng() * 22, x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (Math.abs(x) < 4) continue;
      camp.add(M.cloth[Math.floor(rng() * 8)], T(new THREE.BoxGeometry(2.4, 0.03, 1.6), [x, 0.02, z], [0, rng() * 3, 0]));
      if (rng() < 0.7) camp.both(M.ochre, lathe([[0.01, 0], [0.32, 0.05], [0.42, 0.4], [0.2, 0.75], [0.16, 0.85], [0.22, 0.9]], 10).translate(x + 1.4, 0, z), new THREE.CylinderGeometry(0.4, 0.4, 0.9, 6).translate(x + 1.4, 0.45, z));
      if (rng() < 0.5) camp.both(M.wood, T(new THREE.BoxGeometry(0.9, 0.7, 0.7), [x - 1.5, 0.35, z + 0.4], [0, rng(), 0]));
    }
    // Marrow's hand-cart, parked at his spot (src/story/desert.js marrowAt = camps.spot(-19, -14)):
    // two spoked wheels, a cloth-lined bed of scrap and bone, and two long shafts down on the sand,
    // as the Desert's character sheet draws it behind him (docs/makehuman.md)
    {
      const cx = -21.6, cz = -12.6, yaw = 0.7;                 // (beside him, its shafts pointing out of the camp)
      const at = (geo, lx, ly, lz, rx = 0, ry = 0) => T(geo.translate(lx, ly, lz), [cx, 0, cz], [rx, yaw + ry, 0]);
      const BED = 0.74;                                        // the bed's top
      camp.both(M.wood, at(new THREE.BoxGeometry(1.0, 0.1, 1.7), 0, BED - 0.05, 0));
      for (const sgn of [-1, 1]) camp.both(M.wood, at(new THREE.BoxGeometry(0.07, 0.3, 1.7), sgn * 0.47, BED + 0.15, 0));
      camp.both(M.wood, at(new THREE.BoxGeometry(1.0, 0.32, 0.07), 0, BED + 0.16, -0.82));
      // the wheels: a rim, a felloe and six spokes each, on an axle under the bed
      for (const sgn of [-1, 1]) {
        camp.both(M.wood, at(new THREE.CylinderGeometry(0.52, 0.52, 0.1, 14).rotateZ(Math.PI / 2), sgn * 0.62, 0.52, -0.42));
        camp.add(M.dark, at(new THREE.TorusGeometry(0.52, 0.045, 4, 18).rotateY(Math.PI / 2), sgn * 0.62, 0.52, -0.42));
        camp.add(M.dark, at(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8).rotateZ(Math.PI / 2), sgn * 0.62, 0.52, -0.42));   // the hub
        // the spokes on both faces, proud of the disc (inside it nothing would show)
        for (const f of [-1, 1]) for (let k = 0; k < 6; k++) camp.add(M.boneDark, at(new THREE.BoxGeometry(0.035, 0.92, 0.05).rotateX(k * Math.PI / 6), sgn * 0.62 + f * 0.062, 0.52, -0.42));
      }
      camp.both(M.wood, at(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6).rotateZ(Math.PI / 2), 0, 0.52, -0.42));
      // the shafts, resting on the sand in front
      const dz = 1.95, dy = -0.7, len = Math.hypot(dz, dy), tilt = Math.atan2(dz, -dy);
      for (const sgn of [-1, 1]) camp.both(M.wood, at(new THREE.CylinderGeometry(0.055, 0.045, len, 5).rotateX(tilt), sgn * 0.42, BED + dy / 2, 0.85 + dz / 2));
      camp.add(M.wood, at(new THREE.CylinderGeometry(0.05, 0.05, 0.84, 5).rotateZ(Math.PI / 2), 0, BED + dy - 0.02, 0.85 + dz));
      // what it carries: a cloth over the bed, a crate, two long bones and a jar
      camp.add(M.cloth[2], at(new THREE.BoxGeometry(0.94, 0.03, 1.5), 0, BED + 0.02, 0.02));
      camp.both(M.wood, at(new THREE.BoxGeometry(0.5, 0.42, 0.46), -0.17, BED + 0.23, -0.48, 0, 0.3));
      for (const [lx, lz, a, h] of [[0.16, 0.14, 0.5, 0.22], [0.02, 0.46, -0.35, 0.31]]) camp.add(M.bone, at(new THREE.CylinderGeometry(0.055, 0.075, 1.25, 6).rotateZ(Math.PI / 2 + 0.12).rotateY(a), lx, BED + h, lz));
      camp.add(M.ochre, at(lathe([[0.01, 0], [0.2, 0.04], [0.26, 0.26], [0.12, 0.46], [0.15, 0.5]], 8), 0.2, BED + 0.03, -0.62));
    }
    // banners on tall poles round the camps
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + 0.3, x = Math.sin(a) * 36, z = Math.cos(a) * 36;
      camp.both(M.wood, new THREE.CylinderGeometry(0.12, 0.16, 11, 5).translate(x, 5.5, z));
      const p = camp.world(x + 0.15, 10.6, z);
      banners.push(new Banner(root, p, camp.heading(a + Math.PI / 2), { width: 1.4, height: 5.5, color: ['#c8483a', '#5fb7ad', '#d8a24a', '#8a6fb8', '#e6875f', '#f3ead8', '#62c3c9'][i] }));
    }
    camp.flush();
    out.camps = {
      center: camp.world(0, 0, 0), fire: camp.world(0, 0, 0), toGate: out.city.gate.clone(),
      spot: (x, z) => camp.world(x, 0, z), heading: (h) => camp.heading(h), fires: fires.map((f) => camp.world(f.x, 0, f.z)),
    };
  }

  // ================================================================ the fallen giant
  const G = STORY.giant;
  const gy = terrain.baseAt(G.x, G.z, 16);
  const giant = new Kit(root, 'Fallen giant', V(G.x, gy, G.z), G.yaw);
  {
    // After the author's pick (references/levels/The Desert/places/skull/sheet-1.jpg): a temple-sized skull, half sunk,
    // tipped forward as if the giant fell face first; two deep round sockets ringed in the pilgrims' turquoise and ochre
    // with ribbons hanging under them, a row of great upper teeth over the mouth, and the mouth a dark tunnel at the
    // sand's level, steps going down to a cool glow. The portal stays at z = 15.6 (the tongue in front of it is the
    // lower jaw, sloping into the dune), the route to it a person wide (tests/skull-entrance.test.js).
    const TILT = 0.12, ROLL = 0.04, SIZE = 1.25, PIVOT = V(0, 0, 14);   // face first: about the mouth's front, the crown forward; temple-sized
    const SK = new THREE.Matrix4().makeTranslation(PIVOT.x, PIVOT.y, PIVOT.z)
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(TILT, 0, ROLL)))
      .multiply(new THREE.Matrix4().makeScale(SIZE, SIZE, SIZE))
      .multiply(new THREE.Matrix4().makeTranslation(-PIVOT.x, -PIVOT.y, -PIVOT.z));
    const sk = (geo) => geo.applyMatrix4(SK), skp = (x, y, z) => V(x, y, z).applyMatrix4(SK);
    // the cranium: an ellipsoid, weathered (a gentle roughness: wind-smoothed, not rocky)
    const CR = { c: V(0, 9.5, 1), a: 16, b: 14, cz: 13 };
    const onSkull = (x, y) => { const dx = x / CR.a, dy = (y - CR.c.y) / CR.b; return V(x, y, CR.c.z + CR.cz * Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))); };
    const normalAt = (p) => V(p.x / CR.a ** 2, (p.y - CR.c.y) / CR.b ** 2, (p.z - CR.c.z) / CR.cz ** 2).normalize();
    // the sockets and the nose: a direction (the socket's axis) and the point where it meets the bone
    const sockets = [-1, 1].map((s) => { const p = onSkull(s * 6.4, 12.8); return { s, p, d: normalAt(p) }; });
    const nose = (() => { const p = onSkull(0, 10.0); return { p, d: normalAt(p) }; })();
    const frame = (d) => { const q = new THREE.Quaternion().setFromUnitVectors(UP, d); return { q, ex: V(1, 0, 0).applyQuaternion(q), ez: V(0, 0, 1).applyQuaternion(q) }; };
    const into = (P, d) => (x, y, z) => { const v = V(x, y, z).sub(P); return { h: v.dot(d), rho: v.clone().addScaledVector(d, -v.dot(d)) }; };
    let cran = new THREE.SphereGeometry(1, 48, 28).scale(CR.a, CR.b, CR.cz);
    rough(cran, 0.15, 0.22, 3);
    cran.translate(CR.c.x, CR.c.y, CR.c.z);
    const inSock = sockets.map(({ p, d }) => into(p, d)), inNose = into(nose.p, nose.d), nf = frame(nose.d);
    cran = trim(cran, (x, y, z) => {
      for (const f of inSock) { const { h, rho } = f(x, y, z); if (h > -4 && rho.length() < 4.7) return true; }
      { const { h, rho } = inNose(x, y, z); if (h > -3 && (rho.dot(nf.ex) / 1.7) ** 2 + (rho.dot(nf.ez) / 2.5) ** 2 < 1) return true; }
      return z > 3 && Math.hypot(x, y) < 4.9;   // the mouth: the tunnel's arch takes over
    });
    // (the face's bone, kept to lay things on it: the ribbons hang off it, the cracks follow it)
    const face = [], keep = (g) => { face.push(new THREE.Mesh(g.clone())); return g; };
    giant.both(M.bone, keep(sk(cran)));
    // a socket: a funnel stood in the bone, its outer slope rising through the surface to a lip (the painted ring:
    // turquoise, an ochre lip, ochre marks round it), then the deep shaded bowl
    const ring = paint('#5fbcc0'), ochre = paint('#d9a64e'), sockIn = paint('#b8a898', { smooth: true });
    const funnel = (P, d, prof, paints, sx = 1, sz = 1) => {
      const { q } = frame(d), m = new THREE.Matrix4().compose(P, q, V(1, 1, 1)).multiply(new THREE.Matrix4().makeScale(sx, 1, sz));
      for (let i = 0; i < paints.length; i++) giant.both(paints[i], sk(lathe(prof[i], 22).applyMatrix4(m)));
    };
    const ribbonAt = [];
    for (const { s, p, d } of sockets) {
      const sag = (r, lift) => [r, -r * r / 28 + lift];   // (on the bone's curve, R ≈ 14: the ring painted on it, not stood off it)
      funnel(p, d, [[sag(6.0, 0.02), sag(5.75, 0.3)], [sag(5.75, 0.3), sag(5.2, 0.34), sag(4.6, 0.32)], [sag(4.6, 0.32), sag(4.35, 0.32), sag(4.2, 0.12)], [sag(4.2, 0.1), [4.0, -2.2], [3.3, -6.2], [0, -6.8]]], [ochre, ring, ochre, sockIn]);
      // the marks: little ochre bars round the ring's slope, and three dots over each socket (the glyph's)
      const { q } = frame(d), slopeN = V(0.37, 1, 0).normalize();
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2, r = 5.15, h = -r * r / 28 + 0.36;
        const loc = V(Math.cos(a) * r, h, Math.sin(a) * r).addScaledVector(V(Math.cos(a) * slopeN.x, slopeN.y, Math.sin(a) * slopeN.x), 0.06);
        const bar = new THREE.PlaneGeometry(0.42, k % 3 ? 0.16 : 0.36).rotateX(-Math.PI / 2).rotateZ(Math.atan2(-slopeN.x, slopeN.y)).rotateY(-a).translate(loc.x, loc.y, loc.z);
        giant.add(ochre, sk(bar.applyQuaternion(q).translate(p.x, p.y, p.z)));
      }
      ribbonAt.push({ s, q, p, d });
    }
    // the nose: a narrower hole, taller than wide, flush with the bone
    funnel(nose.p, nose.d, [[[2.9, -0.4], [2.15, -0.12], [1.85, -0.3]], [[1.85, -0.3], [1.5, -2.6], [0, -3.3]]], [M.bone, sockIn], 0.82, 1.3);
    // the brow's glyph between the rings (the brow you look up at; the giant's breath comes out over it)
    const browP = onSkull(0, 17.4), browN = normalAt(browP);
    giant.add(M.glyph, sk(glyphGeometry(1.1).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), browN)).translate(browP.x + browN.x * 0.25, browP.y + browN.y * 0.25, browP.z + browN.z * 0.25)));
    const brow = browP.clone().addScaledVector(browN, 0.3).applyMatrix4(SK);
    // cheekbones under the sockets' outer corners, sweeping back to the temples
    for (const s of [-1, 1]) {
      giant.both(M.bone, keep(sk(taper([V(s * 14.6, 6.2, 0), V(s * 12.2, 6.9, 6.6), V(s * 9.6, 6.1, 10.8), V(s * 7.4, 4.9, 13.4)], 1.7, 1.15, 14, 8))));
      // the jaw's hinge: a mass each side of the mouth, sunk in the sand
      giant.both(M.bone, sk(rough(new THREE.SphereGeometry(1, 18, 12).scale(2.5, 3.0, 3.8), 0.2, 0.4, 7).translate(s * 8.4, -0.2, 11.2)));
    }
    // the upper teeth on their arch (a U in plan, its front at z ≈ 15.5): the middle two high enough to walk under,
    // the canines long, the back ones short
    const U = (t) => V(6.6 * t, 5.7, 15.5 - 3.6 * t * t);
    // (the arch: the upper jaw, the face's bone coming forward under the nose; the teeth come out from under it)
    giant.both(M.bone, keep(sk(rough(new THREE.SphereGeometry(1, 28, 14).scale(7.3, 2.1, 3.6), 0.12, 0.4, 9).translate(0, 6.4, 11.8))));
    for (const [x, len] of [[-6.0, 1.5], [-5.15, 2.1], [-4.2, 2.7], [-3.1, 4.3], [-1.9, 3.3], [-0.66, 2.4], [0.66, 2.5], [1.9, 3.1], [3.1, 4.6], [4.2, 2.6], [5.15, 2.0], [6.0, 1.4]]) {
      const t = x / 6.6, c = U(t), yaw = Math.atan2(7.2 * t, 6.6);   // (facing out of the U)
      const r = Math.abs(x) > 2.5 && Math.abs(x) < 3.5 ? 0.5 : 0.56, body = Math.max(len - 2 * r, 0.05);
      const tooth = new THREE.CapsuleGeometry(r, body, 3, 7).scale(1.12, 1, 0.62).translate(0, 5.25 - len / 2, 0).rotateY(yaw).translate(c.x, 0, c.z - 0.15);
      giant.both(M.bone, sk(tooth));
    }
    // ribbons and offerings tied under the rings: cloth strips hanging from each ring's lower rim, straight down but
    // off the bone (where the face bulges under them they hang from the bulge), a bead or a little bundle at each end
    const ray = new THREE.Raycaster(), _o = V(0, 0, 0), _back = V(0, 0, -1);
    const boneZ = (x, y) => { ray.set(_o.set(x, y, 40), _back); const h = ray.intersectObjects(face, false)[0]; return h ? h.point.z : -Infinity; };
    for (const { s, q, p } of ribbonAt) {
      for (let k = 0; k < 7; k++) {
        const a = Math.PI / 2 + (k - 3) * 0.26 * s, r = 5.5;   // (the funnel's local +z is down the face)
        const top = V(Math.cos(a) * r, -r * r / 28 + 0.2, Math.sin(a) * r).applyQuaternion(q).add(p).applyMatrix4(SK);
        const L = [3.2, 4.4, 2.6, 3.9, 2.2, 3.6, 2.8][k], strip = paint(M.cloth[[1, 2, 6, 5, 1, 0, 2][k]].paint), n = 6;
        const pts = [top];
        for (let i = 1; i <= n; i++) {
          const y = top.y - L * i / n, sway = Math.sin(k * 1.7 + i * 0.9) * 0.05 * i;
          pts.push(V(top.x + sway, y, Math.max(pts[i - 1].z, boneZ(top.x + sway, y) + 0.16)));
        }
        for (let i = 0; i < n; i++) {
          const A = pts[i], B = pts[i + 1], dy = A.y - B.y, dz = B.z - A.z, len = Math.hypot(B.x - A.x, dy, dz);
          giant.add(strip, new THREE.PlaneGeometry(0.46 - i * 0.03, len + 0.03).rotateX(Math.atan2(-dz, dy)).rotateZ(Math.atan2(B.x - A.x, dy)).translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2));
        }
        const end = pts[n].clone().add(V(0, -0.18, 0.05));
        if (k % 3 === 1) giant.add(paint(M.cloth[(k + 3) % 8].paint), new THREE.BoxGeometry(0.42, 0.36, 0.3).translate(end.x, end.y, end.z));
        else giant.add(k % 2 ? ochre : ring, new THREE.IcosahedronGeometry(0.2, 0).translate(end.x, end.y, end.z));
      }
    }
    // cracks in the weathered crown and temples: ink seams laid on the bone
    {
      const C0 = CR.c.clone().applyMatrix4(SK), rot = new THREE.Matrix4().extractRotation(SK), crng = mulberry32(808), dir = V(0, 0, 0), hitTo = [face[0]];
      const onCrown = (az, el) => {
        dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).applyMatrix4(rot).normalize();
        ray.set(_o.copy(C0).addScaledVector(dir, 40), dir.clone().negate());
        const h = ray.intersectObjects(hitTo, false)[0];
        return h ? h.point.clone().addScaledVector(dir, 0.06) : null;
      };
      for (const [az0, el0, az1, el1] of [[-0.12, 0.6, -0.5, 0.98], [-0.95, 0.32, -1.3, 0.78], [0.72, 0.74, 1.1, 0.42], [0.22, 1.02, 0.62, 1.26], [-1.5, 0.08, -1.72, 0.5], [0.5, 0.3, 0.95, 0.15], [2.6, 0.2, 2.9, 0.75], [3.3, 0.55, 3.0, 1.1], [-2.5, 0.35, -2.9, 0.85], [3.6, 0.1, 3.9, 0.4]]) {
        let prev = null;
        for (let i = 0; i <= 7; i++) {
          const u = i / 7, q2 = onCrown(az0 + (az1 - az0) * u + (crng() - 0.5) * 0.05, el0 + (el1 - el0) * u + (crng() - 0.5) * 0.05);
          if (q2 && prev) {
            const len = prev.distanceTo(q2), mid = prev.clone().add(q2).multiplyScalar(0.5), n2 = mid.clone().sub(C0).normalize();
            const m = new THREE.Matrix4().lookAt(prev, q2, n2).setPosition(mid);
            giant.add(M.ink, new THREE.PlaneGeometry(0.1 - u * 0.05, len + 0.05).rotateX(-Math.PI / 2).applyMatrix4(m));
          }
          prev = q2;
        }
      }
    }
    // the mouth's tunnel: a thick arch from the teeth back into the head, steps going down it to a cool glow
    const tunnel = archShell(4.3, 5.6, 0, 3.5, 13.9, -0.5, Math.PI + 0.5, 24);
    giant.both(paint('#cbbba5', { smooth: true }), sk(tunnel));
    for (let k = 0; k < 7; k++) {
      const z1 = 14.8 - k * 1.5, top = -Math.max(0, k - 0.6) * 0.3;
      giant.both(M.stone, sk(new THREE.BoxGeometry(8.6, 0.6, 1.5).translate(0, top - 0.3, z1 - 0.75)));
    }
    giant.add(M.ink, sk(new THREE.PlaneGeometry(9.6, 8).translate(0, 0.6, 3.75)));
    giant.add(M.glyph, sk(new THREE.CircleGeometry(1.5, 18).scale(0.8, 1.2, 1).translate(0, 0.5, 3.85)));
    giant.solid(sk(new THREE.BoxGeometry(9, 8, 0.4).translate(0, 1, 3.6)));
    // the lower jaw: a tongue of bone meeting the sand (the broad middle clear for walking; it collides), drawn as the
    // pilgrims' worn steps up to the mouth; the jaw's teeth stand out of the dune either side of the way in
    const jaw = new THREE.Shape();
    jaw.moveTo(-3.3, -13.8); jaw.lineTo(3.3, -13.8); jaw.quadraticCurveTo(5.2, -17, 4.4, -20.4);
    jaw.quadraticCurveTo(0, -23.2, -4.4, -20.4); jaw.quadraticCurveTo(-5.2, -17, -3.3, -13.8);
    const jawGeo = new THREE.ExtrudeGeometry(jaw, { depth: 0.22, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 12 }).rotateX(-Math.PI / 2).translate(0, -0.23, 0);
    const jawPos = jawGeo.attributes.position;
    for (let i = 0; i < jawPos.count; i++) jawPos.setY(i, jawPos.getY(i) - Math.max(0, jawPos.getZ(i) - 15) * 0.19);
    jawGeo.computeVertexNormals();
    giant.solid(jawGeo);
    const tongueY = (z) => 0.07 - Math.max(0, z - 15) * 0.19;
    for (let k = 0; k < 6; k++) {
      const z0 = 14.6 + k * 1.15, z1 = z0 + 1.15, w = 6.2 + k * 0.5, top = tongueY(z0) + 0.04;
      giant.add(M.stone, new THREE.BoxGeometry(w, 0.7, z1 - z0 + 0.02).translate(Math.sin(k * 2.3) * 0.15, top - 0.35, (z0 + z1) / 2));
    }
    const ground = (x, z) => { const w = giant.world(x, 0, z); return terrain.heightAt(w.x, w.z) - gy; };
    for (const [x, z, h, r] of [[-4.1, 19.6, 1.3, 0.55], [-5.3, 18.2, 1.8, 0.62], [-6.4, 16.6, 1.2, 0.58], [4.2, 19.8, 1.6, 0.55], [5.4, 18.3, 1.2, 0.62], [6.5, 16.5, 1.7, 0.58]]) {
      const g0 = Math.min(ground(x, z), 0.1);
      giant.both(M.bone, new THREE.CapsuleGeometry(r, h, 3, 8).scale(1, 1, 0.75).rotateZ(x * 0.03).translate(x, g0 + h / 2 - 0.3, z));
    }
    // offerings at the foot of the face: jars, bowls and tied bundles on either side of the mouth
    const jarProf = [[0.01, 0], [0.2, 0.04], [0.27, 0.28], [0.13, 0.5], [0.16, 0.56]];
    for (const [x, z, k] of [[-8.4, 15.2, 0], [-9.2, 14.2, 1], [-7.6, 16.4, 2], [8.6, 15.0, 3], [9.4, 13.8, 4], [7.9, 16.2, 5]]) {
      const g0 = ground(x, z), sc = 1.4 + (k % 3) * 0.35;
      if (k % 3 === 2) giant.add(paint(M.cloth[k % 8].paint), new THREE.BoxGeometry(0.6, 0.45, 0.5).rotateY(k).translate(x, g0 + 0.2, z));
      else giant.add([M.ochre, M.rose, M.teal][k % 3], lathe(jarProf, 8).scale(sc, sc, sc).translate(x, g0 - 0.03, z));
    }
    // one arm reaching out of the sand: shoulder, elbow, a hand spread on the dune
    const sh = V(17, -1, 2), el = V(25, 8, 9), wr = V(31, 1.5, 17);
    for (const [a, b, r0, r1] of [[sh, el, 2.2, 1.7], [el, wr, 1.7, 1.2]]) giant.both(M.bone, taper([a, a.clone().lerp(b, 0.5).add(V(0, 0.6, 0)), b], r0, r1, 10, 8));
    giant.both(M.boneDark, new THREE.SphereGeometry(2.2, 10, 8).translate(el.x, el.y, el.z));
    for (let f = 0; f < 4; f++) {
      const a = -0.6 + f * 0.4, d = V(Math.sin(a + 0.6), 0, Math.cos(a + 0.6));
      const k1 = wr.clone().addScaledVector(d, 2.5).add(V(0, 0.4, 0)), k2 = wr.clone().addScaledVector(d, 5.2).add(V(0, -0.6, 0));
      giant.both(M.bone, taper([wr, k1, k2], 0.55, 0.32, 6, 6));
    }
    // the pilgrims' cairns: from the back gate round the skull's side to its mouth, one every ~10 m, either side of the
    // way (2.6 m off it: they never stand in it), and a few more gathered before the mouth
    const gate = giant.local(out.city.backGate);
    const way = [V(gate.x, 0, gate.z), V(-22, 0, -8), V(-18, 0, 24), V(0, 0, 26)];
    const cairns = [];
    for (let i = 0; i < way.length - 1; i++) {
      const a = way[i], b = way[i + 1], L = a.distanceTo(b), dir = b.clone().sub(a).normalize(), side = V(-dir.z, 0, dir.x);
      for (let d = i === 0 ? 14 : 5, n = 0; d < L - 3; d += 10, n++) cairns.push(a.clone().addScaledVector(dir, d).addScaledVector(side, (n % 2 ? 1 : -1) * 2.6));
    }
    cairns.push(V(-5.6, 0, 29), V(5.8, 0, 28), V(-8.4, 0, 33.5), V(8.8, 0, 33), V(-3.9, 0, 37), V(4.4, 0, 38));
    const crng = mulberry32(5150);
    for (const c of cairns) {
      let y = ground(c.x, c.z) - 0.08;
      const n = 3 + Math.floor(crng() * 2), base = 0.42 + crng() * 0.2;
      for (let k = 0; k < n; k++) {
        const r = base * (1 - k * 0.17), h = r * 0.62;
        const stone = new THREE.IcosahedronGeometry(r, 0).scale(1, 0.6, 0.9).rotateY(crng() * 6).translate(c.x + (crng() - 0.5) * 0.08, y + h * 0.5, c.z + (crng() - 0.5) * 0.08);
        if (k === 0) giant.both(M.stone, stone); else giant.add(M.stone, stone);
        y += h * 0.95;
      }
    }
    giant.flush();
    const door = giant.world(0, 0, 15.6);
    door.y = terrain.heightAt(door.x, door.z) + 0.05;
    out.giant = { local: (x, y, z) => giant.world(x, y, z), skull: giant.world(0, 4.5, 0), door, yaw: G.yaw, brow: giant.world(brow.x, brow.y, brow.z), hand: giant.world(wr.x, wr.y, wr.z), cairns: cairns.map((c) => giant.world(c.x, ground(c.x, c.z), c.z)), glow: giant.world(...skp(0, 0.5, 3.85).toArray()) };
    // the giant's breath (level design audit, fifth round: from Ama's fire the skull's mouth was blind, the skull 17 m
    // high behind the city's walls): the cool air of the cave under it breathing out through the skull's brow into the
    // morning heat, a thin pale column over the back gate, seen from the camps over the walls. While the tree stands
    // cold (with the camps' smoke: out.update); once it burns, the giant has been found.
    out.giantBreath = new SmokeColumn(root, out.giant.brow.clone().add(V(0, 1.5, 0)), { count: 80, height: 85, drift: 45, base: 1.9, top: 6, period: 80, palette: ['#f4f0e8', '#ebe8e2', '#dfe4e5'], tint: '#f4f0e8' });
  }

  // ================================================================ the cave
  const O = V(STORY.cave.x, STORY.cave.y, STORY.cave.z);
  const cave = new Kit(root, 'Cave of the giant’s heart', O, 0);
  const cv = {};
  {
    // After the author's pick (references/levels/The Desert/places/skull-cave/sheet-1.jpg): a nave of great ribs, sand
    // and rock between them, light falling through cracks in the vault onto a sandy floor; in the middle a round pool
    // walled in stone steps, dry, a tide line on its sides, the tree's pale roots hanging into it like curtains; a stone
    // trough on the floor from a crack in the wall, one huge fallen bone across it, water glinting in the crack.
    const POOL = 12.5, ROOM = 30, H = 0.8;   // (H: the dome's height over its radius, a tall vault)
    // the cave's own bone and builders' stone: lifted in the shade and keeping their warmth there, as the floor does
    // (the city's paint and mural stone go grey-brown in a room lit only through cracks)
    const caveBone = makeMaterial({ color: '#efe4cc', shade: 0.45, shadeHue: 0.6, hatch: 0.7 });
    const caveStone = makeMaterial({ color: '#e4d0b2', grid: 0.9, flat: true, shade: 0.45, shadeHue: 0.6, hatch: 0.7 });
    // the entrance passage on the +z side (the way back to the skull). First into the batches: from the
    // passage its walls hide the dome's far side and the room's floor, and drawn before them they keep
    // the GPU from painting those first (a third more fragments in the passage)
    cave.both(M.cave, new THREE.BoxGeometry(2.2, 6, 12).translate(-3.6, 3, ROOM + 4), new THREE.BoxGeometry(2.2, 6, 12).translate(-3.6, 3, ROOM + 4));
    cave.both(M.cave, new THREE.BoxGeometry(2.2, 6, 12).translate(3.6, 3, ROOM + 4), new THREE.BoxGeometry(2.2, 6, 12).translate(3.6, 3, ROOM + 4));
    cave.both(M.cave, new THREE.BoxGeometry(9.4, 1.5, 12).translate(0, 5.6, ROOM + 4));
    cave.both(M.caveFloor, new THREE.BoxGeometry(5, 0.5, 12).translate(0, -0.25, ROOM + 4));
    cave.add(M.ink, new THREE.PlaneGeometry(5, 4.8).rotateY(Math.PI).translate(0, 2.4, ROOM + 9.9));
    cave.solid(new THREE.BoxGeometry(6, 6, 0.5).translate(0, 3, ROOM + 10.2));
    // the floor: the pool's bed in the middle, four stone steps down into it, a paved kerb round it, then sand running
    // on under the dome's roughened foot (out to 32.8 m: a floor ending at ROOM + 2 left a hairline under the wall in
    // places, as the Givers' Hearth's did: visual-v1.4)
    const prof = [[0, -1.7], [10.6, -1.6], [10.6, -1.2], [11.4, -1.2], [11.4, -0.8], [12.2, -0.8], [12.2, -0.4], [13.0, -0.4], [13.0, 0], [14.6, 0], [ROOM + 4, 0], [ROOM + 4, -1]];
    const KERB = 9;   // (prof[1..KERB]: the steps and the kerb, in the builders' stone)
    // (each collides as drawn: an 18-sided stand-in lay up to 0.5 m inside the old basin)
    cave.both(M.caveFloor, lathe(prof.slice(0, 2), 36));
    cave.both(caveStone, lathe(prof.slice(1, KERB + 1).reverse(), 36));   // (outside in: its faces up and toward the pool, the stone being one-sided)
    cave.both(M.caveFloor, lathe(prof.slice(KERB), 36));
    // the pool's bed as one flat disc (a lathe's centre is a needle a ray can slip through)
    cave.solid(new THREE.CylinderGeometry(POOL - 1.5, POOL - 1.5, 0.3, 16).translate(0, -1.75, 0));
    // the basin's floor height at radius r, and its radius at height y (where water standing at y meets it)
    const floorAt = (r) => { for (let i = 1; i < prof.length; i++) if (r <= prof[i][0] && prof[i][0] > prof[i - 1][0]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return y0 + (y1 - y0) * (r - r0) / (r1 - r0); } return 0; };
    const basinR = (y) => {
      for (let i = 1; i <= KERB - 1; i++) if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return y1 === y0 ? r0 : r0 + (r1 - r0) * THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1); }
      return prof[KERB - 1][0];
    };
    // dry until the channel runs: damp stains on the bed, and pale tide lines on the steps' faces where the water stood
    const stain = (cx, cz, R, seed, rings = 3, segs = 22) => {
      const pos = [], idx = [];
      const at = (x, z) => pos.push(x, floorAt(Math.hypot(x, z)) + 0.02, z);
      at(cx, cz);
      for (let r = 1; r <= rings; r++) for (let k = 0; k < segs; k++) {
        const a = (k / segs) * Math.PI * 2, rr = R * (r / rings) * (1 + 0.22 * Math.sin(3 * a + seed) + 0.1 * Math.sin(7 * a + seed * 2.3));
        at(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr);
      }
      for (let k = 0; k < segs; k++) idx.push(0, 1 + ((k + 1) % segs), 1 + k);
      for (let r = 1; r < rings; r++) for (let k = 0; k < segs; k++) {
        const a = 1 + (r - 1) * segs + k, b = 1 + (r - 1) * segs + ((k + 1) % segs);
        idx.push(a, b + segs, a + segs, a, b, b + segs);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      return g;
    };
    const damp = paint('#9a7c74'), salt = paint('#efe3cf');
    cave.add(damp, stain(0.6, -0.4, 6.4, 1.3, 4, 30));
    for (const [x, z, r, sd] of [[7.4, -2.4, 2.2, 2.1], [5.6, 3.6, 1.6, 4.4], [-5.4, -4.2, 1.9, 0.7], [-2.6, 6.1, 1.2, 3.3]]) cave.add(damp, stain(x, z, r, sd));
    // (the tide lines: thin bands on the step risers, facing into the pool: the highest where the full pool stands)
    for (const [r, y0, y1] of [[13.0 - 0.02, -0.36, -0.27], [12.2 - 0.02, -0.66, -0.6], [11.4 - 0.02, -1.08, -1.03]]) cave.add(salt, inward(new THREE.CylinderGeometry(r, r, y1 - y0, 48, 1, true).translate(0, (y0 + y1) / 2, 0)));
    // the dome, inside out, rough: the giant's chest, cut for the passage and for the cracks the light falls through
    const door = (x, y, z) => Math.abs(x) < 3.0 && y < 5.2 && z > 15;   // the opening to the passage
    const SKY = [[-10, -11.2, 3.3], [8.5, -16.2, 2.8], [13, 8.8, 3.1], [-6.5, 13.8, 2.6]].map(([x, z, r]) => ({ x, z, r, y: H * Math.sqrt(Math.max(0, (ROOM + 1) ** 2 - x * x - z * z)) }));
    const skyHole = (x, y, z) => SKY.some((h) => Math.hypot(x - h.x, y - h.y, z - h.z) < h.r);
    const d = cut(inward(rough(new THREE.SphereGeometry(ROOM + 1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, H, 1), 1.2, 0.18, 5)), (x, y, z) => door(x, y, z) || skyHole(x, y, z));
    cave.both(M.cave, d);   // (the rough dome collides as drawn: a smooth 14-sided one lay up to 1.6 m inside it)
    // the ribs: broad flat bands arching across the nave from the floor, set into the vault (between them its rock);
    // spaced so the channel's crack and the doorways fall between them
    const RIBS = [];
    for (let k = 0; k < 11; k++) RIBS.push(-23.7 + k * 5);
    for (const z of RIBS) {
      const a = Math.sqrt((ROOM + 1) ** 2 - z * z) - 1.7, b = H * Math.sqrt((ROOM + 1) ** 2 - z * z) - 1.5, pts = [];
      for (let i = 0; i <= 12; i++) { const t = (i / 12) * Math.PI; pts.push(V(Math.cos(t) * a, Math.sin(t) * b - 0.6, z)); }
      cave.both(caveBone, band(pts, 1.05, 0.55, 16, 5));   // (the ribs come down to the floor: solid where they are drawn)
    }
    cave.both(caveBone, taper([V(0, H * (ROOM + 1) - 1.8, -24), V(0, H * (ROOM + 1) - 1.2, 0), V(0, H * (ROOM + 1) - 1.8, 24)], 1.3, 1.3, 14, 7));
    // the light through the cracks: a pale rim round each, thin rays down to a pool of light on the floor (no light
    // of its own: the glow is the material's)
    const sun = makeMaterial({ color: '#fbe3b2', glow: 0.55, flat: true }), slant = V(0.28, -1, 0.18).normalize();
    for (const h of SKY) {
      const top = V(h.x, h.y, h.z), n = top.clone().setY(top.y / (H * H)).normalize();
      cave.add(caveBone, new THREE.TorusGeometry(h.r + 0.6, 0.6, 4, 12).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n)).translate(top.x, top.y, top.z));
      const t = -top.y / slant.y, foot = top.clone().addScaledVector(slant, t);
      const fr = floorAt(Math.hypot(foot.x, foot.z)) + 0.12, rr = h.r * 1.15;   // (over the flagstones)
      cave.add(sun, new THREE.CylinderGeometry(rr, rr, 0.02, 20).scale(1, 1, 0.8).translate(foot.x, fr, foot.z));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + h.x, u = i % 2 ? 0.3 : 0.75;
        const A = V(top.x + Math.cos(a) * h.r * u, top.y, top.z + Math.sin(a) * h.r * u), B = V(foot.x + Math.cos(a) * rr * 0.85 * u, fr, foot.z + Math.sin(a) * rr * 0.8 * u);
        const len = A.distanceTo(B), m = new THREE.Matrix4().lookAt(A, B, V(0, 1, 0)).setPosition(A.clone().add(B).multiplyScalar(0.5));
        cave.add(sun, new THREE.BoxGeometry(0.035, 0.035, len).applyMatrix4(m));
      }
    }
    // sand drifted against the wall between the ribs' feet, and rocks fallen on the floor
    const rock = paint('#b8a49e');
    const crng = mulberry32(4412);
    for (let k = 0; k < RIBS.length - 1; k++) for (const s of [-1, 1]) {
      const z = (RIBS[k] + RIBS[k + 1]) / 2, x = s * (Math.sqrt((ROOM + 1) ** 2 - z * z) - 2.2);
      if ((s > 0 && Math.abs(z + 6.2) < 3) || Math.hypot(x + 17.5, z - 20.5) < 7.5) continue;   // (the channel's crack, the mural)
      cave.add(M.caveFloor, new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(3.2 + crng(), 0.5 + crng() * 0.5, 2.0).rotateY(Math.atan2(x, z)).translate(x, -0.05, z));
    }
    for (const [x, z, r] of [[-15.5, 6, 1.1], [-19, -8.5, 1.5], [15.5, 17.5, 1.2], [-7, 22.5, 0.8], [9.5, 21.5, 0.9], [-21.5, 2.5, 0.7], [18, 2.5, 0.8], [-12, -19.5, 1.0], [12.5, -20, 1.3]]) {
      cave.both(rock, new THREE.DodecahedronGeometry(r, 0).scale(1.2, 0.75, 1).rotateY(x + z).translate(x, r * 0.45, z));
    }
    // a path of flagstones from the doorway to the pool's kerb
    for (let k = 0; k < 9; k++) {
      const z = ROOM - 1.4 - k * 1.65, w = 1.2 + ((k * 7) % 3) * 0.25;
      for (const s of [-1, 1]) cave.add(caveStone, new THREE.BoxGeometry(w, 0.1, 1.35).rotateY((k % 2 ? 0.08 : -0.06) * s).translate(s * (0.72 + (k % 2) * 0.12), 0.05, z));
    }
    // the doorway in from the passage, framed in bone (a jaw's arch)
    cave.both(caveBone, taper([V(-3.7, -0.4, ROOM - 0.3), V(-4.1, 3.8, ROOM - 0.6), V(-2.6, 6.3, ROOM - 0.9), V(0, 7.0, ROOM - 1.0), V(2.6, 6.3, ROOM - 0.9), V(4.1, 3.8, ROOM - 0.6), V(3.7, -0.4, ROOM - 0.3)], 0.8, 0.8, 24, 7));
    // the tree's roots: pale, hanging from the crown of the vault into the pool in two curtains of strands
    const rootTips = [], rrng = mulberry32(77);
    const TOP = H * (ROOM + 1) - 2.2;
    for (const [cx, cz, n] of [[-2.6, 1.4, 12], [3.4, -1.8, 10]]) {
      for (let k = 0; k < 2; k++) {   // two thick roots carry each curtain down
        const a = k * 2.4 + cx, tip = V(cx + Math.cos(a) * 1.6, -1.45, cz + Math.sin(a) * 1.6), pts = [];
        for (let i = 0; i <= 5; i++) { const u = i / 5, wob = Math.sin(u * 7 + a) * 0.5 * Math.sin(u * Math.PI); pts.push(V(cx + Math.cos(a) * 1.6 * u + wob, TOP + 1 - (TOP + 2.45) * u, cz + Math.sin(a) * 1.6 * u + wob * 0.6)); }
        pts[5].copy(tip);
        cave.add(caveBone, taper(pts, 0.6, 0.16, 14, 5));
        rootTips.push(cave.world(tip.x, tip.y + 0.5, tip.z));
      }
      for (let k = 0; k < n; k++) {
        // a curtain: strands from round the bundle's top, wavering down and spreading out over the pool's bed
        const a = rrng() * Math.PI * 2, spread = 0.9 + rrng() * 4.0, top = V(cx + Math.cos(a) * 0.9, TOP - rrng() * 1.5, cz + Math.sin(a) * 0.9);
        const tipY = -1.5 + rrng() * 0.6, f = 1 + rrng() * 2, ph = rrng() * 6, amp = 0.25 + rrng() * 0.35, pts = [];
        for (let i = 0; i <= 6; i++) {
          const u = i / 6, sp = 0.9 + (spread - 0.9) * u * u, w = Math.sin(u * f * Math.PI * 2 + ph) * amp * Math.sin(u * Math.PI);
          pts.push(V(cx + Math.cos(a) * sp - Math.sin(a) * w, top.y + (tipY - top.y) * u, cz + Math.sin(a) * sp + Math.cos(a) * w));
        }
        cave.add(caveBone, taper(pts, 0.16 + rrng() * 0.07, 0.05, 10, 3));
        if (rootTips.length < 6 && k % 5 === 0) rootTips.push(cave.world(pts[6].x, pts[6].y + 0.5, pts[6].z));
      }
    }
    // the channel: a stone trough on the floor, from a crack in the wall to the pool's steps
    const CH = { from: V(27.6, 2.0, -6.2), to: V(12.4, 1.65, -2.75) };
    const chDir = CH.to.clone().sub(CH.from), chLen = chDir.length(); chDir.normalize();
    const chYaw = Math.atan2(chDir.x, chDir.z), chPitch = Math.asin(-chDir.y);
    const along = (u, lift = 0) => CH.from.clone().lerp(CH.to, u).add(V(0, lift, 0));
    const gm = new THREE.Matrix4().compose(along(0.5, -1.27), new THREE.Quaternion().setFromEuler(new THREE.Euler(chPitch, chYaw, 0, 'YXZ')), V(1, 1, 1));
    // (in the trough's frame: its bed at y = 0, its length along z) the block under it, a wall either side, a lip at the end
    const trough = (geo) => geo.applyMatrix4(gm);
    cave.both(caveStone, trough(new THREE.BoxGeometry(2.3, 2.4, chLen + 0.6).translate(0, -1.2, 0)));
    for (const s of [-1, 1]) cave.both(caveStone, trough(new THREE.BoxGeometry(0.34, 0.55, chLen + 0.6).translate(s * 0.98, 0.27, 0)));
    // the crack it comes from, a carved frame round its foot, and the water glinting in it (behind the bone)
    cave.add(M.ink, T(new THREE.BoxGeometry(0.6, 5.2, 2.6), [29.4, 3.4, -6.3], [0, chYaw, 0]));
    cave.both(caveStone, T(new THREE.BoxGeometry(0.9, 0.7, 3.6), [28.3, 2.9, -6.15], [0, chYaw, 0]));
    for (const [y, z, h, w] of [[3.5, -6.0, 3.8, 0.26], [2.3, -6.7, 1.6, 0.18], [4.7, -6.55, 1.3, 0.16], [1.6, -5.9, 0.9, 0.3]]) cave.add(M.glyph, T(new THREE.BoxGeometry(0.06, h, w), [29.05, y, z], [0, chYaw, 0.06]));
    // a damp streak down the dry trough (the water's old bed)
    {
      const pos = [], ix = [], n = 24;
      const side = V(-chDir.z, 0, chDir.x).normalize();
      for (let k = 0; k <= n; k++) {
        const u = k / n, c = along(u, -1.27), w = 0.32 + 0.08 * Math.sin(u * 17);
        for (const sgn of [-1, 1]) pos.push(c.x + side.x * w * sgn, c.y + 0.03, c.z + side.z * w * sgn);
      }
      for (let k = 0; k < n; k++) { const a = k * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }   // (facing up)
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(ix);
      cave.add(damp, g);
    }
    // the stream: none until the bone is clear, then it runs out of the crack and down to the pool
    // (desert.js reveals it along the channel, segment by segment: cv.flow 0..1)
    const streamMat = magicMaterial(23, { aspect: 0.25 });
    const w = (u) => cave.world(...along(u, -1.0).toArray());
    const STREAM_SEGS = 40;
    const stream = magicStream(w(0), w(1), 1.6, streamMat, { segs: STREAM_SEGS });
    stream.geometry.setDrawRange(0, 0);
    root.add(stream);
    // the fallen bone across the channel, near the wall: a great thigh bone, its knuckled ends on the trough's walls
    // (it moves, so it never collides)
    const boneAt = along(0.34, -0.42);   // (its shaft on the walls' tops: they stand 0.55 m over the bed)
    const bonePivot = new THREE.Group();
    bonePivot.position.copy(cave.world(boneAt.x, boneAt.y, boneAt.z));
    bonePivot.rotation.y = chYaw + Math.PI / 2;
    const femur = mergeGeometries([
      prep(taper([V(-3.6, 0.05, 0), V(-1.2, 0.35, 0.15), V(1.4, 0.35, 0.1), V(3.6, 0.0, -0.1)], 0.62, 0.55, 12, 8)),
      prep(new THREE.SphereGeometry(1, 10, 7).scale(1.0, 0.85, 1.15).translate(-4.0, 0.15, 0.25)), prep(new THREE.SphereGeometry(1, 10, 7).scale(0.8, 0.7, 0.8).translate(-3.9, 0.0, -0.75)),
      prep(new THREE.SphereGeometry(1, 10, 7).scale(1.05, 0.9, 1.3).translate(4.1, 0.0, 0.0)),
    ]);
    const ribMesh = new THREE.Mesh(femur, M.boneMesh);
    ribMesh.userData.noCollide = true;
    bonePivot.add(ribMesh);
    bonePivot.add(Object.assign(new THREE.Mesh(T(glyphGeometry(0.5), [0, 1.0, 0.62], [-0.4, 0, 0]), M.glyph), { userData: { noCollide: true } }));
    root.add(bonePivot);
    // the pool: none while the channel is blocked; it fills once the stream reaches it, widening
    // up the basin's steps as it rises (desert.js sets cv.level; the update below lays it there)
    const poolMat = magicMaterial(22);
    const pool = magicPool(1, poolMat, { rings: 10, segs: 56 });
    pool.position.copy(cave.world(0, -1.7, 0));
    pool.visible = false;
    pool.userData.water = true; pool.userData.waterMoves = true;   // you wade in it (water.js: it rises)
    root.add(pool);
    // the mural: giants lying down, the water running out of them to a tree
    cave.add(caveStone, T(new THREE.BoxGeometry(9, 4.6, 0.5), [-17.5, 3.4, 20.5], [0, Math.PI * 0.8, 0]));
    cave.add(M.ink, mural(8.4, 4.0, true).applyMatrix4(new THREE.Matrix4().compose(V(-17.5, 3.2, 20.5), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI * 0.8), V(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.26))));
    cave.add(M.glyph, glyphGeometry(1.4).applyMatrix4(new THREE.Matrix4().compose(V(-25.5, 7.5, -12), new THREE.Quaternion().setFromAxisAngle(UP, 1.1), V(1, 1, 1))));
    // the keepers' stair behind the pool, opposite the way in (HATCH.stair): eight blocks up to a ledge, a doorway framed in
    // bone in the dome's wall, dark beyond, and a root climbing beside it into the dark, the way the water goes up
    cave.flush();
    {
      const S = HATCH.stair, n = 8, run = (S.foot - S.ledge) / n, sk = new Kit(late, 'The keepers’ stair', O, 0);
      for (let k = 0; k < n; k++) {
        const top = (k + 1) * S.y / n, z = S.foot - (k + 0.5) * run;
        sk.both(M.stone, new THREE.BoxGeometry(3.0, top, run + 0.02).translate(0, top / 2, z));
      }
      sk.both(M.stone, new THREE.BoxGeometry(3.6, S.y, S.ledge - S.door + 1.4).translate(0, S.y / 2, (S.ledge + S.door - 1.4) / 2));   // the ledge, into the wall
      for (const s of [-1, 1]) sk.both(M.bone, new THREE.BoxGeometry(0.55, 3.2, 0.6).translate(s * 1.35, S.y + 1.6, S.door + 0.2));   // the jambs
      sk.both(M.bone, new THREE.BoxGeometry(3.3, 0.55, 0.7).translate(0, S.y + 3.45, S.door + 0.2));   // the lintel
      sk.add(M.ink, new THREE.PlaneGeometry(2.2, 3.2).translate(0, S.y + 1.6, S.door - 0.05));   // the dark beyond
      sk.solid(new THREE.BoxGeometry(2.4, 3.4, 0.4).translate(0, S.y + 1.7, S.door - 0.4));
      sk.add(M.bark, taper([V(2.2, -0.2, S.foot + 1.5), V(2.4, 1.6, S.ledge + 2), V(2.0, S.y + 1.2, S.door + 0.6), V(1.6, S.y + 6, S.door - 0.4)], 0.42, 0.18, 14, 6));
      sk.add(M.glyph, glyphGeometry(0.6).translate(0, S.y + 3.45, S.door + 0.56));   // the keepers' eye on the lintel
      sk.flush();
      cv.stairGroup = sk.group;
    }

    const pl = cave.world(0, 2, 0);
    const poolLight = new THREE.Vector4(pl.x, pl.y, pl.z, 26);
    // the gutter lit along its whole length: one light by the rib left its two ends in the dark, and in the
    // hatching the unlit half of the pipe read as filled with rubble, even with the water running down it
    const chLights = [0.06, 0.36, 0.66, 0.96].map((u) => { const p = cave.world(...along(u, 1.2).toArray()); return new THREE.Vector4(p.x, p.y, p.z, 8); });
    const entryLight = cave.world(0, 4, ROOM + 2);
    lights.push(poolLight, ...chLights, new THREE.Vector4(entryLight.x, entryLight.y, entryLight.z, 12));
    Object.assign(cv, {
      origin: O, poolCenter: cave.world(0, -1.25, 0), local: (x, y, z) => cave.world(x, y, z), poolR: POOL - 1, pool, poolMat, poolLight,
      bone: bonePivot, boneAt: bonePivot.position.clone(), boneRest: { pos: bonePivot.position.clone(), rot: bonePivot.rotation.clone() },
      boneAside: cave.world(boneAt.x - chDir.z * 3.4, 0.55, boneAt.z + chDir.x * 3.4),
      stream, streamMat, chDir, rootTips,
      // the stream's way: its head at u (0 the crack, 1 the pool's edge), and the crack it runs out of (a moment frames them: desert.js)
      streamAt: (u, out = V(0, 0, 0)) => out.copy(cave.world(...along(THREE.MathUtils.clamp(u, 0, 1), -1.0).toArray())), crack: cave.world(29.6, 3.6, -6.4), mural: cave.world(-17.5, 0, 20.5).add(V(Math.sin(Math.PI * 0.8) * 2.5, 0, Math.cos(Math.PI * 0.8) * 2.5)),
      inside: cave.world(0, 0.05, ROOM + 5.5), exit: cave.world(0, 0, ROOM + 9.3), group: cave.group, root,
      // the keepers' stair: its foot, and the doorway at its top (the way up to the hatch in the back lane)
      stairFoot: cave.world(0, 0, HATCH.stair.foot + 1), stairTop: cave.world(0, HATCH.stair.y, HATCH.stair.door + 0.9),
      // the water (desert.js drives these): dry (the bed) until the channel opens, then up to high
      levels: { dry: -1.7, high: -0.35 }, level: -1.7, flow: 0, basinR,
      /** Lay the stream (flow 0..1 of the way from the crack) and the pool (standing at `level`) as they are. */
      setWater(flow, level) {
        cv.flow = flow; cv.level = level;
        stream.geometry.setDrawRange(0, Math.round(THREE.MathUtils.clamp(flow, 0, 1) * STREAM_SEGS) * 8 * 6);
        const r = basinR(level) - 0.1;
        cv.wet = level > cv.levels.dry + 0.02 && r > 0.3;
        pool.position.y = O.y + level;
        pool.scale.set(Math.max(r, 0.01), 1e-3, Math.max(r, 0.01));
      },
    });
  }
  out.cave = cv;
  // the way down: the skull's mouth ↔ the passage
  const gd = out.giant.door, fwd = V(Math.sin(G.yaw), 0, Math.cos(G.yaw));
  portals.push(
    { at: gd.clone().addScaledVector(fwd, -0.3).add(V(0, 0.4, 0)), r: 1.5, to: cv.inside.clone(), heading: Math.PI, label: 'giant’s mouth' },
    { at: cv.exit.clone().add(V(0, 0.5, 0)), r: 1.6, to: gd.clone().addScaledVector(fwd, 3.2), heading: G.yaw, label: 'passage up' },
    // the keepers' stair up to the hatch in the back lane, coming out facing the tree (one way: the hatch only lifts from below)
    { at: cv.stairTop.clone().add(V(0, 0.5, 0)), r: 1.4, to: out.hatch.out.clone(), heading: C.yaw, label: 'the keepers’ stair', oneWay: true },
  );

  // ---------------------------------------------------------------- per frame
  const _cam = V(0, 0, 0);
  // what moves is only animated when it's in view, and less often far away
  const frustum = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();
  const seen = (p, r) => frustum.intersectsSphere(_sph.set(p, r));
  let frameNo = 0, treeDt = 0, smokeDt = 0, campDt = 0, breathDt = 0;
  const smokeMid = V(0, 0, 0);
  out.update = (dt, t, { camera, player }) => {
    _cam.copy(camera.position);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    frameNo++;
    for (const b of banners) if (b.mesh.position.distanceToSquared(_cam) < 160 * 160 && seen(b.mesh.position, 6)) b.update(t);
    const dCity = _cam.distanceTo(out.city.center);
    for (const s of smokes) if (s.at.distanceToSquared(_cam) < 700 * 700 && seen(s.mid, 18)) s.update(dt, t, player?.wind);
    for (const u of updaters) if (_cam.distanceTo(u.near) < u.r && seen(u.near, 60)) u.f(dt, t);
    // the flame is only a few uniforms to update: every frame, so it runs at one steady pace at any
    // distance (thinning it out far away made it judder, and look faster or slower as you ran)
    treeDt += dt;
    const lit = out.city.lit > 0.001;
    if (dCity < 1500 && seen(out.city.crown, 80)) { out.city.flames.update(treeDt, t); treeDt = 0; }
    // sparks are a close-up detail (far away they'd read as specks of ink); none from a cold tree
    out.city.embers.mesh.visible = lit && dCity < 220;
    if (lit && dCity < 220 && seen(out.city.crown, 40)) out.city.embers.update(dt, t, player?.wind);
    // the smoke column: always drawn (it is the way to the city), animated while in view, less often far away
    smokeDt += dt;
    const sm = out.city.smoke, sEvery = dCity < 400 ? 1 : 2;
    if (lit && frameNo % sEvery === 0 && seen(smokeMid.copy(sm.at).addScaledVector(sm.wind, sm.drift * sm.windK * 0.35).setY(sm.at.y + sm.height * 0.6), sm.height * 0.75)) { sm.update(smokeDt, t, player?.wind, camera); smokeDt = 0; }
    // the camps' smoke for the stragglers: only while the tree is cold
    const cs = out.campSmoke, csOn = out.city.lit < 0.5;
    cs.mesh.visible = csOn;
    campDt += dt;
    if (csOn && frameNo % 2 === 0 && seen(smokeMid.copy(cs.at).setY(cs.at.y + cs.height * 0.5), cs.height * 0.7)) { cs.update(campDt, t, player?.wind, camera); campDt = 0; }
    // and the giant's breath over the back gate, while the tree is cold
    const gb = out.giantBreath;
    if (gb) {
      gb.mesh.visible = csOn;
      breathDt += dt;
      if (csOn && frameNo % 2 === 1 && seen(smokeMid.copy(gb.at).setY(gb.at.y + gb.height * 0.5), gb.height * 0.7)) { gb.update(breathDt, t, player?.wind, camera); breathDt = 0; }
    }
    // the cave: drawn only when you're down there
    const inCave = _cam.distanceTo(O) < 300;
    cv.group.visible = inCave; if (cv.stairGroup) cv.stairGroup.visible = inCave; cv.pool.visible = inCave && cv.wet; cv.stream.visible = inCave && cv.flow > 0; cv.bone.visible = inCave;
  };
  return out;
}

/** The recurring glyph: three dots over an arc, as flat shapes (facing +z). */
export function glyphGeometry(s = 1) {
  const parts = [];
  for (const [x, y] of [[-0.62, 0.55], [0, 0.75], [0.62, 0.55]]) parts.push(new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 0.08 * s, 10).rotateX(Math.PI / 2).translate(x * s, y * s, 0));
  parts.push(new THREE.TorusGeometry(0.95 * s, 0.09 * s, 4, 18, Math.PI * 0.7).rotateZ(Math.PI * 0.15).translate(0, -0.72 * s, 0));
  return mergeGeometries(parts.map((g) => prep(g)));
}

/**
 * A carved relief in flat ink: kneeling giants carrying water toward a burning tree
 * (or, lying = true, giants lying down with the water running out of them to a tree).
 */
function mural(w, h, lying = false) {
  const parts = [], add = (g) => parts.push(prep(g));
  const box = (x, y, bw, bh, r = 0) => add(new THREE.BoxGeometry(bw, bh, 0.06).rotateZ(r).translate(x, y, 0));
  const disc = (x, y, r) => add(new THREE.CylinderGeometry(r, r, 0.06, 12).rotateX(Math.PI / 2).translate(x, y, 0));
  const X = (u) => (u - 0.5) * w, Y = (v) => (v - 0.5) * h;
  // the tree on the right: a trunk, arms, flames as triangles
  box(X(0.86), Y(0.42), w * 0.035, h * 0.5);
  for (const s of [-1, 1]) { box(X(0.86) + s * w * 0.04, Y(0.7), w * 0.02, h * 0.22, -s * 0.5); add(new THREE.ConeGeometry(w * 0.025, h * 0.13, 3).translate(X(0.86) + s * w * 0.08, Y(0.86), 0).scale(1, 1, 0.1)); }
  add(new THREE.ConeGeometry(w * 0.03, h * 0.17, 3).translate(X(0.86), Y(0.88), 0).scale(1, 1, 0.1));
  // wavy water lines along the bottom
  for (let i = 0; i < 9; i++) box(X(0.05 + i * 0.1), Y(0.08) + Math.sin(i * 1.7) * h * 0.012, w * 0.07, h * 0.018, Math.sin(i) * 0.1);
  if (!lying) {
    // three giants, bent under jars, walking toward the tree
    for (let k = 0; k < 3; k++) {
      const u = 0.14 + k * 0.22, s = 1 - k * 0.12;
      box(X(u), Y(0.42) * s, w * 0.05 * s, h * 0.38 * s, 0.35);                     // body, bent forward
      disc(X(u + 0.05 * s), Y(0.62) * s, h * 0.05 * s);                             // head
      box(X(u - 0.02), Y(0.18) * s, w * 0.02, h * 0.26 * s, -0.25);                  // leg
      add(new THREE.CylinderGeometry(w * 0.03 * s, w * 0.045 * s, h * 0.14 * s, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(X(u + 0.07 * s), Y(0.7) * s, 0).scale(1, 1, 0.3));   // the jar
      box(X(u + 0.06), Y(0.55) * s, w * 0.018, h * 0.15 * s, -0.7);                 // the arm holding it
    }
  } else {
    // giants lying down, end to end, a stream from each toward the tree
    for (let k = 0; k < 3; k++) {
      const u = 0.12 + k * 0.24;
      box(X(u), Y(0.24), w * 0.17, h * 0.06);
      disc(X(u + 0.1), Y(0.25), h * 0.045);
      box(X(u + 0.13), Y(0.16), w * 0.09, h * 0.018, -0.15);
    }
  }
  return mergeGeometries(parts);
}

/** The procession's circuit as a smooth loop on the sand, a point every ~3 m (each at the ground's height). */
export function processionPath(terrain, step = 3) {
  return processionLoop(step).map(([x, z]) => new THREE.Vector3(x, terrain.heightAt(x, z), z));
}

/** Crowd placement for the desert: the procession's circuit, the camps' circles and benches. */
export function desertCrowdSpots(terrain, story) {
  const V3 = (x, z, dy = 0) => new THREE.Vector3(x, terrain.heightAt(x, z) + dy, z);
  const groups = [], walks = [], edges = [];
  const rng = mulberry32(919);
  walks.push({
    id: 'procession', path: processionPath(terrain), loop: true, column: true,
    n: 72, lanes: 3, gap: 0.8, spread: [0, 0.05], speed: 1.12, lateral: 0.35, keepRight: 0,
    roles: ['banner', 'lantern', 'banner', 'drum', null, null, 'banner', null, 'banner', null, null, null, null, null, 'banner', null, null, null, null, null, null, 'banner', null, null, 'lantern', null, null, null, null, 'banner'],
    lines: story.lines.procession,
  });
  const camps = story.camps;
  // people round the two small fires, on the benches and in circles between the tents
  for (const s of story.seats) {
    if (s.reserved) continue;
    edges.push({ at: s.at.clone(), heading: s.heading, pose: 'kerb', lines: story.lines.camp, id: 'camp' });
  }
  const circles = [[-6, 12], [6, 14], [-20, -1], [20, 8], [-3, -16], [12, -2], [-14, 30], [18, 30], [0, 22], [-26, 20], [27, -8], [-9, 40], [9, 42]];
  for (const [x, z] of circles) {
    const p = camps.spot(x + (rng() - 0.5) * 2, z + (rng() - 0.5) * 2);
    groups.push({ at: V3(p.x, p.z), n: 2 + Math.floor(rng() * 3), lines: story.lines.camp, id: 'camp' });
  }
  // a few by the gate and in the avenue, waiting
  for (let k = 0; k < 5; k++) {
    const g = story.city.gate, d = story.city.center.clone().sub(g).setY(0).normalize();
    const p = g.clone().addScaledVector(d, -6 - k * 5).add(new THREE.Vector3(-d.z, 0, d.x).multiplyScalar((k % 2 ? 1 : -1) * (6 + rng() * 3)));
    groups.push({ at: V3(p.x, p.z), n: 2 + (k % 2), lines: story.lines.gate, id: 'gate' });
  }
  return {
    groups, walks, edges, farMax: 520, costume: 'desert',
    palette: { cloaks: ['#c8483a', '#5fb7ad', '#d8a24a', '#8a6fb8', '#e6875f', '#f3ead8', '#62c3c9', '#e88fa6', '#dca273', '#c3a9cc', '#f3ead8', '#f3ead8'], hats: ['#d8a24a', '#e6875f', '#f3ead8', '#c8483a', '#f3ead8'] },
  };
}

export { FIRE, COOL_FIRE };
