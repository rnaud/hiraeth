import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { irisFor } from './eyes.js';
import { FACE_TYPES, FACE_ODDS } from './morph.js';
import { REST_MOODS, REST_ODDS, restMood } from './expression.js';

// What the people of each world wear. One table per world (keyed by level id),
// each with one or more tribes (the City-Shaft's rim and its depths dress
// apart). A tribe says which headwear, masks, shoulder pieces, held props,
// robes, capes, cloth patterns, skins and colours its people choose from, and
// how the story's generic heads ('hood', 'hat', 'wrap', 'hair') translate into
// that world's style, so a named person keeps their colours but dresses like
// their neighbours.
//
// dressFor() turns that into one person's look (a plain object: colours plus
// the ids of the pieces worn). The same look dresses a full NPC (npc.js,
// humanoid.js: every piece merged into one skinned mesh) and a GPU crowd
// figure (crowd.js, crowd-shader.js: every piece of the world baked into the
// instanced figure, the shader keeps the ones each person wears), so a crowd
// person promoted to a full body keeps their look.
//
// The pieces are built here once, in three local frames:
//   head  the skull centre (the Humanoid's head anchor): +z the face, +y up
//   chest the Humanoid's chest anchor: the collar ring at y 0.74, shoulders at ±0.19
//   hand  the right wrist, the arm hanging down (-y), +z forward
// and placed in figure space for the crowd by CROWD_FRAMES.

// ------------------------------------------------------------------ ids (shared with crowd-shader.js)
export const HEAD_IDS = ['hood', 'hat', 'wrap', 'hair', 'wizard', 'short', 'tail', 'headcloth', 'sunhat', 'tophat', 'spire', 'raghood',
  'cowl', 'antenna', 'padded', 'flowers', 'orb', 'lamphat', 'reeds', 'turban', 'fez', 'cap', 'band', 'beret', 'long', 'bun',
  // hairstyles on the skull's own shape (scalp(): a hairline, not a bowl); each tribe has its own (tribe.hair)
  'crop', 'shaved', 'bald', 'curls', 'braid', 'flow', 'locks', 'crest', 'bob', 'twin', 'swept', 'tonsure',
  // more headwear (stage 3: docs/makehuman.md); appended, so the crowd's ids above keep their numbers
  'brim', 'straw', 'trilby', 'bowler', 'peak', 'flatcap', 'beanie', 'trapper', 'aviator', 'bandana', 'kerchief', 'skullcap', 'circlet', 'helmet', 'hooddown',
  // the desert: a cap worn over a braid (Sefa's sheet)
  'braidcap'];
/** How many head ids the crowd shader can tell apart (crowd-shader.js: aDress.x = id + HEAD_ID_LIMIT * hair cap). */
export const HEAD_ID_LIMIT = 64;
/** The bare-headed styles (no headwear): the studio's hair list, what tribes pick from (tribe.hair). */
export const HAIR_IDS = ['short', 'hair', 'tail', 'long', 'bun', 'crop', 'shaved', 'bald', 'curls', 'braid', 'flow', 'locks', 'crest', 'bob', 'twin', 'swept', 'tonsure'];
/** The story's generic bare heads: each tribe draws its own hairstyle for them (tribe.hair). */
export const GENERIC_HAIR = ['hair', 'short'];
export const MASK_IDS = ['none', 'veil', 'beak', 'breather', 'goggles', 'browgoggles', 'beard', 'glasses', 'shades', 'scarfmask', 'facewrap', 'monocle'];
export const BODY_IDS = ['none', 'collar', 'scarf', 'pauldrons', 'mantle', 'reedcape', 'garland', 'badge', 'toolbelt', 'ruff', 'tatters', 'neckerchief', 'muffler', 'neckgoggles',
  // the desert's own, from its character sheets: a bag worn over the coat, a keeper's bead fringe and her keys
  'satchel', 'fringe', 'keys',
  // and the rest of what the sheets draw: Nour's clay gourds and keys at her belt, Marrow's salvage bag with his scarf
  'gourds', 'scavbag'];
/** How many mask and shoulder-piece ids the crowd shader can tell apart (packDress: mask + MASK_ID_LIMIT * piece + MASK_ID_LIMIT * BODY_ID_LIMIT * prop). */
export const MASK_ID_LIMIT = 16;
export const BODY_ID_LIMIT = 32;
export const PROP_IDS = ['none', 'staff', 'lantern', 'basket', 'wrench', 'parasol', 'lamppole', 'bell', 'flower',
  // the desert's own: Bako's reed flute, Sefa's lute, Marrow's salvage hook, the Speaker's bell on a staff
  'ney', 'oud', 'hook', 'bellstaff',
  // Nour's staff, a pierced sun disc at its head
  'discstaff'];
/** Cloth patterns printed on the tunic (materials.js outfitTrim, the crowd's fragment hook). */
export const TRIM_IDS = ['none', 'stripes', 'sash', 'yoke', 'bib', 'diamonds', 'patches', 'dots', 'hem'];
/** Fixed colours of the material roles that aren't the person's own. */
export const FIXED = { dark: '#2b211f', metal: '#a9a493', wood: '#8a6040', lamp: '#ffd98a', clay: '#b5562f', linen: '#c2b59b', canvas: '#d9bc8c' };

// ------------------------------------------------------------------ the worlds
// weights: { id: weight }; lists of colours; [min, max] ranges; robe: hem heights above the ground (m)
const DEFAULT = {
  name: 'travellers',
  heads: { hood: 1, hat: 2, wrap: 1, hair: 2 }, as: {},
  // the hairstyles of a bare head ('hair' / 'short' above, or a story person's): men's and women's
  hair: { m: { short: 2, crop: 2, hair: 1 }, f: { long: 4.5, bun: 3.5, tail: 2 } },
  masks: { none: 1 }, body: { none: 1 }, props: { none: 1 }, trim: { none: 1 },
  capes: [0, 0.5, 0.9, 1.2, 1.4], wide: [1, 1], robe: 0, robes: [0.4], flare: [0.28, 0.32], size: [0.95, 1.05],
  // their faces (dressFor: s.face, s.rest): the shapes (morph.js FACE_TYPES) and the moods at rest (expression.js REST_MOODS)
  faces: FACE_ODDS, moods: REST_ODDS,
  palette: {
    cloaks: ['#c8483a', '#5fb7ad', '#d8a24a', '#8a6fb8', '#e6875f', '#f3ead8', '#62c3c9', '#e88fa6', '#697a98', '#dca273', '#84bab3', '#c3a9cc'],
    tunics: ['#343a56', '#5a4a3a', '#3f6f6a', '#6a3a4a', '#e2d3b4', '#4a5a3a'],
    legs: ['#2b2f45', '#4a3a2a', '#2f3f3a', '#5a4a40', '#3a3a3a'],
    skins: ['#e9cfb4', '#d9a98a', '#b07a5a', '#f1dccb', '#8a5a40'],
    hair: ['#2b211f', '#4a3226', '#6e4a32', '#b0a89a', '#a8552e', '#e8dcc0'],
    hats: ['#d8a24a', '#e6875f', '#f3ead8', '#62c3c9', '#a99be0'],
  },
};

const tribe = (o) => ({ ...DEFAULT, ...o, palette: { ...DEFAULT.palette, ...o.palette } });

