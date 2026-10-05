import * as THREE from 'three';
import { createNoise2D } from './noise.js';

// ---------------------------------------------------------------------------
// Sand banked against things (README "Sand banked against things"): in a sandy world, what stands on
// the ground sits in it. Round every building, rock, wreck and big prop a skirt of sand rises a
// little toward its sides: a soft concave fillet at its foot, higher on the windward side, now and
// then a bigger drift half burying a corner.
//
//   the footprint   each solid a builder adds (the desert's Kits feed theirs while a SandDrifts is
//                   open: SandDrifts.current), cut at its foot: the vertices in its bottom DRIFT.band
//                   joined by the triangles they share (an arch's two feet stay apart, so no drift
//                   runs across its passage), each part's convex hull
//   the drift       a height over the ground by the distance from the footprint: `rise` at its wall,
//                   down to nothing `reach` × rise out, along (1 - u)²: the slope is greatest at the
//                   wall (2 / reach, under the terrain's rock slope) and nothing at the rim, where the
//                   skirt meets the ground tangent, so no line is drawn there. The rise grows on the
//                   windward faces (the wind blows `wind`) and wanders along the wall; DRIFT.corner of
//                   the corners carry a bigger drift
//   the skirt       one mesh of rings round each footprint (the offset curve, rounded at the
//                   corners), its points on the ground plus the field (the max over every drift near:
//                   overlapping skirts agree), its normals from the field: drawn in the ground's own
//                   material (makeMaterial({ ...terrain, drift: true })), so it shades, marks and inks
//                   as the sand does, and collided with (you walk up it). The drift flag (+32 in
//                   gHatch.a) has post.js draw the line where the sand meets a wall softly.
// ---------------------------------------------------------------------------

export const DRIFT = {
  band: 0.6,          // m: the bottom slice of a solid whose points make its footprint
  minArea: 2.2,       // m²: smaller footprints (posts, crates, benches) get none
  minHeight: 0.8,     // m: nor what barely rises off the ground (slabs, steps)
  touch: 0.6,         // m: the solid's foot must be this close to the ground
  rise: [0.28, 0.75], // m at the wall: the lee side .. the windward side
  big: 1.7,           // a corner drift: this many times the rise
  corner: 0.22,       // the share of corners with one
  reach: 3.8,         // the drift's reach, in rises
  inside: 0.35,       // m: the skirt starts this far inside the wall (no gap at its foot)
  step: 1.3,          // m between the skirt's points along the wall
  fan: 0.5,           // rad between them round a corner
  rings: 7,           // rings from the wall out to the rim
  chunk: 160,         // m: the skirts are drawn in meshes this square (culled by the view)
  lift: 0.02,         // m over the ground (with a polygon offset: the skirt wins where it meets it)
  maxSlope: 0.6,      // the steepest its normals lean (the terrain draws rock past ~0.42 of slope)
};

/** The prevailing wind over the sand (the way it blows): the ripples' own direction (ground-ink.js). */
export const SAND_WIND = [0.82, 0.57];

/** Convex hull (x, z pairs), counter-clockwise in the x, z plane: Andrew's monotone chain. */
export function hull2(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  // (counter-clockwise in the x, z plane: the outward normal of an edge a -> b is (dz, -dx))
  return lo.concat(up);
}

const area2 = (poly) => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };

/**
 * The footprints of a solid (world-space geometry) where it meets the ground: its bottom band's points,
 * joined by shared triangles, each part's convex hull. [] if it doesn't stand on the ground or is small.
 */
