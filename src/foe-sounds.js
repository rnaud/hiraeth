// The foes' voices and movement (issue #771): every foe calls when it spots you, cries as it winds up, puts its effort
// into the blow and the blow its own sound (a swing, a bite, a slam, a shot), grunts, chitters or whirs now and then,
// steps, skitters, flaps or hums as it moves, and cries out as it goes down. Its hurt and its burst are src/foe-voices.js
// FOE_VOICES (src/audio.js foeHurt / foeBurst).
//
// What it sounds like comes from its body: its voice from its archetype's sound family (src/enemies/archetypes.js
// `sound`: flesh, scale, chitin, steam, ink…), pitched for its size (a hulk is a grunt's voice an octave-ish lower); its
// movement from its body plan (`plan`: a walker's legs, a hopper's thump, a flyer's wings, a hover's hum); its blow from
// what the attack is (attackSort: by its shape and keys, never by its id or roster, so a foe given a new move sounds
// right without a line here). All synthesised (Sound.foeSay → foeVoice: the same four recipes plus G, a growl through a
// vowel), placed at the foe and following it (Sound.foeSpot).
//
// The mix (FOE_SOUND): under the traveller's own (his cut, his hurt); never machine-gunning: each take pitched and
// levelled a little apart, a foe never calls twice within its gaps, two of one kind not the same call at once, at most
// `cap` foe voices sounding together (idle and alert calls only while fewer than `low` are), the blows' own sounds
// capped too, and footsteps only from the `near` movers nearest and at most `perSec` a second over them all.
import { ARCHETYPES } from './enemies/archetypes.js';
import { N, T, R, C, G, GLASS, BRONZE, CLAY, pitched, voiceLength } from './foe-voices.js';
import { FOE_TRIM } from './foe-sound-trims.js';

/** The rules of the mix: caps, gaps, how far each is heard, each event's level (x its layers). */
export const FOE_SOUND = {
  cap: 3,          // foe voices (calls, cries, efforts, idles, death cries) sounding at once
  low: 2,          // an idle or an alert call only while fewer than this are sounding
  blows: 3,        // the blows' own sounds (a swing, a shot, a slam) sounding at once
  kindGap: 0.5,    // s: one kind's same call (a pack's alert) once within this
  alertGap: 4,     // s: one foe's alert or mourn at most this often
  cryGap: 0.8,     // s: one foe's wind-up cry at most this often (a chain of blows: the first)
  idle: { calm: [7, 14], chase: [4, 8], hear: 22, gap: 0.9 },   // s between one foe's idles (calm, in a fight); m; s between any two
  steps: { near: 3, hear: 14, perSec: 8, min: 0.12 },           // the nearest movers; m; over all of them; s between one foe's
  // where each lands against the music's reference (dB, the sound QC's measure: K-weighted, its loudest 50 ms, within
  // 6 m), under the traveller's own (his cut about +1, his hurt +1.5, his footstep -14): src/foe-sound-trims.js holds
  // what each voice needs to get there (scripts/sound-qc/foe-levels.mjs measures them)
  target: { alert: -7, cry: -8, bark: -10, idle: -15, death: -6, blow: -7, step: -21 },
  level: { mourn: 0.75, rage: 1.2, flee: 0.7, call: 1.3 },   // x their own: a mourn is the alert, quieter; a rage the cry, louder; a horn the alert, louder
  vary: { pitch: 0.08, level: 0.18 },
  pitch: [0.6, 1.5],   // a body's pitch against its family's ref height: sqrt(ref / height), held inside this
  loud: { ref: 1.3, power: 0.3, range: [0.7, 1.2] },   // a body's loudness: (height / ref) ** power, held inside range (a skitter -3 dB, a hulk +1.5)
};

/**
 * Each sound family's voice: `ref` the height (m) it is written for, `alert` (it spots you), `cry` (its wind-up), `bark`
 * (its effort in the blow), `idle` (now and then). A kind may have its own (FOE_CALLS[kind] first: the roller's pearl is
 * no crab). A death cry is its alert falling (dying()).
 */
