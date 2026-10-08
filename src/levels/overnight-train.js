import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { sharedUniforms } from '../materials.js';
import { stepped } from '../load-steps.js';
import { RoomKit } from './lab-kit.js';
import { PEOPLE as LISTENER_PEOPLE } from '../story/perdide-data.js';
import { PEOPLE as TOWER_PEOPLE } from '../story/arzach-data.js';
import { PEOPLE as EDENA_PEOPLE } from '../story/edena-data.js';
import {
  TR, trainMats, train, furnishCar, railsGeo, dustPuffs, moonGeo, telegraphPole, wire, butte, stone, station, pennantWave, rodGeo, addParts, rider,
  TRAIN_LOOK, TRAIN_DAY, TRAIN_DUSK, TRAIN_NIGHT, TRAIN_TONES, TAU,
} from './overnight-train-kit.js';
import { puffGeo } from './underside-kit.js';
import { RUN, runAt, stationOffset, bandShift } from './overnight-train-run.js';

// ---------------------------------------------------------------------------
// The Overnight Train (?level=overnighttrain): a long streamlined train crossing a flat lavender plain by night under
// two moons, after its reference pictures (references/The Overnight Train/; its views in the References,
// reference-overnighttrain.js; the shapes and the look in overnight-train-kit.js). Off the route: no story to follow,
// a few people to meet.
//
// The train stands still in the world's frame and the land runs past it (overnight-train-run.js: how far and how fast
// at each moment): the plain's streaks, the sleepers under the wheels, the telegraph poles and their wires, stones,
// far buttes, now and then a lit hut or a signal, and every few minutes a lonely station the train slows into, waits
// at, and pulls out of again. So the carriages, the people in them and their collision are the game's own: you walk
// through the train and along its roofs as through any town.
//
// The layout (the train runs toward +x, its nose at x ≈ 4; z across): the lead carriage's observation lounge, its
// round nose open onto the railed balcony; the dining car; two sleeping cars (a corridor along -z, compartments with
// bunks along +z); the library (the dome carriage), its roof a railed terrace with the little sky lounge on it; the
// landing wagon, a broad railed deck where the ship sets down; then the closed carriages of the long tail. Doors join
// them all through porches at their ends; a ladder on each porch climbs to the roof walk, plank bridges over the gaps
// between the roofs. Off the train is the running land: anything that reaches it is put back aboard (unsafe).
// ---------------------------------------------------------------------------

/** The carriages from the nose back (train()'s list). */
export const TRAIN_LAYOUT = [
  { kind: 'prow', roof: 'garden', colour: 'plum', pennants: [[-0.3, 0, 3.4, 7]] },
  { kind: 'dining', roof: 'chimney', colour: 'hull' },
  { kind: 'sleeper', roof: 'walk', colour: 'plum' },
  { kind: 'sleeper', roof: 'garden', colour: 'hull' },
  { kind: 'dome', roof: 'terrace', colour: 'plum', pennants: [[0.62, 1.7, 4.6, 8], [0.5, -1.7, 3.8, 6]] },
  { kind: 'landing', L: 44, w: 30 },
  { kind: 'coach', roof: 'garden', colour: 'hull' },
  { kind: 'coach', roof: 'walk', colour: 'plum', pennants: [[0.3, 0, 2.8, 6]] },
  { kind: 'coach', roof: 'garden', colour: 'hull' },
  { kind: 'coach', roof: 'walk', colour: 'plum' },
  { kind: 'coach', roof: 'garden', colour: 'hull' },
  { kind: 'coach', roof: 'walk', colour: 'plum' },
];
/** The nose's body end (the balcony juts 4.2 m past it). */
export const NOSE_X = 0;
/** The carriages laid out (their x0, x1, xc), without building them: the world's plan, the tests' and the people's places. */
export const CARS = (() => {
  let x = NOSE_X;
  return TRAIN_LAYOUT.map((c, i) => { const L = c.L ?? TR.car, o = { kind: c.kind, i, x1: x, x0: x - L, xc: x - L / 2, L }; x -= L + TR.gap; return o; });
})();
export const car = (kind, n = 0) => CARS.filter((c) => c.kind === kind)[n];
export const TAIL = CARS.at(-1).x0;
/** The floor of the carriages, and the roof walk's top. */
export const FLOOR = TR.floor, WALK = TR.floor + TR.walk;
/** The ship on the landing wagon, its hatch toward the front of the train (the porches of the library's back end). */
const LW = car('landing');
export const SHIP_SITE = { x: LW.xc - 4, z: 0, heading: Math.PI / 2 };
/** Where the station's platform stands when the train halts at it (its middle, x), along the +z side. */
export const STATION = { x: -70, half: 72, z0: TR.half + 0.35, depth: 7 };
/** The run starts this far into a halt (s): the ship comes down at a station where the train waits. */
export const START_T = 6;

