// Each world's writing: what the dialogue panel shows of a line before the
// translator at the traveller's ear turns it into his words (src/story/dialogue.js
// revealHtml). Pure: text in, SVG markup out (no DOM), so the tests can read it.
//
//   SCRIPTS[lang]                 the script a tongue (src/story/voice.js LANGUAGES) is written in:
//                                 { id, name, about, ink, dir, kind, inventory: [glyph…], … }
//   scriptOf(lang)                the same, or null for the tongues needing no translation (home, the ship)
//   lineChunks(text)              a line cut where the script is written: each run of non-blank
//                                 characters outside the markup ("well," "half-sunk" "‘Gone.’")
//   writeChunk(chunk, lang, o)    its glyphs: { d (strokes), f (fills), glyphs: [{ id, from }], width }
//   chunkSvg(chunk, lang, o)      the same as an inline <svg>, exactly as wide as the chunk's letters
//
// Real-language feel, the cheap way:
// - Each script has a fixed inventory of 20–40 glyphs, built from a few base strokes and the
//   marks that vary them (dots over an abjad's teeth, a monk's vowel signs, a knot's size).
// - A word is always written the same way in a tongue (no randomness: hashes of the word), and
//   words that share letters or syllables share glyphs. Letter scripts use a cipher that gives
//   the commonest letters the simplest glyphs, so the glyphs come out frequency-weighted as in a
//   real script; the syllable and word scripts pick with a Zipf weighting.
// - The panel's font is monospaced, so a chunk's glyphs are drawn in a box exactly its English
//   width (CH units a letter): the words keep the line's structure and the line never reflows
//   when a word turns into English. Inside the box each script has its own rhythm: one glyph a
//   letter, a few consonants stretched along a joining stroke, one logogram a word, a mark or
//   nothing (Vael leaves words out).
// - Punctuation has each script's own marks; right-to-left scripts write each word from the
//   right (the word order along the line is the panel's, left to right).
//
// Coordinates: x in units, CH = 6 a letter (1ch ≈ 0.6em); y in tenths of an em, 0 at the top,
// the baseline at 10; the svg spans y 0.5..12.5 (1.2em, 0.25em under the baseline).

import { hash01 as voiceHash, LANGUAGES } from './voice.js';

export const CH = 6;
const BASE = 10;
const r1 = (x) => Math.round(x * 10) / 10;

