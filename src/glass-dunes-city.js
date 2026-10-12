import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smoothstep, mulberry32 } from './noise.js';
import { RoomKit } from './levels/lab-kit.js';
import { LightShaft } from './veil.js';
import { GLASS_ATTR } from './dune-glass-shader.js';
import { clock } from './glass-dunes-frozen.js';

// ---------------------------------------------------------------------------
// The glass city under the sand (issue #166, the author's pick of direction C, "sunken-city":
// references/levels/The Glass Dunes/environment/explorations/sunken-city/, docs/design/level-explorations-prompts.md).
// The basin is the roof of a makers' city. In three places the wind has swept the sand off a clear window of glass in
// the valley floor, and you look straight down into lit streets (the middle distance's landmarks); a sinkhole by the
// Clock-House leads down into the city itself, whose tallest tower is the Clock-House, and back up the sand that
// fell in with you.
//
//   the windows    SAND_WINDOWS: the sand cut down into a well under each (glassHeight: cutSand), a collar of glass
//                  round its edge (the dunes' own glass: the kit's glassBatch), the pane you walk on (an invisible
//                  collider, its body a wash: src/veil.js), a drift or two of sand over it, and below, a glimpse of
//                  the city: domes, round towers, a stair, a square with its clock tower, lit windows
//   the sinkhole   SINKHOLE: a funnel of sand by the Clock-House, broken glass round its lip, sand pouring in; its
//                  throat is a way through (level.portals) into the city
//   the city       CITY: built off the map as every room is (docs/systems/interiors.md: 2600 m up, culled while you
//                  are out), its local x and z the basin's own from the sinkhole: its streets of pale stone and green
//                  glass under a ceiling of glass with the sand drifted over most of it, shafts of light through the
//                  clear patches (LightShaft), a dry fountain, floats left on a doorstep, and the round tower under the
//                  Clock-House rising through the ceiling, its clock stopped at seven to. On the clear glass over the
//                  landing, footprints: yours, from the walk to the house. The way back is the ramp of sand that fell in
//                  under the sinkhole: walked up, its top takes you out on the sinkhole's lip.
//
//   cutSand(x, z, h, base)                                        the ground's wells, aprons and funnel (glassHeight)
//   windowGlass(glass, M)                                         the collars, into the dunes' glass batch
//   buildSandCity(scene, M, { ground, veils, lights })            → { windows, sinkhole, city, portals, sights, avoid }
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clean = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };

/** The windows in the sand: where (x, z), how wide (r, m), how deep the city lies under them, what each shows. */
export const SAND_WINDOWS = [
  { id: 'near', x: 8, z: 178, r: 6, depth: 13, holds: 'domes' },
  { id: 'warm', x: 118, z: 150, r: 7, depth: 14, holds: 'stair' },
  { id: 'wave', x: 52, z: 80, r: 9, depth: 16, holds: 'square' },
];
/** The sinkhole by the Clock-House: its lip (r), how deep its funnel, its throat (r of the way through). */
export const SINKHOLE = { x: 88, z: 84, r: 9.5, depth: 6, throat: 2.4 };
/** How far round a window or the sinkhole the sand lies level (m past its r), and over which it eases back. */
export const APRON = [6, 12];
/**
 * The city: where it is built (world, its floor), its extent (local, from the sinkhole: x0, x1, z0, z1), its ceiling,
 * the ramp of fallen sand (its top under the sinkhole, its foot), where you land and face, the round tower (under
 * the Clock-House: src/levels/glass-dunes.js CLOCK_HOUSE), the clear patches of its ceiling.
 */
export const CITY = {
  at: [620, 2600, -620], box: [-38, 46, -34, 46], ceiling: 15,
  ramp: { top: [0, 14.2, 1.5], foot: [0, 0, 25], w: 6 },
  landing: [5, 0, 30], exit: [0, 14.0, 2.6],
  tower: { x: 30, z: -12, r: 4.6 },
  clear: [[8, 18, 7], [-14, 4, 6], [22, 20, 6], [-6, -18, 7], [30, 10, 5]],
};
CITY.landingHeading = Math.atan2(CITY.tower.x - CITY.landing[0], CITY.tower.z - CITY.landing[2]);   // (the tower ahead as you land)
/** The city's look (sRGB): pale stone and green glass, as the sheets'. */
export const CITY_LOOK = { stone: '#ece2cc', stone2: '#ded2b8', floor: '#d9cdb0', glass: '#86d6aa', lit: '#c8f7c4', ceiling: '#a9e4c4', sand: '#e8c48f', print: '#8f6c4c', pane: '#9fe6c0' };