export function footprintsOf(geo, heightAt, o = DRIFT) {
  const p = geo.attributes.position, idx = geo.index;
  const n = p.count;
  if (!n) return [];
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) { const y = p.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  // (a vertex is "at the foot" if it's in the bottom band, or under the ground where the solid is sunk)
  const foot = new Uint8Array(n), key = new Map(), parent = new Int32Array(n).map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  let any = false;
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), g = heightAt(x, z);
    if (y < minY + o.band || y < g + 0.15) {
      if (y > g + o.touch) continue;
      foot[i] = 1; any = true;
      const k = `${Math.round(x * 50)},${Math.round(y * 50)},${Math.round(z * 50)}`;
      if (key.has(k)) join(i, key.get(k)); else key.set(k, i);
    }
  }
  if (!any) return [];
  const tri = (a, b, c) => { const f = [a, b, c].filter((i) => foot[i]); for (let k = 1; k < f.length; k++) join(f[0], f[k]); };
  if (idx) for (let t = 0; t < idx.count; t += 3) tri(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  else for (let t = 0; t + 2 < n; t += 3) tri(t, t + 1, t + 2);
  const parts = new Map();
  for (let i = 0; i < n; i++) if (foot[i]) { const r = find(i); if (!parts.has(r)) parts.set(r, []); parts.get(r).push([p.getX(i), p.getZ(i)]); }
  const out = [];
  for (const pts of parts.values()) {
    const poly = hull2(pts);
    if (poly.length < 3 || area2(poly) < o.minArea) continue;
    // its height over the ground at its middle: what barely rises gets none
    const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cz = poly.reduce((s, q) => s + q[1], 0) / poly.length;
    if (maxY - heightAt(cx, cz) < o.minHeight) continue;
    out.push(poly);
  }
  return out;
}

/** Distance from (x, z) to a convex ccw polygon (negative inside) and the outward normal there. */
export function polyDistance(poly, x, z) {
  let best = Infinity, nx = 0, nz = 0, inside = true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1;
    const ox = ez / L, oz = -ex / L;                      // outward
    const side = (x - a[0]) * ox + (z - a[1]) * oz;
    if (side > 0) inside = false;
    const t = Math.min(Math.max(((x - a[0]) * ex + (z - a[1]) * ez) / (L * L), 0), 1);
    const dx = x - (a[0] + ex * t), dz = z - (a[1] + ez * t), d = Math.hypot(dx, dz);
    if (d < best) { best = d; if (d > 1e-6) { nx = dx / d; nz = dz / d; } else { nx = ox; nz = oz; } }
  }
  if (inside) { best = -best; nx = -nx; nz = -nz; }
  return { d: best, nx, nz };
}

export class SandDrifts {
  /** The drifts a sandy world's builders are feeding (Kit.solid), or null. */
  static current = null;
  /** Open a collector for a world: the builders' solids feed it until close(). */
  static open(o) { return (SandDrifts.current = new SandDrifts(o)); }
  close() { if (SandDrifts.current === this) SandDrifts.current = null; return this; }

  /**
   * @param {object} o
   * @param {(x: number, z: number) => number} o.heightAt  the ground
   * @param {number[]} [o.wind]  the way the wind blows (x, z)
   * @param {number} [o.seed]
   * @param {(x: number, z: number) => boolean} [o.where]  only footprints centred where this says
   * @param {(x: number, z: number) => number} [o.mask]  0..1: how much drift there is here (none on paving)
   */
  constructor({ heightAt, wind = SAND_WIND, seed = 1, where = null, mask = null, opts = {} }) {
    this.ground = heightAt; this.where = where; this.mask = mask;
    const L = Math.hypot(wind[0], wind[1]) || 1;
    this.wind = [wind[0] / L, wind[1] / L];
    this.o = { ...DRIFT, ...opts };
    this.noise = createNoise2D(seed * 7919 + 13);
    this.sources = [];
    this.cell = 24; this.grid = new Map();
  }

