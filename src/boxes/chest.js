import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The makers' chests' geometry (src/boxes/model.js buildBox makes them, with their one material). The same in
// every world: a chest is the makers', not the place's (references/Core Objects/Chests/, docs/systems/boxes.md).
//
//   the makers' chest (`makers`, every box but the temples'): the design sheet's (Chests/sheet/sheet-1.jpg).
//     A hip-high rounded shell of pale cream ceramic like a river stone, wider than tall; the makers' four-point
//     star on its top (painted by the shader); a thin brass band round it a little under the middle; in its front,
//     on the band, a round glass lens of glowing jade fluid in a brass ring (the glass backpack's jade). It opens
//     in two: the shell over the band parts in two halves on hinges at its sides, like petals, its inside lined
//     in pale jade.
//   the temple chest (`temple`, the chest at the heart of each temple): the temple sheets' (Chests/temple/).
//     A bud of white stone on a low round foot: six petals edged in gold, a gold four-point star with a jade heart
//     on each, the jade glass of its heart glowing in the seams between them. It opens like a flower, the petals
//     falling outward from the foot, and its jade heart rises out of it.
//
// Everything is one vertex-coloured geometry per part (position, normal, color), no uv: the chest's one material
// (materials.js MAKERS_BOX, a colour over 1 is a light) draws all of it, so a closed chest is one mesh and one
// program whatever it is, and its opened parts (only while it opens) share the same.
//
//   chestGeometry(kind) → { closed, base, petals: [{ geo, hinge, axis, angle }], core?, size, half, center, star }
//     closed: the whole closed chest, merged; base: what stays put when it opens; each petal turns about its
//     hinge (a point) round axis by angle (rad) when fully open; core (the temple's): its jade heart, which rises.
//     Unscaled metres (model.js sets it down BOX_SCALE larger), +z the front, y = 0 on the ground.

/** The makers' chest (unscaled m): w across, h tall, d deep; band the brass band's top (share of h) and bandH its
 *  height; lens the jade lens's radius; t the shell's thickness (seen when it opens). */
export const MAKERS_CHEST = { w: 0.72, h: 0.5, d: 0.58, band: 0.46, bandH: 0.042, lens: 0.085, t: 0.022, open: 1.95 };
/** The temple chest (unscaled m): r its widest radius, h tall, foot its round foot's height, petals, gap between
 *  them (rad), t their thickness, open how far each falls outward (rad), rise how far its heart rises (m). */
export const TEMPLE_CHEST = { r: 0.3, h: 0.64, foot: 0.055, petals: 6, gap: 0.05, t: 0.02, open: 1.62, rise: 0.16 };
/** Their colours (sRGB). A glow over 0 makes a colour a light (the shader's colour over 1). */
export const CHEST_COLORS = {
  cream: '#efe5cc', brass: '#c9a04f', lining: '#cdeedb', jadeDeep: '#2e8d6a', jade: '#7fdcb0', jadePale: '#d9fff0',
  stone: '#f1eee6', gold: '#d2a847', star: '#dcb455', light: '#dcfbe8',
};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sp = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), e);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** A colour as the vertex colour carries it (linear); glow > 0 lifts it over 1 by that much (a light). */
export function vcol(hex, glow = 0) {
  const c = new THREE.Color(hex);
  if (glow <= 0) return [c.r, c.g, c.b];
  const k = (1 + glow) / Math.max(c.r, c.g, c.b, 1e-3);
  return [c.r * k, c.g * k, c.b * k];
}

/** The pale star: four long points with concave sides (as on the reference lid). */
export function starShape(R = 1, r = 0.3, points = 4) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}

/** Vertices, triangles facing the way their normals do, as one non-indexed geometry. */
class Mesher {
  constructor() { this.p = []; this.n = []; this.c = []; this.ix = []; }
  v(p, n, c) { this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.c.push(...c); return this.p.length / 3 - 1; }
  tri(a, b, c) {
    const P = (i) => V(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]);
    const N = (i) => V(this.n[i * 3], this.n[i * 3 + 1], this.n[i * 3 + 2]);
    const f = new THREE.Vector3().crossVectors(P(b).sub(P(a)), P(c).sub(P(a)));
    if (f.lengthSq() < 1e-14) return;   // (a pole's sliver)
    if (f.dot(N(a).add(N(b)).add(N(c))) < 0) this.ix.push(a, c, b); else this.ix.push(a, b, c);
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.ix);
    return g.toNonIndexed();
  }
}

