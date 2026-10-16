import { landmark, LANDMARK_SCALE } from './landmarks.js';
import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, sector } from './kit.js';
import { Door, Plate, Ball, Platform, Bridge, BellEar, HookBell, Switch, Mark, Pit, Key } from './pieces.js';
import { whaleModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';
import { foundersBelfrySkin } from './skins/founders-belfry.js';

// Vael II's temple: the Founders' Belfry, a tower of bone-white stone that
// rises straight out of the cloud beside the starting plateau, a bridge from
// the plateau's west rim to its door. The monks say the founders built it
// before the monastery, to keep the stones down: a bell in every room, and the
// stones stayed where they were put. The bells stopped; the stones fell up.
// Something swims in the top of the tower, and cries.
//
// Inside (built far overhead, through its door). The temple's one idea: a founders' bell holds things only
// while it rings; a stone's weight holds them for good. Since v1.77 (issue #336, docs/design/temple-redesign.md) its rooms
// are shrines: every hall 36 m across (or a round hall 34) under 18 m of stone or more, doors 7 by 9 (ROOMS, DOOR), each
// puzzle in the middle of its own room, the one fight in a room of its own, the upper house on a floor 8 m up (UP).
//   the Threshold          the first mark, the way out
//   the Hall of Stones     a hub (a passage): the door on has a lamp and a keyhole, and two archways open off the hall,
//                          west and east, into the two stone stores. The west store is the house's one fight (v1.49,
//                          issue #23): an arena, its archway shut behind you while its keepers stand round its middle,
//                          and won, the small key's cage sinks; in the middle of the east one a ball, a plate at its
//                          groove's end: roll it home (the push). The key and the ball, in your own order, and the door
//                          sinks.
//   the Stone Stair        a round well whose stair fell up: one great stone hangs at the top of it, by the landing and
//                          the high door. In the middle of the floor hangs a founders' bell with no clapper, and a stone
//                          ball lies in a groove that runs into its mouth: roll the ball in and it strikes the bell
//                          (a splash on it as it lies there strikes again). While the bell rings the great stone
//                          comes down to the floor; when it falls quiet the stone falls up again, and whoever
//                          stands on it goes up with it (the house's own bell, taught before the hook: what
//                          the bell holds, it holds only while it rings). The high door's eye is on the
//                          landing's face, under your feet once you are up: splash it on the way
//   the Bell Chamber       the makers' chest: the GRAPPLING HOOK (src/gadgets/hook.js; issue #377: the bell-note whistle
//                          was here, a charm, and went to Vael's makers' court). Its north door sinks for the hook in
//                          your hand. The clapperless bell in the oculus hangs a brass pull-ring (HookBell) out of any
//                          reach: hook it and the bell booms, three stones that fell up come down round the dais while it
//                          rings, and fall up again (a try where nothing is locked)
//   the Bell Porch         a room on: the door into the Hall of Echoes is held by the porch's own bell, hung in the
//                          middle of the room, open only while it rings (about eight seconds). Hook its ring, walk
//                          through; too slow, hook it again (the hook's first lock, where failing costs nothing)
//   the Hall of Echoes     a chasm across its middle, the stones of its bridge hanging high over it (they fell up), and
//                          a bell hung over the chasm's east side: hooked from the near lip it brings the stones down
//                          only while it rings, ten seconds, enough to run across. But the
//                          far door wants a ball on its plate too, and the ball waits at the near edge in a
//                          groove that runs over the bridge: ring, then roll the ball across while the
//                          stones are down (it stops at the lip while they hang, and drops if they rise
//                          under it). On its plate on the far lip its weight holds the stones down for good.
//                          Half-way over, a spur of the same stones runs off the bridge to a doorway in the west wall,
//                          and no ball holds it: ring, and run (since issue #23's last round)
//   the Ringers' Walk      through that doorway: a long passage back south outside the house, the ringers' way, and up
//                          a stair to a ledge high in the Stone Stair, over the landing. On it, the house's great key,
//                          seen from the stair at the start and out of reach from there, the founders' bell in sight
//                          below it: hook its ring from the ledge, and while it booms the cage sinks. Drop onto the
//                          landing, and climb the house again with the hook: the porch's bell, the stones held for
//                          good, the far door's bell over its lintel (it takes the great key). A ring through both
//                          halves of the house
//   the Cloud-Mother's Hall the guardian (organic: you calm her). She swims high and fearful, gusts and dives; four
//                          founders' bells hang round her hall, a pull-ring under each: each time she cries, low, her
//                          mouth open, hook the bell near her. Stones that fell
//                          up hang under the dome: a ring as she rises to dive brings one down where she will
//                          dive, held only while the note sounds, and she dives onto it and lies on it, crying
//                          (taught in her second phase; in her last she no longer sinks to cry by herself, so
//                          the stone is the way to her). Worn out, she lies down: lay a hand on her brow
// After: the stones that fell up come down, all over Vael II (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** Out of the cloud west of the starting plateau; its door looks east, to a bridge from the plateau's rim. */
export const SITE = { x: -128, z: -6, r: 18, rim: [-86, -6] };
SITE.heading = Math.PI / 2;   // (the door faces +x, the plateau)

/**
 * The belfry's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/founders-belfry):
 * bone-white stone in big smooth blocks, warm bone floors, the founders' bells in old bronze (BRONZE), little bronze bells
 * in niches under every frieze, the glyphs carved and bronze; its shade a warm rose-lavender over the white (Vael II's
 * sky prints its shade flat in grey-blue, and turned the tower blue with it), its light warm.
 */
export const PALETTE = {
  wall: '#f2e9dc', wall2: '#ece2d2', wall3: '#f7f0e6', floor: '#ece0cc', floor2: '#ded1bb', trim: '#f7f0e6', fitting: '#a8874a',
  dark: '#4a3a4c', stone: '#efe6d8', accent: '#d99072', glow: '#a8e6ee', glyph: '#a8874a', lamp: '#f6c84e', sand: '#e8dfcb', sand2: '#d9c7aa',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.85, shade: 0.45, spot: 0.4 },
    wall: { mode: 0, grid: 3.6, plates: true },
    glyph: { glow: 0.12 },
  },
  bands: [{ at: 0.72, h: 0.7, color: '#e6d8c4' }],
  ornament: { kind: 'bell', color: '#a8874a', color2: '#e6c690', metal: 'brass' },
  light: { shadow: '#d4bccb', light: '#fff4e6', sun: '#ffe8c8' },
};
/** The founders' bronze: the bells, old and warm, a little green. */
const BRONZE = () => makeMaterial({ color: '#9c7c46', flat: true, metal: 'brass', refl: 0.35, key: 'temple.arzach2.bronze' });

/**
 * The house's doors (m: issue #336, 4 to 5 by 5.5 to 6.6 before), the upper house's floor (the landing, the Bell
 * Chamber, the porch, the Hall of Echoes and her hall: 16 before; 8 now, so the Ringers' Walk's ledge stands 16 m over
 * the Stone Stair's floor and 8 over its landing, the founders' bell in sight below it), and the rooms in the kit's
 * local frame (z into the house): each hall's floor from wall to wall, its floor's height and its ceiling's; the round
 * halls' middles and radii. The Hall of Echoes' chasm runs from `lip` to `far` (m from its south wall).
 */
export const DOOR = { w: 7, h: 9 };
export const UP = 8;
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 14, y: 0, top: 12 },
  stones: { x0: -18, x1: 18, z0: 15.2, z1: 51.2, y: 0, top: 18 },
  storeW: { x0: -49.2, x1: -19.2, z0: 15.2, z1: 51.2, y: 0, top: 18 },
  storeE: { x0: 19.2, x1: 49.2, z0: 15.2, z1: 51.2, y: 0, top: 18 },
  stair: { x: 0, z: 72.4, r: 17, y: 0, top: 28 },
  bell: { x: 0, z: 110.8, r: 17, y: UP, top: UP + 18 },
  porch: { x0: -18, x1: 18, z0: 132.8, z1: 160.8, y: UP, top: UP + 18 },
  echoes: { x0: -18, x1: 18, z0: 165.6, z1: 215.6, y: UP - 10, top: UP + 18, lip: 13.8, far: 34 },
  hall: { x: 0, z: 245.8, r: 21, y: UP, top: UP + 26 },
};

