import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise2D, fbm, mulberry32, smoothstep, lerp } from '../noise.js';
import { makeMaterial, MODE_TERRAIN, MODE_STRATA } from '../materials.js';
import { Terrain } from '../world.js';
import { Bird } from '../bird.js';

// ---------------------------------------------------------------------------
// Vael II: The Sky Stones. Bone-white needle clusters, balanced stones and
// wide mushroom tables rise out of a sea of cloud. Cliff-top monasteries and
// ruined aqueducts link the plateaus; past them a peach plain runs to a lone
// tower. Rock is drawn flat cream in light and blue-grey in shade, with dense
// ink under every overhang.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
const nA = createNoise2D(1975), nB = createNoise2D(2112), nC = createNoise2D(77);

// ---------------------------------------------------------------- layout
const CLOUD_Y = -36;          // the cloud deck; below UNSAFE_Y you are put back
const UNSAFE_Y = -44;
const PLAIN_Y = 38;
const PLAIN_EDGE = -900;
const START = { x: 0, z: 0, R: 88, top: 40, dome: 1.2 };
const MONASTERY = { x: -240, z: -215, R: 72, top: 76, dome: 1 };
const NEEDLES = { x: 215, z: -250, R: 95, top: 40, dome: 1 };
const TABLE = { x: -30, z: -450, R: 58, top: 64, dome: 5 };      // the great mushroom table
const ISLAND = { x: 240, z: -520, R: 32, top: 128, dome: 1.2 };  // floating monastery island
const DISC = { x: -128, z: -78, top: 70, R: 9.5 };               // column with a disc cap and an egg
const TOWER = { x: 70, z: -1500 };
const AQ1 = { a: [52, -58], b: [150, -178], y: 40 };              // start plateau -> needle plateau
const plainEdge = (x) => PLAIN_EDGE + nA(x * 0.004, 3.1) * 40 + nB(x * 0.013, 9) * 10;
const AQ2 = { a: [215, -325], b: [215, plainEdge(215) - 30], y: 40 };   // needle plateau -> the plain
// the story's places (src/story/arzach2.js)
const BELL = { x: -228, z: -239, w: 7.5, h: 30 };                 // the monastery's bell tower (its open belfry)
// sky stones climbing from the great table's east rim: each a boost-jump above the last
const SKY = [[32, -446.3, 66.6, 2.7], [36.5, -439.5, 70.2, 2.4], [34, -433, 73.2, 2.8], [39.5, -429, 76.2, 2.4], [45, -432.5, 79.2, 2.4],
  [49, -437.5, 82.2, 2.8], [51.5, -444, 85.2, 2.4], [48.5, -450, 88.2, 2.4], [42.5, -452.5, 91.2, 3.4]];
const CAIRN = { x: -18, z: -438 };                                 // on the great table, toward the stones
const CLAPPER = { x: 251, z: -503 };                               // on the floating island, before the church door
const FACE = {};                                                   // filled in when the tower is built

const tableTop = (t, r = 0) => t.top + t.dome * (1 - Math.min((r / t.R) ** 2, 1));
const aq1Mid = [(AQ1.a[0] + AQ1.b[0]) / 2, (AQ1.a[1] + AQ1.b[1]) / 2];

export const ARZACH2_CONTENT = {
  weather: [],
  // the story is a quest (src/story/arzach2-data.js): this page closes when the bell has rung and Calix has given you its note
  story: {
    title: 'THE BELL UNDER THE CLOUD',
    intro: 'The stones float above a sea of cloud. On the rose cliff, a monastery bell has been silent for thirty years.',
    outro: 'The bell rang. The cloud settled a hand’s width, and the floating stones came down a little. Nobody can say which caused which.',
    label: 'the lone tower', goal: [TOWER.x, 'ground', TOWER.z], radius: 30, manual: true,
  },
  relics: {
    spots: [
      { at: [MONASTERY.x + 18, tableTop(MONASTERY, 20) + 1.1, MONASTERY.z + 6], snap: true },
      { at: [DISC.x + 5, DISC.top + 1.1, DISC.z], snap: true },
      { at: [TABLE.x, tableTop(TABLE) + 1.1, TABLE.z], snap: true },
      { at: [aq1Mid[0], AQ1.y + 1.1, aq1Mid[1]], snap: true },
      { at: [ISLAND.x - 12, tableTop(ISLAND, 12) + 1.1, ISLAND.z + 8], snap: true },
    ],
    names: ['Bell-rope tassel', 'Egg-stone pebble', 'Mushroom-cap seed', 'Aqueduct keystone', 'Island prayer bead'],
  },
  npcs: [
    { at: [-14, 30], y: START.top, radius: 5, palette: { cloak: '#b9a7d8', lining: '#2b211f', cloth: '#e2d3b4', legs: '#2b2f45' },
      lines: ['~solemn~ The stones fell up, long ago. Some of them never came down.', '~neutral~ Whistle and the bird will come. She does not like the cloud.'] },
    { at: [MONASTERY.x - 20, MONASTERY.z - 22], y: MONASTERY.top, radius: 4, palette: { cloak: '#f3ead8', lining: '#2b211f', cloth: '#6a3a4a', legs: '#4a3a2a' },
      lines: ['~sad~ The bell has not rung since the cloud rose.', '~scared~ From the tower roof you can see the plain. Nobody goes there.'] },
    { at: [195, -1010], radius: 6, palette: { cloak: '#e9a17f', lining: '#2b211f', cloth: '#343a56', legs: '#3a3a3a' },
      lines: ['~tired~ Walk toward the tower. It does not get closer for a long time.', '~solemn~ The cracks in the plain are older than the sky.'], shy: true },
  ],
};

// ---------------------------------------------------------------- geometry helpers

/** Keep only positions (non-indexed) so everything merges. */
function clean(g) {
  const n = g.index ? g.toNonIndexed() : g;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', n.getAttribute('position').clone());
  return out;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function place(g, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  return g.applyMatrix4(_m4.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz)));
}
/** Lumpy displacement along the direction from the origin (position-based, so seams stay welded). */
function lumpy(g, amt, freq, seed = 0) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amt * (nA(x * freq + seed, y * freq - z * freq * 0.7) * 0.7 + nB(z * freq * 2.1 - seed, y * freq * 2.1 + x) * 0.3);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return g;
}

/**
 * A closed rock body made of horizontal rings. Each ring is {y, r, ox, oz};
 * shape(a, ring) -> [radius multiplier, y offset] gives the outline, flutes
 * and ribs. The profile runs from the foot, up the side, under any overhang,
 * over the rim and onto the top, so every face points outward.
 */
