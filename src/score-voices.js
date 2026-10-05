// The worlds' instruments (src/score.js names them), synthesised in Web Audio: drones, pads,
// plucked and struck things, wind and reed leads, percussion and each world's colour. Kept
// cheap for the handhelds: two or three oscillators a note, no LFO where a detuned twin
// beating against it does the same, every node stopped as soon as it falls silent. Only
// nodes Chrome / WebView 109 has (oscillators, biquads, gains, buffer sources).
//
// A voice is called with V = { ctx, noise (a looping noise buffer) } and plays into `out`.

const SILENT = 0.0004;

function osc(V, type, f, t, stop, dest, detune = 0) {
  const o = V.ctx.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
  o.connect(dest); o.start(t); o.stop(stop); return o;
}
function filt(V, type, f, q, dest) {
  const b = V.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b;
}
function gain(V, dest, v = 0) { const g = V.ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }
function noise(V, t, stop, dest, rate = 1) {
  const n = V.ctx.createBufferSource(); n.buffer = V.noise; n.loop = true; n.playbackRate.value = rate;
  n.connect(dest); n.start(t, Math.random() * 1.5); n.stop(stop); return n;
}
/** A held note's envelope: up in a, held to the end of dur, down in r. */
function held(g, t, dur, a, r, peak) {
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + Math.max(a, dur)); g.gain.linearRampToValueAtTime(0, t + Math.max(a, dur) + r);
  return t + Math.max(a, dur) + r + 0.05;
}
/** A struck note's envelope: up in a, dying away over d. */
function struck(g, t, a, d, peak) {
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(SILENT, t + a + d);
  return t + a + d + 0.05;
}
/** A slow wobble in pitch, from a little after the start (cents depth). */
function vibrato(V, o, t, stop, rate, depthHz) {
  const l = V.ctx.createOscillator(), lg = V.ctx.createGain();
  l.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depthHz, t + 0.6);
  l.connect(lg).connect(o.frequency); l.start(t); l.stop(stop);
}
/** Partials of a struck bell or bar: [ratio, level, decay (s)]. */
function partials(V, f, t, list, vol, dest, a = 0.004) {
  let end = t;
  for (const [m, v, d] of list) {
    const g = gain(V, dest), e = struck(g, t, a, d, vol * v);
    osc(V, 'sine', f * m, t, e, g); end = Math.max(end, e);
  }
  return end;
}

