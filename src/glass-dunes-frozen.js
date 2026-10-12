import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial } from './materials.js';
import { frozenPerson, frozenFlockBird, frozenGreatBird, clockParts, tinted } from './glass-dunes-figures.js';

// ---------------------------------------------------------------------------
// The Glass Dunes' time trapped in the glass (issue #166, the author's pick of direction A, "trapped-time":
// references/levels/The Glass Dunes/environment/explorations/trapped-time/, docs/design/level-explorations-prompts.md).
// The glass is the night the light passed, set solid: where it is thin it is clear, and inside it things stand caught
// mid-moment. Each scene is one of the stopped minutes (the clocks' story told by the land: every clock in the dunes
// stopped at its own minute, the Clock-House at seven to); you read them along the walls, and the last, inside the
// breaking wave, is the minute the light passed itself.
//
//   the tooth      a shard of clear glass on the way from the warm-flow mound to the Clock-House: a glassworker
//                  reaching for a falling float, a pack beast and a cart's clock behind her (sheet 1)
//   the flock      in the frozen wave's face, by the float-posts: birds held mid-wingbeat, a clock among them
//   the carriers   in the billows, across from the Clock-House's door: five carriers mid-step, one with a clock
//   the dust       in the cliffs of the giants, by the west camp: the storm's dust in a curl, a tall clock tumbling
//   the moment     inside the breaking wave's hollow, a chamber of clear glass you walk into through a cleft: its
//                  people looking up, a float falling, birds, and the light's own streak frozen overhead
//
// How it is drawn: the game's surfaces are opaque, so the clear glass is the half-transparent surfaces' way
// (docs/systems/rendering.md "Half-transparent surfaces", src/veil.js): the lens's rim in the G-buffer, inked, the
// rest cut away (makeMaterial veil), and its body a pale mint wash laid over the picture after the ink pass. The
// figures inside are plain pale-mint shapes (one merged mesh a material), lit and inked as anything is, so they show
// through the cut. The walls' painted silhouettes stay (the giants, the heads and trees, far inside the thick glass).
// Cost: one lens mesh and one wash for all of them, a few merged meshes of figures; the washes are drawn only within
// WASH_NEAR of the eye (a lens further off reads by its rim alone: the cheap fallback the handhelds see at a distance).
//
//   buildFrozenScenes(scene, kit, M, { ground, veils, faceOf }) → { scenes, lens, update(camera) }
// ---------------------------------------------------------------------------

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clean = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
const merge = (list) => mergeGeometries(list.filter(Boolean).map(clean));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3();
/** Move a geometry: position, then turn (yaw, pitch, roll in YXZ), uniform scale. */
const put = (g, x, y, z, { yaw = 0, pitch = 0, roll = 0, s = 1 } = {}) => g.applyMatrix4(_m.compose(_s.set(x, y, z), _q.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ')), V(s, s, s)));
const tube = (pts, r = 0.05, seg = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 5, false);

/** What the scenes are made of (sRGB), and the lens's cut (src/veil.js VEIL: lower keeps less rim). */
export const FROZEN_LOOK = { ghost: '#e4f6e6', dust: '#efd6a6', face: '#f6f0e4', hands: '#34405e', streak: '#eef7b4', lens: '#bdeed2', wash: '#a6e8c4', washAlpha: 0.26, cut: 0.4 };
/** The washes are laid only within this of the eye (m). */
export const WASH_NEAR = 170;

/**
 * The scenes (world x, z; the way each faces is found from the wall it sits in, or toward the path). `minute`: the
 * minute to the hour its clock stopped at (the moment's is the Clock-House's own, seven to). `line`: what you read;
 * `read` [x, z]: where you stand to read it (the world's content's traces: tests/glass-dunes-166.test.js checks it
 * against where the build puts it).
 */
export const FROZEN_SCENES = [
  { id: 'tooth', read: [94, 121.3], kind: 'tooth', at: [98, 124], toward: [86, 116], minute: 12, label: 'the glassworker in the glass',
    line: '~whisper~ (A glassworker, reaching for a falling float. The clock behind her says twelve minutes to.)' },
  { id: 'flock', read: [45.9, 50.7], kind: 'wall', ridge: 'wave', from: [46, 62], dir: [0, -1], minute: 15, label: 'the birds in the wave',
    line: '~curious~ (Birds, held mid-wingbeat. A clock hangs among them: fifteen minutes to.)' },
  { id: 'carriers', read: [161.6, 112.2], kind: 'wall', ridge: 'billows', from: [140, 110], dir: [1, 0], minute: 9, label: 'the carriers in the glass',
    line: '~solemn~ (Five carriers, mid-step under their loads. One carries a clock: nine minutes to.)' },
  { id: 'dust', read: [-166.7, 1.6], kind: 'wall', ridge: 'giants', from: [-140, 2], dir: [-1, 0], minute: 19, label: 'the dust in the cliff',
    line: '~whisper~ (The storm’s dust, held in a curl. A tall clock tumbles through it: nineteen minutes to.)' },
  { id: 'moment', read: [-38, -240], kind: 'chamber', at: [-38, -240], toward: [10, -192], minute: 7, label: 'the moment in the wave',
    line: '~solemn~ (The minute the light passed. Everyone looks up. Seven minutes to.)' },
];
/** How large each kind's scene is drawn (the walls' figures larger than life, as the sheets'; the chamber's at your own size). */
export const SCENE_SCALE = { wall: 1.9, tooth: 1.5, chamber: 1 };
/** The chamber in the breaking wave: its two shells (radius, height), the cleft's half-width (rad). */
export const CHAMBER = { outer: [10, 7.5], inner: [6.2, 4.6], cleft: 0.34 };

// ------------------------------------------------------------------ the figures: the game's own people and creatures, frozen
// (src/glass-dunes-figures.js: the crowd's people posed and held, the flocks' birds, Vael's great bird, a clock with its dial)

/** A clock stopped at `minute` to the hour (src/glass-dunes-figures.js clockParts): body, face, ticks, hands. */
export const clock = clockParts;

/** The storm's dust held in a curl (a log spiral in the xy plane, `R` across), a cloud of small grains. */
export function dustCurl({ R = 2.6, n = 70, seed = 3 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const t = i / n, a = t * TAU * 1.6, r = R * (0.15 + 0.85 * t);
    const x = Math.cos(a) * r + (rnd() - 0.5) * 0.5, y = Math.sin(a) * r * 0.8 + (rnd() - 0.5) * 0.5, z = (rnd() - 0.5) * 0.9;
    parts.push(put(new THREE.IcosahedronGeometry(0.06 + 0.2 * rnd() * (1 - 0.5 * t), 0), x, y, z));
  }
  return merge(parts);
}

/** Motes of dust held still round a scene (a box w × h × d, from its foot). */
function motes(w, h, d, n, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647);
  return merge(Array.from({ length: n }, () => put(new THREE.IcosahedronGeometry(0.03 + 0.04 * rnd(), 0), (rnd() - 0.5) * w, rnd() * h, (rnd() - 0.5) * d)));
}

// ------------------------------------------------------------------ the scenes (each in its own frame: x along, y up, z out of the glass)

/**
 * What each scene holds, as [layer, geometry] in its frame (layers: figure, dust, face, hands, float, streak).
 * `w, h, d`: how much room its glass gives (the lens's half-width, its height from the sand, how far it stands out).
 */
export function sceneParts(def) {
  const out = [];
  const add = (layer, g) => { out.push([layer, g]); return g; };
  // (a clock: its body in the glass's tone with the figures, its dial lit, its ticks and hands dark)
  const addClock = (c, f) => { add('figure', f(tinted(c.body, '#cfeadb'))); add('face', f(c.face)); add('hands', f(c.ticks)); add('hands', f(c.hands)); };
  const who = (pose, dress = {}, h = 1.8) => frozenPerson(pose, dress).scale(h / 1.75, h / 1.75, h / 1.75);
  const m = def.minute;
  if (def.id === 'tooth') {
    // the glassworker, reaching down for the float falling from her hands (sheet 1), side on along the glass, her
    // headcloth's ends and her cape held in the air; further in, fainter, the carriers' great bird and a cart's clock
    add('figure', put(who('reach', { head: 'headcloth', cape: 1.0, robe: 0.7 }, 2.0), -2.2, 0.35, 0.2, { yaw: 1.45 }));
    add('float', put(new THREE.IcosahedronGeometry(0.3, 1), -0.55, 1.15, 0.35));
    add('dust', put(motes(3, 3, 1.6, 26, 11), -0.9, 0.5, 0.6));
    add('figure', put(frozenGreatBird({ step: 0.5 }), 2.6, 0.1, -0.6, { yaw: -1.3, s: 0.62 }));
    addClock(clock({ minute: m, kind: 'round' }), (g) => put(g, 5.0, 1.6, -0.4, { yaw: -0.1, s: 1.9 }));
  } else if (def.id === 'flock') {
    // birds of the flocks overhead, held mid-wingbeat flying out of the glass toward you, a clock hanging among them
    const flock = [[-4.2, 3.3, 0.9, 0.7], [-2.6, 4.6, 1.4, -0.4], [-1.0, 3.0, 1.0, 0.5], [0.8, 4.2, 1.6, 0.05], [2.4, 3.1, 1.1, -0.5], [3.8, 4.5, 1.3, 0.75], [-3.2, 1.8, 1.6, -0.3]];
    for (const [x, y, z, flap] of flock) add('figure', put(frozenFlockBird(flap), x, y, z, { yaw: 0.6 * Math.sin(x * 1.7), pitch: -0.75, roll: 0.15 * Math.cos(y), s: 0.8 }));
    addClock(clock({ minute: m, kind: 'round' }), (g) => put(g, 0.9, 2.1, 0.6, { roll: 0.35, s: 1.3 }));
    add('float', put(new THREE.IcosahedronGeometry(0.22, 1), -1.8, 1.0, 1.4));
    add('dust', put(motes(10, 5, 1.8, 40, 7), 0, 0.6, 0.8));
  } else if (def.id === 'carriers') {
    // five carriers mid-step under their loads, in a file along the glass: staves, baskets, headcloths and hats
    const heads = ['headcloth', 'sunhat', 'wrap', 'straw', 'headcloth'], props = ['staff', 'basket', 'staff', 'none', 'basket'];
    for (let i = 0; i < 5; i++) {
      const x = -5 + i * 2.5;
      add('figure', put(who(i % 2 ? 'carry' : 'stride', { head: heads[i], prop: props[i], body: i === 2 ? 'mantle' : 'none', cape: 0.7 + 0.1 * (i % 3) }, 1.8 + 0.06 * (i % 2)), x, 0.6, 0.9 + 0.25 * Math.sin(i), { yaw: Math.PI / 2 }));
    }
    // the third carries a clock tied on his back
    addClock(clock({ minute: m, kind: 'case' }), (g) => put(g, -0.3, 1.25, 0.95, { yaw: Math.PI / 2 - 0.3, roll: 0.25, s: 0.5 }));
    add('dust', put(motes(13, 3.5, 1.6, 30, 5), 0, 0.5, 1.0));
  } else if (def.id === 'dust') {
    add('dust', put(dustCurl({ R: 2.6 }), -0.8, 3.2, 1.2));
    add('dust', put(dustCurl({ R: 1.4, n: 36, seed: 9 }), 2.6, 1.6, 1.0, { roll: 1.2 }));
    addClock(clock({ minute: m, kind: 'case' }), (g) => put(g, 1.0, 1.4, 1.1, { roll: -0.75, pitch: 0.2, s: 1.15 }));
    // a carrier caught in the storm, an arm up against it
    add('figure', put(who('shield', { head: 'wrap', cape: 1.0 }), -3.6, 0.6, 1.0, { yaw: Math.PI / 2 + 0.4 }));
  } else if (def.id === 'moment') {
    // round the ring between the chamber's two shells: its people turned up to the light, a float falling, the great bird, birds
    const R = (CHAMBER.inner[0] + CHAMBER.outer[0]) / 2 + 0.2;
    const ring = (a, r = R) => [Math.sin(a) * r, Math.cos(a) * r];
    const turnIn = (a) => a + Math.PI;
    const people = [
      { a: 0.7, pose: 'armsUp', dress: { head: 'sunhat' }, h: 1.8 },
      { a: 1.5, pose: 'reach', dress: { head: 'headcloth', cape: 1.0 }, h: 1.95 },
      { a: 2.6, pose: 'lookUp', dress: { head: 'wrap', prop: 'basket' }, h: 1.75 },
      { a: 3.3, pose: 'point', dress: { head: 'braid', cape: 0, robe: 0.45 }, h: 1.2 },
      { a: 4.4, pose: 'lookUp', dress: { head: 'straw', prop: 'staff' }, h: 1.85 },
      { a: 5.3, pose: 'armsUp', dress: { head: 'bun', cape: 0.6 }, h: 1.7 },
    ];
    for (const p of people) { const [x, z] = ring(p.a); add('figure', put(who(p.pose, p.dress, p.h), x, 0.1, z, { yaw: turnIn(p.a) + 0.3 })); }
    { const [x, z] = ring(2.0, R + 0.3); add('figure', put(frozenGreatBird({ step: 0.3, look: 1 }), x, 0, z, { yaw: 2.0 + Math.PI / 2, s: 0.58 })); }
    { const [x, z] = ring(1.5, R - 0.3); add('float', put(new THREE.IcosahedronGeometry(0.28, 1), x, 1.0, z)); }
    for (const [a, r, y, flap] of [[0.2, 4.4, 5.6, 0.7], [1.1, 2.6, 6.2, -0.4], [2.3, 3.5, 5.9, 0.5], [3.6, 2.0, 6.5, -0.5], [4.8, 3.8, 5.5, 0.75], [5.8, 1.6, 6.6, 0.2]]) {
      const [x, z] = ring(a, r); add('figure', put(frozenFlockBird(flap), x, y, z, { yaw: a + 1.4, s: 1.4 }));
    }
    { const [x, z] = ring(3.9); addClock(clock({ minute: m, kind: 'round' }), (g) => put(g, x, 2.6, z, { yaw: turnIn(3.9), roll: 0.5, s: 1.4 })); }
    add('dust', motes(2 * R, 5, 2 * R, 70, 13));
    // the light's own streak, held where it crossed: a bright thread arcing over the chamber between its shells
    add('streak', tube([V(-9, 1.5, 3), V(-5, 5.4, 1.4), V(0, 6.3, -0.4), V(5, 5.5, -1.6), V(9.2, 2.2, -2.6)], 0.16, 24));
  }
  return out;
}

// ------------------------------------------------------------------ the glass

/** A lens of clear glass: the front of an ellipsoid (rx along, ry up, d out), its back half sunk in the wall it sits on. */
export function lensGeometry(rx, ry, d) {
  return new THREE.SphereGeometry(1, 30, 16).scale(rx, ry, d);
}
/** The tooth: a shard of glass (a pointed outline extruded `t` thick), centred on its thickness, foot at 0. */
export function toothGeometry(t = 3.6) {
  const s = new THREE.Shape();
  const pts = [[-7, -1.2], [-6.7, 5.5], [-5.4, 9.2], [-2.4, 11.6], [0.6, 10.1], [3.2, 12.8], [5.8, 8.4], [7, 3], [7.2, -1.2]];
  s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p);
  return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 1 }).translate(0, 0, -t / 2);
}
/** The chamber's shell of radius R, height H, open in a cleft of half-width `cleft` round yaw 0 (+z). */
export function shellGeometry(R, H, cleft, { nA = 40, nE = 10 } = {}) {
  const pos = [], a0 = cleft, a1 = TAU - cleft;
  const P = (a, e) => [Math.sin(a) * Math.cos(e) * R, Math.sin(e) * H, Math.cos(a) * Math.cos(e) * R];
  for (let i = 0; i < nA; i++) for (let j = 0; j < nE; j++) {
    const a = a0 + (a1 - a0) * (i / nA), b = a0 + (a1 - a0) * ((i + 1) / nA), e = (Math.PI / 2) * (j / nE), f = (Math.PI / 2) * ((j + 1) / nE);
    pos.push(...P(a, e), ...P(b, e), ...P(b, f), ...P(a, e), ...P(b, f), ...P(a, f));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // (the ellipsoid's own normals, smooth: the cut reads |n·v| a pixel, and a facet's would print in patches)
  const nor = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) { const n = V(pos[i] / (R * R), pos[i + 1] / (H * H), pos[i + 2] / (R * R)).normalize(); nor[i] = n.x; nor[i + 1] = n.y; nor[i + 2] = n.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}
/** The cleft's two cut faces, between the inner and the outer shell. */
export function cleftGeometry(inner, outer, cleft, nE = 10) {
  const pos = [];
  for (const a of [cleft, TAU - cleft]) for (let j = 0; j < nE; j++) {
    const e = (Math.PI / 2) * (j / nE), f = (Math.PI / 2) * ((j + 1) / nE);
    const p = (R, H, t) => [Math.sin(a) * Math.cos(t) * R, Math.sin(t) * H, Math.cos(a) * Math.cos(t) * R];
    pos.push(...p(...inner, e), ...p(...outer, e), ...p(...outer, f), ...p(...inner, e), ...p(...outer, f), ...p(...inner, f));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ building them

/**
 * Lay the scenes into the world. kit: the world's RoomKit (its merge, its materials); M: the dunes' materials (M.float);
 * ground: the terrain; veils: the level's washes; faceOf(ridgeName, from: Vector3, dir: Vector3) → { point, normal } | null,
 * the ridge's glass as drawn (src/levels/glass-dunes.js). Returns the scenes as placed ({ id, at (the lens's middle),
 * stand (where you read it from), frame (Matrix4) … }), the lens mesh and the wash's update.
 */
export function buildFrozenScenes(scene, kit, M, { ground, veils = null, faceOf = () => null } = {}) {
  const L = FROZEN_LOOK;
  const mats = {
    // (the people and creatures: their glass tones in their vertices, inked as the game's people are; both faces, for the wings)
    figure: kit.mat({ color: '#ffffff', vertexColors: true, flat: true, glow: 0.28, line: 0.8, lineTint: 0.5, hatch: 0.3, spot: 0, side: THREE.DoubleSide }),
    dust: kit.mat({ color: L.dust, flat: true, glow: 0.25, line: 0.3, lineTint: 1, hatch: 0, spot: 0 }),
    face: kit.mat({ color: L.face, flat: true, glow: 0.5, spot: 0 }),
    hands: kit.mat({ color: L.hands, flat: true, spot: 0 }),
    float: M.float,
    streak: kit.mat({ color: L.streak, glow: 0.95, flat: true, line: 0.2, lineTint: 1 }),
  };
  const lensMat = makeMaterial({ color: L.lens, flat: true, glow: 0.22, veil: L.cut, line: 0.7, lineTint: 0.67, hatch: 0.2, spot: 0 });
  const lenses = [], placed = [];
  const H = (x, z) => ground.heightAt(x, z);
  for (const def of FROZEN_SCENES) {
    let frame, lens, at, stand, size;
    if (def.kind === 'wall') {
      // the wall's face as drawn, its most outward point over the lens's height (a face that leans back, or a lobe that
      // bellies, never closes over the scene), and the way out of it, level
      const [fx, fz] = def.from, dir = V(def.dir[0], 0, def.dir[1]).normalize();
      let best = null;
      for (const up of [0.6, 2, 3.5, 5, 6.5]) {
        const hit = faceOf(def.ridge, V(fx, H(fx, fz) + up, fz), dir);
        if (hit && (!best || hit.point.dot(dir) < best.point.dot(dir))) best = hit;
      }
      if (!best) continue;
      const n = V(best.normal.x, 0, best.normal.z);
      if (n.lengthSq() < 1e-4 || n.dot(dir) > 0) n.copy(dir).negate();
      n.normalize();
      const k = SCENE_SCALE.wall, rx = (def.id === 'carriers' ? 7.4 : 6.2) * k, ry = 4.2 * k, d = 3.0 * k;
      const base = best.point.clone().addScaledVector(n, 0.2);
      // (its foot on the sand in front of it, where the figures stand)
      const out = base.clone().addScaledVector(n, d * 0.6);
      base.y = Math.min(H(base.x, base.z), H(out.x, out.z)) - 0.6;
      frame = new THREE.Matrix4().compose(base, _q.setFromAxisAngle(V(0, 1, 0), Math.atan2(n.x, n.z)).clone(), V(1, 1, 1));
      lens = lensGeometry(rx, ry, d).translate(0, ry - 0.6 * k, 0).applyMatrix4(frame);
      at = V(0, 2.4 * k, d * 0.5).applyMatrix4(frame);
      stand = base.clone().addScaledVector(n, d + 2.2); stand.y = H(stand.x, stand.z);
      size = [rx, ry, d];
    } else if (def.kind === 'tooth') {
      const [x, z] = def.at, yaw = Math.atan2(def.toward[0] - x, def.toward[1] - z);
      frame = new THREE.Matrix4().compose(V(x, H(x, z) - 0.5, z), _q.setFromAxisAngle(V(0, 1, 0), yaw).clone(), V(1, 1, 1));
      const k = SCENE_SCALE.tooth;
      lens = toothGeometry(3.6).scale(k, k, k).applyMatrix4(frame);
      at = V(0, 3 * k, 0).applyMatrix4(frame);
      const out = V(Math.sin(yaw), 0, Math.cos(yaw));
      stand = V(x, 0, z).addScaledVector(out, 3.2 * k); stand.y = H(stand.x, stand.z);
      size = [7 * k, 12 * k, 3.6 * k];
    } else {
      // the chamber, on the breaking wave's hollow floor, its cleft turned to the north camp
      const [x, z] = def.at, yaw = Math.atan2(def.toward[0] - x, def.toward[1] - z);
      const y = Math.min(H(x, z), H(x + 4, z), H(x - 4, z), H(x, z + 4), H(x, z - 4)) - 0.3;
      frame = new THREE.Matrix4().compose(V(x, y, z), _q.setFromAxisAngle(V(0, 1, 0), yaw).clone(), V(1, 1, 1));
      lens = merge([shellGeometry(...CHAMBER.outer, CHAMBER.cleft), shellGeometry(...CHAMBER.inner, CHAMBER.cleft), cleftGeometry(CHAMBER.inner, CHAMBER.outer, CHAMBER.cleft)]).applyMatrix4(frame);
      at = V(x, y + 0.3, z);
      stand = at.clone();
      size = [CHAMBER.outer[0], CHAMBER.outer[1], CHAMBER.outer[0]];
    }
    // (scenes in the walls: their frame's z from the face out; the tooth's and the chamber's: their middle)
    const S = SCENE_SCALE[def.kind], partsFrame = frame.clone().multiply(new THREE.Matrix4().makeScale(S, S, S));
    for (const [layer, g] of sceneParts(def)) kit.add(mats[layer], g.applyMatrix4(partsFrame), { solid: false, shadow: layer !== 'dust' });
    // its glass: a mesh of its own (culled by the view as any), its rim in the G-buffer, its body a wash
    const mesh = new THREE.Mesh(clean(lens), lensMat);
    mesh.name = `The glass that holds a stopped minute (${def.id})`;
    mesh.userData.castShadow = false;   // (clear glass: the sun lights what it holds)
    scene.add(mesh);
    // (the tooth stands alone, its glass all clear: a stronger wash, or it reads as nothing at all)
    const wash = veils ? veils.add(mesh, { color: L.wash, alpha: def.kind === 'tooth' ? 0.36 : def.kind === 'chamber' ? 0.2 : L.washAlpha, glow: 0.15 }) : null;
    lenses.push(mesh);
    placed.push({ ...def, at, stand, frame, size, lens: mesh, wash });
  }
  return {
    scenes: placed, lenses,
    /** The washes only near the eye: a lens far off reads by its inked rim alone (src/veil.js Veils: userData.off). */
    update(camera) {
      if (!camera) return;
      for (const s of placed) if (s.wash) s.wash.userData.off = s.at.distanceTo(camera.position) > WASH_NEAR;
    },
  };
}

/** The scenes as the world's traces (src/story/index.js: look at it, its line said, its flag set). */
export const frozenTraces = () => FROZEN_SCENES.map((f) => ({
  id: `glassdunes.frozen.${f.id}`, at: [f.read[0], null, f.read[1]], label: f.label, range: f.kind === 'chamber' ? 5 : 4, height: 6,
  person: { id: `trace.glassdunes.frozen.${f.id}`, name: 'The glass', title: '', color: '#a6e8c4',
    talk: { nodes: { look: { say: [f.line], do: { set: { [`sight.glassdunes.frozen.${f.id}`]: true } } } } } },
}));
