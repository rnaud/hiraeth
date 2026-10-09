// The pure measures of a walk cycle (docs/systems/procedural-animation.md, "Measuring").
// Inputs are plain arrays sampled once a frame, so the same numbers come from any rig:
//   feet[k]   = [[x, y, z], ...]  a foot's world position per frame
//   hips[k]   = [[x, y, z], ...]  where that leg hangs from the body, per frame
//   body      = [[x, y, z], ...]  the body's (root's) world position per frame
// tests/motion-metrics.test.js checks each against hand-made gaits.

/** min, max and their span of a list of numbers. */
export function rangeOf(values) {
  let min = Infinity, max = -Infinity;
  for (const v of values) { if (v < min) min = v; if (v > max) max = v; }
  return values.length ? { min, max, span: max - min } : { min: 0, max: 0, span: 0 };
}

/** Per frame: is the foot on the ground (within eps of the lowest it got over the run)? */
export function contactMask(foot, eps = 0.03) {
  const low = rangeOf(foot.map((p) => p[1])).min;
  return foot.map((p) => p[1] <= low + eps);
}

/**
 * How far a foot moves over the ground while it is on it (m): a planted foot should not move at all.
 * slide: the total; worst: the longest single contact's slide; share: the share of frames in contact.
 */
export function footSlide(foot, eps = 0.03) {
  const on = contactMask(foot, eps);
  let slide = 0, run = 0, worst = 0, n = 0;
  for (let i = 0; i < foot.length; i++) {
    if (on[i]) n++;
    if (i && on[i] && on[i - 1]) {
      const d = Math.hypot(foot[i][0] - foot[i - 1][0], foot[i][2] - foot[i - 1][2]);
      slide += d; run += d; worst = Math.max(worst, run);
    } else run = 0;
  }
  return { slide, worst, share: foot.length ? n / foot.length : 0 };
}

/** Horizontal distance the body covered (m). */
export function travelled(body) {
  let d = 0;
  for (let i = 1; i < body.length; i++) d += Math.hypot(body[i][0] - body[i - 1][0], body[i][2] - body[i - 1][2]);
  return d;
}

/** Steps a second: how often a foot leaves the ground (a contact ending), over the run's time. */
export function cadence(foot, seconds, eps = 0.03) {
  const on = contactMask(foot, eps);
  let lifts = 0;
  for (let i = 1; i < on.length; i++) if (on[i - 1] && !on[i]) lifts++;
  return seconds > 0 ? lifts / seconds : 0;
}

/** The hip-to-foot distance over the run: a stick leg keeps one length (span 0); a knee that bends changes it. */
export function reach(hip, foot) {
  return rangeOf(foot.map((p, i) => Math.hypot(p[0] - hip[i][0], p[1] - hip[i][1], p[2] - hip[i][2])));
}

/** The angle (rad) at b between a-b and c-b: a knee's bend from three joint positions (PI = straight). */
export function jointAngle(a, b, c) {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const lu = Math.hypot(...u), lv = Math.hypot(...v);
  if (lu < 1e-9 || lv < 1e-9) return Math.PI;
  return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv))));
}

/** Pearson correlation of two equal-length series (0 when either is flat). */
export function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa < 1e-12 || sbb < 1e-12 ? 0 : sab / Math.sqrt(saa * sbb);
}

/**
 * Which legs move together: legs whose feet swing fore and aft in step (the foot's offset from its hip along the
 * way walked, `dir` [x, z]; correlation over `same`) fall in one group (leg indices). Heights would not do: a
 * pendulum leg lifts its foot at both ends of its swing, so two legs half a cycle apart have the same heights.
 * A tripod gait on six legs gives two groups of alternating legs; all left legs in one group and all right in
 * the other is the "each side in phase" error. A leg that never swings is a group of its own.
 */
export function gaitGroups(feet, hips, dir = [0, 1], same = 0.9) {
  const l = Math.hypot(dir[0], dir[1]) || 1, dx = dir[0] / l, dz = dir[1] / l;
  const xs = feet.map((f, k) => f.map((p, i) => (p[0] - hips[k][i][0]) * dx + (p[2] - hips[k][i][2]) * dz));
  const groups = [], seen = new Set();
  for (let i = 0; i < xs.length; i++) {
    if (seen.has(i)) continue;
    const g = [i]; seen.add(i);
    for (let j = i + 1; j < xs.length; j++) if (!seen.has(j) && correlation(xs[i], xs[j]) > same) { g.push(j); seen.add(j); }
    groups.push(g);
  }
  return groups;
}

/**
 * The whole report for one creature over a run: per leg slide, reach and cadence, and the totals the review
 * rubric reads (.claude/skills/procedural-animation/SKILL.md): slide per metre walked (a leg's average), the
 * worst single contact's slide, the stiffest leg's reach span, the lowest foot lift, the body's bob, the groups.
 */
export function walkReport({ feet, hips, body, seconds, eps = 0.03 }) {
  const dist = travelled(body);
  const legs = feet.map((f, k) => ({ ...footSlide(f, eps), reach: reach(hips[k], f), cadence: cadence(f, seconds, eps), lift: rangeOf(f.map((p) => p[1])).span }));
  const slide = legs.reduce((s, l) => s + l.slide, 0);
  return {
    distance: dist,
    slidePerMetre: dist > 1e-6 && legs.length ? slide / dist / legs.length : 0,
    worstSlide: legs.length ? Math.max(...legs.map((l) => l.worst)) : 0,
    reachSpan: legs.length ? Math.min(...legs.map((l) => l.reach.span)) : 0,
    lift: legs.length ? Math.min(...legs.map((l) => l.lift)) : 0,
    cadence: legs.length ? legs.reduce((s, l) => s + l.cadence, 0) / legs.length : 0,
    bob: rangeOf(body.map((p) => p[1])).span,
    groups: gaitGroups(feet, hips, body.length > 1 ? [body.at(-1)[0] - body[0][0], body.at(-1)[2] - body[0][2]] : [0, 1]),
    legs,
  };
}