function solid(rings, seg, shape, { top = null, bottom = null } = {}) {
  const P = rings.map((rg) => {
    const ring = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU;
      const [m, dy] = shape ? shape(a, rg) : [1, 0];
      ring.push([rg.ox + Math.cos(a) * rg.r * m, rg.y + dy, rg.oz + Math.sin(a) * rg.r * m]);
    }
    return ring;
  });
  const pos = [];
  const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < P.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = P[i][j], b = P[i][j2], c = P[i + 1][j], d = P[i + 1][j2];
      tri(a, c, b); tri(b, c, d);
    }
  }
  if (top) { const L = P[P.length - 1]; for (let j = 0; j < seg; j++) tri(L[j], top, L[(j + 1) % seg]); }
  if (bottom) { const F = P[0]; for (let j = 0; j < seg; j++) tri(F[j], F[(j + 1) % seg], bottom); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/**
 * Mushroom table / plateau: an eroded, fluted stalk, a wide cap with a
 * ribbed (radiating) underside, a rounded rim and a gently domed top.
 * off shifts the cap relative to the stalk for one-sided overhangs.
 */
function table(o) {
  const { x, z, R, stalk, top, base = -120, dome = 1, seed = 0, rib = 0, ribK = 24, flute = 0.08, fluteK = 11,
    outline = 0.14, waist = 0.12, foot = 1.25, neckR = 1, seg = 112, colSeg = 18, ledges = 0 } = o;
  const capT = o.capT ?? R * 0.16, under = o.under ?? R * 0.22, off = o.off ?? [0, 0];
  const neckY = top - capT - under;
  const rings = [];
  const NS = ledges ? 14 : 8;
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    const step = ledges * (i % 2 ? 1 : -0.4) * (0.5 + 0.5 * nC(i * 1.7, seed));   // strata ledges
    rings.push({ y: lerp(base, neckY, t) + (i % 2 || i === NS ? 0 : ledges * 30 * nC(i, seed + 3)), r: stalk * (lerp(foot, neckR, Math.pow(t, 0.7)) - waist * Math.sin(Math.PI * t) + step), ox: 0, oz: 0, kind: 's', u: t });
  }
  const NU = 10;
  for (let i = 1; i <= NU; i++) {
    const u = i / NU, w = Math.pow(u, 0.8);
    rings.push({ y: neckY + under * Math.pow(u, 1.9), r: lerp(stalk * neckR * 1.04, R, Math.pow(u, 0.7)), ox: off[0] * w, oz: off[1] * w, kind: 'u', u });
  }
  const [ox, oz] = off;
  rings.push({ y: top - capT * 0.55, r: R * 1.015, ox, oz, kind: 'c' });
  rings.push({ y: top - capT * 0.14, r: R * 0.975, ox, oz, kind: 'c' });
  for (const k of [0.9, 0.72, 0.5, 0.26]) rings.push({ y: top + dome * (1 - k * k), r: R * k, ox, oz, kind: 't' });
  const stalkLine = (ca, sa, y) => 1 + 0.13 * nB(ca * 1.4 + seed + y * 0.006, sa * 1.4 + y * 0.011);
  const capLine = (ca, sa) => 1 + outline * nA(ca * 1.1 + seed, sa * 1.1 - seed) + outline * 0.35 * nB(ca * 3 + seed, sa * 3 - seed);
  const shape = (detail) => (a, rg) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    if (rg.kind === 's') {
      const fl = detail ? 1 - flute * Math.pow(0.5 + 0.5 * Math.sin(fluteK * a + 2.5 * nA(ca + seed, sa + rg.y * 0.02)), 3) : 1;
      return [stalkLine(ca, sa, rg.y) * fl, 0];
    }
    if (rg.kind === 'u') {
      const m = lerp(stalkLine(ca, sa, rg.y), capLine(ca, sa), Math.pow(rg.u, 0.6));
      const dy = detail && rib && rg.u < 0.7 ? -rib * Math.pow(Math.abs(Math.sin(ribK * a)), 0.6) * Math.sin(Math.PI * rg.u / 0.7) * (0.55 + 0.45 * nB(ca * 5 + seed, sa * 5)) : 0;
      return [m, dy];
    }
    return [capLine(ca, sa), 0];
  };
  const apex = [x + ox, top + dome, z + oz];
  const vis = place(solid(rings, seg, shape(true), { top: [ox, top + dome, oz] }), x, 0, z);
  // the collision copy keeps every other stalk / underside ring
  const coarse = rings.filter((rg, i) => rg.kind === 'c' || rg.kind === 't' || i % 2 === 0 || i === NS || i === rings.length - 1);
  const col = place(solid(coarse, colSeg, shape(false), { top: [ox, top + dome, oz] }), x, 0, z);
  // a slightly shrunken copy that casts the shadow, so the cap never shadows its own rim
  const inner = coarse.map((rg) => ({ ...rg, r: rg.r * 0.95, y: rg.y - Math.min(0.8, R * 0.03) }));
  const shadow = place(solid(inner, colSeg, shape(false), { top: [ox, top + dome * 0.9, oz] }), x, 0, z);
  return { vis, col, shadow, apex };
}

/** A needle spire: slender, lumpy, vertically fluted, with shoulders. */
function needle(o) {
  const { x, y, z, H, R, seed = 0, seg = 16, rings = 24, flute = 0.16, lean = 0.06 } = o;
  const rng = mulberry32(Math.floor(seed * 1000) + 7);
  const k = 4 + Math.floor(rng() * 4);
  const sh = [[0.2 + rng() * 0.3, 0.12 + rng() * 0.2], [0.5 + rng() * 0.3, 0.08 + rng() * 0.15]];
  const la = rng() * TAU;
  // a stalagmite-like taper: a flared foot, waxy shoulders, a blunt rounded tip
  const prof = (t) => {
    let r = (1 + 0.45 * Math.pow(1 - t, 10)) * (1 - 0.86 * Math.pow(t, 1.15));
    for (const [t0, s] of sh) r *= 1 + s * Math.exp(-(((t - t0) / 0.06) ** 2));
    return r;
  };
  const make = (sg, nr, detail) => {
    const rs = [{ y: -R * 0.8, r: R * 1.35, ox: 0, oz: 0, t: 0 }];
    for (let i = 0; i < nr; i++) {
      const t = (i / nr) * 0.985;
      const bend = lean * H * t * t;
      const tip = t > 0.93 ? Math.sqrt(Math.max(1 - ((t - 0.93) / 0.07) ** 2, 0.08)) : 1;
      rs.push({ y: t * H, r: R * prof(t) * tip, ox: Math.cos(la) * bend, oz: Math.sin(la) * bend, t });
    }
    const shape = (a, rg) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      let m = 1 + 0.15 * nA(ca * 1.5 + seed * 3, sa * 1.5 + rg.t * 7);
      if (detail) {
        m += 0.07 * nB(ca * 3 + seed, sa * 3 + rg.t * 16);
        m *= 1 - flute * (1 - rg.t * 0.6) * Math.pow(0.5 + 0.5 * Math.cos(k * a + 1.6 * nB(rg.t * 2.5, seed * 5)), 3);
      }
      return [m, 0];
    };
    const bend = lean * H;
    return place(solid(rs, sg, shape, { top: [Math.cos(la) * bend, H * 0.997, Math.sin(la) * bend] }), x, y, z);
  };
  return { vis: make(seg, rings, true), col: make(6, 5, false), tip: [x, y + H, z] };
}

/** Rounded boulder / egg. */
function boulder(r, sx, sy, sz, egg = 0, seed = 0, detail = true) {
  const g = detail ? new THREE.SphereGeometry(1, 14, 10) : new THREE.IcosahedronGeometry(1, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const yy = p.getY(i), k = 1 - egg * yy;
    p.setXYZ(i, p.getX(i) * k, yy, p.getZ(i) * k);
  }
  lumpy(g, detail ? 0.1 : 0.05, 1.3, seed);
  g.scale(r * sx, r * sy, r * sz);
  return clean(g);
}

/**
 * Aqueduct / natural arch: a deck from a to b at deckY(u), with arches
 * opening below it and piers dropping into the cloud.
 */
function bridge(o) {
  const { a, b, y0, y1 = y0, W = 9, bays = 4, pier = 0.28, rise = 1, thick = 4, bottom = -120, seed = 0, rough = 0.5, ends = 0.06, flare = 0, step = 1.1, bulge = 0 } = o;
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, px = -uz, pz = ux;
  const n = Math.ceil(L / step), sp = (L * (1 - 2 * ends)) / bays, half = (sp * (1 - pier)) / 2;
  const S = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * L, deck = lerp(y0, y1, s / L);
    const sl = s - L * ends;
    let yb = bottom, inPier = true;
    if (sl > 0 && sl < L * (1 - 2 * ends)) {
      const q = sl - Math.floor(sl / sp) * sp, xq = (q - sp / 2) / half;
      if (Math.abs(xq) < 1) { inPier = false; yb = deck - thick - half * rise * (1 - Math.sqrt(1 - xq * xq)); }
    }
    const nn = nA(s * 0.15 + seed, seed), nm = nB(s * 0.05 + seed, 3), nr = nC(s * 0.045 + seed, 7);
    if (!inPier) yb += (nr * 2.2 + nn * 0.4) * rough;
    const w = W * (inPier ? 1.14 : 1) * (1 + 0.06 * nm + flare * Math.pow(Math.abs(2 * s / L - 1), 3)) + nn * rough;
    S.push({ cx: a[0] + ux * s, cz: a[1] + uz * s, top: deck, yb: Math.min(yb, deck - thick * 0.6), w });
  }
  const pos = [];
  const v = (s, side, yy, k = 1) => [s.cx + px * side * s.w * 0.5 * k, yy, s.cz + pz * side * s.w * 0.5 * k];
  const quad = (p0, p1, p2, p3) => pos.push(...p0, ...p1, ...p2, ...p1, ...p3, ...p2);
  // natural arches bulge out along the middle of their flanks and narrow underneath
  const mid = (s) => s.top - Math.min(thick * 0.45, (s.top - s.yb) * 0.4);
  const kb = 1 - bulge * 0.5;
  for (let i = 0; i < n; i++) {
    const A = S[i], B = S[i + 1];
    quad(v(A, -1, A.top), v(A, 1, A.top), v(B, -1, B.top), v(B, 1, B.top));       // deck
    for (const sd of [1, -1]) {
      const top = [v(A, sd, A.top), v(B, sd, B.top)], md = [v(A, sd, mid(A), 1 + bulge), v(B, sd, mid(B), 1 + bulge)], bt = [v(A, sd, A.yb, kb), v(B, sd, B.yb, kb)];
      if (sd > 0) { quad(top[0], md[0], top[1], md[1]); quad(md[0], bt[0], md[1], bt[1]); }
      else { quad(md[0], top[0], md[1], top[1]); quad(bt[0], md[0], bt[1], md[1]); }
    }
    quad(v(A, 1, A.yb, kb), v(A, -1, A.yb, kb), v(B, 1, B.yb, kb), v(B, -1, B.yb, kb));   // underside / arch intrados
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return { g, S, ux, uz, px, pz, L };
}

