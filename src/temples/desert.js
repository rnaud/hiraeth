import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { magicMaterial, magicPool, setMagic } from '../story/magic-water.js';
import { STORY } from '../desert-sites.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Ball, Brazier, Flame, Bramble, Bridge, Mark, Pit } from './pieces.js';
import { keeperModel } from './guardians.js';

// The desert's temple: the Givers' House, the great drum of rose stone the
// people of Qanat call the house of the Givers, half sunk in the dunes east
// of the city. The Givers kept the water there: a cistern under a dome,
// fed by channels that once ran to Qanat's fields. The water stopped long
// ago; the fields went to sand; the beast the Givers left to keep the cistern
// is still down there in the dark, and it is afraid.
//
// One idea (docs/audits/temple-design-v1.24.md): the Givers carried their fire. A tar ball set burning lights what it
// rolls into (a hooded bowl no ember reaches, the thorns on its groove) until it burns out; rolled past a fire, it
// catches again. Taught before the gadget with the house's one fire, the pilot flame; with ember mode you are the fire.
//
// Inside (built far overhead, through its door), in order:
//   the Threshold        a stair hall under an oculus: the first mark, the way back out
//   the Hall of the Flame the pilot flame that never went out, in the floor on a tar ball's groove: roll the ball
//                        through it and on into the hooded bowl by the door (pieces.js Ball `tar`, Brazier `hood`)
//   the Dry Channel      a sand pit; the bridge's sockets choked with dry thorns at the end of a ball's groove, the
//                        pilot flame at its other end, behind the ball: roll it back through the fire first, then
//                        into the thorns; a wall to climb to the gallery
//   the Chest Chamber    the makers' chest on a dais under the oculus: EMBER MODE (src/items.js 'fire'). The way on:
//                        the corridor's thorns (burn them, the gadget alone, where failure costs nothing); a tar ball
//                        by the dais whose groove runs through them to the Hall of Fires
//   the Hall of Fires    a chasm; the hooded bowl on the near lip at the end of the chest's ball's groove wakes the
//                        bridge. Light the ball, roll it: it burns through the thorns, if they stand, and on
//   the Hall of Channels east of the far landing: a ball whose long groove runs out through the doorway to the bowl by
//                        the far door; it burns out on the way, unless the relay brazier beside its groove (or your
//                        ember as it passes) lights it again. The relay also wakes the keepers' door back to the near
//                        ledge (the shortcut, from the far side)
//   the Cistern          the Keeper (an organic guardian: calm it, never hurt it). Light the four braziers round
//                        the dark cistern (it was afraid of the dark), splash water into its mouth when it pants (it
//                        was thirsty), then lay a hand on its brow. It turns to fire: a tar ball rolled burning down a
//                        spoke to it makes it pant (taught in its second phase); in its last it pants only so
// After: the water rises in the cistern and runs out of the house again, down the old channel;
// round Qanat the old fields turn green (the world change, `change` below).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** Where the house stands in the dunes (world x, z) and which way its door looks (toward Qanat). */
export const SITE = { x: 550, z: 376, r: 34 };
SITE.heading = Math.atan2(STORY.city.x - SITE.x, STORY.city.z - SITE.z);

export const PALETTE = {
  wall: '#f0d7c3', wall2: '#e8c4ae', wall3: '#f6e6d6', floor: '#e3c6a8', floor2: '#d8b694', trim: '#f6efe0',
  dark: '#34405e', stone: '#e9cdb6', accent: '#dd8f86', glow: '#70e7df', lamp: '#f6c84e', sand: '#e8cf9c', sand2: '#dcbd86',
};

