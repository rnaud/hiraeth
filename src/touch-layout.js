// Where the touch buttons sit and how big they are (ui.js TouchControls places them; docs/systems/ui.md
// "Touch controls"). The cluster is drawn for a screen at least 560 px on its short side (a tablet, the
// Deck); a phone scales it down with that short side, so held sideways (812 x 375) the buttons keep to
// the lower right corner instead of reaching the top edge and covering half the view. A button never
// shrinks below a comfortable thumb (MIN_BUTTON): a small one keeps its centre and grows round it.
// DOM-free, tested (tests/touch-layout.test.js).

/** The short side the cluster is drawn for, and the smallest scale (a 358 px short side and below). */
export const TOUCH_REFERENCE = 560;
export const TOUCH_MIN_SCALE = 0.64;
/** No button is drawn smaller than this across (CSS px), whatever the scale. */
export const MIN_BUTTON = 38;
/** Nor its label smaller than this (CSS px): "run", "ping" stay readable. */
export const MIN_FONT = 11;

/**
 * Each button at scale 1: r, b its right and bottom edge from the screen's corner (inside the safe
 * area), d its diameter, f its font size (CSS px).
 */
export const TOUCH_BUTTONS = {
  jump:  { r: 24,  b: 90,  d: 78, f: 26 },
  use:   { r: 112, b: 40,  d: 64, f: 18 },
  run:   { r: 24,  b: 186, d: 64, f: 13 },
  book:  { r: 112, b: 120, d: 64, f: 18 },
  ping:  { r: 112, b: 200, d: 64, f: 13 },
  aim:   { r: 200, b: 150, d: 64, f: 24 },
  fire:  { r: 200, b: 60,  d: 74, f: 26 },
  mode:  { r: 282, b: 96,  d: 50, f: 22 },
  blade: { r: 282, b: 166, d: 54, f: 22 },
  guard: { r: 206, b: 228, d: 54, f: 22 },
  evade: { r: 206, b: 296, d: 54, f: 22 },
  lock:  { r: 284, b: 244, d: 40, f: 18 },
  gadget: { r: 117, b: 274, d: 54, f: 22 },   // (added by src/gadgets/hud.js once a gadget is in hand)
};

/** The movement stick (it appears under the left thumb): its ring's and its nub's diameters, and how far the nub travels. */
export const TOUCH_STICK = { ring: 140, nub: 50, reach: 60 };

/** The cluster's scale for a viewport of w x h CSS px: its short side over TOUCH_REFERENCE, 0.64..1. */
export function touchScale(w, h) {
  const short = Math.min(w, h);
  if (!(short > 0)) return 1;
  return Math.min(1, Math.max(TOUCH_MIN_SCALE, short / TOUCH_REFERENCE));
}

/**
 * Every button's place at scale k: { name: { r, b, d, f } } in CSS px (r, b still to be offset by the
 * safe area). Positions and sizes scale together round each button's centre; a diameter under
 * MIN_BUTTON is raised to it (or to its own size at scale 1, if that is smaller), keeping the centre.
 */
export function touchLayout(k, buttons = TOUCH_BUTTONS) {
  const out = {};
  for (const [name, { r, b, d, f }] of Object.entries(buttons)) {
    const cx = (r + d / 2) * k, cy = (b + d / 2) * k;
    const size = Math.max(d * k, Math.min(d, MIN_BUTTON));
    const font = Math.max(f * size / d, Math.min(f, MIN_FONT));
    out[name] = { r: round(cx - size / 2), b: round(cy - size / 2), d: round(size), f: round(font) };
  }
  return out;
}

/** The stick at scale k: ring and nub diameters, and the nub's reach (its travel is the full stick). */
export function stickLayout(k) {
  return { ring: round(TOUCH_STICK.ring * k), nub: round(TOUCH_STICK.nub * k), reach: round(TOUCH_STICK.reach * k) };
}

const round = (x) => Math.round(x * 10) / 10;
