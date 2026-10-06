import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MODE_TERRAIN, MODE_STRATA, MODE_WATER } from '../materials.js';
import { createNoise2D, fbm, smoothstep, lerp } from '../noise.js';
import { jitter, soften, duneRelief, desertMesa, desertMushroom, desertArch, desertRibcage } from '../world.js';
import { BIOMES } from '../biome.js';
import { PASTELS, RUST, ROOFS, STEEL, sectorGeometry } from './incal.js';
import { BONE } from './arzach.js';
import { table, needle, boulder } from './sky-stones-kit.js';
import { bridge } from './arzach2.js';
import { PALETTE as HANGAR, hangarHouse, hangarTower, hangarMachine } from './garage.js';
import { cylBetween, elbow } from './buried.js';
import { padForm } from '../form.js';
import { edenaTree, edenaPyramid, edenaRuins, LEAVES } from './edena.js';
import { CRESCENT, paintFaces } from './spheres.js';
import { CRYSTAL, jawShell } from './perdide.js';
import { shroomParts, lathe } from './perdide2.js';
import { put } from './lab-kit.js';

// ---------------------------------------------------------------------------
// The Lab's biome rooms: one compact sample of every world (~190 m across),
// each with that world's ground, sky, light and ink, its rock formations and
// landmarks, a few of its buildings, its plants (flora.js), its creatures
// (wildlife.js) and a few of its people in their costumes (costumes.js).
// src/levels/lab.js lays them out far apart and links them to the hub by doors.
//
// A room is authored in its own frame: centre at the origin, ground near y = 0,
// you arrive at `arrive` (by default [0, 74], facing -z) with the door home
// behind you. Where a world's own builders stand alone they are called here
// (the desert's mesas and skeletons, the Hangar's building kit, Viridel's
// umbrella trees and ruins, the Sky Stones' tables and needles, the Deep
// Wood's mushrooms, Lorn's jaws); the rest is a faithful sketch in the world's
// colours (src/levels/<world>.js has the full thing).
//
//   ground   { height(x, z), material } a heightfield (300 m), or null: the room
//            stands on its own meshes (the Hangar's plateau, the Sky Stones' tables)
//   floor    the arrival height when there is no ground
//   sky      the world's colour script and planets; atmo: { tint, fog }
//   hour     the world's default hour; look: its touches on the ink preset
//   flora    { patches, sparse, water, band } (flora.js, over the room's disc)
//   people   [{ at: [x, z], lines, head }] (local; dressed for the world)
//   killY    falling below this (local) puts you back at the door
//   build(kit, room)  everything else (src/levels/lab-kit.js)
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const nA = createNoise2D(4101), nB = createNoise2D(4102), nC = createNoise2D(4103);
const r2 = (x, z) => Math.hypot(x, z);
/** The room's edge: ground rising into banks from r0 to r1, `h` high. */
const rimUp = (x, z, h = 40, r0 = 104, r1 = 150) => Math.pow(smoothstep(r0, r1, r2(x, z) + nA(x * 0.02, z * 0.02) * 8), 1.4) * h;
/** Level ground along the arrival path (x ~ 0, z 52..95). */
const calmPath = (x, z) => smoothstep(10, 22, Math.abs(x)) + smoothstep(52, 40, z);
const nonIndexed = (g) => (g.index ? g.toNonIndexed() : g);
const strata = (c1, c2, c3, size, extra = {}) => ({ color: c1, color2: c2, color3: c3, mode: MODE_STRATA, strataSize: size, ...extra });

