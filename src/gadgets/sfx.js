// The gadgets' sounds, made from the game's own synth (src/audio.js Sound: sweep, burst on the effects bus).
// Each takes the Sound (or nothing: silent) and a few words of what happened; distance is left to the caller
// (`vol`). Nothing plays before the audio has started (sound.ctx).
//
//   sfx.hookFire(sound) · hookCatch(sound, metal) · hookReel(sound) · hookMiss(sound)
//   sfx.hookYank(sound) · hookPin(sound, dur) · hookClank(sound) · hookSnap(sound) · hookDry(sound)   (a foe on the line: #399)
//   sfx.bombThrow(sound) · bombBounce(sound, k) · bombFuse(sound) · bombBlast(sound, vol)
//   sfx.equip(sound) · crumble(sound) · click(sound, on)

const now = (s) => (s?.ctx ? s.ctx.currentTime : null);
/** A random factor round 1 (the Sound's vary, ± spread): no two takes of a synth alike (sound QC, issue #531). */
export const vary = (s, spread = 0.06) => (s?.vary?.(spread) ?? 1);

export const sfx = {
  /** Something taken in hand: a soft leather-and-brass clack. */
  equip(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.04, type: 'bandpass', freq: 2400, q: 2, vol: 0.08 }); s.sweep(t + 0.02, 520, 880, 0.08, 0.05, 'triangle'); },
  /** The hook leaves: a spring's twang and the line paying out. */
  hookFire(s) { const t = now(s); if (t == null) return; const v = vary(s), g = vary(s, 0.12); s.sweep(t, 900 * v, 260 * v, 0.16, 0.08 * g, 'sawtooth'); s.burst(t, { dur: 0.22, type: 'highpass', freq: 3200 * v, q: 0.6, vol: 0.055 * g, rate: 1.4 * v }); },
  /** It bites: a clank in stone or metal (higher), a thud in anything soft. */
  hookCatch(s, metal = false) { const t = now(s); if (t == null) return; if (metal) [1, 1.41].forEach((m, i) => s.sweep(t + i * 0.01, 1250 * m, 1100 * m, 0.22, 0.07, 'triangle')); s.burst(t, { dur: 0.09, type: 'lowpass', freq: 900, q: 0.8, vol: 0.2, rate: 0.7 }); },
  /** The reel winds in: a rising ratchet. */
  hookReel(s) {
    const t = now(s); if (t == null) return;
    const v = vary(s), g = vary(s, 0.15), gap = 0.045 * vary(s, 0.12), n = 5 + Math.floor(Math.random() * 3);   // (a ratchet of 5 to 7 clicks)
    for (let i = 0; i < n; i++) s.burst(t + i * gap, { dur: 0.025, type: 'bandpass', freq: (1800 + i * 140) * v, q: 4, vol: 0.05 * g });
    s.sweep(t, 220 * v, 520 * v, 0.3, 0.04 * g, 'square');
  },
  /** Nothing to catch on: the hook comes back empty. */
  hookMiss(s) { const t = now(s); if (t == null) return; const v = vary(s); s.sweep(t, 600 * v, 300 * v, 0.2, 0.03 * vary(s, 0.12), 'triangle'); },
  /** A foe yanked off its feet on the line (issue #399): a whip-crack and the rope's rush. */
  hookYank(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.03, type: 'highpass', freq: 3800, q: 1.4, vol: 0.16 }); s.sweep(t + 0.01, 1700, 420, 0.07, 0.07, 'triangle'); s.burst(t + 0.02, { dur: 0.3, type: 'bandpass', freq: 900, q: 0.6, vol: 0.12, rate: 1.6 }); s.sweep(t + 0.04, 180, 420, 0.28, 0.06, 'sawtooth'); },
  /** A heavy foe pinned: the line snaps taut, then creaks under the strain for `dur` s. */
  hookPin(s, dur = 1.8) {
    const t = now(s); if (t == null) return;
    s.burst(t, { dur: 0.04, type: 'highpass', freq: 3000, q: 1, vol: 0.12 });
    s.sweep(t, 140, 95, 0.25, 0.14, 'sawtooth');
    for (let i = 0, n = Math.max(2, Math.round(dur / 0.3)); i < n; i++) s.burst(t + 0.18 + i * 0.3 + (i % 2) * 0.04, { dur: 0.12, type: 'bandpass', freq: 520 + (i % 3) * 70, q: 6, vol: 0.06 * (1 - i / (n + 1)), rate: 0.6 });
  },
  /** The hook rings off armour, a shell, a rolled-up roller: a bright clank, no bite. */
  hookClank(s) { const t = now(s); if (t == null) return; [1, 1.52, 2.1].forEach((m, i) => s.sweep(t + i * 0.006, 1500 * m, 1420 * m, 0.32 - i * 0.07, 0.07, 'triangle')); s.burst(t, { dur: 0.05, type: 'highpass', freq: 4200, q: 1, vol: 0.12 }); },
  /** The line thrown loose (a guardian shrugs it off; a pin broken off early): a rope's snap and its slap. */
  hookSnap(s) { const t = now(s); if (t == null) return; s.burst(t + 0.05, { dur: 0.04, type: 'highpass', freq: 5000, q: 1.2, vol: 0.13 }); s.sweep(t + 0.05, 1200, 300, 0.12, 0.06, 'triangle'); },
  /** Not ready (the cooldown after a catch): the reel's dry click. */
  hookDry(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.02, type: 'bandpass', freq: 2600, q: 5, vol: 0.07 }); s.burst(t + 0.06, { dur: 0.02, type: 'bandpass', freq: 2200, q: 5, vol: 0.05 }); },
  /** A bomb thrown: a grunt of air. */
  bombThrow(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.16, type: 'bandpass', freq: 700, q: 0.7, vol: 0.12, rate: 0.8 }); s.sweep(t, 300, 180, 0.12, 0.05); },
  /** It lands and bounces (k 0..1 how hard). */
  bombBounce(s, k = 1) { const t = now(s); if (t == null || k < 0.08) return; s.burst(t, { dur: 0.07, type: 'lowpass', freq: 500, q: 0.9, vol: 0.12 * Math.min(1, k) }); s.sweep(t, 180, 90, 0.08, 0.06 * Math.min(1, k)); },
  /** The fuse: a hiss and a tick. */
  bombFuse(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.05, type: 'highpass', freq: 5200, q: 0.5, vol: 0.035, rate: 1.6 }); },
  /** The blast: a deep thump, a wet splatter and a rumble going away. */
  bombBlast(s, vol = 1) {
    const t = now(s); if (t == null || vol < 0.02) return;
    const v = vary(s, 0.08), k = 0.4 * vol;   // (down into the impact band: it stood 6 dB over, issue #531)
    s.sweep(t, 140 * v, 34, 0.55, 0.42 * k);
    s.burst(t, { dur: 0.5, type: 'lowpass', freq: 700 * v, q: 0.6, vol: 0.34 * k, rate: 0.5 * v });
    s.burst(t + 0.03, { dur: 0.35, type: 'bandpass', freq: 1500 * v, q: 0.5, vol: 0.16 * k, rate: 0.9 });
    s.burst(t + 0.12, { dur: 0.9, type: 'lowpass', freq: 260 * v, q: 0.5, vol: 0.18 * k, rate: 0.35 });
  },
  /** A cracked wall gives: stones tumbling. */
  crumble(s) { const t = now(s); if (t == null) return; for (let i = 0; i < 5; i++) s.burst(t + 0.05 + i * 0.07 + Math.random() * 0.04, { dur: 0.12, type: 'lowpass', freq: 600 + Math.random() * 500, q: 0.8, vol: 0.1 }); },
  /** A rope cut: a sharp snap and the fibres giving. */
  snip(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.05, type: 'highpass', freq: 4200, q: 1.2, vol: 0.12 }); s.sweep(t, 1400, 500, 0.09, 0.05, 'triangle'); },
  /** A floor plate pressed (on) or let up. */
  click(s, on = true) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.04, type: 'bandpass', freq: on ? 1600 : 1100, q: 3, vol: 0.1 }); s.sweep(t, on ? 300 : 420, on ? 420 : 300, 0.12, 0.05, 'triangle'); },
};
