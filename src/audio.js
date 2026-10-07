// Procedural sound: generative music per level + ambience + effects, all
// synthesised with Web Audio (no audio files). Starts on the first click or
// key press (browsers require a gesture). M mutes.
//
// Musicians in the world (setBands): each band is a place (or a walker) that
// plays its own instruments in time with the score, heard positionally:
// louder as you approach, panned by where it is relative to the camera, and
// the score steps back when you stand by them. A band's `mode` changes the
// tune: 'play' (their own ostinato), 'near' (someone is listening: they pick
// up the world's melody), 'feast' (the holy event: double-time and claps).

import { store } from './platform.js';
import { bindVoice, languageOf } from './story/voice.js';
import { scoreFor, scoreBeat, chordAt, CALM_ACT, fatherIn } from './score.js';
import { playVoice, playColour, hit } from './score-voices.js';
import { audioGuard } from './audio-guard.js';

// Bako's ney solo (AudioEngine.solo): three breaths in a hijaz mode, [semitones from the tonic, seconds].
// (0 D, 1 E♭, 4 F♯, 5 G, 7 A, 8 B♭, 10 C) The augmented second (1 -> 4) and the slow falls back to the tonic
// make it sound old and far away.
export const SOLO_TUNE = [
  [[0, 2.4], [1, 0.8], [4, 1.6], [5, 0.6], [1, 0.7], [0, 3.0]],
  [[7, 2.0], [8, 0.7], [7, 0.6], [4, 1.3], [5, 0.5], [4, 0.5], [1, 1.0], [0, 3.4]],
  [[12, 2.2], [13, 0.5], [12, 0.5], [10, 0.6], [8, 0.7], [7, 1.6], [8, 0.4], [7, 0.4], [4, 0.9], [5, 0.8], [1, 1.3], [0, 4.5]],
];

// The Garden of Spheres’ tune (Sound.spheresSong): [scale degree, eighths] in its pentatonic
// scale; it climbs through the three remembered sounds and comes home an octave up.
export const SPHERES_SONG = [[0, 1], [2, 1], [4, 2], [5, 2], [4, 1], [2, 1], [1, 2], [2, 1], [4, 1], [7, 2], [5, 4], [null, 1], [4, 1], [2, 1], [5, 5]];

// How loud the ambient wind (its whoosh and the high howl) is against everything else.
export const AMBIENT_WIND = 0.4;

// Each world's score lives in src/score.js (its mode, tempo, instruments, leitmotif, and the
// father's theme in it); its instruments in src/score-voices.js. Here: the ground under your
// feet (the footsteps) and each world's ambience bed.
const GROUND = { bazaar: 'stone', desert: 'sand', incal: 'stone', arzach: 'sand', garage: 'stone', edena: 'grass', perdide: 'grass', arzach2: 'stone', buried: 'sand', spheres: 'grass', perdide2: 'grass', atelier: 'stone', home: 'grass', mangrove: 'stone', saltharbour: 'sand' };
const AMBIENCE = { bazaar: 'city', desert: 'wind', incal: 'city', arzach: 'highwind', garage: 'machine', edena: 'birds', perdide: 'swamp', arzach2: 'highwind', buried: 'machine', spheres: 'birds', perdide2: 'swamp', atelier: 'paper', home: 'birds', mangrove: 'swamp', saltharbour: 'wind' };
// the instruments audio.js plays itself (the rest are src/score-voices.js's)
export const OWN_KINDS = new Set(['duduk', 'reed', 'flute', 'strings', 'synth', 'bell', 'marimba', 'oud', 'ney', 'chant', 'celesta', 'kalimba']);

// The menu music (the title screen, and the full-screen Start and Select menus): a calm
// music box over a slow pad in D lydian, its own tune apart from every world's. It plays on
// its own bus while the world's sound (music, effects, voices, their room) is hushed under it.
export const MENU_SCORE = {
  root: 146.83, scale: [0, 2, 4, 6, 7, 9, 11], tempo: 54,
  prog: [0, 4, 5, 3],                        // I, V, vi, IV: a chord every 8 beats
  arp: [0, 2, 4, 7, 9, 7, 4, null],          // the music box, one note a beat (scale degrees over the chord)
  // a long, falling line every 32 beats, [degree, beats]; flute, answered by the bell the next time
  melody: [[4, 2], [3, 1], [2, 1], [4, 4], [null, 2], [5, 2], [4, 1], [2, 1], [1, 2], [0, 4]],
};
export const MENU_HUSH = 0.16;     // the world's sound under a menu (× its usual level)
const MENU_LEVEL = 0.9;            // the menu bus against the music volume setting

/** The menu music's frequency for a scale degree (octave: up or down from D3). */
export function menuFreq(degree, octave = 0, S = MENU_SCORE) {
  const n = S.scale.length, o = Math.floor(degree / n), d = ((degree % n) + n) % n;
  return S.root * Math.pow(2, (S.scale[d] + 12 * (o + octave)) / 12);
}

/**
 * What the menu music plays on beat b: [{ kind, degree, octave, at (beats from b), beats, vol }].
 * Deterministic, so the tune is the same each time a menu opens.
 */
export function menuBeat(b, S = MENU_SCORE) {
  const out = [], bar = Math.floor(b / 8), chord = S.prog[bar % S.prog.length], i = b % 8;
  if (i === 0) {
    for (const k of [0, 2, 4]) out.push({ kind: 'pad', degree: chord + k, octave: 0, at: 0, beats: 8.5, vol: 0.05 });
    out.push({ kind: 'bass', degree: chord, octave: -1, at: 0, beats: 8, vol: 0.07 });
  }
  const step = S.arp[i];
  // every other bar the music box leaves out its off-beats: it breathes
  if (step !== null && !(bar % 2 === 1 && i % 2 === 1)) out.push({ kind: 'celesta', degree: chord + step, octave: 1, at: 0, beats: 1, vol: 0.045 });
  if (b % 32 === 8) {
    const kind = Math.floor(b / 32) % 2 ? 'bell' : 'flute';
    let at = 0;
    for (const [deg, beats] of S.melody) {
      if (deg !== null) out.push({ kind, degree: deg, octave: kind === 'bell' ? 1 : 0, at, beats, vol: kind === 'bell' ? 0.05 : 0.07 });
      at += beats;
    }
  }
  return out;
}

// The voice bus's level against the rest (× the voice volume setting), and how many balloon mumbles may overlap.
const VOICE_LEVEL = 1.25;
const BALLOON_VOICES = 2;

/**
 * Sing one planned syllable (src/story/voice.js) at time t into dest: a pitched
 * tone through two vowel formants (plus a little of the dry tone), with a
 * consonant at its head and some air (breath) through it. Machines ring-modulate,
 * glassy tongues add a bell partial. Used live (Sound.speak / syllable) and by an
 * OfflineAudioContext to render a line to a file.
 */
export function renderSyllable(ctx, dest, s, t, noise) {
  const dur = s.dur, end = t + dur;
  const nasal = s.cons === 'nasal';
  const atk = 0.004 + 0.014 * (1 - s.clip) + (nasal ? 0.012 : 0);
  const rel = 0.015 + 0.07 * (1 - s.clip);
  const peak = s.gain;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + atk);
  env.gain.setValueAtTime(peak, Math.max(t + atk, end - rel * 0.5));
  env.gain.exponentialRampToValueAtTime(0.0006, end + rel);
  env.connect(dest);
  const stop = end + rel + 0.03;
  const voiced = 1 - 0.94 * s.breath;
  if (voiced > 0.03) {
    const o = ctx.createOscillator(); o.type = s.wave ?? 'triangle';
    o.frequency.setValueAtTime(s.pitch[0][1], t);
    for (let j = 1; j < s.pitch.length; j++) o.frequency.linearRampToValueAtTime(s.pitch[j][1], t + s.pitch[j][0]);
    const vg = ctx.createGain(); vg.gain.value = voiced * (s.wave === 'square' || s.wave === 'sawtooth' ? 0.55 : 1);
    const bp = (f, q, g) => { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const m = ctx.createGain(); m.gain.value = g; o.connect(b).connect(m).connect(vg); };
    bp(s.vowel[0], 4, 2.6);
    bp(s.vowel[1], 6, 2.2 * (0.7 + 0.6 * (s.bright ?? 0.5)));
    const dry = ctx.createBiquadFilter(); dry.type = 'lowpass'; dry.frequency.value = nasal ? 500 : 1300; o.connect(dry).connect(vg);
    if (s.mech) {
      // ring modulation by a low square: the clank of a voice-box
      const rm = ctx.createGain(); rm.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 58 + 30 * (s.bright ?? 0.5);
      lfo.connect(rm.gain); vg.connect(rm).connect(env);
      const keepDry = ctx.createGain(); keepDry.gain.value = 0.35; vg.connect(keepDry).connect(env);
      lfo.start(t); lfo.stop(stop);
    } else vg.connect(env);
    if (s.ring > 0) {
      // a glassy overtone that rings a little past the syllable
      const r = ctx.createOscillator(), rg = ctx.createGain();
      r.type = 'sine'; r.frequency.value = s.f0 * 2.76;
      rg.gain.setValueAtTime(0, t); rg.gain.linearRampToValueAtTime(peak * 0.5 * s.ring, t + 0.006); rg.gain.exponentialRampToValueAtTime(0.0005, end + 0.25);
      r.connect(rg).connect(dest); r.start(t); r.stop(end + 0.3);
    }
    o.start(t); o.stop(stop);
  }
  // air: the consonant's click or hiss, then the breath through the vowel
  const click = s.cons === 'stop', hiss = s.cons === 'fric';
  if (noise && (click || hiss || s.breath > 0.03)) {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain(); g.gain.value = 0;
    const c = s.consonant ?? '';
    const cf = click ? 2600 + 1400 * (s.bright ?? 0.5) : /^(s|z|ch|ts)$/.test(c) ? 5200 : c === 'sh' ? 2800 : 1600;
    const cdur = click ? 0.012 : hiss ? 0.035 : 0;
    const air = Math.max(s.breath * peak * 1.6, 0.0006);
    f.type = 'bandpass'; f.Q.value = click ? 0.9 : 1.3;
    f.frequency.setValueAtTime(cdur ? cf : s.vowel[1], t);
    if (cdur) f.frequency.linearRampToValueAtTime(s.vowel[1], t + cdur + 0.01);
    g.gain.setValueAtTime(0, t);
    if (cdur) { g.gain.linearRampToValueAtTime(peak * (click ? 1.6 : 0.9), t + 0.003); g.gain.linearRampToValueAtTime(air, t + cdur); }
    else g.gain.linearRampToValueAtTime(air, t + atk);
    g.gain.setValueAtTime(air, Math.max(t + cdur + 0.001, end - rel * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0005, end + rel);
    n.connect(f).connect(g).connect(dest);
    n.start(t, Math.random() * 1.5); n.stop(stop);
  }
}

