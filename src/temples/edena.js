import { landmark, landmarkFrame } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import { glazing, glaze, ceramic } from './landmark-materials.js';
import { toStair, STAIR } from '../viridel-stair.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Platform, Bridge, Seed, Bud, Glass, Sunbeam, Mark, Pit, Key, Weight } from './pieces.js';
import { registerInteractable, PRIORITY } from '../interact.js';
import { gardenerModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { machinedHouseSkin } from './skins/machined-plates.js';

// Viridel's temple: the Builders' Greenhouse, a round house of the white
// builders' clean stone under a great ribbed dome of glass, in the meadow
// hollow north of the white ruins (well clear of Esk's tea terraces, south-east
// of the landing). The builders grew their houses and their garden here, and
// left a gardener to keep it: a giant of moss, as old as the pyramids. The
// night the light passed, every flower on it closed and fell, and it has gone
// wild and bare since, and nothing in the Greenhouse grows.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: NOTHING GROWS IN THE
// SHADE (reworked from the temple design audit, v1.16), and since v1.83 (issue #411) NOTHING GROWS DRY. The builders' roof
// is a field of louvres; a stone ball's weight on a plate turns one, and a sunbeam swings down onto whatever it was turned
// for. The builders' eyes open only in the sun, and a seed wakes to the bloom only where the light falls and the water runs.
// Since v1.77 (issue #336, docs/design/temple-redesign.md) its rooms are shrines: every hall 30 to 36 m across (the round
// halls 34) under 18 m of stone or more, doors 7 by 9 (ROOMS, DOOR), each puzzle in the middle of its own room, the one
// fight in the Shade House, the Bud Passage a room of its own. Since v1.83 (issue #411, docs/design/temple-best-practices.md)
// the Potting Hall and the Glass Stair are one great hall, the Palm House, and the builders' water is the house's state:
//   the Threshold        the first mark, the way out
//   the Palm House       the great hall (G4), 36 by 78 m under a glass vault, its gallery 18 m up round three sides, open over
//                        the floor: the hub of both floors (`potting` its floor, `landing` its gallery). The builders' water
//                        is the house's one state (G1: the sluice, SLUICE): up in the high troughs (the gallery's, the upper
//                        rooms') or let down into the low channels (the floor's, the wings'), set at a sluice wheel by
//                        either hub, a gauge in every room. (#477, the gadget first) In the middle of the floor the makers'
//                        chest on its mound: BLOOM MODE (src/items.js 'bloom', a new gun mode), the house's first find. The
//                        Cold Frame's door a flower-door in the vault's sun: bloom it. From the gallery's east arm a drop into
//                        the cistern on the floor (G6); on its west arm a seed at the edge whose vine, grown down the glass,
//                        stays: a climb back up from the floor, for good. On its north band one ball, two plates, two louvres:
//                        the eye by the Seed Chamber's door, or the vine's seed
//   the Shade House      (west, an arena) dark, dead pots; its door shuts behind you while its keepers stand; won, its
//                        small key, and its north door opens into the Seed Vault
//   the Cold Frame       (east) one louvre, one ball, two plates, a seed in each tray: the ball brings the sun to one,
//                        then the other (a tray in flower stays so), and the key wants both. In its corner the disc rides
//                        up its water column to the gallery, only while the water is let down
//   the Seed Chamber     (off the gallery, past its door: two small keys and the eye; the makers' chest until #477) a
//                        seed in the oculus's sun in the middle, in a trough dry until the water is sent up (it comes up the
//                        disc with the water let down): bloomed, its north door sinks
//   the Bud Passage      the door into the Vine Gulf is a flower-door in the shade: a ball rolled onto its plate turns the
//                        passage's louvre onto it, and with the water up a bloom glob opens it
//   the Vine Gulf        the reference's hall: a chasm under a ribbed glass vault. The great louvre's beam falls into the
//                        green dark below; the sun-ball turns it onto the seed at the near lip, and with the water up it grows
//                        the vine bridge. Across, a wall of greenhouse glass and a seed-ball in the shade beside it: roll it
//                        into the light and bloom it there. Its vine climbs the glass into the great bud at the top
//   the Seed Vault       (north off the Shade House: seen before the bloom) a seed at the foot of a wall of glass; the
//                        louvre over it is turned by a stone weight lying high on the ledge: the grappling hook pulls it down
//                        (the older tool, G2), set on its plate it brings the sun, and with the water let down the bloom
//                        grows the vine up the glass. The great key on the ledge at the top, for the door past the bud; from
//                        the ledge a window in the Palm House's wall, a drop back down to its floor
//   the Glasshouse       the guardian (organic: you calm it): the Gardener. Bloom the four dead beds round the
//                        walls; then, each time it kneels, bloom its bare back. The dome's louvre throws the sun on
//                        the quarter whose footstone you last stood on: in the sun its flowers take at once (its
//                        second phase); in its last, only in the sun (stand on the footstone of the quarter it
//                        kneels in, then bloom it). The bud shuts behind you.
// After: the white ruins all over Viridel flower, vines and blossom up every slab, and the Greenhouse's dome
// is green with leaves.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On its hill north of the white ruins (a hollow until v1.55: src/viridel-stair.js HILL); its door looks south, toward the ruins and the landing. */
export const SITE = { x: 110, z: 320, r: 22, path: [150, 100] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);
/** The glass spire on the dome's finial (issue #131): its mast and its lantern, m. */
export const SPIRE = { mast: 22, lantern: 6, r: 2.4 };

/**
 * The Greenhouse's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/builders-greenhouse):
 * white stone in big panels, pale stone floors (no more green), white frames and ribs (no more teal), the glass the sky's
 * pale blue (GLASS), a pane of glass between white ribs under every frieze; its shade a crisp blue, its light white.
 */
export const PALETTE = {
  wall: '#f5f3ed', wall2: '#efece4', wall3: '#f9f7f2', floor: '#ebe7dc', floor2: '#dfdacd', trim: '#f8f6f0', fitting: '#dcd8cc', strata: 2.8,
  dark: '#4f8a5a', stone: '#f2a7b5', accent: '#f6c7a0', glow: '#7fcfa8', lamp: '#f6d36a', sand: '#b4d896', sand2: '#c9e4a8', void: '#2f4a3a',
  look: {
    all: { shadeFlat: 0.15, shadeHue: 0.5, shade: 0.3 },
    wall: { mode: 0, grid: 3.2 },
    glyph: { glow: 0.45 },
  },
  ornament: { kind: 'pane', color: '#f8f6f0', color2: '#cfe1f0', glow: 0.2 },
  light: { shadow: '#b0c0e0', light: '#ffffff', sun: '#fff8e8' },
};
/** The greenhouse glass: the sky's pale blue, lit a little (the panes, the vault, the dome). */
const GLASS = '#cfe1f0';

/**
 * (issue #411) The builders' water, the house's one state (G1): a sluice of two stops, the water up in the high troughs
 * (`wHigh`, t 1, the start: the gallery's and the upper rooms') or let down into the low channels (`wLow`, t 0: the floor's
 * and the wings'). Set at a sluice wheel by either hub of the Palm House, and in the Bud Passage, where the upper floor
 * first wants it up (`wheels`: local [x, y, z], the way each faces); how long the water takes to run (`run`, s: what you
 * see; the logic moves at once).
 */
export const SLUICE = {
  run: 3,
  wheels: [{ room: 'potting', at: [8.6, 0, 47], yaw: -Math.PI / 2 }, { room: 'landing', at: [-9.5, 18, 89.4], yaw: Math.PI }, { room: 'bud', at: [-10.5, 18, 152], yaw: Math.PI / 2 }],
};
/** (issue #411) The water's two stops, as conditions: up in the high troughs, or let down into the low channels. */
export const HIGH = { drumOn: ['sluice', 'wHigh'] }, LOW = { drumOn: ['sluice', 'wLow'] };

export const LOGIC = {
  id: 'edena', entry: 'threshold', gadget: 'bloom',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a fight;
  // src/foes.js places machines only in a fight's room, round its mark's `foes`: scripts/temple-design/rules.mjs,
  // tests/temple-rules.test.js. The Palm House's floor holds the bloom (issue #477; the Seed Chamber did). Since v1.83, issue #411, `potting` is the Palm
  // House's floor and `landing` its gallery: the ids kept, so a save's last mark holds; the Glass Stair is gone into it)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, potting: { checkpoint: true, kind: 'puzzle' }, shade: { checkpoint: true, kind: 'combat' }, frame: { checkpoint: true, kind: 'puzzle' },
    landing: { checkpoint: true, kind: 'puzzle' }, seed: { checkpoint: true, kind: 'puzzle' }, bud: { checkpoint: true, kind: 'puzzle' },
    gulf: { checkpoint: true, kind: 'puzzle' }, gulfFar: { checkpoint: true, kind: 'puzzle' }, vault: { checkpoint: true, kind: 'puzzle' }, vaultTop: { kind: 'passage' },
    ante: { checkpoint: true, kind: 'passage' }, hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'potting' },
    // the Palm House's floor is the hub: west the Shade House (an arena), east the Cold Frame behind the eye's door
    { a: 'potting', b: 'shade', door: 'dW' },          // (open: it shuts behind you while its keepers stand)
    { a: 'potting', b: 'frame', door: 'dE' },
    // up: the Cold Frame's disc on its water column, to the gallery's east arm (it rides only while the water is let down)
    { a: 'frame', b: 'landing', door: 'lift' },
    // (G6, issue #411) the drop off the gallery's east arm into the cistern on the floor, and the vine that stays: grown down
    // the glass from the gallery's west arm, a climb back up from the floor for good
    { a: 'landing', b: 'potting', oneWay: true },
    { a: 'potting', b: 'landing', door: 'vineS' },
    { a: 'landing', b: 'seed', door: 'd1' },           // the Seed Chamber's door: both small keys, and the eye by it
    { a: 'seed', b: 'bud', door: 'dS' },               // the chamber's north door: it sinks for the bloom in your hand (v1.77)
    { a: 'bud', b: 'gulf', door: 'd3' },               // the Bud Passage's flower-door
    { a: 'gulf', b: 'gulfFar', door: 'vine1' },        // the vine bridge
    // the Seed Vault (north off the Shade House once it is won): the great key up its glass, and from the top a window in
    // the Palm House's west wall, a drop back down to its floor
    { a: 'shade', b: 'vault', door: 'dV' },
    { a: 'vault', b: 'vaultTop', door: 'vineV' },      // up the vine its seed grows, on the glass
    { a: 'vaultTop', b: 'potting', oneWay: true },
    { a: 'gulfFar', b: 'ante', door: 'd4' },           // up the vine on the glass, into the bud it opens
    { a: 'ante', b: 'hall', door: 'dB' },              // the great key's door, past the bud
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // (issue #477, the house reshaped: the gadget first) the makers' chest on its mound in the middle of the Palm House's
    // floor, the second room: the bloom from the start, and the house about it from there on. (In the Seed Chamber until
    // v1.85, the seventh room reached)
    chest: { type: 'gadget', room: 'potting', item: 'bloom' },
    // the Cold Frame's door a flower-door in the vault's sun (an eye the floor's ball woke until #477): bloom it, the first
    // step a seed's, before any push
    bE: { type: 'switch', room: 'potting', needs: ['bloom'] },
    dE: { type: 'door', opens: { lit: 'bE' }, latch: true },
    // the Shade House: in the dark, its keepers beaten, the small key's cage sinks
    arW: { type: 'arena', room: 'shade' },
    kW: { type: 'key', kind: 'small', room: 'shade', when: { lit: 'arW' } },
    dW: { type: 'door', opens: null },
    dV: { type: 'door', opens: { lit: 'arW' }, latch: true },   // (won, its north door into the Seed Vault)
    // the Cold Frame: one louvre, one ball, two plates, a tray of seeds under each (the eyes over them until #477: the bloom
    // in hand from the start, every room after the chest wants it); bloomed in the sun, a tray stays in flower
    // (the trays before the ball: once one can grow, the marker points at it, not at the ball's other plate)
    sC1: { type: 'switch', room: 'frame', needs: ['bloom'], when: { drumOn: ['ballC', 'pC1'] } },
    sC2: { type: 'switch', room: 'frame', needs: ['bloom'], when: { drumOn: ['ballC', 'pC2'] } },
    ballC: { type: 'drum', room: 'frame', stops: { pC1: 1, pC2: 0 }, start: 0.5 },
    pC1: { type: 'plate', room: 'frame' }, pC2: { type: 'plate', room: 'frame' },
    kE: { type: 'key', kind: 'small', room: 'frame', when: { all: [{ lit: 'sC1' }, { lit: 'sC2' }] } },
    // its disc rides up its column only on the water let down (issue #411)
    // (latched for the logic: once ridden, the way up is always one wheel away, at the floor's sluice wheel; the disc itself
    // rides only on the water let down, WaterLift)
    lift: { type: 'door', opens: LOW, latch: true },
    // the gallery's north band: one ball, two plates, two louvres: east, the sun on the eye by the Seed Chamber's door;
    // west, on the vine's seed at the west arm's edge (it grows only with the water up in the gallery's trough)
    s2: { type: 'switch', room: 'landing', when: { drumOn: ['ballL', 'pL2'] } },
    ballL: { type: 'drum', room: 'landing', stops: { pL1: 0, pL2: 1 }, start: 0.5 },
    pL1: { type: 'plate', room: 'landing' }, pL2: { type: 'plate', room: 'landing' },
    d1: { type: 'door', lock: 'small', keys: 2, opens: { lit: 's2' }, latch: true },
    seedS: { type: 'switch', room: 'landing', needs: ['bloom'], when: { all: [{ drumOn: ['ballL', 'pL1'] }, HIGH] }, shortcut: true },   // (a shortcut: nothing waits on it, the maps' extras say so)
    vineS: { type: 'bridge', opens: { lit: 'seedS' }, latch: true },   // (the vine that stays: grown, a climb for good)
    // the Seed Chamber (issue #477: the chest gone down to the Palm House): its seed in the oculus's sun on the dais, in a
    // trough wet only with the water up (it comes up the Cold Frame's disc with the water down): bloomed, its north door sinks
    seed0: { type: 'switch', room: 'seed', needs: ['bloom'], when: HIGH },
    dS: { type: 'door', opens: { lit: 'seed0' }, latch: true },
    // the Bud Passage: the bud in the shade until the passage's ball turns its louvre, and dry until the water is up
    ballB: { type: 'drum', room: 'bud', plate: 'pB', plateAt: 1, start: 0 },
    pB: { type: 'plate', room: 'bud' },
    bud1: { type: 'switch', room: 'bud', needs: ['bloom'], when: { all: [{ drumOn: ['ballB', 'pB'] }, HIGH] } },
    d3: { type: 'door', opens: { lit: 'bud1' }, latch: true },
    // the Vine Gulf: the light brought to the seed (with the water up in its trough), then the seed brought to the light
    sun: { type: 'drum', room: 'gulf', plate: 'pS', plateAt: 1, start: 0 },
    pS: { type: 'plate', room: 'gulf' },
    seed1: { type: 'switch', room: 'gulf', needs: ['bloom'], when: { all: [{ drumOn: ['sun', 'pS'] }, HIGH] } },
    vine1: { type: 'bridge', opens: { lit: 'seed1' }, latch: true },
    sb: { type: 'drum', room: 'gulfFar', plate: 'pG', plateAt: 1, start: 0.2 },   // (issue #275: it starts 1.5 m along its groove, off the wall it lay against: room behind it to push from)
    pG: { type: 'plate', room: 'gulfFar' },
    seed2: { type: 'switch', room: 'gulfFar', needs: ['bloom'], when: { drumOn: ['sb', 'pG'] } },   // (rooted in the glass's own wet foot: the sun is all it wants)
    d4: { type: 'door', opens: { lit: 'seed2' }, latch: true },      // (the arena's door too: it shuts behind you)
    // the Seed Vault (issue #411): one seed at the glass's foot, its louvre turned by a stone weight that lies high on the
    // ledge, out of reach: the grappling hook pulls it down into your hands (the older tool with the bloom, G2); set on its
    // plate, the sun swings onto the seed, and it grows only with the water let down into the vault's channel. The bud's far
    // door wants its great key, so the bloom is carried back down for it
    wV: { type: 'weight', room: 'vault', plate: 'pVw', needs: ['hook'] },
    pVw: { type: 'plate', room: 'vault' },
    sdA: { type: 'switch', room: 'vault', needs: ['bloom'], when: { all: [{ weightOn: ['wV', 'pVw'] }, LOW] } },
    vineV: { type: 'bridge', opens: { lit: 'sdA' }, latch: true },
    kB: { type: 'key', kind: 'big', room: 'vaultTop' },
    dB: { type: 'door', lock: 'big' },
    // the Glasshouse: four dead beds round the walls, a footstone before each that turns the dome's louvre to its quarter
    bed1: { type: 'switch', room: 'hall', needs: ['bloom'] },
    bed2: { type: 'switch', room: 'hall', needs: ['bloom'] },
    bed3: { type: 'switch', room: 'hall', needs: ['bloom'] },
    bed4: { type: 'switch', room: 'hall', needs: ['bloom'] },
    fs1: { type: 'plate', room: 'hall' },
    fs2: { type: 'plate', room: 'hall' },
    fs3: { type: 'plate', room: 'hall' },
    fs4: { type: 'plate', room: 'hall' },
    // (issue #411: its first phase's calm is the four beds in flower, so they are the fight's own steps, not extras)
    gardener: { type: 'boss', room: 'hall', needs: ['gun', 'bloom'], requires: { all: ['bed1', 'bed2', 'bed3', 'bed4'].map((id) => ({ lit: id })) } },
    d5: { type: 'door', opens: { resolved: true } },
    // (issue #411) the builders' water, the house's state: up (1) or let down (0), saved. Set at a sluice wheel by either hub
    // of the Palm House, its floor or its gallery, and in the Bud Passage. Its two stops are no plates anyone stands on (no room: nothing points at
    // them). (Last of the things to do, so the scout asks for it only once nothing nearer is left: logic.next)
    sluice: { type: 'drum', room: 'potting', rooms: ['potting', 'landing', 'bud'], stops: { wLow: 0, wHigh: 1 }, start: 1, roll: 'hand', verb: 'sluice' },
    wLow: { type: 'plate' }, wHigh: { type: 'plate' },
    // the house's map, in a little chest off the way on (issue #405: src/house-map.js; nothing waits on it)
    map: { type: 'map', room: 'vault', at: [-49.2, 0, 62.4], yaw: Math.PI / 2, display: { scale: 1.5, plinth: [1.8, .24, 1.6] } },
  },
};

