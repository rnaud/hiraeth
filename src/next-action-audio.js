import { SFX } from './sfx.js';
// Finite selected action cues. Suppressed events never queue for a later decode.
export class NextActionAudio {
  constructor(sound) { this.sound = sound; this.cues = new Map(); this.once = new Set(); }
  cue(group, { gap = .15, pos = null, ui = false, onceKey = null } = {}) {
    const s = this.sound, now = s.ctx?.currentTime ?? 0;
    if (!s.ctx || s._disposed || s.muted || s.guard?.away() || (s._actionPaused && !ui)) return true;
    if (onceKey && this.once.has(onceKey)) return true;
    if (onceKey) this.once.add(onceKey);
    const old = this.cues.get(group);
    if (old && now - old.at < gap) return true;
    old?.handle?.stop(0);
    // Reserve the event even if unavailable: no queued late cue or substitute synthesis.
    this.cues.set(group, { at: now, handle: null, ui });
    const dest = ui ? s.uiOut() : pos ? s.spot?.(pos, { until: 4 }) ?? s.fx : s.fx;
    const handle = s.bank?.start(group, { dest });
    if (!handle) return Object.hasOwn(SFX, group);
    this.cues.set(group, { at: now, handle, ui });
    return true;
  }
  level(ratio, enabled = true) {
    if (!enabled || !Number.isFinite(ratio)) { this.levelReady = false; return; }
    if (!this.levelReady) { this.levelReady = true; this.lowArmed = ratio > .5; this.previous = ratio; return; }
    if (ratio >= .5) this.lowArmed = true;
    if (this.lowArmed && this.previous > .25 && ratio <= .25) { this.lowArmed = false; this.cue('low-fluid', { gap: 3 }); }
    this.previous = ratio;
  }
  stop(worldOnly = false) { for (const c of this.cues.values()) if (!worldOnly || !c.ui) c.handle?.stop(0); }
  dispose() { this.stop(); this.cues.clear(); }
}
export function nextActionAudio(sound) { return sound._nextActionAudio ??= new NextActionAudio(sound); }
