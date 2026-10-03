import { CatmullRomCurve3, Vector3 } from 'three';

// Where the hand-built desert landmarks stand (src/desert-landmarks.js).
// buildWorld keeps its scattered props clear of these footprints, and sites
// flagged `calm` get level ground (the dune and ridge relief fades out).
// Golden dunes: carcass, wreck, camp, sails. Rose canyons: canyon, umbrellas.
// Salt flats: petals, lagoons, dishes.
export const SITES = {
  carcass: { x: -700, z: -660, r: 100, yaw: 0.55 },
  wreck: { x: -110, z: 760, r: 85, yaw: -0.5 },
  camp: { x: -44, z: 30, r: 9, yaw: 0.4 },
  sails: { x: -170, z: 360, r: 42, yaw: 2.4 },
  canyon: { x: 620, z: 690, r: 150, yaw: 0.35, calm: true },
  umbrellas: { x: 1060, z: 420, r: 70, yaw: 0, calm: true },
  petals: { x: -850, z: 120, r: 52, yaw: 0.2, calm: true },
  lagoons: { x: -1060, z: 520, r: 150 },
  dishes: { x: 640, z: -1070, r: 90, yaw: 0, calm: true },
};
// the telegraph line from the petal station to the lagoons
export const POLE_LINE = [[-885, 165], [-1010, 430]];

// The desert's story (src/desert-city.js, src/story/desert.js): the old city
// of Qanat round its burning tree, the pilgrims' camps outside its gate, the
// fallen giant whose skull hides the way down to the cave, and the cave
// itself (an interior built far overhead, reached through the skull).
// `yaw` turns local +z (the main gate) toward the camps and the spawn.
// Kept apart from SITES so the reference-landmark tests stay about those.
export const STORY = {
  city: { x: 230, z: 400, r: 66, yaw: Math.atan2(-230, -400) },
  camps: { x: 168, z: 292, r: 40 },
  giant: { x: 318, z: 530, r: 30, yaw: Math.atan2(88, 130) },     // the skull outside the back gate, its face to the dunes (the body lies under the city)
  cave: { x: -1250, y: 1000, z: 1250 },                             // the interior's origin (far overhead)
  pilgrim: { x: -60, z: 520 },                                      // the old pilgrim who fell behind
  drum: { x: 146, z: -204 },                                        // Teo's drum, blown under the old ribcage
};
/** The procession's circuit as a smooth closed curve: [x, z] every `step` metres. */
export function processionLoop(step = 3) {
  const curve = new CatmullRomCurve3(PROCESSION.map(([x, z]) => new Vector3(x, 0, z)), true, 'centripetal');
  const n = Math.ceil(curve.getLength() / step);
  return curve.getSpacedPoints(n).slice(0, n).map((p) => [p.x, p.z]);
}
// the procession's circuit round the city, out over the golden dunes (x, z)
export const PROCESSION = [
  [120, 262], [62, 330], [40, 420], [70, 520], [150, 600], [262, 640], [372, 610], [420, 520], [400, 418], [376, 306], [330, 222], [228, 196],
];