export const GARDENER = {
  kind: 'organic', name: 'the Gardener', final: 'touch', touch: 'lay a hand on its brow',
  speed: 1.8, wakeTime: 3.2,
  wake: 'A giant of moss with a stone face heaves up in the glasshouse, roaring.',
  openHint: 'It kneels, heaving, its bare back to the glass. Bloom it.',
  weary: 'It lies down among the beds, flowering all over. Go to it.',
  resolved: 'The Gardener sighs and closes its eyes. Everything begins to grow.',
  missHint: 'Its claws are stuck in the floor: bloom its bare back.',
  phases: [
    { to: 0.4, attacks: ['sweep', 'stamp', 'clods'], pause: 1.7, hint: 'It tramples the dead flower beds round the walls. Make them bloom.' },
    { to: 0.7, attacks: ['sweep', 'roots', 'stamp'], pause: 1.3, hint: 'When it kneels in sun, bloom its back. A footstone turns the sun on it.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'shot', moves: ['roots'], open: 4.6,
        hint: 'Splash water on it as it crouches: it kneels to drink.',
        said: 'It drinks the water and kneels, heaving. Bloom its back.',
        lines: ['It crouches and pushes its roots into the floor.', 'Splash water on it while it crouches. It kneels to drink.', 'Switch to the fluid and splash it while it crouches for its roots; then bloom its back as it kneels.'] } },
    { to: 0.9, attacks: ['crush', 'clods', 'sweep'], pause: 1.1, hint: 'Flowers won’t grow on it in shade: turn the sun onto it, then bloom it.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    sweep: { shape: 'cone', range: 11, angle: 0.75, wind: 1.2, track: 0.6, part: 'arms', rig: 'coil', side: 1, parts: ['arms'], splash: 0.5, active: 0.35, reach: 6.5, gap: 0.65, damage: 0.75, knock: 11, recover: 0.9, then: 'sweepL' },
    sweepL: { shape: 'cone', range: 11, angle: 0.75, wind: 0.75, track: 0.5, part: 'arms', rig: 'coil', pose: 'sweep', side: -1, link: true, parts: ['arms'], splash: 0.5, active: 0.35, reach: 6.5, damage: 0.75, knock: 11, gap: 0.2, then: 'stampEnd' },
    stamp: { shape: 'ring', at: 'self', radius: 7.5, wind: 1.4, part: 'feet', rig: 'rear', wave: { speed: 8, reach: 15, width: 0.7, damage: 0.5 }, parts: ['feet'], splash: 0.6, active: 0.35, blast: { kind: 'front', r0: 1, r1: 6, h: 0.6 }, reach: 6, damage: 1, knock: 10, recover: 1.0, open: 3.2 },
    stampEnd: { shape: 'ring', at: 'self', radius: 7.5, wind: 1.2, part: 'feet', rig: 'rear', pose: 'stamp', link: true, parts: ['feet'], splash: 0.6, active: 0.35, blast: { kind: 'front', r0: 1, r1: 6, h: 0.6 }, reach: 6, damage: 1, knock: 10, recover: 1.0, open: 3.2 },
    roots: { shape: 'lane', range: 16, width: 3, wind: 1.4, track: 0.6, part: 'arms', rig: 'crouch', blast: { kind: 'front', r0: 2, h: 1.0 }, active: 0.7, damage: 0.75, knock: 9, recover: 1.0, miss: 2.8 },
    clods: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', pose: 'sweep', damage: 0.75, knock: 8, recover: 0.8 },
    crush: { shape: 'cone', range: 8, angle: 0.9, wind: 1.3, track: 0.6, part: 'arms', rig: 'rear', pose: 'roots', parts: ['arms'], splash: 0.6, active: 0.35, reach: 5.5, damage: 1, knock: 11, recover: 0.8, miss: 3.0 },
  },
};

const BEDS = ['bed1', 'bed2', 'bed3', 'bed4'];
const FOOTSTONES = ['fs1', 'fs2', 'fs3', 'fs4'];
/**
 * The Glasshouse's sun: the dome's louvre throws it on one quarter at a time (a pool of light round the bed
 * that quarter's footstone stands before, `r` m), and turns it to the quarter whose footstone you last stood on.
 * How long the Gardener kneels in its last two phases (s: long enough to reach a footstone and let the sun swing
 * over), and what a bloom on its back is worth in the sun and in the shade, phase by phase.
 */
export const SUN = { r: 8.5, pad: 1.4, open: [null, 4.6, 6.2], sun: [0.15, 0.3, 0.1], shade: [0.15, 0.15, 0] };
/** Is the kneeling Gardener in the sun (the louvre settled on its quarter)? */
const sunOn = (g) => !!g.rt.gardenSun?.lights(g.model.pos, SUN.pad);
/** In its first phase the Gardener's calm is the beds round the walls: a tenth for each in flower. */
function syncBeds(g) {
  if (!g || g.phaseIndex !== 0 || !g.awake) return;
  const n = BEDS.filter((id) => g.rt.logic.isLit(id)).length;
  if (n * 0.1 > g.meter + 1e-6) { g.add(n * 0.1 - g.meter, 'beds'); if (g.phaseIndex === 0) g.rt.notice(['', 'It stops, and turns its stone face to the bed in flower.', 'A second bed. It sways, watching the flowers open.', 'Three. A little green comes up through its bare patches.'][n] ?? null); }
}

function gardenerHit(g, part, mode, info) {
  // (its targets take fire and stilling as theirs; a bloom glob reaches them as plain fluid, its own mode in info)
  if (info?.mode === 'bloom') mode = 'bloom';
  if (mode === 'push') { g.add(-0.04, 'push'); g.rt.notice('It flinches from the shove and roars, more frightened.', 'gd.push'); return true; }
  if (mode === 'fire') { g.add(-0.05, 'fire'); g.rt.notice('It shrinks from the ember, beating at its moss. Never fire, in a garden.', 'gd.fire'); return true; }
  if (mode === 'stun') return false;   // (the stilling lens stops a strike, as anywhere)
  if (mode !== 'bloom') { g.rt.notice('It drinks the water and stays bare. Nothing grows on it.', 'gd.water'); return true; }
  if (g.phaseIndex === 0) { g.rt.notice('It shakes the flowers off, looking at the dead beds round the walls.', 'gd.early'); return true; }
  if (g.state !== 'open') { g.rt.notice('The flowers tear off as it moves. Wait for it to kneel.', 'gd.moving'); return true; }
  // the sun: in its second phase it doubles the bloom, in its last nothing grows on it without it
  const i = Math.min(g.phaseIndex, 2), lit = sunOn(g), k = lit ? SUN.sun[i] : SUN.shade[i];
  if (!k) { g.rt.notice('The flowers fold and drop off it. In the shade nothing grows on it now.', `gd.shade.${g.phaseIndex}`); return true; }
  g.add(k, lit ? 'sun' : 'bloom');
  g.rt.sound?.chime?.();
  if (lit && i >= 1) g.rt.notice('In the sun the flowers take at once. It goes still, face to the light.', `gd.sun.${g.phaseIndex}`);
  else g.rt.notice('Flowers break out over its bare back, and it goes still under them.', `gd.bloom.${g.phaseIndex}`);
  if (g.state === 'open') { g.enter('fight'); g.cool = 2.4; }
  return true;
}
/** In its last two phases it kneels a little longer: time to reach a footstone and let the sun swing over. */
function gardenerOpenFor(g, a, s) { const o = SUN.open[Math.min(g.phaseIndex, 2)]; return s && o ? Math.max(s, o) : s; }

// ------------------------------------------------------------------ the rooms (v1.77, issue #336; v1.83, issue #411)
/**
 * The house's doors (m: 5 by 6.4 before, issue #336, docs/design/temple-redesign.md: rooms like shrines) and its rooms
 * in the kit's local frame (z into the house): each hall's floor from wall to wall, its floor's height and its
 * ceiling's; the round halls' middles and radii. The Vine Gulf's near lip, its far lip and the foot of its glass are m
 * from its south wall (`lip`, `far`, `glass`); the props, the chasm (22 m), the climbs (9 m) and every groove's length
 * as they were in the smaller house, so every timing holds. Since v1.83 (issue #411) `potting` is the Palm House, the
 * great hall where the Potting Hall and the Glass Stair were, 36 by 78.4 m, its walls 34 m high under a glass vault.
 */
