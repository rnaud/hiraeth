import * as THREE from 'three';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { MODE_TERRAIN } from '../materials.js';
import { Terrain } from '../world.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { eclipseScript } from '../eclipse.js';
import { PEOPLE as EDENA_PEOPLE } from '../story/edena-data.js';
import { PEOPLE as SKY_STONES_PEOPLE } from '../story/arzach2-data.js';
import { PEOPLE as BURIED_PEOPLE } from '../story/buried-data.js';
import {
  eclipseMats, house, doorway, terrace, stairFlight, table, lantern, resident, awning, poleCloth, flowerBox, paleFigure, laundry, farQuarter, antennaPole,
  ECLIPSE_LOOK, ECLIPSE_TOTAL, ECLIPSE_SKY, ECL_TONES, LAMP_TINT,
} from './eclipse-kit.js';

// ---------------------------------------------------------------------------
// The City During the Eclipse: a city of limewashed houses, domes and round towers on terraces round great
// stairs, at midday under a total eclipse (references/levels/The City During the Eclipse/; its views in the
// References, reference-eclipse.js; the shapes and the look in eclipse-kit.js; the sky by the hour in
// src/eclipse.js). The moon's black disc and its corona hang over the roofs, a band of rose light runs all
// round the horizon, and the city has lit its lamps at noon: people eat outside at tables by lantern light,
// pale figures lean out from the walls and hang over the parapets. Off the route: no story to follow, a few
// people to meet.
//
// The layout (north is -z): the ship lands on the esplanade south of the city's gate. Through the gate, the
// Lantern Square (y 0): the great west wall with its terraces of houses over the tables, the round tower and
// the street of lit doors on the east. The Great Stair climbs north from the square to the upper city (y 6):
// the bowl, a square under tiers of terraces climbing north to the eclipse house at the top; the great dome on
// its east; on its west the overlook, its parapet over the lower city spread on the plain to the horizon.
// The city stands on its walls over the plain (y -22): climb back up them if you jump.
// ---------------------------------------------------------------------------

const T = ECL_TONES;
/** The city's levels (m): the plain round it, the lower square, the upper city, the bowl's tiers. */
export const LEVEL = { plain: -22, low: 0, high: 6, tier: 1.8, tiers: 6 };
/** Where the city's walls stand: its outline (x ±W, z from N to S), the step between the lower and the upper city (z STEP). */
export const BOUNDS = { W: 58, N: -178, S: 130, STEP: -44 };
export const SHIP_SITE = { x: 0, z: 96 };
/** The Great Stair: its foot on the square, its head at the upper city's edge. */
export const STAIR = { x: 0, z: -29.6, w: 8, rise: 0.25, run: 0.6 };
/** The bowl: its square (x ±X, z from Z0 to Z1) and its tiers climbing north from Z1, D deep each. */
export const BOWL = { X: 30, Z0: -48, Z1: -92, D: 6 };
/** The west wall's terraces over the square: their fronts (x), their heights; the side stair up them. */
export const WEST = { x1: -16, y1: 5.6, x2: -24, y2: 10.4, front2: 26, stairX: -13.4, stairZ: 21, stair2X: -30 };
const noise = createNoise2D(61201), noiseB = createNoise2D(61202);

const inCity = (x, z, m = 0) => Math.abs(x) < BOUNDS.W - m && z > BOUNDS.N + m && z < BOUNDS.S - m;
/** The ground: the city's two levels inside its walls (the step hidden in the wall between them), the plain below round it. */
function height(x, z) {
  if (inCity(x, z)) return z > BOUNDS.STEP - 1 ? LEVEL.low : z < BOUNDS.STEP - 6 ? LEVEL.high : LEVEL.low + (LEVEL.high - LEVEL.low) * smoothstep(BOUNDS.STEP - 1, BOUNDS.STEP - 6, z);
  // the plain: barely rolling, rising to low hills far off
  const r = Math.hypot(x, z + 40);
  return LEVEL.plain + 0.6 * fbm(noise, x * 0.01, z * 0.01, 2) + smoothstep(420, 620, r) * (14 + 10 * fbm(noiseB, x * 0.004, z * 0.004, 3));
}

