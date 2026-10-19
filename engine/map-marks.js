// The Map's marks as pictures, for an engine that draws the game menu itself (the Unity bridge: BridgeMenu.cs, issue
// #343): the web's own (src/game-menu.js MARK_SYM, their colours and rings from src/game-menu.css .mk, .gm-cursor,
// .gm-north) as small SVGs, which scripts/engine-bundle.mjs turns into PNGs once (StreamingAssets/hiraeth-js/map-marks).
// A mark's picture is `MARK_BOX` units square round its middle; `size` is how large it is drawn on the sheet, of the
// web's mark (src/game-menu.css: 3.4vh, the traveller's 4.4vh), its ring included.
//
// Pure: strings only (tests/engine-menus.test.js).

const INK = '#2b211f', PAPER = '#fbf4e2', GOLD = '#f2c54b', RED = '#c8483a', TEAL = '#277e86', GREEN = '#2f7a55', PLUM = '#8a4f7d';
/** The pictures' box: −MARK_BOX/2 .. MARK_BOX/2 each way. */
export const MARK_BOX = 32;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-MARK_BOX / 2} ${-MARK_BOX / 2} ${MARK_BOX} ${MARK_BOX}" width="128" height="128">${body}</svg>`;
// (the web's glyph marks, ✦ ● ▣ ◇ ◉, drawn as shapes: a font's glyphs differ from one machine to the next)
const star = (r, fill) => `<path d="M0 ${-r} L${r * 0.26} ${-r * 0.26} L${r} 0 L${r * 0.26} ${r * 0.26} L0 ${r} L${-r * 0.26} ${r * 0.26} L${-r} 0 L${-r * 0.26} ${-r * 0.26} Z" fill="${fill}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
const ring = (r, colour, width, dash = '') => `<circle r="${r}" fill="none" stroke="${colour}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

/**
 * Each mark's picture and its size on the sheet (× the web's mark, 3.4 % of the screen's height): the traveller's arrow
 * (turned the way he faces, drawn pointing up), the ship, a temple, the way on with its dashed red ring, a quest, a person
 * met, a box opened, someone with a quest for you in their gold ring, a rumour and its circle; the ring round the mark under the cursor, the
 * cursor itself (gold when on a mark) and the north arrow.
 */
export const MAP_MARKS = {
  you: { size: 1.3, svg: svg(`<g transform="scale(1.45)"><path d="M0 -9 L7 7 L0 3.5 L-7 7 Z" transform="translate(1.2 1.2)" fill="${INK}"/><path d="M0 -9 L7 7 L0 3.5 L-7 7 Z" fill="${RED}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></g>`) },
  ship: { size: 1, svg: svg(`<g transform="scale(1.25)" fill="#d8cdb6" stroke="${INK}" stroke-width="2" stroke-linejoin="round"><path d="M-11 1 C-6 -6 6 -6 11 1 C6 6 -6 6 -11 1 Z"/><path d="M-4 -4 L0 -7 L4 -4" fill="none"/></g>`) },
  temple: { size: 1, svg: svg(`<g transform="scale(1.45)" fill="#c9b48a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"><path d="M-8 8 V-1 L0 -8 L8 -1 V8 Z"/><path d="M-3 8 V2 H3 V8" fill="none"/></g>`) },
  // (the way on: a gold star in its dashed red ring, the ring 1.6 × the mark)
  goal: { size: 1.6, svg: svg(`${ring(14.5, RED, 1.6, '3.2 2.4')}${star(9, GOLD)}`) },
  quest: { size: 1, svg: svg(`<path d="M0 -11 L9 0 L0 11 L-9 0 Z" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linejoin="round"/><path d="M0 -11 L9 0 L0 11 L-9 0 Z" fill="none" stroke="${GOLD}" stroke-width="2.4" stroke-linejoin="round"/>`) },
  person: { size: 1, svg: svg(`<circle r="6" fill="${TEAL}" stroke="${INK}" stroke-width="1"/>`) },
  box: { size: 1, svg: svg(`<rect x="-8" y="-8" width="16" height="16" fill="none" stroke="${GREEN}" stroke-width="2.6"/><rect x="-8" y="-8" width="16" height="16" fill="none" stroke="${INK}" stroke-width="0.8"/><rect x="-4" y="-4" width="8" height="8" fill="${GREEN}" stroke="${INK}" stroke-width="0.8"/>`) },
  // (someone with a word for you, not met: the page's ◉ in gold, a thin inked ring round a large gold dot, in its gold ring
  // at 0.85, 1.5 × the mark; as the page draws them at 1280 × 720, issue #264: the dot was small in a thick ring)
  giver: { size: 1.5, svg: svg(`${ring(12, 'rgba(242,197,75,0.85)', 1.8)}<circle r="6" fill="none" stroke="${INK}" stroke-width="1.5"/><circle r="6" fill="none" stroke="${GOLD}" stroke-width="0.5"/><circle r="3.9" fill="${GOLD}" stroke="${INK}" stroke-width="0.7"/>`) },
  // (a rumour, issue #340: a small plum ? at its circle's middle; its circle is `area`, drawn as large as the rumour's
  // circle on the sheet, a soft plum fill and a dashed rim, as src/game-menu.css .gm-area)
  rumour: { size: 1, svg: svg(`<text y="6.5" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="19" fill="${PLUM}" stroke="${INK}" stroke-width="0.8">?</text>`) },
  area: { size: 1, svg: svg(`<defs><radialGradient id="g"><stop offset="0" stop-color="${PLUM}" stop-opacity="0.26"/><stop offset="0.7" stop-color="${PLUM}" stop-opacity="0.12"/><stop offset="1" stop-color="${PLUM}" stop-opacity="0.04"/></radialGradient></defs><circle r="15.4" fill="url(#g)"/>${ring(15.4, 'rgba(138,79,125,0.75)', 0.5, '1.6 1.2')}`) },
  // (a fragment of the singing light still to find, Anselm's chart (issue #520): a small pale splinter, inked, as the shop's
  // FRAGMENT_SVG; 0.7 × the mark)
  fragment: { size: 0.7, svg: svg(`<path d="M0 -12 L5.5 -1.5 L0 12 L-5.5 -1.5 Z" fill="#dff7ff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M0 -12 V12 M-5.5 -1.5 H5.5" fill="none" stroke="#7fb8c9" stroke-width="1"/>`) },
  // (the mark under the cursor: a red ring 2.1 × the mark)
  sel: { size: 2.1, svg: svg(`${ring(14.6, RED, 2.2)}`) },
  // (the cursor: an ink ring on a paper halo, a dot in its middle; gold on its ink halo over a mark; 1.06 × the mark)
  cursor: { size: 1.06, svg: svg(`${ring(13, 'rgba(251,244,226,0.85)', 4.6)}${ring(13, INK, 2.6)}<circle r="2" fill="${INK}"/>`) },
  cursorOn: { size: 1.06, svg: svg(`${ring(13, INK, 4.6)}${ring(13, GOLD, 2.6)}<circle r="2" fill="${INK}"/>`) },
  // (north: the ink badge with its N in paper, the point above it)
  north: { size: 1.06, svg: svg(`<path d="M0 -15.5 L5 -8 L-5 -8 Z" fill="${INK}"/><ellipse cy="2" rx="10" ry="11" fill="${INK}"/><path d="M-4 7 V-3 L4 7 V-3" fill="none" stroke="${PAPER}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`) },
};
