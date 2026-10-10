import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus, sector } from './kit.js';
import { Door, Plate, Ball, Switch, Platform, Bridge, Vane, Iris, Mark, Pit } from './pieces.js';
import { sentinelModel } from './guardians.js';
import { items } from '../items.js';
import { registerTarget } from '../targets.js';

// The City-Shaft's temple: the Warden's Well, the makers' tower on the rim,
// round from the ship. Nobody in the city goes in: the rim calls it a folly,
// the bottom says the makers built it to keep the shaft breathing. Inside it
// goes up, not down: a well of the makers turned on its end, room over room.
// Something still walks its top hall, round and round: the warden the makers
// left to keep the shaft's breath, broken since the night the sky rang. It is
// a machine: you may stop it for good.
//
// Inside (built far overhead, through its door), one idea from the first room to the last: THE TOWER BREATHES
// THROUGH ITS VANES (reworked from the temple design audit, v1.19). The makers built it to keep the shaft breathing,
// and the breath turned the vanes of their bellows, and the vanes turned the tower's machines. The warden stopped the
// breath. A vane still drives its machine, but only while it turns: a splash spins a small one a while, slowing; a
// great one is too heavy for a splash, and turns only under a steady wind. With the jets, you are the wind.
//   the Threshold          the first mark, the way back out
//   the Turning Floors     a drop crossed on two riding discs that ride only while the small vane over the far door
//                          turns: splash it, and go before it slows (the vane, taught where failing costs a wait)
//   the Climb              a round well: climb its wall to the balcony. The stone ball's groove there crosses a slot
//                          whose stones stand only while the vane in the well's floor, far below, turns: splash it,
//                          then roll the ball over the slot before it stops (the vane with the push)
//   the Jets' Chamber      the makers' chest: the FLUID JETS (src/items.js 'jetpack'). The only way on is up,
//                          through the oculus in its ceiling: the jets are the key
//   the Lamp Gallery       a tall drum over the chamber, banded in steel blue, slit windows, shelves with carved eyes
//                          over them. An iris in its ceiling opens on the eye over the west shelf, hidden from the
//                          floor, its stone lids shut: they lift only while the great vane in the floor turns, and
//                          that is too heavy for a splash. Hover over it on the jets (aim: they hold you) and it
//                          turns; the lids lift; splash the eye from the air
//   the loft               over the iris: a shelf high on the east wall, its ball, a gap in the shelf whose stones
//                          stand only while the loft's great vane turns. Land on the shelf and the ball stops at the
//                          gap; hover over the vane, and push the ball across from the air (the jets with the push);
//                          on its plate it opens a second iris over the loft
//   the crown              the top of the drum, the high door to the warden: its eye's lids lift only while two vanes
//                          turn at once, a great one in the crown's floor (the jets) and a small one that is not
//                          here: it stands on a post in the loft below, seen down through the second iris (a splash:
//                          it slows). Splash the small one, fly up to the great one and hover, and splash the eye
//                          before the small one stops
//   the Warden's Hall      the sentinel (a robot: its meter is damage). It beams and slams; its side vents open after
//                          a beam: shoot them. Then it guards its sides and only the hatch on its crown is open: fly
//                          above it, and shoot down; over a turning vane the draught holds the hatch wide (a hit
//                          counts twice). In its last phase it keeps the hatch shut against still air: when it backs
//                          onto a vane, hover over the vane until its draught lifts the hatch, and shoot down into it
// After: the warden's hum stops, and the shaft's old breath comes back: a column of rising air from
// the bottom terrace to the rim, beside the Upward Shrine, that carries anyone up (the world change).
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** The tower on the rim (world x, z), its door toward the ship. */
export const SITE = { x: 322, z: -80, r: 22 };
SITE.heading = Math.atan2(274 - SITE.x, 0 - SITE.z);
/** The shaft's breath once the warden is stopped: a rising column from the bottom terrace to the rim. */
export const BREATH = { a: 2.85, r: 197, bottom: -290, top: 200, R: 260, radius: 4.5 };

export const PALETTE = {
  wall: '#f1e6cf', wall2: '#e6cfae', wall3: '#f6efe0', floor: '#d6c6a8', floor2: '#c9b596', trim: '#f3ead8',
  dark: '#34405e', stone: '#9fb2c6', accent: '#25386c', glow: '#9fdcef', lamp: '#f6c84e', sand: '#cdb38e', sand2: '#c9b596',
};

/**
 * The vanes: how long a splash spins a small one (s: the Turning Floors' across both discs, the Climb's over the
 * slot, the crown's while you fly up from the loft to the crown's great vane), how far over a great one the jets' wash turns it (m); the
 * gallery's ceiling over its floor, the loft's shelf over the ceiling, the crown's floor over the gallery's (m) and
 * the two irises' radii; the hall's four vanes, how far from its middle (m), how near the warden must stand to
 * one for its draught to reach the hatch (m), how near it backs onto one when its hatch opens (m) and how fast (m/s),
 * what a hit in the crown is worth (plain, over a turning vane; in its last phase only over a turning vane), and how
 * long its hatch stays up in its last two phases (s: time to fly to the vane and hover).
 */
export const VANES = { floors: 15, climb: 14, reach: 9.5, ceil: 15, shelf: 6, iris: 5.6, crown: 24, iris2: 7, small: 15 };
export const HALL = { vane: 10, reach: 13, near: 8, back: 5, drift: 2.2, hit: 0.125, washed: 0.25, open: [null, 5.5, 7] };

