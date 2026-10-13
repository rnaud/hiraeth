import * as THREE from 'three';
import { kit, tint } from './market-kit.js';
import { Z_GAP } from './temples/kit.js';

// The market in the air (issue #191, the author's picked direction B: references/levels/The Signal Market/environment/
// explorations/market-in-the-air/). The market climbs the west towers' faces: from the lantern market by Madame Sel a
// stair goes up between two stalls to the lantern gallery (10 m, the lantern sellers), a second stair over Pashka's to
// the sign painters' gallery (25 m), which runs on to Kip's skybridge; past him a third stair climbs to the antenna
// sellers' gallery (44 m), and from its end a basket on a cable carries you over the square onto the silent tower's
// cream balcony. Each gallery its own trade and its own view of the tower. The way up through the market rather than
// down the street: the leading line the quest's two climbs name ('the market in the air', src/story/bazaar-data.js).
// No rng: the street's layout stays as it was. Everything you stand on or touch collides as drawn; the basket is a
// moving collider (physics.addMover, the level's init) that carries whoever stands in it (src/carriers.js).
//
//   buildMarketInTheAir(scene, M) → { line, sights, places, stairs, galleries, basket, crowd, init(physics), update(dt, t, player) }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** The galleries' width, wall side to street side (m, world x): over the west stalls, clear of the towers' tubes and ledges. */
export const AIR = { x0: -31.5, x1: -27.5 };
const XM = (AIR.x0 + AIR.x1) / 2;
/** The three stairs, each straight along the street (z0 its foot, z1 its head), their rise a step of 0.37 m or so. */
export const STAIRS = [
  { id: 'lantern', z0: 65, z1: 52, y0: 0.3, y1: 10 },   // (its foot in the gap between two stalls, a step in from the next)
  { id: 'signs', z0: -2, z1: -23, y0: 10, y1: 25 },
  { id: 'antennas', z0: -93.5, z1: -121, y0: 25, y1: 44 },
];
/** The galleries: their deck's top (y), from z0 to z1, and the trade on each. */
export const GALLERIES = [
  { id: 'lantern', y: 10, z0: 52, z1: -2, trade: 'lanterns', stalls: [44, 26, 8] },
  { id: 'signs', y: 25, z0: -23, z1: -86.5, trade: 'signs', stalls: [-34, -52, -72] },
  { id: 'antennas', y: 44, z0: -121, z1: -211, trade: 'antennas', stalls: [-136, -171, -192] },
];
/** The antenna sellers' mast, in the alley mouth behind their gallery: its shaft to the deck, the mast over it to the nest. */
export const MAST = { x0: -34.5, x1: -31.5, z0: -159.6, z1: -156.6, deck: 60, nest: 76 };
/** Kip's skybridge (src/levels/bazaar.js BRIDGES[1]): the signs gallery comes out on it, the antenna stair leaves it. */
export const KIP_BRIDGE = { z: -90, y: 25, half: 3.5 };
/** The basket over the square: from beside the antenna gallery's end to beside the cream balcony, its floor at 44 m. */
export const BASKET = { from: [-26.05, 44, -205], to: [-16.45, 44, -230], r: 1.4, speed: 2.2, board: 0.8, home: 5 };
/** Where the gallery's rail opens to the basket (z), and the balcony's (x: its west edge, src/levels/bazaar.js SIGNAL). */
const GATE_Z = [-206.6, -203.4];

