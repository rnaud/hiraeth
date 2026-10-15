import { landmark, LAMP_CROWN_LIFT } from './landmarks.js';
import { glazing, glaze, metal } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { LightShaft } from '../veil.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Switch, LightEar, Bridge, Ball, Plate, Mark, Pit, Key } from './pieces.js';
import { mothModel } from './guardians.js';
import { offsetOf } from '../levels/names.js';
import { chestMound } from '../boxes/mound.js';
import { lampHouseSkin } from './skins/lamp-house.js';

// Lorn II's temple: the Lamp-House, a dark tower of the makers standing in the
// shallow water east of the root cave, a causeway of flat stones out to it from
// the end of the lit path. Its lamp lit the whole wood once; the night the sky
// rang it went out, and three of the pools with it. Hollin's people kept their
// pools lit for forty years without knowing there had been a greater lamp.
// Something with wings is still up in its lamp-room, in the dark.
//
// Inside (built far overhead, through its door; dark: the lantern charm glows in it). The temple's one idea:
// light wakes what waits for it, and light can be carried.
// Since v1.77 (issue #336, docs/design/temple-redesign.md) its rooms are shrines: every hall 30 to 36 m across under 17 m
// of stone or more, the chamber's round hall 34 m, doors 7 by 9 (ROOMS, DOOR), each puzzle in the middle of its own
// room, the one fight in the Kennel.
//   the Threshold           the first mark, the way out
//   the Hall of Dark Pools  three pool-lamps for the door's three lamps: two on the floor, the third up on a
//                           loft of roots out from the west wall, its pool far back from the edge: out of sight from
//                           the floor (climb to find it)
//   the Kennel              (v1.49, issue #23: east off the hall, an arena, the house's one fight) where the keepers of
//                           the house's lamps were kept, dark; its door shuts behind you while they stand round its
//                           middle. Won, the small key's cage sinks: the Wick Room's grille, along the hall, takes it
//                           (v1.60; the Lamp Passage's door did, v1.49)
//   the Root Stair          a dark pool across its middle, and no way over it: moss-stones lie sunk in it, dark until
//                           the lamp in their socket wakes, and only light wakes it. A pool-orb waits on the near floor
//                           beside a small pool, its groove across the floor to the socket (v1.77: it rolled through
//                           the doorway from the Hall of Dark Pools). Light the pool, let the orb drink its light, then
//                           roll it to the socket before it fades: the lamp catches and the moss-stones rise glowing
//                           out of the pool (push + shot, before the chest: light can be carried, and light wakes the
//                           stones); then a root-wall to climb
//   the Lantern Chamber     the makers' chest: the LANTERN CHARM (src/items.js 'lantern'), in the middle of a round hall.
//                           Its way on is open; a lamp by the dais wakes when you stand by it with the lantern (a try:
//                           nothing is locked)
//   the Lamp Passage        on through the chamber's north wall: the door into the gallery is a lamp that wakes when you
//                           stand by it with the lantern, on a post in the chamber beside the way north (since v1.77;
//                           at the passage's far end before), dark even to the lantern's light

//   the Dark Gallery        a chasm across its middle crossed by moss-stones that only the lantern's light shows; an eye
//                           only it shows, up on a post over the near floor (behind you as you cross, in sight from the
//                           far door); and the far door's lamp, in a niche on the far floor, wakes only to the
//                           light of a pool-orb: stand by the orb with the lantern till it glows, then roll it
//                           (the push) down its groove into the niche before its glow fades. Rolled in dark,
//                           it wakes nothing (the lantern with the push: light carried where you cannot go)
//   the Wick Room           (v1.60, east of the Root Stair, its way in off the Hall of Dark Pools' east wall: open and
//                           dark on the way in; v1.49 off the gallery's far side) the gallery's far door takes its
//                           great key, so the lantern comes back down for it. In the middle of its floor the wick-house:
//                           two niches in its face, a pool-orb in a groove before each, the great key behind a grille
//                           between them, a keyhole in the grille (the Kennel's small key, next door). A niche's lamp
//                           burns only while its orb glows; the grille lifts, for good, only while both burn: light one
//                           orb, roll it home, light the other and roll it home before the first fades (two lights
//                           carried at once). A stair up its north wall to a balcony, and a keepers' door that opens
//                           with the grille onto a ledge of roots along the Root Stair's wall to the root-wall's top:
//                           the way back up to the chamber, a loop
//   the Lamp-Room           the guardian (organic: you calm it): the Lampless, a great moth. When it hangs low,
//                           searching for light, stand still by it with the lantern lit, and let it drink. Three
//                           dark pools lie round the room: lit earlier (a splash, or your lantern held by one), a
//                           pool lures it as it searches, and it drinks there (taught in its second phase; in its
//                           last it shies from you: only a pool brings it down, and only if you stand back)

// After: the Lamp-House's lamp burns again, its beam turning over the wood at night (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** In the shallow water east of the root cave; its door looks west, down the causeway to the path's end. */
// (the Deep Wood's own coordinates, moved to where the wood lies in Lorn: src/levels/names.js PART_OFFSET)
const [OX, , OZ] = offsetOf('perdide2');
export const SITE = { x: 102 + OX, z: -452 + OZ, r: 14, path: [6 + OX, -414 + OZ] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

/**
 * The Lamp-House's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/lamp-house):
 * dark slate in blocks, grey flagstones, moss at the walls' foot and the frames mossy grey, hanging lamps under the friezes
 * and every lamp's pool on the stone warm amber (lampTint); its shade a deep blue-violet, its light a dim warm grey.
 */
export const PALETTE = {
  wall: '#504f5e', wall2: '#484756', wall3: '#5a5966', floor: '#504e58', floor2: '#47454f', trim: '#6c6b55', fitting: '#a07a3e',
  dark: '#1b1d33', stone: '#5e5c66', accent: '#f0927a', glow: '#8fe0d0', glyph: '#f0b450', lamp: '#ffd6a0', sand: '#5a5068', sand2: '#4e4560', void: '#14162c',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.7, shade: 0.15, lampTint: ['#f2b45a', 0.75] },
    wall: { mode: 0, grid: 1.8, plates: true },
    floor: { mode: 0, grid: 2.2, plates: true },
    glyph: { glow: 0.5 },
  },
  bands: [{ at: 0.72, h: 1.0, color: '#3f4254' }, { y: 0.3, h: 0.6, color: '#5a6139' }],
  ornament: { kind: 'lamp', color: '#f6c060', color2: '#3a3a40', glow: 0.85 },
  light: { shadow: '#383a5e', light: '#e8dcc4', sun: '#f0d8a8' },
};

/**
 * The house's doors (m: issue #336, 5 by 6.4 before; the Wick Room's grille 2.4 by 3) and its rooms in the kit's local
 * frame (z into the house): each hall's floor from wall to wall (its walls stand outside it), its floor's height and its
 * ceiling's; the round halls' middles and radii. The Root Stair and the Dark Gallery stand on their pits' floors (`y`),
 * their floors at `floor` (`near` the near floor's depth, `pit` the pit's; the Root Stair's root-wall the rest, its top
 * at `wall`). The props (the pools, the orbs, the niches, the moss-stones), the pits and every groove as long as they
 * were, so every timing and every climb holds.
 */
