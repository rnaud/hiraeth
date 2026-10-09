// The game's name as the title screen letters it (src/title.js): HIRAETH in monumental ivory
// block capitals with a fine ink outline and a muted vermilion shadow offset down and to the
// right, after the masthead of the waterfall-city cover (references/Title Screen/H1-waterfall-city.jpg).
// The letters are drawn here, not set in a font: each is a few contours on a cap height of 1000
// units (y down), measured off the cover, their corners rounded and their long edges bowed a
// hair by a seeded hand so they read as inked rather than typeset. One SVG, crisp at any size;
// a proper name, the same in every language (its aria-label says it).
//
//   logoSvg()                the <svg class="logo"> string (viewBox in glyph units)
//   LOGO_BOX                 its viewBox size { w, h } (the layout's aspect: src/title-layout.js)
//   GLYPHS                   the letters' contours (tests, the Steam art)
//
// Pure: no DOM, no three.js (scripts/steam-art.mjs renders it under node too).

/** The cover's colours: the ivory face, the ink, the vermilion shadow. */
export const LOGO_COLORS = { face: '#fbe8c4', ink: '#211a17', shadow: '#e27c5b' };
/** The shadow's offset (units of a 1000 cap height), down and to the right. */
export const SHADOW = [36, 32];
/** The ink line (units): about 1.2 % of the cap height, as on the cover. */
export const INK = 12;

// A contour: [x, y, r] corners (r: the corner's rounding, units). A glyph: its advance `w` and its
// contours (the first the outline, the rest its counters). Measured on the H1 cover: stems a third
// of the cap height, slits and counters narrow, the A's apex flat, the R's bowl round at the right.
const c = (...pts) => pts;
const R0 = 16;   // (the ordinary corner: just off square)
const H = (w, stem1, gap, top, bar) => ({
  w,
  contours: [c([0, 0, R0], [stem1, 0, R0], [stem1, top, 6], [stem1 + gap, top, 6], [stem1 + gap, 0, R0], [w, 0, R0], [w, 1000, R0], [stem1 + gap, 1000, R0],
    [stem1 + gap, top + bar, 6], [stem1, top + bar, 6], [stem1, 1000, R0], [0, 1000, R0])],
});
export const GLYPHS = {
  H1: H(800, 330, 140, 320, 280),
  I: { w: 336, contours: [c([0, 0, R0], [336, 0, R0], [336, 1000, R0], [0, 1000, R0])] },
  R: {
    w: 806,
    contours: [
      c([0, 0, R0], [778, 0, 300], [778, 440, 210], [648, 622, 4], [806, 1000, R0], [492, 1000, R0], [322, 694, 6], [322, 1000, R0], [0, 1000, R0]),
      c([322, 286, 8], [462, 286, 74], [462, 446, 74], [322, 446, 8]),   // the bowl's counter: flat on the left, round on the right
    ],
  },
  A: {
    w: 914,
    contours: [
      c([312, 0, R0], [596, 0, R0], [914, 1000, R0], [546, 1000, 10], [546, 922, 10], [368, 922, 10], [368, 1000, 10], [0, 1000, R0]),
      c([440, 500, 6], [484, 690, 6], [396, 690, 6]),   // the small triangular counter
    ],
  },
  E: {
    w: 670,
    contours: [c([0, 0, R0], [650, 0, R0], [650, 292, R0], [330, 292, 6], [330, 350, 6], [628, 350, R0], [628, 642, R0], [330, 642, 6], [330, 704, 6],
      [670, 704, R0], [670, 1000, R0], [0, 1000, R0])],
  },
  T: { w: 810, contours: [c([0, 0, R0], [810, 0, R0], [810, 294, R0], [572, 294, 6], [572, 1000, R0], [232, 1000, R0], [232, 294, 6], [0, 294, R0])] },
  H2: H(812, 330, 156, 330, 278),
};
// the word: each letter and the space before it (the R's leg meets the A's foot, as on the cover)
export const WORD = [['H1', 0], ['I', 72], ['R', 74], ['A', -8], ['E', 46], ['T', 44], ['H2', 64]];

