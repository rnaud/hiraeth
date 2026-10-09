// The visual audit's probes, their pure part (.claude/skills/visual-audit/SKILL.md, sections 3-5; the browser part
// is .claude/skills/visual-audit/probes.mjs; tests/visual-probes.test.js). Each probe is aimed at a bug that the
// still frames of the audit missed (docs/systems/rendering.md, "Shadows close up", "Spot blacks anchored to the
// surface"):
//
//   ghostCheck      a person in front of a dark area must not change the screen-space masks (post.js enclosure,
//                   creaseAO) beside their silhouette: a pale copy of them there is the "white shadow" of
//                   620c4384, a dark one the halo before it.
//   stability       the same surface points, followed while the camera orbits a fixed point: their spot-black
//                   mask must stay put. Masks that come and go with the view are the blocks of c58cbcaa.
//   litRidges       the light term (debug 5) inside a cave or a room: thin bright lines with dark either side
//                   (a slit the sun shines through: the cave seam of c58cbcaa).
//   floorSlits      horizontal rays at the foot of a wall and a metre up: the foot escaping where the wall stands
//                   is a gap under it.
//   stairRisers     a ground profile with risers (the stairs to aim the orbit at); cornerOf: two walls meeting.
//
// Images are { data: Float32Array | number[] (0..1, one value a pixel, row by row from the top), w, h }.

/** A mask's value per pixel from an RGBA(-ish) picture: `pick(r, g, b)` -> 0..1, null for "not this view's pixel" (0). */
export function maskOf({ pixels, channels, width, height }, pick) {
  const data = new Float32Array(width * height);
  for (let i = 0, j = 0; j < data.length; i += channels, j++) data[j] = pick(pixels[i], pixels[i + 1], pixels[i + 2]) ?? 0;
  return { data, w: width, h: height };
}

/** Debug 9 (post.js: 1 - enclosure, white open): how closed in, 1 dark. */
export const enclosurePick = (r) => 1 - r / 255;
/** Debug 10 (post.js: vec4(cast, spot, 0.2)): the spot mask where the spot tier ran (blue 0.2), 0 elsewhere. */
export const spotPick = (r, g, b) => (Math.abs(b - 51) <= 3 ? g / 255 : 0);
/** Debug 5 (the light term, white lit). */
export const lightPick = (r) => r / 255;

/** Pixels that differ between two pictures (the albedo with and without a person): the person's silhouette. */
export function silhouette(a, b, threshold = 10) {
  const n = a.width * a.height, out = new Uint8Array(n);
  for (let j = 0, i = 0; j < n; j++, i += a.channels) {
    const d = Math.max(Math.abs(a.pixels[i] - b.pixels[i]), Math.abs(a.pixels[i + 1] - b.pixels[i + 1]), Math.abs(a.pixels[i + 2] - b.pixels[i + 2]));
    out[j] = d > threshold ? 1 : 0;
  }
  return out;
}

/** A mask grown by r pixels (a square), so a silhouette's antialiased edge isn't counted as a ghost. */
export function dilate(mask, w, h, r) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) out[yy * w + xx] = 1;
  }
  return out;
}

/** Connected regions (4-neighbour) of a 0/1 mask: their sizes, biggest first, and each one's box. */
export function blobs(mask, w, h) {
  const seen = new Uint8Array(mask.length), out = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || seen[s]) continue;
    let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    const stack = [s]; seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p - x) / w;
      n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
    }
    out.push({ n, box: [x0, y0, x1, y1] });
  }
  return out.sort((a, b) => b.n - a.n);
}

/**
 * The person alone in a silhouette (the albedo with and without them also differs where the world moves: cloth, birds):
 * the region nearest the screen point `at` (their chest), and any region overlapping its box grown by `grow` px (a
 * cape, the blade, a foot apart).
 */
