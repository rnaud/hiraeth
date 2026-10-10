// Each world's score: what it plays, as data and a pure, deterministic generator.
//
// A world's score (SCORES) is a mode on a root, a tempo and a metre, a chord progression,
// an instrument palette (drone, pad, bass, pluck, lead, the father's voice, percussion, a
// colour of its own), and a short leitmotif. scoreBeat(world, beat, act) says what plays on
// one beat: no Web Audio here, so tests can check it and src/audio.js turns it into sound.
//
// The music is laid out in sections of a few bars, grouped in arcs of six (one arc is a
// minute and a half or so): a section names which layers play (the drone alone, the pad
// and the motif, everything, the father's theme over the pad...). The arcs are drawn from
// a seeded random per world, so the order never settles into a loop, and the same beat
// always plays the same thing. On top, what you are doing thins or fills it (act):
// walking brings in the percussion and the plucked figures, standing still a while lets
// it settle to the drone, the pad and the motif; indoors drops the drums; night and
// storms quieten it.
//
// The father's theme (FATHER_THEME) is one shape, three notes that climb and settle like a
// vow, the same as the charge's (Sound.charge). Every world sings it once an arc or so, in
// its own mode and on its own instrument; at home it opens the world's own tune.

/** The modes the worlds use, in semitones from the tonic. */
export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],              // phrygian dominant: the augmented second, 1 -> 4
  hungarianMinor: [0, 2, 3, 6, 7, 8, 11],     // two augmented seconds: the machine's mode
  lydianDominant: [0, 2, 4, 6, 7, 9, 10],     // bright and a little alien: the market
  wholeTone: [0, 2, 4, 6, 8, 10],             // no home to fall to: the Hangar
  majorPentatonic: [0, 2, 4, 7, 9],
  yo: [0, 2, 5, 7, 9],                         // an open, old pentatonic: Vael
};

/** The father's theme: [semitones over the tonic, beats]. Snapped into each world's mode (fatherIn). */
export const FATHER_THEME = [[0, 2], [4, 1], [7, 1.5], [5, 1], [7, 3]];

/** The sections an arc is made of, and the layers each plays. */
export const SECTION_LAYERS = {
  rest: ['drone', 'color'],
  open: ['drone', 'pad', 'lead'],
  grow: ['drone', 'pad', 'pluck', 'perc', 'color'],
  full: ['drone', 'pad', 'bass', 'pluck', 'perc', 'lead'],
  memory: ['drone', 'pad', 'father'],
  echo: ['drone', 'pluck', 'echo', 'color'],
  thin: ['drone', 'pad', 'pluck'],
};
// the first arc of every world: its motif at once, then the father's theme, within the first minute
const FIRST_ARC = ['open', 'memory', 'grow', 'full', 'thin', 'rest'];
// later arcs: one of these, the sixth-section slot ('*') the father's theme every other arc
const ARCS = [
  ['rest', 'open', 'grow', 'full', '*', 'thin'],
  ['open', 'grow', 'full', 'grow', '*', 'rest'],
  ['thin', 'grow', 'full', '*', 'open', 'rest'],
  ['rest', 'grow', 'open', 'full', 'thin', '*'],
];

// how loud each layer is, before the instrument's own level
const LEVEL = { drone: 0.05, pad: 0.05, bass: 0.085, pluck: 0.06, perc: 0.11, lead: 0.1, father: 0.085, echo: 0.06, color: 0.05 };

/**
 * The worlds. root (Hz) and mode; tempo (beats a minute); meter (beats a bar); bars (a
 * section); chordBars (bars a chord); prog (chord roots, scale degrees); drone ([degree,
 * octave] held under a section); pal (instruments: see src/score-voices.js); perc
 * (a pattern of hits, `sub` steps a beat, each character a hit in `hits`, '.' a rest);
 * percAlways (the drums play a little even standing still); arp (degrees over the chord
 * the pluck picks from); density (the pluck's chance a beat); color ({ every, kind, ... }:
 * the world's own sound now and then); motif ([degree, beats], the leitmotif); level (its loudness,
 * evened out between the worlds: scripts/render-score.mjs prints each one's level).
 */
