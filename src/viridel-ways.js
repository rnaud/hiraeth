import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_WATER } from './materials.js';

// Viridel's way back (level design audit, fourth round: the walk from the fallen ship back to Mira was the walk out).
// Mira's runnel: the gardeners' water clock by the landing spills into a narrow channel of white stone, which winds
// west round the meadow, past the pond's shore, and down to the vines over Odile and Talo's ship: Mira waters Vey's
// vines with the clock's overflow. The main quest's last stage sends you back up it. On the way, a sluice-gate where it
// leaves the clock's rise, and a stone basin by the pond where it rests. No rng: the garden round it stays as it was.
//
//   buildRunnel(scene, terrain) → { points, sluice, basin }
//   runnelDist(x, z)            → m from the channel's middle

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The runnel's line, [x, z]: from the water clock, west round the meadow by the pond, down to the ship's vines. */
export const RUNNEL = [[23, 35], [5, 20], [-18, -8], [-38, -48], [-40, -92], [-22, -135], [6, -166], [26, -180]];
/** The sluice-gate and the basin, [x, z] on the line. */
export const SLUICE = [-38, -50], BASIN = [-40, -92];

/** How far (x, z) is from the runnel's middle, m (the flora keeps out of its channel). */
const LINE = new THREE.CatmullRomCurve3(RUNNEL.map(([x, z]) => V(x, 0, z)), false, 'centripetal').getSpacedPoints(160);
export function runnelDist(x, z) {
  let best = Infinity;
  for (let i = 0; i + 1 < LINE.length; i++) {
    const a = LINE[i], b = LINE[i + 1], ex = b.x - a.x, ez = b.z - a.z, L = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L));
    best = Math.min(best, Math.hypot(x - a.x - ex * t, z - a.z - ez * t));
  }
  return best;
}

export function buildRunnel(scene, terrain) {
  const H = (x, z) => terrain.heightAt(x, z);
  const curve = new THREE.CatmullRomCurve3(RUNNEL.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  const n = Math.round(curve.getLength() / 1.5);
  const pts = curve.getSpacedPoints(n);
  const nrm = pts.map((_, i) => { const t = curve.getTangentAt(i / n); return V(-t.z, 0, t.x).normalize(); });
  const curb = [], water = [];
  const quad = (out, a, b, c, d) => out.push(...a, ...b, ...c, ...b, ...d, ...c);
  const at = (p, nv, off, dy) => { const x = p.x + nv.x * off, z = p.z + nv.z * off; return [x, H(x, z) + dy, z]; };
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[i + 1], np = nrm[i], nq = nrm[i + 1];
    for (const side of [-1, 1]) {
      const i0 = side * 0.45, o0 = side * 0.78;   // (the curb's inner and outer edge)
      const [aI, aO, bI, bO] = [at(p, np, i0, 0.26), at(p, np, o0, 0.26), at(q, nq, i0, 0.26), at(q, nq, o0, 0.26)];
      const [aIl, aOl, bIl, bOl] = [at(p, np, i0, -0.35), at(p, np, o0, -0.35), at(q, nq, i0, -0.35), at(q, nq, o0, -0.35)];
      if (side > 0) { quad(curb, aI, bI, aO, bO); quad(curb, aIl, bIl, aI, bI); quad(curb, aO, bO, aOl, bOl); }
      else { quad(curb, aO, bO, aI, bI); quad(curb, aI, bI, aIl, bIl); quad(curb, aOl, bOl, aO, bO); }
    }
    quad(water, at(p, np, 0.47, 0.06), at(q, nq, 0.47, 0.06), at(p, np, -0.47, 0.06), at(q, nq, -0.47, 0.06));
  }
  // the sluice-gate: two white posts, a lintel and a wooden board half lifted in its slot; the basin: a round stone
  // bowl the runnel passes through, a wide rim to sit on
  const parts = [];
  {
    const [x, z] = SLUICE, k = Math.round(n * 0.33), t = curve.getTangentAt(k / n), yaw = Math.atan2(t.x, t.z), y = H(x, z);
    const f = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw + Math.PI / 2), V(1, 1, 1));
    for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(0.3, 1.6, 0.3).translate(0, 0.6, s * 0.75).applyMatrix4(f));
    parts.push(new THREE.BoxGeometry(0.34, 0.24, 1.9).translate(0, 1.5, 0).applyMatrix4(f));
  }
  {
    const [x, z] = BASIN, y = H(x, z);
    parts.push(new THREE.CylinderGeometry(2.4, 2.1, 0.7, 18, 1, true).translate(x, y + 0.1, z), new THREE.RingGeometry(1.95, 2.45, 18).rotateX(-Math.PI / 2).translate(x, y + 0.45, z));
  }
  const stone = makeMaterial({ color: '#efe9dc', flat: true });
  const geo = (list) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list, 3)); g.computeVertexNormals(); return g; };
  const curbs = new THREE.Mesh(mergeGeometries([geo(curb), ...parts.map((g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals(); return g; })]), stone);
  curbs.name = 'Mira’s runnel';
  scene.add(curbs);   // (the curbs, the sluice and the basin collide as drawn: you step over the curbs)
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 1.4), makeMaterial({ color: '#b98a66', flat: true }));
  { const [x, z] = SLUICE, k = Math.round(n * 0.33), t = curve.getTangentAt(k / n); board.position.set(x, H(x, z) + 0.95, z); board.rotation.y = Math.atan2(t.x, t.z) + Math.PI / 2; }
  board.userData.noCollide = true;
  scene.add(board);
  const stream = new THREE.Mesh(geo(water), makeMaterial({ color: '#7fc4d0', color2: '#9ad3d9', mode: MODE_WATER }));
  stream.userData.noCollide = true; stream.userData.water = true;
  scene.add(stream);
  const points = RUNNEL.map(([x, z]) => [x, H(x, z) + 0.3, z]);
  return { points, sluice: V(SLUICE[0], H(...SLUICE), SLUICE[1]), basin: V(BASIN[0], H(...BASIN), BASIN[1]) };
}

