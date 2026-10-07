import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { MODE_TERRAIN } from '../materials.js';
import { CLEAN_SKY } from './reference-kit.js';
import { travellerFigure } from './underwater-kit.js';
import {
  moon, courtyard, bowl, cradle, hangRig, pillar, roof, gantry, house, tree, jibCrane, gather, moveParts, bar,
  MF_LOOK, MF_DAY, MF_TONES,
} from './moon-foundry-kit.js';

// ---------------------------------------------------------------------------
// The Moon Foundry's reference sheets (references/The Moon Foundry/reference-1 … 4: four 16:9 pictures). An
// abandoned monumental workshop where miniature moons were made: enormous unfinished ivory moons hanging from
// cranes or resting in orange mechanical cradles, cutaway shells with gardens, houses and stairs inside, one
// broken open like an eggshell round a little courtyard, faded orange cranes and pillars, mint-green trees, broad
// gantries between the workstations, a vast open hangar roof framing a pale sky. Each picture is one
// composition: one view each, built by one scene builder (foundryScene) and placed off the sheets' pixels
// (sheetAt: what is drawn at pixel (px, py), d m down the line of sight). reference-views.js describes the fields.
// ---------------------------------------------------------------------------

const sheet = (n) => ({ name: `The Moon Foundry / reference-${n}.jpeg`, size: [1456, 816], url: new URL(`../../references/The Moon Foundry/reference-${n}.jpeg`, import.meta.url).href });
export const MOONFOUNDRY_SHEETS = Object.fromEntries([1, 2, 3, 4].map((n) => [`moonfoundry-${n}`, sheet(n)]));

/** The sheets' ink: the world's look (moon-foundry-kit.js), a clean sky. */
export const MOONFOUNDRY_VIEW_LOOK = { ...MF_LOOK, ...CLEAN_SKY };
/** sky top, horizon, shadow, light, sun: read off each sheet */
const SKY = {
  blue: ['#a9c8d6', '#e6e2d0', '#9a9cb8', '#fff4e2', '#fff0d0'],
  teal: ['#a6c4c4', '#dfe0d0', '#9aa0b4', '#fff4e4', '#fff2d6'],
  mint: ['#a7cec4', '#e4e2cc', '#94a2ae', '#fff2dc', '#fff0d0'],
  green: ['#a4d6c8', '#e2e8cc', '#8ea6a8', '#fff6dc', '#fff4d4'],
};
const T = MF_TONES;

