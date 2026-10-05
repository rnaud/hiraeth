// The ship's sounds, synthesised on the game's Sound (src/audio.js): the hum
// of the hull, the call tone, the alarm, the impact, the long scrape of the
// landing, the hatch and the engines. Each is a no-op until audio starts.

const ok = (s) => s?.ctx && !s.muted;

function loop(s, key, build) {
  if (!s.ctx) return null;
  s._ship ??= {};
  if (!s._ship[key]) s._ship[key] = build(s.ctx);
  return s._ship[key];
}

/** The hull's low hum (0..1); it drops out when the power dies. */
export function hum(s, level) {
  const h = loop(s, 'hum', (ctx) => {
    const g = ctx.createGain(); g.gain.value = 0;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    for (const [hz, type] of [[55, 'sawtooth'], [55.4, 'sine'], [110.3, 'triangle']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz; o.connect(f); o.start();
    }
    const n = ctx.createBufferSource(); n.buffer = s.noiseBuf; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 180; nf.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.value = 0.4;
    n.connect(nf).connect(ng).connect(f); n.start();
    f.connect(g).connect(s.fx);
    return { g, f };
  });
  if (h) h.g.gain.setTargetAtTime(0.05 * level, s.ctx.currentTime, 0.25);
}

/** The alarm: a two-tone wail (0 = off). */
export function alarm(s, level) {
  const a = loop(s, 'alarm', (ctx) => {
    const o = ctx.createOscillator(); o.type = 'square';
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.6;
    const lg = ctx.createGain(); lg.gain.value = 140;
    lfo.connect(lg).connect(o.frequency); o.frequency.value = 620;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(f).connect(g).connect(s.fx); o.start(); lfo.start();
    return { g };
  });
  if (a) a.g.gain.setTargetAtTime(0.045 * level, s.ctx.currentTime, 0.08);
}

/** An incoming call: two soft rising notes. */
export function ring(s) {
  if (!ok(s)) return;
  const t = s.ctx.currentTime;
  s.sweep(t, 660, 700, 0.18, 0.05, 'sine');
  s.sweep(t + 0.22, 880, 940, 0.26, 0.05, 'sine');
}

export function beep(s, high = false) {
  if (!ok(s)) return;
  s.sweep(s.ctx.currentTime, high ? 1400 : 900, high ? 1500 : 860, 0.08, 0.04, 'square');
}

/** Something hits the ship: a deep boom, a metal clang, and debris rattling down. */
export function impact(s) {
  if (!ok(s)) return;
  const t = s.ctx.currentTime;
  s.burst(t, { dur: 2.2, type: 'lowpass', freq: 240, q: 0.6, vol: 1.1, rate: 0.5 });
  s.sweep(t, 90, 28, 1.4, 0.55, 'sine');
  s.burst(t + 0.02, { dur: 0.9, type: 'bandpass', freq: 1900, q: 9, vol: 0.35 });
  s.burst(t + 0.05, { dur: 1.2, type: 'bandpass', freq: 3100, q: 14, vol: 0.18 });
  for (let i = 0; i < 9; i++) s.burst(t + 0.4 + i * 0.13 + Math.random() * 0.1, { dur: 0.06, type: 'bandpass', freq: 1500 + Math.random() * 2500, q: 5, vol: 0.12 });
}

/** The screen dying into static. */
export function staticBurst(s, dur = 1.2) {
  if (!ok(s)) return;
  s.burst(s.ctx.currentTime, { dur, type: 'highpass', freq: 2800, q: 0.4, vol: 0.12, rate: 1.3 });
}

/** Entry and the long scrape through the dunes. */
export function rumble(s, dur = 3.5, vol = 0.6) {
  if (!ok(s)) return;
  const t = s.ctx.currentTime;
  s.burst(t, { dur, type: 'lowpass', freq: 420, q: 0.8, vol, rate: 0.6 });
  s.burst(t + 0.1, { dur: dur * 0.9, type: 'bandpass', freq: 900, q: 1.2, vol: vol * 0.3, rate: 0.8 });
}

/** Falling through the air, burning: a rising roar. */
export function roar(s, dur = 4) {
  if (!ok(s)) return;
  const ctx = s.ctx, t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = s.noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1400, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(f).connect(g).connect(s.fx); src.start(t); src.stop(t + dur + 0.1);
}

/** The hatch: a hydraulic hiss and a clunk. */
export function hatch(s) {
  if (!ok(s)) return;
  const t = s.ctx.currentTime;
  s.burst(t, { dur: 0.9, type: 'bandpass', freq: 3600, q: 0.7, vol: 0.12, rate: 1.2 });
  s.burst(t + 0.9, { dur: 0.12, type: 'lowpass', freq: 300, q: 1, vol: 0.4 });
  s.sweep(t + 1.0, 140, 70, 0.2, 0.15, 'triangle');
}

/** Engines for take-off (k 0..1 ramps them up; 0 stops). */
export function engines(s, k) {
  const e = loop(s, 'engines', (ctx) => {
    const n = ctx.createBufferSource(); n.buffer = s.noiseBuf; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 40;
    const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 300;
    const g = ctx.createGain(); g.gain.value = 0;
    n.connect(f).connect(g); o.connect(of).connect(g); g.connect(s.fx); n.start(); o.start();
    return { g, f, o };
  });
  if (!e) return;
  const t = s.ctx.currentTime;
  e.g.gain.setTargetAtTime(0.35 * k, t, 0.3);
  e.f.frequency.setTargetAtTime(200 + 1600 * k, t, 0.4);
  e.o.frequency.setTargetAtTime(40 + 50 * k, t, 0.4);
}

/** Out of the jump: a soft rushing swell as the planet comes up (space has no air; the cartoon does). */
export function approach(s, dur = 2.8) {
  if (!ok(s)) return;
  const t = s.ctx.currentTime;
  s.sweep(t, 60, 95, dur, 0.12, 'sine');
  s.burst(t + 0.1, { dur, type: 'bandpass', freq: 520, q: 0.9, vol: 0.08, rate: 0.5 });
}

/** Into the air: the roar of entry, the hull crackling with fire, a deep buffeting. */
export function reentry(s, dur = 2.2) {
  if (!ok(s)) return;
  const t = s.ctx.currentTime;
  roar(s, dur + 0.6);
  rumble(s, dur, 0.5);
  for (let i = 0; i < 16; i++) s.burst(t + Math.random() * dur, { dur: 0.04 + Math.random() * 0.05, type: 'bandpass', freq: 1400 + Math.random() * 2600, q: 4, vol: 0.05 + Math.random() * 0.05 });
}

/** Coming down under control: a soft rush of air over the hull, rising and fading (no roar, no crackle). */
export function descent(s, dur = 4) {
  if (!ok(s)) return;
  const ctx = s.ctx, t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = s.noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.6;
  f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(700, t + dur * 0.5); f.frequency.exponentialRampToValueAtTime(320, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(f).connect(g).connect(s.fx); src.start(t); src.stop(t + dur + 0.1);
}
