// Scores and the best of each game, kept in the save (src/game-state.js flags, per save slot):
//   minigame.<id>.best    the best score (a time in seconds: lower is better; points: higher)
//   minigame.<id>.plays   how many runs were finished
// Pure: the state is anything with flag(name) and set(name, value) (the game's `game`, a test's fake).

export const bestKey = (id) => `minigame.${id}.best`;
export const playsKey = (id) => `minigame.${id}.plays`;

/** A time trial: the lower the better. Points: the higher. */
export const lowerIsBetter = (score) => (score?.kind ?? 'points') === 'time';

/** Is a better than b? (anything beats no score; no score beats nothing) */
export function better(score, a, b) {
  if (!Number.isFinite(a)) return false;
  if (!Number.isFinite(b)) return true;
  return lowerIsBetter(score) ? a < b : a > b;
}

/** 83.456 → '1:23.45' (minutes, seconds, hundredths); under a minute '23.45'. */
export function formatTime(s) {
  if (!Number.isFinite(s)) return '—';
  const cs = Math.max(0, Math.floor(s * 100 + 1e-6));
  const m = Math.floor(cs / 6000), sec = Math.floor(cs / 100) % 60, hun = cs % 100;
  const tail = `${String(sec).padStart(m ? 2 : 1, '0')}.${String(hun).padStart(2, '0')}`;
  return m ? `${m}:${tail}` : tail;
}

/** A score as the game shows it: its own format, a time, or points with their unit. */
export function formatScore(def, v) {
  if (!Number.isFinite(v)) return '—';
  const S = def?.score ?? {};
  if (S.format) return S.format(v);
  if (S.kind === 'time') return formatTime(v);
  const n = Math.round(v);
  return S.unit ? `${n} ${S.unit}` : String(n);
}

/** The best score kept for a game, or null. */
export function bestScore(state, def) {
  const v = state?.flag?.(bestKey(def.id));
  return Number.isFinite(v) ? v : null;
}

/** A score worth keeping as a best: a time, or points above nothing (a run that scored 0 keeps no best). */
export const keepable = (v) => Number.isFinite(v) && v > 0;

/**
 * A finished run: counted, and kept if it beats the best (a run of 0 points is counted, never kept).
 * `isNew` (the results' "New best!" stamp) is a real improvement over a best kept before; the first
 * score kept is `first` (no stamp: there was nothing to beat).
 * @returns {{ best: number|null, previous: number|null, isNew: boolean, first: boolean, plays: number }}
 */
export function recordScore(state, def, value) {
  const previous = bestScore(state, def);
  const keep = keepable(value) && better(def.score, value, previous ?? NaN);
  if (keep) state.set(bestKey(def.id), value);
  const plays = (Number(state.flag(playsKey(def.id))) || 0) + 1;
  state.set(playsKey(def.id), plays);
  return { best: keep ? value : previous, previous, isNew: keep && previous !== null, first: keep && previous === null, plays };
}