export const FOE_CALLS = {
  // ---- creatures
  shell: { ref: 0.6,     // the crab: mandibles clicking and a bubbling hiss; its claws clacking up as it winds
    alert: [C(5, 0.04, 2200, 0.02, 0.14, { q: 6 }), N('bandpass', 1600, 0.3, 0.08, { q: 2, rate: 0.6, at: 0.1 })],
    cry: [C(8, 0.05, 1900, 0.022, 0.12, { f1: 2600, q: 6 }), N('bandpass', 1200, 0.45, 0.07, { q: 3, rate: 0.5 })],
    bark: [C(2, 0.04, 2400, 0.025, 0.16, { q: 7 })],
    idle: [N('bandpass', 1400, 0.35, 0.06, { q: 3, rate: 0.45 }), C(3, 0.06, 2300, 0.015, 0.06, { q: 6, at: 0.2 })] },
  roller: { ref: 0.9,    // the pearl roller: a hollow hum and its shell's glassy ring
    alert: [R(980, GLASS, 0.5, 0.035), T('sine', 180, 240, 0.4, 0.06)],
    cry: [T('sine', 120, 260, 0.6, 0.07), N('lowpass', 300, 0.6, 0.1, { rate: 0.4 })],
    bark: [R(1180, GLASS, 0.2, 0.03), N('lowpass', 400, 0.1, 0.1, { rate: 0.5 })],
    idle: [T('sine', 150, 155, 0.4, 0.04)] },
  chitin: { ref: 0.4,    // the skitters, the centipede: a chitter; a buzz of it rising
    alert: [C(10, 0.022, 4200, 0.012, 0.1, { f1: 3200, q: 8 })],
    cry: [C(16, 0.028, 3000, 0.012, 0.09, { f1: 4800, q: 8 }), N('bandpass', 3800, 0.45, 0.04, { q: 4 })],
    bark: [C(3, 0.02, 4600, 0.012, 0.11, { q: 8 })],
    idle: [C(5, 0.03, 3800, 0.01, 0.06, { q: 8 })] },
  bellows: { ref: 1.1,   // the toad: a croak (a voice in pulses); its throat swelling
    alert: [G(130, 110, 0.4, 0.26, 'o', { am: 22, depth: 0.85, wave: 'square' })],
    cry: [G(95, 150, 0.7, 0.24, 'u', { am: 18, depth: 0.8, wave: 'square' }), N('bandpass', 600, 0.6, 0.08, { f1: 1200, q: 2, rate: 0.6 })],
    bark: [G(150, 90, 0.18, 0.24, 'o', { am: 30, depth: 0.7, wave: 'square' })],
    idle: [G(120, 105, 0.3, 0.16, 'o', { am: 20, depth: 0.85, wave: 'square' }), G(125, 108, 0.25, 0.14, 'o', { am: 20, depth: 0.85, wave: 'square', at: 0.45 })] },
  scale: { ref: 1.2,     // the lizard, the prowler: a hiss and a rattle in the throat; a rising hiss; a snap of breath
    alert: [N('highpass', 2800, 0.3, 0.12, { rate: 1.2 }), C(6, 0.03, 900, 0.02, 0.1, { q: 3, at: 0.08 })],
    cry: [N('bandpass', 2200, 0.5, 0.11, { f1: 4200, q: 1.2, rate: 1.1 }), G(260, 340, 0.4, 0.1, 'e', { am: 55, depth: 0.7 })],
    bark: [N('highpass', 3200, 0.12, 0.12, { rate: 1.3 }), T('triangle', 900, 1300, 0.06, 0.06)],
    idle: [C(4, 0.025, 2600, 0.012, 0.06, { q: 4 }), N('highpass', 4000, 0.15, 0.04, { at: 0.12 })] },
  clay: { ref: 1.3,      // the heron: a squawk
    alert: [G(700, 520, 0.28, 0.16, 'e', { wave: 'square', am: 60, depth: 0.4 })],
    cry: [G(520, 820, 0.45, 0.14, 'a', { wave: 'square', am: 48, depth: 0.4 })],
    bark: [G(760, 600, 0.12, 0.15, 'e', { wave: 'square' })],
    idle: [R(560, CLAY, 0.2, 0.04), G(640, 560, 0.12, 0.08, 'e', { wave: 'square', at: 0.18 })] },
  roots: { ref: 1.5,     // the root knot: wood creaking, the trunk's groan
    alert: [T('sawtooth', 140, 105, 0.45, 0.05), C(4, 0.07, 1200, 0.02, 0.1, { q: 3 })],
    cry: [G(80, 120, 0.6, 0.16, 'u', { am: 14, depth: 0.6 }), C(6, 0.08, 1000, 0.02, 0.08, { f1: 1500, q: 3 })],
    bark: [C(2, 0.04, 1400, 0.025, 0.14, { q: 3 }), N('bandpass', 700, 0.12, 0.1, { q: 1.5, rate: 0.6 })],
    idle: [T('sawtooth', 110, 95, 0.5, 0.03), C(2, 0.18, 1100, 0.02, 0.06, { q: 3, at: 0.1 })] },
  glass: { ref: 0.6,     // the jelly: a glassy warble, its lanterns chiming
    alert: [R(1320, GLASS, 0.5, 0.04), T('sine', 520, 780, 0.25, 0.06, { at: 0.05 })],
    cry: [T('sine', 400, 900, 0.5, 0.06), R(1760, GLASS, 0.6, 0.03, { at: 0.2 })],
    bark: [T('sine', 700, 380, 0.12, 0.08)],
    idle: [T('sine', 330, 420, 0.25, 0.04), R(1980, GLASS, 0.4, 0.015, { at: 0.12 })] },
  paper: { ref: 0.4,     // the moth: a papery flutter and a thin chirp
    alert: [C(8, 0.018, 3200, 0.012, 0.07, { q: 1.5 }), T('triangle', 2400, 3100, 0.1, 0.04, { at: 0.08 })],
    cry: [N('bandpass', 2600, 0.45, 0.07, { f1: 4400, q: 1.2, rate: 1.2 }), T('triangle', 2200, 3400, 0.3, 0.03)],
    bark: [N('bandpass', 3000, 0.1, 0.08, { q: 1.5, rate: 1.2 })],
    idle: [C(5, 0.02, 3000, 0.012, 0.05, { q: 1.5 })] },
  ray: { ref: 0.3,       // the sky ray: a keen whistling through its gills, a whoosh
    alert: [T('sine', 1300, 900, 0.35, 0.05), N('bandpass', 1400, 0.3, 0.06, { f1: 700, q: 1 })],
    cry: [T('sine', 800, 1500, 0.5, 0.05), N('bandpass', 700, 0.5, 0.08, { f1: 1600, q: 0.9 })],
    bark: [N('bandpass', 1100, 0.18, 0.1, { f1: 500, q: 1 })],
    idle: [T('sine', 1100, 950, 0.3, 0.025)] },
  earth: { ref: 1.1,     // the worm: a deep grinding groan, sand hissing off it
    alert: [G(70, 95, 0.6, 0.2, 'u', { am: 16, depth: 0.6, breath: 500 }), N('bandpass', 1200, 0.5, 0.06, { q: 1, rate: 0.5 })],
    cry: [G(60, 110, 0.7, 0.22, 'o', { am: 20, depth: 0.6 }), N('lowpass', 500, 0.6, 0.1, { f1: 900, rate: 0.4 })],
    bark: [G(110, 70, 0.22, 0.2, 'u', { am: 18, depth: 0.5 })],
    idle: [N('bandpass', 900, 0.5, 0.05, { q: 1, rate: 0.4 }), G(55, 50, 0.4, 0.1, 'u', { am: 12, depth: 0.6 })] },
  // ---- the possessed machines
  steam: { ref: 1.6,     // the tripod: a steam whistle and a hiss; its boiler building pressure
    alert: [T('square', 520, 520, 0.35, 0.03), T('square', 780, 780, 0.35, 0.015), N('highpass', 3000, 0.3, 0.07, { rate: 1.3 })],
    cry: [N('highpass', 2000, 0.6, 0.08, { f1: 5000, rate: 1.3 }), T('sawtooth', 110, 220, 0.6, 0.03)],
    bark: [N('highpass', 2600, 0.15, 0.1, { rate: 1.4 }), T('square', 260, 220, 0.08, 0.04)],
    idle: [N('highpass', 3500, 0.25, 0.04, { rate: 1.2 }), C(2, 0.12, 900, 0.02, 0.06, { q: 3, at: 0.1 })] },
  slag: { ref: 1.0,      // the cart: the iron pot's bong over sizzling slag; its tracks grinding as it winds
    alert: [R(200, CLAY, 0.45, 0.07), N('highpass', 2200, 0.3, 0.06, { rate: 1.6 })],
    cry: [N('lowpass', 400, 0.6, 0.12, { f1: 900, rate: 0.4 }), T('sawtooth', 70, 130, 0.6, 0.04)],
    bark: [R(160, CLAY, 0.25, 0.08), N('lowpass', 500, 0.12, 0.12, { rate: 0.5 })],
    idle: [C(4, 0.09, 600, 0.03, 0.05, { q: 2, rate: 0.5 }), N('highpass', 2400, 0.2, 0.03, { rate: 1.6 })] },
  brass: { ref: 2.6,     // the bell walker: a low bell's hum, its clapper swinging
    alert: [R(196, BRONZE, 0.9, 0.05)],
    cry: [R(147, BRONZE, 0.8, 0.04), T('sine', 98, 140, 0.7, 0.05)],
    bark: [R(220, BRONZE, 0.35, 0.04)],
    idle: [R(262, BRONZE, 0.5, 0.02)] },
  tin: { ref: 0.8,       // the drone: a two-note beep; its spindle whining up
    alert: [T('square', 1200, 1200, 0.07, 0.03), T('square', 1600, 1600, 0.09, 0.03, { at: 0.09 })],
    cry: [T('sawtooth', 500, 1500, 0.5, 0.03), T('square', 1800, 1800, 0.05, 0.02, { at: 0.4 })],
    bark: [T('sawtooth', 1300, 700, 0.1, 0.035)],
    idle: [T('square', 1000, 1000, 0.05, 0.015), T('square', 1250, 1250, 0.05, 0.012, { at: 0.08 })] },
  iron: { ref: 2.4,      // the brute: its furnace's deep horn; a grinding as its arms go up
    alert: [T('sawtooth', 75, 80, 0.6, 0.06), T('sawtooth', 112, 118, 0.6, 0.03), N('lowpass', 300, 0.5, 0.1, { rate: 0.4 })],
    cry: [T('sawtooth', 60, 120, 0.7, 0.05), C(6, 0.09, 900, 0.03, 0.06, { f1: 1400, q: 3 })],
    bark: [N('lowpass', 400, 0.18, 0.16, { rate: 0.4 }), T('square', 90, 70, 0.12, 0.04)],
    idle: [N('lowpass', 250, 0.5, 0.06, { rate: 0.35 }), T('sine', 55, 52, 0.5, 0.05)] },
  steel: { ref: 1.45,    // the fencer: a servo's chirp, its blade ringing as it sets
    alert: [T('sawtooth', 600, 1100, 0.12, 0.03), R(1320, BRONZE, 0.4, 0.025, { at: 0.1 })],
    cry: [T('sawtooth', 500, 1200, 0.35, 0.025), R(1760, BRONZE, 0.3, 0.02, { at: 0.3 })],
    bark: [T('sawtooth', 900, 500, 0.08, 0.03)],
    idle: [T('sawtooth', 700, 900, 0.1, 0.012), C(1, 0, 1600, 0.02, 0.05, { q: 3, at: 0.12 })] },
  ceramic: { ref: 1.4,   // the sentinel, the oracle: a glazed shell's servo, the tone of its light
    alert: [T('sine', 880, 1320, 0.12, 0.05), T('sine', 1320, 1320, 0.15, 0.04, { at: 0.12 }), C(1, 0, 3200, 0.02, 0.05, { q: 3 })],
    cry: [T('sine', 440, 1100, 0.5, 0.05), T('square', 380, 330, 0.2, 0.015)],
    bark: [T('square', 420, 340, 0.08, 0.025), N('highpass', 4000, 0.06, 0.05)],
    idle: [T('sine', 660, 700, 0.3, 0.025)] },
  servo: { ref: 0.45,    // the crawler: chirps and ticking
    alert: [T('triangle', 1800, 2600, 0.06, 0.06), T('triangle', 2000, 2900, 0.06, 0.06, { at: 0.09 })],
    cry: [C(10, 0.04, 2400, 0.015, 0.06, { f1: 3600, q: 3 }), T('triangle', 1400, 2600, 0.4, 0.03)],
    bark: [T('triangle', 2400, 1600, 0.06, 0.06)],
    idle: [C(3, 0.05, 3200, 0.012, 0.05, { q: 3 })] },
  machine: { ref: 2.0,   // the makers' old machine (and anything without its own): a horn, a whine
    alert: [T('square', 300, 300, 0.3, 0.03), T('square', 450, 450, 0.3, 0.02)],
    cry: [T('sawtooth', 120, 460, 0.6, 0.04)],
    bark: [T('square', 220, 160, 0.12, 0.04)],
    idle: [T('sine', 110, 112, 0.4, 0.03)] },
  // ---- the spirits
  ink: { ref: 0.55,      // the blot: a wet gurgle, rising
    alert: [G(220, 340, 0.3, 0.16, 'o', { am: 24, depth: 0.8, wave: 'triangle' }), N('lowpass', 800, 0.25, 0.1, { rate: 0.5 })],
    cry: [G(160, 320, 0.5, 0.15, 'u', { am: 20, depth: 0.8, wave: 'triangle' })],
    bark: [N('lowpass', 900, 0.12, 0.14, { rate: 0.6 }), T('sine', 320, 160, 0.1, 0.06)],
    idle: [G(140, 180, 0.25, 0.1, 'u', { am: 16, depth: 0.9, wave: 'triangle' })] },
  cloth: { ref: 1.3,     // the shade: a whisper, its cloak drawn
    alert: [N('bandpass', 2600, 0.45, 0.08, { f1: 1800, q: 2.5, rate: 1.1 }), N('bandpass', 1200, 0.45, 0.05, { q: 3 })],
    cry: [N('bandpass', 1500, 0.55, 0.08, { f1: 3200, q: 2 }), N('highpass', 5000, 0.3, 0.03, { at: 0.2 })],
    bark: [N('bandpass', 1800, 0.18, 0.1, { f1: 900, q: 0.8 })],
    idle: [N('bandpass', 2200, 0.5, 0.035, { f1: 1600, q: 3 })] },
  smoke: { ref: 1.15,    // the hound: two barks; a snarl as it coils; a huff
    alert: [G(420, 300, 0.12, 0.2, 'a', { am: 40, depth: 0.3, breath: 1500 }), G(400, 280, 0.12, 0.18, 'a', { am: 40, depth: 0.3, breath: 1500, at: 0.18 })],
    cry: [G(120, 170, 0.5, 0.18, 'u', { am: 45, depth: 0.7, breath: 900 })],
    bark: [G(380, 250, 0.1, 0.2, 'a', { am: 40, depth: 0.3, breath: 1500 })],
    idle: [N('bandpass', 1100, 0.4, 0.05, { f1: 700, q: 1.2, rate: 0.7 }), G(100, 95, 0.4, 0.08, 'u', { am: 40, depth: 0.7 })] },
  strings: { ref: 1.4,   // the marionette: its strings creaking, a wooden clack
    alert: [T('sawtooth', 440, 470, 0.4, 0.025), C(3, 0.08, 1400, 0.02, 0.1, { q: 3, at: 0.05 })],
    cry: [T('sawtooth', 330, 660, 0.5, 0.02), T('sawtooth', 495, 990, 0.5, 0.012)],
    bark: [C(2, 0.05, 1500, 0.02, 0.12, { q: 3 })],
    idle: [C(2, 0.14, 1300, 0.02, 0.07, { q: 3 }), T('sawtooth', 550, 540, 0.3, 0.012)] },
  ember: { ref: 0.5,     // the wisp: a roar of flame over crackling
    alert: [N('bandpass', 600, 0.4, 0.12, { f1: 1400, q: 1, rate: 0.6 }), C(5, 0.06, 3000, 0.012, 0.05, { q: 2 })],
    cry: [N('bandpass', 400, 0.5, 0.1, { f1: 1200, q: 1, rate: 0.6 })],
    bark: [N('bandpass', 800, 0.15, 0.12, { q: 1, rate: 0.7 })],
    idle: [C(4, 0.08, 2800, 0.01, 0.05, { q: 2 }), N('lowpass', 500, 0.3, 0.05, { rate: 0.5 })] },
  junk: { ref: 1.1,      // the mummers: a hooting chatter through the mask, the pot rattling
    alert: [G(380, 520, 0.14, 0.15, 'o', { wave: 'triangle' }), G(400, 560, 0.14, 0.15, 'o', { wave: 'triangle', at: 0.17 }), C(3, 0.05, 1600, 0.02, 0.06, { q: 3, at: 0.05 })],
    cry: [G(260, 480, 0.45, 0.16, 'a', { am: 12, depth: 0.5 })],
    bark: [G(420, 300, 0.12, 0.16, 'a')],
    idle: [G(330, 300, 0.12, 0.1, 'o', { wave: 'triangle' }), G(300, 280, 0.12, 0.08, 'u', { wave: 'triangle', at: 0.2 })] },
  // ---- the monsters (roster v4)
  flesh: { ref: 1.3,     // the grunt, the hulk: a snort and a squeal; a rising snarl; a grunt in the blow; a snuffle
    alert: [N('lowpass', 900, 0.08, 0.12, { rate: 0.7 }), G(300, 520, 0.32, 0.22, 'a', { am: 34, depth: 0.45, breath: 1400, at: 0.06 })],
    cry: [G(170, 320, 0.5, 0.2, 'o', { am: 42, depth: 0.5, breath: 1100 })],
    bark: [G(240, 170, 0.16, 0.22, 'a', { am: 30, depth: 0.35, breath: 1300 })],
    idle: [N('lowpass', 800, 0.07, 0.1, { rate: 0.6 }), N('lowpass', 700, 0.08, 0.09, { rate: 0.6, at: 0.14 }), G(150, 120, 0.18, 0.12, 'u', { am: 26, depth: 0.5, at: 0.2 })] },
  hide: { ref: 2.5,      // the warlord: a roar from deep in its chest
    alert: [G(110, 150, 0.55, 0.25, 'a', { am: 28, depth: 0.5, breath: 700 }), G(220, 300, 0.5, 0.08, 'a', { at: 0.02 })],
    cry: [G(90, 160, 0.6, 0.24, 'o', { am: 32, depth: 0.55, breath: 600 })],
    bark: [G(140, 95, 0.2, 0.24, 'a', { am: 24, depth: 0.4, breath: 800 })],
    idle: [G(80, 70, 0.4, 0.14, 'u', { am: 18, depth: 0.6, breath: 500 })] },
};

