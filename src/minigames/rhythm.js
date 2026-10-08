// The drum circle's rules (src/minigames/drums.js, docs/systems/minigames.md), pure: the song, its chart at
// each difficulty, the timing windows, the score and the combo, the clock that says what is heard now,
// and what the scheduler plays in a stretch of beats. No Web Audio and no three.js here, so the tests can
// play a whole song through (tests/minigames.test.js).
//
//   const song = drumSong('normal');        // { bpm, beats, lanes, notes: [{ beat, lane, t }], music: [...] }
//   const run = newRun(song);
//   judgePress(run, lane, t)               // a press at song time t (s): 'perfect' | 'good' | null (a stray)
//   sweepMisses(run, t)                    // the notes gone past without a press
//
// The song is the desert's (src/score.js SCORES.desert: D hijaz, oud, ney and the tanpura's drone, the
// frame drum's dum, tek and ka), at 100 beats a minute, four to a bar: a lead-in, the groove, the ney's
// tune over it, a break, the whole circle, and the last hits.

/** The lanes, by face button (their positions: A bottom, B right, X left, Y top) and the drum each plays. */
export const LANES = [
  { id: 'a', pad: 'A / ×', keys: ['ArrowDown', 'KeyS'], keyLabel: '↓', hit: 'dum', color: '#71d7cf', at: 'bottom' },
  { id: 'b', pad: 'B / ○', keys: ['ArrowRight', 'KeyD'], keyLabel: '→', hit: 'tek', color: '#d9643a', at: 'right' },
  { id: 'x', pad: 'X / □', keys: ['ArrowLeft', 'KeyA'], keyLabel: '←', hit: 'ka', color: '#6d8fc7', at: 'left' },
  { id: 'y', pad: 'Y / △', keys: ['ArrowUp', 'KeyW'], keyLabel: '↑', hit: 'clap', color: '#f2c54b', at: 'top' },
];

/** The timing windows (s either side of the note) and what each is worth. */
export const JUDGE = { perfect: 0.05, good: 0.11, late: 0.16 };   // late: a note further past than this is missed
export const POINTS = { perfect: 100, good: 40 };
/** The combo's multiplier: ×1, then one more every 10 in a row, up to ×4. */
export const multiplier = (combo) => Math.min(4, 1 + Math.floor(combo / 10));

/** The difficulties: the lanes used, the grid the notes keep to (16ths a note), the chords, the notes' flight. */
export const LEVELS = {
  easy: { lanes: 3, grid: 4, chords: false, approach: 2.1, label: 'Easy' },
  normal: { lanes: 4, grid: 2, chords: false, approach: 1.65, label: 'Normal' },
  hard: { lanes: 4, grid: 1, chords: true, approach: 1.3, label: 'Hard' },
};

export const SONG = { bpm: 100, meter: 4, root: 146.83, leadIn: 2 };   // (leadIn: beats of silence before beat 0)

// The chart is written once, at the hardest (sixteen steps a bar), and thinned for the others: each step
// a drum (D dum: A, T tek: B, K ka: X, C clap: Y; B both dum and clap) or a rest.
const BARS = {
  intro0: '................',
  intro1: 'D.......D.......',
  intro2: 'D.......D...T...',
  intro3: 'D...T...D...T.T.',
  a1: 'D...T...D.T.T...',
  a2: 'D...T.K.D..KT...',
  a3: 'D...T...D.T.T.K.',
  a4: 'D.K.T..KD.KTT.C.',
  b1: 'D...C...D.T.C...',
  b2: 'D.T.C...D...C.K.',
  b3: 'D...C.K.D.TKC...',
  b4: 'D.T.C.KTD.KTC.CC',
  br1: 'D...............',
  br2: 'C.......C...C...',
  br3: 'D.......D...D.T.',
  br4: 'D...T...KTK.C...',
  f1: 'B...T.KTD.T.C...',
  f2: 'D.TKC...D.KTC.K.',
  f3: 'B..KT.K.D.T.C.TK',
  f4: 'D.TKC.KTD.KTB.C.',
  end1: 'B...C...B...C...',
  end2: 'B...............',
};
/** The song's sections, in order: a name, the layers of the backing that play, and its bars. */
export const SECTIONS = [
  { name: 'intro', layers: ['drone', 'shaker'], bars: ['intro0', 'intro1', 'intro2', 'intro3'] },
  { name: 'groove', layers: ['drone', 'bass', 'oud', 'frame'], bars: ['a1', 'a2', 'a1', 'a3', 'a1', 'a2', 'a1', 'a4'] },
  { name: 'tune', layers: ['drone', 'bass', 'oud', 'frame', 'ney', 'shaker'], bars: ['b1', 'b2', 'b1', 'b3', 'b1', 'b2', 'b3', 'b4'] },
  { name: 'break', layers: ['drone', 'ney'], bars: ['br1', 'br2', 'br3', 'br4'] },
  { name: 'circle', layers: ['drone', 'bass', 'oud', 'frame', 'ney', 'shaker', 'bell'], bars: ['f1', 'f2', 'f1', 'f3', 'f1', 'f2', 'f3', 'f4'] },
  { name: 'end', layers: ['drone', 'bass', 'frame'], bars: ['end1', 'end2'] },
];
const CHAR_LANES = { D: [0], T: [1], K: [2], C: [3], B: [0, 3] };

