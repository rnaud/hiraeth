// The sound QC's judgement (.claude/skills/sound-qc/SKILL.md), pure: rendered PCM (interleaved stereo, the game's own
// Sound on engine/webaudio.js) and the traces of a driven run in, the measures and the verdicts out. No game code here:
// tests/sound-qc.test.js feeds it made-up sounds.
//
//   measure(pcm, rate, { floor })   → { peak, rms, onset, dur, centroid } of one sound (dB full scale, ms, Hz)
//   variation(takes)                → { level, centroid, dur } spreads over repeats (dB, %, %)
//   judge(m, role, ref, o)          → { verdict, why[] } against ROLES and LIMITS, the mix's reference (the music)

/** The roles a sound plays and the band its loudest 50 ms sits in, dB against the music's loudest 50 ms (the reference). */
export const ROLES = {
  impact: { lo: -12, hi: 5, what: 'a hit landing, a block, a hurt, a fall: the loudest of the body' },
  action: { lo: -18, hi: 2, what: 'a swing, a jump, a roll, the shield, a shot: every press answered' },
  foley: { lo: -26, hi: -8, what: 'footsteps, a grab, cloth: under everything, never gone' },
  ui: { lo: -24, hi: -6, what: 'the menus\' moves, confirms and backs: short, quiet, one family' },
  cue: { lo: -14, hi: 4, what: 'a reward or a step done: a key, a quest, a chest' },
  warn: { lo: -26, hi: -6, what: 'a warning that repeats (the low-health heartbeat): felt, not tiring' },
};

/** The limits (why each: the skill's "Thresholds", docs/systems/audio.md "Sound QC"). */
export const LIMITS = {
  win: 0.05,          // s: the window the level is read over (the loudest 50 ms)
  heard: -60,         // dBFS: a window over this is sound (the render's own noise floor is far under)
  tail: 30,           // dB: its length runs to the last window within this of its loudest (a tail further down is not heard over the world)
  onset: 0.03,        // s: from the call to its first sound (a sound in the same frame as the press)
  press: 0.1,         // s: from the press (the action's input) to its first sound, in the game (Sony's / Nintendo's ~100 ms)
  durMax: { impact: 1.5, action: 1.2, foley: 0.8, ui: 0.6, cue: 4, warn: 0.8 },   // s: past this it hangs over the next one
  durMin: 0.03,       // s: under this it is a click
  levelSpread: 1,     // dB: over repeats, at least this between the quietest and the loudest take,
  centroidSpread: 2,  // %: or the brightness (spectral centroid) this far apart: else it machine-guns
  repeats: 6,         // takes of each sound for its variation
  truePeak: -1,       // dBFS: no sample over (the master's compressor and the limits of a phone's speaker)
};

export const dB = (x) => 20 * Math.log10(Math.max(x, 1e-9));

/**
 * The K-weighting of ITU-R BS.1770 (the curve LUFS is measured through: a high shelf of +4 dB over ~1.5 kHz and a
 * high-pass under ~60 Hz, its coefficients at 48 kHz) on interleaved stereo: a low thump counts for less than its
 * RMS, as an ear (and a loudness meter) hears it.
 */
export function kWeight(pcm) {
  const out = new Float32Array(pcm.length);
  const S = [[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]];
  const H = [[1, -2, 1], [1, -1.99004745483398, 0.99007225036621]];
  for (let c = 0; c < 2; c++) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, z1 = 0, z2 = 0;
    for (let i = c; i < pcm.length; i += 2) {
      const x = pcm[i];
      const y = S[0][0] * x + S[0][1] * x1 + S[0][2] * x2 - S[1][1] * y1 - S[1][2] * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      const z = H[0][0] * y + H[0][1] * u1 + H[0][2] * u2 - H[1][1] * z1 - H[1][2] * z2;
      u2 = u1; u1 = y; z2 = z1; z1 = z;
      out[i] = z;
    }
  }
  return out;
}

/** The RMS of each `win`-second window of interleaved stereo `pcm` (both channels). */
export function envelope(pcm, rate, win = LIMITS.win) {
  const n = Math.max(1, Math.round(win * rate)), out = [];
  for (let i = 0; i + 1 < pcm.length; i += n * 2) {
    let s = 0, c = 0;
    for (let j = i; j < Math.min(pcm.length, i + n * 2); j++) { s += pcm[j] * pcm[j]; c++; }
    out.push(Math.sqrt(s / Math.max(1, c)));
  }
  return out;
}

/** The spectral centroid (Hz) of the mono mix of `pcm` round its loudest window: a 2048-point DFT, Hann-windowed. */
export function centroid(pcm, rate, at = 0) {
  const N = 2048, re = new Float64Array(N), im = new Float64Array(N);
  const start = Math.max(0, Math.min(at, Math.floor(pcm.length / 2) - N));
  for (let i = 0; i < N; i++) {
    const j = (start + i) * 2, x = j + 1 < pcm.length ? (pcm[j] + pcm[j + 1]) / 2 : 0;
    re[i] = x * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k], im[k]); num += m * (k * rate) / N; den += m; }
  return den > 0 ? num / den : 0;
}

