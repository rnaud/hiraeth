// A prototype's landing contract: the camp opens only after touchdown and closes completely before lift-off.
// Production integration can call landingComplete() from its real landing event; arrive() is the review's descent.
export class CaravanDeployment {
  constructor({ applyCamp, applyAltitude = () => {} }) {
    this.applyCamp = applyCamp; this.applyAltitude = applyAltitude;
    this.reset('landed');
  }
  reset(state = 'landed') {
    if (!['landed', 'flight'].includes(state)) throw new Error(`Unknown settled state: ${state}`);
    this.phase = state; this.camp = state === 'landed' ? 1 : 0; this.altitude = state === 'landed' ? 0 : 8;
    this.sync();
  }
  arrive() { if (this.phase !== 'flight') return false; this.phase = 'arriving'; return true; }
  landingComplete() { this.altitude = 0; this.phase = 'deploying'; this.sync(); }
  depart() { if (!['landed', 'deploying'].includes(this.phase)) return false; this.phase = 'departing'; return true; }
  update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('A deployment step needs a finite, non-negative time');
    // Consume each boundary before advancing the next phase; large playback steps cannot deploy in mid-air.
    while (dt > 0 && !['landed', 'flight'].includes(this.phase)) {
      let duration;
      if (this.phase === 'arriving') {
        duration = this.altitude / (8 / 3); const step = Math.min(dt, duration); this.altitude = Math.max(0, this.altitude - step * (8 / 3)); dt -= step;
        if (duration <= step) { this.altitude = 0; this.phase = 'deploying'; }
      } else if (this.phase === 'deploying') {
        duration = (1 - this.camp) * 4.2; const step = Math.min(dt, duration); this.camp = Math.min(1, this.camp + step / 4.2); dt -= step;
        if (duration <= step) { this.camp = 1; this.phase = 'landed'; }
      } else if (this.phase === 'departing') {
        duration = this.camp * 4.2; const step = Math.min(dt, duration); this.camp = Math.max(0, this.camp - step / 4.2); dt -= step;
        if (duration <= step) { this.camp = 0; this.phase = 'taking-off'; }
      } else if (this.phase === 'taking-off') {
        duration = (8 - this.altitude) / (8 / 2.5); const step = Math.min(dt, duration); this.altitude = Math.min(8, this.altitude + step * (8 / 2.5)); dt -= step;
        if (duration <= step) { this.altitude = 8; this.phase = 'flight'; }
      }
    }
    this.sync();
  }
  sync() { this.applyCamp(this.camp); this.applyAltitude(this.altitude); }
}
