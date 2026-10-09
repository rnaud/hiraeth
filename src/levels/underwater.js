import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, sharedUniforms } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import {
  UNDERWATER_LOOK, UNDERWATER_DAY, UNDERWATER_DUSK, UNDERWATER_NIGHT, SEA_DAY, UW_PAL, uwMats, seaSurface, tower, pod, podRing, glassColumns, cafeDome,
  walkway, lampPost, stair, bush, kelp, rock, manta, fishSchool, farCity,
} from './underwater-kit.js';

// ---------------------------------------------------------------------------
// The Underwater City (?level=underwater): a city on the sea floor, after its reference sheets
// (references/levels/The Underwater City, docs/systems/worlds.md "The Underwater City").
//
//   the landing     a sandy hollow south of the city, rocks and kelp: the ship stands on the bed
//   the avenue      the paved street north through the city (x -7 … 7), globe lamps both sides, the
//                   towers of pods rising either side, glass columns of luminous water between them
//   the cafés       under domes on the avenue (glass, or a shell with windows): air inside, warm and lit,
//                   people at the tables. Walk in through the door and you are out of the water
//   the canal       a trench across the city (z -20), the avenue's bridge and two footbridges over it,
//                   kelp and fish down in it
//   the terrace     a raised quarter to the west, the great café on it and the lamps along its edge,
//                   the sea floor dropping away into the deep beyond
//   the plaza       round, at the avenue's north end, the great column in its middle
//
// The sea's surface is far overhead (SEA_Y): the whole city is under water. You walk the streets
// and the bed in the water (swim.js SEA: a little slower), the jump kicks you off swimming; up
// there you swim where you look, Space rises, letting go sinks you back down; you land on the pods'
// decks and the towers' tops. The water is drawn the Moebius way (water.js SEA_LOOK): a flat tinted
// haze in bands, light shafts from the surface as flat pale bands, caustics as printed lines, motes
// of marine snow; a manta circles overhead.
// ---------------------------------------------------------------------------

export const SEA_Y = 48;
export const AVENUE = { x0: -7, x1: 7, z0: -132, z1: 84 };
export const CANAL = { z: -20, half: 8, x0: -126, x1: 126, bed: -10 };
export const LANDING = { x: 0, z: 146, r: 46, y: -3 };
export const TERRACE = { x0: -116, x1: -74, z0: -74, z1: 14, y: 6 };
export const PLAZA = { x: 0, z: -112, r: 27 };
export const SHIP_SITE = { x: 0, z: 150, heading: Math.PI };   // (its hatch toward the city, north)
/** The city's ground: out to here it is flat street; beyond, the sand rises into low dunes (and drops away to the west). */
const CITY = { x0: -130, x1: 130, z0: -150, z1: 88 };

const nS = createNoise2D(71011), nD = createNoise2D(71012);
const lerp = THREE.MathUtils.lerp;

/** The sea floor: the city's level 0, the canal's trench, the landing's hollow, the deep to the west, low dunes round. */
export function seabed(x, z) {
  let h = 0;
  // the landing's hollow, down a long slope from the avenue's end
  h = lerp(h, LANDING.y + fbm(nS, x * 0.02, z * 0.02, 2) * 0.6, smoothstep(84, 104, z));
  // the canal (its walls are drawn: the trench under them)
  if (x > CANAL.x0 - 2 && x < CANAL.x1 + 2 && Math.abs(z - CANAL.z) < CANAL.half + 1) h = CANAL.bed + fbm(nS, x * 0.05, z * 0.05, 2) * 0.4;
  // out of the city: dunes rising round it, and the drop into the deep to the west
  const out = Math.max(CITY.x0 - x, x - CITY.x1, CITY.z0 - z, z - (LANDING.z + LANDING.r)) / 1;
  if (out > 0) h += smoothstep(0, 60, out) * (4 + fbm(nD, x * 0.012, z * 0.012, 3) * 5) + smoothstep(60, 200, out) * 22;
  if (x < CITY.x0) h -= smoothstep(CITY.x0, CITY.x0 - 70, x) * smoothstep(CITY.z1 + 20, CITY.z1 - 10, z) * smoothstep(CITY.z0 - 30, CITY.z0, z) * 34;
  return h;
}