export const DOOR = { w: 7, h: 9 };
const C2 = 74.6, C3 = C2 + 37.2, A0 = C3 + 18.4, G0 = A0 + 31.2, HR = 20, CW = G0 + 69.8 + HR;
/** The upper floor's height (m): the Palm House's gallery, the Seed Chamber, the Bud Passage, the Vine Gulf's lips. */
export const UP = 18;
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 12, y: 0, top: 12 },
  potting: { x0: -18, x1: 18, z0: 13.2, z1: C2 + 17, y: 0, top: 34 },
  shade: { x0: -51, x1: -21, z0: 26, z1: 56, y: 0, top: 18 },
  frame: { x0: 21, x1: 51, z0: 26, z1: 56, y: 0, top: 28 },
  vault: { x0: -51, x1: -21, z0: C2 - 15, z1: C2 + 15, y: 0, top: 20 },
  seed: { x: 0, z: C3, r: 17, y: UP, top: 36 },
  bud: { x0: -15, x1: 15, z0: A0, z1: A0 + 30, y: UP, top: 36 },
  gulf: { x0: -18, x1: 18, z0: G0, z1: G0 + 60, y: -6, top: 38, lip: 16, far: 38, glass: 49.5 },
  hall: { x: 0, z: CW, r: HR, y: 27, top: 51 },
};
const mid = (R) => [(R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2];
/**
 * (issue #411) The Palm House's gallery, 18 m up round three sides, open over the floor (G4: both floors seen at once):
 * its arms down the long walls from x `w` and `e` to the walls, from z `s` to the north band, which runs wall to wall from
 * `n`, and the `bridge` across the middle between the arms (z0..z1: the bridge's ball, the eye and the vine's seed, in the
 * middle of the hall). Its east arm's `drop` (z) has no parapet: the way down into the cistern (BASIN, G6).
 */
export const GALLERY = { y: UP, w: -12, e: 12, s: 22, n: 83, t: 0.8, parapet: 1.1, drop: [59, 69], bridge: { z0: 48, z1: 56 } };
/** (issue #411) The cistern on the Palm House's floor under the gallery's drop (local m): its water takes any fall into it. */
export const BASIN = { x0: 1.6, x1: 11.4, z0: 57.6, z1: 70.4, rim: 0.25, water: 0.2 };
/**
 * (issue #411) The vine that stays: down the glass of a pier under the bridge's north edge (its middle x, w wide, its face
 * at z `face`, looking north), its seed on the bridge.
 */
export const VINE = { x: -5, w: 8, face: 57.2, seed: [-5, UP, 54.2] };
/** (issue #477) The makers' chest on the Palm House's floor, its mound's middle (local x, z): the bloom the house's first find. */
export const CHEST = [0, 33];
/** (issue #411) The Cold Frame's disc on its water column (local m), and the landing it rides up to: [x0, z0, x1, z1]. */
export const FRAME_LIFT = { x: 29.6, z: 30, r: 2.2, landing: [21, 26, 27.2, 34.5], door: 30 };

// ------------------------------------------------------------------ the hub's wings (v1.48, issue #23)
/** The Palm House's wings (local m): the Shade House west (an arena), the Cold Frame east (two eyes, one ball, one louvre). */
export const WING = {
  z: 41,                                                   // both ways out of the Palm House, a little north of its south end
  shade: { x: mid(ROOMS.shade)[0], z: 41, w: 30, d: 30 },
  frame: { x: mid(ROOMS.frame)[0], z: 41, w: 30, d: 30 },
  zone: { min: [ROOMS.shade.x0, -1, ROOMS.shade.z0], max: [ROOMS.shade.x1, 12, ROOMS.shade.z1] },
};

/**
 * The Seed Vault (v1.60, issue #23: north off the Shade House; since v1.83, issue #411, a window from its ledge into the
 * Palm House), local m: the room round x, z (w by d, h high, its floor at 0); the ledge along its east side at `ledge`, its
 * west face (x `face`) a wall of glass out in the room; the seed at the glass's foot (`seed`: x, z); the stone weight high
 * on the ledge's lip, over the glass (`weight`: its foot), and its plate on the floor (`plate`); the window in the Palm
 * House's west wall at the ledge's height (`window`: w, h).
 */
export const VAULT = {
  x: -36, z: C2, w: 30, d: 30, h: 20, ledge: 9, face: -30.2, seed: [-32, C2], weight: [-29.9, 9.2, C2 + 8.5], plate: [-39, 0, C2 + 2], window: { w: 5, h: 7 },
};

/** The Shade House's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark's `foes`). */
export const ARENAS = [{
  el: 'arW', room: 'shade', zone: WING.zone, doors: ['dW'], extra: 2,
  shut: 'The door grinds shut behind you. In the dark among the dead pots, something stirs.',
  won: 'The last of them falls still. The key’s cage sinks, the door lets go, and a second door opens in the north wall.',
}];

// ------------------------------------------------------------------ the builders' water, the house's state (issue #411)
/** The water's look: one material for every trough, channel, column and gauge in the house. */
const WATER = '#86c9e6';
const waterMat = () => makeMaterial({ color: WATER, glow: 0.55, flat: true, key: 'temple.edena.water' });
/** What a seed or a bud wants, in words, when a bloom glob fails on it: the sun (`sun` its louvre's condition) or the water. */
const whyNot = (rt, sun, water) => () => (sun && !rt.logic.check(sun) ? 'shade' : water && !rt.logic.check(water) ? 'thirst' : 'shade');
const THIRST = {
  high: 'It sprouts, and wilts back into its husk. Its trough is dry: the water is down below.',
  low: 'It sprouts, and wilts back into its husk. Its channel is dry: the water is up in the high troughs.',
};

/**
 * The sluice (LOGIC `sluice`, a drum of two stops: let down 0, up 1): this piece keeps the house's state. A wheel turned
 * (SluiceWheel) sends the water up into the high troughs or lets it down into the low channels at once, for the logic;
 * the water itself runs for SLUICE.run s (`k`: 0 down, 1 up, eased), and every trough, column and gauge follows it. It
 * points the scout at the nearest wheel (`center`). o: { id: 'sluice', at (local: where it is when no wheel is) }
 */
export class Sluice {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    this.at = rt.kit.world(...(o.at ?? [0, 0, 47]));
    this.setters = [];   // (the wheels: the scout's, and the play-through's)
    this.k = this.high ? 1 : 0;
    rt.sluice = this;
  }
  get high() { return this.rt.logic.drumOn(this.id, 'wHigh'); }
  /** Up, or let down: at once for the logic, the water running after. Returns which. */
  toggle() {
    const rt = this.rt, up = !this.high;
    rt.logic.moveDrum(this.id, up ? 1 : 0); rt.applyDoors?.();
    rt.sound?.splash?.(1.0); rt.rumble?.(1.2, 0.35);
    rt.notice?.(up ? 'Water climbs to the high troughs. The low channels drain.' : 'The high troughs empty. Water runs down to the low channels.', up ? 'sluice.up' : 'sluice.down');
    rt.game?.emit?.('temple:lit', { id: rt.id, el: this.id });
    return up ? 'up' : 'down';
  }
  update(dt) {
    const want = this.high ? 1 : 0, s = dt / SLUICE.run;
    this.k = want > this.k ? Math.min(want, this.k + s) : Math.max(want, this.k - s);
  }
  /** Where to set it from (the scout's): the nearest wheel. */
  get center() {
    const P = this.rt.player?.pos, list = this.setters.map((s) => s.at);
    if (!P || !list.length) return list[0] ?? this.at;
    return list.reduce((b, p) => (p.distanceTo(P) < b.distanceTo(P) ? p : b));
  }
}
/** The sluice's eased level: 0 let down, 1 up (the logic's own when nothing keeps it: tests, the first frame). */
const levelOf = (rt) => rt.sluice?.k ?? (rt.logic.check(HIGH) ? 1 : 0);

/**
 * A sluice wheel by a hub (SLUICE.wheels): a post of the house's white stone, a brass valve wheel on its face that turns as
 * the water runs, a little gauge of water over it. Turned (A / ×) it sends the water up or lets it down (Sluice.toggle).
 * o: { id, room, at (its foot, local), yaw (the way it faces), sets: 'sluice' }
 */
export class SluiceWheel {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id; this.o = o;
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, H = 1.15, yaw = o.yaw ?? 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.pos = K.world(x, y, z);
    K.both(M.wall, T(new THREE.BoxGeometry(0.9, H, 0.9), [x, y + H / 2, z], [0, yaw, 0]));
    K.add(M.trim, T(new THREE.BoxGeometry(1.1, 0.14, 1.1), [x, y + H + 0.07, z], [0, yaw, 0]));
    this.top = K.world(x + fx * 0.5, y + H * 0.7, z + fz * 0.5);
    this.at = this.top;
    // the wheel: on the post's face, toward whoever turns it; it turns as the water runs
    const brass = makeMaterial({ color: '#c9a25a', flat: true, metal: 'brass', refl: 0.3, key: 'temple.edena.brass' });
    this.wheel = new THREE.Group();
    this.wheel.position.copy(K.world(x + fx * 0.52, y + H * 0.62, z + fz * 0.52));
    this.wheel.rotation.y = K.heading(yaw);
    const spokes = [new THREE.TorusGeometry(0.42, 0.05, 6, 24)];
    for (let i = 0; i < 3; i++) spokes.push(new THREE.BoxGeometry(0.06, 0.84, 0.06).rotateZ((i / 3) * Math.PI));
    spokes.push(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10).rotateX(Math.PI / 2));
    for (const g of spokes) this.wheel.add(new THREE.Mesh(g, brass));
    rt.root.add(this.wheel);
    // its little gauge on top: the house's water, high or low
    this.gauge = new WaterGauge(rt, { at: [x, y + H + 0.14, z], h: 0.9, small: true });
    this.wheel.traverse((m) => { m.userData.noCollide = true; m.userData.dynamic = true; });
    const S = () => rt.sluice;
    this.off = registerInteractable({
      id: `temple.${rt.id}.${o.id}`, priority: PRIORITY.use, range: 2.4, at: () => this.top,
      prompt: () => (S()?.high ? 'let the water down' : 'send the water up'),
      enabled: () => !!S(),
      distance: (p) => Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) + Math.max(0, Math.abs(p.pos.y - this.pos.y) - 1.2) * 4,
      use: () => { this.kick = 1; return S()?.toggle(this.id); },
    });
    rt.sluice?.setters.push({ at: this.top, lever: this.id });
    this.later = !rt.sluice;   // (a wheel placed before the sluice: it joins its list on its first frame)
  }
  update(dt) {
    const S = this.rt.sluice;
    if (this.later && S) { this.later = false; S.setters.push({ at: this.top, lever: this.id }); }
    this.kick = Math.max(0, (this.kick ?? 0) - dt * 2);
    this.wheel.rotation.z = levelOf(this.rt) * Math.PI * 3;
    this.gauge.update(dt);
  }
  dispose() { this.off?.(); }
}

/**
 * A gauge of the builders' water (G1, readable everywhere): a slender cage of white trim round a column of water, its two
 * bulbs marked; the water stands in the upper bulb while it is up in the high troughs, in the lower while it is let down.
 * In every room but the guardian's. o: { room, at (its foot, local), h, small }
 */
export class WaterGauge {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, h = this.h = o.h ?? 3.2, r = o.small ? 0.14 : 0.3;
    this.rt = rt; this.o = o;
    if (!o.small) { K.both(M.wall, T(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 10), [x, y + 0.25, z])); }
    const y0 = y + (o.small ? 0 : 0.5);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; K.add(M.trim, T(new THREE.BoxGeometry(0.05, h, 0.05), [x + Math.sin(a) * (r + 0.05), y0 + h / 2, z + Math.cos(a) * (r + 0.05)])); }
    for (const f of [0, 0.5, 1]) K.add(M.trim, T(new THREE.TorusGeometry(r + 0.06, 0.035, 5, 16), [x, y0 + f * h, z], [Math.PI / 2, 0, 0]));
    this.water = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12).translate(0, 0.5, 0), waterMat());
    this.water.userData.noCollide = true; this.water.userData.dynamic = true;
    this.foot = K.world(x, y0, z);
    rt.root.add(this.water);
    this.update();
  }
  update() {
    const k = levelOf(this.rt), h = this.h;
    // the half it stands in, sliding between them as it runs
    this.water.position.copy(this.foot); this.water.position.y += k * h * 0.5 + 0.02;
    this.water.scale.set(1, h * 0.48, 1);
  }
}

/**
 * Water in a trough or a channel (drawn only): a box of the builders' water over [x0, z0]-[x1, z1] at y, `depth` deep while
 * the water is where it runs (`high`: up in the high troughs; else in the low channels), drained flat when it is not.
 * o: { box: [x0, z0, x1, z1], y, depth, high }
 */
export class Trough {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x0, z0, x1, z1] = o.box, d = this.d = o.depth ?? 0.3;
    this.rt = rt; this.o = o;
    // its stone lining, a rim each side (drawn: too low to trip on)
    K.add(M.dark, box(x1 - x0, 0.04, z1 - z0, (x0 + x1) / 2, o.y + 0.02, (z0 + z1) / 2));
    const along = x1 - x0 > z1 - z0;
    for (const s of [-1, 1]) K.add(M.trim, along ? box(x1 - x0 + 0.3, d + 0.08, 0.15, (x0 + x1) / 2, o.y + (d + 0.08) / 2, s < 0 ? z0 - 0.07 : z1 + 0.07) : box(0.15, d + 0.08, z1 - z0 + 0.3, s < 0 ? x0 - 0.07 : x1 + 0.07, o.y + (d + 0.08) / 2, (z0 + z1) / 2));
    this.water = new THREE.Mesh(box(x1 - x0, 1, z1 - z0, 0, 0.5, 0), waterMat());
    this.water.position.copy(K.world((x0 + x1) / 2, o.y + 0.04, (z0 + z1) / 2));
    this.water.rotation.y = K.heading(0);
    this.water.userData.noCollide = true; this.water.userData.dynamic = true;
    rt.root.add(this.water);
    this.update();
  }
  get full() { const k = levelOf(this.rt); return this.o.high ? k : 1 - k; }
  update() { const f = this.full; this.water.visible = f > 0.02; this.water.scale.y = Math.max(0.001, f * this.d); }
}

/**
 * (issue #411) A fall of the builders' water: a sheet from a spout down into what is under it (drawn only), running while
 * the water is where it runs (`high`: up; else let down), thinning to nothing when it is not. o: { at: [x, y, z] the spout's
 * mouth, h (m down), w, high }
 */