/** A stable hash → 0..1 (FNV-1a, then mixed: keys differing in their last letter land far apart). */
export function hash01(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A pen drawing strokes (`s`) and fills (`f`) as SVG path data, mirrored for right-to-left scripts. */
class Pen {
  constructor({ mirror = 0, slant = 0 } = {}) { this.s = ''; this.f = ''; this.mirror = mirror; this.slant = slant; this.fill = false; }
  X(x, y) { if (this.slant) x += this.slant * (BASE - y); return this.mirror ? this.mirror - x : x; }
  pt(x, y) { return `${r1(this.X(x, y))} ${r1(y)}`; }
  add(s) { if (this.fill) this.f += s; else this.s += s; return this; }
  m(x, y) { return this.add(`M${this.pt(x, y)}`); }
  l(x, y) { return this.add(`L${this.pt(x, y)}`); }
  q(cx, cy, x, y) { return this.add(`Q${this.pt(cx, cy)} ${this.pt(x, y)}`); }
  z() { return this.add('Z'); }
  arc(r, large, sweep, x, y) { return this.add(`A${r1(r)} ${r1(r)} 0 ${large} ${this.mirror ? 1 - sweep : sweep} ${this.pt(x, y)}`); }
  ring(x, y, r) { return this.m(x - r, y).arc(r, 1, 0, x + r, y).arc(r, 1, 0, x - r, y); }
  filled(fn) { const f = this.fill; this.fill = true; fn(this); this.fill = f; return this; }
  dot(x, y, r) { return this.filled((p) => p.ring(x, y, r)); }
  box(x, y, w, h) { return this.filled((p) => p.m(x, y).l(x + w, y).l(x + w, y + h).l(x, y + h).z()); }
}

// ------------------------------------------------------------------ words into tokens
const VOWEL = /[aeiouyàáâäãåæèéêëìíîïòóôöõøùúûüœ]/;
/** English letters by frequency (the cipher's order) and the pairs some scripts write as one. */
const FREQ = [...'etaoinshrdlcumwfgypbvkjxqz', 'th', 'sh', 'ch', 'ng', 'gh', 'kh', 'ph', 'qu', ...'0123456789'];
const CONSONANTS = FREQ.filter((t) => !/^[aeiou]$/.test(t));

/** A word's letters cut into syllables: [{ t, from, to }] (letter indices, `to` exclusive). */
export function syllables(word) {
  const w = word.toLowerCase(), out = [];
  const re = /[^aeiouy]*[aeiouy]+|[^aeiouy]+$/g;
  for (const m of w.matchAll(re)) out.push({ t: m[0], from: m.index, to: m.index + m[0].length });
  // a closing consonant cluster joins the syllable before it; a medial cluster is split (gar·den)
  for (let k = out.length - 1; k > 0; k--) {
    if (!VOWEL.test(out[k].t)) { out[k - 1].t += out[k].t; out[k - 1].to = out[k].to; out.splice(k, 1); continue; }
    const lead = out[k].t.match(/^[^aeiouy]*/)[0];
    if (lead.length >= 2) { const give = lead.length - 1; out[k - 1].t += out[k].t.slice(0, give); out[k - 1].to += give; out[k].t = out[k].t.slice(give); out[k].from += give; }
  }
  return out.length ? out : [{ t: w, from: 0, to: w.length }];
}

/** Letters (and the pairs in `pairs`) one token each. */
function letterTokens(w, pairs = []) {
  const out = [];
  for (let i = 0; i < w.length;) {
    const two = w.slice(i, i + 2);
    if (pairs.includes(two)) { out.push({ t: two, from: i, to: i + 2 }); i += 2; } else { out.push({ t: w[i], from: i, to: i + 1 }); i++; }
  }
  return out;
}

/** An abjad's tokens: the consonants (and a word's first vowel), a doubled letter written once and marked. */
function abjadTokens(w) {
  const out = [];
  for (const t of letterTokens(w, ['th', 'sh', 'ch', 'kh', 'gh'])) {
    if (out.length && /^[aeiou]$/.test(t.t)) continue;
    const last = out[out.length - 1];
    if (last && last.t === t.t) { last.double = true; last.to = t.to; continue; }
    out.push({ ...t });
  }
  return out;
}

// ------------------------------------------------------------------ inventories
/** A cheap seeded order (for picking an inventory out of the combinations a script's strokes allow). */
const seeded = (list, seed) => list.map((x, k) => [hash01(`${seed}:${k}`), x]).sort((a, b) => a[0] - b[0]).map((e) => e[1]);

/**
 * Give each token a glyph: the commonest tokens the simplest glyphs (the inventory is in order of
 * complexity), shuffled within fours so it isn't a straight ramp.
 */
function makeCipher(S, order = FREQ) {
  const N = S.inventory.length, rank = [];
  for (let k = 0; k < N; k += 4) rank.push(...seeded([...Array(Math.min(4, N - k)).keys()].map((j) => k + j), `${S.id}:rank:${k}`));
  const map = new Map();
  order.forEach((t, k) => map.set(t, k < N ? rank[k] : Math.floor(hash01(`${S.id}:${t}`) * N)));
  return (t) => map.get(t) ?? Math.floor(hash01(`${S.id}:${t}`) * N);
}

/** A Zipf-weighted pick from the inventory (glyph k about 1/(k+1.5) as often as the first). */
function makePick(S) {
  const N = S.inventory.length, cum = [];
  let sum = 0;
  for (let k = 0; k < N; k++) { sum += 1 / (k + 1.5); cum.push(sum); }
  return (key) => { const u = hash01(`${S.id}|${key}`) * sum; let k = 0; while (k < N - 1 && cum[k] < u) k++; return k; };
}

// ------------------------------------------------------------------ the scripts
// Each one: tokens(word) → [{ t, from, to }], id(token) → inventory index, draw(pen, glyph, slot)
// for a token's glyph in its slot ({ x0, x1, c, k, n, tok, word }), and its punctuation:
// punct(pen, kind, x0, x1). `spread`: the glyphs share the word's width evenly (else each sits
// over its own letters). Optional: start/end(pen, x0, x1, word) at a word's ends, after(pen, W)
// in the space after a chunk (the runes' word dots), under(pen, x0, x1) for a name (the market).

const PUNCT = { '.': 'stop', ',': 'pause', ';': 'pause', ':': 'pause', '?': 'ask', '!': 'exclaim', '…': 'trail',
  '—': 'dash', '–': 'dash', '-': 'dash', '“': 'quote', '”': 'quote', '"': 'quote', '‘': 'quote', '’': 'quote', "'": 'quote', '«': 'quote', '»': 'quote' };

/** Qanati (the desert): a cursive abjad, right to left, the consonants joined along the baseline,
 *  told apart by dots as the desert's oldest writing is; a word ends in a swash. */
const DESERT_BASES = {
  tooth: (p, c, s) => p.m(c + 0.9 * s, 10).q(c + 0.8 * s, 8.3, c + 0.1 * s, 7.5),
  alif: (p, c) => p.m(c + 0.2, 10).q(c - 0.5, 6.4, c + 0.5, 3.0),
  lam: (p, c, s) => p.m(c - 1.6 * s, 10).q(c + 1.1 * s, 10.3, c + 0.9 * s, 7).l(c + 0.6 * s, 3.2),
  bowl: (p, c, s) => p.m(c + 2 * s, 9.6).q(c + 2.3 * s, 12.9, c, 12.7).q(c - 2.2 * s, 12.5, c - 2.1 * s, 10.4),
  loop: (p, c, s) => p.m(c + 1.7 * s, 10).q(c + 1.7 * s, 7.0, c, 7.3).q(c - 1.6 * s, 7.7, c - 0.9 * s, 9.5).q(c + 0.2 * s, 10.4, c + 1.7 * s, 10),
  eye: (p, c, s) => p.m(c + 2.2 * s, 10).q(c + 0.2 * s, 4.6, c - 1.9 * s, 8.1).q(c - 1.2 * s, 10.5, c + 2.2 * s, 10),
  seen: (p, c, s) => p.m(c + 2.4 * s, 10).q(c + 1.8 * s, 7.8, c + 1.2 * s, 10).q(c + 0.6 * s, 7.8, c, 10).q(c - 0.6 * s, 7.8, c - 1.2 * s, 10),
  ra: (p, c, s) => p.m(c + 1.2 * s, 10).q(c + 0.4 * s, 10.6, c - 0.9 * s, 12.7),
  kaf: (p, c, s) => p.m(c - 1.4 * s, 10).l(c + 1.4 * s, 10).m(c + 1.5 * s, 9.5).l(c - 0.9 * s, 4.3),
  ayn: (p, c, s) => p.m(c + 1.7 * s, 10).q(c - 1.8 * s, 10.1, c - 1.1 * s, 7.5).q(c - 0.5 * s, 6.2, c + 1.1 * s, 6.8),
};
const DESERT_DOTS = {
  '': () => {},
  a1: (p, c) => p.dot(c, 5.9, 0.62),
  a2: (p, c) => { p.dot(c - 0.9, 5.9, 0.62); p.dot(c + 0.9, 5.9, 0.62); },
  a3: (p, c) => { p.dot(c - 0.9, 6.1, 0.6); p.dot(c + 0.9, 6.1, 0.6); p.dot(c, 4.7, 0.6); },
  b1: (p, c) => p.dot(c, 12.0, 0.62),
  b2: (p, c) => { p.dot(c - 0.9, 12.0, 0.62); p.dot(c + 0.9, 12.0, 0.62); },
};
const desert = {
  id: 'desert', name: 'Qanati', world: 'the Desert', ink: '#a2502e', dir: 'rtl', kind: 'abjad', width: 1.15, spread: true,
  about: 'a cursive abjad: consonants joined along the baseline, dots telling them apart, a swash at each word’s end; right to left',
  inventory: [
    ['tooth', ''], ['tooth', 'a1'], ['alif', ''], ['tooth', 'b1'], ['loop', ''], ['tooth', 'a2'], ['bowl', 'a1'], ['ra', ''],
    ['seen', ''], ['lam', ''], ['eye', ''], ['tooth', 'b2'], ['kaf', ''], ['tooth', 'a3'], ['ra', 'a1'], ['bowl', ''],
    ['loop', 'a1'], ['ayn', ''], ['seen', 'a3'], ['eye', 'a1'], ['ayn', 'a1'], ['bowl', 'a2'], ['lam', 'b1'], ['alif', 'b1'],
    ['eye', 'b1'], ['kaf', 'b1'], ['loop', 'a2'], ['bowl', 'a3'], ['ra', 'a2'], ['seen', 'b2'],
  ].map(([base, dots]) => ({ base, dots })),
  tokens: abjadTokens,
  order: ['a', ...CONSONANTS, 'e', 'i', 'o', 'u'],
  draw(p, g, { x0, x1, c, k, n, tok }) {
    const s = Math.min(1.25, Math.max(0.7, (x1 - x0) / 5));
    p.m(x0, 10).q((x0 + x1) / 2, 10.35, x1, 10);   // the joining stroke (stretched to fill the word: kashida)
    DESERT_BASES[g.base](p, c, s);
    DESERT_DOTS[g.dots](p, c);
    if (tok.double) p.m(c - 1.1, 3.9).q(c - 0.55, 5.0, c, 3.9).q(c + 0.55, 5.0, c + 1.1, 3.9);   // a doubled letter
    if (k === n - 1) p.m(x1 - 0.2, 10).q(x1 + 1.3, 10.3, x1 + 1.5, 8.2);   // the final swash
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') p.ring(c, 8.6, 0.95);
    else if (kind === 'pause') { p.dot(c, 9.3, 0.6); p.m(c, 9.3).q(c + 1.0, 8.6, c + 0.5, 7.3); }
    else if (kind === 'ask') { p.m(c - 1.1, 5.2).q(c - 1.0, 3.4, c + 0.6, 4.2).q(c + 1.4, 5.6, c, 7.4); p.dot(c, 9.6, 0.6); }
    else if (kind === 'exclaim') { p.m(c, 3.6).l(c, 7.6); p.dot(c, 9.6, 0.6); }
    else if (kind === 'trail') { p.dot(c - 1.2, 9.6, 0.55); p.dot(c + 1.2, 9.6, 0.55); p.dot(c, 8.2, 0.55); }
    else if (kind === 'dash') p.m(x0, 10).q(c, 10.4, x1, 10);
    else if (kind === 'quote') p.m(c + 1.2, 4).l(c - 0.2, 5.2).l(c + 1.2, 6.4).m(c + 0.1, 4).l(c - 1.3, 5.2).l(c + 0.1, 6.4);
  },
};

/** Shaft cant (the City-Shaft): runes, straight strokes off a stem, slanting forward like quick
 *  scratches on a wall; dots between words, as old carved inscriptions have. */
const RUNE_BRANCHES = {
  tr: (p, x) => p.m(x, 3.3).l(x + 2.2, 5.0), tl: (p, x) => p.m(x, 3.3).l(x - 2.2, 5.0),
  mr: (p, x) => p.m(x, 6.8).l(x + 2.2, 4.9), ml: (p, x) => p.m(x, 6.8).l(x - 2.2, 4.9),
  br: (p, x) => p.m(x, 8.0).l(x + 2.2, 10), bl: (p, x) => p.m(x, 8.0).l(x - 2.2, 10),
  x: (p, x) => p.m(x - 2.1, 7.8).l(x + 2.1, 5.2),
  fl: (p, x) => p.m(x, 3.3).l(x + 2.2, 4.8).l(x, 6.3),
  lo: (p, x) => p.m(x, 6.5).l(x + 2.0, 8.2).l(x, 10),
};
const incal = {
  id: 'incal', name: 'Shaft cant', world: 'the City-Shaft', ink: '#2c6788', dir: 'ltr', kind: 'runes', width: 1.05, slant: 0.16,
  about: 'runes: straight strokes off a stem, one a letter, leaning forward, dots between the words',
  inventory: [
    [], ['tr'], ['br'], ['mr'], ['tl'], ['fl'], ['bl'], ['ml'], ['x'], ['lo'],
    ['tr', 'tl'], ['tr', 'br'], ['tl', 'bl'], ['mr', 'ml'], ['tr', 'bl'], ['tl', 'br'], ['fl', 'lo'], ['fl', 'br'],
    ['mr', 'bl'], ['ml', 'br'], ['x', 'tr'], ['x', 'bl'], ['br', 'bl'], ['fl', 'x'], ['lo', 'tl'], ['tl', 'mr'],
    ['tr', 'ml'], ['x', 'br'], ['fl', 'bl'], ['tr', 'tl', 'br'],
  ].map((branches) => ({ branches })),
  tokens: (w) => letterTokens(w, ['th', 'ng']),
  draw(p, g, { c }) {
    p.m(c, 3.3).l(c, 10);
    for (const b of g.branches) RUNE_BRANCHES[b](p, c);
  },
  after(p, W) { p.dot(W + CH / 2, 6.8, 0.7); },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') { p.dot(c, 5.2, 0.7); p.dot(c, 8.6, 0.7); }
    else if (kind === 'pause') p.m(c + 0.6, 7.2).l(c - 0.6, 10);
    else if (kind === 'ask') { p.m(c - 1.6, 6.2).l(c + 1.6, 6.2).m(c, 4.4).l(c, 8.0); p.dot(c, 10, 0.6); }
    else if (kind === 'exclaim') { p.m(c, 3.3).l(c, 8.0); p.dot(c - 1.2, 10, 0.55); p.dot(c + 1.2, 10, 0.55); }
    else if (kind === 'trail') { p.dot(c, 4.6, 0.55); p.dot(c, 7.0, 0.55); p.dot(c, 9.4, 0.55); }
    else if (kind === 'dash') p.m(x0 + 0.5, 6.8).l(x1 - 0.5, 6.8);
    else if (kind === 'quote') p.m(c + 1, 3.6).l(c - 0.8, 5.0).l(c + 1, 6.4);
  },
};

