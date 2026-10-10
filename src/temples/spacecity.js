import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, paint } from './kit.js';
import { Door, Plate, Ball, Switch, Updraft, Platform, Bridge, Mark, Pit } from './pieces.js';
import { anchorModel, anchorGeometry } from './guardian-anchor.js';

// The City Floating in Space's temple: the Mooring-House, the makers' round house on the Moorings, an island of its
// own north of the Towers, a rising bridge to it. The islands of the city are moored to each other by the moorers'
// cables, and the great capstan in the Mooring-House holds them all together, kept by the makers' Anchor-Warden. The
// night the singing light passed, its note ran down every cable at once; since then the Warden has been letting the
// cables out, the islands drift apart a hand's width a night and the bridges creak. It is a machine: you stop it.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: PULLING THINGS HOME
// ACROSS THE VOID. Its floors stop short over the stars; what you need is out on a cable where you can't walk, and
// the tether (the gun's new mode, src/fluid-kit.js MODES.tether) brings it home. Before it, the plain verbs: a ball
// pushed, an eye splashed, the wings in a column of the void's breath.
//   the Landing Stage    the first mark, the way out
//   the Capstan Hall     the hub: a tall round hall round the dead great capstan, its cables slack. Ways off it to
//                        the two wings, south-west and south-east, the great door north (its lamp waits on an eye
//                        nobody can see from the hall), and high up the moorers' gate, the way back at the end
//   the Winch Room       (south-west) the counterweight, a stone ball rolled along its groove into its socket at the
//                        winch's mouth: the Lamp Shaft's gate, across the hall, rises (its pawl holds it after)
//   the Lamp Shaft       (south-east) a tall well whose grating breathes the void's air up: open the wings over it
//                        and it lifts you to the balcony and the lamp-eye in its niche (seen only from up there),
//                        which opens the great door, back across the hall
//   the Cord Loft        the makers' chest: TETHER MODE (src/items.js 'tether'). Its try: a ring on the wall that
//                        brings its lamp down. Its way on is open into
//   the Mooring Passage  a room on: the door into the Drift has a moorers' ring over it, too high to reach and only
//                        a pull wakes it (the tether's first lock, where a miss costs nothing)
//   the Drift            a void hall. The gangway to the high far landing rises only when the ball is home on the
//                        near landing's plate; the ball sits out on its cable-rail over the void, where nobody can
//                        stand behind it to push: pull it home
//   the Cable Walk       an open walkway over the stars to
//   the Balance          the twist: a void hall, one ball on a rail out over the void and two places for it. Pushed
//                        OUT to the far cup, its weight tips the balance and the pan rides between the landings, up
//                        to the Moorers' Gallery; pulled back HOME it frees the west door. Push, then pull
//   the Moorers' Gallery the south landing: the ring that holds the west door's chain hangs on its wall, seen from
//                        the door across the void, reached only here; and the moorers' gate, opened from this side by
//                        the same ring, back to the Capstan Hall (a shortcut: a balcony and a cradle down)
//   the Capstan Floor    the guardian (a robot: its meter is damage): the Anchor-Warden. When it has thrown its
//                        anchor and its drum stalls, pull the anchor home with the tether and it jams. In its second
//                        phase it hooks them over the bollards; in its last it pays them out over the void, out of
//                        reach: push its capstan bars to wind them in, then pull (the Balance's twist)
// After: the cables over the city hum taut, lamps along them, and the Mooring-House's capstan turns (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On the Moorings (src/levels/space-city.js ISLANDS.moorings): its door faces south, down the bridge to the Towers. */
export const SITE = { x: 96, y: 14, z: -180, r: 10 };
SITE.heading = Math.atan2(96 - SITE.x, -152 - SITE.z);

/**
 * The Mooring-House's colours: outside, the city's cream and salmon adobe; inside, pale stone in big smooth panels,
 * teal railings and frames, brass capstans and fittings, the glyphs and the pieces' light the starlight cyan; a
 * moorers' ring under every frieze glyph; its shade a cool blue-grey, its light the city's warm sun.
 */
export const PALETTE = {
  wall: '#efe9de', wall2: '#e7dfd0', wall3: '#f6f1e8', floor: '#e4dccd', floor2: '#d6ccb9', trim: '#4f9a98', fitting: '#d2a648',
  dark: '#2e3550', stone: '#e9dfcf', accent: '#e39a7f', glow: '#7fe3ec', glyph: '#7fe3ec', lamp: '#f2d48a', sand: '#e6d6bd', sand2: '#d9c7a8', void: '#0b0f1c',
  look: {
    all: { shadeFlat: 0.12, shadeHue: 0.8, shade: 0.5 },
    wall: { mode: 0, grid: 3.0, plates: true },
    glyph: { glow: 0.45 },
    fitting: { metal: 'brass' },
  },
  bands: [{ at: 0.72, h: 0.32, color: '#4f9a98' }, { y: 0.35, h: 0.5, color: '#e39a7f' }],
  ornament: { kind: 'mooring', color: '#d2a648', color2: '#7fe3ec', metal: 'brass', glow: 0.6 },
  light: { shadow: '#a7b6c9', light: '#fff3e2', sun: '#ffe7c4' },
};

// ------------------------------------------------------------------ the plan (the kit's local metres)
const C1 = 30, R1 = 14;                          // the Capstan Hall: its middle (z) and radius
const SW = -Math.PI * 3 / 4, SE = Math.PI * 3 / 4;  // its two wings
/** A point along the hall's radial at angle a, d metres out: [x, z]. */
const hallAt = (a, d) => [Math.sin(a) * d, C1 + Math.cos(a) * d];
const WINCH = hallAt(SW, 27), SHAFT = hallAt(SE, 26);
export const MOOR_A = Math.atan2(-22.4, 23 - C1);      // the moorers' corridor, from the hall to the Gallery's gate
/** The Balance: the north landing's floor, the south landing's (the Gallery), the ball's rail (z) and its two cups. */
export const BALANCE = { north: 6, south: 11, x: -30, a: 39.5, b: 29.0, home: 38.0, out: 30.0 };
/** The Drift: the far landing's height (no glide climbs to it), the ball's rail (z, x from the plate out over the void). */
export const DRIFT = { far: 6, z: 72, a: -7.6, b: -17.8, plate: -8.6, lip: -12.4 };
/** The Capstan Floor: its middle, radius, floor. */
export const FLOOR = { x: -74, z: 38, r: 19, y: 6 };

