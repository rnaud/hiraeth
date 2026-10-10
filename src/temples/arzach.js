import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Ball, Plate, Gust, Updraft, Platform, Mark, Pit } from './pieces.js';
import { elderModel } from './guardians.js';
import { items } from '../items.js';

// Vael's temple: the Aerie, a great white house of the makers on the plain
// west of the landing, two drums of bone-white stone and a crown of stone
// wings on top. It is where the makers gave Vael's great birds their wings;
// the birds were raised in its roost. The oldest of them, the Elder, so old
// her feathers have gone to stone, kept the house. The night the light went
// over she stopped flying, and the others left, and she stayed.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: ONE WIND, AND IT COMES
// OUT WHEREVER NO STONE STOPS IT (reworked from the temple design audit, v1.16). The makers' wind comes up from
// under the house; a stone ball rolled into a vent's mouth stops it there, and it comes out of another. On foot
// the wind is in your way; with the wings it carries you.
//   the Threshold        the first mark, the way out
//   the Hall of Winds    gusts blow down it out of the vent in its far mouth and shove you back: wait them out
//                        behind the stone screens, screen to screen
//   the Wind Well        the hub: a tall round shaft open to the sky through a crown of stone feathers, bands of
//                        ochre, glyph lines up its walls like the lines on a wing. Its air is still: the stone sits
//                        in the floor's vent. Roll it along its groove into the hall's vent (behind you, in the
//                        corridor's mouth) and the hall falls calm, and the wind rises up the well, and the feather
//                        raft by the east wall rides up on it to the Wing Chamber's balcony
//   the Wing Chamber     the makers' chest: the FLUID WINGS (src/items.js 'glider'). Step back out onto the
//                        balcony and into the column of wind: it lifts open wings, round and up, to the high
//                        balcony over the well, the great carved eye beside it (the wind you sent, a room away)
//   the Gulf             two crossings, each on a wind you send. Forty-six metres of nothing to a stone perch
//                        four lower: on still air no glide carries so far. A vent's mouth over the door, its stone
//                        in the throat in the ledge's floor: push it out and the wind pours out over the gulf in
//                        gusts; leap as one comes, and it carries your wings to the perch (the gust that shoved you
//                        back in the hall, with the wings and the push). Then a ledge six metres HIGHER than the
//                        perch: no glide climbs. A vent far below beside the perch, its throat on the perch with
//                        its stone in it: push it out and a column rises past the perch, and lifts you (the well's
//                        lesson, from a perch over nothing)
//   the Roost            the guardian (organic: you calm her): the Elder, under the open sky. Two vents in its floor
//                        and one stone: in one, the wind rises from the other. When she spreads her wings and looks
//                        up, afraid, ride the wind beside her; she will not fly alone. In the wind her wings lift
//                        twice as high (her second phase); in her last, only the wind will do: roll the stone so
//                        the wind rises by her, then ride it up beside her
// After: the Elder sits on the Aerie's crown with her wings open, and the great birds wheel over it again.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On the plain west of the landing; its door looks east, back toward the landing. */
export const SITE = { x: -220, z: -20, r: 18, path: [-180, -12] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

/**
 * The Aerie's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/aerie):
 * warm ivory in tall smooth panels, banded in ochre (a band under every frieze and one low), the frames ochre, a long
 * feather carved under every frieze, the glyphs ochre-gold; its shade a peach-rose that keeps the ivory warm, its light
 * warm.
 */
export const PALETTE = {
  wall: '#f3e7d3', wall2: '#eee0c8', wall3: '#f8efe0', floor: '#ecdcc2', floor2: '#e0cfb2', trim: '#dc9e44',
  dark: '#4a4a5e', stone: '#efe3d0', accent: '#b98f9a', glow: '#7cc1c4', glyph: '#d0903a', lamp: '#f6c84e', sand: '#f0dcc0', sand2: '#e3bf9c', void: '#34405e',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.85, shade: 0.55, hatch: 0.5 },
    wall: { mode: 0 },
    glyph: { glow: 0.25 },
  },
  bands: [{ at: 0.72, h: 0.9, color: '#e2a446' }, { at: 0.3, h: 0.45, color: '#e2a446' }],
  ornament: { kind: 'feather', color: '#eadcc4', color2: '#c98f3a' },
  light: { shadow: '#dcb4aa', light: '#fff3e0', sun: '#ffe2b8' },
};

