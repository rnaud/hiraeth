// The makers' mark as data for an engine to fill (the shared mark's own contours, src/makers-mark/design.js: never
// redrawn): sent with the screen's parts that show it (the end card, a conversation's or a balloon's {glyph}).
import { markContours } from './design.js';

let shape = null;
/** The mark's contours, centred, unit size, y up, to a thousandth (made once). */
export const markShape = () => (shape ??= markContours(1).map((ps) => ps.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])));
/** Does a line (or any of several) show the mark: its {glyph} motif (src/story/dialogue.js MOTIFS)? */
export const showsMark = (...texts) => texts.some((s) => String(s ?? '').includes('{glyph}'));
