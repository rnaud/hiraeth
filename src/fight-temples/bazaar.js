// The Signal Market's fight temple, the Back Rooms (issue #341; docs/design/fight-temples.md): the market's shuttered
// shops after hours, crates stacked in them, the signs on their walls dark. The bell walker tolls in the market above,
// and the signs answer (hazards.js 'toll'): a sign flickers on, then a ring of sound spreads from it across the room;
// its edge passing him flinches him (a little harm) unless he rolls through it, and every foe it passes is stunned and
// cut, so a crowd caught by the ring is a crowd to cut down. Its foes are the market's own (its horde, src/foe-worlds.js: horn
// lizards in pairs, antler hounds, signal moths, marionettes on their strings), light, many; the last wave brings the
// bell walker itself and a whole marionette. The reward: Signal neon (src/kit-colours.js).
//
// Its rooms: the shuttered row (no signs lit yet), the sign-painter's (two signs), the stockroom (a maze of crates,
// two signs), the counting house (four signs round its altar, two rings at a time).

export const BAZAAR_FIGHT = {
  id: 'fight-bazaar', world: 'bazaar', colours: 'neon',
  name: 'The Back Rooms',
  blurb: 'The market’s shuttered shops after hours. Up in the street the bell walker tolls, the signs on the walls ring with it, and the dark comes up through the floors.',
  // the end card's first line, the place's own (issue #483: the place speaks first, the scores under it)
  quiet: 'The signs go dark. Lettie turns her key in the lock.',
  hour: 17.4,
  palette: { wall: '#7a6a8a', wall2: '#6a5a7a', wall3: '#4a3e5a', floor: '#857a7c', floor2: '#958a8c', floor3: '#62585c', ink: '#1e1a2a', inkLite: '#3a3050', glyph: '#ff5fa2', cap: '#62c3c9', pale: '#ffe0f0' },
  ground: { ticks: false },
  dress: 'market',
  pillar: 'crate',
  sky: { script: { day: ['#8fb0d8', '#f2dcc8', '#8a86c0', '#fff4e8', '#fff0dc'], dusk: ['#6a6ab0', '#f4a0a8', '#7a5aa8', '#ffd0d8', '#ffc8b0'], night: ['#141838', '#3a3070', '#3a2a70', '#ff9ad0', '#f2f0e6'] } },
  spawn: [0, 0, 3.5],
  par: 250,
  lightHarm: 1,   // (its light foes strike as hard as their kind: session.js; its lizards' nips and the
  // marionettes' strings are the route's lightest blows, and the last temple should be its hardest: issue #532)
  rooms: [
    { id: 'row', name: 'The shuttered row', x: [-8, 8], z: [-6, 6],
      springs: [[-5, -3.5], [5, -3.5], [-5, 3], [5, 3]], pillars: [],
      waves: [[['lizard', 4], ['moth', 3]], [['hound', 2], ['lizard', 4], ['moth', 3]]] },
    { id: 'painter', name: 'The sign-painter’s', x: [-10, 10], z: [-26, -8],
      springs: [[-7, -11], [7, -11], [-7, -23], [7, -23]], pillars: [[-4.5, -14], [4.5, -14], [-4.5, -20], [4.5, -20]],
      hazard: { kind: 'toll', every: 6.5, n: 1, signs: [[0, -26], [-10, -12]] },
      waves: [[['lizard', 8], ['hound', 2]], [['marionette', 2], ['lizard', 6], ['hound', 1, { gorged: true }]], [['lizard', 10], ['moth', 6], ['lizard', 1, { gorged: true }]]] },
    { id: 'stock', name: 'The stockroom', x: [-32, -12], z: [-24, -10],
      springs: [[-30, -12], [-14, -22], [-30, -22], [-22, -12]], pillars: [[-27, -15], [-22, -20], [-17, -15]],
      hazard: { kind: 'toll', every: 5.5, n: 1, signs: [[-28, -24], [-32, -17]] },
      waves: [[['hound', 4], ['lizard', 6], ['moth', 3]], [['lizard', 10], ['marionette', 2], ['moth', 3], ['hound', 1, { gorged: true }]]] },
    { id: 'counting', name: 'The counting house', x: [-36, -12], z: [-50, -26],
      springs: [[-24, -28], [-34, -38], [-14, -38], [-24, -48]], pillars: [[-30, -32], [-18, -32], [-30, -44], [-18, -44]], altar: [-24, -38],
      hazard: { kind: 'toll', every: 5, n: 2, signs: [[-24, -50], [-36, -32], [-36, -44], [-18, -50]] },
      waves: [[['hound', 2], ['lizard', 8], ['marionette', 2], ['moth', 3], ['hound', 1, { gorged: true }]], [['bell', 1, { tough: true }], ['marionette', 1, { tough: true }], ['lizard', 12], ['hound', 4], ['moth', 6], ['lizard', 1, { gorged: true }], ['hound', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'w', at: 0, w: 4 },
    { from: 2, to: 3, side: 'n', at: 0, w: 4 },
  ],
  // the way in: in the mouth of the back alley west of the sign-hanger's ladder (src/levels/bazaar.js), facing the avenue
  entrance: { at: [-41, null, -165], heading: Math.atan2(-20.9 - -41, -164.5 - -165), near: [-20.9, -164.5] },
};
