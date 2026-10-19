// The City Floating in Space's fight temple, the Oil Exchange (issue #341; docs/design/fight-temples.md): the islands'
// lamp-oil depot, its decks on a rock over the dark, oil drums stacked for pillars, cables and lamps strung off its
// edges. The drums leak (hazards.js 'spill'): a pool of oil spreads on the deck under him and near him, a spark at its
// rim, then it burns: half a heart a tick in it, a cut a tick to the foes in it (the flyers above it). Its foes are the
// floating city's own (src/foe-worlds.js: ring drones with their harpoons, signal moths, pearl rollers), light, many;
// the last wave brings a lamp tripod and two whole drones. The reward: Lamp oil (src/kit-colours.js).
//
// Its rooms: the weigh house (no oil yet), the drum yard (four stacks of drums), the cable deck (its door off to one
// side, open), the clearing house (three pools at a time round its altar).

export const SPACECITY_FIGHT = {
  id: 'fight-spacecity', world: 'spacecity', colours: 'lampoil',
  name: 'The Oil Exchange',
  blurb: 'The islands’ lamp-oil depot on its rock over the dark. Its drums leak, a spark and it burns, and ink comes up among them.',
  // the end card's first line, the place's own (issue #483: the place speaks first, the scores under it)
  quiet: 'The drums stop dripping. Osric fetches his scales.',
  hour: 16.8,
  palette: { wall: '#d8c8a8', wall2: '#c8b490', wall3: '#8a7a5a', floor: '#a89a80', floor2: '#b8aa90', floor3: '#7a6e58', ink: '#1a1a28', inkLite: '#3a3a50', glyph: '#f0c06a', cap: '#8a5a3a', pale: '#fff0c8', slag: '#ff9a3a', slag2: '#ffe08a' },
  ground: { ticks: false },
  outside: 'cliff',
  dress: 'islands',
  pillar: 'drum',
  sky: { script: { day: ['#6a7ab8', '#f0d8c0', '#6a6aa8', '#fff4e0', '#ffe8c8'], dusk: ['#4a4a98', '#f0a890', '#5a4a98', '#ffd8c0', '#ffc8a0'], night: ['#0a0a28', '#2a2a60', '#2a2060', '#8a8ad0', '#f2f0e6'] } },
  spawn: [0, 0, 3.5],
  par: 250,
  lightHarm: 0.4,   // (its light foes strike at four tenths of their kind: session.js)
  stage: 2,   // (the crowd fought as stage 2's: session.js; the world's own struck too many at once)
  rooms: [
    { id: 'weigh', name: 'The weigh house', x: [-7, 7], z: [-6, 6],
      springs: [[-4.5, -3.5], [4.5, -3.5], [-4.5, 3], [4.5, 3]], pillars: [],
      waves: [[['roller', 2], ['moth', 3]], [['drone', 2], ['roller', 2], ['moth', 3]]] },
    { id: 'drumyard', name: 'The drum yard', x: [-10, 10], z: [-26, -8],
      springs: [[-7, -11], [7, -11], [-7, -23], [7, -23]], pillars: [[-5, -14], [5, -14], [-5, -20], [5, -20]],
      hazard: { kind: 'spill', every: 6.5, n: 1 },
      waves: [[['roller', 4], ['moth', 6], ['drone', 1]], [['drone', 3], ['moth', 6], ['roller', 1, { gorged: true }]], [['moth', 9], ['roller', 5], ['drone', 1, { gorged: true }]]] },
    { id: 'cable', name: 'The cable deck', x: [-6, 14], z: [-44, -28],
      springs: [[-3, -31], [11, -31], [-3, -41], [11, -41]], pillars: [],
      hazard: { kind: 'spill', every: 5.5, n: 2 },
      waves: [[['drone', 3], ['moth', 9], ['roller', 3]], [['roller', 5], ['moth', 9], ['drone', 1], ['moth', 1, { gorged: true }]]] },
    { id: 'clearing', name: 'The clearing house', x: [-30, -8], z: [-50, -28],
      springs: [[-27, -31], [-11, -31], [-27, -47], [-11, -47], [-19, -47]], pillars: [[-25, -33], [-13, -33], [-25, -45], [-13, -45]], altar: [-19, -39],
      hazard: { kind: 'spill', every: 5, n: 2 },
      waves: [[['roller', 5], ['moth', 9], ['drone', 2], ['roller', 1, { gorged: true }]], [['tripod', 1, { tough: true }], ['drone', 2, { tough: true }], ['moth', 12], ['roller', 7], ['drone', 1], ['drone', 1, { gorged: true }], ['roller', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'n', at: 4, w: 4 },
    { from: 2, to: 3, side: 'w', at: 0, w: 4 },
  ],
  // the way in: on the Towers' deck, in its far corner from the bridges (src/levels/space-city.js ISLANDS.towers), facing
  // the towers; its height given (the ground found from above misses the islands). Issue #384: out of the corner (its
  // gatehouse stood into the shaft's pillar there) onto open deck by the towers, where it has room round it
  entrance: { at: [106.6, 6, -84.1], heading: -1.22, near: [98, -84] },
};