export const SCORES = {
  // Qanat and its dark tree, the camps and the procession: ney and oud over a reed drone,
  // the frame drum when you walk, the city's slow bell far off. D hijaz.
  desert: {
    title: 'The Tree That Drinks', root: 146.83, mode: 'hijaz', tempo: 60, meter: 8, bars: 2, chordBars: 1,
    prog: [0, 1, 0, 3], drone: [[0, -1], [4, -1]],
    pal: { drone: 'tanpura', pad: 'warm', bass: 'sine', pluck: 'oud', lead: 'ney', father: 'duduk', echo: 'oud' },
    perc: { sub: 2, pattern: 'D..T..T.D..T.tt.', hits: { D: 'dum', T: 'tek', t: 'ka' } },
    arp: [0, 1, 2, 4, 7], density: 0.32,
    color: { every: 32, at: 6, kind: 'toll', degree: 0, octave: -1, vol: 0.6 },
    // "the tree drinks": up out of the ground through the augmented second, and back down like water
    motif: [[0, 2], [1, 1], [2, 1], [4, 3], [3, 1], [2, 1], [1, 1], [0, 4]],
  },
  // A city down a pit, its light going out: a muted horn over vibes and a walking pizzicato
  // bass, brushes when you walk; the Lodestar's shimmer overhead. F lydian: the raised fourth looks up.
  incal: {
    title: 'The Light Nobody Looks At', root: 174.61, mode: 'lydian', level: 1.55, tempo: 80, meter: 4, bars: 4, chordBars: 2,
    prog: [0, 1, 0, 5], drone: [[0, -1]],
    pal: { drone: 'city', pad: 'strings', bass: 'pizz', pluck: 'vibes', lead: 'muted', father: 'felt', echo: 'vibes' },
    walk: [0, 2, 4, 5],
    perc: { sub: 2, pattern: 'b.h.b.hh', hits: { b: 'brush', h: 'hat' } },
    arp: [0, 2, 4, 6, 7], density: 0.38,
    color: { every: 48, at: 8, kind: 'shimmer', degree: 3, octave: 2, vol: 0.5 },
    // "look up": climbing through the raised fourth to the fifth, then up again and home to it
    motif: [[0, 1], [2, 1], [3, 2], [4, 3], [null, 1], [7, 1], [6, 1], [3, 1], [4, 4]],
  },
  // Bone-white spires and wind: breath and air. A breathy flute that bends into its notes,
  // an aeolian drone of wind through stone, the stones' hum, the bird's far cry. No drums. A yo pentatonic.
  arzach: {
    title: 'The Waiting Bird', root: 110.0, mode: 'yo', level: 1.7, tempo: 46, meter: 4, bars: 4, chordBars: 2,
    prog: [0, 0, 3, 2], drone: [[0, 0], [3, 0]],
    pal: { drone: 'air', pad: 'air', bass: 'sine', pluck: 'stone', lead: 'shaku', father: 'bone', echo: 'shaku' },
    perc: null,
    arp: [0, 2, 4, 5], density: 0.16,
    color: { every: 24, at: 10, kind: 'cry', degree: 7, octave: 1, vol: 0.5, chance: 0.7 },
    // "the waiting bird": a call, a long wait on the tonic, and a slow look back up
    motif: [[2, 3], [1, 1], [0, 4], [null, 1], [3, 2], [4, 1], [3, 1], [2, 3]],
  },
  // The cloud sea and the silent monastery: the monks' low chant as the drone, a choir pad,
  // a flute, little hand bells, and the great bell tolling far below. B♭ dorian.
  arzach2: {
    title: 'The Bell Under the Cloud', root: 116.54, mode: 'dorian', level: 1.5, tempo: 44, meter: 4, bars: 4, chordBars: 2,
    prog: [0, 3, 0, 6], drone: [[0, -1], [4, -1]],
    pal: { drone: 'monks', pad: 'choir', bass: 'sine', pluck: 'handbell', lead: 'flute', father: 'handbell', echo: 'flute' },
    perc: null,
    arp: [0, 2, 4, 7], density: 0.2,
    color: { every: 48, at: 4, kind: 'toll', degree: 0, octave: -1, vol: 0.9 },
    // "the bell under the cloud": four notes falling like a bell's change, then home
    motif: [[4, 2], [3, 2], [2, 2], [0, 3], [null, 1], [1, 1], [2, 1], [0, 4]],
  },
  // Major Brask's pocket universe: machines turning out of habit. A soft analog lead over a
  // sequenced pulse in sevens, a ticking clock, the signal's three blips nobody can read. Whole tone: no home.
  garage: {
    title: 'The Major Forgot', root: 130.81, mode: 'wholeTone', level: 1.15, tempo: 84, meter: 7, bars: 2, chordBars: 1,
    prog: [0, 1, 0, 2], drone: [[0, -1]],
    pal: { drone: 'synth', pad: 'synth', bass: 'sine', pluck: 'pulse', lead: 'analog', father: 'celesta', echo: 'pulse' },
    perc: { sub: 2, pattern: 'K.t.t.tK.t.t.t', hits: { K: 'tock', t: 'tick' } }, percAlways: 0.35,
    arp: [0, 1, 2, 3, 4], density: 0.5,
    color: { every: 21, at: 3, kind: 'signal', vol: 0.5 },
    // "the Major forgot": a question that climbs, stops, and is left hanging
    motif: [[0, 0.5], [1, 0.5], [2, 1], [4, 1.5], [3, 0.5], [2, 1], [null, 1], [2, 0.5], [1, 0.5], [0, 0.5], [5, 2.5]],
  },
  // The Glass Dunes (on the route since October 2026, in the Hangar's place, with its temple): the Clock-House's
  // quarrelling clocks over warm sand. The Hangar's clockwork score carried over to the house it kept time by: a
  // sequenced pulse in sevens, a ticking clock; whole tone, no home, until the Foreman keeps time.
  glassdunes: {
    title: 'The Clock in the Glass', root: 130.81, mode: 'wholeTone', level: 1.05, tempo: 80, meter: 7, bars: 2, chordBars: 1,
    prog: [0, 2, 0, 1], drone: [[0, -1]],
    pal: { drone: 'synth', pad: 'synth', bass: 'sine', pluck: 'pulse', lead: 'analog', father: 'celesta', echo: 'pulse' },
    perc: { sub: 2, pattern: 'K.t.t.tK.t.t.t', hits: { K: 'tock', t: 'tick' } }, percAlways: 0.3,
    arp: [0, 2, 1, 3, 4], density: 0.45,
    // "every clock a different time": a figure that ticks round and lands on a note it did not start from
    motif: [[2, 0.5], [3, 0.5], [2, 0.5], [3, 0.5], [4, 1], [null, 0.5], [1, 1], [0, 0.5], [1, 0.5], [5, 2.5]],
  },
  // The machine under the dunes and its wheel, one tooth a year: low brass drones, a horn,
  // metal struck in the canyons, the tooth's groan. B hungarian minor, slow.
  buried: {
    title: 'One Tooth a Year', root: 123.47, mode: 'hungarianMinor', level: 0.75, tempo: 54, meter: 4, bars: 4, chordBars: 2,
    prog: [0, 5, 0, 4], drone: [[0, -1], [4, -2]],
    pal: { drone: 'brass', pad: 'brass', bass: 'sine', pluck: 'anvil', lead: 'horn', father: 'bowl', echo: 'anvil' },
    perc: { sub: 2, pattern: 'K.....t...t.k...', hits: { K: 'clank', t: 'tink', k: 'clank' } },
    arp: [0, 2, 4, 7], density: 0.2,
    color: { every: 32, at: 12, kind: 'tooth', degree: 0, octave: -1, vol: 0.8 },
    // "one tooth a year": inching up a semitone at a time round the fifth, then the octave
    motif: [[4, 2], [5, 1], [4, 3], [null, 1], [3, 1], [4, 2], [5, 1], [6, 1], [7, 4]],
  },
  // The garden planet: a lilt in six, harp and strings, an alto flute, the water clock dripping,
  // its little bell when it tips. G mixolydian: old and green.
  edena: {
    title: 'The Garden Grows Over', root: 196.0, mode: 'mixolydian', level: 1.15, tempo: 72, meter: 6, bars: 3, chordBars: 1,
    prog: [0, 6, 3, 0], drone: [[0, -1]],
    pal: { drone: 'organ', pad: 'strings', bass: 'sine', pluck: 'harp', lead: 'flute', father: 'clarinet', echo: 'harp' },
    perc: { sub: 1, pattern: 'd..s.s', hits: { d: 'drop', s: 'shaker' } },
    arp: [0, 2, 4, 7, 9], density: 0.42,
    color: { every: 24, at: 5, kind: 'ding', degree: 4, octave: 2, vol: 0.5 },
    // "the garden grows over": an arpeggio unfolding like a vine, through the flat seventh to the octave
    motif: [[0, 1], [1, 1], [2, 1], [4, 3], [3, 1], [2, 2], [null, 1], [4, 1], [5, 1], [6, 1], [7, 5]],
  },
  // Spheres that remember a sound each: glass, bells and mallets, the humming pole, the far
  // voices, the walking drum. A major pentatonic (the spheres' song is in it).
  spheres: {
    title: 'What the Spheres Remember', root: 220.0, mode: 'majorPentatonic', level: 0.87, tempo: 60, meter: 4, bars: 4, chordBars: 2,
    prog: [0, 3, 4, 1], drone: [[0, -1]],
    pal: { drone: 'hum', pad: 'glass', bass: 'sine', pluck: 'mallet', lead: 'bell', father: 'glass', echo: 'mallet' },
    perc: { sub: 2, pattern: 'D.tD.tD.Dt.D', hits: { D: 'dum', t: 'tek' } },
    arp: [0, 1, 2, 3, 5], density: 0.36, mirror: true,
    color: { every: 32, at: 9, kind: 'voices', degree: 0, octave: 0, vol: 0.5 },
    // the glass bell's remembered phrase, then up: (and mirrored the next time: upside down is another way up)
    motif: [[4, 1.5], [2, 1.5], [0, 1.5], [5, 3.5], [null, 1], [4, 1], [5, 1], [7, 4]],
  },
  // The twilight swamp and its singing crystal: a wet-glass drone, a low clarinet, wooden
  // knocks like frogs in the reeds, eggs that glow. E phrygian.
  perdide: {
    title: 'The Great Crystal', root: 164.81, mode: 'phrygian', level: 0.85, tempo: 54, meter: 4, bars: 4, chordBars: 2,
    prog: [0, 1, 0, 5], drone: [[0, 0], [4, 0]],
    pal: { drone: 'crystal', pad: 'reeds', bass: 'sine', pluck: 'marimba', lead: 'clarinet', father: 'glass', echo: 'marimba' },
    perc: { sub: 2, pattern: 'L...k.k.L..k....', hits: { L: 'log', k: 'knock' } },
    arp: [0, 1, 2, 4], density: 0.24,
    color: { every: 28, at: 7, kind: 'glow', degree: 7, octave: 1, vol: 0.5, chance: 0.75 },
    // "the crystal's phrase": round the flat second, a reach to the fifth, back down
    motif: [[0, 2], [1, 1], [2, 1], [1, 2], [0, 1], [null, 1], [4, 2], [5, 1], [4, 1], [1, 1], [0, 3]],
  },
  // The deep wood, its lamps kept for travellers: woodwinds (oboe, clarinet, a bassoon drone),
  // a wooden marimba and woodblocks in three, a lamp popping alight. E♭ aeolian.
  perdide2: {
    title: 'The Lamps Are Kept', root: 155.56, mode: 'aeolian', tempo: 58, meter: 3, bars: 6, chordBars: 2,
    prog: [0, 5, 2, 6], drone: [[0, -1]],
    pal: { drone: 'bassoon', pad: 'reeds', bass: 'sine', pluck: 'marimba', lead: 'oboe', father: 'clarinet', echo: 'marimba' },
    perc: { sub: 2, pattern: 'L.w.w.', hits: { L: 'log', w: 'block' } },
    arp: [0, 2, 4, 7], density: 0.3,
    color: { every: 24, at: 2, kind: 'glow', degree: 4, octave: 1, vol: 0.45, chance: 0.8 },
    // "the lamps are kept": a patient call up to the fifth, a step down, and up to wait on it
    motif: [[0, 2], [2, 1], [4, 3], [null, 1], [3, 1], [2, 1], [1, 1], [2, 2], [4, 4]],
  },
  // The bazaar of signs: market rhythms (darbuka, claps, a shaker), a hammered santur, a
  // street shawm, an electric piano, the towers' radio blips. E lydian dominant: bright, a little alien.
  bazaar: {
    title: 'You Are Not Alone', root: 164.81, mode: 'lydianDominant', level: 1.7, tempo: 96, meter: 4, bars: 4, chordBars: 1,
    prog: [0, 1, 4, 0], drone: [[0, -1]],
    pal: { drone: 'organ', pad: 'keys', bass: 'pizz', pluck: 'santur', lead: 'shawm', father: 'keys', echo: 'santur' },
    walk: [0, 0, 4, 2],
    perc: { sub: 2, pattern: 'D.T.TD.TD.TkTD.c', hits: { D: 'darbuka', T: 'tek', k: 'ka', c: 'clap' } }, percAlways: 0.45,
    arp: [0, 2, 4, 6, 7], density: 0.5,
    color: { every: 16, at: 13, kind: 'radio', vol: 0.45, chance: 0.6 },
    // "you are not alone": a call up to the raised fourth, and an answer coming home
    motif: [[0, 0.5], [2, 0.5], [4, 1], [3, 0.5], [4, 0.5], [6, 2], [null, 1], [5, 0.5], [4, 0.5], [2, 1], [1, 0.5], [2, 0.5], [0, 3]],
  },
  // The paper world and the artist at his table: a felt piano, a music box, soft strings,
  // a pencil on paper. C major.
  atelier: {
    title: 'The Atelier', root: 130.81, mode: 'ionian', level: 1.3, tempo: 60, meter: 4, bars: 4, chordBars: 2,
    prog: [0, 3, 5, 4], drone: [[0, -1]],
    pal: { drone: 'organ', pad: 'strings', bass: 'sine', pluck: 'celesta', lead: 'felt', father: 'flute', echo: 'celesta' },
    perc: null,
    arp: [0, 2, 4, 7], density: 0.3,
    color: { every: 20, at: 3, kind: 'pencil', vol: 0.5, chance: 0.6 },
    motif: [[0, 2], [2, 1], [4, 1], [7, 3], [6, 1], [4, 4]],
  },
  // Home: the round house, the stone, Lou. A felt piano and strings over a harmonium, a music
  // box; the world's own tune is the father's theme, and how it comes home. D♭ major.
  home: {
    title: 'Home', root: 138.59, mode: 'ionian', level: 1.27, tempo: 54, meter: 4, bars: 4, chordBars: 2,
    prog: [0, 5, 3, 4], drone: [[0, -1]],
    pal: { drone: 'organ', pad: 'strings', bass: 'sine', pluck: 'kalimba', lead: 'felt', father: 'celesta', echo: 'celesta' },
    perc: null,
    arp: [0, 2, 4, 7], density: 0.26,
    color: { every: 32, at: 6, kind: 'musicbox', degree: 4, octave: 2, vol: 0.4 },
    // the father's theme (FATHER_THEME in D♭ major), then the line that brings it home
    motif: [[0, 2], [2, 1], [4, 1.5], [3, 1], [4, 3], [null, 0.5], [5, 1], [4, 1], [2, 1], [1, 1], [0, 3]],
  },
};