// ------------------------------------------------------------------ held: drones and pads
const HELD = {
  // a reed drone, tonic and a whisper of its octave below (the desert's camps)
  tanpura(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 900, 0.9, g), stop = held(g, t, dur, 3, 4, vol);
    osc(V, 'sawtooth', f, t, stop, lp, -4); osc(V, 'sawtooth', f, t, stop, lp, 5);
    lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(650, t + dur);
  },
  // low strings in the pit
  city(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 520, 0.7, g), stop = held(g, t, dur, 4, 4, vol);
    osc(V, 'sawtooth', f, t, stop, lp, -6); osc(V, 'triangle', f * 2, t, stop, lp, 4);
  },
  // wind singing through stone: noise rung in two narrow bands, and a breath of the tone itself
  air(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 4, 5, vol);
    const n = V.ctx.createGain();
    noise(V, t, stop, n, 0.8);
    for (const [m, q, v] of [[1, 28, 9], [2, 34, 6]]) n.connect(filt(V, 'bandpass', f * m, q, gain(V, g, v)));
    const s = gain(V, g, 0.25); osc(V, 'sine', f, t, stop, s);
  },
  // the monks: a low sung "oh" through two formants
  monks(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 4, 5, vol * 2.2);
    const f1 = filt(V, 'bandpass', 480, 3, g), f2 = filt(V, 'bandpass', 820, 5, g);
    for (const d of [-6, 7]) { const o = osc(V, 'sawtooth', f, t, stop, f1, d); o.connect(f2); }
  },
  // the Hangar's hum: a square in a slowly breathing filter
  synth(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 420, 2, g), stop = held(g, t, dur, 2.5, 3, vol * 0.8);
    osc(V, 'square', f, t, stop, lp); osc(V, 'sawtooth', f, t, stop, lp, 7);
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(900, t + dur * 0.4); lp.frequency.linearRampToValueAtTime(320, t + dur);
  },
  // low brass, swelling: the machine's breath
  brass(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 300, 1.2, g), stop = held(g, t, dur, 3, 4, vol * 1.2);
    osc(V, 'sawtooth', f, t, stop, lp, -5); osc(V, 'sawtooth', f, t, stop, lp, 6); osc(V, 'triangle', f / 2, t, stop, lp);
    lp.frequency.setValueAtTime(220, t); lp.frequency.linearRampToValueAtTime(760, t + dur * 0.45); lp.frequency.linearRampToValueAtTime(260, t + dur);
  },
  // a soft harmonium
  organ(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 3, 4, vol);
    osc(V, 'sine', f, t, stop, g); const h = gain(V, g, 0.3); osc(V, 'sine', f * 2, t, stop, h, 3); const h3 = gain(V, g, 0.08); osc(V, 'triangle', f * 3, t, stop, h3);
  },
  // a pole that hums: a sine and its twin a breath apart, beating slowly
  hum(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 4, 5, vol * 1.3);
    osc(V, 'sine', f, t, stop, g); osc(V, 'sine', f + 0.7, t, stop, g); const h = gain(V, g, 0.2); osc(V, 'sine', f * 3 + 0.4, t, stop, h);
  },
  // a wet finger round a glass: high, beating, with the low tone under it
  crystal(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 5, 5, vol);
    const hi = gain(V, g, 0.5); osc(V, 'sine', f * 4, t, stop, hi); osc(V, 'sine', f * 4 + 1.3, t, stop, hi);
    osc(V, 'sine', f, t, stop, g);
  },
  // a bassoon holding the floor of the wood
  bassoon(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 480, 2.2, g), stop = held(g, t, dur, 3, 4, vol * 1.1);
    osc(V, 'sawtooth', f, t, stop, lp); osc(V, 'square', f, t, stop, lp, 6);
  },
  // ---- pads (a chord's note)
  warm(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 1700, 0.6, g), stop = held(g, t, dur, 2.2, 2.5, vol);
    osc(V, 'triangle', f, t, stop, lp, -6); osc(V, 'triangle', f, t, stop, lp, 6);
  },
  strings(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 1100, 0.5, g), stop = held(g, t, dur, 1.8, 2.5, vol * 0.75);
    osc(V, 'sawtooth', f, t, stop, lp, -8); osc(V, 'sawtooth', f, t, stop, lp, 8);
  },
  choir(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 2, 3, vol * 1.8);
    const f1 = filt(V, 'bandpass', 650, 4, g), f2 = filt(V, 'bandpass', 1050, 6, g);
    const o = osc(V, 'sawtooth', f, t, stop, f1, 4); o.connect(f2);
  },
  glass(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 1.2, 2.5, vol * 0.8);
    osc(V, 'sine', f * 2, t, stop, g); osc(V, 'sine', f * 2 + 0.9, t, stop, g);
    const h = gain(V, g, 0.15); osc(V, 'sine', f * 4, t, stop, h);
  },
  reeds(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 760, 0.8, g), stop = held(g, t, dur, 1.6, 2.2, vol * 0.7);
    osc(V, 'square', f, t, stop, lp, -5); osc(V, 'square', f, t, stop, lp, 5);
  },
};

