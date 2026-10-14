import { landmark, landmarkFrame } from './landmarks.js';
import { glazing, glaze, ceramic } from './landmark-materials.js';
import { toStair, STAIR } from '../viridel-stair.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Platform, Bridge, Seed, Bud, Glass, Sunbeam, Mark, Pit, Key } from './pieces.js';
import { gardenerModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';

// Viridel's temple: the Builders' Greenhouse, a round house of the white
// builders' clean stone under a great ribbed dome of glass, in the meadow
// hollow north of the white ruins (well clear of Esk's tea terraces, south-east
// of the landing). The builders grew their houses and their garden here, and
// left a gardener to keep it: a giant of moss, as old as the pyramids. The
// night the light passed, every flower on it closed and fell, and it has gone
// wild and bare since, and nothing in the Greenhouse grows.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: NOTHING GROWS IN THE
// SHADE (reworked from the temple design audit, v1.16). The builders' roof is a field of louvres; a stone ball's
// weight on a plate turns one, and a sunbeam swings down onto whatever it was turned for. The builders' eyes open
// only in the sun, their discs ride only in it, and a seed wakes to the bloom only where the light falls. Since v1.77
// (issue #336, docs/design/temple-redesign.md) its rooms are shrines: every hall 30 to 36 m across (the round halls 34)
// under 18 m of stone or more, doors 7 by 9 (ROOMS, DOOR), each puzzle in the middle of its own room, the one fight in
// the Shade House, the Bud Passage a room of its own.
//   the Threshold        the first mark, the way out
//   the Potting Hall     the hub (v1.48, issue #23). An eye behind the potting benches, in the shade: it will not wake. A
//                        stone ball rolled onto the plate at its groove's end turns the louvre over the benches, and the
//                        sunbeam swings off the floor onto the eye: splash it then (the push and the shot). Its door
//                        wants that eye and two small keys, one from each wing:
//   the Shade House      (west, an arena) dark, dead pots; its door shuts behind you while its keepers stand; won, its
//                        north door opens into the Seed Vault (v1.60)
//   the Cold Frame       (east) one louvre, one ball, two plates, an eye over each seed tray: the ball brings the sun to
//                        one, then the other (a woken eye stays awake), and the key wants both
//   the Glass Stair      one louvre, one ball, two places: on the west plate the sun falls on an eye on the
//                        landing's face (the landing's door wants it), on the east plate on the disc over the root-wall (it
//                        rides only in the sun). The eye stays open once woken; the disc does not ride in the shade
//   the Seed Chamber     the makers' chest: BLOOM MODE (src/items.js 'bloom', a new gun mode). Its way on is open;
//                        a seed in a stone ring lies in the oculus's sun by the dais: bloom it, and it flowers (a try)
//   the Bud Passage      a room on (its own since v1.77): the door into the Vine Gulf is a flower-door, in the shade
//                        since v1.49 (issue #23): a ball rolled onto its plate turns the passage's louvre onto it, and a bloom
//                        glob opens it (the gadget with the push, the house's first lesson; the chamber's seed taught it)
//   the Vine Gulf        the reference's hall: a chasm under a ribbed glass vault. The great louvre's beam falls
//                        into the green dark below; the seed at the near lip is in the shade (bloomed, it sprouts
//                        pale and folds back). The sun-ball on the near ledge turns the louvre: the beam swings up
//                        onto the lip, and the seed grows the vine bridge (bloom + push: the light brought to the
//                        seed). Across, a wall of greenhouse glass too smooth to climb, a sunbeam at its foot, and
//                        a seed-ball in the shade beside it: roll the seed into the light and bloom it there (bloom
//                        + push: the seed brought to the light). Its vine climbs the glass into the great bud at
//                        the top, and the bud opens round it
//   the Seed Vault       (v1.60, north off the Shade House, beside the Glass Stair: seen before the bloom; v1.49 off the
//                        gulf's far side) one louvre, one ball between two plates, two seeds at the foot of a wall of
//                        glass: the vine climbs it only from both, and the ball brings the sun to one, then the other
//                        (a seed grown in the sun stays grown). The great key on the ledge at the top, for the door past
//                        the bud into the Glasshouse, so the bloom comes back down for it; beside it a keepers' door,
//                        open with the vine, through onto the Glass Stair's root-wall by the disc: the way back up (a loop)
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

export const LOGIC = {
  id: 'edena', entry: 'threshold', gadget: 'bloom',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a fight;
  // src/foes.js places machines only in a fight's room, round its mark's `foes`: scripts/temple-design/rules.mjs,
  // tests/temple-rules.test.js. The Seed Chamber holds the bloom and its try; the Bud Passage past its open way is a room
  // of its own since v1.77, past the chamber's north door, which sinks for the bloom in hand: dS)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, potting: { checkpoint: true, kind: 'puzzle' }, shade: { checkpoint: true, kind: 'combat' }, frame: { checkpoint: true, kind: 'puzzle' },
    stair: { checkpoint: true, kind: 'puzzle' }, landing: { checkpoint: true, kind: 'passage' }, seed: { checkpoint: true, kind: 'puzzle' }, bud: { checkpoint: true, kind: 'puzzle' },
    gulf: { checkpoint: true, kind: 'puzzle' }, gulfFar: { checkpoint: true, kind: 'puzzle' }, vault: { checkpoint: true, kind: 'puzzle' }, vaultTop: { kind: 'passage' },
    ante: { kind: 'passage' }, hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'potting' },
    // the Potting Hall is the hub (v1.48): west the Shade House (an arena), east the Cold Frame; the Glass Stair's door
    // wants a small key from each, and the eye in the sun
    { a: 'potting', b: 'shade', door: 'dW' },          // (open: it shuts behind you while its keepers stand)
    { a: 'potting', b: 'frame' },
    { a: 'potting', b: 'stair', door: 'd1' },
    { a: 'stair', b: 'landing', door: 'lift' },        // the disc over the root-wall: it rides only in the sun
    { a: 'landing', b: 'seed', door: 'd2' },
    { a: 'seed', b: 'bud', door: 'dS' },               // the chamber's north door: it sinks for the bloom in your hand (v1.77)
    { a: 'bud', b: 'gulf', door: 'd3' },               // the Bud Passage's flower-door
    { a: 'gulf', b: 'gulfFar', door: 'vine1' },        // the vine bridge
    // the Seed Vault (v1.60, issue #23: north off the Shade House once it is won; v1.49 off the gulf's far side): the great
    // key up its glass, and from the top a keepers' door back onto the Glass Stair's root-wall, which opens with the vine
    { a: 'shade', b: 'vault', door: 'dV' },
    { a: 'vault', b: 'vaultTop', door: 'vineV' },      // up the vine both its seeds grow, on the glass
    { a: 'vaultTop', b: 'stair', door: 'dV2' },
    { a: 'gulfFar', b: 'ante', door: 'd4' },           // up the vine on the glass, into the bud it opens
    { a: 'ante', b: 'hall', door: 'dB' },              // the great key's door, past the bud
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the Potting Hall: the eye wakes only in the sun the ball's louvre lets in
    ball1: { type: 'drum', room: 'potting', plate: 'p1', plateAt: 1, start: 0 },
    p1: { type: 'plate', room: 'potting' },
    s1: { type: 'switch', room: 'potting', when: { drumOn: ['ball1', 'p1'] } },
    d1: { type: 'door', lock: 'small', keys: 2, opens: { lit: 's1' }, latch: true },
    // the Shade House: in the dark, its keepers beaten, the small key's cage sinks
    arW: { type: 'arena', room: 'shade' },
    kW: { type: 'key', kind: 'small', room: 'shade', when: { lit: 'arW' } },
    dW: { type: 'door', opens: null },
    dV: { type: 'door', opens: { lit: 'arW' }, latch: true },   // (won, its north door into the Seed Vault)
    // the Cold Frame: one louvre, one ball, two plates, an eye over each tray; woken in the sun, an eye stays awake
    // (the eyes before the ball: once one can wake, the marker points at it, not at the ball's other plate)
    sC1: { type: 'switch', room: 'frame', when: { drumOn: ['ballC', 'pC1'] } },
    sC2: { type: 'switch', room: 'frame', when: { drumOn: ['ballC', 'pC2'] } },
    ballC: { type: 'drum', room: 'frame', stops: { pC1: 1, pC2: 0 }, start: 0.5 },
    pC1: { type: 'plate', room: 'frame' }, pC2: { type: 'plate', room: 'frame' },
    kE: { type: 'key', kind: 'small', room: 'frame', when: { all: [{ lit: 'sC1' }, { lit: 'sC2' }] } },
    // the Glass Stair: one ball, two plates, one louvre: the eye (west) or the disc (east)
    s2: { type: 'switch', room: 'stair', when: { drumOn: ['ball2', 'pW'] } },   // (before its ball: the marker points at it once it can wake)
    ball2: { type: 'drum', room: 'stair', plate: 'pW', plateAt: 0, stops: { pW: 0, pE: 1 }, start: 0.5 },
    pW: { type: 'plate', room: 'stair' },
    pE: { type: 'plate', room: 'stair' },
    lift: { type: 'door', opens: { drumOn: ['ball2', 'pE'] } },
    d2: { type: 'door', opens: { lit: 's2' }, latch: true },
    chest: { type: 'gadget', room: 'seed', item: 'bloom' },
    seed0: { type: 'switch', room: 'seed', needs: ['bloom'] },     // the seed in the chamber's sun: a try, nothing waits on it
    dS: { type: 'door', opens: { item: 'bloom' }, latch: true },    // (into the Bud Passage, a room of its own since v1.77)
    // (since v1.49 the bud is in the shade until the passage's ball turns its louvre: the bloom with the push)
    ballB: { type: 'drum', room: 'bud', plate: 'pB', plateAt: 1, start: 0 },
    pB: { type: 'plate', room: 'bud' },
    bud1: { type: 'switch', room: 'bud', needs: ['bloom'], when: { drumOn: ['ballB', 'pB'] } },      // the passage's flower-door, in the sunbeam it turns
    d3: { type: 'door', opens: { lit: 'bud1' }, latch: true },
    // the Vine Gulf: the light brought to the seed, then the seed brought to the light
    sun: { type: 'drum', room: 'gulf', plate: 'pS', plateAt: 1, start: 0 },
    pS: { type: 'plate', room: 'gulf' },
    seed1: { type: 'switch', room: 'gulf', needs: ['bloom'], when: { drumOn: ['sun', 'pS'] } },
    vine1: { type: 'bridge', opens: { lit: 'seed1' }, latch: true },
    sb: { type: 'drum', room: 'gulfFar', plate: 'pG', plateAt: 1, start: 0.2 },   // (issue #275: it starts 1.5 m along its groove, off the wall it lay against: room behind it to push from)
    pG: { type: 'plate', room: 'gulfFar' },
    seed2: { type: 'switch', room: 'gulfFar', needs: ['bloom'], when: { drumOn: ['sb', 'pG'] } },
    d4: { type: 'door', opens: { lit: 'seed2' }, latch: true },      // (the arena's door too: it shuts behind you)
    // the Seed Vault (v1.60: off the first hub, seen before the bloom): one louvre, one ball, two seeds at the glass's foot;
    // the vine climbs it only from both, and the ball brings the sun to one, then the other (a seed bloomed in the sun stays
    // grown). The bud's far door wants its great key, so the bloom is carried back down to it. (After the gulf in this
    // list: the marker sends you through the gulf first, and back for the key)
    sdA: { type: 'switch', room: 'vault', needs: ['bloom'], when: { drumOn: ['ballV', 'pV1'] } },
    sdB: { type: 'switch', room: 'vault', needs: ['bloom'], when: { drumOn: ['ballV', 'pV2'] } },
    ballV: { type: 'drum', room: 'vault', stops: { pV1: 0, pV2: 1 }, start: 0.5 },
    pV1: { type: 'plate', room: 'vault' }, pV2: { type: 'plate', room: 'vault' },
    vineV: { type: 'bridge', opens: { all: [{ lit: 'sdA' }, { lit: 'sdB' }] }, latch: true },
    dV2: { type: 'door', opens: { open: 'vineV' }, latch: true },   // (the keepers' door at the top goes with the vine)
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
    gardener: { type: 'boss', room: 'hall', needs: ['gun', 'bloom'] },
    d5: { type: 'door', opens: { resolved: true } },
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
    { to: 0.4, attacks: ['sweep', 'stamp', 'clods'], pause: 1.7, hint: 'It tramples the dead beds round the walls. Bloom them.' },
    { to: 0.7, attacks: ['sweep', 'roots', 'stamp'], pause: 1.3, hint: 'When it kneels in the sun, bloom its back. Footstones turn the louvre.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'shot', moves: ['roots'], open: 4.6,
        hint: 'Splash it as it crouches to send its roots: it kneels to drink.',
        said: 'It drinks the water and kneels, heaving. Bloom its back.',
        lines: ['It crouches, its roots in the floor.', 'Splash water on it as it crouches for its roots: it kneels to drink.', 'Switch to the fluid and splash it while it crouches for its roots; then bloom its back as it kneels.'] } },
    { to: 0.9, attacks: ['crush', 'clods', 'sweep'], pause: 1.1, hint: 'Nothing grows on it in shade: turn the sun on it, then bloom it.' },
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