export const LOGIC = {
  id: 'incal', entry: 'threshold', gadget: 'jetpack',
  rooms: { threshold: { checkpoint: true }, turning: { checkpoint: true }, climb: { checkpoint: true }, jets: { checkpoint: true }, gallery: { checkpoint: true }, loft: { checkpoint: true }, crown: { checkpoint: true }, warden: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'turning' },
    { a: 'turning', b: 'climb', door: 'discs' },    // the riding discs, only while the vane over the far door turns
    { a: 'climb', b: 'jets', door: 'd1' },          // the ball on its plate, rolled over the slot while the well's vane turned
    { a: 'jets', b: 'gallery', needs: ['jetpack'] }, // up through the oculus
    { a: 'gallery', b: 'loft', door: 'iris' },      // the iris in the gallery's ceiling: the eye whose lids the great vane lifts
    { a: 'loft', b: 'crown', door: 'iris2' },       // the ball pushed over the gap from the air, over the loft's vane
    { a: 'crown', b: 'warden', door: 'd3' },         // the eye whose lids lift only while two vanes turn at once
    { a: 'warden', b: 'out', door: 'd5' },
  ],
  elements: {
    // the Turning Floors: the small vane over the far door (a splash spins it a while); the discs ride while it turns
    v1: { type: 'vane', room: 'turning' },
    discs: { type: 'bridge', opens: { lit: 'v1' } },
    // the Climb: the vane in the well's floor stands the slot's stones; the ball over them onto its plate
    v2: { type: 'vane', room: 'climb' },
    slot: { type: 'bridge', opens: { lit: 'v2' } },
    ball1: { type: 'drum', room: 'climb', plate: 'p1', plateAt: 1, start: 0, gap: 'slot' },
    p1: { type: 'plate', room: 'climb' },
    d1: { type: 'door', opens: { pressed: 'p1' }, latch: true },
    chest: { type: 'gadget', room: 'jets', item: 'jetpack' },
    // the gallery: the great vane (only the jets' wash turns it) lifts the lids of the eye over the west shelf
    vG: { type: 'vane', room: 'gallery', needs: ['jetpack'] },
    s2: { type: 'switch', room: 'gallery', when: { lit: 'vG' } },
    iris: { type: 'door', opens: { lit: 's2' }, latch: true },
    // the loft: the great vane stands the gap's stones; the ball pushed over them (from the air) onto its plate
    vE: { type: 'vane', room: 'loft', needs: ['jetpack'] },
    span: { type: 'bridge', opens: { lit: 'vE' } },
    ball3: { type: 'drum', room: 'loft', plate: 'p3', plateAt: 1, start: 0, gap: 'span' },
    p3: { type: 'plate', room: 'loft' },
    iris2: { type: 'door', opens: { pressed: 'p3' }, latch: true },
    // the crown: the eye by the high door lifts its lids only while the small vane (splashed) and the great vane
    // (hovered over) turn at once: the small one first, it slows while you fly. The small one is in the loft below, on a
    // post under the second iris: seen from the crown, splashed from the loft (or down through the iris)
    vS: { type: 'vane', room: 'loft' },
    vC: { type: 'vane', room: 'crown', needs: ['jetpack'] },
    s4: { type: 'switch', room: 'crown', when: { all: [{ lit: 'vS' }, { lit: 'vC' }] } },
    d3: { type: 'door', opens: { lit: 's4' }, latch: true },
    // the hall's four vanes: in its last phase its hatch opens only to one's draught
    warden: { type: 'boss', room: 'warden', needs: ['backpack', 'jetpack'], requires: { any: [0, 1, 2, 3].map((i) => ({ lit: `vh${i}` })) } },
    vh0: { type: 'vane', room: 'warden', needs: ['jetpack'] },
    vh1: { type: 'vane', room: 'warden', needs: ['jetpack'] },
    vh2: { type: 'vane', room: 'warden', needs: ['jetpack'] },
    vh3: { type: 'vane', room: 'warden', needs: ['jetpack'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const WARDEN = {
  kind: 'robot', name: 'the warden', final: 'break', speed: 1.8, wakeTime: 2.6,
  wake: 'The machine in the hall unfolds on its three legs. Its lamp-eye finds you, and turns red.',
  openHint: 'Its vents open, glowing. Hit them.',
  resolved: 'The warden sags on its legs. Its eye goes dark, and the hum in the walls stops. Then, far below, a sound like breathing.',
  missHint: 'Its slam went wide and it rocks on its legs, venting: its vents open, glowing.',
  phases: [
    { to: 0.5, attacks: ['beam', 'mortar', 'stomp'], pause: 1.6, hint: 'Its eye burns before it fires: keep out of its line. When its side vents open, shoot them.' },
    { to: 0.75, attacks: ['stomp', 'sweepBeam', 'mortar'], pause: 1.3, hint: 'It shuts its sides, and its eye sweeps the hall. Only the hatch on its crown opens now: get above it, and shoot down. It backs toward a vane in the floor: over a turning vane the draught holds its hatch wide, and a hit counts twice.',
      openHint: 'The hatch on its crown swings up, glowing, and it backs toward a vane. Get above it and shoot down: hover over the vane and the draught holds the hatch wide.' },
    { to: 1.0, attacks: ['flare', 'beam', 'mortars'], pause: 1.1, hint: 'Cracks glow along its hull, and it keeps its hatch shut against still air. When it backs onto a vane, hover over the vane with the jets until the draught lifts the hatch, then shoot down into it.',
      openHint: 'It backs onto a vane, its hatch shut tight against still air. Hover over the vane with the jets: its draught lifts the hatch. Then shoot down into it.' },
  ],
  attacks: {
    beam: { shape: 'lane', range: 28, width: 2.6, wind: 1.4, track: 0.7, part: 'eye', rig: 'lean', damage: 1, knock: 10, recover: 0.8, open: 2.8 },
    sweepBeam: { shape: 'cone', range: 24, angle: 0.9, wind: 1.5, track: 0.6, part: 'eye', rig: 'coil', side: 1, damage: 0.75, knock: 10, recover: 0.8, open: 2.8 },
    mortar: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.4, wind: 1.4, track: 0.6, part: 'head', rig: 'swell', damage: 0.75, knock: 8, recover: 0.6 },
    mortars: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.4, wind: 1.4, track: 0.6, part: 'head', rig: 'swell', pose: 'mortar', damage: 0.5, knock: 6, recover: 0.6 },
    stomp: { shape: 'ring', at: 'front', ahead: 4, radius: 4, wind: 1.0, part: 'feet', rig: 'rear', damage: 0.75, knock: 9, recover: 0.4, then: 'stomp2' },
    stomp2: { shape: 'ring', at: 'front', ahead: 4, radius: 4, wind: 0.7, part: 'feet', rig: 'rear', pose: 'stomp', link: true, damage: 0.75, knock: 9, gap: 0.25, then: 'slam' },
    slam: { shape: 'ring', at: 'self', radius: 6, wind: 1.3, part: 'feet', rig: 'rear', link: true, wave: { speed: 9, reach: 18, width: 0.7, damage: 0.5 }, damage: 1, knock: 13, recover: 1.0, open: 3.0 },
    flare: { shape: 'ring', at: 'self', radius: 4.5, reachUp: 9, wind: 1.2, part: 'head', rig: 'swell', damage: 0.75, knock: 10, recover: 0.6, then: 'slam' },
  },
};

/** The hall vane whose draught reaches the warden's hatch now (turning, near it), or null. */
export function draught(rt, g = rt.guardian) {
  if (!g || !rt.hallVanes) return null;
  return rt.hallVanes.find((v) => v.turning && Math.hypot(v.center.x - g.model.pos.x, v.center.z - g.model.pos.z) < HALL.near) ?? null;
}

/**
 * The warden's vents: open, they take a shot; guarded (its second phase on), only the crown hatch, from above, and
 * over a turning vane its draught holds the hatch wide (twice as much); in its last phase only then.
 */
function wardenHit(g, part, mode) {
  const rt = g.rt, P = rt.player;
  if (mode === 'push') { rt.notice('The shove only rings off its hull.', 'warden.push'); return true; }
  if (part !== 'mouth') { if (g.state === 'fight') rt.notice('The fluid splashes off its hull. Wait for its vents to open.', 'warden.hull'); return true; }
  if (g.state !== 'open') { rt.notice('Its vents are shut. Wait for them to open.', 'warden.shut'); return true; }
  if (g.phaseIndex >= 1 && P && P.pos.y < g.model.mouth.y - 1.2) { rt.notice('From down here you only hit its shut sides. Get above it.', 'warden.above'); return true; }
  const wind = g.phaseIndex >= 1 && !!draught(rt, g);
  if (g.phaseIndex >= 2 && !wind) { rt.sound?.critter?.('clack', 0.8); rt.notice('Its hatch slams shut as the shot comes: in still air it will not open. Hover over the vane it stands by, so the draught lifts the hatch.', 'warden.still'); return true; }
  g.add(wind && g.phaseIndex === 1 ? HALL.washed : HALL.hit, wind ? 'draught' : 'vent');
  if (wind) rt.notice('The draught off the vane holds its hatch wide, and the shot goes deep. It staggers.', `warden.draught.${g.phaseIndex}`);
  rt.sound?.critter?.('clank', 1);
  rt.rumble?.(0.4, 0.35);
  return true;
}
/** In its last two phases its hatch stays up a little longer: time to fly to the vane and hover. */
function wardenOpenFor(g, a, s) { const o = HALL.open[Math.min(g.phaseIndex, 2)]; return s && o ? Math.max(s, o) : s; }
/** What the jets are for, said a moment after the box's card closes in the Jets' Chamber. */
export const JETS_NEXT = 'The jets hum on your back. Straight overhead the chamber’s ceiling is open: their thrust ({key:thrust}), without aiming, lifts you straight up through it. Tip the nose forward at the top to level out.';

/** Are you past the oculus? (in the gallery or beyond: its mark, an eye lit, the warden met, or simply up there) */
export function jetsUsed(rt) {
  const cp = rt.game.flag(`temple.${rt.id}.checkpoint`);
  if (cp === 'gallery' || cp === 'hall' || rt.logic.resolved || ['s2', 's3', 's4'].some((id) => rt.logic.isLit(id))) return true;
  const P = rt.player;
  return !!P?.pos && rt.inside(P.pos) && rt.kit.local(P.pos).y > 34;
}

/**
 * After the jets: the way on, shown. A column of pale rings rises from the chest's plinth up through
 * the oculus into the gallery, where the jets take you; a moment after the box's card a line says what
 * to do with them, and the drone flies up and points (main.js 'scout:ping'). It fades once you're up.
 */
class JetGuide {
  constructor(rt, { from, to, r }) {
    this.rt = rt;
    this.foot = rt.kit.world(...from);
    this.h = to - from[1];
    this.root = new THREE.Group();
    this.root.name = 'The way up (after the jets)';
    rt.root.add(this.root);
    this.mat = makeMaterial({ color: '#bfe6f2', flat: true, glow: 0.7, key: 'incal.temple.guide' });
    const g = new THREE.TorusGeometry(r, 0.07, 4, 36).rotateX(Math.PI / 2);
    this.rings = Array.from({ length: 10 }, (_, i) => { const m = new THREE.Mesh(g, this.mat); m.userData.noCollide = true; this.root.add(m); return { m, s: i / 10 }; });
    this.root.visible = false;
    this.k = 0; this.since = 0; this.told = false;
  }
  get wanted() { return this.rt.logic.gadget && !jetsUsed(this.rt); }
  update(dt, t) {
    const rt = this.rt, want = this.wanted;
    this.k = THREE.MathUtils.clamp(this.k + (want ? dt / 1.2 : -dt / 0.8), 0, 1);
    this.root.visible = this.k > 0.01;
    // a moment after the chest (its card closes first): what the jets are for, and the drone shows where
    if (want && !this.told && rt.player?.pos && rt.inside(rt.player.pos)) {
      if ((this.since += dt) > 1.2) {
        this.told = true;
        rt.notice(JETS_NEXT, 'jets.next');
        rt.quests?.track?.(`temple.${rt.id}`);
        rt.game.emit('scout:ping', { why: 'jets' });
      }
    }
    if (!this.root.visible) return;
    for (const r of this.rings) {
      r.s = (r.s + dt * 0.22) % 1;
      r.m.position.set(this.foot.x, this.foot.y + r.s * this.h, this.foot.z);
      const fade = Math.min(1, r.s * 6, (1 - r.s) * 5) * this.k;
      r.m.scale.setScalar(Math.max(0.01, fade * (0.85 + 0.15 * Math.sin(t * 2.4 + r.s * 12))));
    }
    if (this.mat.uniforms?.uGlow) this.mat.uniforms.uGlow.value = (0.45 + 0.25 * Math.sin(t * 3)) * this.k;
  }
  dispose() { this.root.removeFromParent(); }
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const rotA = (a) => Math.PI / 2 - a;    // rotunda angle (0 = +z, toward +x) -> sector angle (0 = +x, toward +z)

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });

  // the makers' steel blue, banding the drums (after the picked reference: references/temples/wardens-well/sheet-1.jpg)
  const blue = { paint: new THREE.Color('#7d93c4'), smooth: false, side: THREE.FrontSide };
  const slitM = makeMaterial({ color: '#fff0c8', glow: 0.75, flat: true, key: 'incal.temple.slit' });
  /** A band round a drum's inside wall (r, at y), with the makers' frieze on it: three dots over an upward arc. */
  const band = (x, z, r, y, h = 1.3, every = 0.26, skip = []) => {
    K.add(blue, T(annulus(r - 0.14, r + 0.04, h, 72), [x, y + h / 2, z]));
    for (let a = 0; a < TAU - 0.01; a += every) {
      if (skip.some(([c, w]) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < w)) continue;
      const px = x + Math.sin(a) * (r - 0.16), pz = z + Math.cos(a) * (r - 0.16);
      for (const [dx, dy] of [[-0.24, 0.22], [0, 0.32], [0.24, 0.22]]) K.add(M.trim, T(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 8).rotateX(Math.PI / 2), [px - Math.cos(a) * dx, y + dy, pz + Math.sin(a) * dx], [0, a, 0]));
      K.add(M.trim, T(new THREE.TorusGeometry(0.34, 0.04, 3, 10, Math.PI), [px, y - 0.28, pz], [0, a, 0]));
    }
  };
  /** A tall slit window of warm light on a drum's inside wall, pointed at the top. */
  const slit = (x, z, r, a, y, h) => {
    const px = x + Math.sin(a) * (r - 0.05), pz = z + Math.cos(a) * (r - 0.05);
    K.add(slitM, T(new THREE.BoxGeometry(0.6, h, 0.06), [px, y + h / 2, pz], [0, a, 0]));
    K.add(slitM, T(new THREE.BoxGeometry(0.43, 0.43, 0.06), [px, y + h, pz], [0, a, Math.PI / 4], 1, 'YXZ'));
  };

  // ---- the Turning Floors (z 12.6..46): a drop, an island, two riding discs that ride while the vane over the far
  // door turns (a splash spins it; it slows, and stops)
  K.wall(-13.2, 12.6, 13.2, 12.6, -14, 32, { t: 1.2, holes: [{ at: 13.2, w: 6, h: 7, y0: 14 }] });
  K.hall({ x: 0, z: 29.3, w: 24, d: 33.4, y: -14, h: 32, floor: false, roof: 'oculus', oculus: 0.22, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6, y0: 14 }] });
  K.slab(-12, 12.6, 12, 18, 0, 14);
  K.slab(-12, 40, 12, 46, 0, 14);
  K.both(M.stone, lathe([[2.4, -14], [2.4, -0.6], [2.8, -0.3], [2.8, 0.01], [0.01, 0.01]], 20).translate(0, 0, 29), new THREE.CylinderGeometry(2.6, 2.6, 14, 14).translate(0, -7, 29));
  K.both(M.dark, box(24, 1, 22, 0, -14.5, 29));
  add(Pit, { room: 'turning', min: [-13, -16, 18], max: [13, -4, 40] });
  // (the far disc starts at the far side: one splash, and the two meet you at the island together)
  add(Platform, { path: [[0, 0, 20.3], [0, 0, 24.3]], r: 2.2, speed: 1.6, pause: 1.4, when: { lit: 'v1' } });
  add(Platform, { path: [[0, 0, 33.6], [0, 0, 37.8]], r: 2.2, speed: 1.6, pause: 1.4, phase: 1, when: { lit: 'v1' } });
  add(Vane, { id: 'v1', at: [0, 9.5, 45.82], wall: true, yaw: Math.PI, r: 1.9, coast: VANES.floors,
    turning: 'The vane over the far door spins, and below it the discs wake and ride. Already it is slowing.',
    fading: 'The vane is slowing: the discs will stop with it.' });
  K.add(blue, T(annulus(2.3, 2.75, 0.3, 32).rotateX(Math.PI / 2), [0, 9.5, 45.95]));
  add(Mark, { room: 'turning', at: [-4.8, 0, 15.2], yaw: Math.PI / 2 });
  for (let i = 0; i < 4; i++) K.glyph([-11.95, 4 + i * 2.6, 22 + i * 5], 1.2, Math.PI / 2);
  for (let i = 0; i < 3; i++) { K.add(slitM, box(0.06, 7, 0.6, 11.9, 6.5, 20 + i * 9)); K.add(slitM, T(new THREE.BoxGeometry(0.06, 0.43, 0.43), [11.9, 10, 20 + i * 9], [Math.PI / 4, 0, 0])); }

  // ---- the corridor and the Climb (a round well, floor at 0, the balcony at 11)
  K.slab(-3.2, 46, 3.2, 48.4, 0, 0.8);
  K.wall(-3.2, 46.6, -3.2, 48.4, 0, 6.5, { t: 0.8 }); K.wall(3.2, 48.4, 3.2, 46.6, 0, 6.5, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.9, 47.4));
  const C2 = 58.6;
  K.rotunda({ x: 0, z: C2, y: 0, r: 9, h: 26, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6, y0: 11 }], oculus: 0.35 });
  band(0, C2, 9, 17.5, 1.1, 0.4, [[0, 0.4]]);
  // the north half of the well is a block of stone eleven metres high: climb its straight face to the top
  K.both(M.wallGlyph, T(sector(0.01, 9.2, rotA(0) - Math.PI / 2, rotA(0) + Math.PI / 2, 11), [0, 11, C2]));
  K.add(M.trim, box(18.2, 0.3, 0.5, 0, 11.05, C2 + 0.1));   // its lip
  for (let i = 0; i < 4; i++) K.add(M.trim, box(3.2, 0.22, 0.3, (i % 2 ? 1.6 : -1.6), 2.4 + i * 2.2, C2 - 0.12));   // handholds up the face
  // the ball's groove along the balcony, to the plate by the north door; a slot across it near its start, whose
  // stones stand only while the vane in the well's floor turns (splash it from up here, or before you climb)
  const S0 = -3.8, S1 = 2.6, SL = [-2.75, -0.85];
  K.add(M.dark, box(SL[0] - S0 + 0.45, 0.04, 0.9, (S0 - 0.45 + SL[0]) / 2, 11.02, C2 + 6.4));
  K.add(M.dark, box(S1 + 0.45 - SL[1], 0.04, 0.9, (SL[1] + S1 + 0.45) / 2, 11.02, C2 + 6.4));
  K.add(M.voidM, box(SL[1] - SL[0], 0.02, 1.5, (SL[0] + SL[1]) / 2, 11.01, C2 + 6.4));
  add(Bridge, { id: 'slot', a: [SL[0], 11.06, C2 + 6.4], b: [SL[1], 11.06, C2 + 6.4], w: 1.5, n: 2 });
  add(Ball, { id: 'ball1', a: [S0, 11.04, C2 + 6.4], b: [S1, 11.04, C2 + 6.4], r: 0.9,
    gap: { bridge: 'slot', from: (SL[0] - S0) / (S1 - S0), to: (SL[1] - S0) / (S1 - S0), lip: 'The ball stops at the slot’s lip: its stones are down. Something below drives them.' },
    dropped: 'The slot’s stones sink from under the ball, and it drops. Another rolls out of the wall where the groove begins.' });
  add(Plate, { id: 'p1', at: [S1, 11, C2 + 6.4], r: 1.1 });
  add(Door, { id: 'd1', at: [0, 11, C2 + 9.7], w: 5, h: 6, lamps: [{ pressed: 'p1' }] });
  add(Vane, { id: 'v2', at: [0, 0, C2 - 3.4], r: 1.8, coast: VANES.climb,
    turning: 'The vane in the floor spins, and up on the balcony stones grind up into the slot across the groove.',
    fading: 'The vane below is slowing.' });
  add(Mark, { room: 'climb', at: [5.5, 0, C2 - 4.5], yaw: -Math.PI * 0.8 });

  // ---- the corridor and the Jets' Chamber (floor 11, an oculus in its ceiling at 33)
  K.slab(-3.2, C2 + 9.6, 3.2, C2 + 12.4, 11, 0.8);
  K.wall(-3.2, C2 + 10.3, -3.2, C2 + 12.4, 11, 6.5, { t: 0.8 }); K.wall(3.2, C2 + 12.4, 3.2, C2 + 10.3, 11, 6.5, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 17.9, C2 + 11.4));
  const C3 = C2 + 22.8;   // 81.4
  K.rotunda({ x: 0, z: C3, y: 11, r: 10, h: 22, gaps: [{ a: Math.PI, w: 5, h: 6 }], oculus: 0.35 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 11, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 11.31, C3));
  K.add(M.glyph, T(new THREE.TorusGeometry(2.75, 0.06, 4, 48), [0, 11.33, C3], [Math.PI / 2, 0, 0]));
  // the light falls down the oculus: a ring of glyphs round it on the floor
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; K.add(M.glyph, T(glyphGeometry(0.9, 0.04).rotateX(-Math.PI / 2), [Math.sin(a) * 5.2, 11.03, C3 + Math.cos(a) * 5.2], [0, a + Math.PI, 0])); }
  band(0, C3, 10, 19, 1.1, 0.4, [[Math.PI, 0.4]]);
  add(Mark, { room: 'jets', at: [6.2, 11, C3 - 5], yaw: -Math.PI * 0.75 });
  // once the jets are yours: the way on, shown (a column of rising rings up through the oculus, a line, the drone)
  add(JetGuide, { from: [0, 11.7, C3], to: 34.6 + 2.5, r: 2.5 });

  // ---- the Lamp Gallery: a tall drum over the chamber (floor 34.6, round the oculus below), after the picked
  // reference: cream stone banded in steel blue, slit windows, stone shelves jutting from the wall with carved eyes
  // over them, rings round the floor's middle. An iris in a ceiling halfway up; the loft over it
  const G0 = 34.6, GR = 14, GC = G0 + VANES.ceil;
  K.rotunda({ x: 0, z: C3, y: G0, r: GR, h: 34, floor: false, seg: 32, gaps: [{ a: 0, w: 5, h: 6, y0: 28 }], oculus: 0.25 });
  K.both(M.floor, T(annulus(3.9, GR + 1.4, 0.6, 48), [0, G0, C3]));
  K.add(M.trim, T(annulus(3.6, 4.2, 0.8, 32), [0, G0 + 0.25, C3]));
  for (const r of [5.6, 7.4]) K.add(blue, T(annulus(r, r + 0.3, 0.02, 48), [0, G0 + 0.012, C3]));
  band(0, C3, GR, G0 + 4.2, 1.3, 0.26, [[-Math.PI / 2, 0.22]]);
  band(0, C3, GR, GC - 2.6, 1.0, 0.26);
  band(0, C3, GR, GC + 3.4, 1.3, 0.26, [[Math.PI / 2, 0.5]]);
  band(0, C3, GR, G0 + 31, 1.3, 0.26, [[0, 0.3]]);
  for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * TAU; if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.5) continue; slit(0, C3, GR, a, G0 + 6.8, 4.6); }
  for (let i = 0; i < 14; i++) { const a = (i + 0.5) / 14 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.4 || Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.55) continue; slit(0, C3, GR, a, GC + 0.9, 4.8); }
  for (let i = 0; i < 14; i++) { const a = (i + 0.5) / 14 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5 || Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.45 || Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.35) continue; slit(0, C3, GR, a, G0 + VANES.crown + 2.4, 5.2); }
  /** A stone shelf jutting from the wall at angle a, its top at y, and a carved eye over it (blind: a carving). */
  const shelf = (a, y, deep = 2.6, wide = 0.2) => {
    K.both(M.floor, T(sector(GR - deep, GR + 0.2, rotA(a) - wide, rotA(a) + wide, 0.6), [0, y, C3]));
    K.both(M.wall, T(new THREE.ConeGeometry(deep * 0.42, 1.6, 4, 1, true).rotateY(Math.PI / 4), [Math.sin(a) * (GR - deep * 0.35), y - 1.4, C3 + Math.cos(a) * (GR - deep * 0.35)], [Math.PI, 0, 0]));
  };
  const carved = (a, y) => {
    const px = Math.sin(a) * (GR - 0.1), pz = C3 + Math.cos(a) * (GR - 0.1);
    K.add(M.trim, T(new THREE.TorusGeometry(0.72, 0.12, 5, 20).scale(1.35, 0.8, 1), [px, y, pz], [0, a, 0]));
    K.add(M.stone, T(new THREE.SphereGeometry(0.42, 10, 8).scale(1, 1, 0.3), [px, y, pz], [0, a, 0]));
  };
  // the blind ones: shelves at other heights, eyes carved over them that wake to nothing
  for (const [a, y] of [[0.9, G0 + 6.5], [2.3, G0 + 10.5], [-2.4, G0 + 5.5]]) { shelf(a, y); carved(a, y + 1.25); }
  // the eye over the west shelf: hidden from the floor by its shelf, stone lids shut over it until the great vane
  // in the floor turns; and that is too heavy for a splash
  const ea = -Math.PI / 2, ey = G0 + 9.5;
  shelf(ea, ey - 1.25);
  add(Switch, { id: 's2', at: [Math.sin(ea) * (GR - 0.15), ey, C3 + Math.cos(ea) * (GR - 0.15)], yaw: ea + Math.PI, size: 1.0, lids: true,
    wrong: 'The splash patters on the eye’s stone lids. They are shut: they lift only while the great vane in the floor turns.' });
  add(Vane, { id: 'vG', at: [-8.2, G0, C3], r: 2.3, great: true, reach: VANES.reach,
    washed: 'The jets’ wash catches the great vane, and it turns under you; over the west shelf an eye’s stone lids lift. Aim: the jets hold you here.' });
  // the iris in the ceiling, over the oculus: it opens on the west eye
  K.both(M.floor, T(annulus(VANES.iris + 0.1, GR + 0.4, 0.6, 48), [0, GC, C3]));
  K.add(M.trim, T(annulus(VANES.iris + 0.1, VANES.iris + 0.7, 0.04, 40), [0, GC + 0.02, C3]));
  add(Iris, { id: 'iris', at: [0, GC, C3], r: VANES.iris, t: 0.6, lamps: [{ lit: 's2' }] });
  add(Mark, { room: 'gallery', at: [0, G0, C3 - 11.5], yaw: 0 });

  // ---- the loft (over the ceiling): a shelf high on the east wall, its ball, a gap in it whose stones stand only
  // while the loft's great vane turns; the high ledge by the north door
  add(Mark, { room: 'loft', at: [-7, GC, C3 - 8.5], yaw: Math.PI * 0.75 });
  const SX = 10.8, SY = GC + VANES.shelf, B0 = C3 - 5.4, B1 = C3 + 4.6, GA = C3 - 2.6, GB = C3 + 0.6;
  K.slab(9.2, C3 - 6.4, 12.6, GA, SY, 0.8);
  K.slab(9.2, GB, 12.6, C3 + 6.2, SY, 0.8);
  for (const z of [C3 - 4.6, C3 + 3.6]) K.both(M.wall, T(new THREE.ConeGeometry(1.7, 3, 4, 1, true).rotateY(Math.PI / 4), [11.6, SY - 2.3, z], [Math.PI, 0, 0]));
  K.add(M.dark, box(1.0, 0.04, GA - B0 + 0.5, SX, SY + 0.02, (B0 - 0.5 + GA) / 2));
  K.add(M.dark, box(1.0, 0.04, B1 + 0.5 - GB, SX, SY + 0.02, (GB + B1 + 0.5) / 2));
  add(Bridge, { id: 'span', a: [SX, SY, GA], b: [SX, SY, GB], w: 2.2, n: 3 });
  add(Ball, { id: 'ball3', a: [SX, SY + 0.04, B0], b: [SX, SY + 0.04, B1], r: 1.0, friction: 0.9, lock: true,
    gap: { bridge: 'span', from: (GA - B0) / (B1 - B0), to: (GB - B0) / (B1 - B0), lip: 'The ball stops at the gap: the stones that bridge it are down, and something in the floor below drives them.' },
    dropped: 'The stones sink from under the ball, and it drops. Another rolls out of the wall where the groove begins.' });
  add(Plate, { id: 'p3', at: [SX, SY, B1], r: 1.2 });
  add(Vane, { id: 'vE', at: [6.4, GC, C3 - 9.4], r: 2.1, great: true, reach: VANES.reach,
    washed: 'The great vane turns under your jets, and up on the east shelf stones grind up into the gap.' });
  // the second iris, over the loft: it opens on the shelf's ball, home on its plate
  const GK = G0 + VANES.crown;
  // the crown's little vane, on a post in the loft under the second iris's rim: seen from the crown down through the
  // iris, splashed from the loft (or from above); it turns the crown eye's second lid
  const VSx = -6.3, VSy = GK - 2.6;
  K.both(M.wall, T(new THREE.CylinderGeometry(0.45, 0.7, VSy - GC - 0.2, 10), [VSx, (GC + VSy - 0.2) / 2, C3]));
  K.add(blue, T(new THREE.CylinderGeometry(1.5, 1.5, 0.25, 20), [VSx, VSy - 0.25, C3]));
  add(Vane, { id: 'vS', at: [VSx, VSy, C3], r: 1.2, coast: VANES.small,
    turning: 'The little vane on its post spins, and up in the crown one of the eye’s two lids lifts a little. It is slowing.',
    fading: 'The little vane is slowing.' });
  K.both(M.floor, T(annulus(VANES.iris2 + 0.1, GR + 0.4, 0.6, 48), [0, GK, C3]));
  K.add(M.trim, T(annulus(VANES.iris2 + 0.1, VANES.iris2 + 0.7, 0.04, 40), [0, GK + 0.02, C3]));
  add(Iris, { id: 'iris2', at: [0, GK, C3], r: VANES.iris2, t: 0.6, lamps: [{ pressed: 'p3' }] });

  // ---- the crown (over the second iris): the high ledge by the north door, the eye over the east shelf whose lids
  // lift only while two vanes turn at once: the great one in the floor, and the small one in the loft below, on its post
  // under the second iris (it stands in the loft: the loft's own piece, above)
  add(Mark, { room: 'crown', at: [-8, GK, C3 - 7.5], yaw: Math.PI * 0.7 });
  K.both(M.floor, T(sector(GR - 4.5, GR + 0.2, rotA(0) - 0.32, rotA(0) + 0.32, 0.8), [0, G0 + 28, C3]));
  const ca = Math.PI / 2, cy = GK + 6.8;
  shelf(ca, cy - 1.25);
  add(Switch, { id: 's4', at: [Math.sin(ca) * (GR - 0.15), cy, C3 + Math.cos(ca) * (GR - 0.15)], yaw: ca + Math.PI, size: 1.0, lids: true,
    wrong: 'The splash patters on the eye’s lids. They lift only while two vanes turn at once: the great one in the floor, and a little one somewhere below.' });
  add(Vane, { id: 'vC', at: [6.2, GK, C3 + 5.4], r: 2.2, great: true, reach: VANES.reach,
    washed: 'The great vane turns under your jets. Over the east shelf, the eye’s lids stir.' });
  add(Door, { id: 'd3', at: [0, G0 + 28, C3 + GR + 0.7], w: 5, h: 6, lamps: [{ lit: 's4' }] });

  // ---- the Warden's Hall (floor 62.6, a great drum), its corridor from the high door
  const H0 = G0 + 28, CW = C3 + GR + 1.4 + 3 + 21.4;   // 121.2
  K.slab(-3.2, C3 + GR + 0.6, 3.2, CW - 20.6, H0, 0.8);
  K.wall(-3.2, C3 + GR + 1.4, -3.2, CW - 20.6, H0, 7, { t: 0.8 }); K.wall(3.2, CW - 20.6, 3.2, C3 + GR + 1.4, H0, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, CW - 20.6 - C3 - GR - 0.6, 0, H0 + 7.4, (C3 + GR + 0.6 + CW - 20.6) / 2));
  add(Mark, { room: 'hall', at: [2.2, H0, C3 + GR + 2.6], yaw: -Math.PI / 2 });
  const HR = 20;
  K.rotunda({ x: 0, z: CW, y: H0, r: HR, h: 30, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.3 });
  K.both(M.stone, lathe([[6.5, 0], [6.5, 0.6], [5.8, 0.8], [0.01, 0.8]], 32).translate(0, H0, CW), new THREE.CylinderGeometry(6.3, 6.5, 0.8, 24).translate(0, H0 + 0.4, CW));
  K.add(M.glyph, T(new THREE.TorusGeometry(6.1, 0.08, 4, 56), [0, H0 + 0.83, CW], [Math.PI / 2, 0, 0]));
  band(0, CW, HR, H0 + 9, 1.4, 0.22, [[0, 0.25], [Math.PI, 0.25]]);
  // four stone discs on columns round the hall, eight metres up: somewhere to stand over it
  for (let i = 0; i < 4; i++) {
    const a = (i + 0.5) / 4 * TAU, x = Math.sin(a) * 13, z = CW + Math.cos(a) * 13;
    K.column(x, z, H0, 8, 0.8);
    K.both(M.floor, T(new THREE.CylinderGeometry(2.6, 2.3, 0.7, 20), [x, H0 + 8.35, z]));
  }
  // and four great vanes in the floor between them: the warden backs onto one when its hatch opens, and over a
  // turning one the draught holds the hatch wide
  rt.hallVanes = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    rt.hallVanes.push(add(Vane, { id: `vh${i}`, at: [Math.sin(a) * HALL.vane, H0, CW + Math.cos(a) * HALL.vane], r: 2.2, great: true, reach: HALL.reach, linger: 1.2 }));
  }
  add(Door, { id: 'd5', at: [0, H0, CW + HR + 0.7], w: 5, h: 6 });
  // the way out: a corridor to a dark doorway
  K.slab(-3.2, CW + HR + 0.6, 3.2, CW + HR + 10, H0, 0.8);
  K.wall(-3.2, CW + HR + 1.4, -3.2, CW + HR + 10, H0, 7, { t: 0.8 }); K.wall(3.2, CW + HR + 10, 3.2, CW + HR + 1.4, H0, 7, { t: 0.8 });
  K.wall(3.2, CW + HR + 10, -3.2, CW + HR + 10, H0, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, H0 + 7.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, H0, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, H0 + 2.5, CW + HR + 10.9));
  // the warden, standing still on its plinth
  const model = sentinelModel();
  model.pos.copy(K.world(0, H0 + 0.8, CW + 2));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, H0 + 0.8, CW);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, H0, CW), r: HR, y: K.world(0, H0, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-26, -17, -3), V(26, 100, CW + HR + 12)),
    gadget: { at: W(0, 11.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, H0 + 0.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 14], [0, 6, 18, 20], [0, 6, 40, 20], [0, 8, C2, 16], [0, 16, C2, 14], [0, 18, C3, 18], [0, G0 + 8, C3, 20], [0, G0 + 22, C3, 20], [0, H0 + 4, C3 + GR + 3, 9], [0, H0 + 12, CW, 30]],
    guardian: { def: { ...WARDEN, onHit: wardenHit, openFor: wardenOpenFor }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the makers' tower on the rim
function exterior(scene, level, rt) {
  const TOP = 200, yaw = SITE.heading;
  const K = new TempleKit(rt.root, 'The Warden’s Well', V(SITE.x, TOP, SITE.z), yaw, rt.M);
  const M = rt.M, R = 16;
  const blue = makeMaterial({ color: PALETTE.accent, flat: true, key: 'incal.temple.blue' });
  const pale = makeMaterial({ color: '#9fbfdc', flat: true, glow: 0.25, key: 'incal.temple.carve' });
  // a stepped stone drum, a blue steel band at each step, and a dark blue crown with the glyph ring
  const tiers = [[R + 4, 0, 4], [R, 4, 34], [R - 3, 38, 22], [R - 6, 60, 16]];
  for (const [r, y, h] of tiers) {
    K.both(M.wall, new THREE.CylinderGeometry(r, r, h, 40).translate(0, y + h / 2, 0));
    K.add({ paint: new THREE.Color(PALETTE.stone), smooth: false, side: THREE.FrontSide }, new THREE.CylinderGeometry(r + 0.35, r + 0.35, 0.9, 40).translate(0, y + h - 0.45, 0));
  }
  K.both(blue, lathe([[R - 5, 76], [R - 3.5, 77.5], [R - 3.5, 80], [R - 6.5, 82], [3, 84], [1, 92], [0.01, 92.5]], 40));
  K.add(pale, T(new THREE.TorusGeometry(R - 3.3, 0.14, 4, 64), [0, 78.8, 0], [Math.PI / 2, 0, 0]));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; K.add(pale, T(glyphGeometry(2.2, 0.15), [Math.sin(a) * (R - 3.45), 78.8, Math.cos(a) * (R - 3.45)], [0, a, 0])); }
  // ribs up the drum, between them tall slit windows (dark), glyphs over each
  for (let i = 0; i < 16; i++) {
    const a = (i + 0.5) / 16 * TAU;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue;
    K.both(M.trim, T(new THREE.BoxGeometry(1.2, 34, 1.6), [Math.sin(a) * (R + 0.4), 4 + 17, Math.cos(a) * (R + 0.4)], [0, a, 0]));
    const b = a + TAU / 32;
    K.add(M.dark, T(new THREE.BoxGeometry(1.4, 9, 0.3), [Math.sin(b) * (R + 0.05), 24, Math.cos(b) * (R + 0.05)], [0, b, 0]));
    K.add(M.glyph, T(glyphGeometry(1.6, 0.12), [Math.sin(b) * (R + 0.08), 31, Math.cos(b) * (R + 0.08)], [0, b, 0]));
  }
  // the doorway, after the picked entrance (references/temples/wardens-well/sheet-2.jpg): a porch of the drum's
  // stone out past the plinth, a tall pointed arch cut through it at the top of a short flight of steps, banded in
  // steel blue at its foot, an unlit lamp on a post beside the steps
  const P0 = R + 4, z0 = P0 - 0.4, z1 = P0 + 3.2, sill = 1.8, dw = 4.6, dh = 6.4, apex = dh + dw * 0.85;
  const steel = { paint: new THREE.Color(PALETTE.stone), smooth: false, side: THREE.FrontSide };
  {
    const W = 13, H = 17, f = new THREE.Shape();
    f.moveTo(-W / 2, 0); f.lineTo(-dw / 2, 0); f.lineTo(-dw / 2, dh);
    f.quadraticCurveTo(-dw / 2, dh + dw * 0.6, 0, apex);
    f.quadraticCurveTo(dw / 2, dh + dw * 0.6, dw / 2, dh);
    f.lineTo(dw / 2, 0); f.lineTo(W / 2, 0); f.lineTo(W / 2, H); f.lineTo(-W / 2, H); f.closePath();
    K.both(M.wall, new THREE.ExtrudeGeometry(f, { depth: z1 - z0, bevelEnabled: false, curveSegments: 12 }).translate(0, sill, z0));
    // its frame: a second, shallower arch round the opening, proud of the face
    const o = new THREE.Shape(), m = 0.55;
    o.moveTo(-dw / 2 - m, 0); o.lineTo(-dw / 2 - m, dh); o.quadraticCurveTo(-dw / 2 - m, dh + dw * 0.66, 0, apex + m * 1.4); o.quadraticCurveTo(dw / 2 + m, dh + dw * 0.66, dw / 2 + m, dh); o.lineTo(dw / 2 + m, 0);
    o.lineTo(dw / 2, 0); o.lineTo(dw / 2, dh); o.quadraticCurveTo(dw / 2, dh + dw * 0.6, 0, apex); o.quadraticCurveTo(-dw / 2, dh + dw * 0.6, -dw / 2, dh); o.lineTo(-dw / 2, 0); o.closePath();
    K.add(M.wall, new THREE.ExtrudeGeometry(o, { depth: 0.35, bevelEnabled: false, curveSegments: 12 }).translate(0, sill, z1));
    // the dark in the doorway, deep in the porch, pointed as the arch
    const d = new THREE.Shape();
    d.moveTo(-dw / 2, 0); d.lineTo(-dw / 2, dh); d.quadraticCurveTo(-dw / 2, dh + dw * 0.6, 0, apex); d.quadraticCurveTo(dw / 2, dh + dw * 0.6, dw / 2, dh); d.lineTo(dw / 2, 0); d.closePath();
    K.add(M.voidM, new THREE.ShapeGeometry(d, 12).translate(0, sill, P0 + 1.6));
    K.solid(box(dw, apex, 0.6, 0, sill + apex / 2, P0 + 1.45));
  }
  K.both(steel, box(13.6, 1.6, z1 - z0 + 0.5, 0, sill + 0.8 - 1.6, (z0 + z1) / 2 + 0.1));   // its blue foot
  K.add(steel, box(13.6, 0.9, 0.4, 0, sill + 13.2, z1 + 0.2));
  K.add(pale, T(glyphGeometry(2.6, 0.15), [0, sill + apex + 1.6, z1 + 0.05], [0, 0, 0]));
  K.both(M.floor, box(dw + 0.4, sill, z1 - z0, 0, sill / 2, (z0 + z1) / 2));
  K.both(M.floor, box(16, 0.3, 14, 0, 0.15, P0 + 8));
  K.stairs([0, sill, z1], [0, 0.3, z1 + 5.4], 7, { rise: 0.3 });
  for (const s of [-1, 1]) K.both(M.wall, box(1.1, 1.2, 5.6, s * 4.05, 0.9, z1 + 2.7));   // the steps' cheeks
  // the lamp on its post, not lit (nobody comes here to light it)
  K.both(steel, new THREE.CylinderGeometry(0.11, 0.14, 3.6, 8).translate(5.6, 2.1, z1 + 4.2));
  K.add(steel, new THREE.CylinderGeometry(0.42, 0.3, 0.2, 8).translate(5.6, 4.0, z1 + 4.2));
  // (its glass a mesh of its own: once the warden is still, Vell keeps its doorway lit, the world change)
  const lampM = makeMaterial({ color: PALETTE.lamp, glow: 0.04, flat: true, key: 'incal.temple.doorlamp' });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 6).translate(5.6, 4.5, z1 + 4.2), lampM);
  lamp.position.copy(K.world(0, 0, 0)); lamp.rotation.y = yaw; lamp.userData.noCollide = true;
  rt.root.add(lamp);
  K.add(steel, new THREE.ConeGeometry(0.46, 0.5, 6).translate(5.6, 5.15, z1 + 4.2));
  K.flush();
  const at = K.world(0, sill, P0 + 1.6);
  const f = V(Math.sin(yaw), 0, Math.cos(yaw)), front = at.clone().addScaledVector(f, 9);
  return { door: { at, heading: yaw }, kit: K, base: TOP, doorY: TOP + sill, R, top: TOP + 92, lampM,
    clear: [{ x: SITE.x, z: SITE.z, r: R + 7 }, { x: front.x, z: front.z, r: 11 }] };
}