/** The Vael hush: hardly written at all. A mark like a bird's track for a word, a dot for a word
 *  left unsaid (the same words the voice leaves out), a line in the sand for a full stop. */
const TRACK_ANGLES = [0, 22, -22, 48, -48, 74, -74, 180];
const arzach = {
  id: 'arzach', name: 'the Vael hush', world: 'Vael', ink: '#6f7a8c', dir: 'ltr', kind: 'marks', width: 0.9,
  about: 'one mark a word, like a bird’s track in the sand, and a dot for each word left unsaid',
  inventory: TRACK_ANGLES.flatMap((a) => ['plain', 'spur', 'heel'].map((v) => ({ a, v }))),
  tokens: (w) => [{ t: w, from: 0, to: w.length }],
  hashed: true,
  id_(tok, word) {
    const L = LANGUAGES.arzach;
    if (L.density < 0.5 && voiceHash(word.toLowerCase() + 'arzach') > L.density * 1.6) return -1;   // (voice.js: a word left out)
    return null;
  },
  draw(p, g, { x0, x1, word }) {
    if (!g) { p.dot(x0 + 1.6, 9.3, 0.65); return; }   // a word left unsaid
    const cx = x0 + Math.min(4, (x1 - x0) / 2), cy = 6.9 + (hash01(word + ':y') - 0.5) * 1.6;
    const t = (g.a * Math.PI) / 180, ux = Math.sin(t), uy = -Math.cos(t);
    const hx = cx - ux * 2.3, hy = cy - uy * 2.3;
    for (const [da, len] of [[-0.6, 3.7], [0, 4.6], [0.6, 3.7]]) {
      const a = t + da;
      p.m(hx, hy).l(hx + Math.sin(a) * len, hy - Math.cos(a) * len);
    }
    if (g.v === 'spur') p.m(hx, hy).l(hx - ux * 1.8, hy - uy * 1.8);
    if (g.v === 'heel') p.dot(hx - ux * 1.2, hy - uy * 1.2, 0.6);
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') p.m(x0 - 0.5, 10.2).q(x0 + 1.5, 9.0, x0 + 3.5, 10.2).q(x0 + 5.5, 11.4, x1 + 1.5, 10.2);   // a line drawn in the sand
    else if (kind === 'ask') p.ring(c, 8.6, 1.2);
    else if (kind === 'exclaim') p.m(c, 6).l(c, 10);
  },
};

/** The cloud-monks' chant (Vael II): an abugida hanging from a headline like bells from a beam:
 *  a glyph a syllable, its vowel a mark around it ('a' is unwritten), a hook for a closing consonant. */
const MONK_BASES = {
  bell: (p, c) => p.m(c - 1.8, 4.1).q(c - 1.8, 8.6, c - 2.5, 10).l(c + 2.5, 10).q(c + 1.8, 8.6, c + 1.8, 4.1),
  hook: (p, c) => p.m(c, 4.1).l(c, 7.6).q(c, 10, c + 2, 10),
  loopstem: (p, c) => p.m(c + 1.5, 4.1).l(c + 1.5, 10).m(c + 1.5, 6.4).q(c - 2.1, 5.4, c - 1.8, 8).q(c - 1.4, 10, c + 1.5, 8.8),
  ess: (p, c) => p.m(c - 1.6, 4.1).q(c + 2.2, 5.2, c, 7).q(c - 2.2, 8.8, c + 1.8, 10),
  clapper: (p, c) => { p.m(c, 4.1).l(c, 8.2); p.dot(c, 9.5, 0.8); },
  arch: (p, c) => p.m(c, 4.1).l(c, 5.8).m(c - 2.1, 10).q(c, 4.4, c + 2.1, 10),
  fork: (p, c) => p.m(c, 4.1).l(c, 6.6).l(c - 2, 10).m(c, 6.6).l(c + 2, 10),
  ringhang: (p, c) => p.m(c, 4.1).l(c, 5.3).ring(c, 7.6, 2.2),
  ladder: (p, c) => p.m(c - 1.7, 4.1).l(c - 1.7, 10).m(c + 1.7, 4.1).l(c + 1.7, 10).m(c - 1.7, 7.1).l(c + 1.7, 7.1),
  curl: (p, c) => p.m(c + 2, 4.1).q(c + 2, 7, c, 7).q(c - 1.7, 7, c - 1.7, 8.6).q(c - 1.7, 10, c, 10).q(c + 1.6, 10, c + 1.4, 8.8),
  wave: (p, c) => p.m(c - 2, 4.1).q(c - 2, 6, c, 6).q(c + 2, 6, c + 2, 8).l(c + 2, 10),
  tri: (p, c) => p.m(c, 4.1).l(c - 2, 9.6).l(c + 2, 9.6).z(),
  gate: (p, c) => p.m(c - 2, 4.1).l(c - 2, 10).m(c - 2, 7).q(c + 2.2, 6.6, c + 1.6, 10),
  tongue: (p, c) => p.m(c - 1.4, 4.1).q(c + 2.6, 6.6, c - 1.2, 9.8),
  stemdot: (p, c) => { p.m(c - 1, 4.1).l(c - 1, 10); p.dot(c + 1.2, 7.4, 0.8); },
  bowl: (p, c) => p.m(c - 2, 6).q(c - 2, 10.2, c, 10.2).q(c + 2, 10.2, c + 2, 6).m(c, 4.1).l(c, 6.2),
  vowel: (p, c) => p.m(c, 4.1).l(c, 5.1).ring(c, 7.6, 2.4).m(c - 0.8, 7.6).l(c + 0.8, 7.6),   // a syllable starting with its vowel
};
const MONK_MARKS = {
  e: (p, c) => p.m(c - 1.3, 3.0).q(c, 0.9, c + 1.3, 3.0),
  i: (p, c, x1) => p.m(x1 - 0.7, 10).l(x1 - 0.7, 3.6).q(x1 - 0.7, 1.3, x1 - 2.6, 1.9),
  o: (p, c) => p.dot(c, 1.9, 0.75),
  u: (p, c) => p.m(c + 0.6, 10).q(c + 0.8, 12.4, c - 1.4, 12.1),
  y: (p, c) => { p.dot(c - 0.9, 1.9, 0.65); p.dot(c + 0.9, 1.9, 0.65); },
};
const arzach2 = {
  id: 'arzach2', name: 'cloud-monk chant', world: 'Vael II', ink: '#4359a0', dir: 'ltr', kind: 'abugida', width: 1.1,
  about: 'an abugida hanging from a headline: one glyph a syllable, the vowel a sign around it (‘a’ unwritten), the headline hooking down after a closing consonant',
  inventory: [...Object.keys(MONK_BASES).map((base) => ({ base })), ...Object.keys(MONK_MARKS).map((mark) => ({ mark })), { mark: 'halt' }],
  tokens: syllables,
  sample(p, g, slot) {
    if (g.base) { this.draw(p, g, { ...slot, tok: { t: 'ka' }, n: 1 }); return; }
    p.box(slot.x0, 3.2, slot.x1 - slot.x0, 1.0);
    if (g.mark === 'halt') p.m(slot.x1 - 0.2, 3.7).q(slot.x1 + 1.1, 3.7, slot.x1 + 1.0, 5.4); else MONK_MARKS[g.mark](p, slot.c, slot.x1);
  },
  id_(tok) {
    const onset = tok.t.match(/^[^aeiouy]*/)[0];
    const bases = Object.keys(MONK_BASES).length - 1;   // (the last is the vowel-initial one)
    if (!onset) return bases;
    return CONSONANTS.indexOf(onset[0]) >= 0 ? (CONSONANTS.indexOf(onset[0]) * 5 + (onset.length > 1 ? 3 : 0)) % bases : 0;
  },
  draw(p, g, { x0, x1, tok, k, n }) {
    p.box(x0 - (k ? 0.2 : 0), 3.2, x1 - x0 + 0.2, 1.0);   // the headline
    const v = tok.t.match(/[aeiouy]/)?.[0], c = v === 'i' ? (x0 + x1) / 2 - 0.9 : (x0 + x1) / 2;
    MONK_BASES[g.base](p, c);
    if (v && v !== 'a' && !(g.base === 'vowel' && tok.t[0] === v)) MONK_MARKS[v](p, c, x1);
    if (!/[aeiouy]$/.test(tok.t) && k === n - 1) p.m(x1 - 0.2, 3.7).q(x1 + 1.1, 3.7, x1 + 1.0, 5.4);   // a closing consonant: the headline hooks down
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') p.m(c, 3.0).l(c, 10);
    else if (kind === 'pause') p.m(c, 6.2).l(c, 10);
    else if (kind === 'ask') { p.m(c, 5.2).l(c, 10); p.ring(c, 3.2, 0.9); }
    else if (kind === 'exclaim') p.m(c - 0.9, 3.0).l(c - 0.9, 10).m(c + 0.9, 3.0).l(c + 0.9, 10);
    else if (kind === 'trail') { p.dot(c - 1.4, 9.6, 0.5); p.dot(c, 9.6, 0.5); p.dot(c + 1.4, 9.6, 0.5); }
    else if (kind === 'dash') p.box(x0, 3.2, x1 - x0, 1.0);
    else if (kind === 'quote') p.m(c - 0.6, 2.2).q(c + 1.2, 2.6, c + 0.6, 4.4);
  },
};

