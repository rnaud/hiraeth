// The level design audit's pure logic (.claude/skills/level-design-qc/SKILL.md): a world's points of
// interest, its critical path and its landmarks, measured and scored. Plain [x, y, z] arrays in, plain
// objects out; the only callbacks are `los(a, b)` (can b be seen from a?) and `ground(x, z)`, which
// scripts/level-design/audit.mjs builds from the real level's collision. tests/level-design.test.js
// shows each function the case it is for.
//
//   dedupe(pois, r)                       points of interest closer than r merged (their kinds kept)
//   spacing(pois)                         each one's nearest neighbour, and the spread
//   samplePath(stops, step, drape)        points every `step` m along the critical path (drape: laid on the ground where it rides over a dip)
//   interestGaps(samples, pois, r)        the stretches of the path with nothing within r: the empty walks
//   returnLegs(stops, pois)               legs that come back the way you went, and whether anything new is on them
//   remote(pois, samples, far)            optional places far from the path and from everything else (dead ends)
//   gravity(pois, samples)                optional places by their distance to the path: on it, pulling, remote
//   landmarksFrom(grid, opts)             the tall shapes in a height grid (towers, spires, mesas)
//   visibleCount(points, landmarks, los)  how many landmarks each point sees
//   legGuidance(stops, landmarks, los)    does each leg's start see where it goes (or a landmark by it)?
//   vertical(pois, samples, ground)       height range, raised places, the climb along the path
//   pacing(stops)                         the kinds of stop along the path, and the longest run of one kind
//   scoreWorld(m)                         the rubric's criteria, 1-5 each
//   mapPng(grid, overlay) / encodePNG     a top-down map: relief, the path, the places, the landmarks

import { deflateSync } from 'node:zlib';

export const RUN = 8.2, WALK = 3.8;   // m/s (src/player.js RUN, WALK)
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Points closer than r (horizontally, and within 8 m of height) merged into one; kinds and names kept. */
export function dedupe(pois, r = 6) {
  const out = [];
  for (const p of pois) {
    const q = out.find((o) => flat(o.pos, p.pos) < r && Math.abs(o.pos[1] - p.pos[1]) < 8);
    if (q) { q.kinds = [...new Set([...q.kinds, ...(p.kinds ?? [p.kind])])]; q.names = [...new Set([...q.names, ...(p.names ?? [p.name])])]; q.main ||= !!p.main; q.optional = q.optional && !!p.optional; }
    else out.push({ ...p, kinds: p.kinds ?? [p.kind], names: p.names ?? [p.name], main: !!p.main, optional: !!p.optional });
  }
  return out;
}

const pct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
/** Each place's nearest neighbour; the median, the 90th percentile and the loners (over `lonely` m from anything). */
export function spacing(pois, { lonely = 150 } = {}) {
  const nn = pois.map((p) => Math.min(Infinity, ...pois.filter((q) => q !== p).map((q) => dist(p.pos, q.pos))));
  const finite = nn.filter(Number.isFinite);
  return {
    count: pois.length,
    median: +pct(finite, 0.5).toFixed(1), p90: +pct(finite, 0.9).toFixed(1), max: +(finite.length ? Math.max(...finite) : 0).toFixed(1),
    loners: pois.map((p, i) => ({ name: p.names?.[0] ?? p.name, nn: +nn[i].toFixed(1) })).filter((x) => x.nn > lonely),
  };
}

/**
 * The path through doorways that take you elsewhere (portals: { at, to }): a leg that is much shorter
 * through one (into its mouth, out at its far end) goes that way, and the hop itself is marked `jump`
 * (no distance walked). Used where a world's parts sit far apart (the Hangar's gravity zones).
 */