export const ECLIPSE_CONTENT = {
  weather: [],
  // no story to follow: the page names the place and closes at the top of the bowl
  story: {
    title: 'THE CITY DURING THE ECLIPSE',
    intro: 'It is midday, and the moon has covered the sun. The city has lit its lamps and gone out to eat in the squares. The Great Stair climbs north to the upper city.',
    outro: 'From the top of the bowl the whole city shows under the black sun: the lamps on every terrace, the pale figures on the walls, and the far city lit all the way to the rose edge of the sky.',
    label: 'the top of the bowl', goal: [0, LEVEL.high + LEVEL.tier * LEVEL.tiers, BOWL.Z1 - BOWL.D * LEVEL.tiers - 6], radius: 9, verticalRadius: 4, manual: true,
  },
  relics: { spots: [], names: [] },
  // three people from elsewhere who came for the eclipse, and the city's own folk at their tables
  npcs: [
    { ...EDENA_PEOPLE.mira, at: [-9, 6], radius: 2, world: 'edena', lang: 'edena',
      lines: ['~whisper~ My water clock says it is noon. The sky says it is midnight. I am staying out of it.', '~curious~ Look up. Not at it! Beside it. There, the light like hair.'],
      talk: { listen: [
        '~happy~ Mira, who keeps the water clock. I carried it all the way here to see what it does in the dark at noon.',
        '~curious~ It keeps running. The drops don’t care that the sun is covered. I find that comforting, and a little rude.',
        '~whisper~ The people here eat outside whenever it happens. They say a meal in the eclipse keeps you through the year.',
        '~playful~ They offered me soup. I said I had come to measure the dark, not eat in it. Then I had two bowls.',
        { after: 'met.mira', say: '~neutral~ Still noon. Go up the Great Stair and look back at the square. All those little lamps.' },
      ] } },
    { ...SKY_STONES_PEOPLE.ysolde, at: [-6, BOWL.Z0 - 14], y: LEVEL.high, radius: 2, world: 'arzach2', lang: 'arzach2',
      lines: ['~solemn~ I write a letter at every eclipse. To no one. The dark reads it.', '~neutral~ Sit, child. It does not last, and it does not hurry.'],
      talk: { listen: [
        '~neutral~ Mother Ysolde. I came down from the stones for this. The cloud lets us see nothing so plain.',
        '~solemn~ The pale ones on the walls? The city makes them for the eclipse. They lean out to look up, so the living don’t have to stare.',
        '~curious~ Every tier of the bowl lights one lamp more than the tier below. Count them, if your eyes will let you.',
        '~whisper~ When the sun comes back they take the figures in. Nobody watches them do it.',
      ] } },
    { ...BURIED_PEOPLE.wen, at: [-BOUNDS.W + 3.5, -92.5], y: LEVEL.high, radius: 2, world: 'buried', lang: 'buried',
      lines: ['~curious~ I count windows now. Two thousand and something lit, out there. I keep losing the something.', '~happy~ Down under the sand we never had a sky to lose.'],
      talk: { listen: [
        '~neutral~ Wen, who counts the teeth. Out here there are no teeth, so I count the lamps of the lower city.',
        '~curious~ The whole plain lights up when the moon goes over. Every house, all at once, as if somebody said a word.',
        '~playful~ I asked the woman at the tables how long it lasts. She said: as long as dinner.',
      ] } },
    // the city's own folk
    { at: [10, 2], radius: 3, lang: 'desert', lines: ['~happy~ Sit anywhere! Nobody owns a table at the eclipse.', '~whisper~ Don’t look straight at it. Look at the lamps instead. They’re ours.'] },
    { at: [-6, -22], radius: 3, lang: 'desert', lines: ['~curious~ You came by the sky? Today of all days. It is closed.', '~playful~ The Great Stair has forty steps by day and forty-one in the dark. Count them.'] },
    // (Ansel: the detour's trace, src/story/sightings-detours.js)
    { id: 'ansel', name: 'Ansel', title: 'whose grandmother made the figure', color: '#9a8cc8', kind: 'm', at: [12, BOWL.Z0 - 20], y: LEVEL.high, radius: 3, lang: 'desert',
      lines: ['~solemn~ My grandmother made the figure on our wall. It leans a little more each year.', '~neutral~ Up the bowl, at the top, the old house sees the whole sky.'],
      talk: { listen: [
        { after: () => true, say: [
          '~solemn~ The night the sky rang, a light came over the roofs singing, and stopped where the black sun sits at noon.',
          '~curious~ It hung there a long while, the way you stand at a door you aren’t sure of.',
          '~whisper~ By morning every figure on the walls leaned the way it went. They lean that way still.',
        ], do: { set: { 'sight.eclipse.ansel': true } } },
        '~solemn~ My grandmother made the figure on our wall. It leans a little more each year.',
        '~neutral~ Up the bowl, at the top, the old house sees the whole sky.',
      ] } },
    { at: [BOUNDS.W - 6, -112], y: LEVEL.high, radius: 3, lang: 'desert', lines: ['~tired~ All night cooking for one hour of dark. Worth it.', '~happy~ The far city answers us. See? Every lamp out there is somebody eating.'] },
    { at: [4, 70], radius: 3, lang: 'desert', lines: ['~curious~ A ship! Did you fly through the dark to get here?', '~neutral~ The gate is open. The whole city is in the square.'] },
  ],
};

/** What the city's crowd says (crowd.js), toned. */
export const CROWD_LINES = [
  '~whisper~ Don’t stare at it. The figures do the staring for us.',
  '~happy~ More bread at this end! It’s still dark!',
  '~curious~ Is it longer than last time? It feels longer.',
  '~neutral~ Listen. The birds have stopped. They think it is night.',
  '~playful~ My lamp’s brighter than yours. It’s the eclipse, everything counts.',
  '~solemn~ When it ends, we put the lamps out together. All of them at once.',
];

