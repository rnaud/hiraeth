// Weather: each level alternates clear spells with episodes of its own
// weather (sandstorm, rain, fog banks) that ramp in, hold, and fade out.
// The state drives the composite shader, the wind, the cloth and the sound.
//
// A world's first minutes can be held clear (`calm`, issue #139): while calm() is true no episode starts and any
// weather fades out; once it lets go, a whole clear spell passes before the first one. The desert holds its sky
// clear until the first chest is opened (src/levels/content.js `calmUntil`, main.js): the traveller steps out of
// the crashed ship under a clean sky, walks to Qanat and opens the makers' chest in it; the storms come after.

export const WEATHER_KINDS = ['clear', 'storm', 'rain', 'fog'];

export class Weather {
  /** @param kinds the weather this level can have (besides clear) */
  constructor(kinds = [], { clear = [70, 150], episode = [35, 70], calm = null } = {}) {
    this.kinds = kinds;
    this.calm = calm;               // () => true while the sky must stay clear (the first arrival)
    this.calmed = false;
    this.clearRange = clear;
    this.episodeRange = episode;
    this.mode = 'auto';             // or a forced kind from the panel
    this.kind = 'clear';
    this.intensity = 0;
    this.target = 0;
    this.timer = this.rand(this.clearRange) * 0.5;   // first episode comes a little sooner
  }

  rand([a, b]) { return a + Math.random() * (b - a); }

  update(dt) {
    if (this.mode !== 'auto') {
      this.kind = this.mode === 'clear' ? this.kind : this.mode;
      this.target = this.mode === 'clear' ? 0 : 1;
    } else if (this.calm?.()) {
      this.calmed = true;
      this.target = 0;
    } else if (this.kinds.length) {
      // (just let go of a calm: a whole clear spell before the first episode)
      if (this.calmed) { this.calmed = false; this.target = 0; this.timer = this.rand(this.clearRange); }
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.target === 0) {
          this.kind = this.kinds[Math.floor(Math.random() * this.kinds.length)];
          this.target = 0.6 + Math.random() * 0.4;
          this.timer = this.rand(this.episodeRange);
        } else {
          this.target = 0;
          this.timer = this.rand(this.clearRange);
        }
      }
    }
    // ramp over ~8 s; once faded out, the kind no longer matters
    this.intensity += (this.target - this.intensity) * (1 - Math.exp(-dt / 6));
    return this.state;
  }

  get state() {
    const i = this.intensity;
    return {
      kind: this.kind,
      storm: this.kind === 'storm' ? i : 0,
      rain: this.kind === 'rain' ? i : 0,
      fog: this.kind === 'fog' ? i : 0,
    };
  }
}
