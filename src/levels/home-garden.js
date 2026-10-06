import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { seeded, merge, put, paint, cyl, cone, ball, ell, box, disc, tube, leaf, ribbed, lathe } from '../flora-kit.js';

// Lou and Tove's little garden in the front yard at home (src/levels/home.js),
// between the path and the small house: three raised beds (cabbages and
// lettuces; carrots and a bean teepee; squashes), a border of flowers along the
// fence, stepping stones from the gate, a bench, a watering can, a low picket
// fence with two gates. Drawn with the flora's kit (src/flora-kit.js), in the
// same flat colours and ink, and bending in the same wind (sway).
//
// The flowers can be picked (pick()): one stem at a time, for the parents'
// stone (src/story/home.js lays them there). They are back the next visit.

export const GARDEN = { x0: 3.5, x1: 13, z0: 12.5, z1: 23 };
/** The flowers that grow in the border, and the colour of their heads. */
export const FLOWERS = [
  { id: 'marigold', name: 'a marigold', color: '#e8873a', centre: '#9c5a1a' },
  { id: 'daisy', name: 'a daisy', color: '#f7f4ec', centre: '#f2c54b' },
  { id: 'poppy', name: 'a poppy', color: '#d9463a', centre: '#2b211f' },
  { id: 'bell', name: 'a lilac bell', color: '#b9a3c9', centre: '#f7f4ec' },
  { id: 'sun', name: 'a little sunflower', color: '#f2c54b', centre: '#6e4a32' },
];

const STEM = '#4f7b3a', LEAF = '#5f9a4a', LEAF2 = '#7fb069', SOIL = '#7a5440', BOARD = '#9a6a48';

/** One flower standing on y = 0, about h tall (its head at the top). */
export function flowerGeometry(kind, h = 0.62, seed = 1) {
  const f = FLOWERS.find((x) => x.id === kind) ?? FLOWERS[0], rnd = seeded(`${kind}${seed}`);
  const lean = (rnd() - 0.5) * 0.25, top = [Math.sin(lean) * h * 0.3, h, 0];
  const parts = [tube([[0, 0, 0], [top[0] * 0.4, h * 0.5, 0.02], top], 0.014, 0.01, STEM, 4, 5)];
  parts.push(leaf(0.16, 0.06, 0.012, LEAF, { up: 0.5, yaw: rnd() * 6, droop: 0.3, at: [0, h * 0.25, 0] }), leaf(0.13, 0.05, 0.012, LEAF2, { up: 0.6, yaw: rnd() * 6, droop: 0.3, at: [0, h * 0.45, 0] }));
  if (kind === 'bell') {
    for (let k = 0; k < 3; k++) parts.push(lathe([[0.001, 0], [0.035, 0.01], [0.045, 0.05], [0.03, 0.07]], f.color, 7, [top[0] + 0.03 * Math.cos(k * 2.1), h - 0.06 - k * 0.07, 0.03 * Math.sin(k * 2.1)], [Math.PI, 0, 0]));
  } else {
    const n = kind === 'daisy' ? 10 : kind === 'sun' ? 12 : 6, r = kind === 'sun' ? 0.08 : kind === 'poppy' ? 0.07 : 0.06;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      parts.push(put(paint(new THREE.SphereGeometry(1, 5, 3).scale(r * 0.42, 0.008, r * (kind === 'poppy' ? 0.5 : 0.28)).translate(0, 0, r * 0.62), f.color), top, [-0.25, a, 0]));
    }
    parts.push(ball(r * 0.36, f.centre, [top[0], h + 0.01, 0]));
  }
  return merge(parts);
}

const cabbage = (x, z, s) => merge([
  ...Array.from({ length: 7 }, (_, k) => leaf(0.28 * s, 0.22 * s, 0.03, k % 2 ? LEAF : '#4f8a5a', { up: 0.35, yaw: k * 0.9, droop: 0.25, at: [x, 0.02, z] })),
  ball(0.13 * s, '#8fc07a', [x, 0.12 * s, z], 1, [1, 0.85, 1]),
]);
const carrotTop = (x, z) => merge(Array.from({ length: 5 }, (_, k) => tube([[x, 0, z], [x + Math.cos(k * 1.3) * 0.05, 0.16, z + Math.sin(k * 1.3) * 0.05], [x + Math.cos(k * 1.3) * 0.12, 0.26, z + Math.sin(k * 1.3) * 0.12]], 0.012, 0.006, '#6fae4a', 3, 4))
  .concat([cone(0.03, 0.05, '#e8873a', 6, [x, -0.02, z])]));