// ---------------------------------------------------------------- the sheets' pixels
const SW = 1456, SH = 816, V = (x, y, z) => new THREE.Vector3(x, y, z);
// (the views' lens is shifted, references.js lensShift: the camera looks level and eye level is the sheet's horizon row)
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
  const DS = THREE.DoubleSide;
  const tone = (k) => o[k] ?? T[k];
  return {
    shell: kit.mat({ color: tone('ivory'), shade: 0.42, hatch: 0.25, line: 0.85 }),
    shellB: kit.mat({ color: tone('ivory2'), shade: 0.42, hatch: 0.25, line: 0.85 }),
    crater: kit.mat({ color: tone('crater'), shade: 0.4, hatch: 0.3, line: 0.7, lineTint: 0.5 }),
    inner: kit.mat({ color: tone('inner'), shade: 0.18, hatch: 0.6, side: DS }),
    edge: kit.mat({ color: tone('edge'), flat: true, shade: 0.5 }),
    rust: kit.mat({ color: tone('rust'), shade: 0.35, hatch: 0.4, detail: 'built', detailDensity: 0.45 }),
    rust2: kit.mat({ color: tone('rust2'), shade: 0.38, hatch: 0.35, detail: 'built', detailDensity: 0.35 }),
    dark: kit.mat({ color: tone('dark'), shade: 0.3, hatch: 0.3, side: DS }),
    steel: kit.mat({ color: tone('steel'), shade: 0.5, hatch: 0.3 }),
    ceiling: kit.mat({ color: tone('ceiling'), shade: 0.5, hatch: 0.2, grid: 2.4, side: DS }),
    strut: kit.mat({ color: tone('strut'), flat: true, thin: 1.5 }),
    plank: kit.mat({ color: tone('plank'), flat: true }),
    wall: kit.mat({ color: tone('wall'), shade: 0.4, hatch: 0.35, detail: 'built', detailDensity: 0.4 }),
    wall2: kit.mat({ color: tone('wall2'), shade: 0.4, hatch: 0.35, detail: 'built', detailDensity: 0.4 }),
    roofing: kit.mat({ color: tone('roofing'), shade: 0.35, hatch: 0.4, side: DS }),
    glow: kit.mat({ color: T.glow, glow: 0.62, flat: true, side: DS }),
    leaf: kit.mat({ color: tone('leaf'), pattern: 'leaves', hatch: 1.1, shade: 0.5, spot: 0, line: 0.7, lineTint: 0.6 }),
    leaf2: kit.mat({ color: tone('leaf2'), pattern: 'leaves', hatch: 1.1, shade: 0.5, spot: 0, line: 0.7, lineTint: 0.6 }),
    trunk: kit.mat({ color: T.trunk, flat: true, thin: 1.5 }),
    floor: kit.mat({ color: tone('wall3'), shade: 0.4, hatch: 0.3 }),
    plated: kit.mat({ color: tone('plated'), shade: 0.4, hatch: 0.3, plates: 2.4 }),
    far: kit.mat({ color: tone('ivory3'), shade: 0.5, hatch: 0.15, line: 0.45, lineTint: 0.6 }),
    olive: kit.mat({ color: '#4c5244', shade: 0.35, hatch: 0.4, detail: 'built', detailDensity: 0.4 }),
    farRust: kit.mat({ color: tone('farRust') ?? '#d69a74', shade: 0.5, hatch: 0.15, line: 0.45, lineTint: 0.6 }),
  };
}
const NC = { solid: false, shadow: true }, NS = { solid: false, shadow: false };
/** Every role of a builder's parts added under its material (by: role → material overrides). */
function addParts(kit, M, parts, by = {}) {
  const map = { shell: M.shell, crater: M.crater, inner: M.inner, edge: M.edge, rust: M.rust, rust2: M.rust2, dark: M.dark, steel: M.steel, ceiling: M.ceiling, strut: M.strut, rail: M.strut, plank: M.plank, wall: M.wall, wall2: M.wall2, roofing: M.roofing, glow: M.glow, leaf: M.leaf, trunk: M.trunk, floor: M.floor, gMetal: M.rust, gDark: M.dark, gPale: M.rust2, ...by };
  for (const [k, list] of Object.entries(parts)) if (Array.isArray(list) && map[k]) for (const g of list) if (g?.isBufferGeometry) kit.add(map[k], g, k === 'ceiling' || k === 'glow' || k === 'leaf' ? NS : NC);
}

/** The direction from c toward the eye (level), turned by yaw (rad, + to the left as seen) and tipped up by pitch. */
const toEye = (cam, c, yaw = 0, pitch = 0) => {
  const d = V(cam.eye[0] - c.x, 0, cam.eye[2] - c.z).normalize().applyAxisAngle(V(0, 1, 0), yaw);
  return d.multiplyScalar(Math.cos(pitch)).add(V(0, Math.sin(pitch), 0)).normalize();
};

/**
 * A panel's scene, its pieces placed off the sheet. o: {
 *   moons: [{ px, py, rpx, d, craters, cut: { yaw, pitch, angle, ragged }, court: courtyard options, cradle: cradle
 *           options | null, hang: { top } | null, mat: 'shell' | 'shellB', inner: material name }],
 *   bowls: [{ px, py (the sphere's centre), rpx, d, cut (the rim's height over the centre, × R), cradle }],
 *   pillars: [{ px, d, r, h, ...pillar options }], cranes: [{ px, d, h, jib, yaw }],
 *   gantries: [{ pts: [[px, py, d]…], w, span }], houses: [[px, d, house options]], trees: [[px, d, s]],
 *   roof: roof options (view frame), far: [{ px, py, rpx, d }…] (plain far moons), farPillars: [[px, d, r]],
 *   traveller: [px, d, yaw] }
 */
