import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from '../materials.js';
import { glyphGeometry } from '../story/sign-text.js';
import { TempleKit, T, box, lathe, annulus } from './kit.js';
import { Door, Plate, Ball, Switch, Platform, Bridge, Seed, Bud, Glass, Mark, Pit } from './pieces.js';
import { gardenerModel } from './guardians.js';

// Viridel's temple: the Builders' Greenhouse, a round house of the white
// builders' clean stone under a great ribbed dome of glass, in the meadow
// hollow north of the white ruins (well clear of Esk's tea terraces, south-east
// of the landing). The builders grew their houses and their garden here, and
// left a gardener to keep it: a giant of moss, as old as the pyramids. The
// night the light passed, every flower on it closed and fell, and it has gone
// wild and bare since, and nothing in the Greenhouse grows.
//
// Inside (built far overhead, through its door):
//   the Threshold        the first mark, the way out
//   the Potting Hall     a white stone seed in a groove onto its plate, and an eye behind the potting
//                        benches: both, and the door opens
//   the Glass Stair      a root-wall to climb, then a disc that rides up to the landing
//   the Seed Chamber     the makers' chest: BLOOM MODE (src/items.js 'bloom', a new gun mode). The way on is
//                        a flower-door, a great bud only a bloom glob opens
//   the Vine Gulf        a chasm: a seed at its edge grows a vine bridge across; on the far side a wall of
//                        greenhouse glass too smooth to climb, until a seed at its foot grows a vine up it;
//                        at its top a second bud
//   the Glasshouse       the guardian (organic: you calm it): the Gardener. Bloom the four dead beds round
//                        the walls; then, each time it kneels, bloom its bare back. The bud shuts behind you.
// After: the white ruins all over Viridel flower, vines and blossom up every slab, and the Greenhouse's dome
// is green with leaves.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/** In the flat meadow hollow north of the white ruins; its door looks south, toward the ruins and the landing. */
export const SITE = { x: 110, z: 320, r: 22, path: [150, 100] };
SITE.heading = Math.atan2(SITE.path[0] - SITE.x, SITE.path[1] - SITE.z);

export const PALETTE = {
  wall: '#f7f4ec', wall2: '#efe8da', wall3: '#fbf8f0', floor: '#d6e8d0', floor2: '#c9e0c2', trim: '#62c3c9', strata: 2.8,
  dark: '#4f8a5a', stone: '#f2a7b5', accent: '#f6c7a0', glow: '#7fcfa8', lamp: '#f6d36a', sand: '#b4d896', sand2: '#c9e4a8', void: '#2f4a3a',
};

export const LOGIC = {
  id: 'edena', entry: 'threshold', gadget: 'bloom',
  rooms: { threshold: { checkpoint: true }, potting: { checkpoint: true }, stair: { checkpoint: true }, seed: { checkpoint: true }, gulf: { checkpoint: true }, gulfFar: { checkpoint: true }, gulfTop: { checkpoint: true }, hall: { boss: true }, out: {} },
  links: [
    { a: 'threshold', b: 'potting' },
    { a: 'potting', b: 'stair', door: 'd1' },
    { a: 'stair', b: 'seed' },
    { a: 'seed', b: 'gulf', door: 'd3' },
    { a: 'gulf', b: 'gulfFar', door: 'vine1' },        // the vine bridge
    { a: 'gulfFar', b: 'gulfTop', door: 'vine2' },     // the vine up the glass
    { a: 'gulfTop', b: 'hall', door: 'd4' },
    { a: 'hall', b: 'out', door: 'd5' },
  ],
  elements: {
    ball1: { type: 'drum', room: 'potting', plate: 'p1', plateAt: 1, start: 0 },
    p1: { type: 'plate', room: 'potting' },
    s1: { type: 'switch', room: 'potting' },
    d1: { type: 'door', opens: { all: [{ drumOn: ['ball1', 'p1'] }, { lit: 's1' }] }, latch: true },
    chest: { type: 'gadget', room: 'seed', item: 'bloom' },
    bud1: { type: 'switch', room: 'seed', needs: ['bloom'] },      // the flower-door
    d3: { type: 'door', opens: { lit: 'bud1' }, latch: true },
    seed1: { type: 'switch', room: 'gulf', needs: ['bloom'] },
    vine1: { type: 'bridge', opens: { lit: 'seed1' }, latch: true },
    seed2: { type: 'switch', room: 'gulfFar', needs: ['bloom'] },
    vine2: { type: 'bridge', opens: { lit: 'seed2' }, latch: true },
    bud2: { type: 'switch', room: 'gulfTop', needs: ['bloom'] },
    d4: { type: 'door', opens: { lit: 'bud2' }, latch: true },      // (the arena's door too: it shuts behind you)
    bed1: { type: 'switch', room: 'hall', needs: ['bloom'] },
    bed2: { type: 'switch', room: 'hall', needs: ['bloom'] },
    bed3: { type: 'switch', room: 'hall', needs: ['bloom'] },
    bed4: { type: 'switch', room: 'hall', needs: ['bloom'] },
    gardener: { type: 'boss', room: 'hall', needs: ['backpack', 'bloom'] },
    d5: { type: 'door', opens: { resolved: true } },
  },
};

