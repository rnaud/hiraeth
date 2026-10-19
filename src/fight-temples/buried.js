// The Buried Machine's fight temple, the Tooth Gallery (issue #341; docs/design/fight-temples.md): a gear-house between
// the canyon's teeth, brass and rust, a great gear half sunk beside it, rails laid across its floors from wall to wall.
// The ore carts still run them (hazards.js 'cart'): the lamp at a rail's head blinks, then a cart runs the rail's
// length, a heart and thrown aside unless he steps off the rail or rolls, three cuts to every foe on it. The rails are
// there from the start: the floor is read before the fight. Its foes are the Buried Machine's own (src/foe-worlds.js:
// mound worms, skitters in swarms, horn lizards, crucible carts), light, many; the last wave brings three centipedes
// whole. The reward: Brass tooth (src/kit-colours.js).
//
// Its rooms: the tooth gate (no carts yet), the gear pit (two rails across it), the rail yard (four short rails across
// its width, two carts at a time), the tooth hall (rails both ways round its altar).

const R = (along, at, dir, w = 2.4) => ({ along, at, w, dir });

export const BURIED_FIGHT = {
  id: 'fight-buried', world: 'buried', colours: 'brass',
  name: 'The Tooth Gallery',
  blurb: 'A gear-house between the canyon’s teeth, its ore carts still running the rails with nobody to load them. Ink comes up between the rails. Off them when the lamps blink.',
  // the end card's first line, the place's own (issue #483: the place speaks first, the scores under it)
  quiet: 'The carts roll to a stop. Greta is already at the grease pot.',
  hour: 10.5,
  palette: { wall: '#b88a5a', wall2: '#a07548', wall3: '#6e4e34', floor: '#9a8670', floor2: '#ae9a80', floor3: '#6e5e4c', ink: '#2a2018', inkLite: '#4a3a2e', glyph: '#ffb347', cap: '#c9a24a', pale: '#ffe0b0' },
  ground: { ticks: false },
  dress: 'teeth',
  pillar: 'post',
  sky: { script: { day: ['#a8c0b0', '#efe6cc', '#8a9488', '#fff6e0', '#fff0d0'], dusk: ['#a8ab92', '#f3c39a', '#8a7c9e', '#ffe0c0', '#ffe2b8'], night: ['#1e2c34', '#3f5660', '#33485a', '#93aab2', '#f2f0e6'] } },
  spawn: [0, 0, 5],
  par: 250,
  rooms: [
    { id: 'gate', name: 'The tooth gate', x: [-6, 6], z: [-7, 7],
      springs: [[-3.5, -4.5], [3.5, -4.5], [-3.5, 2.5], [3.5, 2.5]], pillars: [],
      waves: [[['skitter', 10], ['worm', 1]], [['lizard', 4], ['skitter', 8]]] },
    { id: 'gearpit', name: 'The gear pit', x: [-11, 11], z: [-27, -9],
      springs: [[-8, -18], [8, -18], [0, -15.5], [0, -20.5]], pillars: [[-4, -18], [4, -18]],
      hazard: { kind: 'cart', every: 6.5, n: 1, lanes: [R('x', -12.5, 1), R('x', -23.5, -1)] },
      waves: [[['skitter', 12], ['lizard', 2]], [['worm', 2], ['skitter', 8], ['cart', 1], ['lizard', 1, { gorged: true }]], [['skitter', 14], ['lizard', 4], ['worm', 1, { gorged: true }]]] },
    { id: 'railyard', name: 'The rail yard', x: [-35, -13], z: [-25, -11],
      springs: [[-33.5, -18], [-28.5, -13.5], [-23.5, -22.5], [-18.5, -13.5]], pillars: [],
      hazard: { kind: 'cart', every: 5, n: 2, lanes: [R('z', -31, 1), R('z', -26, -1), R('z', -21, 1), R('z', -16, -1)] },
      waves: [[['lizard', 4], ['skitter', 12], ['worm', 2]], [['skitter', 14], ['cart', 1], ['lizard', 2], ['skitter', 1, { gorged: true }]]] },
    { id: 'toothhall', name: 'The tooth hall', x: [-37, -13], z: [-51, -27],
      springs: [[-25, -29], [-35, -39], [-15, -39], [-25, -49]], pillars: [[-29, -35], [-21, -35], [-29, -43], [-21, -43]], altar: [-25, -39],
      hazard: { kind: 'cart', every: 5, n: 2, lanes: [R('x', -31, 1), R('x', -47, -1), R('z', -33, 1), R('z', -17, -1)] },
      waves: [[['cart', 2], ['lizard', 4], ['skitter', 12], ['worm', 1, { gorged: true }]], [['centipede', 3, { tough: true }], ['skitter', 16], ['lizard', 4], ['worm', 2], ['cart', 1, { gorged: true }], ['lizard', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'w', at: 0, w: 4 },
    { from: 2, to: 3, side: 'n', at: 0, w: 4 },
  ],
  // the way in: on open ground east of the domes (src/levels/buried.js HERO_DOME), facing Wen's great dome
  entrance: { at: [22, null, 28], heading: Math.atan2(-30 - 22, -6 - 28), near: [-30, -6] },
};
