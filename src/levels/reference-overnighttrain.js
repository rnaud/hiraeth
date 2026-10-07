import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { CLEAN_SKY } from './reference-kit.js';
import { framed } from './underside-kit.js';
import {
  TR, trainMats, train, furnishCar, dustPuffs, dustMeshes, moonGeo, rider, butte, stone, pennant, rodGeo, TRAIN_LOOK, TRAIN_TONES,
} from './overnight-train-kit.js';

// ---------------------------------------------------------------------------
// The Overnight Train's reference pictures (references/The Overnight Train/reference-1 … 4): a long streamlined train
// crossing a flat lavender plain at dusk under two moons, its round nose and railed balcony full of people, lit
// orange windows down its length, gardens on its roofs, pink pennants streaming back, a salmon cloud of dust along
// its wheels; the plain streaked with long dark lines toward the horizon. Each picture is one composition: one view
// each, one scene builder (trainScene). The train is placed off the pictures' pixels: the point where its
// balcony's tip meets the floor's level, and the vanishing point its length runs to on the horizon.
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The Overnight Train / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The Overnight Train/reference-${n}.jpeg`, import.meta.url).href });
export const TRAIN_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`overnighttrain-${n}`, sheet(n)]));

/** The pictures' ink: the world's own look and a clean sky. */
export const TRAIN_VIEW_LOOK = { ...TRAIN_LOOK, ...CLEAN_SKY };
/** sky top, horizon, shadow (the train's shaded flank), light, sun: read off the pictures */
const SKY = {
  1: ['#5c5ca8', '#ee8c96', '#4a4688', '#d0b0d8', '#ffd8c8'],
  2: ['#3c56a0', '#d88ab4', '#4e3e7e', '#e8b4cc', '#ffc8b0'],
  3: ['#424c8e', '#d88a98', '#33336a', '#b8a0cc', '#ffc8a8'],
  4: ['#3e5492', '#ee927e', '#42366e', '#c8a0c4', '#ffd0a0'],
};

// ---------------------------------------------------------------- the pictures' pixels
const SW = 1456, SHH = 816, DEG = Math.PI / 180;
const camOf = (cam) => { const t = Math.tan((cam.fov * DEG) / 2); return { f: SHH / 2 / t, p: Math.atan((cam.horizon - 0.5) * 2 * t), e: cam.eye }; };
/** The direction of the ray through the picture's pixel (px, py), in the view's frame (looking down -z). */
export function sheetRay(cam, px, py) {
  const { f, p } = camOf(cam), u = (px - SW / 2) / f, v = (SHH / 2 - py) / f;
  return new THREE.Vector3(u, Math.sin(p) + v * Math.cos(p), -(Math.cos(p) - v * Math.sin(p))).normalize();
}
/** Where the picture's pixel (px, py) meets the level y = g, in the view's frame. */
export function sheetPlane(cam, px, py, g) {
  const d = sheetRay(cam, px, py), e = cam.eye, t = (g - e[1]) / d.y;
  return new THREE.Vector3(e[0] + d.x * t, g, e[2] + d.z * t);
}

const NC = { solid: false, shadow: false };
export { camAt };

/**
 * A picture's scene. o: { seed, vp: [px] (where the train's
 * length meets the horizon), cars: [...] (train()'s list; the tail's closed coaches added to `length`), length (how many
 * carriages in all), moons: [[px, py, deg]…], plume: {...dustPuffs}, people (on the balcony), terrace (on the dome),
 * buttes: [[px, d, w, h]…] (far masses on the horizon: pixel x, distance), streaks (how many), bank: {...} (a bank of
 * pink cloud on the horizon) }
 */
function trainScene(kit, v, o) {
  const M = trainMats(kit), rng = mulberry32(o.seed ?? 1), cam = v.camera;
  // (the nose stands over the point of the plain where the picture's wheels meet it: the camera was solved for that)
  const N = sheetPlane(cam, cam.under[0], cam.under[1], TR.rail), far = sheetRay(cam, o.vp, cam.horizon * SHH).setY(0).normalize();
  // (the train's +x, its nose's way, points away from the vanishing point)
  const fx = -far.x, fz = -far.z, yaw = Math.atan2(-fz, fx);
  const fk = framed(kit, N.x, 0, N.z, yaw);
  const cars = [...o.cars];
  while (cars.length < (o.length ?? 12)) cars.push({ kind: 'coach', roof: rng() < 0.4 ? 'garden' : 'walk', colour: rng() < 0.5 ? 'plum' : 'hull', pennants: rng() < 0.2 ? [[rng() - 0.5, 0, 2.6, 6]] : [] });
  const T = train(fk, M, cars, { x: o.lead ?? -2.5, detail: 1, solid: false, seed: o.seed, furnish: (k, MM, c, ctx) => { if (c.kind === 'prow') furnishCar(k, MM, c, ctx, { solid: false }); } });
  for (const p of T.pennants) fk.add(p.mat, p.g, NC);
  const lead = T.cars[0];
  // people on the balcony and at the lounge's front, on the dome's terrace
  for (let i = 0; i < (o.people ?? 6); i++) { const a = (rng() - 0.5) * 2.4; rider(fk, M, rng, lead.x1 + 1 + Math.cos(a) * 2.6, TR.floor, Math.sin(a) * 2.6, { yaw: Math.PI / 2 + (rng() - 0.5), s: 0.95 }); }
  for (const t of T.terraces) for (let i = 0; i < (o.terrace ?? 3); i++) rider(fk, M, rng, t.x0 + 1 + rng() * 3, t.y, (rng() - 0.5) * 3, { s: 1 });
  // the track: the dark bed under it to the horizon both ways, the rails
  fk.add(M.ballast, new THREE.BoxGeometry(5000, TR.rail - 0.1, 4.6).translate(-2400, (TR.rail - 0.1) / 2, 0), NC);
  for (const s of [-1, 1]) fk.add(M.rails, rodGeo(new THREE.Vector3(-4800, TR.rail, (s * TR.gauge) / 2), new THREE.Vector3(200, TR.rail, (s * TR.gauge) / 2), 0.06), NC);
  // the dust along the wheels, heaping up behind
  for (const im of dustMeshes(M, dustPuffs({ x0: lead.x1 - 2, x1: T.xTail, seed: o.seed, ...(o.plume ?? {}) }), { seed: o.seed })) { im.applyMatrix4(fk.matrix); kit.group.add(im); kit.noShadow.push(im); }
  // the plain: flat to the horizon, its long streaks along the line, dense near it and thinning out
  kit.add(M.plain, new THREE.CircleGeometry(5200, 64).rotateX(-Math.PI / 2), { solid: true, shadow: false });
  // (laid round the eye in the train's frame, each as wide as it must be to stand a pixel or three wide where the picture
  // sees it: measured through the view's own camera; the ones out of the frame are left out)
  const E = new THREE.Vector3(...cam.eye).applyMatrix4(fk.matrix.clone().invert()), nS = o.streaks ?? 420;
  const lens = new THREE.PerspectiveCamera(cam.fov, SW / SHH, 0.1, 9000);
  lens.position.set(...cam.eye); lens.rotation.set(camOf(cam).p, 0, 0); lens.updateMatrixWorld(true);
  const px = (x, z) => { const q = new THREE.Vector3(x, 0, z).applyMatrix4(fk.matrix).project(lens); return [(q.x + 1) * SW / 2, (1 - q.y) * SHH / 2, q.z]; };
  for (let i = 0, tries = 0; i < nS && tries < nS * 6; tries++) {
    const dz = (rng() < 0.5 ? 1 : -1) * (1.5 + Math.pow(rng(), 1.4) * 320), z = E.z + dz, x = E.x + 120 - Math.pow(rng(), 1.6) * 1100;
    if (Math.abs(z) < 3.2) continue;
    const [u, v, d] = px(x, z);
    if (d > 1 || u < -200 || u > SW + 200 || v < cam.horizon * SHH || v > SHH + 40) continue;
    const [u2, v2] = px(x, z + 0.05), sep = Math.hypot(u2 - u, v2 - v) / 0.05;
    const w = Math.min(4, (0.8 + rng() * 2.2) / Math.max(sep, 1e-3)), r = Math.hypot(dz, x - E.x), len = 4 + rng() * 26 * (1 + r / 12);
    fk.add(M.streak, new THREE.PlaneGeometry(len, w).rotateX(-Math.PI / 2).translate(x, 0.03 + r * 0.0012 + (i % 7) * 0.002, z), NC);
    i++;
  }
  // far buttes and stones on the plain
  for (const [px, d, w, h] of o.buttes ?? []) { const r = sheetRay(cam, px, cam.horizon * SHH).setY(0).normalize(); kit.add(M.butte, butte(r.x * d, r.z * d, { w, h, d: w * 0.6, seed: px }), NC); }
  for (const [px, py, sz] of o.stones ?? []) { const p = sheetPlane(cam, px, py, 0); kit.add(M.stone, stone(p.x, p.z, sz, px), NC); }
  // a bank of pink cloud low on the horizon
  if (o.bank) {
    const B = o.bank, r = sheetRay(cam, B.px, cam.horizon * SHH).setY(0).normalize(), side = new THREE.Vector3(-r.z, 0, r.x);
    const puffs = [];
    for (let i = 0; i < (B.n ?? 60); i++) { const u = (rng() - 0.5) * B.w, d = B.d + (rng() - 0.5) * B.d * 0.3, s = B.s * (0.6 + rng() * 0.8); puffs.push({ x: r.x * d + side.x * u, y: s * 0.1 + rng() * B.h * (0.5 + 0.5 * (u / B.w + 0.5)), z: r.z * d + side.z * u, s, sy: (B.flat ?? 0.4) * (0.8 + rng() * 0.5) }); }
    for (const im of dustMeshes(M, puffs, { seed: 7 })) { kit.group.add(im); kit.noShadow.push(im); }
  }
  // the two moons
  const eye = new THREE.Vector3(...cam.eye);
  for (const [px, py, deg] of o.moons ?? []) kit.add(M.moon, moonGeo(eye, sheetRay(cam, px, py), { deg }), NC);
  o.extra?.(fk, M, rng, T);
  return T;
}

/**
 * The ground: hidden, the scene lays its own plain (solid: walked on) and its streaks. Its height is a little under the
 * plain (the pictures look from under a metre up; the level keeps every eye over its ground).
 */
const PLAIN = { height: () => -1.2, material: { color: TRAIN_TONES.plain }, rings: { r1: 600, rings: 20, seg: 32 }, hidden: true };
/**
 * The camera of a picture from two of its points: where the train's wheels meet the plain under its nose (under: the
 * rails' level) and its roof's crown straight over that (over). The two fix how far off the nose stands and how high
 * the eye is (the pictures look from low on the plain: a few centimetres decide where the horizon cuts the train).
 */
function camAt(c, under, over) {
  const k = ([px, py]) => { const r = sheetRay({ ...c, eye: [0, 0, 0] }, px, py); return r.y / Math.hypot(r.x, r.z); };
  const H = TR.floor + TR.crown - TR.rail, d = H / (k(over) - k(under));
  return { ...c, eye: [0, TR.rail - k(under) * d, 0], under, d };
}
const view = (o) => ({ look: TRAIN_VIEW_LOOK, fog: 0.4, ground: PLAIN, ...o });
const CAM = {
  1: camAt({ yaw: 0, fov: 30, horizon: 0.653 }, [1290, 530], [1235, 300]),
  2: camAt({ yaw: 0, fov: 52, horizon: 0.715, roll: -3.3 }, [250, 556], [262, 250]),
  3: camAt({ yaw: 0, fov: 38, horizon: 0.716 }, [560, 603], [565, 355]),
  4: camAt({ yaw: 0, fov: 46, horizon: 0.745 }, [300, 602], [300, 268]),
};
const LEAD = (o = {}) => ({ kind: 'prow', roof: 'garden', colour: 'plum', pennants: [[-0.35, 0, 3.2, 7]], ...o });
const DOME = (o = {}) => ({ kind: 'dome', roof: 'terrace', colour: 'hull', closed: true, pennants: [[0.6, 1.4, 4.4, 8], [0.45, -1.4, 3.6, 6]], ...o });

export const TRAIN_VIEWS = [
  view({
    id: 'overnighttrain-1-moons', title: 'The train across the plain under the two moons, its balcony full, the dust trailing rose', sheet: 'overnighttrain-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[1], sun: { side: -38, el: 4 }, sky: SKY[1],
    build(kit, v) {
      trainScene(kit, v, {
        seed: 82001, vp: -260, length: 6, people: 7,
        cars: [LEAD({ colour: 'hull' }), DOME({ colour: 'hull', pennants: [[0.75, 0, 4, 9]] })],
        moons: [[176, 153, 1.15], [218, 208, 0.85]],
        plume: { trail: 420, grow: 1, sides: [-1, 1] }, streaks: 2600,
      });
    },
  }),
  view({
    id: 'overnighttrain-2-nose', title: 'Under the great nose: the balcony and its lit lounge, the pennants, the pink cloud behind', sheet: 'overnighttrain-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[2], sun: { side: -160, el: 5 }, sky: SKY[2],
    build(kit, v) {
      trainScene(kit, v, {
        seed: 82002, vp: 1330, length: 24, people: 8, terrace: 4,
        cars: [LEAD({ colour: 'plum', pennants: [[0.1, 0.8, 3.6, 7], [-0.2, -0.6, 3, 6]] }), DOME({ colour: 'plum' })],
        moons: [[350, 68, 2.0], [398, 64, 1.6]],
        plume: { trail: 320, grow: 3.2, size: 2.2, sides: [-1] }, streaks: 2000,
      });
    },
  }),
  view({
    id: 'overnighttrain-3-dusk', title: 'The train coming on at dusk, its round window lit, the moons low on the right, a rose bank of cloud', sheet: 'overnighttrain-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[3], sun: { side: -120, el: 4 }, sky: SKY[3],
    build(kit, v) {
      trainScene(kit, v, {
        seed: 82003, vp: 1305, length: 26, people: 6,
        cars: [LEAD({ colour: 'hull' }), DOME({ colour: 'hull' })],
        moons: [[1242, 470, 2.6], [1315, 530, 1.9]],
        plume: { trail: 80, grow: 0.3, size: 0.6, sides: [-1, 1] }, streaks: 2600,
        bank: { px: 160, d: 1500, w: 2400, h: 40, s: 80, n: 120, flat: 0.3 },
      });
    },
  }),
  view({
    id: 'overnighttrain-4-dust', title: 'Along the track: the plum carriages, their windows lit, the salmon dust rolling at the wheels', sheet: 'overnighttrain-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: CAM[4], sun: { side: -150, el: 5 }, sky: SKY[4],
    build(kit, v) {
      trainScene(kit, v, {
        seed: 82004, vp: 1395, length: 24, people: 7,
        cars: [LEAD({ colour: 'plum' }), DOME({ colour: 'plum' })],
        moons: [[325, 113, 3.0], [930, 205, 2.1]],
        plume: { trail: 60, grow: 0.5, size: 1.1, sides: [1, -1] }, streaks: 2200,
        stones: [[1340, 700, 0.5], [1410, 770, 0.7], [1220, 650, 0.35]],
      });
    },
  }),
];
export { TRAIN_SHEETS as SHEETS, TRAIN_VIEWS as VIEWS };
