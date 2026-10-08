import * as THREE from 'three';
import { createNoise2D, fbm, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit, put } from './lab-kit.js';

// ---------------------------------------------------------------------------
// The Lantern (?level=lantern; src/story/ending.js FINALE_ID): the last place, where the singing
// light comes from. Charted past the Signal Market once the first homecoming is over and the
// market's broadcast has been heard (finaleOpen). Ilen keeps it (src/story/lantern.js, lantern-data.js).
//
// One small island in a still, shallow sea of light at dusk, a big ringed planet low over it. A long
// sand bar runs from the landing flat in the south up to the island, its low places marked with
// flat stepping stones. On the island's crown stands the makers' lantern: a slim white tower, three
// dark round eyes and an arc below them near its top (the glyph), a gallery, and a glass crown that
// sings. At its foot Ilen's house: the top half of her own round ship (it never flew again), set on
// the grass with a door cut in it, a round window, the family stripe round it; a bench facing home;
// three raised beds of the yellow flowers her mother liked. Out on the island's point, two small
// stones: Odile and Talo, who kept the lantern before her.
//
// Layout (m; +z south): the ship on the flat at (0, 138), its hatch north; the bar north to the
// island (centre (0, -4), r 36); the lantern at (0, -12); the house west of it; the stones on the
// north-east point. Built with the Lab's room kit (lab-kit.js), merged per material.
// ---------------------------------------------------------------------------

const WATER = 0;
export const LANTERN = { x: 0, z: -12, foot: 1.4, shaft: 24 };
export const ISLE = { x: 0, z: -4, r: 36, top: 4.2 };
export const LANTERN_SHIP = { x: 0, z: 138, heading: Math.PI };
export const HOUSE = { x: -15, z: 2, r: 5.4 };
export const STONES = { x: 19, z: -24 };
export const BENCH = { x: -6, z: 13 };
/** Where Ilen waits at first: at the lantern's step, looking down the bar. */
export const ILEN_SPOT = { x: 2.6, z: -5.4 };
/** The colours: a peach dusk, a mint sea, lilac shade. */
export const LANTERN_TONES = {
  sea: '#7cc9c0', shallow: '#bfeadb', sand: '#f2d6aa', sand2: '#e9c391', grass: '#c9d48a',
  white: '#f7f1e4', ink: '#2b211f', stone: '#cdbfae', glass: '#fff2c2', cream: '#f3ead8', stripe: '#e6875f', teal: '#5fb7ad',
  wood: '#8a6a52', flower: '#f2c54b', leaf: '#6f9a5a', window: '#ffd27a',
};
export const LANTERN_SKY = {
  day: ['#6f8fd0', '#f6c6a2', '#8f9fd6', '#fff3e2', '#ffe0b4'],
  dusk: ['#4f6cb8', '#f4ad8e', '#7f8cc8', '#fff0dc', '#ffcf98'],
  night: ['#141c3e', '#3a3a70', '#3a4888', '#c8d0f0', '#f4e8d8'],
};
export const LANTERN_LOOK = { uClouds: 0, uCumulus: 0, uSkyDots: 0.25, uFogDensity: 0.0011, uHalftone: 0.1, uHazeLayers: [180, 1.8, 0.1, 4], uHazeTone: [0.96, 0.8, 0.74, 0.5] };

const noise = createNoise2D(61901), noiseB = createNoise2D(61902);
/** The bar's middle line (it wanders a little). */
const barX = (z) => Math.sin(z * 0.035) * 5;

