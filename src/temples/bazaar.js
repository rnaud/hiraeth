import * as THREE from 'three';
import { makeMaterial, MODE_STRATA } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Platform, Bridge, EchoStone, EchoEar, Dish, Mark, Pit } from './pieces.js';
import { signModel } from './guardians.js';

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
// Inside (built far overhead, through the old doorway in the tower's back):
//   the Threshold        the first mark, the way out
//   the Hall of Dishes   no way over the cable pit: the makers' pillars stand down in the dark, and rise only for a
//                        horn on the far landing that hears a stone's own song, too far for any note sung on this
//                        side. A singing ball rolls in a groove to the footstone of a great dish (its weight wakes
//                        the dish); splashed there, its note comes out of the dish's twin over the horn, and the
//                        pillars rise out of the cable (push + shot, and the dishes: a note travels, and a note
//                        raises the way; taught where failing is free)
//   the Cable Well       two discs up; the second waits for the horn on the ledge, which listens for the low stone
//                        on the floor (its ring is the low note's colour; the high stone beside it is not its note)
//   the Shell Chamber    the makers' chest: the ECHO SHELL (src/items.js 'echo', src/echo-shell.js). Its way on is
//                        open; a low singing stone stands by the dais: splash it, and the shell keeps its note
//   the Listening Passage a room on: the door into the gallery listens for the low note through its horn, and
//                        nothing sings it here. Carry it from the chamber's stone (or the Cable Well's), and play it
//                        back by the horn (the shell's first lock, where failing costs nothing)
//   the Gallery of Voices the key hall: three singing eggs of three sizes on plinths, a great horn at the chasm's edge
//                        that raises the pillar bridge only while the high note rings (`hold`); the far door listens
//                        through a dish over it, whose twin, low on this side's wall, wakes with a ball on its
//                        footstone. Send the middle note over through the dish first, then carry the high one to
//                        the horn and cross. Crossing first strands the middle note on this side: a high stone and
//                        a horn of its own on the far side raise the pillars again for the way back
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
/** How long the gallery's great horns hold the high note (s): the pillar bridge stands as long as it rings. */
export const HOLD = { horn: 12 };