export function viaPortals(stops, portals = [], { gain = 0.95 } = {}) {
  const out = [stops[0]];
  for (let i = 1; i < stops.length; i++) {
    const a = out[out.length - 1].pos, b = stops[i].pos, d = dist(a, b);
    const hops = portalRoute(a, b, portals);
    if (hops && hops.cost < d * gain) for (const p of hops.via) out.push({ label: p.label ?? 'portal', kind: 'portal', pos: p.at }, { label: `${p.label ?? 'portal'} (far side)`, kind: 'portal', pos: p.to, jump: true });
    out.push(stops[i]);
  }
  return out;
}
/** The shortest way from a to b walking and through any number of portals (Dijkstra over their mouths): { cost, via: [portals in order] } or null when none is used. */
export function portalRoute(a, b, portals) {
  // nodes: 0 = a, 1 = b, then each portal's far end (2 + i); from a node you walk to b or into any portal's mouth
  const n = 2 + portals.length, cost = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  const pos = (k) => (k === 0 ? a : k === 1 ? b : portals[k - 2].to);
  cost[0] = 0;
  for (;;) {
    let u = -1;
    for (let k = 0; k < n; k++) if (!done[k] && cost[k] < Infinity && (u < 0 || cost[k] < cost[u])) u = k;
    if (u < 0 || u === 1) break;
    done[u] = true;
    const here = pos(u);
    if (cost[u] + dist(here, b) < cost[1]) { cost[1] = cost[u] + dist(here, b); prev[1] = u; }
    portals.forEach((p, i) => { const c = cost[u] + dist(here, p.at); if (c < cost[2 + i]) { cost[2 + i] = c; prev[2 + i] = u; } });
  }
  const via = [];
  for (let k = prev[1]; k > 0; k = prev[k]) via.unshift(portals[k - 2]);
  return via.length ? { cost: cost[1], via } : null;
}

/**
 * Points every `step` m along the path through the stops: { pos, at (m from the start), leg }. A stop marked `jump` is
 * reached by a hop (nothing between). `drape(pos, a, b)`, when given, may move a point between stops a and b (to the
 * ground under a straight line that rides high over a basin: audit.mjs); distances along the path stay the straight ones.
 */
export function samplePath(stops, step = 10, drape = null) {
  const out = [];
  let run = 0;
  for (let i = 0; i + 1 < stops.length; i++) {
    if (stops[i + 1].jump) continue;
    const a = stops[i].pos, b = stops[i + 1].pos, d = dist(a, b), n = Math.max(1, Math.ceil(d / step));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      const pos = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      out.push({ pos: drape ? drape(pos, stops[i], stops[i + 1]) : pos, at: +(run + d * t).toFixed(1), leg: i });
    }
    run += d;
  }
  if (!out.length && stops.length) out.push({ pos: stops[0].pos, at: 0, leg: 0 });
  return out;
}
export const pathLength = (stops) => stops.slice(1).reduce((s, p, i) => s + (p.jump ? 0 : dist(stops[i].pos, p.pos)), 0);

/**
 * The empty stretches: runs of samples with no place within r. Each gap's length in metres and seconds
 * (running); `longest` and the share of the path that is empty.
 */
export function interestGaps(samples, pois, r = 40) {
  const gaps = [];
  let start = null, last = null;
  for (const s of samples) {
    const near = pois.some((p) => dist(p.pos, s.pos) <= r);
    if (!near && start == null) start = s;
    if (near && start != null) { gaps.push(gap(start, last ?? start)); start = null; }
    last = s;
  }
  if (start != null) gaps.push(gap(start, last));
  const total = samples.length ? samples[samples.length - 1].at : 0;
  const empty = gaps.reduce((a, g) => a + g.metres, 0);
  const longest = gaps.reduce((a, g) => (g.metres > a.metres ? g : a), { metres: 0, seconds: 0, from: null, to: null });
  return { gaps: gaps.filter((g) => g.metres > 0).sort((a, b) => b.metres - a.metres), longest, emptyShare: total ? +(empty / total).toFixed(2) : 0 };
}
const gap = (a, b) => ({ from: a.pos.map(Math.round), to: b.pos.map(Math.round), at: a.at, metres: +(b.at - a.at).toFixed(1), seconds: +((b.at - a.at) / RUN).toFixed(1) });
/** How fast a world is crossed, m/s: on foot (running), or on its mount once you have it (the bike, the bird, the skiff). */
export const TRAVEL = { foot: RUN, bike: 20, bird: 18, skiff: 12 };

