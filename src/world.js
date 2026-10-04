import { OBSERVATORY } from './observatory.js';
import { SITES, POLE_LINE, STORY, processionLoop } from './desert-sites.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep, lerp } from './noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from './materials.js';
import { Banner } from './life.js';
import { biomeWeights } from './biome.js';

export const WORLD_SIZE = 4000;
const noise = createNoise2D(7);
const noiseB = createNoise2D(1337);

// ------------------------------------------------------------------ terrain

// Dune and canyon-ridge relief before smoothing: domain-warped ridged noise,
// elongated along one axis. Ridged noise has a crease at every crest, so it is
// only ever read through the blurred grid below.
function rawRelief(x, z) {
  const warp = noiseB(x * 0.0025, z * 0.0025) * 60;
  const ridge = 1 - Math.abs(noise((x + warp) * 0.004, (z * 0.45 + warp) * 0.004));
  const duneMask = smoothstep(-0.35, 0.35, noiseB(x * 0.0007 + 40, z * 0.0007 - 12));
  let h = Math.pow(ridge, 2.5) * 24 * duneMask;
  // rose canyons get taller ridges of their own
  const rose = biomeWeights(x, z).rose;
  if (rose > 0) h += Math.pow(1 - Math.abs(noiseB(x * 0.0045 - 9, z * 0.0045 + 4)), 3) * 28 * rose;
  return h;
}

// The relief is sampled on an 8 m grid and Gaussian-blurred (σ = 40 m), which
// rounds every crest into a soft, long Sable dune: the curvature stays low
// enough that the hoverbike's hover spring holds it to the sand at full speed
// (tests/dunes.test.js). Built lazily, so other worlds never pay for it.
export const DUNE_BLUR = 40;
const RELIEF_STEP = 8, RELIEF_HALF = WORLD_SIZE / 2, RELIEF_N = RELIEF_HALF * 2 / RELIEF_STEP + 1;
let reliefGrid = null;
function buildRelief() {
  const N = RELIEF_N, g = new Float32Array(N * N), tmp = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) g[j * N + i] = rawRelief(-RELIEF_HALF + i * RELIEF_STEP, -RELIEF_HALF + j * RELIEF_STEP);
  const s = DUNE_BLUR / RELIEF_STEP, R = Math.ceil(s * 3), w = new Float32Array(2 * R + 1);
  let sum = 0;
  for (let k = -R; k <= R; k++) sum += (w[k + R] = Math.exp(-k * k / (2 * s * s)));
  for (let k = 0; k < w.length; k++) w[k] /= sum;
  const clampI = (i) => Math.min(N - 1, Math.max(0, i));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let v = 0; for (let k = -R; k <= R; k++) v += w[k + R] * g[j * N + clampI(i + k)]; tmp[j * N + i] = v;
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let v = 0; for (let k = -R; k <= R; k++) v += w[k + R] * tmp[clampI(j + k) * N + i]; g[j * N + i] = v;
  }
  return g;
}
// Catmull-Rom, so the sampled relief stays smooth between grid points
const cubic = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
export function duneRelief(x, z) {
  const g = reliefGrid ??= buildRelief(), N = RELIEF_N;
  const fx = Math.min(Math.max((x + RELIEF_HALF) / RELIEF_STEP, 1), N - 3);
  const fz = Math.min(Math.max((z + RELIEF_HALF) / RELIEF_STEP, 1), N - 3);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const row = (r) => cubic(g[r * N + i - 1], g[r * N + i], g[r * N + i + 1], g[r * N + i + 2], tx);
  return cubic(row(j - 1), row(j), row(j + 1), row(j + 2), tz);
}

// Sites that need level ground: the dune and ridge relief fades out around them.
export const CALM_SITES = [
  { x: OBSERVATORY.x, z: OBSERVATORY.z, r: 40, fade: 70 },
  ...Object.values(SITES).filter((s) => s.calm).map((s) => ({ x: s.x, z: s.z, r: s.r * 0.75, fade: 70 })),
];
function calm(x, z) {
  let k = 1;
  for (const c of CALM_SITES) k *= smoothstep(c.r, c.r + c.fade, Math.hypot(x - c.x, z - c.z));
  return k;
}