export const LOGIC = {
  id: 'bazaar', entry: 'threshold', gadget: 'echo',
  rooms: { threshold: { checkpoint: true }, dishes: { checkpoint: true }, dishesFar: {}, well: { checkpoint: true }, shell: { checkpoint: true }, gallery: { checkpoint: true }, galleryFar: { checkpoint: true }, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'dishes' },
    { a: 'dishes', b: 'dishesFar', door: 'disc' },    // the pillars over the cable pit, once their horn has heard the ball
    { a: 'dishesFar', b: 'well' },
    { a: 'well', b: 'shell', door: 'wdisc' },         // the second disc up the well, once its horn has heard the low stone
    { a: 'shell', b: 'gallery', door: 'd3' },          // the Listening Passage's door, a room on from the chest (one room with it)
    { a: 'gallery', b: 'galleryFar', door: 'br1' },
    { a: 'galleryFar', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    ball1: { type: 'drum', room: 'dishes', plate: 'p1', plateAt: 1, start: 0 },   // the singing ball, onto the dish's footstone
    p1: { type: 'plate', room: 'dishes' },
    eD: { type: 'switch', room: 'dishes' },                           // the horn across the pit: a stone's own song, through the dishes
    disc: { type: 'bridge', opens: { all: [{ drumOn: ['ball1', 'p1'] }, { lit: 'eD' }] }, latch: true },
    eW: { type: 'switch', room: 'well' },                             // the horn on the ledge: the low stone's own song
    wdisc: { type: 'bridge', opens: { lit: 'eW' }, latch: true },
    chest: { type: 'gadget', room: 'shell', item: 'echo' },
    e0: { type: 'switch', room: 'shell', needs: ['echo'] },          // the passage's horn: the low note, carried from the chamber's stone
    d3: { type: 'door', opens: { lit: 'e0' }, latch: true },
    ball2: { type: 'drum', room: 'gallery', plate: 'p2', plateAt: 1, start: 0 },  // onto the near dish's footstone
    p2: { type: 'plate', room: 'gallery' },
    e1: { type: 'switch', room: 'gallery', needs: ['echo'], hold: HOLD.horn },     // the high note, held: the pillars stand while it rings
    e3: { type: 'switch', room: 'galleryFar', needs: ['echo'], hold: HOLD.horn },  // the far side's horn, for the way back
    br1: { type: 'bridge', opens: { any: [{ lit: 'e1' }, { lit: 'e3' }] } },
    e2: { type: 'switch', room: 'galleryFar', needs: ['echo'] },     // the middle note, said by the dish over the far door
    d4: { type: 'door', opens: { all: [{ drumOn: ['ball2', 'p2'] }, { lit: 'e2' }] }, latch: true },   // (the arena's door too: it shuts behind you)
    sign: { type: 'boss', room: 'hall', needs: ['backpack', 'echo'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const FIRST_SIGN = {
  kind: 'robot', name: 'the First Sign', final: 'break', speed: 1.4, wakeTime: 3.0,
  wake: 'At the heart of the Undertower a mast of the makers lifts its great dish off the floor, turns it to you, and cries one word, so loud the stones hum.',
  openHint: 'It lowers its dish to you and goes still, listening. It is waiting to hear its word.',
  resolved: 'The First Sign takes its whole line back, word by word, and says it once, quietly, to nobody in particular. Then it turns its dish up to the dark, and listens.',
  phases: [
    { to: 0.5, attacks: ['cry', 'beam', 'static'], pause: 1.6, hint: 'When it lowers its dish to listen, play its word back into it.' },
    { to: 0.75, attacks: ['beam', 'stutter', 'static'], pause: 1.2, hint: 'It has a new word now, and it stutters on it before it cries. Catch it, and give it back: to its dish, or into a low dish on the wall, whose cables run to its foot.' },
    { to: 1.0, attacks: ['statics', 'stutter', 'beam'], pause: 1.0, hint: 'Its lamps flicker and it turns its dish up to the dark: now it hears only through its cables. Catch its word, and play it into a low dish on the wall.' },
  ],
  attacks: {
    cry: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'mouth', rig: 'lean', wave: { speed: 10, reach: 18, width: 0.7, damage: 0.5 }, damage: 0.75, knock: 12, recover: 0.9, open: 4.4 },
    beam: { shape: 'lane', range: 28, width: 2.6, wind: 1.4, track: 0.7, part: 'mouth', damage: 0.75, knock: 10, recover: 0.6, then: 'sweep' },
    sweep: { shape: 'cone', range: 22, angle: 0.8, wind: 1.0, track: 0.5, part: 'mouth', rig: 'coil', pose: 'beam', side: 1, link: true, damage: 0.75, knock: 10, recover: 0.8 },
    static: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.2, wind: 1.4, track: 0.6, part: 'mouth', pose: 'cry', damage: 0.75, knock: 8, recover: 0.6 },
    statics: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'mouth', pose: 'cry', damage: 0.5, knock: 6, recover: 0.6 },
    stutter: { shape: 'ring', at: 'self', radius: 5.5, wind: 1.0, part: 'mouth', rig: 'swell', pose: 'cry', damage: 0.5, knock: 9, recover: 0.4, then: 'stutter2' },
    stutter2: { shape: 'ring', at: 'self', radius: 5.5, wind: 0.65, part: 'mouth', rig: 'swell', pose: 'cry', link: true, damage: 0.5, knock: 9, gap: 0.25, then: 'cryEnd' },
    cryEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'mouth', rig: 'lean', pose: 'cry', link: true, wave: { speed: 10, reach: 18, width: 0.7, damage: 0.5 }, damage: 0.75, knock: 12, recover: 0.9, open: 4.4 },
  },
};