export function buildMarketInTheAir(scene, M) {
  const K = kit('The market in the air');
  const painted = M.painted;   // (vertex colours: the sign painters' boards, the stalls' cloths)
  // ---------------------------------------------------------------- stairs: treads, stringers, rails, legs
  const stairs = STAIRS.map((S) => {
    const n = Math.ceil((S.y1 - S.y0) / 0.38), rise = (S.y1 - S.y0) / n, run = (S.z1 - S.z0) / n;   // (run < 0: south)
    const treads = [];
    for (let i = 1; i <= n; i++) {
      const y = S.y0 + rise * i, za = S.z0 + run * (i - 1), zb = S.z0 + run * i;
      // (its ends Z_GAP inside the stringers' outer faces: they were one plane, cream and ink; issue #286)
      K.slab(AIR.x0 + Z_GAP, AIR.x1 - Z_GAP, y - 0.18, y, Math.min(za, zb) - 0.04, Math.max(za, zb) + 0.04, M.cream);
      treads.push(V(XM, y, (za + zb) / 2));
    }
    // the stringers under the treads' ends, and the rails over them (solid: a bar at hand height, posts every two metres)
    for (const x of [AIR.x0 + 0.08, AIR.x1 - 0.08]) {
      K.beam([x, S.y0 - 0.25, S.z0], [x, S.y1 - 0.25, S.z1], 0.16, 0.42, M.ink);
      K.beam([x, S.y0 + 1.05, S.z0], [x, S.y1 + 1.05, S.z1], 0.09, 0.09, M.brass);
      const L = Math.abs(S.z1 - S.z0);
      for (let s = 0; s <= L; s += 2) {
        const z = S.z0 + Math.sign(run) * s, y = S.y0 + ((S.y1 - S.y0) * s) / L;
        K.slab(x - 0.04, x + 0.04, y, y + 1.05, z - 0.04, z + 0.04, M.brass, false);   // (drawn: the bar over them keeps you in)
      }
    }
    // legs down to the street (or the gallery below) under the stair's middle and its head
    for (const f of [0.5, 1]) {
      const z = S.z0 + (S.z1 - S.z0) * f, y = S.y0 + (S.y1 - S.y0) * f - 0.45;
      if (f === 1 && S.id !== 'lantern') continue;   // (its head stands on the gallery's own legs)
      for (const x of [AIR.x0 + 0.25, AIR.x1 - 0.25]) K.slab(x - 0.17, x + 0.17, 0, y, z - 0.17, z + 0.17, M.ink);
    }
    return { ...S, n, rise, treads, foot: V(XM, S.y0, S.z0 + Math.sign(run) * -0.6), head: V(XM, S.y1, S.z1 + Math.sign(run) * 0.6) };
  });

  // ---------------------------------------------------------------- the galleries: deck, girders, legs, rails
  const legsAt = [59.5, 32.5, 5.5, -48.5, -75.5, -102.5, -129.5, -156.5, -183.5, -210.5];   // (the gaps between the street's stalls)
  const galleries = GALLERIES.map((G) => {
    const zN = Math.max(G.z0, G.z1), zS = Math.min(G.z0, G.z1);
    K.slab(AIR.x0, AIR.x1, G.y - 0.3, G.y, zS, zN, M.cream);
    for (const x of [AIR.x0 + 0.1, AIR.x1 - 0.1]) K.slab(x - 0.12, x + 0.12, G.y - 0.95, G.y - 0.3, zS, zN, M.ink);   // (the girders)
    for (const z of legsAt) if (z < zN - 0.5 && z > zS + 0.5) {
      for (const x of [AIR.x0 + 0.25, AIR.x1 - 0.25]) K.slab(x - 0.2, x + 0.2, 0, G.y - 0.95, z - 0.2, z + 0.2, M.ink);
      K.slab(AIR.x0, AIR.x1, G.y - 1.25, G.y - 0.95, z - 0.15, z + 0.15, M.ink);   // (the cross beam)
      // a brace under each girder: the market's iron, not a building's
      for (const x of [AIR.x0 + 0.25, AIR.x1 - 0.25]) for (const dz of [-1, 1]) K.beam([x, G.y - 4.2, z + dz * 0.3], [x, G.y - 1.1, z + dz * 3], 0.12, 0.12, M.ink, false);
    }
    // the rails: the street side open where the basket waits, the ends open to the stairs and the bridge
    const rail = (x, z0, z1) => {
      const a = Math.min(z0, z1), b = Math.max(z0, z1);
      if (b - a < 0.3) return;
      K.slab(x - 0.05, x + 0.05, G.y + 1.0, G.y + 1.1, a, b, M.brass);
      K.slab(x - 0.03, x + 0.03, G.y + 0.5, G.y + 0.56, a, b, M.brass, false);
      for (let z = a; z <= b + 1e-6; z += Math.min(1.6, (b - a) / Math.max(1, Math.round((b - a) / 1.6)))) K.slab(x - 0.04, x + 0.04, G.y, G.y + 1.0, z - 0.04, z + 0.04, M.brass, false);
    };
    for (const x of [AIR.x0 + 0.05, AIR.x1 - 0.05]) {
      if (G.id === 'antennas' && x > XM) { rail(x, zN, GATE_Z[1]); rail(x, GATE_Z[0], zS); }
      else if (G.id === 'antennas') { rail(x, zN, MAST.z1 + 0.1); rail(x, MAST.z0 - 0.1, zS); }   // (open to the mast's face)
      else rail(x, zN, zS);
    }
    if (G.id === 'antennas') {   // (its far end railed across: the way on is the basket)
      K.slab(AIR.x0, AIR.x1, G.y + 1.0, G.y + 1.1, zS + 0.01, zS + 0.11, M.brass);
      for (let x = AIR.x0 + 0.05; x <= AIR.x1; x += 1.3) K.slab(x - 0.04, x + 0.04, G.y, G.y + 1.0, zS + 0.02, zS + 0.1, M.brass, false);
    }
    return { ...G, zN, zS };
  });

  // ---------------------------------------------------------------- the stalls on the galleries, by trade
  const stalls = [];
  const shopCols = ['#f0a083', '#88b4b5', '#e4bd83', '#b9a9c5'];
  for (const G of galleries) G.stalls.forEach((z, k) => {
    const y = G.y, x = AIR.x0 + 0.55, col = M.shop[(k + (G.id === 'signs' ? 1 : G.id === 'antennas' ? 2 : 0)) % M.shop.length];
    K.slab(x - 0.4, x + 0.4, y, y + 1.0, z - 1.5, z + 1.5, col);                               // the counter
    K.slab(x - 0.45, x + 0.45, y + 1.0, y + 1.06, z - 1.55, z + 1.55, M.brass);                 // its brass top
    for (const dz of [-1.5, 1.5]) K.slab(x - 0.05, x + 0.05, y, y + 2.55, z + dz - 0.05, z + dz + 0.05, M.ink);   // the awning's posts
    // the awning, tilted down to the walk, scalloped in two colours (solid: it is in reach from the rail)
    for (let i = 0; i < 6; i++) K.add(new THREE.BoxGeometry(2.2, 0.1, 0.55).rotateZ(-0.16).translate(x + 0.95, y + 2.5, z - 1.375 + i * 0.55), i % 2 ? M.cream : col);
    stalls.push({ trade: G.trade, at: V(x + 0.9, y, z), counter: V(x, y + 1.06, z) });
    if (G.trade === 'lanterns') {
      // lanterns hung from the awning's edge, and a row of little ones on the counter
      for (let i = 0; i < 5; i++) {
        const lz = z - 1.2 + i * 0.6, ly = y + 2.05 - (i % 2) * 0.25;
        K.add(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 3).translate(x + 1.8, ly + 0.25, lz), M.ink, 'floats');
        K.add(new THREE.IcosahedronGeometry(0.16, 0).scale(1, 1.3, 1).translate(x + 1.8, ly, lz), i % 2 ? M.glow : M.lamp, false);
        K.add(new THREE.ConeGeometry(0.12, 0.1, 6).translate(x + 1.8, ly + 0.24, lz), M.brass, false);
      }
      for (let i = 0; i < 4; i++) K.add(new THREE.IcosahedronGeometry(0.11, 0).scale(1, 1.4, 1).translate(x, y + 1.2, z - 1.05 + i * 0.7), i % 2 ? M.lamp : M.glow, false);
    } else if (G.trade === 'signs') {
      // painted boards on easels leaning on the rail across the walk, pots of paint on the counter (the sheet's painter)
      for (let i = 0; i < 3; i++) {
        const bz = z - 1.1 + i * 1.1, h = 0.9 + (i % 2) * 0.4;
        const board = new THREE.BoxGeometry(0.05, h, 0.8).rotateZ(-0.12).translate(AIR.x1 - 0.35, y + 0.45 + h / 2, bz);
        K.add(tint(board, shopCols[(i + k) % 4]), painted);
        const blot = new THREE.CircleGeometry(0.22, 10).rotateY(-Math.PI / 2).rotateZ(-0.12).translate(AIR.x1 - 0.39, y + 0.5 + h * 0.55, bz);
        K.add(tint(blot, shopCols[(i + k + 2) % 4]), painted, false);
        K.add(new THREE.BoxGeometry(0.04, 0.9, 0.04).rotateZ(0.3).translate(AIR.x1 - 0.55, y + 0.45, bz), M.ink, false);
      }
      for (let i = 0; i < 5; i++) K.add(tint(new THREE.CylinderGeometry(0.1, 0.09, 0.18, 7).translate(x, y + 1.15, z - 1.2 + i * 0.6), shopCols[i % 4]), painted, false);
      // and a great board half painted against the wall side, as on the sheet
      K.add(tint(new THREE.BoxGeometry(0.06, 1.5, 1.1).translate(AIR.x0 + 0.12, y + 1.85, z + 0.5), '#f5dfab'), painted);
      K.add(tint(new THREE.CircleGeometry(0.4, 12).rotateY(Math.PI / 2).translate(AIR.x0 + 0.16, y + 1.95, z + 0.5), '#88b4b5'), painted, false);
    } else {
      // dishes and aerials: on the counter, and a forest of them on the awning's roof
      for (let i = 0; i < 3; i++) {
        const dz = z - 1 + i, r = 0.28 + (i % 2) * 0.12;
        K.add(new THREE.SphereGeometry(r, 10, 3, 0, Math.PI * 2, 0, 0.8).rotateZ(-1.0).translate(x + 0.05, y + 1.35, dz), M.cream, false);
        K.add(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4).translate(x, y + 1.25, dz), M.ink, false);
      }
      for (let i = 0; i < 4; i++) {
        const dz = z - 1.2 + i * 0.8, h = 0.9 + (i % 3) * 0.5;
        K.add(new THREE.CylinderGeometry(0.02, 0.02, h, 4).translate(x + 0.4, y + 2.6 + h / 2, dz), M.ink, false);
        K.add(new THREE.BoxGeometry(0.5, 0.025, 0.025).translate(x + 0.4, y + 2.6 + h * 0.8, dz), M.brass, false);
        if (i % 2) K.add(new THREE.SphereGeometry(0.35, 10, 3, 0, Math.PI * 2, 0, 0.8).rotateZ(-0.6).translate(x + 0.5, y + 2.7 + h, dz), M.cream, false);
      }
    }
  });

  // ---------------------------------------------------------------- the antenna sellers' mast: the market's top
  // A tall shaft in the alley mouth behind their gallery, from the street to a deck at 60 m (the third street, the sheet's),
  // and over it a narrower mast to a crow's nest at 76 m, its aerials and a dish on top. Climbed from the gallery (its
  // rail open there): a climb of 16 m to the deck, 16 more to the nest. Solid as drawn; the rungs drawn on its face.
  {
    const { x0, x1, z0, z1, deck, nest } = MAST, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2, w = 0.9;
    K.slab(x0, x1, 0, deck, z0, z1, M.teal);
    K.slab(xm - w, xm + w, deck, nest, zm - w, zm + w, M.ink);
    const bands = [12, 24, 36, deck - 0.4];
    for (let y = 1; y < nest - 0.5; y += 0.45) {
      const half = y < deck ? (x1 - x0) / 2 : w, fx = y < deck ? x1 : xm + w;
      if (y < deck && bands.some((b) => y >= b - 0.35 - 1e-6 && y + 0.06 <= b + 1e-6)) continue;   // (a rung inside a band: hidden in it, its foot in the band's; issue #286)
      K.slab(fx, fx + 0.04, y, y + 0.06, zm - half * 0.5, zm + half * 0.5, M.brass, false);
    }
    for (const y of bands) K.slab(x0 - 0.05, x1 + 0.05, y - 0.35, y, z0 - 0.05, z1 + 0.05, M.ink);   // (its bands)
    // the deck's rail on three sides (the street side open: you come up that face)
    K.slab(x0, x0 + 0.08, deck, deck + 1.05, z0, z1, M.brass);
    for (const z of [z0, z1 - 0.08]) K.slab(x0, x1, deck, deck + 1.05, z, z + 0.08, M.brass);
    // the nest: a little rail round its top (drawn), aerials and a dish
    for (const [a, b] of [[[xm - w, nest + 0.9, zm - w], [xm + w, nest + 0.9, zm - w]], [[xm - w, nest + 0.9, zm + w], [xm + w, nest + 0.9, zm + w]], [[xm - w, nest + 0.9, zm - w], [xm - w, nest + 0.9, zm + w]]]) K.beam(a, b, 0.05, 0.05, M.brass, 'floats');
    for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1]]) K.slab(xm + dx * (w - 0.04) - 0.03, xm + dx * (w - 0.04) + 0.03, nest, nest + 0.9, zm + dz * (w - 0.04) - 0.03, zm + dz * (w - 0.04) + 0.03, M.brass, false);
    for (const [dx, dz, h] of [[-0.6, -0.6, 7], [-0.6, 0.6, 4.5], [0.5, -0.5, 5.5]]) {
      K.add(new THREE.CylinderGeometry(0.035, 0.05, h, 4).translate(xm + dx, nest + h / 2, zm + dz), M.ink, 'floats');
      for (let k = 1; k < 4; k++) K.add(new THREE.BoxGeometry(1.2 - k * 0.25, 0.03, 0.03).translate(xm + dx, nest + h * (0.4 + k * 0.17), zm + dz), M.brass, 'floats');
    }
    K.add(new THREE.SphereGeometry(1.1, 12, 3, 0, Math.PI * 2, 0, 0.8).rotateZ(-0.9).translate(xm + 0.2, nest + 3.4, zm), M.cream, 'floats');
  }

  // ---------------------------------------------------------------- the basket and its cable
  const A = V(...BASKET.from), B = V(...BASKET.to), len = A.distanceTo(B), top = A.y;
  const cableY = top + 3.7, hang = (p) => [p.x, cableY, p.z];
  const dir = B.clone().sub(A).normalize();
  const endA = A.clone().addScaledVector(dir, -1.6), endB = B.clone().addScaledVector(dir, 1.6);
  // a mast at each end, on the gallery's rail and on the balcony, the cable between them (drawn only: high overhead)
  for (const [p, foot] of [[endA, top], [endB, top]]) {
    K.slab(p.x - 0.12, p.x + 0.12, foot, cableY + 0.4, p.z - 0.12, p.z + 0.12, M.ink);
    K.add(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10).rotateX(Math.PI / 2).translate(p.x, cableY + 0.05, p.z), M.brass, false);
  }
  const mid = A.clone().lerp(B, 0.5);
  K.tube([hang(endA), [mid.x, cableY - 0.35, mid.z], hang(endB)], 0.035, M.ink);
  const basket = new THREE.Group();
  basket.name = 'The market in the air: the basket';
  {
    const r = BASKET.r, floor = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.25, 14).translate(0, -0.125, 0), M.wood);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.42, 14, 1, true).translate(0, 0.21, 0), M.wood);
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 4, 16).rotateX(Math.PI / 2).translate(0, 0.42, 0), M.brass);
    const rods = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.3, 3).translate(0, 2.07, 0), M.ink);
    const hanger = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4, m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.5, 3), M.ink);
      m.position.set(Math.cos(a) * r * 0.5, 2.15, Math.sin(a) * r * 0.5);
      m.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      hanger.add(m);
    }
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.1, 10).rotateX(Math.PI / 2).rotateY(Math.atan2(dir.x, dir.z) + Math.PI / 2).translate(0, 3.75, 0), M.brass);
    for (const m of [band, rods, wheel]) m.userData.noCollide = true;
    hanger.userData.noCollide = true;
    // (out of the bake: it moves. Its floor and rim are the moving collider, physics.addMover in init; the rest drawn only)
    const solid = new THREE.Group();
    solid.add(floor, rim);
    basket.add(solid, band, rods, hanger, wheel);
    basket.userData.noCollide = true;
    basket.userData.solid = solid;
    for (const m of [floor, rim, band, rods, wheel]) m.name = basket.name;
  }
  basket.position.copy(A);
  scene.add(basket);
  const B_ = { piece: basket, a: A, b: B, len, t: 0, dir: 0, on: 0, idle: 0, collider: null, top };
  const station = [A.clone(), B.clone()];

  const group = K.done(scene);
  // the leading line: from beside Sel up the three stairs and along the galleries, past Kip, and over in the basket
  const line = [
    [-20, 0.3, 66.3], [XM, 0.3, 66.1], [XM, 10, 51.4], [XM, 10, 20], [XM, 10, -1.4], [XM, 25, -23.6], [XM, 25, -55], [XM, 25, -86.5],
    [-26, 25, -90], [XM, 25, -93], [XM, 44, -121.6], [XM, 44, -160], [XM, 44, -203.5], A.toArray(), B.toArray(), [-8, 44, -232],
  ];
  const sights = [
    { name: 'the lantern sellers’ gallery', at: stalls[1].at },
    { name: 'the sign painters’ gallery', at: stalls[4].at },
    { name: 'the antenna sellers’ gallery', at: stalls[7].at },
    { name: 'the antenna sellers’ mast', at: V((MAST.x0 + MAST.x1) / 2, MAST.nest, (MAST.z0 + MAST.z1) / 2) },
  ];
  // the crowd up there: strollers along each gallery, a few leaning on its rail to look down at the street
  const crowd = { walks: [], edges: [] };
  for (const G of galleries) {
    crowd.walks.push({ path: [V(AIR.x1 - 1.2, G.y, G.zN - 1.5), V(AIR.x1 - 1.2, G.y, G.zS + 1.5)], n: 3, pair: 0.4, keepRight: 0.2, lateral: 0.3 });
    for (let z = G.zN - 6; z > G.zS + 4; z -= 11) if (!G.stalls.some((s) => Math.abs(s - z) < 2.5) && !(G.id === 'antennas' && z < -200)) crowd.edges.push({ at: V(AIR.x1 - 0.42, G.y, z), heading: Math.PI / 2, pose: 'rail', rail: 0.5 });
  }
  return {
    group, line, sights, stairs, galleries, stalls, basket: B_, crowd,
    /** The mast's rungs, as ladders (climbed without tiring: src/physics.js onLadder, issue #252). */
    ladders: [
      { x: MAST.x1, z: (MAST.z0 + MAST.z1) / 2, y0: 0, y1: MAST.deck, r: 1.1 },
      { x: (MAST.x0 + MAST.x1) / 2 + 0.9, z: (MAST.z0 + MAST.z1) / 2, y0: MAST.deck, y1: MAST.nest, r: 0.9 },
    ],
    places: { antennaSeller: stalls[7].counter.clone(), lanternStair: stairs[0].foot.clone(), nest: V((MAST.x0 + MAST.x1) / 2, MAST.nest, (MAST.z0 + MAST.z1) / 2), deck: V((MAST.x0 + MAST.x1) / 2, MAST.deck, (MAST.z0 + MAST.z1) / 2) },
    /** The basket as a moving collider (the level's init). */
    init(physics) { B_.collider = physics.addMover?.(basket.userData.solid, { all: true }) ?? null; },
    /**
     * The basket: stand still in it a moment and it carries you over; left empty it goes back to the gallery after a
     * while; walk up to either end while it waits at the other and it comes for you.
     */
    update(dt, t, player) {
      const p = player?.pos;
      const at = basket.position;
      const inside = !!p && (player.onGround ?? true) && Math.hypot(p.x - at.x, p.z - at.z) < BASKET.r * 0.95 && Math.abs(p.y - top) < 1.2;
      if (B_.dir === 0) {
        if (inside) { B_.on += dt; B_.idle = 0; if (B_.on > BASKET.board) B_.dir = B_.t < 0.5 ? 1 : -1; }
        else {
          B_.on = 0; B_.idle += dt;
          const far = B_.t < 0.5 ? station[1] : station[0];
          const calling = !!p && Math.hypot(p.x - far.x, p.z - far.z) < 5 && Math.abs(p.y - top) < 2;
          if (calling && B_.idle > 0.6) B_.dir = B_.t < 0.5 ? 1 : -1;
          else if (B_.t > 0.5 && B_.idle > BASKET.home && !(p && p.distanceTo(station[1]) < 8)) B_.dir = -1;
        }
      }
      if (B_.dir) {
        B_.t = Math.min(1, Math.max(0, B_.t + (B_.dir * BASKET.speed * dt) / len));
        if (B_.t === 0 || B_.t === 1) { B_.dir = 0; B_.on = inside ? -1e9 : 0; B_.idle = 0; }
      } else if (!inside && B_.on < 0) B_.on = 0;
      const e = B_.t * B_.t * (3 - 2 * B_.t);
      at.lerpVectors(A, B, e);
      at.y = top - Math.sin(Math.PI * e) * 0.35;   // (the cable sags a little in the middle)
      basket.updateMatrixWorld(true);
    },
  };
}