export const LOGIC = {
  id: 'arzach2', entry: 'threshold', gadget: 'hook',
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a fight;
  // src/foes.js places machines only in a fight's room: scripts/temple-design/rules.mjs, tests/temple-rules.test.js. The
  // Bell Chamber holds the hook and its try; the Bell Porch past its open way is a room of its own since v1.77)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, stones: { checkpoint: true, kind: 'passage' }, storeW: { kind: 'combat' }, storeE: { kind: 'puzzle' },
    stair: { checkpoint: true, kind: 'puzzle' }, landing: { kind: 'passage' }, bell: { checkpoint: true, kind: 'puzzle' }, porch: { checkpoint: true, kind: 'puzzle' },
    echoes: { checkpoint: true, kind: 'puzzle' }, echoesFar: { kind: 'puzzle' }, ringers: { checkpoint: true, kind: 'passage' },
    ante: { checkpoint: true, kind: 'passage' }, hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'stones' },
    { a: 'stones', b: 'storeW', door: 'dSW' },      // (open: it shuts behind you while its keepers stand)
    { a: 'stones', b: 'storeE' },
    { a: 'stones', b: 'stair', door: 'd1' },
    { a: 'stair', b: 'landing', door: 'lift' },     // the great stone: rung down, it falls up again with you on it
    { a: 'landing', b: 'bell', door: 'd2' },
    { a: 'bell', b: 'porch', door: 'dP' },          // the chamber's north door: it sinks for the hook in your hand
    { a: 'porch', b: 'echoes', door: 'd3' },        // the Bell Porch's held door, a room on from the chest
    // (issue #23's last round: a ring through both halves. Off the bridge's middle a spur of stones the bell alone holds, to
    // the Ringers' Walk back south and up to a ledge high in the Stone Stair, the great key's, a drop over the landing)
    { a: 'echoes', b: 'ringers', door: 'spur' },
    { a: 'ringers', b: 'landing', oneWay: true },
    { a: 'echoes', b: 'echoesFar', door: 'br1' },
    { a: 'echoesFar', b: 'ante', door: 'd4' },
    { a: 'ante', b: 'hall' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the west store, an arena since v1.49: its keepers beaten among the stones brought back down, the small key's cage sinks
    arW: { type: 'arena', room: 'storeW' },
    kW: { type: 'key', kind: 'small', room: 'storeW', when: { lit: 'arW' } },
    dSW: { type: 'door', opens: null },
    p2: { type: 'plate', room: 'storeE' },
    ball2: { type: 'drum', room: 'storeE', plate: 'p2', plateAt: 1, start: 0 },
    d1: { type: 'door', lock: 'small', opens: { drumOn: ['ball2', 'p2'] }, latch: true },   // (the ball's weight: you alone are not enough)
    // the Stone Stair: the ball rolled into the founders' bell's mouth strikes it; while it rings the great stone is down
    ballS: { type: 'drum', room: 'stair', plate: 'pS', plateAt: 1, start: 0 },
    pS: { type: 'plate', room: 'stair' },
    e0: { type: 'bell', room: 'stair', hold: 12, when: { drumOn: ['ballS', 'pS'] } },
    lift: { type: 'door', opens: { lit: 'e0' }, latch: true },
    s1: { type: 'switch', room: 'stair' },
    d2: { type: 'door', opens: { lit: 's1' }, latch: true },
    // (issue #377: the chest held the bell-note whistle, a charm that finds chests; the hook rings the founders' bells by
    // their pull-rings now, HookBell, and the whistle waits in Vael's makers' court)
    chest: { type: 'gadget', room: 'bell', item: 'hook' },
    dP: { type: 'door', opens: { item: 'hook' }, latch: true },
    // the chamber's own bell in the oculus: stones come down round the dais while it rings (nothing is locked by it)
    eT: { type: 'bell', room: 'bell', needs: ['hook'], hold: 6 },
    heap: { type: 'bridge', opens: { lit: 'eT' } },
    e1: { type: 'bell', room: 'porch', needs: ['hook'], hold: 8 },   // the porch's bell, in the middle of the porch
    d3: { type: 'door', opens: { lit: 'e1' } },
    e2: { type: 'bell', room: 'echoes', needs: ['hook'], hold: 10 },   // the bell hung over the chasm's east side
    // the spur off the bridge's middle to the Ringers' Walk: held by the bell alone (no ball holds it). At the walk's end,
    // on the ledge high in the Stone Stair, the great key in a tall cage (seen from the stair's floor at the start) that
    // sinks only while the founders' bell far below rings: the ball still in its mouth, its ring hooked from the ledge
    spur: { type: 'bridge', opens: { lit: 'e2' } },
    kB: { type: 'key', kind: 'big', room: 'ringers', when: { lit: 'e0' } },
    ball3: { type: 'drum', room: 'echoes', plate: 'p3', plateAt: 1, start: 0 },
    p3: { type: 'plate', room: 'echoes' },   // (on the far lip, in the same hall as its ball: nothing rolled through a door)
    br1: { type: 'bridge', opens: { any: [{ lit: 'e2' }, { drumOn: ['ball3', 'p3'] }] } },
    e3: { type: 'bell', room: 'echoesFar', needs: ['hook'] },   // the bell beside the far door
    d4: { type: 'door', lock: 'big', opens: { all: [{ drumOn: ['ball3', 'p3'] }, { lit: 'e3' }] }, latch: true },
    mother: { type: 'boss', room: 'hall', needs: ['gun', 'hook'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

/** The west store's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arW', room: 'storeW', zone: { min: [ROOMS.storeW.x0, -1, ROOMS.storeW.z0], max: [ROOMS.storeW.x1, 10, ROOMS.storeW.z1] }, doors: ['dSW'], extra: 2,
  shut: 'The archway grinds shut behind you. Among the stones brought back down, something gets up.',
  won: 'The last of them falls among the stones. The key’s cage sinks, and the archway lets go.',
}];

/**
 * (issue #377) The Hall of Echoes' bell (local: over the chasm's east side, by the bridge's middle, its mouth's height) and the
 * Cloud-Mother's four, [x, 0, z] from her hall's middle, high round its wall between the columns.
 */
export const BELL2 = [10, UP + 8, ROOMS.echoes.z0 + 24];
export const HALL_BELLS = [[12, 0, 12], [-12, 0, 12], [-12, 0, -12], [12, 0, -12]];

/** The held notes: how long the founders' bells hold their door and their stones (s). */
export const HOLD = { door: LOGIC.elements.e1.hold, stones: LOGIC.elements.e2.hold, stair: LOGIC.elements.e0.hold, chamber: LOGIC.elements.eT.hold };
/**
 * The Ringers' Walk (issue #23's last round, local m): its doorway in the Hall of Echoes' west wall half-way over (z, the
 * spur's), the walk's middle (x) and half its width, its doorways' width and height; its floor at UP to its stair
 * (`stairs`: foot and head, z), then RING.y to its south end, where it turns east through the Stone Stair's west wall onto
 * a ledge round its north-west wall at RING.y (`ledge`: radii, rotunda angles; a parapet along it but over the landing,
 * `drop`), the great key on it by its edge (`key`: angle, radius; `cage` its cage's height, seen over the ledge's edge from
 * the stair's floor, sunk only while the founders' bell in the middle of the stair's floor rings, its pull-ring hooked
 * from the ledge: `hear` its ear's reach). The founders' bell (`bell`: angle, radius) stands straight in from the key, in sight
 * of it and under 20 m from it (issue #336: the temple design audit's cage at 1.0, out of sight two rooms off); the
 * landing (`landing`: its face's radius, its angles) under the ledge's drop; the Stone Stair `stairH` high.
 */
export const RING = {
  z: ROOMS.echoes.z0 + 24, x: -23.1, half: 3, w: 6, door: 8, y: 16, stairH: ROOMS.stair.top, stairs: [112.4, 94.4], south: ROOMS.stair.z - 5.4,
  ledge: { r0: 13, r1: 17.4, a0: -Math.PI / 2 - 0.3, a1: -0.3 }, drop: -0.9, key: { a: -0.5, r: 14.3 }, cage: 3.2, hear: 28,
  bell: { a: -0.5, r: 5 }, landing: { r: 9.8, a0: -1.02, a1: 0.75 }, lift: { a: 0.35 },
};
/** How long the Cloud-Mother lies on a held stone she dived onto, crying (s): a bell rung near her calms her then. */
export const GROUNDED = 4.5;

export const MOTHER = {
  kind: 'organic', name: 'the Cloud-Mother', final: 'touch', touch: 'lay a hand on her brow',
  speed: 3.2, wakeTime: 3.4,
  wake: 'A sky-whale turns over at the top of the tower. She is afraid of you.',
  openHint: 'She sinks low and cries. Hook the bell nearest her.',
  missHint: 'Her dive went wide: she lies caught, crying. Hook the bell nearest her.',
  weary: 'She settles on the floor of her hall, listening. Go to her.',
  resolved: 'She sighs, and the cloud along her back thins away.',
  phases: [
    { to: 0.5, attacks: ['gust', 'dive', 'wail'], pause: 1.8, hint: 'When she cries, hook the ring of the bell nearest her.' },
    { to: 0.7, attacks: ['roll', 'dive', 'gust'], pause: 1.4, hint: 'Hook a bell as she rises to dive: a stone drops where she dives.',
      // (v1.63, #257: a second verb before the gadget, src/temples/boss.js asks)
      asks: { verb: 'parry', moves: ['roll'], open: 3.6, perfect: 4.6,
        hint: 'Guard her wing as it rolls at you: jarred, she sinks and cries.',
        said: 'Her wing rings off your guard. She sinks low, crying: hook a bell.',
        lines: ['She rolls her wing at you.', 'Raise your guard as her wing rolls in: jarred, she sinks and cries.', 'When she tips onto one wing, hold the guard (LB / L1) toward her, then hook the bell nearest her ({key:aim}, {key:fire}).'] } },
    { to: 0.9, attacks: ['dive', 'rain', 'roll'], pause: 1.2, hint: 'Hook a bell as she rises: a stone drops under her. Again as she cries.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    gust: { shape: 'cone', range: 14, angle: 0.55, wind: 1.3, track: 0.6, part: 'mouth', rig: 'swell', blast: { kind: 'front', r0: 3, h: 2.5 }, damage: 0.75, knock: 12, recover: 0.9 },
    // (a dive that misses you wedges her on the floor a while longer: missHint. In her last phase only a held stone
    // opens her, missed or not: motherOpen)
    dive: { shape: 'ring', at: 'player', radius: 4.6, wind: 1.6, track: 0.55, over: true, part: 'core', rig: 'rise', parts: ['body'], splash: 0.5, active: 0.45, damage: 1, knock: 9, recover: 1.0, open: 3.0, miss: 4.4 },
    wail: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'mouth', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 11, recover: 0.8, open: 2.6 },
    roll: { shape: 'cone', range: 10, angle: 1.0, wind: 1.2, track: 0.6, part: 'wings', rig: 'coil', side: 1, blast: { kind: 'front', r0: 3, h: 1.6 }, gap: 0.65, damage: 0.75, knock: 11, recover: 0.6, then: 'tail' },
    tail: { shape: 'ring', at: 'self', radius: 7, wind: 0.75, part: 'tail', rig: 'coil', side: -1, link: true, blast: { kind: 'front', r0: 3, h: 1.4 }, damage: 0.5, knock: 9, gap: 0.25, then: 'wailEnd' },
    wailEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'mouth', rig: 'swell', pose: 'wail', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 0.75, knock: 11, recover: 0.8, open: 2.6 },
    rain: { shape: 'ring', at: 'player', lob: true, volley: 4, radius: 2, wind: 1.5, track: 0.6, part: 'core', rig: 'swell', damage: 0.5, knock: 6, recover: 0.6, then: 'diveEnd' },
    diveEnd: { shape: 'ring', at: 'player', radius: 4.6, wind: 1.3, track: 0.55, over: true, part: 'core', rig: 'rise', pose: 'dive', link: true, parts: ['body'], splash: 0.5, active: 0.45, damage: 1, knock: 9, recover: 1.0, open: 3.0, miss: 4.4 },
  },
};

/** The fluid does not calm her (it only frightens her), nor the hook on her: a bell does (motherBell). */
function motherHit(g, part, mode, info) {
  const rt = g.rt;
  if (info?.mode === 'hook') { rt.notice('She shies from the hook, crying louder. Hook a bell, not her.', 'mother.hook'); return true; }
  if (mode === 'push') { g.add(-0.05, 'push'); rt.notice('She shies from the shove, crying louder. Gently.', 'mother.push'); return true; }
  if (g.state === 'open') rt.notice('The fluid only frightens her. She wants a sound: a bell.', 'mother.fluid');
  else rt.notice('She flinches from the splash.', 'mother.splash');
  return true;
}
/**
 * A founders' bell rung (its ring hooked: HookBell, issue #377; the bell-note whistle before). Rung near her while she
 * cries: an eighth (then a tenth) of her calm. Rung as she rises to dive (a dive's wind-up): a stone that fell up comes
 * down where she will dive, held while the note sounds.
 */
export function motherBell(g, pos) {
  if (!pos || !g.awake) return;
  const rt = g.rt, a = g.attack;
  if (g.state === 'fight' && a?.over && !g.struck && rt.hallStones) {
    if (rt.hallStones.drop(g, a)) rt.notice('The note brings a hanging stone down under her, and holds it there.', 'mother.stone');
    return;
  }
  if (g.state !== 'open') {
    rt.notice(g.phaseIndex >= 2 ? 'She hears the note, and rises out of its reach.' : 'She hears the note, and turns her head. Sound it when she cries.', g.phaseIndex >= 2 ? 'mother.wait2' : 'mother.wait');
    return;
  }
  if (pos.distanceTo(g.model.pos) > 28) { rt.notice('That bell is too far from her. Hook the one nearest her.', 'mother.far'); return; }
  g.add((g.phaseIndex === 0 ? 0.125 : 0.1) * (g.gasp ? MOTHER_GASP.bell : 1), 'bell');
  if (g.state === 'open') { g.enter('fight'); g.cool = 2.2; }
}
/** A dive struck: onto a stone the bell holds under her, it takes her weight, and she lies on it. */
function motherStrike(g, a) {
  if (!a.over) return;
  const s = g.rt.hallStones?.landed(g, a);
  if (!s) return;
  g.grounded = true;
  g.rt.rumble?.(1.0, 0.5);
  g.rt.notice('She dives onto the held stone and lies on it, dazed, crying.', 'mother.grounded');
}
/**
 * Her last phase off a held stone (v1.70, issue #319: "an opening after every move", and her last phase had none but the
 * stone): her cry is a gasp of `open` s, and a note then calms her `bell` of a full ring; on a held stone she lies a while
 * (GROUNDED) and a note calms her fully.
 */
export const MOTHER_GASP = { open: 1.6, bell: 0.3 };
/** How long a combo's end leaves her open: on a held stone, a while; in her last phase off one, a gasp. */
function motherOpen(g, a, s) {
  if (g.grounded) { g.grounded = false; g.gasp = false; return Math.max(s, GROUNDED); }
  g.gasp = g.phaseIndex >= 2 && !!s;
  if (g.gasp) { g.rt.notice('She cries a moment, and rises again, out of the bell’s reach.', 'mother.rises'); return Math.min(s, MOTHER_GASP.open); }
  return s;
}

/**
 * The stones that fell up into the Cloud-Mother's hall, hanging under its dome. A ring of the bell as she rises to
 * dive brings the nearest one down onto the spot she has picked (it follows the spot until she strikes) and holds it
 * there while the note sounds (HOLD.stones); then it falls up again. Calm, she lets them down for good.
 */
class HallStones {
  /**
   * o: { id, y: her hall's floor, at: [[x, z]], hang: [[height over the floor, r]] } (local). (Its id is her element's, the
   * guardian's own pieces: the redesign's rules measure her hall by them, scripts/temple-design/rules.mjs.)
   */
  constructor(rt, o) {
    this.rt = rt; this.hold = o.hold ?? HOLD.stones;
    this.floorY = rt.kit.world(0, o.y, 0).y;
    this.mat = makeMaterial({ color: PALETTE.stone, glow: 0.05, flat: true, key: 'temple.arzach2.hallstones' });
    this.list = o.at.map(([x, z], i) => {
      const [h, r] = o.hang[i], y = o.y + h;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.7, 1), this.mat);
      const home = rt.kit.world(x, y, z);
      m.position.copy(home); m.rotation.set(i, i * 2, 0);
      m.userData.noCollide = true; m.userData.dynamic = true;
      rt.root.add(m);
      return { m, home, r, i, to: home.clone(), held: 0, k: 0, g: null, a: null };
    });
    rt.hallStones = this;
  }
  /** A ring as guardian g winds up dive a: the nearest stone still hanging comes down where it will strike. */
  drop(g, a) {
    if (this.list.some((s) => s.a === a && s.held > 0)) return null;
    const free = this.list.filter((s) => s.held <= 0).sort((p, q) => p.home.distanceToSquared(g.attackAt) - q.home.distanceToSquared(g.attackAt))[0];
    if (!free) return null;
    Object.assign(free, { held: this.hold, g, a });
    free.to.set(g.attackAt.x, this.floorY + free.r * 0.6, g.attackAt.z);
    this.rt.sound?.chime?.();
    return free;
  }
  /** Dive a has struck: the stone brought down for it, if the note still holds it (it lands at once under her). */
  landed(g, a) {
    const s = this.list.find((q) => q.a === a && q.held > 0) ?? null;
    if (s) { s.to.set(g.attackAt.x, this.floorY + s.r * 0.6, g.attackAt.z); s.k = 1; }
    for (const q of this.list) if (q.a === a) q.a = null;
    return s;
  }
  /** Knocked out: the note is gone, they all fall up again. */
  reset() { for (const s of this.list) { s.held = 0; s.a = null; } }
  update(dt, t) {
    const calm = this.rt.logic.resolved;
    let held = 0;
    for (const s of this.list) {
      s.held = Math.max(0, s.held - dt);
      // while she winds up, the falling stone follows the spot she has picked
      if (s.held > 0 && s.a && s.g?.attack === s.a && !s.g.struck) s.to.set(s.g.attackAt.x, this.floorY + s.r * 0.6, s.g.attackAt.z);
      if (calm) s.to.set(s.home.x, this.floorY + s.r * 0.6, s.home.z);
      const down = calm || s.held > 0;
      s.k = down ? Math.min(1, s.k + dt / (calm ? 4 : 0.35)) : Math.max(0, s.k - dt / 2.5);
      const bob = (1 - s.k) * Math.sin(t * 0.5 + s.i * 2.1) * 0.6;
      s.m.position.lerpVectors(s.home, s.to, s.k * s.k).y += bob;
      if (s.held > 0) held++;
    }
    this.mat.uniforms.uGlow.value = held ? 0.4 + 0.15 * Math.sin(t * 9) : 0.05;
  }
}