// ---------------------------------------------------------------------------
export const ROOMS = [
  // ===================================================================== The Desert
  {
    id: 'desert', title: 'The Desert',
    ground: {
      height: (x, z) => {
        const dunes = (duneRelief(x + 700, z + 500) - 10) * 0.9 * Math.min(1, calmPath(x, z));
        const lagoon = -3.2 * smoothstep(20, 9, r2(x + 42, z - 22));
        return dunes + lagoon + rimUp(x, z, 34);
      },
      material: { color: '#efd29b', color2: '#f5e1b6', color3: '#dca57a', mode: MODE_TERRAIN, ripples: true, sandInk: true },
    },
    sky: {
      script: {
        day: ['#92b6c5', '#d7dfd9', '#93a6cf', '#fff9ee', '#fff6dc'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
      planets: [{ az: 300, el: 24, size: 3.5, color: '#ece4d2' }],
    },
    atmo: { tint: BIOMES.dunes.horizon, fog: BIOMES.dunes.fog }, hour: 9.5,
    flora: { patches: 34, sparse: 0.08 },
    people: [
      { at: [-18, 40], lines: ['~happy~ The dunes walk at night. By morning the camp is somewhere else.', '~neutral~ Under that arch the wind sings. Listen.'] },
      { at: [24, 12], lines: ['~solemn~ The bones were here before the sand.', '~curious~ Did you come over the mesas? Nobody comes over the mesas.'] },
    ],
    build(kit) {
      const g = kit.group, terrain = kit.ground;
      const rk = { rng: kit.rng, terrain, add: (m) => g.add(m) };
      // the desert's own rock shapes (world.js): mesas closing the horizon, an arch, mushroom rocks
      desertMesa(rk, -98, -58, 26, 64);
      desertMesa(rk, 84, -92, 22, 50);
      desertMesa(rk, 112, 28, 18, 42);
      desertMesa(rk, -116, 52, 20, 56);
      desertMesa(rk, 10, -122, 24, 70);
      desertArch(rk, 6, -66, 16, 3.2);
      desertMushroom(rk, -52, -22, 0.55);
      desertMushroom(rk, 60, 6, 0.45);
      desertMushroom(rk, -70, 20, 0.4);
      // a giant's skeleton half in the sand
      desertRibcage({ ...rk, bone: kit.mat({ color: '#f2ead6' }) }, 44, -40, 0.34, 0.6);
      // a ring of glyph stones round a floating orb
      const stones = [kit.mat({ color: '#f3ead8', flat: true, grid: 2.5, glyphs: true }), kit.mat({ color: '#58b4a8', flat: true, grid: 2.5, glyphs: true }), kit.mat({ color: '#e57f5b', flat: true, grid: 2.5, glyphs: true })];
      const MX = -38, MZ = 52, MR = 9;
      for (let i = 0; i < 9; i++) {
        if (kit.rng() < 0.15) continue;
        const a = (i / 9) * TAU, px = MX + Math.cos(a) * MR, pz = MZ + Math.sin(a) * MR, h = kit.R(7, 13);
        const s = new THREE.BoxGeometry(kit.R(2, 3), h, kit.R(1.2, 1.8)).translate(0, h / 2, 0);
        kit.add(stones[kit.rng() < 0.75 ? 0 : 1 + Math.floor(kit.rng() * 2)], put(s, px, kit.base(px, pz, 2) - 1, pz, -a + Math.PI / 2, 1, kit.R(-0.12, 0.12), kit.R(-0.12, 0.12)));
      }
      const orb = kit.mesh(new THREE.IcosahedronGeometry(2.2, 1), kit.mat({ color: '#58b4a8', flat: true, glow: 0.5 }), { solid: false });
      const oy = kit.H(MX, MZ) + 6;
      orb.position.set(MX, oy, MZ);
      kit.light(MX, oy, MZ, 18);
      kit.mover((t) => { orb.position.y = oy + Math.sin(t * 0.8) * 0.8; orb.rotation.y = t * 0.3; });
      // a floating island with a tower, bobbing high over the dunes
      {
        const isl = new THREE.ConeGeometry(9, 16, 9, 4).rotateX(Math.PI).translate(0, -8, 0);
        jitter(isl, 0.22, 0.05, 7);
        const tw = new THREE.CylinderGeometry(1.1, 1.6, 12, 6).translate(1, 6, -1);
        const p = ['#bea6cf', '#9c86b7', '#dccbe0'];
        const m = kit.mesh(mergeGeometries([isl, tw].map(nonIndexed)), kit.mat(strata(p[0], p[1], p[2], 2.5, { flat: true })), { solid: false });
        const y0 = 46;
        m.position.set(-24, y0, -88);
        kit.mover((t) => { m.position.y = y0 + Math.sin(t * 0.3) * 2.5; m.rotation.y = t * 0.01; });
      }
      // a pilgrims' camp: domed tents in white, teal and orange
      const tents = ['#f6efe0', '#f6efe0', '#5fb7ad', '#e6875f'].map((c) => kit.mat({ color: c, grid: 4 }));
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1 + 0.4, d = kit.R(4, 12), x = 52 + Math.cos(a) * d, z = 46 + Math.sin(a) * d, r = kit.R(2.6, 4.6);
        kit.add(kit.pick(tents), put(new THREE.SphereGeometry(r, 16, 8, 0, TAU, 0, Math.PI / 2), x, kit.base(x, z, r) - 0.3, z, 0, [1, kit.R(0.7, 1.1), 1]));
      }
      // the lagoon
      const water = kit.mesh(new THREE.CircleGeometry(16, 40).rotateX(-Math.PI / 2), kit.mat({ color: '#69d3c6', color2: '#a3e4d5', mode: MODE_WATER, flat: true }), { solid: false, shadow: false });
      water.position.set(-42, -1.5, 22);
    },
  },

  // ===================================================================== The City-Shaft
  {
    id: 'incal', title: 'The City-Shaft',
    ground: {
      // the rim plain round the shaft (r 42), hills beyond; the shaft drops 62 m to the acid lake
      height: (x, z) => {
        const r = r2(x, z);
        if (r < 42.5) return -62;
        return nA(x * 0.03, z * 0.03) * 0.3;
      },
      material: { color: '#e9dcc2', grid: 3 },
    },
    sky: {
      script: {
        day: ['#8fb4da', '#eef0ea', '#93a6cf', '#fffaf0', '#fff6dc'],
        dusk: ['#8a8fc8', '#f4a8a0', '#8a6fb8', '#ffd2c0', '#ffe2b8'],
        night: ['#1d2250', '#4a4a8a', '#3d3a80', '#9a9ad0', '#f2f0e6'],
      },
      planets: [{ az: 210, el: 16, size: 9, color: '#e8b9c4', ring: 0.25 }],
    },
    atmo: { tint: [1, 0.95, 0.94], fog: 1.7 }, hour: 12.5,
    flora: { patches: 26, sparse: 0.06, r0: 50 },
    avoid: (x, z, r) => r2(x, z) < 47 + r,
    people: [
      { at: [-30, 56], lines: ['~neutral~ Six hundred metres down to the lake, they say. The shaft here is only a model of it.', '~playful~ Mind the edge. The jetpack forgives, the acid does not.'] },
      { at: [40, 38], lines: ['~curious~ The terraces were built from the top down. Nobody remembers why.', '~happy~ The taxis never stop. You just have to wave.'] },
    ],
    build(kit) {
      const R = 42;
      // the shaft's wall (seen from inside) and the acid lake at the bottom
      kit.add(kit.mat({ color: '#e6d6b8', color2: '#d9c7a6', color3: '#b3c3d3', mode: MODE_STRATA, strataSize: 9, grid: 4, side: THREE.BackSide }),
        new THREE.CylinderGeometry(R, R, 63, 64, 1, true).translate(0, -31, 0));
      kit.add(kit.mat({ color: '#b8d65a', glow: 0.35 }), new THREE.CircleGeometry(R, 48).rotateX(-Math.PI / 2).translate(0, -59.5, 0), { solid: false, shadow: false });
      kit.light(0, -54, 0, 40);
      // the parapet round the rim
      kit.add(kit.mat({ color: '#e6d6b8', flat: true, grid: 2 }), new THREE.TorusGeometry(R + 0.3, 0.45, 5, 72).rotateX(Math.PI / 2).translate(0, 0.45, 0));
      // terraces stacked down the shaft, villas on them
      const wall = (i, pal) => kit.mat(strata(pal[i], pal[(i + 2) % pal.length], '#f6efe0', 3.2, { pattern: 'facade', flat: true }));
      const roof = (i) => kit.mat({ color: ROOFS[i], flat: true, pattern: 'tiles' });
      const steel = kit.mat(strata(STEEL.color, STEEL.color2, STEEL.color3, 1.4, { flat: true, grid: 3 }));
      const villa = (x, y, z, rot, pal, s = 1) => {
        const w = kit.R(4, 8) * s, d = kit.R(4, 8) * s, h = kit.R(4, 9) * s, wi = Math.floor(kit.rng() * pal.length), ri = Math.floor(kit.rng() * 4);
        kit.add(wall(wi, pal), put(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, rot));
        if (kit.rng() < 0.6) {
          const rf = new THREE.ConeGeometry(Math.hypot(w, d) * 0.56, kit.R(1.8, 3.4), 4, 1).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d));
          kit.add(roof(ri), put(rf.translate(0, h + 1.1, 0), x, y, z, rot));
        } else {
          const r = Math.min(w, d) * 0.36;
          kit.add(wall(wi, pal), put(new THREE.CylinderGeometry(r, r, 1.6, 12).translate(0, h + 0.8, 0), x, y, z, rot));
          kit.add(roof(ri), put(new THREE.SphereGeometry(r * 1.05, 14, 8, 0, TAU, 0, Math.PI / 2).translate(0, h + 1.6, 0), x, y, z, rot));
        }
        kit.add(kit.mat({ color: '#5a3a2c', flat: true }), put(new THREE.BoxGeometry(1.2, 2, 0.2).translate(0, 1, d / 2), x, y, z, rot));
      };
      [-14, -29, -45].forEach((y, li) => {
        let a = kit.R(0, TAU);
        for (let s = 0; s < 3; s++) {
          const span = kit.R(1.2, 1.7);
          kit.add(steel, sectorGeometry(R - 15, R, a, a + span, 1.4).translate(0, y, 0));
          for (let k = 0; k < 3; k++) {
            const aa = a + (k + 0.5) * span / 3, rr = R - kit.R(6, 9);
            villa(Math.cos(aa) * rr, y, Math.sin(aa) * rr, -aa + Math.PI / 2, li ? RUST : PASTELS, 0.8);
          }
          a += span + kit.R(0.4, 0.7);
        }
      });
      // a footbridge across the shaft at the rim
      kit.add(steel, new THREE.BoxGeometry(3.2, 0.6, 2 * R + 4).translate(0, -0.3, 0).rotateY(0.9));
      for (const s of [-1, 1]) kit.add(kit.mat({ color: '#34405e', flat: true }), new THREE.BoxGeometry(0.15, 1, 2 * R + 4).translate(s * 1.5, 0.5, 0).rotateY(0.9), { solid: false });
      // the town closing the rim all round: tall houses stacked two and three high
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * TAU + kit.R(-0.04, 0.04), rr = kit.R(108, 128), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        let y = kit.H(x, z) - 0.2;
        for (let k = 0, n = 2 + Math.floor(kit.rng() * 3); k < n; k++) {
          const w = kit.R(9, 16), d = kit.R(8, 13), h = kit.R(6, 10), wi = Math.floor(kit.rng() * PASTELS.length), rot = -a + kit.R(-0.2, 0.2);
          kit.add(wall(wi, PASTELS), put(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, rot));
          y += h;
          if (k === n - 1) kit.add(roof(Math.floor(kit.rng() * 4)), put(new THREE.ConeGeometry(Math.hypot(w, d) * 0.56, kit.R(2.5, 4), 4, 1).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d)).translate(0, 1.4, 0), x, y, z, rot));
        }
      }
      // the hill-town on the rim: villas, a tower with a bulb, a landing pad, cypresses
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + kit.R(-0.1, 0.1), rr = kit.R(56, 92), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        if (Math.abs(x) < 16 && z > 40) continue;   // the way in
        villa(x, kit.H(x, z) - 0.2, z, kit.R(0, TAU), PASTELS);
      }
      {
        const x = -62, z = -50, b = kit.H(x, z) - 0.5, parts = [];
        let y = 0, r = 4.5;
        for (let t = 0; t < 3; t++) {
          const th = kit.R(9, 13);
          parts.push(soften(new THREE.CylinderGeometry(r * 0.9, r, th, 8, 4), 0.07).translate(0, y + th / 2, 0));
          y += th;
          parts.push(new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.8, 8).translate(0, y - th * 0.35, 0));
          r *= 0.72;
        }
        parts.push(new THREE.SphereGeometry(r * 1.6, 12, 8).scale(1, 0.75, 1).translate(0, y + r * 0.9, 0), new THREE.CylinderGeometry(0.3, 0.3, r * 4, 4).translate(0, y + r * 2.5, 0));
        kit.add(kit.mat(strata(PASTELS[0], PASTELS[3], PASTELS[5], 3, { grid: 3, flat: true })), put(mergeGeometries(parts.map(nonIndexed)), x, b, z));
      }
      {
        const x = 64, z = -34, b = kit.H(x, z);
        kit.add(steel, new THREE.CylinderGeometry(9, 9, 1, 24).translate(x, b + 0.5, z));
        kit.add(kit.mat({ color: '#f2c54b', flat: true }), new THREE.TorusGeometry(7, 0.25, 4, 32).rotateX(Math.PI / 2).translate(x, b + 1.05, z), { solid: false });
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU;
          kit.add(kit.mat({ color: '#ffd98a', glow: 1 }), new THREE.SphereGeometry(0.35, 8, 6).translate(x + Math.cos(a) * 8.4, b + 1.2, z + Math.sin(a) * 8.4), { solid: false, shadow: false });
        }
        kit.light(x, b + 2, z, 14);
      }
      const leaves = kit.mat({ color: '#4f6b3a', scrub: true, pattern: 'leaves' });
      for (let i = 0; i < 14; i++) {
        const a = kit.R(0, TAU), rr = kit.R(48, 95), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        if (Math.abs(x) < 14 && z > 40) continue;
        const h = kit.R(6, 11);
        kit.add(leaves, new THREE.LatheGeometry([[0.01, 0], [0.7, 0.5], [1.1, 2.2], [1.15, 4.4], [0.8, 7.3], [0.35, 9.5], [0.01, 10.6]].map(([r, y]) => new THREE.Vector2(r, y)), 8).scale(h / 10.6, h / 10.6, h / 10.6).translate(x, kit.H(x, z) - 0.2, z));
      }
    },
  },

  // ===================================================================== Vael
  {
    id: 'arzach', title: 'Vael',
    ground: {
      height: (x, z) => fbm(nB, x * 0.012, z * 0.012, 3) * 3 * Math.min(1, calmPath(x, z)) + rimUp(x, z, 24, 112, 160),
      material: { color: '#f0dcc0', color2: '#f7ead4', color3: '#e3bf9c', mode: MODE_TERRAIN, ripples: true },
    },
    sky: {
      script: {
        day: ['#7cc1c4', '#f4d4b6', '#b98f9a', '#fff4e6', '#fff0d8'],
        dusk: ['#c9b9a4', '#f2cfa8', '#b0705a', '#ffe0c0', '#fff0d6'],
        night: ['#2a2a38', '#4c4a58', '#3c3448', '#a8a4b8', '#f2f0e6'],
      },
      planets: [{ az: 140, el: 32, size: 6, color: '#efe6d2' }, { az: 120, el: 22, size: 2.4, color: '#d8c7a6' }],
    },
    atmo: { tint: [1.02, 0.99, 0.94], fog: 0.75 }, hour: 15.5,
    flora: { patches: 30, sparse: 0.08 },
    people: [
      { at: [-14, 30], lines: ['~whisper~ …', '~solemn~ Here we do not say much. The needles listen.'] },
      { at: [30, -10], lines: ['~whisper~ The tower has one window. Someone is always in it.', '~neutral~ The ruins float because nobody told them to come down.'] },
    ],
    build(kit) {
      const bone = (size) => { const p = kit.pick(BONE); return kit.mat(strata(p[0], p[1], p[2], +size.toFixed(1), { flat: true })); };
      // needle spires round the plain (Vael's own recipe, smaller)
      const spires = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + kit.R(-0.2, 0.2), d = kit.R(62, 118), x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (Math.abs(x) < 20 && z > 40) continue;
        const r = kit.R(4, 9), h = kit.R(36, 60) + kit.rng() * kit.rng() * 80;
        const g = new THREE.CylinderGeometry(r * kit.R(0.15, 0.4), r, h, 9, 12).translate(0, h / 2, 0);
        jitter(g, 0.22, 0.03, kit.R(0, 100));
        const parts = [g];
        if (kit.rng() < 0.4) { const cr = r * kit.R(0.6, 1.2); parts.push(new THREE.CylinderGeometry(cr, cr * 0.7, 2, 10).translate(0, h, 0)); }
        kit.add(bone(kit.R(3, 9)), put(mergeGeometries(parts.map(nonIndexed)), x, kit.base(x, z, r) - 2, z, kit.R(0, 6), 1, kit.R(-0.05, 0.05), kit.R(-0.05, 0.05)));
        spires.push({ x, z, top: h * 0.7 });
      }
      // a stone arch slung between two of them
      {
        const [a, b] = [spires[1], spires[2]];
        const y = Math.min(a.top, b.top) * 0.7, p0 = new THREE.Vector3(a.x, y, a.z), p1 = new THREE.Vector3(b.x, y, b.z);
        const mid = p0.clone().lerp(p1, 0.5); mid.y += p0.distanceTo(p1) * 0.25;
        kit.add(bone(2.5), new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 24, 2.4, 6));
      }
      // a floating ruin: an upturned cone with a broken colonnade
      {
        const r = 12, parts = [jitter(new THREE.ConeGeometry(r, r * 1.9, 9, 4).rotateX(Math.PI).translate(0, -r * 0.9, 0), 0.25, 0.05, 11)];
        for (let c = 0; c < 6; c++) { if (c === 2) continue; const a = (c / 6) * TAU; parts.push(new THREE.CylinderGeometry(0.8, 1, 7, 8).translate(Math.cos(a) * r * 0.6, 3.5, Math.sin(a) * r * 0.6)); }
        parts.push(new THREE.BoxGeometry(r * 1.2, 1.4, 2.4).translate(0, 7.5, r * 0.6));
        kit.add(bone(2.5), put(mergeGeometries(parts.map(nonIndexed)), 34, 44, -56, 0.7));
      }
      // the lone tower, one dark window
      {
        const x = -64, z = -66, b = kit.base(x, z, 7), H = 74;
        const shaft = jitter(new THREE.CylinderGeometry(3, 6.5, H, 12, 16).translate(0, H / 2, 0), 0.06, 0.05, 3);
        const room = new THREE.SphereGeometry(7.5, 16, 12).scale(1, 0.75, 1).translate(0, H + 4, 0);
        const balcony = new THREE.CylinderGeometry(9.5, 9.5, 0.9, 24).translate(0, H - 1.5, 0);
        const spike = new THREE.ConeGeometry(1, 14, 6).translate(0, H + 16, 0);
        kit.add(kit.mat(strata('#f6f0e2', '#e9d9bd', '#d8a24a', 12, { flat: true })), put(mergeGeometries([shaft, room, balcony, spike].map(nonIndexed)), x, b - 2, z));
        kit.add(kit.mat({ color: '#34405e', flat: true }), new THREE.BoxGeometry(2.4, 3.4, 0.6).translate(x, b + H + 1.5, z + 7.2));
      }
      // menhirs and a balanced boulder
      for (let i = 0; i < 5; i++) {
        const x = -40 + i * 9 + kit.R(-2, 2), z = -20 + kit.R(-3, 3), h = kit.R(5, 11);
        kit.add(bone(2), put(jitter(new THREE.CylinderGeometry(0.9, 1.6, h, 6, 4).translate(0, h / 2, 0), 0.2, 0.1, i), x, kit.H(x, z) - 0.5, z, kit.R(0, 6), 1, kit.R(-0.1, 0.1)));
      }
      {
        const x = 58, z = 30, b = kit.H(x, z), h = 16;
        kit.add(bone(3), new THREE.CylinderGeometry(0.8, 2.2, h, 8).translate(x, b + h / 2 - 0.5, z));
        kit.add(bone(4), put(jitter(new THREE.SphereGeometry(5, 14, 10).scale(1.2, 0.9, 1), 0.12, 0.2, 5), x + 0.6, b + h + 3.6, z));
      }
    },
  },

  // ===================================================================== Vael II (the Sky Stones)
  {
    id: 'arzach2', title: 'Vael II',
    // the stones stand on their own; far below, the peach plain under a sea of cloud
    ground: { height: (x, z) => -110 + fbm(nB, x * 0.006, z * 0.006, 2) * 8, material: { color: '#eda584', color2: '#f2b48f', color3: '#c98f86', mode: MODE_TERRAIN, ripples: true } },
    stands: true, floor: 0.4, arrive: [0, 60], killY: -42,
    sky: {
      script: {
        day: ['#a3d0d2', '#f4cdb0', '#93abcc', '#fff7ec', '#fff2dc'],
        dusk: ['#f2ae8c', '#f6c4a0', '#8f88b8', '#ffd9bc', '#ffe2c0'],
        night: ['#262a3c', '#4a4a5e', '#383650', '#a8a8c0', '#f2f0e6'],
      },
      planets: [{ az: 200, el: 26, size: 6.5, color: '#f3ead8', craters: false }, { az: 222, el: 18, size: 2.2, color: '#e9c8b4', craters: false }],
    },
    atmo: { tint: [1.02, 0.99, 0.96], fog: 0.65 }, hour: 9,
    flora: { patches: 26, sparse: 0.06, band: [-8, 14] },
    people: [
      { at: [-16, 34], y: 1.5, lines: ['~solemn~ The stones fell up, long ago. Some of them never came down.', '~neutral~ Do not look down for long. The cloud looks back.'] },
      { at: [-50, -40], y: 9.5, lines: ['~sad~ The bell has not rung since the cloud rose.', '~curious~ You crossed the aqueduct? It holds. It always holds.'] },
    ],
    build(kit) {
      const DS = THREE.DoubleSide;
      const M = {
        bone: kit.mat(strata('#f3ead8', '#f0e4cf', '#f5ede0', 7, { flat: true, side: DS })),
        cap: kit.mat(strata('#f5e5d1', '#f3e0cb', '#f6e9d8', 5, { side: DS })),
        rose: kit.mat(strata('#d9a59a', '#c98f86', '#e3b5a8', 9, { flat: true, side: DS })),
        aq: kit.mat(strata('#ece3d3', '#e0d5c4', '#f2ebde', 2.6, { flat: true, side: DS })),
        hidden: kit.mat({ color: '#ffffff' }),
      };
      // the Sky Stones' own geometry (arzach2.js): drawn meshes walk-through, a coarse twin collides
      const solidOf = (vis, col, mat) => {
        kit.add(mat, vis, { solid: false });
        const c = kit.mesh(mergeable(col), M.hidden);
        c.visible = false;
      };
      const mergeable = (g) => { g.computeVertexNormals(); return g; };
      const T = (o, mat = M.bone) => { const t = table(o); solidOf(t.vis, t.col, mat); return t; };
      T({ x: 0, z: 18, R: 68, stalk: 30, top: 0, dome: 1.2, seed: 1, rib: 2.5, outline: 0.1 }, M.cap);
      T({ x: -58, z: -52, R: 22, stalk: 9, top: 8, dome: 0.8, seed: 2, rib: 1.5 }, M.bone);
      T({ x: 70, z: -58, R: 18, stalk: 7, top: -4, dome: 0.6, seed: 3, ledges: 0.04 }, M.rose);
      T({ x: 92, z: 30, R: 10, stalk: 4, top: 14, dome: 0.4, seed: 4 }, M.bone);
      // the aqueduct to the monastery stone
      {
        const b = bridge({ a: [-30, -18], b: [-48, -40], y0: 0.6, y1: 8.4, W: 6, bays: 3, bottom: -120, seed: 5, rough: 0.3 });
        kit.add(M.aq, mergeable(b.g));
      }
      // needles rising from the cloud
      for (const [x, z, H, R, s] of [[-96, 18, 120, 6, 1], [104, -18, 140, 7, 2], [-30, -102, 150, 8, 3], [40, -96, 110, 5, 4], [-86, -70, 96, 4, 5]]) {
        const n = needle({ x, y: -100, z, H, R, seed: s });
        solidOf(n.vis, n.col, M.bone);
      }
      // balanced stones, stacked on the big table
      {
        let y = 1.1;   // (the big table's top)
        for (const [r, egg, sx] of [[3.2, 0.1, 1.1], [2.4, 0.25, 1], [1.7, 0.3, 0.9], [1.1, 0.4, 0.8]]) {
          const g = boulder(r, sx, 0.8, sx, egg, r * 7);
          kit.add(M.bone, mergeable(g.translate(24, y + r * 0.75, -12)));
          y += r * 1.45;
        }
      }
      // the monastery on its stone: a house, a gable roof, a belltower with its bell
      {
        const x = -60, z = -54, y = 8.8;
        kit.add(M.aq, new THREE.BoxGeometry(9, 5, 7).translate(x, y + 2.5, z));
        kit.add(M.rose, new THREE.CylinderGeometry(0, 6.4, 3, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.8).translate(x, y + 6.5, z));
        kit.add(M.aq, new THREE.BoxGeometry(3.2, 12, 3.2).translate(x + 7, y + 6, z + 2));
        kit.add(M.rose, new THREE.ConeGeometry(2.6, 3, 4).rotateY(Math.PI / 4).translate(x + 7, y + 13.5, z + 2));
        kit.add(kit.mat({ color: '#d8a24a', flat: true, metal: 'brass' }), new THREE.CylinderGeometry(0.3, 0.9, 1.2, 10).translate(x + 7, y + 10.2, z + 2), { solid: false });
        kit.add(kit.mat({ color: '#34405e', flat: true }), new THREE.BoxGeometry(1.2, 2, 0.2).translate(x, y + 1, z + 3.55), { solid: false });
      }
      // the sea of cloud below the stones
      {
        const puffs = 260, g = new THREE.IcosahedronGeometry(1, 1);
        const mesh = new THREE.InstancedMesh(g, kit.mat({ color: '#ffffff', color2: '#e3e8ee' }), puffs);
        const d = new THREE.Object3D();
        for (let i = 0; i < puffs; i++) {
          const a = kit.R(0, TAU), r = Math.sqrt(kit.rng()) * 175;
          d.position.set(Math.cos(a) * r, kit.R(-38, -30), Math.sin(a) * r);
          const s = kit.R(5, 12);
          d.scale.set(s * kit.R(1.2, 1.8), s * 0.55, s * kit.R(1, 1.4));
          d.rotation.y = kit.R(0, TAU);
          d.updateMatrix();
          mesh.setMatrixAt(i, d.matrix);
        }
        mesh.userData.noCollide = true;
        kit.group.add(mesh);
        kit.noShadow.push(mesh);
      }
    },
  },

  // ===================================================================== The Sealed Hangar (Brask's plateau)
  {
    id: 'garage', title: 'The Sealed Hangar',
    ground: null, floor: 0.5, killY: -40,
    sky: {
      script: {
        day: ['#6aaed0', '#efe2c6', '#93a6cf', '#fffaf0', '#fff6dc'],
        dusk: ['#7f8fc8', '#f2c49a', '#8a7fb8', '#ffe0c0', '#ffe2b8'],
        night: ['#1d2a52', '#4a5a8a', '#3d4380', '#8e9ccc', '#f2f0e6'],
      },
      planets: [{ az: 40, el: 30, size: 7, color: '#62c3c9', ring: 0.4 }],
    },
    atmo: { tint: [1, 1, 1], fog: 0.9 }, hour: 10.5,
    flora: { patches: 24, sparse: 0.06, band: [-3, 3] },
    people: [
      { at: [-20, 40], y: 0, lines: ['~happy~ The Major built all this from the inside of a garage. Do not ask how.', '~playful~ Up there? That is the upside-down quarter. Do not fall up.'] },
      { at: [36, -6], y: 0, lines: ['~curious~ The gears turn whether anyone watches or not.', '~neutral~ Tighten nothing. Everything here is exactly as loose as it should be.'] },
    ],
    build(kit) {
      const stone = (size = 3) => kit.mat(strata(kit.pick(HANGAR), kit.pick(HANGAR), '#f3ead8', Math.round(size), { flat: true }));
      // the floating plateau (garage.js zone A, smaller)
      {
        const g = jitter(new THREE.CylinderGeometry(106, 60, 40, 30, 6).translate(0, -20, 0), 0.12, 0.01, 4);
        kit.add(kit.mat(strata('#cfe0a8', '#b5a37f', '#e9d7b0', 7, { flat: true, pattern: 'cracks' })), g);
      }
      // the keep, its corner towers, a gap to walk in
      {
        const keep = [], r = 20, cx = 0, cz = -30;
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + Math.PI / 4;
          keep.push(new THREE.CylinderGeometry(3.6, 4.2, 20, 10).translate(cx + Math.cos(a) * r, 10, cz + Math.sin(a) * r));
          keep.push(new THREE.ConeGeometry(5, 7, 10).translate(cx + Math.cos(a) * r, 23.5, cz + Math.sin(a) * r));
          const b = a + Math.PI / 2, mid = new THREE.Vector3((Math.cos(a) + Math.cos(b)) * r / 2, 4, (Math.sin(a) + Math.sin(b)) * r / 2);
          if (i !== 0) keep.push(new THREE.BoxGeometry(r * 1.35, 8, 2).rotateY(-Math.atan2(mid.z, mid.x) + Math.PI / 2).translate(cx + mid.x, mid.y, cz + mid.z));
        }
        keep.push(new THREE.CylinderGeometry(7, 8.4, 28, 12).translate(cx, 14, cz));
        keep.push(new THREE.SphereGeometry(8.4, 16, 10, 0, TAU, 0, Math.PI / 2).translate(cx, 28, cz));
        kit.add(stone(3), mergeGeometries(keep.map(nonIndexed)));
      }
      // the Hangar's building kit (garage.js) round the plateau
      const kitParts = [hangarHouse, hangarHouse, hangarTower, hangarMachine];
      for (let i = 0; i < 14; i++) {
        const a = kit.R(0, TAU), r = kit.R(54, 92), x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Math.abs(x) < 18 && z > 40) continue;
        const parts = kit.pick(kitParts)(kit.rng);
        kit.add(stone(kit.R(2, 5)), put(mergeGeometries(parts.map(nonIndexed)), x, 0, z, kit.R(0, 6), 0.7));
      }
      // a windmill-machine with turning blades
      {
        const x = -58, z = 24;
        kit.add(stone(4), new THREE.CylinderGeometry(3, 4.4, 22, 8).translate(x, 11, z));
        const blades = kit.mesh(mergeGeometries([new THREE.BoxGeometry(26, 2, 0.5), new THREE.BoxGeometry(2, 26, 0.5)]), kit.mat({ color: '#f3ead8', flat: true, grid: 2 }), { solid: false });
        blades.position.set(x, 22, z + 4);
        kit.mover((t) => { blades.rotation.z = t * 0.5; });
      }
      // the great machine: gears turning round a column, pistons pumping
      {
        const mx = 52, mz = -40;
        kit.add(stone(5), soften(new THREE.CylinderGeometry(4, 6, 48, 14, 8), 0.12).translate(mx, 24, mz));
        kit.add(kit.mat({ color: '#f2c54b', grid: 3, metal: 'brass' }), new THREE.SphereGeometry(7, 16, 10).scale(1, 0.7, 1).translate(mx, 49, mz));
        const gearMat = kit.mat({ color: '#d9643a', flat: true, grid: 2, metal: 'copper' }), ink = kit.mat({ color: '#34405e', flat: true, metal: 'iron' });
        for (let i = 0; i < 3; i++) {
          const r = 9 + i * 2.5, parts = [new THREE.TorusGeometry(r, 1.1, 6, 40).rotateX(Math.PI / 2)];
          for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; parts.push(new THREE.BoxGeometry(2, 1.6, 2).translate(Math.cos(a) * (r + 1.4), 0, Math.sin(a) * (r + 1.4))); }
          const gear = kit.mesh(mergeGeometries(parts.map(nonIndexed)), gearMat, { solid: false });
          const spokes = kit.mesh(mergeGeometries([0, 1, 2].map((k) => new THREE.BoxGeometry(r * 2, 0.6, 0.6).rotateY((k / 3) * Math.PI))), ink, { solid: false });
          gear.position.set(mx, 10 + i * 12, mz); spokes.position.copy(gear.position);
          const sp = (i % 2 ? -1 : 1) * (0.15 + i * 0.05);
          kit.mover((t) => { gear.rotation.y = spokes.rotation.y = t * sp; });
        }
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU, px = mx + Math.cos(a) * 13, pz = mz + Math.sin(a) * 13;
          kit.add(stone(2), new THREE.CylinderGeometry(1.8, 2.2, 6, 8).translate(px, 3, pz));
          const rod = kit.mesh(new THREE.CylinderGeometry(0.7, 0.7, 7, 8), kit.mat({ color: '#f3ead8', metal: 'chrome' }), { solid: false });
          kit.mover((t) => rod.position.set(px, 6.5 + Math.max(0, Math.sin(t * 1.6 + k)) * 4, pz));
        }
      }
      // a portal ring (the Hangar's are ways between its zones; this one is just to look at)
      {
        const grp = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.7, 8, 32), kit.mat({ color: '#f2c54b', glow: 1 }));
        const inner = new THREE.Mesh(new THREE.CircleGeometry(4.3, 32), kit.mat({ color: '#62c3c9', glow: 0.8, side: THREE.DoubleSide }));
        grp.add(ring, inner);
        grp.position.set(-46, 5.5, -46);
        grp.rotation.y = 0.8;
        grp.userData.noCollide = true;
        kit.group.add(grp);
        kit.light(-46, 5.5, -46, 16);
        kit.mover((t) => { inner.rotation.z = t * 0.6; ring.scale.setScalar(1 + Math.sin(t * 3) * 0.03); });
      }
      // the upside-down quarter hangs overhead: a slab with houses standing down from it
      {
        const y = 74, x = 10, z = -20;
        kit.add(kit.mat(strata('#a99be0', '#e88fa6', '#f3ead8', 2.5, { flat: true, grid: 6 })), jitter(new THREE.CylinderGeometry(34, 22, 12, 18, 3).rotateX(Math.PI).translate(x, y + 6, z), 0.1, 0.03, 9));
        for (let i = 0; i < 6; i++) {
          const a = kit.R(0, TAU), r = kit.R(4, 24);
          const parts = (i % 3 === 2 ? hangarTower : hangarHouse)(kit.rng);
          kit.add(stone(3), put(mergeGeometries(parts.map(nonIndexed)), x + Math.cos(a) * r, y, z + Math.sin(a) * r, kit.R(0, 6), 0.6, Math.PI));
        }
      }
      // stepping-stone islands round the plateau
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + 0.3, r = kit.R(122, 150);
        const ig = jitter(new THREE.ConeGeometry(kit.R(7, 12), 22, 8).rotateX(Math.PI).translate(0, -11, 0), 0.2, 0.05, i);
        kit.add(stone(3), ig.translate(Math.cos(a) * r, kit.R(-14, 18), Math.sin(a) * r));
      }
    },
  },

  // ===================================================================== The Buried Machine
  {
    id: 'buried', title: 'The Buried Machine',
    ground: {
      height: (x, z) => {
        const dunes = (fbm(nA, x * 0.009, z * 0.009, 3) * 5 + Math.abs(nB(x * 0.02, z * 0.014)) * 2.2) * Math.min(1, calmPath(x, z));
        const cz = -46 + 6 * Math.sin(x / 26), canyon = -16 * smoothstep(13, 8, Math.abs(z - cz)) * smoothstep(118, 100, Math.abs(x));
        return dunes + canyon + rimUp(x, z, 32);
      },
      material: { color: '#f3ead2', color2: '#ece0c2', color3: '#dccba6', mode: MODE_TERRAIN, ripples: true },
    },
    sky: {
      script: {
        day: ['#b3c4ab', '#f1e8cf', '#8e9fb2', '#fffaf0', '#fff6dc'],
        dusk: ['#a8ab92', '#f3c39a', '#8a7c9e', '#ffe0c0', '#ffe2b8'],
        night: ['#1e2c34', '#3f5660', '#33485a', '#93aab2', '#f2f0e6'],
      },
      planets: [{ az: 160, el: 20, size: 3.5, color: '#efe8dc', craters: false }],
    },
    atmo: { tint: [1, 1, 0.97], fog: 0.7 }, hour: 10.5,
    flora: { patches: 28, sparse: 0.08 },
    avoid: (x, z, r) => Math.abs(z + 46 - 6 * Math.sin(x / 26)) < 14 + r,
    people: [
      { at: [-24, 36], lines: ['~neutral~ Under the sand it goes on for kilometres. Pipes, wheels, rooms.', '~curious~ Put your ear to a pipe. Something in there is still breathing.'] },
      { at: [30, 20], lines: ['~tired~ We dig the domes out every morning. The dunes put them back every night.', '~solemn~ The canyon is rust all the way down.'] },
    ],
    build(kit) {
      const M = {
        rust: kit.mat(strata('#c8643f', '#b35a3a', '#d9825a', 4.5, { flat: true })),
        rustGrid: kit.mat(strata('#c8643f', '#d9825a', '#b35a3a', 3, { grid: 3.5 })),
        rustDark: kit.mat({ color: '#9a4a30', flat: true, metal: 'iron', refl: 0.15 }),
        rustWall: kit.mat(strata('#c0603e', '#b35a3a', '#cf7450', 6, { pattern: 'cracks' })),
        rustFloor: kit.mat({ color: '#d9825a', color2: '#cf7650', color3: '#b35a3a', mode: MODE_TERRAIN }),
        steel: kit.mat(strata('#7f93a3', '#5f7488', '#94a6b3', 2.2, { metal: 'steel', refl: 0.4 })),
        steelFlat: kit.mat(strata('#7f93a3', '#5f7488', '#94a6b3', 2.2, { flat: true, metal: 'steel', refl: 0.4 })),
        pipe: kit.mat({ color: '#d8dcc8', flat: true, metal: 'painted' }), flange: kit.mat({ color: '#a9b4a8', flat: true, metal: 'steel' }),
        ink: kit.mat({ color: '#34405e', flat: true }), hatch: kit.mat({ color: '#3d4a52', flat: true, metal: 'iron' }),
        teal: kit.mat(strata('#5e9094', '#4f8086', '#6fa0a2', 3.5, { grid: 4 })),
        peach: kit.mat({ color: '#f3a57c', glow: 0.85, flat: true }),
      };
      const V = (x, y, z) => new THREE.Vector3(x, y, z);
      // the rust canyon: leaning walls and a rust floor along the trench
      for (let x = -104; x < 104; x += 8) {
        const cz = -46 + 6 * Math.sin((x + 4) / 26), yaw = -Math.atan(6 / 26 * Math.cos((x + 4) / 26));
        for (const s of [-1, 1]) kit.add(M.rustWall, put(new THREE.BoxGeometry(8.4, 17, 1.6), x + 4, -7, cz + s * 10.2, yaw, 1, s * 0.22));
        kit.add(M.rustFloor, put(new THREE.BoxGeometry(8.4, 0.6, 18), x + 4, -15.8, cz, yaw));
        if ((x + 104) % 32 === 0) kit.add(M.steel, put(new THREE.CylinderGeometry(1.2, 1.2, 20, 10).rotateX(Math.PI / 2), x + 4, -6, cz, yaw), { solid: false });
      }
      // domed huts half-sunk in the dunes, in their creams
      const huts = ['#efe3c8', '#e9c9a8', '#e3d8bc', '#e8b896', '#d9d3b8'].map((c) => kit.mat({ color: c, flat: true, grid: 2 }));
      for (let i = 0; i < 9; i++) {
        const a = kit.R(0, TAU), d = kit.R(26, 84), x = Math.cos(a) * d, z = Math.sin(a) * d;
        if ((Math.abs(x) < 16 && z > 40) || Math.abs(z + 46) < 22) continue;
        const r = kit.R(3, 6), b = kit.base(x, z, r);
        kit.add(kit.pick(huts), new THREE.SphereGeometry(r, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.85, 1).translate(x, b - r * 0.2, z));
        kit.add(M.rustDark, new THREE.TorusGeometry(r * 0.98, 0.22, 4, 24).rotateX(Math.PI / 2).translate(x, b - r * 0.2 + 0.5, z), { solid: false });
        kit.add(M.hatch, new THREE.CylinderGeometry(0.9, 0.9, 0.3, 12).rotateX(Math.PI / 2).translate(x, b + r * 0.25, z + r * 0.78), { solid: false });
      }
      // pipes arching out of the sand, with flanges and elbows
      for (const [x0, z0, x1, z1, r] of [[-60, 10, -20, -14, 1.1], [18, -12, 64, 14, 1.4], [-82, -10, -70, 30, 0.9]]) {
        const a = V(x0, kit.H(x0, z0) - 2, z0), b = V(x1, kit.H(x1, z1) - 2, z1);
        const mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + a.distanceTo(b) * 0.35;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        kit.add(M.pipe, new THREE.TubeGeometry(curve, 28, r, 10));
        for (const u of [0.2, 0.4, 0.6, 0.8]) {
          const p = curve.getPoint(u), tg = curve.getTangent(u);
          kit.add(M.flange, new THREE.TorusGeometry(r * 1.15, r * 0.22, 5, 14).lookAt(tg).translate(p.x, p.y, p.z), { solid: false });
        }
      }
      // a stub pipe and its elbow by the camp
      {
        const c = V(-34, kit.H(-34, 30) + 2, 30);
        kit.add(M.pipe, cylBetween(V(c.x, c.y - 4, c.z), V(c.x, c.y, c.z), 0.9, 0.9, 10));
        kit.add(M.pipe, elbow(V(c.x + 2.4, c.y, c.z), 2.4, 0.9, V(-1, 0, 0), V(0, 1, 0)));
        kit.add(M.flange, cylBetween(V(c.x + 2.4, c.y + 2.4, c.z), V(c.x + 4, c.y + 2.4, c.z), 1.1, 1.1, 12));
      }
      // a derrick-machine hovering low over the dunes (buried.js's derrick, drifting)
      {
        const grp = new THREE.Group(), local = new Map();
        const add = (mat, g) => { if (!local.has(mat)) local.set(mat, []); local.get(mat).push(nonIndexed(g)); };
        const s = 0.8, T = (g) => g.scale(s, s, s);
        add(M.rustGrid, T(new THREE.CylinderGeometry(4, 5, 10, 12).translate(0, 5, 0)));
        add(M.rust, T(new THREE.ConeGeometry(5, 12, 12).rotateX(Math.PI).translate(0, -6, 0)));
        add(M.rustDark, T(new THREE.CylinderGeometry(8, 7.5, 1, 16).translate(0, 10.5, 0)));
        add(M.rust, T(new THREE.BoxGeometry(4, 4, 4).translate(-4.5, 13, -2)));
        add(M.steel, T(new THREE.SphereGeometry(2.6, 12, 8).translate(4.8, 3, 1)));
        add(M.ink, T(new THREE.CylinderGeometry(0.18, 0.3, 16, 5).translate(4, 19, 3)));
        add(M.ink, T(new THREE.BoxGeometry(4, 0.2, 0.2).translate(4, 24, 3)));
        add(M.rustDark, T(cylBetween(V(-3, 12, 3), V(-15, 18, 6), 0.45, 0.3, 6)));
        add(M.ink, T(cylBetween(V(-15, 18, 6), V(-15, 9, 6), 0.06, 0.06, 4)));
        add(M.steelFlat, T(new THREE.TorusGeometry(5.6, 0.5, 6, 20).rotateX(Math.PI / 2).translate(0, 4, 0)));
        for (const [mat, list] of local) { const m = new THREE.Mesh(mergeGeometries(padForm(list.map((g) => { g.deleteAttribute('uv'); return g; }))), mat); m.userData.noCollide = true; grp.add(m); }
        const base = kit.H(48, 34) + 26;
        grp.position.set(48, base, 34);
        kit.group.add(grp);
        kit.mover((t) => { grp.position.y = base + Math.sin(t * 0.25) * 2; grp.rotation.y = t * 0.06; });
      }
      // chimney stacks with their platforms
      for (const [x, z, h] of [[-70, -78, 34], [-56, -84, 26], [76, -74, 40]]) {
        const b = kit.H(x, z) - 1;
        kit.add(M.rustGrid, new THREE.CylinderGeometry(2.2, 3, h, 12).translate(x, b + h / 2, z));
        kit.add(M.rustDark, new THREE.CylinderGeometry(4.2, 4.2, 0.8, 16).translate(x, b + h * 0.6, z));
        kit.add(M.ink, new THREE.CylinderGeometry(2.4, 2.4, 1.2, 12, 1, true).translate(x, b + h + 0.6, z), { solid: false });
      }
      // the great wheel, half sunk in the sand
      {
        const x = -64, z = 4, Rw = 18, parts = [new THREE.TorusGeometry(Rw, 2.6, 8, 48)];
        for (let k = 0; k < 28; k++) { const a = (k / 28) * TAU; parts.push(new THREE.BoxGeometry(3.4, 3.4, 4.4).translate(Math.cos(a) * (Rw + 2.6), Math.sin(a) * (Rw + 2.6), 0).rotateZ(0)); }
        for (let k = 0; k < 4; k++) parts.push(new THREE.BoxGeometry(Rw * 2, 1.6, 1.6).rotateZ((k / 4) * Math.PI));
        kit.add(M.rustGrid, put(mergeGeometries(parts.map(nonIndexed)), x, kit.H(x, z) + Rw * 0.4, z, 0.5));
      }
      // a ring window in the ground, lit from below
      {
        const x = 58, z = -14, b = kit.H(x, z);
        kit.add(M.rustGrid, new THREE.TorusGeometry(9, 1.4, 8, 40).rotateX(Math.PI / 2).translate(x, b + 0.4, z));
        kit.add(M.teal, new THREE.CylinderGeometry(8.4, 8.4, 0.5, 40).translate(x, b + 0.1, z));
        for (let k = 0; k < 8; k++) kit.add(M.ink, new THREE.BoxGeometry(16.8, 0.3, 0.4).rotateY((k / 8) * Math.PI).translate(x, b + 0.45, z), { solid: false });
        kit.add(M.peach, new THREE.SphereGeometry(0.8, 10, 8).translate(x, b + 1.4, z), { solid: false, shadow: false });
        kit.light(x, b + 2, z, 16);
      }
    },
  },

  // ===================================================================== Viridel
  {
    id: 'edena', title: 'Viridel',
    ground: {
      height: (x, z) => fbm(nC, x * 0.01, z * 0.01, 3) * 4 * Math.min(1, calmPath(x, z)) - 4 * smoothstep(26, 12, r2(x + 46, z + 30)) + rimUp(x, z, 44),
      material: { color: '#b4d896', color2: '#c9e4a8', color3: '#e2d3a8', mode: MODE_TERRAIN, ticks: true },
    },
    sky: {
      script: {
        day: ['#5ea7da', '#e3efe0', '#8ea7d2', '#fffdf4', '#fffbe8'],
        dusk: ['#8f9fd8', '#f6c6a8', '#8a86c8', '#ffe6d0', '#fff0d6'],
        night: ['#18264e', '#3a4c80', '#34407a', '#9ab0d8', '#f2f0e6'],
      },
      planets: [{ az: 230, el: 20, size: 12, color: '#9fd6c9', ring: 0.3 }],
    },
    atmo: { tint: [0.98, 1, 1.02], fog: 0.7 }, hour: 10.5,
    flora: { patches: 38, sparse: 0.1 },
    people: [
      { at: [-16, 30], lines: ['~happy~ Everything that falls here is kept. Even you, if you stay.', '~playful~ Climb a trunk and you come out on top of a canopy. Try it.'] },
      { at: [20, -4], lines: ['~curious~ The white ruins were androids once. Now they are gardeners.', '~neutral~ The flowers answer one another. Hum and see.'] },
    ],
    build(kit) {
      const g = kit.group, terrain = kit.ground;
      const ek = { scene: g, terrain, rng: kit.rng, pick: (a) => kit.pick(a) };
      // Viridel's own umbrella trees, step pyramid and android ruins (edena.js)
      edenaTree(ek, 56, -46, 0.42);
      edenaTree(ek, -74, 38, 0.38);
      edenaTree(ek, 84, 46, 0.34);
      edenaTree(ek, -26, -88, 0.46);
      edenaPyramid(ek, -84, -62, 38);
      edenaRuins({ ...ek, ruinMat: kit.mat({ color: '#f7f4ec', flat: true, grid: 3, glyphs: true }), accent: kit.mat({ color: '#62c3c9', flat: true, grid: 3 }) }, 84, -40);
      // great smooth spheres half-sunk in the meadow
      const white = kit.mat({ color: '#fbf8f0' });
      const ACC = ['#f2a7b5', '#62c3c9', '#f6c7a0', '#b5a7e6', '#f2c54b', '#7fcfa8'];
      for (const [x, z, R, mat] of [[-66, -18, 9, white], [40, 54, 6, kit.mat({ color: ACC[0] })], [-10, -60, 7, white]])
        kit.add(mat, new THREE.SphereGeometry(R, 40, 24).translate(x, kit.H(x, z) + R * 0.3, z));
      // the machines' garden: pedestals with little ornaments, in rows
      for (let i = 0; i < 24; i++) {
        const row = Math.floor(i / 8), k = i % 8, x = 18 + k * 5, z = 18 + row * 6;
        const base = kit.base(x, z, 1.4), ph = kit.R(1.4, 3.2), mat = kit.mat({ color: kit.pick(ACC) }), top = base + ph, kind = kit.rng();
        kit.add(white, new THREE.CylinderGeometry(0.9, 1.1, ph, 16).translate(x, base + ph / 2, z));
        if (kind < 0.45) kit.add(mat, new THREE.SphereGeometry(1.1, 20, 12).translate(x, top + 1.1, z));
        else if (kind < 0.75) kit.add(mat, new THREE.ConeGeometry(1, 2.4, 16).translate(x, top + 1.2, z));
        else kit.add(mat, new THREE.OctahedronGeometry(1.25, 0).translate(x, top + 1.25, z));
      }
      // the pond, and leaves floating on it
      const pond = kit.mesh(new THREE.CircleGeometry(24, 48).rotateX(-Math.PI / 2), kit.mat({ color: '#7fc4d0', color2: '#9ad3d9', mode: MODE_WATER }), { solid: false, shadow: false });
      pond.position.set(-46, -1.6, -30);
      for (let i = 0; i < 7; i++) {
        const a = kit.R(0, TAU), d = kit.R(4, 16);
        kit.add(kit.mat({ color: kit.pick(LEAVES), flat: true }), new THREE.CylinderGeometry(kit.R(1, 2), kit.R(1, 2), 0.15, 12).translate(-46 + Math.cos(a) * d, -1.5, -30 + Math.sin(a) * d), { solid: false });
      }
    },
  },

  // ===================================================================== The Garden of Spheres
  {
    id: 'spheres', title: 'The Garden of Spheres',
    ground: {
      height: (x, z) => {
        const lake = Math.hypot(x / 52, (z + 34) / 30);
        return fbm(nA, x * 0.012, z * 0.012, 2) * 1.6 * Math.min(1, calmPath(x, z)) - 3.4 * smoothstep(1.1, 0.75, lake) + rimUp(x, z, 38);
      },
      material: { color: '#c8d65a', color2: '#b5c94f', color3: '#8fae55', mode: MODE_TERRAIN, ticks: true },
    },
    sky: {
      script: {
        day: ['#9cc4dc', '#f1d9cb', '#a9c3cf', '#fffdf4', '#fff8e0'],
        dusk: ['#a9b4d8', '#f6c4ae', '#9b9cc8', '#ffe6d0', '#fff0d6'],
        night: ['#1c2a50', '#3c4f80', '#34407a', '#9ab0d8', '#f2f0e6'],
      },
      planets: [{ az: 95, el: 24, size: 7, color: '#f6efd0', craters: false }, { az: 40, el: 12, size: 3, color: '#f3e3a0', craters: false }],
    },
    atmo: { tint: [1, 0.99, 1], fog: 0.55 }, hour: 8.5,
    flora: { patches: 30, sparse: 0.08 },
    avoid: (x, z, r) => Math.hypot(x / 54, (z + 34) / 32) < 1 + r / 30,
    unsafe: (p) => Math.hypot(p.x / 52, (p.z + 34) / 30) < 0.72 && p.y < -1.6,
    people: [
      { at: [-24, 26], lines: ['~whisper~ Stand still by the lake and the spheres hum back.', '~happy~ The water keeps a copy of everything. Look.'] },
      { at: [44, 12], lines: ['~solemn~ The plaza is round so nobody stands at its head.', '~curious~ The pole in the middle? It points where the sound comes from.'] },
    ],
    build(kit) {
      const M = {
        trunk: kit.mat({ color: '#9fb5a8' }), branch: kit.mat({ color: '#7f9a90' }), canopy: kit.mat({ color: '#ffffff', vertexColors: true }),
        white: kit.mat({ color: '#f3efe2', flat: true }), whiteSmooth: kit.mat({ color: '#f5f2e8' }),
        cream: kit.mat({ color: '#ffffff', vertexColors: true, palette: ['#f6efd0', '#a9c9c4'], glow: 0.6 }),
        yellow: kit.mat({ color: '#ffffff', vertexColors: true, palette: ['#f3e3a0', '#a9c9c4'], glow: 0.6 }),
        stone: kit.mat({ color: '#efe7d4' }), stone2: kit.mat({ color: '#e0d4bc' }), pole: kit.mat({ color: '#f6f3ea' }),
      };
      // the mirror lake
      const lake = kit.mesh(new THREE.CircleGeometry(1, 72).rotateX(-Math.PI / 2).scale(56, 1, 34), kit.mat({ color: '#a8d0d6', color2: '#9fd0c8', mode: MODE_WATER }), { solid: false, shadow: false });
      lake.position.set(0, -0.8, -34);
      // great pale spheres sinking into it, their crescents printed for the morning sun
      const toLight = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), CRESCENT);
      const crescent = (Rs, lit) => paintFaces(new THREE.SphereGeometry(Rs, 56, 34).toNonIndexed().applyQuaternion(toLight), (c) => (c.dot(CRESCENT) > 0 ? lit : '#a9c9c4'));
      for (const [x, z, Rs, lift, yellow] of [[-16, -44, 15, -0.3, false], [24, -30, 9, 0.1, false], [-44, -16, 5, 0.5, true], [50, -56, 6, 0.4, false]])
        kit.add(yellow ? M.yellow : M.cream, crescent(Rs, yellow ? '#f3e3a0' : '#f6efd0').translate(x, kit.H(x, z) + Rs * lift, z));
      // umbrella trees: pale trunks under flat canopies, lime above, gilled green below
      const lump = (geo, seed, R0) => {
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
          if (r < R0 * 0.6) continue;
          const a = Math.atan2(z, x), k = 1 + 0.05 * nB(Math.cos(a) * 2.2 + seed, Math.sin(a) * 2.2 - seed) * smoothstep(0.6, 1, r / R0);
          p.setXYZ(i, x * k, p.getY(i), z * k);
        }
        return geo;
      };
      for (const [x, z, Rc, Ht] of [[-62, 34, 18, 22], [64, -20, 15, 18], [-74, -62, 20, 26], [30, 70, 11, 14]]) {
        const seed = kit.R(0, 50), base = kit.base(x, z, Rc * 0.15) - 0.5, dome = Rc * 0.09, rT = Rc * 0.085, rB = Rc * 0.14, yJ = Ht - Rc * 0.2;
        const prof = [[0.01, yJ + 0.6], [rT * 1.3, yJ], [Rc * 0.25, yJ + Rc * 0.09], [Rc * 0.55, yJ + Rc * 0.16], [Rc * 0.85, Ht - 0.25], [Rc, Ht],
          [Rc * 1.02, Ht + 0.8], [Rc * 0.99, Ht + 1.7], [Rc * 0.88, Ht + 2.3], [Rc * 0.6, Ht + 2.3 + dome * 0.55], [Rc * 0.25, Ht + 2.3 + dome * 0.92], [0.01, Ht + 2.3 + dome]];
        const canopy = lump(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64), seed, Rc);
        canopy.computeVertexNormals();
        const cg = paintFaces(canopy.toNonIndexed(), (c, n) => {
          if (n.y < -0.05) return Math.floor(((Math.atan2(c.z, c.x) + Math.PI) / TAU) * 64) % 2 === 0 ? '#2b4636' : '#3f5f4a';
          if (Math.hypot(c.x, c.z) > Rc * 0.95 && c.y < Ht + 1.9) return '#9fb860';
          return nB(c.x * 0.06 + seed, c.z * 0.06) > 0.35 ? '#c6d07c' : '#b7c46a';
        });
        kit.add(M.canopy, cg.translate(x, base, z));
        const tl = yJ + 1.5;
        kit.add(M.trunk, soften(jitter(new THREE.CylinderGeometry(rT, rB, tl, 14, 8, true).translate(0, tl / 2, 0), 0.12, 0.08, seed), -0.14).translate(x, base, z));
        kit.add(M.trunk, jitter(new THREE.CylinderGeometry(rB * 0.95, rB * 1.9, Ht * 0.1, 14, 2, true).translate(0, Ht * 0.05, 0), 0.2, 0.3, seed + 3).translate(x, base, z));
        for (let b = 0; b < 11; b++) {
          const a = (b / 11) * TAU + kit.R(0, 0.4), ca = Math.cos(a), sa = Math.sin(a), r1 = Rc * kit.R(0.62, 0.8), y1 = yJ + Rc * 0.16 * (r1 / Rc) / 0.55 - 0.6;
          const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(ca * rT * 0.6, yJ - Rc * 0.08, sa * rT * 0.6), new THREE.Vector3(ca * r1 * 0.4, yJ + Rc * 0.02, sa * r1 * 0.4), new THREE.Vector3(ca * r1, Math.min(y1, Ht - 0.6), sa * r1));
          kit.add(M.branch, new THREE.TubeGeometry(curve, 6, Rc * (b % 3 ? 0.011 : 0.017), 5).translate(x, base, z), { solid: false });
        }
      }
      // a white step pyramid with its stair
      {
        const x = -84, z = 4, b = kit.base(x, z, 14) - 0.5;
        for (let i = 0; i < 5; i++) { const w = 26 - i * 4.6; kit.add(M.white, new THREE.BoxGeometry(w, 3, w).translate(x, b + 1.5 + i * 3, z)); }
        kit.add(M.white, new THREE.BoxGeometry(5, 3, 5).translate(x, b + 16.5, z));
        for (let k = 0; k < 15; k++) kit.add(M.white, new THREE.BoxGeometry(1.4, 1, 4).translate(x + 19 - k * 0.92, b + 0.5 + k, z));   // the stair up its east face
      }
      // a cypress avenue leading up from the door, and a round stone plaza with its pole
      const cyp = new THREE.LatheGeometry([[0.01, 0], [0.9, 0.6], [1.5, 3], [1.55, 6], [1.1, 10], [0.5, 13], [0.01, 14.5]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
      jitter(cyp, 0.14, 0.4, 7);
      const cypMat = kit.mat({ color: '#4f6b3a', pattern: 'leaves' });
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
        const x = s * 9, z = 50 - i * 9, k = kit.R(0.7, 0.95);
        kit.add(cypMat, cyp.clone().scale(k, k * kit.R(0.9, 1.2), k).translate(x, kit.H(x, z) - 0.3, z));
      }
      {
        const x = 52, z = 26, b = kit.H(x, z);
        for (const [r, h] of [[15, 0.4], [11, 0.7], [6, 1.0]]) kit.add(r === 11 ? M.stone2 : M.stone, new THREE.CylinderGeometry(r, r + 0.3, h, 48).translate(x, b + h / 2 - 0.2, z));
        kit.add(M.pole, new THREE.CylinderGeometry(0.5, 0.7, 14, 12).translate(x, b + 7.5, z));
        kit.add(M.yellow, crescent(1.4, '#f3e3a0').translate(x, b + 15.2, z), { solid: false });
        kit.add(M.whiteSmooth, new RoundedBoxGeometry(3, 9, 1.5, 3, 0.7).translate(x + 18, kit.H(x + 18, z - 6) + 4, z - 6).rotateY(0));
      }
    },
  },

  // ===================================================================== Lorn
  {
    id: 'perdide', title: 'Lorn',
    ground: {
      height: (x, z) => {
        const wx = x + nB(x * 0.01, z * 0.01) * 20, chan = 1 - Math.abs(nA(wx * 0.012, z * 0.012));
        const h = 0.6 + fbm(nC, x * 0.02, z * 0.02, 3) * 1.4 - smoothstep(0.82, 0.95, chan) * 3.2;
        return lerp(h, 0.7, 1 - Math.min(1, calmPath(x, z))) + rimUp(x, z, 3, 120, 180);
      },
      material: { color: '#6f8a62', color2: '#86a070', color3: '#7a6a86', mode: MODE_TERRAIN, ticks: true },
    },
    sky: {
      script: {
        day: ['#6aa0c8', '#e9d6bf', '#8a86c4', '#effff8', '#fff6dc'],
        dusk: ['#5a7cc0', '#f0b48e', '#7f78bc', '#c8f2e4', '#ffe0c0'],
        night: ['#141a3a', '#3a3f78', '#3d3478', '#7fd6c8', '#f2f0e6'],
      },
      planets: [{ az: 70, el: 22, size: 16, color: '#c7a6f2', ring: 0.35 }],
    },
    atmo: { tint: [0.92, 1, 1], fog: 1.5 }, hour: 18.4,
    flora: { patches: 32, sparse: 0.08, water: 0 },
    unsafe: (p, H) => H(p.x, p.z) < -1.6 && p.y < 0.5,
    people: [
      { at: [-14, 34], lines: ['~whisper~ Hear it? The crystals hum when the light goes.', '~scared~ Not too close to the red ones. They snap.'] },
      { at: [24, 6], lines: ['~happy~ The eggs keep warm all night. Nobody knows what hatches.', '~neutral~ Wade where the reeds grow. Where they stop, it is deep.'] },
    ],
    build(kit) {
      const water = kit.mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2), kit.mat({ color: '#3f8f95', color2: '#4fa3a3', mode: MODE_WATER }), { solid: false, shadow: false });
      water.position.y = 0;
      // crystal forests: glowing spikes in Lorn's four colours (perdide.js)
      const crystals = (cx, cz, count, spread, scale) => {
        kit.light(cx, kit.H(cx, cz) + 4, cz, spread * 0.5 + 14);
        for (let i = 0; i < count; i++) {
          const x = cx + kit.R(-0.5, 0.5) * spread, z = cz + kit.R(-0.5, 0.5) * spread;
          const h = (6 + kit.rng() * kit.rng() * 40) * scale, r = kit.R(0.8, 3.3) * scale;
          const g = new THREE.CylinderGeometry(0, r, h, 5, 1).translate(0, h / 2, 0).rotateX(kit.R(-0.25, 0.25)).rotateZ(kit.R(-0.25, 0.25));
          kit.add(kit.mat({ color: kit.pick(CRYSTAL), flat: true, glow: 0.55 }), g.translate(x, kit.H(x, z) - 0.5, z));
        }
      };
      crystals(48, -52, 30, 34, 0.7);
      crystals(-70, -40, 22, 28, 0.6);
      crystals(70, 40, 16, 22, 0.5);
      // carnivorous plants: Lorn's jaws on their stalks, breathing open and shut
      const stalkMat = kit.mat({ color: '#6f9a5a' }), jawMat = kit.mat({ color: '#ffffff', vertexColors: true }), teethMat = kit.mat({ color: '#f3ead8', flat: true });
      const jawGeo = {}, teethGeo = {};
      for (const side of [-1, 1]) {
        jawGeo[side] = jawShell().rotateX(side > 0 ? 0 : Math.PI);
        teethGeo[side] = mergeGeometries(Array.from({ length: 7 }, (_, t) => { const a = (t / 7) * TAU; return new THREE.ConeGeometry(0.2, 0.8, 4).rotateX(side > 0 ? Math.PI : 0).translate(Math.cos(a) * 1.8, side * -0.3, Math.sin(a) * 1.8).toNonIndexed(); }));
      }
      [[-30, 8], [-40, 18], [26, 30], [40, -14], [-16, -30]].forEach(([x, z], i) => {
        const base = kit.H(x, z), h = kit.R(5, 10);
        const p0 = new THREE.Vector3(0, 0, 0), p1 = new THREE.Vector3(kit.R(-1.5, 1.5), h * 0.6, kit.R(-1.5, 1.5)), p2 = new THREE.Vector3(0, h, 0);
        kit.add(stalkMat, new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 12, 0.45, 6).translate(x, base, z));
        const head = new THREE.Group();
        head.position.set(x, base + h, z);
        head.rotation.z = Math.PI / 2;
        head.rotation.y = kit.R(0, TAU);
        head.userData.noCollide = true;
        const jaws = [];
        for (const side of [-1, 1]) {
          const jaw = new THREE.Group();
          jaw.add(new THREE.Mesh(jawGeo[side], jawMat), new THREE.Mesh(teethGeo[side], teethMat));
          head.add(jaw);
          jaws.push({ jaw, side });
        }
        kit.group.add(head);
        kit.mover((t) => { const open = 0.55 + 0.35 * Math.sin(t * 0.9 + i * 1.7); for (const j of jaws) j.jaw.rotation.z = j.side * open * 0.75; });
      });
      // glowing egg clutches
      for (const [cx, cz] of [[-8, 18], [52, 8], [-56, -4]]) {
        kit.light(cx, kit.H(cx, cz) + 1.5, cz, 11);
        const mat = kit.mat({ color: kit.pick(['#f6c7a0', '#f2a7b5', '#f2e38f']), glow: 1 });
        for (let i = 0; i < 8; i++) {
          const x = cx + kit.R(-3, 3), z = cz + kit.R(-3, 3), s = kit.R(0.7, 1.4);
          kit.add(mat, new THREE.SphereGeometry(1, 10, 8).scale(s, s * 1.4, s).translate(x, kit.H(x, z) + s, z), { solid: false });
        }
      }
      // giant fungus trees: swollen violet stalks under broad glowing caps
      const prof = [[0, 0], [2.6, 0], [3.8, 0.07], [3.2, 0.2], [1.5, 0.45], [1.25, 0.7], [1.9, 0.79], [8.5, 0.83], [9.5, 0.88], [7.0, 0.96], [0, 1]];
      const STALK = ['#8a6fb8', '#7a5fa0', '#9a7fc4'], CAP = ['#d6ff9a', '#f2a7b5', '#7fe0d0', '#f2c54b'];
      for (const [x, z, s] of [[-58, 52, 1.1], [64, -84, 1.3], [-86, -70, 0.9], [88, 2, 1.0], [-24, -76, 0.7]]) {
        const g0 = kit.H(x, z), H = (14 + kit.R(0, 22)) * s;
        const geo = jitter(new THREE.LatheGeometry(prof.map(([pr, py]) => new THREE.Vector2(pr * s, py * H)), 12), 0.12, 0.03, x);
        geo.rotateZ(kit.R(-0.09, 0.09)).rotateY(kit.R(0, 6)).translate(x, g0 - 0.6, z);
        const pos = geo.attributes.position, cut = g0 - 0.6 + H * 0.8, idx = geo.index.array, st = [], cp = [];
        for (let t = 0; t < idx.length; t += 3) (Math.max(pos.getY(idx[t]), pos.getY(idx[t + 1]), pos.getY(idx[t + 2])) > cut ? cp : st).push(idx[t], idx[t + 1], idx[t + 2]);
        const part = (list) => { const q = geo.clone(); q.setIndex(list); return q; };
        kit.add(kit.mat({ color: kit.pick(STALK), flat: true }), part(st));
        kit.add(kit.mat({ color: kit.pick(CAP), flat: true, glow: 0.3 }), part(cp));
        kit.light(x, g0 + H * 0.75, z, 10 * s + 4);
      }
      // reeds crowding the waterline
      reeds(kit, (h) => h > -1.2 && h < 0.9, ['#3f5a3a', '#4f6b34', '#5a4a6a'], 1400);
    },
  },

  // ===================================================================== Lorn II (the Deep Wood)
  {
    id: 'perdide2', title: 'Lorn II',
    ground: {
      height: (x, z) => {
        const path = Math.abs(x - 14 * Math.sin(z / 30));
        const h = 0.4 + fbm(nB, x * 0.018, z * 0.018, 3) * 1.6 - smoothstep(0.6, 0.95, Math.abs(nC(x * 0.01, z * 0.012))) * 2.4;
        return lerp(h, 0.6, smoothstep(9, 3, path)) + rimUp(x, z, 4, 120, 180);
      },
      material: { color: '#46686e', color2: '#517676', color3: '#55588a', mode: MODE_TERRAIN, ticks: true },
    },
    sky: {
      script: {
        day: ['#c48c98', '#f2a088', '#4a4f7a', '#ece2f2', '#fff0e0'],
        dusk: ['#b97f93', '#f0927a', '#4a4f7a', '#f2cfc4', '#fff2e2'],
        night: ['#1b1f3e', '#5a3f62', '#2f3560', '#8fb8c8', '#f2e8e0'],
      },
      planets: [{ az: 172, el: 12, size: 2.2, color: '#f6e6dc', craters: false }],
    },
    atmo: { tint: [1, 0.97, 0.98], fog: 1.7 }, hour: 17.7, look: { uClouds: 0, uCumulus: 0, uFogDensity: 0.002 },
    flora: { patches: 30, sparse: 0.08, water: 0 },
    unsafe: (p, H) => H(p.x, p.z) < -1.6 && p.y < 0.5,
    people: [
      { at: [-10, 36], lines: ['~neutral~ We keep the pools lit. Somebody has to.', '~curious~ The domes? Moss over glass. Knock, someone might answer.'] },
      { at: [16, -10], lines: ['~whisper~ Under the big caps it is always evening.', '~happy~ The saucer fell before my grandmother. It still hums.'] },
    ],
    build(kit) {
      const water = kit.mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2), kit.mat({ color: '#4f8a8f', color2: '#5f9a9a', mode: MODE_WATER }), { solid: false, shadow: false });
      water.position.y = 0;
      // giant pale mushrooms (perdide2.js's own profile)
      const STALK = ['#b9b3d9', '#a49cc8', '#c3bde2'];
      const shroom = (x, z, s, glow, seed) => {
        const g0 = kit.H(x, z), parts = shroomParts(s), rx = kit.R(-0.1, 0.1), rz = kit.R(-0.1, 0.1), ry = kit.R(0, 6), seg = s.capR > 6 ? 28 : 16;
        for (const key of ['stalk', 'under', 'top']) {
          const g = jitter(lathe(parts[key], seg), key === 'stalk' ? 0.08 : 0.05, 0.06, seed);
          g.rotateY(ry).rotateX(rx).rotateZ(rz).translate(x, g0 - 0.6, z);
          const c = key === 'stalk' ? kit.pick(STALK) : key === 'under' ? (glow ? '#b5abe0' : '#9890c0') : (glow ? '#ddd6f6' : kit.pick(['#c9c1ea', '#bdb4e2', '#d2cbef']));
          const gl = glow ? (key === 'top' ? 0.45 : key === 'under' ? 0.3 : 0) : (key === 'top' ? 0.12 : 0);
          kit.add(kit.mat({ color: c, flat: true, glow: gl }), g);
        }
        if (glow) kit.light(x, g0 + parts.topY * 0.85, z, s.capR * 1.6);
      };
      for (const [x, z, Hh, glow] of [[-44, -30, 34, true], [52, -46, 28, false], [-70, 40, 22, true], [70, 30, 18, false], [-24, -82, 40, false], [30, -88, 24, true], [-90, -20, 16, false]]) {
        const capR = Hh * kit.R(0.32, 0.42);
        shroom(x, z, { H: Hh, capR, sr: capR * 0.17, dome: kit.rng() < 0.5 ? 0.12 : 0.4 }, glow, x + z);
      }
      // little ones round the path
      for (let i = 0; i < 10; i++) {
        const z = kit.R(-60, 50), x = 14 * Math.sin(z / 30) + (i % 2 ? 1 : -1) * kit.R(6, 12), Hh = kit.R(2, 4.5), capR = Hh * 0.45;
        shroom(x, z, { H: Hh, capR, sr: capR * 0.2, dome: 0.3 }, i % 3 === 0, i);
      }
      // moss domes with round glowing doors (one of glass, ribbed)
      for (const [x, z, R, kind] of [[36, 10, 7, 'moss'], [-38, 4, 5.5, 'moss'], [24, -24, 6, 'glass']]) {
        const b = kit.base(x, z, R) - 0.4, face = Math.atan2(14 * Math.sin(z / 30) - x, 0) > 0 ? Math.PI / 2 : -Math.PI / 2;
        const mat = kit.mat(kind === 'moss' ? { color: '#3f6a6a', grid: 2.2, flat: true } : { color: '#5f9a9a', grid: 1.4, glow: 0.12, flat: true });
        kit.add(mat, new THREE.SphereGeometry(R, 24, 12, 0, TAU, 0, Math.PI / 2).scale(1, 0.72, 1).translate(x, b, z));
        if (kind === 'glass') for (let k = 0; k < 6; k++) kit.add(kit.mat({ color: '#2a4248', flat: true }), new THREE.TorusGeometry(R * 1.01, 0.12, 4, 24, Math.PI).scale(1, 0.72, 1).rotateY((k / 6) * Math.PI).translate(x, b, z), { solid: false });
        const dx = Math.sin(face) * R * 0.97, dz = Math.cos(face) * R * 0.97;
        kit.add(kit.mat({ color: '#9fe0d0', glow: 0.95 }), new THREE.CircleGeometry(1.1, 20).rotateY(face).translate(x + dx, b + 1.2, z + dz), { solid: false, shadow: false });
        kit.add(kit.mat({ color: '#2a4248', flat: true }), new THREE.TorusGeometry(1.2, 0.15, 5, 20).rotateY(face).translate(x + dx, b + 1.2, z + dz), { solid: false });
        kit.light(x + dx * 1.2, b + 1.4, z + dz * 1.2, 7);
      }
      // root arches over the path
      for (const [z, span, apex] of [[20, 24, 9], [-36, 28, 12]]) {
        const cx = 14 * Math.sin(z / 30), pts = [];
        for (let k = 0; k <= 8; k++) { const u = k / 8; pts.push(new THREE.Vector3(cx + (u - 0.5) * span, -0.5 + Math.sin(u * Math.PI) * apex, z + Math.sin(u * 7) * 1.2)); }
        // a tapered tube: thick at the feet where it roots, thin over the top
        const curve = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(curve, 32, 1.4, 7), p = tube.attributes.position, c = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
          const t = Math.floor(i / 8) / 32, k = 0.6 + 0.9 * Math.abs(t - 0.5) * 2;
          curve.getPoint(t, c);
          p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
        }
        tube.computeVertexNormals();
        kit.add(kit.mat({ color: kit.pick(['#2f4a55', '#34505a', '#2b3f50']), flat: true, pattern: 'cracks' }), tube);
      }
      // glowing egg heaps and coral light pools
      for (const [cx, cz] of [[-20, 12], [44, -64], [-56, -54]]) {
        kit.light(cx, kit.H(cx, cz) + 1.5, cz, 12);
        for (let i = 0; i < 9; i++) {
          const x = cx + kit.R(-2.5, 2.5), z = cz + kit.R(-2.5, 2.5), s = kit.R(0.5, 1.1);
          kit.add(kit.mat({ color: kit.pick(['#f6dcb0', '#ffd6a0', '#f8e6c4', '#ffcf9a']), glow: 1 }), new THREE.SphereGeometry(1, 10, 8).scale(s, s * 1.35, s).translate(x, kit.H(x, z) + s * 0.8, z), { solid: false });
        }
      }
      for (let i = 0; i < 7; i++) {
        const z = 46 - i * 15, x = 14 * Math.sin(z / 30) + (i % 2 ? 7 : -7);
        kit.add(kit.mat({ color: kit.pick(['#f2a07a', '#f6b08a', '#f09474']), glow: 1 }), new THREE.CircleGeometry(kit.R(1.4, 2.4), 20).rotateX(-Math.PI / 2).translate(x, 0.06, z), { solid: false, shadow: false });
        kit.light(x, 1, z, 6);
      }
      // the crashed saucer, nose in the mud
      {
        const x = 62, z = -6, y = kit.H(x, z) - 0.2;
        const grp = new THREE.Group();
        grp.add(new THREE.Mesh(new THREE.CylinderGeometry(7.5, 6, 1.6, 32), kit.mat({ color: '#4fbcb0', flat: true })));
        grp.add(new THREE.Mesh(new THREE.CylinderGeometry(6, 2.5, 1.2, 32).translate(0, -1.4, 0), kit.mat({ color: '#3a8f8a', flat: true })));
        grp.add(new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 10, 0, TAU, 0, Math.PI / 2).translate(0, 0.8, 0), kit.mat({ color: '#1d2a3a', flat: true })));
        for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6).translate(Math.cos(a) * 7, 0, Math.sin(a) * 7), kit.mat({ color: '#f2a07a', glow: 1 }))); }
        grp.position.set(x, y + 0.6, z);
        grp.rotation.set(0.2, 0.6, 0.12);
        kit.group.add(grp);
        kit.light(x, y + 2, z, 12);
      }
      // crystal reeds along the water
      reeds(kit, (h) => h > -1 && h < 0.7, ['#9fe0d0', '#7fd6c8', '#b5abe0'], 900, { glow: 0.6, thin: 0.06 });
    },
  },

  // ===================================================================== The Signal Market
  {
    id: 'bazaar', title: 'The Signal Market',
    ground: { height: () => 0, material: { color: '#a4c1be', grid: 10, flat: true } },
    sky: {
      script: { day: ['#a4d7d1', '#e1e6c6', '#70969e', '#fff1cf', '#ffe1ae'], dusk: ['#9dabc3', '#ffc5a2', '#887b9e', '#ffd6aa', '#ffe5c2'], night: ['#243e59', '#587581', '#55547c', '#8daec0', '#f9e3ac'] },
    },
    atmo: { tint: [1, 1, 1], fog: 0.65 }, hour: 11.5, look: { uHatch: 0.18, uLineWidth: 0.85, uWobble: 0.1, uGrain: 0.025 },
    flora: { patches: 18, sparse: 0.1, band: [-1, 1.6], rects: [[19, 27, -70, 56], [-27, -19, -70, 56]] },
    avoid: (x, z, r) => Math.abs(x) < 17 + r,
    people: [
      { at: [10, 40], lines: ['~happy~ Welcome to the Signal Market. Everything here is talking.', '~shout~ Lanterns! Every lantern holds a little sun!'] },
      { at: [-10, -10], lines: ['~curious~ The tower at the end has gone quiet. Odd, in a city of a thousand broadcasts.', '~neutral~ Up the blue ledges, or over the skybridge.'] },
      { at: [8, -46], lines: ['~whisper~ The lavender folk do not move. They listen.', '~playful~ Mind the tram lines. The trams mind nobody.'] },
    ],
    build(kit) {
      const mat = (c, extra = {}) => kit.mat({ color: c, flat: true, ...extra });
      const coral = mat('#f0a083', { grid: 12 }), teal = mat('#88b4b5', { grid: 9 }), ink = mat('#465c65', { metal: 'painted' }), cream = mat('#f5dfab'), brass = mat('#c99758', { metal: 'brass' }), lilac = mat('#b9a9c5'), dark = mat('#3a535b', { metal: 'painted' }), glow = mat('#fff0bd', { glow: 0.75 });
      const shop = ['#f0a083', '#e4bd83', '#8dbbb9', '#94a9bd', '#ebce98'].map((c) => mat(c));
      const box = (x, y, z, w, h, d, m, solid = true) => kit.add(m, new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), { solid });
      // sidewalks and the brass tram lines
      for (const s of [-1, 1]) { box(s * 23, 0, -10, 8, 0.3, 150, mat('#d5c7a8', { grid: 3 })); box(s * 5, 0, -10, 0.4, 0.08, 150, brass, false); }
      // the canyon of towers round the market
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU, rr = kit.R(104, 126), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        if (Math.abs(x) < 26 && z > 60) continue;   // (the way in)
        const w = kit.R(14, 24), d = kit.R(14, 22), h = kit.R(40, 90);
        kit.add(i % 3 ? coral : teal, put(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, 0, z, -a));
        kit.add(dark, put(new THREE.BoxGeometry(w * 0.7, 3, d + 0.4).translate(0, h * kit.R(0.4, 0.7), 0), x, 0, z, -a), { solid: false });
      }
      // posters on the towers along the street
      const poster = (x, y, z, w, h, yaw, seed) => {
        kit.add(ink, put(new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.3), x, y, z, yaw), { solid: false });
        kit.add(shop[seed % shop.length], put(new THREE.BoxGeometry(w, h, 0.4), x, y, z, yaw), { solid: false });
        kit.add(seed % 2 ? cream : lilac, put(new THREE.CircleGeometry(Math.min(w, h) * 0.3, 20), x, y, z, yaw).translate(Math.sin(yaw) * 0.25, 0, Math.cos(yaw) * 0.25), { solid: false });
      };
      // the market stalls down both sides of the street
      for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
        const z = 46 - i * 20, x = s * 14, c = shop[(i * 2 + (s > 0 ? 1 : 0)) % shop.length];
        box(x, 0, z, 8, 4, 12, c);
        box(x - s * 4.4, 0, z, 1, 1.2, 10, cream);
        for (let k = 0; k < 7; k++) kit.add(k % 2 ? cream : c, put(new THREE.BoxGeometry(3.4, 0.25, 1.7), x - s * 5.6, 4.6 - 0.1 * (k % 2), z - 5.1 + k * 1.7, 0, 1, 0, s * 0.35), { solid: false });
        poster(x, 6.8, z, 10, 2, s > 0 ? -Math.PI / 2 : Math.PI / 2, i + (s > 0 ? 3 : 0));
        for (const dz of [-5.5, 5.5]) {
          box(x - s * 5.2, 0, z + dz, 0.25, 4.4, 0.25, brass, false);
          kit.add(glow, new THREE.SphereGeometry(0.5, 10, 8).translate(x - s * 5.2, 4.9, z + dz), { solid: false, shadow: false });
        }
        kit.light(x - s * 5.2, 5, z, 9);
        for (let k = 0; k < 4; k++) kit.add(kit.mat({ color: kit.pick(['#f2c54b', '#e6875f', '#c8483a', '#8fcf9a']), flat: true }), new THREE.SphereGeometry(0.32, 8, 6).translate(x - s * 4.4, 1.5, z - 3 + k * 2), { solid: false });
      }
      // two towers by the square, a skybridge slung between them
      for (const s of [-1, 1]) {
        box(s * 44, 0, -70, 16, 54, 16, s > 0 ? coral : teal);
        for (let k = 1; k < 5; k++) box(s * (44 - 9 * s), k * 11, -70, 3, 0.8, 8, mat('#62a8c9'));   // blue ledges to climb
        poster(s * 35.8, 30, -70, 8, 10, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? 2 : 4);
      }
      box(0, 25, -70, 72, 1, 6, teal);
      for (const s of [-1, 1]) box(0, 26, -70 + s * 2.9, 72, 0.15, 0.15, brass, false);
      for (let k = 0; k < 9; k++) { const x = -32 + k * 8; for (const s of [-1, 1]) box(x, 26, -70 + s * 2.9, 0.15, 1.1, 0.15, ink, false); }
      // the broadcast tower at the end of the street, fallen silent
      {
        const z = -98;
        box(0, 0, z, 12, 62, 14, teal);
        for (let k = 1; k < 6; k++) { box(0, k * 10.5, z, 15, 0.8, 17, ink); poster(0, k * 10.5 + 4, z + 7.3, 7, 4, 0, k); }
        box(0, 62, z, 18, 1, 18, cream);
        box(0, 63, z - 4, 3, 1.4, 2, coral);
        kit.add(brass, new THREE.CylinderGeometry(0.2, 0.4, 16, 6).translate(0, 71, z), { solid: false });
        kit.add(glow, new THREE.SphereGeometry(1.1, 12, 8).translate(0, 79.5, z), { solid: false, shadow: false });
        kit.light(0, 79, z, 20);
      }
      // a lavender quiet-folk statue on the square
      {
        const x = 10, z = -54;
        box(x, 0, z, 3, 0.6, 3, cream);
        kit.add(lilac, new THREE.SphereGeometry(1, 16, 12).scale(1, 1.5, 1).translate(x, 2.1, z));
        kit.add(lilac, new THREE.SphereGeometry(0.7, 16, 12).translate(x, 4, z));
        kit.add(dark, new THREE.BoxGeometry(0.9, 0.12, 0.2).translate(x, 4.1, z + 0.65), { solid: false });
      }
    },
  },
];