export const COSTUMES = {
  desert: { tribes: [tribe({
    name: 'pilgrims of the dunes',
    faces: { plain: 4, round: 2, long: 1.5, elder: 1.5 },
    heads: { headcloth: 4, sunhat: 3, wrap: 2, hair: 1 }, headsF: { headcloth: 4, wrap: 2.5, sunhat: 1.5, hair: 1.8 }, as: { hood: 'headcloth', hat: 'sunhat', wrap: 'wrap' },
    // close crops and tight curls, the women's hair braided or down
    hair: { m: { crop: 3, curls: 2.5, shaved: 1.5 }, f: { braid: 3, flow: 2, bun: 1.5, curls: 1 } },
    masks: { none: 5, veil: 2 }, body: { mantle: 2, none: 3 }, props: { none: 6, staff: 2, basket: 1 }, trim: { sash: 3, none: 2, stripes: 1 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { straw: 1.68 }, headsF: { kerchief: 1.23, straw: 1.02 }, masks: { facewrap: 1.1, scarfmask: 0.5, glasses: 0.25 }, body: { neckerchief: 0.6 } },
    capes: [0, 0, 0.9, 1.25, 1.45], wide: [1, 1.25], robe: 0.85, robes: [0.1, 0.22, 0.38], flare: [0.3, 0.4], size: [0.95, 1.06],
    palette: {
      cloaks: ['#c8483a', '#b5562f', '#d8a24a', '#e6c48a', '#3b4f8a', '#2f437a', '#e6875f', '#f3ead8', '#a8552e', '#8a6fb8'],
      tunics: ['#e2d3b4', '#f3ead8', '#d9bf8f', '#5a4a3a', '#3b4f8a', '#7a4a35'],
      legs: ['#5a4a40', '#4a3a2a', '#2b2f45', '#7a5a40'],
      skins: ['#c58c64', '#a8714c', '#8a5a40', '#d9a98a', '#6e4630'],
      hair: ['#2b211f', '#3a2a22', '#e8dcc0', '#4a3226'],
      hats: ['#e6c48a', '#d8a24a', '#f3ead8', '#c9a86a'],
      accents: ['#3b4f8a', '#c8483a', '#2f437a', '#a8552e', '#5fb7ad'],
    },
  })] },
  incal: { tribes: [
    tribe({
      name: 'the rim', when: (c) => zoneIncal(c) === 'rim' || zoneIncal(c) === 'upper',
      moods: { amused: 3, curious: 2.5, kind: 2.5, calm: 1, stern: 0.6 },
      heads: { tophat: 4, spire: 3, hair: 1.5 }, headsF: { spire: 3, tophat: 2, hair: 2.5 }, as: { hat: 'tophat', hood: 'spire', wrap: 'spire' },
      // the rim's fashion: swept back, bobbed, pinned up
      hair: { m: { swept: 3, short: 1.5 }, f: { bob: 3, bun: 2.5 } },
      masks: { none: 1 }, body: { collar: 5, none: 1 }, props: { none: 5, parasol: 2 }, trim: { yoke: 1 },
      // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
      more: { heads: { bowler: 1.5, trilby: 1 }, headsF: { bowler: 0.8 }, masks: { glasses: 0.13, monocle: 0.07 }, body: { muffler: 0.5 } },
      capes: [0, 0, 0.55, 0.9], wide: [0.9, 1], robe: 0.5, robes: [0.45], flare: [0.24, 0.26], size: [1.0, 1.08],
      palette: {
        cloaks: ['#e88fa6', '#a99be0', '#9fd6c9', '#f2c5b0', '#f3ead8', '#b9d4f0'],
        tunics: ['#f3ead8', '#f2d7e0', '#d9e8f2', '#e6dcf5', '#f7e9c8'],
        legs: ['#34405e', '#5a5f80', '#7a6a8a'],
        skins: ['#f1dccb', '#e9cfb4', '#f5e3d6', '#d9a98a'],
        hair: ['#2b211f', '#e8dcc0', '#b0a89a', '#8a5638'],
        hats: ['#34405e', '#e88fa6', '#a99be0', '#f3ead8', '#5fb7ad'],
        accents: ['#f2c54b', '#34405e', '#e88fa6', '#62c3c9'],
      },
    }),
    tribe({
      name: 'the middle levels', when: (c) => zoneIncal(c) === 'middle',
      heads: { hood: 3, raghood: 1, hair: 1.2 }, as: { hat: 'hood', wrap: 'hood' },
      hair: { m: { short: 2, crop: 2 }, f: { tail: 2.5, bun: 1.5 } },
      masks: { none: 3, browgoggles: 2 }, body: { none: 2, tatters: 1 }, props: { none: 5, lantern: 1 }, trim: { none: 1, patches: 1 },
      // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
      more: { heads: { peak: 1.6, beanie: 1.2, hooddown: 1 }, masks: { goggles: 0.8, glasses: 0.6 }, body: { muffler: 0.8, neckgoggles: 0.6 } },
      capes: [0.55, 0.9, 1.25], robe: 0.4, robes: [0.35], flare: [0.27, 0.3], size: [0.93, 1.02],
      palette: {
        cloaks: ['#8a7a66', '#697a98', '#b0705a', '#84bab3', '#a88a6a'],
        tunics: ['#5a4a3a', '#4a5a3a', '#6a5a4a', '#3f4f5a'],
        legs: ['#3a3a3a', '#4a3a2a', '#2f3f3a'],
        skins: ['#e9cfb4', '#d9a98a', '#b07a5a', '#8a5a40'],
        hats: ['#8a7a66', '#5a4a3a', '#b0a89a'],
        accents: ['#b0705a', '#84bab3', '#c9a86a'],
      },
    }),
    tribe({
      name: 'the bottom of the shaft',
      faces: { plain: 4, round: 1, long: 2, elder: 1.5 }, moods: { kind: 3, calm: 3, curious: 1.5, amused: 1, stern: 1 },
      heads: { raghood: 5, hood: 2, hair: 1 }, as: { hood: 'raghood', hat: 'raghood', wrap: 'raghood' },
      // the bottom of the shaft: shaved for the lice, or tied back out of the way
      hair: { m: { shaved: 2.5, crop: 1.5, bald: 1 }, f: { tail: 2, shaved: 1 } },
      masks: { goggles: 3, browgoggles: 2, none: 2 }, body: { tatters: 3, none: 2 }, props: { none: 5, lantern: 1 }, trim: { patches: 3, none: 1 },
      // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
      more: { heads: { beanie: 1.5, trapper: 1, bandana: 1 }, masks: { scarfmask: 1.2 }, body: { muffler: 1, neckgoggles: 0.8 } },
      capes: [0.9, 1.25, 1.45], wide: [1, 1.15], robe: 0.5, robes: [0.3, 0.45], flare: [0.28, 0.33], size: [0.88, 0.98],
      palette: {
        cloaks: ['#6e6450', '#5a5248', '#7a6a58', '#4f5a52', '#8a7660'],
        tunics: ['#4a4238', '#3f4440', '#5a4a3a', '#6a5e4e'],
        legs: ['#2f2b26', '#3a3a3a', '#4a3a2a'],
        skins: ['#d9b9a0', '#b07a5a', '#8a5a40', '#c9b5a0'],
        hair: ['#2b211f', '#4a3226', '#b0a89a'],
        hats: ['#6e6450', '#5a5248', '#7a6a58'],
        accents: ['#b0705a', '#8a8f6a', '#c9a86a'],
      },
    }),
  ] },
  arzach: { tribes: [tribe({
    name: 'the silent ones',
    moods: { calm: 4, kind: 3, curious: 1.5, amused: 0.5, stern: 0.6 },
    heads: { cowl: 6, hood: 1 }, as: { hood: 'cowl', hat: 'cowl', wrap: 'cowl', hair: 'cowl' },
    hair: { m: { shaved: 1 }, f: { shaved: 1 } },
    masks: { beak: 4, none: 1 }, body: { scarf: 4, none: 1 }, props: { staff: 2, none: 2 }, trim: { none: 1 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { hooddown: 0.6 }, body: { muffler: 1 } },
    capes: [1.25, 1.45], wide: [1, 1.15], robe: 1, robes: [0.06, 0.14], flare: [0.32, 0.4], size: [1.04, 1.12],
    palette: {
      cloaks: ['#f4efe2', '#ece4d2', '#e8dfcb', '#d8c7a6'],
      tunics: ['#e8dfcb', '#d8c7a6', '#cbbd9f', '#f4efe2'],
      legs: ['#8a7a66', '#a8977c'],
      skins: ['#efe2d2', '#e5d2bd', '#d9c4ae'],
      hair: ['#e8dcc0', '#b0a89a'],
      hats: ['#fbf8f0', '#efe7d6'],
      accents: ['#c8483a', '#b0705a', '#8a7a66', '#c8483a'],
    },
  })] },
  arzach2: { tribes: [tribe({
    name: 'the bell monastery',
    faces: { plain: 3, long: 2, round: 1.5, elder: 2 }, moods: { kind: 3, calm: 3, curious: 1, amused: 1, stern: 1 },
    heads: { cowl: 3, short: 1.4, hood: 1 }, as: { hood: 'cowl', hat: 'cowl', wrap: 'cowl', hair: 'short' },
    // the bell monastery: tonsures and shaved heads, the sisters' hair in one braid
    hair: { m: { tonsure: 3, shaved: 1.5, bald: 1 }, f: { braid: 2, shaved: 1 } },
    masks: { none: 1 }, body: { scarf: 3, none: 1 }, props: { bell: 2, staff: 1, none: 2 }, trim: { hem: 2, none: 1 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { skullcap: 1.2 }, headsF: { kerchief: 1.62 }, masks: { glasses: 0.12 } },
    capes: [0, 0.55, 1.45], robe: 1, robes: [0.08, 0.16], flare: [0.34, 0.42], size: [0.98, 1.06],
    palette: {
      cloaks: ['#f3ead8', '#e9d7b0', '#d8c7a6', '#b9a7d8'],
      tunics: ['#6a3a4a', '#8a4a3a', '#4a3a5a', '#7a3a3a'],
      legs: ['#4a3a2a', '#3a2f2a'],
      skins: ['#e9cfb4', '#d9a98a', '#c58c64'],
      hair: ['#e8dcc0', '#6e4a32', '#2b211f'],
      hats: ['#f3ead8', '#9fc3c4'],
      accents: ['#9fc3c4', '#e9a17f', '#f2c54b'],
    },
  })] },
  garage: { tribes: [tribe({
    name: 'the Major’s mechanics',
    moods: { amused: 3.5, kind: 3, curious: 2, calm: 0.5, stern: 0.6 },
    heads: { antenna: 5, hair: 1.3 }, as: { hat: 'antenna', hood: 'antenna', wrap: 'antenna' },
    // the mechanics: crests, swept quiffs, two buns
    hair: { m: { crest: 3, swept: 2 }, f: { twin: 3, crest: 1 } },
    masks: { goggles: 2, browgoggles: 1, none: 3 }, body: { toolbelt: 4, pauldrons: 2 }, props: { wrench: 3, none: 3 }, trim: { bib: 1 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { aviator: 2, peak: 1.5, bandana: 1 }, masks: { glasses: 0.5, monocle: 0.3 }, body: { neckerchief: 1, neckgoggles: 1 } },
    capes: [0, 0, 0, 0.55], robe: 0, size: [0.86, 0.97], bulk: 1,
    palette: {
      cloaks: ['#e63b2e', '#2f6fd6', '#f2c54b', '#3f8f8a'],
      tunics: ['#f3ead8', '#e8e2d0', '#c9d4e0'],
      legs: ['#2f6fd6', '#e63b2e', '#f2c54b', '#34405e'],
      skins: ['#9fb0c4', '#a8b8c8', '#8fa0b8', '#b4c0cc'],
      hair: ['#2b211f', '#e8dcc0', '#a8552e', '#5a6a8a'],
      hats: ['#f2c54b', '#e63b2e', '#2f6fd6', '#f3ead8'],
      accents: ['#2f6fd6', '#e63b2e', '#f2c54b'],
    },
  })] },
  buried: { tribes: [tribe({
    name: 'the dome people',
    moods: { curious: 3.5, kind: 3, amused: 1.5, calm: 1, stern: 0.3 },
    heads: { padded: 5, hood: 1 }, as: { hood: 'padded', hat: 'padded', wrap: 'padded' },
    hair: { m: { crop: 3, curls: 2 }, f: { bun: 3, curls: 1.5 } },
    masks: { breather: 4, goggles: 1, none: 1 }, body: { pauldrons: 3, none: 2 }, props: { none: 4, lantern: 1 }, trim: { stripes: 2, none: 1 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { helmet: 2, beanie: 1.2, trapper: 1 }, masks: { scarfmask: 0.8 }, body: { muffler: 1 } },
    capes: [0, 0.6, 0.9, 1.2], robe: 0, size: [0.94, 1.02], bulk: 2,
    palette: {
      cloaks: ['#c8643f', '#a8502a', '#2f5a5e', '#5f7488', '#7f93a3'],
      tunics: ['#5f7488', '#2f5a5e', '#c8643f', '#8a5a3c'],
      legs: ['#3a3a3a', '#4a3a2a', '#2f3f3a'],
      skins: ['#e8c3a0', '#d9a98a', '#c58c64', '#f1dccb'],
      hair: ['#2b211f', '#3d2a22', '#e8dcc0'],
      hats: ['#c9d4b8', '#e9dcc0', '#c8643f', '#5f7488'],
      accents: ['#3a8f8a', '#c8643f', '#e9dcc0'],
    },
  })] },
  edena: { tribes: [tribe({
    name: 'the gardeners',
    faces: { plain: 3, round: 3, long: 1, elder: 1 }, moods: { kind: 4.5, amused: 2.5, curious: 1.5, calm: 1.5, stern: 0 },
    heads: { flowers: 5, hair: 2 }, as: { hood: 'flowers', hat: 'flowers', wrap: 'flowers' },
    // the gardeners wear it long and loose
    hair: { m: { long: 2.5, curls: 2, tail: 1.5 }, f: { flow: 4, curls: 1.5, braid: 1.5 } },
    masks: { none: 1 }, body: { garland: 3, none: 2 }, props: { flower: 1, basket: 1, none: 3 }, trim: { hem: 1, none: 2 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { straw: 1.5, circlet: 1, brim: 0.6 }, body: { neckerchief: 0.6 } },
    capes: [0, 0, 0.5, 0.9], robe: 0.7, robes: [0.36, 0.5], flare: [0.26, 0.32], size: [1.0, 1.06], sleeveless: true,
    palette: {
      cloaks: ['#f7f4ec', '#9fd6c9', '#f2a7b5', '#b5a7e6', '#7fcfa8', '#f6efd0'],
      tunics: ['#f7f4ec', '#fdfaf3', '#f6e9f0', '#e8f4ef'],
      legs: ['#f7f4ec', '#d9e8e2', '#e6dcf5'],
      skins: ['#f1e4dc', '#e9d6c8', '#f5e8de', '#dcc2ae'],
      hair: ['#e8dcc0', '#2b211f', '#c9a86a', '#6e4a32'],
      hats: ['#f2a7b5', '#f2c54b', '#b5a7e6', '#f7f4ec'],
      accents: ['#7fcfa8', '#f2c54b', '#9fd6c9'],
    },
  })] },
  spheres: { tribes: [tribe({
    name: 'the listeners',
    moods: { calm: 3, curious: 3, kind: 3, amused: 0.5, stern: 0.3 },
    heads: { orb: 6, hair: 1.4 }, as: { hood: 'orb', hat: 'orb', wrap: 'orb' },
    // the listeners: bare heads (their ears clear) and buns
    hair: { m: { bald: 2, swept: 1.5 }, f: { twin: 2.5, bun: 2 } },
    masks: { none: 1 }, body: { ruff: 2, none: 3 }, props: { parasol: 2, none: 4 }, trim: { dots: 2, none: 1 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { circlet: 1.2, skullcap: 0.8, bowler: 0.5 }, masks: { glasses: 0.1 } },
    capes: [0, 0.9, 1.3], robe: 1, robes: [0.07, 0.14], flare: [0.38, 0.46], size: [0.96, 1.04],
    palette: {
      cloaks: ['#f6efd0', '#f3efe2', '#f3e3a0', '#e8d890', '#f2c5b0', '#b7c46a'],
      tunics: ['#f6efd0', '#f3e3a0', '#efe6c0', '#fff6dc'],
      legs: ['#a9c9c4', '#7f9a90', '#c9b88a'],
      skins: ['#e8c9a8', '#d9b08a', '#f1dccb', '#c58c64'],
      hair: ['#3d2a22', '#e8dcc0', '#6e4a32'],
      hats: ['#f3e3a0', '#f6efd0', '#e8c860', '#a9c9c4'],
      accents: ['#a9c9c4', '#e8c860', '#d98f5a'],
    },
  })] },
  perdide: { tribes: [tribe({
    name: 'the swamp people',
    faces: { plain: 3, round: 2, long: 1, elder: 2 }, moods: { amused: 3, kind: 3, curious: 1.5, calm: 1, stern: 0.5 },
    heads: { reeds: 4, hood: 1, hair: 1.3 }, as: { hat: 'reeds', wrap: 'reeds', hood: 'reeds' },
    // the swamp people: locks and braids
    hair: { m: { locks: 3, shaved: 1 }, f: { locks: 2, braid: 2.5 } },
    masks: { none: 1 }, body: { reedcape: 5, none: 1 }, props: { staff: 1, lantern: 1, none: 3 }, trim: { none: 1 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { brim: 1.2, hooddown: 1, bandana: 0.8 }, body: { neckerchief: 0.6 } },
    capes: [0, 0.9, 1.45], robe: 0.4, robes: [0.3], flare: [0.28, 0.33], size: [0.95, 1.04],
    palette: {
      cloaks: ['#8a6fb8', '#6f5a9a', '#4a6a4a', '#5a7a4a', '#7a6a9a'],
      tunics: ['#4a4566', '#3f5a4a', '#5a6a3a', '#3a3f5a'],
      legs: ['#2f3a4f', '#2f3a3a', '#3a3f2f'],
      skins: ['#cdbde6', '#c4b4e0', '#d6c8ec', '#b8a8d8'],
      hair: ['#2b211f', '#d8d0ea', '#4a3a5a'],
      hats: ['#8f9a5a', '#7a8a4a', '#a8a070', '#6f7a4a'],
      accents: ['#c7a6f2', '#7fe0d0', '#d6ff9a'],
    },
  })] },
  // the Salt Harbour's folk (src/levels/salt-harbour.js): sun-bleached wraps and hoods against the glare, terracotta and sailcloth
  saltharbour: { tribes: [tribe({
    name: 'the harbour folk',
    moods: { kind: 3, calm: 3, amused: 2, curious: 1.5, stern: 0.4 },
    heads: { hood: 3, wrap: 3, hat: 1, hair: 1 }, as: { hat: 'hood' },
    hair: { m: { short: 2, tail: 1 }, f: { long: 2, braid: 2, bun: 1 } },
    masks: { none: 3, goggles: 1 }, body: { mantle: 2, none: 2 }, props: { none: 3, basket: 1.5 }, trim: { none: 1 },
    capes: [0.8, 1.1, 1.3], robe: 0.6, robes: [0.2, 0.3], flare: [0.28, 0.34], size: [0.96, 1.04],
    palette: {
      cloaks: ['#efe2cc', '#e2c8a8', '#c4664a', '#a0644a', '#d8d0c4'],
      tunics: ['#7c4a38', '#8a6448', '#5e5068', '#4d6a9a'],
      legs: ['#4a3a2a', '#3a3448'],
      skins: ['#d8a888', '#c89878', '#b88868', '#e8c0a0'],
      hair: ['#2b211f', '#4a3226', '#d8c8b0'],
      hats: ['#efe2cc', '#c4664a', '#e2c8a8'],
      accents: ['#c4664a', '#6f8f5a', '#4d6a9a'],
    },
  })] },
  // the White Mangrove's folk (src/levels/mangrove.js): pale robes and hoods, lanterns, the lake's violet and rose
  mangrove: { tribes: [tribe({
    name: 'the lake folk',
    moods: { calm: 4, kind: 3, curious: 1.5, amused: 1.2, stern: 0.2 },
    heads: { hood: 4, lamphat: 1, hair: 1 }, as: { hat: 'hood', wrap: 'hood' },
    hair: { m: { tail: 2, locks: 1 }, f: { long: 3, braid: 2 } },
    masks: { none: 1 }, body: { mantle: 2, none: 2 }, props: { lantern: 2, lamppole: 1, none: 2 }, trim: { none: 1 },
    capes: [0.9, 1.2, 1.4], robe: 0.7, robes: [0.2, 0.32], flare: [0.3, 0.36], size: [0.97, 1.05],
    palette: {
      cloaks: ['#e9e2f2', '#c9c2e6', '#8a8ed0', '#d8b8d8'],
      tunics: ['#5a5a8a', '#3e4672', '#6f5a9a', '#4a4f7a'],
      legs: ['#2f3a4f', '#2a2f4a'],
      skins: ['#e6c8b8', '#d8b8a8', '#c8a898', '#f0d8c8'],
      hair: ['#2b211f', '#e8e2f2', '#4a3a5a'],
      hats: ['#e9e2f2', '#8a8ed0', '#c9c2e6'],
      accents: ['#ffd27a', '#ff9ad8', '#7fb8ff'],
    },
  })] },
  perdide2: { tribes: [tribe({
    name: 'the lamp-keepers',
    moods: { kind: 4.5, calm: 2, curious: 1.5, amused: 1, stern: 0.2 },
    heads: { lamphat: 5, hood: 1 }, as: { hat: 'lamphat', wrap: 'lamphat', hood: 'lamphat' },
    hair: { m: { tail: 2, locks: 2 }, f: { long: 3, braid: 2 } },
    masks: { none: 1 }, body: { mantle: 2, none: 2 }, props: { lamppole: 3, lantern: 2, none: 1 }, trim: { none: 1 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { hooddown: 1, beanie: 1, trapper: 0.6 }, body: { muffler: 1 } },
    capes: [0.9, 1.25, 1.45], robe: 0.6, robes: [0.15, 0.3], flare: [0.3, 0.36], size: [0.98, 1.06],
    palette: {
      cloaks: ['#3a6a58', '#4a4f7a', '#3e5a6a', '#6f5a9a'],
      tunics: ['#3a6a58', '#2f4a4a', '#4a4f7a', '#5a4a6a'],
      legs: ['#2f3a4f', '#2f3a3a'],
      skins: ['#d6c8ec', '#cdbde6', '#e0d4f0'],
      hair: ['#2b211f', '#e8e2f2', '#4a3a5a'],
      hats: ['#3a8f8a', '#5a5a3a', '#4a4f7a', '#6f7a4a'],
      accents: ['#ffd6a0', '#f2a07a', '#c7a6f2'],
    },
  })] },
  bazaar: { tribes: [tribe({
    name: 'the market',
    moods: { amused: 3, kind: 3, curious: 2.5, calm: 1, stern: 0.6 },
    heads: { turban: 4, fez: 2, wrap: 1, hair: 1.4 },
    headsF: { turban: 3, wrap: 2, fez: 1, hair: 2.4 }, as: { wrap: 'turban', hat: 'fez', hood: 'turban' },
    // the market: curls and close crops, braids and loose hair
    hair: { m: { curls: 3, crop: 2, shaved: 1.5, bald: 0.8 }, f: { braid: 2.5, curls: 2, flow: 2, bun: 1.5 } },
    masks: { none: 1 }, body: { badge: 4, none: 1 }, props: { basket: 2, none: 4 }, trim: { diamonds: 2, stripes: 2 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { flatcap: 1.3, beanie: 1, peak: 1, hooddown: 0.8 }, headsF: { kerchief: 1.5, beanie: 0.8, hooddown: 0.8 }, masks: { glasses: 0.12, browgoggles: 0.09, scarfmask: 0.06 }, body: { muffler: 1, neckerchief: 1 } },
    capes: [0, 0.5, 0.9], robe: 0.6, robes: [0.4, 0.5], flare: [0.26, 0.29], size: [0.95, 1.05],
    palette: {
      cloaks: ['#f0a083', '#88b4b5', '#e4bd83', '#2fa8a0', '#ff7a5c', '#c8483a', '#5fb7ad', '#f2c54b', '#8a6fb8'],
      tunics: ['#2fa8a0', '#ff7a5c', '#f5dfab', '#3a535b', '#e85a6a', '#f2c54b'],
      legs: ['#465c65', '#3a535b', '#5a3a4a'],
      skins: ['#c58c64', '#e9cfb4', '#8a5a40', '#d9a98a', '#a8714c', '#f1dccb'],
      hair: ['#2b211f', '#4a3226', '#e8dcc0', '#a8552e'],
      hats: ['#ff7a5c', '#2fa8a0', '#f2c54b', '#f5dfab', '#e85a6a'],
      accents: ['#f2c54b', '#2fa8a0', '#ff7a5c', '#f5dfab'],
    },
  })] },
  // the City Behind the Waterfall (src/levels/waterfall.js): basket carriers and pot gardeners in rust, ochre
  // and teal against the pale stone, hoods and wraps against the spray
  waterfall: { tribes: [tribe({
    name: 'the falls',
    moods: { calm: 3, kind: 3, curious: 2, amused: 1.5, stern: 0.4 },
    heads: { hood: 3, wrap: 2.5, hair: 2 },
    headsF: { wrap: 3, hood: 2, hair: 2.4 },
    hair: { m: { crop: 2, curls: 2, bald: 0.8 }, f: { braid: 2.5, bun: 2, flow: 1.5 } },
    masks: { none: 1 }, body: { none: 3, badge: 1 }, props: { basket: 3, none: 3 }, trim: { stripes: 2, none: 2 },
    more: { heads: { beanie: 1, hooddown: 1.2 }, headsF: { kerchief: 1.5, hooddown: 0.8 }, body: { muffler: 1 } },
    capes: [0, 0.6, 1.0], robe: 0.7, robes: [0.3, 0.45], flare: [0.3, 0.36], size: [0.95, 1.05],
    palette: {
      cloaks: ['#c46b4e', '#4f7f86', '#d9a35e', '#7a6e9e', '#b5523e', '#e0c08a', '#5f8f7a', '#2f8a8f'],
      tunics: ['#efe0c4', '#d9a35e', '#4f8f8a', '#c2603f', '#f2e6d0'],
      legs: ['#3f5a5e', '#5a4a42', '#2f4a4f'],
      skins: ['#c58c64', '#e9cfb4', '#8a5a40', '#d9a98a', '#a8714c', '#f1dccb'],
      hair: ['#2b211f', '#4a3226', '#a8552e', '#e8dcc0'],
      hats: ['#c46b4e', '#4f8f8a', '#d9a35e', '#efe0c4'],
      accents: ['#d9a35e', '#2f8a8f', '#c2603f', '#efe0c4'],
    },
  })] },
  home: { tribes: [tribe({
    name: 'home',
    moods: { kind: 5, amused: 2, curious: 1, calm: 1, stern: 0 },
    heads: { cap: 1, band: 1 }, as: { wrap: 'band', hat: 'cap', hood: 'cap' },
    hair: { m: { short: 2, crop: 1 }, f: { long: 2, bun: 1 } },
    masks: { none: 1 }, body: { none: 1 }, props: { none: 1 }, trim: { none: 1 },
    // (stage 3's headwear, drawn apart: the crowd's, not a named person's: dressFor)
    more: { heads: { beanie: 0.5 } },
    capes: [0], robe: 0, size: [1, 1],
    palette: { tunics: ['#b5473a', '#d9503f'], legs: ['#2b2f45', '#34405e'], skins: ['#e9cfb4', '#d9a98a'], accents: ['#f3ead8', '#5fb7ad'] },
  })] },
  // the lab's giant sitters: plain clothes and a band at most, so nothing hides the face
  lab: { tribes: [tribe({
    name: 'the sitters',
    heads: { band: 1 }, as: { wrap: 'band', hat: 'band', hood: 'band' },
    masks: { none: 1 }, body: { none: 1 }, props: { none: 1 }, trim: { none: 1 },
    capes: [0], robe: 0, size: [1, 1],
    palette: { tunics: ['#d8a24a', '#8a6fb8'], legs: ['#2b2f45'], skins: ['#e9cfb4', '#c98f64', '#8a5a3c'], accents: ['#f3ead8'] },
  })] },
  // the references' walkers (src/levels/reference-views.js): small violet robed figures, hooded
  references: { tribes: [tribe({
    name: 'the walkers',
    heads: { hood: 1 }, as: { wrap: 'hood', hat: 'hood', hair: 'hood' },
    masks: { none: 1 }, body: { none: 1 }, props: { none: 1 }, trim: { none: 1 },
    capes: [1.3], robe: 1, robes: [0.08], flare: [0.3, 0.32], size: [1, 1],
    palette: { tunics: ['#a688c4'], legs: ['#7e62a0'], skins: ['#e9cfb4'], accents: ['#b48ccf'] },
  })] },
  atelier: { tribes: [tribe({
    name: 'the artist',
    heads: { beret: 1 }, as: { hood: 'beret', hat: 'beret', wrap: 'beret', hair: 'beret' },
    masks: { none: 1 }, body: { none: 1 }, props: { none: 1 }, trim: { none: 1 },
    capes: [0], robe: 1, robes: [0.5], flare: [0.27, 0.27], size: [1, 1],
    palette: { accents: ['#2b211f'] },
  })] },
  // the Forest of Antennas' folk (src/levels/antennas.js): menders of the masts, in lilac and rust, goggles up, tools on their belts
  antennas: { tribes: [tribe({
    name: 'the mast-menders',
    moods: { calm: 3, kind: 3, curious: 2, amused: 1.5, stern: 0.4 },
    heads: { antenna: 2, hood: 2, hair: 1.5 }, as: { hat: 'hood', wrap: 'hood' },
    hair: { m: { tail: 2, swept: 1 }, f: { long: 2, twin: 2 } },
    masks: { browgoggles: 2, none: 3 }, body: { toolbelt: 3, mantle: 1, none: 1 }, props: { wrench: 2, lantern: 1, none: 3 }, trim: { none: 1 },
    capes: [0.6, 0.9, 1.1], robe: 0.4, robes: [0.18, 0.28], flare: [0.28, 0.34], size: [0.95, 1.04],
    palette: {
      cloaks: ['#b8a6d8', '#8a7ab8', '#d8a184', '#e9bab4'],
      tunics: ['#5a4a3f', '#4b3e39', '#6a5a8a', '#3c4a2e'],
      legs: ['#34304a', '#2f2a3a'],
      skins: ['#e6c8b8', '#d8b098', '#c09878', '#f0d8c8'],
      hair: ['#2b211f', '#e8dcc0', '#5a4a3a'],
      hats: ['#b8a6d8', '#d8a184', '#8a7ab8'],
      accents: ['#ffcf72', '#ff8a6a', '#8ea2b0'],
    },
  })] },
  // the Fallen Ring's folk (src/levels/fallen-ring.js): herders and the villagers under the hulls, in ivory, sage and faded vermilion
  fallenring: { tribes: [tribe({
    name: 'the ring folk',
    moods: { calm: 3, kind: 3, curious: 1.5, amused: 1.5, stern: 0.5 },
    heads: { hood: 2, hair: 2 }, as: { hat: 'hood', wrap: 'hood' },
    hair: { m: { tail: 1, swept: 2 }, f: { long: 2, twin: 1 } },
    masks: { none: 1 }, body: { mantle: 2, none: 2 }, props: { lantern: 1, none: 3 }, trim: { none: 1 },
    capes: [0.7, 1, 1.2], robe: 0.6, robes: [0.2, 0.3], flare: [0.28, 0.34], size: [0.96, 1.05],
    palette: {
      cloaks: ['#f0e2c4', '#e8b48c', '#9c9e58', '#d8c9a0'],
      tunics: ['#8a5c38', '#5a4028', '#6a7a52', '#c9764e'],
      legs: ['#3a3a30', '#4a3a2a'],
      skins: ['#e6c8b0', '#d4a888', '#b88a68', '#f0d8c4'],
      hair: ['#2b211f', '#5a4028', '#e8dcc0'],
      hats: ['#f0e2c4', '#9c9e58', '#e8b48c'],
      accents: ['#ef9a7c', '#ffc27a', '#5d9fb6'],
    },
  })] },
};
// the Glass Dunes' glassworkers dress as the desert's people (src/levels/glass-dunes.js: its crowd's costume is the desert's)
COSTUMES.glassdunes = COSTUMES.desert;
COSTUMES.moonfoundry = COSTUMES.buried;   // (the Moon Foundry, src/levels/moon-foundry.js: the Buried Machine's workers' clothes, in the foundry's own colours)
COSTUMES.spacecity = COSTUMES.incal;   // (the City Floating in Space, src/levels/space-city.js: the City-Shaft's townsfolk, a city of terraces over a drop)
COSTUMES.underwater = COSTUMES.waterfall;   // (the Underwater City, src/levels/underwater.js: the falls' wraps and hoods, in the city's own colours)
COSTUMES.eclipse = COSTUMES.mangrove;   // (the City During the Eclipse, src/levels/eclipse.js: the lake folk's pale robes and hoods, their lanterns)
COSTUMES.underside = COSTUMES.saltharbour;   // (the Underside, src/levels/underside.js: the harbour folk's terracotta cloaks and hoods)
const INCAL = { TOP: 200, LEVELS: [150, 92, 36, -24, -86] };
function zoneIncal(c) {
  const id = c.spot?.id;
  if (id === 'rim' || id === 'upper' || id === 'middle' || id === 'lower') return id;
  const y = c.pos?.y;
  if (y === undefined) return 'rim';
  return y >= INCAL.TOP - 1 ? 'rim' : y >= INCAL.LEVELS[1] - 1 ? 'upper' : y >= INCAL.LEVELS[4] - 1 ? 'middle' : 'lower';
}

