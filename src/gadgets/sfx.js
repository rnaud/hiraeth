// The gadgets' sounds, made from the game's own synth (src/audio.js Sound: sweep, burst on the effects bus).
// Each takes the Sound (or nothing: silent) and a few words of what happened; distance is left to the caller
// (`vol`). Nothing plays before the audio has started (sound.ctx).
//
//   sfx.hookFire(sound) · hookCatch(sound, metal) · hookReel(sound) · hookMiss(sound)
//   sfx.bombThrow(sound) · bombBounce(sound, k) · bombFuse(sound) · bombBlast(sound, vol)
//   sfx.equip(sound) · crumble(sound) · click(sound, on)

const now = (s) => (s?.ctx ? s.ctx.currentTime : null);

export const sfx = {
  /** Something taken in hand: a soft leather-and-brass clack. */
  equip(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.04, type: 'bandpass', freq: 2400, q: 2, vol: 0.08 }); s.sweep(t + 0.02, 520, 880, 0.08, 0.05, 'triangle'); },
  /** The hook leaves: a spring's twang and the line paying out. */
  hookFire(s) { const t = now(s); if (t == null) return; s.sweep(t, 900, 260, 0.16, 0.12, 'sawtooth'); s.burst(t, { dur: 0.22, type: 'highpass', freq: 3200, q: 0.6, vol: 0.08, rate: 1.4 }); },
  /** It bites: a clank in stone or metal (higher), a thud in anything soft. */
  hookCatch(s, metal = false) { const t = now(s); if (t == null) return; if (metal) [1, 1.41].forEach((m, i) => s.sweep(t + i * 0.01, 1250 * m, 1100 * m, 0.22, 0.07, 'triangle')); s.burst(t, { dur: 0.09, type: 'lowpass', freq: 900, q: 0.8, vol: 0.2, rate: 0.7 }); },
  /** The reel winds in: a rising ratchet. */
  hookReel(s) { const t = now(s); if (t == null) return; for (let i = 0; i < 6; i++) s.burst(t + i * 0.045, { dur: 0.025, type: 'bandpass', freq: 1800 + i * 140, q: 4, vol: 0.05 }); s.sweep(t, 220, 520, 0.3, 0.04, 'square'); },
  /** Nothing to catch on: the hook comes back empty. */
  hookMiss(s) { const t = now(s); if (t == null) return; s.sweep(t, 600, 300, 0.2, 0.06, 'triangle'); },
  /** A bomb thrown: a grunt of air. */
  bombThrow(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.16, type: 'bandpass', freq: 700, q: 0.7, vol: 0.12, rate: 0.8 }); s.sweep(t, 300, 180, 0.12, 0.05); },
  /** It lands and bounces (k 0..1 how hard). */
  bombBounce(s, k = 1) { const t = now(s); if (t == null || k < 0.08) return; s.burst(t, { dur: 0.07, type: 'lowpass', freq: 500, q: 0.9, vol: 0.12 * Math.min(1, k) }); s.sweep(t, 180, 90, 0.08, 0.06 * Math.min(1, k)); },
  /** The fuse: a hiss and a tick. */
  bombFuse(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.05, type: 'highpass', freq: 5200, q: 0.5, vol: 0.035, rate: 1.6 }); },
  /** The blast: a deep thump, a wet splatter and a rumble going away. */
  bombBlast(s, vol = 1) {
    const t = now(s); if (t == null || vol < 0.02) return;
    s.sweep(t, 140, 34, 0.55, 0.42 * vol);
    s.burst(t, { dur: 0.5, type: 'lowpass', freq: 700, q: 0.6, vol: 0.34 * vol, rate: 0.5 });
    s.burst(t + 0.03, { dur: 0.35, type: 'bandpass', freq: 1500, q: 0.5, vol: 0.16 * vol, rate: 0.9 });
    s.burst(t + 0.12, { dur: 0.9, type: 'lowpass', freq: 260, q: 0.5, vol: 0.18 * vol, rate: 0.35 });
  },
  /** A cracked wall gives: stones tumbling. */
  crumble(s) { const t = now(s); if (t == null) return; for (let i = 0; i < 5; i++) s.burst(t + 0.05 + i * 0.07 + Math.random() * 0.04, { dur: 0.12, type: 'lowpass', freq: 600 + Math.random() * 500, q: 0.8, vol: 0.1 }); },
  /** A rope cut: a sharp snap and the fibres giving. */
  snip(s) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.05, type: 'highpass', freq: 4200, q: 1.2, vol: 0.12 }); s.sweep(t, 1400, 500, 0.09, 0.05, 'triangle'); },
  /** A floor plate pressed (on) or let up. */
  click(s, on = true) { const t = now(s); if (t == null) return; s.burst(t, { dur: 0.04, type: 'bandpass', freq: on ? 1600 : 1100, q: 3, vol: 0.1 }); s.sweep(t, on ? 300 : 420, on ? 420 : 300, 0.12, 0.05, 'triangle'); },
};
