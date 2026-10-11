// The mastery trials, one in each route world (docs/systems/minigames.md, "Trials in the worlds"): optional
// runs built from that world's own vehicle and verbs, started from a marker in the world (a makers' standing
// stone with a ring of light), timed, the best kept in the save, a reward the first time one is finished.
// Pure data (src/trials/index.js builds them; tests/trials.test.js checks every course flies or rides clear).
//
//   id       'trial-<world>' (its best: minigame.trial-<world>.best)
//   mode     how it is run (src/trials/course.js MODES): foot, glider, jets, bike, skiff, bird, eyes
//   marker   [x, z] (on the ground) or [x, y, z]: the stone, a step from where the run starts
//   start    [x, y, z] (y null: the ground there) and heading: where the run begins (the traveller is set there)
//   gates    [x, y, z, r] in order, the last the line; `ground: true`: [x, z, r] laid `up` m over the ground
//            (or the water) under them
//   eyes     (mode eyes) [x, z]: eyes on posts to splash, any order
//   winds    columns of rising air on the way: [x, z, r, h, lift] from the ground there (src/trials/winds.js)
//   speed    an easy pace along it (m/s): the par is the length at that pace, with room to spare
//   reward   the item the first finish gives (src/items.js, kind 'upgrade', `trial`)

import { partsOf, offsetOf, shiftAt } from '../levels/names.js';