/**
 * How each body plan moves (src/enemies/archetypes.js `plan`): `step` the layers of one footfall, wingbeat or whir;
 * `stride` m moved between two (x height / ref when it has a ref: a hulk strides further than a grunt), or `period` s
 * between two while it is up and about (wings and hums go on hovering in place).
 */
export const FOE_MOVES = {
  walker: { stride: 0.5, step: [C(3, 0.03, 2000, 0.012, 0.08, { q: 5 })] },                     // the crab's legs clattering
  skitterers: { stride: 0.35, step: [C(2, 0.018, 4200, 0.008, 0.05, { q: 6 })] },
  centipede: { stride: 0.3, step: [C(4, 0.02, 2800, 0.01, 0.05, { q: 5 })] },
  hopper: { stride: 1.4, step: [N('lowpass', 300, 0.12, 0.16, { rate: 0.6 }), T('sine', 110, 60, 0.1, 0.06)] },
  quadruped: { stride: 0.7, ref: 1, step: [N('lowpass', 600, 0.06, 0.08, { rate: 0.7 })] },
  stilt: { stride: 1.0, step: [N('lowpass', 900, 0.05, 0.06, { rate: 0.8 }), C(1, 0, 1800, 0.012, 0.03, { q: 3 })] },
  roller: { stride: 0.9, step: [N('lowpass', 220, 0.3, 0.1, { rate: 0.35 })] },
  tentacled: { stride: 0.8, step: [N('bandpass', 700, 0.25, 0.06, { f1: 400, q: 1.2, rate: 0.6 }), C(1, 0, 1200, 0.02, 0.04, { q: 3 })] },
  floater: { period: 1.1, step: [T('sine', 260, 330, 0.18, 0.03)] },
  flyer: { period: 0.32, step: [N('bandpass', 1800, 0.08, 0.05, { q: 1, rate: 1.1 })] },
  glider: { period: 0.9, step: [N('bandpass', 500, 0.35, 0.08, { f1: 1100, q: 0.8, rate: 0.7 })] },
  burrower: { stride: 0.8, step: [N('bandpass', 1500, 0.3, 0.06, { q: 0.8, rate: 0.5 })] },
  tracked: { stride: 0.6, step: [C(2, 0.05, 800, 0.025, 0.07, { q: 2, rate: 0.5 }), N('lowpass', 200, 0.2, 0.06, { rate: 0.3 })] },
  siege: { stride: 1.2, step: [N('lowpass', 200, 0.2, 0.2, { rate: 0.4 }), R(262, BRONZE, 0.3, 0.012, { at: 0.02 })] },
  hover: { period: 0.55, step: [T('sawtooth', 220, 230, 0.4, 0.012), N('bandpass', 900, 0.4, 0.02, { q: 4 })] },
  brute: { stride: 1.4, step: [N('lowpass', 220, 0.2, 0.22, { rate: 0.4 }), T('square', 80, 60, 0.12, 0.03)] },
  fencer: { stride: 0.9, step: [C(1, 0, 1400, 0.02, 0.06, { q: 3 }), N('lowpass', 600, 0.05, 0.06, { rate: 0.7 })] },
  blob: { stride: 0.6, step: [N('lowpass', 700, 0.1, 0.08, { f1: 400, rate: 0.5 })] },
  humanoid: { stride: 1.0, step: [N('bandpass', 1600, 0.18, 0.04, { f1: 900, q: 0.8 })] },
  strings: { stride: 0.9, step: [C(1, 0, 1500, 0.02, 0.06, { q: 3 })] },
  ember: { period: 0.8, step: [C(2, 0.05, 3000, 0.01, 0.04, { q: 2 })] },
  mummer: { stride: 0.8, step: [N('lowpass', 700, 0.06, 0.08, { rate: 0.7 }), C(1, 0, 1700, 0.015, 0.03, { q: 3, at: 0.01 })] },
  mummerking: { stride: 1.3, step: [N('lowpass', 250, 0.16, 0.2, { rate: 0.45 }), R(500, CLAY, 0.2, 0.02)] },
  monster: { stride: 0.9, ref: 1.3, step: [N('lowpass', 500, 0.07, 0.1, { rate: 0.7 })] },
  machine: { stride: 1.2, step: [N('lowpass', 260, 0.16, 0.18, { rate: 0.45 }), C(1, 0, 1100, 0.03, 0.06, { q: 3, at: 0.01 })] },   // the tripod's iron feet
  sentinel: { stride: 0.9, step: [N('lowpass', 600, 0.05, 0.07, { rate: 0.7 }), T('square', 380, 340, 0.06, 0.01)] },
  oracle: { period: 0.9, step: [T('sine', 330, 335, 0.5, 0.012)] },
  crawler: { stride: 0.3, step: [C(2, 0.03, 3000, 0.01, 0.04, { q: 3 })] },
};