  /** A solid in world space (the Kits call this for every collider they add). */
  addGeometry(geo, extra = {}) {
    for (const poly of footprintsOf(geo, this.ground, this.o)) this.addFootprint(poly, extra);
    return this;
  }
  /** A round footprint (a dome, a rock): centre, radius. */
  addCircle(x, z, r, extra = {}) {
    const n = Math.max(10, Math.ceil((2 * Math.PI * r) / 1.2));
    return this.addFootprint(Array.from({ length: n }, (_, i) => [x + Math.cos(-i / n * Math.PI * 2) * r, z + Math.sin(-i / n * Math.PI * 2) * r]), extra);
  }
  /** A footprint polygon (convex, x z pairs, any order: its hull is taken). extra.rise scales the drift. */
  addFootprint(poly, { rise = 1 } = {}) {
    poly = hull2(poly);
    if (poly.length < 3) return this;
    const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cz = poly.reduce((s, q) => s + q[1], 0) / poly.length;
    if (this.where && !this.where(cx, cz)) return this;
    const id = this.sources.length;
    // corners with a bigger drift (deterministic: by the corner's place)
    const corners = poly.filter(([x, z]) => frac(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) < this.o.corner);
    let R = 0;
    for (const [x, z] of poly) R = Math.max(R, Math.hypot(x - cx, z - cz));
    const s = { id, poly, cx, cz, R, k: rise, corners };
    s.reach = this.o.rise[1] * this.o.big * rise * this.o.reach;
    this.sources.push(s);
    // (a grid of cells each source's reach touches, for the field's lookups)
    const r = R + s.reach;
    for (let gx = Math.floor((cx - r) / this.cell); gx <= Math.floor((cx + r) / this.cell); gx++)
      for (let gz = Math.floor((cz - r) / this.cell); gz <= Math.floor((cz + r) / this.cell); gz++) {
        const k = `${gx},${gz}`;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(s);
      }
    return this;
  }

