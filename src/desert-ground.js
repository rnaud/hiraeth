import { CatmullRomCurve3, Vector3 } from 'three';
import { smoothstep } from './noise.js';

// Channels cut into the desert's ground (src/desert-landmarks.js desertHeight): the old river's dry wash under the
// giants' road (src/desert-giants.js). A channel follows a smooth line through its points and is cut `depth` m into
// the dunes as they lie (so where a dune has walked over the old riverbed the bed goes up and over it with them): a
// level bed `bed` m either side of the line, then the bank rising back to the dunes over `bank` m, steep at the bed
// (a concave toe: no limit there) and easing to nothing at the lip, its convex bend spread over the whole bank
// (2·depth / bank²: under the dunes' own, tests/dunes.test.js, so the bike is not thrown off the lip). Past the lip
// nothing is touched. Its ends fade over `fade` m.
//
//   const c = channel(points, { bed, bank, depth })   →   c.height(x, z, h)  (h: the ground before it)

/** How deep the channel cuts at s metres from its line (depth on the bed, 0 past the lip). */
export function cutDepth(s, { bed, bank, depth }) {
  if (s <= bed) return depth;
  const u = s - bed;
  if (u >= bank) return 0;
  const slope = 2 * depth / bank;
  return depth - slope * u + slope * u * u / (2 * bank);
}

/**
 * A level pan: the ground inside `r` brought to one level, faded back to the dunes over `fade` m (a smoothstep:
 * its bend 6·Δ / fade², gentle at 60 m). The level is the mean of the ground round its rim (`base`, asked the first
 * time), so the rim is as low as it can be.  →  { level(), height(x, z, h), x, z, r }
 */
export function pan({ x, z, r, fade }, base) {
  let L = null;
  const level = () => {
    if (L != null) return L;
    let sum = 0;
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, d = r + fade * 0.4; sum += base(x + Math.cos(a) * d, z + Math.sin(a) * d); }
    return (L = sum / 24);
  };
  return {
    x, z, r, level,
    height(px, pz, h) {
      const d = Math.hypot(px - x, pz - z);
      if (d >= r + fade) return h;
      const k = smoothstep(r, r + fade, d);
      return level() + (h - level()) * k;
    },
  };
}

export function channel(points, o) {
  const opt = { fade: 60, step: 4, ...o };
  const curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.max(2, Math.ceil(curve.getLength() / opt.step));
  const P = curve.getSpacedPoints(n).map((p) => [p.x, p.z]);
  const along = [0];
  for (let i = 1; i < P.length; i++) along.push(along[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const length = along[along.length - 1], reach = opt.bed + opt.bank;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  x0 -= reach; x1 += reach; z0 -= reach; z1 += reach;
  // (the segments near each 40 m cell of its box: the terrain asks ~100k times)
  const CELL = 40, cw = Math.ceil((x1 - x0) / CELL), cells = new Map();
  const near = (cx, cz) => {
    const key = cz * cw + cx;
    let list = cells.get(key);
    if (!list) {
      const mx = x0 + (cx + 0.5) * CELL, mz = z0 + (cz + 0.5) * CELL, r = reach + CELL;
      list = [];
      for (let i = 0; i < P.length - 1; i++) {
        const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((mx - ax) * dx + (mz - az) * dz) / (dx * dx + dz * dz)));
        if (Math.hypot(ax + dx * t - mx, az + dz * t - mz) < r) list.push(i);
      }
      cells.set(key, list);
    }
    return list;
  };
  /** The nearest point of the line: { s: metres from it, a: metres along it, i: the segment }. */
  function nearest(x, z) {
    let best = Infinity, a = 0, bi = 0;
    const list = x >= x0 && x <= x1 && z >= z0 && z <= z1 ? near(Math.floor((x - x0) / CELL), Math.floor((z - z0) / CELL)) : P.slice(1).map((_, i) => i);
    for (const i of list) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
      const px = ax + dx * t - x, pz = az + dz * t - z, d = px * px + pz * pz;
      if (d < best) { best = d; a = along[i] + t * (along[i + 1] - along[i]); bi = i; }
    }
    return { s: Math.sqrt(best), a, i: bi };
  }
  const fadeAt = (a) => smoothstep(0, opt.fade, a) * smoothstep(0, opt.fade, length - a);

  return {
    points: P, length, curve, opt,
    nearest, fadeAt,
    /** How deep it is cut at x, z (m). */
    depthAt(x, z) {
      if (x < x0 || x > x1 || z < z0 || z > z1) return 0;
      const { s, a } = nearest(x, z);
      return s >= reach ? 0 : cutDepth(s, opt) * fadeAt(a);
    },
    /** The ground at x, z with the channel cut into it (`h`: the ground before it). */
    height(x, z, h) { return h - this.depthAt(x, z); },
  };
}