/** Hangar clatter (the Sealed Hangar): stamped stencil letters, bars on a grid with the gaps a
 *  stencil leaves at the joints, the odd rivet. */
const SEG = ['T', 'M', 'B', 'UL', 'UR', 'LL', 'LR', 'C', 'D'];
function hangarInventory() {
  const combos = (k, from = 0, acc = [], out = []) => {
    if (acc.length === k) { out.push(acc); return out; }
    for (let i = from; i < SEG.length; i++) combos(k, i + 1, [...acc, SEG[i]], out);
    return out;
  };
  const ok = (s) => !(s.includes('C') && s.includes('D'));
  const take = (k, n) => seeded(combos(k).filter(ok), `garage:${k}`).slice(0, n);
  return [...take(2, 9), ...take(3, 12), ...take(4, 9)].map((segs, i) => ({ segs, rivet: hash01(`garage:rivet:${i}`) < 0.3 }));
}
const garage = {
  id: 'garage', name: 'Hangar clatter', world: 'the Sealed Hangar', ink: '#4c535c', dir: 'ltr', kind: 'stamped', width: 1.2, cap: 'butt',
  about: 'stamped stencil letters: bars on a grid with the stencil’s gaps at the joints, one a letter, the odd rivet',
  inventory: hangarInventory(),
  tokens: (w) => letterTokens(w),
  draw(p, g, { x0 }) {
    const X0 = x0 + 1.3, X1 = x0 + 4.7, XC = x0 + 3, Y = [3.4, 6.7, 10], t = 1.15, gap = 0.42;
    const h = (y) => p.box(X0 + gap - t / 2, y - t / 2, X1 - X0 - 2 * gap + t, t);
    const v = (x, ya, yb) => p.box(x - t / 2, ya + gap, t, yb - ya - 2 * gap);
    for (const s of g.segs) {
      if (s === 'T') h(Y[0]); else if (s === 'M') h(Y[1]); else if (s === 'B') h(Y[2]);
      else if (s === 'UL') v(X0, Y[0], Y[1]); else if (s === 'UR') v(X1, Y[0], Y[1]);
      else if (s === 'LL') v(X0, Y[1], Y[2]); else if (s === 'LR') v(X1, Y[1], Y[2]);
      else if (s === 'C') v(XC, Y[0], Y[2]);
      else if (s === 'D') p.m(X0 + 0.5, Y[2] - 0.6).l(X1 - 0.5, Y[0] + 0.6);
    }
    if (g.rivet) p.dot(x0 + 5.5, 2.2, 0.5);
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') p.box(c - 0.75, 9.1, 1.5, 1.5);
    else if (kind === 'pause') { p.box(c - 0.75, 9.1, 1.5, 1.5); p.box(c - 0.75, 10.6, 0.7, 1.4); }
    else if (kind === 'ask') { p.box(c - 0.75, 9.1, 1.5, 1.5); p.box(c - 0.55, 3.4, 1.1, 4.4); p.box(c - 1.8, 3.4, 2.4, 1.1); }
    else if (kind === 'exclaim') { p.box(c - 0.55, 3.4, 1.1, 4.4); p.box(c - 0.75, 9.1, 1.5, 1.5); }
    else if (kind === 'trail') { p.box(c - 2.2, 9.3, 1.1, 1.1); p.box(c - 0.55, 9.3, 1.1, 1.1); p.box(c + 1.1, 9.3, 1.1, 1.1); }
    else if (kind === 'dash') p.box(x0 + 0.6, 6.1, x1 - x0 - 1.2, 1.15);
    else if (kind === 'quote') { p.box(c - 1.2, 3.2, 2.4, 0.9); p.box(c - 1.2, 3.2, 0.9, 2.4); }
  },
};

/** The Deep-wheel tongue (the Buried Machine): teeth standing on a rail, right to left, the way
 *  the great wheel counts; a gear's hub for a full stop. */
const T_H = { l: 7.4, m: 5.4, h: 3.4 };
const buried = {
  id: 'buried', name: 'Deep-wheel tongue', world: 'the Buried Machine', ink: '#6d5532', dir: 'rtl', kind: 'rack', width: 1.0, cap: 'butt',
  about: 'gear teeth standing on a rail, one cell a letter, written right to left; a gear’s hub ends a sentence',
  inventory: [
    ...['l', 'm', 'h'].map((a) => ({ teeth: [a] })),
    ...['l', 'm', 'h'].map((a) => ({ teeth: [a], notch: true })),
    ...['l', 'm', 'h'].map((a) => ({ teeth: [a], gauge: true })),
    ...['ll', 'lm', 'lh', 'ml', 'mm', 'mh', 'hl', 'hm', 'hh'].map((t) => ({ teeth: [...t] })),
    ...['hl', 'lh', 'mm'].map((t) => ({ teeth: [...t], notch: true })),
    ...['lmh', 'hml', 'mhm'].map((t) => ({ teeth: [...t] })),
    { teeth: [], notch: true }, { teeth: [], gauge: true },
  ],
  tokens: (w) => letterTokens(w),
  draw(p, g, { x0 }) {
    p.box(x0, 9.4, CH, 1.2);   // the rail
    const n = g.teeth.length, w = n === 3 ? 1.25 : 1.7;
    g.teeth.forEach((h, j) => {
      const xc = x0 + (n === 1 ? 3 : n === 2 ? 1.6 + j * 2.8 : 1.1 + j * 1.9), top = T_H[h];
      p.filled((q) => q.m(xc - w / 2, 9.5).l(xc - w / 2 + 0.35, top).l(xc + w / 2 - 0.35, top).l(xc + w / 2, 9.5).z());
    });
    if (g.notch) p.filled((q) => q.m(x0 + 2.1, 10.5).l(x0 + 2.4, 12.3).l(x0 + 3.6, 12.3).l(x0 + 3.9, 10.5).z());
    if (g.gauge) p.ring(x0 + 3, n ? T_H[g.teeth[0]] - 1.4 : 7.6, 0.75);
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind !== 'pause') p.box(x0, 9.4, x1 - x0, 1.2);
    if (kind === 'stop') { p.ring(c, 6.4, 1.6); p.dot(c, 6.4, 0.5); }
    else if (kind === 'pause') p.filled((q) => q.m(c - 0.9, 9.4).l(c - 0.6, 12.2).l(c + 0.6, 12.2).l(c + 0.9, 9.4).z());
    else if (kind === 'ask') { p.ring(c, 4.4, 1.1); p.box(c - 0.6, 6.4, 1.2, 3.1); }
    else if (kind === 'exclaim') { p.box(c - 0.5, 3.2, 1.0, 6.3); p.ring(c, 12.0, 0.6); }
    else if (kind === 'trail') { p.ring(c - 1.8, 7.6, 0.6); p.ring(c, 7.6, 0.6); p.ring(c + 1.8, 7.6, 0.6); }
  },
};

/** Edenic (Viridel): a vine. A stem waves through the word and every two letters something
 *  grows off it: a leaf, a tendril, a bud, berries, a thorn. */
