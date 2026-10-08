import * as THREE from 'three';
import { wallOpenings } from './wall-openings.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA, MODE_WATER } from './materials.js';
import { SandDrifts } from './sand-drifts.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from './noise.js';
import { heightFn } from './world.js';
import { basinHeight } from './desert-vistas.js';
import { SITES, POLE_LINE, STORY } from './desert-sites.js';

// The structures of the desert reference pages (references/IMG_3772-3775),
// built as destinations across the three regions:
//   golden dunes : a half-buried leviathan carcass, a crashed hull with a
//                  salvage camp, the traveller's camp, bat-wing sail tents
//   rose canyons : a gorge between stepped walls with two rope bridges and a
//                  turquoise stream, a grove of giant umbrella canopies
//   salt flats   : a petal station (a sunburst of cupped petals round a
//                  glass cage), turquoise salt lagoons under a lavender
//                  table cliff, a telegraph line, a radio-dish array
// Render geometry is merged per material per landmark (compact meshes that
// still frustum-cull); collision comes from coarse hidden proxies only.

const noiseL = createNoise2D(4242);

// ------------------------------------------------------------------ lagoons
// The salt lagoons are carved into the terrain: the ground levels out to a
// crust, and irregular pools sink below the water line.
const LAGOON = SITES.lagoons;
export const LAGOON_DEPTH = 1.7;
let lagoonLevel = null;
const level = () => lagoonLevel ??= basinHeight(LAGOON.x, LAGOON.z, heightFn);
export function lagoonPool(x, z) {
  const r = Math.hypot(x - LAGOON.x, z - LAGOON.z) / LAGOON.r;
  return fbm(noiseL, x * 0.0095, z * 0.0095, 2) + 0.45 * (1 - r) - 0.12;
}
export function lagoonHeight(x, z, h) {
  const r = Math.hypot(x - LAGOON.x, z - LAGOON.z) / LAGOON.r;
  if (r > 1.25) return h;
  const crust = level() + 0.15;
  const carve = r < 1 ? LAGOON_DEPTH * smoothstep(0.0, 0.5, lagoonPool(x, z)) * (1 - smoothstep(0.8, 1, r)) : 0;
  return THREE.MathUtils.lerp(crust - carve, h, smoothstep(0.85, 1.25, r));
}
export const lagoonWater = () => level() + 0.15 - 0.6;

// The gorge and the umbrella grove stand on level floors cut into the rose
// hills; the wide fade keeps the rim gentle enough to ride over.
// The old city of Qanat and its camps share one level floor (the camps' flat
// takes the city's level, so there is no step between them).
const CITY_FLAT = { ...STORY.city, r: 100, fade: 170 };
const FLATS = [{ ...SITES.canyon, r: 125, fade: 120 }, { ...SITES.umbrellas, r: 55, fade: 120 }, CITY_FLAT,
  { ...STORY.camps, r: 44, fade: 70, same: CITY_FLAT }];
// the floor sits at the mean height of the surrounding hills, so the rim is as low as it can be
const floorLevel = (f) => {
  let sum = 0;
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, d = f.r + f.fade * 0.6; sum += basinHeight(f.x + Math.cos(a) * d, f.z + Math.sin(a) * d, heightFn); }
  return sum / 16;
};
function flatten(x, z, h) {
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r + f.fade) h = THREE.MathUtils.lerp(f.level ??= f.same ? (f.same.level ??= floorLevel(f.same)) : floorLevel(f), h, smoothstep(f.r, f.r + f.fade, d));
  }
  return h;
}

// Sand drifted over the carcass and the wreck: [site, local x, local z, sigma, height].
// Broad Gaussian mounds (curvature h/σ² < 0.01), so the bike rides over them.
export const DRIFTS = [
  ['carcass', -20, -26, 26, 5.5], ['carcass', 35, -24, 24, 5], ['carcass', -92, -14, 22, 4.5], ['carcass', 0, 30, 26, 3.5], ['carcass', 112, -8, 24, 5],
  ['wreck', 40, 2, 26, 6.5], ['wreck', 4, -16, 24, 4.5], ['wreck', -70, 12, 22, 3.5],
].map(([site, lx, lz, sigma, h]) => {
  const s = SITES[site], c = Math.cos(s.yaw), n = Math.sin(s.yaw);
  return { x: s.x + c * lx + n * lz, z: s.z - n * lx + c * lz, k: 1 / (2 * sigma * sigma), reach: 3 * sigma, h };
});
// Marrow's hollow (STORY.bike): a broad Gaussian dip, gentle enough to ride through
export const HOLLOWS = [{ x: STORY.bike.x, z: STORY.bike.z, k: 1 / (2 * 13 * 13), reach: 39, h: -2.4 }];
function drifts(x, z, h) {
  for (const d of HOLLOWS) {
    const dx = x - d.x, dz = z - d.z;
    if (Math.abs(dx) < d.reach && Math.abs(dz) < d.reach) h += d.h * Math.exp(-(dx * dx + dz * dz) * d.k);
  }
  for (const d of DRIFTS) {
    const dx = x - d.x, dz = z - d.z;
    if (Math.abs(dx) < d.reach && Math.abs(dz) < d.reach) h += d.h * Math.exp(-(dx * dx + dz * dz) * d.k);
  }
  return h;
}

/** The level floor of the old city (and its camps). */
export const cityFloor = () => CITY_FLAT.level ??= floorLevel(CITY_FLAT);

/** The desert's full height field: dunes, the mineral basin, level landmark floors, drifts and the salt lagoons. */
export function desertHeight(x, z) {
  return lagoonHeight(x, z, drifts(x, z, flatten(x, z, basinHeight(x, z, heightFn))));
}

// ------------------------------------------------------------------ helpers
function prep(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
  return geo;
}
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
/** Transform a geometry in place: rotate (XYZ Euler), scale, then move. */
function T(geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  return geo.applyMatrix4(_m.compose(new THREE.Vector3(...p), _q, new THREE.Vector3(...(typeof s === 'number' ? [s, s, s] : s))));
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tube = (pts, r, seg = 16, radial = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, radial, false);
const lathe = (pts, seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg);
/** A cable sagging between two points. */
function sagPts(a, b, sag, n = 10) {
  return Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return a.clone().lerp(b, t).add(V(0, -sag * Math.sin(Math.PI * t), 0)); });
}

