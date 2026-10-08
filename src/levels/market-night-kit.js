import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { put } from './lab-kit.js';
import { cloth } from './salt-harbour-kit.js';

// ---------------------------------------------------------------------------
// The Signal Market at night: its screens and their colours, shared by the market's night (bazaar.js: its
// billboards and shop signs turn into the sheets' screens after dark) and the References views of the night
// sheets (reference-marketnight.js), after references/The Signal Market - Night/reference-1 … 4: a narrow lane
// of the market after midnight, its walls stacked with second-hand screens of every age and size (bulky CRTs,
// flat panels, a round monitor, small terminals), each lit in its own flat saturated colour and showing its own
// picture (a pale alien face on violet, a scarlet portrait, an acid-green terminal, a lemon fruit advert, a
// planet on cobalt, a desert on orange, black glyphs on white, pink and emerald screens cracked across), some
// dim or switched off; the walls between them matte and nearly black, cloth awnings, cables over the ground,
// vendors repairing screens at the walls' feet, a few walkers far down the lane, a black slit of sky.
//
//   SCREEN          the sheets' screen colours (lit), and what each picture is drawn in
//   MN_TONES        the lane's other tones: the walls, the casings, cloth, the paving, the people
//   PICTURES        the pictures a screen shows: face, portrait, terminal, food, planet, desert, glyphs,
//                   cracked, bars (picture(kind, w, h, seed): coloured flat shapes, its own frame)
//   crt / panel / roundScreen   a screen's body: a CRT's deep casing, a flat panel's thin bezel, the round
//                   monitor's drum; each returns { casing, dark, screen } geometries (screen: vertex-coloured)
//   tarp            a cloth awning or a hung tarp (salt-harbour-kit's cloth)
//   vendor          someone sat at a wall's foot over a screen they are mending
//   nightPaint      the night colours of the market's own billboards (bazaar.js)
// Everything is authored facing +z, its front at z = 0, centred on x and y, then put where it goes.
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** The screens' colours, read off the sheets (lit): the backgrounds, then what their pictures are drawn in. */
export const SCREEN = {
  violet: '#9468ee', lilac: '#d9ccff', violetDark: '#5e3fb0',
  red: '#f0444a', redDark: '#8e1f2c', skin: '#ff8a78',
  green: '#80f04c', greenDark: '#3d8a2a',
  lemon: '#f6ee58', cream: '#fff6c8', fruit: ['#e8402e', '#ff9a2e', '#5fbf3c', '#b0306e'],
  cobalt: '#3346d8', navy: '#1c2370', planet: '#d2cce8',
  orange: '#ffa63a', orangeDark: '#d0661e', apricot: '#ffcf86',
  white: '#eef0fa', black: '#1a1a24',
  pink: '#f660d2', magenta: '#e842b8', crack: '#3a1440',
  emerald: '#2ee8a2', cyan: '#4fd6ec', amber: '#ffb648',
  sepia: '#b07a3c', sepiaDark: '#5a3a1c',
};
/** Background colours for the screens that fill the walls (weighted as the sheets have them: pink and violet most). */
export const FILL_COLOURS = ['pink', 'pink', 'magenta', 'violet', 'violet', 'orange', 'amber', 'lemon', 'green', 'emerald', 'cyan', 'cobalt', 'red', 'apricot', 'white'];
export const MN_TONES = {
  wall: '#243040', wall2: '#2a3444', wall3: '#30383c', far: '#18202c',   // (v0.94: a slate teal, not near-black)
  // (v0.94: the casings a shade lighter, the bezels catch their screens' light)
  casing: ['#5a6056', '#686458', '#505662', '#5c6270', '#706a5c'], casingDark: '#1a1d24',
  off: '#2c3448',
  cloth: ['#8e8a74', '#7c808c', '#9a8e7a'], rope: '#1a1c22',
  paving: '#30497a', paving2: '#2c4372', paving3: '#364f80',   // (v0.94: the pictures' saturated night blue)
  cable: '#12141c', crate: '#36322a', crate2: '#2c3038',
  people: ['#4b5a7a', '#6c4e5c', '#5a6650', '#7a6a52', '#3e4660', '#80606a'], skin: '#9a7a70',
};