export const DOOR = { w: 7, h: 9 };
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 14, y: 0, top: 12 },
  pools: { x0: -18, x1: 18, z0: 15.2, z1: 55.2, y: 0, top: 26 },
  roots: { x0: -18.5, x1: 18.5, z0: 56.4, z1: 102.4, y: -6, floor: 0, top: 28, near: 20, pit: 10.1, wall: 9 },
  lantern: { x: 0, z: 125, r: 17, y: 9, top: 25 },
  gallery: { x0: -18, x1: 18, z0: 146, z1: 202, y: -3, floor: 9, top: 27, near: 18, pit: 20 },
  kennel: { x0: 26, x1: 56, z0: 10, z1: 40, y: 0, top: 18 },
  wick: { x0: 26, x1: 56, z0: 45, z1: 85, y: 0, top: 20 },
};
const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
/**
 * The Kennel (v1.49, east off the Hall of Dark Pools: an arena in the dark; since v1.77 the house's one fight, its keepers
 * round its middle) and the Wick Room (v1.60: east of the Root Stair, its way in off the Hall of Dark Pools' east wall at z
 * `door`; v1.49 it stood off the Dark Gallery's far side), local m: the room round x, z (w by d, h high); its balcony along
 * the west wall at the root-wall's height ([z0, z1, its depth]) and the stair up the north wall to it ([x at its foot, x
 * at its head, z], stairW wide). Since v1.77 the niches, the orbs and the great key stand in the middle of the room, in
 * the wick-house: a block of stone whose south face is at z `face`, its two niches' x (`niches`), the orbs' grooves along z
 * ([from, to]: to the niches' mouths), the great key behind its grille in the block at z `keyZ`; the orbs' glow (s).
 */
const [KX, KZ] = mid(ROOMS.kennel), [WX, WZ] = mid(ROOMS.wick);
export const KENNEL = { x: KX, z: KZ, w: 30, d: 30, zone: { min: [ROOMS.kennel.x0, -1, ROOMS.kennel.z0], max: [ROOMS.kennel.x1, 9, ROOMS.kennel.z1] } };
export const WICK = { x: WX, z: WZ, w: 30, d: 40, h: 20, door: 50, balcony: [72, 85, 5], stair: [44, 31, 82.6], stairW: 4.4,
  face: 64, niches: [34.7, 47.3], groove: [53.2, 61.2], keyZ: 68.5, lasts: 25 };
/**
 * The keepers' way between the Wick Room's balcony and the Root Stair's root-wall top (v1.60): a ledge of roots along the
 * stair's east wall at the root-wall's height, [x0, z0, x1, z1] (over the pool, out of any jump's reach from the floor),
 * and a passage east through the wall at z.
 */
export const ROOT_WAY = { x0: 14, z: 81, y: 9, ledge: [14, 77, 18.5, 86.5] };