const SPROUTS = {
  leaf: (p, c, y, d, e) => p.m(c, y).q(c + 2.3 * e, y + 2.0 * d, c + 0.8 * e, y + 4.4 * d).q(c - 1.0 * e, y + 2.4 * d, c, y),
  curl: (p, c, y, d, e) => p.m(c, y).q(c - 0.2 * e, y + 3.2 * d, c + 1.4 * e, y + 3.4 * d).q(c + 2.6 * e, y + 3.0 * d, c + 2.0 * e, y + 1.9 * d).q(c + 1.4 * e, y + 1.4 * d, c + 1.0 * e, y + 2.2 * d),
  bud: (p, c, y, d) => { p.m(c, y).l(c, y + 2.6 * d); p.dot(c, y + 3.4 * d, 0.9); },
  berries: (p, c, y, d) => { p.m(c, y).l(c + 0.3, y + 1.4 * d); p.dot(c - 1.0, y + 2.2 * d, 0.6); p.dot(c + 0.7, y + 3.2 * d, 0.6); p.dot(c + 1.5, y + 1.6 * d, 0.6); },
  thorn: (p, c, y, d) => p.filled((q) => q.m(c - 0.8, y).l(c + 0.5, y + 2.6 * d).l(c + 0.9, y).z()),
  twin: (p, c, y, d) => p.m(c, y).q(c + 1.8, y + 1.2 * d, c + 1.4, y + 3 * d).m(c, y).q(c - 1.8, y + 1.2 * d, c - 1.4, y + 3 * d),
  flower: (p, c, y, d) => { p.m(c, y).l(c, y + 2.0 * d); for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2; p.dot(c + Math.sin(a) * 1.2, y + 3.3 * d + Math.cos(a) * 1.2, 0.45); } },
  pod: (p, c, y, d) => p.m(c, y).l(c, y + 1.2 * d).ring(c, y + 2.6 * d, 1.3),
  hook: (p, c, y, d, e) => p.m(c, y).q(c, y + 3.6 * d, c - 1.7 * e, y + 3.0 * d),
  root: (p, c, y) => p.m(c, y).l(c - 1.2, y + 3).m(c, y).l(c + 0.2, y + 3.4).m(c, y).l(c + 1.4, y + 2.6),
  tall: (p, c, y, d) => { p.m(c, y).q(c + 0.8, y + 2.8 * d, c, y + 5.0 * d); p.dot(c - 0.9, y + 3.6 * d, 0.45); },
};
const edena = {
  id: 'edena', name: 'Edenic', world: 'Viridel', ink: '#3b7b45', dir: 'ltr', kind: 'vine', width: 1.0,
  about: 'a vine: a stem waving through each word, something growing off it every two letters: leaves, tendrils, buds, berries, thorns',
  inventory: [
    ['leaf', -1, 1], ['leaf', 1, 1], ['bud', -1, 1], ['leaf', -1, -1], ['curl', -1, 1], ['berries', -1, 1], ['thorn', -1, 1], ['leaf', 1, -1],
    ['twin', -1, 1], ['curl', 1, 1], ['bud', 1, 1], ['hook', -1, 1], ['flower', -1, 1], ['pod', -1, 1], ['curl', -1, -1], ['thorn', 1, 1],
    ['root', 1, 1], ['berries', 1, 1], ['tall', -1, 1], ['hook', 1, -1], ['twin', 1, 1], ['pod', 1, 1], ['curl', 1, -1], ['flower', 1, 1],
  ].map(([form, d, e]) => ({ form, d, e })),
  tokens: (w) => { const out = []; for (let i = 0; i < w.length; i += 2) out.push({ t: w.slice(i, i + 2), from: i, to: Math.min(w.length, i + 2) }); return out; },
  hashed: true,
  draw(p, g, { x0, x1, k, n }) {
    const up = k % 2 ? 1 : -1, xm = (x0 + x1) / 2, ys = 8.2 + up * 0.55;
    p.m(x0, 8.2).q(xm, 8.2 + up * 1.1, x1, 8.2);   // the stem
    if (k === 0) p.dot(x0 + 0.2, 8.2, 0.55);
    SPROUTS[g.form](p, xm, ys, g.d * 1.2, g.e * 1.15);
    if (k === n - 1) p.m(x1, 8.2).q(x1 + 1.1, 8.0, x1 + 0.8, 6.9);   // the tip curls
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2; p.dot(c + Math.sin(a) * 1.4, 8 + Math.cos(a) * 1.4, 0.5); }
    else if (kind === 'pause') SPROUTS.leaf(p, c - 0.4, 10, -1, 1);
    else if (kind === 'ask') SPROUTS.curl(p, c - 1, 10, -1, 1);
    else if (kind === 'exclaim') SPROUTS.tall(p, c, 10, -1);
    else if (kind === 'trail') { p.dot(c - 1.4, 9.4, 0.5); p.dot(c, 9.4, 0.5); p.dot(c + 1.4, 9.4, 0.5); }
    else if (kind === 'dash') p.m(x0, 8.2).q(c, 7.2, x1, 8.2);
    else if (kind === 'quote') SPROUTS.twin(p, c, 5, -1);
  },
};

/** Sphere-song (the Garden of Spheres): round logograms, one a word (a long word is a compound of
 *  two or three, joined), a small particle for the little words. */
const S_OUTER = ['ring', 'double', 'open', 'footed'];
const S_INNER = ['dot', 'ring', 'chord', 'half', 'spokes', 'twin', 'stem', 'spiral'];
function sphereLogo(p, g, c, cy, r, rim) {
  if (g.outer === 'open') p.m(c + r * Math.sin(0.5), cy - r * Math.cos(0.5)).arc(r, 1, 1, c - r * Math.sin(0.5), cy - r * Math.cos(0.5));
  else p.ring(c, cy, r);
  if (g.outer === 'double') p.ring(c, cy, r - 1.05);
  if (g.outer === 'footed') p.m(c - r - 0.6, cy + r + 0.9).l(c + r + 0.6, cy + r + 0.9);
  const k = g.outer === 'double' ? 0.62 : 1;
  if (g.inner === 'dot') p.dot(c, cy, 0.7);
  else if (g.inner === 'ring') p.ring(c, cy, r * 0.42 * k);
  else if (g.inner === 'chord') p.m(c - r * 0.68 * k, cy).l(c + r * 0.68 * k, cy);
  else if (g.inner === 'half') p.filled((q) => q.m(c - r * 0.58 * k, cy).arc(r * 0.58 * k, 0, 0, c + r * 0.58 * k, cy).z());   // half lit, like a moon
  else if (g.inner === 'spokes') for (const a of [0, 2.09, 4.19]) p.m(c, cy).l(c + Math.sin(a) * r * 0.62 * k, cy - Math.cos(a) * r * 0.62 * k);
  else if (g.inner === 'twin') { p.dot(c, cy - r * 0.38 * k, 0.6); p.dot(c, cy + r * 0.38 * k, 0.6); }
  else if (g.inner === 'stem') p.m(c, cy - r * 0.65 * k).l(c, cy + r * 0.65 * k);
  else if (g.inner === 'spiral') p.m(c, cy).q(c + r * 0.55 * k, cy - r * 0.1, c + r * 0.3 * k, cy + r * 0.42 * k).q(c - r * 0.1, cy + r * 0.72 * k, c - r * 0.48 * k, cy + r * 0.1);
  if (rim === 1) p.dot(c, cy - r - 1.0, 0.5);
  else if (rim === 2) p.m(c + r, cy).l(c + r + 1.2, cy - 0.9);
  else if (rim === 3) { p.dot(c - 1.2, cy - r - 0.9, 0.45); p.dot(c, cy - r - 1.4, 0.45); p.dot(c + 1.2, cy - r - 0.9, 0.45); }   // the makers' three dots
}
const spheres = {
  id: 'spheres', name: 'Sphere-song', world: 'the Garden of Spheres', ink: '#2c8288', dir: 'ltr', kind: 'logograms', width: 0.95, spread: true,
  about: 'round logograms, one a word (a long word a compound of two or three), little words a small particle',
  inventory: S_OUTER.flatMap((outer) => S_INNER.map((inner) => ({ outer, inner }))),
  tokens: (w) => {
    const n = w.length < 8 ? 1 : w.length < 14 ? 2 : 3, out = [];
    for (let k = 0; k < n; k++) { const from = Math.floor((k * w.length) / n), to = Math.floor(((k + 1) * w.length) / n); out.push({ t: k ? `${w}#${k}` : w, from, to }); }
    return out;
  },
  hashed: true,
  draw(p, g, { x0, x1, k, n, word }) {
    const c = (x0 + x1) / 2, cy = 6.4;
    if (word.length <= 2) {   // a particle
      if (hash01(`${word}:particle`) < 0.5) p.dot(c, 8.4, 1.0); else { p.ring(c, 8.2, 1.4); p.dot(c, 8.2, 0.45); }
      return;
    }
    const r = Math.max(1.8, Math.min(4.6, (x1 - x0) / 2 - 0.6));
    const h = hash01(`${word}:rim:${k}`), rim = h < 0.6 ? 0 : h < 0.8 ? 1 : h < 0.95 ? 2 : 3;
    sphereLogo(p, g, c, cy, r, rim);
    if (k > 0) p.m(x0 - (x1 - x0) / 2 + r, cy).l(c - r, cy);   // a compound: joined to the one before
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') p.ring(c, 9.2, 0.95);
    else if (kind === 'pause') p.dot(c, 9.3, 0.6);
    else if (kind === 'ask') { p.ring(c, 7.6, 1.6); p.dot(c, 7.6, 0.5); }
    else if (kind === 'exclaim') { p.m(c, 3.6).l(c, 7.4); p.ring(c, 9.4, 0.8); }
    else if (kind === 'trail') { p.dot(c - 1.4, 9.4, 0.5); p.dot(c, 9.4, 0.5); p.dot(c + 1.4, 9.4, 0.5); }
    else if (kind === 'dash') p.m(x0 + 0.4, 6.8).l(x1 - 0.4, 6.8);
    else if (kind === 'quote') p.m(c - 1, 3.4).q(c, 2.2, c + 1, 3.4);
  },
};