const squash = (x, z, s, col) => merge([
  ribbed([[0.02, 0], [0.2 * s, 0.05 * s], [0.26 * s, 0.14 * s], [0.18 * s, 0.24 * s], [0.03, 0.27 * s]], 8, 0.08, col, 16, [x, 0, z]),
  cyl(0.02, 0.015, 0.06, '#6e4a32', 5, [x, 0.26 * s, z]),
  leaf(0.34, 0.3, 0.02, LEAF, { up: 0.1, yaw: s * 3, droop: 0.2, at: [x + 0.15, 0.02, z] }),
]);

/**
 * The garden.
 * @returns { group, flowers: [{ at, kind, picked, geometry, im, index }], pick(p): flower | null, regrow(), spots: { bench, can, gateW, gateN, border }, avoid(x, z, r) }
 */
export function buildGarden(scene, { ground = () => 0 } = {}) {
  const G = GARDEN;
  const root = new THREE.Group();
  root.name = 'garden';
  scene.add(root);
  const solid = [], soft = [], ink = makeMaterial({ color: '#2b211f', flat: true });
  const paintBox = (w, h, d, col, x, y, z, ry = 0) => put(paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), col), [x, y, z], [0, ry, 0]);
  const gy = (x, z) => ground(x, z);

  // ---------------------------------------------------------------- the fence: pickets and two rails, two gates
  const GATE_W = [20.0, 21.4], GATE_N = [11.2, 12.6];   // the west gate (along z), the north gate (along x)
  const pickets = (ax, az, bx, bz, gap) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.36), ry = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, along = az === bz ? x : z;
      if (gap && along > gap[0] && along < gap[1]) continue;
      const y = gy(x, z);
      // (flat side to the path: wide along the fence, thin across it)
      solid.push(paintBox(0.035, 0.74, 0.1, i % 2 ? '#f6efe0' : '#efe4cc', x, y, z, ry));
      solid.push(put(paint(new THREE.ConeGeometry(0.07, 0.09, 4).translate(0, 0.045, 0).scale(0.35, 1, 1), '#f6efe0'), [x, y + 0.74, z], [0, ry, 0]));
    }
    // the rails, broken at the gate
    const spans = gap ? [[0, (gap[0] - (az === bz ? ax : az)) / ((az === bz ? bx - ax : bz - az) || 1)], [(gap[1] - (az === bz ? ax : az)) / ((az === bz ? bx - ax : bz - az) || 1), 1]] : [[0, 1]];
    for (const [t0, t1] of spans) {
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const l = Math.hypot(x1 - x0, z1 - z0);
      if (l < 0.05) continue;
      for (const h of [0.3, 0.6]) solid.push(paintBox(0.04, 0.05, l, '#5fb7ad', (x0 + x1) / 2, gy((x0 + x1) / 2, (z0 + z1) / 2) + h, (z0 + z1) / 2, ry));
    }
  };
  pickets(G.x0, G.z0, G.x1, G.z0);                 // front
  pickets(G.x1, G.z0, G.x1, G.z1);                 // east
  pickets(G.x0, G.z1, G.x1, G.z1, GATE_N);         // north, the gate to the small house
  pickets(G.x0, G.z0, G.x0, G.z1, GATE_W);         // west, the gate from the path
  // the gate leaves, standing open
  for (const [x, z, ry] of [[G.x0 - 0.1, GATE_W[0] + 0.05, -1.2], [G.x0 - 0.1, GATE_W[1] - 0.05, -1.9]]) {
    const g = merge([paintBox(0.66, 0.05, 0.04, '#5fb7ad', 0.33, 0.25, 0), paintBox(0.66, 0.05, 0.04, '#5fb7ad', 0.33, 0.6, 0),
      ...Array.from({ length: 3 }, (_, k) => paintBox(0.06, 0.72, 0.03, '#f3ead8', 0.1 + k * 0.22, 0, 0))]);
    soft.push(put(g, [x, gy(x, z), z], [0, ry, 0]));
  }

  // ---------------------------------------------------------------- the raised beds
  const BEDS = [{ x0: 5.0, x1: 10.0, z: 14.15 }, { x0: 5.0, x1: 10.0, z: 16.45 }, { x0: 5.0, x1: 10.0, z: 18.75 }];
  const BED_D = 1.3, BED_H = 0.32;
  const crops = [];
  BEDS.forEach((b, i) => {
    const cx = (b.x0 + b.x1) / 2, w = b.x1 - b.x0, y = gy(cx, b.z);
    for (const s of [-1, 1]) solid.push(paintBox(w, BED_H, 0.08, BOARD, cx, y, b.z + s * (BED_D / 2 - 0.04)));
    for (const s of [-1, 1]) solid.push(paintBox(0.08, BED_H, BED_D, BOARD, cx + s * (w / 2 - 0.04), y, b.z));
    solid.push(paintBox(w - 0.1, BED_H - 0.04, BED_D - 0.1, SOIL, cx, y, b.z));
    const top = y + BED_H - 0.04, rnd = seeded(`bed${i}`);
    if (i === 0) for (let k = 0; k < 7; k++) crops.push(put(cabbage(0, 0, 0.9 + rnd() * 0.4), [b.x0 + 0.45 + k * 0.68, top, b.z + (k % 2 ? 0.25 : -0.25)]));
    if (i === 1) {
      for (let k = 0; k < 12; k++) crops.push(put(carrotTop(0, 0), [b.x0 + 0.35 + k * 0.3, top, b.z + (k % 2 ? 0.28 : -0.05)]));
      // the bean teepee at the bed's end: three canes and the vine climbing them
      const tx = b.x1 - 0.55, tz = b.z;
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1, foot = [tx + Math.cos(a) * 0.42, top, tz + Math.sin(a) * 0.42];
        crops.push(tube([foot, [tx, top + 1.7, tz]], 0.018, 0.012, '#c9a36a', 4, 2));
        const vine = Array.from({ length: 7 }, (_, j) => { const t = j / 6, r = 0.42 * (1 - t) + 0.03; return [tx + Math.cos(a + t * 2.5) * r, top + t * 1.55, tz + Math.sin(a + t * 2.5) * r]; });
        crops.push(tube(vine, 0.012, 0.008, STEM, 4, 10));
        for (let j = 1; j < 7; j++) crops.push(leaf(0.12, 0.09, 0.01, j % 2 ? LEAF : LEAF2, { up: 0.2, yaw: a + j, droop: 0.3, at: vine[j] }));
        for (let j = 2; j < 6; j += 2) crops.push(cyl(0.008, 0.006, 0.14, '#7fb069', 4, [vine[j][0], vine[j][1] - 0.14, vine[j][2]]));
      }
    }
    if (i === 2) for (let k = 0; k < 5; k++) crops.push(put(squash(0, 0, 0.9 + rnd() * 0.5, k % 2 ? '#e8873a' : '#d8a24a'), [b.x0 + 0.5 + k * 1.0, top, b.z + (k % 2 ? 0.2 : -0.2)]));
  });

  // ---------------------------------------------------------------- the border of flowers, along the north fence (they can be picked)
  const flowers = [];
  const flowerMat = makeMaterial({ color: '#ffffff', vertexColors: true, sway: 0.25 });
  const geos = new Map();
  const geoOf = (kind, v) => { const k = `${kind}${v}`; if (!geos.has(k)) geos.set(k, flowerGeometry(kind, 0.55 + v * 0.1, v)); return geos.get(k); };
  const border = { x0: G.x0 + 0.5, x1: GATE_N[0] - 0.3, z: G.z1 - 0.65 };
  const rb = seeded('border');
  for (let x = border.x0; x < border.x1; x += 0.36) {
    for (const dz of [-0.22, 0.2]) {
      const kind = FLOWERS[Math.floor(rb() * FLOWERS.length)].id, v = Math.floor(rb() * 3);
      const at = new THREE.Vector3(x + (rb() - 0.5) * 0.18, 0, border.z + dz + (rb() - 0.5) * 0.12);
      at.y = gy(at.x, at.z);
      const matrix = new THREE.Matrix4().compose(at, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rb() * 6.28), new THREE.Vector3(1.25, 1.25, 1.25));
      flowers.push({ at, kind, picked: false, key: `${kind}${v}`, geometry: geoOf(kind, v), matrix });
    }
  }
  // one instanced draw per kind of flower; a picked one is scaled to nothing
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const [key, geo] of geos) {
    const mine = flowers.filter((f) => f.key === key);
    const im = new THREE.InstancedMesh(geo, flowerMat, mine.length);
    im.userData.noCollide = true;
    mine.forEach((f, i) => { f.im = im; f.index = i; im.setMatrixAt(i, f.matrix); });
    im.computeBoundingSphere();
    root.add(im);
  }
  const show = (f, on) => { f.im.setMatrixAt(f.index, on ? f.matrix : ZERO); f.im.instanceMatrix.needsUpdate = true; };
  // a little soil edge under them
  soft.push(paintBox(border.x1 - border.x0 + 0.4, 0.04, 0.9, SOIL, (border.x0 + border.x1) / 2, gy(border.x0, border.z) - 0.01, border.z));

  // ---------------------------------------------------------------- stepping stones, a bench, a watering can
  const stones = [[G.x0 - 1.4, 20.7], [G.x0 + 0.3, 20.7], [4.6, 20.4], [5.9, 20.5], [7.2, 20.3], [8.5, 20.5], [9.8, 20.4], [11.0, 20.7], [11.8, 21.6], [12.0, 22.6], [12.2, 23.9], [12.6, 25.2]];
  stones.forEach(([x, z], i) => soft.push(disc(0.36 + (i % 3) * 0.05, 0.08, '#dccab0', 9, [x, gy(x, z) - 0.02, z], [0, i, 0], (a) => 1 + 0.08 * Math.sin(a * 3 + i))));
  const bench = { x: 11.9, z: 16.4, ry: -Math.PI / 2 };   // facing the beds (west)
  {
    const p = [paintBox(1.6, 0.07, 0.45, '#8a5a3c', 0, 0.42, 0), paintBox(1.6, 0.4, 0.06, '#8a5a3c', 0, 0.55, -0.21)];
    for (const s of [-1, 1]) p.push(paintBox(0.08, 0.42, 0.42, '#6e4a36', s * 0.7, 0, 0));
    solid.push(put(merge(p), [bench.x, gy(bench.x, bench.z), bench.z], [0, bench.ry, 0]));
  }
  const can = new THREE.Vector3(12.3, 0, 14.6);
  {
    can.y = gy(can.x, can.z);
    const p = [cyl(0.14, 0.13, 0.26, '#5f8fb8', 12), cyl(0.145, 0.145, 0.02, '#4a6f94', 12, [0, 0.25, 0]),
      tube([[0.1, 0.06, 0], [0.24, 0.2, 0], [0.32, 0.32, 0]], 0.025, 0.018, '#5f8fb8', 6, 4), cyl(0.04, 0.045, 0.04, '#4a6f94', 8, [0.33, 0.31, 0], [0, 0, -0.8]),
      tube([[-0.12, 0.22, 0], [-0.08, 0.38, 0], [0.06, 0.38, 0], [0.1, 0.27, 0]], 0.014, 0.014, '#4a6f94', 4, 8)];
    soft.push(put(merge(p), [can.x, can.y, can.z], [0, 2.2, 0]));
  }

  // ---------------------------------------------------------------- build
  const plantMat = makeMaterial({ color: '#ffffff', vertexColors: true, sway: 0.18 });
  const wood = makeMaterial({ color: '#ffffff', vertexColors: true });
  const fence = new THREE.Mesh(mergeGeometries(solid), wood);
  fence.name = 'garden: fence and beds';
  root.add(fence);
  const soft1 = new THREE.Mesh(mergeGeometries(soft), wood);
  soft1.userData.noCollide = true;   // (stones, the gate leaves, the can: walked over and round)
  root.add(soft1);
  const plants = new THREE.Mesh(mergeGeometries(crops.map((g) => (g.index ? g.toNonIndexed() : g))), plantMat);
  plants.name = 'garden: vegetables';
  plants.userData.noCollide = true;
  plants.userData.flora = true;   // (crops: walked through, like the rest of the flora)
  root.add(plants);
  void ink;

  const V = (x, z, dy = 0) => new THREE.Vector3(x, gy(x, z) + dy, z);
  return {
    group: root, flowers,
    spots: {
      bench: V(bench.x, bench.z), benchHeading: bench.ry, can, gateW: V(G.x0 - 0.6, (GATE_W[0] + GATE_W[1]) / 2), gateN: V((GATE_N[0] + GATE_N[1]) / 2, G.z1 + 0.6),
      border: V((border.x0 + border.x1) / 2, border.z), beds: V(7.5, 16.4), stones: stones.map(([x, z]) => V(x, z)),
    },
    /** The nearest flower still growing within reach of p (m), or null. */
    nearest(p, reach = 1.6) {
      let best = null, bd = reach;
      for (const f of flowers) { if (f.picked) continue; const d = Math.hypot(f.at.x - p.x, f.at.z - p.z); if (d < bd) { bd = d; best = f; } }
      return best;
    },
    /** Pick the nearest flower (it goes from the border): returns it, or null. */
    pick(p, reach = 1.6) {
      const f = this.nearest(p, reach);
      if (!f) return null;
      f.picked = true;
      show(f, false);
      return f;
    },
    regrow() { for (const f of flowers) { f.picked = false; show(f, true); } },
    flowerMaterial: flowerMat,
    /** Inside the garden's fence (for the grass, the flora and the dog's nose). */
    inside: (x, z, r = 0) => x > G.x0 - r && x < G.x1 + r && z > G.z0 - r && z < G.z1 + r,
  };
}