/** The ground: the plain (y 0). Everything walked on is the train itself. */
export const groundHeight = () => 0;
/** Off the train: the running land (anything down there is put back aboard). */
export const unsafe = (p) => p.y < 1.2;

export const TRAIN_CONTENT = {
  weather: [],
  story: {
    title: 'THE OVERNIGHT TRAIN',
    intro: 'A long train crosses a lavender plain by night, under two moons. The ship has come down on its landing wagon while it waits at a station. The lounge is at the front.',
    outro: 'From the balcony at the nose the plain runs at you out of the dark, the moons ahead, the rails humming under your feet. Behind, the windows go back and back.',
    label: 'the balcony at the nose', goal: [NOSE_X + 3, FLOOR, 0], radius: 4, verticalRadius: 3, manual: true,
  },
  relics: { spots: [], names: [] },
  // three people from elsewhere, riding the night through, and the train's own folk
  npcs: [
    { ...LISTENER_PEOPLE.saba, at: [car('dining').xc + 3.3, -0.95], y: FLOOR, radius: 1.6, world: 'perdide', lang: 'perdide',
      lines: ['~whisper~ Shh. Listen. Ta-dum, ta-dum. Then the long one.', '~curious~ The rails have a phrase. It repeats every twenty-six metres.'],
      talk: { listen: [
        '~neutral~ Saba, the Listener, from the swamp of Lorn. At home I listen to a crystal. Here I listen to the rails.',
        '~curious~ Two short, two short, and a long breath where the carriages meet. I have written it down forty times.',
        '~whisper~ When the train slows for a station the phrase stretches out, like someone falling asleep.',
        '~happy~ The cook says the soup tastes better at speed. I think he is right.',
      ] } },
    { ...TOWER_PEOPLE.oia, at: [car('dome').xc + 4.6, 1.0], y: WALK + 0.02, radius: 1.6, world: 'arzach', lang: 'arzach',
      lines: ['~neutral~ (she watches for the next lamp)', '~tired~ (she watches the moons keep ahead of the train)'],
      talk: { listen: [
        '~neutral~ (Oïa has the sky lounge to herself. She points at the window, then at the plain going by, and makes room on the bench.)',
        '~curious~ (A lamp passes in the dark. Oïa waves at it. Far off, someone waves back. She looks at you: your turn.)',
        '~solemn~ (On the misted glass she draws a line as long as her arm can reach, and leaves it without an end.)',
        '~playful~ (She points up at the ceiling, then out at the ladder on the porch, and walks two fingers along the top of the window: up there, a street of roofs.)',
      ] } },
    { ...EDENA_PEOPLE.sol, at: [NOSE_X - 4, 1.6], y: FLOOR, radius: 1.6, world: 'edena', lang: 'edena',
      lines: ['~happy~ The tea comes round at every station. I count stations by the cup.', '~curious~ Sit at the front. The plain comes straight at you.'],
      talk: { listen: [
        '~neutral~ Sol, from Viridel. I took the train to see a flat thing. At home everything is a hill, or growing up one.',
        '~happy~ Three stations so far. Three cups. The third was the best.',
        '~curious~ Nobody gets on and nobody gets off. The stations are for the tea, I think, and for the quiet.',
        '~whisper~ At the very back the carriages are shut. People sleep there who boarded long ago.',
      ] } },
    // the train's own folk
    { at: [car('dining').x0 + 1.6, -1.2], y: FLOOR, radius: 2.2, lang: 'bazaar', lines: ['~happy~ Soup of the plain, bread of the last station. Sit anywhere.', '~neutral~ The kitchen never stops. Neither do we, mostly.'] },
    { at: [car('sleeper').xc, -2.0], y: FLOOR, radius: 2.2, lang: 'bazaar', lines: ['~whisper~ Softly in the corridor. Half the train is asleep.', '~curious~ The compartments with the doors open are free. Lie down if you like.'] },
    { at: [LW.xc + 10, 8], y: FLOOR, radius: 3, lang: 'bazaar', lines: ['~surprised~ A ship! We keep the deck clear for them, but one hardly ever comes.', '~neutral~ The lounge is that way, through the library and the sleepers. Mind the porches.'] },
    { at: [car('dome').xc - 2, -1.2], y: FLOOR, radius: 2.2, lang: 'bazaar', lines: ['~neutral~ The library lends by the night. Bring it back before the plain runs out.', '~playful~ There is a terrace on our roof. The ladder is on the porch.'] },
    { at: [NOSE_X + 2.4, -1.2], y: FLOOR, radius: 2.2, lang: 'bazaar', lines: ['~happy~ This is the best seat on the train, and it is standing room.', '~solemn~ At the stations everyone goes quiet. Then the whistle, and we all breathe again.'] },
  ],
  // the detour's trace (src/story/sightings-detours.js): the mark chalked on the last carriage's roof, kept by someone
  traces: [{
    id: 'overnighttrain.chalk', at: [TAIL + 2.2, WALK, 0], label: 'the chalk mark', range: 3,
    look: [TAIL + 2.2, WALK + 1.5, 0],   // (the prompt over it)
    glyph: { size: 0.9, yaw: Math.PI / 2, lift: 0.7, color: '#f3ead8', glow: 0.35 },
    person: { id: 'trace.overnighttrain', name: 'A mark on the last carriage', title: '', color: '#f3ead8',
      talk: { nodes: { look: { say: [
        '~solemn~ (Chalked on the last carriage’s roof, at its very end, where the rails run out behind into the dark: three dots over an arc, {glyph}.)',
        '~whisper~ (Chalk wouldn’t last a night up here in the wind. This has been drawn again over older chalk, many times, never quite on the old lines. Someone on this train keeps it.)',
      ], do: { set: { 'sight.overnighttrain.chalk': true } } } } } },
  }],
};

