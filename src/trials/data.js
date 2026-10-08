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
  incal: {
    id: 'trial-incal', world: 'incal', mode: 'jets', name: 'Shaft climb', color: '#ffd36a',
    blurb: 'Rings of light up the City-Shaft, from a ledge far down to the rim.',
    rules: 'On the jets, fly up through every ring in order to the rim. Land if the tank runs dry; it fills again.',
    marker: [262, -12], start: [-50, null, 125], heading: 1.1, speed: 9,
    gates: [[-20, 10, 140, 9], [70, 40, 130, 9], [130, 70, 60, 9], [140, 100, -30, 9], [80, 130, -120, 9], [-20, 155, -150, 9], [-120, 175, -90, 9], [-150, 195, 10, 9], [-120, 215, 110, 10]],
    reward: 'deepwell',
  },
  garage: {
    id: 'trial-garage', world: 'garage', mode: 'jets', name: 'Pillar slalom', color: '#d6a94a',
    blurb: 'A slalom of the plain’s pillars on the jets, low and fast.',
    rules: 'Fly through every ring in order, round the pillars and back over the plain.',
    marker: [18, 108], start: [24, null, 100], heading: 3.1, speed: 12,
    gates: [[-30, 14, 60, 8], [-60, 20, 0, 8], [-30, 30, -60, 8], [60, 32, -100, 8], [140, 30, -80, 8], [150, 16, 10, 8], [80, 14, 60, 8], [30, 12, 90, 9]],
    reward: 'lodestone',
  },
  buried: {
    id: 'trial-buried', world: 'buried', mode: 'jets', name: 'Canyon dive', color: '#c98d4f',
    blurb: 'Rings down into the canyon north of the landing, and out again.',
    rules: 'On the jets, dive through every ring in order down the canyon and climb out at its end.',
    marker: [14, 52], start: [10, null, 44], heading: 3.0, speed: 10,
    gates: [[-5, 22, 0, 8], [-25, 8, -60, 8], [-30, -4, -100, 8], [-30, -16, -140, 8], [-30, 0, -175, 8], [10, 24, -150, 9]],
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
  bazaar: {
    id: 'trial-bazaar', world: 'bazaar', mode: 'jets', name: 'Avenue run', color: '#ff5fa2',
    blurb: 'Rings of light down the market’s avenue, between the towers and over the skybridges.',
    rules: 'On the jets, fly through every ring in order down the avenue to the silent tower’s square.',
    marker: [-14, 112], start: [-6, null, 118], heading: 3.1, speed: 12,
    gates: [[-15, 12, 70, 8], [15, 24, 40, 8], [0, 34, 28, 8], [-20, 38, -20, 8], [18, 42, -60, 8], [0, 42, -92, 8], [0, 26, -135, 9]],
    reward: 'racersribbon',
  },
};

/** The trials as a list, in the route's order. */
export const trialList = () => Object.values(TRIALS);
export const trialFor = (world) => TRIALS[world] ?? null;
