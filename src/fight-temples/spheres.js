// The Garden of Spheres' fight temple, the Quiet Orchard (issue #341; docs/design/fight-temples.md): the spheres' walled
// gardens at dusk, white walls, trees for pillars, the lawns between them, spheres hung over the garden walls. As a sphere
// rolls overhead its shadow sweeps a garden end to end (hazards.js 'shade': its edge glows where it will come from, then
// the band crosses the room): in the shade the hounds bite, a little harm a tick, and a foe in it can't be aimed at;
// in the light they can. So the fight keeps to the light, ahead of the shade or behind it. Its foes are the Garden's own
// (src/foe-worlds.js: pearl rollers, centipedes made light, antler hounds in pairs, shades), light, many; the last wave
// brings the glass marionette and two whole hounds. The reward: Orchard dusk (src/kit-colours.js).
//
// Its rooms: the gatehouse (no shade yet), the orchard (trees in rows), the lawn (open, the shade across it short and
// often), the round garden (four trees round its altar, the shade both ways).

export const SPHERES_FIGHT = {
  id: 'fight-spheres', world: 'spheres', colours: 'orchard',
  name: 'The Quiet Orchard',
  blurb: 'The spheres’ walled gardens at dusk, where the shade of a rolling sphere sweeps the lawns. The hounds run in it, and the gardens are full of them: four.',
  hour: 17.8,
  palette: { wall: '#ece6d8', wall2: '#ddd6c6', wall3: '#aaa494', floor: '#a8b878', floor2: '#b8c888', floor3: '#7a8a5a', ink: '#2a2a3a', inkLite: '#4a4a6a', glyph: '#f4c86a', cap: '#c9b08a', pale: '#fff0d0', shade: '#3e3a5a' },
  ground: { ticks: true },
  dress: 'orchard',
  pillar: 'tree',
  sky: { script: { day: ['#8fb4d8', '#f0e4cc', '#8a90c0', '#fff8ea', '#fff2d8'], dusk: ['#7a86c8', '#f4bfa0', '#8a7ab8', '#ffe0c8', '#ffd8b0'], night: ['#1a2050', '#3a4080', '#34307a', '#9aa0d8', '#f2f0e6'] } },
  spawn: [0, 0, 5],
  par: 250,
  rooms: [
    { id: 'gatehouse', name: 'The gatehouse', x: [-6, 6], z: [-7, 7],
      springs: [[-3.5, -4.5], [3.5, -4.5], [-3.5, 2.5], [3.5, 2.5]], pillars: [],
      waves: [[['roller', 2], ['hound', 2]], [['hound', 4], ['centipede', 2]]] },
    { id: 'orchard', name: 'The orchard', x: [-11, 11], z: [-27, -9],
      springs: [[-8, -12], [8, -12], [-8, -24], [8, -24]], pillars: [[-5, -13], [5, -13], [-5, -18], [5, -18], [-5, -23], [5, -23]],
      hazard: { kind: 'shade', every: 7, n: 1, lanes: [{ along: 'z', dir: 1 }, { along: 'x', dir: -1 }] },
      waves: [[['hound', 6], ['roller', 3]], [['centipede', 3], ['hound', 6], ['roller', 1, { gorged: true }]], [['hound', 10], ['roller', 3], ['hound', 1, { gorged: true }]]] },
    { id: 'lawn', name: 'The lawn', x: [-35, -13], z: [-25, -11],
      springs: [[-33, -13], [-33, -23], [-15, -13], [-24, -23]], pillars: [],
      hazard: { kind: 'shade', every: 6, n: 1, lanes: [{ along: 'z', dir: -1 }, { along: 'z', dir: 1 }] },
      waves: [[['roller', 4], ['hound', 6], ['centipede', 2]], [['hound', 10], ['shade', 1], ['roller', 2], ['centipede', 1, { gorged: true }]]] },
    { id: 'round', name: 'The round garden', x: [-37, -13], z: [-51, -27],
      springs: [[-25, -29], [-35, -39], [-15, -39], [-25, -49]], pillars: [[-30, -34], [-20, -34], [-30, -44], [-20, -44]], altar: [-25, -39],
      hazard: { kind: 'shade', every: 5.5, n: 1, lanes: [{ along: 'x', dir: 1 }, { along: 'x', dir: -1 }, { along: 'z', dir: 1 }, { along: 'z', dir: -1 }] },
      waves: [[['hound', 8], ['roller', 4], ['centipede', 3], ['hound', 1, { gorged: true }]], [['marionette', 1, { tough: true }], ['hound', 2, { tough: true }], ['hound', 16], ['roller', 4], ['shade', 2], ['roller', 1, { gorged: true }], ['centipede', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'w', at: 0, w: 4 },
    { from: 2, to: 3, side: 'n', at: 0, w: 4 },
  ],
  // the way in: west of the round plaza, outside its hedge (src/levels/spheres.js LAYOUT.plaza), facing the plaza
  entrance: { at: [-38, null, -622], heading: Math.atan2(0 - -38, -622 - -622), near: [0, -622] },
};