export const GARDENER = {
  kind: 'organic', name: 'the Gardener', final: 'touch', touch: 'lay a hand on its brow',
  speed: 1.8, wakeTime: 3.2,
  wake: 'Something vast heaves itself up in the glasshouse: a giant of moss with a face of white stone, bare in patches, brown where nothing grows. It sees you, and roars like a wind through leaves.',
  openHint: 'It kneels, heaving, its bare back to the glass. Nothing grows on it.',
  weary: 'It lies down among the beds, flowering all over, breathing slow. Go to it.',
  resolved: 'The Gardener sighs, a long sigh that smells of rain, and closes its eyes. All round the glasshouse, everything begins to grow.',
  phases: [
    { to: 0.4, attacks: ['sweep', 'stamp'], pause: 1.7, hint: 'It tramples the dead beds round the walls. Bloom them.' },
    { to: 0.9, attacks: ['roots', 'sweep', 'stamp'], pause: 1.3, hint: 'Its eyes are greener. When it kneels, bloom its bare back.' },
    { to: 1.0, weary: true },
  ],
  attacks: {
    sweep: { shape: 'cone', range: 11, angle: 0.75, telegraph: 1.4, damage: 0.18, knock: 11, recover: 0.9 },
    stamp: { shape: 'ring', at: 'self', radius: 7.5, telegraph: 1.5, damage: 0.22, knock: 10, recover: 1.0, open: 3.2 },
    roots: { shape: 'ring', at: 'player', radius: 3.8, telegraph: 1.8, track: 0.6, damage: 0.2, knock: 9, recover: 1.0, open: 3.2 },
  },
};

const BEDS = ['bed1', 'bed2', 'bed3', 'bed4'];
/** In its first phase the Gardener's calm is the beds round the walls: a tenth for each in flower. */
function syncBeds(g) {
  if (!g || g.phaseIndex !== 0 || !g.awake) return;
  const n = BEDS.filter((id) => g.rt.logic.isLit(id)).length;
  if (n * 0.1 > g.meter + 1e-6) { g.add(n * 0.1 - g.meter, 'beds'); if (g.phaseIndex === 0) g.rt.notice(['', 'It stops, and turns its stone face to the bed in flower.', 'A second bed. It sways, watching the flowers open.', 'Three. A little green comes up through its bare patches.'][n] ?? null); }
}

function gardenerHit(g, part, mode, info) {
  // (its targets take fire and stilling as theirs; a bloom glob reaches them as plain fluid, its own mode in info)
  if (info?.mode === 'bloom') mode = 'bloom';
  if (mode === 'push') { g.add(-0.04, 'push'); g.rt.notice('It flinches from the shove and roars, more frightened.', 'gd.push'); return true; }
  if (mode === 'fire') { g.add(-0.05, 'fire'); g.rt.notice('It shrinks from the ember, beating at the sparks in its moss. Not fire, never fire, in a garden.', 'gd.fire'); return true; }
  if (mode === 'stun') return false;   // (the stilling lens stops a strike, as anywhere)
  if (mode !== 'bloom') { g.rt.notice('It drinks the water off its moss, and stays bare. It is not thirsty: nothing will grow on it.', 'gd.water'); return true; }
  if (g.phaseIndex === 0) { g.rt.notice('A few flowers start on its back, and it shakes them off. It is looking at the dead beds round the walls.', 'gd.early'); return true; }
  if (g.state !== 'open') { g.rt.notice('The flowers catch on its moss and are torn off as it moves. Wait for it to kneel.', 'gd.moving'); return true; }
  g.add(0.15, 'bloom');
  g.rt.sound?.chime?.();
  g.rt.notice('Flowers break out over its bare back, white and pink. It goes still under them, and looks round at them.', `gd.bloom.${g.phaseIndex}`);
  if (g.state === 'open') { g.enter('fight'); g.cool = 2.4; }
  return true;
}