export const LOGIC = {
  id: 'spacecity', entry: 'stage', gadget: 'tether',
  rooms: {
    stage: { checkpoint: true }, hall: { checkpoint: true }, winch: { checkpoint: true }, stair: { checkpoint: true }, loft: { checkpoint: true },
    drift: { checkpoint: true }, driftFar: { checkpoint: true }, scale: { checkpoint: true }, moor: { checkpoint: true }, ante: {}, arena: { boss: true }, out: {},
  },
  links: [
    { a: 'stage', b: 'hall' },
    { a: 'hall', b: 'winch' },
    { a: 'hall', b: 'stair', door: 'g1' },          // the shaft's gate, while the counterweight sits on the winch's mouth
    { a: 'hall', b: 'loft', door: 'd1' },           // the great door: the lamp-eye up the shaft lit
    { a: 'loft', b: 'drift', door: 'd2' },          // the Mooring Passage's ring (a room on from the chest: one room with it)
    { a: 'drift', b: 'driftFar', door: 'br2' },     // the gangway: the ball pulled home off its cable-rail
    { a: 'driftFar', b: 'scale' },                  // the Cable Walk
    { a: 'scale', b: 'moor', door: 'gW' },          // the balance's pan: the ball pushed out to the far cup
    { a: 'moor', b: 'hall', oneWay: true },         // the moorers' gate and the cradle down, opened from the Gallery (sc)
    { a: 'scale', b: 'ante', door: 'gN' },          // the west door: the ball pulled home, and the Gallery's ring
    { a: 'ante', b: 'arena', door: 'd6' },
    { a: 'arena', b: 'out', door: 'd7' },
  ],
  elements: {
    // the winch's counterweight, rolled into its socket at the winch's mouth: the shaft's gate rises (its pawl holds it)
    ballW: { type: 'drum', room: 'winch', plate: 'pG', plateAt: 1, start: 0 },
    pG: { type: 'plate', room: 'winch' },
    g1: { type: 'door', opens: { drumOn: ['ballW', 'pG'] }, latch: true },
    s1: { type: 'switch', room: 'stair' },                          // the lamp-eye, seen only from the shaft's balcony
    d1: { type: 'door', opens: { lit: 's1' }, latch: true },
    chest: { type: 'gadget', room: 'loft', item: 'tether' },
    t0: { type: 'switch', room: 'loft', needs: ['tether'] },       // the loft's try: its ring brings the lamp down
    r1: { type: 'switch', room: 'loft', needs: ['tether'] },       // the ring over the passage's door
    d2: { type: 'door', opens: { lit: 'r1' }, latch: true },
    // the Drift's ball, out on its cable-rail over the void: only a pull brings it home
    ballD: { type: 'drum', room: 'drift', plate: 'pD', plateAt: 0.098, start: 1, needs: ['tether'] },
    pD: { type: 'plate', room: 'drift' },
    br2: { type: 'bridge', opens: { drumOn: ['ballD', 'pD'] }, latch: true },
    // the Gallery's ring first (logic.next goes in this order: once the pan has carried you up, the ring is the thing to
    // do there, before the ball is pulled home again)
    r5: { type: 'switch', room: 'moor', needs: ['tether'] },       // the Gallery's ring: the west door's chain, and the gate home
    sc: { type: 'door', opens: { lit: 'r5' }, latch: true },
    // the Balance: one ball, home on the north landing or out in the far cup over the void
    ballS: { type: 'drum', room: 'scale', plate: 'pHome', stops: { pHome: 0.143, pOut: 0.905 }, start: 0.143, needs: ['tether'] },
    pHome: { type: 'plate', room: 'scale' },
    pOut: { type: 'plate', room: 'scale' },
    gW: { type: 'bridge', opens: { drumOn: ['ballS', 'pOut'] } },  // (the balance's pan, a Platform: it rides while this holds)
    gN: { type: 'door', opens: { all: [{ drumOn: ['ballS', 'pHome'] }, { lit: 'r5' }] }, latch: true },
    d6: { type: 'door', opens: null },                              // the Capstan Floor's door: shut while the Warden fights
    warden: { type: 'boss', room: 'arena', needs: ['gun', 'tether'] },
    d7: { type: 'door', opens: { resolved: true } },
  },
};

/** The fight's numbers: what one anchor pulled home is worth, phase by phase; how long it stays open; how far out over
 * the void it pays them in its last phase (m past the floor's rim) and how much one push on its bars winds in; how near
 * a thrown anchor must be for the tether (m). */
export const WARDEN = { pull: [0.2, 0.175, 0.125], open: [5.5, 6.5, 8.5], out: 8, wind: 3.2, reach: 7.2 };

export const ANCHOR_WARDEN = {
  kind: 'robot', name: 'the Anchor-Warden', final: 'break', speed: 1.4, wakeTime: 3,
  wake: 'In the middle of the floor a great capstan of brass and iron turns itself round with a groan of cable. Its bars swing toward you, and its anchors lift.',
  openHint: 'Its anchor bites into the floor and its drum stalls, the cable slack. Pull the anchor home with the tether.',
  resolved: 'The Anchor-Warden takes up its last cable with a long sigh, and locks. Far below, every cable in the city draws taut.',
  missHint: 'It overreaches and its drum runs slack, its anchor lying out on the floor. Pull it home.',
  phases: [
    { to: 0.4, attacks: ['bars', 'cast', 'drop'], pause: 1.6, hint: 'When it has thrown its anchor, its drum stalls with the cable slack: pull the anchor home with the tether, and it jams.' },
    { to: 0.75, attacks: ['cast', 'spin', 'bars'], pause: 1.3, hint: 'Its bands crack, and it throws its anchors over the bollards at the edge and hauls against them. When it stalls, pull one free and home.' },
    { to: 1.0, attacks: ['casts', 'spin', 'drop'], pause: 1.1, hint: 'Now it pays its anchors out over the void, too far for the tether. A capstan is pushed round: push its bars to wind them in, then pull them home.' },
  ],
  attacks: {
    bars: { shape: 'cone', range: 8.5, angle: 1.1, wind: 1.2, track: 0.6, part: 'arms', rig: 'coil', damage: 0.5, knock: 10, recover: 0.6, then: 'bars2' },
    bars2: { shape: 'cone', range: 8.5, angle: 1.1, wind: 0.8, track: 0.5, part: 'arms', rig: 'coil', side: -1, pose: 'bars', link: true, damage: 0.5, knock: 10, gap: 0.25, then: 'castEnd' },
    castEnd: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 2.6, wind: 1.3, track: 0.6, part: 'arms', rig: 'lean', pose: 'cast', link: true, damage: 0.75, knock: 8, recover: 0.8, open: 5.5 },
    cast: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 2.6, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', damage: 0.75, knock: 8, recover: 0.8, open: 5.5 },
    drop: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'core', rig: 'rear', wave: { speed: 9, reach: 15, width: 0.7, damage: 0.5 }, damage: 1, knock: 12, recover: 1.0, open: 5.5 },
    spin: { shape: 'ring', at: 'self', radius: 7, wind: 1.3, part: 'arms', rig: 'spin', damage: 0.75, knock: 12, recover: 0.6, miss: 5 },
    casts: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'arms', rig: 'lean', pose: 'cast', damage: 0.5, knock: 6, recover: 0.8, open: 6.5 },
  },
};

/** How long it stays open: its phase's at least (the last wants pushes and a pull). */
export function wardenOpenFor(g, a, s) { return s ? Math.max(s, WARDEN.open[Math.min(g.phaseIndex, 2)]) : s; }

