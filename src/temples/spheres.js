import { landmark, landmarkFrame } from './landmarks.js';
import { glazing, glaze } from './landmark-materials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { registerTarget } from '../targets.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, ANTE, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Bridge, LensStones, Mark, Pit, Key, printGeometry } from './pieces.js';
import { echoModel } from './guardians.js';
import { chestMound } from '../boxes/mound.js';

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
// Inside (built far overhead, through its door). Since v1.77 (issue #336, docs/design/temple-redesign.md) its rooms are
// shrines: every hall 30 to 32 m across under 18 m, the round halls 34 and 40 m, doors 7 by 9 (ROOMS, DOOR), each puzzle in
// the middle of its own room, the one fight in the Keepers' Lodge.
//   the Threshold          the first mark, the way out
//   the Hall of Spheres    where the walker set a sphere down, and where it stood: one white sphere in a groove that
//                          runs down the middle past three prints carved in the floor (two toes, three, four), and
//                          three prints in a row beside it. The door wants the sphere on the walker's print and your
//                          weight on the walker's print beside it: three toes, like the Footprint outside and the print carved
//                          over the door (the push and your weight, before the lens; the decoys plain to see)
//   the Still Pool         a sphere floating in the sunken pool: push it across the still water onto the far berth,
//                          and the stepping stones rise
//   the Lens Chamber       the makers' chest: the GLYPH LENS (src/items.js 'lens'). Through it the stele by the chest
//                          shows the walker's print, three toes, and its prints lead on over the floor (the clue, no lock)
//   the Hall of the Unseen a chasm; the lens shows a field of stepping stones, each with a print: only the walker's
//                          hold (pieces.js LensStones), the rest crumble. On the far landing a sphere's groove past
//                          two plain prints of two and four toes and the walker's, which only the lens shows; and an
//                          eye only the lens shows on a pillar out of the chasm, facing the far landing: both open the
//                          far door
//   the Keepers' Gallery   a long hall from the far landing back round to the Lens Chamber: a door plain wall from
//                          the chest's side, opened by an eye only the lens shows on a post before it, on its far side
//                          (the shortcut)
//   the Keepers' Lodge     (v1.53, issue #23: off the Keepers' Gallery, an arena, the house's one fight) where the
//                          walker's keepers rested; its door shuts behind you while they stand round its middle. Won, the small key's cage sinks: the far door
//                          takes it, with the eye and the sphere on the walker's print
//   the Echo's Hall        the guardian (a being of sound: you calm it). It sings, and one of the three
//                          resonant spheres round the hall glows with the note: splash that one. Through the lens
//                          the sphere that answers wears the walker's print (taught in its second phase); in its last
//                          all three glow at once, and only the print tells
//   the way out            (v1.54, issue #178) past the Echo, up through the keepers' stone at the white hill's foot
// After: the toes and the heel of the Footprint fill with still water, and every sphere in the garden
// wears a ring of the glyph's light (the world change).

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** North of the grove, behind the spawn; the heel's door looks south, toward the umbrella grove. */
export const SITE = { x: -250, z: 250, r: 26 };
SITE.heading = Math.atan2(0 - SITE.x, 0 - SITE.z);
/**
 * The keepers' way out (v1.54, issue #178: the walk home from the heel's door was 336 m back the way you came, past
 * nothing): once the Echo is calm, the hall's way out lets you up through the keepers' stone, a round white slab with
 * the walker's print by the white hill's stair, where the hill's path runs home east to the grove
 * (src/levels/spheres.js). `y`: the ground there; `heading`: toward the grove.
 */
export const KEEPERS_STONE = { x: -196, z: -50, y: 0.5, r: 1.7 };
KEEPERS_STONE.heading = Math.atan2(0 - KEEPERS_STONE.x, -30 - KEEPERS_STONE.z);

/**
 * The Footprint's colours (the temple visual pass, docs/audits/temple-visuals-v1.32.md, after references/temples/footprint):
 * white plaster in big smooth panels, pale lavender in its shade (the Garden's world prints its shade in sage, and turned
 * the house green with it), warm cream light, the fittings (plate rims, door bands) the sage of its door, round
 * portholes under the friezes, the glyphs lit amber.
 */
export const PALETTE = {
  wall: '#f4f0f2', wall2: '#eee8ee', wall3: '#f9f6f6', floor: '#efe9e5', floor2: '#e3dbd7', trim: '#f7f3f4', fitting: '#93b29c',
  dark: '#4f5a80', stone: '#f2ece8', accent: '#e8b9c4', glow: '#a8e6ee', glyph: '#f0b450', lamp: '#f6c84e', sand: '#e9e1d0', sand2: '#ddd3c0',
  look: {
    all: { shadeFlat: 0.1, shadeHue: 0.75, shade: 0.42, spot: 0.25 },
    wall: { mode: 0, grid: 4.5 },
    glyph: { glow: 0.6 },
  },
  bands: [{ at: 0.72, h: 0.6, color: '#e8e1ee' }],
  ornament: { kind: 'porthole', color: '#e6dfe8', color2: '#8794b8' },
  light: { shadow: '#c3b6da', light: '#fff4e2', sun: '#ffeccc' },
};

