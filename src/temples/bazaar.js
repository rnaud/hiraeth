import { landmark } from './landmarks.js';
import { portal } from './portal.js';
import { stone as lmStone, ceramic as lmCeramic, metal as lmMetal, pearl as lmPearl } from './landmark-materials.js';
import * as THREE from 'three';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Platform, Bridge, Pillars, EchoStone, EchoEar, Dish, Mark, Pit, Key } from './pieces.js';
import { signModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { undertowerSkin } from './skins/undertower.js';

// The Signal Market's temple: the Undertower, the foundations of the silent
// tower, "here before the market". The makers built the first sign of all
// here: a machine to say one line into the dark, over and over, for whoever
// was listening. The market grew up round it and built its towers on top, and
// forgot it; only the silent tower stands right over it. The night the sky
// rang it stuck on one word of its line, and has said nothing else since:
// under the square at night you can hear it, if you put your ear to the stones.
//
// One idea runs through it (reworked from the temple design audit, docs/audits/temple-design-v1.12.md): a note
// travels. The makers' dishes carry it across a hall, the echo shell carries it in your pocket, and the shell
// holds one note at a time, so what goes where first is the puzzle.
//
// Since v1.77 (issue #336, docs/design/temple-redesign.md) its rooms are shrines: every hall 30 to 36 m across under 18 m
// of stone or more, doors 7 by 9 (ROOMS, DOOR), each puzzle in the middle of its own room, the one fight in the Cable Store.
//
// Inside (built far overhead, through the old doorway in the tower's back):
//   the Threshold        the first mark, the way out
//   the Hall of Dishes   no way over the cable pit: the makers' pillars stand down in the dark, and rise only for a
//                        horn on the far landing that hears a stone's own song, too far for any note sung on this
//                        side. A singing ball rolls in a groove to the footstone of a great dish (its weight wakes
//                        the dish); splashed there, its note comes out of the dish's twin over the horn, and the
//                        pillars rise out of the cable (push + shot, and the dishes: a note travels, and a note
//                        raises the way; taught where failing is free)
//   the Cable Well       the hub (v1.48, issue #23): two discs up; the second waits for the horn on the ledge, which
//                        listens for the low stone on the floor (its ring is the low note's colour; the high stone
//                        beside it is not its note); the door from the landing into the Shell Chamber takes two small keys:
//   the Cable Store      (west, down a cable tunnel under the Choir: the house's one fight, an arena) the makers' spare
//                        cable on drums; its door shuts behind you while its keepers stand round its middle
//   the Tuning Room      (east) a pair of dishes across the room: the near one deaf until a ball (its groove down the
//                        middle of the room) is on its footstone, a low and a high stone by its mouth; the far horn,
//                        too far for either alone, wants the high one
//   the Shell Chamber    the makers' chest: the RECALL HOURGLASS (src/gadgets/recall.js; issue #377: the echo shell, a
//                        tool for this house alone, was here, and is folded into it: its sand keeps the last note sung
//                        near you, and turned on the air, or with Y / △, gives it back: src/echo-shell.js). Its north door
//                        sinks for the shell in your hand (v1.77); a low singing stone stands by the dais: splash it, and the shell keeps its note. A
//                        second hub (v1.60): north the Listening Passage, west the Choir
//   the Choir            (v1.60, west off the chamber, over the Cable Store; v1.49 off the gallery's far side) two horns
//                        and the great key caged between them: the far one hears only a stone's own low song, through
//                        a pair of dishes (a ball on the near one's footstone, the low stone by its mouth), and its
//                        answer opens the keepers' gate onto a walk round the Cable Well at 12: a loop back to the hub.
//                        The near one wants the middle note played back, and nothing in the Choir sings it: the singing
//                        ball in the Hall of Dishes does, down the well and back up with the shell in your pocket (or
//                        the gallery's middle egg, past the passage's door). The shell keeps the last note it heard: the
//                        low stone sung by the near dish is caught too. The great key opens the far door
//   the Listening Passage a room on: the door into the gallery listens for the low note through its horn, and
//                        nothing sings it here. Carry it from the chamber's stone (or the Cable Well's), and play it
//                        back by the horn (the shell's first lock, where failing costs nothing). Since v1.49 the horn
//                        is deaf until a ball is on its footstone, a groove's length from the way in (the shell with
//                        the push)
//   the Gallery of Voices the key hall: three singing eggs of three sizes on plinths, and the pillars down in the
//                        chasm's dark, each with a little horn of the high note's colour: a pillar rises while the
//                        high note, played back near it, still rings (v1.74, issue #23: until then one great horn at
//                        the edge raised them all). So the note is carried over: play it at the edge, step out, play
//                        it again, and the pillars ahead rise as you go; they wait for whoever stands on them. The far
//                        door listens through a dish over it, whose twin, low on this side's wall, wakes with a ball
//                        on its footstone. Send the middle note over through the dish first, then carry the high one
//                        across. Crossing first strands the middle note on this side: a high stone on the far side
//                        gives the high note again for the way back
//   the First Sign's Hall the guardian (a robot: its meter is damage, which here is retuning). It cries its
//                        one word; when it lowers its dish to listen, play its word back into it, and it moves on
//                        to the next word of its line. Its cables run out to the dishes round the hall's wall: two
//                        low dishes, east and west, carry a word played into them up to their twins, and down the
//                        cables to it (taught in its second phase; in its last it turns its dish up to the dark and
//                        hears only through them)
// After: the silent tower speaks, once a night, the whole line, in the First Sign's voice (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** The old doorway in the silent tower's back (the side away from the square's front), looking south down the avenue's end. */
export const SITE = { x: 0, z: -267, r: 8, heading: Math.PI, tower: { x: 0, z: -255, top: 98 } };

/**
 * The Undertower's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/undertower):
 * blue-grey masonry in heavy blocks, its frames the same stone (no more brass frames: brass is for the horns and
 * fittings), grey flagstones, a darker course under every frieze and at the foot, slots of the market's coral and teal
 * light by turns under the friezes; its shade a deep blue, its light the lamps' warm.
 */
export const PALETTE = {
  wall: '#61748b', wall2: '#596c83', wall3: '#6a7d94', floor: '#9c998f', floor2: '#8e8b81', trim: '#71859b', fitting: '#c99758', strata: 1.8,
  dark: '#3a535b', stone: '#88b4b5', accent: '#f0a083', glow: '#fff0bd', glyph: '#ffd9a0', lamp: '#ffe3aa', sand: '#a4c1be', sand2: '#94b1ae', void: '#243e59',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.8, lampTint: ['#f0c890', 0.7] },
    wall: { mode: 0, grid: 1.5, plates: true },
    floor: { mode: 0, grid: 1.8, plates: true },
    glyph: { glow: 0.6 },
  },
  bands: [{ at: 0.72, h: 1.2, color: '#506279' }, { y: 0.4, h: 0.8, color: '#506279' }],
  ornament: { kind: 'slot', color: '#f0a083', color2: '#7fd6cf', glow: 0.85 },
  light: { shadow: '#46527c', light: '#ffe9cc', sun: '#ffd9a8' },
};

/** The First Sign's line, a word (or two) at a time; each is a note of its own (the echo shell keeps one). */
export const LINE = ['SOMEBODY', 'OUT THERE', 'IS TALKING', 'TO YOU'];
const WORD_DEGREES = [1, 3, 5, 6];
const LISTEN = 14;   // m: how close to its dish a played-back word has to be
/** The low dishes on the First Sign's hall's wall: what is played into one reaches it down its cables, from anywhere. */
export const SIGN_DISHES = ['signDishW', 'signDishE'];
/** How long a gallery pillar stands after it last heard the high note (s), and how near it (m, across the floor). */
export const HOLD = { pillar: 6, reach: 6.5 };