/** One landmark: a local frame on the ground, batched render meshes and hidden colliders. */
class Kit {
  constructor(root, name, x, y, z, yaw = 0) {
    this.group = new THREE.Group(); this.group.name = name; root.add(this.group);
    this.frame = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
    this.origin = V(x, y, z); this.yaw = yaw;
    this.batches = new Map(); this.proxies = [];
    this.terrain = Kit.terrain;
  }
  /** local -> world point */
  world(x, y, z) { return V(x, y, z).applyMatrix4(this.frame); }
  /** ground height under a local point, in local coordinates */
  gy(x, z) { const p = this.world(x, 0, z); return this.terrain.heightAt(p.x, p.z) - this.origin.y; }
  add(mat, geo) {
    if (!this.batches.has(mat)) this.batches.set(mat, []);
    const g = prep(geo).applyMatrix4(this.frame);
    wallOpenings.addGeometry(g, mat);   // (a window, a door: no crack runs through it)
    this.batches.get(mat).push(g);
    return this;
  }
  solid(geo) { const g = prep(geo).applyMatrix4(this.frame); this.proxies.push(g); SandDrifts.current?.addGeometry(g); return this; }
  both(mat, geo, proxy) { const p = proxy ?? geo.clone(); this.add(mat, geo); this.solid(p); return this; }
  flush() {
    for (const [mat, list] of this.batches) {
      const m = new THREE.Mesh(mergeGeometries(list), mat);
      m.userData.noCollide = true; m.name = `${this.group.name} (${list.length})`;
      this.group.add(m);
    }
    if (this.proxies.length) {
      const c = new THREE.Mesh(mergeGeometries(this.proxies), PROXY);
      c.visible = false; c.name = `${this.group.name} collision`;
      this.group.add(c);
    }
    return this.group;
  }
}
const PROXY = new THREE.MeshBasicMaterial();

