import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { mulberry32, createNoise2D } from '../noise.js';
import { stepped } from '../load-steps.js';
import { RoomKit, put } from './lab-kit.js';
import {
  WATERFALL_WORLD_LOOK, WATERFALL_DAY, WATERFALL_DUSK, WATERFALL_NIGHT, fallSheet, fallMat, mistBank, cityMats, rockMass, quarter, framed, archBridge, stair, lamp, copperPipe, pottedPlant, terrace, roundHouse,
} from './waterfall-kit.js';

// ---------------------------------------------------------------------------
// The City Behind the Waterfall (?level=waterfall): a long cavern city hidden behind a curtain of falling
// water, after its reference sheets (references/The City Behind the Waterfall, docs/systems/worlds.md).
//
//   the landing      a broad shelf of stone outside the cavern's east mouth, open to the sky: the ship
//                    stands there, the valley far below to the south, the mountain to the north
//   the promenade    the dry broad walkway along the whole cavern (x -310 … 44, z -10 … 22), cafés and
//                    pots by its parapet; three short bridges out to balconies standing behind slits in
//                    the water, looking out over the sunlit valley
//   the curtain      the falls (z = 40), from the roof's lip (y 150) down to the pool (y -17), in the
//                    falling-water shader (waterfall-shader.js), mist and spray at its foot; a stair down to
//                    a quay on the pool (you can swim in it)
//   the lower town   terraces of rounded houses up the back wall (x -150 … 30), climbed by stairs
//   the deep quarter further in (x -300 … -160), darker, the houses lit amber, copper pipes up the walls,
//                    a small fall from the roof into a basin at the far end
//
// The roof casts its shade over the city: the sun comes in under the lip from the south, so the promenade
// and the lower terraces are lit and the upper ones and the deep quarter sit in the cavern's teal with
// their lamps. Built with the world's kit (waterfall-kit.js), merged by material (the big meshes are cut
// into tiles by perf.js tileScene so they cull).
// ---------------------------------------------------------------------------

export const CAVE = { x0: -310, x1: 44, back: -100, front: 22, fall: 40, rim: 64, lip: 150, poolY: -17, bed: -21 };
export const LANDING = { x0: 44, x1: 214, z0: -76, z1: 72 };
/** The balconies behind the slits in the water: their middles (x). */
export const BALCONIES = [-236, -126, -22];
export const SHIP_SITE = { x: 140, z: 2, heading: -Math.PI / 2 };   // (the hatch toward the cavern)
/** The curtain's sheets: [x0, x1] along z = CAVE.fall, the slits between them at the balconies. */
export const SHEETS = [[-306, -242], [-230, -132], [-120, -28], [-16, 41]];
/** The small fall at the deep end: from the roof into a basin. */
export const INNER_FALL = { x: -306, z0: -6, z1: 12, top: 112 };


const nV = createNoise2D(52011);
const inRect = (x, z, x0, x1, z0, z1) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
/** The ground: the cavern's floor and the landing (0), the pool's bed under the water, and nothing past the edges. */
export function groundHeight(x, z) {
  if (inRect(x, z, CAVE.x0, CAVE.x1, CAVE.front, CAVE.rim - 2)) return CAVE.bed;
  if (inRect(x, z, CAVE.x0, CAVE.x1, CAVE.back - 40, CAVE.front)) return 0;
  if (inRect(x, z, LANDING.x0, LANDING.x1, LANDING.z0, LANDING.z1)) return 0;
  return -600;   // (far under the valley's drawn floor: out of anyone's reach)
}

