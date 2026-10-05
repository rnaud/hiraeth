// The non-humanoid peoples of the worlds (docs/systems/aliens.md): who they are,
// how big, how they move and speak. Pure data: the bodies are built in
// bodies.js, moved in alien.js, and the people themselves (names, places,
// lines) are in src/story/aliens-data.js.
//
//   SPECIES[id] = {
//     id, name (one of them), plural, worlds: [level ids],
//     lang          their tongue (src/story/voice.js LANGUAGES, src/story/scripts.js SCRIPTS)
//     face          where their "face" is (m above the ground): the conversation's two-shot, the
//                   traveller's eyes, the portrait; talkAt: where the talk prompt hangs
//     radius        how wide they are (the fluid tool's target, keeping off walls)
//     speed         walking pace (m/s)
//     lod           { near, mid, far, hide } metres from the camera: full detail and animation
//                   inside near; the simple body and a slower update past mid; past far a quarter of
//                   the updates; hidden past hide
//   }

export const SPECIES = {
  // Garden of Spheres: elders who float a man's height over the grass, a bell of pale skin and a
  // lantern heart under it, trailing long threads. They listen to the spheres; they are very old.
  drifter: {
    id: 'drifter', name: 'drifter', plural: 'drifters', worlds: ['spheres'],
    lang: 'drifter', face: 2.7, talkAt: 3.95, radius: 0.9, speed: 0.55, range: 4.2, hover: 2.7,
    color: '#e6cfe0', glow: '#ffe2a0',
    gap: 2.5, lod: { near: 34, mid: 70, far: 140, hide: 240 },
  },
  // Vael: tall walkers on three bone-white legs, a draped body and a lantern for a head. They pace
  // the needle plain and look at the sky. Like everyone in Vael, they say very little.
  stilt: {
    id: 'stilt', name: 'stilt-walker', plural: 'stilt-walkers', worlds: ['arzach'],
    lang: 'stilt', face: 4.25, talkAt: 5.1, radius: 0.7, speed: 0.75, range: 4.8,
    color: '#efe6d3', glow: '#ffc56a',
    gap: 3.1, lod: { near: 40, mid: 80, far: 160, hide: 260 },
  },
  // Lorn II: slow walkers who carry their houses, a mossy spiral shell on a soft foot, two eyes on
  // stalks, little moss lamps glowing on the whorl. Neighbours of the lamp-keepers.
  shell: {
    id: 'shell', name: 'shellback', plural: 'shellbacks', worlds: ['perdide2'],
    lang: 'shell', face: 2.0, talkAt: 3.1, radius: 1.15, speed: 0.32, range: 4.2, scale: 1.45,
    color: '#c9b78a', glow: '#ffd07a',
    gap: 2.7, lod: { near: 30, mid: 60, far: 120, hide: 200 },
  },
  // The Signal Market: small pale bulbs, knee to hip high, who live five to a cluster and speak as
  // one ("we"), hopping through the crowd together. They repeat what the market says.
  murmur: {
    id: 'murmur', name: 'murmur', plural: 'murmurs', worlds: ['bazaar'],
    lang: 'murmur', face: 0.72, talkAt: 1.9, radius: 1.2, speed: 1.1, range: 3.4, members: 5,
    color: '#efe9de', glow: '#f6c1cf',
    gap: 2.3, lod: { near: 30, mid: 60, far: 110, hide: 180 },
  },
};

/** How a tone shows on a body without a face (alien.js express): a glow, a pose, a rhythm.
 *  glow: brightness × · hue: a shift toward warm (+) or cold (−) · lift: rise or sink (m) ·
 *  tempo: the idle's pace × · pose: −1 shrunk, drooped … +1 tall, open · shake: a tremble */
export const TONE_BODY = {
  neutral:   { glow: 1.0,  hue: 0,    lift: 0,     tempo: 1.0, pose: 0,    shake: 0 },
  happy:     { glow: 1.35, hue: 0.25, lift: 0.12,  tempo: 1.4, pose: 0.6,  shake: 0 },
  sad:       { glow: 0.55, hue: -0.3, lift: -0.25, tempo: 0.6, pose: -0.8, shake: 0 },
  angry:     { glow: 1.5,  hue: 0.6,  lift: 0.05,  tempo: 1.9, pose: 0.4,  shake: 0.4 },
  scared:    { glow: 0.7,  hue: -0.4, lift: -0.15, tempo: 2.2, pose: -1,   shake: 1 },
  surprised: { glow: 1.7,  hue: 0.1,  lift: 0.3,   tempo: 1.6, pose: 1,    shake: 0.1 },
  curious:   { glow: 1.15, hue: 0,    lift: 0.05,  tempo: 1.1, pose: 0.3,  shake: 0, lean: 1 },
  tired:     { glow: 0.6,  hue: -0.1, lift: -0.3,  tempo: 0.55, pose: -0.6, shake: 0 },
  solemn:    { glow: 0.85, hue: -0.15, lift: 0,    tempo: 0.5, pose: 0.1,  shake: 0 },
  playful:   { glow: 1.3,  hue: 0.2,  lift: 0.1,   tempo: 1.8, pose: 0.5,  shake: 0, spin: 1 },
  whisper:   { glow: 0.5,  hue: -0.2, lift: -0.1,  tempo: 0.8, pose: -0.3, shake: 0, lean: 1 },
  shout:     { glow: 1.9,  hue: 0.4,  lift: 0.25,  tempo: 1.7, pose: 1,    shake: 0.2 },
};

export const speciesOf = (id) => SPECIES[id] ?? null;