/**
 * Legs that come back toward somewhere already visited (the next stop within `near` m of an earlier one,
 * the leg over `long` m): the walk back. `fresh` counts the places on it not passed before (within
 * `corridor` m of the leg, and not within it of the path walked so far).
 */
export function returnLegs(stops, pois, { near = 40, long = 80, corridor = 35, drape = null } = {}) {
  const out = [];
  for (let i = 1; i + 1 < stops.length; i++) {
    const a = stops[i].pos, b = stops[i + 1].pos, d = dist(a, b);
    if (d < long || stops[i + 1].jump) continue;
    const back = stops.slice(0, i).findIndex((s) => dist(s.pos, b) < near);
    if (back < 0) continue;
    const before = samplePath(stops.slice(0, i + 1), 10, drape);
    const leg = samplePath([stops[i], stops[i + 1]], 10, drape);
    const fresh = pois.filter((p) => leg.some((s) => dist(s.pos, p.pos) < corridor) && !before.some((s) => dist(s.pos, p.pos) < corridor));
    out.push({ from: stops[i].label, to: stops[i + 1].label, metres: Math.round(d), seconds: Math.round(d / RUN), backTo: stops[back].label, fresh: fresh.length, empty: fresh.length === 0 });
  }
  return out;
}

/** Optional places over `far` m from the path and from every other place: the trip there and back, with nothing else. */
export function remote(pois, samples, { far = 150 } = {}) {
  return pois.filter((p) => p.optional).map((p) => {
    const toPath = Math.min(Infinity, ...samples.map((s) => dist(s.pos, p.pos)));
    const toOther = Math.min(Infinity, ...pois.filter((q) => q !== p).map((q) => dist(q.pos, p.pos)));
    return { name: p.names?.[0] ?? p.name, kinds: p.kinds, toPath: Math.round(toPath), toOther: Math.round(toOther) };
  }).filter((x) => x.toPath > far && x.toOther > far);
}

/** Optional places by their distance to the critical path: on it (< near), pulling at you (< pull: seen and tempting), remote. */
export function gravity(pois, samples, { near = 30, pull = 150 } = {}) {
  const opt = pois.filter((p) => p.optional);
  const d = opt.map((p) => Math.min(Infinity, ...samples.map((s) => dist(s.pos, p.pos))));
  const on = d.filter((x) => x < near).length, pulling = d.filter((x) => x >= near && x < pull).length, far = d.filter((x) => x >= pull).length;
  return { optional: opt.length, on, pulling, remote: far, pullShare: opt.length ? +(pulling / opt.length).toFixed(2) : 0 };
}

/**
 * The tall shapes in a height grid: cells standing more than `min` m over the lowest top within `win`
 * cells round them, joined into blobs; each blob's peak, its height over its surroundings and its size.
 * grid: { x0, z0, cell, nx, nz, top: Float32Array (nx*nz, -Infinity where nothing) }.
 */
export function landmarksFrom(grid, { min = 25, win = 6, keep = 30 } = {}) {
  const { nx, nz, top } = grid;
  const at = (i, j) => top[j * nx + i];
  const relief = new Float32Array(nx * nz).fill(0);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const h = at(i, j);
    if (!Number.isFinite(h)) continue;
    let lo = Infinity;
    for (let dj = -win; dj <= win; dj += 2) for (let di = -win; di <= win; di += 2) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const v = at(ii, jj);
      if (Number.isFinite(v) && v < lo) lo = v;
    }
    relief[j * nx + i] = Number.isFinite(lo) ? h - lo : 0;
  }
  const seen = new Uint8Array(nx * nz), blobs = [];
  for (let s = 0; s < nx * nz; s++) {
    if (seen[s] || relief[s] < min) continue;
    const todo = [s]; seen[s] = 1;
    let peak = s, cells = 0;
    while (todo.length) {
      const c = todo.pop(); cells++;
      if (top[c] > top[peak]) peak = c;
      const i = c % nx, j = (c - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj, n = jj * nx + ii;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || seen[n] || relief[n] < min) continue;
        seen[n] = 1; todo.push(n);
      }
    }
    const i = peak % nx, j = (peak - i) / nx;
    blobs.push({ pos: [grid.x0 + (i + 0.5) * grid.cell, top[peak], grid.z0 + (j + 0.5) * grid.cell], height: +relief[peak].toFixed(1), area: Math.round(cells * grid.cell * grid.cell) });
  }
  // the most striking first: tall, and not a whole plateau
  return blobs.sort((a, b) => b.height * Math.sqrt(Math.min(a.area, 4000)) - a.height * Math.sqrt(Math.min(b.area, 4000))).slice(0, keep).sort((a, b) => b.height - a.height);
}

