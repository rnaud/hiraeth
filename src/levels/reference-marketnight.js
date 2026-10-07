import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { MODE_TERRAIN } from '../materials.js';
import { CLEAN_SKY, sagPts, tube } from './reference-kit.js';
import { put } from './lab-kit.js';
import { MARKET_LOOK } from './bazaar.js';
import { SCREEN, FILL_COLOURS, MN_TONES, PICTURES, crt, panel, roundScreen, placeParts, tarp, vendor, groundCables, TAU } from './market-night-kit.js';

// ---------------------------------------------------------------------------
// The Signal Market at night (references/The Signal Market - Night/reference-1 … 4: four 16:9 variations of one
// picture, the market's screen lane after midnight). Each is one composition, one view each, built by one scene
// builder (laneScene): the lane between two walls stacked with second-hand screens (market-night-kit.js), the
// sheet's own screens placed off its pixels (sheetAt: what is drawn at pixel (px, py), d m down the line of sight),
// the rest of each wall filled with screens of the sheets' colours, cloth awnings, vendors at the walls' feet,
// cables over the paving, a few walkers far down the lane, a black slit of sky. reference-views.js describes the
// fields; `night: 1` holds the night on (references.js: the windows, the screens' glow, the stars), whatever hour
// the view's sun picks (the sun stands behind the camera, out of the frame).
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The Signal Market at night / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The Signal Market - Night/reference-${n}.jpeg`, import.meta.url).href });
export const MARKETNIGHT_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`marketnight-${n}`, sheet(n)]));

/** The sheets' ink: the market's look (bazaar.js), a clean sky, little hatching (the night's walls are flat dark masses). */
export const MARKETNIGHT_VIEW_LOOK = { ...MARKET_LOOK, ...CLEAN_SKY, uHatch: 0.1, uShadowFlat: 0.9, uSkyDots: 0, uHazeLayers: [60, 1.8, 0.1, 3], uHazeTone: [0.12, 0.13, 0.24, 0.6] };
/** sky top, horizon, shadow, light, sun: the night's (read off the sheets: a black sky, the lane's far glow a deep indigo) */
const SKY = {
  ink: ['#07080e', '#1b1f38', '#1a1c34', '#7a80b0', '#c8c8e8'],
  indigo: ['#0a0c18', '#232848', '#1d2040', '#9096c8', '#c8c8e8'],
};

// ---------------------------------------------------------------- the sheets' pixels
const SW = 1456, SH = 816, V = (x, y, z) => new THREE.Vector3(x, y, z);
const camOf = (cam) => { const tf = Math.tan((cam.fov * Math.PI) / 360); return { f: SH / 2 / tf, p: cam.shift ? 0 : Math.atan((cam.horizon - 0.5) * 2 * tf), e: cam.eye, c: cam.shift ? SH * cam.horizon : SH / 2 }; };
/** The point drawn at (px, py) on the sheet, d m away (horizontally) along the view, in the view's frame. */
export function sheetAt(cam, px, py, d) {
  const { f, p, e, c } = camOf(cam), u = (px - SW / 2) / f, v = (c - py) / f, t = d / (Math.cos(p) - v * Math.sin(p));
  return V(e[0] + t * u, e[1] + t * (Math.sin(p) + v * Math.cos(p)), e[2] - d);
}
/** How many metres n pixels of the sheet span at distance d. */
export const sheetSpan = (cam, n, d) => (n / camOf(cam).f) * d;

// ---------------------------------------------------------------- materials
function materials(kit, o = {}) {
  const DS = THREE.DoubleSide, T = MN_TONES, LT = o.lampTint ? { lampTint: o.lampTint } : {};
  return {
    // every lit screen and its picture in one material: their colours by vertex, their own light, a line in a dark
    // shade of their own colour (the sheets ink the screens' pictures, not in black)
    screen: kit.mat({ color: '#ffffff', vertexColors: true, glow: o.glow ?? 0.6, flat: true, spot: 0, line: 0.6, lineTint: 0.45 }),
    off: kit.mat({ color: T.off, flat: true, hatch: 0.1 }),
    casing: T.casing.map((c) => kit.mat({ color: c, flat: true, hatch: 0.2 })),
    dark: kit.mat({ color: T.casingDark, flat: true }),
    wall: kit.mat({ color: T.wall, flat: true, grid: 3.2, hatch: 0.15 }),
    wall2: kit.mat({ color: T.wall2, flat: true, grid: 2.4, hatch: 0.15 }),
    wall3: kit.mat({ color: T.wall3, flat: true, hatch: 0.15 }),
    far: kit.mat({ color: T.far, flat: true }),
    cloth: T.cloth.map((c) => kit.mat({ color: c, side: DS, shade: 0.3, hatch: 0.2, line: 0.7, lineTint: 0.6, ...LT })),
    people: T.people.map((c) => kit.mat({ color: c, flat: true, figure: true, ...LT })),
    skin: kit.mat({ color: T.skin, flat: true, figure: true, ...LT }),
    cable: kit.mat({ color: T.cable, flat: true }),
    crate: [T.crate, T.crate2].map((c) => kit.mat({ color: c, flat: true })),
    rope: kit.mat({ color: T.rope, flat: true }),
  };
}
const NC = { solid: false, shadow: false };
/** A screen's body (crt / panel / roundScreen parts) added under the lane's materials. */
function addScreen(kit, M, parts, casing) {
  for (const g of parts.casing) kit.add(casing, g, NC);
  for (const g of parts.dark) kit.add(M.dark, g, NC);
  for (const g of parts.screen) kit.add(M.screen, g, NC);
  for (const g of parts.off) kit.add(M.off, g, NC);
}

/**
 * A panel's scene: the lane down -z between its walls (left, right: their faces' x), stacked with screens. o: {
 *   left, right, top: [min, max] (the walls' height), screens: [{ px, py, wpx, hpx, d, type: 'crt' | 'panel' | 'round',
 *   kind, bg, turn (0 facing the eye … 1 facing across the lane), tilt, roll, deep, light: r }], fill: { z0, z1, top,
 *   density }, tarps: [[A, B, C, D] in sheet terms: [px, py, d]…], vendors: [[px, d, yaw]], walkers: n,
 *   cables: n, lights: [[px, py, d, r]] }
 */
function laneScene(kit, v, o) {
  const rng = mulberry32(o.seed ?? 1), M = materials(kit, o), cam = v.camera;
  const S = (px, py, d) => sheetAt(cam, px, py, d), span = (n, d) => sheetSpan(cam, n, d);
  const L = o.left ?? -3.6, R = o.right ?? 3.6, eye = V(...cam.eye);
  const pick = (a) => a[Math.floor(rng() * a.length)];
  // ---- the sheet's own screens, where it draws them
  const keep = [];   // what the fill keeps clear of: [centre, radius]
  for (const s of o.screens ?? []) {
    const c = S(s.px, s.py, s.d), w = span(s.wpx, s.d), h = span(s.hpx ?? s.wpx, s.d);
    const toEye = Math.atan2(eye.x - c.x, eye.z - c.z), across = c.x < (L + R) / 2 ? Math.PI / 2 : -Math.PI / 2;
    const yaw = toEye + (across - toEye) * (s.turn ?? 0.15) + (s.yaw ?? 0);
    const seed = Math.round(s.px * 3 + s.py);
    const parts = s.type === 'round' ? roundScreen({ r: w / 2, d: s.deep ?? w * 0.35, kind: s.kind ?? 'planet', bg: s.bg, seed })
      : s.type === 'panel' ? panel({ w: w * 0.94, h: h * 0.94, kind: s.kind, bg: s.bg, seed, bezel: Math.min(w, h) * 0.03, on: s.on ?? true })
        : crt({ w, h, d: s.deep ?? Math.min(w, h) * 0.85, kind: s.kind, bg: s.bg, seed, on: s.on ?? true });
    addScreen(kit, M, placeParts(parts, c.x, c.y, c.z, yaw, s.tilt ?? 0, s.roll ?? 0), pick(M.casing));
    keep.push([c, Math.max(w, h) * 0.5]);
    if (s.light) kit.light(c.x + Math.sin(yaw) * 1.2, Math.min(c.y, 2.2), c.z + Math.cos(yaw) * 1.2, s.light);
    // what it stands on: a crate stack or a dark box down to the ground, a bracket to the wall
    if (s.stand !== false && c.y - h / 2 > 0.15 && c.y - h / 2 < 3) kit.add(M.dark, put(new THREE.BoxGeometry(w * 0.8, c.y - h / 2, w * 0.6), c.x - Math.sin(yaw) * w * 0.3, (c.y - h / 2) / 2, c.z - Math.cos(yaw) * w * 0.3, yaw), NC);
  }
  const clear = (p, r) => keep.every(([c, k]) => c.distanceTo(p) > k + r);
  // ---- the walls: dark masses, stacked with screens near the ground
  const F = { z0: -4.5, z1: -120, top: [14, 24], density: 1, near: 3, ...o.fill };
  for (const [side, x0] of [[-1, L], [1, R]]) {
    for (let z = 6; z > F.z1 - 40;) {
      const d = 5 + rng() * 10, h = (o.top?.[0] ?? 22) + rng() * ((o.top?.[1] ?? 40) - (o.top?.[0] ?? 22)), m = rng() < 0.5 ? M.wall : M.wall2;
      // (the wall stands back behind the sheet's own screens on its side: they hang on it, never inside it)
      let back = rng() * 1.5;
      for (const [c, k] of keep) if (c.z < z + k && c.z > z - d - k && Math.sign(c.x - (L + R) / 2) === side) back = Math.max(back, side * (c.x - x0) + k * 0.8);
      kit.add(m, new THREE.BoxGeometry(24, h, d).translate(x0 + side * (12 + back), h / 2, z - d / 2), NC);
      // the skyline's clutter on its top: tanks, poles, boxes
      if (rng() < 0.6) kit.add(M.wall3, new THREE.BoxGeometry(2 + rng() * 4, 1 + rng() * 4, 2 + rng() * 3).translate(x0 + side * (2 + rng() * 6), h + 1, z - d / 2), NC);
      if (rng() < 0.4) kit.add(M.cable, new THREE.CylinderGeometry(0.08, 0.08, 6 + rng() * 8, 4).translate(x0 + side * (1 + rng() * 4), h + 4, z - d * rng()), NC);
      // a pipe or two along the face, high up
      if (rng() < 0.5) kit.add(M.wall3, new THREE.CylinderGeometry(0.25, 0.25, d, 6).rotateX(Math.PI / 2).translate(x0 - side * 0.3, F.top[1] + 2 + rng() * 8, z - d / 2), NC);
      z -= d;
    }
    // the screens: columns along the wall, stacked from the ground up; nearer the ground smaller and deeper
    for (let z = F.z0; z > F.z1;) {
      const far = Math.min(1, -z / 80), cw = 1.3 + rng() * 2.6 * (1 - far * 0.3);
      let y = rng() < 0.4 ? 0.35 + rng() * 0.3 : 0;
      const top = Math.min(F.top[0] + rng() * (F.top[1] - F.top[0]), 1.5 + (-z - F.near));   // (short near the camera: the sheets' near walls are dark above the first screens)
      if (y > 0) kit.add(pick(M.crate), new THREE.BoxGeometry(cw * 0.9, y, 0.9).translate(x0 - side * 0.5, y / 2, z - cw / 2), NC);
      while (y < top) {
        const big = y > 3 ? 1.8 : 1, h = Math.min(top - y + 0.3, (0.7 + rng() * 1.3) * big * (rng() < 0.15 ? 1.6 : 1)), w = Math.min(cw, h * (1 + rng() * 0.8));
        const type = y < 2.2 ? (rng() < 0.65 ? 'crt' : 'panel') : y < 4 && rng() < 0.35 ? 'crt' : rng() < 0.93 ? 'panel' : 'round';
        const deep = type === 'crt' ? Math.min(w, h) * (0.7 + rng() * 0.3) : 0.15;
        const out = (type === 'crt' ? deep : 0.12) + rng() * (y < 3 ? 0.5 : 1.2) * (type === 'crt' ? 0.3 : 1);
        const p = V(x0 - side * out, y + h / 2, z - cw / 2 + (rng() - 0.5) * (cw - w) * 0.8);
        if (rng() > 0.06 / F.density && clear(p, Math.max(w, h) * 0.35)) {
          const on = rng() > 0.18, kind = pick(PICTURES), bg = pick(FILL_COLOURS), yaw = -side * Math.PI / 2 + (rng() - 0.5) * 0.5 + side * 0.15;
          const tilt = y > 5 ? -(0.05 + rng() * 0.2) : (rng() - 0.5) * 0.1, roll = (rng() - 0.5) * 0.12, seed = Math.floor(rng() * 1e5);
          const parts = type === 'round' ? roundScreen({ r: Math.min(w, h) / 2, d: 0.5, kind: 'planet', bg: rng() < 0.6 ? 'cobalt' : bg, seed, on })
            : type === 'panel' ? panel({ w: w * 0.92, h: h * 0.9, kind, bg, seed, on, bezel: 0.05 + 0.03 * h })
              : crt({ w, h: h * 0.95, d: deep, kind, bg, seed, on });
          addScreen(kit, M, placeParts(parts, p.x, p.y, p.z, yaw, tilt, roll), pick(M.casing));
        }
        y += h + (rng() < 0.15 ? 0.15 + rng() * 0.4 : 0.02);
      }
      z -= cw + (rng() < 0.15 ? 0.6 + rng() * 1.5 : 0.05);
    }
  }
  // ---- the lane's far end: more screens, small, and the dark beyond
  kit.add(M.far, new THREE.BoxGeometry(R - L + 40, 60, 2).translate((L + R) / 2, 30, F.z1 - 30), NC);
  // ---- cloth awnings and tarps (sheet points: [px, py, d])
  for (const t of o.tarps ?? []) {
    const P = t.pts.map(([px, py, d]) => S(px, py, d).toArray());
    kit.add(pick(M.cloth), tarp(P[0], P[1], P[2], P[3], { sag: t.sag ?? 0.4, seed: t.seed ?? 3, folds: t.folds ?? 3 }), { solid: false, shadow: true });
    if (t.poles) for (const k of [2, 3]) kit.add(M.rope, new THREE.CylinderGeometry(0.025, 0.025, P[k][1], 4).translate(P[k][0], P[k][1] / 2, P[k][2]), NC);
  }
  // ---- the vendors at the walls' feet, bent over their screens; a few walkers far down the lane
  for (const [px, d, yaw, s = 1] of o.vendors ?? []) {
    const f = S(px, SH * cam.horizon, d), Vd = vendor(rng, f.x, 0, f.z, yaw, { s });
    const coat = pick(M.people);
    for (const g of Vd.body) kit.add(coat, g, NC);
    for (const g of Vd.skin) kit.add(M.skin, g, NC);
    for (const g of Vd.seat) kit.add(pick(M.crate), g, NC);
  }
  for (let i = 0; i < (o.walkers ?? 10); i++) {
    const z = -(o.walkFrom ?? 22) - rng() ** 1.4 * 50, x = L + 1.2 + rng() * (R - L - 2.4), s = 0.9 + rng() * 0.15, coat = pick(M.people);
    kit.add(coat, new THREE.CylinderGeometry(0.15 * s, 0.3 * s, 1.35 * s, 7).translate(x, 0.68 * s, z), NC);
    kit.add(coat, new THREE.SphereGeometry(0.19 * s, 7, 5).scale(1.15, 0.7, 0.9).translate(x, 1.37 * s, z), NC);
    kit.add(rng() < 0.5 ? coat : M.skin, new THREE.SphereGeometry(0.13 * s, 7, 5).translate(x, 1.56 * s, z), NC);
  }
  // ---- cables: over the paving near the camera, and slung across the lane overhead
  for (const g of groundCables(rng, L + 1, -3, (L + R) / 2, -14, o.cables ?? 7)) kit.add(M.cable, g, NC);
  for (const g of groundCables(rng, R - 1, -3, (L + R) / 2 + 1, -12, Math.round((o.cables ?? 7) * 0.6))) kit.add(M.cable, g, NC);
  for (let i = 0; i < (o.overhead ?? 14); i++) {
    const z = -4 - rng() * 70, y = F.top[1] + 1 + rng() * 14;
    kit.add(M.cable, tube(sagPts(V(L, y, z), V(R, y + (rng() - 0.5) * 4, z - (rng() - 0.5) * 10), 0.6 + rng() * 2.5, 10), 0.03 + rng() * 0.03, 10, 3), NC);
  }
  for (const [px, py, d, r] of o.lights ?? []) { const p = S(px, py, d); kit.light(p.x, p.y, p.z, r); }
  o.extra?.(kit, M, { S, span, rng });
}

/** The lane's paving: dark slate, big slabs; its pools of screen light in one colour (makeMaterial lampTint). */
const paving = (tint) => ({ height: () => 0, material: { color: MN_TONES.paving, color2: MN_TONES.paving2, color3: MN_TONES.paving3, mode: MODE_TERRAIN, hatch: 0.1, grid: 2.6, ...(tint ? { lampTint: tint } : {}) }, rings: { r1: 900 } });
const view = (o) => ({ sky: SKY.ink, look: MARKETNIGHT_VIEW_LOOK, fog: 0.3, night: 1, world: 'The Signal Market at night', sun: { side: 180, el: 30 }, ...o });

export const MARKETNIGHT_VIEWS = [
  // ===================================================================== reference-1
  view({
    id: 'marketnight-1-lane', title: 'The screen lane at midnight: the violet face, the scarlet portrait, the planet and the desert', sheet: 'marketnight-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 60, horizon: 0.73, shift: true },
    ground: paving(['#b060d0', 0.6]),
    build(kit, v) {
      laneScene(kit, v, {
        seed: 101, left: -3.4, right: 5.6, top: [24, 44], lampTint: ['#d080e0', 0.7],
        fill: { z1: -110 },
        screens: [
          { px: 392, py: 175, wpx: 240, hpx: 400, d: 9, type: 'panel', kind: 'face', bg: 'violet', turn: 0.25, light: 7 },
          { px: 212, py: 565, wpx: 235, hpx: 270, d: 4.2, type: 'crt', kind: 'portrait', bg: 'red', turn: 0.1, light: 5 },
          { px: 390, py: 672, wpx: 105, hpx: 130, d: 4.6, type: 'crt', kind: 'terminal', bg: 'green', turn: 0.15 },
          { px: 1195, py: 240, wpx: 125, hpx: 245, d: 10, type: 'panel', kind: 'food', bg: 'lemon', turn: 0.2 },
          { px: 985, py: 450, wpx: 150, hpx: 220, d: 8, type: 'round', kind: 'planet', bg: 'cobalt', turn: 0.35, light: 5 },
          { px: 1160, py: 500, wpx: 280, hpx: 245, d: 6, type: 'crt', kind: 'desert', bg: 'orange', turn: 0.2, light: 6 },
          { px: 1365, py: 660, wpx: 160, hpx: 155, d: 4.3, type: 'crt', kind: 'glyphs', bg: 'white', turn: 0.15, light: 4 },
          { px: 690, py: 345, wpx: 120, hpx: 175, d: 15, type: 'panel', kind: 'cracked', bg: 'pink', turn: 0.3 },
          { px: 610, py: 380, wpx: 62, hpx: 130, d: 13, type: 'panel', kind: 'cracked', bg: 'pink', turn: 0.4 },
          { px: 870, py: 385, wpx: 80, hpx: 170, d: 15, type: 'panel', kind: 'cracked', bg: 'green', turn: 0.3 },
          { px: 795, py: 360, wpx: 75, hpx: 110, d: 17, type: 'panel', kind: 'bars', bg: 'pink', turn: 0.2 },
          { px: 660, py: 170, wpx: 55, hpx: 140, d: 20, type: 'panel', kind: 'cracked', bg: 'magenta', turn: 0.4 },
          { px: 550, py: 255, wpx: 55, hpx: 190, d: 11, type: 'panel', kind: 'cracked', bg: 'orange', turn: 0.5 },
          { px: 605, py: 230, wpx: 50, hpx: 110, d: 12, type: 'panel', kind: 'bars', bg: 'amber', turn: 0.5 },
          { px: 960, py: 190, wpx: 70, hpx: 110, d: 18, type: 'panel', kind: 'bars', bg: 'pink', turn: 0.4 },
          { px: 1060, py: 235, wpx: 50, hpx: 75, d: 14, type: 'panel', kind: 'glyphs', bg: 'pink', turn: 0.3 },
          { px: 660, py: 525, wpx: 60, hpx: 65, d: 16, type: 'crt', kind: 'bars', bg: 'violet', turn: 0.3 },
          { px: 735, py: 535, wpx: 60, hpx: 50, d: 18, type: 'panel', kind: 'bars', bg: 'amber', turn: 0.3 },
          { px: 800, py: 480, wpx: 70, hpx: 50, d: 16, type: 'panel', kind: 'bars', bg: 'amber', turn: 0.3 },
          { px: 600, py: 535, wpx: 45, hpx: 55, d: 14, type: 'crt', kind: 'bars', bg: 'pink', turn: 0.3 },
        ],
        tarps: [{ pts: [[270, 345, 7], [625, 455, 13], [600, 480, 11], [300, 420, 5]], sag: 0.6, seed: 4 }],
        vendors: [[480, 6.5, Math.PI / 2 + 0.6], [560, 7, Math.PI / 2 + 0.2], [930, 9, -Math.PI / 2 + 0.3], [990, 8.5, -Math.PI / 2 - 0.2]],
        walkers: 14, cables: 8,
        lights: [[720, 600, 12, 6], [1100, 760, 5, 5]],
      });
    },
  }),
  // ===================================================================== reference-2
  view({
    id: 'marketnight-2-tarp', title: 'The lane under the tilted violet face, the hung tarp, the orange pool down the middle', sheet: 'marketnight-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 60, horizon: 0.83, shift: true },
    sky: SKY.indigo,
    ground: paving(['#ffa040', 0.75]),
    build(kit, v) {
      laneScene(kit, v, {
        seed: 202, left: -3.8, right: 4.6, top: [22, 40], lampTint: ['#ff9a50', 0.6],
        fill: { z1: -100 },
        screens: [
          { px: 400, py: 150, wpx: 380, hpx: 330, d: 8, type: 'panel', kind: 'face', bg: 'violet', turn: 0.2, roll: -0.18, light: 6 },
          { px: 155, py: 637, wpx: 230, hpx: 265, d: 3.6, type: 'crt', kind: 'portrait', bg: 'red', turn: 0.1, light: 4 },
          { px: 318, py: 720, wpx: 85, hpx: 70, d: 3.8, type: 'crt', kind: 'terminal', bg: 'cyan', turn: 0.15 },
          { px: 215, py: 455, wpx: 120, hpx: 105, d: 4.5, type: 'crt', kind: 'terminal', bg: 'green', turn: 0.15 },
          { px: 360, py: 380, wpx: 55, hpx: 55, d: 5, type: 'round', kind: 'bars', bg: 'orange', turn: 0.2 },
          { px: 560, py: 220, wpx: 80, hpx: 200, d: 10, type: 'panel', kind: 'cracked', bg: 'pink', turn: 0.4 },
          { px: 535, py: 350, wpx: 60, hpx: 90, d: 10, type: 'panel', kind: 'bars', bg: 'orange', turn: 0.4 },
          { px: 520, py: 425, wpx: 60, hpx: 115, d: 9, type: 'panel', kind: 'cracked', bg: 'pink', turn: 0.4 },
          { px: 640, py: 290, wpx: 72, hpx: 110, d: 12, type: 'panel', kind: 'terminal', bg: 'green', turn: 0.3 },
          { px: 645, py: 430, wpx: 75, hpx: 110, d: 11, type: 'panel', kind: 'cracked', bg: 'pink', turn: 0.3 },
          { px: 650, py: 185, wpx: 62, hpx: 100, d: 14, type: 'panel', kind: 'bars', bg: 'pink', turn: 0.3 },
          { px: 835, py: 85, wpx: 85, hpx: 110, d: 14, type: 'panel', kind: 'cracked', bg: 'pink', turn: 0.3 },
          { px: 955, py: 230, wpx: 150, hpx: 160, d: 9, type: 'panel', kind: 'food', bg: 'lemon', turn: 0.2 },
          { px: 845, py: 235, wpx: 70, hpx: 90, d: 12, type: 'crt', kind: 'bars', bg: 'cobalt', turn: 0.3 },
          { px: 1095, py: 360, wpx: 170, hpx: 190, d: 8, type: 'round', kind: 'planet', bg: 'navy', turn: 0.3, light: 5 },
          { px: 850, py: 345, wpx: 110, hpx: 85, d: 11, type: 'panel', kind: 'cracked', bg: 'pink', turn: 0.3 },
          { px: 775, py: 365, wpx: 50, hpx: 70, d: 14, type: 'panel', kind: 'bars', bg: 'emerald', turn: 0.3 },
          { px: 855, py: 435, wpx: 160, hpx: 110, d: 10, type: 'panel', kind: 'cracked', bg: 'amber', turn: 0.3 },
          { px: 1100, py: 545, wpx: 245, hpx: 165, d: 6, type: 'crt', kind: 'desert', bg: 'orange', turn: 0.2, light: 6 },
          { px: 1305, py: 610, wpx: 140, hpx: 105, d: 4.6, type: 'panel', kind: 'glyphs', bg: 'white', turn: 0.15 },
          { px: 735, py: 480, wpx: 55, hpx: 45, d: 15, type: 'panel', kind: 'bars', bg: 'amber', turn: 0.3 },
          { px: 705, py: 630, wpx: 45, hpx: 35, d: 16, type: 'panel', kind: 'bars', bg: 'amber', turn: 0.3 },
          { px: 545, py: 615, wpx: 70, hpx: 60, d: 9, type: 'crt', kind: 'bars', bg: 'amber', turn: 0.3 },
        ],
        tarps: [{ pts: [[300, 470, 4.5], [600, 545, 7], [570, 745, 7], [330, 765, 4.5]], sag: 0.3, seed: 6, folds: 4 }],
        vendors: [[430, 5.5, Math.PI / 2 + 0.4], [840, 8, -Math.PI / 2 + 0.3], [965, 7, -Math.PI / 2 - 0.3]],
        walkers: 8, walkFrom: 16, cables: 6,
        lights: [[700, 740, 9, 9], [690, 700, 14, 8], [720, 690, 20, 8]],
      });
    },
  }),
  // ===================================================================== reference-3
  view({
    id: 'marketnight-3-awning', title: 'Under the diagonal awning: the great scarlet portrait, the round planet, the white glyphs', sheet: 'marketnight-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 60, horizon: 0.785, shift: true },
    sky: SKY.indigo,
    ground: paving(['#ff70b8', 0.6]),
    build(kit, v) {
      laneScene(kit, v, {
        seed: 303, left: -3.5, right: 5, top: [22, 42], lampTint: ['#e070c0', 0.6],
        fill: { z1: -100 },
        screens: [
          { px: 430, py: 130, wpx: 360, hpx: 290, d: 8, type: 'panel', kind: 'face', bg: 'violet', turn: 0.2, roll: 0.05, light: 6 },
          { px: 130, py: 525, wpx: 265, hpx: 430, d: 3.4, type: 'crt', kind: 'portrait', bg: 'red', turn: 0.15, light: 4 },
          { px: 110, py: 120, wpx: 200, hpx: 250, d: 4.6, type: 'crt', kind: 'bars', on: false, turn: 0.2 },
          { px: 330, py: 615, wpx: 115, hpx: 150, d: 4.2, type: 'crt', kind: 'terminal', bg: 'green', turn: 0.15 },
          { px: 480, py: 665, wpx: 75, hpx: 80, d: 5, type: 'crt', kind: 'portrait', bg: 'red', turn: 0.2 },
          { px: 415, py: 345, wpx: 220, hpx: 110, d: 7, type: 'panel', kind: 'bars', bg: 'pink', turn: 0.3 },
          { px: 610, py: 400, wpx: 115, hpx: 200, d: 8, type: 'panel', kind: 'cracked', bg: 'pink', turn: 0.35 },
          { px: 700, py: 290, wpx: 80, hpx: 100, d: 12, type: 'panel', kind: 'bars', bg: 'pink', turn: 0.3 },
          { px: 720, py: 450, wpx: 60, hpx: 85, d: 12, type: 'panel', kind: 'terminal', bg: 'green', turn: 0.3 },
          { px: 780, py: 470, wpx: 60, hpx: 60, d: 14, type: 'panel', kind: 'bars', bg: 'amber', turn: 0.3 },
          { px: 857, py: 375, wpx: 60, hpx: 125, d: 10, type: 'panel', kind: 'bars', bg: 'cyan', turn: 0.35 },
          { px: 775, py: 120, wpx: 60, hpx: 130, d: 13, type: 'panel', kind: 'food', bg: 'lemon', turn: 0.3 },
          { px: 1020, py: 210, wpx: 170, hpx: 175, d: 8, type: 'panel', kind: 'food', bg: 'lemon', turn: 0.2 },
          { px: 1190, py: 315, wpx: 220, hpx: 230, d: 6, type: 'round', kind: 'planet', bg: 'navy', turn: 0.3, light: 5 },
          { px: 1340, py: 405, wpx: 300, hpx: 230, d: 5, type: 'panel', kind: 'desert', bg: 'orange', turn: 0.25, light: 5 },
          { px: 1250, py: 580, wpx: 190, hpx: 85, d: 4.2, type: 'panel', kind: 'glyphs', bg: 'white', turn: 0.15 },
          { px: 1045, py: 540, wpx: 130, hpx: 120, d: 6.5, type: 'crt', kind: 'bars', bg: 'amber', turn: 0.2 },
          { px: 940, py: 515, wpx: 40, hpx: 85, d: 9, type: 'panel', kind: 'bars', bg: 'pink', turn: 0.3 },
          { px: 885, py: 525, wpx: 40, hpx: 70, d: 10, type: 'panel', kind: 'bars', bg: 'violet', turn: 0.3 },
          { px: 1185, py: 665, wpx: 70, hpx: 55, d: 4.5, type: 'crt', kind: 'portrait', bg: 'red', turn: 0.2 },
        ],
        tarps: [{ pts: [[180, 230, 4.5], [540, 395, 9], [610, 480, 8], [300, 430, 3.8]], sag: 0.5, seed: 8 }],
        vendors: [[1110, 4.6, -Math.PI / 2 - 0.5], [930, 8, -Math.PI / 2], [520, 7, Math.PI / 2 + 0.3]],
        walkers: 10, walkFrom: 14, cables: 7,
        lights: [[735, 700, 12, 6], [700, 760, 6, 4]],
      });
    },
  }),
  // ===================================================================== reference-4
  view({
    id: 'marketnight-4-crouch', title: 'The repairer crouched by the pink and emerald cracked screens, the sepia stacks, the desert', sheet: 'marketnight-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 60, horizon: 0.795, shift: true },
    ground: paving(['#c0b0ff', 0.55]),
    build(kit, v) {
      laneScene(kit, v, {
        seed: 404, left: -3.6, right: 5, top: [22, 40], lampTint: ['#c0a8ff', 0.5],
        fill: { z1: -100 },
        screens: [
          { px: 380, py: 115, wpx: 340, hpx: 270, d: 8, type: 'panel', kind: 'face', bg: 'violet', turn: 0.2, roll: 0.06, light: 6 },
          { px: 530, py: 315, wpx: 140, hpx: 290, d: 8, type: 'panel', kind: 'cracked', bg: 'pink', turn: 0.3, roll: -0.08 },
          { px: 645, py: 410, wpx: 100, hpx: 140, d: 10, type: 'panel', kind: 'cracked', bg: 'emerald', turn: 0.3 },
          { px: 620, py: 205, wpx: 65, hpx: 110, d: 12, type: 'panel', kind: 'cracked', bg: 'amber', turn: 0.35 },
          { px: 250, py: 505, wpx: 150, hpx: 290, d: 4.5, type: 'crt', kind: 'portrait', bg: 'red', turn: 0.15, light: 4 },
          { px: 360, py: 395, wpx: 70, hpx: 110, d: 6, type: 'panel', kind: 'bars', bg: 'apricot', turn: 0.3 },
          { px: 375, py: 665, wpx: 90, hpx: 95, d: 4, type: 'crt', kind: 'terminal', bg: 'green', turn: 0.15 },
          { px: 1285, py: 125, wpx: 190, hpx: 250, d: 8, type: 'panel', kind: 'food', bg: 'lemon', turn: 0.2 },
          { px: 1095, py: 300, wpx: 165, hpx: 235, d: 7, type: 'round', kind: 'planet', bg: 'navy', turn: 0.35 },
          { px: 1235, py: 490, wpx: 335, hpx: 265, d: 5, type: 'panel', kind: 'desert', bg: 'orange', turn: 0.2, light: 6 },
          { px: 900, py: 190, wpx: 165, hpx: 130, d: 9, type: 'panel', kind: 'sepia', bg: 'sepia', turn: 0.3 },
          { px: 915, py: 350, wpx: 170, hpx: 130, d: 9, type: 'crt', kind: 'sepia', bg: 'sepia', turn: 0.3 },
          { px: 900, py: 65, wpx: 170, hpx: 120, d: 11, type: 'panel', kind: 'sepia', bg: 'sepia', turn: 0.3 },
          { px: 1115, py: 685, wpx: 115, hpx: 115, d: 3.6, type: 'crt', kind: 'glyphs', bg: 'white', turn: 0.15, light: 3.5 },
          { px: 1015, py: 600, wpx: 60, hpx: 80, d: 6, type: 'panel', kind: 'glyphs', bg: 'white', turn: 0.2 },
          { px: 880, py: 470, wpx: 75, hpx: 70, d: 10, type: 'panel', kind: 'bars', bg: 'amber', turn: 0.3 },
          { px: 795, py: 320, wpx: 45, hpx: 40, d: 13, type: 'panel', kind: 'bars', bg: 'pink', turn: 0.3 },
          { px: 1030, py: 435, wpx: 40, hpx: 40, d: 8, type: 'round', kind: 'bars', bg: 'cyan', turn: 0.3 },
          { px: 700, py: 510, wpx: 50, hpx: 60, d: 14, type: 'panel', kind: 'bars', bg: 'violet', turn: 0.3 },
        ],
        tarps: [
          { pts: [[0, 40, 3], [320, 150, 4], [300, 245, 4], [0, 235, 3]], sag: 0.3, seed: 2 },
          { pts: [[345, 490, 6], [630, 530, 9], [620, 565, 8], [380, 565, 5.5]], sag: 0.3, seed: 9, poles: true },
          { pts: [[860, 480, 9], [960, 500, 11], [960, 565, 10], [870, 565, 9]], sag: 0.2, seed: 5, poles: true },
        ],
        vendors: [[560, 5.5, Math.PI / 2 + 0.5, 0.95], [905, 11, -Math.PI / 2 + 0.3], [955, 10, -Math.PI / 2 - 0.2]],
        walkers: 10, walkFrom: 16, cables: 7,
        lights: [[1060, 760, 4, 4], [720, 700, 12, 6]],
      });
    },
  }),
];

export { MARKETNIGHT_SHEETS as SHEETS, MARKETNIGHT_VIEWS as VIEWS };