export class Sound {
  /** score: false plays no world music (the title screen: only the menu music). */
  constructor(levelId, { score = true } = {}) {
    this.score = score;
    this.menuOn = false;
    // the world's score (src/score.js): the unknown (the title, the Lab) play the desert's
    this.scoreId = scoreFor(levelId) === scoreFor('desert') ? 'desert' : levelId;
    const S = (this.S = scoreFor(this.scoreId));
    this.profile = { root: S.root, scale: S.scale, tempo: S.tempo, pad: 'triangle', ground: GROUND[levelId] ?? 'sand' };
    this.voice = { lead: S.pal.lead, pluck: S.pal.pluck, ambience: AMBIENCE[levelId] ?? 'wind', melody: S.motif };
    this.act = { ...CALM_ACT };   // what you are doing, eased (update): the score follows it
    this.ctx = null;
    this.muted = store.get('moebius.muted') === '1';
    this.musicVol = 0.8;
    this.fxVol = 1.0;
    // the mumbled alien voices (src/story/voice.js plans them, speak() sings them)
    this.levelId = levelId;
    this.language = languageOf(levelId);
    this.voiceVol = 0.8;
    this.alienVoices = true;
    this.voiceLog = [];            // the last utterances (a test / dev hook: what was said, how)
    this._balloons = [];           // balloon mumbles playing now (at most BALLOON_VOICES)
    this._calls = null;
    this._talkUntil = 0;
    bindVoice(this);
    const start = () => this.start();
    const key = (e) => { if (e.code === 'KeyM') this.toggleMute(); else start(); };
    window.addEventListener('pointerdown', start, { once: false });
    window.addEventListener('keydown', key);
    // silent while the app is away (asleep, home, recents) or the page hidden: src/audio-guard.js
    // suspends the context and blocks every resume; the master gain goes to 0 as well
    this.guard = audioGuard(window);
    const off = this.guard.on((away) => this._away(away));
    this._unlisten = () => { window.removeEventListener('pointerdown', start); window.removeEventListener('keydown', key); off(); };
    // Each world is a new page: without this, a landing (or anything before your first
    // press) would play in silence. Start now wherever sound is allowed without a press
    // (a world that loads while the app is away: on return, and asked then).
    this.guard.whenBack(() => { if (!this._disposed && Sound.mayStart(window)) this.start(); });
  }

  /**
   * Would an AudioContext run right now, before any press? (The Android app lets it,
   * and browsers do once the site has been played with.) A suspended context would
   * only queue sounds that all burst out at the first press, so then we wait.
   */
  static mayStart(win) {
    const AC = win.AudioContext || win.webkitAudioContext;
    if (!AC) return false;
    if (win.navigator?.getAutoplayPolicy) return win.navigator.getAutoplayPolicy('audiocontext') === 'allowed';
    try {
      const probe = new AC(), running = probe.state === 'running';
      probe.close?.();
      return running;
    } catch { return false; }
  }

  /** The master level now: 0 when muted, or while the game is away. */
  masterLevel() { return this.muted || this.guard?.away() ? 0 : 0.9; }

  /** The guard's change: hush the master at once when away, bring it back softly on return. */
  _away(away) {
    if (!this.master) return;
    const g = this.master.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    if (away) g.setValueAtTime(0, t);
    else g.setTargetAtTime(this.masterLevel(), t, 0.15);
  }

  start() {
    // nothing starts or resumes while away (a press, a pad reconnecting, the frame loop): on return instead
    if (this.guard?.away()) {
      if (!this._startLater) { this._startLater = true; this.guard.whenBack(() => { this._startLater = false; if (!this._disposed) this.start(); }); }
      return;
    }
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.masterLevel();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    this.master.connect(comp).connect(ctx.destination);
    // the world's sound (music, effects, voices and their room) on one bus, hushed under a menu
    this.world = ctx.createGain();
    this.world.gain.value = this.menuOn ? MENU_HUSH : 1;
    // (under water everything goes through a low-pass: underwater())
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 22000; this.muffle.Q.value = 0.5;
    this.world.connect(this.muffle).connect(this.master);

    // reverb: a generated decaying-noise impulse
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.world);

    this.music = ctx.createGain(); this.music.gain.value = 0.62 * this.musicVol;
    this.music.connect(this.world);
    this.musicSend = ctx.createGain(); this.musicSend.gain.value = 0.7;
    this.music.connect(this.musicSend).connect(this.reverb);
    this.fx = ctx.createGain(); this.fx.gain.value = 1.6 * this.fxVol;
    this.fx.connect(this.world);
    this.fxSend = ctx.createGain(); this.fxSend.gain.value = 0.25;
    this.fx.connect(this.fxSend).connect(this.reverb);
    // the voices: their own bus (the voice volume), a touch of the room
    this.voices = ctx.createGain(); this.voices.gain.value = VOICE_LEVEL * this.voiceVol;
    this.voices.connect(this.world);
    this.voiceSend = ctx.createGain(); this.voiceSend.gain.value = 0.18;
    this.voices.connect(this.voiceSend).connect(this.reverb);

    // level meters (RMS in dBFS) on each bus, for balancing the mix
    this.meters = {};
    for (const [name, node] of [['music', this.music], ['fx', this.fx], ['voices', this.voices], ['master', this.master]]) {
      const an = ctx.createAnalyser(); an.fftSize = 2048;
      node.connect(an);
      this.meters[name] = an;
    }

    // shared noise
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;

    // continuous layers: wind (two bands), rain, cloak flutter, jetpack, engine
    this.layers = {
      wind: this.noiseLayer('bandpass', 520, 0.6),
      howl: this.noiseLayer('bandpass', 900, 9),
      rain: this.noiseLayer('highpass', 2600, 0.5),
      rainRoof: this.noiseLayer('lowpass', 420, 0.8),   // the same rain heard from indoors: a dull drumming on the roof
      cloak: this.noiseLayer('bandpass', 240, 1.2),
      jet: this.noiseLayer('lowpass', 320, 0.7),
    };
    const eng = ctx.createOscillator(); eng.type = 'sawtooth'; eng.frequency.value = 50;
    const engF = ctx.createBiquadFilter(); engF.type = 'lowpass'; engF.frequency.value = 400;
    const engG = ctx.createGain(); engG.gain.value = 0;
    eng.connect(engF).connect(engG).connect(this.fx);
    eng.start();
    this.engine = { osc: eng, filter: engF, gain: engG };

