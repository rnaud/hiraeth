import * as THREE from 'three';
import { MODE_STRATA, MODE_WATER, MODE_TERRAIN } from '../materials.js';
import { createNoise2D } from '../noise.js';
import { DUNE_HAZE } from '../desert-sites.js';
import {
  TAU, V, tube, lathe, sagPts, ridged, gauss, r2, smoothstep, put, dome, PERSON, CLEAN_SKY, n2, n3, sailGeo, groundPatch,
  ribcage, stemDish, gorgeWall, bridge, machineHead, tableCliff, petals, cage, strataMat, radioDish, groundRibbon,
} from './reference-kit.js';

// ---------------------------------------------------------------------------
// The other desert environment sheets (references/levels/The Desert/environment/IMG_3772, 3773, 3774):
// the same places drawn again (the ribcage in the dunes, the dish city, the gorge and its bridges,
// the petal station, the turquoise lake under violet cliffs, the buried machines), each panel a view
// as in reference-views.js (its fields are described there). Crops are inside each panel's inked
// border, found on the sheet; colours read off the panel.
// ---------------------------------------------------------------------------

const sheet = (name) => ({ name: `The Desert / ${name}.JPG`, size: [1024, 1024], url: new URL(`../../references/levels/The Desert/environment/${name}.JPG`, import.meta.url).href });
export const DESERT_SHEETS = { IMG_3772: sheet('IMG_3772'), IMG_3773: sheet('IMG_3773'), IMG_3774: sheet('IMG_3774') };

const n4 = createNoise2D(37754);
/**
 * IMG_3774 prints its cast shadows as near-black ink masses with a hard edge (the dish's on the sand, the
 * cliff's across the gorge): post.js uInkShadow lays one flat mass of the spot tone over each, strokes and all
 * (3d, docs/systems/rendering.md "Ink shadows"). The spot tier keeps the pockets but no longer darkens the cast
 * shadows itself (uSpot.w 0: the mass does it, whole).
 */
/** The views' sky and the desert's far dunes in stepped pale bands (post.js 4b). */
export const DUNES = { ...CLEAN_SKY, ...DUNE_HAZE, uHazeLayers: [120, 1.9, 0.12, 4] };   // (the panels' scenes are smaller: from 120 m)
const INK_SHADOWS = { ...DUNES, uSpot: [1, 3, 0.3, 0], uSpotTone: [0.2, 0.15, 0.13, 0.35], uInkShadow: [0.85, 0.3] };
const sand = (c1, c2, c3, o = {}) => ({ color: c1, color2: c2, color3: c3, ripples: true, sandInk: true, ...o });
/** Dunes: rolling ridged crests whose height grows with the distance (a horizon of dunes). */
const dunes = (x, z, amp = 4, f = 0.012, seed = 0) => amp * ridged(x * 0.6 + seed, z, f, seed) + 0.4 * amp * n2(x * f * 0.5 + seed, z * f * 0.5);
const far = (x, z, at = 300, h = 6) => smoothstep(at, at * 3, r2(x, z)) * h;
const bones = (kit, tone = '#ede2ca', shade = '#d9c6a6') => ({
  bone: kit.mat({ color: tone, shadeHue: 0.9, hatch: 0 }), shade: kit.mat({ color: shade, shadeHue: 0.9, hatch: 0 }), dark: kit.mat({ color: '#6e5442', flat: true }),
});

