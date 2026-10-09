import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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

// The desert's story places (references/IMG_3772-3775: pale rose domes,
// cream walls, bone, flat sky):
//   the old city of Qanat   a walled ring of domes and tower-houses on
//                           stepped terraces round the burning tree; the
//                           dry well at its roots and a carved stele
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
    terrace: makeMaterial({ color: '#ead2bc', color2: '#dfbea4', color3: '#f3e1cd', mode: MODE_STRATA, strataSize: 1.1, flat: true, weathered: 0.8 }),
    paving: makeMaterial({ color: '#e9d6bf', grid: 2.2, flat: true }),
    white: paint('#f6efe0'), pink: paint('#e9a99a'), rose: paint('#dd8f86'), ochre: paint('#e6b86f'), teal: paint('#5fb7ad'), lav: paint('#b7a0cf'),
    // domes are smooth (no facets on the shadow line)
    dWhite: paint('#f6efe0', { smooth: true }), dPink: paint('#e9a99a', { smooth: true }), dRose: paint('#dd8f86', { smooth: true }),
    dTeal: paint('#5fb7ad', { smooth: true }), dLav: paint('#b7a0cf', { smooth: true }), dOchre: paint('#e6b86f', { smooth: true }),
    dark: paint('#34405e'),
    ink: paint('#2b211f'),
    bark: makeMaterial({ color: '#4a3a42', color2: '#5a4650', color3: '#3e3038', mode: MODE_STRATA, strataSize: 0.9, flat: true }),
    char: paint('#2f2830'),
    bone: paint('#f2ead6', { smooth: true }),
    boneDark: paint('#d9cdb2', { smooth: true }),
    stone: paint('#c9b8a0'),
    stoneDS: paint('#c9b8a0', { side: THREE.DoubleSide }),
    wood: paint('#8a5a3c'),
    rope: paint('#716c70'),
    red: paint('#c8483a'),
    cloth: ['#c8483a', '#5fb7ad', '#d8a24a', '#8a6fb8', '#e6875f', '#f3ead8', '#62c3c9', '#e88fa6'].map((c) => paint(c, { side: THREE.DoubleSide })),
    cave: makeMaterial({ color: '#7d6a8a', color2: '#6d5b7c', color3: '#8f7c9a', mode: MODE_STRATA, strataSize: 1.6, flat: true }),
    caveFloor: makeMaterial({ color: '#8a7890', color2: '#7a6880', color3: '#9a88a0', mode: MODE_STRATA, strataSize: 0.6, flat: true, side: THREE.DoubleSide }),
    mural: makeMaterial({ color: '#e9dcc0', flat: true, grid: 0.9 }),
    glyph: makeMaterial({ color: '#70e7df', glow: 0.85, flat: true }),
    // the makers' own stone (the tree's pedestal): pale, finely bedded, carved with their inscriptions; their blue for its bands
    makers: makeMaterial({ color: '#e4dcea', color2: '#d6cce0', color3: '#ece4ef', mode: MODE_STRATA, strataSize: 0.7, flat: true, grid: 0.8, glyphs: true }),
    makersBlue: makeMaterial({ color: '#25386c', flat: true }),
    dry: paint('#5a4a40'),
    boneMesh: makeMaterial({ color: '#f2ead6' }),
  };
}