/** Lorn burble (Lorn): knots on a cord, a knot a syllable; each word a length of cord, knotted at
 *  its start and frayed at its end. */
const KNOTS = {
  loopUp: (p, c, y, s) => p.m(c - 1.8 * s, y).q(c - 1.6 * s, y - 3.6 * s, c, y - 3.2 * s).q(c + 1.6 * s, y - 2.8 * s, c + 0.4 * s, y - 1.2 * s).q(c - 0.6 * s, y + 0.2 * s, c + 1.8 * s, y),
  loopDn: (p, c, y, s) => p.m(c - 1.8 * s, y).q(c - 1.6 * s, y + 3.6 * s, c, y + 3.2 * s).q(c + 1.6 * s, y + 2.8 * s, c + 0.4 * s, y + 1.2 * s).q(c - 0.6 * s, y - 0.2 * s, c + 1.8 * s, y),
  eight: (p, c, y, s) => p.m(c - 1.6 * s, y).q(c - 1.2 * s, y - 3 * s, c, y).q(c + 1.2 * s, y + 3 * s, c + 1.6 * s, y).q(c + 1.2 * s, y - 3 * s, c, y).q(c - 1.2 * s, y + 3 * s, c - 1.6 * s, y),
  bead: (p, c, y, s) => p.dot(c, y, 1.2 * s),
  beads: (p, c, y, s) => { p.dot(c - 1.1 * s, y, 0.85 * s); p.dot(c + 1.1 * s, y, 0.85 * s); },
  coil: (p, c, y, s) => { p.ring(c - 1.4 * s, y - 0.4, 0.75 * s); p.ring(c, y - 0.4, 0.75 * s); p.ring(c + 1.4 * s, y - 0.4, 0.75 * s); },
  drop: (p, c, y, s) => { p.m(c, y).l(c, y + 2.4 * s); p.filled((q) => q.m(c, y + 2.2 * s).q(c + 1.2 * s, y + 3.6 * s, c, y + 4.0 * s).q(c - 1.2 * s, y + 3.6 * s, c, y + 2.2 * s)); },
  rain: (p, c, y, s) => { for (const dx of [-1.2, 0, 1.2]) { p.m(c + dx * s, y).l(c + dx * s, y + (dx ? 1.6 : 2.4) * s); p.dot(c + dx * s, y + (dx ? 2.2 : 3.0) * s, 0.5); } },   // the Hush: three drops
  ringUp: (p, c, y, s) => p.m(c, y).l(c, y - 2 * s).ring(c, y - 2.9 * s, 0.9 * s),
  cross: (p, c, y, s) => p.m(c - 1.4 * s, y - 1.6 * s).l(c + 1.4 * s, y + 1.6 * s).m(c + 1.4 * s, y - 1.6 * s).l(c - 1.4 * s, y + 1.6 * s),
  wrap: (p, c, y, s) => { for (const dx of [-1, 0, 1]) p.m(c + dx * s - 0.3, y - 1.5 * s).l(c + dx * s + 0.3, y + 1.5 * s); },
  hook: (p, c, y, s) => p.m(c, y).q(c + 2 * s, y - 3 * s, c - 0.4 * s, y - 3.2 * s),
  tassel: (p, c, y, s) => p.m(c, y).l(c - 1 * s, y + 3 * s).m(c, y).l(c, y + 3.3 * s).m(c, y).l(c + 1 * s, y + 3 * s),
  ring: (p, c, y, s) => p.ring(c, y, 1.5 * s),
};
const perdide = {
  id: 'perdide', name: 'Lorn burble', world: 'Lorn', ink: '#6c4a99', dir: 'ltr', kind: 'knots', width: 1.0,
  about: 'knots on a cord, one a syllable: loops, beads, coils, drops of rain; each word a length of cord, knotted at the start, frayed at the end',
  inventory: [
    'bead', 'loopUp', 'loopDn', 'beads', 'drop', 'eight', 'ring', 'coil', 'ringUp', 'cross', 'wrap', 'hook', 'tassel', 'rain',
  ].flatMap((form) => [{ form, s: 1.25 }, { form, s: 0.9 }]),
  tokens: syllables,
  hashed: true,
  draw(p, g, { x0, x1, k, n }) {
    const xm = (x0 + x1) / 2, y = 7.2;
    p.m(x0, y).q(xm, y + 0.8, x1, y);   // the cord
    if (k === 0) p.dot(x0 + 0.3, y, 0.75);
    KNOTS[g.form](p, xm, y + 0.4, g.s);
    if (k === n - 1) p.m(x1 - 0.3, y).l(x1 + 0.9, y - 1.1).m(x1 - 0.3, y).l(x1 + 0.9, y + 1.1);   // frayed
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') KNOTS.drop(p, c, 6.0, 1);
    else if (kind === 'pause') p.dot(c, 9.2, 0.6);
    else if (kind === 'ask') KNOTS.ringUp(p, c, 9.4, 1);
    else if (kind === 'exclaim') { p.m(c, 3).l(c, 8); p.dot(c, 9.6, 0.7); }
    else if (kind === 'trail') KNOTS.rain(p, c, 6.2, 1);
    else if (kind === 'dash') p.m(x0, 7.2).q(c, 8, x1, 7.2);
    else if (kind === 'quote') KNOTS.hook(p, c, 5.6, 0.6);
  },
};

/** The lamp-keepers' hand (Lorn II): lamps hung from a sagging cord, right to left, one a syllable;
 *  lit lamps filled, dark ones hollow. */
const LAMPS = {
  globe: (p, c, y) => p.ring(c, y + 1.4, 1.4),
  drop: (p, c, y) => p.m(c, y).q(c + 1.9, y + 2.4, c, y + 3.0).q(c - 1.9, y + 2.4, c, y),
  cap: (p, c, y) => p.m(c - 1.9, y + 1.6).q(c, y - 0.7, c + 1.9, y + 1.6).l(c - 1.9, y + 1.6).m(c, y + 1.6).l(c, y + 3.0),
  cage: (p, c, y) => p.m(c - 1.2, y).l(c + 1.2, y).l(c + 1.2, y + 2.8).l(c - 1.2, y + 2.8).z(),
  bell: (p, c, y) => p.m(c - 1.6, y + 2.8).q(c - 1.3, y, c, y).q(c + 1.3, y, c + 1.6, y + 2.8).z(),
  bead: (p, c, y) => p.ring(c, y + 1.0, 1.0),
};
const perdide2 = {
  id: 'perdide2', name: 'the lamp-keepers’ hand', world: 'Lorn II', ink: '#a8661c', dir: 'rtl', kind: 'lamps', width: 0.95,
  about: 'lamps hung from a sagging cord, one a syllable, lit ones filled, dark ones hollow; right to left',
  inventory: ['globe', 'bead', 'drop', 'cap', 'bell', 'cage'].flatMap((form) => [[form, 1, 1], [form, 2.6, 0], [form, 1, 0], [form, 2.6, 1]]).map(([form, len, lit]) => ({ form, len, lit })),
  tokens: syllables,
  hashed: true,
  draw(p, g, { x0, x1, k, n }) {
    const xm = (x0 + x1) / 2;
    p.m(x0 - (k ? 0 : 0.6), 3.0).q(xm, 4.9, x1 + (k === n - 1 ? 0.6 : 0), 3.0);   // the cord
    const yt = 3.95 + g.len;
    p.m(xm, 3.95).l(xm, yt);   // the string
    if (g.lit) p.filled((q) => LAMPS[g.form](q, xm, yt)); else LAMPS[g.form](p, xm, yt);
    if (g.form === 'cage' && !g.lit) p.m(xm, yt).l(xm, yt + 2.8);
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') p.dot(c, 9.0, 1.15);
    else if (kind === 'pause') { p.m(x0, 3.0).q(c, 4.9, x1, 3.0); p.dot(c, 3.95, 0.6); }
    else if (kind === 'ask') { p.ring(c, 8.4, 1.5); p.dot(c, 8.4, 0.5); }
    else if (kind === 'exclaim') { p.m(c, 3.2).l(c, 8.4); p.dot(c, 9.4, 0.9); }
    else if (kind === 'trail') { p.dot(c - 1.5, 9.3, 0.6); p.dot(c, 9.3, 0.6); p.dot(c + 1.5, 9.3, 0.6); }
    else if (kind === 'dash') p.m(x0, 3.0).q(c, 4.9, x1, 3.0);
    else if (kind === 'quote') p.m(c - 0.8, 3).q(c + 1, 3.4, c + 0.4, 5);
  },
};