/** IMG_3775, the first desert sheet: its six panels (views 1 to 6). */
const IMG_3775_VIEWS = [
  // ========================================================= 1. bones in the dunes
  {
    id: 'bones', title: 'Bones in the dunes', sheet: 'IMG_3775', panel: 1, where: 'top left', crop: [42, 44, 463, 294],
    camera: { eye: [0, 8.7, 0], yaw: 0, fov: 38, horizon: 0.37 },
    sun: { side: -115, el: 36 },
    sky: ['#9db5cb', '#a6bccd', '#9a8f86', '#ffffff', '#fff6dc'],
    look: DUNES,   // (the far dunes in stepped bands, as the desert's other sheets)
    fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // the dune you stand on: down from your feet to a crest ~13 m out, then steeply away
        const dc = 13.5 - 0.03 * x;
        const near = d < dc ? 7 - 2.2 * Math.pow(Math.max(d, 0) / dc, 1.25) + Math.max(0, -d) * 0.05 : 4.8 - 1.2 * (d - dc);
        // the hollow the bones lie in (level), long dunes with sharp crests beyond, a far wall of dunes
        const r = r2(x, z), calm = smoothstep(16, 46, r2(x * 0.7, z + 32));
        let h = 1.0 + calm * (2.4 * ridged(x * 0.6 - 40, z, 0.01, 3) + 1.2 * smoothstep(30, 90, d));
        h += 1.3 * gauss(x, z, -13.5, -31, 3.2) + 1.1 * gauss(x, z, 1, -27.5, 4.5) + 0.9 * gauss(x, z, 11, -30, 3) + 0.5 * gauss(x, z, -2, -35, 5);   // drifts round the skull, the ribs' feet and the hips
        h += smoothstep(90, 260, r) * 7 * ridged(x * 0.5 + 30, z, 0.006, 8) + smoothstep(120, 700, r) * (5.5 + 3 * ridged(x, z, 0.004, 11));
        return Math.max(near, h);
      },
      material: { color: '#f4c27a', color2: '#ecb05f', color3: '#e09a52', ripples: true, sandInk: true },
    },
    build(kit) {
      // (bone: its own hue in shade, a flat tone, no strokes)
      const bone = kit.mat({ color: '#ede2ca', shadeHue: 0.9, hatch: 0 });
      const boneShade = kit.mat({ color: '#d9c6a6', shadeHue: 0.9, hatch: 0 });
      const hollow = kit.mat({ color: '#7d5f48', flat: true });
      const H = (x, z) => kit.H(x, z);
      // the near dune: a band of deeper orange up to its crest (the panel's foreground tone)
      kit.add(kit.mat({ color: '#e8964b', color2: '#e08a42', color3: '#e8964b', mode: MODE_TERRAIN, ripples: true, sandInk: true }),
        groundPatch(H, -70, 70, 6, (x) => -(13.5 - 0.03 * x) - 0.6), { solid: false });
      // the skeleton, lying along x: the skull to the left, a ribcage along the spine, the hips and a leg trailing right
      // (built at full size, then scaled about its middle and sunk into the sand)
      const bz = -31, by = 0.9, parts = [], add = (m, g, o) => parts.push([m, g, o]);
      const spine = new THREE.CatmullRomCurve3([V(-7, 2.8, 0), V(-3.5, 3.7, 0), V(0.5, 3.9, 0), V(4.4, 3.1, 0), V(7.6, 2.1, 0)].map((p) => p.add(V(0, by, bz))));
      add(bone, new THREE.TubeGeometry(spine, 40, 0.38, 7, false));
      for (let i = 0; i <= 13; i++) {
        const t = 0.04 + (i / 13) * 0.78, top = spine.getPoint(t), g = Math.sin(Math.PI * Math.min(1, (t + 0.04) / 0.88));
        const R = 1.5 + 2.1 * g, lean = -0.5 - 0.3 * t;
        for (const side of [1, -1]) {
          const pts = [];
          for (let j = 0; j <= 8; j++) {
            const a = (j / 8) * Math.PI * 0.92;
            pts.push(V(top.x + lean * Math.sin(a) * R * 0.45, top.y - (1 - Math.cos(a)) * R * 0.9 - 0.15, top.z + side * Math.sin(a) * R * 1.15));
          }
          add(i % 3 === 1 ? boneShade : bone, tube(pts, 0.19 + 0.09 * g, 14, 5));
        }
      }
      // the dark inside of the chest, seen between the ribs
      add(hollow, put(new THREE.SphereGeometry(1, 16, 10), -0.6, by + 2.0, bz, 0, [5.0, 1.9, 2.2]), { solid: false });
      // the skull: long and low, nose down to the left, a big socket, the jaw in the sand
      add(bone, put(new THREE.SphereGeometry(1, 22, 14), -9.0, by + 2.0, bz + 0.5, 0.12, [2.2, 1.55, 1.7], 0, 0.1));           // the cranium
      add(bone, put(new THREE.ConeGeometry(1, 1, 16, 1).rotateZ(Math.PI / 2), -12.4, by + 1.2, bz + 0.8, 0.15, [4.0, 1.3, 1.25], 0, 0.3));   // the snout, nose down
      add(hollow, put(new THREE.SphereGeometry(1, 12, 8), -9.9, by + 2.1, bz + 1.85, 0.1, [1.1, 0.75, 0.4]), { solid: false });   // the socket
      add(hollow, put(new THREE.SphereGeometry(1, 10, 6), -13.2, by + 1.0, bz + 1.5, 0.2, [0.6, 0.28, 0.3]), { solid: false });
      add(boneShade, put(new THREE.SphereGeometry(1, 14, 8), -11.4, by + 0.4, bz + 1.5, 0.1, [2.8, 0.5, 0.9]));                 // the jaw in the sand
      // hips: two flat wings either side of the spine's end
      for (const e of [-1, 1]) add(bone, put(new THREE.SphereGeometry(1, 16, 10), 8.4, by + 2.0, bz + e * 1.0, 0.3 * e, [1.7, 1.4, 0.45], 0.2 * e, -0.3));
      add(hollow, put(new THREE.SphereGeometry(0.5, 10, 8), 8.9, by + 1.8, bz + 1.5, 0, [1, 0.9, 0.3]), { solid: false });
      add(bone, tube([V(9.8, by + 1.7, bz + 1.2), V(11.8, by + 0.9, bz + 2.8), V(13.4, by + 0.4, bz + 3.9)], 0.42, 12, 6));
      add(bone, tube([V(13.4, by + 0.4, bz + 3.9), V(15.2, by - 0.1, bz + 5.4), V(16.8, by - 0.6, bz + 6.8)], 0.28, 12, 5));
      add(bone, put(new THREE.SphereGeometry(0.55, 10, 8), 13.4, by + 0.4, bz + 3.9));
      const S = [0.84, 1.25, 0.9], sink = 0.25;
      for (const [m, g, o] of parts) kit.add(m, g.translate(0, -by, -bz).scale(...S).translate(0.5, by - sink, bz), o);
      for (const [x, z, r] of [[-17, -27, 0.35], [-4, -24.5, 0.25], [13, -25, 0.3], [19, -33, 0.4]]) kit.add(bone, put(new THREE.SphereGeometry(r, 8, 6), x, H(x, z) + r * 0.3, z, x, [2.2, 0.8, 1]));
    },
  },

  // ========================================================= 2. the fluted tower
  {
    id: 'tower', title: 'The fluted tower', sheet: 'IMG_3775', panel: 2, where: 'top right', crop: [521, 44, 463, 294],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 52, horizon: 0.74 },
    sun: { side: 145, el: 22 },
    sky: ['#97b8d3', '#a3bfd5', '#8f8b88', '#ffffff', '#fff6dc'],
    look: DUNES,   // (the far dunes in stepped bands, as the desert's other sheets)
    fog: 0.3,
    ground: {
      height: (x, z) => 0.25 * n2(x * 0.02, z * 0.02) + 0.6 * ridged(x, z, 0.008, 5) * smoothstep(60, 200, r2(x, z)) + smoothstep(200, 900, r2(x, z)) * 4,
      material: { color: '#f4cbab', color2: '#efc19e', color3: '#e4b08e', ripples: true, sandInk: true },
    },
    people: [{ at: [19, -41], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const H = (x, z) => kit.H(x, z);
      const tower = kit.mat({ color: '#e3ad7c' });
      const cap = kit.mat({ color: '#d69c68', side: THREE.DoubleSide });
      const hut = [kit.mat({ color: '#e4c6a6', flat: true, weathered: 0.8 }), kit.mat({ color: '#d6b08c', flat: true, weathered: 0.8 }), kit.mat({ color: '#efd8bd', weathered: 0.6 }), kit.mat({ color: '#c99d78', weathered: 0.6 })];
      const dark = kit.mat({ color: '#6a4c3a', flat: true });
      const dish = kit.mat({ color: '#f6dcbd', side: THREE.DoubleSide, shade: 0.45, hatch: 0.2 });
      const rope = kit.mat({ color: '#8c7a68', flat: true });
      // the tower: a fluted trumpet stem flaring into a ribbed cap overhead
      const TX = -12, TZ = -86, flutes = 84, y0 = H(TX, TZ);
      const prof = [[17, -1], [13.5, 3], [11.5, 9], [11.2, 15], [12.2, 20], [14.5, 25], [18.5, 30], [24, 35], [31.5, 40], [41, 45], [52, 49.5], [64, 53], [72, 54.6]];
      const stem = lathe(prof, flutes * 4);
      const p = stem.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i)), f = 1 + 0.02 * Math.abs(Math.sin((a * flutes) / 2));   // V-shaped flutes: inked creases
        p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f);
      }
      stem.computeVertexNormals();
      kit.add(tower, stem.translate(TX, y0, TZ));
      // the cap's top (out of sight, but it shades the ground) and its rim
      kit.add(cap, lathe([[72, 54.6], [60, 58], [40, 61], [16, 62.5], [0.5, 63]], 96).translate(TX, y0, TZ));
      kit.add(cap, new THREE.TorusGeometry(72, 0.6, 5, 120).rotateX(Math.PI / 2).translate(TX, y0 + 54.6, TZ));
      // ribs down the underside of the cap and the stem
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU, c = Math.cos(a), s = Math.sin(a);
        const pts = prof.slice(4).map(([r, y]) => V(TX + c * (r * 1.02 - 0.15), y0 + y - 0.2, TZ + s * (r * 1.02 - 0.15)));
        kit.add(cap, tube(pts, 0.16, 24, 3), { solid: false });
      }
      // huts round the tower's foot and off to the left: domes, drums with domes, boulder-like heaps
      const rng = kit.rng;
      const huts = [[-22, -70, 3.4, 0], [-15, -66, 2.4, 1], [-4, -64, 2.8, 2], [5, -66, 2.2, 0], [11, -71, 3.4, 1], [17, -74, 2.6, 2], [24, -77, 2.2, 3],
        [-30, -62, 2.8, 2], [-38, -58, 3.8, 0], [-46, -62, 3.0, 1], [-53, -56, 2.4, 2], [-60, -62, 3.2, 3], [-26, -54, 2.2, 1], [-10, -58, 1.8, 3],
        [-66, -54, 2.4, 0], [-72, -60, 2.8, 2], [-34, -50, 1.6, 3], [-48, -50, 1.8, 2],
        [30, -82, 2.0, 1], [36, -78, 1.6, 2], [44, -84, 2.2, 0], [52, -80, 1.8, 1], [62, -88, 2.4, 2], [70, -86, 1.6, 0]];
      for (const [hx, hz, hr, k] of huts) {
        const x = hx * 0.95, z = -44 + (hz + 40) * 0.7, r = hr * 1.25, y = kit.base(x, z, r) - 0.2, m = hut[k];
        if (k === 1) {
          const h = r * 1.3;
          kit.add(m, new THREE.CylinderGeometry(r, r * 1.05, h, 14).translate(x, y + h / 2, z));
          kit.add(hut[2], dome(r * 1.02, 0.8).translate(x, y + h, z));
        } else if (k === 3) kit.add(m, put(new THREE.SphereGeometry(r, 14, 10), x, y + r * 0.7, z, rng() * 3, [1, 1.3 + rng() * 0.5, 0.9]));
        else kit.add(m, dome(r, 1.15).translate(x, y, z));
        kit.add(dark, put(new THREE.BoxGeometry(r * 0.45, r * 0.6, 0.3), x, y + r * 0.3, z + r * 0.95), { solid: false });
      }
      // tall stacked dwellings crowding the tower's foot: drums on drums, domed, a ball or a lamp on top
      for (const [x, z, r, h] of [[-26, -62, 4.2, 9], [-16, -60, 3.4, 13], [-6, -64, 4.6, 8], [4, -62, 3.2, 11], [14, -66, 3.8, 9], [-36, -56, 3.6, 7], [-46, -60, 4.4, 10],
        [-58, -54, 3.4, 8], [22, -70, 3.0, 7], [-20, -50, 2.6, 6], [-2, -52, 2.4, 5.5], [-70, -50, 3.6, 7.5]]) {
        const y = kit.base(x, z, r) - 0.2, m = hut[(Math.round(x) & 1) ? 0 : 3];
        kit.add(m, new THREE.CylinderGeometry(r, r * 1.08, h * 0.55, 16).translate(x, y + h * 0.275, z));
        kit.add(hut[2], dome(r * 1.02, 0.6).translate(x, y + h * 0.55, z));
        kit.add(hut[1], new THREE.CylinderGeometry(r * 0.5, r * 0.55, h * 0.3, 12).translate(x + r * 0.2, y + h * 0.7, z));
        kit.add(hut[2], put(new THREE.SphereGeometry(r * 0.42, 12, 8), x + r * 0.2, y + h * 0.88, z, 0, [1, 0.8, 1]));
        kit.add(dark, put(new THREE.BoxGeometry(r * 0.35, r * 0.5, 0.3), x, y + r * 0.25, z + r * 1.02), { solid: false });
      }
      // little towers with a lamp or a small dish on top
      for (const [x, z, h, top] of [[-58, -42, 9, 0], [-48, -46, 6, 1], [-36, -44, 7.5, 1], [-12, -72, 11, 0], [14, -58, 8, 1], [28, -68, 6, 0], [-66, -48, 5, 1], [-28, -48, 4, 1]]) {
        const y = H(x, z);
        kit.add(hut[1], new THREE.CylinderGeometry(0.3, 0.5, h, 6).translate(x, y + h / 2, z));
        if (top) kit.add(dish, lathe([[0.01, 0], [1, 0.3], [1.8, 0.8]], 14).rotateX(-0.9).rotateY(x).translate(x, y + h, z));
        else kit.add(hut[2], put(new THREE.SphereGeometry(1, 10, 6), x, y + h + 0.6, z, 0, [1.3, 0.7, 1.3]));
      }
      // the tall pole on the left, a stay down to the sand
      kit.add(rope, new THREE.CylinderGeometry(0.1, 0.16, 26, 5).translate(-31, H(-31, -36) + 12.5, -36));
      kit.add(rope, tube([V(-31, H(-31, -36) + 25, -36), V(-24, H(-24, -30) + 0.1, -30)], 0.04, 1, 3), { solid: false });
      // the dishes: one beside the tower, a huge one on the right, both turned up towards you
      for (const [x, z, R, el, az, ped] of [[16, -92, 10, 1.0, -0.6, 20], [36, -60, 17, 0.95, -0.85, 14]]) {
        const y = H(x, z);
        kit.add(hut[0], new THREE.CylinderGeometry(R * 0.07, R * 0.14, ped, 10).translate(x, y + ped / 2, z));
        radioDish(kit, dish, rope, x, y + ped + R * 0.12, z, R, el, az);
      }
      // tracks across the foreground
      const tracks = kit.mat({ color: '#d9a27e', flat: true, side: THREE.DoubleSide });
      for (const path of [[[-40, -8], [-10, -14], [20, -16], [60, -14]], [[-40, -20], [0, -26], [40, -30], [80, -28]], [[-12, -4], [10, -9], [40, -11]]])
        kit.add(tracks, groundRibbon(H, path, 0.18), { solid: false });
    },
  },

  // ========================================================= 3. the rope bridges
  {
    id: 'bridges', title: 'Bridges over the gorge', sheet: 'IMG_3775', panel: 3, where: 'middle left', crop: [42, 353, 463, 294],
    camera: { eye: [0, 3.2, 0], yaw: 0, fov: 56, horizon: 0.72 },
    // (low from the right: the right rim's shadow falls across the gorge and up the left wall, as the panel has
    // it, only the pillar standing out further down catching the sun over it)
    sun: { side: 95, el: 22 },
    sky: ['#a5bdcf', '#b3cad3', '#a29b8e', '#ffffff', '#fff6dc'],
    look: DUNES,   // (the far dunes in stepped bands, as the desert's other sheets)
    fog: 0.3,
    ground: {
      height: (x, z) => {
        const d = -z;
        let h = 0.3 * n2(x * 0.05, z * 0.05) + 1.2 * smoothstep(10, 30, Math.abs(x - 4 + d * 0.04)) * smoothstep(0, 40, d);
        h += smoothstep(150, 260, d) * (5 + 6 * ridged(x, z, 0.02, 2));   // dunes where the gorge opens out
        return h;
      },
      material: { color: '#eec784', color2: '#f0cfa8', color3: '#d9ad6e', ripples: true, sandInk: true },
    },
    build(kit) {
      const wall = kit.mat({ color: '#ecc27c', color2: '#e2b46c', color3: '#f0cc8a', mode: MODE_STRATA, strataSize: 4.5, flat: true });
      const pillar = kit.mat({ color: '#f4ab76', color2: '#efa06a', color3: '#f6b886', mode: MODE_STRATA, strataSize: 6, flat: true });
      const rope = kit.mat({ color: '#5a4c40', flat: true });
      const plank = kit.mat({ color: '#9a7a5a', flat: true });
      const nW = createNoise2D(3775);
      // a canyon wall: a ragged face (x = face(z)) extruded upward in tiers (each set back), its back far behind
      const wallMesh = (side, x0, slope, z0, z1, top, tiers, seed, mat) => {
        for (const [y0, y1, inset] of tiers.map(([a, b, c]) => [a * top, b * top, c])) {
          const sh = new THREE.Shape(), n = 48, pts = [];
          for (let i = 0; i <= n; i++) {
            const z = z0 + ((z1 - z0) * i) / n;
            pts.push([x0 + slope * (z0 - z) * side + side * (inset + 2.6 * nW(z * 0.05 + seed, seed) + 1.4 * Math.sin(z * 0.21 + seed)), z]);
          }
          for (let i = n; i >= 0; i--) { const z = z0 + ((z1 - z0) * i) / n; pts.push([x0 + side * 120, z]); }
          pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
          kit.add(mat, new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2).translate(0, y0 - 2, 0));
        }
      };
      // the near left wall (taller: it shades the gorge, and runs on behind you), the right wall
      wallMesh(-1, -46, -0.1, 40, -160, 100, [[0, 0.3, 0], [0.3, 0.6, 3], [0.6, 1, 6]], 1, wall);
      wallMesh(1, 38, -0.05, 30, -170, 76, [[0, 0.2, -1], [0.2, 0.42, 2], [0.42, 0.7, 5], [0.7, 1, 8]], 5, wall);
      // the lit pillar standing out from the left wall further down
      {
        const sh = new THREE.Shape();
        [[-56, -72], [-34, -70], [-28, -80], [-30, -102], [-56, -106]].forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
        kit.add(pillar, new THREE.ExtrudeGeometry(sh, { depth: 104, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -2, 0));
        const sh2 = new THREE.Shape();
        [[-46, -68], [-29, -66], [-25, -76], [-31, -88]].forEach(([x, z], i) => (i ? sh2.lineTo(x, -z) : sh2.moveTo(x, -z)));
        kit.add(pillar, new THREE.ExtrudeGeometry(sh2, { depth: 22, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -2, 0));
      }
      // fallen blocks at the feet of the walls
      for (const [x, z, s] of [[-22, -30, 4], [-20, -46, 3], [16, -52, 5], [18, -36, 3.5], [24, -78, 6], [-18, -62, 4], [12, -64, 3]])
        kit.add(wall, put(new THREE.DodecahedronGeometry(s, 0), x, kit.H(x, z) + s * 0.3, z, x, [1.4, 0.6, 1]));
      // the bridges: a deck on hangers under two sagging cables, from rim to rim
      const bridge = (a, b, sag, deckSag, width = 1.6) => {
        const A = V(...a), B = V(...b), across = B.clone().sub(A).setY(0).normalize(), side = V(-across.z, 0, across.x).multiplyScalar(width / 2);
        for (const e of [-1, 1]) {
          const off = side.clone().multiplyScalar(e);
          const cable = sagPts(A.clone().add(off).add(V(0, 1.6, 0)), B.clone().add(off).add(V(0, 1.6, 0)), sag, 30);
          const deck = sagPts(A.clone().add(off), B.clone().add(off), deckSag, 30);
          kit.add(rope, tube(cable, 0.07, 60, 3), { solid: false });
          kit.add(plank, tube(deck, 0.1, 60, 4), { solid: false });
          for (let i = 2; i < 30; i += 2) kit.add(rope, tube([cable[i], deck[i]], 0.03, 1, 3), { solid: false });
        }
      };
      bridge([-34, 66, -96], [36, 72, -74], 20, 24);
      bridge([-42, 22, -58], [36, 50, -84], 6, 8);
      bridge([-28, 18, -118], [34, 26, -124], 4, 6, 1.3);
    },
  },

  // ========================================================= 4. the sail tents
  {
    id: 'sails', title: 'Sails over the domes', sheet: 'IMG_3775', panel: 4, where: 'middle right', crop: [521, 353, 463, 294],
    camera: { eye: [0, 3.6, 0], yaw: 0, fov: 40, horizon: 0.63 },
    sun: { side: -110, el: 48 },
    sky: ['#abc6cb', '#b5cdcd', '#a39689', '#ffffff', '#fff6dc'],
    look: DUNES,   // (the far dunes in stepped bands, as the desert's other sheets)
    fog: 0.3,
    ground: {
      height: (x, z) => {
        const r = r2(x, z);
        let h = 1.9 - 0.045 * Math.max(0, -z - 4) + 0.5 * n2(x * 0.03, z * 0.03);
        h = Math.max(h, -0.6 + 0.4 * n2(x * 0.02, z * 0.02));
        h += smoothstep(90, 220, -z) * (2.5 + 4 * ridged(x * 0.5, z, 0.01, 4)) + 9 * smoothstep(-10, 140, x) * smoothstep(70, 170, -z);
        return h + smoothstep(400, 1200, r) * 5;
      },
      material: { color: '#f4c77e', color2: '#f1c085', color3: '#e7ad62', ripples: true, sandInk: true },
    },
    people: [{ at: [21, -55], facing: 2.6, palette: PERSON, head: 'hood' }],
    build(kit) {
      const H = (x, z) => kit.H(x, z);
      // (cloth: a light shade with few strokes, the panel's sails are toned, barely hatched)
      const sail = kit.mat({ color: '#e2a46e', side: THREE.DoubleSide, shade: 0.25, hatch: 0.3 });
      const sail2 = kit.mat({ color: '#dc9a62', side: THREE.DoubleSide, shade: 0.25, hatch: 0.3 });
      const sailPale = kit.mat({ color: '#efd6ae', side: THREE.DoubleSide, shade: 0.25, hatch: 0.3 });
      const spar = kit.mat({ color: '#7a5c44', flat: true });
      const domeM = kit.mat({ color: '#dcbb8c' });
      const domeFar = kit.mat({ color: '#e2c398' });
      const dark = kit.mat({ color: '#5d4636', flat: true });
      const rock = kit.mat({ color: '#a8977e', flat: true });
      // the bat-wing sails fanned from a hub on the main dome: a big wing to the left, a smaller one to the right
      const hub = V(0, kit.base(0, -50, 3.8) - 0.3 + 3.8 * 1.75 - 0.3, -50);
      const wing = (B, offs, bulge, mat) => {
        const fingers = offs.map(([x, y, z]) => B.clone().add(V(x, y, z)));
        kit.add(mat, sailGeo(B, fingers, bulge), { solid: false });
        for (const F of fingers) kit.add(spar, tube([B, B.clone().lerp(F, 0.5).add(V(0, 0.6, 0.8)), F], 0.12, 14, 4), { solid: false });
        return fingers;
      };
      const L = wing(hub, [[-19, -1.5, 4], [-21, 4, 3], [-16, 11, 2], [-10, 16.5, 0.5], [-3, 18.5, -1], [2.5, 17.5, -2]], 2.4, sail);
      wing(hub.clone().add(V(3.5, -0.4, 0.8)), [[3, 8, -1], [8, 9.5, 0], [14, 10, 1], [15, 3, 2.5], [10, 0.5, 3]], 1.4, sail2);
      wing(hub.clone().add(V(1.5, 0.2, -3)), [[0.5, 7, -1], [3, 7.5, -1], [6, 5.5, -1]], 0.7, sailPale);
      // a prop pole under the high tip of the big wing, stays to the sand
      kit.add(spar, tube([L[1], V(L[1].x + 3, H(L[1].x + 3, L[1].z) - 0.2, L[1].z + 1)], 0.1, 1, 4), { solid: false });
      kit.add(spar, tube([L[0], V(L[0].x - 3, H(L[0].x - 3, L[0].z + 2), L[0].z + 2)], 0.04, 1, 3), { solid: false });
      kit.add(spar, tube([hub, V(hub.x - 7, hub.y + 6, hub.z - 2), L[2]], 0.05, 8, 3), { solid: false });
      // the domes: the main one under the hub (two dark eyes, a mouth), one to the left, one far right with a mast
      const domeAt = (x, z, r, sy, m, windows) => {
        const y = kit.base(x, z, r) - 0.3;
        kit.add(m, dome(r, sy, 24).translate(x, y, z));
        for (const [dx, dy] of windows) kit.add(dark, put(new THREE.SphereGeometry(0.32, 8, 6), x + dx * r, y + dy * r * sy, z + r * Math.sqrt(Math.max(0.05, 1 - dx * dx - dy * dy)) * 0.98, 0, [1, 1.3, 0.4]), { solid: false });
        return y;
      };
      domeAt(0, -50, 3.8, 1.75, domeM, [[-0.3, 0.62], [0.3, 0.62], [0, 0.32]]);
      domeAt(-17, -40, 3.0, 0.95, domeM, []);
      domeAt(8, -48, 2.0, 0.8, domeFar, []);
      const fy = domeAt(42, -84, 4.0, 0.95, domeFar, [[0, 0.3]]);
      kit.add(spar, new THREE.CylinderGeometry(0.1, 0.2, 26, 5).translate(42, fy + 13, -84));
      kit.add(spar, new THREE.CylinderGeometry(0.35, 0.35, 0.9, 6).translate(42, fy + 17, -84));
      for (const [x, z, r] of [[-4, -44, 0.9], [-7, -46, 1.2], [5, -43, 0.8], [-10, -42, 1.0], [20, -60, 1.4], [26, -62, 1.1], [-13, -47, 1.2], [-17, -44, 0.7]])
        kit.add(rock, put(new THREE.DodecahedronGeometry(r, 0), x, H(x, z) + r * 0.15, z, x, [1.5, 0.5, 1]));
      // tyre tracks curving across the sand to the domes
      const tracks = kit.mat({ color: '#d99a50', flat: true, side: THREE.DoubleSide });
      for (const o of [-0.8, 0.8]) {
        kit.add(tracks, groundRibbon(H, [[1 + o * 0.6, -3], [3 + o * 0.7, -14], [6 + o * 0.8, -26], [3 + o, -44]], 0.18, 0.09), { solid: false });
        kit.add(tracks, groundRibbon(H, [[5 + o * 0.6, -3], [8 + o * 0.7, -14], [12 + o * 0.8, -26], [17 + o, -40]], 0.18, 0.09), { solid: false });
      }
    },
  },

  // ========================================================= 5. the turquoise lake
  {
    id: 'lake', title: 'The lake under the violet cliffs', sheet: 'IMG_3775', panel: 5, where: 'bottom left', crop: [42, 663, 463, 294],
    camera: { eye: [0, 14, 0], yaw: 0, fov: 40, horizon: 0.345 },
    sun: { side: 120, el: 36 },
    sky: ['#b7d6df', '#bdd8de', '#8f95a3', '#ffffff', '#fff6dc'],
    look: DUNES,   // (the far dunes in stepped bands, as the desert's other sheets)
    fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a pink rock shelf falling from under you to the shore, a pink slope rising on the left, the lake's bed, the far shore under the cliffs
        const ledges = 0.9 * smoothstep(-0.05, 0.12, n3(x * 0.035, z * 0.05)) + 0.6 * smoothstep(0.05, 0.22, n2(x * 0.07 + 9, z * 0.09));   // steps in the rock: inked edges
        const rock = 1.6 + 10.2 * smoothstep(28, 0, d) + 24 * smoothstep(5, -70, x + 0.25 * d) * smoothstep(250, 130, d) + 0.8 * n2(x * 0.06, z * 0.06) + ledges;
        const e = r2((x - 55) / 155, (d - 148) / 96) + 0.1 * n3(x * 0.02, z * 0.02);   // the lake's outline: < 1 inside
        // broad pale shallows on the near and left side, the deep water off to the right under the cliff
        const bed = -2.3 + 2.0 * smoothstep(-0.15, 0.45, n2(x * 0.008 + 4, z * 0.013) - 0.004 * (x - 40)) + 0.3 * n3(x * 0.03, z * 0.03);
        const k = smoothstep(1.0, 0.88, e);
        return rock * (1 - k) + bed * k;
      },
      material: { color: '#dba9b4', color2: '#d79fac', color3: '#c98f9d', pattern: 'cracks' },
      rings: { r1: 1500 },
    },
    people: [{ at: [7.3, -30], facing: 3.0, palette: PERSON, head: 'hood' }],
    build(kit) {
      // the lake: one flat sheet of water at 0 (the bed under it decides its tones: water.js)
      kit.mesh(new THREE.PlaneGeometry(420, 240, 1, 1).rotateX(-Math.PI / 2).translate(40, 0, -150), kit.mat({ color: '#6fc2b6', color2: '#bfe0cf', mode: MODE_WATER }), { solid: false, shadow: false });
      // the violet cliffs: one wall across the far shore, in two set-back tiers, turning towards you on the right
      const cliff = kit.mat({ color: '#a19fca', color2: '#9c9ac6', color3: '#a6a4cf', mode: MODE_STRATA, strataSize: 5, flat: true });
      const nC = createNoise2D(377505);
      const faceAt = (t, inset) => {
        const x = -300 + 600 * t, bend = smoothstep(0.52, 1, t);
        const z = -268 + bend * 175 + inset * (1 - bend) + 3 * nC(t * 9, 3) + 2.2 * Math.sign(Math.sin(t * 61)) * Math.abs(nC(t * 40, 1));   // jagged: vertical fissures
        return [x - bend * inset * 0.8, z];
      };
      for (const [y0, y1, inset] of [[-4, 34, 0], [34, 54, -7]]) {
        const sh = new THREE.Shape(), n = 90, pts = [];
        for (let i = 0; i <= n; i++) pts.push(faceAt(i / n, inset));
        pts.push([340, -400], [-300, -400]);
        pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
        kit.add(cliff, new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2).translate(0, y0, 0));
      }
      // dark slabs and boulders on the pink shelf
      const slab = kit.mat({ color: '#b98f9c', flat: true });
      for (const [x, z, r] of [[-22, -36, 1.8], [-14, -30, 1.2], [26, -34, 2.2], [36, -40, 1.6], [-4, -46, 1], [-30, -50, 2.4], [14, -48, 1.2], [44, -44, 1.4]])
        kit.add(slab, put(new THREE.DodecahedronGeometry(r, 0), x, kit.H(x, z) + r * 0.1, z, x, [1.6, 0.45, 1.1]));
    },
  },

  // ========================================================= 6. the buried ship
  {
    id: 'wreck', title: 'The buried hull', sheet: 'IMG_3775', panel: 6, where: 'bottom right', crop: [521, 662, 463, 294],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 38, horizon: 0.52 },
    sun: { side: 125, el: 38 },
    sky: ['#bdd1cb', '#c3d3ca', '#9c968c', '#ffffff', '#fff6dc'],
    look: DUNES,   // (the far dunes in stepped bands, as the desert's other sheets)
    fog: 0.3,
    ground: {
      height: (x, z) => {
        const d = -z;
        let h = -0.17 * Math.max(0, d) * smoothstep(0, 30, d) + 0.4 * n2(x * 0.04, z * 0.04);
        h = Math.max(h, -10);
        // the dune heaped against the hull's front, rising to the right, and the slope down to it
        h += 6 * smoothstep(-22, 16, x - 0.35 * d + 10) * smoothstep(36, 62, d) * (1 - smoothstep(90, 118, d));
        h += 3.5 * gauss(x, z, 22, -64, 9) + 4 * gauss(x, z, 42, -72, 12) + 2 * gauss(x, z, -8, -70, 8);
        h += smoothstep(110, 160, d) * (9 + 2 * ridged(x, z, 0.01, 6));
        return h + smoothstep(500, 1200, r2(x, z)) * 6;
      },
      material: { color: '#fbca86', color2: '#f8c47c', color3: '#efb46a', ripples: true, sandInk: true },
    },
    people: [{ at: [7, -43], facing: -0.3, palette: PERSON, head: 'hood' }],
    build(kit) {
      const H = (x, z) => kit.H(x, z);
      const hull = kit.mat({ color: '#ddd5c3', grid: 4.5, plates: true });
      const hullDark = kit.mat({ color: '#b2ab9c', flat: true });
      const dark = kit.mat({ color: '#4c4440', flat: true });
      const mast = kit.mat({ color: '#8a8278', flat: true });
      const cx = 22, cz = -80, base = -6.5;
      // the main hull: a great rounded shell, nose down in the dune, plated, a ridge along its crown
      kit.add(hull, put(new THREE.SphereGeometry(1, 44, 28), cx, base + 4, cz, -0.35, [17, 15, 14], 0.05, -0.06));
      kit.add(hullDark, put(new THREE.TorusGeometry(1, 0.025, 5, 56), cx, base + 6, cz, -0.35, [16.8, 15, 13.8], Math.PI / 2 - 0.12, 0));
      kit.add(hull, put(new THREE.SphereGeometry(1, 24, 14), cx - 3, base + 16.5, cz - 2, -0.3, [8, 2.4, 6]));
      kit.add(hullDark, put(new THREE.BoxGeometry(1, 1, 1), cx - 1, base + 17.6, cz - 3, -0.3, [10, 0.8, 1.2]));
      // the torn-open front: a dark cavity with machinery
      kit.add(dark, put(new THREE.SphereGeometry(1, 16, 12), cx + 6.5, base + 6, cz + 11.5, -0.35, [5, 4.6, 3]), { solid: false });
      for (let i = 0; i < 6; i++) kit.add(hullDark, put(new THREE.CylinderGeometry(0.25, 0.25, 6, 5), cx + 3 + i * 1.3, base + 6 + (i % 3), cz + 13 - i * 0.2, 0, 1, 0.3 * i, 0.4), { solid: false });
      // the body trailing left along one axis: drums with rings, pods
      const ax = V(-1, 0, 0.22).normalize();
      for (const [k, r, len] of [[19, 5.2, 8], [27, 4.4, 8], [34.5, 3.6, 7]]) {
        const p = V(cx, 0, cz).addScaledVector(ax, k), y = H(p.x, p.z) + r * 0.45;
        const yaw = Math.atan2(-ax.z, ax.x);
        kit.add(hull, put(new THREE.CylinderGeometry(r, r, len, 28).rotateZ(Math.PI / 2), p.x, y, p.z, yaw));
        kit.add(hullDark, put(new THREE.TorusGeometry(r + 0.12, 0.3, 5, 28).rotateY(Math.PI / 2), p.x, y, p.z, yaw).translate(ax.x * len * 0.5, 0, ax.z * len * 0.5));
      }
      for (const [x, z, r] of [[cx - 44, cz + 14, 2.5], [cx - 50, cz + 9, 2], [cx - 14, cz + 15, 2.6]]) kit.add(hull, put(new THREE.SphereGeometry(r, 16, 10), x, H(x, z) + r * 0.3, z, 0, [1.5, 1, 1]));
      // masts: a tall one on the shell's crown, a short one by the arch
      const my = base + 17;
      kit.add(mast, new THREE.CylinderGeometry(0.2, 0.32, 34, 6).translate(cx + 1, my + 17, cz - 2));
      kit.add(mast, new THREE.BoxGeometry(2.4, 0.2, 0.2).translate(cx + 1, my + 26, cz - 2));
      kit.add(mast, new THREE.CylinderGeometry(0.12, 0.16, 10, 5).translate(cx + 4, my + 5, cz - 1));
      // the arch, and the saucer tower standing under it
      const ax0 = cx - 42, az0 = cz + 3, ay = H(ax0, az0);
      kit.add(hullDark, put(new THREE.TorusGeometry(9, 0.45, 6, 40, Math.PI), ax0, ay - 0.5, az0, 0.5, [1, 1.25, 1]));
      kit.add(hull, new THREE.CylinderGeometry(0.6, 0.9, 9, 10).translate(ax0 + 1, ay + 4.5, az0 - 2));
      kit.add(hull, lathe([[0.01, 0], [4.2, 0.5], [4.4, 1.2], [3, 2], [0.01, 2.2]], 28).translate(ax0 + 1, ay + 7.5, az0 - 2));
      kit.add(hullDark, lathe([[0.01, 0], [2.6, 0.4], [2.6, 1], [0.01, 1.3]], 20).translate(ax0 + 1, ay + 5.6, az0 - 2));
      kit.add(mast, new THREE.CylinderGeometry(0.08, 0.12, 12, 5).translate(ax0 + 1, ay + 15, az0 - 2));
      // a far settlement, low and pale, on the horizon to the left
      const far = kit.mat({ color: '#efd2a9', flat: true });
      for (let i = 0; i < 14; i++) {
        const x = -190 + i * 9 + 4 * Math.sin(i * 2.1), z = -340 + 10 * Math.cos(i * 1.7), h = 2 + (i % 4) * 1.3;
        kit.add(far, new THREE.BoxGeometry(5, h, 5).translate(x, H(x, z) + h / 2 - 1, z));
      }
    },
  },
];

