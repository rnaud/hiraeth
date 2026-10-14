// The people's voices, sung (issue #323: the old mumble was a run of separate square / saw beeps, a
// fresh oscillator for every syllable: hard pitch steps, buzz and a click at every join). Here a line is
// one continuous voice, a small formant synthesiser built of plain Web Audio nodes (about twenty for a
// whole line, where the old one made a dozen for every syllable):
//
//   glottal pulse (a PeriodicWave, its tilt the speaker's) ─ flutter, vibrato on its detune
//      └ voicing level ┐
//   breath noise ─ aspiration level ┴→ F0 / F1 / F2 / F3 / F4 resonators (parallel band-passes) ─┐
//   noise ─ frication band-pass (the hiss or burst of a consonant) ─ frication level ───────────────┴→ out
//
// Every parameter moves by setTargetAtTime (an exponential glide from wherever it stands), so pitch,
// formants and levels are continuous: no step, no zipper, no click where syllables meet. A syllable
// of the plan (src/story/voice.js planLine) is a consonant (the phones below: a stop's closure,
// burst and aspiration, a fricative's hiss, a nasal's murmur, a liquid's glide, the formants bending
// to the consonant's place and back to the vowel), then its vowel (a diphthong glides to a second),
// then perhaps a coda; joined syllables run on into each other, the last before a pause dies away.

const tau = (x) => Math.max(0.0015, x);

/**
 * The consonants: type, voiced, durations (s, at the plan's even pace), the noise of a burst or hiss
 * ([centre Hz, Q, level]) and the locus the formants bend toward ([F1, F2, F3], the tongue's place).
 * A cluster is its phones in turn (`seq`).
 */
export const PHONES = {
  p: { type: 'stop', voiced: false, clo: 0.05, asp: 0.035, noise: [1100, 0.8, 0.5], locus: [250, 850, 2300] },
  b: { type: 'stop', voiced: true, clo: 0.045, asp: 0.006, noise: [1000, 0.8, 0.16], locus: [220, 850, 2300] },
  t: { type: 'stop', voiced: false, clo: 0.045, asp: 0.04, noise: [4300, 1.4, 0.6], locus: [250, 1800, 2700] },
  d: { type: 'stop', voiced: true, clo: 0.04, asp: 0.006, noise: [3900, 1.4, 0.2], locus: [220, 1750, 2700] },
  k: { type: 'stop', voiced: false, clo: 0.05, asp: 0.045, noise: [2300, 3, 0.55], locus: [250, 2000, 2400] },
  g: { type: 'stop', voiced: true, clo: 0.045, asp: 0.008, noise: [2100, 3, 0.18], locus: [220, 1950, 2400] },
  q: { type: 'stop', voiced: false, clo: 0.055, asp: 0.03, noise: [1300, 2.5, 0.5], locus: [450, 1100, 2400] },
  ts: { type: 'aff', voiced: false, clo: 0.035, fric: 0.06, noise: [5600, 2.2, 0.42], locus: [260, 1800, 2700] },
  ch: { type: 'aff', voiced: false, clo: 0.035, fric: 0.06, noise: [2900, 2, 0.48], locus: [260, 2000, 2600] },
  s: { type: 'fric', voiced: false, fric: 0.085, noise: [5600, 2.4, 0.4], locus: [270, 1750, 2700] },
  z: { type: 'fric', voiced: true, fric: 0.07, noise: [5300, 2.4, 0.2], locus: [260, 1750, 2700] },
  sh: { type: 'fric', voiced: false, fric: 0.085, noise: [2900, 2, 0.42], locus: [270, 1950, 2600] },
  f: { type: 'fric', voiced: false, fric: 0.08, noise: [6200, 0.7, 0.16], locus: [260, 900, 2300] },
  v: { type: 'fric', voiced: true, fric: 0.06, noise: [5500, 0.7, 0.08], locus: [250, 950, 2300] },
  th: { type: 'fric', voiced: false, fric: 0.075, noise: [6800, 0.6, 0.12], locus: [270, 1500, 2600] },
  kh: { type: 'fric', voiced: false, fric: 0.085, noise: [1700, 3.5, 0.3], locus: [320, 1500, 2400] },
  x: { type: 'fric', voiced: false, fric: 0.08, noise: [1900, 3, 0.28], locus: [320, 1600, 2400] },
  h: { type: 'h', voiced: false, fric: 0.065 },
  m: { type: 'nasal', dur: 0.065, locus: [260, 900, 2200] },
  n: { type: 'nasal', dur: 0.06, locus: [260, 1650, 2600] },
  ng: { type: 'nasal', dur: 0.07, locus: [260, 2000, 2400] },
  l: { type: 'liquid', dur: 0.055, locus: [360, 1050, 2800] },
  r: { type: 'liquid', dur: 0.05, locus: [420, 1250, 1700] },
  w: { type: 'liquid', dur: 0.06, locus: [300, 700, 2200] },
  y: { type: 'liquid', dur: 0.055, locus: [280, 2200, 2950] },
  bl: { seq: ['b', 'l'] }, gl: { seq: ['g', 'l'] }, st: { seq: ['s', 't'] }, tk: { seq: ['t', 'k'] },
};
const phonesOf = (c) => { const P = PHONES[c]; return !P ? [] : P.seq ? P.seq.map((x) => PHONES[x]) : [P]; };
/** How long a consonant (or cluster) takes, s, at the plan's even pace. */
export const phoneLength = (c) => phonesOf(c).reduce((a, p) => a + (p.clo ?? 0) + (p.asp ?? 0) + (p.fric ?? 0) + (p.dur ?? 0), 0);

