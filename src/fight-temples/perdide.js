// Lorn's fight temple, the Drowned Mill (issue #341; docs/design/fight-temples.md): the reed-cutters' old mill, its race
// choked and its floors under a hand of water, the stones still turning when something leans on the gear. Down lanes of
// its floors the millstones come rolling (hazards.js 'stone': the lane's edges show in rust and the stone rises at its
// head, then it rolls the length of the room): it crushes you for a heart unless you roll through it or step aside, and
// everything it rolls over. Its foes are Lorn's own (src/foe-worlds.js: bellows toads lobbing from afar, root knots,
// skitters in swarms, a stilt heron or two), light, many; the last wave brings a shade out of the Deep Wood and a whole
// root knot. The reward: Reed and rust (src/kit-colours.js).
//
// Its rooms: the mill race (long and narrow, no stones yet), the wheel pit (the stones across it east and west), the
// grinding floor (the stones rolling down it toward you, three lanes), the miller's hall (the stones both ways round
// its altar). The template (rules.js, rooms.js, session.js) does the rest.

const L = (along, at, dir, w = 2.8) => ({ along, at, w, dir });

export const PERDIDE_FIGHT = {
  id: 'fight-perdide', world: 'perdide', colours: 'reed',
  name: 'The Drowned Mill',
  blurb: 'The reed-cutters’ old mill, its floors under a hand of water. The stones still roll in there, and ink comes up through the flood.',
  // the end card's first line, the place's own (issue #483: the place speaks first, the scores under it)
  quiet: 'The water clears. Gert puts his shoulder to the gear.',
  hour: 17.6,
  palette: { wall: '#b6a888', wall2: '#a4977a', wall3: '#7a705c', floor: '#7d8866', floor2: '#909c76', floor3: '#5e684e', ink: '#232a3c', inkLite: '#3e4c6a', glyph: '#7fd0b8', cap: '#8e5e3a', pale: '#d8f4e8' },
  ground: { ticks: false },
  water: { color: '#6f9a94', color2: '#86b0a8', ripple: '#c8e4da', y: 0.035 },
  dress: 'mill',
  pillar: 'stack',
  sky: { script: { day: ['#6aa0c8', '#e9d6bf', '#8a86c4', '#effff8', '#fff6dc'], dusk: ['#5a6aa8', '#f0a888', '#7a6aa8', '#ffd8c0', '#ffc8a0'], night: ['#141a3a', '#3a3f78', '#3d3478', '#7fd6c8', '#f2f0e6'] }, planets: [{ az: 70, el: 22, size: 16, color: '#c7a6f2', ring: 0.35 }] },
  spawn: [0, 0, 5.5],
  par: 260,
  rooms: [
    { id: 'race', name: 'The mill race', x: [-6, 6], z: [-8, 8],
      springs: [[-3.5, -5.5], [3.5, -5.5], [-3.5, 1.5], [3.5, 1.5]], pillars: [],
      waves: [[['skitter', 10], ['toad', 1]], [['rootknot', 2], ['skitter', 8], ['toad', 1]]] },
    { id: 'wheelpit', name: 'The wheel pit', x: [-10, 10], z: [-26, -10],
      springs: [[-7, -12.5], [7, -12.5], [-7, -23.5], [7, -23.5]], pillars: [[-5, -18], [5, -18]],
      hazard: { kind: 'stone', every: 7, n: 1, lanes: [L('x', -14.5, 1), L('x', -21.5, -1)] },
      waves: [[['skitter', 12], ['toad', 2]], [['rootknot', 3], ['skitter', 6], ['heron', 1], ['toad', 1, { gorged: true }]], [['toad', 3], ['skitter', 14], ['rootknot', 1, { gorged: true }]]] },
    { id: 'grinding', name: 'The grinding floor', x: [-18, 6], z: [-46, -28],
      springs: [[-16, -30.5], [4, -30.5], [-16, -43.5], [4, -43.5], [-6, -43.5]], pillars: [[-9, -33], [-1, -41]],
      hazard: { kind: 'stone', every: 6, n: 2, lanes: [L('z', -13, 1), L('z', -5, 1), L('z', 3, 1)] },
      waves: [[['heron', 2], ['toad', 3], ['skitter', 10]], [['rootknot', 3], ['skitter', 12], ['toad', 2], ['heron', 1, { gorged: true }]]] },
    { id: 'hall', name: 'The miller’s hall', x: [-42, -20], z: [-48, -26],
      springs: [[-40, -34], [-22, -34], [-40, -40], [-22, -40], [-31, -46]], pillars: [[-35, -33], [-27, -33], [-35, -41], [-27, -41]], altar: [-31, -37],
      hazard: { kind: 'stone', every: 5.5, n: 2, lanes: [L('x', -29, 1), L('x', -45, -1), L('z', -38.5, 1), L('z', -23.5, 1)] },
      waves: [[['toad', 4], ['skitter', 12], ['rootknot', 2], ['toad', 1, { gorged: true }]], [['shade', 1, { tough: true }], ['rootknot', 1, { tough: true }], ['skitter', 16], ['toad', 4], ['heron', 2], ['rootknot', 1, { gorged: true }], ['toad', 1, { gorged: true }]]] },
  ],
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'n', at: -4, w: 4 },
    { from: 2, to: 3, side: 'w', at: 0, w: 4 },
  ],
  // the way in: on the dry flank of the landing's hill, south-east of the landing island (src/levels/perdide.js), facing it
  entrance: { at: [20, null, -45], heading: Math.atan2(0 - 20, 0 - -45), near: [0, 0] },
};
