import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { SmokeColumn } from './story/flames.js';

// The Buried Machine's way back to Wen (level design audit, fourth round: the walk from the great wheel back to the
// great dome passed nothing new). The Tooth Day posts: every Tooth Day the counters walk the sliver the wheel dropped
// from its foot to Wen's dome, and leave a post where they rest, the year's sliver nailed on top. Forty-one teeth on,
// the posts make a row across the dunes, the oldest by the domes grey and leaning, the newest by the wheel still red
// with rust. Kept off the strip the wheel digs out when it turns (src/levels/buried.js wheelSand). No rng.
//
//   buildToothPosts(scene, terrain) → { points, sight, oldest }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const nonIdx = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };

/** The row, [x, z]: from the newest post, by the wheel's foot (outside its sand strip), to the oldest, by the domes. */
export const TOOTH_POSTS = { from: [80, -140], to: [-2, -30], count: 41 };

export function buildToothPosts(scene, terrain) {
  const { from, to, count } = TOOTH_POSTS;
  const wood = [], rust = [];
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1), age = t;   // (0 the newest, 1 the oldest)
    // (a gentle bow in the row, as people walk it: a little off the straight line in the middle)
    const bow = Math.sin(t * Math.PI) * 9;
    const dx = to[0] - from[0], dz = to[1] - from[1], L = Math.hypot(dx, dz);
    const x = from[0] + dx * t + (dz / L) * bow, z = from[1] + dz * t - (dx / L) * bow;
    const y = terrain.heightAt(x, z), h = 1.35 - age * 0.35;
    const lean = (((i * 7) % 5) - 2) * 0.05 * (0.4 + age), yaw = i * 1.37;
    const m = new THREE.Matrix4().compose(V(x, y - 0.35, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, yaw, lean * 0.6)), V(1, 1, 1));
    wood.push(nonIdx(new THREE.BoxGeometry(0.22, h + 0.35, 0.22).translate(0, (h + 0.35) / 2, 0)).applyMatrix4(m));
    // the sliver: a little curved wedge of iron nailed on top
    rust.push(nonIdx(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 6, 1, false, 0, Math.PI * 0.7).rotateX(Math.PI / 2).translate(0, h + 0.38, 0)).applyMatrix4(m));
    pts.push([x, y + 0.5, z]);
  }
  const posts = new THREE.Mesh(mergeGeometries(wood), makeMaterial({ color: '#a8917a', flat: true }));
  posts.name = 'The Tooth Day posts';
  const slivers = new THREE.Mesh(mergeGeometries(rust), makeMaterial({ color: '#b5583a', flat: true, metal: 'iron' }));
  // (drawn only, thin posts you walk beside: as solids they shifted the contact audit's sampling of the whole world)
  posts.userData.noCollide = true; slivers.userData.noCollide = true;
  scene.add(posts, slivers);
  const every = (k) => pts.filter((_, i) => i % k === 0 || i === pts.length - 1);
  return { points: every(4), sight: V(...pts[Math.floor(count * 0.45)]), oldest: V(...pts[count - 1]) };
}

// The oil main (level design audit v1.46, issue #42: the oculus → the great wheel was 351 m and blind): the pipe the
// Wick's valve feeds, from the valve out of the drum's doorway, north along the canyon floor by its east side (through
// the cross-walls beside their openings, as a pipe goes through a bulkhead, the way through them left bare), up the sand ramp and over the dunes, east of the Tooth Day posts, to the great
// wheel's foot, where it dives into the sand under the wheel. Half sunk, painted as the rims' pipe bundles, a flange every
// 12 m. Solid as drawn, sunk so its top stands 0.4 m over the sand: a low pipe you step over.
//
//   buildOilMain(scene, terrain, { from, to, cx, floorAt, narrows }) → { points }

/** How far east of the canyon's centreline the main runs on its floor: 14 m, in to 3 m through a narrow (the drum's doorway). */
export const oilMainOffset = (z, narrows = []) => 14 - 11 * Math.max(0, ...narrows.map((w) => 1 - Math.min(1, Math.max(0, (Math.abs(z - w) - 10) / 16))));