// the glottal pulse's spectrum by tilt (each harmonic n at n^-tilt: higher is softer, darker), made once a context
const WAVES = new WeakMap();
export function glottalWave(ctx, tilt = 1.25, open = 0) {
  const key = `${tilt.toFixed(2)}:${open.toFixed(2)}`;
  let M = WAVES.get(ctx);
  if (!M) WAVES.set(ctx, (M = new Map()));
  if (!M.has(key)) {
    const N = 40, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    // (a breathy, open glottis: a stronger first harmonic against the second)
    for (let n = 1; n <= N; n++) im[n] = Math.pow(n, -tilt) * (n === 1 ? 1 + open : 1) * (n > 30 ? (N + 1 - n) / 11 : 1);
    M.set(key, ctx.createPeriodicWave(re, im));
  }
  return M.get(key);
}

/** The level a line is sung at against the plan's gains (matched to the old beeps' loudness on the same lines: about the same RMS, a quarter of the peak). */
export const VOICE_GAIN = 4.5;

/**
 * Sing a run of planned syllables (one voice: a chorus's other voices are runs of their own) from t0 into dest.
 * @param S       syllables (planLine), their `t` from the plan's start
 * @param noise   a white-noise AudioBuffer (looped)
 * @param timbre  the plan's timbre (planLine: tilt, bw, flutter, f4, ring, mech)
 * @returns { end, stop(when), fade() }
 */