/**
 * The blow's own sound, by what the attack is (attackSort): a swing's whoosh (a machine's with a ring of metal), a bite's
 * snap, a slam (its whoosh, then the weight landing at its contact: `impact`), a charge's rush, a blast all round it (a
 * whirl, a vent), a spit, a bolt, a bow's twang, a lob heaved, a cast's shimmer. 'call' is the family's alert, louder (a horn, a roar); 'none' has its own (the
 * wisp's fireball: src/audio.js fireball).
 */
export const FOE_BLOWS = {
  swing: [N('bandpass', 600, 0.24, 0.12, { f1: 1600, q: 1.2, rate: 1.1 })],
  'swing-metal': [N('bandpass', 700, 0.22, 0.1, { f1: 1800, q: 1.4 }), R(1500, BRONZE, 0.25, 0.012, { at: 0.05 })],
  bite: [C(2, 0.05, 1900, 0.02, 0.14, { q: 4 }), T('triangle', 260, 120, 0.08, 0.07)],
  slam: [N('bandpass', 400, 0.2, 0.08, { f1: 900, q: 1 })],
  impact: [N('lowpass', 260, 0.35, 0.22, { rate: 0.45 }), T('sine', 90, 40, 0.3, 0.16)],
  charge: [N('bandpass', 300, 0.5, 0.12, { f1: 1000, q: 0.9, rate: 0.8 })],
  spit: [N('bandpass', 1300, 0.12, 0.14, { f1: 600, q: 1.5, rate: 0.9 }), T('sine', 480, 200, 0.1, 0.06)],
  bolt: [T('sawtooth', 1500, 300, 0.18, 0.035), N('highpass', 3000, 0.14, 0.08, { rate: 1.2 })],
  bow: [T('triangle', 196, 190, 0.25, 0.08), C(1, 0, 3200, 0.01, 0.08, { q: 2 }), N('bandpass', 2600, 0.22, 0.05, { f1: 1400, q: 2, at: 0.02 })],
  blast: [N('bandpass', 350, 0.35, 0.13, { f1: 1300, q: 0.8, rate: 0.8 }), N('lowpass', 300, 0.2, 0.1, { rate: 0.5 })],
  lob: [N('bandpass', 400, 0.25, 0.1, { f1: 900, q: 1, rate: 0.8 }), T('sine', 180, 420, 0.15, 0.05)],
  cast: [N('bandpass', 800, 0.5, 0.06, { f1: 2400, q: 1.5 }), R(1600, GLASS, 0.5, 0.025, { at: 0.1 })],
  call: [],
  none: [],
};

