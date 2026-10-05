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
  'crop', 'shaved', 'bald', 'curls', 'braid', 'flow', 'locks', 'crest', 'bob', 'twin', 'swept', 'tonsure'];
/** How many head ids the crowd shader can tell apart (crowd-shader.js: aDress.x = id + HEAD_ID_LIMIT * hair cap). */
export const HEAD_ID_LIMIT = 64;
/** The bare-headed styles (no headwear): the studio's hair list, what tribes pick from (tribe.hair). */
export const HAIR_IDS = ['short', 'hair', 'tail', 'long', 'bun', 'crop', 'shaved', 'bald', 'curls', 'braid', 'flow', 'locks', 'crest', 'bob', 'twin', 'swept', 'tonsure'];
/** The story's generic bare heads: each tribe draws its own hairstyle for them (tribe.hair). */
export const GENERIC_HAIR = ['hair', 'short'];
export const MASK_IDS = ['none', 'veil', 'beak', 'breather', 'goggles', 'browgoggles', 'beard'];
export const BODY_IDS = ['none', 'collar', 'scarf', 'pauldrons', 'mantle', 'reedcape', 'garland', 'badge', 'toolbelt', 'ruff', 'tatters'];
export const PROP_IDS = ['none', 'staff', 'lantern', 'basket', 'wrench', 'parasol', 'lamppole', 'bell', 'flower'];
/** Cloth patterns printed on the tunic (materials.js outfitTrim, the crowd's fragment hook). */
export const TRIM_IDS = ['none', 'stripes', 'sash', 'yoke', 'bib', 'diamonds', 'patches', 'dots', 'hem'];
/** Fixed colours of the material roles that aren't the person's own. */
export const FIXED = { dark: '#2b211f', metal: '#a9a493', wood: '#8a6040', lamp: '#ffd98a' };

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
  perdide2: { tribes: [tribe({
    name: 'the lamp-keepers',
    moods: { kind: 4.5, calm: 2, curious: 1.5, amused: 1, stern: 0.2 },
    heads: { lamphat: 5, hood: 1 }, as: { hat: 'lamphat', wrap: 'lamphat', hood: 'lamphat' },
    hair: { m: { tail: 2, locks: 2 }, f: { long: 3, braid: 2 } },
    masks: { none: 1 }, body: { mantle: 2, none: 2 }, props: { lamppole: 3, lantern: 2, none: 1 }, trim: { none: 1 },
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
    heads: { turban: 4, fez: 2, wrap: 1, hair: 1.4 }, headsF: { turban: 3, wrap: 2, fez: 1, hair: 2.4 }, as: { wrap: 'turban', hat: 'fez', hood: 'turban' },
    // the market: curls and close crops, braids and loose hair
    hair: { m: { curls: 3, crop: 2, shaved: 1.5, bald: 0.8 }, f: { braid: 2.5, curls: 2, flow: 2, bun: 1.5 } },
    masks: { none: 1 }, body: { badge: 4, none: 1 }, props: { basket: 2, none: 4 }, trim: { diamonds: 2, stripes: 2 },
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
  home: { tribes: [tribe({
    name: 'home',
    moods: { kind: 5, amused: 2, curious: 1, calm: 1, stern: 0 },
    heads: { cap: 1, band: 1 }, as: { wrap: 'band', hat: 'cap', hood: 'cap' },
    hair: { m: { short: 2, crop: 1 }, f: { long: 2, bun: 1 } },
    masks: { none: 1 }, body: { none: 1 }, props: { none: 1 }, trim: { none: 1 },
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
  atelier: { tribes: [tribe({
    name: 'the artist',
    heads: { beret: 1 }, as: { hood: 'beret', hat: 'beret', wrap: 'beret', hair: 'beret' },
    masks: { none: 1 }, body: { none: 1 }, props: { none: 1 }, trim: { none: 1 },
    capes: [0], robe: 1, robes: [0.5], flare: [0.27, 0.27], size: [1, 1],
    palette: { accents: ['#2b211f'] },
  })] },
};
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
 */
export function dressFor(world, rng, { palette = {}, lists = {}, head = null, cape = null, look = {}, spot = null, pos = null, kind = null } = {}) {
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
  let h = look.head ?? (head ? T.as[head] ?? head : weighted(rng, (kind === 'f' && T.headsF) || (kind === 'm' && T.headsM) || T.heads));
  if (!HEAD_IDS.includes(h)) h = 'hood';
  s.head = h;
  s.mask = look.mask ?? weighted(rng, T.masks);
  s.body = look.body ?? weighted(rng, T.body);
  s.prop = look.prop ?? weighted(rng, T.props);
  s.trim = look.trim ?? weighted(rng, T.trim);
  const r1 = rng();
  s.robe = look.robe ?? (r1 < T.robe ? pick(rng, T.robes) : 0);
  s.flare = look.flare ?? range(rng, T.flare);
  s.capeLen = cape ?? pick(rng, T.capes);
  s.capeWide = range(rng, T.wide);
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
  if (!female && kind && !look.mask && s.mask === 'none' && rb < BEARDS) s.mask = 'beard';
  // their eyes' colour: seeded by the rest of the look, not drawn from rng, so the looks drawn after
  // this one from the same stream (a crowd's) are what they were
  s.eyes = palette.eyes ?? look.eyes ?? irisFor(mulberry32(hashSeed(`${s.skin}|${s.hair}|${s.cloak}|${s.height}|${s.capeWide}`)));
  // their face and the mood it rests in (the same way: their own stream, the others' looks untouched)
  Object.assign(s, faceFor(T, mulberry32(hashSeed(`face|${s.eyes}|${s.skin}|${s.cloak}|${s.height}|${s.flare}`)), look));
  return s;
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
export function namedLook({ world = costumeWorld(), id = '', palette = {}, head = null, cape = null, look = {}, pos = null, kind = null } = {}) {
  return dressFor(world, mulberry32(hashSeed(`${world}:${id}`)), { palette, head, cape, look, pos, kind });
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
    dress: [head + HEAD_ID_LIMIT * cap, Math.max(0, MASK_IDS.indexOf(s.mask)) + 8 * Math.max(0, BODY_IDS.indexOf(s.body)) + 128 * Math.max(0, PROP_IDS.indexOf(s.prop)),
      (s.capeLen || 0) + 2 * Math.round((s.capeWide ?? 1) * 10), robeLen],
    w: Math.min(s.bulk ?? 0, 3) + 4 * (s.sleeveless ? 1 : 0) + 8 * Math.max(0, TRIM_IDS.indexOf(s.trim ?? 'none')) + 128 * Math.round((s.flare ?? 0.3) * 100),
  };
}
/** The inverse of packDress (what the shader reads), for tests. */
export function unpackDress(d, w) {
  const head = d[0] % HEAD_ID_LIMIT, mask = d[1] % 8, body = Math.floor(d[1] / 8) % 16, prop = Math.floor(d[1] / 128);
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
 * parts(q, look): the pieces (the look gives whose skull).
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
  hat: { cap: true, parts: (q) => [
    P('hat', cyl(0.3, 0.3, 0.014, q, 22).translate(0, 0.075, 0), true),
    P('hat', cyl(0.075, 0.12, 0.17, q, 14).translate(0, 0.16, 0), true),
    P('accent', cyl(0.121, 0.124, 0.03, q, 14, true).translate(0, 0.09, 0)),
  ] },
  wrap: { cap: true, parts: (q) => [
    ...[0, 1, 2].map((k) => P(k % 2 ? 'accent' : 'hat', torus(0.11 - k * 0.02, 0.032, q, 18, 8).rotateZ(k * 0.4).rotateX(Math.PI / 2 + 0.15).translate(0, 0.045 + k * 0.045, -0.01), k === 0)),
    P('hat', box(0.07, 0.32, 0.01).rotateX(0.25).rotateY(0.3).rotateZ(0.1).translate(0.02, -0.08, -0.12)),
  ] },
  wizard: { cap: true, parts: (q) => [
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
  sunhat: { cap: true, parts: (q) => [
    P('hat', cone(0.44, 0.19, q, 22).translate(0, 0.16, 0), true),
    P('accent', sphere(0.028, q, 8, 6).translate(0, 0.258, 0)),
    P('accent', cyl(0.12, 0.12, 0.025, q, 14, true).translate(0, 0.08, 0)),
  ] },
  // the rim: a tall stovepipe
  tophat: { cap: true, parts: (q) => [
    P('hat', cyl(0.2, 0.2, 0.012, q, 20).translate(0, 0.09, 0), true),
    P('hat', cyl(0.118, 0.102, 0.34, q, 14).rotateX(-0.06).translate(0, 0.265, -0.01), true),
    P('accent', cyl(0.106, 0.104, 0.045, q, 14, true).translate(0, 0.12, 0)),
  ] },
  // the rim: a tall cone swept back, a band at the brow
  spire: { cap: true, parts: (q) => [
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
  flowers: { cap: true, parts: (q, l) => [
    P('hair', curtain(q, { kind: kindOf(l), t: 0.012, open: 1.1, bottom: -0.17, backDrop: 0.05, flare: 0.026, rows: 3 })),
    ...blossoms(q < 0.5 ? 7 : 10, 0.13, 0.07, -0.22, 0.044, q, ['hat', 'accent', 'hat']).map((p) => ((p.far = true), p)),
  ] },
  // the Garden of Spheres: a round hat like a small sphere, ringed
  orb: { cap: true, parts: (q) => [
    P('hat', sphere(0.165, q, 16, 12).translate(0, 0.2, -0.01), true),
    P('accent', torus(0.168, 0.01, q, 22, 4).rotateX(Math.PI / 2 + 0.28).translate(0, 0.2, -0.01), true),
    P('accent', sphere(0.026, q, 8, 6).translate(0, 0.37, -0.01)),
  ] },
  // the deep wood: a wide brim, a rod over the face, a little lantern hanging from it
  lamphat: { cap: true, parts: (q) => [
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
  fez: { cap: true, parts: (q) => [
    P('hat', cyl(0.086, 0.104, 0.16, q, 12).translate(0, 0.14, -0.005), true),
    P('accent', cyl(0.004, 0.004, 0.1, q, 3).rotateZ(0.6).translate(0.04, 0.19, -0.005)),
    P('accent', sphere(0.018, q, 6, 4).translate(0.085, 0.15, -0.005)),
  ] },
  // home: a soft cap with a peak, and a headband
  cap: { cap: true, parts: (q) => [
    P('hat', sphere(0.132, q, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1.06, 0.78, 1.1).translate(0, 0.05, -0.012), true),
    P('accent', cyl(0.12, 0.12, 0.012, q, 12, false, -0.9, 1.8).translate(0, 0.055, 0.05)),
  ] },
  band: { cap: true, parts: (q) => [
    P('hat', torus(0.124, 0.018, q, 16, 6).rotateX(Math.PI / 2 + 0.1).translate(0, 0.05, -0.005)),
    P('hair', sphere(0.05, q, 10, 8).scale(1.4, 0.8, 1.2).translate(0, 0.125, -0.02)),
  ] },
  beret: { cap: true, parts: (q) => [
    P('hat', sphere(0.15, q, 14, 8).scale(1, 0.32, 1).rotateZ(0.25).translate(0.02, 0.105, -0.01), true),
    P('hat', cyl(0.006, 0.006, 0.03, q, 4).translate(0.03, 0.15, -0.01)),
  ] },
};

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
};
function goggles(q, y, tilt) {
  const out = [];
  for (const s of [1, -1]) {
    out.push(P('metal', cyl(0.031, 0.031, 0.036, q, 8).rotateX(Math.PI / 2 + tilt).translate(s * 0.043, y, 0.105 - tilt * 0.03)));
    out.push(P('dark', cyl(0.025, 0.025, 0.004, q, 8).rotateX(Math.PI / 2 + tilt).translate(s * 0.043, y + tilt * -0.016, 0.124 - tilt * 0.03)));
  }
  out.push(P('dark', torus(0.123, 0.009, q, 16, 4).rotateX(Math.PI / 2 + tilt * 0.4).translate(0, y + 0.004, -0.005)));
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
  // the Garden of Spheres: a pleated ruff
  ruff: (q) => {
    const g = torus(0.115, 0.04, q, 24, 6).rotateX(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getX(i), p.getZ(i)); const k = 1 + 0.12 * Math.sin(a * 12); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    g.computeVertexNormals();
    return [P('accent', g.translate(0, 0.75, 0))];
  },
};

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
};
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
    chest: (BODIES[s.body] ?? BODIES.none)(q),
    hand: (PROPS[s.prop] ?? PROPS.none)(q),
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