export function personBlob(sil, w, h, at, grow = 12) {
  const seen = new Int32Array(sil.length).fill(-1), regions = [];
  for (let s = 0; s < sil.length; s++) {
    if (!sil[s] || seen[s] >= 0) continue;
    const id = regions.length, px = [], stack = [s]; seen[s] = id;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p - x) / w;
      px.push(p); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && sil[q] && seen[q] < 0) { seen[q] = id; stack.push(q); }
    }
    regions.push({ px, box: [x0, y0, x1, y1] });
  }
  const out = new Uint8Array(sil.length);
  if (!regions.length) return out;
  const dist = (r) => Math.hypot(Math.max(r.box[0] - at[0], 0, at[0] - r.box[2]), Math.max(r.box[1] - at[1], 0, at[1] - r.box[3])) - r.px.length * 1e-6;
  const main = regions.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  if (dist(main) > 60) return out;   // (nobody near where the person should be)
  const B = [main.box[0] - grow, main.box[1] - grow, main.box[2] + grow, main.box[3] + grow];
  for (const r of regions) if (r === main || (r.box[0] <= B[2] && r.box[2] >= B[0] && r.box[1] <= B[3] && r.box[3] >= B[1] && r.px.length < main.px.length)) for (const p of r.px) out[p] = 1;
  return out;
}

/** Pixels where two takes of the same mask differ (nothing moved but the world's own motion): left out of a comparison. */
export function noiseOf(a, b, step = 0.15) {
  const out = new Uint8Array(a.data.length);
  for (let p = 0; p < out.length; p++) out[p] = Math.abs(a.data[p] - b.data[p]) > step ? 1 : 0;
  return dilate(out, a.w, a.h, 2);
}

/**
 * A person in front of a dark area: the mask with them (m1) against without them (m0), outside their silhouette
 * grown by `pad` px and within `reach` px of it (the occlusion taps reach at most 96 px). `pale`: where the mask
 * lost more than `step` (a hole in a dark mass: the person counted as open space), `dark`: where it gained (a halo).
 * The verdict compares the biggest pale region with the person's own size (a ghost is a copy of them: over `ghost`
 * of it), or `minPale` px whatever their size (a person close up). Tuned on 620c4384's bug: the Qanat stairs, Handheld,
 * 0.11 of the person before the fix, 0.003 after; the Hearth 703 px before, 0 after.
 */
