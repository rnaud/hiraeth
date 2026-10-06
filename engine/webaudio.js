// Web Audio for an engine's VM (docs/systems/engine-bridge.md, "Sound"): the part of the API the game's
// synthesis uses (src/audio.js, score.js, score-voices.js, ship/sfx.js, story/voice.js), rendered in
// JavaScript into stereo PCM the engine plays. The game's own sound code runs unchanged: its
// oscillators, filters, envelopes and buses are these.
//
//   const ctx = new AudioContext();      // (installAudio puts it on globalThis)
//   …the game builds its graph…
//   ctx.render(frames) → Float32Array, interleaved L R, `frames` long: the next frames of the mix
//
// Rendered in blocks of 128 frames, pulled from the destination: each node computes a block once
// (memoised by block), sources outside their start / stop give nothing, and a chain whose sources
// have ended is dropped from the graph (it comes back if something is connected to it again: a bus).
// AudioParams follow the automation timeline as the spec does (set, linear and exponential ramps,
// setTarget, cancel), at block rate for the filters, per sample for gains and frequencies.
// Approximations: the convolver is a feedback-delay reverb with the impulse's length as its decay
// (a 3 s noise impulse convolved in JS would cost more than the rest of the game), the compressor a
// simple peak follower, the analyser gives the last block's samples.

const Q = 128;   // the render quantum

// ------------------------------------------------------------------ AudioParam
export class AudioParam {
  constructor(ctx, value, { min = -3.4e38, max = 3.4e38, rate = 'a' } = {}) {
    this.ctx = ctx; this._v = value; this.defaultValue = value; this.minValue = min; this.maxValue = max; this.rate = rate;
    this.events = [];   // sorted by time: { type, t, v, tc }
    this.inputs = [];   // nodes modulating it (their output summed in)
    this._buf = new Float32Array(Q); this._block = -1;
  }
  get value() { return this.events.length ? this.at(this.ctx.currentTime) : this._v; }
  // (setting value is a setValueAtTime now, as browsers do; with nothing scheduled, just the value)
  set value(v) { if (!Number.isFinite(v)) throw new TypeError('AudioParam: non-finite value'); if (!this.events.length) { this._v = v; return; } this.setValueAtTime(v, this.ctx.currentTime); }
  _add(e) {
    // (as browsers do: a non-finite value or time is a TypeError, not a NaN that silences the whole mix)
    if (!Number.isFinite(e.v) || !Number.isFinite(e.t)) throw new TypeError(`AudioParam: non-finite ${Number.isFinite(e.v) ? 'time' : 'value'}`);
    const i = this.events.findIndex((x) => x.t > e.t);
    if (i < 0) this.events.push(e); else this.events.splice(i, 0, e);
    return this;
  }
  setValueAtTime(v, t) { return this._add({ type: 'set', t, v }); }
  linearRampToValueAtTime(v, t) { return this._add({ type: 'lin', t, v }); }
  exponentialRampToValueAtTime(v, t) { return this._add({ type: 'exp', t, v }); }
  setTargetAtTime(v, t, tc) { return this._add({ type: 'target', t, v, tc: Math.max(tc, 1e-4) }); }
  setValueCurveAtTime(curve, t, dur) { const n = curve.length; for (let i = 0; i < n; i++) this._add({ type: i ? 'lin' : 'set', t: t + (dur * i) / Math.max(n - 1, 1), v: curve[i] }); return this; }
  cancelScheduledValues(t) { this.events = this.events.filter((e) => e.t < t); return this; }
  cancelAndHoldAtTime(t) { const v = this.at(t); this.cancelScheduledValues(t); return this.setValueAtTime(v, t); }

