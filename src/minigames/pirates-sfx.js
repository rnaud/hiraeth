// The chime pirates' sounds (issue #326: "better sound effects"), made with the game's own synth (src/audio.js Sound:
// sweep, burst, noiseGlide, pluck on its effects bus), each a few layers: a body (a low thump or a tone), a snap (a
// short noise at the attack) and a tail. Punchy, not harsh: the noise is filtered, the tones are triangles and sines
// (a sawtooth only low and short), nothing above ~4 kHz rings. Silent when muted or before the sound has started.
// Every one is on the music page (src/music-page/catalog.js, "Chime pirates"; tests/music-page.test.js checks it).
//
//   const snd = pirateSounds(ctx.sound);  snd.shot(); snd.boom(1.2); snd.engine(1, 0.4); …

/** What each sound is, for the music page (and the tests: every one of pirateSounds is here). */
export const PIRATE_SOUNDS = {
  shot: 'The twin bolts',
  enemy: 'A pirate fires',
  tell: 'A pirate about to fire (its telegraph)',
  hit: 'A bolt strikes a hull',
  boom: 'An explosion',
  clank: 'A bolt off the captain\'s armour',
  deflect: 'The roll turns a shot aside',
  roll: 'The barrel roll',
  charge: 'The charged shot let go',
  lock: 'The charge locks on',
  missile: 'A missile loosed',
  dry: 'No missiles left',
  pickup: 'A repair ring',
  rearm: 'A missile back',
  hull: 'A pip of hull lost',
  warning: 'Hull low',
  incoming: 'The captain\'s gunship arrives',
  combo: 'A chain of kills',
  comms: 'A line over the comms',
  tally: 'The tally: points into chimes',
  engine: 'The ship\'s engine hum (held)',
};

