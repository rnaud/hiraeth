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