// ------------------------------------------------------------------ the current world
let current = null;
/** The world people are dressed for: set explicitly, or the page's ?level= (the game's default is the desert). */
export function setCostumeWorld(id) { current = id; }
export function costumeWorld() {
  if (current) return current;
  try {
    const id = new URLSearchParams(globalThis.location?.search ?? '').get('level');
    if (id && COSTUMES[id]) return id;
  } catch { /* no page */ }
  return 'desert';
}

// ------------------------------------------------------------------ one person's look
const pick = (rng, a) => a[Math.floor(rng() * a.length) % a.length];
function weighted(rng, w) {
  const e = Object.entries(w);
  let t = rng() * e.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of e) { if ((t -= v) <= 0) return k; }
  return e[e.length - 1][0];
}
const range = (rng, [a, b]) => a + (b - a) * rng();
/** A small stable hash for seeding a named person's look. */
export function hashSeed(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** The tribe someone belongs to (ctx: { spot, pos }). */
export function tribeOf(world, ctx = {}) {
  const set = COSTUMES[world] ?? { tribes: [DEFAULT] };
  return set.tribes.find((t) => !t.when || t.when(ctx)) ?? set.tribes[set.tribes.length - 1];
}

/**
 * A person's look in `world`.
 * @param rng      () => 0..1 (seeded for anyone who must look the same each time)
 * @param o.palette their own colours (story data: cloak, lining, cloth, legs, hat, hair, skin, accent): kept
 * @param o.lists   a level's crowd colour lists (cloaks, tunics, …), under the world's own
 * @param o.head    a story head ('hood' | 'hat' | 'wrap' | 'hair' | any piece id), in the world's style
 * @param o.cape    their cape length (m), if the story sets it
 * @param o.look    story overrides: { head, mask, body, prop, robe (hem height, 0 none), trim, flare }
 * @param o.named   a named person (namedLook): their look as it was drawn before stage 3's headwear (T.more)
 * @param o.young   a child or a teenager: no beard
 */
export function dressFor(world, rng, { palette = {}, lists = {}, head = null, cape = null, look = {}, spot = null, pos = null, kind = null, named = false, young = false } = {}) {
  const T = tribeOf(world, { spot, pos });
  const L = { ...DEFAULT.palette, ...lists, ...T.palette };
  const accents = L.accents ?? L.cloaks;
  const s = {
    world, tribe: T.name,
    cloak: palette.cloak ?? pick(rng, L.cloaks),
    cloth: palette.cloth ?? pick(rng, L.tunics),
    legs: palette.legs ?? pick(rng, L.legs),
    skin: palette.skin ?? pick(rng, L.skins),
    hair: palette.hair ?? pick(rng, L.hair),
    hat: palette.hat ?? pick(rng, L.hats),
    accent: palette.accent ?? pick(rng, accents),
  };
  const pickHead = (w) => (kind === 'f' && w.headsF) || (kind === 'm' && w.headsM) || w.heads;
  let h = look.head ?? (head ? T.as[head] ?? head : more(T, 'heads', s, weighted(rng, pickHead(T)), pickHead(T), named ? null : T.more && pickHead(T.more)));
  if (!HEAD_IDS.includes(h)) h = 'hood';
  s.head = h;
  s.mask = look.mask ?? more(T, 'masks', s, weighted(rng, T.masks), T.masks, named ? null : T.more?.masks);
  s.body = look.body ?? more(T, 'body', s, weighted(rng, T.body), T.body, named ? null : T.more?.body);
  s.prop = look.prop ?? weighted(rng, T.props);
  s.trim = look.trim ?? weighted(rng, T.trim);
  const r1 = rng();
  s.robe = look.robe ?? (r1 < T.robe ? pick(rng, T.robes) : 0);
  s.flare = look.flare ?? range(rng, T.flare);
  s.capeLen = cape ?? pick(rng, T.capes);
  s.capeWide = range(rng, T.wide);
  s.capeBells = look.capeBells ?? 0;
  // the second carried slot and the leg pieces (BACKS, SHINS): named people's, drawn from no random number either
  s.back = look.back ?? 'none'; s.stow = !!look.stow; s.shins = look.shins ?? 'none';   // bells sewn along the cape's hem (Sefa's sheet: cape.js bells; no rng, so the looks drawn after are unchanged)
  s.bulk = T.bulk ?? 0;
  s.sleeveless = !!T.sleeveless;
  s.size = range(rng, T.size);
  // the body (drawn after everything above, so the rest of a look is what it was): a man or a
  // woman, a build and a height, all seeded with the look
  const female = kind === 'f';
  s.kind = kind;
  s.build = look.build ?? weighted(rng, female ? BUILD_ODDS.f : BUILD_ODDS.m);
  s.height = look.height ?? THREE.MathUtils.clamp((1 + (rng() + rng() - 1) * HEIGHT.spread) * (female ? HEIGHT.f : 1), HEIGHT.min, HEIGHT.max);
  const rh = rng(), rb = rng();
  // bare heads: the tribe's own hairstyles, a woman's or a man's (or a man's when nobody says); some men have a beard
  if (!look.head && GENERIC_HAIR.includes(s.head)) s.head = hairstyleOf(T, female ? 'f' : 'm', rh);
  // the hair under their headwear (a MakeHuman body draws it squashed under a hat, falling below it: HEADS[].cover)
  s.under = look.under ?? (HAIR_IDS.includes(s.head) ? s.head : hairstyleOf(T, female ? 'f' : 'm', rh));
  if (!female && kind && !young && !look.mask && s.mask === 'none' && rb < BEARDS) s.mask = 'beard';
  // their eyes' colour: seeded by the rest of the look, not drawn from rng, so the looks drawn after
  // this one from the same stream (a crowd's) are what they were
  s.eyes = palette.eyes ?? look.eyes ?? irisFor(mulberry32(hashSeed(`${s.skin}|${s.hair}|${s.cloak}|${s.height}|${s.capeWide}`)));
  // their face and the mood it rests in (the same way: their own stream, the others' looks untouched)
  Object.assign(s, faceFor(T, mulberry32(hashSeed(`face|${s.eyes}|${s.skin}|${s.cloak}|${s.height}|${s.flare}`)), look));
  return s;
}

/**
 * Stage 3's headwear (a tribe's `more`: hats, caps, masks, neck pieces, docs/makehuman.md) drawn apart from
 * the tribe's own weights, so everyone drawn before keeps their look (the story's people, a crowd's
 * stream): with the share of the extras' weight (`extra` against `base`), by a draw of their own (seeded by
 * the colours already drawn, not from rng), one of the extras instead of `pick`. None for a named person.
 */
function more(T, slot, s, pick, base, extra) {
  if (!extra) return pick;
  const sum = (w) => Object.values(w ?? {}).reduce((a, v) => a + v, 0), e = sum(extra);
  if (!e) return pick;
  const u = (hashSeed(`${slot}|${s.cloak}|${s.cloth}|${s.legs}|${s.skin}|${s.hair}|${s.hat}|${s.accent}`) % 100003) / 100003;
  if (u >= e / (e + sum(base))) return pick;
  const v = (hashSeed(`${slot}+${s.accent}|${s.hat}|${s.skin}|${s.cloak}`) % 100003) / 100003;
  return weighted(() => v, extra);
}

/**
 * A person's face (morph.js FACE_MORPHS: one of the tribe's shapes, FACE_TYPES, with their own ink: age
 * lines, mouth width, now and then freckles) and their expression at rest (one of the tribe's moods,
 * REST_MOODS: most people kind, amused or curious, a few calm or stern). `look.faceType` / `look.face` /
 * `look.mood`: the story's own. Returns { faceType, face, mood, rest }.
 */
export function faceFor(T, rng, look = {}) {
  const faceType = look.faceType ?? weighted(rng, T?.faces ?? FACE_ODDS);
  const shape = FACE_TYPES[faceType] ?? {};
  const lines = shape.lines ?? +(0.4 + rng() * 0.6).toFixed(2);
  const mouthWidth = +(0.92 + rng() * 0.16).toFixed(2);
  const freckles = rng() < 0.12 ? +(0.25 + rng() * 0.4).toFixed(2) : 0;
  const face = look.face ?? { ...shape, lines, mouthWidth, ...(freckles ? { freckles } : {}) };
  const mood = look.mood ?? restMood(rng(), T?.moods ?? REST_ODDS);
  return { faceType, face, mood, rest: { ...REST_MOODS[mood] } };
}

/** How far the brows' colour goes from the hair toward the skin. */
export const BROW_SOFT = 0.38;
/** The brows' colour: the hair's, softened toward the skin (lighter, less of a dark bar over the eyes). */
export function browColour(hair = '#4a3226', skin = '#d9a98a') {
  return '#' + new THREE.Color(hair).lerp(new THREE.Color(skin), BROW_SOFT).getHexString();
}

/** The hairstyle a tribe gives a bare head of this kind, for a draw u (0..1): tribe.hair (costumes.js DEFAULT). */
export function hairstyleOf(T, kind = 'm', u = 0.5) {
  const table = T?.hair?.[kind === 'f' ? 'f' : 'm'] ?? DEFAULT.hair[kind === 'f' ? 'f' : 'm'];
  return weighted(() => u, table);
}

// ------------------------------------------------------------------ bodies
/**
 * Builds: how wide the shoulders are and how full the body is, relative to the plain figure.
 * The full NPCs reshape their body mesh (humanoid.js buildGeometry), the crowd figures their
 * vertices (crowd-shader.js, aBody); the head, hands and feet stay as they are.
 */
export const BUILDS = {
  slim: { width: 0.93, girth: 0.9 },
  average: { width: 1, girth: 1 },
  broad: { width: 1.12, girth: 1.06 },
  heavy: { width: 1.08, girth: 1.3 },
};
const BUILD_ODDS = { m: { slim: 2, average: 4, broad: 2.5, heavy: 1.5 }, f: { slim: 3, average: 4, broad: 1, heavy: 2 } };
/** Heights: 1 ± spread (a triangle, most people near the middle), women a little shorter; the tribe's size on top. */
export const HEIGHT = { spread: 0.14, f: 0.95, min: 0.85, max: 1.15 };
const BEARDS = 0.3;
/** The crowd shader's per-instance body: female (0 / 1), shoulder width, girth, the iris colour (0xRRGGBB; 0: a brown). */
export function packBody(s) {
  const b = BUILDS[s.build] ?? BUILDS.average;
  return [s.kind === 'f' ? 1 : 0, b.width, b.girth, s.eyes ? new THREE.Color(s.eyes).getHex() : 0];
}

/** A crowd person's look (crowd.js): the world's costume over the level's crowd colours. */
export function crowdLook(rng, { world = costumeWorld(), lists = {}, spot = null, pos = null, kind = null } = {}) {
  return dressFor(world, rng, { lists, spot, pos, kind });
}

/** A named person's look: seeded by who they are, so they look the same every visit. */
export function namedLook({ world = costumeWorld(), id = '', palette = {}, head = null, cape = null, look = {}, pos = null, kind = null, young = false } = {}) {
  return dressFor(world, mulberry32(hashSeed(`${world}:${id}`)), { palette, head, cape, look, pos, kind, named: true, young });
}

/** The ids a look shows, in a comparable form (tests; a promoted NPC must match its crowd figure). */
export function silhouette(s) {
  return { head: s.head, mask: s.mask, body: s.body, prop: s.prop, robe: +(s.robe || 0).toFixed(2), cape: +(s.capeLen || 0).toFixed(2), trim: s.trim };
}

// ------------------------------------------------------------------ crowd packing
export const BELT = 0.97;   // the crowd figure's belt (m)
/** Per-instance costume attributes for the crowd shader: aDress and the w of aLook1. */
export function packDress(s) {
  const head = Math.max(0, HEAD_IDS.indexOf(s.head)), cap = HEADS[s.head]?.cap ? 1 : 0;   // (the shader: headId = x % HEAD_ID_LIMIT)
  const robeLen = s.robe > 0 ? BELT - s.robe : 0;
  return {
    dress: [head + HEAD_ID_LIMIT * cap, Math.max(0, MASK_IDS.indexOf(s.mask)) + MASK_ID_LIMIT * Math.max(0, BODY_IDS.indexOf(s.body)) + MASK_ID_LIMIT * BODY_ID_LIMIT * Math.max(0, PROP_IDS.indexOf(s.prop)),
      (s.capeLen || 0) + 2 * Math.round((s.capeWide ?? 1) * 10), robeLen],
    w: Math.min(s.bulk ?? 0, 3) + 4 * (s.sleeveless ? 1 : 0) + 8 * Math.max(0, TRIM_IDS.indexOf(s.trim ?? 'none')) + 128 * Math.round((s.flare ?? 0.3) * 100),
  };
}
/** The inverse of packDress (what the shader reads), for tests. */
export function unpackDress(d, w) {
  const head = d[0] % HEAD_ID_LIMIT, mask = d[1] % MASK_ID_LIMIT, body = Math.floor(d[1] / MASK_ID_LIMIT) % BODY_ID_LIMIT, prop = Math.floor(d[1] / (MASK_ID_LIMIT * BODY_ID_LIMIT));
  const wide = Math.floor(d[2] / 2), capeLen = d[2] - 2 * wide;
  const trim = Math.floor(w / 8) % 16;
  return { head: HEAD_IDS[head], mask: MASK_IDS[mask], body: BODY_IDS[body], prop: PROP_IDS[prop], robe: d[3] > 0 ? +(BELT - d[3]).toFixed(2) : 0, cape: +capeLen.toFixed(2), trim: TRIM_IDS[trim] };
}

// ------------------------------------------------------------------ the pieces
// Each builder returns [{ role, geo, far? }]: role picks the colour (the person's hat, accent, cloak,
// cloth, hair, skin, legs, or a FIXED one), `far` keeps it on the crowd's far figure too.
// q scales the segment counts (1 full NPC, ~0.55 crowd, ~0.3 far crowd).
const sg = (n, q) => Math.max(3, Math.round(n * q));
const P = (role, geo, far = false) => ({ role, geo, far });
const sphere = (r, q, w = 14, h = 10, ...a) => new THREE.SphereGeometry(r, sg(w, q), sg(h, q), ...a);
const cyl = (rt, rb, h, q, n = 12, open = false, ...a) => new THREE.CylinderGeometry(rt, rb, h, sg(n, q), 1, open, ...a);
const cone = (r, h, q, n = 12, open = false) => new THREE.ConeGeometry(r, h, sg(n, q), 1, open);
const torus = (r, t, q, n = 16, m = 6, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, sg(m, q), sg(n, q), arc);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const _X = new THREE.Vector3(1, 0, 0), _Z = new THREE.Vector3(0, 0, 1);
const PACK_Z = -0.2;   // (a pack's middle behind the chest frame: BACKS.pack)
/** A ring of small blossoms (flower crowns and garlands): alternating roles. */
function blossoms(n, r, y, tilt, size, q, roles) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = q < 1 ? new THREE.OctahedronGeometry(size * (i % 2 ? 0.85 : 1), 0) : new THREE.IcosahedronGeometry(size * (i % 2 ? 0.85 : 1), 0);
    g.translate(Math.sin(a) * r, 0, Math.cos(a) * r).rotateX(tilt).translate(0, y, 0);
    out.push(P(roles[i % roles.length], g));
  }
  return out;
}
/** Jag the lower rim of an open cylinder (reeds, rags). */
function jag(g, amount, below) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < below) p.setY(i, p.getY(i) - ((i * 7) % 3) * amount);
  return g;
}