// ------------------------------------------------------------------ the rooms (v1.77, issue #336)
/**
 * The house's doors (m: 5 by 6.4 before, issue #336, docs/design/temple-redesign.md: rooms like shrines) and its rooms
 * in the kit's local frame (z into the house): each hall's floor from wall to wall, its floor's height and its
 * ceiling's; the round halls' middles and radii. The Vine Gulf's near lip, its far lip and the foot of its glass are m
 * from its south wall (`lip`, `far`, `glass`); the props, the chasm (22 m), the climbs (9 m) and every groove's length
 * as they were in the smaller house, so every timing holds.
 */
export const DOOR = { w: 7, h: 9 };
const C2 = 74.6, C3 = C2 + 37.2, A0 = C3 + 18.4, G0 = A0 + 31.2, HR = 20, CW = G0 + 69.8 + HR;
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 12, y: 0, top: 12 },
  potting: { x0: -18, x1: 18, z0: 13.2, z1: C2 - 20.2, y: 0, top: 18 },
  shade: { x0: -51, x1: -21, z0: 26, z1: 56, y: 0, top: 18 },
  frame: { x0: 21, x1: 51, z0: 26, z1: 56, y: 0, top: 18 },
  vault: { x0: -51, x1: -21, z0: C2 - 15, z1: C2 + 15, y: 0, top: 20 },
  stair: { x: 0, z: C2, r: 17, y: 0, top: 30 },
  seed: { x: 0, z: C3, r: 17, y: 18, top: 36 },
  bud: { x0: -15, x1: 15, z0: A0, z1: A0 + 30, y: 18, top: 36 },
  gulf: { x0: -18, x1: 18, z0: G0, z1: G0 + 60, y: -6, top: 38, lip: 16, far: 38, glass: 49.5 },
  hall: { x: 0, z: CW, r: HR, y: 27, top: 51 },
};
const mid = (R) => [(R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2];

// ------------------------------------------------------------------ the hub's wings (v1.48, issue #23)
/** The Potting Hall's wings (local m): the Shade House west (an arena), the Cold Frame east (two eyes, one ball, one louvre). */
export const WING = {
  z: 41,                                                   // both ways out of the Potting Hall, a little north of its middle
  shade: { x: mid(ROOMS.shade)[0], z: 41, w: 30, d: 30 },
  frame: { x: mid(ROOMS.frame)[0], z: 41, w: 30, d: 30 },
  zone: { min: [ROOMS.shade.x0, -1, ROOMS.shade.z0], max: [ROOMS.shade.x1, 12, ROOMS.shade.z1] },
};

/**
 * The Seed Vault (v1.60, issue #23: north off the Shade House, beside the Glass Stair; v1.49 it stood off the Vine Gulf's
 * far side), local m: the room round x, z (w by d, h high, its floor at 0); the ledge along its east side at `ledge`, its
 * west face (x `face`) a wall of glass out in the room (since v1.77: the seeds at its foot in the middle of the floor);
 * two seeds at the glass's foot (z); the ball's groove between their two plates; the keepers' door from the ledge east
 * through the Glass Stair's west wall at the root-wall's height onto a walk inside it to the root-wall's top
 * (`inner`: [x0, z0, x1, z1] slabs).
 */
export const VAULT = {
  x: -36, z: C2, w: 30, d: 30, h: 20, ledge: 9, face: -30.2, seeds: [C2 - 2.6, C2 + 2.6], groove: { x: -38.8, z: [C2 - 3.6, C2 + 3.8] },
  inner: [[-17.4, C2 - 3.5, -10, C2 + 3.5], [-14, C2 + 3.5, -10, C2 + 7]],
};

/** The Shade House's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark's `foes`). */
export const ARENAS = [{
  el: 'arW', room: 'shade', zone: WING.zone, doors: ['dW'], extra: 2,
  shut: 'The door grinds shut behind you. In the dark among the dead pots, something stirs.',
  won: 'The last of them falls still. The key’s cage sinks, the door lets go, and a second door opens in the north wall.',
}];

/**
 * The Shade House (west of the Potting Hall, the house's one fight: no louvre, only the dark; its door shuts behind you
 * while its keepers stand round its middle among four columns, and won, the small key's cage sinks and its north door
 * opens into the Seed Vault) and the Cold Frame (east: one louvre in its roof, one ball and two plates down the middle;
 * on the north plate the sun falls on the north tray's eye, on the south on the south's, each eye on a post behind its
 * tray. An eye woken in the sun stays awake, so the ball serves both in turn, and the key wants both). Each holds one of
 * the two small keys the Glass Stair's door takes.
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

  // ---- the Cold Frame: the louvre over the middle, the groove down it, a tray of seedlings before each eye's post
  K.corridor([ROOMS.potting.x1 + 0.6, Z], [FR.x0 - 0.6, Z], 0, { w: D.w, h: D.h });
  K.hall({ x: F.x, z: F.z, w: F.w, d: F.d, y: 0, h: FR.top, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, w: D.w, h: D.h }] });
  const gx = F.x + 3, ex = F.x - 4, ez = 8;
  K.add(M.dark, box(1.0, 0.04, 11, gx, 0.02, F.z));
  add(Ball, { id: 'ballC', a: [gx, 0.04, F.z - 5], b: [gx, 0.04, F.z + 5], r: 1.0 });
  add(Plate, { id: 'pC1', at: [gx, 0, F.z + 5], r: 1.2 });
  add(Plate, { id: 'pC2', at: [gx, 0, F.z - 5], r: 1.2 });
  const shade = 'The eye stays shut, in the shade.';
  add(Switch, { id: 'sC1', at: [ex, 4.6, F.z + ez - 0.15], yaw: Math.PI, size: 0.9, wrong: shade });
  add(Switch, { id: 'sC2', at: [ex, 4.6, F.z - ez + 0.15], yaw: 0, size: 0.9, wrong: shade });
  for (const sd of [1, -1]) {
    K.both(M.wallGlyph, box(3.2, 7, 1.0, ex, 3.5, F.z + sd * (ez + 0.5)));                 // the eye's post
    K.both(M.trim, box(3.6, 0.4, 1.4, ex, 7.2, F.z + sd * (ez + 0.5)));
    K.both(M.wall, box(5, 1.0, 1.6, ex, 0.5, F.z + sd * (ez - 1.9)));                      // the tray before it
    for (let i = 0; i < 3; i++) pot(ex - 1.6 + i * 1.6, 1.0, F.z + sd * (ez - 1.9), 0.3, true);
  }
  add(Sunbeam, { from: [F.x, FR.top + 0.2, F.z], w: 3.0, spots: [
    { at: [ex, 4.6, F.z + ez - 0.2], normal: [0, 0, -1], r: 1.5, when: { drumOn: ['ballC', 'pC1'] } },
    { at: [ex, 4.6, F.z - ez + 0.2], normal: [0, 0, 1], r: 1.5, when: { drumOn: ['ballC', 'pC2'] } },
    { at: [F.x - 1, 0.02, F.z], r: 2.2 },
  ] });
  // (the rods from each plate along the floor to the east wall, and up it to the louvre)
  for (const sd of [1, -1]) { K.add(M.trim, box(FR.x1 - gx - 1.6, 0.06, 0.3, (gx + 1.4 + FR.x1 - 0.2) / 2, 0.03, F.z + sd * 5)); K.both(M.trim, box(0.3, FR.top, 0.3, FR.x1 - 0.2, FR.top / 2, F.z + sd * 5)); }
  pane(FR.x1 - 0.05, 10, F.z, 6, 5, -Math.PI / 2);
  add(Key, { id: 'kE', at: [FR.x1 - 4, 0, F.z], yaw: -Math.PI / 2 });
  add(Mark, { room: 'frame', at: [FR.x0 + 4, 0, F.z + 5], yaw: Math.PI / 2 });
}

/**
 * The Seed Vault: one louvre in its roof, one ball between two plates, two seeds at the foot of a wall of glass too
 * smooth to climb, the face of the ledge out in the room; the vine climbs it only grown from both seeds, and the louvre's
 * beam falls on one seed or the other as the ball sits (a seed bloomed in the sun stays grown, as the Cold Frame's eyes
 * stay awake). The great key on the ledge at the top, and beside it the keepers' door through to the Glass Stair's
 * root-wall top: it opens with the vine, the way back up to the disc (v1.60).
 */
function vault(rt, K, M, { pot, pane }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, Vt = VAULT, VR = ROOMS.vault, Z = Vt.z, x0 = VR.x0, x1 = VR.x1, L = Vt.ledge, FX = Vt.face;
  // its way in from the Shade House, north (the arena's second door, open once it is won)
  K.corridor([Vt.x, ROOMS.shade.z1 + 0.6], [Vt.x, VR.z0 - 0.6], 0, { w: D.w, h: D.h });
  add(Door, { id: 'dV', at: [Vt.x, 0, (ROOMS.shade.z1 + VR.z0) / 2], w: D.w, h: D.h, lamps: [{ lit: 'arW' }] });
  // and the keepers' door from the ledge east, through to the Glass Stair at the root-wall's height
  K.corridor([x1 + 0.6, Z], [-ROOMS.stair.r - 0.2, Z], L, { w: D.w, h: D.h });
  add(Door, { id: 'dV2', at: [x1 + 1.9, L, Z], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 'sdA' }, { lit: 'sdB' }] });
  K.hall({ x: Vt.x, z: Z, w: Vt.w, d: Vt.d, y: 0, h: Vt.h, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', at: 0, w: D.w, h: D.h }, { side: 'e', at: 0, w: D.w, h: D.h, y0: L }] });
  // the ledge on the east side, its face a wall of greenhouse glass out in the room; the vine grows up it from both seeds
  K.both(M.wallGlyph, box(x1 - FX, L, Vt.d, (FX + x1) / 2, L / 2, Z));
  K.both(M.trim, box(x1 - FX + 0.2, 0.3, Vt.d, (FX + x1) / 2 - 0.1, L + 0.05, Z));
  // (the glass's face is where you meet it; held only once the vine is up it: the Glass piece slips you off it till then)
  K.climbable('the Seed Vault\'s glass: the vine up it, grown from both seeds, to the great key', () => K.solid(box(0.36, L, Vt.d - 0.4, FX - 0.18, L / 2, Z)));
  add(Glass, { at: [FX - 0.05, 0, Z], yaw: -Math.PI / 2, w: Vt.d - 0.4, h: L, when: { all: [{ lit: 'sdA' }, { lit: 'sdB' }] },
    slip: 'The glass is too smooth to hold. A vine could climb it, if anything grew at its foot.' });
  const [zA, zB] = Vt.seeds, sx = FX - 1.8;
  add(Seed, { id: 'sdA', at: [sx, 0, zA], size: 0.9, seed: 3, shade: 'It sprouts, pale, and folds back into its husk. It is in the shade.' });
  add(Seed, { id: 'sdB', at: [sx, 0, zB], size: 0.9, seed: 4, shade: 'It sprouts, pale, and folds back into its husk. It is in the shade.' });
  // the ball's groove, its two plates; the louvre in the roof throws the sun on one seed or the other, or on the floor
  const GX = Vt.groove.x, [Z0, Z1] = Vt.groove.z;
  K.add(M.dark, box(1.0, 0.04, Z1 - Z0 + 0.6, GX, 0.02, (Z0 + Z1) / 2));
  add(Ball, { id: 'ballV', a: [GX, 0.04, Z0], b: [GX, 0.04, Z1], r: 1.1 });
  add(Plate, { id: 'pV1', at: [GX, 0, Z0], r: 1.3 });
  add(Plate, { id: 'pV2', at: [GX, 0, Z1], r: 1.3 });
  add(Sunbeam, { from: [Vt.x + 1, Vt.h + 0.4, Z], w: 3, spots: [
    { at: [sx, 0.62, zA], r: 1.9, when: { drumOn: ['ballV', 'pV1'] } },
    { at: [sx, 0.62, zB], r: 1.9, when: { drumOn: ['ballV', 'pV2'] } },
    { at: [Vt.x - 4, 0.02, Z], r: 2.2 }] });
  for (const z of [Z0, Z1]) K.both(M.trim, box(0.3, Vt.h - 0.4, 0.3, GX - 0.9, (Vt.h - 0.4) / 2, z + (z === Z0 ? -1.5 : 1.5)));   // the rods up to the louvre
  for (const s of [-1, 1]) { pot(x0 + 1.8, 0, Z + s * 8, 0.7, true); pot(x0 + 6, 0, Z + s * 12.5, 0.6, true); }
  for (const s of [-1, 1]) pane(x1 - 0.05, 14, Z + s * 9, 6, 5, -Math.PI / 2);
  add(Key, { id: 'kB', big: true, at: [x1 - 1.6, L + 0.2, Z - 6], yaw: -Math.PI / 2 });   // (on the ledge's trim, its floor: issue #274)
  add(Mark, { room: 'vault', at: [x0 + 3, 0, Z - 6], yaw: Math.PI / 2 });
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
  const PO = ROOMS.potting, PZ = (PO.z0 + PO.z1) / 2, PD = PO.z1 - PO.z0;
  K.wall(PO.x0 - 0.6, 12.6, PO.x1 + 0.6, 12.6, 0, PO.top, { t: 1.2, holes: [{ at: PO.x1 + 0.6, w: D.w, h: D.h }] });

  // ---- the Potting Hall: a stone seed onto its plate down the middle, an eye on a pillar behind the benches
  // (the house's hub since v1.48: a way west into the Shade House and east into the Cold Frame)
  K.hall({ x: 0, z: PZ, w: PO.x1 - PO.x0, d: PD, y: 0, h: PO.top, roof: 'oculus', oculus: 0.3, omit: ['s'], doors: [{ side: 'n', w: D.w, h: D.h }, { side: 'w', at: WING.z - PZ, w: D.w, h: D.h }, { side: 'e', at: WING.z - PZ, w: D.w, h: D.h }] });
  const P0 = 22.5, P1 = 44;   // (the groove 21.5 m, as it was)
  K.add(M.dark, box(1.0, 0.04, P1 - P0 + 0.5, -6, 0.02, (P0 + P1) / 2));
  add(Ball, { id: 'ball1', a: [-6, 0.04, P0], b: [-6, 0.04, P1], r: 1.1 });
  add(Plate, { id: 'p1', at: [-6, 0, P1], r: 1.3 });
  // the potting benches east of the middle, dead seedlings in rows; the eye on the pillar behind them, over the benches
  const EZ = 27.5;   // (south of the way east: the benches clear of its door)
  for (const z of [EZ - 6.5, EZ, EZ + 6.5]) { K.both(M.wall, box(3.2, 1.1, 5.2, 7, 0.55, z)); for (let i = 0; i < 3; i++) pot(7, 1.1, z - 1.7 + i * 1.7, 0.35, true); }
  K.both(M.wallGlyph, box(1.6, 8, 2.6, 10.9, 4, EZ));
  K.both(M.trim, box(2.0, 0.4, 3.0, 10.9, 8.2, EZ));
  add(Switch, { id: 's1', at: [10.05, 4.6, EZ], yaw: -Math.PI / 2, size: 1.0, wrong: 'The eye stays shut. It is in the shade: the builders’ eyes open only to the sun.' });
  for (const z of [22, 38]) pane(PO.x0 + 0.05, 11, z, 4, 4, Math.PI / 2);
  // the louvre over the benches: the ball's weight on its plate turns it, by the brass rod up the north wall and over the
  // roof, and its sunbeam swings off the floor onto the eye
  add(Sunbeam, { from: [6.5, PO.top, EZ], w: 3.2, spots: [{ at: [10.0, 4.6, EZ], normal: [-1, 0, 0], r: 1.7, when: { drumOn: ['ball1', 'p1'] } }, { at: [1.5, 0.02, EZ - 2], r: 2.4 }] });
  K.add(M.trim, box(0.3, 0.06, PO.z1 - P1 - 1.6, -6, 0.03, (P1 + 1.4 + PO.z1 - 0.2) / 2));       // the rod: from the plate to the north wall,
  K.both(M.trim, box(0.3, PO.top - 0.4, 0.3, -6, (PO.top - 0.4) / 2, PO.z1 - 0.3));               // up it,
  K.add(M.trim, box(12.8, 0.3, 0.3, 0.25, PO.top - 0.25, PO.z1 - 0.3));                            // along under the roof,
  K.add(M.trim, box(0.3, 0.3, PO.z1 - 0.3 - EZ, 6.5, PO.top - 0.25, (PO.z1 - 0.3 + EZ) / 2));      // and over to the louvre
  add(Door, { id: 'd1', at: [0, 0, PO.z1 + 0.6], w: D.w, h: D.h, lamps: [{ drumOn: ['ball1', 'p1'] }, { lit: 's1' }] });   // (and two keyholes: logic `lock`)
  add(Mark, { room: 'potting', at: [-14, 0, 17], yaw: Math.PI / 2 });
  wings(rt, K, M, { pot, pane });

  // ---- the Glass Stair (a round hall 34 m across, floor 0): a root-wall to climb (its top at 9), a disc that rides up
  // past the landing's face to its top at 18
  const SR = ROOMS.stair.r;
  K.corridor([0, PO.z1 + 0.6], [0, C2 - SR], 0, { w: D.w, h: D.h });
  K.rotunda({ x: 0, z: C2, y: 0, r: SR, h: ROOMS.stair.top, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h, y0: 18 }, { a: -Math.PI / 2, w: D.w, h: D.h, y0: VAULT.ledge }], oculus: 0.4 });   // (and west at the root-wall's height, the Seed Vault's keepers' door, v1.60)
  // (the house's climbs: this, and the glass where a vine grows; its other walls are not climbed, issue #115)
  K.climbable('the Glass Stair\'s root-wall: from the floor to the disc that rides on up in the sun', () => K.both(M.wallGlyph, box(20, 9, 5.6, 0, 4.5, C2 + 5.8)));
  for (let i = 0; i < 9; i++) K.add(i % 2 ? leaf : leaf2, T(new THREE.CylinderGeometry(0.22, 0.3, 9.2, 5), [-9 + i * 2.25, 4.5, C2 + 2.95], [0, 0, Math.sin(i * 1.7) * 0.12]));   // roots down its face (drawn only: solid, they are a ladder up a wall you are not meant to climb yet)
  // the landing: a block of stone behind the root-wall, up to the north door at 18 (not climbed), the eye on its face
  K.both(M.wall, box(14, 18, 7.1, 0, 9, C2 + 11.85));
  K.slab(-4.2, C2 + 15.4, 4.2, C2 + SR + 0.4, 18, 0.6);
  // the disc rides only in the sun (lift); one ball, two plates, one louvre in the oculus: west, the sun on the eye on
  // the landing's face (the landing's door wants it); east, on the disc
  add(Platform, { id: 'lift', path: [[0, 9, C2 + 6], [0, 18, C2 + 6]], r: 2.2, speed: 1.5, pause: 2, when: { drumOn: ['ball2', 'pE'] } });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5; if (Math.abs(Math.cos(a)) < 0.5) continue; pane(Math.sin(a) * (SR - 0.05), 22, C2 + Math.cos(a) * (SR - 0.05), 3.5, 6, a + Math.PI); }
  K.add(M.dark, box(13.6, 0.04, 1.0, 0, 0.02, C2 - 3.5));
  add(Ball, { id: 'ball2', a: [-6.4, 0.04, C2 - 3.5], b: [6.4, 0.04, C2 - 3.5], r: 1.1 });
  add(Plate, { id: 'pW', at: [-6.4, 0, C2 - 3.5], r: 1.3 });
  add(Plate, { id: 'pE', at: [6.4, 0, C2 - 3.5], r: 1.3 });
  // (the eye on the landing's face, west of the disc: seen from the floor, passed on the way up)
  const s2 = [-4.5, 14.5, C2 + 8.25];
  add(Switch, { id: 's2', at: s2, yaw: Math.PI, size: 1.0, wrong: 'The eye stays shut, in the shade.' });
  add(Sunbeam, { from: [0, ROOMS.stair.top - 0.4, C2], w: 3.2, spots: [{ at: [s2[0], s2[1], s2[2] - 0.05], normal: [0, 0, -1], r: 1.6, when: { drumOn: ['ball2', 'pW'] } }, { at: [0, 9.04, C2 + 6], r: 2.4, when: { drumOn: ['ball2', 'pE'] } }] });
  // the rods from each plate along the floor to the wall, and up it to the louvre's ring
  for (const s of [-1, 1]) { K.add(M.trim, box(8.6, 0.06, 0.3, s * 11.8, 0.03, C2 - 5)); K.add(M.trim, T(new THREE.CylinderGeometry(0.14, 0.14, ROOMS.stair.top, 5), [s * 16.1, ROOMS.stair.top / 2, C2 - 5])); }
  add(Mark, { room: 'stair', at: [-8, 0, C2 - 10], yaw: Math.PI * 0.75 });
  // (v1.60) from the root-wall's top a walk west to the Seed Vault's keepers' door
  for (const [lx0, lz0, lx1, lz1] of VAULT.inner) K.slab(lx0, lz0, lx1, lz1, VAULT.ledge, 0.6);
  add(Mark, { room: 'landing', at: [2.4, 18, C2 + 12], yaw: -Math.PI / 2 });

  // ---- the corridor and the Seed Chamber (floor 18, a round hall 34 m across): the chest; the way on is a bud
  K.corridor([0, C2 + SR + 0.4], [0, C3 - ROOMS.seed.r], 18, { w: D.w, h: D.h });
  add(Door, { id: 'd2', at: [0, 18, C2 + SR + 1.6], w: D.w, h: D.h, lamps: [{ lit: 's2' }] });
  const SE = ROOMS.seed;
  K.rotunda({ x: 0, z: C3, y: 18, r: SE.r, h: SE.top - 18, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.4 });
  K.both(M.trim, ...chestMound(0, 18, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  for (const [x, z] of [[-8, C3 - 5], [8, C3 - 5], [-8.6, C3 + 6], [8.6, C3 + 6], [-11.5, C3 - 0.5], [11.5, C3 + 0.5]]) pot(x, 18, z, 0.7, true);
  // a seed in a stone ring, in the oculus's sun beside the dais: bloom it and it flowers (a try: nothing waits on it)
  add(Seed, { id: 'seed0', at: [-4.2, 18, C3 + 4.2], size: 0.8, seed: 2 });
  add(Sunbeam, { from: [-1.4, SE.top + 0.2, C3 + 1.4], w: 2.2, spots: [{ at: [-4.2, 18.02, C3 + 4.2], r: 2.0 }] });
  add(Mark, { room: 'seed', at: [8, 18, C3 - 8], yaw: -Math.PI * 0.75 });
  add(Door, { id: 'dS', at: [0, 18, C3 + SE.r + 0.7], w: D.w, h: D.h, lamps: [{ item: 'bloom' }] });   // (the bloom in hand)

  // ---- the Bud Passage (floor 18, a hall 30 m square), a room on: the door into the Vine Gulf is a bud in a sunbeam
  const BU = ROOMS.bud;
  K.slab(-4.2, C3 + SE.r - 0.4, 4.2, A0 + 0.6, 18, 0.8);
  K.hall({ x: 0, z: A0 + 15, w: BU.x1 - BU.x0, d: 30, y: 18, h: BU.top - 18, roof: 'oculus', oculus: 0.4, omit: ['n'], doors: [{ side: 's', w: D.w, h: D.h }] });
  pot(10, 18, A0 + 5, 0.7, true); pot(10.6, 18, A0 + 24, 0.6, true); pot(-11, 18, A0 + 5.4, 0.6, true);
  add(Bud, { id: 'd3', bloom: 'bud1', at: [0, 18, G0 - 0.6], w: D.w, h: D.h, shade: 'The bud stirs, and stays shut: it is in the shade. Nothing grows in the shade.' });
  // (since v1.49 the louvre over the passage throws its beam on the floor by the pots until a ball's weight on its plate,
  // at the groove's north end west of the middle, turns it onto the bud: the bloom with the push)
  const B0 = A0 + 6.2, B1 = A0 + 13;   // (the groove 6.8 m, as it was; the ball over 20 m from the bud)
  K.add(M.dark, box(1.0, 0.04, B1 - B0 + 0.6, -5, 18.02, (B0 + B1) / 2));
  add(Ball, { id: 'ballB', a: [-5, 18.04, B0], b: [-5, 18.04, B1], r: 1.0 });
  add(Plate, { id: 'pB', at: [-5, 18, B1], r: 1.2 });
  K.add(M.trim, box(8.4, 0.06, 0.3, -10.6, 18.03, B1));                       // its rod along the floor to the west wall,
  K.both(M.trim, box(0.3, BU.top - 18.4, 0.3, BU.x0 + 0.25, (BU.top + 17.6) / 2, B1));   // up it,
  K.add(M.trim, box(14.75, 0.3, 0.3, BU.x0 / 2 + 0.1, BU.top - 0.25, B1));      // and over to the louvre
  add(Sunbeam, { from: [0, BU.top + 0.6, A0 + 15], w: 2.4, spots: [{ at: [0, 18.02, G0 - 3.4], r: 2.4, when: { drumOn: ['ballB', 'pB'] } }, { at: [4, 18.02, A0 + 12], r: 2.2 }] });
  add(Mark, { room: 'bud', at: [8, 18, A0 + 6], yaw: -Math.PI / 2 });

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
  for (const s of [-1, 1]) { squarePot(s * 15.6, 18, G0 + 2.2); squarePot(s * 15.6, 18, LIP - 2.2); squarePot(s * 15.6, 18, FAR + 2.2); squarePot(s * 15.6, 27, GU.z1 - 2.4, 0.8); }
  K.slab(GU.x0, G0, GU.x1, LIP, 18, 24);
  K.slab(GU.x0, FAR, GU.x1, GU.z1, 18, 24);
  K.both(M.wallGlyph, box(GW, 9, GU.z1 - GL, 0, 22.5, (GL + GU.z1) / 2));          // the high ledge, its face the glass wall
  K.both(M.trim, box(GW + 0.2, 0.3, GU.z1 - GL + 0.2, 0, 27.05, (GL + GU.z1) / 2));
  // (the glass in its middle is where you meet it, and the only part of the face held: once its vine is up it, the
  // Glass piece slipping you off it till then; the panes either side are glass too, and no vine grows up them)
  K.climbable('the Vine Gulf\'s glass: the vine up it, from the seed-ball rooted in the sun, to the high ledge', () => K.solid(box(9, 9, 0.24, 0, 22.5, GL - 0.14)));
  K.both(M.dark, box(GW, 1, FAR - LIP, 0, -6.4, (LIP + FAR) / 2));
  for (let i = 0; i < 9; i++) K.add(i % 2 ? leaf : leaf2, T(new THREE.SphereGeometry(1.6 + (i % 3) * 0.5, 8, 6).scale(1, 0.5, 1), [-14 + i * 3.5, -5.6, LIP + 4 + (i % 3) * 6]));   // a jungle down there (drawn only: foliage, and solid it floors the gulf you are meant to bridge)
  add(Pit, { room: 'gulf', min: [GU.x0 - 1, -8, LIP], max: [GU.x1 + 1, 12, FAR] });
  add(Seed, { id: 'seed1', at: [-2.6, 18, LIP - 1.4], size: 0.9, seed: 1, shade: 'It sprouts, pale, reaching for light that isn’t there, and folds back into its husk. The sun falls past it, down into the dark.' });
  add(Bridge, { id: 'vine1', a: [0, 18, LIP - 0.1], b: [0, 18, FAR + 0.1], w: 3.6, n: 10, from: 'grow' });
  // the great louvre in the vault: its beam falls into the green dark below until the sun-ball turns it onto the lip
  const SZ = LIP - 3.4;
  K.add(M.dark, box(6.4, 0.04, 1.0, 6.6, 18.02, SZ));
  add(Ball, { id: 'sun', a: [3.6, 18.04, SZ], b: [9.6, 18.04, SZ], r: 1.1 });
  add(Plate, { id: 'pS', at: [9.6, 18, SZ], r: 1.3 });
  K.add(M.trim, box(HX - 11.2, 0.06, 0.3, (11 + HX - 0.2) / 2, 18.03, SZ));      // its rod along the floor to the east wall,
  K.both(M.trim, box(0.3, 20, 0.3, HX - 0.2, 28, SZ));                          // and up it to the vault
  add(Sunbeam, { from: [0, GU.top + VR - 0.6, (LIP + FAR) / 2], w: 4.2, spots: [{ at: [-2.6, 18.62, LIP - 1.6], r: 2.2, when: { drumOn: ['sun', 'pS'] } }, { at: [0, -5.6, (LIP + FAR) / 2], r: 4 }] });
  add(Glass, { at: [0, 18, GL - 0.05], yaw: Math.PI, w: 9, h: 9, when: { lit: 'seed2' } });
  for (const [x, w] of [[7, 4.5], [12, 4.5], [16.1, 3.4]]) for (const s of [-1, 1]) pane(s * x, 22.5, GL - 0.07, w, 8, Math.PI);   // (more glass either side: the vine grows only in the middle)
  // across: a fixed louvre throws the sun on the glass's foot; the seed-ball lies in the shade beside it, in its groove
  const BZ = GL - 1.6;
  K.add(M.dark, box(8, 0.04, 1.0, -6.2, 18.02, BZ));
  add(Ball, { id: 'sb', a: [-9.8, 18.04, BZ], b: [-2.4, 18.04, BZ], r: 1.0, seed: { id: 'seed2', grew: 'The seed splits in the sun and roots, and a vine runs up out of it, up the glass, leaf over leaf.' } });
  add(Plate, { id: 'pG', at: [-2.4, 18, BZ], r: 1.2 });
  add(Sunbeam, { from: [-1.5, GU.top + VR - 0.8, BZ - 4], w: 2.6, spots: [{ at: [-2.4, 18.02, BZ - 0.1], r: 1.9 }] });
  add(Bud, { id: 'd4', bloom: null, at: [0, 27, GU.z1], w: D.w, h: D.h, color: '#f2c6e0', dry: 'The bud only beads with it, high and dry over the glass. Nothing reaches it to grow from.' });
  for (const s of [-1, 1]) K.add(M.trim, T(new THREE.BoxGeometry(0.4, 5.6, 0.5), [s * 2.0, 27 + D.h + 2.1, GU.z1 - 0.25], [0, 0, s * 0.62]));   // its pointed arch
  add(Mark, { room: 'gulf', at: [-8, 18, G0 + 6], yaw: 0 });
  add(Mark, { room: 'gulfFar', at: [8, 18, FAR + 4], yaw: Math.PI });
  add(Mark, { room: 'gulfTop', at: [-6, 27, GL + 6], yaw: Math.PI / 2 });

  // ---- the antechamber (a passage) and the Glasshouse (floor 27): four dead beds round the walls
  K.corridor([0, GU.z1 + 1.2], [0, CW - HR - 0.6], 27, { w: D.w, h: D.h });
  add(Mark, { room: 'ante', at: [D.w / 2 - 0.9, 27, (GU.z1 + 1.2 + CW - HR) / 2], yaw: -Math.PI / 2 });
  add(Door, { id: 'dB', at: [0, 27, CW - HR - 0.7], w: D.w, h: D.h });   // the great key's door (v1.49): its lock plate is its logic's
  K.rotunda({ x: 0, z: CW, y: 27, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.55 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.26; pane(Math.sin(a) * (HR - 0.05), 41, CW + Math.cos(a) * (HR - 0.05), 6, 8, a + Math.PI); }
  K.add({ paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide }, T(annulus(4, 7, 0.06, 48), [0, 27.06, CW]));   // bare earth where it stood
  for (const [i, a] of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75].entries()) {
    const x = Math.sin(a) * (HR - 3.4), z = CW + Math.cos(a) * (HR - 3.4);
    K.both(M.wall, lathe([[2.6, 0], [2.7, 0.9], [2.4, 1.0], [0.01, 1.0]], 18).translate(x, 27, z), new THREE.CylinderGeometry(2.6, 2.6, 0.9, 12).translate(x, 27.45, z));
    add(Seed, { id: BEDS[i], at: [x, 28, z], size: 1.5, seed: i, drink: 'The dead bed drinks the water, and stays dead. It is waiting to be told to grow.' });
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
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-54, -12, -3), V(54, 60, O1 + 2)),
    gadget: { at: W(0, 18.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 27.5, O1 - 0.4), r: 1.5 }],
    lights: [[0, 7, 6, 14], [0, 9, PZ, 26], [WING.shade.x, 8, WING.z, 22], [WING.frame.x, 8, WING.z, 22], [0, 12, C2, 22], [0, 26, C3, 18], [0, 26, A0 + 15, 20], [0, 24, G0 + 27, 32], [0, 32, GL + 5, 20], [VAULT.x, 9, VAULT.z, 22], [0, 34, CW, 30]],
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
  const recess = new THREE.Shape(); recess.moveTo(-2.2,0); recess.lineTo(-2.2,6.8);
  recess.quadraticCurveTo(0,11.2,2.2,6.8); recess.lineTo(2.2,0); recess.closePath();
  K.add(M.voidM, new THREE.ShapeGeometry(recess).translate(0,sill,R+.3));
  K.solid(box(4.4,6.8,.1,0,sill+3.4,R+.3));
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
  return { door: { at, heading: yaw }, kit: K, gardenFrame: G, base, R, sill, glassM, spire: { top: K.world(0, landmarkTop, 4.2), lantern: G.world(0, sill + 52, 4.2), height: 94 }, clear: [{ x: SITE.x, z: SITE.z, r: 70 }, { x: K.world(0, 0, R + 9).x, z: K.world(0, 0, R + 9).z, r: 32 }, { x: K.world(0, 0, R + 15).x, z: K.world(0, 0, R + 15).z, r: 45 }] };
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
  layout, exterior, change,
  local: { person: 'sorrel', out: 15, side: 6 },
  enterLine: 'Inside the Greenhouse it is warm and green-lit and smells of earth, and nothing grows. Every pot holds a dead stick.',
  pitLine: 'You climb back out of the green dark, to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, the white ruins all over the garden are flowering.', 'resolved.out'); },
  onLit(rt, id) { if (BEDS.includes(id)) syncBeds(rt.guardian); },
  onWake(rt) { syncBeds(rt.guardian); },
};
