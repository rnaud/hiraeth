import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Switch, Jaw, Swing, Platform, Plate, Ball, Mark, Pit, Key, Coffer } from './pieces.js';
import { snapperModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';

// Lorn's temple: the Hush-House, a great low dome of violet stone on the cave
// island, crystals of the swamp's groves growing up through it, its door
// looking east over the channel. The makers taught the plants of Lorn not to
// eat in here (the Hush, the swamp people's glyph, three drops over a shut
// mouth, is theirs), and grew the first snapper of all to keep the house: the
// Mother, whom every snapping plant on Lorn is seeded from. The night the sky
// rang the house's crystals went out of tune, and she woke, frightened, and
// has snapped at everything since.
//
// Inside (built far overhead, through its door). The temple's one idea: the makers sang from low to high;
// first with the fluid, then with the stilling mode.
//   the Threshold          the first mark, the way out, and the smallest crystal, by the door
//   the Choir              three more crystals, each its own height: splash them low to high and the door opens
//                          (out of turn, a crystal rings flat and fades: logic.js `after`). The lowest note is
//                          not in the Choir: it was sung at the door (the Threshold's crystal, a room back)
//   the Bog Well           a riding disc that climbs over dark water, then a wall of roots to climb; the door
//                          at its top wants the eye on the root-wall's face, seen from the disc (not from the top).
//                          (v1.52, issue #23) Beside it on the root-wall's top, a little door of one keyhole on a
//                          ledge that runs round the well's west wall, over the water, to a way south at 9 m
//   the Stilling Chamber   the makers' chest: the STILLING MODE (src/items.js 'stun'). Its way on is open
//   the Snapping Passage   a room on, crystals grown up through its floor: the door into the gallery is a gate of
//                          jaws that snaps, and snaps: a stilling glob stills it, and it rests open (the stilling
//                          mode's first lock, where failing costs a nip). (v1.52) Two more mouths in its walls, and a
//                          crystal grown through each one's crown, small, middling, the gate's the biggest: they still
//                          only in the Choir's order, low to high, and the gate last (the one you shoot first rings
//                          flat). The smallest mouth keeps a coffer
//   the Pendulum Gallery   a narrow bridge over a chasm, three crystal pendulums swinging across it (still
//                          them, one by one, to cross); the far door wants their notes, and a pendulum's note
//                          only takes stilled in turn, low to high, smallest crystal first, as the Choir taught.
//                          They hang out of that order, so the walk across stills them wrong: still them again,
//                          in turn, from the far side (the gadget with the temple's first verb, the order).
//                          Along the east wall a keeper's ledge runs back over the chasm to a shut gate by the
//                          near landing: it opens once the Nursery is won (v1.52; a footstone behind it before),
//                          and then the way back over is a walk, not the pendulums again (a shortcut)
//   the Nursery            (v1.52, west off the far landing, an arena) where the Mother's seedlings were raised: its
//                          door shuts behind you while they snap. Won, the small key's cage sinks: for the ledge's
//                          door round the Bog Well, back past the chest (the keeper's ledge is the way back over)
//   the Choir's balcony    (v1.52, along the ledge round the well and south through the Choir's north wall, 9 m over
//                          the first crystals) the great key, seen from the Choir's floor at the start, caged behind a
//                          wall across the balcony; a ball in a groove that runs through a snapper's mouth in it to the
//                          cage's footstone. Shut, the mouth spits the ball back; stilled, it opens, but here the frost
//                          thaws and it snaps shut again a few breaths on: still it, roll the ball through before it
//                          wakes, and still it again to walk through yourself. The far door takes the great key
//   the Mother's Hall      the guardian (organic: you calm her): the Mother Snapper, rooted in the middle of a
//                          round hall. Her head lunges, sweeps, spits seed; spent after a lunge it lies on the
//                          floor, agape: a stilling glob in her mouth calms her. Later, still her mid-strike.
//                          Three crystal pendulums swing high over her, out of tune and out of order: stilled in
//                          turn, smallest first, their notes calm her (taught in her second phase; in her last the
//                          cold no longer eases her, only the crystals sung low to high)
// After: the dome flowers, and every snapping plant on Lorn has a ring of the same flowers at its foot.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On the cave island, clear of the cave; its door looks east, over the channel to the fireflies' isle. */
export const SITE = { x: -135, z: 105, r: 16, path: [-108, 107] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

/**
 * The Hush-House's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/hush-house):
 * violet stone in cracked beds, its frames and ribs a darker violet, violet-grey flags (no more green floors), olive moss at
 * the walls' foot, little crystals of teal and violet growing under every frieze; its shade a deep violet, its light the
 * dusk's rose.
 */
export const PALETTE = {
  wall: '#6b5b8e', wall2: '#605184', wall3: '#77689b', floor: '#5d5375', floor2: '#53496a', trim: '#554679', fitting: '#9a8cc0',
  dark: '#2a2448', stone: '#7b6d97', accent: '#e0708a', glow: '#a8e6ee', glyph: '#8fe6d6', lamp: '#d6ff9a', sand: '#4f6a5e', sand2: '#5a7a66', void: '#1a1630',
  look: {
    all: { shadeFlat: 0.15, shadeHue: 0.7, shade: 0.22 },
    wall: { cracks: 0.5 },
    floor: { mode: 0, grid: 2.2, plates: true },
    glyph: { glow: 0.6 },
  },
  bands: [{ at: 0.72, h: 1.0, color: '#57497b' }, { y: 0.25, h: 0.5, color: '#6b7340' }],
  ornament: { kind: 'crystal', color: '#9ee8dc', color2: '#b49ae8', glow: 0.6 },
  light: { shadow: '#51468a', light: '#f2dcea', sun: '#ffd0c8' },
};

/**
 * (v1.52, issue #23) The Nursery, west off the Pendulum Gallery's far landing (an arena), and the way to the great key:
 * the ledge round the Bog Well's west wall at 9 m (from the root-wall's top, by a door of one keyhole, `ledge.door` its
 * angle, round to the south at `ledge.to`), then the Choir's balcony over its north end (z from `z0` to the wall), a wall
 * across it at `wall` (x) with a snapper's mouth on the ball's groove (z `groove`); the ball rests at `start`, the jaws
 * stilled stand open `hold` s. The Snapping Passage's two side mouths (`mouths`: the smallest first).
 */
export const NURSERY = { x: -23, z: 133.9, w: 14, d: 14, zone: { min: [-30, 8, 126.9], max: [-16, 18, 140.9] } };   // (z: the gallery's G0 + 30)
export const LEDGE = { r0: 7.6, r1: 10.3, from: -1.15, to: -Math.PI - 0.16, door: -1.45, y: 9, h: 4.4, slit: 0.55 };   // (h, slit: the cloister past the door, issue #356)
export const BALCONY = { z0: 37, y: 9, groove: 40.5, a: 9.5, b: -6.5, wall: -3, start: 0.6, hold: 10, key: [-9.0, 38.7] };   // (the key by the parapet: seen from the Choir's floor)
export const MOUTHS = [{ id: 'dj1', still: 'j1', side: 'w', z: 100, crown: 0.7 }, { id: 'dj2', still: 'j2', side: 'e', z: 93.4, crown: 1.2 }];

export const LOGIC = {
  id: 'perdide', entry: 'threshold', gadget: 'stun',
  rooms: { threshold: { checkpoint: true }, choir: { checkpoint: true }, well: { checkpoint: true }, stilling: { checkpoint: true }, gallery: { checkpoint: true }, galleryFar: { checkpoint: true }, nursery: { checkpoint: true }, balcony: { checkpoint: true }, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'choir' },
    { a: 'choir', b: 'well', door: 'd1' },
    { a: 'well', b: 'stilling', door: 'dw' },
    { a: 'well', b: 'balcony', door: 'dL' },             // the ledge round the well to the Choir's balcony (v1.52): the Nursery's small key
    { a: 'stilling', b: 'gallery', door: 'd2' },         // the Snapping Passage's jaws, a room on from the chest (one room with it)
    { a: 'gallery', b: 'galleryFar', needs: ['stun'] },   // the pendulums: still them to cross
    { a: 'galleryFar', b: 'nursery', door: 'dN' },        // the Nursery, west off the far landing (v1.52): an arena, the small key
    { a: 'galleryFar', b: 'hall', door: 'd3' },
    { a: 'galleryFar', b: 'gallery', door: 'ds' },        // the keeper's ledge back along the east wall: its gate opens once the Nursery is won
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the four crystals, sung low to high: the lowest by the door, three in the Choir
    c1: { type: 'switch', room: 'threshold' },
    c2: { type: 'switch', room: 'choir', after: 'c1' },
    c3: { type: 'switch', room: 'choir', after: 'c2' },
    c4: { type: 'switch', room: 'choir', after: 'c3' },
    d1: { type: 'door', opens: { all: [{ lit: 'c1' }, { lit: 'c2' }, { lit: 'c3' }, { lit: 'c4' }] }, latch: true },
    sw: { type: 'switch', room: 'well' },                          // the eye on the root-wall's face
    dw: { type: 'door', opens: { lit: 'sw' }, latch: true },
    chest: { type: 'gadget', room: 'stilling', item: 'stun' },
    // the passage's three mouths, stilled in the Choir's order (v1.52): the smallest crown, the middling, the gate's
    j1: { type: 'switch', room: 'stilling', needs: ['stun'] },
    j2: { type: 'switch', room: 'stilling', needs: ['stun'], after: 'j1' },
    j3: { type: 'switch', room: 'stilling', needs: ['stun'], after: 'j2' },
    dj1: { type: 'door', opens: { lit: 'j1' }, latch: true },      // (the side mouths: the smallest's keeps a coffer)
    dj2: { type: 'door', opens: { lit: 'j2' }, latch: true },
    d2: { type: 'door', opens: { all: [{ lit: 'j1' }, { lit: 'j2' }, { lit: 'j3' }] }, latch: true },
    // the pendulums' notes, stilled in turn: smallest crystal (lowest) first
    w1: { type: 'switch', room: 'gallery', needs: ['stun'] },
    w2: { type: 'switch', room: 'gallery', needs: ['stun'], after: 'w1' },
    w3: { type: 'switch', room: 'gallery', needs: ['stun'], after: 'w2' },
    d3: { type: 'door', lock: 'big', opens: { all: [{ lit: 'w1' }, { lit: 'w2' }, { lit: 'w3' }] }, latch: true },   // (and the great key, v1.52)
    ds: { type: 'door', opens: { lit: 'arN' }, latch: true },      // (v1.52: it opens once the Nursery is won; its footstone was a step of nothing)
    // the Nursery: its seedlings beaten, the small key's cage sinks
    arN: { type: 'arena', room: 'nursery' },
    kS: { type: 'key', kind: 'small', room: 'nursery', when: { lit: 'arN' } },
    dN: { type: 'door', opens: null },
    dL: { type: 'door', lock: 'small' },                           // the ledge's door, on the root-wall's top
    // the Choir's balcony: a snapper's mouth across the ball's groove, stilled only a while (`hold`: the frost thaws);
    // shut, it spits the ball back. The ball on the cage's footstone lets the great key out
    jB: { type: 'switch', room: 'balcony', needs: ['stun'], hold: BALCONY.hold },
    dJ: { type: 'door', opens: { lit: 'jB' } },
    oB: { type: 'drum', room: 'balcony', plate: 'pB', plateAt: 1, start: BALCONY.start, needs: ['stun'], gap: 'dJ' },
    pB: { type: 'plate', room: 'balcony' },
    kB: { type: 'key', kind: 'big', room: 'balcony', when: { drumOn: ['oB', 'pB'] } },
    mother: { type: 'boss', room: 'hall', needs: ['gun', 'stun'] },
    d5: { type: 'door', opens: { resolved: true } },
    cache: { type: 'cache', room: 'stilling' },                    // in the smallest mouth's niche
  },
};

/** The Nursery's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arN', room: 'nursery', zone: NURSERY.zone, doors: ['dN'], extra: 2,
  shut: 'The door grinds shut behind you. Among the old seed-beds, something snaps awake.',
  won: 'The last of them goes still among the beds. The key’s cage sinks, the door lets go, and out over the chasm the keeper’s gate grinds open.',
}];

export const MOTHER = {
  kind: 'organic', name: 'the Mother Snapper', final: 'touch', touch: 'lay a hand on her head',
  speed: 0, wakeTime: 3.2,
  wake: 'A head of jaws on a long neck uncurls from its leaves. The Mother.',
  openHint: 'Her head lies spent on the floor, jaws agape.',
  weary: 'Her head comes down by her leaves, her crown aglow. Go to her.',
  resolved: 'The Mother Snapper sleeps. Up in the dome the crystals hum in tune.',
  phases: [
    { to: 0.45, attacks: ['lunge', 'sweep'], pause: 1.5, hint: 'When her head lies spent after a lunge, still her: cold in her mouth.' },
    { to: 0.75, attacks: ['snap', 'seed', 'sweep'], pause: 1.2, hint: 'She feints now. Still her, or still the three crystals, smallest first.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'push', moves: ['snap'], open: 3.6,
        hint: 'Push her head as she rears to snap: it slams down, spent.',
        said: 'Shoved aside, her head slams down spent, jaws agape. Still her.',
        lines: ['She rears back to snap.', 'Push her head as she rears to snap, and it slams down spent.', 'Switch to the push and fire it at her head as it draws back to snap; then still her open mouth.'] } },
    { to: 0.9, attacks: ['thrash', 'seed', 'snap'], pause: 1.0, hint: 'The cold no longer eases her: still the crystals, smallest first.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    lunge: { shape: 'lane', range: 13.5, width: 3.4, wind: 1.4, track: 0.6, part: 'mouth', parts: ['mouth'], splash: 0.4, active: 0.35, damage: 1, knock: 11, recover: 0.6, open: 3.6 },
    sweep: { shape: 'cone', range: 9.5, angle: 0.95, wind: 1.2, track: 0.6, part: 'mouth', side: 1, parts: ['mouth'], splash: 0.4, active: 0.35, gap: 0.65, damage: 0.75, knock: 12, recover: 0.7, then: 'sweepBack' },
    sweepBack: { shape: 'cone', range: 9.5, angle: 0.95, wind: 0.75, track: 0.5, part: 'mouth', pose: 'sweep', side: -1, link: true, parts: ['mouth'], splash: 0.4, active: 0.35, damage: 0.75, knock: 12, recover: 0.8 },
    seed: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.0, wind: 1.5, track: 0.55, part: 'mouth', open: 1.6, damage: 0.75, knock: 8, recover: 0.8 },
    snap: { shape: 'lane', range: 7.5, width: 3, wind: 1.2, track: 0.7, part: 'mouth', parts: ['mouth'], splash: 0.4, active: 0.3, gap: 0.75, damage: 0.5, knock: 8, recover: 0.4, then: 'snap2' },
    snap2: { shape: 'lane', range: 7.5, width: 3, wind: 0.65, track: 0.6, part: 'mouth', pose: 'snap', link: true, parts: ['mouth'], splash: 0.4, active: 0.3, damage: 0.5, knock: 8, gap: 0.2, then: 'lungeEnd' },
    lungeEnd: { shape: 'lane', range: 13.5, width: 3.4, wind: 1.2, track: 0.5, part: 'mouth', pose: 'lunge', link: true, parts: ['mouth'], splash: 0.4, active: 0.35, damage: 1, knock: 11, recover: 0.6, open: 3.6 },
    thrash: { shape: 'ring', at: 'self', radius: 7, wind: 1.3, part: 'core', rig: 'swell', parts: ['body'], splash: 0.4, active: 0.4, gap: 0.3, damage: 0.75, knock: 12, recover: 0.6, then: 'seedVolley' },
    seedVolley: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.1, track: 0.55, part: 'mouth', pose: 'seed', link: true, open: 2.0, damage: 0.5, knock: 6, recover: 0.8 },
  },
};

/** Only the stilling mode calms her: plain fluid startles her, a shove frightens her. */
function motherHit(g, part, mode) {
  const rt = g.rt;
  if (mode === 'stun') {
    if (g.phaseIndex >= 2 && (part === 'mouth' && g.state === 'open')) {
      rt.notice('The cold settles, but she shakes her crown at the crystals out of tune.', 'mother.tune');
      return true;
    }
    if (part === 'mouth' && g.state === 'open') {
      g.add(0.15, 'still');
      rt.notice('The cold settles in her mouth. Her jaws ease, and her head comes up.', 'mother.still');
      rt.sound?.chime?.();
      if (g.state === 'open') { g.enter('fight'); g.cool = 2.2; }
      return true;
    }
    if (g.attack && g.state === 'fight' && !g.struck) {
      // stilled mid-strike: it never lands; once she has begun to calm, it calms her more
      g.stop(); g.cool = 2.4;
      if (g.phaseIndex >= 2) rt.notice('She stops, frosted, and shakes it off: the cold no longer eases her.', 'mother.mid2');
      else if (g.phaseIndex >= 1) { g.add(0.15, 'still'); rt.sound?.chime?.(); rt.notice('She stops mid-strike, frosted, and sways. Her crown glows brighter.', 'mother.mid'); }
      else rt.notice('She stops mid-strike, frosted, and shakes it off.', 'mother.mid0');
      return true;
    }
    return true;
  }
  if (mode === 'push') { g.add(-0.04, 'push'); rt.notice('She rears from the shove and snaps the air, more frightened than before.', 'mother.push'); return true; }
  if (part === 'mouth' && g.state === 'open') {
    g.enter('fight'); g.cool = 1.2;
    rt.notice('She snaps at the splash and rears up: it only startles her.', 'mother.fluid');
    return true;
  }
  rt.notice('The fluid runs off her leaves. It does not calm her.', 'mother.leaves');
  return true;
}

/**
 * A crystal over the Mother stilled (a Swing's onStill): in turn, smallest first, its note rings true and stays;
 * the third calms her (a tenth, in her last phase the whole of it). Out of turn it rings flat, the notes stilled so
 * far fade, and she snaps up startled: begin again from the smallest.
 */
export function motherCrystal(rt, sw) {
  const C = rt.motherCrystals, G = rt.guardian;
  if (!C || !G?.awake || G.state === 'weary') { rt.notice('The crystal stops, frosted over, and hums its note into the hall.', 'mc.still'); return; }
  if (sw.taken) return;
  if (sw.o.rank !== C.next) {
    sw.flat = 0.8; rt.sound?.critter?.('blip', 0.5);
    for (const s of C.list) s.taken = false;
    C.next = 0;
    if (G.state === 'fight' && !G.attack) G.cool = Math.min(G.cool, 0.4);
    rt.notice('It rings flat, and she snaps up, startled. Smallest crystal first.', 'mc.flat');
    return;
  }
  sw.taken = true; C.next++;
  rt.sound?.chime?.();
  if (C.next < C.list.length) { rt.notice('The crystal rings true over her, and she turns her head up to listen.', 'mc.true'); return; }
  for (const s of C.list) s.taken = false;
  C.next = 0;
  G.add(G.phaseIndex >= 2 ? 0.15 : 0.1, 'crystals');
  rt.notice('Low to high, the three notes ring true: her jaws ease, her crown glows.', `mc.done.${Math.min(G.phaseIndex, 2)}`);
  if (G.state === 'open') { G.enter('fight'); G.cool = 2.2; }
}

const MOUTH_WRONG = 'Its crystal rings flat in the cold, and the jaws snap on. The makers sang from low to high: the smallest crystal first.';

/**
 * (v1.52, issue #23) The Snapping Passage's two side mouths (the gate's is in the layout), the Nursery west off the
 * gallery's far landing, and the way to the great key: the ledge round the Bog Well's west wall from the root-wall's top
 * (a door of one keyhole), south over the well's door and through the Choir's north wall onto its balcony.
 */
function wings(rt, K, M, { C2, A0, G0, spike, root }) {
  const add = (P, o) => rt.add(P, o);
  // ---- the side mouths, each in a niche of the passage's wall, a crystal through its crown (the smallest keeps a coffer)
  for (const m of MOUTHS) {
    const s = m.side === 'w' ? -1 : 1, x0 = s * 7.2, deep = m.id === 'dj1' ? 3.2 : 1.8, x1 = s * (7.2 + deep), xc = (x0 + x1) / 2;
    K.slab(Math.min(s * 5.9, x1), m.z - 1.6, Math.max(s * 5.9, x1), m.z + 1.6, 9, 0.8);
    K.both(M.wall, box(0.5, 3.8, 3.2, x1 + s * 0.25, 10.9, m.z), box(deep, 3.8, 0.5, xc, 10.9, m.z - 1.55), box(deep, 3.8, 0.5, xc, 10.9, m.z + 1.55), box(deep + 0.5, 0.6, 3.6, xc + s * 0.25, 13.1, m.z));
    add(Jaw, { id: m.id, still: m.still, at: [s * 6.6, 9, m.z], yaw: Math.PI / 2, w: 2.6, h: 3.4, seed: m.id === 'dj1' ? 3 : 5, wrong: MOUTH_WRONG,
      stilled: m.id === 'dj1' ? 'The smallest crystal rings true, low, and the little jaws stop dead, frosted, and ease open.' : 'The middling crystal rings true, a note higher, and its jaws stop dead, frosted, and ease open.' });
    K.both(M.trim, box(0.7, 0.3, 0.9, s * 5.75, 12.75, m.z));
    spike(s * 5.75, 12.9, m.z, m.crown, 0.18 + m.crown * 0.1, -s * 0.15, 0.6);
    if (m.id === 'dj1') add(Coffer, { id: 'cache', at: [s * 9.4, 9, m.z], yaw: -s * Math.PI / 2 });
    else { spike(s * 8.2, 9, m.z - 0.5, 1.6, 0.35, s * 0.2, 1); spike(s * 8.0, 9, m.z + 0.7, 1.1, 0.3, -s * 0.2, 2); }
  }

  // ---- the Nursery (an arena): old seed-beds in rings of stone, where the Mother's seedlings were raised
  const N = NURSERY;
  K.corridor([-11.6, N.z], [N.x + N.w / 2 + 0.6, N.z], 9, { w: 5, h: 6.4 });
  K.hall({ x: N.x, z: N.z, w: N.w, d: N.d, y: 9, h: 10, roof: true, doors: [{ side: 'e', at: 0, w: 5, h: 6.4 }] });
  add(Door, { id: 'dN', at: [-13.5, 9, N.z], yaw: Math.PI / 2, w: 5, h: 6.4 });   // (open: it shuts behind you while they stand)
  for (const [bx, bz] of [[-3.4, -3.6], [3.2, -3.4], [-3.0, 3.8], [3.6, 3.2]]) {
    K.both(M.trim, T(annulus(1.3, 1.7, 0.4, 20), [N.x + bx, 9.2, N.z + bz]));
    K.add(M.dark, T(new THREE.CylinderGeometry(1.3, 1.3, 0.1, 20), [N.x + bx, 9.08, N.z + bz]));
  }
  spike(N.x - 5.2, 9, N.z + 5.4, 3.2, 0.6, 0.2, 1); spike(N.x + 5.4, 9, N.z - 5.6, 2.4, 0.5, -0.25, 2);
  add(Key, { id: 'kS', at: [N.x - N.w / 2 + 1.6, 9, N.z], yaw: Math.PI / 2 });
  add(Mark, { room: 'nursery', at: [N.x + 3.5, 9, N.z + 3], yaw: -Math.PI / 2 });

  // ---- the ledge round the Bog Well's west wall at 9 m (the root-wall's top to the well's south side), its door
  const Lg = LEDGE, rc = (Lg.r0 + Lg.r1) / 2, n = 8, da = (Lg.to - Lg.from) / n;
  for (let i = 0; i < n; i++) {
    const a = Lg.from + (i + 0.5) * da, len = 2 * Lg.r1 * Math.sin(Math.abs(da) / 2) + 0.3;
    K.both(M.floor, T(box(len, 0.8, Lg.r1 - Lg.r0, 0, 0, 0), [Math.sin(a) * rc, Lg.y - 0.4, C2 + Math.cos(a) * rc], [0, a, 0]));
    K.add(M.trim, T(box(len - 0.25, 0.3, 0.25, 0, 0, 0), [Math.sin(a) * (Lg.r0 + 0.12), Lg.y + 0.15, C2 + Math.cos(a) * (Lg.r0 + 0.12)], [0, a, 0]));   // (a lip on its inner edge, drawn)
    if (i % 2) K.both(M.trim, T(box(0.5, 1.8, 0.8, 0, 0, 0), [Math.sin(a) * (Lg.r1 - 0.5), Lg.y - 1.7, C2 + Math.cos(a) * (Lg.r1 - 0.5)], [0, a, 0]));   // (corbels under it)
  }
  root([[-9.2, 14, C2 - 2], [-9.4, 11, C2 - 4], [-9.0, 9.4, C2 - 6.5]], 0.3);
  const ad = Lg.door, dx = Math.sin(ad) * rc, dz = C2 + Math.cos(ad) * rc;
  add(Door, { id: 'dL', at: [dx, Lg.y, dz], yaw: ad - Math.PI / 2, w: Lg.r1 - Lg.r0 + 0.2, h: 4.4 });
  K.both(M.wall, T(box(0.6, 5.2, 0.6, 0, 0, 0), [Math.sin(ad) * (Lg.r0 - 0.4), Lg.y + 2.6, C2 + Math.cos(ad) * (Lg.r0 - 0.4)], [0, ad, 0]));   // (its post on the water's side)
  // (issue #356) past the door the ledge is a cloister: a wall on the water's side cut in slits too narrow to pass, and a
  // roof at the door's lintel. Open, the double jump went over the door (4.4 m) and a jump from the root-wall's top
  // round its post, over the water, onto the ledge beyond (tests/door-bypass.test.js)
  const n2 = 9, da2 = (Lg.to - ad) / n2, ri = Lg.r0 + 0.25;
  for (let i = 0; i < n2; i++) {
    const a = ad + (i + 0.5) * da2;
    const inner = 2 * ri * Math.sin(Math.abs(da2) / 2) - LEDGE.slit, outer = 2 * Lg.r1 * Math.sin(Math.abs(da2) / 2) + 0.3;
    K.both(M.wall, T(box(inner, LEDGE.h + 0.1, 0.5, 0, 0, 0), [Math.sin(a) * ri, Lg.y + LEDGE.h / 2 - 0.05, C2 + Math.cos(a) * ri], [0, a, 0]));   // (its foot sunk in the ledge: no face in the floor's plane)
    K.both(M.trim, T(box(outer, 0.6, Lg.r1 - Lg.r0 + 0.6, 0, 0, 0), [Math.sin(a) * rc, Lg.y + LEDGE.h + 0.3, C2 + Math.cos(a) * rc], [0, a, 0]));
  }

  // ---- the way south at 9 m: through the well's wall over its door and the Choir's north wall, onto the balcony
  const B = BALCONY;
  K.slab(-1.8, 44, 1.8, 47.6, B.y, 0.8);
  for (const sx of [-1, 1]) K.both(M.wall, box(0.8, 4.6, 0.7, sx * 2.0, B.y + 2.3, 45.5));
  K.both(M.wall, box(4.8, 0.8, 0.7, 0, B.y + 5.0, 45.5));
  // the balcony over the Choir's north end, a parapet along its edge; a wall across it with a snapper's mouth on the
  // ball's groove, the great key's cage beyond
  K.slab(-12, B.z0, 12, 44, B.y, 0.8);
  K.both(M.trim, box(24, 1.0, 0.4, 0, B.y + 0.5, B.z0 + 0.2));
  for (const x of [-7.5, -2.5, 2.5, 7.5]) K.both(M.trim, box(0.6, 1.6, 0.9, x, B.y - 1.6, B.z0 + 0.5));   // (corbels under its edge)
  K.wall(B.wall, B.z0 - 0.8, B.wall, 44, B.y, 5, { t: 0.8, holes: [{ at: B.groove - (B.z0 - 0.8), w: 2.8, h: 3.0 }] });
  add(Jaw, { id: 'dJ', still: 'jB', at: [B.wall, B.y, B.groove], yaw: Math.PI / 2, w: 2.6, h: 2.8, seed: 7,
    stilled: 'The jaws stop dead, frosted, and ease open. Here the frost does not hold long.',
    thawing: 'The frost on the jaws is cracking.' });
  K.add(M.dark, box(B.a - B.b + 1.2, 0.04, 1.0, (B.a + B.b) / 2, B.y + 0.02, B.groove));
  for (const sd of [-1, 1]) K.add(M.trim, box(B.a - B.b + 1.2, 0.12, 0.25, (B.a + B.b) / 2, B.y + 0.06, B.groove + sd * 0.75));
  add(Ball, { id: 'oB', a: [B.a, B.y + 0.04, B.groove], b: [B.b, B.y + 0.04, B.groove], r: 0.85, lock: true,
    jaws: { id: 'dJ', at: (B.a - B.wall) / (B.a - B.b), spat: 'The jaws snap at the ball and spit it back down its groove.' } });
  add(Plate, { id: 'pB', at: [B.b, B.y, B.groove], r: 1.0 });
  add(Key, { id: 'kB', big: true, at: [B.key[0], B.y, B.key[1]], yaw: Math.PI / 2 });
  add(Mark, { room: 'balcony', at: [8, B.y, 42.4], yaw: -Math.PI / 2 });
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const root = (pts, r) => K.both(M.floor, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V(...p))), 16, r, 7, false));
  const crystalM = makeMaterial({ color: PALETTE.glow, glow: 0.45, flat: true, key: 'temple.lorn.crystal' });
  const spike = (x, y, z, h, r, tilt = 0, yaw = 0) => K.both(crystalM, T(new THREE.ConeGeometry(r, h, 5).translate(0, h / 2, 0), [x, y, z], [tilt, yaw, 0]));

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.both(M.voidM, box(3.6, 5, 1.25, 0, 2.5, -0.625));   // (drawn and solid as one: from the doorway's face back to the wall's inner face)
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-12.2, 12.6, 12.2, 12.6, 0, 13, { t: 1.2, holes: [{ at: 12.2, w: 6, h: 7 }] });
  spike(-5.8, 0, 10.5, 3.5, 0.6, 0.2); spike(5.6, 0, 10.8, 2.6, 0.5, -0.25, 1);
  // the first note, sung at the door: the smallest crystal, by the way in
  const wrong = 'It rings flat, and fades. The makers sang from low to high, and the first note at the door.';
  add(Switch, { id: 'c1', at: [4.4, 0, 6.5], crystal: 1.8, size: 0.9, wrong });
  K.both(M.trim, T(annulus(1.5, 1.9, 0.2, 24), [4.4, 0.1, 6.5]));

  // ---- the Choir (z 12.6..44): three crystals, each its own height; splash them low to high (after the door's)
  K.hall({ x: 0, z: 28.3, w: 24, d: 31.4, y: 0, h: 14, roof: 'oculus', columns: 3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4 }, { side: 'n', w: 3.2, h: 4.6, y0: 9 }] });   // (and over the door, the way onto the balcony, v1.52)
  for (const [id, x, z, h] of [['c3', -6, 20, 4.4], ['c4', -6, 35, 5.6], ['c2', 6, 37, 3.1]])
    add(Switch, { id, at: [x, 0, z], crystal: h, size: 0.9, wrong });
  // where the fourth stood: an empty ring of stone
  K.both(M.trim, T(annulus(1.0, 1.5, 0.25, 24), [6, 0.12, 23]));
  K.both(M.trim, T(annulus(1.8, 2.4, 0.3, 28), [0, 0.15, 28.3]));
  K.add(M.glyph, T(glyphGeometry(2.6, 0.05).rotateX(-Math.PI / 2), [0, 0.32, 28.3]));
  add(Door, { id: 'd1', at: [0, 0, 44.6], w: 5, h: 6.4, lamps: [{ lit: 'c1' }, { lit: 'c2' }, { lit: 'c3' }, { lit: 'c4' }] });
  add(Mark, { room: 'choir', at: [7.5, 0, 16], yaw: -Math.PI / 2 });
  spike(-10.5, 0, 14.5, 6, 0.9, 0.15); spike(10.6, 0, 42, 7.5, 1.0, -0.2, 2); spike(10.2, 0, 15.5, 4, 0.7, -0.1, 1);
  root([[-11.5, 13, 40], [-10, 8, 36], [-11, 3, 31], [-11.3, 0, 26]], 0.7);

  // ---- the Bog Well (a rotunda, floor 0): a disc that climbs over the dark water, then a wall of roots to 9
  K.slab(-3.2, 44, 3.2, 46.6, 0, 0.8);
  K.wall(-3.2, 44.6, -3.2, 46.6, 0, 6.4, { t: 0.8 }); K.wall(3.2, 46.6, 3.2, 44.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.8, 45.6));
  const C2 = 57.2;
  K.rotunda({ x: 0, z: C2, y: -6, r: 10, h: 30, floor: false, gaps: [{ a: Math.PI, w: 5, h: 6.4, y0: 6 }, { a: 0, w: 5, h: 6, y0: 15 }, { a: Math.PI, w: 3.2, h: 4.6, y0: 15 }], oculus: 0.3 });   // (the ledge's way south, over the door: v1.52)
  K.both(M.floor, box(20, 6, 3, 0, -3, C2 - 8.6));            // the near landing (its top at 0)
  K.both(M.dark, T(new THREE.CylinderGeometry(10, 10, 1, 32), [0, -6.5, C2]));
  const bog = makeMaterial({ color: '#2f4a48', glow: 0.12, flat: true, key: 'temple.lorn.bog' });
  K.add(bog, T(new THREE.CylinderGeometry(9.8, 9.8, 0.2, 32), [0, -2.4, C2]));
  add(Pit, { room: 'well', min: [-11, -8, C2 - 7], max: [11, -1.5, C2 + 3] });
  add(Platform, { path: [[0, 0, C2 - 4.8], [0, 3, C2 + 0.6]], r: 2.2, speed: 1.4, pause: 1.8 });
  // the root-wall, its top at 9: climb it (with the roots down its face and the landing on top: the house's
  // climbs, its other walls are not climbed, issue #115)
  K.climbable('the Bog Well\'s root-wall: climbed from the riding disc to the door at its top', () => {
    K.both(M.wallGlyph, box(20, 15, 6, 0, 1.5, C2 + 6));
    root([[-6, 9, C2 + 3.2], [-5, 5, C2 + 3.1], [-6.2, 1, C2 + 3.15], [-6, -3, C2 + 3.1]], 0.45);
    root([[5, 9, C2 + 3.2], [6, 4, C2 + 3.1], [4.8, 0, C2 + 3.15], [5.4, -3, C2 + 3.1]], 0.45);
    K.slab(-6, C2 + 9, 6, C2 + 10.4, 9, 0.6);
  });
  add(Mark, { room: 'well', at: [-3.2, 0, C2 - 8.6], yaw: Math.PI / 2 });
  // the door at the root-wall's top, and its eye on the wall's face: at eye height on the disc, out of sight above
  add(Door, { id: 'dw', at: [0, 9, C2 + 10.7], w: 5, h: 6, lamps: [{ lit: 'sw' }] });
  add(Switch, { id: 'sw', at: [-2.6, 4.5, C2 + 2.8], yaw: Math.PI, size: 1.0 });
  spike(7.5, -2.4, C2 - 3, 5, 0.8, -0.3); spike(-7.2, -2.4, C2 - 1, 4, 0.7, 0.3, 1);

  // ---- the corridor and the Stilling Chamber (floor 9, a rotunda): the chest; a gate of jaws
  K.slab(-3.2, C2 + 9.8, 3.2, C2 + 12.6, 9, 0.8);
  K.wall(-3.2, C2 + 10.4, -3.2, C2 + 12.6, 9, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.4, 9, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 15.8, C2 + 11.6));
  const C3 = C2 + 22.6;    // 79.8
  K.rotunda({ x: 0, z: C3, y: 9, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5.4, h: 6.6 }], oculus: 0.3 });
  // the dais, solid as drawn: its two steps as cylinders (one cylinder stood over its lower step; the lathe
  // alone gave no top a ray from above could land on, so the chest sank into the dais: the QC pass)
  K.both(M.trim, ...chestMound(0, 9, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  add(Mark, { room: 'stilling', at: [6, 9, C3 - 5], yaw: -Math.PI * 0.75 });
  spike(-6.5, 9, C3 + 3, 4.5, 0.7, 0.25); spike(6.2, 9, C3 + 4, 3.2, 0.6, -0.2, 2);

  // ---- the Snapping Passage (floor 9), a room on: the door into the gallery is a gate of jaws
  const A0 = C3 + 10.9;
  K.slab(-3.2, C3 + 9.2, 3.2, A0 + 0.6, 9, 0.8);
  K.hall({ x: 0, z: A0 + 6, w: 12, d: 12, y: 9, h: 9, roof: true, omit: ['n'], doors: [{ side: 's', w: 5.4, h: 6.6 }, ...MOUTHS.map((m) => ({ side: m.side, at: m.z - (A0 + 6), w: 2.6, h: 3.4 }))] });   // (and the two side mouths, v1.52)
  spike(-5, 9, A0 + 4, 3.6, 0.6, 0.2, 3); spike(5.1, 9, A0 + 8.5, 2.8, 0.5, -0.25, 4);

  // ---- the Pendulum Gallery (z 104..138): a narrow bridge over a chasm, three crystal pendulums across it
  const G0 = A0 + 12 + 1.2;
  K.slab(-3.2, G0 - 1.6, 3.2, G0 + 0.6, 9, 0.8);
  add(Jaw, { id: 'd2', still: 'j3', at: [0, 9, G0 - 0.7], w: 5.2, h: 6.4, seed: 1, wrong: MOUTH_WRONG,
    stilled: 'The gate’s great crystal rings true, last and highest, and the jaws stop dead, frosted, and ease open. They forget to close.' });
  // (its crown, the biggest of the three: over the gate, on the passage's side)
  K.both(M.trim, box(1.4, 0.3, 0.8, 0, 15.95, G0 - 1.5));
  spike(0, 16.1, G0 - 1.5, 1.8, 0.45, 0, 0.4);
  K.hall({ x: 0, z: G0 + 17.2, w: 22, d: 34.4, y: -3, h: 28, floor: false, roof: true, doors: [{ side: 's', w: 5.4, h: 6.6, y0: 12 }, { side: 'n', w: 5.4, h: 6.6, y0: 12 }, { side: 'w', at: NURSERY.z - (G0 + 17.2), w: 5, h: 6.4, y0: 12 }] });   // (and west into the Nursery, v1.52)
  K.slab(-11, G0, 11, G0 + 6, 9, 12);
  K.slab(-11, G0 + 26, 11, G0 + 34.4, 9, 12);
  K.both(M.floor, box(3, 1, 20.4, 0, 8.5, G0 + 16));        // the bridge
  K.add(M.trim, box(3.3, 0.25, 20.4, 0, 7.9, G0 + 16));
  K.both(M.dark, box(22, 1, 20, 0, -3.5, G0 + 16));
  add(Pit, { room: 'gallery', min: [-12, -6, G0 + 6], max: [12, 4, G0 + 26] });
  // their notes: smallest crystal lowest; they hang middle-sized, biggest, smallest (so the walk across stills
  // them out of turn: from the far side, still them again in turn)
  const SW = [['w2', G0 + 10, 0.85], ['w3', G0 + 16, 1.15], ['w1', G0 + 22, 0.6]];
  const flat = 'Its crystal stops, but its note rings flat. The makers sang from low to high: the smallest crystal first.';
  for (const [i, [id, z, size]] of SW.entries()) {
    K.add(M.trim, box(22, 0.8, 1.2, 0, 21.6, z));            // the beam it hangs from
    add(Swing, { id, at: [0, 21, z], len: 10, amp: 0.95, period: 2.6 + i * 0.3, phase: i * 0.31, size, wrong: flat, heard: 'The stilled crystal’s note rings true, and a lamp wakes over the far door.' });
  }
  // the keeper's ledge along the east wall, back from the far landing to a gate by the near one; the gate opens once
  // the Nursery is won (v1.52), then stays open (a shortcut back, toward the ledge round the Bog Well)
  K.slab(8.8, G0 + 6, 11, G0 + 26, 9, 0.8);
  K.add(M.trim, box(0.25, 0.3, 20, 8.9, 9.05, G0 + 16));
  for (let i = 0; i < 4; i++) K.both(M.trim, box(0.5, 1.8, 0.5, 9.1, 7.3, G0 + 9 + i * 5.2));   // (corbels under it)
  K.both(M.wall, box(0.6, 5.2, 0.9, 8.5, 11.6, G0 + 6.6));       // the gate's post on the chasm side
  add(Door, { id: 'ds', at: [10, 9, G0 + 6.6], w: 2.2, h: 4.4, lamps: [{ lit: 'arN' }] });
  add(Mark, { room: 'gallery', at: [-7, 9, G0 + 3], yaw: 0 });
  add(Mark, { room: 'galleryFar', at: [7, 9, G0 + 31], yaw: Math.PI });
  add(Door, { id: 'd3', at: [0, 9, G0 + 34.9], w: 5.2, h: 6.4, lamps: [{ lit: 'w1' }, { lit: 'w2' }, { lit: 'w3' }] });

  // (and west off the far landing, the Nursery's doorway, v1.52)
  // ---- the corridor, and the Mother's Hall (floor 9): a round hall, the Mother rooted in its middle
  const H0 = G0 + 35;
  const AE = K.vestibule(H0, 9);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, 9, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = 19, CL = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CL, y: 9, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.25 });
  // her bed: a ring of dark soil and moss round her root, and the crystals of the dome over her
  K.both(M.floor, T(new THREE.CylinderGeometry(6.5, 7, 0.3, 32), [0, 9.12, CL + 3]));
  K.both(M.trim, T(annulus(6.5, 7.2, 0.4, 36), [0, 9.2, CL + 3]));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3; spike(Math.sin(a) * (HR - 1.6), 9, CL + Math.cos(a) * (HR - 1.6), 5 + (i % 3) * 2, 0.9, Math.cos(a) * 0.25, a); }
  add(Door, { id: 'd5', at: [0, 9, CL + HR + 0.7], w: 5, h: 6, frame: { side: 1.2 } });   // (frame: the rotunda's gap is wider than the door, issue #356)
  K.slab(-3.2, CL + HR + 0.6, 3.2, CL + HR + 10, 9, 0.8);
  K.wall(-3.2, CL + HR + 1.4, -3.2, CL + HR + 10, 9, 7, { t: 0.8 }); K.wall(3.2, CL + HR + 10, 3.2, CL + HR + 1.4, 9, 7, { t: 0.8 });
  K.wall(3.2, CL + HR + 10, -3.2, CL + HR + 10, 9, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 16.4, CL + HR + 5.7));
  K.both(M.voidM, box(3.4, 5, 0.9, 0, 11.5, CL + HR + 10.35));

  // three crystal pendulums high over her, out of order round the hall (by size: rank 0 the smallest): stilled
  // in turn, smallest first, they calm her (motherCrystal). Hung well over your head: they knock nobody down
  rt.motherCrystals = { next: 0, list: [] };
  for (const [rank, x, z, size, yaw, i] of [[1, -12.5, CL - 1, 0.85, 0.1, 0], [2, 9, CL - 9.5, 1.15, 0.8, 1], [0, 10.5, CL + 8.5, 0.6, -0.7, 2]]) {
    K.add(M.trim, box(2.4, 0.5, 0.6, x, 30.3, z));
    rt.motherCrystals.list.push(add(Swing, { at: [x, 30, z], len: 12, amp: 0.38, period: 3.0 + i * 0.35, phase: i * 0.27, size, yaw, rank, onStill: (sw) => motherCrystal(rt, sw) }));
  }

  const model = snapperModel({ reach: 12 });
  model.pos.copy(K.world(0, 9, CL + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = model.pos.clone();
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 9, CL), r: HR, y: K.world(0, 9, 0).y };

  // (the wings last: their marks after the others, so the machines' ids by mark stay as they were)
  wings(rt, K, M, { C2, A0, G0, spike, root });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-32, -10, -3), V(24, 40, CL + HR + 12)),
    gadget: { at: W(0, 9.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 9.5, CL + HR + 9.6), r: 1.5 }],
    lights: [[0, 5, 6, 10], [0, 6, 28, 14], [0, 4, C2, 11], [0, 13, C3, 10], [0, 14, G0 + 16, 13], [NURSERY.x, 13, NURSERY.z, 11], [0, 12.5, BALCONY.groove, 10], [0, 15, CL, 18]],
    guardian: { def: { ...MOTHER, onHit: motherHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Hush-House on the cave island
function exterior(scene, level, rt) {
  const g0 = level.ground.heightAt(SITE.x, SITE.z), yaw = SITE.heading, R = 15;
  const base = g0 - 1.2;
  const K = new TempleKit(rt.root, 'The Hush-House', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, sill = 1.8;
  const crystalM = makeMaterial({ color: PALETTE.glow, glow: 0.5, flat: true, key: 'temple.lorn.spire' });
  // a ring plinth, a low dome of violet stone, ribs over it, an oculus ring at the top
  K.both(M.floor, new THREE.CylinderGeometry(R + 3, R + 4, sill, 36).translate(0, sill / 2, 0));
  K.both(M.wall, new THREE.SphereGeometry(R, 32, 12, 0, TAU, 0, Math.PI / 2).scale(1, 0.78, 1).translate(0, sill, 0));   // (as drawn: a cone stand-in lay a metre inside it, src/contact-audit.js)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + TAU / 16;
    const pts = []; for (let k = 0; k <= 8; k++) { const e = (k / 8) * (Math.PI / 2 - 0.2); pts.push(V(Math.sin(a) * Math.cos(e) * (R + 0.35), sill + Math.sin(e) * R * 0.78 + 0.3, Math.cos(a) * Math.cos(e) * (R + 0.35))); }
    K.both(M.trim, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.45, 6, false));   // (drawn proud of the dome: solid)
  }
  K.both(M.trim, T(annulus(R * 0.18, R * 0.3, 0.8, 28), [0, sill + R * 0.78 - 0.1, 0]));
  K.add(crystalM, T(new THREE.OctahedronGeometry(1, 0), [0, sill + R * 0.78 + 3.2, 0], [0, 0.3, 0], [1.8, 4.2, 1.8]));
  // the swamp's crystals grow up through it and round it
  for (const [a, d, h, r, tilt] of [[0.9, R * 0.75, 22, 2.2, 0.15], [2.1, R * 0.55, 28, 2.6, -0.1], [3.4, R + 2, 16, 1.7, 0.25], [4.3, R * 0.7, 24, 2.3, -0.2], [5.4, R + 1.5, 12, 1.4, 0.3]])
    K.both(crystalM, T(new THREE.ConeGeometry(r, h, 5).translate(0, h / 2, 0), [Math.sin(a) * d, 0, Math.cos(a) * d], [tilt * Math.cos(a), a, tilt * Math.sin(a)]));   // (as drawn)
  // the doorway, a porch of stone out of the dome toward the channel, the Hush over it
  const z0 = R - 2.5, z1 = R + 3.2;
  for (const s of [-1, 1]) K.both(M.wall, box(3.2, 8, z1 - z0, s * 3.8, sill + 4, (z0 + z1) / 2));
  K.both(M.wall, box(10.8, 2.2, z1 - z0, 0, sill + 7.1, (z0 + z1) / 2));
  K.both({ paint: new THREE.Color(PALETTE.accent), smooth: false, side: THREE.FrontSide }, box(11.4, 0.8, 1.2, 0, sill + 8.4, z1 + 0.1));
  K.both(M.wall, box(7, 3.6, z1 - z0, 0, sill + 10.6, (z0 + z1) / 2));
  K.add(M.glyph, T(glyphGeometry(2.6, 0.15), [0, sill + 10.6, z1 + 0.06]));
  K.both(M.voidM, box(4.3, 6, 0.9, 0, sill + 3, R - 0.35));   // (drawn and solid as one: the dark of the doorway, back to the dome's shell)
  // steps down from the porch to the island's moss
  K.both(M.floor, box(6.4, sill * 0.5, 2, 0, sill * 0.25, z1 + 1));
  K.flush();
  const at = K.world(0, sill, R + 1.2);
  return { door: { at, heading: yaw }, kit: K, base, R, sill, crystalM, top: base + sill + R + 8, clear: [{ x: SITE.x, z: SITE.z, r: R + 9 }] };
}

// ------------------------------------------------------------------ the world change: the swamp flowers
/**
 * Once the Mother sleeps the house is in tune again, and the swamp answers it: the dome flowers all over
 * (vines and pale bells, glowing at dusk), and every snapping plant on Lorn has a ring of the same flowers
 * round its foot. The crown crystal on the dome burns bright.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The Hush-House in flower (the world change)';
  rt.root.add(root);
  root.visible = false;
  const petalM = makeMaterial({ color: '#eef2ff', glow: 0.35, flat: true, key: 'temple.lorn.petal' });
  const bellM = makeMaterial({ color: '#9fc6f0', glow: 0.4, flat: true, key: 'temple.lorn.bell' });
  const vineM = makeMaterial({ color: '#4c7d5c', flat: true, key: 'temple.lorn.vine' });
  /** A flower: five petals round a point, flat. */
  const flower = (s = 1) => {
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push(new THREE.SphereGeometry(1, 6, 4).scale(0.22 * s, 0.05 * s, 0.12 * s).translate(0.2 * s, 0, 0).rotateY((i / 5) * TAU).toNonIndexed());
    return mergeGeometries(parts);
  };
  let s = 4242;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // the dome's vines, in flower, and pale bells round its plinth (the porch side left clear)
  if (O) {
    const K = new TempleKit(root, 'The Hush-House’s flowers', V(SITE.x, O.base, SITE.z), SITE.heading, rt.M);
    const clear = (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4;
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * TAU + rnd() * 0.25, pts = [];
      if (clear(a0)) continue;
      for (let k = 0; k <= 7; k++) { const e = (k / 7) * 1.25, a = a0 + Math.sin(k * 1.3 + i) * 0.1; pts.push(V(Math.sin(a) * Math.cos(e) * (O.R + 0.3), O.sill + Math.sin(e) * O.R * 0.78 + 0.3, Math.cos(a) * Math.cos(e) * (O.R + 0.3))); }
      K.add(vineM, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.16, 4, false));
      for (let k = 1; k < pts.length; k++) for (let j = 0; j < 2; j++) K.add(petalM, flower(1.5 + rnd()).translate(pts[k].x + (rnd() - 0.5) * 1.2, pts[k].y + 0.12, pts[k].z + (rnd() - 0.5) * 1.2));
    }
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU + rnd() * 0.08, d = O.R + 3.8 + rnd() * 2.4;
      if (clear(a)) continue;
      const x = Math.sin(a) * d, z = Math.cos(a) * d, y = O.sill * 0.55;
      K.add(vineM, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 3).translate(x, y + 0.75, z));
      K.add(bellM, new THREE.ConeGeometry(0.55, 0.8, 6, 1, true).rotateX(Math.PI).translate(x, y + 1.55, z));
    }
    K.flush();
  }
  // a ring of flowers round the foot of every snapping plant on Lorn
  const plants = level.plants ?? [];
  const ring = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, d = 1.3 + (i % 3) * 0.55; ring.push(flower(2.6 + (i % 2) * 0.8).translate(Math.sin(a) * d, 0.2, Math.cos(a) * d)); }
  const foot = plants.length ? new THREE.InstancedMesh(mergeGeometries(ring), petalM, plants.length) : null;
  if (foot) {
    foot.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    foot.userData.noCollide = true; foot.userData.dynamic = true;
    foot.frustumCulled = false;
    foot.visible = false;
    scene.add(foot);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), _y = V(0, 1, 0);
  const placeFoot = (k) => {
    if (!foot) return;
    for (const [i, p] of plants.entries()) { _q.setFromAxisAngle(_y, i * 1.7); _m.compose(p.base, _q, _s.setScalar(Math.max(1e-4, k))); foot.setMatrixAt(i, _m); }
    foot.instanceMatrix.needsUpdate = true;
  };
  const crown = O ? V(SITE.x, O.base + O.sill + O.R * 0.78 + 3, SITE.z) : null;
  const light = new THREE.Vector4(0, -1e5, 0, 0);
  rt.lights.push(light);
  let k = 0, want = 0;
  const apply = () => {
    const on = k > 0.01;
    root.visible = on;
    if (foot) { foot.visible = on; placeFoot(k); }
    root.scale.setScalar(1);
  };
  apply();
  return {
    root, foot,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 5 : -dt / 2), 0, 1); apply(); }
      if (O) O.crystalM.uniforms.uGlow.value = 0.5 + 0.45 * k * (0.85 + 0.15 * Math.sin(t * 1.4));
      if (crown && k > 0.02) light.set(crown.x, crown.y, crown.z, 45 * k); else light.set(0, -1e5, 0, 0);
      if (k > 0.01) petalM.uniforms.uGlow.value = 0.3 + 0.25 * Math.max(0, Math.sin(t * 0.9));
    },
  };
}

export const PERDIDE_TEMPLE = {
  id: 'perdide', levelId: 'perdide', name: 'The Hush-House', doorLabel: 'door of the Hush-House',
  gadget: 'stun', gadgetBox: 'perdide.temple.stun', arenaDoor: 'd3', arenas: ARENAS,
  origin: [-100, 1700, 300], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'teasel', out: 9, side: 6 },
  enterLine: 'Inside the Hush-House it is green and cool, and the crystals hum, each its own note. Somewhere ahead, something snaps.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out on the swamp, at the foot of every snapping plant, flowers open.', 'resolved.out'); },
};
