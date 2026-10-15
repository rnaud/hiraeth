// Where each world's benches stand (src/benches.js, issue #363), and how each world makes them.
//
//   BENCHES[world]   [{ at: [x, y, z] (the ground under the seat's middle), face (rad: the way the one sitting
//                    looks, three.js yaw: +z at 0, +x at π/2), name (what the view is of), and glass: true for a view
//                    through glass (the sight line meets the pane: tests/benches-worlds.test.js lets it) }]
//   BENCH_STYLES     per world: kind ('slab' stone, 'plank' wood, 'machined' a moulded seat on bent hoops), its
//                    colours (main: the seat; trim: the legs and rails) and metal (materials.js METALS) if any
//
// Each spot was picked from the running game (docs/systems/worlds.md, "Benches"): flat, dry, outdoors, clear
// round the seat and behind it for the camera, off the route's line and away from the races, with a long view the
// way it faces. tests/benches.test.js and tests/benches-worlds.test.js hold them to it.

export const BENCH_STYLES = {
  default: { kind: 'slab', main: '#d9cdb6', trim: '#a8987e' },
  desert: { kind: 'slab', main: '#dcb88c', trim: '#b38862' },          // sandstone
  arzach: { kind: 'slab', main: '#e9e1d0', trim: '#c4b79f' },          // the needles' bone-white stone
  perdide: { kind: 'plank', main: '#8c6f57', trim: '#3c4660' },        // dark wood, iron posts
  edena: { kind: 'plank', main: '#d9a066', trim: '#6e8a5a' },          // warm wood on green-painted legs
  underwater: { kind: 'machined', main: '#d98a5e', trim: '#d0a442', trimMetal: 'brass' },
  incal: { kind: 'machined', main: '#ecdfc4', trim: '#9aa6b2', trimMetal: 'steel' },   // a cream seat on steel, as the terraces
  glassdunes: { kind: 'slab', main: '#e4d0a6', trim: '#8fd0a8' },      // sand stone on glass-green blocks
  buried: { kind: 'machined', main: '#b4532f', trim: '#5f6168', trimMetal: 'iron' },   // rust on iron
  moonfoundry: { kind: 'machined', main: '#c97a45', trim: '#5f6168', trimMetal: 'iron' },
  spheres: { kind: 'slab', main: '#f2ede3', trim: '#d4ccbc' },         // the pyramids' white stone
  spacecity: { kind: 'machined', main: '#f0ece6', trim: '#d8dee6', trimMetal: 'chrome' },
  bazaar: { kind: 'machined', main: '#d8654f', trim: '#9aa6b2', trimMetal: 'steel' },  // painted coral on steel
  mangrove: { kind: 'plank', main: '#e8e2d4', trim: '#9a8f80' },       // the white roots' wood
  waterfall: { kind: 'slab', main: '#cfc6b4', trim: '#a39985' },
  saltharbour: { kind: 'plank', main: '#9a7350', trim: '#5d4632' },    // ship's timber
  antennas: { kind: 'plank', main: '#b08a64', trim: '#5f6168' },
  eclipse: { kind: 'slab', main: '#eee8dc', trim: '#c9c0b0' },
  fallenring: { kind: 'machined', main: '#d6d0c4', trim: '#9aa6b2', trimMetal: 'steel' },
  underside: { kind: 'plank', main: '#a37e5a', trim: '#5a4636' },
};

export const BENCHES = {
  desert: [
    { at: [468.39, 36.09, 225.38], face: 5.105, name: 'Qanat and the tree that drinks, from the dunes over it' },
    { at: [453.5, 37.37, 426.14], face: 5.105, name: 'the dark tree, its light and the town under it' },
  ],
  arzach: [
    { at: [-232.49, 76.25, -272.09], face: 2.356, name: 'the sky stones over the sea of cloud' },
    { at: [-168.36, 76.26, -228.04], face: 0.785, name: 'the plain of needles and the lone tower' },
  ],
  perdide: [
    { at: [-49.99, 70.11, -823.59], face: 3.927, name: 'the swamp from the Deep Wood’s high walk' },
    { at: [41.5, 7.08, -35.54], face: 4.32, name: 'the crystal forest under the night sky' },
  ],
  edena: [
    { at: [139.93, 17.68, 277.5], face: 3.534, name: 'the valley of pyramids under the ringed moon' },
    { at: [46.26, 18.14, 331.27], face: 4.712, name: 'the great step pyramid' },
  ],
  underwater: [
    // (by the Avenue's glass, looking out east at the towers of amber pods in the sea: the Whale Gallery's benches are on the way to Maelle)
    { at: [38, 0.04, 22], face: 1.571, glass: true, name: 'the towers of amber pods through the Avenue’s glass' },
  ],
  incal: [
    { at: [130.3, 200, 254.21], face: 3.534, name: 'down the shaft to the spire and its saucer' },
  ],
  glassdunes: [
    { at: [-152.75, 2.64, -27.2], face: 3.142, name: 'the glass waves and the temple’s door' },
    { at: [189.99, 2.2, -65.49], face: 5.89, name: 'the clock-house and its wheels' },
  ],
  buried: [
    { at: [69.13, 14.73, -82.63], face: 3.927, name: 'the ring of arches and the machine’s chimney' },
    { at: [-74.94, 16.18, -63.6], face: 2.749, name: 'the pipes and the great wheel' },
  ],
  moonfoundry: [
    { at: [30.23, 0, 83.5], face: 3.534, name: 'the moons hanging in the foundry' },
  ],
  spheres: [
    { at: [143.15, 36.15, -405.56], face: 5.89, name: 'the garden from its hill' },
    { at: [-141.88, 18.04, -141.97], face: 5.89, name: 'the tower over the plain' },
  ],
  spacecity: [
    { at: [-81.38, 0, 16.11], face: 3.534, name: 'the planet and the floating quarters' },
    { at: [82.34, 24.4, -173.68], face: 4.32, name: 'the town across the dark' },
  ],
  bazaar: [
    { at: [-21.36, 0.3, -288.21], face: 3.142, name: 'the needle behind the square' },
  ],
  mangrove: [
    { at: [-28.5, 1.2, -20.62], face: 2.17, name: 'the great tree across the lake' },
  ],
  waterfall: [
    { at: [-22, 0, 35.6], face: 0, name: 'the valley through the falls, from a balcony' },
  ],
  saltharbour: [
    { at: [46.95, 55.53, -107.8], face: 0.785, name: 'the ships in the salt' },
  ],
  antennas: [
    { at: [-141.58, 1.66, -2.47], face: 0.785, name: 'the dishes on the violet plain' },
  ],
  eclipse: [
    { at: [-31.95, 16.8, -135.87], face: 4.712, name: 'the lit city on the plain' },
  ],
  fallenring: [
    { at: [-69.8, 19.96, -24.62], face: 3.534, name: 'the fallen ring’s arch over the plain' },
  ],
  underside: [
    { at: [114.28, 40.25, -160.31], face: 1.571, name: 'the stone stacks on the horizon' },
  ],
};
