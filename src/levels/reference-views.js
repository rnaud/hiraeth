import * as THREE from 'three';
import { MODE_STRATA, MODE_WATER, MODE_TERRAIN } from '../materials.js';
import { createNoise2D } from '../noise.js';
import {
  TAU, V, tube, lathe, sagPts, n2, n3, ridged, gauss, r2, smoothstep, put, dome, PERSON, CLEAN_SKY,
  sailGeo, groundRibbon, radioDish, groundPatch,
} from './reference-kit.js';
import { DESERT_SHEETS, DESERT_VIEWS } from './reference-desert.js';
import { SHAFT_SHEETS, SHAFT_VIEWS } from './reference-shaft.js';
import { VAEL2_SHEETS, VAEL2_VIEWS } from './reference-vael2.js';

// ---------------------------------------------------------------------------
// The references' views (src/levels/references.js): one per panel of a reference
// sheet, rebuilt with the game's own materials. Each is authored in its own
// frame, its camera looking down -z (yaw turns it to the right), ground near
// y = 0.
//
//   sheet, panel, where, crop   the panel on its sheet (crop: x, y, w, h in the
//                               sheet's pixels, inside its inked border)
//   camera   { eye, yaw, fov (vertical, deg), horizon (where eye level crosses
//            the frame: 0 top, 1 bottom) }
//   sun      { side (deg right of the line of sight; negative: left; 180:
//            behind), el (deg) }: the level picks the hour and turns the view
//   sky      [sky top, sky horizon, shadow tint, light tint, sun] (the colour
//            script's five colours, the same at every hour)
//   preset, look   the ink preset and the view's own touches on it (post.js
//            PRESETS uniforms); fog: the haze multiplier
//   ground   { height(x, z), material (makeMaterial, terrain mode), rings }
//   people   [{ at: [x, z], facing (rad), palette, head }] (local; content.js)
//   build(kit, view)   what stands on the ground (lab-kit.js RoomKit)
//
// Colours were read off the sheet (lit and shaded patches of each surface); the
// shadow tints are the shaded colour over the lit one of the panel's main surface.
// ---------------------------------------------------------------------------

/** The reference sheets: the image (bundled by Vite, a file URL under node), its size, a name. */
export const REFERENCE_SHEETS = {
  IMG_3775: {
    name: 'The Desert / IMG_3775.JPG', size: [1024, 1024],
    url: new URL('../../references/The Desert/environement/IMG_3775.JPG', import.meta.url).href,
  },
  // the other desert environment sheets (reference-desert.js)
  ...DESERT_SHEETS,
  // the City-Shaft's (reference-shaft.js)
  ...SHAFT_SHEETS,
  // Vael II's, the Sky Stones (reference-vael2.js)
  ...VAEL2_SHEETS,
};

// ===========================================================================
export const REFERENCE_VIEWS = [
  // ========================================================= 1. bones in the dunes
  {
    id: 'bones', title: 'Bones in the dunes', sheet: 'IMG_3775', panel: 1, where: 'top left', crop: [42, 44, 463, 294],
    camera: { eye: [0, 8.7, 0], yaw: 0, fov: 38, horizon: 0.37 },
    sun: { side: -115, el: 36 },
    sky: ['#9db5cb', '#a6bccd', '#9a8f86', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY,
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
    look: CLEAN_SKY,
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
    sun: { side: 0, el: 48 },
    sky: ['#a5bdcf', '#b3cad3', '#a29b8e', '#ffffff', '#fff6dc'],
    look: CLEAN_SKY,
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
    look: CLEAN_SKY,
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
    look: CLEAN_SKY,
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
    look: CLEAN_SKY,
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
  // the other desert environment sheets, in order: IMG_3772, IMG_3773, IMG_3774 (reference-desert.js)
  ...DESERT_VIEWS,
  // the City-Shaft's sheets, IMG_3778 … IMG_3782 (reference-shaft.js)
  ...SHAFT_VIEWS,
  // Vael II's sheets, IMG_3783 … IMG_3788 (reference-vael2.js)
  ...VAEL2_VIEWS,
];