export function heightFn(x, z) {
  // Large rolling basins (three octaves: a fourth one only added lumps that
  // threw the bike).
  let h = fbm(noise, x * 0.0011, z * 0.0011, 3) * 56;

  // Dunes and canyon ridges: soft, rounded crests.
  h += duneRelief(x, z) * calm(x, z);

  // Small ripples.
  h += noiseB(x * 0.02, z * 0.02) * 0.5;

  // Regions: salt flats are nearly flat (rose canyon ridges are in the relief).
  const bw = biomeWeights(x, z);
  if (bw.salt > 0) h = lerp(h, h * 0.15 + fbm(noise, x * 0.004, z * 0.004, 2) * 2, bw.salt);

  // Flatter, calmer area around the spawn point.
  const d = Math.hypot(x, z);
  h *= lerp(0.25, 1, smoothstep(25, 160, d));

  // A ring of far mountains to close the horizon.
  const edge = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(1300, 1950, edge) * (55 + fbm(noise, x * 0.004, z * 0.004, 3) * 45);   // low, so the cloud bank shows above
  return h;
}

export class Terrain {
  /**
   * @param {object} [o]
   * @param {(x: number, z: number) => number} [o.height] height function
   * @param {object} [o.material] makeMaterial options (terrain mode)
   */
  constructor({ size = WORLD_SIZE, seg = 560, height = heightFn, material } = {}) {
    this.size = size;
    this.seg = seg;
    this.step = size / seg;
    const n = seg + 1;
    this.n = n;
    this.heights = new Float32Array(n * n);
    const pos = new Float32Array(n * n * 3);
    const half = size / 2;
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const x = -half + ix * this.step;
        const z = -half + iz * this.step;
        const h = height(x, z);
        const i = iz * n + ix;
        this.heights[i] = h;
        pos[i * 3] = x;
        pos[i * 3 + 1] = h;
        pos[i * 3 + 2] = z;
      }
    }
    const idx = new Uint32Array(seg * seg * 6);
    let k = 0;
    for (let iz = 0; iz < seg; iz++) {
      for (let ix = 0; ix < seg; ix++) {
        const a = iz * n + ix, b = a + 1, c = a + n, d = c + 1;
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    this.mesh = new THREE.Mesh(
      geo,
      makeMaterial(material ?? {
        color: '#efd29b', color2: '#f5e1b6', color3: '#dca57a', mode: MODE_TERRAIN, biomes: true, ripples: true, sandInk: true,
      })
    );
    // the heightfield has an exact lookup, so it stays out of the mesh collision
    this.mesh.userData.noCollide = true;
  }

  // Exact height of the rendered triangle mesh (matches the index layout above).
  heightAt(x, z) {
    const half = this.size / 2;
    let fx = (x + half) / this.step, fz = (z + half) / this.step;
    fx = Math.min(Math.max(fx, 0), this.seg - 1e-4);
    fz = Math.min(Math.max(fz, 0), this.seg - 1e-4);
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const n = this.n, H = this.heights;
    const h00 = H[iz * n + ix], h10 = H[iz * n + ix + 1];
    const h01 = H[(iz + 1) * n + ix], h11 = H[(iz + 1) * n + ix + 1];
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }

  // Lowest ground under a footprint, so props don't float on slopes.
  baseAt(x, z, r) {
    let m = this.heightAt(x, z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m = Math.min(m, this.heightAt(x + Math.cos(a) * r, z + Math.sin(a) * r));
    }
    return m;
  }
}

// ------------------------------------------------------------------ helpers

// Deterministic per-position jitter so duplicated seam/cap vertices stay welded.
export function jitter(geo, amount, freq, seed = 0, vertical = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = Math.atan2(z, x);
    const k = 1 + amount * noise(Math.cos(a) * 1.7 + seed + y * freq, Math.sin(a) * 1.7 - seed + y * freq * 0.7);
    p.setXYZ(i, x * k, y + vertical * noiseB(x * 0.1 + seed, z * 0.1), z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Organic softening: a gentle belly along the height (and a slight sag at the
 * top) so cylinders read as drawn forms rather than CAD primitives.
 */
export function soften(geo, bulge = 0.08, sag = 0.0) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - min.y) / Math.max(max.y - min.y, 1e-6);
    const k = 1 + bulge * Math.sin(Math.PI * Math.min(t * 1.15, 1));
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
    if (sag) p.setY(i, p.getY(i) - sag * t * t * Math.hypot(p.getX(i), p.getZ(i)) * 0.05);
  }
  geo.computeVertexNormals();
  return geo;
}

// Terraced radius profile: each "step" of the mesa shrinks a bit.
export function terrace(geo, height, steps, shrink) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = Math.floor(((y + height / 2) / height) * steps * 0.999) / steps;
    const k = 1 - shrink * t;
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  return geo;
}