export function ghostCheck(m1, m0, sil, { pad = 3, reach = 96, step = 0.3, ghost = 0.05, minPale = 300, noise = null } = {}) {
  const { w, h } = m1, near = dilate(sil, w, h, pad);
  let x0 = w, y0 = h, x1 = -1, y1 = -1, person = 0;
  for (let p = 0; p < sil.length; p++) if (sil[p]) { person++; const x = p % w, y = (p - x) / w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const pale = new Uint8Array(sil.length), dark = new Uint8Array(sil.length);
  let paleN = 0, darkN = 0, massN = 0;
  if (person) for (let y = Math.max(0, y0 - reach); y <= Math.min(h - 1, y1 + reach); y++) for (let x = Math.max(0, x0 - reach); x <= Math.min(w - 1, x1 + reach); x++) {
    const p = y * w + x;
    if (near[p] || (noise && noise[p])) continue;   // (noise: what changes with no one moving: the world's own motion)
    if (m0.data[p] > 0.5) massN++;
    const d = m1.data[p] - m0.data[p];
    if (d < -step) { pale[p] = 1; paleN++; } else if (d > step) { dark[p] = 1; darkN++; }
  }
  const paleBlobs = blobs(pale, w, h), darkBlobs = blobs(dark, w, h);
  const biggestPale = paleBlobs[0]?.n ?? 0, biggestDark = darkBlobs[0]?.n ?? 0;
  return {
    person, mass: massN, pale: paleN, dark: darkN, biggestPale, biggestDark,
    paleShare: person ? biggestPale / person : 0, darkShare: person ? biggestDark / person : 0,
    paleBox: paleBlobs[0]?.box ?? null,
    flags: [person < 50 && 'person hardly in view', person && (biggestPale / person > ghost || biggestPale >= minPale) && 'pale person-shaped region in the dark mask', person && biggestDark / person > 0.3 && 'dark halo round the person'].filter(Boolean),
  };
}

/**
 * Surface points followed over an orbit: series[i] = the mask at point i in each frame (null where it is hidden or
 * off screen). A point "comes and goes" when its mask spans more than `swing` over the frames it is seen in; the
 * frame-to-frame steps say how much it slides. Points seen in fewer than `minSeen` frames are left out.
 */
export function stability(series, { swing = 0.35, minSeen = 4 } = {}) {
  const steps = [];
  let kept = 0, flips = 0, dark = 0;
  for (const s of series) {
    const v = s.filter((x) => x !== null && x !== undefined);
    if (v.length < minSeen) continue;
    kept++;
    const lo = Math.min(...v), hi = Math.max(...v);
    if (hi - lo > swing) flips++;
    if (hi > swing) dark++;
    for (let i = 1; i < s.length; i++) if (s[i] != null && s[i - 1] != null) steps.push(Math.abs(s[i] - s[i - 1]));
  }
  steps.sort((a, b) => a - b);
  const mean = steps.length ? steps.reduce((a, b) => a + b, 0) / steps.length : 0;
  return {
    points: kept, flips, dark,
    flipShare: kept ? flips / kept : 0,
    // of the points that are ever dark, how many come and go (the measure that ignores open, lit ground)
    flipOfDark: dark ? flips / dark : 0,
    meanStep: mean, p95Step: steps.length ? steps[Math.min(steps.length - 1, Math.floor(steps.length * 0.95))] : 0,
  };
}
/**
 * The verdict on a stability result (tuned on c58cbcaa's bug, the build before against main, the desert's known spots
 * orbited ±32° in 8° steps: docs/audits/visual-v1.4.md). The 95th percentile of the frame-to-frame step: the Qanat
 * stairs 0.60 before (Handheld and High), 0.20-0.23 after; the Hearth 0.54 / 0.25 before, 0.18-0.24 / 0.03 after. The
 * share of the dark points that come and go is reported but not a verdict: a mask's wavy edge, re-read a pixel off, and
 * a mass that slides slowly with the view (the stairs 0.45-0.52 after the fix, a desert corner 0.92) both count.
 */
export const STABLE = { p95Step: 0.3, drift: 0.85, manyDark: 200, minDark: 12 };
export const unstable = (r, T = STABLE) => r.dark >= T.minDark && r.p95Step > T.p95Step;
/** Not a block that jumps but a mask that slides across the surface over the orbit (most dark points change, in small steps): a picture to look at. */
export const drifting = (r, T = STABLE) => r.dark >= T.manyDark && r.flipOfDark > T.drift && r.p95Step <= T.p95Step;

/**
 * Thin lit lines in a picture of the light term: a pixel brighter than `bright` and brighter by `contrast` than the
 * pixels `gap` above and below it (or left and right of it). Runs of at least `minRun` such pixels along a row (or a
 * column) are the lines; a floor/wall seam lit by a slit is one long run (the cave seam of c58cbcaa: the sky, 1.0 in
 * debug 5, seen through it as a white line 4-8 px thick between the wall's 0.2-0.4 and the floor's 0.4).
 */
export function litRidges(img, { bright = 0.75, contrast = 0.3, gap = 6, minRun = 24, skipTop = 0 } = {}) {
  const { data: L, w, h } = img;
  const ridge = (x, y, dx, dy) => {
    const v = L[y * w + x];
    if (v < bright) return false;
    const a = L[(y - dy * gap) * w + (x - dx * gap)], b = L[(y + dy * gap) * w + (x + dx * gap)];
    return v - a > contrast && v - b > contrast;
  };
  const runs = [];
  let px = 0;
  for (let y = Math.max(gap, skipTop); y < h - gap; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && ridge(x, y, 0, 1);
      if (on) px++;
      if (on && start < 0) start = x;
      if (!on && start >= 0) { if (x - start >= minRun) runs.push({ dir: 'row', at: y, from: start, to: x - 1, n: x - start }); start = -1; }
    }
  }
  for (let x = gap; x < w - gap; x++) {
    let start = -1;
    for (let y = Math.max(0, skipTop); y <= h; y++) {
      const on = y < h && ridge(x, y, 1, 0);
      if (on && start < 0) start = y;
      if (!on && start >= 0) { if (y - start >= minRun) runs.push({ dir: 'col', at: x, from: start, to: y - 1, n: y - start }); start = -1; }
    }
  }
  runs.sort((a, b) => b.n - a.n);
  // a lit line is a run that isn't one of a stack of neighbours (a lit patch's edge rows all pass the test at gap 3)
  const lines = runs.filter((r) => !runs.some((o) => o !== r && o.dir === r.dir && Math.abs(o.at - r.at) > gap && Math.abs(o.at - r.at) <= gap * 2 && o.from <= r.to && o.to >= r.from && o.n >= r.n * 0.8));
  return { px, runs: lines.slice(0, 12), longest: lines[0]?.n ?? 0 };
}