// ------------------------------------------------------------------ inside
function layout(rt) {
  const K = rt.kit, M = rt.M;
  const add = (P, o) => rt.add(P, o);
  const leaf = { paint: new THREE.Color('#7fcf72'), smooth: false, side: THREE.FrontSide };
  const leaf2 = { paint: new THREE.Color('#5f9a52'), smooth: false, side: THREE.FrontSide };
  const pink = { paint: new THREE.Color('#f2a7b8'), smooth: false, side: THREE.FrontSide };
  const glassM = makeMaterial({ color: '#cfe9e0', glow: 0.12, flat: true, key: 'temple.edena.glass' });
  /** A potted shrub: a white tub, a round head of leaves, a few flowers (dead: bare twigs). */
  const pot = (x, y, z, s = 1, dead = false) => {
    K.both(M.wall, lathe([[0.9 * s, 0], [1.1 * s, 1.0 * s], [1.2 * s, 1.1 * s], [0.01, 1.1 * s]], 12).translate(x, y, z), new THREE.CylinderGeometry(1.1 * s, 0.9 * s, 1.1 * s, 10).translate(x, y + 0.55 * s, z));
    if (dead) for (let i = 0; i < 4; i++) K.add({ paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide }, T(new THREE.CylinderGeometry(0.05, 0.08, 1.4 * s, 4), [x + Math.sin(i * 1.6) * 0.3, y + 1.6 * s, z + Math.cos(i * 1.6) * 0.3], [Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4]));
    else { K.add(leaf, T(new THREE.IcosahedronGeometry(1.1 * s, 1), [x, y + 1.9 * s, z])); for (let i = 0; i < 3; i++) K.add(pink, T(new THREE.SphereGeometry(0.2 * s, 6, 4), [x + Math.sin(i * 2.1) * 0.9 * s, y + 2.2 * s, z + Math.cos(i * 2.1) * 0.9 * s])); }
  };
  /** A pane of glass high on a wall (looking out on nothing: a pale green light). */
  const pane = (x, y, z, w, h, yaw) => { K.add(glassM, T(new THREE.PlaneGeometry(w, h), [x, y, z], [0, yaw, 0])); K.add(M.trim, T(new THREE.BoxGeometry(w + 0.3, 0.2, 0.2), [x, y + h / 2, z], [0, yaw, 0])); K.add(M.trim, T(new THREE.BoxGeometry(0.16, h, 0.16), [x, y, z], [0, yaw, 0])); };

  // ---- the Threshold (z 0..12)
  K.hall({ x: 0, z: 6, w: 14, d: 12, y: 0, h: 9, roof: true, doors: [{ side: 's', w: 3.6, h: 5 }], omit: ['n'] });
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.6, 5).translate(0, 2.5, 0), [0, 0, -1.25]));
  K.solid(box(4, 5, 0.5, 0, 2.5, -1.4));
  K.glyph([0, 6.2, 0.05], 1.5, 0);
  pot(5, 0, 9, 0.8, true); pot(-5, 0, 10, 0.7, true);
  add(Mark, { room: 'threshold', at: [-4.6, 0, 6], yaw: Math.PI / 2 });
  K.wall(-8.6, 12.6, 8.6, 12.6, 0, 13, { t: 1.2, holes: [{ at: 8.6, w: 6, h: 7 }] });

  // ---- the Potting Hall (z 12.6..44): a stone seed onto its plate, an eye behind the benches
  K.hall({ x: 0, z: 28.3, w: 22, d: 31.4, y: 0, h: 12, roof: 'oculus', oculus: 0.3, omit: ['s'], doors: [{ side: 'n', w: 5, h: 6.4 }] });
  K.add(M.dark, box(1.0, 0.04, 21, -6, 0.02, 28));
  add(Ball, { id: 'ball1', a: [-6, 0.04, 17], b: [-6, 0.04, 38.5], r: 1.1 });
  add(Plate, { id: 'p1', at: [-6, 0, 38.5], r: 1.3 });
  // the potting benches along the east wall, dead seedlings in rows; the eye on the wall behind them, over the benches
  for (const z of [20, 27, 34]) { K.both(M.wall, box(3.2, 1.1, 5.2, 8.6, 0.55, z)); for (let i = 0; i < 3; i++) pot(8.6, 1.1, z - 1.7 + i * 1.7, 0.35, true); }
  add(Switch, { id: 's1', at: [10.8, 4.6, 27], yaw: -Math.PI / 2, size: 1.0 });
  for (const z of [18, 30, 40]) pane(-10.95, 8.5, z, 4, 4, Math.PI / 2);
  add(Door, { id: 'd1', at: [0, 0, 44.6], w: 5, h: 6.4, lamps: [{ drumOn: ['ball1', 'p1'] }, { lit: 's1' }] });
  add(Mark, { room: 'potting', at: [-9.4, 0, 15], yaw: Math.PI / 2 });

  // ---- the Glass Stair (a rotunda, floor 0): a root-wall to climb (its top at 9), a disc that rides up to the landing at 18
  K.slab(-3.2, 44, 3.2, 46.6, 0, 0.8);
  K.wall(-3.2, 44.6, -3.2, 46.6, 0, 6.4, { t: 0.8 }); K.wall(3.2, 46.6, 3.2, 44.6, 0, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 6.8, 45.6));
  const C2 = 57.2;
  K.rotunda({ x: 0, z: C2, y: 0, r: 10, h: 30, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6, y0: 18 }], oculus: 0.4 });
  K.both(M.wallGlyph, box(20, 9, 6.4, 0, 4.5, C2 + 6.2));
  for (let i = 0; i < 9; i++) K.add(i % 2 ? leaf : leaf2, T(new THREE.CylinderGeometry(0.22, 0.3, 9.2, 5), [-7 + i * 1.75, 4.5, C2 + 2.95], [0, 0, Math.sin(i * 1.7) * 0.12]));   // roots down its face
  add(Platform, { path: [[0, 9, C2 + 6], [0, 18, C2 + 6]], r: 2.2, speed: 1.5, pause: 2 });
  K.slab(-3.2, C2 + 8.3, 3.2, C2 + 10.6, 18, 0.6);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5; if (Math.abs(Math.cos(a)) < 0.5) continue; pane(Math.sin(a) * 9.95, 22, C2 + Math.cos(a) * 9.95, 3.5, 6, a + Math.PI); }
  add(Mark, { room: 'stair', at: [-6, 0, C2 - 6], yaw: Math.PI * 0.75 });

  // ---- the corridor and the Seed Chamber (floor 18): the chest; the way on is a bud
  K.slab(-3.2, C2 + 9.8, 3.2, C2 + 12.6, 18, 0.8);
  K.wall(-3.2, C2 + 10.4, -3.2, C2 + 12.6, 18, 6.4, { t: 0.8 }); K.wall(3.2, C2 + 12.6, 3.2, C2 + 10.4, 18, 6.4, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 2.6, 0, 24.8, C2 + 11.6));
  const C3 = C2 + 22.6;
  K.rotunda({ x: 0, z: C3, y: 18, r: 9.5, h: 13, gaps: [{ a: Math.PI, w: 5, h: 6.4 }, { a: 0, w: 5, h: 6.4 }], oculus: 0.4 });
  K.both(M.trim, lathe([[3, 0], [3, 0.3], [2.5, 0.32], [2.5, 0.62], [0.01, 0.62]], 28).translate(0, 18, C3), new THREE.CylinderGeometry(2.8, 3, 0.62, 20).translate(0, 18.31, C3));
  for (const [x, z] of [[-6, C3 - 3], [6, C3 - 3], [-6.4, C3 + 3.5], [6.4, C3 + 3.5]]) pot(x, 18, z, 0.7, true);
  add(Bud, { id: 'd3', bloom: 'bud1', at: [0, 18, C3 + 10.0], w: 5, h: 6.4 });
  add(Mark, { room: 'seed', at: [6, 18, C3 - 5], yaw: -Math.PI * 0.75 });

  // ---- the Vine Gulf: from the ledge at 18 across a chasm (a seed grows the bridge); a glass wall up to 27 (a seed grows a vine up it)
  const G0 = C3 + 10.9;
  K.slab(-3.2, C3 + 9.2, 3.2, G0 + 0.6, 18, 0.8);
  K.hall({ x: 0, z: G0 + 22, w: 22, d: 44, y: -6, h: 44, floor: false, roof: 'oculus', oculus: 0.3, doors: [{ side: 's', w: 5, h: 6.4, y0: 24 }, { side: 'n', w: 5, h: 6.4, y0: 33 }] });
  K.slab(-11, G0, 11, G0 + 6, 18, 24);
  K.slab(-11, G0 + 28, 11, G0 + 44, 18, 24);
  K.both(M.wallGlyph, box(22, 9, 6, 0, 22.5, G0 + 41));          // the high ledge, its face the glass wall
  K.add(M.trim, box(22.2, 0.3, 6.2, 0, 27.05, G0 + 41));
  K.both(M.dark, box(22, 1, 22, 0, -6.4, G0 + 17));
  for (let i = 0; i < 7; i++) K.add(i % 2 ? leaf : leaf2, T(new THREE.SphereGeometry(1.6 + (i % 3) * 0.5, 8, 6).scale(1, 0.5, 1), [-9 + i * 3, -5.6, G0 + 10 + (i % 3) * 5]));   // a jungle down there
  add(Pit, { room: 'gulf', min: [-12, -8, G0 + 6], max: [12, 12, G0 + 28] });
  add(Seed, { id: 'seed1', at: [-2.6, 18, G0 + 4.6], size: 0.9, seed: 1 });
  add(Bridge, { id: 'vine1', a: [0, 18, G0 + 5.9], b: [0, 18, G0 + 28.1], w: 3.6, n: 10, from: 'grow' });
  add(Glass, { at: [0, 18, G0 + 37.95], yaw: Math.PI, w: 9, h: 9, when: { lit: 'seed2' } });
  for (const x of [-7, 7]) pane(x, 22.5, G0 + 37.93, 4.5, 8, Math.PI);   // (more glass either side: the vine grows only in the middle)
  add(Seed, { id: 'seed2', at: [2.8, 18, G0 + 36.2], size: 0.9, seed: 3 });
  add(Bud, { id: 'd4', bloom: 'bud2', at: [0, 27, G0 + 44], w: 5, h: 6.4, color: '#f2c6e0' });
  add(Mark, { room: 'gulf', at: [-7, 18, G0 + 3], yaw: 0 });
  add(Mark, { room: 'gulfFar', at: [-7, 18, G0 + 31], yaw: Math.PI });
  add(Mark, { room: 'gulfTop', at: [-6, 27, G0 + 41], yaw: Math.PI / 2 });

  // ---- the corridor and the Glasshouse (floor 27): four dead beds round the walls
  const H0 = G0 + 44;
  K.slab(-3.2, H0 - 0.6, 3.2, H0 + 3.4, 27, 0.8);
  K.wall(-3.2, H0 + 0.2, -3.2, H0 + 3.4, 27, 7, { t: 0.8 }); K.wall(3.2, H0 + 3.4, 3.2, H0 + 0.2, 27, 7, { t: 0.8 });
  K.both(M.wall, box(7.2, 0.8, 3.6, 0, 34.4, H0 + 1.6));
  add(Mark, { room: 'ante', at: [2.2, 27, H0 + 1.6], yaw: -Math.PI / 2 });
  const HR = 20, CW = H0 + 3.2 + HR + 1.4;
  K.rotunda({ x: 0, z: CW, y: 27, r: HR, h: 24, seg: 36, gaps: [{ a: Math.PI, w: 5, h: 6 }, { a: 0, w: 5, h: 6 }], oculus: 0.55 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.26; pane(Math.sin(a) * (HR - 0.05), 41, CW + Math.cos(a) * (HR - 0.05), 6, 8, a + Math.PI); }
  K.add({ paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide }, T(annulus(4, 7, 0.06, 48), [0, 27.06, CW]));   // bare earth where it stood
  for (const [i, a] of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75].entries()) {
    const x = Math.sin(a) * (HR - 3.4), z = CW + Math.cos(a) * (HR - 3.4);
    K.both(M.wall, lathe([[2.6, 0], [2.7, 0.9], [2.4, 1.0], [0.01, 1.0]], 18).translate(x, 27, z), new THREE.CylinderGeometry(2.6, 2.6, 0.9, 12).translate(x, 27.45, z));
    add(Seed, { id: BEDS[i], at: [x, 28, z], size: 1.5, seed: i, drink: 'The dead bed drinks the water, and stays dead. It is waiting to be told to grow.' });
  }
  add(Door, { id: 'd5', at: [0, 27, CW + HR + 0.7], w: 5, h: 6 });
  K.slab(-3.2, CW + HR + 0.6, 3.2, CW + HR + 10, 27, 0.8);
  K.wall(-3.2, CW + HR + 1.4, -3.2, CW + HR + 10, 27, 7, { t: 0.8 }); K.wall(3.2, CW + HR + 10, 3.2, CW + HR + 1.4, 27, 7, { t: 0.8 });
  K.wall(3.2, CW + HR + 10, -3.2, CW + HR + 10, 27, 7, { t: 0.8, holes: [{ at: 3.2, w: 3.4, h: 5 }] });
  K.both(M.wall, box(7.2, 0.8, 9.4, 0, 34.4, CW + HR + 5.7));
  K.add(M.voidM, T(new THREE.PlaneGeometry(3.4, 5).translate(0, 2.5, 0), [0, 27, CW + HR + 10.5]));
  K.solid(box(4, 5, 0.5, 0, 29.5, CW + HR + 10.9));

  const model = gardenerModel();
  model.pos.copy(K.world(0, 27, CW + 3));
  model.home = model.pos.clone();
  model.heading = K.heading(Math.PI);
  model.rest = K.world(0, 27, CW + 2);
  model.restHeading = K.heading(Math.PI);
  const arena = { center: K.world(0, 27, CW), r: HR, y: K.world(0, 27, 0).y };

  const W = (x, y, z) => K.world(x, y, z);
  return {
    arrival: { pos: W(0, 0.05, 3.6), heading: K.heading(0) },
    bounds: new THREE.Box3(V(-24, -12, -3), V(24, 58, CW + HR + 12)),
    gadget: { at: W(0, 18.62, C3).toArray(), face: K.heading(Math.PI) },
    exits: [{ at: W(0, 0.5, 0.4), r: 1.5 }, { at: W(0, 27.5, CW + HR + 9.6), r: 1.5 }],
    lights: [[0, 6, 6, 12], [0, 7, 28, 16], [0, 10, C2, 14], [0, 22, C3, 12], [0, 22, G0 + 16, 22], [0, 30, G0 + 38, 16], [0, 34, CW, 30]],
    guardian: { def: { ...GARDENER, onHit: gardenerHit }, model, arena },
  };
}