const PALETTES = [
  ['#e7a07f', '#c97b63', '#f1c9a0'], // dusty pink
  ['#e6b86f', '#c98f52', '#f2d7a2'], // ochre
  ['#bea6cf', '#9c86b7', '#dccbe0'], // lavender
  ['#ec9b6b', '#d27a58', '#f6d2b0'], // burnt orange
];

function strataMat(rng, size) {
  const p = PALETTES[Math.floor(rng() * PALETTES.length)];
  return makeMaterial({ color: p[0], color2: p[1], color3: p[2], mode: MODE_STRATA, flat: true, strataSize: size });
}

// ------------------------------------------------------------------ world

export function buildWorld(scene, terrain) {
  const rng = mulberry32(42);
  const footprints = [{ x: -430, z: -180, r: 120 }, { x: -430, z: -470, r: 90 }, { x: OBSERVATORY.x, z: OBSERVATORY.z, r: OBSERVATORY.radius }]; // { x, z, r }: keeps props from overlapping when placed
  // the hand-built landmarks of src/desert-landmarks.js
  for (const s of Object.values(SITES)) footprints.push({ x: s.x, z: s.z, r: s.r });
  for (let i = 0; i <= 8; i++) {
    const [[ax, az], [bx, bz]] = POLE_LINE;
    footprints.push({ x: ax + (bx - ax) * i / 8, z: az + (bz - az) * i / 8, r: 6 });
  }
  // The story's places (the old city, its camps, the giant's skull, the
  // procession's circuit): scattered props that would land there are simply
  // not added. Placement itself is unchanged (same random draws, same
  // footprints), so the rest of the desert stays exactly as it was.
  const storyClear = [
    { x: STORY.city.x, z: STORY.city.z, r: 150 }, { x: STORY.camps.x, z: STORY.camps.z, r: 70 },
    { x: STORY.giant.x, z: STORY.giant.z, r: 70 }, { x: STORY.pilgrim.x, z: STORY.pilgrim.z, r: 18 },
  ];
  for (const [x, z] of processionLoop(10)) storyClear.push({ x, z, r: 12 });
  const story = (x, z, r = 0) => { for (const c of storyClear) if ((c.x - x) ** 2 + (c.z - z) ** 2 < (c.r + r) ** 2) return true; return false; };
  const addProp = (m, x, z, r) => { if (!story(x, z, r)) scene.add(m); };
  const floaters = [];  // { obj, baseY, phase }
  const banners = [];
  const lights = [];    // glowing things that light their surroundings at night
  const doors = [];     // doorways into interiors

  scene.add(terrain.mesh);

  const free = (x, z, r) => {
    if (Math.hypot(x, z) < 190 + r) return false;
    if (Math.max(Math.abs(x), Math.abs(z)) > 1500) return false;
    for (const c of footprints) if (Math.hypot(c.x - x, c.z - z) < c.r + r + 10) return false;
    return true;
  };
  // pref(weights) -> acceptance probability, so props cluster by region
  const randomSpot = (r, pref = () => 1, tries = 80) => {
    for (let i = 0; i < tries; i++) {
      const x = (rng() * 2 - 1) * 1450, z = (rng() * 2 - 1) * 1450;
      if (rng() > pref(biomeWeights(x, z))) continue;
      if (free(x, z, r)) return [x, z];
    }
    return null;
  };
  const canyon = (w) => 0.35 + 0.65 * w.rose - 0.25 * w.salt;   // mesas, arches, mushrooms
  const flats = (w) => 0.3 + 0.7 * w.salt;                       // monoliths, skeletons

  // ---------------------------------------------------------- mesas
  function mesa(x, z, radius, height) {
    const geo = new THREE.CylinderGeometry(radius * 0.8, radius, height, 13, 8);
    terrace(geo, height, 3 + Math.floor(rng() * 3), 0.25 + rng() * 0.2);
    jitter(geo, 0.16, 0.012, rng() * 100);
    const m = new THREE.Mesh(geo, strataMat(rng, 3 + rng() * 4));
    const base = terrain.baseAt(x, z, radius);
    m.position.set(x, base + height / 2 - 2, z);
    m.rotation.y = rng() * Math.PI;
    addProp(m, x, z, radius);
    footprints.push({ x, z, r: radius * 1.02 });
  }

  // ---------------------------------------------------------- mushroom rocks
  function mushroom(x, z, s) {
    const stemH = 18 * s + rng() * 14 * s;
    const stem = new THREE.CylinderGeometry(2.2 * s, 4.5 * s, stemH, 9, 5);
    stem.translate(0, stemH / 2, 0);
    jitter(stem, 0.2, 0.08, rng() * 100);
    const capR = (8 + rng() * 6) * s, capH = (4 + rng() * 3) * s;
    const cap = new THREE.CylinderGeometry(capR * 0.85, capR * 0.55, capH, 11, 2);
    jitter(cap, 0.18, 0.1, rng() * 100);
    cap.translate((rng() - 0.5) * 2 * s, stemH + capH / 2 - 0.5, (rng() - 0.5) * 2 * s);
    const g = mergeGeometries([stem, cap]);
    const m = new THREE.Mesh(g, strataMat(rng, 1.6 + rng() * 2));
    m.position.set(x, terrain.baseAt(x, z, 4 * s) - 1, z);
    m.rotation.set((rng() - 0.5) * 0.12, rng() * Math.PI, (rng() - 0.5) * 0.12);
    addProp(m, x, z, capR);
    footprints.push({ x, z, r: 4.2 * s });
  }

  // ---------------------------------------------------------- arches
  function arch(x, z, R, tube) {
    const g = new THREE.TorusGeometry(R, tube, 7, 22, Math.PI);
    // Thicker legs, thinner keystone.
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const a = Math.atan2(vy, vx);
      const cx = Math.cos(a) * R, cy = Math.sin(a) * R;
      const k = 1.35 - 0.6 * Math.sin(Math.max(a, 0));
      p.setXYZ(i, cx + (vx - cx) * k, cy + (vy - cy) * k, vz * k);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, strataMat(rng, 2.5 + rng() * 2));
    const rot = rng() * Math.PI;
    m.position.set(x, terrain.baseAt(x, z, R) - tube, z);
    m.rotation.y = rot;
    addProp(m, x, z, R + tube);
    const ca = Math.cos(rot), sa = Math.sin(rot);
    footprints.push({ x: x + ca * R, z: z - sa * R, r: tube * 1.35 });
    footprints.push({ x: x - ca * R, z: z + sa * R, r: tube * 1.35 });
  }

  // ---------------------------------------------------------- giant ribcage
  const boneMat = makeMaterial({ color: '#f2ead6' });
  function ribcage(x, z, s, rot) {
    const geos = [];
    const len = 120 * s;
    const ribs = 11;
    const spinePts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      spinePts.push(new THREE.Vector3((t - 0.5) * len, 40 * s * Math.sin(Math.PI * (0.15 + t * 0.7)) + 4 * s, 0));
    }
    const spine = new THREE.CatmullRomCurve3(spinePts);
    geos.push(new THREE.TubeGeometry(spine, 60, 2.8 * s, 8, false));
    for (let i = 0; i < ribs; i++) {
      const t = 0.12 + (i / (ribs - 1)) * 0.76;
      const top = spine.getPoint(t);
      const k = Math.sin(Math.PI * t) * 0.8 + 0.2;
      for (const side of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([
          top.clone(),
          new THREE.Vector3(top.x, top.y * 0.92, side * 16 * s * k),
          new THREE.Vector3(top.x - 3 * s, top.y * 0.55, side * 26 * s * k),
          new THREE.Vector3(top.x - 5 * s, -3 * s, side * 24 * s * k),
        ]);
        geos.push(new THREE.TubeGeometry(curve, 24, 1.6 * s * (0.6 + k * 0.5), 6, false));
      }
      // vertebra
      const v = new THREE.SphereGeometry(4 * s, 8, 6);
      v.scale(0.7, 1, 1.1);
      v.translate(top.x, top.y + 2.5 * s, 0);
      geos.push(v);
    }
    // skull + tusks at the head end
    const head = spine.getPoint(1);
    const skull = new THREE.SphereGeometry(12 * s, 12, 9);
    skull.scale(1.5, 0.8, 0.9);
    skull.translate(head.x + 14 * s, head.y - 2 * s, 0);
    geos.push(skull);
    for (const side of [-1, 1]) {
      const tusk = new THREE.CatmullRomCurve3([
        new THREE.Vector3(head.x + 22 * s, head.y - 6 * s, side * 6 * s),
        new THREE.Vector3(head.x + 38 * s, head.y - 14 * s, side * 14 * s),
        new THREE.Vector3(head.x + 52 * s, head.y - 4 * s, side * 12 * s),
        new THREE.Vector3(head.x + 56 * s, head.y + 10 * s, side * 6 * s),
      ]);
      geos.push(new THREE.TubeGeometry(tusk, 20, 1.8 * s, 6, false));
    }
    const m = new THREE.Mesh(mergeGeometries(geos), boneMat);
    m.position.set(x, terrain.baseAt(x, z, 30 * s) - 1, z);
    m.rotation.y = rot;
    addProp(m, x, z, 70 * s);
    // footprints of the rib feet
    const ca = Math.cos(rot), sa = Math.sin(rot);
    for (let i = 0; i < ribs; i++) {
      const t = 0.12 + (i / (ribs - 1)) * 0.76;
      const k = Math.sin(Math.PI * t) * 0.8 + 0.2;
      const lx = (t - 0.5) * len - 5 * s;
      for (const side of [-1, 1]) {
        const lz = side * 24 * s * k;
        footprints.push({ x: x + lx * ca + lz * sa, z: z - lx * sa + lz * ca, r: 2 * s });
      }
    }
  }

  // ---------------------------------------------------------- monolith rings
  const stoneMats = [
    makeMaterial({ color: '#f3ead8', flat: true, grid: 2.5, glyphs: true }),
    makeMaterial({ color: '#58b4a8', flat: true, grid: 2.5, glyphs: true }),
    makeMaterial({ color: '#e57f5b', flat: true, grid: 2.5, glyphs: true }),
  ];
  function monoliths(x, z, R) {
    const count = 7 + Math.floor(rng() * 6);
    for (let i = 0; i < count; i++) {
      if (rng() < 0.15) continue; // missing stones
      const a = (i / count) * Math.PI * 2;
      const px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
      const h = 14 + rng() * 18;
      const g = new THREE.BoxGeometry(4 + rng() * 2, h, 2.5 + rng());
      g.translate(0, h / 2, 0);
      const m = new THREE.Mesh(g, stoneMats[rng() < 0.75 ? 0 : 1 + Math.floor(rng() * 2)]);
      m.position.set(px, terrain.baseAt(px, pz, 3) - 1.5, pz);
      m.rotation.set((rng() - 0.5) * 0.25, -a + Math.PI / 2, (rng() - 0.5) * 0.25);
      addProp(m, px, pz, 3);
      footprints.push({ x: px, z: pz, r: 3 });
    }
    // prayer banners on two poles
    for (let k = 0; k < 2; k++) {
      const a = rng() * Math.PI * 2, px = x + Math.cos(a) * (R + 6), pz = z + Math.sin(a) * (R + 6);
      const base = terrain.heightAt(px, pz);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 12, 5).translate(0, 6, 0), makeMaterial({ color: '#34405e' }));
      pole.position.set(px, base - 0.5, pz);
      const bannerColor = ['#d9643a', '#58b4a8', '#f2c54b'][Math.floor(rng() * 3)];
      if (story(px, pz, 2)) continue;
      scene.add(pole);
      banners.push(new Banner(scene, new THREE.Vector3(px + 0.2, base + 11.5, pz), a + Math.PI / 2,
        { width: 1.6, height: 6, color: bannerColor }));
    }
    // central altar sphere
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(4, 1), makeMaterial({ color: '#58b4a8', flat: true, glow: 0.5 }));
    orb.position.set(x, terrain.heightAt(x, z) + 9, z);
    if (story(x, z, R)) return;
    lights.push(new THREE.Vector4(x, orb.position.y, z, 22));
    scene.add(orb);
    orb.userData.noCollide = true; // bobbing
    floaters.push({ obj: orb, baseY: orb.position.y, phase: rng() * 10, amp: 1.2, spin: 0.3 });
  }

  // ---------------------------------------------------------- floating islands
  function floater(x, z, r) {
    const h = r * (1.4 + rng());
    const g = new THREE.ConeGeometry(r, h, 9, 4);
    g.rotateX(Math.PI);
    g.translate(0, -h / 2, 0);
    jitter(g, 0.22, 0.05, rng() * 100);
    const parts = [g];
    if (rng() < 0.6) {
      const tower = new THREE.CylinderGeometry(r * 0.12, r * 0.18, r * 1.4, 6);
      tower.translate((rng() - 0.5) * r * 0.6, r * 0.7, (rng() - 0.5) * r * 0.6);
      parts.push(tower);
    }
    const m = new THREE.Mesh(mergeGeometries(parts), strataMat(rng, 2 + rng() * 2));
    const y = terrain.heightAt(x, z) + 70 + rng() * 90;
    m.position.set(x, y, z);
    m.rotation.y = rng() * Math.PI;
    scene.add(m);
    m.userData.noCollide = true; // bobbing
    floaters.push({ obj: m, baseY: y, phase: rng() * 10, amp: 3, spin: 0.01 });
  }

  // ---------------------------------------------------------- dome city
  function domeCity(x, z) {
    const white = makeMaterial({ color: '#f6efe0', grid: 4 });
    const teal = makeMaterial({ color: '#5fb7ad', grid: 4 });
    const orange = makeMaterial({ color: '#e6875f', grid: 4 });
    const mats = [white, white, teal, orange];
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, d = rng() * 110;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const kind = rng();
      if (kind < 0.5) {
        const r = 8 + rng() * 20;
        const g = new THREE.SphereGeometry(r, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2);
        const m = new THREE.Mesh(g, mats[Math.floor(rng() * mats.length)]);
        m.position.set(px, terrain.baseAt(px, pz, r) - 1, pz);
        m.scale.y = 0.6 + rng() * 0.6;
        scene.add(m);
        footprints.push({ x: px, z: pz, r });
      } else {
        const h = 40 + rng() * 90;
        const r = 1.5 + rng() * 2.5;
        const parts = [new THREE.CylinderGeometry(r * 0.7, r, h, 8).translate(0, h / 2, 0)];
        const bulb = new THREE.SphereGeometry(r * (2 + rng() * 2), 12, 8);
        bulb.scale(1, 0.7, 1);
        parts.push(bulb.translate(0, h, 0));
        parts.push(new THREE.CylinderGeometry(0.25, 0.25, 14, 4).translate(0, h + 10, 0));
        const m = new THREE.Mesh(mergeGeometries(parts), mats[Math.floor(rng() * mats.length)]);
        m.position.set(px, terrain.baseAt(px, pz, r) - 1, pz);
        scene.add(m);
        footprints.push({ x: px, z: pz, r: r + 0.5 });
      }
    }
  }

  // ---------------------------------------------------------- hero: the sleeping mask
  // A colossal masked head half-buried in the sand, framed through the arch
  // when you look out from the start.
  function sleepingMask(x, z) {
    const base = terrain.baseAt(x, z, 30);
    const grp = new THREE.Group();
    const head = new THREE.Mesh(soften(new THREE.SphereGeometry(34, 26, 18).scale(1, 1.2, 0.95), 0.03),
      makeMaterial({ color: '#d9a477', color2: '#c98f5f', color3: '#e9c49a', mode: MODE_STRATA, strataSize: 6, flat: true }));
    const mask = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16).scale(0.92, 1.18, 0.5),
      makeMaterial({ color: '#f3ead8', flat: true }));
    mask.position.set(0, 2, 20);
    const dark = makeMaterial({ color: '#34405e', flat: true });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(11, 2.6, 6), dark);
      eye.position.set(side * 10, 9, 33.5);
      eye.rotation.z = side * -0.12;
      grp.add(eye);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 20, 5), makeMaterial({ color: '#e9dcc0', flat: true }));
    ridge.position.set(0, -1, 34.5);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(9, 12, 6), dark); // a doorway into the head
    mouth.position.set(0, -22, 30);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(9, 40, 8).rotateX(-0.5), makeMaterial({ color: '#c8483a', flat: true }));
    crest.position.set(0, 44, -8);
    grp.add(head, mask, ridge, mouth, crest);
    grp.position.set(x, base + 14, z);   // chin in the sand, the whole face clear of the dunes
    grp.rotation.set(-0.05, 0.75, 0.12);
    // a carved doorway in the sand in front of the face leads inside
    const fx = Math.sin(0.75), fz = Math.cos(0.75), dx = x + fx * 40, dz = z + fz * 40;
    doors.push({ at: new THREE.Vector3(dx, terrain.heightAt(dx, dz), dz), heading: 0.75, name: 'head' });   // face turned toward the morning sun (east)
    scene.add(grp);
    footprints.push({ x, z, r: 40 });
  }
  sleepingMask(-20, -400);

  // ---------------------------------------------------------- landmarks near spawn
  // the start is an open plain (like the print): landmarks stand back from it
  ribcage(150, -210, 1, 0.5);
  monoliths(-170, -120, 22);
  arch(-10, -260, 34, 6);
  mesa(-260, -330, 50, 90);
  mesa(230, -380, 38, 70);
  domeCity(520, -620);

  // ---------------------------------------------------------- scattered
  for (let i = 0; i < 52; i++) { const s = randomSpot(60, canyon); if (s) mesa(s[0], s[1], 25 + rng() * 45, 40 + rng() * 110); }
  for (let i = 0; i < 46; i++) { const s = randomSpot(12, canyon); if (s) mushroom(s[0], s[1], 0.7 + rng() * 1.2); }
  for (let i = 0; i < 14; i++) { const s = randomSpot(40, canyon); if (s) arch(s[0], s[1], 22 + rng() * 26, 4 + rng() * 4); }
  for (let i = 0; i < 5; i++) { const s = randomSpot(80, flats); if (s) ribcage(s[0], s[1], 0.8 + rng() * 0.8, rng() * 6); }
  for (let i = 0; i < 12; i++) { const s = randomSpot(30, flats); if (s) monoliths(s[0], s[1], 16 + rng() * 14); }
  for (let i = 0; i < 22; i++) { const x = (rng() * 2 - 1) * 1400, z = (rng() * 2 - 1) * 1400; floater(x, z, 12 + rng() * 26); }

  // ---------------------------------------------------------- instanced boulders & plants
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  {
    const N = 2800;
    const rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      makeMaterial({ color: '#ffffff', flat: true, pattern: 'cracks' }),
      N
    );
    const tones = ['#d9a07c', '#c98d70', '#e8c49a', '#b9a3c7'];
    for (let i = 0; i < N; i++) {
      // cluster rocks: pick a random centre, then jitter
      const x = (rng() * 2 - 1) * 1500, z = (rng() * 2 - 1) * 1500;
      const s = (0.4 + Math.pow(rng(), 3) * 6) * (Math.hypot(x, z) < 160 ? 0.25 : 1);   // only pebbles on the open plain
      dummy.position.set(x, terrain.heightAt(x, z) + s * 0.3, z);
      dummy.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      dummy.scale.set(s * (0.8 + rng() * 0.6), s * (0.5 + rng() * 0.5), s * (0.8 + rng() * 0.6));
      if (story(x, z, s)) dummy.scale.setScalar(0);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      rocks.setColorAt(i, color.set(tones[Math.floor(rng() * tones.length)]));
    }
    rocks.frustumCulled = false;
    scene.add(rocks);
  }
  {
    const N = 4000;
    const g = new THREE.ConeGeometry(0.25, 2.4, 5);
    g.translate(0, 1.2, 0);
    const plants = new THREE.InstancedMesh(g, makeMaterial({ color: '#ffffff', flat: true }), N);
    const tones = ['#6fa889', '#8fb57a', '#4f9a8f'];
    let i = 0;
    while (i < N) {
      const cx = (rng() * 2 - 1) * 1500, cz = (rng() * 2 - 1) * 1500;
      const tone = tones[Math.floor(rng() * tones.length)];
      const spikes = 4 + Math.floor(rng() * 5);
      const size = 0.6 + rng() * 1.4;
      for (let k = 0; k < spikes && i < N; k++, i++) {
        const x = cx + (rng() - 0.5) * 1.2, z = cz + (rng() - 0.5) * 1.2;
        dummy.position.set(x, terrain.heightAt(x, z) - 0.1, z);
        dummy.rotation.set((rng() - 0.5) * 1.1, rng() * 6, (rng() - 0.5) * 1.1);
        dummy.scale.setScalar(size * (0.6 + rng() * 0.6));
        if (story(x, z) && Math.hypot(x - STORY.city.x, z - STORY.city.z) < 80) dummy.scale.setScalar(0);   // the city's paving (the camps and dunes keep their tufts)
        dummy.updateMatrix();
        plants.setMatrixAt(i, dummy.matrix);
        plants.setColorAt(i, color.set(tone));
      }
    }
    plants.frustumCulled = false;
    plants.userData.noCollide = true; // walk through the grass
    scene.add(plants);
  }

  // ---------------------------------------------------------- ochre scrub
  // Sparse scrub leaves broad stretches of clean sand, as in the reference.
  {
    const lobes = [];
    for (let k = 0; k < 9; k++) {
      const a = k * 2.39996, r = 0.2 + 0.3 * Math.sqrt((k + 0.5) / 9);
      const g = new THREE.IcosahedronGeometry(0.24 + (k % 3) * 0.04, 0);
      g.translate(Math.cos(a) * r, 0.22 + (1 - r) * 0.42 + (k % 3) * 0.05, Math.sin(a) * r);
      lobes.push(g);
    }
    const geo = mergeGeometries(lobes.map((g) => (g.index ? g.toNonIndexed() : g)));
    geo.computeVertexNormals();
    const N = 1040;
    const bushes = new THREE.InstancedMesh(geo, makeMaterial({ color: '#ffffff', scrub: true }), N);
    const tones = ['#d9a441', '#c98a3a', '#e0b85a', '#c6743a', '#b9a24a'];
    for (let i = 0; i < N; i++) {
      const near = i < 90;
      const cx = near ? (rng() * 2 - 1) * 160 : (rng() * 2 - 1) * 1450, cz = near ? (rng() * 2 - 1) * 160 : (rng() * 2 - 1) * 1450;
      if (near && Math.hypot(cx, cz) < 9) { dummy.scale.setScalar(0); dummy.updateMatrix(); bushes.setMatrixAt(i, dummy.matrix); continue; }
      const s = 0.6 + Math.pow(rng(), 2) * 1.3;
      dummy.position.set(cx, terrain.heightAt(cx, cz) - 0.15 * s, cz);
      dummy.rotation.set((rng() - 0.5) * 0.2, rng() * 6, (rng() - 0.5) * 0.2);
      dummy.scale.set(s * (0.9 + rng() * 0.4), s * (0.6 + rng() * 0.35), s * (0.9 + rng() * 0.4));
      dummy.updateMatrix();
      bushes.setMatrixAt(i, dummy.matrix);
      bushes.setColorAt(i, color.set(tones[Math.floor(rng() * tones.length)]));
    }
    bushes.frustumCulled = false;
    bushes.userData.noCollide = true;
    scene.add(bushes);
  }

  // ---------------------------------------------------------- the saucer tower
  // a thin needle carrying a wide ribbed disc, hanging over the plain
  {
    const x = 160, z = -560, base = terrain.baseAt(x, z, 10);
    const pale = makeMaterial({ color: '#eef0ea', color2: '#cfd9e6', color3: '#b9c8dc', mode: MODE_STRATA, strataSize: 3, grid: 4 });
    const parts = [
      new THREE.CylinderGeometry(3, 7, 150, 14).translate(0, 75, 0),
      new THREE.CylinderGeometry(95, 26, 26, 48, 4).translate(0, 158, 0),          // disc underside
      new THREE.CylinderGeometry(70, 95, 6, 48).translate(0, 174, 0),              // rim
      new THREE.CylinderGeometry(18, 40, 14, 24).translate(0, 184, 0),
      new THREE.CylinderGeometry(1.5, 9, 120, 12).translate(0, 250, 0),             // spire
    ].map((g) => (g.index ? g.toNonIndexed() : g));
    const m = new THREE.Mesh(mergeGeometries(parts), pale);
    m.position.set(x, base - 2, z);
    scene.add(m);
    footprints.push({ x, z, r: 12 });
  }

  // ---------------------------------------------------------- the spired city on the horizon
  {
    const pale = makeMaterial({ color: '#eef0ea', color2: '#dfe4ea', color3: '#c4d0e0', mode: MODE_STRATA, strataSize: 6, grid: 6 });
    const cx = -520, cz = -950, parts = [];
    parts.push(new THREE.CylinderGeometry(120, 150, 22, 32).translate(0, 8, 0));
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * 110, h = 40 + Math.pow(rng(), 2) * 190, r = 4 + rng() * 9;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      parts.push(new THREE.CylinderGeometry(r * 0.55, r, h, 12).translate(x, h / 2, z));
      parts.push(new THREE.SphereGeometry(r * 0.9, 12, 8).scale(1, 1.3, 1).translate(x, h, z));
      parts.push(new THREE.ConeGeometry(r * 0.35, h * 0.35, 8).translate(x, h * 1.17 + r, z));
    }
    for (let i = 0; i < 10; i++) {
      const a = rng() * Math.PI * 2, d = 40 + rng() * 120, r = 14 + rng() * 22;
      parts.push(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(Math.cos(a) * d, 18, Math.sin(a) * d));
    }
    const m = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), pale);
    m.position.set(cx, terrain.baseAt(cx, cz, 60) - 4, cz);
    scene.add(m);
  }

  return { floaters, banners, lights, doors };
}