export class Fall {
  constructor(rt, o) {
    this.rt = rt; this.o = o;
    this.water = new THREE.Mesh(box(o.w ?? 1.2, 1, 0.18, 0, -0.5, 0), waterMat());
    this.water.position.copy(rt.kit.world(...o.at));
    this.water.rotation.y = rt.kit.heading(0);
    this.water.userData.noCollide = true; this.water.userData.dynamic = true;
    rt.root.add(this.water);
    this.update();
  }
  update() {
    const k = levelOf(this.rt), f = this.o.high ? k : 1 - k;
    this.water.visible = f > 0.02;
    this.water.scale.set(Math.max(0.05, f), this.o.h * Math.min(1, f * 1.5), 1);
  }
}

/**
 * (issue #411, G6) The cistern on the Palm House's floor, under the gallery's drop: fall into it from any height and its
 * water takes the fall in the last metres (CATCH: slowed to a wade's speed), a splash, nothing hurt; the Footprint's pools
 * (spheres.js Catch) over a long basin. Always full: it is the house's cistern, whichever way the sluice is set.
 * o: { box: [x0, z0, x1, z1], y, said }
 */
export const CATCH = { slow: 12, over: 2.5, frames: 5 / 60 };
export class Basin {
  constructor(rt, o) {
    this.rt = rt; this.o = o; this.on = false;
    const K = rt.kit, M = rt.M, [x0, z0, x1, z1] = o.box, y = o.y ?? 0, R = BASIN.rim;
    // a low rim of white stone (solid: you step over it), the water within
    for (const [w, d, cx, cz] of [[x1 - x0 + 0.6, 0.3, (x0 + x1) / 2, z0 - 0.15], [x1 - x0 + 0.6, 0.3, (x0 + x1) / 2, z1 + 0.15], [0.3, z1 - z0, x0 - 0.15, (z0 + z1) / 2], [0.3, z1 - z0, x1 + 0.15, (z0 + z1) / 2]]) K.both(M.trim, box(w, R, d, cx, y + R / 2, cz));
    K.add(M.dark, box(x1 - x0, 0.03, z1 - z0, (x0 + x1) / 2, y + 0.015, (z0 + z1) / 2));
    K.add(waterMat(), box(x1 - x0, 0.04, z1 - z0, (x0 + x1) / 2, y + BASIN.water, (z0 + z1) / 2));
    this.min = [x0, z0]; this.max = [x1, z1]; this.y = y;
  }
  over(p) { const l = this.rt.kit.local(p); return l.x > this.min[0] - 0.5 && l.x < this.max[0] + 0.5 && l.z > this.min[1] - 0.5 && l.z < this.max[1] + 0.5 && l.y > this.y - 1.5 && l.y < this.y + 60; }
  update() {
    const P = this.rt.player;
    if (!P?.pos) return;
    const over = this.over(P.pos), c = this.rt.kit.world(0, this.y, 0).y;
    if (over && !P.onGround && !P.dead && P.vel.y < -CATCH.slow) {
      this.on = true;
      if (P.pos.y - c < Math.max(CATCH.over, -P.vel.y * CATCH.frames)) P.vel.y = -CATCH.slow;
      return;
    }
    if (this.on && (P.onGround || !over || P.dead)) {
      this.on = false;
      if (P.onGround && over) { this.rt.sound?.splash?.(1.2); this.rt.notice?.(this.o.said ?? 'The cistern breaks your fall.', 'edena.caught'); }
    }
  }
}

/**
 * (issue #411) The Cold Frame's disc on its column of water: it rides up and down between the floor and the landing only
 * while the water is let down into the low channels (`when`, a Platform's); with the water up in the high troughs its
 * column drains and it sinks to the floor and rests there (whoever stands on it goes down with it). o: Platform's, and
 * `sink` (m/s)
 */
export class WaterLift extends Platform {
  constructor(rt, o) {
    super(rt, o);
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18).translate(0, 0.5, 0), waterMat());
    this.column.userData.noCollide = true; this.column.userData.dynamic = true;
    this.foot = this.path[0].clone(); this.foot.y -= (o.thick ?? 0.8) + 0.3;
    rt.root.add(this.column);
    this.updateColumn();
  }
  updateColumn() {
    const h = Math.max(0.02, this.group.position.y - (this.thick ?? 0.8) - this.foot.y), k = 1 - levelOf(this.rt);
    this.column.position.copy(this.foot);
    this.column.scale.set(1.25 * Math.max(0.2, k), h, 1.25 * Math.max(0.2, k));
    this.column.visible = k > 0.05;
  }
  update(dt, t) {
    if (this.rt.logic.check(this.o.when) || this.s <= 0) { super.update(dt, t); this.updateColumn(); return; }
    // drained: it sinks to the floor, and waits there for the water
    this.glow.uniforms.uGlow.value = 0.1;
    this.s = Math.max(0, this.s - (this.o.sink ?? 2.5) * dt); this.dirn = 1; this.wait = this.o.pause ?? 1.2;
    this.place(dt);
    const P = this.rt.player;
    if (P && !P.climbing && Math.hypot(P.pos.x - this.solid.pos.x, P.pos.z - this.solid.pos.z) < this.r && Math.abs(P.pos.y - this.solid.top) < 0.4 && P.vel.y <= 0.5) P.vel.y = Math.min(P.vel.y, this.solid.vel.y);
    this.updateColumn();
  }
}

/**
 * The Shade House (west of the Palm House, the house's one fight: no louvre, only the dark; its door shuts behind you
 * while its keepers stand round its middle among four columns, and won, the small key's cage sinks and its north door
 * opens into the Seed Vault) and the Cold Frame (east, behind the eye's door: one louvre in its roof, one ball and two
 * plates; on the north plate the sun falls on the north tray's eye, on the south on the south's, each eye on a post behind
 * its tray. An eye woken in the sun stays awake, so the ball serves both in turn, and the key wants both; since v1.83, issue
 * #411, in its south-west corner the disc on its column of water, up to a landing and a door onto the gallery). Each holds
 * one of the two small keys the Seed Chamber's door takes.
 */
function wings(rt, K, M, { pot, pane }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, S = WING.shade, F = WING.frame, Z = WING.z, SR = ROOMS.shade, FR = ROOMS.frame;
  // ---- the Shade House
  K.corridor([SR.x1 + 0.6, Z], [ROOMS.potting.x0 - 0.6, Z], 0, { w: D.w, h: D.h });
  K.hall({ x: S.x, z: S.z, w: S.w, d: S.d, y: 0, h: SR.top, roof: true, doors: [{ side: 'e', at: 0, w: D.w, h: D.h }, { side: 'n', at: 0, w: D.w, h: D.h }] });   // (and north into the Seed Vault, v1.60)
  add(Door, { id: 'dW', at: [(SR.x1 + ROOMS.potting.x0) / 2, 0, Z], yaw: Math.PI / 2, w: D.w, h: D.h });   // (open: it shuts behind you while they stand)
  for (const [x, z, s] of [[-47, 29.6, 1.1], [-47.6, 52.2, 0.9], [-25, 52.6, 0.8], [-26, 29.4, 0.9], [-40, 29.2, 0.7], [-31, 53, 0.7], [-48, 37, 0.6]]) pot(x, 0, z, s, true);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.column(S.x + sx * 7, Z + sz * 7, 0, SR.top, 0.9);   // (four columns round the middle, to fight among)
  add(Key, { id: 'kW', at: [SR.x0 + 3, 0, Z], yaw: Math.PI / 2 });
  add(Mark, { room: 'shade', at: [SR.x1 - 4, 0, Z - 5], yaw: Math.PI / 2, foes: [S.x, 0, Z] });
  add(WaterGauge, { shows: 'sluice', room: 'shade', at: [SR.x1 - 2.4, 0, Z + 9] });

  // ---- the Cold Frame: the louvre over the middle, the groove down it, a tray of seedlings before each eye's post
  K.corridor([ROOMS.potting.x1 + 0.6, Z], [FR.x0 - 0.6, Z], 0, { w: D.w, h: D.h });
  add(Door, { id: 'dE', at: [(FR.x0 + ROOMS.potting.x1) / 2, 0, Z], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 's1' }] });   // (the eye over the benches opens it)
  K.hall({ x: F.x, z: F.z, w: F.w, d: F.d, y: 0, h: FR.top, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, w: D.w, h: D.h }, { side: 'w', at: FRAME_LIFT.door - F.z, w: D.w, h: D.h, y0: UP }] });
  const gx = F.x + 9, ex = F.x + 4, ez = 8;
  K.add(M.dark, box(1.0, 0.04, 11, gx, 0.02, F.z));
  add(Ball, { id: 'ballC', a: [gx, 0.04, F.z - 5], b: [gx, 0.04, F.z + 5], r: 1.0 });
  add(Plate, { id: 'pC1', at: [gx, 0, F.z + 5], r: 1.2 });
  add(Plate, { id: 'pC2', at: [gx, 0, F.z - 5], r: 1.2 });
  // (issue #477: a seed in the middle of each tray, under its louvre's spot; eyes on the posts woke in the sun until then)
  const shade = 'It sprouts, pale, and folds back into its husk. The tray is in the shade.';
  add(Seed, { id: 'sC1', at: [ex, 1.0, F.z + ez - 1.9], size: 0.8, seed: 5, shade });
  add(Seed, { id: 'sC2', at: [ex, 1.0, F.z - ez + 1.9], size: 0.8, seed: 6, shade });
  for (const sd of [1, -1]) {
    K.both(M.wallGlyph, box(3.2, 7, 1.0, ex, 3.5, F.z + sd * (ez + 0.5)));                 // the tray's post
    K.both(M.trim, box(3.6, 0.4, 1.4, ex, 7.2, F.z + sd * (ez + 0.5)));
    K.both(M.wall, box(5, 1.0, 1.6, ex, 0.5, F.z + sd * (ez - 1.9)));                      // the tray before it
    for (const i of [0, 2]) pot(ex - 1.6 + i * 1.6, 1.0, F.z + sd * (ez - 1.9), 0.3, true);
  }
  add(Sunbeam, { from: [F.x + 3, FR.top + 0.2, F.z], w: 3.0, spots: [
    { at: [ex, 1.02, F.z + ez - 1.9], r: 1.5, when: { drumOn: ['ballC', 'pC1'] } },
    { at: [ex, 1.02, F.z - ez + 1.9], r: 1.5, when: { drumOn: ['ballC', 'pC2'] } },
    { at: [F.x + 1, 0.02, F.z], r: 2.2 },
  ] });
  // (the rods from each plate along the floor to the east wall, and up it to the louvre)
  for (const sd of [1, -1]) { K.add(M.trim, box(FR.x1 - gx - 1.6, 0.06, 0.3, (gx + 1.4 + FR.x1 - 0.2) / 2, 0.03, F.z + sd * 5)); K.both(M.trim, box(0.3, FR.top, 0.3, FR.x1 - 0.2, FR.top / 2, F.z + sd * 5)); }
  pane(FR.x1 - 0.05, 12, F.z, 6, 5, -Math.PI / 2);
  add(Key, { id: 'kE', at: [ex - 6, 0, F.z], yaw: -Math.PI / 2 });
  add(Mark, { room: 'frame', at: [FR.x0 + 4, 0, F.z + 5], yaw: Math.PI / 2 });
  add(WaterGauge, { shows: 'sluice', room: 'frame', at: [FR.x0 + 2.6, 0, F.z + 11] });
  // (issue #411) the disc on its column of water in the south-west corner, up to the landing and its door onto the gallery
  const FL = FRAME_LIFT, [lx0, lz0, lx1, lz1] = FL.landing;
  K.slab(lx0, lz0, lx1, lz1, UP, 0.8);
  K.both(M.trim, box(0.4, GALLERY.parapet, lz1 - FL.z - FL.r - 0.6, lx1 - 0.2, UP + GALLERY.parapet / 2, (lz1 + FL.z + FL.r + 0.6) / 2));
  K.both(M.trim, box(lx1 - lx0, GALLERY.parapet, 0.4, (lx0 + lx1) / 2, UP + GALLERY.parapet / 2, lz1 - 0.2));
  K.add(M.dark, T(new THREE.CylinderGeometry(FL.r + 0.6, FL.r + 0.6, 0.06, 24), [FL.x, 0.03, FL.z]));   // (its cistern's mouth in the floor)
  K.both(M.trim, T(annulus(FL.r + 0.6, FL.r + 0.9, 0.12, 32), [FL.x, 0, FL.z]));
  add(WaterLift, { id: 'lift', path: [[FL.x, 0.3, FL.z], [FL.x, UP + 0.25, FL.z]], r: FL.r, speed: 2, pause: 2, when: LOW });
  K.chartNote({ kind: 'lift', id: 'lift', path: [[FL.x, 0.3, FL.z], [FL.x, UP + 0.25, FL.z]], r: FL.r });   // (the house's map: issue #405)
  K.corridor([FR.x0 - 0.6, FL.door], [ROOMS.potting.x1 + 0.6, FL.door], UP, { w: D.w, h: D.h });
}

/**
 * The Seed Vault: one louvre in its roof, one seed at the foot of a wall of glass too smooth to climb, the face of the
 * ledge out in the room. Since v1.83 (issue #411) the louvre is turned by a stone weight lying high on the ledge's lip,
 * over the glass and out of reach: the grappling hook pulls it down into your hands, and set on its plate it swings the
 * sun onto the seed; the seed grows only with the water let down into its channel. Grown, its vine climbs the glass to the
 * ledge: the great key, and a window in the Palm House's west wall, a drop back down to its floor.
 */