/**
 * The house's doors (m: issue #336, 5 by 6 to 6.6 before) and its rooms in the kit's local frame (z into the house): each
 * hall's floor from wall to wall (its walls stand outside it), its floor's height and its ceiling's; the round halls'
 * middles and radii. The Still Pool and the Hall of the Unseen stand on their pits' floors (`y`): their near ledges
 * `near` deep, their pits `pit` long, the far ledge the rest (the floors you stand on at 0). Every groove, the pool and
 * the chasm as long as they were, so every push and every crossing holds.
 */
export const DOOR = { w: 7, h: 9 };
export const ROOMS = {
  threshold: { x0: -10, x1: 10, z0: 0, z1: 14, y: 0, top: 12 },
  spheres: { x0: -16, x1: 16, z0: 15.2, z1: 55.2, y: 0, top: 18 },
  pool: { x0: -16, x1: 16, z0: 56.4, z1: 88.4, y: -6, top: 18, near: 8, pit: 19.2 },
  lens: { x: 0, z: 109, r: 17, y: 0, top: 18 },
  unseen: { x0: -16, x1: 16, z0: 129, z1: 169, y: -10, top: 18, near: 6, pit: 20 },
  // (the gallery and the Lodge east of the chamber and the chasm since v1.77: the white hill's tree stands under the west
  // side, its canopy and the terrace reached from the sky down, tests/spheres.test.js)
  gallery: { x0: 21, x1: 51, z0: 102, z1: 168, y: 0, top: 18 },
  lodge: { x0: 59, x1: 89, z0: 120, z1: 150, y: 0, top: 18 },
};

export const LOGIC = {
  id: 'spheres', entry: 'threshold', gadget: 'lens',
  // (the Lens Chamber and the Hall of the Unseen's near ledge are one room: the passage between them is open, and
  // nothing past the chest's room opens without the lens)
  // (each room's kind, issue #336: a puzzle, a fight, the chest, a passage or the guardian, never both a puzzle and a
  // fight; src/foes.js places machines only in a fight's room: scripts/temple-design/rules.mjs, tests/temple-rules.test.js.
  // The Lens Chamber a puzzle room: the chest in its middle, the mural on a stele beside it)
  rooms: {
    threshold: { checkpoint: true, kind: 'passage' }, spheres: { checkpoint: true, kind: 'puzzle' }, pool: { checkpoint: true, kind: 'puzzle' },
    lens: { checkpoint: true, kind: 'puzzle' }, unseenFar: { kind: 'puzzle' }, gallery: { kind: 'puzzle' }, lodge: { checkpoint: true, kind: 'combat' },
    hall: { boss: true, kind: 'guardian' }, out: { kind: 'passage' },
  },
  links: [
    { a: 'threshold', b: 'spheres' },
    { a: 'spheres', b: 'pool', door: 'd1' },
    { a: 'pool', b: 'lens', door: 'stones' },
    { a: 'lens', b: 'unseenFar', door: 'br1' },
    { a: 'unseenFar', b: 'gallery' },                // the far landing's side door (west before v1.77, east since), into the keepers' gallery
    { a: 'lens', b: 'gallery', door: 'sc' },          // the gallery's door into the Lens Chamber: opened from its far side
    { a: 'gallery', b: 'lodge', door: 'dR' },        // the Keepers' Lodge, off the gallery (v1.53): an arena, the small key
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
    // an eye only the lens shows, on a pillar out of the chasm facing the far landing (v1.77; high on the near wall
    // before, the Lens Chamber's room): the far landing's
    s2: { type: 'switch', room: 'unseenFar', needs: ['lens'] },
    // the far landing: a sphere's groove past two plain prints and the walker's, which only the lens shows
    pf1: { type: 'plate', room: 'unseenFar' },
    p4: { type: 'plate', room: 'unseenFar' },
    pf2: { type: 'plate', room: 'unseenFar' },
    ball4: { type: 'drum', room: 'unseenFar', stops: { pf1: 0.3, p4: 0.62, pf2: 0.9 }, start: 0 },
    // (d4 and d5 carry the Echo's Hall's room: the redesign's rules measure the hall by its two doors, it has no mark)
    d4: { type: 'door', lock: 'small', opens: { all: [{ lit: 's2' }, { drumOn: ['ball4', 'p4'] }] }, latch: true, room: 'hall' },   // (and since v1.53 the Lodge's small key)
    ssc: { type: 'switch', room: 'gallery', needs: ['lens'] },          // the gallery's eye by the door, its far side
    sc: { type: 'door', opens: { lit: 'ssc' }, latch: true },
    // the Keepers' Lodge: its keepers beaten, the small key's cage sinks (v1.53)
    arL: { type: 'arena', room: 'lodge' },
    kS: { type: 'key', kind: 'small', room: 'lodge', when: { lit: 'arL' } },
    dR: { type: 'door', opens: null },
    echo: { type: 'boss', room: 'hall', needs: ['gun', 'lens'] },
    d5: { type: 'door', opens: { resolved: true }, room: 'hall' },
  },
};