/** Market patter (the Signal Market): a sign-painter's alphabet, bold and angular (flags, aerials,
 *  boxes, gates: the shapes on the market's signs), busy with accents; a name is underlined, as the
 *  market's signs mark the names of things for sale. */
const MKT_BASES = {
  flag: (p, c) => p.m(c - 1.4, 10).l(c - 1.4, 5).l(c + 1.8, 6.3).l(c - 1.4, 7.6),
  boxdot: (p, c) => { p.m(c - 1.7, 5.4).l(c + 1.7, 5.4).l(c + 1.7, 10).l(c - 1.7, 10).z(); p.dot(c, 7.7, 0.6); },
  aerial: (p, c) => p.m(c, 10).l(c, 4.6).m(c - 1.9, 4.6).l(c, 6.6).l(c + 1.9, 4.6),
  diamond: (p, c) => p.m(c, 4.8).l(c + 2, 7.4).l(c, 10).l(c - 2, 7.4).z(),
  stairs: (p, c) => p.m(c - 1.9, 10).l(c - 1.9, 8.4).l(c, 8.4).l(c, 6.6).l(c + 1.9, 6.6).l(c + 1.9, 4.8),
  bulb: (p, c) => p.ring(c, 6.8, 1.6).m(c, 8.4).l(c, 12.4).m(c - 1.2, 11).l(c + 1.2, 11),
  bowtie: (p, c) => p.m(c - 1.8, 5.2).l(c + 1.8, 10).l(c + 1.8, 5.2).l(c - 1.8, 10).z(),
  mast: (p, c) => p.m(c - 0.8, 2.8).l(c - 0.8, 10).m(c - 0.8, 4.6).l(c + 1.9, 4.6).m(c - 0.8, 7.4).l(c + 1.3, 7.4),
  gate: (p, c) => p.m(c - 1.8, 10).l(c - 1.8, 5).l(c + 1.8, 5).l(c + 1.8, 10).m(c, 6.8).l(c, 10),
  pennant: (p, c) => p.m(c + 1.8, 10).l(c - 1.8, 10).l(c + 1.6, 5.4).l(c - 1.2, 5.4),
};
const TALL = new Set(['mast']);
const MKT_MARKS = {
  '': () => {},
  dot: (p, c, t) => p.dot(c, t ? 1.4 : 3.3, 0.6),
  ring: (p, c, t) => p.ring(c + (t ? 1.6 : 0), t ? 1.6 : 3.0, 0.75),
  caret: (p, c, t) => p.m(c - 1, t ? 2.0 : 3.8).l(c, t ? 0.9 : 2.6).l(c + 1, t ? 2.0 : 3.8),
  under: (p, c) => p.dot(c, 12.1, 0.6),
  bar: (p, c, t) => p.m(c - 1.2 + (t ? 1.6 : 0), t ? 1.4 : 3.4).l(c + 1.2 + (t ? 1.6 : 0), t ? 1.4 : 3.4),
};
const bazaar = {
  id: 'bazaar', name: 'Market patter', world: 'the Signal Market', ink: '#ad3a62', dir: 'ltr', kind: 'alphabet', width: 1.25,
  about: 'a sign-painter’s alphabet: bold letters busy with accents, one a letter; a name is underlined, as on the market’s signs',
  inventory: (() => {
    const plain = Object.keys(MKT_BASES).map((base) => ({ base, mark: '' }));
    const marked = seeded(Object.keys(MKT_BASES).flatMap((base) => Object.keys(MKT_MARKS).slice(1).map((mark) => ({ base, mark })))
      .filter((g) => !(g.base === 'bulb' && g.mark === 'under')), 'bazaar').slice(0, 24);
    return [...plain, ...marked];
  })(),
  tokens: (w) => letterTokens(w, ['sh', 'ch']),
  draw(p, g, { c }) {
    MKT_BASES[g.base](p, c);
    MKT_MARKS[g.mark](p, c, TALL.has(g.base));
  },
  under(p, x0, x1) { p.m(x0 + 0.4, 11.9).l(x1 - 0.4, 11.9); },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') p.filled((q) => q.m(c, 8.4).l(c + 1, 9.4).l(c, 10.4).l(c - 1, 9.4).z());
    else if (kind === 'pause') p.m(c - 1.4, 9.6).q(c - 0.7, 8.4, c, 9.4).q(c + 0.7, 10.4, c + 1.4, 9.2);
    else if (kind === 'ask') { p.ring(c, 7.4, 1.8); p.m(c - 1.2, 7.4).l(c + 1.2, 7.4).m(c, 6.2).l(c, 8.6); }
    else if (kind === 'exclaim') p.m(c - 0.8, 3).l(c - 0.8, 10).m(c + 0.8, 3).l(c + 0.8, 10);
    else if (kind === 'trail') for (const dx of [-1.8, 0, 1.8]) p.filled((q) => q.m(c + dx, 8.8).l(c + dx + 0.7, 9.5).l(c + dx, 10.2).l(c + dx - 0.7, 9.5).z());
    else if (kind === 'dash') p.m(x0 + 0.4, 7.4).l(x1 - 0.4, 7.4);
    else if (kind === 'quote') p.m(c - 0.4, 3).l(c - 1.2, 3).l(c - 1.2, 5.4).m(c + 0.4, 3).l(c + 1.2, 3).l(c + 1.2, 5.4);
  },
};

/** Pen-and-paper (the atelier): a shorthand, one unbroken pencil stroke a word, a stroke a
 *  syllable (flat, rising, falling, humped, looped…), its vowel a dot or a dash beside it. */
const SHORT = ['hump', 'rise', 'dip', 'fall', 'loop', 'zig', 'hook', 'flat'];
const atelier = {
  id: 'atelier', name: 'pen-and-paper', world: 'the atelier', ink: '#4d4743', dir: 'ltr', kind: 'shorthand', width: 0.9,
  about: 'a shorthand: one unbroken pencil stroke a word, a stroke a syllable, its vowel a dot or a dash beside it',
  inventory: SHORT.flatMap((form) => ['', 'dot', 'dash'].map((mark) => ({ form, mark }))),
  tokens: syllables,
  hashed: true,
  draw(p, g, { x0, x1, k, toks }) {
    // the pen's height where this stroke starts: where the one before it ended (a stroke a word)
    let y = 7.6;
    for (let j = 0; j < k; j++) y = shortEnd(this.inventory[this.pick(toks[j].t)].form, y);
    const form = g.form, xm = (x0 + x1) / 2, y2 = shortEnd(form, y);
    p.m(x0, y);
    if (form === 'flat' || form === 'rise' || form === 'fall') p.l(x1, y2);
    else if (form === 'hump') p.q(xm, y - 5.4, x1, y);
    else if (form === 'dip') p.q(xm, y + 5, x1, y);
    else if (form === 'loop') p.l(xm - 0.4, y).q(xm + 1.6, y - 3, xm, y - 2.6).q(xm - 1.4, y - 2, xm + 0.6, y).l(x1, y);
    else if (form === 'hook') p.l(x1 - 1.2, y).q(x1, y, x1, y2);
    else if (form === 'zig') p.l(xm, y - 3.2).l(x1, y);
    if (g.mark === 'dot') p.dot(xm, Math.min(y, y2) - 2.2, 0.5);
    if (g.mark === 'dash') p.m(xm - 0.6, Math.max(y, y2) + 1.9).l(xm + 0.6, Math.max(y, y2) + 2.3);
  },
  punct(p, kind, x0, x1) {
    const c = (x0 + x1) / 2;
    if (kind === 'stop') p.m(c - 0.9, 8.4).l(c + 0.9, 10.2).m(c + 0.9, 8.4).l(c - 0.9, 10.2);
    else if (kind === 'pause') p.m(c - 0.8, 9.6).l(c + 0.8, 9.2);
    else if (kind === 'ask') p.m(c - 1, 6).q(c + 1.8, 5, c, 8.2);
    else if (kind === 'exclaim') { p.m(c, 4).l(c, 8); p.dot(c, 9.8, 0.5); }
    else if (kind === 'trail') { p.dot(c - 1.3, 9.6, 0.45); p.dot(c, 9.6, 0.45); p.dot(c + 1.3, 9.6, 0.45); }
    else if (kind === 'dash') p.m(x0, 8).l(x1, 8);
  },
};
/** Where a shorthand stroke leaves the pen (kept between 3.8 and 11.4: a stroke that would leave them goes the other way). */
function shortEnd(form, y) {
  const d = form === 'rise' ? -3.4 : form === 'fall' ? 3.4 : form === 'hook' ? -2.2 : 0;
  const y2 = y + d;
  return y2 < 3.8 || y2 > 11.4 ? y - d : y2;
}

