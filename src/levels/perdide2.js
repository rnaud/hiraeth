import { attachTemple } from '../temples/index.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_WATER } from '../materials.js';
import { Terrain, jitter } from '../world.js';
import { Hoverbike } from '../bike.js';
import { KEEPERS } from '../story/perdide2-data.js';

// ---------------------------------------------------------------------------
// Lorn II: the Deep Wood. The far side of the swamp planet from
// Lorn II: a dusk forest of giant pale mushrooms among dark
// cathedral trunks, coral sky glimpsed between them. A lit path of glowing
// pools and egg heaps winds beside a teal stream, under enormous root arches,
// past moss domes and a crashed saucer pod, to a cave glowing coral inside,
// where a teal hover-skiff waits in the shallows.
// ---------------------------------------------------------------------------

const WATER = 0;
const DEEP = -1.6;              // deeper than this is unsafe on foot (the skiff floats; you swim)
const PATH_Y = 0.45;            // the dry path bank
const noise = createNoise2D(3797);
const noiseB = createNoise2D(3800);

// the lit path, from the spawn island south (-z, towards the low sun) to the cave
const PATH_PTS = [[0, -10], [4, -34], [-6, -70], [-22, -108], [-15, -148], [6, -188], [21, -228], [13, -268], [-9, -304], [-23, -340], [-19, -376], [-7, -408]];
const PATH = new THREE.CatmullRomCurve3(PATH_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
const N_PATH = 180;
const pathPts = PATH.getSpacedPoints(N_PATH);
const pathNrm = pathPts.map((_, i) => {
  const t = PATH.getTangentAt(i / N_PATH);
  return new THREE.Vector3(-t.z, 0, t.x).normalize();
});
// the stream weaves along the path, crossing it a few times (wading fords)
const streamOff = (u) => 10 * Math.sin(u * Math.PI * 4.6 + 0.9);
const streamPts = pathPts.map((p, i) => p.clone().addScaledVector(pathNrm[i], streamOff(i / N_PATH)));

function polyDist(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    if (Math.abs(x - mx) > best + 3 || Math.abs(z - mz) > best + 3) continue;
    const ex = b.x - a.x, ez = b.z - a.z, L = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L));
    const d = Math.hypot(x - a.x - ex * t, z - a.z - ez * t);
    if (d < best) best = d;
  }
  return best;
}
const pathDist = (x, z) => polyDist(pathPts, x, z);
const streamDist = (x, z) => polyDist(streamPts, x, z);

// hero places (module level, so the content can point at them)
export const CAVE = { x: -7, z: -432, len: 40, r: 8.5, T: 7, y: 0.4 };   // mouth at z = -412, facing +z
CAVE.mouth = CAVE.z + CAVE.len / 2;
const LAGOON = { x: 8, z: -403, r: 11 };
export const SKIFF = { x: 8, z: -404, heading: 0.35 };
const ISLAND = { x: 0, z: 2, r: 26, y: 1.8 };
export const SAUCER = { x: 58, z: -262, r: 7.5, y: -0.1, tilt: 0.2 };
const SAUCER_POOL = { x: 58, z: -262, r: 17 };
export const DOMES = [
  { x: -44, z: -126, R: 9, kind: 'moss' },
  { x: -33, z: -156, R: 6, kind: 'moss' },
  { x: 33, z: -176, R: 7.5, kind: 'moss' },
  { x: -6, z: -232, R: 10, kind: 'glass' },
  { x: 36, z: -300, R: 6.5, kind: 'moss' },
];
// root arches straddle path and stream; u = fraction along the path
export const ARCHES = [0.2, 0.33, 0.47, 0.6, 0.72, 0.85].map((u, k) => {
  const i = Math.round(u * N_PATH), p = pathPts[i], n = pathNrm[i], off = streamOff(i / N_PATH);
  const c = p.clone().addScaledVector(n, off / 2);
  return { x: c.x, z: c.z, nx: n.x, nz: n.z, span: 30 + Math.abs(off), apex: 13 + (k % 3) * 3, r: 2.6 + (k % 2) * 0.6 };
});
// the relic mushroom and its stepping-stool cluster
export const HERO_SHROOM = { x: -30, z: -40, H: 13.5, capR: 8, sr: 1.3, dome: 0.12 };
// the story's places (src/story/perdide2.js): three pools that went dark the night the sky rang,
// on the dry bank of the path (the side away from the stream), the far dome's landing stage where
// old Fen lives, and where Hollin waits at the end, by the cave mouth
export const DARK_POOLS = [0.264, 0.699, 0.916].map((u) => {
  const i = Math.round(u * N_PATH), p = pathPts[i], n = pathNrm[i], side = -Math.sign(streamOff(i / N_PATH)) || 1;
  return { x: p.x + n.x * side * 3.2, z: p.z + n.z * side * 3.2, r: 2.3, u };
});
export const FEN = { dome: 4, x: 36, z: -300 };
export const HOLLIN_END = { x: -14, z: -402 };
export const PATH_POINTS = pathPts;

function height(x, z) {
  // swamp floor: shallow mud flats and pools, with deeper channels for the skiff
  let h = fbm(noise, x * 0.004, z * 0.004, 3) * 2.6 - 0.7;
  const ch = 1 - Math.abs(noiseB(x * 0.0045, z * 0.0045));
  h -= Math.pow(ch, 6) * 4.5;
  h += fbm(noiseB, x * 0.03, z * 0.03, 2) * 0.35;
  const dp = pathDist(x, z);
  // around the path it's always wadeable
  if (dp < 30) h = Math.max(h, THREE.MathUtils.lerp(-1.35, h, smoothstep(18, 30, dp)));
  // the dry path bank
  h = THREE.MathUtils.lerp(h, PATH_Y + noise(x * 0.05, z * 0.05) * 0.12, smoothstep(9, 3.5, dp));
  // the stream: shallow teal water cutting through, wade across where it crosses
  const ds = streamDist(x, z);
  h = THREE.MathUtils.lerp(h, -1.0, smoothstep(5.5, 2.2, ds));
  // dry spawn island
  const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  h = Math.max(h, THREE.MathUtils.lerp(-2, ISLAND.y + noise(x * 0.04, z * 0.04) * 0.2, smoothstep(ISLAND.r + 14, ISLAND.r, di)));
  // the saucer's pool
  const dsp = Math.hypot(x - SAUCER_POOL.x, z - SAUCER_POOL.z);
  h = THREE.MathUtils.lerp(h, -1.2, smoothstep(SAUCER_POOL.r, SAUCER_POOL.r * 0.55, dsp));
  // flat ground at the cave and inside the tunnel
  const cdx = Math.abs(x - CAVE.x), cdz = Math.max(0, CAVE.z - CAVE.len / 2 - 4 - z, z - CAVE.mouth - 4);
  const cd = Math.hypot(Math.max(0, cdx - CAVE.r - CAVE.T - 2), cdz);
  h = THREE.MathUtils.lerp(h, CAVE.y, smoothstep(14, 0, cd));
  // the lagoon where the skiff waits
  const dl = Math.hypot(x - LAGOON.x, z - LAGOON.z);
  h = THREE.MathUtils.lerp(h, -1.1, smoothstep(LAGOON.r, LAGOON.r * 0.5, dl));
  // dense wooded hills close the world
  const edge = Math.hypot(x, (z + 200) * 0.85);
  h += smoothstep(560, 820, edge) * (55 + fbm(noise, x * 0.006, z * 0.006, 3) * 40);
  return h;
}