function foundryScene(kit, v, o) {
  const rng = mulberry32(o.seed ?? 1), M = materials(kit, o.tones), cam = v.camera;
  const S = (px, py, d) => sheetAt(cam, px, py, d), span = (n, d) => sheetSpan(cam, n, d);
  const floorAt = (px, d) => { const p = S(px, SH * cam.horizon, d); return V(p.x, 0, p.z); };
  if (o.roof) for (const [k, list] of Object.entries(roof(o.roof))) if (Array.isArray(list)) for (const g of list) kit.add(M[k], g, NS);   // (the roof casts no shadow: the sheets light everything under it)
  for (const m of o.moons ?? []) {
    const c = S(m.px, m.py, m.d), R = span(m.rpx, m.d);
    const cut = m.cut ? { dir: toEye(cam, c, m.cut.yaw ?? 0, m.cut.pitch ?? 0), angle: m.cut.angle ?? 0.8, ragged: m.cut.ragged ?? 0.25, thick: m.cut.thick } : null;
    const P = moon({ R, seg: m.seg ?? 64, craters: m.craters ?? 40, seed: m.seed ?? Math.round(m.px), cut });
    addParts(kit, M, moveParts(P, (g) => g.translate(c.x, c.y, c.z)), { shell: M[m.mat ?? 'shell'], inner: M[m.inner ?? 'inner'] });
    if (m.court && cut) {
      const C = courtyard({ R, thick: cut.thick ?? Math.max(0.35, R * 0.03), toward: cut.dir, hole: { dir: cut.dir, angle: cut.angle }, seed: m.seed ?? 3, ...m.court });
      addParts(kit, M, moveParts(C, (g) => g.translate(c.x, c.y, c.z)));
      for (const w of C.windows.slice(0, 4)) kit.light(c.x + w[0], c.y + w[1], c.z + w[2], 3);
    }
    if (m.cradle) addParts(kit, M, moveParts(cradle({ R, yc: c.y, seed: m.seed ?? 5, ...m.cradle }), (g) => g.translate(c.x, 0, c.z)));
    if (m.hang) addParts(kit, M, moveParts(hangRig({ R, top: m.hang.top - c.y, seed: m.seed ?? 7, ...m.hang }), (g) => g.translate(c.x, c.y, c.z)));
  }
  for (const b of o.bowls ?? []) {
    const c = S(b.px, b.py, b.d), R = span(b.rpx, b.d);
    const B = bowl({ R, cutY: R * (b.cut ?? 0.25), seed: b.seed ?? 2, ...(b.opts ?? {}) });
    addParts(kit, M, moveParts(B, (g) => g.translate(c.x, c.y, c.z)), { shell: M[b.mat ?? 'plated'] });
    if (b.cradle) addParts(kit, M, moveParts(cradle({ R, yc: c.y, seed: b.seed ?? 5, ...b.cradle }), (g) => g.translate(c.x, 0, c.z)));
  }
  for (const p of o.pillars ?? []) {
    const f = floorAt(p.px, p.d), P = pillar({ h: p.h ?? (o.roof?.y ?? 70) - (o.roof?.depth ?? 3.2), r: p.r ?? 3, seed: p.seed ?? Math.round(p.px), ...p });
    addParts(kit, M, moveParts(P, (g) => g.translate(f.x, 0, f.z)), p.tone ? { rust: M[p.tone] } : {});
  }
  for (const k of o.cranes ?? []) {
    const f = floorAt(k.px, k.d), P = jibCrane({ h: k.h ?? 40, jib: k.jib ?? 20, seed: k.seed ?? 3, hook: k.hook ?? 14 });
    addParts(kit, M, moveParts(P, (g) => g.rotateY(k.yaw ?? 0).translate(f.x, 0, f.z)));
  }
  for (const gq of o.gantries ?? []) {
    const pts = gq.pts.map(([px, py, d]) => S(px, py, d).toArray());
    addParts(kit, M, gantry(pts, { w: gq.w ?? 2.6, span: gq.span ?? 14, truss: gq.truss ?? 1.4, ground: () => 0, legs: gq.legs ?? true }));
  }
  for (const [px, d, h] of o.houses ?? []) { const f = floorAt(px, d); const H = house({ x: f.x, y: h.y ?? 0, z: f.z, seed: Math.round(px), ...h }); addParts(kit, M, H); }
  for (const [px, d, s, y = 0] of o.trees ?? []) { const f = floorAt(px, d); addParts(kit, M, tree(f.x, y, f.z, s, Math.round(px)), { leaf: rng() < 0.5 ? M.leaf : M.leaf2 }); }
  for (const f of o.far ?? []) {
    const c = S(f.px, f.py, f.d), R = span(f.rpx, f.d);
    addParts(kit, M, moveParts(moon({ R, seg: 40, craters: f.craters ?? 10, seed: Math.round(f.px), detail: 0.7 }), (g) => g.translate(c.x, c.y, c.z)), { shell: M.far, crater: M.far });
    if (f.stand) { const h = c.y - R * 0.9; kit.add(M.farRust, new THREE.CylinderGeometry(R * 0.25, R * 0.32, h, 12).translate(c.x, h / 2, c.z), NS); }
  }
  for (const [px, d, r, h] of o.farPillars ?? []) { const f = floorAt(px, d); kit.add(M.farRust, new THREE.CylinderGeometry(r, r * 1.05, h, 14).translate(f.x, h / 2, f.z), NS); }
  if (o.traveller) { const f = floorAt(o.traveller[0], o.traveller[1]); travellerFigure(kit, f.x, 0, f.z, { yaw: o.traveller[2] ?? Math.PI }); }
  o.extra?.(kit, M, { S, span, floorAt, rng });
}

