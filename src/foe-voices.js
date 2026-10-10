// Each archetype's own hurt and burst (the enemy roster's step 8, combat-v1.4 rec. 2): what a cut sounds like on it and
// what it sounds like coming apart, from its sound family (src/enemies/archetypes.js `sound`). Pure data: src/audio.js
// foeHurt / foeBurst synthesise the layers on the Web Audio graph (no samples), tests/foe-voices.test.js renders them
// in memory (never through a speaker) and checks each family's character.
//
// A voice is { family, hurt: [layer], burst: [layer] }; a layer is one of four recipes, `at` s after the blow:
//   noise   filtered noise: type ('lowpass' | 'bandpass' | 'highpass'), f Hz (to f1 over dur: a wheeze, a whoosh),
//           q, dur s, vol, rate (the noise's playback rate: lower is rougher)
//   tone    an oscillator gliding f → f1 over dur: wave ('sine' | 'triangle' | 'square' | 'sawtooth'), vol
//   ring    struck partials: f, partials [[ratio, level, share of dur]] (glass, a bell, a clay jug), dur, vol
//   clicks  n short bandpass ticks `every` s apart round f (each `dur` s; f1: the last one's centre, a run up or down):
//           a shell's clack, plates rattling, paper crinkling, a swarm's chitter
// Volumes sit near the old two sets' (an ink splat at 0.2, a machine's clang 0.06 a square): a hurt is short (under
// 0.4 s), a burst longer (under 1.6 s).

/** The struck partials: a glass's (inharmonic, the uppers dying first), a bronze bell's (the hum, the prime, the tierce…), a fired clay jug's (hollow). */
export const GLASS = [[1, 1, 1], [2.32, 0.5, 0.6], [4.25, 0.25, 0.4], [6.63, 0.12, 0.25]];
export const BRONZE = [[0.5, 0.6, 1], [1, 1, 0.8], [1.19, 0.55, 0.6], [1.5, 0.4, 0.5], [2, 0.35, 0.4], [2.52, 0.2, 0.3]];
export const CRACKED = [[1, 1, 1], [1.07, 0.8, 0.9], [1.61, 0.5, 0.5], [2.43, 0.35, 0.35], [3.2, 0.2, 0.2]];   // (a cracked bell: the partials pulled apart, beating)
export const CLAY = [[1, 1, 1], [1.72, 0.45, 0.5], [2.9, 0.2, 0.3]];

const N = (type, f, dur, vol, o = {}) => ({ p: 'noise', type, f, dur, vol, q: 0.8, rate: 1, at: 0, ...o });
const T = (wave, f, f1, dur, vol, o = {}) => ({ p: 'tone', wave, f, f1, dur, vol, at: 0, ...o });
const R = (f, partials, dur, vol, o = {}) => ({ p: 'ring', f, partials, dur, vol, at: 0, ...o });
const C = (n, every, f, dur, vol, o = {}) => ({ p: 'clicks', n, every, f, dur, vol, q: 4, at: 0, ...o });

