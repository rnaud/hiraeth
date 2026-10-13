import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
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
// only in the sun, their discs ride only in it, and a seed wakes to the bloom only where the light falls.
//   the Threshold        the first mark, the way out
//   the Potting Hall     the hub (v1.48, issue #23). An eye behind the potting benches, in the shade: it will not wake. A
//                        stone ball rolled onto the plate at its groove's end turns the louvre over the benches, and the
//                        sunbeam swings off the floor onto the eye: splash it then (the push and the shot). Its door
//                        wants that eye and two small keys, one from each wing:
//   the Shade House      (west, an arena) dark, dead pots; its door shuts behind you while its keepers stand; won, its
//                        north door opens into the Seed Vault (v1.60)
//   the Cold Frame       (east) one louvre, one ball, two plates, an eye over each seed tray: the ball brings the sun to
//                        one, then the other (a woken eye stays awake), and the key wants both
//   the Glass Stair      one louvre, one ball, two places: on the west plate the sun falls on an eye high on the
//                        wall (the landing's door wants it), on the east plate on the disc over the root-wall (it
//                        rides only in the sun). The eye stays open once woken; the disc does not ride in the shade
//   the Seed Chamber     the makers' chest: BLOOM MODE (src/items.js 'bloom', a new gun mode). Its way on is open;
//                        a seed in a stone ring lies in the oculus's sun by the dais: bloom it, and it flowers (a try)
//   the Bud Passage      a room on: the door into the Vine Gulf is a flower-door, in the shade since v1.49 (issue #23):
//                        a ball rolled onto the plate by the west wall turns the passage's louvre onto it, and a bloom
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
  rooms: { threshold: { checkpoint: true }, potting: { checkpoint: true }, shade: { checkpoint: true }, frame: { checkpoint: true }, stair: { checkpoint: true }, landing: { checkpoint: true }, seed: { checkpoint: true }, gulf: { checkpoint: true }, gulfFar: { checkpoint: true }, vault: { checkpoint: true }, vaultTop: {}, ante: {}, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'potting' },
    // the Potting Hall is the hub (v1.48): west the Shade House (an arena), east the Cold Frame; the Glass Stair's door
    // wants a small key from each, and the eye in the sun
    { a: 'potting', b: 'shade', door: 'dW' },          // (open: it shuts behind you while its keepers stand)
    { a: 'potting', b: 'frame' },
    { a: 'potting', b: 'stair', door: 'd1' },
    { a: 'stair', b: 'landing', door: 'lift' },        // the disc over the root-wall: it rides only in the sun
    { a: 'landing', b: 'seed', door: 'd2' },
    { a: 'seed', b: 'gulf', door: 'd3' },              // the Bud Passage's flower-door, a room on from the chest (one room with it)
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
    // (since v1.49 the bud is in the shade until the passage's ball turns its louvre: the bloom with the push)
    ballB: { type: 'drum', room: 'seed', plate: 'pB', plateAt: 1, start: 0 },
    pB: { type: 'plate', room: 'seed' },
    bud1: { type: 'switch', room: 'seed', needs: ['bloom'], when: { drumOn: ['ballB', 'pB'] } },      // the passage's flower-door, in the sunbeam it turns
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
    sweep: { shape: 'cone', range: 11, angle: 0.75, wind: 1.2, track: 0.6, part: 'arms', rig: 'coil', side: 1, damage: 0.75, knock: 11, recover: 0.9, then: 'sweepL' },
    sweepL: { shape: 'cone', range: 11, angle: 0.75, wind: 0.75, track: 0.5, part: 'arms', rig: 'coil', pose: 'sweep', side: -1, link: true, damage: 0.75, knock: 11, gap: 0.2, then: 'stampEnd' },
    stamp: { shape: 'ring', at: 'self', radius: 7.5, wind: 1.4, part: 'feet', rig: 'rear', wave: { speed: 8, reach: 15, width: 0.7, damage: 0.5 }, damage: 1, knock: 10, recover: 1.0, open: 3.2 },
    stampEnd: { shape: 'ring', at: 'self', radius: 7.5, wind: 1.2, part: 'feet', rig: 'rear', pose: 'stamp', link: true, damage: 1, knock: 10, recover: 1.0, open: 3.2 },
    roots: { shape: 'lane', range: 16, width: 3, wind: 1.4, track: 0.6, part: 'arms', rig: 'crouch', damage: 0.75, knock: 9, recover: 1.0, miss: 2.8 },
    clods: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', pose: 'sweep', damage: 0.75, knock: 8, recover: 0.8 },
    crush: { shape: 'cone', range: 8, angle: 0.9, wind: 1.3, track: 0.6, part: 'arms', rig: 'rear', pose: 'roots', damage: 1, knock: 11, recover: 0.8, miss: 3.0 },
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

// ------------------------------------------------------------------ the hub's wings (v1.48, issue #23)
/** The Potting Hall's wings (local m): the Shade House west (an arena), the Cold Frame east (two eyes, one ball, one louvre). */
export const WING = {
  z: 40,                                                   // both ways out of the Potting Hall, at its north end
  shade: { x: -22, z: 40, w: 16, d: 14 },
  frame: { x: 22, z: 40, w: 16, d: 14 },
  zone: { min: [-30, -1, 33], max: [-14, 9, 47] },
};

/**
 * The Seed Vault (v1.60, issue #23: north off the Shade House, beside the Glass Stair; v1.49 it stood off the Vine Gulf's
 * far side), local m: the room round x, z (w by d, h high, its floor at 0); the ledge along its east wall at `ledge`, its
 * west face a wall of glass; two seeds at the glass's foot (z); the ball's groove between their two plates; the keepers'
 * door from the ledge east through the Glass Stair's west wall at the root-wall's height onto a ledge inside it
 * ([x0, z0, x1, z1]) to the root-wall's top.
 */
export const VAULT = { x: -22, z: 57.2, w: 16, d: 14, h: 18, ledge: 9, seeds: [54.6, 59.8], groove: { x: -25.8, z: [53.6, 61] }, inner: [-9.8, 54.7, -7.4, 60.2] };