// The skull round the head anchor (humanoid.js reshape, measured on both bodies): an egg a
// little narrower than tall, fuller at the back on the woman's.
const SKULL = { m: { x: 0.088, y: 0.112, front: 0.11, back: 0.11 }, f: { x: 0.086, y: 0.12, front: 0.108, back: 0.124 } };
const DEG = Math.PI / 180;
/** A point on the skull egg (head frame), `t` off it: azimuth az (0 the face, +π/2 the left), elevation el (rad). */
function onSkull(S, az, el, t) {
  const rz = Math.cos(az) > 0 ? S.front : S.back;
  return [Math.sin(az) * Math.cos(el) * (S.x + t), Math.sin(el) * (S.y + t), Math.cos(az) * Math.cos(el) * (rz + t)];
}
/** A point on a skull (head frame, metres) at azimuth az and elevation el (degrees), t off it: for pieces fitted to it (the traveller's fringe). */
export const skullPoint = (kind, az, el, t = 0) => onSkull(SKULL[kind] ?? SKULL.m, az * DEG, el * DEG, t);

/** How far (degrees) under a headwear's edge (HEADS[].cover) the hair it presses in eases back out to where it falls. */
export const COVER_EASE = 14;
/**
 * Hair under headwear (head frame, in place): a point of a hairstyle inside what a headwear covers
 * (cover: a hairline, front / side / back degrees, `t` (m) off the skull its inside; `band`: only that many
 * degrees over its edge, a headband; `top`: a flat crown's inside, m over the skull's centre) is pressed in
 * to its inside; under the edge it eases back out (COVER_EASE) to where the hair falls. Returns how far it moved (m).
 */
export function squashUnder(p, cover, kind = 'm') {
  const S = SKULL[kind] ?? SKULL.m;
  const ez = p[2] > 0 ? S.front : S.back;
  const ex = p[0] / S.x, ey = p[1] / S.y, e3 = p[2] / ez, rho = Math.hypot(ex, ey, e3);
  if (rho < 1e-6) return 0;
  const el = Math.asin(Math.max(-1, Math.min(1, ey / rho))), az = Math.atan2(ex, e3);
  const edge = hairline(az, cover.front, cover.side, cover.back, 0, 0);
  let w = THREE.MathUtils.smoothstep(el, edge - COVER_EASE * DEG, edge);
  if (cover.band) w *= 1 - THREE.MathUtils.smoothstep(el, edge + cover.band * DEG, edge + (cover.band + COVER_EASE) * DEG);
  if (w <= 0) return 0;
  // the inside's own radius this way (the egg grown by t, in the egg's measure)
  const t = cover.t ?? 0.01, ca = Math.cos(el);
  const lim = Math.hypot((Math.sin(az) * ca * (S.x + t)) / S.x, (Math.sin(el) * (S.y + t)) / S.y, (Math.cos(az) * ca * (ez + t)) / ez);
  let d = 0;
  if (rho > lim) {
    const k = (rho - (rho - lim) * w) / rho;
    d = Math.hypot(p[0], p[1], p[2]) * (1 - k);
    p[0] *= k; p[1] *= k; p[2] *= k;
  }
  if (cover.top !== undefined && p[1] > cover.top) { const dy = (p[1] - cover.top) * w; p[1] -= dy; d = Math.max(d, dy); }
  return d;
}

/** The hairstyle (HAIR_IDS) under a look's headwear: its own (look.under, dressFor), else one its world gives a head of its kind, seeded by the look. */
export function underOf(look) {
  if (look?.under && HAIR_IDS.includes(look.under)) return look.under;
  if (HAIR_IDS.includes(look?.head)) return look.head;
  return hairstyleOf(tribeOf(look?.world ?? costumeWorld()), look?.kind === 'f' ? 'f' : 'm', (hashSeed(`${look?.skin}|${look?.hair}|${look?.cloak}`) % 997) / 997);
}
/**
 * A hairline's elevation (rad) at azimuth az: `front` over the brow, `side` at the temples, `back` at
 * the nape (degrees); `ears` (degrees) lifts it round the ears, with a sideburn in front of them and
 * the temples' corners a little higher than the brow.
 */
function hairline(az, front, side, back, ragged = 0, ears = 26) {
  const back01 = (1 - Math.cos(az)) / 2, a = Math.abs(Math.atan2(Math.sin(az), Math.cos(az))) / DEG;
  const g = (c, w) => Math.exp(-(((a - c) / w) ** 2));
  return (front + (back - front) * back01 + (side - (front + back) / 2) * Math.sin(az) ** 2 + ragged * Math.sin(az * 11)
    + ears * (g(102, 17) - 0.25 * g(72, 9)) + ears * 0.2 * g(36, 11)) * DEG;
}
/** A grid of points (cols+1 × rows+1, column-major) as an indexed mesh; `weld` closes it round (the seam's normals shared). */
function grid(pos, cols, rows, weld = false) {
  const idx = [];
  for (let j = 0; j < cols; j++) for (let i = 0; i < rows; i++) {
    const a = j * (rows + 1) + i, b = a + rows + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (weld) {
    const N = g.attributes.normal, last = cols * (rows + 1), v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i <= rows; i++) {
      v.fromBufferAttribute(N, i).add(w.fromBufferAttribute(N, last + i)).normalize();
      N.setXYZ(i, v.x, v.y, v.z); N.setXYZ(last + i, v.x, v.y, v.z);
    }
  }
  return g;
}
/**
 * Hair that follows the skull (head frame): a shell `t` (m) off it, from a hairline that runs from
 * `front` (degrees of elevation over the brow) round the temples (`side`) to the nape (`back`) up to
 * `top` (90: the crown; less leaves it bare, a tonsure). jag: a ragged edge (degrees). kind: whose
 * skull ('m' / 'f'). Thicker toward the crown (`crown`, m), lifted over the brow (`quiff`), lumpy (`bump`: curls).
 * The seam runs down the back, so nothing creases over the face.
 */
export function scalp(q, { t = 0.008, front = 30, side = -14, back = -42, jag: ragged = 1.5, ears = 26, kind = 'm', cols = 36, rows = 9, top = 90, crown = 0, quiff = 0, bump = 0 } = {}) {
  const S = SKULL[kind] ?? SKULL.m;
  cols = sg(cols, q); rows = sg(rows, q);
  const pos = [];
  for (let j = 0; j <= cols; j++) {
    const az = Math.PI + (j / cols) * Math.PI * 2, edge = hairline(az, front, side, back, ragged, ears), fr = Math.max(0, Math.cos(az)) ** 2;
    for (let i = 0; i <= rows; i++) {
      const u = (i / rows) ** 0.85, el = edge + (top * DEG - edge) * u;
      // (thinning to the hairline, so its edge lies on the skin rather than standing off it like a cap's rim)
      const edgeIn = 0.4 + 0.6 * THREE.MathUtils.smoothstep(i / rows, 0, 0.3);
      const tt = t * edgeIn + crown * Math.sin(u * Math.PI / 2) + quiff * fr * Math.sin(u * Math.PI) + bump * (0.5 + 0.5 * Math.sin(az * 9 + el * 13) * Math.sin(az * 5 - el * 17));
      pos.push(...onSkull(S, az, el, tt));
    }
  }
  return grid(pos, cols, rows, true);
}
/**
 * Hair falling from the skull (head frame): from `top` degrees over the skull's equator round the
 * back and sides (the face left open within ±open rad of it), straight down to `bottom` (m; the back
 * `backDrop` further), flaring out by `flare` at the ends; `t` off the skull.
 */
export function curtain(q, { kind = 'm', t = 0.012, open = 1.15, top = 6, bottom = -0.24, backDrop = 0, flare = 0.02, cols = 16, rows = 4, jag: ragged = 0.008 } = {}) {
  const S = SKULL[kind] ?? SKULL.m;
  cols = sg(cols, q); rows = Math.max(1, Math.round(rows * q));
  const pos = [], y0 = Math.sin(top * DEG) * (S.y + t);
  for (let j = 0; j <= cols; j++) {
    const az = open + (j / cols) * (Math.PI * 2 - open * 2), back01 = (1 - Math.cos(az)) / 2;
    const yb = bottom - backDrop * back01 + ragged * Math.sin(az * 7 + 1);
    pos.push(...onSkull(S, az, top * DEG, t));
    for (let i = 1; i <= rows; i++) {
      const s = i / rows, f = t + flare * s ** 1.4, rz = Math.cos(az) > 0 ? S.front : S.back;
      pos.push(Math.sin(az) * (S.x + f), y0 + (yb - y0) * s, Math.cos(az) * (rz + f));
    }
  }
  return grid(pos, cols, rows);
}
/** A patch of the skull (head frame) between azimuths az0..az1 and elevations el0..el1 (degrees), t0 thick at the bottom, t1 at the top. */
function patch(q, { kind = 'm', az0 = -50, az1 = 50, el0 = 8, el1 = 40, t0 = 0.014, t1 = 0.01, cols = 10, rows = 3, jag: ragged = 0 } = {}) {
  const S = SKULL[kind] ?? SKULL.m;
  cols = sg(cols, q); rows = Math.max(1, Math.round(rows * q));
  const pos = [];
  for (let j = 0; j <= cols; j++) {
    const az = (az0 + (az1 - az0) * (j / cols)) * DEG, e0 = el0 + ragged * Math.sin(j * 2.1);
    for (let i = 0; i <= rows; i++) { const u = i / rows; pos.push(...onSkull(S, az, (e0 + (el1 - e0) * u) * DEG, t0 + (t1 - t0) * u)); }
  }
  return grid(pos, cols, rows);
}
/** A beard round the jaw (head frame): up the cheeks to the sideburns, under the chin, the mouth left clear. */
function beardShell(q, { t = 0.009, mouth = -0.104, cols = 14, rows = 4 } = {}) {
  cols = sg(cols, q); rows = sg(rows, q);
  const pos = [], A = 1.45;
  for (let j = 0; j <= cols; j++) {
    const az = -A + (j / cols) * A * 2, side = THREE.MathUtils.smoothstep(Math.abs(az), 0.25, 1.15);
    const yTop = mouth + (0.0 - mouth) * side ** 1.4, yBot = -0.163 + 0.045 * side ** 2;
    for (let i = 0; i <= rows; i++) {
      const s = i / rows, y = yTop + (yBot - yTop) * s;
      // the jaw: an ellipse round the face, narrowing to the chin; the last row tucks under it
      // (wider up the cheeks to the temples, as the face is: measured on both bodies)
      const chin = THREE.MathUtils.smoothstep(y, -0.115, -0.165), cheek = THREE.MathUtils.smoothstep(y, -0.075, 0.0), tuck = i === rows ? 0.45 : 0;
      const tt = t * (1 - 0.2 * cheek);
      const rx = (0.069 + 0.017 * cheek - 0.022 * chin + tt) * (1 - tuck * 0.5), rz = (0.107 - 0.018 * chin + tt) * (1 - tuck);
      pos.push(Math.sin(az) * rx, y, Math.cos(az) * rz - 0.004);
    }
  }
  return grid(pos, cols, rows);
}
/** Points on the skull (head frame) inside a hairline, a golden spiral from the crown: for curls. */
function scalpPoints(n, { t = 0.01, kind = 'm', minEl = -20 } = {}) {
  const S = SKULL[kind] ?? SKULL.m, out = [];
  for (let k = 0; out.length < n && k < n * 4; k++) {
    const y = 1 - (k + 0.5) / (n * 1.6), el = Math.asin(Math.max(-1, Math.min(1, y))), az = k * 2.39996;
    const lim = (Math.cos(az) > 0.3 ? 26 : minEl) * DEG;
    if (el < lim) continue;
    out.push(onSkull(S, az, el, t));
  }
  return out;
}
/** Locks hanging from the hairline round the back and sides (head frame): n of them, `len` long. */
function locks(q, kind, { n = 11, len = 0.24, r = 0.012 } = {}) {
  const S = SKULL[kind] ?? SKULL.m, out = [];
  n = q < 1 ? Math.ceil(n * 0.55) : n;
  for (let k = 0; k < n; k++) {
    const az = 1.0 + (k / (n - 1)) * (Math.PI * 2 - 2.0), l = len * (0.8 + 0.4 * ((k * 7) % 5) / 4) * (0.7 + 0.3 * (1 - Math.cos(az)) / 2);
    const [x, y, z] = onSkull(S, az, 4 * DEG, 0.012);
    const g = new THREE.CapsuleGeometry(r, l, q < 1 ? 1 : 2, q < 1 ? 4 : 6).translate(0, -l / 2, 0);
    // hanging, splayed a little outward
    g.rotateX(-Math.cos(az) * 0.12).rotateZ(Math.sin(az) * 0.12).translate(x, y, z);
    out.push(P('hair', g, k % 3 === 0));
  }
  return out;
}
const kindOf = (s) => (s?.kind === 'f' ? 'f' : 'm');
/** A piece, or nothing (pieces only the full body has). */
const Pq = (role, geo, far = false) => (geo ? [P(role, geo, far)] : []);
/** A small round knot of hair (buns, topknots), on the skull at (az, el) degrees, standing `out` off it. */
const knot = (q, kind, az, el, r, out = 0.6, squash = [1, 0.9, 0.85]) => sphere(r, q, 8, 6).scale(...squash).translate(...onSkull(SKULL[kind], az * DEG, el * DEG, r * out));
const tie = (q, kind, az, el, r = 0.016) => q < 1 ? null : cyl(r, r, 0.012, q, 8).rotateX(Math.PI / 2 - el * DEG).rotateY(az * DEG).translate(...onSkull(SKULL[kind], az * DEG, el * DEG, 0.004));

/**
 * Headwear and hairstyles (head frame). cap: the hair cap (hairCap) is drawn under it; base(q, look):
 * the full body's own shape of that hair instead of the cap (a crowd figure keeps the shared cap);
 * parts(q, look): the pieces (the look gives whose skull); chest(q, look): pieces resting on the
 * shoulders (chest frame); cover: what of the skull it covers (a MakeHuman body's hair squashed under it).
 */
