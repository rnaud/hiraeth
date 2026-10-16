// The sound QC's renderer (.claude/skills/sound-qc/SKILL.md): the game's own Sound (src/audio.js) on the in-memory Web
// Audio (engine/webaudio.js), calm, its score off, one call rendered from the moment it is made. The recorded takes
// (public/sfx/) decoded here (macOS afconvert into <cache>/*.wav) when asked, so a sound is heard as the browser plays
// it; without them, as an engine with no decoder does (the synth layers alone).
//
//   const R = await renderer({ samples: true, cache })
//   R.render((s) => s.fluidSlash(0), { level: 'desert', secs: 2, setup })  → { pcm, bed, rate }
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const RATE = 48000;
export const CALM = { speed: 0, gust: 0, storm: 0, rain: 0, rainRoof: 0, thrusting: false, riding: false, rideKind: null, rideSpeed: 0, altitude: 0 };

/** A 16-bit PCM WAV's channels as Float32Arrays, and its rate. */
export function readWav(buf) {
  let p = 12, ch = 1, rate = 44100, bits = 16, data = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4), n = buf.readUInt32LE(p + 4);
    if (id === 'fmt ') { ch = buf.readUInt16LE(p + 10); rate = buf.readUInt32LE(p + 12); bits = buf.readUInt16LE(p + 22); }
    if (id === 'data') { data = buf.subarray(p + 8, p + 8 + n); break; }
    p += 8 + n + (n & 1);
  }
  if (!data || bits !== 16) throw new Error('not a 16-bit WAV');
  const frames = Math.floor(data.length / 2 / ch), out = Array.from({ length: ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) out[c][i] = data.readInt16LE((i * ch + c) * 2) / 32768;
  return { rate, channels: out };
}

/** Each take of the bank decoded once (afconvert, macOS) into `cache`; null where it can't be (no afconvert: the synth). */
export function decodedTakes(cache) {
  mkdirSync(cache, { recursive: true });
  const takes = new Map();
  return (name) => {
    if (takes.has(name)) return takes.get(name);
    const mp3 = join(ROOT, 'public/sfx', name), wav = join(cache, name.replace(/\.mp3$/, '.wav'));
    let got = null;
    try {
      if (!existsSync(wav)) execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${RATE}`, mp3, wav], { stdio: 'ignore' });
      got = readWav(readFileSync(wav));
    } catch { got = null; }
    takes.set(name, got);
    return got;
  };
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
 * The renderer. `samples`: the recorded takes too (decoded by afconvert into `cache`), as the browser hears them.
 * render(fn, { level, secs, setup, warm }) makes a fresh Sound in `level`, calm, runs `setup(s)`, renders `warm` s (the
 * layers settle), then renders `secs` s twice over from the same seed: once after `fn(s)` (the sound) and once without
 * (the bed, to subtract). Returns { pcm, bed, rate, sound }.
 */
export async function renderer({ samples = true, cache = join(tmpdir(), 'hiraeth-sound-qc-takes') } = {}) {
  const G = globalThis;
  G.window ??= G; G.addEventListener ??= () => {}; G.removeEventListener ??= () => {};
  const { installAudio } = await import(join(ROOT, 'engine/webaudio.js'));
  delete G.AudioContext; installAudio(G, { sampleRate: RATE });
  const { Sound } = await import(join(ROOT, 'src/audio.js'));
  const { SampleBank, SFX } = await import(join(ROOT, 'src/sfx.js'));
  const take = samples ? decodedTakes(cache) : null;
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
   * The world's procedural score (its scheduler stepped every 0.1 s of the render), `secs` long after `warm`, with
   * `during(s, t)` called each step (a line spoken over it, a moment's swell): the PCM and the 50 ms windows' levels.
   */
  const score = async (level = 'desert', { secs = 24, warm = 2, during = null, seed = 777, setup = null } = {}) => {
    const s = seeded(() => new Sound(level, { score: true }), seed);
    seeded(() => s.start(), seed);
    clearInterval(s.scheduler); clearTimeout(s._preload);
    s.soundtrack = null;   // (the recorded theme is the browser's: the procedural score is what every world has)
    made.push(s);
    return seeded(() => {
      setup?.(s);
      const step = 128 * Math.round((RATE * 0.1) / 128), N = Math.round(secs / 0.1), out = new Float32Array(N * step * 2);
      for (let i = 0; i < Math.round(warm / 0.1); i++) { s.update(CALM); s.listen({ x: 0, y: 0, z: 0 }, 0); s.schedule(); s.ctx.render(step); }
      for (let i = 0; i < N; i++) { s.update(CALM); s.listen({ x: 0, y: 0, z: 0 }, 0); during?.(s, i * 0.1); s.schedule(); out.set(s.ctx.render(step).subarray(0, step * 2), i * step * 2); }
      return { pcm: out, rate: RATE, sound: s };
    }, seed + 1);
  };
  const close = () => { for (const s of made) { clearInterval(s.scheduler); clearInterval(s.menuTimer); s._unlisten?.(); } made.length = 0; };
  return { render, fresh, score, close, Sound, samples: !!take };
}