export const SCRIPTS = Object.fromEntries([desert, incal, arzach, arzach2, garage, buried, edena, spheres, perdide, perdide2, bazaar, atelier].map((S) => {
  S.cipher = makeCipher(S, S.order);
  S.pick = makePick(S);
  return [S.id, S];
}));

/** The script a tongue is written in; null for those that need no translation (home speech, the ship). */
export function scriptOf(lang) {
  if (LANGUAGES[lang]?.native) return null;
  return SCRIPTS[lang] ?? SCRIPTS.desert;
}

// ------------------------------------------------------------------ lines into chunks
const LETTER = /[\p{L}\p{N}]/u;

/**
 * Where a line is written in the script: each run of non-blank characters outside the markup
 * (`*` around a highlight, `{glyph}` motifs). [{ from, to, text, proper, space }]: `proper`, it
 * starts with a capital mid-sentence (a name); `space`, a blank follows it.
 */
export function lineChunks(text) {
  const out = [], s = String(text);
  let i = 0, start = -1;
  const close = (end) => { if (start >= 0) out.push({ from: start, to: end, text: s.slice(start, end) }); start = -1; };
  while (i < s.length) {
    const c = s[i];
    const motif = c === '{' && /^\{\w*\}/.exec(s.slice(i));
    if (motif) { close(i); i += motif[0].length; continue; }
    if (c === '*' || /\s/.test(c)) { close(i); i++; continue; }
    if (start < 0) start = i;
    i++;
  }
  close(s.length);
  for (const ch of out) {
    const before = s.slice(0, ch.from).replace(/[\s*]+$/, '');
    const first = ch.text.match(/[\p{L}]/u)?.[0];
    ch.proper = !!first && first !== first.toLowerCase() && before.length > 0 && !/[.!?…:“"‘(]$/.test(before) && ch.text.match(/[\p{L}]+/u)[0].length > 1;
    ch.space = /^\s/.test(s.slice(ch.to, ch.to + 1));
  }
  return out;
}

// ------------------------------------------------------------------ writing
/**
 * A chunk in a script: { d, f, glyphs: [{ id, from }], width }. o.shown: how many of its characters
 * have been said (the glyphs of the later ones are not written yet); o.proper, o.space (lineChunks).
 */
export function writeChunk(text, lang, { shown = Infinity, proper = false, space = false } = {}) {
  const S = typeof lang === 'string' ? scriptOf(lang) : lang;
  const W = [...text].length * CH;
  const out = { d: '', f: '', glyphs: [], width: W };
  if (!S) return out;
  const pen = new Pen({ mirror: S.dir === 'rtl' ? W : 0, slant: S.slant ?? 0 });
  const chars = [...text];
  // runs: words (letters, with apostrophes inside) and the punctuation between them
  let i = 0, any = false;
  while (i < chars.length) {
    if (LETTER.test(chars[i])) {
      let j = i;
      while (j < chars.length && (LETTER.test(chars[j]) || (/['’]/.test(chars[j]) && LETTER.test(chars[j + 1] ?? '')))) j++;
      const at = [], word = [];
      for (let k = i; k < j; k++) if (LETTER.test(chars[k])) { at.push(k); word.push(chars[k].toLowerCase()); }
      writeWord(S, pen, word.join(''), at, shown, out);
      if (proper && S.under && !any && i < shown) S.under(pen, i * CH, Math.min(j, shown) * CH);
      any = true;
      i = j;
    } else {
      const kind = PUNCT[chars[i]];
      if (kind && i < shown) S.punct(pen, kind, i * CH, (i + 1) * CH);
      i++;
    }
  }
  if (space && S.after && shown >= chars.length && LETTER.test(chars[chars.length - 1])) S.after(pen, W);
  out.d = pen.s; out.f = pen.f;
  return out;
}

/** A word's glyphs into the pen: `at[k]` is the chunk position of its k-th letter. */
function writeWord(S, pen, word, at, shown, out) {
  const toks = S.tokens(word);
  const n = toks.length, x0 = at[0] * CH, x1 = (at[at.length - 1] + 1) * CH;
  toks.forEach((tok, k) => {
    const from = at[tok.from];
    if (from >= shown) return;
    let id = S.id_?.(tok, word);
    if (id == null) id = S.hashed ? S.pick(tok.t) : S.cipher(tok.t);
    const slot = S.spread
      ? { x0: x0 + ((x1 - x0) * k) / n, x1: x0 + ((x1 - x0) * (k + 1)) / n }
      : { x0: at[tok.from] * CH, x1: (at[tok.to - 1] + 1) * CH };
    slot.c = (slot.x0 + slot.x1) / 2;
    S.draw(pen, S.inventory[id], { ...slot, k, n, tok, toks, word });
    out.glyphs.push({ id, from });
  });
}

/** The markup: `len` letters wide (1ch each), 1.2em tall, its baseline on the text's. */
function svgOf(w, S, len, style = '') {
  return `<svg class="tg" aria-hidden="true" viewBox="0 0.5 ${w.width} 12" preserveAspectRatio="none" style="width:${len}ch;height:1.2em;vertical-align:-0.25em;overflow:visible;color:${S?.ink ?? 'inherit'}${style ? `;${style}` : ''}">`
    + (w.d ? `<path d="${w.d}" fill="none" stroke="currentColor" stroke-width="${S.width}" stroke-linecap="${S.cap ?? 'round'}" stroke-linejoin="round"/>` : '')
    + (w.f ? `<path d="${w.f}" fill="currentColor"/>` : '') + '</svg>';
}

/** One glyph of a script's inventory on its own, two letters wide (one for the letter scripts): the test page. */
export function glyphSvg(lang, id) {
  const S = SCRIPTS[lang], g = S.inventory[id], cells = S.spread || S.hashed || S.kind === 'abugida' ? 2 : 1;
  const W = cells * CH, pen = new Pen({ slant: S.slant ?? 0 });
  const slot = { x0: 0, x1: W, c: W / 2, k: 0, n: 2, tok: { t: 'ka', from: 0, to: 2 }, toks: [{ t: '' }], word: 'sample' };
  if (S.sample) S.sample(pen, g, slot); else S.draw(pen, g, slot);
  return svgOf({ d: pen.s, f: pen.f, width: W }, S, cells);
}

const CACHE = new Map();
/**
 * A chunk as an inline <svg>, as wide as its letters in the panel's monospaced font (its ink and
 * stroke inline, so it needs no stylesheet). o.style: more inline style (the translator's fade).
 */
export function chunkSvg(text, lang, o = {}) {
  const S = scriptOf(lang);
  const len = [...text].length, shown = Math.min(o.shown ?? Infinity, len);
  const key = `${lang}|${text}|${shown}|${o.proper ? 1 : 0}${o.space ? 1 : 0}|${o.style ?? ''}`;
  let svg = CACHE.get(key);
  if (svg) return svg;
  const w = writeChunk(text, S, { ...o, shown });
  svg = svgOf(w, S, len, o.style);
  if (CACHE.size > 600) CACHE.clear();
  CACHE.set(key, svg);
  return svg;
}

/** A whole line written in a script, as HTML (the test page, tools/tongues.html). Markup is dropped. */
export function lineSvg(text, lang) {
  const s = String(text);
  let html = '', at = 0;
  for (const ch of lineChunks(s)) {
    html += s.slice(at, ch.from).replace(/\{\w*\}|\*/g, '').replace(/[&<>]/g, '') + chunkSvg(ch.text, lang, ch);
    at = ch.to;
  }
  return html + s.slice(at).replace(/\{\w*\}|\*/g, '');
}
