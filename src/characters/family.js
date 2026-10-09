// The traveller's family, as the selected single-view designs draw them (references/Home/characters/<Name>/:
// provenance in references/batches/2026-10-09-selected-family-currency-ship-sword.json). One canonical look
// each, used wherever they appear: home (src/story/home-data.js: Lou, Aunt Tove), the Lantern and home again
// (src/story/lantern-data.js: Ilen), the recordings' hologram (src/ship/hologram.js: the father and the mother,
// as busts) and the studio's home cast (src/studio/people.js). Moustache, the dog, is src/dog.js (DOG_LOOK below is his palette).
//
//   FAMILY[id]        a story person's body (kind, age, years, scale, morph, face) and palette, as the story
//                     data's people are written (src/npc.js reads them), plus `referenceImage` (the selected image)
//   FAMILY_LOOKS[id]  the look namedLook applies over the seeded draw (src/costumes.js): colours, hair, robe,
//                     boots, the face and its mood, and `kit`: the pieces src/characters/family-pieces.js builds
//   familyLook(world, id)   the look for someone of the family in a world they appear in (home, the
//                     Lantern), else null
//
// The reference images are single views (three-quarter front); the side and back are derived from them
// (docs/systems/characters.md, "The family"). The colours are sampled from the selected images.

/** The selected reference image of each of them (repository paths). */
export const FAMILY_REFERENCES = {
  father: 'references/Home/characters/Father/reference-1.jpeg',
  mother: 'references/Home/characters/Mother/reference-4.jpeg',
  lou: 'references/Home/characters/Lou/reference-3.jpeg',
  ilen: 'references/Home/characters/Ilen/reference-1.jpeg',
  tove: 'references/Home/characters/Aunt Tove/reference-3.jpeg',
  moustache: 'references/Home/characters/Moustache/reference-4.jpeg',
};

/** The worlds the family is dressed in (their looks are the same in each). */
export const FAMILY_WORLDS = ['home', 'lantern'];

// a look: every field namedLook copies over the seeded one (src/costumes.js dressFor's fields)
const look = (name, o) => ({
  name, family: true, collarUp: 0.045,
  mask: 'none', body: 'none', prop: 'none', back: 'none', shins: 'none', stow: false, trim: 'none',
  robe: 0, flare: 0.3, bulk: 0, capeLen: 0, capeWide: 1, capeBells: 0, size: 1, sleeveless: false,
  tool: null, kit: null, headKit: null,
  ...o,
});

