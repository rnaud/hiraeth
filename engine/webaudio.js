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
//
// Recorded (installAudio({ record: true }): the Unity bridge): the context keeps every node's and param's state as
// above but renders nothing; what the game does to its graph is written down instead (ctx.takeOps(blocks): a
// Float64Array of tokens, the blocks to render last), and an AudioReplay elsewhere (engine/unity/audio-worker.js, on
// a thread of its own) builds the same graph from them and renders it, exactly as this context would have: the same
// classes, the same ops at the same blocks. Its sources' ends come back (ctx.ended(ids): their onended).

const Q = 128;   // the render quantum
// (the recording's tokens: ops, node kinds, param events, properties)
const OP = { new: 1, con: 2, dis: 3, pv: 4, pe: 5, cancel: 6, start: 7, stop: 8, prop: 9, buf: 10, wave: 11, free: 12, render: 13, state: 14 };
const KIND = { dest: 0, gain: 1, osc: 2, biquad: 3, src: 4, pan: 5, conv: 6, comp: 7, an: 8, delay: 9 };
const EV = { set: 0, lin: 1, exp: 2, target: 3 }, EV_NAME = ['set', 'lin', 'exp', 'target'];
const PROP = { oscType: 1, biquadType: 2, buffer: 3, loop: 4, loopStart: 5, loopEnd: 6, convBuffer: 7, wave: 8 };
const OSC_TYPES = ['sine', 'square', 'sawtooth', 'triangle', 'custom'];
const BIQUAD_TYPES = ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass', 'peaking', 'lowshelf', 'highshelf'];
const STATES = ['running', 'suspended', 'closed'];
let paramIds = 0, bufferIds = 0, waveIds = 0;