    this.beat = 0;
    this.nextBeat = ctx.currentTime + 0.3;
    this.chord = 0;
    if (this.score) this.scheduler = setInterval(() => this.schedule(), 100);
    if (this.menuOn) this.menuMusic(true);
  }

  // ------------------------------------------------------------------ menu music
  /** The menu music fades in over the hushed world (on), or out as the world comes back (off). */
  menuMusic(on) {
    this.menuOn = !!on;
    const ctx = this.ctx;
    if (!ctx) return;   // (start() applies it)
    const t = ctx.currentTime;
    this.world.gain.setTargetAtTime(on ? MENU_HUSH : 1, t, on ? 0.3 : 0.5);
    if (!this.menuBus) {
      this.menuBus = ctx.createGain(); this.menuBus.gain.value = 0;
      this.menuBus.connect(this.master);
      // its own small room (the world's is hushed with it)
      const verb = ctx.createConvolver(); verb.buffer = this.reverb.buffer;
      const send = ctx.createGain(); send.gain.value = 0.6;
      this.menuBus.connect(send).connect(verb).connect(this.master);
    }
    this.menuBus.gain.setTargetAtTime(on ? 0.62 * this.musicVol * MENU_LEVEL : 0, t, on ? 0.7 : 0.35);
    clearTimeout(this._menuStop);
    if (on && !this.menuTimer) {
      this.menuBeatN = 0; this.menuNext = t + 0.15;
      this.menuTimer = setInterval(() => this.menuSchedule(), 100);
    } else if (!on && this.menuTimer) {
      // let the last notes ring out under the fade, then stop scheduling
      this._menuStop = setTimeout(() => { if (!this.menuOn) { clearInterval(this.menuTimer); this.menuTimer = null; } }, 2500);
    }
  }

  menuSchedule() {
    const ctx = this.ctx, spb = 60 / MENU_SCORE.tempo;
    while (this.menuNext < ctx.currentTime + 0.4) {
      const t0 = this.menuNext;
      for (const e of menuBeat(this.menuBeatN)) {
        const f = menuFreq(e.degree, e.octave), t = t0 + e.at * spb, dur = e.beats * spb;
        if (e.kind === 'pad') this.menuPad(f, t, dur, e.vol);
        else if (e.kind === 'bass') this.menuPad(f, t, dur, e.vol, 'sine');
        else this.instrument(e.kind, f, t, dur, e.vol, this.menuBus);
      }
      this.menuBeatN++;
      this.menuNext += spb;
    }
  }

  /** A slow, soft pad note on the menu bus. */
  menuPad(f, t, dur, vol, type = 'triangle') {
    const ctx = this.ctx, g = ctx.createGain(), flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 1500;
    g.connect(flt).connect(this.menuBus);
    for (const det of type === 'sine' ? [0] : [-5, 5]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 3);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 2.4);
    g.gain.setValueAtTime(vol, t + Math.max(2.4, dur - 1));
    g.gain.linearRampToValueAtTime(0, t + dur + 2.5);
  }

  /** Stop for good (the title screen's sound, handing over to the game's): fade out, then close. */
  dispose() {
    this._unlisten?.();
    this._disposed = true;
    clearInterval(this.scheduler); clearInterval(this.menuTimer); clearTimeout(this._menuStop);
    this.scheduler = this.menuTimer = null;
    const ctx = this.ctx;
    if (!ctx) return;
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => ctx.close?.().catch?.(() => {}), 700);
  }

  /** Current RMS level of each bus in dBFS (-Infinity when silent). */
  levels() {
    const out = {};
    const buf = new Float32Array(2048);
    for (const [k, an] of Object.entries(this.meters ?? {})) {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      out[k] = 10 * Math.log10(sum / buf.length + 1e-12);
    }
    return out;
  }

  toggleMute() {
    this.muted = !this.muted;
    store.set('moebius.muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.1);
  }

  setVolumes(music, fx) {
    this.musicVol = music; this.fxVol = fx;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(0.62 * music, this.ctx.currentTime, 0.2);
    this.fx.gain.setTargetAtTime(1.6 * fx, this.ctx.currentTime, 0.2);
    if (this.menuBus && this.menuOn) this.menuBus.gain.setTargetAtTime(0.62 * music * MENU_LEVEL, this.ctx.currentTime, 0.2);
  }

  /** The voice volume (0..1) and whether people mumble in their own tongues (off: the old soft blips in conversations). */
  setVoices(vol = this.voiceVol, alien = this.alienVoices) {
    this.voiceVol = Number.isFinite(vol) ? vol : 0.8;
    this.alienVoices = alien !== false;
    if (this.ctx) this.voices.gain.setTargetAtTime(VOICE_LEVEL * this.voiceVol, this.ctx.currentTime, 0.1);
  }

  noiseLayer(type, freq, q) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.fx);
    src.start();
    return { f, g };
  }

  set(layer, gain, freq) {
    if (!this.ctx) return;
    const l = this.layers[layer], t = this.ctx.currentTime;
    l.g.gain.setTargetAtTime(gain, t, 0.15);
    if (freq) l.f.frequency.setTargetAtTime(freq, t, 0.2);
  }

  // ------------------------------------------------------------------ music
  freq(degree, octave = 0) {
    const S = this.profile.scale, n = S.length;
    const o = Math.floor(degree / n), d = ((degree % n) + n) % n;
    return this.profile.root * Math.pow(2, (S[d] + 12 * (o + octave)) / 12);
  }

  /** Schedule the score's beats up to a little ahead of now (src/score.js scoreBeat says what plays). */
  schedule() {
    const ctx = this.ctx, spb = 60 / this.S.tempo;
    if (!this.V) this.V = { ctx, noise: this.noiseBuf };
    while (this.nextBeat < ctx.currentTime + 0.4) {
      const t = this.nextBeat;
      this.chord = chordAt(this.S, this.beat);
      for (const e of scoreBeat(this.scoreId, this.beat, this.act)) this.playEvent(e, t, spb);
      this.ambienceTick(t, spb);
      if (this.bands) for (const b of this.bands) if (b.level > 0.004) this.bandBeat(b, t, spb);
      this.beat++;
      this.nextBeat += spb;
    }
  }

  /** One of the score's events (src/score.js), at the beat starting t0. */
  playEvent(e, t0, spb) {
    const ctx = this.ctx, t = t0 + e.at * spb, dur = e.beats * spb;
    let out = this.music;
    if (e.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = e.pan; p.connect(this.music); out = p; }
    if (e.layer === 'perc') return hit(this.V, e.kind, t, e.vol, out);
    const f = this.freq(e.degree, e.octave);
    if (e.layer === 'color') {
      if (e.kind === 'voices') { this.instrument('chant', f, t, 5, e.vol, out); this.instrument('chant', this.freq(e.degree + 2, e.octave), t + 1.5, 4, e.vol * 0.7, out); return; }
      playColour(this.V, e.kind, f, t, e.vol, out, [0, -1, -2].map((k) => this.freq(e.degree + k, e.octave)));
      return;
    }
    const held = e.layer === 'drone' || e.layer === 'pad';
    if (OWN_KINDS.has(e.kind) && !held) this.instrument(e.kind, f, t, dur, e.vol, out);
    else if (!playVoice(this.V, e.kind, f, t, dur, e.vol, out, held)) this.instrument(e.kind, f, t, dur, e.vol, out);
  }

  /** One note of a named instrument. dur in seconds. `dest`: a band's input instead of the score. */
  instrument(kind, f, t, dur, vol, dest = null) {
    if (!OWN_KINDS.has(kind) && playVoice(this.V ??= { ctx: this.ctx, noise: this.noiseBuf }, kind, f, t, dur, vol, dest ?? this.music)) return;
    const ctx = this.ctx, out = ctx.createGain(); out.gain.value = 0;
    const pan = !dest && ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (dest) out.connect(dest);
    else if (pan) { pan.pan.value = Math.random() * 0.8 - 0.4; out.connect(pan).connect(this.music); } else out.connect(this.music);
    const env = (g, a, d, peak, sustain = 0) => {
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
      if (sustain) { g.gain.setValueAtTime(peak, t + Math.max(a, dur - d)); g.gain.linearRampToValueAtTime(0, t + dur + d); }
      else g.gain.exponentialRampToValueAtTime(0.0005, t + a + d);
    };
    const osc = (type, freq, dest, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(t + dur + 3); return o; };
    const vib = (o, rate, depth) => { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rate; lg.gain.value = depth; l.connect(lg).connect(o.frequency); l.start(t + 0.15); l.stop(t + dur + 3); };
    const filt = (type, fr, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = fr; b.Q.value = q; b.connect(out); return b; };
    if (kind === 'duduk' || kind === 'reed') {          // breathy double reed / clarinet-ish
      const b = filt('lowpass', kind === 'duduk' ? 1400 : 2200, 2);
      const o = osc(kind === 'duduk' ? 'sawtooth' : 'square', f, b); vib(o, 5, f * 0.006);
      env(out, 0.12, 0.25, vol, true);
    } else if (kind === 'flute') {                       // sine + breath noise
      const o = osc('sine', f, out); vib(o, 5.5, f * 0.005);
      osc('triangle', f * 2, out).frequency.value = f * 2;
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; const nb = ctx.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = f * 2; nb.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = 0.25; n.connect(nb).connect(ng).connect(out); n.start(t); n.stop(t + dur + 0.5);
      env(out, 0.15, 0.3, vol * 0.9, true);
    } else if (kind === 'strings') {                     // detuned saws, slow bow
      const b = filt('lowpass', 1800, 0.5);
      for (const d of [-9, 0, 8]) vib(osc('sawtooth', f, b, d), 4.5, f * 0.004);
      env(out, 0.35, 0.6, vol * 0.55, true);
    } else if (kind === 'synth') {                       // bright analog lead
      const b = filt('lowpass', 2600, 6);
      osc('sawtooth', f, b, -6); osc('square', f / 2, b, 4);
      env(out, 0.01, 0.12, vol * 0.7, true);
    } else if (kind === 'bell') {                        // FM bell
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain();
      car.frequency.value = f; mod.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2.5, t); mg.gain.exponentialRampToValueAtTime(1, t + 2.5);
      mod.connect(mg).connect(car.frequency); car.connect(out);
      car.start(t); mod.start(t); car.stop(t + 4); mod.stop(t + 4);
      env(out, 0.005, 2.6, vol * 0.8);
    } else if (kind === 'marimba') {
      osc('sine', f, out); osc('sine', f * 4, out).detune.value = 3;
      env(out, 0.003, 0.5, vol);
    } else if (kind === 'oud') {                         // a plucked lute: bright attack, quick fall, a buzz
      const b = filt('lowpass', 2600, 1.5);
      b.frequency.setValueAtTime(3200, t); b.frequency.exponentialRampToValueAtTime(700, t + 0.5);
      osc('sawtooth', f, b, -4); osc('triangle', f * 2, b, 5);
      env(out, 0.003, 0.7, vol);
    } else if (kind === 'ney') {                         // breathy reed flute: lots of air
      const o = osc('triangle', f, out); vib(o, 4.6, f * 0.008);
      const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; const nb = ctx.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = f * 1.5; nb.Q.value = 1.6;
      const ng = ctx.createGain(); ng.gain.value = 0.5; n.connect(nb).connect(ng).connect(out); n.start(t, Math.random()); n.stop(t + dur + 0.5);
      env(out, 0.2, 0.35, vol, true);
    } else if (kind === 'chant') {                       // a sung "ah": a buzz through two vowel formants
      const f1 = filt('bandpass', 720, 6), f2 = filt('bandpass', 1150, 8);
      for (const d of [-7, 6]) { const o = osc('sawtooth', f, f1, d); o.connect(f2); vib(o, 5.2, f * 0.01); }
      env(out, 0.25, 0.5, vol * 1.6, true);
    } else if (kind === 'celesta') {
      osc('sine', f * 2, out); osc('triangle', f * 4, out);
      env(out, 0.003, 1.0, vol * 0.7);
    } else {                                             // kalimba (default pluck)
      const b = filt('lowpass', 2400, 1);
      osc('triangle', f, b); osc('sine', f * 2.01, b);
      env(out, 0.004, 0.9, vol);
    }
  }

  // ------------------------------------------------------------------ ambience beds
  ambienceTick(t, spb) {
    const A = this.voice.ambience, R = Math.random();
    if (A === 'birds' && R < 0.35) {                     // little chirps, in twos and threes
      const base = 2400 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.chirp(t + i * 0.09 + Math.random() * spb, base * (1 + (Math.random() - 0.5) * 0.2), 0.05);
    } else if (A === 'city') {
      if (R < 0.08) this.horn(t + Math.random() * spb);
      if (R > 0.6) this.burst(t + Math.random() * spb, { dur: 1.4, type: 'bandpass', freq: 300 + Math.random() * 200, q: 0.8, vol: 0.05, rate: 0.5 });   // a taxi passing
    } else if (A === 'swamp') {
      if (R < 0.3) this.croak(t + Math.random() * spb);
      if (R > 0.75) this.burst(t, { dur: 0.6, type: "bandpass", freq: 5200, q: 6, vol: 0.006 });   // insects
    } else if (A === 'machine') {
      // ticking gears, far off and not on every beat (the score keeps its own clock), and now and then a piston
      if (R > 0.35) this.burst(t + (R > 0.7 ? spb / 2 : 0), { dur: 0.03, type: 'highpass', freq: 3000, q: 1, vol: 0.025 });
      if (R < 0.08) this.burst(t, { dur: 0.5, type: 'lowpass', freq: 140, q: 1, vol: 0.09, rate: 0.4 });
    } else if (A === 'highwind' && R < 0.12) {
      this.burst(t, { dur: 3, type: 'bandpass', freq: 600 + Math.random() * 500, q: 4, vol: 0.06, rate: 0.6 });
    } else if (A === 'paper' && R < 0.15) {
      this.burst(t + Math.random() * spb, { dur: 0.4, type: 'highpass', freq: 2500, q: 0.6, vol: 0.03, rate: 0.7 });
    }
  }

  chirp(t, f, vol) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.06);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
    o.connect(g).connect(this.fx); o.start(t); o.stop(t + 0.1);
  }

  horn(t) {
    const ctx = this.ctx, g = ctx.createGain(), b = ctx.createBiquadFilter();
    b.type = 'lowpass'; b.frequency.value = 900; g.gain.value = 0;
    for (const f of [233, 294]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(b); o.start(t); o.stop(t + 0.7); }
    b.connect(g).connect(this.fx);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.6);
  }

  croak(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 90 + Math.random() * 60;
    // tremolo on a separate gain stage, scaled to the croak (not added to its envelope)
    const trem = ctx.createGain(); trem.gain.value = 0.6;
    am.frequency.value = 28; ag.gain.value = 0.4; am.connect(ag).connect(trem.gain);
    const b = ctx.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = 500;
    o.connect(b).connect(trem).connect(g).connect(this.fx);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.009, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.35);
    o.start(t); am.start(t); o.stop(t + 0.4); am.stop(t + 0.4);
  }

  pad(f, t, dur) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = this.profile.pad === 'sawtooth' || this.profile.pad === 'square' ? 900 : 2400;
    g.connect(flt).connect(this.music);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = this.profile.pad; o.frequency.value = f; o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 3);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 2.2);
    g.gain.setValueAtTime(0.07, t + dur - 1);
    g.gain.linearRampToValueAtTime(0, t + dur + 2.5);
  }

  bass(f, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(this.music);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 1); g.gain.linearRampToValueAtTime(0, t + dur + 1);
    o.start(t); o.stop(t + dur + 1.2);
  }

  pluck(f, t, vol = 0.09, type = this.profile.arp, bus = this.music) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2200;
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.random() * 1.4 - 0.7;
    o.connect(flt).connect(g);
    (pan ? g.connect(pan) : g).connect(bus);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 1.6);
    o.start(t); o.stop(t + 1.7);
  }

  // ------------------------------------------------------------------ effects
  burst(t, { dur = 0.08, type = 'lowpass', freq = 700, q = 0.7, vol = 0.2, rate = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    // (its level from the start: a gain is 1 until its first event, and a source starting between
    // two samples sounds one sample early, a click at full level)
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(this.fx);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  step(speed = 5) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, k = Math.min(speed / 11, 1);
    const g = this.profile.ground;
    if (g === 'stone') this.burst(t, { dur: 0.05, type: 'bandpass', freq: 1700 + Math.random() * 600, q: 2, vol: 0.12 + 0.12 * k });
    else if (g === 'grass') this.burst(t, { dur: 0.09, type: 'bandpass', freq: 2600 + Math.random() * 800, q: 0.8, vol: 0.05 + 0.06 * k });
    else this.burst(t, { dur: 0.11, type: 'lowpass', freq: 600 + Math.random() * 300, q: 0.7, vol: 0.12 + 0.14 * k });
  }

  flap() {
    if (!this.ctx) return;
    this.burst(this.ctx.currentTime, { dur: 0.25, type: 'lowpass', freq: 380, q: 0.5, vol: 0.25, rate: 0.6 });
  }

  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 2, 4, 7].forEach((d, i) => this.pluck(this.freq(d, 2), t + i * 0.12, 0.12, 'sine', this.fx));
  }

  /** A dog's bark (home's Moustache): a short rough "wuf", falling. */
  bark() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    const f0 = 330 + Math.random() * 60;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.16);
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * this.fxVol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(f).connect(g).connect(this.fx);
    o.start(t); o.stop(t + 0.22);
    this.burst(t, { dur: 0.12, type: 'bandpass', freq: 1400, q: 1, vol: 0.08 });
  }

  /**
   * A quiet tune at the parents' stone (home): the home melody, slow, on a celesta over a soft
   * pad, from `pos`; the score and the bands step back under it (a solo). Returns its length (s).
   */
  homage(pos) {
    if (!this.ctx) return 0;
    if (!this.bands) this.makeBands();
    this.bands = this.bands.filter((b) => !b.solo);
    const ctx = this.ctx, t0 = ctx.currentTime + 0.3, spb = 0.62;
    const input = ctx.createGain(), gain = ctx.createGain();
    gain.gain.value = 0;
    input.connect(gain).connect(this.world);
    const send = ctx.createGain(); send.gain.value = 0.8; gain.connect(send).connect(this.reverb);
    let t = t0;
    for (const [deg, beats] of this.voice.melody) {
      if (deg !== null) this.instrument('celesta', this.freq(deg, 1), t, beats * spb * 1.1, 0.12, input);
      t += beats * spb;
    }
    for (const [i, d] of [0, 3, 4, 0].entries()) this.pad(this.freq(d, -1), t0 + i * (t - t0) / 4, (t - t0) / 4 + 0.5);
    const len = t - t0 + 1.5;
    this.bands.push({ id: 'solo', solo: true, pos, radius: 60, parts: [], vol: 1, duck: 1, input, gain, pan: null, level: 0, mode: 'play', phrase: 0, until: t0 + len });
    return len;
  }

  /** A quest that went wrong (src/story/quests.js fail): three soft notes going down, not up. */
  fail() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [4, 2, -1].forEach((d, i) => this.pluck(this.freq(d, 1), t + i * 0.24, 0.1, 'sine', this.fx));
  }

  /** Water and earth letting go (Viridel's terraces): a long low roar that swells and dies away. */
  rumble(dur = 5, vol = 0.45) {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; src.playbackRate.value = 0.35;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.0005;
    src.connect(f).connect(g).connect(this.fx);
    g.gain.setValueAtTime(0.0005, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.6); g.gain.setValueAtTime(vol, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.start(t); src.stop(t + dur + 0.1);
  }

  // ------------------------------------------------------------------ the singing spheres (Garden of Spheres)
  /** Where a sound at `pos` sits for the listener (the camera, from listen): { gain 0..1 by distance, pan -1..1 }. */
  placeAt(pos, reach = 140) {
    const e = this._ear;
    if (!e || !pos) return { gain: 1, pan: 0 };
    const dx = pos.x - e.x, dz = pos.z - e.z, d = Math.hypot(dx, dz, (pos.y - e.y) * 0.5);
    const rx = Math.cos(e.yaw), rz = -Math.sin(e.yaw);
    return { gain: Math.max(0, 1 - d / reach) ** 1.5, pan: Math.max(-0.85, Math.min(0.85, (dx * rx + dz * rz) / Math.max(d, 1) * 0.9)) };
  }
  /** A little bus for one sound at a place: panned, into the world and a good deal of its room. */
  spot(pos, { vol = 1, reach = 140, room = 0.6, until = 12 } = {}) {
    const ctx = this.ctx, { gain, pan } = this.placeAt(pos, reach);
    if (gain * vol < 0.004) return null;
    const g = ctx.createGain();
    g.gain.value = gain * vol * this.musicVol;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p).connect(this.world); } else g.connect(this.world);
    const send = ctx.createGain(); send.gain.value = room; g.connect(send).connect(this.reverb);
    setTimeout(() => { try { g.disconnect(); send.disconnect(); p?.disconnect(); } catch { /* gone */ } }, until * 1000);
    return g;
  }
  /**
   * A great sphere touched by the fluid: one glass note that rings on, like a
   * struck bowl (a degree of the world's scale, from its middle octave; size
   * 0..1, its girth: the big ones ring longer, with a low hum under them).
   * `soft` for a shove instead of a splash.
   */
  orbNote(degree, pos, { vol = 1, size = 0.5, soft = false } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01, ring = 2.6 + size * 5, f = this.freq(degree, 0);
    const out = this.spot(pos, { vol: vol * (soft ? 0.55 : 1), until: ring + 1 });
    if (!out) return;
    for (const [m, v, d, beat] of [[1, 0.12, 1, 0.9], [2, 0.045, 0.6, 1.7], [3.01, 0.022, 0.42, 0], [4.23, 0.01, 0.25, 0], [0.5, 0.06 * size, 1.15, 0]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + (soft ? 0.05 : 0.006)); g.gain.exponentialRampToValueAtTime(0.0005, t + ring * d);
      o.connect(g).connect(out); o.start(t); o.stop(t + ring * d + 0.1);
      if (beat) {   // a slow shimmer: a twin a breath away in pitch, so the note beats like glass
        const o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.type = 'sine'; o2.frequency.value = f * m + beat;
        g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(v * 0.45, t + 0.02); g2.gain.exponentialRampToValueAtTime(0.0005, t + ring * d * 0.9);
        o2.connect(g2).connect(out); o2.start(t); o2.stop(t + ring * d + 0.1);
      }
    }
    if (!soft) this.noiseHit(t, 0.03, 'bandpass', Math.min(f * 5, 7000), 0.05, out);   // the tap of the splash
  }
  /**
   * One of the three spheres that remember plays its sound at `pos`, as a
   * short phrase in the world's scale: 'bell' (a glass bell, falling),
   * 'chant' (far voices on one note, then a fifth), 'drum' (dum, tek-dum).
   */
  remembered(kind, pos, { vol = 1 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.05, out = this.spot(pos, { vol, reach: 180, until: 9 });
    if (!out) return;
    if (kind === 'bell') {
      for (const [deg, at] of [[4, 0], [2, 0.42], [0, 0.84], [5, 1.5]]) this.instrument('bell', this.freq(deg, 1), t + at, 1.6, at > 1 ? 0.24 : 0.19, out);
    } else if (kind === 'chant') {
      this.instrument('chant', this.freq(0, 0), t, 3.4, 0.17, out);
      this.instrument('chant', this.freq(0, -1), t + 0.3, 3.1, 0.11, out);
      this.instrument('chant', this.freq(3, 0), t + 1.8, 2.4, 0.13, out);
    } else if (kind === 'drum') {
      const s = 0.21;
      [[0, 2], [2, 1], [3, 2], [5, 1], [6, 2], [8, 2], [10, 1], [11, 2]].forEach(([k, hit]) => (hit === 2 ? this.dum(t + k * s, 0.5, out) : this.tek(t + k * s, 0.22, out)));
    }
  }
  /**
   * The pole sings the three back as one little tune (the Garden of Spheres'
   * chord, solved): the glass bell carries the melody over the far voices and
   * the walking drum, with the lake's breath (ney) answering if the pebble is
   * set. Returns its length in seconds.
   */
  spheresSong(pos, { ney = false } = {}) {
    if (!this.ctx) return 0;
    const e = 0.3, t = this.ctx.currentTime + 0.1, out = this.spot(pos, { vol: 1.1, reach: 220, until: 14 });
    if (!out) return 0;
    const tune = SPHERES_SONG;
    let at = 0;
    for (const [deg, n] of tune) { if (deg !== null) this.instrument('bell', this.freq(deg, 1), t + at * e, Math.max(1.2, n * e * 1.4), 0.12, out); at += n; }
    const len = at * e;
    this.instrument('chant', this.freq(0, 0), t, len * 0.5, 0.07, out);
    this.instrument('chant', this.freq(3, -1), t + 0.2, len * 0.5, 0.05, out);
    this.instrument('chant', this.freq(3, 0), t + len * 0.5, len * 0.5 + 1, 0.06, out);
    this.instrument('chant', this.freq(0, 0), t + len * 0.5, len * 0.5 + 1.5, 0.07, out);
    for (let k = 0; k < at; k++) { const hit = [2, 0, 1, 2, 1, 0, 2, 1][k % 8]; if (hit === 2) this.dum(t + k * e, 0.34, out); else if (hit === 1) this.tek(t + k * e, 0.14, out); }
    this.dum(t + len, 0.5, out);
    if (ney) { let a2 = 0; for (const [deg, n] of tune) { if (deg !== null && n >= 2) this.instrument('ney', this.freq(deg, 1), t + (a2 + 1) * e, n * e, 0.07, out); a2 += n; } }
    return len + 2;
  }

  // ------------------------------------------------------------------ item boxes (src/boxes/)
  /** A box nearby hums: k 0..1 (how close the nearest unopened box is). A soft fifth that beats slowly. */
  boxHum(k = 0) {
    if (!this.ctx) return;
    if (!Number.isFinite(k)) k = 0;
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this._hum) {
      if (k <= 0.001) return;
      const g = ctx.createGain(); g.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const oscs = [[196, 'sine', 0], [293.7, 'sine', 3], [392.4, 'triangle', -4]].map(([fr, type, det]) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = det; o.connect(f); o.start(); return o;
      });
      // a slow tremolo: the box breathes
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.9; lg.gain.value = 0.35;
      const trem = ctx.createGain(); trem.gain.value = 0.65;
      lfo.connect(lg).connect(trem.gain); lfo.start();
      f.connect(trem).connect(g).connect(this.fx);
      this._hum = { g, oscs, lfo };
    }
    this._hum.g.gain.setTargetAtTime(this.muted ? 0 : 0.05 * k * k, t, 0.25);
  }

  /** The lid lifts: a wooden creak and a breath of air. */
  boxCreak() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sweep(t, 150, 95, 0.55, 0.035, 'sawtooth');
    this.sweep(t + 0.18, 210, 120, 0.4, 0.02, 'sawtooth');
    this.burst(t + 0.1, { dur: 0.7, type: 'bandpass', freq: 1800, q: 0.5, vol: 0.06, rate: 0.6 });
  }

  /** A floating box rocks (the i-th wobble): a hollow knock and a little rising chime, a step higher each time. */
  boxWobble(i = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 0.09, type: 'lowpass', freq: 320, q: 1.2, vol: 0.12, rate: 1 });
    this.sweep(t, 140 + i * 18, 90 + i * 12, 0.18, 0.03, 'triangle');
    this.pluck(587 * Math.pow(2, (i * 4) / 12), t + 0.03, 0.035, 'sine', this.fx);
  }

  /** The light pours out: a bright rising shimmer. */
  boxBurst() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 1.4, type: 'highpass', freq: 3800, q: 0.4, vol: 0.09, rate: 1.2 });
    for (let i = 0; i < 7; i++) this.sweep(t + i * 0.06, 900 + i * 260, 1800 + i * 420, 0.5, 0.018, 'sine');
  }

  /**
   * The item rises: a small fanfare of its own, a rising arpeggio that lands on a
   * held chord (in absolute pitches, so it sounds the same in every world's scale).
   */
  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, bus = this.fx;
    const n = (semi) => 392 * Math.pow(2, semi / 12);            // from G4
    const notes = [[0, 0], [4, 0.13], [7, 0.26], [11, 0.39], [12, 0.6]];   // G B D F# G: up and open
    for (const [s, d] of notes) { this.pluck(n(s), t + d, 0.11, 'triangle', bus); this.pluck(n(s + 12), t + d, 0.035, 'sine', bus); }
    // the held chord under the last note
    for (const s of [0, 7, 12, 16]) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = n(s - 12); f.type = 'lowpass'; f.frequency.value = 1800;
      g.gain.setValueAtTime(0, t + 0.6); g.gain.linearRampToValueAtTime(0.03, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0005, t + 2.8);
      o.connect(f).connect(g).connect(bus); o.start(t + 0.6); o.stop(t + 2.9);
    }
  }

  /**
   * The father's charge is given (src/story/charge.js): a low open fifth swelling under three
   * slow notes that climb and settle, and one clear high note over them, like a vow. In
   * absolute pitches (D), the same in every world.
   */
  charge() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.05, bus = this.fx;
    const n = (semi) => 293.66 * Math.pow(2, semi / 12);            // from D4
    for (const [s, v] of [[-12, 0.05], [-5, 0.035], [0, 0.02]]) {    // D3, A3, D4: held, swelling, fading
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = n(s); f.type = 'lowpass'; f.frequency.value = 1200;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 1.4); g.gain.setValueAtTime(v, t + 3.2); g.gain.exponentialRampToValueAtTime(0.0005, t + 5.6);
      o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + 5.7);
    }
    [[0, 0.5], [4, 1.0], [7, 1.5], [5, 2.15], [7, 2.6]].forEach(([s, d]) => { this.pluck(n(s + 12), t + d, 0.07, 'sine', bus); this.pluck(n(s), t + d, 0.03, 'triangle', bus); });
    for (const [m, v, d] of [[1, 0.05, 2.8], [2.76, 0.014, 1.4]]) {   // the high D, a little bell in it
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = n(24) * m;
      g.gain.setValueAtTime(0, t + 3.1); g.gain.linearRampToValueAtTime(v, t + 3.13); g.gain.exponentialRampToValueAtTime(0.0005, t + 3.1 + d);
      o.connect(g).connect(bus); o.start(t + 3.1); o.stop(t + 3.2 + d);
    }
  }

  /**
   * A moment's swell (src/story/moment.js): a phrase of the world's own score, over a pad that
   * grows under it, while the score and the bands step back. kind 'motif': the world's
   * leitmotif on its lead (the first water running); 'father': the father's theme in the
   * world's mode, on the world's voice for it (the duduk in the desert), as when he gave his
   * charge. From `pos` (a Vector3 or a function), like a band. Returns its length (s).
   */
  swell(kind = 'motif', pos = null, { spb = kind === 'father' ? 0.82 : 0.62, vol = 1 } = {}) {
    if (!this.ctx) return 0;
    if (!this.bands) this.makeBands();
    this.bands = this.bands.filter((b) => !b.solo);
    const ctx = this.ctx, t0 = ctx.currentTime + 0.25, S = this.S;
    const input = ctx.createGain(), gain = ctx.createGain();
    gain.gain.value = 0;
    input.connect(gain).connect(this.world);
    const send = ctx.createGain(); send.gain.value = 0.75; gain.connect(send).connect(this.reverb);
    const phrase = kind === 'father' ? fatherIn(S) : S.motif;
    const voice = kind === 'father' ? S.pal.father ?? 'duduk' : S.pal.lead ?? 'flute';
    let t = t0;
    for (const [deg, beats] of phrase) {
      if (deg !== null) this.instrument(voice, this.freq(deg, 1), t, beats * spb * 1.05, 0.11 * vol, input);
      t += beats * spb;
    }
    const len = t - t0;
    // the pad: the tonic, then the chord the phrase lands on, swelling in and holding past the last note
    for (const [i, d] of [0, kind === 'father' ? 4 : 3, 0].entries()) {
      const at = t0 + (i * len) / 3;
      this.instrument('strings', this.freq(d, -1), at, len / 3 + 0.9, 0.06 * vol, input);
      this.instrument('strings', this.freq(d + 2, 0), at + 0.15, len / 3 + 0.7, 0.035 * vol, input);
    }
    this._swellUntil = t0 + len + 1;
    this.bands.push({ id: 'solo', solo: true, pos: pos ?? (() => (this._ear ? { x: this._ear.x, y: this._ear.y, z: this._ear.z } : null)), radius: 80, parts: [], vol: 1, duck: 1, input, gain, pan: null, level: 0, mode: 'play', phrase: 0, until: t0 + len + 1.5 });
    return len + 0.25;
  }

  /** An unopened box answers the bell: a small far chime (vol 0..1 by distance). */
  boxAnswer(vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [12, 19].forEach((s, i) => this.pluck(392 * Math.pow(2, s / 12), t + i * 0.09, 0.05 * vol, 'sine', this.fx));
  }

  /**
   * Calling the mount: a two-fingered whistle, a quick rise then a long falling note
   * (a taxi gets a shorter, flatter hail). A pure tone sliding about 2-3 kHz, with a little
   * vibrato and breath noise round it.
   */
  whistle(kind = 'mount') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = kind === 'taxi'
      ? [[0, 0.16, 2100, 2500, 2400]]
      : [[0, 0.13, 1700, 2600, 2600], [0.2, 0.42, 2900, 3000, 1900]];
    for (const [at, dur, f0, f1, f2] of notes) {
      const s = t + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, s);
      o.frequency.exponentialRampToValueAtTime(f1, s + Math.min(0.06, dur * 0.4));
      o.frequency.exponentialRampToValueAtTime(f2, s + dur);
      const vib = ctx.createOscillator(), vg = ctx.createGain();
      vib.frequency.value = 7; vg.gain.value = 18; vib.connect(vg).connect(o.frequency);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.11, s + 0.02);
      g.gain.setValueAtTime(0.11, s + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0005, s + dur + 0.06);
      o.connect(g).connect(this.fx);
      o.start(s); o.stop(s + dur + 0.1); vib.start(s); vib.stop(s + dur + 0.1);
      this.burst(s, { dur: dur + 0.05, type: 'bandpass', freq: f1, q: 4, vol: 0.025, rate: 1 });   // (the breath)
    }
  }

  /**
   * Someone calling you over (src/story/desert.js, "calling you over"): a breathy "psst" at their place
   * (a hiss through the teeth, stopped short), then a little rising hum in the throat, "mm-hm?".
   */
  psst(pos = null) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.02, { gain, pan } = this.placeAt(pos, 45);
    if (gain < 0.02) return;
    const out = ctx.createGain(); out.gain.value = gain;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; out.connect(p).connect(this.fx); } else out.connect(this.fx);
    // the hiss: high band noise, "p" as a quick onset, "sss" held, "t" a click that stops it
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
    g.gain.setValueAtTime(0.07, t + 0.24); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.2); src.stop(t + 0.34);
    const c = ctx.createBufferSource(); c.buffer = this.noiseBuf;
    const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 2400;
    const cg = ctx.createGain(); cg.gain.setValueAtTime(0.07, t + 0.31); cg.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
    c.connect(cf).connect(cg).connect(out); c.start(t + 0.31, Math.random()); c.stop(t + 0.37);
    // the hum: two soft notes, the second a little higher
    for (const [at, f0, f1] of [[0.5, 196, 200], [0.74, 220, 262]]) {
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f0, t + at); o.frequency.linearRampToValueAtTime(f1, t + at + 0.2);
      lp.type = 'lowpass'; lp.frequency.value = 900;
      og.gain.setValueAtTime(0.0001, t + at); og.gain.exponentialRampToValueAtTime(0.05, t + at + 0.04); og.gain.exponentialRampToValueAtTime(0.0005, t + at + 0.24);
      o.connect(lp).connect(og).connect(out); o.start(t + at); o.stop(t + at + 0.26);
    }
    setTimeout(() => { try { out.disconnect(); p?.disconnect(); } catch { /* gone */ } }, 1500);
  }

  /**
   * A short tune on an instrument, on the effects bus (something you play, not the score):
   * notes [[Hz, beats]], a beat `beat` s. Vael's rider's call on the flute (src/story/arzach-data.js).
   */
  tune(notes, beat = 0.22, kind = 'flute', vol = 0.16) {
    if (!this.ctx) return false;
    let t = this.ctx.currentTime + 0.05;
    for (const [f, beats] of notes) { const d = beats * beat; this.instrument(kind, f, t, d, vol, this.fx); t += d; }
    return true;
  }

  /** The bell-note whistle: one clear note with a bell's inharmonic partials. */
  bell() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, f0 = 587.3;
    for (const [m, v, d] of [[1, 0.09, 2.6], [2.76, 0.035, 1.6], [5.4, 0.018, 0.9], [0.5, 0.03, 2.2]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f0 * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
      o.connect(g).connect(this.fx); o.start(t); o.stop(t + d + 0.05);
    }
  }

  page() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 0.35, type: 'bandpass', freq: 3200, q: 0.6, vol: 0.12, rate: 0.8 });
  }

  whoosh() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(3000, t + 1.2);
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.4, t + 0.6); g.gain.linearRampToValueAtTime(0, t + 1.4);
    src.connect(f).connect(g).connect(this.fx);
    src.start(t); src.stop(t + 1.5);
    [0, 4, 7, 11].forEach((d, i) => this.pluck(this.freq(d, 1), t + 0.2 + i * 0.15, 0.08, 'triangle', this.fx));
  }

  /** Wildlife: a small sound for a creature's surprise (vol 0..1, by distance). */
  critter(kind = 'squeak', vol = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime, v = Math.max(0, Math.min(1, vol));
    const sweep = (f0, f1, dur, type = 'sine', g0 = 0.05, wobble = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      if (wobble) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = wobble; lg.gain.value = f0 * 0.08; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(g0 * v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g).connect(this.fx); o.start(t); o.stop(t + dur + 0.05);
    };
    const noise = (o) => this.burst(t + (o.at ?? 0), { ...o, vol: (o.vol ?? 0.1) * v });
    switch (kind) {
      case 'inflate': sweep(300, 1400, 0.9, 'triangle', 0.04, 9); break;                                  // a balloon squeak
      case 'boing': sweep(180, 620, 0.35, 'triangle', 0.05, 14); break;
      case 'portal': sweep(900, 220, 0.5, 'sine', 0.05, 30); sweep(450, 1800, 0.4, 'sine', 0.025); break;
      case 'chime': case 'bloom': [0, 4, 7].forEach((d, i) => this.pluck(this.freq(d, 2), t + i * 0.09, 0.05 * v, 'sine', this.fx)); break;
      case 'jet': case 'whirr': noise({ dur: 1.1, type: 'bandpass', freq: kind === 'jet' ? 900 : 2400, q: 2, vol: 0.12, rate: 1.4 }); sweep(220, 900, 1, 'sawtooth', 0.012); break;
      case 'clank': case 'clack': case 'blip': noise({ dur: 0.07, type: 'bandpass', freq: kind === 'clank' ? 1300 : kind === 'clack' ? 2200 : 3400, q: 6, vol: 0.18 }); if (kind === 'blip') sweep(1200, 1600, 0.12, 'square', 0.015); break;
      case 'splash': case 'skip': case 'plop': noise({ dur: 0.25, type: 'lowpass', freq: 1800, q: 0.6, vol: 0.12 }); sweep(kind === 'plop' ? 500 : 700, 160, 0.15, 'sine', 0.05); break;
      case 'poof': case 'puff': case 'spores': noise({ dur: kind === 'spores' ? 0.8 : 0.45, type: 'lowpass', freq: kind === 'spores' ? 2600 : 700, q: 0.5, vol: 0.16, rate: 0.7 }); break;
      case 'flutter': case 'scribble': for (let i = 0; i < 6; i++) noise({ at: i * 0.05, dur: 0.04, type: 'highpass', freq: kind === 'flutter' ? 3000 : 5000, q: 1, vol: 0.05 }); break;
      case 'creak': sweep(140, 90, 0.6, 'sawtooth', 0.012, 22); break;
      case 'daze': sweep(900, 260, 0.7, 'sine', 0.035, 11); break;                                       // a dazed wobble down
      case 'flash': sweep(2400, 600, 0.25, 'sine', 0.03); break;
      default: sweep(1300, 2300, 0.12, 'sine', 0.04); sweep(1700, 2900, 0.1, 'sine', 0.025);             // an alarmed squeak / pop
    }
  }

  // ------------------------------------------------------------------ the traveller's tool
  /** A pitched blip that slides from f0 to f1 (the tool's voice). */
  sweep(t, f0, f1, dur, vol, type = 'sine') {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(this.fx);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** Shoot: a wet, rising bloop as a glob leaves the nozzle (stilling: a glassy ping; ember: a crackling whoosh). */
  fluidShoot(mode = 'shoot') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (mode === 'stun') { this.sweep(t, 1400, 2600, 0.14, 0.08, 'sine'); this.sweep(t + 0.03, 2100, 900, 0.2, 0.04, 'triangle'); return; }
    if (mode === 'fire') { this.burst(t, { dur: 0.22, type: 'bandpass', freq: 600, q: 0.6, vol: 0.2, rate: 0.7 }); this.sweep(t, 180, 520, 0.16, 0.1, 'sawtooth'); return; }
    this.sweep(t, 260, 720, 0.11, 0.16);
    this.sweep(t + 0.02, 520, 1500, 0.08, 0.05, 'triangle');
    this.burst(t, { dur: 0.09, type: 'bandpass', freq: 1100, q: 1.1, vol: 0.14, rate: 0.8 });
  }

  /** The gun mode switches: a click and a rising (stilling: high, glassy; ember: low, warm) chirp. */
  fluidMode(mode = 'shoot') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 0.03, type: 'highpass', freq: 3000, q: 1, vol: 0.06 });
    const f = mode === 'stun' ? [1500, 2400] : mode === 'fire' ? [300, 700] : [600, 1100];
    this.sweep(t + 0.02, f[0], f[1], 0.12, 0.06, mode === 'fire' ? 'triangle' : 'sine');
  }

  /** The backpack clicks into a vehicle's socket (on) and comes back out: a clack and a hum rising or falling. */
  fluidDock(on = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 0.05, type: 'bandpass', freq: 2200, q: 2, vol: 0.12 });
    this.sweep(t + 0.03, on ? 110 : 260, on ? 260 : 110, 0.35, 0.08, 'triangle');
  }

  /** A glob lands: a splat on the world, and a bright two-note pop when it lands on someone or something. */
  fluidSplash(target = false, mode = 'shoot') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (mode === 'stun') { this.sweep(t, 2600, 1800, 0.3, 0.05, 'sine'); if (target) [11, 14].forEach((d, i) => this.pluck(this.freq(d, 2), t + 0.03 + i * 0.09, 0.06, 'sine', this.fx)); return; }
    if (mode === 'fire') { this.burst(t, { dur: 0.35, type: 'lowpass', freq: 900, q: 0.5, vol: 0.2, rate: 0.6 }); this.burst(t + 0.05, { dur: 0.25, type: 'highpass', freq: 3000, q: 0.4, vol: 0.05, rate: 1.5 }); return; }
    this.burst(t, { dur: 0.16, type: 'lowpass', freq: 1500, q: 0.7, vol: 0.16, rate: 0.9 });
    this.sweep(t, 620, 150, 0.12, 0.08);
    if (target) [4, 9].forEach((d, i) => this.pluck(this.freq(d, 2), t + 0.04 + i * 0.07, 0.07, 'triangle', this.fx));
  }

  /** Push: a deep whump with a rush of spray. */
  fluidPush() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sweep(t, 160, 48, 0.28, 0.3);
    this.burst(t, { dur: 0.32, type: 'bandpass', freq: 700, q: 0.6, vol: 0.24, rate: 0.6 });
    this.burst(t + 0.04, { dur: 0.25, type: 'highpass', freq: 2600, q: 0.5, vol: 0.07, rate: 1.2 });
  }

  /** Boost: a pressurised gush going up. */
  fluidBoost() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 0.4, type: 'bandpass', freq: 900, q: 0.7, vol: 0.26, rate: 0.7 });
    this.sweep(t, 140, 420, 0.3, 0.14, 'triangle');
    this.sweep(t + 0.05, 600, 1800, 0.22, 0.03);
  }

  /** The tank refills: a quick bubbling run up the scale (a longer, brighter one when a colour is added). */
  fluidRefill(added = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = added ? [0, 2, 4, 7, 9, 11, 14] : [0, 4, 7, 11];
    notes.forEach((d, i) => {
      this.pluck(this.freq(d, 1), t + i * 0.07, 0.07, 'sine', this.fx);
      this.sweep(t + i * 0.07, 380 + i * 90, 900 + i * 160, 0.05, 0.03);   // bubbles
    });
    this.burst(t, { dur: 0.35, type: 'bandpass', freq: 1800, q: 1.2, vol: 0.05, rate: 1.3 });
  }

  /** A press with the tank empty: a dry, sputtering click. */
  fluidEmpty() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sweep(t, 300, 180, 0.08, 0.06, 'square');
    this.burst(t + 0.03, { dur: 0.06, type: 'bandpass', freq: 900, q: 2, vol: 0.06 });
  }

  /**
   * The scout's voice (src/scout.js): 'go' a little rising blip as it hops off the dock;
   * 'found' two bright chirps as it points at the objective; 'shrug' a falling "uh-uh", nothing to find;
   * 'hint' (a guardian's fight) a low "hm" then a little rising "look!", as it turns its lens on the weak point.
   */
  drone(kind = 'go') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === 'found') { this.sweep(t, 1500, 2600, 0.07, 0.045); this.sweep(t + 0.11, 1900, 3200, 0.09, 0.05); this.pluck(this.freq(7, 2), t + 0.11, 0.05, 'sine', this.fx); }
    else if (kind === 'hint') { this.sweep(t, 620, 560, 0.1, 0.035, 'triangle'); this.sweep(t + 0.14, 1100, 2100, 0.08, 0.045); this.sweep(t + 0.24, 1600, 2900, 0.07, 0.04); }
    else if (kind === 'shrug') { this.sweep(t, 900, 760, 0.12, 0.04, 'triangle'); this.sweep(t + 0.17, 760, 520, 0.16, 0.04, 'triangle'); }
    else this.sweep(t, 700, 1400, 0.1, 0.035);
  }

  // ------------------------------------------------------------------ water (src/water.js)
  /** Going in, coming out, a big drop: a wet slap and a falling hiss, bigger with k (0..2). */
  splash(k = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, K = Math.min(k, 2);
    this.burst(t, { dur: 0.12 + 0.2 * K, type: 'lowpass', freq: 900 + 500 * K, q: 0.6, vol: 0.1 + 0.12 * K, rate: 0.7 });
    this.burst(t + 0.03, { dur: 0.25 + 0.4 * K, type: 'highpass', freq: 2400, q: 0.5, vol: 0.03 + 0.05 * K, rate: 1.3 });
    if (K > 0.8) this.sweep(t, 180, 70, 0.18 + 0.1 * K, 0.06 * K);
  }

  /** A swimming stroke: a soft wash (the crawl's is quicker, brighter). */
  stroke(crawl = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 0.22 - 0.08 * crawl, type: 'bandpass', freq: 700 + 500 * crawl + Math.random() * 200, q: 0.8, vol: 0.06 + 0.03 * crawl, rate: 0.8 });
  }

  /** A step in shallow water: a slosh, deeper in deeper water (deep 0..1). */
  wade(deep = 0.5) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 0.1 + 0.12 * deep, type: 'lowpass', freq: 1500 - 600 * deep + Math.random() * 300, q: 0.9, vol: 0.06 + 0.07 * deep, rate: 0.9 });
  }

  /** Bubbles: a few rising blips (diving, a stroke under water, out of air). */
  bubbles(k = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, n = Math.round(2 + 3 * k);
    for (let i = 0; i < n; i++) {
      const f = 380 + Math.random() * 520;
      this.sweep(t + i * (0.05 + Math.random() * 0.06), f, f * 1.9, 0.05, 0.025 * k, 'sine');
    }
  }

  /** Breaking the surface after a long time under: a gasp. */
  gasp() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.burst(t, { dur: 0.32, type: 'bandpass', freq: 1300, q: 1.4, vol: 0.07, rate: 1.1 });
  }

  /** Under water (k 1) the world's sound goes dull and close; back out (k 0), bright again. */
  underwater(k = 0) {
    if (!this.ctx || !this.muffle || this._under === k) return;
    this._under = k;
    const t = this.ctx.currentTime;
    this.muffle.frequency.setTargetAtTime(k ? 520 : 22000, t, k ? 0.06 : 0.15);
  }

  // ------------------------------------------------------------------ musicians in the world
  /**
   * @param bands [{ id, pos: Vector3 | () => Vector3, radius, parts: ['oud', 'ney', 'drum', 'chant', 'bell'], mode, vol }]
   */
  setBands(bands) {
    this.bandDefs = bands;
    this.bands = null;
    if (this.ctx) this.makeBands();
  }
  makeBands() {
    const ctx = this.ctx;
    this.bands = (this.bandDefs ?? []).map((d) => {
      const input = ctx.createGain(), gain = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      gain.gain.value = 0;
      input.connect(gain);
      (pan ? gain.connect(pan) : gain).connect(this.world);
      const send = ctx.createGain(); send.gain.value = 0.35; gain.connect(send).connect(this.reverb);
      return Object.assign(d, { input, gain, pan, level: 0, mode: d.mode ?? 'play', phrase: 0 });
    });
  }
  band(id) { return (this.bands ?? this.bandDefs)?.find((b) => b.id === id) ?? null; }
  setBandMode(id, mode) { const b = this.band(id); if (b) b.mode = mode; }
  /** Per frame: levels and panning from the listener (the camera) and the player. */
  listen(pos, yaw) {
    this._ear = { x: pos.x, y: pos.y, z: pos.z, yaw };   // (the singing spheres place their notes by it)
    if (!this.ctx || !this.bands) return;
    const t = this.ctx.currentTime;
    let near = 0;
    this.bands = this.bands.filter((b) => !b.solo || b.until > t);
    const hush = this.soloing ? 0.2 : 1;
    for (const b of this.bands) {
      const p = typeof b.pos === 'function' ? b.pos() : b.pos;
      if (!p) { b.level = 0; b.gain.gain.setTargetAtTime(0, t, 0.3); continue; }
      const dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz, (p.y - pos.y) * 0.5);
      const k = Math.max(0, 1 - d / b.radius);
      b.level = k * k * (b.vol ?? 1);
      near = Math.max(near, Math.max(0, 1 - d / (b.radius * 0.45)) * (b.duck ?? 1));
      b.gain.gain.setTargetAtTime(this.muted ? 0 : b.level * 0.9 * this.musicVol * (b.solo ? 1 : hush), t, b.solo ? 0.25 : 0.8);
      if (b.pan) {
        // the camera looks along -z turned by yaw: its right is +x turned by yaw
        const rx = Math.cos(yaw), rz = -Math.sin(yaw);
        b.pan.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, (dx * rx + dz * rz) / Math.max(d, 1) * 0.9)), t, 0.2);
      }
    }
    // the score steps back when you stand among musicians
    // (and under a moment's swell: src/story/moment.js, swell())
    const swell = (this._swellUntil ?? 0) > t ? 0.3 : 1;
    this.music.gain.setTargetAtTime(0.62 * this.musicVol * (1 - 0.7 * Math.min(near, 1)) * swell, t, swell < 1 ? 0.35 : 0.8);
  }
  /** One beat of a band, scheduled with the score's beat. */
  bandBeat(b, t, spb) {
    const beat = this.beat, chord = this.chord, D = b.input;
    const feast = b.mode === 'feast', near = b.mode === 'near';
    const v = (b.vol ?? 1) * 0.9;
    for (const part of b.parts) {
      if (part === 'drum') {
        // a frame drum: dum . tek dum | tek . dum tek (eighths), doubled at the feast
        const pat = feast ? [2, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 1] : [2, 0, 1, 2, 1, 0, 2, 1];
        const sub = feast ? 4 : 2;
        for (let k = 0; k < sub; k++) {
          const hit = pat[(beat * sub + k) % pat.length], tt = t + k * spb / sub;
          if (hit === 2) this.dum(tt, 0.32 * v, D);
          else if (hit === 1) this.tek(tt, 0.13 * v, D);
        }
        if (feast && beat % 2 === 1) this.clap(t + spb / 2, 0.1 * v, D);
      } else if (part === 'oud') {
        if (near || feast) {
          // they pick up the world's tune, quicker, with grace notes
          if (beat % 8 === 0) {
            let tt = t;
            for (const [deg, beats] of this.voice.melody) {
              if (deg !== null) {
                this.instrument('oud', this.freq(deg, 1), tt, beats * spb * 0.5, 0.16 * v, D);
                if (Math.random() < 0.3) this.instrument('oud', this.freq(deg + 1, 1), tt + 0.06, 0.05, 0.07 * v, D);
              }
              tt += beats * spb * 0.5;
            }
          }
        } else {
          // an ostinato on the chord: root, fifth, a turn
          const fig = [0, 4, 2, 4, 0, 4, 5, 4];
          for (let k = 0; k < 2; k++) if (Math.random() < 0.9) this.instrument('oud', this.freq(chord + fig[(beat * 2 + k) % 8], 0), t + k * spb / 2, spb * 0.45, 0.13 * v, D);
        }
      } else if (part === 'ney') {
        if (beat % 4 === 0 && (near || feast || Math.random() < 0.7)) {
          const deg = chord + [4, 2, 6, 3][(beat / 4 + b.phrase) % 4];
          this.instrument('ney', this.freq(deg, 1), t, spb * 3.6, 0.1 * v, D);
        }
        if (beat % 16 === 15) b.phrase++;
      } else if (part === 'chant') {
        if (beat % 8 === 0 && (feast || near || Math.random() < 0.6)) {
          this.instrument('chant', this.freq(chord, 0), t, spb * 3.8, 0.07 * v, D);
          this.instrument('chant', this.freq(chord + (feast ? 4 : 2), 0), t + spb * 4, spb * 3.8, 0.06 * v, D);
        }
      } else if (part === 'bell') {
        if (Math.random() < (feast ? 0.6 : 0.25)) this.instrument('bell', this.freq(chord + [0, 4, 7][beat % 3], 2), t + (beat % 2) * spb * 0.5, 1, 0.05 * v, D);
      }
    }
  }
  // ------------------------------------------------------------------ a musician's solo
  /**
   * A musician plays for you (Bako's ney): a slow, eerie tune in a hijaz mode,
   * gliding between its notes over a low drone, from `pos` (a Vector3 or a
   * function returning one). It joins the bands, so it fades with distance and
   * pans like them, and the score and the other bands step back while it plays.
   * Returns its length in seconds (0 without sound).
   */
  solo(pos, { root = 293.66, radius = 70, vol = 1 } = {}) {
    if (!this.ctx) return 0;
    if (!this.bands) this.makeBands();
    this.bands = this.bands.filter((b) => !b.solo);
    const ctx = this.ctx, t0 = ctx.currentTime + 0.4;
    const input = ctx.createGain(), gain = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    gain.gain.value = 0;
    input.connect(gain);
    (pan ? gain.connect(pan) : gain).connect(this.world);
    const send = ctx.createGain(); send.gain.value = 0.7; gain.connect(send).connect(this.reverb);   // a lot of room: it carries over the dunes
    let t = t0;
    for (const phrase of SOLO_TUNE) { this.soloPhrase(phrase, root, t, input, 0.16 * vol); t += phrase.reduce((a, [, d]) => a + d, 0) + 1.3; }
    const len = t - t0;
    this.soloDrone(root / 2, t0 - 0.3, len + 1, input, 0.05 * vol);
    this.bands.push({ id: 'solo', solo: true, pos, radius, parts: [], vol: 1.2, duck: 1, input, gain, pan, level: 0, mode: 'play', phrase: 0, until: t0 + len + 2 });
    return len + 0.4;
  }
  /** Is a solo playing (other bands hush under it)? */
  get soloing() { return !!this.bands?.some((b) => b.solo && b.until > (this.ctx?.currentTime ?? 0)); }
  /** One breath of the solo: one reed voice gliding from note to note, falling into each from a little below. */
  soloPhrase(notes, root, t, dest, vol) {
    const ctx = this.ctx, f = (n) => root * Math.pow(2, n / 12);
    const len = notes.reduce((a, [, d]) => a + d, 0);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'triangle'; o2.type = 'sine'; g2.gain.value = 0.18;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 4.2; lg.gain.value = 0;
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const nb = ctx.createBiquadFilter(); nb.type = 'bandpass'; nb.Q.value = 2.2;
    const ng = ctx.createGain(); ng.gain.value = 0.32;
    o.connect(g); o2.connect(g2).connect(g); n.connect(nb).connect(ng).connect(g); g.connect(dest);
    g.gain.value = 0; g.gain.setValueAtTime(0, t);
    let at = t;
    notes.forEach(([semi, d], i) => {
      const hz = f(semi);
      // a quarter tone under, then up into the note (the first one sets the pitch outright)
      if (i === 0) { o.frequency.setValueAtTime(hz * 0.985, at); o2.frequency.setValueAtTime(hz * 2 * 0.985, at); }
      o.frequency.setTargetAtTime(hz, at, 0.07); o2.frequency.setTargetAtTime(hz * 2, at, 0.07);
      nb.frequency.setValueAtTime(hz * 1.6, at);
      // each note swells a little; the long ones grow a slow vibrato
      g.gain.setTargetAtTime(vol * (d > 1.5 ? 1 : 0.8), at, d > 1.5 ? 0.35 : 0.08);
      lg.gain.setValueAtTime(0, at);
      if (d > 1) lg.gain.linearRampToValueAtTime(hz * 0.014, at + d * 0.8);
      at += d;
    });
    g.gain.setTargetAtTime(0, at - 0.5, 0.25);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + len + 2); }
    n.start(t, Math.random() * 1.5); n.stop(t + len + 2);
  }
  /** The drone under the solo: the tonic and its fifth, low, breathing slowly. */
  soloDrone(hz, t, len, dest, vol) {
    const ctx = this.ctx, lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g).connect(dest);
    for (const [k, type] of [[1, 'sawtooth'], [1.5, 'triangle'], [0.5, 'sine']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = hz * k; o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(lp); o.start(t); o.stop(t + len + 3);
    }
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.09; lg.gain.value = vol * 0.4;
    lfo.connect(lg).connect(g.gain); lfo.start(t); lfo.stop(t + len + 3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 3);
    g.gain.setValueAtTime(vol, t + len - 1); g.gain.linearRampToValueAtTime(0, t + len + 2.5);
  }
  dum(t, vol, dest) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(58, t + 0.18);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4);
    o.connect(g).connect(dest); o.start(t); o.stop(t + 0.45);
    this.noiseHit(t, 0.06, 'lowpass', 500, vol * 0.4, dest);
  }
  tek(t, vol, dest) { this.noiseHit(t, 0.05, 'bandpass', 2600, vol, dest); }
  clap(t, vol, dest) { for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.012, 0.04, 'bandpass', 1500, vol, dest); }
  noiseHit(t, dur, type, freq, vol, dest) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.value = vol; src.connect(f).connect(g).connect(dest);   // (no click: see burst)
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  // ------------------------------------------------------------------ voices
  /**
   * Sing a planned line (src/story/voice.js planLine) from now.
   * @param o.channel 'balloon' | 'call' | 'choice' · o.gain 0..1 (distance) · o.pan -1..1 · o.radio 0..1 (a speaker grille)
   * @returns false if it was not played (no audio yet, muted, voices off, too many at once)
   */
  speak(plan, { channel = 'balloon', gain = 1, pan = 0, radio = 0 } = {}) {
    if (!this.ctx || this.muted || !this.alienVoices || !plan?.syllables?.length) return false;
    const ctx = this.ctx, t = ctx.currentTime + 0.03;
    if (channel === 'balloon' && !this.canSpeak('balloon', gain)) return false;
    const out = this.utterance({ gain, pan, radio: Math.max(radio, plan.syllables[0].radio ?? 0) });
    for (const s of plan.syllables) renderSyllable(ctx, out.input, s, t + s.t, this.noiseBuf);
    const end = t + plan.total + 0.2;
    out.stopAt(end + 0.5);
    if (channel === 'balloon') this._balloons.push({ end });
    if (channel === 'call') { this._calls?.fade(); this._calls = out; this._talkUntil = end; }
    if (channel === 'choice') this._talkUntil = Math.max(this._talkUntil, end);
    this.trace(channel, plan, gain);
    return true;
  }

  /** Is there room for another mumble now? (Balloons: a conversation or a call has the floor, and never more than a couple at once.) */
  canSpeak(channel = 'balloon', gain = 1) {
    if (!this.ctx || this.muted || !this.alienVoices) return false;
    if (channel !== 'balloon') return true;
    const t = this.ctx.currentTime;
    this._balloons = this._balloons.filter((b) => b.end > t);
    return t >= this._talkUntil && this._balloons.length < BALLOON_VOICES && gain >= 0.02;
  }

  /** One syllable now, for the dialogue panel's letter-by-letter reveal (alien voices off: the old blip). */
  syllable(s, { plan = null } = {}) {
    if (!this.ctx || this.muted || !s) return;
    if (!this.alienVoices) { this.blip(Math.max(0.5, Math.min(2.2, s.f0 / 170))); return; }
    const ctx = this.ctx, t = ctx.currentTime + 0.01, radio = s.radio ?? 0;
    if (!this._talk || this._talk.radio !== radio) this._talk = Object.assign(this.utterance({ radio, keep: true }), { radio });
    renderSyllable(ctx, this._talk.input, s, t, this.noiseBuf);
    this._talkUntil = t + s.dur + 0.4;
    if (plan && plan !== this._talkPlan) { this._talkPlan = plan; this.trace('dialogue', plan, 1); }
  }

  /** A conversation is open: the balloons around keep quiet meanwhile. */
  holdFloor(secs = 0.5) { if (this.ctx) this._talkUntil = Math.max(this._talkUntil, this.ctx.currentTime + secs); }

  /** Fade the call's voice (its subtitle was cleared or skipped). */
  hush(channel = 'call') {
    if (channel === 'call' && this._calls) { this._calls.fade(); this._calls = null; this._talkUntil = 0; }
  }

  /** A short-lived chain for one utterance: input → (grille) → gain → pan → the voice bus. */
  utterance({ gain = 1, pan = 0, radio = 0, keep = false } = {}) {
    const ctx = this.ctx, input = ctx.createGain(), g = ctx.createGain();
    g.gain.value = gain;
    let head = input;
    const nodes = [input, g];
    if (radio > 0) {
      // a speaker grille (the call screen, the market's radio patter): band-limited, made up in level
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 250 + 300 * radio;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800 - 1200 * radio; lp.Q.value = 2.2;
      head.connect(hp).connect(lp); head = lp; nodes.push(hp, lp);
      g.gain.value = gain * (1 + 0.9 * radio);
    }
    const p = pan && ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-0.9, Math.min(0.9, pan)); nodes.push(p); }
    head.connect(g);
    (p ? g.connect(p) : g).connect(this.voices);
    const stopAt = (when) => { if (!keep) setTimeout(() => { for (const n of nodes) n.disconnect(); }, Math.max(0, (when - ctx.currentTime) * 1000)); };
    return { input, gain: g, stopAt, fade: () => g.gain.setTargetAtTime(0, ctx.currentTime, 0.05) };
  }

  /** The dev / test record of what was said: the last 60 utterances. */
  trace(channel, plan, gain) {
    this.voiceLog.push({ channel, lang: plan.lang, tone: plan.tone, gain: +gain.toFixed(3), text: plan.text.slice(0, 60), at: +this.ctx.currentTime.toFixed(3),
      n: plan.syllables.length, total: +plan.total.toFixed(3), f0: plan.syllables.map((s) => Math.round(s.f0)) });
    if (this.voiceLog.length > 60) this.voiceLog.shift();
  }

  /** A soft syllable blip while someone's words appear (pitch: their voice). */
  blip(pitch = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    const base = 190 * pitch * (0.92 + Math.random() * 0.16);
    o.type = 'triangle'; o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * (0.9 + Math.random() * 0.25), t + 0.07);
    f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 1.4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    o.connect(f).connect(g).connect(this.fx); o.start(t); o.stop(t + 0.1);
  }

  /**
   * What you are doing, eased, for the score (src/score.js scoreBeat's `act`): walking comes
   * in over a couple of seconds and goes over several; riding, gliding or on the jets; how long
   * you have stood about; indoors (src/shelter.js); night; the storm.
   */
  follow(s) {
    const now = this.ctx?.currentTime ?? 0, dt = Math.min(0.5, Math.max(0, now - (this._actT ?? now)));
    this._actT = now;
    const A = this.act, speed = s.speed ?? 0, riding = !!s.riding || !!s.flying;
    const ease = (v, to, up, down) => v + (to - v) * (1 - Math.exp(-dt / (to > v ? up : down)));
    A.move = ease(A.move, Math.min(1, speed / 4), 2.5, 7);
    A.ride = ease(A.ride, riding ? 1 : 0, 2, 5);
    A.still = speed < 0.6 && !riding ? A.still + dt : 0;
    A.indoor = s.indoor ?? 0;
    A.night = ease(A.night, s.night ? 1 : 0, 5, 5);
    A.storm = s.storm ?? 0;
  }

  /** Per frame: drive the continuous layers from the game state. */
  update(s) {
    if (!this.ctx) return;
    if (this.bandDefs && !this.bands) this.makeBands();
    this.follow(s);
    const k = Math.min(s.speed / 11, 1.5);
    // the wind's whoosh sits under the music, not over it (storms still rise well above the calm)
    const W = AMBIENT_WIND;
    const highWind = this.voice.ambience === 'highwind' ? 0.03 : 0;
    this.set('howl', (s.gust * 0.012 + s.storm * 0.025 + highWind + (s.altitude > 60 ? 0.02 : 0)) * W, 700 + Math.sin(this.ctx.currentTime * 0.3) * 250);
    this.set('wind', (0.03 + s.gust * 0.05 + s.storm * 0.11 + k * 0.03 + (this.voice.ambience === 'city' ? 0.02 : 0)) * W, 420 + s.gust * 300 + s.storm * 400);
    this.set('rain', s.rain * 0.07);
    this.set('rainRoof', (s.rainRoof ?? 0) * 0.11);
    this.set('cloak', (s.riding ? 0.04 + k * 0.05 : Math.pow(Math.min(s.speed / 11, 1), 2) * 0.07) * (0.5 + 0.5 * W));
    this.set('jet', s.thrusting ? 0.32 : 0);
    const e = this.engine, t = this.ctx.currentTime;
    const motor = s.rideKind === 'bike' || s.rideKind === 'skiff' || s.rideKind === 'taxi';
    e.gain.gain.setTargetAtTime(motor ? 0.035 : 0, t, 0.2);
    e.osc.frequency.setTargetAtTime(38 + Math.abs(s.rideSpeed) * 2.2, t, 0.2);
    e.filter.frequency.setTargetAtTime(250 + Math.abs(s.rideSpeed) * 25, t, 0.2);
  }
}