export const DESERT_VIEWS = [
  // ===================================================================== IMG_3772
  {
    id: '3772-ribs', title: 'Ribs on the dune crest', sheet: 'IMG_3772', panel: 1, where: 'top left', crop: [34, 32, 470, 259],
    camera: { eye: [0, 3.2, 0], yaw: 0, fov: 34, horizon: 0.42 },
    sun: { side: 70, el: 40 },
    sky: ['#a9c3d0', '#b9cfd5', '#a39488', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // the long dune rising to its crest ~45 m out, where the ribs lie, then away; far dunes low
        return 5.5 * smoothstep(-5, 34, d) * (1 - smoothstep(40, 80, d)) + 0.8 * n2(x * 0.02, z * 0.02) + 2 * smoothstep(80, 200, d) * ridged(x, z, 0.008, 3) + far(x, z, 300, 5);
      },
      material: sand('#f3b56a', '#efab5c', '#e4994e'),
    },
    people: [{ at: [8.5, -22], facing: 0.3, palette: PERSON, head: 'hood' }],
    build(kit) {
      ribcage(kit, bones(kit, '#efdcbc', '#dcc29d'), { x: -5, z: -34, yaw: -0.18, len: 26, rise: 4.6, ribs: 15, sink: 0.6, skull: -1 });
    },
  },
  {
    id: '3772-saucers', title: 'Blue saucers over the spired city', sheet: 'IMG_3772', panel: 2, where: 'top right', crop: [521, 32, 469, 296],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 54, horizon: 0.74 },
    sun: { side: -125, el: 32 },
    sky: ['#a6c3d6', '#b6cfdc', '#8e99a8', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.3,
    ground: { height: (x, z) => 0.3 * n2(x * 0.02, z * 0.02) + far(x, z, 250, 4), material: sand('#f3d6b6', '#f0cfac', '#e6c19c') },
    people: [{ at: [-4.2, -11], facing: 0.2, palette: PERSON, head: 'hood' }],
    build(kit) {
      const blue = kit.mat({ color: '#93aec8', side: THREE.DoubleSide }), stem = kit.mat({ color: '#9fb6cc' }), rim = kit.mat({ color: '#5e6f84', flat: true });
      const domeM = [kit.mat({ color: '#dde3ea' }), kit.mat({ color: '#c9d4df' }), kit.mat({ color: '#b2c2d4', weathered: 0.5 })];
      const spire = kit.mat({ color: '#c4d1df', weathered: 0.5 }), dark = kit.mat({ color: '#56637a', flat: true });
      // the saucers: two huge ones framing the city, smaller ones behind
      for (const [x, z, h, R, tilt, az] of [[-36, -56, 22, 24, 0.55, -0.5], [44, -66, 26, 27, 0.5, 0.45], [-16, -112, 16, 13, 0.45, -0.2], [22, -130, 18, 14, 0.45, 0.2], [-54, -140, 12, 10, 0.4, -0.4]])
        stemDish(kit, { cap: blue, stem, rim }, { x, z, h, R, r: R * 0.16, tilt, az, bowl: 0.3 });
      // the city: domes crowding low, a cluster of spires in the middle
      const rng = kit.rng;
      for (let i = 0; i < 46; i++) {
        const x = -70 + rng() * 140, z = -95 - rng() * 60, r = 2.5 + rng() * 4;
        kit.add(domeM[i % 3], dome(r, 0.8 + rng() * 0.4).translate(x, kit.base(x, z, r) - 0.3, z));
      }
      for (const [x, z, h, r] of [[2, -125, 44, 3.2], [-6, -118, 30, 2.6], [10, -120, 34, 2.4], [-14, -128, 24, 2.2], [16, -132, 26, 2], [-2, -110, 18, 3.5], [6, -112, 22, 2.8]]) {
        const y = kit.H(x, z);
        kit.add(spire, new THREE.CylinderGeometry(r * 0.7, r, h, 10).translate(x, y + h / 2, z));
        kit.add(spire, new THREE.ConeGeometry(r * 0.75, h * 0.35, 10).translate(x, y + h + h * 0.17, z));
        kit.add(dark, put(new THREE.BoxGeometry(r * 0.5, r * 0.9, 0.2), x, y + h * 0.4, z + r * 0.8), { solid: false });
      }
    },
  },
  {
    id: '3772-gorge', title: 'The rope bridge over the ochre gorge', sheet: 'IMG_3772', panel: 3, where: 'middle left', crop: [34, 312, 469, 333],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 54, horizon: 0.5 },
    sun: { side: 40, el: 50 },
    sky: ['#a8c5da', '#b9d0dc', '#a79583', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.3,
    ground: {
      height: (x, z) => 0.4 * n2(x * 0.04, z * 0.04) + 1.4 * smoothstep(14, 40, Math.abs(x + 4)) * smoothstep(10, 60, -z) + smoothstep(140, 260, -z) * (4 + 4 * ridged(x, z, 0.02, 2)),
      material: sand('#f2c88e', '#efc186', '#dfae70', { pattern: 'cracks' }),
    },
    people: [{ at: [1.5, -58], facing: 0.1, palette: PERSON, head: 'hood' }],
    build(kit) {
      const wall = strataMat(kit, '#efb15f', '#e7a552', '#f4c27a', 4.5), shaded = strataMat(kit, '#e6a95d', '#dc9a4f', '#eebc77', 5);
      gorgeWall(kit, shaded, { side: -1, x0: -58, slope: -0.18, z0: 30, z1: -170, top: 40, tiers: [[0, 0.4, 0], [0.4, 0.75, 5], [0.75, 1, 10]], seed: 3 });
      gorgeWall(kit, wall, { side: 1, x0: 40, slope: -0.14, z0: 20, z1: -170, top: 44, tiers: [[0, 0.3, -2], [0.3, 0.65, 3], [0.65, 1, 7]], seed: 7 });
      const rope = kit.mat({ color: '#5a4c40', flat: true }), plank = kit.mat({ color: '#8f7458', flat: true });
      bridge(kit, { rope, plank }, [-50, 40, -80], [30, 42, -92], { sag: 9, deckSag: 12, width: 1.8 });
      bridge(kit, { rope, plank }, [-42, 38, -112], [28, 40, -118], { sag: 5, deckSag: 7, width: 1.4 });
      for (const [x, z, s] of [[-20, -40, 3], [16, -50, 4], [22, -90, 5], [-18, -100, 3.5]]) kit.add(wall, put(new THREE.DodecahedronGeometry(s, 0), x, kit.H(x, z) + s * 0.25, z, x, [1.4, 0.55, 1]));
    },
  },
  {
    id: '3772-petals', title: 'The petal station on the salt', sheet: 'IMG_3772', panel: 4, where: 'middle right', crop: [522, 348, 468, 288],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 40, horizon: 0.7 },
    sun: { side: -100, el: 38 },
    sky: ['#a9c3d1', '#b9cfd7', '#a0948c', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.3,
    ground: { height: (x, z) => 0.2 * n2(x * 0.03, z * 0.03) + far(x, z, 200, 3) + 1.5 * smoothstep(60, 140, -z) * ridged(x, z, 0.01, 4), material: sand('#f3d3ae', '#f0caa2', '#e6bd94', { pattern: 'cracks' }) },
    people: [{ at: [-4.5, -33], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const petal = kit.mat({ color: '#e6b994', side: THREE.DoubleSide, shade: 0.25, hatch: 0.3 }), petal2 = kit.mat({ color: '#f0d4b6', side: THREE.DoubleSide, shade: 0.3, hatch: 0.3 });
      const rope = kit.mat({ color: '#5d4a3e', flat: true }), base = kit.mat({ color: '#d8b494' });
      const x = 4, z = -42;
      petals(kit, [petal, petal2], { x, z, n: 7, len: 11, w: 4.2, lean: 0.32, lift: 1.2, az: 0.3, cup: 0.3 });
      kit.add(base, dome(4, 0.45).translate(x, kit.H(x, z) - 0.2, z));
      cage(kit, rope, { x, y: kit.H(x, z) + 1.4, z, r: 3.8, h: 9, meridians: 9, rings: 3 });
      for (const [rx, rz, s] of [[10, -38, 1.2], [-3, -40, 0.9], [13, -46, 1.4]]) kit.add(base, put(new THREE.DodecahedronGeometry(s, 0), rx, kit.H(rx, rz) + s * 0.2, rz, rx, [1.5, 0.5, 1]));
    },
  },
  {
    id: '3772-salt-lake', title: 'The salt lake under the violet table', sheet: 'IMG_3772', panel: 5, where: 'bottom left', crop: [31, 668, 472, 321],
    camera: { eye: [0, 4, 0], yaw: 0, fov: 42, horizon: 0.38 },
    sun: { side: -60, el: 42 },
    sky: ['#b1c8d3', '#bfd2d8', '#9a9aab', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // the white shore under you, down into the lake ~22 m out; the far shore rises to the cliff's foot
        const shore = 1.2 - 1.6 * smoothstep(12, 28, d - 0.08 * x) + 0.15 * n2(x * 0.05, z * 0.05);
        return Math.max(shore, -1.8 + 0.6 * n3(x * 0.03, z * 0.03) + 2.8 * smoothstep(205, 232, d));
      },
      material: { color: '#f4eff4', color2: '#ebe3ee', color3: '#d9cde0', pattern: 'cracks' },
      rings: { r1: 1500 },
    },
    people: [{ at: [-4, -17], facing: 0.1, palette: PERSON, head: 'hood' }],
    build(kit) {
      kit.mesh(new THREE.PlaneGeometry(500, 200, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -110), kit.mat({ color: '#45c4c8', color2: '#8fdcd8', mode: MODE_WATER }), { solid: false, shadow: false });
      // the floating salt plates: flat white slabs, many small ones near, fewer far
      const plate = kit.mat({ color: '#eef3f3', flat: true }), rng = kit.rng;
      for (let i = 0; i < 90; i++) {
        const z = -26 - Math.pow(rng(), 1.4) * 120, x = (rng() - 0.5) * (60 + (-z) * 1.6), r = 0.8 + rng() * 3.2 * (1 + -z / 60);
        const g = new THREE.CylinderGeometry(r, r, 0.12, 6 + Math.floor(rng() * 4)).scale(1 + rng(), 1, 0.6 + rng() * 0.6).rotateY(rng() * 3);
        kit.add(plate, g.translate(x, 0.05, z), { solid: false, shadow: false });
      }
      const cliff = strataMat(kit, '#a99bd6', '#a294d1', '#b2a5dc', 6);
      tableCliff(kit, cliff, (t, inset) => [-300 + 600 * t, -235 + inset + 4 * Math.sin(t * 23) + 2 * n4(t * 30, 1)], [[-2, 21, 0], [21, 25, -4]]);
    },
  },
  {
    id: '3772-station', title: 'The station of domes and masts', sheet: 'IMG_3772', panel: 6, where: 'bottom right', crop: [522, 658, 468, 332],
    camera: { eye: [0, 2.2, 0], yaw: 0, fov: 40, horizon: 0.53 },
    sun: { side: -110, el: 40 },
    sky: ['#b3c7d1', '#c0d1d6', '#a39a91', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.3,
    ground: { height: (x, z) => 0.6 * n2(x * 0.02, z * 0.02) - 0.03 * Math.max(0, -z - 10) + far(x, z, 300, 3), material: sand('#f2d0a8', '#efc79c', '#e3b98b', { pattern: 'cracks' }) },
    build(kit) {
      const pale = kit.mat({ color: '#efe2d2', weathered: 0.6 }), pale2 = kit.mat({ color: '#e2d0bc', flat: true, weathered: 0.7 }), dark = kit.mat({ color: '#5a4a40', flat: true });
      const mast = kit.mat({ color: '#8c7a6a', flat: true });
      // a quonset with a dark mouth, two domes, a long barrel hut, masts
      // (the panel's centre a little right of the frame's: a quonset with a dark mouth, a long barrel hut)
      const qx = 6, qz = -40, qy = kit.base(qx, qz, 6) - 0.3;
      kit.add(pale, new THREE.CylinderGeometry(5, 5, 9, 24, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(0.25).translate(qx, qy, qz));
      kit.add(dark, put(new THREE.CircleGeometry(2.4, 14, 0, Math.PI), qx - 1.1, qy, qz + 4.6, 0.25), { solid: false });
      kit.add(pale2, new THREE.CylinderGeometry(3.6, 3.6, 12, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(20, kit.base(20, -44, 5) + 1.5, -44));
      for (let i = 0; i < 5; i++) kit.add(dark, put(new THREE.BoxGeometry(0.6, 1.4, 0.2), 16 + i * 1.6, kit.H(20, -44) + 3.2, -40.3), { solid: false });
      for (const [x, z, r] of [[-4, -38, 3], [0, -47, 2.4], [12, -50, 2.8], [-10, -44, 2]]) kit.add(pale, dome(r, 1.05).translate(x, kit.base(x, z, r) - 0.2, z));
      for (const [x, z, h] of [[3, -50, 30], [-8, -48, 15], [10, -54, 18], [-16, -42, 8]]) kit.add(mast, new THREE.CylinderGeometry(0.15, 0.25, h, 5).translate(x, kit.H(x, z) + h / 2, z));
      // a gantry arch and its little dome, off to the left
      kit.add(mast, put(new THREE.TorusGeometry(3, 0.16, 5, 24, Math.PI), -24, kit.H(-24, -44) - 0.2, -44, 0.6));
      kit.add(pale, dome(1.4, 1).translate(-21, kit.H(-21, -42) - 0.1, -42));
    },
  },

  // ===================================================================== IMG_3773
  {
    id: '3773-ribs', title: 'The ribcage between the dunes', sheet: 'IMG_3773', panel: 1, where: 'row 1, left', crop: [38, 41, 465, 226],
    camera: { eye: [0, 6, 0], yaw: 0, fov: 34, horizon: 0.26 },
    sun: { side: -60, el: 40 },
    sky: ['#a7c0cc', '#b8ccd1', '#a8917a', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.22,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a hollow ~40 m out where the bones lie; dunes rising on both sides, the left one sharp-crested
        return 4.5 * smoothstep(45, 85, d) * ridged(x, z, 0.01, 2) + 9 * gauss(x, z, -42, -42, 18) + 7 * gauss(x, z, 40, -55, 20) - 1.2 * gauss(x, z, 0, -30, 12) + 2.5 * smoothstep(-5, 12, d) * (1 - smoothstep(12, 24, d)) + far(x, z, 250, 8);
      },
      material: sand('#f3b46a', '#efaa5d', '#e2964f'),
    },
    build(kit) {
      ribcage(kit, bones(kit, '#e8d3b2', '#cfb48e'), { x: 1, z: -31, yaw: -0.2, len: 20, rise: 3.4, ribs: 16, sink: 0.7, skull: 1, lean: 0.6 });
    },
  },
  {
    id: '3773-umbrellas', title: 'The pink umbrella city', sheet: 'IMG_3773', panel: 2, where: 'row 1, right', crop: [524, 41, 463, 226],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 40, horizon: 0.86 },
    sun: { side: 110, el: 34 },
    sky: ['#a6c6d4', '#b7d2da', '#a08d84', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.3,
    ground: { height: (x, z) => 0.2 * n2(x * 0.03, z * 0.03), material: sand('#f2c79f', '#efbf94', '#e3af84') },
    people: [{ at: [6, -52], facing: 0, palette: PERSON, head: 'hood' }],
    build(kit) {
      const cap = kit.mat({ color: '#e7a07f', side: THREE.DoubleSide, shade: 0.25, hatch: 0.4 }), cap2 = kit.mat({ color: '#efb59c', side: THREE.DoubleSide, shade: 0.25, hatch: 0.4 });
      const stem = kit.mat({ color: '#e0a080' }), rim = kit.mat({ color: '#9c6a58', flat: true });
      for (const [x, z, h, R, tilt, k] of [[30, -92, 34, 19, 0.1, 0], [-8, -96, 30, 16, -0.08, 1], [-30, -104, 24, 12, 0.12, 0], [-52, -118, 20, 10, -0.1, 1], [48, -130, 26, 14, 0.05, 1], [12, -130, 22, 11, 0.15, 0], [-70, -140, 16, 9, 0, 0], [66, -110, 18, 10, -0.2, 0]])
        stemDish(kit, { cap: k ? cap2 : cap, stem, rim }, { x, z, h: h * 0.8, R: R * 1.25, r: R * 0.12, tilt: 0.35 + tilt, bowl: 0.28 });
      const adobe = [kit.mat({ color: '#e9b28e', weathered: 0.8 }), kit.mat({ color: '#d99c78', flat: true, weathered: 0.8 }), kit.mat({ color: '#f2c6a6', weathered: 0.6 })], dark = kit.mat({ color: '#6a4636', flat: true });
      const rng = kit.rng;
      for (let i = 0; i < 70; i++) {
        const x = -80 + rng() * 160, z = -72 - rng() * 70, r = 1.8 + rng() * 3.4, y = kit.base(x, z, r) - 0.2;
        if (rng() < 0.4) { const h = r * (1 + rng()); kit.add(adobe[1], new THREE.CylinderGeometry(r, r * 1.05, h, 12).translate(x, y + h / 2, z)); kit.add(adobe[2], dome(r * 1.02, 0.7).translate(x, y + h, z)); }
        else kit.add(adobe[i % 3], dome(r, 0.9 + rng() * 0.4).translate(x, y, z));
        if (rng() < 0.5) kit.add(dark, put(new THREE.BoxGeometry(r * 0.4, r * 0.55, 0.2), x, y + r * 0.27, z + r * 0.95), { solid: false });
      }
    },
  },
  {
    id: '3773-canyon-bridge', title: 'The bridge over the shaded canyon', sheet: 'IMG_3773', panel: 3, where: 'row 2, left', crop: [38, 281, 465, 224],
    camera: { eye: [0, 26, 0], yaw: 0, fov: 44, horizon: 0.42 },
    sun: { side: 150, el: 34 },
    sky: ['#9fc2d4', '#b0cfdb', '#9a7c62', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.25,
    ground: {
      height: (x, z) => {
        // a V of a canyon down to a stream ~30 m below the eye, its floor rising away to a far mesa line
        const d = -z, v = Math.abs(x + 0.06 * d + 2 * n3(z * 0.02, 1)) - 4;
        return 2 + Math.min(34, 1.4 * Math.max(0, v) + 0.4 * Math.max(0, v - 10)) + 0.6 * n2(x * 0.05, z * 0.05) + smoothstep(150, 240, d) * 10;
      },
      material: sand('#eeb877', '#e8ad69', '#cf9559'),
    },
    build(kit) {
      // (the canyon is the ground's: its steep sides take the rock tone; ledges of strata on the rims)
      const wall = strataMat(kit, '#dba268', '#cc9157', '#e8b47a', 5);
      for (const [x, z, w, d, h] of [[-34, -40, 10, 30, 6], [32, -60, 12, 40, 5], [-30, -110, 14, 40, 8], [30, -130, 10, 30, 6]]) kit.add(wall, new THREE.BoxGeometry(w, h, d).translate(x, kit.H(x, z) + h / 2 - 1, z));
      kit.mesh(new THREE.PlaneGeometry(14, 240, 1, 1).rotateX(-Math.PI / 2).rotateY(0.06).translate(-6, 2.15, -120), kit.mat({ color: '#78c3c0', color2: '#a8dad2', mode: MODE_WATER }), { solid: false, shadow: false });
      const rope = kit.mat({ color: '#4c4038', flat: true }), plank = kit.mat({ color: '#7d6550', flat: true });
      bridge(kit, { rope, plank }, [-24, 26, -66], [22, 26, -70], { sag: 7, deckSag: 0.6, width: 2.4, hang: 0.4, towers: 9 });
    },
  },
  {
    id: '3773-poles', title: 'The poles and cables on the pink plain', sheet: 'IMG_3773', panel: 4, where: 'row 2, right', crop: [524, 281, 463, 224],
    camera: { eye: [0, 2.4, 0], yaw: 0, fov: 40, horizon: 0.6 },
    sun: { side: -120, el: 36 },
    sky: ['#a2c5d4', '#b3d0d9', '#a6857b', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.3,
    ground: {
      height: (x, z) => 0.5 * n2(x * 0.02, z * 0.02) + 1.6 * smoothstep(80, 200, -z) * ridged(x, z, 0.008, 6) + far(x, z, 300, 4) - 0.8 * gauss(x, z, -9, -11, 3.5),
      material: sand('#f1b49a', '#eeab90', '#e19a80', { pattern: 'cracks' }),
    },
    people: [{ at: [-6, -50], facing: 0.3, palette: PERSON, head: 'hood' }],
    build(kit) {
      const pole = kit.mat({ color: '#a07e6a', flat: true }), cable = kit.mat({ color: '#5c4a42', flat: true });
      kit.mesh(new THREE.CircleGeometry(3, 24).scale(1.8, 1, 0.5).rotateX(-Math.PI / 2).translate(-9, -0.25, -11), kit.mat({ color: '#7cc6c2', color2: '#a9dad4', mode: MODE_WATER }), { solid: false, shadow: false });
      // the tall mast on the right with its stays fanned to the ground, and its line of poles
      const mx = 16, mz = -40, my = kit.H(mx, mz), mh = 30;
      kit.add(pole, new THREE.CylinderGeometry(0.18, 0.3, mh, 6).translate(mx, my + mh / 2, mz));
      kit.add(pole, new THREE.CylinderGeometry(0.12, 0.2, mh * 0.95, 6).translate(mx + 1.2, my + mh * 0.475, mz - 0.6));
      for (const [ax, az] of [[-22, -60], [36, -36], [10, -10]]) kit.add(cable, tube([V(mx, my + mh, mz), V(ax, kit.H(ax, az) + 0.1, az)], 0.05, 1, 3), { solid: false });
      const line = [[mx, mz], [2, -90], [-8, -130], [-16, -160], [-22, -188]];
      for (let i = 1; i < line.length; i++) {
        const [x, z] = line[i], h = 9 - i;
        kit.add(pole, new THREE.CylinderGeometry(0.1, 0.14, h, 5).translate(x, kit.H(x, z) + h / 2, z));
        const [px, pz] = line[i - 1], ph = i === 1 ? mh * 0.8 : 9 - (i - 1);
        kit.add(cable, tube([V(px, kit.H(px, pz) + ph, pz), V((px + x) / 2, (kit.H(px, pz) + ph + kit.H(x, z) + h) / 2 - 2, (pz + z) / 2), V(x, kit.H(x, z) + h, z)], 0.04, 10, 3), { solid: false });
      }
      for (const [x, z] of [[-12, -70], [-18, -76], [-26, -90], [6, -110]]) kit.add(pole, new THREE.CylinderGeometry(0.08, 0.1, 4, 4).translate(x, kit.H(x, z) + 2, z));
    },
  },
  {
    id: '3773-fallen-pod', title: 'The fallen pod with its petals', sheet: 'IMG_3773', panel: 5, where: 'row 3, left', crop: [38, 522, 465, 222],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 40, horizon: 0.36 },
    sun: { side: -70, el: 40 },
    sky: ['#a7c7d6', '#b8d3dc', '#a8877c', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.28,
    ground: {
      height: (x, z) => 0.8 * n2(x * 0.02, z * 0.02) + 0.03 * Math.max(0, -z - 10) + 1.2 * smoothstep(60, 160, -z) * ridged(x, z, 0.01, 8) + far(x, z, 300, 5) - 1.4 * smoothstep(-6, -24, x) * smoothstep(0, -14, z),
      material: sand('#f1b8a2', '#eeae97', '#e09e88', { pattern: 'cracks' }),
    },
    people: [{ at: [6, -30], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const shell = kit.mat({ color: '#efc7a7', shade: 0.2 }), shell2 = kit.mat({ color: '#e1ae8e', shade: 0.2 }), dark = kit.mat({ color: '#6c4c42', flat: true }), metal = kit.mat({ color: '#d79a85', flat: true });
      const x = -6, z = -62, y = kit.H(x, z);
      // a bulb of a pod nose-up, its petals open, the body lying behind it in the sand
      kit.add(shell, put(new THREE.SphereGeometry(1, 24, 16), x, y + 9, z, 0.2, [5.5, 7, 5.5]));
      petals(kit, [shell2, shell], { x, z: z + 0.5, n: 4, len: 11, w: 4.2, lean: 0.7, lift: 7.5, az: 0.4, cup: 0.3 });
      kit.add(metal, put(new THREE.CylinderGeometry(2.6, 3, 16, 14).rotateZ(Math.PI / 2), x + 11, y + 1.4, z + 2, -0.25));
      kit.add(dark, put(new THREE.SphereGeometry(1, 12, 8), x + 1.5, y + 2.4, z + 4.5, 0, [3.5, 1.6, 1]), { solid: false });
      for (let i = 0; i < 9; i++) { const rx = x - 4 + i * 1.8, rz = z + 3 + (i % 3); kit.add(dark, put(new THREE.DodecahedronGeometry(0.7 + (i % 3) * 0.3, 0), rx, kit.H(rx, rz) + 0.2, rz, i, [1.5, 0.6, 1])); }
      // a trickle of grey-blue water and rocks in the bottom left
      kit.mesh(new THREE.PlaneGeometry(14, 6, 1, 1).rotateX(-Math.PI / 2).rotateY(0.5).translate(-16, -1.1, -9), kit.mat({ color: '#8fb8bc', color2: '#b8d6d4', mode: MODE_WATER }), { solid: false, shadow: false });
      const rock = kit.mat({ color: '#c9947c', flat: true });
      for (const [rx, rz, s] of [[-19, -12, 1.5], [-14, -8, 1], [-22, -6, 1.2], [-11, -13, 0.8], [-25, -14, 1.6]]) kit.add(rock, put(new THREE.DodecahedronGeometry(s, 0), rx, kit.H(rx, rz) + s * 0.2, rz, rx, [1.6, 0.5, 1.1]));
    },
  },
  {
    id: '3773-lagoons', title: 'The lagoons under the violet mesas', sheet: 'IMG_3773', panel: 6, where: 'row 3, right', crop: [524, 522, 463, 222],
    camera: { eye: [0, 3.5, 0], yaw: 0, fov: 40, horizon: 0.27 },
    sun: { side: 120, el: 40 },
    sky: ['#a5c9d6', '#b5d3dc', '#9c94ac', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a lilac sand spit curving from the left foreground away to the right; lagoons on both sides of it
        const spit = Math.exp(-(((x + 18 - 0.0045 * d * d) / (6 + 0.08 * d)) ** 2)) * 1.4;
        const shelf = 0.9 * smoothstep(22, 8, d - 0.2 * x) + 1.0 * smoothstep(90, 120, d - 0.1 * x);
        return -1.4 + Math.max(spit, shelf) * 2 + 0.2 * n2(x * 0.04, z * 0.04);
      },
      material: { color: '#d7b8dc', color2: '#cfafd6', color3: '#c3a2cb' },
      rings: { r1: 1500 },
    },
    people: [{ at: [-8, -12], facing: 0.2, palette: PERSON, head: 'hood' }],
    build(kit) {
      kit.mesh(new THREE.PlaneGeometry(600, 260, 1, 1).rotateX(-Math.PI / 2).translate(0, 0, -120), kit.mat({ color: '#56cdc0', color2: '#94e0d4', mode: MODE_WATER }), { solid: false, shadow: false });
      const mesa = strataMat(kit, '#9787c4', '#8f7fbd', '#a294cd', 5);
      tableCliff(kit, mesa, (t, inset) => [-400 + 380 * t, -330 + inset + (t < 0.1 || t > 0.9 ? 40 : 0)], [[-2, 26, 0], [26, 34, -6]]);
      tableCliff(kit, mesa, (t, inset) => [40 + 380 * t, -300 + inset + 12 * Math.sin(t * 9)], [[-2, 14, 0], [14, 22, -10]]);
      const plate = kit.mat({ color: '#f0f4f2', flat: true });
      for (const [x, z, r] of [[14, -40, 0.8], [30, -60, 1.1], [-2, -70, 0.6], [44, -46, 0.7], [56, -90, 1.0], [60, -30, 0.5]]) kit.add(plate, new THREE.CylinderGeometry(r, r * 1.3, 0.3, 5).translate(x, 0.12, z), { solid: false, shadow: false });
    },
  },
  {
    id: '3773-red-canyon', title: 'The stream in the red canyon', sheet: 'IMG_3773', panel: 7, where: 'row 4, left', crop: [38, 764, 465, 222],
    camera: { eye: [0, 5, 0], yaw: 0, fov: 40, horizon: 0.42 },
    sun: { side: 75, el: 40 },
    sky: ['#a6c6d2', '#bcd2d8', '#ad8d76', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.22,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a plain falling gently to a stream that winds in from the right; low pale mesas far off
        const stream = Math.exp(-(((x - 46 + 1.2 * d - 0.012 * d * d) / 6) ** 2));
        return 0.6 * n2(x * 0.02, z * 0.02) - 1.6 * stream + 1.2 * smoothstep(60, 110, d) + smoothstep(160, 260, d) * 4;
      },
      material: sand('#f0ba7e', '#ecb072', '#dc9d63'),
      rings: { r1: 1800 },
    },
    people: [{ at: [-11, -40], facing: 0.1, palette: PERSON, head: 'hood' }],
    build(kit) {
      kit.mesh(new THREE.PlaneGeometry(260, 160, 1, 1).rotateX(-Math.PI / 2).translate(30, -0.6, -60), kit.mat({ color: '#6fc4bf', color2: '#9fd8d0', mode: MODE_WATER }), { solid: false, shadow: false });
      const red = strataMat(kit, '#d98a5e', '#c97a50', '#e49a6c', 4), pale = strataMat(kit, '#f0c7a8', '#e9bd9c', '#f5d2b6', 6);
      // the pillar at the left edge, the mesa at the right
      const sh = new THREE.Shape(); [[-30, -18], [-20, -16], [-18, -26], [-26, -32]].forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
      kit.add(red, new THREE.ExtrudeGeometry(sh, { depth: 40, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -2, 0));
      for (const [inset, y0, y1] of [[0, -2, 12], [3, 12, 22], [6, 22, 28]]) {
        const m = new THREE.Shape(); [[34 + inset, -116 - inset], [70, -112 - inset], [82, -150], [40 + inset, -162]].forEach(([x, z], i) => (i ? m.lineTo(x, -z) : m.moveTo(x, -z)));
        kit.add(red, new THREE.ExtrudeGeometry(m, { depth: y1 - y0, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y0, 0));
      }
      tableCliff(kit, pale, (t, inset) => [-500 + 700 * t, -620 + inset + 30 * Math.sin(t * 7)], [[-2, 18, 0]], 900);
      for (const [x, z, s] of [[-22, -22, 1.6], [-12, -28, 1.1], [24, -110, 3]]) kit.add(red, put(new THREE.DodecahedronGeometry(s, 0), x, kit.H(x, z) + s * 0.3, z, x, [1.4, 0.6, 1]));
    },
  },
  {
    id: '3773-helmets', title: 'The two buried helmets', sheet: 'IMG_3773', panel: 8, where: 'row 4, right', crop: [524, 764, 463, 222],
    camera: { eye: [0, 12, 0], yaw: 0, fov: 40, horizon: 0.02 },
    sun: { side: -90, el: 40 },
    sky: ['#e9b07a', '#eeb98a', '#a88570', '#ffffff', '#fff6dc'],
    look: DUNES, fog: 0.2,
    ground: {
      height: (x, z) => {
        // a dune face rising steeply away up out of the frame
        const d = -z;
        return 0.12 * Math.max(0, d - 4) + 0.03 * x + 0.6 * n2(x * 0.03, z * 0.03) + 1.4 * ridged(x * 0.3, z, 0.02, 9) * smoothstep(10, 30, d);
      },
      material: sand('#f4b878', '#f0ae6c', '#e4a060'),
    },
    people: [{ at: [-1, -14], facing: 3.1, palette: PERSON, head: 'hood' }],
    build(kit) {
      const shell = kit.mat({ color: '#b5b1a4', metal: 'steel', refl: 0.25 }), dark = kit.mat({ color: '#3f3a38', flat: true }), trim = kit.mat({ color: '#8d877c', flat: true });
      machineHead(kit, { shell, dark, trim }, { x: -9, z: -28, r: 3.2, yaw: 2.6, sink: 0.4 });
      machineHead(kit, { shell, dark, trim }, { x: 7, z: -30, r: 5, yaw: 2.8, sink: 0.35 });
    },
  },

  // ===================================================================== IMG_3774
  {
    id: '3774-ribs', title: 'The ribcage in the dune\'s hollow', sheet: 'IMG_3774', panel: 1, where: 'row 1, left', crop: [35, 58, 373, 281],
    camera: { eye: [0, 8, 0], yaw: 0, fov: 42, horizon: 0.2 },
    sun: { side: -110, el: 42 },
    sky: ['#a8c8db', '#bad4e0', '#b08a63', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.22,
    ground: {
      height: (x, z) => {
        const d = -z;
        return -1.2 * gauss(x, z, -3, -24, 9) + 3 * smoothstep(40, 80, d) + 2 * dunes(x, z, 2, 0.02, 4) * smoothstep(10, 40, d) + far(x, z, 200, 10);
      },
      material: sand('#f6c16d', '#f2b661', '#e6a555'),
    },
    build(kit) {
      const B = bones(kit, '#8c96a8', '#77819a');
      ribcage(kit, B, { x: -3, z: -24, yaw: 0.25, len: 13, rise: 3.4, ribs: 11, sink: 0.5, skull: 1, lean: 0.8 });
      const shell = kit.mat({ color: '#56637e', metal: 'steel', refl: 0.2 }), dark = kit.mat({ color: '#22232c', flat: true }), trim = kit.mat({ color: '#9ba6ba', flat: true });
      machineHead(kit, { shell, dark, trim }, { x: -1.5, z: -18, r: 0.8, yaw: 1.4, sink: 0.4 });
    },
  },
  {
    id: '3774-dish-city', title: 'Pink dishes over the blue domes', sheet: 'IMG_3774', panel: 2, where: 'row 1, right', crop: [414, 58, 576, 281],
    camera: { eye: [0, 1.7, 0], yaw: 0, fov: 40, horizon: 0.66 },
    sun: { side: 80, el: 34 },
    sky: ['#9fc4dd', '#b2d1e2', '#a4877a', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.3,
    ground: { height: (x, z) => 0.3 * n2(x * 0.03, z * 0.03) + far(x, z, 200, 6) + 4 * gauss(x, z, -120, -200, 50), material: sand('#f2c27a', '#efb86f', '#e0a660') },
    people: [{ at: [-12, -46], facing: 0.1, palette: PERSON, head: 'hood' }, { at: [-2, -40], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const pink = kit.mat({ color: '#f0a87e', side: THREE.DoubleSide, shade: 0.25, hatch: 0.4 }), white = kit.mat({ color: '#f6ebe2', side: THREE.DoubleSide, shade: 0.35, hatch: 0.2 });
      const stem = kit.mat({ color: '#e6b48e', weathered: 0.6 }), rim = kit.mat({ color: '#8c6a5a', flat: true });
      stemDish(kit, { cap: pink, stem, rim }, { x: 8, z: -62, h: 20, R: 20, r: 5.2, tilt: 0.25, bowl: 0.55 });
      stemDish(kit, { cap: white, stem, rim }, { x: -26, z: -92, h: 18, R: 13, r: 2.2, tilt: 0.55, az: 0.5, bowl: 0.3 });
      stemDish(kit, { cap: white, stem, rim }, { x: 46, z: -38, h: 16, R: 22, r: 2.6, tilt: 1.1, az: -1.2, bowl: 0.3 });
      stemDish(kit, { cap: pink, stem, rim }, { x: 30, z: -120, h: 16, R: 9, r: 1.6, tilt: -0.1, bowl: 0.3 });
      const blue = [kit.mat({ color: '#8fa3c8' }), kit.mat({ color: '#a5b5d4' }), kit.mat({ color: '#7d93bd' })], dark = kit.mat({ color: '#3d4660', flat: true });
      const rng = kit.rng;
      for (let i = 0; i < 40; i++) {
        const x = -60 + rng() * 120, z = -42 - rng() * 50, r = 2 + rng() * 3.4, y = kit.base(x, z, r) - 0.2;
        kit.add(blue[i % 3], dome(r, 0.8 + rng() * 0.3).translate(x, y, z));
        if (rng() < 0.5) kit.add(dark, put(new THREE.BoxGeometry(r * 0.35, r * 0.5, 0.2), x, y + r * 0.25, z + r * 0.95), { solid: false });
      }
      const tower = kit.mat({ color: '#a5b0c6', weathered: 0.5 });
      for (const [x, z, h] of [[-44, -88, 22], [-38, -96, 16], [-52, -84, 12]]) kit.add(tower, new THREE.CylinderGeometry(0.8, 1, h, 8).translate(x, kit.H(x, z) + h / 2, z));
    },
  },
  {
    id: '3774-dune-bridge', title: 'The bridge over the dunes', sheet: 'IMG_3774', panel: 3, where: 'row 2, left', crop: [35, 356, 333, 281],
    camera: { eye: [0, 4, 0], yaw: 0, fov: 46, horizon: 0.45 },
    sun: { side: 15, el: 24 },
    sky: ['#a4c6dc', '#b6d2e0', '#b3875a', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a big dune slope in front falling away to the left, a sharp crest across the middle distance
        // the near slope falling to the left, a valley, then a steep slip face rising to a long crest
        const crest = 46 + 0.25 * x;
        return 4 * smoothstep(-30, 40, x) * (1 - smoothstep(8, 30, d)) + 7 * smoothstep(crest - 7, crest, d) + 2 * smoothstep(crest + 10, crest + 80, d) * n2(x * 0.01, z * 0.01) + far(x, z, 250, 6);
      },
      material: sand('#f6c172', '#f2b665', '#e6a457'),
    },
    people: [{ at: [26, -24], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const rope = kit.mat({ color: '#4c4440', flat: true }), plank = kit.mat({ color: '#6c5a4a', flat: true });
      bridge(kit, { rope, plank }, [-130, 30, -120], [130, 30, -140], { sag: 26, deckSag: 1, width: 2, hang: 0.5, towers: 30 });
    },
  },
  {
    id: '3774-dish-station', title: 'The dish station on its legs', sheet: 'IMG_3774', panel: 4, where: 'row 2, middle', crop: [382, 356, 304, 281],
    camera: { eye: [0, 2, 0], yaw: 0, fov: 44, horizon: 0.6 },
    sun: { side: 140, el: 34 },
    sky: ['#a5c9e0', '#b7d4e4', '#a58468', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.3,
    ground: { height: (x, z) => 0.4 * n2(x * 0.03, z * 0.03) + far(x, z, 200, 4), material: sand('#f5c47c', '#f1b970', '#e3a862') },
    people: [{ at: [-7, -30], facing: 0.2, palette: PERSON, head: 'hood' }],
    build(kit) {
      const blue = kit.mat({ color: '#9aa7c6', side: THREE.DoubleSide, metal: 'painted' }), pink = kit.mat({ color: '#f0b39a', side: THREE.DoubleSide, shade: 0.3, hatch: 0.3 });
      const leg = kit.mat({ color: '#c7a48e' }), rope = kit.mat({ color: '#4c4440', flat: true }), domeM = kit.mat({ color: '#8fa3c4' });
      const x = 4, z = -46, y = kit.H(x, z);
      kit.add(domeM, dome(4, 0.7).translate(x, y - 0.2, z));
      // two pink shallow dishes on drums either side, the blue dish rising behind them, its feed on a mast
      for (const [dx, az] of [[-6.5, -0.5], [6.5, 0.5]]) stemDish(kit, { cap: pink, stem: leg, rim: rope }, { x: x + dx, z: z + 1, h: 5, R: 7, r: 1.4, tilt: 0.35, az, bowl: 0.3 });
      radioDish(kit, blue, rope, x, y + 6, z - 3, 8, 0.9, 0.2);
      kit.add(rope, tube([V(x, y + 6, z - 3), V(x, y + 18, z - 1)], 0.15, 1, 4), { solid: false });
      kit.add(rope, new THREE.SphereGeometry(0.7, 10, 8).translate(x, y + 18.5, z - 1), { solid: false });
    },
  },
  {
    id: '3774-slot-canyon', title: 'The slot canyon under the bridge', sheet: 'IMG_3774', panel: 5, where: 'row 2, right', crop: [700, 356, 291, 281],
    camera: { eye: [0, 2.2, 0], yaw: 0, fov: 54, horizon: 0.45 },
    sun: { side: -12, el: 58 },
    sky: ['#a8cde2', '#bad6e4', '#93623e', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.25,
    ground: {
      height: (x, z) => 0.3 * n2(x * 0.05, z * 0.05) + 0.9 * smoothstep(4, 14, Math.abs(x - 2 - 0.08 * z)) + smoothstep(90, 160, -z) * 5,
      material: sand('#f4be72', '#f0b466', '#e2a258'),
    },
    people: [{ at: [0.5, -14], facing: 0.1, palette: PERSON, head: 'hood' }, { at: [3, -46], facing: 0, palette: PERSON, head: 'hood' }],
    build(kit) {
      const red = strataMat(kit, '#d47d4a', '#c56f40', '#e08d58', 6), shade = strataMat(kit, '#c27a52', '#b26c46', '#cf8a5e', 6);
      gorgeWall(kit, red, { side: -1, x0: -11, slope: 0.06, z0: 10, z1: -140, top: 44, tiers: [[0, 0.5, 0], [0.5, 0.8, 3], [0.8, 1, 6]], seed: 21, rag: 2 });
      gorgeWall(kit, shade, { side: 1, x0: 13, slope: 0.05, z0: 10, z1: -140, top: 40, tiers: [[0, 0.45, 0], [0.45, 0.8, 4], [0.8, 1, 8]], seed: 23, rag: 2.4 });
      const rope = kit.mat({ color: '#4c4440', flat: true }), plank = kit.mat({ color: '#6c5a4a', flat: true });
      bridge(kit, { rope, plank }, [-17, 34, -48], [21, 34, -54], { sag: 3, deckSag: 0.4, width: 2.4, hang: 4, towers: 0 });
      // the truss under the deck: a few diagonals
      for (let i = 0; i < 9; i++) kit.add(rope, tube([V(-15 + i * 4, 34, -48.5 - i * 0.7), V(-13 + i * 4, 29, -49 - i * 0.7)], 0.08, 1, 3), { solid: false });
    },
  },
  {
    id: '3774-violet-pool', title: 'The turquoise pool in the violet cliffs', sheet: 'IMG_3774', panel: 6, where: 'row 3, left', crop: [35, 657, 377, 280],
    camera: { eye: [0, 75, 30], yaw: 0, fov: 46, horizon: 0.06 },
    sun: { side: 160, el: 55 },
    sky: ['#b8c8e0', '#c6d3e6', '#8f86b0', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.2,
    ground: {
      height: (x, z) => {
        const d = -z;
        // the pool's bed with pale shallows, the cliff's foot rising round it
        const e = r2((x - 6) / 46, (d - 92) / 40);
        const bed = -1.8 + 1.9 * smoothstep(-0.2, 0.45, n2(x * 0.03, z * 0.03)) + 0.4 * n3(x * 0.08, z * 0.08);
        return e < 1 ? bed : bed + 6 * smoothstep(1, 1.25, e);
      },
      material: { color: '#c9b4dc', color2: '#c0a9d6', color3: '#b39ccb', pattern: 'cracks' },
    },
    people: [{ at: [26, -66], facing: 2.5, palette: PERSON, head: 'hood' }],
    build(kit) {
      kit.mesh(new THREE.PlaneGeometry(140, 120, 1, 1).rotateX(-Math.PI / 2).translate(6, 0, -92), kit.mat({ color: '#33c3d0', color2: '#8fe3e0', mode: MODE_WATER }), { solid: false, shadow: false });
      const cliff = strataMat(kit, '#b3a2d8', '#a897d0', '#c1b1e0', 6), cliffShade = strataMat(kit, '#8e7fbd', '#8576b5', '#9a8bc6', 6);
      // the cliffs round the pool: blocks of stepped table rock on the left, the far side and the right
      const block = (pts, h, m) => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); kit.add(m, new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -3, 0)); };
      block([[-90, -40], [-38, -48], [-34, -110], [-90, -120]], 38, cliff);
      block([[-60, -110], [40, -128], [44, -200], [-60, -200]], 46, cliff);
      block([[30, -60], [70, -54], [74, -140], [36, -130]], 54, cliffShade);
      block([[-28, -64], [-12, -66], [-14, -86], [-30, -84]], 16, cliff);
    },
  },
  {
    id: '3774-blue-heads', title: 'The buried blue heads', sheet: 'IMG_3774', panel: 7, where: 'row 3, right', crop: [426, 657, 565, 280],
    camera: { eye: [0, 3, 0], yaw: 0, fov: 40, horizon: 0.42 },
    sun: { side: -130, el: 38 },
    sky: ['#a9c9dd', '#bcd4e0', '#a78a62', '#ffffff', '#fff6dc'],
    look: INK_SHADOWS, fog: 0.25,
    ground: {
      height: (x, z) => {
        const d = -z;
        // a dune swelling to the right where the big head lies; rolling dunes far off
        return 5 * gauss(x, z, 18, -30, 14) + 2.5 * gauss(x, z, -14, -40, 10) + 1.8 * dunes(x, z, 1.6, 0.015, 2) * smoothstep(30, 80, d) + far(x, z, 250, 4);
      },
      material: sand('#f5c173', '#f1b667', '#e3a459'),
    },
    people: [{ at: [-16, -30], facing: 0.2, palette: PERSON, head: 'hood' }, { at: [-4, -36], facing: 0, palette: PERSON, head: 'hood' }, { at: [6, -22], facing: 0.4, palette: PERSON, head: 'hood' }],
    build(kit) {
      const shell = kit.mat({ color: '#93a8cf', metal: 'painted' }), dark = kit.mat({ color: '#2c3044', flat: true }), trim = kit.mat({ color: '#6c7fa8', flat: true, metal: 'painted' });
      machineHead(kit, { shell, dark, trim }, { x: 16, z: -34, r: 9, yaw: 2.4, sink: 0.35, tilt: 0.4 });
      machineHead(kit, { shell, dark, trim }, { x: -14, z: -42, r: 3.6, yaw: 2.8, sink: 0.45 });
      // far shapes on the horizon: low blocks of other buried things
      const far = kit.mat({ color: '#b4b8c6', flat: true });
      for (let i = 0; i < 7; i++) { const x = -80 + i * 28, z = -260 - (i % 3) * 30; kit.add(far, new THREE.BoxGeometry(8, 3 + (i % 2) * 2, 6).translate(x, kit.H(x, z) + 1, z)); }
    },
  },
];

/** The world's sheets and views, in order (the registry, reference-worlds.js, loads them by these names). */
export const SHEETS = { IMG_3775: sheet('IMG_3775'), ...DESERT_SHEETS };
export const VIEWS = [...IMG_3775_VIEWS, ...DESERT_VIEWS];