  /** The rise at a wall facing (nx, nz) at (x, z): higher facing into the wind, wandering along the wall. */
  riseAt(nx, nz, x, z, k = 1) {
    const [lee, wind] = this.o.rise;
    const into = Math.max(0, -(nx * this.wind[0] + nz * this.wind[1]));   // the wall faces the wind
    return (lee + (wind - lee) * into) * (0.7 + 0.6 * (0.5 + 0.5 * this.noise(x * 0.21, z * 0.21))) * k;
  }
  /** One source's drift at (x, z) (m over the ground). */
  driftOf(s, x, z) {
    if (Math.abs(x - s.cx) > s.R + s.reach || Math.abs(z - s.cz) > s.R + s.reach) return 0;
    const { d, nx, nz } = polyDistance(s.poly, x, z);
    let rise = this.riseAt(nx, nz, x, z, s.k);
    // a corner's bigger drift: the nearest such corner's boost (never compounded)
    let boost = 1;
    const w = rise * this.o.reach * 1.4;
    for (const [px, pz] of s.corners) {
      const c = Math.hypot(x - px, z - pz);
      if (c < w * 1.6) boost = Math.max(boost, 1 + (this.o.big - 1) * Math.exp(-(c * c) / (w * w)));
    }
    rise *= boost;
    const reach = rise * this.o.reach;
    if (d <= 0) return rise;
    if (d >= reach) return 0;
    const u = 1 - d / reach;
    return rise * u * u;
  }
  /** The drifts' height over the ground at (x, z): the highest of the drifts that reach it. */
  fieldAt(x, z) {
    const list = this.grid.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`);
    if (!list) return 0;
    let h = 0;
    for (const s of list) { const v = this.driftOf(s, x, z); if (v > h) h = v; }
    return this.mask && h > 0 ? h * this.mask(x, z) : h;
  }

  /** The skirt round one source: positions, normals, indices (local to it). */
  skirtOf(s) {
    const pos = [], nrm = [], idx = [], fs = [], o = this.o;
    const H = (x, z) => this.ground(x, z) + this.fieldAt(x, z);
    // the offset curve's directions: along each edge, and a fan round each corner
    const P = s.poly, dirs = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], c = P[(i + 2) % P.length];
      const ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1, ox = ez / L, oz = -ex / L;
      const m = Math.max(1, Math.round(L / o.step));
      for (let j = 0; j < m; j++) dirs.push([a[0] + ex * (j / m), a[1] + ez * (j / m), ox, oz]);
      // the corner at b: from this edge's normal round to the next one's
      const fx = c[0] - b[0], fz = c[1] - b[1], F = Math.hypot(fx, fz) || 1, px = fz / F, pz = -fx / F;
      const a0 = Math.atan2(oz, ox); let a1 = Math.atan2(pz, px);
      while (a1 < a0) a1 += Math.PI * 2;
      const fan = Math.max(1, Math.ceil((a1 - a0) / o.fan));
      for (let j = 0; j < fan; j++) { const t = a0 + (a1 - a0) * (j / fan); dirs.push([b[0], b[1], Math.cos(t), Math.sin(t)]); }
    }
    const reach = o.rise[1] * o.big * s.k * o.reach * 1.02;
    const N = dirs.length, R = o.rings;
    for (const [x0, z0, dx, dz] of dirs) {
      for (let r = 0; r <= R; r++) {
        // denser near the wall, where the fillet bends
        const t = r === 0 ? -o.inside : reach * Math.pow(r / R, 1.6);
        const x = x0 + dx * t, z = z0 + dz * t;
        const f = this.fieldAt(x, z);
        fs.push(f);
        pos.push(x, this.ground(x, z) + f + o.lift, z);
        // the normal from the field (finite differences): the ground's own at the rim; never steeper
        // than DRIFT.maxSlope (where two drifts meet in a crease, or one rides up inside a wall), so
        // the sand never takes the ground's rock colour of steep slopes
        const e = 0.15;
        let gx = (H(x + e, z) - H(x - e, z)) / (2 * e), gz = (H(x, z + e) - H(x, z - e)) / (2 * e);
        const gl = Math.hypot(gx, gz);
        if (gl > o.maxSlope) { gx *= o.maxSlope / gl; gz *= o.maxSlope / gl; }
        const L = Math.hypot(gx, 1, gz);
        nrm.push(-gx / L, 1 / L, -gz / L);
      }
    }
    // (counter-clockwise round the footprint, outward along a column: faces turned up)
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      for (let r = 0; r < R; r++) {
        const a = i * (R + 1) + r, b = j * (R + 1) + r;
        // (no skirt where there is no drift: past its reach, or where the mask leaves none)
        if (Math.max(fs[a], fs[b], fs[a + 1], fs[b + 1]) < 0.004) continue;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { pos, nrm, idx };
  }

  /**
   * The skirts in `material` (the ground's, made with drift: true): a group of meshes, one per
   * DRIFT.chunk square of the map (so the view culls them), or null if there are none.
   */
  build(material) {
    if (!this.sources.length) return null;
    const chunks = new Map();
    for (const s of this.sources) {
      const k = Math.floor(s.cx / this.o.chunk) + ',' + Math.floor(s.cz / this.o.chunk);
      if (!chunks.has(k)) chunks.set(k, { pos: [], nrm: [], idx: [], n: 0 });
      const c = chunks.get(k), sk = this.skirtOf(s), base = c.pos.length / 3;
      for (const v of sk.pos) c.pos.push(v);
      for (const v of sk.nrm) c.nrm.push(v);
      for (const i of sk.idx) c.idx.push(base + i);
      c.n++;
    }
    const group = new THREE.Group();
    group.name = 'Sand banked against things (' + this.sources.length + ')';
    group.userData.drifts = this;
    let tris = 0;
    for (const [k, c] of chunks) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(c.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(c.nrm, 3));
      g.setIndex(c.idx);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, material);
      mesh.name = 'Sand banked (' + k + ': ' + c.n + ')';
      mesh.userData.drifts = this;
      group.add(mesh);
      tris += c.idx.length / 3;
    }
    group.userData.triangles = tris;
    return group;
  }
}

function frac(v) { return v - Math.floor(v); }

/**
 * The ground's material for the skirts: the same look (its options), flagged as a drift (post.js draws
 * where it meets a wall softly) and pulled in front of the ground where the two meet.
 */
export function driftMaterial(makeMaterial, groundOptions) {
  const m = makeMaterial({ ...groundOptions, drift: true });
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
  return m;
}
