// The Underwater City's fight temple, the Flooded Gallery (issue #341; docs/design/fight-temples.md): sealed halls under
// the glass, the sea beyond the domes' ribs, the lamps on their posts all that keeps the deep's dark out. Every so often
// the lamps flicker and go out (hazards.js 'dark'): the floor goes black but for the discs of light under them, and out
// of the light the cold takes a little of him each second; the foes caught in a lamp's disc are scalded, so the fight is
// fought from the lamps and the crowd drawn into them. Its foes are the city's own (src/foe-worlds.js: glass crabs,
// lantern jellies, sky rays), light, many; the last wave brings a lamp tripod and a whole crab. The reward: Pearl and
// tide (src/kit-colours.js).
//
// Its rooms: the airlock (no dark yet), the fish market (its stalls for pillars, five lamps), the long gallery (three
// lamps down a narrow hall), the whale-watch (five lamps, one on its altar).

export const UNDERWATER_FIGHT = {
  id: 'fight-underwater', world: 'underwater', colours: 'pearl',
  name: 'The Flooded Gallery',
  blurb: 'Sealed halls under the glass, where the lamps are all that keep the dark of the deep out. They flicker now, and the halls are full: four of them.',
  hour: 11,
  palette: { wall: '#d8e4e6', wall2: '#c4d4d8', wall3: '#8aa4ac', floor: '#a8c0c4', floor2: '#bcd2d4', floor3: '#7a9aa2', ink: '#14202e', inkLite: '#2a4a5e', glyph: '#7fe0e8', cap: '#9ab8c0', pale: '#e8fbff' },
  ground: { ticks: false },
  dress: 'deep',
  pillar: 'column',
  sky: { script: { day: ['#3f7fa8', '#bfe4e8', '#4a6a98', '#e8faff', '#f0fbff'], dusk: ['#3a5a98', '#e8b8b0', '#5a5aa0', '#ffe0d8', '#ffe8d8'], night: ['#0a1430', '#1a3060', '#1a2a5a', '#6ab0d0', '#e0f0ff'] } },
  spawn: [0, 0, 3.5],
  par: 250,
  lightHarm: 0.4,   // (its light foes strike at four tenths of their kind: session.js)
  stage: 1,   // (the crowd fought as stage 1's: session.js; the world's own struck too many at once)
  rooms: [
    { id: 'airlock', name: 'The airlock', x: [-7, 7], z: [-6, 6],
      springs: [[-4.5, -3.5], [4.5, -3.5], [-4.5, 3], [4.5, 3]], pillars: [],
      waves: [[['crab', 4], ['jelly', 2]], [['ray', 2], ['crab', 4], ['jelly', 2]]] },
    { id: 'market', name: 'The fish market', x: [-10, 10], z: [-26, -8],
      springs: [[-7, -11], [7, -11], [-7, -23], [7, -23]], pillars: [[-4.5, -14], [4.5, -14], [-4.5, -20], [4.5, -20]],
      hazard: { kind: 'dark', every: 9, n: 1, lamps: [[-7.5, -17], [7.5, -17], [0, -11], [0, -23]] },
      waves: [[['crab', 8], ['jelly', 3]], [['ray', 3], ['crab', 6], ['jelly', 1, { gorged: true }]], [['crab', 10], ['jelly', 4], ['crab', 1, { gorged: true }]]] },
    { id: 'gallery', name: 'The long gallery', x: [-34, -12], z: [-24, -12],
      springs: [[-32, -14], [-32, -22], [-14, -14], [-23, -22]], pillars: [],
      hazard: { kind: 'dark', every: 8, n: 1, lamps: [[-29, -18], [-22, -14.5], [-16, -21]] },
      waves: [[['ray', 3], ['crab', 8], ['jelly', 3]], [['crab', 9], ['jelly', 2], ['ray', 1, { gorged: true }]]] },
    { id: 'dome', name: 'The whale-watch', x: [-36, -12], z: [-50, -26],
      springs: [[-24, -28], [-34, -38], [-14, -38], [-24, -48]], pillars: [[-30, -32], [-18, -32], [-30, -44], [-18, -44]], altar: [-24, -38],
      hazard: { kind: 'dark', every: 7, n: 1, lamps: [[-24, -32], [-30, -38], [-18, -38], [-24, -44], [-24, -38]] },
      waves: [[['crab', 8], ['ray', 2], ['jelly', 3], ['crab', 1, { gorged: true }]], [['tripod', 1, { tough: true }], ['crab', 1, { tough: true }], ['crab', 10], ['jelly', 4], ['ray', 2], ['jelly', 1, { gorged: true }], ['ray', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'w', at: 0, w: 4 },
    { from: 2, to: 3, side: 'n', at: 0, w: 4 },
  ],
  // the way in: in the Dock hall's air, east of its middle (src/levels/underwater.js DOMES.dock), facing it; its height
  // given (the ground found from above is the seabed under the hall)
  entrance: { at: [15, 0.04, 128], heading: Math.atan2(0 - 15, 128 - 128), near: [0, 128] },
};
