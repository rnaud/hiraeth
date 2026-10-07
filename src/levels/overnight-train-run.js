// ---------------------------------------------------------------------------
// The Overnight Train's run (src/levels/overnight-train.js): the train stands still in the world's frame and the
// plain runs past it, so walking, the crowd and the collision stay the game's own inside the carriages and on the
// roofs. This is how far the land has gone by (s, m) and how fast (v, m/s) at a time t (s): a cycle of a halt at a
// lonely station, the train pulling out, a long run at speed across the plain, then braking into the next station.
// Pure: the world, its sound and the tests read the same numbers.
// ---------------------------------------------------------------------------

/** The run's measures: full speed (m/s), how long it brakes, waits, pulls out and runs (s). */
export const RUN = { V: 28, brake: 34, halt: 42, accel: 46, cruise: 150 };
const D_ACCEL = (RUN.V * RUN.accel) / 2, D_CRUISE = RUN.V * RUN.cruise, D_BRAKE = (RUN.V * RUN.brake) / 2;
/** One cycle: how long (s) and how far (m), from one station to the next. */
export const CYCLE = { T: RUN.halt + RUN.accel + RUN.cruise + RUN.brake, D: D_ACCEL + D_CRUISE + D_BRAKE };

/**
 * Where the run stands at t (s; t = 0 the moment the train halts at a station): { s (m gone by since the first
 * station), v (m/s), phase ('halt' | 'leaving' | 'running' | 'braking'), k (the station it last stopped at, or is
 * stopped at), until (s left in this phase) }.
 */
export function runAt(t) {
  const k = Math.floor(t / CYCLE.T), u = t - k * CYCLE.T, s0 = k * CYCLE.D;
  if (u < RUN.halt) return { s: s0, v: 0, phase: 'halt', k, until: RUN.halt - u };
  let w = u - RUN.halt;
  if (w < RUN.accel) { const a = RUN.V / RUN.accel; return { s: s0 + 0.5 * a * w * w, v: a * w, phase: 'leaving', k, until: RUN.accel - w }; }
  w -= RUN.accel;
  if (w < RUN.cruise) return { s: s0 + D_ACCEL + RUN.V * w, v: RUN.V, phase: 'running', k, until: RUN.cruise - w };
  w -= RUN.cruise;
  const b = RUN.V / RUN.brake;
  return { s: s0 + D_ACCEL + D_CRUISE + RUN.V * w - 0.5 * b * w * w, v: RUN.V - b * w, phase: 'braking', k, until: RUN.brake - w };
}

/** How far ahead (+) or behind (-) the nearest station stands from where it stood at its halt (m), at s. */
export function stationOffset(s) {
  const k = Math.round(s / CYCLE.D);
  return k * CYCLE.D - s;
}

/** A band of scenery repeating every P m: its shift (m, ≤ 0) when s m have gone by (it runs toward -x). */
export const bandShift = (s, P) => -(((s % P) + P) % P);
