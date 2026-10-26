// Recorded battle/prologue cues, using only the shared Web Audio surface (web and Unity).
export const SCENE_FADE = { battleIn: 0.2, battleOut: 2.5, battleRelease: 1.2, prologueIn: 1, prologueOut: 1 };

export class SceneMusic {
  constructor(sound) { this.sound = sound; this.buffers = {}; this.voices = {}; this.battle = false; this.prologue = false; this.releaseAt = null; }
  install(id, buffer) { if (this.disposed) return; this.buffers[id] = buffer; this.update(); }
  fight(on) {
    const t = this.sound.ctx?.currentTime ?? 0;
    if (on) { this.battle = true; this.releaseAt = null; }
    else if (!this.sound.ctx) { this.battle = false; this.releaseAt = null; }
    else if (this.battle && this.releaseAt === null) this.releaseAt = t + SCENE_FADE.battleRelease;
    this.update();
  }
  ship(on) { this.prologue = !!on; this.update(); }
  get battleActive() { return this.battle && !!this.buffers.battle && !this.prologue; }
  get suppressScore() { return this.battleActive || (this.prologue && !!this.buffers.prologue); }
  update() {
    const { ctx, music } = this.sound;
    if (this.disposed || !ctx || !music) return;
    const t = ctx.currentTime;
    if (this.releaseAt !== null && t >= this.releaseAt) { this.battle = false; this.releaseAt = null; }
    for (const id of ['battle', 'prologue']) {
      const on = id === 'battle' ? this.battleActive : this.prologue && !!this.buffers.prologue;
      let v = this.voices[id];
      if (on && !v) {
        const gain = ctx.createGain(), source = ctx.createBufferSource();
        gain.gain.value = 0; source.buffer = this.buffers[id]; source.loop = true;
        source.connect(gain).connect(music); source.start(t);
        v = this.voices[id] = { source, gain, on: false, from: 0, to: 0, start: t, end: t };
      }
      if (!v) continue;
      if (on !== v.on) {
        // Track the envelope ourselves: native AudioParam.value can already be the scheduled endpoint.
        const value = v.end <= v.start ? v.to : v.from + (v.to - v.from) * Math.max(0, Math.min(1, (t - v.start) / (v.end - v.start)));
        v.on = on; v.from = value; v.to = on ? 1 : 0; v.start = t;
        v.end = t + SCENE_FADE[`${id}${on ? 'In' : 'Out'}`];
        v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(value, t);
        v.gain.gain.linearRampToValueAtTime(v.to, v.end);
      }
      if (!v.on && t >= v.end) { v.source.stop(); v.source.disconnect(); v.gain.disconnect(); delete this.voices[id]; }
    }
  }
  dispose() {
    this.disposed = true;
    for (const v of Object.values(this.voices)) { v.source.stop(); v.source.disconnect(); v.gain.disconnect(); }
    this.voices = {}; this.buffers = {};
  }
}