/**
 * What an attack sounds like (FOE_BLOWS), from what it is: its keys and shape (src/enemies/archetypes.js), never its id
 * alone, so a move changed or given to another foe (a melee foe turned to shooting) sounds as what it now is.
 * `metal`: a machine's (a swing rings, a shot is a bolt not a spit).
 */
export function attackSort(a = {}, metal = false) {
  if (a.ball) return 'none';
  if (a.horn || a.shove) return 'call';
  if (a.ward || a.mend || a.possess || a.blind || a.slip || a.blur || a.draft || !(a.damage > 0)) return 'cast';
  if (a.lob) return 'lob';
  if (a.weapon === 'bow') return 'bow';
  if (a.grab || (a.tether && !metal)) return 'swing';   // (a lash that catches you: a root's grip, a string's yank)
  if (a.tether || a.bolt || a.shot || a.projectile) return metal ? 'bolt' : 'spit';
  const ranged = (a.shape === 'lane' || a.shape === 'cone') && !a.lunge && !a.sweep && !a.dive && (a.range ?? 0) >= 6;
  if (ranged) return metal ? 'bolt' : 'spit';
  if (a.wave || a.leap || a.surface || a.selfDestruct || a.dives || /slam|stomp|stamp|toll|quake|erupt|smash|pound|drop/.test(a.id ?? '')) return 'slam';
  if (a.sweep || a.dive || a.rolls || (a.lunge ?? 0) >= 4) return 'charge';
  if (a.shape === 'ring' && (a.at === 'self' || !a.at) && !a.lunge) return 'blast';   // (all round it: a whirl, a tail's sweep, a vent, a flare)
  if (/bite|snap|pounce|nip/.test(a.id ?? '')) return 'bite';
  return metal ? 'swing-metal' : 'swing';
}

