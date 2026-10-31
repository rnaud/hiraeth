// #800 family F: a long body's spine measured from its mesh (the worm's): from its tail's tip, a slab across the body at
// each step (its vertices within `r` of the last point), its middle the next point, the heading eased from the last
// steps; until the slab runs out (past the head) or `stop(p)` says so. Then smoothed and resampled every `step` m.
// Returns [[x, y, z], …] from the tail to the head.
export function trackSpine(P, n, { start, dir, step = 0.1, slab = 0.05, r = 0.85, stop = () => false, most = 80 }) {
  const pts = [start.slice()], d = dir.slice();
  for (let i = 0; i < most; i++) {
    const c = pts[pts.length - 1], next = [c[0] + d[0] * step, c[1] + d[1] * step, c[2] + d[2] * step];
    const s = [0, 0, 0]; let k = 0;
    for (let v = 0; v < n; v++) {
      const q = [P[v * 3] - next[0], P[v * 3 + 1] - next[1], P[v * 3 + 2] - next[2]];
      if (Math.abs(q[0] * d[0] + q[1] * d[1] + q[2] * d[2]) > slab || Math.hypot(...q) > r) continue;
      s[0] += P[v * 3]; s[1] += P[v * 3 + 1]; s[2] += P[v * 3 + 2]; k++;
    }
    if (k < 12) break;
    const m = s.map((x) => x / k);
    const nd = [m[0] - c[0], m[1] - c[1], m[2] - c[2]], l = Math.hypot(...nd) || 1;
    for (let j = 0; j < 3; j++) d[j] = d[j] * 0.5 + (nd[j] / l) * 0.5;
    const dl = Math.hypot(...d); for (let j = 0; j < 3; j++) d[j] /= dl;
    pts.push(m);
    if (stop(m)) break;
  }
  // smoothed (three passes of a 3-point average, the ends kept) and resampled by arc length
  let q = pts;
  for (let pass = 0; pass < 3; pass++) q = q.map((p, i) => (i === 0 || i === q.length - 1 ? p : p.map((x, j) => (q[i - 1][j] + 2 * x + q[i + 1][j]) / 4)));
  const len = [0]; for (let i = 1; i < q.length; i++) len.push(len[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]));
  const out = [];
  for (let s = 0; s <= len[len.length - 1] + 1e-9; s += step) {
    let i = 1; while (i < len.length - 1 && len[i] < s) i++;
    const t = (s - len[i - 1]) / Math.max(1e-9, len[i] - len[i - 1]);
    out.push(q[i - 1].map((x, j) => +(x + (q[i][j] - x) * t).toFixed(4)));
  }
  return out;
}