export const LOGIC = {
  id: 'perdide2', entry: 'threshold', gadget: 'lantern',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a fight;
  // src/foes.js places machines only in a fight's room: scripts/temple-design/rules.mjs, tests/temple-rules.test.js. The
  // Lantern Chamber a puzzle room: the chest in its middle, the lantern's try and the Lamp Passage's lamp beside it)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, pools: { checkpoint: true, kind: 'puzzle' }, loft: { kind: 'puzzle' }, roots: { checkpoint: true, kind: 'puzzle' },
    lantern: { checkpoint: true, kind: 'puzzle' }, kennel: { checkpoint: true, kind: 'combat' },
    gallery: { checkpoint: true, kind: 'puzzle' }, galleryFar: { kind: 'puzzle' }, wick: { checkpoint: true, kind: 'puzzle' }, wickKey: { kind: 'passage' },
    lamp: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'pools' },
    { a: 'pools', b: 'loft' },                                        // up the loft of roots
    { a: 'pools', b: 'kennel', door: 'dK' },                         // the Kennel, east off the hall (v1.49): an arena, the small key
    { a: 'pools', b: 'wick' },                                        // the Wick Room, east off the hall too (v1.60): the great key behind a grille
    { a: 'pools', b: 'roots', door: 'd1' },
    { a: 'roots', b: 'lantern', door: 'disc' },                      // the moss-stones over the dark pool, once their lamp is lit
    { a: 'wick', b: 'lantern', door: 'dU' },                         // its keepers' door onto the ledge round the stair to the root-wall's top, with its grille: a loop
    { a: 'lantern', b: 'gallery', door: 'd2' },                      // the Lamp Passage's door, past the chamber (one room with it)
    { a: 'gallery', b: 'galleryFar', door: 'br1' },
    { a: 'wick', b: 'wickKey', door: 'cW' },                         // its grille: both its lamps lit at once
    { a: 'galleryFar', b: 'lamp', door: 'd4' },
    { a: 'lamp', b: 'out', door: 'd5' },
  ],
  elements: {
    s1: { type: 'switch', room: 'pools' }, s2: { type: 'switch', room: 'pools' }, s3: { type: 'switch', room: 'loft' },
    d1: { type: 'door', opens: { all: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] }, latch: true },
    // (v1.77) the small pool, the pool-orb and its socket in the middle of the Root Stair's floor: the orb rolled through
    // the Hall of Dark Pools' door before
    s5: { type: 'switch', room: 'roots' },                            // the small pool by the orb: its light for the orb
    orb5: { type: 'drum', room: 'roots', plate: 'p5', plateAt: 1, start: 0 },   // a pool-orb, rolled to the socket
    p5: { type: 'plate', room: 'roots' },                             // the disc's socket
    l5: { type: 'switch', room: 'roots' },                            // the socket's lamp: it wakes to a glowing orb
    disc: { type: 'bridge', opens: { all: [{ lit: 's5' }, { drumOn: ['orb5', 'p5'] }, { lit: 'l5' }] }, latch: true },
    chest: { type: 'gadget', room: 'lantern', item: 'lantern' },
    l0: { type: 'switch', room: 'lantern', needs: ['lantern'] },     // the lamp by the dais: a try, nothing waits on it
    l1: { type: 'switch', room: 'lantern', needs: ['lantern'] },     // the passage's lamp that wakes to the lantern
    d2: { type: 'door', opens: { lit: 'l1' }, latch: true },   // (v1.49-1.59 the Kennel's small key too: since v1.60 the Wick Room's grille takes it)
    // the Kennel: its keepers beaten in the dark, the small key's cage sinks
    arK: { type: 'arena', room: 'kennel' },
    kS: { type: 'key', kind: 'small', room: 'kennel', when: { lit: 'arK' } },
    dK: { type: 'door', opens: null },
    br1: { type: 'bridge', opens: { item: 'lantern' } },             // moss-stones only its light shows
    s4: { type: 'switch', room: 'gallery', needs: ['lantern'] },     // an eye only its light shows, high on the near wall: seen from the far door, looking back
    orb: { type: 'drum', room: 'galleryFar', plate: 'p4', plateAt: 1, start: 0 },   // a pool-orb, rolled into the niche
    p4: { type: 'plate', room: 'galleryFar' },
    l2: { type: 'switch', room: 'galleryFar', needs: ['lantern'] },  // the niche's lamp: it wakes to the glowing orb
    d4: { type: 'door', lock: 'big', opens: { all: [{ lit: 's4' }, { drumOn: ['orb', 'p4'] }, { lit: 'l2' }] }, latch: true },   // (and the great key)
    // the Wick Room (v1.60: off the first hall, open and dark on the way in): the gallery's far door wants its great key,
    // behind a grille with a keyhole (the Kennel's small key, next door) that lifts only while both niches burn, so the
    // lantern is carried back down to it. Up a stair on its balcony, a keepers' door that opens with the grille, onto the
    // ledge round the Root Stair: the way back up. (After the gallery in this list: the marker sends you through the
    // gallery first, and back for the key)
    dU: { type: 'door', opens: { open: 'cW' }, latch: true },   // (the keepers' door goes with the grille)
    // two niches, two pool-orbs, one lantern. The grille over the great key lifts (for good) only while
    // both niches' lamps burn, and a niche's lamp burns only while its orb glows (`hold`: the orb's own time, its piece
    // puts it out): light one, roll it home, light the other and roll it home before the first goes dark
    lW1: { type: 'switch', room: 'wick', needs: ['lantern'], hold: WICK.lasts, when: { drumOn: ['oW1', 'pW1'] } },
    lW2: { type: 'switch', room: 'wick', needs: ['lantern'], hold: WICK.lasts, when: { drumOn: ['oW2', 'pW2'] } },
    oW1: { type: 'drum', room: 'wick', plate: 'pW1', plateAt: 1, start: 0 },
    pW1: { type: 'plate', room: 'wick' },
    oW2: { type: 'drum', room: 'wick', plate: 'pW2', plateAt: 1, start: 0 },
    pW2: { type: 'plate', room: 'wick' },
    cW: { type: 'door', lock: 'small', opens: { all: [{ lit: 'lW1' }, { lit: 'lW2' }] }, latch: true },   // (and the Kennel's small key: it goes in on the way in, and waits)
    kB: { type: 'key', kind: 'big', room: 'wickKey' },
    moth: { type: 'boss', room: 'lamp', needs: ['gun', 'lantern'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const LAMPLESS = {
  kind: 'organic', name: 'the Lampless', final: 'touch', touch: 'lay a hand on its back',
  speed: 3.4, wakeTime: 3,
  wake: 'Wings wide as sails open in the dark lamp-room. It is hungry for light.',
  openHint: 'It hangs low over the floor, turning, searching for light.',
  missHint: 'Its swoop went wide: it hangs low. Stand still by it with your lantern.',
  weary: 'It folds its wings and settles, lit with your light. Go to it.',
  resolved: 'The Lampless climbs to the lamp, and the whole room goes gold.',
  phases: [
    { to: 0.45, attacks: ['swoop', 'gust', 'dust'], pause: 1.6, hint: 'When it hangs low, stand still by it with your lantern: let it drink.' },
    { to: 0.75, attacks: ['flutter', 'scales', 'swoop'], pause: 1.3, hint: 'Stand still with it when it searches, or light a pool for it to drink.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'dodge', moves: ['flutter'], open: 4.0,
        hint: 'Hop clear as its wings beat down: overreached, it hangs low.',
        said: 'Its wings beat empty air. It hangs low, searching: stand still by it.',
        lines: ['Its wings beat at you.', 'Hop back from its fluttering wings just as they come down.', 'When it flutters at you, flip back (stick back and A / ×) as the wings fall; then stand still by it.'] } },
    { to: 0.9, attacks: ['spiral', 'scales', 'gust'], pause: 1.1, hint: 'It shies from you now: light a pool before it searches, and stand back.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    // (a swoop that misses you catches its wings on the floor: it hangs low longer, missHint; its dust beaten down runs
    // out along the floor in a ring you jump, as the Cloud-Mother's wail does: combat-v1.6)
    swoop: { shape: 'ring', at: 'player', radius: 4.2, wind: 1.5, track: 0.6, over: true, part: 'core', rig: 'rise', parts: ['body'], splash: 0.5, active: 0.45, damage: 0.75, knock: 9, recover: 0.9, open: 4.0, miss: 5.4 },
    gust: { shape: 'cone', range: 14, angle: 0.6, wind: 1.3, track: 0.6, part: 'wings', rig: 'lean', blast: { kind: 'front', r0: 2.5, h: 2.4 }, damage: 0.75, knock: 12, recover: 0.8 },
    dust: { shape: 'ring', at: 'self', radius: 8.5, wind: 1.4, part: 'wings', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.5 }, damage: 0.75, knock: 10, recover: 0.8, open: 3.4 },
    flutter: { shape: 'cone', range: 8, angle: 0.8, wind: 1.2, track: 0.7, part: 'wings', rig: 'lean', blast: { kind: 'front', r0: 2, h: 2.2 }, active: 0.3, gap: 0.75, damage: 0.5, knock: 9, recover: 0.5, then: 'flutter2' },
    flutter2: { shape: 'cone', range: 8, angle: 0.8, wind: 0.65, track: 0.6, part: 'wings', rig: 'lean', pose: 'flutter', link: true, blast: { kind: 'front', r0: 2, h: 2.2 }, active: 0.3, damage: 0.5, knock: 9, gap: 0.2, then: 'dustEnd' },
    dustEnd: { shape: 'ring', at: 'self', radius: 8.5, wind: 1.2, part: 'wings', rig: 'swell', pose: 'dust', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.5 }, damage: 0.75, knock: 10, recover: 0.8, open: 3.4 },
    scales: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'wings', rig: 'swell', damage: 0.5, knock: 6, recover: 0.7 },
    spiral: { shape: 'ring', at: 'player', radius: 4.2, wind: 1.4, track: 0.6, over: true, part: 'core', rig: 'rise', pose: 'swoop', parts: ['body'], splash: 0.5, active: 0.4, gap: 0.4, damage: 0.75, knock: 9, recover: 0.4, then: 'spiral2' },
    spiral2: { shape: 'ring', at: 'player', radius: 4.2, wind: 1.0, track: 0.6, over: true, part: 'core', rig: 'rise', pose: 'swoop', link: true, parts: ['body'], splash: 0.5, active: 0.45, damage: 0.75, knock: 9, recover: 0.9, open: 4.0, miss: 5.4 },
  },
};

/** How close it lets you be to a pool it goes down to (m), and how long it drinks there (s). */
export const LURE = { back: 5, drink: 1.2, speed: 8, reach: 1.2 };

/**
 * The Lamp-Room's three pools: dark until lit, by a splash (as the Hall of Dark Pools taught) or by your lantern held
 * by one a moment (its light carried there). A lit pool stays lit until the Lampless drinks it dark. o: { at: [[x, z]], y }
 */
class LurePools {
  constructor(rt, o) {
    this.rt = rt;
    const K = rt.kit, M = rt.M;
    this.list = o.at.map(([x, z], i) => {
      K.add(M.trim, T(annulus(1.6, 2.1, 0.16, 32), [x, o.y + 0.08, z]));
      const mat = makeMaterial({ color: PALETTE.glow, glow: 0.05, flat: true, key: `temple.p2.lure.${i}` });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.06, 28), mat);
      m.position.copy(K.world(x, o.y + 0.1, z));
      m.userData.noCollide = true; m.userData.dynamic = true;
      rt.root.add(m);
      const light = new THREE.Vector4(0, -1e5, 0, 0);
      rt.lights.push(light);
      const pool = { i, at: m.position.clone(), m, mat, light, lit: false, held: 0 };
      pool.off = registerTarget({ kind: 'switch', radius: 1.7, position: () => pool.at, onHit: (mode) => { if (mode !== 'push') this.light(pool); return true; } });
      return pool;
    });
    rt.lurePools = this;
  }
  light(p) {
    if (p.lit) return;
    p.lit = true;
    this.rt.sound?.chime?.();
    this.rt.notice?.('The pool takes the light and holds it, glowing.', 'lure.lit');
  }
  /** Drunk dark. */
  drain(p) { p.lit = false; }
  get lit() { return this.list.filter((p) => p.lit); }
  update(dt, t) {
    const P = this.rt.player, lantern = this.rt.logic.has('lantern');
    for (const p of this.list) {
      // your lantern held by a dark pool a moment: its light carried into it
      const near = P && lantern && !p.lit && Math.hypot(P.pos.x - p.at.x, P.pos.z - p.at.z) < 2.6 && Math.abs(P.pos.y - p.at.y) < 2;
      p.held = near ? p.held + dt : 0;
      if (p.held > 1.2) { p.held = 0; this.light(p); }
      p.mat.uniforms.uGlow.value = p.lit ? 0.8 + 0.12 * Math.sin(t * 3 + p.i) : 0.05 + 0.6 * Math.min(1, p.held / 1.2);
      if (p.lit) p.light.set(p.at.x, p.at.y + 1.5, p.at.z, 9); else p.light.set(0, -1e5, 0, 0);
    }
  }
  dispose() { for (const p of this.list) p.off(); }
}

