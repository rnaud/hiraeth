// The voice reference for the Unity port (issue #333): lines planned by src/story/voice.js and sung by the web
// game's renderer (src/voice-synth.js on the engine's Web Audio, engine/webaudio.js), with what the Unity port's
// tests (unity/Hiraeth/Assets/Hiraeth/Editor/Tests/VoiceTests.cs) compare its own Voice.cs / VoiceSynth.cs with:
// each plan, syllable by syllable, and measures of the sound (the loudness every 10 ms, the pitch every 10 ms,
// the long-term spectrum in third-octave bands). export-world.mjs writes it into the desert's world.json
// (voiceReference). The measures here and in VoiceTests.cs are the same code, line for line.
import { AudioContext } from '../../engine/webaudio.js';
import { planLine, voiceOf } from '../../src/story/voice.js';
import { renderVoice } from '../../src/voice-synth.js';

/** The rate the reference is sung at, and when its first syllable falls (s). */
export const VOICE_REF_RATE = 24000, VOICE_REF_T0 = 0.05;

/** The lines: [text, person, tongue]. The desert's first (its people's), then a tongue of each make. */
export const VOICE_LINES = [
  ['~happy~ Welcome, traveller! The fire is warm.', { id: 'ama', kind: 'f', scale: 0.91 }, 'desert'],
  ['~sad~ The well has been dry for a long time…', { id: 'hessa', voice: 0.7, kind: 'f' }, 'desert'],
  ['~curious~ Who are the Givers? Why a star?', { id: 'you', voice: 1.0, kind: 'm' }, 'desert'],
  ['~angry~ Hey! Mind where you push!', { seed: 'crowd:12' }, 'desert'],
  ['(She laughs.) ~solemn~ Come down, child.', { id: 'nour', name: 'Nour', title: 'the eldest' }, 'desert'],
  ['~neutral~ The water has not risen this year, and the *pilgrims* are still walking round the walls.', { id: 'bako', voice: 0.75, kind: 'm', build: 'heavy' }, 'desert'],
  ['~angry~ Mind the lift! It does not stop, it never stops for anyone.', { id: 'dagny', voice: 1.1, kind: 'f' }, 'incal'],
  ['~playful~ Tick, tock, the gears go round, and round again.', { id: 'gor', voice: 0.8, kind: 'm' }, 'garage'],
  ['~happy~ The lamps are lit again, look at them all.', { id: 'briony', voice: 1.2, kind: 'f', scale: 0.7 }, 'perdide'],
  ['~whisper~ Hush now, the stilts are sleeping over the water.', { id: 'elva', voice: 0.9, kind: 'f' }, 'arzach'],
  ['~curious~ Where did you come from, and where are you going?', { id: 'mur', voice: 1.0, kind: 'f' }, 'murmur'],
  ['~solemn~ The spheres sing, and the garden listens.', { id: 'drift', voice: 0.95, kind: 'm' }, 'spheres'],
  ['~neutral~ Course set. Fuel at half. Ready when you are.', { id: 'ship', voice: 1.0, kind: 'f' }, 'ship'],
];

/** A seeded white-noise buffer (as tests/voice-synth.test.js's). */
function noiseBuf(ctx, rate) {
  const nb = ctx.createBuffer(1, rate * 2, rate), d = nb.getChannelData(0);
  let s = 12345; for (let i = 0; i < d.length; i++) d[i] = ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return nb;
}