/**
 * The Stone Stair's great stone, one of the stones that fell up: it hangs at the top of the well, level with the
 * landing, and comes down to the floor only while its condition holds (`held`: the founders' bell ringing); when it
 * falls quiet the stone falls up again, carrying whoever stands on it (a moving floor, as a riding disc is).
 * o: { path: [[bottom], [top]], r, held: condition, down (m/s coming down), up (m/s falling up) }
 */
export class FallUpStone extends Platform {
  constructor(rt, o) {
    super(rt, { ...o, phase: 1 });
    // a rough stone, not a disc: an eight-sided slab with a worn top, the glyph faint on its underside
    this.group.clear();
    const th = this.thick, r = this.r;
    const g = new THREE.CylinderGeometry(r, r * 0.8, th, 8).translate(0, -th / 2, 0);
    const m = new THREE.Mesh(g, rt.M.stoneMat);
    const under = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.75, 1).scale(1, 0.35, 1).translate(0, -th - 0.1, 0), rt.M.stoneMat);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.86, 0.06, 4, 32).rotateX(Math.PI / 2).translate(0, -th * 0.5, 0), this.glow);
    for (const q of [m, under, rim]) { q.userData.noCollide = true; q.userData.dynamic = true; this.group.add(q); }
    this.s = this.rt.logic.check(o.held) ? 0 : this.total;
    this.place(0);
  }
  update(dt, t) {
    const down = this.rt.logic.check(this.o.held), want = down ? 0 : this.total;
    this.glow.uniforms.uGlow.value = down ? 0.6 + 0.25 * Math.sin(t * 9) : 0.12;
    if (Math.abs(want - this.s) < 1e-3) { this.solid.vel.set(0, 0, 0); return; }
    const sp = (down ? this.o.down ?? 3.2 : this.o.up ?? 1.7) * (0.35 + 0.65 * Math.min(1, Math.abs(want - this.s) / 2));
    this.s += Math.sign(want - this.s) * Math.min(Math.abs(want - this.s), sp * dt);
    this.place(dt);
    const P = this.rt.player;
    if (P && this.solid.vel.y < 0 && !P.climbing && Math.hypot(P.pos.x - this.solid.pos.x, P.pos.z - this.solid.pos.z) < this.r && Math.abs(P.pos.y - this.solid.top) < 0.4 && P.vel.y <= 0.5) P.vel.y = Math.min(P.vel.y, this.solid.vel.y);
  }
}