// ------------------------------------------------------------------ build
export function buildDesertLandmarks(scene, terrain) {
  const root = new THREE.Group(); root.name = 'Desert reference structures'; scene.add(root);
  const rng = mulberry32(3773);
  const M = {
    bone: makeMaterial({ color: '#f2ead6' }),
    boneDark: makeMaterial({ color: '#d9c9a8' }),
    ink: makeMaterial({ color: '#34405e', flat: true }),
    hull: makeMaterial({ color: '#a7b6c6', grid: 3.5, plates: true, metal: 'painted' }),
    hullDark: makeMaterial({ color: '#7d8da2', flat: true, metal: 'steel' }),
    cream: makeMaterial({ color: '#efe3cc', flat: true, grid: 2 }),
    creamSmooth: makeMaterial({ color: '#f1e8d6', grid: 3 }),
    rust: makeMaterial({ color: '#c9774f', flat: true, metal: 'iron', refl: 0.15 }),
    rope: makeMaterial({ color: '#716c70', flat: true, metal: 'iron' }),
    wood: makeMaterial({ color: '#a8835f', flat: true }),
    petalA: makeMaterial({ color: '#efc29b', side: THREE.DoubleSide }),
    petalB: makeMaterial({ color: '#f4e4cc', side: THREE.DoubleSide }),
    pale: makeMaterial({ color: '#eef0ea', grid: 3 }),
    water: makeMaterial({ color: '#69d3c6', color2: '#a3e4d5', mode: MODE_WATER, flat: true }),
    salt: makeMaterial({ color: '#f6f3ec', flat: true }),
    violet: makeMaterial({ color: '#b7a0bb', color2: '#a995b0', color3: '#d3bfd4', flat: true, mode: MODE_STRATA, strataSize: 7, cracks: 0.8 }),   // (cracks down the faces: materials.js)
    rose: makeMaterial({ color: '#e7a07f', color2: '#c97b63', color3: '#f1c9a0', flat: true, mode: MODE_STRATA, strataSize: 6, cracks: 0.8 }),
    canopy: makeMaterial({ color: '#e8a28c' }),
    canopyUnder: makeMaterial({ color: '#c98271' }),
    stem: makeMaterial({ color: '#ebb79f' }),
    adobe: makeMaterial({ color: '#efc7ae', flat: true, weathered: 0.9 }),
    adobe2: makeMaterial({ color: '#e3ad94', flat: true, weathered: 0.9 }),
    dish: makeMaterial({ color: '#f1ece2', grid: 5, side: THREE.DoubleSide, metal: 'painted' }),
    station: makeMaterial({ color: '#9fb3c8', grid: 3, plates: true, metal: 'painted' }),
    sail: makeMaterial({ color: '#e0965c', side: THREE.DoubleSide }),
    sail2: makeMaterial({ color: '#ebb27c', side: THREE.DoubleSide }),
  };
  const out = {};
  const ground = (s, r) => terrain.baseAt(s.x, s.z, r);
  Kit.terrain = terrain;

  // ---------------------------------------------------------- the sunken leviathan
  // Lying on its side in a dune: the spine along the sand, the ribs arching
  // over into a tunnel you can walk through, the skull nose-down at one end.
  // Sand drifts (DRIFTS, part of the height field) bury the spine and tail.
  {
    const s = SITES.carcass, k = new Kit(root, 'Sunken leviathan', s.x, terrain.heightAt(s.x, s.z) - 3, s.z, s.yaw);
    // the spine follows the dune, half sunk in it
    const spine = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => { const t = i / 8, x = -75 + 138 * t, z = -15 + 3 * Math.sin(t * 5); return V(x, k.gy(x, z) - 1.5 + 4 * Math.sin(Math.PI * t), z); }));
    // (the bones collide as they are drawn: coarse stand-ins lay up to 3.7 m inside them)
    k.both(M.bone, new THREE.TubeGeometry(spine, 60, 2.8, 8));
    const ribs = 19;
    for (let i = 0; i < ribs; i++) {
      const t = 0.12 + 0.72 * i / (ribs - 1), b = spine.getPoint(t);
      const g = 0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.04) / 0.86)));
      const H = 4 + 25 * g, W = 8 + 15 * g, end = i % 5 === 3 ? 0.6 + rng() * 0.15 : 1;   // a few broken ribs
      const lean = (rng() - 0.5) * 2.5, pts = [], gEnd = k.gy(b.x - 8, b.z + 2 * W) - 4;
      for (let j = 0; j <= 9; j++) {
        const th = Math.PI * (j / 9) * end, base = THREE.MathUtils.lerp(b.y, gEnd, (1 - Math.cos(th)) / 2);
        pts.push(V(b.x - 8 * th / Math.PI + lean * Math.sin(th), base + Math.sin(th) * H, b.z + (1 - Math.cos(th)) * W));
      }
      const r = 1.2 + 1.2 * g;
      k.both(M.bone, T(tube(pts, r, 24, 7), [0, 0, 0], [0, 0, 0], [1, 1, 1]));
      k.both(M.bone, T(new THREE.SphereGeometry(3.4, 8, 6), [b.x, b.y + 2, b.z], [0, 0, 0], [0.75, 1.1, 1.3]));
    }
    // tail vertebrae trailing into the sand
    for (let i = 1; i <= 9; i++) {
      const r = 2.8 - i * 0.22;
      const x = -75 - i * 5.4, z = -15 + Math.sin(i * 0.7) * 2.5;
      k.both(M.bone, T(new THREE.SphereGeometry(r, 8, 6), [x, k.gy(x, z) - 0.4 * r, z], [0, 0, 0], [1.3, 0.9, 1]));
    }
    // skull, nose down, a dark socket turned to the sky, jaw and tusks in the sand
    const sy = k.gy(84, -8) + 2, skullT = [[84, sy, -8], [0.3, 0, -0.2], [1.7, 0.85, 1.05]];
    k.both(M.bone, T(new THREE.SphereGeometry(16, 18, 12), ...skullT));
    k.both(M.bone, T(new THREE.SphereGeometry(9, 12, 8), [62, sy + 5, -10], [0, 0, 0], [1, 0.9, 1.2]));   // the brow behind the sockets
    k.add(M.ink, T(new THREE.SphereGeometry(4.2, 12, 8), [80, sy + 9.5, 1], [0.7, 0.3, 0], [1.4, 0.55, 1]));
    k.both(M.boneDark, T(new THREE.SphereGeometry(8, 12, 8), [96, sy - 3, -15], [0, 0.15, -0.12], [1.8, 0.6, 0.9]));   // jaw, mostly sunk
    for (const z of [-6, 6]) k.both(M.bone, tube([V(104, sy - 3, -10 + z), V(116, sy - 4, -8 + z * 1.6), V(126, sy - 1, -6 + z * 1.8), V(130, sy + 6, -5 + z * 1.4)], 1.3, 16, 8));   // tusks
    out.carcass = k.world(0, 20, 6);
    k.flush();
  }

  // ---------------------------------------------------------- the crashed hull
  // A blue-grey hull nose-down in a dune with a broken-off section, masts and
  // a little salvage camp in its lee: a quonset hut, domes, a gantry arch.
  {
    const s = SITES.wreck, k = new Kit(root, 'Crashed hull', s.x, terrain.heightAt(s.x, s.z) - 1.5, s.z, s.yaw);
    const L = 38, R = 11.5;
    const prof = (n) => Array.from({ length: n + 1 }, (_, i) => { const y = -L * 0.82 + (1.82 * L) * i / n; return [R * Math.sqrt(Math.max(0, 1 - Math.abs(y / L) ** 3)), y]; });
    // hull axis along local +x, nose (+x) dipping into the sand, rolled a little
    const hullRot = [0.5, 0, -Math.PI / 2 - 0.28], hullPos = [0, 5, 0];
    // (the hull, its ribs and what stands on it collide as they are drawn: an 8-sided stand-in lay ~1 m inside)
    k.both(M.hull, T(lathe(prof(18), 28), hullPos, hullRot));
    for (const y of [-26, -14, -2, 10, 22]) {
      const r = R * Math.sqrt(Math.max(0, 1 - Math.abs(y / L) ** 3)) + 0.25;
      k.both(M.hullDark, T(T(new THREE.TorusGeometry(r, 0.6, 5, 30), [0, y, 0], [Math.PI / 2, 0, 0]), hullPos, hullRot));
    }
    // the torn-open stern: a dark mouth inside an engine ring
    const yEnd = -L * 0.82, rEnd = R * Math.sqrt(1 - 0.82 ** 3);
    k.add(M.hullDark, T(T(new THREE.TorusGeometry(rEnd, 1.3, 6, 30), [0, yEnd, 0], [Math.PI / 2, 0, 0]), hullPos, hullRot));
    k.add(M.ink, T(T(new THREE.CircleGeometry(rEnd - 0.6, 24), [0, yEnd + 1.5, 0], [Math.PI / 2, 0, 0]), hullPos, hullRot));
    // portholes along the flank
    for (let i = 0; i < 5; i++) {
      const y = -18 + i * 7, r = R * Math.sqrt(Math.max(0, 1 - Math.abs(y / L) ** 3)), a = 0.5;
      k.add(M.ink, T(T(new THREE.CircleGeometry(1.4, 12), [0, 0, 0.05], [0, 0, 0]).rotateY(Math.PI / 2 - a).translate(Math.cos(a) * (r + 0.05), y, Math.sin(a) * (r + 0.05)), hullPos, hullRot));
    }
    // a cockpit blister on top and a big round port on the flank (hull space: -x is up)
    k.both(M.hullDark, T(new THREE.SphereGeometry(5, 16, 10).scale(1, 1.6, 1).translate(-R * 0.86, 20, 0), hullPos, hullRot));
    k.add(M.ink, T(new THREE.SphereGeometry(3.2, 12, 8).scale(0.7, 1.2, 1).translate(-R * 0.86 - 2.4, 23, 0), hullPos, hullRot));
    k.both(M.hullDark, T(new THREE.TorusGeometry(4.6, 0.9, 6, 28).translate(0, 4, R * 0.93), hullPos, hullRot));
    k.add(M.ink, T(new THREE.CircleGeometry(4, 24).translate(0, 4, R * 0.96), hullPos, hullRot));
    for (let i = 0; i < 6; i++) k.both(M.hullDark, T(new THREE.BoxGeometry(2.2, 3 + i % 3, 2.2).translate(-R * 0.75, -16 + i * 3.4, (i % 2 ? 1 : -1) * 4.5), hullPos, hullRot));
    // swept fins at the stern
    for (const side of [-1, 1]) k.both(M.hullDark, T(new THREE.BoxGeometry(14, 0.7, 6), [-24, 12 + side * 2, side * 10], [side * 0.5, 0.3 * side, 0.25]));
    // masts on the spine of the hull
    for (const [x, h] of [[-6, 22], [6, 15]]) {
      k.add(M.rope, new THREE.CylinderGeometry(0.22, 0.35, h, 6).translate(x, 15 + h / 2, 0));
      k.add(M.rope, new THREE.BoxGeometry(0.2, 0.2, 5).translate(x, 15 + h * 0.8, 0));
      k.add(M.rope, tube(sagPts(V(x, 15 + h, 0), V(x - 16, 0, 9), 1.5, 6), 0.06, 10, 3));
    }
    // the broken-off section, further down the dune
    const secPos = [-62, 3.5, 16], secRot = [0.9, 0.4, -Math.PI / 2 + 0.15];
    const sec = Array.from({ length: 7 }, (_, i) => { const y = -11 + 22 * i / 6; return [8.5 * (1 - 0.15 * Math.abs(y / 11) ** 2), y]; });
    k.both(M.hull, T(lathe(sec, 24), secPos, secRot));
    for (const y of [-11, 11]) {
      k.both(M.hullDark, T(T(new THREE.TorusGeometry(7.3, 0.9, 5, 24), [0, y, 0], [Math.PI / 2, 0, 0]), secPos, secRot));
      k.add(M.ink, T(T(new THREE.CircleGeometry(6.8, 20), [0, y * 0.9, 0], [Math.PI / 2, 0, 0]), secPos, secRot));
    }
    // two escape pods, half-buried helmets with dark visors
    for (const [x, z, r, yaw] of [[30, -34, 5.5, 0.6], [52, -20, 4.2, -0.4]]) {
      const y = k.gy(x, z) + r * 0.25, place = (g) => T(g, [x, y, z], [0.25, yaw, -0.3]);
      k.both(M.hull, place(new THREE.SphereGeometry(r, 18, 12).scale(1.35, 1, 1)));
      k.add(M.hullDark, place(new THREE.TorusGeometry(r * 0.55, r * 0.12, 6, 20).rotateY(Math.PI / 2).translate(r * 1.25, r * 0.15, 0)));
      k.add(M.ink, place(new THREE.CircleGeometry(r * 0.5, 16).rotateY(Math.PI / 2).translate(r * 1.28, r * 0.15, 0)));
      k.add(M.hullDark, place(new THREE.BoxGeometry(r * 0.9, r * 0.12, r * 1.6).translate(-r * 1.1, r * 0.4, 0)));
    }
    // salvage camp in the lee, each piece set on the sand
    const cz = 32, g = (x, z) => k.gy(x, z);
    const hut = new THREE.CylinderGeometry(4.2, 4.2, 13, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
    const hy = g(-14, cz) - 0.3;
    k.both(M.cream, T(hut, [-14, hy, cz], [0, 0.3, 0]));
    k.add(M.ink, T(new THREE.BoxGeometry(0.4, 3.2, 2.2), [-14 + Math.cos(0.3) * 6.6, hy + 1.5, cz - Math.sin(0.3) * 6.6], [0, 0.3, 0]));
    k.add(M.ink, T(new THREE.BoxGeometry(8, 0.6, 0.3), [-14 + 2.75 * Math.sin(0.3), hy + 3.2, cz + 2.75 * Math.cos(0.3)], [-0.86, 0.3, 0]));
    for (const [x, z, r] of [[2, cz + 4, 3.6], [8, cz - 3, 2.6], [-26, cz + 6, 3]]) {
      const y = g(x, z) - 0.3;
      k.both(M.creamSmooth, new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y, z), new THREE.SphereGeometry(r, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y, z));
      k.add(M.ink, new THREE.BoxGeometry(1.4, 1.8, 0.4).translate(x, y + 0.9, z + r - 0.1));
    }
    for (const dz of [-6, -2]) k.add(M.rope, new THREE.TorusGeometry(6, 0.35, 6, 18, Math.PI).translate(-34, g(-34, cz + dz) - 0.3, cz + dz));
    k.add(M.rope, new THREE.CylinderGeometry(0.2, 0.3, 20, 6).translate(4, g(4, cz + 12) + 10, cz + 12));
    k.add(M.rope, new THREE.CylinderGeometry(0.15, 0.2, 13, 6).translate(-30, g(-30, cz + 14) + 6.5, cz + 14));
    for (let i = 0; i < 6; i++) {
      const sz = 1.2 + rng() * 1.2, x = -6 + rng() * 14, z = cz - 8 + rng() * 6;
      k.both(i % 2 ? M.rust : M.cream, T(new THREE.BoxGeometry(sz * 1.4, sz, sz), [x, g(x, z) + sz / 2 - 0.2, z], [0, rng() * 3, 0]));
    }
    // a salvager's slate on an easel by the hut's door, chalked with what was taken (and what was checked)
    {
      const bx = -5.6, bz = 29.2, by = g(bx, bz);
      k.both(M.ink, T(new THREE.BoxGeometry(1.7, 1.15, 0.08), [bx, by + 1.25, bz], [-0.18, 0.3 + Math.PI / 2, 0]));
      for (const s of [-1, 1]) k.both(M.rope, T(new THREE.BoxGeometry(0.08, 1.9, 0.08), [bx + Math.cos(0.3) * 0.12, by + 0.9, bz - Math.sin(0.3) * 0.12 + s * 0.7], [-0.25, 0.3, 0]));
      // (the chalk on its face, a little out along the board's own +z)
      for (let i = 0; i < 4; i++) k.add(M.cream, T(new THREE.BoxGeometry(1.0 - (i % 2) * 0.35, 0.06, 0.02).translate(0, 0.33 - i * 0.22, 0.05), [bx, by + 1.25, bz], [-0.18, 0.3 + Math.PI / 2, 0]));
      out.wreckSlate = k.world(bx, by + 1.25, bz);
      out.wreckSlateFoot = k.world(bx + 1.6, by, bz - 0.5);
    }
    out.wreck = k.origin.clone().add(V(0, 15, 0));
    k.flush();
  }

  // ---------------------------------------------------------- the traveller's camp
  // West of the start, where the blue-cloaked traveller waits: a quonset tent,
  // a dome tent, a radio mast with a little dish, crates and an awning.
  {
    const s = SITES.camp, k = new Kit(root, 'Traveller camp', s.x, ground(s, 6) - 0.2, s.z, s.yaw);
    k.both(M.cream, new THREE.CylinderGeometry(2.1, 2.1, 5.5, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.BoxGeometry(5.5, 2, 3.6).translate(0, 1, 0));
    k.add(M.ink, new THREE.BoxGeometry(0.3, 1.6, 1.2).translate(2.8, 0.8, 0));
    k.both(M.creamSmooth, new THREE.SphereGeometry(1.7, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).translate(-4.5, 0, 2.5), new THREE.BoxGeometry(2.6, 1.6, 2.6).translate(-4.5, 0.8, 2.5));
    k.add(M.rope, new THREE.CylinderGeometry(0.07, 0.1, 7.5, 5).translate(-1.5, 3.75, -3.5));
    k.add(M.dish, T(lathe(Array.from({ length: 6 }, (_, i) => [i / 5 * 1.1, 0.35 * (i / 5) ** 2]), 16), [-1.5, 6.4, -3.5], [0.9, 0.6, 0]));
    k.add(M.rope, tube(sagPts(V(-1.5, 7.2, -3.5), V(-5, 0, -6), 0.3, 4), 0.03, 6, 3));
    k.add(M.rope, tube(sagPts(V(-1.5, 7.2, -3.5), V(2, 0, -6.5), 0.3, 4), 0.03, 6, 3));
    for (const [x, z, sz, m] of [[3.6, 2.6, 0.8, M.rust], [4.2, 1.5, 0.6, M.cream], [-2.5, 3.6, 0.7, M.cream]]) k.both(m, new THREE.BoxGeometry(sz * 1.4, sz, sz).translate(x, sz / 2, z));
    for (const [x, z] of [[1, 3], [5, 3], [1, 6], [5, 6]]) k.add(M.wood, new THREE.CylinderGeometry(0.06, 0.06, 2.4, 4).translate(x, 1.2, z + 0.5));
    k.add(M.rust, T(new THREE.BoxGeometry(4.4, 0.08, 3.4), [3, 2.4, 5], [0.12, 0, 0]));
    // a bigger quonset for the radio gear, a teal dome tent, a rug and a fire ring
    k.both(M.creamSmooth, new THREE.CylinderGeometry(2.8, 2.8, 8, 14, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(1.2).translate(-8, -0.2, -6), T(new THREE.BoxGeometry(8, 2.6, 5), [-8, 1.1, -6], [0, 1.2, 0]));
    k.add(M.rust, new THREE.CylinderGeometry(2.86, 2.86, 0.7, 14, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(1.2).translate(-8, -0.2, -6));
    k.add(M.ink, T(new THREE.BoxGeometry(0.3, 2, 1.6), [-8 + Math.cos(1.2) * 4.05, 1, -6 - Math.sin(1.2) * 4.05], [0, 1.2, 0]));
    k.both(M.station, new THREE.SphereGeometry(1.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 0.9, 1).translate(5.5, 0, -3), new THREE.BoxGeometry(3.4, 1.3, 2.8).translate(5.5, 0.65, -3));
    k.add(M.rust, new THREE.BoxGeometry(3, 0.04, 2).translate(-1.5, 0.03, 3));
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; k.add(M.rope, new THREE.IcosahedronGeometry(0.22, 0).translate(1.2 + Math.cos(a) * 0.7, 0.1, 4.6 + Math.sin(a) * 0.7)); }
    k.add(M.wood, new THREE.CylinderGeometry(0.05, 0.07, 9, 4).translate(6.5, 4.5, 1));
    k.add(M.rust, new THREE.BoxGeometry(0.05, 0.8, 1.8).translate(6.5, 8.4, 1.95));
    out.camp = k.origin.clone().add(V(0, 3, 0));
    k.flush();
  }

  // ---------------------------------------------------------- bat-wing sails
  // Broad orange sails stretched on fanned, bowed spars over a cluster of domes.
  {
    const s = SITES.sails, k = new Kit(root, 'Sail tents', s.x, ground(s, 20) - 0.3, s.z, s.yaw);
    // membrane between consecutive fingers fanned out from a base point B,
    // scalloped between the finger tips and billowed along the sector normal
    const sailGeo = (B, fingers, bulge) => {
      const pos = [], idx = [], n = 12, m = 8;
      for (let f = 0; f < fingers.length - 1; f++) {
        const A = fingers[f].clone().sub(B), C = fingers[f + 1].clone().sub(B), nrm = A.clone().cross(C).normalize();
        const base = pos.length / 3;
        for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
          const u = i / n, t = j / m;
          const p = A.clone().lerp(C, t).multiplyScalar(u * (1 - 0.2 * Math.sin(Math.PI * t) * u ** 4)).add(B);
          p.addScaledVector(nrm, bulge * Math.sin(Math.PI * t) * Math.sin(Math.PI * 0.5 * u) - 0.08 * bulge * Math.sin(Math.PI * u) * A.length() / 10);
          pos.push(p.x, p.y, p.z);
        }
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = base + i * (m + 1) + j; idx.push(a, a + m + 1, a + 1, a + 1, a + m + 1, a + m + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    const sails = [[V(-10, 0.5, 2), 24, 0.1, M.sail], [V(10, 0.5, -8), 19, -1.9, M.sail2], [V(6, 0.5, 15), 14, 1.6, M.sail]];
    for (const [B, H, dir, mat] of sails) {
      const fingers = [];
      for (let f = 0; f < 4; f++) {
        const a = dir + f * 0.55, el = 1.05 - f * 0.28, len = H / Math.sin(1.05) * (1.15 - f * 0.1);
        fingers.push(B.clone().add(V(Math.cos(a) * Math.cos(el) * len, Math.sin(el) * len, Math.sin(a) * Math.cos(el) * len)));
      }
      k.add(mat, sailGeo(B, fingers, 3.5));
      for (const F of fingers) k.add(M.rope, tube([B, B.clone().lerp(F, 0.5).add(V(0, 2, 0)), F], 0.28, 12, 5));
      // a prop pole under the high tip and a stay to the ground from the low one
      const tip = fingers[0];
      k.add(M.wood, new THREE.CylinderGeometry(0.18, 0.25, tip.y * 0.7, 5).translate(tip.x * 0.75 + B.x * 0.25, tip.y * 0.35, tip.z * 0.75 + B.z * 0.25));
      k.add(M.rope, tube(sagPts(fingers[3], fingers[3].clone().setY(0).add(V(3, 0, 1)), 0.3, 4), 0.05, 6, 3));
    }
    for (const [x, z, r] of [[-10, 2, 4.6], [10, -8, 3.8], [6, 15, 3.2], [-16, 14, 2.6], [20, 8, 2.4]]) {
      k.both(M.creamSmooth, new THREE.SphereGeometry(r, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1).translate(x, -0.4, z));
      k.add(M.ink, new THREE.BoxGeometry(1.3, 1.9, 0.5).translate(x + r * 0.6, 0.6, z + r * 0.75));
    }
    k.add(M.rope, new THREE.CylinderGeometry(0.15, 0.2, 16, 5).translate(26, 8, -2));
    out.sails = k.origin.clone().add(V(0, 12, 0));
    k.flush();
  }

  // ---------------------------------------------------------- the rose gorge
  // Two stepped canyon walls with a turquoise stream between them: a
  // suspension bridge across the rims and an older rope bridge lower down.
  {
    const s = SITES.canyon, LEN = 230, GAP = 46;
    const yaw = s.yaw, fwd = V(Math.cos(yaw), 0, -Math.sin(yaw)), side = V(Math.sin(yaw), 0, Math.cos(yaw));
    let lo = Infinity, hi = -Infinity;
    for (let u = -LEN / 2; u <= LEN / 2; u += 10) for (let v = -GAP / 2 - 50; v <= GAP / 2 + 50; v += 10) {
      const h = terrain.heightAt(s.x + fwd.x * u + side.x * v, s.z + fwd.z * u + side.z * v); lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    const k = new Kit(root, 'Rose gorge', s.x, lo - 4, s.z, yaw);
    const top = hi - lo + 4 + 44, tiers = [[0, top * 0.38, 0], [top * 0.38, top * 0.7, 5], [top * 0.7, top, 11]];
    const wallShape = (sgn, inset, seed) => {
      const pts = [], n = 26;
      for (let i = 0; i <= n; i++) {   // the gorge face
        const u = -LEN / 2 + LEN * i / n;
        pts.push([u, sgn * (GAP / 2 + inset + 3 * noiseL(u * 0.03 + seed, seed) + 2 * Math.sin(u * 0.08 + seed))]);
      }
      for (let i = n; i >= 0; i--) {   // the back of the plateau
        const u = -LEN / 2 + LEN * i / n;
        pts.push([u * 1.02, sgn * (GAP / 2 + 52 + 8 * noiseL(u * 0.02 - seed, seed))]);
      }
      const sh = new THREE.Shape(); pts.forEach(([u, v], i) => i ? sh.lineTo(u, -v) : sh.moveTo(u, -v)); return sh;
    };
    for (const sgn of [-1, 1]) for (const [y0, y1, inset] of tiers) {
      const geo = new THREE.ExtrudeGeometry(wallShape(sgn, inset, sgn * 7 + inset), { depth: y1 - y0, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y0, 0);
      k.both(M.rose, geo);
    }
    // a stream down the gorge floor, following the ground
    {
      const pos = [], idx = [], n = 60;
      for (let i = 0; i <= n; i++) {
        const u = -105 + 210 * i / n, c = 4 * Math.sin(u / 26), w = 3 + 1.5 * Math.sin(u / 17 + 1);
        for (const e of [-1, 1]) {
          const v = c + e * w, p = k.world(u, 0, v);
          pos.push(u, terrain.heightAt(p.x, p.z) - k.origin.y + 0.12, v);
        }
        if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      k.add(M.water, g);
    }
    // where a tier's gorge face stands at u (same wobble as wallShape)
    const face = (u, sgn, inset) => { const seed = sgn * 7 + inset; return GAP / 2 + inset + 3 * noiseL(u * 0.03 + seed, seed) + 2 * Math.sin(u * 0.08 + seed); };
    const bridge = (u, y, inset, sag, towers) => {
      const vA = -face(u, -1, inset) - 2.5, vB = face(u, 1, inset) + 2.5, halfSpan = (vB - vA) / 2, mid = (vA + vB) / 2;
      y += 0.12;
      const yAt = (t) => y - sag * Math.sin(Math.PI * t), n = Math.round(halfSpan * 2 / 1.1);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, v = mid - halfSpan + 2 * halfSpan * t, slope = -sag * Math.PI * Math.cos(Math.PI * t) / (2 * halfSpan);
        k.add(M.wood, T(new THREE.BoxGeometry(3.6, 0.22, 0.95), [u, yAt(t), v], [Math.atan(slope), 0, 0]));
      }
      for (let i = 0; i < 16; i++) {   // deck colliders
        const t0 = i / 16, t1 = (i + 1) / 16, v0 = mid - halfSpan + 2 * halfSpan * t0, v1 = mid - halfSpan + 2 * halfSpan * t1;
        const a = V(u, yAt(t0), v0), b = V(u, yAt(t1), v1), c = a.clone().add(b).multiplyScalar(0.5);
        k.solid(T(new THREE.BoxGeometry(3.6, 0.3, a.distanceTo(b) + 0.1), [c.x, c.y, c.z], [-Math.atan2(b.y - a.y, b.z - a.z), 0, 0]));
      }
      for (const e of [-1.8, 1.8]) {
        const rail = Array.from({ length: 21 }, (_, i) => V(u + e, yAt(i / 20) + 1.2, mid - halfSpan + 2 * halfSpan * i / 20));
        k.add(M.rope, tube(rail, 0.07, 40, 3));
        for (let i = 0; i <= 20; i += 2) k.add(M.rope, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 3).translate(u + e, yAt(i / 20) + 0.6, mid - halfSpan + 2 * halfSpan * i / 20));
        if (towers) {
          for (const sv of [-1, 1]) k.add(M.wood, new THREE.CylinderGeometry(0.3, 0.4, 9, 6).translate(u + e, y + 4.5, mid + sv * (halfSpan + 1)));
          const main = sagPts(V(u + e, y + 9, mid - halfSpan - 1), V(u + e, y + 9, mid + halfSpan + 1), 9 + sag, 20);
          k.add(M.rope, tube(main, 0.12, 40, 4));
          for (let i = 2; i < 20; i += 2) {
            const p = main[i], t = (p.z - mid + halfSpan) / (2 * halfSpan);
            k.add(M.rope, tube([p, V(u + e, yAt(t) + 1.2, p.z)], 0.035, 1, 3));
          }
        }
      }
    };
    bridge(25, top, 11, 4, true);
    bridge(-55, top * 0.38, 0, 5, false);
    out.canyon = k.world(25, top + 2, 0);
    out.canyonFloor = k.world(0, 0, 0);
    k.flush();
  }

  // ---------------------------------------------------------- umbrella grove
  // Giant pink canopies with ribbed undersides on fluted trumpet stems,
  // shading a huddle of adobe domes. You can climb a stem and stand on top.
  {
    const s = SITES.umbrellas, k = new Kit(root, 'Umbrella grove', s.x, ground(s, 40) - 0.5, s.z, s.yaw);
    const trees = [[0, 0, 22, 50], [-34, 18, 16, 36], [30, 24, 14, 30], [10, -36, 18, 42], [-30, -28, 11, 26]];
    for (const [x, z, Rc, H] of trees) {
      const rT = Rc * 0.1, rB = Rc * 0.22;
      const stem = lathe(Array.from({ length: 13 }, (_, i) => { const t = i / 12; return [rT + (rB - rT) * (1 - t) ** 3, t * (H - 4)]; }), 28);
      const p = stem.attributes.position;
      for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), f = 1 + 0.07 * Math.cos(a * 14); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
      // (the stem and the cap collide as drawn: you climb the one and stand on the other, and their eight-sided
      // stand-ins lay up to metres inside them: src/contact-audit.js)
      k.both(M.stem, stem.translate(x, -1, z));
      const top = [[0, H + 2.5], [Rc * 0.5, H + 1.9], [Rc * 0.9, H + 0.6], [Rc, H - 0.2], [Rc * 0.98, H - 0.9]];
      const under = [[Rc * 0.98, H - 0.9], [Rc * 0.7, H - 2.6], [Rc * 0.35, H - 4.6], [rT * 1.3, H - 6]];
      // (its collision closed at the apex: the drawn lathe keeps a millimetre's hole there, which a ray straight down
      // the middle falls through)
      k.both(M.canopy, lathe(top.slice().reverse(), 40).translate(x, 0, z), new THREE.LatheGeometry(top.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y)), 40).translate(x, 0, z));
      k.both(M.canopyUnder, lathe(under.slice().reverse(), 40).translate(x, 0, z));
      for (let i = 0; i < 20; i++) {   // gills under the cap
        const a = i * Math.PI / 10, c = Math.cos(a), sn = Math.sin(a);
        k.add(M.canopy, tube([V(x + c * rT * 1.4, H - 5.6, z + sn * rT * 1.4), V(x + c * Rc * 0.5, H - 3.5, z + sn * Rc * 0.5), V(x + c * Rc * 0.95, H - 1.1, z + sn * Rc * 0.95)], 0.22, 8, 3));
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2, d = 8 + rng() * 42, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (trees.some(([tx, tz, Rc]) => Math.hypot(tx - x, tz - z) < Rc * 0.25 + 4)) continue;
      const r = 2.5 + rng() * 4, m = rng() < 0.5 ? M.adobe : M.adobe2;
      if (rng() < 0.7) {
        k.both(m, new THREE.SphereGeometry(r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(x, -0.4, z), new THREE.SphereGeometry(r, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(x, -0.4, z));
        k.add(M.ink, T(new THREE.BoxGeometry(1.2, 1.7, 0.6), [x + Math.cos(a) * r * 0.92, 0.5, z + Math.sin(a) * r * 0.92], [0, -a + Math.PI / 2, 0]));
      } else {
        const h = r * 0.9;
        k.both(m, T(new THREE.BoxGeometry(r * 1.4, h, r * 1.2), [x, h / 2 - 0.3, z], [0, a, 0]));
        k.add(m, new THREE.SphereGeometry(r * 0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, h - 0.3, z));
      }
    }
    out.umbrellas = k.world(0, 54, 0);
    k.flush();
  }

  // ---------------------------------------------------------- the petal station
  // A sunburst on the salt: eight cupped petals splayed round a glass cage
  // dome, with a crown of spines between them. The petals are ramps.
  {
    const s = SITES.petals, k = new Kit(root, 'Petal station', s.x, ground(s, 12) - 0.3, s.z, s.yaw);
    // (the station collides as it is drawn: a flat box under each petal, a 10-sided drum and an 8-sided
    // dome stood up to a metre away from the drawn surfaces, and the cage was a cone with nothing drawn on it)
    k.both(M.pale, new THREE.CylinderGeometry(10, 11, 2.4, 24).translate(0, 0.9, 0));
    const N = 8, Lp = 34, Wp = 13, tilt = 0.42;
    for (let i = 0; i < N; i++) {
      const az = i * Math.PI * 2 / N, len = Lp * (i % 2 ? 0.85 : 1), lift = tilt + (i % 3) * 0.05;
      const place = (g) => g.translate(len / 2, 0, 0).rotateZ(lift).rotateY(-az).translate(Math.cos(az) * 6.5, 2.2, Math.sin(az) * 6.5);
      // the bowl's normals are turned inward so its cupped, sunlit inside shades as the top
      const bowl = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(len / 2, 4.2, Wp / 2);
      bowl.computeVertexNormals(); bowl.attributes.normal.array.forEach((v, j, a) => { a[j] = -v; });
      k.both(i % 2 ? M.petalB : M.petalA, place(bowl));
      // a spine of the crown between this petal and the next
      const a2 = az + Math.PI / N;
      k.both(M.pale, new THREE.ConeGeometry(0.9, 15, 6).rotateZ(-Math.PI / 2 + 0.35).translate(7.5, 0, 0).rotateY(-a2).translate(Math.cos(a2) * 8, 2.4, Math.sin(a2) * 8));
    }
    // the glass cage: pointed meridians, rings and a finial
    const H = 30, R0 = 8.5, rAt = (y) => R0 * Math.pow(Math.max(0, 1 - (y / H) ** 2), 0.7);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      k.both(M.rope, tube(Array.from({ length: 9 }, (_, j) => { const y = H * j / 8; return V(Math.cos(a) * rAt(y), 2 + y, Math.sin(a) * rAt(y)); }), 0.2, 24, 4));
    }
    for (const y of [6, 13, 20, 25.5]) k.both(M.rope, new THREE.TorusGeometry(rAt(y), 0.16, 4, 32).rotateX(Math.PI / 2).translate(0, 2 + y, 0));
    k.add(M.rope, new THREE.CylinderGeometry(0.08, 0.25, 7, 5).translate(0, 2 + H + 3, 0));
    k.add(M.pale, new THREE.SphereGeometry(0.8, 10, 8).translate(0, 2 + H + 0.4, 0));
    k.both(M.pale, new THREE.SphereGeometry(5.5, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 2, 0));
    k.add(M.ink, new THREE.BoxGeometry(1.6, 2.4, 0.6).translate(0, 3.2, 5.3));
    out.petals = k.origin.clone().add(V(0, 18, 0));
    k.flush();
  }

  // ---------------------------------------------------------- salt lagoons
  // Turquoise pools with floating salt plates on a white crust, under a
  // stepped lavender table cliff, as on the salt pages.
  {
    const s = SITES.lagoons, wy = lagoonWater(), k = new Kit(root, 'Salt lagoons', s.x, wy, s.z, 0);
    k.add(M.water, new THREE.CircleGeometry(s.r * 1.02, 64).rotateX(-Math.PI / 2));
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * s.r * 0.95, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (terrain.heightAt(s.x + x, s.z + z) > wy - 0.5) continue;   // only on open water
      const r = 1.5 + rng() * 4.5;
      // (the salt plates hold you up where they float: your feet went through them into the lagoon)
      k.both(M.salt, T(new THREE.CylinderGeometry(r, r * 1.05, 0.25, 6 + Math.floor(rng() * 3)), [x, 0.05, z], [0, rng() * 3, 0], [1, 1, 0.5 + rng() * 0.5]));
    }
    out.lagoons = k.origin.clone();
    k.flush();
    // the table cliff on the far (west) shore, with a lone butte to the north
    const cliff = (cx, cz, len, wid, height, rot, seed, name) => {
      const base = Math.min(terrain.baseAt(cx, cz, wid), terrain.baseAt(cx, cz + len / 2, wid), terrain.baseAt(cx, cz - len / 2, wid)) - 3;
      const c = new Kit(root, name, cx, base, cz, rot);
      const outline = (inset) => {
        const sh = new THREE.Shape(), n = 40;
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const e = 1 + 0.12 * noiseL(ca * 1.6 + seed, sa * 1.6 - seed) + 0.05 * Math.sin(a * 9 + seed);
          const sq = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.35);   // squarish plan
          const x = sq(ca) * (wid / 2 - inset) * e, y = sq(sa) * (len / 2 - inset) * e;
          i ? sh.lineTo(x, y) : sh.moveTo(x, y);
        }
        return sh;
      };
      for (const [y0, y1, inset] of [[0, height * 0.6, 0], [height * 0.6, height, 7]]) {
        c.both(M.violet, new THREE.ExtrudeGeometry(outline(inset), { depth: y1 - y0, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y0, 0));
      }
      c.flush();
    };
    cliff(s.x - 150, s.z - 10, 280, 70, 42, 0.12, 3, 'Lavender table cliff');
    cliff(s.x - 40, s.z + 210, 90, 60, 30, 0.6, 9, 'Lavender butte');
  }

  // ---------------------------------------------------------- telegraph line
  {
    const [[ax, az], [bx, bz]] = POLE_LINE, n = 8, head = Math.atan2(bx - ax, bz - az);
    const k = new Kit(root, 'Telegraph line', 0, 0, 0, 0);
    const tops = [];
    for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n, y = terrain.heightAt(x, z) - 0.5, h = i === n ? 30 : 13;
      k.both(M.wood, new THREE.CylinderGeometry(0.22, 0.32, h, 6).translate(x, y + h / 2, z), new THREE.CylinderGeometry(0.3, 0.3, h, 4).translate(x, y + h / 2, z));
      k.add(M.wood, T(new THREE.BoxGeometry(4, 0.25, 0.25), [x, y + 12, z], [0, head, 0]));
      const ox = Math.cos(head) * 1.8, oz = -Math.sin(head) * 1.8;
      tops.push([V(x + ox, y + 12.2, z + oz), V(x - ox, y + 12.2, z - oz)]);
      if (i === n) for (let g = 0; g < 4; g++) {   // guy wires on the last, tall mast
        const a = head + Math.PI / 4 + g * Math.PI / 2, gx = x + Math.sin(a) * 20, gz = z + Math.cos(a) * 20;
        k.add(M.rope, tube([V(x, y + 29, z), V(gx, terrain.heightAt(gx, gz), gz)], 0.05, 1, 3));
      }
    }
    for (let i = 0; i < n; i++) for (const w of [0, 1]) k.add(M.rope, tube(sagPts(tops[i][w], tops[i + 1][w], 1.4, 8), 0.045, 16, 3));
    k.flush();
  }

  // ---------------------------------------------------------- radio-dish array
  // Three big tilted dishes on yoke mounts with feed tripods, a cluster of
  // blue-grey station domes and a tall banded chimney.
  {
    const s = SITES.dishes, k = new Kit(root, 'Radio dishes', s.x, ground(s, 60) - 0.5, s.z, s.yaw);
    for (const [x, z, R, el, az] of [[-34, 0, 22, 0.75, -0.3], [12, -30, 17, 0.68, -0.85], [30, 22, 14, 1.0, 0.25]]) {
      const ped = R * 0.55;
      // (the dishes collide as they are drawn: a 3-point, 8-sided stand-in lay up to 0.55 m under the bowl)
      k.both(M.creamSmooth, new THREE.CylinderGeometry(R * 0.12, R * 0.2, ped, 12).translate(x, ped / 2 - 0.5, z));
      for (const e of [-1, 1]) k.both(M.creamSmooth, T(new THREE.BoxGeometry(R * 0.08, R * 0.35, R * 0.3), [x + Math.cos(az) * e * R * 0.16, ped + R * 0.15, z - Math.sin(az) * e * R * 0.16], [0, az, 0]));
      const depth = 0.22 * R, f = 0.65 * R;
      const orient = (g) => g.rotateX(Math.PI / 2 - el).rotateY(az).translate(x, ped + R * 0.3, z);
      k.both(M.dish, orient(lathe(Array.from({ length: 12 }, (_, i) => { const r = i / 11 * R; return [r, depth * (r / R) ** 2]; }), 48)));
      k.both(M.rope, orient(new THREE.TorusGeometry(R, 0.3, 4, 48).rotateX(Math.PI / 2).translate(0, depth, 0)));
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        k.add(M.rope, orient(tube([V(Math.cos(a) * R * 0.95, depth * 0.9, Math.sin(a) * R * 0.95), V(0, f, 0)], 0.15, 1, 4)));
      }
      k.both(M.creamSmooth, orient(new THREE.CylinderGeometry(0.9, 1.4, 3, 10).translate(0, f, 0)));
      k.both(M.rope, orient(new THREE.CylinderGeometry(1.2, 1.2, 1.2, 10).translate(0, -1, 0)));
    }
    for (const [x, z, r] of [[-6, 34, 9], [8, 40, 6], [-22, 46, 7], [-48, 30, 5.5], [42, -6, 7.5]]) {
      k.both(M.station, new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, -0.3, z));
      k.add(M.ink, new THREE.BoxGeometry(1.6, 2.2, 0.8).translate(x, 0.8, z + r - 0.2));
    }
    k.both(M.cream, new THREE.BoxGeometry(30, 5, 9).translate(-10, 2, 54));
    k.add(M.ink, new THREE.BoxGeometry(24, 0.9, 0.3).translate(-10, 3, 49.4));
    k.both(M.creamSmooth, new THREE.CylinderGeometry(1.8, 2.4, 46, 12).translate(20, 22.5, 46));
    for (const y of [12, 26, 40]) k.add(M.rust, new THREE.CylinderGeometry(2.3, 2.3, 1.6, 12).translate(20, y, 46));
    out.dishes = k.origin.clone().add(V(0, 25, 0));
    k.flush();
  }

  return out;
}