export const FAMILY_LOOKS = {
  // a lean old pilot in his seventies: a faded slate-blue workshop coat to below the knee, open over a rust
  // flight vest, a cream shirt and a navy roll-neck; charcoal trousers, scuffed brown boots; short grey hair,
  // clean-shaven, a long lined face and a strong straight nose; his old soft flight cap in his hand
  father: look('Father', {
    cloak: '#6f8aa5', cloth: '#6f8aa5', legs: '#575a5a', hat: '#b3a98a', hair: '#bdbcb6', skin: '#d6a081', accent: '#56708a', boot: '#6b4a33', eyes: '#5d7184',
    head: 'short', under: 'short', build: 'slim', height: 1.04,
    robe: 0.34, flare: 0.25, robeOpen: 0.5, robeLining: '#56708a', robeHem: 'cloth', shins: 'ankleboots',
    vest: '#a5492f', shirt: '#ece2c6', collar: '#3e5065',
    kit: 'father', tool: 'flightCap',
    faceType: 'elder', mood: 'stern',
    face: { faceLength: 1.12, noseLength: 1.45, noseWidth: 1.05, cheeks: -0.65, jaw: 0.94, chin: 0.35, browRidge: 0.6, eyeSize: 0.88, lines: 1.9, lidWeight: 1.3, mouthWidth: 0.92 },
  }),
  // in her seventies: a long cream tunic over slate trousers, soft brown boots; a long teal scarf lined in
  // coral wound at her throat, its ends down her front; a small oval voice recorder at her belt; silver hair
  // pinned in a low bun; a long, kind, lined face
  mother: look('Mother', {
    cloak: '#4f8a8c', cloth: '#e8ddc3', legs: '#5d6a72', hat: '#4f8a8c', hair: '#bdb8af', skin: '#c99272', accent: '#e08a6c', boot: '#b98670', eyes: '#5b6b5e',
    head: 'bun', under: 'bun', build: 'slim', height: 0.96,
    robe: 0.3, flare: 0.28, robeHem: 'cloth', shins: 'ankleboots',
    scarf: '#4f8a8c', lining: '#e08a6c', recorder: '#c49a72',
    kit: 'mother',
    faceType: 'elder', mood: 'calm',
    face: { faceLength: 1.1, noseLength: 1.35, cheeks: -0.4, jaw: 0.92, chin: 0.25, eyeSize: 0.92, lines: 1.8, lidWeight: 1.2, mouthWidth: 0.95 },
  }),
  // seven and a half: a golden-yellow tunic to mid-thigh with two coral patch pockets, a striped collar,
  // rust-red trousers, soft tan boots; chestnut hair with a fringe, in two messy bunches (family-pieces.js);
  // a folded drawing at her side
  lou: look('Lou', {
    cloak: '#e3a336', cloth: '#e3a336', legs: '#b2412d', hat: '#e8735a', hair: '#8a4024', skin: '#f0d0b8', accent: '#e8735a', boot: '#e9b68a', eyes: '#4a3a30',
    head: 'bob', under: 'bob', mhHair: 'short03', build: 'average', bunches: true,
    robe: 0.5, flare: 0.25, robeHem: 'cloth', shins: 'midboots',
    pockets: '#e8735a', collar: '#9aa6b6', paper: '#f1e3a4',
    kit: 'lou', tool: 'drawing',
    faceType: 'round', mood: 'curious',
  }),
  // fifty, a stranded pilot and gardener: a long faded teal wrap coat lined in coral, open over a cream shirt;
  // charcoal work trousers, tall worn brown boots, a narrow tool belt; dark hair streaked grey in a low bun;
  // a long weathered face, a strong straight nose, a wry look
  ilen: look('Ilen', {
    cloak: '#5c9695', cloth: '#5c9695', legs: '#4c565a', hat: '#e9846a', hair: '#3b3532', skin: '#c98b62', accent: '#e9846a', boot: '#9a7a54', eyes: '#4d4034',
    head: 'bun', under: 'bun', build: 'slim', height: 0.99,
    robe: 0.17, flare: 0.3, robeOpen: 0.42, robeLining: '#e9846a', robeHem: 'cloth', shins: 'boots',
    shirt: '#eadfb8', lapel: '#e9846a', belt: '#8c8668', pouch: '#7d775a',
    kit: 'ilen',
    faceType: 'long', mood: 'amused',
    face: { faceLength: 1.1, noseLength: 1.3, cheeks: -0.45, jaw: 0.96, chin: 0.2, eyeSize: 0.92, lines: 1.15, lidWeight: 1.1 },
  }),
  // in her sixties, sturdy and broad: a short muted-lavender shawl over her shoulders, olive undersleeves, a
  // dusty-blue work tunic to the shin under a pale apron, indigo trousers, brown boots; silver hair in a
  // compact bun; a lined face, a straight nose, small observant eyes, a warm direct look
  tove: look('Aunt Tove', {
    cloak: '#6d8bb3', cloth: '#7e7a62', legs: '#4e6590', hat: '#b39fbf', hair: '#c2c4c4', skin: '#e3b292', accent: '#93a6bd', boot: '#8b6744', eyes: '#6a7a86',
    head: 'bun', under: 'bun', build: 'heavy', height: 0.94,
    robe: 0.2, flare: 0.33, robeRole: 'cloak', robeHem: 'cloak', shins: 'ankleboots',
    robePanels: [{ role: 'accent', a0: -0.95, a1: 0.95, t0: 0, t1: 0.82, out: 0.012 }],
    shawl: '#b39fbf', apron: '#93a6bd',
    kit: 'tove',
    faceType: 'elder', mood: 'kind',
    face: { faceLength: 1.0, noseLength: 1.2, cheeks: 0.35, jaw: 1.08, chin: 0, eyeSize: 0.86, lines: 1.6, lidWeight: 1.2 },
  }),
};

