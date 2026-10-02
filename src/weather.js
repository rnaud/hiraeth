// Weather: each level alternates clear spells with episodes of its own
// weather (sandstorm, rain, fog banks) that ramp in, hold, and fade out.
// The state drives the composite shader, the wind, the cloth and the sound.

export const WEATHER_KINDS = ['clear', 'storm', 'rain', 'fog'];

export class Weather {
  /** @param kinds the weather this level can have (besides clear) */
  constructor(kinds = [], { clear = [70, 150], episode = [35, 70] } = {}) {
    this.kinds = kinds;
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
    } else if (this.kinds.length) {
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
