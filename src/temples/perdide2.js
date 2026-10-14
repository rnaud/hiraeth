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

// Lorn II's temple: the Lamp-House, a dark tower of the makers standing in the
// shallow water east of the root cave, a causeway of flat stones out to it from
// the end of the lit path. Its lamp lit the whole wood once; the night the sky
// rang it went out, and three of the pools with it. Hollin's people kept their
// pools lit for forty years without knowing there had been a greater lamp.
// Something with wings is still up in its lamp-room, in the dark.
//
// Inside (built far overhead, through its door; dark: the lantern charm glows in it). The temple's one idea:
// light wakes what waits for it, and light can be carried.
//   the Threshold           the first mark, the way out
//   the Hall of Dark Pools  three pool-lamps for the door's three lamps: two on the floor, the third up on a
//                           loft at the top of the west roots, out of sight from the floor (climb to find it)
//   the Kennel              (v1.49, issue #23: east off the hall, an arena) where the keepers of the house's lamps were
//                           kept, dark; its door shuts behind you while they stand. Won, the small key's cage sinks: the
//                           Wick Room's grille, along the hall, takes it (v1.60; the Lamp Passage's door did, v1.49)
//   the Root Stair          a dark pool, and no way over it: moss-stones lie sunk in it, dark until the lamp in
//                           their socket wakes, and only light wakes it. A pool-orb waits in the Hall of Dark Pools
//                           beside a small pool by the door; its groove runs through the doorway to the socket.
//                           Light the pool, let the orb drink its light, then roll it through to the socket before
//                           it fades: the lamp catches and the moss-stones rise glowing out of the pool (push +
//                           shot, before the chest: light can be carried, and light wakes the stones); then a
//                           root-wall to climb
//   the Lantern Chamber     the makers' chest: the LANTERN CHARM (src/items.js 'lantern'). Its way on is open; a
//                           lamp by the dais wakes when you stand by it with the lantern (a try: nothing is locked)
//   the Lamp Passage        a room on: the door into the gallery is a lamp that wakes when you stand by it with the
//                           lantern, at the far end of a passage dark even to the lantern's light
//   the Dark Gallery        a chasm crossed by moss-stones that only the lantern's light shows; an eye only it
//                           shows, high over the way in (behind you as you cross, in sight from the far door);
//                           and the far door's lamp, in a niche low in the west wall, wakes only to the
//                           light of a pool-orb: stand by the orb with the lantern till it glows, then roll it
//                           (the push) down its groove into the niche before its glow fades. Rolled in dark,
//                           it wakes nothing (the lantern with the push: light carried where you cannot go)
//   the Wick Room           (v1.60, east of the Root Stair, its way in off the Hall of Dark Pools' east wall: open and
//                           dark on the way in; v1.49 off the gallery's far side) the gallery's far door takes its
//                           great key, so the lantern comes back down for it. Two niches low in its east wall, a
//                           pool-orb in a groove before each, the great key behind a grille between them, a keyhole in
//                           the grille (the Kennel's small key, next door). A niche's lamp burns only while its orb
//                           glows; the grille lifts, for good, only while both burn: light one orb, roll it home, light the other and roll it home
//                           before the first fades (two lights carried at once). A stair up its north wall to a
//                           balcony, and a keepers' door that opens with the grille onto a ledge of roots round the
//                           Root Stair to the root-wall's top: the way back up to the chamber, a loop
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
export const SITE = { x: 46 + OX, z: -424 + OZ, r: 14, path: [6 + OX, -414 + OZ] };
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
 * The Kennel (v1.49, east off the Hall of Dark Pools: an arena in the dark) and the Wick Room (v1.60: east of the Root
 * Stair, its way in off the Hall of Dark Pools' east wall at z `door`; v1.49 it stood off the Dark Gallery's far side),
 * local m: the room round x, z (w by d, h high); its balcony along the west wall at the root-wall's height ([z0, z1, its
 * depth]) and the stair up the north wall to it ([x at its foot, x at its head, z], stairW wide); its niches' z, their
 * grooves' x, the orbs' glow (s), the great key's alcove behind its grille at z `keyZ`.
 */
export const KENNEL = { x: 22.4, z: 22.4, w: 16, d: 14, zone: { min: [14.4, -1, 15.4], max: [30.4, 9, 29.4] } };
export const WICK = { x: 21.8, z: 51, w: 16, d: 34, h: 16, door: 39, balcony: [52, 67.4, 5], stair: [29.2, 18.8, 65.2], stairW: 4.4,
  niches: [39.6, 48.4], groove: [19, 27], keyZ: 44, lasts: 25 };