// Viridel's way home from the Greenhouse (level design audit v1.49, issue #131: the walk home from its door was the
// meadow you had crossed toward it, 324 m with nothing on it). The long seed row: Sorrel's beds round the Greenhouse
// go on as one row of white-kerbed beds down the meadow, south past the white ruins where Oro grows his pyramid, then
// west to the landing; a marker stick in each, nothing come up. Halfway down to the ruins the builders' seed-drill stands
// where it stopped at the row's end, its hopper still half full. Once the Gardener sleeps every bed comes up green with a
// flower or two (src/temples/edena.js change: `beds`). Low and drawn only, the drill collides. No rng.
//
//   buildSeedRow(scene, terrain) → { points, beds: [{ at, yaw }], drill, sight }
//   seedRowDist(x, z)            → m from the row's middle

/** The seed row's line, [x, z]: from below the Greenhouse's sown beds, south past the white ruins, west to the landing. */
export const SEED_ROW = [[117, 280], [131, 238], [145, 196], [142, 155], [135, 122], [118, 92], [89, 66], [56, 28]];
/** The seed-drill, [x, z] beside the row, where it stopped; and a bed every `step` m. */
export const SEED_DRILL = [152, 201], SEED_STEP = 11.5;

const ROW = new THREE.CatmullRomCurve3(SEED_ROW.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
const ROW_PTS = ROW.getSpacedPoints(120);
export function seedRowDist(x, z) {
  let best = Infinity;
  for (let i = 0; i + 1 < ROW_PTS.length; i++) {
    const a = ROW_PTS[i], b = ROW_PTS[i + 1], ex = b.x - a.x, ez = b.z - a.z, L = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L));
    best = Math.min(best, Math.hypot(x - a.x - ex * t, z - a.z - ez * t));
  }
  return best;
}