export const TRIALS = {
  desert: {
    id: 'trial-desert', world: 'desert', mode: 'bike', name: 'Dune line', color: '#f0a54a',
    blurb: 'A hoverbike line the makers drew through the dunes east of the landing.',
    rules: 'Ride through every gate in order, down into the basin and back up. Stay on the bike.',
    marker: [26, 18], start: [34, null, 16], heading: 2.2, speed: 16, ground: true, up: 1.4,
    gates: [[70, -20, 7], [100, -70, 7], [95, -120, 7], [55, -150, 7], [5, -125, 7], [-30, -80, 7], [-45, -30, 7], [-20, 20, 8]],
    reward: 'clearglass',
  },
  arzach: {
    id: 'trial-arzach', world: 'arzach', mode: 'glider', name: 'Wind ladder', color: '#9fd6ee',
    blurb: 'Columns of rising air the makers set over the plain, and rings to glide through between them.',
    rules: 'Open your wings in the first column and ride it up, then glide through every ring in order; the next column lifts you again.',
    marker: [-52, -92], start: [-60, null, -100], heading: 1.0, speed: 12,
    winds: [[-60, -100, 6, 44, 8], [40, -40, 7, 62, 9]],
    gates: [[-60, 58, -100, 6], [-12, 50, -72, 8], [40, 50, -40, 7], [100, 44, 20, 8], [62, 32, 78, 8], [8, 18, 50, 9]],
    reward: 'longline',
  },
  arzach2: {
    id: 'trial-arzach2', world: 'arzach2', mode: 'bird', name: 'Stone circuit', color: '#f4efe2',
    blurb: 'A circuit of the sky stones on the bird’s back: the Needles, the great Table, the Monastery and home.',
    rules: 'Fly the bird through every ring in order, round the stones and back to the plateau.',
    marker: [16, 4], start: [20, null, -6], heading: 2.9, speed: 18,
    gates: [[10, 70, -110, 10], [110, 82, -200, 10], [180, 100, -292, 10], [110, 92, -380, 10], [-30, 96, -452, 10], [-150, 100, -330, 10], [-240, 104, -215, 10], [-150, 80, -60, 10], [-20, 58, 40, 12]],
    reward: 'fourthcoil',
  },
  perdide: {
    id: 'trial-perdide', world: 'perdide', mode: 'skiff', name: 'Reed race', color: '#7fd0b8',
    blurb: 'Buoys of the makers on the open water west of the landing.',
    rules: 'Steer the skiff through every buoy gate in order, round the lake and back. A gust of the fan in its sail goes faster.',
    marker: [-34, 6], start: [-46, null, 4], heading: -1.6, speed: 12, ground: true, up: 1.2,
    gates: [[-90, -10, 7], [-140, -50, 7], [-190, -110, 7], [-200, -180, 7], [-140, -220, 7], [-90, -170, 7], [-110, -100, 7], [-70, -40, 8]],
    reward: 'widevane',
  },
  perdide2: {
    id: 'trial-perdide2', world: 'perdide2', mode: 'skiff', name: 'Lagoon laps', color: '#9fe8d8',
    blurb: 'Two laps of buoys on the open water south-west of the deep wood.',
    rules: 'Steer the skiff through every buoy gate in order, twice round. Ride up to the floating sign to start.',
    marker: [-140, 0, 214], start: [-150, null, 205], heading: 2.1, speed: 10, ground: true, up: 1.2,
    // (two laps of the open water south-west of the wood; the sign floats there, a buoy)
    gates: [[-115, 185, 7], [-115, 145, 7], [-150, 125, 7], [-185, 145, 7], [-185, 185, 7], [-150, 205, 7], [-115, 185, 7], [-115, 145, 7], [-150, 125, 7], [-185, 145, 7], [-185, 185, 7], [-148, 207, 8]],
    reward: 'fourthnotch',
  },
  edena: {
    id: 'trial-edena', world: 'edena', mode: 'eyes', name: 'Eye garden', color: '#c8e88a',
    blurb: 'Eight eyes of the makers on posts round the meadow, asleep.',
    rules: 'Wake every eye with a splash of the fluid, as quickly as you can. Any order; some want a climb or a jump to see.',
    marker: [12, 22], start: [14, null, 14], heading: -2.4, speed: 6,
    eyes: [[-30, -20], [-60, 10], [-95, 30], [-120, -10], [-80, -40], [-40, -60], [20, -40], [40, 20]],
    reward: 'longbreath',
  },
  // (on the jets until v1.42, when the Warden's harness went: now up the halfway air pillar, src/shaft-pillars.js)
  incal: {
    id: 'trial-incal', world: 'incal', mode: 'glider', name: 'Shaft climb', color: '#ffd36a',
    blurb: 'Rings of light up the halfway air pillar, from the middle terrace to the rim.',
    rules: 'Glide into the air pillar and ride it up through every ring in order, then steer out of its top and glide over the rim through the last.',
    marker: [262, -12], start: [-61.0, -24, 205.1], heading: 2.85, speed: 9,
    gates: [[-53.3, -6, 179.2, 6], [-53.3, 40, 179.2, 6], [-53.3, 90, 179.2, 6], [-53.3, 140, 179.2, 6], [-53.3, 190, 179.2, 6], [-72.7, 211, 244.4, 9]],
    reward: 'deepwell',
  },
  // (the Sealed Hangar's Pillar slalom until October 2026, its world dismissed: the jets' run moved to the Glass Dunes;
  // on the wings since v1.43, the jets a debug item since v1.38: four columns of rising air carry you round)
  glassdunes: {
    id: 'trial-glassdunes', world: 'glassdunes', mode: 'glider', name: 'Glass slalom', color: '#d6a94a',
    blurb: 'A slalom of the glass dunes on the wings: up a column of rising air by the ship, round the Clock-House, up again by the billows, under the breaking wave, round the giants’ cliff and home.',
    rules: 'Open your wings in the first column and ride it up, then glide through every ring in order; each column on the way lifts you again. Round the walls of glass and back down the valley to the ship.',
    marker: [14, 212], start: [18, null, 204], heading: 3.1, speed: 12,
    winds: [[18, 204, 7, 58, 9], [140, 0, 7, 60, 9], [-60, -130, 7, 56, 9], [-118, 66, 7, 52, 9]],
    gates: [[18, 56, 204, 7], [60, 44, 150, 8], [96, 32, 104, 8], [140, 58, 0, 7], [90, 44, -70, 8], [20, 26, -120, 8], [-60, 54, -130, 7], [-125, 31, -20, 8], [-118, 51, 66, 7], [-60, 33, 150, 8], [5, 17, 195, 9]],
    reward: 'lodestone',
  },
  // (on the wings since v1.43: down into the canyon on a glide, and out on the column of rising air at its end)
  buried: {
    id: 'trial-buried', world: 'buried', mode: 'glider', name: 'Canyon dive', color: '#c98d4f',
    blurb: 'Rings down into the canyon north of the landing, and a column of rising air at its end to carry you out.',
    rules: 'Open your wings in the column on the rim and ride it up, then dive through every ring in order down the canyon. At its end the column lifts you out to the last ring on the rim.',
    marker: [14, 52], start: [10, null, 44], heading: 3.0, speed: 10,
    winds: [[10, 44, 7, 40, 9], [-30, -182, 7, 72, 10]],
    gates: [[10, 41, 44, 7], [-5, 34, 0, 8], [-25, 14, -60, 8], [-30, 0, -100, 8], [-30, -18, -140, 8], [-30, 35, -182, 7], [10, 27, -150, 9]],
    reward: 'fourthpouch',
  },
  spheres: {
    id: 'trial-spheres', world: 'spheres', mode: 'foot', name: 'Garden round', color: '#e8c2f0',
    blurb: 'A round of the garden on foot, past the great spheres.',
    rules: 'Run through every gate in order, round the garden and back. Climb, jump, boost, glide: anything goes.',
    marker: [10, -12], start: [14, null, -6], heading: 2.0, speed: 6, ground: true, up: 1.3,
    gates: [[40, -40, 4], [60, -100, 4], [0, -120, 4], [-50, -100, 4], [-90, -80, 4], [-165, -25, 4], [-110, 30, 4], [-90, 70, 4], [-20, 80, 4], [30, 70, 4], [20, 20, 4], [10, -2, 5]],
    reward: 'longsand',
  },
  // (the three worlds that joined the route in v1.40)
  underwater: {
    id: 'trial-underwater', world: 'underwater', mode: 'foot', name: 'Tube run', color: '#6fc8d8',
    blurb: 'Rings of light hung in the city’s halls, from the Dock through the tubes to the Garden and the Plaza.',
    rules: 'Run through every ring in order, hall to hall through the glass tubes. Jump, climb, anything goes: just don’t miss one.',
    marker: [8, 0, 116], start: [4, 0, 112], heading: 3.1, speed: 6,
    gates: [[0, 2.7, 98, 3], [0, 2.7, 40, 3], [-34, 2.7, 22, 3], [-88, 2.7, 22, 3], [-10, 2.7, 22, 3], [0, 2.7, -14, 3], [0, 2.7, -78, 3], [20, 2.7, -100, 3.5]],
    reward: 'divercap',
  },
  moonfoundry: {
    id: 'trial-moonfoundry', world: 'moonfoundry', mode: 'foot', name: 'Floor round', color: '#e89a5a',
    blurb: 'A round of the foundry floor on foot, under the hung moons and past the last furnace.',
    rules: 'Run through every gate in order, round the floor and back to the mouth. Climb, jump, boost: anything goes.',
    marker: [-10, 30], start: [-6, null, 24], heading: 3.1, speed: 6, ground: true, up: 1.3,
    gates: [[20, -10, 4], [36, -70, 4], [30, -128, 4], [84, -140, 4], [120, -80, 4], [120, -20, 4], [80, 12, 4], [30, 12, 4], [0, 30, 5]],
    reward: 'founderspin',
  },
  spacecity: {
    id: 'trial-spacecity', world: 'spacecity', mode: 'foot', name: 'Courier’s round', color: '#f0c06a',
    blurb: 'Kip’s round of the bridges: the Pier, the Gate, the Market, out to the Towers and the Garden and back.',
    rules: 'Run through every ring in order, island to island over the bridges. Don’t fall off: the dark is a long way down.',
    marker: [6, 106], start: [2, null, 102], heading: 3.1, speed: 6, ground: true, up: 1.3,
    gates: [[0, 80, 3], [0, 34, 3], [0, -10, 3], [0, -44, 3], [24, -74, 3], [56, -77, 3], [24, -74, 3], [-24, -66, 3], [-58, -63, 3], [-24, -66, 3], [0, -76, 3], [0, -104, 3], [0, -136, 3.5]],
    reward: 'courierribbon',
  },
  // (on the wings since v1.43: two columns of rising air, one at the avenue's head and one halfway)
  bazaar: {
    id: 'trial-bazaar', world: 'bazaar', mode: 'glider', name: 'Avenue run', color: '#ff5fa2',
    blurb: 'Rings of light down the market’s avenue on the wings, between the towers and over the skybridges.',
    rules: 'Open your wings in the column at the avenue’s head and ride it up, then glide through every ring in order down the avenue; halfway a second column lifts you again, on to the silent tower’s square.',
    marker: [-14, 112], start: [-6, null, 118], heading: 3.1, speed: 12,
    winds: [[-6, 118, 7, 52, 9], [0, 10, 7, 54, 9]],
    gates: [[-6, 49, 118, 7], [-15, 43, 70, 8], [15, 34, 40, 8], [0, 51, 10, 7], [-20, 46, -24, 8], [18, 36, -60, 8], [0, 29, -92, 8], [0, 21, -135, 9]],
    reward: 'racersribbon',
  },
};

/** The trials as a list, in the route's order. */
export const trialList = () => Object.values(TRIALS);
export const trialFor = (world) => TRIALS[world] ?? null;

/** A part's trial where it lies in its world (a merged world moves a part's places: src/levels/names.js PART_OFFSET). */
export function shiftTrial(part, T) {
  const o = offsetOf(part);
  if (!o[0] && !o[1] && !o[2]) return T;
  const xz = ([x, z, ...rest]) => [x + o[0], z + o[2], ...rest];
  return {
    ...T,
    marker: shiftAt(part, T.marker),
    start: shiftAt(part, T.start),
    ...(T.gates ? { gates: T.gates.map((g) => (T.ground ? xz(g) : [g[0] + o[0], g[1] + o[1], g[2] + o[2], g[3]])) } : {}),
    ...(T.winds ? { winds: T.winds.map(xz) } : {}),
    ...(T.eyes ? { eyes: T.eyes.map(xz) } : {}),
  };
}
/** The trials standing in a world: its parts' (Vael has its Wind ladder and the sky stones' Stone circuit), each where it lies. */
export const trialsFor = (world, table = TRIALS) => partsOf(world).filter((p) => table[p]).map((p) => shiftTrial(p, table[p]));