/** A blow's layers: its sort's; a slam's whoosh then its weight landing at its contact (at once for an instant one). */
export function blowLayers(sort, a = {}, instant = false) {
  const B = FOE_BLOWS[sort] ?? [];
  if (sort !== 'slam') return B;
  const at = instant ? 0 : (a.strike ?? 0.24) * (a.contact ?? 0.55);
  return [...(instant ? [] : B), ...FOE_BLOWS.impact.map((L) => ({ ...L, at: (L.at ?? 0) + at }))];
}

/** A call turned into its death cry: every glide falling to about half, a little longer; clicks slowing down. */
export function dying(layers) {
  return layers.map((L) => {
    if (L.p === 'tone' || L.p === 'growl') return { ...L, f1: Math.min(L.f, L.f1 ?? L.f) * 0.55, dur: L.dur * 1.35 };
    if (L.p === 'noise') return { ...L, f1: (L.f1 ?? L.f) * 0.6, dur: L.dur * 1.3 };
    if (L.p === 'clicks') return { ...L, n: L.n + 2, every: L.every * 1.3, f1: L.f * 0.6 };
    return { ...L, dur: L.dur * 1.3 };
  });
}

const FAMILY_OF = (f) => ARCHETYPES[f.archetype]?.sound ?? f.def?.sound ?? 'machine';
const PLAN_OF = (f) => ARCHETYPES[f.archetype]?.plan ?? (f.def?.hover ? 'hover' : 'brute');
/** Which voice a foe has (FOE_CALLS' key): its kind's own, else its family's, else the makers' machine's. */
export const callKey = (f) => (FOE_CALLS[f.kind] ? f.kind : FOE_CALLS[FAMILY_OF(f)] ? FAMILY_OF(f) : 'machine');
export const callsOf = (f) => FOE_CALLS[callKey(f)];
/** How it moves (FOE_MOVES' key): its plan's, else a hover's or a heavy walker's. */
export const moveKey = (f) => (FOE_MOVES[PLAN_OF(f)] ? PLAN_OF(f) : f.def?.hover ? 'hover' : 'brute');
export const movesOf = (f) => FOE_MOVES[moveKey(f)];
/** The level (x) that brings a voice to its target (src/foe-sound-trims.js, dB): group 'calls' | 'moves' | 'blows'. */
export function trimOf(group, key, event = null) {
  const T = FOE_TRIM[group]?.[key], dB = event ? T?.[event] : T;
  return 10 ** ((typeof dB === 'number' ? dB : 0) / 20);
}
/** Is it a machine (a swing rings, a shot is a bolt)? */
export const isMetal = (f) => (ARCHETYPES[f.archetype]?.family ?? (f.def?.sound === 'machine' ? 'machine' : '')) === 'machine';
/** Its body's loudness (FOE_SOUND.loud): a small one quieter, a big one a little louder, whatever its voice. */
/** Its body's height as its voice was tuned (m): a foe grown to the traveller (ARCHETYPES[a].scale, #741) keeps its voice. */
const voiceHeight = (f, or) => (f.def?.height != null ? f.def.height / (ARCHETYPES[f.archetype]?.scale ?? 1) : or);
export function bodyLoud(f) {
  const L = FOE_SOUND.loud, h = voiceHeight(f, L.ref);
  return Math.max(L.range[0], Math.min(L.range[1], (h / L.ref) ** L.power));
}
/** Its body's pitch against its voice's ref height: a bigger one lower. */
export function bodyPitch(f, ref) {
  const h = voiceHeight(f, ref ?? 1);
  return Math.max(FOE_SOUND.pitch[0], Math.min(FOE_SOUND.pitch[1], Math.sqrt((ref ?? h) / Math.max(0.1, h))));
}