  /** The value at time t (the spec's timeline: each event from the value and time the one before left). */
  at(t) {
    const E = this.events;
    // what is past folds into the first event (the game sets its targets every frame: thousands would pile up):
    // once the next event has begun, the one before only says what value it began from (`_v`, the value
    // standing before the first event)
    while (E.length > 1 && E[1].t <= t) {
      const a = E[0], b = E[1];
      const v = a.type === 'target' ? a.v + (this._v - a.v) * Math.exp(-(b.t - a.t) / a.tc) : a.v;
      E.shift();
      if (b.type === 'target') this._v = v;
      else E[0] = { type: 'set', t: b.t, v: b.v };   // (a set, or a ramp that has reached its value)
    }
    let v = this._v, tp = -Infinity, target = null;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (target) {
        const until = Math.min(e.t, t);
        v = target.v + (v - target.v) * Math.exp(-(until - tp) / target.tc); tp = until;
        target = null;
        if (e.t > t) return v;
      }
      if (e.t > t) {
        if (tp === -Infinity) return v;
        if (e.type === 'lin') return v + (e.v - v) * ((t - tp) / Math.max(e.t - tp, 1e-9));
        if (e.type === 'exp') { const a = v, z = e.v; if (a === 0 || a * z <= 0) return v; return a * Math.pow(z / a, (t - tp) / Math.max(e.t - tp, 1e-9)); }
        return v;
      }
      if (e.type === 'target') { target = e; tp = e.t; continue; }
      v = e.v; tp = e.t;
    }
    if (target) v = target.v + (v - target.v) * Math.exp(-(t - tp) / target.tc);
    return v;
  }

  /** This block's values (per sample), with the modulating inputs summed in. */
  block(b) {
    if (this._block === b) return this._buf;
    this._block = b;
    const buf = this._buf, ctx = this.ctx, t0 = b * Q / ctx.sampleRate, dt = 1 / ctx.sampleRate;
    if (!this.events.length) buf.fill(this._v);
    else if (this.rate === 'k') buf.fill(this.at(t0));
    else {
      // (the timeline at the block's ends and middle, interpolated: exact for linear ramps, close for the others)
      const a = this.at(t0), m = this.at(t0 + (Q / 2) * dt), z = this.at(t0 + (Q - 1) * dt);
      if (a === z && a === m) buf.fill(a);
      else for (let i = 0; i < Q; i++) { const u = i / (Q - 1); buf[i] = u < 0.5 ? a + (m - a) * (u * 2) : m + (z - m) * (u * 2 - 1); }
    }
    for (const n of this.inputs) { const o = n.output(b); if (o) for (let i = 0; i < Q; i++) buf[i] += (o[0][i] + o[1][i]) * 0.5; }
    return buf;
  }
}

// ------------------------------------------------------------------ nodes
let nodeIds = 0;
export class AudioNode {
  constructor(ctx) {
    this.context = ctx; this.id = ++nodeIds;
    this.inputs = new Set();     // nodes feeding it
    this.outputs = new Set();    // nodes / params it feeds
    this.dormant = new Set();    // where it was dropped from while silent (back on its next input)
    this._out = [new Float32Array(Q), new Float32Array(Q)]; this._block = -1; this._silent = true;
    this.numberOfInputs = 1; this.numberOfOutputs = 1; this.channelCount = 2;
  }
  connect(dest) {
    if (dest instanceof AudioParam) { dest.inputs.push(this); this.outputs.add(dest); return dest; }
    if (!dest) return dest;
    dest.inputs.add(this); this.outputs.add(dest);
    dest._wake();
    return dest;
  }
  disconnect(dest) {
    const all = dest ? [dest] : [...this.outputs];
    for (const d of all) {
      if (d instanceof AudioParam) d.inputs = d.inputs.filter((n) => n !== this);
      else d.inputs.delete(this);
      this.outputs.delete(d); this.dormant.delete(d);
    }
  }
  /** Something new feeds it: back into the graphs it was dropped from. */
  _wake() { for (const d of this.dormant) { d.inputs.add(this); d._wake?.(); } this.dormant.clear(); }
  /** Has it nothing more to give (its sources ended, nothing ringing)? */
  done(b) { return false; }
  /** The block's stereo output, or null for silence. */
  output(b) {
    if (this._block === b) return this._silent ? null : this._out;
    this._block = b;
    this._silent = !this.process(b, this._out);
    return this._silent ? null : this._out;
  }
  /** Sum of the inputs into out; false if all silent. Drops the inputs that are done. */
  mix(b, out) {
    let any = false;
    out[0].fill(0); out[1].fill(0);
    for (const n of this.inputs) {
      const o = n.output(b);
      if (o) { any = true; const L = out[0], R = out[1], a = o[0], c = o[1]; for (let i = 0; i < Q; i++) { L[i] += a[i]; R[i] += c[i]; } }
      else if (n.done(b)) { this.inputs.delete(n); n.dormant.add(this); }
    }
    return any;
  }
  process(b, out) { return this.mix(b, out); }
}

/** A node that keeps going while it has inputs, and is done when they are all gone. */
class Through extends AudioNode {
  done(b) { return this.inputs.size === 0 && this.tailUntil <= b; }
  get tailUntil() { return this._tail ?? -1; }
}

