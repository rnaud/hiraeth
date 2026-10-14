// The people's voices as sound (issue #323: "the auto generated language on all planets is no good, it sounds super
// robotic and hashed"). Lines are planned (src/story/voice.js) and sung by src/voice-synth.js on the engine's Web Audio
// (engine/webaudio.js), in memory: nothing reaches a speaker. The checks are on the rendered samples: no clicks, a pitch
// that glides within words, vowels with formant peaks where the plan put them, a voice that does not drop out inside
// a word, little buzz above the voice, worlds that sound unlike each other, tones that shape the prosody, and the cost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext } from '../engine/webaudio.js';
import { Sound, renderPlan } from '../src/audio.js';
import { planLine, voiceOf, LANGUAGES } from '../src/story/voice.js';
import { renderVoice, PHONES, VOICE_GAIN } from '../src/voice-synth.js';

/** A seeded white-noise buffer (the game's is Math.random's; here every run is the same). */
function noiseBuf(ctx, rate) {
  const nb = ctx.createBuffer(1, rate * 2, rate), d = nb.getChannelData(0);
  let s = 12345; for (let i = 0; i < d.length; i++) d[i] = ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return nb;
}
/** A plan sung alone on a fresh context: its left channel, mono. */
function sing(plan, rate = 24000) {
  const ctx = new AudioContext({ sampleRate: rate });
  const rnd = Math.random; let s = 99; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let made = 0;
  const g = ctx.createGain.bind(ctx), b = ctx.createBiquadFilter.bind(ctx), o = ctx.createOscillator.bind(ctx);
  ctx.createGain = () => { made++; return g(); }; ctx.createBiquadFilter = () => { made++; return b(); }; ctx.createOscillator = () => { made++; return o(); };
  try { renderPlan(ctx, ctx.destination, plan, 0.05, noiseBuf(ctx, rate)); } finally { Math.random = rnd; }
  const st = ctx.render(Math.round((plan.total + 0.5) * rate)), x = new Float32Array(st.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = st[i * 2];
  return { x, rate, made, t0: 0.05 };
}
const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
const peak = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const at = (r, t) => Math.round(t * r);

/** Clicks: 0.5 ms of energy above 14 kHz (a 4th-order high-pass: above any voice or hiss here) ten times what stands 2 ms either side of it. */
function clicks(x, rate) {
  const hp = (inp) => {
    const w = 2 * Math.PI * 14000 / rate, cw = Math.cos(w), al = Math.sin(w) / (2 * 0.707), a0 = 1 + al;
    const b0 = (1 + cw) / 2 / a0, b1 = -(1 + cw) / a0, b2 = b0, a1 = -2 * cw / a0, a2 = (1 - al) / a0, y = new Float32Array(inp.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < inp.length; i++) { const v = b0 * inp[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = inp[i]; y2 = y1; y1 = v; y[i] = v; }
    return y;
  };
  const y = hp(hp(x)), B = Math.round(rate * 0.0005), E = [];
  for (let i = 0; i + B <= y.length; i += B) { let s = 0; for (let j = i; j < i + B; j++) s += y[j] * y[j]; E.push(s); }
  const floor = (peak(x) * 0.001) ** 2 * B, found = [];
  for (let k = 4; k < E.length - 4; k++) if (E[k] > floor && E[k] > 10 * Math.max(E[k - 4], E[k + 4])) found.push(+(k * B / rate).toFixed(4));
  return found;
}

/** f0 by normalised autocorrelation over `win` s at time t, searched in [lo, hi] Hz: { f0, r } (r: how periodic). */
function pitchAt(x, rate, t, lo, hi, win = 0.03) {
  const n = Math.round(win * rate), a = Math.round(t * rate - n / 2);
  if (a < 0 || a + n + rate / lo >= x.length) return { f0: 0, r: 0 };
  let best = 0, lag = 0;
  const e0 = rms(x, a, a + n) ** 2 * n;
  for (let L = Math.floor(rate / hi); L <= Math.ceil(rate / lo); L++) {
    let c = 0, e1 = 0;
    for (let i = a; i < a + n; i++) { c += x[i] * x[i + L]; e1 += x[i + L] * x[i + L]; }
    const r = c / Math.sqrt(e0 * e1 + 1e-12);
    if (r > best) { best = r; lag = L; }
  }
  return { f0: lag ? rate / lag : 0, r: best };
}

/** The spectrum's envelope at time t: each harmonic of f0's level (dB) by its frequency. */
function harmonics(x, rate, t, f0, win = 0.05, top = 4000) {
  const n = Math.round(win * rate), a = Math.round(t * rate - n / 2), H = [];
  for (let h = 1; h * f0 < top; h++) {
    let best = -Infinity;
    for (let df = -0.04; df <= 0.04; df += 0.02) {
      const f = h * f0 * (1 + df);
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)), ph = 2 * Math.PI * f * i / rate; re += x[a + i] * w * Math.cos(ph); im += x[a + i] * w * Math.sin(ph); }
      best = Math.max(best, 20 * Math.log10(Math.hypot(re, im) + 1e-12));
    }
    H.push([h * f0, best]);
  }
  return H;
}

