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