/** A geometry painted one colour (a `color` attribute), for the vertex-coloured screen material. */
export function paint(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const disc = (rx, ry, x, y, z, seg = 20) => new THREE.CircleGeometry(1, seg).scale(rx, ry, 1).translate(x, y, z);
const rect = (w, h, x, y, z, rz = 0) => new THREE.PlaneGeometry(w, h).rotateZ(rz).translate(x, y, z);
/** A crack: a jagged line of thin strips from a, wandering n steps. */
function crackLines(rng, w, h, z, n = 3) {
  const out = [];
  for (let k = 0; k < n; k++) {
    let x = (rng() - 0.5) * w * 0.8, y = (rng() - 0.5) * h * 0.8, a = rng() * TAU;
    for (let s = 0; s < 5 + Math.floor(rng() * 4); s++) {
      const L = Math.min(w, h) * (0.08 + rng() * 0.14), nx = x + Math.cos(a) * L, ny = y + Math.sin(a) * L;
      if (Math.abs(nx) > w / 2 - 0.02 || Math.abs(ny) > h / 2 - 0.02) break;
      out.push(rect(L, Math.min(w, h) * 0.018 + 0.006, (x + nx) / 2, (y + ny) / 2, z, a));
      x = nx; y = ny; a += (rng() - 0.5) * 1.6;
    }
  }
  return out;
}

/**
 * A screen's picture, w × h, on a background of `bg` (a SCREEN key or a colour): coloured flat shapes laid a
 * hair apart in front of z = 0. Returns painted geometries (merge them with the screen material).
 */
export function picture(kind, w, h, { seed = 1, bg = null } = {}) {
  const rng = mulberry32(seed * 977 + 13), S = SCREEN, out = [], col = (k) => S[k] ?? k;
  const z0 = 0.004, z1 = 0.01, z2 = 0.016, m = Math.min(w, h);
  const add = (g, k) => out.push(paint(g, col(k)));
  const BG = { face: 'violet', portrait: 'red', terminal: 'green', food: 'lemon', planet: 'cobalt', desert: 'orange', glyphs: 'white', cracked: 'pink', bars: 'amber', sepia: 'sepia' };
  add(rect(w, h, 0, 0, z0), bg ?? BG[kind] ?? 'pink');
  if (kind === 'face') {
    // a pale alien head in three-quarter view: its long skull swelling behind, one deep socket and the far eye, the
    // long neck, the shoulders' line (reference-1 … 4's great violet screen)
    const hx = (rng() - 0.5) * w * 0.12;
    add(disc(w * 0.25, h * 0.33, hx, h * 0.14, z1, 28), 'lilac');
    add(disc(w * 0.2, h * 0.22, hx + w * 0.13, h * 0.26, z1 + 0.001, 24), 'lilac');
    const neck = new THREE.Shape();
    neck.moveTo(hx - w * 0.13, -h * 0.12); neck.lineTo(hx + w * 0.1, -h * 0.1); neck.lineTo(hx + w * 0.16, -h * 0.42); neck.lineTo(hx - w * 0.2, -h * 0.44);
    out.push(paint(new THREE.ShapeGeometry(neck).translate(0, 0, z1), col('lilac')));
    add(disc(w * 0.46, h * 0.1, hx, -h * 0.5, z1, 24), 'lilac');
    add(disc(w * 0.075, h * 0.065, hx - w * 0.07, h * 0.1, z2, 14), 'violetDark');
    add(disc(w * 0.03, h * 0.045, hx + w * 0.11, h * 0.11, z2, 10), 'violetDark');
    add(rect(w * 0.12, h * 0.012, hx - w * 0.02, -h * 0.07, z2, 0.15), 'violetDark');
    add(rect(w * 0.01, h * 0.2, hx + w * 0.04, -h * 0.28, z2, 0.1), 'violetDark');
  } else if (kind === 'portrait') {
    // a scarlet portrait: the shoulders and the neck, the face turned a little, its eyes and mouth, the hair over one side
    add(disc(w * 0.42, h * 0.16, 0, -h * 0.48, z1, 22), 'redDark');
    add(rect(w * 0.13, h * 0.2, w * 0.02, -h * 0.28, z1), 'skin');
    add(disc(w * 0.17, h * 0.25, w * 0.03, h * 0.02, z1 + 0.001, 22), 'skin');
    const hair = new THREE.Shape();
    hair.moveTo(-w * 0.22, -h * 0.12); hair.quadraticCurveTo(-w * 0.26, h * 0.34, w * 0.02, h * 0.36); hair.quadraticCurveTo(w * 0.24, h * 0.34, w * 0.2, h * 0.12);
    hair.quadraticCurveTo(w * 0.05, h * 0.26, -w * 0.12, h * 0.12); hair.quadraticCurveTo(-w * 0.14, -h * 0.02, -w * 0.22, -h * 0.12);
    out.push(paint(new THREE.ShapeGeometry(hair, 8).translate(0, 0, z2), col('redDark')));
    for (const ex of [-0.05, 0.1]) add(disc(w * 0.03, h * 0.015, w * ex, h * 0.03, z2, 8), 'redDark');
    add(rect(w * 0.08, h * 0.012, w * 0.04, -h * 0.12, z2), 'redDark');
  } else if (kind === 'terminal') {
    for (let k = 0; k < 4; k++) add(rect(w * (0.3 + rng() * 0.4), h * 0.035, -w * 0.1, h * (0.25 - k * 0.15), z1), 'greenDark');
  } else if (kind === 'food') {
    // a fruit advert: a pale frame, fruit heaped in it
    add(rect(w * 0.78, h * 0.78, 0, 0, z1), 'cream');
    for (let k = 0; k < 7; k++) {
      const r = m * (0.08 + rng() * 0.07);
      add(disc(r, r * (0.8 + rng() * 0.4), (rng() - 0.5) * w * 0.45, (rng() - 0.45) * h * 0.45, z2 + k * 0.002, 14), S.fruit[k % S.fruit.length]);
    }
  } else if (kind === 'planet') {
    // a planet and its ring on deep blue
    const r = m * 0.24;
    add(disc(r, r, 0, 0, z1, 24), 'planet');
    add(new THREE.RingGeometry(r * 1.35, r * 1.6, 28).scale(1, 0.24, 1).rotateZ(-0.15).translate(0, 0, z2), 'navy');
  } else if (kind === 'desert') {
    // a desert under an orange sky: the far mesa, the plain's lines
    add(rect(w, h * 0.38, 0, -h * 0.31, z1), 'orangeDark');
    const s = new THREE.Shape(), mx = (rng() - 0.3) * w * 0.3, base = -h * 0.12;
    s.moveTo(mx - w * 0.28, base); s.lineTo(mx - w * 0.15, base + h * 0.22); s.lineTo(mx + w * 0.08, base + h * 0.24); s.lineTo(mx + w * 0.22, base);
    out.push(paint(new THREE.ShapeGeometry(s).translate(0, 0, z1), col('orangeDark')));
    for (let k = 0; k < 3; k++) add(rect(w * (0.5 - k * 0.12), h * 0.012, (rng() - 0.5) * w * 0.2, -h * (0.22 + k * 0.08), z2), 'apricot');
  } else if (kind === 'glyphs') {
    // black glyph blocks on white, a few to a line
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if (rng() < 0.8) {
      const gw = w * (0.08 + rng() * 0.1), gh = h * (0.12 + rng() * 0.14);
      add(rect(gw, gh, (c - 1.5) * w * 0.21 + (rng() - 0.5) * w * 0.04, (1 - r) * h * 0.27, z1), 'black');
    }
  } else if (kind === 'cracked') {
    for (const g of crackLines(rng, w, h, z1, 2 + Math.floor(rng() * 3))) add(g, 'crack');
  } else if (kind === 'bars') {
    for (let k = 0; k < 3; k++) add(rect(w * (0.25 + rng() * 0.5), h * 0.09, (rng() - 0.5) * w * 0.3, h * (0.25 - k * 0.25), z1), S.black);
  } else if (kind === 'sepia') {
    for (let k = 0; k < 4; k++) add(disc(m * (0.1 + rng() * 0.12), m * (0.12 + rng() * 0.15), (rng() - 0.5) * w * 0.6, (rng() - 0.5) * h * 0.5, z1 + k * 0.002, 12), 'sepiaDark');
  }
  return out;
}
export const PICTURES = ['face', 'portrait', 'terminal', 'food', 'planet', 'desert', 'glyphs', 'cracked', 'bars', 'sepia'];

/**
 * A CRT: a deep casing (w × h, d deep), its tapered back, the screen inset in its bezel (sw × sh of the face), the
 * knobs and grille under it on a big one. on: false draws the screen dark (switched off). Returns { casing, dark,
 * screen, off }: geometries in its own frame (front at z = 0, centred).
 */
export function crt({ w = 1, h = 0.85, d = 0.8, kind = 'bars', bg = null, on = true, seed = 1, grille = h > 0.7 } = {}) {
  const sw = w * 0.8, sh = h * (grille ? 0.68 : 0.78), sy = grille ? h * 0.1 : 0;
  const casing = [
    new THREE.BoxGeometry(w, h, d * 0.55).translate(0, 0, -d * 0.275),
    new THREE.BoxGeometry(w * 0.72, h * 0.74, d * 0.45).translate(0, h * 0.02, -d * 0.55 - d * 0.225),
  ];
  const dark = [
    // the bezel's lip round the screen, a hair proud of the casing's front
    new THREE.BoxGeometry(sw + w * 0.06, h * 0.025, 0.03).translate(0, sy + sh / 2 + h * 0.012, 0.012),
    new THREE.BoxGeometry(sw + w * 0.06, h * 0.025, 0.03).translate(0, sy - sh / 2 - h * 0.012, 0.012),
  ];
  if (grille) {
    for (let k = 0; k < 3; k++) dark.push(new THREE.BoxGeometry(w * 0.3, h * 0.012, 0.02).translate(-w * 0.2, -h * 0.36 + k * h * 0.035, 0.008));
    for (const x of [w * 0.18, w * 0.32]) dark.push(new THREE.CylinderGeometry(w * 0.035, w * 0.035, 0.05, 8).rotateX(Math.PI / 2).translate(x, -h * 0.37, 0.02));
  }
  // vents down the casing's sides
  for (const e of [-1, 1]) for (let k = 0; k < 4; k++) dark.push(new THREE.BoxGeometry(0.02, h * 0.02, d * 0.3).translate(e * (w / 2 + 0.005), h * (0.25 - k * 0.07), -d * 0.3));
  const screen = [], off = [];
  if (on) for (const g of picture(kind, sw, sh, { seed, bg })) screen.push(g.translate(0, sy, 0.02));
  else off.push(new THREE.PlaneGeometry(sw, sh).translate(0, sy, 0.024));
  return { casing, dark, screen, off };
}
/** A flat panel: a thin bezel (w × h, 0.12 deep), the screen filling it. */
export function panel({ w = 2, h = 1.2, kind = 'bars', bg = null, on = true, seed = 1, bezel = 0.08 } = {}) {
  const casing = [new THREE.BoxGeometry(w + bezel * 2, h + bezel * 2, 0.12).translate(0, 0, -0.06)];
  const screen = [], off = [];
  if (on) for (const g of picture(kind, w, h, { seed, bg })) screen.push(g.translate(0, 0, 0.006));
  else off.push(new THREE.PlaneGeometry(w, h).translate(0, 0, 0.01));
  return { casing, dark: [], screen, off };
}
/** The round monitor: a drum (radius r) with a heavy rim, its round screen (the planet). */
export function roundScreen({ r = 1, d = 0.6, kind = 'planet', bg = null, on = true, seed = 1 } = {}) {
  const casing = [new THREE.CylinderGeometry(r * 1.12, r * 1.05, d, 28).rotateX(Math.PI / 2).translate(0, 0, -d / 2)];
  const dark = [new THREE.TorusGeometry(r * 1.04, r * 0.07, 6, 32).translate(0, 0, 0.01)];
  const screen = [], off = [];
  if (on) {
    const pics = picture(kind, r * 1.6, r * 1.6, { seed, bg });
    pics[0] = paint(new THREE.CircleGeometry(r, 32).translate(0, 0, 0.004), SCREEN[bg] ?? bg ?? SCREEN.cobalt);
    for (const g of pics) screen.push(g.translate(0, 0, 0.012));
  } else off.push(new THREE.CircleGeometry(r, 28).translate(0, 0, 0.02));
  return { casing, dark, screen, off };
}

/** Each part of a screen's body put at (x, y, z) facing yaw (from +z), tipped by tilt (rad, about its own x) and roll. */
export function placeParts(parts, x, y, z, yaw = 0, tilt = 0, roll = 0) {
  for (const list of Object.values(parts)) for (const g of list) put(g, x, y, z, yaw, 1, tilt, roll);
  return parts;
}

/** A cloth awning from the edge A → B (on a wall) out to C → D, sagging (salt-harbour-kit's cloth). */
export function tarp(A, B, C, D, { sag = 0.5, seed = 1, folds = 3 } = {}) {
  return cloth(A, B, C, D, { sag, folds, fold: 0.18, nu: 14, nv: 7, droop: 0.5, seed });
}

/**
 * Someone sat on a crate at a wall's foot (x, z), facing yaw, bent over a screen on their knees: geometries by part
 * (body, skin, hat) for the people's materials.
 */
export function vendor(rng, x, y, z, yaw, { s = 1 } = {}) {
  const c = Math.cos(yaw), sn = Math.sin(yaw), f = (d, u = 0) => [x + sn * d + c * u, z + c * d - sn * u];
  const body = [], skin = [], seat = [];
  seat.push(put(new THREE.BoxGeometry(0.5 * s, 0.42 * s, 0.45 * s), x, y + 0.21 * s, z, yaw));
  const [bx, bz] = f(0.02);
  body.push(put(new THREE.LatheGeometry([[0.02, 0], [0.32, 0.02], [0.3, 0.25], [0.22, 0.55], [0.16, 0.68], [0.05, 0.74], [0.02, 0.75]].map(([r, h]) => new THREE.Vector2(r * s, h * s)), 9), bx, y + 0.42 * s, bz, yaw, 1, 0.42));
  const [kx, kz] = f(0.3);
  body.push(put(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.5 * s, 6).rotateX(Math.PI / 2), kx, y + 0.5 * s, kz, yaw));
  const [hx, hz] = f(0.3);
  const head = new THREE.SphereGeometry(0.13 * s, 8, 6).scale(1, 1.1, 1).translate(hx, y + 1.18 * s, hz);
  if (rng() < 0.5) { body.push(head); body.push(put(new THREE.ConeGeometry(0.15 * s, 0.2 * s, 7), hx, y + 1.32 * s, hz, yaw, 1, -0.5)); }
  else { skin.push(head); body.push(put(new THREE.CylinderGeometry(0.14 * s, 0.15 * s, 0.07 * s, 9), hx, y + 1.3 * s, hz, yaw, 1, 0.3)); }
  for (const e of [-1, 1]) { const [ax, az] = f(0.32, e * 0.17 * s); body.push(put(new THREE.CylinderGeometry(0.045 * s, 0.04 * s, 0.42 * s, 5).rotateX(1.2), ax, y + 0.85 * s, az, yaw)); }
  return { body, skin, seat };
}