export const LOGIC = {
  id: 'bazaar', entry: 'threshold', gadget: 'recall',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a fight;
  // src/foes.js places machines only in a fight's room: scripts/temple-design/rules.mjs, tests/temple-rules.test.js. The
  // Shell Chamber holds the shell alone; the Listening Passage past its open way is a room of its own since v1.77)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, dishes: { checkpoint: true, kind: 'puzzle' }, dishesFar: { kind: 'puzzle' }, well: { checkpoint: true, kind: 'puzzle' },
    store: { checkpoint: true, kind: 'combat' }, tune: { checkpoint: true, kind: 'puzzle' }, landing: { kind: 'passage' }, shell: { checkpoint: true, kind: 'chest' },
    listen: { checkpoint: true, kind: 'puzzle' }, gallery: { checkpoint: true, kind: 'puzzle' }, galleryFar: { checkpoint: true, kind: 'puzzle' }, choir: { checkpoint: true, kind: 'puzzle' },
    hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'dishes' },
    { a: 'dishes', b: 'dishesFar', door: 'disc' },    // the pillars over the cable pit, once their horn has heard the ball
    { a: 'dishesFar', b: 'well' },
    // the Cable Well is the hub (v1.48): west the Cable Store (an arena), east the Tuning Room; the door from the landing
    // into the Shell Chamber wants a small key from each
    { a: 'well', b: 'store', door: 'dW' },            // (open: it shuts behind you while its keepers stand)
    { a: 'well', b: 'tune' },
    { a: 'well', b: 'landing', door: 'wdisc' },       // the second disc up the well, once its horn has heard the low stone
    { a: 'landing', b: 'shell', door: 'dK' },         // two small keys
    // the Choir (v1.60, issue #23): over the Cable Store, the great key in it. Its keepers' gate opens off a walk round the
    // Cable Well at 12, one floor with the landing, for the middle note; its door onto the Shell Chamber goes with the
    // gate (one machine), so once it is open the two hubs are a loop
    { a: 'landing', b: 'choir', door: 'dG' },
    { a: 'shell', b: 'choir', door: 'dC' },
    { a: 'shell', b: 'listen', door: 'dL' },          // the chamber's north door, for the shell in your hand (v1.77: the Listening Passage a room of its own)
    { a: 'listen', b: 'gallery', door: 'd3' },         // the Listening Passage's door
    { a: 'gallery', b: 'galleryFar', needs: ['recall'] },   // the listening pillars: the high note carried over (v1.74)
    { a: 'galleryFar', b: 'hall', door: 'd4' },        // (and the great key)
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    ball1: { type: 'drum', room: 'dishes', plate: 'p1', plateAt: 1, start: 0 },   // the singing ball, onto the dish's footstone
    p1: { type: 'plate', room: 'dishes' },
    eD: { type: 'switch', room: 'dishes' },                           // the horn across the pit: a stone's own song, through the dishes
    disc: { type: 'bridge', opens: { all: [{ drumOn: ['ball1', 'p1'] }, { lit: 'eD' }] }, latch: true },
    eW: { type: 'switch', room: 'well' },                             // the horn on the ledge: the low stone's own song
    wdisc: { type: 'bridge', opens: { lit: 'eW' }, latch: true },
    // the Cable Store: its keepers beaten, the small key's cage sinks
    arW: { type: 'arena', room: 'store' },
    kW: { type: 'key', kind: 'small', room: 'store', when: { lit: 'arW' } },
    dW: { type: 'door', opens: null },
    // the Tuning Room: the ball on the near dish's footstone, the high stone sung by its mouth, the far horn hears it
    ballT: { type: 'drum', room: 'tune', plate: 'pT', plateAt: 1, start: 0 },   // (its groove down the room since v1.77: it ran in from the well)
    pT: { type: 'plate', room: 'tune' },
    eT: { type: 'switch', room: 'tune' },
    kE: { type: 'key', kind: 'small', room: 'tune', when: { all: [{ drumOn: ['ballT', 'pT'] }, { lit: 'eT' }] } },
    dK: { type: 'door', lock: 'small', keys: 2, latch: true },
    // (issue #377: the chest held the echo shell, a tool for this house alone; the recall hourglass now, the market's own
    // tool, whose sand keeps the last note sung near you and gives it back, turned on the air or with Y / △: src/echo-shell.js)
    chest: { type: 'gadget', room: 'shell', item: 'recall' },
    dL: { type: 'door', opens: { item: 'recall' }, latch: true },
    // the passage's horn: the low note, carried from the chamber's stone; since v1.49 deaf until a ball's weight is on its
    // footstone (the shell with the push)
    ballP: { type: 'drum', room: 'listen', plate: 'pP', plateAt: 1, start: 0 },
    pP: { type: 'plate', room: 'listen' },
    e0: { type: 'switch', room: 'listen', needs: ['recall'], when: { drumOn: ['ballP', 'pP'] } },
    d3: { type: 'door', opens: { lit: 'e0' }, latch: true },
    ball2: { type: 'drum', room: 'gallery', plate: 'p2', plateAt: 1, start: 0 },  // onto the near dish's footstone
    p2: { type: 'plate', room: 'gallery' },
    // (the pillars over the chasm hear the high note played back near them, each for itself: pieces.js Pillars, v1.74; there
    // were a great horn at each edge, e1 and e3, that held it and raised them all, br1)
    e2: { type: 'switch', room: 'galleryFar', needs: ['recall'] },     // the middle note, said by the dish over the far door
    d4: { type: 'door', lock: 'big', opens: { all: [{ drumOn: ['ball2', 'p2'] }, { lit: 'e2' }] }, latch: true },   // (the arena's door too: it shuts behind you; and the great key)
    // the Choir (v1.60: over the Cable Store; v1.49 off the gallery's far side). Its keepers' gate, off the walk round
    // the Cable Well at 12, listens through a horn back in the first hall: its cable runs from the gate down the well's
    // wall and along the floor to the Hall of Dishes' far landing, where the horn wants the middle note played back (the
    // singing ball sings it across the pit, and its dish brings it over). Its door onto the Shell Chamber goes with the
    // gate. Inside, two horns and the great key caged between them. The far one hears the low stone's own song through a
    // pair of dishes (a ball on the near dish's footstone). The near one wants the high note played back, and nothing in
    // the Choir sings it: the Cable Well's high stone does, on the floor below the gate.
    // (After the gallery in this list: the marker sends you through the gallery, and back for the far door's key)
    hG: { type: 'switch', room: 'dishesFar', needs: ['recall'] },     // (the gate's horn, at its cable's far end)
    dG: { type: 'door', opens: { lit: 'hG' }, latch: true },
    dC: { type: 'door', opens: { open: 'dG' }, latch: true },   // (the Choir's door goes with its gate: one machine)
    hA: { type: 'switch', room: 'choir', when: { drumOn: ['ballQ', 'pQ'] } },   // (it hears only through the dish, awake with the ball home)
    ballQ: { type: 'drum', room: 'choir', plate: 'pQ', plateAt: 1, start: 0 },
    pQ: { type: 'plate', room: 'choir' },
    hB: { type: 'switch', room: 'choir', needs: ['recall'] },
    kB: { type: 'key', kind: 'big', room: 'choir', when: { all: [{ lit: 'hA' }, { lit: 'hB' }] } },
    sign: { type: 'boss', room: 'hall', needs: ['gun', 'recall'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const FIRST_SIGN = {
  kind: 'robot', name: 'the First Sign', final: 'break', speed: 1.4, wakeTime: 3.0,
  wake: 'A makers’ mast lifts its great dish, turns to you, and cries one word.',
  openHint: 'It lowers its dish, listening: play its word back into it.',
  resolved: 'The First Sign says its whole line once, quietly, and listens.',
  phases: [
    { to: 0.5, attacks: ['cry', 'beam', 'static'], pause: 1.6, hint: 'When it lowers its dish to listen, play its word back into it.' },
    { to: 0.75, attacks: ['beam', 'stutter', 'static'], pause: 1.2, hint: 'A new word: catch it, then play it into its dish or a low wall dish.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'dodge', moves: ['beam'], open: 4.4,
        hint: 'Hop clear of its beam as it fires: overreached, it lowers its dish.',
        said: 'Its beam burns past you. It lowers its dish to listen: play its word back.',
        lines: ['Its beam searches for you.', 'Hop aside from its beam just as it fires: it lowers its dish.', 'When its dish glows to fire, flip back (stick back and A / ×) as the beam comes; then turn the hourglass ({key:fire}) to give its word back.'] } },
    { to: 1.0, attacks: ['statics', 'stutter', 'beam'], pause: 1.0, hint: 'It hears only through its cables now: play its word into a wall dish.' },
  ],
  attacks: {
    cry: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'mouth', rig: 'lean', wave: { speed: 10, reach: 18, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 12, recover: 0.9, open: 4.4 },
    beam: { shape: 'lane', range: 28, width: 2.6, wind: 1.4, track: 0.7, part: 'mouth', blast: { kind: 'beam', r: 0.75 }, gap: 0.4, damage: 0.75, knock: 10, recover: 0.6, then: 'sweep' },
    sweep: { shape: 'cone', range: 22, angle: 0.8, wind: 1.0, track: 0.5, part: 'mouth', rig: 'coil', pose: 'beam', side: 1, link: true, blast: { kind: 'beam', r: 0.75, sweep: 0.8 }, damage: 0.75, knock: 10, recover: 0.8 },
    static: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.2, wind: 1.4, track: 0.6, part: 'mouth', pose: 'cry', damage: 0.75, knock: 8, recover: 0.6 },
    statics: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'mouth', pose: 'cry', damage: 0.5, knock: 6, recover: 0.6 },
    stutter: { shape: 'ring', at: 'self', radius: 5.5, wind: 1.2, part: 'mouth', rig: 'swell', pose: 'cry', blast: { kind: 'front', r0: 1.5, h: 0.8 }, gap: 0.75, damage: 0.5, knock: 9, recover: 0.4, then: 'stutter2' },
    stutter2: { shape: 'ring', at: 'self', radius: 5.5, wind: 0.65, part: 'mouth', rig: 'swell', pose: 'cry', link: true, blast: { kind: 'front', r0: 1.5, h: 0.8 }, damage: 0.5, knock: 9, gap: 0.25, then: 'cryEnd' },
    cryEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'mouth', rig: 'lean', pose: 'cry', link: true, wave: { speed: 10, reach: 18, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 12, recover: 0.9, open: 4.4 },
  },
};

function signHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rings off its mast.', 'fs.push'); return true; }
  g.rt.notice('The fluid rattles off its dish. It is listening for its word.', 'fs.fluid');
  return true;
}

// ------------------------------------------------------------------ the rooms (v1.77, issue #336)
/**
 * The house's doors (m: issue #336, 5 by 6.4 before) and its rooms in the kit's local frame (z into the house): each
 * hall's floor from wall to wall (its walls stand outside it), its floor's height and its ceiling's; the round halls'
 * middles and radii. The Hall of Dishes and the Gallery of Voices stand on their pits' floors (`y`), their landings at
 * `floor` (`near` the near landing's depth, `pit` the pit's; the far landing the rest). The props in them (the balls,
 * the dishes, the stones, the horns, the discs, the pillars), the pits and every groove as long as they were, so every
 * timing and every jump holds.
 */
export const DOOR = { w: 7, h: 9 };
/**
 * The great lock into the antechamber (d4): 6 by 9, the narrowest the rules allow. (The antechamber is the camera QC's
 * close room, scripts/camera-qc/sim-lock.mjs: the close camera reads the room through the doorway, and at 7 m it read the
 * room wide and was pulled in off its west wall in one frame, tests/camera-qc-lock.test.js.)
 */
export const LOCK = { w: 6, h: 9 };
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 14, y: 0, top: 12 },
  dishes: { x0: -18, x1: 18, z0: 15.2, z1: 67.2, y: -8, floor: 0, top: 20, near: 18, pit: 16 },
  well: { x: 0, z: 88, r: 17, y: 0, top: 28 },
  store: { x0: -85, x1: -55, z0: 73, z1: 103, y: 0, top: 18 },
  tune: { x0: 21, x1: 51, z0: 73, z1: 103, y: 0, top: 18 },
  shell: { x: 0, z: 123.6, r: 14, y: 12, top: 28 },
  choir: { x0: -52, x1: -20, z0: 82, z1: 128, y: 12, top: 30 },
  listen: { x0: -15, x1: 15, z0: 140.4, z1: 170.4, y: 12, top: 30 },
  gallery: { x0: -18, x1: 18, z0: 173.4, z1: 229.4, y: -6, floor: 12, top: 30, near: 18, pit: 20 },
};
const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];

/** The Cable Store's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round the middle of the store). */
export const ARENAS = [{
  el: 'arW', room: 'store', zone: { min: [ROOMS.store.x0, -1, ROOMS.store.z0], max: [ROOMS.store.x1, 10, ROOMS.store.z1] }, doors: ['dW'], extra: 2,
  shut: 'The door grinds shut behind you. Among the coils of old cable, something lifts its head.',
  won: 'The last of them falls still among the cable. The key’s cage sinks, and the door lets go.',
}];

/**
 * A piece of the First Sign's own (its element's id, 'sign'): the dark ring at its foot and the cables out from it to the
 * hall's wall (the redesign's rules measure the guardian's hall by its pieces, scripts/temple-design/rules.mjs: the hall
 * has no mark). o: { id, at: its foot (local), r: the hall's radius }
 */
class SignFoot {
  constructor(rt, o) {
    const K = rt.kit, M = rt.M, [x, y, z] = o.at, r = o.r;
    K.add(M.dark, T(annulus(3.4, 4.4, 0.06, 40), [x, y + 0.06, z]));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2, p = [x + Math.sin(a) * 4, y + 0.2, z + Math.cos(a) * 4], q = [x + Math.sin(a) * (r - 0.5), y + 0.2, z + Math.cos(a) * (r - 0.5)];
      K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(...p), V((p[0] + q[0]) / 2, y + 0.25, (p[2] + q[2]) / 2), V(...q)]), 16, 0.25, 5));
    }
  }
  update() {}
}

// ------------------------------------------------------------------ the hub's wings (v1.48, issue #23)
/**
 * The Cable Store (west of the Cable Well, at the end of a long way under the Choir: the house's one fight, an arena:
 * the makers' spare cable on drums round its walls, its door shut behind you while its keepers stand round its middle;
 * won, the small key's cage sinks) and the Tuning Room (east: a pair of dishes across the middle of the room, the near
 * one deaf until a ball's weight is on its footstone, the ball's groove down the room; a low and a high stone by its
 * mouth, and a horn at the far end too far for either to reach it on their own; it listens for the high one, its ring
 * the high note's colour, as the well's horn told the low one by its colour). Each holds one of the two small keys the
 * door to the Shell Chamber takes.
 */
function wings(rt, K, M, { cable, dish, stand }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, W = ROOMS.well, S = ROOMS.store, U = ROOMS.tune, [sx, sz] = mid(S), [ux, uz] = mid(U);
  // ---- the Cable Store, its way west under the Choir's floor
  K.corridor([-W.r - 0.6, W.z], [S.x1 + 0.6, W.z], 0, { w: D.w, h: D.h });
  K.hall({ x: sx, z: sz, w: S.x1 - S.x0, d: S.z1 - S.z0, y: S.y, h: S.top - S.y, roof: 'oculus', oculus: 0.3, doors: [{ side: 'e', at: W.z - sz, w: D.w, h: D.h }] });
  add(Door, { id: 'dW', at: [S.x1 + 0.6, 0, W.z], yaw: Math.PI / 2, w: D.w, h: D.h });   // (open: it shuts behind you while they stand)
  // drums of spare cable round the walls, the middle clear for the fight, two columns to fight round
  for (const [x, z] of [[S.x0 + 4.5, S.z0 + 4], [S.x0 + 4.5, S.z1 - 4], [S.x1 - 6, S.z1 - 4], [S.x1 - 6, S.z0 + 4]]) {
    K.both(M.dark, T(new THREE.CylinderGeometry(1.4, 1.4, 1.8, 14).rotateZ(Math.PI / 2), [x, 1.4, z]));
    for (let i = 0; i < 4; i++) K.add(M.trim, T(new THREE.TorusGeometry(1.42, 0.08, 4, 18).rotateY(Math.PI / 2), [x - 0.7 + i * 0.47, 1.4, z]));
  }
  for (const [x, z] of [[sx - 6, sz - 6], [sx + 6, sz + 6]]) K.column(x, z, 0, S.top, 0.9);
  for (let i = 0; i < 3; i++) cable([S.x0 + 0.6 + i * 1.4, S.top - 1, S.z0 + 0.7], [S.x0 + 0.6 + i * 1.4, 0.3, S.z0 + 0.7], 0.16);   // (hung down the south-west corner, off the floor)
  add(Key, { id: 'kW', at: [S.x0 + 5, 0, sz], yaw: Math.PI / 2 });
  add(Mark, { room: 'store', at: [S.x1 - 3, 0, W.z - 4], yaw: -Math.PI / 2, foes: [sx, 0, sz] });

  // ---- the Tuning Room: the ball's groove down the room to the near dish's footstone, two stones by the dish's mouth;
  // its twin across the room over the far horn
  K.corridor([W.r + 0.6, W.z], [U.x0 - 0.6, W.z], 0, { w: D.w, h: D.h });
  K.hall({ x: ux, z: uz, w: U.x1 - U.x0, d: U.z1 - U.z0, y: U.y, h: U.top - U.y, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: W.z - uz, w: D.w, h: D.h }] });
  const TZ = uz + 4, PX = ux + 3.6;   // (the groove 11.6 m long, as it was)
  K.add(M.dark, box(12.6, 0.04, 1.0, PX - 5.8, 0.02, TZ));
  add(Ball, { id: 'ballT', a: [PX - 11.6, 0.04, TZ], b: [PX, 0.04, TZ], r: 1.0 });
  add(Plate, { id: 'pT', at: [PX, 0, TZ], r: 1.2 });
  stand(PX - 0.8, TZ + 5.4, 0, 2.2);
  add(Dish, { id: 'dishT', at: [PX - 0.8, 3.2, TZ + 5], yaw: Math.PI, tilt: 0.15, r: 2.0, when: { drumOn: ['ballT', 'pT'] },
    to: { at: [PX + 5.2, 3.4, uz - 7], yaw: -Math.PI / 2 - 0.3, tilt: 0.3, r: 1.8 },
    dark: 'The dish is dark and deaf: its footstone is bare.' });
  stand(PX + 5.6, uz - 7, 0, 2.4);
  add(EchoStone, { note: 'low', at: [PX - 3.6, 0, TZ + 4.6], yaw: Math.PI * 0.8, h: 2.6 });
  add(EchoStone, { note: 'high', at: [PX + 2.2, 0, TZ + 4.6], yaw: -Math.PI * 0.8, h: 3.0 });
  add(EchoEar, { id: 'eT', note: 'high', hears: 'note', at: [PX + 3, 0, uz - 8], yaw: -Math.PI * 0.75, reach: 5,
    heard: 'The far dish says the high stone’s note, and the horn under it answers. The key’s cage sinks.',
    wrong: 'The horn hears the note, and stays still. Its ring is the colour of the high one.' });
  dish(U.x1 - 0.4, 7.4, uz + 4, 1.6, -Math.PI / 2);
  // a drum of spare cable lying across the room between the key's cage and the stones: from the cage the high stone is
  // out of sight (the temple design audit: the far horn's stone is found, not seen from the key)
  K.both(M.dark, T(new THREE.CylinderGeometry(1.4, 1.4, 3.2, 14).rotateZ(Math.PI / 2), [PX - 1.4, 1.4, uz + 0.5]));
  for (let i = 0; i < 6; i++) K.add(M.trim, T(new THREE.TorusGeometry(1.42, 0.08, 4, 18).rotateY(Math.PI / 2), [PX - 2.9 + i * 0.6, 1.4, uz + 0.5]));
  add(Key, { id: 'kE', at: [PX - 2, 0, uz - 8], yaw: -Math.PI / 2 });
  add(Mark, { room: 'tune', at: [U.x0 + 5, 0, W.z - 4], yaw: Math.PI / 2 });
}