const MAN = voiceOf({ id: 'bako', voice: 0.75, kind: 'm' }), WOMAN = voiceOf({ id: 'ama', voice: 1.05, kind: 'f' });
const LINE = '~neutral~ The water has not risen this year, and the pilgrims are still walking round the walls.';

test('a line is one continuous voice: a couple of dozen nodes for the whole line, whatever its length', () => {
  const short = planLine('~neutral~ Come in.', { voice: WOMAN, lang: 'desert' });
  const long = planLine(LINE, { voice: WOMAN, lang: 'desert' });
  const a = sing(short), b = sing(long);
  assert.ok(long.syllables.length > short.syllables.length * 4);
  assert.equal(a.made, b.made, 'the same graph for three syllables or twenty');
  assert.ok(b.made <= 30, `${b.made} nodes (the old mumble made about a dozen for every syllable)`);
  // the murmurs, five voices at once: a voice each
  const M = planLine(LINE, { voice: WOMAN, lang: 'murmur' });
  assert.equal(sing(M).made, b.made * (1 + LANGUAGES.murmur.chorus.length));
});

test('no clicks: not where syllables meet, not at a pause, not at the line\'s start or end, in any tongue or tone', () => {
  const lines = [
    ['desert', WOMAN, LINE], ['incal', MAN, '~angry~ Mind the lift! It does not stop, it never stops for anyone.'],
    ['garage', MAN, '~playful~ Tick, tock, the gears go round, and round, and round again.'],
    ['edena', WOMAN, '~curious~ Where did you come from, and where are you going now?'],
    ['perdide', MAN, '~happy~ The lamps are lit again, look at them all, every one of them.'],
    ['bazaar', WOMAN, '~shout~ Fresh chimes! Fresh chimes from the far side of the market!'],
    ['ship', WOMAN, '~neutral~ Course set. Fuel at half. Ready when you are.'],
    ['arzach', MAN, '~whisper~ Hush now, the stilts are sleeping over the water.'],
  ];
  for (const [k, [lang, v, text]] of lines.entries()) {
    const plan = planLine(text, { voice: v, lang });
    const { x, rate } = sing(plan, 48000);
    if (k === 0) {
      // (the measure hears a click: a step of 2 % of the line's peak, one sample, in the middle of a vowel)
      const y = x.slice(), i = at(rate, 0.05 + plan.syllables[3].t + plan.syllables[3].dur * 0.6), p = peak(x);
      for (let j = i; j < y.length; j++) y[j] += 0.02 * p;
      assert.ok(clicks(y, rate).some((t) => Math.abs(t - i / rate) < 0.002), 'a click is heard');
    }
    const c = clicks(x, rate);
    assert.ok(c.length === 0, `${lang}: clicks at ${c.slice(0, 6).join(', ')} s`);
    // and it begins and ends in silence, the voice fading in and out
    assert.ok(Math.abs(x[at(rate, 0.04)]) < 1e-4 && rms(x, x.length - at(rate, 0.05)) < peak(x) * 2e-3, `${lang}: from silence to silence`);
  }
});