function mothHit(g, part, mode) {
  if (mode === 'push') { g.add(-0.05, 'push'); g.rt.notice('It reels from the shove and flies higher, frightened.', 'moth.push'); return true; }
  g.rt.notice('The fluid beads on its fur. It does not want water: it wants light.', 'moth.fluid');
  return true;
}

/** The Kennel's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round the middle of the Kennel). */
export const ARENAS = [{
  el: 'arK', room: 'kennel', zone: KENNEL.zone, doors: ['dK'], extra: 2,
  shut: 'The door grinds shut behind you, and something in the dark of the kennel gets up.',
  won: 'The last of them goes still in the dark. The key’s cage sinks, and the door lets go.',
}];

/** A stone post under a lamp that stands in a floor (a LightEar's glass hangs 2.8 m over its foot): from y, solid. */
function lampPost(K, M, x, y, z) {
  K.both(M.trim, box(0.9, 0.3, 0.9, x, y + 0.15, z));
  K.both(M.wall, box(0.5, 1.9, 0.5, x, y + 1.25, z));
  K.both(M.trim, box(0.8, 0.2, 0.8, x, y + 2.3, z));
}

/**
 * The Kennel (east off the Hall of Dark Pools, an arena: where the keepers of the house's lamps were kept, dark; its door
 * shuts behind you while they stand round its middle among four columns, and won, the small key's cage sinks: for the
 * Wick Room's grille) and the Wick Room (v1.60: east off the hall too, north of the Kennel, beside the Root Stair; since
 * v1.77 the wick-house in its middle, a block of stone with two niches in its south face, a pool-orb in a groove before
 * each, and the great key behind a grille between them that lifts once both niches burn at once; a balcony high on its
 * west wall, at the end of the ledge of roots from the root-wall's top).
 */
function wings(rt, K, M, { root }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, Kn = KENNEL, Wk = WICK, KR = ROOMS.kennel, WR = ROOMS.wick, PO = ROOMS.pools;
  // ---- the Kennel
  K.corridor([PO.x1 + 1.2, Kn.z], [KR.x0 - 0.6, Kn.z], 0, { w: D.w, h: D.h });
  K.hall({ x: Kn.x, z: Kn.z, w: Kn.w, d: Kn.d, y: 0, h: KR.top, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, w: D.w, h: D.h }] });
  add(Door, { id: 'dK', at: [KR.x0 - 0.6, 0, Kn.z], yaw: Math.PI / 2, w: D.w, h: D.h });   // (open: it shuts behind you while they stand)
  // the keepers' old stalls along the north and south walls, a bar over each front; four columns round the middle to
  // fight round
  for (const zs of [KR.z0, KR.z1]) {
    const sg = zs === KR.z0 ? 1 : -1;
    for (const x of [29, 35, 41, 47, 53]) K.both(M.wall, box(0.4, 2.6, 3.6, x, 1.3, zs + sg * 1.8));
    for (const x of [32, 38, 44, 50]) K.both(M.trim, box(5.6, 0.3, 0.3, x, 2.45, zs + sg * 3.45));
  }
  for (const [x, z] of [[Kn.x - 6, Kn.z - 6], [Kn.x + 6, Kn.z - 6], [Kn.x - 6, Kn.z + 6], [Kn.x + 6, Kn.z + 6]]) K.column(x, z, 0, KR.top, 0.9);
  add(Key, { id: 'kS', at: [KR.x1 - 2.4, 0, Kn.z], yaw: -Math.PI / 2 });
  add(Mark, { room: 'kennel', at: [KR.x0 + 3, 0, Kn.z - 7], yaw: Math.PI / 2, foes: [Kn.x, 0, Kn.z] });

  // ---- the Wick Room (v1.60: east of the Root Stair, off the Hall of Dark Pools; v1.49 off the gallery's far side). Its
  // floor at the hall's, its way in from the hall's east wall; a stair up its north wall to a balcony on its west wall,
  // and from it a keepers' door through to a ledge of roots along the Root Stair's east wall, onto the root-wall's top: it
  // opens with the grille over the great key, the shortcut back up to the chamber
  const x0 = WR.x0, B = Wk.balcony, R = ROOT_WAY, F = Wk.face;
  K.corridor([PO.x1 + 1.2, Wk.door], [x0 - 0.6, Wk.door], 0, { w: D.w, h: D.h });
  K.corridor([ROOMS.roots.x1 + 1.2, R.z], [x0 - 0.6, R.z], R.y, { w: D.w, h: D.h });
  add(Door, { id: 'dU', at: [ROOMS.roots.x1 + 0.6, R.y, R.z], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 'lW1' }, { lit: 'lW2' }] });
  K.hall({ x: Wk.x, z: Wk.z, w: Wk.w, d: Wk.d, y: 0, h: Wk.h, roof: 'oculus', oculus: 0.2, doors: [{ side: 'w', at: Wk.door - Wk.z, w: D.w, h: D.h }, { side: 'w', at: R.z - Wk.z, w: D.w, h: D.h, y0: R.y }] });
  // the balcony under the way through from the roots, and the stair up the north wall to it; roots down the wall under it
  K.slab(x0, B[0], x0 + B[2], B[1], R.y, 0.8);
  const [sx0, sx1, sz] = Wk.stair;
  K.stairs([sx0, 0, sz], [sx1, R.y, sz], Wk.stairW);
  for (const [z, r] of [[B[0] + 1.6, 0.45], [B[0] + 6.4, 0.4]]) root([[x0 + 0.5, R.y - 0.9, z], [x0 + 0.9, R.y - 3, z + 0.6], [x0 + 0.4, R.y - 6, z - 0.4], [x0 + 0.8, 0, z + 0.3]], r);
  // the wick-house in the middle of the floor: two blocks of stone either side of the great key's alcove (its back wall,
  // its roof over the grille's 9 m), a niche in each block's south face with its lamp at the back; a pool-orb's groove
  // before each niche, down the middle of the room
  const [n0, n1] = Wk.niches, [g0, g1] = Wk.groove, cx = Wk.x, back = F + 8, HH = 11;
  for (const s of [-1, 1]) K.both(M.wall, box(5.5, HH, 8, cx + s * 6.25, HH / 2, F + 4));
  K.both(M.wall, box(7, 9, 0.8, cx, 4.5, back - 0.4));
  K.both(M.wall, box(7, HH - 9, 8, cx, 9 + (HH - 9) / 2, F + 4));
  K.both(M.trim, box(18.4, 0.5, 8.4, cx, HH + 0.25, F + 4));
  for (const [i, nx] of [n0, n1].entries()) {
    const id = `lW${i + 1}`, orb = `oW${i + 1}`, plate = `pW${i + 1}`;
    K.both(M.wall, [box(0.6, 3.2, 3.5, nx - 1.9, 1.6, F - 1.65), box(0.6, 3.2, 3.5, nx + 1.9, 1.6, F - 1.65), box(4.4, 0.8, 3.6, nx, 3.6, F - 1.7)]);
    add(LightEar, { id, at: [nx, -0.3, F - 0.7], reach: 0 });   // (reach 0: your lantern can't wake it; its orb does, while it glows)
    K.add(M.dark, box(1.0, 0.04, g1 - g0 + 0.6, nx, 0.02, (g0 + g1) / 2));
    for (const sd of [-1, 1]) K.both(M.trim, box(0.25, 0.12, g1 - g0 + 0.6, nx + sd * 0.75, 0.06, (g0 + g1) / 2));
    add(Ball, { id: orb, a: [nx, 0.04, g0], b: [nx, 0.04, g1], r: 0.9, lock: true, lamp: { id, reach: 2.8, hold: 2, lasts: Wk.lasts,
      woke: 'The glowing orb settles in the niche, and its lamp catches: for as long as the orb glows.',
      faded: 'The orb’s glow has gone out, and its niche’s lamp with it.' } });
    add(Plate, { id: plate, at: [nx, 0, g1], r: 1.0 });
  }
  // the great key in its alcove, behind the grille between the niches (a keyhole too: logic `lock`)
  add(Door, { id: 'cW', at: [cx, 0, F], w: D.w, h: D.h, lamps: [{ lit: 'lW1' }, { lit: 'lW2' }] });
  add(Key, { id: 'kB', big: true, at: [cx, 0, Wk.keyZ], yaw: Math.PI });
  // roots down the walls, and the old wick-stands along the south wall
  root([[WR.x1 - 0.5, Wk.h, Wk.z + 9], [WR.x1 - 0.9, 13, Wk.z + 10.5], [WR.x1 - 0.4, 6, Wk.z + 9.4], [WR.x1 - 0.8, 0, Wk.z + 10.2]], 0.55);
  for (const x of [x0 + 8, x0 + 15, x0 + 22]) { K.both(M.trim, box(0.5, 2.6, 0.5, x, 1.3, WR.z0 + 1.2)); K.both(M.wall, box(1.1, 0.25, 1.1, x, 2.725, WR.z0 + 1.2)); }
  add(Mark, { room: 'wick', at: [x0 + 3.5, 0, Wk.door + 4], yaw: Math.PI / 2 });
}

