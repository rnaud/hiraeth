// The Glass Dunes' fight temple, the Kiln Yard (issue #341; docs/design/fight-temples.md): the glassworkers' cooling
// sheds, their floors laid in tiles of glass over the kilns' glow, chimneys for pillars, glass shards on the dunes round
// them. The glass cracks under a crowd now (hazards.js 'crack'): a tile under him and tiles near him crack white, then
// break, pits to the kilns' glow until they glaze over: in one he burns, half a heart a tick, and so do the foes. Its
// foes are the Glass Dunes' own (src/foe-worlds.js: glass crabs, mantas, mound worms, a furnace walker or two made
// light), light, many; the last wave brings two clock-house drones and a whole furnace walker. The reward: Furnace
// glass (src/kit-colours.js).
//
// Its rooms: the packing shed (no cracks yet), the cooling shed (four chimneys), the annealing floor (open, the tiles
// breaking two at a time), the great kiln (three at a time round its altar).

export const GLASSDUNES_FIGHT = {
  id: 'fight-glassdunes', world: 'glassdunes', colours: 'furnace',
  name: 'The Kiln Yard',
  blurb: 'The glassworkers’ cooling sheds, floored in glass over the kilns. The glass cracks under a crowd, and the ink brings one up.',
  // the end card's first line, the place's own (issue #483: the place speaks first, the scores under it)
  quiet: 'The glass stops ringing. Ozren goes back to his kilns.',
  hour: 15.2,
  palette: { wall: '#e8d8b0', wall2: '#d8c498', wall3: '#a8946c', floor: '#cfe9e0', floor2: '#e0f4ee', floor3: '#9cc8bc', ink: '#203038', inkLite: '#3a5a66', glyph: '#ff9a4a', cap: '#d6a94a', pale: '#fff0d8', slag: '#ff7a3a', slag2: '#ffd36a' },
  ground: { ticks: false },
  dress: 'kiln',
  pillar: 'chimney',
  sky: { script: { day: ['#8cc0d0', '#f2e6c8', '#8a9cb8', '#fff8e8', '#fff4d8'], dusk: ['#8a8fc8', '#f4b890', '#8a7fb8', '#ffe0c0', '#ffd8a8'], night: ['#1a2448', '#3a4a7a', '#2a3a6a', '#8ab0c8', '#f2f0e6'] } },
  spawn: [0, 0, 3.5],
  par: 250,
  lightHarm: 0.15,   // (its light foes strike at 0.15 of their kind: session.js; its crabs throw most blows, issue #532)
  stage: 1,   // (the crowd fought as stage 1's: session.js; the world's own struck too many at once)
  rooms: [
    { id: 'packing', name: 'The packing shed', x: [-6, 6], z: [-6, 6],
      springs: [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3], [3.5, 3]], pillars: [],
      waves: [[['crab', 4], ['worm', 1]], [['ray', 2], ['crab', 4], ['worm', 1]]] },
    { id: 'cooling', name: 'The cooling shed', x: [-10, 10], z: [-28, -8],
      springs: [[-7, -11], [7, -11], [-7, -25], [7, -25]], pillars: [[-5, -14], [5, -14], [-5, -22], [5, -22]],
      hazard: { kind: 'crack', every: 6, n: 1 },
      waves: [[['crab', 8], ['worm', 2]], [['ray', 3], ['crab', 6], ['brute', 1], ['crab', 1, { gorged: true }]], [['crab', 10], ['worm', 2], ['ray', 2], ['worm', 1, { gorged: true }]]] },
    { id: 'annealing', name: 'The annealing floor', x: [-34, -12], z: [-26, -12],
      springs: [[-32, -14], [-32, -24], [-14, -14], [-23, -24]], pillars: [],
      hazard: { kind: 'crack', every: 5, n: 2 },
      waves: [[['ray', 3], ['crab', 8], ['worm', 2]], [['crab', 10], ['ray', 2], ['ray', 1, { gorged: true }]]] },
    { id: 'kiln', name: 'The great kiln', x: [-36, -12], z: [-52, -28],
      springs: [[-24, -30], [-34, -40], [-14, -40], [-24, -50]], pillars: [[-30, -34], [-18, -34], [-30, -46], [-18, -46]], altar: [-24, -40],
      hazard: { kind: 'crack', every: 4.5, n: 2 },
      waves: [[['crab', 9], ['ray', 2], ['worm', 2], ['crab', 1, { gorged: true }]], [['drone', 2, { tough: true }], ['brute', 1, { tough: true }], ['crab', 12], ['ray', 3], ['worm', 2], ['brute', 1, { gorged: true }], ['crab', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'w', at: 0, w: 4 },
    { from: 2, to: 3, side: 'n', at: 0, w: 4 },
  ],
  // the way in: at the west end of the north camp's awnings, the glassworkers' (src/levels/glass-dunes.js GLASS_CAMPS),
  // facing the camp
  entrance: { at: [-5, null, -184.5], heading: Math.atan2(10 - -5, -192 - -184.5), near: [10, -192] },
};
