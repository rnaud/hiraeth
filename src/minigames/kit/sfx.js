// The minigames' little sounds, made with the game's own synth (src/audio.js Sound: pluck, sweep,
// burst on its effects bus), silent when muted or before the sound has started.
//
//   const sfx = gameSfx(ctx.sound);  sfx.coin(); sfx.gate(); sfx.miss(); …

export function gameSfx(sound) {
  const on = () => !!sound?.ctx && !sound.muted && sound.fx;
  const now = () => sound.ctx.currentTime;
  const note = (semi, base = 440) => base * Math.pow(2, semi / 12);
  const pl = (semi, dt = 0, vol = 0.1, type = 'triangle') => sound.pluck(note(semi), now() + dt, vol, type, sound.fx);
  return {
    /** The countdown's 3, 2, 1 (n) and its GO (n = 0). */
    tick(n) { if (!on()) return; if (n > 0) pl(-5, 0, 0.09, 'sine'); else { pl(7, 0, 0.11); pl(19, 0, 0.04, 'sine'); } },
    coin(k = 0) { if (!on()) return; pl(12 + (k % 3) * 2, 0, 0.08, 'sine'); pl(19 + (k % 3) * 2, 0.06, 0.07, 'sine'); },
    gate() { if (!on()) return; pl(7, 0, 0.07, 'sine'); pl(14, 0.07, 0.06, 'sine'); },
    miss() { if (!on()) return; pl(-2, 0, 0.09, 'sawtooth'); pl(-7, 0.12, 0.08, 'sawtooth'); },
    jump() { if (!on()) return; sound.sweep(now(), 260, 560, 0.16, 0.05, 'triangle'); },
    spring() { if (!on()) return; sound.sweep(now(), 180, 900, 0.32, 0.07, 'triangle'); },
    land(k = 0.5) { if (!on()) return; sound.burst(now(), { dur: 0.12 + 0.2 * k, type: 'lowpass', freq: 500 + 300 * k, q: 0.6, vol: 0.08 + 0.18 * k }); },
    crumble() { if (!on()) return; sound.burst(now(), { dur: 0.5, type: 'bandpass', freq: 900, q: 0.8, vol: 0.12, rate: 0.7 }); },
    checkpoint() { if (!on()) return; [0, 4, 7].forEach((s, i) => pl(s + 12, i * 0.09, 0.07, 'sine')); },
    hurt() { if (!on()) return; sound.sweep(now(), 520, 140, 0.4, 0.07, 'sawtooth'); },
    finish() { if (on()) sound.fanfare?.(); },
    lose() { if (on()) sound.fail?.(); },
    whoosh() { if (on()) sound.burst(now(), { dur: 0.4, type: 'bandpass', freq: 1400, q: 0.7, vol: 0.1, rate: 1.2 }); },
  };
}