export const ECHO = {
  kind: 'organic', name: 'the Echo', final: 'touch', touch: 'hold out your hand to it',
  speed: 2.6, wakeTime: 3,
  wake: 'Rings of glass round a pale heart sing one loud note at you. It is lost.',
  openHint: 'It sings, and one sphere round the hall glows. Splash that one.',
  weary: 'It sinks to the floor, humming, listening for you now.',
  resolved: 'The Echo hums with all three spheres at once, and stays quiet.',
  missHint: 'It lies on the floor ringing: splash the sphere that glows.',
  phases: [
    { to: 0.45, attacks: ['note', 'pulse', 'ripple'], pause: 1.7, hint: 'When it sings, answer it: splash the sphere that glows with its note.' },
    { to: 0.75, attacks: ['fall', 'chord', 'note'], pause: 1.3, hint: 'Keep answering it: through your lens, the right sphere wears the print.' },
    { to: 0.9, attacks: ['scale', 'ripple', 'fall'], pause: 1.1, hint: 'All three spheres glow now: splash the one with the walker’s print.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    note: { shape: 'ring', at: 'player', lob: true, volley: 1, radius: 3.4, wind: 1.4, track: 0.6, part: 'core', rig: 'spin', damage: 0.75, knock: 8, recover: 0.8, open: 3.2 },
    pulse: { shape: 'ring', at: 'self', radius: 6, wind: 1.4, part: 'core', rig: 'swell', wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 1, knock: 12, recover: 0.8 },
    ripple: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'core', rig: 'swell', blast: { kind: 'front', r0: 2, h: 0.8 }, gap: 0.7, damage: 0.5, knock: 9, recover: 0.4, then: 'ripple2' },
    ripple2: { shape: 'ring', at: 'self', radius: 6, wind: 0.7, part: 'core', rig: 'swell', pose: 'ripple', link: true, blast: { kind: 'front', r0: 2, h: 0.8 }, damage: 0.5, knock: 9, gap: 0.25, then: 'pulseEnd' },
    pulseEnd: { shape: 'ring', at: 'self', radius: 6, wind: 1.2, part: 'core', rig: 'swell', pose: 'pulse', link: true, wave: { speed: 9, reach: 16, width: 0.7, damage: 0.5 }, blast: { kind: 'front', r0: 2, h: 1.4 }, damage: 1, knock: 12, recover: 0.8, open: 3.2 },
    chord: { shape: 'lane', range: 26, width: 3, wind: 1.5, track: 0.7, part: 'core', rig: 'lean', blast: { kind: 'front', r0: 2, r1: 24, h: 1.6 }, active: 1.0, damage: 0.75, knock: 10, recover: 0.9, open: 2.8 },
    fall: { shape: 'ring', at: 'player', radius: 4, wind: 1.5, track: 0.6, over: true, part: 'core', rig: 'rise', parts: ['body'], splash: 0.5, active: 0.45, damage: 0.75, knock: 9, recover: 0.8, miss: 3.0 },
    scale: { shape: 'ring', at: 'player', lob: true, volley: 3, radius: 2.2, wind: 1.4, track: 0.6, part: 'core', rig: 'spin', pose: 'note', damage: 0.5, knock: 6, recover: 0.5, then: 'chordEnd' },
    chordEnd: { shape: 'lane', range: 26, width: 3, wind: 1.2, track: 0.6, part: 'core', rig: 'lean', pose: 'chord', link: true, blast: { kind: 'front', r0: 2, r1: 24, h: 1.6 }, active: 1.0, damage: 0.75, knock: 10, recover: 0.9, open: 2.8 },
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
// the keepers' gallery: where it meets the Hall of the Unseen's east door (z, on the far landing)
const GALLERY_Z = ROOMS.unseen.z0 + 33;
/**
 * The Still Pool (z): where the floating sphere starts (its groove's near end) and the stilling stone at the ledge's edge
 * (the ledge ends at 64.4; at 50 before v1.77). Stood on, the sphere is pushed from it: from its middle the push's line to
 * the sphere clears the ledge's edge (issue #311: with the stone 2 m short of the edge and the sphere 1.8 m past it only
 * its last 0.2 m did; from the rest the edge took the push).
 */
export const POOL = { ball: 67.0, still: 63.4 };
/** (v1.53) The Keepers' Lodge, off the Keepers' Gallery (an arena; since v1.77 the house's one fight, 30 m square). */
export const LODGE = (() => {
  const L = ROOMS.lodge;
  return { x: (L.x0 + L.x1) / 2, z: (L.z0 + L.z1) / 2, w: L.x1 - L.x0, d: L.z1 - L.z0, zone: { min: [L.x0, -1, L.z0], max: [L.x1, 9, L.z1] } };
})();
/** The Lodge's fight (src/temples/runtime.js updateArenas; src/foes.js places its keepers round its mark). */
export const ARENAS = [{
  el: 'arL', room: 'lodge', zone: LODGE.zone, doors: ['dR'], extra: 2,
  shut: 'The door grinds shut behind you. In the dark of the lodge, the keepers wake.',
  won: 'The last of them goes still. The key’s cage sinks, and the door lets go.',
}];
function echoHit(g, part, mode) {
  if (mode === 'push') { g.add(-0.05, 'push'); g.rt.notice('The shove scatters its rings. It sings louder, frightened.', 'echo.push'); return true; }
  g.rt.notice('The fluid passes through its light. It wants an answer, not water.', 'echo.fluid');
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
// (since v1.77, issue #336, docs/design/temple-redesign.md: every hall 30 to 32 m across under 18 m of stone, the round
// halls 34 and 40 m, doors 7 by 9; each puzzle in the middle of its room, the one fight in the Keepers' Lodge)
function layout(rt) {
  const K = rt.kit, M = rt.M, D = DOOR, R0 = ROOMS;
  const add = (P, o) => rt.add(P, o);
  const mid = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];
  const hall = (r, o = {}) => { const [x, z] = mid(r); return K.hall({ x, z, w: r.x1 - r.x0, d: r.z1 - r.z0, y: r.y, h: r.top - r.y, ...o }); };
  /** A sphere's groove on the floor from (ax, az) to (bx, bz): a dark channel between two trim lips (solid: stood on). */
  const groove = (ax, az, bx, bz, y = 0) => {
    const L = Math.hypot(bx - ax, bz - az) + 1, ry = Math.atan2(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
    K.add(M.dark, box(1.0, 0.04, L, cx, y + 0.02, cz, ry));
    for (const s of [-1, 1]) K.both(M.trim, box(0.25, 0.12, L, cx + Math.cos(ry) * 0.75 * s, y + 0.06, cz - Math.sin(ry) * 0.75 * s, ry));
  };

  // ---- the Threshold
  const TH = R0.threshold;
  hall(TH, { roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  add(Mark, { room: 'threshold', at: [-5, 0, 6.5], yaw: Math.PI / 2 });

  // ---- the Hall of Spheres: one white sphere in a groove down the middle past three carved prints; three prints in a row
  // beside it; the walker's print (three toes) carved over the door
  const SP = R0.spheres;
  hall(SP, { roof: 'oculus', oculus: 0.25, columns: 3, omit: ['n'], doors: [{ side: 's', w: D.w, h: D.h }] });
  const SZ0 = 24.2, SZ1 = 46.6, SL = SZ1 - SZ0, GX = -5;   // (the groove as long as it was: 22.4 m)
  K.add(M.dark, box(1.0, 0.04, SL, GX, 0.02, (SZ0 + SZ1) / 2));
  for (const s of [-1, 1]) K.both(M.trim, box(0.25, 0.12, SL, GX + s * 0.75, 0.06, (SZ0 + SZ1) / 2));
  add(Ball, { id: 'ball1', a: [GX, 0.04, SZ0], b: [GX, 0.04, SZ1], r: 1.2 });
  for (const [id, t, toes] of [['pa', 0.3, 2], ['p1', 0.62, 3], ['pb', 0.92, 4]]) add(Plate, { id, at: [GX, 0, SZ0 + SL * t], r: 1.4, print: toes });
  for (const [id, z, toes] of [['pX', SZ0 + 4, 4], ['pW', SZ0 + 11, 3], ['pY', SZ0 + 18, 2]]) add(Plate, { id, at: [6, 0, z], r: 1.3, print: toes });
  K.add(M.glyph, T(printGeometry(3, 2.4).rotateX(-Math.PI / 2), [0, 11.6, SP.z1 - 0.05]));   // the walker's print over the door
  add(Door, { id: 'd1', at: [0, 0, SP.z1 + 0.6], w: D.w, h: D.h, lamps: [{ drumOn: ['ball1', 'p1'] }, { pressed: 'pW' }] });
  add(Mark, { room: 'spheres', at: [-9, 0, SP.z0 + 3.3], yaw: Math.PI / 2 });

  // ---- the Still Pool: a sunken pool across the middle, a sphere floating in it, stepping stones that rise
  const PL = R0.pool, E = PL.z0 + PL.near, F = E + PL.pit, [, pz] = mid(PL), dy = -PL.y;
  hall(PL, { floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h, y0: dy }, { side: 'n', w: D.w, h: D.h, y0: dy }] });
  K.slab(PL.x0, PL.z0, PL.x1, E, 0, dy);
  K.slab(PL.x0, F, PL.x1, PL.z1, 0, dy);
  const waterM = makeMaterial({ color: '#a8d0d6', glow: 0.15, flat: true, key: 'temple.spheres.pool' });
  K.add(waterM, box(PL.x1 - PL.x0, 0.2, PL.pit, 0, -2.6, (E + F) / 2));
  K.both(M.dark, box(PL.x1 - PL.x0, 1, PL.pit, 0, PL.y - 0.5, (E + F) / 2));
  add(Pit, { room: 'pool', min: [PL.x0 - 1, PL.y - 2, E], max: [PL.x1 + 1, -1.8, F] });
  // the floating sphere (half sunk in the still water): pushed across, it settles in the berth at the far ledge's foot
  // the water stirs and draws it back to the near side unless you stand on the stilling stone at the ledge's edge
  add(Ball, { id: 'ball3', a: [-4.5, -3.3, POOL.ball], b: [-4.5, -3.3, POOL.ball + 14.8], r: 1.5, friction: 0.45,
    current: { pull: 0.7, still: { pressed: 'pS' }, stirs: 'The water stirs, and draws the sphere back to you.', stilled: 'Under your feet the stone hums, and the pool goes glassy still.' } });
  add(Plate, { id: 'pS', at: [-4.5, 0, POOL.still], r: 1.0 });
  K.add(M.trim, T(new THREE.TorusGeometry(1.8, 0.18, 5, 20, Math.PI), [-4.5, -2.45, F - 0.6], [Math.PI / 2, 0, Math.PI]));   // the berth's lip
  add(Bridge, { id: 'stones', a: [3.5, 0, E - 0.1], b: [3.5, 0, F + 0.1], w: 3.4, n: 7 });
  add(Mark, { room: 'pool', at: [-9, 0, PL.z0 + 3.1], yaw: Math.PI / 2 });

  // ---- the corridor and the Lens Chamber (floor 0, a round hall 34 m across): the chest in the middle, the mural on a
  // stele beside it; the way on is wall without the lens
  const LE = R0.lens, C3 = LE.z;
  K.corridor([0, PL.z1 + 0.6], [0, C3 - LE.r - 0.7], 0, { w: D.w, h: D.h });
  K.rotunda({ x: 0, z: C3, y: 0, r: LE.r, h: LE.top, seg: 32, gaps: [{ a: Math.PI, w: D.w, h: D.h }, { a: 0, w: D.w, h: D.h }, { a: Math.PI / 2, w: D.w, h: D.h }], oculus: 0.35 });
  K.both(M.trim, ...chestMound(0, 0, C3));   // (issue #162: a ramped mound, no steps: src/boxes/mound.js)
  // the lens shows the walker's print on the stele west of the chest, over a stone carrying the same, and its prints from
  // the dais to the way on (the clue of the stones over the chasm, a room on: no lock here). The stele solid, as drawn
  K.both(M.wall, box(0.8, 6.4, 4.8, -7.4, 3.2, C3));
  K.both(M.trim, box(1.2, 0.4, 5.2, -7.4, 6.6, C3));
  add(Mural, { id: 'mural', at: [-6.98, 3.6, C3], yaw: Math.PI / 2, prints: [[0.9, C3 + 4.2, 0.15], [-0.7, C3 + 5.8, -0.1], [0.8, C3 + 7.4, 0.1], [-0.6, C3 + 9.0, -0.05], [0.7, C3 + 10.6, 0.1], [-0.5, C3 + 12.2, 0]] });
  // the keepers' door in the east wall (the west before v1.77): plain wall from here, through the lens a door that will not open (its eye is
  // on its far side, in the gallery)
  add(Door, { id: 'sc', at: [LE.r + 0.7, 0, C3], yaw: Math.PI / 2, w: D.w, h: D.h, t: 1.6, hidden: true, lamps: [{ lit: 'ssc' }] });
  add(Mark, { room: 'lens', at: [8, 0, C3 - 8], yaw: -Math.PI * 0.75 });

  // ---- the Hall of the Unseen: a chasm across its middle under stones only the lens shows, the walker's holding; an eye
  // only the lens shows on a pillar out of the chasm, facing the far landing; on the far landing a sphere's groove past
  // two plain prints and the walker's
  const UN = R0.unseen, U0 = UN.z0, [, uz] = mid(UN), uy = -UN.y, Q0 = U0 + UN.near, Q1 = Q0 + UN.pit;
  K.corridor([0, C3 + LE.r + 0.7], [0, U0 - 0.6], 0, { w: D.w, h: D.h });
  hall(UN, { floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: D.w, h: D.h, y0: uy }, { side: 'n', w: D.w, h: D.h, y0: uy }, { side: 'e', at: GALLERY_Z - uz, w: D.w, h: D.h, y0: uy }] });
  K.slab(UN.x0, U0, UN.x1, Q0, 0, uy);
  K.slab(UN.x0, Q1, UN.x1, UN.z1, 0, uy);
  K.both(M.dark, box(UN.x1 - UN.x0, 1, UN.pit, 0, UN.y - 0.5, (Q0 + Q1) / 2));
  // the chasm's lips, broken rock hanging under the ledges' edges
  for (let i = 0; i < 12; i++) for (const [z, s] of [[Q0, 1], [Q1, -1]]) K.add(M.stone, T(new THREE.IcosahedronGeometry(0.9 + (i % 3) * 0.35, 0).scale(1.2, 1.6, 0.8), [-14.85 + i * 2.7, -1.4 - (i % 2) * 0.8, z + s * 0.35], [0.3 * i, i, 0]));
  add(Pit, { room: 'unseen', min: [UN.x0 - 1, UN.y - 2, Q0], max: [UN.x1 + 1, -3, Q1] });
  add(LensStones, { id: 'br1', cells: STONES.map(([x, z, toes]) => ({ x, z: U0 + z, toes, real: toes === 3 })), y: 0, size: 3, a: [0, 0, Q0], b: [0, 0, Q1] });
  // the eye only the lens shows, on a pillar out of the chasm by the near lip: its face toward the far landing (from the
  // near ledge you see the pillar's back)
  const EZ = Q0 + 3;
  K.both(M.wall, box(2.4, 7.6 - UN.y, 2.4, -8, (7.6 + UN.y) / 2, EZ));
  K.both(M.trim, box(2.8, 0.4, 2.8, -8, 7.8, EZ));
  add(Switch, { id: 's2', at: [-8, 6.0, EZ + 1.85], yaw: 0, size: 1.1, hidden: true });
  // the far landing: a sphere's groove past two plain prints (two toes, four) and the walker's, which only the lens shows
  const FL = Q1 + 2;
  groove(-8.6, FL, 8.6, FL);
  add(Ball, { id: 'ball4', a: [-8.6, 0.04, FL], b: [8.6, 0.04, FL], r: 0.9 });
  for (const [id, t, toes, hidden] of [['pf1', 0.3, 2, false], ['p4', 0.62, 3, true], ['pf2', 0.9, 4, false]]) add(Plate, { id, at: [-8.6 + 17.2 * t, 0, FL], r: 1.0, print: toes, hidden, yaw: Math.PI / 2 });
  add(Door, { id: 'd4', at: [0, 0, UN.z1 + 0.6], w: D.w, h: D.h, lamps: [{ lit: 's2' }, { drumOn: ['ball4', 'p4'] }] });
  // two pillars topped with spheres either side of the far door (as drawn in the picked reference)
  for (const s of [-1, 1]) { K.column(s * 6.4, UN.z1 - 1.4, 0, 8, 0.6); K.both(M.stone, new THREE.SphereGeometry(0.85, 16, 10).translate(s * 6.4, 8.85, UN.z1 - 1.4)); }
  add(Mark, { room: 'unseen', at: [-7, 0, U0 + 3], yaw: 0 });
  for (let i = 0; i < 4; i++) K.glyph([UN.x0 + 0.05, 7 + (i % 2) * 2.5, Q0 + i * 6], 1.3, Math.PI / 2);

  // ---- the Keepers' Gallery: a long hall east of the Lens Chamber and the Hall of the Unseen, from the far landing's east
  // door back to the chamber's keepers' door; its eye, only the lens shows, on a post before that door
  const GA = R0.gallery, [gx, gz] = mid(GA);
  hall(GA, { roof: 'oculus', oculus: 0.2, doors: [{ side: 'w', at: C3 - gz, w: D.w, h: D.h }, { side: 'w', at: GALLERY_Z - gz, w: D.w, h: D.h }, { side: 'e', at: LODGE.z - gz, w: D.w, h: D.h }] });
  K.corridor([LE.r + 0.7, C3], [GA.x0 - 0.6, C3], 0, { w: D.w, h: D.h });
  K.corridor([UN.x1 + 0.6, GALLERY_Z], [GA.x0 - 0.6, GALLERY_Z], 0, { w: D.w, h: D.h });
  for (const [x, z] of [[gx - 8, gz - 12], [gx + 8, gz - 12], [gx - 8, gz + 12], [gx + 8, gz + 12]]) K.column(x, z, 0, GA.top, 0.9);
  for (const i of [0, 1, 3, 4]) K.glyph([GA.x1 - 0.05, 4.4, GA.z0 + 9 + i * 12], 1.0, -Math.PI / 2);   // (not over the Lodge's door)
  // the eye's post, 9 m in from the keepers' door, facing it
  const SX = 29, SZ = 116, sy = Math.atan2(LE.r + 0.7 - SX, C3 - SZ);
  K.both(M.trim, box(1.6, 0.3, 1.6, SX, 0.15, SZ));
  K.both(M.wall, box(1.1, 2.1, 1.1, SX, 1.35, SZ));
  K.both(M.trim, box(1.4, 0.2, 1.4, SX, 2.5, SZ));
  add(Switch, { id: 'ssc', at: [SX + Math.sin(sy) * 0.65, 1.8, SZ + Math.cos(sy) * 0.65], yaw: sy, size: 0.9, hidden: true });

  // ---- the antechamber, and the Echo's Hall (floor 0, a round hall 40 m across under a great oculus)
  const H0 = UN.z1 + 0.6;
  const AE = K.vestibule(H0, 0);   // (the antechamber, ANTE: issue #195)
  add(Mark, { room: 'ante', at: [ANTE.half - 1, 0, (H0 + AE) / 2], yaw: -Math.PI / 2 });
  const HR = 20, CH = AE + 1.2 + HR;
  K.rotunda({ x: 0, z: CH, y: 0, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: D.w, h: ANTE.h }, { a: 0, w: D.w, h: D.h }], oculus: 0.45 });
  K.add(M.glyph, T(glyphGeometry(9, 0.05).rotateX(-Math.PI / 2), [0, 0.03, CH]));
  // the three resonant spheres round the hall, one note each
  const res = [0, 1, 2].map((i) => {
    const a = (i / 3) * TAU + Math.PI / 3;
    return add(Resonator, { i, at: [Math.sin(a) * 13, 0, CH + Math.cos(a) * 13], face: [0, 0, CH], color: NOTES[i], onHit: (r, mode) => resonate(rt, r, mode) });
  });
  // the way out, past the far door
  const X0 = CH + HR + 0.7, X1 = CH + HR + 10;
  add(Door, { id: 'd5', at: [0, 0, X0], w: D.w, h: D.h });
  K.slab(-4.6, X0 - 0.1, 4.6, X1, 0, 0.8);
  K.wall(-4.2, X0 + 0.7, -4.2, X1, 0, 10, { t: 0.8 }); K.wall(4.2, X1, 4.2, X0 + 0.7, 0, 10, { t: 0.8 });
  K.wall(4.2, X1, -4.2, X1, 0, 10, { t: 0.8, holes: [{ at: 4.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(9.2, 0.8, X1 - X0 + 0.4, 0, 10.4, (X0 + X1) / 2));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 0, X1 + 0.5]));
  K.solid(box(4, 5, 0.5, 0, 2.5, X1 + 0.9));

  const model = echoModel();
  model.pos.copy(K.world(0, 0, CH + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 0, CH + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 0, CH), r: HR, y: K.world(0, 0, 0).y };
  rt.resonators = res;

  // (the wing last: its mark after the others, so the machines' ids by mark stay as they were)
  lodge(rt, K, M, { GA });
  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-LE.r - 4, -14, -3), V(R0.lodge.x1 + 3, 40, X1 + 2)),
    gadget: { at: W(0, 0.62, C3).toArray(), face: K.heading(Math.PI) },
    // (the last way out, past the Echo, comes up at the keepers' stone by the white hill: KEEPERS_STONE)
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 0.5, X1 - 0.4), r: 1.5, to: V(KEEPERS_STONE.x, KEEPERS_STONE.y + 0.05, KEEPERS_STONE.z), heading: KEEPERS_STONE.heading }],
    lights: [[0, 7, 7, 16], [0, 9, 26, 24], [0, 9, 45, 24], [0, 7, pz, 26], [0, 9, C3, 22], [0, 9, U0 + 12, 26], [0, 9, U0 + 32, 22], [gx, 8, gz - 16, 24], [gx, 8, gz + 16, 24], [LODGE.x, 8, LODGE.z, 22], [0, 10, CH, 30]],
    guardian: { def: { ...ECHO, onHit: echoHit, onStrike: () => {} }, model, arena },
  };
}