test('the pitch glides: continuous within each word, with no step between its syllables', () => {
  for (const [lang, v] of [['home', MAN], ['desert', WOMAN], ['buried', MAN], ['edena', WOMAN]]) {
    const plan = planLine(LINE, { voice: v, lang });
    const { x, rate, t0 } = sing(plan);
    const fs = plan.syllables.flatMap((s) => s.pitch.map((p) => p[1]));
    const lo = Math.min(...fs) * 0.7, hi = Math.max(...fs) * 1.4;
    // each run of syllables inside a word (and across words where the voice runs on): f0 every 5 ms where it is voiced
    let pairs = 0, jumps = 0, worst = 0;
    const S = plan.syllables;
    for (let k = 0; k < S.length; k++) {
      let e = k; while (e < S.length - 1 && S[e].join && !S[e + 1].wordStart) e++;
      if (e === k) continue;
      const a = t0 + S[k].t + 0.03, b = t0 + S[e].t + S[e].dur - 0.03;
      let prev = null;
      for (let t = a; t < b; t += 0.005) {
        const p = pitchAt(x, rate, t, lo, hi);
        if (p.r < 0.75) { prev = null; continue; }   // (a consonant: unvoiced, or a closure)
        if (prev) { const d = Math.abs(12 * Math.log2(p.f0 / prev)); pairs++; worst = Math.max(worst, d); if (d > 1) jumps++; }
        prev = p.f0;
      }
      k = e;
    }
    assert.ok(pairs > 40, `${lang}: ${pairs} voiced steps measured`);
    assert.ok(jumps / pairs < 0.03, `${lang}: ${jumps} of ${pairs} 5-ms steps jump more than a semitone (worst ${worst.toFixed(1)})`);
  }
});

test('vowels have formant peaks where the plan put them, and the voice stays on through a word', () => {
  const plan = planLine('~solemn~ Mara sola, ohno, aeva nalo, mana lo, amo, alona.', { voice: MAN, lang: 'home' });
  const { x, rate, t0 } = sing(plan);
  let checked = 0, found1 = 0, found2 = 0, apart = 0;
  for (const s of plan.syllables) {
    // a long vowel, held: its middle third (no diphthong, and its consonant done)
    if (s.vowel2 || s.dur < 0.16 || s.coda) continue;
    const t = t0 + s.t + s.dur * 0.62, f0 = pitchAt(x, rate, t, 60, 220).f0;
    if (!f0) continue;
    const H = harmonics(x, rate, t, f0);
    const env = (f) => H.reduce((m, [hf, db]) => (Math.abs(hf - f) < f0 * 0.75 ? Math.max(m, db) : m), -Infinity);
    const [F1, F2] = s.vowel;
    const between = H.filter(([hf]) => hf > F1 * 1.2 && hf < F2 * 0.85).map(([, db]) => db);
    if (!between.length) continue;   // (F1 and F2 too close to tell apart at this pitch)
    const valley = Math.min(...between);
    checked++;
    if (env(F1) - valley > 6) found1++;
    if (F2 - F1 > 500) { apart++; if (env(F2) - valley > 4) found2++; }
  }
  assert.ok(checked >= 6, `${checked} vowels held long enough to measure`);
  assert.ok(apart >= 3 && found1 >= checked - 1 && found2 >= apart - 1, `F1 peaks in ${found1} of ${checked}, F2 in ${found2} of ${apart}`);
  // within a word the voice never drops out for longer than a stop's closure
  const S = plan.syllables;
  for (let k = 0; k < S.length - 1; k++) {
    if (!S[k].join || S[k + 1].wordStart) continue;
    const a = t0 + S[k].t + 0.02, b = t0 + S[k + 1].t + S[k + 1].dur - 0.02, ref = rms(x, at(rate, a), at(rate, b));
    let quiet = 0, run = 0;
    for (let t = a; t < b; t += 0.005) { const e = rms(x, at(rate, t), at(rate, t + 0.01)); run = e < ref * 0.03 ? run + 0.005 : 0; quiet = Math.max(quiet, run); }
    assert.ok(quiet < 0.07, `the voice drops out for ${quiet.toFixed(3)} s inside a word`);
  }
});

