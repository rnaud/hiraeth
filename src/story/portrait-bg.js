// The portrait in a conversation's corner (src/story/index.js portrait(),
// src/story/dialogue.js): the person alone against one flat printed colour,
// like a comic's character card, instead of the busy world behind them.
//
//   isolate(keep, scene)       hide everything but `keep` (and the path down to it); returns what it hid
//   restore(hidden)            show it again
//   backdropFor(person, world) the flat colour: one of the world's pastel tones, the one farthest from
//                              what they wear (their cloak, their cloth, their colour), so they stand out
//
// The colour reaches the composite as uBackdrop (src/post.js): sky pixels take it instead of the sky.

/** Pastel print tones per world (the first is the world's own; the others give contrast). */
export const BACKDROPS = {
  default: ['#f2d79b', '#a9d6dc', '#eab1a0', '#cfc6ea', '#cfe3c4'],
  desert: ['#f0cf8e', '#9fd0d6', '#e7a98f', '#c9c2e6', '#bfdcc0'],
  edena: ['#cfe8cf', '#f6d3dc', '#d3e2f5', '#f3e2a8', '#e4d6f3'],
  incal: ['#d7cdf0', '#f2c9a8', '#bfe0de', '#efe0b0', '#f2c4cf'],
  bazaar: ['#f2c9a0', '#a9d6dc', '#d9cdf0', '#e6e0a0', '#f0b8b0'],
  garage: ['#d9d2c0', '#a9cfe0', '#f0c8a0', '#cfe3c4', '#e6c6e0'],
  buried: ['#e6d3b0', '#b8d4dc', '#e8b8a8', '#cfc6ea', '#d0e0b8'],
  spheres: ['#d6e6f5', '#f5d6c8', '#d8f0dc', '#efe2b0', '#e0d0f0'],
  arzach: ['#f0d8a8', '#a8d0e0', '#e8b0a0', '#d0c8e8', '#c8e0c0'],
  arzach2: ['#f0d8a8', '#a8d0e0', '#e8b0a0', '#d0c8e8', '#c8e0c0'],
  perdide: ['#cde0e8', '#f0d0b0', '#d8cff0', '#e8e4b0', '#c8e4cc'],
  perdide2: ['#cde0e8', '#f0d0b0', '#d8cff0', '#e8e4b0', '#c8e4cc'],
  mangrove: ['#d8cff0', '#f0d0dc', '#c8d8f0', '#efe2c0', '#d0e8e4'],
  waterfall: ['#b5ece4', '#f1dcbd', '#9fd6d0', '#efd6b8', '#c8e8e0'],
};

const rgb = (hex) => {
  const h = String(hex).replace('#', '');
  const v = h.length === 3 ? [...h].map((c) => parseInt(c + c, 16)) : [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return v.some(Number.isNaN) ? null : v;
};
// a quick perceptual distance (redmean)
const dist = (a, b) => {
  const r = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
};

// closer than this (redmean, 0..765) to something they wear and the world's tone gives way to a farther one
export const NEAR = 140;

/** The flat colour behind `person` in their portrait, in `world`. */
export function backdropFor(person, world) {
  if (person?.backdrop) return person.backdrop;
  const tones = BACKDROPS[world] ?? BACKDROPS.default;
  // the cloak (and their colour, mostly the same) fill the portrait; the cloth under it counts for less
  const worn = [[person?.palette?.cloak, 1], [person?.color, 1], [person?.palette?.cloth, 1.6]]
    .map(([c, k]) => [c && rgb(c), k]).filter(([c]) => c);
  if (!worn.length) return tones[0];
  const away = (t) => Math.min(...worn.map(([w, k]) => dist(rgb(t), w) * k));
  // the first tone is the world's own: it stays unless it is close to what they wear
  if (away(tones[0]) >= NEAR) return tones[0];
  let best = tones[0], bd = -1;
  for (const t of tones) { const d = away(t); if (d > bd) { bd = d; best = t; } }
  return best;
}

/** Hide everything under `root` except the `keep` objects (and the groups that hold them). */
export function isolate(keep, root) {
  const kept = new Set(keep.filter(Boolean)), chain = new Set();
  for (const k of kept) for (let o = k; o; o = o.parent) chain.add(o);
  const hidden = [];
  const visit = (o) => {
    for (const c of o.children) {
      if (kept.has(c)) continue;
      if (chain.has(c)) visit(c);
      else if (c.visible && !c.isLight) { c.visible = false; hidden.push(c); }
    }
  };
  visit(root);
  return hidden;
}

export function restore(hidden) { for (const o of hidden) o.visible = true; }

// ------------------------------------------------------------------ the sharp portrait
// The circle shows the portrait at PORTRAIT_CSS px (index.html .dlg-chip: 84, 108 on wide screens, 60 on
// small ones). It used to be the whole frame's middle shrunk in one step to 160 px: ink lines a pixel or
// two wide in the frame came out as broken, jagged dots, and JPEG rang round them. Now the frame is
// drawn as if it were the circle's size (portraitPixelRatio: lines, hatching and grain measured in its
// pixels) at the frame's full resolution, then shrunk by halves (main.js captureView): supersampled.

/** How many pixels the image needs to stay sharp in a circle `css` CSS px across, at a device pixel ratio. */
export function portraitSize(css = 84, dpr = 1) {
  return Math.round(Math.min(320, Math.max(96, css * Math.min(Math.max(dpr, 1), 2.5) * 1.25)));
}

/** The portrait's ink against the world's: half its weight (full-weight lines crowd a face this small). */
export const PORTRAIT_INK = 0.5;

/**
 * The pixel ratio to draw the portrait's frame with: the frame's `rows` (render pixels, the crop's
 * height) over the circle's `css` px, times `ink`, so a line `w` CSS px wide is w × ink CSS px in the
 * circle. Never below the game's own (`current`).
 */
export function portraitPixelRatio(rows, css, current = 1, ink = PORTRAIT_INK) {
  return Math.max(current, (rows / Math.max(css, 1)) * ink);
}
