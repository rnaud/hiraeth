// The desert's fight temple, the Sunken Hall (issue #341; docs/design/fight-temples.md): a makers' hall the dunes
// swallowed, roofless now, four rooms down under the sand by the pilgrims' camps, where the ink pools and the blots
// breed. Its foes are the desert's own (src/foe-worlds.js: blots, skitters, mound worms, stilt herons), light, many;
// its last wave brings a lamp tripod and two whole herons. The reward: the Ember colours (src/kit-colours.js).
//
// A temple is this table: rooms (rectangles on whole metres, 2 m apart: the wall between), the doors between them,
// each room's ink springs (where its foes come up), its pillars and its waves ([kind, how many, { tough }]).
// The template (rules.js, rooms.js, session.js) does the rest.

export const DESERT_FIGHT = {
  id: 'fight-desert', world: 'desert', colours: 'ember',
  name: 'The Sunken Hall',
  blurb: 'A makers’ hall the dunes swallowed, by the pilgrims’ camps. The ink pools in it and the blots breed there: four rooms of them, and worse at the end.',
  hour: 15.6,
  palette: { wall: '#d9b98c', wall2: '#c9a479', wall3: '#a98563', floor: '#e6cc9c', floor2: '#efdcb4', floor3: '#c9a27e', ink: '#2a2440', inkLite: '#4a3d6e', glyph: '#e8703a', cap: '#b48a63' },
  spawn: [0, 0, 4.5],
  rooms: [
    { id: 'stair', name: 'The stair foot', x: [-7, 7], z: [-7, 7],
      springs: [[-4.5, -4.5], [4.5, -4.5], [-4.5, 2.5], [4.5, 2.5]], pillars: [],
      waves: [[['blot', 6]], [['blot', 6], ['skitter', 8]]] },
    { id: 'hall', name: 'The pillared hall', x: [-9, 9], z: [-30, -9],
      springs: [[-6, -12], [6, -12], [-6, -27], [6, -27], [0, -19.5]], pillars: [[-4.5, -13.5], [4.5, -13.5], [-4.5, -19.5], [4.5, -19.5], [-4.5, -25.5], [4.5, -25.5]],
      waves: [[['blot', 10]], [['blot', 8], ['heron', 2]], [['skitter', 16], ['blot', 6]]] },
    { id: 'cistern', name: 'The ink cistern', x: [-29, -11], z: [-28, -12],
      springs: [[-26, -15], [-14, -15], [-26, -25], [-14, -25]], pillars: [[-23, -17], [-17, -17], [-23, -23], [-17, -23]], basin: [-20, -20, 2.4],
      waves: [[['worm', 3], ['blot', 8]], [['heron', 3], ['skitter', 8], ['blot', 8]]] },
    { id: 'sanctum', name: 'The sanctum', x: [-31, -11], z: [-54, -30],
      springs: [[-28, -33], [-14, -33], [-28, -51], [-14, -51], [-21, -51]], pillars: [[-26, -37], [-16, -37], [-26, -47], [-16, -47]], altar: [-21, -42],
      waves: [[['blot', 12], ['skitter', 8], ['worm', 2]], [['tripod', 1, { tough: true }], ['heron', 2, { tough: true }], ['blot', 18], ['skitter', 10]]] },
  ],
  // (side: of the room it opens from; the gap is cut through the whole wall between the two)
  doors: [
    { from: 0, to: 1, side: 'n', at: 0, w: 4 },
    { from: 1, to: 2, side: 'w', at: 0, w: 4 },
    { from: 2, to: 3, side: 'n', at: 0, w: 4 },
  ],
  // the way in, in the desert: by the pilgrims' camps (src/desert-sites.js STORY.camps), on open sand west of their fires
  entrance: { at: [128, null, 300], heading: Math.atan2(168 - 128, 292 - 300) },
};