/** What the train's crowd says (crowd.js), toned. */
export const CROWD_LINES = [
  '~neutral~ Mind the gap between the carriages.',
  '~happy~ Another station! I can smell the bread from here.',
  '~whisper~ Listen to the rails. You stop hearing them, and then you can’t stop.',
  '~curious~ You came in on the ship? On the landing wagon? Nobody uses that.',
  '~playful~ My cousin walked the roofs from the front to the back. It took her all night.',
  '~tired~ I meant to sleep at the last station. Then the moons came out.',
];

/** The level's colours: a pale lavender day, a rose dusk, and the night the pictures draw (the default). */
export const TRAIN_SKY = { day: TRAIN_DAY, dusk: TRAIN_DUSK, night: TRAIN_NIGHT };
/** The two moons: where they hang (deg from +z toward +x, and high), and how wide. Ahead of the train, where the night's light comes from. */
export const MOONS = [{ az: 72, el: 22, deg: 3.8 }, { az: 86, el: 15, deg: 2.7 }];

const DIR = (az, el) => { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el); return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)); };
const NC = { solid: false, shadow: false }, SH = { solid: false, shadow: true };

/** A band of the running land: its own group (moved each frame), built from one pattern repeated every P m over [a, b]. */
function band(root, name, P, [a, b], fill, seed) {
  const group = new THREE.Group();
  group.name = name;
  root.add(group);
  const kit = new RoomKit({ group, centre: new THREE.Vector3(), seed });
  const M = trainMats(kit, { lamps: false });
  for (let k = Math.floor((a - P) / P); k * P < b + P; k++) fill(kit, M, mulberry32(seed), k * P);
  kit.finish();
  group.traverse((o) => { if (o.isMesh) { o.userData.noCollide = true; o.userData.dynamic = true; } });
  return { group, P, kit };
}