/** How many landmarks each point sees (within `far` m; aimed at 80 % of each one's height). */
export function visibleCount(points, landmarks, los, { far = 900, eye = 1.7 } = {}) {
  return points.map((p) => {
    const e = [p[0], p[1] + eye, p[2]];
    return landmarks.filter((l) => flat(e, l.pos) <= far && flat(e, l.pos) > 15 && los(e, [l.pos[0], l.pos[1] - l.height * 0.2, l.pos[2]])).length;
  });
}

/** For each leg: from its start, can you see its end (2 m or 8 m over it), or a landmark within `by` m of it? */
export function legGuidance(stops, landmarks, los, { by = 80, eye = 1.7 } = {}) {
  const legs = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i].pos, b = stops[i + 1].pos, e = [a[0], a[1] + eye, a[2]];
    const d = dist(a, b);
    if (stops[i + 1].jump) continue;
    if (d < 25) { legs.push({ from: stops[i].label, to: stops[i + 1].label, metres: Math.round(d), seen: true, how: 'close' }); continue; }
    const direct = los(e, [b[0], b[1] + 2, b[2]]) || los(e, [b[0], b[1] + 8, b[2]]);   // (the place, or what stands over it: a roof, a tower)
    const mark = direct ? null : landmarks.find((l) => flat(l.pos, b) < by && los(e, [l.pos[0], l.pos[1] - l.height * 0.2, l.pos[2]]));
    legs.push({ from: stops[i].label, to: stops[i + 1].label, metres: Math.round(d), seen: direct || !!mark, how: direct ? 'goal in sight' : mark ? 'landmark by it' : 'blind' });
  }
  const long = legs.filter((l) => l.how !== 'close');
  return { legs, guidedShare: long.length ? +(long.filter((l) => l.seen).length / long.length).toFixed(2) : 1 };
}

/** Height: the places' range, how many stand raised (over `raised` m above the ground under them), and the climb along the path. */
export function vertical(pois, samples, ground = null, { raised = 8 } = {}) {
  const ys = pois.map((p) => p.pos[1]);
  const up = pois.filter((p) => ground && Number.isFinite(ground(p.pos[0], p.pos[2])) && p.pos[1] - ground(p.pos[0], p.pos[2]) > raised).length;
  let climb = 0;
  for (let i = 1; i < samples.length; i++) climb += Math.max(0, samples[i].pos[1] - samples[i - 1].pos[1]);
  const range = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  return { range: Math.round(range), raised: up, raisedShare: pois.length ? +(up / pois.length).toFixed(2) : 0, climb: Math.round(climb) };
}

/** The kinds of stop along the path (talk, go, flag, temple, ship) and the longest run of one kind. */
export function pacing(stops) {
  const kinds = stops.filter((s) => s.kind !== 'portal').map((s) => s.kind);
  let longest = { kind: null, n: 0 }, run = 0;
  for (let i = 0; i < kinds.length; i++) { run = i && kinds[i] === kinds[i - 1] ? run + 1 : 1; if (run > longest.n) longest = { kind: kinds[i], n: run }; }
  return { sequence: kinds.join(' › '), distinct: new Set(kinds).size, longest };
}

