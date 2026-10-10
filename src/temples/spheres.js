import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Bridge, LensStones, Mark, Pit, printGeometry } from './pieces.js';
import { echoModel } from './guardians.js';

// The Garden of Spheres' temple: the Footprint, the one Emrys speaks of. North
// of the umbrella grove the meadow carries an enormous three-toed print, its
// rim of white stone, as if something that walked through the sky putting the
// spheres down had stepped here; in its heel stands a great pale sphere with a
// door. Nobody goes in: the garden says the heel is where the walker waits.
//
// One idea (docs/audits/temple-design-v1.24.md): the lens shows where the walker set things down. What is real
// carries the walker's print, three toes like the Footprint itself; the look-alikes carry two or four, or nothing the
// lens can see. Taught at the chest (its mural, the prints on the floor), then asked of stones, plates and spheres.
//
// Inside (built far overhead, through its door):
//   the Threshold          the first mark, the way out
//   the Hall of Spheres    where the walker set a sphere down, and where it stood: one white sphere in a groove that
//                          runs past three prints carved in the floor (two toes, three, four), and three prints by
//                          the east wall. The door wants the sphere on the walker's print and your weight on the
//                          walker's print by the wall: three toes, like the Footprint outside and the print carved
//                          over the door (the push and your weight, before the lens; the decoys plain to see)
//   the Still Pool         a sphere floating in the sunken pool: push it across the still water onto the far berth,
//                          and the stepping stones rise
//   the Lens Chamber       the makers' chest: the GLYPH LENS (src/items.js 'lens'). Through it the wall shows the
//                          walker's print, three toes, and its prints lead on over the floor (the clue, no lock)
//   the Hall of the Unseen a chasm; the lens shows a field of stepping stones, each with a print: only the walker's
//                          hold (pieces.js LensStones), the rest crumble. On the far landing a sphere's groove past
//                          two plain prints of two and four toes and the walker's, which only the lens shows; and an
//                          eye only the lens shows high on the near wall, across the chasm: both open the far door
//   the Keepers' Gallery   from the far landing back round to the Lens Chamber: a door plain wall from the chest's
//                          side, opened by an eye on its far side only the lens shows (the shortcut)
//   the Echo's Hall        the guardian (a being of sound: you calm it). It sings, and one of the three
//                          resonant spheres round the hall glows with the note: splash that one. Through the lens
//                          the sphere that answers wears the walker's print (taught in its second phase); in its last
//                          all three glow at once, and only the print tells
// After: the toes and the heel of the Footprint fill with still water, and every sphere in the garden
// wears a ring of the glyph's light (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** North of the grove, behind the spawn; the heel's door looks south, toward the umbrella grove. */
export const SITE = { x: -250, z: 250, r: 26 };
SITE.heading = Math.atan2(0 - SITE.x, 0 - SITE.z);

export const PALETTE = {
  wall: '#f7f3ea', wall2: '#ece4d4', wall3: '#fffdf4', floor: '#e9e1d0', floor2: '#ddd3c0', trim: '#fffdf4',
  dark: '#3c4f80', stone: '#f1ebdc', accent: '#e8b9c4', glow: '#a8e6ee', lamp: '#f6c84e', sand: '#e9e1d0', sand2: '#ddd3c0',
};

