import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';
import { createNoise2D } from './noise.js';

// The silent canyons (issue #187, the author's pick "silent-canyons": references/levels/Vael/environment/explorations/):
// the riders' old road, sunk below the plain. From beside the riders' shrine it goes down worn steps between walls
// that grow as it sinks, under the sundial's face (src/vael-sundial.js), and runs on in a narrow cleft to the lone
// tower's foot, where the tower rises straight up out of a round pit (CLEFT). Great ears are carved in the
// cleft's walls (whisper into one and the whisper runs on ahead of you, round the bends to the tower: echo), niches
// with little seated figures, and the riders' streamers strung across overhead.
//
// The ground is cut (ridersCut, applied in src/levels/arzach.js height before the terrain is made): within BED + WR
// of the road's line it is the road's bed (cut down), likewise the pit round the tower.
// The walls are drawn and collided as meshes (buildRidersRoad): a sheer face of red rock at BED from the bed up to the
// plain, and over the cut behind it a cap in the ground's own look, laid on the plain as it was (`uncut`) out past
// where the ground's own triangles climb back up to it, so the ground's coarse grid never shows in the walls.
// In world coordinates; no rng.
//
//   ridersCut(x, z, h)              → the ground at (x, z) with the road and the pit cut into it (h: the ground before)
//   roadAt(s) / ROAD_LENGTH         → { x, z, floor, tx, tz } along the road's line (s in metres from its head)
//   inRoad(x, z, r = 0)             → does a thing of radius r at (x, z) stand in the road, its walls, its cap or the pit?
//   buildRidersRoad(scene, terrain, { uncut }) → { head, steps, ears: [{ at, look, stand, s, side }], niches, line,
//                                                   echo(i), update(dt), running(), meshes }

/** The road's line, [x, z, floor]: from the plain beside the riders' shrine, down under the sundial's face, to the pit. */
export const ROAD_POINTS = [[-70, -1361, 53.4], [-66, -1377, 50], [-56, -1391, 46], [-40, -1398, 41.5], [-24, -1402, 37], [-12, -1412, 33.5],
  [-8, -1428, 31.5], [0, -1444, 30.6], [16, -1452, 30], [32, -1458, 29.6], [44, -1470, 29.2], [54, -1484, 28.8]];
/** Half the road's bed (to the foot of its walls); how far the cut goes on behind the walls; the cap past that (m). */
export const BED = 6, WR = 7, CAP = 12;
/** The pit at the tower's foot: its middle, the radius of its floor (to its walls), the floor's height. */
export const CLEFT = { x: 70, z: -1500, R: 30, floor: 28.5 };
/** Where along the road (m) the worn steps go down. */
export const STEPS = [3, 76];

const curve = new THREE.CatmullRomCurve3(ROAD_POINTS.map(([x, z, f]) => new THREE.Vector3(x, f, z)), false, 'centripetal');
export const ROAD_LENGTH = curve.getLength();
// (the line sampled every 2 m: the cut asks it for every vertex of the ground)
const N = Math.ceil(ROAD_LENGTH / 2);
const P = curve.getSpacedPoints(N);
const REACH = 3 + WR + CAP + 4;
const BOX = (() => { const xs = P.map((p) => p.x), zs = P.map((p) => p.z), m = BED + REACH; return { x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, z0: Math.min(...zs) - m, z1: Math.max(...zs) + m }; })();
const nW = createNoise2D(1871);
/** How wide the bed is along the road (its walls not ruled straight): BED, give or take 1.3 m. */
export const bedAt = (s) => BED + nW(s * 0.035, 0.5) * 1.3;