// ------------------------------------------------------------------ outside: the Greenhouse in the hollow
function exterior(scene, level, rt) {
  const yaw = SITE.heading, R = 15;
  const base = level.ground.baseAt(SITE.x, SITE.z, SITE.r) - 0.6;
  const K = new TempleKit(rt.root, 'The Builders’ Greenhouse', V(SITE.x, base, SITE.z), yaw, rt.M);
  const M = rt.M, sill = 2.4;
  const glassM = makeMaterial({ color: '#cfe9e0', glow: 0.18, flat: true, key: 'temple.edena.dome' });
  const ribs = { paint: new THREE.Color('#fbf8f0'), smooth: false, side: THREE.FrontSide };
  const teal = { paint: new THREE.Color('#62c3c9'), smooth: true, side: THREE.FrontSide };
  // a white plinth, a drum of the builders' gridded stone, a ribbed dome of glass on it
  K.both(M.floor, new THREE.CylinderGeometry(R + 4, R + 5, sill, 40).translate(0, sill / 2, 0));
  K.both(M.wallGlyph, new THREE.CylinderGeometry(R, R, 7, 36).translate(0, sill + 3.5, 0));
  K.add(M.trim, new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.6, 36).translate(0, sill + 7.1, 0));
  K.solid(new THREE.SphereGeometry(R - 0.2, 20, 8, 0, TAU, 0, Math.PI / 2).translate(0, sill + 7, 0));
  K.add(glassM, new THREE.SphereGeometry(R, 32, 12, 0, TAU, 0, Math.PI / 2).translate(0, sill + 7, 0));
  for (let i = 0; i < 16; i++) K.add(ribs, T(new THREE.TorusGeometry(R + 0.05, 0.22, 4, 32, Math.PI / 2), [0, sill + 7, 0], [0, (i / 16) * TAU, 0]));
  for (const k of [0.35, 0.65, 0.88]) { const a = k * Math.PI / 2; K.add(ribs, T(new THREE.TorusGeometry(R * Math.cos(a) + 0.05, 0.2, 4, 40), [0, sill + 7 + R * Math.sin(a), 0], [Math.PI / 2, 0, 0])); }
  K.both(teal, new THREE.CylinderGeometry(0.9, 1.4, 2.2, 12).translate(0, sill + 7 + R, 0));
  K.add(teal, new THREE.SphereGeometry(1.0, 12, 8).translate(0, sill + 9.3 + R, 0));
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5) continue; K.add(M.glyph, T(glyphGeometry(1.6, 0.12), [Math.sin(a) * (R + 0.05), sill + 4.5, Math.cos(a) * (R + 0.05)], [0, a, 0])); }
  // the doorway: a white porch out of the drum, the glyph over it
  const z0 = R - 1.5, z1 = R + 3.2;
  for (const s of [-1, 1]) K.both(M.wall, box(2.6, 8, z1 - z0, s * 3.8, sill + 4, (z0 + z1) / 2));
  K.both(M.wall, box(10.2, 1.8, z1 - z0, 0, sill + 7.6, (z0 + z1) / 2));
  K.add(M.trim, box(10.6, 0.5, 0.4, 0, sill + 8.6, z1 + 0.1));
  K.add(M.glyph, T(glyphGeometry(2.2, 0.15), [0, sill + 7.6, z1 + 0.06]));
  K.add(M.voidM, T(new THREE.PlaneGeometry(5, 6.6).translate(0, 3.3, 0), [0, sill, R + 0.3]));
  K.solid(box(5, 6.6, 0.6, 0, sill + 3.3, R));
  // dry creepers already on it (brown: the garden grows over everything, even this, but it has stopped)
  const twig = { paint: new THREE.Color('#9a7448'), smooth: false, side: THREE.FrontSide };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + 0.3; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.45) continue;
    const pts = []; for (let j = 0; j <= 8; j++) { const h = j * 1.2, r = R + 0.25 - Math.max(0, h - 7) * 0.12; pts.push(V(Math.sin(a + Math.sin(j) * 0.04) * r, sill + h, Math.cos(a + Math.sin(j) * 0.04) * r)); }
    K.add(twig, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.18, 4));
  }
  // the steps down to the meadow
  const foot = level.ground.heightAt(...(() => { const p = K.world(0, 0, R + 12); return [p.x, p.z]; })()) - base;
  K.stairs([0, sill, R + 4.4], [0, Math.max(0.2, foot), R + 11], 8, { rise: 0.4 });
  K.flush();
  const at = K.world(0, sill, R + 1.4);
  return { door: { at, heading: yaw }, kit: K, base, R, sill, glassM, clear: [{ x: SITE.x, z: SITE.z, r: R + 9 }, { x: K.world(0, 0, R + 9).x, z: K.world(0, 0, R + 9).z, r: 7 }] };
}