export const HEADS = {
  // ---- hairstyles (HAIR_IDS)
  // short hair, fuller over the crown and lifted at the brow
  short: { cap: true, base: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.008, front: 28, crown: 0.011, quiff: 0.007, jag: 2 }), true)], parts: () => [] },
  // a topknot
  hair: { cap: true, parts: (q, l) => [P('hair', knot(q, kindOf(l), 180, 62, 0.042, 0.55, [1, 1, 1])), ...Pq('accent', tie(q, kindOf(l), 180, 50, 0.022))] },
  // a ponytail from the back of the head, tied
  tail: { cap: true, parts: (q, l) => {
    const S = SKULL[kindOf(l)];
    const g = q < 1 ? cyl(0.024, 0.014, 0.21, q, 6).translate(0, -0.1, 0) : new THREE.CapsuleGeometry(0.026, 0.17, 4, 8).translate(0, -0.1, 0);
    return [P('hair', g.rotateX(0.32).translate(0, 0.02, -S.back - 0.012)), ...Pq('accent', tie(q, kindOf(l), 180, 10, 0.02))];
  } },
  // long hair falling to the shoulders, open at the face
  long: { cap: true, parts: (q, l) => [P('hair', curtain(q, { kind: kindOf(l), open: 1.12, bottom: -0.2, backDrop: 0.04, flare: 0.024 }), true)] },
  // hair gathered in a bun at the back
  bun: { cap: true, parts: (q, l) => [P('hair', knot(q, kindOf(l), 180, 22, 0.05), true), ...Pq('accent', tie(q, kindOf(l), 180, 8, 0.024))] },
  // close to the skull: a short crop with the forehead clear, a shaved head (just a shadow of hair), bald
  crop: { cap: true, base: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.006 }), true)], parts: () => [] },
  shaved: { cap: false, parts: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.0035, front: 34, side: -8, back: -36, jag: 0.5, cols: q < 1 ? 14 : 24, rows: q < 1 ? 4 : 9 }))] },
  bald: { cap: false, parts: () => [] },
  // tight curls: a thick lumpy crop, small round knots all over (on the full body)
  curls: { cap: true, base: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.012, front: 26, back: -38, crown: 0.008, bump: 0.009 }), true),
    ...scalpPoints(52, { kind: kindOf(l), t: 0.013 }).map(([x, y, z], i) => P('hair', sphere(0.012 + (i % 3) * 0.002, q, 7, 5).translate(x, y, z)))], parts: () => [] },
  // one braid down the back from the nape, its end tied
  braid: { cap: true, base: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.008, back: -30 }), true)], parts: (q, l) => {
    const S = SKULL[kindOf(l)], out = [];
    if (q < 1) return [P('hair', cyl(0.022, 0.011, 0.36, q, 6).translate(0, -0.2, -S.back - 0.016).rotateX(0.04), true)];
    for (let k = 0; k < 8; k++) {
      const r = 0.024 - k * 0.0016;
      out.push(P('hair', sphere(r, q, 8, 6).scale(1, 1.45, 0.85).rotateZ((k % 2 ? 1 : -1) * 0.35).translate((k % 2 ? 1 : -1) * 0.004, -0.045 - k * 0.04, -S.back - 0.006 - k * 0.003), k < 3));
    }
    out.push(P('accent', cyl(0.012, 0.012, 0.014, q, 8).translate(0, -0.37, -S.back - 0.03)), P('hair', cone(0.014, 0.05, q, 8).rotateX(Math.PI).translate(0, -0.4, -S.back - 0.031)));
    return out;
  } },
  // long hair down past the shoulders, parted over the brow, open at the face
  flow: { cap: true, base: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.01, front: 28, side: -18, back: -30, crown: 0.004 }), true)],
    parts: (q, l) => [P('hair', curtain(q, { kind: kindOf(l), t: 0.013, open: 1.2, top: 4, bottom: -0.27, backDrop: 0.1, flare: 0.032, rows: 5 }), true)] },
  // locks hanging round the back and sides to the shoulders
  locks: { cap: true, base: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.011, crown: 0.006, bump: 0.004 }), true)],
    parts: (q, l) => (q < 1 ? [P('hair', curtain(q, { kind: kindOf(l), open: 1.0, bottom: -0.2, backDrop: 0.04, flare: 0.03, jag: 0.035, cols: 18, rows: 2 }), true)] : locks(q, kindOf(l))) },
  // a shaved head with a crest of hair standing from the brow to the nape
  crest: { cap: false, parts: (q, l) => {
    const k = kindOf(l), S = SKULL[k], n = 7, out = [P('hair', scalp(q, { kind: k, t: 0.003, front: 34, side: -8, back: -36, jag: 0.5, cols: q < 1 ? 14 : 24, rows: q < 1 ? 5 : 9 }))];
    if (q < 1) return [...out, P('hair', sphere(0.1, q, 8, 6).scale(0.2, 0.36, 1.06).translate(0, S.y * 0.8, -0.005), true)];
    for (let i = 0; i < n; i++) {
      const el = (40 + (i / (n - 1)) * 115) * DEG, az = el > Math.PI / 2 ? Math.PI : 0, e = el > Math.PI / 2 ? Math.PI - el : el;
      const [x, y, z] = onSkull(S, az, e, 0.012), r = 0.03 - Math.abs(i - n * 0.35) * 0.0025;
      out.push(P('hair', sphere(r, q, 8, 6).scale(0.42, 1.25, 1).rotateX(-(el - Math.PI / 2)).translate(x, y, z), true));
    }
    return out;
  } },
  // a bob to the jaw with a straight fringe over the brow
  bob: { cap: true, base: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.011, crown: 0.007, front: 34 }), true)], parts: (q, l) => [
    P('hair', curtain(q, { kind: kindOf(l), t: 0.014, open: 0.95, top: 12, bottom: -0.085, flare: 0.012, rows: 2, jag: 0.003 }), true),
    P('hair', patch(q, { kind: kindOf(l), az0: -58, az1: 58, el0: 10, el1: 42, t0: 0.017, t1: 0.012 }))] },
  // two buns high at the back
  twin: { cap: true, parts: (q, l) => [1, -1].flatMap((s) => [P('hair', knot(q, kindOf(l), 180 - s * 52, 40, 0.038), true), ...Pq('accent', tie(q, kindOf(l), 180 - s * 52, 30, 0.018))]) },
  // swept back: high at the brow, full over the crown
  swept: { cap: true, base: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.009, front: 34, side: -10, crown: 0.012, quiff: 0.02 }), true)], parts: () => [] },
  // a monk's tonsure: a ring of hair, the crown shaved bare
  tonsure: { cap: false, parts: (q, l) => [P('hair', scalp(q, { kind: kindOf(l), t: 0.008, front: 22, side: -16, back: -40, top: 56, cols: q < 1 ? 14 : 24, rows: q < 1 ? 2 : 4 }))] },
  // ---- headwear
  hood: { cap: false, parts: (q) => [
    P('cloak', sphere(0.163, q, 14, 10, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5).scale(1, 1.22, 1.15).translate(0, 0.02, -0.02), true),
    P('cloak', cone(0.07, 0.28, q, 6).translate(0, 0.13, 0).rotateX(-1.15).translate(0, 0.19, -0.1), true),
  ] },
  hat: { cap: true, cover: { t: 0.03, front: 30, side: 26, back: 22 }, parts: (q) => [
    P('hat', cyl(0.3, 0.3, 0.014, q, 22).translate(0, 0.075, 0), true),
    P('hat', cyl(0.075, 0.12, 0.17, q, 14).translate(0, 0.16, 0), true),
    P('accent', cyl(0.121, 0.124, 0.03, q, 14, true).translate(0, 0.09, 0)),
  ] },
  wrap: { cap: true, parts: (q) => [
    ...[0, 1, 2].map((k) => P(k % 2 ? 'accent' : 'hat', torus(0.11 - k * 0.02, 0.032, q, 18, 8).rotateZ(k * 0.4).rotateX(Math.PI / 2 + 0.15).translate(0, 0.045 + k * 0.045, -0.01), k === 0)),
    P('hat', box(0.07, 0.32, 0.01).rotateX(0.25).rotateY(0.3).rotateZ(0.1).translate(0.02, -0.08, -0.12)),
  ] },
  wizard: { cap: true, cover: { t: 0.02, front: 26, side: 20, back: 16 }, parts: (q) => [
    P('hat', cyl(0.4, 0.4, 0.012, q, 28).rotateX(-0.06).translate(0, 0.07, 0), true),
    P('hat', cyl(0.13, 0.142, 0.05, q, 18).translate(0, 0.095, 0)),
    P('hat', cone(0.13, 0.42, q, 18, true).rotateX(-0.08).translate(0, 0.33, -0.01), true),
    P('hat', cone(0.05, 0.3, q, 12).translate(0, 0.13, 0).rotateX(-0.32).translate(0, 0.53, -0.03), true),
  ] },
  // the desert: a cloth over the head and down the neck, tied with a twisted band
  headcloth: { cap: false, parts: (q) => [
    P('hat', sphere(0.134, q, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(1, 1.08, 1.12).translate(0, 0.012, -0.012), true),
    P('hat', cyl(0.14, 0.215, 0.3, q, 14, true, 0.75, Math.PI * 2 - 1.5).translate(0, -0.115, -0.02), true),
    P('accent', torus(0.13, 0.017, q, 16, 6).rotateX(Math.PI / 2).translate(0, 0.055, -0.005)),
  ] },
  // a pilgrim's wide straw cone
  sunhat: { cap: true, cover: { t: 0.03, front: 30, side: 26, back: 22 }, parts: (q) => [
    P('hat', cone(0.44, 0.19, q, 22).translate(0, 0.16, 0), true),
    P('accent', sphere(0.028, q, 8, 6).translate(0, 0.258, 0)),
    P('accent', cyl(0.12, 0.12, 0.025, q, 14, true).translate(0, 0.08, 0)),
  ] },
  // the rim: a tall stovepipe
  tophat: { cap: true, cover: { t: 0.02, front: 34, side: 30, back: 26 }, parts: (q) => [
    P('hat', cyl(0.2, 0.2, 0.012, q, 20).translate(0, 0.09, 0), true),
    P('hat', cyl(0.118, 0.102, 0.34, q, 14).rotateX(-0.06).translate(0, 0.265, -0.01), true),
    P('accent', cyl(0.106, 0.104, 0.045, q, 14, true).translate(0, 0.12, 0)),
  ] },
  // the rim: a tall cone swept back, a band at the brow
  spire: { cap: true, cover: { t: 0.015, front: 36, side: 30, back: 20 }, parts: (q) => [
    P('hat', cone(0.112, 0.52, q, 14).translate(0, 0.26, 0).rotateX(-0.42).translate(0, 0.06, -0.02), true),
    P('accent', torus(0.112, 0.018, q, 16, 6).rotateX(Math.PI / 2 - 0.42).translate(0, 0.07, -0.02)),
  ] },
  // the bottom of the shaft: a big droopy hood and a lumpy cowl
  raghood: { cap: false, parts: (q) => [
    P('cloak', sphere(0.175, q, 12, 9, Math.PI / 2 + 0.62, Math.PI * 2 - 1.24, 0, Math.PI * 0.78).scale(1.05, 1.12, 1.15).translate(0, 0.0, -0.035), true),
    P('cloak', torus(0.13, 0.055, q, 12, 6).scale(1, 1, 0.8).rotateX(Math.PI / 2).translate(0, -0.14, -0.01), true),
  ] },
  // Vael: a monk's cowl rising to a tall point behind, the cloth falling over the shoulders
  cowl: { cap: false, parts: (q) => [
    P('cloak', sphere(0.168, q, 14, 10, Math.PI / 2 + 0.7, Math.PI * 2 - 1.4).scale(1, 1.2, 1.15).translate(0, 0.012, -0.02), true),
    P('cloak', cone(0.125, 0.46, q, 10).translate(0, 0.23, 0).rotateX(-0.5).translate(0, 0.1, -0.07), true),
    P('cloak', cyl(0.15, 0.24, 0.22, q, 14, true, 0.6, Math.PI * 2 - 1.2).translate(0, -0.17, -0.02), true),
  ] },
  // the Hangar: a round helmet, ear discs and two antennae
  antenna: { cap: false, parts: (q) => [
    P('hat', sphere(0.143, q, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(1, 0.98, 1.06).translate(0, 0.012, -0.01), true),
    P('accent', torus(0.136, 0.014, q, 16, 4).rotateX(Math.PI / 2).translate(0, 0.0, -0.005)),
    ...[1, -1].flatMap((s) => [
      P('metal', cyl(0.042, 0.042, 0.035, q, 10).rotateZ(Math.PI / 2).translate(s * 0.138, -0.01, 0)),
      P('metal', cyl(0.006, 0.006, 0.28, q, 4).translate(0, 0.14, 0).rotateZ(-s * 0.4).translate(s * 0.07, 0.12, -0.02), true),
      P('accent', sphere(0.024, q, 6, 4).translate(0, 0.28, 0).rotateZ(-s * 0.4).translate(s * 0.07, 0.12, -0.02), true),
    ]),
  ] },
  // the Buried Machine: a padded hood with a thick rolled rim and ear pads
  padded: { cap: false, parts: (q) => [
    P('hat', sphere(0.152, q, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.64).scale(1.06, 1.0, 1.12).translate(0, 0.005, -0.012), true),
    P('accent', torus(0.138, 0.034, q, 16, 6).rotateX(Math.PI / 2 + 0.3).translate(0, -0.01, 0.0), true),
    ...[1, -1].map((s) => P('accent', cyl(0.058, 0.058, 0.055, q, 10).rotateZ(Math.PI / 2).translate(s * 0.14, -0.03, -0.01))),
  ] },
  // Viridel: loose hair and a crown of blossoms
  flowers: { cap: true, cover: { t: 0.012, front: 30, side: 26, back: 22, band: 12 }, parts: (q, l) => [
    P('hair', curtain(q, { kind: kindOf(l), t: 0.012, open: 1.1, bottom: -0.17, backDrop: 0.05, flare: 0.026, rows: 3 })),
    ...blossoms(q < 0.5 ? 7 : 10, 0.13, 0.07, -0.22, 0.044, q, ['hat', 'accent', 'hat']).map((p) => ((p.far = true), p)),
  ] },
  // the Garden of Spheres: a round hat like a small sphere, ringed
  orb: { cap: true, cover: { t: 0.015, front: 34, side: 30, back: 26 }, parts: (q) => [
    P('hat', sphere(0.165, q, 16, 12).translate(0, 0.2, -0.01), true),
    P('accent', torus(0.168, 0.01, q, 22, 4).rotateX(Math.PI / 2 + 0.28).translate(0, 0.2, -0.01), true),
    P('accent', sphere(0.026, q, 8, 6).translate(0, 0.37, -0.01)),
  ] },
  // the deep wood: a wide brim, a rod over the face, a little lantern hanging from it
  lamphat: { cap: true, cover: { t: 0.03, front: 30, side: 26, back: 22 }, parts: (q) => [
    P('hat', cyl(0.31, 0.31, 0.012, q, 20).translate(0, 0.075, 0), true),
    P('hat', cyl(0.09, 0.122, 0.12, q, 12).translate(0, 0.135, 0), true),
    P('wood', cyl(0.006, 0.006, 0.3, q, 4).rotateX(1.0).translate(0, 0.16, 0.33), true),
    P('metal', cone(0.045, 0.04, q, 8).translate(0, 0.2, 0.46)),
    P('lamp', cyl(0.034, 0.034, 0.065, q, 8).translate(0, 0.15, 0.46), true),
  ] },
  // Lorn: a thatch of reeds, rising to a point and drooping over the shoulders
  reeds: { cap: false, parts: (q) => [
    P('hat', cone(0.2, 0.42, q, 9).translate(0, 0.22, -0.01), true),
    P('hat', jag(cyl(0.13, 0.27, 0.24, q, 9, true).translate(0, -0.02, -0.01), 0.04, -0.12), true),
  ] },
  // the market: a big wound turban, a jewel and a plume
  turban: { cap: false, parts: (q) => [
    P('hat', sphere(0.152, q, 14, 10).scale(1.1, 0.8, 1.12).translate(0, 0.1, -0.01), true),
    P('accent', torus(0.132, 0.042, q, 16, 6).rotateX(Math.PI / 2).rotateZ(0.15).translate(0, 0.055, -0.005), true),
    P('lamp', sphere(0.024, q, 8, 6).translate(0, 0.08, 0.155)),
    P('accent', cone(0.02, 0.22, q, 4).rotateX(-0.35).translate(0, 0.26, 0.06), true),
  ] },
  fez: { cap: true, cover: { t: 0.008, front: 26, side: 22, back: 18 }, parts: (q) => [
    P('hat', cyl(0.086, 0.104, 0.16, q, 12).translate(0, 0.14, -0.005), true),
    P('accent', cyl(0.004, 0.004, 0.1, q, 3).rotateZ(0.6).translate(0.04, 0.19, -0.005)),
    P('accent', sphere(0.018, q, 6, 4).translate(0.085, 0.15, -0.005)),
  ] },
  // home: a soft cap with a peak, and a headband
  cap: { cap: true, cover: { t: 0.015, front: 16, side: 22, back: 20 }, parts: (q, l) => [
    P('hat', sphere(0.132, q, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1.06, 0.78, 1.1).translate(0, 0.05, -0.012), true),
    P('accent', visor(q, kindOf(l), 24, 0.065, 0.02, 58, 0.18)),
  ] },
  // (the band round the skull's own shape, so it sits on the head all round, on any head)
  band: { cap: true, cover: { t: 0.006, front: 26, side: 20, back: 14, band: 12 }, parts: (q, l) => [
    P('hat', rim(q, { kind: kindOf(l), t: 0.01, front: 26, side: 20, back: 14, h: 11, r: 0.012, cols: 20 })),
    P('hair', sphere(0.05, q, 10, 8).scale(1.4, 0.8, 1.2).translate(0, 0.125, -0.02)),
  ] },
  // Sefa's cap, worn over her braid: the cap's own shape, the braid falling from under it (the hair
  // the wearer has under it: look.under; on a MakeHuman body her own braid, squashed under the cap)
  braidcap: { cap: true, cover: { t: 0.015, front: 16, side: 22, back: 20 }, parts: (q, l) => [
    ...HEADS.cap.parts(q, l),
    ...HEADS.braid.parts(q, l).map((pc) => P(pc.role === 'accent' ? 'hair' : pc.role, pc.geo, pc.far)),
  ] },
  beret: { cap: true, cover: { t: 0.02, front: 40, side: 34, back: 30 }, parts: (q) => [
    P('hat', sphere(0.15, q, 14, 8).scale(1, 0.32, 1).rotateZ(0.25).translate(0.02, 0.105, -0.01), true),
    P('hat', cyl(0.006, 0.006, 0.03, q, 4).translate(0.03, 0.15, -0.01)),
  ] },
  // ---- more headwear (docs/makehuman.md, stage 3): hats wide and narrow, caps, bands, knit and fur.
  // Each is fitted to the skull egg (shell, rim: a hairline round the head), so it sits on any head the
  // skull is measured on (a MakeHuman body's: profile.headScale); `cover` is the part of the skull it
  // covers (a hairline: front, side, back, degrees; t: how far off the skull its inside is), so a
  // MakeHuman body's hair is squashed under it and falls below it (src/makehuman/hair.js squashHair).
  // a wide soft hat, the brim drooping front and back, the crown dented on top
  brim: { cap: true, cover: { t: 0.034, front: 30, side: 26, back: 22 }, parts: (q) => [
    P('hat', droop(lathe([[0.33, 0.052], [0.29, 0.062], [0.2, 0.074], [0.128, 0.08], [0.126, 0.1], [0.118, 0.165], [0.096, 0.19], [0.05, 0.178], [0, 0.17]], q, 20), 0.14, 0.03, 0.012), true),
    P('accent', cyl(0.133, 0.132, 0.03, q, 16, true).translate(0, 0.095, 0)),
  ] },
  // a flat straw hat: a low crown, a broad flat brim, a ribbon round it
  straw: { cap: true, cover: { t: 0.03, front: 32, side: 28, back: 24 }, parts: (q) => [
    P('hat', lathe([[0.36, 0.07], [0.33, 0.074], [0.2, 0.08], [0.13, 0.083], [0.128, 0.09], [0.124, 0.14], [0.11, 0.15], [0, 0.152]], q, 22), true),
    P('accent', cyl(0.134, 0.133, 0.026, q, 16, true).translate(0, 0.098, 0)),
    ...Pq('accent', q < 1 ? null : box(0.03, 0.12, 0.004).rotateX(0.35).translate(0.05, 0.04, -0.15)),
  ] },
  // a narrow-brimmed hat, its crown pinched at the front, a band
  trilby: { cap: true, cover: { t: 0.03, front: 40, side: 32, back: 26 }, parts: (q) => [
    P('hat', droop(lathe([[0.19, 0.06], [0.17, 0.07], [0.124, 0.08], [0.122, 0.1], [0.114, 0.17], [0.09, 0.188], [0.04, 0.176], [0, 0.172]], q, 18), 0.12, -0.012, 0.016, true), true),
    P('accent', cyl(0.128, 0.127, 0.026, q, 16, true).translate(0, 0.094, 0)),
  ] },
  // a round hard crown, a narrow brim curled up at the sides
  bowler: { cap: true, cover: { t: 0.03, front: 42, side: 34, back: 28 }, parts: (q) => [
    P('hat', droop(lathe([[0.165, 0.09], [0.15, 0.08], [0.124, 0.082], [0.122, 0.1], [0.121, 0.13], [0.11, 0.17], [0.08, 0.196], [0.04, 0.206], [0, 0.208]], q, 18), 0.12, -0.022, 0, false, true), true),
    P('accent', cyl(0.127, 0.126, 0.022, q, 16, true).translate(0, 0.093, 0)),
  ] },
  // a cap with a peak over the eyes, a button on top
  peak: { cap: true, cover: { t: 0.008, front: 20, side: 18, back: 4 }, parts: (q, l) => [
    P('hat', shell(q, { kind: kindOf(l), t: 0.014, front: 34, side: 22, back: 4, flat: 0.97 })),
    P('hat', visor(q, kindOf(l), 34, 0.075, 0.014, 70)),
    ...Pq('accent', q < 1 ? null : sphere(0.012, q, 6, 4).scale(1, 0.6, 1).translate(0, 0.128, -0.005)),
  ] },
  // a flat cap sloping forward to a short peak
  flatcap: { cap: true, cover: { t: 0.008, front: 18, side: 18, back: 6, top: 0.102 }, parts: (q, l) => [
    P('hat', slope(shell(q, { kind: kindOf(l), t: 0.014, front: 30, side: 22, back: 10, flat: 0.86, bulge: 0.005 }), 0.022)),
    P('hat', visor(q, kindOf(l), 30, 0.042, 0.013, 52, 0.3)),
  ] },
  // a knit cap with a folded rim (and a bobble now and then)
  beanie: { cap: true, cover: { t: 0.01, front: 30, side: 12, back: -8 }, parts: (q, l) => [
    P('hat', shell(q, { kind: kindOf(l), t: 0.016, front: 30, side: 12, back: -8, bulge: 0.012, rows: 7 }), true),
    P('accent', rim(q, { kind: kindOf(l), t: 0.016, front: 30, side: 12, back: -8, h: 13, r: 0.01, cols: q < 1 ? 16 : 28 })),
    ...Pq('accent', q >= 1 && hashSeed(`${l?.hat}|${l?.hair}`) % 3 === 0 ? sphere(0.03, q, 8, 6).translate(0, 0.146, -0.01) : null),
  ] },
  // a fur hat with its ear-flaps down and its front flap turned up
  trapper: { cap: true, cover: { t: 0.012, front: 32, side: -52, back: -10 }, parts: (q, l) => {
    const k = kindOf(l);
    return [
      P('hat', shell(q, { kind: k, t: 0.02, front: 32, side: 6, back: -10, bulge: 0.006 })),
      P('accent', rim(q, { kind: k, t: 0.022, front: 32, side: 6, back: -10, h: 12, r: 0.016 })),
      ...[1, -1].map((s) => P('accent', patch(q, { kind: k, az0: s * 62, az1: s * 118, el0: -52, el1: 8, t0: 0.03, t1: 0.024, cols: 5, rows: 3 }), true)),
      P('accent', patch(q, { kind: k, az0: -44, az1: 44, el0: 33, el1: 54, t0: 0.03, t1: 0.046, cols: 7, rows: 2 })),
    ];
  } },
  // an aviator's leather cap down over the ears, a seam over the crown
  aviator: { cap: false, parts: (q, l) => {
    const k = kindOf(l), S = SKULL[k];
    return [
      P('hat', shell(q, { kind: k, t: 0.012, front: 34, side: -34, back: -34, ears: 0, rows: 8 })),
      ...Pq('accent', q < 1 ? null : seam(q, k, 36, 0.013)),
      ...[1, -1].map((s) => P('accent', cyl(0.03, 0.03, 0.008, q, 10).rotateZ(Math.PI / 2).translate(s * (S.x + 0.016), -0.012, -0.006))),
    ];
  } },
  // a kerchief tied over the head, knotted at the back, two short tails
  bandana: { cap: true, cover: { t: 0.003, front: 34, side: 18, back: -14 }, parts: (q, l) => {
    const k = kindOf(l), S = SKULL[k];
    return [
      P('hat', shell(q, { kind: k, t: 0.008, front: 34, side: 18, back: -14 })),
      ...(q < 1 ? [] : [P('hat', sphere(0.022, q, 8, 6).scale(1.2, 0.9, 0.8).translate(0, -0.03, -S.back - 0.02)),
        ...[1, -1].map((s) => P('hat', box(0.03, 0.09, 0.005).rotateX(0.25).rotateZ(s * 0.3).translate(s * 0.018, -0.075, -S.back - 0.022)))]),
    ];
  } },
  // a headscarf over the hair, framing the face, knotted under the chin
  kerchief: { cap: false, parts: (q, l) => {
    const k = kindOf(l);
    return [
      P('hat', shell(q, { kind: k, t: 0.012, front: 36, side: -28, back: -62, rows: q < 1 ? 6 : 9, cols: q < 1 ? 20 : 28, bulge: 0.004 })),
      ...(q < 1 ? [] : [P('hat', sphere(0.02, q, 8, 6).scale(1.3, 0.8, 0.9).translate(0, -0.15, 0.07)),
        ...[1, -1].map((s) => P('hat', box(0.024, 0.07, 0.005).rotateZ(s * 0.25).translate(s * 0.012, -0.19, 0.072)))]),
    ];
  } },
  // a small round cap on the crown
  skullcap: { cap: true, cover: { t: 0.002, front: 56, side: 52, back: 46 }, parts: (q, l) => [
    P('hat', shell(q, { kind: kindOf(l), t: 0.006, front: 56, side: 52, back: 46, cols: 18, rows: 3 })),
  ] },
  // a thin band round the brow, a stone at the front
  circlet: { cap: true, cover: { t: 0.002, front: 25, side: 15, back: 3, band: 8 }, parts: (q, l) => [
    P('metal', rim(q, { kind: kindOf(l), t: 0.006, front: 26, side: 16, back: 4, h: 5, r: 0.004, cols: 24 })),
    ...Pq('accent', q < 1 ? null : sphere(0.011, q, 6, 4).translate(...onSkull(SKULL[kindOf(l)], 0, 29 * DEG, 0.012))),
  ] },
  // a miner's hard hat: a ridge, a short brim, a lamp at the front
  helmet: { cap: false, parts: (q, l) => {
    const S = SKULL[kindOf(l)];
    return [
      P('hat', sphere(0.148, q, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(1, 0.94, 1.08).translate(0, 0.022, -0.008), true),
      P('hat', lathe([[0.19, 0.014], [0.19, 0.024], [0.15, 0.026], [0.142, 0.03]], q, 18).scale(1, 1, 1.1), true),
      P('accent', box(0.02, 0.02, 0.26).translate(0, 0.16, -0.01)),
      P('metal', cyl(0.026, 0.03, 0.03, q, 8).rotateX(Math.PI / 2).translate(0, 0.08, S.front + 0.04)),
      P('lamp', cyl(0.022, 0.022, 0.006, q, 8).rotateX(Math.PI / 2).translate(0, 0.08, S.front + 0.056)),
    ];
  } },
  // a hood thrown back: the head bare, the cloth in folds at the nape
  hooddown: { cap: true, cover: { t: 0, front: 90, side: 90, back: 90 }, parts: () => [], chest: (q) => [
    P('cloak', ellipseTube(q, { rx: 0.105, front: 0.085, back: 0.1, y: 0.765, az0: 62, az1: 298, r: 0.034 }), true),
    P('cloak', sphere(0.1, q, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1.25, 0.95, 0.42).rotateX(-0.5).translate(0, 0.66, -0.135), true),
  ] },
};

// ------------------------------------------------------------------ the headwear's shapes
/** A hat (head frame) turned from a profile of [radius, height] pairs (from the brim's edge in to the crown's top). */
function lathe(points, q, n = 16) {
  // (the crowd's figure: every other point of the profile, its ends kept)
  const pts = q < 1 ? points.filter((_, i) => i === 0 || i === points.length - 1 || i % 2 === 0) : points;
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), sg(n, q));
}
/**
 * A brim that droops (or curls): at radius over `r0` it drops by `front` (m, +: down) at the front and back
 * and rises by `side` at the sides (m: a bowler's curled sides); the crown dented over the top (`dent`, m;
 * pinched at the front with `pinch`). `curl`: the brim curls up all round its edge.
 */
