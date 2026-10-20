// A prototype's landing contract: the camp opens only after touchdown and closes completely before lift-off.
// Production integration can call landingComplete() from its real landing event; arrive() is the review's descent.

/** Open fractions for the side camp's mechanisms (0 secured, 1 deployed).
 * Reversing camp reverses the same physical sequence: loose items are secured
 * before rails and ramp fold, and the deck closes last. Geometry interprets these
 * values as hinge angles or travel along a rail, never as a shrinking solid.
 */
export function caravanStowPose(camp) {
  if (!Number.isFinite(camp)) throw new Error('A camp pose needs a finite deployment fraction');
  const t = Math.max(0, Math.min(1, camp));
  const stage = (a, b) => {
    const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  return {
    deck: stage(0, .30),
    supports: stage(.30, .43),
    ramp: stage(.35, .50),
    rails: stage(.50, .63),
    canopy: stage(.63, .82),
    props: stage(.65, .90),
    laundry: stage(.90, 1),
    solar: stage(.55, .80),
  };
}

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