// ------------------------------------------------------------------ the world change: the white ruins flower
/**
 * Once the Gardener sleeps, everything the white builders left grows over again: vines climb every slab of
 * the white ruins all over Viridel, flowers ring their feet and crown their tops, and the Greenhouse's dome
 * goes green with leaves and pink with blossom. One instanced pool of flowers, one of leaves, built from the
 * ruins the level made (level.edena.ruins).
 */
function change(scene, level, rt) {
  const root = new THREE.Group();
  root.name = 'Viridel in flower (the world change)';
  rt.root.add(root);
  root.visible = false;
  const slabs = level.edena?.ruins ?? [];
  const flowers = [], leaves = [];
  const _p = V(), _q = new THREE.Quaternion(), _s = V(), _m = new THREE.Matrix4(), UP = V(0, 1, 0);
  for (const [i, m] of slabs.entries()) {
    const g = m.geometry?.parameters ?? {}, w = g.width ?? 6, h = g.height ?? 20, d = g.depth ?? 3;
    m.updateMatrixWorld(true);
    // vines up two faces: leaf clusters climbing, flowers among them
    for (const side of [1, -1]) {
      const n = Math.max(4, Math.round(h / 2.0));
      for (let j = 0; j < n; j++) {
        const y = (j + 0.3) * (h / n) * 0.9, x = Math.sin(j * 1.3 + i) * w * 0.25;
        for (const dx of [-0.6, 0.6]) {
          _p.set(x + dx * (j % 2 ? 1 : 0.6), y + dx * 0.4, side * (d / 2 + 0.2)).applyMatrix4(m.matrixWorld);
          leaves.push({ at: _p.clone(), s: 0.9 + (j % 3) * 0.3, r: j * 0.7 + i + dx });
        }
        if (j % 2 === 0) { _p.set(x, y + 0.5, side * (d / 2 + 0.35)).applyMatrix4(m.matrixWorld); flowers.push({ at: _p.clone(), s: 1.5, c: (i + j) % 5 }); }
      }
    }
    // a ring of flowers at its foot, a crown on its top
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      _p.set(Math.sin(a) * (w / 2 + 1.2), 2.2, Math.cos(a) * (d / 2 + 1.2)).applyMatrix4(m.matrixWorld);
      const gy = level.ground?.heightAt?.(_p.x, _p.z);
      if (Number.isFinite(gy)) _p.y = gy + 0.1;
      flowers.push({ at: _p.clone(), s: 1.8, c: (i + k) % 5 });
    }
    for (let k = 0; k < 4; k++) { _p.set((k / 3 - 0.5) * w * 0.7, h + 0.2, 0).applyMatrix4(m.matrixWorld); flowers.push({ at: _p.clone(), s: 1.6, c: k % 5 }); leaves.push({ at: _p.clone().add(V(0, -0.3, 0)), s: 1.3, r: k }); }
  }
  // the dome: leaves and blossom over the glass
  const O = rt.outside;
  if (O) {
    for (let i = 0; i < 160; i++) {
      const a = i * 2.39996, up = Math.acos(1 - (i / 160) * 0.95), r = O.R + 0.3;
      const p = O.kit.world(Math.sin(a) * Math.sin(up) * r, O.sill + 7 + Math.cos(up) * r, Math.cos(a) * Math.sin(up) * r);
      if (i % 3) leaves.push({ at: p, s: 1.6, r: i }); else flowers.push({ at: p, s: 1.8, c: i % 5 });
    }
  }
  const FL = ['#f2a7b8', '#f6d36a', '#ffffff', '#b7a0cf', '#ef7e62'].map((c) => new THREE.Color(c));
  // (cheap: five flat diamonds and a middle, 48 triangles a flower: there are a couple of thousand)
  const flowerGeo = mergeGeometries([0, 1, 2, 3, 4].map((k) => new THREE.OctahedronGeometry(0.22, 0).scale(1, 0.4, 0.6).rotateY(k / 5 * TAU).translate(Math.sin(k / 5 * TAU) * 0.22, 0, Math.cos(k / 5 * TAU) * 0.22)).concat([new THREE.OctahedronGeometry(0.12, 0).translate(0, 0.05, 0)]).map((q) => { q.deleteAttribute('uv'); return q; }));
  const leafGeo = new THREE.IcosahedronGeometry(0.6, 0).scale(1.2, 0.5, 0.9);
  leafGeo.deleteAttribute('uv');
  const fm = new THREE.InstancedMesh(flowerGeo, makeMaterial({ color: '#ffffff', flat: true, key: 'temple.edena.flowers' }), Math.max(1, flowers.length));
  const lm = new THREE.InstancedMesh(leafGeo, makeMaterial({ color: '#7fcf72', flat: true, key: 'temple.edena.leaves' }), Math.max(1, leaves.length));
  flowers.forEach((f, i) => { fm.setMatrixAt(i, _m.compose(f.at, _q.setFromAxisAngle(UP, i * 1.7), _s.setScalar(f.s))); fm.setColorAt(i, FL[f.c]); });
  leaves.forEach((f, i) => { lm.setMatrixAt(i, _m.compose(f.at, _q.setFromAxisAngle(UP, f.r), _s.setScalar(f.s))); });
  for (const im of [fm, lm]) { im.userData.noCollide = true; im.userData.dynamic = true; im.frustumCulled = false; root.add(im); }
  let k = 0, want = 0;
  // (they come up a few at a time: the instance counts grow with k)
  const apply = () => { root.visible = k > 0.01; fm.count = Math.round(k * flowers.length); lm.count = Math.round(Math.min(1, k * 1.3) * leaves.length); };
  return {
    root, count: { flowers: flowers.length, leaves: leaves.length, slabs: slabs.length },
    set(on, { instant = false } = {}) { want = on ? 1 : 0; if (instant) { k = want; apply(); } },
    update(dt) {
      if (k === want) return;
      k = THREE.MathUtils.clamp(k + (want ? dt / 5 : -dt), 0, 1);
      apply();
      if (O) O.glassM.uniforms.uGlow.value = 0.18 + 0.15 * k;
    },
  };
}

export const EDENA_TEMPLE = {
  id: 'edena', levelId: 'edena', name: 'The Builders’ Greenhouse', doorLabel: 'door of the Builders’ Greenhouse',
  gadget: 'bloom', gadgetBox: 'edena.temple.bloom', arenaDoor: 'd4',
  origin: [300, 1700, -450], yaw: 0,
  palette: PALETTE, logic: LOGIC, site: SITE,
  layout, exterior, change,
  local: { person: 'sorrel', out: 15, side: 6 },
  enterLine: 'Inside the Greenhouse it is warm and green-lit and smells of earth, and nothing grows. Every pot holds a dead stick.',
  pitLine: 'You climb back out of the green dark, to the last glyph stone.',
  onResolved(rt) { rt.notice('Outside, the white ruins all over the garden are flowering.', 'resolved.out'); },
  onLit(rt, id) { if (BEDS.includes(id)) syncBeds(rt.guardian); },
  onWake(rt) { syncBeds(rt.guardian); },
};
