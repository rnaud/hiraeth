// Viridel's fight temple, the Seed Vault (issue #341; docs/design/fight-temples.md): the white builders' cellars under
// the Builders' Greenhouse, white tile and green glass, the seed beds along their floors full of sleeping eyes. Down
// lanes of the floor the eyes open one by one and then flash (hazards.js 'bloom'): caught in it he is dazzled (the
// screen white a moment, a little harm) unless he rolls through; every foe in it is stunned and cut, and the moths
// are drawn into it from a little way off, so a swarm is led onto a bed before it opens. Its foes are Viridel's own
// (src/foe-worlds.js: signal moths in threes, root knots, blots), light, many; the last wave brings a furnace brute
// out of the boiler room and a whole root knot. The reward: Leafglass (src/kit-colours.js).
//
// Its rooms: the potting cellar (no eyes yet), the long bed (two beds down its length), the boiler room (pipes for
// pillars, the beds across it both ways), the seed safe (four beds round its altar).

const B = (along, at, dir, w = 2.6) => ({ along, at, w, dir });

export const EDENA_FIGHT = {
  id: 'fight-edena', world: 'edena', colours: 'leafglass',
  name: 'The Seed Vault',
  blurb: 'The white builders’ cellars under the greenhouse, their seed beds full of sleeping eyes. Something wakes them now: four rooms of it.',
  hour: 10.8,
  palette: { wall: '#eef0e6', wall2: '#dfe4d6', wall3: '#b4bca8', floor: '#d6dccb', floor2: '#e6ecda', floor3: '#a8b298', ink: '#22302a', inkLite: '#3e5a4a', glyph: '#8fd86a', cap: '#7fa86a', pale: '#f4ffe8' },
  ground: { ticks: false },
  dress: 'greenhouse',
  pillar: 'pipe',
  sky: { script: { day: ['#5ea7da', '#e3efe0', '#98a6c6', '#fff8e8', '#fffbe8'], dusk: ['#8f9fd8', '#f6c6a8', '#8a86c8', '#ffe6d0', '#fff0d6'], night: ['#18264e', '#3a4c80', '#34407a', '#9ab0d8', '#f2f0e6'] } },
  spawn: [0, 0, 3.5],
  par: 250,
  rooms: [
    { id: 'potting', name: 'The potting cellar', x: [-7, 7], z: [-6, 6],
      springs: [[-4.5, -3.5], [4.5, -3.5], [-4.5, 3], [4.5, 3]], pillars: [],
      waves: [[['moth', 6], ['blot', 4]], [['rootknot', 2], ['moth', 6], ['blot', 4]]] },
    { id: 'longbed', name: 'The long bed', x: [-6, 6], z: [-32, -8],
      springs: [[0, -11], [0, -29], [0, -20]], pillars: [],
      hazard: { kind: 'bloom', every: 6.5, n: 1, lanes: [B('z', -3.2, 1), B('z', 3.2, -1)] },
      waves: [[['moth', 9], ['blot', 6]], [['rootknot', 3], ['moth', 6], ['blot', 1, { gorged: true }]], [['moth', 12], ['blot', 6], ['rootknot', 1, { gorged: true }]]] },
    { id: 'boiler', name: 'The boiler room', x: [-28, -8], z: [-28, -12],
      springs: [[-26, -14], [-10, -14], [-26, -26], [-10, -26]], pillars: [[-22, -16], [-14, -16], [-22, -24], [-14, -24]],
      hazard: { kind: 'bloom', every: 5.5, n: 1, lanes: [B('x', -20, 1), B('z', -18, -1)] },
      waves: [[['rootknot', 3], ['moth', 9], ['blot', 4]], [['blot', 10], ['moth', 6], ['moth', 1, { gorged: true }]]] },
    { id: 'safe', name: 'The seed safe', x: [-32, -8], z: [-54, -30],
      springs: [[-20, -32], [-30.5, -42], [-9.5, -42], [-20, -52]], pillars: [[-25, -38], [-15, -38], [-25, -46], [-15, -46]], altar: [-20, -42],
      hazard: { kind: 'bloom', every: 5, n: 2, lanes: [B('x', -34, 1), B('x', -50, -1), B('z', -29, 1), B('z', -11, -1)] },
      waves: [[['moth', 12], ['rootknot', 3], ['blot', 8], ['rootknot', 1, { gorged: true }]], [['brute', 1, { tough: true }], ['rootknot', 1, { tough: true }], ['moth', 12], ['blot', 10], ['rootknot', 2], ['blot', 1, { gorged: true }], ['moth', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'w', at: 0, w: 4 },
    { from: 2, to: 3, side: 'n', at: 0, w: 4 },
  ],
  // the way in: on the plateau west-south-west of the Builders' Greenhouse, by the top of the water stair (src/viridel-stair.js
  // HILL), facing the Greenhouse's door
  entrance: { at: [89, null, 292], heading: Math.atan2(112.9 - 89, 304.2 - 292), near: [110, 320] },
};