/**
 * (v1.53, issue #23) The Keepers' Lodge, off the Keepers' Gallery (east since v1.77, west before): an arena where the walker's keepers rested, their
 * stone benches by the walls; won, the small key's cage sinks (for the Hall of the Unseen's far door). Since v1.77 the
 * house's one fight, 30 m square, its keepers round its middle among four columns.
 */
function lodge(rt, K, M, { GA }) {
  const add = (P, o) => rt.add(P, o);
  const Lg = LODGE, LR = ROOMS.lodge, D = DOOR;
  K.hall({ x: Lg.x, z: Lg.z, w: Lg.w, d: Lg.d, y: LR.y, h: LR.top - LR.y, roof: 'oculus', oculus: 0.25, doors: [{ side: 'w', at: 0, w: D.w, h: D.h }] });
  K.corridor([GA.x1 + 0.6, Lg.z], [LR.x0 - 0.6, Lg.z], 0, { w: D.w, h: D.h });
  add(Door, { id: 'dR', at: [LR.x0 - 0.6, 0, Lg.z], yaw: Math.PI / 2, w: D.w, h: D.h });   // (open: it shuts behind you while they stand)
  for (const z of [LR.z0 + 0.9, LR.z1 - 0.9]) K.both(M.stone, box(12, 0.6, 1.0, Lg.x + 1, 0.3, z));   // (benches)
  for (const s of [-1, 1]) K.both(M.stone, new THREE.SphereGeometry(0.7, 14, 8).translate(LR.x1 - 1.6, 0.7, Lg.z + s * 4.6));
  for (const [x, z] of [[Lg.x - 7, Lg.z - 7], [Lg.x + 7, Lg.z - 7], [Lg.x - 7, Lg.z + 7], [Lg.x + 7, Lg.z + 7]]) K.column(x, z, 0, LR.top, 0.9);
  add(Key, { id: 'kS', at: [Lg.x + 10, 0, Lg.z], yaw: -Math.PI / 2 });
  add(Mark, { room: 'lodge', at: [LR.x0 + 3, 0, Lg.z - 4], yaw: Math.PI / 2, foes: [Lg.x, 0, Lg.z] });
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
  // The broad rounded heel and lobed roots are built with the landmark. Keep
  // the same human doorway, without the old small porch protruding through it.
  K.add(M.voidM, T(new THREE.PlaneGeometry(4.4, 7.4).translate(0, 3.7, 0), [0, 0.6, 16.4]));
  K.solid(box(4.4, 7.4, 0.6, 0, 4.3, 16.1));
  for (let i = 0; i < 9; i++) {
    const a = 0.2 + i * 0.075, r = R + 7.5 + i * 0.9, x = Math.sin(a) * r * 0.6 + 2 + i * 1.4, z = R + 8.4 + i * 2.6;
    const gy = H(...K.world(x, 0, z).toArray().filter((_, k) => k !== 1)) - y0;
    K.add(M.floor, box(2.6, 0.25, 2.2, x, gy + 0.1, z, a));
  }
  K.both(M.floor, box(12, 1.2, 9, 0, 0, R + 3));
  const foot=K.world(0,0,R+14);
  K.stairs([0,.6,R+7.5],[0,H(foot.x,foot.z)-y0+.08,R+14],16,{rise:.24,sides:false});
  const lens = glazing('#edc478', landmarkFrame(K,'spheres',.6).world(0,35.6,2));
  const landmarkTop = landmark(K, 'spheres', { y: 0.6, R, glass: lens });
  K.flush();
  glaze(K, rt.veils, lens, {color:'#efa72f',alpha:.64,glow:.25});
  const at = K.world(0, 0.6, 17.4);
  const front = K.world(0, 0, R + 9);
  return { door: { at, heading: yaw }, kit: K, base: y0, doorY: y0 + 0.6, R, pads, top: y0 + landmarkTop,
    clear: [{ x: SITE.x, z: SITE.z, r: 80 }, ...pads.map((p) => { const c = K.world(p.base[0] + p.dir[0] * p.len * 0.5, 0, p.base[1] + p.dir[1] * p.len * 0.5); return { x: c.x, z: c.z, r: p.len * 0.55 }; }), { x: front.x, z: front.z, r: 38 }] };
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
  gadget: 'lens', gadgetBox: 'spheres.temple.lens', arenaDoor: 'd4', arenas: ARENAS,
  origin: [-120, 2000, -260], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'tessa', out: 12, side: 7 },   // (src/temples/index.js: who stands by the door and points you in)
  enterLine: 'Inside the heel it is white and round and very quiet, the kind of quiet a sphere keeps.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, the Footprint fills, and every sphere wears a ring of light.', 'resolved.out'); },
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
