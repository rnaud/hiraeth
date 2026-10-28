// The City-Shaft's fight temple, the Lift Depot (issue #341; docs/design/fight-temples.md): the old cab bays on a ledge
// of the shaft, iron decks over the drop, the shaft's far wall of lit windows all round and the cranes' jibs over the
// bays. The cranes still work, and nobody drives them (hazards.js 'drop'): a ring tightens on the deck under him and
// round him as a load comes down, and it lands: a heart unless he is out of the ring or rolls, three cuts to every foe
// under it. Its foes are the City-Shaft's own (its horde, src/foe-worlds.js: horn lizards in pairs, bellows toads, lamp tripods),
// light, many; the last wave brings two shades. The reward: Cab yellow (src/kit-colours.js).
//
// Its rooms: the cab stand (no loads yet), the first bay, the second bay (its door off to one side), the dispatch
// floor (three loads at a time round its altar).

export const INCAL_FIGHT = {
  id: 'fight-incal', world: 'incal', colours: 'cab',
  name: 'The Lift Depot',
  blurb: 'The old cab bays on a ledge of the shaft, where the cranes still lower their loads on their own. Mind what comes down, and what comes up.',
  // the end card's first line, the place's own (issue #483: the place speaks first, the scores under it)
  quiet: 'The chains hang still. Ulric climbs back up to his levers.',
  hour: 12.5,
  palette: { wall: '#6a707a', wall2: '#5a5f6a', wall3: '#3e424c', floor: '#8a9098', floor2: '#9aa0a8', floor3: '#6a7078', ink: '#1e2028', inkLite: '#3a4050', glyph: '#ffd36a', cap: '#e8b83a', pale: '#fff0b0' },
  ground: { ticks: false },
  outside: 'cliff',
  dress: 'shaft',
  pillar: 'post',
  sky: { script: { day: ['#7fb2d8', '#e8e6dc', '#7f94b8', '#fff8ea', '#fff4dc'], dusk: ['#8a8fc8', '#f4a8a0', '#8a6fb8', '#ffd2c0', '#ffe2b8'], night: ['#1d2250', '#4a4a8a', '#3d3a80', '#9a9ad0', '#f2f0e6'] } },
  spawn: [0, 0, 3.5],
  par: 250,
  lightHarm: 0.2,   // (its light foes strike at a fifth of their kind: session.js; the toads' lobs and the tripods' bolts come
  // from afar while the lizards close in and the loads fall, issue #532)
  rooms: [
    { id: 'cabstand', name: 'The cab stand', x: [-7, 7], z: [-6, 6],
      springs: [[-4.5, -3.5], [4.5, -3.5], [-4.5, 3], [4.5, 3]], pillars: [],
      waves: [[['lizard', 4], ['toad', 1]], [['lizard', 6], ['tripod', 1]]] },
    { id: 'bayone', name: 'The first bay', x: [-10, 10], z: [-26, -8],
      springs: [[-7, -11], [7, -11], [-7, -23], [7, -23]], pillars: [[-5, -17], [5, -17]],
      hazard: { kind: 'drop', every: 6, n: 2 },
      waves: [[['lizard', 8], ['toad', 2]], [['tripod', 1], ['lizard', 6], ['toad', 2], ['toad', 1, { gorged: true }]], [['lizard', 12], ['toad', 2], ['lizard', 1, { gorged: true }]]] },
    { id: 'baytwo', name: 'The second bay', x: [-6, 14], z: [-44, -28],
      springs: [[-3, -31], [11, -31], [-3, -41], [11, -41]], pillars: [[0, -36], [8, -36]],
      hazard: { kind: 'drop', every: 5, n: 2 },
      waves: [[['toad', 4], ['lizard', 8]], [['lizard', 12], ['toad', 2], ['tripod', 1, { gorged: true }]]] },
    { id: 'dispatch', name: 'The dispatch floor', x: [-30, -8], z: [-50, -28],
      springs: [[-27, -31], [-11, -31], [-27, -47], [-11, -47], [-19, -47]], pillars: [[-25, -33], [-13, -33], [-25, -45], [-13, -45]], altar: [-19, -39],
      hazard: { kind: 'drop', every: 4.5, n: 2 },
      waves: [[['lizard', 10], ['toad', 3], ['tripod', 2], ['lizard', 1, { gorged: true }]], [['shade', 2, { tough: true }], ['lizard', 14], ['toad', 3], ['tripod', 1], ['toad', 1, { gorged: true }], ['lizard', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'n', at: 4, w: 4 },
    { from: 2, to: 3, side: 'w', at: 0, w: 4 },
  ],
  // the way in: on the middle terrace by its cab stop (src/levels/incal.js), facing the stop; its height given (the
  // ground found from above is the structure overhead). Issue #384: 1.8 m north, to the middle of the lane, so the corner
  // before it no longer hides half its gatehouse
  entrance: { at: [236, -24, 44.3], heading: Math.atan2(208.3 - 236, 41.9 - 42.5), near: [208.3, 41.9] },
};