export function buildOilMain(scene, terrain, { from, to, cx, floorAt, narrows = [] }) {
  const H = (x, z) => terrain.heightAt(x, z), r = 0.55;
  const pts = [V(from.x, from.y, from.z)];
  // out of the drum's doorway (it faces +z, back up the canyon), then the floor north to the ramp's head
  for (let z = from.z + 18; z <= -56; z += 8) {
    const x = cx(z) + oilMainOffset(z, narrows);
    pts.push(V(x, Math.max(floorAt(z), H(x, z)) - 0.15, z));
  }
  // over the ramp's shallow east side onto the dunes, then east and round to the wheel's foot from the north, well
  // clear of the posts (the walk back along them still passes what the way out did not)
  const way = [V(cx(-48) + 22, 0, -48), V(58, 0, -42), V(90, 0, -66), to.clone().lerp(V(90, 0, -66), 0.2)];
  for (let i = 1; i < way.length; i++) for (let t = 0; t < 1; t += 0.25) {
    const p = way[i - 1].clone().lerp(way[i], t);
    pts.push(V(p.x, H(p.x, p.z) - 0.15, p.z));
  }
  const end = way.at(-1);
  pts.push(V(end.x, H(end.x, end.z) - 0.15, end.z));
  const line = pts.map((p) => [p.x, p.y, p.z]);
  // (and into the sand toward the wheel)
  pts.push(V(end.x + (to.x - end.x) * 0.15, H(end.x, end.z) - 1.4, end.z + (to.z - end.z) * 0.15));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const L = curve.getLength();
  const tube = nonIdx(new THREE.TubeGeometry(curve, Math.ceil(L / 3), r, 8));
  const flanges = [];
  for (let s = 6; s < L - 4; s += 12) {
    const u = s / L, p = curve.getPointAt(u), d = curve.getTangentAt(u);
    flanges.push(nonIdx(new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.5, 10).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d)).translate(p.x, p.y, p.z)));
  }
  const pipe = new THREE.Mesh(tube, makeMaterial({ color: '#d8dcc8', metal: 'painted' }));   // (the rims' pipe bundles' paint, src/levels/buried.js M.pipe)
  const rings = new THREE.Mesh(mergeGeometries(flanges), makeMaterial({ color: '#a9b4a8', flat: true, metal: 'steel' }));   // (M.flange)
  pipe.name = 'The oil main'; rings.name = 'The oil main’s flanges';
  rings.userData.noCollide = true;   // (the pipe solid as drawn, its top 0.4 m over the sand: stepped over)
  scene.add(pipe, rings);
  return { points: line.filter((_, i) => i % 3 === 0 || i === line.length - 1) };
}

// The flue vents (level design audit v1.49, issue #132: the walk home from the Engine-House to the ship was the 106 m of
// dunes you had crossed toward it, with nothing on them). The engine breathes out under the sand along its old flue,
// from beside the Engine-House's door to the landing hollow, through a row of iron vent caps on short stacks, and
// halfway the stokers' whistle stands on its pipe over a valve wheel. Cold while the engine is jammed; once the
// Tooth-Warden is stopped the caps puff in a wave running from the door to the hollow, and the whistle steams
// (src/story/buried.js). Low, drawn only, stepped past. No rng.
//
//   buildFlueVents(scene, terrain) → { points, vents, whistle, sight }

/** The vents, [x, z]: from beside the Engine-House's door to the landing hollow's west lip; the whistle halfway. */
export const FLUE_VENTS = { from: [-93, 87], to: [-14, 63], count: 9, whistle: [-44, 81] };