/**
 * The Choir (v1.60, issue #23: west off the Shell Chamber at 12, over the Cable Store's way; it stood off the Gallery of
 * Voices' far side from v1.49), local m: the room round x, z (w by d, its floor at y, h high); its way in from the
 * chamber at z `way` (its door at `door`), its keepers' gate off the walk round the Cable Well at z `gate` (the well's
 * raised gap at angle `gap`); the gate's horn on the Hall of Dishes' far landing at `hornG`, its cable from there to the
 * gate; the near dish on a stand over its footstone, the ball's groove (z from, to) down the room to it; the low stone by
 * its mouth, its twin at the far end over the far horn; the near horn, the great key between them. All in the middle of
 * the room (issue #336).
 */
const CR = ROOMS.choir, [CRX, CRZ] = mid(CR);
export const CHOIR = { x: CRX, z: CRZ, w: CR.x1 - CR.x0, d: CR.z1 - CR.z0, y: CR.y, h: CR.top - CR.y, way: ROOMS.shell.z, gate: ROOMS.well.z, gap: -Math.PI / 2,
  door: [CR.x1 + 0.6, ROOMS.shell.z], hornG: [4.2, 55.6], dish: [CRX - 5.4, 14.6, CRZ + 11.9], twin: [CRX - 7, 15.4, CRZ - 11.4], footstone: [CRX - 5.4, CRZ + 9.6],
  groove: [CRZ + 1.6, CRZ + 9.6], low: [CRX - 2.6, CRZ + 10.6], hornA: [CRX - 5.8, CRZ - 10.6], hornB: [CRX + 5.4, CRZ + 5.7], key: [CRX, CRZ - 3.3] };
/** The walk round the inside of the Cable Well at 12, from the Choir's gate to the landing: [x0, z0, x1, z1]. */
export const WALK = [-ROOMS.well.r - 0.6, ROOMS.well.z - 3.4, 1, ROOMS.well.z + 5.8];
/** The gate's cable (local m): from its horn on the far landing, through the way into the well, along its floor and up
 * its west wall to the gate's south jamb. */
const GATE_CABLE = [[3.8, 0.2, 56.2], [3.0, 0.18, 61], [2.4, 0.18, 66], [2.0, 0.18, 70], [0.6, 0.18, 72.6], [-3.4, 0.2, 73.8], [-8.4, 0.3, 74.8],
  [-11.8, 2, 76.4], [-14.4, 6, 79.4], [-15.9, 10, 82.4], [-16.4, 16, 84.3], [-16.5, 20.6, 84.4]];

/**
 * The Choir: its keepers' gate, high on the Cable Well's wall, listens through a horn back on the Hall of Dishes' far
 * landing, at its cable's other end, for the middle note played back (the singing ball sings it, across the pit), and
 * its door onto the Shell Chamber goes with the gate: once open, the two hubs are a loop. Inside, two horns, and the
 * great key caged between them, freed while both have answered. The far horn hears only a stone's own low song, and only
 * through the dishes (the ball on the near dish's footstone). The near horn wants the high note played back, and nothing
 * in the Choir sings it: the Cable Well's high stone does, on the floor below the gate. The shell keeps the last note it
 * heard: the low stone sung by the near dish is caught too, so what goes first matters.
 */
function choir(rt, K, M, { cable, dish, stand }) {
  const add = (P, o) => rt.add(P, o);
  const D = DOOR, Cr = CHOIR, Y = Cr.y, x0 = CR.x0, z0 = CR.z0, W = ROOMS.well;
  // the way in from the chamber's west gap, and the keepers' gate's way through the well's wall
  K.corridor([-ROOMS.shell.r - 0.4, Cr.way], [Cr.door[0], Cr.way], Y, { w: D.w, h: D.h });
  add(Door, { id: 'dC', at: [Cr.door[0], Y, Cr.door[1]], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 'hG' }] });
  K.corridor([-W.r - 0.6, Cr.gate], [Cr.door[0], Cr.gate], Y, { w: D.w, h: D.h });
  K.hall({ x: Cr.x, z: Cr.z, w: Cr.w, d: Cr.d, y: Y, h: Cr.h, roof: 'oculus', oculus: 0.3, doors: [{ side: 'e', at: Cr.way - Cr.z, w: D.w, h: D.h }, { side: 'e', at: Cr.gate - Cr.z, w: D.w, h: D.h }] });
  add(Door, { id: 'dG', at: [Cr.door[0], Y, Cr.gate], yaw: Math.PI / 2, w: D.w, h: D.h, lamps: [{ lit: 'hG' }] });
  // the gate's horn on the first hall's far landing, and its cable all the way to the gate
  add(EchoEar, { id: 'hG', note: 'mid', at: [Cr.hornG[0], 0, Cr.hornG[1]], yaw: -Math.PI * 0.7,
    heard: 'The horn at the cable’s end hears the middle note. Far off up the well, a gate grinds open.',
    wrong: 'The horn at the cable’s end hears the note, and stays still: it listens for the middle one, the colour of its ring.' });
  K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(GATE_CABLE.map((p) => V(...p))), 72, 0.16, 5));
  // the near dish on its stand over its footstone, the ball's groove down the room to it; its twin at the far end
  const [gz0, gz1] = Cr.groove;
  K.add(M.dark, box(1.0, 0.04, gz1 - gz0 + 0.6, Cr.footstone[0], Y + 0.02, (gz0 + gz1) / 2));
  add(Ball, { id: 'ballQ', a: [Cr.footstone[0], Y + 0.04, gz0], b: [Cr.footstone[0], Y + 0.04, gz1], r: 1.0 });
  add(Plate, { id: 'pQ', at: [Cr.footstone[0], Y, Cr.footstone[1]], r: 1.2 });
  stand(Cr.dish[0], Cr.dish[2] + 0.4, Y, 1.6);
  add(Dish, { id: 'dishQ', at: Cr.dish, yaw: Math.PI, tilt: 0.15, r: 2.0, when: { drumOn: ['ballQ', 'pQ'] },
    to: { at: Cr.twin, yaw: Math.PI / 2 - 0.5, tilt: 0.3, r: 1.8 },
    dark: 'The dish is dark and deaf: its footstone is bare.' });
  stand(Cr.twin[0] - 0.3, Cr.twin[2] - 0.2, Y, 2.4);
  add(EchoStone, { note: 'low', at: [Cr.low[0], Y, Cr.low[1]], yaw: Math.PI * 0.85, h: 2.6 });
  add(EchoEar, { id: 'hA', note: 'low', hears: 'note', at: [Cr.hornA[0], Y, Cr.hornA[1]], yaw: Math.PI * 0.75, reach: 5,
    heard: 'The far dish says the low stone’s note, and the horn under it answers.',
    wrong: 'The far horn hears the note, and stays still. Its ring is the low one’s colour, and it hears only a stone’s own song.' });
  add(EchoEar, { id: 'hB', note: 'high', at: [Cr.hornB[0], Y, Cr.hornB[1]], yaw: -Math.PI * 0.75, reach: 4,
    heard: 'The near horn hears the high note played back, and answers.',
    wrong: 'The near horn hears the note, and stays still: it listens for the high one, its ring’s colour. Nothing in the Choir sings it.' });
  add(Key, { id: 'kB', big: true, at: [Cr.key[0], Y, Cr.key[1]], yaw: 0 });
  // cable down the walls, and an old dish on the west wall
  for (let k = 0; k < 3; k++) cable([x0 + 0.6, Y + Cr.h - 2 - k * 0.5, z0 + 16 + k * 0.6], [x0 + 0.9, Y + 0.3, z0 + 19 + k * 0.5], 0.18);
  dish(x0 + 0.4, Y + 9, Cr.z + 4, 2.4, Math.PI / 2, 0.2);
  add(Mark, { room: 'choir', at: [Cr.x + 4.6, Y, Cr.z + 1.4], yaw: -Math.PI / 2 });
}