/** A push on it winds in an anchor paid out over the void (its last phase); anything else rings off its brass. */
function wardenHit(g, part, mode) {
  const rt = g.rt, an = rt.anchor;
  if (mode === 'push') {
    if (g.state === 'open' && an?.out && an.far > 0) { rt.windAnchor?.(); return true; }
    rt.notice('The shove rings off its bars. It turns when its drum is slack and an anchor is out.', 'aw.push');
    return true;
  }
  if (mode === 'stun') return false;   // (the stilling lens stops a strike, as anywhere)
  rt.notice('The fluid runs off its brass. It is the anchors that matter: pull them home.', 'aw.fluid');
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const brass = { paint: new THREE.Color('#d2a648'), smooth: false, side: THREE.FrontSide };
  const iron = { paint: new THREE.Color('#3d3f4c'), smooth: false, side: THREE.FrontSide };
  const cableM = { paint: new THREE.Color('#6a5844'), smooth: false, side: THREE.DoubleSide };
  const starM = makeMaterial({ color: PALETTE.glow, glow: 0.55, flat: true, key: 'temple.spacecity.starlines' });
  /** A straight corridor from (x0, z0) to (x1, z1), floor at y: a floor, two walls, a roof. */
  const corridor = (x0, z0, x1, z1, y, { w = 6.4, h = 6.4, roof = true } = {}) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const sx = Math.cos(ry), sz = -Math.sin(ry);
    K.both(M.floor, box(w + 0.8, 0.8, L, cx, y - 0.4, cz, ry));
    for (const s of [-1, 1]) K.wall(x0 + sx * s * w / 2, z0 + sz * s * w / 2, x1 + sx * s * w / 2, z1 + sz * s * w / 2, y, h, { t: 0.8 });
    if (roof) K.both(M.wall, box(w + 1.6, 0.8, L, cx, y + h + 0.4, cz, ry));
  };
  /** A cable hanging in a curve from a to b, sagging `sag` (drawn only). */
  const cable = (a, b, sag, r = 0.07) => {
    const pts = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return V(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t); });
    K.add(cableM, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, r, 4, false));
  };
  /** A teal railing along a void's edge from a to b ([x, z]) at y (solid). */
  const rail = (a, b, y, h = 1.0) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    K.both(M.trim, box(0.25, 0.2, L, (a[0] + b[0]) / 2, y + h, (a[1] + b[1]) / 2, ry));
    const n = Math.max(1, Math.round(L / 2));
    for (let i = 0; i <= n; i++) { const t = i / n; K.both(M.trim, box(0.18, h, 0.18, a[0] + (b[0] - a[0]) * t, y + h / 2, a[1] + (b[1] - a[1]) * t)); }
  };

  // ---- the Landing Stage (z 0..12): coils of rope, a bollard, the first mark
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.1, 0, 2.5, -1.25));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  for (const [x, z] of [[4.6, 9.2], [-4.4, 2.6]]) { K.both(iron, T(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 10), [x, 0.5, z])); K.add(brass, T(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 10), [x, 1.02, z])); }
  for (let i = 0; i < 3; i++) K.add(cableM, T(new THREE.TorusGeometry(0.8 - i * 0.18, 0.1, 4, 16), [5.2, 0.12 + i * 0.16, 4.4], [Math.PI / 2, 0, 0]));
  add(Mark, { room: 'stage', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: 6, h: 7 }] });
  corridor(0, 13.2, 0, C1 - R1 - 0.6, 0, { h: 7 });

  // ---- the Capstan Hall (the hub): the dead great capstan in the middle, its cables slack to the walls
  K.rotunda({ x: 0, z: C1, y: 0, r: R1, h: 22, seg: 36, oculus: 0.3, gaps: [
    { a: Math.PI, w: 5, h: 6.4 }, { a: SW, w: 5, h: 6.4 }, { a: SE, w: 5.6, h: 6.4 }, { a: 0, w: 5, h: 6.4 }, { a: MOOR_A, w: 5, h: 6.4, y0: 11 },
  ] });
  K.both(brass, T(new THREE.CylinderGeometry(2.6, 2.9, 4.2, 20), [0, 2.1, C1]));
  K.both(iron, T(new THREE.CylinderGeometry(3.3, 3.3, 0.5, 20), [0, 0.25, C1]));
  K.add(cableM, T(new THREE.CylinderGeometry(2.68, 2.68, 2.2, 20, 1, true), [0, 2.2, C1]));
  K.both(M.trim, T(new THREE.SphereGeometry(2.7, 18, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.45, 1), [0, 4.2, C1]));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4; K.both(brass, T(new THREE.BoxGeometry(0.4, 0.4, 2.6), [Math.sin(a) * 3.9, 3.6, C1 + Math.cos(a) * 3.9], [0, a, 0])); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; cable([Math.sin(a) * 2.8, 3, C1 + Math.cos(a) * 2.8], [Math.sin(a) * 13.9, 9, C1 + Math.cos(a) * 13.9], 3.2); }
  // the balcony inside the moorers' gate (the shortcut back), and its cradle down
  {
    const [bx, bz] = hallAt(MOOR_A, 12.2);
    K.both(M.floor, box(6.4, 0.8, 4.6, bx, 10.6, bz, MOOR_A));
    const [ax, az] = hallAt(MOOR_A + 0.2, 10.2), [cx, cz] = hallAt(MOOR_A - 0.2, 10.2);
    rail([ax, az], [cx, cz], 11);
    const [px, pz] = hallAt(MOOR_A, 7.6);
    add(Platform, { id: 'cradle', room: 'moor', path: [[px, 11, pz], [px, 0.2, pz]], r: 1.8, speed: 2.2, pause: 2.6, when: { open: 'sc' } });   // (the Gallery's way back)
  }
  add(Mark, { room: 'hall', at: [6.5, 0, C1 - 7], yaw: -Math.PI * 0.75 });

  // ---- the Winch Room (south-west): the counterweight's groove runs out through the corridor into the hall
  corridor(...hallAt(SW, 15.0), ...hallAt(SW, 18.6), 0);
  K.rotunda({ x: WINCH[0], z: WINCH[1], y: 0, r: 7.5, h: 10, gaps: [{ a: Math.PI / 4, w: 5, h: 6.4 }], oculus: 0.3 });
  {
    const [g0x, g0z] = hallAt(SW, 33.4), [g1x, g1z] = hallAt(SW, 19.6), L = Math.hypot(g1x - g0x, g1z - g0z);
    K.add(M.dark, box(1.0, 0.04, L, (g0x + g1x) / 2, 0.02, (g0z + g1z) / 2, SW));
    for (const s of [-0.8, 0.8]) K.add(M.trim, box(0.22, 0.12, L, (g0x + g1x) / 2 + Math.cos(SW) * s, 0.06, (g0z + g1z) / 2 - Math.sin(SW) * s, SW));
  }
  const bA = hallAt(SW, 31.6), bB = hallAt(SW, 20.6);
  add(Ball, { id: 'ballW', a: [bA[0], 0.04, bA[1]], b: [bB[0], 0.04, bB[1]], r: 1.1, friction: 1.2 });
  add(Plate, { id: 'pG', at: [bB[0], 0, bB[1]], r: 1.3 });
  // the winch itself on the far wall: a great drum on a frame, its cable run out along the groove
  {
    const [wx, wz] = hallAt(SW, 34.2);
    K.both(iron, box(6.2, 3.6, 0.8, wx, 1.8, wz, SW));
    K.both(brass, T(new THREE.CylinderGeometry(1.2, 1.2, 4.6, 16), [wx, 3.2, wz], [0, SW, Math.PI / 2], 1, 'YXZ'));
  }
  add(Mark, { room: 'winch', at: [WINCH[0] + 4.2, 0, WINCH[1] - 3.2], yaw: Math.PI / 4 });

  // ---- the Lamp Shaft (south-east): the gate in the corridor; a tall well breathing the void's air up its grating
  corridor(...hallAt(SE, 15.0), ...hallAt(SE, 17.8), 0);
  const [gx, gz] = hallAt(SE, 16.4);
  add(Door, { id: 'g1', at: [gx, 0, gz], yaw: SE, w: 5.6, h: 6.4, lamps: [{ drumOn: ['ballW', 'pG'] }] });
  K.rotunda({ x: SHAFT[0], z: SHAFT[1], y: 0, r: 7, h: 22, gaps: [{ a: -Math.PI / 4, w: 5.6, h: 6.4 }], oculus: 0.45 });
  K.add(M.trim, T(annulus(3.2, 3.6, 0.05, 32), [SHAFT[0], 0.02, SHAFT[1]]));
  for (let i = 0; i < 5; i++) K.add(M.dark, box(6.2, 0.05, 0.3, SHAFT[0], 0.04, SHAFT[1] - 2.4 + i * 1.2, Math.PI / 4));
  add(Updraft, { at: [SHAFT[0], 0, SHAFT[1]], r: 3.4, h: 17, lift: 7, hint: 'The void’s breath rises up the shaft. Open your wings in it.' });
  {
    const out = (d) => [SHAFT[0] + Math.sin(SE) * d, SHAFT[1] + Math.cos(SE) * d];
    const [bx, bz] = out(4.8);
    K.both(M.floor, box(6, 0.8, 4.6, bx, 12.6, bz, SE));
    const [l0x, l0z] = out(2.6);
    rail([l0x + Math.cos(SE) * 2.8, l0z - Math.sin(SE) * 2.8], [l0x - Math.cos(SE) * 2.8, l0z + Math.sin(SE) * 2.8], 13, 0.7);
    // the lamp-eye in its niche over the balcony: hidden from the grating below by the balcony's own floor
    const [ex, ez] = out(6.75);
    K.both(M.wall, box(3.2, 0.5, 1.2, ex - Math.sin(SE) * 0.2, 17.0, ez - Math.cos(SE) * 0.2, SE));
    add(Switch, { id: 's1', at: [ex, 14.9, ez], yaw: SE + Math.PI, size: 0.8 });
  }
  add(Mark, { room: 'stair', at: [SHAFT[0] - 3.4, 0, SHAFT[1] + 4.6], yaw: Math.PI * 0.75 });

  // ---- the great door and the Cord Loft (the chest): coils of the makers' cord round its walls
  add(Door, { id: 'd1', at: [0, 0, C1 + R1 + 0.7], w: 5, h: 6.4, lamps: [{ lit: 's1' }] });
  corridor(0, C1 + R1 + 0.4, 0, 47.4, 0);
  const C3 = 57;
  K.rotunda({ x: 0, z: C3, y: 0, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 0, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 0.31, C3));
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) K.add(cableM, T(new THREE.TorusGeometry(0.9 - (i % 2) * 0.15, 0.13, 4, 18), [s * 8.7, 1.6 + i * 0.32, C3 - 3], [0, Math.PI / 2, 0]));
  add(Switch, { id: 't0', at: [9.2, 2.6, C3 + 3], yaw: -Math.PI / 2, size: 0.8, pull: true });
  rt.loftLamp = { at: [5.5, 7.5, C3 + 3] };
  add(Mark, { room: 'loft', at: [-5.6, 0, C3 - 5], yaw: Math.PI * 0.25 });

  // ---- the Mooring Passage (a room on): the door into the Drift in its west wall, its ring high over it
  K.slab(-3.2, 66, 3.2, 69.6, 0, 0.8);
  K.hall({ x: 0, z: 78, w: 10, d: 18, y: 0, h: 9, roof: true, omit: ['w'], doors: [{ side: 's', w: 5, h: 6.4 }] });
  add(Door, { id: 'd2', at: [-5.6, 0, 78], yaw: Math.PI / 2, w: 5, h: 6.4, lamps: [{ lit: 'r1' }] });
  add(Switch, { id: 'r1', at: [-4.9, 7.4, 78], yaw: Math.PI / 2, size: 0.85, pull: true });
  for (let i = 0; i < 3; i++) K.add(cableM, T(new THREE.TorusGeometry(0.7, 0.12, 4, 16), [4.6, 1.2 + i * 0.3, 84], [0, Math.PI / 2, 0]));

  // ---- the Drift: a void hall open to the stars. The near landing (east), the far one six metres higher (west)
  K.hall({ x: -26, z: 78, w: 39.6, d: 22, y: -4, h: 24, floor: false, roof: false, doors: [{ side: 'e', w: 5, h: 6.4, y0: 4 }, { side: 's', at: -12, w: 5, h: 6.4, y0: 10 }] });
  K.slab(DRIFT.lip, 67, -6.2, 89, 0, 0.8);
  K.slab(-7, 75, -4.6, 81, 0, 0.8);
  K.slab(-45.8, 65.4, -30, 89, DRIFT.far, 2);
  add(Pit, { room: 'drift', min: [-46, -24, 67], max: [-6.2, -8, 89] });
  // the void's breath under the Drift: fall off with your wings open and it bears you back up to the near landing (no
  // higher: the far landing is out of its reach)
  add(Updraft, { at: [-20, -8, 84], r: 3.6, h: 10.5, lift: 6.5, hint: 'The void breathes up under the Drift. It bears your wings, but not as high as the far landing.' });
  add(Bridge, { id: 'br2', a: [DRIFT.lip + 0.1, 0, 81], b: [-30.1, DRIFT.far, 81], w: 4, n: 16 });
  // the ball's cable-rail: two cables from the near landing out over the void, a stop post at their end
  {
    const y = 0.02, L = DRIFT.a - DRIFT.b + 1.4, cx = (DRIFT.a + DRIFT.b) / 2 - 0.4;
    for (const s of [-0.55, 0.55]) K.add(M.trim, box(L, 0.12, 0.12, cx, y, DRIFT.z + s));
    K.add(iron, box(0.4, 1.8, 1.6, DRIFT.b - 1.5, -0.6, DRIFT.z));
    for (let x = DRIFT.lip - 2; x > DRIFT.b; x -= 2.6) K.add(iron, box(0.14, 0.5, 1.3, x, -0.25, DRIFT.z));
    cable([DRIFT.b - 1.5, -1.4, DRIFT.z], [DRIFT.b - 2, -18, DRIFT.z + 1], 0, 0.06);
  }
  add(Ball, { id: 'ballD', a: [DRIFT.a, 0.04, DRIFT.z], b: [DRIFT.b, 0.04, DRIFT.z], r: 1.1, friction: 1.0 });
  add(Plate, { id: 'pD', at: [DRIFT.plate, 0, DRIFT.z], r: 1.3 });
  // railings along the near lip, open at the rail and the gangway
  rail([DRIFT.lip + 0.3, 67.4], [DRIFT.lip + 0.3, DRIFT.z - 1.5], 0);
  rail([DRIFT.lip + 0.3, DRIFT.z + 1.5], [DRIFT.lip + 0.3, 78.6], 0);
  rail([DRIFT.lip + 0.3, 83.4], [DRIFT.lip + 0.3, 88.6], 0);
  rail([-30.3, 67.4], [-30.3, 78.6], DRIFT.far);
  rail([-30.3, 83.4], [-30.3, 88.6], DRIFT.far);
  // starlight lines down the walls, cables hanging in the void
  for (const x of [-40, -32, -22, -14]) { K.add(starM, box(0.14, 16, 0.06, x, 4, 89.02)); }
  for (const [x, z] of [[-18, 86], [-24, 70], [-27, 84]]) cable([x, 20, z], [x + 0.5, -20, z + 0.4], 0, 0.06);
  add(Mark, { room: 'drift', at: [-9.2, 0, 86], yaw: -Math.PI / 2 });
  add(Mark, { room: 'driftFar', at: [-42, DRIFT.far, 85], yaw: Math.PI / 2 });

  // ---- the Cable Walk: an open walkway over the stars from the Drift's far landing south to the Balance
  K.bridge([-38, DRIFT.far, 65.6], [-38, DRIFT.far, 42.6], 4.4, { parapet: 1.0 });
  for (const z of [62, 54, 46]) K.both(M.trim, box(0.4, 3.2, 0.4, -40.6, DRIFT.far + 1.6, z)), K.both(M.trim, box(0.4, 3.2, 0.4, -35.4, DRIFT.far + 1.6, z));
  add(Pit, { room: 'driftFar', min: [-52, -18, 42.6], max: [-24, 2, 65.4] });

  // ---- the Balance: a void hall; the north landing (y 6), the Moorers' Gallery to the south (y 11)
  const BN = BALANCE.north, BS = BALANCE.south;
  K.hall({ x: -34, z: 31, w: 22, d: 22, y: -2, h: 26, floor: false, roof: false, doors: [
    { side: 'n', at: -4, w: 5, h: 6.4, y0: BN + 2 }, { side: 'w', at: 7, w: 5, h: 6.4, y0: BN + 2 }, { side: 'e', at: -8, w: 5, h: 6.4, y0: BS + 2 },
  ] });
  K.slab(-45, 35, -23, 43.2, BN, 2);
  K.slab(-45, 19.4, -23, 25, BS, 2);
  add(Pit, { room: 'scale', min: [-45, -18, 20], max: [-23, 3.5, 42] });
  // the balance's pan: while the ball's weight sits in the far cup it rides between the landings, up to the Gallery
  add(Platform, { id: 'gW', room: 'scale', path: [[-40, BN, 33.0], [-40, BS, 27.0]], r: 2.2, speed: 1.6, pause: 2.4, when: { open: 'gW' } });
  // the balance itself: a great beam over the void on a post, tipped by the ball's weight (drawn), the ball's rail out to the far cup
  K.both(iron, box(1.2, 14, 1.2, -26, 4, 30));
  K.add(brass, box(0.6, 0.6, 16, -26, 11.4, 30));
  for (const z of [22.4, 37.6]) K.add(brass, T(new THREE.CylinderGeometry(1.6, 1.2, 0.6, 14), [-26, 10.6, z]));
  {
    const L = BALANCE.a - BALANCE.b + 1.6, cz = (BALANCE.a + BALANCE.b) / 2 - 0.4;
    for (const s of [-0.55, 0.55]) K.add(M.trim, box(0.12, 0.12, L, BALANCE.x + s, BN + 0.02, cz));
    K.add(iron, box(1.6, 1.8, 0.4, BALANCE.x, BN - 0.6, BALANCE.b - 1.4));
    for (let z = 33; z > BALANCE.b; z -= 2.6) K.add(iron, box(1.3, 0.5, 0.14, BALANCE.x, BN - 0.25, z));
    K.add(brass, T(annulus(1.3, 1.8, 0.08, 24), [BALANCE.x, BN + 0.03, BALANCE.out]));
  }
  add(Ball, { id: 'ballS', a: [BALANCE.x, BN + 0.04, BALANCE.a], b: [BALANCE.x, BN + 0.04, BALANCE.b], r: 1.1, friction: 0.7 });
  add(Plate, { id: 'pHome', at: [BALANCE.x, BN, BALANCE.home], r: 1.3 });
  add(Plate, { id: 'pOut', at: [BALANCE.x, BN, BALANCE.out], r: 1.3 });
  rail([-44.6, 35.3], [-41.9, 35.3], BN);
  rail([-38.1, 35.3], [BALANCE.x - 1.6, 35.3], BN);
  rail([BALANCE.x + 1.6, 35.3], [-23.4, 35.3], BN);
  rail([-44.6, 24.7], [-41.9, 24.7], BS);
  rail([-38.1, 24.7], [-23.4, 24.7], BS);
  // the west door and its chain up to the Gallery's ring (drawn), the Gallery's ring on the south wall
  add(Door, { id: 'gN', at: [-45.6, BN, 38], yaw: Math.PI / 2, w: 5, h: 6.4, lamps: [{ drumOn: ['ballS', 'pHome'] }, { lit: 'r5' }] });
  // (on a davit over the Gallery's west end: high over the landing, out of the tether's reach from the north landing)
  K.both(iron, box(0.5, 5.2, 0.5, -44.2, BS + 2.6, 22.6));
  K.add(iron, box(2.6, 0.3, 0.3, -43.1, BS + 5.1, 22.6));
  add(Switch, { id: 'r5', at: [-42, BS + 3.4, 22.6], yaw: 0, size: 0.9, pull: true });
  cable([-44.4, BN + 6.6, 37], [-42.6, BS + 5.1, 22.8], 1.2, 0.06);
  for (const x of [-42, -24]) K.add(starM, box(0.14, 14, 0.06, x, 10, 20.02));
  add(Mark, { room: 'scale', at: [-25.2, BN, 41], yaw: Math.PI });
  add(Mark, { room: 'moor', at: [-26, BS, 21.6], yaw: -Math.PI / 2 });
  // the moorers' gate (opened from the Gallery by its ring) and the corridor back to the Capstan Hall's balcony
  corridor(...hallAt(MOOR_A, 14.4), ...hallAt(MOOR_A, 23.0), BS);
  {
    const [sx, sz] = hallAt(MOOR_A, 21.4);
    add(Door, { id: 'sc', at: [sx, BS, sz], yaw: MOOR_A, w: 5.6, h: 6.4, lamps: [{ lit: 'r5' }] });
  }

  // ---- the ante and the Capstan Floor: a round floor open to the void at four great windows, a bollard before each
  corridor(-46.2, 38, FLOOR.x + FLOOR.r + 0.6, 38, FLOOR.y);
  add(Mark, { room: 'ante', at: [-50.5, FLOOR.y, 40], yaw: Math.PI / 2 });
  const HR = FLOOR.r, CX = FLOOR.x, CZ = FLOOR.z, FY = FLOOR.y;
  const windows = [Math.PI / 4, -Math.PI / 4, Math.PI * 3 / 4, -Math.PI * 3 / 4];
  K.rotunda({ x: CX, z: CZ, y: FY, r: HR, h: 20, seg: 36, oculus: 0.62, gaps: [{ a: Math.PI / 2, w: 5, h: 6 }, { a: -Math.PI / 2, w: 5, h: 6 }, ...windows.map((a) => ({ a, w: 9, h: 7 }))] });
  rt.bollards = [];
  for (const a of windows) {
    // the window's rail across the gap, a bollard inside it
    const ox = CX + Math.sin(a) * (HR + 0.5), oz = CZ + Math.cos(a) * (HR + 0.5);
    K.both(M.trim, T(new THREE.BoxGeometry(9.6, 0.25, 0.3), [ox, FY + 1.0, oz], [0, a, 0]));
    for (const s of [-1, 0, 1]) K.both(M.trim, T(new THREE.BoxGeometry(0.2, 1.0, 0.2), [ox + Math.cos(a) * s * 4.4, FY + 0.5, oz - Math.sin(a) * s * 4.4]));
    const bx = CX + Math.sin(a) * (HR - 3.2), bz = CZ + Math.cos(a) * (HR - 3.2);
    K.both(iron, T(new THREE.CylinderGeometry(0.6, 0.75, 1.5, 12), [bx, FY + 0.75, bz]));
    K.add(brass, T(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 12), [bx, FY + 1.55, bz]));
    rt.bollards.push(K.world(bx, FY + 1.6, bz));
  }
  rt.windows = windows.map((a) => ({ a: K.heading(a), at: K.world(CX + Math.sin(a) * HR, FY, CZ + Math.cos(a) * HR) }));
  K.add(brass, T(annulus(8.0, 8.6, 0.06, 64), [CX, FY + 0.03, CZ]));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; K.add(M.dark, T(new THREE.BoxGeometry(0.3, 0.05, 1.6), [CX + Math.sin(a) * 11, FY + 0.03, CZ + Math.cos(a) * 11], [0, a, 0])); }
  add(Pit, { room: 'arena', min: [CX - HR - 30, -18, CZ - HR - 30], max: [CX + HR + 8, FY - 4, CZ + HR + 30] });
  add(Door, { id: 'd6', at: [CX + HR + 0.7, FY, CZ], yaw: Math.PI / 2, w: 5, h: 6 });
  add(Door, { id: 'd7', at: [CX - HR - 0.7, FY, CZ], yaw: Math.PI / 2, w: 5, h: 6 });
  const X0 = CX - HR - 0.6;
  K.slab(X0 - 9.4, CZ - 3.2, X0, CZ + 3.2, FY, 0.8);
  K.wall(X0 - 0.8, CZ + 3.2, X0 - 9.4, CZ + 3.2, FY, 7, { t: 0.8 }); K.wall(X0 - 9.4, CZ - 3.2, X0 - 0.8, CZ - 3.2, FY, 7, { t: 0.8 });
  K.wall(X0 - 9.4, CZ + 3.2, X0 - 9.4, CZ - 3.2, FY, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.4, 0.8, 7.2, X0 - 4.7, FY + 7.4, CZ));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [X0 - 9.9, FY, CZ], [0, Math.PI / 2, 0]));
  K.solid(box(0.1, 5, 4, X0 - 9.9, FY + 2.5, CZ));

  const model = anchorModel();
  model.pos.copy(K.world(CX + 4, FY, CZ));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI / 2);
  model.rest = K.world(CX - 1, FY, CZ);
  model.restHeading = K.heading(Math.PI / 2);
  const arena = { center: K.world(CX, FY, CZ), r: HR, y: K.world(0, FY, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(CX - HR - 14, -20, -3), V(SHAFT[0] + 10, 34, 92)),
    gadget: { at: W(0, 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(X0 - 9.4, FY + 0.5, CZ), r: 1.5 }],
    lights: [[0, 5, 6, 10], [0, 10, C1, 18], [WINCH[0], 6, WINCH[1], 12], [SHAFT[0], 12, SHAFT[1], 14], [0, 8, C3, 12], [0, 6, 78, 10],
      [-12, 6, 78, 16], [-36, 10, 78, 16], [-38, 9, 54, 14], [-34, 12, 31, 18], [CX, FY + 8, CZ, 24]],
    guardian: { def: { ...ANCHOR_WARDEN, onHit: wardenHit, openFor: wardenOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Mooring-House on the Moorings
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 8, sill = 0.4, HW = 24;
  const K = new TempleKit(rt.root, 'The Mooring-House', V(SITE.x, SITE.y, SITE.z), yaw, rt.M);
  const M = rt.M;
  const adobe = paint('#efe2cc'), salmon = paint('#e8a38a'), coral = paint('#d9776a'), teal = paint('#4f9a98'), brass = paint('#d2a648'), iron = paint('#3d3f4c');
  const lit = makeMaterial({ color: '#ffe2a8', glow: 0.7, flat: true, key: 'temple.spacecity.windows' });
  // a round apron of paving, the drum of rounded adobe (salmon at its foot, teal bands), a rounded cornice and a roof deck
  K.both(M.floor, new THREE.CylinderGeometry(R + 6, R + 6, 1.0, 36).translate(0, sill - 0.5, 0));
  K.both(adobe, new THREE.CylinderGeometry(R, R + 0.5, HW, 28).translate(0, sill + HW / 2, 0));
  K.add(salmon, new THREE.CylinderGeometry(R + 0.52, R + 0.56, 3.2, 28).translate(0, sill + 1.6, 0));
  for (const y of [9, 16.5]) K.both(teal, new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.6, 28).translate(0, sill + y, 0));
  K.both(adobe, new THREE.TorusGeometry(R + 0.2, 0.7, 6, 28).rotateX(Math.PI / 2).translate(0, sill + HW, 0));
  K.both(coral, new THREE.CylinderGeometry(R + 0.2, R + 0.2, 0.8, 28).translate(0, sill + HW + 0.2, 0));
  // round windows up the drum, lit
  for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5) continue; for (const y of [12.4, 20]) K.add(lit, T(new THREE.CircleGeometry(0.7, 14), [Math.sin(a) * (R + 0.08), sill + y, Math.cos(a) * (R + 0.08)], [0, a, 0])); }
  for (let i = 0; i < 12; i++) { const a = (i + 0.25) / 12 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.7) continue; K.add(M.glyph, T(glyphGeometry(1.3, 0.12), [Math.sin(a) * (R + 0.4), sill + 6, Math.cos(a) * (R + 0.4)], [0, a, 0])); }
  // the capstan's housing on the roof: an iron drum and a brass rim (the capstan turns on it: dynamic, below)
  K.both(iron, new THREE.CylinderGeometry(4.6, 5.2, 1.6, 20).translate(0, sill + HW + 1.4, 0));
  K.both(brass, new THREE.CylinderGeometry(5.4, 5.4, 0.3, 24).translate(0, sill + HW + 2.3, 0));
  // the porch: a rounded adobe arch over the door, teal-framed, the glyph over it; lamps on posts either side
  const z0 = R - 1.2, z1 = R + 2.6;
  for (const s of [-1, 1]) K.both(adobe, box(2.4, 7.6, z1 - z0, s * 3.6, sill + 3.8, (z0 + z1) / 2));
  K.both(adobe, box(9.6, 1.8, z1 - z0, 0, sill + 7.5, (z0 + z1) / 2));
  K.both(adobe, T(new THREE.TorusGeometry(2.75, 0.4, 6, 24, Math.PI), [0, sill + 4.2, z1 - 0.2]));
  K.add(teal, T(new THREE.TorusGeometry(2.35, 0.13, 5, 24, Math.PI), [0, sill + 4.2, z1 + 0.2]));
  for (const s of [-1, 1]) K.add(teal, box(0.26, 4.2, 0.2, s * 2.35, sill + 2.1, z1 + 0.2));
  K.add(M.glyph, T(glyphGeometry(1.8, 0.14), [0, sill + 7.6, z1 + 0.06]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.8, 6.8).translate(0, 3.4, 0), [0, sill, R + 0.25]));
  K.solid(box(4.8, 6.8, 0.1, 0, sill + 3.4, R + 0.25));
  for (const s of [-1, 1]) {
    K.both(iron, box(0.2, 3.2, 0.2, s * 6.4, sill + 1.6, z1 + 1.2));
    K.add(lit, T(new THREE.SphereGeometry(0.4, 10, 6), [s * 6.4, sill + 3.5, z1 + 1.2]));
  }
  // mooring bollards round the apron, a coil of cable by the door
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.8) continue; K.both(iron, T(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 10), [Math.sin(a) * (R + 4.6), sill + 0.5, Math.cos(a) * (R + 4.6)])); }
  K.flush();
  // the great capstan on the roof (it turns after): a brass drum wound with cable, eight bars, a crown
  const capM = makeMaterial({ color: '#d2a648', flat: true, metal: 'brass', key: 'temple.spacecity.capstan' });
  const capstan = new THREE.Group();
  capstan.position.copy(K.world(0, sill + HW + 2.45, 0));
  capstan.rotation.y = yaw;
  const parts = [new THREE.CylinderGeometry(3.4, 3.6, 4.2, 20).translate(0, 2.1, 0), new THREE.SphereGeometry(3.4, 18, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.4, 1).translate(0, 4.2, 0), new THREE.CylinderGeometry(0.4, 0.5, 2.4, 8).translate(0, 5.6, 0)];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; parts.push(new THREE.BoxGeometry(0.4, 0.4, 5).translate(0, 3.4, 5.6).rotateY(a)); }
  const capstanMesh = new THREE.Mesh(mergeAll(parts), capM);
  capstan.add(capstanMesh);
  capstan.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  rt.root.add(capstan);
  const at = K.world(0, sill, R + 1.4);
  const front = K.world(0, sill, R + 9);
  return { door: { at, heading: yaw }, kit: K, R, sill, HW, capstan, top: K.world(0, sill + HW + 4.6, 0), clear: [{ x: SITE.x, z: SITE.z, r: R + 6 }, { x: front.x, z: front.z, r: 5 }] };
}

