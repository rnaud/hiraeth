import { engines as shipEngines } from '../ship/sfx.js';
// The chime pirates' sounds (issue #326: "better sound effects"; issue #494: "the sounds are bad"), made with the
// game's own synth (src/audio.js Sound: sweep, burst, noiseGlide, and its struck tings), each a few layers: a body (a
// low thump or a tone), a snap (a short noise at the attack) and a tail. Since issue #494 they are the game's own
// vocabulary rather than a family of their own: the bolts the gun's bloop made dry and short (fluidShoot), a wreck the
// fight temples' kill thump under a rumble (foeKill), a bolt on a hull and on armour the blade's knock and glance
// (foeArmour, foeGlance), the lock the lock-on's two notes (lockOn), an empty rack the empty tank's sputter
// (fluidEmpty), the pick-ups, the chain and the tally the chimes' struck glass (ting, crystalTing), the boost the
// backpack's gush (fluidBoost). No plucks any more: each rang 1.6 s whatever it was (a bolt's tick 1.35 s), and a
// fight's dozens a second smeared into a ringing haze. Every repeated one varies a little (Sound.vary). Levels against
// the music: docs/systems/minigames.md, "Made better again". Silent when muted or before the sound has started.
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
  boost: 'The boost',
  brake: 'The brake',
  spent: 'The boost\'s gauge run dry',
  upgrade: 'A gun drop taken: the guns a tier up',
  gunLost: 'Hit: the guns back to the twin bolts',
  engine: 'The ship\'s engine hum (held)',
  arrive: 'Out of the warp into a place (each its own note)',
  bed: 'A place\'s sound under the flight (held: each its own)',
  thunder: 'The Storm Giant\'s thunder, near or far',
};

/**
 * Each place's sound (issue #555): the note its arrival rings (Hz), and its bed under the flight, soft and held: a few
 * tones (Hz, wave, level), a band of noise (its middle, Q, level), how loud all of it is and how it swells (rad/s).
 *  - the Rose Rings: a warm open fifth, a high glint over it;
 *  - the Iron Moon: a low hum and a ground rumble;
 *  - the Frost Moon: two high glassy tones and a thin cold air;
 *  - the Storm Giant: wind, and a low note under it.
 */
export const PLACE_SOUNDS = {
  drift: { note: 523, tones: [[110, 'sine', 0.8], [164.8, 'sine', 0.55], [659, 'sine', 0.08]], noise: [700, 0.6, 0.12], vol: 0.016, swell: 0.31 },
  mines: { note: 392, tones: [[55, 'triangle', 0.8], [82.4, 'sine', 0.5]], noise: [180, 0.8, 0.5], vol: 0.018, swell: 0.22 },
  ice: { note: 1047, tones: [[880, 'sine', 0.18], [1318, 'sine', 0.12], [220, 'sine', 0.4]], noise: [3200, 3, 0.22], vol: 0.012, swell: 0.4 },
  wrecks: { note: 330, tones: [[49, 'sine', 0.7], [98, 'triangle', 0.25]], noise: [420, 0.7, 0.9], vol: 0.022, swell: 0.5 },
};

/** The scale the struck tones climb (the game's pentatonic, as Sound.freq's: semitones over a root). */
const STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19];