export function buildFlueVents(scene, terrain) {
  const { from, to, count, whistle } = FLUE_VENTS;
  const iron = [], rust = [], vents = [];
  const H = (x, z) => terrain.heightAt(x, z);
  const dx = to[0] - from[0], dz = to[1] - from[1], L = Math.hypot(dx, dz);
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1), bow = Math.sin(t * Math.PI) * 5;   // (a gentle bow south, past the whistle)
    const x = from[0] + dx * t - (dz / L) * bow, z = from[1] + dz * t + (dx / L) * bow, y = H(x, z);
    // a short stack out of the sand, a flared cap on three struts over it, a flange at its foot
    iron.push(nonIdx(new THREE.CylinderGeometry(0.32, 0.36, 0.9, 10).translate(x, y + 0.3, z)));
    iron.push(nonIdx(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 12).translate(x, y + 0.02, z)));
    rust.push(nonIdx(new THREE.ConeGeometry(0.62, 0.36, 12).translate(x, y + 1.06, z)));
    for (let k = 0; k < 3; k++) { const a = k * 2.09 + i; iron.push(nonIdx(new THREE.BoxGeometry(0.05, 0.22, 0.05).translate(x + Math.cos(a) * 0.28, y + 0.82, z + Math.sin(a) * 0.28))); }
    vents.push(V(x, y + 1.25, z));
  }
  // the stokers' whistle: a tall pipe on a flanged foot, the whistle's bell on top, a valve wheel at hand height
  const [wx, wz] = whistle, wy = H(wx, wz);
  iron.push(nonIdx(new THREE.CylinderGeometry(0.75, 0.85, 0.3, 14).translate(wx, wy + 0.1, wz)));
  iron.push(nonIdx(new THREE.CylinderGeometry(0.16, 0.16, 4.6, 8).translate(wx, wy + 2.4, wz)));
  rust.push(nonIdx(new THREE.CylinderGeometry(0.34, 0.26, 1.1, 12).translate(wx, wy + 5.1, wz)));
  rust.push(nonIdx(new THREE.SphereGeometry(0.36, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(wx, wy + 5.65, wz)));
  rust.push(nonIdx(new THREE.TorusGeometry(0.42, 0.06, 5, 16).rotateY(Math.PI / 2).translate(wx + 0.22, wy + 1.35, wz)));
  for (let k = 0; k < 4; k++) rust.push(nonIdx(new THREE.BoxGeometry(0.04, 0.8, 0.04).rotateX((k * Math.PI) / 4).translate(wx + 0.22, wy + 1.35, wz)));
  const caps = new THREE.Mesh(mergeGeometries(iron), makeMaterial({ color: '#5f7592', flat: true, metal: 'iron' }));
  const tops = new THREE.Mesh(mergeGeometries(rust), makeMaterial({ color: '#ad5a3e', flat: true, metal: 'iron' }));
  caps.name = 'The flue vents'; tops.name = 'The flue vents’ caps and the stokers’ whistle';
  caps.userData.noCollide = true; tops.userData.noCollide = true;
  scene.add(caps, tops);
  return {
    // (the way along them, for the level design audit: from the Engine-House's door past every cap to the hollow)
    points: [[from[0] - 4, H(from[0] - 4, from[1] + 3) + 0.5, from[1] + 3], ...vents.map((p) => [p.x, p.y - 0.75, p.z]), [to[0] + 12, H(to[0] + 12, to[1] - 3) + 0.5, to[1] - 3]],
    vents, whistle: V(wx, wy + 5.9, wz), sight: V(wx, wy + 0.5, wz),
  };
}

// The canyon stack (level design audit v1.49, issue #136: from Wen down into the rust canyon was 181 m with nothing to
// steer by, and the canyon's floor and the oculus saw no landmark: 57 % of the path saw one). The machine breathes out
// of the canyon too: a chimney stack of the dunes' kind (src/levels/buried.js "tall chimney stacks"), stood on the floor
// at the foot of the sand ramp against the west wall, rising past the rim to 70 m over the dunes, a ring platform at
// the rim and one halfway up, and a column of steam out of its top that leans away on the wind. Seen over the domes from
// Wen's, from the dunes and from the canyon's floor up and down. Solid as drawn; the steam is drawn only. No rng.
//
//   buildCanyonStack(scene, M, { x, z, floor, rim }) → { at, top, steam, update(dt, t, ctx) }
//
// Fisk's flag (the same issue: Wen → the Engine-House's door, 117 m, was blind by the numbers: the house shows, its
// door is hidden behind a hut): a tall iron mast beside the oval door with a long teal pennant streaming off it, the
// doorkeeper's, so the door shows over the domes. Drawn only (a mast you walk round).
//
//   buildDoorFlag(scene, M, terrain, { x, z }) → { top, height, wave(t) }