// ---------------------------------------------------------------- terrain
function height(x, z) {
  const edge = plainEdge(x);
  const floor = -110 + fbm(nB, x * 0.003, z * 0.003, 3) * 12;
  let plain = PLAIN_Y + fbm(nA, x * 0.0016, z * 0.0016, 3) * 4 + nB(x * 0.02, z * 0.02) * 0.4;
  // the far plain rises a touch toward the horizon
  plain += smoothstep(-1900, -2500, z) * 18;
  const dl = Math.hypot((x - AQ2.b[0]) * 1.2, Math.min(z - AQ2.b[1], 0) * 0.8);
  plain = lerp(AQ2.y - 0.15, plain, smoothstep(26, 70, dl));
  // dark fissures cracking the plain
  const wx = x + nB(x * 0.003, z * 0.003) * 90, wz = z + nA(x * 0.003 + 5, z * 0.003) * 90;
  const f = 1 - Math.abs(nC(wx * 0.0024, wz * 0.0024));
  let crack = smoothstep(0.95, 0.985, f) * 16;
  crack *= smoothstep(edge - 50, edge - 130, z) * smoothstep(60, 110, Math.hypot(x - TOWER.x, z - TOWER.z)) * smoothstep(50, 90, dl);
  plain -= crack;
  const h = lerp(floor, plain, smoothstep(edge + 22, edge - 22, z));
  // low far mesas close the horizon
  const rim = Math.max(Math.abs(x), Math.abs(z));
  return h + smoothstep(2000, 2550, rim) * (55 + fbm(nA, x * 0.0015, z * 0.0015, 2) * 25);
}