/**
 * The keepers' way between the Wick Room's balcony and the Root Stair's root-wall top (v1.60): a ledge of roots south along
 * the stair's east wall at the root-wall's height, [x0, z0, x1, z1], and a passage east through the wall from x0 at z.
 */
export const ROOT_WAY = { x0: 9.8, z: 57.2, y: 9, ledge: [7.5, 54.7, 9.8, 60.2] };

export const LOGIC = {
  id: 'perdide2', entry: 'threshold', gadget: 'lantern',
  rooms: { threshold: { checkpoint: true }, pools: { checkpoint: true }, loft: {}, roots: { checkpoint: true }, lantern: { checkpoint: true }, kennel: { checkpoint: true }, gallery: { checkpoint: true }, galleryFar: {}, wick: { checkpoint: true }, wickKey: {}, lamp: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'pools' },
    { a: 'pools', b: 'loft' },                                        // up the west roots
    { a: 'pools', b: 'kennel', door: 'dK' },                         // the Kennel, east off the hall (v1.49): an arena, the small key
    { a: 'pools', b: 'wick' },                                        // the Wick Room, east off the hall too (v1.60): the great key behind a grille
    { a: 'pools', b: 'roots', door: 'd1' },
    { a: 'roots', b: 'lantern', door: 'disc' },                      // the moss-stones over the dark pool, once their lamp is lit
    { a: 'wick', b: 'lantern', door: 'dU' },                         // its keepers' door onto the ledge round the stair to the root-wall's top, with its grille: a loop
    { a: 'lantern', b: 'gallery', door: 'd2' },                      // the Lamp Passage's door, a room on (one room with the chamber)
    { a: 'gallery', b: 'galleryFar', door: 'br1' },
    { a: 'wick', b: 'wickKey', door: 'cW' },                         // its grille: both its lamps lit at once
    { a: 'galleryFar', b: 'lamp', door: 'd4' },
    { a: 'lamp', b: 'out', door: 'd5' },
  ],
  elements: {
    s1: { type: 'switch', room: 'pools' }, s2: { type: 'switch', room: 'pools' }, s3: { type: 'switch', room: 'loft' },
    d1: { type: 'door', opens: { all: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] }, latch: true },
    s5: { type: 'switch', room: 'pools' },                            // the small pool by the door: its light for the orb
    orb5: { type: 'drum', room: 'pools', plate: 'p5', plateAt: 1, start: 0 },   // a pool-orb, rolled through the doorway
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

/** The Kennel's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arK', room: 'kennel', zone: KENNEL.zone, doors: ['dK'], extra: 2,
  shut: 'The door grinds shut behind you, and something in the dark of the kennel gets up.',
  won: 'The last of them goes still in the dark. The key’s cage sinks, and the door lets go.',
}];

/**
 * The Kennel (east off the Hall of Dark Pools, an arena: where the keepers of the house's lamps were kept, dark; its door
 * shuts behind you while they stand, and won, the small key's cage sinks: for the Wick Room's grille) and the Wick Room
 * (v1.60: east off the hall too, north of the Kennel, beside the Root Stair: two niches low in its east wall, a pool-orb in
 * a groove before each; the great key in an alcove between them, behind a grille that lifts once both niches burn at
 * once; a balcony high on its west wall, at the end of the ledge of roots from the root-wall's top).
 */