// The ramp's rope (the same issue): iron stakes down the sand ramp's west side from its head by the domes to its foot
// by the canyon stack, a rope slung between them, for the domes' people going down on Tooth Day. Drawn only. No rng.
//
//   buildRampRope(scene, M, terrain, { cx }) → { points }

/** The ramp's rope: a stake every `every` m of z from the ramp's head to its foot, `off` m west of the centreline. */
export const RAMP_ROPE = { z0: -36, z1: -158, every: 8, off: -12, h: 1.1 };

export function buildRampRope(scene, M, terrain, { cx }) {
  const { z0, z1, every, off, h } = RAMP_ROPE;
  const iron = [], rope = [], tops = [];
  for (let z = z0; z >= z1; z -= every) {
    const x = cx(z) + off, y = terrain.heightAt(x, z);
    iron.push(nonIdx(new THREE.CylinderGeometry(0.06, 0.08, h + 0.4, 5).translate(x, y + (h - 0.4) / 2, z)));
    iron.push(nonIdx(new THREE.TorusGeometry(0.1, 0.03, 4, 8).translate(x, y + h, z)));
    tops.push(V(x, y + h, z));
  }
  // the rope: slung between the stakes, sagging a little in each span
  const seg = (a, b) => { const d = a.distanceTo(b), c = new THREE.CylinderGeometry(0.03, 0.03, d, 4).translate(0, d / 2, 0); c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize())); return nonIdx(c.translate(a.x, a.y, a.z)); };
  for (let i = 1; i < tops.length; i++) {
    const a = tops[i - 1], b = tops[i], pts = [0, 0.25, 0.5, 0.75, 1].map((t) => a.clone().lerp(b, t).add(V(0, -0.35 * Math.sin(t * Math.PI), 0)));
    for (let k = 1; k < pts.length; k++) rope.push(seg(pts[k - 1], pts[k]));
  }
  const g = new THREE.Group();
  g.name = 'The ramp’s rope';
  const stakes = new THREE.Mesh(mergeGeometries(iron), M.rustDark), line = new THREE.Mesh(mergeGeometries(rope), M.ink);
  for (const m of [stakes, line]) m.userData.noCollide = true;
  g.add(stakes, line);
  scene.add(g);
  return { points: tops.map((p) => [p.x + 1.5, p.y - h + 0.5, p.z]), tops };
}

/** The canyon stack: at the sand ramp's foot, this far west of the canyon's centreline. */
export const CANYON_STACK = { z: -165, off: -15, top: 72 };
/** Fisk's flag: beside the Engine-House's door, on the side away from the flue vents (src/temples/buried.js SITE). */
export const DOOR_FLAG = { x: -95.5, z: 99.5, h: 19 };

