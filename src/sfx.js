// Recorded effects: retained CC0 foley plus selected generated sounds (public/sfx/,
// per-file provenance in public/sfx/manifest.json and docs/credits.md).
//
//   const bank = new SampleBank(ctx)          (Sound.start makes one: sound.bank)
//   bank.preload()                            fetch and decode every group, a few at a time
//   bank.play('step-sand', { dest, vol, rate, when, pan })  → true, or false (not loaded yet, or never:
//                                             the caller plays its synthesised sound instead)
//
// Nothing waits for it: a group not loaded yet starts loading on its first play and the synth plays
// that time; a download or decode that fails (offline with the file missing, an engine bridge with
// no decoder) leaves the synth for good. Each play picks the next of the group's takes from a
// shuffled round (never the same take twice running) and varies its pitch and level a little, so
// a run of footsteps or a combo never machine-guns.

/**
 * The groups: n takes (`<group>-<i>.<ext>`, MP3 by default), the level (on the effects bus, × the Effects volume),
 * the pitch spread (± playback rate) and the level spread (down to 1 - gain). The footsteps, the grab and the
 * stroke 2.5-4.5 dB down since the sound QC (issue #379): they sat 3-7 dB under the music, foley sits 8 or more under.
 */
import { ACTION_SFX } from './action-sfx.js';

export const SFX = {
  ...ACTION_SFX,
  'blade-light': { n: 1, ext: 'wav', vol: 0.16, rate: 0.025, gain: 0.08 },
  'blade-heavy': { n: 1, ext: 'wav', vol: 0.16, rate: 0.025, gain: 0.08 },
  'shield-parry': { n: 1, ext: 'wav', vol: 0.32, rate: 0.05, gain: 0.18 },
  'fluid-shot': { n: 1, ext: 'wav', vol: 0.4, rate: 0.03, gain: 0.06 },
  'ship-idle': { n: 1, ext: 'wav', vol: 0.12, rate: 0, gain: 0 },
  'ship-thrust': { n: 1, ext: 'wav', vol: 0.28, rate: 0, gain: 0 },
  'deck-close': { n: 1, ext: 'wav', vol: 0.3, rate: 0, gain: 0 },
  'deck-open': { n: 1, ext: 'wav', vol: 0.3, rate: 0, gain: 0 },
  'step-stone': { n: 4, ext: 'wav', vol: 0.15, rate: 0.07, gain: 0.25 },
  'step-grass': { n: 4, ext: 'wav', vol: 0.12, rate: 0.08, gain: 0.25 },
  'step-sand': { n: 4, ext: 'wav', vol: 0.15, rate: 0.08, gain: 0.25 },
  land: { n: 3, vol: 0.34, rate: 0.06, gain: 0.15 },
  'land-heavy': { n: 3, vol: 0.42, rate: 0.06, gain: 0.1 },
  fall: { n: 2, vol: 0.36, rate: 0.05, gain: 0.1 },
  cloth: { n: 4, vol: 0.14, rate: 0.1, gain: 0.3 },
  belt: { n: 2, vol: 0.1, rate: 0.1, gain: 0.3 },
  grab: { n: 2, vol: 0.12, rate: 0.08, gain: 0.2 },
  drop: { n: 1, vol: 0.14, rate: 0.08, gain: 0.2 },
  creak: { n: 3, vol: 0.14, rate: 0.06, gain: 0.2 },
  knock: { n: 3, vol: 0.16, rate: 0.08, gain: 0.2 },
  flap: { n: 4, vol: 0.16, rate: 0.08, gain: 0.25 },
  breath: { n: 4, vol: 0.06, rate: 0.05, gain: 0.3 },
  effort: { n: 3, vol: 0.065, rate: 0.05, gain: 0.25 },
  hurt: { n: 4, vol: 0.075, rate: 0.04, gain: 0.2 },
  sigh: { n: 3, vol: 0.055, rate: 0.04, gain: 0.25 },
  swing: { n: 4, vol: 0.15, rate: 0.08, gain: 0.2 },
  'swing-heavy': { n: 2, vol: 0.17, rate: 0.06, gain: 0.15 },
  splat: { n: 4, vol: 0.2, rate: 0.1, gain: 0.2 },
  stroke: { n: 5, vol: 0.07, rate: 0.08, gain: 0.3 },
  splash: { n: 3, vol: 0.13, rate: 0.08, gain: 0.25 },
};