/** The level's colours by the hour: a pale blue day over a white city, the light dimming as the moon comes, totality at noon, a rose dusk, an indigo night. */
export const ECLIPSE_PALETTES = {
  day: ['#6a96d4', '#cddcf0', '#8a8cc6', '#fbf8ff', '#fff4e0'],
  dim: ['#3e5c9c', '#8aa0d0', '#5e5c9a', '#c8c2ee', '#fff0dc'],
  total: ECLIPSE_TOTAL,
  dusk: ['#4a5a98', '#e8a8a8', '#7a6aa8', '#ffd8c8', '#ffc8a0'],
  night: ['#0e1636', '#283668', '#2e3470', '#9aa2dc', '#f0ece0'],
};
export const ECLIPSE_SCRIPT = eclipseScript(ECLIPSE_PALETTES, ECLIPSE_SKY);

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildEclipse(scene) {
  const rng = mulberry32(61200);
  const terrain = yield* Terrain.make({
    size: 1300, seg: 260, height,   // (5 m cells: the step between the levels falls inside the wall between them)
    material: { color: T.paving, color2: '#dcdcf0', color3: '#d6d4ec', mode: MODE_TERRAIN, grid: 3.2, lampTint: LAMP_TINT },
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const group = new THREE.Group();
  group.name = 'The City During the Eclipse';
  scene.add(group);
  const kit = new RoomKit({ group, ground: terrain, centre: new THREE.Vector3(), seed: 61200 });
  const M = eclipseMats(kit);
  const SOLID = { solid: true, shadow: true }, NC = { solid: false, shadow: false };
  const { low: Y0, high: Y1 } = LEVEL;

  // ---------------------------------------------------------- the city's walls over the plain, the step between its levels
  {
    const top = (z) => (z > BOUNDS.STEP ? Y0 : Y1), P = 1.25;
    const wall = (x0, x1, z0, z1, y) => {
      kit.add(M.masonry, new THREE.BoxGeometry(x1 - x0, y - 0.05 - LEVEL.plain + 2, z1 - z0).translate((x0 + x1) / 2, (y - 0.05 + LEVEL.plain - 2) / 2, (z0 + z1) / 2), SOLID);
    };
    const para = (x0, x1, z0, z1, y) => kit.add(M.stone, new THREE.BoxGeometry(x1 - x0, P, z1 - z0).translate((x0 + x1) / 2, y + P / 2, (z0 + z1) / 2), SOLID);
    const W = BOUNDS.W;
    for (const e of [-1, 1]) {
      const x0 = e < 0 ? -W - 4 : W, x1 = e < 0 ? -W : W + 4;
      wall(x0, x1, BOUNDS.STEP, BOUNDS.S, Y0); wall(x0, x1, BOUNDS.N, BOUNDS.STEP, Y1);
      para(e < 0 ? -W : W - 0.6, e < 0 ? -W + 0.6 : W, BOUNDS.STEP, BOUNDS.S, Y0); para(e < 0 ? -W : W - 0.6, e < 0 ? -W + 0.6 : W, BOUNDS.N, BOUNDS.STEP, Y1);
    }
    wall(-W - 4, W + 4, BOUNDS.S, BOUNDS.S + 4, Y0); para(-W, W, BOUNDS.S - 0.6, BOUNDS.S, Y0);
    wall(-W - 4, W + 4, BOUNDS.N - 4, BOUNDS.N, Y1); para(-W, W, BOUNDS.N, BOUNDS.N + 0.6, Y1);
    // the step: the upper city's front wall along the square's north side (the Great Stair in front of it)
    kit.add(M.masonry, new THREE.BoxGeometry(2 * W, Y1 - 0.4 + 1, 7).translate(0, (Y1 - 0.4 - 1) / 2, BOUNDS.STEP - 3.5), SOLID);
    kit.add(M.paving, new THREE.BoxGeometry(2 * W, 0.4, 7).translate(0, Y1 - 0.2, BOUNDS.STEP - 3.5), SOLID);
    for (const [a, b] of [[-W, -STAIR.w / 2 - 0.6], [STAIR.w / 2 + 0.6, W]]) para(a, b, BOUNDS.STEP - 0.6, BOUNDS.STEP, Y1);
    void top;
  }
  yield;

  // ---------------------------------------------------------- the gate between the esplanade and the square
  const GATE = { z: 44, half: 9 };
  {
    for (const e of [-1, 1]) {
      kit.add(M.lime[1], new THREE.BoxGeometry(BOUNDS.W - GATE.half - 4, 5.5, 3).translate(e * (GATE.half + 4 + (BOUNDS.W - GATE.half - 4) / 2), 2.75, GATE.z), SOLID);
      house(kit, M, rng, { x: e * (GATE.half + 2.5), y: Y0, z: GATE.z, w: 6, h: 9, kind: 'tower', roof: 'dome', k: 0.9, doors: 0, windows: 2, lit: 0.6, mat: 'tower' });
      lantern(kit, M, e * (GATE.half - 0.6), 0, GATE.z + 3.2, { kind: 'post', h: 3 });
      lantern(kit, M, e * (GATE.half - 0.6), 0, GATE.z - 3.2, { kind: 'post', h: 3 });
    }
    // the esplanade's lamps and a few figures waiting by the gate
    for (let z = 58; z < 124; z += 14) for (const e of [-1, 1]) lantern(kit, M, e * 16, 0, z, { kind: 'post', h: 3.2, r: 8 });
    paleFigure(kit, M, rng, -GATE.half - 2.5, 9.5, GATE.z + 3, { pose: 'hang', yaw: 0, s: 1.1, detail: 0.7 });
    paleFigure(kit, M, rng, GATE.half + 2.5, 9.5, GATE.z + 3, { pose: 'hang', yaw: 0, s: 1.1, detail: 0.7 });
  }
  yield;

  // ---------------------------------------------------------- the Lantern Square: the west wall's terraces
  {
    const z0 = BOUNDS.STEP - 1, z1 = GATE.z - 1.5;
    terrace(kit, M, { x0: -BOUNDS.W, x1: WEST.x1, z0, z1, y: WEST.y1, below: Y0 - 0.5, parapet: 1, gaps: [], sides: false });
    terrace(kit, M, { x0: -BOUNDS.W, x1: WEST.x2, z0, z1: WEST.front2, y: WEST.y2, below: WEST.y1, parapet: 1, gaps: [[WEST.stair2X - 1.5, WEST.stair2X + 1.5]] });
    // its front faces the square (east): a parapet along it, open where the side stair comes up from the square
    // (the stair along the wall's foot climbing south to a landing, then onto the terrace)
    const S1 = stairFlight(kit, M, { x: WEST.stairX, z: WEST.stairZ, y0: Y0, y1: WEST.y1, w: 2.6, yaw: Math.PI, rise: 0.24, run: 0.4, cheeks: [true, false], cheek: 0.9 });
    const l0 = S1.top[2], l1 = l0 + 3.2;
    kit.add(M.paving, new THREE.BoxGeometry(WEST.stairX + 1.3 - WEST.x1 + 0.4, WEST.y1 + 0.5, l1 - l0).translate((WEST.x1 + WEST.stairX + 1.3) / 2 - 0.2, (WEST.y1 - 0.5) / 2, (l0 + l1) / 2), SOLID);
    kit.add(M.stone, new THREE.BoxGeometry(0.6, 1, l1 - l0).translate(WEST.stairX + 1.6, WEST.y1 + 0.5, (l0 + l1) / 2), SOLID);
    kit.add(M.stone, new THREE.BoxGeometry(0.6, 1, l0 - z0).translate(WEST.x1 + 0.3, WEST.y1 + 0.5, (z0 + l0) / 2), SOLID);
    kit.add(M.stone, new THREE.BoxGeometry(0.6, 1, z1 - l1).translate(WEST.x1 + 0.3, WEST.y1 + 0.5, (l1 + z1) / 2), SOLID);
    kit.add(M.stone, new THREE.BoxGeometry(0.6, 1, WEST.front2 - z0).translate(WEST.x2 + 0.3, WEST.y2 + 0.5, (z0 + WEST.front2) / 2), SOLID);
    WEST.landing = [l0, l1];
    // and from the first terrace a second flight, up to the upper one's front
    stairFlight(kit, M, { x: WEST.stair2X, z: WEST.front2 + (WEST.y2 - WEST.y1) / 0.24 * 0.4, y0: WEST.y1, y1: WEST.y2, w: 2.4, rise: 0.24, run: 0.4, cheek: 0.9 });
    // houses on the terraces, their fronts to the square
    const E = -Math.PI / 2 + Math.PI;   // (facing +x: the square)
    for (const [z, w, h, kind, roof] of [[30, 6, 4, 'block', 'flat'], [20, 7, 4.5, 'block', 'dome'], [6, 6, 3.6, 'block', 'flat'], [-6, 8, 5, 'drum', 'dome'], [-20, 6, 4, 'block', 'flat'], [-32, 7, 4.2, 'block', 'dome']]) {
      yield;
      house(kit, M, rng, { x: WEST.x1 - 1.6 - w / 2 - 0.4, y: WEST.y1, z, w, d: w, h, kind, roof, yaw: E, doors: 1, windows: 2, lit: 0.55, detail: 0.7, flowers: 0.6 });
    }
    for (const [z, w, h, kind] of [[12, 9, 6, 'drum'], [-4, 7, 5, 'block'], [-18, 10, 7, 'drum'], [-34, 7, 5, 'block']]) {
      yield;
      house(kit, M, rng, { x: WEST.x2 - 1.4 - w / 2, y: WEST.y2, z, w, d: w, h, kind, roof: 'dome', k: 0.75, yaw: E, doors: kind === 'block' ? 1 : 0, windows: 2, lit: 0.5, detail: 0.7 });
    }
    // behind, the roofs going back to the wall: drawn as the far city's small houses
    farQuarter(kit, M, rng, { x0: -BOUNDS.W + 3, x1: WEST.x2 - 12, z0: z0 + 2, z1: 18, n: 26, y: WEST.y2, size: [5, 9], tall: [3, 6], lit: 0.4, domes: 0.5, solid: true });
    // under the wall: the tables, the lamps hung on it, the pale figures leaning out over the diners
    for (let z = 34; z > BOUNDS.STEP + 4; z -= 5.5) {
      if (z > WEST.stairZ - 2 && z < WEST.landing[1] + 2) continue;
      table(kit, M, rng, WEST.x1 + 2.6, Y0, z, { yaw: Math.PI / 2, seats: 2 + Math.floor(rng() * 3) });
      if (rng() < 0.7) lantern(kit, M, WEST.x1 + 0.6, 2.4, z - 2.6, { kind: 'hang', yaw: Math.PI / 2 });
    }
    for (let z = 30; z > BOUNDS.STEP + 6; z -= 7 + rng() * 5) paleFigure(kit, M, rng, WEST.x1 - 0.2, 2.8 + rng() * 1.2, z, { pose: 'lean', yaw: Math.PI / 2, s: 1.1 + rng() * 0.3, detail: 0.7 });
    for (let z = 26; z > BOUNDS.STEP + 6; z -= 9 + rng() * 6) paleFigure(kit, M, rng, WEST.x1 - 0.2, WEST.y1 + 1, z, { pose: 'hang', yaw: Math.PI / 2, s: 1, detail: 0.7 });
    for (let z = 16; z > BOUNDS.STEP + 6; z -= 11) paleFigure(kit, M, rng, WEST.x2 - 0.2, WEST.y2 + 1, z, { pose: 'hang', yaw: Math.PI / 2, s: 0.9, detail: 0.7 });
    for (let z = 32; z > BOUNDS.STEP + 4; z -= 9) flowerBox(kit, M, rng, WEST.x1 - 0.4, WEST.y1 + 1, z, { w: 3, yaw: Math.PI / 2, detail: 0.7 });
    awning(kit, M, rng, [WEST.x1 + 0.1, 3.4, 18], [WEST.x1 + 0.1, 3.4, 10], { out: 2.6, drop: 0.8, n: [1, 0] });
    awning(kit, M, rng, [WEST.x1 + 0.1, 3.4, -8], [WEST.x1 + 0.1, 3.4, -16], { out: 2.6, drop: 0.8, n: [1, 0] });
    laundry(kit, M, rng, [WEST.x1 + 0.2, 4.6, 2], [WEST.x1 + 0.2, 4.9, -6], { n: 4 });
    poleCloth(kit, M, rng, [WEST.x1 - 3, WEST.y1, 0], [WEST.x1 - 8, WEST.y1, -12], { h: 3.6, sag: 1.2 });
    poleCloth(kit, M, rng, [WEST.x2 - 3, WEST.y2, 4], [WEST.x2 - 6, WEST.y2, -10], { h: 3.6, sag: 1.2 });
  }
  yield;

  // ---------------------------------------------------------- the Lantern Square: the east side, the round tower, the street of lit doors
  {
    const W = -Math.PI / 2;   // (facing -x: the square)
    house(kit, M, rng, { x: 24, y: Y0, z: -24, w: 15, h: 11, kind: 'tower', roof: 'flat', doors: 1, windows: 4, lit: 0.6, flowers: 1, mat: 'tower', detail: 0.8 });
    terrace(kit, M, { x0: 30, x1: BOUNDS.W, z0: BOUNDS.STEP - 1, z1: -12, y: 4.4, below: Y0 - 0.5, parapet: 1 });
    house(kit, M, rng, { x: 44, y: 4.4, z: -30, w: 14, d: 12, h: 8, kind: 'block', roof: 'dome', k: 0.75, doors: 1, windows: 3, detail: 0.8 });
    for (const [z, w, h, roof] of [[36, 7, 5, 'flat'], [26, 8, 6, 'dome'], [16, 7, 4.6, 'flat'], [6, 8, 7, 'flat'], [-4, 7, 5, 'dome']]) {
      yield;
      house(kit, M, rng, { x: 16 + w / 2, y: Y0, z, w, d: 8, h, kind: 'block', roof, yaw: W, doors: 2, windows: 2, lit: 0.7, wood: 0.2, detail: 0.7, flowers: 0.6, antenna: 0.4 });
      table(kit, M, rng, 13, Y0, z - 1, { yaw: -Math.PI / 2, seats: 2 + Math.floor(rng() * 3) });
      if (rng() < 0.6) lantern(kit, M, 15.6, 2.6, z + 2.6, { kind: 'hang', yaw: W });
    }
    farQuarter(kit, M, rng, { x0: 28, x1: BOUNDS.W - 3, z0: -8, z1: 40, n: 22, y: Y0, size: [6, 10], tall: [5, 9], lit: 0.45, domes: 0.5, solid: true });
    awning(kit, M, rng, [15.9, 3.6, 30], [15.9, 3.6, 22], { out: 3, drop: 0.9, n: [-1, 0] });
    awning(kit, M, rng, [15.9, 3.6, 10], [15.9, 3.6, 2], { out: 3, drop: 0.9, n: [-1, 0] });
    laundry(kit, M, rng, [16.2, 5.2, 20], [16.2, 5.4, 12], { n: 4 });
    for (const z of [32, 12, -2]) flowerBox(kit, M, rng, 17, 7.2, z, { w: 3, yaw: W, detail: 0.7 });
    paleFigure(kit, M, rng, 16.6, 11, -24, { pose: 'hang', yaw: -Math.PI / 2 - 0.4, detail: 0.7 });
  }
  yield;

  // ---------------------------------------------------------- the square's middle: rows of tables, the lamps, a figure on its plinth
  {
    for (let z = 30; z > -18; z -= 7) for (const x of [-4, 4]) {
      if (Math.abs(z - 9) < 4) continue;
      table(kit, M, rng, x + (rng() - 0.5), Y0, z + (rng() - 0.5), { yaw: (rng() - 0.5) * 0.3, w: 2.6, seats: 3 + Math.floor(rng() * 4), r: 7 });
    }
    kit.add(M.stone, new THREE.CylinderGeometry(1.4, 1.6, 1.2, 12).translate(0, 0.6, 9), SOLID);
    paleFigure(kit, M, rng, 0, 1.2, 9, { pose: 'stand', yaw: Math.PI, s: 1.3, detail: 0.8 });
    for (const [x, z] of [[-10, 38], [10, 38], [-10, -26], [10, -26], [0, -20]]) lantern(kit, M, x, Y0, z, { kind: 'big', s: 1.1, r: 9 });
  }
  yield;

  // ---------------------------------------------------------- the Great Stair, up to the upper city
  {
    const S = stairFlight(kit, M, { x: STAIR.x, z: STAIR.z, y0: Y0, y1: Y1, w: STAIR.w, rise: STAIR.rise, run: STAIR.run, cheek: 0.8 });
    STAIR.top = S.top; STAIR.len = S.len;
    for (const e of [-1, 1]) { lantern(kit, M, e * (STAIR.w / 2 + 0.3), 0.8, STAIR.z + 0.2, { kind: 'globe', r: 6 }); lantern(kit, M, e * (STAIR.w / 2 + 0.3), Y1 + 0.8, BOUNDS.STEP - 0.4, { kind: 'globe', r: 6 }); }
    for (const [x, y, z] of [[-1.6, 2.4, -36], [2.2, 4.6, -40]]) resident(kit, M, rng, x, y, z, { yaw: Math.PI * 0.95 });
    // the wall under the upper city: doors into its cellars, lamps hung by them, figures leaning out, flowers on its parapet
    for (const e of [-1, 1]) for (let u = STAIR.w / 2 + 4; u < 13; u += 4.5) {
      const x = e * u;
      doorway(kit, M, rng, x, Y0, BOUNDS.STEP, { lit: 0.6 });
      if (rng() < 0.7) lantern(kit, M, x + 1.4, 2.6, BOUNDS.STEP + 0.6, { kind: 'hang', yaw: 0 });
      if (rng() < 0.5) table(kit, M, rng, x, Y0, BOUNDS.STEP + 4, { seats: 2 + Math.floor(rng() * 2) });
    }
    for (const x of [-11, -7, 7.5, 12]) paleFigure(kit, M, rng, x, 3.4, BOUNDS.STEP + 0.1, { pose: 'lean', yaw: 0, s: 1.1, detail: 0.7 });
    for (const x of [-12, -8, 8, 12.5]) flowerBox(kit, M, rng, x, Y1 + 0.2, BOUNDS.STEP - 1.2, { w: 2.6, detail: 0.7 });
  }
  yield;

  // ---------------------------------------------------------- the upper city: the bowl, its tiers climbing north, the eclipse house at the top
  const tierTop = Y1 + LEVEL.tier * LEVEL.tiers, topZ = BOWL.Z1 - BOWL.D * LEVEL.tiers;
  {
    for (let i = 0; i < LEVEL.tiers; i++) {
      yield;
      const y = Y1 + LEVEL.tier * (i + 1), z1 = BOWL.Z1 - BOWL.D * i, z0 = i === LEVEL.tiers - 1 ? BOUNDS.N : z1 - BOWL.D, x = BOWL.X + 8;
      terrace(kit, M, { x0: -x, x1: x, z0, z1, y, below: Y1 - 0.5, parapet: 0.55, gaps: [[-3, 3]] });
      // the stair up the middle of the tier's front
      stairFlight(kit, M, { x: 0, z: z1 + 3.2, y0: y - LEVEL.tier, y1: y, w: 5, rise: 0.225, run: 0.4, cheek: 0.5 });
      // a lamp and a pale figure hung over the edge, now and then, along it; people on the steps of the tier
      for (let u = -x + 4; u < x - 4; u += 5 + rng() * 4) {
        if (Math.abs(u) < 5) continue;
        const r = rng();
        if (r < 0.35) lantern(kit, M, u, y + 0.55, z1 - 0.25, { kind: 'globe', r: 5, light: rng() < 0.4 });
        else if (r < 0.55) paleFigure(kit, M, rng, u, y + 0.55, z1 - 0.3, { pose: 'hang', yaw: 0, s: 0.9, detail: 0.6 });
        else if (r < 0.75) resident(kit, M, rng, u, y, z1 - 1.5 - rng() * 2.5, {});
        else if (r < 0.85) table(kit, M, rng, u, y, z1 - 3, { seats: 2 + Math.floor(rng() * 2), light: false });
      }
      // houses along the back of each tier, at its two ends (the middle open to the tiers above)
      for (const e of [-1, 1]) {
        const hx = e * (x - 6), w = 6 + rng() * 3;
        house(kit, M, rng, { x: hx, y, z: z0 + w / 2 + 0.2, w, d: w, h: 3.6 + rng() * 2, kind: rng() < 0.4 ? 'drum' : 'block', roof: rng() < 0.5 ? 'dome' : 'flat', doors: 1, windows: 1, lit: 0.6, detail: 0.6, flowers: 0.4 });
      }
    }
    // the eclipse house at the top: a great drum under its dome, its door to the bowl
    house(kit, M, rng, { x: 0, y: tierTop, z: topZ - 22, w: 22, h: 9, kind: 'drum', roof: 'dome', k: 0.8, doors: 1, windows: 5, lit: 0.8, mat: 'tower', detail: 0.8 });
    for (const e of [-1, 1]) house(kit, M, rng, { x: e * 26, y: tierTop, z: topZ - 18, w: 9, h: 14, kind: 'tower', roof: 'dome', k: 1, doors: 0, windows: 3, lit: 0.5, detail: 0.7 });
    for (const e of [-1, 1]) lantern(kit, M, e * 5, tierTop, topZ - 6, { kind: 'big', s: 1.2, r: 9 });
    // the bowl's square: its tables, lamps and the crowd
    for (let z = BOWL.Z0 - 8; z > BOWL.Z1 + 6; z -= 8) for (const x of [-18, -9, 9, 18]) table(kit, M, rng, x + (rng() - 0.5) * 2, Y1, z, { yaw: (rng() - 0.5) * 0.4, seats: 3 + Math.floor(rng() * 3), w: 2.6, r: 7 });
    for (const [x, z] of [[-12, BOWL.Z0 - 4], [12, BOWL.Z0 - 4], [-24, BOWL.Z1 + 4], [24, BOWL.Z1 + 4]]) lantern(kit, M, x, Y1, z, { kind: 'big', s: 1.1, r: 9 });
  }
  yield;

  // ---------------------------------------------------------- the great dome east of the bowl; the overlook west of it
  {
    house(kit, M, rng, { x: 44, y: Y1, z: -76, w: 24, h: 10, kind: 'drum', roof: 'dome', k: 0.85, doors: 2, windows: 6, lit: 0.6, detail: 0.8 });
    for (const [z, w] of [[-52, 8], [-104, 9], [-120, 8]]) house(kit, M, rng, { x: 44, y: Y1, z, w, d: w, h: 5 + rng() * 2, kind: 'block', roof: 'flat', yaw: -Math.PI / 2, doors: 1, windows: 2, lit: 0.6, detail: 0.7, flowers: 0.7, antenna: 0.5 });
    // the overlook: houses along its east side, facing the parapet and the plain; tables along the parapet
    for (const [z, w, kind] of [[-54, 7, 'block'], [-66, 8, 'drum'], [-80, 7, 'block'], [-96, 9, 'block'], [-112, 7, 'drum'], [-128, 8, 'block']]) {
      yield;
      house(kit, M, rng, { x: -BOUNDS.W + 10, y: Y1, z, w: Math.min(w, 8), d: Math.min(w, 8), h: 4.5 + rng() * 2.5, kind, roof: rng() < 0.5 ? 'dome' : 'flat', yaw: -Math.PI / 2, doors: 1, windows: 2, lit: 0.6, detail: 0.7, flowers: 0.6 });
    }
    for (let z = -52; z > -140; z -= 9) table(kit, M, rng, -BOUNDS.W + 4, Y1, z, { yaw: Math.PI / 2, seats: 2 + Math.floor(rng() * 2), light: rng() < 0.5 });
    for (let z = -50; z > -150; z -= 14) lantern(kit, M, -BOUNDS.W + 1.2, Y1 + 1.25, z, { kind: 'globe', r: 6 });
    for (let z = -60; z > -140; z -= 20) paleFigure(kit, M, rng, -BOUNDS.W + 0.4, Y1 + 1.25, z, { pose: 'hang', yaw: -Math.PI / 2, detail: 0.6 });
    laundry(kit, M, rng, [-BOUNDS.W + 16, 10, -60], [-BOUNDS.W + 16, 10.5, -74], { n: 5 });
    // the rest of the upper city behind: roofs, domes, antennas (drawn as the far city's houses)
    farQuarter(kit, M, rng, { x0: 40, x1: BOUNDS.W - 3, z0: BOUNDS.N + 3, z1: -128, n: 24, y: Y1, size: [6, 10], tall: [4, 9], lit: 0.4, domes: 0.5, solid: true });
    farQuarter(kit, M, rng, { x0: -BOUNDS.W + 3, x1: -40, z0: BOUNDS.N + 3, z1: -140, n: 14, y: Y1, size: [6, 10], tall: [4, 9], lit: 0.4, domes: 0.5, solid: true });
    for (let i = 0; i < 14; i++) antennaPole(kit, M, rng, (rng() - 0.5) * 100, tierTop + rng() * 6, BOUNDS.N + 10 + rng() * 40, 3 + rng() * 4);
  }
  yield;

  // ---------------------------------------------------------- the lower city on the plain, to the horizon (drawn only)
  {
    const fq = (o) => { farQuarter(kit, M, rng, { ...o, H, size: [6, 13], tall: [4, 11], lit: 0.35, domes: 0.45, towers: 0.03 }); };
    fq({ x0: -420, x1: -70, z0: -420, z1: 260, n: 300 });
    fq({ x0: 70, x1: 420, z0: -420, z1: 260, n: 300 });
    fq({ x0: -70, x1: 70, z0: -440, z1: -200, n: 110 });
    fq({ x0: -70, x1: 70, z0: 150, z1: 300, n: 50 });
  }
  yield;

  kit.finish();
  // (the flowers are plants: walked through, like the rest of the flora; the audits pass them by)
  for (const o of group.children) if (M.flower.includes(o.material)) o.userData.flora = true;
  const lights = [...kit.lights];
  yield;

  const spawn = new THREE.Vector3(SHIP_SITE.x + 4, H(SHIP_SITE.x + 4, SHIP_SITE.z - 16) + 0.05, SHIP_SITE.z - 16);
  return {
    id: 'eclipse',
    ground: terrain,
    collision: { strategy: 'SAH' },
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: 440,
    shipSite: { x: SHIP_SITE.x, z: SHIP_SITE.z, heading: Math.PI },   // (its ramp toward the gate)
    features: { mount: false, wind: false, jetpack: false, climb: true },
    // (midday: the eclipse's totality; the sky's own path and the moon over the sun by the hour, src/eclipse.js)
    defaults: { hour: 12, preset: 'Moebius print', cloudShadows: 0, look: ECLIPSE_LOOK },
    sky: { eclipse: ECLIPSE_SKY, planets: [] },
    killY: -Infinity,
    lights,
    noShadow: kit.noShadow,
    reactions: false,   // (nothing grows out of the paving: reactive-world.js)
    stair: STAIR,
    life: {
      flocks: [{ count: 10, color: '#2a2840', size: 0.7, radius: 70, height: [26, 50], speed: 0.3, seed: 61 }],
      motes: { count: 120, color: '#ffe0b0', size: 0.035, glow: 0.8, rise: 0.02, wind: [0.05, 0.02] },
    },
    atmo: () => ({ tint: [1, 1, 1], fog: 0.65, name: 'The City During the Eclipse', script: ECLIPSE_SCRIPT }),
    crowdLines: CROWD_LINES,
    // The city's crowd (crowd.js): strollers across the square and the bowl, people talking in twos and threes
    // between the tables, others at the overlook's parapet looking out. Candidates only: the crowd keeps those on
    // clear, walkable ground.
    crowdSpots() {
      const r = mulberry32(6121), V = (x, y, z) => new THREE.Vector3(x, y, z), groups = [], walks = [], edges = [];
      for (const x of [-9, 0, 9]) walks.push({ path: [V(x, Y0, 40), V(x, Y0, -26)], n: 4, pair: 0.4 });
      walks.push({ path: [V(-26, Y1, -54), V(26, Y1, -54)], n: 4, pair: 0.3 });
      walks.push({ path: [V(-40, Y1, -50), V(-40, Y1, -140)], n: 3, pair: 0.3 });
      walks.push({ path: [V(0, Y0, 120), V(0, Y0, 52)], n: 3, pair: 0.3 });
      for (let z = 40; z > -24; z -= 6 + r() * 6) for (const x of [-8, 8, 0]) if (r() < 0.35) groups.push({ at: V(x + (r() - 0.5) * 2, Y0, z), n: 2 + Math.floor(r() * 2.4) });
      for (let z = BOWL.Z0 - 4; z > BOWL.Z1 + 4; z -= 7) for (const x of [-26, -13.5, 0, 13.5, 26]) if (r() < 0.3) groups.push({ at: V(x, Y1, z), n: 2 + Math.floor(r() * 2) });
      for (let z = -56; z > -140; z -= 8) if (r() < 0.6) edges.push({ at: V(-BOUNDS.W + 1.6, Y1, z), heading: -Math.PI / 2, pose: 'rail' });
      return { groups, walks, edges, avoid: [], farMax: 420, costume: 'eclipse', clear: [{ x: SHIP_SITE.x, z: SHIP_SITE.z, r: 14 }, { x: 0, z: (STAIR.z + BOUNDS.STEP) / 2, r: 6 }] };
    },
    update() {},
  };
}
export const createEclipse = stepped(buildEclipse);