/** The sea bed, the island, the bar and the landing flat; far shoals all round. */
export function lanternHeight(x, z) {
  let h = -2.2 + fbm(noise, x * 0.01, z * 0.01, 2) * 0.5;
  // the island: a soft dome to its crown
  const di = Math.hypot(x - ISLE.x, (z - ISLE.z) * 1.1);
  const dome = ISLE.top * Math.max(0, 1 - (di / ISLE.r) ** 2) + noiseB(x * 0.06, z * 0.06) * 0.15;
  h = Math.max(h, THREE.MathUtils.lerp(-2.2, 0.5 + dome, smoothstep(ISLE.r + 8, ISLE.r - 4, di)));
  // the bar, from the flat to the island's foot: just out of the water, dipping under it twice
  if (z > ISLE.z && z < LANTERN_SHIP.z + 30) {
    const d = Math.abs(x - barX(z));
    const top = 0.32 - 0.38 * Math.exp(-(((z - 62) / 9) ** 2)) - 0.36 * Math.exp(-(((z - 96) / 8) ** 2));
    h = Math.max(h, THREE.MathUtils.lerp(-2.2, top, smoothstep(9, 3.5, d)));
  }
  // the landing flat
  const dl = Math.hypot(x - LANTERN_SHIP.x, z - LANTERN_SHIP.z);
  h = Math.max(h, THREE.MathUtils.lerp(-2.2, 0.45, smoothstep(30, 20, dl)));
  // far shoals and low banks closing the world
  const r = Math.hypot(x, z - 40);
  h += smoothstep(300, 380, r) * (3 + fbm(noiseB, x * 0.006, z * 0.006, 3) * 4) + smoothstep(380, 520, r) * 26;
  return h;
}

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildLantern(scene) {
  const T = LANTERN_TONES;
  const terrain = yield* Terrain.make({
    size: 1100, seg: 300, height: lanternHeight,
    material: { color: T.sand, color2: T.grass, color3: T.sand2, mode: MODE_TERRAIN, ticks: true, ripples: true },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const group = new THREE.Group();
  group.name = 'The Lantern';
  scene.add(group);
  const kit = new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 61900 });
  const DS = THREE.DoubleSide;
  const M = {
    white: kit.mat({ color: T.white, shade: 0.35, hatch: 0.4 }),
    ink: kit.mat({ color: T.ink, flat: true }),
    stone: kit.mat({ color: T.stone, flat: true, hatch: 0.6 }),
    cream: kit.mat({ color: T.cream, shade: 0.35, hatch: 0.35 }),
    stripe: kit.mat({ color: T.stripe, flat: true }),
    teal: kit.mat({ color: T.teal, flat: true }),
    wood: kit.mat({ color: T.wood, flat: true, pattern: 'cracks' }),
    flower: kit.mat({ color: T.flower, flat: true, glow: 0.2 }),
    leaf: kit.mat({ color: T.leaf, flat: true }),
    window: kit.mat({ color: T.window, glow: 0.95, flat: true }),
    dark: kit.mat({ color: '#3a3f5c', flat: true }),
  };
  const lights = [];
  const LOOSE = { solid: false, shadow: false };

  // ---------------------------------------------------------- the sea of light
  yield;
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100, 1, 1).rotateX(-Math.PI / 2), makeMaterial({ color: T.sea, color2: T.shallow, mode: MODE_WATER }));
    water.position.y = WATER;
    water.userData.noCollide = true;
    scene.add(water);
  }

  // ---------------------------------------------------------- the makers' lantern
  yield;
  const L = LANTERN, base = H(L.x, L.z);
  kit.add(M.stone, put(new THREE.CylinderGeometry(4.4, 4.9, L.foot, 28), L.x, base + L.foot / 2 - 0.3, L.z));
  kit.add(M.stone, put(new THREE.CylinderGeometry(3.2, 3.6, 0.5, 28), L.x, base + L.foot + 0.0, L.z));
  const y0 = base + L.foot;
  kit.add(M.white, put(new THREE.CylinderGeometry(1.5, 2.5, L.shaft, 28, 6), L.x, y0 + L.shaft / 2, L.z));
  // a door at its foot, facing the bar, that nobody opens
  kit.add(M.dark, put(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 18, 1, false, 0, Math.PI).rotateX(Math.PI / 2), L.x, y0 + 1.1, L.z + 2.48));
  kit.add(M.dark, put(new THREE.BoxGeometry(1.6, 1.1, 0.2), L.x, y0 + 0.55, L.z + 2.48));
  // the glyph near the top, on all four sides: three round eyes, and an arc that bows up beneath them
  const gy = y0 + L.shaft - 4.2;
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, rr = 1.5 + (2.5 - 1.5) * (4.2 / L.shaft) - 0.02;
    const ox = Math.sin(a), oz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
    for (const s of [-1, 0, 1]) kit.add(M.ink, put(new THREE.SphereGeometry(0.22, 10, 8).scale(1, 1, 0.4), L.x + ox * rr + tx * s * 0.55, gy + 0.65, L.z + oz * rr + tz * s * 0.55, a), LOOSE);
    kit.add(M.ink, put(new THREE.TorusGeometry(0.75, 0.07, 6, 18, Math.PI), L.x + ox * (rr + 0.02), gy - 0.55, L.z + oz * (rr + 0.02), a), LOOSE);
  }
  // the gallery round the top, and the crown
  const top = y0 + L.shaft;
  kit.add(M.stone, put(new THREE.CylinderGeometry(2.6, 2.2, 0.35, 28), L.x, top, L.z));
  kit.add(M.ink, put(new THREE.TorusGeometry(2.55, 0.05, 6, 40).rotateX(Math.PI / 2), L.x, top + 0.9, L.z), LOOSE);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; kit.add(M.ink, put(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), L.x + Math.cos(a) * 2.55, top + 0.45, L.z + Math.sin(a) * 2.55), LOOSE); }
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.3; kit.add(M.white, put(new THREE.CylinderGeometry(0.12, 0.16, 3.0, 6), L.x + Math.cos(a) * 1.5, top + 1.6, L.z + Math.sin(a) * 1.5), LOOSE); }
  kit.add(M.white, put(new THREE.ConeGeometry(2.1, 1.6, 28), L.x, top + 3.9, L.z), LOOSE);
  kit.add(M.ink, put(new THREE.SphereGeometry(0.22, 10, 8), L.x, top + 4.85, L.z), LOOSE);
  // the crown's glass (its own mesh: it breathes, and sings), and a halo round it
  const crownMat = makeMaterial({ color: T.glass, glow: 1, flat: true, line: 0.3, lineTint: 1 });
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), crownMat);
  crown.position.set(L.x, top + 1.75, L.z); crown.userData.noCollide = true; group.add(crown);
  const haloMat = makeMaterial({ color: '#fff8dc', glow: 1, flat: true, side: DS });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.035, 6, 48).rotateX(Math.PI / 2), haloMat);
  halo.position.copy(crown.position); halo.userData.noCollide = true; group.add(halo);
  lights.push(new THREE.Vector4(L.x, top + 1.75, L.z, 34), new THREE.Vector4(L.x, y0 + 1.5, L.z + 3.2, 6));

  // ---------------------------------------------------------- Ilen's house: the top half of her round ship
  yield;
  const hb = H(HOUSE.x, HOUSE.z) - 0.2, R = HOUSE.r;
  kit.add(M.cream, put(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), HOUSE.x, hb, HOUSE.z));
  kit.add(M.stripe, put(new THREE.TorusGeometry(R * 0.985, 0.13, 6, 48).rotateX(Math.PI / 2), HOUSE.x, hb + 1.3, HOUSE.z), LOOSE);
  kit.add(M.teal, put(new THREE.TorusGeometry(R * 0.93, 0.08, 6, 48).rotateX(Math.PI / 2), HOUSE.x, hb + 2.0, HOUSE.z), LOOSE);
  // the door, toward the lantern (east); the round window toward home (south)
  const doorA = Math.atan2(L.x - HOUSE.x, L.z - HOUSE.z);
  const dx = Math.sin(doorA), dz = Math.cos(doorA);
  kit.add(M.dark, put(new THREE.BoxGeometry(1.4, 2.1, 0.5), HOUSE.x + dx * (R - 0.15), hb + 1.05, HOUSE.z + dz * (R - 0.15), doorA), LOOSE);
  kit.add(M.ink, put(new THREE.TorusGeometry(0.85, 0.06, 6, 24, Math.PI), HOUSE.x + dx * (R - 0.05), hb + 2.05, HOUSE.z + dz * (R - 0.05), doorA), LOOSE);
  const wa = 0.15, wx = Math.sin(wa), wz = Math.cos(wa), wy = hb + 2.6, wr = Math.sqrt(R * R - 2.6 * 2.6);
  kit.add(M.window, put(new THREE.CircleGeometry(0.7, 20), HOUSE.x + wx * (wr + 0.05), wy, HOUSE.z + wz * (wr + 0.05), wa, 1, -0.45), LOOSE);
  kit.add(M.ink, put(new THREE.TorusGeometry(0.72, 0.07, 6, 24), HOUSE.x + wx * (wr + 0.06), wy, HOUSE.z + wz * (wr + 0.06), wa, 1, -0.45), LOOSE);
  lights.push(new THREE.Vector4(HOUSE.x + wx * (wr + 1), wy, HOUSE.z + wz * (wr + 1), 6));
  // the hull's old hatch ring on top, and a little mast
  kit.add(M.ink, put(new THREE.TorusGeometry(1.0, 0.07, 6, 24).rotateX(Math.PI / 2), HOUSE.x, hb + R - 0.08, HOUSE.z), LOOSE);
  kit.add(M.ink, put(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), HOUSE.x + 0.4, hb + R + 1.0, HOUSE.z), LOOSE);
  // the garden: three raised beds of yellow flowers, between the house and the bar
  for (const [k, [x, z]] of [[-9, 10], [-12.5, 11.5], [-16, 12]].entries()) {
    const y = H(x, z);
    kit.add(M.wood, put(new THREE.BoxGeometry(2.6, 0.45, 1.1), x, y + 0.2, z, 0.2 + k * 0.1));
    for (let i = 0; i < 7; i++) {
      const fx = x + (i - 3) * 0.33, fz = z + ((i * 37) % 5 - 2) * 0.12;
      kit.add(M.leaf, put(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), fx, y + 0.6, fz), LOOSE);
      kit.add(M.flower, put(new THREE.SphereGeometry(0.11, 8, 6).scale(1, 0.6, 1), fx, y + 0.8, fz), LOOSE);
    }
  }
  // the bench, facing south: home is that way
  {
    const y = H(BENCH.x, BENCH.z);
    kit.add(M.wood, put(new THREE.BoxGeometry(2.2, 0.12, 0.55), BENCH.x, y + 0.48, BENCH.z));
    for (const s of [-0.9, 0.9]) kit.add(M.wood, put(new THREE.BoxGeometry(0.12, 0.48, 0.5), BENCH.x + s, y + 0.24, BENCH.z));
  }

  // ---------------------------------------------------------- Odile and Talo, on the point
  yield;
  for (const [k, s] of [[0, 1], [1, 0.9]]) {
    const x = STONES.x + k * 1.6, z = STONES.z - k * 0.5, y = H(x, z);
    kit.add(M.stone, put(new THREE.BoxGeometry(0.9 * s, 1.0 * s, 0.28), x, y + 0.45 * s, z, -0.6));
    kit.add(M.stone, put(new THREE.CylinderGeometry(0.45 * s, 0.45 * s, 0.28, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), x, y + 0.95 * s, z, -0.6));
    kit.add(M.ink, put(new THREE.TorusGeometry(0.16, 0.025, 5, 16), x + Math.sin(-0.6) * 0.15, y + 0.7 * s, z + Math.cos(-0.6) * 0.15, -0.6), LOOSE);
  }
  // a little saucer's lamp, set between them (from the escape pod in the deep wood)
  kit.add(M.window, put(new THREE.SphereGeometry(0.16, 10, 8).scale(1, 0.5, 1), STONES.x + 0.8, H(STONES.x + 0.8, STONES.z + 0.3) + 0.12, STONES.z + 0.3), LOOSE);
  lights.push(new THREE.Vector4(STONES.x + 0.8, H(STONES.x, STONES.z) + 0.6, STONES.z + 0.3, 3));

  // ---------------------------------------------------------- the stepping stones where the bar dips, and a few rocks
  yield;
  for (let z = 50; z < 110; z += 2.4) {
    const hz = lanternHeight(barX(z), z);
    if (hz > 0.12) continue;
    const x = barX(z) + Math.sin(z * 1.7) * 0.6;
    kit.add(M.stone, put(new THREE.CylinderGeometry(0.85, 0.95, 0.5 - hz, 9), x, hz + (0.5 - hz) / 2 - 0.05 + 0.1, z, z));
  }
  for (const [x, z, s] of [[12, 30, 1.2], [-11, 44, 0.8], [26, -2, 1.5], [-30, -14, 1.1], [8, 120, 0.9], [-14, 128, 1.3]]) {
    const g = new THREE.DodecahedronGeometry(s, 0);
    kit.add(M.stone, put(g, x, H(x, z) + s * 0.3, z, x));
  }
  kit.finish();

  // the breathing crown: the light comes and goes, a little, as if it is singing
  const movers = [(t) => {
    const k = 0.5 + 0.5 * Math.sin(t * 1.3) * Math.sin(t * 0.47 + 1);
    crown.scale.setScalar(1 + k * 0.06);
    halo.rotation.y = t * 0.2; halo.scale.setScalar(1 + k * 0.1);
  }];

  const spawn = new THREE.Vector3(LANTERN_SHIP.x, 0, LANTERN_SHIP.z - 20);
  spawn.y = H(spawn.x, spawn.z);
  const V = (x, z, dy = 0) => new THREE.Vector3(x, H(x, z) + dy, z);
  return {
    id: 'lantern',
    ground: terrain,
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: 300,
    edgeHint: 'The sea of light goes on, shallow and still. There is nothing else out there.',
    shipSite: { ...LANTERN_SHIP },
    features: { mount: false, wind: false, jetpack: false, climb: true },   // (one small island: on foot)
    defaults: { hour: 17.3, preset: 'Moebius print', cloudShadows: 0, look: LANTERN_LOOK },
    sky: { script: LANTERN_SKY, planets: [{ az: 135, el: 16, size: 7, color: '#f4dcc8', craters: false, ring: 0.28 }, { az: 210, el: 34, size: 1.1, color: '#e6e8f6', craters: true }] },
    killY: -Infinity,
    lights,
    noShadow: kit.noShadow,
    reactions: false,
    // what the story uses (src/story/lantern.js)
    lantern: {
      crown, halo, top: crown.position.clone(),
      spots: {
        ilen: V(ILEN_SPOT.x, ILEN_SPOT.z), step: V(L.x, L.z + 4.6), house: V(HOUSE.x + dx * (R + 1.2), HOUSE.z + dz * (R + 1.2)),
        bench: V(BENCH.x, BENCH.z), stones: V(STONES.x + 0.8, STONES.z + 1.6), isle: V(0, 26), bar: V(barX(80), 80),
      },
    },
    life: {
      motes: { count: 220, color: '#fff0c0', size: 0.05, glow: 1, rise: 0.04, wind: [0.05, 0.03] },
      flocks: [{ count: 7, color: '#3a4470', size: 0.7, radius: 60, height: [14, 36], speed: 0.25, seed: 19 }],
    },
    atmo: () => ({ tint: [1, 0.99, 0.98], fog: 0.8, name: 'The Lantern' }),
    update(dt, t) { for (const m of movers) m(t); },
  };
}
export const createLantern = stepped(buildLantern);

/** The world's content (src/levels/content.js): the page, no relics; Ilen comes with the story (src/story/lantern.js). */
export const LANTERN_CONTENT = {
  weather: [],
  story: {
    title: 'WE HEARD YOU',
    intro: 'Past the Signal Market, on no chart: one small island in a still sea, and a white tower with a light in its crown that sings.',
    outro: 'The light was an answer. Ilen heard him, thirty years late, and sent it home. Now she is coming home herself.',
    label: 'the lantern', goal: [LANTERN.x, 'ground', LANTERN.z + 5], radius: 6, manual: true,
  },
  relics: { spots: [], names: [] },
  npcs: [],
};
