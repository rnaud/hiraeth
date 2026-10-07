// The traveller's overshirt cage, simulated (src/characters/tripo-cloth.js): Verlet steps at 90 Hz, each with
// 18 passes over the edge constraints and the leg capsules. Plain arrays of numbers in and out, so the same
// code runs in a worker (tripo-cloth-worker.js: off the main thread, where it cost the handheld 6-30 ms a
// frame, docs/systems/performance.md) or here (tests, a page without workers).
export const CLOTH_STEP = 1 / 90, CLOTH_ITERATIONS = 18;
/** floats per capsule in a `caps` array: from (3), axis to - from (3), |axis|², radius, the box round it (6) */
export const CAP = 14;

/** The squared distance from (x, y, z) + outward * t to the segment from a along (ax, ay, az). */
export function segmentDistance2(t, x, y, z, ox, oy, oz, a0, a1, a2, ax, ay, az, length2) {
  const dx = x + ox * t - a0, dy = y + oy * t - a1, dz = z + oz * t - a2, u = Math.max(0, Math.min(1, (dx * ax + dy * ay + dz * az) / length2)), qx = dx - u * ax, qy = dy - u * ay, qz = dz - u * az;
  return qx * qx + qy * qy + qz * qz;
}
/**
 * How far along `outward` the point (x, y, z) must go to clear capsule k of `caps` (0: it is clear). A point
 * outside the capsule's box is clear without the distance (the box holds every point within the radius).
 */
export function pushOut(x, y, z, ox, oy, oz, caps, k) {
  const c = k * CAP, radius = caps[c + 7];
  if (x < caps[c + 8] || x > caps[c + 11] || y < caps[c + 9] || y > caps[c + 12] || z < caps[c + 10] || z > caps[c + 13]) return 0;
  const a0 = caps[c], a1 = caps[c + 1], a2 = caps[c + 2], ax = caps[c + 3], ay = caps[c + 4], az = caps[c + 5], length2 = caps[c + 6], r2 = radius * radius;
  if (segmentDistance2(0, x, y, z, ox, oy, oz, a0, a1, a2, ax, ay, az, length2) >= r2) return 0;
  let lo = 0, hi = radius * 3;
  for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (segmentDistance2(mid, x, y, z, ox, oy, oz, a0, a1, a2, ax, ay, az, length2) < r2) lo = mid; else hi = mid; }
  return hi;
}
/** capsule k of `caps` from its two ends and radius (the box: the ends' box grown by the radius) */
export function setCap(caps, k, from, to, radius) {
  const c = k * CAP, ax = to.x - from.x, ay = to.y - from.y, az = to.z - from.z;
  caps[c] = from.x; caps[c + 1] = from.y; caps[c + 2] = from.z; caps[c + 3] = ax; caps[c + 4] = ay; caps[c + 5] = az;
  caps[c + 6] = Math.max(ax * ax + ay * ay + az * az, 1e-10); caps[c + 7] = radius;
  caps[c + 8] = Math.min(from.x, to.x) - radius; caps[c + 9] = Math.min(from.y, to.y) - radius; caps[c + 10] = Math.min(from.z, to.z) - radius;
  caps[c + 11] = Math.max(from.x, to.x) + radius; caps[c + 12] = Math.max(from.y, to.y) + radius; caps[c + 13] = Math.max(from.z, to.z) + radius;
}

/**
 * `steps` steps of the cage. s: { P, Q (positions and the previous ones), G (targets), outwards (Float64Array, 3 a
 * particle), pins (1 free, 0 held on its target), edgeA, edgeB, edgeLength, edgeK }; caps (CAP floats each, radius
 * included). P and Q change in place.
 */
export function simulate(s, G, caps, steps) {
  const { P, Q, pins, outwards, edgeA, edgeB, edgeLength, edgeK } = s, N = pins.length, K = caps.length / CAP, step = CLOTH_STEP;
  for (let n = 0; n < steps; n++) {
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      if (!pins[i]) { P[j] = Q[j] = G[j]; P[j + 1] = Q[j + 1] = G[j + 1]; P[j + 2] = Q[j + 2] = G[j + 2]; continue; }
      const x = P[j], y = P[j + 1], z = P[j + 2];
      const nx = x + (x - Q[j]) * 0.90, nz = z + (z - Q[j + 2]) * 0.90;
      let ny = y + (y - Q[j + 1]) * 0.90; ny -= 1.5 * step * step;
      // Gentle tether preserves the coat's tailored volume; gravity and leg
      // contact remain free to move the hem away from its animated rest shape.
      P[j] = nx + (G[j] - nx) * 0.02; P[j + 1] = ny + (G[j + 1] - ny) * 0.02; P[j + 2] = nz + (G[j + 2] - nz) * 0.02; Q[j] = x; Q[j + 1] = y; Q[j + 2] = z;
    }
    for (let iteration = 0; iteration < CLOTH_ITERATIONS; iteration++) {
      for (let e = 0; e < edgeA.length; e++) {
        const ia = edgeA[e], ib = edgeB[e], a = ia * 3, b = ib * 3, wa = pins[ia], wb = pins[ib], w = wa + wb;
        let dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 1e-8 || !w) continue;
        const k = (d - edgeLength[e]) / d * edgeK[e] / w; dx *= k; dy *= k; dz *= k;
        if (wa) { P[a] += dx * wa; P[a + 1] += dy * wa; P[a + 2] += dz * wa; }
        if (wb) { P[b] += dx * -wb; P[b + 1] += dy * -wb; P[b + 2] += dz * -wb; }
      }
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        if (!pins[i]) { P[j] = G[j]; P[j + 1] = G[j + 1]; P[j + 2] = G[j + 2]; continue; }
        // Keep each panel on its original side of the body. A nearest-point
        // push can send a front panel into the crotch between overlapping legs.
        const ox = outwards[j], oy = outwards[j + 1], oz = outwards[j + 2];
        for (let k = 0; k < K; k++) {
          const hi = pushOut(P[j], P[j + 1], P[j + 2], ox, oy, oz, caps, k);
          if (hi) { P[j] += ox * hi; P[j + 1] += oy * hi; P[j + 2] += oz * hi; }
        }
        const inward = (P[j] - G[j]) * ox + (P[j + 1] - G[j + 1]) * oy + (P[j + 2] - G[j + 2]) * oz;
        if (inward < -0.02) { const t = -0.02 - inward; P[j] += ox * t; P[j + 1] += oy * t; P[j + 2] += oz * t; }
      }
    }
  }
}

/**
 * A worker's side (tripo-cloth-worker.js), here so it can be tested without one: 'init' gives the constants,
 * 'step' the targets, the capsules and how many steps (and, after a reset, where to start); it answers with
 * the positions and the targets they were simulated against.
 */
export function clothWorkerHandler() {
  let s = null;
  return (m) => {
    if (m.type === 'init') { s = { ...m.constants, P: new Float64Array(m.constants.pins.length * 3), Q: new Float64Array(m.constants.pins.length * 3) }; return null; }
    if (m.reset) { s.P.set(m.reset); s.Q.set(m.reset); }
    simulate(s, m.G, m.caps, m.steps);
    return { id: m.id, P: s.P.slice(), G: m.G };
  };
}