/** How loud the falls are at p (0..1): near the curtain's foot, and the small fall at the deep end. */
export function roarAt(p) {
  const dx = Math.max(SHEETS[0][0] - p.x, 0, p.x - SHEETS.at(-1)[1]);
  const d = Math.hypot(dx, Math.max(0, CAVE.fall - p.z) * 1, (p.y - CAVE.poolY) * 0.25);
  const k = Math.min(1, Math.max(0, 1 - (d - 8) / 110));
  const di = Math.hypot(p.x - INNER_FALL.x, p.z - (INNER_FALL.z0 + INNER_FALL.z1) / 2, p.y * 0.3);
  return Math.max(k * k, 0.6 * Math.max(0, 1 - di / 40));
}

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildWaterfall(scene) {
  const group = new THREE.Group();
  group.name = 'The City Behind the Waterfall';
  scene.add(group);
  const kit = new RoomKit({ group, centre: new THREE.Vector3(), seed: 52011 });
  const M = cityMats(kit, { shadeFlat: 0.8 });
  const rng = mulberry32(52011), solid = { solid: true, shadow: true };
  const noShadow = [];

  // ---------------------------------------------------------------- the floors: the cavern, the landing
  // (one block each down to the pool's bed: their faces are the pool's walls)
  kit.add(M.floor, new THREE.BoxGeometry(CAVE.x1 - CAVE.x0, -CAVE.bed, CAVE.front - CAVE.back + 30).translate((CAVE.x0 + CAVE.x1) / 2, CAVE.bed / 2, (CAVE.front + CAVE.back - 30) / 2), solid);
  kit.add(M.floor, new THREE.BoxGeometry(LANDING.x1 - LANDING.x0, 40, LANDING.z1 - LANDING.z0).translate((LANDING.x0 + LANDING.x1) / 2, -20, (LANDING.z0 + LANDING.z1) / 2), solid);
  // the pool's far rim (the water's edge before the drop to the valley) and its west end
  kit.add(M.rock, put(rockMass(7, CAVE.x1 - CAVE.x0 + 10, 9, 6, { lump: 0.04 }), (CAVE.x0 + CAVE.x1) / 2, CAVE.bed + 4.5, CAVE.rim, 0), solid);
  yield;

  // ---------------------------------------------------------------- the cavern's rock: back wall, roof, ends
  const rockAt = (seed, x, y, z, w, h, d, lump = 0.08) => kit.add(M.rock, put(rockMass(seed, w, h, d, { lump }), x, y, z, 0), solid);
  for (let x = CAVE.x0 - 20, i = 0; x < CAVE.x1 + 10; x += 46, i++) {
    rockAt(100 + i, x + 23, 90, CAVE.back - 24, 52, 220, 50);                          // the back wall
    rockAt(200 + i, x + 23, 60, -84, 50, 120 + rng() * 30, 14, 0.05);                 // its face behind the top terraces
    rockAt(300 + i, x + 23, 172 + rng() * 10, -36, 52, 70, 200, 0.06);                 // the roof
    rockAt(400 + i, x + 23, 128 + rng() * 8, 44, 50, 26 + rng() * 10, 14, 0.06);       // its lip over the curtain
  }
  yield;
  // hanging masses under the roof (well over the houses' tops), and the west end
  for (let i = 0; i < 9; i++) {
    const x = CAVE.x0 + 20 + i * 38 + rng() * 14, z = -20 + rng() * 44, w = 14 + rng() * 18;
    rockAt(500 + i, x, 112 + rng() * 10, z, w, 30 + rng() * 22, w * (0.8 + rng() * 0.5), 0.12);
  }
  rockAt(601, CAVE.x0 - 22, 80, -30, 40, 240, 200);
  // the mountain over the landing (north) and behind the cavern, so the sky line is rock
  for (let x = 40, i = 0; x < 260; x += 44, i++) rockAt(700 + i, x + 22, 70 + rng() * 30, LANDING.z0 - 20 - rng() * 10, 48, 150 + rng() * 60, 44);
  for (let x = -360, i = 0; x < 260; x += 70, i++) rockAt(800 + i, x, 190 + rng() * 40, -190, 80, 200, 120);
  // the cliff below the landing's south edge and below the pool's rim: rock going down out of sight
  rockAt(901, (LANDING.x0 + LANDING.x1) / 2, -80, LANDING.z1 + 6, LANDING.x1 - LANDING.x0 + 20, 120, 14, 0.04);
  rockAt(902, LANDING.x1 + 8, -80, (LANDING.z0 + LANDING.z1) / 2, 16, 120, LANDING.z1 - LANDING.z0, 0.04);
  rockAt(903, (CAVE.x0 + CAVE.x1) / 2, -90, CAVE.rim + 8, CAVE.x1 - CAVE.x0 + 30, 140, 12, 0.04);
  yield;

  // ---------------------------------------------------------------- the curtain
  const mat = fallMat(kit, { speed: 7, column: 2.6, gaps: 0.05, mist: 11, height: CAVE.lip - CAVE.poolY });
  const parts = SHEETS.map(([a, b], i) => {
    const g = fallSheet({ w: b - a, h: CAVE.lip - CAVE.poolY, bow: 1.5 + i * 0.4, lean: 2 });
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) + a + 400);   // (the columns run on across the slits)
    return g.translate((a + b) / 2, CAVE.poolY, CAVE.fall);
  });
  const curtain = new THREE.Mesh(mergeGeometries(parts), mat);
  curtain.name = 'The curtain'; curtain.userData.noCollide = true; curtain.userData.waterfall = true;
  group.add(curtain); noShadow.push(curtain);
  for (const [a, b] of SHEETS) mistBank(kit, { at: [(a + b) / 2, CAVE.poolY - 1.5, CAVE.fall - 1], w: b - a, h: 6, seed: a });
  // the small fall at the deep end, into its basin
  {
    const f = INNER_FALL, w = f.z1 - f.z0;
    const g = put(fallSheet({ w, h: f.top, bow: 0.6 }), f.x + 1.5, 0, (f.z0 + f.z1) / 2, Math.PI / 2);
    const m = new THREE.Mesh(g, fallMat(kit, { speed: 6, column: 1.4, gaps: 0.1, mist: 4, height: f.top, seed: 9 }));
    m.name = 'The deep fall'; m.userData.noCollide = true; m.userData.waterfall = true;
    group.add(m); noShadow.push(m);
    mistBank(kit, { at: [f.x + 3, -0.4, (f.z0 + f.z1) / 2], w: w * 1.05, yaw: Math.PI / 2, h: 2.6, seed: 77 });
    for (const e of [-1, 1]) kit.add(M.wall, new THREE.BoxGeometry(12, 0.7, 0.6).translate(f.x + 6, 0.35, (f.z0 + f.z1) / 2 + e * (w / 2 + 1.5)), solid);
    kit.add(M.wall, new THREE.BoxGeometry(0.6, 0.7, w + 3.6).translate(f.x + 12, 0.35, (f.z0 + f.z1) / 2), solid);
    kit.mesh(new THREE.PlaneGeometry(11.4, w + 2.4).rotateX(-Math.PI / 2).translate(f.x + 6, 0.32, (f.z0 + f.z1) / 2),
      makeMaterial({ color: '#4fb3b0', color2: '#8fdcd2', mode: MODE_WATER, waterDepth: 0.35 }), { solid: false, shadow: false });
  }
  // the pool under the curtain (swim in it)
  kit.mesh(new THREE.PlaneGeometry(CAVE.x1 - CAVE.x0, CAVE.rim - CAVE.front).rotateX(-Math.PI / 2).translate((CAVE.x0 + CAVE.x1) / 2, CAVE.poolY, (CAVE.front + CAVE.rim) / 2),
    makeMaterial({ color: '#3fa8a8', color2: '#8fdcd2', mode: MODE_WATER, waterDepth: 4 }), { solid: false, shadow: false });
  yield;

  // ---------------------------------------------------------------- the promenade: parapet, bridges, balconies, quay
  const QUAY = { x0: -52, x1: -40, top: CAVE.poolY + 0.8 };
  const quayStair = { x: QUAY.x0, z: CAVE.front + 1.35, y0: QUAY.top, y1: 0 };
  const stairTop = quayStair.x - Math.round((quayStair.y1 - quayStair.y0) / 0.3) * 0.42;
  const gaps = [...BALCONIES.map((x) => [x - 1.7, x + 1.7]), [stairTop - 2.6, stairTop + 0.6]];
  terrace(kit, M, { x0: CAVE.x0, x1: CAVE.x1, z0: CAVE.front - 0.6, z1: CAVE.front, y: 0, below: 0, parapet: 0.95, gaps, wall: false });
  for (const bx of BALCONIES) {
    archBridge(kit, M, [bx, 0, CAVE.front], [bx, 0, 31], { w: 3.2, thick: 1 });
    kit.add(M.paving, new THREE.BoxGeometry(11, 1, 7).translate(bx, -0.5, 34.5), solid);
    for (const [w, d, x, z] of [[11, 0.5, bx, 37.75], [0.5, 7, bx - 5.25, 34.5], [0.5, 7, bx + 5.25, 34.5], [3.5, 0.5, bx - 3.5, 31.25], [3.5, 0.5, bx + 3.5, 31.25]])
      kit.add(M.wall, new THREE.BoxGeometry(w, 0.95, d).translate(x, 0.475, z), solid);
    kit.add(M.rock, put(rockMass(bx, 6, -CAVE.bed - 1, 6, { lump: 0.06 }), bx, (CAVE.bed - 1) / 2, 34.5, 0), solid);   // its pier
    lamp(kit, M, bx - 4.9, 1.6, 37.4, { post: true, r: 7 });
  }
  kit.add(M.paving, new THREE.BoxGeometry(QUAY.x1 - QUAY.x0, QUAY.top - CAVE.bed, 8).translate((QUAY.x0 + QUAY.x1) / 2, (QUAY.top + CAVE.bed) / 2, CAVE.front + 4), solid);
  stair(kit, M, { ...quayStair, w: 2.6, yaw: Math.PI / 2, side: false });
  // cafés by the parapet: a table, two stools, an umbrella; pots of plants between them
  const cafes = [];
  for (let x = CAVE.x0 + 20; x < CAVE.x1 - 6; x += 17 + rng() * 12) {
    if (gaps.some(([a, b]) => x > a - 5 && x < b + 5)) continue;
    const z = 17 + rng() * 2;
    if (rng() < 0.55) {
      cafes.push([x, z]);
      kit.add(M.iron, new THREE.CylinderGeometry(0.07, 0.1, 0.75, 6).translate(x, 0.37, z), solid);
      kit.add(M.stone[1], new THREE.CylinderGeometry(0.6, 0.6, 0.06, 12).translate(x, 0.76, z), solid);
      for (const e of [-1, 1]) kit.add(M.awning[Math.floor(rng() * 3)], new THREE.CylinderGeometry(0.25, 0.22, 0.45, 8).translate(x + e * 0.95, 0.22, z + (rng() - 0.5) * 0.3), solid);
      const a = M.awning[Math.floor(rng() * M.awning.length)];
      kit.add(M.iron, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4).translate(x, 1.2, z), { solid: false, shadow: true });
      kit.add(a, new THREE.ConeGeometry(1.5, 0.5, 10, 1, true).translate(x, 2.55, z), { solid: true, shadow: true });
    } else pottedPlant(kit, M, rng, x, 0, 20.8, 1 + rng() * 0.6);
  }
  yield;

  // ---------------------------------------------------------------- the city: the lower town, the deep quarter
  const lower = quarter(framed(kit, 0, 0, -10, 0), M, rng, { x0: -150, x1: 30, n: 6, rise: 6, step: 11, shrink: 3, lit: 0.42, people: 0, lamps: 0.55, pipes: 0.35, awning: 0.45, front0: false, stairEvery: 34 });
  yield;
  const deep = quarter(framed(kit, 0, 0, -10, 0), M, rng, { x0: -290, x1: -158, n: 6, rise: 6, step: 11, shrink: 3, lit: 0.75, people: 0, lamps: 0.9, pipes: 0.65, awning: 0.3, front0: false, stairEvery: 30 });
  yield;
  // copper pipes up the back wall of the deep quarter and across under the roof, and the plaza between the quarters
  for (let x = -290; x < -160; x += 22 + rng() * 10) {
    copperPipe(kit, M, [[x, 30, -76.2], [x, 92, -76.2], [x, 100, -70]], { r: 0.45 + rng() * 0.25, n: rng() < 0.5 ? 2 : 3, gap: 2.4, solid: true });
  }
  copperPipe(kit, M, [[-300, 96, -60], [-200, 98, -58], [-150, 96, -60]], { r: 0.8, n: 2, side: [0, 1, 0], gap: 2.4 });
  for (const [x, z] of [[-155, -6], [-153, 4], [-157, 12]]) lamp(kit, M, x, 3.6, z, { post: true, r: 9 });
  roundHouse(kit, M, rng, { x: 37, y: 0, z: -16, w: 6, d: 6, h: 4.5, kind: 'drum', lit: 0.5, awning: 1 });   // the house by the mouth
  roundHouse(kit, M, rng, { x: 36, y: 0, z: -4, w: 4.5, d: 4.5, h: 3.5, kind: 'block', lit: 0.5, awning: 0 });
  // the landing: a low wall along its south and east edges, lamps, pots
  for (const [w, d, x, z] of [[LANDING.x1 - LANDING.x0 - 12, 0.6, (LANDING.x0 + LANDING.x1) / 2 + 6, LANDING.z1 - 0.3], [0.6, LANDING.z1 - LANDING.z0, LANDING.x1 - 0.3, (LANDING.z0 + LANDING.z1) / 2]])
    kit.add(M.wall, new THREE.BoxGeometry(w, 1.0, d).translate(x, 0.5, z), solid);
  for (const [x, z] of [[60, 30], [60, -30], [100, 60], [180, 60]]) lamp(kit, M, x, 3.6, z, { post: true, r: 9 });
  for (const [x, z, s] of [[52, 40, 1.4], [56, 46, 1.1], [52, -40, 1.5], [200, -50, 1.6]]) pottedPlant(kit, M, rng, x, 0, z, s);
  yield;

  // ---------------------------------------------------------------- the valley far below, seen through the slits and from the landing
  {
    const g = new THREE.PlaneGeometry(5000, 3600, 110, 80).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), far = (z + 1800) / 3600;
      p.setY(i, (nV(x * 0.0022, z * 0.0022) * 70 + nV(x * 0.009, z * 0.009) * 9) * (0.3 + far * far * 2));
    }
    g.computeVertexNormals();
    const valley = new THREE.Mesh(g.translate(0, -230, 1880), makeMaterial({ mode: MODE_TERRAIN, color: '#e6d6a2', color2: '#d9c68e', color3: '#bba97e' }));
    valley.name = 'The valley'; valley.userData.noCollide = true;
    group.add(valley); noShadow.push(valley);
  }
  kit.finish();
  noShadow.push(...kit.noShadow);
  yield;

  // ---------------------------------------------------------------- spray: drops thrown up at the curtain's foot near you
  const SPRAY = 70;
  const spray = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0).scale(1, 1.3, 1), makeMaterial({ color: '#f4fbf8', flat: true, glow: 0.4, spot: 0, key: 'waterfall.spray' }), SPRAY);
  spray.name = 'Spray'; spray.frustumCulled = false; spray.userData.noCollide = true; spray.userData.dynamic = true;
  spray.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(spray); noShadow.push(spray);
  const drops = Array.from({ length: SPRAY }, () => ({ p: new THREE.Vector3(0, -999, 0), v: new THREE.Vector3(), age: 9, life: 1 }));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
  function updateSpray(dt, at) {
    const near = at && Math.abs(at.z - CAVE.fall) < 90 && at.x > CAVE.x0 - 20 && at.x < CAVE.x1 + 60;
    let n = 0;
    for (const d of drops) {
      d.age += dt;
      if (d.age > d.life && near) {   // a new drop, thrown up from the foot within 40 m of you
        const x = THREE.MathUtils.clamp(at.x + (Math.random() - 0.5) * 80, SHEETS[0][0], SHEETS.at(-1)[1]);
        if (SHEETS.some(([a, b]) => x > a && x < b)) {
          d.p.set(x, CAVE.poolY + 0.2, CAVE.fall - Math.random() * 3);
          d.v.set((Math.random() - 0.5) * 2, 3 + Math.random() * 6, -1 - Math.random() * 4);
          d.age = 0; d.life = 0.9 + Math.random() * 0.9;
        }
      }
      if (d.age > d.life) continue;
      d.v.y -= 9 * dt; d.p.addScaledVector(d.v, dt);
      const s = 0.07 + 0.05 * Math.sin(Math.PI * d.age / d.life);
      _s.set(s, s, s);
      spray.setMatrixAt(n++, _m.compose(d.p, _q, _s));
    }
    spray.count = n;
    spray.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the crowd's places
  const streets = [...lower.streets, ...deep.streets].filter((s) => s.y > 0).map((s) => ({ ...s, z0: s.z0 - 10, z1: s.z1 - 10 }));   // (the quarters' frame stands at z -10)
  yield;
  return {
    id: 'waterfall',
    ground: { heightAt: groundHeight },
    envGround: '#6f9f9f',
    spawn: new THREE.Vector3(108, 0.1, 2), spawnHeading: -Math.PI / 2, camYaw: Math.PI / 2, camPitch: 0.04,
    shipSite: { ...SHIP_SITE },
    features: { mount: false, wind: false, jetpack: true, climb: true },
    limit: 520, killY: -60,
    defaults: { hour: 10.5, preset: 'Moebius print', cloudShadows: 0, look: WATERFALL_WORLD_LOOK },
    sky: { script: { day: WATERFALL_DAY, dusk: WATERFALL_DUSK, night: WATERFALL_NIGHT } },
    lights: kit.lights, noShadow,
    reactions: false,   // (no responsive flowers or screens: reactive-world.js)
    // the sun comes in under the roof's lip from the south (the falls' side), lighting the promenade and the
    // lower terraces; it swings a little east to west through the day
    lightAt(p, dir) { if (dir.y > 0) dir.set(THREE.MathUtils.clamp(dir.x, -0.6, 0.6) * 0.6, 1.05, 1).normalize(); },
    atmo: (x, z, y) => ({ tint: [1, 1, 1], fog: x > CAVE.x1 + 4 ? 0.45 : 0.75, name: x > CAVE.x1 + 4 ? 'The landing' : z > CAVE.front ? 'Behind the falls' : x < -158 ? 'The deep quarter' : y > 4 ? 'The lower town' : 'The promenade' }),
    life: { motes: { count: 90, color: '#e6f7f2', size: 0.045, rise: 0.12, wind: [0.05, -0.35] } },
    roar: roarAt,
    waterfalls: [curtain],
    balconies: BALCONIES.map((x) => new THREE.Vector3(x, 0, 34.5)),
    streets,
    cafes,
    crowdLines: [
      '~neutral~ Mind the spray by the parapet. The stones there are always wet.',
      '~happy~ The light’s best at midday, when the sun comes in under the falls.',
      '~curious~ You came in from the landing? Nobody comes in from the landing.',
      '~whisper~ If you stand still on a balcony you can hear the valley through the water.',
      '~playful~ My grandmother says the falls stopped once. My grandmother says a lot of things.',
      '~tired~ Up and down these stairs all day, with a basket on my head.',
      '~neutral~ The pipes carry the falls’ water up to the top terraces. Every house has a tap.',
      '~solemn~ We light the lamps in the deep quarter all day. The sun never gets that far in.',
    ],
    crowdSpots() {
      const r = mulberry32(7121), V = (x, y, z) => new THREE.Vector3(x, y, z), size = () => 2 + Math.floor(r() * 3);
      const groups = [], walks = [], edges = [];
      for (const z of [2, 9]) walks.push({ path: [V(-290, 0, z), V(30, 0, z)], n: 12, pair: 0.4 });
      walks.push({ path: [V(30, 0, 6), V(70, 0, 8), V(96, 0, 30)], n: 3, pair: 0.3 });
      for (const s of streets) walks.push({ path: [V(s.x0 + 4, s.y, s.z1 - 2.6), V(s.x1 - 4, s.y, s.z1 - 2.6)], n: 2 + Math.floor((s.x1 - s.x0) / 60), pair: 0.3 });
      for (let x = -285; x < 25; x += 16 + r() * 14) if (r() < 0.6) groups.push({ at: V(x, 0, 4 + r() * 10), n: size() });
      for (const [x, z] of cafes) groups.push({ at: V(x + 1.6, 0, z - 1.6), n: 2 });
      for (let x = -300; x < 40; x += 9 + r() * 10) if (r() < 0.35 && !gaps.some(([a, b]) => x > a - 2 && x < b + 2)) edges.push({ at: V(x, 0, CAVE.front - 1.05), heading: 0, pose: 'rail' });
      for (const bx of BALCONIES) edges.push({ at: V(bx + 2, 0, 36.9), heading: 0, pose: 'rail' });
      for (const sp of [...groups, ...walks, ...edges]) sp.lines = this.crowdLines;
      return { groups, walks, edges, avoid: [], farMax: 260, costume: 'waterfall', palette: { cloaks: ['#c46b4e', '#4f7f86', '#d9a35e', '#7a6e9e', '#b5523e', '#e0c08a', '#5f8f7a', '#2f8a8f'] },
        clear: [{ x: 108, z: 2, r: 6 }, { x: SHIP_SITE.x, z: SHIP_SITE.z, r: 18 }] };
    },
    update(dt, t, ctx = {}) {
      for (const m of kit.movers) m(t);
      updateSpray(Math.min(dt, 0.05), ctx.player?.pos);
    },
  };
}
export const createWaterfall = stepped(buildWaterfall);