/** A world's score (unknown ids, the title screen and the Lab, get the desert's). */
export function scoreFor(id) {
  const S = SCORES[id] ?? SCORES.desert;
  if (!S.scale) S.scale = MODES[S.mode];
  return S;
}

/** The frequency of a scale degree (any integer: octaves wrap) in a score. */
export function scoreFreq(S, degree, octave = 0) {
  const sc = S.scale ?? MODES[S.mode], n = sc.length, o = Math.floor(degree / n), d = ((degree % n) + n) % n;
  return S.root * Math.pow(2, (sc[d] + 12 * (o + octave)) / 12);
}

/** Semitones over the tonic of a scale degree. */
export function degreeSemis(scale, degree) {
  const n = scale.length, o = Math.floor(degree / n), d = ((degree % n) + n) % n;
  return scale[d] + 12 * o;
}

/** The scale degree nearest to `semi` semitones (a tie goes down). */
export function snapDegree(semi, scale) {
  let best = 0, bestD = Infinity;
  for (let deg = -scale.length; deg <= scale.length * 3; deg++) {
    const d = Math.abs(degreeSemis(scale, deg) - semi);
    if (d < bestD) { best = deg; bestD = d; }
  }
  return best;
}

/** The father's theme in a world's mode: [degree, beats]. */
export function fatherIn(S) {
  const sc = S.scale ?? MODES[S.mode];
  return FATHER_THEME.map(([semi, beats]) => [snapDegree(semi, sc), beats]);
}

