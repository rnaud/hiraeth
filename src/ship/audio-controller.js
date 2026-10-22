// Owns continuous ship sound on one Sound instance. Physical movement is the clock:
// pausing, skipping or reversing never leaves a motor or a second engine running.
export class ShipAudio {
  constructor(sound) {
    this.sound = sound;
    this.loops = new Map();
    this.paused = false;
    this.dead = false;
    this.deck = null;
    this.visibility = () => this.pause();
    globalThis.document?.addEventListener?.('visibilitychange', this.visibility);
  }
  get silent() { return this.dead || this.paused || this.sound.muted || this.sound.guard?.away?.() || globalThis.document?.hidden || !this.sound.ctx || !this.sound.fx; }
  loop(key, group, level, rate, fallback) {
    if (this.dead) return;
    const row = this.loops.get(key) ?? { handle: null };
    Object.assign(row, { group, level: Math.max(0, level), rate, fallback });
    this.loops.set(key, row);
    this.refreshLoop(row);
  }
  refreshLoop(row) {
    const level = this.silent ? 0 : row.level;
    if (!level) {
      row.handle?.stop(0.05); row.handle = null;
      this.fallback(row, 0);
      return;
    }
    if (!row.handle && row.group) {
      row.handle = this.sound.bank?.start?.(row.group, { dest: this.sound.fx, vol: level, rate: row.rate, loop: true }) ?? null;
      row.sentLevel = level; row.sentRate = row.rate;
    } else if (row.handle && (row.sentLevel !== level || row.sentRate !== row.rate)) {
      row.handle.set({ vol: level, rate: row.rate });
      row.sentLevel = level; row.sentRate = row.rate;
    }
    this.fallback(row, row.group ? 0 : level);
  }
  fallback(row, level) {
    if (row.fallbackLevel === level) return;
    row.fallback?.(level); row.fallbackLevel = level;
  }
  pause(on = this.paused) {
    if (this.dead) return;
    this.paused = !!on;
    for (const row of this.loops.values()) this.refreshLoop(row);
    this.refreshDeck();
  }
  // k is the real 0..1 deployment pose. Only incremental movement starts a cue;
  // initial placement and skip-to-endpoint are silent, and stop the previous cue.
  moveDeck(model, before, k, fallback, clunk) {
    if (this.dead) return;
    if (!Number.isFinite(before) || k <= 0 || k >= 1 || Math.abs(k - before) > 0.25) {
      const d = this.deck;
      d?.handle?.stop(0.03); d?.fallback?.(0);
      if (d?.usedFallback && !this.silent && Number.isFinite(before) && Math.abs(k - before) <= 0.25 && (k === 0 || k === 1)) clunk?.();
      this.deck = null;
      return;
    }
    if (k === before) return;
    const direction = Math.sign(k - before);
    if (!this.deck || this.deck.model !== model || this.deck.direction !== direction) {
      this.deck?.handle?.stop(0.03); this.deck?.fallback?.(0);
      this.deck = { model, direction, handle: null, fallback };
    }
    this.deck.progress = direction > 0 ? k : 1 - k;
    this.refreshDeck();
  }
  refreshDeck() {
    const d = this.deck;
    if (!d) return;
    if (this.silent) { d.handle?.stop(0.03); d.handle = null; d.fallback?.(0); return; }
    if (d.handle) {
      // Audio keeps real time during a foreground stall; the animation caps dt.
      // Resynchronise only meaningful drift, not ordinary frame-sized updates.
      const elapsed = this.sound.ctx.currentTime - d.startedAt;
      const expected = d.offset / d.rate + elapsed;
      const physical = d.progress * 4.2;
      if (Math.abs(expected - physical) <= 0.18) return;
      d.handle.stop(0.03); d.handle = null;
    }
    const group = d.direction > 0 ? 'deck-open' : 'deck-close';
    const bank = this.sound.bank, duration = bank?.duration?.(group) ?? 0;
    if (!duration) { d.fallback?.(0); return; }
    d.fallback?.(0);
    d.rate = duration / 4.2; d.offset = d.progress * duration;
    d.startedAt = this.sound.ctx.currentTime;
    d.handle = bank.start(group, { dest: this.sound.fx, vol: 1, rate: d.rate, offset: d.offset });
  }
  stopDeck() {
    this.deck?.handle?.stop(0.03); this.deck?.fallback?.(0); this.deck = null;
  }
  dispose() {
    if (this.dead) return;
    this.paused = true;
    this.pause(true);
    this.dead = true;
    globalThis.document?.removeEventListener?.('visibilitychange', this.visibility);
    this.loops.clear(); this.deck = null;
  }
}
export const shipAudio = (sound) => sound && typeof sound._shipAudio !== 'function' ? (sound._shipAudio ??= new ShipAudio(sound)) : null;
