import * as THREE from 'three';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Platform, Bridge, BellEar, Switch, Mark, Pit } from './pieces.js';
import { whaleModel } from './guardians.js';

// Vael II's temple: the Founders' Belfry, a tower of bone-white stone that
// rises straight out of the cloud beside the starting plateau, a bridge from
// the plateau's west rim to its door. The monks say the founders built it
// before the monastery, to keep the stones down: a bell in every room, and the
// stones stayed where they were put. The bells stopped; the stones fell up.
// Something swims in the top of the tower, and cries.
//
// Inside (built far overhead, through its door). The temple's one idea: a founders' bell holds things only
// while it rings; a stone's weight holds them for good.
//   the Threshold          the first mark, the way out
//   the Hall of Stones     a hub: the door on has two lamps, and two archways open off the hall, west and
//                          east, into the two stone stores. A ball in each, a plate at its groove's end: roll
//                          both home (the push) and the door sinks. You find the path, in your own order.
//   the Stone Stair        a round well whose stair fell up: one great stone hangs at the top of it, by the
//                          high door. Low by the way in hangs a founders' bell with no clapper, and a stone ball
//                          lies in a groove that runs into its mouth: roll the ball in and it strikes the bell
//                          (a splash on it as it lies there strikes again). While the bell rings the great stone
//                          comes down to the floor; when it falls quiet the stone falls up again, and whoever
//                          stands on it goes up with it (the house's own bell, taught before the whistle: what
//                          the bell holds, it holds only while it rings). The high door's eye is on the
//                          landing's face, under your feet once you are up: splash it on the way
//   the Bell Chamber       the makers' chest: the BELL-NOTE WHISTLE (src/items.js 'bell'). Its way on is open.
//                          The clapperless bell in the oculus answers the whistle: three stones that fell up come
//                          down round the dais while it rings, and fall up again (a try where nothing is locked)
//   the Bell Porch         a room on: the door into the Hall of Echoes is held by the porch's own bell, open only
//                          while it rings (about eight seconds). Ring, walk through; too slow, ring again (the
//                          whistle's first lock, where failing costs nothing)
//   the Hall of Echoes     a chasm, the stones of its bridge hanging high over it (they fell up): the bell
//                          brings them down only while it rings, ten seconds, enough to run across. But the
//                          far door wants a ball on its plate too, and the ball waits at the near edge in a
//                          groove that runs over the bridge: ring, then roll the ball across while the
//                          stones are down (it stops at the lip while they hang, and drops if they rise
//                          under it). On its plate its weight holds the stones down for good.
//   the Cloud-Mother's Hall the guardian (organic: you calm her). She swims high and fearful, gusts and dives;
//                          each time she cries, low, her mouth open, sound the bell near her. Stones that fell
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