// ------------------------------------------------------------------ the ground

const RIM = new Map();
/** The level of the sand round a window or the sinkhole (its natural height at its middle, taken once). */
export const rimOf = (w, base) => { if (!RIM.has(w) && base) RIM.set(w, base(w.x, w.z)); return RIM.get(w); };
/** The ground (glassHeight) with the windows' wells, their level aprons and the sinkhole's funnel cut in. */
export function cutSand(x, z, h, base) {
  for (const w of [...SAND_WINDOWS, SINKHOLE]) {
    const d = Math.hypot(x - w.x, z - w.z);
    if (d > w.r + APRON[1]) continue;
    const rim = rimOf(w, base);
    h += (rim - h) * smoothstep(w.r + APRON[1], w.r + APRON[0], d);
    if (w.throat) { if (d < w.r) h = rim - w.depth * Math.pow(smoothstep(w.r, w.throat * 0.6, d), 0.8); }
    else if (d < w.r) h = rim - w.depth;
  }
  return h;
}

// ------------------------------------------------------------------ the windows

/** A window's collar of glass (a lathe, non-indexed, coloured, with the glass shader's attribute: thin, its light through). */
export function collarGeometry(w, rim) {
  const r = w.r, pts = [[r - 1.0, -3.2], [r - 0.75, 0.15], [r - 0.35, 0.42], [r + 0.8, 0.46], [r + 3.6, 0.3], [r + 6.6, -0.4]];
  const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 44).toNonIndexed();
  g.deleteAttribute('uv');
  g.translate(w.x, rim, w.z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3), a = new Float32Array(n * 4);
  const foot = new THREE.Color('#d6f5a0'), mid = new THREE.Color('#9fe3b0');
  for (let i = 0; i < n; i++) {
    const k = smoothstep(rim - 1, rim + 0.45, g.attributes.position.getY(i)), col = mid.clone().lerp(foot, k);
    c.set([col.r, col.g, col.b], i * 3); a.set([100, 0.75 * k, 1, 0.25], i * 4);   // (thin, and lit through, only at its lip)
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute(GLASS_ATTR, new THREE.BufferAttribute(a, 4));
  return g;
}
/** The windows' collars and the sinkhole's broken lip, into the dunes' glass (glass-dunes-kit.js glassBatch). */
export function windowGlass(glass, M, ground) {
  for (const w of SAND_WINDOWS) glass.add(M.glass, collarGeometry(w, rimOf(w) ?? ground.heightAt(w.x + w.r + 8, w.z)), { solid: true, shadow: true });
}

/** A flat blob (a drift of sand on the glass, a patch of the ceiling's sand), r across, rough by `rough`. */
function blob(r, seed, rough = 0.3, n = 18) {
  const rng = mulberry32(seed), s = new THREE.Shape(), ph = rng() * TAU;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU, k = r * (1 - rough + rough * (0.6 * Math.sin(a * 3 + ph) * 0.5 + 0.5 + 0.4 * rng()));
    if (i === 0) s.moveTo(Math.cos(a) * k, Math.sin(a) * k); else s.lineTo(Math.cos(a) * k, Math.sin(a) * k);
  }
  return new THREE.ShapeGeometry(s, 2).rotateX(-Math.PI / 2);
}
const put = (g, x, y, z, ry = 0, s = 1) => g.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), typeof s === 'number' ? V(s, s, s) : V(...s)));
/** A round house: its drum, a dome of green glass (or a cone), lit windows round it. */
function roundHouse(add, x, y, z, { r = 2, h = 5, dome = true, spire = 0, windows = 6, seed = 1 } = {}) {
  add('stone', new THREE.CylinderGeometry(r, r * 1.04, h, 16).translate(x, y + h / 2, z));
  add('stone2', new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.3, 16).translate(x, y + h, z));
  if (dome) add('glass', new THREE.SphereGeometry(r * 0.95, 16, 8, 0, TAU, 0, Math.PI / 2).translate(x, y + h + 0.15, z));
  else add('stone2', new THREE.ConeGeometry(r * 1.05, r * 1.4, 16).translate(x, y + h + r * 0.7, z));
  if (spire) add('glass', new THREE.ConeGeometry(r * 0.25, spire, 8).translate(x, y + h + r * 0.9 + spire / 2, z));
  for (let i = 0; i < windows; i++) {
    const a = (i / windows) * TAU + seed, wy = y + h * (0.45 + 0.25 * (i % 2));
    add('lit', new THREE.BoxGeometry(0.5, 0.8, 0.12).translate(0, 0, r + 0.02).applyMatrix4(new THREE.Matrix4().makeRotationY(a)).translate(x, wy, z));
  }
}