export class GainNode extends Through {
  constructor(ctx) { super(ctx); this.gain = new AudioParam(ctx, 1); }
  process(b, out) {
    if (!this.mix(b, out)) return false;
    const g = this.gain.block(b), L = out[0], R = out[1];
    for (let i = 0; i < Q; i++) { L[i] *= g[i]; R[i] *= g[i]; }
    return true;
  }
}

export class StereoPannerNode extends Through {
  constructor(ctx) { super(ctx); this.pan = new AudioParam(ctx, 0, { min: -1, max: 1 }); }
  process(b, out) {
    if (!this.mix(b, out)) return false;
    const p = this.pan.block(b), L = out[0], R = out[1];
    for (let i = 0; i < Q; i++) {
      const x = Math.min(Math.max(p[i], -1), 1), m = (L[i] + R[i]) * 0.5, a = (x + 1) * Math.PI / 4;
      L[i] = m * Math.cos(a) * 1.4142; R[i] = m * Math.sin(a) * 1.4142;
    }
    return true;
  }
}

export class BiquadFilterNode extends Through {
  constructor(ctx) {
    super(ctx);
    this.type = 'lowpass';
    this.frequency = new AudioParam(ctx, 350, { rate: 'k' }); this.Q = new AudioParam(ctx, 1, { rate: 'k' });
    this.gain = new AudioParam(ctx, 0, { rate: 'k' }); this.detune = new AudioParam(ctx, 0, { rate: 'k' });
    this._z = [[0, 0, 0, 0], [0, 0, 0, 0]];
  }
  _coef(b) {
    const sr = this.context.sampleRate;
    const f = Math.min(Math.max(this.frequency.block(b)[0] * Math.pow(2, this.detune.block(b)[0] / 1200), 1), sr / 2 - 1);
    const q = Math.max(this.Q.block(b)[0], 1e-4), w = 2 * Math.PI * f / sr, cw = Math.cos(w), sw = Math.sin(w);
    const A = Math.pow(10, this.gain.block(b)[0] / 40);
    let b0, b1, b2, a0, a1, a2;
    const alpha = sw / (2 * q);
    switch (this.type) {
      case 'highpass': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'bandpass': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'allpass': b0 = 1 - alpha; b1 = -2 * cw; b2 = 1 + alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'peaking': b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
      case 'lowshelf': { const s = 2 * Math.sqrt(A) * alpha; b0 = A * ((A + 1) - (A - 1) * cw + s); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s); a0 = (A + 1) + (A - 1) * cw + s; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s; break; }
      case 'highshelf': { const s = 2 * Math.sqrt(A) * alpha; b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s); a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s; break; }
      default: b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;   // lowpass
    }
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  process(b, out) {
    const live = this.mix(b, out);
    const z = this._z;
    if (!live) {
      // (ringing out: a few blocks of the filter's own memory)
      if (Math.abs(z[0][2]) + Math.abs(z[0][3]) + Math.abs(z[1][2]) + Math.abs(z[1][3]) < 1e-6) return false;
    }
    const [b0, b1, b2, a1, a2] = this._coef(b);
    for (let c = 0; c < 2; c++) {
      const x = out[c], s = z[c];
      let x1 = s[0], x2 = s[1], y1 = s[2], y2 = s[3];
      for (let i = 0; i < Q; i++) { const xi = x[i], y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = xi; y2 = y1; y1 = y; x[i] = y; }
      s[0] = x1; s[1] = x2; s[2] = Math.abs(y1) < 1e-15 ? 0 : y1; s[3] = Math.abs(y2) < 1e-15 ? 0 : y2;
    }
    return true;
  }
  done(b) { const z = this._z; return this.inputs.size === 0 && Math.abs(z[0][2]) + Math.abs(z[1][2]) < 1e-6; }
}

/** Sources: silent before start, done after stop. */
class Source extends AudioNode {
  constructor(ctx) { super(ctx); this._start = Infinity; this._stop = Infinity; this.onended = null; this._ended = false; this.numberOfInputs = 0; }
  start(when = 0) { this._start = Math.max(when, this.context.currentTime); return this; }
  stop(when = 0) { this._stop = Math.max(when, this.context.currentTime); return this; }
  done(b) { return this._ended; }
  _span(b) {
    const sr = this.context.sampleRate, t0 = b * Q, s = Math.ceil(this._start * sr) - t0, e = Math.ceil(this._stop * sr) - t0;
    if (e <= 0) { if (!this._ended) { this._ended = true; const f = this.onended; if (f) queueMicrotask(() => f({ type: 'ended', target: this })); } return null; }
    if (s >= Q) return null;
    return [Math.max(0, s), Math.min(Q, e)];
  }
}

