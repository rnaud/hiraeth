// One finite traveller voice at a time, shared by selected actions and legacy
// effort/hurt fallback. Footfalls and equipment foley remain independent.
export class TravellerVoice {
  constructor(sound) {
    this.sound = sound; this.active = null; this.until = 0; this.last = new Map();
    this.run = 0; this.recovery = false; this.running = false; this.speed = 0; this.paused = !!(sound._actionPaused || sound._voiceHeld);
  }
  get now() { return this.sound.ctx?.currentTime ?? 0; }
  allowed() { const s = this.sound; return !!s.ctx && !s._disposed && !s.muted && !s.guard?.away() && !this.paused; }
  stop() { this.active?.handle?.stop(0); this.active = null; this.until = this.now; }
  pause(on = true) {
    this.paused = on;
    if (on) { this.stop(); this.run = 0; this.recovery = false; this.running = false; }
  }
  // null means unavailable. Assigned recordings never substitute a synthesized cue.
  // false means intentionally suppressed: never layer a fallback over a voice.
  play(group, { vol = 1, at = 0, gap = .9, priority = 2, maxDuration = null, pos = null, reach = 60 } = {}) {
    if (!this.allowed()) return false;
    const now = this.now;
    if (now - (this.last.get(group) ?? -1e9) < gap) return false;
    if (now < this.until && (this.active?.priority ?? 10) >= priority) return false;
    const s = this.sound;
    if (s.bank?.state(group) !== 'ready') return null;
    // Higher-priority movement/attack can end a quiet running phrase, not add a
    // second source on top of it. Pending scheduled voices are also stopped.
    // Legacy rate variation can outlast the nominal decoded duration. Stop
    // the retained handle even beyond that deadline before accepting another.
    this.stop();
    let pan = 0;
    if (pos && s._ear) { const p = s.placeAt(pos, reach); vol *= Math.max(.25, p.gain); pan = p.pan * .5; }
    const h = s.bank.start(group, { dest: s.voices ?? s.fx, vol, pan, when: now + at, maxDuration });
    if (!h) return null;
    this.active = { handle: h, group, priority };
    this.until = now + at + Math.min(h.duration, maxDuration ?? Infinity);
    this.last.set(group, now); s._vocalAt = now;
    return true;
  }
  reserve(seconds) {
    if (!this.allowed() || this.now < this.until) return false;
    // A fallback grunt owns the same voice lane as a recorded replacement.
    this.stop();
    this.active = { priority: 10 }; this.until = this.now + seconds; return true;
  }
  bindSynth(out) {
    if (this.active?.priority === 10) this.active.handle = { stop: () => { out.gain.cancelScheduledValues(this.now); out.gain.setValueAtTime(0, this.now); } };
  }
  body(p, dt) {
    const v = p.vel, up = p.frame?.up;
    const vy = v ? (up ? v.x*up.x + v.y*up.y + v.z*up.z : v.y) : 0;
    this.speed = v ? Math.sqrt(Math.max(0, v.x*v.x + v.y*v.y + v.z*v.z - vy*vy)) : 0;
    if (!this.allowed()) { this.stop(); this.run = 0; this.recovery = false; this.running = false; return; }
    const valid = !p.dead && !p.down && !p.ride && !p.boarding && !p.unboarding && !p.climbing && !p.mantle && !p.swim && !(p.inWater?.depth > .4);
    const running = valid && p.onGround && this.speed >= 8;
    if (running) {
      this.run += Math.min(.1, Math.max(0, dt));
      if (this.run >= 6) this.play('vox-run', { gap: 14, priority: 0 });
    } else {
      if (this.active?.group === 'vox-run') this.stop();
      // A breath after a sustained sprint, once. Walking/idle never schedules a
      // repeating phrase; jumping out of a run is not a recovery event.
      if (this.running && this.run >= 4 && valid && p.onGround) this.recovery = true;
      if (!valid || !p.onGround) this.recovery = false;
      if (this.recovery && this.speed < 4) { this.play('vox-recover', { gap: 10, priority: 0 }); this.recovery = false; }
      this.run = 0;
    }
    this.running = running;
  }
  dispose() { this.stop(); this.paused = true; }
}
export function travellerVoice(sound) { return sound ? (sound._travellerVoice ??= new TravellerVoice(sound)) : null; }