// ------------------------------------------------------------------ the rubric

/** The first [limit, score] whose limit v is under (ascending limits); else `last`. */
export const band = (v, steps, last) => { for (const [lim, s] of steps) if (v <= lim) return s; return last; };
const clamp5 = (x) => Math.max(1, Math.min(5, Math.round(x)));

/** The rubric (SKILL.md), scored from the measures: 1-5 per criterion, each with the measure it came from. */
export function scoreWorld(m) {
  const S = {};
  S.landmarks = { score: clamp5(1 + (m.landmarks.count >= 3 ? 1 : 0) + (m.landmarks.fromSpawn >= 1 ? 1 : 0) + (m.landmarks.seenShare >= 0.6 ? 1 : 0) + (m.landmarks.seenShare >= 0.9 ? 1 : 0)), from: `${m.landmarks.count} landmarks, ${m.landmarks.fromSpawn} seen from the landing, ${Math.round(m.landmarks.seenShare * 100)} % of the path sees one` };
  S.wayfinding = { score: band(m.guidance.guidedShare, [[0.2, 1], [0.4, 2], [0.6, 3], [0.8, 4]], 5), from: `${Math.round(m.guidance.guidedShare * 100)} % of the long legs see their goal or a landmark by it` };
  const speed = m.travel?.speed ?? RUN, gapS = Math.round(m.gaps.longest.metres / speed);
  S.density = { score: band(gapS, [[20, 5], [35, 4], [60, 3], [100, 2]], 1), from: `longest empty stretch ${m.gaps.longest.metres} m (${gapS} s ${m.travel?.by ?? 'running'}); ${Math.round(m.gaps.emptyShare * 100)} % of the path empty` };
  S.spacing = { score: clamp5(5 - (m.spacing.p90 > 120 ? 1 : 0) - (m.spacing.p90 > 200 ? 1 : 0) - Math.min(2, m.spacing.loners.length * 0.5) - (m.spacing.count < 12 ? 1 : 0)), from: `${m.spacing.count} places, nearest neighbour median ${m.spacing.median} m, 90th ${m.spacing.p90} m, ${m.spacing.loners.length} loners` };
  const empties = m.returns.filter((r) => r.empty);
  S.loops = { score: clamp5(5 - empties.length - Math.min(2, m.remote.length * 0.5) - (empties.some((r) => r.metres > 300) ? 1 : 0)), from: `${m.returns.length} walks back (${empties.length} with nothing new), ${m.remote.length} remote dead ends` };
  S.optional = { score: clamp5(1 + Math.min(2, m.gravity.optional / 4) + (m.gravity.pullShare >= 0.4 ? 1 : 0) + (m.gravity.remote <= m.gravity.optional * 0.3 ? 1 : 0)), from: `${m.gravity.optional} optional places: ${m.gravity.on} on the path, ${m.gravity.pulling} pulling (30-150 m), ${m.gravity.remote} remote; critical path ${m.path.metres} m` };
  S.verticality = { score: clamp5(1 + (m.vertical.range >= 30 ? 1 : 0) + (m.vertical.range >= 80 ? 1 : 0) + (m.vertical.raisedShare >= 0.15 ? 1 : 0) + (m.vertical.climb >= 60 ? 1 : 0)), from: `places span ${m.vertical.range} m of height, ${Math.round(m.vertical.raisedShare * 100)} % raised, ${m.vertical.climb} m climbed along the path` };
  S.pacing = { score: clamp5(1 + Math.min(2, (m.pacing.distinct - 1) * 0.7) + (m.pacing.longest.n <= 2 ? 1 : 0) + (m.path.metres / speed <= 600 ? 1 : 0) - (m.path.metres / speed > 1200 ? 1 : 0)), from: `${m.pacing.distinct} kinds of stop, longest run ${m.pacing.longest.n}× ${m.pacing.longest.kind}; critical path ${Math.round(m.path.metres / speed / 60)} min ${m.travel?.by ?? 'running'}` };
  S.onboarding = { score: clamp5(1 + (m.spawn.firstGoal <= 60 ? 2 : m.spawn.firstGoal <= 150 ? 1 : 0) + (m.spawn.near >= 2 ? 1 : 0) + (m.landmarks.fromSpawn >= 1 ? 1 : 0)), from: `first goal ${m.spawn.firstGoal} m from the landing, ${m.spawn.near} places within 80 m, ${m.landmarks.fromSpawn} landmarks in sight` };
  const vals = Object.values(S).map((s) => s.score);
  return { criteria: S, total: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) };
}