/** The nearest point of the road's line to (x, z): { d, s, floor }. */
function nearest(x, z) {
  let best = { d: Infinity, s: 0, floor: 0 };
  for (let i = 0; i < N; i++) {
    const a = P[i], b = P[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (d < best.d) best = { d, s: (i + t) * (ROAD_LENGTH / N), floor: a.y + (b.y - a.y) * t };
  }
  return best;
}

export function ridersCut(x, z, h) {
  let out = null;
  if (x > BOX.x0 && x < BOX.x1 && z > BOX.z0 && z < BOX.z1) {
    const { d, s, floor } = nearest(x, z);
    if (d < bedAt(s) + WR) out = floor;
  }
  if (Math.hypot(x - CLEFT.x, z - CLEFT.z) < CLEFT.R + WR) out = out == null ? CLEFT.floor : Math.min(out, CLEFT.floor);
  return out ?? h;
}

/** Does a thing of radius r at (x, z) stand in the road, its walls and cap, or the pit (with a margin)? */
export function inRoad(x, z, r = 0) {
  if (Math.hypot(x - CLEFT.x, z - CLEFT.z) < CLEFT.R + REACH + r) return true;
  if (x < BOX.x0 - r || x > BOX.x1 + r || z < BOX.z0 - r || z > BOX.z1 + r) return false;
  const { d, s } = nearest(x, z);
  return d < bedAt(s) + REACH + r;
}

/** A point along the road (s in metres from its head): its place, the bed's height there and the way on. */
export function roadAt(s) {
  const u = THREE.MathUtils.clamp(s / ROAD_LENGTH, 0, 1), p = curve.getPointAt(u), t = curve.getTangentAt(u);
  const l = Math.hypot(t.x, t.z) || 1;
  return { x: p.x, z: p.z, floor: p.y, tx: t.x / l, tz: t.z / l };
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat0 = (g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); return g; };

/** The ears in the cleft's walls: along the road (m), which wall (+1 the left going down, -1 the right). */
export const EARS = [{ s: 118, side: 1 }, { s: 146, side: -1 }, { s: 170, side: 1 }];
/** The niches, each with a little seated figure and its pebbles: along the road (m), which wall. */
export const NICHES = [{ s: 44, side: -1 }, { s: 60, side: 1 }, { s: 110, side: -1 }, { s: 132, side: 1 }, { s: 158, side: -1 }];
/** The streamers strung across: along the road (m), how high over the bed. */
export const STREAMERS = [{ s: 56, up: 8 }, { s: 114, up: 10 }, { s: 140, up: 11 }, { s: 164, up: 11 }];

/** An ear carved in the rock, about 7 m tall, facing +z out of the wall: the pinna, its hollow, the rim, the fold, the lobe. */
function earGeometry() {
  const T = (pts, r, n = 40) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => V(...q))), n, r, 7);
  const pale = [
    new THREE.CylinderGeometry(1, 1, 1.6, 24).rotateX(Math.PI / 2).scale(2.25, 3.2, 1).translate(0.15, 0.2, -0.2),   // the pinna, a plate proud of the wall
    T([[-0.9, -1.0, 0.75], [-1.75, 0.4, 0.75], [-1.55, 2.3, 0.8], [-0.2, 3.35, 0.85], [1.4, 2.9, 0.8], [2.25, 1.2, 0.75], [2.05, -1.0, 0.7], [1.2, -2.4, 0.65]], 0.5),   // the rim (helix)
    T([[-0.65, 2.0, 0.85], [0.6, 1.9, 0.9], [1.3, 0.9, 0.85], [1.15, -0.5, 0.8]], 0.32, 18),   // the fold inside (antihelix)
    new THREE.SphereGeometry(0.5, 10, 8).scale(0.9, 1.2, 0.8).translate(-1.15, -0.85, 0.85),   // the tragus
    new THREE.SphereGeometry(1, 12, 10).scale(1.15, 1.25, 0.55).translate(0.55, -2.95, 0.45),   // the lobe
  ].map(flat0);
  const hollow = [new THREE.CylinderGeometry(1, 1, 0.1, 20).rotateX(Math.PI / 2).scale(1.05, 1.45, 1).translate(0.0, -0.15, 0.62)].map(flat0);
  return { pale, hollow };
}