export function buildSeedRow(scene, terrain) {
  const H = (x, z) => terrain.heightAt(x, z);
  const n = Math.round(ROW.getLength() / SEED_STEP);
  const kerb = [], soil = [], sticks = [], beds = [];
  const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals(); return g; };
  for (let i = 0; i <= n; i++) {
    const p = ROW.getPointAt(i / n), t = ROW.getTangentAt(i / n), yaw = Math.atan2(t.x, t.z), y = H(p.x, p.z);
    // (laid along the slope: since v1.55 the row starts down the Greenhouse's hill, issue #189)
    const pitch = Math.atan2(H(p.x + t.x * 2.8, p.z + t.z * 2.8) - H(p.x - t.x * 2.8, p.z - t.z * 2.8), 5.6);
    const f = new THREE.Matrix4().compose(V(p.x, y, p.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -pitch)), V(1, 1, 1));
    // a bed along the row: white kerbs round a strip of brown earth, sunk a little where the meadow slopes
    kerb.push(new THREE.BoxGeometry(2.6, 0.5, 5.6).translate(0, 0.05, 0).applyMatrix4(f));
    soil.push(new THREE.BoxGeometry(2.0, 0.5, 5.0).translate(0, 0.14, 0).applyMatrix4(f));
    sticks.push(new THREE.BoxGeometry(0.06, 0.75, 0.06).translate(0.5, 0.65, -1.9).applyMatrix4(f));
    beds.push({ at: V(p.x, y + 0.4, p.z), yaw });
  }
  // the seed-drill: a white hopper on two tall thin wheels, a row of coulters under it, the drawbar down on the grass
  // where whoever pulled it let go, a teal band round the hopper; its seed spilled in a little heap below the spout
  const [dx, dz] = SEED_DRILL, dy = H(dx, dz), near = ROW.getPointAt(ROW_PTS.reduce((k, q, i) => (Math.hypot(q.x - dx, q.z - dz) < Math.hypot(ROW_PTS[k].x - dx, ROW_PTS[k].z - dz) ? i : k), 0) / 120);
  const dt = ROW.getTangentAt(0.33), dyaw = Math.atan2(dt.x, dt.z) + 0.25;
  const F = new THREE.Matrix4().compose(V(dx, dy, dz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), dyaw), V(1, 1, 1));
  const body = [new THREE.BoxGeometry(2.6, 1.3, 1.5).translate(0, 1.75, 0), new THREE.BoxGeometry(2.0, 0.5, 1.1).translate(0, 0.95, 0)];
  for (const s of [-1, 1]) body.push(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 18).rotateZ(Math.PI / 2).translate(s * 1.45, 1.15, 0));
  const fit = [new THREE.BoxGeometry(2.7, 0.22, 1.6).translate(0, 2.0, 0)];
  for (let k = 0; k < 5; k++) fit.push(new THREE.BoxGeometry(0.07, 0.75, 0.3).rotateX(0.35).translate(-0.9 + k * 0.45, 0.4, 0.2));
  for (const s of [-1, 1]) fit.push(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5).rotateX(Math.PI / 2 - 0.42).translate(s * 0.5, 0.55, 1.9));
  fit.push(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5).rotateZ(Math.PI / 2).translate(0, 0.08, 3.05));
  const white = makeMaterial({ color: '#f7f4ec', flat: true, grid: 3 });
  const drill = new THREE.Mesh(mergeGeometries(body.map((g) => flat0(g.applyMatrix4(F)))), white);
  drill.name = 'The builders’ seed-drill';
  scene.add(drill);   // (collides as drawn: a box on two wheels to climb onto and look down the row)
  const band = new THREE.Mesh(mergeGeometries(fit.map((g) => flat0(g.applyMatrix4(F)))), makeMaterial({ color: '#62c3c9', flat: true, grid: 3 }));
  band.userData.noCollide = true;
  const heap = new THREE.Mesh(flat0(new THREE.SphereGeometry(0.55, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1).applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, -1.1)).applyMatrix4(F)), makeMaterial({ color: '#8a5f3e', flat: true }));
  heap.userData.noCollide = true;
  const mk = (list, mat, name) => { const m = new THREE.Mesh(mergeGeometries(list.map(flat0)), mat); m.name = name; m.userData.noCollide = true; return m; };
  scene.add(band, heap,
    mk(kerb, makeMaterial({ color: '#f8f6f0', flat: true }), 'The long seed row'),
    mk(soil, makeMaterial({ color: '#8a5f3e', flat: true }), 'The long seed row’s earth'),
    mk(sticks, makeMaterial({ color: '#f8f6f0', flat: true }), 'The long seed row’s marker sticks'));
  // (the way along it, for the level design audit: the row's own points, from the Greenhouse's beds to the landing)
  const points = SEED_ROW.map(([x, z]) => [x, H(x, z) + 0.3, z]);
  return { points, beds, drill: V(dx, dy + 2.4, dz), sight: V(dx, dy, dz), near: V(near.x, H(near.x, near.z), near.z) };
}

// Viridel's way up to the Greenhouse (issue #189: the walk there crossed the meadow you had come over, its longest empty
// stretch 109 m). The Greenhouse water: the stair's overflow comes down from a basin at its foot as a channel of white
// stone, south past the pyramid nursery, under a slab where it crosses Sorrel's seed row, through the fallen things and
// into the furrow by Odile and Talo's ship, where it sinks into the grass. Walked the other way it is the way up: from
// the ship past the fallen things and the nursery to the foot of the water stair (src/viridel-stair.js). Built as Mira's
// runnel is.
//
//   buildGreenhouseWater(scene, terrain, { cover }) → { points, basin, slabs }
//   greenhouseWaterDist(x, z)                       → m from the channel's middle

/** The channel's line, [x, z]: from the basin at the water stair's foot, south past the nursery and the fallen things to the
 * ship (beside the makers' glass climb, and through the vine walk's middle gap, 96 m east, clear of its decks). */