/** Reeds (or crystal reeds) crowding the waterline: one instanced mesh, where ok(height) says. */
function reeds(kit, ok, colors, N, { glow = 0, thin = 0.09 } = {}) {
  const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(thin, 1, 4).translate(0, 0.5, 0), kit.mat({ color: '#ffffff', ...(glow ? { glow } : {}) }), N);
  const d = new THREE.Object3D(), col = new THREE.Color();
  let n = 0;
  for (let tries = 0; tries < N * 6 && n < N; tries++) {
    const cx = kit.R(-110, 110), cz = kit.R(-110, 110), h0 = kit.H(cx, cz);
    if (!ok(h0) || r2(cx, cz) > 115 || (Math.abs(cx) < 12 && cz > 55)) continue;
    for (let k = 0; k < 10 && n < N; k++) {
      const x = cx + kit.R(-2, 2), z = cz + kit.R(-2, 2);
      d.position.set(x, kit.H(x, z) - 0.2, z);
      d.rotation.set(kit.R(-0.17, 0.17), 0, kit.R(-0.17, 0.17));
      d.scale.set(1, kit.R(1.6, 4.4), 1);
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      mesh.setColorAt(n++, col.set(kit.pick(colors)));
    }
  }
  mesh.count = n;
  mesh.userData.noCollide = true;
  kit.group.add(mesh);
  kit.noShadow.push(mesh);
}

export const roomById = (id) => ROOMS.find((r) => r.id === id);