export class OscillatorNode extends Source {
  constructor(ctx) { super(ctx); this.type = 'sine'; this.frequency = new AudioParam(ctx, 440); this.detune = new AudioParam(ctx, 0); this._ph = 0; this._wave = null; }
  setPeriodicWave(w) { this.type = 'custom'; this._wave = w; }
  process(b, out) {
    const span = this._span(b);
    if (!span) return false;
    const [s, e] = span, sr = this.context.sampleRate, f = this.frequency.block(b), d = this.detune.block(b), L = out[0], R = out[1];
    L.fill(0); R.fill(0);
    let ph = this._ph;
    const type = this.type, W = this._wave;
    for (let i = s; i < e; i++) {
      const fr = d[i] ? f[i] * Math.pow(2, d[i] / 1200) : f[i];
      let v;
      if (type === 'sine') v = Math.sin(ph * 6.283185307179586);
      else if (type === 'square') v = ph < 0.5 ? 1 : -1;
      else if (type === 'sawtooth') v = 2 * ph - 1;
      else if (type === 'triangle') v = ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
      else v = W ? W.at(ph) : Math.sin(ph * 6.283185307179586);
      L[i] = v; R[i] = v;
      ph += fr / sr; ph -= Math.floor(ph);
    }
    this._ph = ph;
    return true;
  }
}

export class PeriodicWave {
  constructor(real, imag) { this.real = Float32Array.from(real ?? []); this.imag = Float32Array.from(imag ?? []); let m = 0; for (let k = 1; k < this.imag.length; k++) m += Math.abs(this.imag[k]) + Math.abs(this.real[k] ?? 0); this.norm = m || 1; }
  at(ph) { let v = 0; for (let k = 1; k < this.imag.length; k++) { const a = 6.283185307179586 * k * ph; v += (this.real[k] ?? 0) * Math.cos(a) + this.imag[k] * Math.sin(a); } return v / this.norm; }
}

