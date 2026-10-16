// Vael's fight temple, the Wind Cloister (issue #341; docs/design/fight-temples.md): the riders' old monastery court on
// a spur of the cliff, roofless, its stalls empty, the sea of cloud far under its walls. The wind comes through it in
// gusts down lanes of the floor (hazards.js 'gust': pale chevrons run down the lane first, then it blows): it shoves
// you, and it carries every foe in the lane to the wall at its end and slams it there, so you draw the crowd into a
// lane before it blows. Its foes are Vael's own (src/foe-worlds.js: sky rays, stilt herons, blots), light, many; the
// last wave brings a crab of the sky stones and two whole herons. The reward: Rider's slate (src/kit-colours.js).
//
// Its rooms: the riders' stalls (no wind: the first room teaches the crowd), the cloister (a square court ringed by its
// arcade's columns, the gusts across it east and west), the bell walk (a long narrow gallery, the gusts across its width:
// short and often), the old roost (the gusts both ways). The template (rules.js, rooms.js, session.js) does the rest.

const W = (along, at, dir, w = 3.4) => ({ along, at, w, dir });

export const ARZACH_FIGHT = {
  id: 'fight-arzach', world: 'arzach', colours: 'slate',
  name: 'The Wind Cloister',
  blurb: 'The riders’ old monastery court on the cliff over the cloud. The wind still comes through it, and something has come in with the wind: four rooms of them.',
  hour: 9.4,
  palette: { wall: '#e6e2d8', wall2: '#d6d2c8', wall3: '#aeb0b2', floor: '#c4c8c6', floor2: '#d8dad4', floor3: '#9aa2a8', ink: '#28304a', inkLite: '#4c5a7e', glyph: '#7fc4e6', cap: '#a9a49a', pale: '#e8f6ff', gust: '#f8fbff' },
  ground: { ticks: false },
  outside: 'cliff',
  dress: 'cloister',
  pillar: 'column',
  sky: { script: { day: ['#8fc4d6', '#f6e2cc', '#8c9cc0', '#fffaf0', '#fff4dc'], dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'], night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'] } },
  spawn: [0, 0, 3.5],
  par: 250,
  rooms: [
    { id: 'stalls', name: 'The riders’ stalls', x: [-8, 8], z: [-6, 6],
      springs: [[-5, -3.5], [5, -3.5], [-5, 3], [5, 3]], pillars: [[-3, -1], [3, -1]],
      waves: [[['blot', 6], ['ray', 1]], [['blot', 8], ['heron', 2]]] },
    { id: 'cloister', name: 'The cloister', x: [-11, 11], z: [-30, -8],
      springs: [[-8, -11], [8, -11], [-8, -27], [8, -27], [0, -19]], pillars: [[-6.5, -12.5], [6.5, -12.5], [-6.5, -19], [6.5, -19], [-6.5, -25.5], [6.5, -25.5]],
      hazard: { kind: 'gust', every: 6.5, n: 1, lanes: [W('x', -15.75, 1), W('x', -22.25, -1)] },
      waves: [[['ray', 4], ['blot', 8]], [['heron', 3], ['blot', 8], ['ray', 1, { gorged: true }]], [['blot', 14], ['ray', 3], ['heron', 1, { gorged: true }]]] },
    { id: 'bellwalk', name: 'The bell walk', x: [-33, -13], z: [-24, -14],
      springs: [[-31, -16], [-31, -22], [-15, -16], [-15, -22]], pillars: [],
      hazard: { kind: 'gust', every: 5, n: 2, lanes: [W('z', -28.5, 1, 3), W('z', -23, -1, 3), W('z', -17.5, 1, 3)] },
      waves: [[['heron', 2], ['ray', 3], ['blot', 8]], [['blot', 12], ['ray', 2], ['blot', 1, { gorged: true }]]] },
    { id: 'roost', name: 'The old roost', x: [-37, -13], z: [-50, -26],
      springs: [[-34, -29], [-16, -29], [-34, -47], [-16, -47], [-25, -47]], pillars: [[-30, -33], [-20, -33], [-30, -43], [-20, -43]], altar: [-25, -38],
      hazard: { kind: 'gust', every: 5, n: 2, lanes: [W('x', -29.5, 1), W('x', -46.5, -1), W('z', -34.5, 1), W('z', -15.5, -1)] },
      waves: [[['ray', 5], ['blot', 12], ['heron', 2], ['ray', 1, { gorged: true }]], [['crab', 1, { tough: true }], ['heron', 2, { tough: true }], ['blot', 16], ['ray', 5], ['heron', 1, { gorged: true }], ['blot', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'w', at: 0, w: 4 },
    { from: 2, to: 3, side: 'n', at: 0, w: 4 },
  ],
  // the way in: on the rose cliff by the riders' monastery over the cloud (src/levels/arzach2.js MONASTERY, -240, -215:
  // the sky stones' frame, so its level is theirs), north-east of it past the Almonry, facing the monastery (its height
  // given: the cliff's top is not the ground the markers find, which is the plain's under it)
  entrance: { level: 'arzach2', at: [-215, 76.8, -172], heading: Math.atan2(-240 - -215, -215 - -172), near: [-240, -215] },
};