export const LOGIC = {
  id: 'arzach', entry: 'threshold', gadget: 'glider',
  rooms: { threshold: { checkpoint: true }, gusts: { checkpoint: true }, well: { checkpoint: true }, wings: { checkpoint: true }, top: { checkpoint: true }, gulf: { checkpoint: true }, perch: { checkpoint: true }, gulfFar: { checkpoint: true }, roost: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'gusts' },
    { a: 'gusts', b: 'well' },                                          // through the gusts, screen to screen
    { a: 'well', b: 'wings', door: 'raft' },                            // the feather raft rides up on the well's wind
    { a: 'wings', b: 'top', needs: ['glider'] },                        // the column (the raft's wind) lifts only open wings
    { a: 'top', b: 'gulf' },
    { a: 'gulf', b: 'perch', door: 'tail', needs: ['glider'] },         // the Gulf: too far on still air, carried by the vent's gusts
    { a: 'perch', b: 'gulfFar', door: 'rise', needs: ['glider'] },      // to a ledge higher than the perch: lifted by the column beside it
    { a: 'gulfFar', b: 'roost', door: 'd3' },
    { a: 'roost', b: 'out', door: 'd5' },
  ],
  elements: {
    // the hall's stone: pushed up the hall through the gusts into its vent (pH), the hall falls calm and the wind rises in the well
    ballW: { type: 'drum', room: 'gusts', plate: 'pH', plateAt: 1, start: 0 },
    pH: { type: 'plate', room: 'gusts' },
    raft: { type: 'door', opens: { drumOn: ['ballW', 'pH'] } },
    chest: { type: 'gadget', room: 'wings', item: 'glider' },
    // the Gulf's vent: its throat a grate on the high balcony, its stone in it (pB); rolled out to the cup (pX), the wind pours over the gulf
    ballB: { type: 'drum', room: 'top', plate: 'pB', plateAt: 0, stops: { pB: 0, pX: 1 }, start: 0 },
    pB: { type: 'plate', room: 'top' },
    pX: { type: 'plate', room: 'top' },
    tail: { type: 'door', opens: { not: { drumOn: ['ballB', 'pB'] } } },
    // the perch: the column's stone in its throat (pP); rolled out to the cup (pQ), the wind rises beside the perch
    ballP: { type: 'drum', room: 'perch', plate: 'pP', plateAt: 0, stops: { pP: 0, pQ: 1 }, start: 0 },
    pP: { type: 'plate', room: 'perch' },
    pQ: { type: 'plate', room: 'perch' },
    rise: { type: 'door', opens: { not: { drumOn: ['ballP', 'pP'] } } },
    d3: { type: 'door' },                                                // (the arena's door: it shuts behind you)
    // the Roost: two vents, one stone (the west, pRW, or the east, pRE): the wind rises from the other
    ballR: { type: 'drum', room: 'roost', plate: 'pRW', plateAt: 0, stops: { pRW: 0, pRE: 1 }, start: 0 },
    pRW: { type: 'plate', room: 'roost' },
    pRE: { type: 'plate', room: 'roost' },
    elder: { type: 'boss', room: 'roost', needs: ['gun', 'glider'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const ELDER = {
  kind: 'organic', name: 'the Elder', final: 'touch', touch: 'lay a hand on her neck',
  speed: 1.6, wakeTime: 3.2,
  wake: 'In the roost something heavy shifts: a great bird of stone-white feathers unfolds from the floor, and sees you, and hisses.',
  openHint: 'She spreads her wings and looks up at the open sky, trembling, and does not go.',
  weary: 'She folds her wings and settles, the glyphs on them bright with the wind. Go to her.',
  resolved: 'The Elder stretches her neck to you, then opens her wings wide, and rides the wind up out of the roost.',
  missHint: 'Her beak is caught in the floor: she pulls, wings spread, and looks up at the open sky.',
  phases: [
    { to: 0.45, attacks: ['peck', 'stamp', 'buffet'], pause: 1.5, hint: 'When she spreads her wings and looks up, afraid, ride the wind beside her: open your wings near her.' },
    { to: 0.75, attacks: ['buffet', 'dive', 'gale'], pause: 1.3, hint: 'She has left the floor, beating hard. When she hangs in the air, over a vent, fly with her again: in the wind out of it her wings lift twice as high.' },
    { to: 0.9, attacks: ['feathers', 'peck', 'gale'], pause: 1.1, hint: 'Stone feathers fall from her, her glyph lines burning, and she will not trust still air now. When she hangs over a vent, roll the stone into the other so the wind rises by her, and ride it up beside her.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    peck: { shape: 'lane', range: 8, width: 2.4, wind: 1.0, track: 0.7, part: 'mouth', rig: 'lean', damage: 0.5, knock: 8, recover: 0.6, then: 'peck2' },
    peck2: { shape: 'lane', range: 8, width: 2.4, wind: 0.65, track: 0.6, part: 'mouth', rig: 'lean', pose: 'peck', link: true, damage: 0.5, knock: 8, gap: 0.2, then: 'buffetEnd' },
    buffet: { shape: 'cone', range: 11, angle: 0.8, wind: 1.3, track: 0.6, part: 'wings', rig: 'lean', damage: 0.75, knock: 13, recover: 0.7 },
    buffetEnd: { shape: 'cone', range: 11, angle: 0.8, wind: 1.1, track: 0.5, part: 'wings', rig: 'lean', pose: 'buffet', link: true, damage: 0.75, knock: 13, recover: 0.8, open: 4.2 },
    stamp: { shape: 'ring', at: 'self', radius: 7, wind: 1.4, part: 'feet', rig: 'rear', damage: 0.75, knock: 10, recover: 0.8, open: 4.2 },
    // (a dive that misses you drives her beak into the floor: she is stuck there longer, missHint; ROOST.miss on top)
    dive: { shape: 'ring', at: 'player', radius: 4, wind: 1.6, track: 0.6, over: true, part: 'mouth', rig: 'rise', damage: 0.75, knock: 9, recover: 0.9, open: 4.2, miss: 5.6 },
    gale: { shape: 'lane', range: 20, width: 5, wind: 1.3, track: 0.6, part: 'wings', rig: 'swell', pose: 'buffet', damage: 0.5, knock: 16, recover: 0.7, then: 'diveEnd' },
    diveEnd: { shape: 'ring', at: 'player', radius: 4, wind: 1.2, track: 0.6, over: true, part: 'mouth', rig: 'rise', pose: 'dive', link: true, damage: 0.75, knock: 9, recover: 0.9, open: 4.2, miss: 5.6 },
    feathers: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'wings', rig: 'swell', pose: 'buffet', damage: 0.5, knock: 6, recover: 0.7 },
  },
};

/**
 * The Roost's vents: x of each from the middle (m); flying beside her: how near (m, level) and how long (s) a ride
 * takes; what one ride is worth in the wind and out of it, phase by phase (in her last, out of the wind: nothing);
 * how long she hangs there, looking up, in her last two phases (s: time to roll the stone and ride up); aloft, how near
 * the nearer vent she drifts (m) and how fast (m/s).
 */
/**
 * The Gulf: the first leg (m, lip to perch) too far for a glide on still air and short enough with the tailwind
 * (carry, m/s, while it blows); the perch's radius and height; the second leg up to a ledge higher than the perch;
 * the column beside the perch (its x and top).
 */
export const GULF = { leg1: 46, perchR: 5.2, perchY: 28, leg2: 16, farY: 34, carry: 10, column: 8, top: 46 };
export const ROOST = { vent: 8, near: 12, ride: 0.7, wind: [0.15, 0.3, 0.075], still: [0.15, 0.15, 0], open: [null, 5.2, 6.6], miss: 1.4, over: 4.5, drift: 3 };
/** Is p (the traveller) in the wind out of one of the roost's vents? */
const inWind = (rt, p) => !!rt.roostWinds?.some((w) => w.contains(p));
/** How long she hangs open: her phase's hang aloft at least; a dive that missed (her beak stuck) ROOST.miss longer. */
export function elderOpenFor(g, a, s, missed = false) {
  const o = ROOST.open[Math.min(g.phaseIndex, 2)];
  const base = s && o ? Math.max(s, o) : s;
  return missed && base ? Math.max(base, (o ?? 0) + ROOST.miss) : base;
}

function elderHit(g, part, mode) {
  if (mode === 'push') { g.add(-0.04, 'push'); g.rt.notice('She flinches from the shove and hisses, more frightened.', 'elder.push'); return true; }
  if (mode === 'stun') return false;   // (the stilling lens stops a strike, as anywhere)
  g.rt.notice('The fluid beads on her stone feathers. It is not water she wants: it is the wind.', 'elder.fluid');
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  /** A stone feather: a long flat blade, its quill at p, leaning out. */
  const feather = (mat, x, y, z, len, yaw, tilt, solid = false) => K[solid ? 'both' : 'add'](mat, T(new THREE.SphereGeometry(1, 10, 6).scale(0.9, len / 2, 0.22).translate(0, len / 2, 0), [x, y, z], [tilt, yaw, 0], 1, 'YXZ'));

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: 6, h: 7 }] });

  // ---- the Hall of Winds (z 12.6..52): gusts down it; stone screens to wait behind
  K.hall({ x: 0, z: 32.3, w: 16, d: 39.4, y: 0, h: 12, roof: true, columns: 0, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4 }] });
  const shelters = [];
  for (const [i, z] of [22, 31, 40].entries()) {
    for (const x of [-4.2, 4.2]) {
      K.both(M.wallGlyph, box(3.4, 7, 1.0, x, 3.5, z));
      K.add(M.trim, box(3.6, 0.4, 1.2, x, 7.2, z));
      shelters.push([[x - 1.5, -1, z - 2.6], [x + 1.5, 9, z - 0.45]]);
    }
    if (i < 2) for (const x of [-7.2, 7.2]) feather(M.trim, x, 0, z + 4.5, 7, 0, 0);
  }
  // (the hall's wind comes up through the vent in its mouth, by the well: it blows while no stone sits in it)
  add(Gust, { min: [-8, -1, 13], max: [8, 12, 51.6], dir: [0, 0, -1], shelters, calm: 3.2, blow: 2.2, warn: 0.8, push: 7.5, when: { not: { drumOn: ['ballW', 'pH'] } } });
  // the stone, too heavy for the gusts: up its groove the length of the hall into the vent's socket in the corridor's
  // mouth (pH), a push at a time in the calms. Seated, it stops the hall's wind, and the wind rises in the well instead
  K.add(M.dark, box(1.0, 0.04, 53.4 - 15, 0, 0.02, (53.4 + 15) / 2));
  add(Ball, { id: 'ballW', a: [0, 0.04, 15.6], b: [0, 0.04, 53.4], r: 1.1, friction: 0.6 });
  add(Plate, { id: 'pH', at: [0, 0, 53.4], r: 1.3 });
  add(Mark, { room: 'gusts', at: [-6, 0, 16], yaw: Math.PI / 2 });

  // ---- the corridor and the Wind Well (the hub: a tall round shaft open to the sky through a crown of stone feathers)
  K.slab(-3.2, 51.8, 3.2, 56.4, 0, 0.8);
  K.wall(-3.2, 52.6, -3.2, 56.2, 0, 6.4, { t: 0.8 }); K.wall(3.2, 56.2, 3.2, 52.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 4.4, 0, 6.8, 54.4));
  const C2 = 68, WR = 12, WH = 46;
  K.rotunda({ x: 0, z: C2, y: 0, r: WR, h: WH, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: Math.PI / 2, w: 5, h: 6.4, y0: 16 }, { a: 0, w: 5, h: 6.4, y0: 32 }], oculus: 0.66 });
  // bands of ochre round it, glyph lines up its walls like the lines on a wing, carved ledges low down, the crown
  for (const y of [8, 24, 40]) K.both(M.trim, T(annulus(WR - 0.35, WR + 0.1, 0.7, 72), [0, y, C2]));
  const wingLines = makeMaterial({ color: PALETTE.glow, glow: 0.35, flat: true, key: 'temple.vael.winglines' });
  const off = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.11;
    if (off(a, Math.PI) < 0.35) continue;
    for (const [y0, y1] of [[1.5, 7.2], [9, 23], [25, 39]]) {
      if ((off(a, Math.PI / 2) < 0.35 && y1 > 15 && y0 < 23) || (off(a, 0) < 0.35 && y1 > 31)) continue;
      K.add(wingLines, T(new THREE.BoxGeometry(0.16, y1 - y0, 0.08), [Math.sin(a) * (WR - 0.05), (y0 + y1) / 2, C2 + Math.cos(a) * (WR - 0.05)], [0, a, Math.sin(i * 1.7) * 0.05]));
    }
  }
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; if (off(a, Math.PI) < 0.4 || off(a, Math.PI / 2) < 0.5) continue; K.both(M.floor, T(new THREE.BoxGeometry(1.6, 0.5, 1.2), [Math.sin(a) * (WR - 0.6), 3.2 + (i % 3) * 1.4, C2 + Math.cos(a) * (WR - 0.6)], [0, a, 0])); }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + 0.2, len = 14 + (i % 3) * 4; feather(i % 4 === 1 ? M.trim : M.wall, Math.sin(a) * (WR + 0.6), WH + 0.9, C2 + Math.cos(a) * (WR + 0.6), len, a, 0.45, true); }   // (solid: a climber up the well meets them as drawn)
  // the vent in the well's floor: the wind rises out of it while the hall's vent is stopped (its grate, still till then)
  K.add(M.trim, T(annulus(4.4, 5, 0.05, 40), [0, 0.02, C2]));
  for (let i = 0; i < 6; i++) K.add(M.dark, box(8.6, 0.05, 0.3, 0, 0.04, C2 - 3.75 + i * 1.5));
  add(Updraft, { at: [0, 0, C2], r: 4.5, h: 36, lift: 7, when: { drumOn: ['ballW', 'pH'] }, still: 'Still air over the grate: the wind goes down the hall. Nothing rises here.' });
  // the feather raft by the east wall: the well's wind lifts it to the Wing Chamber's balcony
  add(Platform, { id: 'raft', path: [[7.9, 0.3, C2], [7.9, 16, C2]], r: 2.2, speed: 1.6, pause: 2.2, when: { drumOn: ['ballW', 'pH'] } });
  K.add(M.trim, T(annulus(2.4, 2.9, 0.05, 32), [7.9, 0.02, C2]));
  K.slab(10.2, C2 - 2.8, WR + 0.8, C2 + 2.8, 16, 0.7);
  for (const s of [-1, 1]) feather(M.trim, 10.6, 16, C2 + s * 2.6, 4, Math.PI / 2, s * 0.3);
  add(Mark, { room: 'well', at: [-6.5, 0, C2 - 7], yaw: Math.PI * 0.75 });

  // ---- the Wing Chamber (east, floor 16): the chest
  K.slab(WR + 0.6, C2 - 3.2, WR + 4.2, C2 + 3.2, 16, 0.8);
  K.wall(WR + 0.8, C2 - 3.2, WR + 4.2, C2 - 3.2, 16, 6.4, { t: 0.8 }); K.wall(WR + 4.2, C2 + 3.2, WR + 0.8, C2 + 3.2, 16, 6.4, { t: 0.8 });
  K.both(M.wall, box(3.6, 0.8, 7.2, WR + 2.5, 22.8, C2));
  const C3x = WR + 4 + 8.6;
  K.rotunda({ x: C3x, z: C2, y: 16, r: 8.6, h: 12, gaps: [{ a: -Math.PI / 2, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(C3x, 16, C2), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(C3x, 16.31, C2));
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) feather(M.wall, C3x - 2 + i * 2.2, 16, C2 + s * (5.6 - i * 0.4), 6 + i, Math.PI / 2 + s * 0.4, s * 0.25);
  add(Mark, { room: 'wings', at: [C3x + 4, 16, C2 - 5], yaw: -Math.PI * 0.75 });

  // ---- the high balcony over the well (floor 32): the great carved eye beside it, the way north to the gulf
  K.slab(-6.4, C2 + WR - 5.2, 6.4, C2 + WR + 1, 32, 0.7);
  K.add(M.trim, box(12.8, 0.35, 0.35, 0, 33.1, C2 + WR - 5.15));
  for (const s of [-1, 1]) K.add(M.trim, box(0.35, 1.1, 0.35, s * 6.3, 32.55, C2 + WR - 5.15));
  // the gulf vent's throat: a grate in the balcony, its stone in it (pB); its cup at the groove's end (pX)
  K.add(M.dark, box(8, 0.04, 1.0, 0, 32.02, C2 + WR - 3.2));
  K.add(M.trim, T(annulus(1.5, 2.1, 0.05, 32), [-3.6, 32.02, C2 + WR - 3.2]));
  add(Ball, { id: 'ballB', a: [-3.6, 32.04, C2 + WR - 3.2], b: [3.6, 32.04, C2 + WR - 3.2], r: 1.1 });
  add(Plate, { id: 'pB', at: [-3.6, 32, C2 + WR - 3.2], r: 1.3 });
  add(Plate, { id: 'pX', at: [3.6, 32, C2 + WR - 3.2], r: 1.3 });
  K.both(M.wall, T(new THREE.ConeGeometry(3.2, 6, 4, 1, true).rotateY(Math.PI / 4), [0, 28.6, C2 + WR - 1.4], [Math.PI, 0, 0]));   // its corbel, down the wall
  {
    // the eye: a great carved lid and iris in the wall to the balcony's left, as the makers carved their birds
    const a = -0.42, ex = Math.sin(a) * (WR - 0.2), ez = C2 + Math.cos(a) * (WR - 0.2);
    // (solid as drawn: a climber up the well meets it)
    K.both(M.trim, T(new THREE.TorusGeometry(2.2, 0.28, 6, 28).scale(1.4, 0.8, 1), [ex, 36, ez], [0, a, 0]));
    K.both(M.stone, T(new THREE.SphereGeometry(1.3, 16, 10).scale(1, 1, 0.35), [ex, 36, ez], [0, a, 0]));
    K.add(M.dark, T(new THREE.SphereGeometry(0.55, 12, 8).scale(1, 1, 0.3), [ex - Math.sin(a) * 0.35, 36, ez - Math.cos(a) * 0.35], [0, a, 0]));
    K.both(M.trim, T(new THREE.TorusGeometry(2.6, 0.18, 4, 24, Math.PI).scale(1.5, 0.9, 1), [ex, 36.7, ez], [0, a, 0]));
  }
  add(Mark, { room: 'top', at: [5.2, 32, C2 + WR - 0.4], yaw: -Math.PI / 2 });

  // ---- the corridor and the Gulf: two crossings, each on a wind you send. First, forty-six metres of nothing to
  // a stone perch four lower: on still air no glide carries so far; the vent over the door does, its stone rolled out
  // of its throat (a tailwind, in gusts). Then from the perch to a ledge six HIGHER: no glide climbs; the vent far
  // below beside the perch does, its throat on the perch, its stone in it (a column, as in the well)
  K.slab(-3.2, C2 + WR + 0.4, 3.2, C2 + WR + 3.6, 32, 0.8);
  K.wall(-3.2, C2 + WR + 1, -3.2, C2 + WR + 3.6, 32, 6.4, { t: 0.8 }); K.wall(3.2, C2 + WR + 3.6, 3.2, C2 + WR + 1, 32, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.2, 0, 38.8, C2 + WR + 2.2));
  const G0 = C2 + WR + 3.6, { leg1, perchR, leg2, perchY, farY } = GULF;
  const PZ = G0 + 6 + leg1 + perchR, FZ = PZ + perchR + leg2, GD = FZ + 12 - G0;
  K.hall({ x: 0, z: G0 + GD / 2, w: 22, d: GD, y: 2, h: 52, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 30 }, { side: 'n', w: 5, h: 6.4, y0: farY - 2 }] });
  K.slab(-11, G0, 11, G0 + 6, 32, 30);
  K.slab(-11, FZ, 11, FZ + 12, farY, farY - 2);
  K.both(M.dark, box(22, 1, FZ - G0 - 6, 0, 1.5, (G0 + 6 + FZ) / 2));
  add(Pit, { room: 'gulf', min: [-12, -2, G0 + 6], max: [12, 24, FZ] });
  K.add(M.trim, box(22, 0.5, 1.4, 0, 31.8, G0 + 6.4));
  for (let i = 0; i < 8; i++) feather(M.trim, (i % 2 ? -1 : 1) * (4 + (i % 3) * 2.4), 53.4, G0 + 10 + i * 7.5, 9, 0, Math.PI);   // stone feathers hanging over the gulf
  // the tail vent: its mouth high over the door, feathers round it (its throat is the grate on the balcony behind you,
  // a pipe along the corridor's roof between them)
  K.add(M.voidM, T(new THREE.CircleGeometry(2.4, 24), [0, 41.5, G0 + 0.05]));
  K.both(M.trim, T(new THREE.TorusGeometry(2.6, 0.3, 6, 28), [0, 41.5, G0 + 0.1]));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; feather(M.wall, Math.sin(a) * 3.2, 41.5 + Math.cos(a) * 3.2, G0 + 0.3, 2.2, 0, 0, true); }
  K.add(M.trim, T(new THREE.CylinderGeometry(0.7, 0.7, G0 - (C2 + WR) + 1.4, 12), [0, 40.2, (G0 + C2 + WR) / 2 - 0.2], [Math.PI / 2, 0, 0]));
  add(Gust, { min: [-11, 16, G0 + 6.6], max: [11, 48, PZ - perchR], dir: [0, 0, 1], calm: 1.8, warn: 0.6, blow: 3.6, push: 6, carry: GULF.carry,
    when: { not: { drumOn: ['ballB', 'pB'] } },
    notice: 'The gust shoves you out toward the gulf.', carried: 'The wind out of the vent fills your wings and carries you out over the gulf.' });
  add(Mark, { room: 'gulf', at: [7, 32, G0 + 3], yaw: 0 });
  // the perch: a feathered round of stone on a tall pillar out of the dark; the column's throat on it, and its stone
  K.both(M.wall, new THREE.CylinderGeometry(perchR * 0.55, perchR * 0.7, perchY - 2, 16).translate(0, (perchY + 2) / 2 - 0.4, PZ));
  K.both(M.floor, new THREE.CylinderGeometry(perchR, perchR * 0.8, 1.4, 24).translate(0, perchY - 0.7, PZ));
  K.add(M.trim, T(annulus(perchR - 0.2, perchR + 0.15, 0.3, 40), [0, perchY - 0.1, PZ]));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.4; if (Math.abs(Math.sin(a)) > 0.75 && Math.cos(a) > -0.2) continue; feather(i % 3 ? M.wall : M.trim, Math.sin(a) * (perchR + 0.3), perchY - 1.4, PZ + Math.cos(a) * (perchR + 0.3), 3.4 + (i % 2), a, 0.9); }
  K.add(M.dark, box(6.6, 0.04, 1.0, 0.2, perchY + 0.02, PZ));
  add(Ball, { id: 'ballP', a: [-2.6, perchY + 0.04, PZ], b: [3, perchY + 0.04, PZ], r: 1.1 });
  add(Plate, { id: 'pP', at: [-2.6, perchY, PZ], r: 1.3 });
  add(Plate, { id: 'pQ', at: [3, perchY, PZ], r: 1.3 });
  add(Updraft, { at: [GULF.column, 2, PZ], r: 3, h: GULF.top - 2, lift: 7.5, when: { not: { drumOn: ['ballP', 'pP'] } }, still: 'Still air: the column’s stone sits in its throat, up on the perch.' });
  K.add(M.trim, T(annulus(2.9, 3.4, 0.2, 32), [GULF.column, 2.1, PZ]));
  add(Mark, { room: 'perch', at: [-2.4, perchY, PZ - 3.2], yaw: 0 });
  add(Mark, { room: 'gulfFar', at: [7, farY, FZ + 6], yaw: Math.PI });

  // ---- the corridor, and the Roost (floor farY): a round hall under the open sky; two vents in its floor, one stone
  const RY = farY, F0 = FZ + 12;
  K.slab(-3.2, F0 - 0.6, 3.2, F0 + 3.4, RY, 0.8);
  K.wall(-3.2, F0 + 0.2, -3.2, F0 + 3.4, RY, 7, { t: 0.8 }); K.wall(3.2, F0 + 3.4, 3.2, F0 + 0.2, RY, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, RY + 7.4, F0 + 1.6));
  add(Door, { id: 'd3', at: [0, RY, F0 + 1.2], w: 5, h: 6.4 });
  add(Mark, { room: 'ante', at: [2.2, RY, F0 - 0.2], yaw: -Math.PI / 2 });
  const HR = 19, CL = F0 + 3.2 + HR + 0.2;
  K.rotunda({ x: 0, z: CL, y: RY, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.6 });
  // the roost's stone: in the west vent the wind rises from the east one, and the other way round
  K.add(M.dark, box(ROOST.vent * 2 + 1.6, 0.04, 1.0, 0, RY + 0.02, CL));
  add(Ball, { id: 'ballR', a: [-ROOST.vent, RY + 0.04, CL], b: [ROOST.vent, RY + 0.04, CL], r: 1.1, friction: 0.3 });   // (one push carries it across)
  add(Plate, { id: 'pRW', at: [-ROOST.vent, RY, CL], r: 1.3 });
  add(Plate, { id: 'pRE', at: [ROOST.vent, RY, CL], r: 1.3 });
  rt.roostWinds = [
    add(Updraft, { at: [ROOST.vent, RY, CL], r: 4.5, h: 16, lift: 6, when: { drumOn: ['ballR', 'pRW'] }, hint: 'The wind rushes up out of the vent. Open your wings in it.' }),
    add(Updraft, { at: [-ROOST.vent, RY, CL], r: 4.5, h: 16, lift: 6, when: { drumOn: ['ballR', 'pRE'] }, hint: 'The wind rushes up out of the vent. Open your wings in it.' }),
  ];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.3; if (off(a, 0) < 0.4 || off(a, Math.PI) < 0.4) continue; feather(M.trim, Math.sin(a) * (HR - 0.8), RY, CL + Math.cos(a) * (HR - 0.8), 14, a + Math.PI, 0.2); }
  add(Door, { id: 'd5', at: [0, RY, CL + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CL + HR + 0.6, 3.2, CL + HR + 10, RY, 0.8);
  K.wall(-3.2, CL + HR + 1.4, -3.2, CL + HR + 10, RY, 7, { t: 0.8 }); K.wall(3.2, CL + HR + 10, 3.2, CL + HR + 1.4, RY, 7, { t: 0.8 });
  K.wall(3.2, CL + HR + 10, -3.2, CL + HR + 10, RY, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, RY + 7.4, CL + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, RY, CL + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, RY + 2.5, CL + HR + 10.9));

  const model = elderModel();
  model.pos.copy(K.world(0, RY, CL + 6));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, RY, CL + 5);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, RY, CL), r: HR, y: K.world(0, RY, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -6, -3), V(C3x + 12, Math.max(WH, GULF.top, RY + 24) + 22, CL + HR + 12)),
    gadget: { at: W(C3x, 16.62, C2).toArray(), face: K.heading(-Math.PI / 2) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, RY + 0.5, CL + HR + 9.6), r: 1.5 }],
    lights: [[0, 5, 6, 10], [0, 6, 32, 14], [0, 10, C2, 16], [0, 34, C2, 16], [C3x, 20, C2, 10], [0, 36, G0 + 20, 22], [0, 36, PZ + 10, 22], [0, RY + 6, CL, 18]],
    guardian: { def: { ...ELDER, onHit: elderHit, openFor: elderOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Aerie on the plain
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 14;
  const base = level.ground.baseAt(SITE.x, SITE.z, SITE.r + 6) - 0.6;
  const K = new TempleKit(rt.root, 'The Aerie', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, sill = 4;
  const glyphM = makeMaterial({ color: PALETTE.glow, glow: 0.2, flat: true, key: 'temple.vael.glyph' });
  // a broad plinth, a great drum, a narrower drum on it, bands of ochre between
  K.both(M.floor, new THREE.CylinderGeometry(R + 7, R + 8, sill, 40).translate(0, sill / 2, 0));
  K.both(M.wall, new THREE.CylinderGeometry(R, R + 0.6, 18, 32).translate(0, sill + 9, 0));
  K.add(M.trim, new THREE.CylinderGeometry(R + 0.35, R + 0.35, 0.8, 32).translate(0, sill + 18, 0));
  K.both(M.wall, new THREE.CylinderGeometry(R - 4.5, R - 4, 12, 28).translate(0, sill + 24.4, 0));
  K.both(M.floor, T(annulus(R - 4.5, R + 0.3, 0.6, 32), [0, sill + 18.6, 0]));
  K.add(M.trim, new THREE.CylinderGeometry(R - 4.2, R - 4.2, 0.7, 28).translate(0, sill + 30.4, 0));
  K.both(M.floor, new THREE.CylinderGeometry(R - 4.5, R - 4.5, 0.6, 28).translate(0, sill + 30.7, 0));
  // the crown: tall stone feathers round the top, leaning out, and the perch in its middle
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, len = 16 + (i % 3) * 3;
    K.add(i % 3 === 1 ? M.trim : M.wall, T(new THREE.SphereGeometry(1, 10, 6).scale(1.5, len / 2, 0.35).translate(0, len / 2, 0), [Math.sin(a) * (R - 5.5), sill + 30.6, Math.cos(a) * (R - 5.5)], [0.42, a, 0], 1, 'YXZ'));
  }
  K.both(M.trim, new THREE.CylinderGeometry(1.2, 1.6, 6, 10).translate(0, sill + 34, 0));
  K.both(M.floor, new THREE.CylinderGeometry(3.4, 3, 0.8, 16).translate(0, sill + 37.4, 0));
  // glyph lines on the drum, like the lines on a wing
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + TAU / 16; K.add(glyphM, T(new THREE.BoxGeometry(0.25, 12, 0.2), [Math.sin(a) * (R + 0.35), sill + 9, Math.cos(a) * (R + 0.35)], [0, a, 0])); }
  // the doorway, after the picked entrance: a tall round-topped arch set in the drum, framed in ochre, the glyph over it
  const z0 = R - 1.5, z1 = R + 1.6, dw = 5.4, dh = 6.4;
  {
    // the porch's face: a slab of the drum's stone with the arch cut through it
    const W = dw + 6.8, H = 11, f = new THREE.Shape();
    f.moveTo(-W / 2, 0); f.lineTo(-dw / 2, 0); f.lineTo(-dw / 2, dh);
    f.absarc(0, dh, dw / 2, Math.PI, 0, true);
    f.lineTo(dw / 2, 0); f.lineTo(W / 2, 0); f.lineTo(W / 2, H); f.lineTo(-W / 2, H); f.closePath();
    K.both(M.wall, new THREE.ExtrudeGeometry(f, { depth: z1 - z0, bevelEnabled: false, curveSegments: 16 }).translate(0, sill, z0));
  }
  const ochre = { paint: new THREE.Color(PALETTE.trim), smooth: false, side: THREE.FrontSide };
  K.add(ochre, T(new THREE.TorusGeometry(dw / 2 + 0.15, 0.2, 5, 24, Math.PI), [0, sill + dh, z1 + 0.06]));
  for (const s of [-1, 1]) K.add(ochre, box(0.4, dh, 0.3, s * (dw / 2 + 0.15), sill + dh / 2, z1 + 0.06));
  K.add(ochre, T(new THREE.TorusGeometry(dw / 2 + 0.75, 0.12, 4, 24, Math.PI), [0, sill + dh, z1 + 0.05]));
  K.add(M.glyph, T(glyphGeometry(2.0, 0.15), [0, sill + dh + dw / 2 + 1.4, z1 + 0.06]));
  // (the dark in the doorway stands in front of the drum, which widens toward its foot)
  K.add(M.voidM, T(new THREE.PlaneGeometry(dw, dh).translate(0, dh / 2, 0), [0, sill, R + 1.0]));
  K.add(M.voidM, T(new THREE.CircleGeometry(dw / 2, 16, 0, Math.PI), [0, sill + dh, R + 1.0]));
  K.solid(box(dw, dh + dw / 2, 0.3, 0, sill + (dh + dw / 2) / 2, R + 0.9));
  // the great steps down to the plain
  const foot = level.ground.heightAt(...(() => { const p = K.world(0, 0, R + 16); return [p.x, p.z]; })()) - base;
  K.stairs([0, sill, R + 7.2], [0, Math.max(0.2, foot), R + 16], 9, { rise: 0.4 });
  K.flush();
  const at = K.world(0, sill, R + 1.4);
  return { door: { at, heading: yaw }, kit: K, base, R, sill, glyphM, perch: K.world(0, sill + 37.8, 0), clear: [{ x: SITE.x, z: SITE.z, r: R + 12 }] };
}