// ------------------------------------------------------------------ AudioParam
export class AudioParam {
  constructor(ctx, value, { min = -3.4e38, max = 3.4e38, rate = 'a' } = {}) {
    this.ctx = ctx; this._v = value; this.defaultValue = value; this.minValue = min; this.maxValue = max; this.rate = rate; this.pid = ++paramIds;
    this.events = [];   // sorted by time: { type, t, v, tc }
    this.inputs = [];   // nodes modulating it (their output summed in)
    this._buf = new Float32Array(Q); this._block = -1;
  }
  get value() { return this.events.length ? this.at(this.ctx.currentTime) : this._v; }
  // (setting value is a setValueAtTime now, as browsers do; with nothing scheduled, just the value)
  set value(v) { if (!Number.isFinite(v)) throw new TypeError('AudioParam: non-finite value'); if (!this.events.length) { this._v = v; this.ctx._rec?.push(OP.pv, this.pid, v); return; } this.setValueAtTime(v, this.ctx.currentTime); }
  _add(e) {
    // (as browsers do: a non-finite value or time is a TypeError, not a NaN that silences the whole mix)
    if (!Number.isFinite(e.v) || !Number.isFinite(e.t)) throw new TypeError(`AudioParam: non-finite ${Number.isFinite(e.v) ? 'time' : 'value'}`);
    const i = this.events.findIndex((x) => x.t > e.t);
    if (i < 0) this.events.push(e); else this.events.splice(i, 0, e);
    const R = this.ctx._rec;
    if (R) {
      R.push(OP.pe, this.pid, EV[e.type], e.v, e.t, e.tc ?? 0);
      // (nothing renders here to fold what is past: folded as the value is read, which changes nothing it says)
      if (this.events.length > 24) this.at(this.ctx.currentTime);
    }
    return this;
  }
  setValueAtTime(v, t) { return this._add({ type: 'set', t, v }); }
  linearRampToValueAtTime(v, t) { return this._add({ type: 'lin', t, v }); }
  exponentialRampToValueAtTime(v, t) { return this._add({ type: 'exp', t, v }); }
  setTargetAtTime(v, t, tc) { return this._add({ type: 'target', t, v, tc: Math.max(tc, 1e-4) }); }
  setValueCurveAtTime(curve, t, dur) { const n = curve.length; for (let i = 0; i < n; i++) this._add({ type: i ? 'lin' : 'set', t: t + (dur * i) / Math.max(n - 1, 1), v: curve[i] }); return this; }
  cancelScheduledValues(t) { this.ctx._rec?.push(OP.cancel, this.pid, t); this.events = this.events.filter((e) => e.t < t); return this; }
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
    // (recorded: written down only; the graph is the replay's, which drops what has ended. Kept here as well, nothing
    // the game let go of could be collected: no render here drops a source that ended from what it fed)
    const R = this.context._rec;
    if (R) { if (dest instanceof AudioParam) R.push(OP.con, this.id, 1, dest.pid); else if (dest) R.push(OP.con, this.id, 0, dest.id); return dest; }
    if (dest instanceof AudioParam) { dest.inputs.push(this); this.outputs.add(dest); return dest; }
    if (!dest) return dest;
    dest.inputs.add(this); this.outputs.add(dest);
    dest._wake();
    return dest;
  }
  disconnect(dest) {
    const R = this.context._rec;
    if (R) { R.push(OP.dis, this.id, !dest ? -1 : dest instanceof AudioParam ? 1 : 0, !dest ? 0 : dest instanceof AudioParam ? dest.pid : dest.id); return; }
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
  get type() { return this._type; }
  set type(v) { this._type = v; this.context._rec?.push(OP.prop, this.id, PROP.biquadType, Math.max(0, BIQUAD_TYPES.indexOf(v))); }
  constructor(ctx) {
    super(ctx);
    this._type = 'lowpass';
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
  constructor(ctx) { super(ctx); this._start = Infinity; this._stop = Infinity; this._onended = null; this._ended = false; this.numberOfInputs = 0; }
  // (recorded: a source with an onended is held until it ends, as a browser's graph holds a playing source)
  get onended() { return this._onended; }
  set onended(f) { this._onended = f; const K = this.context._keep; if (K) { if (f && !this._ended) K.set(this.id, this); else K.delete(this.id); } }
  start(when = 0) { this.context._rec?.push(OP.start, this.id, when, 0, NaN); this._start = Math.max(when, this.context.currentTime); return this; }
  stop(when = 0) { this.context._rec?.push(OP.stop, this.id, when); this._stop = Math.max(when, this.context.currentTime); return this; }
  done(b) { return this._ended; }
  _span(b) {
    const sr = this.context.sampleRate, t0 = b * Q, s = Math.ceil(this._start * sr) - t0, e = Math.ceil(this._stop * sr) - t0;
    if (e <= 0) { if (!this._ended) { this._ended = true; const f = this.onended; if (f) queueMicrotask(() => f({ type: 'ended', target: this })); } return null; }
    if (s >= Q) return null;
    return [Math.max(0, s), Math.min(Q, e)];
  }
}

export class OscillatorNode extends Source {
  constructor(ctx) { super(ctx); this._type = 'sine'; this.frequency = new AudioParam(ctx, 440); this.detune = new AudioParam(ctx, 0); this._ph = 0; this._wave = null; }
  get type() { return this._type; }
  set type(v) { this._type = v; this.context._rec?.push(OP.prop, this.id, PROP.oscType, Math.max(0, OSC_TYPES.indexOf(v))); }
  setPeriodicWave(w) { const R = this.context._rec; if (R) { this.context._sendWave(w); R.push(OP.prop, this.id, PROP.wave, w._wid); } this._type = 'custom'; this._wave = w; }
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
  constructor(ctx) { super(ctx); this._buffer = null; this._loop = false; this._loopStart = 0; this._loopEnd = 0; this.playbackRate = new AudioParam(ctx, 1); this.detune = new AudioParam(ctx, 0); this._pos = 0; }
  get buffer() { return this._buffer; }
  set buffer(b) { this._buffer = b; const R = this.context._rec; if (R) { if (b) this.context._sendBuffer(b); R.push(OP.prop, this.id, PROP.buffer, b ? b._bid : 0); } }
  get loop() { return this._loop; }
  set loop(v) { this._loop = !!v; this.context._rec?.push(OP.prop, this.id, PROP.loop, v ? 1 : 0); }
  get loopStart() { return this._loopStart; }
  set loopStart(v) { this._loopStart = v; this.context._rec?.push(OP.prop, this.id, PROP.loopStart, v); }
  get loopEnd() { return this._loopEnd; }
  set loopEnd(v) { this._loopEnd = v; this.context._rec?.push(OP.prop, this.id, PROP.loopEnd, v); }
  start(when = 0, offset = 0, duration) {
    this.context._rec?.push(OP.start, this.id, when, offset, duration === undefined ? NaN : duration);
    this._start = Math.max(when, this.context.currentTime);
    this._pos = offset * (this.buffer?.sampleRate ?? this.context.sampleRate); if (duration !== undefined && !this.loop) this._stop = this._start + duration; return this;
  }
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
    const R = this.context._rec;
    if (R) { if (b) this.context._sendBuffer(b); R.push(OP.prop, this.id, PROP.convBuffer, b ? b._bid : 0); }
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
  constructor({ sampleRate = defaultRate, record = defaultRecord } = {}) {
    this.sampleRate = sampleRate;
    this._rec = record ? [] : null;
    if (record) {
      this._srcs = new Map();   // sources with an onended to call: id → WeakRef (ended(ids))
      // (every node, weakly: the ones the game let go of are freed in the replay too; swept now and then in takeOps. A
      // FinalizationRegistry's callbacks never ran in Puerts' V8: nothing pumps the tasks that call them)
      this._weak = []; this._sweepIn = 120; this._keep = new Map();
    }
    this.destination = this._made(new Destination(this), KIND.dest);
    this.listener = { positionX: new AudioParam(this, 0), positionY: new AudioParam(this, 0), positionZ: new AudioParam(this, 0), setPosition() {}, setOrientation() {} };
    this.state = 'running';
    this._block = 0;
    this.baseLatency = 0.01; this.outputLatency = 0.02;
    this.onstatechange = null;
  }
  get currentTime() { return (this._block * Q) / this.sampleRate; }
  createGain() { return this._made(new GainNode(this), KIND.gain); }
  createOscillator() { return this._made(new OscillatorNode(this), KIND.osc); }
  createBiquadFilter() { return this._made(new BiquadFilterNode(this), KIND.biquad); }
  createBufferSource() { return this._made(new AudioBufferSourceNode(this), KIND.src); }
  createStereoPanner() { return this._made(new StereoPannerNode(this), KIND.pan); }
  createConvolver() { return this._made(new ConvolverNode(this), KIND.conv); }
  createDynamicsCompressor() { return this._made(new DynamicsCompressorNode(this), KIND.comp); }
  createAnalyser() { return this._made(new AnalyserNode(this), KIND.an); }
  createDelay(max) { return this._made(new DelayNode(this, max), KIND.delay, max ?? 1); }

  /** A node made (recorded: its kind, its id, its params' ids in their order: paramsOf). */
  _made(node, kind, extra = 0) {
    const R = this._rec;
    if (!R) return node;
    R.push(OP.new, kind, node.id, extra);
    for (const p of paramsOf(node, kind)) R.push(p.pid);
    if (kind === KIND.osc || kind === KIND.src) this._srcs.set(node.id, new WeakRef(node));
    if (kind !== KIND.dest && typeof WeakRef !== 'undefined') this._weak.push(new WeakRef(node), node.id);
    return node;
  }
  _sendBuffer(b) {
    if (b._bid) return;
    b._bid = ++bufferIds;
    const R = this._rec;
    R.push(OP.buf, b._bid, b.numberOfChannels, b.length, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) R.push(d[i]); }
  }
  _sendWave(w) {
    if (w._wid) return;
    w._wid = ++waveIds;
    const R = this._rec;
    R.push(OP.wave, w._wid, w.real.length, w.imag.length, ...w.real, ...w.imag);
  }
  /** Recorded: the ops since the last call and `blocks` to render after them, as a Float64Array; the clock moves on that much. */
  takeOps(blocks) {
    const R = this._rec;
    if (--this._sweepIn <= 0) {
      this._sweepIn = 120;
      const W = this._weak, keep = [];
      for (let i = 0; i < W.length; i += 2) { if (W[i].deref()) keep.push(W[i], W[i + 1]); else R.push(OP.free, W[i + 1]); }
      this._weak = keep;
    }
    R.push(OP.render, blocks);
    const out = Float64Array.from(R);
    R.length = 0;
    this._block += blocks;
    return out;
  }
  /** Recorded: these sources ended where they were rendered (their onended, as a render here would call it). */
  ended(ids) {
    for (const id of ids) {
      const w = this._srcs.get(id), n = w?.deref();
      this._srcs.delete(id); this._keep.delete(id);
      if (!n || n._ended) continue;
      n._ended = true;
      const f = n.onended;
      if (f) queueMicrotask(() => f({ type: 'ended', target: n }));
    }
  }
  createBuffer(channels, length, sampleRate) { return new AudioBuffer({ numberOfChannels: channels, length, sampleRate }); }
  createPeriodicWave(real, imag) { return new PeriodicWave(real, imag); }
  decodeAudioData(data, ok, fail) { const e = new Error('decodeAudioData: no decoder in the engine'); fail?.(e); return Promise.reject(e); }
  resume() { this.state = 'running'; this._rec?.push(OP.state, 0); return Promise.resolve(); }
  suspend() { this.state = 'suspended'; this._rec?.push(OP.state, 1); return Promise.resolve(); }
  close() { this.state = 'closed'; this._rec?.push(OP.state, 2); return Promise.resolve(); }

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

/** A node's params in their order (a recorded node's, as AudioReplay makes it). */
function paramsOf(n, kind) {
  switch (kind) {
    case KIND.gain: return [n.gain];
    case KIND.osc: return [n.frequency, n.detune];
    case KIND.biquad: return [n.frequency, n.Q, n.gain, n.detune];
    case KIND.src: return [n.playbackRate, n.detune];
    case KIND.pan: return [n.pan];
    case KIND.comp: return [n.threshold, n.knee, n.ratio, n.attack, n.release];
    case KIND.delay: return [n.delayTime];
    default: return [];
  }
}

/**
 * A recorded context's graph, made again from its ops and rendered (engine/unity/audio-worker.js): apply(tokens) →
 * { pcm (interleaved stereo, the render op's blocks), ended (the recorded ids of the sources that ended) }.
 */
export class AudioReplay {
  constructor(sampleRate) {
    this.ctx = new AudioContext({ sampleRate, record: false });
    this.nodes = new Map(); this.params = new Map(); this.buffers = new Map(); this.waves = new Map();
    this.live = new Map();   // started sources not yet ended: recorded id → node
    this.out = new Float32Array(0);
  }
  apply(T) {
    const C = this.ctx, N = this.nodes, P = this.params;
    let pcm = new Float32Array(0);
    const ended = [];
    for (let i = 0; i < T.length;) {
      const op = T[i++];
      switch (op) {
        case OP.new: {
          const kind = T[i++], id = T[i++], extra = T[i++];
          const n = kind === KIND.dest ? C.destination : kind === KIND.gain ? C.createGain() : kind === KIND.osc ? C.createOscillator() : kind === KIND.biquad ? C.createBiquadFilter()
            : kind === KIND.src ? C.createBufferSource() : kind === KIND.pan ? C.createStereoPanner() : kind === KIND.conv ? C.createConvolver() : kind === KIND.comp ? C.createDynamicsCompressor()
              : kind === KIND.an ? C.createAnalyser() : C.createDelay(extra);
          N.set(id, n);
          n._pids = [];
          for (const p of paramsOf(n, kind)) { const pid = T[i++]; P.set(pid, p); n._pids.push(pid); }
          break;
        }
        case OP.con: { const a = N.get(T[i++]), isP = T[i++], d = isP ? P.get(T[i++]) : N.get(T[i++]); if (a && d) a.connect(d); break; }
        case OP.dis: { const a = N.get(T[i++]), kind = T[i++], did = T[i++]; if (a) a.disconnect(kind < 0 ? undefined : kind ? P.get(did) : N.get(did)); break; }
        case OP.pv: { const p = P.get(T[i++]), v = T[i++]; if (p) p.value = v; break; }
        case OP.pe: { const p = P.get(T[i++]), type = EV_NAME[T[i++]], v = T[i++], t = T[i++], tc = T[i++]; if (p) p._add(type === 'target' ? { type, t, v, tc } : { type, t, v }); break; }
        case OP.cancel: { const p = P.get(T[i++]), t = T[i++]; if (p) p.cancelScheduledValues(t); break; }
        case OP.start: { const id = T[i++], n = N.get(id), when = T[i++], off = T[i++], dur = T[i++]; if (n) { n.start(when, off, Number.isNaN(dur) ? undefined : dur); this.live.set(id, n); } break; }
        case OP.stop: { const n = N.get(T[i++]), when = T[i++]; if (n) n.stop(when); break; }
        case OP.prop: {
          const n = N.get(T[i++]), k = T[i++], v = T[i++];
          if (!n) break;
          if (k === PROP.oscType) n.type = OSC_TYPES[v]; else if (k === PROP.biquadType) n.type = BIQUAD_TYPES[v];
          else if (k === PROP.buffer) n.buffer = this.buffers.get(v) ?? null; else if (k === PROP.convBuffer) n.buffer = this.buffers.get(v) ?? null;
          else if (k === PROP.loop) n.loop = !!v; else if (k === PROP.loopStart) n.loopStart = v; else if (k === PROP.loopEnd) n.loopEnd = v;
          else if (k === PROP.wave) { const w = this.waves.get(v); if (w) n.setPeriodicWave(w); }
          break;
        }
        case OP.buf: {
          const id = T[i++], ch = T[i++], len = T[i++], sr = T[i++], b = C.createBuffer(ch, len, sr);
          for (let c = 0; c < ch; c++) { b.getChannelData(c).set(T.subarray(i, i + len)); i += len; }
          this.buffers.set(id, b);
          break;
        }
        case OP.wave: { const id = T[i++], nr = T[i++], ni = T[i++], w = C.createPeriodicWave(T.subarray(i, i + nr), T.subarray(i + nr, i + nr + ni)); i += nr + ni; this.waves.set(id, w); break; }
        case OP.free: { const id = T[i++], n = N.get(id); this.freed = (this.freed ?? 0) + 1; if (n) { for (const pid of n._pids ?? []) P.delete(pid); N.delete(id); this.live.delete(id); } break; }
        case OP.state: { const s = STATES[T[i++]]; C.state = s; break; }
        case OP.render: {
          const blocks = T[i++];
          if (this.out.length < blocks * Q * 2) this.out = new Float32Array(blocks * Q * 2);
          pcm = C.render(blocks * Q, this.out);
          for (const [id, n] of this.live) if (n._ended) { this.live.delete(id); ended.push(id); }
          break;
        }
        default: throw new Error(`AudioReplay: op ${op} at ${i - 1}`);
      }
    }
    return { pcm, ended };
  }
}

/** Put AudioContext (and webkitAudioContext) on globalThis, where the VM has none; new contexts at the engine's rate. */
let defaultRecord = false;
export function installAudio(G = globalThis, { sampleRate, record = false } = {}) {
  if (sampleRate) defaultRate = sampleRate;
  defaultRecord = record;
  if (!G.AudioContext) G.AudioContext = AudioContext;
  if (!G.webkitAudioContext) G.webkitAudioContext = AudioContext;
  if (!G.OfflineAudioContext) G.OfflineAudioContext = undefined;
}
