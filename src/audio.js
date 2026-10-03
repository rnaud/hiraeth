// Procedural sound: generative music per level + ambience + effects, all
// synthesised with Web Audio (no audio files). Starts on the first click or
// key press (browsers require a gesture). M mutes.

const PROFILES = {
  bazaar: { root: 164.81, scale: [0,2,4,6,7,9,11], tempo: 88, pad: 'triangle', arp: 'sine', prog: [0,3,1,4], density: .55, ground: 'stone' },
  // root (Hz), scale (semitones), tempo, waveforms, chord roots (scale degrees), arpeggio density
  desert:  { root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], tempo: 66, pad: 'triangle', arp: 'triangle', prog: [0, 5, 3, 4], density: 0.45, ground: 'sand' },
  incal:   { root: 174.61, scale: [0, 2, 4, 6, 7, 9, 11], tempo: 84, pad: 'sawtooth', arp: 'square', prog: [0, 1, 4, 0], density: 0.6, ground: 'stone' },
  arzach:  { root: 110.0, scale: [0, 3, 5, 7, 10], tempo: 50, pad: 'sine', arp: 'sine', prog: [0, 0, 3, 4], density: 0.25, ground: 'sand' },
  garage:  { root: 130.81, scale: [0, 2, 4, 6, 8, 10], tempo: 92, pad: 'square', arp: 'sawtooth', prog: [0, 2, 4, 1], density: 0.55, ground: 'stone' },
  edena:   { root: 196.0, scale: [0, 2, 4, 7, 9], tempo: 72, pad: 'triangle', arp: 'sine', prog: [0, 3, 4, 2], density: 0.5, ground: 'grass' },
  perdide: { root: 164.81, scale: [0, 1, 3, 5, 7, 8, 10], tempo: 56, pad: 'sine', arp: 'triangle', prog: [0, 1, 0, 5], density: 0.35, ground: 'grass' },
  arzach2: { root: 116.54, scale: [0, 3, 5, 7, 10], tempo: 46, pad: 'sine', arp: 'sine', prog: [0, 3, 0, 4], density: 0.22, ground: 'stone' },
  buried:  { root: 123.47, scale: [0, 2, 3, 6, 7, 8, 11], tempo: 70, pad: 'triangle', arp: 'square', prog: [0, 4, 1, 3], density: 0.4, ground: 'sand' },
  spheres: { root: 220.0, scale: [0, 2, 4, 7, 9], tempo: 64, pad: 'triangle', arp: 'sine', prog: [0, 4, 3, 2], density: 0.42, ground: 'grass' },
  perdide2: { root: 155.56, scale: [0, 1, 3, 5, 7, 8, 10], tempo: 52, pad: 'sine', arp: 'triangle', prog: [0, 5, 1, 0], density: 0.3, ground: 'grass' },
  atelier: { root: 130.81, scale: [0, 2, 4, 5, 7, 9, 11], tempo: 60, pad: 'sine', arp: 'sine', prog: [0, 3, 5, 4], density: 0.3, ground: 'stone' },
};

