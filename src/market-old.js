import * as THREE from 'three';
import { kit, tint, rectMinus } from './market-kit.js';
import { Z_GAP } from './temples/kit.js';

// The old market below (issue #191, the author's picked direction C: references/levels/The Signal Market/environment/
// explorations/old-market/). The avenue is a deck over the market's first street: a storey down under the paving from
// Signal Square to the second skybridge, glimpsed through brass grilles in the paving (strips of lattice, and one great
// round grille as on the sheet) whose light falls in stripes on the floor, reached by a stair down out of the square in
// front of the silent tower. Older, fuller stalls under arches between stone pillars, heaps of brass lamps, pots and
// crates; the oldest crossing sign, a long painted board, hangs over the crossing at its north end, where the first
// stall (where an answer was first sold) still opens; from there a passage runs east under the pavement and a stair
// comes up into the alley, into the screen lanes (src/market-lanes.js). The way home from the square (Sel's words).
// No rng. The street over it is solid where you walk (the grilles too: a sheet of collision at the paving's top under
// the drawn bars, so nothing drops through their gaps); everything down here collides as drawn but the small goods.
//
//   OLD, STAIRWELL, TUNNEL, ALLEY_STAIR, GRILLES, ROUND, HOLES (world coordinates)
//   buildOldMarket(scene, M) → { group, line, sights, places, lamps, crowd, holes }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The old street: between its walls' inner faces (±x), from its south wall (z0) to its north wall (z1), its floor's top. */
export const OLD = { x: 12, z0: -214, z1: -100, floor: -6, wall: 1, roof: 0.5 };
/** The stair down out of Signal Square: the opening in the paving over it (|x| < x), going down northward from z0 to z1. */
export const STAIRWELL = { x: 4, z0: -214, z1: -200 };
/** The passage east under the pavement, and the stair up into the alley at its end (rising east). */
export const TUNNEL = { x0: OLD.x, x1: 40, z0: -107.5, z1: -102.5 };
export const ALLEY_STAIR = { x0: 40, x1: 56, z0: -107.5, z1: -102.5 };
/** The grilles in the avenue's paving over it: strips across (their middle z, half width in z), and the great round one. */
export const GRILLES = [-176, -162, -148, -134, -121].map((z) => ({ z, half: 1.2, x: 10 }));
export const ROUND = { x: 0, z: -190, r: 3.4 };
/** Where the avenue's paving is cut for it (src/levels/bazaar.js lays the paving round these): [x0, x1, z0, z1]. */
export const HOLES = [
  [-OLD.x - OLD.wall, OLD.x + OLD.wall, OLD.z0 - OLD.wall, OLD.z1 + OLD.wall],
  [OLD.x + OLD.wall, TUNNEL.x1, TUNNEL.z0 - 1, TUNNEL.z1 + 1],
  [ALLEY_STAIR.x0, ALLEY_STAIR.x1, ALLEY_STAIR.z0 - 1, ALLEY_STAIR.z1 + 1],
];
/** The pillars' spacing along the walls, and the bays of stalls between them. */
const PILLARS = Array.from({ length: 10 }, (_, i) => -206 + i * 10.5);

