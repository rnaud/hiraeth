// The music page's player (music.html, src/music-page/catalog.js): the game's own Sound (src/audio.js), made at the
// first press and kept, with the page's helpers the catalogue's sounds use (`e`): a place in front of the listener to
// put a placed sound at, `hold` (a continuous layer driven every frame for a few seconds, then let go), `later`.
// Three kinds of play, one at a time each:
//   a file      an <audio> element through the context (so the one volume rules everything), with its seek bar
//   a score     the world's procedural score (src/score.js) from the beat of a seed, for a length, under an activity:
//               on its own music bus, so Stop cuts it at once and the next play starts clean
//   a loop      the menu music, the fight's layer, the musicians (until stopped)
// Effects and tunes just play over whatever is playing.

import { Sound, AMBIENCE } from '../audio.js';
import { scoreFor, sectionBeats } from '../score.js';
import { ACTS } from './catalog.js';

const EAR = { x: 0, y: 1.6, z: 0 };
/** Where a placed sound is put: a few metres ahead and a little to the right. */
export const SPOT = { x: 2, y: 1.6, z: -4 };

export class Player {
  constructor({ onState = () => {}, muted = false } = {}) {
    this.s = null;
    this.reviewMuted = muted;
    this.timers = new Set();
    this.disposed = false;
    this.vol = 0.8;
    this.onState = onState;
    this.holds = [];
    this.loops = new Map();
    this.e = {
      at: SPOT,
      later: (secs, fn) => { const id = setTimeout(() => { this.timers.delete(id); if (!this.disposed) fn(); }, secs * 1000); this.timers.add(id); return id; },
      hold: (secs, tick, end) => this.hold(secs, tick, end),
      phase: () => this._phase ?? 0,
    };
    this._frame = this._frame.bind(this);
  }

  /** A private owner: no gameplay input listeners and no output activation during preparation. */
  _soundOwner() {
    if (this.disposed) throw new Error('Preview stopped');
    if (!this.s) {
      this.s = new Sound('music-page', { score: false, autoStart: false, listen: false, muted: this.reviewMuted });
      this.s._unlisten?.();
      this.s.voice.ambience = 'none';
    }
    return this.s;
  }

  prepareEffects(options) { return this._soundOwner().prepareEffects(options); }

  /** A cancelled preparation must never activate or play through a replaced owner. */
  async preparePreview({ effects = false, retry = false, onProgress, current = () => true } = {}) {
    if (effects) await this.prepareEffects({ retry, onProgress });
    if (this.disposed || !current()) return null;
    const sound = await this.ready();
    return this.disposed || !current() ? null : sound;
  }

  /** The game's Sound, activated only by the page's explicit Play action. */
  sound() {
    const s = this._soundOwner();
    if (!s.ctx) {
      s.start();
      s.listen(EAR, 0);
      this.media = s.ctx.createGain();
      this.media.connect(s.master);
      this.setVolume(this.vol);
      this.frameId = requestAnimationFrame(this._frame);
    }
    if (s.ctx.state === 'suspended') s.ctx.resume();
    return s;
  }

  /** The Sound, and its context's clock under way (a sound asked for in the very press that made the context is lost). */
  async ready() {
    const s = this.sound();
    for (let i = 0; i < 40 && s.ctx.currentTime < 0.05; i++) await new Promise((r) => setTimeout(r, 25));
    return s;
  }

  setVolume(v) {
    this.vol = v;
    if (!this.s?.master) return;
    this.s.master.gain.setTargetAtTime(this.reviewMuted ? 0 : 0.9 * v, this.s.ctx.currentTime, 0.05);
  }

  /** Sing in a world's scale (the effects that use it: chimes, keys, swells). */
  setWorld(id) { const s = this._soundOwner(); s.setScore(id || 'desert'); s.scoreOff = true; }

  _frame() {
    if (this.disposed) return;
    const s = this.s;
    s.listen(EAR, 0);
    const now = performance.now();
    this.holds = this.holds.filter((h) => {
      this._phase = Math.min(1, (now - h.from) / (h.secs * 1000));
      if (now - h.from > h.secs * 1000) { h.end?.(); return false; }
      h.tick(); return true;
    });
    if (this.score && s.ctx.currentTime > this.score.until) this.stopScore();
    if (this.file) this.onState({ kind: 'file', id: this.file.id, at: this.file.el.currentTime, len: this.file.el.duration || 0 });
    else if (this.score) this.onState({ kind: 'score', id: this.score.id, at: s.ctx.currentTime - this.score.from, len: this.score.until - this.score.from });
    this.frameId = requestAnimationFrame(this._frame);
  }

  hold(secs, tick, end) { this.holds.push({ secs, tick, end, from: performance.now() }); tick(); }

  /** Play an effect's (or a tune's) variant now. */
  play(fn) { const s = this.sound(); return fn(s, this.e); }

