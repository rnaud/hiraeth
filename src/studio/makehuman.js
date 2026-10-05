// The character studio's MakeHuman bodies (docs/makehuman.md): the parametric body of
// src/makehuman/ (one body, made into anyone by age, sex and build) as a second body source.
//
//   Body source: makehuman   whoever is shown on a MakeHuman body: a story or crowd person gets the
//                            body the game would give them with ?mh=1 (src/makehuman/people.js:
//                            their age, build and world); a blank body the person picked
//                            (Who → MakeHuman person, MH_PRESETS; '' the first of their kind)
//   Lineup: makehuman        each preset beside the Quaternius body made to match them (`like`:
//                            kind, build, height, body and face morphs), the Quaternius one on the left
//   Lineup: mhbuilds         every age (child, teen, grown-up, elder) in every build, of one kind
//   Lineup: mhhair           every MakeHuman hairstyle (and the beard) on a grown-up of one kind
import { BLANK } from './people.js';
import { AGES, MH_BUILDS } from '../makehuman/shape.js';
import { MH_STYLES } from '../makehuman/hair.js';

/**
 * The prototype's eight people (docs/makehuman.md), now points of the parametric body: kind, age,
 * build (shape.js MH_BUILDS), and their Quaternius twin (`like`). Their hair: a style of their own.
 */
export const MH_PRESETS = [
  { id: 'child', label: 'Girl, 7', kind: 'f', years: 7, build: 'average', hair: 'braid01',
    like: { kind: 'm', build: 'average', height: 0.8, morph: { headSize: 1.3, torsoLength: 0.84, legLength: 0.76, armLength: 0.78, neckLength: 0.42, shoulders: 0.8, chest: 0.8, hips: 0.86, belly: 1.4, arms: 0.92, legs: 1.0, neck: 0.8, handSize: 0.8, footSize: 0.82 },
      face: { eyeSize: 1.45, eyeHeight: -1, eyeSpacing: 0.35, noseLength: 0.5, noseWidth: 0.76, jaw: 0.8, chin: -1, cheeks: 1, faceLength: 0.82, headWidth: 1.18, browRidge: -1, lines: 0, freckles: 0.6, mouthWidth: 0.8, lidWeight: 0.5 } } },
  { id: 'teen', label: 'Boy, 15', kind: 'm', years: 15, build: 'slim', hair: 'short01', like: { kind: 'm', build: 'slim', height: 0.93, face: { lines: 0.2, cheeks: 0.4, eyeSize: 1.1 } } },
  { id: 'woman', label: 'Woman, 28, slim', kind: 'f', years: 28, build: 'slim', hair: 'bob02', like: { kind: 'f', build: 'slim', height: 0.97 } },
  { id: 'man', label: 'Man, 35, broad', kind: 'm', years: 35, build: 'broad', hair: 'short02', like: { kind: 'm', build: 'broad', height: 1.02 } },
  { id: 'heavyf', label: 'Woman, 45, heavy', kind: 'f', years: 45, build: 'heavy', hair: 'ponytail01', like: { kind: 'f', build: 'heavy', height: 0.94 } },
  { id: 'heavym', label: 'Man, 50, heavy', kind: 'm', years: 50, build: 'heavy', hair: 'short04', beard: true, like: { kind: 'm', build: 'heavy', height: 1.0, face: { lines: 1.3 } } },
  { id: 'elderm', label: 'Man, 76', kind: 'm', years: 76, build: 'slim', hair: 'short04', beard: true, colour: '#b0a89a', like: { kind: 'm', build: 'slim', height: 0.96, face: { lines: 1.8, cheeks: -0.6 } } },
  { id: 'elderf', label: 'Woman, 72', kind: 'f', years: 72, build: 'average', hair: 'long01', colour: '#c9c2b4', like: { kind: 'f', build: 'average', height: 0.92, face: { lines: 1.7 } } },
];
/** Their faces' ink (morph.js FACE_MORPHS: lines, freckles, lid weight), by age. */
export const presetInk = (P) => ({ lines: P.years < 13 ? 0 : P.years < 20 ? 0.2 : P.years < 40 ? 0.5 : P.years < 60 ? 1 : 1.7, ...(P.years < 13 ? { freckles: 0.5, lidWeight: 0.6 } : {}) });

/** The preset for a spec: the one picked, else one of that kind (a child for a story child, else a grown-up; `n` picks among them). */
export function mhEntry(id, kind, { n = 0, child = false } = {}) {
  const picked = MH_PRESETS.find((p) => p.id === id);
  if (picked) return picked;
  const own = MH_PRESETS.filter((p) => p.kind === kind && (child ? p.years < 13 : p.years >= 18));
  const list = own.length ? own : MH_PRESETS.filter((p) => p.kind === kind);
  return list[((n % list.length) + list.length) % list.length] ?? MH_PRESETS[0];
}

/** A stand-in story definition for a MakeHuman person (NPC options): their true size (the template's), their name, their ink. */
export function mhDef(P, size = 1) {
  return { id: `mh-${P.id}`, name: `MakeHuman · ${P.label}`, kind: P.kind, scale: size, face: presetInk(P) };
}