export function buildOldMarket(scene, M) {
  const K = kit('The old market');
  const F = OLD.floor, top = 0, R = -OLD.roof;
  const W = OLD.x, T = OLD.wall;
  // ---------------------------------------------------------------- the floor, the walls, the roof (the avenue's deck)
  K.slab(-W - T, W + T, F - 0.5, F, OLD.z0 - T, OLD.z1 + T, M.flag);
  K.slab(W + Z_GAP, ALLEY_STAIR.x1, F - 0.5, F, TUNNEL.z0 - 1, TUNNEL.z1 + 1, M.flag);   // (from inside the floor, not on the east wall's face; issue #286)
  // the side walls, the east one open to the passage
  K.slab(-W - T, -W, F - 0.5, R, OLD.z0 - T, OLD.z1 + T, M.stone);
  K.slab(W, W + T, F - 0.5, R, OLD.z0 - T, TUNNEL.z0, M.stone);
  K.slab(W, W + T, F - 0.5, R, TUNNEL.z1, OLD.z1 + T, M.stone);
  K.slab(-W, W, F - 0.5, R, OLD.z0 - T, OLD.z0, M.stone);
  K.slab(-W, W, F - 0.5, R, OLD.z1, OLD.z1 + T, M.stone);
  // the passage's walls and roof, and the alley stair's walls up to the alley's paving
  K.slab(W + T, TUNNEL.x1, F - 0.5, R, TUNNEL.z0 - 1, TUNNEL.z0, M.stone);
  K.slab(W + T, TUNNEL.x1, F - 0.5, R, TUNNEL.z1, TUNNEL.z1 + 1, M.stone);
  K.slab(W + T, TUNNEL.x1, R, top, TUNNEL.z0 - 1, TUNNEL.z1 + 1, M.paving);
  K.slab(ALLEY_STAIR.x0, ALLEY_STAIR.x1, F - 0.5, top, ALLEY_STAIR.z0 - 1, ALLEY_STAIR.z0, M.stone);
  K.slab(ALLEY_STAIR.x0, ALLEY_STAIR.x1, F - 0.5, top, ALLEY_STAIR.z1, ALLEY_STAIR.z1 + 1, M.stone);
  // the roof: the avenue's paving over the old street, open over the stair and the grilles
  const openings = [
    [-STAIRWELL.x, STAIRWELL.x, STAIRWELL.z0, STAIRWELL.z1],
    ...GRILLES.map((g) => [-g.x, g.x, g.z - g.half, g.z + g.half]),
    [ROUND.x - ROUND.r - 0.2, ROUND.x + ROUND.r + 0.2, ROUND.z - ROUND.r - 0.2, ROUND.z + ROUND.r + 0.2],
  ];
  for (const [x0, x1, z0, z1] of rectMinus([-W - T, W + T, OLD.z0 - T, OLD.z1 + T], openings)) K.slab(x0, x1, R, top, z0, z1, M.paving);
  // the grilles: brass bars drawn, a sheet of collision at the paving's top under them (invisible: you see down through)
  const sheet = [];
  for (const g of GRILLES) {
    K.slab(-g.x, g.x, R, top - 0.02, g.z - g.half, g.z - g.half + 0.12, M.brass, false);
    K.slab(-g.x, g.x, R, top - 0.02, g.z + g.half - 0.12, g.z + g.half, M.brass, false);
    for (let x = -g.x + 0.25; x < g.x; x += 0.42) K.slab(x - 0.05, x + 0.05, top - 0.14, top - 0.01, g.z - g.half, g.z + g.half, M.brass, false);
    for (const dz of [-0.6, 0, 0.6]) K.slab(-g.x, g.x, top - 0.3, top - 0.16, g.z + dz - 0.04, g.z + dz + 0.04, M.brass, false);
    sheet.push([-g.x, g.x, g.z - g.half, g.z + g.half]);
  }
  {
    // the round grille: a square plate round a round hole, rings and spokes of brass across it (the sheet's oculus)
    const s = ROUND.r + 0.2, shape = new THREE.Shape([V(-s, -s), V(s, -s), V(s, s), V(-s, s)].map((p) => new THREE.Vector2(p.x, p.y)));
    const hole = new THREE.Path(); hole.absarc(0, 0, ROUND.r, 0, Math.PI * 2, true); shape.holes.push(hole);
    const plate = new THREE.ExtrudeGeometry(shape, { depth: 0.48, bevelEnabled: false, curveSegments: 24 }).rotateX(Math.PI / 2).translate(ROUND.x, top, ROUND.z);
    K.add(plate, M.paving);
    for (const r of [ROUND.r - 0.08, ROUND.r * 0.66, ROUND.r * 0.33]) K.add(new THREE.TorusGeometry(r, 0.07, 4, 28).rotateX(Math.PI / 2).translate(ROUND.x, top - 0.08, ROUND.z), M.brass, false);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      K.add(new THREE.BoxGeometry(ROUND.r * 2 - 0.1, 0.09, 0.09).rotateY(a).translate(ROUND.x, top - 0.08, ROUND.z), M.brass, false);
    }
    sheet.push([ROUND.x - ROUND.r, ROUND.x + ROUND.r, ROUND.z - ROUND.r, ROUND.z + ROUND.r]);
  }
  const sheetMesh = new THREE.Mesh(new THREE.BufferGeometry(), M.paving);
  {
    const geos = sheet.map(([x0, x1, z0, z1]) => new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0).translate((x0 + x1) / 2, top - 0.03, (z0 + z1) / 2).toNonIndexed());
    const n = geos.reduce((s, g) => s + g.attributes.position.count, 0), pos = new Float32Array(n * 3);
    let o = 0;
    for (const g of geos) { pos.set(g.attributes.position.array, o); o += g.attributes.position.array.length; }
    sheetMesh.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sheetMesh.visible = false;
    sheetMesh.name = 'The old market: the grilles’ sheet';
  }
  // the stairwell's balustrade (under a metre: the avenue stays open at walking height), and its stair down
  for (const x of [-STAIRWELL.x - 0.15, STAIRWELL.x + 0.15]) K.slab(x - 0.15, x + 0.15, top, top + 0.85, STAIRWELL.z0, STAIRWELL.z1 + 0.3, M.stone);
  K.slab(-STAIRWELL.x - 0.3, STAIRWELL.x + 0.3, top, top + 0.85, STAIRWELL.z1, STAIRWELL.z1 + 0.3, M.stone);
  const steps = (n, place) => { for (let i = 1; i <= n; i++) place(i, (OLD.floor * i) / n); };
  {
    const n = 16, run = (STAIRWELL.z1 - STAIRWELL.z0) / n;
    // (the last at the floor's own height, Z_GAP under it: its top and the floor's were one plane; issue #286)
    steps(n, (i, y) => K.slab(-STAIRWELL.x, STAIRWELL.x, F - 0.5, top + y - (i === n ? Z_GAP : 0), STAIRWELL.z0 + run * (i - 1), STAIRWELL.z0 + run * i + (i === n ? 0 : 0.02), M.stone));
  }
  // the alley stair: up east out of the passage, its walls the alley's kerb, a rail along each
  {
    const n = 16, run = (ALLEY_STAIR.x1 - ALLEY_STAIR.x0) / n;
    // (the last not on under the paving: its top is the street's; issue #286)
    for (let i = 1; i <= n; i++) K.slab(ALLEY_STAIR.x0 + run * (i - 1), ALLEY_STAIR.x0 + run * i + (i === n ? 0 : 0.02), F - 0.5, F + (-F * i) / n, ALLEY_STAIR.z0, ALLEY_STAIR.z1, M.stone);
    for (const z of [ALLEY_STAIR.z0 - 0.5, ALLEY_STAIR.z1 + 0.5]) K.slab(ALLEY_STAIR.x0, ALLEY_STAIR.x1, top, top + 0.85, z - 0.12, z + 0.12, M.brass);
    K.slab(ALLEY_STAIR.x0 - 0.24, ALLEY_STAIR.x0, top, top + 0.85, ALLEY_STAIR.z0 - 1, ALLEY_STAIR.z1 + 1, M.brass);
  }
  // ---------------------------------------------------------------- pillars, arches, and the old stalls between them
  const lamps = [], places = {};
  for (const side of [-1, 1]) for (const z of PILLARS) {
    if (side > 0 && z > TUNNEL.z0 - 1.2 && z < TUNNEL.z1 + 1.2) continue;
    const x = side * (W - 0.4);
    K.slab(x - 0.4, x + 0.4, F, R, z - 0.45, z + 0.45, M.stone);
    K.slab(x - 0.55, x + 0.55, F, F + 0.4, z - 0.6, z + 0.6, M.stone);   // (its foot)
    K.slab(x - 0.55, x + 0.55, R - 0.45, R, z - 0.6, z + 0.6, M.stone);   // (its head under the deck)
  }
  // the arches between the pillars: a dark arched recess painted flat on each wall (drawn 1 cm proud)
  const archShape = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0); return s; };
  for (const side of [-1, 1]) for (let i = 0; i + 1 < PILLARS.length; i++) {
    const z = (PILLARS[i] + PILLARS[i + 1]) / 2;
    if (side > 0 && Math.abs(z - (TUNNEL.z0 + TUNNEL.z1) / 2) < 6) continue;
    const g = new THREE.ShapeGeometry(archShape(7, 4.4), 6).rotateY(side > 0 ? -Math.PI / 2 : Math.PI / 2).translate(side * (W - 0.01), F + 0.05, z);
    K.add(g, M.recess, false);
  }
  // the stalls: a counter along the wall in each bay, an awning over it, heaps of goods in front (the sheet's dense heaps)
  const hues = [M.shop[0], M.shop[1], M.shop[3], M.shop[2]];
  let bay = 0;
  for (const side of [-1, 1]) for (let i = 0; i + 1 < PILLARS.length; i++) {
    const z0 = PILLARS[i] + 0.6, z1 = PILLARS[i + 1] - 0.6, z = (z0 + z1) / 2;
    if (side > 0 && z > TUNNEL.z0 - 6 && z < TUNNEL.z1 + 6) continue;   // (the passage east)
    if (z < STAIRWELL.z1 + 4) continue;   // (the stair's foot kept clear)
    const first = side < 0 && i === PILLARS.length - 2;   // (the north bay on the west: the first stall)
    const cx = side * (W - 0.9), c = hues[bay++ % hues.length];
    K.slab(cx - 0.5, cx + 0.5, F, F + 1.0, z0 + 0.3, z1 - 0.3, c);
    K.slab(cx - 0.55, cx + 0.55, F + 1.0, F + 1.06, z0 + 0.25, z1 - 0.25, M.brass);
    // shelves on the wall behind the counter, crowded with pots, jars and lamps (drawn: each within a hand of its shelf)
    for (const sy of [F + 1.55, F + 2.35]) {
      K.slab(side * (W - 0.4) - 0.2, side * (W - 0.4) + 0.2, sy - 0.05, sy, z0 + 0.3, z1 - 0.3, M.wood);
      for (let q = 0, n = Math.floor((z1 - z0 - 0.8) / 0.42); q < n; q++) {
        const qz = z0 + 0.6 + q * 0.42, kind = (q + bay + Math.round(sy)) % 4, hx = side * (W - 0.4);
        if (kind === 0) K.add(new THREE.CylinderGeometry(0.12, 0.15, 0.32, 5, 1, true).translate(hx, sy + 0.16, qz), hues[(q + bay) % 4], false);
        else if (kind === 1) K.add(new THREE.SphereGeometry(0.16, 5, 3).scale(1, 1.2, 1).translate(hx, sy + 0.18, qz), M.brass, false);
        else if (kind === 2) K.add(new THREE.IcosahedronGeometry(0.14, 0).scale(1, 1.4, 1).translate(hx, sy + 0.2, qz), M.glass, false);
        else K.add(new THREE.BoxGeometry(0.28, 0.24, 0.3).translate(hx, sy + 0.12, qz), M.cream, false);
      }
    }
    // the awning: tilted out from the wall over the counter, in strips (solid: it is climbed to from the counter)
    for (let k = 0; k < 6; k++) {
      const len = (z1 - z0) / 6, zz = z0 + len * (k + 0.5);
      K.add(new THREE.BoxGeometry(3.2, 0.1, len).rotateZ(side * 0.22).translate(side * (W - 1.7), F + 3.3, zz), k % 2 ? M.cream : c);
    }
    // heaps in front: crates two high, great pots, brass lamps on stands, domed covers (solid where they are big)
    for (let k = 0; k < 4; k++) {
      const zz = z0 + 1.1 + k * ((z1 - z0 - 2.2) / 3), hx = side * (W - 2.2 - (k % 2) * 0.5);
      if (k % 2) {
        K.box(hx, F + 0.25, zz, 0.6, 0.5, 0.55, M.brass); K.box(hx + side * 0.05, F + 0.75, zz + 0.05, 0.5, 0.5, 0.5, M.cream, true, 0.3);
        // a brass lamp on a stand, the sheet's, beside the crates
        K.add(new THREE.CylinderGeometry(0.03, 0.05, 1.1, 5).translate(hx - side * 0.6, F + 0.55, zz + 0.5), M.brass, false);
        K.add(new THREE.SphereGeometry(0.22, 8, 5).scale(1, 1.25, 1).translate(hx - side * 0.6, F + 1.2, zz + 0.5), M.brass);
      } else {
        K.add(new THREE.SphereGeometry(0.42, 7, 5).scale(1, 1.15, 1).translate(hx, F + 0.48, zz), hues[(bay + k) % 4]);
        K.add(new THREE.CylinderGeometry(0.16, 0.22, 0.22, 8).translate(hx, F + 1.02, zz), M.brass);
        // a heap round its foot: jars, globes and a little crate (drawn: low)
        for (let j = 0; j < 4; j++) {
          const a = j * 1.7 + k, hr = 0.1 + (j % 2) * 0.04;   // (low: within a hand of the floor)
          K.add((j % 3 ? new THREE.SphereGeometry(hr, 5, 3) : new THREE.BoxGeometry(hr * 2, hr * 1.6, hr * 2)).translate(hx + Math.cos(a) * 0.62, F + hr * 0.5, zz + Math.sin(a) * 0.62), j % 2 ? M.brass : hues[(bay + j + 1) % 4], false);
        }
      }
      // small goods on the counter (drawn only: within a hand of it)
      for (let j = 0; j < 3; j++) K.add(new THREE.SphereGeometry(0.11, 5, 3).scale(1, 1.2, 1).translate(cx, F + 1.15, zz - 0.4 + j * 0.4), j % 2 ? M.brass : hues[(bay + j) % 4], false);
    }
    // two lamps hung over the bay from the deck (solid: high, but on what you climb to)
    for (const dz of [-1.8, 1.8]) {
      const lx = side * (W - 3.4), ly = F + 4.4;
      K.add(new THREE.CylinderGeometry(0.015, 0.015, R - ly - 0.3, 3).translate(lx, (R + ly) / 2 + 0.15, z + dz), M.ink, 'floats');
      K.add(new THREE.IcosahedronGeometry(0.28, 0).scale(1, 1.25, 1).translate(lx, ly, z + dz), M.lamp);
      K.add(new THREE.ConeGeometry(0.22, 0.2, 6).translate(lx, ly + 0.42, z + dz), M.brass);
      lamps.push(V(lx, ly, z + dz));
    }
    if (first) {
      // the first stall: glass lamps crowded on its counter and hung from its awning; its keeper behind it
      for (let j = 0; j < 7; j++) K.add(new THREE.IcosahedronGeometry(0.17, 0).scale(1, 1.3, 1).translate(cx, F + 1.3, z0 + 0.8 + j * ((z1 - z0 - 1.6) / 6)), j % 2 ? M.lamp : M.glass);
      for (let j = 0; j < 9; j++) {
        const hz = z0 + 0.9 + j * ((z1 - z0 - 1.8) / 8), hy = F + 2.7 - (j % 3) * 0.3, hx = side * (W - 2.4 - (j % 2) * 0.5);
        K.add(new THREE.CylinderGeometry(0.01, 0.01, F + 3.4 - hy, 3).translate(hx, (F + 3.4 + hy) / 2, hz), M.ink, 'floats');
        K.add(new THREE.IcosahedronGeometry(0.17, 0).scale(1, 1.35, 1).translate(hx, hy, hz), j % 2 ? M.glass : M.lamp, false);
        K.add(new THREE.ConeGeometry(0.13, 0.12, 6).translate(hx, hy + 0.27, hz), M.brass, false);
      }
      // and its old radio on the floor beside it, the sheet's, and a board leaning on the counter
      K.box(side * (W - 2.5), F + 0.35, z1 - 0.9, 1.1, 0.7, 0.6, M.recess);
      K.add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10).rotateZ(Math.PI / 2).translate(side * (W - 3.08), F + 0.38, z1 - 0.9), M.brass, false);
      places.firstStall = V(side * (W - 2.1), F, z);
      places.keeper = V(side * (W - 0.4), F, z + 0.6);
    }
  }
  // the keeper of the first stall, one of the quiet ones: a body and a broad head (drawn, behind the counter)
  {
    const k = places.keeper;
    K.add(new THREE.SphereGeometry(1, 12, 8).scale(0.36, 0.7, 0.3).translate(k.x, k.y + 0.75, k.z), M.lilac, false);
    K.add(new THREE.SphereGeometry(1, 12, 8).scale(0.5, 0.26, 0.28).translate(k.x, k.y + 1.42, k.z), M.lilac, false);
  }
  // the oldest crossing sign: a long painted board hung over the crossing at the north end, by the first stall
  {
    const z = -111.5, y0 = F + 3.2, y1 = F + 4.9;
    K.slab(-8, 8, y0, y1, z - 0.08, z + 0.08, M.ink);
    // painted on both faces (seen from the square end and from the crossing): the sheet's long figure, coral on teal
    for (const f of [1, -1]) {
      K.add(tint(new THREE.BoxGeometry(15.4, y1 - y0 - 0.3, 0.04).translate(0, (y0 + y1) / 2, z + f * 0.1), '#88b4b5'), M.painted);   // (solid: the board's own faces)
      for (const [x, w, c] of [[-5, 4.6, '#f0a083'], [-0.5, 3.4, '#e4bd83'], [3.6, 4.2, '#f0a083'], [6.4, 1.6, '#b9a9c5']]) K.add(tint(new THREE.CircleGeometry(1, 14).scale(w / 2, 0.55, 1).rotateY(f > 0 ? 0 : Math.PI).translate(f * x, (y0 + y1) / 2 + Math.sin(x) * 0.15, z + f * 0.13), c), M.painted);
    }
    for (const x of [-7.2, 7.2]) K.slab(x - 0.05, x + 0.05, y1, R, z - 0.05, z + 0.05, M.ink);
  }
  const group = K.done(scene);
  group.add(sheetMesh);
  // the way home from the square (with the screen lanes': src/market-lanes.js): from the Undertower's door round the
  // tower's west side, down the stair, the length of the old street, east along the passage and up into the alley
  const line = [[0, 0.4, -271], [-14.5, 0, -266], [-14.5, 0, -238], [-4, 0, -218], [0, 0, -214.6], [0, F, -199.4], [0, F, -150], [4, F, -112],
    [OLD.x, F, (TUNNEL.z0 + TUNNEL.z1) / 2], [TUNNEL.x1 - 0.4, F, (TUNNEL.z0 + TUNNEL.z1) / 2], [ALLEY_STAIR.x1 + 0.4, 0, (TUNNEL.z0 + TUNNEL.z1) / 2]];
  const sights = [{ name: 'the first stall', at: places.firstStall.clone() }, { name: 'the round grille', at: V(ROUND.x, F, ROUND.z) }];
  // the crowd down here: up and down the old street, a few at the stalls, two along the passage
  const crowd = {
    walks: [{ path: [V(-3.2, F, -198), V(-3.2, F, -113)], n: 5, pair: 0.4 }, { path: [V(3.2, F, -113), V(3.2, F, -198)], n: 5, pair: 0.4 },
      { path: [V(OLD.x + 2, F, -105), V(TUNNEL.x1 - 1, F, -105)], n: 2, pair: 0.2, lateral: 0.3 }],
    groups: [[-6.4, -186], [6.2, -170], [-6.6, -156], [6.4, -141], [-6.2, -128], [5.8, -118]].map(([x, z], i) => ({ at: V(x, F, z), n: 2 + (i % 3) })),
    edges: [],
  };
  return { group, line, sights, places, lamps, crowd, holes: HOLES, sheet: sheetMesh };
}