// ------------------------------------------------------------------ inside
// (issue #336: every hall 30 to 36 m across under 18 m of stone or more, the Cable Well and the First Sign's Hall round
// halls 34 and 40 m across, the Shell Chamber 28, doors 7 by 9 m, each puzzle in the middle of its own room, the one fight
// in the Cable Store; the props at a body's scale as they were and the pits and every groove as long as they were)
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR, R0 = ROOMS;
  const add = (P, o) => rt.add(P, o);
  // (in the house's futuristic skin, src/temples/skins/undertower.js: the dishes on the walls polished brass)
  const brass = rt.skin?.mats.brass ?? { paint: new THREE.Color('#c99758'), smooth: false, side: THREE.FrontSide };
  const cream = rt.skin?.mats.brass ?? { paint: new THREE.Color('#f5dfab'), smooth: true, side: THREE.DoubleSide };
  // the market's signs, far overhead, their light through slots in the gallery's roof
  const signCoral = makeMaterial({ color: '#f0a083', glow: 0.85, flat: true, key: 'temple.bazaar.slotCoral' });
  const signTeal = makeMaterial({ color: '#7fd6cf', glow: 0.85, flat: true, key: 'temple.bazaar.slotTeal' });
  /** An old receiving dish on a wall, facing `yaw` (0 = +z). */
  const dish = (x, y, z, r, yaw, tilt = 0) => {
    const prof = []; for (let i = 0; i <= 8; i++) { const q = (i / 8) * r; prof.push([Math.max(0.01, q), (q * q) / (4 * r * 0.7)]); }
    K.add(cream, T(lathe(prof, 20).rotateX(-Math.PI / 2), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
    K.add(brass, T(new THREE.TorusGeometry(r, 0.12, 4, 28).translate(0, 0, r * r / (4 * r * 0.7)), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
    K.add(M.dark, T(new THREE.ConeGeometry(0.25, 1.0, 8).rotateX(Math.PI / 2).translate(0, 0, r * 0.6), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));
  };
  /** A run of old cable along the floor (from a to b, sagging a little). */
  const cable = (a, b, r = 0.18) => { const m = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) + 0.05, (a[2] + b[2]) / 2]; K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(...a), V(...m), V(...b)]), 16, r, 5)); };
  /** A stone stand for a dish in the middle of a floor (they hung on the walls before issue #336): from y, h high. */
  const stand = (x, z, y, h) => { K.both(M.trim, box(1.1, 0.4, 1.1, x, y + 0.2, z)); K.both(M.wall, box(0.6, h - 0.4, 0.6, x, y + 0.4 + (h - 0.4) / 2, z)); rt.skinStands?.push({ x, z, y, h }); };   // (the skin dresses it: rt.skinStands)
  /** A square pier of stone under a floor in the air (or a horn's), from y up h, w across. */
  const pier = (x, z, y, h, w = 1.1) => K.both(M.wall, box(w, h, w, x, y + h / 2, z));
  const hall = (r, o = {}) => { const [x, z] = mid(r); return K.hall({ x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, y: r.y, h: r.top - r.y, roof: 'oculus', ...o }); };

  // ---- the Threshold: the way back out behind you
  const TH = R0.threshold;
  hall(TH, { roof: true, doors: [{ side: 's', w: 6, h: 8 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(6, 8).translate(0, 4, 0), [0, 0, -1.25]));
  K.solid(box(6.4, 8, 0.1, 0, 4, -1.25));   // (thin, on the dark drawn in the doorway: nothing to climb in front of it)
  K.glyph([0, 9.4, 0.05], 1.8, 0);
  cable([-8.4, 0.2, 1], [-6.6, 0.2, 14]); cable([8.2, 0.2, 2], [6.2, 0.2, 14.4], 0.24);
  add(Mark, { room: 'threshold', at: [-5, 0, 6.5], yaw: Math.PI / 2 });
  // the wall between the Threshold and the taller hall beyond, from the pit's floor, with the archway through it
  const DI = R0.dishes, [, diz] = mid(DI);
  K.wall(DI.x0 - 0.6, TH.z1 + 0.6, DI.x1 + 0.6, TH.z1 + 0.6, DI.y, DI.top - DI.y, { t: 1.2, holes: [{ at: DI.x1 + 0.6, w: 8, h: 10, y0: DI.floor - DI.y }] });

  // ---- the Hall of Dishes: a singing ball, a pair of the makers' dishes, the pillars over the cable pit across its
  // middle. The pillars wait for their horn on the far landing, which hears a stone's own song (no shell): too far for
  // any note sung on this side, unless the near dish carries it. The dish is dark until the ball's weight is on its
  // footstone; roll the ball home, splash it, and its note comes out of the far dish over the horn.
  const P0 = DI.z0 + DI.near, P1 = P0 + DI.pit;   // (the pit's near and far edges)
  hall(DI, { floor: false, oculus: 0.25, omit: ['s'], doors: [{ side: 'n', w: D.w, h: D.h, y0: DI.floor - DI.y }] });
  K.slab(DI.x0, DI.z0, DI.x1, P0, 0, 8);
  K.slab(DI.x0, P1, DI.x1, DI.z1, 0, 8);
  K.both(M.dark, box(DI.x1 - DI.x0, 1, DI.pit, 0, DI.y - 0.5, (P0 + P1) / 2));
  for (let i = 0; i < 9; i++) cable([-14 + i * 3.4, DI.y + 0.1, P0 + 1.2], [-13 + i * 3.2, DI.y + 0.1, P1 - 1.2], 0.3);   // the pit full of the makers' old cable
  add(Pit, { room: 'dishes', min: [DI.x0 - 1, -10, P0], max: [DI.x1 + 1, -2, P1] });
  rt.skinPits?.push({ x0: DI.x0, x1: DI.x1, hz0: DI.z0, hz1: DI.z1, z0: P0, z1: P1, y: DI.y, floor: DI.floor });   // (the skin fills it with cable)
  const BZ = P0 - 4.2;   // (the ball's groove 13 m long across the near landing, 4 m back from the pit)
  K.add(M.dark, box(13.6, 0.04, 1.0, 0, 0.02, BZ));
  add(Ball, { id: 'ball1', a: [6.5, 0.04, BZ], b: [-6.5, 0.04, BZ], r: 1.1, sings: 'mid' });
  add(Plate, { id: 'p1', at: [-6.5, 0, BZ], r: 1.3 });
  stand(-10.1, BZ, 0, 1.6);
  stand(-9.9, P1 + 6.2, 0, 4.4);
  add(Dish, { id: 'dishA', at: [-9.8, 3.0, BZ], yaw: Math.PI / 2, tilt: 0.12, r: 2.4, when: { drumOn: ['ball1', 'p1'] },
    to: { at: [-9.6, 6.2, P1 + 6.2], yaw: Math.PI / 2 + 0.1, tilt: 0.6, r: 2.4 },
    dark: 'The great dish is dark and deaf: its footstone is bare. Something heavy has to stand on it.' });
  add(EchoEar, { id: 'eD', note: 'mid', hears: 'both', at: [-5.5, 0, P1 + 5.8], yaw: -Math.PI * 0.6, reach: 6,
    heard: 'Across the pit the far dish says the ball’s note, and the horn under it answers. Something wakes in the pit.',
    wrong: 'The horn across the pit hears the note, and stays still: it listens for the middle one.' });
  add(Bridge, { id: 'disc', a: [0, 0, P0 - 0.1], b: [0, 0, P1 + 0.1], w: 4, n: 6, pillar: 9 });   // the pillars, down in the cable
  dish(DI.x1 - 0.6, 8, diz, 2.6, -Math.PI / 2);
  add(Mark, { room: 'dishes', at: [-8, 0, DI.z0 + 3.8], yaw: Math.PI / 2 });

  // ---- the Cable Well (a round hall): a disc up to a ledge at 6; the second, up to the landing at 12, waits for the
  // horn on the ledge, which listens for the low stone on the floor (its ring is the low note's colour)
  const WL = R0.well, C2 = WL.z;
  K.corridor([0, DI.z1 + 0.6], [0, C2 - WL.r - 0.4], 0, { w: D.w, h: D.h });
  // (the house's hub since v1.48: a way west under the Choir to the Cable Store and east into the Tuning Room at its
  // floor; since v1.60 the Choir's keepers' gate over the way west, at 12, onto a walk round the wall to the landing)
  K.rotunda({ x: 0, z: C2, y: 0, r: WL.r, h: WL.top, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h, y0: 12 }, { a: -Math.PI / 2, w: D.w, h: D.h }, { a: Math.PI / 2, w: D.w, h: D.h }, { a: CHOIR.gap, w: D.w, h: D.h, y0: 12 }], oculus: 0.3 });
  add(Platform, { path: [[-5, 0, C2 - 1], [-5, 6, C2 - 1]], r: 2.2, speed: 1.4, pause: 1.6 });
  K.slab(-9, C2 + 1.4, 1, C2 + 5.4, 6, 1.0);
  for (const x of [-8, 0]) pier(x, C2 + 4.4, 0, 5);
  add(Platform, { id: 'wdisc', path: [[3.4, 6, C2 + 3.4], [3.4, 12, C2 + 3.4]], r: 2.2, speed: 1.4, pause: 1.6, phase: 0.5, when: { open: 'wdisc' } });
  K.slab(-3.2, C2 + 5.8, 6, C2 + 10.6, 12, 1.0);
  K.slab(-3.6, C2 + 10.6, 3.6, C2 + WL.r + 0.4, 12, 1.0);   // (on to the north gap: the landing reaches the wall)
  pier(4.8, C2 + 9.4, 0, 11);
  K.slab(WALK[0], WALK[1], WALK[2], WALK[3], 12, 1.0);   // (the walk from the Choir's gate: one floor with the landing)
  pier(-12, C2 - 2.4, 0, 11);
  add(EchoStone, { note: 'low', at: [4, 0, C2 - 4.5], yaw: -Math.PI * 0.75, h: 3.0 });
  add(EchoStone, { note: 'high', at: [6.6, 0, C2 - 0.6], yaw: -Math.PI * 0.6, h: 3.4 });
  add(EchoEar, { id: 'eW', note: 'low', hears: 'note', at: [-1, 6, C2 + 4.9], yaw: 2.45, reach: 13,
    heard: 'The horn on the ledge hears the low stone, and the second disc wakes.',
    wrong: 'The horn on the ledge hears the note, and stays still. Its ring is the colour of the low one.' });
  for (const a of [0.4, 1.97, 3.54, 5.75]) { cable([Math.sin(a) * (WL.r - 0.4), WL.top - 2, C2 + Math.cos(a) * (WL.r - 0.4)], [Math.sin(a) * (WL.r - 0.6), 0.2, C2 + Math.cos(a) * (WL.r - 0.6)], 0.22); }
  add(Mark, { room: 'well', at: [-6, 0, C2 - 6.5], yaw: Math.PI * 0.75 });
  wings(rt, K, M, { cable, dish, stand });

  // ---- the way up and the Shell Chamber (floor 12): the chest, nothing else; its way north open, a low singing stone by
  // the dais
  const SH = R0.shell, C3 = SH.z;
  K.corridor([0, C2 + WL.r + 0.4], [0, C3 - SH.r - 0.4], 12, { w: D.w, h: D.h });
  add(Door, { id: 'dK', at: [0, 12, (C2 + WL.r + C3 - SH.r) / 2], w: D.w, h: D.h });   // (two keyholes: logic `lock`, a small key from each wing)
  K.rotunda({ x: 0, z: C3, y: 12, r: SH.r, h: SH.top - SH.y, seg: 24, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }, { a: -Math.PI / 2, w: D.w, h: D.h }], oculus: 0.35 });   // (and west into the Choir, v1.60)
  K.both(M.trim, ...chestMound(0, 12, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  add(EchoStone, { note: 'low', at: [-5.6, 12, C3 + 3.2], yaw: Math.PI * 0.6, h: 2.6 });
  add(Door, { id: 'dL', at: [0, 12, C3 + SH.r + 0.7], w: D.w, h: D.h, lamps: [{ item: 'recall' }] });   // (the hourglass in hand)
  add(Mark, { room: 'shell', at: [6, 12, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Listening Passage (floor 12), a room of its own on from the chamber (issue #336): the door into the gallery
  // listens for the low note through its horn in the middle of the room, and nothing sings it here. Since v1.49 the
  // horn is deaf until a ball's weight is on its footstone, a groove's length from it
  const LI = R0.listen, [, lz] = mid(LI);
  K.corridor([0, C3 + SH.r + 0.4], [0, LI.z0 - 0.6], 12, { w: D.w, h: D.h });
  hall(LI, { oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h }, { side: 'n', w: D.w, h: D.h }] });
  for (const s of [-1, 1]) cable([s * (LI.x1 - 0.6), LI.top - 1.4, LI.z0 + 2], [s * (LI.x1 - 0.8), 12.2, LI.z0 + 12], 0.2);
  K.add(M.dark, box(1.0, 0.04, 7.2, 3.7, 12.02, lz));
  add(Ball, { id: 'ballP', a: [3.7, 12.04, lz - 3.2], b: [3.7, 12.04, lz + 3.2], r: 1.0 });
  add(Plate, { id: 'pP', at: [3.7, 12, lz + 3.2], r: 1.2 });
  add(EchoEar, { id: 'e0', note: 'low', at: [3.7, 12, lz + 5], yaw: Math.PI, deaf: 'The horn by the door hears nothing: it is deaf. Its footstone is bare.',
    heard: 'The door’s horn hears the low note, and the door sinks.',
    wrong: 'The door’s horn hears the note, and stays still: it listens for the low one, the colour of its ring.' });
  cable([3.7, 12.2, lz + 5.4], [2.6, 12.2, LI.z1 - 0.4], 0.16);   // (from the horn to its door)

  // ---- the Gallery of Voices (the key hall, after its reference: blue-grey blocks, cable down into the chasm, the
  // market's coloured light through slots far above). Near side: three singing stones of three sizes on stepped
  // plinths; the pillars down in the chasm across the hall's middle rise while the high note, played back near them,
  // still rings (v1.74: one great horn at the edge raised them all). The far door listens through a dish on a pillar in
  // the middle of the far landing (it hung over the door before issue #336): its near dish, on a stand by the near edge,
  // wakes with a ball on its footstone, and carries what is played into it. One note at a time: send the middle note
  // over first, then carry the high
  const GA = R0.gallery, G0 = GA.z0, Q0 = G0 + GA.near, Q1 = Q0 + GA.pit;   // (the chasm's near and far edges)
  K.corridor([0, LI.z1 + 0.6], [0, G0 - 0.6], 12, { w: D.w, h: D.h });
  add(Door, { id: 'd3', at: [0, 12, G0 - 0.6], w: D.w, h: D.h, lamps: [{ lit: 'e0' }] });
  hall(GA, { floor: false, oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h, y0: GA.floor - GA.y }, { side: 'n', w: LOCK.w, h: LOCK.h, y0: GA.floor - GA.y }] });
  K.slab(GA.x0, G0, GA.x1, Q0, 12, 18);
  K.slab(GA.x0, Q1, GA.x1, GA.z1, 12, 18);
  K.both(M.dark, box(GA.x1 - GA.x0, 1, GA.pit, 0, GA.y - 0.4, (Q0 + Q1) / 2));
  add(Pit, { room: 'gallery', min: [GA.x0 - 1, -8, Q0], max: [GA.x1 + 1, 8, Q1] });
  rt.skinPits?.push({ x0: GA.x0, x1: GA.x1, hz0: GA.z0, hz1: GA.z1, z0: Q0, z1: Q1, y: GA.y, floor: GA.floor });
  add(Pillars, { a: [0, 12, Q0 - 0.1], b: [0, 12, Q1 + 0.1], w: 4, n: 8, pillar: 12, note: 'high', hold: HOLD.pillar, reach: HOLD.reach,
    heard: 'The pillars nearest you hear the high note and rise out of the dark. Further on, they wait to hear it too: play it again as you go.' });
  /** A stepped plinth (two blocks) with a singing egg on it. */
  const egg = (note, x, z, h, yaw) => {
    K.both(M.wall, box(2.4, 0.6, 2.4, x, 12.3, z)); K.both(M.trim, box(1.9, 0.6, 1.9, x, 12.9, z));
    for (const s of [-1, 1]) K.add(brass, box(0.12, 0.5, 0.5, x + s * 0.96, 12.95, z));
    return add(EchoStone, { note, at: [x, 13.2, z], yaw, h, shape: 'egg' });
  };
  // (v1.74, issue #23: the middle egg nearest the chasm, so it is seen from the far door that wants its note; the high
  // one, taller, stood in front of it from there)
  egg('low', -8.9, Q0 - 6.5, 2.2, Math.PI / 2);
  egg('high', -8.9, Q0 - 3.9, 4.0, Math.PI / 2);
  egg('mid', -8.7, Q0 - 1.4, 3.0, Math.PI / 2 + 0.3);
  // the far door's dish pair: the near one on its stand by the near edge, its footstone, the ball's groove
  const BZ2 = Q0 - 3.6;
  K.add(M.dark, box(5.6, 0.04, 1.0, 5.8, 12.02, BZ2));
  add(Ball, { id: 'ball2', a: [3.2, 12.04, BZ2], b: [8.2, 12.04, BZ2], r: 1.1 });
  add(Plate, { id: 'p2', at: [8.2, 12, BZ2], r: 1.3 });
  stand(10.7, BZ2, 12, 2.6);
  add(Dish, { id: 'dishC', at: [10.4, 14.6, BZ2], yaw: -Math.PI / 2, tilt: 0.1, r: 2.4, when: { drumOn: ['ball2', 'p2'] },
    to: { at: [-4.4, 19.4, Q1 + 6.8], yaw: Math.PI, tilt: 0.25, r: 2.2 },
    dark: 'The dish on its stand is dark and deaf: its footstone is bare.' });
  // the door's horn and the far dish high on a pillar in the middle of the far landing, out of the shell's reach from the floor
  pier(-3.6, Q1 + 6.6, 12, 5.6, 1.4);
  add(EchoEar, { id: 'e2', note: 'mid', lintel: true, at: [-2.9, 18.6, Q1 + 6], yaw: Math.PI, reach: 2.6,
    heard: 'On its pillar the dish says the middle note, and the door’s horn answers.' });
  add(Door, { id: 'd4', at: [0, 12, GA.z1 + 0.6], w: LOCK.w, h: LOCK.h, lamps: [{ drumOn: ['ball2', 'p2'] }, { lit: 'e2' }] });
  // the far side: a high stone, the way back over (no one is left stranded)
  egg('high', 8.4, Q1 + 3.6, 4.0, -Math.PI / 2);
  // cable in bundles down the walls into the chasm, and the market's light through slots far overhead
  for (const [x, z0, z1] of [[GA.x0 + 0.4, Q0 - 9, Q0 + 2], [GA.x1 - 0.4, Q0 - 4, Q0 + 2], [GA.x0 + 0.4, Q1 - 2, Q1 + 6], [GA.x1 - 0.4, Q1 - 4, Q1 + 5]]) {
    for (let k = 0; k < 3; k++) cable([x, GA.top - 2 - k * 0.5, z0 + k * 0.6], [x * 0.97, 12.3, (z0 + z1) / 2 + k * 0.5], 0.2);
    for (let k = 0; k < 3; k++) cable([x * 0.97, 12.3, (z0 + z1) / 2 + k * 0.5], [x * 0.9, -5, z1 + k * 0.4], 0.2);
  }
  for (const [x, z, c] of [[-8, Q0 - 4, signCoral], [8.5, Q0 + 4, signTeal], [-7.5, Q1 - 4, signTeal], [8, Q1 + 4, signCoral]]) K.add(c, box(1.4, 0.2, 5.2, x, GA.top - 0.08, z));
  dish(GA.x1 - 0.6, 20, (Q0 + Q1) / 2, 3.2, -Math.PI / 2, 0.2);
  add(Mark, { room: 'gallery', at: [0, 12, G0 + 3], yaw: 0 });
  add(Mark, { room: 'galleryFar', at: [7.6, 12, GA.z1 - 3], yaw: -Math.PI / 2 });

  // ---- the antechamber and the First Sign's Hall (floor 12)
  const H0 = GA.z1 + 0.6;
  const AE = K.vestibule(H0, 12);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, 12, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = 20, CW = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CW, y: 12, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: ANTE.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.3 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.4; dish(Math.sin(a) * (HR - 0.6), 26, CW + Math.cos(a) * (HR - 0.6), 2.8, a + Math.PI, 0.35); }
  add(SignFoot, { id: 'sign', at: [0, 12, CW], r: HR });
  // two low dishes on the wall, east and west, each with its twin high over it and a cable from them to the First
  // Sign's foot: a word played into the low one reaches it down the cable, from anywhere in the hall
  for (const [id, a] of [[SIGN_DISHES[0], -Math.PI / 2], [SIGN_DISHES[1], Math.PI / 2]]) {
    const sx = Math.sin(a), sz = Math.cos(a);
    add(Dish, { id, at: [sx * (HR - 1.5), 14.0, CW + sz * (HR - 1.5)], yaw: a + Math.PI, tilt: 0.15, r: 1.7,
      to: { at: [sx * (HR - 0.9), 21.5, CW + sz * (HR - 0.9)], yaw: a + Math.PI, tilt: 0.45, r: 2.2 } });
    cable([sx * (HR - 0.7), 21, CW + sz * (HR - 0.7)], [sx * (HR - 0.6), 12.2, CW + sz * (HR - 0.6)], 0.22);
    cable([sx * (HR - 0.6), 12.2, CW + sz * (HR - 0.6)], [sx * 4.2, 12.2, CW + sz * 4.2], 0.25);
  }
  // the way out, past the far door
  const X0 = CW + HR + 0.7, X1 = CW + HR + 10;
  add(Door, { id: 'd5', at: [0, 12, X0], w: D.w, h: D.h });
  K.slab(-4.6, X0 - 0.1, 4.6, X1, 12, 0.8);
  K.wall(-4.2, X0 + 0.7, -4.2, X1, 12, 10, { t: 0.8 }); K.wall(4.2, X1, 4.2, X0 + 0.7, 12, 10, { t: 0.8 });
  K.wall(4.2, X1, -4.2, X1, 12, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.2, 0.8, X1 - X0 + 0.4, 0, 22.4, (X0 + X1) / 2));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 12, X1 + 0.5]));
  K.solid(box(4, 5, 0.1, 0, 14.5, X1 + 0.5));

  const model = signModel(rt.skin?.sign);   // (its colours the skin's: a brass mast, a brass dish, coral lamps)
  model.pos.copy(K.world(0, 12, CW + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 12, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 12, CW), r: HR, y: K.world(0, 12, 0).y };

  // (the Choir and the Listening Passage's stones last: their marks after the others, so the machines' ids by mark stay
  // as they were)
  choir(rt, K, M, { cable, dish, stand });
  add(Mark, { room: 'listen', at: [-LI.x1 + 5, 12, LI.z0 + 4], yaw: Math.PI / 2 });
  const W = (x, y, z) => K.world(x, y, z), [sx, sz] = mid(R0.store), [ux] = mid(R0.tune);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(R0.store.x0 - 4, -12, -3), V(R0.tune.x1 + 4, 44, X1 + 2)),
    gadget: { at: W(0, 12.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 12.5, X1 - 0.4), r: 1.5 }],
    lights: [[0, 6, 7, 14], [0, 6, DI.z0 + 9, 20], [0, 6, P1 + 9, 20], [0, 10, C2, 22], [sx, 7, sz, 20], [(-WL.r + R0.store.x1) / 2, 5, C2, 16], [ux, 7, C2, 20], [0, 18, C3, 18], [0, 18, lz, 20], [0, 18, G0 + 9, 20], [0, 18, Q1 + 9, 20], [0, 20, CW, 30], [CHOIR.x, 18, CHOIR.z, 26]],
    guardian: { def: { ...FIRST_SIGN, onHit: signHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the old doorway in the silent tower's back
function exterior(scene, level, rt) {
  const yaw = SITE.heading, sill = 0.35;
  const K = new TempleKit(rt.root, 'The Undertower', V(SITE.x, 0, SITE.z), yaw, rt.M);
  const M = rt.M;
  const old = makeMaterial({ color: PALETTE.wall, color2: PALETTE.wall2, color3: PALETTE.wall3, mode: MODE_STRATA, strataSize: 1.1, flat: true, glyphs: true, key: 'temple.bazaar.old' });
  const brass = { paint: new THREE.Color('#c99758'), smooth: false, side: THREE.FrontSide };
  const lampM = makeMaterial({ color: '#ffe3aa', glow: 0.1, flat: true, key: 'temple.bazaar.porch' });
  // the doorway, after its reference: one great monolith of blue-grey blocks, older than any sign, stepping down
  // at its sides; a deep doorway framed three times, each frame set back from the last; a round dish-face over
  // the door; a dark way down, and the old cables coming out from under its foot into the paving
  // (the doorway framed three times, each round frame a step nearer, the outer two standing out of the landmark's
  // pylons: a deep way in, as drawn; src/temples/portal.js)
  const P = portal(K, { y: sill, z: 0.35, w: 4.8, h: 8.6, shape: 'round', layers: 3, step: 1.1, recess: 0.9, back: 5.2, into: 1.2,
    frame: lmStone('#8298a6', { course: 1.8, width: 3.6, wear: .3 }), inlay: '#ff9a7a' });
  // stepping down at the sides, more on the west, as drawn
  for (const [x, w, h, d] of [[-7.6, 2.6, 7.4, 4.2], [-9.9, 2.0, 4.6, 3.8], [-11.5, 1.4, 2.2, 3.2], [7.6, 2.6, 5.4, 4.2], [9.7, 1.6, 2.6, 3.6]]) K.both(old, box(w, h, d, x, h / 2, d / 2 - 0.1));
  K.both(M.floor, box(9.6, sill, 5.4, 0, sill / 2, 2.7));
  landmark(K, 'bazaar', { y: sill });
  // cables coming out from under the monolith's foot, through dark slots, into the paving
  for (const x of [-4.6, 4.8]) K.add(M.dark, box(1.4, 0.4, 0.6, x, 0.2, 9.4));
  for (const [x, k] of [[-4.9, 1.4], [-4.4, 1.9], [4.6, 1.5], [5.1, 2.2]]) K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, 0.18, 9.2), V(x * k * 0.8, 0.12, 11.7), V(x * k, 0.05, 14.7)]), 12, 0.15, 5));
  K.flush();
  const at = K.world(0, sill, 1.4);
  const front = K.world(0, 0, 9);
  // the market's crowd keeps off the doorway (crowdSpots' clear circles, src/crowd.js)
  if (level.crowdSpots) { const spots = level.crowdSpots; level.crowdSpots = function (...a) { const r = spots.apply(this, a); (r.clear ??= []).push({ x: front.x, z: front.z, r: 6.5 }, { x: at.x, z: at.z, r: 5 }); return r; }; }
  return { door: { at, heading: yaw, ...P.door }, kit: K, sill, lampM, clear: [{ x: front.x, z: front.z, r: 7 }] };
}