/**
 * Watches the foes (src/foes.js Foes: `event` for each foe's events, `call` for its body's gestures, `frame` once a
 * frame after they have moved) and voices them on the Sound (`sound()`, read every time: the Foes' may change).
 * Its clock is the frames' dt, so it runs the same with a stand-in sound, a muted one, in the engines and in tests.
 */
export class FoeSounds {
  constructor(sound = () => null, { rng = Math.random, trims = true } = {}) {
    this.sound = sound; this.rng = rng; this.trims = trims;   // (trims: false, as measured before trimming: scripts/sound-qc/foe-levels.mjs)
    this.t = 0;
    this.voices = [];     // end times of the foe voices sounding
    this.blowsOn = [];    // end times of the blows' sounds
    this.kindAt = new Map();   // `${kind}:${event}` → when last voiced
    this.stepT = []; this.idleAt = -1e9;
    this.mem = new WeakMap();  // foe → { state, x, z, walked, stepAt, idleNext, alertAt, cryAt, voiceTo, died }
  }
  memo(f) {
    let m = this.mem.get(f);
    if (!m) { m = { state: f.state, x: f.pos.x, z: f.pos.z, walked: 0, stepAt: -1e9, idleNext: this.t + this.between(f), alertAt: -1e9, cryAt: -1e9, voiceTo: -1e9, died: false }; this.mem.set(f, m); }
    return m;
  }
  between(f) { const [a, b] = f.state === 'idle' || f.state === 'home' ? FOE_SOUND.idle.calm : FOE_SOUND.idle.chase; return a + this.rng() * (b - a); }

  /**
   * Voice `layers` for foe `f`: pitched for its body and a little apart each take, at its chest, x `k` (its trim and
   * any more). voice: counts against the voices' cap (low: against `low`); else against the blows'. True when it sounded.
   */
  say(f, layers, { voice = true, low = false, k = 1, pitch = 1, ref = null, warn = false } = {}) {
    const S = this.sound?.();
    if (!S?.foeSay || !layers?.length) return false;
    this.voices = this.voices.filter((t) => t > this.t); this.blowsOn = this.blowsOn.filter((t) => t > this.t);
    const pool = voice ? this.voices : this.blowsOn;
    const on = pool.length;
    if (on >= (voice ? (low ? FOE_SOUND.low : FOE_SOUND.cap) : FOE_SOUND.blows)) return false;
    const V = FOE_SOUND.vary, p = bodyPitch(f, ref ?? callsOf(f).ref) * pitch * (1 + (this.rng() * 2 - 1) * V.pitch);
    const lvl = k * (this.trims ? bodyLoud(f) : 1) * (1 + (this.rng() * 2 - 1) * V.level);
    const len = S.foeSay(pitched(layers, p), () => f.chest ?? f.pos, { k: lvl, warn });
    const end = this.t + (len || voiceLength(layers));
    pool.push(end);
    if (voice) this.memo(f).voiceTo = end;
    return true;
  }
  /** Its voice's `event` (alert, cry, bark, idle, death), trimmed to its target, x `k`. */
  voice(f, event, o = {}) {
    const key = callKey(f), layers = event === 'death' ? dying(FOE_CALLS[key].alert) : FOE_CALLS[key][event];
    const k = (this.trims ? trimOf('calls', key, event) : 1) * (o.k ?? 1);
    return this.say(f, layers, { ...o, k, warn: event === 'cry' });
  }
  /** One kind's same call within kindGap: once. Marks it taken when free. */
  kindFree(f, event) {
    const key = `${f.kind}:${event}`, at = this.kindAt.get(key) ?? -1e9;
    if (this.t - at < FOE_SOUND.kindGap) return false;
    this.kindAt.set(key, this.t);
    return true;
  }

  /**
   * Its body's gesture (src/foes.js Foes.gesture): 'alert' (it spots you: its call), 'mourn' (a packmate fell: the call,
   * lower), 'rage' (its cry, louder), 'flee' / 'cower' (its call, higher and smaller). True when voiced.
   */
  call(f, kind = 'alert') {
    if (!f?.alive && kind !== 'mourn') return false;
    const m = this.memo(f);
    if (kind === 'alert' || kind === 'mourn') {
      if (this.t - m.alertAt < FOE_SOUND.alertGap || !this.kindFree(f, 'alert')) return false;
      m.alertAt = this.t; m.idleNext = Math.max(m.idleNext, this.t + 2);
      return this.voice(f, 'alert', { low: true, pitch: kind === 'mourn' ? 0.92 : 1, k: kind === 'mourn' ? FOE_SOUND.level.mourn : 1 });
    }
    if (kind === 'rage') return this.voice(f, 'cry', { k: FOE_SOUND.level.rage });
    if (kind === 'flee' || kind === 'cower') return this.kindFree(f, 'flee') && this.voice(f, 'alert', { low: true, pitch: 1.22, k: FOE_SOUND.level.flee });
    return false;
  }