/** A lane of the full chart as it is played at a difficulty (3 lanes: the ka and the clap fold onto the others). */
function laneAt(lane, L) {
  if (L.lanes >= 4) return lane;
  return lane === 3 ? 2 : lane === 2 ? 1 : lane;   // (clap → X, ka → B)
}

/** The bars of the whole song, in order: [{ section, chart, bar }] (bar from 0). */
export function songBars() {
  const out = [];
  for (const s of SECTIONS) for (const c of s.bars) out.push({ section: s, chart: BARS[c], bar: out.length });
  return out;
}

/**
 * The song at a difficulty: its notes ({ beat, lane, t: s from beat 0 }), sorted, one per lane and step, and
 * its length. The thinner levels keep the steps on their grid (a quarter, an eighth); without chords a
 * dum-and-clap is the dum alone. Easy also keeps no two notes closer than its grid.
 */
export function drumSong(level = 'normal') {
  const L = LEVELS[level] ?? LEVELS.normal, spb = 60 / SONG.bpm, bars = songBars();
  const notes = [];
  for (const { chart, bar } of bars) {
    for (let step = 0; step < 16; step++) {
      const ch = chart[step];
      if (ch === '.' || step % L.grid) continue;
      let lanes = CHAR_LANES[ch] ?? [];
      if (!L.chords) lanes = lanes.slice(0, 1);
      const beat = bar * SONG.meter + step / 4;
      for (const ln of new Set(lanes.map((q) => laneAt(q, L)))) notes.push({ beat, lane: ln, t: beat * spb, i: 0 });
    }
  }
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  notes.forEach((n, i) => { n.i = i; });
  const beats = bars.length * SONG.meter;
  return { level, L, bpm: SONG.bpm, spb, beats, length: beats * spb, lanes: L.lanes, approach: L.approach, notes, bars };
}

// ------------------------------------------------------------------ the backing: what the circle plays
// Degrees of the hijaz scale (0 D, 1 E♭, 2 F♯, 3 G, 4 A, 5 B♭, 6 C) over the progression, a chord a bar.
const PROG = [0, 0, 3, 0, 0, 1, 3, 0];
// the oud's riff (a bar: [step, degree]), and the ney's tune over the tune and the circle (2 bars each: [beat, degree, beats])
const RIFF = [[0, 0], [3, 1], [6, 2], [8, 4], [10, 2], [12, 1], [14, 0]];
const NEY = [
  [[0, 4, 1.5], [1.5, 5, 0.5], [2, 4, 1], [3, 2, 1], [4, 1, 2], [6, 2, 1], [7, 0, 1]],
  [[0, 0, 1], [1, 1, 1], [2, 2, 1.5], [3.5, 4, 0.5], [4, 5, 1.5], [5.5, 4, 0.5], [6, 2, 2]],
  [[0, 4, 1], [1, 6, 1], [2, 7, 2], [4, 6, 1], [5, 5, 1], [6, 4, 2]],
  [[0, 2, 1], [1, 1, 1], [2, 2, 1], [3, 4, 1], [4, 1, 1.5], [5.5, 1, 0.5], [6, 0, 2]],
];
// the circle's own frame drums under the player's: a steady dum-tek, the villagers' (16 steps)
const FRAME = 'd..t..t.d..t.tt.';

