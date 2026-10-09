// The people's portraits for the game menu's People page (src/game-menu.js peoplePanel): each conversation's
// own portrait of the person (src/story/index.js portrait(): them alone against their world's flat colour),
// shrunk to a small square and kept, so a card shows them as they look in the game even worlds later. Kept
// in the browser's storage, apart from the save slots (a portrait is not progress): the latest conversation's
// replaces the one before, so a new costume shows. Someone met before this existed gets theirs the next time
// you talk, or when the page opens in their world (main.js asks the story for one then).
//
//   const cache = new PortraitCache()      (storage: localStorage)
//   cache.get(id)                          → { src, background } | null
//   cache.put(id, shot)                    shot: a data URL or { src, background } (shrunk first, on a page)
//   cache.onChange = (id, entry) => …      told when one is kept

const KEY = 'moebius.portraits.v1';
/** The kept square's side in pixels (a card shows it at up to about 90 CSS px; the page at 120). */
export const PORTRAIT_PX = 128;
/** At most this many kept (the oldest go first). */
export const MAX_PORTRAITS = 120;

export class PortraitCache {
  constructor(storage = globalThis.localStorage ?? null, { shrink = shrinkShot } = {}) {
    this.storage = storage;
    this.shrink = shrink;
    this.onChange = null;
    try { this.map = JSON.parse(storage?.getItem(KEY) ?? '{}') ?? {}; } catch { this.map = {}; }
  }

  get(id) { const e = this.map[id]; return e?.src ? { src: e.src, background: e.background ?? null } : null; }
  has(id) { return !!this.map[id]?.src; }

  /** Keep `shot` as `id`'s portrait (shrunk; async on a page). Resolves to the entry kept, or null. */
  async put(id, shot) {
    const src = typeof shot === 'string' ? shot : shot?.src;
    if (!id || !src) return null;
    let small = null;
    try { small = await this.shrink(src, shot?.background ?? null); } catch { small = null; }
    if (!small) return null;
    const entry = { src: small, background: shot?.background ?? null, at: Date.now() };
    this.map[id] = entry;
    this.save();
    this.onChange?.(id, this.get(id));
    return entry;
  }

  save() {
    const ids = Object.keys(this.map).sort((a, b) => (this.map[b].at ?? 0) - (this.map[a].at ?? 0));
    for (const id of ids.slice(MAX_PORTRAITS)) delete this.map[id];
    // (storage full: drop the oldest until it fits; the save slots matter more)
    for (let tries = 0; tries < 8; tries++) {
      try { this.storage?.setItem(KEY, JSON.stringify(this.map)); return; } catch {
        const left = Object.keys(this.map).sort((a, b) => (this.map[a].at ?? 0) - (this.map[b].at ?? 0));
        if (!left.length) return;
        for (const id of left.slice(0, Math.max(1, Math.ceil(left.length / 4)))) delete this.map[id];
      }
    }
  }
}

/** Shrink a portrait to PORTRAIT_PX square, on its background colour (a page only: null elsewhere). */
export function shrinkShot(src, background = null) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = PORTRAIT_PX;
      const g = c.getContext('2d');
      if (!g) { resolve(null); return; }
      if (background) { g.fillStyle = background; g.fillRect(0, 0, PORTRAIT_PX, PORTRAIT_PX); }
      // (the middle square of it: the portraits are square already, this keeps a wide one centred)
      const s = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, PORTRAIT_PX, PORTRAIT_PX);
      let out = c.toDataURL('image/webp', 0.82);
      if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.84);
      resolve(out);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