/** The Shade House's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arW', room: 'shade', zone: WING.zone, doors: ['dW'], extra: 2,
  shut: 'The door grinds shut behind you. In the dark among the dead pots, something stirs.',
  won: 'The last of them falls still. The key’s cage sinks, the door lets go, and a second door opens in the north wall.',
}];

/**
 * The Shade House (west of the Potting Hall, an arena: no louvre, only the dark; its door shuts behind you while its
 * keepers stand, and won, the small key's cage sinks and its north door opens into the Seed Vault) and the Cold Frame
 * (east: one louvre in its roof, one ball and two plates; on the north plate the sun falls on the north tray's eye, on
 * the south on the south's. An eye woken in the sun stays awake, so the ball serves both in turn, and the key wants
 * both). Each holds one of the two small keys the Glass Stair's door takes.
 */
function wings(rt, K, M, { pot, pane, leaf }) {
  const add = (P, o) => rt.add(P, o);
  const S = WING.shade, F = WING.frame, Z = WING.z;
  // ---- the Shade House
  K.corridor([-13.4, Z], [-11.6, Z], 0, { w: 5, h: 6.4 });
  K.hall({ x: S.x, z: S.z, w: S.w, d: S.d, y: 0, h: 10, roof: true, doors: [{ side: 'e', at: 0, w: 5, h: 6.4 }, { side: 'n', at: 0, w: 5, h: 6.4 }] });   // (and north into the Seed Vault, v1.60)
  add(Door, { id: 'dW', at: [-12.5, 0, Z], yaw: Math.PI / 2, w: 5, h: 6.4 });   // (open: it shuts behind you while they stand)
  for (const [x, z, s] of [[-27, 34.6, 0.9], [-27.6, 45.2, 0.8], [-17, 45.4, 0.7], [-18, 34.4, 0.8], [-23.6, 34.4, 0.6]]) pot(x, 0, z, s, true);
  add(Key, { id: 'kW', at: [-27.2, 0, Z], yaw: Math.PI / 2 });
  add(Mark, { room: 'shade', at: [S.x + 2, 0, S.z - 3.4], yaw: Math.PI / 2 });

  // ---- the Cold Frame: the louvre over the middle, the groove across, a tray of seedlings under each eye
  K.corridor([11.6, Z], [13.4, Z], 0, { w: 5, h: 6.4 });
  K.hall({ x: F.x, z: F.z, w: F.w, d: F.d, y: 0, h: 10, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, w: 5, h: 6.4 }] });
  K.add(M.dark, box(1.0, 0.04, 11, F.x + 3, 0.02, F.z));
  add(Ball, { id: 'ballC', a: [F.x + 3, 0.04, F.z - 5], b: [F.x + 3, 0.04, F.z + 5], r: 1.0 });
  add(Plate, { id: 'pC1', at: [F.x + 3, 0, F.z + 5], r: 1.2 });
  add(Plate, { id: 'pC2', at: [F.x + 3, 0, F.z - 5], r: 1.2 });
  const shade = 'The eye stays shut, in the shade.';
  add(Switch, { id: 'sC1', at: [F.x - 2, 4.6, F.z + F.d / 2 - 0.15], yaw: Math.PI, size: 0.9, wrong: shade });
  add(Switch, { id: 'sC2', at: [F.x - 2, 4.6, F.z - F.d / 2 + 0.15], yaw: 0, size: 0.9, wrong: shade });
  for (const sd of [1, -1]) { K.both(M.wall, box(5, 1.0, 1.6, F.x - 2, 0.5, F.z + sd * (F.d / 2 - 1.0))); for (let i = 0; i < 3; i++) pot(F.x - 3.6 + i * 1.6, 1.0, F.z + sd * (F.d / 2 - 1.0), 0.3, true); }
  add(Sunbeam, { from: [F.x, 10.2, F.z], w: 3.0, spots: [
    { at: [F.x - 2, 4.6, F.z + F.d / 2 - 0.2], normal: [0, 0, -1], r: 1.5, when: { drumOn: ['ballC', 'pC1'] } },
    { at: [F.x - 2, 4.6, F.z - F.d / 2 + 0.2], normal: [0, 0, 1], r: 1.5, when: { drumOn: ['ballC', 'pC2'] } },
    { at: [F.x - 1, 0.02, F.z], r: 2.2 },
  ] });
  for (const sd of [1, -1]) K.add(M.trim, T(new THREE.CylinderGeometry(0.12, 0.12, 10, 5), [F.x + 7.6, 5, F.z + sd * 5]));   // (the rods from each plate up to the louvre)
  pane(F.x + F.w / 2 - 0.05, 6.5, F.z, 3, 3, -Math.PI / 2);
  add(Key, { id: 'kE', at: [F.x + 5.6, 0, F.z], yaw: -Math.PI / 2 });
  add(Mark, { room: 'frame', at: [F.x - 4.5, 0, F.z + 3], yaw: Math.PI / 2 });
  void leaf;
}

/**
 * The Seed Vault: one louvre in its roof, one ball between two plates, two seeds at the foot of a wall of glass too
 * smooth to climb; the vine climbs it only grown from both seeds, and the louvre's beam falls on one seed or the other as
 * the ball sits (a seed bloomed in the sun stays grown, as the Cold Frame's eyes stay awake). The great key on the
 * ledge at the top, and beside it the keepers' door through to the Glass Stair's root-wall top: it opens with the vine,
 * the way back up to the disc (v1.60).
 */