  /** A review page can terminate effects too, including delayed callbacks and decoding. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.holds = [];
    this.stopAll();
    this.s?.dispose();
    // Sound's gameplay disposal fades for 700 ms. A page's Stop/away action is immediate:
    // sever this private context's output while its normal disposal finishes.
    this.s?.master?.disconnect();
  }

  // ---------------------------------------------------------------- files
  /** Play a recording from `url`; `done` runs when it stops (a Blob URL's revoke: src/music-store.js themeToListen). */
  async playFile(id, url, done = () => {}) {
    this.stopAll();
    const s = this.sound();
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.src = url;
    el.preload = 'auto';
    const src = s.ctx.createMediaElementSource(el);
    src.connect(this.media);
    this.file = { id, el, src, done };
    el.addEventListener('ended', () => { if (this.file?.el === el) this.stopFile(); });
    try { await el.play(); } catch (err) { if (this.file?.el === el) this.stopFile(); throw err; }
  }
  seek(frac) { const f = this.file; if (f && f.el.duration) f.el.currentTime = frac * f.el.duration; }
  stopFile() {
    const f = this.file;
    if (!f) return;
    this.file = null;
    f.el.pause(); f.el.removeAttribute('src'); f.el.load();
    try { f.src.disconnect(); } catch { /* gone */ }
    f.done?.();
    this.onState({ kind: 'stopped', id: f.id });
  }

  // ---------------------------------------------------------------- the procedural score
  /** The world's score from section 6 × `seed` (an arc: each draws its own order of sections), `secs` long, under `act`. */
  playScore(id, scoreId, { seed = 0, secs = 90, act = 'walking', ambience = false, light = false } = {}) {
    this.stopAll();
    const s = this.sound();
    const ctx = s.ctx, bus = ctx.createGain();
    bus.gain.value = 0.62 * s.musicVol;
    bus.connect(s.world); bus.connect(s.musicSend);
    s.music = bus;
    s._echo = null;   // (the score's echo onto this bus)
    s.setScore(scoreId); s.scoreOff = false;
    s.scoreMoment = !light;   // (a score with moments of its own: in full, or only its light layers)
    s.S = scoreFor(scoreId);
    s.beat = Math.max(0, Math.floor(seed)) * 6 * sectionBeats(s.S);
    s.nextBeat = ctx.currentTime + 0.1;
    s.act = { move: 0, ride: 0, still: 0, indoor: 0, night: 0, storm: 0, ...(ACTS[act] ?? ACTS.walking) };
    s.voice.ambience = ambience ? (AMBIENCE[scoreId] ?? 'wind') : 'none';
    s.schedule();
    const timer = setInterval(() => s.schedule(), 100);
    this.score = { id, bus, timer, from: ctx.currentTime, until: ctx.currentTime + secs };
  }
  stopScore() {
    const sc = this.score, s = this.s;
    if (!sc) return;
    this.score = null;
    clearInterval(sc.timer);
    s.scoreOff = true; s.voice.ambience = 'none';
    const t = s.ctx.currentTime;
    sc.bus.gain.cancelScheduledValues(t); sc.bus.gain.setTargetAtTime(0, t, 0.08);
    setTimeout(() => { try { sc.bus.disconnect(); } catch { /* gone */ } }, 1500);
    // a fresh bus for what comes next (the musicians, the tunes, a swell)
    const bus = s.ctx.createGain(); bus.gain.value = 0.62 * s.musicVol; bus.connect(s.world); bus.connect(s.musicSend);
    s.music = bus; s._echo = null;
    this.onState({ kind: 'stopped', id: sc.id });
  }

  // ---------------------------------------------------------------- loops (the menu, the fight, the musicians)
  startLoop(id, tune) {
    const s = this.sound();
    if (tune.kind === 'band') {
      this.stopScore();
      const b = tune.band;
      s.setScore(b.world); s.scoreOff = true;
      s.bandDefs = [{ id: b.id, pos: { x: 0, y: 1.6, z: -3 }, radius: 40, parts: [...b.parts], mode: tune.mode ?? b.modes[0], vol: 1, duck: 0 }];
      s.bands = null; s.makeBands();
      s.beat = 0; s.nextBeat = s.ctx.currentTime + 0.1;
      s.listen(EAR, 0);
      const timer = setInterval(() => s.schedule(), 100);
      s.schedule();
      this.loops.set(id, { stop: () => { clearInterval(timer); for (const x of s.bands ?? []) x.gain.gain.setTargetAtTime(0, s.ctx.currentTime, 0.1); s.bands = []; s.bandDefs = []; } });
    } else {
      tune.start(s, this.e);
      this.loops.set(id, { stop: () => tune.stop(s, this.e) });
    }
  }
  stopLoop(id) { const l = this.loops.get(id); if (l) { this.loops.delete(id); l.stop(); this.onState({ kind: 'stopped', id }); } }
  playing(id) { return this.loops.has(id) || this.file?.id === id || this.score?.id === id; }

  /** Stop the songs (a file, a score, the loops); the effects already sounding ring out. */
  stopAll() {
    this.stopFile(); this.stopScore();
    for (const id of [...this.loops.keys()]) this.stopLoop(id);
  }
}
