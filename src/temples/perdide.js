import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Switch, Jaw, Swing, Platform, Mark, Pit } from './pieces.js';
import { snapperModel } from './guardians.js';

// Lorn's temple: the Hush-House, a great low dome of violet stone on the cave
// island, crystals of the swamp's groves growing up through it, its door
// looking east over the channel. The makers taught the plants of Lorn not to
// eat in here (the Hush, the swamp people's glyph, three drops over a shut
// mouth, is theirs), and grew the first snapper of all to keep the house: the
// Mother, whom every snapping plant on Lorn is seeded from. The night the sky
// rang the house's crystals went out of tune, and she woke, frightened, and
// has snapped at everything since.
//
// Inside (built far overhead, through its door):
//   the Threshold          the first mark, the way out
//   the Choir              four crystals, each its own height: splash them low to high and the door opens
//                          (out of turn, a crystal rings flat and fades: logic.js `after`)
//   the Bog Well           a riding disc that climbs over dark water, then a wall of roots to climb
//   the Stilling Chamber   the makers' chest: the STILLING MODE (src/items.js 'stun'). The way on is a gate of
//                          jaws that snaps, and snaps: a stilling glob stills it, and it rests open
//   the Pendulum Gallery   a narrow bridge over a chasm, three crystal pendulums swinging across it (still
//                          them, one by one); at its end a second gate of jaws
//   the Mother's Hall      the guardian (organic: you calm her): the Mother Snapper, rooted in the middle of a
//                          round hall. Her head lunges, sweeps, spits seed; spent after a lunge it lies on the
//                          floor, agape: a stilling glob in her mouth calms her. Later, still her mid-strike
// After: the dome flowers, and every snapping plant on Lorn has a ring of the same flowers at its foot.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** On the cave island, clear of the cave; its door looks east, over the channel to the fireflies' isle. */
export const SITE = { x: -135, z: 105, r: 16, path: [-108, 107] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

export const PALETTE = {
  wall: '#6a5a8a', wall2: '#5d4f7e', wall3: '#7a6a9a', floor: '#4f6a5e', floor2: '#5a7a66', trim: '#d8c8e8',
  dark: '#2a2448', stone: '#8a7aa0', accent: '#e0708a', glow: '#a8e6ee', lamp: '#d6ff9a', sand: '#4f6a5e', sand2: '#5a7a66', void: '#1a1630',
};

export const LOGIC = {
  id: 'perdide', entry: 'threshold', gadget: 'stun',
  rooms: { threshold: { checkpoint: true }, choir: { checkpoint: true }, well: { checkpoint: true }, stilling: { checkpoint: true }, gallery: { checkpoint: true }, galleryFar: { checkpoint: true }, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'choir' },
    { a: 'choir', b: 'well', door: 'd1' },
    { a: 'well', b: 'stilling' },
    { a: 'stilling', b: 'gallery', door: 'd2' },
    { a: 'gallery', b: 'galleryFar', needs: ['stun'] },   // the pendulums: still them to cross
    { a: 'galleryFar', b: 'hall', door: 'd3' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    // the four crystals of the Choir, sung low to high
    c1: { type: 'switch', room: 'choir' },
    c2: { type: 'switch', room: 'choir', after: 'c1' },
    c3: { type: 'switch', room: 'choir', after: 'c2' },
    c4: { type: 'switch', room: 'choir', after: 'c3' },
    d1: { type: 'door', opens: { all: [{ lit: 'c1' }, { lit: 'c2' }, { lit: 'c3' }, { lit: 'c4' }] }, latch: true },
    chest: { type: 'gadget', room: 'stilling', item: 'stun' },
    j1: { type: 'switch', room: 'stilling', needs: ['stun'] },     // the jaws stilled
    d2: { type: 'door', opens: { lit: 'j1' }, latch: true },
    j2: { type: 'switch', room: 'galleryFar', needs: ['stun'] },
    d3: { type: 'door', opens: { lit: 'j2' }, latch: true },
    mother: { type: 'boss', room: 'hall', needs: ['backpack', 'stun'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const MOTHER = {
  kind: 'organic', name: 'the Mother Snapper', final: 'touch', touch: 'lay a hand on her head',
  speed: 0, wakeTime: 3.2,
  wake: 'In the middle of the hall something as big as a house uncurls: a head of jaws on a long neck, rooted in a ring of leaves. The Mother. She has heard you.',
  openHint: 'Her head lies spent on the floor, jaws agape.',
  weary: 'Her jaws close softly. Her head comes down to the floor by her leaves, and her crown glows. Go to her.',
  resolved: 'The Mother Snapper breathes out, long and slow, and sleeps. Up in the dome the crystals hum in tune again.',
  phases: [
    { to: 0.45, attacks: ['lunge', 'sweep'], pause: 1.5, hint: 'When her head lies spent after a lunge, still her: a cold glob in her open mouth.' },
    { to: 0.9, attacks: ['seed', 'lunge', 'sweep'], pause: 1.2, hint: 'Her crown glows. Still her as she rears to strike, or when she lies spent.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    lunge: { shape: 'lane', range: 13.5, width: 3.4, telegraph: 1.5, damage: 1, knock: 11, recover: 0.6, open: 3.6 },
    sweep: { shape: 'cone', range: 9.5, angle: 0.95, telegraph: 1.3, damage: 0.75, knock: 12, recover: 0.7 },
    seed: { shape: 'ring', at: 'player', radius: 3.6, telegraph: 1.7, track: 0.55, damage: 0.75, knock: 8, recover: 0.8 },
  },
};

/** Only the stilling mode calms her: plain fluid startles her, a shove frightens her. */
function motherHit(g, part, mode) {
  const rt = g.rt;
  if (mode === 'stun') {
    if (part === 'mouth' && g.state === 'open') {
      g.add(0.15, 'still');
      rt.notice('The cold glob settles in her mouth. Her jaws ease, and her head comes up slowly.', 'mother.still');
      rt.sound?.chime?.();
      if (g.state === 'open') { g.enter('fight'); g.cool = 2.2; }
      return true;
    }
    if (g.attack && g.state === 'fight' && !g.struck) {
      // stilled mid-strike: it never lands; once she has begun to calm, it calms her more
      g.attack = null; g.tele.hide(); g.cool = 2.4;
      if (g.phaseIndex >= 1) { g.add(0.15, 'still'); rt.sound?.chime?.(); rt.notice('She stops mid-strike, frosted, and sways. Her crown glows brighter.', 'mother.mid'); }
      else rt.notice('She stops mid-strike, frosted, and shakes it off. Wait for her to lie spent.', 'mother.mid0');
      return true;
    }
    return true;
  }
  if (mode === 'push') { g.add(-0.04, 'push'); rt.notice('She rears from the shove and snaps the air, more frightened than before.', 'mother.push'); return true; }
  if (part === 'mouth' && g.state === 'open') {
    g.enter('fight'); g.cool = 1.2;
    rt.notice('She snaps at the splash and rears up: it only startles her. Something colder, to still her.', 'mother.fluid');
    return true;
  }
  rt.notice('The fluid runs off her leaves. It does not calm her.', 'mother.leaves');
  return true;
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

  // ---- the Choir (z 12.6..44): four crystals, each its own height; splash them low to high
  K.hall({ x: 0, z: 28.3, w: 24, d: 31.4, y: 0, h: 14, roof: 'oculus', columns: 3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4 }] });
  const wrong = 'It rings flat, and fades. The makers sang from low to high.';
  for (const [id, x, z, h] of [['c3', -6, 20, 4.4], ['c1', 6, 23, 1.8], ['c4', -6, 35, 5.6], ['c2', 6, 37, 3.1]])
    add(Switch, { id, at: [x, 0, z], crystal: h, size: 0.9, wrong });
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
  K.rotunda({ x: 0, z: C2, y: -6, r: 10, h: 30, floor: false, gaps: [{ a: Math.PI, w: 5, h: 6.4, y0: 6 }, { a: 0, w: 5, h: 6, y0: 15 }], oculus: 0.3 });
  K.both(M.floor, box(20, 6, 3, 0, -3, C2 - 8.6));            // the near landing (its top at 0)
  K.both(M.wallGlyph, box(20, 15, 6, 0, 1.5, C2 + 6));        // the root-wall, its top at 9: climb it
  K.both(M.dark, T(new THREE.CylinderGeometry(10, 10, 1, 32), [0, -6.5, C2]));
  const bog = makeMaterial({ color: '#2f4a48', glow: 0.12, flat: true, key: 'temple.lorn.bog' });
  K.add(bog, T(new THREE.CylinderGeometry(9.8, 9.8, 0.2, 32), [0, -2.4, C2]));
  add(Pit, { room: 'well', min: [-11, -8, C2 - 7], max: [11, -1.5, C2 + 3] });
  add(Platform, { path: [[0, 0, C2 - 4.8], [0, 3, C2 + 0.6]], r: 2.2, speed: 1.4, pause: 1.8 });
  root([[-6, 9, C2 + 3.2], [-5, 5, C2 + 3.1], [-6.2, 1, C2 + 3.15], [-6, -3, C2 + 3.1]], 0.45);
  root([[5, 9, C2 + 3.2], [6, 4, C2 + 3.1], [4.8, 0, C2 + 3.15], [5.4, -3, C2 + 3.1]], 0.45);
  K.slab(-6, C2 + 9, 6, C2 + 10.4, 9, 0.6);
  add(Mark, { room: 'well', at: [-3.2, 0, C2 - 8.6], yaw: Math.PI / 2 });
  spike(7.5, -2.4, C2 - 3, 5, 0.8, -0.3); spike(-7.2, -2.4, C2 - 1, 4, 0.7, 0.3, 1);

  // ---- the corridor and the Stilling Chamber (floor 9, a rotunda): the chest; a gate of jaws
  K.slab(-3.2, C2 + 9.8, 3.2, C2 + 12.6, 9, 0.8);
  K.wall(-3.2, C2 + 10.4, -3.2, C2 + 12.6, 9, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.4, 9, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 15.8, C2 + 11.6));
  const C3 = C2 + 22.6;    // 79.8
  K.rotunda({ x: 0, z: C3, y: 9, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5.4, h: 6.6 }], oculus: 0.3 });
  // the dais, solid as drawn: its two steps as cylinders (one cylinder stood over its lower step; the lathe
  // alone gave no top a ray from above could land on, so the chest sank into the dais: the QC pass)
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 9, C3), new THREE.CylinderGeometry(2.5, 2.5, 0.62, 28).translate(0, 9.31, C3));
  K.solid(new THREE.CylinderGeometry(3, 3, 0.3, 28).translate(0, 9.15, C3));
  add(Jaw, { id: 'd2', still: 'j1', at: [0, 9, C3 + 10.1], w: 5.2, h: 6.4, seed: 1 });
  add(Mark, { room: 'stilling', at: [6, 9, C3 - 5], yaw: -Math.PI * 0.75 });
  spike(-6.5, 9, C3 + 3, 4.5, 0.7, 0.25); spike(6.2, 9, C3 + 4, 3.2, 0.6, -0.2, 2);

  // ---- the Pendulum Gallery (z 91..125): a narrow bridge over a chasm, three crystal pendulums across it
  const G0 = C3 + 10.9;
  K.slab(-3.2, C3 + 9.2, 3.2, G0 + 0.6, 9, 0.8);
  K.hall({ x: 0, z: G0 + 17.2, w: 22, d: 34.4, y: -3, h: 28, floor: false, roof: true, doors: [{ side: 's', w: 5.4, h: 6.6, y0: 12 }, { side: 'n', w: 5.4, h: 6.6, y0: 12 }] });
  K.slab(-11, G0, 11, G0 + 6, 9, 12);
  K.slab(-11, G0 + 26, 11, G0 + 34.4, 9, 12);
  K.both(M.floor, box(3, 1, 20.4, 0, 8.5, G0 + 16));        // the bridge
  K.add(M.trim, box(3.3, 0.25, 20.4, 0, 7.9, G0 + 16));
  K.both(M.dark, box(22, 1, 20, 0, -3.5, G0 + 16));
  add(Pit, { room: 'gallery', min: [-12, -6, G0 + 6], max: [12, 4, G0 + 26] });
  const SW = [G0 + 10, G0 + 16, G0 + 22];
  for (const [i, z] of SW.entries()) {
    K.add(M.trim, box(22, 0.8, 1.2, 0, 21.6, z));            // the beam it hangs from
    add(Swing, { at: [0, 21, z], len: 10, amp: 0.95, period: 2.6 + i * 0.3, phase: i * 0.31 });
  }
  add(Mark, { room: 'gallery', at: [-7, 9, G0 + 3], yaw: 0 });
  add(Mark, { room: 'galleryFar', at: [7, 9, G0 + 31], yaw: Math.PI });
  add(Jaw, { id: 'd3', still: 'j2', at: [0, 9, G0 + 34.9], w: 5.2, h: 6.4, seed: 2 });

  // ---- the corridor, and the Mother's Hall (floor 9): a round hall, the Mother rooted in its middle
  const H0 = G0 + 35;
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 9, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 9, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 9, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 16.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 9, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 19, CL = H0 + 3.2 + HR + 1.4;
  K.rotunda({ x: 0, z: CL, y: 9, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.25 });
  // her bed: a ring of dark soil and moss round her root, and the crystals of the dome over her
  K.both(M.floor, T(new THREE.CylinderGeometry(6.5, 7, 0.3, 32), [0, 9.12, CL + 3]));
  K.both(M.trim, T(annulus(6.5, 7.2, 0.4, 36), [0, 9.2, CL + 3]));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3; spike(Math.sin(a) * (HR - 1.6), 9, CL + Math.cos(a) * (HR - 1.6), 5 + (i % 3) * 2, 0.9, Math.cos(a) * 0.25, a); }
  add(Door, { id: 'd5', at: [0, 9, CL + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CL + HR + 0.6, 3.2, CL + HR + 10, 9, 0.8);
  K.wall(-3.2, CL + HR + 1.4, -3.2, CL + HR + 10, 9, 7, { t: 0.8 }); K.wall(3.2, CL + HR + 10, 3.2, CL + HR + 1.4, 9, 7, { t: 0.8 });
  K.wall(3.2, CL + HR + 10, -3.2, CL + HR + 10, 9, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 16.4, CL + HR + 5.7));
  K.both(M.voidM, box(3.4, 5, 0.9, 0, 11.5, CL + HR + 10.35));

  const model = snapperModel({ reach: 12 });
  model.pos.copy(K.world(0, 9, CL + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = model.pos.clone();
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 9, CL), r: HR, y: K.world(0, 9, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -10, -3), V(24, 40, CL + HR + 12)),
    gadget: { at: W(0, 9.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 9.5, CL + HR + 9.6), r: 1.5 }],
    lights: [[0, 5, 6, 10], [0, 6, 28, 14], [0, 4, C2, 11], [0, 13, C3, 10], [0, 14, G0 + 16, 13], [0, 15, CL, 18]],
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
  gadget: 'stun', gadgetBox: 'perdide.temple.stun', arenaDoor: 'd3',
  origin: [-100, 1700, 300], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'teasel', out: 9, side: 6 },
  enterLine: 'Inside the Hush-House it is green and cool, and the crystals hum, each its own note. Somewhere ahead, something snaps.',
  pitLine: 'You climb back up to the last glyph stone.',
  onResolved(rt) { rt.notice('Out on the swamp, at the foot of every snapping plant, flowers open.', 'resolved.out'); },
};