/** Cables lying over the ground: a few loose runs from (x0, z0) wandering toward (x1, z1). */
export function groundCables(rng, x0, z0, x1, z1, n = 6, r = 0.035) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const pts = [];
    const a = V(x0 + (rng() - 0.5) * 2, 0.04, z0 + (rng() - 0.5) * 2), b = V(x1 + (rng() - 0.5) * 2, 0.04, z1 + (rng() - 0.5) * 3);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, p = a.clone().lerp(b, t);
      p.x += Math.sin(t * 5 + k) * 0.8 * (rng() * 0.6 + 0.4); p.z += (rng() - 0.5) * 0.6;
      pts.push(p);
    }
    out.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 4, false));
  }
  return out;
}

// ------------------------------------------------------------------ the market's own billboards by night (bazaar.js)
/**
 * The night look of one of bazaar.js's billboards (by its seed and picture: seed % 3, 0 a head, 1 a planet, 2 the
 * glyph strokes): its screen's colour and its picture's, as the sheets light them. Returns { bg, fig, dark, light }
 * (colours), the poster's parts painted with them by night (makeMaterial nightPaint).
 */
export function nightPaint(seed) {
  const S = SCREEN, k = ((seed % 3) + 3) % 3, n = Math.abs(Math.floor(seed * 2654435761) >>> 0);
  if (k === 0) return [{ bg: S.violet, fig: S.lilac, dark: S.violetDark, light: S.lilac }, { bg: S.red, fig: S.skin, dark: S.redDark, light: S.cream }, { bg: S.pink, fig: S.lilac, dark: S.crack, light: S.cream }][n % 3];
  if (k === 1) return [{ bg: S.cobalt, fig: S.planet, dark: S.navy, light: S.apricot }, { bg: S.orange, fig: S.apricot, dark: S.orangeDark, light: S.cream }, { bg: S.emerald, fig: S.cream, dark: S.greenDark, light: S.white }][n % 3];
  return [{ bg: S.lemon, fig: S.cream, dark: S.black, light: S.white }, { bg: S.white, fig: S.black, dark: S.black, light: S.black }, { bg: S.magenta, fig: S.cream, dark: S.crack, light: S.cream }, { bg: S.green, fig: S.greenDark, dark: S.greenDark, light: S.cream }][n % 4];
}

/**
 * The market's night (bazaar.js's colour script, its night palette): a black-indigo sky, the street's far glow a deep
 * indigo, the towers' shade and the moonlight dark, so the walls are dark masses round their lit screens, as the night
 * sheets draw them. [sky top, horizon, shadow tint, light tint, moon]
 */
export const MARKET_NIGHT = ['#0b0e1e', '#232a4a', '#26344e', '#52608a', '#ece6d2'];   // (v0.94: the shade a slate blue, the moonlight a little stronger)
/** The lanterns' pools on the street by night: warm apricot against the indigo (makeMaterial lampTint). */
export const LANTERN_TINT = ['#ffb070', 0.8];
/** How many lanterns light pools at once by night (the nearest to the traveller) and how far each reaches (m). */
export const NIGHT_LIGHTS = { count: 6, r: 9 };
/** The share of the market's crowd gone home after midnight (crowd.js away). */
export const NIGHT_CROWD_AWAY = 0.5;