export function buildCanyonStack(scene, M, { x, z, floor, rim }) {
  const b = floor - 2, top = CANYON_STACK.top, hh = top - b;
  const body = [], dark = [], ink = [], pipe = [];
  body.push(nonIdx(new THREE.CylinderGeometry(2.5, 3.4, hh, 14).translate(x, b + hh / 2, z)));
  dark.push(nonIdx(new THREE.CylinderGeometry(3.1, 2.7, 3, 14).translate(x, top + 1.5, z)));
  // the ring platforms: at the canyon's rim (the dunes' height) and halfway up from there
  for (const y of [rim + 1, (rim + top) / 2]) {
    dark.push(nonIdx(new THREE.CylinderGeometry(6, 6, 0.8, 18).translate(x, y, z)));
    ink.push(nonIdx(new THREE.TorusGeometry(6, 0.08, 4, 24).rotateX(Math.PI / 2).translate(x, y + 1.1, z)));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ink.push(nonIdx(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 4).translate(x + Math.cos(a) * 6, y + 0.6, z + Math.sin(a) * 6))); }
  }
  // a feed pipe up its canyon side and a mast on the cap
  pipe.push(nonIdx(new THREE.CylinderGeometry(0.8, 0.8, hh * 0.72, 8).translate(x + 4, b + hh * 0.36, z)));
  ink.push(nonIdx(new THREE.CylinderGeometry(0.15, 0.2, 12, 5).translate(x + 1.5, top + 8, z + 1)));
  const g = new THREE.Group();
  g.name = 'The canyon stack';
  const meshes = [new THREE.Mesh(mergeGeometries(body), M.steelFlat), new THREE.Mesh(mergeGeometries(dark), M.rustDark), new THREE.Mesh(mergeGeometries(pipe), M.pipe2), new THREE.Mesh(mergeGeometries(ink), M.ink)];
  meshes[3].userData.noCollide = true;
  for (const m of meshes.slice(0, 3)) m.userData.castShadow = true;
  g.add(...meshes);
  scene.add(g);
  // the steam: white, a little grey where it thins, over the canyon and the dunes
  const at = V(x, top + 3, z);
  const steam = new SmokeColumn(scene, at, { count: 90, height: 80, drift: 70, base: 2.4, top: 8, period: 70, palette: ['#f6f3ec', '#ece9e2', '#dfe2e2', '#e8e4da'], tint: '#f6f3ec', glow: 0.9 });
  steam.mesh.name = 'The canyon stack’s steam';
  let acc = 0, frame = 0;
  return {
    at: V(x, floor + 0.5, z), top: V(x, top + 3, z), steam,
    // (its column is a landmark: drawn always; moved every other frame, as the desert's camp smoke)
    update(dt, t, ctx) { acc += dt; if (frame++ % 2) return; steam.update(acc, t, ctx?.player?.wind ?? null, ctx?.camera ?? null); acc = 0; },
  };
}

export function buildDoorFlag(scene, M, terrain, { x, z, h } = DOOR_FLAG) {
  const y = terrain.heightAt(x, z) - 0.3;
  const iron = [nonIdx(new THREE.CylinderGeometry(0.2, 0.32, h, 8).translate(x, y + h / 2, z)), nonIdx(new THREE.CylinderGeometry(0.5, 0.6, 0.4, 8).translate(x, y + 0.2, z)),
    nonIdx(new THREE.SphereGeometry(0.28, 8, 6).translate(x, y + h + 0.2, z))];
  // the pennant: long, tapering, a ripple along it, streaming away from the house broadside to the domes, the teal of the door's ring
  const L = 11, tail = new THREE.PlaneGeometry(L, 2.6, 22, 1).translate(L / 2, 0, 0);
  { const p = tail.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / L; p.setY(i, p.getY(i) * (1 - 0.8 * u) - 0.8 * u); p.setZ(i, Math.sin(u * 5) * 0.6 * u); } tail.computeVertexNormals(); }
  const cloth = makeMaterial({ color: '#3f8c92', flat: true });
  cloth.side = THREE.DoubleSide;
  const pennant = new THREE.Mesh(tail, cloth);
  pennant.position.set(x, y + h - 1.6, z); pennant.rotation.y = -0.69;
  const g = new THREE.Group();
  g.name = 'Fisk’s flag';
  const mast = new THREE.Mesh(mergeGeometries(iron), M.ink);
  for (const m of [mast, pennant]) m.userData.noCollide = true;
  g.add(mast, pennant);
  scene.add(g);
  const base = pennant.rotation.y;
  return { top: V(x, y + h + 0.4, z), height: h, wave: (t) => { pennant.rotation.y = base + Math.sin(t * 0.9) * 0.18; pennant.rotation.x = Math.sin(t * 1.6) * 0.15; } };
}