function vault(rt, K, M, { pot, pane }) {
  const add = (P, o) => rt.add(P, o);
  const Vt = VAULT, Z = Vt.z, x0 = Vt.x - Vt.w / 2, x1 = Vt.x + Vt.w / 2, L = Vt.ledge;
  // its way in from the Shade House, north (the arena's second door, open once it is won)
  K.corridor([Vt.x, WING.shade.z + WING.shade.d / 2 + 0.6], [Vt.x, Z - Vt.d / 2 - 0.6], 0, { w: 5, h: 6.4 });
  add(Door, { id: 'dV', at: [Vt.x, 0, Z - Vt.d / 2 - 1.4], w: 5, h: 6.4, lamps: [{ lit: 'arW' }] });
  // and the keepers' door from the ledge east, through to the Glass Stair at the root-wall's height
  K.corridor([x1 + 0.6, Z], [-9.8, Z], L, { w: 5, h: 6 });
  add(Door, { id: 'dV2', at: [-11.6, L, Z], yaw: Math.PI / 2, w: 5, h: 6, lamps: [{ lit: 'sdA' }, { lit: 'sdB' }] });
  K.hall({ x: Vt.x, z: Z, w: Vt.w, d: Vt.d, y: 0, h: Vt.h, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', at: 0, w: 5, h: 6.4 }, { side: 'e', at: 0, w: 5, h: 6, y0: L }] });
  // the ledge on the east side, its face a wall of greenhouse glass; the vine grows up it from both seeds
  K.both(M.wallGlyph, box(3.2, L, Vt.d, x1 - 1.6, L / 2, Z));
  K.both(M.trim, box(3.4, 0.3, Vt.d, x1 - 1.7, L + 0.05, Z));
  // (the glass's face is where you meet it; held only once the vine is up it: the Glass piece slips you off it till then)
  K.climbable('the Seed Vault\'s glass: the vine up it, grown from both seeds, to the great key', () => K.solid(box(0.36, L, Vt.d - 0.4, x1 - 3.38, L / 2, Z)));
  add(Glass, { at: [x1 - 3.25, 0, Z], yaw: -Math.PI / 2, w: Vt.d - 0.4, h: L, when: { all: [{ lit: 'sdA' }, { lit: 'sdB' }] },
    slip: 'The glass is too smooth to hold. A vine could climb it, if anything grew at its foot.' });
  const [zA, zB] = Vt.seeds;
  add(Seed, { id: 'sdA', at: [x1 - 5, 0, zA], size: 0.9, seed: 3, shade: 'It sprouts, pale, and folds back into its husk. It is in the shade.' });
  add(Seed, { id: 'sdB', at: [x1 - 5, 0, zB], size: 0.9, seed: 4, shade: 'It sprouts, pale, and folds back into its husk. It is in the shade.' });
  // the ball's groove, its two plates; the louvre in the roof throws the sun on one seed or the other, or on the floor
  const GX = Vt.groove.x, [Z0, Z1] = Vt.groove.z;
  K.add(M.dark, box(1.0, 0.04, Z1 - Z0 + 0.6, GX, 0.02, (Z0 + Z1) / 2));
  add(Ball, { id: 'ballV', a: [GX, 0.04, Z0], b: [GX, 0.04, Z1], r: 1.1 });
  add(Plate, { id: 'pV1', at: [GX, 0, Z0], r: 1.3 });
  add(Plate, { id: 'pV2', at: [GX, 0, Z1], r: 1.3 });
  add(Sunbeam, { from: [Vt.x + 1, Vt.h + 0.4, Z], w: 3, spots: [
    { at: [x1 - 5, 0.62, zA], r: 1.9, when: { drumOn: ['ballV', 'pV1'] } },
    { at: [x1 - 5, 0.62, zB], r: 1.9, when: { drumOn: ['ballV', 'pV2'] } },
    { at: [Vt.x - 2, 0.02, Z], r: 2.2 }] });
  for (const z of [Z0, Z1]) K.both(M.trim, box(0.3, Vt.h - 0.4, 0.3, GX - 0.9, (Vt.h - 0.4) / 2, z + (z === Z0 ? -1.5 : 1.5)));   // the rods up to the louvre
  for (const s of [-1, 1]) pot(x0 + 1.8, 0, Z + s * 5, 0.6, true);
  pane(x1 - 0.05, 13, Z, 6, 5, -Math.PI / 2);
  add(Key, { id: 'kB', big: true, at: [x1 - 1.6, L + 0.2, Z - 4], yaw: -Math.PI / 2 });   // (on the ledge's trim, its floor: issue #274)
  add(Mark, { room: 'vault', at: [x0 + 2.6, 0, Z - 4.4], yaw: Math.PI / 2 });
}
// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const leaf = { paint: new THREE.Color('#7fcf72'), smooth: false, side: THREE.FrontSide };
  const leaf2 = { paint: new THREE.Color('#5f9a52'), smooth: false, side: THREE.FrontSide };
  const pink = { paint: new THREE.Color('#f2a7b8'), smooth: false, side: THREE.FrontSide };
  const glassM = makeMaterial({ color: GLASS, glow: 0.12, flat: true, key: 'temple.edena.glass' });
  /** A potted shrub: a white tub, a round head of leaves, a few flowers (dead: bare twigs). */
  const pot = (x, y, z, s = 1, dead = false) => {
    K.both(M.wall, lathe([[0.9 * s, 0], [1.1 * s, 1.0 * s], [1.2 * s, 1.1 * s], [0.01, 1.1 * s]], 12).translate(x, y, z), new THREE.CylinderGeometry(1.1 * s, 0.9 * s, 1.1 * s, 10).translate(x, y + 0.55 * s, z));
    if (dead) for (let i = 0; i < 4; i++) K.add({ paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide }, T(new THREE.CylinderGeometry(0.05, 0.08, 1.4 * s, 4), [x + Math.sin(i * 1.6) * 0.3, y + 1.6 * s, z + Math.cos(i * 1.6) * 0.3], [Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4]));
    else { K.add(leaf, T(new THREE.IcosahedronGeometry(1.1 * s, 1), [x, y + 1.9 * s, z])); for (let i = 0; i < 3; i++) K.add(pink, T(new THREE.SphereGeometry(0.2 * s, 6, 4), [x + Math.sin(i * 2.1) * 0.9 * s, y + 2.2 * s, z + Math.cos(i * 2.1) * 0.9 * s])); }
  };
  /** A pane of glass high on a wall (looking out on nothing: a pale green light). */
  const pane = (x, y, z, w, h, yaw) => { K.add(glassM, T(new THREE.PlaneGeometry(w, h), [x, y, z], [0, yaw, 0])); K.both(M.trim, T(new THREE.BoxGeometry(w + 0.3, 0.2, 0.2), [x, y + h / 2, z], [0, yaw, 0])); K.both(M.trim, T(new THREE.BoxGeometry(0.16, h, 0.16), [x, y, z], [0, yaw, 0])); };

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));   // (thin, on the dark drawn in the doorway: nothing to climb in front of it)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  pot(5, 0, 9, 0.8, true); pot(-5, 0, 10, 0.7, true);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: 6, h: 7 }] });

  // ---- the Potting Hall (z 12.6..44): a stone seed onto its plate, an eye behind the benches
  // (the house's hub since v1.48: a way west into the Shade House and east into the Cold Frame at its north end)
  K.hall({ x: 0, z: 28.3, w: 22, d: 31.4, y: 0, h: 12, roof: 'oculus', oculus: 0.3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4 }, { side: 'w', at: WING.z - 28.3, w: 5, h: 6.4 }, { side: 'e', at: WING.z - 28.3, w: 5, h: 6.4 }] });
  K.add(M.dark, box(1.0, 0.04, 21, -6, 0.02, 28));
  add(Ball, { id: 'ball1', a: [-6, 0.04, 17], b: [-6, 0.04, 38.5], r: 1.1 });
  add(Plate, { id: 'p1', at: [-6, 0, 38.5], r: 1.3 });
  // the potting benches along the east wall, dead seedlings in rows; the eye on the wall behind them, over the benches
  for (const z of [20, 27, 34]) { K.both(M.wall, box(3.2, 1.1, 5.2, 8.6, 0.55, z)); for (let i = 0; i < 3; i++) pot(8.6, 1.1, z - 1.7 + i * 1.7, 0.35, true); }
  add(Switch, { id: 's1', at: [10.8, 4.6, 27], yaw: -Math.PI / 2, size: 1.0, wrong: 'The eye stays shut. It is in the shade: the builders’ eyes open only to the sun.' });
  for (const z of [18, 29]) pane(-10.95, 8.5, z, 4, 4, Math.PI / 2);
  // the louvre over the benches: the ball's weight on its plate turns it, by the brass rod up the wall and over the roof,
  // and its sunbeam swings off the floor onto the eye
  add(Sunbeam, { from: [6.5, 12.0, 27], w: 3.2, spots: [{ at: [10.75, 4.6, 27], normal: [-1, 0, 0], r: 1.7, when: { drumOn: ['ball1', 'p1'] } }, { at: [1.5, 0.02, 25], r: 2.4 }] });
  K.add(M.trim, box(0.3, 0.06, 5.2, -6, 0.03, 41.1));                  // the rod: from the plate to the north wall,
  K.both(M.trim, box(0.3, 11.6, 0.3, -6, 5.8, 43.7));                  // up it,
  K.add(M.trim, box(12.8, 0.3, 0.3, 0.25, 11.75, 43.7));               // along under the roof,
  K.add(M.trim, box(0.3, 0.3, 16.7, 6.5, 11.75, 35.35));               // and over to the louvre
  add(Door, { id: 'd1', at: [0, 0, 44.6], w: 5, h: 6.4, lamps: [{ drumOn: ['ball1', 'p1'] }, { lit: 's1' }] });   // (and two keyholes: logic `lock`)
  add(Mark, { room: 'potting', at: [-9.4, 0, 15], yaw: Math.PI / 2 });
  wings(rt, K, M, { pot, pane, leaf });

  // ---- the Glass Stair (a rotunda, floor 0): a root-wall to climb (its top at 9), a disc that rides up to the landing at 18
  K.slab(-3.2, 44, 3.2, 46.6, 0, 0.8);
  K.wall(-3.2, 44.6, -3.2, 46.6, 0, 6.4, { t: 0.8 }); K.wall(3.2, 46.6, 3.2, 44.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.8, 45.6));
  const C2 = 57.2;
  K.rotunda({ x: 0, z: C2, y: 0, r: 10, h: 30, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6, y0: 18 }, { a: -Math.PI / 2, w: 5, h: 6, y0: VAULT.ledge }], oculus: 0.4 });   // (and west at the root-wall's height, the Seed Vault's keepers' door, v1.60)
  // (the house's climbs: this, and the glass where a vine grows; its other walls are not climbed, issue #115)
  K.climbable('the Glass Stair\'s root-wall: from the floor to the disc that rides on up in the sun', () => K.both(M.wallGlyph, box(20, 9, 6.4, 0, 4.5, C2 + 6.2)));
  for (let i = 0; i < 9; i++) K.add(i % 2 ? leaf : leaf2, T(new THREE.CylinderGeometry(0.22, 0.3, 9.2, 5), [-7 + i * 1.75, 4.5, C2 + 2.95], [0, 0, Math.sin(i * 1.7) * 0.12]));   // roots down its face (drawn only: solid, they are a ladder up a wall you are not meant to climb yet)
  // the disc rides only in the sun (lift); one ball, two plates, one louvre in the oculus: west, the sun on the eye
  // high on the west wall (the landing's door wants it); east, on the disc
  add(Platform, { id: 'lift', path: [[0, 9, C2 + 6], [0, 18, C2 + 6]], r: 2.2, speed: 1.5, pause: 2, when: { drumOn: ['ball2', 'pE'] } });
  K.slab(-3.2, C2 + 8.3, 3.2, C2 + 10.6, 18, 0.6);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5; if (Math.abs(Math.cos(a)) < 0.5) continue; pane(Math.sin(a) * 9.95, 22, C2 + Math.cos(a) * 9.95, 3.5, 6, a + Math.PI); }
  K.add(M.dark, box(13.6, 0.04, 1.0, 0, 0.02, C2 - 3.5));
  add(Ball, { id: 'ball2', a: [-6.4, 0.04, C2 - 3.5], b: [6.4, 0.04, C2 - 3.5], r: 1.1 });
  add(Plate, { id: 'pW', at: [-6.4, 0, C2 - 3.5], r: 1.3 });
  add(Plate, { id: 'pE', at: [6.4, 0, C2 - 3.5], r: 1.3 });
  // (the eye over the landing, on the wall beside its door: seen from the floor and from the landing)
  const sa = -0.62, sx = Math.sin(sa) * 9.5, sz = C2 + Math.cos(sa) * 9.5;
  add(Switch, { id: 's2', at: [sx, 23.5, sz], yaw: sa + Math.PI, size: 1.0, wrong: 'The eye stays shut, in the shade.' });
  add(Sunbeam, { from: [0, 29.6, C2], w: 3.2, spots: [{ at: [sx * 0.995, 23.5, C2 + (sz - C2) * 0.995], normal: [-Math.sin(sa), 0, -Math.cos(sa)], r: 1.6, when: { drumOn: ['ball2', 'pW'] } }, { at: [0, 9.04, C2 + 6], r: 2.4, when: { drumOn: ['ball2', 'pE'] } }] });
  // the rods from each plate up the wall to the louvre's ring
  for (const s of [-1, 1]) K.add(M.trim, T(new THREE.CylinderGeometry(0.14, 0.14, 30, 5), [s * 8.59, 15, C2 - 4.7]));
  add(Mark, { room: 'stair', at: [-6, 0, C2 - 6], yaw: Math.PI * 0.75 });
  // (v1.60) from the root-wall's top a ledge south along the west wall to the Seed Vault's keepers' door
  { const [lx0, lz0, lx1, lz1] = VAULT.inner; K.slab(lx0, lz0, lx1, lz1, VAULT.ledge, 0.6); }
  add(Mark, { room: 'landing', at: [2.4, 18, C2 + 9.6], yaw: -Math.PI / 2 });

  // ---- the corridor and the Seed Chamber (floor 18): the chest; the way on is a bud
  K.slab(-3.2, C2 + 9.8, 3.2, C2 + 12.6, 18, 0.8);
  K.wall(-3.2, C2 + 10.4, -3.2, C2 + 12.6, 18, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.4, 18, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 24.8, C2 + 11.6));
  add(Door, { id: 'd2', at: [0, 18, C2 + 11.8], w: 4.8, h: 6.4, lamps: [{ lit: 's2' }] });
  const C3 = C2 + 22.6;
  K.rotunda({ x: 0, z: C3, y: 18, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.4 });
  K.both(M.trim, ...chestMound(0, 18, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  for (const [x, z] of [[-6, C3 - 3], [6, C3 - 3], [-6.4, C3 + 3.5], [6.4, C3 + 3.5]]) pot(x, 18, z, 0.7, true);
  // a seed in a stone ring, in the oculus's sun beside the dais: bloom it and it flowers (a try: nothing waits on it)
  add(Seed, { id: 'seed0', at: [-4.2, 18, C3 + 4.2], size: 0.8, seed: 2 });
  add(Sunbeam, { from: [-1.4, 31.2, C3 + 1.4], w: 2.2, spots: [{ at: [-4.2, 18.02, C3 + 4.2], r: 2.0 }] });
  add(Mark, { room: 'seed', at: [6, 18, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Bud Passage (floor 18), a room on: the door into the Vine Gulf is a bud in a sunbeam
  const A0 = C3 + 10.9;
  K.slab(-3.2, C3 + 9.2, 3.2, A0 + 0.6, 18, 0.8);
  K.hall({ x: 0, z: A0 + 6, w: 12, d: 12, y: 18, h: 10, roof: 'oculus', oculus: 0.4, omit: ['n'], doors: [{ side: 's', w: 5, h: 6.4 }] });
  pot(4.4, 18, A0 + 3, 0.6, true); pot(4.6, 18, A0 + 9.4, 0.5, true);
  const G0 = A0 + 12 + 1.2;
  add(Bud, { id: 'd3', bloom: 'bud1', at: [0, 18, G0 - 0.6], w: 5, h: 6.4, shade: 'The bud stirs, and stays shut: it is in the shade. Nothing grows in the shade.' });
  // (since v1.49 the louvre over the passage throws its beam on the floor by the pots until a ball's weight on its plate,
  // at the groove's north end by the west wall, turns it onto the bud: the bloom with the push)
  K.add(M.dark, box(1.0, 0.04, 7.4, -4.2, 18.02, A0 + 5.2));
  add(Ball, { id: 'ballB', a: [-4.2, 18.04, A0 + 1.8], b: [-4.2, 18.04, A0 + 8.6], r: 1.0 });
  add(Plate, { id: 'pB', at: [-4.2, 18, A0 + 8.6], r: 1.2 });
  K.both(M.trim, box(0.3, 9.6, 0.3, -5.75, 22.8, A0 + 8.6));               // its rod up the wall to the louvre
  K.add(M.trim, box(5.6, 0.3, 0.3, -3, 27.75, A0 + 8.6));
  add(Sunbeam, { from: [0, 28.6, A0 + 6.4], w: 2.4, spots: [{ at: [0, 18.02, G0 - 3.0], r: 2.4, when: { drumOn: ['ballB', 'pB'] } }, { at: [2.6, 18.02, A0 + 5], r: 2.2 }] });

  // ---- the Vine Gulf: from the ledge at 18 across a chasm (a seed grows the bridge); a glass wall up to 27 (a seed grows a vine up it)
  K.slab(-3.2, G0 - 1.6, 3.2, G0 + 0.6, 18, 0.8);
  K.hall({ x: 0, z: G0 + 22, w: 22, d: 44, y: -6, h: 44, floor: false, roof: false, doors: [{ side: 's', w: 5, h: 6.4, y0: 24 }, { side: 'n', w: 5, h: 6.4, y0: 33 }] });
  // its roof a barrel vault of greenhouse glass on white ribs, the daylight through it (the picked hall)
  const vaultM = makeMaterial({ color: '#d6e6f4', glow: 0.22, flat: true, side: THREE.DoubleSide, key: 'temple.edena.vault' });
  K.both(vaultM, T(new THREE.CylinderGeometry(12.2, 12.2, 45.2, 24, 1, true, -Math.PI / 2, Math.PI), [0, 38, G0 + 22], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i <= 11; i++) K.both(M.trim, T(new THREE.TorusGeometry(12.05, 0.22, 4, 24, Math.PI), [0, 38, G0 + i * 4], [0, 0, 0]));
  for (const a of [0.45, 0.9, 1.35]) for (const s of [-1, 1]) K.add(M.trim, T(new THREE.BoxGeometry(0.18, 0.18, 44.6), [s * Math.cos(a) * 12.0, 38 + Math.sin(a) * 12.0, G0 + 22]));
  /** A square stone pot of the builders with a dead stick in it (the picked hall's). */
  const squarePot = (x, y, z, s = 1) => {
    K.both(M.wall, box(1.7 * s, 1.5 * s, 1.7 * s, x, y + 0.75 * s, z));
    K.add(M.trim, box(1.9 * s, 0.2 * s, 1.9 * s, x, y + 1.5 * s, z));
    for (let i = 0; i < 3; i++) K.add({ paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide }, T(new THREE.CylinderGeometry(0.05 * s, 0.11 * s, 3.2 * s, 4), [x + Math.sin(i * 2.1) * 0.25, y + 3.0 * s, z + Math.cos(i * 2.1) * 0.25], [Math.sin(i * 1.3) * 0.35, 0, Math.cos(i * 1.3) * 0.35]));
  };
  for (const s of [-1, 1]) { squarePot(s * 9.6, 18, G0 + 1.2); squarePot(s * 9.6, 18, G0 + 29.4); squarePot(s * 9.6, 27, G0 + 42.6, 0.8); }
  K.slab(-11, G0, 11, G0 + 6, 18, 24);
  K.slab(-11, G0 + 28, 11, G0 + 44, 18, 24);
  K.both(M.wallGlyph, box(22, 9, 6, 0, 22.5, G0 + 41));          // the high ledge, its face the glass wall
  K.both(M.trim, box(22.2, 0.3, 6.2, 0, 27.05, G0 + 41));
  // (the glass in its middle is where you meet it, and the only part of the face held: once its vine is up it, the
  // Glass piece slipping you off it till then; the panes either side are glass too, and no vine grows up them)
  K.climbable('the Vine Gulf\'s glass: the vine up it, from the seed-ball rooted in the sun, to the high ledge', () => K.solid(box(9, 9, 0.24, 0, 22.5, G0 + 37.86)));
  K.both(M.dark, box(22, 1, 22, 0, -6.4, G0 + 17));
  for (let i = 0; i < 7; i++) K.add(i % 2 ? leaf : leaf2, T(new THREE.SphereGeometry(1.6 + (i % 3) * 0.5, 8, 6).scale(1, 0.5, 1), [-9 + i * 3, -5.6, G0 + 10 + (i % 3) * 5]));   // a jungle down there (drawn only: foliage, and solid it floors the gulf you are meant to bridge)
  add(Pit, { room: 'gulf', min: [-12, -8, G0 + 6], max: [12, 12, G0 + 28] });
  add(Seed, { id: 'seed1', at: [-2.6, 18, G0 + 4.6], size: 0.9, seed: 1, shade: 'It sprouts, pale, reaching for light that isn’t there, and folds back into its husk. The sun falls past it, down into the dark.' });
  add(Bridge, { id: 'vine1', a: [0, 18, G0 + 5.9], b: [0, 18, G0 + 28.1], w: 3.6, n: 10, from: 'grow' });
  // the great louvre in the vault: its beam falls into the green dark below until the sun-ball turns it onto the lip
  K.add(M.dark, box(6.4, 0.04, 1.0, 6.6, 18.02, G0 + 2.6));
  add(Ball, { id: 'sun', a: [3.6, 18.04, G0 + 2.6], b: [9.6, 18.04, G0 + 2.6], r: 1.1 });
  add(Plate, { id: 'pS', at: [9.6, 18, G0 + 2.6], r: 1.3 });
  K.both(M.trim, box(0.3, 20, 0.3, 10.8, 28, G0 + 0.6));                    // its rod up the corner to the vault
  add(Sunbeam, { from: [0, 49.6, G0 + 16], w: 4.2, spots: [{ at: [-2.6, 18.62, G0 + 4.4], r: 2.2, when: { drumOn: ['sun', 'pS'] } }, { at: [0, -5.6, G0 + 16], r: 4 }] });
  add(Glass, { at: [0, 18, G0 + 37.95], yaw: Math.PI, w: 9, h: 9, when: { lit: 'seed2' } });
  for (const x of [-7, 7]) pane(x, 22.5, G0 + 37.93, 4.5, 8, Math.PI);   // (more glass either side: the vine grows only in the middle)
  // across: a fixed louvre throws the sun on the glass's foot; the seed-ball lies in the shade beside it, in its groove
  K.add(M.dark, box(8, 0.04, 1.0, -6.2, 18.02, G0 + 36.4));
  add(Ball, { id: 'sb', a: [-9.8, 18.04, G0 + 36.4], b: [-2.4, 18.04, G0 + 36.4], r: 1.0, seed: { id: 'seed2', grew: 'The seed splits in the sun and roots, and a vine runs up out of it, up the glass, leaf over leaf.' } });
  add(Plate, { id: 'pG', at: [-2.4, 18, G0 + 36.4], r: 1.2 });
  add(Sunbeam, { from: [-1.5, 49.4, G0 + 33], w: 2.6, spots: [{ at: [-2.4, 18.02, G0 + 36.3], r: 1.9 }] });
  add(Bud, { id: 'd4', bloom: null, at: [0, 27, G0 + 44], w: 5, h: 6.4, color: '#f2c6e0', dry: 'The bud only beads with it, high and dry over the glass. Nothing reaches it to grow from.' });
  for (const s of [-1, 1]) K.add(M.trim, T(new THREE.BoxGeometry(0.4, 4.2, 0.5), [s * 1.45, 27 + 6.4 + 1.6, G0 + 43.75], [0, 0, s * 0.62]));   // its pointed arch
  add(Mark, { room: 'gulf', at: [-7, 18, G0 + 3], yaw: 0 });
  add(Mark, { room: 'gulfFar', at: [7, 18, G0 + 31], yaw: Math.PI });
  add(Mark, { room: 'gulfTop', at: [-6, 27, G0 + 41], yaw: Math.PI / 2 });

  // ---- the corridor and the Glasshouse (floor 27): four dead beds round the walls
  const H0 = G0 + 44;
  const AE = K.vestibule(H0, 27);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, 27, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  add(Door, { id: 'dB', at: [0, 27, AE - 0.4], w: 5, h: 6.4 });   // the great key's door (v1.49): its lock plate is its logic's
  const HR = 20, CW = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CW, y: 27, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.55 });
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
  add(Door, { id: 'd5', at: [0, 27, CW + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CW + HR + 0.6, 3.2, CW + HR + 10, 27, 0.8);
  K.wall(-3.2, CW + HR + 1.4, -3.2, CW + HR + 10, 27, 7, { t: 0.8 }); K.wall(3.2, CW + HR + 10, 3.2, CW + HR + 1.4, 27, 7, { t: 0.8 });
  K.wall(3.2, CW + HR + 10, -3.2, CW + HR + 10, 27, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 34.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 27, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.1, 0, 29.5, CW + HR + 10.5));

  const model = gardenerModel();
  model.pos.copy(K.world(0, 27, CW + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 27, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 27, CW), r: HR, y: K.world(0, 27, 0).y };

  // (the vault last: its mark after the others, so the machines' ids by mark stay as they were)
  vault(rt, K, M, { pot, pane });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-32, -12, -3), V(32, 58, CW + HR + 12)),
    gadget: { at: W(0, 18.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 27.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 7, 28, 16], [WING.shade.x, 6, WING.z, 12], [WING.frame.x, 6, WING.z, 12], [0, 10, C2, 14], [0, 22, C3, 12], [0, 22, G0 + 16, 22], [0, 30, G0 + 38, 16], [VAULT.x, 8, VAULT.z, 14], [0, 34, CW, 30]],
    guardian: { def: { ...GARDENER, onHit: gardenerHit, openFor: gardenerOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Greenhouse in the hollow
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 15;
  const base = level.ground.baseAt(SITE.x, SITE.z, SITE.r) - 0.6;
  const K = new TempleKit(rt.root, 'The Builders’ Greenhouse', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, sill = 2.4;
  const glassM = makeMaterial({ color: GLASS, glow: 0.18, flat: true, key: 'temple.edena.dome' });
  const ribs = { paint: new THREE.Color('#fbf8f0'), smooth: false, side: THREE.FrontSide };
  const teal = { paint: new THREE.Color('#62c3c9'), smooth: true, side: THREE.FrontSide };
  // a white plinth, a drum of the builders' gridded stone, a ribbed dome of glass on it
  K.both(M.floor, new THREE.CylinderGeometry(R + 4, R + 5, sill, 40).translate(0, sill / 2, 0));
  K.both(M.wallGlyph, new THREE.CylinderGeometry(R, R, 7, 36).translate(0, sill + 3.5, 0));
  K.both(M.trim, new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.6, 36).translate(0, sill + 7.1, 0));
  // (the dome collides as it is drawn, ribs and all: it used to be a 20-sided sphere 0.2 m inside the glass)
  K.both(glassM, new THREE.SphereGeometry(R, 32, 12, 0, TAU, 0, Math.PI / 2).translate(0, sill + 7, 0));
  for (let i = 0; i < 16; i++) K.both(ribs, T(new THREE.TorusGeometry(R + 0.05, 0.22, 4, 32, Math.PI / 2), [0, sill + 7, 0], [0, (i / 16) * TAU, 0]));
  for (const k of [0.35, 0.65, 0.88]) { const a = k * Math.PI / 2; K.both(ribs, T(new THREE.TorusGeometry(R * Math.cos(a) + 0.05, 0.2, 4, 40), [0, sill + 7 + R * Math.sin(a), 0], [Math.PI / 2, 0, 0])); }
  K.both(teal, new THREE.CylinderGeometry(0.9, 1.4, 2.2, 12).translate(0, sill + 7 + R, 0));
  K.both(teal, new THREE.SphereGeometry(1.0, 12, 8).translate(0, sill + 9.3 + R, 0));
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5) continue; K.add(M.glyph, T(glyphGeometry(1.6, 0.12), [Math.sin(a) * (R + 0.05), sill + 4.5, Math.cos(a) * (R + 0.05)], [0, a, 0])); }
  // panes gone from the dome here and there (the reference's broken glass): dark gaps between the ribs
  const gap = makeMaterial({ color: '#3f5a52', flat: true, side: THREE.DoubleSide, key: 'temple.edena.domegap' });
  for (const [a, up, w, h] of [[0.25, 0.32, 2.4, 1.8], [-0.62, 0.48, 1.8, 2.2], [0.9, 0.62, 2.0, 1.4], [-1.3, 0.28, 2.6, 1.6], [2.2, 0.4, 2.2, 2.0], [-2.5, 0.55, 1.6, 1.6], [1.6, 0.22, 1.4, 1.8], [3.0, 0.7, 1.8, 1.2]]) {
    const p = V(Math.sin(a) * Math.cos(up), Math.sin(up), Math.cos(a) * Math.cos(up)).multiplyScalar(R + 0.06);
    const g = new THREE.CircleGeometry(1, 5).scale(w / 2, h / 2, 1);
    g.lookAt(p); g.translate(p.x, p.y + sill + 7, p.z);
    K.add(gap, g);
  }
  // the doorway, after the picked entrance: a tall white porch out of the drum between two pilasters that rise past
  // its rim, a tall narrow door, and over it the builders' frieze: three round holes over an arc
  const z0 = R - 1.5, z1 = R + 3.2;
  for (const s of [-1, 1]) {
    K.both(M.wall, box(2.2, 11.6, z1 - z0 + 0.6, s * 4.1, sill + 5.8, (z0 + z1) / 2 + 0.3));      // the pilasters
    K.both(M.trim, box(2.5, 0.4, z1 - z0 + 0.9, s * 4.1, sill + 11.7, (z0 + z1) / 2 + 0.3));
  }
  K.both(M.wall, box(6.2, 4.6, z1 - z0, 0, sill + 8.9, (z0 + z1) / 2));                        // the face over the door
  for (const s of [-1, 1]) K.both(M.wall, box(0.7, 6.6, z1 - z0, s * 2.85, sill + 3.3, (z0 + z1) / 2));
  K.add(M.trim, box(4.6, 0.3, 0.3, 0, sill + 6.75, z1 + 0.1));                                  // the lintel's line
  for (const x of [-1.1, 0, 1.1]) K.add(M.voidM, T(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 14), [x, sill + 9.9, z1 + 0.02], [Math.PI / 2, 0, 0]));
  K.add(M.voidM, T(new THREE.TorusGeometry(1.5, 0.13, 4, 20, Math.PI), [0, sill + 8.2, z1 + 0.05]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(4, 6.6).translate(0, 3.3, 0), [0, sill, R + 0.3]));
  K.solid(box(4, 6.6, 0.1, 0, sill + 3.3, R + 0.3));
  // dry creepers already on it (brown: the garden grows over everything, even this, but it has stopped)
  const twig = { paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.45) continue;
    const pts = []; for (let j = 0; j <= 8; j++) { const h = j * 1.2, r = R + 0.25 - Math.max(0, h - 7) * 0.12; pts.push(V(Math.sin(a + Math.sin(j) * 0.04) * r, sill + h, Math.cos(a + Math.sin(j) * 0.04) * r)); }
    K.both(twig, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.18, 4));
  }
  // the steps down to the meadow
  const foot = level.ground.heightAt(...(() => { const p = K.world(0, 0, R + 12); return [p.x, p.z]; })()) - base;
  K.stairs([0, sill, R + 4.4], [0, Math.max(0.2, foot), R + 11], 8, { rise: 0.4 });
  // the sown beds in rows either side of the path, where nothing has come up: brown earth in white kerbs
  const soil = { paint: new THREE.Color('#8a5f3e'), smooth: false, side: THREE.FrontSide };
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = s * (5.4 + i * 4.6), z = R + 15;
    const w = K.world(x, 0, z), gy = level.ground.heightAt(w.x, w.z) - base;
    if (!Number.isFinite(gy)) continue;
    K.add(M.trim, box(3.6, 0.5, 9, x, gy + 0.1, z));
    K.add(soil, box(3.0, 0.5, 8.4, x, gy + 0.2, z));
    for (let j = 0; j < 4; j++) K.add(M.trim, box(0.06, 0.6, 0.06, x + (j % 2 ? 0.6 : -0.6), gy + 0.7, z - 3 + j * 2));   // the little marker sticks
  }
  // the glass spire (level design audit v1.49, issue #131: from Mira's the meadow's crest hid all but the dome's cap, so
  // the walk there was blind): out of the teal finial a slender white mast, ringed, carries a lantern of glass ribbed in
  // white, and on it a glass bud, the reference's bud over the Bud Passage at the meadow's scale. It shows whole over the
  // crest from the water clock, and the lantern's glass catches the sun. Drawn only, as the creepers.
  const S0 = sill + 7 + R + 2.2, { mast, lantern, r } = SPIRE, L0 = S0 + mast;
  const spireGlass = makeMaterial({ color: '#e8f4ff', glow: 0.8, flat: true, key: 'temple.edena.spire' });
  const budGlass = makeMaterial({ color: '#f4c9d3', color2: '#9fd6c9', glow: 0.3, flat: true, key: 'temple.edena.bud' });
  K.add(ribs, new THREE.CylinderGeometry(0.45, 0.9, mast + 0.6, 10).translate(0, S0 - 0.3 + (mast + 0.6) / 2, 0));
  for (const k of [0.3, 0.6, 0.85]) K.add(ribs, T(new THREE.TorusGeometry(1.1 - k * 0.4, 0.16, 4, 14), [0, S0 + mast * k, 0], [Math.PI / 2, 0, 0]));
  K.add(ribs, new THREE.CylinderGeometry(r + 0.4, r, 0.4, 8).translate(0, L0, 0));
  K.add(spireGlass, new THREE.CylinderGeometry(r, r, lantern, 8, 1, true).translate(0, L0 + lantern / 2, 0));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; K.add(ribs, box(0.22, lantern, 0.22, Math.sin(a) * (r + 0.02), L0 + lantern / 2, Math.cos(a) * (r + 0.02))); }
  K.add(ribs, new THREE.CylinderGeometry(r - 0.4, r + 0.4, 0.45, 8).translate(0, L0 + lantern + 0.2, 0));
  K.add(budGlass, new THREE.SphereGeometry(r * 0.85, 14, 10).scale(1, 1.75, 1).translate(0, L0 + lantern + 0.4 + r * 1.45, 0));
  K.add(ribs, new THREE.ConeGeometry(0.28, 3, 8).translate(0, L0 + lantern + 0.4 + r * 2.9 + 1.2, 0));
  K.flush();
  const at = K.world(0, sill, R + 1.4);
  return { door: { at, heading: yaw }, kit: K, base, R, sill, glassM, spire: { top: K.world(0, L0 + lantern + r * 2.9 + 3.1, 0), lantern: K.world(0, L0 + lantern / 2, 0), height: mast + lantern + r * 2.9 + 3.1 }, clear: [{ x: SITE.x, z: SITE.z, r: R + 9 }, { x: K.world(0, 0, R + 9).x, z: K.world(0, 0, R + 9).z, r: 7 }, { x: K.world(0, 0, R + 15).x, z: K.world(0, 0, R + 15).z, r: 18 }] };
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
  // the dome: leaves and blossom over the glass
  const O = rt.outside;
  if (O) {
    for (let i = 0; i < 160; i++) {
      const a = i * 2.39996, up = Math.acos(1 - (i / 160) * 0.95), r = O.R + 0.3;
      const p = O.kit.world(Math.sin(a) * Math.sin(up) * r, O.sill + 7 + Math.cos(up) * r, Math.cos(a) * Math.sin(up) * r);
      if (i % 3) leaves.push({ at: p, s: 1.6, r: i }); else flowers.push({ at: p, s: 1.8, c: i % 5 });
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
  const apply = () => { root.visible = k > 0.01; fm.count = Math.round(k * flowers.length); lm.count = Math.round(Math.min(1, k * 1.3) * leaves.length); };
  return {
    root, count: { flowers: flowers.length, leaves: leaves.length, slabs: slabs.length, beds: level.edena?.seedRow?.beds.length ?? 0 },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt) {
      if (k === want) return;
      k = THREE.MathUtils.clamp(k + (want ? dt / 5 : -dt), 0, 1);
      apply();
      if (O) O.glassM.uniforms.uGlow.value = 0.18 + 0.15 * k;
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