/**
 * Rays from a point inside a room or a cave, level, at the foot of the walls (`low`, a few cm over the floor) and a
 * metre up (`high`): distances, null for nothing hit within reach. A slit is a direction where the wall stands a
 * metre up but the foot ray goes `margin` m further (or out): the dome's foot raised off the floor.
 */
export function floorSlits(rays, { reach = 40, margin = 1.5 } = {}) {
  const out = [];
  for (const r of rays) {
    if (r.high === null || r.high > reach) continue;   // (no wall there: a door, the open side)
    if (r.low === null || r.low > r.high + margin) out.push({ angle: r.angle, high: r.high, low: r.low });
  }
  return out;
}

/**
 * Risers in a profile of ground heights taken every `step` m along a line: steps up (or down) between `rise[0]`
 * and `rise[1]` m within one sample, at least `minTread` m apart. Returns the risers (index, height) and whether
 * they make stairs (at least `minCount` of them in a row, `maxGap` m apart at most).
 */
export function stairRisers(heights, step = 0.2, { rise = [0.1, 0.55], minTread = 0.2, minCount = 3, maxGap = 1.6 } = {}) {
  const risers = [];
  for (let i = 1; i < heights.length; i++) {
    const d = heights[i] - heights[i - 1];
    if (!Number.isFinite(d)) continue;
    if (Math.abs(d) >= rise[0] && Math.abs(d) <= rise[1] && (!risers.length || (i - risers.at(-1).i) * step >= minTread)) risers.push({ i, d });
  }
  let best = [], run = [];
  for (const r of risers) {
    if (run.length && ((r.i - run.at(-1).i) * step > maxGap || Math.sign(r.d) !== Math.sign(run.at(-1).d))) run = [];
    run.push(r);
    if (run.length > best.length) best = run.slice();
  }
  return { risers, stairs: best.length >= minCount, run: best };
}

/** Where two walls meet, from two level hits { p: [x, z], n: [x, z] } whose normals are near square: the corner and its bisector. */
export function cornerOf(a, b, { square = 0.35 } = {}) {
  const dot = a.n[0] * b.n[0] + a.n[1] * b.n[1];
  if (Math.abs(dot) > square) return null;
  // wall A: points q with (q - a.p) . a.n = 0; the same for B: solve the 2 x 2
  const det = a.n[0] * b.n[1] - a.n[1] * b.n[0];
  if (Math.abs(det) < 1e-6) return null;
  const ca = a.n[0] * a.p[0] + a.n[1] * a.p[1], cb = b.n[0] * b.p[0] + b.n[1] * b.p[1];
  const x = (ca * b.n[1] - cb * a.n[1]) / det, z = (a.n[0] * cb - b.n[0] * ca) / det;
  const bx = a.n[0] + b.n[0], bz = a.n[1] + b.n[1], l = Math.hypot(bx, bz) || 1;
  return { p: [x, z], n: [bx / l, bz / l] };
}

/** The probes' camera orbit round a point: yaw offsets (degrees), a few at a time. */
export const ORBIT = { yaw: [-32, -24, -16, -8, 0, 8, 16, 24, 32], distance: 6.5, lift: 1.6 };