function mergeAll(list) {
  const g = new THREE.BufferGeometry(), pos = [], nor = [];
  for (const q0 of list) { const q = q0.index ? q0.toNonIndexed() : q0; pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// ------------------------------------------------------------------ the world change: the cables hum taut
/** Where the Mooring-House's great cables run (world): the Towers' pipe stack, the Balcony's tower of pipes, the far island to the north. */
export const CABLES = [[114, 32, -96], [15, 26, -176], [80, 44, -330]];

/**
 * Before: the great cables from the capstan on the Mooring-House's roof hang slack, sagging deep into the void between
 * the islands, and the capstan is still. After: they are taut, a row of lamps lit along each, and the capstan turns
 * slowly, holding the city together. Three tubes each way and one instanced pool of lamps.
 */
function change(scene, level, rt) {
  const O = rt.outside;
  const root = new THREE.Group();
  root.name = 'The Mooring-House holds the city (the world change)';
  rt.root.add(root);
  root.visible = false;
  const slack = new THREE.Group();
  slack.name = 'The slack cables';
  rt.root.add(slack);
  const cableM = makeMaterial({ color: '#4a3e34', flat: true, key: 'temple.spacecity.cable' });
  const lampM = makeMaterial({ color: '#ffe2a8', glow: 0.85, flat: true, key: 'temple.spacecity.cablelamps' });
  const N = 9;
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 5), lampM, CABLES.length * N);
  const m4 = new THREE.Matrix4();
  if (O) {
    const from = O.top;
    const tube = (to, sag) => {
      const pts = Array.from({ length: 13 }, (_, i) => { const t = i / 12; return V(from.x + (to[0] - from.x) * t, from.y + (to[1] - from.y) * t - Math.sin(Math.PI * t) * sag, from.z + (to[2] - from.z) * t); });
      return { mesh: new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 4, false), cableM), pts };
    };
    CABLES.forEach((to, c) => {
      slack.add(tube(to, 34).mesh);
      const taut = tube(to, 2.5);
      root.add(taut.mesh);
      const curve = new THREE.CatmullRomCurve3(taut.pts);
      for (let i = 0; i < N; i++) { const p = curve.getPoint((i + 1) / (N + 1)); m4.makeTranslation(p.x, p.y - 0.5, p.z); lamps.setMatrixAt(c * N + i, m4); }
    });
  }
  lamps.instanceMatrix.needsUpdate = true;
  root.add(lamps);
  for (const g of [root, slack]) g.traverse((o) => { o.userData.noCollide = true; o.userData.dynamic = true; });
  let k = 0, want = 0, turn = 0;
  const apply = () => { root.visible = k > 0.01; slack.visible = k < 0.99; };
  return {
    root, slack, lamps,
    get on() { return want === 1; },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt, t) {
      if (k !== want) { k = THREE.MathUtils.clamp(k + (want ? dt / 3 : -dt), 0, 1); apply(); }
      turn += dt * 0.18 * k;
      if (O) O.capstan.rotation.y = SITE.heading + turn;
      lampM.uniforms.uGlow.value = 0.85 * k * (0.85 + 0.15 * Math.sin(t * 1.7));
    },
  };
}