/** Every file of the bank, as named in public/sfx/. */
export const sfxFiles = (table = SFX) => Object.entries(table).flatMap(([g, s]) => Array.from({ length: s.n }, (_, i) => `${g}-${i}.${s.ext ?? 'mp3'}`));

/** One play's variation of a group: { rate, gain } around 1 (rand: 0..1). */
export function variation(spec, rand = Math.random) {
  const r = spec?.rate ?? 0, g = spec?.gain ?? 0;
  return { rate: 1 + (rand() * 2 - 1) * r, gain: 1 - rand() * g };
}

/**
 * Takes in a shuffled round: every take once before any comes again, and never the one just played
 * at the turn of a round. next() → an index 0..n-1.
 */
export class RoundRobin {
  constructor(n, rand = Math.random) { this.n = Math.max(1, n | 0); this.rand = rand; this.bag = []; this.last = -1; }
  next() {
    if (this.n === 1) return 0;
    if (!this.bag.length) {
      const b = Array.from({ length: this.n }, (_, i) => i);
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      if (b[b.length - 1] === this.last) [b[0], b[b.length - 1]] = [b[b.length - 1], b[0]];
      this.bag = b;
    }
    return (this.last = this.bag.pop());
  }
}

const defaultBase = () => `${import.meta.env?.BASE_URL ?? './'}sfx/`;

/** decodeAudioData both ways (the promise, and the callbacks older Safari only has). */
function decode(ctx, data) {
  return new Promise((ok, fail) => {
    try { ctx.decodeAudioData(data, ok, fail)?.then?.(ok, fail); } catch (e) { fail(e); }
  });
}

export class SampleBank {
  /**
   * @param ctx the AudioContext
   * @param o.base where the files are (default: the site's sfx/), o.fetcher (fetch), o.rand,
   *        o.table (SFX)
   */
  constructor(ctx, { base = defaultBase(), fetcher = globalThis.fetch?.bind(globalThis), rand = Math.random, table = SFX } = {}) {
    this.ctx = ctx; this.base = base; this.fetcher = fetcher; this.rand = rand; this.table = table;
    this.groups = new Map();   // group → { state: 'loading' | 'ready' | 'failed', buffers: [], rr, promise }
    this.active = new Set(); this.disposed = false;
    this.abort = typeof AbortController === 'function' ? new AbortController() : null;
    this.played = [];          // the last plays (a test / dev hook): { group, take, rate, vol }
  }

  /** 'idle' (never asked), 'loading', 'ready' (at least one take decoded) or 'failed'. */
  state(group) { return this.groups.get(group)?.state ?? 'idle'; }

  /** Decoded source seconds (0 while unavailable); single-take cues use this for physical progress. */
  duration(group) { return this.groups.get(group)?.buffers[0]?.duration ?? 0; }

  /** Fetch and decode a group's takes (once). Resolves to whether any take is ready. */
  load(group) {
    const spec = this.table[group];
    if (!spec || this.disposed) return Promise.resolve(false);
    let G = this.groups.get(group);
    if (G) return G.promise;
    G = { state: 'loading', buffers: [], rr: null };
    this.groups.set(group, G);
    const one = async (i) => {
      if (!this.fetcher) throw new Error('no fetch');
      const r = await this.fetcher(`${this.base}${group}-${i}.${spec.ext ?? 'mp3'}`, this.abort ? { signal: this.abort.signal } : undefined);
      if (!r?.ok) throw new Error(`HTTP ${r?.status}`);
      return decode(this.ctx, await r.arrayBuffer());
    };
    G.promise = Promise.all(Array.from({ length: spec.n }, (_, i) => one(i).catch(() => null))).then((bufs) => {
      G.buffers = this.disposed ? [] : bufs.filter(Boolean);
      G.state = G.buffers.length ? 'ready' : 'failed';
      G.rr = new RoundRobin(G.buffers.length, this.rand);
      return G.state === 'ready';
    });
    return G.promise;
  }