// ------------------------------------------------------------------ the world change: the shaft breathes again
/**
 * Once the warden is stopped, the shaft's old breath comes back: beside the
 * Upward Shrine a column of rising air (pale rings drifting up it, the
 * fluid's colours in its motes) carries anyone who steps into it from the
 * bottom terrace up past every level to the rim, and sets them down on it.
 * The tower's crown burns bright.
 */
function change(scene, level, rt) {
  const B = BREATH;
  const root = new THREE.Group();
  root.name = 'The shaft’s breath (the world change)';
  scene.add(root);
  root.visible = false;
  const ax = Math.cos(B.a), az = Math.sin(B.a);
  const foot = V(ax * B.r, B.bottom, az * B.r), crest = V(ax * B.r, B.top + 6, az * B.r), land = V(ax * (B.R + 9), B.top + 2.5, az * (B.R + 9));
  // the rings: pale, inked, drifting up the column (and along its crest to the rim)
  const ringM = makeMaterial({ color: '#e8f4f2', glow: 0.35, flat: true, key: 'incal.breath' });
  const rings = [];
  const N = 46;
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(B.radius * 0.8, 0.09, 4, 32).rotateX(Math.PI / 2), ringM);
    m.userData.noCollide = true; m.userData.dynamic = true;
    root.add(m); rings.push({ m, s: i / N });
  }
  const pathAt = (s, out) => {
    // up the column (most of the way), then out over the rim
    const up = 0.88;
    if (s < up) return out.lerpVectors(foot, crest, s / up);
    return out.lerpVectors(crest, land, (s - up) / (1 - up));
  };
  // a stone ring on the bottom terrace where it rises, carved with the glyph, and one on the rim where it sets you down
  const stone = makeMaterial({ color: '#d6c6a8', flat: true });
  for (const [p, r] of [[foot, B.radius + 0.6], [land, 2.6]]) {
    const g = new THREE.Mesh(new THREE.TorusGeometry(r, 0.25, 6, 40).rotateX(Math.PI / 2).translate(p.x, p.y + 0.12, p.z), stone);
    g.userData.noCollide = true;
    root.add(g);
  }
  const sign = new THREE.Mesh(glyphGeometry(2.2, 0.12).rotateX(-Math.PI / 2).translate(land.x, land.y - 2.35, land.z), makeMaterial({ color: '#9fdcef', glow: 0.8, flat: true }));
  sign.userData.noCollide = true;
  root.add(sign);
  const crown = rt.outside?.kit ? rt.outside : null;
  let k = 0, want = 0, rideT = 0;
  const _p = V(), _d = V();
  return {
    root, foot, crest, land,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; root.visible = k > 0.001 || want > 0; },
    update(dt, t) {
      k += (want - k) * Math.min(1, dt / 3);
      root.visible = k > 0.01;
      if (!root.visible) return;
      for (const r of rings) {
        r.s = (r.s + dt * 0.012) % 1;
        pathAt(r.s, r.m.position);
        const fade = Math.min(1, r.s * 12, (1 - r.s) * 12);
        r.m.scale.setScalar(Math.max(0.01, fade * k * (1 + 0.08 * Math.sin(t * 2 + r.s * 30))));
      }
      ringM.uniforms.uGlow.value = 0.25 + 0.15 * Math.sin(t * 1.3);
      if (rt.outside?.lampM?.uniforms?.uGlow) rt.outside.lampM.uniforms.uGlow.value = 0.04 + 0.85 * k;
      // the ride: in the column you are lifted, steadied toward its middle; over the crest, carried out to the rim
      const P = rt.player;
      if (!P || P.riding || P.dead || k < 0.9) return;
      const flat = Math.hypot(P.pos.x - foot.x, P.pos.z - foot.z);
      const inColumn = flat < B.radius && P.pos.y > B.bottom - 1 && P.pos.y < crest.y;
      const toRim = _d.subVectors(land, crest).setY(0), along = Math.hypot(toRim.x, toRim.z);
      _p.subVectors(P.pos, crest).setY(0);
      const u = (_p.x * toRim.x + _p.z * toRim.z) / (along * along);
      const offLine = Math.hypot(_p.x - toRim.x * u, _p.z - toRim.z * u);
      const lineY = crest.y + (land.y - crest.y) * Math.max(0, u);
      const onCrest = u > -0.05 && u < 1 && offLine < B.radius && Math.abs(P.pos.y - lineY) < 5;
      if (inColumn) {
        P.vel.y = Math.max(P.vel.y, 12) + (14 - P.vel.y) * Math.min(1, dt * 2);
        P.vel.x += (foot.x - P.pos.x) * dt * 2.5; P.vel.z += (foot.z - P.pos.z) * dt * 2.5;
        P.onGround = false; P.gliding = false;
        if ((rideT += dt) > 0.4) rt.notice('The shaft’s breath lifts you, up past every level.', 'breath');
      } else if (onCrest && !P.onGround) {
        _d.normalize();
        // (held near the crest's line all the way: a steady sink of its own left you short of the rim, falling)
        P.vel.x = _d.x * 9; P.vel.z = _d.z * 9; P.vel.y = Math.max(P.vel.y, THREE.MathUtils.clamp((lineY + 0.6 - P.pos.y) * 1.5, -1.5, 2));
      } else rideT = 0;
      if (crown) void crown;
    },
  };
}