// ------------------------------------------------------------------ the city
export function buildDesertCity(scene, terrain) {
  const root = new THREE.Group(); root.name = 'Desert story'; scene.add(root);
  const M = materials();
  const lights = [], portals = [], banners = [], smokes = [], updaters = [];
  const out = { root, lights, portals, banners, sites: {}, seats: [], fires: [] };
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

    // paving in the avenue and round the terraces (flush with the ground you walk on: 2 cm proud)
    city.add(M.paving, new THREE.BoxGeometry(11, 0.12, 40).translate(0, -0.04, 45));
    city.add(M.paving, new THREE.CylinderGeometry(30, 30, 0.1, 40).translate(0, -0.03, 0));

    // houses: domes, cubes and tall tower-houses between the wall and the terraces
    const HOUSE_MATS = [M.white, M.white, M.pink, M.ochre, M.wall];
    const DOME_MATS = [M.dWhite, M.dPink, M.dRose, M.dTeal, M.dLav, M.dWhite];
    const placed = [];
    const clear = (x, z, r) => {
      if (Math.abs(x) < 7.5 + r && z > 20) return false;          // the avenue to the gate
      if (Math.abs(x) < 5 + r && z < -20) return false;           // the back lane
      if (Math.hypot(x, z) < 31 + r || Math.hypot(x, z) > R - 4 - r) return false;
      return placed.every((p) => Math.hypot(p.x - x, p.z - z) > p.r + r + 2.2);
    };
    for (let tries = 0; tries < 700 && placed.length < 46; tries++) {
      const a = rng() * Math.PI * 2, d = 33 + rng() * 27, x = Math.sin(a) * d, z = Math.cos(a) * d;
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

    // the terraces round the tree: three tiers, stairs toward both gates
    const TIERS = [[25, 2.2], [17.5, 4.4], [11.5, 6.6]];
    // (the lip is a band round the edge, flush with the top: the feet stand where the paving is drawn,
    // and the collider is as round and as wide as the lip, so you don't drop off its edge early)
    for (const [r, h] of TIERS) {
      city.both(M.terrace, new THREE.CylinderGeometry(r, r + 0.4, h, 40).translate(0, h / 2, 0), new THREE.CylinderGeometry(r + 0.25, r + 0.4, h, 40).translate(0, h / 2, 0));
      city.add(M.wall, new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.35, 40).translate(0, h - 0.155, 0));   // a lip
    }
    // stairs: 0.37 m steps up each tier, on the gate side and the back
    for (const dir of [1, -1]) {
      let y = 0;
      for (let k = 0; k < TIERS.length; k++) {
        const [r, h] = TIERS[k], rOut = k === 0 ? 31 : TIERS[k - 1][0] - 0.3;
        const n = Math.round((h - y) / 0.37), run = rOut - r - 0.4;
        for (let s = 0; s < n; s++) {
          const top = y + (s + 1) * (h - y) / n, zf = rOut - (s / n) * run, zb = r - 1.5;
          city.both(M.terrace, new THREE.BoxGeometry(6.5, top, zf - zb).translate(0, top / 2, ((zf + zb) / 2) * dir));
        }
        y = h;
      }
    }
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
    const top = TIERS[2][1];
    const TREE = { x: 0, z: -3 }, S = 1.45;   // S: the tree's size (the limbs and flames scale with it)
    // a gnarled trunk: a lathe, twisted and roughened, flaring into roots
    const PROFILE = [[5.8, -0.3], [4.6, 0.8], [3.9, 2.5], [3.6, 6 * S], [3.2, 10 * S], [2.9, 14 * S], [3.0, 17 * S], [3.4, 19.5 * S]];
    const gnarl = (y, th) => 1 + 0.12 * Math.sin(th * 5 + y * 0.4) + 0.06 * Math.sin(y * 1.3);
    const twist = (g) => {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), tw = y * 0.045;
        const n = gnarl(y, Math.atan2(z, x));
        p.setXYZ(i, (x * Math.cos(tw) - z * Math.sin(tw)) * n, y, (x * Math.sin(tw) + z * Math.cos(tw)) * n);
      }
      g.computeVertexNormals();
      return g.translate(TREE.x, top, TREE.z);
    };
    // the bark's radius at angle th (atan2(z, x) round the axis) and height y over the terrace
    const profileR = (y) => {
      for (let i = 1; i < PROFILE.length; i++) if (y <= PROFILE[i][1]) { const [r0, y0] = PROFILE[i - 1], [r1, y1] = PROFILE[i]; return r0 + (r1 - r0) * THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1); }
      return PROFILE[PROFILE.length - 1][0];
    };
    const barkR = (th, y) => profileR(y) * gnarl(y, th - y * 0.045);
    // collision is the bark itself (it used to be a plain cone, up to 0.7 m proud of it, so a
    // climber's hands hung in the air), minus the foot's flare, which is drawn over the roots
    // (shut at both ends: under the terrace, and a low crown over the top, between the limbs)
    const CROWN = [[2.3, 19.5 * S + 0.5], [0, 19.5 * S + 0.8]];
    city.both(M.bark, twist(lathe([[0, -0.3], ...PROFILE, ...CROWN], 18)), twist(lathe([[0, -0.3], [4.75, -0.3], ...PROFILE.slice(1), ...CROWN], 18)));
    // the makers' pedestal (below): a carved dais high on the trunk, over a buttress root, toward the old shrine's corner
    const LEDGE = { phi: -0.5, H: 3.2, H2: 7.2, shoulder: 1.6 };   // H the root's shoulder, H2 the dais, over the terrace
    // roots over the terrace, some curling down its sides (none where the pedestal's buttress stands)
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2 + 0.4, ca = Math.sin(a), sa = Math.cos(a);
      if (Math.abs(Math.atan2(Math.sin(a - LEDGE.phi), Math.cos(a - LEDGE.phi))) < 0.4) continue;
      // (each grows out of the bark: it starts well inside the trunk, whose knots dip to r 3.6 here)
      // (they are solid, so feet no longer sink up to 1.9 m into them; they lie about 0.4 m proud of the
      // paving all the way out, low enough to step over, so the terrace is still walked round)
      const pts = [V(TREE.x + ca * 2, top - 0.5, TREE.z + sa * 2), V(TREE.x + ca * 6.5, top - 0.3, TREE.z + sa * 6.5), V(TREE.x + ca * 10.5, top - 0.1, TREE.z + sa * 10.5), V(TREE.x + ca * 12.2, top - 2.5, TREE.z + sa * 12.2)];
      city.both(M.bark, taper(pts, 0.9, 0.3, 12, 6));
    }
    // limbs: a candelabrum of six arms reaching up and out, each ending in a flame
    const limbs = [];
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.2, ca = Math.sin(a), sa = Math.cos(a), reach = (9 + (k % 2) * 4) * S, rise = (13 + (k % 3) * 3) * S, fork = 17 * S;
      const p0 = V(TREE.x + ca * 0.6, top + fork - 1.2 * S, TREE.z + sa * 0.6);   // (inside the trunk, so the limb grows out of it)
      const p1 = V(TREE.x + ca * reach * 0.6, top + fork + 2.5 * S, TREE.z + sa * reach * 0.6);
      const p2 = V(TREE.x + ca * reach, top + fork + rise * 0.55, TREE.z + sa * reach);
      const p3 = V(TREE.x + ca * reach * 1.05, top + fork + rise, TREE.z + sa * reach * 1.05);
      city.add(M.bark, taper([p0, p1, p2, p3], 1.5 * S, 0.55 * S, 18, 7));
      city.solid(taper([p0, p1, p2, p3], 1.3 * S, 0.5 * S, 6, 5));
      limbs.push(p3);
    }
    // the fire: one great 3D flame over the whole crown, its arms reaching into it (story/flames.js FlameBody)
    const treeOrigin = city.world(0, 0, 0);
    const treeGroup = new THREE.Group();
    treeGroup.position.copy(treeOrigin); treeGroup.quaternion.setFromAxisAngle(UP, C.yaw);
    root.add(treeGroup);
    // (wide enough, and wide high enough, to swallow every limb: the tips reach 14 m out and 36 m up;
    // whole low down, torn into tongues only over the crown; a great fire, so it runs slow)
    const flames = new FlameBody(treeGroup, { at: V(TREE.x, top + 13 * S, TREE.z), width: 36 * S, height: 50 * S, seed: 7, belly: 0.5, pace: 0.45, torn: 1.1, cover: 1 });
    // climb into it and it burns (src/hazards.js): its volume, from just over the fork to the tip
    // (only while it burns: the tree stands cold until it is lit, src/story/desert.js)
    { const lo = city.world(TREE.x, top + 14 * S, TREE.z), hi = city.world(TREE.x, top + 62 * S, TREE.z);
      const h = flameHazard({ x: lo.x, z: lo.z, y0: lo.y, y1: hi.y, rMax: 15 * S, belly: 0.4, dps: HAZARD_DPS.fire }), test = h.test;
      h.test = (p) => (out.city?.lit ?? 1) > 0.5 && test(p);
      registerHazard(h); }
    const crown = city.world(TREE.x, top + 30 * S, TREE.z);
    const embers = new Embers(root, [...limbs.map((p) => city.world(p.x, p.y + 5 * S, p.z)), crown], { count: 70, rise: 2.4, life: 6, spread: 3, size: 0.6, color: '#fff3c4' });
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
    // used to cap the well's mouth with an invisible floor 1.1 m over the terrace)
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

    // the makers' pedestal: high up the trunk, a carved stone dais on a stone pier, the pier standing
    // on the shoulder of a buttress root that rises out of the terrace. On the dais, on a low drum
    // ringed with the makers' light, the box that holds the backpack (src/boxes/placements.js:
    // 'desert.backpack'), out in the open where you see it from the stairs. A real little climb, in
    // two pitches: up the root's face onto its shoulder, then up the pier's face and over the dais's
    // edge (player.js tryMantle), where there is room to stand in front of the box.
    // Ledge frame L: x across, y up from the terrace, z out from the tree's axis (toward phi).
    const { phi, H, H2 } = LEDGE;
    const lM = new THREE.Matrix4().compose(V(TREE.x, top, TREE.z), new THREE.Quaternion().setFromAxisAngle(UP, phi), V(1, 1, 1));
    const lg = (g) => g.applyMatrix4(lM);
    const lToCity = (x, y, z) => V(x, y, z).applyMatrix4(lM);
    // the bark's reach along the dais (the twist and the knots), so the box sits just clear of it
    const reach = (x, z, y) => { const p = lToCity(x, 0, z); return Math.hypot(p.x - TREE.x, p.z - TREE.z) - barkR(Math.atan2(p.z - TREE.z, p.x - TREE.x), y); };
    const DRUM = { r: 0.86, h: 0.55 };   // (tall enough that the box shows over the dais's edge from the stairs)
    let sBack = 2.5;
    for (; sBack < 6; sBack += 0.05) {
      let clear = true;
      for (let x = -0.85; x <= 0.85 && clear; x += 0.17) for (let y = H2 + DRUM.h; y <= H2 + DRUM.h + 1.5 && clear; y += 0.3) if (reach(x, sBack, y) < 0.12) clear = false;
      if (clear) break;
    }
    const BOX_HALF = 0.55;                 // half the box's depth (src/boxes/model.js BOX.d * BOX_SCALE / 2)
    const sC = sBack + BOX_HALF;           // the box's centre
    const sF2 = sC + 2.3;                  // the dais's front edge (the pier's face): room to stand, and for the climb's last reach
    const sF = sF2 + LEDGE.shoulder;       // the root's face, its shoulder between the two
    const sIn = sBack - 1.1;               // well into the bark
    const stoneM = M.makers, trimM = M.makersBlue;
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
      // two roots twisting down its sides into the terrace
      for (const s of [-1, 1]) city.add(M.bark, lg(taper([V(s * 0.62, H - 0.6, sF - 1.5), V(s * 1.25, H * 0.5, sF - 0.9), V(s * 1.5, 0.15, sF - 0.6), V(s * 1.7, -0.25, sF - 0.3)], 0.42, 0.2, 10, 6)));
      // the makers' mark on its face, and offering cloths tied to the shoulder's corners
      city.add(M.glyph, lg(glyphGeometry(0.42).translate(0, 1.75, sF + 0.06)));
      [[-1, 0, 1.25], [1, 1, 0.95]].forEach(([s, c, len]) => city.add(M.cloth[c], lg(new THREE.PlaneGeometry(0.2, len).translate(s * (BW / 2 - 0.08), H - 0.1 - len / 2, sF + 0.02))));
    }
    // ---- the pier: a carved stone column on the shoulder, its front face flat and plumb (the second pitch)
    const PW = 1.6, pIn = sIn, pD = sF2 - pIn;
    city.both(stoneM, lg(new THREE.BoxGeometry(PW, H2 - H + 0.02, pD).translate(0, (H + H2) / 2 - 0.01, pIn + pD / 2)));
    // its foot (a plinth on the shoulder, set back from the face) and bands of the makers' blue up it
    city.add(stoneM, lg(new THREE.BoxGeometry(PW + 0.36, 0.34, pD - 0.1).translate(0, H + 0.17, pIn + (pD - 0.1) / 2 - 0.04)));
    for (const y of [H + 1.2, H2 - 1.0]) city.add(trimM, lg(new THREE.BoxGeometry(PW + 0.04, 0.12, pD + 0.02).translate(0, y, pIn + pD / 2)));
    // a tall glyph inlaid in its face, lit like the root's mark
    city.add(M.glyph, lg(glyphGeometry(0.32).translate(0, (H + H2) / 2 + 0.15, sF2 + 0.03)));
    // ---- the dais: an eight-sided slab, a flat side flush with the pier's face, carried on corbels
    const DR = 2.15, DT = 0.42, dCos = Math.cos(Math.PI / 8), dZ = sF2 - DR * dCos;
    const dais = (r, h, y) => new THREE.CylinderGeometry(r, r, h, 8).rotateY(Math.PI / 8).translate(0, y, dZ);
    city.both(stoneM, lg(dais(DR, DT, H2 - DT / 2)));
    city.add(trimM, lg(dais(DR + 0.06, 0.13, H2 - DT + 0.09)));                         // its rim, a band of blue
    city.add(stoneM, lg(dais(DR - 0.25, 0.22, H2 - DT - 0.11)));                        // a step under it
    // under it, a capital flaring out of the column to carry it (its front stays behind the pier's face: the climb is clear)
    city.add(stoneM, lg(new THREE.CylinderGeometry(DR - 0.32, 0.85, 1.15, 8).rotateY(Math.PI / 8).translate(0, H2 - DT - 0.22 - 0.575, dZ)));
    city.add(trimM, lg(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 8).rotateY(Math.PI / 8).translate(0, H2 - DT - 0.22 - 1.15, dZ)));
    // a ring of glyphs round the dais's edge (the makers' signature, lit)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > Math.PI * 0.62) continue;   // (not on the sides sunk in the bark)
      const g = glyphGeometry(0.11).rotateY(a).translate(Math.sin(a) * (DR * dCos + 0.065), H2 - 0.2, dZ + Math.cos(a) * (DR * dCos + 0.065));
      city.add(M.glyph, lg(g));
    }
    // the drum the box sits on: a low round plinth with a ring of the makers' light round its rim
    city.both(stoneM, lg(new THREE.CylinderGeometry(DRUM.r, DRUM.r + 0.08, DRUM.h, 24).translate(0, H2 + DRUM.h / 2, sC)));
    city.add(M.glyph, lg(new THREE.TorusGeometry(DRUM.r + 0.02, 0.035, 5, 32).rotateX(Math.PI / 2).translate(0, H2 + DRUM.h - 0.07, sC)));
    city.add(trimM, lg(new THREE.CylinderGeometry(DRUM.r + 0.1, DRUM.r + 0.12, 0.08, 24).translate(0, H2 + 0.04, sC)));
    // two lamp posts either side of the drum: a stone post and a glowing orb on it
    for (const s of [-1, 1]) {
      const x = s * 1.5, z = sC + 0.25;
      city.both(stoneM, lg(new THREE.CylinderGeometry(0.11, 0.15, 1.05, 6).translate(x, H2 + 0.52, z)));
      city.add(trimM, lg(new THREE.CylinderGeometry(0.17, 0.13, 0.1, 6).translate(x, H2 + 1.08, z)));
      city.add(M.glyph, lg(new THREE.SphereGeometry(0.13, 10, 8).translate(x, H2 + 1.25, z)));
    }
    // behind the box, half sunk in the bark: a carved stone halo, the glyph at its crown
    city.add(stoneM, lg(new THREE.TorusGeometry(1.25, 0.11, 6, 28, Math.PI).translate(0, H2 + DRUM.h + 0.15, sC - 0.95)));
    city.add(M.glyph, lg(glyphGeometry(0.2).translate(0, H2 + DRUM.h + 1.55, sC - 0.88)));
    // a stone bench on the terrace below, under the tree's arm: where Nour keeps the chest company
    const BENCH = { x: -7.33, z: 2.22 }, footC = lToCity(0, 0, sF + 0.8), benchYaw = Math.atan2(footC.x - BENCH.x, footC.z - BENCH.z);
    city.both(M.stone, T(new THREE.BoxGeometry(1.5, 0.42, 0.5), [BENCH.x, 0.21 + top, BENCH.z], [0, benchYaw, 0]));
    city.add(M.cloth[1], T(new THREE.BoxGeometry(1.2, 0.04, 0.44), [BENCH.x, 0.44 + top, BENCH.z], [0, benchYaw, 0]));
    const toWorld = (x, y, z) => { const p = lToCity(x, y, z); return city.world(p.x, p.y, p.z); };
    // (ledge-local points: x across, y up from the terrace, z out from the chest's centre)
    const ledge = {
      box: toWorld(0, H2 + DRUM.h, sC), yaw: city.heading(phi), height: H2 + DRUM.h,
      at: (x, y, z) => toWorld(x, y, sC + z),
      foot: toWorld(0, 0, sF + 0.8),        // on the terrace in front of the buttress: push into it and climb
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
      flames, embers, smoke, light: treeLight, light2: treeLight2, wellWater, wellMat, yaw: C.yaw,
      plinthStair: city.world(0, 0, 31), local: (x, y, z) => city.world(x, y, z), top: city.world(0, top, 0).y,
      stairTop: city.world(0, top, 12.6), ledge,
      // the fire: 0 (the tree stands cold, no flame, no smoke, no sparks) .. 1 (burning). A new game starts
      // at 0; src/story/desert.js lights it once the spark-stone is set in the full well
      lit: 1,
      /** Set how far the fire has caught (0..1). From cold, the smoke column starts climbing from the crown. */
      setLit(k) {
        const c = out.city, was = c.lit;
        c.lit = THREE.MathUtils.clamp(k, 0, 1);
        c.flames.lit = c.lit;
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
        // a bat-wing awning on two poles (references/IMG_3775)
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
    // Reference: Walkable Jaw Entrance v2. Keep the existing portal at z=15.6,
    // but build a jaw and a vaulted mouth around the route, instead of a doorway painted on a ball.
    const skull = new THREE.SphereGeometry(13, 28, 18).scale(1, 0.82, 0.72);
    rough(skull, 0.35, 0.25, 3);
    skull.translate(0, 5.8, -1.5);
    giant.both(M.bone, skull);
    // Deep sockets with thick orbital rims and cheekbones, well above the mouth.
    for (const s of [-1, 1]) {
      giant.add(M.ink, T(new THREE.SphereGeometry(3.05, 16, 10), [s * 5.7, 8.8, 8.7], [0, s * 0.16, 0], [1.1, 0.8, 0.3]));
      giant.both(M.bone, T(new THREE.TorusGeometry(3.05, 0.42, 8, 24), [s * 5.7, 8.8, 9.15], [0, s * 0.16, s * -0.1], [1.15, 0.86, 1]));
      giant.both(M.boneDark, taper([V(s * 10, 5.5, 7), V(s * 8.5, 4.5, 11), V(s * 5.2, 2.2, 14)], 1.5, 0.9, 12, 8));
      giant.both(M.bone, taper([V(s * 5.5, -0.2, 12), V(s * 5.5, 0.35, 17), V(s * 3.6, -1.05, 21)], 0.9, 0.5, 14, 8));
    }
    // A nasal bridge and two narrow nasal cavities, then the upper dental arch.
    giant.both(M.bone, T(new THREE.SphereGeometry(2, 12, 8), [0, 7.5, 10], [0, 0, 0], [0.8, 1.5, 0.8]));
    for (const s of [-1, 1]) giant.add(M.ink, T(new THREE.ConeGeometry(0.75, 2.5, 3), [s * 0.65, 7.2, 11.35], [0, 0, s * -0.2], [1, 1, 0.3]));
    giant.both(M.bone, T(new THREE.TorusGeometry(4.7, 0.8, 8, 24, Math.PI), [0, 1.1, 13.4], [0, 0, 0], [1.12, 1, 1.2]));
    for (let i = -4; i <= 4; i++) {
      const y = 1.1 + Math.sqrt(4.7 ** 2 - (i * 1.02) ** 2);
      giant.both(M.bone, T(new THREE.CapsuleGeometry(0.48, 0.85, 3, 8), [i * 1.13, y - 0.55, 14], [0.08, 0, -i * 0.055]));
      if (Math.abs(i) > 2) giant.both(M.bone, T(new THREE.CapsuleGeometry(0.4, 0.6, 3, 8), [i * 1.34, 0.65, 17.3 - Math.abs(i) * 0.35], [0, 0, -i * 0.06]));
    }
    // A shallow bone tongue meets the sand. Its broad centre remains clear for walking.
    const jaw = new THREE.Shape();
    jaw.moveTo(-3.3, -13.8); jaw.lineTo(3.3, -13.8); jaw.quadraticCurveTo(5.2, -17, 4.4, -20.4);
    jaw.quadraticCurveTo(0, -23.2, -4.4, -20.4); jaw.quadraticCurveTo(-5.2, -17, -3.3, -13.8);
    const jawGeo = new THREE.ExtrudeGeometry(jaw, { depth: 0.22, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 12 }).rotateX(-Math.PI / 2).translate(0, -0.23, 0);
    const jawPos = jawGeo.attributes.position;
    for (let i = 0; i < jawPos.count; i++) jawPos.setY(i, jawPos.getY(i) - Math.max(0, jawPos.getZ(i) - 15) * 0.19);
    jawGeo.computeVertexNormals();
    giant.both(M.bone, jawGeo);
    giant.add(M.ink, T(new THREE.SphereGeometry(3.3, 16, 10), [0, 1.9, 10.1], [0, 0, 0], [1.1, 0.9, 0.1]));
    // Carved ribs lead the eye into the dark throat without obstructing the portal.
    for (const z of [10.7, 11.8]) giant.both(M.boneDark, T(new THREE.TorusGeometry(3.8, 0.18, 6, 20, Math.PI), [0, 0.3, z]));
    giant.add(M.glyph, T(glyphGeometry(1.05), [0, 12.1, 6.3], [-0.6, 0, 0]));
    // one arm reaching out of the sand: shoulder, elbow, a hand spread on the dune
    const sh = V(17, -1, 2), el = V(25, 8, 9), wr = V(31, 1.5, 17);
    const armPts = [[sh, el, 2.2, 1.7], [el, wr, 1.7, 1.2]];
    for (const [a, b, r0, r1] of armPts) {
      giant.both(M.bone, taper([a, a.clone().lerp(b, 0.5).add(V(0, 0.6, 0)), b], r0, r1, 10, 8));
    }
    giant.both(M.boneDark, new THREE.SphereGeometry(2.2, 10, 8).translate(el.x, el.y, el.z));
    for (let f = 0; f < 4; f++) {
      const a = -0.6 + f * 0.4, d = V(Math.sin(a + 0.6), 0, Math.cos(a + 0.6));
      const k1 = wr.clone().addScaledVector(d, 2.5).add(V(0, 0.4, 0)), k2 = wr.clone().addScaledVector(d, 5.2).add(V(0, -0.6, 0));
      giant.both(M.bone, taper([wr, k1, k2], 0.55, 0.32, 6, 6));
    }
    giant.flush();
    const door = giant.world(0, 0, 15.6);
    door.y = terrain.heightAt(door.x, door.z) + 0.05;
    out.giant = { local: (x, y, z) => giant.world(x, y, z), skull: giant.world(0, 4.5, 0), door, yaw: G.yaw, brow: giant.world(0, 12.1, 6.3), hand: giant.world(wr.x, wr.y, wr.z) };
  }

  // ================================================================ the cave
  const O = V(STORY.cave.x, STORY.cave.y, STORY.cave.z);
  const cave = new Kit(root, 'Cave of the giant’s heart', O, 0);
  const cv = {};
  {
    const POOL = 12.5, ROOM = 30;
    // the entrance passage on the +z side (the way back to the skull). First into the batches: from the
    // passage its walls hide the dome's far side and the room's floor, and drawn before them they keep
    // the GPU from painting those first (a third more fragments in the passage)
    cave.both(M.cave, new THREE.BoxGeometry(2.2, 6, 12).translate(-3.6, 3, ROOM + 4), new THREE.BoxGeometry(2.2, 6, 12).translate(-3.6, 3, ROOM + 4));
    cave.both(M.cave, new THREE.BoxGeometry(2.2, 6, 12).translate(3.6, 3, ROOM + 4), new THREE.BoxGeometry(2.2, 6, 12).translate(3.6, 3, ROOM + 4));
    cave.both(M.cave, new THREE.BoxGeometry(9.4, 1.5, 12).translate(0, 5.6, ROOM + 4));
    cave.both(M.caveFloor, new THREE.BoxGeometry(5, 0.5, 12).translate(0, -0.25, ROOM + 4));
    cave.add(M.ink, new THREE.PlaneGeometry(5, 4.8).rotateY(Math.PI).translate(0, 2.4, ROOM + 9.9));
    cave.solid(new THREE.BoxGeometry(6, 6, 0.5).translate(0, 3, ROOM + 10.2));
    // the floor: a shallow basin in the middle
    const prof = [[0, -1.7], [POOL - 2, -1.6], [POOL, -1.1], [POOL + 2.2, 0], [ROOM + 2, 0], [ROOM + 2, -1]];
    const fl = lathe(prof.map(([r, y]) => [r, y]), 36);
    cave.both(M.caveFloor, fl);   // (the basin collides as drawn: an 18-sided stand-in lay up to 0.5 m inside it)
    // the pool's bed as one flat disc (a lathe's centre is a needle a ray can slip through)
    cave.solid(new THREE.CylinderGeometry(POOL - 1.5, POOL - 1.5, 0.3, 16).translate(0, -1.75, 0));
    // the basin's floor height at radius r, and its radius at height y (where water standing at y meets it)
    const floorAt = (r) => { for (let i = 1; i < prof.length; i++) if (r <= prof[i][0]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return y0 + (y1 - y0) * (r - r0) / (r1 - r0); } return 0; };
    const basinR = (y) => { for (let i = 1; i < 4; i++) if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + (r1 - r0) * THREE.MathUtils.clamp((y - y0) / (y1 - y0), 0, 1); } return POOL + 2.2; };
    // dry until the channel runs: damp stains in the bowl, and a pale tide line where the water stood
    // (drawn just over the floor, following its slope)
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
    const damp = paint('#66546f', { side: THREE.DoubleSide }), salt = paint('#c4b6c6', { side: THREE.DoubleSide });
    cave.add(damp, stain(0.6, -0.4, 6.8, 1.3, 4, 30));
    for (const [x, z, r, sd] of [[8.6, -2.4, 2.4, 2.1], [6.0, 3.6, 1.6, 4.4], [-5.4, -4.2, 1.9, 0.7], [-2.6, 6.1, 1.2, 3.3]]) cave.add(damp, stain(x, z, r, sd));
    {
      const rTide = basinR(-0.35) - 0.05, ring = [], ix = [], n = 72;
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * Math.PI * 2, w = 0.09 + 0.05 * Math.sin(a * 5);
        for (const r of [rTide - w, rTide + w]) ring.push(Math.cos(a) * r, floorAt(r) + 0.025, Math.sin(a) * r);
      }
      for (let k = 0; k < n; k++) { const a = k * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));
      g.setIndex(ix);
      cave.add(salt, g);
    }
    // the dome, inside out, rough: the giant's chest
    const door = (x, y, z) => Math.abs(x) < 3.0 && y < 5.2 && z > 15;   // the opening to the passage
    const d = cut(inward(rough(new THREE.SphereGeometry(ROOM + 1, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.62, 1), 1.2, 0.18, 5)), door);
    cave.both(M.cave, d);   // (the rough dome collides as drawn: a smooth 14-sided one lay up to 1.6 m inside it)
    // ribs arching overhead, a breastbone ridge between them
    for (let k = 0; k < 7; k++) {
      const z = -18 + k * 6, w = Math.sqrt(Math.max(ROOM * ROOM - z * z, 40)) * 0.97;
      const pts = [V(-w, 0, z), V(-w * 0.78, 10.5, z * 1.02), V(0, 17.6, z * 1.05), V(w * 0.78, 10.5, z * 1.02), V(w, 0, z)];
      cave.both(M.bone, taper(pts, 1.05, 1.05, 24, 7));   // (the ribs come down to the floor: solid where they are drawn)
    }
    cave.both(M.boneDark, taper([V(0, 17.4, -22), V(0, 18.2, 0), V(0, 17.4, 20)], 1.4, 1.4, 14, 7));
    // the tree's roots hang down through the ribs into the pool
    const rootTips = [];
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.3, r0 = 2 + (k % 3) * 1.2, r1 = 5 + (k % 3) * 2.2, tw = 0.9 + (k % 2) * 0.5;
      const top = V(Math.sin(a) * r0, 18.8, Math.cos(a) * r0), tip = V(Math.sin(a + tw) * r1, -0.7 - (k % 2) * 0.4, Math.cos(a + tw) * r1);
      const m1 = V(Math.sin(a + tw * 0.3) * r0 * 1.8, 13, Math.cos(a + tw * 0.3) * r0 * 1.8), m2 = V(Math.sin(a + tw * 0.7) * r1 * 0.75, 6, Math.cos(a + tw * 0.7) * r1 * 0.75);
      cave.add(M.bark, taper([top, m1, m2, tip], 0.62 - (k % 3) * 0.1, 0.12, 20, 6));
      rootTips.push(cave.world(tip.x, tip.y + 0.5, tip.z));
    }
    cave.add(M.bark, taper([V(0, 19, 0), V(0.8, 13, -0.6), V(-0.5, 6, 0.5), V(0.2, -0.9, 0)], 1.25, 0.3, 18, 8));
    // the channel: a stone gutter on vertebrae, from a crack in the wall down to the pool
    const CH = { from: V(27.5, 3.4, -6), to: V(POOL - 0.6, -0.3, -2.6) };
    const chDir = CH.to.clone().sub(CH.from), chLen = chDir.length(); chDir.normalize();
    const chYaw = Math.atan2(chDir.x, chDir.z), chPitch = Math.asin(-chDir.y);
    const along = (u, lift = 0) => CH.from.clone().lerp(CH.to, u).add(V(0, lift, 0));
    const gutter = new THREE.CylinderGeometry(1.3, 1.3, chLen, 12, 1, true, -Math.PI / 2, Math.PI);   // a half pipe, open on top
    const gm = new THREE.Matrix4().compose(along(0.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + chPitch, chYaw, 0, 'YXZ')), V(1, 1, 1));
    cave.add(M.stoneDS, gutter.clone().applyMatrix4(gm));
    const floorY = (x, z) => { const r = Math.hypot(x, z); return r > POOL + 2.2 ? 0 : r > POOL ? -1.1 + 1.1 * (r - POOL) / 2.2 : -1.3; };
    for (let k = 0; k < 5; k++) {
      const p = along(0.08 + k * 0.2, -1.3), g = floorY(p.x, p.z), h = Math.max(p.y - g, 0.3);
      cave.both(M.bone, new THREE.CylinderGeometry(0.7, 0.95, h, 8).translate(p.x, g + h / 2, p.z));   // vertebrae carry it
    }
    cave.add(M.ink, T(new THREE.BoxGeometry(0.6, 4.5, 3.2), [29.6, 3.6, -6.4], [0, chYaw, 0]));   // the crack it comes from
    // a damp streak down the dry gutter (the water's old bed)
    {
      const pos = [], ix = [], n = 24;
      const side = V(-chDir.z, 0, chDir.x).normalize();
      for (let k = 0; k <= n; k++) {
        const u = k / n, c = along(u, -1.27), w = 0.32 + 0.08 * Math.sin(u * 17);
        for (const sgn of [-1, 1]) pos.push(c.x + side.x * w * sgn, c.y + 0.03 + Math.abs(w * sgn) * 0.04, c.z + side.z * w * sgn);
      }
      for (let k = 0; k < n; k++) { const a = k * 2; ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(ix);
      cave.add(damp, g);
    }
    // the stream: none until the rib is clear, then it runs out of the crack and down to the pool
    // (desert.js reveals it along the channel, segment by segment: cv.flow 0..1)
    const streamMat = magicMaterial(23, { aspect: 0.25 });
    const w = (u) => cave.world(...along(u, -1.0).toArray());
    const STREAM_SEGS = 40;
    const stream = magicStream(w(0), w(1), 1.6, streamMat, { segs: STREAM_SEGS });
    stream.geometry.setDrawRange(0, 0);
    root.add(stream);
    // the fallen rib across the channel (it moves, so it never collides)
    const boneAt = along(0.42, -0.45);
    const bonePivot = new THREE.Group();
    bonePivot.position.copy(cave.world(boneAt.x, boneAt.y, boneAt.z));
    bonePivot.rotation.y = chYaw + Math.PI / 2;
    const ribCurve = [V(-4.4, -0.2, 0), V(-2, 0.5, 0.3), V(1.5, 0.55, 0.2), V(4.6, -0.3, -0.3)];
    const ribMesh = new THREE.Mesh(taper(ribCurve, 0.85, 0.6, 14, 8), M.boneMesh);
    ribMesh.userData.noCollide = true;
    bonePivot.add(ribMesh);
    bonePivot.add(Object.assign(new THREE.Mesh(T(glyphGeometry(0.5), [0, 1.05, 0.55], [-0.4, 0, 0]), M.glyph), { userData: { noCollide: true } }));
    root.add(bonePivot);
    // the pool: none while the channel is blocked; it fills once the stream reaches it, widening
    // up the basin's sides as it rises (desert.js sets cv.level; the update below lays it there)
    const poolMat = magicMaterial(22);
    const pool = magicPool(1, poolMat, { rings: 10, segs: 56 });
    pool.position.copy(cave.world(0, -1.7, 0));
    pool.visible = false;
    pool.userData.water = true; pool.userData.waterMoves = true;   // you wade in it (water.js: it rises)
    root.add(pool);
    // the mural: giants lying down, the water running out of them to a tree
    cave.add(M.mural, T(new THREE.BoxGeometry(9, 4.6, 0.5), [-17.5, 3.4, 20.5], [0, Math.PI * 0.8, 0]));
    cave.add(M.ink, mural(8.4, 4.0, true).applyMatrix4(new THREE.Matrix4().compose(V(-17.5, 3.2, 20.5), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI * 0.8), V(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.26))));
    cave.add(M.glyph, glyphGeometry(1.4).applyMatrix4(new THREE.Matrix4().compose(V(-25.5, 7.5, -12), new THREE.Quaternion().setFromAxisAngle(UP, 1.1), V(1, 1, 1))));
    cave.flush();

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
      boneAside: cave.world(boneAt.x - chDir.z * 3.4, -0.1, boneAt.z + chDir.x * 3.4),
      stream, streamMat, chDir, rootTips,
      // the stream's way: its head at u (0 the crack, 1 the pool's edge), and the crack it runs out of (a moment frames them: desert.js)
      streamAt: (u, out = V(0, 0, 0)) => out.copy(cave.world(...along(THREE.MathUtils.clamp(u, 0, 1), -1.0).toArray())), crack: cave.world(29.6, 3.6, -6.4), mural: cave.world(-17.5, 0, 20.5).add(V(Math.sin(Math.PI * 0.8) * 2.5, 0, Math.cos(Math.PI * 0.8) * 2.5)),
      inside: cave.world(0, 0.05, ROOM + 5.5), exit: cave.world(0, 0, ROOM + 9.3), group: cave.group, root,
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
  );

  // ---------------------------------------------------------------- per frame
  const _cam = V(0, 0, 0);
  // what moves is only animated when it's in view, and less often far away
  const frustum = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere();
  const seen = (p, r) => frustum.intersectsSphere(_sph.set(p, r));
  let frameNo = 0, treeDt = 0, smokeDt = 0;
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
    // the cave: drawn only when you're down there
    const inCave = _cam.distanceTo(O) < 300;
    cv.group.visible = inCave; cv.pool.visible = inCave && cv.wet; cv.stream.visible = inCave && cv.flow > 0; cv.bone.visible = inCave;
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