export class AudioBuffer {
  constructor({ numberOfChannels = 1, length, sampleRate }) {
    this.numberOfChannels = numberOfChannels; this.length = length; this.sampleRate = sampleRate; this.duration = length / sampleRate;
    this._ch = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(c) { return this._ch[c]; }
  copyToChannel(src, c, o = 0) { this._ch[c].set(src, o); }
  copyFromChannel(dst, c, o = 0) { dst.set(this._ch[c].subarray(o, o + dst.length)); }
}

export class AudioBufferSourceNode extends Source {
  constructor(ctx) { super(ctx); this.buffer = null; this.loop = false; this.loopStart = 0; this.loopEnd = 0; this.playbackRate = new AudioParam(ctx, 1); this.detune = new AudioParam(ctx, 0); this._pos = 0; }
  start(when = 0, offset = 0, duration) { super.start(when); this._pos = offset * (this.buffer?.sampleRate ?? this.context.sampleRate); if (duration !== undefined && !this.loop) this._stop = this._start + duration; return this; }
  process(b, out) {
    const span = this._span(b);
    if (!span || !this.buffer) return false;
    const [s, e] = span, B = this.buffer, n = B.length, r = this.playbackRate.block(b), k = B.sampleRate / this.context.sampleRate;
    const c0 = B.getChannelData(0), c1 = B.numberOfChannels > 1 ? B.getChannelData(1) : c0, L = out[0], R = out[1];
    L.fill(0); R.fill(0);
    let pos = this._pos;
    const ls = this.loopStart * B.sampleRate, le = this.loopEnd > 0 ? this.loopEnd * B.sampleRate : n;
    for (let i = s; i < e; i++) {
      if (pos >= (this.loop ? le : n)) { if (this.loop) pos = ls + ((pos - ls) % Math.max(le - ls, 1)); else { this._stop = Math.min(this._stop, (b * Q + i) / this.context.sampleRate); break; } }
      const j = pos | 0, u = pos - j, j1 = j + 1 < n ? j + 1 : this.loop ? ls | 0 : j;
      L[i] = c0[j] + (c0[j1] - c0[j]) * u; R[i] = c1[j] + (c1[j1] - c1[j]) * u;
      pos += r[i] * k;
    }
    this._pos = pos;
    return true;
  }
}

/** A room for the convolver's impulse: four feedback combs and two allpasses (Schroeder), its decay the impulse's length. */
export class ConvolverNode extends Through {
  constructor(ctx) {
    super(ctx); this._buffer = null; this.normalize = true;
    const sr = ctx.sampleRate;
    this._combs = [0.0297, 0.0371, 0.0411, 0.0437].map((s) => ({ d: new Float32Array(Math.round(s * sr)), i: 0 }));
    this._aps = [0.005, 0.0017].map((s) => ({ d: new Float32Array(Math.round(s * sr)), i: 0 }));
    this._g = 0.8; this._energy = 0;
  }
  get buffer() { return this._buffer; }
  set buffer(b) {
    this._buffer = b;
    // (the impulse's length as the time to fall 60 dB; its decay shape is softer than that: a third of it)
    const rt = b ? b.duration / 3 : 1;
    this._g = Math.pow(10, (-3 * 0.039) / Math.max(rt, 0.05));
  }
  process(b, out) {
    const live = this.mix(b, out);
    if (!live && this._energy < 1e-7) return false;
    const L = out[0], R = out[1], g = this._g;
    let e = 0;
    for (let i = 0; i < Q; i++) {
      const x = (L[i] + R[i]) * 0.25;
      let y = 0;
      for (const c of this._combs) { const v = c.d[c.i]; c.d[c.i] = x + v * g; c.i = (c.i + 1) % c.d.length; y += v; }
      for (const a of this._aps) { const v = a.d[a.i]; const w = y + v * 0.5; a.d[a.i] = w; a.i = (a.i + 1) % a.d.length; y = v - w * 0.5; }
      L[i] = y * 0.6; R[i] = (y * 0.6 + (this._combs[1].d[this._combs[1].i] * 0.15));
      e += y * y;
    }
    this._energy = e / Q;
    return true;
  }
  done(b) { return this.inputs.size === 0 && this._energy < 1e-7; }
}

export class DynamicsCompressorNode extends Through {
  constructor(ctx) {
    super(ctx);
    this.threshold = new AudioParam(ctx, -24, { rate: 'k' }); this.knee = new AudioParam(ctx, 30, { rate: 'k' }); this.ratio = new AudioParam(ctx, 12, { rate: 'k' });
    this.attack = new AudioParam(ctx, 0.003, { rate: 'k' }); this.release = new AudioParam(ctx, 0.25, { rate: 'k' });
    this.reduction = 0; this._env = 0;
  }
  process(b, out) {
    if (!this.mix(b, out)) return false;
    const sr = this.context.sampleRate, th = Math.pow(10, this.threshold.block(b)[0] / 20), ratio = Math.max(this.ratio.block(b)[0], 1);
    const att = Math.exp(-1 / (Math.max(this.attack.block(b)[0], 1e-4) * sr)), rel = Math.exp(-1 / (Math.max(this.release.block(b)[0], 1e-3) * sr));
    const L = out[0], R = out[1];
    let env = this._env;
    for (let i = 0; i < Q; i++) {
      const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
      env = p > env ? att * env + (1 - att) * p : rel * env + (1 - rel) * p;
      const gain = env > th ? Math.pow(env / th, 1 / ratio - 1) : 1;
      L[i] *= gain; R[i] *= gain;
    }
    this._env = env;
    this.reduction = env > th ? 20 * Math.log10(Math.pow(env / th, 1 / ratio - 1)) : 0;
    return true;
  }
}

export class AnalyserNode extends Through {
  constructor(ctx) { super(ctx); this.fftSize = 2048; this.frequencyBinCount = 1024; this.smoothingTimeConstant = 0.8; this.minDecibels = -100; this.maxDecibels = -30; this._last = new Float32Array(Q); }
  process(b, out) {
    const live = this.mix(b, out);
    if (live) for (let i = 0; i < Q; i++) this._last[i] = (out[0][i] + out[1][i]) * 0.5; else this._last.fill(0);
    return false;   // (it listens; nothing goes on from it)
  }
  getFloatTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = this._last[i % Q]; }
  getByteTimeDomainData(a) { for (let i = 0; i < a.length; i++) a[i] = 128 + this._last[i % Q] * 127; }
  getFloatFrequencyData(a) { a.fill(this.minDecibels); }
  getByteFrequencyData(a) { a.fill(0); }
}