// ------------------------------------------------------------------ inside
// (since v1.77, issue #336, docs/design/temple-redesign.md: every hall 30 to 36 m across under 17 m of stone or more, the
// chamber's round hall 34 m, doors 7 by 9; each puzzle in the middle of its room, the one fight in the Kennel)
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR, R0 = ROOMS;
  const add = (P, o) => rt.add(P, o);
  const root = (pts, r) => K.both(M.stone, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), 16, r, 7, false));
  const hall = (r, o = {}) => { const [x, z] = mid(r); return K.hall({ x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, y: r.y, h: r.top - r.y, ...o }); };

  // ---- the Threshold
  const TH = R0.threshold;
  hall(TH, { roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.both(M.voidM, box(3.6, 5, 1.25, 0, 2.5, -0.625));   // (drawn and solid as one: from the doorway's face back to the wall's inner face)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-5, 0, 6.5], yaw: Math.PI / 2 });

  // ---- the Hall of Dark Pools: three pool-lamps, dark; splash each. Two on the floor, the third up on the loft of roots,
  // a block out from the west wall into the middle of the hall, its pool far enough back from the edge that the floor
  // never sees it
  const PO = R0.pools, [, pz] = mid(PO);
  hall(PO, { roof: 'oculus', oculus: 0.2, omit: ['n'], doors: [{ side: 's', w: D.w, h: D.h }, { side: 'e', at: KENNEL.z - pz, w: D.w, h: D.h }, { side: 'e', at: WICK.door - pz, w: D.w, h: D.h }] });   // (and east into the Kennel, v1.49, and the Wick Room, v1.60)
  for (const [x, z] of [[13, 22], [13, 48], [-13, 20], [-13, 48]]) K.column(x, z, 0, PO.top, 0.9);
  const poolM = makeMaterial({ color: '#2f3560', glow: 0.1, flat: true, key: 'temple.p2.pools' });
  const pool = (id, x, y, z, r = 2.0) => {
    K.both(M.trim, T(annulus(r, r + 0.6, 0.5, 32), [x, y + 0.5, z]));
    K.both(poolM, T(new THREE.CylinderGeometry(r, r, 0.1, 28), [x, y + 0.3, z]));
    add(Switch, { id, at: [x, y + 0.9, z], yaw: 0, size: 0.9 });
  };
  pool('s1', 7, 0, 29); pool('s2', -1, 0, 45);
  const LO = { x0: PO.x0 - 0.1, x1: -6.2, z0: 26, z1: 42, top: 8 }, [lox, loz] = mid(LO);
  K.climbable('the loft of roots: climbed from the Hall of Dark Pools\' floor to the third pool', () => {
    K.both(M.wallGlyph, box(LO.x1 - LO.x0, LO.top, LO.z1 - LO.z0, lox, LO.top / 2, loz));
    K.both(M.trim, box(LO.x1 - LO.x0 + 0.2, 0.3, LO.z1 - LO.z0 + 0.2, lox, LO.top + 0.05, loz));
    root([[LO.x1 + 0.1, 8, loz - 4.5], [LO.x1 + 0.4, 5, loz - 5.4], [LO.x1, 2, loz - 4.4], [LO.x1 + 0.3, 0, loz - 5.2]], 0.4);
    root([[LO.x1 + 0.1, 8, loz + 4.2], [LO.x1 + 0.5, 4, loz + 5.4], [LO.x1 + 0.1, 0, loz + 4.6]], 0.35);
  });
  pool('s3', -10.5, 8.2, loz, 1.5);
  add(Door, { id: 'd1', at: [0, 0, PO.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] });
  add(Mark, { room: 'pools', at: [11.5, 0, 18.5], yaw: -Math.PI / 2 });
  root([[PO.x0 + 0.4, PO.top - 0.5, 17], [PO.x0 + 1.4, 18, 18.5], [PO.x0 + 0.8, 12, 21]], 0.8);
  root([[PO.x0 + 0.6, PO.top - 0.5, 50], [PO.x0 + 1.5, 14, 47], [PO.x0 + 0.8, 4, 49], [PO.x0 + 1.2, 0, 51]], 0.8);
  root([[PO.x1 - 0.4, PO.top - 1, 42], [PO.x1 - 1.9, 16, 38], [PO.x1 - 0.8, 6, 34], [PO.x1 - 0.6, 0, 33]], 0.7);

  // ---- the Root Stair (a hall over a dark pool across its middle): the small pool and its pool-orb on the near floor,
  // the orb's groove to the socket whose lamp wakes the moss-stones sunk in the pool; then a root-wall to climb, its top
  // the landing at 9 under the chamber's door
  const RS = R0.roots, P0 = RS.z0 + RS.near, P1 = P0 + RS.pit, [, rz] = mid(RS), dy = RS.floor - RS.y;
  hall(RS, { floor: false, roof: 'oculus', oculus: 0.25, doors: [{ side: 's', w: D.w, h: D.h, y0: dy }, { side: 'n', w: D.w, h: D.h, y0: RS.wall - RS.y }, { side: 'e', at: ROOT_WAY.z - rz, w: D.w, h: D.h, y0: RS.wall - RS.y }] });   // (and east at 9 to the Wick Room's balcony, v1.60)
  K.slab(RS.x0, RS.z0, RS.x1, P0, RS.floor, dy);            // the near floor (its top at 0)
  K.both(M.dark, box(RS.x1 - RS.x0, 1, RS.pit, 0, RS.y - 0.5, (P0 + P1) / 2));
  const pool2 = makeMaterial({ color: '#2a2f58', glow: 0.18, flat: true, key: 'temple.p2.deep' });
  K.add(pool2, box(RS.x1 - RS.x0, 0.2, RS.pit, 0, -2.4, (P0 + P1) / 2));
  add(Pit, { room: 'roots', min: [RS.x0 - 1, RS.y - 2, P0], max: [RS.x1 + 1, -1.5, P1] });
  add(Bridge, { id: 'disc', a: [0, 0, P0 - 0.05], b: [0, 0, P1 + 0.05], w: 3.0, n: 6, glow: { color: '#8fd6a8', k: 0.5 } });   // moss-stones, sunk in the pool
  // the small pool beside the groove's start, the orb at rest by it, the socket and its lamp at the groove's end
  const OZ = RS.z0 + 11.6;
  pool('s5', -4.5, 0, OZ + 2.8, 1.3);
  K.add(M.dark, box(12.6, 0.04, 1.0, 0, 0.02, OZ));
  for (const sd of [-1, 1]) K.both(M.trim, box(12.6, 0.12, 0.25, 0, 0.06, OZ + sd * 0.75));
  add(Ball, { id: 'orb5', a: [-6, 0.04, OZ], b: [6, 0.04, OZ], r: 0.9, lock: true,
    lamp: { id: 'l5', reach: 0, pool: { id: 's5', at: [-4.5, 0.9, OZ + 2.8], reach: 4.6 }, hold: 2, lasts: 25,
      caught: 'The orb drinks the pool’s light and glows, for a while.',
      dark: 'The orb settles in the socket, dark, and the socket tips it back out. The disc’s lamp wants light.',
      woke: 'The glowing orb settles in the socket, and the disc’s lamp catches. The disc wakes.' } });
  add(Plate, { id: 'p5', at: [6, 0, OZ], r: 1.0 });
  lampPost(K, M, 7.6, 0, OZ);
  add(LightEar, { id: 'l5', at: [7.6, 0, OZ], reach: 0 });   // (the disc's lamp: only the glowing orb wakes it)
  // the root-wall across the far side, its top at 9: climb it (with the roots down its face: the house's climbs, its other
  // walls are not climbed, issue #115)
  K.climbable('the Root Stair\'s root-wall: climbed from the moss-stones to the landing at 9', () => {
    K.both(M.wallGlyph, box(RS.x1 - RS.x0, RS.wall - RS.y, RS.z1 - P1, 0, (RS.wall + RS.y) / 2, (P1 + RS.z1) / 2));
    root([[-6, 9, P1 - 0.2], [-5, 5, P1 - 0.3], [-6.2, 1, P1 - 0.25], [-6, -3, P1 - 0.3]], 0.45);
    root([[5, 9, P1 - 0.2], [6, 4, P1 - 0.3], [4.8, 0, P1 - 0.25], [5.4, -3, P1 - 0.3]], 0.45);
  });
  add(Mark, { room: 'roots', at: [-12, 0, RS.z0 + 4], yaw: Math.PI / 2 });
  // (v1.60) a ledge of roots along the east wall at the root-wall's height, to the keepers' door through it into the Wick Room
  { const [lx0, lz0, lx1, lz1] = ROOT_WAY.ledge;
    K.slab(lx0, lz0, lx1, lz1, ROOT_WAY.y, 0.6);
    root([[lx0 + 0.4, ROOT_WAY.y - 0.9, lz0 + 1.2], [lx0 + 1.1, ROOT_WAY.y - 3, lz0 + 0.6], [lx0 + 1.8, ROOT_WAY.y - 6.5, lz0 + 1.0]], 0.32); }
  root([[RS.x0 + 0.5, RS.top - 1, RS.z0 + 8], [RS.x0 + 1.4, 14, RS.z0 + 10], [RS.x0 + 0.7, 4, RS.z0 + 9], [RS.x0 + 1, 0, RS.z0 + 11]], 0.7);

  // ---- the corridor and the Lantern Chamber (floor 9, a dark round hall 34 m across): the chest in the middle; a lamp by
  // the dais to try the lantern on, and the Lamp Passage's lamp on a post by the way north (the passage the corridor
  // through the chamber's north wall since v1.77), whose door into the gallery wakes to it
  const LA = R0.lantern, C3 = LA.z;
  K.corridor([0, RS.z1 + 1.2], [0, C3 - LA.r - 0.4], 9, { w: D.w, h: D.h });
  K.rotunda({ x: 0, z: C3, y: LA.y, r: LA.r, h: LA.top - LA.y, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0 });
  K.both(M.trim, ...chestMound(0, 9, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  lampPost(K, M, -5.4, 9, C3 + 3.4);
  add(LightEar, { id: 'l0', at: [-5.4, 9, C3 + 3.4], reach: 3.6 });   // (a try: it wakes to the lantern, and nothing waits on it)
  lampPost(K, M, 4.6, 9, C3 + 8.6);
  add(LightEar, { id: 'l1', at: [4.6, 9, C3 + 8.6], reach: 3.0 });   // (off the way to the door: you go and stand by it)
  root([[-LA.r + 0.6, LA.top - 0.5, C3 - 6], [-LA.r + 1, 18, C3 - 4], [-LA.r + 0.5, 9, C3 - 5]], 0.45);
  root([[LA.r - 0.6, LA.top - 0.5, C3 + 3], [LA.r - 1, 17, C3 + 4.5], [LA.r - 0.5, 9, C3 + 3.6]], 0.4);
  add(Mark, { room: 'lantern', at: [8, 9, C3 - 6], yaw: -Math.PI * 0.75 });
  K.corridor([0, C3 + LA.r + 0.4], [0, R0.gallery.z0 - 0.6], 9, { w: D.w, h: D.h });   // (the Lamp Passage)

  // ---- the Dark Gallery: a chasm across its middle crossed by moss-stones only the lantern shows; an eye only it shows,
  // up on a post on the near floor (behind you as you cross, in sight from the far door); on the far floor the far door's
  // lamp in a niche, which wakes only to the light of a pool-orb: stand by the orb with the lantern till it glows, then
  // roll it (the push) down its groove into the niche before its glow fades. Rolled in dark, it wakes nothing
  const GA = R0.gallery, Q0 = GA.z0 + GA.near, Q1 = Q0 + GA.pit, [, gz] = mid(GA), gy = GA.floor - GA.y;
  add(Door, { id: 'd2', at: [0, 9, GA.z0 - 0.6], w: D.w, h: D.h, lamps: [{ lit: 'l1' }] });
  hall(GA, { floor: false, roof: 'oculus', oculus: 0.2, doors: [{ side: 's', w: D.w, h: D.h, y0: gy }, { side: 'n', w: D.w, h: D.h, y0: gy }] });
  K.slab(GA.x0, GA.z0, GA.x1, Q0, GA.floor, gy);
  K.slab(GA.x0, Q1, GA.x1, GA.z1, GA.floor, gy);
  K.both(M.dark, box(GA.x1 - GA.x0, 1, GA.pit, 0, GA.y - 0.5, gz));
  add(Pit, { room: 'gallery', min: [GA.x0 - 1, GA.y - 3, Q0], max: [GA.x1 + 1, 4, Q1] });
  add(Bridge, { id: 'br1', a: [0, 9, Q0 - 0.1], b: [0, 9, Q1 + 0.1], w: 3.4, n: 9, hidden: 'lantern' });
  const SZ = Q0 - 5;
  K.both(M.wall, box(2.4, 7.4, 1.0, 8, 12.7, SZ));
  K.both(M.trim, box(2.8, 0.4, 1.4, 8, 16.6, SZ));
  add(Switch, { id: 's4', at: [8, 15, SZ + 0.72], yaw: 0, size: 1.0, hidden: 'lantern' });   // (up on a post over the near floor, behind you as you cross; in sight from the far door)
  const NZ = Q1 + 4;
  K.both(M.wall, [box(0.8, 3.2, 4, -8.2, 10.6, NZ), box(3.6, 3.3, 0.6, -6.4, 10.65, NZ - 1.9), box(3.6, 3.3, 0.6, -6.4, 10.65, NZ + 1.9), box(3.8, 0.8, 4, -6.4, 12.65, NZ)]);
  add(LightEar, { id: 'l2', at: [-7.3, 8.7, NZ], reach: 0 });   // (reach 0: your lantern can't wake it; the orb does)
  K.add(M.dark, box(10.6, 0.04, 1.0, -0.8, 9.02, NZ));
  for (const sd of [-1, 1]) K.both(M.trim, box(10.6, 0.12, 0.25, -0.8, 9.06, NZ + sd * 0.75));
  add(Ball, { id: 'orb', a: [4.2, 9.04, NZ], b: [-6.2, 9.04, NZ], r: 0.9, lock: true, lamp: { id: 'l2', reach: 2.8, hold: 2, lasts: 25 } });
  add(Plate, { id: 'p4', at: [-6.2, 9, NZ], r: 1.0 });
  add(Door, { id: 'd4', at: [0, 9, GA.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 's4' }, { drumOn: ['orb', 'p4'] }, { lit: 'l2' }] });
  add(Mark, { room: 'gallery', at: [-7, 9, GA.z0 + 4], yaw: 0 });

  // ---- the antechamber, and the Lamp-Room (floor 9): a round hall, the great lamp dark in its cradle overhead
  const H0 = GA.z1 + 0.6;
  const AE = K.vestibule(H0, 9);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, 9, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = 19, CL = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CL, y: 9, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: ANTE.h }, { a: 0, w: D.w, h: D.h }], oculus: 0 });
  // the lamp's cradle: a ring of brass on chains, a great glass lamp in it, dark until the end
  K.add(M.trim, T(annulus(4.2, 5, 0.4, 40), [0, 9 + 20, CL]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; K.add(M.dark, box(0.12, 6, 0.12, Math.sin(a) * 4.6, 9 + 23, CL + Math.cos(a) * 4.6)); }
  const lampM = makeMaterial({ color: PALETTE.lamp, glow: 0.04, flat: true, key: 'temple.p2.lamp' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), lampM);
  lamp.position.copy(K.world(0, 9 + 18.2, CL));
  lamp.userData.noCollide = true; lamp.userData.dynamic = true;
  rt.root.add(lamp);
  rt.lampRoom = { lamp, lampM, light: null };
  // the way out, past the far door
  const X0 = CL + HR + 0.7, X1 = CL + HR + 10;
  add(Door, { id: 'd5', at: [0, 9, X0], w: D.w, h: D.h });
  K.slab(-4.6, X0 - 0.1, 4.6, X1, 9, 0.8);
  K.wall(-4.2, X0 + 0.7, -4.2, X1, 9, 10, { t: 0.8 }); K.wall(4.2, X1, 4.2, X0 + 0.7, 9, 10, { t: 0.8 });
  K.wall(4.2, X1, -4.2, X1, 9, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.2, 0.8, X1 - X0 + 0.4, 0, 19.4, (X0 + X1) / 2));
  K.both(M.voidM, box(3.4, 5, 0.9, 0, 11.5, X1 + 0.35));

  // three dark pools round the room: lit earlier, each lures the Lampless down to drink (LurePools; its id the guardian's:
  // the redesign's rules measure the Lamp-Room by them, scripts/temple-design/rules.mjs, the room has no mark)
  add(LurePools, { id: 'moth', y: 9, at: [[-10.5, CL - 6], [10.5, CL - 6], [0, CL + 12]] });

  const model = mothModel();
  model.pos.copy(K.world(0, 9, CL + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 9, CL + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 9, CL), r: HR, y: K.world(0, 9, 0).y };

  // (the wings last: their marks after the others)
  wings(rt, K, M, { root });
  const W = (x, y, z) => K.world(x, y, z), KR = R0.kennel, WR = R0.wick;
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(R0.pools.x0 - 6, -10, -3), V(WR.x1 + 6, 40, X1 + 2)),
    gadget: { at: W(0, 9.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 9.5, X1 - 0.4), r: 1.5 }],
    // dim: the house is dark (the pools and the lantern light it)
    // (lower and wider since the visual pass: each a warm pool on the flags, lampTint, as the picked hall's lamps lay them)
    lights: [[0, 3.5, 7, 12], [4, 4, 26, 16], [-2, 4, 44, 16], [0, 4, RS.z0 + 9, 16], [0, 12, RS.z1 - 6, 14], [0, 12, C3, 16], [0, 12, GA.z0 + 9, 15], [0, 12, GA.z1 - 9, 15],
      [KENNEL.x, 4, KENNEL.z, 18], [WICK.x, 4, WICK.groove[0], 16], [WICK.x, 4, WICK.keyZ, 10], [WR.x0 + 4, 12, WICK.balcony[0] + 6, 10], [0, 12.5, CL, 17]],
    guardian: { def: { ...LAMPLESS, onHit: mothHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Lamp-House in the shallows
function exterior(scene, level, rt) {
  const yaw = SITE.heading, base = -2.5, R = 9;
  const K = new TempleKit(rt.root, 'The Lamp-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, door = 3.4;   // (the door's sill, above the water on a stone apron)
  landmark(K, 'perdide2', { y: door, R });
  const crown = door + LAMP_CROWN_LIFT;
  const glassM = glazing('#ffd18b', K.world(0, crown + 46, 0));
  K.both(glassM, lathe([[6.15,crown+39],[6.15,crown+49.8],[5.7,crown+51.5],[4.6,crown+53.3]],64));
  const brass = metal('#b18346');
  K.both(brass, lathe([[.01,crown+39],[4.6,crown+39],[3.3,crown+40],[2,crown+41]],40));
  K.both(brass, lathe([[3.5,crown+51],[4.6,crown+52],[.01,crown+52]],40));
  // the doorway on the apron, toward the causeway
  const z0 = R - 0.6, z1 = R + 3;
  for (const s of [-1, 1]) K.both(M.wall, box(3.4, 9, z1 - z0, s * 3.9, door + 4.5, (z0 + z1) / 2));
  K.both(M.wall, box(4.4, 2.4, z1 - z0, 0, door + 8.2, (z0 + z1) / 2));
  K.both({ paint: new THREE.Color(PALETTE.accent), smooth: false, side: THREE.FrontSide }, box(11, 1, 1.2, 0, door + 9.6, z1 + 0.1));
  K.both(M.voidM, box(4.3, 7, 0.9, 0, door + 3.5, R + 0.85));   // (drawn and solid as one: the dark of the doorway, back to the tower's wall)
  K.both(M.stone, box(5.8,door+1,11,0,(door-1)/2,R+4));
  // the causeway: flat stones from the apron to the end of the lit path
  const pathL = K.local(V(SITE.path[0], 0, SITE.path[1]));
  const n = Math.ceil(Math.hypot(pathL.x, pathL.z - R - 7) / 3.8);
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n, z = R + 7 + (pathL.z - (R + 7)) * k, x = pathL.x * k;
    const top = THREE.MathUtils.lerp(door, 0.6 - base, k);
    K.both(M.stone, T(new THREE.CylinderGeometry(2.2, 2.4, top + 1.2, 10), [x, (top - 1.2) / 2, z]));
  }
  K.flush();
  const glassWashes = glaze(K, rt.veils, glassM, { color: '#ffae52', alpha: .26, glow: .45 });
  // A small pilot burns within a glass chimney. Restoring the house feeds the
  // full lamp and its sweeping beam, rather than turning a solid ball yellow.
  const lampM = makeMaterial({ color: '#ffb34f', glow: .72, hatch: 0, key: 'temple.p2.outlamp' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1,32,24).scale(3.3,5.2,3.3), lampM);
  lamp.position.copy(K.world(0, crown + 45.6, 0));
  lamp.userData.noCollide = true; lamp.userData.dynamic = true;
  rt.root.add(lamp);
  const at = K.world(0, door, R + 2.2);
  return { door: { at, heading: yaw }, kit: K, base, doorY: base + door, R, lamp, lampM, glassM, glassWashes, top: base + door + 56 + LAMP_CROWN_LIFT, clear: [{ x: SITE.x, z: SITE.z, r: 44 }] };
}

// ------------------------------------------------------------------ the world change: the lamp burns again
/**
 * Once the Lampless is calm the Lamp-House's lamp burns again: gold in its
 * glass room, a light on the water round the tower, and a long beam turning
 * slowly over the wood. Inside, the lamp-room's great lamp glows.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  // the beam: a soft shaft of light from the lamp out over the wood, washes over the finished picture (src/veil.js
  // LightShaft, the skull cave's way: issue #116; it was a solid glowing cone, inked)
  const beam = O ? new LightShaft(rt.veils, rt.root, { color: '#ffe2b0', alpha: [0.14, 0.17], near: 4 }) : null;
  if (beam) beam.visible = false;
  const tip = new THREE.Vector3(), pilotColor = new THREE.Color('#ffb34f'), fullColor = new THREE.Color('#fff1bb');
  const light = new THREE.Vector4(0, -1e5, 0, 0);
  rt.lights.push(light);
  let k = 0, want = 0;
  return {
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; },
    update(dt, t) {
      k += (want - k) * Math.min(1, dt / 4);
      const on = k > 0.02;
      if (O) {
        O.lampM.uniforms.uGlow.value = .72 + .28 * k * (.96 + .04 * Math.sin(t * 3));
        O.lampM.uniforms.uColor.value.copy(pilotColor).lerp(fullColor, k);
        for (const wash of O.glassWashes) wash.material.uniforms.uWash.value.y = .45 + .5 * k;
        beam.visible = on;
        // (turning slowly, a little over the level: 140 m out, 9 m across at its end)
        const a = t * 0.25;
        tip.set(-Math.cos(0.08) * Math.cos(a), Math.sin(0.08), Math.cos(0.08) * Math.sin(a)).multiplyScalar(140).add(O.lamp.position);
        if (on) beam.set(O.lamp.position, 0.4, tip, 9).fade(k);
        light.set(O.lamp.position.x, O.lamp.position.y, O.lamp.position.z, 18 + 82 * k);
      }
      const L = rt.lampRoom;
      if (L) {
        L.lampM.uniforms.uGlow.value = 0.04 + 0.96 * k;
        if (on && !L.light) { L.light = new THREE.Vector4(L.lamp.position.x, L.lamp.position.y, L.lamp.position.z, 40); rt.lights.push(L.light); }
      }
    },
  };
}

export const PERDIDE2_TEMPLE = {
  id: 'perdide2', levelId: 'perdide2', name: 'The Lamp-House', doorLabel: 'door of the Lamp-House',
  gadget: 'lantern', gadgetBox: 'perdide2.temple.lantern', arenaDoor: 'd4', arenas: ARENAS, dark: true,
  origin: [-140 + OX, 1800, -300 + OZ], yaw: 0,   // (its rooms over the wood, where they always were from it: names.js PART_OFFSET)
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (its futuristic skin, issue #342: the look of the author's pick over the same rooms, src/temples/skins/lamp-house.js)
  skin: (rt) => lampHouseSkin(rt, { rooms: ROOMS }),
  local: { person: 'briony', out: 33, side: 2 },
  enterLine: 'Inside the Lamp-House it is very dark, and it smells of moss and old oil. Somewhere above, wings.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out over the wood, the Lamp-House’s lamp catches and its beam turns.', 'resolved.out'); },
  // the Lampless drinks the lantern's light: stand still by it while it hangs low, searching; or a pool lit earlier
  // lures it down to drink there (its last phase: only a pool, and only while you stand back)
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    let still = 0, drink = 0, lured = null, luredFor = 0;
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      const P = rt.player;
      if (!P || G.state !== 'open') { still = 0; drink = 0; lured = null; luredFor = 0; return; }
      const last = G.phaseIndex >= 2, m = G.model;
      // a lit pool lures it as it searches: it drifts down to the nearest and drinks (in its last phase, if you stand back)
      const pools = rt.lurePools?.lit ?? [];
      if (!lured && pools.length) lured = pools.slice().sort((a, b) => a.at.distanceToSquared(m.pos) - b.at.distanceToSquared(m.pos))[0];
      if (lured && !lured.lit) lured = null;
      if (lured) {
        luredFor += dt;
        if (luredFor < 7) G.openFor = Math.max(G.openFor ?? 0, G.t + 0.6);   // (it searches on while it drifts there)
        const over = Math.hypot(m.pos.x - lured.at.x, m.pos.z - lured.at.z) < LURE.reach;
        if (!over) {
          // (straight there: in the open it would turn back to you)
          const dx = lured.at.x - m.pos.x, dz = lured.at.z - m.pos.z, d = Math.hypot(dx, dz), step = Math.min(d, LURE.speed * dt);
          m.pos.x += (dx / d) * step; m.pos.z += (dz / d) * step;
          m.heading = Math.atan2(dx, dz);
          G.keepIn();
        }
        rt.notice('It turns from you to the lit pool, and drifts down to it.', 'moth.lured');
        const close = Math.hypot(P.pos.x - lured.at.x, P.pos.z - lured.at.z) < LURE.back;
        if (over && close && last) { drink = 0; rt.notice('It hangs over the pool, but won’t drink while you stand by it.', 'moth.back'); return; }
        if (over && (drink += dt) > LURE.drink) {
          drink = 0;
          rt.lurePools.drain(lured); lured = null;
          G.add(0.15, 'pool');
          rt.sound?.chime?.();
          rt.notice('It drinks the pool dark, and its glyphs glow with the light.', 'moth.drank');
          if (G.state === 'open') { G.enter('fight'); G.cool = 2; }
        }
        return;
      }
      const near = Math.hypot(P.pos.x - m.pos.x, P.pos.z - m.pos.z) < 8;
      const quiet = Math.hypot(P.vel.x, P.vel.z) < 0.4 && !P.down;
      if (last) { if (near) rt.notice('It shies from you: it comes down only to a light left for it.', 'moth.shy'); still = 0; return; }
      if (near && quiet && rt.logic.has('lantern')) {
        if ((still += dt) > 1.4) {
          still = 0;
          G.add(G.phaseIndex === 0 ? 0.15 : 0.15, 'light');
          rt.sound?.chime?.();
          if (G.state === 'open') { G.enter('fight'); G.cool = 2; }
        }
      } else {
        if (near && !quiet) rt.notice('It flinches from your movement. Be still.', 'moth.still');
        still = 0;
      }
    };
  },
};
