import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import {
  UNDERWATER_LOOK, UNDERWATER_DAY, UW_PAL, uwMats, seaSurface, tower, pod, podRing, glassColumns, cafeDome, walkway, lampPost, bush, kelp, rock,
  manta, fishSchool, resident, swimmer, travellerFigure, farCity,
} from './underwater-kit.js';

// ---------------------------------------------------------------------------
// The Underwater City's reference sheets (references/The Underwater City/reference-1 … 4: four 16:9
// plates). A city on the sea floor: tall salmon towers ringed with balcony pods of lit amber glass,
// glass columns of luminous water with bubbles rising, cafés under glass domes on the streets, curved
// walkways on piers with globe lamps, a manta gliding overhead, light falling in shafts from the
// surface far above, everything sinking into a deep blue-teal in flat layers with distance. One scene
// builder (seaScene) does the four plates; each is a view (reference-views.js describes the fields).
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The Underwater City / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The Underwater City/reference-${n}.jpeg`, import.meta.url).href });
export const UNDERWATER_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`underwater-${n}`, sheet(n)]));

/** sky top (toward the surface), horizon (the far water), shadow (the water's teal), light, sun */
const SKY = {
  day: UNDERWATER_DAY,
  deep: ['#236f98', '#0f4a68', '#24606e', '#ffeee2', '#e2f8ff'],
  bright: ['#3297bc', '#1a6688', '#2f6e78', '#fff2e8', '#eafcff'],
};

/** The sea floor: its levels (a function of x, z: the plaza, the streets), pale teal sand. */
const seabed = (height = () => -6) => ({ height, material: { color: UW_PAL.sand[0], color2: UW_PAL.sand[1], color3: UW_PAL.sand[2] }, rings: { r1: 2400 } });

/**
 * A panel's scene. o: { surface: y of the sea's surface, towers: [tower options + { pods }…], pods: [pod options…],
 * columns: [{ x, z, r, y0, y1 }…], domes: [cafeDome options…], walks: [[pts, options]…], lamps: [[x, y, z, h]…],
 * slabs: [[x0, x1, z0, z1, y, mat]…] (platforms, their tops at y), mantas: [manta options…], fish: [fishSchool
 * options…], swimmers: [[x, y, z, yaw, pitch]…], people: [[x, y, z, yaw]…], bushes: [[x, y, z, s]…], kelp: [[x, y, z, n,
 * h]…], rocks: [[x, y, z, s]…], far: farCity options, traveller: [x, y, z, yaw, s] }
 */
function seaScene(kit, v, o) {
  const rng = mulberry32(o.seed ?? 1), M = uwMats(kit);
  seaSurface(kit, { y: o.surface ?? 44, size: 3000 });
  for (const [x0, x1, z0, z1, y, m = 'street', d = 1.2] of o.slabs ?? []) kit.add(M[m], new THREE.BoxGeometry(x1 - x0, d, z1 - z0).translate((x0 + x1) / 2, y - d / 2, (z0 + z1) / 2), { solid: true, shadow: true });
  for (const t of o.towers ?? []) tower(kit, M, rng, { ...t, pods: t.pods ?? podRing(rng, { h: t.h, y0: t.y0 ?? 0, ...(t.ring ?? {}) }) });
  for (const p of o.pods ?? []) pod(kit, M, rng, p);
  if (o.columns?.length) glassColumns(kit, M, o.columns);
  for (const d of o.domes ?? []) cafeDome(kit, M, rng, d);
  for (const [pts, opt = {}] of o.walks ?? []) walkway(kit, M, pts, { ...opt, mat: M[opt.mat ?? 'street'] });
  for (const [x, y, z, h] of o.lamps ?? []) lampPost(kit, M, x, y, z, { h });
  for (const m of o.mantas ?? []) manta(kit, M, m);
  for (const f of o.fish ?? []) fishSchool(kit, M, f);
  for (const [x, y, z, yaw, pitch] of o.swimmers ?? []) swimmer(kit, M, x, y, z, { yaw, pitch });
  for (const [x, y, z, yaw] of o.people ?? []) resident(kit, M, rng, x, y, z, { yaw });
  for (const [x, y, z, s] of o.bushes ?? []) bush(kit, M, rng, x, y, z, s);
  for (const [x, y, z, n, h] of o.kelp ?? []) kelp(kit, M, rng, [x, y, z], { n, h });
  for (const [x, y, z, s] of o.rocks ?? []) rock(kit, M, x, y, z, s, Math.floor(rng() * 99));
  if (o.far) farCity(kit, M, rng, o.far);
  if (o.traveller) travellerFigure(kit, o.traveller[0], o.traveller[1], o.traveller[2], { yaw: o.traveller[3] ?? 0, s: o.traveller[4] ?? 1 });
  o.extra?.(kit, M, rng);
}

const view = (o) => ({ sky: SKY.day, look: UNDERWATER_LOOK, fog: 0.5, world: 'The Underwater City', ...o });

export const UNDERWATER_VIEWS = [
  // ===================================================================== reference-1: the two cafés, the bridge, the towers
  view({
    id: 'underwater-1-cafes', title: 'The cafés under their domes, the bridge and the towers of pods', sheet: 'underwater-1', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 2.6, 0], yaw: 0, fov: 58, horizon: 0.56 },
    sun: { side: 160, el: 46 },
    ground: seabed((x, z) => (z > -9 && x > 1 ? -0.4 : z > -30 ? -3 : -7)),
    build(kit, v) {
      seaScene(kit, v, {
        seed: 1101, surface: 46,
        slabs: [[1, 22, -9, 3, 0, 'streetPale'], [-30, 30, -30, -9, -2.6, 'street']],
        domes: [
          { x: -10.5, y: -2.6, z: -14, r: 8.6, sy: 0.78, doorYaw: 0.9, tables: 9, people: 4 },
          { x: 9.5, y: -2.6, z: -20, r: 6.8, sy: 0.95, doorYaw: -0.4, tables: 6, people: 3 },
        ],
        towers: [
          { x: -33, z: -20, h: 60, r: 9, top: 'flat', pods: [{ y: 6, a: 0.4, R: 6.5, kind: 'open' }, { y: 16, a: 0.2, R: 7, kind: 'open' }, { y: 27, a: 0.5, R: 6.5, kind: 'open' }, { y: 38, a: 0.3, R: 7 }] },
          { x: -24, z: -48, h: 70, r: 6, top: 'dome', pods: [{ y: 4, a: 0.5, R: 5.5, kind: 'open' }, { y: 13, a: -0.3, R: 5, kind: 'dome' }, { y: 24, a: 0.7, R: 6, kind: 'open' }, { y: 34, a: 0.1, R: 5.2, kind: 'dome' }, { y: 46, a: 0.6, R: 5 }] },
          { x: -9, z: -82, h: 64, r: 5, top: 'dome', pods: [{ y: 0, a: 0.9, R: 4.6, kind: 'open' }, { y: 9, a: 0.3, R: 4.8, kind: 'dome' }, { y: 18, a: 1.2, R: 4.2 }, { y: 28, a: 0.4, R: 4.5, kind: 'open' }, { y: 38, a: 1.0, R: 4 }] },
          { x: 3, z: -128, h: 54, r: 4.5, top: 'dome', ring: { n: 5, rr: 4, from: 2 } },
          { x: 27, z: -58, h: 44, r: 5, top: 'dome', pods: [{ y: 3, a: 3.0, R: 5.2, kind: 'open' }, { y: 12, a: 2.6, R: 4.8, kind: 'dome' }, { y: 22, a: 3.3, R: 5, kind: 'open' }] },
          { x: 15, z: -18, y0: -2.6, h: 14, r: 2.4, top: 'flat', windows: 0, pods: [] },
        ],
        pods: [{ x: 17, y: 11.2, z: -16, R: 15, H: 9, kind: 'open', plants: 0.4 }, { x: 16, y: 18, z: -18, R: 9, H: 7, kind: 'dome' }],
        columns: [{ x: -24.5, z: -33, r: 1.3, y0: -2.6, y1: 50 }, { x: -16, z: -62, r: 1.4, y0: -7, y1: 52 }],
        walks: [[[[-30, -1.6, -46], [-6, -1.4, -44], [18, -1.6, -42], [40, -1.8, -44]], { w: 4.2, thick: 1.4, ground: -7, lamps: 9 }]],
        lamps: [[-6, -7, -36, 3.2], [-2, -7, -54, 3.2], [3, -7, -38, 3.2], [8, -7, -52, 3.2], [-12, -7, -60, 3.4], [12, -7, -66, 3.4], [0, -2.6, -24, 3.3], [-1, -2.6, -17, 3.3]],
        mantas: [{ at: [4, 25, -40], w: 16, fixed: { pos: [4, 25, -42], yaw: 0.35, pitch: -0.08, roll: 0.06 } }],
        fish: [{ at: [10, 12, -70], n: 30, R: 6 }],
        swimmers: [[-24.5, 20, -31.8, 0, -1.4], [-16, 30, -60.6, 0.3, 1.3]],
        bushes: [[-26, 9.8, -16, 1.6], [-28, 20.2, -14, 1.8], [-22, 31.4, -16, 1.5], [12, 20.2, -8, 1.8], [22, 20.4, -14, 2]],
        people: [[-6, -7, -45, 0.4], [4, -7, -48, 2.2], [1, -2.6, -27, 1]],
        far: { x: 0, z: -40, rMin: 140, rMax: 420, n: 46, arc: [-Math.PI * 0.85, -Math.PI * 0.15], hMin: 20, hMax: 80 },
        traveller: [4.3, 0, -5.4, Math.PI + 0.25, 1],
      });
    },
  }),
  // ===================================================================== reference-2: the white bridge into the city, the spires
  view({
    id: 'underwater-2-bridge', title: 'The white bridge into the city, the pods and the spires beyond', sheet: 'underwater-2', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 4.4, 0], yaw: 0, fov: 58, horizon: 0.6 },
    sun: { side: -150, el: 44 },
    sky: SKY.deep,
    ground: seabed((x, z) => (z > -14 && x < 4 ? -0.4 : -8)),
    build(kit, v) {
      seaScene(kit, v, {
        seed: 1202, surface: 40,
        slabs: [[-18, 4, -14, 3, 0, 'street']],
        towers: [
          { x: -18.5, z: -21, y0: -8, h: 64, r: 3.4, top: 'flat', windows: 0.3, pods: [{ y: 4.6, a: 0.7, R: 2.8, H: 2.6, kind: 'open' }, { y: 1.4, a: 0.6, R: 2.6, H: 2.4, kind: 'open' }, { y: -1.8, a: 0.8, R: 2.7, H: 2.4, kind: 'dome' }, { y: 9, a: 0.9, R: 2.4, kind: 'open' }, { y: 14, a: 0.4, R: 2.2, kind: 'open' }] },
          { x: 13.5, z: -33, y0: -8, h: 64, r: 4.6, top: 'flat', pods: [{ y: 6, a: 3.2, R: 6, kind: 'open' }, { y: 18, a: 3.6, R: 4.4, kind: 'open' }] },
          { x: -12, z: -78, y0: -8, h: 52, r: 4, top: 'spire', ring: { n: 4, rr: 3.5, from: 6 } },
          { x: -7, z: -110, y0: -8, h: 56, r: 3, top: 'spire', ring: { n: 3, rr: 3, from: 8 } },
          { x: -26, z: -128, y0: -8, h: 48, r: 3.4, top: 'spire', ring: { n: 3, rr: 3.2, from: 8 } },
          { x: 22, z: -120, y0: -8, h: 62, r: 3.6, top: 'spire', ring: { n: 4, rr: 3.2, from: 6 } },
          { x: -40, z: -160, y0: -8, h: 70, r: 3, top: 'spire', ring: { n: 2, rr: 3, from: 10 } },
          { x: 40, z: -170, y0: -8, h: 66, r: 3.2, top: 'spire', ring: { n: 3, rr: 3, from: 10 } },
        ],
        pods: [
          { x: 9.6, y: 5.8, z: -12.5, R: 5.2, H: 5.2, kind: 'dome' },
          { x: 3, y: 1.6, z: -38, R: 6.2, H: 4.6, kind: 'open', plants: 0.9 },
          { x: 6, y: -6, z: -30, R: 3.2, H: 3, kind: 'dome' },
        ],
        domes: [{ x: 8, y: 0, z: -7.5, r: 4.8, sy: 1.05, doorYaw: -1.2, tables: 4, people: 0 }],
        columns: [{ x: -16.6, z: -27, r: 0.75, y0: -8, y1: 46 }, { x: 8.6, z: -42, r: 1.5, y0: -8, y1: 46 }],
        walks: [[[[-14, -1.2, -8], [-9, -1.6, -18], [-2, -2, -27], [8, -2.4, -34], [22, -2.6, -40]], { w: 4.6, thick: 1.1, ground: -8, lamps: 0, mat: 'streetPale' }]],
        lamps: [[-11.4, -1.6, -22, 4.4], [-5.4, -2, -31, 4.2], [-4.4, -2, -31.4, 4.2], [13, -2.4, -40, 4]],
        mantas: [{ at: [-10, 28, -42], w: 19, fixed: { pos: [-9.5, 27.5, -42], yaw: -0.5, pitch: 0.12, roll: -0.15 } }],
        fish: [{ at: [-6, 4, -60], n: 26, R: 5 }],
        swimmers: [[-12.5, 0.4, -9.5, 1.2, 0.1]],
        bushes: [[-17, 13.6, -13, 1.2], [-15, 8.2, -13, 1.1], [10, 11.3, -10, 1.4], [14, 11.2, -9, 1.6], [3.5, 5.6, -36, 1.4], [7, 5.6, -38, 1.2]],
        people: [[-3, -2, -27, 0.4], [10, -2.4, -38, 2.8]],
        far: { x: 0, z: -60, rMin: 120, rMax: 380, n: 50, arc: [-Math.PI * 0.85, -Math.PI * 0.15], hMin: 20, hMax: 70 },
        traveller: [1.6, -0.2, -9.6, Math.PI - 0.15, 1],
      });
    },
  }),
  // ===================================================================== reference-3: the canyon of pods, the café on the left
  view({
    id: 'underwater-3-canyon', title: 'The street of pods down the canyon, the café dome and the diver', sheet: 'underwater-3', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 2.2, 0], yaw: 0, fov: 58, horizon: 0.55 },
    sun: { side: 170, el: 52 },
    sky: SKY.bright,
    ground: seabed((x, z) => (Math.abs(x) < 9 && z < -16 ? -14 : -0.4)),
    build(kit, v) {
      const canyon = [];
      for (let k = 0, z = -40; z > -230; z -= 14 + k * 1.5, k++) {
        for (const side of [-1, 1]) canyon.push({ x: side * (10 + k * 0.6), z: z - (side > 0 ? 6 : 0), h: 34 + ((k * 7) % 13), r: 3.4, top: 'dome', ring: { n: 4, rr: 3.6, from: 2, a0: side > 0 ? Math.PI : 0, spread: 0.5, kinds: ['dome', 'dome', 'open'] } });
      }
      seaScene(kit, v, {
        seed: 1303, surface: 34,
        slabs: [[-9, 9, -16, 3, 0, 'street'], [-30, -9, -230, 3, 0, 'street', 2], [9, 30, -230, -16, 0, 'street', 2], [5, 30, -16, 3, 0, 'street', 2]],
        domes: [
          { x: -9.5, y: -1.2, z: -11.5, r: 7.5, sy: 0.75, shell: 'teal', doorYaw: 2.1, windows: [{ yaw: 0.3, w: 4.8, y0: 0.6, y1: 4.6 }, { yaw: 1.12, w: 4.8, y0: 0.6, y1: 4.6 }], porthole: 1.6, tables: 9, people: 6 },
          { x: 9.5, y: 0, z: -24, r: 3.6, sy: 0.85, shell: 'teal', doorYaw: -1.4, windows: [{ yaw: -0.4, w: 3.2, y0: 0.5, y1: 2.6 }], porthole: 0.8, tables: 2, people: 1 },
        ],
        towers: [
          { x: -14, z: -17, h: 48, r: 4, top: 'flat', pods: [{ y: 10, a: 0.2, R: 4.4, kind: 'open', plants: 1 }, { y: 18, a: 0.5, R: 3.6, kind: 'open', plants: 1 }, { y: 26, a: 0.2, R: 3.4, kind: 'open' }] },
          { x: -16, z: -44, h: 76, r: 5.5, top: 'flat', windows: 0.5, pods: [{ y: 12, a: 0.3, R: 4.2, kind: 'dome' }, { y: 22, a: 0.1, R: 4, kind: 'dome' }, { y: 32, a: 0.4, R: 3.8, kind: 'open' }] },
          { x: 13, z: -18, h: 44, r: 2.6, top: 'flat', pods: [{ y: 14, a: 3.3, R: 3.7, kind: 'dome' }, { y: 7, a: 3.1, R: 3.6, kind: 'dome' }, { y: 22, a: 3.2, R: 3.2, kind: 'open', plants: 1 }] },
          { x: 9.6, z: -7.4, h: 40, r: 1.4, top: 'flat', windows: 0, pods: [] },
          ...canyon,
        ],
        columns: [{ x: -9.6, z: -14, r: 0.65, y0: 3, y1: 34 }, { x: 10.2, z: -15, r: 0.6, y0: 0, y1: 34 }, { x: -8, z: -60, r: 0.8, y0: -14, y1: 34 }],
        walks: [
          [[[-3, 0, -16], [-1, -0.2, -40], [-1, -0.4, -70], [0, -0.6, -110]], { w: 3.4, thick: 1, ground: -14, lamps: 9 }],
          [[[9, 0, -34], [2, -0.3, -46], [-9, 0, -52]], { w: 3, thick: 1, ground: -14, lamps: 0 }],
        ],
        lamps: [[3.2, 0, -30, 3.6], [-4, 0, -36, 3.6], [5, 0, -44, 3.6]],
        mantas: [{ at: [3, 26, -52], w: 22, fixed: { pos: [3, 26, -52], yaw: 0.6, pitch: 0.18, roll: 0.25 } }],
        swimmers: [[4.6, 12, -40, 0.6, 0.6], [-3, 16, -60, -0.4, 0.2], [7, 9, -70, 2.4, -0.3], [-14, 22, -36, 0, 1.2]],
        fish: [{ at: [6, 18, -80], n: 30, R: 7 }],
        bushes: [[-12, 15.3, -15, 1.6], [-11, 23.6, -14, 1.4], [13.8, 25.2, -15, 1.4], [-8.5, 1.4, -2.5, 1.2]],
        kelp: [[-3, -14, -24, 5, 9], [3, -14, -34, 4, 8]],
        far: { x: 0, z: -230, rMin: 30, rMax: 260, n: 40, arc: [-Math.PI * 0.75, -Math.PI * 0.25], hMin: 20, hMax: 60 },
        traveller: [4.2, 0, -6.2, Math.PI - 0.3, 1.05],
      });
    },
  }),
  // ===================================================================== reference-4: the big café on the terrace, the lamps along the drop
  view({
    id: 'underwater-4-terrace', title: 'The great café on the terrace, the lamps along the drop, the open sea', sheet: 'underwater-4', panel: 1, where: 'the whole plate', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 2.4, 0], yaw: 0, fov: 58, horizon: 0.7 },
    sun: { side: -145, el: 45 },
    ground: seabed((x, z) => (x < 3 - z * 0.25 && z > -60 ? -0.4 : -7)),
    build(kit, v) {
      seaScene(kit, v, {
        seed: 1404, surface: 30,
        slabs: [[-30, 6, -40, 4, 0, 'streetPale', 1.6], [30, 60, -60, -30, -3, 'street', 2]],
        domes: [
          { x: -10.5, y: 0, z: -12, r: 7.6, sy: 1.0, shell: 'teal', doorYaw: 1.75, windows: [{ yaw: 0.72, w: 8.5, y0: 0.6, y1: 6.4 }], porthole: 0, tables: 7, people: 3 },
          { x: 30, y: -3, z: -44, r: 4.2, sy: 0.9, shell: 'pink', doorYaw: -1.4, windows: [{ yaw: -0.6, w: 3.4, y0: 0.4, y1: 3.0 }], tables: 3, people: 1 },
          { x: 38, y: -3, z: -52, r: 5, sy: 0.85, shell: 'pink', doorYaw: -1.6, windows: [{ yaw: -0.65, w: 4, y0: 0.4, y1: 3.2 }], tables: 3, people: 1 },
          { x: 46, y: -3, z: -40, r: 4.4, sy: 0.95, shell: 'pink', doorYaw: -1.8, windows: [{ yaw: -0.8, w: 3.4, y0: 0.4, y1: 3.2 }], tables: 3, people: 0 },
          { x: 20, y: -7, z: -40, r: 3.2, sy: 0.9, shell: 'pink', doorYaw: -0.6, windows: [{ yaw: -0.3, w: 2.6, y0: 0.4, y1: 2.4 }], tables: 2, people: 0 },
        ],
        towers: [
          { x: -6, z: -48, h: 70, r: 11, top: 'flat', windows: 0.5, pods: [{ y: 16, a: 1.0, R: 5, kind: 'dome' }, { y: 9, a: 0.4, R: 4.2, kind: 'dome' }, { y: 20, a: 0.5, R: 4.6, kind: 'open', plants: 1 }, { y: 4, a: 1.4, R: 4, kind: 'dome' }, { y: 30, a: 0.9, R: 4.4, kind: 'dome' }] },
          { x: -26, z: -26, h: 40, r: 6, top: 'flat', windows: 0.2, pods: [{ y: 18, a: 0.3, R: 7, kind: 'open', plants: 1 }] },
          { x: 42, z: -50, y0: -3, h: 10, r: 2.2, top: 'dome', pods: [{ y: 5, a: 3, R: 4.6, kind: 'dome' }] },
        ],
        columns: [{ x: 19, z: -21, r: 0.5, y0: -7, y1: 31 }, { x: -11, z: -38, r: 0.9, y0: 0, y1: 31 }, { x: 1.4, z: -40, r: 0.9, y0: 0, y1: 31 }],
        walks: [[[[2, 0, -2], [4, 0, -16], [10, 0, -30], [22, 0, -46]], { w: 3.8, thick: 1.6, ground: -7, lamps: 0, mat: 'streetPale' }]],
        lamps: [[7.4, 0, -12, 4.2], [8.6, 0, -24, 4.2], [12.5, 0, -33, 4.2], [18, 0, -42, 4.2], [24, -3, -48, 3.6], [-1, 0, -22, 4]],
        mantas: [{ at: [26, 22, -50], w: 22, fixed: { pos: [26, 22.5, -50], yaw: -0.35, pitch: 0.1, roll: 0.3 } }],
        fish: [{ at: [30, 14, -70], n: 34, R: 8 }],
        swimmers: [[14, 2, -30, 1.4, 0], [30, 6, -60, 2.4, 0.2]],
        bushes: [[11.6, 0, -4.4, 2.2], [12.6, 0.6, -6.5, 2.4], [-1.5, 0, -27, 1.4], [-26, 22.2, -20, 2], [-21, 22.3, -22, 1.6]],
        kelp: [[14, -7, -26, 4, 7], [26, -7, -34, 5, 8]],
        far: { x: 40, z: -60, rMin: 60, rMax: 320, n: 36, arc: [-Math.PI * 0.6, -Math.PI * 0.05], hMin: 8, hMax: 50 },
        traveller: [-6.2, 0, -8, Math.PI - 0.5, 1],
      });
    },
  }),
];

export { UNDERWATER_SHEETS as SHEETS, UNDERWATER_VIEWS as VIEWS };