// ------------------------------------------------------------------ inside
// (issue #336: every hall 36 m across (the stores 30 by 36, the round halls 34 and 42 across) under 18 m of stone or more,
// doors 7 by 9 m, each puzzle in the middle of its room; the props at a body's scale as they were (the balls, the bells, the
// plates, the great stone, the chests, the eye) and the chasm and every groove as long as they were, so every timing holds)
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR, R0 = ROOMS;
  const add = (P, o) => rt.add(P, o);
  const stone = (x, y, z, r, i) => K.both(M.stone, T(new THREE.IcosahedronGeometry(r, 1), [x, y, z], [i, i * 2, 0], [1, 0.7, 1]));
  const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
  const hall = (r, o = {}) => { const [x, z] = mid(r); return K.hall({ x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, y: r.y, h: r.top - r.y, roof: 'oculus', ...o }); };
  /** A point of a round hall R: rotunda angle a (0 north, -π/2 west), radius r, height y. */
  const round = (R, a, r, y = R.y) => [R.x + Math.sin(a) * r, y, R.z + Math.cos(a) * r];
  // a dark line inlaid in the floor from a to b ([x, z]) at y
  const inlay = (a, b, w, y, mat = M.dark) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    K.add(mat, T(new THREE.BoxGeometry(w, 0.04, L), [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], [0, yaw, 0]));
    return { L, yaw, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  };
  // a ball's groove on the floor at y: a dark channel between two trim lips
  const groove = (a, b, y = 0) => {
    const { L, yaw, c } = inlay(a, b, 1.0, y + 0.02);
    for (const sd of [-1, 1]) K.both(M.trim, T(new THREE.BoxGeometry(0.25, 0.12, L), [c[0] + Math.cos(yaw) * sd * 0.75, y + 0.06, c[1] - Math.sin(yaw) * sd * 0.75], [0, yaw, 0]));
  };
  /** A founders' bell, clapperless, its crown at `top` over its mouth at y; hung from `from` (the ceiling). */
  const bellShape = (s) => lathe([[0.02, 0], [1.4 * s, 0.1 * s], [1.5 * s, 0.8 * s], [1.05 * s, 2.4 * s], [0.85 * s, 3.4 * s], [0.02, 3.6 * s]], 24);
  // (in the house's futuristic skin, a stack of floating bronze rings round a dark core, held by nothing: skins/founders-belfry.js)
  const hang = (x, y, z, s, from, ear, face = 0) => {
    if (rt.skin?.bell?.([x, y, z], s, ear, face)) return;
    K.add(BRONZE(), T(bellShape(s), [x, y, z]));
    const top = y + 3.6 * s;
    if (from > top) K.add(M.trim, box(0.2, from - top + 0.4, 0.2, x, (from + top) / 2, z));
  };

  // ---- the Threshold (z 0..14): the way back out behind you
  const TH = R0.threshold;
  hall(TH, { oculus: 0.3, doors: [{ side: 's', w: 6, h: 8 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(6, 8).translate(0, 4, 0), [0, 0, -1.25]));
  K.solid(box(6.4, 8, 0.5, 0, 4, -1.4));
  K.glyph([0, 9.4, 0.05], 1.8, 0);
  add(Mark, { room: 'threshold', at: [-5, 0, 6.5], yaw: Math.PI / 2 });
  // the wall between the Threshold and the taller hall beyond, with the archway through it
  K.wall(-18.6, 14.6, 18.6, 14.6, 0, R0.stones.top, { t: 1.2, holes: [{ at: 18.6, w: 8, h: 10 }] });

  // ---- the Hall of Stones (a hub, a passage): the door on in its north wall has a lamp and a keyhole; two archways, west
  // and east, open into the stone stores (out of sight of the door: you go and find them)
  const ST = R0.stones, [, stz] = mid(ST), AZ = stz - 5.2;   // (the archways' middle)
  hall(ST, { oculus: 0.25, columns: 3, omit: ['s'], doors: [{ side: 'n', w: D.w, h: D.h }, { side: 'w', at: AZ - stz, w: D.w, h: D.h }, { side: 'e', at: AZ - stz, w: D.w, h: D.h }] });
  add(Door, { id: 'd1', at: [0, 0, ST.z1 + 0.6], w: D.w, h: D.h, lamps: [{ drumOn: ['ball2', 'p2'] }] });   // (and a keyhole: logic `lock`)
  add(Mark, { room: 'stones', at: [-8, 0, 19], yaw: Math.PI / 2 });
  // stones that once fell up, heaped in the corners where somebody brought them back down
  [[-15, 0.8, 48.2, 1.2], [-13.4, 0.6, 46.4, 0.9], [15.2, 0.8, 18.6, 1.1], [13.8, 1.7, 19.6, 0.8]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i));
  // a dark line inlaid from each archway to the door's foot: the two lamps' two ways
  for (const sx of [-1, 1]) inlay([sx * (ST.x1 - 0.8), AZ], [sx * 2.6, ST.z1 - 1], 0.5, 0.02);

  // ---- the stone stores, off the hall's sides. The west one is the house's fight (an arena since v1.49: its archway shuts
  // behind you while its keepers stand round its middle; the small key at its far end); in the middle of the east one a
  // groove, a ball and a plate
  const SW = R0.storeW, [swx, swz] = mid(SW);
  hall(SW, { oculus: 0.3, omit: ['e'], frieze: false });
  add(Door, { id: 'dSW', at: [ST.x0 - 0.6, 0, AZ], yaw: Math.PI / 2, w: D.w, h: D.h });
  add(Key, { id: 'kW', at: [SW.x0 + 5, 0, swz], yaw: Math.PI / 2 });
  K.glyph([SW.x0 + 0.05, 6.2, swz + 5], 1.8, Math.PI / 2);
  // (the stones brought back down: round the walls, the floor's middle clear for the fight)
  [[-46, 0.8, 18.8, 1.1], [-44.6, 0.6, 20.6, 0.8], [-23.4, 0.8, 48.4, 1.2], [-46, 0.9, 48, 1.3], [-32, 0.7, 18.6, 0.9]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i + 4));
  for (const [x, z] of [[swx - 8, swz - 8], [swx + 8, swz + 8]]) K.column(x, z, 0, SW.top, 0.9);   // (two to fight round)
  const SE = R0.storeE, [sex, sez] = mid(SE), G2 = [sex - 5.2, sex + 5.2];
  hall(SE, { oculus: 0.3, omit: ['w'], frieze: false });
  groove([G2[0], sez], [G2[1], sez]);
  add(Ball, { id: 'ball2', a: [G2[0], 0.04, sez], b: [G2[1], 0.04, sez], r: 1.3 });
  add(Plate, { id: 'p2', at: [G2[1], 0, sez], r: 1.5 });
  K.glyph([SE.x1 - 0.05, 6.2, sez - 5], 1.8, -Math.PI / 2);
  [[45.6, 0.8, 47.6, 1.2], [44, 0.6, 48.6, 0.8], [46, 0.7, 18.8, 0.9]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i + 9));

  // ---- the corridor and the Stone Stair (a round well whose stair fell up: one great stone hangs at the top, by the
  // landing and the high door; a founders' bell in the middle of the floor, and a ball in a groove into its mouth)
  const S2 = R0.stair, C2 = S2.z;
  K.corridor([0, ST.z1 + 1.2], [0, C2 - S2.r - 0.6], 0, { w: D.w, h: D.h });
  // (a ledge round its north-west wall at RING.y, the Ringers' Walk's end, through a doorway in its west wall)
  K.rotunda({ x: 0, z: C2, y: 0, r: S2.r, h: S2.top, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h, y0: UP + 0.2 }, { a: -Math.PI / 2, w: RING.w, h: RING.door, y0: RING.y }], oculus: 0.15 });
  const rotA = (a) => Math.PI / 2 - a, LD = RING.landing;
  // the landing, by the high door: a block of stone round the north wall, its face toward the middle
  K.both(M.floor, T(sector(LD.r, S2.r + 0.4, rotA(LD.a1), rotA(LD.a0), UP - 0.1), [0, UP - 0.1, C2]));
  K.both(M.trim, T(sector(LD.r - 0.1, S2.r + 0.4, rotA(LD.a1), rotA(LD.a0), 0.3), [0, UP + 0.2, C2]));
  // the great stone: down while the bell rings, up again (with you) when it falls quiet
  const LS = round(S2, RING.lift.a, LD.r - 2.2);
  add(FallUpStone, { id: 'lift', path: [[LS[0], 0.3, LS[2]], [LS[0], UP + 0.25, LS[2]]], r: 2.2, held: { lit: 'e0' }, down: 3.2, up: 1.7 });
  K.both(M.dark, T(new THREE.CylinderGeometry(2.4, 2.6, 0.08, 8), [LS[0], 0.04, LS[2]]));   // where it comes to rest
  // the founders' bell in the middle of the floor, with no clapper: the ball's groove runs into its mouth from the west,
  // across the line from the key's ledge to the bell (in sight of each other, issue #336)
  const [BX, , BZ] = round(S2, RING.bell.a, RING.bell.r), tx = Math.cos(RING.bell.a), tz = -Math.sin(RING.bell.a), GL = 5.2;
  const GA = [BX - tx * GL, BZ - tz * GL], gyaw = Math.atan2(tx, tz);
  hang(BX, 2.5, BZ, 1, S2.top, 'e0', Math.PI);   // (from the vault: the oculus is small, over the middle)
  if (!rt.skin?.bell) K.add(M.trim, T(new THREE.TorusGeometry(1.48, 0.08, 4, 28).rotateX(Math.PI / 2), [BX, 2.6, BZ]));
  K.add(M.dark, box(1.0, 0.04, GL + 0.6, BX - tx * (GL + 0.6) / 2, 0.02, BZ - tz * (GL + 0.6) / 2, gyaw));
  for (const sd of [-1, 1]) K.both(M.trim, box(0.25, 0.12, GL - 0.8, BX - tx * (GL + 0.8) / 2 + tz * sd * 0.75, 0.06, BZ - tz * (GL + 0.8) / 2 - tx * sd * 0.75, gyaw));
  add(Ball, { id: 'ballS', a: [GA[0], 0.04, GA[1]], b: [BX, 0.04, BZ], r: 1.0, strike: { at: [BX, 3.4, BZ] } });
  add(Plate, { id: 'pS', at: [BX, 0, BZ], r: 1.2 });
  // (and once the ball lies in its mouth, its pull-ring on its crown rings it too, hooked from anywhere in the stair: the
  // Ringers' Walk's ledge high over it as well, where the great key's cage sinks only while it rings. Its ear at its crown)
  add(HookBell, { id: 'hb.e0', at: [BX, 6.9, BZ], chain: 0.3, yaw: Math.atan2(BX, BZ - C2) });   // (facing out, toward the key's ledge)
  add(BellEar, { id: 'e0', at: [BX, 6.4, BZ], reach: RING.hear, struck: true, heard: 'The founders’ bell booms, and high over the well the great stone comes down to the floor. It stays only while the bell sounds.', heardKey: 'e0.heard', fading: 'The bell’s hum is fading: the great stone stirs.' });

  add(Mark, { room: 'stair', at: [8.5, 0, C2 - 9.5], yaw: -Math.PI * 0.7 });
  // the high door, and its eye on the landing's face: under your feet once you are up, seen on the way
  add(Door, { id: 'd2', at: [0, UP + 0.2, C2 + S2.r + 0.7], w: D.w, h: D.h, lamps: [{ lit: 's1' }] });
  const EY = round(S2, -0.05, LD.r - 0.1, UP - 3);
  add(Switch, { id: 's1', at: EY, yaw: Math.PI - 0.05, size: 1.0 });

  // ---- the corridor and the Bell Chamber (floor UP): the chest; its north door sinks for the hook in hand
  const S3 = R0.bell, C3 = S3.z;
  K.corridor([0, C2 + S2.r + 1.4], [0, C3 - S3.r - 0.6], UP, { w: D.w, h: D.h });
  K.rotunda({ x: 0, z: C3, y: UP, r: S3.r, h: S3.top - UP, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.35 });
  // (in the futuristic skin a hexagonal slate pedestal with lit panels, drawn over the same collider)
  const [moundD, moundS] = chestMound(0, UP, C3);
  if (!rt.skin?.pedestal?.(moundD, moundS)) K.both(M.trim, moundD, moundS);   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  // a bell hangs high in the oculus, without a clapper, its pull-ring out of any reach: the hook rings it, and three stones
  // that fell up come down round the dais while it sounds (a try: nothing is locked by it)
  hang(0, UP + 12, C3, 1, S3.top + 4, 'eT', Math.PI);   // (up through the oculus)
  add(HookBell, { id: 'hb.eT', at: [0, UP + 11.1, C3], chain: 0.4, yaw: Math.PI });
  add(BellEar, { id: 'eT', at: [0, UP + 12, C3], reach: 16, struck: true, heard: 'The bell in the oculus booms as the hook tugs it, and three of the stones that fell up come down round the dais. They stay only while it sounds.', heardKey: 'eT.heard', fading: 'The hum is fading: the stones tremble.' });
  add(Bridge, { id: 'heap', a: [-6.4, UP + 0.6, C3 - 3.2], b: [-6.4, UP + 0.6, C3 + 3.2], w: 2.4, n: 3, from: 'above' });
  for (let i = 0; i < 6; i++) { const a = Math.PI * (0.3 + i * 0.28); K.glyph(round(S3, a, S3.r - 0.05, UP + 6), 1.6, a + Math.PI); }
  add(Mark, { room: 'bell', at: [6.5, UP, C3 - 9], yaw: -Math.PI * 0.75 });
  add(Door, { id: 'dP', at: [0, UP, C3 + S3.r + 0.7], w: D.w, h: D.h, lamps: [{ item: 'hook' }] });   // (the hook in hand)

  // ---- the Bell Porch (floor UP), a room on: the door into the Hall of Echoes is held by the porch's own bell, hung in
  // the middle of the room
  const PO = R0.porch, [, poz] = mid(PO);
  K.corridor([0, C3 + S3.r + 0.6], [0, PO.z0 - 1.2], UP, { w: D.w, h: D.h });
  hall(PO, { oculus: 0.3, columns: 2, doors: [{ side: 's', w: D.w, h: D.h }, { side: 'n', w: D.w, h: D.h }] });
  hang(0, UP + 6.6, poz, 0.8, PO.top + 4, 'e1', Math.PI);
  add(HookBell, { id: 'hb.e1', at: [0, UP + 5.7, poz], chain: 0.4, yaw: Math.PI });
  add(BellEar, { id: 'e1', at: [0, UP + 7, poz], reach: 8.5, struck: true, heard: 'The porch’s bell booms as the hook tugs it, and the door sinks. It stands open only while the bell sounds.', heardKey: 'e1.heard', fading: 'The bell’s hum is fading. The door will rise again.' });
  add(Mark, { room: 'porch', at: [-6, UP, PO.z0 + 5], yaw: Math.PI / 2 });
  add(Door, { id: 'd3', at: [0, UP, PO.z1 + 0.6], w: D.w, h: D.h, bell: true, lamps: [{ lit: 'e1' }] });

  // ---- the Hall of Echoes: a chasm across its middle under a bridge of stones that fell up
  const EC = R0.echoes, [, ecz] = mid(EC), E0 = EC.z0, LIP = E0 + EC.lip, FAR = E0 + EC.far;
  K.corridor([0, PO.z1 + 1.2], [0, E0 - 1.2], UP, { w: D.w, h: D.h });
  hall(EC, { floor: false, oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h, y0: UP - EC.y }, { side: 'n', w: D.w, h: D.h, y0: UP - EC.y }, { side: 'w', at: RING.z - ecz, w: RING.w, h: RING.door, y0: UP - EC.y }] });
  K.slab(EC.x0, E0, EC.x1, LIP, UP, UP - EC.y);
  K.slab(EC.x0, FAR, EC.x1, EC.z1, UP, UP - EC.y);
  K.both(M.dark, box(EC.x1 - EC.x0, 1, FAR - LIP, 0, EC.y - 0.5, (LIP + FAR) / 2));
  add(Pit, { room: 'echoes', min: [EC.x0 - 1, EC.y - 4, LIP], max: [EC.x1 + 1, UP - 3.5, FAR] });
  // the stones come down while the bell rings, and fall up again when it stops; a ball's weight on the far
  // plate holds them down for good. The ball's groove runs from the near edge over the bridge to that plate.
  add(Bridge, { id: 'br1', a: [0, UP, LIP - 0.1], b: [0, UP, FAR + 0.1], w: 6, n: 8, from: 'above' });
  // the spur off its middle, west to the Ringers' Walk's doorway: the same stones, held by the bell alone
  add(Bridge, { id: 'spur', a: [-3.05, UP, RING.z], b: [EC.x0 + 0.05, UP, RING.z], w: RING.w - 0.4, n: 5, from: 'above' });
  // the hall's bell, hung over the chasm's east side by the bridge's middle: hooked from either lip or the bridge
  hang(BELL2[0], BELL2[1], BELL2[2], 0.9, EC.top + 4, 'e2', Math.PI);
  add(HookBell, { id: 'hb.e2', at: [BELL2[0], BELL2[1] - 0.9, BELL2[2]], chain: 0.4, yaw: -Math.PI / 2 });
  add(BellEar, { id: 'e2', at: [0, UP, E0 + 11.9], reach: 32, struck: true, heard: 'The hanging stones answer the note and come down into a bridge. They stay only while it sounds.', heardKey: 'e2.heard', fading: 'The note is fading: the stones begin to tremble.' });
  const BA = [1.6, UP + 0.04, E0 + 10.5], BB = [1.6, UP + 0.04, E0 + 38.2], BL = BB[2] - BA[2];
  add(Ball, { id: 'ball3', a: BA, b: BB, r: 1.0, friction: 0.2, lock: true, gap: { bridge: 'br1', from: (LIP - 0.1 - BA[2]) / BL, to: (FAR + 0.1 - BA[2]) / BL } });
  add(Plate, { id: 'p3', at: [1.6, UP, BB[2]], r: 1.2 });
  for (const [z0, z1] of [[BA[2] - 1.2, LIP - 0.1], [FAR + 0.1, BB[2]]]) {
    K.add(M.dark, box(1.0, 0.04, z1 - z0, 1.6, UP + 0.02, (z0 + z1) / 2));
    for (const sd of [-1, 1]) K.both(M.trim, box(0.25, 0.12, z1 - z0, 1.6 + sd * 0.75, UP + 0.06, (z0 + z1) / 2));
  }
  add(Door, { id: 'd4', at: [0, UP, EC.z1 + 0.6], w: D.w, h: D.h, bell: true, lamps: [{ drumOn: ['ball3', 'p3'] }, { lit: 'e3' }] });
  // the far door's own bell, hung beside it over the far landing
  hang(-6, UP + 6.4, EC.z1 - 2.2, 0.6, EC.top + 4, 'e3', Math.PI);
  add(HookBell, { id: 'hb.e3', at: [-6, UP + 5.7, EC.z1 - 2.2], chain: 0.3, yaw: Math.PI });
  add(BellEar, { id: 'e3', at: [-1.8, UP, E0 + 39.4], reach: 14, struck: true });
  add(Mark, { room: 'echoes', at: [-3.6, UP, E0 + 4.5], yaw: Math.PI / 2 });
  for (let i = 0; i < 4; i++) K.glyph([EC.x0 + 0.05, UP + 6 + (i % 2) * 2.4, LIP + 1.5 + i * 5.6], 1.6, Math.PI / 2);
  for (const z of [E0 + 6, EC.z1 - 6]) for (const x of [EC.x0 + 6, EC.x1 - 6]) K.column(x, z, UP, EC.top - UP, 0.9);

  ringersWalk(rt, K, M, C2);

  // ---- the antechamber, and the Cloud-Mother's hall (a great rotunda, open to the sky)
  const HA = R0.hall, CH = HA.z, HR = HA.r;
  K.corridor([0, EC.z1 + 1.2], [0, CH - HR - 0.6], UP, { w: D.w, h: D.h });
  add(Mark, { room: 'ante', at: [D.w / 2 - 0.6, UP, (EC.z1 + CH - HR) / 2], yaw: -Math.PI / 2 });
  K.rotunda({ x: 0, z: CH, y: UP, r: HR, h: HA.top - UP, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.5 });
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; K.column(Math.sin(a) * (HR - 2.2), CH + Math.cos(a) * (HR - 2.2), UP, HA.top - UP, 0.9); }
  add(Door, { id: 'd5', at: [0, UP, CH + HR + 0.7], w: D.w, h: D.h });
  // the way out behind her hall: a passage to the dark doorway
  const O0 = CH + HR + 1.4, O1 = O0 + 9;
  K.corridor([0, O0], [0, O1], UP, { w: D.w, h: D.h });
  K.wall(4.6, O1 + 0.4, -4.6, O1 + 0.4, UP, D.h, { t: 0.8, holes: [{ at: 4.6, w: 5, h: 7 }] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(5, 7).translate(0, 3.5, 0), [0, UP, O1 + 0.9]));
  K.solid(box(5.4, 7, 0.5, 0, UP + 3.5, O1 + 1.3));

  // her hall's four bells, high round its wall between the columns, a pull-ring under each: hooked near her, they calm her
  for (const [x, , z] of HALL_BELLS) {
    hang(x, UP + 10.5, CH + z, 0.8, HA.top + 4, 'mother', Math.PI);
    add(HookBell, { id: `hb.hall.${x > 0 ? 'e' : 'w'}${z > 0 ? 'n' : 's'}`, at: [x, UP + 9.6, CH + z], chain: 0.4, yaw: Math.atan2(-x, -z) });
  }
  // stones that fell up, hanging under the dome: a ring as she rises to dive brings one down (HallStones)
  add(HallStones, { id: 'mother', y: UP, at: [[-9, CH - 4], [8, CH + 3], [-2, CH + 10], [6, CH - 9]], hang: [[17, 1.5], [19, 1.7], [21, 1.4], [18, 1.3]] });

  const model = whaleModel();
  model.pos.copy(K.world(0, UP, CH + 6));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(-4, UP, CH + 4);
  model.restHeading = K.heading(Math.PI * 0.85);
  const arena = { center: K.world(0, UP, CH), r: HR, y: K.world(0, UP, 0).y };

  // (the west store's mark last but one: after the others, so the machines' ids by mark stay as they were; its keepers
  // round the store's middle)
  add(Mark, { room: 'storeW', at: [SW.x1 - 4, 0, SW.z0 + 5], yaw: -Math.PI * 0.75, foes: [swx, 0, swz] });
  // (and the Ringers' Walk's: at its end, in its doorway onto the ledge, the great key and the founders' bell below it in sight)
  const RX = -(ROOMS.stair.r + 1.6);
  add(Mark, { room: 'ringers', at: [RX, RING.y, C2 - 1.8], yaw: Math.PI / 2 });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-52, -8, -3), V(52, 40, O1 + 3)),
    gadget: { at: W(0, UP + 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, UP + 0.5, O1 - 0.4), r: 1.5 }],
    lights: [[0, 6, 7, 16], [0, 9, 22, 24], [0, 9, 44, 24], [swx, 8, swz, 24], [sex, 8, sez, 24], [0, 10, C2 - 6, 22], [0, 12, C2 + 8, 20], [-6, RING.y + 5, C2 + 9, 14],
      [0, UP + 9, C3, 22], [0, UP + 9, poz, 24], [0, UP + 9, E0 + 10, 24], [0, UP + 9, E0 + 30, 24], [0, UP + 9, EC.z1 - 6, 20],
      [RING.x, UP + 5, RING.z - 12, 16], [RING.x, UP + 5, RING.z - 40, 16], [RING.x, UP + 5, RING.z - 68, 16], [RING.x, RING.y + 5, RING.stairs[1] - 2, 16], [RING.x, RING.y + 5, RING.south + 6, 14],
      [0, UP + 5, (EC.z1 + CH - HR) / 2, 10], [0, UP + 14, CH, 32]],
    guardian: { def: { ...MOTHER, onHit: motherHit, onStrike: motherStrike, openFor: motherOpen, onReset: (g) => { g.grounded = false; rt.hallStones?.reset(); } }, model, arena },
  };
}