// (built in steps, src/load-steps.js: the game's load gives the main thread back between them)
export function* buildOvernightTrain(scene) {
  const root = new THREE.Group();
  root.name = 'The Overnight Train';
  scene.add(root);
  const kit = new RoomKit({ group: root, centre: new THREE.Vector3(), seed: 82100 });
  const M = trainMats(kit);
  const noShadow = [];
  const res = { lamps: [] };

  // ---------------------------------------------------------- the train (solid as drawn: its floors, walls, rails, roofs)
  const T = train(kit, M, TRAIN_LAYOUT, {
    x: NOSE_X, detail: 0.85, solid: true, seed: 82100, turning: true,
    furnish: (k, MM, c, ctx) => furnishCar(k, MM, c, ctx, { solid: true, detail: 0.8 }),
  });
  yield;
  // people sitting and standing in the carriages, drawn small and still where the crowd does not reach (the tail's
  // closed carriages' windows show none: their blinds are down)
  {
    const rng = mulberry32(82101);
    for (const s of (T.seats ?? []).filter((_, i) => i % 3 === 1)) rider(kit, M, rng, s[0], s[1] + 0.05, s[2], { yaw: s[3], s: 0.82 });
  }
  yield;
  // the pennants on their masts (each a mesh of its own: they wave)
  const flags = T.pennants.map((p) => { const m = kit.mesh(p.g, p.mat, NC); m.userData.dynamic = true; return m; });
  // the lead's great drive wheels, turning (one instanced set of spokes)
  const drive = T.wheels.filter((w) => w.drive);
  const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(drive[0].r * 1.75, 0.08, 0.06), M.iron, drive.length * 4);
  spokes.userData.noCollide = true; spokes.userData.dynamic = true; spokes.frustumCulled = false;
  spokes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(spokes); noShadow.push(spokes);
  yield;

  // ---------------------------------------------------------- the track: the bed and the rails to the horizon both ways
  kit.add(M.ballast, new THREE.BoxGeometry(9000, TR.rail - 0.16, 5.2).translate(-1500, (TR.rail - 0.16) / 2, 0), NC);
  for (const g of railsGeo(-6000, 3000)) kit.add(M.rails, g, NC);
  // the plain (drawn: the ground under it is the level's own, y 0)
  kit.add(M.plain, new THREE.CircleGeometry(4800, 72).rotateX(-Math.PI / 2).translate(-180, 0, 0), NC);
  // the two moons, far off ahead
  for (const m of MOONS) kit.add(M.moon, moonGeo(new THREE.Vector3(-180, 0, 0), DIR(m.az, m.el), { d: 3200, deg: m.deg }), NC);
  yield;

  kit.finish();
  // (the shrubs and the bushes are plants: walked through, like the rest of the flora; the audits pass them by)
  for (const o of root.children) if (M.shrub.includes(o.material) || o.material === M.leaves) o.userData.flora = true;
  noShadow.push(...kit.noShadow);
  yield;

  // ---------------------------------------------------------- the running land (bands moved each frame: overnight-train-run.js)
  const near = [TAIL - 180, 260], wide = [-1900, 1300];
  const bands = [];
  // the sleepers under the wheels: the quickest thing in sight
  bands.push(band(root, 'The sleepers', 0.9, near, (k, MM, r, x) => k.add(MM.sleeper, new THREE.BoxGeometry(0.26, 0.15, 4.1).translate(x, TR.rail - 0.16 + 0.075, 0), NC), 1));
  yield;
  // the plain's long streaks (as wide as a pixel or two from the carriages' windows: wider the further off) and stones
  bands.push(band(root, 'The plain', 300, wide, (k, MM, r, x0) => {
    for (let i = 0; i < 70; i++) {
      const z = (r() < 0.5 ? 1 : -1) * (5 + Math.pow(r(), 1.5) * 300), a = Math.abs(z), w = Math.min(5, 0.04 + (a * a) / 2400), len = 6 + r() * 40 * (1 + a / 25);
      k.add(MM.streak, new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2).translate(x0 + r() * 300, 0.03 + a * 0.0012, z), NC);
    }
    for (let i = 0; i < 14; i++) { const z = (r() < 0.5 ? 1 : -1) * (9 + Math.pow(r(), 1.3) * 220), s = 0.3 + r() * (0.5 + Math.abs(z) / 120); k.add(MM.stone, stone(x0 + r() * 300, z, s, x0 + i, 0), NC); }
  }, 2));
  yield;
  // the telegraph poles along the -z side (beyond the landing wagon's deck) and their wires
  bands.push(band(root, 'The telegraph', 50, wide, (k, MM, r, x) => {
    const A = telegraphPole(x, -24), B = telegraphPole(x + 50, -24);
    for (const g of A.pole) k.add(MM.pole, g, SH);
    for (let i = 0; i < 3; i++) for (const g of wire(A.tops[i], B.tops[i], { sag: 0.7, n: 4 })) k.add(MM.wire, g, NC);
  }, 3));
  yield;
  // far buttes on both sides, low on the horizon
  bands.push(band(root, 'The buttes', 7200, [-5200, 5200], (k, MM, r, x0) => {
    for (let i = 0; i < 9; i++) { const s = r() < 0.5 ? 1 : -1; k.add(MM.butte, butte(x0 + r() * 7200, s * (1300 + r() * 2500), { w: 160 + r() * 420, h: 22 + r() * 70, d: 120 + r() * 200, seed: i + 1, yaw: r() * 3 }), NC); }
  }, 4));
  // now and then a light out on the plain: a hut with its window lit, a signal mast by the line, red or green
  bands.push(band(root, 'The lights', 2400, [-2200, 1700], (k, MM, r, x0) => {
    for (let i = 0; i < 3; i++) {
      const x = x0 + r() * 2400, s = r() < 0.5 ? 1 : -1, z = s * (50 + r() * 260);
      k.add(MM.station, new THREE.BoxGeometry(5, 3.2, 4).translate(x, 1.6, z), SH);
      k.add(MM.roofTile, new THREE.ConeGeometry(4, 1.6, 4).rotateY(Math.PI / 4).translate(x, 4, z), SH);
      k.add(MM.pane, new THREE.BoxGeometry(1.2, 1, 0.1).translate(x + 0.8, 1.8, z - s * 2.02), NC);
      k.add(MM.glow, new THREE.SphereGeometry(0.35, 6, 4).translate(x - 2, 3, z - s * 2.4), NC);
    }
    for (let i = 0; i < 2; i++) {
      const x = x0 + r() * 2400, z = -7.5;
      k.add(MM.pole, rodGeo(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 6, z), 0.1), SH);
      k.add(MM.frame, new THREE.BoxGeometry(0.3, 1.2, 0.6).translate(x, 6.2, z), SH);
      k.add(r() < 0.5 ? MM.glow : MM.lamp, new THREE.SphereGeometry(0.2, 6, 4).translate(x + 0.16, 6.4, z), NC);
    }
  }, 5));
  for (const b of bands) for (const m of b.kit.noShadow) noShadow.push(m);
  yield;

  // ---------------------------------------------------------- the station (one, placed by the run: the train halts beside it)
  const stationGroup = new THREE.Group();
  stationGroup.name = 'The station';
  root.add(stationGroup);
  {
    const sk = new RoomKit({ group: stationGroup, centre: new THREE.Vector3(), seed: 82102 }), SM = trainMats(sk, { lamps: false });
    const S = station({ x0: STATION.x - STATION.half, x1: STATION.x + STATION.half, z0: STATION.z0, depth: STATION.depth, seed: 3, house: 0.42 });
    addParts(sk, SM, S, { station: SM.station, roofTile: SM.roofTile, plank: SM.plank, iron: SM.iron, glow: SM.glow, pane: SM.pane, lamp: SM.lamp, wood: SM.wood, frame: SM.frame }, SH);
    // people waiting on the platform with their bundles, the stationmaster by his lamp
    const rng = mulberry32(82103);
    for (let i = 0; i < 9; i++) rider(sk, SM, rng, STATION.x - STATION.half + 10 + rng() * (STATION.half * 2 - 20), S.top, STATION.z0 + 2 + rng() * 3.5, { yaw: Math.PI + (rng() - 0.5) * 1.2, s: 0.95 });
    sk.finish();
    stationGroup.traverse((o) => { if (o.isMesh) { o.userData.noCollide = true; o.userData.dynamic = true; } });
    noShadow.push(...sk.noShadow);
  }
  yield;

  // ---------------------------------------------------------- the dust the wheels raise (puffs streaming back along the train, by its speed)
  const DUST = 300;
  const dust = [M.dust, M.dust2].map((m, k) => { const im = new THREE.InstancedMesh(puffGeo(2, 3 + k), m, DUST / 2); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.userData.noCollide = true; im.userData.dynamic = true; im.frustumCulled = false; root.add(im); noShadow.push(im); return im; });
  const wheelsX = T.wheels.map((w) => w.x);
  const puffs = (() => {
    const r = mulberry32(82104), seeds = dustPuffs({ x0: NOSE_X - 2, x1: TAIL, trail: 120, step: 2.6, sides: [1, -1] });
    return Array.from({ length: DUST }, (_, i) => ({ a: r(), x0: wheelsX[Math.floor(r() * wheelsX.length)], side: r() < 0.5 ? 1 : -1, z: 0.1 + r() * 0.7, s: 0.5 + r() * 0.6, spin: r() * TAU, base: seeds[i % seeds.length] }));
  })();
  yield;

  // the lights: the carriages' lamps, the furniture's
  const lights = [...kit.lights];
  const spawn = new THREE.Vector3(SHIP_SITE.x + Math.sin(SHIP_SITE.heading) * 16, FLOOR + 0.05, SHIP_SITE.z + Math.cos(SHIP_SITE.heading) * 16);
  const dummy = new THREE.Object3D();
  let time = START_T, run = runAt(START_T), whistle = 0, lastPhase = run.phase, kv = 0;
  const place = (t, dt) => {
    run = runAt(t);
    if (lastPhase === 'halt' && run.phase === 'leaving') whistle++;
    if (lastPhase === 'running' && run.phase === 'braking') whistle++;
    lastPhase = run.phase;
    for (const b of bands) b.group.position.x = bandShift(run.s, b.P);
    const off = stationOffset(run.s);
    stationGroup.position.x = off;
    stationGroup.visible = Math.abs(off) < 2600;
    const k = run.v / RUN.V;
    kv += (k - kv) * Math.min(1, dt * 0.8);
    // the dust: each puff runs back from its wheel and swells, faster the faster the train; at a halt it settles away
    let i = 0;
    for (const p of puffs) {
      p.a = (p.a + dt * (0.02 + 0.28 * k)) % 1;
      const x = p.x0 - p.a * (40 + 80 * kv), grow = 0.3 + p.a * 1.25;
      // (under the landing wagon's broad deck the puffs stay low: never up through its planks)
      const under = x < LW.x1 + 2 && x > LW.x0 - 2, s = Math.min(under ? 1.0 : 1.7, p.s * grow) * kv;
      dummy.position.set(x, TR.rail * 0.3 + s * 0.45 + (under ? 0 : p.a * 0.8), p.side * (TR.half * 0.62 + p.z + p.a * (0.6 + 2.2 * kv)));
      dummy.rotation.set(0, p.spin, 0); dummy.scale.set(Math.max(1e-3, s * 1.3), Math.max(1e-3, s * 0.7), Math.max(1e-3, s));
      dummy.updateMatrix();
      dust[i % 2].setMatrixAt(i >> 1, dummy.matrix);
      i++;
    }
    for (const im of dust) im.instanceMatrix.needsUpdate = true;
    // the drive wheels turn with the run (s / r radians)
    i = 0;
    for (const w of drive) for (let j = 0; j < 4; j++) {
      dummy.position.set(w.x, w.y, w.z + Math.sign(w.z) * 0.12); dummy.rotation.set(0, 0, -run.s / w.r + (j * Math.PI) / 4); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix(); spokes.setMatrixAt(i++, dummy.matrix);
    }
    spokes.instanceMatrix.needsUpdate = true;
    for (const f of flags) pennantWave(f.geometry, t, kv);
  };
  place(time, 1);

  return {
    id: 'overnighttrain',
    ground: { heightAt: groundHeight },
    envGround: TRAIN_TONES.plain,
    collision: { strategy: 'SAH' },
    spawn,
    spawnHeading: SHIP_SITE.heading,
    camYaw: SHIP_SITE.heading + Math.PI,
    limit: 520, killY: -6, unsafe,
    shipSite: { ...SHIP_SITE, y: FLOOR },
    features: { mount: false, wind: true, jetpack: false, climb: true },
    // (the night the pictures draw: the moons ahead of the train, the windows lit)
    defaults: { hour: 22, preset: 'Moebius print', cloudShadows: 0, look: TRAIN_LOOK },
    sky: { script: TRAIN_SKY, planets: [], moon: false },
    lights,
    noShadow,
    reactions: false,   // (nothing grows on a train: reactive-world.js)
    life: {
      flocks: [{ count: 10, color: '#3a3448', size: 0.5, radius: 90, height: [12, 30], speed: 0.5, seed: 82 }],
      motes: { count: 120, color: '#ffd8b8', size: 0.035, glow: 0.4, rise: 0.02, wind: [-0.6, 0] },
    },
    atmo: (x, z, y) => ({ tint: [1, 1, 1], fog: 0.5, name: placeName(x, z, y) }),
    crowdLines: CROWD_LINES,
    // The train's crowd (crowd.js): strollers down the corridors and along the landing deck, people in twos and threes
    // in the lounge and the library, others at the balcony's rail, the porches' and the deck's. Candidates only: the
    // crowd keeps those on clear, walkable ground.
    crowdSpots() {
      const V = (x, y, z) => new THREE.Vector3(x, y, z), r = mulberry32(8211), groups = [], walks = [], edges = [];
      const L = car('prow'), D = car('dining'), S0 = car('sleeper', 0), S1 = car('sleeper', 1), B = car('dome');
      walks.push({ path: [V(L.x0 + 3, FLOOR, 0), V(L.x1 - 1, FLOOR, 0)], n: 3, pair: 0.4 });
      walks.push({ path: [V(D.x0 + 4, FLOOR, 0), V(D.x1 - 1, FLOOR, 0)], n: 2, pair: 0.2 });
      for (const S of [S0, S1]) walks.push({ path: [V(S.x0 + 1, FLOOR, -2.1), V(S.x1 - 1, FLOOR, -2.1)], n: 2, pair: 0.2 });
      walks.push({ path: [V(B.x0 + 1, FLOOR, -0.6), V(B.x1 - 1, FLOOR, -0.6)], n: 2, pair: 0.3 });
      walks.push({ path: [V(LW.x0 + 4, FLOOR, 10), V(LW.x1 - 4, FLOOR, 10)], n: 3, pair: 0.4 });
      walks.push({ path: [V(LW.x0 + 4, FLOOR, -10), V(LW.x1 - 4, FLOOR, -10)], n: 2, pair: 0.3 });
      for (let x = L.x0 + 5; x < L.x1 - 2; x += 5) if (r() < 0.6) groups.push({ at: V(x, FLOOR, (r() - 0.5) * 1.2), n: 2 });
      for (const a of [-0.9, -0.3, 0.3, 0.9]) edges.push({ at: V(NOSE_X + 1.2 + 2.6 * Math.cos(a), FLOOR, 2.6 * Math.sin(a)), heading: Math.PI / 2 + a * 0.6, pose: 'rail' });
      for (let x = LW.x0 + 3; x < LW.x1 - 3; x += 6) if (r() < 0.45) edges.push({ at: V(x, FLOOR, 14.2), heading: 0, pose: 'rail' });
      for (let x = LW.x0 + 3; x < LW.x1 - 3; x += 7) if (r() < 0.35) edges.push({ at: V(x, FLOOR, -14.2), heading: Math.PI, pose: 'rail' });
      const t = B; edges.push({ at: V(t.x1 - 2, WALK + 0.02, 2.0), heading: 0, pose: 'rail' }, { at: V(t.x0 + 2, WALK + 0.02, -2.0), heading: Math.PI, pose: 'rail' });
      return { groups, walks, edges, avoid: [], farMax: 160, costume: 'overnighttrain', clear: [{ x: SHIP_SITE.x, z: SHIP_SITE.z, r: 15 }] };
    },
    /** How the rails sound here (src/audio.js): the run's speed, the rumble's share, out in the wind or not, a whistle's count. */
    rails(p) {
      const out = p.y > FLOOR + 3.4 ? 1 : (p.x > NOSE_X - 0.5 || (p.x < LW.x1 + 1 && p.x > LW.x0 - 1)) ? 0.8 : CARS.some((c) => c.kind !== 'landing' && p.x < c.x0 && p.x > c.x0 - TR.gap) ? 0.6 : 0;
      return { speed: run.v, full: RUN.V, out, roof: p.y > FLOOR + 3.4 ? 1 : 0, whistle, halt: run.phase === 'halt' };
    },
    /** The run now (for the tests and the shots): { s, v, phase, k, until }. */
    get run() { return run; },
    /** Put the run at time t (s; 0 the moment it halts at a station): the shots and the tests. */
    setRunTime(t) { time = t; place(time, 10); },
    update(dt, t) {
      for (const m of kit.movers) m(t);
      time += dt;
      place(time, dt);
      // (the lamps' warm pools: faint by day, full from dusk to dawn)
      sharedUniforms.uLampsOn.value = 0.2 + 0.8 * (1 - THREE.MathUtils.smoothstep(sharedUniforms.uSunDir.value.y, -0.02, 0.14));
    },
  };
}
export const createOvernightTrain = stepped(buildOvernightTrain);

/** The name of where you are on the train. */
export function placeName(x, z, y) {
  if (y > FLOOR + 3.4) { const D = car('dome'); return x < D.x1 && x > D.x0 ? (y > WALK + 0.5 && Math.abs(x - D.xc - 0.5) < 5 ? 'The sky lounge' : 'The roof terrace') : 'On the roofs'; }
  if (x > NOSE_X) return 'The balcony';
  const c = CARS.find((q) => x <= q.x1 + TR.gap / 2 && x >= q.x0 - TR.gap / 2);
  return { prow: 'The observation lounge', dining: 'The dining car', sleeper: 'The sleeping cars', dome: 'The library', landing: 'The landing wagon', coach: 'The long tail' }[c?.kind] ?? 'The Overnight Train';
}