  /** Load every group, `at` a time. */
  async preload(at = 4) {
    const todo = Object.keys(this.table);
    const worker = async () => { while (todo.length) await this.load(todo.shift()); };
    await Promise.all(Array.from({ length: at }, worker));
  }

  /**
   * Play one take of a group into `dest` (a node on the effects bus): `vol` × the group's level,
   * `rate` × its pitch, at `when` (the context's time; now by default), panned by `pan` (-1..1).
   * False when the group isn't ready (it starts loading): the caller's synth plays instead.
   */
  play(group, options = {}) { return !!this.start(group, { ...options, loop: false }); }

  /** Stoppable playback; callers own loop handles and stop them on exit/skip. Audio-clock fades pause with the context. */
  start(group, { dest, vol = 1, rate = 1, when = null, pan = 0, loop = false, offset = 0, maxDuration = null } = {}) {
    if (maxDuration !== null && (!Number.isFinite(maxDuration) || maxDuration <= 0)) return null;
    if (this.disposed || !dest || !Number.isFinite(vol) || vol < 0 || (!loop && vol === 0) || !Number.isFinite(rate) || rate <= 0) return null;
    const G = this.groups.get(group);
    if (!G) { void this.load(group); return null; }
    if (G.state !== 'ready' || !Number.isFinite(offset) || offset < 0) return null;
    const ctx = this.ctx, spec = this.table[group], take = G.rr.next(), v = variation(spec, this.rand);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = G.buffers[take]; src.loop = !!loop;
    if (offset >= src.buffer.duration) return null;
    src.playbackRate.value = Math.max(0.25, v.rate * rate);
    const baseGain = spec.vol * v.gain;
    g.gain.value = baseGain * vol;
    let out = g, ended = false, stopping = false;
    if (Number.isFinite(pan) && pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    // A separate envelope preserves a bounded contact's gentle tail even if handle.set changes its mix gain.
    const envelope = maxDuration === null ? null : ctx.createGain();
    if (envelope) src.connect(envelope).connect(g); else src.connect(g);
    out.connect(dest);
    const clean = () => {
      if (ended) return;
      ended = true; this.active.delete(handle);
      try { src.disconnect(); envelope?.disconnect(); g.disconnect(); if (out !== g) out.disconnect(); } catch { /* context already closed */ }
    };
    const ramp = (param, value, seconds) => {
      const now = ctx.currentTime;
      if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
      else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
      param.linearRampToValueAtTime(value, now + seconds);
    };
    const handle = {
      duration: src.buffer.duration,
      set: ({ vol: nextVol, rate: nextRate } = {}) => {
        if (ended || stopping) return;
        if (Number.isFinite(nextVol) && nextVol >= 0) ramp(g.gain, baseGain * nextVol, 0.03);
        if (Number.isFinite(nextRate) && nextRate > 0) ramp(src.playbackRate, Math.max(0.25, v.rate * nextRate), 0.03);
      },
      stop: (fade = 0.1) => {
        if (ended || (stopping && fade !== 0)) return;
        stopping = true;
        const seconds = Number.isFinite(fade) ? Math.max(0, fade) : 0.1;
        ramp(g.gain, 0, seconds);
        try { src.stop(ctx.currentTime + seconds); } catch { /* already ended */ }
        if (!seconds) clean();
      },
    };
    src.onended = clean;
    this.active.add(handle);
    const start = Number.isFinite(when) ? Math.max(ctx.currentTime, when) : ctx.currentTime;
    try {
      src.start(start, offset);
      if (envelope) {
        const end = start + maxDuration, fade = Math.min(0.025, maxDuration / 2);
        envelope.gain.setValueAtTime(1, end - fade);
        envelope.gain.linearRampToValueAtTime(0, end);
        src.stop(end);
      }
    }
    catch { clean(); return null; }
    this.played.push({ group, take, rate: src.playbackRate.value, vol: g.gain.value, loop: !!loop, offset });
    if (this.played.length > 32) this.played.shift();
    return handle;
  }

  /** Prevent late decodes/starts and release every source, including a previously fading loop. */
  dispose() {
    this.disposed = true; this.abort?.abort();
    for (const handle of [...this.active]) handle.stop(0);
    this.groups.clear();
  }
}