function droop(g, r0, front, dent = 0, pinch = false, curl = false) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(x, z);
    if (r > r0) {
      const d = (r - r0) / Math.max(1e-3, 0.36 - r0), fb = Math.cos(a) ** 2;
      p.setY(i, y - (front * fb - (curl ? Math.abs(front) * 1.2 * (1 - fb) : 0)) * d * d);
    } else if (dent && y > 0.15) {
      const t = Math.max(0, 1 - r / 0.1);
      p.setY(i, y - dent * t * (pinch ? 1 : 0.7) * (1 - 0.4 * Math.cos(a)));
      if (pinch && z > 0.03 && y > 0.12) p.setX(i, x * (1 - 0.18 * Math.min(1, (y - 0.12) / 0.06)));
    }
  }
  g.computeVertexNormals();
  return g;
}
/**
 * A cap on the skull (head frame): a shell `t` off it from a hairline (front, side, back: degrees of
 * elevation; `ears` lifts it round them) to the crown, a little fuller in the middle (`bulge`, m), its top
 * flattened to `flat` of the skull's height (a cap's crown). The seam down the back, like the hair's.
 */
function shell(q, { kind = 'm', t = 0.012, front = 30, side = 10, back = -10, top = 90, ears = 0, cols = 28, rows = 6, flat = 1, bulge = 0 } = {}) {
  const S = SKULL[kind] ?? SKULL.m;
  cols = sg(cols, q); rows = sg(rows, q);
  const pos = [], ceil = S.y * flat + t;
  for (let j = 0; j <= cols; j++) {
    const az = Math.PI + (j / cols) * Math.PI * 2, edge = hairline(az, front, side, back, 0, ears);
    for (let i = 0; i <= rows; i++) {
      const u = i / rows, el = edge + (top * DEG - edge) * u;
      const p = onSkull(S, az, el, t + bulge * Math.sin(u * Math.PI));
      if (p[1] > ceil) p[1] = ceil + (p[1] - ceil) * 0.15;
      pos.push(...p);
    }
  }
  return grid(pos, cols, rows, true);
}
/** A rolled rim round a hairline (head frame): from its edge up `h` degrees, standing `r` (m) out at its middle, `t` off the skull. */
function rim(q, { kind = 'm', t = 0.012, front = 30, side = 10, back = -10, h = 12, r = 0.01, cols = 28, ears = 0 } = {}) {
  const S = SKULL[kind] ?? SKULL.m;
  cols = sg(cols, q);
  const pos = [], rows = 2;
  for (let j = 0; j <= cols; j++) {
    const az = Math.PI + (j / cols) * Math.PI * 2, edge = hairline(az, front, side, back, 0, ears);
    for (let i = 0; i <= rows; i++) pos.push(...onSkull(S, az, edge + (h * DEG * i) / rows, t + (i === 1 ? r : 0.002)));
  }
  return grid(pos, cols, rows, true);
}
/** A cap's peak (head frame): from its hairline at the front (`front` degrees) out `len` (m), tipping down, `width` degrees either side. */
function visor(q, kind, front, len, t, width = 70, dip = 0.22) {
  const S = SKULL[kind] ?? SKULL.m, cols = sg(12, q), pos = [];
  for (let j = 0; j <= cols; j++) {
    const az = (-width + (2 * width * j) / cols) * DEG, edge = hairline(az, front, 0, 0, 0, 0);
    const base = onSkull(S, az, edge, t), out = len * Math.cos(az * 1.15) ** 0.6;
    const n = [Math.sin(az), 0, Math.cos(az)];
    pos.push(...base, base[0] + n[0] * out, base[1] - out * dip, base[2] + n[2] * out);
  }
  return grid(pos, cols, 1);
}
/** A tube round an ellipse at height y (rx wide, `front` / `back` deep), azimuths az0..az1 degrees (0 the front), r thick: a rolled hem. */
function ellipseTube(q, { rx, front, back = front, y, az0 = 0, az1 = 360, r = 0.01 }) {
  const pts = [], n = sg(16, q);
  for (let i = 0; i <= n; i++) {
    const a = (az0 + ((az1 - az0) * i) / n) * DEG;
    pts.push(new THREE.Vector3(Math.sin(a) * rx, y, Math.cos(a) * (Math.cos(a) > 0 ? front : back)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, r, q < 1 ? 4 : 6);
}
/** A seam over the crown from the brow (`from` degrees) to the nape (head frame), `t` off the skull. */
function seam(q, kind, from, t, r = 0.004) {
  const S = SKULL[kind] ?? SKULL.m, pts = [];
  for (let e = from; e <= 180 - from + 0.1; e += 8) pts.push(new THREE.Vector3(...onSkull(S, e <= 90 ? 0 : Math.PI, (e <= 90 ? e : 180 - e) * DEG, t)));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), sg(14, q), r, q < 1 ? 3 : 4);
}
/** A flat cap's crown pulled forward over the peak (head frame): the higher and further forward, the more (m). */
function slope(g, k) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), z = p.getZ(i);
    if (y <= 0.05) continue;
    const up = Math.min(1, (y - 0.05) / 0.06), fwd = THREE.MathUtils.smoothstep(z, -0.06, 0.09);
    p.setZ(i, z + k * up * fwd);
    p.setX(i, p.getX(i) * (1 + 0.08 * up * fwd));
  }
  g.computeVertexNormals();
  return g;
}

/** Masks (head frame). */
export const MASKS = {
  none: () => [],
  veil: (q) => [P('accent', cyl(0.124, 0.118, 0.1, q, 12, true, -1.3, 2.6).translate(0, -0.085, 0.0))],
  beak: (q) => [
    P('hat', sphere(0.128, q, 12, 8, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.3, Math.PI * 0.42).translate(0, -0.005, 0.005)),
    P('hat', cone(0.042, 0.26, q, 8).rotateX(Math.PI / 2 + 0.3).translate(0, -0.04, 0.2), true),
    ...[1, -1].map((s) => P('dark', sphere(0.019, q, 6, 4).translate(s * 0.042, 0.012, 0.112))),
  ],
  breather: (q) => [
    P('metal', cyl(0.042, 0.052, 0.075, q, 8).rotateX(Math.PI / 2).translate(0, -0.075, 0.125)),
    P('dark', cyl(0.05, 0.05, 0.014, q, 8).rotateX(Math.PI / 2).translate(0, -0.075, 0.165)),
    ...[1, -1].map((s) => P('accent', cyl(0.027, 0.027, 0.09, q, 6).rotateX(0.3).rotateZ(s * 0.6).translate(s * 0.078, -0.1, 0.075))),
  ],
  goggles: (q) => goggles(q, 0.008, 0),
  browgoggles: (q) => goggles(q, 0.075, -0.35),
  // a beard round the jaw (some of the men: dressFor)
  beard: (q) => [P('hair', beardShell(q))],
  // ---- more (stage 3): round spectacles, dark glasses, a cloth over the mouth, a desert face-wrap, a monocle, goggles round the neck
  glasses: (q) => (q < 1 ? [] : [
    ...[1, -1].flatMap((s) => [
      P('dark', torus(0.019, 0.0026, q, 14, 4).translate(s * 0.036, 0.004, 0.118)),
      P('dark', box(0.003, 0.003, 0.1).rotateY(s * 0.12).translate(s * 0.074, 0.01, 0.064)),
    ]),
    P('dark', torus(0.009, 0.002, q, 8, 3, Math.PI).translate(0, 0.008, 0.121)),
  ]),
  shades: (q) => [
    P('dark', patch(q, { az0: -50, az1: 50, el0: -5, el1: 8, t0: 0.03, t1: 0.028, cols: 10, rows: 1 }), true),
    P('dark', ellipseTube(q, { rx: 0.092, front: 0.1, back: 0.112, y: 0.006, az0: 50, az1: 310, r: 0.0035 })),
  ],
  scarfmask: (q) => [
    P('accent', faceCloth(q, [[-0.008, 0.08, 0.112], [-0.04, 0.08, 0.124], [-0.075, 0.07, 0.118], [-0.105, 0.06, 0.11], [-0.128, 0.056, 0.104, 0.1, 0.04]], 1.45), true),
    ...Pq('accent', q < 1 ? null : ellipseTube(q, { rx: 0.095, front: 0.1, back: 0.11, y: -0.012, az0: 84, az1: 276, r: 0.005 })),
  ],
  // (wound: every other row stands out, so the turns of the cloth read)
  facewrap: (q) => [P('hat', faceCloth(q, [[-0.014, 0.094, 0.108, 0.104], [-0.03, 0.1, 0.128, 0.108], [-0.05, 0.096, 0.121, 0.102], [-0.075, 0.084, 0.124, 0.097],
    [-0.1, 0.07, 0.111, 0.09], [-0.125, 0.071, 0.113, 0.093], [-0.15, 0.064, 0.094, 0.09], [-0.178, 0.075, 0.1, 0.099]], Math.PI), true)],
  monocle: (q) => (q < 1 ? [] : [
    P('metal', torus(0.02, 0.0028, q, 14, 4).translate(-0.036, 0.004, 0.119)),
    P('metal', new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.054, -0.006, 0.112], [-0.066, -0.06, 0.104], [-0.07, -0.12, 0.09]].map((v) => new THREE.Vector3(...v))), sg(8, q), 0.0015, 3)),
  ]),
};
/**
 * A cloth over the lower face (head frame): rows of [y, half width, depth in front, depth behind, drop] from
 * the nose's bridge down (measured round the MakeHuman and the game's faces, a little off them), round the
 * face within ±open rad (π: all round, the neck too); `drop` (m) lets a row hang lower at the front (a point).
 */