export const SPACECITY_TEMPLE = {
  id: 'spacecity', levelId: 'spacecity', name: 'The Mooring-House', doorLabel: 'door of the Mooring-House',
  gadget: 'tether', gadgetBox: 'spacecity.temple.tether', arenaDoor: 'd6',
  origin: [-130, 1500, -120], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'joss', out: 7, side: 6 },
  enterLine: 'Inside the Mooring-House the floors stop short over nothing, and under them the stars go on. Somewhere overhead, cable pays out with a long creak.',
  pitLine: 'You catch a hanging cable and haul yourself back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out over the city every cable draws taut and hums, and the lamps along them light, one after another.', 'resolved.out'); },
  // the loft's try: its ring brings a lamp down on its cord (and nothing else)
  onLit(rt, id) {
    if (id === 't0') rt.notice('The ring comes home with a clack, and a lamp drops down on its cord from the loft’s roof. That is all it does: the makers liked to see what they were doing.', 'sc.t0');
  },
  // the thrown anchor: pull it home while its drum is slack and it jams (in its last phase, out over the void, wind
  // it in first: a push on its bars)
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const m = G.model, A = G.arena;
    const mat = makeMaterial({ color: '#ffffff', vertexColors: true, flat: true, key: 'temple.spacecity.anchor' });
    const cableM = makeMaterial({ color: '#6a5844', flat: true, key: 'temple.spacecity.anchorcable' });
    const mesh = new THREE.Mesh(anchorGeometry({ s: 0.8 }), mat), line = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 4).translate(0, 0.5, 0), cableM);
    for (const o of [mesh, line]) { o.userData.noCollide = true; o.userData.dynamic = true; o.visible = false; rt.root.add(o); }
    const an = rt.anchor = { at: V(), out: false, far: 0, a: 0, back: 0, from: V() };
    const _d = V(), _u = V(0, 1, 0), _q = new THREE.Quaternion();
    const place = () => {
      mesh.position.copy(an.at).add(V(0, 2.2, 0));
      m.drumAt(an.from);
      _d.subVectors(mesh.position, an.from);
      const L = _d.length();
      line.position.copy(an.from);
      line.quaternion.copy(_q.setFromUnitVectors(_u, _d.normalize()));
      line.scale.set(1, Math.max(0.01, L), 1);
    };
    /** Where it lies in its last phase: out over the void past the nearest window, `far` m beyond the floor's rim. */
    const overVoid = () => an.at.set(A.center.x + Math.sin(an.a) * (A.r + 0.5 + an.far), A.y - 1.2, A.center.z + Math.cos(an.a) * (A.r + 0.5 + an.far));
    const throwAnchor = () => {
      const P = rt.player, i = Math.min(G.phaseIndex, 2);
      const toP = P ? Math.atan2(P.pos.x - A.center.x, P.pos.z - A.center.z) : 0;
      if (i === 0) {
        // on the floor, between it and you
        const d = P ? Math.min(6, Math.hypot(P.pos.x - m.pos.x, P.pos.z - m.pos.z) * 0.6) : 4, h = P ? Math.atan2(P.pos.x - m.pos.x, P.pos.z - m.pos.z) : m.heading;
        an.at.set(m.pos.x + Math.sin(h) * d, A.y, m.pos.z + Math.cos(h) * d); an.far = 0;
      } else if (i === 1 && rt.bollards?.length) {
        // hooked over the bollard nearest you
        const b = rt.bollards.reduce((x, y) => (P && y.distanceTo(P.pos) < x.distanceTo(P.pos) ? y : x));
        an.at.copy(b).setY(A.y + 0.2); an.far = 0;
      } else {
        // paid out over the void, past the window nearest you
        const w = (rt.windows ?? [{ a: toP }]).reduce((x, y) => (Math.abs(Math.atan2(Math.sin(y.a - toP), Math.cos(y.a - toP))) < Math.abs(Math.atan2(Math.sin(x.a - toP), Math.cos(x.a - toP))) ? y : x));
        an.a = w.a; an.far = WARDEN.out; overVoid();
      }
      an.out = true; an.back = 0; m.hang(0, false);
      rt.sound?.critter?.('clank', 0.9);
    };
    /** A push on its bars, its last phase: the drum turns a notch and winds the anchor in toward the rim. */
    rt.windAnchor = () => {
      if (!an.out || an.far <= 0) return false;
      an.far = Math.max(0, an.far - WARDEN.wind);
      overVoid();
      if (an.far <= 0) an.at.set(A.center.x + Math.sin(an.a) * (A.r - 0.6), A.y, A.center.z + Math.cos(an.a) * (A.r - 0.6));
      rt.sound?.critter?.('creak', 0.9);
      rt.notice('The bars give under the shove: the drum turns a notch and winds the anchor in over the void.', 'aw.wind');
      return true;
    };
    /** The tether on a thrown anchor: home it comes, and the drum jams. */
    rt.anchorPull = () => {
      if (!an.out || G.state !== 'open') return false;
      const P = rt.player;
      if (an.far > WARDEN.out - WARDEN.wind * 1.5 || (P && P.pos.distanceTo(an.at) > WARDEN.reach + 2.5)) {
        rt.notice('It hangs out over the void, too far for the tether. A capstan is pushed round: push its bars to wind it in.', 'aw.far');
        return false;
      }
      an.out = false; an.back = 0.7; an.far = 0;
      m.jam(1);
      G.add(WARDEN.pull[Math.min(G.phaseIndex, 2)], 'anchor');
      rt.rumble(0.7, 0.45);
      rt.sound?.chime?.();
      rt.notice('The anchor comes home across the floor and slams into its drum. The capstan jams, shuddering.', `aw.pull.${G.phaseIndex}`);
      if (G.state === 'open') { G.enter('fight'); G.cool = 2; }
      return true;
    };
    rt.offs.push(registerTarget({
      kind: 'sentinel', radius: 1.1, accepts: ['tether'], position: () => mesh.position, enabled: () => an.out && G.state === 'open',
      onHit: (mode) => { if (mode === 'tether') rt.anchorPull(); else rt.notice('It is hooked fast. Pulled, it would come; nothing else moves it.', 'aw.hooked'); return true; },
    }));
    const upd = G.update.bind(G);
    let was = G.state;
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.state === 'open' && was !== 'open') throwAnchor();
      if (G.state !== 'open' && an.out) { an.out = false; an.back = 0.7; }   // (it winds it back in itself)
      was = G.state;
      if (an.back > 0) {
        an.back = Math.max(0, an.back - dt);
        an.at.lerp(m.pos, Math.min(1, dt * 6));
        if (an.back === 0) m.hang(0, true);
      }
      mesh.visible = line.visible = an.out || an.back > 0;
      if (mesh.visible) place();
    };
  },
};
