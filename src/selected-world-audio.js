// Shared, author-selected continuous effects. One handle per physical source;
// the caller removes the corresponding procedural bed instead of doubling it.
export class SelectedWorldAudio {
  constructor(sound) { this.sound = sound; this.loops = new Map(); }
  allowed() {
    const s = this.sound;
    return !!s.ctx && !s._disposed && !s.muted && !s.guard?.away() && !s._actionPaused;
  }
  loop(group, active, vol = 1) {
    const old = this.loops.get(group);
    if (!active || !this.allowed()) {
      old?.stop(0); this.loops.delete(group); return;
    }
    if (old) { old.set({ vol }); return; }
    const handle = this.sound.bank?.start(group, { dest: this.sound.fx, loop: true, vol });
    if (handle) this.loops.set(group, handle);
  }
  update(state) {
    // The glide remains quiet at speed; it is not another combustion motor.
    const bike = ['bike', 'skiff', 'taxi'].includes(state.rideKind);
    if (!this.arcadeBike) this.loop('hoverbike-glide', bike, .45 + .3 * Math.min(1, Math.abs(state.rideSpeed ?? 0) / 20));
    this.loop('temple-ambience', !!state.house);
  }
  motor() {
    this.arcadeBike = true;
    let stopped = false;
    return {
      set: (speed, boost, live) => {
        if (!stopped) this.loop('hoverbike-glide', live, .45 + .3 * Math.min(1, Math.abs(speed) / 20) + .05 * Math.min(1, Math.max(0, boost)));
      },
      stop: () => { stopped = true; this.arcadeBike = false; this.loop('hoverbike-glide', false); },
    };
  }
  stop() { for (const handle of this.loops.values()) handle.stop(0); this.loops.clear(); }
  dispose() { this.stop(); }
}
export function selectedWorldAudio(sound) { return sound._selectedWorldAudio ??= new SelectedWorldAudio(sound); }