// ------------------------------------------------------------------ determinism
/** A 32-bit hash of a string. */
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** A seeded random (mulberry32): the same seed, the same numbers. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ form
/** Beats in one of a world's sections. */
export const sectionBeats = (S) => S.meter * S.bars;

/** The section that holds `beat`: { n (its index), start (its first beat), len, kind, layers, arc }. */
export function sectionAt(id, beat) {
  const S = scoreFor(id), len = sectionBeats(S), n = Math.floor(Math.max(0, beat) / len), arc = Math.floor(n / 6);
  let kinds = FIRST_ARC;
  if (arc > 0) kinds = ARCS[Math.floor(rng(hashStr(id) ^ Math.imul(arc, 0x9e3779b1))() * ARCS.length)];
  let kind = kinds[n % 6];
  if (kind === '*') kind = arc % 2 ? 'memory' : 'echo';
  return { n, start: n * len, len, kind, layers: SECTION_LAYERS[kind], arc };
}

/** The chord root (a scale degree) on `beat`. */
export function chordAt(S, beat) {
  const per = S.meter * S.chordBars;
  return S.prog[Math.floor(Math.max(0, beat) / per) % S.prog.length];
}

/** The world's motif as played in section n: varied by section (a step up or down, an octave, the spheres' mirror). */
export function motifFor(S, n) {
  const v = n % 4, shift = [0, 0, 1, -1][v], mirror = S.mirror && v % 2 === 1;
  return S.motif.map(([deg, beats]) => [deg === null ? null : mirror ? 8 - deg + shift : deg + shift, beats]);
}