function vault(rt, K, M, { pot, pane }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, Vt = VAULT, VR = ROOMS.vault, Z = Vt.z, x0 = VR.x0, x1 = VR.x1, L = Vt.ledge, FX = Vt.face, WN = Vt.window;
  // its way in from the Shade House, north (the arena's second door, open once it is won)
  K.corridor([Vt.x, ROOMS.shade.z1 + 0.6], [Vt.x, VR.z0 - 0.6], 0, { w: D.w, h: D.h });
  add(Door, { id: 'dV', at: [Vt.x, 0, (ROOMS.shade.z1 + VR.z0) / 2], w: D.w, h: D.h, lamps: [{ lit: 'arW' }] });
  // and the window from the ledge east, through into the Palm House at the ledge's height (a drop to its floor)
  K.corridor([x1 + 0.6, Z], [ROOMS.potting.x0 - 0.6, Z], L, { w: WN.w, h: WN.h });
  K.hall({ x: Vt.x, z: Z, w: Vt.w, d: Vt.d, y: 0, h: Vt.h, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', at: 0, w: D.w, h: D.h }, { side: 'e', at: 0, w: WN.w, h: WN.h, y0: L }] });
  // the ledge on the east side, its face a wall of greenhouse glass out in the room; the vine grows up it from the seed
  K.both(M.wallGlyph, box(x1 - FX, L, Vt.d, (FX + x1) / 2, L / 2, Z));
  K.both(M.trim, box(x1 - FX + 0.2, 0.3, Vt.d, (FX + x1) / 2 - 0.1, L + 0.05, Z));
  // (the glass's face is where you meet it; held only once the vine is up it: the Glass piece slips you off it till then)
  K.climbable('the Seed Vault\'s glass: the vine up it, grown from its seed, to the great key', () => K.solid(box(0.36, L, Vt.d - 0.4, FX - 0.18, L / 2, Z)));
  add(Glass, { at: [FX - 0.05, 0, Z], yaw: -Math.PI / 2, w: Vt.d - 0.4, h: L, when: { lit: 'sdA' },
    slip: 'The glass is too smooth to hold. A vine could climb it, if anything grew at its foot.' });
  const [sx, sz] = Vt.seed;
  const W0 = { weightOn: ['wV', 'pVw'] };
  add(Seed, { id: 'sdA', at: [sx, 0, sz], size: 0.9, seed: 3, why: whyNot(rt, W0, LOW), shade: 'It sprouts, pale, and folds back into its husk. It is in the shade.', thirst: THIRST.low });
  add(Trough, { box: [sx - 2.8, sz - 6, sx - 2.0, sz + 6], y: 0, depth: 0.28, high: false });   // (its channel, wet only with the water let down)
  // the stone weight high on the ledge's lip, over the glass: the hook pulls it down; its plate on the floor, and the louvre
  // it turns
  const [wx, wy, wz] = Vt.weight, [px, , pz] = Vt.plate;
  add(Weight, { id: 'wV', at: [wx, wy, wz], yaw: Math.PI / 2, name: 'stone weight', fall: 14, zone: { min: [x0, -1, VR.z0], max: [x1, 14, VR.z1] },
    hint: 'Put a weight on this plate. One lies high on the ledge, over the glass.', back: 'The weight is back on the ledge.' });
  add(Plate, { id: 'pVw', at: [px, 0, pz], r: 1.3 });
  add(Sunbeam, { from: [Vt.x + 1, Vt.h + 0.4, Z], w: 3, spots: [
    { at: [sx, 0.62, sz], r: 1.9, when: W0 },
    { at: [Vt.x - 4, 0.02, Z - 5], r: 2.2 }] });
  // (the rod from the plate along the floor to the west wall, up it, and under the roof to the louvre)
  K.add(M.trim, box(px - 1.4 - x0 - 0.3, 0.06, 0.3, (px - 1.4 + x0 + 0.3) / 2, 0.03, pz)); K.both(M.trim, box(0.3, Vt.h - 0.4, 0.3, x0 + 0.3, (Vt.h - 0.4) / 2, pz)); K.add(M.trim, box(Vt.x + 1 - x0 - 0.3, 0.3, 0.3, (Vt.x + 1 + x0 + 0.3) / 2, Vt.h - 0.55, pz));
  for (const s of [-1, 1]) { pot(x0 + 1.8, 0, Z + s * 8, 0.7, true); pot(x0 + 6, 0, Z + s * 12.5, 0.6, true); }
  for (const s of [-1, 1]) pane(x1 - 0.05, 14, Z + s * 9, 6, 5, -Math.PI / 2);
  add(Key, { id: 'kB', big: true, at: [x1 - 1.6, L + 0.2, Z - 6], yaw: -Math.PI / 2 });   // (on the ledge's trim, its floor: issue #274)
  add(Mark, { room: 'vault', at: [x0 + 3, 0, Z - 6], yaw: Math.PI / 2 });
  add(WaterGauge, { shows: 'sluice', room: 'vault', at: [x0 + 2.6, 0, Z + 4] });
}

/**
 * (issue #411) The Palm House, the house's great hall (G4) where the Potting Hall and the Glass Stair were: 36 by 78.4 m,
 * its walls 28 m under a vault of greenhouse glass on white ribs; its floor the hub (the eye over the potting benches, the
 * wings west and east, the cistern under the drop, a sluice wheel), its gallery 18 m up round three sides on columns, open
 * over the floor (the north band's ball between two louvres, the Seed Chamber's door, the vine's seed, a sluice wheel).
 */
function palmHouse(rt, K, M, { pot, pane }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, PO = ROOMS.potting, PZ = (PO.z0 + PO.z1) / 2, PD = PO.z1 - PO.z0, GA = GALLERY, BR = GA.bridge, Y = UP;
  K.hall({ x: 0, z: PZ, w: PO.x1 - PO.x0, d: PD, y: 0, h: PO.top, roof: false, frieze: false, omit: ['s'], doors: [
    { side: 'n', w: D.w, h: D.h, y0: Y },
    { side: 'w', at: WING.z - PZ, w: D.w, h: D.h }, { side: 'e', at: WING.z - PZ, w: D.w, h: D.h },
    { side: 'e', at: FRAME_LIFT.door - PZ, w: D.w, h: D.h, y0: Y },
    { side: 'w', at: VAULT.z - PZ, w: VAULT.window.w, h: VAULT.window.h, y0: VAULT.ledge },
  ] });
  // its frieze high on the long walls, over the gallery (kept off the Cold Frame's high door)
  K.frieze([PO.x0 + 0.02, PO.z0 + 2], [PO.x0 + 0.02, PO.z1 - 2], Y + 11, 'e');
  K.frieze([PO.x1 - 0.02, FRAME_LIFT.door + 6], [PO.x1 - 0.02, PO.z1 - 2], Y + 11, 'w');
  // the vault of greenhouse glass on white ribs over it, closed at its ends (the Vine Gulf's)
  const vaultM = makeMaterial({ color: '#d6e6f4', glow: 0.22, flat: true, side: THREE.DoubleSide, key: 'temple.edena.vault' });
  const VR = PO.x1 + 0.6;
  K.both(vaultM, T(new THREE.CylinderGeometry(VR, VR, PD + 1.2, 32, 1, true, -Math.PI / 2, Math.PI), [0, PO.top, PZ], [-Math.PI / 2, 0, 0]));
  for (const z of [PO.z0 - 0.6, PO.z1 + 0.6]) K.add(vaultM, T(new THREE.CircleGeometry(VR, 32, 0, Math.PI), [0, PO.top, z]));
  for (let i = 0; i <= 12; i++) K.both(M.trim, T(new THREE.TorusGeometry(VR - 0.15, 0.22, 4, 32, Math.PI), [0, PO.top, PO.z0 + (i / 12) * PD], [0, 0, 0]));
  for (const a of [0.45, 0.9, 1.35]) for (const s of [-1, 1]) K.add(M.trim, T(new THREE.BoxGeometry(0.18, 0.18, PD + 0.6), [s * Math.cos(a) * (VR - 0.2), PO.top + Math.sin(a) * (VR - 0.2), PZ]));
  for (const z of [30, 54]) pane(PO.x0 + 0.05, 11, z, 4, 4, Math.PI / 2);

  // ---- the gallery: the north band wall to wall, the arms down the long walls on columns, and the bridge across the
  // middle between them; a parapet along their edges but where the east arm drops into the cistern and where the vine that
  // stays comes up its glass to the bridge
  K.slab(PO.x0, GA.n, PO.x1, PO.z1, Y, GA.t);
  K.slab(PO.x0, GA.s, GA.w, GA.n, Y, GA.t);
  K.slab(GA.e, GA.s, PO.x1, GA.n, Y, GA.t);
  K.slab(GA.w, BR.z0, GA.e, BR.z1, Y, GA.t);
  for (const x of [GA.w - 0.9, GA.e + 0.9]) for (let z = GA.s + 3; z < GA.n - 2; z += 10.5) K.column(x, z, 0, Y - GA.t, 0.7);
  for (const x of [-7, 7]) K.column(x, GA.n + 0.9, 0, Y - GA.t, 0.7);
  const rail = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az); if (L > 0.05) K.both(M.trim, box(0.4, GA.parapet, L, (ax + bx) / 2, Y + GA.parapet / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az))); };
  const VN = VINE, v0 = VN.x - VN.w / 2, v1 = VN.x + VN.w / 2;
  rail(GA.w + 0.2, GA.n - 0.2, GA.e - 0.2, GA.n - 0.2);
  rail(GA.w + 0.2, GA.s, GA.w + 0.2, BR.z0); rail(GA.w + 0.2, BR.z1, GA.w + 0.2, GA.n - 0.2);
  rail(GA.e - 0.2, GA.s, GA.e - 0.2, BR.z0); rail(GA.e - 0.2, BR.z1, GA.e - 0.2, GA.drop[0]); rail(GA.e - 0.2, GA.drop[1], GA.e - 0.2, GA.n - 0.2);
  rail(PO.x0 + 0.1, GA.s + 0.2, GA.w + 0.2, GA.s + 0.2); rail(GA.e - 0.2, GA.s + 0.2, PO.x1 - 0.1, GA.s + 0.2);
  rail(GA.w, BR.z0 + 0.2, GA.e, BR.z0 + 0.2);
  rail(GA.w, BR.z1 - 0.2, v0, BR.z1 - 0.2); rail(v1, BR.z1 - 0.2, GA.e, BR.z1 - 0.2);
  K.add(M.trim, box(0.5, 0.12, GA.drop[1] - GA.drop[0], GA.e + 0.25, Y + 0.06, (GA.drop[0] + GA.drop[1]) / 2));   // (a lip where it drops)
  // the cistern under the drop (G6): its water takes the fall
  add(Basin, { box: [BASIN.x0, BASIN.z0, BASIN.x1, BASIN.z1], y: 0, said: 'The cistern breaks your fall.' });
  // the vine that stays: a pier of glass under the bridge's north edge, too smooth to climb until the seed on the bridge
  // has grown its vine down it (then a climb back up for good); the seed in the bridge's trough, in the sun the bridge's
  // ball lets in on its west plate, and wet only with the water up
  K.both(M.wall, box(VN.w + 0.4, Y, VN.face - BR.z1 + 0.01, VN.x, Y / 2, (BR.z1 + VN.face) / 2));
  K.climbable('the Palm House\'s glass: the vine that stays, grown down from the bridge, a climb back up for good', () => K.solid(box(VN.w - 0.4, Y, 0.36, VN.x, Y / 2, VN.face + 0.18)));
  add(Glass, { at: [VN.x, 0, VN.face + 0.05], yaw: 0, w: VN.w - 0.4, h: Y, when: { lit: 'seedS' }, down: true,
    slip: 'The glass is too smooth to hold. Something would have to grow down it from the bridge first.' });
  const [vx, vy, vz] = VN.seed;
  const SL1 = { drumOn: ['ballL', 'pL1'] }, SL2 = { drumOn: ['ballL', 'pL2'] };
  add(Seed, { id: 'seedS', at: [vx, vy, vz], size: 0.9, seed: 4, why: whyNot(rt, SL1, HIGH), shade: 'It sprouts, pale, and folds back into its husk. It is in the shade.', thirst: THIRST.high });
  for (const [a, b] of [[vx - 6.2, vx - 2.2], [vx + 2.2, vx + 6.2]]) add(Trough, { box: [a, vz - 0.8, b, vz + 0.8], y: Y, depth: 0.3, high: true });
  // and the fall from the bridge's spout into the cistern below, running while the water is let down (seen from the whole hall)
  add(Fall, { at: [BASIN.x0 + 4.4, Y - GA.t, BASIN.z0 + 0.6], h: Y - GA.t - BASIN.water, w: 1.4, high: false });
  K.both(M.trim, box(1.8, 0.5, BASIN.z0 + 1 - BR.z1, BASIN.x0 + 4.4, Y - GA.t - 0.25, (BASIN.z0 + 1 + BR.z1) / 2));   // (its spout)
  // the bridge's ball: one ball, two plates, two louvres: east the eye on its post (the Seed Chamber's door wants it), west
  // the vine's seed
  const NZ = BR.z0 + 2;
  K.add(M.dark, box(14.6, 0.04, 1.0, 0, Y + 0.02, NZ));
  add(Ball, { id: 'ballL', a: [-7, Y + 0.04, NZ], b: [7, Y + 0.04, NZ], r: 1.1 });
  add(Plate, { id: 'pL1', at: [-7, Y, NZ], r: 1.3 });
  add(Plate, { id: 'pL2', at: [7, Y, NZ], r: 1.3 });
  K.both(M.wall, box(1.6, 4.4, 1.0, 5.4, Y + 2.2, BR.z1 - 1.1));   // the eye's post
  K.both(M.trim, box(2.0, 0.4, 1.4, 5.4, Y + 4.6, BR.z1 - 1.1));
  const s2 = [5.4, Y + 3, BR.z1 - 1.65];
  add(Switch, { id: 's2', at: s2, yaw: Math.PI, size: 1.0, wrong: 'The eye stays shut, in the shade.' });
  add(Sunbeam, { from: [5.4, PO.top - 0.4, BR.z0 - 1], w: 2.6, spots: [{ at: [s2[0], s2[1], s2[2] - 0.05], normal: [0, 0, -1], r: 1.5, when: SL2 }, { at: [2.6, Y + 0.02, BR.z0 + 4.2], r: 1.6 }] });
  add(Sunbeam, { from: [vx, PO.top - 0.4, vz - 2], w: 2.6, spots: [{ at: [vx, Y + 0.62, vz], r: 1.9, when: SL1 }, { at: [vx + 3.4, Y + 0.02, BR.z0 + 4.4], r: 1.6 }] });
  // (the rods from each plate up to its louvre under the vault)
  for (const [x, lx, lz] of [[-7.9, vx, vz - 2], [7.9, 5.4, BR.z0 - 1]]) {
    K.both(M.trim, box(0.3, PO.top - Y - 0.6, 0.3, x, (PO.top + Y - 0.6) / 2, NZ));
    K.add(M.trim, box(Math.abs(lx - x) + 0.3, 0.3, 0.3, (x + lx) / 2, PO.top - 0.75, NZ));
    K.add(M.trim, box(0.3, 0.3, Math.abs(lz - NZ) + 0.3, lx, PO.top - 0.75, (lz + NZ) / 2));
  }
  // the Seed Chamber's door: both small keys, and the eye on the bridge
  add(Door, { id: 'd1', at: [0, Y, PO.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 's2' }] });   // (and two keyholes: logic `lock`)
  add(Mark, { room: 'landing', at: [-4, Y, GA.n + 4.2], yaw: Math.PI });
  add(WaterGauge, { shows: 'sluice', room: 'landing', at: [-12.6, Y, PO.z1 - 1.6] });
  // a few great pots along the gallery, dead palms in them
  for (const [x, z] of [[-15.4, 30], [15.4, 44], [-15.4, 62], [15.4, 76], [13.6, PO.z1 - 2]]) pot(x, Y, z, 1.1, true);

  // ---- the floor (issue #477, the house reshaped: the gadget first): the makers' chest on its mound in the middle, in the
  // vault's sun, the house's first find; the potting benches east of it, dead seedlings in rows. (Until v1.85 a stone ball
  // down the west side turned a louvre onto an eye behind the benches, which opened the Cold Frame's door; the chest stood in
  // the Seed Chamber)
  K.both(M.trim, ...chestMound(CHEST[0], 0, CHEST[1]));
  add(Sunbeam, { from: [CHEST[0] - 1.4, PO.top - 0.4, CHEST[1] - 1.4], w: 2.6, spots: [{ at: [CHEST[0], 0.64, CHEST[1]], r: 2.0 }] });
  const EZ = 31;   // (the benches clear of the way east, at 41)
  for (const z of [EZ - 5.4, EZ, EZ + 5.4]) { K.both(M.wall, box(3.2, 1.1, 5.2, 7, 0.55, z)); for (let i = 0; i < 3; i++) pot(7, 1.1, z - 1.7 + i * 1.7, 0.35, true); }
  // the Cold Frame's door: a flower-door in the Palm House's east doorway, the vault's sun on it through a louvre over the
  // east arm. Bloom it: the first step a seed's, before any push
  add(Bud, { id: 'dE', bloom: 'bE', at: [PO.x1 + 0.9, 0, WING.z], yaw: Math.PI / 2, w: D.w, h: D.h,
    opened: 'The flower-door swells in the sun and splits, and its petals fold back against the wall. The Cold Frame is open.' });
  add(Sunbeam, { from: [PO.x1 - 6, PO.top - 0.4, WING.z], w: 3.0, spots: [{ at: [PO.x1 - 1.6, 0.02, WING.z], r: 2.2 }] });
  add(Mark, { room: 'potting', at: [-14, 0, 17], yaw: Math.PI / 2 });
  add(WaterGauge, { shows: 'sluice', room: 'potting', at: [10.4, 0, 49.2] });
  // the floor's low channel, from the cistern to the north band: wet only with the water let down
  add(Trough, { box: [4.6, BASIN.z1 + 0.6, 7.8, GA.n - 1], y: 0, depth: 0.28, high: false });
  // dead palms in great pots on the floor's north end, clear of the window's drop and the vine's foot
  for (const [x, z, s] of [[-3, 70, 1.5], [1.5, 80, 1.3], [-12, 20, 1.2], [13, 18, 1.1]]) pot(x, 0, z, s, true);
  // the sluice wheels by both hubs (the floor's and the gallery's), and the sluice that keeps the water
  add(Sluice, { id: 'sluice', at: SLUICE.wheels[0].at });
  for (const w of SLUICE.wheels) add(SluiceWheel, { ...w, id: `wheel.${w.room}`, sets: 'sluice' });
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR;
  const add = (P, o) => rt.add(P, o);
  const leaf = { paint: new THREE.Color('#7fcf72'), smooth: false, side: THREE.FrontSide };
  const leaf2 = { paint: new THREE.Color('#5f9a52'), smooth: false, side: THREE.FrontSide };
  const pink = { paint: new THREE.Color('#f2a7b8'), smooth: false, side: THREE.FrontSide };
  const glassM = makeMaterial({ color: GLASS, glow: 0.12, flat: true, key: 'temple.edena.glass' });
  /** A potted shrub: a white tub, a round head of leaves, a few flowers (dead: bare twigs). */
  const pot = (x, y, z, s = 1, dead = false) => {
    K.both(M.wall, lathe([[0.9 * s, 0], [1.1 * s, 1.0 * s], [1.2 * s, 1.1 * s], [0.01, 1.1 * s]], 12).translate(x, y, z));   // (solid as drawn: its rim was drawn over nothing, v1.77)
    if (dead) for (let i = 0; i < 4; i++) K.add({ paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide }, T(new THREE.CylinderGeometry(0.05, 0.08, 1.4 * s, 4), [x + Math.sin(i * 1.6) * 0.3, y + 1.6 * s, z + Math.cos(i * 1.6) * 0.3], [Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4]));
    else { K.add(leaf, T(new THREE.IcosahedronGeometry(1.1 * s, 1), [x, y + 1.9 * s, z])); for (let i = 0; i < 3; i++) K.add(pink, T(new THREE.SphereGeometry(0.2 * s, 6, 4), [x + Math.sin(i * 2.1) * 0.9 * s, y + 2.2 * s, z + Math.cos(i * 2.1) * 0.9 * s])); }
  };
  /** A pane of glass high on a wall (looking out on nothing: a pale green light). */
  const pane = (x, y, z, w, h, yaw) => { K.add(glassM, T(new THREE.PlaneGeometry(w, h), [x, y, z], [0, yaw, 0])); K.both(M.trim, T(new THREE.BoxGeometry(w + 0.3, 0.2, 0.2), [x, y + h / 2, z], [0, yaw, 0])); K.both(M.trim, T(new THREE.BoxGeometry(0.16, h, 0.16), [x, y, z], [0, yaw, 0])); };

  // ---- the Threshold (z 0..12)
  const TH = ROOMS.threshold;
  K.hall({ x: 0, z: 6, w: TH.x1 - TH.x0, d: 12, y: 0, h: TH.top, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));   // (thin, on the dark drawn in the doorway: nothing to climb in front of it)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  pot(6, 0, 9, 0.8, true); pot(-6, 0, 10, 0.7, true);
  add(Mark, { room: 'threshold', at: [-5.6, 0, 6], yaw: Math.PI / 2 });
  const PO = ROOMS.potting;
  K.wall(PO.x0 - 0.6, 12.6, PO.x1 + 0.6, 12.6, 0, PO.top, { t: 1.2, holes: [{ at: PO.x1 + 0.6, w: D.w, h: D.h }] });

  // ---- the Palm House and its wings
  palmHouse(rt, K, M, { pot, pane });
  wings(rt, K, M, { pot, pane });

  // ---- the corridor and the Seed Chamber (floor 18, a round hall 34 m across): (issue #477: the chest gone down to the Palm
  // House) its seed in the oculus's sun in the middle, in a trough wet only with the water up: bloomed, the north door sinks
  const SE = ROOMS.seed;
  K.corridor([0, PO.z1 + 0.6], [0, C3 - SE.r], UP, { w: D.w, h: D.h });
  K.rotunda({ x: 0, z: C3, y: UP, r: SE.r, h: SE.top - UP, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.4 });
  for (const [x, z] of [[-8, C3 - 5], [8, C3 - 5], [-8.6, C3 + 6], [8.6, C3 + 6], [-11.5, C3 - 0.5], [11.5, C3 + 0.5]]) pot(x, UP, z, 0.7, true);
  add(Seed, { id: 'seed0', at: [0, UP, C3], size: 1.0, seed: 2, why: whyNot(rt, null, HIGH), thirst: THIRST.high });
  for (const [a, b] of [[-3.4, -1.2], [1.2, 3.4]]) add(Trough, { box: [a, C3 - 0.8, b, C3 + 0.8], y: UP, depth: 0.3, high: true });
  add(Sunbeam, { from: [0, SE.top + 0.2, C3 - 1.4], w: 2.2, spots: [{ at: [0, UP + 0.02, C3], r: 2.0 }] });
  add(Mark, { room: 'seed', at: [8, UP, C3 - 8], yaw: -Math.PI * 0.75 });
  add(WaterGauge, { shows: 'sluice', room: 'seed', at: [9.5, UP, C3 - 11.5] });
  add(Door, { id: 'dS', at: [0, UP, C3 + SE.r + 0.7], w: D.w, h: D.h, lamps: [{ lit: 'seed0' }] });

  // ---- the Bud Passage (floor 18, a hall 30 m square), a room on: the door into the Vine Gulf is a bud in a sunbeam
  const BU = ROOMS.bud;
  K.slab(-4.2, C3 + SE.r - 0.4, 4.2, A0 + 0.6, UP, 0.8);
  K.hall({ x: 0, z: A0 + 15, w: BU.x1 - BU.x0, d: 30, y: UP, h: BU.top - UP, roof: 'oculus', oculus: 0.4, omit: ['n'], doors: [{ side: 's', w: D.w, h: D.h }] });
  pot(10, UP, A0 + 5, 0.7, true); pot(10.6, UP, A0 + 24, 0.6, true); pot(-11, UP, A0 + 5.4, 0.6, true);
  const SB = { drumOn: ['ballB', 'pB'] };
  add(Bud, { id: 'd3', bloom: 'bud1', at: [0, UP, G0 - 0.6], w: D.w, h: D.h, why: whyNot(rt, SB, HIGH), shade: 'The bud stirs, and stays shut: it is in the shade. Nothing grows in the shade.', thirst: 'The bud stirs, and stays shut. The trough at its foot is dry: the water is down below.' });
  add(Trough, { box: [-9, G0 - 2.6, -4.6, G0 - 1.8], y: UP, depth: 0.3, high: true });   // (the bud's trough, wet only with the water up)
  // (since v1.49 the louvre over the passage throws its beam on the floor by the pots until a ball's weight on its plate,
  // at the groove's north end west of the middle, turns it onto the bud: the bloom with the push)
  const B0 = A0 + 6.2, B1 = A0 + 13;   // (the groove 6.8 m, as it was; the ball over 20 m from the bud)
  K.add(M.dark, box(1.0, 0.04, B1 - B0 + 0.6, -5, UP + 0.02, (B0 + B1) / 2));
  add(Ball, { id: 'ballB', a: [-5, UP + 0.04, B0], b: [-5, UP + 0.04, B1], r: 1.0 });
  add(Plate, { id: 'pB', at: [-5, UP, B1], r: 1.2 });
  K.add(M.trim, box(8.4, 0.06, 0.3, -10.6, UP + 0.03, B1));                       // its rod along the floor to the west wall,
  K.both(M.trim, box(0.3, BU.top - UP - 0.4, 0.3, BU.x0 + 0.25, (BU.top + UP - 0.4) / 2, B1));   // up it,
  K.add(M.trim, box(14.75, 0.3, 0.3, BU.x0 / 2 + 0.1, BU.top - 0.25, B1));      // and over to the louvre
  add(Sunbeam, { from: [0, BU.top + 0.6, A0 + 15], w: 2.4, spots: [{ at: [0, UP + 0.02, G0 - 3.4], r: 2.4, when: SB }, { at: [4, UP + 0.02, A0 + 12], r: 2.2 }] });
  add(Mark, { room: 'bud', at: [8, UP, A0 + 6], yaw: -Math.PI / 2 });
  add(WaterGauge, { shows: 'sluice', room: 'bud', at: [-11.5, UP, A0 + 12] });

  // ---- the Vine Gulf (36 m across): from the near lip at 18 across a chasm (a seed grows the bridge); a glass wall up
  // to 27 (a seed grows a vine up it)
  const GU = ROOMS.gulf, GW = GU.x1 - GU.x0, GD = GU.z1 - GU.z0, LIP = G0 + GU.lip, FAR = G0 + GU.far, GL = G0 + GU.glass, HX = GU.x1;
  K.hall({ x: 0, z: G0 + GD / 2, w: GW, d: GD, y: GU.y, h: GU.top - GU.y, floor: false, roof: false, doors: [{ side: 's', w: D.w, h: D.h, y0: 24 }, { side: 'n', w: D.w, h: D.h, y0: 33 }] });
  // its roof a barrel vault of greenhouse glass on white ribs, the daylight through it (the picked hall)
  const vaultM = makeMaterial({ color: '#d6e6f4', glow: 0.22, flat: true, side: THREE.DoubleSide, key: 'temple.edena.vault' });
  const VR = HX + 0.2;
  K.both(vaultM, T(new THREE.CylinderGeometry(VR, VR, GD + 1.2, 32, 1, true, -Math.PI / 2, Math.PI), [0, GU.top, G0 + GD / 2], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i <= 12; i++) K.both(M.trim, T(new THREE.TorusGeometry(VR - 0.15, 0.22, 4, 32, Math.PI), [0, GU.top, G0 + i * 5], [0, 0, 0]));
  for (const a of [0.45, 0.9, 1.35]) for (const s of [-1, 1]) K.add(M.trim, T(new THREE.BoxGeometry(0.18, 0.18, GD + 0.6), [s * Math.cos(a) * (VR - 0.2), GU.top + Math.sin(a) * (VR - 0.2), G0 + GD / 2]));
  /** A square stone pot of the builders with a dead stick in it (the picked hall's). */
  const squarePot = (x, y, z, s = 1) => {
    K.both(M.wall, box(1.7 * s, 1.5 * s, 1.7 * s, x, y + 0.75 * s, z));
    K.add(M.trim, box(1.9 * s, 0.2 * s, 1.9 * s, x, y + 1.5 * s, z));
    for (let i = 0; i < 3; i++) K.add({ paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide }, T(new THREE.CylinderGeometry(0.05 * s, 0.11 * s, 3.2 * s, 4), [x + Math.sin(i * 2.1) * 0.25, y + 3.0 * s, z + Math.cos(i * 2.1) * 0.25], [Math.sin(i * 1.3) * 0.35, 0, Math.cos(i * 1.3) * 0.35]));
  };
  for (const s of [-1, 1]) { squarePot(s * 15.6, UP, G0 + 2.2); squarePot(s * 15.6, UP, LIP - 2.2); squarePot(s * 15.6, UP, FAR + 2.2); squarePot(s * 15.6, 27, GU.z1 - 2.4, 0.8); }
  K.slab(GU.x0, G0, GU.x1, LIP, UP, 24);
  K.slab(GU.x0, FAR, GU.x1, GU.z1, UP, 24);
  K.both(M.wallGlyph, box(GW, 9, GU.z1 - GL, 0, 22.5, (GL + GU.z1) / 2));          // the high ledge, its face the glass wall
  K.both(M.trim, box(GW + 0.2, 0.3, GU.z1 - GL + 0.2, 0, 27.05, (GL + GU.z1) / 2));
  // (the glass in its middle is where you meet it, and the only part of the face held: once its vine is up it, the
  // Glass piece slipping you off it till then; the panes either side are glass too, and no vine grows up them)
  K.climbable('the Vine Gulf\'s glass: the vine up it, from the seed-ball rooted in the sun, to the high ledge', () => K.solid(box(9, 9, 0.24, 0, 22.5, GL - 0.14)));
  K.both(M.dark, box(GW, 1, FAR - LIP, 0, -6.4, (LIP + FAR) / 2));
  for (let i = 0; i < 9; i++) K.add(i % 2 ? leaf : leaf2, T(new THREE.SphereGeometry(1.6 + (i % 3) * 0.5, 8, 6).scale(1, 0.5, 1), [-14 + i * 3.5, -5.6, LIP + 4 + (i % 3) * 6]));   // a jungle down there (drawn only: foliage, and solid it floors the gulf you are meant to bridge)
  add(Pit, { room: 'gulf', min: [GU.x0 - 1, -8, LIP], max: [GU.x1 + 1, 12, FAR] });
  const SS = { drumOn: ['sun', 'pS'] };
  add(Seed, { id: 'seed1', at: [-2.6, UP, LIP - 1.4], size: 0.9, seed: 1, why: whyNot(rt, SS, HIGH), shade: 'It sprouts, pale, reaching for light that isn’t there, and folds back into its husk. The sun falls past it, down into the dark.', thirst: THIRST.high });
  add(Trough, { box: [-7.2, LIP - 2.6, -4.8, LIP - 0.6], y: UP, depth: 0.3, high: true });
  add(Bridge, { id: 'vine1', a: [0, UP, LIP - 0.1], b: [0, UP, FAR + 0.1], w: 3.6, n: 10, from: 'grow' });
  // the great louvre in the vault: its beam falls into the green dark below until the sun-ball turns it onto the lip
  const SZ = LIP - 3.4;
  K.add(M.dark, box(6.4, 0.04, 1.0, 6.6, UP + 0.02, SZ));
  add(Ball, { id: 'sun', a: [3.6, UP + 0.04, SZ], b: [9.6, UP + 0.04, SZ], r: 1.1 });
  add(Plate, { id: 'pS', at: [9.6, UP, SZ], r: 1.3 });
  K.add(M.trim, box(HX - 11.2, 0.06, 0.3, (11 + HX - 0.2) / 2, UP + 0.03, SZ));      // its rod along the floor to the east wall,
  K.both(M.trim, box(0.3, 20, 0.3, HX - 0.2, 28, SZ));                          // and up it to the vault
  add(Sunbeam, { from: [0, GU.top + VR - 0.6, (LIP + FAR) / 2], w: 4.2, spots: [{ at: [-2.6, UP + 0.62, LIP - 1.6], r: 2.2, when: SS }, { at: [0, -5.6, (LIP + FAR) / 2], r: 4 }] });
  add(Glass, { at: [0, UP, GL - 0.05], yaw: Math.PI, w: 9, h: 9, when: { lit: 'seed2' } });
  for (const [x, w] of [[7, 4.5], [12, 4.5], [16.1, 3.4]]) for (const s of [-1, 1]) pane(s * x, 22.5, GL - 0.07, w, 8, Math.PI);   // (more glass either side: the vine grows only in the middle)
  // across: a fixed louvre throws the sun on the glass's foot; the seed-ball lies in the shade beside it, in its groove
  const BZ = GL - 1.6;
  K.add(M.dark, box(8, 0.04, 1.0, -6.2, UP + 0.02, BZ));
  add(Ball, { id: 'sb', a: [-9.8, UP + 0.04, BZ], b: [-2.4, UP + 0.04, BZ], r: 1.0, seed: { id: 'seed2', grew: 'The seed splits in the sun and roots, and a vine runs up out of it, up the glass, leaf over leaf.' } });
  add(Plate, { id: 'pG', at: [-2.4, UP, BZ], r: 1.2 });
  add(Sunbeam, { from: [-1.5, GU.top + VR - 0.8, BZ - 4], w: 2.6, spots: [{ at: [-2.4, UP + 0.02, BZ - 0.1], r: 1.9 }] });
  add(Bud, { id: 'd4', bloom: null, at: [0, 27, GU.z1], w: D.w, h: D.h, color: '#f2c6e0', dry: 'The bud only beads with it, high and dry over the glass. Nothing reaches it to grow from.' });
  for (const s of [-1, 1]) K.add(M.trim, T(new THREE.BoxGeometry(0.4, 5.6, 0.5), [s * 2.0, 27 + D.h + 2.1, GU.z1 - 0.25], [0, 0, s * 0.62]));   // its pointed arch
  add(Mark, { room: 'gulf', at: [-8, UP, G0 + 6], yaw: 0 });
  add(Mark, { room: 'gulfFar', at: [8, UP, FAR + 4], yaw: Math.PI });
  add(Mark, { room: 'gulfTop', at: [-6, 27, GL + 6], yaw: Math.PI / 2 });
  add(WaterGauge, { shows: 'sluice', room: 'gulf', at: [12.5, UP, G0 + 4] });
  add(WaterGauge, { shows: 'sluice', room: 'gulfFar', at: [-12.5, UP, FAR + 2.6] });

  // ---- the antechamber (a passage) and the Glasshouse (floor 27): four dead beds round the walls
  K.corridor([0, GU.z1 + 1.2], [0, CW - HR - 0.6], 27, { w: D.w, h: D.h });
  add(Mark, { room: 'ante', at: [D.w / 2 - 0.9, 27, (GU.z1 + 1.2 + CW - HR) / 2], yaw: -Math.PI / 2 });
  add(WaterGauge, { shows: 'sluice', room: 'ante', at: [-D.w / 2 + 0.9, 27, (GU.z1 + 1.2 + CW - HR) / 2 - 3], h: 2.2 });
  add(Door, { id: 'dB', at: [0, 27, CW - HR - 0.7], w: D.w, h: D.h });   // the great key's door (v1.49): its lock plate is its logic's
  K.rotunda({ x: 0, z: CW, y: 27, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.55 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.26; pane(Math.sin(a) * (HR - 0.05), 41, CW + Math.cos(a) * (HR - 0.05), 6, 8, a + Math.PI); }
  K.add({ paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide }, T(annulus(4, 7, 0.06, 48), [0, 27.06, CW]));   // bare earth where it stood
  let bedWaterM = null;
  rt.bedWater = [];
  for (const [i, a] of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75].entries()) {
    const x = Math.sin(a) * (HR - 3.4), z = CW + Math.cos(a) * (HR - 3.4);
    K.both(M.wall, lathe([[2.6, 0], [2.7, 0.9], [2.4, 1.0], [0.01, 1.0]], 18).translate(x, 27, z), new THREE.CylinderGeometry(2.6, 2.6, 0.9, 12).translate(x, 27.45, z));
    const seed = add(Seed, { id: BEDS[i], at: [x, 28, z], size: 1.5, seed: i, drink: 'The dead bed drinks the water, and stays dead. It is waiting to be told to grow.' });
    // (issue #562) the builders' water, back in the bed once the Gardener sleeps: it wells up round the bloom (edena onCalm)
    const wet = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 32), (bedWaterM ??= makeMaterial({ color: '#4f9fbf', glow: 0.25, flat: true, key: 'temple.edena.bedwater' })));   // (deeper than the troughs' water: it reads against the beds' white stone)
    wet.position.copy(K.world(x, 28.02, z)); wet.visible = false;
    wet.userData.noCollide = true; wet.userData.dynamic = true;
    rt.root.add(wet);
    (rt.bedWater ??= []).push({ center: K.world(x, 28, z), m: wet, seed, bloom: seed?.group });
    add(Plate, { id: FOOTSTONES[i], at: [Math.sin(a) * 12, 27, CW + Math.cos(a) * 12], r: 1.3 });
  }
  // the dome's louvre: the sun on one quarter at a time, the quarter whose footstone you last stood on
  let quarter = 2;
  const pick = () => { const i = FOOTSTONES.findIndex((id) => rt.logic.pressed(id)); if (i >= 0) quarter = i; return quarter; };
  rt.gardenSun = add(Sunbeam, { from: [0, 50.6, CW], w: 5, pick, spots: [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75].map((a) => ({ at: [Math.sin(a) * 8, 27.03, CW + Math.cos(a) * 8], r: SUN.r })) });
  add(Door, { id: 'd5', at: [0, 27, CW + HR + 0.7], w: D.w, h: D.h });
  // the way out behind its hall: a passage to the dark doorway
  const O0 = CW + HR + 1.4, O1 = O0 + 9;
  K.corridor([0, O0], [0, O1], 27, { w: D.w, h: D.h });
  K.wall(4.6, O1 + 0.4, -4.6, O1 + 0.4, 27, D.h, { t: 0.8, holes: [{ at: 4.6, w: 3.4, h: 5 }] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 27, O1 + 0.9]));
  K.solid(box(4, 5, 0.1, 0, 29.5, O1 + 0.9));

  const model = gardenerModel();
  model.pos.copy(K.world(0, 27, CW + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 27, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 27, CW), r: HR, y: K.world(0, 27, 0).y };

  // (the vault last: its mark after the others, as it was)
  vault(rt, K, M, { pot, pane });
  const W = (x, y, z) => K.world(x, y, z);
  const PZ = (PO.z0 + PO.z1) / 2;
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-54, -12, -3), V(54, 60, O1 + 2)),
    gadget: { at: W(CHEST[0], 0.62, CHEST[1]).toArray(), face: K.heading(Math.PI) },   // (issue #477: on the Palm House's floor)
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 27.5, O1 - 0.4), r: 1.5 }],
    lights: [[0, 7, 6, 14], [0, 9, 30, 26], [0, 9, 64, 26], [0, 26, PZ, 34], [WING.shade.x, 8, WING.z, 22], [WING.frame.x, 10, WING.z, 24], [0, 26, C3, 18], [0, 26, A0 + 15, 20], [0, 24, G0 + 27, 32], [0, 32, GL + 5, 20], [VAULT.x, 9, VAULT.z, 22], [0, 34, CW, 30]],
    guardian: { def: { ...GARDENER, onHit: gardenerHit, openFor: gardenerOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Greenhouse in the hollow
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 15;
  const base = level.ground.baseAt(SITE.x, SITE.z, SITE.r) - 0.6;
  const K = new TempleKit(rt.root, 'The Builders’ Greenhouse', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, sill = 2.4;
  const G = landmarkFrame(K, 'edena', sill);
  const glassM = glazing('#b3dfe5', G.world(0, sill + 20, 0));
  const ribs = { paint: new THREE.Color('#fbf8f0'), smooth: false, side: THREE.FrontSide };
  // a white plinth, a drum of the builders' gridded stone, a ribbed dome of glass on it
  G.both(M.floor, new THREE.CylinderGeometry(1, 1.04, sill, 48).scale(48,1,20).translate(0, sill / 2, 0));
  G.both(glassM, lathe([[45, sill], [43, sill + 8], [39, sill + 12]], 64).scale(1, 1, .33));
  for (let i = 0; i < 32; i++) {
    const a = i * TAU / 32;
    G.both(ribs, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      V(Math.sin(a) * 45, sill, Math.cos(a) * 45 * .33),
      V(Math.sin(a) * 43, sill + 8, Math.cos(a) * 43 * .33),
      V(Math.sin(a) * 39, sill + 12, Math.cos(a) * 39 * .33),
    ]), 12, .08, 4));
  }
  for (const [h,r] of [[4,44],[8,43]]) G.add(ribs,T(new THREE.TorusGeometry(r,.08,4,64),[0,sill+h,0],[Math.PI/2,0,0],[1,.33,1]));
  // Through the windows: planting benches and roof trusses at different depths.
  const earth = { paint: new THREE.Color('#705b48') }, leaf = { paint: new THREE.Color('#76936c'), smooth: true };
  const pots = ceramic('#bd7863');
  for (const side of [-1, 1]) for (let row = 0; row < 2; row++) {
    const z = row ? -6 : 5;
    G.add(ribs, box(30, 1, 4.2, side * 22, sill + .8, z));
    G.add(earth, box(29.5, .2, 3.7, side * 22, sill + 1.4, z));
    for (let i = 0; i < 6; i++) {
      const x = side * (10 + i * 4.7), h = 2.3 + (i % 3) * 1.3;
      G.add(pots, new THREE.CylinderGeometry(.85,.6,1.1,12).translate(x,sill+1.9,z));
      G.add(ribs, box(.1,h,.1,x,sill+2+h/2,z));
      for (let j = 0; j < 4; j++) G.add(leaf,T(new THREE.SphereGeometry(1,10,6),[x+Math.sin(j*2.4)*.65,sill+2+h-j*.7,z+Math.cos(j*2.4)*.5],[0,j*2.4,.35],[1.3,.28,.65]));
    }
  }
  for (const x of [-32,-20,20,32]) {
    G.add(ribs, box(.18,10,.18,x,sill+5,-7));
    G.add(ribs, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x,sill+9,-9),V(x,sill+11,0),V(x,sill+9,9)]),12,.1,5));
  }
  // The narrow entrance pier belongs to the broad glasshouse; its recess stays at the portal.
  // (the drawing's tall narrow door in the ivory pylon, framed twice, leaf-green light: src/temples/portal.js)
  const P = portal(K, { y: sill, z: R + .3, w: 3.4, h: 8.6, shape: 'rect', layers: 2, step: .7, recess: .5, back: 1.3, into: 1.5,
    frame: lmStone('#f4ecd9', { course: 3.8, width: 8, wear: .18 }), inlay: '#8be59a' });
  // dry creepers already on it (brown: the garden grows over everything, even this, but it has stopped)
  const twig = { paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.45) continue;
    const pts = []; for (let j = 0; j <= 8; j++) { const h = j * 1.2, r = R + 0.25 - Math.max(0, h - 7) * 0.12; pts.push(V(Math.sin(a + Math.sin(j) * 0.04) * r, sill + h, Math.cos(a + Math.sin(j) * 0.04) * r)); }
    K.both(twig, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.18, 4));
  }
  // the steps down to the meadow
  const foot = level.ground.heightAt(...(() => { const p = K.world(0, 0, R + 28); return [p.x, p.z]; })()) - base;
  K.stairs([0, sill, R + 3], [0, Math.max(0.2, foot), R + 28], 28, { rise: 0.24 });
  for(const sign of [-1,1]) K.ramp([sign*15.2,sill+.45,R+3],[sign*15.2,Math.max(.2,foot)+.45,R+28],1.6,{t:.6,mat:M.trim});
  // the sown beds in rows either side of the path, where nothing has come up: brown earth in white kerbs
  const soil = { paint: new THREE.Color('#8a5f3e'), smooth: false, side: THREE.FrontSide };
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) for(let row=0;row<3;row++) {
    const x = s * ((s>0?40:20) + i * 9), z = R + 10 + row*6;
    const w = K.world(x, 0, z), gy = level.ground.heightAt(w.x, w.z) - base;
    if (!Number.isFinite(gy)) continue;
    let low=gy, overlapsStair=false;
    for(const dx of [-3.7,0,3.7])for(const dz of [-2.8,0,2.8]){
      const p=K.world(x+dx,0,z+dz), q=toStair(p.x,p.z);
      low=Math.min(low,level.ground.heightAt(p.x,p.z)-base);
      overlapsStair ||= Math.abs(q.u)<STAIR.w/2+5 && q.s<STAIR.len+14 && q.s>0;
    }
    if(overlapsStair)continue;
    const bottom=low-.6, top=gy+.35;
    K.both(M.trim, box(7.4, top-bottom, 5.6, x, (top+bottom)/2, z));
    K.add(soil, box(6.8, .14, 5, x, top+.025, z));
    for (let j = 0; j < 2; j++) K.add(M.trim, box(.06,.6,.06,x+(j?1:-1),gy+.7,z));
  }
  const landmarkTop = landmark(K, 'edena', { y: sill, R, glass: glassM });
  K.flush();
  glaze(K, rt.veils, glassM, { color: '#74afbb', alpha: .28 });
  const at = K.world(0, sill, R + 1.4);
  // Sightline targets sit on the front of the enlarged glazing, not several
  // metres inside its solid shell (where the world's visibility audit cannot see).
  return { door: { at, heading: yaw, ...P.door }, kit: K, gardenFrame: G, base, R, sill, glassM, spire: { top: K.world(0, landmarkTop, 4.2), lantern: G.world(0, sill + 52, 4.2), height: 94 }, clear: [{ x: SITE.x, z: SITE.z, r: 70 }, { x: K.world(0, 0, R + 9).x, z: K.world(0, 0, R + 9).z, r: 32 }, { x: K.world(0, 0, R + 15).x, z: K.world(0, 0, R + 15).z, r: 45 }] };
}