export function pirateSounds(sound) {
  const on = () => !!sound?.ctx && !sound.muted && !!sound.fx;
  const now = () => sound.ctx.currentTime;
  /** A little different each time (±spread): Sound.vary, or none on a recording stand-in. */
  const vary = (spread = 0.06) => (sound?.vary ? sound.vary(spread) : 1);
  let lastShot = 0, lastHit = 0, lastEnemy = 0, lastBoom = 0, side = 1;
  /** A low thump: a sine falling from f0 to f1 over dur. */
  const thump = (t, f0, f1, dur, vol) => sound.sweep(t, f0, f1, dur, vol, 'sine');
  /** A filtered noise snap (the attack of a sound). */
  const snap = (t, freq, dur, vol, type = 'bandpass', q = 0.9) => sound.burst(t, { dur, type, freq, q, vol });
  /** A short struck tone (the chimes' glass: Sound.ting), or a sine's ping where there is none. */
  const ting = (t, f, vol, dur = 0.35) => (sound.ting ? sound.ting(t, f, vol, dur) : sound.sweep(t, f, f * 1.004, Math.min(0.25, dur), vol, 'sine'));

  /** A place's bed (issue #555), made once a page for each place and kept on the Sound (a Retry finds it again). */
  const bed = (id) => {
    if (!sound?.ctx?.createGain || !sound.fx || !PLACE_SOUNDS[id]) return null;
    const beds = (sound._pirateBeds ??= {});
    return (beds[id] ??= (() => {
      const P = PLACE_SOUNDS[id], ctx = sound.ctx, g = ctx.createGain(), f = ctx.createBiquadFilter();
      g.gain.value = 0; f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 0.5;
      for (const [hz, type, v] of P.tones) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; o.frequency.value = hz; og.gain.value = v;
        o.connect(og).connect(f); o.start();
      }
      const [nf0, nq, nv] = P.noise, n = ctx.createBufferSource(); n.buffer = sound.noiseBuf; n.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = nf0; nf.Q.value = nq;
      const ng = ctx.createGain(); ng.gain.value = nv;
      n.connect(nf).connect(ng).connect(f); n.start();
      f.connect(g).connect(sound.fx);
      return { g, P };
    })());
  };
  const api = {
    /**
     * Out of the warp into a place (issue #555): a soft rush falling away, a low swell, and the place's own note struck
     * twice, the second its fifth: short and soft.
     */
    arrive(id = 'drift') {
      if (!on()) return; const t = now(), f = (PLACE_SOUNDS[id] ?? PLACE_SOUNDS.drift).note;
      sound.noiseGlide?.(t, { type: 'bandpass', f: 2600, f1: 380, q: 0.8, dur: 0.9, vol: 0.035 });
      sound.sweep(t, 96, 58, 0.8, 0.03, 'sine');
      ting(t + 0.5, f, 0.022, 0.45); ting(t + 0.62, f * 1.5, 0.016, 0.4);
    },
    /** A place's bed (issue #555), held: `k` 0..1 (0 off), swelling slowly. Called every frame while the page runs. */
    bed(id = 'drift', k = 1) {
      const E = bed(id);
      if (!E) return;
      const t = now(), L = sound.muted ? 0 : Math.max(0, Math.min(1, k));
      E.g.gain.setTargetAtTime(E.P.vol * L * (0.8 + 0.2 * Math.sin(t * E.P.swell)), t, 0.5);
    },
    /** The Storm Giant's thunder (issue #555): a soft low roll, `far` 0..1 (far: quieter, duller, later in its crack). */
    thunder(far = 0.5) {
      if (!on()) return; const t = now(), k = Math.max(0, Math.min(1, far)), v = vary(0.1);
      sound.burst(t + 0.05 + 0.3 * k, { dur: 1.1, type: 'lowpass', freq: (230 - 90 * k) * v, q: 0.7, vol: 0.06 * (1 - 0.5 * k), rate: 0.45 * v });
      thump(t + 0.05 + 0.3 * k, 70 * v, 38, 0.6, 0.03 * (1 - 0.5 * k));
      if (k < 0.5) snap(t + 0.02, 700 * v, 0.06, 0.012, 'bandpass', 1.2);
    },
    /**
     * The twin bolts: the gun's bloop made dry and short (fluidShoot's sweep and its burst), a soft click at the
     * muzzles; each volley a hair lower or higher than the last (the two guns), none alike.
     */
    shot() {
      if (!on()) return; const t = now(); if (t - lastShot < 0.06) return; lastShot = t;
      const v = vary(0.05) * (side = -side, side > 0 ? 1.03 : 0.97);
      sound.sweep(t, 1250 * v, 520 * v, 0.06, 0.018, 'triangle');
      thump(t, 300 * v, 150 * v, 0.05, 0.022);
      snap(t, 1800 * v, 0.025, 0.018, 'bandpass', 1.2);
    },
    /** A pirate fires: lower and rounder than the ship's bolts, short. */
    enemy() {
      if (!on()) return; const t = now(); if (t - lastEnemy < 0.05) return; lastEnemy = t;
      const v = vary(0.07);
      sound.sweep(t, 620 * v, 240 * v, 0.1, 0.016, 'triangle');
      sound.sweep(t, 170 * v, 110 * v, 0.07, 0.01, 'sawtooth');
      snap(t, 950 * v, 0.04, 0.016);
    },
    /**
     * A pirate about to fire (its telegraph): a rising whine over `dur` s, the kind's own: a fighter's quick chirp, a
     * gunboat's whine, a bomber's two blips, a turret's low growl rising, the bridge's swell.
     */
    tell(kind = 'skiff', dur = 0.5) {
      if (!on()) return; const t = now();
      if (kind === 'skiff') { sound.sweep(t, 900, 1500, Math.min(0.25, dur), 0.01, 'sine'); sound.sweep(t + Math.min(0.25, dur), 1175, 1180, 0.08, 0.01, 'sine'); return; }
      if (kind === 'hauler') { sound.sweep(t, 660, 664, 0.09, 0.022, 'triangle'); sound.sweep(t + dur * 0.5, 660, 664, 0.09, 0.022, 'triangle'); return; }
      if (kind === 'turret') { sound.sweep(t, 140, 420, dur, 0.03, 'triangle'); sound.sweep(t, 70, 210, dur, 0.016, 'sawtooth'); return; }
      if (kind === 'core') { sound.sweep(t, 220, 880, dur, 0.03, 'sine'); sound.noiseGlide?.(t, { type: 'bandpass', f: 400, f1: 2000, q: 1.6, dur, vol: 0.03 }); return; }
      sound.sweep(t, 300, 980, dur, 0.022, 'triangle');   // (the gunboat)
    },
    /** A bolt strikes a hull: the blade's knock on armour, small and dry (foeArmour's thunk and its burst), no ring. */
    hit() {
      if (!on()) return; const t = now(); if (t - lastHit < 0.04) return; lastHit = t;
      const v = vary(0.08);
      sound.sweep(t, 420 * v, 260 * v, 0.06, 0.03, 'triangle');
      snap(t, 1300 * v, 0.04, 0.035, 'bandpass', 2.2);
    },
    /**
     * An explosion, k its size (0.5 a rock or a mine, 1 a fighter, 1.6 a bomber, 2+ the captain's parts): the fight
     * temples' kill (a thump falling away, a low burst, a mid crack: Sound.foeKill's layers) under the wreck's rumble,
     * a crackle of debris after, longer and lower as it grows; never two at once at full weight.
     */
    boom(k = 1) {
      if (!on()) return; const t = now(), K = Math.min(2.4, k), v = vary(0.08);
      const close = t - lastBoom < 0.08 ? 0.55 : 1; lastBoom = t;   // (two in the same instant: the second lighter, no pile-up)
      thump(t, (150 - 22 * Math.min(K, 2)) * v, 42, 0.2 + 0.22 * K, (0.065 + 0.04 * K) * close);
      sound.burst(t, { dur: 0.18 + 0.28 * K, type: 'lowpass', freq: (420 + 160 * K) * v, q: 0.8, vol: (0.055 + 0.05 * K) * close, rate: 0.7 * v });
      snap(t + 0.012, 1100 * v, 0.06, (0.03 + 0.012 * K) * close, 'bandpass', 1.4);
      for (let i = 0; i < Math.round(1 + 1.5 * K); i++) snap(t + 0.07 + i * 0.06 + Math.random() * 0.04, (800 + Math.random() * 900) * v, 0.035, (0.012 + 0.006 * K) * close, 'bandpass', 3);
    },
    /** A bolt off the captain's armour: the blade's glance (foeGlance: a bright tick and a dull thunk), short. */
    clank() { if (!on()) return; const t = now(), v = vary(0.06); sound.sweep(t, 330 * v, 240 * v, 0.09, 0.05, 'triangle'); snap(t, 520 * v, 0.07, 0.06, 'bandpass', 2.5); snap(t, 2400 * v, 0.02, 0.02, 'bandpass', 3); },
    /** The roll turns a shot aside: a glassy ping, falling, short. */
    deflect() { if (!on()) return; const t = now(), v = vary(0.05); sound.sweep(t, 2200 * v, 1500 * v, 0.14, 0.022, 'sine'); ting(t, 1760 * v, 0.02, 0.3); },
    /** The barrel roll: a whoosh of air swept up over a low turn of the hull. */
    roll() { if (!on()) return; const t = now(), v = vary(0.06); sound.noiseGlide?.(t, { type: 'bandpass', f: 480 * v, f1: 2000 * v, q: 0.9, dur: 0.34, vol: 0.07, rate: 1.1 * v }); sound.sweep(t, 150 * v, 95 * v, 0.28, 0.026, 'triangle'); },
    /** The charged shot let go: a rising surge into a soft boom. */
    charge() { if (!on()) return; const t = now(); sound.sweep(t, 180, 1100, 0.28, 0.032, 'triangle'); thump(t + 0.02, 180, 70, 0.24, 0.05); snap(t, 800, 0.16, 0.04, 'bandpass', 0.7); },
    /** The charge locks on: the lock-on's two notes (Sound.lockOn), or two short pings. */
    lock() {
      if (!on()) return;
      if (sound.lockOn) { sound.lockOn(true); return; }
      const t = now(); sound.sweep(t, 1318, 1323, 0.09, 0.02, 'sine'); sound.sweep(t + 0.055, 1760, 1767, 0.12, 0.02, 'sine');
    },
    /** A missile loosed: a hiss down and the motor's rising whine. */
    missile() { if (!on()) return; const t = now(), v = vary(0.05); sound.burst(t, { dur: 0.3, type: 'bandpass', freq: 1600 * v, q: 0.6, vol: 0.045, rate: 1.1 }); sound.sweep(t + 0.05, 240 * v, 820 * v, 0.4, 0.02, 'triangle'); thump(t, 120, 60, 0.12, 0.045); },
    /** None left: the empty tank's sputter (fluidEmpty). */
    dry() { if (!on()) return; const t = now(), v = vary(0.08); sound.sweep(t, 300 * v, 180 * v, 0.08, 0.025, 'triangle'); snap(t + 0.03, 900 * v, 0.06, 0.03, 'bandpass', 2); },
    /** A repair ring: a quick rising run of struck glass (the chimes'), over a soft swell. */
    pickup() { if (!on()) return; const t = now(); [0, 4, 7, 12].forEach((s, i) => ting(t + i * 0.06, 784 * Math.pow(2, s / 12), 0.03, 0.4)); sound.sweep(t, 400, 800, 0.35, 0.016, 'triangle'); },
    /** A missile back in the rack: a latch and two short notes. */
    rearm() { if (!on()) return; const t = now(); snap(t, 1800, 0.03, 0.03); ting(t + 0.05, 880, 0.024, 0.25); ting(t + 0.1, 1175, 0.024, 0.25); },
    /** A pip of hull lost: a crunch and a low thud, over the runner's hurt. */
    hull() { if (!on()) return; const t = now(), v = vary(0.05); sound.burst(t, { dur: 0.24, type: 'bandpass', freq: 800 * v, q: 0.6, vol: 0.12, rate: 0.8 }); thump(t, 160 * v, 48, 0.3, 0.1); sound.sweep(t + 0.04, 196 * v, 150 * v, 0.2, 0.03, 'triangle'); },
    /** The hull low: two falling tones, twice. */
    warning() { if (!on()) return; const t = now(); for (const d of [0, 0.36]) { sound.sweep(t + d, 880, 660, 0.16, 0.03, 'triangle'); sound.sweep(t + d + 0.17, 660, 520, 0.16, 0.026, 'triangle'); } },
    /** The captain's gunship arrives: a low horn swelling, rumble under it. */
    incoming() { if (!on()) return; const t = now(); sound.sweep(t, 70, 104, 1.4, 0.045, 'sawtooth'); sound.sweep(t, 140, 208, 1.4, 0.026, 'triangle'); sound.burst(t, { dur: 1.4, type: 'lowpass', freq: 220, q: 0.6, vol: 0.1, rate: 0.5 }); },
    /** A chain of kills (n in a row): a struck note a step higher each one, and its fifth. */
    combo(n = 2) { if (!on()) return; const t = now(), f = 523 * Math.pow(2, STEPS[Math.min(n - 2, STEPS.length - 1)] / 12); ting(t, f, 0.026, 0.3); ting(t + 0.05, f * 1.5, 0.016, 0.25); },
    /** A line over the comms: two soft blips. */
    comms() { if (!on()) return; const t = now(); sound.sweep(t, 880, 884, 0.07, 0.016, 'sine'); sound.sweep(t + 0.08, 1175, 1180, 0.07, 0.016, 'sine'); },
    /** The tally: a chime crystal struck as the points become chimes (Sound.crystalTing, the chimes' own). */
    tally(k = 0) {
      if (!on()) return; const t = now(), f = 1047 * Math.pow(2, STEPS[k % 6] / 12);
      if (sound.crystalTing) sound.crystalTing(t, f, 0.026, 0.45); else sound.sweep(t, f, f * 1.004, 0.2, 0.02, 'sine');
    },
    /** The boost (issue #495): the backpack's gush going up (fluidBoost), the engine's note swept up under it. */
    boost() { if (!on()) return; const t = now(), v = vary(0.05); sound.burst(t, { dur: 0.42, type: 'bandpass', freq: 800 * v, q: 0.7, vol: 0.08, rate: 0.7 * v }); sound.sweep(t, 120 * v, 300 * v, 0.35, 0.05, 'triangle'); sound.noiseGlide?.(t + 0.04, { type: 'bandpass', f: 500 * v, f1: 1700 * v, q: 1, dur: 0.3, vol: 0.03 }); },
    /** The brake (issue #495): air let out, falling, the engine's note sinking. */
    brake() { if (!on()) return; const t = now(), v = vary(0.05); sound.noiseGlide?.(t, { type: 'bandpass', f: 1400 * v, f1: 380 * v, q: 0.9, dur: 0.38, vol: 0.06 }); sound.sweep(t, 260 * v, 110 * v, 0.34, 0.04, 'triangle'); },
    /** The gauge run dry (issue #495): a sputter, twice. */
    spent() { if (!on()) return; const t = now(); for (const d of [0, 0.11]) { sound.sweep(t + d, 260, 160, 0.07, 0.024, 'triangle'); snap(t + d + 0.02, 800, 0.05, 0.026, 'bandpass', 2); } },
    /** A gun drop taken (issue #495): a quick run up the struck glass, a tier higher a step higher, over a gush. */
    upgrade(tier = 1) {
      if (!on()) return; const t = now(), r = 659 * Math.pow(2, STEPS[Math.min(tier, 4)] / 12);
      [0, 4, 7, 12].forEach((s, i) => ting(t + i * 0.05, r * Math.pow(2, s / 12), 0.03, 0.35));
      sound.sweep(t, 220, 660, 0.25, 0.03, 'triangle');
      sound.burst(t, { dur: 0.25, type: 'bandpass', freq: 1200, q: 1, vol: 0.03, rate: 1.2 });
    },
    /** The guns lost to a hit (issue #495): two struck notes falling, dull. */
    gunLost() { if (!on()) return; const t = now(); sound.sweep(t, 660, 520, 0.16, 0.028, 'triangle'); sound.sweep(t + 0.15, 494, 330, 0.24, 0.028, 'triangle'); },
    /**
     * The ship's engine hum, held: `level` 0..1 (0 off), `push` 0..1 (how hard it is steered or boosted: the pitch and
     * the filter open a little). Called every frame while the run flies; 0 at the end.
     */
    engine(level = 1, push = 0) {
      shipEngines(sound, Math.max(0, Math.min(1, level)), Math.max(0, Math.min(1, push)));
    },
  };
  for (const [name, fn] of Object.entries(api)) api[name] = (...args) => sound?.sfxTrace?.enabled
    ? sound.sfxTrace.run(`Pirates ${name}`, () => fn(...args)) : fn(...args);
  return api;
}