// ------------------------------------------------------------------ notes: plucked, struck, blown
const NOTES = {
  // the Hangar's lead: a soft saw that slides into each note
  analog(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 1300, 1.5, g), stop = held(g, t, dur, 0.03, 0.25, vol * 0.9);
    const o = V.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.985, t); o.frequency.setTargetAtTime(f, t, 0.03); o.connect(lp); o.start(t); o.stop(stop);
    osc(V, 'triangle', f / 2, t, stop, lp, 3);
  },
  pizz(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 900, 0.8, g), e = struck(g, t, 0.005, 0.7, vol * 1.3);
    osc(V, 'triangle', f, t, e, lp); const h = gain(V, lp, 0.3); osc(V, 'sine', f * 2, t, e, h);
  },
  sine(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 0.5, 1.2, vol);
    osc(V, 'sine', f, t, stop, g);
  },
  vibes(V, f, t, dur, vol, out) {
    partials(V, f, t, [[1, 0.8, 2.2], [1.0035, 0.5, 2.0], [4, 0.08, 0.4]], vol, out);
  },
  stone(V, f, t, dur, vol, out) {
    const g = gain(V, out), e = struck(g, t, 0.08, 2.8, vol * 0.9);
    osc(V, 'sine', f / 2, t, e, g); const h = gain(V, g, 0.35); osc(V, 'sine', f * 0.75 + 0.5, t, e, h);
  },
  handbell(V, f, t, dur, vol, out) {
    partials(V, f * 2, t, [[1, 0.6, 2.2], [2.0, 0.18, 1.2], [2.76, 0.14, 0.8], [5.4, 0.05, 0.35]], vol, out);
  },
  pulse(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 2400, 3, g), e = struck(g, t, 0.004, 0.32, vol * 0.8);
    lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.18);
    osc(V, 'square', f, t, e, lp);
  },
  anvil(V, f, t, dur, vol, out) {
    partials(V, f * 2, t, [[1, 0.5, 1.4], [2.76, 0.25, 0.7], [5.4, 0.12, 0.35], [8.93, 0.06, 0.18]], vol, out, 0.002);
    hit(V, 'tick', t, vol * 0.5, out);
  },
  harp(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 2600, 0.7, g), e = struck(g, t, 0.004, 1.7, vol);
    osc(V, 'triangle', f, t, e, lp); const h = gain(V, lp, 0.35); osc(V, 'sine', f * 2, t, e, h);
  },
  mallet(V, f, t, dur, vol, out) {
    partials(V, f, t, [[1, 0.8, 1.3], [3.9, 0.12, 0.35], [10.1, 0.03, 0.12]], vol, out, 0.003);
  },
  santur(V, f, t, dur, vol, out) {
    // a hammered course of two strings, struck twice (the second softer)
    for (const [dt, k] of [[0, 1], [0.075, 0.45]]) {
      const g = gain(V, out), lp = filt(V, 'lowpass', 3200, 0.8, g), s = t + dt, e = struck(g, s, 0.002, 1.3, vol * k * 0.8);
      lp.frequency.setValueAtTime(3600, s); lp.frequency.exponentialRampToValueAtTime(1100, s + 0.4);
      osc(V, 'triangle', f, s, e, lp, -4); if (k === 1) osc(V, 'sawtooth', f, s, e, lp, 5);
    }
  },
  muted(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 2000, 0.6, g), bp = filt(V, 'bandpass', 1100, 1.6, lp), stop = held(g, t, dur, 0.09, 0.35, vol * 1.5);
    const o = osc(V, 'sawtooth', f, t, stop, bp); vibrato(V, o, t + 0.3, stop, 5, f * 0.006);
  },
  shaku(V, f, t, dur, vol, out) {
    // breath first, then the tone bends up into the note
    const g = gain(V, out), stop = held(g, t, dur, 0.28, 0.5, vol);
    const o = V.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.965, t); o.frequency.setTargetAtTime(f, t + 0.05, 0.09); o.connect(g); o.start(t); o.stop(stop);
    const h = gain(V, g, 0.18); const o2 = osc(V, 'triangle', f * 2, t, stop, h);
    if (dur > 1) { vibrato(V, o, t + dur * 0.4, stop, 4.5, f * 0.01); vibrato(V, o2, t + dur * 0.4, stop, 4.5, f * 0.02); }
    const nb = filt(V, 'bandpass', f * 2, 1.6, gain(V, g, 0.9)), ng = gain(V, nb, 1);
    ng.gain.setValueAtTime(1.4, t); ng.gain.linearRampToValueAtTime(0.5, t + 0.35);
    noise(V, t, stop, ng);
  },
  horn(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 600, 0.7, g), stop = held(g, t, dur, 0.22, 0.6, vol * 1.3);
    lp.frequency.setValueAtTime(420, t); lp.frequency.linearRampToValueAtTime(1100, t + 0.4); lp.frequency.linearRampToValueAtTime(800, t + Math.max(0.5, dur));
    const o = osc(V, 'sawtooth', f, t, stop, lp); osc(V, 'triangle', f, t, stop, lp, 4);
    if (dur > 1) vibrato(V, o, t + 0.5, stop, 4.6, f * 0.004);
  },
  clarinet(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', Math.min(f * 4, 2400), 0.9, g), stop = held(g, t, dur, 0.07, 0.3, vol * 0.9);
    const o = osc(V, 'square', f, t, stop, lp);
    if (dur > 0.8) vibrato(V, o, t + 0.35, stop, 4.8, f * 0.005);
  },
  oboe(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 2800, 0.7, g), bp = filt(V, 'bandpass', 1300, 1.3, lp), stop = held(g, t, dur, 0.06, 0.28, vol * 1.4);
    const o = osc(V, 'sawtooth', f, t, stop, bp);
    if (dur > 0.8) vibrato(V, o, t + 0.3, stop, 5.4, f * 0.006);
  },
  shawm(V, f, t, dur, vol, out) {
    const g = gain(V, out), bp = filt(V, 'bandpass', 1600, 1.1, g), stop = held(g, t, dur, 0.04, 0.2, vol * 1.3);
    const o = osc(V, 'sawtooth', f, t, stop, bp); osc(V, 'square', f, t, stop, bp, 6);
    if (dur > 0.6) vibrato(V, o, t + 0.2, stop, 6, f * 0.007);
  },
  felt(V, f, t, dur, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 1500, 0.5, g), d = Math.min(Math.max(dur + 1.2, 1.6), 3.6), e = struck(g, t, 0.006, d, vol * 1.2);
    osc(V, 'triangle', f, t, e, lp); const h = gain(V, lp, 0.35); osc(V, 'sine', f * 2, t, e, h, 2); const h3 = gain(V, lp, 0.08); osc(V, 'sine', f * 3, t, e, h3);
  },
  bone(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 0.04, 0.3, vol * 0.7);
    const o = V.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.94, t); o.frequency.setTargetAtTime(f, t, 0.04); o.connect(g); o.start(t); o.stop(stop);
    if (dur > 0.6) vibrato(V, o, t + 0.2, stop, 6, f * 0.008);
    const nb = filt(V, 'bandpass', f, 3, gain(V, g, 0.35)); noise(V, t, stop, nb);
  },
  bowl(V, f, t, dur, vol, out) {
    partials(V, f, t, [[1, 0.7, Math.max(3, dur + 2)], [1.003, 0.4, Math.max(2.6, dur + 1.5)], [2.71, 0.18, 1.6], [5.1, 0.05, 0.6]], vol, out, 0.12);
  },
  glass(V, f, t, dur, vol, out) {
    const g = gain(V, out), stop = held(g, t, dur, 0.22, 1.2, vol * 0.9);
    osc(V, 'sine', f, t, stop, g); osc(V, 'sine', f + 1.2, t, stop, g); const h = gain(V, g, 0.1); osc(V, 'sine', f * 2, t, stop, h);
  },
  keys(V, f, t, dur, vol, out) {
    // a tine: a sine with a quick FM bite that settles
    const g = gain(V, out), e = struck(g, t, 0.004, Math.max(1.4, dur + 0.8), vol * 1.2);
    const car = V.ctx.createOscillator(), mod = V.ctx.createOscillator(), mg = V.ctx.createGain();
    car.frequency.value = f; mod.frequency.value = f; mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.5);
    mod.connect(mg).connect(car.frequency); car.connect(g); car.start(t); mod.start(t); car.stop(e); mod.stop(e);
  },
};