// ------------------------------------------------------------------ the world change: the birds come back
/**
 * Once the Elder flies again the Aerie is a roost once more: she sits on its crown with her wings open,
 * the glyph lines on its drum glow, and a flock of the great birds wheels over it, high and slow.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The Aerie’s birds (the world change)';
  rt.root.add(root);
  root.visible = false;
  // the Elder on the crown
  const perched = O ? elderModel() : null;
  if (perched) {
    perched.pos.copy(O.perch);
    perched.heading = SITE.heading;
    perched.group.position.copy(perched.pos);
    perched.group.rotation.y = perched.heading;
    root.add(perched.group);
  }
  // the flock: great white birds, soaring (a body, two long wings, a beak)
  const birdM = makeMaterial({ color: '#f4efe2', flat: true, key: 'temple.vael.bird' });
  const g = mergeGeometries([
    new THREE.SphereGeometry(1, 8, 6).scale(0.9, 0.7, 2.2),
    new THREE.SphereGeometry(1, 8, 4).scale(5.2, 0.12, 1.3).translate(4.6, 0.25, -0.2).rotateZ(0.12),
    new THREE.SphereGeometry(1, 8, 4).scale(5.2, 0.12, 1.3).translate(-4.6, 0.25, -0.2).rotateZ(-0.12),
    new THREE.ConeGeometry(0.25, 2.2, 6).rotateX(Math.PI / 2).translate(0, 0.2, 3.1),
  ].map((x) => x.toNonIndexed()));
  const flock = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(g, birdM);
    m.userData.noCollide = true; m.userData.dynamic = true;
    root.add(m);
    flock.push({ m, r: 38 + (i % 4) * 11, y: 58 + (i % 3) * 12, w: (0.11 + (i % 3) * 0.025) * (i % 2 ? 1 : -1), a: (i / 8) * TAU });
  }
  let k = 0, want = 0;
  const apply = () => { root.visible = k > 0.01; };
  return {
    root, flock, perched,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 4 : -dt / 2), 0, 1); apply(); }
      if (O) O.glyphM.uniforms.uGlow.value = 0.2 + 0.7 * k;
      if (!root.visible) return;
      const base = O ? O.base : 0;
      for (const b of flock) {
        b.a += b.w * dt;
        const x = SITE.x + Math.sin(b.a) * b.r, z = SITE.z + Math.cos(b.a) * b.r, y = base + b.y + Math.sin(t * 0.3 + b.a * 2) * 4;
        b.m.position.set(x, y, z);
        b.m.rotation.set(0, b.a + (b.w > 0 ? Math.PI / 2 : -Math.PI / 2), (b.w > 0 ? -0.35 : 0.35), 'YXZ');
      }
      perched?.animate(dt, t, { state: 'resolved', attack: null, k: 0, meter: 1, phase: 0 });
    },
  };
}

export const ARZACH_TEMPLE = {
  id: 'arzach', levelId: 'arzach', name: 'The Aerie', doorLabel: 'door of the Aerie',
  gadget: 'glider', gadgetBox: 'arzach.temple.glider', arenaDoor: 'd3',
  origin: [-200, 1600, 300], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'lark', out: 16, side: 7 },
  enterLine: 'Inside the Aerie it is bright and white and the wind never stops. Far overhead, something heavy shifts its feathers.',
  pitLine: 'You climb back up to the last glyph stone.',
  // the wings come first: Vael's tower is climbed on the wind with them, so the quest starts when you land without them
  startsOnArrival: () => !items.has('glider'),
  arrivalLine: 'The makers left a pair of wings in Vael: in the Aerie, the white house on the plain west of the landing.',
  onResolved(rt) { rt.notice('Out over the plain the great birds are coming back to the Aerie.', 'resolved.out'); },
  // she will not fly alone: ride the wind beside her while she looks up, afraid (in her second phase the wind out of
  // a vent lifts her twice as high; in her last only the wind will do: roll the stone so it rises by her)
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    let flown = 0;
    const upd = G.update.bind(G), _c = V();
    G.update = (dt, t) => {
      upd(dt, t);
      const P = rt.player;
      if (!P || G.state !== 'open') { flown = 0; return; }
      const i = Math.min(G.phaseIndex, 2);
      // aloft (her second phase on), she drifts over the nearer of the two vents and hangs there, looking up: the wind
      // has to come out of that one (the stone in the other)
      if (i >= 1 && rt.roostWinds?.length) {
        const m = G.model, w = rt.roostWinds.reduce((b, x) => (Math.hypot(x.foot.x - m.pos.x, x.foot.z - m.pos.z) < Math.hypot(b.foot.x - m.pos.x, b.foot.z - m.pos.z) ? x : b));
        const dx = w.foot.x - m.pos.x, dz = w.foot.z - m.pos.z, d = Math.hypot(dx, dz);
        if (d > ROOST.over) { const step = Math.min(d - ROOST.over, ROOST.drift * dt); m.pos.x += (dx / d) * step; m.pos.z += (dz / d) * step; G.keepIn(); }
      }
      _c.copy(G.model.pos).add(V(0, 4.4, 0));
      const near = Math.hypot(P.pos.x - _c.x, P.pos.z - _c.z) < ROOST.near && Math.abs(P.pos.y - _c.y) < ROOST.near;
      const wind = inWind(rt, P.pos);
      if (near && P.gliding) {
        if (!wind && !ROOST.still[i]) { flown = 0; rt.notice('She watches you sink past her on still air, and does not follow.', `elder.still.${G.phaseIndex}`); return; }
        if ((flown += dt) > ROOST.ride) {
          flown = 0;
          G.add(wind ? ROOST.wind[i] : ROOST.still[i], wind ? 'wind' : 'flown');
          rt.sound?.chime?.();
          if (wind && i >= 1) rt.notice('You ride the wind up beside her, and her wings fill with it and lift her high, and she cries out, not afraid.', `elder.wind.${G.phaseIndex}`);
          else rt.notice('She watches you ride the wind beside her, and her wings lift.', `elder.flown.${G.phaseIndex}`);
          if (G.state === 'open') { G.enter('fight'); G.cool = 2.2; }
        }
      } else {
        if (near && P.onGround) rt.notice('She will not go alone.', 'elder.alone');
        flown = Math.max(0, flown - dt);
      }
    };
  },
};