/** An open cylinder seen from inside: its faces and normals turned inward. */
function inward(g) {
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  return g;
}
/** What each window shows below it, [layer, geometry] in the world (layers: stone, stone2, floor, glass, lit, dark, face, hands). */
export function wellParts(w, rim) {
  const out = [], add = (k, g) => { out.push([k, g]); return g; };
  const y0 = rim - w.depth, r = w.r, { x, z } = w;
  // its floor of streets, a wall of houses round the well (seen from inside: turned inward)
  add('floor', new THREE.CircleGeometry(r + 1.2, 32).rotateX(-Math.PI / 2).translate(x, y0 + 0.02, z));
  add('stone2', inward(new THREE.CylinderGeometry(r - 0.3, r - 0.3, w.depth + 1.5, 32, 3, true)).translate(x, y0 + (w.depth + 1.5) / 2 - 0.4, z));
  // the houses' fronts round it (the city goes on under the sand): windows lit in rows, dark doors, a cornice
  const n = Math.round(r * 2.2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, turn = new THREE.Matrix4().makeRotationY(a), at = (g) => g.translate(0, 0, -(r - 0.45)).applyMatrix4(turn).translate(x, 0, z);
    for (let row = 0; row < 3; row++) if ((i + row) % 3 !== 0) add('lit', at(new THREE.BoxGeometry(0.7, 1.1, 0.1).translate(0, y0 + 3.2 + row * 3.1, 0)));
    if (i % 2 === 0) add('dark', at(new THREE.BoxGeometry(1.1, 2.2, 0.1).translate(0, y0 + 1.1, 0)));
  }
  add('stone', inward(new THREE.CylinderGeometry(r - 0.5, r - 0.5, 0.4, 32, 1, true)).translate(x, y0 + 2.6, z));
  add('stone', inward(new THREE.CylinderGeometry(r - 0.5, r - 0.5, 0.4, 32, 1, true)).translate(x, y0 + 8.8, z));
  if (w.holds === 'domes') {
    roundHouse(add, x - 2.2, y0, z - 1.0, { r: 1.8, h: 4.5, seed: 1 });
    roundHouse(add, x + 2.4, y0, z + 1.2, { r: 1.5, h: 6, dome: false, seed: 2 });
    roundHouse(add, x + 0.4, y0, z - 3.6, { r: 1.2, h: 7.5, spire: 2.5, seed: 3 });
    add('stone2', new THREE.BoxGeometry(4.2, 0.35, 1.0).translate(x + 0.2, y0 + 4.6, z + 0.1).rotateY(0));
  } else if (w.holds === 'stair') {
    for (let i = 0; i < 12; i++) add('stone', new THREE.BoxGeometry(2.4, 0.5, 0.9).translate(x - 1.5 + 0.0, y0 + 0.25 + i * 0.5, z + 4.5 - i * 0.8));
    roundHouse(add, x + 2.8, y0, z - 1.5, { r: 2.0, h: 5.5, seed: 4 });
    for (let i = 0; i < 4; i++) add('stone', new THREE.CylinderGeometry(0.28, 0.28, 4, 8).translate(x - 4.2 + i * 1.9, y0 + 2, z + 3.8));
    add('stone2', new THREE.BoxGeometry(6.8, 0.5, 0.8).translate(x - 1.35, y0 + 4.2, z + 3.8));
  } else {
    // a square with its clock tower, a fountain, houses round it, a bridge
    add('stone', new THREE.BoxGeometry(2.6, 11, 2.6).translate(x, y0 + 5.5, z));
    add('stone2', new THREE.ConeGeometry(2.0, 2.4, 4).rotateY(Math.PI / 4).translate(x, y0 + 12.2, z));
    const c = clock({ minute: 7, kind: 'round' });
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const m = new THREE.Matrix4().makeRotationY(a).premultiply(new THREE.Matrix4().makeTranslation(x, y0 + 9, z)).multiply(new THREE.Matrix4().makeTranslation(0, 0, 1.32)).multiply(new THREE.Matrix4().makeScale(1.7, 1.7, 1.7));
      add('face', c.face.clone().applyMatrix4(m)); add('hands', c.hands.clone().applyMatrix4(m)); add('stone2', c.body.clone().applyMatrix4(m));
    }
    add('stone2', new THREE.TorusGeometry(2.0, 0.3, 6, 20).rotateX(Math.PI / 2).translate(x + 4.6, y0 + 0.4, z + 3.4));
    roundHouse(add, x - 5.2, y0, z - 2.5, { r: 2.0, h: 5, seed: 5 });
    roundHouse(add, x + 5.0, y0, z - 3.8, { r: 1.7, h: 6.5, dome: false, seed: 6 });
    roundHouse(add, x - 4.0, y0, z + 4.6, { r: 1.6, h: 4.2, seed: 7 });
    add('stone2', new THREE.BoxGeometry(5.2, 0.4, 1.2).translate(x - 2.6, y0 + 4.4, z - 1.2));
  }
  return out;
}