/** A small seeded random (mulberry32), so the hand's wobble is the same on every screen. */
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A contour as an SVG path: each corner rounded (a cubic close to a circle's quarter), the long
 * edges bowed out or in by a unit or three (the hand), all moved by (ox, oy).
 */
export function contourPath(pts, ox = 0, oy = 0, rng = null) {
  const n = pts.length, f = (v) => +v.toFixed(1);
  // the hand: a corner off by a unit or two, never far enough to change a letter
  const P = pts.map(([x, y, r]) => [x + ox + (rng ? (rng() - 0.5) * 3 : 0), y + oy + (rng ? (rng() - 0.5) * 3 : 0), r]);
  const seg = [];
  for (let i = 0; i < n; i++) {
    const [x, y, r] = P[i], [px, py] = P[(i - 1 + n) % n], [nx, ny] = P[(i + 1) % n];
    const lin = Math.hypot(x - px, y - py), lout = Math.hypot(nx - x, ny - y);
    const d = Math.min(r, lin / 2, lout / 2);
    const a = [x + ((px - x) / lin) * d, y + ((py - y) / lin) * d], b = [x + ((nx - x) / lout) * d, y + ((ny - y) / lout) * d];
    seg.push({ a, b, v: [x, y], d });
  }
  let s = `M${f(seg[0].b[0])} ${f(seg[0].b[1])}`;
  for (let i = 1; i <= n; i++) {
    const cur = seg[i % n], prev = seg[i - 1];
    // the edge from the last corner to this one, a hair bowed when it is long
    const [x0, y0] = prev.b, [x1, y1] = cur.a, len = Math.hypot(x1 - x0, y1 - y0);
    if (rng && len > 260) {
      const bow = (rng() - 0.5) * Math.min(6, len / 120), mx = (x0 + x1) / 2 - ((y1 - y0) / len) * bow, my = (y0 + y1) / 2 + ((x1 - x0) / len) * bow;
      s += ` Q${f(mx)} ${f(my)} ${f(x1)} ${f(y1)}`;
    } else s += ` L${f(x1)} ${f(y1)}`;
    if (cur.d > 0.5) {
      const k = 0.5523, [vx, vy] = cur.v;
      s += ` C${f(cur.a[0] + (vx - cur.a[0]) * k)} ${f(cur.a[1] + (vy - cur.a[1]) * k)} ${f(cur.b[0] + (vx - cur.b[0]) * k)} ${f(cur.b[1] + (vy - cur.b[1]) * k)} ${f(cur.b[0])} ${f(cur.b[1])}`;
    }
  }
  return `${s} Z`;
}

/** Each letter of the word placed: { id, x, w, contours }. */
export function layoutWord(word = WORD) {
  let x = 0;
  return word.map(([id, space], i) => {
    if (i) x += space;
    const g = GLYPHS[id], at = { id, x, w: g.w, contours: g.contours };
    x += g.w;
    return at;
  });
}

const PAD = 24;   // (room for the ink line and the shadow's)
const WIDTH = (() => { const l = layoutWord(); const last = l[l.length - 1]; return last.x + last.w; })();
/** The lettering's viewBox (units): the word, its shadow and the ink line's half. */
export const LOGO_BOX = { w: WIDTH + SHADOW[0] + PAD * 2, h: 1000 + SHADOW[1] + PAD * 2 };

/** Is (x, y) inside the polygon (corners only)? */
function inside(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * The lettering as an SVG string. o.ink: the ink line's width (units; the layout thickens it on a
 * small screen so it never falls under a pixel and a half), o.className, o.specks (the paper's
 * few flecks in the ivory, as printed).
 */
export function logoSvg({ ink = INK, className = 'logo', specks = true, colors = LOGO_COLORS } = {}) {
  const letters = layoutWord();
  const face = [], shadow = [], dots = [];
  const rng = rand(1912);
  for (const L of letters) {
    // (the face and its shadow share the hand: the same wobble, the shadow simply offset)
    const seed = L.id.charCodeAt(0) * 131 + L.x;
    const d = L.contours.map((pts) => contourPath(pts, PAD + L.x, PAD, rand(seed))).join(' ');
    const ds = L.contours.map((pts) => contourPath(pts, PAD + L.x + SHADOW[0], PAD + SHADOW[1], rand(seed))).join(' ');
    face.push(`<path d="${d}"/>`);
    shadow.push(`<path d="${ds}"/>`);
    if (specks) {
      for (let k = 0; k < 4; k++) {
        const x = rng() * L.w, y = 60 + rng() * 880;
        if (inside(L.contours[0], x, y) && !L.contours.slice(1).some((h) => inside(h, x, y))) dots.push(`<circle cx="${(PAD + L.x + x).toFixed(0)}" cy="${(PAD + y).toFixed(0)}" r="${(2.5 + rng() * 3).toFixed(1)}"/>`);
      }
    }
  }
  const w = Math.round(LOGO_BOX.w), h = Math.round(LOGO_BOX.h);
  return `<svg class="${className}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Hiraeth" xmlns="http://www.w3.org/2000/svg">`
    + `<g class="shade" fill="${colors.shadow}" stroke="${colors.ink}" stroke-width="${ink}" stroke-linejoin="round" fill-rule="evenodd">${shadow.join('')}</g>`
    + `<g class="face" fill="${colors.face}" stroke="${colors.ink}" stroke-width="${ink}" stroke-linejoin="round" fill-rule="evenodd">${face.join('')}</g>`
    + (dots.length ? `<g class="specks" fill="${colors.ink}" opacity="0.55">${dots.join('')}</g>` : '')
    + '</svg>';
}