// ------------------------------------------------------------------ the world change: the silent tower speaks, once a night
/**
 * Once the First Sign has its line again, the silent tower wears a lamp on its crown, the Undertower's porch
 * lamps are lit, and once a night (when you are in or near the square) the tower says the whole line in the
 * First Sign's voice: a ring of light goes out from its crown, and everyone in the square looks up.
 */
function change(scene, level, rt) {
  const root = new THREE.Group();
  root.name = 'The silent tower speaks (the world change)';
  rt.root.add(root);
  root.visible = false;
  const top = V(SITE.tower.x, SITE.tower.top - 4, SITE.tower.z);
  const beaconM = makeMaterial({ color: '#fff0bd', glow: 0.9, flat: true, key: 'temple.bazaar.beacon' });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.6, 16, 10), beaconM);
  beacon.position.copy(top);
  const ringM = makeMaterial({ color: '#fff0bd', glow: 0.9, flat: true, key: 'temple.bazaar.ring' });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 4, 48).rotateX(Math.PI / 2), ringM);
  ring.position.copy(top); ring.visible = false;
  for (const m of [beacon, ring]) { m.userData.noCollide = true; m.userData.dynamic = true; root.add(m); }
  let k = 0, want = 0, spoke = false, wave = -1;
  const api = {
    root, beacon, ring, line: `${LINE.join(' ')}.`, spoken: 0,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; root.visible = k > 0.01; } },
    /** It speaks now (once a night; the tests call it directly). */
    speak() {
      spoke = true; wave = 0; api.spoken++;
      rt.notice?.(`The silent tower speaks: “${LINE.join(' ')}.”`);
      LINE.forEach((_, i) => setTimeout(() => rt.sound?.orbNote?.(WORD_DEGREES[i], top, { size: 1 }), i * 600)?.unref?.());
    },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 3 : -dt), 0, 1); root.visible = k > 0.01; }
      if (rt.outside) rt.outside.lampM.uniforms.uGlow.value = 0.1 + 0.8 * k;
      if (!want) return;
      beaconM.uniforms.uGlow.value = 0.6 + 0.3 * Math.sin(t * 1.2);
      // once a night, when you are about the square
      const night = !!rt.isNight?.(), P = rt.player;
      if (!night) spoke = false;
      else if (!spoke && P && Math.hypot(P.pos.x - SITE.tower.x, P.pos.z - SITE.tower.z) < 220 && !rt.inside(P.pos)) api.speak();
      if (wave >= 0) {
        wave += dt;
        ring.visible = wave < 4;
        ring.scale.set(1 + wave * 40, 1, 1 + wave * 40);
        ringM.uniforms.uGlow.value = 0.9 * Math.max(0, 1 - wave / 4);
        if (wave >= 4) wave = -1;
      }
    },
  };
  return api;
}

