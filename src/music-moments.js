// When the recorded theme plays (Settings > Music: Moments, the default): it is kept for the moments,
// and ambience carries the open world between them, as in Breath of the Wild or Journey.
//
//  - arriving in a world, the theme plays for a while (arrival), then fades out;
//  - indoors (src/shelter.js) it plays, and lingers a little after you step out (indoorTail);
//  - a moment brings it back: a keepsake, a relic, a box's gift, a story moment's swell, the
//    father's charge (Sound.musicCue: moment);
//  - after a long quiet it comes back by itself for a while (back, after one of returnAfter);
//  - between them, the procedural score plays only its light layers (lightScore): the drone, a
//    sparse pluck, the world's colour, a pad, softly. No melody, no drums.
// Music: Always keeps the recording on all the time (the old way).
//
// MusicMoments is the pure state: cue(kind, now) and update(now, { indoor }) → { on, why }, which
// Sound (src/audio.js musicMoments) turns into the recording's fades.

export const MUSIC_MOMENTS = {
  arrival: 150,          // s the theme plays on arriving in a world
  moment: 110,           // s after a discovery or a story moment
  back: 90,              // s when it comes back by itself
  indoorTail: 20,        // s it lingers after you step out of an interior
  returnAfter: [300, 480],   // s of quiet before it comes back by itself (drawn each time)
  fadeIn: 3,             // s
  fadeOut: 10,           // s
};

export const MUSIC_MODES = ['moments', 'always'];
export const musicMode = (v) => (MUSIC_MODES.includes(v) ? v : 'moments');

export class MusicMoments {
  constructor({ mode = 'moments', now = 0, rand = Math.random, T = MUSIC_MOMENTS } = {}) {
    this.T = T; this.rand = rand;
    this.mode = musicMode(mode);
    this.from = now; this.until = now + T.arrival; this.why = 'arrival';
    this.nextBack = null;
    this.on = true;
  }

  setMode(mode) { this.mode = musicMode(mode); }

  /** A moment: the theme comes in (after `delay` s: a swell's phrase first) and holds for its kind's time. */
  cue(kind = 'moment', now = 0, { delay = 0, hold = null } = {}) {
    const start = now + Math.max(0, delay), end = start + (hold ?? this.T[kind] ?? this.T.moment);
    if (!this.playing(now)) this.from = start;
    if (end > this.until) { this.until = end; this.why = kind; }
    this.nextBack = null;
  }

  /** Is the theme meant to be playing at `now` (before indoors and Always)? */
  playing(now) { return now >= this.from && now < this.until; }

  /** Per frame: { on, why }. */
  update(now, { indoor = 0 } = {}) {
    if (this.mode === 'always') return this.result(true, 'always');
    if (indoor > 0.5) {
      if (!this.playing(now)) this.from = now;
      if (now + this.T.indoorTail > this.until) { this.until = now + this.T.indoorTail; this.why = 'indoor'; }
    }
    let on = this.playing(now);
    if (!on && now >= this.until) {
      // the quiet after: the theme comes back by itself in a while
      if (this.nextBack === null) { const [a, b] = this.T.returnAfter; this.nextBack = now + a + (b - a) * this.rand(); }
      if (now >= this.nextBack) { this.cue('back', now); on = true; }
    }
    return this.result(on, on ? this.why : 'quiet');
  }

  result(on, why) { this.on = on; return { on, why }; }
}

/** The light layers of the score (src/score.js scoreBeat events) that carry the quiet: softer, no melody or drums. */
export const LIGHT_LAYERS = { drone: 0.8, pad: 0.55, pluck: 0.7, color: 0.8, echo: 0.6 };
export function lightScore(events) {
  const out = [];
  for (const e of events) { const k = LIGHT_LAYERS[e.layer]; if (k) out.push({ ...e, vol: e.vol * k }); }
  return out;
}