/**
 * The Ringers' Walk: off the Hall of Echoes through its west wall half-way over (the spur of stones the bell alone holds),
 * back south outside the house past the porch and the Bell Chamber, up a stair, and east through the Stone Stair's west
 * wall onto a ledge round its north-west wall high over the landing: the great key's, seen from the stair below at the start.
 * A parapet along the ledge but where the landing is under it: the drop down onto it.
 */
function ringersWalk(rt, K, M, C2) {
  const { x: X, half, w, y: Y, z: Z, south: S, door: DH } = RING, [s0, s1] = RING.stairs, R = ROOMS.stair.r;
  const xe = X + half + 0.4, xw = X - half - 0.4, fx0 = xw - 0.4, fx1 = xe + 0.4, low = UP, lowTop = UP + DH + 1.5, highTop = Y + DH + 1.5;
  const hallIn = ROOMS.echoes.x0 + 0.02;   // (the sill 2 cm proud of the hall's wall: no face in another's plane)
  // the doorway's sill through the hall's west wall, and the walk's floors and stair
  // (the floors end inside the walls)
  K.slab(xe, Z - w / 2 - 0.2, hallIn, Z + w / 2 + 0.2, low, 0.8);
  K.slab(xw, s0, xe, Z + w / 2 + 1.2, low, 0.8);
  K.stairs([X, low, s0], [X, Y, s1], 2 * half, { sides: false });
  K.slab(xw, S, xe, s1, Y, 0.8);
  // its walls: low over the floor at UP, high over the stair and the upper floor; the gable between the two roofs
  const zN = Z + w / 2 + 1.2, wt = { t: 0.8 };
  K.wall(xw, s0, xw, zN, low - 0.8, lowTop - low + 0.8, wt);
  K.wall(xw, S - 0.4, xw, s0, low - 0.8, highTop - low + 0.8, wt);
  K.wall(xe, zN, xe, s0, low - 0.8, lowTop - low + 0.8, { ...wt, holes: [{ at: zN - Z, w, y0: 0.8, h: DH }] });
  K.wall(xe, s0, xe, S - 0.4, low - 0.8, highTop - low + 0.8, { ...wt, holes: [{ at: s0 - C2, w, y0: Y - low + 0.8, h: DH }] });
  K.wall(fx0, zN, fx1, zN, low - 0.8, lowTop - low + 0.8, wt);
  K.wall(fx1, S - 0.4, fx0, S - 0.4, Y - 0.8, highTop - Y + 0.8, wt);
  K.wall(fx0 + 0.4, s0, fx1 - 0.4, s0, lowTop, highTop - lowTop, wt);
  K.both(M.wall, box(fx1 - fx0, 0.8, zN - s0, X, lowTop + 0.42, (zN + s0) / 2));
  K.both(M.wall, box(fx1 - fx0, 0.8, s0 - S + 0.4, X, highTop + 0.42, (s0 + S - 0.4) / 2));
  // the way east into the Stone Stair, through its west wall at Y (its walls end inside the round wall)
  const pz = w / 2 + 0.7, inWall = -Math.sqrt((R + 0.7) ** 2 - pz * pz);
  K.slab(-RING.ledge.r1, C2 - w / 2 - 0.2, xe, C2 + w / 2 + 0.2, Y, 0.8);
  K.wall(xe, C2 - pz, inWall, C2 - pz, Y, DH + 0.6, { ...wt, cap: false });
  K.wall(inWall, C2 + pz, xe, C2 + pz, Y, DH + 0.6, { ...wt, cap: false });
  K.both(M.wall, box(inWall - xe + 0.4, 0.8, 2 * pz + 0.8, (xe + inWall) / 2, Y + DH + 0.62 + 0.4, C2));
  // the ledge round the stair's north-west wall, and its parapet but over the landing (the drop down onto it)
  const rotA = (a) => Math.PI / 2 - a, Lg = RING.ledge;
  K.both(M.floor, T(sector(Lg.r0, Lg.r1, rotA(Lg.a1), rotA(Lg.a0), 0.7), [0, Y, C2]));
  K.both(M.trim, T(sector(Lg.r0 - 0.02, Lg.r0 + 0.35, rotA(RING.drop), rotA(Lg.a0), 1.05), [0, Y + 1.0, C2]));
  K.add(M.trim, T(sector(Lg.r0 - 0.05, Lg.r0 + 0.3, rotA(Lg.a1), rotA(RING.drop), 0.2), [0, Y + 0.12, C2]));   // (a lip where it drops)
  // the great key on it by its edge, over the landing: the founders' bell straight below it, in sight
  const ka = RING.key.a, kr = RING.key.r;
  rt.add(Key, { id: 'kB', big: true, cageH: RING.cage, at: [Math.sin(ka) * kr, Y, C2 + Math.cos(ka) * kr], yaw: Math.atan2(Math.cos(ka), -Math.sin(ka)) });
}

