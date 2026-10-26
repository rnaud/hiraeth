// In-memory audio rendering. Disk decoding is supplied by render.mjs; synthesis tests need no decoder.
import { SOUNDTRACKS } from '../../src/soundtracks.js';
import { THEME_LEVELS } from '../../src/theme-levels.js';
export const RATE = 48000;
export const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 };

/** A world's recorded theme and the gain the engines play it at (src/soundtracks.js, src/theme-levels.js); null: none. */
export function themeOf(level) {
  const file = SOUNDTRACKS[level];
  return file ? { file, gain: THEME_LEVELS[file] ?? 1 } : null;
}

/** Math.random seeded while `fn` runs (the noise and the takes' variation the same every run). */
export function seeded(fn, seed = 12345) {
  const real = Math.random;
  // (mulberry32: neighbouring seeds give unrelated draws; a bare LCG's first draws for seeds 37 apart were 1 % apart,
  // and every take's variation came out the same)
  let x = (seed >>> 0) ^ 0x9e3779b9;
  Math.random = () => { x = (x + 0x6d2b79f5) >>> 0; let z = x; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 2 ** 32; };
  try { return fn(); } finally { Math.random = real; }
}

/**
 * The renderer. `take` and `themes` supply decoded PCM; absent providers use the procedural sounds.
 * render(fn, { level, secs, setup, warm }) makes a fresh Sound in `level`, calm, runs `setup(s)`, renders `warm` s (the
 * layers settle), then renders `secs` s twice over from the same seed: once after `fn(s)` (the sound) and once without
 * (the bed, to subtract). Returns { pcm, bed, rate, sound }.
 */
export async function renderAudio({ take = null, themes = () => null } = {}) {
  const G = globalThis;
  G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
  const { installAudio } = await import('../../engine/webaudio.js');
  delete G.AudioContext; installAudio(G, { sampleRate: RATE });
  const { Sound } = await import('../../src/audio.js');
  const { SampleBank, SFX } = await import('../../src/sfx.js');
  const made = [];
  /** A fresh Sound, started and calm, its takes loaded (or none). */
  const fresh = async (level, seed) => {
    const s = seeded(() => new Sound(level, { score: false }), seed);
    seeded(() => s.start(), seed);
    clearInterval(s.scheduler); clearTimeout(s._preload);
    const ctx = s.ctx;
    // (the bank fed the decoded WAVs: a fetch that hands back the take's name, a decode that builds its buffer)
    const fetcher = async (url) => ({ ok: !!take, arrayBuffer: async () => url.split('/').pop() });
    s.bank = new SampleBank(ctx, { base: 'sfx/', fetcher, rand: () => Math.random() });
    ctx.decodeAudioData = (name, ok, fail) => {
      const d = take?.(name);
      if (!d) { const e = new Error('no take'); fail?.(e); return Promise.reject(e); }
      const b = ctx.createBuffer(d.channels.length, d.channels[0].length, d.rate);
      d.channels.forEach((c, i) => b.getChannelData(i).set(c));
      ok?.(b); return Promise.resolve(b);
    };
    if (take) await s.bank.preload(); else for (const g of Object.keys(SFX)) await s.bank.load(g).catch(() => {});
    s.update(CALM);
    made.push(s);
    return s;
  };
  const render = async (fn, { level = 'desert', secs = 2, setup = null, warm = 0.5, seed = 12345 } = {}) => {
    const once = async (play) => {
      const s = await fresh(level, seed);
      return seeded(() => {
        setup?.(s); s.update(CALM); s.ctx.render(Math.round(RATE * warm));
        if (play) fn(s);
        return { pcm: s.ctx.render(Math.round(RATE * secs)), sound: s };
      }, seed + 1);
    };
    const a = await once(true), b = await once(false);
    return { pcm: a.pcm, bed: b.pcm, rate: RATE, sound: a.sound };
  };
  /**
   * The world's music as it plays (its scheduler stepped every 0.1 s of the render), `secs` long after `warm`, with
   * `during(s, t)` called each step (a line spoken over it, a moment's swell): the PCM and the 50 ms windows' levels.
   * `recording`: the world's Suno theme (src/soundtracks.js SOUNDTRACKS, decoded by afconvert) at the gain the engines
   * give it (src/theme-levels.js, the browser's prepareSoundtrack measures the same), its tail joined to its opening,
   * playing from `at` s in (`secs` left out: once round the loop), as Music: Always plays it (issue #474: the score silent under it, its ambience on); where
   * it can't be decoded (no afconvert), or `recording` false: the procedural score (`recorded` says which).
   */
  const score = async (level = 'desert', { secs = null, warm = 2, during = null, seed = 777, setup = null, recording = false, at = 0 } = {}) => {
    const s = seeded(() => new Sound(level, { score: true }), seed);
    seeded(() => s.start(), seed);
    clearInterval(s.scheduler); clearTimeout(s._preload);
    s.soundtrack = null;
    try { s.trackAbort?.abort?.(); } catch { /* none */ }   // (its own load, by fetch: never here)
    made.push(s);
    const T = recording ? themeOf(level) : null, d = T ? themes(T.file) : null;
    if (d) {
      const ctx = s.ctx, fade = Math.min(Math.floor(d.rate * 2), Math.floor(d.channels[0].length / 4)), n = d.channels[0].length - fade;
      const b = ctx.createBuffer(d.channels.length, n, d.rate);
      d.channels.forEach((c, i) => {
        const o = b.getChannelData(i);
        for (let k = 0; k < n; k++) o[k] = c[k] * T.gain;
        for (let k = 0; k < fade; k++) { const m = k / Math.max(1, fade - 1); o[k] = (c[n + k] * (1 - m) + c[k] * m) * T.gain; }
      });
      // (as startTrack and musicMomentsUpdate leave it: the theme's gain at 1 into the music bus, the source looping)
      const g = ctx.createGain(); g.gain.value = 1; g.connect(s.music);
      const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.connect(g); src.start(ctx.currentTime, at % b.duration);
      Object.assign(s, { trackBuffer: b, trackGain: g, recordedTrack: src, trackOn: true });
      secs ??= b.duration;   // (left out: the whole loop, once round)
    }
    secs ??= 24;
    return seeded(() => {
      setup?.(s);
      const step = 128 * Math.round((RATE * 0.1) / 128), N = Math.round(secs / 0.1), out = new Float32Array(N * step * 2);
      for (let i = 0; i < Math.round(warm / 0.1); i++) { s.update(CALM); s.listen({ x: 0, y: 0, z: 0 }, 0); s.schedule(); s.ctx.render(step); }
      for (let i = 0; i < N; i++) { s.update(CALM); s.listen({ x: 0, y: 0, z: 0 }, 0); during?.(s, i * 0.1); s.schedule(); out.set(s.ctx.render(step).subarray(0, step * 2), i * step * 2); }
      return { pcm: out, rate: RATE, sound: s, recorded: !!d, file: d ? T.file : null, gain: d ? T.gain : null };
    }, seed + 1);
  };
  const close = () => { for (const s of made) { clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.(); } made.length = 0; };
  return { render, fresh, score, close, Sound, samples: !!take };
}