function signHit(g, part, mode) {
  if (mode === 'push') { g.rt.notice('The shove only rings off its mast.', 'fs.push'); return true; }
  g.rt.notice('The fluid rattles off its dish. It is not listening for water: it is listening for its word.', 'fs.fluid');
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const brass = { paint: new THREE.Color('#c99758'), smooth: false, side: THREE.FrontSide };
  const cream = { paint: new THREE.Color('#f5dfab'), smooth: true, side: THREE.DoubleSide };
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

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));   // (thin, on the dark drawn in the doorway: nothing to climb in front of it)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  cable([-6.4, 0.2, 1], [-5, 0.2, 12]); cable([6.2, 0.2, 2], [4.6, 0.2, 12.4], 0.24);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: 6, h: 7 }] });

  // ---- the Hall of Dishes (z 12.6..48): a singing ball, a pair of the makers' dishes, a disc over the cable pit.
  // The disc waits for its horn on the far landing, which hears a stone's own song (no shell): too far for any
  // note sung on this side, unless the near dish carries it. The dish is dark until the ball's weight is on its
  // footstone; roll the ball home, splash it, and its note comes out of the far dish over the horn.
  K.hall({ x: 0, z: 30.3, w: 22, d: 35.4, y: -8, h: 22, floor: false, roof: 'oculus', oculus: 0.25, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4, y0: 8 }] });
  K.slab(-11, 12.6, 11, 24, 0, 8);
  K.slab(-11, 40, 11, 48, 0, 8);
  K.both(M.dark, box(22, 1, 18, 0, -8.5, 32));
  for (let i = 0; i < 9; i++) cable([-10 + i * 2.4, -7.9, 25], [-9 + i * 2.2, -7.9, 39], 0.3);   // the pit full of the makers' old cable
  add(Pit, { room: 'dishes', min: [-12, -10, 24], max: [12, -2, 40] });
  K.add(M.dark, box(13.2, 0.04, 1.0, -0.6, 0.02, 21));
  add(Ball, { id: 'ball1', a: [6, 0.04, 21], b: [-7, 0.04, 21], r: 1.1, sings: 'mid' });
  add(Plate, { id: 'p1', at: [-7, 0, 21], r: 1.3 });
  add(Dish, { id: 'dishA', at: [-10.3, 3.0, 21], yaw: Math.PI / 2, tilt: 0.12, r: 2.4, when: { drumOn: ['ball1', 'p1'] },
    to: { at: [-10.3, 6.2, 44], yaw: Math.PI / 2 + 0.1, tilt: 0.6, r: 2.4 },
    dark: 'The great dish is dark and deaf: its footstone is bare. Something heavy has to stand on it.' });
  add(EchoEar, { id: 'eD', note: 'mid', hears: 'both', at: [-6.2, 0, 43.6], yaw: -Math.PI * 0.6, reach: 6,
    heard: 'Across the pit the far dish says the ball’s note, and the horn under it answers. Something wakes in the pit.',
    wrong: 'The horn across the pit hears the note, and stays still: it listens for the middle one.' });
  add(Bridge, { id: 'disc', a: [0, 0, 23.9], b: [0, 0, 40.1], w: 4, n: 6, pillar: 9 });   // the pillars, down in the cable
  dish(10.4, 8, 30, 2.6, -Math.PI / 2);
  add(Mark, { room: 'dishes', at: [-8.5, 0, 14.4], yaw: Math.PI / 2 });

  // ---- the Cable Well (a rotunda): a disc up to a ledge at 6; the second, up to the landing at 12, waits for the
  // horn on the ledge, which listens for the low stone on the floor (its ring is the low note's colour)
  K.slab(-3.2, 48, 3.2, 50.6, 0, 0.8);
  K.wall(-3.2, 48.6, -3.2, 50.6, 0, 6.4, { t: 0.8 }); K.wall(3.2, 50.6, 3.2, 48.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.8, 49.6));
  const C2 = 61.2;
  K.rotunda({ x: 0, z: C2, y: 0, r: 10, h: 26, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4, y0: 12 }], oculus: 0.3 });
  add(Platform, { path: [[-5, 0, C2 - 1], [-5, 6, C2 - 1]], r: 2.2, speed: 1.4, pause: 1.6 });
  K.slab(-9, C2 + 1.4, 1, C2 + 5.4, 6, 1.0);
  add(Platform, { id: 'wdisc', path: [[3.4, 6, C2 + 3.4], [3.4, 12, C2 + 3.4]], r: 2.2, speed: 1.4, pause: 1.6, phase: 0.5, when: { open: 'wdisc' } });
  K.slab(-3.2, C2 + 5.8, 6, C2 + 10.6, 12, 1.0);
  add(EchoStone, { note: 'low', at: [4, 0, C2 - 4.5], yaw: -Math.PI * 0.75, h: 3.0 });
  add(EchoStone, { note: 'high', at: [6.6, 0, C2 - 0.6], yaw: -Math.PI * 0.6, h: 3.4 });
  add(EchoEar, { id: 'eW', note: 'low', hears: 'note', at: [-1, 6, C2 + 4.9], yaw: 2.45, reach: 13,
    heard: 'The horn on the ledge hears the low stone, and the second disc wakes.',
    wrong: 'The horn on the ledge hears the note, and stays still. Its ring is the colour of the low one.' });
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; cable([Math.sin(a) * 9.6, 24, C2 + Math.cos(a) * 9.6], [Math.sin(a) * 9.4, 0.2, C2 + Math.cos(a) * 9.4], 0.22); }
  add(Mark, { room: 'well', at: [-6, 0, C2 - 6.5], yaw: Math.PI * 0.75 });

  // ---- the corridor and the Shell Chamber (floor 12): the chest; its way on is open, a low singing stone by the dais
  K.slab(-3.2, C2 + 10, 3.2, C2 + 12.6, 12, 0.8);
  K.wall(-3.2, C2 + 10.6, -3.2, C2 + 12.6, 12, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.6, 12, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 18.8, C2 + 11.6));
  const C3 = C2 + 22.6;
  K.rotunda({ x: 0, z: C3, y: 12, r: 9.5, h: 14, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 12, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 12.31, C3));
  add(EchoStone, { note: 'low', at: [-5.6, 12, C3 + 3.2], yaw: Math.PI * 0.6, h: 2.6 });
  add(Mark, { room: 'shell', at: [6, 12, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Listening Passage (floor 12), a room on: the door into the gallery listens for the low note
  const A0 = C3 + 10.9;
  K.slab(-3.2, C3 + 9.2, 3.2, A0 + 0.6, 12, 0.8);
  K.hall({ x: 0, z: A0 + 6, w: 12, d: 12, y: 12, h: 9, roof: true, omit: ['n'], doors: [{ side: 's', w: 5, h: 6.4 }] });
  for (const s of [-1, 1]) cable([s * 5.6, 20.6, A0 + 1], [s * 5.4, 12.2, A0 + 10], 0.2);

  // ---- the Gallery of Voices (the key hall, after its reference: blue-grey blocks, cable down into the chasm, the
  // market's coloured light through slots far above). Near side: three singing stones of three sizes on stepped
  // plinths; the great horn at the chasm's edge raises the pillar bridge only while the high note rings. The far
  // door listens through a dish over it: its near dish, low on the east wall, wakes with a ball on its footstone,
  // and carries what is played into it. One note at a time: send the middle note over first, then carry the high
  const G0 = A0 + 12 + 1.2;
  K.slab(-3.2, G0 - 1.6, 3.2, G0 + 0.6, 12, 0.8);
  add(Door, { id: 'd3', at: [0, 12, G0 - 0.6], w: 5, h: 6.4, lamps: [{ lit: 'e0' }] });
  add(EchoEar, { id: 'e0', note: 'low', at: [3.7, 12, G0 - 2.8], yaw: Math.PI,
    heard: 'The door’s horn hears the low note, and the door sinks.',
    wrong: 'The door’s horn hears the note, and stays still: it listens for the low one, the colour of its ring.' });
  K.hall({ x: 0, z: G0 + 18.3, w: 22, d: 36.6, y: -6, h: 30, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 18 }, { side: 'n', w: 5, h: 6.4, y0: 18 }] });
  K.slab(-11, G0, 11, G0 + 8, 12, 18);
  K.slab(-11, G0 + 28, 11, G0 + 36.6, 12, 18);
  K.both(M.dark, box(22, 1, 20, 0, -6.4, G0 + 18));
  add(Pit, { room: 'gallery', min: [-12, -8, G0 + 8], max: [12, 8, G0 + 28] });
  add(Bridge, { id: 'br1', a: [0, 12, G0 + 7.9], b: [0, 12, G0 + 28.1], w: 4, n: 8, pillar: 12 });
  /** A stepped plinth (two blocks) with a singing egg on it. */
  const egg = (note, x, z, h, yaw) => {
    K.both(M.wall, box(2.4, 0.6, 2.4, x, 12.3, z)); K.both(M.trim, box(1.9, 0.6, 1.9, x, 12.9, z));
    for (const s of [-1, 1]) K.add(brass, box(0.12, 0.5, 0.5, x + s * 0.96, 12.95, z));
    return add(EchoStone, { note, at: [x, 13.2, z], yaw, h, shape: 'egg' });
  };
  egg('low', -8.9, G0 + 1.5, 2.2, Math.PI / 2);
  egg('mid', -8.9, G0 + 4.1, 3.0, Math.PI / 2);
  egg('high', -8.7, G0 + 6.6, 4.0, Math.PI / 2 + 0.3);
  add(EchoEar, { id: 'e1', note: 'high', at: [-3.0, 12, G0 + 7.1], yaw: Math.PI - 0.5, stand: 3.4, size: 1.6, reach: 7,
    heard: 'The great horn takes the high note and holds it, and pillars rise out of the dark, as long as it rings.',
    fading: 'The great horn’s note is fading: the pillars will sink.' });
  K.both(M.trim, T(new THREE.CylinderGeometry(1.0, 1.2, 0.5, 16), [-3.0, 12.25, G0 + 7.1]));
  // the far door's dish pair: the near one low on the east wall, its footstone, the ball's groove
  K.add(M.dark, box(5.6, 0.04, 1.0, 5.8, 12.02, G0 + 4.4));
  add(Ball, { id: 'ball2', a: [3.2, 12.04, G0 + 4.4], b: [8.2, 12.04, G0 + 4.4], r: 1.1 });
  add(Plate, { id: 'p2', at: [8.2, 12, G0 + 4.4], r: 1.3 });
  add(Dish, { id: 'dishC', at: [10.4, 14.6, G0 + 4.4], yaw: -Math.PI / 2, tilt: 0.1, r: 2.4, when: { drumOn: ['ball2', 'p2'] },
    to: { at: [-4.4, 19.4, G0 + 36.0], yaw: Math.PI, tilt: 0.25, r: 2.2 },
    dark: 'The dish on the wall is dark and deaf: its footstone is bare.' });
  add(EchoEar, { id: 'e2', note: 'mid', lintel: true, at: [-2.9, 18.6, G0 + 35.2], yaw: Math.PI, reach: 2.6,
    heard: 'Over the far door the dish says the middle note, and the door’s horn answers.' });
  add(Door, { id: 'd4', at: [0, 12, G0 + 37.2], w: 5, h: 6.4, lamps: [{ drumOn: ['ball2', 'p2'] }, { lit: 'e2' }] });
  // the far side: a high stone and a horn of its own, the way back over (no one is left stranded)
  egg('high', 8.4, G0 + 31.6, 4.0, -Math.PI / 2);
  add(EchoEar, { id: 'e3', note: 'high', at: [3.4, 12, G0 + 29.0], yaw: Math.PI - 0.4, stand: 2.8, size: 1.2,
    heard: 'The far horn takes the high note, and the pillars rise again for the way back.',
    fading: 'The far horn’s note is fading: the pillars will sink.' });
  // cable in bundles down the walls into the chasm, and the market's light through slots far overhead
  for (const [x, z0, z1] of [[-10.6, G0 + 1, G0 + 10], [10.6, G0 + 6, G0 + 12], [-10.6, G0 + 26, G0 + 34], [10.6, G0 + 24, G0 + 33]]) {
    for (let k = 0; k < 3; k++) cable([x, 22 - k * 0.5, z0 + k * 0.6], [x * 0.97, 12.3, (z0 + z1) / 2 + k * 0.5], 0.2);
    for (let k = 0; k < 3; k++) cable([x * 0.97, 12.3, (z0 + z1) / 2 + k * 0.5], [x * 0.9, -5, z1 + k * 0.4], 0.2);
  }
  for (const [x, z, c] of [[-6, G0 + 9, signCoral], [6.5, G0 + 14, signTeal], [-5.5, G0 + 22, signTeal], [6, G0 + 27, signCoral]]) K.add(c, box(1.4, 0.2, 5.2, x, 23.92, z));
  dish(10.4, 20, G0 + 18, 3.2, -Math.PI / 2, 0.2);
  add(Mark, { room: 'gallery', at: [0, 12, G0 + 1.6], yaw: 0 });
  add(Mark, { room: 'galleryFar', at: [7.6, 12, G0 + 34.4], yaw: -Math.PI / 2 });

  // ---- the corridor and the First Sign's Hall (floor 12)
  const H0 = G0 + 37.2;
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 12, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 12, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 12, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 19.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 12, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 20, CW = H0 + 3.2 + HR + 1.4;
  K.rotunda({ x: 0, z: CW, y: 12, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.3 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.4; dish(Math.sin(a) * (HR - 0.6), 26, CW + Math.cos(a) * (HR - 0.6), 2.8, a + Math.PI, 0.35); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.2; cable([Math.sin(a) * 4, 12.2, CW + Math.cos(a) * 4], [Math.sin(a) * (HR - 0.5), 12.2, CW + Math.cos(a) * (HR - 0.5)], 0.25); }
  K.add(M.dark, T(annulus(3.4, 4.4, 0.06, 40), [0, 12.06, CW]));
  // two low dishes on the wall, east and west, each with its twin high over it and a cable from them to the First
  // Sign's foot: a word played into the low one reaches it down the cable, from anywhere in the hall
  for (const [id, a] of [[SIGN_DISHES[0], -Math.PI / 2], [SIGN_DISHES[1], Math.PI / 2]]) {
    const sx = Math.sin(a), sz = Math.cos(a);
    add(Dish, { id, at: [sx * (HR - 1.5), 14.0, CW + sz * (HR - 1.5)], yaw: a + Math.PI, tilt: 0.15, r: 1.7,
      to: { at: [sx * (HR - 0.9), 21.5, CW + sz * (HR - 0.9)], yaw: a + Math.PI, tilt: 0.45, r: 2.2 } });
    cable([sx * (HR - 0.7), 21, CW + sz * (HR - 0.7)], [sx * (HR - 0.6), 12.2, CW + sz * (HR - 0.6)], 0.22);
    cable([sx * (HR - 0.6), 12.2, CW + sz * (HR - 0.6)], [sx * 4.2, 12.2, CW + sz * 4.2], 0.25);
  }
  add(Door, { id: 'd5', at: [0, 12, CW + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CW + HR + 0.6, 3.2, CW + HR + 10, 12, 0.8);
  K.wall(-3.2, CW + HR + 1.4, -3.2, CW + HR + 10, 12, 7, { t: 0.8 }); K.wall(3.2, CW + HR + 10, 3.2, CW + HR + 1.4, 12, 7, { t: 0.8 });
  K.wall(3.2, CW + HR + 10, -3.2, CW + HR + 10, 12, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 19.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 12, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.1, 0, 14.5, CW + HR + 10.5));

  const model = signModel();
  model.pos.copy(K.world(0, 12, CW + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 12, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 12, CW), r: HR, y: K.world(0, 12, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -12, -3), V(24, 44, CW + HR + 12)),
    gadget: { at: W(0, 12.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 12.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 6, 18, 14], [0, 6, 42, 14], [0, 10, C2, 16], [0, 17, C3, 14], [0, 17, G0 + 6, 16], [0, 17, G0 + 32, 16], [0, 20, CW, 30]],
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
  for (const s of [-1, 1]) K.both(old, box(3.4, 11.2, 4.8, s * 4.6, 5.6, 1.9));                  // the great piers
  K.both(old, box(12.6, 2.8, 5.0, 0, 12.6, 1.9));                                                 // the crown block
  K.both(old, box(6.0, 1.8, 3.4, 0, 10.1, 1.4));                                                  // the first frame's lintel
  for (const s of [-1, 1]) K.both(old, box(0.7, 9.2, 3.4, s * 2.95, 4.6, 1.4));                   // the first frame's jambs
  K.both(M.trim, box(5.2, 0.5, 2.6, 0, 8.25, 1.0));                                               // the inner frame
  for (const s of [-1, 1]) K.both(M.trim, box(0.4, 8.0, 2.6, s * 2.6, 4.0, 1.0));
  // stepping down at the sides, more on the west, as drawn
  for (const [x, w, h, d] of [[-7.6, 2.6, 7.4, 4.2], [-9.9, 2.0, 4.6, 3.8], [-11.5, 1.4, 2.2, 3.2], [7.6, 2.6, 5.4, 4.2], [9.7, 1.6, 2.6, 3.6]]) K.both(old, box(w, h, d, x, h / 2, d / 2 - 0.1));
  K.add(M.glyph, T(glyphGeometry(2.2, 0.14), [0, 12.6, 4.42]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.8, 7.6).translate(0, 3.8, 0), [0, sill, 0.35]));
  K.solid(box(4.8, 7.6, 0.1, 0, sill + 3.8, 0.35));
  K.both(M.floor, box(9.6, sill, 5.4, 0, sill / 2, 2.7));
  // the round face over the door: a shallow dish of old stone ringed in brass, its feed a brass boss
  const prof = []; for (let i = 0; i <= 8; i++) { const q = (i / 8) * 1.3; prof.push([Math.max(0.01, q), q * q / 5]); }
  K.add(M.trim, T(lathe(prof, 24), [0, 10.1, 3.12], [Math.PI / 2, 0, 0]));
  K.add(brass, T(new THREE.TorusGeometry(1.32, 0.09, 4, 32), [0, 10.1, 3.46]));
  K.add(brass, T(new THREE.SphereGeometry(0.22, 10, 8), [0, 10.1, 3.5]));
  K.add(lampM, T(new THREE.SphereGeometry(0.38, 10, 8), [-4.6, 10.3, 4.38])); K.add(lampM, T(new THREE.SphereGeometry(0.38, 10, 8), [4.6, 10.3, 4.38]));
  // cables coming out from under the monolith's foot, through dark slots, into the paving
  for (const x of [-3.6, 3.8]) K.add(M.dark, box(1.4, 0.4, 0.6, x, 0.2, 4.2));
  for (const [x, k] of [[-3.9, 1.4], [-3.4, 1.9], [3.6, 1.5], [4.1, 2.2]]) K.add(M.dark, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, 0.18, 4.0), V(x * k * 0.8, 0.12, 6.5), V(x * k, 0.05, 9.5)]), 12, 0.15, 5));
  K.flush();
  const at = K.world(0, sill, 1.4);
  const front = K.world(0, 0, 6);
  // the market's crowd keeps off the doorway (crowdSpots' clear circles, src/crowd.js)
  if (level.crowdSpots) { const spots = level.crowdSpots; level.crowdSpots = function (...a) { const r = spots.apply(this, a); (r.clear ??= []).push({ x: front.x, z: front.z, r: 6.5 }, { x: at.x, z: at.z, r: 5 }); return r; }; }
  return { door: { at, heading: yaw }, kit: K, sill, lampM, clear: [{ x: front.x, z: front.z, r: 7 }] };
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
      rt.notice?.(`From the top of the silent tower, in a voice older than the market: “${LINE.join(' ')}.”`);
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
  gadget: 'echo', gadgetBox: 'bazaar.temple.echo', arenaDoor: 'd4',
  origin: [-200, 1600, -520], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'pell', out: 6, side: 6 },
  enterLine: 'Under the silent tower it is cold and dry and very old. Somewhere far down, a voice says one word, and waits, and says it again.',
  pitLine: 'You climb back up out of the cables, to the last glyph stone.',
  onResolved(rt) { rt.notice('Up in the square, the silent tower has a lamp on its crown. At night it will speak.', 'resolved.out'); },
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
        if (!byDish(pos)) rt.notice('Its dish is turned up to the dark: it hears nothing near it now, only what its cables bring from the dishes on the wall.', 'fs.cables');
        return;
      }
      if (G.state !== 'open') { rt.notice(G.phaseIndex >= 2 ? 'Its cables hum with the word, but it is not listening yet. Wait for it to stop.' : 'It hears you, but it is not listening yet. Wait for it to lower its dish.', G.phaseIndex >= 2 ? 'fs.notyet2' : 'fs.notyet'); return; }
      if (note !== `sign.${word()}`) {
        rt.notice(note?.startsWith?.('sign.') ? 'It hears its own old word, and shakes its dish. It has moved on: catch the new one.' : 'It hears the note, and shakes its dish. That is not its word.', `fs.wrong.${note}`);
        return;
      }
      G.add(0.25, 'echo');
      rt.rumble(0.6, 0.4);
      if (cabled) rt.notice('The word runs down the cable from the dish on the wall, and its lamps answer.', 'fs.cabled');
      const next = word();
      if (G.state !== 'resolved') rt.notice(`It hears its word come back, and stops, and says the next: “${LINE[next]}”.`, `fs.next.${next}`);
      if (G.state === 'open') { G.enter('fight'); G.cool = 2.0; }
    }));
  },
};
