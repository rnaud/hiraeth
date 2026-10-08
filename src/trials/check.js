import * as THREE from 'three';

// What makes a trial's course fair, checked against a world's real collision (tests/trials.test.js; the
// author's own tuning): every gate stands in the open, the way from each to the next is clear, a ground run
// can be ridden (no wall, no cliff, water all the way for the skiff), a glide can be glided (each ring low
// enough under the last, or a column of wind to climb), and the stone and the start are on the ground.
// Returns a list of problems in words ([] = fair).

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** The gates as points: a ground run's laid over the ground or the water under them. */
export function gatePoints(trial, { physics, surfaceAt = null }) {
  return trial.gates.map((g) => {
    if (!trial.ground) return { x: g[0], y: g[1], z: g[2], r: g[3] ?? 7 };
    const [x, z, r] = g;
    const ground = physics.groundAt(x, 1e4, z, 2e4);
    const water = surfaceAt?.(x, z, 1e3, 2e3)?.y ?? -Infinity;
    return { x, y: Math.max(ground, water) + (trial.up ?? 1.4), z, r: r ?? 7 };
  });
}

/** The start (feet) on the ground (or the water, for the skiff). */
export function startPoint(trial, { physics, surfaceAt = null }) {
  const [x, y, z] = trial.start;
  if (y != null) return V(x, y, z);
  const g = physics.groundAt(x, 1e4, z, 2e4), w = surfaceAt?.(x, z, 1e3, 2e3)?.y ?? -Infinity;
  return V(x, Math.max(g, w), z);
}

export function checkCourse(trial, { physics, surfaceAt = null, glide = 5.2 } = {}) {
  const out = [];
  if (trial.eyes) {
    // a game of eyes: each on the ground, in the open
    trial.eyes.forEach(([x, z], i) => {
      const g = physics.groundAt(x, 1e4, z, 2e4);
      if (!Number.isFinite(g)) out.push(`eye ${i + 1}: no ground`);
      else if (physics.rayDistance(V(x, g + 2.6, z), V(0, 1, 0), 3) < 3) out.push(`eye ${i + 1}: something just over it`);
      else if (surfaceAt?.(x, z, 1e3, 2e3)?.y > g + 0.3) out.push(`eye ${i + 1}: under water`);
    });
    return out;
  }
  const pts = gatePoints(trial, { physics, surfaceAt });
  const s = startPoint(trial, { physics, surfaceAt });
  if (!Number.isFinite(s.y)) out.push('the start has no ground');
  const winds = (trial.winds ?? []).map(([x, z, r, h]) => { const g = physics.groundAt(x, 1e4, z, 2e4); return { x, z, r, top: g + h, foot: g }; });
  const inWind = (p) => winds.find((w) => Math.hypot(p.x - w.x, p.z - w.z) < w.r && p.y > w.foot - 1 && p.y < w.top + 1);
  let prev = { x: s.x, y: s.y + 1.2, z: s.z };
  pts.forEach((g, i) => {
    const label = `gate ${i + 1}`;
    const below = physics.groundAt(g.x, g.y, g.z, 4e3);
    if (!trial.ground && Number.isFinite(below) && g.y - below < 2.5) out.push(`${label}: only ${(g.y - below).toFixed(1)} m over the ground`);
    const up = physics.rayDistance(V(g.x, g.y, g.z), V(0, 1, 0), 3);
    if (up < 2.5) out.push(`${label}: something just over it (${up.toFixed(1)} m)`);
    // the way from the last gate (or the start) to this one
    const a = V(prev.x, prev.y, prev.z), b = V(g.x, g.y, g.z), d = a.distanceTo(b), dir = b.clone().sub(a).normalize();
    if (trial.ground) {
      const n = Math.ceil(d / 3);
      let last = null;
      for (let k = 0; k <= n; k++) {
        const p = a.clone().lerp(b, k / n);
        const gy = physics.groundAt(p.x, Math.max(p.y, last ?? -1e9) + 6, p.z, 60);
        const wy = surfaceAt?.(p.x, p.z, 1e3, 2e3)?.y ?? -Infinity;
        if (trial.mode === 'skiff' && !(wy > gy - 0.05)) { out.push(`${label}: no water on the way (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`); break; }
        const y = Math.max(gy, wy);
        if (k > 0) {   // (nothing standing in the way at the rider's height: a trunk, a wall)
          const q = a.clone().lerp(b, (k - 1) / n), from = V(q.x, (last ?? y) + 1.1, q.z), to = V(p.x, y + 1.1, p.z), dd = from.distanceTo(to);
          if (dd > 0.1 && physics.rayDistance(from, to.clone().sub(from).normalize(), dd) < dd - 0.05) { out.push(`${label}: something stands in the way (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`); break; }
        }
        if (last !== null && Math.abs(y - last) > (trial.mode === 'foot' ? 2.6 : 1.8)) { out.push(`${label}: a step of ${(y - last).toFixed(1)} m on the way (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`); break; }
        last = y;
      }
    } else if (physics.rayDistance(a, dir, d) < d - 0.5) out.push(`${label}: the way from the last is blocked (${physics.rayDistance(a, dir, d).toFixed(0)} of ${d.toFixed(0)} m)`);
    if (trial.mode === 'glider' && i > 0) {
      const w = inWind(prev);
      const from = w ? Math.max(prev.y, w.top) : prev.y, flat = Math.hypot(g.x - prev.x, g.z - prev.z);
      const toWind = inWind(g);
      if (!toWind && from - g.y < flat / glide - 2) out.push(`${label}: too high to glide to (${(from - g.y).toFixed(1)} m down over ${flat.toFixed(0)} m)`);
      if (toWind && from - (flat / glide) < toWind.foot + 2) out.push(`${label}: you reach its column too low`);
    }
    prev = g;
  });
  return out;
}