/** Total beats of a phrase. */
export const phraseBeats = (p) => p.reduce((a, [, b]) => a + b, 0);

/**
 * The activity the score follows (src/audio.js keeps it, eased, from the game each frame):
 * move 0..1 (walking, running), ride 0..1 (on a mount or a vehicle, or high in the air),
 * still (s standing about), indoor 0..1, night 0..1, storm 0..1.
 */
export const CALM_ACT = { move: 0, ride: 0, still: 0, indoor: 0, night: 0, storm: 0 };

/**
 * What a world's score plays on one beat: [{ layer, kind, degree?, octave?, at (beats
 * from this beat), beats, vol, pan }]. Pure: the same world, beat and activity always
 * give the same notes (a seeded random per beat, drawn in the same order whatever plays).
 */
export function scoreBeat(id, beat, act = CALM_ACT) {
  const S = scoreFor(id), P = S.pal, out = [];
  const sec = sectionAt(id, beat), i = beat - sec.start, bar = S.meter;
  const r = rng(hashStr(id) ^ Math.imul(beat + 1, 0x85ebca6b));
  const R = [r(), r(), r(), r(), r(), r()];   // (always six draws: what plays never shifts what follows)
  const moving = Math.max(act.move ?? 0, act.ride ?? 0);
  const settled = (act.still ?? 0) > 30 && !(act.ride > 0.3);
  const indoor = (act.indoor ?? 0) > 0.5, night = act.night ?? 0;
  const hush = (S.level ?? 1) * (1 - 0.5 * (act.storm ?? 0)) * (1 - 0.25 * night);
  // what plays here: the section's layers, filled in by walking, thinned by standing about or a roof
  const L = new Set(sec.layers);
  if (moving > 0.6 && !indoor) { L.add('pluck'); if (sec.kind !== 'memory') L.add('perc'); }
  if (act.ride > 0.5) L.add('bass');
  if (settled) { L.delete('perc'); L.delete('bass'); }
  if (indoor) { L.delete('perc'); L.delete('bass'); L.delete('color'); }
  const pan = (k) => (k - 0.5) * 0.9;
  const chord = chordAt(S, beat);

  // the drone: one long held note a section (two for some), fading in under the last
  if (i === 0) for (const [deg, oct] of S.drone) out.push({ layer: 'drone', kind: P.drone, degree: deg, octave: oct, at: 0, beats: sec.len + 2, vol: LEVEL.drone * (sec.kind === 'rest' ? 1.3 : sec.kind === 'full' ? 0.75 : 1) * hush, pan: 0 });
  // the chord: the pad and the bass on every change
  if (beat % (bar * S.chordBars) === 0) {
    if (L.has('pad')) for (const k of (R[0] < 0.4 ? [0, 4] : [0, 2, 4])) out.push({ layer: 'pad', kind: P.pad, degree: chord + k, octave: 0, at: 0, beats: bar * S.chordBars + 1, vol: LEVEL.pad * hush * (indoor ? 0.8 : 1), pan: k === 0 ? 0 : k === 2 ? -0.3 : 0.3 });
    if (L.has('bass') && !S.walk) out.push({ layer: 'bass', kind: P.bass, degree: chord, octave: -1, at: 0, beats: bar * S.chordBars, vol: LEVEL.bass * hush, pan: 0 });
  }
  // a walking bass (the city, the market): a note a beat (every other beat standing about)
  if (L.has('bass') && S.walk && (moving > 0.3 || beat % 2 === 0)) out.push({ layer: 'bass', kind: P.bass, degree: chord + S.walk[beat % S.walk.length], octave: -1, at: 0, beats: 0.9, vol: LEVEL.bass * 0.8 * hush, pan: 0 });
  // the leitmotif, a bar into the section (four beats in the long bars)
  if (L.has('lead') && i === Math.min(bar, 4)) {
    let at = 0;
    const oct = sec.n % 3 === 2 ? 1 : 0;
    for (const [deg, beats] of motifFor(S, sec.n)) {
      if (deg !== null) out.push({ layer: 'lead', kind: P.lead, degree: deg, octave: oct, at, beats, vol: LEVEL.lead * hush * (indoor ? 0.75 : 1), pan: -0.1 });
      at += beats;
    }
  }
  // the father's theme: slower, on its own voice, then a held note under its last
  if (L.has('father') && i === Math.min(bar, 4)) {
    let at = 0;
    for (const [deg, beats] of fatherIn(S)) { out.push({ layer: 'father', kind: P.father, degree: deg, octave: 1, at, beats: beats * 1.5, vol: LEVEL.father * hush, pan: 0.15 }); at += beats * 1.5; }
    out.push({ layer: 'pad', kind: P.pad, degree: 0, octave: 0, at: at - 4.5, beats: 7, vol: LEVEL.pad * 0.8 * hush, pan: 0 });
  }
  // an echo of the motif: its first half, an octave up, on the pluck's voice
  if (L.has('echo') && i === Math.min(bar * 2, 8)) {
    let at = 0;
    const half = S.motif.slice(0, Math.ceil(S.motif.length / 2));
    for (const [deg, beats] of half) { if (deg !== null) out.push({ layer: 'echo', kind: P.echo, degree: deg, octave: 1, at, beats, vol: LEVEL.echo * hush, pan: 0.3 }); at += beats; }
  }
  // the plucked figure: sparse, more of it as you go, less at night and under a roof
  if (L.has('pluck')) {
    const busy = sec.kind === 'thin' ? 0.45 : sec.kind === 'echo' ? 0.6 : 1;
    const chance = S.density * busy * (0.35 + 0.65 * moving) * (settled ? 0.4 : 1) * (1 - 0.4 * night) * (indoor ? 0.6 : 1);
    if (R[1] < chance) out.push({ layer: 'pluck', kind: P.pluck, degree: chord + S.arp[Math.floor(R[2] * S.arp.length)], octave: 1, at: R[3] < 0.3 ? 0.5 : 0, beats: 0.6, vol: LEVEL.pluck * hush, pan: pan(R[4]) });
  }
  // the drums: walking brings them in (some worlds keep a little always)
  if (S.perc && L.has('perc')) {
    const k = Math.max(S.percAlways ?? 0, moving > 0.25 ? 0.4 + 0.6 * moving : 0) * (1 - 0.5 * night);
    if (k > 0) {
      const { sub, pattern, hits } = S.perc;
      for (let s = 0; s < sub; s++) {
        const ch = pattern[(beat * sub + s) % pattern.length];
        if (ch !== '.') out.push({ layer: 'perc', kind: hits[ch], at: s / sub, beats: 1 / sub, vol: LEVEL.perc * k * hush * (ch === ch.toUpperCase() ? 1 : 0.6), pan: 0.15 });
      }
    }
  } else if (S.perc && S.percAlways && !indoor && !settled && (beat * S.perc.sub) % S.perc.pattern.length === 0) {
    // between the drum sections the busy worlds keep a quiet pulse on the one
    const ch = S.perc.pattern[0];
    out.push({ layer: 'perc', kind: S.perc.hits[ch], at: 0, beats: 1, vol: LEVEL.perc * S.percAlways * 0.6 * hush, pan: 0.15 });
  }
  // the world's own colour, now and then
  const C = S.color;
  if (C && L.has('color') && beat % C.every === C.at && R[5] < (C.chance ?? 1)) out.push({ layer: 'color', kind: C.kind, degree: C.degree ?? 0, octave: C.octave ?? 0, at: 0, beats: 4, vol: LEVEL.color * (C.vol ?? 1) * hush, pan: pan(R[4]) });
  return out;
}