// ---------------------------------------------------------------- the level
export function createArzach2(scene) {
  const rng = mulberry32(2026);
  const R = (a, b) => a + rng() * (b - a);
  const terrain = new Terrain({
    size: 5200, seg: 320, height,
    material: { color: '#eda584', color2: '#f2b48f', color3: '#c98f86', mode: MODE_TERRAIN, ripples: true },
  });
  scene.add(terrain.mesh);

  const DS = THREE.DoubleSide;
  const M = {
    bone: makeMaterial({ color: '#f3ead8', color2: '#f0e4cf', color3: '#f5ede0', mode: MODE_STRATA, strataSize: 7, flat: true, side: DS }),
    cap: makeMaterial({ color: '#f5e5d1', color2: '#f3e0cb', color3: '#f6e9d8', mode: MODE_STRATA, strataSize: 5, side: DS }),   // smooth: clean terminator under the caps
    rose: makeMaterial({ color: '#d9a59a', color2: '#c98f86', color3: '#e3b5a8', mode: MODE_STRATA, strataSize: 9, flat: true, side: DS }),
    aq: makeMaterial({ color: '#ece3d3', color2: '#e0d5c4', color3: '#f2ebde', mode: MODE_STRATA, strataSize: 2.6, flat: true, side: DS }),
    wall: makeMaterial({ color: '#f8f3ea', flat: true, pattern: 'facade' }),
    plainWall: makeMaterial({ color: '#f6efe2', flat: true }),
    roof: makeMaterial({ color: '#c9765c', flat: true, pattern: 'tiles' }),
    dome: makeMaterial({ color: '#cf8164', flat: true }),
    dark: makeMaterial({ color: '#3c4660', flat: true }),
    tree: makeMaterial({ color: '#5d7562', flat: true }),
    tower: makeMaterial({ color: '#f4ecdc', color2: '#ebdfc8', color3: '#f8f2e6', mode: MODE_STRATA, strataSize: 9, flat: true }),
  };
  const vis = new Map();
  const col = [];
  const add = (mat, g, proxy = g) => {
    if (!vis.has(mat)) vis.set(mat, []);
    vis.get(mat).push(clean(g));
    if (proxy) col.push(clean(proxy));
  };
  const movers = [];
  const noShadow = [];

  // ---------------------------------------------------------- plateaus and mushroom tables
  const shadowGeos = [];
  const addTable = (mat, o) => { const t = table(o); add(mat, t.vis, t.col); if (mat === M.cap) shadowGeos.push(clean(t.shadow)); return t; };
  // the start plateau: a wide table with an overhanging lip
  addTable(M.bone, { ...START, stalk: 70, capT: 6, under: 11, seed: 1.3, rib: 1.3, ribK: 44, seg: 176, colSeg: 24, outline: 0.15, foot: 0.92, neckR: 0.97, waist: 0.03, ledges: 0.05, flute: 0.1, fluteK: 23 });
  // the monastery cliff: rose rock, the lip leaning out toward the start
  addTable(M.rose, { ...MONASTERY, stalk: 62, capT: 6, under: 9, seed: 4.1, rib: 1.6, ribK: 40, seg: 160, colSeg: 22, off: [20, 12], foot: 0.95, neckR: 0.97, waist: 0.03, ledges: 0.05, flute: 0.1, fluteK: 21 });
  // the needle plateau
  addTable(M.bone, { ...NEEDLES, stalk: 78, capT: 6, under: 10, seed: 7.7, rib: 1.2, ribK: 44, seg: 176, colSeg: 24, off: [-10, 0], foot: 0.92, waist: 0.03, ledges: 0.05, flute: 0.1, fluteK: 25 });
  // the great mushroom table
  addTable(M.cap, { ...TABLE, stalk: 17, capT: 7, under: 20, seed: 2.2, rib: 2.4, ribK: 36, seg: 160, colSeg: 26, outline: 0.1, flute: 0.12, fluteK: 13, foot: 1.5, neckR: 1.25, waist: 0.22 });
  // smaller tables rising from the cloud sea, and some on the plain
  const HOODOOS = [
    [-120, -330, 26, 30], [95, -410, 22, 50], [-170, -545, 34, 22], [340, -110, 30, 56], [-330, 30, 24, 36],
    [160, 95, 20, 26], [390, -430, 28, 32], [-70, 170, 30, 46], [-370, -390, 22, 58], [110, -560, 16, 70],
    [470, -260, 18, 24], [-460, -40, 26, 20], [-60, -720, 30, 44], [120, -800, 24, 30], [-260, -760, 36, 52], [380, -720, 26, 40],
  ];
  const tables = [START, MONASTERY, NEEDLES, TABLE].map((t) => ({ x: t.x, z: t.z, R: t.R }));
  HOODOOS.forEach(([x, z, r, top], i) => {
    addTable(M.cap, { x, z, R: r, top, dome: r * 0.07, stalk: r * R(0.28, 0.38), capT: r * R(0.1, 0.15), under: r * R(0.26, 0.36),
      seed: i * 3.7 + 0.4, rib: r * 0.04, ribK: 30, seg: 112, colSeg: 18, flute: 0.1, fluteK: 9 + (i % 5), foot: 1.6, neckR: 1.3, waist: 0.24,
      off: [R(-0.12, 0.12) * r, R(-0.12, 0.12) * r] });
    tables.push({ x, z, R: r });
  });
  // tables standing on the peach plain, framing the tower
  const PLAIN_HOODOOS = [[150, -1060, 46, 58], [80, -1020, 18, 17], [-140, -1090, 30, 30], [330, -1210, 24, 22], [-330, -1260, 36, 34]];
  PLAIN_HOODOOS.forEach(([x, z, r, h], i) => {
    const base = terrain.baseAt(x, z, r * 0.4);
    addTable(M.cap, { x, z, R: r, top: base + h, base: base - 4, dome: r * 0.08, stalk: r * R(0.32, 0.42), capT: r * 0.13, under: r * 0.3,
      seed: 30 + i * 2.9, rib: r * 0.045, ribK: 32, seg: 128, colSeg: 18, flute: 0.11, fluteK: 10 + i, foot: 1.5, neckR: 1.25, waist: 0.2, off: [r * 0.1, 0] });
  });
  // rose cliff walls on the west and east of the chasm
  const ROSE = [[-480, -320, 44, 96], [-520, -140, 36, 82], [-430, -520, 40, 60], [540, -180, 48, 72], [520, -420, 34, 90], [-540, 120, 40, 50]];
  ROSE.forEach(([x, z, r, top], i) => {
    addTable(M.rose, { x, z, R: r, top, dome: 0.8, stalk: r * 0.82, capT: r * 0.2, under: r * 0.2, seed: 50 + i * 1.7, rib: 0.8, ribK: 30, seg: 96, colSeg: 18,
      flute: 0.1, fluteK: 14, foot: 0.9, neckR: 0.95, waist: 0.04, outline: 0.18 });
    tables.push({ x, z, R: r });
  });

  // ---------------------------------------------------------- the floating island
  {
    const { x, z, R: r, top } = ISLAND;
    const rs = [[-50, 0.06], [-47, 0.2], [-41, 0.38], [-32, 0.57], [-22, 0.74], [-12, 0.88], [-5, 0.97], [-1.6, 1.02], [-0.3, 0.975]].map(([y, s]) => ({ y: top + y, r: r * s, ox: 0, oz: 0 }));
    for (const k of [0.9, 0.7, 0.45, 0.2]) rs.push({ y: top + ISLAND.dome * (1 - k * k), r: r * k, ox: 0, oz: 0 });
    const shape = (detail) => (a, rg) => {
      const ca = Math.cos(a), sa = Math.sin(a);
      let m = 1 + 0.16 * nA(ca * 1.3 + 9, sa * 1.3 + rg.y * 0.02);
      if (detail && rg.y < top - 3) m *= 1 - 0.1 * Math.pow(0.5 + 0.5 * Math.sin(13 * a + 2 * nB(ca, sa + rg.y * 0.05)), 3);
      return [m, 0];
    };
    add(M.bone, place(solid(rs, 96, shape(true), { top: [0, top + ISLAND.dome, 0], bottom: [3, top - 53, 2] }), x, 0, z),
      place(solid(rs, 18, shape(false), { top: [0, top + ISLAND.dome, 0] }), x, 0, z));
  }

  // ---------------------------------------------------------- needle clusters
  const cluster = (cx, cy, cz, H, Rr, n, seed, rubble = true, mat = M.bone) => {
    const r2 = mulberry32(seed * 97 + 3);
    const nd = needle({ x: cx, y: cy, z: cz, H, R: Rr, seed: seed + 0.1, seg: 18, rings: 28, lean: (r2() - 0.5) * 0.08 });
    add(mat, nd.vis, nd.col);
    for (let i = 0; i < n; i++) {
      // the first few lean on the main needle like wax drips, the rest stand apart
      const fused = i < Math.ceil(n / 2), a = r2() * TAU, d = Rr * (fused ? 0.55 + r2() * 0.4 : 1.3 + r2() * 1.5);
      const h = H * (fused ? 0.22 + r2() * 0.4 : 0.15 + Math.pow(r2(), 1.3) * 0.5), rr = Rr * (fused ? 0.4 + r2() * 0.25 : 0.3 + r2() * 0.35);
      const s = needle({ x: cx + Math.cos(a) * d, y: cy - 1, z: cz + Math.sin(a) * d, H: h, R: rr, seed: seed + i * 1.37 + 0.5, seg: 14, rings: 20, lean: (r2() - 0.5) * 0.25 });
      add(mat, s.vis, s.col);
    }
    if (!rubble) return nd;
    // rounded boulder piles at the foot
    for (let i = 0; i < 9 + n; i++) {
      const a = r2() * TAU, d = Rr * (0.6 + r2() * 2.2), br = Rr * (0.18 + r2() * 0.32);
      const bx = cx + Math.cos(a) * d, bz = cz + Math.sin(a) * d;
      const sx = 1 + r2() * 0.4, sy = 0.65 + r2() * 0.3, sz = 0.9 + r2() * 0.3, ry = r2() * TAU;
      add(mat, place(boulder(br, sx, sy, sz, 0.1, seed + i), bx, cy + br * sy * 0.35, bz, ry),
        place(boulder(br, sx, sy, sz, 0.1, seed + i, false), bx, cy + br * sy * 0.35, bz, ry));
    }
    // a low rubble mound round the base
    const mound = new THREE.SphereGeometry(1, 22, 6, 0, TAU, 0, Math.PI / 2);
    lumpy(mound, 0.18, 1.6, seed);
    const mr = Rr * 2.6, mh = Rr * 0.7;
    const moundLo = new THREE.SphereGeometry(1, 10, 3, 0, TAU, 0, Math.PI / 2);
    add(mat, place(mound, cx, cy - 0.5, cz, 0, mr, mh, mr), place(moundLo, cx, cy - 0.5, cz, 0, mr, mh * 0.95, mr));
    return nd;
  };
  // on the start plateau
  cluster(-48, START.top, -30, 74, 7.5, 5, 1);
  // the great needle forest on the needle plateau
  cluster(NEEDLES.x + 10, NEEDLES.top, NEEDLES.z - 8, 175, 15, 7, 2);
  cluster(NEEDLES.x - 42, NEEDLES.top, NEEDLES.z + 40, 96, 9, 5, 3);
  cluster(NEEDLES.x + 55, NEEDLES.top, NEEDLES.z + 30, 70, 7, 4, 4);
  // rising straight out of the cloud
  const CLOUD_NEEDLES = [[-95, -215, 170, 13, 6], [420, -300, 210, 16, 7], [40, -640, 140, 12, 5], [0, 330, 190, 15, 6], [310, 220, 150, 12, 5],
    [-260, 260, 170, 13, 6], [-330, -190, 130, 10, 4], [330, -620, 160, 12, 5], [-620, -300, 240, 18, 7], [640, -60, 220, 16, 6],
    [-180, -840, 170, 13, 6], [60, -860, 120, 10, 4], [-420, -700, 200, 15, 6]];
  CLOUD_NEEDLES.forEach(([x, z, h, r, n], i) => { if (h) cluster(x, -70, z, h + 70, r, n, 10 + i, false); });
  // needle clusters on the plain
  [[-280, -1030, 120, 10, 6], [380, -1140, 150, 12, 6], [-60, -1650, 110, 9, 5], [260, -1700, 90, 8, 4], [-420, -1410, 170, 14, 6]].forEach(([x, z, h, r, n], i) => {
    cluster(x, terrain.baseAt(x, z, r * 2) + 0.5, z, h, r, n, 30 + i);
  });

  // ---------------------------------------------------------- balanced stones
  const stack = (x, y, z, stones, seed, mat = M.bone) => {
    const r2 = mulberry32(seed * 31 + 1);
    let yy = y;
    let ox = 0, oz = 0;
    for (const [r, sy, egg] of stones) {
      const sx = 1 + r2() * 0.25, sz = 0.85 + r2() * 0.3, ry = r2() * TAU, tilt = (r2() - 0.5) * 0.25;
      yy += r * sy * 0.92;
      add(mat, place(boulder(r, sx, sy, sz, egg, seed + yy), x + ox, yy, z + oz, ry, 1, 1, 1, tilt, -tilt),
        place(boulder(r, sx, sy, sz, egg, seed + yy, false), x + ox, yy, z + oz, ry, 1, 1, 1, tilt, -tilt));
      yy += r * sy * 0.92;
      ox += (r2() - 0.5) * r * 0.35; oz += (r2() - 0.5) * r * 0.35;
    }
    return yy;
  };
  // on the start plateau: a teetering column of pebbles
  stack(36, START.top - 0.5, -42, [[5.5, 0.62, 0.05], [4.6, 0.72, 0.1], [3.8, 0.8, 0.15], [3.2, 0.68, 0.05], [2.4, 0.9, 0.2]], 1);
  stack(58, START.top - 0.5, 20, [[3.2, 0.6, 0], [2.6, 0.8, 0.1], [1.8, 0.85, 0.2]], 2);
  // on the needle plateau
  stack(NEEDLES.x - 40, NEEDLES.top - 0.5, NEEDLES.z - 50, [[7, 0.6, 0], [6, 0.75, 0.1], [4.6, 0.85, 0.1], [3.2, 0.95, 0.25]], 3);
  // on the plain
  stack(30, terrain.heightAt(30, -1140) - 0.5, -1140, [[6, 0.55, 0], [5, 0.8, 0.1], [4.2, 0.7, 0], [3.4, 0.9, 0.2], [2.2, 1, 0.25]], 4);
  stack(-200, terrain.heightAt(-200, -1190) - 0.5, -1190, [[4, 0.6, 0], [3.4, 0.8, 0.1], [2.4, 1.1, 0.25]], 5);
  // a tall stone column out of the cloud, with mushroom discs and stacked stones (page 2)
  {
    const x = 128, z = -92;
    const col0 = needle({ x, y: -80, z, H: 120, R: 7, seed: 41, seg: 14, rings: 18, flute: 0.1, lean: 0 });
    add(M.bone, col0.vis, col0.col);
    const disc = (dx, y, dz, rr, th) => {
      const t = table({ x: x + dx, z: z + dz, R: rr, stalk: rr * 0.18, top: y, base: y - th * 2.5, capT: th, under: th * 0.6, dome: th * 0.3, seed: y * 0.1, rib: 0.4, ribK: 20, seg: 64, colSeg: 14, foot: 1, neckR: 1, waist: 0 });
      add(M.cap, t.vis, t.col);
    };
    disc(0, 30, 0, 8, 1.4);
    const y1 = stack(x, 31, z, [[3.8, 0.75, 0.1], [3.4, 0.9, 0.15], [2.6, 0.7, 0.05]], 6);
    disc(0.5, y1 + 2.5, 0.3, 11, 1.6);
    stack(x + 0.5, y1 + 3.5, z + 0.3, [[2.8, 0.8, 0.2], [2, 0.9, 0.2]], 7);
  }
  // the disc column with an egg resting above it (page 1)
  {
    const { x, z, top, R: r } = DISC;
    const shaft = table({ x, z, R: r, stalk: 3.6, top, base: -95, capT: 1.8, under: 2.4, dome: 0.35, seed: 61, rib: 0.35, ribK: 22, seg: 96, colSeg: 16,
      flute: 0.14, fluteK: 7, foot: 2.1, neckR: 0.85, waist: 0.05 });
    add(M.bone, shaft.vis, shaft.col);
    add(M.bone, place(boulder(0.9, 1, 0.8, 1, 0, 3), x, top + 1.6, z), null);   // the pebble it balances on
    add(M.bone, place(boulder(3.6, 1, 2, 0.95, 0.12, 62), x, top + 9.6, z, 0.3), place(boulder(3.6, 1, 2, 0.95, 0.12, 62, false), x, top + 9.6, z, 0.3));
  }

  // ---------------------------------------------------------- aqueducts and arches
  const aqueduct = (o, mat = M.aq, parapets = true) => {
    const br = bridge(o);
    add(mat, br.g, bridge({ ...o, step: 2.5 }).g);
    if (!parapets) return br;
    // broken parapet blocks along both edges
    for (let i = 4; i < br.S.length - 4; i += 3) {
      const s = br.S[i];
      for (const side of [-1, 1]) {
        if (nA(i * 0.21 + side * 7, o.seed ?? 0) < -0.05) continue;
        const h = 0.7 + nB(i * 0.5, side) * 0.35;
        const g = place(new THREE.BoxGeometry(0.8, h, 3.3), s.cx + br.px * side * (s.w * 0.5 - 0.4), s.top + h / 2, s.cz + br.pz * side * (s.w * 0.5 - 0.4), Math.atan2(br.ux, br.uz));
        add(mat, g);
      }
    }
    return br;
  };
  aqueduct({ a: AQ1.a, b: AQ1.b, y0: AQ1.y, W: 8, bays: 4, pier: 0.3, thick: 3.5, seed: 1 });
  aqueduct({ a: AQ2.a, b: AQ2.b, y0: AQ2.y, W: 8, bays: 10, pier: 0.32, thick: 3.5, seed: 2 });
  // a ruined, broken aqueduct below the monastery cliff (decoration)
  aqueduct({ a: [-360, -40], b: [-262, -74], y0: 2, W: 6, bays: 3, pier: 0.3, thick: 3, seed: 3, ends: 0 }, M.aq, false);
  aqueduct({ a: [-238, -82], b: [-150, -112], y0: 2, W: 6, bays: 3, pier: 0.3, thick: 3, seed: 4, ends: 0 }, M.aq, false);
  // natural arches: monastery cliff -> the great table, and between the west rose cliffs
  aqueduct({ a: [MONASTERY.x + 27, MONASTERY.z - 30], b: [TABLE.x - 20, TABLE.z + 22], y0: MONASTERY.top - 3, y1: TABLE.top - 2,
    W: 13, bays: 1, pier: 0.04, rise: 0.32, thick: 8, rough: 2.4, seed: 5, ends: 0, flare: 0.6, bulge: 0.35, bottom: MONASTERY.top - 52 }, M.bone, false);
  aqueduct({ a: [-486, -296], b: [-516, -162], y0: 90, y1: 76, W: 14, bays: 1, pier: 0.04, rise: 0.6, thick: 10, rough: 2.4, seed: 6, ends: 0, flare: 0.6, bulge: 0.35, bottom: 20 }, M.rose, false);

  // ---------------------------------------------------------- monasteries
  const building = { walls: [], plain: [], roofs: [], domes: [], dark: [], trees: [] };
  const box = (list, x, y, z, w, h, d, ry = 0) => list.push(place(new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry));
  const gable = (x, y, z, w, d, ry = 0) => {
    const g = new THREE.BoxGeometry(w * 0.7071 * 1.08, w * 0.7071 * 1.08, d * 1.06).rotateZ(Math.PI / 4).scale(1, 0.42, 1);
    building.roofs.push(place(g, x, y, z, ry));
  };
  const house = (x, y, z, w, h, d, ry = 0) => {
    box(building.walls, x, y - 2, z, w, h + 2, d, ry);
    gable(x, y + h, z, w, d, ry);
  };
  const domed = (x, y, z, r, drum) => {
    building.plain.push(place(new THREE.CylinderGeometry(r, r, drum, 16), x, y + drum / 2, z));
    building.domes.push(place(new THREE.SphereGeometry(r * 1.06, 16, 8, 0, TAU, 0, Math.PI / 2), x, y + drum, z, 0, 1, 0.9, 1));
    building.walls.push(place(new THREE.CylinderGeometry(r * 0.12, r * 0.16, r * 0.6, 6), x, y + drum + r * 0.95 + r * 0.3, z));
  };
  const belltower = (x, y, z, w, h, round = false) => {
    if (round) building.plain.push(place(new THREE.CylinderGeometry(w / 2, w / 2 * 1.06, h + 2, 14), x, y - 2 + (h + 2) / 2, z));
    else box(building.plain, x, y - 2, z, w, h + 2, w);
    box(building.dark, x + w * 0.5, y + h * 0.45, z, 0.3, w * 0.4, w * 0.22);   // one slit window
    // the belfry: openings, a ledge and a little dome
    for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      box(building.dark, x + dx * w * 0.47, y + h - w * 1.05, z + dz * w * 0.47, dz ? w * 0.36 : 0.4, w * 0.62, dx ? w * 0.36 : 0.4);
    }
    building.walls.push(place(round ? new THREE.CylinderGeometry(w * 0.6, w * 0.6, 0.5, 14) : new THREE.BoxGeometry(w * 1.15, 0.5, w * 1.15), x, y + h + 0.25, z));
    building.domes.push(place(new THREE.SphereGeometry(w * 0.52, 14, 7, 0, TAU, 0, Math.PI / 2), x, y + h + 0.5, z, 0, 1, round ? 0.9 : 0.75, 1));
  };
  // the monastery's tower: an open belfry on four piers, so the bell shows (and swings)
  const openBelfry = (x, y, z, w, h) => {
    const b = y + h - w * 1.25;
    box(building.plain, x, y - 2, z, w, b - y + 2, w);
    box(building.walls, x, b - 0.4, z, w * 1.12, 0.8, w * 1.12);
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) box(building.plain, x + dx * w * 0.4, b, z + dz * w * 0.4, w * 0.2, h - (b - y), w * 0.2);
    box(building.walls, x, y + h - 0.6, z, w * 1.05, 0.9, w * 1.05);
    box(building.dark, x + w * 0.5, y + h * 0.4, z, 0.3, w * 0.4, w * 0.22);
    building.walls.push(place(new THREE.BoxGeometry(w * 1.15, 0.5, w * 1.15), x, y + h + 0.25, z));
    building.domes.push(place(new THREE.SphereGeometry(w * 0.52, 14, 7, 0, TAU, 0, Math.PI / 2), x, y + h + 0.5, z, 0, 1, 0.75, 1));
    return b;
  };
  const cypress = (x, y, z, h) => building.trees.push(place(new THREE.ConeGeometry(h * 0.16, h, 7), x, y + h / 2, z));
  {
    // the white monastery on the rose cliff, facing the start
    const y = MONASTERY.top + 0.3, x = MONASTERY.x - 10, z = MONASTERY.z - 6;
    BELL.y = y; BELL.floor = openBelfry(BELL.x, y, BELL.z, BELL.w, BELL.h);
    house(x, y, z, 16, 9, 26, 0.35);
    domed(x - 16, y, z + 8, 7, 9);
    building.walls.push(place(new THREE.BoxGeometry(16, 10, 16), x - 16, y - 2 + 5, z + 8));
    house(x + 4, y, z + 22, 10, 6, 12, 0.35 + Math.PI / 2);
    house(x - 30, y, z - 14, 9, 6, 10, 0.2);
    house(x + 14, y, z - 2, 8, 7, 9, 0.35);
    box(building.walls, x - 5, y - 1, z - 30, 28, 3.2, 1.2, 0.35);   // a low courtyard wall
    cypress(x - 32, y, z + 6, 11); cypress(x - 35, y, z + 2, 9); cypress(x + 30, y, z - 4, 10);
  }
  {
    // the floating island's church: a domed church between two towers (page 6)
    const y = ISLAND.top + 0.4, x = ISLAND.x + 2, z = ISLAND.z - 4;
    box(building.walls, x, y - 2, z, 14, 12, 14);
    domed(x, y + 10, z, 6, 4.5);
    house(x, y, z + 11, 10, 8, 10, Math.PI / 2);
    belltower(x - 11, y, z - 6, 4.5, 22, true);
    belltower(x + 11, y, z - 6, 4.5, 18, true);
    building.walls.push(place(new THREE.BoxGeometry(0.5, 3, 0.5), x, y + 10 + 4.5 + 6.6, z));      // a cross
    building.walls.push(place(new THREE.BoxGeometry(2, 0.5, 0.5), x, y + 10 + 4.5 + 7.2, z));
  }
  {
    // a little hermitage on the start plateau's edge, like the panel with the domed chapel
    const x = -40, y = START.top + 0.2, z = 44;
    box(building.walls, x, y - 2, z, 8, 8, 8);
    domed(x, y + 6, z, 3.3, 2.5);
    house(x + 7, y, z + 1, 5, 4, 7, Math.PI / 2);
  }
  for (const [k, list] of Object.entries(building)) {
    const mat = { walls: M.wall, plain: M.plainWall, roofs: M.roof, domes: M.dome, dark: M.dark, trees: M.tree }[k];
    for (const g of list) add(mat, g);
  }

  // ---------------------------------------------------------- the lone tower
  {
    const x = TOWER.x, z = TOWER.z, base = terrain.baseAt(x, z, 12), H = 150;
    const parts = [
      place(new THREE.CylinderGeometry(5.5, 9, H, 14, 1), x, base - 2 + H / 2, z),
      place(new THREE.CylinderGeometry(15, 13, 2, 18), x, base + H - 10, z),             // the lower balcony
      place(new THREE.CylinderGeometry(8, 8, 9, 14), x, base + H - 4.5, z),              // the top room
      place(new THREE.CylinderGeometry(11, 9, 1.5, 18), x, base + H + 0.5, z),          // its flat roof
      place(new THREE.CylinderGeometry(3, 3, 5, 10), x, base + H + 3.5, z),
      place(new THREE.CylinderGeometry(6.5, 6.5, 0.8, 14), x, base + H + 6.2, z),        // a second, smaller disc
      place(new THREE.ConeGeometry(1.8, 26, 8), x, base + H + 19, z),                    // the spike
      place(new THREE.CylinderGeometry(14, 16, 3, 16), x, base, z),                     // plinth
    ];
    for (const p of parts) add(M.tower, p);
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + 0.4;
      add(M.dark, place(new THREE.BoxGeometry(2.2, 4, 1), x + Math.cos(a) * 7.9, base + H - 6, z + Math.sin(a) * 7.9, -a + Math.PI / 2));
    }
    // a masked face carved into the plinth's north side, eyes shut, the glyph on its brow
    // (the same calm face sleeps in the desert's southern dunes)
    {
      const fz = z + 15.4, fy = base + 6.5;
      add(M.tower, place(new THREE.BoxGeometry(9, 9.5, 7), x, fy - 0.25, fz - 3.5));                      // a slab against the shaft
      add(M.tower, place(new THREE.SphereGeometry(3.6, 14, 10), x, fy, fz, 0, 1, 1.25, 0.55));
      add(M.tower, place(new THREE.BoxGeometry(5.6, 0.7, 1.2), x, fy + 1.6, fz + 1.4));                    // the brow
      add(M.tower, place(new THREE.ConeGeometry(0.75, 2.6, 4), x, fy - 0.2, fz + 1.9, 0, 1, 1, 1, Math.PI / 2 + 0.25)); // the nose
      for (const sx of [-1, 1]) add(M.dark, place(new THREE.BoxGeometry(1.5, 0.22, 0.3), x + sx * 1.35, fy + 0.85, fz + 1.95), null); // shut eyes
      add(M.dark, place(new THREE.BoxGeometry(1.8, 0.2, 0.3), x, fy - 1.9, fz + 1.7), null);                // the mouth
      for (const dx of [-0.9, 0, 0.9]) add(M.dark, place(new THREE.SphereGeometry(0.26, 8, 6), x + dx, fy + 2.85 + (dx ? 0 : 0.25), fz + 1.75), null);
      add(M.dark, place(new THREE.TorusGeometry(1.2, 0.12, 4, 12, Math.PI), x, fy + 2.0, fz + 1.75, 0, 1, 0.5, 1), null);
      FACE.x = x; FACE.y = base; FACE.z = fz + 4;
    }
    // low ruins at its foot
    add(M.plainWall, place(new THREE.BoxGeometry(14, 4, 8), x + 22, base - 1 + 2, z + 6, 0.3));
    add(M.plainWall, place(new THREE.BoxGeometry(6, 2.5, 6), x - 20, base - 1 + 1.25, z - 4, 0.8));
  }

  // ---------------------------------------------------------- the bell in its open belfry, and its rope
  const bell = new THREE.Group();
  bell.userData.noCollide = true;
  {
    const prof = [[0.12, 0], [0.5, 0.04], [0.62, 0.3], [0.7, 0.62], [0.86, 0.86], [1.0, 0.98], [0.96, 1.02], [0, 1.02]].map(([r, y]) => new THREE.Vector2(r * 2.1, -y * 3.0));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), makeMaterial({ color: '#c99a52', color2: '#b3843f', color3: '#e0b66a', mode: MODE_STRATA, strataSize: 0.8, side: DS }));
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(BELL.w * 0.86, 0.5, 0.6), M.dark);
    yoke.position.y = 0.35;
    // the three notes over the bell's rim: the glyph, in bronze relief
    const glyph = mergeGeometries([-0.62, 0, 0.62].map((dx) => new THREE.SphereGeometry(0.16, 6, 4).translate(dx, -1.35 + (dx ? 0 : 0.12), 1.48)).concat([new THREE.TorusGeometry(0.85, 0.07, 4, 12, Math.PI).translate(0, -2.05, 1.62)]));
    bell.add(body, yoke, new THREE.Mesh(glyph, M.dark));
    bell.position.set(BELL.x, BELL.y + BELL.h - 1.4, BELL.z);
    scene.add(bell);
  }
  // the rope comes over the belfry's ledge on a little pulley at the end of an iron arm, clear of
  // the ledge (it sticks out w * 0.06 past the wall) and of the wall below, and swings only outward
  // (src/story/arzach2.js), so it never passes through the tower
  const ropeTop = new THREE.Vector3(BELL.x, BELL.floor + 0.3, BELL.z + BELL.w * 0.56 + 0.22);
  const ropeFoot = new THREE.Vector3(BELL.x, BELL.y + 0.9, ropeTop.z);
  {
    const arm = new THREE.Mesh(mergeGeometries([
      new THREE.BoxGeometry(0.12, 0.12, 0.5).translate(0, 0.06, -0.18),                              // the arm, out over the ledge's lip
      new THREE.TorusGeometry(0.16, 0.05, 4, 10).rotateY(Math.PI / 2).translate(0, 0.16, 0),            // the pulley
    ]), M.dark);
    arm.position.set(ropeTop.x, BELL.floor, ropeTop.z);
    arm.userData.noCollide = true;
    scene.add(arm);
  }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, ropeTop.y - ropeFoot.y, 5).translate(0, -(ropeTop.y - ropeFoot.y) / 2, 0), makeMaterial({ color: '#8a5a3a', flat: true }));
  rope.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5).scale(1, 1.6, 1).translate(0, -(ropeTop.y - ropeFoot.y), 0), makeMaterial({ color: '#c8483a', flat: true })));
  rope.position.copy(ropeTop);
  rope.userData.noCollide = true;
  scene.add(rope);

  // ---------------------------------------------------------- floating stones (gently bobbing, not collidable)
  const floaters = new THREE.Group();
  floaters.userData.noCollide = true;
  scene.add(floaters);
  const floatGeo = [];
  const floater = (x, y, z, r, sy, egg, seed, pebbles = 3, mushroom = false) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const parts = [];
    if (mushroom) {
      parts.push(table({ x: 0, z: 0, R: r, stalk: r * 0.2, top: 0, base: -r * 0.7, capT: r * 0.25, under: r * 0.2, dome: r * 0.18, seed, rib: r * 0.05, ribK: 20, seg: 64, colSeg: 8 }).vis);
    } else parts.push(boulder(r, 1, sy, 0.9, egg, seed));
    for (let i = 0; i < pebbles; i++) parts.push(place(boulder(r * (0.08 + 0.06 * (pebbles - i) / pebbles), 1, 1.3, 1, 0.1, seed + i), (i % 2 ? 1 : -1) * r * 0.1, -r * sy - r * (0.6 + i * 0.9), 0));
    const m = new THREE.Mesh(mergeGeometries(parts.map(clean)), M.bone);
    m.geometry.computeVertexNormals();
    g.add(m);
    floaters.add(g);
    const ph = seed * 1.7;
    movers.push((t) => { g.position.y = y + Math.sin(t * 0.35 + ph) * 1.6; g.rotation.y = Math.sin(t * 0.05 + ph) * 0.3; });
    floatGeo.push(m);
  };
  floater(-60, 112, -150, 6, 3.4, 0.1, 1, 3);        // the long floating stone (page 1)
  floater(150, 88, -40, 4, 2.6, 0.15, 2, 2);
  floater(300, 150, -380, 7, 2.2, 0.05, 3, 4);
  floater(-190, 128, -300, 5, 1.6, 0.2, 4, 2);
  floater(270, 160, -470, 8, 0.45, 0, 5, 1, true);    // a little mushroom-shaped island (page 6)
  floater(-110, 92, -480, 3.5, 2.4, 0.1, 6, 3);
  floater(20, 120, -1020, 5, 2.8, 0.1, 7, 3);
  floater(-40, 100, -760, 4.5, 2.2, 0.1, 8, 3);
  floater(160, 140, -820, 6, 0.5, 0, 9, 1, true);

  // ---------------------------------------------------------- the sky stones by the great table (they fell up)
  // little flat-topped stones hanging over the cloud, each with a pebble or two below it
  SKY.forEach(([x, z, top, r], i) => {
    const t = table({ x, z, R: r, stalk: r * 0.3, top, base: top - r * 1.5, capT: r * 0.32, under: r * 0.3, dome: r * 0.06, seed: 80 + i * 1.3,
      rib: r * 0.05, ribK: 16, seg: 40, colSeg: 10, flute: 0.1, fluteK: 7, foot: 0.8, neckR: 1.1, waist: 0.1 });
    add(M.bone, t.vis, t.col);
    add(M.bone, place(boulder(r * 0.22, 1, 1.3, 1, 0.1, 90 + i), 0.3, top - r * 1.5 - r * 0.5, 0.2).translate(x, 0, z), null);
  });
  // the cairn's footing stone on the great table
  {
    const y = tableTop(TABLE, Math.hypot(CAIRN.x - TABLE.x, CAIRN.z - TABLE.z));
    add(M.bone, place(boulder(1.5, 1.2, 0.5, 1.1, 0, 95), CAIRN.x, y + 0.35, CAIRN.z), place(boulder(1.5, 1.2, 0.5, 1.1, 0, 95, false), CAIRN.x, y + 0.35, CAIRN.z));
    CAIRN.y = y + 1.05;
  }

  // ---------------------------------------------------------- merge everything per material
  for (const [mat, geos] of vis) {
    let g = mergeGeometries(geos);
    if (mat === M.cap) g = mergeVertices(g, 1e-3);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.userData.noCollide = true;
    scene.add(m);
    if (mat === M.cap) noShadow.push(m);
  }
  // shadow casters for the smooth caps: depth-only in the shadow pass, invisible in the frame
  if (shadowGeos.length) {
    const sm = new THREE.Mesh(mergeGeometries(shadowGeos), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    sm.userData.noCollide = true;
    scene.add(sm);
  }
  // one invisible, coarse collision body for everything above
  const colMesh = new THREE.Mesh(mergeGeometries(col), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  colMesh.visible = false;
  scene.add(colMesh);
  const ray = new THREE.Raycaster();
  const topAt = (x, z, from = 400) => {
    ray.set(new THREE.Vector3(x + 1e-3, from, z + 2e-3), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(colMesh, false)[0];
    return hit ? Math.max(hit.point.y, terrain.heightAt(x, z)) : terrain.heightAt(x, z);
  };

  // ---------------------------------------------------------- scattered pebbles (instanced, not collidable)
  const smallProps = [];
  {
    const spots = [];
    const onTable = (t, n) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, r = Math.sqrt(rng()) * t.R * 0.8;
        spots.push([t.x + Math.cos(a) * r, tableTop(t, r) - 0.15, t.z + Math.sin(a) * r]);
      }
    };
    onTable(START, 220); onTable(NEEDLES, 260); onTable(MONASTERY, 120); onTable(TABLE, 60);
    for (let i = 0; i < 900; i++) {
      const x = (rng() * 2 - 1) * 1300, z = PLAIN_EDGE - 60 - rng() * 1100;
      spots.push([x, terrain.heightAt(x, z) - 0.1, z]);
    }
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    const rocks = new THREE.InstancedMesh(lumpy(new THREE.IcosahedronGeometry(1, 1), 0.12, 1.4, 5), makeMaterial({ color: '#ffffff', flat: true, pattern: 'cracks' }), spots.length);
    spots.forEach(([x, y, z], i) => {
      const s = 0.25 + Math.pow(rng(), 3) * 1.7;
      dummy.position.set(x, y + s * 0.2, z);
      dummy.rotation.set(rng() * 6, rng() * 6, rng() * 6);
      dummy.scale.set(s, s * 0.6, s * 0.9);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      rocks.setColorAt(i, color.set(z < PLAIN_EDGE - 30 ? ['#e9b090', '#e2a585', '#f1e4d0'][i % 3] : ['#efe4cf', '#e2d4b8', '#f4ecdc'][i % 3]));
    });
    rocks.userData.noCollide = true;
    rocks.frustumCulled = false;
    scene.add(rocks);
    smallProps.push(rocks);
  }

  // ---------------------------------------------------------- the sea of cloud
  const cloud = [];
  {
    const PAL = ['#fffbf4', '#f8e4d6', '#d8dbee'];
    const puffGeo = (detail) => {
      const g = new THREE.IcosahedronGeometry(1, detail);
      lumpy(g, 0.08, 1.8, detail);
      g.computeVertexNormals();
      const p = g.attributes.position, c = new Float32Array(p.count * 3), col3 = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const lit = (x * 0.7 + y * 0.69 + z * 0.19) / Math.hypot(x, y, z) + nB(x * 2.2, z * 2.2 + y) * 0.16;
        col3.set(lit > -0.05 ? PAL[0] : lit > -0.3 ? PAL[1] : PAL[2]);
        c[i * 3] = col3.r; c[i * 3 + 1] = col3.g; c[i * 3 + 2] = col3.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      return g;
    };
    const cloudMat = makeMaterial({ color: '#ffffff', vertexColors: true, palette: PAL, glow: 0.5 });
    const near = [], far = [];
    const inPlain = (x, z) => z < PLAIN_EDGE - 50 + nA(x * 0.004, 3.1) * 40;
    // cauliflower clusters: a big central puff, smaller lobes round it and on top
    for (let i = 0; i < 12000 && (near.length < 3600 || far.length < 2400); i++) {
      const x = (rng() * 2 - 1) * 1800, z = 1600 - rng() * 2650;
      if (inPlain(x, z)) continue;
      let blocked = false;
      for (const t of tables) if (Math.hypot(x - t.x, z - t.z) < t.R * 0.6) { blocked = true; break; }
      if (blocked) continue;
      const d = Math.hypot(x - 20, (z + 420) * 0.8);
      const big = rng() < 0.15;
      const s = big ? R(26, 44) : R(12, 26);
      const list = d < 760 ? near : far;
      const y0 = CLOUD_Y + R(-6, 4) + (big ? s * 0.2 : 0);
      list.push({ x, y: y0, z, s, sy: R(0.6, 0.8), main: true });
      const lobes = 3 + Math.floor(rng() * 4);
      for (let k = 0; k < lobes; k++) {
        const a = rng() * TAU, rr = s * R(0.6, 1.05), ls = s * R(0.4, 0.7);
        list.push({ x: x + Math.cos(a) * rr, y: y0 - ls * 0.2, z: z + Math.sin(a) * rr, s: ls, sy: R(0.65, 0.85) });
      }
      if (rng() < 0.6) list.push({ x: x + R(-0.2, 0.2) * s, y: y0 + s * 0.45, z: z + R(-0.2, 0.2) * s, s: s * R(0.45, 0.6), sy: 0.8 });
    }
    const dummy = new THREE.Object3D();
    // distant puffs sit under fog and haze: the coarsest shape is enough there
    for (const [list, detail] of [[near.filter((p) => p.main), 2], [near.filter((p) => !p.main), 1], [far, 0]]) {
      const im = new THREE.InstancedMesh(puffGeo(detail), cloudMat, list.length);
      list.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.s, p.s * p.sy, p.s * R(0.8, 1.1));
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.userData.noCollide = true;
      im.frustumCulled = false;
      scene.add(im);
      noShadow.push(im);
      cloud.push(im);
    }
    // a flat cloud deck between the puffs, hiding the floor of the chasm
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200).rotateX(-Math.PI / 2), makeMaterial({ color: '#e6e2ef', glow: 0.5 }));
    deck.position.y = CLOUD_Y - 4;
    deck.userData.noCollide = true;
    scene.add(deck);
    noShadow.push(deck);
    cloud.push(deck);
  }

  const spawn = new THREE.Vector3(0, 0, 22);
  spawn.y = topAt(spawn.x, spawn.z);

  return {
    id: 'arzach2',
    ground: terrain,
    spawn,
    spawnHeading: Math.PI,
    camYaw: 0,
    features: { mount: true, wind: true, jetpack: false, climb: true },
    mount: (physics) => {
      const b = new Bird(physics);
      b.pos.set(10, physics.groundAt(10, START.top + 30, 6) + 1.4, 6);
      return b;
    },
    mountName: 'bird',
    defaults: { hour: 9, preset: 'Moebius print' },
    life: {
      flocks: [{ count: 5, color: '#f4efe2', size: 3.2, radius: 180, height: [70, 150], speed: 0.05, seed: 3 },
               { count: 4, color: '#efe2cc', size: 2.6, radius: 110, height: [50, 100], speed: -0.07, seed: 8 }],
      motes: { count: 100, color: '#f6eadb', size: 0.05, wind: [0.6, 0.25] },
      footprints: '#d99072',
    },
    sky: {
      // aqua sky over a peach horizon; shadows go blue-grey, as in the panels
      script: {
        day: ['#a3d0d2', '#f4cdb0', '#93abcc', '#fff7ec', '#fff2dc'],
        dusk: ['#f2ae8c', '#f6c4a0', '#8f88b8', '#ffd9bc', '#ffe2c0'],
        night: ['#262a3c', '#4a4a5e', '#383650', '#a8a8c0', '#f2f0e6'],
      },
      planets: [{ az: 200, el: 26, size: 6.5, color: '#f3ead8', craters: false }, { az: 222, el: 18, size: 2.2, color: '#e9c8b4', craters: false }],
    },
    killY: -Infinity,
    unsafe: (p) => p.y < UNSAFE_Y,
    smallProps,
    noShadow,
    topAt,
    // the story's handles (src/story/arzach2.js): the bell and its rope, the cloud sea (it settles when the
    // bell rings), the floating stones, the sky stones and the cairn, the clapper's island, the tower's face
    arzach2: {
      bell, bellTower: { ...BELL }, rope, ropeTop, ropeFoot,
      cloud, cloudY: CLOUD_Y, floaters,
      sky: SKY.map(([x, z, top, r]) => ({ pos: new THREE.Vector3(x, top, z), r })),
      cairn: new THREE.Vector3(CAIRN.x, CAIRN.y, CAIRN.z),
      table: new THREE.Vector3(TABLE.x, tableTop(TABLE), TABLE.z),
      clapper: new THREE.Vector3(CLAPPER.x, topAt(CLAPPER.x, CLAPPER.z, ISLAND.top + 20), CLAPPER.z),
      island: new THREE.Vector3(ISLAND.x, ISLAND.top, ISLAND.z),
      monastery: new THREE.Vector3(MONASTERY.x, MONASTERY.top, MONASTERY.z),
      face: new THREE.Vector3(FACE.x, FACE.y, FACE.z),
      tower: new THREE.Vector3(TOWER.x, terrain.heightAt(TOWER.x, TOWER.z), TOWER.z),
      plainEdge: PLAIN_EDGE,
    },
    atmo: (x, z) => ({ tint: [1.02, 0.99, 0.96], fog: 0.65, name: z < PLAIN_EDGE - 40 ? 'Vael II · the peach plain' : 'Vael II · the sky stones' }),
    update(dt, t) { for (const m of movers) m(t); },
  };
}