export function renderVoice(ctx, dest, S, t0, noise, timbre = {}) {
  if (!S.length) return { end: t0, stop() {}, fade() {} };
  const Tm = { tilt: 1.25, open: 0, bw: 1, flutter: 12, f4: 3500, ring: 0, mech: 0, nasal: 0, ...timbre };
  const start = t0 - 0.02, last = S[S.length - 1], end = t0 + last.t + last.dur + 0.35;
  const out = ctx.createGain(); out.gain.value = VOICE_GAIN; out.connect(dest);
  const nodes = [out], srcs = [];
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; nodes.push(g); return g; };
  const band = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; nodes.push(b); return b; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; srcs.push(o); return o; };

  // the source: a glottal pulse, its pitch flutters a little (three slow sines, Klatt's), a vibrato on top
  const glottis = osc('sine', S[0].pitch[0][1]);
  glottis.setPeriodicWave?.(glottalWave(ctx, Tm.tilt, Tm.open));
  const flutter = gain(Tm.flutter / 3);
  for (const f of [4.7, 7.1, 12.7]) osc('sine', f * (0.94 + 0.12 * ((S[0].bright ?? 0.5)))).connect(flutter);
  flutter.connect(glottis.detune);
  const vibOsc = osc('sine', S[0].vib?.[0] || 5.5), vib = gain(0);
  vibOsc.connect(vib).connect(glottis.detune);
  // machines (the Hangar, the ship): a soft voice-box hum on the level, not a ring-modulated buzz
  let src = glottis;
  if (Tm.mech > 0) {
    const am = gain(1), lfo = osc('sine', 46 + 20 * (S[0].bright ?? 0.5)), d = gain(0.28 * Tm.mech);
    lfo.connect(d).connect(am.gain); glottis.connect(am); src = am;
  }
  const voicing = gain(0);
  src.connect(voicing);
  // breath: noise through the same resonators (h, whisper, the air of a breathy voice)
  const air = ctx.createBufferSource(); air.buffer = noise; air.loop = true; srcs.push(air);
  const asp = gain(0);
  air.connect(asp);
  // the vocal tract: F0 (the fundamental's warmth) and four formants in parallel
  const tract = gain(1);
  voicing.connect(tract); asp.connect(tract);
  const bw = Tm.bw;
  const F1 = band('bandpass', S[0].vowel[0], 5.5 / bw), F2 = band('bandpass', S[0].vowel[1], 9 / bw), F3 = band('bandpass', S[0].vowel[2] ?? 2600, 12 / bw);
  const F4 = band('bandpass', Tm.f4, Tm.ring > 0 ? 10 + 30 * Tm.ring : 7);
  const F0 = band('lowpass', 320, 0.7);
  const oral = gain(1);   // F2 and up: shut for a nasal's murmur
  // (the resonators' sum under a gentle low-pass: the band-passes' skirts leak no air above the voice)
  const warm = band('lowpass', Math.min(5200, Tm.f4 * 1.45), 0.7);
  warm.connect(out);
  const mix =[[F0, 0.22], [F1, 1], [F2, 1.1], [F3, 0.8], [F4, 0.18 + 0.5 * Tm.ring]];
  for (const [f, lv] of mix) {
    const g = gain(lv);
    tract.connect(f).connect(g);
    (f === F2 || f === F3 || f === F4 ? g.connect(oral) : g.connect(warm));
  }
  oral.connect(warm);
  // frication: the hiss of s, sh, f and the burst of a stop, straight out (made at the teeth and lips, past the tract)
  const fricN = ctx.createBufferSource(); fricN.buffer = noise; fricN.loop = true; srcs.push(fricN);
  // (a high-pass under the band-pass: a hiss has little below its band, where a band-pass alone leaks)
  const fricH = band('highpass', 2400, 0.7), fricF = band('bandpass', 4000, 2), fric = gain(0);
  fricN.connect(fricH).connect(fricF).connect(fric).connect(out);
  const hiss = (f, q, t) => { to(fricF.frequency, f, t, 0.003); to(fricH.frequency, f * 0.6, t, 0.003); fricF.Q.setTargetAtTime(q, Math.max(start, t), 0.003); };

  const to = (p, v, t, tc) => p.setTargetAtTime(v, Math.max(start, t), tau(tc));
  const formants = (F, t, tc) => { to(F1.frequency, F[0], t, tc); to(F2.frequency, F[1], t, tc); to(F3.frequency, F[2] ?? 2600, t, tc * 1.2); };
  const toward = (a, b, k) => [0, 1, 2].map((i) => (a[i] ?? 2600) + ((b[i] ?? 2600) - (a[i] ?? 2600)) * k);

  // (a high voice's first harmonics fall on F1 and ring out, a low one's fall below it: levelled by the voice's own pitch)
  const level = Math.min(1.6, Math.max(0.55, Math.pow(S.reduce((a, s) => a + s.f0, 0) / S.length / 160, -0.5)));
  let joined = false;
  for (let k = 0; k < S.length; k++) {
    const s = S[k], T = t0 + s.t, A = s.gain * level, V = s.vowel, fs = s.fscale ?? 1;
    const b = s.breath ?? 0, voiced = 1 - 0.94 * Math.pow(b, 1.5), breathy = 0.015 + 0.35 * Math.pow(b, 2);
    // the consonant's phones take at most half the syllable; a clipped tongue says them quicker
    const ph = phonesOf(s.consonant ?? '');
    const want = phoneLength(s.consonant ?? '');
    const squeeze = want > 0 ? Math.min(1, (s.dur * 0.5) / want) * (1 - 0.25 * (s.clip ?? 0)) : 1;
    const soft = 0.012 + 0.02 * (1 - (s.clip ?? 0));   // how softly levels come and go
    let c = T;
    // after a real silence (a pause, the line's start): the tract set to its first shape before a sound is made,
    // nothing to hear move (after a short gap between clipped words the voice's tail still sounds: it glides)
    const silent = !joined && (k === 0 || T - (t0 + S[k - 1].t + S[k - 1].dur) > 0.12);
    if (silent) {
      formants(ph[0]?.locus ? ph[0].locus.map((x) => x * fs) : V, T - 0.03, 0.004);
      to(glottis.frequency, s.pitch[0][1], T - 0.03, 0.004);
    }
    for (const P of ph) {
      const L = (P.locus ?? V).map((x) => x * fs);
      const cv = toward(L, V, 0.25);
      if (P.type === 'stop' || P.type === 'aff') {
        const clo = P.clo * squeeze, rel = T === c && silent ? 0 : clo;
        // closure: the voice stops (or a voice bar hums on, voiced), the formants close to the consonant's place
        to(voicing.gain, P.voiced ? A * 0.07 : 0, c, 0.006);
        to(asp.gain, 0, c, 0.006);
        formants([P.voiced ? 200 : L[0], L[1], L[2]], c, 0.012);
        c += rel;
        const [nf, nq, nl] = P.noise;
        // the burst, then (unvoiced) the aspiration, the formants already on their way to the vowel
        hiss(nf * Math.sqrt(fs), nq, c - 0.006);
        to(fric.gain, A * nl, c, 0.0012);
        const fr = P.type === 'aff' ? P.fric * squeeze : 0.008;
        to(fric.gain, 0, c + fr, P.type === 'aff' ? 0.01 : 0.005);
        c += fr;
        formants(cv, c - fr, 0.02);
        if (!P.voiced) { to(asp.gain, A * 0.55, c, 0.004); c += (P.asp ?? 0.01) * squeeze; to(asp.gain, A * breathy, c, 0.012); }
        else c += (P.asp ?? 0) * squeeze;
      } else if (P.type === 'fric') {
        const fd = P.fric * squeeze, [nf, nq, nl] = P.noise;
        to(voicing.gain, P.voiced ? A * 0.35 : 0, c, 0.012);
        hiss(nf * Math.sqrt(fs), nq, c - 0.004);
        to(fric.gain, A * nl, c, 0.014);
        formants(L, c, 0.015);
        to(fric.gain, 0, c + fd - 0.012, 0.01);
        formants(cv, c + fd * 0.5, 0.02);
        c += fd;
      } else if (P.type === 'h') {
        const hd = P.fric * squeeze;
        to(voicing.gain, 0, c, 0.012);
        to(asp.gain, A * 0.75, c, 0.012);
        formants(V.map((x) => x), c, 0.015);   // (h is the vowel, unvoiced)
        c += hd;
        to(asp.gain, A * breathy, c, 0.012);
      } else if (P.type === 'nasal') {
        const nd = P.dur * squeeze;
        to(voicing.gain, A * voiced * 0.6, c, 0.012);
        to(oral.gain, 0.12, c, 0.01);
        formants([260, L[1], L[2]], c, 0.012);
        c += nd;
        to(oral.gain, 1, c, 0.012);
        formants(cv, c, 0.012);
      } else if (P.type === 'liquid') {
        const ld = P.dur * squeeze;
        to(voicing.gain, A * voiced * 0.72, c, 0.015);
        formants(L, c, 0.018);
        c += ld;
      }
    }
    // the vowel: the voice comes in (softly after a silence), the formants glide to it, the pitch follows the plan
    const vt = c;
    to(voicing.gain, A * voiced, vt, ph.length ? 0.012 : joined ? 0.02 : soft);
    to(asp.gain, A * breathy, vt, 0.015);
    to(oral.gain, 1, vt, 0.012);
    formants(V, vt, ph.length && PHONES[s.consonant]?.type === 'liquid' ? 0.035 : 0.028);
    to(glottis.frequency, s.pitch[0][1], T - 0.02, Tm.mech ? 0.015 : 0.075);
    to(glottis.frequency, s.pitch[s.pitch.length - 1][1], T + s.dur * 0.4, Math.max(0.03, s.dur * 0.4));
    to(vib.gain, (s.vib?.[1] ?? 0) * 100, T, 0.05);
    const endT = T + s.dur;
    if (s.vowel2) formants(s.vowel2, vt + (endT - vt) * 0.45, 0.045);
    // a coda: the syllable closes on it
    const coda = PHONES[s.coda];
    if (coda) {
      const cl = Math.min(0.06, s.dur * 0.22), cs = endT - cl, Lc = (coda.locus ?? V).map((x) => x * fs);
      if (coda.type === 'nasal') { to(oral.gain, 0.12, cs, 0.012); formants([260, Lc[1], Lc[2]], cs, 0.012); to(voicing.gain, A * voiced * 0.55, cs, 0.015); }
      else if (coda.type === 'liquid') formants(Lc, cs, 0.02);
      else if (coda.type === 'fric') {
        to(voicing.gain, coda.voiced ? A * 0.3 : 0, cs, 0.012);
        hiss(coda.noise[0] * Math.sqrt(fs), coda.noise[1], cs - 0.004);
        to(fric.gain, A * coda.noise[2] * 0.8, cs, 0.012); to(fric.gain, 0, endT - 0.008, 0.01);
      } else if (coda.type === 'stop' || coda.type === 'aff') { formants(Lc, cs, 0.012); to(voicing.gain, 0, cs + cl * 0.4, 0.008); }
      else if (coda.type === 'h') { to(voicing.gain, 0, cs, 0.015); to(asp.gain, A * 0.5, cs, 0.015); }
    }
    joined = !!s.join && k < S.length - 1;
    if (!joined) {
      // the end of a breath group: everything dies away (a phrase's last syllable trails, a clipped one stops short)
      const r = 0.02 + 0.035 * (1 - (s.clip ?? 0));
      to(voicing.gain, 0, endT - r * 0.5, r);
      to(asp.gain, 0, endT - r * 0.5, r);
      to(fric.gain, 0, endT, 0.01);
      to(vib.gain, 0, endT, 0.05);
    }
  }
  for (const o of srcs) { o.start(start, o === air || o === fricN ? (Math.random() * 1.5) : undefined); o.stop(end); }
  // (an AudioBufferSourceNode's start takes an offset; an oscillator's does not)
  let stopped = false;
  const stop = (when = end) => { if (stopped) return; stopped = true; for (const o of srcs) { try { o.stop(when); } catch { /* already */ } } };
  return {
    end, nodes,
    stop,
    /** Fade it out now (the page turned, the call skipped). */
    fade(tc = 0.03) { const now = ctx.currentTime; out.gain.cancelScheduledValues(now); out.gain.setTargetAtTime(0, now, tc); stop(now + tc * 10); },
  };
}