export const LOGIC = {
  id: 'spheres', entry: 'threshold', gadget: 'lens',
  // (the Lens Chamber and the Hall of the Unseen's near ledge are one room: the passage between them is open, and
  // nothing past the chest's room opens without the lens)
  rooms: { threshold: { checkpoint: true }, spheres: { checkpoint: true }, pool: { checkpoint: true }, lens: { checkpoint: true }, unseenFar: {}, gallery: {}, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'spheres' },
    { a: 'spheres', b: 'pool', door: 'd1' },
    { a: 'pool', b: 'lens', door: 'stones' },
    { a: 'lens', b: 'unseenFar', door: 'br1' },
    { a: 'unseenFar', b: 'gallery' },                // the far landing's west door, into the keepers' gallery
    { a: 'lens', b: 'gallery', door: 'sc' },          // the gallery's door into the Lens Chamber: opened from its far side
    { a: 'unseenFar', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    p1: { type: 'plate', room: 'spheres' },
    // the Hall of Spheres: the sphere set down on the walker's print (among two- and four-toed ones), and you standing
    // on the walker's print by the wall
    pa: { type: 'plate', room: 'spheres' },
    pb: { type: 'plate', room: 'spheres' },
    ball1: { type: 'drum', room: 'spheres', stops: { pa: 0.3, p1: 0.62, pb: 0.92 }, start: 0 },
    pW: { type: 'plate', room: 'spheres' },
    pX: { type: 'plate', room: 'spheres' },
    pY: { type: 'plate', room: 'spheres' },
    d1: { type: 'door', opens: { all: [{ drumOn: ['ball1', 'p1'] }, { pressed: 'pW' }] }, latch: true },
    // the Still Pool: the water stirs and draws the floating sphere back, unless you stand on the stone that stills it;
    // pushed across onto its berth meanwhile, it raises the stepping stones
    pS: { type: 'plate', room: 'pool' },
    p3: { type: 'plate', room: 'pool' },
    ball3: { type: 'drum', room: 'pool', plate: 'p3', plateAt: 1, start: 0, when: { pressed: 'pS' } },
    stones: { type: 'bridge', opens: { drumOn: ['ball3', 'p3'] }, latch: true },
    chest: { type: 'gadget', room: 'lens', item: 'lens' },
    mural: { type: 'clue', room: 'lens' },                               // the walker's print on the wall, through the lens
    br1: { type: 'bridge', opens: { item: 'lens' }, clue: 'mural' },     // the stones only the lens shows: the print's hold
    s2: { type: 'switch', room: 'lens', needs: ['lens'] },               // an eye only the lens shows, across the chasm
    // the far landing: a sphere's groove past two plain prints and the walker's, which only the lens shows
    pf1: { type: 'plate', room: 'unseenFar' },
    p4: { type: 'plate', room: 'unseenFar' },
    pf2: { type: 'plate', room: 'unseenFar' },
    ball4: { type: 'drum', room: 'unseenFar', stops: { pf1: 0.3, p4: 0.62, pf2: 0.9 }, start: 0 },
    d4: { type: 'door', opens: { all: [{ lit: 's2' }, { drumOn: ['ball4', 'p4'] }] }, latch: true },
    ssc: { type: 'switch', room: 'gallery', needs: ['lens'] },          // the gallery's eye by the door, its far side
    sc: { type: 'door', opens: { lit: 'ssc' }, latch: true },
    echo: { type: 'boss', room: 'hall', needs: ['backpack', 'lens'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const ECHO = {
  kind: 'organic', name: 'the Echo', final: 'touch', touch: 'hold out your hand to it',
  speed: 2.6, wakeTime: 3,
  wake: 'Light gathers over the floor and turns: rings of glass round a pale heart. It sings at you, one note, very loud. It is lost.',
  openHint: 'It sings, and one of the spheres round the hall glows with its note.',
  weary: 'It sinks to the floor, its rings slowing, humming to itself. It is listening for you now.',
  resolved: 'The Echo hums once with all three spheres at once, and goes quiet, and stays.',
  missHint: 'It fell short and lies on the floor, ringing: one of the spheres round the hall glows with its note.',
  phases: [
    { to: 0.45, attacks: ['note', 'pulse', 'ripple'], pause: 1.7, hint: 'When it sings, answer it: splash the sphere that glows with its note.' },
    { to: 0.75, attacks: ['fall', 'chord', 'note'], pause: 1.3, hint: 'Its rings brighten and lock together into a lens. Keep answering it, note for note: through your own lens, the sphere that answers wears the walker’s print.' },
    { to: 0.9, attacks: ['scale', 'ripple', 'fall'], pause: 1.1, hint: 'Its heart cracks with light, and it sings three notes at once: all three spheres glow. Only one wears the walker’s print through your lens. Splash that one.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    note: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.4, wind: 1.4, track: 0.6, part: 'core', rig: 'spin', damage: 0.75, knock: 8, recover: 0.8, open: 3.2 },
    pulse: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'core', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, damage: 1, knock: 12, recover: 0.8 },
    ripple: { shape: 'ring', at: 'self', radius: 6, wind: 1.0, part: 'core', rig: 'swell', damage: 0.5, knock: 9, recover: 0.4, then: 'ripple2' },
    ripple2: { shape: 'ring', at: 'self', radius: 6, wind: 0.7, part: 'core', rig: 'swell', pose: 'ripple', link: true, damage: 0.5, knock: 9, gap: 0.25, then: 'pulseEnd' },
    pulseEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'core', rig: 'swell', pose: 'pulse', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, damage: 1, knock: 12, recover: 0.8, open: 3.2 },
    chord: { shape: 'lane', range: 26, width: 3, wind: 1.5, track: 0.7, part: 'core', rig: 'lean', damage: 0.75, knock: 10, recover: 0.9, open: 2.8 },
    fall: { shape: 'ring', at: 'player', radius: 4, wind: 1.5, track: 0.6, over: true, part: 'core', rig: 'rise', damage: 0.75, knock: 9, recover: 0.8, miss: 3.0 },
    scale: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'core', rig: 'spin', pose: 'note', damage: 0.5, knock: 6, recover: 0.5, then: 'chordEnd' },
    chordEnd: { shape: 'lane', range: 26, width: 3, wind: 1.2, track: 0.6, part: 'core', rig: 'lean', pose: 'chord', link: true, damage: 0.75, knock: 10, recover: 0.9, open: 2.8 },
  },
};

/** A resonant sphere round the Echo's hall: when the Echo sings its note it glows; splash it then. */
class Resonator {
  constructor(rt, o) {
    this.rt = rt; this.i = o.i;
    const K = rt.kit;
    this.pos = K.world(...o.at);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    rt.root.add(this.group);
    this.glow = makeMaterial({ color: o.color, glow: 0.05, flat: true, key: `temple.spheres.res.${o.i}` });
    const plinth = new THREE.CylinderGeometry(1.4, 1.8, 1.2, 16).translate(0, 0.6, 0);
    const ball = new THREE.SphereGeometry(1.5, 20, 14).translate(0, 2.6, 0);
    this.group.add(new THREE.Mesh(plinth, rt.M.trimMat));
    this.group.add(new THREE.Mesh(ball, this.glow));
    // the walker's print on its face toward the hall's middle, that only the lens shows: on the one that answers
    this.printM = makeMaterial({ color: '#f6c84e', glow: 0.8, flat: true, key: `temple.spheres.print.${o.i}` });
    this.print = new THREE.Mesh(printGeometry(3, 1.6).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(0, 2.6, 1.53), this.printM);
    this.print.visible = false;
    this.group.add(this.print);
    if (o.face) this.group.rotation.y = K.heading(Math.atan2(o.face[0] - o.at[0], o.face[2] - o.at[2]));
    this.group.traverse((c) => { c.userData.noCollide = true; c.userData.dynamic = true; });
    // it never moves: it collides as drawn, the plinth and the round ball, not as a flat disc 1.8 m
    // wide at the ball's crown, whose floor hung 0.14 m over the drawn sphere (src/contact-audit.js)
    K.solid(plinth.clone().translate(o.at[0], o.at[1], o.at[2]));
    K.solid(ball.clone().translate(o.at[0], o.at[1], o.at[2]));
    this.center = this.pos.clone().add(V(0, 2.6, 0));
    this.onHit = o.onHit;
    this.off = registerTarget({ kind: 'resonator', radius: 1.6, position: () => this.center, onHit: (mode) => this.hit(mode) });
    this.k = 0;
  }
  hit(mode = 'shoot') { return this.onHit(this, mode); }
  update(dt, t) {
    // (its last phase: all three glow as it sings three notes at once; the print tells the one that answers)
    const sing = this.rt.sing === this.i || (this.rt.singAll && this.rt.sing >= 0);
    this.k += ((sing ? 1 : 0) - this.k) * Math.min(1, dt * 5);
    this.glow.uniforms.uGlow.value = 0.05 + 0.85 * this.k * (0.75 + 0.25 * Math.sin(t * 10));
    const g = this.rt.guardian;
    this.print.visible = this.rt.sing === this.i && (g?.phaseIndex ?? 0) >= 1 && this.rt.logic.has('lens');
    if (this.print.visible) this.printM.uniforms.uGlow.value = 0.6 + 0.3 * Math.sin(t * 6);
  }
  dispose() { this.off?.(); }
}

/**
 * What the lens shows in the Lens Chamber (o.id 'mural', the clue of the stones over the chasm): on the wall, the
 * walker's print, three toes, with a stepping stone under it carrying the same; over the floor, the walker's prints
 * from the dais toward the way on. Without the lens, plain wall and floor.
 */
class Mural {
  constructor(rt, o) {
    this.rt = rt; this.id = o.id;
    const K = rt.kit;
    this.mat = makeMaterial({ color: '#f6c84e', glow: 0.7, flat: true, key: 'temple.spheres.mural' });
    const parts = [];
    // (on the wall: facing yaw, standing up; the big print over a stone carrying the small one)
    const up = (g, x, y, z, yaw) => g.rotateX(-Math.PI / 2).rotateY(Math.PI).rotateY(yaw).translate(x, y, z);
    const [x, y, z] = o.at, yaw = o.yaw ?? 0, fx = Math.sin(yaw) * 0.04, fz = Math.cos(yaw) * 0.04;
    parts.push(up(printGeometry(3, 2.6), x + fx, y + 1.2, z + fz, yaw));
    parts.push(up(new THREE.PlaneGeometry(2.2, 0.12).rotateX(Math.PI / 2), x + fx, y - 0.9, z + fz, yaw));
    parts.push(up(printGeometry(3, 0.9), x + fx, y - 0.4, z + fz, yaw));
    // the prints on the floor, from the dais toward the way on
    for (const [px, pz, a] of o.prints ?? []) parts.push(printGeometry(3, 0.9).rotateY(a).translate(px, 0.03, pz));
    this.mesh = new THREE.Mesh(mergeGeometries(parts.map((g) => { if (g.attributes.uv) g.deleteAttribute('uv'); if (g.attributes.normal) g.deleteAttribute('normal'); return g.index ? g.toNonIndexed() : g; })), this.mat);
    this.mesh.applyMatrix4(K.frame);
    this.mesh.userData.noCollide = true; this.mesh.userData.dynamic = true;
    rt.root.add(this.mesh);
  }
  update(dt, t) {
    this.mesh.visible = this.rt.logic.has('lens');
    if (this.mesh.visible) this.mat.uniforms.uGlow.value = 0.55 + 0.2 * Math.sin(t * 1.3);
  }
}

const NOTES = ['#f6c84e', '#a8e6ee', '#e8b9c4'];
/**
 * The Hall of the Unseen's stepping stones (x, z from the hall's south end, the toes of the print each carries): three
 * across, six rows over the chasm. The walker's (three toes) make one way over, a step aside every row or two; the
 * rest carry two or four and crumble.
 */
export const STONES = (() => {
  const path = [1, 0, 0, 1, 2, 1], out = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) out.push([(c - 1) * 3.2, 7.6 + r * 3.35, c === path[r] ? 3 : (r + c) % 2 ? 2 : 4]);
  return out;
})();
// the keepers' gallery: where it meets the hall's west door (z, by the far landing) and where it starts (z, by the
// Lens Chamber's west door)
const GALLERY_Z = 129, GALLERY_S = 84.4;
function echoHit(g, part, mode) {
  if (mode === 'push') { g.add(-0.05, 'push'); g.rt.notice('The shove scatters its rings. It sings louder, frightened.', 'echo.push'); return true; }
  g.rt.notice('The fluid passes through its light. It does not want water: it wants an answer.', 'echo.fluid');
  return true;
}
/** A splash on a resonant sphere: the right one while it sings is an answer. */
function resonate(rt, res, mode) {
  const g = rt.guardian;
  if (mode === 'push' || !g) return true;
  rt.sound?.chime?.();
  if (g.state !== 'open') { rt.notice('The sphere rings, and nothing answers. Wait for it to sing.', 'echo.wait'); return true; }
  if (rt.sing !== res.i) { rt.notice('A different note. It flinches.', 'echo.wrong'); g.add(-0.03, 'wrong'); return true; }
  g.add(g.phaseIndex === 0 ? 0.15 : 0.15, 'answer');
  if (g.state === 'open') { g.enter('fight'); g.cool = 2; }
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  /** A sphere's groove on the floor from (ax, az) to (bx, bz): a dark channel between two trim lips. */
  const groove = (ax, az, bx, bz, y = 0) => {
    const L = Math.hypot(bx - ax, bz - az) + 1, ry = Math.atan2(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    K.add(M.dark, box(1.0, 0.04, L, cx, y + 0.02, cz, ry));
    for (const s of [-1, 1]) K.add(M.trim, box(0.25, 0.12, L, cx + Math.cos(ry) * 0.75 * s, y + 0.06, cz - Math.sin(ry) * 0.75 * s, ry));
  };

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-12.2, 12.6, 12.2, 12.6, 0, 13, { t: 1.2, holes: [{ at: 12.2, w: 6, h: 7 }] });

  // ---- the Hall of Spheres (z 12.6..44): one white sphere in a groove past three carved prints; three prints by the
  // east wall; the walker's print (three toes) carved over the door
  K.hall({ x: 0, z: 28.3, w: 22, d: 31.4, y: 0, h: 13, roof: 'oculus', oculus: 0.25, columns: 3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.6 }] });
  const SZ0 = 18, SZ1 = 40.4, SL = SZ1 - SZ0;
  K.add(M.dark, box(1.0, 0.04, SL, -4, 0.02, (SZ0 + SZ1) / 2));
  for (const s of [-1, 1]) K.add(M.trim, box(0.25, 0.12, SL, -4 + s * 0.75, 0.06, (SZ0 + SZ1) / 2));
  add(Ball, { id: 'ball1', a: [-4, 0.04, SZ0], b: [-4, 0.04, SZ1], r: 1.2 });
  for (const [id, t, toes] of [['pa', 0.3, 2], ['p1', 0.62, 3], ['pb', 0.92, 4]]) add(Plate, { id, at: [-4, 0, SZ0 + SL * t], r: 1.4, print: toes });
  for (const [id, z, toes] of [['pX', 22, 4], ['pW', 29, 3], ['pY', 36, 2]]) add(Plate, { id, at: [7.4, 0, z], r: 1.3, print: toes });
  K.add(M.glyph, T(printGeometry(3, 2.4).rotateX(-Math.PI / 2), [0, 9.6, 43.95]));   // the walker's print over the door
  add(Door, { id: 'd1', at: [0, 0, 44.6], w: 5, h: 6.6, lamps: [{ drumOn: ['ball1', 'p1'] }, { pressed: 'pW' }] });
  add(Mark, { room: 'spheres', at: [-7.5, 0, 15.5], yaw: Math.PI / 2 });

  // ---- the Still Pool (z 44..74): a sunken pool, a sphere floating in it, stepping stones that rise
  K.hall({ x: 0, z: 59.6, w: 20, d: 29.2, y: -6, h: 20, floor: false, roof: 'oculus', oculus: 0.3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6, y0: 6 }] });
  K.wall(-11.2, 45.2, 11.2, 45.2, -6, 20, { t: 1.2, holes: [{ at: 11.2, w: 5, h: 6.6, y0: 6 }] });   // (over the hall's door, down to the pool)
  K.slab(-10, 45.8, 10, 50, 0, 6);
  K.slab(-10, 69.2, 10, 74.2, 0, 6);
  const waterM = makeMaterial({ color: '#a8d0d6', glow: 0.15, flat: true, key: 'temple.spheres.pool' });
  K.add(waterM, box(20, 0.2, 19.2, 0, -2.6, 59.6));
  K.both(M.dark, box(20, 1, 19.2, 0, -6.5, 59.6));
  add(Pit, { room: 'pool', min: [-11, -8, 50], max: [11, -1.8, 69.2] });
  // the floating sphere (half sunk in the still water): pushed across, it settles in the berth at the far ledge's foot
  // the water stirs and draws it back to the near side unless you stand on the stilling stone at the ledge's edge
  add(Ball, { id: 'ball3', a: [-4.5, -3.3, 51.8], b: [-4.5, -3.3, 67.4], r: 1.5, friction: 0.45,
    current: { pull: 0.7, still: { pressed: 'pS' }, stirs: 'The water stirs, and draws the sphere back to you.', stilled: 'Under your feet the stone hums, and the pool goes glassy still.' } });
  add(Plate, { id: 'pS', at: [-4.5, 0, 48.0], r: 1.0 });
  K.add(M.trim, T(new THREE.TorusGeometry(1.8, 0.18, 5, 20, Math.PI), [-4.5, -2.45, 68.6], [Math.PI / 2, 0, Math.PI]));   // the berth's lip
  add(Bridge, { id: 'stones', a: [3.5, 0, 49.9], b: [3.5, 0, 69.3], w: 3.4, n: 7 });
  add(Mark, { room: 'pool', at: [-7.6, 0, 46.6], yaw: Math.PI / 2 });

  // ---- the corridor and the Lens Chamber (floor 0): the chest; the way on is wall without the lens
  K.slab(-3.2, 74.2, 3.2, 76.6, 0, 0.8);
  K.wall(-3.2, 74.8, -3.2, 76.6, 0, 6.5, { t: 0.8 }); K.wall(3.2, 76.6, 3.2, 74.8, 0, 6.5, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.9, 75.6));
  const C3 = 86.6;
  K.rotunda({ x: 0, z: C3, y: 0, r: 9, h: 14, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6.4 }, { a: -Math.PI / 2, w: 4.2, h: 6.2 }], oculus: 0.35 });
  // the dais, solid as drawn: its two steps as cylinders (the lathe alone gave no top a ray from above
  // could land on, so the chest stood on the floor, sunk into the dais to its lid: the QC pass)
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 0, C3), new THREE.CylinderGeometry(2.5, 2.5, 0.62, 28).translate(0, 0.31, C3));
  K.solid(new THREE.CylinderGeometry(3, 3, 0.3, 28).translate(0, 0.15, C3));
  // the lens shows the walker's print on the east wall over a stone carrying the same, and its prints from the dais
  // to the way on (the clue of the stones over the chasm, a room on: no lock here)
  add(Mural, { id: 'mural', at: [8.9, 3.6, C3], yaw: -Math.PI / 2, prints: [[0.9, C3 + 4.2, 0.15], [-0.7, C3 + 5.8, -0.1], [0.8, C3 + 7.4, 0.1]] });
  // the keepers' door in the west wall: plain wall from here, through the lens a door that will not open (its eye is
  // on its far side, in the gallery)
  add(Door, { id: 'sc', at: [-9.7, 0, C3], yaw: Math.PI / 2, w: 4.2, h: 6.2, t: 1.6, hidden: true, lamps: [{ lit: 'ssc' }] });
  add(Mark, { room: 'lens', at: [5.6, 0, C3 - 4.5], yaw: -Math.PI * 0.75 });

  // ---- the Hall of the Unseen (z 97..131): a chasm under stones only the lens shows, the walker's holding
  const U0 = C3 + 10.4;   // 97
  K.slab(-3.2, C3 + 9.6, 3.2, U0 + 0.6, 0, 0.8);
  K.hall({ x: 0, z: U0 + 17.2, w: 22, d: 34.4, y: -10, h: 26, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 10 }, { side: 'n', w: 5, h: 6.4, y0: 10 }, { side: 'w', at: GALLERY_Z - (U0 + 17.2), w: 4, h: 6, y0: 10 }] });
  K.slab(-11, U0, 11, U0 + 6, 0, 10);
  K.slab(-11, U0 + 26, 11, U0 + 34.4, 0, 10);
  K.both(M.dark, box(22, 1, 20, 0, -10.5, U0 + 16));
  // the chasm's lips, broken rock hanging under the ledges' edges
  for (let i = 0; i < 9; i++) for (const [z, s] of [[U0 + 6, 1], [U0 + 26, -1]]) K.add(M.stone, T(new THREE.IcosahedronGeometry(0.9 + (i % 3) * 0.35, 0).scale(1.2, 1.6, 0.8), [-9.6 + i * 2.4, -1.4 - (i % 2) * 0.8, z + s * 0.35], [0.3 * i, i, 0]));
  add(Pit, { room: 'unseen', min: [-12, -12, U0 + 6], max: [12, -3, U0 + 26] });
  add(LensStones, { id: 'br1', cells: STONES.map(([x, z, toes]) => ({ x, z: U0 + z, toes, real: toes === 3 })), y: 0, size: 3, a: [0, 0, U0 + 6], b: [0, 0, U0 + 26] });
  // the eye only the lens shows, high on the near wall: seen from the far landing, across the chasm
  add(Switch, { id: 's2', at: [-6, 6.5, U0 + 0.65], yaw: 0, size: 1.1, hidden: true });
  // the far landing: a sphere's groove past two plain prints (two toes, four) and the walker's, which only the lens shows
  const FL = U0 + 28;   // 125
  groove(-8.6, FL, 8.6, FL);
  add(Ball, { id: 'ball4', a: [-8.6, 0.04, FL], b: [8.6, 0.04, FL], r: 0.9 });
  for (const [id, t, toes, hidden] of [['pf1', 0.3, 2, false], ['p4', 0.62, 3, true], ['pf2', 0.9, 4, false]]) add(Plate, { id, at: [-8.6 + 17.2 * t, 0, FL], r: 1.0, print: toes, hidden, yaw: Math.PI / 2 });
  add(Door, { id: 'd4', at: [0, 0, U0 + 35], w: 5, h: 6.4, lamps: [{ lit: 's2' }, { drumOn: ['ball4', 'p4'] }] });
  // two pillars topped with spheres either side of the far door (as drawn in the picked reference)
  for (const s of [-1, 1]) { K.column(s * 5.2, U0 + 33.6, 0, 6.2, 0.6); K.both(M.stone, new THREE.SphereGeometry(0.85, 16, 10).translate(s * 5.2, 7.05, U0 + 33.6)); }
  add(Mark, { room: 'unseen', at: [-7, 0, U0 + 3], yaw: 0 });
  for (let i = 0; i < 4; i++) K.glyph([10.95, 6 + (i % 2) * 2, U0 + 6 + i * 6], 1.3, -Math.PI / 2);

  // ---- the Keepers' Gallery: from the far landing's west door round outside the hall, back to the Lens Chamber
  const GX0 = -15.4, GX1 = -12.2;
  K.slab(GX0, GALLERY_S, GX1, GALLERY_Z + 2.4, 0, 0.8);
  K.slab(GX1 - 0.1, GALLERY_Z - 2.2, -10.9, GALLERY_Z + 2.2, 0, 0.8);    // (the step through the hall's west door)
  K.wall(GX0, GALLERY_S, GX0, GALLERY_Z + 2.4, 0, 6.5, { t: 0.8 });
  K.wall(GX0, GALLERY_Z + 2.4, GX1, GALLERY_Z + 2.4, 0, 6.5, { t: 0.8 });
  K.wall(GX0, GALLERY_S, -10.2, GALLERY_S, 0, 6.5, { t: 0.8 });
  K.wall(GX1 + 0.4, C3 + 2.2, GX1 + 0.4, U0 - 0.6, 0, 6.5, { t: 0.8 });
  K.wall(GX1, C3 + 2.2, -10.2, C3 + 2.2, 0, 6.5, { t: 0.8 });
  K.slab(GX1 - 0.1, C3 - 2.0, -9.6, C3 + 2.0, 0, 0.8);                 // (the spur to the Lens Chamber's west door)
  K.both(M.wall, box(GX1 - GX0 + 0.8, 0.8, GALLERY_Z + 2.4 - GALLERY_S + 0.8, (GX0 + GX1) / 2, 6.9, (GALLERY_S + GALLERY_Z + 2.4) / 2));
  K.both(M.wall, box(2.8, 0.8, 4.6, -10.8, 6.9, C3));
  for (let i = 0; i < 5; i++) K.glyph([GX0 + 0.45, 3.4, C3 + 8 + i * 8.5], 1.0, Math.PI / 2);
  add(Switch, { id: 'ssc', at: [-11.0, 2.6, C3 + 1.5], yaw: Math.PI, size: 0.9, hidden: true });

  // ---- the corridor, and the Echo's Hall (floor 0, a round hall under a great oculus)
  const H0 = U0 + 35;     // 132
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 0, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 0, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 0, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 7.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 0, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 20, CH = H0 + 3.2 + HR + 1.4;   // 156.6
  K.rotunda({ x: 0, z: CH, y: 0, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.45 });
  K.add(M.glyph, T(glyphGeometry(9, 0.05).rotateX(-Math.PI / 2), [0, 0.03, CH]));
  // the three resonant spheres round the hall, one note each
  const res = [0, 1, 2].map((i) => {
    const a = (i / 3) * TAU + Math.PI / 3;
    return add(Resonator, { i, at: [Math.sin(a) * 13, 0, CH + Math.cos(a) * 13], face: [0, 0, CH], color: NOTES[i], onHit: (r, mode) => resonate(rt, r, mode) });
  });
  add(Door, { id: 'd5', at: [0, 0, CH + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CH + HR + 0.6, 3.2, CH + HR + 10, 0, 0.8);
  K.wall(-3.2, CH + HR + 1.4, -3.2, CH + HR + 10, 0, 7, { t: 0.8 }); K.wall(3.2, CH + HR + 10, 3.2, CH + HR + 1.4, 0, 7, { t: 0.8 });
  K.wall(3.2, CH + HR + 10, -3.2, CH + HR + 10, 0, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 7.4, CH + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 0, CH + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, 2.5, CH + HR + 10.9));

  const model = echoModel();
  model.pos.copy(K.world(0, 0, CH + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 0, CH + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 0, CH), r: HR, y: K.world(0, 0, 0).y };
  rt.resonators = res;

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -14, -3), V(24, 40, CH + HR + 12)),
    gadget: { at: W(0, 0.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 0.5, CH + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 14], [0, 7, 22, 18], [0, 7, 38, 18], [0, 6, 59, 20], [0, 8, C3, 16], [0, 8, U0 + 10, 20], [0, 8, U0 + 28, 18], [0, 10, CH, 30]],
    guardian: { def: { ...ECHO, onHit: echoHit, onStrike: () => {} }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Footprint in the meadow
function exterior(scene, level, rt) {
  const H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const yaw = SITE.heading;
  const y0 = H(SITE.x, SITE.z);
  const K = new TempleKit(rt.root, 'The Footprint', V(SITE.x, y0, SITE.z), yaw, rt.M);
  const M = rt.M;
  // the print: a heel round the sphere and three long toes reaching back (local -z), each outlined by a low white rim
  const R = 18;   // the heel-sphere's radius
  const toes = [[-0.55, 54, 9], [0, 64, 10], [0.55, 54, 9]];   // [angle off -z, length, width]
  const rim = [], pads = [];
  const ringPts = (cx, cz, rx, rz, n = 40) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return [cx + Math.sin(a) * rx, cz + Math.cos(a) * rz]; });
  const outline = (pts) => {
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
      const L = Math.hypot(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const gy = H(...K.world(mx, 0, mz).toArray().filter((_, k) => k !== 1)) - y0;
      rim.push(T(new THREE.BoxGeometry(1.4, 1.6, L + 0.3), [mx, gy + 0.5, mz], [0, Math.atan2(bx - ax, bz - az), 0]));
    }
  };
  outline(ringPts(0, -4, R + 9, R + 7));
  for (const [a, len, w] of toes) {
    const pts = [];
    const dir = [Math.sin(a + Math.PI), Math.cos(a + Math.PI)], side = [dir[1], -dir[0]];
    const base = [dir[0] * (R + 4), dir[1] * (R + 4) - 4];
    for (let i = 0; i <= 10; i++) { const k = i / 10, ww = w * (1 - k * 0.55); pts.push([base[0] + dir[0] * len * k + side[0] * ww, base[1] + dir[1] * len * k + side[1] * ww]); }
    for (let i = 10; i >= 0; i--) { const k = i / 10, ww = w * (1 - k * 0.55); pts.push([base[0] + dir[0] * len * k - side[0] * ww, base[1] + dir[1] * len * k - side[1] * ww]); }
    outline(pts);
    pads.push({ a, len, w, base, dir });
  }
  for (const g of rim) K.both(M.stone, g);
  // the heel: a great pale sphere half sunk, a ring of white steps round it, a round door toward the grove
  K.both({ paint: new THREE.Color('#f7f3ea'), smooth: true }, new THREE.SphereGeometry(R, 48, 24, 0, TAU, 0, Math.PI * 0.62).translate(0, -R * 0.36, 0));   // (as drawn: a 24-sided stand-in lay inside the heel you climb)
  K.both(M.floor, T(annulus(R * 0.9, R + 4, 0.8, 48), [0, 0.6, 0]));
  K.both(M.trim, T(annulus(R + 3.6, R + 5.2, 0.5, 48), [0, 0.2, 0]));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; K.add(M.glyph, T(glyphGeometry(2.2, 0.15), [Math.sin(a) * (R * 0.93), R * 0.33, Math.cos(a) * (R * 0.93)], [-0.35, a, 0])); }
  K.add(M.glyph, T(glyphGeometry(5, 0.2).rotateX(-Math.PI / 2), [0, R * 0.64 - 0.05, 0]));
  // the doorway: a round-headed porch cut into the sphere's south side
  const z0 = R * 0.78, z1 = R + 3.4;
  for (const s of [-1, 1]) K.both(M.wall, box(3.4, 9, z1 - z0, s * 3.9, 4.5 + 0.6, (z0 + z1) / 2));
  K.both(M.wall, T(new THREE.CylinderGeometry(5.6, 5.6, z1 - z0, 24, 1, false, Math.PI / 2, Math.PI), [0, 8.1, (z0 + z1) / 2], [Math.PI / 2, 0, 0]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.4, 7.4).translate(0, 3.7, 0), [0, 0.6, 16.4]));
  K.solid(box(4.4, 7.4, 0.6, 0, 4.3, 16.1));
  // the round-headed door after the picked entrance (references/temples/footprint/sheet-2.jpg): a band of sage green
  // round the opening, the door's round boss over it, and a path of white slabs along the print's rim to the porch
  const sage = { paint: new THREE.Color('#8fb39c'), smooth: false };
  for (const s of [-1, 1]) K.both(sage, box(0.5, 5.2, 0.3, s * 2.45, 3.2, z1 + 0.18));
  K.both(sage, T(new THREE.TorusGeometry(2.45, 0.26, 5, 20, Math.PI), [0, 5.8, z1 + 0.18]));
  K.both(M.trim, T(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 18), [0, 9.2, z1 + 0.2], [Math.PI / 2, 0, 0]));
  K.add(sage, T(new THREE.TorusGeometry(0.62, 0.1, 4, 18), [0, 9.2, z1 + 0.36]));
  for (let i = 0; i < 9; i++) {
    const a = 0.2 + i * 0.075, r = R + 7.5 + i * 0.9, x = Math.sin(a) * r * 0.6 + 2 + i * 1.4, z = R + 8.4 + i * 2.6;
    const gy = H(...K.world(x, 0, z).toArray().filter((_, k) => k !== 1)) - y0;
    K.add(M.floor, box(2.6, 0.25, 2.2, x, gy + 0.1, z, a));
  }
  K.both(M.floor, box(9, 0.6, 7, 0, 0.3, R + 4.6));
  K.flush();
  const at = K.world(0, 0.6, 17.4);
  const front = K.world(0, 0, R + 9);
  return { door: { at, heading: yaw }, kit: K, base: y0, doorY: y0 + 0.6, R, pads, top: y0 + R,
    clear: [{ x: SITE.x, z: SITE.z, r: R + 10 }, ...pads.map((p) => { const c = K.world(p.base[0] + p.dir[0] * p.len * 0.5, 0, p.base[1] + p.dir[1] * p.len * 0.5); return { x: c.x, z: c.z, r: p.len * 0.55 }; }), { x: front.x, z: front.z, r: 10 }] };
}