/**
 * Play a note: `held` (a drone's or a pad's) looks among the held voices first. Returns false
 * for a kind it doesn't know (src/audio.js instrument() has the older ones).
 */
export function playVoice(V, kind, f, t, dur, vol, out, held = false) {
  const fn = held ? HELD[kind] ?? NOTES[kind] : NOTES[kind] ?? HELD[kind];
  if (!fn) return false;
  fn(V, f, t, dur, vol, out);
  return true;
}

// ------------------------------------------------------------------ percussion
function noiseHit(V, t, dur, type, f, q, vol, out, a = 0.001) {
  const g = gain(V, out), b = filt(V, type, f, q, g), e = struck(g, t, a, dur, vol);
  noise(V, t, e, b);
}
function thump(V, t, f0, f1, d, vol, out) {
  const g = gain(V, out), e = struck(g, t, 0.004, d, vol);
  const o = V.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d * 0.5); o.connect(g); o.start(t); o.stop(e);
}
const HITS = {
  dum: (V, t, v, out) => { thump(V, t, 130, 58, 0.4, v, out); noiseHit(V, t, 0.06, 'lowpass', 500, 1, v * 0.4, out); },
  tek: (V, t, v, out) => noiseHit(V, t, 0.05, 'bandpass', 2600, 1.2, v * 0.8, out),
  ka: (V, t, v, out) => noiseHit(V, t, 0.03, 'bandpass', 3600, 1.4, v * 0.6, out),
  darbuka: (V, t, v, out) => { thump(V, t, 115, 72, 0.35, v * 1.1, out); noiseHit(V, t, 0.05, 'lowpass', 700, 1, v * 0.3, out); },
  clap: (V, t, v, out) => { for (let i = 0; i < 3; i++) noiseHit(V, t + i * 0.012, 0.04, 'bandpass', 1500, 1.2, v * 0.7, out); },
  brush: (V, t, v, out) => noiseHit(V, t, 0.18, 'bandpass', 5200, 0.6, v * 0.45, out, 0.02),
  hat: (V, t, v, out) => noiseHit(V, t, 0.04, 'highpass', 7000, 0.8, v * 0.35, out),
  shaker: (V, t, v, out) => noiseHit(V, t, 0.07, 'highpass', 6000, 0.7, v * 0.35, out, 0.015),
  tick: (V, t, v, out) => noiseHit(V, t, 0.02, 'highpass', 3200, 1, v * 0.7, out),
  tock: (V, t, v, out) => { thump(V, t, 900, 820, 0.06, v * 0.6, out); noiseHit(V, t, 0.015, 'highpass', 2500, 1, v * 0.4, out); },
  clank: (V, t, v, out) => { partials(V, 170, t, [[1, 0.5, 0.7], [2.76, 0.3, 0.45], [5.4, 0.15, 0.25]], v, out, 0.002); noiseHit(V, t, 0.12, 'lowpass', 400, 1, v * 0.6, out); },
  tink: (V, t, v, out) => partials(V, 1500, t, [[1, 0.4, 0.3], [2.76, 0.2, 0.15]], v, out, 0.001),
  drop: (V, t, v, out) => {
    const f = 700 + Math.random() * 500, g = gain(V, out), e = struck(g, t, 0.002, 0.14, v * 0.8);
    const o = V.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.1, t + 0.06); o.connect(g); o.start(t); o.stop(e);
  },
  log: (V, t, v, out) => { thump(V, t, 190, 165, 0.35, v * 0.9, out); thump(V, t, 285, 270, 0.2, v * 0.4, out); },
  knock: (V, t, v, out) => { thump(V, t, 430, 380, 0.09, v * 0.6, out); noiseHit(V, t, 0.02, 'bandpass', 1300, 1.5, v * 0.3, out); },
  block: (V, t, v, out) => { thump(V, t, 1150, 1100, 0.06, v * 0.5, out); noiseHit(V, t, 0.012, 'highpass', 3000, 1, v * 0.3, out); },
};