/** A plan sung by the web game's renderer alone on a fresh context, mono: (total + 0.5) s from time 0, its first syllable at t0. */
export function singRef(plan, rate = VOICE_REF_RATE, t0 = VOICE_REF_T0) {
  const ctx = new AudioContext({ sampleRate: rate });
  const rnd = Math.random; let s = 99; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  try {
    // (audio.js renderPlan: a voice per speaker of the plan, a chorus's others their own)
    const groups = new Map();
    for (const x of plan.syllables) { const k = x.chorus ?? 0; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
    const noise = noiseBuf(ctx, rate);
    for (const G of groups.values()) renderVoice(ctx, ctx.destination, G, t0, noise, plan.timbre);
  } finally { Math.random = rnd; }
  const st = ctx.render(Math.round((plan.total + 0.5) * rate)), x = new Float32Array(st.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = st[i * 2];
  return x;
}

// ---------------------------------------------------------------- the measures (VoiceTests.cs has the same)
const HOP = 0.01;
/** The loudness: RMS over 20 ms every 10 ms. */
export function envelope(x, rate) {
  const n = Math.round(0.02 * rate), h = Math.round(HOP * rate), E = [];
  for (let a = 0; a + n <= x.length; a += h) { let s = 0; for (let i = a; i < a + n; i++) s += x[i] * x[i]; E.push(Math.sqrt(s / n)); }
  return E;
}
/** The pitch every 10 ms: normalised autocorrelation over 30 ms, searched in [lo, hi] Hz → [f0, r] (r: how periodic). */
export function pitchTrack(x, rate, lo, hi) {
  const n = Math.round(0.03 * rate), h = Math.round(HOP * rate), out = [];
  const L0 = Math.floor(rate / hi), L1 = Math.ceil(rate / lo);
  for (let a = 0; a + n + L1 < x.length; a += h) {
    let e0 = 0; for (let i = a; i < a + n; i++) e0 += x[i] * x[i];
    let best = 0, lag = 0;
    for (let L = L0; L <= L1; L++) {
      let c = 0, e1 = 0;
      for (let i = a; i < a + n; i++) { c += x[i] * x[i + L]; e1 += x[i + L] * x[i + L]; }
      const r = c / Math.sqrt(e0 * e1 + 1e-12);
      if (r > best) { best = r; lag = L; }
    }
    out.push([lag ? +(rate / lag).toFixed(2) : 0, +best.toFixed(3)]);
  }
  return out;
}
/** The long-term spectrum: 18 third-octave bands from 160 Hz (dB, their mean taken off), Hann windows of 1024 every 512. */
export function bands(x, rate) {
  const N = 1024, B = new Float64Array(18);
  for (let a = 0; a + N < x.length; a += N / 2) {
    for (let b = 0; b < 18; b++) {
      const f = 160 * 2 ** (b / 3); let re = 0, im = 0;
      for (let i = 0; i < N; i += 2) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N), ph = 2 * Math.PI * f * i / rate; re += x[a + i] * w * Math.cos(ph); im += x[a + i] * w * Math.sin(ph); }
      B[b] += re * re + im * im;
    }
  }
  const db = [...B].map((e) => 10 * Math.log10(e + 1e-12)), m = db.reduce((p, q) => p + q, 0) / db.length;
  return db.map((d) => +(d - m).toFixed(2));
}
/** The pitch range searched for a plan: its pitch points, widened. */
export function pitchRange(plan) {
  const fs = plan.syllables.flatMap((s) => s.pitch.map((p) => p[1]));
  return [Math.min(...fs) * 0.7, Math.max(...fs) * 1.4];
}

/** The reference: each line's speaker, plan (and its balloon's length) and the measures of its sound. */
export function voiceReference(lines = VOICE_LINES) {
  return lines.map(([text, person, lang]) => {
    const voice = voiceOf(person);
    const plan = planLine(text, { voice, lang });
    const short = planLine(text, { voice, lang, max: 9 });
    const x = singRef(plan), rate = VOICE_REF_RATE;
    const [lo, hi] = pitchRange(plan);
    let s2 = 0, peak = 0; for (const v of x) { s2 += v * v; peak = Math.max(peak, Math.abs(v)); }
    return {
      text, person, lang, voice, plain: plan.text, tone: plan.tone, total: plan.total, cps: plan.cps, timbre: plan.timbre, n: plan.syllables.length, shortN: short.syllables.length,
      syllables: plan.syllables.map((s) => ({ i: s.i, t: s.t, dur: s.dur, f0: s.f0, gain: s.gain, vowel: s.vowel, vowel2: s.vowel2, cons: s.cons, consonant: s.consonant, coda: s.coda,
        join: s.join, stress: s.stress, pitch: s.pitch, vib: s.vib, breath: s.breath, clip: s.clip, chorus: s.chorus ?? 0 })),
      sound: { rate, t0: VOICE_REF_T0, length: x.length, rms: +Math.sqrt(s2 / x.length).toFixed(5), peak: +peak.toFixed(4), lo, hi,
        envelope: envelope(x, rate).map((v) => +v.toFixed(5)), pitch: pitchTrack(x, rate, lo, hi), bands: bands(x, rate) },
    };
  });
}