// ------------------------------------------------------------------ the world change: the white ruins flower
/**
 * Once the Gardener sleeps, everything the white builders left grows over again: vines climb every slab of
 * the white ruins all over Viridel, flowers ring their feet and crown their tops, and the Greenhouse's dome
 * goes green with leaves and pink with blossom. One instanced pool of flowers, one of leaves, built from the
 * ruins the level made (level.edena.ruins).
 */
function change(scene, level, rt) {
  const root = new THREE.Group();
  root.name = 'Viridel in flower (the world change)';
  rt.root.add(root);
  root.visible = false;
  const slabs = level.edena?.ruins ?? [];
  const flowers = [], leaves = [];
  const _p = V(), _q = new THREE.Quaternion(), _s = V(), _m = new THREE.Matrix4(), UP = V(0, 1, 0);
  for (const [i, m] of slabs.entries()) {
    const g = m.geometry?.parameters ?? {}, w = g.width ?? 6, h = g.height ?? 20, d = g.depth ?? 3;
    m.updateMatrixWorld(true);
    // vines up two faces: leaf clusters climbing, flowers among them
    for (const side of [1, -1]) {
      const n = Math.max(4, Math.round(h / 2.0));
      for (let j = 0; j < n; j++) {
        const y = (j + 0.3) * (h / n) * 0.9, x = Math.sin(j * 1.3 + i) * w * 0.25;
        for (const dx of [-0.6, 0.6]) {
          _p.set(x + dx * (j % 2 ? 1 : 0.6), y + dx * 0.4, side * (d / 2 + 0.2)).applyMatrix4(m.matrixWorld);
          leaves.push({ at: _p.clone(), s: 0.9 + (j % 3) * 0.3, r: j * 0.7 + i + dx });
        }
        if (j % 2 === 0) { _p.set(x, y + 0.5, side * (d / 2 + 0.35)).applyMatrix4(m.matrixWorld); flowers.push({ at: _p.clone(), s: 1.5, c: (i + j) % 5 }); }
      }
    }
    // a ring of flowers at its foot, a crown on its top
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      _p.set(Math.sin(a) * (w / 2 + 1.2), 2.2, Math.cos(a) * (d / 2 + 1.2)).applyMatrix4(m.matrixWorld);
      const gy = level.ground?.heightAt?.(_p.x, _p.z);
      if (Number.isFinite(gy)) _p.y = gy + 0.1;
      flowers.push({ at: _p.clone(), s: 1.8, c: (i + k) % 5 });
    }
    for (let k = 0; k < 4; k++) { _p.set((k / 3 - 0.5) * w * 0.7, h + 0.2, 0).applyMatrix4(m.matrixWorld); flowers.push({ at: _p.clone(), s: 1.6, c: k % 5 }); leaves.push({ at: _p.clone().add(V(0, -0.3, 0)), s: 1.3, r: k }); }
  }
  // the long seed row down the meadow (src/viridel-ways.js, issue #131): every bed comes up, a line of leaves and a flower
  for (const [i, b] of (level.edena?.seedRow?.beds ?? []).entries()) {
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    for (let j = 0; j < 4; j++) { const u = -1.8 + j * 1.2; leaves.push({ at: V(b.at.x + fx * u, b.at.y + 0.1, b.at.z + fz * u), s: 0.85, r: i + j * 1.3 }); }
    flowers.push({ at: V(b.at.x + fx * 0.6, b.at.y + 0.5, b.at.z + fz * 0.6), s: 1.4, c: i % 5 });
    if (i % 2) flowers.push({ at: V(b.at.x - fx * 1.4, b.at.y + 0.45, b.at.z - fz * 1.4), s: 1.2, c: (i + 2) % 5 });
  }
  // the glasshouse: leaves and blossom around its panes and within its beds
  const O = rt.outside;
  if (O) {
    // New growth follows the low elliptical glazing and the beds inside it;
    // the old spherical dome's positions floated above the coral eave.
    for (let i = 0; i < 120; i++) {
      const a = i * 2.39996, h = .8 + (i % 7) * .65, r = 45.3 - h * .25;
      const p = O.gardenFrame.world(Math.sin(a) * r, O.sill + h, Math.cos(a) * r * .33);
      if (i % 3) leaves.push({ at: p, s: 1.1, r: i }); else flowers.push({ at: p, s: 1.3, c: i % 5 });
    }
    for (const side of [-1, 1]) for (let i = 0; i < 24; i++) {
      const p = O.gardenFrame.world(side * (9 + (i % 6) * 4.7), O.sill + 2.4 + (i % 3) * 1.3, i < 12 ? 5 : -6);
      leaves.push({at:p,s:2.1,r:i}); flowers.push({at:p.clone().add(V(0,.5,0)),s:1.3,c:i%5});
    }
  }
  const FL = ['#f2a7b8', '#f6d36a', '#ffffff', '#b7a0cf', '#ef7e62'].map((c) => new THREE.Color(c));
  // (cheap: five flat diamonds and a middle, 48 triangles a flower: there are a couple of thousand)
  const flowerGeo = mergeGeometries([0, 1, 2, 3, 4].map((k) => new THREE.OctahedronGeometry(0.22, 0).scale(1, 0.4, 0.6).rotateY(k / 5 * TAU).translate(Math.sin(k / 5 * TAU) * 0.22, 0, Math.cos(k / 5 * TAU) * 0.22)).concat([new THREE.OctahedronGeometry(0.12, 0).translate(0, 0.05, 0)]).map((q) => { q.deleteAttribute('uv'); return q; }));
  const leafGeo = new THREE.IcosahedronGeometry(0.6, 0).scale(1.2, 0.5, 0.9);
  leafGeo.deleteAttribute('uv');
  const fm = new THREE.InstancedMesh(flowerGeo, makeMaterial({ color: '#ffffff', flat: true, key: 'temple.edena.flowers' }), Math.max(1, flowers.length));
  const lm = new THREE.InstancedMesh(leafGeo, makeMaterial({ color: '#7fcf72', flat: true, key: 'temple.edena.leaves' }), Math.max(1, leaves.length));
  flowers.forEach((f, i) => { fm.setMatrixAt(i, _m.compose(f.at, _q.setFromAxisAngle(UP, i * 1.7), _s.setScalar(f.s))); fm.setColorAt(i, FL[f.c]); });
  leaves.forEach((f, i) => { lm.setMatrixAt(i, _m.compose(f.at, _q.setFromAxisAngle(UP, f.r), _s.setScalar(f.s))); });
  for (const im of [fm, lm]) { im.userData.noCollide = true; im.userData.dynamic = true; im.frustumCulled = false; root.add(im); }
  let k = 0, want = 0;
  // (they come up a few at a time: the instance counts grow with k)
  const apply = () => {
    root.visible = k > 0.01; fm.count = Math.round(k * flowers.length); lm.count = Math.round(Math.min(1, k * 1.3) * leaves.length);
    if (O) O.glassM.uniforms.uGlow.value = 0.12 + 0.08 * k;
  };
  return {
    root, count: { flowers: flowers.length, leaves: leaves.length, slabs: slabs.length, beds: level.edena?.seedRow?.beds.length ?? 0 },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt) {
      if (k === want) return;
      k = THREE.MathUtils.clamp(k + (want ? dt / 5 : -dt), 0, 1);
      apply();
    },
  };
}