// ------------------------------------------------------------------ the city under the sand (its room, off the map)

/** A local point of the city (x, y, z from its floor under the sinkhole) in the world. */
export const cityPoint = (x, y, z) => V(CITY.at[0] + x, CITY.at[1] + y, CITY.at[2] + z);
/** Is a world point in the city (its box, a little margin)? */
export function inCity(p) {
  if (!p) return false;
  const [x0, x1, z0, z1] = CITY.box, x = p.x - CITY.at[0], y = p.y - CITY.at[1], z = p.z - CITY.at[2];
  return x > x0 - 2 && x < x1 + 2 && z > z0 - 2 && z < z1 + 2 && y > -3 && y < CITY.ceiling + 6;
}

/** The ceiling's outline, a rectangle with the sinkhole's hole and the tower's (local x, z). */
function ceilingGeometry() {
  const [x0, x1, z0, z1] = CITY.box, s = new THREE.Shape();
  // (drawn in x, z and turned into the xz plane by rotateX(+π/2): its face turned down, seen from the streets)
  s.moveTo(x0, z0); s.lineTo(x0, z1); s.lineTo(x1, z1); s.lineTo(x1, z0); s.lineTo(x0, z0);
  const hole = (cx, cz, r) => { const p = new THREE.Path(); p.absarc(cx, cz, r, 0, TAU, false); s.holes.push(p); };
  hole(CITY.ramp.top[0], CITY.ramp.top[2] - 1.5, 3.4);
  hole(CITY.tower.x, CITY.tower.z, CITY.tower.r + 0.1);
  return new THREE.ShapeGeometry(s, 24).rotateX(Math.PI / 2);   // (its face turned down: seen from the streets)
}