/** In-place radix-2 FFT (N a power of two). */
export function fft(re, im) {
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) {
    let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/**
 * One sound, rendered from the moment it was asked for: its loudest 50 ms (`rms`, dBFS), its highest sample (`peak`),
 * when it starts (`onset`, s: the first window over `floor`) and how long it lasts (`dur`, s: to the last window within
 * LIMITS.tail dB of its loudest and over the floor), its brightness (`centroid`, Hz). Levels K-weighted (kWeight).
 * `bed`: the same render without the sound (the wind, the hum), subtracted in power. null when nothing is heard.
 */
export function measure(pcm, rate, { bed = null, floor = LIMITS.heard } = {}) {
  let env = envelope(kWeight(pcm), rate);
  if (bed) { const b = envelope(kWeight(bed), rate); env = env.map((x, i) => Math.sqrt(Math.max(0, x * x - (b[i] ?? 0) ** 2))); }
  const lv = env.map(dB), top = Math.max(...lv);
  if (!(top > floor)) return null;
  const first = lv.findIndex((x) => x > floor);
  let last = first;
  for (let i = first; i < lv.length; i++) if (lv[i] > Math.max(floor, top - LIMITS.tail)) last = i;
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const loudest = lv.indexOf(top), n = Math.round(LIMITS.win * rate);
  // (the onset within its window: the first sample over a tenth of the window's own RMS, so a sound is not 50 ms late by rounding)
  let onset = first * LIMITS.win;
  const lim = env[first] * 0.1;
  for (let i = first * n; i < (first + 1) * n && i * 2 < pcm.length; i++) { if (Math.abs(pcm[i * 2]) > lim || Math.abs(pcm[i * 2 + 1]) > lim) { onset = i / rate; break; } }
  return { rms: +top.toFixed(1), peak: +dB(peak).toFixed(1), onset: +onset.toFixed(3), dur: +((last + 1) * LIMITS.win - onset).toFixed(3), centroid: Math.round(centroid(pcm, rate, loudest * n)) };
}

/** How much repeats of one sound differ: the spread of their levels (dB), brightness and length (% of the mean). */
export function variation(takes) {
  const ok = takes.filter(Boolean);
  if (ok.length < 2) return null;
  const spread = (k) => { const v = ok.map((m) => m[k]); return Math.max(...v) - Math.min(...v); };
  const mean = (k) => ok.reduce((a, m) => a + m[k], 0) / ok.length;
  return { level: +spread('rms').toFixed(2), centroid: +((spread('centroid') / Math.max(1, mean('centroid'))) * 100).toFixed(1), dur: +((spread('dur') / Math.max(1e-3, mean('dur'))) * 100).toFixed(1) };
}

/**
 * The verdict on one action: 'missing' (no sound, or never asked for in the game), 'too quiet' / 'too loud' (out of
 * its role's band against the reference), 'too late' (onset after the call, or the press → sound in the game),
 * 'too long', 'repetitive' (repeats too alike), else 'OK'. Several faults: the first in that order, all in `why`.
 * m: measure() of the first take; v: variation(); o.press: s from the input to the first sound in the game (null: not driven).
 */
export function judge(m, role, ref, { v = null, press = null, wired = true, repeats = true } = {}) {
  const R = ROLES[role] ?? ROLES.action, why = [];
  if (!wired) return { verdict: 'missing', why: ['nothing in the game asks for a sound'] };
  if (!m) return { verdict: 'missing', why: ['silent when asked'] };
  const rel = m.rms - ref;
  if (rel < R.lo) why.push(['too quiet', `${rel.toFixed(1)} dB against the music (band ${R.lo}..${R.hi})`]);
  if (rel > R.hi) why.push(['too loud', `+${rel.toFixed(1)} dB against the music (band ${R.lo}..${R.hi})`]);
  if (m.peak > LIMITS.truePeak) why.push(['too loud', `a sample at ${m.peak} dBFS`]);
  if (m.onset > LIMITS.onset) why.push(['too late', `starts ${(m.onset * 1000).toFixed(0)} ms after it is asked for`]);
  if (press != null && press > LIMITS.press) why.push(['too late', `first heard ${(press * 1000).toFixed(0)} ms after the press`]);
  if (m.dur > (LIMITS.durMax[role] ?? 1.5)) why.push(['too long', `${m.dur.toFixed(2)} s`]);
  if (m.dur < LIMITS.durMin) why.push(['too short', `${(m.dur * 1000).toFixed(0)} ms: a click`]);
  if (repeats && v && v.level < LIMITS.levelSpread && v.centroid < LIMITS.centroidSpread) why.push(['repetitive', `repeats within ${v.level} dB and ${v.centroid} % brightness`]);
  const order = ['too quiet', 'too loud', 'too late', 'too long', 'too short', 'repetitive'];
  why.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  return { verdict: why[0]?.[0] ?? 'OK', why: why.map(([k, s]) => `${k}: ${s}`) };
}
