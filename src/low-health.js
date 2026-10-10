// The low-health cue (v1.41, the author: "a visual and audio low-health cue at one heart or less, tasteful and not
// nagging"; docs/systems/items.md "Hearts, magic and potions"). At one heart or less (and not all your hearts: a
// one-heart start is no warning), a soft heartbeat (src/audio.js heartbeat: a low double thump) and the screen's edges
// darkening with it in the ink's warm red, pulsing in time:
// - only for a short spell (`beats` beats at `bpm`), when you fall to it and again when a blow lands while you are there;
//   then the beat stops and the edges settle to a faint tint (`rest`) for as long as you stay low: it never nags;
// - the last heart in the HUD pulses as before (src/hud.js heartsSvg `low`);
// - eased out over `fade` s when you heal past it, die, or a menu or a scene is up.
//
//   const cue = new LowHealthCue({ sound })   cue.update(dt, { hearts, max, dead, paused })   → { k, beat }

export const LOW_HEALTH = { at: 1, bpm: 66, beats: 6, edge: 0.75, rest: 0.18, fade: 0.8, color: '122, 26, 14' };

/**
 * The cue's state a frame (pure: tests). S: { low, spell (s left of the beating spell), t (s into it), k (the edges'
 * strength shown), hearts (last seen) }. Returns { k, beat } (beat: a heartbeat starts this frame).
 */
export function lowHealthStep(S, dt, { hearts = 3, max = 3, dead = false, paused = false } = {}, L = LOW_HEALTH) {
  const low = !dead && !paused && hearts <= L.at + 1e-9 && hearts < max - 1e-9;
  const period = 60 / L.bpm;
  let beat = false;
  if (low && (!S.low || hearts < (S.hearts ?? hearts) - 1e-9)) { S.spell = L.beats * period; S.t = 0; beat = true; }   // (fell to it, or hit again there)
  else if (low && S.spell > 0) {
    const was = Math.floor(S.t / period);
    S.t += dt; S.spell -= dt;
    if (S.spell > 0 && Math.floor(S.t / period) > was) beat = true;
  }
  if (!low) S.spell = 0;
  S.low = low; S.hearts = hearts;
  // the edges: pulsing with the beat through the spell, then a faint rest; nothing when not low
  const ph = (S.t ?? 0) % period / period, pulse = Math.exp(-ph * 7) + 0.6 * Math.exp(-Math.max(0, ph - 0.24) * 9) * (ph > 0.24 ? 1 : 0);
  const want = !low ? 0 : S.spell > 0 ? L.rest + (L.edge - L.rest) * Math.min(1, pulse) : L.rest;
  const rate = want > (S.k ?? 0) ? 32 : 1 / Math.max(0.05, L.fade) * 2.5;
  S.k = (S.k ?? 0) + (want - (S.k ?? 0)) * (1 - Math.exp(-rate * dt));
  if (S.k < 0.002) S.k = 0;
  return { k: S.k, beat };
}

export class LowHealthCue {
  constructor({ sound = null, parent = typeof document !== 'undefined' ? document.body : null } = {}) {
    this.sound = sound; this.S = { low: false, spell: 0, t: 0, k: 0 };
    if (parent && typeof document !== 'undefined' && document.createElement) {
      this.el = document.createElement('div');
      this.el.id = 'low-health';
      this.el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:22;opacity:0;transition:none;'
        + `background:radial-gradient(ellipse at center, rgba(${LOW_HEALTH.color},0) 46%, rgba(${LOW_HEALTH.color},0.6) 84%, rgba(${LOW_HEALTH.color},0.9) 100%)`;
      parent.appendChild?.(this.el);
    }
  }
  update(dt, state) {
    const r = lowHealthStep(this.S, dt, state);
    if (r.beat) this.sound?.heartbeat?.();
    if (this.el) { const o = r.k.toFixed(3); if (o !== this._o) { this._o = o; this.el.style.opacity = o; } }
    return r;
  }
  dispose() { this.el?.remove?.(); }
}