/**
 * The road's walls and dressing, on the ground as it is built (terrain: the level's, the cut in it; uncut(x, z): the
 * plain as it lay before the cut): the walls and their caps, the worn steps, the ears, the niches,
 * the streamers, and the whisper's ripples (echo).
 */
export function buildRidersRoad(scene, terrain, { uncut = (x, z) => terrain.heightAt(x, z) } = {}) {
  const H = (x, z) => terrain.heightAt(x, z);
  const top = (x, z) => Math.max(H(x, z), uncut(x, z));   // (the plain the cap is laid on, as it was)
  // (issue #691: the worn steps in the picked pale stone, src/surface-marks.js paleStone; the red walls keep their ledged
  // bands, with the weathered walls' hairline cracks over them: rock, not masonry)
  const stone = makeMaterial({ color: '#efe4cf', color2: '#e2cfae', color3: '#d8c7a8', flat: true, paleStone: { course: 0.8, block: 1.7, foot: -1000, wear: 0.9 } });
  const pale = makeMaterial({ color: '#f4efe2', color2: '#e6dcc6', color3: '#d6c7a8', mode: MODE_STRATA, strataSize: 1.2, flat: true });
  const red = makeMaterial({ color: '#c7735a', color2: '#d98a6c', color3: '#a65a46', mode: MODE_STRATA, strataSize: 2.2, flat: true, weathered: 0.8 });
  const capMat = makeMaterial({ ...terrain.materialOptions, drift: true });
  const dark = makeMaterial({ color: '#4a2f2c', flat: true });
  const iron = makeMaterial({ color: '#3c4660', flat: true });
  const cloths = ['#7fb8b0', '#e8c0aa', '#f4efe2', '#d99a86', '#a9c4d6'].map((c) => makeMaterial({ color: c, flat: true, side: THREE.DoubleSide }));
  const across = (r) => V(-r.tz, 0, r.tx);   // (to the left of the way down)
  const nR = createNoise2D(4127);

  // ---- the walls: a ribbon each side, row by row along the road (and round the pit): a sheer face of red rock from
  // under the bed up to the plain, banded in ledges, and a cap from its lip out over the cut to the plain beyond
  const faces = [], caps = [];
  const OUT = [0.6, 2, 4.5, 8, 12, 16, WR + CAP];   // (the cap's points, out from the lip)
  const ribbon = (rows, flip) => {
    // rows: [{ x, z, nx, nz, floor, bed }] in order; the face from floor - 1.6 to the lip (K bands), then the cap
    const K = 6, F = [], C = [], fi = [], ci = [], kf = K + 1, kc = OUT.length + 1;
    rows.forEach((w, i) => {
      const lipX = w.x + w.nx * w.bed, lipZ = w.z + w.nz * w.bed, lip = Math.max(top(lipX, lipZ), w.floor) + 0.12;
      for (let k = 0; k <= K; k++) {
        const t = k / K, y = w.floor - 1.6 + (lip - w.floor + 1.6) * t;
        // (ledges: every band steps back a little as it climbs, and the rock's face wanders)
        const d = w.bed + (k > 0 && k < K ? 0.3 * (k % 2) + 0.4 * nR(w.s * 0.11 + k * 0.7, w.side * 3.1) : 0) + (k === K ? 0.15 : 0);
        F.push(w.x + w.nx * d, y, w.z + w.nz * d);
      }
      C.push(lipX + w.nx * 0.15, lip, lipZ + w.nz * 0.15);
      for (const o of OUT) { const x = lipX + w.nx * (0.15 + o), z = lipZ + w.nz * (0.15 + o); C.push(x, top(x, z) + 0.12, z); }
      if (!i) return;
      for (let k = 0; k < K; k++) { const a = (i - 1) * kf + k, b = a + 1, c = i * kf + k, d = c + 1; if (flip) fi.push(a, b, c, b, d, c); else fi.push(a, c, b, b, c, d); }
      for (let k = 0; k < kc - 1; k++) { const a = (i - 1) * kc + k, b = a + 1, c = i * kc + k, d = c + 1; if (flip) ci.push(a, b, c, b, d, c); else ci.push(a, c, b, b, c, d); }
    });
    const mk = (pos, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return flat0(g); };
    if (rows.length > 1) { faces.push(mk(F, fi)); caps.push(mk(C, ci)); }
  };
  const inPit = (x, z, m = 0) => Math.hypot(x - CLEFT.x, z - CLEFT.z) < CLEFT.R + m;
  for (const side of [1, -1]) {
    let rows = [];
    for (let s = 0; s <= ROAD_LENGTH + 0.01; s += 2) {
      const r = roadAt(s), n = across(r).multiplyScalar(side), bed = bedAt(s);
      const wx = r.x + n.x * bed, wz = r.z + n.z * bed;
      if (inPit(wx, wz, -1.5)) { if (rows.length) { rows.push({ x: r.x, z: r.z, nx: n.x, nz: n.z, floor: r.floor, bed, s, side }); ribbon(rows, side > 0); rows = []; } continue; }
      // (at the road's head, where it has hardly sunk, no wall: the ground's own slope)
      if (top(wx, wz) - r.floor < 1.0) { if (rows.length > 1) ribbon(rows, side > 0); rows = []; continue; }
      rows.push({ x: r.x, z: r.z, nx: n.x, nz: n.z, floor: r.floor, bed, s, side });
    }
    ribbon(rows, side > 0);
  }
  // round the pit: its wall, but where the road comes in
  {
    let rows = [];
    const n = 72;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, nx = Math.sin(a), nz = Math.cos(a), x = CLEFT.x + nx * CLEFT.R, z = CLEFT.z + nz * CLEFT.R;
      const { d, s } = nearest(x, z);
      if (d < bedAt(s) - 1) { if (rows.length) { ribbon(rows, true); rows = []; } continue; }
      rows.push({ x: CLEFT.x, z: CLEFT.z, nx, nz, floor: CLEFT.floor, bed: CLEFT.R, s: i * 2.6, side: 2 });
    }
    ribbon(rows, true);
  }
  const wallMesh = new THREE.Mesh(mergeGeometries(faces), red);
  wallMesh.name = 'The riders’ road: its walls';
  const capMesh = new THREE.Mesh(mergeGeometries(caps), capMat);
  capMesh.name = 'The riders’ road: the plain over its walls';
  scene.add(wallMesh, capMesh);

  /** The wall beside the road at s (side +1 left, -1 right), `up` over the bed: its face, the way out of it. */
  const wallAt = (s, side, up, out = 0) => {
    const r = roadAt(s), n = across(r).multiplyScalar(side), d = bedAt(s) - out;
    return { p: V(r.x + n.x * d, r.floor + up, r.z + n.z * d), n, r };
  };

  // ---- the worn steps down from the plain: a stone tread every 1.6 m across the middle of the bed, each laid level at
  // the height of the ground under its upper edge, so it stands a riser proud of the slope below it
  const steps = [], treads = [];
  for (let s = STEPS[0]; s < STEPS[1]; s += 1.6) {
    const r = roadAt(s), yaw = Math.atan2(r.tx, r.tz), half = 3.2 + 0.5 * Math.sin(s * 0.7);
    let y = -Infinity;
    for (const [u, v] of [[-half, 0.8], [half, 0.8], [-half, -0.8], [half, -0.8], [0, 0.8], [0, 0]]) y = Math.max(y, H(r.x + r.tz * u + r.tx * v, r.z - r.tx * u + r.tz * v));
    y += 0.06;
    treads.push(flat0(new THREE.BoxGeometry(half * 2, 1.4, 1.6).translate(0, y - 0.7, 0).rotateY(yaw).translate(r.x, 0, r.z)));
    steps.push(V(r.x, y, r.z));
  }
  const stepMesh = new THREE.Mesh(mergeGeometries(treads), stone);
  stepMesh.name = 'The riders’ road: the worn steps';
  scene.add(stepMesh);

  // ---- the ears: carved into the cleft's walls, turned to the road, a lip of pebbles under each
  const earGeo = earGeometry(), ears = [], earParts = [], earHollow = [], pebbles = [];
  for (const { s, side } of EARS) {
    const w = wallAt(s, side, 4.6, 0.25), yaw = Math.atan2(-w.n.x, -w.n.z);
    const F = new THREE.Matrix4().compose(w.p, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
    for (const g of earGeo.pale) earParts.push(g.clone().applyMatrix4(F));
    for (const g of earGeo.hollow) earHollow.push(g.clone().applyMatrix4(F));
    // the lip: a shelf of stone under the ear, an offering of pebbles on it
    const lip = V(0.2, -4.25, 0.9).applyMatrix4(F);
    earParts.push(flat0(new THREE.BoxGeometry(3.2, 0.5, 1.6).rotateY(yaw).translate(lip.x, lip.y, lip.z)));
    for (let k = 0; k < 7; k++) { const q = V(-1.0 + k * 0.33, -3.86, 1.0 + (k % 2) * 0.3).applyMatrix4(F); pebbles.push(flat0(new THREE.IcosahedronGeometry(0.16 + (k % 3) * 0.04, 0).translate(q.x, q.y, q.z))); }
    const front = w.p.clone().addScaledVector(w.n, -2.8); front.y = H(front.x, front.z);
    ears.push({ s, side, at: V(0, 0, 0.6).applyMatrix4(F), look: V(0, 0, 0.8).applyMatrix4(F), stand: front });
  }
  const earMesh = new THREE.Mesh(mergeGeometries(earParts), pale);
  earMesh.name = 'The riders’ road: the stone ears';
  const earDark = new THREE.Mesh(mergeGeometries(earHollow), makeMaterial({ color: '#a89a8a', flat: true }));
  earDark.userData.noCollide = true;
  const pebbleMesh = new THREE.Mesh(mergeGeometries(pebbles), makeMaterial({ color: '#8fb0a4', flat: true }));
  pebbleMesh.name = 'The riders’ road: the ears’ pebbles';   // (solid, on the lip you can stand on)
  scene.add(earMesh, earDark, pebbleMesh);

  // ---- the niches: an arched frame low in the wall, dark behind, a little seated figure of pale stone in it
  const niches = [], nicheSolid = [], nicheDark = [];
  for (const { s, side } of NICHES) {
    const w = wallAt(s, side, 1.9, 0.1), yaw = Math.atan2(-w.n.x, -w.n.z);
    const F = new THREE.Matrix4().compose(w.p, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
    const frame = [new THREE.BoxGeometry(2.6, 0.4, 1.4).translate(0, -1.3, 0.4), new THREE.BoxGeometry(0.4, 2.6, 0.8).translate(-1.1, 0, 0.3), new THREE.BoxGeometry(0.4, 2.6, 0.8).translate(1.1, 0, 0.3),
      new THREE.TorusGeometry(1.1, 0.22, 5, 10, Math.PI).scale(1, 0.8, 2).translate(0, 1.3, 0.3)];
    const figure = [new THREE.SphereGeometry(0.42, 10, 8).scale(1, 0.7, 0.8).translate(0, -0.8, 0.3), new THREE.CapsuleGeometry(0.26, 0.4, 3, 8).translate(0, -0.35, 0.25), new THREE.SphereGeometry(0.18, 8, 6).translate(0, 0.15, 0.25)];
    for (const g of [...frame, ...figure]) nicheSolid.push(flat0(g).applyMatrix4(F));
    nicheDark.push(flat0(new THREE.PlaneGeometry(1.8, 2.5).translate(0, 0.05, 0.08)).applyMatrix4(F));
    niches.push({ s, side, at: V(0, -0.4, 0.4).applyMatrix4(F) });
  }
  const nicheMesh = new THREE.Mesh(mergeGeometries(nicheSolid), pale);
  nicheMesh.name = 'The riders’ road: the niches';
  const nicheBack = new THREE.Mesh(mergeGeometries(nicheDark), dark);
  nicheBack.userData.noCollide = true;
  scene.add(nicheMesh, nicheBack);

  // ---- the streamers: a cord from wall to wall overhead, faded pennants hung along it
  const cords = [], flags = cloths.map(() => []), tails = [];
  for (const { s, up } of STREAMERS) {
    const a = wallAt(s, 1, up, 0.1).p, b = wallAt(s + 1.5, -1, up + 0.6, 0.1).p, L = a.distanceTo(b), mid = a.clone().lerp(b, 0.5);
    const sag = new THREE.QuadraticBezierCurve3(a, mid.clone().add(V(0, -L * 0.1, 0)), b);
    cords.push(flat0(new THREE.TubeGeometry(sag, 16, 0.04, 4)));
    const k = Math.max(4, Math.floor(L / 1.3));
    for (let i = 1; i < k; i++) {
      const p = sag.getPoint(i / k), tri = new THREE.BufferGeometry().setFromPoints([V(-0.3, 0, 0), V(0.3, 0, 0), V(0, -0.85 - (i % 3) * 0.2, 0)]);
      tri.computeVertexNormals();
      tri.rotateY(Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2).translate(p.x, p.y, p.z);
      flags[(i + Math.round(s)) % cloths.length].push(tri);
    }
  }
  const cordMesh = new THREE.Mesh(mergeGeometries(cords), iron);
  cordMesh.userData.noCollide = true;
  scene.add(cordMesh);
  flags.forEach((list, i) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list), cloths[i]); m.userData.noCollide = true; m.name = 'The riders’ road: the streamers'; tails.push(m); scene.add(m); });

  // ---- the whisper: rings that run on down the road from an ear, round the bends to the tower, and fade
  const ringMat = makeMaterial({ color: '#fbf8f0', flat: true, glow: 0.55 });
  const ringGeo = new THREE.TorusGeometry(1, 0.05, 3, 24, Math.PI);
  const ripples = Array.from({ length: 7 }, () => { const m = new THREE.Mesh(ringGeo, ringMat); m.visible = false; m.userData.noCollide = true; m.name = 'The whisper'; scene.add(m); return { m }; });
  let runs = [];
  /** Whisper into ear i: the whisper runs on from it toward the tower. */
  const echo = (i = 0) => { const e = ears[i] ?? ears[0]; runs = ripples.map((r, k) => ({ r, s: e.s - k * 3.2, end: ROAD_LENGTH + 18 })); return runs.length; };
  const end = roadAt(ROAD_LENGTH);
  const update = (dt) => {
    for (const run of runs) {
      run.s += dt * 24;
      const { r } = run, live = run.s > 0 && run.s < run.end;
      r.m.visible = live;
      if (!live) continue;
      const on = run.s <= ROAD_LENGTH, p = on ? roadAt(run.s) : { ...end, x: end.x + end.tx * (run.s - ROAD_LENGTH), z: end.z + end.tz * (run.s - ROAD_LENGTH), floor: CLEFT.floor };
      const size = (BED - 1) * (0.55 + 0.45 * (run.s / run.end));
      r.m.position.set(p.x, p.floor + 0.3, p.z);
      r.m.rotation.set(0, Math.atan2(p.tx, p.tz) + Math.PI / 2, 0);
      r.m.scale.set(size, size * 0.8, size);
    }
    if (runs.length && runs.every((u) => u.s >= u.end)) { for (const u of runs) u.r.m.visible = false; runs = []; }
  };
  const line = [];
  for (let s = 0; s <= ROAD_LENGTH; s += 12) { const r = roadAt(s); line.push([r.x, H(r.x, r.z), r.z]); }
  const head = roadAt(0);
  return { head: V(head.x, H(head.x, head.z), head.z), steps, ears, niches, line, echo, update, running: () => runs.length > 0,
    meshes: { walls: wallMesh, caps: capMesh, steps: stepMesh, ears: earMesh, niches: nicheMesh, streamers: tails } };
}