test('no buzz: little of a vowel\'s energy lies above the voice, unlike a square or a sawtooth', () => {
  const plan = planLine('~neutral~ Alona mara, oma nalo.', { voice: WOMAN, lang: 'home' });
  const { x, rate, t0 } = sing(plan, 48000);
  const s = plan.syllables.find((y) => y.dur > 0.15 && !y.coda);
  const t = t0 + s.t + s.dur * 0.6, f0 = pitchAt(x, rate, t, 120, 400).f0;
  const H = harmonics(x, rate, t, f0, 0.04, 9000);
  const pow = (lo, hi) => H.filter(([f]) => f >= lo && f < hi).reduce((a, [, db]) => a + 10 ** (db / 10), 0);
  const above = 10 * Math.log10(pow(5000, 9000) / pow(0, 5000));
  assert.ok(above < -28, `${above.toFixed(1)} dB of the vowel above 5 kHz`);
  // (a band-limited sawtooth at the same pitch, through nothing, has its upper harmonics at 1/n: some -12 dB there)
  const saw = 10 * Math.log10(H.filter(([f]) => f >= 5000).reduce((a, [f]) => a + (f0 / f) ** 2, 0) / H.filter(([f]) => f < 5000).reduce((a, [f]) => a + (f0 / f) ** 2, 0));
  assert.ok(above < saw - 15, `${above.toFixed(1)} dB against a sawtooth's ${saw.toFixed(1)}`);
});

test('every world sounds unlike the others (the same line, the same speaker), and each tongue its own make', () => {
  const worlds = ['home', 'desert', 'incal', 'arzach2', 'garage', 'glassdunes', 'buried', 'edena', 'spheres', 'perdide', 'bazaar', 'underwater', 'moonfoundry', 'spacecity'];
  const v = voiceOf({ id: 'same', voice: 1, kind: 'f' });
  /** A long-term spectrum in third-octave bands (dB, its mean taken off), the syllable rate and the mean f0. */
  const print = (lang) => {
    const plan = planLine(LINE, { voice: v, lang });
    const { x, rate } = sing(plan);
    const N = 1024, bands = new Float64Array(18);
    for (let a = 0; a + N < x.length; a += N / 2) {
      for (let b = 0; b < 18; b++) {
        const f = 160 * 2 ** (b / 3); let re = 0, im = 0;
        for (let i = 0; i < N; i += 2) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N), ph = 2 * Math.PI * f * i / rate; re += x[a + i] * w * Math.cos(ph); im += x[a + i] * w * Math.sin(ph); }
        bands[b] += re * re + im * im;
      }
    }
    const db = [...bands].map((e) => 10 * Math.log10(e + 1e-12)), m = db.reduce((p, q) => p + q, 0) / db.length;
    return { db: db.map((d) => d - m), rate: plan.syllables.length / plan.total, f0: plan.syllables.reduce((p, s) => p + s.f0, 0) / plan.syllables.length, timbre: plan.timbre };
  };
  const P = Object.fromEntries(worlds.map((w) => [w, print(w)]));
  for (let i = 0; i < worlds.length; i++) {
    for (let j = i + 1; j < worlds.length; j++) {
      const a = P[worlds[i]], b = P[worlds[j]];
      const spec = Math.sqrt(a.db.reduce((s, d, k) => s + (d - b.db[k]) ** 2, 0) / a.db.length);
      const pace = Math.abs(Math.log(a.rate / b.rate)), pitch = Math.abs(12 * Math.log2(a.f0 / b.f0));
      // apart in their spectrum (vowels, consonants, the voice's make), their pace or their pitch
      assert.ok(spec > 1.5 || pace > 0.15 || pitch > 2, `${worlds[i]} and ${worlds[j]} sound alike: ${spec.toFixed(2)} dB, pace ${pace.toFixed(2)}, ${pitch.toFixed(1)} st`);
    }
  }
  // the make of the voice: the Shaft cant pressed and bright, the Vael hush soft and breathy, the glass tongues ringing
  const T = (lang) => planLine(LINE, { voice: v, lang }).timbre;
  assert.ok(T('incal').tilt < T('desert').tilt - 0.25 && T('arzach').open > T('incal').open + 0.6);
  assert.ok(T('spheres').ring > 0.5 && T('home').ring === 0);
});

