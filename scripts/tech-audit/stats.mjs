// The technical audit's frame statistics (scripts/tech-audit/play.mjs; tests/tech-audit-stats.test.js).
// frames: [{ ms, link, wait, phase }] in order. Per phase and for all:
//   fps_mean   frames / seconds (what a counter shows)
//   median, p95, p99, worst   frame interval, ms
//   low1_fps, low01_fps       the "1% low" and "0.1% low": 1000 / the mean of the slowest 1% (0.1%) of frames
//   over33, over50            frames longer than 33.3 and 50 ms (a dropped frame or two at 60 Hz)
//   stutters   frames over STUTTER.abs ms and over STUTTER.k × the median of the STUTTER.win frames round them (a
//              hitch against its neighbours, which a steady slow scene is not)
//   links      programs linked (a shader compile mid-play), waitMs the ms spent asking the GPU process about programs

export const STUTTER = { k: 2, abs: 20, win: 15 };

const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
export function pct(a, p) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; }
export function low(a, share) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => y - x), n = Math.max(1, Math.floor(a.length * share));
  return 1000 / (s.slice(0, n).reduce((t, x) => t + x, 0) / n);
}
/** Indices of frames that stand out from their neighbours. */
export function stutters(ms, { k = STUTTER.k, abs = STUTTER.abs, win = STUTTER.win } = {}) {
  const out = [], h = Math.floor(win / 2);
  for (let i = 0; i < ms.length; i++) {
    if (ms[i] <= abs) continue;
    const near = [...ms.slice(Math.max(0, i - h), i), ...ms.slice(i + 1, i + 1 + h)];
    const med = pct(near, 0.5) ?? 0;
    if (ms[i] > k * med) out.push(i);
  }
  return out;
}
export function stats(frames) {
  const ms = frames.map((f) => f.ms), total = ms.reduce((t, x) => t + x, 0);
  return {
    frames: ms.length, fps_mean: r1(total ? (ms.length * 1000) / total : null), median: r1(pct(ms, 0.5)), p95: r1(pct(ms, 0.95)), p99: r1(pct(ms, 0.99)),
    worst: r1(ms.length ? Math.max(...ms) : null), low1_fps: r1(low(ms, 0.01)), low01_fps: r1(low(ms, 0.001)),
    over33: ms.filter((x) => x > 33.4).length, over50: ms.filter((x) => x > 50).length, stutters: stutters(ms).length,
    links: frames.reduce((t, f) => t + (f.link ?? 0), 0), waitMs: r1(frames.reduce((t, f) => t + (f.wait ?? 0), 0)),
  };
}
/** Phases left out of the whole run's numbers: the menus (the game paused, its frames the page's), before the first, and
 *  play.mjs --sweep's held headings (yaw…). */
export const NOT_PLAY = ['menu', 'none', ''];
const notPlay = (p = '') => NOT_PLAY.includes(p) || p.startsWith('yaw');
export function summarize(frames) {
  const phases = {};
  for (const f of frames) (phases[f.phase || 'none'] ??= []).push(f);
  return { all: stats(frames.filter((f) => !notPlay(f.phase ?? ''))), phases: Object.fromEntries(Object.entries(phases).map(([p, fs]) => [p, stats(fs)])) };
}

/**
 * What ran between `from` and `to` (ms from the recording's start) in a V8 CPU profile started at `prof0` (the same
 * clock): the functions by their own time, the biggest first ([name url:line, ms]). Approximate to a sample or two.
 */
export function blame(profile, prof0, from, to, n = 6) {
  const byId = new Map(profile.nodes.map((x) => [x.id, x]));
  const own = new Map();
  let t = 0;
  for (let k = 0; k < profile.samples.length; k++) {
    t += profile.timeDeltas[k] / 1000;
    const at = prof0 + t, dt = (profile.timeDeltas[k + 1] ?? 0) / 1000;
    if (at < from || at > to) continue;
    const cf = byId.get(profile.samples[k])?.callFrame;
    if (!cf) continue;
    const key = `${cf.functionName || '(anonymous)'} ${(cf.url || '').split('/').pop()}:${cf.lineNumber + 1}`;
    own.set(key, (own.get(key) ?? 0) + dt);
  }
  return [...own].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, +v.toFixed(1)]);
}