/**
 * Every backing event of a bar: { beat (from beat 0), kind: 'hit' | 'note' | 'held', voice, degree, octave,
 * beats, vol, layer }. The scheduler plays them; the villagers move to the frame drum's.
 */
export function barEvents(barIndex, bars = songBars()) {
  const b = bars[barIndex];
  if (!b) return [];
  const on = new Set(b.section.layers), out = [], b0 = barIndex * SONG.meter, chord = PROG[barIndex % PROG.length];
  const secStart = bars.findIndex((q) => q.section === b.section), inSec = barIndex - secStart;
  if (on.has('drone') && inSec % 2 === 0) out.push({ beat: b0, kind: 'held', voice: 'tanpura', degree: 0, octave: -1, beats: 8, vol: 0.05, layer: 'drone' });
  if (on.has('drone') && inSec % 2 === 0) out.push({ beat: b0, kind: 'held', voice: 'tanpura', degree: 4, octave: -1, beats: 8, vol: 0.03, layer: 'drone' });
  if (on.has('bass')) for (const s of [0, 6, 8]) out.push({ beat: b0 + s / 4, kind: 'note', voice: 'sine', degree: s === 6 ? chord + 4 : chord, octave: -1, beats: 1.2, vol: 0.09, layer: 'bass' });
  if (on.has('oud')) for (const [s, d] of RIFF) out.push({ beat: b0 + s / 4, kind: 'note', voice: 'oud', degree: d + chord, octave: 0, beats: 0.5, vol: s === 0 ? 0.07 : 0.05, layer: 'oud' });
  if (on.has('ney')) {
    const phrase = NEY[Math.floor(inSec / 2) % NEY.length], half = inSec % 2;
    for (const [bt, d, len] of phrase) if (Math.floor(bt / 4) === half) out.push({ beat: b0 + (bt % 4), kind: 'note', voice: 'ney', degree: d, octave: 1, beats: len, vol: 0.075, layer: 'ney' });
  }
  if (on.has('frame')) for (let s = 0; s < 16; s++) { const c = FRAME[s]; if (c !== '.') out.push({ beat: b0 + s / 4, kind: 'hit', voice: c === 'd' ? 'darbuka' : 'knock', vol: c === 'd' ? 0.09 : 0.05, layer: 'frame' }); }
  if (on.has('shaker')) for (let s = 0; s < 16; s += 2) out.push({ beat: b0 + s / 4, kind: 'hit', voice: 'shaker', vol: s % 4 ? 0.05 : 0.035, layer: 'shaker' });
  if (on.has('bell') && inSec % 4 === 0) out.push({ beat: b0, kind: 'note', voice: 'handbell', degree: 4, octave: 1, beats: 2, vol: 0.05, layer: 'bell' });
  return out;
}

/** The backing events with b0 <= beat < b1 (the scheduler's look-ahead), in order. */
export function eventsBetween(b0, b1, bars = songBars()) {
  const out = [], last = bars.length;
  for (let bar = Math.max(0, Math.floor(b0 / SONG.meter)); bar <= Math.min(last - 1, Math.floor((b1 - 1e-9) / SONG.meter)); bar++) {
    for (const e of barEvents(bar, bars)) if (e.beat >= b0 - 1e-9 && e.beat < b1 - 1e-9) out.push(e);
  }
  return out.sort((a, b) => a.beat - b.beat);
}

/** The frame drum's hits in a bar of the circle's (for the villagers' hands): 16 steps, d / t / '.'. */
export const FRAME_PATTERN = FRAME;

// ------------------------------------------------------------------ the clock: what is heard now
/**
 * The song's time (s from beat 0) heard at a moment of the page's clock (performance.now(), ms), from the
 * audio clock: the output timestamp says which context time leaves the speaker at which page time
 * ({ contextTime, performanceTime }); t0 is the context time beat 0 was scheduled at.
 * Without an output timestamp (an old WebView), the context's time less its output latency.
 */
