// An even frame rate where the main thread can't hold the display's (docs/systems/xbox.md, "Why 20 fps"): a frame
// that takes 20-30 ms on a 60 Hz screen is shown for one refresh, then two, then one: an uneven 30-50 fps that
// judders more than a steady 30. With a preset's `pace: 'auto'` (the Xbox's), the game draws on every second
// refresh while its frames are too slow for every one, and goes back to every refresh once they are quick enough
// again (judged on the main thread's own time a frame, not the frame rate, which the pacing itself sets).
//
//   const pace = new FramePacer();
//   frame(ts): if (pace.skip(ts)) { requestAnimationFrame(frame); return; }   (a refresh left out: nothing done)
//   every window (~0.5 s): pace.judge(cpuMsPerFrame, refreshMs, preset.pace)
//
// The numbers: slow = the main thread over 0.85 of a refresh for 3 windows running (it misses refreshes);
// quick = under 0.6 of one for 8 windows running (1.5 s at 60 Hz with room to spare: no flapping between the two).

export const PACE = { slow: 0.85, slowWindows: 3, quick: 0.6, quickWindows: 8 };

export class FramePacer {
  constructor() {
    this.every = 1;   // draw on every n-th refresh (1: every one, 2: every second)
    this.last = 0;    // the timestamp of the last frame drawn
    this.period = 1000 / 60;
    this.slow = 0; this.quick = 0;
  }
  /** Leave out this animation frame? (ts: its timestamp). Only while pacing; a late frame is never held back. */
  skip(ts) {
    if (this.every <= 1 || !Number.isFinite(ts)) { this.last = ts; return false; }
    // (half a refresh of slack: the timestamps jitter round the vsync)
    if (this.last && ts - this.last < this.every * this.period - this.period * 0.5) return true;
    this.last = ts;
    return false;
  }
  /**
   * After a measuring window: cpu = the main thread's ms a frame drawn, refresh = the display's interval (ms),
   * mode = the preset's pace ('auto', or none: every refresh). Returns the frames-per-refresh now in force.
   */
  judge(cpu, refresh, mode) {
    // (the refresh read only while drawing every one: paced, the quickest interval is two of them)
    if (this.every === 1 && Number.isFinite(refresh) && refresh > 4 && refresh < 50) this.period = refresh;
    if (mode !== 'auto') { this.every = 1; this.slow = this.quick = 0; return this.every; }
    const p = this.period;
    if (this.every === 1) {
      this.slow = cpu > PACE.slow * p ? this.slow + 1 : 0;
      if (this.slow >= PACE.slowWindows) { this.every = 2; this.slow = this.quick = 0; }
    } else {
      this.quick = cpu < PACE.quick * p ? this.quick + 1 : 0;
      if (this.quick >= PACE.quickWindows) { this.every = 1; this.slow = this.quick = 0; }
    }
    return this.every;
  }
  /** The frame interval aimed at (ms). */
  get interval() { return this.every * this.period; }
}
