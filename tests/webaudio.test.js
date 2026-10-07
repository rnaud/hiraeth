// Web Audio for the engines' VMs (engine/webaudio.js, docs/systems/engine-bridge.md "Sound"): the nodes and
// the automation the game's synthesis uses, rendered in JS; chains whose sources ended leave the graph;
// and the game's own Sound (src/audio.js) playing on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioContext, installAudio } from '../engine/webaudio.js';

const rms = (a, ch = 0) => { let s = 0, n = 0; for (let i = ch; i < a.length; i += 2) { s += a[i] * a[i]; n++; } return Math.sqrt(s / Math.max(n, 1)); };
const peak = (a) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

test('an oscillator through a gain: its pitch and its level', () => {
  const ctx = new AudioContext({ sampleRate: 48000 });
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = 440; g.gain.value = 0.5;
  o.connect(g).connect(ctx.destination); o.start(0);
  const out = ctx.render(4800);
  assert.equal(out.length, 4736 * 2, 'whole blocks; the rest waits');
  assert.ok(Math.abs(peak(out) - 0.5) < 0.01);
  let crossings = 0;
  for (let i = 2; i < out.length; i += 2) if (out[i - 2] < 0 && out[i] >= 0) crossings++;
  assert.ok(Math.abs(crossings - 440 * 4736 / 48000) <= 1, `${crossings} cycles`);
  for (const type of ['square', 'sawtooth', 'triangle']) { o.type = type; assert.ok(peak(ctx.render(1024)) > 0.45, type); }
});

test('automation: ramps, targets and set values land where the spec says', () => {
  const ctx = new AudioContext({ sampleRate: 1000 });
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, 0);
  g.gain.linearRampToValueAtTime(1, 1);
  assert.ok(Math.abs(g.gain.at(0.5) - 0.5) < 1e-9);
  g.gain.setTargetAtTime(0, 1, 0.2);
  assert.ok(Math.abs(g.gain.at(1.2) - Math.exp(-1)) < 1e-6, 'one time constant: 37 %');
  g.gain.setValueAtTime(0.25, 2);
  g.gain.exponentialRampToValueAtTime(1, 3);
  assert.ok(Math.abs(g.gain.at(2.5) - 0.5) < 1e-6, 'halfway in the exponent');
  assert.equal(g.gain.at(4), 1);
  g.gain.cancelScheduledValues(2.5);
  const f = ctx.createBiquadFilter();
  f.frequency.value = 800;
  assert.equal(f.frequency.value, 800);
});

test('a target set every frame keeps one event, and lands where it should', () => {
  const ctx = new AudioContext({ sampleRate: 48000 });
  const g = ctx.createGain(); g.gain.value = 0;
  const o = ctx.createOscillator(); o.connect(g).connect(ctx.destination); o.start(0);
  for (let f = 0; f < 600; f++) { g.gain.setTargetAtTime(0.5, ctx.currentTime, 0.05); ctx.render(800); }
  assert.ok(g.gain.events.length <= 2, `${g.gain.events.length} events`);
  assert.ok(Math.abs(g.gain.value - 0.5) < 1e-3, `${g.gain.value}`);
  g.gain.setValueAtTime(0.1, ctx.currentTime); g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
  ctx.render(9600);
  assert.ok(Math.abs(g.gain.value - 0.3) < 1e-6 && g.gain.events.length === 1, 'a ramp that has ended is its value');
});

test('a filter takes out what it should', () => {
  const ctx = new AudioContext({ sampleRate: 48000 });
  const hi = ctx.createOscillator(), f = ctx.createBiquadFilter();
  hi.frequency.value = 8000; f.type = 'lowpass'; f.frequency.value = 400;
  hi.connect(f).connect(ctx.destination); hi.start(0);
  ctx.render(4800);
  assert.ok(rms(ctx.render(4800)) < 0.01, 'an 8 kHz tone through a 400 Hz low-pass: nearly nothing');
  f.type = 'highpass';
  ctx.render(2400);
  assert.ok(rms(ctx.render(4800)) > 0.5, 'and through a high-pass: nearly all');
});

test('a chain whose source ended leaves the graph; a bus comes back on its next input', () => {
  const ctx = new AudioContext({ sampleRate: 48000 });
  const bus = ctx.createGain(); bus.connect(ctx.destination);
  for (let k = 0; k < 50; k++) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g).connect(bus); o.start(0); o.stop(0.01);
  }
  ctx.render(256);
  assert.ok(ctx.liveNodes() > 50);
  ctx.render(4800);
  assert.equal(ctx.liveNodes(), 1, 'only the destination: the notes and the bus have gone quiet and left');
  const o = ctx.createOscillator(); o.connect(bus); o.start(ctx.currentTime);
  assert.ok(rms(ctx.render(4800)) > 0.5, 'the bus woke up for a new note');
  let ended = false;
  o.onended = () => { ended = true; };
  o.stop(ctx.currentTime);
  ctx.render(256);
  return Promise.resolve().then(() => assert.ok(ended, 'onended'));
});