/** One percussion hit. */
export function hit(V, kind, t, vol, out) {
  (HITS[kind] ?? HITS.tek)(V, t, vol, out);
}

// ------------------------------------------------------------------ colours: each world's own sound now and then
const COLOURS = {
  // a great bell far off: its hum, prime, minor third, fifth and nominal, through distance
  toll(V, f, t, vol, out) {
    const lp = filt(V, 'lowpass', 1800, 0.5, out);
    partials(V, f * 2, t, [[0.5, 0.5, 7], [1, 0.6, 5.5], [1.19, 0.3, 4], [1.5, 0.15, 3], [2, 0.25, 2.5], [2.98, 0.08, 1.2]], vol * 1.4, lp, 0.006);
  },
  // the Lodestar overhead: three high glass notes swelling together
  shimmer(V, f, t, vol, out) {
    for (const [m, k] of [[1, 1], [1.5, 0.7], [2, 0.45]]) { const g = gain(V, out), stop = held(g, t, 2, 2, 3, vol * 0.6 * k); osc(V, 'sine', f * m, t, stop, g); osc(V, 'sine', f * m + 1.5, t, stop, g); }
  },
  // the bird's far cry: a falling glide, and a shorter one
  cry(V, f, t, vol, out) {
    const lp = filt(V, 'lowpass', 2600, 0.5, out);
    for (const [dt, len, k] of [[0, 1.0, 1], [1.3, 0.6, 0.6]]) {
      const s = t + dt, g = gain(V, lp), e = struck(g, s, 0.08, len, vol * 0.8 * k);
      const o = V.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f, s); o.frequency.exponentialRampToValueAtTime(f * 0.74, s + len); o.connect(g); o.start(s); o.stop(e);
    }
  },
  // the Hangar's signal: three short blips nobody can read
  signal(V, f, t, vol, out) {
    const bp = filt(V, 'bandpass', 1400, 4, out);
    for (let k = 0; k < 3; k++) { const s = t + k * 0.19, g = gain(V, bp); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol * 1.4, s + 0.005); g.gain.setValueAtTime(vol * 1.4, s + 0.05); g.gain.linearRampToValueAtTime(0, s + 0.06); osc(V, 'square', 1400, s, s + 0.08, g); }
  },
  // the wheel's tooth: a deep groan, then the clank as it drops into place
  tooth(V, f, t, vol, out) {
    const g = gain(V, out), lp = filt(V, 'lowpass', 260, 1.5, g), stop = held(g, t, 1.4, 0.6, 0.4, vol * 1.6);
    const o = V.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.93, t + 2); o.connect(lp); o.start(t); o.stop(stop);
    HITS.clank(V, t + 2.1, vol * 1.6, out);
  },
  // the water clock tips: one small bell
  ding(V, f, t, vol, out) { NOTES.handbell(V, f / 2, t, 1, vol, out); },
  // an egg, a lamp, a pool glowing alight: a soft pop and a note rising into place
  glow(V, f, t, vol, out) {
    const g = gain(V, out), e = struck(g, t, 0.25, 1.6, vol * 0.8);
    const o = V.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 0.5, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.3); o.connect(g); o.start(t); o.stop(e);
    HITS.drop(V, t, vol * 0.4, out);
  },
  // the market's towers: a call sign (short, short, long) through a radio's band, and its hiss
  radio(V, f, t, vol, out) {
    const bp = filt(V, 'bandpass', 1800, 5, out);
    let s = t;
    for (const len of [0.05, 0.05, 0.16]) { const g = gain(V, bp); g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(vol * 1.1, s + 0.005); g.gain.setValueAtTime(vol * 1.1, s + len); g.gain.linearRampToValueAtTime(0, s + len + 0.01); osc(V, 'square', 1800, s, s + len + 0.03, g); s += len + 0.09; }
    noiseHit(V, t, 0.5, 'bandpass', 2400, 0.8, vol * 0.25, out, 0.05);
  },
  // a pencil on paper
  pencil(V, f, t, vol, out) {
    for (let k = 0; k < 3; k++) noiseHit(V, t + k * 0.22 + Math.random() * 0.05, 0.16 + Math.random() * 0.1, 'bandpass', 3000 + Math.random() * 800, 0.8, vol * 0.6, out, 0.03);
  },
  // a music box, three notes falling (degrees passed in as frequencies)
  musicbox(V, f, t, vol, out, freqs = [f]) {
    freqs.forEach((fr, k) => partials(V, fr * 2, t + k * 0.32, [[1, 0.6, 1.1], [4, 0.15, 0.3]], vol, out, 0.002));
  },
};

/** A world's colour. `freqs`: a short run of notes for the ones that play a figure. Returns false if unknown. */
export function playColour(V, kind, f, t, vol, out, freqs) {
  const fn = COLOURS[kind];
  if (!fn) return false;
  fn(V, f, t, vol, out, freqs);
  return true;
}

/** Every voice, hit and colour this module plays (for tests: every score's palette is here). */
export const KINDS = { notes: Object.keys(NOTES), held: Object.keys(HELD), hits: Object.keys(HITS), colours: Object.keys(COLOURS) };