// a sleek teal speedboat with a dark windscreen (the reference's skiff)
function buildSkiff() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const teal = makeMaterial({ color: '#5fd6c4', flat: true, metal: 'painted' }), deep = makeMaterial({ color: '#3a9f94', flat: true, metal: 'painted' });
  // a long low hull, rounded at the stern, drawn out to a point at the bow
  const hullG = new THREE.CylinderGeometry(0.95, 0.95, 4.2, 14, 1).rotateX(Math.PI / 2).scale(1, 0.38, 1);
  const bowG = new THREE.SphereGeometry(0.95, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 0.38, 2.1).translate(0, 0, 2.1);
  const sternG = new THREE.SphereGeometry(0.95, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 0.38, 0.5).translate(0, 0, -2.1);
  const hull = new THREE.Mesh(mergeGeometries([hullG, bowG, sternG].map((g) => { g.deleteAttribute('uv'); return g.toNonIndexed(); })), teal);
  const keel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 4.6).translate(0, -0.3, 0.2), deep);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.95, 0.6, 1.6).translate(0, 0.3, 0.75), makeMaterial({ color: '#1d2a3a', flat: true }));
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.05, 4, 24).rotateX(Math.PI / 2).scale(1, 1, 2.6).translate(0, 0.05, 0.2), makeMaterial({ color: '#f3ead8', flat: true }));
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.9).translate(0, 0.5, -1.9), deep);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1, 16).rotateX(Math.PI / 2).scale(0.75, 1, 2).translate(0, -0.42, 0), makeMaterial({ color: '#9fe0d0', glow: 1 }));
  const seatAnchor = new THREE.Group();
  seatAnchor.position.set(0, -0.6, -0.6);
  body.add(hull, keel, canopy, stripe, fin, pad, seatAnchor);
  return { root, body, seatAnchor };
}

// mushroom profile: [r, y] pieces (stalk, gilled underside, cap top), radii in stalk units / cap units
export function shroomParts({ sr, capR, H, dome }) {
  const stalk = [[1.75 * sr, -0.04 * H], [1.6 * sr, 0.03 * H], [1.15 * sr, 0.12 * H], [0.85 * sr, 0.3 * H], [0.72 * sr, 0.55 * H], [0.7 * sr, 0.78 * H], [0.85 * sr, 0.87 * H], [1.2 * sr, 0.9 * H]];
  const top0 = 0.9 * H;
  const under = [[1.2 * sr, top0], [capR * 0.55, top0 - 0.015 * H], [capR * 0.92, top0 - 0.04 * H], [capR, top0 - 0.05 * H]];
  const D = capR * dome;
  const top = [[capR, top0 - 0.05 * H], [capR * 1.02, top0 - 0.02 * H], [capR * 0.88, top0 + D * 0.45], [capR * 0.6, top0 + D * 0.82], [capR * 0.3, top0 + D * 0.97], [0, top0 + D]];
  return { stalk, under, top, topY: top0 + D };
}
export const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

export const PERDIDE2_CONTENT = {
  weather: ['fog'],
  // the story is a quest (src/story/perdide2-data.js): this page opens on the first visit and
  // closes when Hollin, waiting at the root cave, asks you to come back one day
  story: {
    title: 'THE LAMPS ARE KEPT',
    intro: 'Under the pale mushrooms someone keeps the pools lit, all the way to the root cave. For whom?',
    outro: 'Every pool on the path is lit. Somebody came, at last, and somebody is asked to come back.',
    label: 'the root cave', goal: [CAVE.x, 'ground', CAVE.mouth - 8], radius: 9, manual: true,
  },
  relics: {
    spots: [
      { at: [HERO_SHROOM.x, shroomParts(HERO_SHROOM).topY - 0.2 + 1.1, HERO_SHROOM.z], snap: true },
      { at: [DOMES[0].x, DOMES[0].R * 0.72 - 0.1 + 1.1, DOMES[0].z], snap: true },
      { at: [SAUCER.x, SAUCER.y + 2.6 + 1.1, SAUCER.z], snap: true },
      { at: [ARCHES[2].x, ARCHES[2].apex + ARCHES[2].r + 1.1, ARCHES[2].z], snap: true },
      { at: [CAVE.x, CAVE.y + 1.1, CAVE.z - 6] },
    ],
    names: ['Spore cap', 'Dome moss', 'Saucer beacon', 'Root-arch knot', 'Ember from the cave'],
  },
  // Hollin on the island, Pim by the moss domes, Bram at the cave mouth (with their conversations)
  npcs: KEEPERS,
};