// ------------------------------------------------------------------ outside: the Founders' Belfry over the cloud
function exterior(scene, level, rt) {
  const yaw = SITE.heading, base = -70, door = 40.3;
  const K = new TempleKit(rt.root, 'The Founders’ Belfry', V(SITE.x, 0, SITE.z), yaw, rt.M);
  const M = rt.M, R = 15;
  const rose = { paint: new THREE.Color(PALETTE.accent), smooth: true };
  landmark(K, 'arzach2', { y: door, R, bottom: base });
  // Keep the gallery and the arrival bridge on the same walking plane.
  K.both(M.floor, T(annulus(R - 0.5, R + 5, 1.2), [0, door + .04, 0]));
  const B0 = door + 37;
  // the portico and the dark doorway on the gallery, toward the plateau
  const z0 = R - 0.6, z1 = R + 3.2;
  for (const s of [-1, 1]) K.both(M.wall, box(3.6, 11, z1 - z0, s * 4, door + 5.5, (z0 + z1) / 2));
  K.both(M.wall, box(4.4, 4, z1 - z0, 0, door + 9, (z0 + z1) / 2));
  K.add(rose, box(12, 1.2, 1.2, 0, door + 11.6, z1 + 0.1));
  K.glyph([0, door + 9.4, z1 + 0.05], 2.6, 0);
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.3, 7).translate(0, 3.5, 0), [0, door, R + 0.2]));
  K.solid(box(4.4, 7, 0.6, 0, door + 3.5, R - 0.2));
  // the bridge from the plateau's rim to the gallery (the rim is a little lower than the door)
  const rimL = K.local(V(SITE.rim[0], 0, SITE.rim[1]));
  const rimY = level.topAt?.(SITE.rim[0], SITE.rim[1]) ?? 40;
  K.bridge([0, door, R + 4.9], [0, rimY, rimL.z], 4.6, { parapet: 1.0 });
  for (const zz of [R + 12, R + 20]) K.both(M.wall, T(new THREE.CylinderGeometry(1.2, 2.2, door - base, 10), [0, (door + base) / 2 - 0.6, zz]));
  // stones that fell up, hanging round the belfry (they come down when the Cloud-Mother is calm)
  const hang = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.4, r = R + 9 + (i % 3) * 4, g = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + (i % 3) * 0.6, 1).scale(1, 0.7, 1), makeMaterial({ color: PALETTE.stone, flat: true }));
    g.position.copy(K.world(Math.sin(a) * r, B0 + 6 + (i % 4) * 5, Math.cos(a) * r));
    g.userData.noCollide = true; g.userData.dynamic = true;
    rt.root.add(g);
    hang.push({ g, y: g.position.y, i, rest: K.world(Math.sin(a) * (R + 3.4), door + 1.2 + (i % 2) * 0.5, Math.cos(a) * (R + 3.4)) });
  }
  // the founders' lamp (level design audit v1.49, issue #133: from Calix by the monastery's bell the walk to this door had
  // nothing to steer by): the dome's finial carried on as a bronze needle with a glass lamp on it, over the monastery's
  // roofs from the foot of its bell tower; cold until the bell rings, then lit (src/story/arzach2.js)
  const F0 = door + 77 * LANDMARK_SCALE.arzach2[1], bronze = BRONZE();
  K.add(bronze, new THREE.CylinderGeometry(0.28, 0.5, 9.4, 8).translate(-19.8, F0 + 4.5, 0));
  for (const y of [2.5, 5.5]) K.add(bronze, T(new THREE.TorusGeometry(0.62, 0.1, 4, 14), [-19.8, F0 + y, 0], [Math.PI / 2, 0, 0]));
  K.add(bronze, new THREE.CylinderGeometry(1.2, 0.6, 0.5, 10).translate(-19.8, F0 + 9.3, 0));
  K.add(bronze, new THREE.ConeGeometry(0.9, 2.6, 10).translate(-19.8, F0 + 12.9, 0));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.4; K.add(bronze, box(0.14, 2.2, 0.14, -19.8 + Math.sin(a) * 1.05, F0 + 10.6, Math.cos(a) * 1.05)); }
  const lampGeo = new THREE.SphereGeometry(1.0, 14, 10).scale(1, 1.2, 1).translate(0, 0, 0);
  const lampAt = K.world(-19.8, F0 + 10.6, 0);
  const cold = new THREE.Mesh(lampGeo, makeMaterial({ color: '#8a7a62', flat: true, key: 'temple.arzach2.lamp.cold' }));
  const warm = new THREE.Mesh(lampGeo, makeMaterial({ color: '#ffd9a0', glow: 1, key: 'temple.arzach2.lamp.lit' }));
  for (const m of [cold, warm]) { m.position.copy(lampAt); m.userData.noCollide = true; m.userData.dynamic = true; m.name = 'The founders’ lamp'; rt.root.add(m); }
  warm.visible = false;
  const lamp = { at: lampAt, top: K.world(-19.8, F0 + 14.2, 0), height: 14.2, lit: (on) => { warm.visible = !!on; cold.visible = !on; }, isLit: () => warm.visible };
  // Banks of cloud lap against the plinth, below the bridge's walking plane.
  // They leave the doorway and the complete bridge visible from its approach.
  const cloudM=makeMaterial({color:'#fff4eb',shadeFlat:.75,shade:.15,line:.3,lineTint:1,hatch:0});
  for(let i=0;i<44;i++){
    const a=i*2.39996,r=28+(i%5)*6,x=Math.sin(a)*r,z=Math.cos(a)*r*.62-9;
    if(z>0 && Math.abs(x)<13)continue;
    const size=7+(i%4)*2.1;
    const puff=new THREE.SphereGeometry(1,24,16),p=puff.attributes.position;
    for(let j=0;j<p.count;j++){
      const x=p.getX(j),y=p.getY(j),z=p.getZ(j),k=1+.07*Math.sin(x*7+y*4)*Math.cos(z*9+y*3);
      p.setXYZ(j,x*k,y*k,z*k);
    }
    puff.computeVertexNormals();
    K.add(cloudM,puff.scale(size,size*.55,size*.8).translate(x,door+2-(i%3)*2,z));
  }
  K.flush();
  // The cloud bank shares the kit's batching, but remains vapour, like the
  // world's cloud sea. Contact audits must not mistake it for a stone ledge.
  for (const mesh of K.group.children) if (mesh.material === cloudM) mesh.userData.floats = true;
  const at = K.world(0, door, R + 1.6);
  const front = K.world(0, door, R + 9);
  return { door: { at, heading: yaw }, kit: K, base, doorY: door, R, top: door + 77 * LANDMARK_SCALE.arzach2[1] + 14.2, hang, clear: [] , front, lamp };
}