/** The hangar's floor: level concrete in big slabs. */
const floor = (o = {}) => ({ height: () => 0, material: { color: o.c1 ?? T.floor, color2: o.c2 ?? T.floor2, color3: o.c3 ?? T.floor3, mode: MODE_TERRAIN, hatch: 0.15, grid: 9 }, rings: { r1: 2600 } });
const view = (o) => ({ sky: SKY.blue, look: MOONFOUNDRY_VIEW_LOOK, fog: 0.4, world: 'The Moon Foundry', ...o });

export const MOONFOUNDRY_VIEWS = [
  // ===================================================================== reference-1: the hung moon, the broken one and its courtyard, the bowl
  view({
    id: 'moonfoundry-1-hung', title: 'The hung moon, the moon broken open round its courtyard, the bowl in its cradle', sheet: 'moonfoundry-1', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.6, 0], yaw: 0, fov: 62, horizon: 0.81, shift: true },
    sun: { side: -55, el: 42 },
    ground: floor(),
    build(kit, v) {
      foundryScene(kit, v, {
        seed: 101,
        roof: { x0: -160, x1: 60, z0: -77, z1: 40, y: 62, bay: 22, depth: 4, web: 3.6, cables: 26, seed: 1 },
        moons: [
          { px: 525, py: 250, rpx: 165, d: 56, craters: 34, hang: { top: 62, cables: 2 }, seed: 11 },
          { px: 1098, py: 440, rpx: 255, d: 46, craters: 46, seed: 12, cut: { yaw: 0.4, pitch: 0.05, angle: 0.86, ragged: 0.22 }, court: { houses: 7, trees: 5 }, hang: { top: 62, cables: 2 } },
          { px: 735, py: 470, rpx: 130, d: 120, craters: 20, seed: 13, mat: 'shellB', cradle: { arms: 3, dressing: 0.6 } },
        ],
        bowls: [{ px: 262, py: 545, rpx: 238, d: 30, cut: 0.42, seed: 14, opts: { houses: 2, trees: 3 }, cradle: { arms: 4, drum: 0.5, dressing: 1 } }],
        pillars: [{ px: 40, d: 26, r: 4, h: 58, platform: 0.3, pipes: 5 }, { px: 1410, d: 9, r: 1.6, h: 58, tone: 'steel', pipes: 4, platform: 0 }, { px: 1240, d: 70, r: 2.4, h: 58 }],
        cranes: [{ px: 760, d: 80, h: 36, jib: 18, yaw: 0.4, hook: 10 }],
        gantries: [
          { pts: [[455, 606, 26], [880, 612, 34], [1270, 612, 30]], w: 2.4, span: 12 },
          { pts: [[1090, 650, 30], [1150, 690, 18], [1185, 760, 10]], w: 1.8, legs: false },
        ],
        far: [{ px: 690, py: 690, rpx: 70, d: 110, stand: true }, { px: 440, py: 700, rpx: 40, d: 140 }],
        farPillars: [[600, 160, 3, 50], [980, 190, 3.5, 54], [300, 210, 3, 52]],
        traveller: [1040, 8.4, Math.PI - 0.2],
      });
    },
  }),
  // ===================================================================== reference-2: the great hung moon, the cutaway on its platform, the moon in its cradle
  view({
    id: 'moonfoundry-2-cradle', title: 'The great hung moon, the cutaway shell on its platform, the cratered moon in its cradle', sheet: 'moonfoundry-2', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.25, 0], yaw: 0, fov: 60, horizon: 0.935, shift: true },
    sun: { side: -60, el: 36 },
    sky: SKY.teal,
    ground: floor(),
    build(kit, v) {
      foundryScene(kit, v, {
        seed: 202,
        roof: { x0: -140, x1: 140, z0: -69, z1: 40, y: 66, bay: 20, depth: 3.6, web: 3.2, cables: 30, seed: 2 },
        moons: [
          { px: 585, py: 320, rpx: 215, d: 150, craters: 22, hang: { top: 66, cables: 2 }, seed: 21 },
          { px: 235, py: 410, rpx: 78, d: 190, craters: 10, seed: 22, mat: 'shellB' },
          { px: 497, py: 455, rpx: 160, d: 56, craters: 16, seed: 23, cut: { yaw: -0.2, pitch: 0.1, angle: 0.78, ragged: 0.12 }, court: { houses: 4, trees: 4 }, hang: { top: 66, cables: 1 } },
          { px: 1125, py: 470, rpx: 205, d: 52, craters: 54, seed: 24, cut: { yaw: -0.25, pitch: -0.05, angle: 0.7, ragged: 0.3 }, court: { houses: 5, trees: 4 }, cradle: { arms: 4, drum: 0.58 } },
        ],
        pillars: [{ px: 160, d: 60, r: 2 }, { px: 880, d: 66, r: 2.4 }, { px: 1390, d: 24, r: 3, pipes: 4 }, { px: 40, d: 36, r: 2.6, pipes: 5, platform: 0.45 }],
        gantries: [
          { pts: [[140, 545, 44], [470, 595, 54]], w: 3, span: 12 },
          { pts: [[600, 610, 54], [960, 618, 52]], w: 2.6, span: 12 },
        ],
        extra(kit, M, { S, span }) {
          // the cutaway's platform: a disc on its column under the shell, plants on its edge
          const c = S(497, 590, 56), r = span(150, 56);
          kit.add(M.rust2, new THREE.CylinderGeometry(r, r * 0.92, 2.2, 32).translate(c.x, c.y, c.z), NC);
          kit.add(M.rust, new THREE.CylinderGeometry(r * 0.25, r * 0.35, c.y, 16).translate(c.x, c.y / 2 - 1, c.z), NC);
          for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; addParts(kit, M, tree(c.x + Math.cos(a) * r * 0.85, c.y + 1.1, c.z + Math.sin(a) * r * 0.85, 1.1 + (k % 3) * 0.4, k)); }
        },
        far: [{ px: 762, py: 610, rpx: 72, d: 130, stand: true }, { px: 190, py: 700, rpx: 40, d: 150 }, { px: 880, py: 700, rpx: 36, d: 160 }, { px: 1160, py: 740, rpx: 26, d: 180 }],
        farPillars: [[360, 220, 3, 60], [700, 260, 3, 60], [1010, 240, 3, 60]],
        traveller: [795, 18.5, Math.PI],
      });
    },
  }),
  // ===================================================================== reference-3: the two cradled moons, the far one between the pillars
  view({
    id: 'moonfoundry-3-claws', title: 'Two moons in their claws, the far moon between the pillars, the bridge across', sheet: 'moonfoundry-3', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.25, 0], yaw: 0, fov: 60, horizon: 0.9, shift: true },
    sun: { side: -70, el: 34 },
    sky: SKY.mint,
    ground: floor({ c1: '#d4cfbe' }),
    build(kit, v) {
      foundryScene(kit, v, {
        seed: 303,
        roof: { x0: -140, x1: 140, z0: -83, z1: 40, y: 70, bay: 20, depth: 4, web: 3.4, cables: 30, seed: 3 },
        moons: [
          { px: 300, py: 445, rpx: 220, d: 38, craters: 30, seed: 31, cut: { yaw: -0.35, pitch: 0.1, angle: 0.72, ragged: 0.5 }, court: { houses: 3, trees: 4, terrace: false }, cradle: { arms: 4, drum: 0.45 }, hang: { top: 70, cables: 2 } },
          { px: 1170, py: 440, rpx: 190, d: 40, craters: 26, seed: 32, cut: { yaw: 0.25, pitch: 0.05, angle: 0.8, ragged: 0.4 }, court: { houses: 4, trees: 6, terrace: false }, cradle: { arms: 4, drum: 0.45 }, hang: { top: 70, cables: 2 } },
          { px: 730, py: 300, rpx: 190, d: 200, craters: 18, seed: 33, hang: { top: 70, cables: 1 } },
        ],
        pillars: [{ px: 590, d: 62, r: 2.4 }, { px: 650, d: 64, r: 2.4 }, { px: 980, d: 90, r: 2.6 }, { px: 1410, d: 24, r: 2.4 }, { px: 20, d: 26, r: 2.4 }, { px: 1220, d: 52, r: 2 }],
        gantries: [
          { pts: [[520, 520, 60], [1000, 525, 62]], w: 4, span: 14, truss: 2.4 },
          { pts: [[700, 575, 50], [960, 560, 56]], w: 3, span: 12 },
          { pts: [[470, 610, 42], [650, 625, 46]], w: 3, span: 12 },
        ],
        far: [{ px: 875, py: 470, rpx: 42, d: 150 }, { px: 955, py: 650, rpx: 62, d: 110, stand: true }, { px: 800, py: 690, rpx: 36, d: 140 }],
        farPillars: [[450, 210, 3, 64], [820, 230, 3, 64], [1100, 220, 3, 64]],
        trees: [[40, 9, 1.6], [1420, 8, 1.8], [1350, 10, 1.2], [120, 12, 1.2]],
        traveller: [745, 11.4, Math.PI],
      });
    },
  }),
  // ===================================================================== reference-4: the shells open on their gardens, the moon on its pillar, the long bridge
  view({
    id: 'moonfoundry-4-gardens', title: 'The shells open on their gardens, the moon on its pillar, the long bridge', sheet: 'moonfoundry-4', panel: 1, where: 'the whole picture', crop: [0, 0, 1456, 816],
    camera: { eye: [0, 1.25, 0], yaw: 0, fov: 60, horizon: 0.89, shift: true },
    sun: { side: -45, el: 44 },
    sky: SKY.green,
    ground: floor({ c1: '#cfd0c0', c2: '#c4c6b4' }),
    build(kit, v) {
      foundryScene(kit, v, {
        seed: 404,
        tones: { inner: T.innerMint, ivory: '#ebe8d2', ivory2: '#e4e2cc', leaf: '#5f9a8a', leaf2: '#78ae9c' },
        roof: { x0: -20, x1: 160, z0: -71, z1: 40, y: 64, bay: 20, depth: 3.6, web: 3.2, cables: 34, seed: 4 },
        moons: [
          { px: 330, py: 262, rpx: 212, d: 40, craters: 20, seed: 41, cut: { yaw: -0.7, pitch: 0.2, angle: 0.95, ragged: 0.5 }, court: { houses: 3, trees: 6 } },
          { px: 790, py: 318, rpx: 122, d: 90, craters: 8, seed: 42, mat: 'shellB' },
          { px: 562, py: 545, rpx: 118, d: 52, craters: 10, seed: 43 },
          { px: 1102, py: 420, rpx: 232, d: 38, craters: 60, seed: 44, cut: { yaw: -0.35, pitch: -0.05, angle: 0.88, ragged: 0.18 }, court: { houses: 3, trees: 7 }, hang: { top: 64, cables: 3 } },
        ],
        pillars: [{ px: 535, d: 70, r: 2.2 }, { px: 30, d: 14, r: 3, tone: 'olive' }, { px: 1290, d: 60, r: 1.6 }],
        gantries: [{ pts: [[420, 490, 40], [870, 562, 42]], w: 1.8, span: 30, truss: 0.9 }],
        extra(kit, M, { S, span, floorAt }) {
          // the stack under the left shell: houses on scaffolds, its stairs (the sheet's lived-in machinery)
          const c = S(330, 262, 40), R = span(212, 40);
          const base = c.y - R * 0.95;
          kit.add(M.rust, new THREE.CylinderGeometry(R * 0.45, R * 0.6, base, 18).translate(c.x, base / 2, c.z), NC);
          for (const [dx, dz, y, w, d, f] of [[-0.6, 0.5, 0, 6, 5, 2], [0.5, 0.7, 0, 5, 4, 2], [0.1, 0.9, base * 0.55, 5, 4, 1], [-0.9, 0.2, base * 0.4, 4, 4, 1]]) addParts(kit, M, house({ x: c.x + dx * R, y, z: c.z + dz * R, w, d, floors: f, yaw: 0.2, seed: Math.round(dx * 100 + dz * 10), lit: 0.4 }));
          // the moon on its pillar: the pillar under it, a little house on its crown's shoulder
          const p = S(790, 318, 90), pr = span(122, 90);
          const ph = p.y - pr * 0.92;
          addParts(kit, M, moveParts(pillar({ h: ph, r: 3.4, seed: 9, platform: 0.8, rings: 5, pipes: 2 }), (g) => g.translate(p.x, 0, p.z)));
          addParts(kit, M, house({ x: p.x - pr * 0.15, y: ph * 0.8, z: p.z + 5, w: 4, d: 3, floors: 1, seed: 5, lit: 0.3 }));
          // the right moon's base: machinery under it
          const q = S(1102, 420, 38), qR = span(232, 38), qy = q.y - qR * 0.92;
          kit.add(M.rust2, new THREE.CylinderGeometry(qR * 0.7, qR * 0.8, qy, 20).translate(q.x, qy / 2, q.z), NC);
          kit.add(M.dark, new THREE.TorusGeometry(qR * 0.72, 0.4, 4, 24).rotateX(Math.PI / 2).translate(q.x, qy * 0.7, q.z), NC);
          void floorAt;
        },
        far: [{ px: 570, py: 330, rpx: 30, d: 160 }],
        farPillars: [[690, 240, 3, 64], [980, 260, 3, 64]],
        trees: [[1330, 30, 2.2], [1410, 26, 2], [400, 40, 2.6]],
        traveller: [620, 8, Math.PI + 0.1],
      });
    },
  }),
];

export { MOONFOUNDRY_SHEETS as SHEETS, MOONFOUNDRY_VIEWS as VIEWS };