test('noise, a panner, the reverb and the compressor', () => {
  const ctx = new AudioContext({ sampleRate: 48000 });
  const buf = ctx.createBuffer(1, 48000, 48000), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.sin(i * 0.37) * 0.9;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.5;
  const pan = ctx.createStereoPanner(); pan.pan.value = 1;
  const verb = ctx.createConvolver(); verb.buffer = ctx.createBuffer(2, 48000 * 3, 48000);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18;
  src.connect(pan).connect(comp).connect(ctx.destination);
  src.start(0);
  const out = ctx.render(9600);
  assert.ok(rms(out, 1) > rms(out, 0) * 2, 'panned right');
  pan.connect(verb).connect(ctx.destination);
  const wet = ctx.render(9600);
  assert.ok(peak(wet) < 1.5 && Number.isFinite(rms(wet)));
  src.stop(ctx.currentTime);
  ctx.render(4800);
  assert.ok(rms(ctx.render(4800)) > 1e-4, 'the room still rings after the source stops');
});

test('the game\'s own Sound plays on it: its buses, its layers, a footstep and a page turn', async () => {
  const G = globalThis;
  const saved = { window: G.window, AudioContext: G.AudioContext };
  G.window = G; G.window.addEventListener ??= () => {}; G.window.removeEventListener ??= () => {};
  delete G.AudioContext; installAudio(G);
  try {
    const { Sound } = await import('../src/audio.js');
    const s = new Sound('desert');
    s.start();
    assert.ok(s.ctx instanceof AudioContext);
    s.ctx.render(4800);
    s.step(5); s.page();
    s.update({ speed: 4, gust: 0.4, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 });
    assert.throws(() => s.master.gain.setTargetAtTime(NaN, 0, 0.1), TypeError, 'a NaN throws, as in a browser');
    const out = s.ctx.render(48000);
    assert.ok(Number.isFinite(rms(out)), 'finite');
    assert.ok(rms(out) > 1e-4, `audible: rms ${rms(out)}`);
    assert.ok(peak(out) < 2, 'not blown up');
    clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.();
  } finally {
    if (saved.AudioContext) G.AudioContext = saved.AudioContext; else delete G.AudioContext;
    if (saved.window === undefined) delete G.window;
  }
});

test('recorded and played elsewhere (the Unity bridge\'s audio thread): the same samples as rendered here', async () => {
  const { AudioReplay } = await import('../engine/webaudio.js');
  const G = globalThis;
  const saved = { window: G.window, AudioContext: G.AudioContext, random: Math.random };
  G.window = G; G.window.addEventListener ??= () => {}; G.window.removeEventListener ??= () => {};
  const run = async (record) => {
    // (the same random numbers for both: the noise buffers, the music's choices)
    let seed = 7; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    delete G.AudioContext; installAudio(G, { sampleRate: 48000, record });
    const { Sound } = await import(`../src/audio.js?rec=${record}`);
    const s = new Sound('desert');
    s.start();
    const replay = record ? new AudioReplay(48000) : null;
    const pcm = [];
    let ops = 0, ends = 0;
    for (let f = 0; f < 150; f++) {
      s.update({ speed: f < 60 ? 4 : 0, gust: 0.3 + 0.3 * Math.sin(f * 0.1), storm: f > 100 ? 0.5 : 0, rain: f > 90 ? 0.6 : 0, rainRoof: 0, thrusting: f > 120, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 });
      if (f % 15 === 3) s.step(4 + (f % 3));
      if (f === 30) s.page();
      if (f === 40) s.chime?.('find');
      if (f === 70) s.whoosh?.(0.5);
      if (record) {
        const T = s.ctx.takeOps(6);
        ops += T.length;
        const r = replay.apply(T);
        pcm.push(Float32Array.from(r.pcm));
        if (r.ended.length) { ends += r.ended.length; s.ctx.ended(r.ended); }
      } else pcm.push(Float32Array.from(s.ctx.render(6 * 128)));
    }
    clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.();
    return { pcm, ops, ends };
  };
  try {
    const A = await run(false), B = await run(true);
    let worst = 0, sum = 0, n = 0;
    for (let f = 0; f < A.pcm.length; f++) for (let i = 0; i < A.pcm[f].length; i++) { worst = Math.max(worst, Math.abs(A.pcm[f][i] - B.pcm[f][i])); sum += A.pcm[f][i] ** 2; n++; }
    assert.ok(Math.sqrt(sum / n) > 1e-4, 'something to hear');
    assert.equal(worst, 0, 'sample for sample');
    assert.ok(B.ops > 1000 && B.ends > 0, `the ops recorded (${B.ops} tokens), the sources' ends reported (${B.ends})`);
  } finally {
    Math.random = saved.random;
    if (saved.AudioContext) G.AudioContext = saved.AudioContext; else delete G.AudioContext;
    if (saved.window === undefined) delete G.window;
    installAudio(G, { record: false });
  }
});
