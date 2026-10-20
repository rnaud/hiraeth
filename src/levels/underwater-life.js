// Close-water routes framed by the city's windows. The existing fauna designs are reused;
// schools cost one instanced draw each and thin beyond the close viewing distance.
import { fishSchool, manta, whale } from './underwater-kit.js';

export const CITY_SCHOOLS = [
  [31, 8, 99, 4], [38, 5, 132, 2.8], [-36, 9, 120, 3], [0, 10, 83, 4],
  [48, 10, 24, 3.5], [27, 12, -20, 4], [-45, 12, 3, 3], [18, 29, 40, 5],
  [-136, 8, 22, 3], [-109, 9, 53, 3], [35, 14, -81, 4], [-25, 16, -143, 4],
  [132, -5, -106, 3], [116, 7, -119, 4], [-115, 10, -105, 3.5],
].map(([x, y, z, R], i) => ({ at: [x, y, z], R, n: 64, size: i % 3 === 0 ? 0.9 : 0.65,
  speed: 0.16 + (i % 3) * 0.04, seed: 581 + i, near: 75, far: 160 }));

export const CITY_MANTAS = [
  { at: [54, 20, 24], R: 10, w: 10, speed: 1.7, phase: 0.4 },
  { at: [0, 29, 128], R: 21, w: 12, speed: -2, phase: 1.2 },
  { at: [-105, 26, 22], R: 17, w: 12, speed: 1.8, phase: 2.4 },
  { at: [0, 34, -108], R: 24, w: 14, speed: -2.1, phase: 0.7 },
];
// These residents do not sing at the glass: the two deep whales' story response is unchanged.
export const CITY_WHALES = [
  { at: [145, 7, -110], R: 9, ez: 2, len: 18, speed: 1.8, phase: 2.4, bob: 1.2 },
  { at: [8, 42, 30], R: 23, ez: 1.3, len: 22, speed: -2.2, phase: 0.6, bob: 1.5 },
];

export function buildCityLife(kit, M) {
  return {
    schools: CITY_SCHOOLS.map((route) => fishSchool(kit, M, route)),
    mantas: CITY_MANTAS.map((route) => manta(kit, M, route)),
    whales: CITY_WHALES.map((route) => whale(kit, M, route)),
  };
}
