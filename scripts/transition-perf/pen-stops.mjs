// The loading pen's stops, from its angle in each frame of a recording (docs/systems/performance.md, "The
// loading pen"): pen.mjs reads the angles from a headless Chrome screencast, pen-android.mjs from a screen
// recording of the handheld (pen-read.swift). A smooth pen turns 150° a second, a little every refresh; a
// stop is the time between two frames where it had turned (17 ms when it turns every refresh at 60 Hz),
// whether frames came in between with the pen still or none came at all (a screen recording only gets a
// frame when the screen changes).

/** Angle difference b − a in degrees, folded into −180…180. */
export const turn = (a, b) => ((b - a) % 360 + 540) % 360 - 180;

/**
 * @param rows [{ t ms, a degrees | null }] in time order (null: no pen in that frame)
 * @return { spanS, frames, degPerS, stopP50, stopP95, stopMax, over50, over100, over250, stoppedS, long: [ms…] }
 */
export function penStops(rows, { moved = 1 } = {}) {
  const r = rows.filter((x) => x.a !== null && Number.isFinite(x.a));
  const stops = [];
  let last = r[0]?.t, turned = 0;
  for (let i = 1; i < r.length; i++) {
    const da = turn(r[i - 1].a, r[i].a);
    if (Math.abs(da) >= moved) { stops.push(r[i].t - last); last = r[i].t; turned += Math.abs(da); }
  }
  const q = (p) => { const s = [...stops].sort((x, y) => x - y); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))]) : null; };
  const span = r.length > 1 ? r[r.length - 1].t - r[0].t : 0;
  const long = stops.filter((s) => s > 100);
  return {
    spanS: +(span / 1000).toFixed(1), frames: r.length, degPerS: span ? Math.round(turned / (span / 1000)) : null,
    stopP50: q(0.5), stopP95: q(0.95), stopMax: q(1), over50: stops.filter((s) => s > 50).length, over100: long.length,
    over250: stops.filter((s) => s > 250).length, stoppedS: +(long.reduce((a, b) => a + b, 0) / 1000).toFixed(2), long: long.map(Math.round),
  };
}