  /** A foe's events this frame (Foe.update's: 'warn', { type: 'strike' }, the instant moves'). */
  event(f, ev) {
    if (!ev?.length) return;
    const m = this.memo(f);
    for (const e of ev) {
      if (e === 'warn') {
        m.blowFor = null;
        if (this.t - m.cryAt >= FOE_SOUND.cryGap) { m.cryAt = this.t; this.voice(f, 'cry'); }
      } else if (e?.type === 'strike') {
        const a = e.atk ?? f.atk ?? f.def?.attack;
        if (a && (a.instant || a.at === 'target') && m.blowFor !== a) { m.blowFor = a; this.blow(f, a, true); }   // (an instant move lands as its wind-up ends: no strike state to watch)
      } else if (e?.type === 'ward' || e?.type === 'mend' || e?.type === 'possess' || e?.type === 'horn') {
        const a = e.atk; if (a && m.blowFor !== a) { m.blowFor = a; this.blow(f, a, true); }
      }
    }
  }

  /** Its blow begins (or lands, instant): its effort and the blow's own sound; a slam's weight at its contact. */
  blow(f, a, instant = false) {
    const sort = attackSort(a, isMetal(f));
    if (sort === 'none') return;
    if (sort === 'call') { this.voice(f, 'alert', { k: FOE_SOUND.level.call }); return; }
    this.voice(f, 'bark');
    this.say(f, blowLayers(sort, a, instant), { voice: false, ref: Math.max(callsOf(f).ref, 1), k: this.trims ? trimOf('blows', sort) : 1 });
  }

  /**
   * Once a frame, after the foes moved (src/foes.js Foes.update): blows begun, the fallen's cries, footsteps and idles.
   * `P` the player (distances), `list` the foes.
   */
  frame(dt, P, list = []) {
    this.t += dt;
    if (this.stepT.length) this.stepT = this.stepT.filter((t) => this.t - t < 1);
    const movers = [];
    for (const f of list) {
      const m = this.memo(f), was = m.state;
      m.state = f.state;
      // gone down: its death cry, once (its burst follows when it comes apart: Sound.foeBurst)
      if (!m.died && (f.dying || f.dead !== undefined || !f.alive)) {
        m.died = true;
        if (this.inEar(f, P, 40)) this.voice(f, 'death');
        continue;
      }
      if (m.died) continue;
      if (was === 'wind' && f.state === 'strike') { const a = f.atk ?? f.def?.attack; if (a) { m.blowFor = a; this.blow(f, a); } }
      // moving: how far since the last frame (a teleport, a blink: not a stride)
      const dx = f.pos.x - m.x, dz = f.pos.z - m.z, d = Math.hypot(dx, dz);
      m.x = f.pos.x; m.z = f.pos.z;
      const M = movesOf(f), moving = d > 1e-3 && d < 2 && !f.buried;
      if (moving) m.walked += d;
      const up = M.period && (moving || (f.def?.hover && f.state !== 'idle')) && !f.buried;
      if (moving || up) movers.push({ f, m, M, dist: P ? Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z) : 0 });
      // now and then a grunt, a chitter, a whir (calm or in a fight), heard only near
      if (this.t >= m.idleNext) {
        m.idleNext = this.t + this.between(f);
        const near = this.inEar(f, P, FOE_SOUND.idle.hear);
        if (near && ['idle', 'home', 'chase'].includes(f.state) && this.t - this.idleAt >= FOE_SOUND.idle.gap && this.t >= m.voiceTo + 1 && this.kindFree(f, 'idle')
          && this.voice(f, 'idle', { low: true, k: near })) this.idleAt = this.t;
      }
    }
    // the steps of the nearest few, within reach, at most so many a second over them all
    const S = FOE_SOUND.steps;
    movers.sort((p, q) => p.dist - q.dist);
    for (const { f, m, M, dist } of movers.slice(0, S.near)) {
      if (dist > S.hear) break;
      const every = M.period ? null : M.stride * (M.ref ? Math.max(0.3, (f.def?.height ?? M.ref) / M.ref) : 1);
      const due = M.period ? this.t - m.stepAt >= M.period : m.walked >= every;
      if (!due || this.t - m.stepAt < S.min || this.stepT.length >= S.perSec) continue;
      m.walked = 0; m.stepAt = this.t;
      if (this.step(f, Math.max(0, Math.min(1, (S.hear - dist) / (S.hear - 4))))) this.stepT.push(this.t);
    }
  }
  /** One footfall, wingbeat or whir of its body plan (FOE_MOVES), x `k` (how near), at its feet. True when it sounded. */
  step(f, k = 1) {
    const S = this.sound?.(), M = movesOf(f);
    if (!S?.foeSay || !(k > 0)) return false;
    const p = bodyPitch(f, M.ref ?? voiceHeight(f)) * (1 + (this.rng() * 2 - 1) * FOE_SOUND.vary.pitch);
    S.foeSay(pitched(M.step, p), () => f.pos, { k: (this.trims ? trimOf('moves', moveKey(f)) * bodyLoud(f) : 1) * k * (1 + (this.rng() * 2 - 1) * FOE_SOUND.vary.level) });
    return true;
  }
  /** How near it is to be heard (1 within 4 m, falling to 0 at `hear`); 1 with no player to measure from. */
  inEar(f, P, hear) {
    if (!P?.pos) return 1;
    const d = Math.hypot(f.pos.x - P.pos.x, f.pos.z - P.pos.z);
    return Math.max(0, Math.min(1, (hear - d) / Math.max(1, hear - 4)));
  }
}