/** The Quaternius body made to match a preset (its `like`): a definition for NPC (size, body, face). */
export function likeDef(P) {
  const L = P.like ?? {};
  return { id: `q-${P.id}`, name: `Quaternius · ${P.label}`, kind: L.kind ?? P.kind, scale: L.height ?? 1, ...(L.morph ? { morph: L.morph } : {}), ...(L.face ? { face: L.face } : {}) };
}

/** The look of the Quaternius twin: a blank body of its kind, in its build. */
export function likeLook(P, base) {
  const L = P.like ?? {};
  return { ...base, kind: L.kind ?? P.kind, build: L.build ?? base.build, height: L.height ?? 1 };
}

/** The comparison lineup: [Quaternius twin, MakeHuman person] for the first n presets (or those of `ids`: 'child,man'). */
export function mhLineup(n = 8, ids = '') {
  const out = [], pick = String(ids ?? '').split(',').filter(Boolean);
  const list = MH_PRESETS.filter((P) => !pick.length || pick.includes(P.id));
  for (const P of list.slice(0, pick.length ? list.length : n)) {
    out.push({ who: 'blank', twinOf: P, def: likeDef(P), kind: P.like?.kind ?? P.kind });
    out.push({ who: 'blank', mh: P, kind: P.kind });
  }
  return out;
}

/** Every age in every build, of one kind (or the ages of `ages`: 'child,elder'): blank bodies, each in a hairstyle of their age. */
export function mhBuildsLineup(kind = 'm', ages = '') {
  const pick = String(ages ?? '').split(',').filter((a) => AGES[a]);
  const hair = { child: kind === 'f' ? 'braid01' : 'short01', teen: kind === 'f' ? 'ponytail01' : 'short02', adult: kind === 'f' ? 'bob02' : 'short04', elder: kind === 'f' ? 'long01' : 'short03' };
  const out = [];
  for (const age of Object.keys(AGES).filter((a) => !pick.length || pick.includes(a))) {
    for (const build of Object.keys(MH_BUILDS)) {
      const P = { id: `${kind}-${age}-${build}`, label: `${kind === 'f' ? 'F' : 'M'} ${AGES[age]} · ${build}`, kind, years: AGES[age], build, hair: hair[age], beard: kind === 'm' && age === 'elder' && build === 'heavy', ...(age === 'elder' ? { colour: '#b0a89a' } : {}) };
      out.push({ who: 'blank', mh: P, kind });
    }
  }
  return out;
}

/** Every MakeHuman hairstyle (the men: and the beard) on a grown-up of one kind. */
export function mhHairLineup(kind = 'm') {
  const out = MH_STYLES.map((st) => ({ who: 'blank', mh: { id: `${kind}-${st}`, label: st, kind, years: AGES.adult, build: 'average', hair: st }, kind }));
  if (kind === 'm') out.push({ who: 'blank', mh: { id: 'm-beard', label: 'beard', kind, years: 55, build: 'average', hair: 'short04', beard: true }, kind });
  return out;
}

/** The heads the headwear lineup goes round (a woman and a man, a child, a teenager, the old, the heavy), each in a hairstyle of their own. */
export const HEADWEAR_HEADS = [
  { id: 'hw-f', label: 'woman 30', kind: 'f', years: 30, build: 'slim', hair: 'long01' },
  { id: 'hw-m', label: 'man 35', kind: 'm', years: 35, build: 'average', hair: 'short02' },
  { id: 'hw-c', label: 'girl 8', kind: 'f', years: 8, build: 'average', hair: 'braid01' },
  { id: 'hw-t', label: 'boy 15', kind: 'm', years: 15, build: 'slim', hair: 'afro01' },
  { id: 'hw-e', label: 'woman 72, heavy', kind: 'f', years: 72, build: 'heavy', hair: 'bob02', colour: '#c9c2b4' },
  { id: 'hw-o', label: 'man 70', kind: 'm', years: 70, build: 'broad', hair: 'short04', colour: '#b0a89a' },
];

/**
 * Every headwear (docs/makehuman.md, stage 3) on MakeHuman heads, going round HEADWEAR_HEADS: `set` 'heads'
 * (hats, caps, hoods, bands...), 'masks' (the face's: goggles, glasses, cloths), 'neck' (the shoulder pieces),
 * or a world's own (`pieces`: { heads, masks, bodies }, crowd.js worldPieces). Each spec carries its piece (`look`).
 */
export function mhHeadwearLineup(set = 'heads', { heads = [], masks = [], bodies = [] } = {}, offset = 0) {
  const items = set === 'masks' ? masks.map((m) => ({ mask: m })) : set === 'neck' ? bodies.map((b) => ({ body: b }))
    : set === 'world' ? [...heads.map((h) => ({ head: h })), ...masks.map((m) => ({ mask: m })), ...bodies.map((b) => ({ body: b }))]
      : heads.map((h) => ({ head: h }));
  return items.map((look, i) => {
    const P = HEADWEAR_HEADS[(i + offset) % HEADWEAR_HEADS.length];
    return { who: 'blank', mh: { ...P, id: `${P.id}-${i}`, label: `${Object.values(look)[0]} · ${P.label}` }, kind: P.kind, look };
  });
}

/** A blank look for a body of `kind` (as BLANK), for the specs above. */
export const blankFor = (kind) => BLANK(kind === 'f' ? 'f' : 'm');