// Each world's own voice: the lead instrument, its recurring melody (a phrase
// of [scale degree, beats], played every 16 beats, varied each time), the
// pluck colour, and the ambience bed.
const VOICES = {
  bazaar: { lead: 'reed', pluck: 'celesta', ambience: 'city', melody: [[0,1],[4,1],[6,2],[5,1],[2,1],[4,2],[null,1],[1,1],[0,2]] },
  desert:  { lead: 'duduk', pluck: 'kalimba', ambience: 'wind',
    melody: [[4, 2], [3, 1], [2, 1], [0, 3], [null, 1], [2, 1], [3, 1], [4, 1], [6, 2], [4, 3]] },
  incal:   { lead: 'reed', pluck: 'marimba', ambience: 'city',
    melody: [[0, 1], [2, 1], [4, 1], [6, 2], [5, 1], [4, 1], [2, 2], [null, 1], [4, 1], [3, 1], [1, 3]] },
  arzach:  { lead: 'flute', pluck: 'kalimba', ambience: 'highwind',
    melody: [[2, 3], [1, 1], [0, 4], [null, 2], [3, 2], [4, 4]] },
  garage:  { lead: 'synth', pluck: 'synth', ambience: 'machine',
    melody: [[0, 0.5], [2, 0.5], [4, 0.5], [6, 0.5], [7, 1], [4, 1], [5, 0.5], [3, 0.5], [1, 2]] },
  edena:   { lead: 'strings', pluck: 'celesta', ambience: 'birds',
    melody: [[4, 1], [5, 1], [7, 2], [5, 1], [4, 1], [2, 2], [null, 1], [2, 1], [4, 1], [3, 3]] },
  perdide: { lead: 'bell', pluck: 'bell', ambience: 'swamp',
    melody: [[0, 2], [5, 2], [4, 1], [2, 1], [1, 4], [null, 2], [0, 4]] },
  arzach2: { lead: 'flute', pluck: 'kalimba', ambience: 'highwind', melody: [[4, 3], [2, 1], [3, 4], [null, 2], [1, 2], [0, 4]] },
  buried:  { lead: 'reed', pluck: 'marimba', ambience: 'machine', melody: [[0, 2], [3, 1], [2, 1], [6, 3], [null, 1], [4, 1], [3, 1], [0, 3]] },
  spheres: { lead: 'strings', pluck: 'celesta', ambience: 'birds', melody: [[2, 1], [4, 1], [5, 2], [4, 1], [2, 1], [0, 2], [null, 1], [1, 1], [2, 3]] },
  perdide2: { lead: 'bell', pluck: 'bell', ambience: 'swamp', melody: [[0, 3], [2, 1], [1, 2], [5, 2], [null, 2], [4, 1], [0, 4]] },
  atelier: { lead: 'flute', pluck: 'celesta', ambience: 'paper',
    melody: [[0, 2], [2, 1], [4, 1], [7, 3], [6, 1], [4, 4]] },
};

export class Sound {
  constructor(levelId) {
    this.profile = PROFILES[levelId] ?? PROFILES.desert;
    this.voice = VOICES[levelId] ?? VOICES.desert;
    this.phrase = 0;
    this.ctx = null;
    this.muted = localStorage.getItem('moebius.muted') === '1';
    this.musicVol = 0.8;
    this.fxVol = 1.0;
    const start = () => this.start();
    window.addEventListener('pointerdown', start, { once: false });
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') this.toggleMute(); else start(); });
  }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    this.master.connect(comp).connect(ctx.destination);

    // reverb: a generated decaying-noise impulse
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    this.music = ctx.createGain(); this.music.gain.value = 0.62 * this.musicVol;
    this.music.connect(this.master);
    this.musicSend = ctx.createGain(); this.musicSend.gain.value = 0.7;
    this.music.connect(this.musicSend).connect(this.reverb);
    this.fx = ctx.createGain(); this.fx.gain.value = 1.6 * this.fxVol;
    this.fx.connect(this.master);
    this.fxSend = ctx.createGain(); this.fxSend.gain.value = 0.25;
    this.fx.connect(this.fxSend).connect(this.reverb);

    // level meters (RMS in dBFS) on each bus, for balancing the mix
    this.meters = {};
    for (const [name, node] of [['music', this.music], ['fx', this.fx], ['master', this.master]]) {
      const an = ctx.createAnalyser(); an.fftSize = 2048;
      node.connect(an);
      this.meters[name] = an;
    }

    // shared noise
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;

    // continuous layers: wind (two bands), rain, cloak flutter, jetpack, engine
    this.layers = {
      wind: this.noiseLayer('bandpass', 520, 0.6),
      howl: this.noiseLayer('bandpass', 900, 9),
      rain: this.noiseLayer('highpass', 2600, 0.5),
      cloak: this.noiseLayer('bandpass', 240, 1.2),
      jet: this.noiseLayer('lowpass', 320, 0.7),
    };
    const eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 50;
    const engF = ctx.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 400;
    const engG = ctx.createGain(); engG.gain.value = 0;
    eng.connect(engF).connect(engG).connect(this.fx);
    eng.start();
    this.engine = { osc: eng, filter: engF, gain: engG };

