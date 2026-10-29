// The Moon Foundry's fight temple, the Pour Floor (issue #341; docs/design/fight-temples.md): the casting bays under the
// house, where the moons' metal was poured, the house still pouring by itself. Its floors are cut with channels, drawn
// from the start (hazards.js 'pour': a channel's rim glows, then the slag runs down it and lies there a while): in it
// you burn, half a heart a tick, unless you are out of it or roll across; every foe in it burns too. The floor is read
// before the fight: where the channels run, and where to stand. Its foes are the Foundry's own (src/foe-worlds.js:
// crucible carts, skitters in the rails, horn lizards; cinder wisps over the heat since issue #398), light, many; the last wave brings a furnace brute and two
// whole carts. The reward: Moon slag (src/kit-colours.js).
//
// Its rooms: the tapping bay (no pour yet), the casting bays (three channels down it, columns of iron between), the
// mould floor (two channels along it, a narrow dry middle), the great crucible (channels both ways round its altar).
// The template (rules.js, rooms.js, session.js) does the rest.

// (the Foundry's sky and look, as src/levels/moon-foundry-kit.js MF_DAY … MF_LOOK: copied, so the games' bundle does
// not pull the world's kits in)
const MF_DAY = ['#bccad0', '#ece6d0', '#787482', '#fff6e4', '#fff0d0'], MF_DUSK = ['#9fa8c8', '#f2cfa6', '#8a80a8', '#ffe2c4', '#ffc890'], MF_NIGHT = ['#151a34', '#2a3050', '#30365e', '#7278a4', '#dce0f2'];
const MF_LOOK = { uClouds: 0, uCumulus: 0, uSkyDots: 0.12, uHatch: 0.42, uLineWidth: 0.95, uWobble: 0.2, uFogDensity: 0.0009, uShadeKeep: 0.6, uHalftone: 0.15, uBounce: 0.15, uSpot: [1, 3, 0.3, 0.35], uSpotTone: [0.16, 0.13, 0.12, 0.45], uHazeLayers: [80, 1.6, 0.2, 5], uHazeTone: [0.93, 0.91, 0.84, 0.85] };

const C = (along, at, dir, w = 2.4) => ({ along, at, w, dir });

export const MOONFOUNDRY_FIGHT = {
  id: 'fight-moonfoundry', world: 'moonfoundry', colours: 'slag',
  name: 'The Pour Floor',
  blurb: 'The casting bays under the Foundry, where the house still pours by itself. Mind the channels in the floor, and what comes up to stand by the heat.',
  // the end card's first line, the place's own (issue #483: the place speaks first, the scores under it)
  quiet: 'The bays go still. Marta takes up her tapping rod.',
  hour: 10.5,
  palette: { wall: '#e8dcc4', wall2: '#d8ccb2', wall3: '#a99a86', floor: '#bdb9b0', floor2: '#cfcac0', floor3: '#8f8a84', ink: '#2a2228', inkLite: '#5a4a4a', glyph: '#ff8a3e', cap: '#9a7a48', pale: '#ffd8a8', slag: '#ff8a3e', slag2: '#ffd36a', crust: '#6a5a50' },
  ground: { ticks: false },
  dress: 'foundry',
  pillar: 'post',
  sky: { script: { day: MF_DAY, dusk: MF_DUSK, night: MF_NIGHT }, planets: [{ az: 200, el: 34, size: 3.2, color: '#f2e6cc', craters: true }, { az: 120, el: 22, size: 1.1, color: '#e6dccb', craters: true }] },
  look: MF_LOOK,
  spawn: [0, 0, 4.5],
  par: 260,
  rooms: [
    { id: 'tapping', name: 'The tapping bay', x: [-7, 7], z: [-7, 7],
      springs: [[-4.5, -4.5], [4.5, -4.5], [-4.5, 2.5], [4.5, 2.5]], pillars: [],
      waves: [[['skitter', 10], ['lizard', 2]], [['cart', 1], ['skitter', 10], ['lizard', 1]]] },
    { id: 'bays', name: 'The casting bays', x: [-12, 12], z: [-29, -9],
      springs: [[-10, -11.5], [10, -11.5], [-10, -26.5], [10, -26.5]], pillars: [[-4, -14], [4, -14], [-4, -24], [4, -24]],
      hazard: { kind: 'pour', every: 6.5, n: 1, lanes: [C('z', -8, 1), C('z', 0, 1), C('z', 8, 1)] },
      waves: [[['lizard', 4], ['skitter', 10]], [['cart', 2], ['skitter', 8], ['lizard', 1, { gorged: true }]], [['skitter', 16], ['lizard', 3], ['cart', 1, { gorged: true }]]] },
    { id: 'moulds', name: 'The mould floor', x: [-34, -14], z: [-26, -12],
      springs: [[-32, -19], [-16, -19], [-24, -19]], pillars: [],
      hazard: { kind: 'pour', every: 5.5, n: 1, lanes: [C('x', -15.5, -1), C('x', -22.5, 1)] },
      waves: [[['lizard', 3], ['skitter', 12], ['cart', 1]], [['skitter', 14], ['lizard', 3], ['wisp', 1], ['skitter', 1, { gorged: true }]]] },
    { id: 'crucible', name: 'The great crucible', x: [-38, -14], z: [-52, -28],
      springs: [[-36, -30], [-16, -30], [-36, -50], [-16, -50], [-26, -50]], pillars: [[-30, -36], [-22, -36], [-30, -44], [-22, -44]], altar: [-26, -40],
      hazard: { kind: 'pour', every: 5, n: 2, lanes: [C('z', -33, 1), C('z', -19, 1), C('x', -32.5, -1), C('x', -47.5, 1)] },
      waves: [[['cart', 2], ['lizard', 4], ['skitter', 12], ['wisp', 2], ['lizard', 1, { gorged: true }]], [['brute', 1, { tough: true }], ['cart', 2, { tough: true }], ['skitter', 16], ['lizard', 4], ['cart', 1, { gorged: true }], ['skitter', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'w', at: 0, w: 4 },
    { from: 2, to: 3, side: 'n', at: 0, w: 4 },
  ],
  // the way in: on the open floor south of the workers' quarter (src/levels/moon-foundry.js QUARTER, -102, -46), facing it
  entrance: { at: [-102, null, -6], heading: Math.atan2(-102 - -102, -46 - -6), near: [-102, -46] },
};