// ------------------------------------------------------------------ the map

/** An RGB picture as PNG bytes (8-bit, no alpha). */
export function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy ? rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3) : raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1); }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * The world from above: relief shaded from the height grid, then the path (dark line), the empty
 * stretches (red), the places (blue: on the route; green: optional), the landmarks (triangles), the
 * landing (a white ring). Returns { png, w, h, toPx } (toPx: world [x, z] to pixels, for labels).
 */
export function mapPng(grid, { path = [], gaps = [], pois = [], landmarks = [], spawn = null, px = 640 } = {}) {
  const { nx, nz, top, x0, z0, cell } = grid;
  const k = px / Math.max(nx, nz), w = Math.round(nx * k), h = Math.round(nz * k);
  const rgb = Buffer.alloc(w * h * 3);
  const finite = [...top].filter(Number.isFinite), lo = finite.length ? pct(finite, 0.02) : 0, hi = finite.length ? pct(finite, 0.98) : 1;
  const H = (i, j) => { const v = top[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]; return Number.isFinite(v) ? v : lo - 20; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = Math.floor(x / k), j = nz - 1 - Math.floor(y / k);
    const v = H(i, j), t = Math.max(0, Math.min(1, (v - lo) / Math.max(1, hi - lo)));
    const shade = Math.max(-1, Math.min(1, ((H(i - 1, j) - H(i + 1, j)) + (H(i, j + 1) - H(i, j - 1))) / (cell * 2.5)));
    const none = !Number.isFinite(top[j * nx + i]);
    const base = none ? [60, 66, 84] : [196 + 40 * t, 182 + 36 * t, 150 + 50 * t];
    const o = (y * w + x) * 3;
    for (let c = 0; c < 3; c++) rgb[o + c] = Math.max(0, Math.min(255, base[c] * (1 + 0.28 * shade)));
  }
  const toPx = (p) => [((p[0] - x0) / cell) * k, h - ((p[2] - z0) / cell) * k];
  const dot = (cx, cy, r, col) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { if (x < 0 || y < 0 || x >= w || y >= h || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue; const o = (y * w + x) * 3; rgb[o] = col[0]; rgb[o + 1] = col[1]; rgb[o + 2] = col[2]; } };
  const line = (a, b, r, col) => { const [ax, ay] = toPx(a), [bx, by] = toPx(b), n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay))); for (let s = 0; s <= n; s++) dot(ax + (bx - ax) * s / n, ay + (by - ay) * s / n, r, col); };
  for (let i = 0; i + 1 < path.length; i++) line(path[i], path[i + 1], 1.6, [43, 33, 31]);
  for (const g of gaps) line(g.from, g.to, 2.4, [209, 73, 91]);
  for (const l of landmarks) { const [cx, cy] = toPx(l.pos); for (let r = 0; r < 7; r++) for (let x = -r; x <= r; x++) dot(cx + x * 0.8, cy - 6 + r * 1.4, 0.8, [90, 60, 140]); }
  for (const p of pois) { const [cx, cy] = toPx(p.pos); dot(cx, cy, 4.2, [255, 255, 255]); dot(cx, cy, 3.2, p.optional ? [102, 161, 130] : [46, 64, 87]); }
  if (spawn) { const [cx, cy] = toPx(spawn); dot(cx, cy, 7, [255, 255, 255]); dot(cx, cy, 4.5, [43, 33, 31]); dot(cx, cy, 2.5, [255, 255, 255]); }
  return { png: encodePNG(w, h, rgb), w, h, toPx };
}