    this.beat = 0;
    this.nextBeat = ctx.currentTime + 0.3;
    this.chord = 0;
    this.scheduler = setInterval(() => this.schedule(), 100);
  }

  /** Current RMS level of each bus in dBFS (-Infinity when silent). */
  levels() {
    const out = {};
    const buf = new Float32Array(2048);
    for (const [k, an] of Object.entries(this.meters ?? {})) {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      out[k] = 10 * Math.log10(sum / buf.length + 1e-12);
    }
    return out;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('moebius.muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  setVolumes(music, fx) {
    this.musicVol = music; this.fxVol = fx;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(0.62 * music, this.ctx.currentTime, 0.2);
    this.fx.gain.setTargetAtTime(1.6 * fx, this.ctx.currentTime, 0.2);
  }

  noiseLayer(type, freq, q) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.fx);
    src.start();
    return { f, g };
  }

  set(layer, gain, freq) {
    if (!this.ctx) return;
    const l = this.layers[layer], t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(gain, t, 0.15);
    if (freq) l.f.frequency.setTargetAtTime(freq, t, 0.2);
  }

  // ------------------------------------------------------------------ music
  freq(degree, octave = 0) {
    const S = this.profile.scale, n = S.length;
    const o = Math.floor(degree / n), d = ((degree % n) + n) % n;
    return this.profile.root * Math.pow(2, (S[d] + 12 * (o + octave)) / 12);
  }

  schedule() {
    const ctx = this.ctx, P = this.profile, spb = 60 / P.tempo;
    while (this.nextBeat < ctx.currentTime + 0.4) {
      const t = this.nextBeat;
      if (this.beat % 8 === 0) {           // new chord every 8 beats: pad + bass
        const root = P.prog[(this.beat / 8) % P.prog.length];
        this.chord = root;
        for (const k of [0, 2, 4]) this.pad(this.freq(root + k), t, spb * 8.5);
        this.bass(this.freq(root, -1), t, spb * 8);
      }
      if (this.beat % 16 === 4) this.playPhrase(t, spb);   // the world's melody, every 16 beats
      if (Math.random() < P.density * (this.beat % 16 < 4 ? 1 : 0.55)) {      // sparse arpeggio, quieter under the melody
        const deg = this.chord + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)];
        this.instrument(this.voice.pluck, this.freq(deg, 1), t + (Math.random() < 0.3 ? spb / 2 : 0), 0.4, 0.07);
      }
      this.ambienceTick(t, spb);
      this.beat++;
      this.nextBeat += spb;
    }
  }

  // ------------------------------------------------------------------ voices
  playPhrase(t, spb) {
    const M = this.voice.melody, n = this.phrase++;
    const shift = [0, 0, 2, -1][n % 4];        // a varied answer every few phrases
    const oct = n % 3 === 2 ? 1 : 0;
    let tt = t;
    for (const [deg, beats] of M) {
      if (deg !== null && !(n % 5 === 4 && Math.random() < 0.3)) this.instrument(this.voice.lead, this.freq(deg + shift, oct), tt, beats * spb, 0.11);
      tt += beats * spb;
    }
  }

  /** One note of a named instrument. dur in seconds. */
  instrument(kind, f, t, dur, vol) {
    const ctx = this.ctx, out = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = Math.random() * 0.8 - 0.4; out.connect(pan).connect(this.music); } else out.connect(this.music);
    const env = (g, a, d, peak, sustain = 0) => {
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
      if (sustain) { g.gain.setValueAtTime(peak, t + Math.max(a, dur - d)); g.gain.linearRampToValueAtTime(0, t + dur + d); }
      else g.gain.exponentialRampToValueAtTime(0.0005, t + a + d);
    };
    const osc = (type, freq, dest, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(t + dur + 3); return o; };
    const vib = (o, rate, depth) => { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rate; lg.gain.value = depth; l.connect(lg).connect(o.frequency); l.start(t + 0.15); l.stop(t + dur + 3); };
    const filt = (type, fr, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = fr; b.Q.value = q; b.connect(out); return b; };
    if (kind === 'duduk' || kind === 'reed') {          // breathy double reed / clarinet-ish
      const b = filt('lowpass', kind === 'duduk' ? 1400 : 2200, 2);
      const o = osc(kind === 'duduk' ? 'sawtooth' : 'square', f, b); vib(o, 5, f * 0.006);
      env(out, 0.12, 0.25, vol, true);
    } else if (kind === 'flute') {                       // sine + breath noise
      const o = osc('sine', f, out); vib(o, 5.5, f * 0.005);
      osc('triangle', f * 2, out).frequency.value = f * 2;
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; const nb = ctx.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = f * 2; nb.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = 0.25; n.connect(nb).connect(ng).connect(out); n.start(t); n.stop(t + dur + 0.5);
      env(out, 0.15, 0.3, vol * 0.9, true);
    } else if (kind === 'strings') {                     // detuned saws, slow bow
      const b = filt('lowpass', 1800, 0.5);
      for (const d of [-9, 0, 8]) vib(osc('sawtooth', f, b, d), 4.5, f * 0.004);
      env(out, 0.35, 0.6, vol * 0.55, true);
    } else if (kind === 'synth') {                       // bright analog lead
      const b = filt('lowpass', 2600, 6);
      osc('sawtooth', f, b, -6); osc('square', f / 2, b, 4);
      env(out, 0.01, 0.12, vol * 0.7, true);
    } else if (kind === 'bell') {                        // FM bell
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
      car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.5, t); mg.gain.exponentialRampToValueAtTime(1, t + 2.5);
      mod.connect(mg).connect(car.frequency); car.connect(out);
      car.start(t); mod.start(t); car.stop(t + 4); mod.stop(t + 4);
      env(out, 0.005, 2.6, vol * 0.8);
    } else if (kind === 'marimba') {
      osc('sine', f, out); osc('sine', f * 4, out).detune.value = 3;
      env(out, 0.003, 0.5, vol);
    } else if (kind === 'celesta') {
      osc('sine', f * 2, out); osc('triangle', f * 4, out);
      env(out, 0.003, 1.0, vol * 0.7);
    } else {                                             // kalimba (default pluck)
      const b = filt('lowpass', 2400, 1);
      osc('triangle', f, b); osc('sine', f * 2.01, b);
      env(out, 0.004, 0.9, vol);
    }
  }

  // ------------------------------------------------------------------ ambience beds
  ambienceTick(t, spb) {
    const A = this.voice.ambience, R = Math.random();
    if (A === 'birds' && R < 0.35) {                     // little chirps, in twos and threes
      const base = 2400 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.chirp(t + i * 0.09 + Math.random() * spb, base * (1 + (Math.random() - 0.5) * 0.2), 0.05);
    } else if (A === 'city') {
      if (R < 0.08) this.horn(t + Math.random() * spb);
      if (R > 0.6) this.burst(t + Math.random() * spb, { dur: 1.4, type: 'bandpass', freq: 300 + Math.random() * 200, q: 0.8, vol: 0.05, rate: 0.5 });   // a taxi passing
    } else if (A === 'swamp') {
      if (R < 0.3) this.croak(t + Math.random() * spb);
      if (R > 0.75) this.burst(t, { dur: 0.6, type: "bandpass", freq: 5200, q: 6, vol: 0.006 });   // insects
    } else if (A === 'machine') {
      for (let i = 0; i < 2; i++) this.burst(t + i * spb / 2, { dur: 0.03, type: 'highpass', freq: 3000, q: 1, vol: 0.06 });   // ticking gears
      if (R < 0.1) this.burst(t, { dur: 0.5, type: 'lowpass', freq: 140, q: 1, vol: 0.18, rate: 0.4 });                       // a piston thump
    } else if (A === 'highwind' && R < 0.12) {
      this.burst(t, { dur: 3, type: 'bandpass', freq: 600 + Math.random() * 500, q: 4, vol: 0.06, rate: 0.6 });
    } else if (A === 'paper' && R < 0.15) {
      this.burst(t + Math.random() * spb, { dur: 0.4, type: 'highpass', freq: 2500, q: 0.6, vol: 0.03, rate: 0.7 });
    }
  }

  chirp(t, f, vol) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.06);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
    o.connect(g).connect(this.fx); o.start(t); o.stop(t + 0.1);
  }

  horn(t) {
    const ctx = this.ctx, g = ctx.createGain(), b = ctx.createBiquadFilter();
    b.type = 'lowpass'; b.frequency.value = 900; g.gain.value = 0;
    for (const f of [233, 294]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(b); o.start(t); o.stop(t + 0.7); }
    b.connect(g).connect(this.fx);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.6);
  }

  croak(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 90 + Math.random() * 60;
    // tremolo on a separate gain stage, scaled to the croak (not added to its envelope)
    const trem = ctx.createGain(); trem.gain.value = 0.6;
    am.frequency.value = 28; ag.gain.value = 0.4; am.connect(ag).connect(trem.gain);
    const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = 500;
    o.connect(b).connect(trem).connect(g).connect(this.fx);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.009, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.35);
    o.start(t); am.start(t); o.stop(t + 0.4); am.stop(t + 0.4);
  }

  pad(f, t, dur) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = this.profile.pad === 'sawtooth' || this.profile.pad === 'square' ? 900 : 2400;
    g.connect(flt).connect(this.music);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = this.profile.pad; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 3);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 2.2);
    g.gain.setValueAtTime(0.07, t + dur - 1);
    g.gain.linearRampToValueAtTime(0, t + dur + 2.5);
  }

  bass(f, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(this.music);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 1); g.gain.linearRampToValueAtTime(0, t + dur + 1);
    o.start(t); o.stop(t + dur + 1.2);
  }

  pluck(f, t, vol = 0.09, type = this.profile.arp, bus = this.music) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2200;
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 1.4 - 0.7;
    o.connect(flt).connect(g);
    (pan ? g.connect(pan) : g).connect(bus);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 1.6);
    o.start(t); o.stop(t + 1.7);
  }

  // ------------------------------------------------------------------ effects
  burst(t, { dur = 0.08, type = 'lowpass', freq = 700, q = 0.7, vol = 0.2, rate = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(this.fx);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  step(speed = 5) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, k = Math.min(speed / 11, 1);
    const g = this.profile.ground;
    if (g === 'stone') this.burst(t, { dur: 0.05, type: 'bandpass', freq: 1700 + Math.random() * 600, q: 2, vol: 0.12 + 0.12 * k });
    else if (g === 'grass') this.burst(t, { dur: 0.09, type: 'bandpass', freq: 2600 + Math.random() * 800, q: 0.8, vol: 0.05 + 0.06 * k });
    else this.burst(t, { dur: 0.11, type: 'lowpass', freq: 600 + Math.random() * 300, q: 0.7, vol: 0.12 + 0.14 * k });
  }

  flap() {
    if (!this.ctx) return;
    this.burst(this.ctx.currentTime, { dur: 0.25, type: 'lowpass', freq: 380, q: 0.5, vol: 0.25, rate: 0.6 });
  }

  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 2, 4, 7].forEach((d, i) => this.pluck(this.freq(d, 2), t + i * 0.12, 0.12, 'sine', this.fx));
  }

  page() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 0.35, type: 'bandpass', freq: 3200, q: 0.6, vol: 0.12, rate: 0.8 });
  }

  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(3000, t + 1.2);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.6); g.gain.linearRampToValueAtTime(0, t + 1.4);
    src.connect(f).connect(g).connect(this.fx);
    src.start(t); src.stop(t + 1.5);
    [0, 4, 7, 11].forEach((d, i) => this.pluck(this.freq(d, 1), t + 0.2 + i * 0.15, 0.08, 'triangle', this.fx));
  }

  /** Wildlife: a small sound for a creature's surprise (vol 0..1, by distance). */
  critter(kind = 'squeak', vol = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime, v = Math.max(0, Math.min(1, vol));
    const sweep = (f0, f1, dur, type = 'sine', g0 = 0.05, wobble = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      if (wobble) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = wobble; lg.gain.value = f0 * 0.08; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(g0 * v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g).connect(this.fx); o.start(t); o.stop(t + dur + 0.05);
    };
    const noise = (o) => this.burst(t + (o.at ?? 0), { ...o, vol: (o.vol ?? 0.1) * v });
    switch (kind) {
      case 'inflate': sweep(300, 1400, 0.9, 'triangle', 0.04, 9); break;                                  // a balloon squeak
      case 'boing': sweep(180, 620, 0.35, 'triangle', 0.05, 14); break;
      case 'portal': sweep(900, 220, 0.5, 'sine', 0.05, 30); sweep(450, 1800, 0.4, 'sine', 0.025); break;
      case 'chime': case 'bloom': [0, 4, 7].forEach((d, i) => this.pluck(this.freq(d, 2), t + i * 0.09, 0.05 * v, 'sine', this.fx)); break;
      case 'jet': case 'whirr': noise({ dur: 1.1, type: 'bandpass', freq: kind === 'jet' ? 900 : 2400, q: 2, vol: 0.12, rate: 1.4 }); sweep(220, 900, 1, 'sawtooth', 0.012); break;
      case 'clank': case 'clack': case 'blip': noise({ dur: 0.07, type: 'bandpass', freq: kind === 'clank' ? 1300 : kind === 'clack' ? 2200 : 3400, q: 6, vol: 0.18 }); if (kind === 'blip') sweep(1200, 1600, 0.12, 'square', 0.015); break;
      case 'splash': case 'skip': case 'plop': noise({ dur: 0.25, type: 'lowpass', freq: 1800, q: 0.6, vol: 0.12 }); sweep(kind === 'plop' ? 500 : 700, 160, 0.15, 'sine', 0.05); break;
      case 'poof': case 'puff': case 'spores': noise({ dur: kind === 'spores' ? 0.8 : 0.45, type: 'lowpass', freq: kind === 'spores' ? 2600 : 700, q: 0.5, vol: 0.16, rate: 0.7 }); break;
      case 'flutter': case 'scribble': for (let i = 0; i < 6; i++) noise({ at: i * 0.05, dur: 0.04, type: 'highpass', freq: kind === 'flutter' ? 3000 : 5000, q: 1, vol: 0.05 }); break;
      case 'creak': sweep(140, 90, 0.6, 'sawtooth', 0.012, 22); break;
      case 'daze': sweep(900, 260, 0.7, 'sine', 0.035, 11); break;                                       // a dazed wobble down
      case 'flash': sweep(2400, 600, 0.25, 'sine', 0.03); break;
      default: sweep(1300, 2300, 0.12, 'sine', 0.04); sweep(1700, 2900, 0.1, 'sine', 0.025);             // an alarmed squeak / pop
    }
  }

  /** Per frame: drive the continuous layers from the game state. */
  update(s) {
    if (!this.ctx) return;
    const k = Math.min(s.speed / 11, 1.5);
    this.set('wind', 0.03 + s.gust * 0.05 + s.storm * 0.11 + k * 0.03, 420 + s.gust * 300 + s.storm * 400);
    const highWind = this.voice.ambience === 'highwind' ? 0.03 : 0;
    this.set('howl', s.gust * 0.012 + s.storm * 0.025 + highWind + (s.altitude > 60 ? 0.02 : 0), 700 + Math.sin(this.ctx.currentTime * 0.3) * 250);
    this.set('wind', 0.03 + s.gust * 0.05 + s.storm * 0.11 + k * 0.03 + (this.voice.ambience === 'city' ? 0.02 : 0), 420 + s.gust * 300 + s.storm * 400);
    this.set('rain', s.rain * 0.07);
    this.set('cloak', s.riding ? 0.04 + k * 0.05 : Math.pow(Math.min(s.speed / 11, 1), 2) * 0.07);
    this.set('jet', s.thrusting ? 0.32 : 0);
    const e = this.engine, t = this.ctx.currentTime;
    const motor = s.rideKind === 'bike' || s.rideKind === 'skiff' || s.rideKind === 'taxi';
    e.gain.gain.setTargetAtTime(motor ? 0.035 : 0, t, 0.2);
    e.osc.frequency.setTargetAtTime(38 + Math.abs(s.rideSpeed) * 2.2, t, 0.2);
    e.filter.frequency.setTargetAtTime(250 + Math.abs(s.rideSpeed) * 25, t, 0.2);
  }
}
