// The fragments of the singing light (docs/systems/fragments.md, issue #196): where they hide, world by world.
//
// The light sheds them where it passed, small splinters of its song that settled in the out-of-the-way places: up on
// ledges and high places, tucked behind things, at the ends of side paths; never on the way you are sent. Each is a
// spot on the ground, [x, y, z] in its world's coordinates (a merged world's: Vael's sky stones and Lorn's Deep Wood
// are in Vael's and Lorn's own frame); the fragment floats a little over it (src/fragments.js LIFT). Found ones are
// the save's flags `frag.<world>.<i>`; their count is what the scientist aboard counts (src/story/scientist.js).
//
// The spots were first picked by scripts/fragment-spots.mjs (the walker's flood from the world's spawn, scored for a
// drop under them, walls round them, height, and distance from the people, the chests and the relics), then looked
// at one by one; tests/fragments.test.js checks each still stands on solid ground with room over it and that the
// walker reaches it from the world's spawn (a double jump high at most, falls that don't hurt, Lorn's water swum).

import { ORDER, TITLES } from './levels/names.js';

/** How many hide in each world on the route. */
export const FRAGMENTS_PER_WORLD = 8;

export const FRAGMENTS = {
  desert: [
    [376.0, 30.52, -10.1],
    [558.0, 43.93, 345.9],
    [658.0, 24.45, 51.9],
    [-166.0, 27.03, 745.9],
    [-324.0, 7.61, 395.9],
    [-34.0, 28.91, -440.1],
    [-148.0, 39.45, 71.9],
    [150.0, -4.91, 565.9],
  ],
  arzach: [
    [210.0, 38.43, -338.0],
    [-112.0, 40.30, -4.0],
    [-120.0, 44.31, -1298.0],
    [218.0, 40.00, -882.0],
    [-794.0, 46.18, -1034.0],
    [-444.0, 39.86, -922.0],
    [352.0, 41.00, -1196.0],
    [-440.0, 53.94, -1388.0],
  ],
  perdide: [
    [-698.0, 39.48, -448.0],
    [676.0, 29.64, -554.0],
    [152.0, 0.77, -918.0],
    [-518.0, 0.01, -706.0],
    [-412.0, 5.76, -154.0],
    [338.0, -0.67, -432.0],
    [-134.0, -0.17, -998.0],
    [-638.0, 0.18, 238.0],
  ],
  edena: [
    [32.0, 1.60, -542.0],
    [-618.0, 23.18, 210.0],
    [22.0, -6.66, -196.0],
    [-178.0, 20.26, 102.0],
    [624.0, 19.56, 282.0],
    [538.0, -9.56, -438.0],
    [188.0, 9.22, 136.0],
    [-616.0, 5.77, -254.0],
  ],
  underwater: [
    [96.0, -15.96, -128.0],
    [-32.0, 0.08, 138.0],
    [-96.0, 0.00, -86.0],
    [28.0, 3.44, -12.0],
    [-80.0, 0.08, 18.0],
    [38.0, 0.08, -112.0],
    [112.0, -15.96, -88.0],
    [-38.0, 0.08, -112.0],
  ],
  incal: [
    [-164.0, 150.00, -200.0],
    [182.0, 150.00, -184.0],
    [-36.0, 150.00, 256.0],
    [-200.0, 150.00, 76.0],
    [222.0, 150.00, 134.0],
    [20.0, 150.00, -190.0],
    [254.0, 150.00, -50.0],
    [-236.0, 150.00, -106.0],
  ],
  glassdunes: [
    [218.0, 43.33, 62.0],
    [82.0, 42.74, -284.0],
    [-54.0, 27.28, 40.0],
    [228.0, 35.91, -122.0],
    [-84.0, 76.89, -288.0],
    [298.0, 50.41, -26.0],
    [222.0, 51.06, -38.0],
    [0.0, 47.78, -302.0],
  ],
  buried: [
    [18.0, -16.23, -302.0],
    [220.0, 15.34, -70.0],
    [-126.0, 11.78, 448.0],
    [-170.0, 14.90, -588.0],
    [-486.0, 7.48, -38.0],
    [424.0, 11.78, -254.0],
    [42.0, 11.32, -528.0],
    [-112.0, 8.29, 30.0],
  ],
  moonfoundry: [
    [10.0, 13.06, -208.0],
    [14.0, 13.06, -26.0],
    [-60.0, 13.06, -128.0],
    [-20.0, 13.06, -194.0],
    [14.0, 13.06, -88.0],
    [18.0, 13.06, -178.0],
    [154.0, 0.00, -280.0],
    [-150.0, 0.00, -284.0],
  ],
  spheres: [
    [-192.0, 27.69, -160.0],
    [-184.0, 7.40, -488.0],
    [-286.0, 2.37, 270.0],
    [158.0, -1.59, -600.0],
    [-554.0, -1.42, -290.0],
    [370.0, 2.93, -288.0],
    [592.0, 5.22, 72.0],
    [270.0, -0.02, 70.0],
  ],
  spacecity: [
    [118.0, 6.00, -70.0],
    [-92.0, -0.00, 42.0],
    [-20.0, -0.00, -176.0],
    [114.0, 14.00, -192.0],
    [-36.0, -0.00, -52.0],
    [34.0, -0.00, -96.0],
    [84.0, 14.00, -156.0],
    [86.0, 3.00, -4.0],
  ],
  bazaar: [
    [-34.0, 8.32, -270.0],
    [-38.0, 8.32, 42.0],
    [162.0, 0.00, -498.0],
    [212.0, 0.00, 152.0],
    [-132.0, 0.00, -498.0],
    [156.0, 0.00, -112.0],
    [4.0, 0.00, -446.0],
    [-218.0, 0.00, -60.0],
  ],
};

/** Every fragment there is. */
export const FRAGMENT_TOTAL = Object.values(FRAGMENTS).reduce((a, l) => a + l.length, 0);

/** A fragment's save flag: found. */
export const fragKey = (world, i) => `frag.${world}.${i}`;

/** How many are found, all told and world by world, from the save's flags: { found, total, worlds: { [id]: { found, total, left, title } } }. */
export function fragmentCounts(flags = {}) {
  const worlds = {};
  let found = 0;
  for (const id of ORDER) {
    const list = FRAGMENTS[id] ?? [];
    const n = list.filter((_, i) => flags[fragKey(id, i)]).length;
    worlds[id] = { found: n, total: list.length, left: list.length - n, title: TITLES[id] ?? id };
    found += n;
  }
  return { found, total: FRAGMENT_TOTAL, worlds };
}