/** Which part of the city p is in (the location's name). */
export function placeAt(p, inside = false) {
  if (inside) return 'A café under the sea';
  if (p.z > 90) return 'The landing';
  if (Math.abs(p.z - CANAL.z) < CANAL.half + 3) return 'The canal';
  if (p.x < TERRACE.x1 + 2 && p.z > TERRACE.z0 && p.z < TERRACE.z1) return 'The terrace';
  if (Math.hypot(p.x - PLAZA.x, p.z - PLAZA.z) < PLAZA.r + 6) return 'The plaza';
  if (p.y > 8) return 'Over the city';
  return 'The avenue';
}

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildUnderwater(scene) {
  const rng = mulberry32(71001);
  const terrain = yield* Terrain.make({
    size: 1000, seg: 250, height: seabed,   // (4 m: the city's floor is flat; the trench's walls are drawn)
    material: { color: UW_PAL.sand[0], color2: UW_PAL.sand[1], color3: UW_PAL.sand[2], mode: MODE_TERRAIN, ripples: true },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const group = new THREE.Group();
  group.name = 'The Underwater City';
  scene.add(group);
  const kit = new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 71001 });
  const M = uwMats(kit);
  const solid = { solid: true, shadow: true }, drawn = { solid: false, shadow: false };
  const domes = [], decks = [], cafes = [];

  // ---------------------------------------------------------------- the paving: the avenue, the canal's banks, the plaza
  // (drawn 3 cm over the bed, walked on as the bed: the heightfield)
  const pave = (x0, x1, z0, z1, mat = M.street) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.max(1, Math.ceil((x1 - x0) / 4)), Math.max(1, Math.ceil((z1 - z0) / 4))).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)) + 0.03);
    kit.add(mat, g, drawn);
  };
  pave(AVENUE.x0, AVENUE.x1, CANAL.z + CANAL.half, AVENUE.z1);
  pave(AVENUE.x0, AVENUE.x1, AVENUE.z0, CANAL.z - CANAL.half);
  for (const s of [-1, 1]) pave(CANAL.x0, CANAL.x1, s > 0 ? CANAL.z + CANAL.half : CANAL.z - CANAL.half - 6, s > 0 ? CANAL.z + CANAL.half + 6 : CANAL.z - CANAL.half, M.streetPale);
  {
    const g = new THREE.CircleGeometry(PLAZA.r, 48).rotateX(-Math.PI / 2).translate(PLAZA.x, 0.04, PLAZA.z);
    kit.add(M.streetPale, g, drawn);
  }
  // the landing's path from the ship to the avenue
  {
    const pts = [[0, H(0, 136) + 0.04, 136], [-3, H(-3, 118) + 0.04, 118], [0, H(0, 100) + 0.04, 100], [0, 0.04, 84]];
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    for (let i = 0; i < 24; i++) {
      const a = c.getPointAt(i / 24), b = c.getPointAt((i + 1) / 24), d = b.clone().sub(a), m = a.clone().add(b).multiplyScalar(0.5);
      const g = new THREE.PlaneGeometry(4, d.length() + 0.1).rotateX(-Math.PI / 2).rotateX(-Math.atan2(d.y, Math.hypot(d.x, d.z))).rotateY(Math.atan2(d.x, d.z)).translate(m.x, m.y, m.z);
      kit.add(M.streetPale, g, drawn);
    }
  }
  yield;

  // ---------------------------------------------------------------- the canal: its walls, the bridges, kelp and fish in it
  const bridges = [{ x: -62, w: 4 }, { x: 0, w: 14.4 }, { x: 64, w: 4 }];   // (west to east)
  // the walls down to the trench's bed, their tops a low parapet but at the bridges (where the decks rest on them)
  for (const s of [-1, 1]) {
    const z = CANAL.z + s * (CANAL.half + 0.5), cuts = [CANAL.x0, ...bridges.flatMap((b) => [b.x - b.w / 2, b.x + b.w / 2]), CANAL.x1];
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k], b = cuts[k + 1], top = k % 2 ? 0 : 0.6;
      kit.add(M.pier, new THREE.BoxGeometry(b - a, top - CANAL.bed, 1).translate((a + b) / 2, (CANAL.bed + top) / 2, z), solid);
    }
  }
  for (const e of [-1, 1]) kit.add(M.pier, new THREE.BoxGeometry(1, -CANAL.bed, CANAL.half * 2 + 2).translate(e * (CANAL.x1 + 0.5), CANAL.bed / 2, CANAL.z), solid);
  for (const b of bridges) {
    walkway(kit, M, [[b.x, 0.02, CANAL.z + CANAL.half + 2.4], [b.x, 0.9, CANAL.z], [b.x, 0.02, CANAL.z - CANAL.half - 2.4]], { w: b.w, thick: 1.2, span: 8, ground: CANAL.bed, lamps: b.w > 6 ? 0 : 9, mat: b.w > 6 ? M.street : M.streetPale });
  }
  // the canal's parapet broken at each bridge (cut it again: the boxes above are one piece, so: posts at the bridges' ends)
  for (let x = CANAL.x0 + 10; x < CANAL.x1; x += 18) {
    if (bridges.some((b) => Math.abs(x - b.x) < b.w / 2 + 3)) continue;
    for (const s of [-1, 1]) lampPost(kit, M, x, 0.6, CANAL.z + s * (CANAL.half + 0.5), { h: 3 });
  }
  for (let i = 0; i < 9; i++) kelp(kit, M, rng, [-110 + i * 26 + rng() * 8, CANAL.bed, CANAL.z + (rng() - 0.5) * 10], { n: 5, h: 7 + rng() * 3 });
  for (let i = 0; i < 6; i++) rock(kit, M, -100 + i * 40 + rng() * 10, CANAL.bed, CANAL.z + (rng() - 0.5) * 9, 1.4 + rng() * 1.5, i + 3);
  yield;

  // ---------------------------------------------------------------- the cafés on the avenue (air inside)
  domes.push(cafeDome(kit, M, rng, { x: 19, y: 0, z: 46, r: 9, sy: 0.8, shell: 'glass', doorYaw: -Math.PI / 2, tables: 9, people: 0 }));
  domes.push(cafeDome(kit, M, rng, { x: -18, y: 0, z: 22, r: 7.5, sy: 0.9, shell: 'teal', doorYaw: Math.PI / 2, windows: [{ yaw: Math.PI / 2 + 0.75, w: 5, y0: 0.7, y1: 4.8 }, { yaw: Math.PI / 2 - 0.75, w: 5, y0: 0.7, y1: 4.8 }], porthole: 1.5, tables: 6, people: 0 }));
  domes.push(cafeDome(kit, M, rng, { x: -19, y: 0, z: -68, r: 9.5, sy: 0.82, shell: 'glass', doorYaw: Math.PI / 2, tables: 10, people: 0 }));
  domes.push(cafeDome(kit, M, rng, { x: 17, y: 0, z: -48, r: 6.5, sy: 0.95, shell: 'pink', doorYaw: -Math.PI / 2, windows: [{ yaw: -Math.PI / 2 + 0.8, w: 4, y0: 0.6, y1: 4 }, { yaw: -Math.PI / 2 - 0.8, w: 4, y0: 0.6, y1: 4 }], tables: 5, people: 0 }));
  yield;

  // ---------------------------------------------------------------- the terrace to the west: its block, stairs, the great café, the lamps along the drop
  const T = TERRACE;
  kit.add(M.pier, new THREE.BoxGeometry(T.x1 - T.x0, T.y + 8, T.z1 - T.z0).translate((T.x0 + T.x1) / 2, T.y - (T.y + 8) / 2, (T.z0 + T.z1) / 2), solid);
  pave(T.x0 + 0.5, T.x1 - 0.5, T.z0 + 0.5, T.z1 - 0.5, M.streetPale);   // (its top: the block is solid as drawn, the paving 3 cm over it)
  const terraceStairs = [];
  for (const z of [-56, -6]) terraceStairs.push(stair(kit, M, { x: T.x1 + 0.2 + (T.y / 0.3) * 0.42, z, y0: 0, y1: T.y, w: 4, yaw: Math.PI / 2, mat: M.pier }));
  domes.push(cafeDome(kit, M, rng, { x: -95, y: T.y, z: -32, r: 11, sy: 0.95, shell: 'teal', doorYaw: Math.PI / 2, windows: [{ yaw: Math.PI / 2 + 0.85, w: 9, y0: 0.8, y1: 8 }, { yaw: -Math.PI / 2, w: 10, y0: 0.8, y1: 8.4 }], porthole: 2.2, tables: 12, people: 0 }));
  for (let z = T.z0 + 4; z < T.z1 - 2; z += 11) lampPost(kit, M, T.x0 + 0.8, T.y, z, { h: 4 });
  for (let z = T.z0 + 2; z < T.z1; z += 3.2) kit.add(M.pier, new THREE.BoxGeometry(0.5, 0.9, 2.8).translate(T.x0 + 0.25, T.y + 0.45, z), solid);   // (the parapet over the drop)
  for (const [x, z] of [[-80, 8], [-108, 10], [-80, -70], [-110, -68]]) bush(kit, M, rng, x, T.y, z, 1.6 + rng());
  // two small houses, pods on their stalks (as the fourth sheet has them along its walk), benches and planters
  domes.push(cafeDome(kit, M, rng, { x: -104, y: T.y, z: 2, r: 4.6, sy: 0.95, shell: 'pink', doorYaw: Math.PI / 2, windows: [{ yaw: 0.6, w: 3, y0: 0.5, y1: 3 }], tables: 2, people: 0 }));
  domes.push(cafeDome(kit, M, rng, { x: -106, y: T.y, z: -62, r: 4.2, sy: 0.9, shell: 'pink', doorYaw: Math.PI / 2 + 0.4, windows: [{ yaw: Math.PI - 0.4, w: 3, y0: 0.5, y1: 2.8 }], tables: 2, people: 0 }));
  for (const [x, z, R, st] of [[-82, -52, 4.2, 5], [-84, -4, 3.6, 7], [-100, -16, 3.2, 9]]) {
    const top = pod(kit, M, rng, { x, y: T.y + st, z, R, H: R * 0.85, kind: 'open', stalk: st, plants: 0.8 });
    decks.push({ x, y: top, z, R, kind: 'open' });
  }
  for (const [x, z, a] of [[-78, -24, 0], [-78, -40, 0], [-90, 6, Math.PI / 2], [-90, -66, Math.PI / 2]]) {
    kit.add(M.rim, new THREE.BoxGeometry(2.4, 0.45, 0.6).rotateY(a).translate(x, T.y + 0.22, z), solid);
    kit.add(M.pier, new THREE.BoxGeometry(1.2, 0.7, 1.2).translate(x + (a ? 2.2 : 0), T.y + 0.35, z + (a ? 0 : 2.2)), solid);
    bush(kit, M, rng, x + (a ? 2.2 : 0), T.y + 0.7, z + (a ? 0 : 2.2), 1.1);
  }
  for (const [x, z] of [[-86, -18], [-86, -46], [-96, 10], [-96, -60]]) lampPost(kit, M, x, T.y, z, { h: 3.8 });
  yield;

  // ---------------------------------------------------------------- the towers of pods
  const TOWERS = [
    { x: -36, z: 58, h: 44, r: 6 }, { x: -34, z: 6, h: 54, r: 7 }, { x: -40, z: -46, h: 58, r: 7.5 }, { x: -36, z: -92, h: 48, r: 6 },
    { x: 36, z: 70, h: 40, r: 5.5 }, { x: 40, z: 18, h: 52, r: 7 }, { x: 34, z: -78, h: 56, r: 6.5 }, { x: 44, z: -118, h: 42, r: 5.5 },
    { x: 72, z: 40, h: 36, r: 5 }, { x: 78, z: -52, h: 46, r: 6 }, { x: 70, z: -100, h: 38, r: 5 }, { x: -66, z: 50, h: 34, r: 5 },
    { x: -60, z: -110, h: 40, r: 5 }, { x: 96, z: 0, h: 30, r: 4.5 },
  ];
  for (const [i, t] of TOWERS.entries()) {
    const pods = podRing(rng, { h: t.h, n: Math.round(t.h / 10), rr: t.r * 0.75, from: 4, a0: Math.atan2(-t.z, -t.x) + (rng() - 0.5), spread: 2.1 });
    const tops = tower(kit, M, rng, { x: t.x, z: t.z, y0: H(t.x, t.z) - 0.3, h: t.h, r: t.r, top: ['dome', 'spire', 'flat'][i % 3], pods });
    for (const p of tops) if (p.kind !== 'dome') decks.push(p);
    if (i % 2 === 0) yield;
  }
  // the glass columns of luminous water, up to near the surface
  const COLS = [[-26, 40, 1.3], [-25, -36, 1.5], [26, 2, 1.4], [27, -64, 1.6], [-28, -82, 1.2], [56, 28, 1.1], [-54, -30, 1.2], [60, -82, 1.3], [PLAZA.x, PLAZA.z, 2.6]].map(([x, z, r]) => ({ x, z, r, y0: H(x, z) - 0.2, y1: SEA_Y - 3 }));
  const columns = glassColumns(kit, M, COLS, { mover: false, near: 90 });
  // the plaza: a ring of benches and lamps round the great column, the pink houses on its far side
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, x = PLAZA.x + Math.cos(a) * 9, z = PLAZA.z + Math.sin(a) * 9;
    kit.add(M.rim, new THREE.BoxGeometry(2.2, 0.45, 0.6).rotateY(-a + Math.PI / 2).translate(x, 0.22, z), solid);
    lampPost(kit, M, PLAZA.x + Math.cos(a + 0.31) * 16, 0, PLAZA.z + Math.sin(a + 0.31) * 16, { h: 3.8 });
  }
  domes.push(cafeDome(kit, M, rng, { x: 22, y: 0, z: -124, r: 5.5, sy: 0.9, shell: 'pink', doorYaw: -2.2, windows: [{ yaw: -1.6, w: 3.5, y0: 0.5, y1: 3.4 }], tables: 3, people: 0 }));
  domes.push(cafeDome(kit, M, rng, { x: -21, y: 0, z: -128, r: 4.8, sy: 0.95, shell: 'pink', doorYaw: 2.2, windows: [{ yaw: 1.6, w: 3, y0: 0.5, y1: 3.2 }], tables: 2, people: 0 }));
  yield;

  // ---------------------------------------------------------------- lamps along the avenue, bushes, the landing's rocks and kelp
  for (let z = AVENUE.z1 - 6; z > AVENUE.z0; z -= 14) {
    if (Math.abs(z - CANAL.z) < CANAL.half + 4 || Math.hypot(z - PLAZA.z, 0) < PLAZA.r) continue;
    for (const s of [-1, 1]) lampPost(kit, M, s * (AVENUE.x1 + 0.6), 0, z + (s > 0 ? 7 : 0), { h: 3.6 });
  }
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2, d = 14 + rng() * 34, x = LANDING.x + Math.cos(a) * d, z = LANDING.z + Math.sin(a) * d * 0.8;
    if (Math.hypot(x - SHIP_SITE.x, z - SHIP_SITE.z) < 20 || Math.abs(x) < 5) continue;
    if (i % 3 === 0) rock(kit, M, x, H(x, z), z, 1.6 + rng() * 3, i);
    else if (i % 3 === 1) kelp(kit, M, rng, [x, H(x, z), z], { n: 4 + Math.floor(rng() * 4), h: 5 + rng() * 6 });
    else bush(kit, M, rng, x, H(x, z), z, 1.4 + rng() * 1.6);
  }
  for (const [x, z] of [[-11, 70], [11, 64], [-11, 8], [11, -6], [-10, -90], [12, -34], [-12, -40], [10, 80]]) bush(kit, M, rng, x, 0, z, 1.2 + rng() * 0.6);
  for (let z = 100; z < 136; z += 9) for (const s of [-1, 1]) lampPost(kit, M, s * 3.4 + (z > 115 ? -2 : 0), H(s * 3.4, z), z, { h: 3.2 });
  yield;

  // ---------------------------------------------------------------- the city far off, all round (drawn only: the haze takes it)
  // (its own group: out of reach past the world's limit, so the audits pass it by: userData.floats)
  const far = new THREE.Group();
  far.name = 'The city far off';
  scene.add(far);
  const farKit = new RoomKit({ group: far, centre: new THREE.Vector3(), seed: 71002 });
  farCity(farKit, M, rng, { x: 0, z: -30, rMin: 300, rMax: 520, n: 110, arc: [0, Math.PI * 2], hMin: 24, hMax: 90, outside: 300, ground: H });
  farKit.finish();
  far.traverse((o) => { if (o.isMesh) o.userData.floats = true; });
  yield;

  // ---------------------------------------------------------------- the sea: its surface overhead, its air pockets (the cafés)
  const air = (x, y, z) => { for (const d of domes) if (d.air(x, y, z)) return true; return false; };
  const sea = seaSurface(kit, { y: SEA_Y, size: 1400, sea: { ...SEA_DAY, shafts: { ...SEA_DAY.shafts }, caustics: { ...SEA_DAY.caustics } }, air });
  // life: two mantas circling, schools of small fish
  manta(kit, M, { at: [0, 34, -10], R: 64, w: 15, speed: 2.6, phase: 0.4, bank: 0.2 });
  manta(kit, M, { at: [40, 40, -60], R: 120, w: 19, speed: -3, phase: 2.2, bank: 0.15 });
  for (const [x, y, z, n, R] of [[18, 14, 30, 34, 6], [-30, 22, -30, 30, 5], [50, 18, -90, 36, 7], [-70, 8, 40, 26, 5], [0, -4, -20, 30, 6]]) fishSchool(kit, M, { at: [x, y, z], n, R, seed: x * 7 + z });
  yield;

  kit.finish();
  // (the plants on the decks and the kelp are walked through: flora, as the contact audit counts them)
  const leaves = new Set(M.leaf);
  group.traverse((o) => { if (o.isMesh && leaves.has(o.material)) o.userData.flora = true; });
  const noShadow = [...kit.noShadow, sea];
  for (const d of domes) for (const t of d.tables) cafes.push({ x: t[0], z: t[1], y: d.y });
  yield;

  // the sea's colour by the hour: the shafts and the caustics only while the sun is up
  const S = sea.userData.sea, cDay = new THREE.Color(SEA_DAY.tint), cDeep = new THREE.Color(SEA_DAY.deep);
  const cNight = new THREE.Color('#0d2c44'), cNightDeep = new THREE.Color('#06182a'), _c = new THREE.Color();
  function seaByHour() {
    const k = 1 - sharedUniforms.uNight.value;
    S.tint = '#' + _c.copy(cNight).lerp(cDay, k).getHexString();
    S.deep = '#' + _c.copy(cNightDeep).lerp(cDeep, k).getHexString();
    S.shafts.strength = SEA_DAY.shafts.strength * k;
    S.caustics.strength = SEA_DAY.caustics.strength * k;
    S.max = lerp(0.75, SEA_DAY.max, k);
  }

  const spawn = new THREE.Vector3(0, H(0, 128) + 0.05, 128);
  return {
    id: 'underwater',
    ground: terrain,
    spawn, spawnHeading: Math.PI, camYaw: 0, camPitch: 0.06,
    shipSite: { ...SHIP_SITE },
    features: { mount: false, wind: false, jetpack: false, climb: true },
    limit: 300, killY: -80,
    defaults: { hour: 11, preset: 'Moebius print', cloudShadows: 0, look: UNDERWATER_LOOK },
    sky: { script: { day: UNDERWATER_DAY, dusk: UNDERWATER_DUSK, night: UNDERWATER_NIGHT } },
    lights: kit.lights, noShadow,
    reactions: false,   // (nothing grows on the streets: reactive-world.js)
    sea, domes, decks, cafes, columns: COLS, terraceStairs,
    air,
    atmo: (x, z, y) => ({ tint: [1, 1, 1], fog: 0.6, name: placeAt({ x, y: y ?? 0, z }, air(x, (y ?? 0) + 1, z)) }),
    life: { motes: { count: 220, color: '#d8f2ee', size: 0.05, rise: 0.06, wind: [0.08, 0.03] } },
    crowdLines: [
      '~neutral~ Mind the canal’s edge. The fish there have no manners.',
      '~happy~ At midday the light comes all the way down to the street. Look up!',
      '~curious~ You walked in from the landing? With that little pack? Brave.',
      '~whisper~ If you sit still in the café you can hear the manta go over. A sort of hum.',
      '~playful~ My grandfather swam up to the surface once. He said it was very bright and very dry and he did not care for it.',
      '~tired~ Up and down the columns all day, carrying the post.',
      '~solemn~ The lamps on the terrace are for the deep. Something should see a light, down there.',
      '~neutral~ The cafés are dry inside. Wipe your feet, though.',
    ],
    crowdSpots() {
      const r = mulberry32(7171), V = (x, y, z) => new THREE.Vector3(x, y, z), size = () => 2 + Math.floor(r() * 3);
      const groups = [], walks = [], edges = [];
      for (const x of [-4, 4]) walks.push({ path: [V(x, 0, 80), V(x, 0, CANAL.z + CANAL.half + 4)], n: 6, pair: 0.4 });
      for (const x of [-3.5, 3.5]) walks.push({ path: [V(x, 0, CANAL.z - CANAL.half - 4), V(x, 0, AVENUE.z0 + 30)], n: 6, pair: 0.4 });
      for (const s of [-1, 1]) walks.push({ path: [V(-110, 0, CANAL.z + s * (CANAL.half + 3)), V(110, 0, CANAL.z + s * (CANAL.half + 3))], n: 6, pair: 0.3 });
      walks.push({ path: [V(TERRACE.x0 + 6, TERRACE.y, TERRACE.z0 + 6), V(TERRACE.x0 + 6, TERRACE.y, TERRACE.z1 - 6)], n: 3, pair: 0.3 });
      walks.push({ path: [V(TERRACE.x1 - 4, TERRACE.y, TERRACE.z0 + 4), V(TERRACE.x1 - 4, TERRACE.y, TERRACE.z1 - 4)], n: 2, pair: 0.3 });
      walks.push({ path: [V(1, seabed(1, 126), 126), V(-2, seabed(-2, 110), 110), V(1, 0, 86)], n: 3, pair: 0.5 });
      walks.push({ path: Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return V(PLAZA.x + Math.cos(a) * 21, 0, PLAZA.z + Math.sin(a) * 21); }), n: 6, pair: 0.4, loop: true });
      for (const z of [60, -60]) walks.push({ path: [V(-70, 0, z), V(-12, 0, z)], n: 2, pair: 0.3 }, { path: [V(12, 0, z + 6), V(70, 0, z + 6)], n: 2, pair: 0.3 });
      for (let i = 0; i < 6; i++) { const a = r() * 6.28; groups.push({ at: V(PLAZA.x + Math.cos(a) * 13, 0, PLAZA.z + Math.sin(a) * 13), n: size() }); }
      for (const c of cafes) if (r() < 0.6) groups.push({ at: V(c.x + 0.9, c.y, c.z - 0.9), n: 2 });
      for (let x = CANAL.x0 + 14; x < CANAL.x1 - 10; x += 16 + r() * 10) if (!bridges.some((b) => Math.abs(x - b.x) < b.w / 2 + 3) && r() < 0.4) edges.push({ at: V(x, 0, CANAL.z + CANAL.half + 1.3), heading: Math.PI, pose: 'rail' });
      for (let z = TERRACE.z0 + 6; z < TERRACE.z1 - 4; z += 12) if (r() < 0.5) edges.push({ at: V(TERRACE.x0 + 1.4, TERRACE.y, z), heading: -Math.PI / 2, pose: 'rail' });
      for (const sp of [...groups, ...walks, ...edges]) sp.lines = this.crowdLines;
      return { groups, walks, edges, avoid: [], farMax: 220, costume: 'underwater', palette: { cloaks: UW_PAL.people },
        clear: [{ x: spawn.x, z: spawn.z, r: 6 }, { x: SHIP_SITE.x, z: SHIP_SITE.z, r: 20 }] };
    },
    update(dt, t, ctx = {}) {
      for (const m of kit.movers) m(t);
      columns.update(t, ctx.player?.pos ?? null);
      seaByHour();
    },
  };
}
export const createUnderwater = stepped(buildUnderwater);