export function createPerdide2(scene) {
  const rng = mulberry32(3798);
  const R = (a, b) => a + rng() * (b - a);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  const terrain = new Terrain({
    size: 1800, seg: 360, height,
    material: { color: '#46686e', color2: '#517676', color3: '#55588a', mode: MODE_TERRAIN, ticks: true },   // teal moss, violet mud
  });
  scene.add(terrain.mesh);
  const H = (x, z) => terrain.heightAt(x, z);
  const lights = [];
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const proxies = [];   // coarse collision stand-ins for detailed scenery (invisible)
  // places scatter keeps clear of
  const keepOut = [
    { x: ISLAND.x, z: ISLAND.z, r: 14 }, { x: SAUCER.x, z: SAUCER.z, r: 11 }, { x: LAGOON.x, z: LAGOON.z, r: 12 },
    { x: CAVE.x, z: CAVE.z, r: 34 }, { x: HERO_SHROOM.x, z: HERO_SHROOM.z, r: 16 },
    ...DOMES.map((d) => ({ x: d.x, z: d.z, r: d.R + 4 })),
  ];
  const clear = (x, z, pad = 0) => keepOut.every((k) => Math.hypot(x - k.x, z - k.z) > k.r + pad);
  const inst = (geo, mat, list, { collide = false } = {}) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(list.length, 1));
    list.forEach(([mx, c], i) => { m.setMatrixAt(i, mx); m.setColorAt(i, col.set(c)); });
    m.count = list.length;
    if (!collide) m.userData.noCollide = true;
    scene.add(m);
    return m;
  };
  const place = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
    dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    return dummy.matrix.clone();
  };

  // ---------------------------------------------------------- water
  {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800, 1, 1).rotateX(-Math.PI / 2),
      makeMaterial({ color: '#4f8a8f', color2: '#5f9a9a', mode: MODE_WATER }));
    water.position.y = WATER;
    water.userData.noCollide = true;
    scene.add(water);
  }

  // ---------------------------------------------------------- cathedral trunks
  // very tall, dark, straight trunks rising out of frame
  {
    const parts = { '#2f3a4f': [], '#3a4560': [], '#28324a': [] };
    const coll = [];
    let n = 0;
    for (let tries = 0; tries < 6000 && n < 420; tries++) {
      const far = rng() < 0.3;
      const x = R(-1, 1) * (far ? 760 : 420), z = -200 + R(-1, 1) * (far ? 700 : 330);
      const dp = pathDist(x, z);
      if (dp < 13 || streamDist(x, z) < 7 || !clear(x, z, 3)) continue;
      // denser near the path, so they frame it like a nave
      if (dp > 60 && rng() < 0.45) continue;
      const r = R(1.6, 4.2) * (dp > 80 ? 1.3 : 1), Ht = R(110, 170), g0 = H(x, z);
      const trunk = new THREE.CylinderGeometry(r * 0.82, r, Ht, 10, 4, true).translate(0, Ht / 2, 0);
      jitter(trunk, 0.1, 0.05, n);
      const flare = lathe([[r * 2.3, -1.5], [r * 1.7, 0.6], [r * 1.25, 2.6], [r * 1.02, 5.5]], 10);
      jitter(flare, 0.18, 0.2, n);
      const ry = rng() * 6;
      for (const g of [trunk, flare]) { g.rotateY(ry).translate(x, g0 - 0.5, z); g.deleteAttribute('uv'); }
      pick(Object.values(parts)).push(trunk.toNonIndexed(), flare.toNonIndexed());
      coll.push(new THREE.CylinderGeometry(r * 0.9, r * 1.4, Ht, 6, 1, true).translate(x, g0 + Ht / 2 - 0.5, z));
      n++;
    }
    for (const [c, l] of Object.entries(parts)) {
      const m = new THREE.Mesh(mergeGeometries(l), makeMaterial({ color: c, flat: true, pattern: 'cracks' }));
      m.userData.noCollide = true;
      scene.add(m);
    }
    proxies.push(...coll);
  }

  // ---------------------------------------------------------- giant pale mushrooms
  const shroomGeo = { stalk: {}, under: {}, top: {} };
  const STALK = ['#b9b3d9', '#a49cc8', '#c3bde2'];
  function shroom(x, z, s, { glow = false, sink = 0.6, tilt = 0.12, seed = 0 } = {}) {
    const g0 = H(x, z);
    const parts = shroomParts(s);
    const rx = R(-tilt, tilt), rz = R(-tilt, tilt), ry = rng() * 6;
    const seg = s.capR > 6 ? 28 : 16;
    const stalkColor = pick(STALK);
    for (const key of ['stalk', 'under', 'top']) {
      const g = lathe(parts[key], seg);
      jitter(g, key === 'stalk' ? 0.08 : 0.05, 0.06, seed);
      g.rotateY(ry).rotateX(rx).rotateZ(rz).translate(x, g0 - sink, z);
      g.deleteAttribute('uv');
      const c = key === 'stalk' ? stalkColor : key === 'under' ? (glow ? '#b5abe0' : '#9890c0') : (glow ? '#ddd6f6' : pick(['#c9c1ea', '#bdb4e2', '#d2cbef']));
      const k = `${c}|${glow ? 1 : 0}`;
      (shroomGeo[key][k] ??= []).push(g.toNonIndexed());
      // coarse collision: same profile, fewer sides
      const p = lathe(key === 'stalk' ? [parts.stalk[1], parts.stalk[4], parts.stalk[7]] : parts[key], 10);
      p.rotateY(ry).rotateX(rx).rotateZ(rz).translate(x, g0 - sink, z);
      p.deleteAttribute('uv');
      proxies.push(p);
    }
    if (glow) lights.push(new THREE.Vector4(x, g0 + parts.topY * 0.85, z, s.capR * 1.6));
    return g0 - sink + parts.topY;
  }
  // the relic mushroom and a spiral of stepping caps up to it
  shroom(HERO_SHROOM.x, HERO_SHROOM.z, HERO_SHROOM, { glow: true, sink: 0.2, tilt: 0, seed: 1 });
  for (let k = 0; k < 5; k++) {
    const a = 0.4 + k * 0.62, d = HERO_SHROOM.capR + 2.2;
    const x = HERO_SHROOM.x + Math.cos(a) * d, z = HERO_SHROOM.z + Math.sin(a) * d;
    const top = 2.0 + k * 2.2;
    const capR = 2.4 + k * 0.15;
    // height chosen so the cap top sits `top` above the ground
    const s = { sr: 0.45 + k * 0.05, capR, dome: 0.12, H: (top + 0.2 - capR * 0.12) / 0.9 };
    shroom(x, z, s, { glow: k % 2 === 1, sink: 0.2, tilt: 0, seed: 10 + k });
  }
  // the forest of giants
  {
    let n = 0;
    for (let tries = 0; tries < 3000 && n < 46; tries++) {
      const near = n < 30;
      const x = R(-1, 1) * (near ? 140 : 380), z = near ? R(-150, 40) : R(-430, 60);
      const dp = pathDist(x, z);
      if (dp < 9 || dp > (near ? 90 : 160) || !clear(x, z, 6) || H(x, z) < DEEP - 1.5) continue;
      const big = rng() < 0.55;
      const Hh = big ? R(28, 58) : R(10, 24);
      const capR = Hh * R(0.32, 0.45), sr = capR * R(0.15, 0.2);
      shroom(x, z, { H: Hh, capR, sr, dome: rng() < 0.5 ? R(0.08, 0.16) : R(0.3, 0.5) }, { glow: rng() < 0.35, seed: 30 + n });
      n++;
    }
    // a few along the far half of the path too
    for (let i = 0; i < 12; i++) {
      const u = 0.45 + i * 0.045, k = Math.round(u * N_PATH), side = i % 2 ? 1 : -1;
      const p = pathPts[Math.min(k, N_PATH)], nn = pathNrm[Math.min(k, N_PATH)], off = side * R(20, 34);
      const x = p.x + nn.x * off, z = p.z + nn.z * off;
      if (!clear(x, z, 6) || streamDist(x, z) < 6) continue;
      const Hh = R(16, 40), capR = Hh * R(0.32, 0.42);
      shroom(x, z, { H: Hh, capR, sr: capR * 0.17, dome: rng() < 0.5 ? 0.12 : 0.4 }, { glow: rng() < 0.5, seed: 90 + i });
    }
    for (const key of ['stalk', 'under', 'top'])
      for (const [k, l] of Object.entries(shroomGeo[key])) {
        const [c, glow] = k.split('|');
        const g = +glow ? (key === 'top' ? 0.45 : key === 'under' ? 0.3 : 0) : (key === 'top' ? 0.12 : 0);
        const m = new THREE.Mesh(mergeGeometries(l), makeMaterial({ color: c, flat: true, glow: g }));
        m.userData.noCollide = true;
        scene.add(m);
      }
  }

  // small mushrooms clustered at the feet of the giants and along the banks
  {
    const p = shroomParts({ sr: 0.12, capR: 0.5, H: 1, dome: 0.4 });
    const g = mergeGeometries([lathe(p.stalk, 7), lathe(p.under, 7), lathe(p.top, 7)].map((x) => { x.deleteAttribute('uv'); return x.toNonIndexed(); }));
    const list = [];
    for (let c = 0; c < 140; c++) {
      const u = rng(), k = Math.floor(u * N_PATH), q = pathPts[k], nn = pathNrm[k], off = (rng() < 0.5 ? -1 : 1) * R(5, 40);
      const cx = q.x + nn.x * off, cz = q.z + nn.z * off;
      for (let i = 0; i < 4 + rng() * 8; i++) {
        const x = cx + R(-3, 3), z = cz + R(-3, 3), g0 = H(x, z), s = R(0.6, 2.6);
        if (g0 < -0.9 || !clear(x, z)) continue;
        list.push([place(x, g0 - 0.1, z, s, s * R(0.8, 1.5), s, R(-0.15, 0.15), rng() * 6, R(-0.15, 0.15)), pick(['#d2cbef', '#c9c1ea', '#e2dcf8', '#b9b3d9'])]);
      }
    }
    inst(g, makeMaterial({ color: '#ffffff', flat: true, glow: 0.35 }), list);
  }

  // ---------------------------------------------------------- crystal reeds
  // dense stands of tall, thin, pale lavender shards
  {
    const reed = new THREE.ConeGeometry(0.22, 1, 3).translate(0, 0.5, 0);
    const shard = new THREE.CylinderGeometry(0, 1, 1, 6).translate(0, 0.5, 0);
    const reeds = [], shards = [];
    const stand = (cx, cz, n, spread) => {
      for (let i = 0; i < n; i++) {
        const x = cx + R(-1, 1) * spread, z = cz + R(-1, 1) * spread;
        if (pathDist(x, z) < 3.2 || !clear(x, z)) continue;
        const g0 = H(x, z);
        if (g0 < -1.4) continue;
        reeds.push([place(x, g0 - 0.3, z, R(0.7, 1.4), R(2, 6.5), R(0.7, 1.4), R(-0.12, 0.12), rng() * 6, R(-0.12, 0.12)), pick(['#c9c3ea', '#b8b0e0', '#d8d2f4', '#a9a2d4'])]);
      }
    };
    for (let s = 0; s < 260; s++) {
      const u = rng(), k = Math.floor(u * N_PATH), q = pathPts[k], nn = pathNrm[k], off = (rng() < 0.5 ? -1 : 1) * R(4, 70);
      stand(q.x + nn.x * off, q.z + nn.z * off, 20 + Math.floor(rng() * 40), R(3, 9));
    }
    // the meadow around the island: reed-grass all the way to the mushrooms
    for (let s = 0; s < 70; s++) {
      const a = rng() * Math.PI * 2, d = R(16, 90);
      stand(ISLAND.x + Math.cos(a) * d, ISLAND.z + Math.sin(a) * d, 40, 6);
    }
    // upright crystal clusters
    for (let c = 0; c < 60; c++) {
      const u = rng(), k = Math.floor(u * N_PATH), q = pathPts[k], nn = pathNrm[k], off = (rng() < 0.5 ? -1 : 1) * R(8, 45);
      const cx = q.x + nn.x * off, cz = q.z + nn.z * off;
      if (!clear(cx, cz, 2)) continue;
      for (let i = 0; i < 5 + rng() * 9; i++) {
        const x = cx + R(-2.5, 2.5), z = cz + R(-2.5, 2.5), h = R(3, 11), r = R(0.3, 0.8);
        shards.push([place(x, H(x, z) - 0.4, z, r, h, r, R(-0.25, 0.25), rng() * 6, R(-0.25, 0.25)), pick(['#c9c3ea', '#e0c8e8', '#d4cdf2'])]);
      }
      if (c % 4 === 0) lights.push(new THREE.Vector4(cx, H(cx, cz) + 3, cz, 9));
    }
    inst(reed, makeMaterial({ color: '#ffffff', flat: true, glow: 0.5 }), reeds);
    inst(shard, makeMaterial({ color: '#ffffff', flat: true, glow: 0.45 }), shards);
  }

  // ---------------------------------------------------------- glowing eggs and light pools
  let poolMesh = null, poolList = [];   // the coral pools, for the story (the lamp-keepers brighten them as you pass)
  {
    const egg = new THREE.SphereGeometry(1, 12, 9).scale(1, 1.35, 1);
    const eggs = [];
    const EGG = ['#f6dcb0', '#ffd6a0', '#f8e6c4', '#ffcf9a'];
    const heap = (cx, cz, n, spread, size = 1) => {
      lights.push(new THREE.Vector4(cx, Math.max(H(cx, cz), WATER) + 1.2, cz, 7 + spread * 1.2));
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * spread;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, s = R(0.35, 0.8) * size * (1.2 - d / spread * 0.5);
        const g0 = Math.max(H(x, z), WATER - 0.4);
        eggs.push([place(x, g0 + s * 0.7 + (spread - d) * 0.12 * size, z, s, s, s, R(-0.2, 0.2), 0, R(-0.2, 0.2)), pick(EGG)]);
      }
    };
    // heaps lining the path, alternate sides
    for (let k = 4, side = 1; k < N_PATH - 4; k += 6 + Math.floor(rng() * 5), side = -side) {
      const q = pathPts[k], nn = pathNrm[k], off = side * R(5.5, 8);
      const x = q.x + nn.x * off, z = q.z + nn.z * off;
      if (!clear(x, z, -6)) continue;
      heap(x, z, 6 + Math.floor(rng() * 16), R(1.5, 3.2));
    }
    // great heaps
    heap(-14, -20, 40, 4.5, 1.2);
    heap(18, -214, 50, 5, 1.3);
    heap(-30, -392, 45, 4.5, 1.2);
    heap(-20, -330, 30, 4, 1.1);
    // lines of single eggs in the shallows
    for (let k = 2; k < N_PATH; k += 2) {
      const q = streamPts[k];
      if (rng() < 0.5 || !clear(q.x, q.z)) continue;
      const x = q.x + R(-2, 2), z = q.z + R(-2, 2), s = R(0.3, 0.55);
      eggs.push([place(x, WATER + s * 0.25, z, s, s, s), pick(EGG)]);
    }
    inst(egg, makeMaterial({ color: '#ffffff', glow: 1 }), eggs);

    // flat coral light pools: stepping lights along the path
    const disc = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
    const pools = [];
    let j = 0;
    for (let d = 6; d < PATH.getLength() - 2; d += R(5, 8), j++) {
      const u = d / PATH.getLength(), p = PATH.getPointAt(u), t = PATH.getTangentAt(u);
      const off = R(-2.2, 2.2), x = p.x - t.z * off, z = p.z + t.x * off;
      if (z < CAVE.mouth) continue;
      const s = R(0.9, 2.2);
      pools.push([place(x, Math.max(H(x, z), WATER) + 0.05, z, s * R(1, 1.6), 1, s, 0, Math.atan2(t.x, t.z), 0), pick(['#f2a07a', '#f6b08a', '#f09474'])]);
      if (j % 3 === 0) lights.push(new THREE.Vector4(x, Math.max(H(x, z), WATER) + 1, z, 6));
    }
    // and scattered off the path, glinting among the reeds
    for (let i = 0; i < 90; i++) {
      const k = Math.floor(rng() * N_PATH), q = pathPts[k], nn = pathNrm[k], off = (rng() < 0.5 ? -1 : 1) * R(8, 40);
      const x = q.x + nn.x * off, z = q.z + nn.z * off;
      if (!clear(x, z)) continue;
      const s = R(0.5, 1.4);
      pools.push([place(x, Math.max(H(x, z), WATER) + 0.05, z, s * 1.4, 1, s, 0, rng() * 6, 0), pick(['#f2a07a', '#f6c09a'])]);
    }
    poolMesh = inst(disc, makeMaterial({ color: '#ffffff', glow: 1 }), pools);
    poolList = pools.map(([m, c]) => ({ pos: new THREE.Vector3().setFromMatrixPosition(m), color: new THREE.Color(c), k: 0 }));
  }

  // ---------------------------------------------------------- lily pads, moss bushes
  {
    const pad = new THREE.CircleGeometry(1, 9, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2);
    const pads = [];
    for (let tries = 0; tries < 9000 && pads.length < 1400; tries++) {
      const k = Math.floor(rng() * N_PATH), q = streamPts[k], spread = rng() < 0.5 ? 4 : 40;
      const x = q.x + R(-1, 1) * spread, z = q.z + R(-1, 1) * spread, g0 = H(x, z);
      if (g0 > -0.3 || !clear(x, z)) continue;
      const s = R(0.35, 1.1);
      pads.push([place(x, WATER + 0.03, z, s, 1, s, 0, rng() * 6, 0), pick(['#2f5a4f', '#3a6a58', '#2a4f4a'])]);
    }
    inst(pad, makeMaterial({ color: '#ffffff', flat: true }), pads);
    // dark moss foliage crowding the banks and the root feet
    const bush = new THREE.IcosahedronGeometry(1, 1);
    jitter(bush, 0.25, 0.8, 5);
    const bushes = [];
    for (let tries = 0; tries < 8000 && bushes.length < 1600; tries++) {
      const k = Math.floor(rng() * N_PATH), q = pathPts[k], nn = pathNrm[k], off = (rng() < 0.5 ? -1 : 1) * R(5, 60);
      const x = q.x + nn.x * off + R(-3, 3), z = q.z + nn.z * off + R(-3, 3), g0 = H(x, z);
      if (pathDist(x, z) < 4 || g0 < -0.8 || !clear(x, z)) continue;
      const s = R(0.8, 2.6);
      bushes.push([place(x, g0 - s * 0.3, z, s * R(1, 1.6), s * R(0.6, 1), s, 0, rng() * 6, 0), pick(['#24383f', '#2c4448', '#2a3e4a', '#33504f'])]);
    }
    inst(bush, makeMaterial({ color: '#ffffff', flat: true, pattern: 'leaves' }), bushes);
  }

  // ---------------------------------------------------------- root arches
  // enormous twisting roots arching over path and stream
  const rootParts = { '#2f4a55': [], '#34505a': [], '#2b3f50': [] };
  const tube = (pts, r, tubular, radial, seed, collide = true) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, tubular, r, radial, false);
    // taper toward the ends
    const P = g.attributes.position;
    for (let i = 0; i <= tubular; i++) {
      const u = i / tubular, c = curve.getPointAt(u), k = 0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08)) + 0.25 * (1 - Math.min(u, 1 - u) * 4);
      for (let j = 0; j <= radial; j++) {
        const v = i * (radial + 1) + j;
        P.setXYZ(v, c.x + (P.getX(v) - c.x) * k, c.y + (P.getY(v) - c.y) * k, c.z + (P.getZ(v) - c.z) * k);
      }
    }
    g.computeVertexNormals();
    g.deleteAttribute('uv');
    pick(Object.values(rootParts)).push(g.index ? g.toNonIndexed() : g);
    if (collide) {
      const p = new THREE.TubeGeometry(curve, Math.max(8, tubular >> 2), r * 0.9, 6, false);
      p.deleteAttribute('uv');
      proxies.push(p);
    }
    void seed;
    return curve;
  };
  const archTops = [];
  ARCHES.forEach((A, k) => {
    const half = A.span / 2, along = new THREE.Vector3(A.nz, 0, -A.nx);   // path direction
    const at = (s, y, f = 0) => new THREE.Vector3(A.x + A.nx * s + along.x * f, y, A.z + A.nz * s + along.z * f);
    const footA = at(-half, H(A.x - A.nx * half, A.z - A.nz * half) - 1.2), footB = at(half, H(A.x + A.nx * half, A.z + A.nz * half) - 1.2);
    const wob = R(-3, 3);
    tube([footA, at(-half * 0.72, A.apex * 0.55, wob), at(-half * 0.35, A.apex * 0.93, -wob * 0.5), at(0, A.apex, 0), at(half * 0.4, A.apex * 0.9, wob * 0.6), at(half * 0.75, A.apex * 0.5, -wob), footB], A.r, 64, 12, k);
    archTops.push(at(0, A.apex + A.r, 0));
    // a thinner root twisting around the main arch
    const twist = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12, s = -half * 0.9 + u * half * 1.8, y = Math.max(-1, A.apex * Math.sin(Math.PI * (0.05 + u * 0.9)) - 1.5);
      twist.push(at(s, y + Math.cos(u * 9) * A.r * 1.1, Math.sin(u * 9) * A.r * 1.3));
    }
    tube(twist, A.r * 0.35, 48, 6, k + 10, false);
    for (let w = 0; w < 2; w++) {
      const ph = R(0, 6), tw = [], rr = R(0.6, 1.0), turns = R(4, 8);
      for (let i = 0; i <= 10; i++) {
        const u = i / 10, s = -half * R(0.75, 0.95) * (1 - u) + half * R(0.75, 0.95) * u, y = Math.max(-1, (A.apex - 0.5) * Math.sin(Math.PI * (0.04 + u * 0.92)) - 1.2);
        tw.push(at(s, y + Math.cos(u * turns + ph) * A.r * rr, Math.sin(u * turns + ph) * A.r * 1.2 * rr));
      }
      tube(tw, A.r * R(0.18, 0.3), 40, 5, k + 20 + w, false);
    }
    // splayed feet: smaller roots dropping into the mud
    for (const sd of [-1, 1]) for (let f = 0; f < 3; f++) {
      const s0 = sd * half * R(0.62, 0.8), y0 = A.apex * R(0.35, 0.6);
      const dx = sd * R(3, 8), df = R(-7, 7);
      const ex = A.x + A.nx * (s0 + dx) + along.x * df, ez = A.z + A.nz * (s0 + dx) + along.z * df;
      tube([at(s0, y0), at(s0 + dx * 0.5, y0 * 0.5, df * 0.5), new THREE.Vector3(ex, H(ex, ez) - 1, ez)], A.r * R(0.35, 0.55), 16, 7, k, f === 0);
    }
    lights.push(new THREE.Vector4(A.x, 2, A.z, 10));
  });
  // gnarled roots sprawling along the banks
  for (let i = 0; i < 26; i++) {
    const k = Math.floor(R(0.08, 0.95) * N_PATH), q = pathPts[k], nn = pathNrm[k], side = rng() < 0.5 ? -1 : 1;
    const s0 = side * R(10, 18), s1 = side * R(22, 40), y = R(2, 6), f = R(-12, 12);
    const p0 = q.clone().addScaledVector(nn, s0), p2 = q.clone().addScaledVector(nn, s1);
    if (!clear(p0.x, p0.z) || !clear(p2.x, p2.z)) continue;
    p0.y = H(p0.x, p0.z) - 0.8; p2.y = H(p2.x, p2.z) - 0.8;
    p2.x += R(-6, 6); p2.z += f;
    const mid = p0.clone().lerp(p2, 0.5); mid.y += y;
    tube([p0, mid, p2], R(0.8, 1.6), 24, 8, i, false);
  }

  // ---------------------------------------------------------- the root cave
  // a dark mouth in a giant root mass, glowing coral inside, stalactite fringe
  {
    const grp = new THREE.Group();
    grp.position.set(CAVE.x, CAVE.y, CAVE.z);
    const halfTube = (r, segs = 24) => new THREE.CylinderGeometry(r, r, CAVE.len, segs, 6, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2);
    const rootMat = makeMaterial({ color: '#2f4a55', flat: true, side: THREE.DoubleSide, pattern: 'cracks' });
    const inner = new THREE.Mesh(halfTube(CAVE.r), makeMaterial({ color: '#e9876f', flat: true, glow: 0.55, side: THREE.DoubleSide }));
    const outerG = halfTube(CAVE.r + CAVE.T, 20);
    jitter(outerG, 0.06, 0.1, 3);
    const outer = new THREE.Mesh(outerG, rootMat);
    const back = new THREE.Mesh(new THREE.CircleGeometry(CAVE.r + 0.5, 24, 0, Math.PI).translate(0, 0, -CAVE.len / 2 + 0.3), makeMaterial({ color: '#f2a07a', glow: 0.85, side: THREE.DoubleSide }));
    grp.add(inner, outer, back);
    for (const sz of [-1, 1]) {
      const face = new THREE.RingGeometry(CAVE.r, CAVE.r + CAVE.T, 24, 1, 0, Math.PI);
      if (sz < 0) face.rotateY(Math.PI);
      face.translate(0, 0, sz * CAVE.len / 2);
      grp.add(new THREE.Mesh(face, rootMat));
    }
    // stalactite fringe around the mouth, and glowing ones inside
    const fringe = [], glowing = [];
    for (let i = 0; i < 22; i++) {
      const a = 0.12 + (i / 21) * (Math.PI - 0.24), h = R(0.8, 2.6), r = R(0.2, 0.45);
      const g = new THREE.ConeGeometry(r, h, 5).rotateX(Math.PI).translate(0, -h / 2 + 0.3, 0);
      g.translate(Math.cos(a) * CAVE.r * 0.97, Math.sin(a) * CAVE.r * 0.97 + 0.2, CAVE.len / 2 - R(0.2, 1.5));
      fringe.push(g.toNonIndexed());
    }
    for (let i = 0; i < 50; i++) {
      const zz = R(-0.45, 0.4) * CAVE.len, a = 0.55 + rng() * (Math.PI - 1.1), h = R(1, 3.5);
      const g = new THREE.ConeGeometry(R(0.25, 0.55), h, 5).rotateX(Math.PI).translate(0, -h / 2 + 0.6, 0);
      g.translate(Math.cos(a) * CAVE.r * 0.97, Math.sin(a) * CAVE.r * 0.97, zz);
      glowing.push(g.toNonIndexed());
    }
    const fr = new THREE.Mesh(mergeGeometries(fringe), makeMaterial({ color: '#28324a', flat: true }));
    const gl = new THREE.Mesh(mergeGeometries(glowing), makeMaterial({ color: '#f0927a', flat: true, glow: 0.8 }));
    fr.userData.noCollide = gl.userData.noCollide = true;
    grp.add(fr, gl);
    scene.add(grp);
    // roots draped over the hill so the mass reads as a giant root tangle
    for (let i = 0; i < 30; i++) {
      const zz = CAVE.z + R(-0.5, 0.5) * CAVE.len, side = i % 2 ? 1 : -1, w = CAVE.r + CAVE.T;
      const pts = [
        new THREE.Vector3(CAVE.x - side * R(2, 8), CAVE.y + w + R(0.5, 3), zz + R(-6, 6)),
        new THREE.Vector3(CAVE.x + side * w * 0.75, CAVE.y + w * 0.75, zz + R(-4, 4)),
        new THREE.Vector3(CAVE.x + side * (w + R(3, 9)), H(CAVE.x + side * (w + 5), zz) - 1, zz + R(-8, 8)),
      ];
      tube(pts, R(1.2, 2.4), 20, 8, 50 + i, false);
    }
    // the root mass heaped over the tunnel
    for (let i = 0; i < 7; i++) {
      const s2 = R(9, 14), sy = s2 * R(0.45, 0.7), g = new THREE.IcosahedronGeometry(1, 2);
      jitter(g, 0.22, 0.9, 60 + i);
      // sits on the vault, never inside the tunnel
      g.scale(s2 * R(0.9, 1.3), sy, s2 * R(0.9, 1.3)).rotateY(rng() * 6)
        .translate(CAVE.x + R(-8, 8), CAVE.y + CAVE.r + 1 + sy * 1.25, Math.min(CAVE.z + R(-0.5, 0.1) * CAVE.len, CAVE.mouth - s2 * 1.35));
      g.deleteAttribute('uv');
      pick(Object.values(rootParts)).push(g.index ? g.toNonIndexed() : g);
    }
    // arching roots framing the mouth (the tall gate of the reference)
    for (const sd of [-1, 1]) {
      const x0 = CAVE.x + sd * (CAVE.r + CAVE.T + 4), z0 = CAVE.mouth + 3;
      tube([new THREE.Vector3(x0, -1, z0 + 2), new THREE.Vector3(x0 - sd * 3, 14, z0), new THREE.Vector3(CAVE.x + sd * 3, CAVE.y + CAVE.r + CAVE.T + 6, CAVE.mouth - 4), new THREE.Vector3(CAVE.x - sd * 6, CAVE.y + CAVE.r + CAVE.T, CAVE.z)], 2.6, 40, 10, 70, false);
    }
    // the mouth's dark boulders
    const rockMat = makeMaterial({ color: '#3a4560', flat: true });
    for (let i = 0; i < 10; i++) {
      const s = R(2, 4.5), sd = i % 3 ? -1 : 1;
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMat);
      b.position.set(CAVE.x + sd * R(CAVE.r + CAVE.T - 1, CAVE.r + CAVE.T + 4), CAVE.y - s * 0.3, CAVE.mouth + R(-2, 2.5));
      b.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      scene.add(b);
    }
    for (let i = 0; i < 4; i++) lights.push(new THREE.Vector4(CAVE.x, CAVE.y + 4, CAVE.z + CAVE.len / 2 - 4 - i * 10, 15));
    lights.push(new THREE.Vector4(CAVE.x, CAVE.y + 3, CAVE.mouth + 6, 16));
  }

  // ---------------------------------------------------------- moss domes
  const domeDoors = [];   // where each round door is and which way it faces
  {
    const doorMat = makeMaterial({ color: '#9fe0d0', glow: 0.95 });
    const frameMat = makeMaterial({ color: '#2a4248', flat: true });
    for (const D of DOMES) {
      const g0 = terrain.baseAt(D.x, D.z, D.R) - 0.15;
      const mat = D.kind === 'glass'
        ? makeMaterial({ color: '#5f9a9a', grid: 1.4, glow: 0.12, flat: true })
        : makeMaterial({ color: '#3f6a6a', grid: 2.2, flat: true });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(D.R, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.72, 1), mat);
      dome.position.set(D.x, g0, D.z);
      scene.add(dome);
      // a round lit doorway facing the path
      const pi = pathPts.reduce((b, p, i) => (Math.hypot(p.x - D.x, p.z - D.z) < Math.hypot(pathPts[b].x - D.x, pathPts[b].z - D.z) ? i : b), 0);
      const face = Math.atan2(pathPts[pi].x - D.x, pathPts[pi].z - D.z);
      const dr = D.R * 0.28, el = 0.42;
      const dx = Math.sin(face), dz = Math.cos(face);
      const px = D.x + dx * D.R * Math.cos(el) * 0.98, pz = D.z + dz * D.R * Math.cos(el) * 0.98, py = g0 + D.R * 0.72 * Math.sin(el);
      const door = new THREE.Mesh(new THREE.CircleGeometry(dr, 20), doorMat);
      door.position.set(px, py, pz);
      door.lookAt(px + dx, py + 0.3, pz + dz);
      door.userData.noCollide = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(dr, dr * 0.16, 6, 20), frameMat);
      ring.position.copy(door.position).addScaledVector(new THREE.Vector3(dx, 0, dz), 0.05);
      ring.quaternion.copy(door.quaternion);
      ring.userData.noCollide = true;
      scene.add(door, ring);
      if (D.kind === 'glass') {   // ribs
        const ribs = [];
        for (let i = 0; i < 8; i++) {
          const g = new THREE.TorusGeometry(D.R * 1.01, 0.18, 5, 24, Math.PI).rotateY((i / 8) * Math.PI).scale(1, 0.72, 1);
          ribs.push(g.toNonIndexed());
        }
        const r = new THREE.Mesh(mergeGeometries(ribs), frameMat);
        r.position.set(D.x, g0, D.z);
        r.userData.noCollide = true;
        scene.add(r);
      }
      lights.push(new THREE.Vector4(px + dx * 2, py, pz + dz * 2, 8));
      domeDoors.push({ pos: new THREE.Vector3(px, py, pz), out: new THREE.Vector3(dx, 0, dz), ground: g0 + 0.15, top: g0 + D.R * 0.72, door, R: D.R });
    }
  }

  // ---------------------------------------------------------- old Fen's landing stage
  // a raft of root-wood moored at the far dome's door, out on the deep water: the skiff's way only
  let fenLanding = null;
  {
    const D = domeDoors[FEN.dome], c = D.pos.clone().addScaledVector(D.out, 3.4);
    const wood = makeMaterial({ color: '#4a3f3a', flat: true, pattern: 'cracks' });
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 1.4, 12).translate(0, -0.1, 0), wood);   // top 0.6 above the water
    deck.position.set(c.x, 0, c.z);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 3.2).translate(0, 0.5, -1.4), wood);   // a step up to the door
    plank.position.set(c.x, 0, c.z);
    plank.rotation.y = Math.atan2(-D.out.x, -D.out.z);
    plank.position.addScaledVector(D.out, -1.2);
    scene.add(deck, plank);
    lights.push(new THREE.Vector4(c.x, 1.6, c.z, 7));
    fenLanding = new THREE.Vector3(c.x, 0.6, c.z);
  }

  // ---------------------------------------------------------- the crashed saucer pod
  let saucer = null;
  {
    const grp = new THREE.Group();
    grp.position.set(SAUCER.x, SAUCER.y, SAUCER.z);
    grp.rotation.set(SAUCER.tilt, 0.6, -0.1);
    const hull = new THREE.Mesh(new THREE.SphereGeometry(SAUCER.r, 28, 12).scale(1, 0.34, 1), makeMaterial({ color: '#4fbcb0', flat: true, metal: 'painted' }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(SAUCER.r * 0.98, 0.45, 6, 32).rotateX(Math.PI / 2), makeMaterial({ color: '#3a8f8a', flat: true, metal: 'painted' }));
    const slot = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.45, 0.8), makeMaterial({ color: '#1d2a3a', flat: true }));
    slot.position.set(0, SAUCER.r * 0.25, SAUCER.r * 0.3);
    slot.userData.noCollide = true;
    const hatch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 5, 20).rotateX(Math.PI / 2), makeMaterial({ color: '#3a8f8a', flat: true }));
    hatch.position.set(0, SAUCER.r * 0.33, -1.6);
    hatch.userData.noCollide = true;
    // its own material: the story makes it blink an answer to the relit pools
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), makeMaterial({ color: '#f2a07a', glow: 1, saucerLight: true }));
    light.position.set(SAUCER.r * 0.75, SAUCER.r * 0.12, 0);
    light.userData.noCollide = true;
    grp.add(hull, rim, slot, hatch, light);
    scene.add(grp);
    const glow = new THREE.Vector4(SAUCER.x, 1.5, SAUCER.z, 14);
    lights.push(glow);
    saucer = { group: grp, light, glow, hull };
  }

  for (const [c, l] of Object.entries(rootParts)) if (l.length) {
    const m = new THREE.Mesh(mergeGeometries(l), makeMaterial({ color: c, flat: true, pattern: 'cracks' }));
    m.userData.noCollide = true;
    scene.add(m);
  }

  // collision stand-ins
  {
    const m = new THREE.Mesh(mergeGeometries(proxies.map((g) => { const n = g.index ? g.toNonIndexed() : g, o = new THREE.BufferGeometry(); o.setAttribute('position', n.attributes.position); return o; })), makeMaterial({ color: '#000000' }));
    m.visible = false;
    scene.add(m);
  }

  const unsafe = (p) => terrain.heightAt(p.x, p.z) < DEEP && p.y < WATER + 0.5;
  const spawnY = H(0, 0);

  // the Lamp-House in the shallows east of the root cave, and its rooms far overhead (src/temples/perdide2.js)
  return attachTemple('perdide2', scene, {
    id: 'perdide2',
    floraAvoid: (x, z, r) => !clear(x, z, r + 2) || pathDist(x, z) < 3.6 + r,   // off the lit path and the keep-outs (src/flora.js)
    ground: terrain,
    spawn: new THREE.Vector3(0, spawnY, 0),
    spawnHeading: Math.PI,
    camYaw: 0,
    limit: 820,
    features: { mount: true, wind: false, jetpack: false, climb: true },
    mount: (physics) => {
      const s = new Hoverbike(physics, { build: buildSkiff, floor: WATER + 0.15, kind: 'skiff' });
      s.place(SKIFF.x, SKIFF.z, SKIFF.heading, new THREE.Vector3(SKIFF.x, 1, SKIFF.z));   // moored at the cave mouth
      s.object.position.copy(s.pos);
      s.object.rotation.y = s.heading;
      return s;
    },
    mountName: 'skiff',
    defaults: { hour: 17.7, preset: 'Moebius print', cloudShadows: 0, look: { uClouds: 0, uCumulus: 0, uFogDensity: 0.002 } },
    sky: {
      // violet / indigo / teal shade under a coral horizon
      script: {
        day: ['#c48c98', '#f2a088', '#4a4f7a', '#ece2f2', '#fff0e0'],
        dusk: ['#b97f93', '#f0927a', '#4a4f7a', '#f2cfc4', '#fff2e2'],
        night: ['#1b1f3e', '#5a3f62', '#2f3560', '#8fb8c8', '#f2e8e0'],
      },
      planets: [{ az: 172, el: 12, size: 2.2, color: '#f6e6dc', craters: false }],
    },
    killY: -Infinity,
    unsafe,
    lights,
    archTops,
    // for the story (src/story/perdide2.js)
    poolMesh, poolList, domeDoors, saucer, fenLanding,
    life: {
      flocks: [{ count: 8, color: '#1f2236', size: 1.0, radius: 45, height: [14, 40], speed: 0.22, seed: 21 }],
      motes: { count: 220, color: '#ffd6a0', size: 0.07, glow: 1, rise: 0.04, wind: [0.08, 0.05] },
      footprints: '#2f4a55',
    },
    atmo: () => ({ tint: [1.0, 0.97, 0.98], fog: 1.7, name: 'The Deep Wood' }),
    update() {},
  });
}