/** Every archetype's voice, by its foe kind (src/enemies/archetypes.js `kind`); the makers' machine and anything else: `machine` or `ink`. */
export const FOE_VOICES = {
  // ---- creatures
  crab: { family: 'shell',     // a shell's clack: two hard knocks of a hollow dome; done, the dome cracks and its legs clatter
    hurt: [C(2, 0.07, 2400, 0.025, 0.22, { q: 7 }), T('triangle', 300, 200, 0.06, 0.08)],
    burst: [N('bandpass', 900, 0.3, 0.22, { q: 1.4, rate: 0.7 }), C(6, 0.06, 2100, 0.025, 0.12, { f1: 1200, q: 5, at: 0.08 }), T('triangle', 300, 90, 0.35, 0.1)] },
  skitter: { family: 'chitin', // a beetle's tick, tiny and high; done, a quick chitter running down
    hurt: [C(3, 0.022, 4200, 0.014, 0.13, { q: 8 })],
    burst: [C(7, 0.03, 4800, 0.014, 0.08, { f1: 2600, q: 8 }), N('highpass', 3500, 0.12, 0.05)] },
  centipede: { family: 'chitin', // its plates rattling down the body; done, a long rattle and the drill winding down
    hurt: [C(5, 0.035, 2400, 0.02, 0.13, { f1: 1500, q: 5 }), T('square', 180, 140, 0.12, 0.03)],
    burst: [C(12, 0.045, 2600, 0.02, 0.12, { f1: 900, q: 5 }), T('sawtooth', 420, 70, 0.9, 0.05)] },
  toad: { family: 'bellows',   // the throat's bellows wheezing; done, the sac pops and sighs empty
    hurt: [N('bandpass', 1600, 0.36, 0.18, { f1: 420, q: 3, rate: 0.8 }), T('triangle', 160, 110, 0.22, 0.06)],
    burst: [T('sine', 140, 520, 0.06, 0.16), N('lowpass', 1400, 0.22, 0.2, { rate: 0.5 }), N('bandpass', 1100, 0.9, 0.16, { f1: 220, q: 2.5, rate: 0.5, at: 0.1 })] },
  lizard: { family: 'scale',   // a dry hiss and a chirp; done, its horn's small blare falling away
    hurt: [N('highpass', 2600, 0.16, 0.1, { rate: 1.2 }), T('triangle', 900, 1300, 0.07, 0.07)],
    burst: [T('sawtooth', 330, 180, 0.5, 0.06), T('sawtooth', 495, 270, 0.5, 0.03), N('highpass', 2400, 0.35, 0.08)] },
  heron: { family: 'clay',     // a glazed clay jug knocked (hollow) and a short squawk; done, the jug breaks
    hurt: [R(520, CLAY, 0.28, 0.07), T('square', 760, 540, 0.09, 0.025, { at: 0.03 })],
    burst: [N('bandpass', 1800, 0.25, 0.2, { q: 1.2 }), C(6, 0.05, 3200, 0.03, 0.08, { f1: 2200, q: 3, at: 0.06 }), T('square', 700, 260, 0.45, 0.025, { at: 0.05 })] },
  roller: { family: 'shell',   // the pearl's shell knocked and ringing like glass; done, a glassy shatter over its last rumble
    hurt: [C(1, 0, 1900, 0.03, 0.16, { q: 6 }), R(1180, GLASS, 0.35, 0.03)],
    burst: [N('lowpass', 160, 0.8, 0.22, { rate: 0.35 }), N('highpass', 3200, 0.4, 0.12), ...[0, 1, 2, 3].map((i) => R(1500 + i * 420, GLASS, 0.6, 0.02, { at: 0.03 + i * 0.05 }))] },
  rootknot: { family: 'roots', // wood creaking and a twig snapping; done, a splintering crack and a long groan
    hurt: [T('sawtooth', 120, 95, 0.26, 0.05), C(2, 0.05, 1300, 0.02, 0.14, { q: 3 })],
    burst: [C(8, 0.035, 1600, 0.025, 0.15, { f1: 700, q: 2.5 }), T('sawtooth', 110, 55, 1.0, 0.06, { at: 0.12 })] },
  jelly: { family: 'glass',    // a wet bloop and its lanterns' glass ringing; done, a bubble bursting and a wobbling ring down
    hurt: [T('sine', 300, 620, 0.12, 0.12), R(1400, GLASS, 0.3, 0.025, { at: 0.04 })],
    burst: [T('sine', 240, 900, 0.08, 0.14), N('lowpass', 900, 0.2, 0.14, { rate: 0.6 }), R(980, GLASS, 1.1, 0.035, { at: 0.06 }), T('sine', 700, 260, 0.9, 0.05, { at: 0.1 })] },
  moth: { family: 'paper',     // paper crinkling as its wings fold; done, paper torn and its lantern's tink
    hurt: [C(5, 0.018, 3600, 0.014, 0.08, { q: 1.5 }), N('highpass', 4000, 0.12, 0.05)],
    burst: [N('bandpass', 2600, 0.35, 0.14, { f1: 4200, q: 1.2, rate: 1.3 }), C(8, 0.025, 3000, 0.015, 0.07, { q: 1.5, at: 0.05 }), R(2100, GLASS, 0.5, 0.02, { at: 0.25 })] },
  ray: { family: 'hide',       // a leathery slap and the air knocked out of it; done, a long falling whoosh
    hurt: [N('lowpass', 520, 0.1, 0.2, { rate: 0.7 }), N('bandpass', 900, 0.34, 0.11, { f1: 380, q: 1, at: 0.03 })],
    burst: [N('bandpass', 1300, 1.0, 0.15, { f1: 240, q: 0.9, rate: 0.8 }), N('lowpass', 400, 0.3, 0.16, { rate: 0.6, at: 0.6 })] },
  worm: { family: 'earth',     // grit crunching and a low groan; done, sand pouring and a deep groan going under
    hurt: [N('bandpass', 1200, 0.14, 0.14, { q: 1.5, rate: 0.5 }), T('triangle', 95, 70, 0.25, 0.1)],
    burst: [N('lowpass', 700, 1.1, 0.18, { f1: 200, rate: 0.4 }), T('triangle', 85, 45, 0.9, 0.12)] },
  // ---- the possessed machines
  tripod: { family: 'steam',   // an iron clank and a jet of steam; done, the boiler bursts in a gust of steam and clatter
    hurt: [T('square', 300, 260, 0.1, 0.07), N('highpass', 3000, 0.32, 0.09, { rate: 1.3, at: 0.05 })],
    burst: [N('highpass', 1800, 1.2, 0.18, { f1: 5000, rate: 1.2 }), C(5, 0.08, 1100, 0.03, 0.12, { f1: 700, q: 3, at: 0.15 }), T('square', 380, 120, 0.6, 0.05)] },
  cart: { family: 'slag',      // slag sizzling and the iron pot's dull bong; done, it boils over and the pot drops
    hurt: [N('highpass', 2200, 0.25, 0.08, { rate: 1.6 }), R(180, CLAY, 0.3, 0.07)],
    burst: [N('highpass', 1500, 1.3, 0.15, { rate: 1.8 }), N('lowpass', 500, 0.6, 0.18, { rate: 0.4, at: 0.1 }), R(140, CLAY, 0.9, 0.09, { at: 0.18 })] },
  bell: { family: 'brass',     // the bronze struck (the clapper's bong); done, the bell cracks and clatters down
    hurt: [R(330, BRONZE, 0.4, 0.05)],
    burst: [R(262, CRACKED, 1.5, 0.07), C(6, 0.07, 1400, 0.03, 0.1, { f1: 800, q: 3, at: 0.2 })] },
  drone: { family: 'tin',      // its spindle's whine jolted and a tin plate pinged; done, the whine spinning down and the plates
    hurt: [T('sawtooth', 900, 1300, 0.08, 0.035), R(2300, GLASS, 0.18, 0.025)],
    burst: [T('sawtooth', 1400, 160, 0.9, 0.05), C(4, 0.09, 2600, 0.025, 0.1, { f1: 1800, q: 4, at: 0.2 })] },
  brute: { family: 'iron',     // a deep cracked clang; done, the hull caves in with a crunch and a rumble
    hurt: [T('square', 150, 120, 0.22, 0.06), T('square', 233, 190, 0.2, 0.03), N('bandpass', 600, 0.12, 0.12, { q: 2, rate: 0.5 })],
    burst: [N('lowpass', 900, 0.5, 0.24, { rate: 0.5 }), T('square', 140, 45, 1.2, 0.06), N('lowpass', 140, 1.2, 0.18, { rate: 0.3, at: 0.15 })] },
  // ---- the spirits
  blot: { family: 'ink',       // a splat of ink; done, a wet pop and a falling sigh (the old set, kept)
    hurt: [N('lowpass', 700, 0.14, 0.2, { q: 0.6, rate: 0.6 })],
    burst: [N('lowpass', 1200, 0.3, 0.24, { q: 0.7, rate: 0.5 }), T('sine', 700, 140, 0.4, 0.09)] },
  shade: { family: 'cloth',    // its empty cloak swished and a whisper; done, the cloak flutters down to nothing with a sigh
    hurt: [N('bandpass', 1800, 0.22, 0.1, { f1: 900, q: 0.7, rate: 1.1 }), N('highpass', 5000, 0.16, 0.04, { at: 0.04 })],
    burst: [N('bandpass', 1500, 1.2, 0.12, { f1: 300, q: 0.6, rate: 0.9 }), T('sine', 420, 160, 1.0, 0.04, { at: 0.15 })] },
  hound: { family: 'smoke',    // a yelp and a huff of smoke; done, a howl falling into an ink splat
    hurt: [T('triangle', 900, 500, 0.12, 0.08), N('lowpass', 800, 0.18, 0.12, { rate: 0.7, at: 0.05 })],
    burst: [T('triangle', 700, 260, 0.9, 0.07), N('lowpass', 1100, 0.3, 0.2, { rate: 0.5, at: 0.5 })] },
  marionette: { family: 'strings', // a string twanged and the paper crumpled; done, the strings snapping one by one
    hurt: [T('sawtooth', 660, 600, 0.25, 0.03), C(4, 0.02, 3200, 0.014, 0.07, { q: 1.5, at: 0.03 })],
    burst: [...[0, 1, 2, 3].map((i) => T('sawtooth', 880 - i * 110, 300 - i * 30, 0.35, 0.03, { at: i * 0.11 })), N('bandpass', 2400, 0.5, 0.1, { q: 1.2, at: 0.1 })] },
  // ---- the old sets (the makers' machine in the temples, anything without its own)
  machine: { family: 'machine',
    hurt: [T('square', 620, 540, 0.25, 0.06), T('square', 930, 810, 0.25, 0.06, { at: 0.01 })],
    burst: [N('bandpass', 1200, 0.6, 0.22, { q: 0.5, rate: 0.8 }), T('square', 520, 60, 0.7, 0.1)] },
};

/** A shot or a cut that does nothing (armour, a shell, the bronze): a bright spark's tick over the armour's dull thunk. */
export const GLANCE = [C(1, 0, 5200, 0.012, 0.1, { q: 3 }), R(2900, GLASS, 0.14, 0.02), T('triangle', 230, 170, 0.1, 0.1), N('bandpass', 520, 0.07, 0.14, { q: 2.5, rate: 0.5 })];

/** A foe's voice: its kind's own; or by its def's sound ('machine'); or the ink's. */
export function voiceOf(kind, sound = null) {
  return FOE_VOICES[kind] ?? FOE_VOICES[sound] ?? (sound === 'metal' || sound === 'slag' ? FOE_VOICES.machine : FOE_VOICES.blot);
}

/** How long a voice's layers sound (s): the last one's end. */
export const voiceLength = (layers) => Math.max(0, ...layers.map((L) => (L.at ?? 0) + (L.p === 'clicks' ? (L.n - 1) * L.every + L.dur : L.dur)));