export const EDENA_TEMPLE = {
  id: 'edena', levelId: 'edena', name: 'The Builders’ Greenhouse', doorLabel: 'door of the Builders’ Greenhouse',
  gadget: 'bloom', gadgetBox: 'edena.temple.bloom', arenaDoor: 'd4', arenas: ARENAS,
  origin: [300, 1700, -450], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  skin: machinedHouseSkin({ wall: [3.2, 2.8], plate: 2.4 }),   // (issue #691: its walls and floors in the makers' machined finish, skins/machined-plates.js)
  layout, exterior, change,
  local: { person: 'sorrel', out: 15, side: 6 },
  enterLine: 'Inside the Greenhouse it is warm and green-lit and smells of earth, and nothing grows. Every pot holds a dead stick.',
  pitLine: 'You climb back out of the green dark, to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, the white ruins all over the garden are flowering.', 'resolved.out'); },
  /** (issue #562) The Gardener asleep, the builders' water runs back into its four beds: it wells up round each bloom, out to the bed's lip (rt.calmK: its ending lets it in over its own panel). */
  onCalm(rt, k, dt, t) {
    for (const [i, b] of (rt.bedWater ?? []).entries()) {
      const e = Math.max(0, Math.min(1, k * 1.8 - i * 0.1)), r = 0.25 + 2.1 * e * (2 - e);   // (the beds in turn, the first well within the panel)
      b.m.visible = e > 0.01;
      b.m.scale.set(r, 1, r);
      b.m.position.y = b.center.y + 0.03 + 0.07 * e;
    }
  },
  onLit(rt, id) { if (BEDS.includes(id)) syncBeds(rt.guardian); },
  onWake(rt) { syncBeds(rt.guardian); },
};