export const GREENHOUSE_WATER = [[91.3, 202.2], [89, 186], [90, 150], [91, 112], [88, 80], [94, 32], [96, 1], [103, -30], [106, -58], [104, -100], [99, -138], [87, -167], [66, -186]];
const GW = new THREE.CatmullRomCurve3(GREENHOUSE_WATER.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
const GW_PTS = GW.getSpacedPoints(240);
export function greenhouseWaterDist(x, z) {
  let best = Infinity;
  for (let i = 0; i + 1 < GW_PTS.length; i++) {
    const a = GW_PTS[i], b = GW_PTS[i + 1], ex = b.x - a.x, ez = b.z - a.z, L = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L));
    best = Math.min(best, Math.hypot(x - a.x - ex * t, z - a.z - ez * t));
  }
  return best;
}

/** `cover(x, z)`: where a slab goes over it instead (the seed row's beds it passes under). */
export function buildGreenhouseWater(scene, terrain, { cover = () => false } = {}) {
  const H = (x, z) => terrain.heightAt(x, z);
  const n = Math.round(GW.getLength() / 1.5);
  const pts = GW.getSpacedPoints(n);
  const nrm = pts.map((_, i) => { const t = GW.getTangentAt(i / n); return V(-t.z, 0, t.x).normalize(); });
  const curb = [], water = [], slabs = [];
  const quad = (out, a, b, c, d) => out.push(...a, ...b, ...c, ...b, ...d, ...c);
  const at = (p, nv, off, dy) => { const x = p.x + nv.x * off, z = p.z + nv.z * off; return [x, H(x, z) + dy, z]; };
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[i + 1], np = nrm[i], nq = nrm[i + 1];
    if (cover(p.x, p.z) || cover(q.x, q.z)) { slabs.push(i); continue; }
    for (const side of [-1, 1]) {
      const i0 = side * 0.5, o0 = side * 0.85;
      const [aI, aO, bI, bO] = [at(p, np, i0, 0.26), at(p, np, o0, 0.26), at(q, nq, i0, 0.26), at(q, nq, o0, 0.26)];
      const [aIl, aOl, bIl, bOl] = [at(p, np, i0, -0.35), at(p, np, o0, -0.35), at(q, nq, i0, -0.35), at(q, nq, o0, -0.35)];
      if (side > 0) { quad(curb, aI, bI, aO, bO); quad(curb, aIl, bIl, aI, bI); quad(curb, aO, bO, aOl, bOl); }
      else { quad(curb, aO, bO, aI, bI); quad(curb, aI, bI, aIl, bIl); quad(curb, aOl, bOl, aO, bO); }
    }
    quad(water, at(p, np, 0.52, 0.06), at(q, nq, 0.52, 0.06), at(p, np, -0.52, 0.06), at(q, nq, -0.52, 0.06));
  }
  const flat = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k); g.computeVertexNormals(); return g; };
  const parts = [];
  // a slab over it where it passes under the seed row (a flat white stone, as high as its kerbs)
  for (const i of slabs) {
    const p = pts[i], t = GW.getTangentAt(i / n);
    parts.push(new THREE.BoxGeometry(2.2, 0.3, 1.6).translate(0, 0.11, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(t.x, t.z)).setPosition(p.x, H(p.x, p.z), p.z)));
  }
  // the basin at the stair's foot it starts from: a round stone bowl, a wide rim to sit on
  const [bx, bz] = GREENHOUSE_WATER[0], by = H(bx, bz);
  parts.push(new THREE.CylinderGeometry(2.6, 2.3, 0.8, 18, 1, true).translate(bx, by + 0.1, bz), new THREE.RingGeometry(2.1, 2.65, 18).rotateX(-Math.PI / 2).translate(bx, by + 0.5, bz));
  const geo = (list) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list, 3)); g.computeVertexNormals(); return g; };
  const curbs = new THREE.Mesh(mergeGeometries([geo(curb), ...parts.map(flat)]), makeMaterial({ color: '#efe9dc', flat: true }));
  curbs.name = 'The Greenhouse water';
  scene.add(curbs);   // (collides as drawn: you step over its kerbs, as the runnel's)
  const wm = makeMaterial({ color: '#7fc4d0', color2: '#9ad3d9', mode: MODE_WATER });
  const stream = new THREE.Mesh(geo(water), wm);
  stream.userData.noCollide = true; stream.userData.water = true;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.15, 18).rotateX(-Math.PI / 2).translate(bx, by + 0.3, bz), wm);
  pool.userData.noCollide = true; pool.userData.water = true;
  scene.add(stream, pool);
  return { points: GREENHOUSE_WATER.map(([x, z]) => [x, H(x, z) + 0.3, z]), basin: V(bx, by, bz), slabs: slabs.length };
}