/** A three.js primitive painted one colour (or by colorAt(position)), made like the Mesher's. */
function painted(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const p = g.attributes.position, c = new Float32Array(p.count * 3), v = V();
  for (let i = 0; i < p.count; i++) c.set(typeof color === 'function' ? color(v.fromBufferAttribute(p, i)) : color, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const merge = (list) => mergeGeometries(list.filter(Boolean));

/**
 * A patch of a surface: rows × cols of at(col, row) → { p, n }, painted color(col, row, p); offset in along the
 * normal and turned inside out for the lining. Returns the grid of positions (for the rims).
 */
function patch(M, rows, cols, at, color, { inner = 0 } = {}) {
  const grid = rows.map((r) => cols.map((c) => {
    const { p, n } = at(c, r);
    const q = p.clone().addScaledVector(n, -inner);
    return { i: M.v(q, inner ? n.clone().negate() : n, color(c, r, q)), p: q };
  }));
  for (let i = 0; i + 1 < rows.length; i++) for (let j = 0; j + 1 < cols.length; j++) M.quad(grid[i][j].i, grid[i][j + 1].i, grid[i + 1][j + 1].i, grid[i + 1][j].i);
  return grid;
}
/** A strip closing a cut between the outer and the inner surface (two rows of positions), facing n. */
function rim(M, outer, inner, n, color) {
  for (let j = 0; j + 1 < outer.length; j++) {
    const a = M.v(outer[j], n, color), b = M.v(outer[j + 1], n, color), c = M.v(inner[j + 1], n, color), d = M.v(inner[j], n, color);
    M.quad(a, b, c, d);
  }
}
const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
/** A sorted list of samples with the given values in it (and none crowding them). */
function withRows(list, keep, near = 0.02) {
  return [...list.filter((x) => keep.every((k) => Math.abs(x - k) > near)), ...keep].sort((a, b) => a - b);
}

// ------------------------------------------------------------------ the makers' chest
const E_TOP = 0.74, E_BOT = 0.5, E_ROUND = 0.84;   // its superellipsoid: rounder on top, flatter underneath, a rounded oblong seen from above

function makersShell(C = MAKERS_CHEST) {
  const hx = C.w / 2, hy = C.h / 2, hz = C.d / 2, cy = hy;
  const e1 = (y) => (y >= cy ? E_TOP : E_BOT);
  /** The shell at (θ round from +x toward the front +z, φ up from its waist). */
  const point = (th, ph) => {
    const e = ph >= 0 ? E_TOP : E_BOT, c = sp(Math.cos(ph), e);
    return V(hx * c * sp(Math.cos(th), E_ROUND), cy + hy * sp(Math.sin(ph), e), hz * c * sp(Math.sin(th), E_ROUND));
  };
  const F = (x, y, z) => { const e = e1(y); return Math.pow(Math.pow(Math.abs(x / hx), 2 / E_ROUND) + Math.pow(Math.abs(z / hz), 2 / E_ROUND), E_ROUND / e) + Math.pow(Math.abs((y - cy) / hy), 2 / e); };
  const normal = (p) => {
    const h = 1e-5;
    const n = V(F(p.x + h, p.y, p.z) - F(p.x - h, p.y, p.z), F(p.x, p.y + h, p.z) - F(p.x, p.y - h, p.z), F(p.x, p.y, p.z + h) - F(p.x, p.y, p.z - h));
    if (n.lengthSq() < 1e-20) n.set(0, Math.sign(p.y - cy) || 1, 0);
    return n.normalize();
  };
  const at = (th, ph) => {
    const p = point(th, ph);
    const n = Math.abs(ph) > Math.PI / 2 - 1e-6 ? V(0, Math.sign(ph), 0) : normal(p);
    return { p, n };
  };
  /** The φ of the row at height y. */
  const phiAt = (y) => { const t = (y - cy) / hy, e = e1(y); return Math.sign(t) * Math.asin(Math.min(1, Math.pow(Math.abs(t), 1 / e))); };
  return { hx, hy, hz, cy, point, at, phiAt };
}

function makersChest(C = MAKERS_CHEST) {
  const K = CHEST_COLORS, S = makersShell(C);
  const yb = C.h * C.band, yb2 = yb - C.bandH, phB = S.phiAt(yb), phB2 = S.phiAt(yb2);
  const rows = withRows(range(-Math.PI / 2, Math.PI / 2, 30), [phB, phB2]);
  const below = rows.filter((r) => r <= phB + 1e-9), above = rows.filter((r) => r >= phB - 1e-9);
  const ring = range(0, Math.PI * 2, 64);
  const cream = () => vcol(K.cream), lining = () => vcol(K.lining, 0.12);
  // the brass band, standing a little proud of the shell, its top the cut where the halves part
  const band = (() => {
    const M = new Mesher(), b = vcol(K.brass), out = 0.006;
    const top = ring.map((th) => S.at(th, phB)), bot = ring.map((th) => S.at(th, phB2));
    const lift = (o) => o.p.clone().addScaledVector(o.n, out);
    patch(M, [0, 1], ring.map((_, j) => j), (j, r) => { const o = r ? top[j] : bot[j]; return { p: lift(o), n: o.n }; }, () => b);
    rim(M, top.map((o) => o.p), top.map(lift), V(0, 1, 0), b);
    rim(M, bot.map((o) => o.p), bot.map(lift), V(0, -1, 0), b);
    return M.geometry();
  })();
  // the jade lens on the band at the front, in a brass ring, swirling (its colours: a two-armed spiral, a bright heart, a highlight)
  const yl = yb - C.bandH / 2, front = S.point(Math.PI / 2, S.phiAt(yl)).z, R = C.lens;
  const lens = (() => {
    const hc = 0.032, Rs = (R * R + hc * hc) / (2 * hc), cz = front - 0.004 + hc - Rs, amax = Math.asin(R / Rs);
    const M = new Mesher();
    const deep = new THREE.Color(K.jadeDeep), light = new THREE.Color(K.jade), pale = new THREE.Color(K.jadePale);
    patch(M, range(0, 1, 9), range(0, Math.PI * 2, 40), (ang, k) => {
      const a = amax * k, n = V(Math.sin(a) * Math.cos(ang), Math.sin(a) * Math.sin(ang), Math.cos(a));
      return { p: V(0, yl, cz).addScaledVector(n, Rs), n };
    }, (ang, k, p) => {
      const sw = 0.5 + 0.5 * Math.sin(2 * ang + 7.5 * k - 1.2);
      const c = deep.clone().lerp(light, Math.min(1, sw * 0.75 + (1 - k) * 0.35));
      const hl = Math.max(0, 1 - Math.hypot(p.x + 0.4 * R, p.y - yl - 0.42 * R) / (0.24 * R));
      c.lerp(pale, hl);
      const g = (1 + 0.55 * (1 - k) + 0.6 * hl) / Math.max(c.r, c.g, c.b, 1e-3);   // (all of it a light: over 1 by 0.5 .. 1)
      return [c.r * g * 1.2, c.g * g * 1.2, c.b * g * 1.2];
    });
    return M.geometry();
  })();
  const brass = vcol(K.brass);
  const lensRing = painted(new THREE.TorusGeometry(R + 0.008, 0.0125, 8, 44).translate(0, yl, front + 0.002), brass);
  const socket = painted(new THREE.CylinderGeometry(R + 0.014, R + 0.014, 0.07, 44, 1, true).rotateX(Math.PI / 2).translate(0, yl, front - 0.03), brass);
  // the hinges, at the band's top on either side
  const xh = S.point(0, phB).x;
  const hinges = [-1, 1].map((s) => painted(new THREE.CylinderGeometry(0.013, 0.013, 0.08, 12).rotateX(Math.PI / 2).translate(s * (xh + 0.006), yb + 0.004, 0), brass));
  const fittings = [band, lens, lensRing, socket, ...hinges];

  // closed: the whole shell, the band, the lens, the hinges
  const M0 = new Mesher();
  patch(M0, rows, ring, (th, ph) => S.at(th, ph), cream);
  const closed = merge([M0.geometry(), ...fittings]);
  // opened: the bowl under the band (lined), and the two halves over it
  const MB = new Mesher();
  patch(MB, below, ring, (th, ph) => S.at(th, ph), cream);
  const inB = patch(MB, below, ring, (th, ph) => S.at(th, ph), lining, { inner: C.t });
  const outRow = ring.map((th) => S.at(th, phB).p);
  rim(MB, outRow, inB.at(-1).map((o) => o.p), V(0, 1, 0), vcol(K.cream));
  const base = merge([MB.geometry(), ...fittings]);
  const petals = [1, -1].map((s) => {
    const cols = s > 0 ? range(-Math.PI / 2, Math.PI / 2, 32) : range(Math.PI / 2, Math.PI * 1.5, 32);
    const M = new Mesher();
    const outG = patch(M, above, cols, (th, ph) => S.at(th, ph), cream);
    const inG = patch(M, above, cols, (th, ph) => S.at(th, ph), lining, { inner: C.t });
    const ck = vcol(K.cream);
    rim(M, outG[0].map((o) => o.p), inG[0].map((o) => o.p), V(0, -1, 0), ck);   // (its lower edge, over the band)
    for (const j of [0, cols.length - 1]) rim(M, outG.map((r) => r[j].p), inG.map((r) => r[j].p), V(-s, 0, 0), ck);   // (where the halves meet)
    return { geo: M.geometry(), hinge: V(s * xh, yb, 0), axis: V(0, 0, 1), angle: -s * C.open };
  });
  const half = [S.hx, S.hy, S.hz];
  return { closed, base, petals, core: null, size: { w: C.w, h: C.h, d: C.d }, half, center: S.cy, star: 0.19 };
}

// ------------------------------------------------------------------ the temple chest
/** The bud's radius at height y (its foot to its tip). */
function budRadius(y, C = TEMPLE_CHEST) {
  const u = (y - C.foot) / (C.h - C.foot), q = u - 0.42;
  if (u <= 0) return C.r * Math.sqrt(1 - (0.42 / 0.6) ** 2);
  if (u >= 1) return 0;
  const k = Math.abs(q) / (q < 0 ? 0.6 : 0.58), p = q < 0 ? 2 : 1.7;
  return C.r * Math.pow(Math.max(0, 1 - Math.pow(k, p)), 1 / p);
}

function templeChest(C = TEMPLE_CHEST) {
  const K = CHEST_COLORS;
  const at = (th, y) => {
    const r = budRadius(y, C), h = 1e-4, dr = (budRadius(Math.min(C.h, y + h), C) - budRadius(Math.max(C.foot, y - h), C)) / (Math.min(C.h, y + h) - Math.max(C.foot, y - h));
    const n = y >= C.h - 1e-6 ? V(0, 1, 0) : V(Math.cos(th), -dr, Math.sin(th)).normalize();
    return { p: V(r * Math.cos(th), y, r * Math.sin(th)), n };
  };
  const rows = range(C.foot, C.h, 22), stone = vcol(K.stone), gold = vcol(K.gold), lining = vcol(K.lining, 0.2);
  const wedge = (Math.PI * 2) / C.petals, hw = wedge / 2 - C.gap / 2;
  const S = [-1, -0.94, -0.885, -0.6, -0.3, 0, 0.3, 0.6, 0.885, 0.94, 1];   // across a petal: its gold edges, then the stone
  const yStar = C.foot + 0.36 * (C.h - C.foot);
  const petals = [], closedParts = [];
  for (let i = 0; i < C.petals; i++) {
    const tc = Math.PI / 2 + i * wedge, cols = S.map((s) => tc + s * hw);
    const M = new Mesher();
    const outG = patch(M, rows, cols, at, (th) => (Math.abs(th - tc) >= hw * 0.93 ? gold : stone));
    const inG = patch(M, rows, cols, at, () => lining, { inner: C.t });
    rim(M, outG[0].map((o) => o.p), inG[0].map((o) => o.p), V(0, -1, 0), gold);
    for (const [j, s] of [[0, -1], [cols.length - 1, 1]]) rim(M, outG.map((r) => r[j].p), inG.map((r) => r[j].p), V(-Math.sin(tc + s * hw) * s, 0, Math.cos(tc + s * hw) * s), gold);
    // its star: gold, a jade heart, laid on the stone (bent round it)
    const starOn = (scale, lift, color) => {
      const g = painted(new THREE.ShapeGeometry(starShape(1, 0.26)), color), p = g.attributes.position, nn = new Float32Array(p.count * 3);
      const rc = budRadius(yStar, C);
      for (let k = 0; k < p.count; k++) {
        const sx = p.getX(k) * scale * 0.5, sy = p.getY(k) * scale;
        const s = at(tc - sx / rc, yStar + sy);   // (seen from outside, its x to the right: the shape keeps facing out)
        const q = s.p.addScaledVector(s.n, lift);
        p.setXYZ(k, q.x, q.y, q.z); nn.set([s.n.x, s.n.y, s.n.z], k * 3);
      }
      g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
      return g;
    };
    const geo = merge([M.geometry(), starOn(0.11, 0.0025, gold), starOn(0.05, 0.004, vcol(K.jade, 0.6))]);
    const r0 = budRadius(C.foot, C);
    petals.push({ geo, hinge: V(r0 * Math.cos(tc), C.foot, r0 * Math.sin(tc)), axis: V(-Math.sin(tc), 0, Math.cos(tc)), angle: -C.open });
    closedParts.push(geo);
  }
  // the foot: a low drum of stone, gold rings, a jade disc in its top (seen once it opens)
  const rf = budRadius(C.foot, C) + 0.012;
  const foot = merge([
    painted(new THREE.CylinderGeometry(rf, rf * 1.06, C.foot, 40).translate(0, C.foot / 2, 0), stone),
    painted(new THREE.TorusGeometry(rf, 0.008, 6, 48).rotateX(Math.PI / 2).translate(0, C.foot, 0), gold),
    painted(new THREE.TorusGeometry(rf * 1.06, 0.007, 6, 48).rotateX(Math.PI / 2).translate(0, 0.006, 0), gold),
    painted(new THREE.CircleGeometry(rf * 0.72, 32).rotateX(-Math.PI / 2).translate(0, C.foot + 0.003, 0), vcol(K.jade, 0.8)),
    painted(new THREE.TorusGeometry(rf * 0.74, 0.006, 6, 40).rotateX(Math.PI / 2).translate(0, C.foot + 0.003, 0), gold),
  ]);
  // its heart: a sphere of jade glass, swirling, glimpsed in the seams; it rises out of the open flower
  const yc = C.foot + 0.42 * (C.h - C.foot), rc = C.r * 0.8;
  const deep = new THREE.Color(K.jadeDeep), light = new THREE.Color(K.jade);
  const core = painted(new THREE.SphereGeometry(rc, 24, 16), (p) => {
    const sw = 0.5 + 0.5 * Math.sin(2 * Math.atan2(p.z, p.x) + 9 * p.y);
    const c = deep.clone().lerp(light, 0.35 + 0.65 * sw), g = (1.5 + 0.3 * sw) / Math.max(c.r, c.g, c.b);
    return [c.r * g, c.g * g, c.b * g];
  });
  const coreAt = V(0, yc, 0);
  const closed = merge([foot, core.clone().translate(0, yc, 0), ...closedParts]);
  return { closed, base: foot, petals, core: { geo: core, at: coreAt, rise: C.rise }, size: { w: C.r * 2, h: C.h, d: C.r * 2 }, half: [C.r, C.h / 2, C.r], center: C.h / 2, star: 0 };
}

const built = new Map();
/** A chest's geometry by kind ('makers' or 'temple'), built once and shared by every chest of that kind. */
export function chestGeometry(kind = 'makers') {
  const k = kind === 'temple' ? 'temple' : 'makers';
  if (!built.has(k)) built.set(k, k === 'temple' ? templeChest() : makersChest());
  return built.get(k);
}
/** Which chest a placement gets: the temple's own (src/boxes/placements.js `temple`) or the makers'. Never the world. */
export const chestKind = (place) => (place?.temple ? 'temple' : 'makers');
/** How far a chest has opened at k (0..1) of its petals' swing: eased. */
export const openEase = (k) => smooth(0, 1, k);