// ------------------------------------------------------------------ the world change: the stones come down
/**
 * Once the Cloud-Mother is calm, the stones that fell up come down, all over
 * Vael II: the floating stones settle onto what lies under them (or sink into
 * the cloud), and the stones hanging round the belfry come down onto its
 * gallery. (The level's own movers bob them every frame: this runs after them,
 * level.update's late step.)
 */
function change(scene, level, rt) {
  const A = level.arzach2;
  const stones = [];
  let physics = null;
  const rest = (g) => {
    const w = g.getWorldPosition(new THREE.Vector3());
    const gy = physics?.groundAt?.(w.x, w.y - 3, w.z, 400) ?? -Infinity;
    const floor = Number.isFinite(gy) && gy > (A?.cloudY ?? -36) ? gy + 2.5 : (A?.cloudY ?? -36) - 8;
    return floor - w.y;   // (world metres to drop)
  };
  let k = 0, want = 0;
  return {
    root: null,
    init(ph) { physics = ph; },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; },
    update(dt) { k += (want - k) * Math.min(1, dt / 8); },
    /** After the level's movers have bobbed the stones: bring them down by k (and bob the belfry's own). */
    late(dt, t) {
      for (const h of rt.outside?.hang ?? []) h.g.position.y = THREE.MathUtils.lerp(h.y + Math.sin(t * 0.4 + h.i) * 1.2, h.rest.y, k);
      if (k < 1e-3) return;
      if (!stones.length && A?.floaters) for (const g of A.floaters.children) stones.push({ g, drop: null });
      for (const s of stones) {
        s.drop ??= rest(s.g);
        s.g.position.y += s.drop * k;
        s.g.rotation.y *= 1 - k;
      }
      for (const h of rt.outside?.hang ?? []) { h.g.position.x = THREE.MathUtils.lerp(h.x0 ??= h.g.position.x, h.rest.x, k); h.g.position.z = THREE.MathUtils.lerp(h.z0 ??= h.g.position.z, h.rest.z, k); }
    },
  };
}

