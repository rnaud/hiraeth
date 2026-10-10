// ---------------------------------------------------------------------------
// The Overnight Train's run (src/levels/overnight-train.js): the train stands still in the world's frame and the
// plain runs past it, so walking, the crowd and the collision stay the game's own inside the carriages and on the
// roofs. This is how far the land has gone by (s, m) and how fast (v, m/s) at a time t (s).
//
// The train runs: it doesn't wait at stations. A plan (planRun) is a list of legs: pulling out of a halt, running at
// speed for as long as nobody asks it to stop, braking into a halt when someone does (the conductor, asked: the night
// mail's quest, src/story/night-train.js), a halt there, and out again. runAt(t) is the old fixed cycle (a halt, out,
// a run, braking into the next), kept for the References' views. Pure: the world, its sound and the tests read the
// same numbers.
// ---------------------------------------------------------------------------

/** The run's measures: full speed (m/s), how long it brakes, waits, pulls out and runs (s). */
export const RUN = { V: 28, brake: 34, halt: 42, accel: 46, cruise: 150 };
const D_ACCEL = (RUN.V * RUN.accel) / 2, D_CRUISE = RUN.V * RUN.cruise, D_BRAKE = (RUN.V * RUN.brake) / 2;
/** One cycle: how long (s) and how far (m), from one station to the next. */
export const CYCLE = { T: RUN.halt + RUN.accel + RUN.cruise + RUN.brake, D: D_ACCEL + D_CRUISE + D_BRAKE };
/** How far the train goes braking from full speed to a halt (m). */
export const BRAKE_D = D_BRAKE;

/**
 * Where the old cycle stands at t (s; t = 0 the moment the train halts at a station): { s (m gone by since the first
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

// ------------------------------------------------------------------ the plan: running until asked to stop

/** A leg's distance and speed at w s into it. */
function legAt(leg, w) {
  const d = Math.min(w, leg.dur);
  if (leg.phase === 'running') return { s: RUN.V * d, v: RUN.V };
  if (leg.phase === 'halt') return { s: 0, v: 0 };
  if (leg.phase === 'leaving') { const a = RUN.V / RUN.accel; return { s: 0.5 * a * d * d, v: a * d }; }
  const b = RUN.V / RUN.brake;   // braking
  return { s: RUN.V * d - 0.5 * b * d * d, v: RUN.V - b * d };
}

/**
 * A run's plan. `from`: 'running' (at speed from t = 0: the train you wake up on) or 'leaving' (pulling out of the halt
 * you just boarded at). Then, until stop() is asked, it runs on for good.
 *   plan.at(t)          → { s, v, phase, until, halts } (halts: how many halts it has come to)
 *   plan.stop(t, lead)  brake into a halt starting `lead` s after t (if it is running then; else after it is up to
 *                       speed again); returns the time it will have halted, or null if a stop is already planned
 *   plan.haltS()        the distance s at the halt planned or under way (null if none): where the station stands
 */
export function planRun(from = 'running') {
  const legs = from === 'leaving' ? [{ phase: 'leaving', t0: 0, dur: RUN.accel }, { phase: 'running', t0: RUN.accel, dur: Infinity }] : [{ phase: 'running', t0: 0, dur: Infinity }];
  let halts = 0;
  const sAt = (i) => { let s = 0; for (let j = 0; j < i; j++) s += legAt(legs[j], legs[j].dur).s; return s; };
  return {
    legs,
    at(t) {
      let i = legs.findIndex((l) => t < l.t0 + l.dur);
      if (i < 0) i = legs.length - 1;
      const L = legs[i], w = Math.max(0, t - L.t0), x = legAt(L, w);
      const done = legs.slice(0, i + 1).filter((l) => l.phase === 'halt' && t >= l.t0).length;
      return { s: sAt(i) + x.s, v: x.v, phase: L.phase, until: L.t0 + L.dur - t, halts: done };
    },
    stop(t, lead = 0) {
      if (legs.some((l) => l.phase === 'braking' && l.t0 + l.dur + RUN.halt > t)) return null;   // (one at a time)
      const last = legs.at(-1);   // the open-ended run
      const tb = Math.max(t + lead, last.t0);
      last.dur = tb - last.t0;
      legs.push({ phase: 'braking', t0: tb, dur: RUN.brake }, { phase: 'halt', t0: tb + RUN.brake, dur: RUN.halt },
        { phase: 'leaving', t0: tb + RUN.brake + RUN.halt, dur: RUN.accel }, { phase: 'running', t0: tb + RUN.brake + RUN.halt + RUN.accel, dur: Infinity });
      halts++;
      return tb + RUN.brake;
    },
    haltS() {
      const i = legs.findLastIndex((l) => l.phase === 'halt');
      return i < 0 ? null : sAt(i);
    },
    /** The time the planned (or last) halt begins, and ends: { t0, t1 } or null. */
    halt() { const l = legs.findLast((x) => x.phase === 'halt'); return l ? { t0: l.t0, t1: l.t0 + l.dur } : null; },
    get halts() { return halts; },
  };
}