export class DelayNode extends Through {
  constructor(ctx, max = 1) { super(ctx); this.delayTime = new AudioParam(ctx, 0, { rate: 'k' }); this._d = [new Float32Array(Math.ceil(max * ctx.sampleRate) + Q), new Float32Array(Math.ceil(max * ctx.sampleRate) + Q)]; this._i = 0; this._quiet = 0; }
  process(b, out) {
    const live = this.mix(b, out);
    const n = this._d[0].length, dl = Math.min(Math.round(this.delayTime.block(b)[0] * this.context.sampleRate), n - 1);
    if (!live && this._quiet > n) return false;
    this._quiet = live ? 0 : this._quiet + Q;
    for (let c = 0; c < 2; c++) { const D = this._d[c], x = out[c]; let i = this._i; for (let k = 0; k < Q; k++) { D[i] = x[k]; x[k] = D[(i - dl + n) % n]; i = (i + 1) % n; } }
    this._i = (this._i + Q) % n;
    return true;
  }
  done(b) { return this.inputs.size === 0 && this._quiet > this._d[0].length; }
}

class Destination extends AudioNode { constructor(ctx) { super(ctx); this.maxChannelCount = 2; } }

// ------------------------------------------------------------------ the context
let defaultRate = 48000;
export class AudioContext {
  constructor({ sampleRate = defaultRate } = {}) {
    this.sampleRate = sampleRate;
    this.destination = new Destination(this);
    this.listener = { positionX: new AudioParam(this, 0), positionY: new AudioParam(this, 0), positionZ: new AudioParam(this, 0), setPosition() {}, setOrientation() {} };
    this.state = 'running';
    this._block = 0;
    this.baseLatency = 0.01; this.outputLatency = 0.02;
    this.onstatechange = null;
  }
  get currentTime() { return (this._block * Q) / this.sampleRate; }
  createGain() { return new GainNode(this); }
  createOscillator() { return new OscillatorNode(this); }
  createBiquadFilter() { return new BiquadFilterNode(this); }
  createBufferSource() { return new AudioBufferSourceNode(this); }
  createStereoPanner() { return new StereoPannerNode(this); }
  createConvolver() { return new ConvolverNode(this); }
  createDynamicsCompressor() { return new DynamicsCompressorNode(this); }
  createAnalyser() { return new AnalyserNode(this); }
  createDelay(max) { return new DelayNode(this, max); }
  createBuffer(channels, length, sampleRate) { return new AudioBuffer({ numberOfChannels: channels, length, sampleRate }); }
  createPeriodicWave(real, imag) { return new PeriodicWave(real, imag); }
  decodeAudioData(data, ok, fail) { const e = new Error('decodeAudioData: no decoder in the engine'); fail?.(e); return Promise.reject(e); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }

  /** The next `frames` frames of the mix, interleaved stereo (a whole number of blocks: the rest waits for the next call). */
  render(frames, out = null) {
    const blocks = Math.max(0, Math.floor((frames + (this._carry ?? 0)) / Q));
    this._carry = (frames + (this._carry ?? 0)) - blocks * Q;
    out = out && out.length >= blocks * Q * 2 ? out : new Float32Array(blocks * Q * 2);
    if (this.state !== 'running') { out.fill(0); return out.subarray(0, blocks * Q * 2); }
    for (let k = 0; k < blocks; k++) {
      const o = this.destination.output(this._block);
      const base = k * Q * 2;
      if (o) for (let i = 0; i < Q; i++) { out[base + i * 2] = o[0][i]; out[base + i * 2 + 1] = o[1][i]; }
      else out.fill(0, base, base + Q * 2);
      this._block++;
    }
    return out.subarray(0, blocks * Q * 2);
  }
  /** How many nodes are live in the graph now (from the destination). */
  liveNodes() { const seen = new Set(), st = [this.destination]; while (st.length) { const n = st.pop(); if (seen.has(n)) continue; seen.add(n); for (const i of n.inputs) st.push(i); } return seen.size; }
}

/** Put AudioContext (and webkitAudioContext) on globalThis, where the VM has none; new contexts at the engine's rate. */
export function installAudio(G = globalThis, { sampleRate } = {}) {
  if (sampleRate) defaultRate = sampleRate;
  if (!G.AudioContext) G.AudioContext = AudioContext;
  if (!G.webkitAudioContext) G.webkitAudioContext = AudioContext;
  if (!G.OfflineAudioContext) G.OfflineAudioContext = undefined;
}