export const INCAL_TEMPLE = {
  id: 'incal', levelId: 'incal', name: 'The Warden’s Well', doorLabel: 'door of the makers’ tower',
  gadget: 'jetpack', gadgetBox: 'incal.temple.jetpack', arenaDoor: 'd3',
  origin: [420, 1400, 140], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'vell', out: 7, side: 6 },   // (src/temples/index.js: who stands by the door and points you in)
  enterLine: 'Inside the tower it is cool and very tall, and something far overhead hums, round and round.',
  // you can't get about the City-Shaft without the jets, and they are in here: the quest starts when you land
  startsOnArrival: () => !items.has('jetpack'),
  arrivalLine: 'The jets the makers left for this city are in their tower on the rim, round from the ship.',
  used: jetsUsed,   // (the temple quest's 'use' stage: src/temples/index.js)
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Far below the rim, by the Upward Shrine, the shaft has begun to breathe again.', 'resolved.out'); },
  // its side vents: each a target while they are open in the first phase (the guardian's own weak point is
  // the one at its front: a shot into one round its side or back counts the same). From its second phase, its hatch
  // open, it backs toward the nearest of the hall's vanes and stands by it: the draught off that vane is the way in
  onConnect(rt) {
    const G = rt.guardian;
    if (!G?.model.vent) return;
    for (let i = 0; i < 3; i++) {
      const at = V();
      rt.offs.push(registerTarget({ kind: 'sentinel', radius: 0.8, position: () => G.model.vent(i, at), enabled: () => G.state === 'open' && G.phaseIndex === 0,
        onHit: (mode, point, dir, info) => G.hit('mouth', mode, dir, info) }));
    }
    const upd = G.update.bind(G);
    G.update = (dt, t) => {
      upd(dt, t);
      if (G.state !== 'open' || G.phaseIndex < 1 || !rt.hallVanes?.length) return;
      const m = G.model;
      const v = rt.hallVanes.reduce((b, x) => (Math.hypot(x.center.x - m.pos.x, x.center.z - m.pos.z) < Math.hypot(b.center.x - m.pos.x, b.center.z - m.pos.z) ? x : b));
      const dx = v.center.x - m.pos.x, dz = v.center.z - m.pos.z, d = Math.hypot(dx, dz);
      if (d > HALL.back) { const step = Math.min(d - HALL.back, HALL.drift * dt); m.pos.x += (dx / d) * step; m.pos.z += (dz / d) * step; G.keepIn?.(); }
    };
  },
};