export function pirateSounds(sound) {
  const on = () => !!sound?.ctx && !sound.muted && !!sound.fx;
  const now = () => sound.ctx.currentTime;
  let lastShot = 0, lastHit = 0, lastEnemy = 0;
  /** A low thump: a sine falling from f0 to f1 over dur. */
  const thump = (t, f0, f1, dur, vol) => sound.sweep(t, f0, f1, dur, vol, 'sine');
  /** A filtered noise snap (the attack of a sound). */
  const snap = (t, freq, dur, vol, type = 'bandpass', q = 0.9) => sound.burst(t, { dur, type, freq, q, vol });
  const engine = () => {
    if (!sound?.ctx?.createGain || !sound.fx) return null;
    // (one hum for the page's life, kept on the Sound: a Retry finds it again)
    return (sound._pirateEngine ??= (() => {
      const ctx = sound.ctx, g = ctx.createGain(), f = ctx.createBiquadFilter();
      g.gain.value = 0; f.type = 'lowpass'; f.frequency.value = 340; f.Q.value = 0.9;
      const oscs = [[62, 'sawtooth', 0.5], [93.3, 'triangle', 0.7], [124.6, 'sine', 0.4]].map(([hz, type, v]) => {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; o.frequency.value = hz; og.gain.value = v;
        o.connect(og).connect(f); o.start();
        return { o, hz };
      });
      const n = ctx.createBufferSource(); n.buffer = sound.noiseBuf; n.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 520; nf.Q.value = 0.7;
      const ng = ctx.createGain(); ng.gain.value = 0.35;
      n.connect(nf).connect(ng).connect(f); n.start();
      f.connect(g).connect(sound.fx);
      return { g, f, nf, oscs };
    })());
  };
  return {
    /** The twin bolts: a bright chirp down, a click at the muzzle, a little body under it. */
    shot() {
      if (!on()) return; const t = now(); if (t - lastShot < 0.05) return; lastShot = t;
      sound.sweep(t, 1900, 640, 0.07, 0.026, 'triangle');
      snap(t, 3200, 0.03, 0.035);
      thump(t, 260, 120, 0.06, 0.03);
    },
    /** A pirate fires: a lower, rougher zap, short. */
    enemy() {
      if (!on()) return; const t = now(); if (t - lastEnemy < 0.04) return; lastEnemy = t;
      sound.sweep(t, 760, 260, 0.13, 0.022, 'triangle');
      sound.sweep(t, 190, 120, 0.08, 0.014, 'sawtooth');
      snap(t, 1400, 0.05, 0.03);
    },
    /**
     * A pirate about to fire (its telegraph): a rising whine over `dur` s, the kind's own: a fighter's quick chirp, a
     * gunboat's whine, a bomber's two blips, a turret's low growl rising, the bridge's swell.
     */
    tell(kind = 'skiff', dur = 0.5) {
      if (!on()) return; const t = now();
      if (kind === 'skiff') { sound.sweep(t, 900, 1500, Math.min(0.25, dur), 0.012, 'sine'); sound.pluck(1175, t + Math.min(0.25, dur), 0.015, 'sine', sound.fx); return; }
      if (kind === 'hauler') { sound.pluck(660, t, 0.035, 'triangle', sound.fx); sound.pluck(660, t + dur * 0.5, 0.035, 'triangle', sound.fx); return; }
      if (kind === 'turret') { sound.sweep(t, 140, 420, dur, 0.035, 'triangle'); sound.sweep(t, 70, 210, dur, 0.02, 'sawtooth'); return; }
      if (kind === 'core') { sound.sweep(t, 220, 880, dur, 0.035, 'sine'); sound.noiseGlide?.(t, { type: 'bandpass', f: 400, f1: 2400, q: 1.6, dur, vol: 0.04 }); return; }
      sound.sweep(t, 300, 980, dur, 0.026, 'triangle');   // (the gunboat)
    },
    /** A bolt strikes a hull: a dry metal tick and a spit of noise. */
    hit() {
      if (!on()) return; const t = now(); if (t - lastHit < 0.03) return; lastHit = t;
      sound.pluck(1568, t, 0.03, 'triangle', sound.fx);
      snap(t, 3600, 0.035, 0.03, 'highpass');
    },
    /**
     * An explosion, k its size (0.5 a rock or a mine, 1 a fighter, 1.6 a bomber, 2+ the captain's parts): a deep
     * thump falling away, the body's rumble (low noise), a mid crack at the start, and the debris crackling after.
     */
    boom(k = 1) {
      if (!on()) return; const t = now(), K = Math.min(2.4, k);
      thump(t, 150 - 25 * Math.min(K, 2), 38, 0.25 + 0.3 * K, 0.1 + 0.08 * K);
      sound.burst(t, { dur: 0.3 + 0.35 * K, type: 'lowpass', freq: 380 + 220 * K, q: 0.7, vol: 0.1 + 0.1 * K, rate: 0.6 });
      snap(t, 1700, 0.07, 0.05 + 0.025 * K);
      for (let i = 0; i < Math.round(2 + 2 * K); i++) snap(t + 0.06 + i * 0.05 + Math.random() * 0.05, 1100 + Math.random() * 1800, 0.04, 0.02 + 0.01 * K, 'bandpass', 3);
    },
    /** A bolt off the captain's armour: a low clank, a ring. */
    clank() { if (!on()) return; const t = now(); sound.pluck(330, t, 0.05, 'triangle', sound.fx); sound.pluck(495, t, 0.025, 'sine', sound.fx); snap(t, 2500, 0.06, 0.04, 'highpass'); },
    /** The roll turns a shot aside: a bright glassy ping, falling. */
    deflect() { if (!on()) return; const t = now(); sound.sweep(t, 2600, 1700, 0.18, 0.03, 'sine'); sound.pluck(2093, t, 0.03, 'triangle', sound.fx); },
    /** The barrel roll: a whoosh of air swept up over a low turn of the hull. */
    roll() { if (!on()) return; const t = now(); sound.noiseGlide?.(t, { type: 'bandpass', f: 520, f1: 2300, q: 0.9, dur: 0.38, vol: 0.09, rate: 1.1 }); sound.sweep(t, 150, 95, 0.3, 0.03, 'triangle'); },
    /** The charged shot let go: a rising surge into a soft boom. */
    charge() { if (!on()) return; const t = now(); sound.sweep(t, 180, 1200, 0.3, 0.04, 'triangle'); thump(t + 0.02, 180, 70, 0.25, 0.06); snap(t, 900, 0.18, 0.05, 'bandpass', 0.7); },
    /** The charge locks on: two high blips. */
    lock() { if (!on()) return; const t = now(); sound.pluck(1318, t, 0.045, 'sine', sound.fx); sound.pluck(1760, t + 0.07, 0.045, 'sine', sound.fx); },
    /** A missile loosed: a hiss down and the motor's rising whine. */
    missile() { if (!on()) return; const t = now(); sound.burst(t, { dur: 0.35, type: 'bandpass', freq: 2200, q: 0.6, vol: 0.06, rate: 1.2 }); sound.sweep(t + 0.05, 260, 900, 0.45, 0.024, 'triangle'); thump(t, 120, 60, 0.12, 0.05); },
    /** None left: a dry click. */
    dry() { if (!on()) return; const t = now(); sound.pluck(220, t, 0.035, 'triangle', sound.fx); snap(t, 1800, 0.02, 0.03); },
    /** A repair ring: a rising sparkle of three notes over a soft swell. */
    pickup() { if (!on()) return; const t = now(); [0, 4, 7, 12].forEach((s, i) => sound.pluck(784 * Math.pow(2, s / 12), t + i * 0.06, 0.045, 'sine', sound.fx)); sound.sweep(t, 400, 800, 0.4, 0.02, 'triangle'); },
    /** A missile back in the rack: a latch and a click. */
    rearm() { if (!on()) return; const t = now(); snap(t, 2200, 0.03, 0.04); sound.pluck(880, t + 0.05, 0.04, 'triangle', sound.fx); sound.pluck(1175, t + 0.1, 0.04, 'triangle', sound.fx); },
    /** A pip of hull lost: a crunch and a low thud, over the runner's hurt. */
    hull() { if (!on()) return; const t = now(); sound.burst(t, { dur: 0.28, type: 'bandpass', freq: 900, q: 0.6, vol: 0.16, rate: 0.8 }); thump(t, 160, 48, 0.32, 0.12); sound.pluck(196, t + 0.05, 0.07, 'triangle', sound.fx); },
    /** The hull low: two falling tones, twice. */
    warning() { if (!on()) return; const t = now(); for (const d of [0, 0.36]) { sound.sweep(t + d, 880, 660, 0.16, 0.035, 'triangle'); sound.sweep(t + d + 0.17, 660, 520, 0.16, 0.03, 'triangle'); } },
    /** The captain's gunship arrives: a low horn swelling, rumble under it. */
    incoming() { if (!on()) return; const t = now(); sound.sweep(t, 70, 104, 1.4, 0.05, 'sawtooth'); sound.sweep(t, 140, 208, 1.4, 0.03, 'triangle'); sound.burst(t, { dur: 1.6, type: 'lowpass', freq: 220, q: 0.6, vol: 0.12, rate: 0.5 }); },
    /** A chain of kills (n in a row): a note a step higher each one. */
    combo(n = 2) { if (!on()) return; const t = now(), f = 660 * Math.pow(2, Math.min(n - 2, 8) * 2 / 12); sound.pluck(f, t, 0.04, 'sine', sound.fx); sound.pluck(f * 1.5, t + 0.05, 0.025, 'sine', sound.fx); },
    /** A line over the comms: two soft blips. */
    comms() { if (!on()) return; const t = now(); sound.pluck(880, t, 0.035, 'sine', sound.fx); sound.pluck(1175, t + 0.08, 0.035, 'sine', sound.fx); },
    /** The tally: a chime as the points become chimes. */
    tally(k = 0) { if (on()) sound.pluck(1047 * Math.pow(1.122, k % 6), now(), 0.05, 'sine', sound.fx); },
    /**
     * The ship's engine hum, held: `level` 0..1 (0 off), `push` 0..1 (how hard it is steered or boosted: the pitch and
     * the filter open a little). Called every frame while the run flies; 0 at the end.
     */
    engine(level = 1, push = 0) {
      const E = engine();
      if (!E) return;
      const t = now(), L = sound.muted ? 0 : Math.max(0, Math.min(1, level));
      E.g.gain.setTargetAtTime(0.045 * L, t, 0.12);
      E.f.frequency.setTargetAtTime(340 + 420 * push, t, 0.15);
      E.nf.frequency.setTargetAtTime(520 + 600 * push, t, 0.15);
      for (const o of E.oscs) o.o.frequency.setTargetAtTime(o.hz * (1 + 0.12 * push), t, 0.2);
    },
  };
}