export function heardSongTime(perfMs, { t0, stamp = null, currentTime = 0, latency = 0, perfNow = perfMs }) {
  if (stamp && stamp.performanceTime > 0) return stamp.contextTime + (perfMs - stamp.performanceTime) / 1000 - t0;
  return currentTime - latency + (perfMs - perfNow) / 1000 - t0;
}

// ------------------------------------------------------------------ a run: the presses judged
export function newRun(song) {
  return { song, next: 0, judged: new Array(song.notes.length).fill(null), score: 0, combo: 0, best: 0, counts: { perfect: 0, good: 0, miss: 0, stray: 0 }, errs: [], last: null };
}

/** The verdict of a press error (s, signed: + late), or null outside the windows. */
export function grade(err, J = JUDGE) {
  const a = Math.abs(err);
  return a <= J.perfect ? 'perfect' : a <= J.good ? 'good' : null;
}

/**
 * A press on a lane at song time t (s, with the timing offset already taken off): the nearest note of that
 * lane not judged yet, if it is within the windows, is hit (perfect or good); else the press is a stray
 * (it breaks nothing: the drum just sounds). Returns { kind, note, err } (kind 'stray': no note).
 */
export function judgePress(run, lane, t, J = JUDGE) {
  const N = run.song.notes;
  let best = null, bestErr = Infinity;
  for (let i = run.next; i < N.length; i++) {
    const n = N[i];
    if (n.t - t > J.good) break;
    if (n.lane !== lane || run.judged[i]) continue;
    const err = t - n.t;
    if (Math.abs(err) < Math.abs(bestErr)) { best = n; bestErr = err; }
  }
  const kind = best ? grade(bestErr, J) : null;
  if (!kind) { run.counts.stray++; return (run.last = { kind: 'stray', note: null, err: 0, lane }); }
  run.judged[best.i] = kind;
  run.counts[kind]++;
  run.combo++;
  run.best = Math.max(run.best, run.combo);
  run.score += POINTS[kind] * multiplier(run.combo - 1);
  run.errs.push(bestErr);
  advance(run);
  return (run.last = { kind, note: best, err: bestErr, lane });
}

/** The notes gone more than the late window past t unpressed: missed (the combo broken). Returns them. */
export function sweepMisses(run, t, J = JUDGE) {
  const N = run.song.notes, out = [];
  for (let i = run.next; i < N.length; i++) {
    const n = N[i];
    if (n.t + J.late >= t) break;
    if (!run.judged[i]) { run.judged[i] = 'miss'; run.counts.miss++; run.combo = 0; out.push(n); }
  }
  advance(run);
  return out;
}
function advance(run) { while (run.next < run.judged.length && run.judged[run.next]) run.next++; }

/** Is the song over (every note judged)? */
export const runDone = (run) => run.next >= run.song.notes.length;

/** The share of the notes hit, weighted (a perfect 1, a good 0.5): 0..1. */
export function accuracy(run) {
  const n = run.song.notes.length;
  return n ? (run.counts.perfect + run.counts.good * 0.5) / n : 0;
}

/** The mark for a run: S over 95 %, A over 85, B over 70, C over 50, else D. */
export function rank(acc) { return acc >= 0.95 ? 'S' : acc >= 0.85 ? 'A' : acc >= 0.7 ? 'B' : acc >= 0.5 ? 'C' : 'D'; }

/**
 * How early or late the hits were on average (ms, + late), and the timing offset that would centre them
 * (the current offset plus that, to the stepper's 10 ms): null with too few hits to say.
 */
export function timingAdvice(run, offsetMs = 0, { min = 12, step = 10 } = {}) {
  if (run.errs.length < min) return null;
  const sorted = [...run.errs].sort((a, b) => a - b), mid = sorted[Math.floor(sorted.length / 2)];   // (the median: a few wild presses don't move it)
  const ms = Math.round(mid * 1000);
  return { ms, suggest: Math.round((offsetMs + ms) / step) * step };
}

/** How hard the circle dances (0..1) for a combo: it warms up over the first 40 in a row. */
export const fervour = (combo) => Math.min(1, combo / 40) ** 0.8;