/**
 * The story's people (src/npc.js def fields): who they are for their bodies; the story data adds their words.
 * `palette` repeats the look's colours, so anything reading a person's colours (a conversation's portrait
 * background, their name's colour) agrees with the look.
 */
const palette = (L) => ({ cloak: L.cloak, lining: L.robeLining ?? L.lining ?? '#2b211f', cloth: L.cloth, legs: L.legs, hat: L.hat, hair: L.hair, skin: L.skin, accent: L.accent, eyes: L.eyes });
const person = (id, o) => {
  const L = FAMILY_LOOKS[id];
  return { id, kind: 'f', palette: palette(L), head: L.head, cape: 0, look: { head: L.head, body: L.body, prop: L.prop, mask: L.mask, trim: L.trim, robe: L.robe, build: L.build }, referenceImage: FAMILY_REFERENCES[id], ...o };
};

export const FAMILY = {
  father: person('father', { name: 'Father', title: 'your father', kind: 'm', age: 'elder', years: 74, scale: 1.04, color: '#6f8aa5' }),
  mother: person('mother', { name: 'Mother', title: 'your mother', age: 'elder', years: 72, scale: 0.97, color: '#4f8a8c' }),
  // (her body is the people's slighter, flatter one under a child's morph; her voice is a girl's: body vs kind)
  lou: person('lou', {
    name: 'Lou', title: 'your daughter, seven and a half', color: '#f2c54b', body: 'm', age: 'child', years: 7.5, scale: 0.8, brows: '#a8664a',
    // a child's body on the people's skeleton (morph.js): a big head on short limbs, a round soft middle, no waist
    morph: { headSize: 1.3, torsoLength: 0.84, legLength: 0.76, armLength: 0.78, neckLength: 0.42, shoulders: 0.8, chest: 0.8, hips: 0.86, belly: 1.4, arms: 0.92, legs: 1.0, neck: 0.8, handSize: 0.8, footSize: 0.82 },
    // and a child's face: round, the lower face short, a small straight nose, small level eyes (the drawing's,
    // not a doll's), no lines, a few freckles
    face: { eyeSize: 1.2, eyeHeight: -1, eyeSpacing: 0.3, noseLength: 0.6, noseWidth: 0.78, jaw: 0.84, chin: -0.8, cheeks: 1, faceLength: 0.84, headWidth: 1.16, browRidge: -1, lines: 0, freckles: 0.45, mouthWidth: 0.8, lidWeight: 0.7 },
  }),
  ilen: person('ilen', { name: 'Ilen', title: 'who keeps the lantern', color: '#5fb7ad', years: 50, scale: 1.0 }),
  tove: person('tove', { name: 'Aunt Tove', title: 'your mother’s sister', color: '#8a6fb8', age: 'elder', years: 64, scale: 0.95 }),
};

/** Moustache's colours (src/dog.js): sandy wire coat, a paler belly and legs, the long white moustache and brows. */
export const DOG_LOOK = { fur: '#d9ac72', dark: '#b98a55', pale: '#e8c995', white: '#f1ede4', brow: '#ece6da', nose: '#a85a44', ink: '#2b211f', ear: '#c98d55' };

/** The look of someone of the family in `world`, or null (not one of them, or not where they appear). */
export function familyLook(world, id) {
  return FAMILY_WORLDS.includes(world) ? FAMILY_LOOKS[id] ?? null : null;
}