test('the tone shapes the speech: sad slower, lower and darker; playful quicker, higher and brighter; a question rises', () => {
  const p = (tone, end = '.') => planLine(`${LINE.slice(0, -1)}${end}`, { voice: WOMAN, tone, lang: 'home' });
  const sad = p('sad'), play = p('playful'), plain = p('neutral'), ask = p('curious', '?');
  assert.ok(sad.total > plain.total * 1.2 && play.total < plain.total * 0.95, 'pace');
  const mean = (q) => q.syllables.reduce((a, s) => a + Math.log2(s.f0), 0) / q.syllables.length;
  assert.ok(mean(sad) < mean(plain) - 0.15 && mean(play) > mean(plain) + 0.1, 'pitch');
  assert.ok(sad.timbre.tilt > plain.timbre.tilt + 0.1 && play.timbre.tilt < plain.timbre.tilt - 0.1, 'darker and brighter');
  assert.ok(sad.syllables[0].vowel[0] < plain.syllables[0].vowel[0] && play.syllables[0].vowel[0] > plain.syllables[0].vowel[0], 'the formants with them');
  // heard: the sung f0 at a question's last syllable stands above where it began
  const { x, rate, t0 } = sing(ask), S = ask.syllables, last = S.at(-1);
  const end = pitchAt(x, rate, t0 + last.t + last.dur * 0.7, 100, 700).f0, start = pitchAt(x, rate, t0 + S[1].t + S[1].dur * 0.6, 100, 700).f0;
  assert.ok(end > start * 1.15, `a question rises: ${start.toFixed(0)} → ${end.toFixed(0)} Hz`);
  // and the pauses: a comma and a full stop are heard as silence
  const two = planLine('~neutral~ Wait here, I will be back. Then we go.', { voice: WOMAN, lang: 'home' });
  const sung = sing(two), gaps = two.syllables.filter((s, k) => k < two.syllables.length - 1 && !s.join);
  assert.ok(gaps.length >= 2);
  for (const s of gaps) {
    const t = sung.t0 + s.t + s.dur + 0.09;
    assert.ok(rms(sung.x, at(sung.rate, t), at(sung.rate, t + 0.03)) < rms(sung.x) * 0.1, `a pause after the syllable at ${s.t}s`);
  }
});

test('the speaker\'s body: a child higher and smaller-throated, a heavy man deeper and darker, an elder wavering', () => {
  const child = voiceOf({ id: 'ilo', voice: 1.7, kind: 'f', scale: 0.7 }), heavy = voiceOf({ id: 'gor', voice: 0.75, kind: 'm', build: 'heavy' });
  const slight = voiceOf({ id: 'gor', voice: 0.75, kind: 'm', build: 'slim' }), elder = voiceOf({ id: 'nour', title: 'the eldest', voice: 0.8, kind: 'f' });
  assert.ok(child.formant > WOMAN.formant * 1.2 && child.f0 > WOMAN.f0 * 1.4);
  assert.ok(heavy.f0 < slight.f0 * 0.95 && heavy.formant < slight.formant);
  assert.ok(elder.flutter > WOMAN.flutter * 1.8 && elder.open > WOMAN.open);
  const L = (v) => planLine(LINE, { voice: v, lang: 'desert' });
  assert.ok(L(child).syllables[0].vowel[1] > L(heavy).syllables[0].vowel[1] * 1.3, 'a small throat, high formants');
});

test('every phone the tongues use is known to the synthesiser, and every tongue renders', () => {
  for (const [id, L] of Object.entries(LANGUAGES)) for (const c of L.cons) assert.ok(c === '' || PHONES[c], `${id}: ${c}`);
  for (const id of Object.keys(LANGUAGES)) {
    const plan = planLine('~neutral~ Hello there, are you well?', { voice: MAN, lang: id });
    if (!plan.syllables.length) continue;
    const { x } = sing(plan);
    assert.ok(Number.isFinite(peak(x)) && peak(x) > 0.01 && peak(x) < 1, `${id}: ${peak(x)}`);
  }
  assert.ok(VOICE_GAIN > 0 && typeof renderVoice === 'function');
});

test('the game\'s Sound sings a dialogue page once and hushes it when the page turns', () => {
  const ctx = new AudioContext({ sampleRate: 24000 });
  const voices = ctx.createGain(); voices.connect(ctx.destination);
  const S = Object.create(Sound.prototype);
  Object.assign(S, { ctx, voices, noiseBuf: noiseBuf(ctx, 24000), muted: false, alienVoices: true, _balloons: [], _talkUntil: 0, voiceLog: [] });
  const plan = planLine(LINE, { voice: WOMAN, lang: 'desert' });
  for (const s of plan.syllables.slice(0, 6)) S.syllable(s, { plan });
  assert.equal(S.voiceLog.length, 1, 'the page is sung once, from its first syllable');
  const on = ctx.render(24000 * 0.5);
  assert.ok(rms(on) > 0.005, 'and is heard');
  S.hush('talk');
  ctx.render(24000 * 0.3);
  assert.ok(rms(ctx.render(24000 * 0.3)) < rms(on) * 0.01, 'the page turned: quiet');
});