export const BAZAAR_TEMPLE = {
  id: 'bazaar', levelId: 'bazaar', name: 'The Undertower', doorLabel: 'old doorway under the silent tower',
  gadget: 'recall', gadgetBox: 'bazaar.temple.echo', arenas: ARENAS, arenaDoor: 'd4',   // (the box's id from when it held the shell: the saves' flag)
  origin: [-200, 1600, -520], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // its futuristic look inside (issue #342): src/temples/skins/undertower.js
  skin: undertowerSkin,
  local: { person: 'hobb', out: 6, side: 6 },
  enterLine: 'Under the silent tower it is cold and dry and very old. Somewhere far down, a voice says one word, and waits, and says it again.',
  pitLine: 'You climb back up out of the cables, to the last glyph stone.',
  onResolved(rt) { rt.notice('Up in the square, the silent tower’s crown is lit. At night it speaks.', 'resolved.out'); },
  // it cries its word (a note the echo shell keeps); when it listens, its word played back retunes it, and it moves on
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const word = () => Math.min(LINE.length - 1, Math.round(G.meter / 0.25));
    const say = () => {
      const i = word();
      rt.game.emit('note', { pos: G.model.mouth.clone(), note: `sign.${i}`, degree: WORD_DEGREES[i], color: '#fff0bd', label: `the First Sign’s word, “${LINE[i]}”`, reach: 22 });
      rt.sound?.orbNote?.(WORD_DEGREES[i], G.model.mouth, { size: 1.2 });
    };
    G.say = say;
    const strike = G.def.onStrike;
    G.def = { ...G.def, onStrike: (g, a) => { strike?.(g, a); if (a.id === 'cry') { say(); rt.notice(`It cries its one word: “${LINE[word()]}”.`, `fs.word.${word()}`); } } };
    // (it says it again as it lowers its dish to listen: you can always catch it then)
    const enter = G.enter.bind(G);
    G.enter = (state) => { const was = G.state; enter(state); if (state === 'open' && was !== 'open') say(); };
    // (a low dish on the wall carries a word down its cable from anywhere: in the last phase only that)
    const byDish = (pos) => SIGN_DISHES.some((id) => { const d = rt.piece(id); return d && pos.distanceTo(d.ends[0].mouth) <= d.reach; });
    rt.offs.push(rt.game.on('echo', ({ pos, note, relayed, via } = {}) => {
      if (!pos || !G.awake) return;
      const cabled = !!relayed && SIGN_DISHES.includes(via);
      if (!cabled && pos.distanceTo(G.model.mouth) > LISTEN) return;
      if (!cabled && G.phaseIndex >= 2) {
        // (played into a low dish, the dish carries it a moment later: say nothing yet)
        if (!byDish(pos)) rt.notice('Its dish is turned up: it hears only what its cables bring it.', 'fs.cables');
        return;
      }
      if (G.state !== 'open') { rt.notice(G.phaseIndex >= 2 ? 'Its cables hum with the word, but it isn’t listening yet. Wait.' : 'It hears you, but isn’t listening yet. Wait for it to lower its dish.', G.phaseIndex >= 2 ? 'fs.notyet2' : 'fs.notyet'); return; }
      if (note !== `sign.${word()}`) {
        rt.notice(note?.startsWith?.('sign.') ? 'It shakes its dish at its old word. Catch the new one.' : 'It hears the note, and shakes its dish. That is not its word.', `fs.wrong.${note}`);
        return;
      }
      G.add(0.25, 'echo');
      rt.rumble(0.6, 0.4);
      if (cabled) rt.notice('The word runs down the cable from the wall dish, and its lamps answer.', 'fs.cabled');
      const next = word();
      if (G.state !== 'resolved') rt.notice(`It hears its word back, stops, and says the next: “${LINE[next]}”.`, `fs.next.${next}`);
      if (G.state === 'open') { G.enter('fight'); G.cool = 2.0; }
    }));
  },
};