/**
 * A save from before issue #336's house, standing inside the old rooms (src/temples/migrate.js LAYOUTS.arzach2 v4 sets
 * temple.arzach2.relaid): its first frame inside, the traveller is taken to the last mark, in the new rooms.
 */
export const RELAID = 'temple.arzach2.relaid';

export const ARZACH2_TEMPLE = {
  id: 'arzach2', levelId: 'arzach2', name: 'The Founders’ Belfry', doorLabel: 'door of the Founders’ Belfry',
  gadget: 'hook', gadgetBox: 'arzach2.temple.bell', arenaDoor: 'd4', arenas: ARENAS,   // (the box's id from when it held the whistle: the saves' flag)
  origin: [80, 1600, 150], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  // (its look inside since v1.77, issue #342: an ancient high-tech test chamber of slate, bronze and cobalt light)
  skin: foundersBelfrySkin,
  local: { person: 'ysel', out: 29, side: 3.5 },   // (src/temples/index.js: who stands by the door and points you in)
  enterLine: 'Inside the belfry the air is still and white, and somewhere above, something huge is crying.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Far below, the stones that fell up round the belfry begin to come down.', 'resolved.out'); },
  onUpdate(rt) {
    // (a save that stood in the old rooms: to the last mark, once)
    const P = rt.player;
    if (P?.pos && rt.game.flag(RELAID)) {
      rt.game.set(RELAID, null);
      if (rt.inside(P.pos) || rt.below(P.pos)) rt.toCheckpoint();
    }
  },
  // her calm comes from the bells: every founders' bell rung (struck: a pull-ring hooked, not the whistle), she hears
  onConnect(rt) { rt.offs.push(rt.game.on('bell', ({ pos, soft, struck } = {}) => { if (!soft && struck && rt.guardian?.awake) motherBell(rt.guardian, pos); })); },
};