// ------------------------------------------------------------------ the puzzle, as logic (src/temples/logic.js)
export const LOGIC = {
  id: 'desert', entry: 'threshold', gadget: 'fire',
  rooms: {
    threshold: { checkpoint: true }, flame: { checkpoint: true }, channel: { checkpoint: true }, chest: { checkpoint: true },
    fires: { checkpoint: true }, firesFar: {}, wing: { checkpoint: true }, ante: { checkpoint: true }, cistern: { boss: true }, spring: {},
  },
  links: [
    { a: 'threshold', b: 'flame' },
    { a: 'flame', b: 'channel', door: 'd1' },
    { a: 'channel', b: 'chest', door: 'br0' },    // the bridge over the sand, then the wall to climb
    { a: 'chest', b: 'fires', door: 'bw0' },      // the corridor's thorns
    { a: 'fires', b: 'firesFar', door: 'br1' },   // the bridge
    { a: 'firesFar', b: 'wing' },                 // the far landing's east door, into the Hall of Channels
    { a: 'fires', b: 'wing', door: 'sc' },        // the keepers' door: the shortcut, woken from the wing's side
    { a: 'firesFar', b: 'ante', door: 'd3' },
    { a: 'ante', b: 'cistern', door: 'd4' },
    { a: 'cistern', b: 'spring', door: 'd5' },
  ],
  elements: {
    // the Hall of the Flame: the tar ball rolled through the pilot flame into the hooded bowl by the door
    pb0: { type: 'plate', room: 'flame' },                                            // (the bowl's mouth)
    ball1: { type: 'drum', room: 'flame', plate: 'pb0', plateAt: 1, start: 0 },
    b0: { type: 'brazier', room: 'flame', when: { drumOn: ['ball1', 'pb0'] } },     // hooded: only the ball lights it
    d1: { type: 'door', opens: { lit: 'b0' }, latch: true },
    // the Dry Channel: back through the flame first, then into the thorns over the bridge's sockets
    pb2: { type: 'plate', room: 'channel' },
    ball2: { type: 'drum', room: 'channel', plate: 'pb2', plateAt: 1, start: 0.45 },
    bw2: { type: 'bramble', room: 'channel', when: { drumOn: ['ball2', 'pb2'] } },  // burnt by the ball, not by you
    br0: { type: 'bridge', opens: { lit: 'bw2' }, latch: true },
    chest: { type: 'gadget', room: 'chest', item: 'fire' },
    bw0: { type: 'bramble', room: 'chest', needs: ['fire'] },                         // the corridor's thorns
    // the chest's tar ball, its groove through the corridor to the bowl on the Hall of Fires' near lip
    pb3: { type: 'plate', room: 'fires' },
    ball3: { type: 'drum', room: 'chest', plate: 'pb3', plateAt: 1, start: 0 },
    b3: { type: 'brazier', room: 'fires', needs: ['fire'], when: { drumOn: ['ball3', 'pb3'] } },
    br1: { type: 'bridge', opens: { lit: 'b3' }, latch: true },
    // the Hall of Channels: the relay brazier by the long groove (it wakes the keepers' door too), the ball, the bowl
    b10: { type: 'brazier', room: 'wing', needs: ['fire'] },
    sc: { type: 'door', opens: { lit: 'b10' }, latch: true },
    pb4: { type: 'plate', room: 'firesFar' },
    ball4: { type: 'drum', room: 'wing', plate: 'pb4', plateAt: 1, start: 0 },
    b4: { type: 'brazier', room: 'firesFar', needs: ['fire'], when: { drumOn: ['ball4', 'pb4'] } },
    d3: { type: 'door', opens: { lit: 'b4' }, latch: true },
    d4: { type: 'door', opens: null },                            // the arena's door: shut while the Keeper is awake
    b6: { type: 'brazier', room: 'cistern', needs: ['fire'] },
    b7: { type: 'brazier', room: 'cistern', needs: ['fire'] },
    b8: { type: 'brazier', room: 'cistern', needs: ['fire'] },
    b9: { type: 'brazier', room: 'cistern', needs: ['fire'] },
    keeper: { type: 'boss', room: 'cistern', needs: ['backpack', 'fire'], requires: { all: [{ lit: 'b6' }, { lit: 'b7' }, { lit: 'b8' }, { lit: 'b9' }] } },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

// ------------------------------------------------------------------ the guardian
export const KEEPER = {
  kind: 'organic', name: 'the Keeper of the cistern', final: 'touch', touch: 'lay a hand on its brow',
  speed: 2.2, wakeTime: 3.2,
  wake: 'Something vast unfolds in the dark of the cistern. It is afraid of you.',
  openHint: 'It pants, its mouth open, its tongue dry as the sand. It is thirsty.',
  weary: 'It lowers its head to the dry spout, worn out. It isn’t afraid any more. Go to it.',
  resolved: 'It breathes out, long and slow, and the stone under the spout begins to sweat. Water.',
  missHint: 'Its forefeet are wedged in the stone: it heaves and pants, its mouth open.',
  phases: [
    { to: 0.4, attacks: ['stamp', 'sweep'], pause: 1.8, hint: 'It shies from the dark round the walls. Light the four braziers.' },
    { to: 0.6, attacks: ['sweep', 'charge', 'stamp'], pause: 1.5, hint: 'Its glyphs brighten, and it lowers its head to charge. When it pants, give it water: shoot the fluid into its mouth. It turns to fire, too: roll a burning ball down a spoke to it, and it pants in the light.' },
    { to: 0.8, attacks: ['burrow', 'spit', 'sweep'], pause: 1.3, hint: 'Its shell plates rattle up, glowing: it digs into the sand now, and it will not pant in the dark. Roll a burning ball down the spoke nearest it: by that fire it pants, and drinks.' },
    { to: 1.0, weary: true },
  ],
  // its moves (src/temples/boss.js): read from its body, never the floor; the sweep runs back the other way and
  // ends in a stamp (the punish to read, then it pants); a charge or a stamp that misses wedges it, panting
  attacks: {
    stamp: { shape: 'ring', at: 'front', ahead: 4.5, radius: 4.2, wind: 1.35, part: 'feet', rig: 'rear', damage: 1, knock: 8, recover: 0.9, miss: 2.6 },
    sweep: { shape: 'cone', range: 12, angle: 0.62, wind: 1.2, track: 0.6, part: 'mouth', rig: 'coil', side: 1, damage: 0.75, knock: 10, recover: 1.0, then: 'sweepBack' },
    sweepBack: { shape: 'cone', range: 12, angle: 0.62, wind: 0.7, track: 0.5, part: 'mouth', rig: 'coil', pose: 'sweep', side: -1, link: true, damage: 0.75, knock: 10, gap: 0.2, then: 'stampEnd' },
    stampEnd: { shape: 'ring', at: 'front', ahead: 4.5, radius: 4.2, wind: 1.1, part: 'feet', rig: 'rear', pose: 'stamp', link: true, damage: 1, knock: 8, recover: 0.9, open: 2.6 },
    charge: { shape: 'lane', range: 14, width: 4, wind: 1.3, track: 0.65, part: 'head', rig: 'crouch', dash: 9, damage: 1, knock: 11, recover: 1.1, open: 1.4, miss: 2.8 },
    burrow: { shape: 'ring', at: 'player', radius: 3.4, wind: 2.0, track: 0.6, over: true, part: 'core', damage: 1, knock: 11, recover: 1.4, open: 3.2 },
    spit: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'mouth', rig: 'lean', damage: 0.5, knock: 6, recover: 0.8 },
  },
};

const RIM = ['b6', 'b7', 'b8', 'b9'];
// where the chest's ball stops against the corridor's thorns (t along its groove, z 110 to 124.6: its front at the
// tangle's face, 118.2); the keepers' door and the far landing's doorway in the Hall of Fires' east wall (z); the Hall
// of Channels' groove (z), and its ball: how freely it rolls, how long it burns (lit at the start it goes out about
// 3 m short of the bowl), and where its relay brazier stands (x: lit there, it burns on to the bowl)
const CHEST_THORNS = (117.35 - 110) / 14.6;
const SC_Z = 123.8, WING_Z = 150.3, WING_GROOVE = 151.4;
export const WING = { friction: 0.2, burns: 4.6, relay: 18 };
/**
 * The cistern's spokes: a tar ball in a groove from behind each rim brazier in toward the basin (rolled in, it passes
 * its brazier's flame and catches). A burning ball at rest within `near` m of the Keeper makes it pant (`open` s): in
 * its second phase as well as its own openings, in its last only so (Keeper.openFor). The ball burns `burns` s.
 */
export const HEARTH_FIRE = { near: 6.5, open: 3.4, burns: 12, from: 15.6, to: 7.4, off: 0.13 };
/** A spoke ball burning, at rest, near the Keeper now (and not spent on it yet): the ball, or null. */
export function fireNear(g) {
  const m = g.model;
  for (const b of g.rt.spokes ?? []) if (b.burn > 0 && b.rest && !b.drop && Math.hypot(b.center.x - m.pos.x, b.center.z - m.pos.z) < HEARTH_FIRE.near) return b;
  return null;
}
/** Its own openings: in its last phase none in the dark, only by a fire rolled to it. */
function keeperOpen(g, a, s) {
  if (g.phaseIndex >= 2 && s && !fireNear(g)) { g.rt.notice('It heaves, its mouth shut, and shakes its head at the dark. It will not pant without a fire by it.', 'keeper.dark2'); return 0; }
  return s;
}
/** In its first phase the Keeper's calm is the light round the walls: a tenth for each rim brazier burning. */
function syncLight(g) {
  if (!g || g.phaseIndex !== 0 || !g.awake) return;
  const lit = RIM.filter((id) => g.rt.logic.isLit(id)).length;
  if (lit * 0.1 > g.meter + 1e-6) { g.add(lit * 0.1 - g.meter, 'light'); if (g.phaseIndex === 0) g.rt.notice(['', 'It turns its head to the light, and stills a moment.', 'A second fire. It watches it, and watches you.', 'Three. Its shell’s glyphs flicker awake.'][lit] ?? null); }
}

/** What the fluid does to the Keeper: water in its open mouth calms it; a push frightens it; ember only startles. */
function keeperHit(g, part, mode) {
  const rt = g.rt;
  if (mode === 'push') { g.add(-0.05, 'push'); rt.notice('It flinches back from the shove, more frightened than before. Gently.', 'keeper.push'); if (g.state === 'fight' && !g.attack) g.cool = 0; return true; }
  if (g.phaseIndex === 0) { if (mode !== 'fire' && (part === 'mouth' || part === 'body')) rt.notice('It snaps at the fluid, frightened. It is the dark it fears: light the braziers round the walls.', 'keeper.dark'); return true; }
  if (g.phaseIndex >= 1) {
    if (part === 'mouth' && g.state === 'open' && (mode === 'shoot' || mode === 'stun')) {
      g.add(0.1, 'water');
      rt.sound?.critter?.('splash', 1);
      if (g.state === 'open') { g.enter('fight'); g.cool = 1.4; }   // it swallows, and shakes its head (unless that was the last it needed)
      if (g.phaseIndex >= 1) rt.notice('It swallows. Its glyphs glow a little brighter.', null);
      return true;
    }
    if (mode === 'fire') { rt.notice('It flinches from the ember on its shell. It wants a fire beside it, not on it, and water.', 'keeper.fire'); return true; }
    if (part === 'mouth') rt.notice('Wait until it pants, its mouth open.', 'keeper.wait');
    return true;
  }
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  // (on the floor at y: the Dry Channel's on its sunk sand, the upper halls' on their floors at 7, where they used to lie
  // hidden under the floor or float over the pit at the ledges' height; solid as drawn: you walk up over them)
  const sandDrift = (x, z, w, d, h, ry = 0, y = 0) => K.both(M.sand, T(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), [x, y - 0.05, z], [0, ry, 0], [w, h, d]));
  /** A tar ball's groove on a floor at y, from (ax, az) to (bx, bz): a dark channel between two trim lips. */
  const groove = (ax, az, bx, bz, y, over = 1) => {
    const L = Math.hypot(bx - ax, bz - az) + over, ry = Math.atan2(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    K.add(M.dark, box(1.0, 0.04, L, cx, y + 0.02, cz, ry));
    for (const s of [-1, 1]) K.add(M.trim, box(0.25, 0.12, L, cx + Math.cos(ry) * 0.75 * s, y + 0.06, cz - Math.sin(ry) * 0.75 * s, ry));
  };
  const TAR = { caught: 'The tar ball catches, and burns. It will not burn for long.', out: 'The tar ball’s flame gutters, and goes out.' };

  // ---- the Threshold (z 0..14): a stair hall, the way back out behind you
  K.hall({ x: 0, z: 7, w: 16, d: 14, y: 0, h: 10, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  // the wall between the Threshold and the taller hall beyond, with the archway through it
  K.wall(-12.2, 14.6, 12.2, 14.6, 0, 14, { t: 1.2, holes: [{ at: 12.2, w: 6, h: 7.5 }] });
  // the way out: a dark doorway in the south wall
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.3, 0.05], 1.6, 0);
  add(Mark, { room: 'threshold', at: [-5.2, 0, 6.5], yaw: Math.PI / 2 });
  sandDrift(5.5, 3, 2.4, 3, 0.5); sandDrift(-6.2, 11.5, 1.8, 2, 0.35);

  // ---- the Hall of the Flame (z 14..52): the pilot flame on the tar ball's groove, the hooded bowl by the door
  K.hall({ x: 0, z: 33, w: 22, d: 38, y: 0, h: 14, roof: 'oculus', oculus: 0.22, columns: 4, omit: ['s', 'n'] });
  // the wall between the Hall of the Flame and the deeper, taller Dry Channel, with the door through it
  K.wall(-14.2, 52.6, 14.2, 52.6, -9.5, 27.5, { t: 1.2, holes: [{ at: 14.2, w: 5, h: 6.6, y0: 9.5 }] });
  add(Door, { id: 'd1', at: [0, 0, 52.6], w: 5, h: 6.6, lamps: [{ lit: 'b0' }] });
  groove(5.5, 19.5, 5.5, 45.5, 0);
  add(Flame, { at: [5.5, 0, 26.5], r: 0.9 });
  add(Ball, { id: 'ball1', a: [5.5, 0.04, 20], b: [5.5, 0.04, 45.5], r: 1.0, friction: 0.6, tar: { ...TAR, burns: 14, caught: 'The tar ball rolls through the Givers’ flame and catches. It will not burn for long.' } });
  add(Brazier, { id: 'b0', at: [5.5, 0, 47.4], hood: { ball: 'ball1', yaw: Math.PI } });
  // a mural on the west wall: the giants carrying water, in glyph rows, and carrying fire
  for (let i = 0; i < 4; i++) K.glyph([-10.95, 3.2 + (i % 2) * 1.6, 22 + i * 7], 1.3, Math.PI / 2);
  add(Mark, { room: 'flame', at: [-7.2, 0, 16.4], yaw: Math.PI / 2 });
  sandDrift(-9, 30, 2, 5, 0.6, 0.2); sandDrift(-8.6, 50, 1.6, 2.4, 0.4);

  // ---- the Dry Channel (z 52..92): a sand pit, the bridge's sockets choked with thorns, a wall to climb
  K.hall({ x: 0, z: 72, w: 26, d: 40, y: -9.5, h: 27.5, floor: false, roof: 'oculus', oculus: 0.25, doors: [{ side: 'n', w: 5, h: 6, y0: 16.5 }], omit: ['s'] });
  K.slab(-13, 52, 13, 58.5, 0, 9.5);            // the near ledge
  K.slab(-13, 80, 13, 84, 0, 9.5);              // the far landing
  K.both(M.wallGlyph, box(26, 16.4, 8, 0, -1.3, 88));    // the gallery: a block you climb, its top at 7
  K.slab(-13, 84, 13, 92, 7, 0.4);
  K.both(M.sand, box(26, 1, 22, 0, -9.5, 69));  // the pit's sand
  for (let i = 0; i < 7; i++) sandDrift(-10 + i * 3.4, 62 + (i % 3) * 6.5, 2.6, 3.4, 0.8 + (i % 2) * 0.5, i, -9);
  add(Pit, { room: 'channel', min: [-14, -14, 58.5], max: [14, -2.5, 80] });
  // the ball's groove along the near ledge: the pilot flame at its west end, behind the ball; the thorns over the
  // bridge's sockets at its east end. Roll it back through the fire first
  groove(-11, 55.4, 7.6, 55.4, 0, 1.4);
  add(Flame, { at: [-9.8, 0, 55.4], r: 0.8 });
  add(Ball, { id: 'ball2', a: [-11, 0.04, 55.4], b: [7.6, 0.04, 55.4], r: 0.9, friction: 0.6, thorns: { id: 'bw2', at: 1, stopped: 'The cold ball stops against the thorns.' }, tar: { ...TAR, burns: 14 } });
  add(Bramble, { id: 'bw2', at: [9.5, 0, 57.2], w: 4.4, h: 2.4, seed: 3 });
  add(Bridge, { id: 'br0', a: [9.5, 0, 58.4], b: [9.5, 0, 80.1], w: 3.6, n: 8 });
  // handholds: a row of glyph ledges up the gallery's face (any wall can be climbed; these say where)
  for (let i = 0; i < 3; i++) K.add(M.trim, box(5, 0.25, 0.4, 0, 1.8 + i * 1.8, 83.9));
  K.frieze([-12.9, 56], [-12.9, 88], 10, 'e', 6);
  K.frieze([12.9, 56], [12.9, 88], 10, 'w', 6);
  add(Mark, { room: 'channel', at: [-6.5, 0, 53.8], yaw: Math.PI / 2 });

  // ---- the corridor and the Chest Chamber (a rotunda, floor at 7)
  K.slab(-3.2, 92, 3.2, 95, 7, 0.8);
  K.wall(-3.2, 92, -3.2, 95, 7, 6, { t: 0.8 }); K.wall(3.2, 95, 3.2, 92, 7, 6, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3, 0, 13.4, 93.5));
  const C3 = [0, 7, 106];
  K.rotunda({ x: C3[0], z: C3[2], y: 7, r: 10, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6.6 }], oculus: 0.32 });
  // the dais under the oculus, and the chest on it (the box system builds the chest: src/boxes/)
  K.both(M.trim, lathe([[3.2, 0], [3.2, 0.3], [2.6, 0.32], [2.6, 0.62], [0.01, 0.62]], 28).translate(0, 7, 106), new THREE.CylinderGeometry(2.9, 3.2, 0.62, 20).translate(0, 7.31, 106));
  K.add(M.glyph, T(new THREE.TorusGeometry(2.9, 0.06, 4, 48), [0, 7.33, 106], [Math.PI / 2, 0, 0]));
  // the chest's tar ball, north of the dais: its groove runs out through the corridor (and its thorns) to the bowl on
  // the Hall of Fires' near lip
  groove(1.6, 110, 1.6, 124.6, 7);
  add(Ball, { id: 'ball3', a: [1.6, 7.04, 110], b: [1.6, 7.04, 124.6], r: 0.85, friction: 0.6, thorns: { id: 'bw0', at: CHEST_THORNS, stopped: 'The cold ball stops against the thorns.' }, tar: { ...TAR, burns: 14 } });
  add(Mark, { room: 'chest', at: [6.5, 7, 99.5], yaw: -Math.PI * 0.75 });

  // ---- the corridor's thorns, and the Hall of Fires (z 120..158): a chasm, a bridge that rises
  K.slab(-3.2, 117, 3.2, 120.6, 7, 0.8);
  K.wall(-3.2, 117, -3.2, 120.6, 7, 6.6, { t: 0.8 }); K.wall(3.2, 120.6, 3.2, 117, 7, 6.6, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 14, 118.8));
  add(Bramble, { id: 'bw0', at: [0, 7, 118.8], w: 5.6, h: 6, seed: 7 });
  // (its east wall: the keepers' door off the near ledge, and the far landing's doorway into the Hall of Channels)
  K.hall({ x: 0, z: 139.6, w: 26, d: 37, y: -3.5, h: 26, floor: false, roof: 'oculus', oculus: 0.2, columns: 0, doors: [{ side: 's', w: 5, h: 6.6, y0: 10.5 }, { side: 'n', w: 5, h: 6, y0: 10.5 }, { side: 'e', at: SC_Z - 139.6, w: 4, h: 6, y0: 10.5 }, { side: 'e', at: WING_Z - 139.6, w: 5, h: 6.4, y0: 10.5 }] });
  K.slab(-13, 121, 13, 126.5, 7, 10.5);          // the near side
  K.slab(-13, 144.5, 13, 158.1, 7, 10.5);        // the far side
  K.both(M.dark, box(26, 1, 18, 0, -3.5, 135.5)); // the chasm's floor, far below
  add(Pit, { room: 'fires', min: [-14, -8, 126.5], max: [14, 3.5, 144.5] });
  add(Bridge, { id: 'br1', a: [-5, 7, 126.4], b: [-5, 7, 144.6], w: 4, n: 8 });
  add(Brazier, { id: 'b3', at: [1.6, 7, 126.0], scale: 1.1, hood: { ball: 'ball3', yaw: Math.PI } });
  add(Door, { id: 'sc', at: [13.6, 7, SC_Z], yaw: Math.PI / 2, w: 4, h: 6, t: 1.3, lamps: [{ lit: 'b10' }] });
  K.column(-10, 155.5, 7, 15, 0.9); K.column(10, 155.5, 7, 15, 0.9);
  // the far door, and the hooded bowl by it at the end of the Hall of Channels' groove
  add(Door, { id: 'd3', at: [0, 7, 158.1], w: 5, h: 6, lamps: [{ lit: 'b4' }] });
  add(Brazier, { id: 'b4', at: [6.2, 7, WING_GROOVE], scale: 1.1, hood: { ball: 'ball4', yaw: Math.PI / 2 } });
  add(Mark, { room: 'fires', at: [-8, 7, 123.5], yaw: 0 });

  // ---- the Hall of Channels (x 14..40, z 121..158, floor 7): the Givers' old water channels in its floor, and a long
  // groove from its east end out through the doorway to the bowl by the far door. A ball lit at the start burns out
  // short of it; the relay brazier beside the groove lights it again as it passes (and wakes the keepers' door)
  K.hall({ x: 27.2, z: 139.6, w: 26, d: 37, y: 7, h: 14, roof: 'oculus', oculus: 0.25, columns: 0, omit: ['w'] });
  groove(36.5, WING_GROOVE, 7.6, WING_GROOVE, 7);
  for (const z of [128, 136, 144]) K.add(M.dark, box(20, 0.04, 1.2, 27.4, 7.02, z));   // the dry channels
  add(Ball, { id: 'ball4', a: [36.5, 7.04, WING_GROOVE], b: [7.6, 7.04, WING_GROOVE], r: 0.85, friction: WING.friction, tar: { ...TAR, burns: WING.burns } });
  add(Brazier, { id: 'b10', at: [WING.relay, 7, WING_GROOVE + 1.7], scale: 0.9 });
  K.frieze([40.5, 125], [40.5, 156], 10, 'w', 6);
  add(Mark, { room: 'wing', at: [33, 7, 156], yaw: -Math.PI / 2 });

  // ---- the antechamber (z 158..166.6) and the Cistern (a great rotunda, floor at 7)
  K.slab(-3.2, 158, 3.2, 167.4, 7, 0.8);
  K.wall(-3.2, 158.7, -3.2, 167.4, 7, 7, { t: 0.8 }); K.wall(3.2, 167.4, 3.2, 158.7, 7, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 9, 0, 14.4, 162.9));
  add(Mark, { room: 'ante', at: [2.2, 7, 161], yaw: -Math.PI / 2 });
  const C = V(0, 7, 186), R = 18;
  K.rotunda({ x: C.x, z: C.z, y: 7, r: R, h: 20, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.3, floor: false });
  // the floor round a shallow dry basin, and the spout in the middle
  K.both(M.floor, T(annulus(6.6, R + 1.6, 0.8, 48), [C.x, 7, C.z]));
  K.both(M.stone, lathe([[6.65, 7], [6.2, 6.9], [4.2, 5.9], [0.01, 5.85]], 40).translate(C.x, 0, C.z));
  K.both(M.trim, lathe([[0.9, 0], [0.9, 0.4], [0.6, 0.6], [0.55, 2.2], [0.8, 2.5], [0.3, 2.7], [0.01, 2.7]], 14).translate(C.x, 5.85, C.z), new THREE.CylinderGeometry(0.8, 0.9, 2.7, 12).translate(C.x, 5.85 + 1.35, C.z));
  K.add(M.glyph, T(glyphGeometry(0.8, 0.06), [C.x, 7.9, C.z + 0.6]));
  add(Door, { id: 'd4', at: [0, 7, C.z - R - 0.7], w: 5, h: 6 });
  add(Door, { id: 'd5', at: [0, 7, C.z + R + 0.7], w: 5, h: 6 });
  const rim = [0.25, 0.75, 1.25, 1.75].map((f) => f * Math.PI);
  // the four tall bronze braziers round the rim (after the picked reference), and beside each a spoke: a tar ball's
  // groove from behind the brazier in to the basin's edge, so a ball rolled in passes its fire and catches
  ['b6', 'b7', 'b8', 'b9'].forEach((id, i) => add(Brazier, { id, at: [C.x + Math.sin(rim[i]) * 14, 7, C.z + Math.cos(rim[i]) * 14], scale: 1.15, tripod: true }));
  const F = HEARTH_FIRE;
  rt.spokes = rim.map((a0, i) => {
    const a = a0 + F.off, at = (r) => [C.x + Math.sin(a) * r, 7.04, C.z + Math.cos(a) * r];
    groove(at(F.from)[0], at(F.from)[2], at(F.to)[0], at(F.to)[2], 7);
    return add(Ball, { id: `kb${i + 1}`, a: at(F.from), b: at(F.to), r: 0.8, friction: 0.9, tar: { burns: F.burns, caught: 'The ball rolls past the brazier and catches.', out: 'The ball’s flame gutters, and goes out.' } });
  });
  // the Givers' muzzle over the basin on the east wall, dry, the stone under it damp; the channels' mouths at the floor
  K.add(M.stone, T(new THREE.SphereGeometry(1, 12, 8).scale(3.2, 1.1, 1.3), [C.x + R - 1.6, 13.2, C.z]));
  K.add(M.trim, T(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 10), [C.x + R - 4.7, 13.2, C.z], [0, 0, Math.PI / 2]));
  for (const a of [Math.PI * 0.5 - 0.5, Math.PI * 0.5 + 0.5, Math.PI * 1.5 - 0.5, Math.PI * 1.5 + 0.5]) K.add(M.voidM, T(new THREE.CircleGeometry(1.1, 12, 0, Math.PI), [C.x + Math.sin(a) * (R - 0.15), 7.01, C.z + Math.cos(a) * (R - 0.15)], [0, a + Math.PI, 0]));
  // the water that rises once the Keeper is calm (hidden until then)
  const poolMat = magicMaterial(7);
  const pool = magicPool(6.2, poolMat);
  pool.position.set(...K.world(C.x, 5.9, C.z).toArray());
  rt.root.add(pool);
  rt.spring = { pool, poolMat, k: rt.logic.resolved ? 1 : 0 };

  // ---- the spring (behind the far door): the way back out
  K.slab(-3.2, 204.4, 3.2, 214, 7, 0.8);
  K.wall(-3.2, 205, -3.2, 214, 7, 7, { t: 0.8 }); K.wall(3.2, 214, 3.2, 205, 7, 7, { t: 0.8 });
  K.wall(3.2, 214, -3.2, 214, 7, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 10, 0, 14.4, 209.5));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 7, 214.5]));
  K.solid(box(4, 5, 0.5, 0, 9.5, 214.9));
  K.glyph([0, 13, 213.55], 1.5, Math.PI);

  // the Keeper, asleep curled at the far side of the basin
  const model = keeperModel();
  model.pos.copy(K.world(C.x, 7, C.z + 9));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(C.x + 3.5, 7, C.z + 7.5);
  model.restHeading = K.heading(Math.PI + 0.6);
  const arena = { center: K.world(C.x, 7, C.z), r: R, y: K.world(0, 7, 0).y };
  // (the basin is lower: the Keeper walks its rim and floor alike, at the arena's height)

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 4), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-16, -14, -3), V(42, 34, 216)),
    gadget: { at: W(0, 7.62, 106).toArray(), face: K.heading(Math.PI) },
    exits: [
      { at: W(0, 0.5, 0.4), r: 1.5 },
      { at: W(0, 7.5, 213.6), r: 1.5 },
    ],
    lights: [[0, 6, 7, 16], [0, 8, 24, 20], [0, 8, 44, 20], [0, 6, 60, 22], [0, 8, 84, 22], [0, 11, 106, 16], [0, 11, 128, 22], [0, 11, 150, 22], [27, 13, 128, 22], [27, 13, 150, 22], [0, 10, 163, 9], [0, 13, 186, 28], [0, 10, 209, 9]],
    guardian: { def: { ...KEEPER, onHit: keeperHit, openFor: keeperOpen, onStrike: (g, a) => { if (a.id === 'burrow') { g.model.pos.x = g.attackAt.x; g.model.pos.z = g.attackAt.z; } } }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Givers' House in the dunes
/** The Givers' channel from the door toward Qanat: world points every 3 m, winding a little, level down the steps, then on the sand. */
function channelPath(from, doorY, H) {
  const toward = V(STORY.city.x - from.x, 0, STORY.city.z - from.z).normalize();
  const pts = [from.clone().setY(doorY + 0.05)];
  for (let i = 1; i <= 60; i++) {
    const b = from.clone().addScaledVector(toward, i * 3);
    b.x += Math.sin(i * 0.37) * 1.6; b.z += Math.cos(i * 0.29) * 1.6;
    b.y = Math.max(H(b.x, b.z) + 0.3, i * 3 < 16 ? doorY + 0.06 : -1e9);
    pts.push(b);
  }
  return pts;
}
function exterior(scene, level, rt) {
  const H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const yaw = SITE.heading;
  const f = V(Math.sin(yaw), 0, Math.cos(yaw));
  let lo = Infinity, hi = -Infinity;
  for (let a = 0; a < 16; a++) for (const r of [0, 12, 24, 30, 36]) {
    const x = SITE.x + Math.sin(a / 16 * Math.PI * 2) * r, z = SITE.z + Math.cos(a / 16 * Math.PI * 2) * r;
    lo = Math.min(lo, H(x, z)); hi = Math.max(hi, H(x, z));
  }
  const R = 30;
  const foot = V(SITE.x, 0, SITE.z).addScaledVector(f, R + 6);
  const doorY = Math.max(H(foot.x, foot.z), H(SITE.x + f.x * (R + 1), SITE.z + f.z * (R + 1))) + 0.3;
  const base = lo - 7;
  const K = new TempleKit(rt.root, 'The Givers’ House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, dy = doorY - base;
  const top = Math.max(hi - base + 22, dy + 28);
  const rose = { paint: new THREE.Color('#dd8f86'), smooth: true };
  // the drum, its cornice, an upper drum and a low dome
  // (the drum collides as its own lathe: a smooth cylinder lay up to 3.4 m inside the flared foot and the cornice)
  K.both(M.wall, lathe([[R + 3, 0], [R + 2.2, 3], [R, 5], [R, top - 3], [R + 1.4, top - 2.4], [R + 1.4, top], [R - 1, top + 0.4]], 48));
  const r2 = 21;
  K.both(M.wall, T(annulus(r2 - 0.2, R + 0.2, 0.6, 48), [0, top + 0.35, 0]));
  K.both(M.wallGlyph, new THREE.CylinderGeometry(r2, r2, 11, 40).translate(0, top + 5.5, 0));
  K.add(M.trim, T(annulus(r2 - 0.5, r2 + 1.4, 0.6, 48), [0, top + 11.3, 0]));
  K.both(rose, new THREE.SphereGeometry(r2, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(0, top + 11, 0));
  K.add(M.trim, lathe([[3.8, 0], [3.8, 1.4], [2.9, 1.8], [0.01, 2.6]], 20).translate(0, top + 11 + r2 * 0.55 - 0.4, 0));
  // twelve tall fins round the drum, their tops rounded, glyphs between them
  for (let i = 0; i < 12; i++) {
    const a = (i + 0.5) / 12 * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4) continue;   // (not over the door)
    const h = top + 6 + (i % 2) * 4;
    const fin = new THREE.BoxGeometry(1.8, h, 5).translate(0, h / 2, R + 1.6);
    const cap = new THREE.CylinderGeometry(2.5, 2.5, 1.8, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(0, h, R + 1.6);
    K.both(M.wall, T(fin, [0, 0, 0], [0, a, 0])); K.both(M.wall, T(cap, [0, 0, 0], [0, a, 0]));
    const ga = a + Math.PI / 12;
    K.add(M.glyph, T(glyphGeometry(2.8, 0.15), [Math.sin(ga) * (R + 0.08), top - 8, Math.cos(ga) * (R + 0.08)], [0, ga, 0]));
  }
  // the doorway (after the picked entrance, references/temples/givers-house/sheet-2.jpg): a tall dark opening in a
  // frame of carved stone, stepped out from the drum in three bands, and over it a panel with the makers' mark cut
  // deep: three round holes over an arc rising
  const z0 = R - 0.6, z1 = R + 5;
  for (const s of [-1, 1]) {
    K.both(M.wall, box(5, 16, z1 - z0, s * 4.6, dy + 8 - 0.0, (z0 + z1) / 2));
    K.add(M.trim, box(5.4, 1, z1 - z0 + 0.4, s * 4.6, dy + 16, (z0 + z1) / 2));
    // the frame's bands round the opening, each a step proud of the last
    for (let k = 0; k < 3; k++) K.both(M.trim, box(0.55, 9.4 - k * 0.4, 0.4, s * (2.55 + k * 0.55), dy + (9.4 - k * 0.4) / 2, z1 + 0.15 + k * 0.12));
  }
  K.both(M.wall, box(4.2, 16 - 7.5, z1 - z0, 0, dy + 7.5 + (16 - 7.5) / 2, (z0 + z1) / 2));
  for (let k = 0; k < 3; k++) K.both(M.trim, box(5.6 + k * 1.1, 0.5, 0.4, 0, dy + 7.85 + k * 0.5, z1 + 0.15 + k * 0.12));
  K.add(M.trim, box(19, 1.4, 2.4, 0, dy + 14.7, z1 + 0.2));
  // the panel: three deep round holes over an arc
  K.both(M.trim, box(6.2, 4.4, 0.5, 0, dy + 11.1, z1 + 0.2));
  for (const x of [-1.7, 0, 1.7]) K.add(M.voidM, T(new THREE.CircleGeometry(0.62, 16), [x, dy + 12.0, z1 + 0.47]));
  K.both(M.dark, T(new THREE.TorusGeometry(1.9, 0.18, 4, 20, Math.PI * 0.8), [0, dy + 9.1, z1 + 0.47], [0, 0, Math.PI * 0.1]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.3, 7.6).translate(0, 3.8, 0), [0, dy, R + 1.0]));
  K.solid(box(4.4, 7.6, 0.6, 0, dy + 3.8, R + 0.6));
  // the forecourt and its steps down into the sand
  K.both(M.floor, box(20, dy, 17.5, 0, dy / 2, R - 1 + 8.75));
  K.both(M.trim, box(20.6, 0.4, 0.6, 0, dy, R + 16.4));
  // (the Givers' dry channel out from the door toward Qanat is the world's: src/levels/desert.js, the same path)
  K.flush();
  // the door: its threshold (world), looking out toward Qanat
  const at = K.world(0, dy, R + 2.4);
  const front = K.world(0, dy, R + 14);
  return { door: { at, heading: yaw }, kit: K, base, top, doorY, R, front, clear: [{ x: SITE.x, z: SITE.z, r: R + 6 }, { x: front.x, z: front.z, r: 14 }] };
}

// ------------------------------------------------------------------ the world change: water runs, fields grow
/**
 * Once the Keeper is calm: the water rises in the cistern (inside), runs out
 * of the house's door and down the old channel, the house grows green
 * creepers, and round Qanat the old fields sprout (rows of young crops,
 * irrigation channels of living water between them).
 */
function change(scene, level, rt) {
  const H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const root = new THREE.Group();
  root.name = 'The Givers’ water (the world change)';
  scene.add(root);
  root.visible = false;
  // ---- the fields round Qanat
  const C = STORY.city;
  const plots = [[92, 92, 30, 20], [118, 96, 26, 18], [62, 98, 24, 18], [250, 90, 32, 20], [282, 96, 24, 16], [148, 94, 22, 16]];   // [angle (deg from +z, toward +x), distance, length, width]
  // a young crop: four broad blades leaning out of the soil, and on some an ear of ochre grain
  const blade = (a, lean) => new THREE.ConeGeometry(0.16, 1.15, 3).scale(1, 1, 0.35).translate(0, 0.55, 0).rotateZ(lean).rotateY(a).toNonIndexed();
  const leaf = mergeGeometries([0, 1, 2, 3].map((i) => blade(i * 1.6 + 0.3, 0.32 + (i % 2) * 0.16)));
  const head = new THREE.SphereGeometry(0.11, 6, 4).scale(1, 2.2, 1).translate(0.1, 1.15, 0);
  const spots = [];
  const chans = [], soils = [];
  for (const [deg, d, L, W] of plots) {
    const a = THREE.MathUtils.degToRad(deg), cx = C.x + Math.sin(a) * d, cz = C.z + Math.cos(a) * d;
    const along = V(Math.cos(a), 0, -Math.sin(a)), across = V(Math.sin(a), 0, Math.cos(a));
    for (let r = -W / 2; r <= W / 2; r += 1.25) {
      for (let s = -L / 2; s <= L / 2; s += 0.75) {
        const x = cx + along.x * s + across.x * r + Math.sin(s * 7.3 + r) * 0.12, z = cz + along.z * s + across.z * r + Math.cos(s * 5.1 - r) * 0.12;
        spots.push([x, H(x, z), z, Math.abs((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1)]);
      }
    }
    soils.push([cx, cz, along, across, L + 1.5, W + 1.5]);
    // a channel of living water along each plot's inner edge
    const p0 = V(cx - across.x * (W / 2 + 1.2) - along.x * L / 2, 0, cz - across.z * (W / 2 + 1.2) - along.z * L / 2);
    chans.push([p0, along.clone(), L]);
  }
  const green = makeMaterial({ color: '#82b85e', flat: true }), ochre = makeMaterial({ color: '#e6b86f', flat: true });
  const leaves = new THREE.InstancedMesh(leaf, green, spots.length), heads = new THREE.InstancedMesh(head, ochre, spots.length);
  // (they grow: never tiled or merged away as static props, src/perf.js)
  for (const m of [leaves, heads]) { m.userData.noCollide = true; m.userData.dynamic = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; }
  root.add(leaves, heads);
  const dummy = new THREE.Object3D(), mats = [], ears = [];
  spots.forEach(([x, y, z, rnd]) => {
    dummy.position.set(x, y - 0.05, z); dummy.rotation.set(0, rnd * 6.28, 0);
    dummy.scale.setScalar(0.85 + rnd * 0.5); dummy.updateMatrix();
    mats.push(dummy.matrix.clone());
    ears.push(rnd > 0.55);
  });
  // the soil of each field, dark and damp, laid over the sand (a grid of quads that follows the dunes)
  const soilG = [];
  for (const [cx, cz, along, across, L, W] of soils) {
    const nx = Math.ceil(L / 2), nz = Math.ceil(W / 2), pts = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const s = -L / 2 + (i / nx) * L, r = -W / 2 + (j / nz) * W;
      const x = cx + along.x * s + across.x * r, z = cz + along.z * s + across.z * r;
      pts.push([x, H(x, z) + 0.12, z]);
    }
    const P = [], at = (i, j) => pts[i * (nz + 1) + j];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) for (const q of [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]) P.push(...q);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
    soilG.push(g);
  }
  const soil = new THREE.Mesh(mergeGeometries(soilG), makeMaterial({ color: '#9c7a52', flat: true, side: THREE.DoubleSide }));
  soil.userData.noCollide = true;
  root.add(soil);
  const water = makeMaterial({ color: '#62c3c9', glow: 0.35, flat: true, side: THREE.DoubleSide, key: 'temple.desert.channel' });
  const strip = [];
  for (const [p0, dir, L] of chans) {
    const n = Math.ceil(L / 2), side = V(-dir.z, 0, dir.x).multiplyScalar(0.45);
    for (let i = 0; i < n; i++) {
      const a = p0.clone().addScaledVector(dir, (i / n) * L), b = p0.clone().addScaledVector(dir, ((i + 1) / n) * L);
      a.y = H(a.x, a.z) + 0.3; b.y = H(b.x, b.z) + 0.3;
      const g = new THREE.BufferGeometry();
      const P = [a.x - side.x, a.y, a.z - side.z, a.x + side.x, a.y, a.z + side.z, b.x - side.x, b.y, b.z - side.z, b.x + side.x, b.y, b.z + side.z];
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals();
      strip.push(g.toNonIndexed());
    }
  }
  // ---- the water running out of the house's door, down its steps and away toward the city
  const O = rt.outside;
  if (O) {
    const path = channelPath(O.door.at, O.doorY, H), toward = path[1].clone().sub(path[0]).setY(0).normalize();
    const side = V(-toward.z, 0, toward.x).multiplyScalar(0.8);
    let a = path[0];
    for (let i = 1; i < path.length; i++) {
      const b = path[i];
      const g = new THREE.BufferGeometry();
      const P = [a.x - side.x, a.y, a.z - side.z, a.x + side.x, a.y, a.z + side.z, b.x - side.x, b.y, b.z - side.z, b.x + side.x, b.y, b.z + side.z];
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals();
      strip.push(g.toNonIndexed());
      a = b;
    }
  }
  const channel = new THREE.Mesh(mergeGeometries(strip), water);
  channel.userData.noCollide = true;
  root.add(channel);
  // ---- creepers on the house: green vines up the drum and the fins, leaves along them
  if (O) {
    const K = O.kit, vines = [], leafG = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + 0.13, r = O.R + 0.3, h0 = O.doorY - O.base - 2, h1 = h0 + 10 + (i * 7.3) % 14;
      const pts = [];
      for (let k = 0; k <= 8; k++) { const y = THREE.MathUtils.lerp(h0, h1, k / 8), w = Math.sin(k * 1.3 + i) * 0.12; pts.push(K.world(Math.sin(a + w) * r, y, Math.cos(a + w) * r)); }
      vines.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.12, 4).toNonIndexed());
      for (let k = 1; k < 8; k++) { const p = pts[k]; leafG.push(new THREE.SphereGeometry(0.45, 5, 3).scale(1, 0.3, 0.7).rotateY(i + k).translate(p.x, p.y, p.z).toNonIndexed()); }
    }
    const vm = new THREE.Mesh(mergeGeometries(vines.map((g) => { g.deleteAttribute('uv'); return g; })), makeMaterial({ color: '#4f7a4a', flat: true }));
    const lm = new THREE.Mesh(mergeGeometries(leafG.map((g) => { g.deleteAttribute('uv'); return g; })), makeMaterial({ color: '#7fb36e', flat: true }));
    vm.userData.noCollide = lm.userData.noCollide = true;
    root.add(vm, lm);
  }
  let k = 0, want = 0;
  const _m = new THREE.Matrix4(), _s = new THREE.Matrix4(), NONE = new THREE.Matrix4().makeScale(0, 0, 0);
  const apply = () => {
    root.visible = k > 0.001;
    const g = Math.min(1, k * 1.2);
    for (let i = 0; i < mats.length; i++) {
      // the crops come up in waves across each field
      const w = THREE.MathUtils.clamp(g * 1.6 - (i % 37) / 37 * 0.6, 0, 1);
      _m.copy(mats[i]).multiply(_s.makeScale(Math.max(0.001, w), Math.max(0.001, w), Math.max(0.001, w)));
      leaves.setMatrixAt(i, _m);
      heads.setMatrixAt(i, w > 0.85 && ears[i] ? _m : NONE);
    }
    leaves.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  };
  return {
    root,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 25 : -dt), 0, 1); apply(); }
      if (root.visible) water.uniforms.uGlow.value = 0.3 + 0.12 * Math.sin(t * 1.7);
      // inside: the cistern fills
      const S = rt.spring;
      if (S) {
        S.k = rt.logic.resolved ? Math.min(1, S.k + dt / 6) : 0;
        S.pool.visible = S.k > 0.01;
        S.pool.position.y = rt.kit.world(0, 5.95 + S.k * 0.9, 0).y;
        S.pool.scale.set(4.2 + S.k * 2.3, 1e-3, 4.2 + S.k * 2.3);
        if (S.pool.visible) setMagic(S.poolMat, t, { bright: S.k, tones: 6 });
      }
    },
  };
}