// ------------------------------------------------------------------ the world change: the Footprint fills, the spheres ring
/**
 * Once the Echo is calm: the Footprint's toes and heel fill with still water
 * (pale, glowing a little at night), and every sphere in the garden wears a
 * ring of the glyph's light at its foot, breathing slowly, in step.
 */
function change(scene, level, rt) {
  const root = new THREE.Group();
  root.name = 'The Footprint’s water, the spheres’ rings (the world change)';
  scene.add(root);
  root.visible = false;
  const O = rt.outside, H = (x, z) => level.ground?.heightAt?.(x, z) ?? 0;
  const water = makeMaterial({ color: '#bfe0e2', glow: 0.25, flat: true, side: THREE.DoubleSide, key: 'temple.spheres.water' });
  if (O) {
    const K = O.kit, geos = [];
    for (const p of O.pads) {
      // each toe's floor of water: a strip of quads following the ground
      for (let i = 0; i < 10; i++) {
        const k0 = i / 10, k1 = (i + 1) / 10, w0 = p.w * (1 - k0 * 0.55) - 1.2, w1 = p.w * (1 - k1 * 0.55) - 1.2;
        const side = [p.dir[1], -p.dir[0]];
        const pts = [[k0, -w0], [k0, w0], [k1, -w1], [k1, w1]].map(([k, w]) => {
          const lx = p.base[0] + p.dir[0] * p.len * k + side[0] * w, lz = p.base[1] + p.dir[1] * p.len * k + side[1] * w;
          const wp = K.world(lx, 0, lz);
          return [wp.x, H(wp.x, wp.z) + 0.35, wp.z];
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...pts[0], ...pts[2], ...pts[1], ...pts[1], ...pts[2], ...pts[3]], 3));
        g.computeVertexNormals();
        geos.push(g);
      }
    }
    const pools = new THREE.Mesh(mergeGeometries(geos), water);
    pools.userData.noCollide = true;
    root.add(pools);
  }
  // a ring of light round the foot of every sphere in the garden
  const ringM = makeMaterial({ color: '#a8e6ee', glow: 0.6, flat: true, key: 'temple.spheres.rings' });
  const rings = [];
  for (const o of level.spheres?.orbs ?? []) {
    const gy = H(o.x, o.z);
    const r = Math.sqrt(Math.max(0.5, o.R * o.R - (gy - o.y) ** 2)) + 0.6;
    rings.push(new THREE.TorusGeometry(r, 0.14, 4, Math.max(16, Math.round(r * 4))).rotateX(Math.PI / 2).translate(o.x, gy + 0.2, o.z).toNonIndexed());
  }
  if (rings.length) {
    const m = new THREE.Mesh(mergeGeometries(rings.map((g) => { g.deleteAttribute('uv'); return g; })), ringM);
    m.userData.noCollide = true;
    root.add(m);
  }
  let k = 0, want = 0;
  return {
    root,
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) k = want; root.visible = k > 0.01; },
    update(dt, t) {
      k += (want - k) * Math.min(1, dt / 6);
      root.visible = k > 0.01;
      if (!root.visible) return;
      ringM.uniforms.uGlow.value = (0.35 + 0.35 * Math.sin(t * 0.6)) * k;
      water.uniforms.uGlow.value = 0.2 * k;
      // the Echo's own resonators, inside, hum in turn
      if (rt.resonators && rt.logic.resolved) rt.sing = Math.floor(t * 0.5) % 3;
    },
  };
}

export const SPHERES_TEMPLE = {
  id: 'spheres', levelId: 'spheres', name: 'The Footprint', doorLabel: 'door in the Footprint’s heel',
  gadget: 'lens', gadgetBox: 'spheres.temple.lens', arenaDoor: 'd4',
  origin: [-120, 2000, -260], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'tessa', out: 12, side: 7 },   // (src/temples/index.js: who stands by the door and points you in)
  enterLine: 'Inside the heel it is white and round and very quiet, the kind of quiet a sphere keeps.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, the Footprint fills with still water, and every sphere in the garden wears a ring of light.', 'resolved.out'); },
  // the Echo sings a note (one of the three spheres) whenever it opens
  onConnect(rt) {
    const G = rt.guardian;
    if (!G) return;
    const enter = G.enter.bind(G);
    // (its last phase: three notes at once, all three spheres glow; the walker's print, through the lens, on the one)
    G.enter = (state) => { enter(state); if (state === 'open') { rt.sing = Math.floor(Math.random() * 3); rt.singAll = G.phaseIndex >= 2; } else if (!rt.logic.resolved) { rt.sing = -1; rt.singAll = false; } };
    rt.sing = -1; rt.singAll = false;
  },
};