function wings(rt, K, M, { root }) {
  const add = (P, o) => rt.add(P, o);
  const Kn = KENNEL, Wk = WICK;
  // ---- the Kennel
  K.corridor([11.6, Kn.z], [Kn.x - Kn.w / 2 - 0.6, Kn.z], 0, { w: 5, h: 6.4 });
  K.hall({ x: Kn.x, z: Kn.z, w: Kn.w, d: Kn.d, y: 0, h: 10, roof: true, doors: [{ side: 'w', at: 0, w: 5, h: 6.4 }] });
  add(Door, { id: 'dK', at: [12.6, 0, Kn.z], yaw: Math.PI / 2, w: 5, h: 6.4 });   // (open: it shuts behind you while they stand)
  // the keepers' old stalls along the walls (the bars over them drawn only: they are up out of reach)
  for (const z of [Kn.z - 4.4, Kn.z + 4.4]) for (const x of [Kn.x - 3, Kn.x + 3]) { K.both(M.wall, box(0.4, 2.2, 3, x - 1.4, 1.1, z + Math.sign(z - Kn.z) * 1.6)); K.add(M.trim, box(3.2, 0.3, 0.3, x, 2.2, z + Math.sign(z - Kn.z) * 0.15)); }
  add(Key, { id: 'kS', at: [Kn.x + Kn.w / 2 - 1.6, 0, Kn.z], yaw: -Math.PI / 2 });
  add(Mark, { room: 'kennel', at: [Kn.x - 4, 0, Kn.z - 3], yaw: -Math.PI / 2 });

  // ---- the Wick Room (v1.60: east of the Root Stair, off the Hall of Dark Pools; v1.49 off the gallery's far side). Its
  // floor at the hall's, its way in from the hall's east wall; a stair up its north wall to a balcony
  // on its west wall, and from it a keepers' door through to a ledge of roots round the Root Stair's east wall, onto the
  // root-wall's top: it opens with the grille over the great key, the shortcut back up to the chamber
  const Z = Wk.z, x0 = Wk.x - Wk.w / 2, x1 = Wk.x + Wk.w / 2, B = Wk.balcony, R = ROOT_WAY;
  K.corridor([11.6, Wk.door], [x0 - 0.6, Wk.door], 0, { w: 5, h: 6.4 });
  K.corridor([R.x0, R.z], [x0 - 0.6, R.z], R.y, { w: 5, h: 6 });
  add(Door, { id: 'dU', at: [11.5, R.y, R.z], yaw: Math.PI / 2, w: 5, h: 6, lamps: [{ lit: 'lW1' }, { lit: 'lW2' }] });
  K.hall({ x: Wk.x, z: Z, w: Wk.w, d: Wk.d, y: 0, h: Wk.h, roof: true, doors: [{ side: 'w', at: Wk.door - Z, w: 5, h: 6.4 }, { side: 'w', at: R.z - Z, w: 5, h: 6, y0: R.y }, { side: 'e', at: Wk.keyZ - Z, w: 2.4, h: 3 }] });
  // the balcony under the way through from the roots, and the stair up the north wall to it; roots down the wall under it
  K.slab(x0, B[0], x0 + B[2], B[1], R.y, 0.8);
  const [sx0, sx1, sz] = Wk.stair;
  K.stairs([sx0, 0, sz], [sx1, R.y, sz], Wk.stairW);
  for (const [z, r] of [[B[0] + 1.6, 0.45], [B[0] + 6.4, 0.4]]) root([[x0 + 0.5, R.y - 0.9, z], [x0 + 0.9, R.y - 3, z + 0.6], [x0 + 0.4, R.y - 6, z - 0.4], [x0 + 0.8, 0, z + 0.3]], r);
  // the two niches low in the east wall, each with its lamp at the back; a pool-orb's groove before each
  const [g0, g1] = Wk.groove;
  for (const [i, zz] of Wk.niches.entries()) {
    const id = `lW${i + 1}`, orb = `oW${i + 1}`, plate = `pW${i + 1}`;
    K.both(M.wall, box(3.4, 3.2, 0.6, x1 - 1.7, 1.6, zz - 1.9), box(3.4, 3.2, 0.6, x1 - 1.7, 1.6, zz + 1.9), box(3.4, 0.8, 4.4, x1 - 1.7, 3.6, zz));
    add(LightEar, { id, at: [x1 - 0.7, -0.3, zz], reach: 0 });   // (reach 0: your lantern can't wake it; its orb does, while it glows)
    K.add(M.dark, box(g1 - g0 + 0.6, 0.04, 1.0, (g0 + g1) / 2, 0.02, zz));
    for (const sd of [-1, 1]) K.add(M.trim, box(g1 - g0 + 0.6, 0.12, 0.25, (g0 + g1) / 2, 0.06, zz + sd * 0.75));
    add(Ball, { id: orb, a: [g0, 0.04, zz], b: [g1, 0.04, zz], r: 0.9, lock: true, lamp: { id, reach: 2.8, hold: 2, lasts: Wk.lasts,
      woke: 'The glowing orb settles in the niche, and its lamp catches: for as long as the orb glows.',
      faded: 'The orb’s glow has gone out, and its niche’s lamp with it.' } });
    add(Plate, { id: plate, at: [g1, 0, zz], r: 1.0 });
  }
  // the great key in its alcove behind the east wall, between the niches, behind a grille
  const KZ = Wk.keyZ;
  K.slab(x1, KZ - 1.6, x1 + 3.6, KZ + 1.6, 0, 0.8);
  K.both(M.wall, box(0.6, 3.6, 3.2, x1 + 3.9, 1.8, KZ), box(3.6, 0.6, 3.2, x1 + 1.8, 3.9, KZ), box(3.6, 3.6, 0.5, x1 + 1.8, 1.8, KZ - 1.85), box(3.6, 3.6, 0.5, x1 + 1.8, 1.8, KZ + 1.85));
  add(Door, { id: 'cW', at: [x1 + 0.6, 0, KZ], yaw: Math.PI / 2, w: 2.4, h: 3, lamps: [{ lit: 'lW1' }, { lit: 'lW2' }] });   // (a keyhole too: logic `lock`)
  add(Key, { id: 'kB', big: true, at: [x1 + 2.2, 0, KZ], yaw: -Math.PI / 2 });
  // roots down the walls, and the old wick-stands along the south wall
  root([[x1 - 0.5, Wk.h, Z + 9], [x1 - 0.9, 9, Z + 10.5], [x1 - 0.4, 4, Z + 9.4], [x1 - 0.8, 0, Z + 10.2]], 0.5);
  for (const x of [x0 + 5.2, x0 + 9.2]) { K.both(M.trim, box(0.5, 2.6, 0.5, x, 1.3, Z - Wk.d / 2 + 1.2)); K.both(M.wall, box(1.1, 0.25, 1.1, x, 2.7, Z - Wk.d / 2 + 1.2)); }
  add(Mark, { room: 'wick', at: [x0 + 2.6, 0, Wk.door + 3.4], yaw: Math.PI / 2 });
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const root = (pts, r) => K.both(M.stone, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), 16, r, 7, false));

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.both(M.voidM, box(3.6, 5, 1.25, 0, 2.5, -0.625));   // (drawn and solid as one: from the doorway's face back to the wall's inner face)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-12.2, 12.6, 12.2, 12.6, 0, 13, { t: 1.2, holes: [{ at: 12.2, w: 6, h: 7 }] });

  // ---- the Hall of Dark Pools (z 12.6..44): three pool-lamps, dark; splash each
  K.hall({ x: 0, z: 28.3, w: 22, d: 31.4, y: 0, h: 13, roof: true, columns: 3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4 }, { side: 'e', at: KENNEL.z - 28.3, w: 5, h: 6.4 }, { side: 'e', at: WICK.door - 28.3, w: 5, h: 6.4 }] });   // (and east into the Kennel, v1.49, and the Wick Room, v1.60)
  const poolM = makeMaterial({ color: '#2f3560', glow: 0.1, flat: true, key: 'temple.p2.pools' });
  const pool = (id, x, y, z, r = 2.0) => {
    K.both(M.trim, T(annulus(r, r + 0.6, 0.5, 32), [x, y + 0.5, z]));
    K.both(poolM, T(new THREE.CylinderGeometry(r, r, 0.1, 28), [x, y + 0.3, z]));
    add(Switch, { id, at: [x, y + 0.9, z], yaw: 0, size: 0.9 });
  };
  pool('s1', 5, 0, 26); pool('s2', -4, 0, 34);
  // a smaller pool by the door (not one of its three), and a pool-orb beside it in a groove that runs through the
  // doorway to the Root Stair's socket: lit, the pool's light is what the orb carries to the disc's lamp
  pool('s5', 4.8, 0, 39.6, 1.3);
  K.add(M.dark, box(1.0, 0.04, 12.4, 1.4, 0.02, 43.4));
  for (const sd of [-1, 1]) K.both(M.trim, box(0.25, 0.12, 12.4, 1.4 + sd * 0.75, 0.06, 43.4));
  add(Ball, { id: 'orb5', a: [1.4, 0.04, 37.4], b: [1.4, 0.04, 49.4], r: 0.9, lock: true, gap: { bridge: 'd1', from: 0.47, to: 0.73 },
    lamp: { id: 'l5', reach: 0, pool: { id: 's5', at: [4.8, 0.9, 39.6], reach: 4.6 }, hold: 2, lasts: 25,
      caught: 'The orb drinks the pool’s light and glows, for a while.',
      dark: 'The orb settles in the socket, dark, and the socket tips it back out. The disc’s lamp wants light.',
      woke: 'The glowing orb settles in the socket, and the disc’s lamp catches. The disc wakes.' } });
  // the third pool, up on a loft of roots against the west wall (climb its face): its edge hides it from the floor
  K.climbable('the loft of roots: climbed from the Hall of Dark Pools\' floor to the third pool', () => {
    K.both(M.wallGlyph, box(5, 8, 13.2, -8.5, 4, 19.4));
    K.both(M.trim, box(5.2, 0.3, 13.4, -8.5, 8.05, 19.4));
    root([[-6.1, 8, 24.5], [-5.8, 5, 23.6], [-6.2, 2, 24.6], [-5.9, 0, 23.8]], 0.4);
    root([[-6.1, 8, 15.2], [-5.7, 4, 16.4], [-6.1, 0, 15.6]], 0.35);
  });
  pool('s3', -8.8, 8.2, 21.2, 1.5);
  add(Door, { id: 'd1', at: [0, 0, 44.6], w: 5, h: 6.4, lamps: [{ lit: 's1' }, { lit: 's2' }, { lit: 's3' }] });
  add(Mark, { room: 'pools', at: [7.5, 0, 16], yaw: -Math.PI / 2 });
  root([[-11, 12.5, 13.4], [-10, 10, 14.5], [-10.6, 8.2, 15.6]], 0.8);          // (over the loft's back, clear of its pool)
  root([[-10.6, 8.1, 25.4], [-10.5, 4, 27], [-10.8, 0, 30]], 0.8);
  root([[11, 12, 40], [9.5, 8, 36], [10.6, 3, 32], [10.8, 0, 26]], 0.7);

  // ---- the Root Stair (a rotunda, floor 0): a disc over a dark pool, then a root-wall to the landing at 9
  K.slab(-3.2, 44, 3.2, 46.6, 0, 0.8);
  K.wall(-3.2, 44.6, -3.2, 46.6, 0, 6.4, { t: 0.8 }); K.wall(3.2, 46.6, 3.2, 44.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.8, 45.6));
  const C2 = 57.2;
  K.rotunda({ x: 0, z: C2, y: -6, r: 10, h: 30, floor: false, gaps: [{ a: Math.PI, w: 5, h: 6.4, y0: 6 }, { a: 0, w: 5, h: 6, y0: 15 }, { a: Math.PI / 2, w: 5, h: 6, y0: 15 }], oculus: 0.3 });   // (and east at 9 to the Wick Room's balcony, v1.60)
  K.both(M.floor, box(20, 6, 3, 0, -3, C2 - 8.6));            // the near landing (its top at 0)
  K.both(M.dark, T(new THREE.CylinderGeometry(10, 10, 1, 32), [0, -6.5, C2]));
  const pool2 = makeMaterial({ color: '#2a2f58', glow: 0.18, flat: true, key: 'temple.p2.deep' });
  K.add(pool2, T(new THREE.CylinderGeometry(9.8, 9.8, 0.2, 32), [0, -2.4, C2]));
  add(Pit, { room: 'roots', min: [-11, -8, C2 - 7], max: [11, -1.5, C2 + 3] });
  add(Bridge, { id: 'disc', a: [0, 0, C2 - 7.15], b: [0, 0, C2 + 2.95], w: 3.0, n: 6, glow: { color: '#8fd6a8', k: 0.5 } });   // moss-stones, sunk in the pool
  add(Plate, { id: 'p5', at: [1.4, 0, 49.4], r: 1.0 });
  add(LightEar, { id: 'l5', at: [2.9, 0, 49.4], reach: 0 });   // (the disc's lamp: only the glowing orb wakes it)
  // the root-wall, its top at 9: climb it (with the roots down its face and the landing on top: the house's
  // climbs, its other walls are not climbed, issue #115)
  K.climbable('the Root Stair\'s root-wall: climbed from the moss-stones to the landing at 9', () => {
    K.both(M.wallGlyph, box(20, 15, 6, 0, 1.5, C2 + 6));
    root([[-6, 9, C2 + 3.2], [-5, 5, C2 + 3.1], [-6.2, 1, C2 + 3.15], [-6, -3, C2 + 3.1]], 0.45);
    root([[5, 9, C2 + 3.2], [6, 4, C2 + 3.1], [4.8, 0, C2 + 3.15], [5.4, -3, C2 + 3.1]], 0.45);
    K.slab(-6, C2 + 9, 6, C2 + 10.4, 9, 0.6);
  });
  add(Mark, { room: 'roots', at: [-3.2, 0, C2 - 8.6], yaw: Math.PI / 2 });
  // (v1.60) a ledge of roots from the root-wall's top south along the east wall, to the keepers' door through it into the Wick Room
  { const [lx0, lz0, lx1, lz1] = ROOT_WAY.ledge;
    K.slab(lx0, lz0, lx1, lz1, ROOT_WAY.y, 0.6);
    root([[lx0 + 0.4, ROOT_WAY.y - 0.9, lz0 + 1.2], [lx0 + 1.1, ROOT_WAY.y - 3, lz0 + 0.6], [lx0 + 1.8, ROOT_WAY.y - 6.5, lz0 + 1.0]], 0.32); }

  // ---- the corridor and the Lantern Chamber (floor 9, a dark rotunda): the chest; a lamp-door
  K.slab(-3.2, C2 + 9.8, 3.2, C2 + 12.6, 9, 0.8);
  K.wall(-3.2, C2 + 10.4, -3.2, C2 + 12.6, 9, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.4, 9, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 15.8, C2 + 11.6));
  const C3 = C2 + 22.6;    // 79.8
  K.rotunda({ x: 0, z: C3, y: 9, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0 });
  // the dais, solid as drawn: its two steps as cylinders (one cylinder stood over its lower step; the lathe
  // alone gave no top a ray from above could land on, so the chest sank into the dais: the QC pass)
  K.both(M.trim, ...chestMound(0, 9, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  add(LightEar, { id: 'l0', at: [-5.4, 9, C3 + 3.4], reach: 3.6 });   // (a try: it wakes to the lantern, and nothing waits on it)
  add(Mark, { room: 'lantern', at: [6, 9, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Lamp Passage (floor 9), a room on: the door into the gallery is a lamp that wakes to the lantern
  const A0 = C3 + 10.9;
  K.slab(-3.2, C3 + 9.2, 3.2, A0 + 0.6, 9, 0.8);
  K.hall({ x: 0, z: A0 + 6, w: 10, d: 12, y: 9, h: 8, roof: true, omit: ['n'], doors: [{ side: 's', w: 5, h: 6.4 }] });
  root([[-4.6, 17, A0 + 2], [-4.2, 13, A0 + 4.5], [-4.7, 9, A0 + 3.6]], 0.35);
  root([[4.5, 17, A0 + 8], [4.1, 12, A0 + 9.5], [4.6, 9, A0 + 8.4]], 0.3);

  // ---- the Dark Gallery (z 104..138): a chasm, moss-stones only the lantern shows, an eye only it shows
  const G0 = A0 + 12 + 1.2;
  K.slab(-3.2, G0 - 1.6, 3.2, G0 + 0.6, 9, 0.8);
  add(Door, { id: 'd2', at: [0, 9, G0 - 0.6], w: 5, h: 6.4, lamps: [{ lit: 'l1' }] });
  add(LightEar, { id: 'l1', at: [3.6, 9, G0 - 2.6], reach: 3.0 });   // (beside the door, not on the way to it: you go and stand by it)
  K.hall({ x: 0, z: G0 + 17.2, w: 22, d: 34.4, y: -3, h: 24, floor: false, roof: true, doors: [{ side: 's', w: 5, h: 6.4, y0: 12 }, { side: 'n', w: 5, h: 6.4, y0: 12 }, { side: 'w', at: 12.8, w: 2.8, h: 2.8, y0: 12 }] });
  K.slab(-11, G0, 11, G0 + 6, 9, 12);
  K.slab(-11, G0 + 26, 11, G0 + 34.4, 9, 12);
  K.both(M.dark, box(22, 1, 20, 0, -3.5, G0 + 16));
  add(Pit, { room: 'gallery', min: [-12, -6, G0 + 6], max: [12, 4, G0 + 26] });
  add(Bridge, { id: 'br1', a: [0, 9, G0 + 5.9], b: [0, 9, G0 + 26.1], w: 3.4, n: 9, hidden: 'lantern' });
  add(Switch, { id: 's4', at: [7.2, 15, G0 + 0.15], yaw: 0, size: 1.0, hidden: 'lantern' });   // (over the way in, behind you at the edge; in sight from the far door)
  // the far door's lamp, in a niche low in the west wall: only a pool-orb's light wakes it. The orb waits at
  // the near end of its groove; held by your lantern it glows a while; rolled into the niche glowing, it wakes it
  const NZ = G0 + 30;
  K.slab(-14.4, NZ - 1.6, -11, NZ + 1.6, 9, 0.8);
  K.both(M.wall, box(0.8, 3.2, 4, -14.6, 10.6, NZ), box(3.6, 0.8, 4, -12.8, 12.6, NZ), box(3.6, 3.2, 0.6, -12.8, 10.6, NZ - 1.9), box(3.6, 3.2, 0.6, -12.8, 10.6, NZ + 1.9));
  add(LightEar, { id: 'l2', at: [-13.7, 8.7, NZ], reach: 0 });   // (reach 0: your lantern can't wake it; the orb does)
  K.add(M.dark, box(10.6, 0.04, 1.0, -7.2, 9.02, NZ));
  for (const sd of [-1, 1]) K.both(M.trim, box(10.6, 0.12, 0.25, -7.2, 9.06, NZ + sd * 0.75));
  add(Ball, { id: 'orb', a: [-2.2, 9.04, NZ], b: [-12.6, 9.04, NZ], r: 0.9, lock: true, lamp: { id: 'l2', reach: 2.8, hold: 2, lasts: 25 } });
  add(Plate, { id: 'p4', at: [-12.6, 9, NZ], r: 1.0 });
  add(Door, { id: 'd4', at: [0, 9, G0 + 35], w: 5, h: 6.4, lamps: [{ lit: 's4' }, { drumOn: ['orb', 'p4'] }, { lit: 'l2' }] });
  add(Mark, { room: 'gallery', at: [-7, 9, G0 + 3], yaw: 0 });

  // ---- the corridor, and the Lamp-Room (floor 9): a round hall, the great lamp dark in its cradle overhead
  const H0 = G0 + 35;
  const AE = K.vestibule(H0, 9);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, 9, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = 19, CL = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CL, y: 9, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0 });
  // the lamp's cradle: a ring of brass on chains, a great glass lamp in it, dark until the end
  K.add(M.trim, T(annulus(4.2, 5, 0.4, 40), [0, 9 + 20, CL]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; K.add(M.dark, box(0.12, 6, 0.12, Math.sin(a) * 4.6, 9 + 23, CL + Math.cos(a) * 4.6)); }
  const lampM = makeMaterial({ color: PALETTE.lamp, glow: 0.04, flat: true, key: 'temple.p2.lamp' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), lampM);
  lamp.position.copy(K.world(0, 9 + 18.2, CL));
  lamp.userData.noCollide = true; lamp.userData.dynamic = true;
  rt.root.add(lamp);
  rt.lampRoom = { lamp, lampM, light: null };
  add(Door, { id: 'd5', at: [0, 9, CL + HR + 0.7], w: 5, h: 6, frame: { side: 1.2 } });   // (frame: the rotunda's gap is wider than the door, issue #356)
  K.slab(-3.2, CL + HR + 0.6, 3.2, CL + HR + 10, 9, 0.8);
  K.wall(-3.2, CL + HR + 1.4, -3.2, CL + HR + 10, 9, 7, { t: 0.8 }); K.wall(3.2, CL + HR + 10, 3.2, CL + HR + 1.4, 9, 7, { t: 0.8 });
  K.wall(3.2, CL + HR + 10, -3.2, CL + HR + 10, 9, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 16.4, CL + HR + 5.7));
  K.both(M.voidM, box(3.4, 5, 0.9, 0, 11.5, CL + HR + 10.35));

  // three dark pools round the room: lit earlier, each lures the Lampless down to drink (LurePools)
  add(LurePools, { y: 9, at: [[-10.5, CL - 6], [10.5, CL - 6], [0, CL + 12]] });

  const model = mothModel();
  model.pos.copy(K.world(0, 9, CL + 4));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 9, CL + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 9, CL), r: HR, y: K.world(0, 9, 0).y };

  // (the wings last: their marks after the others, so the machines' ids by mark stay as they were)
  wings(rt, K, M, { root });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -10, -3), V(36, 40, CL + HR + 12)),
    gadget: { at: W(0, 9.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 9.5, CL + HR + 9.6), r: 1.5 }],
    // dim: the house is dark (the pools and the lantern light it)
    // (lower and wider since the visual pass: each a warm pool on the flags, lampTint, as the picked hall's lamps lay them)
    lights: [[0, 3.5, 6, 12], [0, 3.5, 28, 14], [0, 3, C2, 12], [0, 12, C3, 11], [0, 12, G0 + 16, 12], [KENNEL.x, 3.5, KENNEL.z, 10], [WICK.x, 4, WICK.keyZ, 12], [WICK.x - 4, 12, WICK.balcony[0] + 4, 9], [0, 12.5, CL, 17]],
    guardian: { def: { ...LAMPLESS, onHit: mothHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Lamp-House in the shallows
function exterior(scene, level, rt) {
  const yaw = SITE.heading, base = -2.5, R = 9;
  const K = new TempleKit(rt.root, 'The Lamp-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, door = 3.4;   // (the door's sill, above the water on a stone apron)
  const ink = { paint: new THREE.Color(PALETTE.dark), smooth: false, side: THREE.FrontSide };
  // a stone apron in the water, a tall tapering tower, a gallery, a glass lamp-room and a cap
  K.both(M.floor, new THREE.CylinderGeometry(R + 6, R + 7, door, 32).translate(0, door / 2, 0));
  // (the lathe itself collides: a straight cylinder inside it let a climber into its flared foot and crown, src/contact-audit.js)
  K.both(M.wall, lathe([[R + 1.2, door], [R, door + 4], [R - 2.2, door + 40], [R - 1.6, door + 41], [R - 1.6, door + 42]], 32));
  for (let y = door + 8; y < door + 40; y += 8) K.both(M.trim, new THREE.CylinderGeometry(R - 2.2 + (1 - (y - door) / 40) * 2.2 + 0.3, R - 2.2 + (1 - (y - door) / 40) * 2.2 + 0.3, 0.6, 32).translate(0, y, 0));
  K.both(M.floor, T(annulus(R - 3, R + 1.5, 0.6, 32), [0, door + 42.6, 0]));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; K.both(M.trim, T(new THREE.BoxGeometry(0.5, 7, 0.5), [Math.sin(a) * (R - 2.6), door + 46, Math.cos(a) * (R - 2.6)])); }
  K.both(ink, T(new THREE.ConeGeometry(R - 1.6, 5, 16), [0, door + 52, 0]));
  K.add(M.glyph, T(glyphGeometry(2.8, 0.15), [0, door + 30, R - 2.2 + 0.25 + 0.6], [0.05, 0, 0]));
  // the doorway on the apron, toward the causeway
  const z0 = R - 0.6, z1 = R + 3;
  for (const s of [-1, 1]) K.both(M.wall, box(3.4, 9, z1 - z0, s * 3.9, door + 4.5, (z0 + z1) / 2));
  K.both(M.wall, box(4.4, 2.4, z1 - z0, 0, door + 8.2, (z0 + z1) / 2));
  K.both({ paint: new THREE.Color(PALETTE.accent), smooth: false, side: THREE.FrontSide }, box(11, 1, 1.2, 0, door + 9.6, z1 + 0.1));
  K.both(M.voidM, box(4.3, 7, 0.9, 0, door + 3.5, R + 0.85));   // (drawn and solid as one: the dark of the doorway, back to the tower's wall)
  // the causeway: flat stones from the apron to the end of the lit path
  const pathL = K.local(V(SITE.path[0], 0, SITE.path[1]));
  const n = 9;
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n, z = R + 7 + (pathL.z - (R + 7)) * k, x = pathL.x * k;
    const top = THREE.MathUtils.lerp(door, 0.6 - base, k);
    K.both(M.stone, T(new THREE.CylinderGeometry(2.2, 2.4, top + 1.2, 10), [x, (top - 1.2) / 2, z]));
  }
  K.flush();
  // the lamp up there, dark until the Lampless is calm (the world change lights it)
  const lampM = makeMaterial({ color: PALETTE.lamp, glow: 0.04, flat: true, key: 'temple.p2.outlamp' });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(R - 3.6, 20, 14), lampM);
  lamp.position.copy(K.world(0, door + 46, 0));
  lamp.userData.noCollide = true; lamp.userData.dynamic = true;
  rt.root.add(lamp);
  const at = K.world(0, door, R + 2.2);
  return { door: { at, heading: yaw }, kit: K, base, doorY: base + door, R, lamp, lampM, top: base + door + 55, clear: [{ x: SITE.x, z: SITE.z, r: R + 9 }] };
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
  const tip = new THREE.Vector3();
  const light = new THREE.Vector4(0, -1e5, 0, 0);
  rt.lights.push(light);
  let k = 0, want = 0;
  return {
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; },
    update(dt, t) {
      k += (want - k) * Math.min(1, dt / 4);
      const on = k > 0.02;
      if (O) {
        O.lampM.uniforms.uGlow.value = 0.04 + 0.96 * k * (0.92 + 0.08 * Math.sin(t * 3));
        beam.visible = on;
        // (turning slowly, a little over the level: 140 m out, 9 m across at its end)
        const a = t * 0.25;
        tip.set(-Math.cos(0.08) * Math.cos(a), Math.sin(0.08), Math.cos(0.08) * Math.sin(a)).multiplyScalar(140).add(O.lamp.position);
        if (on) beam.set(O.lamp.position, 0.4, tip, 9).fade(k);
        if (on) light.set(O.lamp.position.x, O.lamp.position.y, O.lamp.position.z, 60 * k); else light.set(0, -1e5, 0, 0);
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