/** Build the city's room: its kit's meshes, its lights, its shafts of light. */
function buildCity(scene, M, veils) {
  const group = new THREE.Group();
  group.name = 'The city under the sand';
  group.position.set(...CITY.at);
  scene.add(group);
  const centre = V(...CITY.at);
  const kit = new RoomKit({ group, ground: null, centre, seed: 5166 });
  const L = CITY_LOOK;
  const mat = {
    stone: kit.mat({ color: L.stone, flat: true, hatch: 0.45, line: 0.6, shade: 0.5 }),
    stone2: kit.mat({ color: L.stone2, flat: true, hatch: 0.4, line: 0.6, shade: 0.5 }),
    floor: kit.mat({ color: L.floor, flat: true, hatch: 0.3, line: 0.4 }),
    glass: kit.mat({ color: L.glass, flat: true, glow: 0.35, line: 0.4, lineTint: 0.8, spot: 0 }),
    lit: kit.mat({ color: L.lit, flat: true, glow: 0.9, line: 0.2 }),
    sand: kit.mat({ color: L.sand, flat: true, hatch: 0.35, spot: 0 }),
    roofSand: kit.mat({ color: L.sand, flat: true, hatch: 0.35, spot: 0, side: THREE.DoubleSide }),
    ceiling: kit.mat({ color: L.ceiling, flat: true, glow: 0.55, line: 0.3, lineTint: 1, spot: 0, side: THREE.DoubleSide }),
    print: kit.mat({ color: L.print, flat: true, spot: 0 }),
    face: kit.mat({ color: '#f6f0e4', flat: true, glow: 0.5, spot: 0 }),
    hands: kit.mat({ color: '#34405e', flat: true, spot: 0 }),
  };
  const add = (k, g, o) => kit.add(mat[k], g, o);
  const [x0, x1, z0, z1] = CITY.box, W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, C = CITY.ceiling;
  // the streets: paving, its joints a darker grid
  add('floor', new THREE.BoxGeometry(W, 0.4, D).translate(cx, -0.2, cz));
  for (let x = x0 + 6; x < x1; x += 6) add('stone2', new THREE.BoxGeometry(0.12, 0.02, D).translate(x, 0.01, cz), { solid: false });
  for (let z = z0 + 6; z < z1; z += 6) add('stone2', new THREE.BoxGeometry(W, 0.02, 0.12).translate(cx, 0.01, z), { solid: false });
  // the walls round it: the city goes on beyond, under sand banked to the roof (houses' fronts, their doors dark)
  for (const [px, pz, w, d] of [[cx, z0, W, 1], [cx, z1, W, 1], [x0, cz, 1, D], [x1, cz, 1, D]]) {
    add('stone2', new THREE.BoxGeometry(w, C, d).translate(px, C / 2, pz));
    add('sand', new THREE.BoxGeometry(w > 1 ? w : 7, 3, d > 1 ? d : 7).translate(px, 0.2, pz).rotateY(0), { solid: true });
  }
  for (const [i, [px, pz, ry]] of [[x0 + 0.6, 0, Math.PI / 2], [x1 - 0.6, 0, -Math.PI / 2], [0, z0 + 0.6, 0], [0, z1 - 0.6, Math.PI]].entries()) {
    const along = i < 2 ? D : W, n = Math.floor(along / 7);
    for (let k = 0; k < n; k++) {
      const t = -along / 2 + (k + 0.5) * (along / n), m = new THREE.Matrix4().makeRotationY(ry).premultiply(new THREE.Matrix4().makeTranslation(i < 2 ? px : cx + t, 0, i < 2 ? cz + t : pz));
      add('lit', new THREE.BoxGeometry(1.2, 1.6, 0.1).translate(0, 6 + (k % 2) * 3, 0.05).applyMatrix4(m));
      add('print', new THREE.BoxGeometry(1.6, 2.6, 0.1).translate(0, 1.3, 0.05).applyMatrix4(m));
    }
  }
  // the ceiling of glass, lit from above (no shadow: the sun comes through it), its lattice, and the sand drifted on it
  const ceil = new THREE.Mesh(ceilingGeometry().translate(0, C, 0), mat.ceiling);
  ceil.userData.castShadow = false; ceil.userData.noCollide = true;
  group.add(ceil);
  for (let x = x0 + 8; x < x1; x += 8) add('stone2', new THREE.BoxGeometry(0.3, 0.45, D).translate(x, C - 0.25, cz), { solid: false });
  for (let z = z0 + 8; z < z1; z += 8) add('stone2', new THREE.BoxGeometry(W, 0.45, 0.3).translate(cx, C - 0.25, z), { solid: false });
  const rng = mulberry32(1660);
  const clearAt = (x, z) => CITY.clear.some(([a, b, r]) => Math.hypot(x - a, z - b) < r) || Math.hypot(x - CITY.ramp.top[0], z - CITY.ramp.top[2]) < 5 || Math.hypot(x - CITY.tower.x, z - CITY.tower.z) < CITY.tower.r + 1.5;
  const sandOn = [];
  for (let x = x0 + 4; x < x1; x += 7) for (let z = z0 + 4; z < z1; z += 7) {
    const px = x + (rng() - 0.5) * 4, pz = z + (rng() - 0.5) * 4;
    if (clearAt(px, pz)) continue;
    sandOn.push(put(blob(4.2 + rng() * 1.6, 70 + sandOn.length, 0.35), px, C - 0.06, pz));   // (just under the glass: seen from the streets)
  }
  // (the sand's patches seen from the streets, both faces: they cast the shadows the shafts of light fall between)
  const sandMesh = new THREE.Mesh(mergeGeometries(sandOn.map(clean)), mat.roofSand);
  sandMesh.userData.noCollide = true;
  group.add(sandMesh);
  // your own footprints, crossing the clear glass over the landing (the walk from the sinkhole's lip to the house)
  for (let i = 0; i < 14; i++) {
    const t = i / 13, x = 3 + t * 11, z = 23 - t * 9, side = i % 2 ? 0.22 : -0.22, yaw = Math.atan2(11, -9);
    add('print', put(new THREE.CircleGeometry(0.5, 10).scale(0.32, 0.72, 1).rotateX(Math.PI / 2), x + Math.cos(yaw) * side, C - 0.04, z - Math.sin(yaw) * side, yaw), { solid: false });
  }
  // the ramp of the sand that fell in under the sinkhole (its top under the hole: the way back up), banked either side
  const { top, foot, w: rw } = CITY.ramp;
  {
    // (a wedge, solid to the floor: drawn in z, y and turned so it runs along z, rw wide)
    const w = new THREE.Shape([new THREE.Vector2(foot[2], foot[1] - 0.2), new THREE.Vector2(top[2], top[1]), new THREE.Vector2(top[2] - 0.4, top[1]), new THREE.Vector2(top[2] - 0.4, -0.2)]);
    add('sand', new THREE.ExtrudeGeometry(w, { depth: rw, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(rw / 2, 0, 0));
  }
  // the round tower under the Clock-House, through the ceiling; its clock stopped at seven to, over the square
  const T = CITY.tower;
  add('stone', new THREE.CylinderGeometry(T.r, T.r * 1.08, C + 4, 24).translate(T.x, (C + 4) / 2, T.z));
  for (const y of [4.2, 9.4, C - 0.6]) add('stone2', new THREE.CylinderGeometry(T.r + 0.3, T.r + 0.3, 0.45, 24).translate(T.x, y, T.z));
  add('print', new THREE.BoxGeometry(1.6, 2.8, 0.4).translate(0, 1.4, T.r).applyMatrix4(new THREE.Matrix4().makeRotationY(CITY.landingHeading + Math.PI)).translate(T.x, 0, T.z));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, y = 6 + (i % 2) * 5; add('lit', new THREE.BoxGeometry(0.6, 1.4, 0.12).translate(0, 0, T.r + 0.02).applyMatrix4(new THREE.Matrix4().makeRotationY(a)).translate(T.x, y, T.z)); }
  {
    const c = clock({ minute: 7, kind: 'round' });
    const m = new THREE.Matrix4().makeTranslation(T.x, 11.6, T.z).multiply(new THREE.Matrix4().makeRotationY(CITY.landingHeading + Math.PI)).multiply(new THREE.Matrix4().makeTranslation(0, 0, T.r + 0.12)).multiply(new THREE.Matrix4().makeScale(3.4, 3.4, 3.4));
    add('face', c.face.applyMatrix4(m)); add('hands', c.hands.applyMatrix4(m)); add('stone2', c.body.applyMatrix4(m));
  }
  // the houses: round drums with domes of green glass, arcades, a dry fountain in the square, floats on a doorstep
  const houses = [[-26, -22, 3.2, 7], [-14, -24, 2.4, 9], [-28, -6, 2.8, 6], [-26, 14, 3, 8], [-24, 32, 2.6, 6], [-10, 38, 3.4, 7], [16, 38, 2.6, 9], [34, 34, 3.2, 6], [38, 16, 2.4, 8], [16, -26, 2.8, 7], [40, -24, 2.6, 6], [-12, -6, 2.2, 5]];
  for (const [i, [x, z, r, h]] of houses.entries()) roundHouse((k, g) => add(k, g), x, 0, z, { r, h, dome: i % 3 !== 1, spire: i % 4 === 0 ? 3 : 0, windows: 7, seed: i });
  for (let i = 0; i < 6; i++) add('stone', new THREE.CylinderGeometry(0.4, 0.45, 6, 10).translate(-20 + i * 5, 3, -14));
  add('stone2', new THREE.BoxGeometry(27, 1.0, 2.2).translate(-7.5, 6.4, -14));
  const fx = 14, fz = 4;
  add('stone2', new THREE.TorusGeometry(3.2, 0.45, 6, 24).rotateX(Math.PI / 2).translate(fx, 0.5, fz));
  add('stone', new THREE.CylinderGeometry(3.2, 3.2, 0.3, 24).translate(fx, 0.15, fz));
  add('stone', new THREE.CylinderGeometry(0.35, 0.6, 2.2, 10).translate(fx, 1.1, fz));
  add('glass', new THREE.SphereGeometry(1.1, 12, 6, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI).translate(fx, 2.6, fz), { solid: false });
  add('sand', new THREE.ConeGeometry(2.2, 0.8, 10).translate(fx + 1.4, 0.55, fz + 0.6));
  for (const [x, z] of [[-9.2, 35.6], [-8.4, 35.9], [-9.8, 36.4]]) add('glass', new THREE.IcosahedronGeometry(0.32, 1).translate(x, 0.32, z), { solid: false });
  for (const [x, z, r] of [[-22, 30, 2.4], [34, 28, 2], [-24, -2, 2.2], [24, -22, 1.8]]) add('sand', new THREE.ConeGeometry(r, r * 0.6, 10).translate(x, r * 0.3, z));
  kit.finish();
  for (const m of kit.noShadow) m.userData.castShadow = false;
  // the light through the clear patches, in shafts to the streets (washes: src/veil.js LightShaft)
  const shafts = veils ? CITY.clear.map(([x, z, r]) => new LightShaft(veils, scene, { color: '#e9fbd6', alpha: [0.1, 0.12], near: 3 }).set(cityPoint(x, C, z), r * 0.7, cityPoint(x + 2.5, 0, z + 1.5), r * 0.9)) : [];
  // its lamps at night: the floats' glow and the lit windows
  for (const [x, z] of [[fx, fz], [CITY.landing[0], CITY.landing[2]], [T.x - 6, T.z + 6], [-20, 20], [-14, -18], [30, 30]]) kit.light(x, 3, z, 16);
  return { group, kit, lights: kit.lights, shafts };
}

// ------------------------------------------------------------------ all of it

/**
 * The windows' wells and panes, the sinkhole, the city and the ways between. M: the dunes' materials (M.dark, M.glass);
 * ground: the terrain. Returns { windows, sinkhole, city, portals, sights, lights, avoid(x, z, r) }.
 */
export function buildSandCity(scene, M, { ground, veils = null } = {}) {
  const group = new THREE.Group();
  group.name = 'The windows in the sand';
  scene.add(group);
  const kit = new RoomKit({ group, ground, centre: V(), seed: 5167 });
  const L = CITY_LOOK;
  const mat = {
    stone: kit.mat({ color: L.stone, flat: true, hatch: 0.45, line: 0.6, shade: 0.5 }),
    stone2: kit.mat({ color: L.stone2, flat: true, hatch: 0.4, line: 0.6, shade: 0.5 }),
    floor: kit.mat({ color: L.floor, flat: true, hatch: 0.3, line: 0.4 }),
    glass: kit.mat({ color: L.glass, flat: true, glow: 0.4, line: 0.4, lineTint: 0.8, spot: 0 }),
    lit: kit.mat({ color: L.lit, flat: true, glow: 0.9, line: 0.2 }),
    face: kit.mat({ color: '#f6f0e4', flat: true, glow: 0.5, spot: 0 }),
    hands: kit.mat({ color: '#34405e', flat: true, spot: 0 }),
    dark: kit.mat({ color: '#2f4a44', flat: true, spot: 0 }),
    sand: kit.mat({ color: L.sand, flat: true, hatch: 0.35, spot: 0 }),
    shard: kit.mat({ color: '#a8e8c0', flat: true, glow: 0.2, line: 0.3, lineTint: 1, hatch: 0.2, spot: 0 }),
  };
  const windows = [], lights = [], panes = [], glows = [];
  for (const w of SAND_WINDOWS) {
    const rim = rimOf(w) ?? ground.heightAt(w.x + w.r + 8, w.z);
    // (solid as drawn, though nobody reaches them under the glass: the contact audit's walls agree)
    for (const [k, g] of wellParts(w, rim)) kit.add(mat[k], g, { solid: true, shadow: false });
    // the pane: walked on (an invisible collider), drawn as a wash over what is under it
    const collider = new THREE.Mesh(new THREE.CircleGeometry(w.r + 0.2, 32).rotateX(-Math.PI / 2).translate(w.x, rim + 0.3, w.z), new THREE.MeshBasicMaterial());
    collider.visible = false; collider.name = `The window in the sand (${w.id}): its glass`;
    group.add(collider);
    const pane = new THREE.Mesh(new THREE.CircleGeometry(w.r - 0.3, 40).rotateX(-Math.PI / 2).translate(w.x, rim + 0.32, w.z), new THREE.MeshBasicMaterial({ visible: false }));
    pane.layers.set(31); pane.userData.noCollide = true; pane.userData.dynamic = true; pane.castShadow = false;
    group.add(pane);
    panes.push(pane);
    // (lit from the streets below: a pale glowing pane, and a bright thread where the glass meets its collar, the glint
    // that shows a window from across the valley; the landing's first one reads from the ship)
    if (veils) veils.add(pane, { color: L.lit, alpha: 0.26, glow: 0.7 });
    kit.add(mat.lit, new THREE.TorusGeometry(w.r - 0.45, 0.11, 5, 48).rotateX(Math.PI / 2).translate(w.x, rim + 0.36, w.z), { solid: false });
    // a drift or two of sand blown over the glass's edge
    const rng = mulberry32(900 + w.r);
    for (let i = 0; i < 2; i++) {
      const a = rng() * TAU, d = w.r * (0.55 + 0.3 * rng());
      kit.add(mat.sand, put(blob(w.r * (0.28 + 0.12 * rng()), 300 + i + w.r, 0.4), w.x + Math.cos(a) * d, rim + 0.36, w.z + Math.sin(a) * d), { solid: false });
    }
    // the city's light rising off the glass, a soft column you see from across the valley (a wash: src/veil.js LightShaft)
    if (veils) glows.push(new LightShaft(veils, group, { color: L.lit, glow: 1, alpha: [0.1, 0.16], inner: 0.5, near: 4, segments: 20 })
      .set(V(w.x, rim + 0.4 + w.r * 1.3, w.z), w.r * 0.35, V(w.x, rim + 0.4, w.z), w.r * 0.85));
    lights.push(new THREE.Vector4(w.x, rim - w.depth + 3, w.z, w.r * 1.6));
    windows.push({ ...w, rim, floor: rim - w.depth, at: V(w.x, rim + 0.3, w.z) });
  }
  // the sinkhole: its funnel is the ground's (cutSand); broken glass round its lip, its throat dark, sand pouring in
  const S = SINKHOLE, rim = rimOf(S) ?? ground.heightAt(S.x + S.r + 8, S.z), throatY = rim - S.depth;
  const srng = mulberry32(5168);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + srng() * 0.3, d = S.r - 0.6 + srng() * 1.6, h = 0.8 + srng() * 2.0;
    const shard = new THREE.ConeGeometry(0.5 + srng() * 0.6, h, 3).translate(0, h / 2 - 0.3, 0);
    shard.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.5 * (srng() - 0.5), srng() * TAU, -0.6 * Math.sign(Math.cos(a)) * srng())));
    const x = S.x + Math.cos(a) * d, z = S.z + Math.sin(a) * d;
    kit.add(mat.shard, shard.translate(x, ground.heightAt(x, z), z), { solid: false });
  }
  kit.add(M.dark, new THREE.CircleGeometry(S.throat * 1.6, 18).rotateX(-Math.PI / 2).translate(S.x, throatY + 0.06, S.z), { solid: false });
  const pour = veils ? [0.6, 2.4, 4.3].map((a) => {
    const top = V(S.x + Math.cos(a) * (S.r - 0.6), rim + 0.1, S.z + Math.sin(a) * (S.r - 0.6));
    return new LightShaft(veils, group, { color: L.sand, glow: 0, alpha: [0.35, 0.45], inner: 0.5, near: 1.5, segments: 8 }).set(top, 0.35, V(S.x + Math.cos(a) * 0.8, throatY, S.z + Math.sin(a) * 0.8), 0.2);
  }) : [];
  kit.finish();
  for (const m of kit.noShadow) m.userData.castShadow = false;
  // the city, and the ways down and back up
  const city = buildCity(scene, M, veils);
  lights.push(...city.lights);
  // (out on the lip's west side, facing away from the hole: open sand, clear of the warm flow south of it)
  const lipOut = V(S.x - S.r - 3.4, 0, S.z); lipOut.y = ground.heightAt(lipOut.x, lipOut.z);
  const portals = [
    // into the throat: you come down the sand in the city, at the foot of the ramp, the tower ahead
    { at: V(S.x, throatY + 0.8, S.z), r: S.throat, to: cityPoint(...CITY.landing).add(V(0, 0.1, 0)), heading: CITY.landingHeading, name: 'the sinkhole' },
    // up the ramp to its top, under the hole: out on the sinkhole's lip, facing away from it
    { at: cityPoint(...CITY.exit), r: 1.7, to: lipOut, heading: -Math.PI / 2, name: 'the way up' },
  ];
  const sights = [
    ...windows.map((w) => ({ name: `the window in the sand (${w.holds === 'square' ? 'the square below' : w.holds === 'stair' ? 'a stair below' : 'domes below'})`, at: w.at.clone() })),
    { name: 'the sinkhole by the Clock-House', at: V(S.x, rim, S.z) },
  ];
  const avoid = (x, z, rr = 0) => [...SAND_WINDOWS, SINKHOLE].some((w) => Math.hypot(x - w.x, z - w.z) < w.r + APRON[0] + rr);
  return { windows, sinkhole: { ...S, rim, throatY, lip: lipOut }, city, portals, sights, lights, avoid, panes, pour, glows };
}