export const DESERT_TEMPLE = {
  id: 'desert', levelId: 'desert', name: 'The Givers’ House', doorLabel: 'door of the Givers’ House',
  gadget: 'fire', gadgetBox: 'desert.temple.fire', arenaDoor: 'd4',
  origin: [150, 2400, -250], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  enterLine: 'Cool air, and the smell of old water. The Givers’ House is dark inside, and very large.',
  pitLine: 'You climb back out of the sand, to the last glyph stone.',
  onResolved(rt) { rt.notice('Water. Somewhere above, it is already running out of the house and down toward Qanat.', 'resolved.out'); },
  // the four braziers round the cistern calm it, a tenth each: lit before it woke, or before a knockout, they still count
  onLit(rt, id) { if (RIM.includes(id)) syncLight(rt.guardian); },
  onWake(rt) { syncLight(rt.guardian); },
  // from its second phase: a burning ball rolled to rest by it makes it pant (once a lighting), in the light
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const spent = new Map();
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.phaseIndex < 1 || G.state !== 'fight' || G.attack || G.closing) return;
      const b = fireNear(G);
      if (!b || b.burn <= (spent.get(b) ?? -1)) return;
      spent.set(b, b.burn);
      G.enter('open'); G.openFor = HEARTH_FIRE.open;
      rt.notice('It turns to the fire by it, and the light on its face, and pants, its mouth open.', `keeper.firelit.${G.phaseIndex}`);
    };
  },
};