function faceCloth(q, rows, open = 1.75) {
  if (q < 1 && rows.length > 4) rows = rows.filter((_, i) => i % 2 === 0 || i === rows.length - 1);
  const cols = sg(open >= Math.PI - 1e-6 ? 22 : 14, q), pos = [];
  for (let j = 0; j <= cols; j++) {
    const az = -open + (2 * open * j) / cols, c = Math.cos(az);
    for (const [y, rx, rz, back = 0.1, drop = 0] of rows) pos.push(Math.sin(az) * rx, y - drop * Math.max(0, c) ** 2, c * (c > 0 ? rz : back));
  }
  return grid(pos, cols, rows.length - 1, open >= Math.PI - 1e-6);
}
/** Goggles at height y (head frame), tilted `tilt` rad (up on the brow: negative); `ring` scales the strap round (round the neck: wider). */
function goggles(q, y, tilt, ring = 1) {
  const out = [], z = ring > 1 ? -0.035 : 0;
  for (const s of [1, -1]) {
    out.push(P('metal', cyl(0.031, 0.031, 0.036, q, 8).rotateX(Math.PI / 2 + tilt).translate(s * 0.043, y, 0.105 - tilt * 0.03 + z)));
    out.push(P('dark', cyl(0.025, 0.025, 0.004, q, 8).rotateX(Math.PI / 2 + tilt).translate(s * 0.043, y + tilt * -0.016, 0.124 - tilt * 0.03 + z)));
  }
  out.push(P('dark', torus(0.123 * ring, 0.009, q, 16, 4).rotateX(Math.PI / 2 + tilt * 0.4).translate(0, y + 0.004, -0.005 + z * 0.6)));
  return out;
}

/** Shoulder and chest pieces (chest frame). */
export const BODIES = {
  none: () => [],
  // the rim: a stiff collar standing up behind the head
  collar: (q) => [P('accent', cyl(0.2, 0.115, 0.24, q, 14, true, 0.85, Math.PI * 2 - 1.7).translate(0, 0.84, -0.015), true)],
  // Vael: a scarf round the neck, its long tail streaming back in the wind
  scarf: (q) => {
    const ribbon = new THREE.PlaneGeometry(0.1, 1, 1, sg(9, q));
    const p = ribbon.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = 0.5 - p.getY(i), u = p.getX(i);
      p.setXYZ(i, 0.06 + u + 0.05 * Math.sin(t * 6) + t * 0.12, 0.72 - t * 0.5, -0.11 - t * 0.6 + 0.03 * Math.sin(t * 9 + 1));
    }
    ribbon.computeVertexNormals();
    return [P('accent', torus(0.1, 0.036, q, 14, 6).rotateX(Math.PI / 2).translate(0, 0.745, 0.005)), P('accent', ribbon, true)];
  },
  pauldrons: (q) => [1, -1].map((s) => P('accent', sphere(0.088, q, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1.15, 0.8, 1.1).translate(s * 0.2, 0.685, 0), true)),
  // the desert: a short cape over the shoulders
  mantle: (q) => [P('cloak', cyl(0.16, 0.3, 0.28, q, 16, true).translate(0, 0.6, -0.005), true)],
  // Lorn: a long rough cape of reeds
  reedcape: (q) => [P('hat', jag(new THREE.CylinderGeometry(0.16, 0.37, 0.52, sg(14, q), 2, true).translate(0, 0.48, -0.01), 0.05, 0.3), true)],
  // the bottom of the shaft: rags over the shoulders
  tatters: (q) => [P('cloak', jag(new THREE.CylinderGeometry(0.17, 0.31, 0.34, sg(12, q), 1, true).translate(0, 0.57, -0.01), 0.05, 0.5), true)],
  // Viridel: a garland of blossoms
  garland: (q) => blossoms(q < 0.5 ? 7 : 11, 0.13, 0.71, 0.4, 0.036, q, ['hat', 'accent']),
  // the market: a sign worn as a badge
  badge: (q) => [
    P('accent', box(0.12, 0.09, 0.012).rotateZ(0.1).rotateX(-0.12).translate(0.06, 0.52, 0.13)),
    P('dark', box(0.075, 0.014, 0.004).rotateZ(0.1).rotateX(-0.12).translate(0.06, 0.535, 0.138)),
    P('dark', box(0.05, 0.012, 0.004).rotateZ(0.1).rotateX(-0.12).translate(0.058, 0.507, 0.136)),
  ],
  // the Hangar: a tool belt with pouches and a hammer
  toolbelt: (q) => [
    P('dark', torus(0.152, 0.02, q, 16, 4).scale(1, 0.82, 1).rotateX(Math.PI / 2).translate(0, 0.27, 0)),
    ...[1, -1].map((s) => P('wood', box(0.07, 0.08, 0.045).rotateY(s * 0.7).translate(s * 0.12, 0.23, 0.08))),
    P('metal', box(0.02, 0.2, 0.02).translate(-0.165, 0.16, -0.02)),
    P('metal', box(0.07, 0.03, 0.03).translate(-0.165, 0.07, -0.02)),
  ],
  // (stage 3) a kerchief knotted at the throat, its point down the chest
  neckerchief: (q) => [
    P('accent', torus(0.085, 0.016, q, 14, 5).scale(1, 1, 1.12).rotateX(Math.PI / 2 - 0.18).translate(0, 0.745, 0.012)),
    ...Pq('accent', q < 1 ? null : sphere(0.022, q, 7, 5).scale(1.2, 0.9, 0.8).translate(0, 0.705, 0.1)),
    P('accent', cone(0.055, 0.12, q, 3).rotateX(Math.PI).scale(1, 1, 0.25).rotateX(-0.25).translate(0, 0.64, 0.11)),
  ],
  // (stage 3) goggles hung round the neck
  neckgoggles: (q) => q < 1 ? [
    P('dark', ellipseTube(q, { rx: 0.085, front: 0.1, back: 0.075, y: 0.735, r: 0.007 })),
    P('metal', box(0.13, 0.035, 0.03).rotateX(1.0).translate(0, 0.69, 0.105)),
  ] : [
    ...[1, -1].flatMap((s) => [
      P('metal', cyl(0.03, 0.03, 0.03, q, 8).rotateX(Math.PI / 2 + 1.0).translate(s * 0.042, 0.695, 0.1)),
      P('dark', cyl(0.024, 0.024, 0.004, q, 8).rotateX(Math.PI / 2 + 1.0).translate(s * 0.042, 0.683, 0.113)),
    ]),
    P('dark', ellipseTube(q, { rx: 0.085, front: 0.1, back: 0.075, y: 0.735, r: 0.007 })),
  ],
  // (stage 3) a thick muffler wound round the neck, its two ends hanging in front
  muffler: (q) => [
    P('accent', torus(0.092, 0.038, q, 14, 6).rotateX(Math.PI / 2).translate(0, 0.75, 0.005)),
    ...Pq('accent', q < 1 ? null : torus(0.09, 0.03, q, 12, 5).rotateX(Math.PI / 2 + 0.25).translate(0, 0.705, 0.012)),
    P('accent', box(0.06, 0.24, 0.016).rotateZ(0.08).rotateX(-0.2).translate(0.045, 0.6, 0.115)),
    P('accent', box(0.055, 0.17, 0.016).rotateZ(-0.12).rotateX(-0.25).translate(-0.02, 0.63, 0.122)),
  ],
  // ---- the desert's own, from its character sheets (references/The Desert/characters)
  // Bako's bag (his sheet): a big soft canvas shoulder bag, slouching at his left hip over his coat, its flap
  // folded over the top and down the front, on a wide strap across his chest and over his right shoulder
  // (canvas: FIXED.canvas)
  satchel: (q) => {
    const at = [0.2, 0.2, 0.255], turn = Math.atan2(at[0], at[2]);
    const place = (g) => g.rotateY(turn).translate(...at);
    const out = [
      P('canvas', place(softBox(0.32, 0.28, 0.13, q, { slouch: 0.22 })), true),
      // the flap: over the top and two thirds down the front, a little proud of the bag, its edge dipping
      P('canvas', place(softBox(0.335, 0.2, 0.145, q, { slouch: 0.06, dip: 0.02 }).translate(0, 0.05, 0.008)), true),
      ...Pq('dark', q < 1 ? null : place(cyl(0.009, 0.009, 0.034, q, 5).rotateZ(Math.PI / 2).translate(0, -0.072, 0.083))),   // (the toggle on the flap's edge)
    ];
    // the strap: from the bag's top over his right shoulder, down his back to the bag again
    out.push(P('canvas', strapRibbon([[0.1, 0.32, 0.27], [0.02, 0.48, 0.21], [-0.09, 0.64, 0.13], [-0.16, 0.745, 0.01], [-0.11, 0.67, -0.12], [0.06, 0.47, -0.15], [0.23, 0.3, 0.07]], 0.045, q), true));
    return out;
  },
  // a keeper's bead fringe: a cord low on the hips with short strings of beads hanging from it round the front
  fringe: (q) => {
    const n = q < 1 ? 6 : 9, out = [P('accent', torus(0.15, 0.009, q, 14, 4).scale(1, 0.9, 1.05).rotateX(Math.PI / 2).translate(0, 0.3, 0.015))];
    for (let i = 0; i < n; i++) {
      const az = -1.15 + (2.3 * i) / (n - 1), x = Math.sin(az) * 0.152, z = Math.cos(az) * 0.16 + 0.015;
      const drop = 0.095 + 0.045 * Math.sin(i * 1.9 + 0.6) ** 2;
      out.push(P('hat', cyl(0.0035, 0.0035, drop, q, 3).translate(x, 0.3 - drop / 2, z), true));
      out.push(P('accent', sphere(0.016, q, 5, 3).translate(x, 0.3 - drop, z), true));
      out.push(P('hat', sphere(0.012, q, 5, 3).translate(x, 0.3 - drop * 0.5, z), true));
    }
    return out;
  },
  // a keeper's keys: a ring of them on a thong at the belt, hanging in front of the cloak's opening
  keys: (q) => {
    const out = [
      P('wood', box(0.026, 0.11, 0.011).rotateZ(0.16).translate(-0.045, 0.33, 0.155)),
      P('metal', torus(0.03, 0.006, q, 10, 4).rotateY(0.35).translate(-0.057, 0.278, 0.16), true),
    ];
    for (const [i, tilt] of [[-1, -0.3], [0, -0.03], [1, 0.26]]) {
      const g = [
        P('metal', cyl(0.005, 0.005, 0.1, q, 4).translate(0, -0.05, 0), true),
        P('metal', box(0.022, 0.013, 0.006).translate(0.012, -0.093, 0)),
        ...Pq('metal', q < 1 ? null : box(0.016, 0.012, 0.006).translate(0.009, -0.073, 0)),
      ];
      for (const pc of g) out.push(P(pc.role, pc.geo.rotateZ(tilt).rotateY(0.35).translate(-0.057 + i * 0.012, 0.272, 0.162 + i * 0.004), pc.far));
    }
    return out;
  },
  // Nour's belt (her sheets): a cord low on the hips, three clay gourds hung from it at her left and a
  // ring of keys at the front, where the cloak's opening leaves them in sight (the clay: FIXED.clay)
  gourds: (q) => {
    const out = [P('wood', torus(0.15, 0.008, q, 14, 4).scale(1, 1, 0.92).rotateX(Math.PI / 2).rotateZ(-0.07).translate(0, 0.31, 0.012), true)];
    const gourd = [[0, 0], [0.024, 0.004], [0.036, 0.02], [0.038, 0.042], [0.03, 0.062], [0.018, 0.074], [0.016, 0.088], [0.02, 0.096], [0.012, 0.104], [0, 0.106]];
    for (const [az, size, drop] of [[0.12, 1.15, 0.035], [0.4, 0.95, 0.06], [0.66, 1.05, 0.03]]) {
      const x = Math.sin(az) * 0.15, z = Math.cos(az) * 0.15 * 0.92 + 0.012, top = 0.31 + x * 0.07 - drop;
      out.push(P('wood', cyl(0.003, 0.003, drop, q, 3).translate(x, top + drop / 2, z)));
      out.push(P('clay', lathe(gourd, q, 9).scale(size, size, size).translate(x, top - 0.106 * size, z + 0.012), true));
      out.push(P('dark', cyl(0.009 * size, 0.009 * size, 0.008, q, 6).translate(x, top - 0.002, z + 0.012)));
    }
    out.push(P('metal', torus(0.026, 0.005, q, 10, 4).rotateY(-0.2).translate(-0.05, 0.27, 0.16), true));
    for (const [i, tilt] of [[-1, -0.22], [1, 0.18]]) {
      const g = [P('metal', cyl(0.005, 0.005, 0.09, q, 4).translate(0, -0.045, 0), true), P('metal', box(0.02, 0.012, 0.006).translate(0.011, -0.083, 0))];
      for (const pc of g) out.push(P(pc.role, pc.geo.rotateZ(tilt).rotateY(-0.2).translate(-0.05 + i * 0.011, 0.248, 0.163), pc.far));
    }
    return out;
  },
  // Marrow's kit (his sheet): a soft salvage bag on a strap across the chest at his left hip, a bone and a
  // length of pipe sticking out of it, worn with his scarf (a look has one chest piece; his pack is on his
  // back: BACKS.pack). He wears no cape: his sheet draws a long patched coat (his robe), not a cloak.
  scavbag: (q) => [
    // (the scarf's wound collar, and its end tucked down the front: the long tail of `scarf` was cut for a
    // cape to fall over, and over a pack it stood out across the back)
    BODIES.scarf(q)[0],
    P('accent', box(0.075, 0.15, 0.022).rotateZ(0.12).rotateX(-0.18).translate(-0.06, 0.665, 0.125), true),
    P('wood', box(0.04, 0.5, 0.012).rotateX(-0.34).rotateZ(0.7).translate(0.02, 0.53, 0.168), true),
    P('hat', sphere(0.1, q, 10, 7).scale(1.05, 0.85, 0.55).rotateZ(-0.1).rotateY(-0.25).translate(0.165, 0.28, 0.215), true),
    P('accent', sphere(0.1, q, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.42).scale(1.12, 0.6, 0.62).rotateZ(-0.1).rotateY(-0.25).translate(0.163, 0.315, 0.218), true),
    P('cloth', cyl(0.011, 0.011, 0.17, q, 5).rotateZ(0.42).translate(0.135, 0.42, 0.205), true),
    ...Pq('cloth', q < 1 ? null : sphere(0.019, q, 6, 4).scale(1.4, 1, 1).rotateZ(0.42).translate(0.1, 0.495, 0.205)),
    P('metal', cyl(0.015, 0.015, 0.15, q, 6).rotateZ(-0.35).translate(0.215, 0.4, 0.2), true),
    ...Pq('dark', q < 1 ? null : cyl(0.009, 0.009, 0.004, q, 6).rotateZ(-0.35).translate(0.24, 0.47, 0.2)),
  ],
  // the Garden of Spheres: a pleated ruff
  ruff: (q) => {
    const g = torus(0.115, 0.04, q, 24, 6).rotateX(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getX(i), p.getZ(i)); const k = 1 + 0.12 * Math.sin(a * 12); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals();
    return [P('accent', g.translate(0, 0.75, 0))];
  },
};

/** A soft box (a bag): a box rounded toward an ellipsoid, wider and sagging below (`slouch`), its lower front edge dipping in the middle (`dip`). */
function softBox(w, h, d, q, { slouch = 0, dip = 0 } = {}) {
  const n = q < 1 ? 3 : 6, g = new THREE.BoxGeometry(w, h, d, n, n, Math.max(2, n >> 1)), P = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const e = new THREE.Vector3(v.x / (w / 2), v.y / (h / 2), v.z / (d / 2)), l = e.length() || 1;
    v.lerp(new THREE.Vector3(v.x / l * Math.SQRT2, v.y / l * Math.SQRT2, v.z / l * Math.SQRT2), 0.5);
    const t = 0.5 - v.y / h;   // 0 top, 1 bottom
    v.x *= 1 + slouch * t; v.z *= 1 + slouch * 0.6 * t;
    if (dip && v.y < 0) v.y -= dip * (1 - Math.min(1, Math.abs(v.x) / (w / 2)) ** 2) * (-v.y / (h / 2));
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
/** A flat strap along a path round the body (chest frame), `width` across, its face turned out from the body. */
function strapRibbon(points, width, q) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), n = sg(28, q);
  const pos = [], idx = [], T = new THREE.Vector3(), O = new THREE.Vector3(), S = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n, p = curve.getPointAt(u);
    curve.getTangentAt(u, T);
    O.set(p.x, 0, p.z).normalize();
    S.crossVectors(T, O).normalize().multiplyScalar(width / 2);
    pos.push(p.x - S.x + O.x * 0.003, p.y - S.y, p.z - S.z + O.z * 0.003, p.x + S.x + O.x * 0.003, p.y + S.y, p.z + S.z + O.z * 0.003);
    if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Held props (right hand frame). */
