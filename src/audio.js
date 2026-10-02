// Procedural sound: generative music per level + ambience + effects, all
// synthesised with Web Audio (no audio files). Starts on the first click or
// key press (browsers require a gesture). M mutes.

const PROFILES = {
  // root (Hz), scale (semitones), tempo, waveforms, chord roots (scale degrees), arpeggio density
  desert:  { root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], tempo: 66, pad: 'triangle', arp: 'triangle', prog: [0, 5, 3, 4], density: 0.45, ground: 'sand' },
  incal:   { root: 174.61, scale: [0, 2, 4, 6, 7, 9, 11], tempo: 84, pad: 'sawtooth', arp: 'square', prog: [0, 1, 4, 0], density: 0.6, ground: 'stone' },
  arzach:  { root: 110.0, scale: [0, 3, 5, 7, 10], tempo: 50, pad: 'sine', arp: 'sine', prog: [0, 0, 3, 4], density: 0.25, ground: 'sand' },
  garage:  { root: 130.81, scale: [0, 2, 4, 6, 8, 10], tempo: 92, pad: 'square', arp: 'sawtooth', prog: [0, 2, 4, 1], density: 0.55, ground: 'stone' },
  edena:   { root: 196.0, scale: [0, 2, 4, 7, 9], tempo: 72, pad: 'triangle', arp: 'sine', prog: [0, 3, 4, 2], density: 0.5, ground: 'grass' },
  perdide: { root: 164.81, scale: [0, 1, 3, 5, 7, 8, 10], tempo: 56, pad: 'sine', arp: 'triangle', prog: [0, 1, 0, 5], density: 0.35, ground: 'grass' },
};

export class Sound {
  constructor(levelId) {
    this.profile = PROFILES[levelId] ?? PROFILES.desert;
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
      if (Math.random() < P.density) {      // sparse arpeggio
        const deg = this.chord + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)];
        this.pluck(this.freq(deg, 1), t + (Math.random() < 0.3 ? spb / 2 : 0));
      }
      this.beat++;
      this.nextBeat += spb;
    }
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

  /** Per frame: drive the continuous layers from the game state. */
  update(s) {
    if (!this.ctx) return;
    const k = Math.min(s.speed / 11, 1.5);
    this.set('wind', 0.03 + s.gust * 0.05 + s.storm * 0.11 + k * 0.03, 420 + s.gust * 300 + s.storm * 400);
    this.set('howl', s.gust * 0.012 + s.storm * 0.025 + (s.altitude > 60 ? 0.02 : 0), 700 + Math.sin(this.ctx.currentTime * 0.3) * 250);
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