export const LOGIC = {
  id: 'arzach2', entry: 'threshold', gadget: 'bell',
  // (the Bell Chamber and the Bell Porch are one room: the way between them is open, and nothing past the porch
  // opens without the whistle)
  rooms: { threshold: { checkpoint: true }, stones: { checkpoint: true }, storeW: {}, storeE: {}, stair: { checkpoint: true }, landing: {}, bell: { checkpoint: true }, echoes: { checkpoint: true }, echoesFar: {}, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'stones' },
    { a: 'stones', b: 'storeW' },
    { a: 'stones', b: 'storeE' },
    { a: 'stones', b: 'stair', door: 'd1' },
    { a: 'stair', b: 'landing', door: 'lift' },     // the great stone: rung down, it falls up again with you on it
    { a: 'landing', b: 'bell', door: 'd2' },
    { a: 'bell', b: 'echoes', door: 'd3' },         // the Bell Porch's held door, a room on from the chest
    { a: 'echoes', b: 'echoesFar', door: 'br1' },
    { a: 'echoesFar', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    p1: { type: 'plate', room: 'storeW' },
    p2: { type: 'plate', room: 'storeE' },
    ball1: { type: 'drum', room: 'storeW', plate: 'p1', plateAt: 1, start: 0 },
    ball2: { type: 'drum', room: 'storeE', plate: 'p2', plateAt: 1, start: 0 },
    d1: { type: 'door', opens: { all: [{ pressed: 'p1' }, { pressed: 'p2' }] }, latch: true },
    // the Stone Stair: the ball rolled into the founders' bell's mouth strikes it; while it rings the great stone is down
    ballS: { type: 'drum', room: 'stair', plate: 'pS', plateAt: 1, start: 0 },
    pS: { type: 'plate', room: 'stair' },
    e0: { type: 'bell', room: 'stair', hold: 12, when: { drumOn: ['ballS', 'pS'] } },
    lift: { type: 'door', opens: { lit: 'e0' }, latch: true },
    s1: { type: 'switch', room: 'stair' },
    d2: { type: 'door', opens: { lit: 's1' }, latch: true },
    chest: { type: 'gadget', room: 'bell', item: 'bell' },
    // the chamber's own bell in the oculus: stones come down round the dais while it rings (nothing is locked by it)
    eT: { type: 'bell', room: 'bell', needs: ['bell'], hold: 6 },
    heap: { type: 'bridge', opens: { lit: 'eT' } },
    e1: { type: 'bell', room: 'bell', needs: ['bell'], hold: 8 },   // the porch's bell
    d3: { type: 'door', opens: { lit: 'e1' } },
    e2: { type: 'bell', room: 'echoes', needs: ['bell'], hold: 10 },
    ball3: { type: 'drum', room: 'echoes', plate: 'p3', plateAt: 1, start: 0 },
    p3: { type: 'plate', room: 'echoesFar' },
    br1: { type: 'bridge', opens: { any: [{ lit: 'e2' }, { drumOn: ['ball3', 'p3'] }] } },
    e3: { type: 'bell', room: 'echoesFar', needs: ['bell'] },
    d4: { type: 'door', opens: { all: [{ drumOn: ['ball3', 'p3'] }, { lit: 'e3' }] }, latch: true },
    mother: { type: 'boss', room: 'hall', needs: ['backpack', 'bell'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

/** The held notes: how long the founders' bells hold their door and their stones (s). */
export const HOLD = { door: LOGIC.elements.e1.hold, stones: LOGIC.elements.e2.hold, stair: LOGIC.elements.e0.hold, chamber: LOGIC.elements.eT.hold };
/** How long the Cloud-Mother lies on a held stone she dived onto, crying (s): the bell calms her then. */
export const GROUNDED = 4.5;

export const MOTHER = {
  kind: 'organic', name: 'the Cloud-Mother', final: 'touch', touch: 'lay a hand on her brow',
  speed: 3.2, wakeTime: 3.4,
  wake: 'Something huge and pale turns over in the top of the tower: a sky-whale, her flanks full of cloud. She is afraid of you.',
  openHint: 'She sinks low and cries, a long sound like a bell with no clapper.',
  missHint: 'Her dive went wide and she ploughs into the floor, her fins caught under her: she lies there crying, a long sound like a bell with no clapper.',
  weary: 'She settles on the floor of her hall, her fins still. She is listening. Go to her.',
  resolved: 'She sighs, and the cloud along her back thins away. Far below the tower, something heavy comes down to rest.',
  phases: [
    { to: 0.5, attacks: ['gust', 'dive', 'wail'], pause: 1.8, hint: 'She cannot stay down, and she cannot stop crying. When she cries, sound the bell near her.' },
    { to: 0.7, attacks: ['roll', 'dive', 'gust'], pause: 1.4, hint: 'Her glyphs wake and she rolls in the air, her tail lashing. Answer her crying with the bell. The stones that fell up hang under her dome: ring as she rises to dive, and one comes down where she will dive.' },
    { to: 0.9, attacks: ['dive', 'rain', 'roll'], pause: 1.2, hint: 'The cloud along her back darkens and hails, and she no longer sinks to cry by herself. Ring as she rises to dive: a stone comes down under her, and when she lies on it, answer her crying with the bell.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    gust: { shape: 'cone', range: 14, angle: 0.55, wind: 1.3, track: 0.6, part: 'mouth', rig: 'swell', damage: 0.75, knock: 12, recover: 0.9 },
    // (a dive that misses you wedges her on the floor a while longer: missHint. In her last phase only a held stone
    // opens her, missed or not: motherOpen)
    dive: { shape: 'ring', at: 'player', radius: 4.6, wind: 1.6, track: 0.55, over: true, part: 'core', rig: 'rise', damage: 1, knock: 9, recover: 1.0, open: 3.0, miss: 4.4 },
    wail: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'mouth', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, damage: 0.75, knock: 11, recover: 0.8, open: 2.6 },
    roll: { shape: 'cone', range: 10, angle: 1.0, wind: 1.1, track: 0.6, part: 'wings', rig: 'coil', side: 1, damage: 0.75, knock: 11, recover: 0.6, then: 'tail' },
    tail: { shape: 'ring', at: 'self', radius: 7, wind: 0.75, part: 'tail', rig: 'coil', side: -1, link: true, damage: 0.5, knock: 9, gap: 0.25, then: 'wailEnd' },
    wailEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'mouth', rig: 'swell', pose: 'wail', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, damage: 0.75, knock: 11, recover: 0.8, open: 2.6 },
    rain: { shape: 'ring', at: 'player', lob: true, volley: 4, radius: 2, wind: 1.5, track: 0.6, part: 'core', rig: 'swell', damage: 0.5, knock: 6, recover: 0.6, then: 'diveEnd' },
    diveEnd: { shape: 'ring', at: 'player', radius: 4.6, wind: 1.3, track: 0.55, over: true, part: 'core', rig: 'rise', pose: 'dive', link: true, damage: 1, knock: 9, recover: 1.0, open: 3.0, miss: 4.4 },
  },
};

/** The fluid does not calm her (it only frightens her): the bell does (onBell). */
function motherHit(g, part, mode) {
  const rt = g.rt;
  if (mode === 'push') { g.add(-0.05, 'push'); rt.notice('She shies from the shove, crying louder. Gently.', 'mother.push'); return true; }
  if (g.state === 'open') rt.notice('The fluid only frightens her. She wants a sound: the bell.', 'mother.fluid');
  else rt.notice('She flinches from the splash.', 'mother.splash');
  return true;
}
/**
 * The bell-note whistle. Sounded near her while she cries: an eighth (then a tenth) of her calm. Sounded as she
 * rises to dive (a dive's wind-up): a stone that fell up comes down where she will dive, held while the note sounds.
 */
export function motherBell(g, pos) {
  if (!pos || !g.awake) return;
  const rt = g.rt, a = g.attack;
  if (g.state === 'fight' && a?.over && !g.struck && rt.hallStones) {
    if (rt.hallStones.drop(g, a)) rt.notice('The note brings a hanging stone down under her, and holds it there while it sounds.', 'mother.stone');
    return;
  }
  if (g.state !== 'open') {
    rt.notice(g.phaseIndex >= 2 ? 'She hears the note, and rises out of its reach.' : 'She hears the note, and turns her head. Sound it when she cries.', g.phaseIndex >= 2 ? 'mother.wait2' : 'mother.wait');
    return;
  }
  if (pos.distanceTo(g.model.pos) > 28) { rt.notice('She is too far to hear it. Get closer.', 'mother.far'); return; }
  g.add(g.phaseIndex === 0 ? 0.125 : 0.1, 'bell');
  if (g.state === 'open') { g.enter('fight'); g.cool = 2.2; }
}
/** A dive struck: onto a stone the bell holds under her, it takes her weight, and she lies on it. */
function motherStrike(g, a) {
  if (!a.over) return;
  const s = g.rt.hallStones?.landed(g, a);
  if (!s) return;
  g.grounded = true;
  g.rt.rumble?.(1.0, 0.5);
  g.rt.notice('She dives onto the held stone and it takes her weight: she lies on it, dazed, crying.', 'mother.grounded');
}
/** How long a combo's end leaves her open: on a held stone, a while; in her last phase, only there. */
function motherOpen(g, a, s) {
  if (g.grounded) { g.grounded = false; return Math.max(s, GROUNDED); }
  if (g.phaseIndex >= 2 && s) { g.rt.notice('She cries, and rises again at once, out of the bell’s reach.', 'mother.rises'); return 0; }
  return s;
}

/**
 * The stones that fell up into the Cloud-Mother's hall, hanging under its dome. A ring of the bell as she rises to
 * dive brings the nearest one down onto the spot she has picked (it follows the spot until she strikes) and holds it
 * there while the note sounds (HOLD.stones); then it falls up again. Calm, she lets them down for good.
 */
class HallStones {
  constructor(rt, o) {
    this.rt = rt; this.hold = o.hold ?? HOLD.stones;
    this.floorY = rt.kit.world(0, o.floor, 0).y;
    this.mat = makeMaterial({ color: PALETTE.stone, glow: 0.05, flat: true, key: 'temple.arzach2.hallstones' });
    this.list = o.at.map(([x, y, z, r], i) => {
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
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const stone = (x, y, z, r, i) => K.both(M.stone, T(new THREE.IcosahedronGeometry(r, 1), [x, y, z], [i, i * 2, 0], [1, 0.7, 1]));

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-12.2, 12.6, 12.2, 12.6, 0, 13, { t: 1.2, holes: [{ at: 12.2, w: 6, h: 7 }] });

  // ---- the Hall of Stones (z 12.6..44): a hub. The door on has two lamps; two archways, west and east, open
  // into the stone stores, a ball and its plate in each (out of sight of the door: you go and find them)
  K.hall({ x: 0, z: 28.3, w: 22, d: 31.4, y: 0, h: 13, roof: 'oculus', oculus: 0.25, columns: 3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.6 }, { side: 'w', at: -5.3, w: 4, h: 5.5 }, { side: 'e', at: -5.3, w: 4, h: 5.5 }] });
  add(Door, { id: 'd1', at: [0, 0, 44.6], w: 5, h: 6.6, lamps: [{ pressed: 'p1' }, { pressed: 'p2' }] });
  add(Mark, { room: 'stones', at: [-7.5, 0, 15.5], yaw: Math.PI / 2 });
  // stones that once fell up, heaped in the corners where somebody brought them back down
  [[-9, 0.6, 42, 0.9], [-8.2, 0.5, 40.6, 0.7], [9.1, 0.6, 15, 0.8], [8.4, 1.4, 15.6, 0.6]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i));
  // a dark line inlaid from each archway to the door's foot: the two lamps' two ways
  const inlay = (a, b, w, y, mat = M.dark) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    K.add(mat, T(new THREE.BoxGeometry(w, 0.04, L), [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], [0, yaw, 0]));
    return { L, yaw, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  };
  for (const sx of [-1, 1]) inlay([sx * 10.6, 23], [sx * 2.2, 43.2], 0.5, 0.02);
  // the stone stores: low rooms off the hall's sides, a groove, a ball and a plate in each
  const groove = (a, b) => {
    const { L, yaw, c } = inlay(a, b, 1.0, 0.02);
    for (const sd of [-1, 1]) K.both(M.trim, T(new THREE.BoxGeometry(0.25, 0.12, L), [c[0] + Math.cos(yaw) * sd * 0.75, 0.06, c[1] - Math.sin(yaw) * sd * 0.75], [0, yaw, 0]));
  };
  K.hall({ x: -17.7, z: 23, w: 11, d: 12, y: 0, h: 8, roof: 'oculus', oculus: 0.3, omit: ['e'], frieze: false });
  groove([-17.7, 19.6], [-17.7, 27]);
  add(Ball, { id: 'ball1', a: [-17.7, 0.04, 19.6], b: [-17.7, 0.04, 27], r: 1.0 });
  add(Plate, { id: 'p1', at: [-17.7, 0, 27], r: 1.2 });
  K.glyph([-23.15, 4.6, 23], 1.3, Math.PI / 2);
  [[-22, 0.6, 18.4, 0.8], [-21.4, 0.5, 19.6, 0.6]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i + 4));
  K.hall({ x: 17.7, z: 23, w: 11, d: 12, y: 0, h: 8, roof: 'oculus', oculus: 0.3, omit: ['w'], frieze: false });
  groove([15.4, 19.8], [21.2, 19.8]);
  add(Ball, { id: 'ball2', a: [15.4, 0.04, 19.8], b: [21.2, 0.04, 19.8], r: 1.3 });
  add(Plate, { id: 'p2', at: [21.2, 0, 19.8], r: 1.5 });
  K.glyph([23.15, 4.6, 25], 1.3, -Math.PI / 2);
  [[21.6, 0.6, 27.6, 0.9], [20.4, 0.5, 28.1, 0.6]].forEach(([x, y, z, r], i) => stone(x, y, z, r, i + 6));

  // ---- the corridor and the Stone Stair (a round well whose stair fell up: one great stone hangs at the top, by the
  // high door; a founders' bell low by the way in, and a ball in a groove into its mouth)
  K.slab(-3.2, 44, 3.2, 46.4, 0, 0.8);
  K.wall(-3.2, 44.6, -3.2, 46.4, 0, 6.6, { t: 0.8 }); K.wall(3.2, 46.4, 3.2, 44.6, 0, 6.6, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 7, 45.4));
  const C2 = 56.4;
  K.rotunda({ x: 0, z: C2, y: 0, r: 9, h: 25, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6, y0: 16.2 }], oculus: 0.35 });
  K.both(M.floor, box(7.2, 16, 3.2, 0, 8, C2 + 7.2));                    // the top landing, by the high door
  K.both(M.trim, box(7.4, 0.3, 3.4, 0, 16.05, C2 + 7.2));
  // the great stone: down while the bell rings, up again (with you) when it falls quiet
  add(FallUpStone, { id: 'lift', path: [[0, 0.3, C2 + 3.4], [0, 16.25, C2 + 3.4]], r: 2.2, held: { lit: 'e0' }, down: 3.2, up: 1.7 });
  K.both(M.dark, T(new THREE.CylinderGeometry(2.4, 2.6, 0.08, 8), [0, 0.04, C2 + 3.4]));   // where it comes to rest
  // the founders' bell, low by the way in, with no clapper: the ball's groove runs into its mouth
  const BX = -6.2, BZ = C2 - 3;
  const bellS = lathe([[0.02, 0], [1.4, 0.1], [1.5, 0.8], [1.05, 2.4], [0.85, 3.4], [0.02, 3.6]], 24);
  K.add(BRONZE(), T(bellS, [BX, 2.5, BZ]));
  K.add(M.trim, box(0.2, 19, 0.2, BX, 15.6, BZ));
  K.add(M.trim, T(new THREE.TorusGeometry(1.48, 0.08, 4, 28).rotateX(Math.PI / 2), [BX, 2.6, BZ]));
  K.add(M.dark, box(5.8, 0.04, 1.0, -3.6, 0.02, BZ));
  for (const sd of [-1, 1]) K.both(M.trim, box(4.4, 0.12, 0.25, -3.2, 0.06, BZ + sd * 0.75));
  add(Ball, { id: 'ballS', a: [-1.0, 0.04, BZ], b: [BX, 0.04, BZ], r: 1.0, strike: { at: [BX, 3.4, BZ] } });
  add(Plate, { id: 'pS', at: [BX, 0, BZ], r: 1.2 });
  add(BellEar, { id: 'e0', at: [BX, 1.6, BZ], reach: 6, heard: 'The founders’ bell booms, and high over the well the great stone comes down to the floor. It stays only while the bell sounds.', heardKey: 'e0.heard', fading: 'The bell’s hum is fading: the great stone stirs.' });
  add(Mark, { room: 'stair', at: [5, 0, C2 - 3], yaw: -Math.PI / 2 });
  // the high door, and its eye on the landing's face: under your feet once you are up, seen on the way
  add(Door, { id: 'd2', at: [0, 16.2, C2 + 9.7], w: 5, h: 6, lamps: [{ lit: 's1' }] });
  add(Switch, { id: 's1', at: [2.6, 12, C2 + 5.4], yaw: Math.PI, size: 1.0 });

  // ---- the corridor and the Bell Chamber (floor 16): the chest; its way on is open
  K.slab(-3.2, C2 + 9.6, 3.2, C2 + 12.4, 16, 0.8);
  K.wall(-3.2, C2 + 10.3, -3.2, C2 + 12.4, 16, 6.6, { t: 0.8 }); K.wall(3.2, C2 + 12.4, 3.2, C2 + 10.3, 16, 6.6, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 23, C2 + 11.4));
  const C3 = C2 + 22.4;   // 78.8
  K.rotunda({ x: 0, z: C3, y: 16, r: 10, h: 15, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 16, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 16.31, C3));
  // a bell hangs in the oculus, without a clapper: the whistle rings it, and three stones that fell up come down
  // round the dais while it sounds (a try: nothing is locked by it)
  const bell = lathe([[0.02, 0], [1.4, 0.1], [1.5, 0.8], [1.05, 2.4], [0.85, 3.4], [0.02, 3.6]], 24);
  K.add(BRONZE(), T(bell, [0, 26, C3]));
  K.add(M.trim, box(0.2, 4, 0.2, 0, 31.5, C3));
  add(BellEar, { id: 'eT', at: [0, 26, C3], reach: 14, heard: 'The bell in the oculus hums with your note, and three of the stones that fell up come down round the dais. They stay only while it sounds.', heardKey: 'eT.heard', fading: 'The hum is fading: the stones tremble.' });
  add(Bridge, { id: 'heap', a: [-6.4, 16.6, C3 - 3.2], b: [-6.4, 16.6, C3 + 3.2], w: 2.4, n: 3, from: 'above' });
  add(Mark, { room: 'bell', at: [6.2, 16, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Bell Porch (floor 16), a room on: the door into the Hall of Echoes is held by the porch's own bell
  const A0 = C3 + 11.4;   // 90.2
  K.slab(-3.2, C3 + 9.6, 3.2, A0 + 0.6, 16, 0.8);
  K.hall({ x: 0, z: A0 + 6, w: 12, d: 12, y: 16, h: 10, roof: 'oculus', oculus: 0.35, omit: ['n'], doors: [{ side: 's', w: 5, h: 6.4 }] });
  const bellP = lathe([[0.02, 0], [1.1, 0.08], [1.2, 0.65], [0.85, 1.9], [0.7, 2.7], [0.02, 2.9]], 24);
  K.add(BRONZE(), T(bellP, [0, 22.6, A0 + 6]));
  K.add(M.trim, box(0.2, 1.6, 0.2, 0, 26.2, A0 + 6));
  add(BellEar, { id: 'e1', at: [0, 23, A0 + 6], reach: 8.5, heard: 'The porch’s bell hums with your note, and the door sinks. It stands open only while the bell sounds.', heardKey: 'e1.heard', fading: 'The bell’s hum is fading. The door will rise again.' });
  add(Mark, { room: 'bell', at: [-4, 16, A0 + 4], yaw: Math.PI / 2 });

  // ---- the Hall of Echoes (z 103..137): a chasm under a bridge of stones that fell up
  const E0 = A0 + 12 + 1.2;   // 103.4
  K.slab(-3.2, E0 - 1.6, 3.2, E0 + 0.6, 16, 0.8);
  add(Door, { id: 'd3', at: [0, 16, E0 - 0.6], w: 5, h: 6.4, bell: true, lamps: [{ lit: 'e1' }] });
  K.hall({ x: 0, z: E0 + 17.2, w: 22, d: 34.4, y: 6, h: 22, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 10 }, { side: 'n', w: 5, h: 6.4, y0: 10 }] });
  K.slab(-11, E0, 11, E0 + 6, 16, 10);
  K.slab(-11, E0 + 26, 11, E0 + 34.4, 16, 10);
  K.both(M.dark, box(22, 1, 20, 0, 5.5, E0 + 16));
  add(Pit, { room: 'echoes', min: [-12, 2, E0 + 6], max: [12, 12.5, E0 + 26] });
  // the stones come down while the bell rings, and fall up again when it stops; a ball's weight on the far
  // plate holds them down for good. The ball's groove runs from the near edge over the bridge to that plate.
  add(Bridge, { id: 'br1', a: [0, 16, E0 + 5.9], b: [0, 16, E0 + 26.1], w: 6, n: 8, from: 'above' });
  add(BellEar, { id: 'e2', at: [0, 16, E0 + 4], reach: 32, heard: 'The hanging stones answer the note and come down into a bridge. They stay only while it sounds.', heardKey: 'e2.heard', fading: 'The note is fading: the stones begin to tremble.' });
  const BA = [1.6, 16.04, E0 + 2.6], BB = [1.6, 16.04, E0 + 30.5], BL = BB[2] - BA[2];
  add(Ball, { id: 'ball3', a: BA, b: BB, r: 1.0, friction: 0.2, lock: true, gap: { bridge: 'br1', from: (E0 + 5.9 - BA[2]) / BL, to: (E0 + 26.1 - BA[2]) / BL } });
  add(Plate, { id: 'p3', at: [1.6, 16, E0 + 30.5], r: 1.2 });
  for (const [z0, z1] of [[BA[2] - 1.2, E0 + 5.9], [E0 + 26.1, BB[2]]]) {
    K.add(M.dark, box(1.0, 0.04, z1 - z0, 1.6, 16.02, (z0 + z1) / 2));
    for (const sd of [-1, 1]) K.both(M.trim, box(0.25, 0.12, z1 - z0, 1.6 + sd * 0.75, 16.06, (z0 + z1) / 2));
  }
  add(Door, { id: 'd4', at: [0, 16, E0 + 35], w: 5, h: 6.4, bell: true, lamps: [{ drumOn: ['ball3', 'p3'] }, { lit: 'e3' }] });
  add(BellEar, { id: 'e3', at: [-1.8, 16, E0 + 32], reach: 9 });
  add(Mark, { room: 'echoes', at: [-7, 16, E0 + 3], yaw: 0 });
  for (let i = 0; i < 4; i++) K.glyph([-10.95, 22 + (i % 2) * 2, E0 + 6 + i * 6], 1.3, Math.PI / 2);

  // ---- the corridor, and the Cloud-Mother's hall (a great rotunda, open to the sky)
  const H0 = E0 + 35;      // 125.2
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 16, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 16, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 16, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 23.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 16, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 21, CH = H0 + 3.2 + HR + 1.4;   // 150.8
  K.rotunda({ x: 0, z: CH, y: 16, r: HR, h: 26, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.5 });
  for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * TAU; K.column(Math.sin(a) * (HR - 2.2), CH + Math.cos(a) * (HR - 2.2), 16, 26, 0.9); }
  add(Door, { id: 'd5', at: [0, 16, CH + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CH + HR + 0.6, 3.2, CH + HR + 10, 16, 0.8);
  K.wall(-3.2, CH + HR + 1.4, -3.2, CH + HR + 10, 16, 7, { t: 0.8 }); K.wall(3.2, CH + HR + 10, 3.2, CH + HR + 1.4, 16, 7, { t: 0.8 });
  K.wall(3.2, CH + HR + 10, -3.2, CH + HR + 10, 16, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 23.4, CH + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 16, CH + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, 18.5, CH + HR + 10.9));

  // stones that fell up, hanging under the dome: a ring as she rises to dive brings one down (HallStones)
  add(HallStones, { floor: 16, at: [[-9, 33, CH - 4, 1.5], [8, 35, CH + 3, 1.7], [-2, 37, CH + 10, 1.4], [6, 34, CH - 9, 1.3]] });

  const model = whaleModel();
  model.pos.copy(K.world(0, 16, CH + 6));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(-4, 16, CH + 4);
  model.restHeading = K.heading(Math.PI * 0.85);
  const arena = { center: K.world(0, 16, CH), r: HR, y: K.world(0, 16, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-26, -2, -3), V(26, 60, CH + HR + 12)),
    gadget: { at: W(0, 16.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 16.5, CH + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 14], [0, 7, 22, 18], [0, 7, 38, 18], [-17.7, 5, 23, 11], [17.7, 5, 23, 11], [0, 8, C2, 16], [0, 20, C3, 16], [0, 21, A0 + 6, 12], [0, 22, E0 + 10, 20], [0, 22, E0 + 28, 18], [0, 22, CH, 30]],
    guardian: { def: { ...MOTHER, onHit: motherHit, onStrike: motherStrike, openFor: motherOpen, onReset: (g) => { g.grounded = false; rt.hallStones?.reset(); } }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Founders' Belfry over the cloud
function exterior(scene, level, rt) {
  const yaw = SITE.heading, base = -70, door = 40.3;
  const K = new TempleKit(rt.root, 'The Founders’ Belfry', V(SITE.x, 0, SITE.z), yaw, rt.M);
  const M = rt.M, R = 15;
  const rose = { paint: new THREE.Color(PALETTE.accent), smooth: true };
  // a round tower out of the cloud: a fluted shaft, a gallery ring at the door, an open belfry on top
  // (the shaft's own lathe collides: a straight cylinder stood out from its waist and sank into its foot)
  K.both(M.wall, lathe([[R + 3, base], [R + 1, base + 30], [R, door - 6], [R, door + 34], [R + 2.4, door + 35], [R + 2.4, door + 36.5], [R - 0.5, door + 37]], 40));
  K.both(M.floor, T(annulus(R - 0.5, R + 5, 1.2, 48), [0, door, 0]));                                 // the gallery round the door
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue; K.both(M.trim, T(new THREE.BoxGeometry(0.4, 1.0, 0.4), [Math.sin(a) * (R + 4.7), door + 0.5, Math.cos(a) * (R + 4.7)])); }
  // the belfry: eight piers, a dome of rose stone, a great bell inside
  const B0 = door + 37;
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; K.both(M.wall, T(new THREE.BoxGeometry(3, 16, 3), [Math.sin(a) * (R - 2), B0 + 8, Math.cos(a) * (R - 2)], [0, a, 0])); }
  K.both(M.wall, T(annulus(4, R + 1, 1.4, 40), [0, B0 + 17.4, 0]));
  K.both(rose, new THREE.SphereGeometry(R, 32, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, B0 + 17, 0));
  K.add(M.trim, lathe([[2.6, 0], [2.6, 1], [1.8, 1.4], [0.01, 2.2]], 16).translate(0, B0 + 17 + R * 0.6 - 0.4, 0));
  K.both(BRONZE(), T(lathe([[0.02, 0], [5, 0.3], [5.4, 3], [3.8, 8.5], [3.1, 12], [0.02, 12.8]], 32), [0, B0 + 2, 0]));
  K.add(M.dark, box(0.6, 3.4, 0.6, 0, B0 + 15.5, 0));
  // glyphs round the shaft, between flutes
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU; K.add(M.glyph, T(glyphGeometry(2.4, 0.14), [Math.sin(a) * (R + 0.06), door + 18, Math.cos(a) * (R + 0.06)], [0, a, 0])); }
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
  K.flush();
  const at = K.world(0, door, R + 1.6);
  const front = K.world(0, door, R + 9);
  return { door: { at, heading: yaw }, kit: K, base, doorY: door, R, top: B0 + 30, hang, clear: [] , front };
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

export const ARZACH2_TEMPLE = {
  id: 'arzach2', levelId: 'arzach2', name: 'The Founders’ Belfry', doorLabel: 'door of the Founders’ Belfry',
  gadget: 'bell', gadgetBox: 'arzach2.temple.bell', arenaDoor: 'd4',
  origin: [80, 1600, 150], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'ysel', out: 29, side: 3.5 },   // (src/temples/index.js: who stands by the door and points you in)
  enterLine: 'Inside the belfry the air is still and white, and somewhere above, something huge is crying.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Far below the tower, the stones that fell up round the belfry begin to come down.', 'resolved.out'); },
  // her calm comes from the bell: every 'bell' the whistle sounds, she hears
  onConnect(rt) { rt.offs.push(rt.game.on('bell', ({ pos, soft } = {}) => { if (!soft && rt.guardian?.awake) motherBell(rt.guardian, pos); })); },
};