export const PROPS = {
  none: () => [],
  staff: (q) => [P('wood', cyl(0.017, 0.02, 1.8, q, 6).translate(0, 0.01, 0.03), true), P('accent', sphere(0.035, q, 8, 6).translate(0, 0.92, 0.03), true)],
  lantern: (q) => lantern(q, 0, 0),
  basket: (q) => [
    P('hat', cyl(0.13, 0.1, 0.13, q, 12, true).translate(0, -0.285, 0.02), true),
    P('hat', cyl(0.1, 0.1, 0.01, q, 12).translate(0, -0.345, 0.02)),
    P('wood', torus(0.12, 0.008, q, 10, 4, Math.PI).rotateY(Math.PI / 2).translate(0, -0.22, 0.02)),
  ],
  wrench: (q) => [P('metal', box(0.024, 0.26, 0.012).translate(0, -0.19, 0.03)), P('metal', torus(0.032, 0.011, q, 8, 4, 4.6).translate(0, -0.34, 0.03))],
  parasol: (q) => [
    P('wood', cyl(0.008, 0.008, 1.3, q, 4).translate(0, 0.53, 0).rotateZ(-0.12), true),
    P('accent', cone(0.5, 0.17, q, 16, true).translate(0, 1.18, 0).rotateZ(-0.12), true),
    P('metal', sphere(0.016, q, 6, 4).translate(0, 1.29, 0).rotateZ(-0.12)),
  ],
  lamppole: (q) => [
    P('wood', cyl(0.014, 0.018, 1.95, q, 6).translate(0, 0.05, 0.02), true),
    P('wood', box(0.014, 0.014, 0.3).translate(0, 1.0, 0.16), true),
    ...lantern(q, 1.1, 0.29),
  ],
  bell: (q) => [P('wood', cyl(0.008, 0.008, 0.09, q, 4).translate(0, -0.11, 0.02)), P('metal', cyl(0.03, 0.058, 0.075, q, 10, true).translate(0, -0.19, 0.02))],
  flower: (q) => [P('wood', cyl(0.005, 0.005, 0.45, q, 3).rotateX(0.3).translate(0, 0.1, 0.08)), ...blossoms(5, 0.03, 0.31, 0, 0.026, q, ['accent', 'hat']).map((p) => (p.geo.translate(0, 0, 0.15), p))],
  // ---- the desert's own, from its character sheets (references/The Desert/characters)
  // Bako's ney: a long reed flute, knotted along its length, carried slanting up across the chest and
  // a little in front of it, so it reads clear of a long coat (its top rises past the collar)
  ney: (q) => {
    const out = [P('wood', cyl(0.012, 0.017, 0.82, q, 7).translate(0, 0.27, 0), true)];
    for (let k = 0; k < 4; k++) out.push(P('dark', cyl(0.0195, 0.0195, 0.014, q, 7).translate(0, -0.03 + k * 0.19, 0), true));
    if (q >= 1) for (let k = 0; k < 4; k++) out.push(P('dark', cyl(0.0045, 0.0045, 0.036, q, 4).rotateX(Math.PI / 2).translate(0, 0.14 + k * 0.085, 0.006)));
    return out.map((pc) => P(pc.role, pc.geo.rotateX(0.22).rotateZ(-0.14).translate(0.02, 0.0, 0.17), pc.far));
  },
  // Sefa's oud: a deep pear bowl, a flat soundboard with a rosette, a short neck and a pegbox bent back
  oud: (q) => slung(oudParts(q), HELD_OUD, q),
  // Marrow's hook: a salvager's iron hook on a short shaft, carried upright and held out in front of
  // him (the last translate), so the shaft reads against his cloak instead of disappearing inside it
  hook: (q) => [
    P('wood', cyl(0.014, 0.019, 0.6, q, 6).translate(0, 0.18, 0), true),
    P('dark', cyl(0.021, 0.021, 0.05, q, 6).translate(0, 0.465, 0)),
    P('metal', torus(0.068, 0.014, q, 12, 5, Math.PI * 1.35).rotateZ(Math.PI * 0.42).translate(0.066, 0.53, 0), true),
    P('metal', cone(0.016, 0.06, q, 6).rotateZ(-2.25).translate(0.045, 0.473, 0), true),
  ].map((pc) => P(pc.role, pc.geo.translate(0, 0, 0.22), pc.far)),
  // the Speaker's bell staff: the pilgrims' staff with the procession's bell hung from a loop at its head
  bellstaff: (q) => [
    ...PROPS.staff(q),
    P('metal', cyl(0.009, 0.009, 0.16, q, 5).rotateX(Math.PI / 2).translate(0, 0.745, 0.105)),
    P('metal', torus(0.04, 0.007, q, 12, 4).rotateY(Math.PI / 2).translate(0, 0.705, 0.175), true),
    // (the bell in copper, as his sheet draws it: the accent)
    ...PROPS.bell(q).map((pc) => P(pc.role === 'metal' ? 'accent' : pc.role, pc.geo.scale(1.9, 1.9, 1.9).translate(0, 0.905, 0.137), true)),
    // the procession's streamers, tied round the staff under the bell's arm, falling apart a little (his sheet)
    P('dark', cyl(0.024, 0.024, 0.035, q, 6).translate(0, 0.705, 0.03)),
    ...[[-1, 0.52, 'accent', 0.14, 0.1], [0, 0.44, 'cloak', -0.03, -0.14], [1, 0.48, 'hat', -0.15, 0.06]].map(([i, len, role, tz, tx]) =>
      P(role, box(0.032, len, 0.005).translate(0, -len / 2, 0).rotateZ(tz).rotateX(tx).rotateY(i * 0.9).translate(i * 0.012, 0.69, 0.03 + i * 0.01), true)),
  ],
  // Nour's staff (her sheets): a tall carved staff, a pierced disc at its head, three holes through it
  discstaff: (q) => {
    const out = [
      P('wood', cyl(0.016, 0.02, 1.8, q, 6).translate(0, 0.01, 0.03), true),
      P('wood', cyl(0.026, 0.02, 0.07, q, 6).translate(0, 0.905, 0.03), true),
      P('hat', cyl(0.078, 0.078, 0.022, q, 14).rotateX(Math.PI / 2).translate(0, 1.0, 0.03), true),
    ];
    for (const y of [0.58, 0.68, 0.78]) out.push(P('dark', cyl(0.023, 0.023, 0.018, q, 6).translate(0, y, 0.03)));
    for (const [x, y] of [[0, 0.028], [-0.025, -0.015], [0.025, -0.015]]) out.push(P('dark', cyl(0.013, 0.013, 0.026, q, 6).rotateX(Math.PI / 2).translate(x, 1.0 + y, 0.03), true));
    return out;
  },
};
/**
 * The held props big enough to push a cape aside (hand frame, m): capsules from a to b, r their radius
 * with the cloth's thickness (the cloth is coarse: its points keep off them, the faces between them
 * cut a little inside, so r covers the bowl's rim, not just its depth). Humanoid.capsules adds them to
 * the cloth's colliders, so Sefa's oud swings against her cloak as she walks instead of through it (the
 * thin props need none).
 */
/** Sefa's oud in its own frame (the bowl's middle at the origin, the neck up +y, the soundboard facing +z). */
function oudParts(q) {
  const bowl = [[0, 0], [0.062, 0.014], [0.102, 0.055], [0.124, 0.125], [0.122, 0.205], [0.094, 0.277], [0.052, 0.325], [0, 0.34]];
  const out = [
    P('wood', lathe(bowl, q, 12).scale(1, 1, 0.58).translate(0, -0.17, 0), true),
    P('cloth', cyl(0.098, 0.098, 0.012, q, 12).rotateX(Math.PI / 2).scale(1, 1.28, 1).translate(0, -0.015, 0.072), true),
    P('dark', torus(0.029, 0.007, q, 10, 4).translate(0, 0.02, 0.074)),
    P('wood', box(0.042, 0.24, 0.03).translate(0, 0.27, 0.042), true),
    P('dark', box(0.028, 0.235, 0.006).translate(0, 0.27, 0.059)),
    P('wood', box(0.05, 0.12, 0.026).rotateX(-1.2).translate(0, 0.425, 0.016), true),
    P('dark', box(0.042, 0.012, 0.009).translate(0, -0.1, 0.075)),
  ];
  if (q >= 1) {
    out.push(P('dark', box(0.024, 0.16, 0.004).translate(0, 0.07, 0.08)));
    for (const sx of [-1, 1]) out.push(P('metal', cyl(0.005, 0.005, 0.05, q, 4).rotateZ(Math.PI / 2).rotateX(-1.2).translate(sx * 0.03, 0.455, -0.012)));
  }
  return out;
}
/** How the oud is carried: held across the body (hand frame), or slung on the back over the cloak (chest frame). */
const HELD_OUD = { turn: (g) => g.rotateZ(-0.88).rotateX(0.22), at: [0.1, -0.04, 0.21] };
const SLUNG_OUD = { turn: (g) => g.rotateY(Math.PI).rotateZ(0.42), at: [0.08, 0.36, -0.31] };
/**
 * The oud turned and placed as it is carried, with the tassels her sheets hang from its pegbox (two long
 * ribbons and a knot): they fall straight down from the pegbox however the instrument is turned.
 */
function slung(parts, how, q) {
  const at = new THREE.Vector3(...how.at);
  const out = parts.map((pc) => P(pc.role, how.turn(pc.geo).translate(at.x, at.y, at.z), pc.far));
  const peg = how.turn(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0.4, 0.03], 3)));
  const pg = new THREE.Vector3().fromBufferAttribute(peg.attributes.position, 0).add(at);
  out.push(P('dark', sphere(0.014, q, 6, 4).translate(pg.x, pg.y - 0.01, pg.z)));
  for (const [dx, len, role] of [[-0.008, 0.19, 'cloth'], [0.01, 0.15, 'hat']]) out.push(P(role, box(0.016, len, 0.004).translate(pg.x + dx, pg.y - 0.02 - len / 2, pg.z + 0.004), true));
  return out;
}

/**
 * What is carried on the back (the chest frame: behind the body, -z), a second slot beside the held prop
 * (look.back). With look.stow the back piece is the held prop put away: shown while walking, the held one while
 * standing (Humanoid.stow). Sefa's oud slung on its strap over her cloak, as her sheet draws her walking;
 * Marrow's pack.
 */
export const BACKS = {
  none: () => [],
  oud: (q) => [
    ...slung(oudParts(q), SLUNG_OUD, q),
    // its strap: from the neck over her right shoulder, across the chest to her left side
    P('dark', box(0.024, 0.5, 0.008).rotateZ(0.78).translate(0.01, 0.56, 0.155)),
    P('dark', box(0.024, 0.28, 0.008).rotateX(0.35).translate(-0.13, 0.72, 0.0)),
  ],
  // Marrow's pack (his sheet): a soft sack high on the back, a bedroll strapped over it and a long bone out of the top
  pack: (q) => [
    P('wood', sphere(0.16, q, 10, 8).scale(0.95, 1.12, 0.52).translate(0, 0.43, PACK_Z), true),
    P('accent', sphere(0.16, q, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.4).scale(1.0, 0.72, 0.58).translate(0, 0.5, PACK_Z), true),
    P('cloth', cyl(0.045, 0.045, 0.32, q, 8).rotateZ(Math.PI / 2).translate(0, 0.6, PACK_Z - 0.03), true),
    P('cloth', cyl(0.012, 0.014, 0.26, q, 5).rotateZ(-0.3).rotateX(-0.15).translate(0.085, 0.66, PACK_Z - 0.04), true),
    ...Pq('cloth', q < 1 ? null : sphere(0.02, q, 6, 4).scale(1.4, 1, 1).rotateZ(-0.3).translate(0.125, 0.78, PACK_Z - 0.06)),
    ...[-1, 1].map((sd) => P('wood', box(0.035, 0.3, 0.012).rotateX(0.25).translate(sd * 0.1, 0.56, PACK_Z + 0.08))),
  ],
};
export const BACK_IDS = Object.keys(BACKS);
/**
 * The back pieces as cloth colliders (chest frame). The oud is slung over the cloak (`under`: the cloth goes in
 * behind it), so it hangs a cloth's thickness out from the body's own collider (its bowl's inner side at the
 * back's collider: further in, the two pushed the cloth to and fro and the cloak flew open). A pack goes under
 * a cloak (the cloth goes over it).
 */
export const BACK_BULK = {
  oud: [{ a: [0.105, 0.24, -0.31], b: [0.03, 0.46, -0.31], r: 0.08, under: true }, { a: [-0.01, 0.57, -0.29], b: [-0.11, 0.79, -0.25], r: 0.035, under: true }],
  pack: [{ a: [0, 0.38, -0.2], b: [0, 0.6, -0.21], r: 0.17 }],
};

/**
 * Leg pieces (look.shins): built in a shin frame, the knee at the origin and the shin down -y to the ankle at
 * y = -len, `r` the shin's own radius there (Humanoid measures both on the body: segmentGirths); rigid on the
 * calf bone, so they follow the leg as it walks. Marrow's cloth-wrapped shins (his sheet): a bulky wrap from the
 * ankle to under the knee, wound in a few bands, a loose end tucked at the top.
 */
export const SHINS = {
  none: () => [],
  wraps: (q, { len, r }) => {
    const prof = [[r * 0.86 + 0.026, -len * 0.95], [r * 0.98 + 0.032, -len * 0.78], [r * 1.08 + 0.034, -len * 0.55], [r * 1.02 + 0.03, -len * 0.36], [r * 0.95 + 0.026, -len * 0.24]];
    const out = [P('linen', new THREE.LatheGeometry(prof.map(([a, y]) => new THREE.Vector2(a, y)), sg(12, q)), true)];
    const n = q < 1 ? 3 : 6;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, y = -len * (0.93 - 0.66 * t);
      const i = Math.min(prof.length - 2, Math.floor(t * (prof.length - 1))), f = t * (prof.length - 1) - i;
      const rad = prof[i][0] + (prof[i + 1][0] - prof[i][0]) * f + 0.004;
      out.push(P('linen', torus(rad, 0.009, q, 12, 4).rotateX(Math.PI / 2 + 0.22 * (k % 2 ? 1 : -1)).translate(0, y, 0)));
    }
    if (q >= 1) out.push(P('linen', box(0.035, 0.07, 0.008).rotateZ(0.3).translate(0.02, -len * 0.27, prof[4][0] + 0.004)));
    return out;
  },
};
export const SHIN_IDS = Object.keys(SHINS);

/**
 * The chest pieces worn over the cloak (chest frame, m): capsules the cloth goes under (cape.js OVER), so from
 * the front the bag lies on the cloak as the sheets draw it instead of inside it. Its strap too.
 */
export const BODY_BULK = {
  // (Bako's bag: two capsules across its width, low and high, flat as the bag is, so its inner side meets the
  //  body's own collider and the two do not push the cloth back and forth; its strap across the chest)
  satchel: [{ a: [0.1, 0.12, 0.31], b: [0.3, 0.12, 0.18], r: 0.08, under: true }, { a: [0.1, 0.27, 0.3], b: [0.29, 0.27, 0.18], r: 0.075, under: true },
    { a: [0.02, 0.48, 0.21], b: [0.1, 0.34, 0.26], r: 0.03, under: true }],
};
export const PROP_BULK = { oud: [{ a: [0.05, -0.08, 0.2], b: [0.15, 0.0, 0.23], r: 0.16 }, { a: [0.17, 0.03, 0.24], b: [0.42, 0.21, 0.285], r: 0.07 }] };

function lantern(q, y, z) {
  return [
    P('metal', cyl(0.004, 0.004, 0.1, q, 3).translate(0, y - 0.14, z)),
    P('metal', cone(0.056, 0.05, q, 8).translate(0, y - 0.19, z), true),
    P('lamp', cyl(0.045, 0.045, 0.1, q, 8).translate(0, y - 0.26, z), true),
    P('metal', cyl(0.05, 0.05, 0.015, q, 8).translate(0, y - 0.315, z)),
  ];
}

/** The short hair drawn under most headwear and the base of most hairstyles (head frame): on the skull, with a hairline. */
export const hairCap = (q, kind = 'm') => P('hair', scalp(q, { kind, t: 0.009, cols: q < 1 ? 16 : 24, rows: q < 1 ? 6 : 9 }), true);

/** Every piece a look shows, by frame: { head, chest, hand }. */
export function lookPieces(s, q = 1) {
  const H = HEADS[s.head] ?? HEADS.hood;
  const hair = H.base && q >= 1 ? H.base(q, s) : H.cap ? [hairCap(q, kindOf(s))] : [];
  return {
    head: [...hair, ...H.parts(q, s), ...(MASKS[s.mask] ?? MASKS.none)(q)],
    // (a headwear's pieces that rest on the shoulders: a hood thrown back, H.chest)
    chest: [...(H.chest ? H.chest(q, s) : []), ...(BODIES[s.body] ?? BODIES.none)(q)],
    hand: (PROPS[s.prop] ?? PROPS.none)(q),
    back: (BACKS[s.back] ?? BACKS.none)(q),
  };
}

/** Where the frames sit on the crowd figure (feet at 0, facing +z, metres). */
export const CROWD_FRAMES = { head: { y: 1.655, z: 0, s: 0.92 }, chest: { y: 0.71 }, hand: { x: -0.2, y: 0.86, z: 0.005 } };

/** The colour of a role for a look. */
export function roleColor(s, role) {
  return FIXED[role] ?? { hat: s.hat, accent: s.accent, cloak: s.cloak, cloth: s.cloth, hair: s.hair, skin: s.skin, legs: s.legs }[role] ?? s.cloak;
}

/** Every world with its own costume set (all the game's levels). */
export const COSTUME_WORLDS = Object.keys(COSTUMES);
